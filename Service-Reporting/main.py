# main.py — service_reporting/

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routes import router

Base.metadata.create_all(bind=engine)

# Migration : ajouter les colonnes manquantes si elles n'existent pas encore
with engine.connect() as conn:
    try:
        conn.execute(__import__('sqlalchemy').text(
            "ALTER TABLE calculs_profit_perte ADD COLUMN IF NOT EXISTS chiffre_affaires FLOAT DEFAULT 0.0"
        ))
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

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"] if settings.DEBUG else ["https://sgs-saas.tn"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
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