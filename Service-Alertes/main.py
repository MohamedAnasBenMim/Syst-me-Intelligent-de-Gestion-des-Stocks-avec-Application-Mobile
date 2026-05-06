# main.py — service_alertes/

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.routes import router, verifier_expirations_stock, verifier_stocks_critiques

logger = logging.getLogger(__name__)


def _generer_token_systeme() -> str:
    """Génère un JWT interne pour les tâches planifiées."""
    from datetime import datetime, timedelta
    payload = {
        "user_id":  0,
        "email":    "system@sgs.internal",
        "role":     "admin",
        "exp":      datetime.utcnow() + timedelta(minutes=60),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def _tache_verification_periodique():
    """
    Tâche de fond — toutes les heures :
      1. Vérifie les stocks critiques/rupture/surstock
      2. Vérifie les expirations proches (≤ 30 jours)
    """
    # Attendre 30 secondes au démarrage pour laisser le temps aux autres services de démarrer
    await asyncio.sleep(30)

    while True:
        try:
            token = _generer_token_systeme()
            db    = SessionLocal()
            try:
                # Faux objet credentials pour satisfaire la signature des routes
                class _FakeCreds:
                    credentials = token

                class _FakeUser:
                    pass

                logger.info("[Scheduler] Vérification des stocks et expirations…")

                import httpx
                async with httpx.AsyncClient(timeout=30.0) as client:
                    # Vérifier stocks critiques
                    r1 = await client.post(
                        f"http://localhost:{settings.SERVICE_PORT}/api/v1/alertes/verifier-stocks",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    logger.info(f"[Scheduler] Stocks : {r1.status_code}")

                    # Vérifier expirations
                    r2 = await client.post(
                        f"http://localhost:{settings.SERVICE_PORT}/api/v1/alertes/verifier-expirations",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    logger.info(f"[Scheduler] Expirations : {r2.status_code} — {r2.text[:200]}")

            finally:
                db.close()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"[Scheduler] Erreur lors de la vérification : {e}")

        # Attendre 1 heure avant la prochaine vérification
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Démarre le scheduler au lancement du service."""
    task = asyncio.create_task(_tache_verification_periodique())
    logger.info("[Alertes] Scheduler démarré — vérification toutes les heures")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("[Alertes] Scheduler arrêté")


# ── Créer les tables PostgreSQL au démarrage ───────────────
Base.metadata.create_all(bind=engine)

# ── Application FastAPI ────────────────────────────────────
app = FastAPI(
    title=f"{settings.SERVICE_NAME} — SGS SaaS",
    description="Surveillance des seuils de stock et déclenchement des alertes",
    version="1.0.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
    docs_url="/docs"   if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# ── CORS ───────────────────────────────────────────────────
_DEV_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000",  "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins  = _DEV_ORIGINS if settings.DEBUG else ["https://sgs-saas.tn"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

# ── Routes ─────────────────────────────────────────────────
app.include_router(router, prefix="/api/v1")

# ── Health check ───────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "service"    : settings.SERVICE_NAME,
        "status"     : "ok",
        "environment": settings.ENVIRONMENT,
        "version"    : "1.0.0",
        "port"       : settings.SERVICE_PORT,
        "depends_on" : {
            "service_stock"       : settings.STOCK_SERVICE_URL,
            "service_notification": settings.NOTIFICATION_SERVICE_URL,
        }
    }
