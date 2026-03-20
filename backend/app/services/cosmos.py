"""
Azure Cosmos DB async service for the negotiations app.
All containers are created lazily on first use.
"""
from __future__ import annotations
import logging
from typing import Any, Optional

from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey, exceptions as cosmos_exc
from azure.identity.aio import ClientSecretCredential

from app.config import get_settings
from app.models.rule_template import ALLOWED_VENDOR_FIELDS, ALLOWED_OPERATORS

log = logging.getLogger(__name__)
settings = get_settings()

_OPERATOR_SQL = {
    "eq": "=",
    "ne": "!=",
    "gt": ">",
    "gte": ">=",
    "lt": "<",
    "lte": "<=",
}


def _build_template_where(conditions: list[dict], conjunction: str) -> tuple[str, list[dict]]:
    """Translate validated rule conditions into a Cosmos SQL WHERE clause + params.

    Field names and operators are checked against allowlists to prevent injection.
    Returns (where_clause_string, params_list) — where_clause may be empty string
    if conditions list is empty.
    """
    parts: list[str] = []
    params: list[dict] = []

    for i, cond in enumerate(conditions):
        field = cond["field"]
        op = cond["operator"]
        val = cond["value"]

        # Security: validate field + operator against allowlists
        if field not in ALLOWED_VENDOR_FIELDS:
            log.warning("Skipping unknown field in template condition: %s", field)
            continue
        if op not in ALLOWED_OPERATORS:
            log.warning("Skipping unknown operator in template condition: %s", op)
            continue

        if op in _OPERATOR_SQL:
            param_name = f"@p{i}"
            parts.append(f"c.{field} {_OPERATOR_SQL[op]} {param_name}")
            params.append({"name": param_name, "value": val})
        elif op == "in":
            values = val if isinstance(val, list) else [val]
            sub_parts = []
            for j, v in enumerate(values):
                pn = f"@p{i}_{j}"
                sub_parts.append(f"c.{field} = {pn}")
                params.append({"name": pn, "value": v})
            parts.append(f"({' OR '.join(sub_parts)})")
        elif op == "not_in":
            values = val if isinstance(val, list) else [val]
            sub_parts = []
            for j, v in enumerate(values):
                pn = f"@p{i}_{j}"
                sub_parts.append(f"c.{field} != {pn}")
                params.append({"name": pn, "value": v})
            parts.append(f"({' AND '.join(sub_parts)})")

    joiner = " AND " if conjunction == "AND" else " OR "
    return joiner.join(parts), params


