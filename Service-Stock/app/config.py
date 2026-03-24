# app/config.py — service_stock/
# Lit UNIQUEMENT les variables du Stock Service depuis le .env global

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, validator
from functools import lru_cache
from typing import Literal


class StockSettings(BaseSettings):
    """
    Configuration du Stock Service.
    Lit uniquement les variables STOCK_* et les variables
    partagées (JWT, Redis, URLs) depuis le .env global.
    """

    # ── Identification du service ──────────────────────────
    SERVICE_NAME: str = "stock-service"
    SERVICE_PORT: int = Field(default=8003, ge=1000, le=65535)
    ENVIRONMENT:  Literal["development", "staging", "production"] = "development"
    DEBUG:        bool = False

    # ── Base de données PostgreSQL ─────────────────────────
    STOCK_DATABASE_URL: str = Field(
        ...,
        description="URL PostgreSQL du service stock"
    )

    # ── JWT partagé entre tous les services ───────────────
    JWT_SECRET_KEY:     str = Field(..., min_length=32)
    JWT_ALGORITHM:      str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=1440, gt=0)

    # ── Redis Cache ────────────────────────────────────────
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # ── URLs des autres services ───────────────────────────
    AUTH_SERVICE_URL:         str = "http://localhost:8001"
    ALERT_SERVICE_URL:        str = "http://localhost:8005"
    NOTIFICATION_SERVICE_URL: str = "http://localhost:8006"

    # ── Validation ────────────────────────────────────────
    @validator("STOCK_DATABASE_URL")
    def validate_db_url(cls, v: str) -> str:
        if not v.startswith("postgresql://"):
            raise ValueError(
                "STOCK_DATABASE_URL doit commencer par postgresql://"
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
        env_file=r"C:\Users\nherz\OneDrive\Desktop\Projet Gestion-Stock\.env",       # .env à la RACINE du projet
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",              # Ignore les variables des autres services
    )


# ── Singleton ─────────────────────────────────────────────
@lru_cache(maxsize=1)
def get_settings() -> StockSettings:
    """
    Charge les settings une seule fois grâce à lru_cache.
    """
    return StockSettings()


# Instance globale accessible dans tout le service
settings = get_settings()