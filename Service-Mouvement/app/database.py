# app/database.py — service_mouvement/

from sqlalchemy import create_engine, text
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


def ensure_mouvement_schema() -> None:
    """
    Met à jour les anciennes bases locales sans perdre l'historique.
    SQLAlchemy create_all() ne modifie pas une table déjà existante.
    """
    statements = [
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS produit_nom VARCHAR(200)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS source_depot_id INTEGER",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS source_depot_nom VARCHAR(200)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS source_type VARCHAR(20)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS source_magasin_id INTEGER",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS source_magasin_nom VARCHAR(200)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS destination_type VARCHAR(20)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS destination_depot_id INTEGER",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS destination_depot_nom VARCHAR(200)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS destination_magasin_id INTEGER",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS destination_magasin_nom VARCHAR(200)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS reference VARCHAR(100)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS motif VARCHAR(255)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS note VARCHAR(500)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS fournisseur_id INTEGER",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS fournisseur_nom VARCHAR(200)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS utilisateur_id INTEGER DEFAULT 1 NOT NULL",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS utilisateur_nom VARCHAR(200)",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now()",
        "ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
        "CREATE INDEX IF NOT EXISTS ix_mouvements_source_depot_id ON mouvements (source_depot_id)",
        "CREATE INDEX IF NOT EXISTS ix_mouvements_destination_depot_id ON mouvements (destination_depot_id)",
        "CREATE INDEX IF NOT EXISTS ix_mouvements_source_magasin_id ON mouvements (source_magasin_id)",
        "CREATE INDEX IF NOT EXISTS ix_mouvements_destination_magasin_id ON mouvements (destination_magasin_id)",
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


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
