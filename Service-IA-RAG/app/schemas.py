# app/schemas.py — service_ia_rag/

from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from app.models import TypeRecommandation, StatutRecommandation, UrgenceLevel


# ══════════════════════════════════════════════════════════
# VECTORISATION / EMBEDDING
# ══════════════════════════════════════════════════════════

class VectoriserRequest(BaseModel):
    produit_id:   Optional[int]      = None
    entrepot_id:  Optional[int]      = None
    date_debut:   Optional[datetime] = None
    date_fin:     Optional[datetime] = None
    force_update: bool               = False


class VectoriserResponse(BaseModel):
    success:             bool
    message:             str
    documents_traites:   int
    chunks_crees:        int
    temps_traitement_ms: int
    collection_stats:    Dict[str, Any] = {}


# ══════════════════════════════════════════════════════════
# RECOMMANDATION
# ══════════════════════════════════════════════════════════

class RecommandationRequest(BaseModel):
    produit_id:              int
    entrepot_id:             int
    alerte_id:               Optional[int]   = None
    stock_actuel:            Optional[float] = None
    seuil_min:               Optional[float] = None
    contexte_supplementaire: Optional[str]   = None


class RecommandationResponse(BaseModel):
    success:             bool
    recommandation_id:   int
    titre:               str
    contenu:             str
    quantite_suggeree:   Optional[float]
    fournisseur_suggere: Optional[str]
    urgence:             str
    confiance_score:     float
    sources:             List[str] = []
    temps_generation_ms: int
    message:             str


class RecommandationDetail(BaseModel):
    id:                  int
    produit_id:          int
    entrepot_id:         Optional[int]
    alerte_id:           Optional[int]
    type:                str
    titre:               str
    contenu:             str
    quantite_suggeree:   Optional[float]
    fournisseur_suggere: Optional[str]
    urgence:             str
    confiance_score:     float
    statut:              str
    temps_generation_ms: Optional[int]
    sources:             Optional[List[str]]        = None
    contexte:            Optional[Dict[str, Any]]   = None
    created_at:          datetime
    updated_at:          Optional[datetime]

    model_config = {"from_attributes": True}


class RecommandationListResponse(BaseModel):
    recommandations: List[RecommandationDetail]
    total:           int
    page:            int
    per_page:        int
    pages:           int


# ══════════════════════════════════════════════════════════
# FEEDBACK
# ══════════════════════════════════════════════════════════

class FeedbackRequest(BaseModel):
    rating:          Optional[int]   = Field(None, ge=1, le=5)
    comment:         Optional[str]   = None
    action_taken:    Optional[str]   = None
    quantite_reelle: Optional[float] = None


# ══════════════════════════════════════════════════════════
# RECHERCHE SÉMANTIQUE
# ══════════════════════════════════════════════════════════

class SearchResult(BaseModel):
    document: str
    score:    float
    metadata: Dict[str, Any] = {}


class SearchResponse(BaseModel):
    success: bool
    query:   str
    results: List[SearchResult]
    total:   int


# ══════════════════════════════════════════════════════════
# QUESTION LIBRE (RAG Q&A)
# ══════════════════════════════════════════════════════════

class QuestionRequest(BaseModel):
    question:    str
    produit_id:  Optional[int] = None
    entrepot_id: Optional[int] = None
    n_results:   int           = Field(default=5, ge=1, le=20)


class QuestionResponse(BaseModel):
    success:             bool
    question:            str
    reponse:             str
    sources:             List[str] = []
    documents_utilises:  int
    temps_generation_ms: int


# ══════════════════════════════════════════════════════════
# UTILITAIRES
# ══════════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    message: str
    success: bool = True
