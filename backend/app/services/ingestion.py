"""
Excel ingestion → Cosmos DB.
Also computes eligibility for each vendor.
"""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Optional
import uuid
from datetime import datetime

import openpyxl

from app.models.vendor import VendorInDB
from app.services.cosmos import CosmosService

log = logging.getLogger(__name__)
DATA_PATH = Path(__file__).parent.parent.parent.parent / "data" / "Sample File.xlsx"


def _safe(val, default=None):
    return val if val is not None else default


async def ingest_from_excel(path: Optional[Path] = None) -> dict:
    if path is None:
        path = DATA_PATH
    wb = openpyxl.load_workbook(path)
    ws = wb["Autonomous Negotiation"]
    db = CosmosService.get()

    ingested = 0
    skipped = 0
    errors = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        dcs_vendor = row[0]
        if not isinstance(dcs_vendor, int):
            continue  # skip note rows at the bottom
        try:
            vendor = VendorInDB(
                id=str(uuid.uuid4()),
                dcs_vendor=int(dcs_vendor),
                comp=_safe(row[1], ""),
                class_of_trade=_safe(row[2]),
                catg=_safe(row[3], ""),
                buyer=str(_safe(row[4], "")),
                vendor_id=int(_safe(row[5], 0)),
                status=_safe(row[6], ""),
                vendor_long_name=_safe(row[7], ""),
                vendor_short_name=_safe(row[8]),
                active_items=int(_safe(row[9], 0)),
                all_items=int(_safe(row[10], 0)),
                ytd_purchase_amount=float(_safe(row[11], 0)),
                ytd_rcvd_amount=float(_safe(row[12], 0)),
                std_terms=float(_safe(row[13], 0)),
                term_days=int(_safe(row[14], 0)),
                net_days=int(_safe(row[15], 30)),
                email=_safe(row[16]),
            )
            vendor.assess_eligibility()
            doc = vendor.model_dump()
            doc["vendor_id"] = str(doc["vendor_id"])   # partition key must be string
            # Preserve existing negotiation state if already in DB
            existing = await db.get_vendor(int(vendor.vendor_id))
            if existing:
                doc["negotiation_status"] = existing.get("negotiation_status", vendor.negotiation_status)
                doc["active_negotiation_id"] = existing.get("active_negotiation_id")
                doc["ab_group"] = existing.get("ab_group")
                doc["id"] = existing["id"]
            await db.upsert_vendor(doc)
            ingested += 1
        except Exception as exc:  # noqa: BLE001
            log.warning("Error ingesting row %s: %s", row, exc)
            errors += 1

    log.info("Ingestion done: %d ingested, %d skipped, %d errors", ingested, skipped, errors)
    return {"ingested": ingested, "skipped": skipped, "errors": errors}
