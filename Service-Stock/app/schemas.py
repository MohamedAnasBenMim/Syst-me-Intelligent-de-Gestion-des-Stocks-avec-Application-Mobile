# app/schemas.py — service_stock/
# Validation des données JSON avec Pydantic

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
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
    reference:        str            = Field(..., min_length=2, max_length=50)
    designation:      str            = Field(..., min_length=2, max_length=200)
    categorie:        Optional[str]  = None
    unite_mesure:     str            = "unite"
    prix_unitaire:    float          = Field(default=0.0, ge=0)
    seuil_alerte_min: float          = Field(default=10.0,   ge=0)
    seuil_alerte_max: float          = Field(default=1000.0, ge=0)

    @field_validator("seuil_alerte_max")
    @classmethod
    def max_superieur_min(cls, v, info):
        # seuil_alerte_max doit être > seuil_alerte_min
        if "seuil_alerte_min" in info.data and v <= info.data["seuil_alerte_min"]:
            raise ValueError("seuil_max doit être supérieur à seuil_min")
        return v

    @field_validator("reference")
    @classmethod
    def reference_uppercase(cls, v):
        # Nettoie et met en majuscules la référence
        return v.upper().strip()


class ProduitUpdate(BaseModel):
    designation:      Optional[str]   = None
    categorie:        Optional[str]   = None
    unite_mesure:     Optional[str]   = None
    prix_unitaire:    Optional[float] = Field(None, ge=0)
    seuil_alerte_min: Optional[float] = Field(None, ge=0)
    seuil_alerte_max: Optional[float] = Field(None, ge=0)
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

class MessageResponse(BaseModel):
    message: str
    success: bool = True