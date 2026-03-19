"""
Negotiation Orchestrator — manages the full negotiation state machine.
Coordinates the Email Composer and Response Analyzer agents.
Persists all state to Cosmos DB and broadcasts WebSocket events.
"""
from __future__ import annotations
import logging
from datetime import datetime
from typing import Optional, Callable, Awaitable
import uuid

from app.config import get_settings
from app.models.negotiation import (
    ABGroup,
    EmailDirection,
    EmailStatus,
    EmailThread,
    NegotiationInDB,
    NegotiationStage,
    ProposedTerms,
    STRATEGY_DESCRIPTIONS,
)
from app.models.vendor import NegotiationStatus
from app.services.cosmos import CosmosService
from app.services.rl import RLService
from app.agents import email_composer, response_analyzer

log = logging.getLogger(__name__)
settings = get_settings()

# Broadcast callback type
BroadcastFn = Callable[[dict], Awaitable[None]]
_broadcast: Optional[BroadcastFn] = None


def set_broadcast(fn: BroadcastFn):
    global _broadcast
    _broadcast = fn


async def _broadcast_event(event_type: str, payload: dict):
    if _broadcast:
        try:
            await _broadcast({"event": event_type, "data": payload})
        except Exception as exc:
            log.debug("Broadcast failed: %s", exc)


def _build_proposed_terms(group: ABGroup, vendor: dict) -> ProposedTerms:
    std_terms = float(vendor.get("std_terms", 0))
    term_days = int(vendor.get("term_days", 0))
    net_days = int(vendor.get("net_days", 30))

    proposed_std = max(2.0, round(std_terms + 1.0, 2)) if group in (ABGroup.A, ABGroup.C) else None
    proposed_td = (term_days + 10) if group in (ABGroup.B, ABGroup.C) else None
    proposed_nd = (net_days + 10) if group in (ABGroup.B, ABGroup.C) else None

    return ProposedTerms(std_terms=proposed_std, term_days=proposed_td, net_days=proposed_nd)


# ── Public orchestration functions ────────────────────────────────────────


async def start_negotiation(vendor_id: int, override_ab_group: Optional[ABGroup] = None) -> NegotiationInDB:
    """Create a new negotiation record and draft the first contact email."""
    db = CosmosService.get()
    rl = RLService.get()

    vendor = await db.get_vendor(vendor_id)
    if not vendor:
        raise ValueError(f"Vendor {vendor_id} not found")
    if not vendor.get("eligible_for_negotiation"):
        raise ValueError(f"Vendor {vendor_id} is not eligible: {vendor.get('exclusion_reason')}")

    # Assign AB group via RL or override
    ab_group = override_ab_group or rl.select_group()

    proposed_terms = _build_proposed_terms(ab_group, vendor)

    neg = NegotiationInDB(
        vendor_id=int(vendor.get("vendor_id", vendor_id)),
        vendor_long_name=vendor.get("vendor_long_name", ""),
        vendor_short_name=vendor.get("vendor_short_name"),
        vendor_email=vendor.get("email"),
        original_std_terms=float(vendor.get("std_terms", 0)),
        original_term_days=int(vendor.get("term_days", 0)),
        original_net_days=int(vendor.get("net_days", 30)),
        proposed_terms=proposed_terms,
        stage=NegotiationStage.CONTACT_DRAFTING,
        ab_group=ab_group,
        strategy=STRATEGY_DESCRIPTIONS[ab_group],
    )

    doc = neg.model_dump()
    doc["vendor_id"] = str(neg.vendor_id)
    await db.upsert_negotiation(doc)

    # Update vendor status
    vendor["negotiation_status"] = NegotiationStatus.IN_PROGRESS
    vendor["active_negotiation_id"] = neg.id
    vendor["ab_group"] = ab_group
    await db.upsert_vendor(vendor)

    # Draft contact email
    neg = await advance_to_contact_draft(neg, vendor.get("email", "vendor@example.com"))
    await _broadcast_event("negotiation_started", {"negotiation_id": neg.id, "vendor_id": vendor_id})
    return neg


async def advance_to_contact_draft(neg: NegotiationInDB, vendor_email: str) -> NegotiationInDB:
    """(Re-)draft the initial contact email and move negotiation to CONTACT_APPROVAL."""
    return await _advance_to_contact_draft(neg, vendor_email)


