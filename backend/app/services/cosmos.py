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

log = logging.getLogger(__name__)
settings = get_settings()


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
        log.info("Cosmos DB bootstrap complete")

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

    async def list_vendors(self, eligible_only: bool = False, limit: int = 500, offset: int = 0) -> list[dict]:
        if eligible_only:
            q = "SELECT * FROM c WHERE c.eligible_for_negotiation = true ORDER BY c.ytd_purchase_amount DESC OFFSET @off LIMIT @lim"
        else:
            q = "SELECT * FROM c ORDER BY c.ytd_purchase_amount DESC OFFSET @off LIMIT @lim"
        return await self.query(
            settings.NEGOTIATIONS_VENDORS_CONTAINER,
            "/vendor_id",
            q,
            [{"name": "@off", "value": offset}, {"name": "@lim", "value": limit}],
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

    # ── Negotiation helpers ───────────────────────────────────────────────

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
