"""
Response Analyzer Agent — classifies vendor email responses and
extracts proposed counter-terms using the Foundry Agent Service v2 Responses API.
"""
from __future__ import annotations
import json
import logging

from app.agents.client import get_foundry_project_client
from app.agents.email_composer import _extract_text
from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

# Agent name as registered in Foundry Agent Service
_ANALYZER_AGENT_NAME = "negotiation-response-analyzer"
_analyzer_agent_version: str = "1"  # set at startup by main.py after bootstrap


def set_agent_version(version: str) -> None:
    """Called by main.py lifespan after create_version to pin the exact bootstrapped version."""
    global _analyzer_agent_version
    _analyzer_agent_version = str(version)
    log.info("[response_analyzer] using agent '%s' version %s", _ANALYZER_AGENT_NAME, _analyzer_agent_version)

ANALYZER_SYSTEM = """You are a professional vendor negotiation analyst for ABC Company's procurement team.
Your job is to analyze incoming vendor email responses to payment terms negotiation and extract:
1. The vendor's intent / sentiment
2. Whether they confirmed they are the right contact (for contact verification emails)
3. Whether they accepted, rejected, or counter-proposed specific terms
4. Any counter-proposed terms (std_terms %, term_days, net_days)

OUTPUT RULES (mandatory):
- Your entire response MUST be a single raw JSON object.
- Do NOT wrap output in markdown code fences (no ```json or ```).
- Do NOT include any prose, explanation, or text outside the JSON object.
- The very first character of your response must be '{' and the last must be '}'."""

CONTACT_ANALYSIS_PROMPT = """Analyze this vendor response to our initial contact verification email.

Vendor Response:
---
{response_body}
---

Determine:
1. Did the vendor confirm they are the right person to discuss payment terms? (confirmed/rejected/redirected)
2. If redirected, is there a new contact name or email mentioned?
3. Overall sentiment (positive/neutral/negative)
4. Summary in one sentence

Return JSON:
{{
  "contact_status": "confirmed | rejected | redirected | unclear",
  "new_contact_name": null,
  "new_contact_email": null,
  "sentiment": "positive | neutral | negative",
  "summary": "..."
}}"""

PROPOSAL_ANALYSIS_PROMPT = """Analyze this vendor response to our payment terms proposal.

Our Proposal Summary:
{proposal_summary}

Vendor Response:
---
{response_body}
---

Current terms: std_terms={std_terms}%, term_days={term_days}, net_days={net_days}

Determine:
1. Did the vendor accept, reject, or counter-propose?
2. If counter-proposed, extract the specific terms (if mentioned)
3. Likelihood of reaching agreement (high/medium/low)
4. Recommended next action

Return JSON:
{{
  "response_type": "accepted | rejected | counter_offer | unclear | no_response",
  "counter_terms": {{
    "std_terms": null,
    "term_days": null,
    "net_days": null
  }},
  "agreement_likelihood": "high | medium | low",
  "recommended_action": "close_deal | send_counter | escalate | follow_up",
  "sentiment": "positive | neutral | negative",
  "key_points": ["..."],
  "summary": "..."
}}"""


async def _analyze(prompt: str) -> dict:
    """Send prompt to the response-analyzer agent via v2 Responses API."""
    project = get_foundry_project_client()
    openai = project.get_openai_client()
    conv = await openai.conversations.create()
    response = await openai.responses.create(
        conversation=conv.id,
        extra_body={"agent_reference": {"name": _ANALYZER_AGENT_NAME, "type": "agent_reference", "version": _analyzer_agent_version}},
        input=prompt,
    )
    text = _extract_text(response, _ANALYZER_AGENT_NAME)
    log.warning("[response_analyzer] extracted text (%d chars): %r", len(text), text[:300])
    return json.loads(text)


async def analyze_contact_reply(response_body: str) -> dict:
    prompt = CONTACT_ANALYSIS_PROMPT.format(response_body=response_body)
    return await _analyze(prompt)


async def analyze_proposal_reply(
    response_body: str,
    proposal_summary: str,
    std_terms: float,
    term_days: int,
    net_days: int,
) -> dict:
    prompt = PROPOSAL_ANALYSIS_PROMPT.format(
        response_body=response_body,
        proposal_summary=proposal_summary,
        std_terms=std_terms,
        term_days=term_days,
        net_days=net_days,
    )
    return await _analyze(prompt)
