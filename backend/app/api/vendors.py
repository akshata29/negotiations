from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.services.cosmos import CosmosService
from app.services.ingestion import ingest_from_excel
from app.services.synthetic import generate_synthetic_vendors
from app.models.vendor import VendorListResponse

router = APIRouter(prefix="/api/vendors", tags=["vendors"])


@router.get("", response_model=VendorListResponse)
async def list_vendors(
    eligible_only: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    template_id: Optional[str] = Query(None),
):
    db = CosmosService.get()
    vendors = await db.list_vendors(
        eligible_only=eligible_only,
        limit=limit,
        offset=offset,
        template_id=template_id,
    )
    counts = await db.count_vendors()
    return VendorListResponse(
        vendors=vendors,
        total=counts["total"],
        eligible_count=counts["eligible"],
        in_progress_count=counts["in_progress"],
        completed_count=counts["completed"],
    )


@router.get("/{vendor_id}")
async def get_vendor(vendor_id: int):
    db = CosmosService.get()
    vendor = await db.get_vendor(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


@router.post("/import")
async def import_vendors():
    """Import vendors from the Excel sample file into Cosmos DB."""
    result = await ingest_from_excel()
    return {"status": "ok", **result}


@router.post("/generate-synthetic")
async def generate_synthetic(
    count: int = Query(100, ge=10, le=2000, description="Number of synthetic vendors to generate"),
):
    """Generate synthetic vendor records and load them into Cosmos DB."""
    result = await generate_synthetic_vendors(count=count)
    return {"status": "ok", **result}
