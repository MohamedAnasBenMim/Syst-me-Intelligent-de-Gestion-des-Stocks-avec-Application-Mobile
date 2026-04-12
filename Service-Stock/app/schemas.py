# app/schemas.py — service_stock/
# Validation des données JSON avec Pydantic

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


# ══════════════════════════════════════════════════════════
# ÉNUMÉRATIONS
# ══════════════════════════════════════════════════════════

class NiveauAlerte(str, Enum):
    normal   = "normal"
    critique = "critique"
    rupture  = "rupture"
    surstock = "surstock"


# ══════════════════════════════════════════════════════════
# SCHEMAS PRODUIT
# ══════════════════════════════════════════════════════════

class ProduitCreate(BaseModel):
    reference:        Optional[str]  = Field(None, min_length=2, max_length=50,
                                            description="Générée automatiquement si non fournie")
    designation:      str            = Field(..., min_length=2, max_length=200)
    categorie:        Optional[str]  = None
    unite_mesure:     str            = "unite"
    prix_unitaire:    float          = Field(default=0.0, ge=0)
    seuil_alerte_min: float          = Field(default=10.0,   ge=0)
    seuil_alerte_max: float          = Field(default=1000.0, ge=0)
    date_fabrication: Optional[date]  = Field(None, description="Date de fabrication du produit")
    date_expiration:  Optional[date]  = Field(None, description="Date d'expiration du produit")
    en_promotion:     bool            = Field(False, description="Produit en promotion")
    prix_promo:       Optional[float] = Field(None, ge=0, description="Prix promotionnel")

    @field_validator("seuil_alerte_max")
    @classmethod
    def max_superieur_min(cls, v, info):
        # seuil_alerte_max doit être > seuil_alerte_min
        if "seuil_alerte_min" in info.data and v <= info.data["seuil_alerte_min"]:
            raise ValueError("seuil_max doit être supérieur à seuil_min")
        return v

    @field_validator("date_expiration")
    @classmethod
    def expiration_future(cls, v):
        if v is not None and v <= date.today():
            raise ValueError(
                "La date d'expiration doit être strictement postérieure à aujourd'hui"
            )
        return v

    @field_validator("reference")
    @classmethod
    def reference_uppercase(cls, v):
        # Nettoie et met en majuscules la référence (si fournie)
        if v is not None:
            return v.upper().strip()
        return v


class ProduitUpdate(BaseModel):
    designation:      Optional[str]   = None
    categorie:        Optional[str]   = None
    unite_mesure:     Optional[str]   = None
    prix_unitaire:    Optional[float] = Field(None, ge=0)
    seuil_alerte_min: Optional[float] = Field(None, ge=0)
    seuil_alerte_max: Optional[float] = Field(None, ge=0)
    date_fabrication: Optional[date]  = None
    date_expiration:  Optional[date]  = None
    en_promotion:     Optional[bool]  = None
    prix_promo:       Optional[float] = Field(None, ge=0)
    est_actif:        Optional[bool]  = None


class ProduitResponse(BaseModel):
    id:               int
    reference:        str
    designation:      str
    categorie:        Optional[str]
    unite_mesure:     str
    prix_unitaire:    float
    seuil_alerte_min: float
    seuil_alerte_max: float
    date_fabrication: Optional[date]     = None
    date_expiration:  Optional[date]     = None
    en_promotion:     bool               = False
    prix_promo:       Optional[float]    = None
    est_actif:        bool
    created_at:       datetime
    updated_at:       Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════
# SCHEMAS STOCK
# ══════════════════════════════════════════════════════════

class StockResponse(BaseModel):
    id:            int
    produit_id:    int
    entrepot_id:   int
    quantite:      float
    niveau_alerte: str
    updated_at:    Optional[datetime]
    produit:       Optional[ProduitResponse] = None

    model_config = {"from_attributes": True}


class StockAlertResponse(BaseModel):
    total_alertes: int
    stocks:        List[StockResponse]


# ══════════════════════════════════════════════════════════
# SCHEMAS AUGMENTER / DIMINUER
# Appelés exclusivement par Service Mouvement
# ══════════════════════════════════════════════════════════

