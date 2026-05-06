# app/models.py — service_mouvement/

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from app.database import Base
import enum


# ── Enum type de mouvement ─────────────────────────────────────
class TypeMouvement(str, enum.Enum):
    ENTREE                  = "entree"                   # Fournisseur → Dépôt
    SORTIE                  = "sortie"                   # Sortie depuis Magasin
    TRANSFERT               = "transfert"                # Legacy: entrepôt → entrepôt
    TRANSFERT_DEPOT_MAGASIN = "transfert_depot_magasin"  # Dépôt → Magasin (approvisionnement)
    RETOUR_MAGASIN_DEPOT    = "retour_magasin_depot"     # Magasin → Dépôt (retour)


# ── Enum statut du mouvement ───────────────────────────────────
class StatutMouvement(str, enum.Enum):
    EN_ATTENTE = "en_attente"  # Mouvement initié mais pas encore validé
    VALIDE     = "valide"      # Mouvement confirmé et stock mis à jour
    ANNULE     = "annule"      # Mouvement annulé


# ── Table mouvements ───────────────────────────────────────────
class Mouvement(Base):
    __tablename__ = "mouvements"

    id            = Column(Integer, primary_key=True, index=True)

    # Type et statut
    type_mouvement  = Column(Enum(TypeMouvement),   nullable=False)
    statut          = Column(Enum(StatutMouvement),
                default=StatutMouvement.VALIDE, nullable=False)

    # Produit concerné (référence vers Service Stock — pas de ForeignKey)
    """"
Les deux bases sont SÉPARÉES mouvement et stock!
→ PostgreSQL ne peut pas faire un ForeignKey entre deux bases différentes
→ On stocke juste l'Integer sans contrainte ForeignKey
→ C'est le code Python (routes.py) qui vérifiera
  que le produit existe via un appel HTTP au Service Stock
  """
    produit_id      = Column(Integer, nullable=False, index=True)
    produit_nom     = Column(String(200), nullable=True)  # dénormalisé pour historique 
    """
     → Le nom est déjà dans la table mouvements
  → Pas besoin d'appeler Service Stock
  → L'historique reste lisible même si le produit
    est supprimé """

    # Quantité
    quantite        = Column(Float, nullable=False)

    # Entrepôt source (obligatoire pour SORTIE et TRANSFERT — legacy)
    source_depot_id    = Column(Integer, nullable=True, index=True)
    source_depot_nom  = Column(String(200), nullable=True)

    # Entrepôt destination (obligatoire pour ENTREE et TRANSFERT — legacy)
    source_depot_id     = Column(Integer, nullable=True, index=True)
    source_depot_nom    = Column(String(200), nullable=True)

    

    # Nouveau: source typée DEPOT / MAGASIN / FOURNISSEUR
    source_type          = Column(String(20), nullable=True)  # "DEPOT","MAGASIN","FOURNISSEUR"
    source_depot_id      = Column(Integer,    nullable=True)
    source_depot_nom     = Column(String(200),nullable=True)
    source_magasin_id    = Column(Integer,    nullable=True)
    source_magasin_nom   = Column(String(200),nullable=True)

    # Nouveau: destination typée DEPOT / MAGASIN
    destination_type         = Column(String(20), nullable=True)  # "DEPOT","MAGASIN"
    destination_depot_id     = Column(Integer,    nullable=True)
    destination_depot_nom    = Column(String(200),nullable=True)
    destination_magasin_id   = Column(Integer,    nullable=True)
    destination_magasin_nom  = Column(String(200),nullable=True)

    # Informations complémentaires
    reference       = Column(String(100), nullable=True)   # référence bon de livraison
    motif           = Column(String(255), nullable=True)   # raison du mouvement
    note            = Column(String(500), nullable=True)   # note libre

    # Fournisseur (pour les mouvements de type ENTREE)
    fournisseur_id  = Column(Integer,     nullable=True)
    fournisseur_nom = Column(String(200), nullable=True)   # dénormalisé

    # Utilisateur qui a effectué le mouvement (référence vers Service Auth)
    utilisateur_id  = Column(Integer, nullable=False)
    utilisateur_nom = Column(String(200), nullable=True)   # dénormalisé

    # Timestamps
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())