"""
Reinforcement Learning service — UCB1 multi-armed bandit for AB group selection.
Arms:
    A — cash discount improvement only
    B — term days / net days extension only
    C — both cash discount + term days extension
"""
from __future__ import annotations
import math
import logging
from datetime import datetime
from typing import Optional

from app.models.negotiation import ABGroup, RLArmState, STRATEGY_DESCRIPTIONS
from app.services.cosmos import CosmosService

log = logging.getLogger(__name__)

EXPLORATION_CONSTANT = 2.0      # c in UCB1


def _ucb1(q: float, n_total: int, n_arm: int) -> float:
    if n_arm == 0:
        return float("inf")   # always explore unvisited arms
    return q + EXPLORATION_CONSTANT * math.sqrt(math.log(max(n_total, 1)) / n_arm)


class RLService:
    """UCB1 bandit tracking AB group performance."""

    _instance: Optional["RLService"] = None

    def __init__(self):
        self._arms: dict[str, RLArmState] = {
            ABGroup.A: RLArmState(id=f"arm_{ABGroup.A}", group=ABGroup.A, strategy=STRATEGY_DESCRIPTIONS[ABGroup.A]),
            ABGroup.B: RLArmState(id=f"arm_{ABGroup.B}", group=ABGroup.B, strategy=STRATEGY_DESCRIPTIONS[ABGroup.B]),
            ABGroup.C: RLArmState(id=f"arm_{ABGroup.C}", group=ABGroup.C, strategy=STRATEGY_DESCRIPTIONS[ABGroup.C]),
        }
        self._total = 0
        self._loaded = False

    @classmethod
    def get(cls) -> "RLService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ── Persistence ───────────────────────────────────────────────────────

    async def load(self):
        """Load arm states from Cosmos DB."""
        db = CosmosService.get()
        rows = await db.get_rl_state()
        for row in rows:
            gid = row.get("group")
            if gid in self._arms:
                self._arms[gid] = RLArmState(**{k: v for k, v in row.items() if k != "_rid" and not k.startswith("_")})
        total = sum(a.total_trials for a in self._arms.values())
        self._total = total
        self._loaded = True
        log.info("RL state loaded: %s total trials", total)

    async def save(self):
        db = CosmosService.get()
        for arm in self._arms.values():
            arm.updated_at = datetime.utcnow().isoformat()
            # ucb1_score is ephemeral/computed and defaults to float("inf") which is not
            # valid JSON — exclude it; it will be recalculated on next select_group() call
            await db.upsert_rl(arm.model_dump(exclude={"ucb1_score"}))

    # ── UCB1 selection ────────────────────────────────────────────────────

    def select_group(self) -> ABGroup:
        """Select the next AB group using UCB1."""
        best_group = None
        best_score = -1.0
        for group, arm in self._arms.items():
            score = _ucb1(arm.q_value, self._total, arm.total_trials)
            arm.ucb1_score = score
            if score > best_score:
                best_score = score
                best_group = group
        return best_group or ABGroup.C

    # ── Reward update ─────────────────────────────────────────────────────

    async def record_outcome(self, group: ABGroup, reward: float):
        """
        Update Q-value using incremental mean:
            Q(a) ← Q(a) + (1/N(a)) * (reward - Q(a))

        reward scale:
            0.0 = no improvement / rejected on first offer
            0.5 = partial improvement or accepted after multiple rounds
            1.0 = full improvement accepted
            1.5 = accepted on first proposal (efficiency bonus)
        """
        arm = self._arms[group]
        arm.total_trials += 1
        arm.total_reward += reward
        arm.last_reward = reward
        if reward > 0:
            arm.successes += 1
        # Incremental mean update
        arm.q_value += (1.0 / arm.total_trials) * (reward - arm.q_value)
        arm.ucb1_score = _ucb1(arm.q_value, self._total + 1, arm.total_trials)

        self._total += 1
        await self.save()
        log.info("RL update group=%s reward=%.2f new_q=%.4f", group, reward, arm.q_value)

    # ── Stats ─────────────────────────────────────────────────────────────

    def get_stats(self) -> list[dict]:
        stats = []
        for group, arm in self._arms.items():
            success_rate = arm.successes / arm.total_trials if arm.total_trials > 0 else 0.0
            avg_reward = arm.total_reward / arm.total_trials if arm.total_trials > 0 else 0.0
            stats.append(
                {
                    "group": group,
                    "strategy": arm.strategy,
                    "total_trials": arm.total_trials,
                    "successes": arm.successes,
                    "success_rate": round(success_rate, 4),
                    "avg_reward": round(avg_reward, 4),
                    "q_value": round(arm.q_value, 4),
                    "ucb1_score": round(arm.ucb1_score, 4) if arm.ucb1_score != float("inf") else 9999.0,
                }
            )
        # Add recommended group
        best = max(self._arms.items(), key=lambda kv: kv[1].q_value if kv[1].total_trials > 0 else -1)
        return stats, best[0]

    def compute_reward(
        self,
        group: ABGroup,
        original_terms: dict,
        agreed_terms: dict,
        rounds: int,
    ) -> float:
        """Compute reward based on improvement vs original terms."""
        improvements = 0
        max_improvements = 0

        if group in (ABGroup.A, ABGroup.C):
            max_improvements += 1
            orig_discount = original_terms.get("std_terms", 0)
            new_discount = agreed_terms.get("std_terms", orig_discount)
            if new_discount >= 2.0 and new_discount > orig_discount:
                improvements += 1
            elif new_discount > orig_discount:
                improvements += 0.5

        if group in (ABGroup.B, ABGroup.C):
            max_improvements += 2
            orig_td = original_terms.get("term_days", 0)
            new_td = agreed_terms.get("term_days", orig_td)
            if new_td >= orig_td + 10:
                improvements += 1
            elif new_td > orig_td:
                improvements += 0.5

            orig_nd = original_terms.get("net_days", 30)
            new_nd = agreed_terms.get("net_days", orig_nd)
            if new_nd >= orig_nd + 10:
                improvements += 1
            elif new_nd > orig_nd:
                improvements += 0.5

        if max_improvements == 0:
            return 0.0

        base_reward = improvements / max_improvements
        # Efficiency bonus: first round acceptance
        if rounds == 1 and base_reward >= 1.0:
            base_reward = min(1.5, base_reward * 1.5)

        return round(base_reward, 3)
