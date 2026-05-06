# app/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime



# ═══════════════════════════════════════════════════════════
# SCHEMAS RÉPONSES GÉNÉRIQUES
# ═══════════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    """Réponse simple avec message de succès"""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Réponse retournée en cas d'erreur"""
    detail: str
    success: bool = False


# ═══════════════════════════════════════════════════════════
# SCHEMAS DÉPÔT
# ═══════════════════════════════════════════════════════════

class DepotCreate(BaseModel):
    nom:               str            = Field(..., min_length=1, max_length=200)
    code:              str            = Field(..., min_length=1, max_length=50)
    depot_type:        str            = Field(default="REGIONAL", pattern="^(CENTRAL|REGIONAL)$")
    adresse:           Optional[str]  = None
    ville:             Optional[str]  = None
    latitude:          Optional[float]= None
    longitude:         Optional[float]= None
    capacite_max:      float          = Field(default=1000.0, gt=0)
    responsable:       Optional[str]  = None
    telephone:         Optional[str]  = None
    email_responsable: Optional[str]  = None
    notes:             Optional[str]  = None


class DepotUpdate(BaseModel):
    nom:               Optional[str]  = None
    depot_type:        Optional[str]  = Field(default=None, pattern="^(CENTRAL|REGIONAL)$")
    adresse:           Optional[str]  = None
    ville:             Optional[str]  = None
    latitude:          Optional[float]= None
    longitude:         Optional[float]= None
    capacite_max:      Optional[float]= Field(default=None, gt=0)
    responsable:       Optional[str]  = None
    telephone:         Optional[str]  = None
    email_responsable: Optional[str]  = None
    notes:             Optional[str]  = None
    est_actif:         Optional[bool] = None


class DepotResponse(BaseModel):
    id:                int
    nom:               str
    code:              str
    depot_type:        str
    adresse:           Optional[str]  = None
    ville:             Optional[str]  = None
    latitude:          Optional[float]= None
    longitude:         Optional[float]= None
    capacite_max:      float
    capacite_utilisee: float
    taux_occupation:   float
    responsable:       Optional[str]  = None
    telephone:         Optional[str]  = None
    email_responsable: Optional[str]  = None
    notes:             Optional[str]  = None
    est_actif:         bool
    nb_magasins:       int            = 0
    created_at:        datetime

    model_config = {"from_attributes": True}


class DepotList(BaseModel):
    total:  int
    depots: List[DepotResponse]


# ═══════════════════════════════════════════════════════════
# SCHEMAS MAGASIN
# ═══════════════════════════════════════════════════════════

class MagasinCreate(BaseModel):
    nom:               str            = Field(..., min_length=1, max_length=200)
    code:              str            = Field(..., min_length=1, max_length=50)
    depot_id:          int            = Field(..., gt=0)
    adresse:           Optional[str]  = None
    ville:             Optional[str]  = None
    latitude:          Optional[float]= None
    longitude:         Optional[float]= None
    capacite_max:      float          = Field(default=500.0, gt=0)
    responsable:       Optional[str]  = None
    telephone:         Optional[str]  = None
    email_responsable: Optional[str]  = None
    horaires_ouverture:Optional[str]  = None
    notes:             Optional[str]  = None


class MagasinUpdate(BaseModel):
    nom:               Optional[str]  = None
    depot_id:          Optional[int]  = Field(default=None, gt=0)
    adresse:           Optional[str]  = None
    ville:             Optional[str]  = None
    latitude:          Optional[float]= None
    longitude:         Optional[float]= None
    capacite_max:      Optional[float]= Field(default=None, gt=0)
    responsable:       Optional[str]  = None
    telephone:         Optional[str]  = None
    email_responsable: Optional[str]  = None
    horaires_ouverture:Optional[str]  = None
    notes:             Optional[str]  = None
    est_actif:         Optional[bool] = None


class MagasinResponse(BaseModel):
    id:                int
    nom:               str
    code:              str
    depot_id:          int
    depot_nom:         Optional[str]  = None
    depot_code:        Optional[str]  = None
    adresse:           Optional[str]  = None
    ville:             Optional[str]  = None
    latitude:          Optional[float]= None
    longitude:         Optional[float]= None
    capacite_max:      float
    capacite_utilisee: float
    taux_occupation:   float
    responsable:       Optional[str]  = None
    telephone:         Optional[str]  = None
    email_responsable: Optional[str]  = None
    horaires_ouverture:Optional[str]  = None
    notes:             Optional[str]  = None
    est_actif:         bool
    created_at:        datetime

    model_config = {"from_attributes": True}


class MagasinList(BaseModel):
    total:    int
    magasins: List[MagasinResponse]


# ═══════════════════════════════════════════════════════════
# SCHEMAS TRANSFERT
# ═══════════════════════════════════════════════════════════

class TransfertDepotMagasin(BaseModel):
    depot_id:   int            = Field(..., gt=0, description="ID du dépôt source")
    magasin_id: int            = Field(..., gt=0, description="ID du magasin destination")
    produit_id: int            = Field(..., gt=0)
    quantite:   float          = Field(..., gt=0)
    reference:  Optional[str]  = None
    notes:      Optional[str]  = None


class TransfertMagasinDepot(BaseModel):
    magasin_id: int            = Field(..., gt=0, description="ID du magasin source")
    depot_id:   int            = Field(..., gt=0, description="ID du dépôt destination")
    produit_id: int            = Field(..., gt=0)
    quantite:   float          = Field(..., gt=0)
    motif:      Optional[str]  = None
    notes:      Optional[str]  = None


class TransfertResponse(BaseModel):
    success:          bool
    message:          str
    quantite_depot:   Optional[float] = None
    quantite_magasin: Optional[float] = None


class CapaciteUpdate(BaseModel):
    delta: float = Field(..., description="Variation de capacite_utilisee (positif = augmenter, négatif = diminuer)")