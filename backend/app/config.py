from __future__ import annotations
import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Azure Identity
    AZURE_TENANT_ID: str = ""
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    AZURE_SUBSCRIPTION_ID: str = ""

    # Azure OpenAI
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_API_VERSION: str = "2024-10-21"
    AZURE_OPENAI_CHAT_DEPLOYMENT_NAME: str = "chat4o"

    # Foundry
    FOUNDRY_PROJECT_ENDPOINT: str = ""
    FOUNDRY_MODEL_DEPLOYMENT_NAME: str = "chat4o"
    FOUNDRY_API_VERSION: str = "2025-05-15-preview"
    FOUNDRY_AGENT_NAME: str = "negotiation_orchestrator"
    FOUNDRY_RESPONSE_TIMEOUT_SECONDS: int = 180

    # Cosmos DB
    COSMOSDB_ENDPOINT: str = ""
    NEGOTIATIONS_DB: str = "negotiations"
    NEGOTIATIONS_VENDORS_CONTAINER: str = "vendors"
    NEGOTIATIONS_CONTAINER: str = "negotiations"
    NEGOTIATIONS_EMAILS_CONTAINER: str = "email_threads"
    NEGOTIATIONS_RL_CONTAINER: str = "rl_state"

    # Merchandising Leader Persona
    MERCH_LEADER_NAME: str = "James Caldwell"
    MERCH_LEADER_TITLE: str = "VP of Vendor Relations & Merchandising"
    MERCH_LEADER_EMAIL: str = "james.caldwell@mclane.com"
    MERCH_LEADER_COMPANY: str = "McLane Company"
    MERCH_LEADER_PHONE: str = "(254) 771-7500"

    # App
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    BACKEND_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