async def _advance_to_contact_draft(neg: NegotiationInDB, vendor_email: str) -> NegotiationInDB:
    db = CosmosService.get()
    draft = await email_composer.draft_contact_email(
        vendor_name=neg.vendor_long_name,
        vendor_email=vendor_email,
    )
    email_doc = EmailThread(
        negotiation_id=neg.id,
        vendor_id=neg.vendor_id,
        sender_name=settings.MERCH_LEADER_NAME,
        sender_email=settings.MERCH_LEADER_EMAIL,
        recipient_name=neg.vendor_long_name,
        recipient_email=neg.vendor_email or vendor_email,
        subject=draft.get("subject", "Payment Terms Review"),
        body=draft.get("body", ""),
        direction=EmailDirection.OUTBOUND,
        status=EmailStatus.PENDING_APPROVAL,
        stage=NegotiationStage.CONTACT_DRAFTING,
    )
    email_data = email_doc.model_dump()
    email_data["negotiation_id"] = neg.id  # ensure partition key
    await db.upsert_email(email_data)

    neg.stage = NegotiationStage.CONTACT_APPROVAL
    neg.pending_approval_email_id = email_doc.id
    neg.updated_at = datetime.utcnow().isoformat()
    await db.upsert_negotiation({**neg.model_dump(), "vendor_id": str(neg.vendor_id)})
    await _broadcast_event("approval_needed", {"negotiation_id": neg.id, "email_id": email_doc.id, "stage": neg.stage})
    return neg


async def approve_email(negotiation_id: str, approved_by: str, edited_body: Optional[str] = None) -> NegotiationInDB:
    """Human approves (and optionally edits) a pending email draft."""
    db = CosmosService.get()
    neg_data = await db.get_negotiation(negotiation_id)
    if not neg_data:
        raise ValueError(f"Negotiation {negotiation_id} not found")

    neg = NegotiationInDB(**{k: v for k, v in neg_data.items() if not k.startswith("_")})
    email_id = neg.pending_approval_email_id
    if not email_id:
        raise ValueError("No email pending approval")

    emails = await db.list_emails(negotiation_id)
    email_data = next((e for e in emails if e["id"] == email_id), None)
    if not email_data:
        raise ValueError(f"Email {email_id} not found")

    # Apply edits
    if edited_body:
        email_data["body"] = edited_body
        email_data["human_edited"] = True
    email_data["status"] = EmailStatus.APPROVED
    email_data["approved_by"] = approved_by
    email_data["approved_at"] = datetime.utcnow().isoformat()
    await db.upsert_email(email_data)

    # Advance stage: approval → sent
    stage_map = {
        NegotiationStage.CONTACT_APPROVAL: NegotiationStage.CONTACT_SENT,
        NegotiationStage.PROPOSAL_APPROVAL: NegotiationStage.PROPOSAL_SENT,
        NegotiationStage.COUNTER_APPROVAL: NegotiationStage.COUNTER_SENT,
    }
    neg.stage = stage_map.get(neg.stage, neg.stage)
    email_data["status"] = EmailStatus.SENT
    email_data["sent_at"] = datetime.utcnow().isoformat()
    await db.upsert_email(email_data)

    neg.pending_approval_email_id = None
    neg.updated_at = datetime.utcnow().isoformat()
    await db.upsert_negotiation({**neg.model_dump(), "vendor_id": str(neg.vendor_id)})
    await _broadcast_event("email_sent", {"negotiation_id": neg.id, "stage": neg.stage})
    return neg


