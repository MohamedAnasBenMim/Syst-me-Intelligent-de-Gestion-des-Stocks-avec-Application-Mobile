# app/schemas.py — service_alertes/

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models import NiveauAlerte, StatutAlerte


# ═══════════════════════════════════════════════════════════
# SCHEMA DÉCLENCHEMENT ALERTE
# Appelé par Service Stock après chaque augmenter/diminuer
# ═══════════════════════════════════════════════════════════

class AlerteDeclenchement(BaseModel):
    """
    Schema reçu depuis Service Stock.
    Service Stock appelle POST /alertes/declencher après
    chaque augmenter/diminuer avec le nouveau niveau.

    Si niveau = normal → résoudre les alertes actives
    Si niveau != normal → créer une nouvelle alerte
    """
    produit_id       : int          = Field(..., gt=0)
    produit_nom      : Optional[str] = None
    entrepot_id      : int          = Field(..., gt=0)
    entrepot_nom     : Optional[str] = None
    niveau           : NiveauAlerte
    quantite_actuelle: float        = Field(..., ge=0)
    seuil_alerte_min : Optional[float] = None
    seuil_alerte_max : Optional[float] = None
    message          : Optional[str] = None


# ═══════════════════════════════════════════════════════════
# SCHEMAS ALERTE
# ═══════════════════════════════════════════════════════════

class AlerteResponse(BaseModel):
    """Schema retourné au client"""
    id                  : int
    niveau              : NiveauAlerte
    statut              : StatutAlerte
    produit_id          : int
    produit_nom         : Optional[str] = None
    entrepot_id         : int
    entrepot_nom        : Optional[str] = None
    quantite_actuelle   : float
    seuil_alerte_min    : Optional[float] = None
    seuil_alerte_max    : Optional[float] = None
    message             : Optional[str] = None
    notification_envoyee: bool
    traite_par          : Optional[int] = None
    traite_le           : Optional[datetime] = None
    created_at          : datetime
    updated_at          : Optional[datetime] = None

    model_config = {"from_attributes": True}


class AlerteUpdate(BaseModel):
    """
    Schema pour modifier le statut d'une alerte.
    Seul le statut est modifiable — les données
    de l'alerte sont figées au moment du déclenchement.
    """
    statut : StatutAlerte


class AlerteList(BaseModel):
    """Schema pour la liste paginée des alertes"""
    total   : int
    page    : int
    per_page: int
    alertes : list[AlerteResponse]


class AlerteStats(BaseModel):
    """
    Schema pour les statistiques des alertes.
    Utilisé dans le tableau de bord.
    """
    total_actives : int
    total_ruptures: int
    total_critiques: int
    total_surstocks: int
    total_traitees : int
    total_resolues : int


# ═══════════════════════════════════════════════════════════
# SCHEMAS GÉNÉRIQUES
# ═══════════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    message: str
    success: bool = True