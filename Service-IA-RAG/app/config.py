# app/config.py — service_ia_rag/

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from functools import lru_cache
from typing import Literal
import os


class IARAGSettings(BaseSettings):

    SERVICE_NAME: str = "ia-rag-service"
    SERVICE_PORT: int = Field(default=8008, ge=1000, le=65535)
    ENVIRONMENT:  Literal["development", "staging", "production"] = "development"
    DEBUG:        bool = False

    # Base de données PostgreSQL pour stocker les recommandations
    IA_RAG_DATABASE_URL: str = Field(...)

    # JWT — partagé avec les autres services
    JWT_SECRET_KEY:     str = Field(..., min_length=32)
    JWT_ALGORITHM:      str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=1440, gt=0)

    # URLs des autres services
    AUTH_SERVICE_URL:         str = "http://localhost:8001"
    WAREHOUSE_SERVICE_URL:    str = "http://localhost:8002"
    STOCK_SERVICE_URL:        str = "http://localhost:8003"
    MOUVEMENT_SERVICE_URL:    str = "http://localhost:8004"
    ALERTE_SERVICE_URL:       str = "http://localhost:8005"
    NOTIFICATION_SERVICE_URL: str = "http://localhost:8006"
    REPORTING_SERVICE_URL:    str = "http://localhost:8007"

    # ChromaDB — base vectorielle (embarquée, pas de serveur séparé)
    CHROMA_PERSIST_DIR:     str = "./data/chroma"
    CHROMA_COLLECTION_NAME: str = "stock_mouvements"

    # HuggingFace Embeddings
    EMBEDDING_MODEL:     str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # LLM Configuration (Mistral API / Ollama fallback)
    LLM_PROVIDER:    Literal["ollama", "huggingface"] = "ollama"
    LLM_MODEL:       str = "mistral:7b"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_TIMEOUT:  int = 30

    # Mistral API (prioritaire sur Ollama)
    MISTRAL_API_KEY: str = Field(default="33TYwx0LKa1qFyiYrgQNJVnh5HOBTeAH")

    # HuggingFace API (fallback si Ollama indisponible)
    HUGGINGFACE_API_KEY: str = Field(default="")
    HUGGINGFACE_MODEL:   str = "mistralai/Mistral-7B-Instruct-v0.2"

    # RAG Configuration
    RAG_TOP_K:          int   = 5
    CHUNK_SIZE:         int   = 500
    CHUNK_OVERLAP:      int   = 50
    MAX_CONTEXT_LENGTH: int   = 4000
    TEMPERATURE:        float = 0.3

    @field_validator("IA_RAG_DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        if not v.startswith("postgresql://"):
            raise ValueError("IA_RAG_DATABASE_URL doit commencer par postgresql://")
        return v

    model_config = SettingsConfigDict(
        # Cherche d'abord ../.env (local), sinon les variables d'environnement
        # (Docker injecte les vars directement, pas besoin du fichier)
        env_file="../.env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> IARAGSettings:
    return IARAGSettings()


settings = get_settings()