class StockAugmenter(BaseModel):
    """
    Appelé par Service Mouvement lors d'une ENTREE ou TRANSFERT (destination).
    Service Mouvement envoie :
      - produit_id    : quel produit augmenter
      - entrepot_id   : dans quel entrepôt
      - quantite      : de combien augmenter
      - mouvement_ref : référence du mouvement pour traçabilité
    """
    produit_id    : int   = Field(..., gt=0)
    entrepot_id   : int   = Field(..., gt=0)
    quantite      : float = Field(..., gt=0, description="Quantité à ajouter au stock")
    mouvement_ref : Optional[str] = Field(None, description="Référence du mouvement pour traçabilité")


class StockDiminuer(BaseModel):
    """
    Appelé par Service Mouvement lors d'une SORTIE ou TRANSFERT (source).
    Service Mouvement envoie :
      - produit_id    : quel produit diminuer
      - entrepot_id   : dans quel entrepôt
      - quantite      : de combien diminuer
      - mouvement_ref : référence du mouvement pour traçabilité
    Service Stock vérifie que stock >= quantite avant de diminuer.
    """
    produit_id    : int   = Field(..., gt=0)
    entrepot_id   : int   = Field(..., gt=0)
    quantite      : float = Field(..., gt=0, description="Quantité à retirer du stock")
    mouvement_ref : Optional[str] = Field(None, description="Référence du mouvement pour traçabilité")


class StockOperationResponse(BaseModel):
    """
    Réponse retournée après augmenter ou diminuer.
    Service Mouvement utilise quantite_apres pour l'enregistrer dans l'historique.
    """
    produit_id     : int
    entrepot_id    : int
    quantite_avant : float
    quantite_apres : float
    niveau_alerte  : str
    message        : str

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════
# SCHEMAS GÉNÉRIQUES
# ══════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════
# SCHEMAS PROMOTION
# ══════════════════════════════════════════════════════════

class PromotionCreate(BaseModel):
    produit_id:           int            = Field(..., gt=0)
    pourcentage_reduction: float         = Field(..., gt=0, le=100,
                                                 description="Pourcentage de réduction (1-100)")
    date_debut:           date           = Field(default_factory=date.today)
    date_fin:             Optional[date] = Field(None, description="Laisser vide = pas de date limite")
    motif:                Optional[str]  = Field(None, max_length=300,
                                                 description="Ex: Expiration proche, Liquidation saisonnière")
    recommandation_ia_id: Optional[int]  = Field(None,
                                                 description="ID recommandation IA si appliquée depuis l'IA")

    @field_validator("date_fin")
    @classmethod
    def fin_apres_debut(cls, v, info):
        if v and "date_debut" in info.data and v < info.data["date_debut"]:
            raise ValueError("date_fin doit être postérieure à date_debut")
        return v


class PromotionUpdate(BaseModel):
    pourcentage_reduction: Optional[float] = Field(None, gt=0, le=100)
    date_fin:              Optional[date]  = None
    motif:                 Optional[str]   = Field(None, max_length=300)
    est_active:            Optional[bool]  = None


class PromotionResponse(BaseModel):
    id:                   int
    produit_id:           int
    produit_nom:          Optional[str]    = None
    produit_reference:    Optional[str]    = None
    pourcentage_reduction: float
    prix_initial:         float
    prix_promo:           float
    motif:                Optional[str]    = None
    date_debut:           date
    date_fin:             Optional[date]   = None
    recommandation_ia_id: Optional[int]   = None
    creee_par_id:         Optional[int]   = None
    creee_par_nom:        Optional[str]   = None
    est_active:           bool
    created_at:           datetime
    updated_at:           Optional[datetime] = None

    model_config = {"from_attributes": True}


class PromotionList(BaseModel):
    total:      int
    page:       int
    per_page:   int
    promotions: List[PromotionResponse]


class AppliquerIARequest(BaseModel):
    recommandation_ia_id: int   = Field(..., gt=0,
                                        description="ID de la recommandation IA à appliquer")
    pourcentage_reduction: float = Field(..., gt=0, le=100,
                                         description="Pourcentage proposé par l'IA")
    date_fin:             Optional[date] = None


# ══════════════════════════════════════════════════════════
# SCHEMAS GÉNÉRIQUES
# ══════════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    message: str
    success: bool = True