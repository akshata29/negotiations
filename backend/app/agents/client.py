"""
Shared Foundry client for all agents.
Uses azure-ai-projects 2.x with the v2 Responses API on the Foundry project endpoint.
"""
from __future__ import annotations
import logging
from functools import lru_cache

from azure.ai.projects.aio import AIProjectClient
from azure.identity import ClientSecretCredential

from app.config import get_settings

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_foundry_project_client() -> AIProjectClient:
    """Returns async AIProjectClient connected to the Foundry project endpoint."""
    settings = get_settings()
    credential = ClientSecretCredential(
        tenant_id=settings.AZURE_TENANT_ID,
        client_id=settings.AZURE_CLIENT_ID,
        client_secret=settings.AZURE_CLIENT_SECRET,
    )
    return AIProjectClient(
        endpoint=settings.FOUNDRY_PROJECT_ENDPOINT,
        credential=credential,
    )
