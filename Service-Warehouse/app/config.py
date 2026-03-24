# app/config.py — service_warehouse/

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from functools import lru_cache #Permet de charger la configuration une seule fois pour améliorer la performance.
from typing import Literal #Permet de limiter les valeurs possibles. EXEMPLE :ENVIRONMENT: Literal["development", "staging", "production"]


class WarehouseSettings(BaseSettings):

    # ── Identification du service ──────────────────────────
    SERVICE_NAME: str = "warehouse-service"
    SERVICE_PORT: int = Field(default=8002, ge=1000, le=65535)
    ENVIRONMENT:  Literal["development", "staging", "production"] = "development"
    DEBUG:        bool = False

    # ── Base de données PostgreSQL ─────────────────────────
    WAREHOUSE_DATABASE_URL: str = Field(
        ...,
        description="URL PostgreSQL du service warehouse"
    )

    # ── JWT partagé ────────────────────────────────────────
    JWT_SECRET_KEY:     str = Field(..., min_length=32)
    JWT_ALGORITHM:      str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=1440, gt=0)

    # ── URLs des autres services ───────────────────────────
    AUTH_SERVICE_URL:  str = "http://localhost:8001"
    STOCK_SERVICE_URL: str = "http://localhost:8003"

    # ── Validation ────────────────────────────────────────
    @field_validator("WAREHOUSE_DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        if not v.startswith("postgresql://"):
            raise ValueError(
                "WAREHOUSE_DATABASE_URL doit commencer par postgresql://"
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
def get_settings() -> WarehouseSettings:
    return WarehouseSettings()


settings = get_settings()