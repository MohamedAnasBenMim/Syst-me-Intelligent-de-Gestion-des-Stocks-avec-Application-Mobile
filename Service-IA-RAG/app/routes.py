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
#   → appelle Mistral via Ollama (ou fallback règles métier)
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
from datetime import datetime
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
    QuestionRequest, QuestionResponse
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
    produit_id  = m.get("produit_id", "?")
    produit_nom = m.get("produit", {}).get("designation", f"Produit {produit_id}")
    entrepot_id = m.get("entrepot_id", "?")
    entrepot_nom = m.get("entrepot", {}).get("nom", f"Entrepôt {entrepot_id}")
    stock_apres  = m.get("stock_apres", "N/A")
    reference    = m.get("reference", "")

    texte = f"Le {date}, {type_mvt} de {quantite} unités du produit {produit_nom} (ID:{produit_id})"
    texte += f" depuis {entrepot_nom}."
    if stock_apres != "N/A":
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
    """Récupère le stock actuel depuis le Service Stock."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks",
                headers={"Authorization": f"Bearer {token}"},
                params={"produit_id": produit_id, "entrepot_id": entrepot_id},
                timeout=10.0
            )
            if r.status_code == 200:
                stocks = r.json()
                if isinstance(stocks, dict):
                    stocks = stocks.get("stocks", [])
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

def appeler_llm(prompt: str) -> str:
    """Appelle Mistral API. Retourne None si indisponible (mode fallback)."""
    mistral_key = settings.MISTRAL_API_KEY
    if mistral_key and mistral_key not in ("", "ma_cle_api_mistral", "mets_ta_vraie_cle_ici"):
        try:
            response = requests.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {mistral_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": settings.TEMPERATURE,
                    "max_tokens": 500
                },
                timeout=30
            )
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            logger.warning(f"Mistral API erreur {response.status_code}: {response.text}")
        except Exception as e:
            logger.warning(f"Mistral API non disponible (mode fallback): {e}")
        return None

    # Fallback Ollama si pas de clé Mistral
    try:
        response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model":  settings.LLM_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": settings.TEMPERATURE, "num_predict": 500}
            },
            timeout=settings.OLLAMA_TIMEOUT
        )
        if response.status_code == 200:
            return response.json().get("response", "")
        return None
    except Exception as e:
        logger.warning(f"LLM non disponible (mode fallback): {e}")
        return None


def construire_prompt(produit_id, produit_nom, entrepot_nom,
                       stock_actuel, seuil_min, contexte_rag,
                       contexte_supplementaire: str = None) -> str:
    contexte_str = "\n".join([f"- {r['document']}" for r in contexte_rag[:5]]) \
                   if contexte_rag else "Aucun historique disponible."
    section_contexte = (
        f"\nCONTEXTE SUPPLÉMENTAIRE FOURNI PAR L'UTILISATEUR:\n{contexte_supplementaire}\n"
        if contexte_supplementaire else ""
    )
    return f"""Tu es un assistant expert en gestion de stock pour une entreprise tunisienne.

SITUATION ACTUELLE:
- Produit: {produit_nom} (ID: {produit_id})
- Entrepôt: {entrepot_nom}
- Stock actuel: {stock_actuel} unités
- Seuil minimum: {seuil_min} unités
- État: {"CRITIQUE - Stock sous le seuil minimum!" if stock_actuel < seuil_min else "Stock faible"}
{section_contexte}
HISTORIQUE DES MOUVEMENTS (contexte RAG):
{contexte_str}

TÂCHE: Génère une recommandation de réapprovisionnement.

