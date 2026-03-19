"""
Background tasks:
- Cosmos DB change feed polling (every 60s) to auto-start negotiations for new eligible vendors
- Recovery of negotiations stuck at CONTACT_DRAFTING (no email drafted yet)
- Periodic RL state refresh
"""
from __future__ import annotations
import asyncio
import logging

from app.services.cosmos import CosmosService
from app.services.rl import RLService
from app.agents import orchestrator
from app.models.negotiation import NegotiationInDB, NegotiationStage
from app.models.vendor import NegotiationStatus

log = logging.getLogger(__name__)

_running = False


async def start_background_tasks():
    global _running
    _running = True
    asyncio.create_task(_change_feed_poller())
    log.info("Background tasks started")


async def stop_background_tasks():
    global _running
    _running = False


async def _change_feed_poller():
    """
    Polls Cosmos DB every 60s for:
    1. Newly eligible vendors that don't yet have a negotiation → start_negotiation
    2. Negotiations stuck at CONTACT_DRAFTING with no email → retry drafting
    """
    await asyncio.sleep(30)  # initial delay to let startup finish
    while _running:
        try:
            db = CosmosService.get()

            # ── 1. Start new negotiations for eligible vendors ──────────────
            candidates = await db.query(
                "vendors",
                "/vendor_id",
                """SELECT * FROM c
                   WHERE c.eligible_for_negotiation = true
                   AND c.negotiation_status = 'eligible'
                   AND (NOT IS_DEFINED(c.active_negotiation_id) OR c.active_negotiation_id = null)
                   OFFSET 0 LIMIT 5""",
            )
            for vendor in candidates:
                vid = int(vendor.get("vendor_id", 0))
                if vid:
                    log.info("Auto-starting negotiation for vendor %d", vid)
                    try:
                        await orchestrator.start_negotiation(vid)
                    except Exception as exc:
                        log.warning("Auto-start failed for vendor %d: %s", vid, exc)

            # ── 2. Recover negotiations stuck at CONTACT_DRAFTING ───────────
            stuck = await db.query(
                "negotiations",
                "/vendor_id",
                """SELECT * FROM c
                   WHERE c.stage = 'contact_drafting'
                   OFFSET 0 LIMIT 10""",
            )
            for neg_data in stuck:
                neg_id = neg_data.get("id")
                vendor_email = neg_data.get("vendor_email") or "vendor@example.com"
                log.info("Recovering stuck negotiation %s — retrying contact draft", neg_id)
                try:
                    neg = NegotiationInDB(**{k: v for k, v in neg_data.items() if not k.startswith("_")})
                    await orchestrator.advance_to_contact_draft(neg, vendor_email)
                except Exception as exc:
                    log.warning("Recovery draft failed for negotiation %s: %s", neg_id, exc)

        except Exception as exc:
            log.warning("Change feed poll error: %s", exc)
        await asyncio.sleep(60)
