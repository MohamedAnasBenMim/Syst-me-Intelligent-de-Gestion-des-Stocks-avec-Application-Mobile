# app/schemas.py — service_mouvement/

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from app.models import TypeMouvement, StatutMouvement


# ═══════════════════════════════════════════════════════════
# SCHEMAS MOUVEMENT
# ═══════════════════════════════════════════════════════════

class MouvementBase(BaseModel):
    type_mouvement      : TypeMouvement = Field(..., description="entree / sortie / transfert")
    produit_id          : int           = Field(..., gt=0, description="ID du produit dans Service Stock")
    produit_nom         : Optional[str] = Field(None, max_length=200, description="Copié depuis Service Stock pour l'historique")
    quantite            : float         = Field(..., gt=0, description="Quantité concernée — doit être > 0")

    # Source — obligatoire pour SORTIE et TRANSFERT
    entrepot_source_id  : Optional[int] = Field(None, gt=0, description="Obligatoire pour SORTIE et TRANSFERT")
    entrepot_source_nom : Optional[str] = Field(None, max_length=200, description="Copié depuis Service Warehouse pour l'historique")

    # Destination — obligatoire pour ENTREE et TRANSFERT
    entrepot_dest_id    : Optional[int] = Field(None, gt=0, description="Obligatoire pour ENTREE et TRANSFERT")
    entrepot_dest_nom   : Optional[str] = Field(None, max_length=200, description="Copié depuis Service Warehouse pour l'historique")

    # Zones (optionnel — granularité fine)
    zone_source_id      : Optional[int] = Field(None, gt=0)
    zone_dest_id        : Optional[int] = Field(None, gt=0)

    # Informations complémentaires
    reference           : Optional[str] = Field(None, max_length=100, description="Référence bon de livraison / commande")
    motif               : Optional[str] = Field(None, max_length=255, description="Raison du mouvement")
    note                : Optional[str] = Field(None, max_length=500, description="Note libre")


class MouvementCreate(MouvementBase):
    """
    Schema pour créer un mouvement de stock.

    Règles métier validées ici :
    ─────────────────────────────────────────────────────────
    ENTREE :
      → entrepot_dest_id   obligatoire (où stocker la marchandise ?)
      → entrepot_source_id optionnel   (vient d'un fournisseur externe)
      → Effet : Service Stock augmente la quantité de entrepot_dest

    SORTIE :
      → entrepot_source_id obligatoire (d'où prendre le stock ?)
      → entrepot_dest_id   optionnel   (part vers un client externe)
      → Effet : Service Stock diminue la quantité de entrepot_source

    TRANSFERT :
      → entrepot_source_id obligatoire (d'où ?)
      → entrepot_dest_id   obligatoire (vers où ?)
      → les deux doivent être différents
      → Effet : Service Stock diminue entrepot_source
                             et augmente entrepot_dest
    ─────────────────────────────────────────────────────────
    """

    @field_validator("entrepot_source_id")
    @classmethod
    def valider_entrepot_source(cls, v, info):
        """
        SORTIE    → entrepot_source_id obligatoire
                    sans lui impossible de savoir
                    quel stock diminuer
        TRANSFERT → entrepot_source_id obligatoire
                    sans lui impossible de savoir
                    d'où vient la marchandise
        """
        type_mvt = info.data.get("type_mouvement")
        if type_mvt in [TypeMouvement.SORTIE, TypeMouvement.TRANSFERT]:
            if v is None:
                raise ValueError(
                    f"entrepot_source_id est obligatoire pour un mouvement '{type_mvt}' "
                    f"— sans lui impossible de savoir quel stock diminuer"
                )
        return v

    @field_validator("entrepot_dest_id")
    @classmethod
    def valider_entrepot_dest(cls, v, info):
        """
        ENTREE    → entrepot_dest_id obligatoire
                    sans lui impossible de savoir
                    où augmenter le stock
        TRANSFERT → entrepot_dest_id obligatoire
                    + doit être différent de entrepot_source_id
        """
        type_mvt = info.data.get("type_mouvement")

        # ENTREE et TRANSFERT → destination obligatoire
        if type_mvt in [TypeMouvement.ENTREE, TypeMouvement.TRANSFERT]:
            if v is None:
                raise ValueError(
                    f"entrepot_dest_id est obligatoire pour un mouvement '{type_mvt}' "
                    f"— sans lui impossible de savoir où augmenter le stock"
                )

        # TRANSFERT → source ≠ destination
        if type_mvt == TypeMouvement.TRANSFERT:
            source = info.data.get("entrepot_source_id")
            if source and v and source == v:
                raise ValueError(
                    "entrepot_source_id et entrepot_dest_id doivent être différents "
                    "pour un transfert — on ne peut pas transférer vers le même entrepôt"
                )
        return v


class MouvementUpdate(BaseModel):
    """
    Seuls le statut, le motif et la note sont modifiables après création.

    On ne peut PAS modifier :
    → type_mouvement    (changer entree en sortie = incohérence)
    → produit_id        (changer le produit = fausse l'historique)
    → quantite          (modifier = fausse le stock déjà mis à jour)
    → entrepot_source_id / entrepot_dest_id (stock déjà mis à jour)
    """
    statut : Optional[StatutMouvement] = None
    motif  : Optional[str]             = Field(None, max_length=255)
    note   : Optional[str]             = Field(None, max_length=500)


class MouvementResponse(MouvementBase):
    """
    Schema retourné au client après création ou consultation.
    Inclut les champs générés par la BDD (id, statut, timestamps).
    """
    id              : int
    statut          : StatutMouvement
    utilisateur_id  : int
    utilisateur_nom : Optional[str] = None
    created_at      : datetime
    updated_at      : Optional[datetime] = None

    model_config = {"from_attributes": True}


class MouvementList(BaseModel):
    """
    Schema pour la liste paginée des mouvements.

    Exemple d'utilisation :
    GET /mouvements?page=1&per_page=10         → tous les mouvements
    GET /mouvements?type_mouvement=sortie      → filtre par type
    GET /mouvements?produit_id=5               → filtre par produit
    GET /mouvements?entrepot_source_id=1       → filtre par entrepôt
    """
    total      : int
    page       : int
    per_page   : int
    mouvements : list[MouvementResponse]


# ═══════════════════════════════════════════════════════════
# SCHEMAS RÉPONSES GÉNÉRIQUES
# ═══════════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    """Réponse simple avec message de succès"""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Réponse retournée en cas d'erreur"""
    detail : str
    success: bool = False