class CosmosService:
    _instance: Optional["CosmosService"] = None

    def __init__(self):
        self._credential = ClientSecretCredential(
            tenant_id=settings.AZURE_TENANT_ID,
            client_id=settings.AZURE_CLIENT_ID,
            client_secret=settings.AZURE_CLIENT_SECRET,
        )
        self._client = CosmosClient(
            url=settings.COSMOSDB_ENDPOINT,
            credential=self._credential,
        )
        self._db = None
        self._containers: dict[str, Any] = {}

    # ── Singleton ─────────────────────────────────────────────────────────

    @classmethod
    def get(cls) -> "CosmosService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ── Bootstrap ─────────────────────────────────────────────────────────

    async def ensure_db(self):
        if self._db is None:
            self._db = await self._client.create_database_if_not_exists(
                id=settings.NEGOTIATIONS_DB
            )

    async def ensure_container(self, name: str, partition_key: str) -> Any:
        if name not in self._containers:
            await self.ensure_db()
            container = await self._db.create_container_if_not_exists(
                id=name,
                partition_key=PartitionKey(path=partition_key),
            )
            self._containers[name] = container
        return self._containers[name]

    async def bootstrap(self):
        """Create all required containers on startup."""
        await self.ensure_container(settings.NEGOTIATIONS_VENDORS_CONTAINER, "/vendor_id")
        await self.ensure_container(settings.NEGOTIATIONS_CONTAINER, "/vendor_id")
        await self.ensure_container(settings.NEGOTIATIONS_EMAILS_CONTAINER, "/negotiation_id")
        await self.ensure_container(settings.NEGOTIATIONS_RL_CONTAINER, "/id")
        await self.ensure_container(settings.NEGOTIATIONS_RULE_TEMPLATES_CONTAINER, "/id")
        await self.ensure_container(settings.NEGOTIATIONS_SETTINGS_CONTAINER, "/id")
        log.info("Cosmos DB bootstrap complete")

    # ── Agent settings helpers ──────────────────────────────────────────────

    async def get_agent_settings(self) -> Optional[dict]:
        result = await self.query(
            settings.NEGOTIATIONS_SETTINGS_CONTAINER,
            "/id",
            "SELECT * FROM c WHERE c.id = 'global'",
        )
        return result[0] if result else None

    async def upsert_agent_settings(self, doc: dict) -> dict:
        return await self.upsert(
            settings.NEGOTIATIONS_SETTINGS_CONTAINER, "/id", doc
        )

    async def seed_default_settings(self, default_doc: dict) -> None:
        """Seeds default agent settings doc on first startup (idempotent)."""
        existing = await self.get_agent_settings()
        if not existing:
            await self.upsert_agent_settings(default_doc)
            log.info("Default agent settings seeded")

    async def seed_default_templates(self):
        """Upsert the built-in eligibility preset (idempotent — keyed by fixed ID)."""
        DEFAULT_ID = "00000000-0000-0000-0000-000000000001"
        now = "2026-01-01T00:00:00"
        default_template = {
            "id": DEFAULT_ID,
            "name": "Default Eligibility",
            "description": "Comp=MPN, Catg\u2209FRS/TOB/SEA, Status=ACT, YTD>$0",
            "conditions": [
                {"field": "comp",                  "operator": "eq",      "value": "MPN"},
                {"field": "catg",                  "operator": "not_in",  "value": ["FRS", "TOB", "SEA"]},
                {"field": "status",                "operator": "eq",      "value": "ACT"},
                {"field": "ytd_purchase_amount",    "operator": "gt",      "value": 0},
            ],
            "conjunction": "AND",
            "created_at": now,
            "updated_at": now,
        }
        await self.upsert_rule_template(default_template)
        log.info("Default eligibility rule template seeded (id=%s)", DEFAULT_ID)

    async def close(self):
        await self._credential.close()
        await self._client.close()

    # ── Generic CRUD ──────────────────────────────────────────────────────

    async def upsert(self, container_name: str, partition_key: str, document: dict) -> dict:
        container = await self.ensure_container(container_name, partition_key)
        return await container.upsert_item(document)

    async def get_doc(self, container_name: str, partition_key: str, doc_id: str, pk_value: Any) -> Optional[dict]:
        container = await self.ensure_container(container_name, partition_key)
        try:
            return await container.read_item(item=doc_id, partition_key=str(pk_value))
        except cosmos_exc.CosmosResourceNotFoundError:
            return None

    async def query(self, container_name: str, partition_key: str, query: str, params: Optional[list] = None) -> list[dict]:
        container = await self.ensure_container(container_name, partition_key)
        items = container.query_items(
            query=query,
            parameters=params or [],
        )
        return [item async for item in items]

    async def delete(self, container_name: str, partition_key: str, doc_id: str, pk_value: Any) -> bool:
        container = await self.ensure_container(container_name, partition_key)
        try:
            await container.delete_item(item=doc_id, partition_key=str(pk_value))
            return True
        except cosmos_exc.CosmosResourceNotFoundError:
            return False

    # ── Vendor helpers ────────────────────────────────────────────────────

    async def upsert_vendor(self, vendor: dict) -> dict:
        return await self.upsert(
            settings.NEGOTIATIONS_VENDORS_CONTAINER, "/vendor_id", vendor
        )

    async def get_vendor(self, vendor_id: int) -> Optional[dict]:
        # vendor_id is stored as string (Cosmos partition key)
        results = await self.query(
            settings.NEGOTIATIONS_VENDORS_CONTAINER,
            "/vendor_id",
            "SELECT * FROM c WHERE c.vendor_id = @vid",
            [{"name": "@vid", "value": str(vendor_id)}],
        )
        return results[0] if results else None

    async def list_vendors(
        self,
        eligible_only: bool = False,
        limit: int = 500,
        offset: int = 0,
        template_id: Optional[str] = None,
    ) -> list[dict]:
        extra_where = ""
        extra_params: list[dict] = []

        if template_id:
            template = await self.get_rule_template(template_id)
            if template:
                where_clause, extra_params = _build_template_where(
                    template.get("conditions", []),
                    template.get("conjunction", "AND"),
                )
                if where_clause:
                    extra_where = where_clause

        if extra_where:
            q = f"SELECT * FROM c WHERE {extra_where} ORDER BY c.ytd_purchase_amount DESC OFFSET @off LIMIT @lim"
        elif eligible_only:
            q = "SELECT * FROM c WHERE c.eligible_for_negotiation = true ORDER BY c.ytd_purchase_amount DESC OFFSET @off LIMIT @lim"
        else:
            q = "SELECT * FROM c ORDER BY c.ytd_purchase_amount DESC OFFSET @off LIMIT @lim"

        params = extra_params + [{"name": "@off", "value": offset}, {"name": "@lim", "value": limit}]
        return await self.query(
            settings.NEGOTIATIONS_VENDORS_CONTAINER,
            "/vendor_id",
            q,
            params,
        )

    async def count_vendors(self) -> dict:
        result = await self.query(
            settings.NEGOTIATIONS_VENDORS_CONTAINER,
            "/vendor_id",
            "SELECT VALUE COUNT(1) FROM c",
        )
        total = result[0] if result else 0
        result_elig = await self.query(
            settings.NEGOTIATIONS_VENDORS_CONTAINER,
            "/vendor_id",
            "SELECT VALUE COUNT(1) FROM c WHERE c.eligible_for_negotiation = true",
        )
        eligible = result_elig[0] if result_elig else 0
        result_inprog = await self.query(
            settings.NEGOTIATIONS_VENDORS_CONTAINER,
            "/vendor_id",
            "SELECT VALUE COUNT(1) FROM c WHERE c.negotiation_status = 'in_progress'",
        )
        in_progress = result_inprog[0] if result_inprog else 0
        result_done = await self.query(
            settings.NEGOTIATIONS_VENDORS_CONTAINER,
            "/vendor_id",
            "SELECT VALUE COUNT(1) FROM c WHERE c.negotiation_status IN ('agreed', 'completed')",
        )
        completed = result_done[0] if result_done else 0
        return {"total": total, "eligible": eligible, "in_progress": in_progress, "completed": completed}

    # ── Rule template helpers ─────────────────────────────────────────────

    async def list_rule_templates(self) -> list[dict]:
        return await self.query(
            settings.NEGOTIATIONS_RULE_TEMPLATES_CONTAINER,
            "/id",
            "SELECT * FROM c ORDER BY c.created_at DESC",
        )

    async def get_rule_template(self, template_id: str) -> Optional[dict]:
        results = await self.query(
            settings.NEGOTIATIONS_RULE_TEMPLATES_CONTAINER,
            "/id",
            "SELECT * FROM c WHERE c.id = @tid",
            [{"name": "@tid", "value": template_id}],
        )
        return results[0] if results else None

    async def upsert_rule_template(self, template: dict) -> dict:
        return await self.upsert(
            settings.NEGOTIATIONS_RULE_TEMPLATES_CONTAINER, "/id", template
        )

    async def delete_rule_template(self, template_id: str) -> bool:
        return await self.delete(
            settings.NEGOTIATIONS_RULE_TEMPLATES_CONTAINER, "/id", template_id, template_id
        )

    # ── Negotiation helpers ───────────────────────────────────────────────

    async def get_negotiation_analytics(self) -> dict:
        """Aggregate metrics for the dashboard analytics section."""
        cn = settings.NEGOTIATIONS_CONTAINER
        pk = "/vendor_id"

        # Run all counts concurrently via coroutines gathered together
        import asyncio
        (
            agreed_r, rejected_r, escalated_r,
            contact_r, proposal_r, counter_r,
            avg_rounds_r, avg_imp_r,
        ) = await asyncio.gather(
            self.query(cn, pk, "SELECT VALUE COUNT(1) FROM c WHERE c.stage IN ('agreed','completed')"),
            self.query(cn, pk, "SELECT VALUE COUNT(1) FROM c WHERE c.stage = 'rejected'"),
            self.query(cn, pk, "SELECT VALUE COUNT(1) FROM c WHERE c.stage = 'escalated'"),
            self.query(cn, pk, "SELECT VALUE COUNT(1) FROM c WHERE c.stage IN ('contact_drafting','contact_approval','contact_sent','contact_replied','contact_confirmed')"),
            self.query(cn, pk, "SELECT VALUE COUNT(1) FROM c WHERE c.stage IN ('proposal_drafting','proposal_approval','proposal_sent','proposal_replied')"),
            self.query(cn, pk, "SELECT VALUE COUNT(1) FROM c WHERE c.stage IN ('counter_offer','counter_drafting','counter_approval','counter_sent')"),
            self.query(cn, pk, "SELECT VALUE AVG(c.rounds) FROM c WHERE c.stage IN ('agreed','completed')"),
            self.query(cn, pk, "SELECT VALUE AVG(c.improvement_score) FROM c WHERE c.stage IN ('agreed','completed') AND c.improvement_score > 0"),
        )

        def _int(r: list) -> int:
            return int(r[0]) if r and r[0] is not None else 0

        def _float(r: list) -> float:
            return round(float(r[0]), 3) if r and r[0] is not None else 0.0

        return {
            "outcomes": {
                "agreed":    _int(agreed_r),
                "rejected":  _int(rejected_r),
                "escalated": _int(escalated_r),
            },
            "pipeline": {
                "contact":  _int(contact_r),
                "proposal": _int(proposal_r),
                "counter":  _int(counter_r),
            },
            "efficiency": {
                "avg_rounds":            _float(avg_rounds_r),
                "avg_improvement_score": _float(avg_imp_r),
            },
        }

    async def get_ab_group_metrics(self) -> list[dict]:
        """Return per-AB-group outcome breakdown from actual negotiations."""
        import asyncio
        cn = settings.NEGOTIATIONS_CONTAINER
        pk = "/vendor_id"

        # Fetch light fields for all negotiations that have an ab_group assigned
        rows = await self.query(
            cn, pk,
            "SELECT c.ab_group, c.stage, c.outcome, c.rounds, c.improvement_score "
            "FROM c WHERE c.ab_group != null",
        )

        # Aggregate in Python — avoids complex Cosmos GROUP BY + PIVOT
        buckets: dict[str, dict] = {}
        for row in rows:
            grp = row.get("ab_group")
            if not grp:
                continue
            if grp not in buckets:
                buckets[grp] = {
                    "group": grp,
                    "total": 0,
                    "agreed": 0,
                    "rejected": 0,
                    "escalated": 0,
                    "in_progress": 0,
                    "first_round_closes": 0,
                    "rounds_sum": 0,
                    "rounds_count": 0,
                    "improvement_sum": 0.0,
                    "improvement_count": 0,
                }
            b = buckets[grp]
            b["total"] += 1
            stage = row.get("stage", "")
            outcome = row.get("outcome") or ""
            if stage in ("agreed", "completed") or outcome == "agreed":
                b["agreed"] += 1
                rounds = row.get("rounds") or 0
                if rounds == 1:
                    b["first_round_closes"] += 1
            elif stage == "rejected" or outcome == "rejected":
                b["rejected"] += 1
            elif stage == "escalated" or outcome == "escalated":
                b["escalated"] += 1
            else:
                b["in_progress"] += 1

            rounds = row.get("rounds")
            if rounds is not None and rounds > 0:
                b["rounds_sum"] += rounds
                b["rounds_count"] += 1

            imp = row.get("improvement_score")
            if imp is not None and imp > 0:
                b["improvement_sum"] += imp
                b["improvement_count"] += 1

        result = []
        for grp in ("A", "B", "C"):
            if grp not in buckets:
                result.append({
                    "group": grp,
                    "total": 0, "agreed": 0, "rejected": 0, "escalated": 0, "in_progress": 0,
                    "close_rate": 0.0, "rejection_rate": 0.0, "first_round_rate": 0.0,
                    "avg_rounds": 0.0, "avg_improvement_score": 0.0,
                })
                continue
            b = buckets[grp]
            concluded = b["agreed"] + b["rejected"] + b["escalated"]
            result.append({
                "group": grp,
                "total": b["total"],
                "agreed": b["agreed"],
                "rejected": b["rejected"],
                "escalated": b["escalated"],
                "in_progress": b["in_progress"],
                "close_rate": round(b["agreed"] / concluded, 4) if concluded > 0 else 0.0,
                "rejection_rate": round(b["rejected"] / concluded, 4) if concluded > 0 else 0.0,
                "first_round_rate": round(b["first_round_closes"] / b["agreed"], 4) if b["agreed"] > 0 else 0.0,
                "avg_rounds": round(b["rounds_sum"] / b["rounds_count"], 2) if b["rounds_count"] > 0 else 0.0,
                "avg_improvement_score": round(b["improvement_sum"] / b["improvement_count"], 4) if b["improvement_count"] > 0 else 0.0,
            })
        return result

    async def upsert_negotiation(self, neg: dict) -> dict:
        return await self.upsert(settings.NEGOTIATIONS_CONTAINER, "/vendor_id", neg)

    async def get_negotiation(self, negotiation_id: str) -> Optional[dict]:
        results = await self.query(
            settings.NEGOTIATIONS_CONTAINER,
            "/vendor_id",
            "SELECT * FROM c WHERE c.id = @nid",
            [{"name": "@nid", "value": negotiation_id}],
        )
        return results[0] if results else None

    async def list_negotiations(self, limit: int = 100, offset: int = 0, stage_filter: Optional[str] = None) -> list[dict]:
        if stage_filter:
            q = "SELECT * FROM c WHERE c.stage = @stage ORDER BY c.updated_at DESC OFFSET @off LIMIT @lim"
            params = [{"name": "@stage", "value": stage_filter}, {"name": "@off", "value": offset}, {"name": "@lim", "value": limit}]
        else:
            q = "SELECT * FROM c ORDER BY c.updated_at DESC OFFSET @off LIMIT @lim"
            params = [{"name": "@off", "value": offset}, {"name": "@lim", "value": limit}]
        return await self.query(settings.NEGOTIATIONS_CONTAINER, "/vendor_id", q, params)

    async def get_negotiations_pending_approval(self) -> list[dict]:
        return await self.query(
            settings.NEGOTIATIONS_CONTAINER,
            "/vendor_id",
            "SELECT * FROM c WHERE c.stage IN ('contact_approval', 'proposal_approval', 'counter_approval') ORDER BY c.updated_at ASC",
        )

    # ── Email thread helpers ───────────────────────────────────────────────

    async def upsert_email(self, email: dict) -> dict:
        return await self.upsert(
            settings.NEGOTIATIONS_EMAILS_CONTAINER, "/negotiation_id", email
        )

    async def list_emails(self, negotiation_id: str) -> list[dict]:
        return await self.query(
            settings.NEGOTIATIONS_EMAILS_CONTAINER,
            "/negotiation_id",
            "SELECT * FROM c WHERE c.negotiation_id = @nid ORDER BY c.created_at ASC",
            [{"name": "@nid", "value": negotiation_id}],
        )

    # ── RL state helpers ───────────────────────────────────────────────────

    async def upsert_rl(self, doc: dict) -> dict:
        return await self.upsert(settings.NEGOTIATIONS_RL_CONTAINER, "/id", doc)

    async def get_rl_state(self) -> list[dict]:
        return await self.query(
            settings.NEGOTIATIONS_RL_CONTAINER,
            "/id",
            "SELECT * FROM c",
        )
