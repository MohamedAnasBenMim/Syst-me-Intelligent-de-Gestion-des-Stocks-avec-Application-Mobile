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

_DEV_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000",  "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"] if settings.ENVIRONMENT != "production" else ["https://sgs-saas.tn"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
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
    logger.info(f"  LLM        : Groq ({settings.GROQ_MODEL}) | fallback Ollama ({settings.LLM_MODEL})")
    logger.info(f"  ChromaDB   : {settings.CHROMA_PERSIST_DIR}")
    logger.info("=" * 60)

    # ── Créer le makefile manquant de Prophet/cmdstan ──────────────
    try:
        import importlib.resources as res_lib, os as _os
        _p = str(res_lib.files('prophet') / 'stan_model' / 'cmdstan-2.33.1')
        _f = _os.path.join(_p, 'makefile')
        if not _os.path.exists(_f):
            open(_f, 'w').write('CMDSTAN_VERSION := 2.33.1\n')
            logger.info("[ML] Prophet makefile créé automatiquement")
    except Exception as _e:
        logger.warning(f"[ML] Prophet makefile fix: {_e}")

    # ── Installer cmdstan (backend C++ de Prophet) en arrière-plan ──
    # Sans cmdstan, Prophet échoue silencieusement → fallback LinearRegression
    import asyncio, concurrent.futures
    def _install_cmdstan():
        try:
            import cmdstanpy
            cmdstanpy.install_cmdstan(overwrite=False)   # no-op si déjà installé
            logger.info("[ML] cmdstan installé — Prophet opérationnel")
        except Exception as e:
            logger.warning(f"[ML] cmdstan non installé: {e} — LinearRegression sera utilisé en fallback")

    loop = asyncio.get_event_loop()
    loop.run_in_executor(concurrent.futures.ThreadPoolExecutor(max_workers=1), _install_cmdstan)
    logger.info("[ML] Installation cmdstan lancée en arrière-plan (~2 min au 1er démarrage)")

    try:
        from app.routes import get_embedding_model
        model = get_embedding_model()
        model.encode(["pré-chauffe du modèle d'embedding"])
        logger.info("Modèle d'embedding chargé et pré-chauffé")
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
