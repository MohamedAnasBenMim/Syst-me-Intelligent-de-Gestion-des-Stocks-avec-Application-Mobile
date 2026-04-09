# app/config.py — service_alertes/

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from functools import lru_cache
from typing import Literal


class AlertesSettings(BaseSettings):

    # ── Identification du service ──────────────────────────
    SERVICE_NAME: str = "alertes-service"
    SERVICE_PORT: int = Field(default=8005, ge=1000, le=65535)
    ENVIRONMENT:  Literal["development", "staging", "production"] = "development"
    DEBUG:        bool = False

    # ── Base de données PostgreSQL ─────────────────────────
    ALERTE_DATABASE_URL: str = Field(
        ...,
        description="URL PostgreSQL du service alertes"
    )

    # ── JWT partagé ────────────────────────────────────────
    JWT_SECRET_KEY:     str = Field(..., min_length=32)
    JWT_ALGORITHM:      str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=1440, gt=0)

    # ── URLs des autres services ───────────────────────────
    AUTH_SERVICE_URL:         str = "http://localhost:8001"
    WAREHOUSE_SERVICE_URL:    str = "http://localhost:8002"
    STOCK_SERVICE_URL:        str = "http://localhost:8003"
    MOUVEMENT_SERVICE_URL:    str = "http://localhost:8004"
    NOTIFICATION_SERVICE_URL: str = "http://localhost:8006"
    IA_RAG_SERVICE_URL:       str = "http://localhost:8008"

    # ── Email destinataire des alertes ────────────────────
    ADMIN_EMAIL: str = ""   # si vide → service-notification utilise SMTP_USER

    # ── Validation ────────────────────────────────────────
    @field_validator("ALERTE_DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        if not v.startswith("postgresql://"):
            raise ValueError(
                "ALERTE_DATABASE_URL doit commencer par postgresql://"
            )
        return v

    # ── Pointe vers le .env global ────────────────────────
    model_config = SettingsConfigDict(
        env_file=r"C:\Users\nherz\OneDrive\Desktop\Projet Gestion-Stock\.env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> AlertesSettings:
    return AlertesSettings()


settings = get_settings()