# app/routes.py — service_ia_rag/
#
# ═══════════════════════════════════════════════════════
# PIPELINE RAG COMPLET
# ═══════════════════════════════════════════════════════
#
# ÉTAPE 1 — VECTORISATION  → vectoriser_mouvements()
#   → récupère les mouvements depuis Service Mouvement
#   → transforme chaque mouvement en texte descriptif
#   → génère les embeddings avec HuggingFace (all-MiniLM-L6-v2)
#   → stocke les vecteurs dans ChromaDB
#
# ÉTAPE 2 — RECHERCHE SÉMANTIQUE → recherche_semantique()
#   → encode la requête avec le même modèle
#   → cherche les documents similaires dans ChromaDB (cosine)
#   → retourne le contexte pertinent (top-K)
#
# ÉTAPE 3 — GÉNÉRATION LLM → appeler_llm()
#   → construit le prompt avec le contexte RAG
#   → appelle Groq API (ou fallback Ollama local)
#   → parse la réponse structurée JSON
#
# ÉTAPE 4 — PIPELINE COMPLET → route_generer_recommandation()
#   → combine tout : contexte + RAG + LLM
#   → sauvegarde la recommandation en PostgreSQL
# ═══════════════════════════════════════════════════════

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
import httpx
import json
import time
import logging

# ChromaDB et Embeddings
import chromadb
from sentence_transformers import SentenceTransformer

# LLM via Ollama
import requests

from app.database import get_db
from app.models import (
    Recommandation, RecommandationFeedback, EmbeddingLog, RAGQuery,
    TypeRecommandation, StatutRecommandation, UrgenceLevel
)
from app.schemas import (
    VectoriserRequest, VectoriserResponse,
    RecommandationRequest, RecommandationResponse, RecommandationDetail,
    RecommandationListResponse, FeedbackRequest,
    SearchResponse, SearchResult, MessageResponse,
    QuestionRequest, QuestionResponse,
    PrevisionProduit, PrevisionResponse,
    PromotionIARequest, PromotionIAResponse,
)
from app.dependencies import (
    get_current_user, get_current_admin,
    get_current_gestionnaire_or_admin, get_pagination
)
from app.config import settings

router   = APIRouter()
security = HTTPBearer()
logger   = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════
# CACHE EN MÉMOIRE (TTL 30 min)
# ═══════════════════════════════════════════════════════

_CACHE_TTL = 1800  # secondes

_cache_fournisseurs: dict = {"data": None, "ts": 0.0}


# ═══════════════════════════════════════════════════════
# INITIALISATION DES COMPOSANTS RAG
# ═══════════════════════════════════════════════════════

_embedding_model = None

def get_embedding_model() -> SentenceTransformer:
    """Charge le modèle d'embedding HuggingFace (lazy loading)."""
    global _embedding_model
    if _embedding_model is None:
        logger.info(f"Chargement du modèle: {settings.EMBEDDING_MODEL}")
        _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info(f"Modèle chargé (dimension: {settings.EMBEDDING_DIMENSION})")
    return _embedding_model


_chroma_client     = None
_chroma_collection = None

def get_chroma_collection():
    """Initialise et retourne la collection ChromaDB (embarquée)."""
    global _chroma_client, _chroma_collection
    if _chroma_collection is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=chromadb.Settings(anonymized_telemetry=False),
        )
        _chroma_collection = _chroma_client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )
        logger.info(f"ChromaDB collection '{settings.CHROMA_COLLECTION_NAME}' prête")
    return _chroma_collection


# ═══════════════════════════════════════════════════════
# FONCTIONS UTILITAIRES
# ═══════════════════════════════════════════════════════

def mouvement_to_text(m: dict) -> str:
    """Transforme un mouvement en texte descriptif pour l'embedding."""
    date        = m.get("created_at", "")[:10]
    type_mvt    = m.get("type_mouvement", "mouvement")
    quantite    = m.get("quantite", 0)
    produit_id  = m.get("produit_id") or 0
    produit_nom = m.get("produit", {}).get("designation") or f"Produit {produit_id}"
    entrepot_id = m.get("entrepot_id") or 0
    entrepot_nom = m.get("entrepot", {}).get("nom") or f"Entrepôt {entrepot_id}"
    stock_apres  = m.get("stock_apres")
    reference    = m.get("reference", "")

    texte = f"Le {date}, {type_mvt} de {quantite} unités du produit {produit_nom} (ID:{produit_id})"
    texte += f" depuis {entrepot_nom}."
    if stock_apres is not None:
        texte += f" Stock après opération: {stock_apres} unités."
    if reference:
        texte += f" Référence: {reference}."
    return texte


async def recuperer_mouvements(token: str, produit_id: int = None,
                                entrepot_id: int = None, limit: int = 500) -> list:
    """Récupère les mouvements depuis le Service Mouvement."""
    try:
        params = {"limit": limit}
        if produit_id:
            params["produit_id"] = produit_id
        if entrepot_id:
            params["entrepot_id"] = entrepot_id
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.MOUVEMENT_SERVICE_URL}/api/v1/mouvements",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=15.0
            )
            if r.status_code == 200:
                data = r.json()
                return data.get("mouvements", data) if isinstance(data, dict) else data
            return []
    except Exception as e:
        logger.error(f"Erreur récupération mouvements: {e}")
        return []


