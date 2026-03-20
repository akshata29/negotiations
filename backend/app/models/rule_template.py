from __future__ import annotations
from enum import Enum
from typing import Any, List, Optional, Union
from pydantic import BaseModel, Field, field_validator
import uuid
from datetime import datetime


# ── Allowlists for safe query generation ─────────────────────────────────────

ALLOWED_VENDOR_FIELDS: dict[str, str] = {
    "comp": "string",
    "catg": "string",
    "status": "string",
    "ytd_purchase_amount": "number",
    "ytd_rcvd_amount": "number",
    "std_terms": "number",
    "term_days": "number",
    "net_days": "number",
    "eligible_for_negotiation": "boolean",
}

ALLOWED_OPERATORS = {"eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in"}

# Operators valid per field type
FIELD_TYPE_OPERATORS: dict[str, list[str]] = {
    "string": ["eq", "ne", "in", "not_in"],
    "number": ["eq", "ne", "gt", "gte", "lt", "lte"],
    "boolean": ["eq"],
}

OPERATOR_LABELS: dict[str, str] = {
    "eq": "=",
    "ne": "≠",
    "gt": ">",
    "gte": "≥",
    "lt": "<",
    "lte": "≤",
    "in": "in",
    "not_in": "not in",
}


class RuleCondition(BaseModel):
    field: str
    operator: str
    value: Union[str, float, bool, List[str]]

    @field_validator("field")
    @classmethod
    def field_must_be_allowed(cls, v: str) -> str:
        if v not in ALLOWED_VENDOR_FIELDS:
            raise ValueError(f"Field '{v}' is not a supported filter field")
        return v

    @field_validator("operator")
    @classmethod
    def operator_must_be_allowed(cls, v: str) -> str:
        if v not in ALLOWED_OPERATORS:
            raise ValueError(f"Operator '{v}' is not supported")
        return v


class RuleTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    conditions: List[RuleCondition]
    conjunction: str = "AND"   # "AND" | "OR"
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    @field_validator("conjunction")
    @classmethod
    def conjunction_must_be_valid(cls, v: str) -> str:
        if v not in ("AND", "OR"):
            raise ValueError("conjunction must be AND or OR")
        return v

    @field_validator("conditions")
    @classmethod
    def conditions_must_not_be_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("At least one condition is required")
        return v


class RuleTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    conditions: List[RuleCondition]
    conjunction: str = "AND"


class RuleTemplateListResponse(BaseModel):
    templates: List[RuleTemplate]
    total: int
