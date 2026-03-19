from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
import uuid
from datetime import datetime


class NegotiationStatus(str, Enum):
    NOT_STARTED = "not_started"
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    IN_PROGRESS = "in_progress"
    AGREED = "agreed"
    REJECTED = "rejected"
    COMPLETED = "completed"


class VendorBase(BaseModel):
    dcs_vendor: int
    comp: str
    class_of_trade: Optional[str] = None
    catg: str
    buyer: Optional[str] = None
    vendor_id: int
    status: str
    vendor_long_name: str
    vendor_short_name: Optional[str] = None
    active_items: int = 0
    all_items: int = 0
    ytd_purchase_amount: float = 0.0
    ytd_rcvd_amount: float = 0.0
    std_terms: float = 0.0          # col N — cash discount %
    term_days: int = 0              # col O — days to earn discount
    net_days: int = 30              # col P — total payment due days
    email: Optional[str] = None


class VendorInDB(VendorBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    eligible_for_negotiation: bool = False
    exclusion_reason: Optional[str] = None
    negotiation_status: NegotiationStatus = NegotiationStatus.NOT_STARTED
    ab_group: Optional[str] = None          # "A" | "B" | "C"
    active_negotiation_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    def assess_eligibility(self) -> "VendorInDB":
        EXCLUDED_CATG = {"FRS", "TOB", "SEA"}
        reasons = []
        if self.comp != "MPN":
            reasons.append(f"comp={self.comp} (need MPN)")
        if self.catg in EXCLUDED_CATG:
            reasons.append(f"catg={self.catg} is excluded")
        if self.status != "ACT":
            reasons.append(f"status={self.status} (need ACT)")
        if self.ytd_purchase_amount <= 0:
            reasons.append("YTD purchase amount is $0")
        if reasons:
            self.eligible_for_negotiation = False
            self.exclusion_reason = "; ".join(reasons)
        else:
            self.eligible_for_negotiation = True
            self.exclusion_reason = None
            if self.negotiation_status == NegotiationStatus.NOT_STARTED:
                self.negotiation_status = NegotiationStatus.ELIGIBLE
        return self


class VendorResponse(VendorInDB):
    pass


class VendorListResponse(BaseModel):
    vendors: list[VendorResponse]
    total: int
    eligible_count: int
    in_progress_count: int
    completed_count: int