async def recuperer_stock(token: str, produit_id: int, entrepot_id: int) -> dict:
    """Récupère le stock actuel depuis le Service Stock via l'endpoint dédié au produit."""
    try:
        async with httpx.AsyncClient() as client:
            # Utilise l'endpoint /stocks/produit/{id} qui filtre correctement
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/produit/{produit_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            if r.status_code == 200:
                stocks = r.json()
                if isinstance(stocks, list):
                    # Filtrer par entrepot_id si fourni
                    if entrepot_id:
                        match = [s for s in stocks if s.get("entrepot_id") == entrepot_id]
                        return match[0] if match else (stocks[0] if stocks else {})
                    return stocks[0] if stocks else {}
            return {}
    except Exception as e:
        logger.error(f"Erreur récupération stock: {e}")
        return {}


# ═══════════════════════════════════════════════════════
# AUTO-VECTORISATION
# ═══════════════════════════════════════════════════════

async def auto_vectoriser_si_vide(token: str) -> int:
    """
    Vérifie si ChromaDB contient des documents.
    Si vide, récupère les mouvements et vectorise automatiquement.
    Retourne le nombre de documents dans ChromaDB après l'opération.
    Appelé automatiquement avant chaque requête RAG.
    """
    try:
        count = get_chroma_collection().count()
    except Exception:
        count = 0

    if count == 0:
        logger.info("ChromaDB vide — vectorisation automatique lancée")
        mouvements = await recuperer_mouvements(token)
        if mouvements:
            documents, ids, metadatas = [], [], []
            for m in mouvements:
                ids.append(f"mvt_{m.get('id', 0)}")
                documents.append(mouvement_to_text(m))
                metadatas.append({
                    "produit_id":     int(m.get("produit_id") or 0),
                    "entrepot_id":    int(m.get("entrepot_id") or 0),
                    "type_mouvement": str(m.get("type_mouvement") or ""),
                    "date":           str(m.get("created_at", "") or "")[:10]
                })
            result = vectoriser_documents(documents, ids, metadatas)
            count  = result.get("documents_added", 0)
            logger.info(f"Auto-vectorisation terminée : {count} documents indexés")

    return count


# ═══════════════════════════════════════════════════════
# VECTORISATION
# ═══════════════════════════════════════════════════════

def vectoriser_documents(documents: List[str], ids: List[str],
                          metadatas: List[dict]) -> dict:
    """Vectorise une liste de documents et les stocke dans ChromaDB."""
    start = time.time()
    try:
        model      = get_embedding_model()
        collection = get_chroma_collection()
        embeddings = model.encode(documents, show_progress_bar=False).tolist()
        collection.upsert(
            documents=documents,
            embeddings=embeddings,
            ids=ids,
            metadatas=metadatas
        )
        duration = int((time.time() - start) * 1000)
        return {"success": True, "documents_added": len(documents), "duration_ms": duration}
    except Exception as e:
        logger.error(f"Erreur vectorisation: {e}")
        return {"success": False, "error": str(e)}


# ═══════════════════════════════════════════════════════
# RECHERCHE SÉMANTIQUE
# ═══════════════════════════════════════════════════════

def recherche_semantique(query: str, n_results: int = 5,
                          produit_id: int = None, entrepot_id: int = None) -> list:
    """Recherche sémantique dans ChromaDB."""
    try:
        model           = get_embedding_model()
        collection      = get_chroma_collection()
        query_embedding = model.encode([query], show_progress_bar=False).tolist()

        where_filter = {}
        if produit_id:
            where_filter["produit_id"] = produit_id
        if entrepot_id:
            where_filter["entrepot_id"] = entrepot_id

        results = collection.query(
            query_embeddings=query_embedding,
            n_results=n_results,
            where=where_filter if where_filter else None,
            include=["documents", "metadatas", "distances"]
        )

        formatted = []
        if results and results.get("documents"):
            for i, doc in enumerate(results["documents"][0]):
                formatted.append({
                    "document": doc,
                    "score":    1 - results["distances"][0][i],
                    "metadata": results["metadatas"][0][i] if results.get("metadatas") else {}
                })
        return formatted
    except Exception as e:
        logger.error(f"Erreur recherche: {e}")
        return []


# ═══════════════════════════════════════════════════════
# GÉNÉRATION LLM
# ═══════════════════════════════════════════════════════

def appeler_llm(prompt: str, force_json: bool = False) -> str:
    """
    Appelle le LLM dans l'ordre de priorité :
      1. Groq API (gratuit, sans expiration) — mixtral-8x7b-32768
      2. Ollama (fallback local si Groq indisponible)
    Retourne None si tous les fournisseurs sont indisponibles.
    force_json=True : demande à Groq de répondre en JSON pur (pour les recommandations).
    """
    # ── 1. GROQ (prioritaire) ─────────────────────────
    groq_key = settings.GROQ_API_KEY
    if groq_key and groq_key.startswith("gsk_"):
        try:
            body = {
                "model":       settings.GROQ_MODEL,
                "messages":    [{"role": "user", "content": prompt}],
                "temperature": settings.TEMPERATURE,
                "max_tokens":  500,
            }
            if force_json:
                body["response_format"] = {"type": "json_object"}
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=30,
            )
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            logger.warning(f"Groq API erreur {response.status_code}: {response.text[:200]}")
        except Exception as e:
            logger.warning(f"Groq API non disponible: {e}")

    # ── 2. OLLAMA (fallback local) ────────────────────
    try:
        response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model":  settings.LLM_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": settings.TEMPERATURE, "num_predict": 500},
            },
            timeout=settings.OLLAMA_TIMEOUT,
        )
        if response.status_code == 200:
            return response.json().get("response", "")
    except Exception as e:
        logger.warning(f"Ollama non disponible: {e}")

    return None


def construire_prompt(produit_id, produit_nom, entrepot_nom,
                       stock_actuel, seuil_min, contexte_rag,
                       contexte_supplementaire: str = None,
                       fournisseurs: list = None) -> str:
    contexte_str = "\n".join([f"- {r['document']}" for r in contexte_rag[:5]]) \
                   if contexte_rag else "Aucun historique disponible."
    section_contexte = (
        f"\nCONTEXTE SUPPLÉMENTAIRE FOURNI PAR L'UTILISATEUR:\n{contexte_supplementaire}\n"
        if contexte_supplementaire else ""
    )
    section_fournisseurs = ""
    if fournisseurs:
        f_lines = "\n".join([
            f"  - {f['nom']}: délai={f.get('delai_livraison_jours', '?')}j, "
            f"note={f.get('note', '?')}/5, "
            f"produits={f.get('nb_produits', 0)}, "
            f"fiabilite={'Fiable' if (f.get('note') or 0) >= 4 else 'Moyen' if (f.get('note') or 0) >= 3 else 'Faible'}"
            for f in fournisseurs[:5]
        ])
        section_fournisseurs = f"\nFOURNISSEURS DISPONIBLES (évaluer lequel privilégier):\n{f_lines}\n"

    etat = ("RUPTURE - Stock à zéro !" if stock_actuel == 0
            else "CRITIQUE - Stock sous le seuil minimum!" if stock_actuel < seuil_min
            else "Stock faible - surveiller")

    return f"""Tu es un assistant expert en gestion de stock pour une entreprise tunisienne.

SITUATION ACTUELLE:
- Produit: {produit_nom} (ID: {produit_id})
- Entrepôt: {entrepot_nom}
- Stock actuel: {stock_actuel} unités
- Seuil minimum: {seuil_min} unités
- État: {etat}
{section_contexte}{section_fournisseurs}
HISTORIQUE DES MOUVEMENTS (contexte RAG):
{contexte_str}

TÂCHE: Génère une recommandation de réapprovisionnement complète incluant:
1. La quantité à commander (basée sur l'historique de consommation)
2. L'analyse et le choix du meilleur fournisseur (si liste disponible) avec explication claire (bon/mauvais fournisseur et pourquoi)
3. Un niveau d'urgence justifié

RÉPONDS AU FORMAT JSON UNIQUEMENT:
{{
    "titre": "Titre court et précis",
    "contenu": "Explication détaillée incluant l'analyse du fournisseur recommandé et pourquoi",
    "quantite_suggeree": nombre,
    "urgence": "critique|haute|moyenne|basse",
    "fournisseur_suggere": "Nom du fournisseur recommandé ou null si aucun",
    "confiance": 0.0 à 1.0
}}"""


def parser_reponse_llm(reponse: str, produit_nom: str,
                        stock_actuel: float, seuil_min: float) -> dict:
    """Parse la réponse JSON du LLM. Fallback règles métier si parsing échoue."""
    import re as _re

    def _try_parse(text: str):
        """Tente de parser le JSON depuis le texte brut."""
        # 1. Bloc ```json ... ``` ou ``` ... ```
        m = _re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, _re.DOTALL)
        if m:
            return json.loads(m.group(1))
        # 2. JSON brut depuis le début
        text = text.strip()
        if text.startswith("{"):
            return json.loads(text)
        # 3. Premier bloc JSON n'importe où dans le texte
        m = _re.search(r"\{[^{}]*\}", text, _re.DOTALL)
        if m:
            return json.loads(m.group())
        # 4. JSON multi-niveaux (avec objets imbriqués)
        m = _re.search(r"\{.*\}", text, _re.DOTALL)
        if m:
            return json.loads(m.group())
        raise ValueError("Aucun JSON trouvé")

    try:
        data = _try_parse(reponse or "")
        return {
            "titre":               data.get("titre", f"Réapprovisionnement {produit_nom}"),
            "contenu":             data.get("contenu", "Recommandation générée par IA"),
            "quantite_suggeree":   data.get("quantite_suggeree"),
            "urgence":             data.get("urgence", "moyenne"),
            "fournisseur_suggere": data.get("fournisseur_suggere"),
            "confiance_score":     data.get("confiance", 0.7)
        }
    except Exception as e:
        logger.warning(f"parser_reponse_llm échec ({e}), fallback règles métier")
        quantite = max(seuil_min * 3, 50) if seuil_min else 100
        return {
            "titre":               f"Réapprovisionnement urgent - {produit_nom}",
            "contenu":             (f"Le stock actuel ({stock_actuel} unités) est inférieur "
                                    f"au seuil minimum ({seuil_min} unités). "
                                    f"Commande suggérée : {int(quantite)} unités. "
                                    f"(Généré en mode fallback - LLM non disponible)"),
            "quantite_suggeree":   quantite,
            "urgence":             "haute" if stock_actuel < seuil_min else "moyenne",
            "fournisseur_suggere": None,
            "confiance_score":     0.5
        }


