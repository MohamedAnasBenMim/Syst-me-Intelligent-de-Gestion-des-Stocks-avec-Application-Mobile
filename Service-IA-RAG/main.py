# main.py — service_ia_rag/
import os
import logging
os.environ["ANONYMIZED_TELEMETRY"] = "False"
logging.getLogger("chromadb.telemetry.product.posthog").setLevel(logging.CRITICAL)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import settings
from app.database import engine, Base
from app.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Créer les tables PostgreSQL au démarrage
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title       = f"{settings.SERVICE_NAME} — SGS SaaS",
    description = "Recommandations intelligentes de réapprovisionnement via pipeline RAG.",
    version  = "1.0.0",
    debug    = settings.DEBUG,
    docs_url = "/docs"  if settings.ENVIRONMENT != "production" else None,
    redoc_url = "/redoc" if settings.ENVIRONMENT != "production" else None,
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
    """Health check : vérifie ChromaDB, modèle embedding et LLM."""
    chroma_status    = "unknown"
    embedding_status = "unknown"
    llm_status       = "unknown"

    try:
        from app.routes import get_chroma_collection
        collection    = get_chroma_collection()
        chroma_status = f"ok ({collection.count()} docs)"
    except Exception as e:
        chroma_status = f"error: {str(e)[:50]}"

    try:
        from app.routes import get_embedding_model
        get_embedding_model()
        embedding_status = "ok"
    except Exception as e:
        embedding_status = f"error: {str(e)[:50]}"

    try:
        import requests
        r = requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5)
        llm_status = "ok" if r.status_code == 200 else "unavailable"
    except Exception:
        llm_status = "unavailable (fallback mode actif)"

    return {
        "service":     settings.SERVICE_NAME,
        "status":      "ok",
        "environment": settings.ENVIRONMENT,
        "version":     "1.0.0",
        "components": {
            "chromadb":  chroma_status,
            "embedding": embedding_status,
            "llm":       llm_status,
        },
        "databases": {
            "postgresql": "recommandations, feedbacks, logs",
            "chromadb":   "vecteurs/embeddings des mouvements",
        },
        "depends_on": {
            "service_stock":    settings.STOCK_SERVICE_URL,
            "service_mouvement": settings.MOUVEMENT_SERVICE_URL,
            "service_alertes":  settings.ALERTE_SERVICE_URL,
        }
    }


@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info(f"Démarrage du {settings.SERVICE_NAME}")
    logger.info(f"  Port       : {settings.SERVICE_PORT}")
    logger.info(f"  Embedding  : {settings.EMBEDDING_MODEL}")
    logger.info(f"  LLM        : {settings.LLM_MODEL} via {settings.LLM_PROVIDER}")
    logger.info(f"  ChromaDB   : {settings.CHROMA_PERSIST_DIR}")
    logger.info("=" * 60)

    try:
        from app.routes import get_embedding_model
        get_embedding_model()
        logger.info("Modèle d'embedding chargé")
    except Exception as e:
        logger.warning(f"Modèle non chargé au démarrage: {e}")

    try:
        from app.routes import get_chroma_collection
        col = get_chroma_collection()
        logger.info(f"ChromaDB prêt ({col.count()} documents)")
    except Exception as e:
        logger.warning(f"ChromaDB non initialisé: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.SERVICE_PORT,
                reload=settings.DEBUG)
