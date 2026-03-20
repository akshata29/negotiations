"""
Pydantic models for user-configurable agent settings (model, system prompts, personality).
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel

# ── Personality presets ───────────────────────────────────────────────────────

PERSONALITY_PRESETS: dict[str, dict] = {
    "collaborative": {
        "id": "collaborative",
        "label": "Collaborative & Friendly",
        "description": "Win-win, relationship-first, respectful and cooperative with vendors",
        "tone_detail": (
            "Your tone is warm, respectful, and genuinely collaborative. "
            "You frame every negotiation as a partnership — seeking outcomes that benefit both companies. "
            "You acknowledge vendor constraints, express appreciation for the relationship, "
            "and emphasize mutual benefit in every ask."
        ),
    },
    "firm": {
        "id": "firm",
        "label": "Firm & Professional",
        "description": "Results-focused, holds firm on targets while remaining professional",
        "tone_detail": (
            "Your tone is firm, professional, and results-driven. "
            "You represent the company's financial interests clearly and confidently. "
            "You hold firm on negotiation targets while maintaining courtesy. "
            "Concessions, when made, are deliberate and tied to reciprocal movement from the vendor."
        ),
    },
    "assertive": {
        "id": "assertive",
        "label": "Assertive & Direct",
        "description": "Confident, concise, cuts to the point without padding",
        "tone_detail": (
            "Your tone is assertive and direct. "
            "Emails are concise — you state the ask clearly, provide a brief rationale, "
            "and make the desired outcome unambiguous. "
            "You avoid filler phrases and get straight to the point, respecting the vendor's time."
        ),
    },
    "diplomatic": {
        "id": "diplomatic",
        "label": "Diplomatic & Patient",
        "description": "Relationship-first, empathetic, patient long-term approach",
        "tone_detail": (
            "Your tone is diplomatic, empathetic, and patient. "
            "You prioritize the long-term vendor relationship, demonstrate genuine empathy for their "
            "business constraints, and signal flexibility to keep dialogue open. "
            "You move gradually toward targets rather than making aggressive first moves."
        ),
    },
    "data_driven": {
        "id": "data_driven",
        "label": "Data-Driven & Analytical",
        "description": "Backs every ask with benchmarks, metrics, and structured analysis",
        "tone_detail": (
            "Your tone is analytical and data-driven. "
            "You ground every request in data — referencing working capital metrics, "
            "industry benchmarks, and cashflow analysis. "
            "Your emails present the business case quantitatively, "
            "making it straightforward for vendors to evaluate the proposal objectively."
        ),
    },
}


def build_email_system_prompt(
    merch_name: str,
    merch_title: str,
    merch_company: str,
    merch_phone: str,
    merch_email: str,
    tone_detail: str,
    output_rules: str = "",
) -> str:
    """Build the full email composer system prompt (persona + tone + mandatory output rules)."""
    persona = (
        f"You are {merch_name}, {merch_title} at {merch_company}.\n"
        f"You write professional, concise, and business-like emails on behalf of "
        f"{merch_company}'s procurement and merchandising team.\n"
        f"{tone_detail}\n"
        f"Always sign off as:\n"
        f"{merch_name}\n"
        f"{merch_title}\n"
        f"{merch_company}\n"
        f"{merch_phone}\n"
        f"{merch_email}"
    )
    if output_rules:
        return persona + "\n\n" + output_rules
    return persona


# ── Pydantic models ───────────────────────────────────────────────────────────

class AgentSettings(BaseModel):
    id: str = "global"
    model_deployment_name: str = "chat4o"
    email_system_prompt: str = ""
    analyzer_system_prompt: str = ""
    personality: str = "collaborative"
    updated_at: str = ""


class AgentSettingsUpdate(BaseModel):
    model_deployment_name: Optional[str] = None
    email_system_prompt: Optional[str] = None
    analyzer_system_prompt: Optional[str] = None
    personality: Optional[str] = None