# ═══════════════════════════════════════════════════════
# ROUTES API
# ═══════════════════════════════════════════════════════

@router.post("/ia/embedding/vectoriser", response_model=VectoriserResponse,
             include_in_schema=False,  # Automatique — appelé par Service-Mouvement
             summary="Vectoriser l'historique des mouvements dans ChromaDB")
async def route_vectoriser(
    request:      VectoriserRequest,
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(get_current_gestionnaire_or_admin),
    credentials:  HTTPAuthorizationCredentials = Depends(security),
):
    start_time = time.time()
    token      = credentials.credentials

    mouvements = await recuperer_mouvements(token, request.produit_id, request.entrepot_id)
    if not mouvements:
        return VectoriserResponse(
            success=True, message="Aucun mouvement à vectoriser",
            documents_traites=0, chunks_crees=0,
            temps_traitement_ms=int((time.time() - start_time) * 1000)
        )

    documents, ids, metadatas = [], [], []
    for m in mouvements:
        ids.append(f"mvt_{m.get('id', 0)}")
        documents.append(mouvement_to_text(m))
        metadatas.append({
            "produit_id":     int(m.get("produit_id") or 0),
            "entrepot_id":    int(m.get("entrepot_id") or 0),
            "type_mouvement": str(m.get("type_mouvement") or ""),
            "date":           str(m.get("created_at", "") or "")[:10]
        })

    if request.force_update:
        try:
            get_chroma_collection().delete(where={})
        except Exception:
            pass

    result = vectoriser_documents(documents, ids, metadatas)

    db.add(EmbeddingLog(
        operation="vectorize", source_type="mouvement",
        source_id=request.produit_id,
        documents_count=len(mouvements),
        chunks_created=result.get("documents_added", 0),
        success=result.get("success", False),
        duration_ms=result.get("duration_ms", 0)
    ))
    db.commit()

    return VectoriserResponse(
        success=result.get("success", False),
        message=f"Vectorisation de {len(mouvements)} mouvements",
        documents_traites=len(mouvements),
        chunks_crees=result.get("documents_added", 0),
        temps_traitement_ms=int((time.time() - start_time) * 1000),
        collection_stats={"total": len(ids)}
    )


@router.post("/ia/recommandation", response_model=RecommandationResponse,
             include_in_schema=False,  # Automatique — déclenché par Service-Alertes
             summary="Générer une recommandation IA (pipeline RAG complet)")
async def route_generer_recommandation(
    request:      RecommandationRequest,
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(get_current_gestionnaire_or_admin),
    credentials:  HTTPAuthorizationCredentials = Depends(security),
):
    start_time   = time.time()
    token        = credentials.credentials

    # Auto-vectorisation si ChromaDB est vide
    await auto_vectoriser_si_vide(token)

    produit_id  = request.produit_id  or 0
    entrepot_id = request.entrepot_id or 0

    # Récupérer infos stock si produit/entrepôt connus
    if produit_id and entrepot_id:
        stock_info   = await recuperer_stock(token, produit_id, entrepot_id)
        stock_actuel = request.stock_actuel or stock_info.get("quantite", 0)
        seuil_min    = request.seuil_min    or stock_info.get("produit", {}).get("seuil_alerte_min", 10)
        produit_nom  = stock_info.get("produit", {}).get("designation", f"Produit {produit_id}")
        entrepot_nom = stock_info.get("entrepot", {}).get("nom", f"Entrepôt {entrepot_id}")
    else:
        # Demande manuelle libre (modal) — pas de produit/entrepôt spécifique
        stock_actuel = request.stock_actuel or 0
        seuil_min    = request.seuil_min    or 10
        produit_nom  = "produit"
        entrepot_nom = "entrepôt"

    # Récupérer liste fournisseurs pour enrichir le prompt
    fournisseurs_list = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r_f = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/fournisseurs",
                headers={"Authorization": f"Bearer {token}"},
                params={"limit": 10},
            )
        if r_f.status_code == 200:
            fournisseurs_list = r_f.json().get("fournisseurs", [])
    except Exception:
        pass

    # RAG : recherche sémantique dans ChromaDB
    query        = f"historique mouvements produit {produit_nom} entrepôt {entrepot_nom}"
    contexte_rag = recherche_semantique(query, settings.RAG_TOP_K, produit_id, entrepot_id)

    # LLM : génération de la recommandation
    prompt       = construire_prompt(produit_id, produit_nom, entrepot_nom,
                                     stock_actuel, seuil_min, contexte_rag,
                                     request.contexte_supplementaire,
                                     fournisseurs_list or None)
    llm_response = appeler_llm(prompt, force_json=True)
    result       = parser_reponse_llm(llm_response or "", produit_nom, stock_actuel, seuil_min)

    # Sauvegarde PostgreSQL
    recommandation = Recommandation(
        produit_id=produit_id, entrepot_id=entrepot_id,
        alerte_id=request.alerte_id,
        type=TypeRecommandation.REAPPROVISIONNEMENT,
        titre=result["titre"], contenu=result["contenu"],
        quantite_suggeree=result.get("quantite_suggeree"),
        fournisseur_suggere=result.get("fournisseur_suggere"),
        urgence=UrgenceLevel((result.get("urgence", "MOYENNE") or "MOYENNE").upper()),
        confiance_score=result.get("confiance_score", 0.5),
        sources_rag=[r["document"][:100] for r in contexte_rag[:3]],
        contexte_utilise={"stock_actuel": stock_actuel, "seuil_min": seuil_min,
                          "rag_documents": len(contexte_rag),
                          "date_expiration": request.date_expiration},
        temps_generation_ms=int((time.time() - start_time) * 1000)
    )
    db.add(recommandation)
    db.commit()
    db.refresh(recommandation)

    return RecommandationResponse(
        success=True,
        recommandation_id=recommandation.id,
        titre=recommandation.titre,
        contenu=recommandation.contenu,
        quantite_suggeree=recommandation.quantite_suggeree,
        fournisseur_suggere=recommandation.fournisseur_suggere,
        urgence=recommandation.urgence.value,
        confiance_score=recommandation.confiance_score,
        sources=[r["document"][:50] for r in contexte_rag[:3]],
        temps_generation_ms=recommandation.temps_generation_ms,
        message="Recommandation générée avec succès"
    )


@router.post("/ia/recommander-promotion", response_model=PromotionIAResponse,
             summary="Recommander un % de promotion pour un produit (périmé/surplus)")
