# app/schemas.py — service_stock/
# Validation des données JSON avec Pydantic

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


# ══════════════════════════════════════════════════════════
# ÉNUMÉRATIONS
# ══════════════════════════════════════════════════════════

class NiveauAlerte(str, Enum):
    normal   = "normal"
    critique = "critique"
    rupture  = "rupture"
    surstock = "surstock"


class TypeProduit(str, Enum):
    CONSOMMABLE     = "CONSOMMABLE"       # alimentaire, hygiène — marge attendue 5-25%
    NON_CONSOMMABLE = "NON_CONSOMMABLE"   # électronique, mobilier — marge attendue 25-80%


class PatternVente(str, Enum):
    REGULIER     = "REGULIER"
    SAISONNIER   = "SAISONNIER"
    OCCASIONNEL  = "OCCASIONNEL"


# Plages de marge acceptables par type
MARGE_MIN = {TypeProduit.CONSOMMABLE: 5.0,  TypeProduit.NON_CONSOMMABLE: 25.0}
MARGE_MAX = {TypeProduit.CONSOMMABLE: 25.0, TypeProduit.NON_CONSOMMABLE: 80.0}


def _verifier_marge(prix_achat, prix_vente, type_produit) -> tuple[float | None, str | None]:
    """Calcule la marge et génère un avertissement si hors plage."""
    if prix_achat is None or prix_vente is None or prix_achat == 0:
        return None, None
    marge = round(((prix_vente - prix_achat) / prix_achat) * 100, 2)
    tp = TypeProduit(type_produit) if isinstance(type_produit, str) else type_produit
    min_ok = MARGE_MIN.get(tp, 0)
    max_ok = MARGE_MAX.get(tp, 100)
    if marge < min_ok:
        return marge, f"Marge {marge:.1f}% inférieure au minimum recommandé ({min_ok}%) pour un produit {tp.value}"
    if marge > max_ok:
        return marge, f"Marge {marge:.1f}% supérieure au maximum recommandé ({max_ok}%) pour un produit {tp.value}"
    return marge, None


# ══════════════════════════════════════════════════════════
# SCHEMAS FOURNISSEUR
# ══════════════════════════════════════════════════════════

class FournisseurCreate(BaseModel):
    nom:                   str            = Field(..., min_length=2, max_length=200)
    contact_personne:      Optional[str]  = Field(None, max_length=200)
    telephone:             Optional[str]  = Field(None, max_length=50)
    email:                 Optional[str]  = Field(None, max_length=200)
    adresse:               Optional[str]  = None
    conditions_paiement:   Optional[str]  = Field(None, max_length=200)
    delai_livraison_jours: Optional[int]  = Field(None, ge=0, le=365)
    note:                  Optional[float]= Field(None, ge=0, le=5)


class FournisseurUpdate(BaseModel):
    nom:                   Optional[str]  = Field(None, min_length=2, max_length=200)
    contact_personne:      Optional[str]  = None
    telephone:             Optional[str]  = None
    email:                 Optional[str]  = None
    adresse:               Optional[str]  = None
    conditions_paiement:   Optional[str]  = None
    delai_livraison_jours: Optional[int]  = Field(None, ge=0, le=365)
    note:                  Optional[float]= Field(None, ge=0, le=5)
    est_actif:             Optional[bool] = None


class FournisseurResponse(BaseModel):
    id:                    int
    nom:                   str
    contact_personne:      Optional[str]  = None
    telephone:             Optional[str]  = None
    email:                 Optional[str]  = None
    adresse:               Optional[str]  = None
    conditions_paiement:   Optional[str]  = None
    delai_livraison_jours: Optional[int]  = None
    note:                  Optional[float]= None
    est_actif:             bool
    created_at:            datetime
    updated_at:            Optional[datetime] = None
    # Statistiques calculées (non stockées en DB)
    nb_produits:           Optional[int]  = None

    model_config = {"from_attributes": True}


class FournisseurList(BaseModel):
    total:       int
    fournisseurs: List[FournisseurResponse]


class LierProduitFournisseurRequest(BaseModel):
    produit_id:  int            = Field(..., gt=0)
    prix_achat:  Optional[float]= Field(None, ge=0)
    est_prefere: bool           = False


# ══════════════════════════════════════════════════════════
# SCHEMAS PRODUIT
# ══════════════════════════════════════════════════════════

