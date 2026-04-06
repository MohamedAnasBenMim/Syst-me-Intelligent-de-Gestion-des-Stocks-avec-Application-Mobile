# app/models.py — service_stock/
# Tables PostgreSQL via SQLAlchemy

from sqlalchemy import (
    Column, Integer, String, Float,
    DateTime, Date, ForeignKey, Boolean, Index
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
    prix_unitaire        = Column(Float,   default=0.0,    nullable=False)
    seuil_alerte_min     = Column(Float,   default=10.0,   nullable=False)
    seuil_alerte_max     = Column(Float,   default=1000.0, nullable=False)
    date_fabrication     = Column(Date,    nullable=True)
    date_expiration      = Column(Date,    nullable=True)
    # ── Promotion ──────────────────────────────────────────
    en_promotion         = Column(Boolean, default=False,  nullable=False)
    prix_promo           = Column(Float,   nullable=True)   # calculé automatiquement
    est_actif            = Column(Boolean, default=True,   nullable=False)
    created_at           = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at           = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ── Relations ──────────────────────────────────────────
    stocks     = relationship("Stock",     back_populates="produit", cascade="all, delete-orphan")
    promotions = relationship("Promotion", back_populates="produit", cascade="all, delete-orphan")

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
# TABLE : Promotions
# ══════════════════════════════════════════════════════════
class Promotion(Base):
    __tablename__ = "promotions"

    id                   = Column(Integer, primary_key=True, index=True, autoincrement=True)
    produit_id           = Column(Integer, ForeignKey("produits.id", ondelete="CASCADE"),
                                  nullable=False, index=True)

    # Données de la promotion
    pourcentage_reduction = Column(Float,       nullable=False)          # ex: 40.0 → 40%
    prix_initial          = Column(Float,       nullable=False)          # prix_unitaire au moment de création
    prix_promo            = Column(Float,       nullable=False)          # prix_initial * (1 - %)
    motif                 = Column(String(300), nullable=True)           # ex: "Expiration proche"
    date_debut            = Column(Date,        nullable=False)
    date_fin              = Column(Date,        nullable=True)           # null = pas de date limite

    # Lien optionnel vers la recommandation IA qui a suggéré la promo
    recommandation_ia_id  = Column(Integer,     nullable=True)

    # Qui a créé la promotion
    creee_par_id          = Column(Integer,     nullable=True)
    creee_par_nom         = Column(String(200), nullable=True)

    est_active            = Column(Boolean,     default=True, nullable=False)
    created_at            = Column(DateTime,    server_default=func.now(), nullable=False)
    updated_at            = Column(DateTime,    server_default=func.now(), onupdate=func.now())

    # ── Relation ───────────────────────────────────────────
    produit = relationship("Produit", back_populates="promotions")

    def __repr__(self) -> str:
        return f"<Promotion produit={self.produit_id} -{self.pourcentage_reduction}% actif={self.est_active}>"


# ══════════════════════════════════════════════════════════
# NOTE : Table Mouvement supprimée de ce service
# Les mouvements sont désormais gérés exclusivement par
# Service Mouvement (port 8004) dans la base sgs_mouvement
# Service Stock expose uniquement :
#   PATCH /api/v1/stocks/augmenter ← appelé par Service Mouvement
#   PATCH /api/v1/stocks/diminuer  ← appelé par Service Mouvement
# ══════════════════════════════════════════════════════════