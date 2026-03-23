from fastapi import APIRouter, HTTPException, Query
from app.agents import orchestrator
from app.models.negotiation import (
    ApproveEmailRequest,
    StartNegotiationRequest,
    VendorReplyRequest,
)
from app.services.cosmos import CosmosService
from app.services.simulation import run_simulation, list_scenarios

router = APIRouter(prefix="/api/negotiations", tags=["negotiations"])


@router.get("")
async def list_negotiations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    stage: str = Query(None),
):
    db = CosmosService.get()
    items = await db.list_negotiations(limit=limit, offset=offset, stage_filter=stage)
    return {"negotiations": items, "total": len(items)}


@router.get("/pending-approval")
async def get_pending_approvals():
    db = CosmosService.get()
    items = await db.get_negotiations_pending_approval()
    return {"negotiations": items, "total": len(items)}


@router.get("/{negotiation_id}")
async def get_negotiation(negotiation_id: str):
    db = CosmosService.get()
    neg = await db.get_negotiation(negotiation_id)
    if not neg:
        raise HTTPException(status_code=404, detail="Negotiation not found")
    emails = await db.list_emails(negotiation_id)
    return {**neg, "emails": emails}


@router.get("/{negotiation_id}/emails")
async def get_emails(negotiation_id: str):
    db = CosmosService.get()
    emails = await db.list_emails(negotiation_id)
    return {"emails": emails}


@router.post("")
async def start_negotiation(req: StartNegotiationRequest):
    try:
        neg = await orchestrator.start_negotiation(
            vendor_id=req.vendor_id,
            override_ab_group=req.override_ab_group,
        )
        return neg.model_dump()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{negotiation_id}/approve")
async def approve_email(negotiation_id: str, req: ApproveEmailRequest):
    try:
        neg = await orchestrator.approve_email(
            negotiation_id=negotiation_id,
            approved_by=req.approved_by,
            edited_body=req.edited_body,
        )
        return neg.model_dump()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{negotiation_id}/respond")
async def submit_vendor_reply(negotiation_id: str, req: VendorReplyRequest):
    try:
        result = await orchestrator.submit_vendor_reply(
            negotiation_id=negotiation_id,
            body=req.body,
            sender_name=req.sender_name,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{negotiation_id}/escalate")
async def escalate(negotiation_id: str, notes: str = ""):
    try:
        neg = await orchestrator.escalate_negotiation(negotiation_id, notes)
        return neg.model_dump()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/simulate/scenarios")
async def get_scenarios():
    """List available simulation scenarios."""
    return {"scenarios": list_scenarios()}


@router.post("/{negotiation_id}/simulate")
async def simulate_negotiation(
    negotiation_id: str,
    scenario: str = Query(None, description="Scenario ID: quick_win | friendly_counter | tough_negotiation | rejection | wrong_contact — omit to resume a paused simulation"),
):
    """
    Start or resume a simulation scenario.

    • Pass ``scenario`` to start a new simulation.
    • Omit ``scenario`` to resume a simulation that was paused at an approval gate.

    Responds with ``status="paused_for_approval"`` when a gate is active, or
    ``status="completed"`` when the simulation runs to its terminal stage.
    """
    try:
        result = await run_simulation(negotiation_id, scenario)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{negotiation_id}/simulate/resume")
async def resume_simulation(negotiation_id: str):
    """Convenience alias for POST /simulate without a scenario (resume after approval)."""
    try:
        result = await run_simulation(negotiation_id, None)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