class ProduitCreate(BaseModel):
    reference:        Optional[str]   = Field(None, min_length=2, max_length=50,
                                              description="Générée automatiquement si non fournie")
    designation:      str             = Field(..., min_length=2, max_length=200)
    categorie:        Optional[str]   = None
    unite_mesure:     str             = "unite"
    prix_unitaire:    float           = Field(default=0.0, ge=0)

    # Classification
    prix_achat:       Optional[float] = Field(None, ge=0, description="Prix d'achat fournisseur")
    prix_vente:       Optional[float] = Field(None, ge=0, description="Prix de vente client")
    type_produit:     TypeProduit     = TypeProduit.CONSOMMABLE
    pattern_vente:    Optional[PatternVente] = None

    # Champs saison/occasion
    mois_debut_vente:      Optional[int] = Field(None, ge=1, le=12)
    mois_fin_vente:        Optional[int] = Field(None, ge=1, le=12)
    jours_pour_vendre:     Optional[int] = Field(None, ge=1)
    meilleur_moment_achat: Optional[str] = Field(None, max_length=100)

    seuil_alerte_min: float          = Field(default=10.0,   ge=0)
    seuil_alerte_max: float          = Field(default=1000.0, ge=0)
    date_fabrication: Optional[date]  = None
    date_expiration:  Optional[date]  = None
    en_promotion:     bool            = False
    prix_promo:       Optional[float] = Field(None, ge=0)

    @field_validator("seuil_alerte_max")
    @classmethod
    def max_superieur_min(cls, v, info):
        if "seuil_alerte_min" in info.data and v <= info.data["seuil_alerte_min"]:
            raise ValueError("seuil_max doit être supérieur à seuil_min")
        return v

    @field_validator("date_expiration")
    @classmethod
    def expiration_future(cls, v):
        if v is not None and v <= date.today():
            raise ValueError("La date d'expiration doit être strictement postérieure à aujourd'hui")
        return v

    @field_validator("reference")
    @classmethod
    def reference_uppercase(cls, v):
        if v is not None:
            return v.upper().strip()
        return v


class ProduitUpdate(BaseModel):
    designation:      Optional[str]   = None
    categorie:        Optional[str]   = None
    unite_mesure:     Optional[str]   = None
    prix_unitaire:    Optional[float] = Field(None, ge=0)

    prix_achat:       Optional[float] = Field(None, ge=0)
    prix_vente:       Optional[float] = Field(None, ge=0)
    type_produit:     Optional[TypeProduit]    = None
    pattern_vente:    Optional[PatternVente]   = None
    mois_debut_vente:      Optional[int] = Field(None, ge=1, le=12)
    mois_fin_vente:        Optional[int] = Field(None, ge=1, le=12)
    jours_pour_vendre:     Optional[int] = Field(None, ge=1)
    meilleur_moment_achat: Optional[str] = None

    seuil_alerte_min: Optional[float] = Field(None, ge=0)
    seuil_alerte_max: Optional[float] = Field(None, ge=0)
    date_fabrication: Optional[date]  = None
    date_expiration:  Optional[date]  = None
    en_promotion:     Optional[bool]  = None
    prix_promo:       Optional[float] = Field(None, ge=0)
    est_actif:        Optional[bool]  = None


class ProduitResponse(BaseModel):
    id:               int
    reference:        str
    designation:      str
    categorie:        Optional[str]
    unite_mesure:     str
    prix_unitaire:    float

    prix_achat:       Optional[float]        = None
    prix_vente:       Optional[float]        = None
    marge_calculee:   Optional[float]        = None
    type_produit:     str                    = "CONSOMMABLE"
    pattern_vente:    Optional[str]          = None
    mois_debut_vente:      Optional[int]     = None
    mois_fin_vente:        Optional[int]     = None
    jours_pour_vendre:     Optional[int]     = None
    meilleur_moment_achat: Optional[str]     = None

    seuil_alerte_min: float
    seuil_alerte_max: float
    date_fabrication: Optional[date]         = None
    date_expiration:  Optional[date]         = None
    en_promotion:     bool                   = False
    prix_promo:       Optional[float]        = None
    est_actif:        bool
    created_at:       datetime
    updated_at:       Optional[datetime]

    # Avertissement marge (non stocké en DB, calculé à la volée)
    avertissement_marge: Optional[str]       = None

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════
# SCHEMAS STOCK
# ══════════════════════════════════════════════════════════

