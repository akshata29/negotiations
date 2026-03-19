"""
Simulation service — drives a negotiation through a scripted scenario end-to-end.

Each scenario provides realistic vendor reply bodies that will be correctly
classified by the AI response_analyzer, then feeds them through the real
orchestrator pipeline (auto-approving any human-in-the-loop gates).
"""
from __future__ import annotations
import logging
from typing import Any

from app.models.negotiation import NegotiationInDB, NegotiationStage
from app.services.cosmos import CosmosService
from app.agents import orchestrator

log = logging.getLogger(__name__)

# ── Scenario definitions ──────────────────────────────────────────────────

SCENARIOS: dict[str, dict[str, Any]] = {
    "quick_win": {
        "label": "Quick Win",
        "icon": "🚀",
        "color": "green",
        "description": "Vendor confirms they're the right contact, then immediately accepts your proposal.",
        "contact_reply": (
            "Hi James,\n\nYes, I am the right person to discuss payment terms for our account. "
            "I confirm that I handle all vendor finance matters for our organization. "
            "Please go ahead and send over your proposal.\n\nBest regards"
        ),
        "proposal_reply": (
            "James,\n\nThank you for the detailed proposal. We have reviewed the terms and "
            "we are happy to accept the terms as proposed. "
            "Please send the formal documentation and we will sign off promptly. "
            "We appreciate McLane's partnership and look forward to a long-term arrangement.\n\nBest regards"
        ),
    },
    "friendly_counter": {
        "label": "Friendly Counter → Accept",
        "icon": "🤝",
        "color": "blue",
        "description": "Vendor confirms, counter-proposes modest terms, then accepts your counter-response.",
        "contact_reply": (
            "Hello James,\n\nConfirmed — I am the appropriate contact for payment terms discussions. "
            "Happy to work through this with McLane.\n\nLooking forward to your proposal."
        ),
        "proposal_reply": (
            "Hi James,\n\nThank you for reaching out. We appreciate the proposal. "
            "We would like to counter-propose slightly adjusted terms: "
            "a cash discount of 1.5% on 10 days, net 30 days. "
            "This aligns with our internal structure and we believe this is a fair middle ground. "
            "We are open to further discussion if needed.\n\nBest regards"
        ),
        "counter_reply": (
            "James,\n\nThank you for your response and for being flexible. "
            "We can accept the revised terms you have outlined. "
            "This works for us and we are happy to proceed. "
            "Please confirm acceptance and we can formalize the agreement.\n\nThank you"
        ),
    },
    "tough_negotiation": {
        "label": "Tough Negotiation",
        "icon": "⚔️",
        "color": "orange",
        "description": "Vendor pushes back hard with a steep counter, then agrees to a middle ground after your response.",
        "contact_reply": (
            "James,\n\nYes I am the right contact, though I will be direct with you — "
            "we have well-established payment terms with our clients and do not frequently revise them. "
            "Send your proposal and I will review.\n\nRegards"
        ),
        "proposal_reply": (
            "James,\n\nI have reviewed your proposal carefully. "
            "Our current terms are standard across our entire customer base "
            "and we are not in a position to match what you are requesting. "
            "The maximum we could offer is a 0.75% cash discount on 10 days, net 45. "
            "This is a counter-proposal and reflects the limits of our finance team's approval authority. "
            "We hope you understand our constraints.\n\nRegards"
        ),
        "counter_reply": (
            "James,\n\nWe have escalated internally and received approval for a compromise. "
            "We can move forward at 1.25% cash discount on 10 days, net 30 days. "
            "This is our best and final offer given our approval limits. "
            "We accept these terms and would like to proceed to formalize the agreement.\n\nRegards"
        ),
    },
    "rejection": {
        "label": "Flat Rejection",
        "icon": "❌",
        "color": "red",
        "description": "Vendor confirms contact, then declines the proposal — negotiation closes as rejected.",
        "contact_reply": (
            "Hello James,\n\nI am the correct person to handle payment terms for our organization. "
            "Please send over what you have.\n\nRegards"
        ),
        "proposal_reply": (
            "James,\n\nThank you for your proposal. After careful consideration, "
            "we are unable to modify our current payment terms at this time. "
            "Our terms are fixed at the corporate level and are non-negotiable. "
            "We must respectfully decline your proposal. "
            "We value our relationship with McLane and hope to continue our business under existing terms.\n\nRegards"
        ),
    },
    "wrong_contact": {
        "label": "Wrong Contact / Redirect",
        "icon": "↪️",
        "color": "gray",
        "description": "Vendor says they're not the right person — escalated for manual follow-up.",
        "contact_reply": (
            "Hi James,\n\nI'm afraid I am not the right person for this. "
            "Payment terms and vendor finance matters are handled by our corporate finance department. "
            "I've forwarded your email but I cannot confirm who will follow up or when. "
            "You may want to try reaching out directly to our accounts payable team.\n\nSorry I couldn't be more help"
        ),
    },
}


# ── Simulation runner ─────────────────────────────────────────────────────