async def submit_vendor_reply(negotiation_id: str, body: str, sender_name: Optional[str] = None) -> dict:
    """
    Process a vendor's inbound reply.
    Returns the updated negotiation + AI analysis + next action.
    """
    db = CosmosService.get()
    neg_data = await db.get_negotiation(negotiation_id)
    if not neg_data:
        raise ValueError(f"Negotiation {negotiation_id} not found")

    neg = NegotiationInDB(**{k: v for k, v in neg_data.items() if not k.startswith("_")})

    # Store the inbound email
    email_doc = EmailThread(
        negotiation_id=neg.id,
        vendor_id=neg.vendor_id,
        sender_name=sender_name or neg.vendor_long_name,
        sender_email=neg.vendor_email or "",
        recipient_name=settings.MERCH_LEADER_NAME,
        recipient_email=settings.MERCH_LEADER_EMAIL,
        subject=f"RE: Payment Terms - {neg.vendor_long_name}",
        body=body,
        direction=EmailDirection.INBOUND,
        status=EmailStatus.RECEIVED,
        stage=neg.stage,
        ai_suggested=False,
    )
    email_data = email_doc.model_dump()
    email_data["negotiation_id"] = neg.id
    await db.upsert_email(email_data)

    # Analyze the reply
    analysis = {}
    if neg.stage in (NegotiationStage.CONTACT_SENT,):
        analysis = await response_analyzer.analyze_contact_reply(body)
        neg = await _handle_contact_reply(neg, analysis)

    elif neg.stage in (NegotiationStage.PROPOSAL_SENT, NegotiationStage.COUNTER_SENT):
        emails = await db.list_emails(negotiation_id)
        # Get our last outbound email for context
        outbounds = [e for e in emails if e["direction"] == EmailDirection.OUTBOUND and e["status"] == EmailStatus.SENT]
        proposal_summary = outbounds[-1]["body"][:500] if outbounds else ""
        analysis = await response_analyzer.analyze_proposal_reply(
            response_body=body,
            proposal_summary=proposal_summary,
            std_terms=neg.original_std_terms,
            term_days=neg.original_term_days,
            net_days=neg.original_net_days,
        )
        neg = await _handle_proposal_reply(neg, analysis, body)
    else:
        analysis = {"summary": "Reply received but no matching stage handler."}

    await _broadcast_event("reply_received", {"negotiation_id": neg.id, "stage": neg.stage, "analysis": analysis})
    return {"negotiation": neg.model_dump(), "analysis": analysis}


async def _handle_contact_reply(neg: NegotiationInDB, analysis: dict) -> NegotiationInDB:
    db = CosmosService.get()
    status = analysis.get("contact_status", "unclear")
    if status == "confirmed":
        neg.stage = NegotiationStage.CONTACT_CONFIRMED
        # Auto-advance to drafting proposal
        neg = await _draft_proposal(neg)
    elif status in ("rejected", "redirected"):
        neg.stage = NegotiationStage.ESCALATED
        neg.outcome = "wrong_contact"
    else:
        neg.stage = NegotiationStage.ESCALATED
        neg.outcome = "unclear_contact"
    neg.updated_at = datetime.utcnow().isoformat()
    await db.upsert_negotiation({**neg.model_dump(), "vendor_id": str(neg.vendor_id)})
    return neg


async def _draft_proposal(neg: NegotiationInDB) -> NegotiationInDB:
    db = CosmosService.get()
    neg.stage = NegotiationStage.PROPOSAL_DRAFTING
    proposed = neg.proposed_terms or ProposedTerms()
    draft = await email_composer.draft_proposal_email(
        vendor_name=neg.vendor_long_name,
        std_terms=neg.original_std_terms,
        term_days=neg.original_term_days,
        net_days=neg.original_net_days,
        ab_group=neg.ab_group,
        proposed_terms=proposed.model_dump(exclude_none=True),
    )
    email_doc = EmailThread(
        negotiation_id=neg.id,
        vendor_id=neg.vendor_id,
        sender_name=settings.MERCH_LEADER_NAME,
        sender_email=settings.MERCH_LEADER_EMAIL,
        recipient_name=neg.vendor_long_name,
        recipient_email=neg.vendor_email or "",
        subject=draft.get("subject", f"Payment Terms Proposal — {neg.vendor_long_name}"),
        body=draft.get("body", ""),
        direction=EmailDirection.OUTBOUND,
        status=EmailStatus.PENDING_APPROVAL,
        stage=NegotiationStage.PROPOSAL_DRAFTING,
    )
    email_data = email_doc.model_dump()
    email_data["negotiation_id"] = neg.id
    await db.upsert_email(email_data)

    neg.stage = NegotiationStage.PROPOSAL_APPROVAL
    neg.pending_approval_email_id = email_doc.id
    neg.updated_at = datetime.utcnow().isoformat()
    await db.upsert_negotiation({**neg.model_dump(), "vendor_id": str(neg.vendor_id)})
    await _broadcast_event("approval_needed", {"negotiation_id": neg.id, "email_id": email_doc.id, "stage": neg.stage})
    return neg


