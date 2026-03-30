# main.py — service_auth/
# Point d'entrée FastAPI du Auth Service

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.routes import router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Créer les tables PostgreSQL au démarrage ───────────────
Base.metadata.create_all(bind=engine)


# ── Seed : créer l'admin par défaut s'il n'existe pas ──────
def seed_admin():
    import os
    from app.models import Utilisateur
    from app.auth import hash_password

    admin_email    = os.environ.get("ADMIN_EMAIL", "admin@sgs.tn")
    admin_password = os.environ.get("ADMIN_PASSWORD", "123456")
    logger.info(f"DEBUG seed — ADMIN_PASSWORD longueur={len(admin_password)} valeur={repr(admin_password[:20])}")

    db = SessionLocal()
    try:
        existant = db.query(Utilisateur).filter(
            Utilisateur.email == admin_email
        ).first()
        if not existant:
            admin = Utilisateur(
                nom      = "Admin",
                prenom   = "SGS",
                email    = admin_email,
                password = hash_password(admin_password),
                role     = "admin",
                est_actif = True,
            )
            db.add(admin)
            db.commit()
            logger.info(f"Admin créé : {admin_email}")
        else:
            logger.info(f"Admin déjà existant : {admin_email}")
    except Exception as e:
        logger.error(f"Erreur seed admin : {e}")
        db.rollback()
    finally:
        db.close()

seed_admin()


# ── Application FastAPI ────────────────────────────────────
app = FastAPI(
    title=f"{settings.SERVICE_NAME} — SGS SaaS",
    description="Authentification et gestion des utilisateurs",
    version="1.0.0",
    debug=settings.DEBUG,
    docs_url="/docs"   if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)


# ── CORS ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else ["https://sgs-saas.tn"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ─────────────────────────────────────────────────
app.include_router(router, prefix="/api/v1")


# ── Health check ───────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "service":     settings.SERVICE_NAME,
        "status":      "ok",
        "environment": settings.ENVIRONMENT,
        "version":     "1.0.0",
        "port":        settings.SERVICE_PORT,
    }