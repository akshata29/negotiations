"""
Email Composer Agent — drafts professional negotiation emails from the
Merchandising Leader's perspective using the Foundry Agent Service v2 Responses API.
"""
from __future__ import annotations
import json
import logging
import re
from typing import Optional

from app.agents.client import get_foundry_project_client
from app.config import get_settings
from app.models.negotiation import ABGroup, STRATEGY_DESCRIPTIONS

# Agent name as registered in Foundry Agent Service
_EMAIL_AGENT_NAME = "negotiation-email-composer"
_email_agent_version: str = "1"  # set at startup by main.py after bootstrap

# Mandatory output rules appended to every email-composer system prompt.
# These are NOT user-editable — they are always appended by main.py / apply endpoint.
EMAIL_OUTPUT_RULES = (
    "OUTPUT RULES (mandatory):\n"
    "- Your entire response MUST be a single raw JSON object.\n"
    "- Do NOT wrap output in markdown code fences (no ```json or ```).\n"
    "- Do NOT include any prose, explanation, or text outside the JSON object.\n"
    "- The very first character of your response must be '{' and the last must be '}'."
)


def set_agent_version(version: str) -> None:
    """Called by main.py lifespan after create_version to pin the exact bootstrapped version."""
    global _email_agent_version
    _email_agent_version = str(version)
    log.info("[email_composer] using agent '%s' version %s", _EMAIL_AGENT_NAME, _email_agent_version)

log = logging.getLogger(__name__)
settings = get_settings()

PERSONA = f"""You are {settings.MERCH_LEADER_NAME}, {settings.MERCH_LEADER_TITLE} at {settings.MERCH_LEADER_COMPANY}.
You write professional, concise, and business-like emails on behalf of {settings.MERCH_LEADER_COMPANY}'s procurement and merchandising team.
Your tone is respectful, direct, and collaborative — you are negotiating for better vendor terms as part of a company-wide initiative.
Always sign off as:
{settings.MERCH_LEADER_NAME}
{settings.MERCH_LEADER_TITLE}
{settings.MERCH_LEADER_COMPANY}
{settings.MERCH_LEADER_PHONE}
{settings.MERCH_LEADER_EMAIL}"""

CONTACT_VERIFICATION_PROMPT = """Draft a short, professional initial contact email to a vendor.

Context:
- Vendor Name: {vendor_name}
- Contact Email: {vendor_email}
- Purpose: We are conducting a company-wide vendor terms review. We want to verify this is the correct point of contact for payment terms discussions.
- Do NOT mention specific numbers or terms yet.
- Keep the email under 200 words.
- Ask if they are the appropriate person to discuss payment terms (cash discount %, term days, net days) or if we should contact someone else.

Return a JSON object with:
{{
  "subject": "...",
  "body": "..."
}}"""

PROPOSAL_PROMPT = """Draft a professional vendor terms negotiation email.

Vendor Information:
- Vendor Name: {vendor_name}
- Current Terms: Cash Discount: {std_terms}% / {term_days} days, Net: {net_days} days

Negotiation Strategy (Group {ab_group}): {strategy}

Proposed New Terms:
{proposed_terms}

Guidelines:
- Reference the current terms and explain the business context (working capital optimization).
- Present the proposed terms clearly and professionally.
- Keep a collaborative, win-win tone.
- Mention that ABC values the long-term partnership.
- Keep under 300 words.
- Do not use aggressive language.

Return a JSON object with:
{{
  "subject": "...",
  "body": "..."
}}"""

COUNTER_RESPONSE_PROMPT = """Draft a follow-up email in response to a vendor's counter-offer.

Vendor Name: {vendor_name}
Our Original Proposal: {original_proposal}
Vendor's Counter-Offer / Response: {vendor_response}
Current negotiation round: {round_num}

Guidelines:
- Acknowledge their response respectfully.
- If their counter is close, consider accepting or splitting the difference.
- If their counter is too far off, politely re-affirm our proposal with a brief rationale.
- After round 3, suggest escalating to a call if no agreement is reached.
- Keep under 250 words.

Return a JSON object with:
{{
  "subject": "...",
  "body": "...",
  "recommendation": "accept_counter | push_back | escalate"
}}"""


