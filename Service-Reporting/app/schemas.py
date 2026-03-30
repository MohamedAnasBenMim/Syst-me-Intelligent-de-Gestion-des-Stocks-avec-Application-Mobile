# app/schemas.py — service_reporting/

from pydantic import BaseModel, Field
from typing import Optional, List, Any
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


class MessageResponse(BaseModel):
    message: str
    success: bool = True