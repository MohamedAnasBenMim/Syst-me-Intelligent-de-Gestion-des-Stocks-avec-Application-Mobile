# app/config.py — service_reporting/

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from functools import lru_cache
from typing import Literal


class ReportingSettings(BaseSettings):

    SERVICE_NAME: str = "reporting-service"
    SERVICE_PORT: int = Field(default=8007, ge=1000, le=65535)
    ENVIRONMENT:  Literal["development", "staging", "production"] = "development"
    DEBUG:        bool = False

    REPORTING_DATABASE_URL: str = Field(...)

    JWT_SECRET_KEY:     str = Field(..., min_length=32)
    JWT_ALGORITHM:      str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=1440, gt=0)

    AUTH_SERVICE_URL:      str = "http://localhost:8001"
    WAREHOUSE_SERVICE_URL: str = "http://localhost:8002"
    STOCK_SERVICE_URL:     str = "http://localhost:8003"
    MOUVEMENT_SERVICE_URL: str = "http://localhost:8004"
    ALERTE_SERVICE_URL:    str = "http://localhost:8005"
    IA_RAG_SERVICE_URL:    str = "http://localhost:8008"

    @field_validator("REPORTING_DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        if not v.startswith("postgresql://"):
            raise ValueError("REPORTING_DATABASE_URL doit commencer par postgresql://")
        return v

    model_config = SettingsConfigDict(
        env_file=r"C:\Users\nherz\OneDrive\Desktop\Projet Gestion-Stock\.env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> ReportingSettings:
    return ReportingSettings()


settings = get_settings()