async def route_recommander_promotion(
    request:      PromotionIARequest,
    db:           Session                      = Depends(get_db),
    current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials:  HTTPAuthorizationCredentials = Depends(security),
):
    """
    L'IA analyse la situation d'un produit (stock, prix, expiration, historique)
    et recommande le pourcentage de réduction optimal pour minimiser les pertes
    tout en maximisant les ventes.

    Exemples de résultats :
    - "Produit expire dans 5 jours → promotion -40% recommandée"
    - "Surstock × 3 du seuil → promotion -20% pour écouler"
    """
    start_time  = time.time()
    token       = credentials.credentials
    produit_id  = request.produit_id
    produit_nom = request.produit_nom or f"Produit {produit_id}"
    prix_actuel = request.prix_actuel or 0.0

    # ── RAG : contexte des mouvements passés ──────────────────────
    await auto_vectoriser_si_vide(token)
    contexte_rag = recherche_semantique(
        f"ventes sorties produit {produit_nom} historique mouvement",
        n_results=6, produit_id=produit_id
    )
    contexte_str = "\n".join([f"- {r['document']}" for r in contexte_rag[:5]]) \
                   if contexte_rag else "Aucun historique disponible."

    # ── Construire le prompt de recommandation promotion ──────────
    expiration_info = ""
    if request.jours_avant_expiration is not None:
        j = request.jours_avant_expiration
        if j <= 0:
            expiration_info = f"⚠️ PRODUIT EXPIRÉ (dépassé de {abs(j)} jour(s)) — risque de perte totale"
        elif j <= 7:
            expiration_info = f"🔴 EXPIRATION CRITIQUE dans {j} jour(s) — liquidation urgente"
        elif j <= 30:
            expiration_info = f"🟡 Expiration dans {j} jour(s) — promotion recommandée"
        else:
            expiration_info = f"🟢 Expiration dans {j} jour(s)"

    stock_info = f"Stock actuel : {request.stock_actuel} unités" if request.stock_actuel else ""
    prix_info  = f"Prix actuel : {prix_actuel} DT/unité" if prix_actuel else ""
    cat_info   = f"Catégorie : {request.categorie}" if request.categorie else ""
    ctx_info   = f"\nContexte supplémentaire : {request.contexte_supplementaire}" if request.contexte_supplementaire else ""

    prompt = f"""Tu es un expert en gestion de stock et en stratégie commerciale pour une entreprise tunisienne.

PRODUIT À ANALYSER :
- Nom : {produit_nom} (ID: {produit_id})
{f'- {stock_info}' if stock_info else ''}
{f'- {prix_info}' if prix_info else ''}
{f'- {cat_info}' if cat_info else ''}
{f'- {expiration_info}' if expiration_info else ''}
{ctx_info}

HISTORIQUE DES VENTES/MOUVEMENTS (contexte RAG) :
{contexte_str}

MISSION : Recommande le pourcentage de réduction promotionnelle optimal.
L'objectif est de vendre rapidement le stock sans perdre trop d'argent.
Tiens compte de l'urgence liée à la date d'expiration et du volume en stock.

RÈGLES DE DÉCISION :
- Expiration < 3 jours ou déjà expiré → 40% à 60% de réduction
- Expiration 4-7 jours → 25% à 40% de réduction
- Expiration 8-30 jours → 10% à 25% de réduction
- Surstock (> 3× seuil min) sans expiration → 10% à 20% de réduction
- Cas normal avec peu de ventes → 5% à 15% de réduction

RÉPONDS AU FORMAT JSON UNIQUEMENT :
{{
    "pourcentage_suggere": nombre entre 5 et 60,
    "motif": "Une phrase courte expliquant pourquoi ce pourcentage",
    "analyse": "Explication complète de 2-3 phrases : contexte, raisonnement, impact attendu",
    "urgence": "critique|haute|moyenne|basse",
    "confiance": 0.0 à 1.0
}}"""

    llm_response = appeler_llm(prompt, force_json=True)

    # ── Parser la réponse ─────────────────────────────────────────
    pourcentage  = 20.0
    motif        = f"Promotion recommandée pour écouler le stock de {produit_nom}"
    analyse      = motif
    urgence_val  = "moyenne"
    confiance    = 0.6

    if llm_response:
        try:
            r = llm_response.strip()
            for prefix in ["```json", "```"]:
                if r.startswith(prefix): r = r[len(prefix):]
            if r.endswith("```"): r = r[:-3]
            data         = json.loads(r)
            pourcentage  = float(data.get("pourcentage_suggere", 20))
            pourcentage  = max(5.0, min(60.0, pourcentage))  # borner 5-60%
            motif        = data.get("motif", motif)
            analyse      = data.get("analyse", motif)
            urgence_val  = data.get("urgence", "moyenne")
            confiance    = float(data.get("confiance", 0.7))
        except Exception:
            # Fallback selon l'expiration
            if request.jours_avant_expiration is not None:
                j = request.jours_avant_expiration
                if j <= 0:   pourcentage, urgence_val = 50.0, "critique"
                elif j <= 7: pourcentage, urgence_val = 35.0, "haute"
                elif j <= 30:pourcentage, urgence_val = 20.0, "moyenne"
            motif   = f"Réduction de {pourcentage:.0f}% pour limiter les pertes"
            analyse = motif

    # Prix promo estimé
    prix_promo = round(prix_actuel * (1 - pourcentage / 100), 2) if prix_actuel else None

    # ── Sauvegarder comme recommandation ─────────────────────────
    rec = Recommandation(
        produit_id          = produit_id,
        entrepot_id         = None,
        type                = TypeRecommandation.PROMOTION,
        titre               = f"Promotion {pourcentage:.0f}% — {produit_nom}",
        contenu             = analyse,
        quantite_suggeree   = None,
        urgence             = UrgenceLevel((urgence_val or "MOYENNE").upper() if (urgence_val or "").lower() in ("critique","haute","moyenne","basse") else "MOYENNE"),
        confiance_score     = confiance,
        sources_rag         = [r["document"][:100] for r in contexte_rag[:3]],
        contexte_utilise    = {
            "type":                   "promotion",
            "pourcentage_suggere":    pourcentage,
            "jours_avant_expiration": request.jours_avant_expiration,
            "date_expiration":        (
                (datetime.now().date() + timedelta(days=request.jours_avant_expiration)).isoformat()
                if request.jours_avant_expiration is not None else None
            ),
            "prix_actuel":            prix_actuel,
        },
        temps_generation_ms = int((time.time() - start_time) * 1000)
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return PromotionIAResponse(
        success             = True,
        recommandation_id   = rec.id,
        produit_id          = produit_id,
        produit_nom         = produit_nom,
        pourcentage_suggere = pourcentage,
        prix_initial        = prix_actuel or None,
        prix_promo_estime   = prix_promo,
        motif               = motif,
        analyse_complete    = analyse,
        confiance_score     = confiance,
        urgence             = urgence_val,
        temps_generation_ms = rec.temps_generation_ms,
    )


@router.get("/ia/recommandations", response_model=RecommandationListResponse,
            summary="Lister les recommandations générées")
async def route_lister(
    produit_id:   Optional[int] = Query(None),
    entrepot_id:  Optional[int] = Query(None),
    statut:       Optional[str] = Query(None),
    db:           Session       = Depends(get_db),
    current_user: dict          = Depends(get_current_gestionnaire_or_admin),
    pagination:   dict          = Depends(get_pagination),
):
    q = db.query(Recommandation)
    if produit_id:
        q = q.filter(Recommandation.produit_id == produit_id)
    if entrepot_id:
        q = q.filter(Recommandation.entrepot_id == entrepot_id)
    if statut:
        q = q.filter(Recommandation.statut == statut)

    total = q.count()
    recs  = q.order_by(Recommandation.created_at.desc()) \
             .offset(pagination["skip"]).limit(pagination["limit"]).all()

    return RecommandationListResponse(
        recommandations=[RecommandationDetail(
            id=r.id, produit_id=r.produit_id, entrepot_id=r.entrepot_id,
            alerte_id=r.alerte_id, type=r.type.value, titre=r.titre,
            contenu=r.contenu, quantite_suggeree=r.quantite_suggeree,
            fournisseur_suggere=r.fournisseur_suggere, urgence=r.urgence.value,
            confiance_score=r.confiance_score, statut=r.statut.value,
            temps_generation_ms=r.temps_generation_ms,
            created_at=r.created_at, updated_at=r.updated_at
        ) for r in recs],
        total=total, page=pagination["page"], per_page=pagination["per_page"],
        pages=(total + pagination["per_page"] - 1) // pagination["per_page"]
    )


@router.post("/ia/recommandations/{recommandation_id}/feedback",
             response_model=MessageResponse, summary="Feedback sur une recommandation")
async def route_feedback(
    recommandation_id: int,
    feedback:          FeedbackRequest,
    db:                Session                      = Depends(get_db),
    current_user:      dict                         = Depends(get_current_user),
    credentials:       HTTPAuthorizationCredentials = Depends(security),
):
    r = db.query(Recommandation).filter(Recommandation.id == recommandation_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recommandation non trouvée")

    db.add(RecommandationFeedback(
        recommandation_id=recommandation_id,
        user_id=current_user.get("user_id"),
        rating=feedback.rating, comment=feedback.comment,
        action_taken=feedback.action_taken, quantite_reelle=feedback.quantite_reelle
    ))

    if feedback.action_taken == "acceptee":
        r.statut = StatutRecommandation.ACCEPTEE
        db.commit()
        return MessageResponse(message="Recommandation acceptée", success=True)

    elif feedback.action_taken == "rejetee":
        r.statut = StatutRecommandation.REJETEE
        db.commit()

        # ── Générer automatiquement une nouvelle recommandation ──
        token        = credentials.credentials
        stock_actuel = r.contexte_utilise.get("stock_actuel", 0) if r.contexte_utilise else 0
        seuil_min    = r.contexte_utilise.get("seuil_min", 10)   if r.contexte_utilise else 10

        contexte_rejet = (
            f"La recommandation précédente a été rejetée. "
            f"Raison : {feedback.comment or 'non précisée'}. "
            f"Quantité précédemment suggérée : {r.quantite_suggeree}. "
            f"Propose une alternative différente."
        )

        contexte_rag = recherche_semantique(
            f"alternative réapprovisionnement produit {r.produit_id}",
            settings.RAG_TOP_K, r.produit_id, r.entrepot_id
        )

        prompt   = construire_prompt(
            r.produit_id, f"Produit {r.produit_id}",
            f"Entrepôt {r.entrepot_id}",
            stock_actuel, seuil_min, contexte_rag, contexte_rejet
        )
        llm_resp = appeler_llm(prompt, force_json=True)
        result   = parser_reponse_llm(
            llm_resp or "", f"Produit {r.produit_id}", stock_actuel, seuil_min
        )

        nouvelle = Recommandation(
            produit_id          = r.produit_id,
            entrepot_id         = r.entrepot_id,
            alerte_id           = r.alerte_id,
            type                = TypeRecommandation.REAPPROVISIONNEMENT,
            titre               = f"[Révision] {result['titre']}",
            contenu             = result["contenu"],
            quantite_suggeree   = result.get("quantite_suggeree"),
            fournisseur_suggere = result.get("fournisseur_suggere"),
            urgence             = UrgenceLevel((result.get("urgence", "MOYENNE") or "MOYENNE").upper()),
            confiance_score     = result.get("confiance_score", 0.5),
            sources_rag         = [r2["document"][:100] for r2 in contexte_rag[:3]],
            contexte_utilise    = {
                "stock_actuel":     stock_actuel,
                "seuil_min":        seuil_min,
                "rejet_precedent":  recommandation_id,
                # Propager date_expiration depuis la recommandation rejetée
                "date_expiration":  (r.contexte_utilise or {}).get("date_expiration"),
            },
        )
        db.add(nouvelle)
        db.commit()
        db.refresh(nouvelle)

        return MessageResponse(
            message=f"Recommandation rejetée — nouvelle recommandation générée (ID: {nouvelle.id})",
            success=True
        )

    db.commit()
    return MessageResponse(message="Feedback enregistré", success=True)


@router.post("/ia/search", response_model=SearchResponse,
             include_in_schema=False,  # Remplacé par /ia/question (avec réponse LLM)
             summary="Recherche sémantique dans l'historique ChromaDB")
async def route_recherche(
    query:        str          = Query(...),
    produit_id:   Optional[int] = Query(None),
    entrepot_id:  Optional[int] = Query(None),
    n_results:    int          = Query(default=5, ge=1, le=20),
    current_user: dict         = Depends(get_current_gestionnaire_or_admin),
):
    results = recherche_semantique(query, n_results, produit_id, entrepot_id)
    return SearchResponse(
        success=True, query=query, total=len(results),
        results=[SearchResult(document=r["document"], score=r["score"],
                              metadata=r["metadata"]) for r in results]
    )


async def recuperer_contexte_temps_reel(token: str) -> str:
    """
    Récupère depuis les services : stocks actuels, alertes actives, prévisions ML.
    Retourne un bloc texte structuré injecté dans le prompt de /ia/question.
    """
    lignes = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # ── Stocks actuels ───────────────────────────────────
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks",
                headers={"Authorization": f"Bearer {token}"},
                params={"per_page": 200}
            )
            if r.status_code == 200:
                stocks = r.json()
                if isinstance(stocks, dict):
                    stocks = stocks.get("stocks", [])
                lignes.append("=== STOCKS ACTUELS ===")
                for s in stocks:
                    p = s.get("produit") or {}
                    e = s.get("entrepot") or {}
                    nom = p.get("designation", f"Produit {s.get('produit_id')}")
                    entrepot = e.get("nom", f"Entrepôt {s.get('entrepot_id')}")
                    qte = s.get("quantite", 0)
                    seuil = p.get("seuil_alerte_min", 10)
                    exp = p.get("date_expiration", "")
                    statut = "CRITIQUE" if qte < seuil else ("BAS" if qte < seuil * 2 else "OK")
                    ligne = f"- {nom} | {entrepot} | stock={qte} unités | seuil_min={seuil} | statut={statut}"
                    if exp:
                        ligne += f" | expire={exp}"
                    lignes.append(ligne)

            # ── Alertes (actives + critiques) ────────────────────
            r = await client.get(
                f"{settings.ALERTES_SERVICE_URL}/api/v1/alertes",
                headers={"Authorization": f"Bearer {token}"},
                params={"per_page": 50}
            )
            if r.status_code == 200:
                alertes = r.json()
                if isinstance(alertes, dict):
                    alertes = alertes.get("alertes", [])
                actives = [a for a in alertes if a.get("statut") in ("ACTIVE", "active")]
                if actives:
                    lignes.append("=== ALERTES ACTIVES ===")
                    for a in actives[:10]:
                        lignes.append(
                            f"- [{a.get('niveau')}] {a.get('produit_nom')} | "
                            f"entrepot={a.get('entrepot_nom')} | "
                            f"qte={a.get('quantite_actuelle')} | "
                            f"{str(a.get('message',''))[:100]}"
                        )
                else:
                    lignes.append("=== ALERTES ACTIVES ===")
                    lignes.append("- Aucune alerte active pour le moment")
    except Exception as e:
        logger.warning(f"Erreur récupération contexte temps réel: {e}")

    return "\n".join(lignes) if lignes else ""


@router.post("/ia/question", response_model=QuestionResponse,
             summary="Poser une question libre à l'IA (RAG Q&A)")
async def route_question(
    request:      QuestionRequest,
    current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials:  HTTPAuthorizationCredentials = Depends(security),
):
    """
    Pose une question en langage naturel.
    L'IA combine : données temps réel (stocks, alertes) + historique vectorisé (ChromaDB).
    """
    start_time = time.time()
    token      = credentials.credentials

    # Auto-vectorisation si ChromaDB est vide
    await auto_vectoriser_si_vide(token)

    # Recherche sémantique dans ChromaDB
    contexte_rag = recherche_semantique(
        request.question, request.n_results,
        request.produit_id, request.entrepot_id
    )

    # Données temps réel (stocks + alertes)
    contexte_reel = await recuperer_contexte_temps_reel(token)

    contexte_rag_str = "\n".join([f"- {r['document']}" for r in contexte_rag]) \
                       if contexte_rag else "Aucun mouvement récent trouvé."

    prompt = f"""Tu es un assistant expert en gestion de stock pour une entreprise tunisienne.
Réponds en français, de manière claire, précise et utile, en te basant sur les données fournies.

QUESTION DE L'UTILISATEUR:
{request.question}

DONNÉES EN TEMPS RÉEL (stocks actuels + alertes actives):
{contexte_reel if contexte_reel else "Données non disponibles."}

HISTORIQUE DES MOUVEMENTS (contexte RAG - dernières opérations):
{contexte_rag_str}

INSTRUCTIONS:
- Utilise les données temps réel en priorité pour répondre (stocks, alertes, seuils)
- Complète avec l'historique des mouvements si pertinent
- Donne des chiffres précis (stock actuel, jours avant rupture, quantité à commander)
- Si un produit est en alerte critique, indique-le clairement
- Réponds directement en texte naturel, sans JSON"""

    llm_response = appeler_llm(prompt)

    if not llm_response:
        reponse = (
            "LLM indisponible. "
            + (contexte_reel[:500] if contexte_reel else "Aucune donnée disponible.")
        )
    else:
        reponse = llm_response.strip()

    return QuestionResponse(
        success=True,
        question=request.question,
        reponse=reponse,
        sources=[r["document"][:100] for r in contexte_rag[:3]],
        documents_utilises=len(contexte_rag),
        temps_generation_ms=int((time.time() - start_time) * 1000)
    )


@router.get("/ia/previsions", response_model=PrevisionResponse,
            summary="Prévisions ML — état et jours avant rupture pour TOUS les produits")
async def route_previsions(
    seuil_jours:  int  = Query(default=365, ge=1, le=3650,
                               description="Afficher les produits dont la rupture est prévue dans X jours (défaut=365 = tous)"),
    current_user: dict = Depends(get_current_gestionnaire_or_admin),
    credentials:  HTTPAuthorizationCredentials = Depends(security),
):
    """
    Calcule pour TOUS les produits en stock :
    - La consommation moyenne quotidienne (30 derniers jours de SORTIES)
    - Le nombre de jours avant rupture = stock_actuel / conso_par_jour
    - La quantité recommandée à commander = conso_par_jour × 30
    - L'urgence : critique / haute / moyenne / basse / stable (aucune sortie)
    Méthode : moyenne glissante pondérée sur 30 jours
    """
    from collections import defaultdict
    from datetime import timezone

    token = credentials.credentials
    previsions: list[PrevisionProduit] = []

    # ── 1. Récupérer tous les stocks ──────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks",
                headers={"Authorization": f"Bearer {token}"},
                params={"per_page": 500},
            )
            stocks = r.json() if r.status_code == 200 else []
            if isinstance(stocks, dict):
                stocks = stocks.get("stocks", [])
    except Exception as e:
        logger.error(f"Erreur récupération stocks: {e}")
        stocks = []

    if not stocks:
        return PrevisionResponse(
            success=True, previsions=[], total=0,
            genere_le=datetime.now(timezone.utc)
        )

    # ── 2. Récupérer l'historique des mouvements (30 derniers jours) ─
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{settings.MOUVEMENT_SERVICE_URL}/api/v1/mouvements",
                headers={"Authorization": f"Bearer {token}"},
                params={"per_page": 1000},
            )
            mouvements = r.json() if r.status_code == 200 else []
            if isinstance(mouvements, dict):
                mouvements = mouvements.get("mouvements", [])
    except Exception as e:
        logger.error(f"Erreur récupération mouvements: {e}")
        mouvements = []

    # ── 3. Calculer sorties par (produit_id, entrepot_id) sur 30j ──
    # Utilise entrepot_source_id pour les SORTIES (schéma Mouvement)
    sorties: dict = defaultdict(list)
    now = datetime.now(timezone.utc)

    for m in mouvements:
        if m.get("type_mouvement") not in ("sortie", "SORTIE"):
            continue
        try:
            date_str = m.get("created_at", "")
            if date_str:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                if (now - dt).days <= 30:
                    pid = m.get("produit_id")
                    # Pour une SORTIE : entrepot_source_id est l'entrepôt concerné
                    eid = m.get("entrepot_source_id") or m.get("entrepot_id")
                    sorties[(pid, eid)].append(float(m.get("quantite", 0)))
        except Exception:
            continue

    # ── 4. Calculer la prévision pour TOUS les stocks ─────────────
    for stock in stocks:
        try:
            produit_id  = stock.get("produit_id")
            entrepot_id = stock.get("entrepot_id")
            quantite    = float(stock.get("quantite", 0))
            produit     = stock.get("produit") or {}
            entrepot    = stock.get("entrepot") or {}
            seuil_min   = float(produit.get("seuil_alerte_min") or 10)
            seuil_max   = float(produit.get("seuil_alerte_max") or 1000)

            sorties_30   = sorties.get((produit_id, entrepot_id), [])
            total_sorties = sum(sorties_30)

            if total_sorties > 0:
                # Consommation réelle basée sur les sorties des 30 derniers jours
                conso_par_jour = round(total_sorties / 30, 2)
                jours          = round(quantite / conso_par_jour, 1)
                tendance       = "stable"
                if len(sorties_30) >= 4:
                    m2 = len(sorties_30) // 2
                    moy1 = sum(sorties_30[:m2]) / m2
                    moy2 = sum(sorties_30[m2:]) / (len(sorties_30) - m2)
                    if moy2 > moy1 * 1.1:
                        tendance = "hausse"
                    elif moy2 < moy1 * 0.9:
                        tendance = "baisse"
            else:
                # Aucune sortie — détecter quand même si le stock est en rupture
                conso_par_jour = 0.0
                tendance       = "stable"
                if quantite <= 0:
                    jours = 0.0         # rupture même sans historique de sorties
                elif quantite <= seuil_min:
                    jours = 0.0         # sous le seuil minimum
                else:
                    jours = 9999.0      # vraiment stable, pas de consommation mesurable

            # Quantité à commander = 30 jours de conso (ou seuil_min si pas de conso)
            qte_commander = round(
                max(conso_par_jour * 30, seuil_min * 2) if conso_par_jour > 0 else seuil_min * 2,
                0
            )

            # Urgence — vérifier d'abord le niveau de stock réel avant la consommation
            if conso_par_jour == 0 and quantite <= 0:
                urgence = "critique"
                recommandation = f"RUPTURE ! Stock à 0 unité (seuil min : {seuil_min:.0f}). Commander {int(qte_commander)} unités immédiatement."
            elif conso_par_jour == 0 and quantite <= seuil_min:
                urgence = "haute"
                recommandation = f"Stock sous le seuil minimum ({quantite:.0f} ≤ {seuil_min:.0f}). Commander {int(qte_commander)} unités."
            elif conso_par_jour == 0:
                urgence = "stable"
                recommandation = "Aucune sortie enregistrée — stock stable. Surveiller les entrées futures."
            elif jours <= 0:
                urgence = "critique"
                recommandation = f"RUPTURE IMMINENTE ! Commander {int(qte_commander)} unités immédiatement."
            elif jours <= 7:
                urgence = "haute"
                recommandation = f"Rupture dans {jours:.0f}j — commander {int(qte_commander)} unités cette semaine."
            elif jours <= 30:
                urgence = "moyenne"
                recommandation = f"Rupture dans {jours:.0f}j — planifier une commande de {int(qte_commander)} unités."
            elif quantite > seuil_max:
                urgence = "basse"
                recommandation = f"Surstock détecté ({quantite:.0f} > seuil max {seuil_max:.0f}). Réduire les entrées."
            else:
                urgence = "basse"
                recommandation = f"Stock OK — rupture estimée dans {jours:.0f}j à ce rythme de consommation."

            previsions.append(PrevisionProduit(
                produit_id            = produit_id,
                produit_nom           = produit.get("designation", f"Produit {produit_id}"),
                entrepot_id           = entrepot_id,
                entrepot_nom          = entrepot.get("nom", f"Entrepôt {entrepot_id}"),
                stock_actuel          = quantite,
                seuil_min             = seuil_min,
                consommation_par_jour = conso_par_jour,
                jours_avant_rupture   = jours,
                quantite_a_commander  = qte_commander,
                urgence               = urgence,
                tendance              = tendance,
                recommandation        = recommandation,
            ))
        except Exception as e:
            logger.error(f"Erreur calcul prévision stock {stock}: {e}")
            continue

    # Trier : critiques en premier, stables en dernier
    ordre = {"critique": 0, "haute": 1, "moyenne": 2, "basse": 3, "stable": 4}
    previsions.sort(key=lambda p: (ordre.get(p.urgence, 5), p.jours_avant_rupture))

    return PrevisionResponse(
        success    = True,
        previsions = previsions,
        total      = len(previsions),
        genere_le  = datetime.now(timezone.utc),
    )