class StockResponse(BaseModel):
    id:              int
    produit_id:      int
    entrepot_id:     Optional[int]  = None   # dénormalisé : = depot_id ou magasin_id
    quantite:        float
    niveau_alerte:   str
    updated_at:      Optional[datetime]

    # Localisation dépôt/magasin
    location_type:   Optional[str]   = None
    depot_id:        Optional[int]   = None
    magasin_id:      Optional[int]   = None
    stock_type:      Optional[str]   = None

    # Traçabilité lot
    numero_lot:      Optional[str]   = None
    date_fabrication:Optional[date]  = None
    date_expiration: Optional[date]  = None
    date_reception:  Optional[date]  = None
    emplacement:     Optional[str]   = None
    fournisseur_id:  Optional[int]   = None
    fournisseur_nom: Optional[str]   = None
    prix_achat_lot:  Optional[float] = None
    prix_vente_lot:  Optional[float] = None

    produit:         Optional[ProduitResponse] = None

    model_config = {"from_attributes": True}


class StockAlertResponse(BaseModel):
    total_alertes: int
    stocks:        List[StockResponse]


# ══════════════════════════════════════════════════════════
# SCHEMAS AUGMENTER / DIMINUER
# ══════════════════════════════════════════════════════════

class StockAugmenter(BaseModel):
    produit_id:      int            = Field(..., gt=0)
    entrepot_id:     Optional[int]  = Field(None, gt=0)   # optionnel : dérivé de depot_id ou magasin_id
    quantite:        float          = Field(..., gt=0)
    mouvement_ref:   Optional[str]  = None
    # Localisation dépôt/magasin
    depot_id:        Optional[int]  = None
    magasin_id:      Optional[int]  = None
    location_type:   Optional[str]  = None   # "DEPOT" | "MAGASIN"
    # Champs lot optionnels
    numero_lot:      Optional[str]  = None
    fournisseur_id:  Optional[int]  = None
    fournisseur_nom: Optional[str]  = None
    prix_achat_lot:  Optional[float]= None
    prix_vente_lot:  Optional[float]= None
    date_reception:  Optional[date] = None
    emplacement:     Optional[str]  = None


class StockDiminuer(BaseModel):
    produit_id:    int            = Field(..., gt=0)
    entrepot_id:   Optional[int]  = Field(None, gt=0)   # optionnel : dérivé de depot_id ou magasin_id
    quantite:      float          = Field(..., gt=0)
    mouvement_ref: Optional[str]  = None
    # Localisation dépôt/magasin
    depot_id:      Optional[int]  = None
    magasin_id:    Optional[int]  = None
    location_type: Optional[str]  = None   # "DEPOT" | "MAGASIN"


class StockOperationResponse(BaseModel):
    produit_id:     int
    entrepot_id:    Optional[int]  = None   # dénormalisé : = depot_id ou magasin_id
    quantite_avant: float
    quantite_apres: float
    niveau_alerte:  str
    message:        str

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════
# SCHEMAS PROMOTION
# ══════════════════════════════════════════════════════════

class PromotionCreate(BaseModel):
    produit_id:            int            = Field(..., gt=0)
    pourcentage_reduction: float         = Field(..., gt=0, le=100)
    date_debut:            date           = Field(default_factory=date.today)
    date_fin:              Optional[date] = None
    motif:                 Optional[str]  = Field(None, max_length=300)
    recommandation_ia_id:  Optional[int]  = None

    @field_validator("date_fin")
    @classmethod
    def fin_apres_debut(cls, v, info):
        if v and "date_debut" in info.data and v < info.data["date_debut"]:
            raise ValueError("date_fin doit être postérieure à date_debut")
        return v


class PromotionUpdate(BaseModel):
    pourcentage_reduction: Optional[float] = Field(None, gt=0, le=100)
    date_fin:              Optional[date]  = None
    motif:                 Optional[str]   = Field(None, max_length=300)
    est_active:            Optional[bool]  = None


class PromotionResponse(BaseModel):
    id:                    int
    produit_id:            int
    produit_nom:           Optional[str]    = None
    produit_reference:     Optional[str]    = None
    pourcentage_reduction: float
    prix_initial:          float
    prix_promo:            float
    motif:                 Optional[str]    = None
    date_debut:            date
    date_fin:              Optional[date]   = None
    recommandation_ia_id:  Optional[int]   = None
    creee_par_id:          Optional[int]   = None
    creee_par_nom:         Optional[str]   = None
    est_active:            bool
    created_at:            datetime
    updated_at:            Optional[datetime] = None

    model_config = {"from_attributes": True}


class PromotionList(BaseModel):
    total:      int
    page:       int
    per_page:   int
    promotions: List[PromotionResponse]


class AppliquerIARequest(BaseModel):
    recommandation_ia_id:  int            = Field(..., gt=0)
    pourcentage_reduction: float          = Field(..., gt=0, le=100)
    date_fin:              Optional[date] = None


# ══════════════════════════════════════════════════════════
# SCHEMAS GÉNÉRIQUES
# ══════════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    message: str
    success: bool = True
