# main.py — service_reporting/

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routes import router

Base.metadata.create_all(bind=engine)

# Migration : ajouter les colonnes manquantes si elles n'existent pas encore
_MIGRATIONS = [
    "ALTER TABLE calculs_profit_perte ADD COLUMN IF NOT EXISTS chiffre_affaires FLOAT DEFAULT 0.0",
    "ALTER TABLE calculs_profit_perte ADD COLUMN IF NOT EXISTS marge_brute      FLOAT DEFAULT 0.0",
    "ALTER TABLE calculs_profit_perte ADD COLUMN IF NOT EXISTS taux_marge       FLOAT DEFAULT 0.0",
    "ALTER TABLE calculs_profit_perte ADD COLUMN IF NOT EXISTS cout_achats      FLOAT DEFAULT 0.0",
]

with engine.connect() as conn:
    for sql in _MIGRATIONS:
        try:
            conn.execute(__import__('sqlalchemy').text(sql))
            conn.commit()
        except Exception:
            conn.rollback()

app = FastAPI(
    title       = f"{settings.SERVICE_NAME} — SGS SaaS",
    description = "Tableau de bord analytique, KPI, ML Descriptif et ML Prédictif",
    version     = "1.0.0",
    debug       = settings.DEBUG,
    docs_url    = "/docs"   if settings.ENVIRONMENT != "production" else None,
    redoc_url   = "/redoc"  if settings.ENVIRONMENT != "production" else None,
)

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

app.include_router(router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "service"    : settings.SERVICE_NAME,
        "status"     : "ok",
        "environment": settings.ENVIRONMENT,
        "version"    : "1.0.0",
        "port"       : settings.SERVICE_PORT,
        "depends_on" : {
            "service_stock"    : settings.STOCK_SERVICE_URL,
            "service_mouvement": settings.MOUVEMENT_SERVICE_URL,
            "service_warehouse": settings.WAREHOUSE_SERVICE_URL,
            "service_alertes"  : settings.ALERTE_SERVICE_URL,
        }
    }