async def run_simulation(negotiation_id: str, scenario: str) -> dict:
    """
    Drive a negotiation through a scripted scenario end-to-end.

    Auto-approves all human-in-the-loop email drafts so the full workflow
    completes without manual intervention. Returns the final negotiation state,
    full email thread, and a human-readable execution log.
    """
    if scenario not in SCENARIOS:
        raise ValueError(f"Unknown scenario '{scenario}'. Valid: {list(SCENARIOS)}")

    s = SCENARIOS[scenario]
    db = CosmosService.get()
    log_entries: list[dict] = []

    def _step(action: str, detail: str, stage: str = ""):
        entry = {"action": action, "detail": detail}
        if stage:
            entry["stage"] = stage
        log_entries.append(entry)
        log.info("[SIM %s] %s — %s", scenario, action, detail)

    async def _refresh() -> NegotiationInDB:
        data = await db.get_negotiation(negotiation_id)
        if not data:
            raise ValueError(f"Negotiation {negotiation_id} disappeared")
        return NegotiationInDB(**{k: v for k, v in data.items() if not k.startswith("_")})

    neg = await _refresh()
    _step("start", f"Beginning scenario '{s['label']}'", neg.stage)

    # ── Phase 0: re-trigger contact draft if stuck before approval ────────
    if neg.stage == NegotiationStage.CONTACT_DRAFTING:
        vendor_email = neg.vendor_email or "vendor@example.com"
        neg = await orchestrator.advance_to_contact_draft(neg, vendor_email)
        _step("contact_draft", "Contact email drafted by AI agent", neg.stage)

    # ── Phase 1: auto-approve if stuck at contact approval ────────────────
    if neg.stage == NegotiationStage.CONTACT_APPROVAL:
        await orchestrator.approve_email(negotiation_id, approved_by="Simulation")
        neg = await _refresh()
        _step("auto_approve", "Contact draft auto-approved", neg.stage)

    # ── Phase 2: inject contact reply ────────────────────────────────────
    if neg.stage == NegotiationStage.CONTACT_SENT:
        result = await orchestrator.submit_vendor_reply(
            negotiation_id, s["contact_reply"], sender_name=neg.vendor_long_name
        )
        neg = NegotiationInDB(**{k: v for k, v in result["negotiation"].items() if not k.startswith("_")})
        analysis = result.get("analysis", {})
        _step(
            "contact_reply",
            f"Vendor confirms: {analysis.get('contact_status', '?')} — {analysis.get('summary', '')}",
            neg.stage,
        )

    # ── Phase 3: auto-approve proposal draft ──────────────────────────────
    if neg.stage == NegotiationStage.PROPOSAL_APPROVAL:
        await orchestrator.approve_email(negotiation_id, approved_by="Simulation")
        neg = await _refresh()
        _step("auto_approve", "Proposal draft auto-approved", neg.stage)

    # ── Phase 4: inject proposal reply (if scenario has one) ──────────────
    if neg.stage == NegotiationStage.PROPOSAL_SENT and "proposal_reply" in s:
        result = await orchestrator.submit_vendor_reply(
            negotiation_id, s["proposal_reply"], sender_name=neg.vendor_long_name
        )
        neg = NegotiationInDB(**{k: v for k, v in result["negotiation"].items() if not k.startswith("_")})
        analysis = result.get("analysis", {})
        _step(
            "proposal_reply",
            f"Vendor response: {analysis.get('response_type', '?')} — {analysis.get('summary', '')}",
            neg.stage,
        )

    # ── Phase 5: auto-approve counter draft ───────────────────────────────
    if neg.stage == NegotiationStage.COUNTER_APPROVAL:
        await orchestrator.approve_email(negotiation_id, approved_by="Simulation")
        neg = await _refresh()
        _step("auto_approve", "Counter draft auto-approved", neg.stage)

    # ── Phase 6: inject counter reply (if scenario has one) ───────────────
    if neg.stage == NegotiationStage.COUNTER_SENT and "counter_reply" in s:
        result = await orchestrator.submit_vendor_reply(
            negotiation_id, s["counter_reply"], sender_name=neg.vendor_long_name
        )
        neg = NegotiationInDB(**{k: v for k, v in result["negotiation"].items() if not k.startswith("_")})
        analysis = result.get("analysis", {})
        _step(
            "counter_reply",
            f"Vendor final: {analysis.get('response_type', '?')} — {analysis.get('summary', '')}",
            neg.stage,
        )

    # ── Collect final state ───────────────────────────────────────────────
    final_neg = await db.get_negotiation(negotiation_id)
    emails = await db.list_emails(negotiation_id)
    final_stage = final_neg.get("stage", "unknown")

    _step("complete", f"Simulation finished at stage: {final_stage}", final_stage)

    return {
        "scenario": scenario,
        "scenario_label": s["label"],
        "final_stage": final_stage,
        "rounds": final_neg.get("rounds", 0),
        "agreed_terms": final_neg.get("agreed_terms"),
        "log": log_entries,
        "negotiation": final_neg,
        "emails": emails,
    }


def list_scenarios() -> list[dict]:
    """Return scenario metadata for the UI."""
    return [
        {
            "id": k,
            "label": v["label"],
            "icon": v["icon"],
            "color": v["color"],
            "description": v["description"],
            "has_counter": "counter_reply" in v,
            "rounds": 2 if "counter_reply" in v else 1,
        }
        for k, v in SCENARIOS.items()
    ]
