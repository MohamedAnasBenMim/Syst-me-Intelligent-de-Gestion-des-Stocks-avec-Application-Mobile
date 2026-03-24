# app/schemas.py — service_notification/

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from app.models import TypeNotification, CanalNotification, StatutNotification


# ═══════════════════════════════════════════════════════════
# SCHEMA ENVOI NOTIFICATION
# Reçu depuis Service Alertes
# ═══════════════════════════════════════════════════════════

class NotificationEnvoyer(BaseModel):
    """
    Schema reçu depuis Service Alertes.
    Service Alertes appelle POST /notifications/envoyer
    après chaque alerte déclenchée.
    """
    type              : TypeNotification = TypeNotification.ALERTE_STOCK
    niveau            : Optional[str]    = None   # critique / rupture / surstock
    produit_id        : Optional[int]    = None
    produit_nom       : Optional[str]    = None
    entrepot_id       : Optional[int]    = None
    entrepot_nom      : Optional[str]    = None
    quantite          : Optional[float]  = None
    message           : Optional[str]    = None
    alerte_id         : Optional[int]    = None


# ═══════════════════════════════════════════════════════════
# SCHEMAS NOTIFICATION
# ═══════════════════════════════════════════════════════════

class NotificationResponse(BaseModel):
    """Schema retourné au client"""
    id                 : int
    type_notification  : TypeNotification
    canal              : CanalNotification
    statut             : StatutNotification
    destinataire_email : Optional[str]  = None
    destinataire_nom   : Optional[str]  = None
    sujet              : str
    niveau_alerte      : Optional[str]  = None
    produit_id         : Optional[int]  = None
    produit_nom        : Optional[str]  = None
    entrepot_id        : Optional[int]  = None
    entrepot_nom       : Optional[str]  = None
    alerte_id          : Optional[int]  = None
    erreur_message     : Optional[str]  = None
    created_at         : datetime
    envoye_le          : Optional[datetime] = None

    model_config = {"from_attributes": True}


class NotificationList(BaseModel):
    """Schema pour la liste paginée"""
    total         : int
    page          : int
    per_page      : int
    notifications : list[NotificationResponse]


class NotificationStats(BaseModel):
    """Statistiques pour le tableau de bord"""
    total_envoyees  : int
    total_echecs    : int
    total_en_attente: int
    total_email     : int
    total_push      : int
    total_web       : int


# ═══════════════════════════════════════════════════════════
# SCHEMAS GÉNÉRIQUES
# ═══════════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    message: str
    success: bool = True