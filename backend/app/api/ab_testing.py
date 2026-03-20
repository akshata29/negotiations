from fastapi import APIRouter
from app.services.rl import RLService
from app.services.cosmos import CosmosService

router = APIRouter(prefix="/api/ab-testing", tags=["ab-testing"])


@router.get("/stats")
async def get_stats():
    rl = RLService.get()
    stats, best_group = rl.get_stats()
    return {"stats": stats, "recommended_group": best_group, "total_trials": sum(s["total_trials"] for s in stats)}


@router.get("/group-metrics")
async def get_group_metrics():
    """Per-group outcome breakdown from actual negotiations (agreed/rejected/avg rounds/etc.)."""
    db = CosmosService.get()
    metrics = await db.get_ab_group_metrics()
    return {"metrics": metrics}


@router.get("/simulate")
async def simulate_selection(n: int = 20):
    """Simulate N group selections to show UCB1 behavior (uses current Q-values + trial counts)."""
    rl = RLService.get()
    selections = []
    for _ in range(n):
        group = rl.select_group()
        selections.append(group)
    from collections import Counter
    counts = Counter(selections)
    total = len(selections)
    distribution = {
        grp: {"count": counts.get(grp, 0), "pct": round(counts.get(grp, 0) / total * 100, 1)}
        for grp in ("A", "B", "C")
    }
    return {"n": n, "selections": selections, "distribution": distribution}
