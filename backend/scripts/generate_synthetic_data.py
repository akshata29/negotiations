"""
Generates 2000 synthetic vendor records and loads them into Cosmos DB.
Run: python -m scripts.generate_synthetic_data
"""
from __future__ import annotations
import asyncio
import random
import uuid
from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(override=False)

from faker import Faker
from app.models.vendor import VendorInDB, NegotiationStatus
from app.services.cosmos import CosmosService

fake = Faker()
Faker.seed(42)
random.seed(42)

CATEGORIES = ["GSK", "CON", "BCV", "PET", "HBC", "GEN", "DRY", "FRZ", "CHI", "DAI",
               "TOB", "FRS", "SEA", "BEV", "OTC", "BWS"]
EXCLUDED_CATG = {"FRS", "TOB", "SEA"}
COMPS = ["MPN"] * 8 + ["WPN", "TPN"]   # ~80% MPN
STATUSES = ["ACT"] * 9 + ["INA"]

BUYER_POOL = [f"{n}000" for n in range(21, 45)]

COMPANY_SUFFIXES = ["Inc", "LLC", "Corp", "Ltd", "Co", "Industries", "Holdings", "Group", "Partners", "International"]
TRADE_TYPES = ["DIS", "DIS", "DIS", "MAN", "RET"]


def rand_vendor_name() -> tuple[str, str]:
    words = fake.last_name().upper()
    suffix = random.choice(COMPANY_SUFFIXES).upper()
    long_name = f"{words} {suffix}"
    short_name = words[:3]
    return long_name, short_name


async def generate_and_load(n: int = 2000):
    db = CosmosService.get()
    await db.bootstrap()

    print(f"Generating {n} synthetic vendors...")
    batch: list[dict] = []
    vendor_ids_used = set()

    for i in range(n):
        # Unique vendor IDs
        while True:
            vid = random.randint(100, 999999)
            if vid not in vendor_ids_used:
                vendor_ids_used.add(vid)
                break

        dcs = random.randint(1000, 99999)
        comp = random.choice(COMPS)
        catg = random.choice(CATEGORIES)
        status = random.choice(STATUSES)
        class_of_trade = random.choice(TRADE_TYPES)
        buyer = random.choice(BUYER_POOL)
        long_name, short_name = rand_vendor_name()

        active_items = random.randint(1, 500)
        all_items = active_items + random.randint(0, 200)

        # YTD amounts — range from $1k to $50M with log distribution
        ytd = round(random.lognormvariate(11, 2.5), 2)
        ytd = max(0.0, min(ytd, 50_000_000))
        ytd_rcvd = round(ytd * random.uniform(0.8, 1.0), 2)

        # Terms — cash discount usually 0-3%, biased low
        std_terms = round(random.choice([0, 0, 0.5, 0.75, 1.0, 1.0, 1.5, 2.0, 2.0, 2.5, 3.0]), 2)
        term_days = random.choice([5, 10, 10, 15, 20, 25, 30])
        net_days = random.choice([15, 30, 30, 30, 45, 60, 90])

        # ~30% chance vendor has email on file
        email = fake.company_email() if random.random() < 0.7 else None

        vendor = VendorInDB(
            id=str(uuid.uuid4()),
            dcs_vendor=dcs,
            comp=comp,
            class_of_trade=class_of_trade,
            catg=catg,
            buyer=buyer,
            vendor_id=vid,
            status=status,
            vendor_long_name=long_name,
            vendor_short_name=short_name,
            active_items=active_items,
            all_items=all_items,
            ytd_purchase_amount=ytd,
            ytd_rcvd_amount=ytd_rcvd,
            std_terms=std_terms,
            term_days=term_days,
            net_days=net_days,
            email=email,
            negotiation_status=NegotiationStatus.NOT_STARTED,
        )
        vendor.assess_eligibility()

        doc = vendor.model_dump()
        doc["vendor_id"] = str(vid)   # partition key must be string
        batch.append(doc)

        if len(batch) >= 50 or i == n - 1:
            for doc in batch:
                await db.upsert_vendor(doc)
            print(f"  Loaded {i + 1}/{n} vendors...")
            batch.clear()

    counts = await db.count_vendors()
    print(f"\n✅ Done! {counts['total']} total vendors, {counts['eligible']} eligible for negotiation")


if __name__ == "__main__":
    asyncio.run(generate_and_load(2000))
