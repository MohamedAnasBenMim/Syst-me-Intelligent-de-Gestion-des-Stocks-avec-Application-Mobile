# app/models.py — service_notification/

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum
from sqlalchemy.sql import func
from app.database import Base
import enum


# ── Enum type de notification ──────────────────────────────
class TypeNotification(str, enum.Enum):
    ALERTE_STOCK  = "alerte_stock"   # Stock critique / rupture / surstock
    REAPPRO       = "reappro"        # Demande de réapprovisionnement
    MOUVEMENT     = "mouvement"      # Nouveau mouvement enregistré
    SYSTEME       = "systeme"        # Notification système


# ── Enum canal d'envoi ─────────────────────────────────────
class CanalNotification(str, enum.Enum):
    EMAIL = "email"
    PUSH  = "push"
    WEB   = "web"


# ── Enum statut d'envoi ────────────────────────────────────
class StatutNotification(str, enum.Enum):
    EN_ATTENTE = "en_attente"  # Pas encore envoyée
    ENVOYEE    = "envoyee"     # Envoyée avec succès
    ECHEC      = "echec"       # Échec d'envoi


# ── Table notifications ────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"

    id      = Column(Integer, primary_key=True, index=True)

    # Type et canal
    type_notification  = Column(Enum(TypeNotification),   nullable=False)
    canal              = Column(Enum(CanalNotification),   nullable=False)
    statut             = Column(Enum(StatutNotification),
                                default=StatutNotification.EN_ATTENTE,
                                nullable=False)

    # Destinataire
    destinataire_id    = Column(Integer,      nullable=True)   # user_id
    destinataire_email = Column(String(200),  nullable=True)
    destinataire_nom   = Column(String(200),  nullable=True)

    # Contenu
    sujet              = Column(String(300),  nullable=False)
    contenu            = Column(Text,         nullable=False)
    contenu_html       = Column(Text,         nullable=True)   # version HTML email

    # Référence vers l'alerte concernée
    alerte_id          = Column(Integer,      nullable=True)
    niveau_alerte      = Column(String(50),   nullable=True)   # critique/rupture/surstock

    # Produit et entrepôt concernés (dénormalisés)
    produit_id         = Column(Integer,      nullable=True)
    produit_nom        = Column(String(200),  nullable=True)
    entrepot_id        = Column(Integer,      nullable=True)
    entrepot_nom       = Column(String(200),  nullable=True)

    # Erreur en cas d'échec
    erreur_message     = Column(Text,         nullable=True)

    # Timestamps
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    envoye_le          = Column(DateTime(timezone=True), nullable=True)