@router.get("/ia/stats", include_in_schema=False, summary="Statistiques ChromaDB + modèle")
async def route_stats(current_user: dict = Depends(get_current_gestionnaire_or_admin)):
    try:
        count = get_chroma_collection().count()
    except Exception:
        count = 0
    return {
        "collection_name":     settings.CHROMA_COLLECTION_NAME,
        "documents_count":     count,
        "embedding_model":     settings.EMBEDDING_MODEL,
        "embedding_dimension": settings.EMBEDDING_DIMENSION,
        "llm_provider":        "groq",
        "llm_model":           settings.GROQ_MODEL,
        "ollama_fallback":     settings.LLM_MODEL,
        "rag_top_k":           settings.RAG_TOP_K,
    }


# ═══════════════════════════════════════════════════════
# NOUVELLES COLLECTIONS CHROMADB
# ═══════════════════════════════════════════════════════

_chroma_collection_fournisseurs = None
_chroma_collection_marches      = None

def get_chroma_fournisseurs():
    global _chroma_collection_fournisseurs
    if _chroma_collection_fournisseurs is None:
        client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=chromadb.Settings(anonymized_telemetry=False),
        )
        _chroma_collection_fournisseurs = client.get_or_create_collection(
            name="fournisseurs_performance",
            metadata={"hnsw:space": "cosine"}
        )
    return _chroma_collection_fournisseurs


