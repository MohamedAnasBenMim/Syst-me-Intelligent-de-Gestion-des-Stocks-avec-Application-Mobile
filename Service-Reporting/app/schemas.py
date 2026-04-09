# app/schemas.py — service_reporting/

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import TypeRapport, StatutRapport


# ── KPI Globaux ────────────────────────────────────────────────
# Retourné par GET /reporting/dashboard
# Les données viennent de TOUS les services via HTTP
class KPIGlobaux(BaseModel):
    """
    KPI calculés en temps réel depuis tous les services.
    ML Descriptif : calculs statistiques sur les données actuelles.
    """
    total_produits       : int
    total_entrepots      : int
    total_stocks_actifs  : int
    total_mouvements_jour: int
    total_alertes_actives: int
    total_ruptures       : int
    total_critiques      : int
    total_surstocks      : int
    taux_occupation_moyen: float   # moyenne de tous les entrepôts
    valeur_stock_total   : float


# ── Top Produits ───────────────────────────────────────────────
class TopProduit(BaseModel):
    """Produit le plus mouvementé — ML Descriptif."""
    produit_id        : int
    produit_nom       : Optional[str]
    total_mouvements  : int
    total_entree      : float
    total_sortie      : float
    stock_actuel      : float
    niveau_alerte     : str


# ── Évolution Stock ────────────────────────────────────────────
class EvolutionStock(BaseModel):
    """
    Évolution d'un stock sur une période — ML Descriptif.
    Utilisé pour les graphiques dans le frontend React.
    """
    date    : datetime
    quantite: float
    type    : str   # entree / sortie / transfert


# ── Prévision ML ──────────────────────────────────────────────
class PrevisionML(BaseModel):
    """
    Prévision Prophet — ML Prédictif.
    Indique quand le stock va tomber en rupture.
    """
    produit_id          : int
    produit_nom         : Optional[str]
    stock_actuel        : float
    quantite_prevue     : float
    date_prevision      : datetime
    jours_avant_rupture : Optional[int]
    confiance           : float
    recommandation      : str   # "Commander X unités avant le JJ/MM"
    stock_prevu         : Optional[float] = None   # stock estimé à la fin de la période demandée
    rupture_dans_periode: Optional[bool]  = None   # True si rupture < periode jours

    model_config = {"from_attributes": True}


# ── Dashboard Complet ──────────────────────────────────────────
class DashboardResponse(BaseModel):
    """
    Réponse complète du tableau de bord.
    Combine ML Descriptif + ML Prédictif.
    """
    kpi              : KPIGlobaux
    top_produits     : List[TopProduit]
    previsions_ml    : List[PrevisionML]
    alertes_actives  : int
    generated_at     : datetime


# ── Rapport ────────────────────────────────────────────────────
class RapportCreate(BaseModel):
    type_rapport : TypeRapport  = TypeRapport.MENSUEL
    titre        : Optional[str] = None
    description  : Optional[str] = None
    date_debut   : Optional[datetime] = None
    date_fin     : Optional[datetime] = None
    entrepot_id  : Optional[int] = None
    produit_id   : Optional[int] = None


class RapportResponse(BaseModel):
    id           : int
    type_rapport : TypeRapport
    statut       : StatutRapport
    titre        : str
    date_debut   : Optional[datetime]
    date_fin     : Optional[datetime]
    entrepot_id  : Optional[int]
    donnees_json : Optional[str]
    genere_par   : Optional[int]
    created_at   : datetime

    model_config = {"from_attributes": True}


# ── Profit & Perte ────────────────────────────────────────────
class DepensesInput(BaseModel):
    """
    Formulaire de saisie des dépenses pour le calcul P&L.
    - eau, electricite, autres : saisie manuelle obligatoire
    - salaires        : None = auto-calculé depuis Service-Auth
    - pertes_produits : None = auto-calculé depuis Service-Stock
    """
    eau              : float           = Field(default=0.0, ge=0, description="Facture d'eau (DT)")
    electricite      : float           = Field(default=0.0, ge=0, description="Facture d'électricité (DT)")
    autres           : float           = Field(default=0.0, ge=0, description="Autres dépenses (DT)")
    salaires         : Optional[float] = Field(None, ge=0,
        description="Salaires totaux (DT) — None = récupéré automatiquement depuis les employés")
    pertes_produits  : Optional[float] = Field(None, ge=0,
        description="Valeur des produits périmés (DT) — None = calculé automatiquement depuis le stock")


