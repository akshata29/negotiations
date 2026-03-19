"""
FastAPI application entry point for the Autonomous Negotiations Agent.
"""
from __future__ import annotations
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv(override=False)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from azure.ai.projects.models import PromptAgentDefinition

from app.config import get_settings
from app.services.cosmos import CosmosService
from app.services.rl import RLService
from app.agents import orchestrator
from app.agents.client import get_foundry_project_client
from app.agents.email_composer import PERSONA, _EMAIL_AGENT_NAME
from app.agents.email_composer import set_agent_version as set_email_agent_version
from app.agents.response_analyzer import ANALYZER_SYSTEM, _ANALYZER_AGENT_NAME
from app.agents.response_analyzer import set_agent_version as set_analyzer_agent_version
from app.api import vendors, negotiations, ab_testing
from app.api.ws import router as ws_router, manager as ws_manager
from app.background.tasks import start_background_tasks, stop_background_tasks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    log.info("Starting Autonomous Negotiations Agent API")
    db = CosmosService.get()
    await db.bootstrap()

    rl = RLService.get()
    await rl.load()

    # Bootstrap Foundry agents (create or update versions in Agent Service)
    project = get_foundry_project_client()
    for agent_name, instructions, set_version_fn in (
        (_EMAIL_AGENT_NAME, PERSONA + "\n\nOUTPUT RULES (mandatory):\n- Your entire response MUST be a single raw JSON object.\n- Do NOT wrap output in markdown code fences (no ```json or ```).\n- Do NOT include any prose, explanation, or text outside the JSON object.\n- The very first character of your response must be '{' and the last must be '}'.", set_email_agent_version),
        (_ANALYZER_AGENT_NAME, ANALYZER_SYSTEM, set_analyzer_agent_version),
    ):
        agent = await project.agents.create_version(
            agent_name=agent_name,
            definition=PromptAgentDefinition(
                model=settings.FOUNDRY_MODEL_DEPLOYMENT_NAME,
                instructions=instructions,
            ),
        )
        set_version_fn(str(agent.version))
        log.info("Foundry agent bootstrapped: %s — version %s (id=%s)", agent.name, agent.version, agent.id)

    # Wire broadcast into orchestrator
    orchestrator.set_broadcast(ws_manager.broadcast)

    await start_background_tasks()
    log.info("API ready on port %d", settings.BACKEND_PORT)
    yield
    # ── Shutdown ──
    await stop_background_tasks()
    await db.close()
    await project.close()
    log.info("Shutdown complete")


app = FastAPI(
    title="Autonomous Vendor Negotiations Agent",
    version="1.0.0",
    description="AI-powered vendor payment terms negotiation with A/B testing and reinforcement learning",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(vendors.router)
app.include_router(negotiations.router)
app.include_router(ab_testing.router)
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/dashboard/stats")
async def dashboard_stats():
    db = CosmosService.get()
    rl = RLService.get()
    counts = await db.count_vendors()
    rl_stats, best_group = rl.get_stats()
    pending = await db.get_negotiations_pending_approval()
    recent_negs = await db.list_negotiations(limit=5)
    return {
        "vendor_counts": counts,
        "rl_stats": rl_stats,
        "best_ab_group": best_group,
        "pending_approvals": len(pending),
        "recent_negotiations": recent_negs,
    }
