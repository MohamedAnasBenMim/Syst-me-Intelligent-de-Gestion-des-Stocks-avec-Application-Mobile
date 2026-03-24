# main.py — service_auth/
# Point d'entrée FastAPI du Auth Service

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routes import router


# ── Créer les tables PostgreSQL au démarrage ───────────────
Base.metadata.create_all(bind=engine)


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