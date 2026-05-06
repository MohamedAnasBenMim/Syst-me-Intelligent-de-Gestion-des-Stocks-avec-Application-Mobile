# app/models.py — service_stock/
# Tables PostgreSQL via SQLAlchemy

from sqlalchemy import (
    Column, Integer, String, Float,
    DateTime, Date, ForeignKey, Boolean, Index, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ══════════════════════════════════════════════════════════
# TABLE : Fournisseurs
# ══════════════════════════════════════════════════════════
class Fournisseur(Base):
    __tablename__ = "fournisseurs"

    id                    = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom                   = Column(String(200), nullable=False)
    contact_personne      = Column(String(200), nullable=True)
    telephone             = Column(String(50),  nullable=True)
    email                 = Column(String(200), nullable=True)
    adresse               = Column(Text,        nullable=True)
    conditions_paiement   = Column(String(200), nullable=True)
    delai_livraison_jours = Column(Integer,     nullable=True)
    note                  = Column(Float,       nullable=True)   # rating 0-5
    est_actif             = Column(Boolean,     default=True,  nullable=False)
    created_at            = Column(DateTime,    server_default=func.now(), nullable=False)
    updated_at            = Column(DateTime,    server_default=func.now(), onupdate=func.now())

    # ── Relations ──────────────────────────────────────────
    produit_fournisseurs = relationship("ProduitFournisseur", back_populates="fournisseur",
                                        cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Fournisseur id={self.id} nom={self.nom}>"


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
    prix_unitaire    = Column(Float,       default=0.0,    nullable=False)

    # ── Classification & Prix ──────────────────────────────
    prix_achat       = Column(Float,       nullable=True)   # prix d'achat auprès du fournisseur
    prix_vente       = Column(Float,       nullable=True)   # prix de vente au client
    marge_calculee   = Column(Float,       nullable=True)   # ((prix_vente-prix_achat)/prix_achat)*100

    # CONSOMMABLE (alimentaire, hygiène…) ou NON_CONSOMMABLE (électronique, mobilier…)
    type_produit     = Column(String(20),  default="CONSOMMABLE", nullable=False)

    # OCCASIONNEL (mariage, ramadan…) / SAISONNIER (été, hiver…) / REGULIER
    pattern_vente    = Column(String(20),  nullable=True)

    # Champs saison/occasion
    mois_debut_vente      = Column(Integer, nullable=True)   # 1-12
    mois_fin_vente        = Column(Integer, nullable=True)   # 1-12
    jours_pour_vendre     = Column(Integer, nullable=True)   # délai moyen de vente
    meilleur_moment_achat = Column(String(100), nullable=True)

    # ── Seuils et alertes ─────────────────────────────────
    seuil_alerte_min     = Column(Float,   default=10.0,   nullable=False)
    seuil_alerte_max     = Column(Float,   default=1000.0, nullable=False)
    date_fabrication     = Column(Date,    nullable=True)
    date_expiration      = Column(Date,    nullable=True)

    # ── Promotion ──────────────────────────────────────────
    en_promotion         = Column(Boolean, default=False,  nullable=False)
    prix_promo           = Column(Float,   nullable=True)
    est_actif            = Column(Boolean, default=True,   nullable=False)
    created_at           = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at           = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ── Relations ──────────────────────────────────────────
    stocks               = relationship("Stock",              back_populates="produit",
                                        cascade="all, delete-orphan")
    promotions           = relationship("Promotion",          back_populates="produit",
                                        cascade="all, delete-orphan")
    produit_fournisseurs = relationship("ProduitFournisseur", back_populates="produit",
                                        cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Produit id={self.id} ref={self.reference}>"


# ══════════════════════════════════════════════════════════
# TABLE : ProduitFournisseur (liaison many-to-many)
# ══════════════════════════════════════════════════════════
class ProduitFournisseur(Base):
    __tablename__ = "produit_fournisseurs"

    produit_id     = Column(Integer, ForeignKey("produits.id",     ondelete="CASCADE"), primary_key=True)
    fournisseur_id = Column(Integer, ForeignKey("fournisseurs.id", ondelete="CASCADE"), primary_key=True)
    prix_achat     = Column(Float,   nullable=True)   # prix spécifique à ce fournisseur
    est_prefere    = Column(Boolean, default=False)
    created_at     = Column(DateTime, server_default=func.now())

    # ── Relations ──────────────────────────────────────────
    produit     = relationship("Produit",     back_populates="produit_fournisseurs")
    fournisseur = relationship("Fournisseur", back_populates="produit_fournisseurs")

    def __repr__(self) -> str:
        return f"<ProduitFournisseur produit={self.produit_id} fournisseur={self.fournisseur_id}>"


# ══════════════════════════════════════════════════════════
# TABLE : Stocks (quantités par dépôt/magasin)
# Hiérarchie : Dépôt → Magasin
# entrepot_id = champ dénormalisé : = depot_id (si DEPOT) ou magasin_id (si MAGASIN)
# ══════════════════════════════════════════════════════════
class Stock(Base):
    __tablename__ = "stocks"

    id            = Column(Integer, primary_key=True, index=True, autoincrement=True)
    produit_id    = Column(Integer, ForeignKey("produits.id", ondelete="CASCADE"), nullable=False)
    entrepot_id   = Column(Integer, nullable=True)   # dénormalisé : = depot_id ou magasin_id
    quantite      = Column(Float,   default=0.0,    nullable=False)
    niveau_alerte = Column(String(20), default="normal", nullable=False)

    # ── Traçabilité par lot ────────────────────────────────
    numero_lot        = Column(String(100), nullable=True)
    date_fabrication  = Column(Date,        nullable=True)
    date_expiration   = Column(Date,        nullable=True)
    date_reception    = Column(Date,        nullable=True)

    # ── Localisation séparée DÉPÔT / MAGASIN ─────────────
    # location_type = "DEPOT" ou "MAGASIN" (null = ancien système entrepot_id)
    location_type  = Column(String(20),  nullable=True)
    depot_id       = Column(Integer,     nullable=True)   # référence vers Service-Warehouse.depots
    magasin_id     = Column(Integer,     nullable=True)   # référence vers Service-Warehouse.magasins
    stock_type     = Column(String(20),  nullable=True)   # "DEPOT_STOCK" ou "CURRENT_STOCK"
    emplacement    = Column(String(100), nullable=True)   # ex: "Allée A, Rayon 3, Bac 12"
    fournisseur_id = Column(Integer,     nullable=True)   # dénormalisé (pas de FK cross-service)
    fournisseur_nom= Column(String(200), nullable=True)
    prix_achat_lot = Column(Float,       nullable=True)
    prix_vente_lot = Column(Float,       nullable=True)

    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ── Relation ───────────────────────────────────────────
    produit = relationship("Produit", back_populates="stocks")

    # ── Index : lookup par (produit_id, depot/magasin, lot) ──
    # entrepot_id = depot_id ou magasin_id selon location_type
    __table_args__ = (
        Index("ix_stock_produit_depot_lot", "produit_id", "depot_id", "magasin_id", "numero_lot"),
    )

    def __repr__(self) -> str:
        loc = self.depot_id if self.location_type == "DEPOT" else self.magasin_id
        return f"<Stock produit={self.produit_id} {self.location_type}={loc} qte={self.quantite}>"


# ══════════════════════════════════════════════════════════
# TABLE : Promotions
# ══════════════════════════════════════════════════════════
class Promotion(Base):
    __tablename__ = "promotions"

    id                   = Column(Integer, primary_key=True, index=True, autoincrement=True)
    produit_id           = Column(Integer, ForeignKey("produits.id", ondelete="CASCADE"),
                                  nullable=False, index=True)

    pourcentage_reduction = Column(Float,       nullable=False)
    prix_initial          = Column(Float,       nullable=False)
    prix_promo            = Column(Float,       nullable=False)
    motif                 = Column(String(300), nullable=True)
    date_debut            = Column(Date,        nullable=False)
    date_fin              = Column(Date,        nullable=True)

    recommandation_ia_id  = Column(Integer,     nullable=True)
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
# Les mouvements sont gérés par Service Mouvement (port 8004)
# Service Stock expose uniquement :
#   PATCH /api/v1/stocks/augmenter ← appelé par Service Mouvement
#   PATCH /api/v1/stocks/diminuer  ← appelé par Service Mouvement
# ══════════════════════════════════════════════════════════
