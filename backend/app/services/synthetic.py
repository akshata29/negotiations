"""
Synthetic vendor data generator — callable from the API or CLI.
"""
from __future__ import annotations
import random
import uuid
import logging

from faker import Faker
from app.models.vendor import VendorInDB, NegotiationStatus
from app.services.cosmos import CosmosService

log = logging.getLogger(__name__)
fake = Faker()

CATEGORIES = ["GSK", "CON", "BCV", "PET", "HBC", "GEN", "DRY", "FRZ", "CHI", "DAI",
               "TOB", "FRS", "SEA", "BEV", "OTC", "BWS"]
COMPS = ["MPN"] * 8 + ["WPN", "TPN"]
STATUSES = ["ACT"] * 9 + ["INA"]
BUYER_POOL = [f"{n}000" for n in range(21, 45)]
COMPANY_SUFFIXES = ["Inc", "LLC", "Corp", "Ltd", "Co", "Industries", "Holdings",
                    "Group", "Partners", "International"]
TRADE_TYPES = ["DIS", "DIS", "DIS", "MAN", "RET"]


def _rand_vendor_name() -> tuple[str, str]:
    word = fake.last_name().upper()
    suffix = random.choice(COMPANY_SUFFIXES).upper()
    return f"{word} {suffix}", word[:3]


async def generate_synthetic_vendors(count: int = 100) -> dict:
    """Generate `count` synthetic vendors and upsert to Cosmos DB.

    Returns a summary dict: generated, errors, total_vendors, eligible_vendors.
    """
    db = CosmosService.get()

    created = 0
    errors = 0
    used_ids: set[int] = set()
    batch: list[dict] = []

    for i in range(count):
        try:
            while True:
                vid = random.randint(100, 999_999)
                if vid not in used_ids:
                    used_ids.add(vid)
                    break

            ytd = round(random.lognormvariate(11, 2.5), 2)
            ytd = max(0.0, min(ytd, 50_000_000.0))
            long_name, short_name = _rand_vendor_name()

            vendor = VendorInDB(
                id=str(uuid.uuid4()),
                dcs_vendor=random.randint(1000, 99_999),
                comp=random.choice(COMPS),
                class_of_trade=random.choice(TRADE_TYPES),
                catg=random.choice(CATEGORIES),
                buyer=random.choice(BUYER_POOL),
                vendor_id=vid,
                status=random.choice(STATUSES),
                vendor_long_name=long_name,
                vendor_short_name=short_name,
                active_items=random.randint(1, 500),
                all_items=random.randint(1, 700),
                ytd_purchase_amount=ytd,
                ytd_rcvd_amount=round(ytd * random.uniform(0.8, 1.0), 2),
                std_terms=round(
                    random.choice([0, 0, 0.5, 0.75, 1.0, 1.0, 1.5, 2.0, 2.0, 2.5, 3.0]), 2
                ),
                term_days=random.choice([5, 10, 10, 15, 20, 25, 30]),
                net_days=random.choice([15, 30, 30, 30, 45, 60, 90]),
                email=fake.company_email() if random.random() < 0.7 else None,
                negotiation_status=NegotiationStatus.NOT_STARTED,
            )
            vendor.assess_eligibility()

            doc = vendor.model_dump()
            doc["vendor_id"] = str(vid)
            batch.append(doc)

            if len(batch) >= 50 or i == count - 1:
                for d in batch:
                    await db.upsert_vendor(d)
                created += len(batch)
                batch.clear()

        except Exception as exc:
            log.warning("Error generating vendor %d: %s", i, exc)
            errors += 1
            batch.clear()

    counts = await db.count_vendors()
    return {
        "generated": created,
        "errors": errors,
        "total_vendors": counts["total"],
        "eligible_vendors": counts["eligible"],
    }
