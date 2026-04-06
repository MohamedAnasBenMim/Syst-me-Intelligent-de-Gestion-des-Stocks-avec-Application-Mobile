# app/models.py — service_alertes/

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from app.database import Base
import enum


# ── Enum niveau d'alerte ───────────────────────────────────────
class NiveauAlerte(str, enum.Enum):
    NORMAL             = "NORMAL"
    CRITIQUE           = "CRITIQUE"
    RUPTURE            = "RUPTURE"
    SURSTOCK           = "SURSTOCK"
    EXPIRATION_PROCHE  = "EXPIRATION_PROCHE"


# ── Enum statut de l'alerte ────────────────────────────────────
class StatutAlerte(str, enum.Enum):
    ACTIVE   = "ACTIVE"    # Alerte déclenchée, non traitée
    TRAITEE  = "TRAITEE"   # Alerte prise en charge
    RESOLUE  = "RESOLUE"   # Problème résolu, stock revenu normal
    IGNOREE  = "IGNOREE"   # Alerte ignorée par le responsable


# ── Table alertes ──────────────────────────────────────────────
class Alerte(Base):
    __tablename__ = "alertes"

    id               = Column(Integer, primary_key=True, index=True)

    # Niveau et statut
    niveau           = Column(Enum(NiveauAlerte), nullable=False)
    statut           = Column(Enum(StatutAlerte),
                               default=StatutAlerte.ACTIVE, nullable=False)

    # Produit concerné (référence vers Service Stock — pas de ForeignKey)
    produit_id       = Column(Integer, nullable=False, index=True)
    produit_nom      = Column(String(200), nullable=True)   # dénormalisé

    # Entrepôt concerné (référence vers Service Warehouse — pas de ForeignKey)
    entrepot_id      = Column(Integer, nullable=False, index=True)
    entrepot_nom     = Column(String(200), nullable=True)   # dénormalisé

    # Quantités au moment de l'alerte
    quantite_actuelle  = Column(Float, nullable=False)
    seuil_alerte_min   = Column(Float, nullable=True)
    seuil_alerte_max   = Column(Float, nullable=True)

    # Message descriptif
    message          = Column(String(500), nullable=True)

    # Notification envoyée ?
    notification_envoyee = Column(Boolean, default=False, nullable=False)

    # Utilisateur qui a traité l'alerte
    traite_par       = Column(Integer, nullable=True)   # user_id
    traite_le        = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())