class DetailDepenses(BaseModel):
    """Détail ligne par ligne des dépenses."""
    eau                  : float
    electricite          : float
    salaires             : float
    pertes_produits      : float
    autres               : float
    total                : float
    salaires_auto        : bool   # True = calculé automatiquement
    pertes_produits_auto : bool   # True = calculé automatiquement


class DetailStock(BaseModel):
    """Détail du calcul de la valeur du stock."""
    nb_produits_actifs   : int
    nb_produits_exclus   : int    # périmés exclus du calcul
    valeur_stock_normal  : float  # prix_unitaire × quantité
    valeur_stock_promo   : float  # prix_promo × quantité (produits en promo)
    valeur_totale        : float


# ── Produits périmés ──────────────────────────────────────────
class ProduitPerimeDetail(BaseModel):
    """Un produit périmé avec sa valeur de perte."""
    produit_id        : int
    reference         : str
    designation       : str
    date_expiration   : str
    quantite_restante : float
    prix_unitaire     : float
    valeur_perdue     : float
    entrepot_id       : int


class PerteCategorieDetail(BaseModel):
    """Pertes regroupées par catégorie de produit."""
    categorie       : str
    produits        : List[ProduitPerimeDetail]
    total_categorie : float


class PertesProduitsResponse(BaseModel):
    """Réponse complète des pertes sur produits périmés."""
    date_calcul  : str
    nb_produits  : int
    total_global : float
    categories   : List[PerteCategorieDetail]


# ── Salaires ──────────────────────────────────────────────────
class SalaireEmployeDetail(BaseModel):
    """Détail du salaire d'un employé."""
    id      : int
    nom     : str
    prenom  : str
    role    : str
    salaire : float


class SalairesResponse(BaseModel):
    """Résumé des salaires pour le P&L."""
    total_salaires : float
    nb_employes    : int
    detail         : List[SalaireEmployeDetail]


class AnalyseIA(BaseModel):
    """Analyse générée par le LLM sur le P&L."""
    depense_plus_elevee     : str
    pourcentage_depense_max : float
    recommandations         : List[str]
    alerte_pertes_produits  : Optional[str] = None


class ProfitPerteResponse(BaseModel):
    """Réponse complète du calcul P&L."""
    # CA réel (Σ sorties × prix unitaire) + indicateurs financiers
    chiffre_affaires : float = 0.0   # CA réel depuis sorties
    marge_brute      : float = 0.0   # CA - total_depenses
    taux_marge       : float = 0.0   # marge_brute / CA × 100 (%)
    # Résultats
    total_depenses  : float
    valeur_stock    : float          # valeur monétaire du stock restant
    profit          : float
    statut          : str           # "benefice" | "perte" | "equilibre"

    # Détails
    detail_depenses : DetailDepenses
    detail_stock    : DetailStock
    pertes_produits : Optional[PertesProduitsResponse] = None
    salaires_detail : Optional[SalairesResponse]       = None

    # Analyse IA
    analyse_ia      : Optional[AnalyseIA] = None

    # Métadonnées
    calcule_le      : datetime
    calcul_id       : Optional[int] = None

    model_config = {"from_attributes": True}


class ProfitPerteHistorique(BaseModel):
    """Entrée de l'historique des calculs P&L."""
    id               : int
    total_depenses   : float
    valeur_stock     : float
    chiffre_affaires : Optional[float] = 0.0
    profit           : float
    statut           : str
    calcule_par_nom  : Optional[str]
    calcule_le       : datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str
    success: bool = True