# app/config.py — service_notification/

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from functools import lru_cache
from typing import Literal


class NotificationSettings(BaseSettings):

    # ── Identification du service ──────────────────────────
    SERVICE_NAME: str = "notification-service"
    SERVICE_PORT: int = Field(default=8006, ge=1000, le=65535)
    ENVIRONMENT:  Literal["development", "staging", "production"] = "development"
    DEBUG:        bool = False

    # ── Base de données PostgreSQL ─────────────────────────
    NOTIFICATION_DATABASE_URL: str = Field(
        ...,
        description="URL PostgreSQL du service notification"
    )

    # ── JWT partagé ────────────────────────────────────────
    JWT_SECRET_KEY:     str = Field(..., min_length=32)
    JWT_ALGORITHM:      str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=1440, gt=0)

    # ── Configuration Email SMTP ───────────────────────────
    SMTP_HOST:     str = Field(default="smtp.gmail.com")
    SMTP_PORT:     int = Field(default=587)
    SMTP_USER:     str = Field(default="")
    SMTP_PASSWORD: str = Field(default="")

    # ── URLs des autres services ───────────────────────────
    AUTH_SERVICE_URL:  str = "http://localhost:8001"
    ALERTE_SERVICE_URL: str = "http://localhost:8005"

    # ── Validation ────────────────────────────────────────
    @field_validator("NOTIFICATION_DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        if not v.startswith("postgresql://"):
            raise ValueError(
                "NOTIFICATION_DATABASE_URL doit commencer par postgresql://"
            )
        return v

    # ── Pointe vers le .env global ────────────────────────
    model_config = SettingsConfigDict(
        env_file="../.env",       # chemin relatif — fonctionne en local et en Docker
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> NotificationSettings:
    return NotificationSettings()


settings = get_settings()