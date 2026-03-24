# app/database.py — service_mouvement/

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from app.config import settings


# ── Moteur SQLAlchemy ──────────────────────────────────────────
engine = create_engine(
    settings.MOUVEMENT_DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# ── Fabrique de sessions ───────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ── Classe de base pour tous les modèles ──────────────────────
Base = declarative_base()


# ── Dépendance FastAPI ─────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """
    Fournit une session DB à chaque endpoint.
    Fermée automatiquement après chaque requête.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()