async def draft_contact_email(
    vendor_name: str,
    vendor_email: str,
    conversation_id: Optional[str] = None,
) -> dict:
    prompt = CONTACT_VERIFICATION_PROMPT.format(
        vendor_name=vendor_name, vendor_email=vendor_email
    )
    return await _draft(prompt, conversation_id)


async def draft_proposal_email(
    vendor_name: str,
    std_terms: float,
    term_days: int,
    net_days: int,
    ab_group: ABGroup,
    proposed_terms: dict,
    conversation_id: Optional[str] = None,
) -> dict:
    terms_str = []
    if "std_terms" in proposed_terms:
        terms_str.append(f"- Cash Discount: {proposed_terms['std_terms']}% (currently {std_terms}%)")
    if "term_days" in proposed_terms:
        terms_str.append(f"- Term Days: {proposed_terms['term_days']} days (currently {term_days})")
    if "net_days" in proposed_terms:
        terms_str.append(f"- Net Days: {proposed_terms['net_days']} days (currently {net_days})")
    prompt = PROPOSAL_PROMPT.format(
        vendor_name=vendor_name,
        std_terms=std_terms,
        term_days=term_days,
        net_days=net_days,
        ab_group=ab_group.value,
        strategy=STRATEGY_DESCRIPTIONS[ab_group],
        proposed_terms="\n".join(terms_str),
    )
    return await _draft(prompt, conversation_id)


async def draft_counter_response(
    vendor_name: str,
    original_proposal: str,
    vendor_response: str,
    round_num: int,
    conversation_id: Optional[str] = None,
) -> dict:
    prompt = COUNTER_RESPONSE_PROMPT.format(
        vendor_name=vendor_name,
        original_proposal=original_proposal,
        vendor_response=vendor_response,
        round_num=round_num,
    )
    return await _draft(prompt, conversation_id)


async def _draft(prompt: str, conversation_id: Optional[str] = None) -> dict:
    """Send prompt to the email-composer agent via v2 Responses API."""
    project = get_foundry_project_client()
    openai = project.get_openai_client()

    if conversation_id is None:
        conv = await openai.conversations.create()
        conversation_id = conv.id

    response = await openai.responses.create(
        conversation=conversation_id,
        extra_body={"agent_reference": {"name": _EMAIL_AGENT_NAME, "type": "agent_reference", "version": _email_agent_version}},
        input=prompt,
    )

    text = _extract_text(response, _EMAIL_AGENT_NAME)
    log.warning("[email_composer] extracted text (%d chars): %r", len(text), text[:300])
    return json.loads(text)


def _strip_code_fence(text: str) -> str:
    """Remove markdown ```json ... ``` fences that the agent wraps around its JSON output."""
    stripped = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.IGNORECASE)
    stripped = re.sub(r"\n?```\s*$", "", stripped)
    return stripped.strip()


def _extract_text(response, agent_name: str) -> str:
    """Extract text from Foundry Responses API output — uses output[N].content[N].text directly."""
    # Always log the response structure at WARNING level so it appears in prod logs
    try:
        raw = response.model_dump()
        output_items = raw.get("output", [])
        log.warning(
            "[%s] Foundry response: output_text=%r | output_items=%d | status=%r | error=%r",
            agent_name,
            raw.get("output_text", "<no attr>"),
            len(output_items),
            raw.get("status"),
            raw.get("error"),
        )
        for i, item in enumerate(output_items):
            content = item.get("content", [])
            log.warning(
                "[%s] output[%d]: type=%r role=%r content_parts=%d",
                agent_name, i, item.get("type"), item.get("role"), len(content),
            )
            for j, part in enumerate(content):
                log.warning(
                    "[%s] output[%d].content[%d]: type=%r text=%r",
                    agent_name, i, j, part.get("type"), repr(part.get("text", ""))[:200],
                )
    except Exception as dump_exc:
        log.warning("[%s] Could not dump response: %s", agent_name, dump_exc)

    # Primary path: iterate output items
    for item in getattr(response, "output", []):
        for part in getattr(item, "content", []):
            text = getattr(part, "text", None)
            if text and text.strip():
                return _strip_code_fence(text.strip())
    # Fallback: output_text convenience property
    text = getattr(response, "output_text", None)
    if text and text.strip():
        return _strip_code_fence(text.strip())
    raise RuntimeError(
        f"Foundry agent '{agent_name}' returned empty output. "
        "See WARNING logs above for the full response structure."
    )
