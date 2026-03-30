# app/models.py — service_stock/
# Tables PostgreSQL via SQLAlchemy

from sqlalchemy import (
    Column, Integer, String, Float,
    DateTime, ForeignKey, Boolean, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ══════════════════════════════════════════════════════════
# TABLE : Produits
# ══════════════════════════════════════════════════════════
class Produit(Base):
    __tablename__ = "produits"

    id               = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reference        = Column(String(50),  unique=True,  nullable=False, index=True)
    designation      = Column(String(200), nullable=False)
    categorie        = Column(String(100), nullable=True)
    unite_mesure     = Column(String(20),  default="unite",   nullable=False)
    prix_unitaire    = Column(Float,       default=0.0,       nullable=False)
    seuil_alerte_min = Column(Float,       default=10.0,      nullable=False)
    seuil_alerte_max = Column(Float,       default=1000.0,    nullable=False)
    est_actif        = Column(Boolean,     default=True,      nullable=False)
    created_at       = Column(DateTime,    server_default=func.now(), nullable=False)
    updated_at       = Column(DateTime,    server_default=func.now(), onupdate=func.now())

    # ── Relation ───────────────────────────────────────────
    # Supprimé : mouvements → déplacé dans Service Mouvement (sgs_mouvement)
    stocks = relationship("Stock", back_populates="produit", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Produit id={self.id} ref={self.reference}>"


# ══════════════════════════════════════════════════════════
# TABLE : Stocks (quantités par entrepôt)
# ══════════════════════════════════════════════════════════
class Stock(Base):
    __tablename__ = "stocks"

    id            = Column(Integer, primary_key=True, index=True, autoincrement=True)
    produit_id    = Column(Integer, ForeignKey("produits.id", ondelete="CASCADE"), nullable=False)
    entrepot_id   = Column(Integer, nullable=False)
    quantite      = Column(Float,   default=0.0,    nullable=False)
    niveau_alerte = Column(String(20), default="normal", nullable=False)
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ── Relation ───────────────────────────────────────────
    produit = relationship("Produit", back_populates="stocks")

    # ── Index unique : un seul stock par produit+entrepôt ──
    __table_args__ = (
        Index("ix_stock_produit_entrepot", "produit_id", "entrepot_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Stock produit={self.produit_id} entrepot={self.entrepot_id} qte={self.quantite}>"


# ══════════════════════════════════════════════════════════
# NOTE : Table Mouvement supprimée de ce service
# Les mouvements sont désormais gérés exclusivement par
# Service Mouvement (port 8004) dans la base sgs_mouvement
# Service Stock expose uniquement :
#   PATCH /api/v1/stocks/augmenter ← appelé par Service Mouvement
#   PATCH /api/v1/stocks/diminuer  ← appelé par Service Mouvement
# ══════════════════════════════════════════════════════════