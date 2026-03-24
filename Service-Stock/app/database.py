# app/database.py — service_stock/
# Connexion PostgreSQL via SQLAlchemy — utilise config.py

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from app.config import settings


# ── Moteur SQLAlchemy ──────────────────────────────────────
engine = create_engine(
    settings.STOCK_DATABASE_URL,   # ← depuis .env via config.py
    echo=settings.DEBUG,           # ← affiche les requêtes SQL en dev
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,            # ← vérifie connexion avant chaque requête
    pool_recycle=3600,             # ← recrée connexions après 1h
)

# ── Fabrique de sessions ───────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ── Classe de base pour tous les modèles ──────────────────
Base = declarative_base()


# ── Dépendance FastAPI ────────────────────────────────────
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