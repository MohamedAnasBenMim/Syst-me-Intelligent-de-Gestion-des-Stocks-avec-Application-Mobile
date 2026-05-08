# app/database.py — service_stock/
# Connexion PostgreSQL via SQLAlchemy — utilise config.py

from sqlalchemy import create_engine, text
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


def ensure_stock_schema() -> None:
    """
    Adds columns introduced after the first local database was created.
    SQLAlchemy create_all creates missing tables, but it does not migrate
    existing tables.
    """
    statements = [
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS prix_achat DOUBLE PRECISION",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS prix_vente DOUBLE PRECISION",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS marge_calculee DOUBLE PRECISION",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS type_produit VARCHAR(20) DEFAULT 'CONSOMMABLE' NOT NULL",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS pattern_vente VARCHAR(20)",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS mois_debut_vente INTEGER",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS mois_fin_vente INTEGER",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS jours_pour_vendre INTEGER",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS meilleur_moment_achat VARCHAR(100)",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS date_fabrication DATE",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS date_expiration DATE",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS en_promotion BOOLEAN DEFAULT FALSE NOT NULL",
        "ALTER TABLE produits ADD COLUMN IF NOT EXISTS prix_promo DOUBLE PRECISION",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS numero_lot VARCHAR(100)",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS date_fabrication DATE",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS date_expiration DATE",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS date_reception DATE",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS location_type VARCHAR(20)",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS depot_id INTEGER",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS magasin_id INTEGER",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS stock_type VARCHAR(20)",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS emplacement VARCHAR(100)",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS fournisseur_id INTEGER",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS fournisseur_nom VARCHAR(200)",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS prix_achat_lot DOUBLE PRECISION",
        "ALTER TABLE stocks ADD COLUMN IF NOT EXISTS prix_vente_lot DOUBLE PRECISION",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


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
