"""
Settings API — user-configurable agent settings (model deployment, system prompts, personality).
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.config import get_settings as get_env_settings
from app.models.agent_settings import (
    AgentSettings,
    AgentSettingsUpdate,
    PERSONALITY_PRESETS,
    build_email_system_prompt,
)
from app.services.cosmos import CosmosService

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


async def _get_or_defaults() -> dict:
    """Return stored settings document, or a freshly-built defaults doc if none is saved yet."""
    db = CosmosService.get()
    stored = await db.get_agent_settings()
    if stored:
        return stored

    # Build defaults from env + collaborative personality
    env = get_env_settings()
    from app.agents.email_composer import PERSONA, EMAIL_OUTPUT_RULES
    from app.agents.response_analyzer import ANALYZER_SYSTEM

    return {
        "id": "global",
        "model_deployment_name": env.FOUNDRY_MODEL_DEPLOYMENT_NAME,
        "email_system_prompt": PERSONA + "\n\n" + EMAIL_OUTPUT_RULES,
        "analyzer_system_prompt": ANALYZER_SYSTEM,
        "personality": "collaborative",
        "updated_at": "",
    }


@router.get("")
async def get_settings():
    return await _get_or_defaults()


@router.put("")
async def update_settings(body: AgentSettingsUpdate):
    db = CosmosService.get()
    current = await _get_or_defaults()
    updates = body.model_dump(exclude_none=True)
    updated = {
        **current,
        **updates,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.upsert_agent_settings(updated)
    return updated


@router.post("/apply")
async def apply_settings_to_agents():
    """Re-bootstrap Foundry agents with the currently stored settings."""
    from app.agents.client import get_foundry_project_client
    from app.agents.email_composer import (
        set_agent_version as set_email_v,
        _EMAIL_AGENT_NAME,
    )
    from app.agents.response_analyzer import (
        set_agent_version as set_analyzer_v,
        _ANALYZER_AGENT_NAME,
    )
    from azure.ai.projects.models import PromptAgentDefinition

    stored = await _get_or_defaults()
    model = stored["model_deployment_name"]
    # email_system_prompt already contains the full prompt (PERSONA + OUTPUT RULES)
    email_instructions = stored["email_system_prompt"]
    analyzer_instructions = stored["analyzer_system_prompt"]

    project = get_foundry_project_client()
    results = []
    try:
        for agent_name, instructions, set_version_fn in (
            (_EMAIL_AGENT_NAME, email_instructions, set_email_v),
            (_ANALYZER_AGENT_NAME, analyzer_instructions, set_analyzer_v),
        ):
            agent = await project.agents.create_version(
                agent_name=agent_name,
                definition=PromptAgentDefinition(
                    model=model,
                    instructions=instructions,
                ),
            )
            set_version_fn(str(agent.version))
            results.append({"agent": agent_name, "version": str(agent.version)})
            log.info(
                "Foundry agent re-bootstrapped via settings: %s v%s",
                agent_name,
                agent.version,
            )
    except Exception as exc:
        log.error("Failed to re-bootstrap agents: %s", exc)
        raise HTTPException(status_code=502, detail=f"Foundry agent re-bootstrap failed: {exc}")

    return {"status": "applied", "model": model, "agents": results}


@router.get("/personality-presets")
async def get_personality_presets():
    """Return all personality presets with fully-rendered system prompts for the current persona."""
    env = get_env_settings()
    from app.agents.email_composer import EMAIL_OUTPUT_RULES
    presets_with_prompts = []
    for preset in PERSONALITY_PRESETS.values():
        generated_prompt = build_email_system_prompt(
            merch_name=env.MERCH_LEADER_NAME,
            merch_title=env.MERCH_LEADER_TITLE,
            merch_company=env.MERCH_LEADER_COMPANY,
            merch_phone=env.MERCH_LEADER_PHONE,
            merch_email=env.MERCH_LEADER_EMAIL,
            tone_detail=preset["tone_detail"],
            output_rules=EMAIL_OUTPUT_RULES,
        )
        presets_with_prompts.append(
            {
                "id": preset["id"],
                "label": preset["label"],
                "description": preset["description"],
                "generated_prompt": generated_prompt,
            }
        )
    return {"presets": presets_with_prompts}


@router.get("/available-models")
async def get_available_models():
    """Fetch actual deployment names from Azure OpenAI, falling back to env config name."""
    env = get_env_settings()
    current = env.FOUNDRY_MODEL_DEPLOYMENT_NAME
    try:
        from openai import AsyncAzureOpenAI
        async with AsyncAzureOpenAI(
            azure_endpoint=env.AZURE_OPENAI_ENDPOINT,
            api_key=env.AZURE_OPENAI_API_KEY,
            api_version=env.AZURE_OPENAI_API_VERSION,
        ) as oai:
            response = await oai.models.list()
        # Filter to chat-capable deployments (exclude embeddings, rerank, etc.)
        _SKIP_PREFIXES = ("text-embedding", "embed", "cohere", "whisper", "dall-e", "tts")
        models = []
        for m in response.data:
            name = m.id
            if not any(name.lower().startswith(p) for p in _SKIP_PREFIXES):
                models.append({"id": name, "label": name})
        if not models:
            raise ValueError("empty after filtering")
        # Sort: current deployment first, then alphabetically
        models.sort(key=lambda m: (0 if m["id"] == current else 1, m["id"]))
        return {"models": models, "current": current}
    except Exception as exc:
        log.warning("Could not list Azure OpenAI deployments: %s — returning env config only", exc)
        return {"models": [{"id": current, "label": current}], "current": current}


@router.get("/defaults")
async def get_defaults():
    """Return factory-default settings (does not affect stored settings)."""
    env = get_env_settings()
    from app.agents.email_composer import PERSONA, EMAIL_OUTPUT_RULES
    from app.agents.response_analyzer import ANALYZER_SYSTEM

    return {
        "id": "global",
        "model_deployment_name": env.FOUNDRY_MODEL_DEPLOYMENT_NAME,
        "email_system_prompt": PERSONA + "\n\n" + EMAIL_OUTPUT_RULES,
        "analyzer_system_prompt": ANALYZER_SYSTEM,
        "personality": "collaborative",
        "updated_at": "",
    }


@router.get("/persona")
async def get_persona_info():
    """Return the current persona configuration (from .env, read-only)."""
    env = get_env_settings()
    return {
        "name": env.MERCH_LEADER_NAME,
        "title": env.MERCH_LEADER_TITLE,
        "company": env.MERCH_LEADER_COMPANY,
        "phone": env.MERCH_LEADER_PHONE,
        "email": env.MERCH_LEADER_EMAIL,
    }