RÉPONDS AU FORMAT JSON UNIQUEMENT:
{{
    "titre": "Titre court",
    "contenu": "Explication détaillée",
    "quantite_suggeree": nombre,
    "urgence": "critique|haute|moyenne|basse",
    "fournisseur_suggere": null,
    "confiance": 0.0 à 1.0
}}"""


def parser_reponse_llm(reponse: str, produit_nom: str,
                        stock_actuel: float, seuil_min: float) -> dict:
    """Parse la réponse JSON du LLM. Fallback règles métier si parsing échoue."""
    try:
        r = reponse.strip()
        for prefix in ["```json", "```"]:
            if r.startswith(prefix):
                r = r[len(prefix):]
        if r.endswith("```"):
            r = r[:-3]
        data = json.loads(r)
        return {
            "titre":               data.get("titre", f"Réapprovisionnement {produit_nom}"),
            "contenu":             data.get("contenu", "Recommandation générée par IA"),
            "quantite_suggeree":   data.get("quantite_suggeree"),
            "urgence":             data.get("urgence", "moyenne"),
            "fournisseur_suggere": data.get("fournisseur_suggere"),
            "confiance_score":     data.get("confiance", 0.7)
        }
    except Exception:
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

    stock_info   = await recuperer_stock(token, request.produit_id, request.entrepot_id)
    stock_actuel = request.stock_actuel or stock_info.get("quantite", 0)
    seuil_min    = request.seuil_min    or stock_info.get("produit", {}).get("seuil_alerte_min", 10)
    produit_nom  = stock_info.get("produit", {}).get("designation", f"Produit {request.produit_id}")
    entrepot_nom = stock_info.get("entrepot", {}).get("nom", f"Entrepôt {request.entrepot_id}")

    # RAG : recherche sémantique dans ChromaDB
    query       = f"historique mouvements produit {produit_nom} entrepôt {entrepot_nom}"
    contexte_rag = recherche_semantique(query, settings.RAG_TOP_K,
                                        request.produit_id, request.entrepot_id)

    # LLM : génération de la recommandation
    prompt       = construire_prompt(request.produit_id, produit_nom, entrepot_nom,
                                     stock_actuel, seuil_min, contexte_rag,
                                     request.contexte_supplementaire)
    llm_response = appeler_llm(prompt)
    result       = parser_reponse_llm(llm_response or "", produit_nom, stock_actuel, seuil_min)

    # Sauvegarde PostgreSQL
    recommandation = Recommandation(
        produit_id=request.produit_id, entrepot_id=request.entrepot_id,
        alerte_id=request.alerte_id,
        type=TypeRecommandation.REAPPROVISIONNEMENT,
        titre=result["titre"], contenu=result["contenu"],
        quantite_suggeree=result.get("quantite_suggeree"),
        fournisseur_suggere=result.get("fournisseur_suggere"),
        urgence=UrgenceLevel(result.get("urgence", "moyenne")),
        confiance_score=result.get("confiance_score", 0.5),
        sources_rag=[r["document"][:100] for r in contexte_rag[:3]],
        contexte_utilise={"stock_actuel": stock_actuel, "seuil_min": seuil_min,
                          "rag_documents": len(contexte_rag)},
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
        llm_resp = appeler_llm(prompt)
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
            urgence             = UrgenceLevel(result.get("urgence", "moyenne")),
            confiance_score     = result.get("confiance_score", 0.5),
            sources_rag         = [r2["document"][:100] for r2 in contexte_rag[:3]],
            contexte_utilise    = {"stock_actuel": stock_actuel, "seuil_min": seuil_min,
                                   "rejet_precedent": recommandation_id},
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


@router.post("/ia/question", response_model=QuestionResponse,
             summary="Poser une question libre à l'IA (RAG Q&A)")
async def route_question(
    request:      QuestionRequest,
    current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials:  HTTPAuthorizationCredentials = Depends(security),
):
    """
    Pose une question en langage naturel.
    L'IA cherche dans l'historique vectorisé (ChromaDB) les informations
    pertinentes, puis génère une réponse avec Mistral.

    Exemples de questions :
    - "Quel produit a eu le plus de sorties ce mois ?"
    - "Y a-t-il des mouvements suspects dans l'entrepôt 1 ?"
    - "Quand a eu lieu la dernière entrée du produit 2 ?"
    """
    start_time = time.time()

    # Auto-vectorisation si ChromaDB est vide
    await auto_vectoriser_si_vide(credentials.credentials)

    # Recherche sémantique dans ChromaDB
    contexte_rag = recherche_semantique(
        request.question, request.n_results,
        request.produit_id, request.entrepot_id
    )

    contexte_str = "\n".join([f"- {r['document']}" for r in contexte_rag]) \
                   if contexte_rag else "Aucun document trouvé dans la base vectorielle."

    prompt = f"""Tu es un assistant expert en gestion de stock pour une entreprise tunisienne.
Réponds en français, de manière claire et concise, en te basant uniquement sur le contexte fourni.

QUESTION DE L'UTILISATEUR:
{request.question}

CONTEXTE EXTRAIT DE L'HISTORIQUE (RAG):
{contexte_str}

Si le contexte ne contient pas assez d'informations pour répondre, dis-le clairement.
Ne génère pas de JSON. Réponds directement en texte naturel."""

    llm_response = appeler_llm(prompt)

    if not llm_response:
        reponse = (
            "Je n'ai pas pu générer une réponse (LLM indisponible). "
            f"Voici les {len(contexte_rag)} documents trouvés dans l'historique : "
            + " | ".join([r["document"][:80] for r in contexte_rag[:3]])
        ) if contexte_rag else "Aucune information trouvée dans l'historique vectorisé."
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


@router.get("/ia/stats", include_in_schema=False, summary="Statistiques ChromaDB + modèle")
async def route_stats(current_user: dict = Depends(get_current_gestionnaire_or_admin)):
    try:
        count = get_chroma_collection().count()
    except Exception:
        count = 0
    return {
        "collection_name":    settings.CHROMA_COLLECTION_NAME,
        "documents_count":    count,
        "embedding_model":    settings.EMBEDDING_MODEL,
        "embedding_dimension": settings.EMBEDDING_DIMENSION,
        "llm_model":          settings.LLM_MODEL,
        "llm_provider":       settings.LLM_PROVIDER,
        "rag_top_k":          settings.RAG_TOP_K,
    }