def get_chroma_marches():
    global _chroma_collection_marches
    if _chroma_collection_marches is None:
        client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=chromadb.Settings(anonymized_telemetry=False),
        )
        _chroma_collection_marches = client.get_or_create_collection(
            name="marches_produits",
            metadata={"hnsw:space": "cosine"}
        )
    return _chroma_collection_marches


# ═══════════════════════════════════════════════════════
# FONCTIONS DE TRANSFORMATION TEXTE
# ═══════════════════════════════════════════════════════

def fournisseur_to_text(f: dict) -> str:
    """Transforme un fournisseur en texte descriptif pour l'embedding."""
    nom     = f.get("nom", "Fournisseur inconnu")
    delai   = f.get("delai_livraison_jours")
    note    = f.get("note")
    nb_prod = f.get("nb_produits", 0)
    cond    = f.get("conditions_paiement", "")

    texte = f"Fournisseur: {nom}."
    if delai is not None:
        texte += f" Délai de livraison moyen: {delai} jours."
    if note is not None:
        texte += f" Note de performance: {note}/5."
    if nb_prod:
        texte += f" Fournit {nb_prod} produits différents."
    if cond:
        texte += f" Conditions de paiement: {cond}."
    return texte


def produit_marche_to_text(p: dict) -> str:
    """Transforme un produit avec classification en texte descriptif pour l'embedding."""
    nom           = p.get("designation", "Produit inconnu")
    type_produit  = p.get("type_produit", "CONSOMMABLE")
    pattern       = p.get("pattern_vente", "REGULIER")
    prix_achat    = p.get("prix_achat")
    prix_vente    = p.get("prix_vente")
    marge         = p.get("marge_calculee")
    mois_debut    = p.get("mois_debut_vente")
    mois_fin      = p.get("mois_fin_vente")
    jours_vendre  = p.get("jours_pour_vendre")
    meilleur_mom  = p.get("meilleur_moment_achat", "")

    MOIS = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

    texte = f"Produit: {nom}. Type: {type_produit}. Pattern de vente: {pattern}."
    if prix_achat and prix_vente:
        texte += f" Prix d'achat: {prix_achat} TND, prix de vente: {prix_vente} TND."
    if marge is not None:
        texte += f" Marge bénéficiaire: {marge:.1f}%."
    if pattern in ("SAISONNIER", "OCCASIONNEL"):
        if mois_debut and mois_fin:
            texte += f" Période de vente: {MOIS[mois_debut]} à {MOIS[mois_fin]}."
        if jours_vendre:
            texte += f" Durée moyenne de vente: {jours_vendre} jours."
        if meilleur_mom:
            texte += f" Meilleur moment d'achat: {meilleur_mom}."
    return texte


