from fastapi import APIRouter
from app.services.rl import RLService

router = APIRouter(prefix="/api/ab-testing", tags=["ab-testing"])


@router.get("/stats")
async def get_stats():
    rl = RLService.get()
    stats, best_group = rl.get_stats()
    return {"stats": stats, "recommended_group": best_group, "total_trials": sum(s["total_trials"] for s in stats)}


@router.get("/simulate")
async def simulate_selection(n: int = 10):
    """Simulate N group selections to show UCB1 behavior."""
    rl = RLService.get()
    selections = []
    for _ in range(n):
        group = rl.select_group()
        selections.append(group)
    from collections import Counter
    counts = Counter(selections)
    return {"selections": selections, "distribution": dict(counts)}
