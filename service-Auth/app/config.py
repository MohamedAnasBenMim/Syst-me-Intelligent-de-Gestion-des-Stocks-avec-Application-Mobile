# app/config.py — service_auth/
# Lit UNIQUEMENT les variables du Auth Service depuis le .env global

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, validator #permet de charger automatiquement les variables d’environnement.
from functools import lru_cache
from typing import Literal #limiter les valeurs possibles


class AuthSettings(BaseSettings):

    # ── Identification du service ──────────────────────────
    SERVICE_NAME: str = "auth-service"
    SERVICE_PORT: int = Field(default=8001, ge=1000, le=65535)
    ENVIRONMENT:  Literal["development", "staging", "production"] = "development"
    DEBUG:        bool = False

    # ── Base de données PostgreSQL ─────────────────────────
    AUTH_DATABASE_URL: str = Field(
        ...,
        description="URL PostgreSQL du service auth"
    )

    # ── JWT ────────────────────────────────────────────────
    JWT_SECRET_KEY:     str = Field(..., min_length=32)
    JWT_ALGORITHM:      str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=1440, gt=0)

    # ── URLs des autres services ───────────────────────────
    STOCK_SERVICE_URL:        str = "http://localhost:8003"
    WAREHOUSE_SERVICE_URL:    str = "http://localhost:8002"

    # ── Validation ────────────────────────────────────────
    @validator("AUTH_DATABASE_URL")
    def validate_db_url(cls, v: str) -> str:
        if not v.startswith("postgresql://"):
            raise ValueError(
                "AUTH_DATABASE_URL doit commencer par postgresql://"
            )
        return v

    @validator("JWT_SECRET_KEY")
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "JWT_SECRET_KEY trop courte (minimum 32 caractères)"
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
def get_settings() -> AuthSettings:
    return AuthSettings()


settings = get_settings()