# ═══════════════════════════════════════════════════════
# ROUTE — VECTORISER FOURNISSEURS
# ═══════════════════════════════════════════════════════

@router.post(
    "/ia/embedding/vectoriser-fournisseurs",
    tags=["IA - Fournisseurs"],
    summary="Vectoriser les fournisseurs dans ChromaDB",
)
async def vectoriser_fournisseurs(
    credentials:  HTTPAuthorizationCredentials = Depends(security),
    current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
):
    token = credentials.credentials
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/fournisseurs",
                headers={"Authorization": f"Bearer {token}"},
                params={"limit": 500},
            )
        fournisseurs = r.json().get("fournisseurs", []) if r.status_code == 200 else []
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur récupération fournisseurs: {e}")

    if not fournisseurs:
        return {"vectorises": 0, "message": "Aucun fournisseur trouvé"}

    model      = get_embedding_model()
    collection = get_chroma_fournisseurs()
    textes     = [fournisseur_to_text(f) for f in fournisseurs]
    embeddings = model.encode(textes, show_progress_bar=False).tolist()

    ids        = [f"fournisseur_{f['id']}" for f in fournisseurs]
    metadatas  = [{"fournisseur_id": f["id"], "nom": f["nom"]} for f in fournisseurs]

    collection.upsert(ids=ids, documents=textes, embeddings=embeddings, metadatas=metadatas)
    return {"vectorises": len(fournisseurs), "message": f"{len(fournisseurs)} fournisseurs vectorisés"}


# ═══════════════════════════════════════════════════════
# ROUTE — VECTORISER PRODUITS MARCHÉ
# ═══════════════════════════════════════════════════════

@router.post(
    "/ia/embedding/vectoriser-marches",
    tags=["IA - Marché"],
    summary="Vectoriser les produits avec classification dans ChromaDB",
)
async def vectoriser_marches(
    credentials:  HTTPAuthorizationCredentials = Depends(security),
    current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
):
    token = credentials.credentials
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/produits",
                headers={"Authorization": f"Bearer {token}"},
                params={"limit": 500},
            )
        produits = r.json() if r.status_code == 200 else []
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur récupération produits: {e}")

    if not produits:
        return {"vectorises": 0, "message": "Aucun produit trouvé"}

    model      = get_embedding_model()
    collection = get_chroma_marches()
    textes     = [produit_marche_to_text(p) for p in produits]
    embeddings = model.encode(textes, show_progress_bar=False).tolist()

    ids        = [f"produit_{p['id']}" for p in produits]
    metadatas  = [{"produit_id": p["id"], "type_produit": p.get("type_produit", ""),
                   "pattern_vente": p.get("pattern_vente", "")} for p in produits]

    collection.upsert(ids=ids, documents=textes, embeddings=embeddings, metadatas=metadatas)
    return {"vectorises": len(produits), "message": f"{len(produits)} produits vectorisés"}


# ═══════════════════════════════════════════════════════
# ROUTE — ANALYSER MARGE D'UN PRODUIT
# ═══════════════════════════════════════════════════════

