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
    produit_id:              Optional[int]   = None
    entrepot_id:             Optional[int]   = None
    alerte_id:               Optional[int]   = None
    stock_actuel:            Optional[float] = None
    seuil_min:               Optional[float] = None
    contexte_supplementaire: Optional[str]   = None
    date_expiration:         Optional[str]   = None   # YYYY-MM-DD — pour calcul côté frontend


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
# PRÉVISIONS ML (Prophet / LinearRegression / Sliding Average)
# ══════════════════════════════════════════════════════════

class PrevisionProduit(BaseModel):
    produit_id:            int
    produit_nom:           str
    entrepot_id:           int
    entrepot_nom:          str
    stock_actuel:          float
    seuil_min:             float
    consommation_par_jour: float           # unités/jour prévues
    jours_avant_rupture:   float           # stock_actuel / conso_jour (9999 = stable)
    quantite_a_commander:  float           # conso * 30 jours
    urgence:               str             # critique / haute / moyenne / basse / stable
    tendance:              str             # hausse / baisse / stable
    recommandation:        Optional[str]  = None

    # ── Champs ML enrichis ────────────────────────────────
    methode_ml:   str            = "sliding_average"   # prophet | linear_regression | sliding_average
    confiance_ml: Optional[float] = None               # score 0.0→1.0 (ML uniquement)
    borne_inf:    Optional[float] = None               # borne basse 80% CI (Prophet uniquement)
    borne_sup:    Optional[float] = None               # borne haute 80% CI (Prophet uniquement)
    metriques_ml: Optional[Dict[str, Any]] = None      # MAE, RMSE, MAPE/R²


class PrevisionResponse(BaseModel):
    success:    bool
    previsions: List[PrevisionProduit]
    total:      int
    genere_le:  datetime
    methode:    str = "ML hybride : Prophet / Régression linéaire / Moyenne glissante"
    modeles_ml_disponibles: int = 0  # nb de produits avec un modèle ML entraîné


# ══════════════════════════════════════════════════════════
# ENTRAÎNEMENT ML
# ══════════════════════════════════════════════════════════

class MLTrainRequest(BaseModel):
    produit_ids:   Optional[List[int]] = None   # None = entraîner tous les produits
    entrepot_ids:  Optional[List[int]] = None
    force_retrain: bool                = False   # forcer ré-entraînement si modèle existe déjà


class MLTrainResultat(BaseModel):
    produit_id:  int
    entrepot_id: int
    success:     bool
    method:      Optional[str]  = None   # "prophet" | "linear_regression"
    metrics:     Optional[Dict[str, Any]] = None
    n_samples:   int            = 0
    message:     Optional[str]  = None


class MLTrainResponse(BaseModel):
    success:    bool
    entraines:  int             # nb de modèles entraînés avec succès
    echecs:     int             # nb d'échecs
    resultats:  List[MLTrainResultat]
    duree_ms:   int


class MLStatusResponse(BaseModel):
    modeles_disponibles: int
    dossier:             str
    modeles:             List[Dict[str, Any]]


# ══════════════════════════════════════════════════════════
# PROMOTION IA
# ══════════════════════════════════════════════════════════

class PromotionIARequest(BaseModel):
    produit_id:              int            = Field(..., gt=0)
    produit_nom:             Optional[str]  = None
    stock_actuel:            Optional[float] = None
    prix_actuel:             Optional[float] = None
    jours_avant_expiration:  Optional[int]  = None   # None = pas d'expiration connue
    categorie:               Optional[str]  = None
    contexte_supplementaire: Optional[str]  = None


class PromotionIAResponse(BaseModel):
    success:              bool
    recommandation_id:    int
    produit_id:           int
    produit_nom:          str
    pourcentage_suggere:  float   # ex: 25.0 = 25% de réduction
    prix_initial:         Optional[float] = None
    prix_promo_estime:    Optional[float] = None
    motif:                str     # explication courte (1-2 phrases)
    analyse_complete:     str     # texte complet de l'IA
    confiance_score:      float   # 0.0 → 1.0
    urgence:              str     # critique / haute / moyenne / basse
    temps_generation_ms:  int


# ══════════════════════════════════════════════════════════
# UTILITAIRES
# ══════════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    message: str
    success: bool = True
