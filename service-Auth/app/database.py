# app/database.py — service_auth/
# Connexion PostgreSQL via SQLAlchemy

from sqlalchemy import create_engine#sert à créer la connexion entre Python et la base de données.
from sqlalchemy.ext.declarative import declarative_base #Permet de créer la classe de base pour les modèles SQLAlchemy.
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator#Utilisé pour typer la fonction get_db.
from app.config import settings


# ── Moteur SQLAlchemy ──────────────────────────────────────
engine = create_engine(
    settings.AUTH_DATABASE_URL,    # <- depuis .env via config.py
    echo=settings.DEBUG,           # <- affiche requêtes SQL en dev
    pool_size=10,                  #Nombre de connexions permanentes dans le pool.
    max_overflow=20,               #SQLAlchemy peut créer 20 connexions supplémentaires
    pool_pre_ping=True,            #SQLAlchemy vérifie si elle est toujours active.
    pool_recycle=3600,             #Recycle les connexions toutes les :<-
)

# ── Fabrique de sessions ───────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,#Empêche SQLAlchemy d’envoyer automatiquement les modifications à la DB.
    bind=engine,#Lie la session au moteur créé.
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
        yield db #permet de retourner la session à l’endpoint FastAPI.
    except Exception:
        db.rollback() #annule les modifications non validées.
        raise
    finally:
        db.close()