@router.post(
    "/ia/marges/analyser",
    tags=["IA - Marché"],
    summary="Analyse IA de la marge d'un produit avec suggestions d'optimisation",
)
async def analyser_marge(
    produit_id:   int                          = Query(..., gt=0),
    credentials:  HTTPAuthorizationCredentials = Depends(security),
    current_user: dict                         = Depends(get_current_user),
):
    token = credentials.credentials

    # Récupérer le produit
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/produits/{produit_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail=f"Produit {produit_id} introuvable")
        produit = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Recherche sémantique dans ChromaDB marché
    texte_requete = produit_marche_to_text(produit)
    model         = get_embedding_model()
    embedding     = model.encode([texte_requete]).tolist()

    try:
        resultats = get_chroma_marches().query(
            query_embeddings=embedding,
            n_results=min(5, get_chroma_marches().count() or 1),
        )
        contexte_rag = "\n".join(resultats["documents"][0]) if resultats["documents"] else ""
    except Exception:
        contexte_rag = ""

    marge = produit.get("marge_calculee")
    type_p = produit.get("type_produit", "CONSOMMABLE")
    plages = {"CONSOMMABLE": "5%-25%", "NON_CONSOMMABLE": "25%-80%"}

    prompt = f"""Tu es un expert en gestion des marges commerciales en Tunisie.

Produit analysé: {produit.get('designation')}
Type: {type_p}
Prix d'achat: {produit.get('prix_achat')} TND
Prix de vente: {produit.get('prix_vente')} TND
Marge actuelle: {marge}%
Plage recommandée pour {type_p}: {plages.get(type_p, 'inconnue')}
Pattern de vente: {produit.get('pattern_vente', 'REGULIER')}

Contexte marché (produits similaires):
{contexte_rag}

Réponds en JSON strict:
{{
  "analyse": "diagnostic en 2 phrases",
  "marge_optimale": <nombre>,
  "prix_vente_suggere": <nombre>,
  "actions": ["action 1", "action 2"],
  "avertissement": "si marge hors plage, sinon null"
}}"""

    try:
        reponse_llm = appeler_llm(prompt, force_json=True)
        r = (reponse_llm or "").strip()
        for prefix in ["```json", "```"]:
            if r.startswith(prefix): r = r[len(prefix):]
        if r.endswith("```"): r = r[:-3]
        analyse = json.loads(r)
    except Exception:
        analyse = {
            "analyse":            f"Marge actuelle: {marge}%",
            "marge_optimale":     marge,
            "prix_vente_suggere": produit.get("prix_vente"),
            "actions":            ["Vérifier les prix fournisseurs"],
            "avertissement":      produit.get("avertissement_marge"),
        }

    return {"produit_id": produit_id, "designation": produit.get("designation"), **analyse}


# ═══════════════════════════════════════════════════════
# ROUTE — TIMING MARCHÉ (quand acheter/vendre)
# ═══════════════════════════════════════════════════════

@router.post(
    "/ia/marche/timing",
    tags=["IA - Marché"],
    summary="Recommandation IA sur le meilleur moment d'achat/vente d'un produit",
)
async def timing_marche(
    produit_id:   int                          = Query(..., gt=0),
    credentials:  HTTPAuthorizationCredentials = Depends(security),
    current_user: dict                         = Depends(get_current_user),
):
    token = credentials.credentials

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/produits/{produit_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail=f"Produit {produit_id} introuvable")
        produit = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    MOIS = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

    mois_debut = produit.get("mois_debut_vente")
    mois_fin   = produit.get("mois_fin_vente")
    jours      = produit.get("jours_pour_vendre")
    pattern    = produit.get("pattern_vente", "REGULIER")
    delai_info = f"{jours} jours" if jours else "délai inconnu"

    periode = ""
    if mois_debut and mois_fin:
        periode = f"de {MOIS[mois_debut]} à {MOIS[mois_fin]}"

    periode_str = periode or "toute l'année"
    prompt = f"""Tu es un expert en approvisionnement et gestion des stocks en Tunisie.

Produit: {produit.get('designation')}
Pattern de vente: {pattern}
Période de vente: {periode_str}
Durée moyenne de vente: {delai_info}
Meilleur moment d'achat connu: {produit.get('meilleur_moment_achat', 'non défini')}
Mois actuel: {datetime.now().month} ({MOIS[datetime.now().month]})

Réponds en JSON strict:
{{
  "recommandation": "conseil principal en 2 phrases",
  "meilleur_mois_achat": "nom du mois",
  "meilleur_mois_vente": "nom du mois",
  "delai_livraison_conseille": "X semaines avant la saison",
  "risques": ["risque 1", "risque 2"],
  "opportunites": ["opportunité 1"]
}}"""

    try:
        reponse_llm = appeler_llm(prompt, force_json=True)
        r = (reponse_llm or "").strip()
        for prefix in ["```json", "```"]:
            if r.startswith(prefix): r = r[len(prefix):]
        if r.endswith("```"): r = r[:-3]
        timing = json.loads(r)
    except Exception:
        timing = {
            "recommandation":             f"Produit {pattern} — consultez les données historiques",
            "meilleur_mois_achat":        MOIS[mois_debut] if mois_debut else "Non défini",
            "meilleur_mois_vente":        MOIS[mois_debut] if mois_debut else "Non défini",
            "delai_livraison_conseille":  "4-6 semaines avant la saison",
            "risques":                    ["Rupture de stock si achat trop tardif"],
            "opportunites":               ["Négocier des prix bas hors saison"],
        }

    return {"produit_id": produit_id, "designation": produit.get("designation"), **timing}


# ═══════════════════════════════════════════════════════
# ROUTE — PERFORMANCE FOURNISSEURS
# ═══════════════════════════════════════════════════════

@router.get(
    "/ia/fournisseurs/performance",
    tags=["IA - Fournisseurs"],
    summary="Analyse IA des performances des fournisseurs",
)
async def performance_fournisseurs(
    credentials:  HTTPAuthorizationCredentials = Depends(security),
    current_user: dict                         = Depends(get_current_user),
    force_refresh: bool = Query(False, description="Forcer le recalcul même si le cache est valide"),
):
    global _cache_fournisseurs
    if not force_refresh and _cache_fournisseurs["data"] and (time.time() - _cache_fournisseurs["ts"]) < _CACHE_TTL:
        logger.info("Analyse fournisseurs retournée depuis le cache")
        return _cache_fournisseurs["data"]

    token = credentials.credentials

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/fournisseurs",
                headers={"Authorization": f"Bearer {token}"},
                params={"limit": 50},
            )
        fournisseurs = r.json().get("fournisseurs", []) if r.status_code == 200 else []
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not fournisseurs:
        return {"message": "Aucun fournisseur disponible", "classement": []}

    # Contexte RAG
    requete   = "fournisseur performance livraison délai fiabilité qualité"
    model     = get_embedding_model()
    embedding = model.encode([requete]).tolist()

    try:
        col = get_chroma_fournisseurs()
        if col.count() > 0:
            resultats   = col.query(query_embeddings=embedding, n_results=min(10, col.count()))
            contexte_rag = "\n".join(resultats["documents"][0])
        else:
            contexte_rag = "\n".join([fournisseur_to_text(f) for f in fournisseurs[:10]])
    except Exception:
        contexte_rag = "\n".join([fournisseur_to_text(f) for f in fournisseurs[:10]])

    liste_txt = "\n".join([
        f"- {f['nom']}: délai={f.get('delai_livraison_jours', '?')}j, note={f.get('note', '?')}/5, produits={f.get('nb_produits', 0)}"
        for f in fournisseurs
    ])

    prompt = f"""Tu es un expert en gestion des fournisseurs en Tunisie.

Liste des fournisseurs:
{liste_txt}

Contexte historique:
{contexte_rag}

Analyse la performance de chaque fournisseur et réponds en JSON strict:
{{
  "synthese": "résumé en 2 phrases",
  "classement": [
    {{"rang": 1, "nom": "...", "score": 8.5, "points_forts": ["..."], "points_faibles": ["..."]}}
  ],
  "recommandation_globale": "conseil stratégique"
}}"""

    try:
        reponse_llm = appeler_llm(prompt, force_json=True)
        r = (reponse_llm or "").strip()
        for prefix in ["```json", "```"]:
            if r.startswith(prefix): r = r[len(prefix):]
        if r.endswith("```"): r = r[:-3]
        analyse = json.loads(r)
    except Exception:
        analyse = {
            "synthese": f"{len(fournisseurs)} fournisseurs analysés",
            "classement": [{"rang": i+1, "nom": f["nom"], "score": f.get("note", 0) or 0,
                            "points_forts": [], "points_faibles": []}
                           for i, f in enumerate(fournisseurs[:5])],
            "recommandation_globale": "Comparer les délais de livraison et conditions de paiement",
        }

    result = {"nb_fournisseurs": len(fournisseurs), **analyse}
    _cache_fournisseurs["data"] = result
    _cache_fournisseurs["ts"]   = time.time()
    return result
