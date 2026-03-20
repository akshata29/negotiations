from fastapi import APIRouter, HTTPException
from app.services.cosmos import CosmosService
from app.models.rule_template import (
    RuleTemplate,
    RuleTemplateCreate,
    RuleTemplateListResponse,
    ALLOWED_VENDOR_FIELDS,
    FIELD_TYPE_OPERATORS,
)

router = APIRouter(prefix="/api/rule-templates", tags=["rule-templates"])


@router.get("", response_model=RuleTemplateListResponse)
async def list_templates():
    db = CosmosService.get()
    templates = await db.list_rule_templates()
    return RuleTemplateListResponse(templates=templates, total=len(templates))


@router.post("", response_model=RuleTemplate)
async def create_template(body: RuleTemplateCreate):
    db = CosmosService.get()
    template = RuleTemplate(**body.model_dump())
    saved = await db.upsert_rule_template(template.model_dump())
    return saved


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    db = CosmosService.get()
    deleted = await db.delete_rule_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "deleted"}


@router.get("/field-catalog")
async def get_field_catalog():
    """Return the list of filterable vendor fields and their allowed operators."""
    return {
        "fields": [
            {
                "field": field,
                "type": ftype,
                "operators": FIELD_TYPE_OPERATORS[ftype],
            }
            for field, ftype in ALLOWED_VENDOR_FIELDS.items()
        ]
    }