async def _handle_proposal_reply(neg: NegotiationInDB, analysis: dict, vendor_body: str) -> NegotiationInDB:
    db = CosmosService.get()
    rl = RLService.get()
    response_type = analysis.get("response_type", "unclear")
    neg.rounds += 1

    if response_type == "accepted":
        # ✅ Deal done
        counter_terms = analysis.get("counter_terms", {}) or {}
        neg.agreed_terms = ProposedTerms(
            std_terms=counter_terms.get("std_terms") or (neg.proposed_terms.std_terms if neg.proposed_terms else None),
            term_days=counter_terms.get("term_days") or (neg.proposed_terms.term_days if neg.proposed_terms else None),
            net_days=counter_terms.get("net_days") or (neg.proposed_terms.net_days if neg.proposed_terms else None),
        )
        neg.stage = NegotiationStage.AGREED
        neg.outcome = "accepted"
        # Compute and record RL reward
        reward = rl.compute_reward(
            neg.ab_group,
            {"std_terms": neg.original_std_terms, "term_days": neg.original_term_days, "net_days": neg.original_net_days},
            neg.agreed_terms.model_dump(exclude_none=True),
            neg.rounds,
        )
        neg.improvement_score = reward
        await rl.record_outcome(neg.ab_group, reward)
        # Update vendor status
        vendor = await db.get_vendor(neg.vendor_id)
        if vendor:
            vendor["negotiation_status"] = NegotiationStatus.COMPLETED
            await db.upsert_vendor(vendor)

    elif response_type == "rejected":
        neg.stage = NegotiationStage.REJECTED
        neg.outcome = "rejected"
        await rl.record_outcome(neg.ab_group, 0.0)
        vendor = await db.get_vendor(neg.vendor_id)
        if vendor:
            vendor["negotiation_status"] = NegotiationStatus.COMPLETED
            await db.upsert_vendor(vendor)

    elif response_type == "counter_offer" and neg.rounds < 4:
        # Draft a counter-response
        emails = await db.list_emails(neg.id)
        outbounds = [e for e in emails if e["direction"] == EmailDirection.OUTBOUND]
        last_proposal = outbounds[-1]["body"][:400] if outbounds else ""
        counter_draft = await email_composer.draft_counter_response(
            vendor_name=neg.vendor_long_name,
            original_proposal=last_proposal,
            vendor_response=vendor_body,
            round_num=neg.rounds,
        )
        email_doc = EmailThread(
            negotiation_id=neg.id,
            vendor_id=neg.vendor_id,
            sender_name=settings.MERCH_LEADER_NAME,
            sender_email=settings.MERCH_LEADER_EMAIL,
            recipient_name=neg.vendor_long_name,
            recipient_email=neg.vendor_email or "",
            subject=counter_draft.get("subject", f"RE: Payment Terms - {neg.vendor_long_name}"),
            body=counter_draft.get("body", ""),
            direction=EmailDirection.OUTBOUND,
            status=EmailStatus.PENDING_APPROVAL,
            stage=NegotiationStage.COUNTER_DRAFTING,
        )
        email_data = email_doc.model_dump()
        email_data["negotiation_id"] = neg.id
        await db.upsert_email(email_data)
        rec = counter_draft.get("recommendation", "push_back")
        if rec == "escalate":
            neg.stage = NegotiationStage.ESCALATED
        else:
            neg.stage = NegotiationStage.COUNTER_APPROVAL
            neg.pending_approval_email_id = email_doc.id
        await _broadcast_event("approval_needed", {"negotiation_id": neg.id, "email_id": email_doc.id, "stage": neg.stage})
    else:
        # Too many rounds or unclear — escalate
        neg.stage = NegotiationStage.ESCALATED
        neg.outcome = "escalated"
        await rl.record_outcome(neg.ab_group, 0.2)  # partial credit for reaching escalation

    neg.updated_at = datetime.utcnow().isoformat()
    await db.upsert_negotiation({**neg.model_dump(), "vendor_id": str(neg.vendor_id)})
    return neg


async def escalate_negotiation(negotiation_id: str, notes: str = "") -> NegotiationInDB:
    db = CosmosService.get()
    neg_data = await db.get_negotiation(negotiation_id)
    if not neg_data:
        raise ValueError(f"Negotiation {negotiation_id} not found")
    neg = NegotiationInDB(**{k: v for k, v in neg_data.items() if not k.startswith("_")})
    neg.stage = NegotiationStage.ESCALATED
    neg.human_notes = notes
    neg.updated_at = datetime.utcnow().isoformat()
    await db.upsert_negotiation({**neg.model_dump(), "vendor_id": str(neg.vendor_id)})
    await _broadcast_event("negotiation_escalated", {"negotiation_id": neg.id})
    return neg
