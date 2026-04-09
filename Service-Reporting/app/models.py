# app/models.py — service_reporting/
# Pourquoi une BDD ici ?
# Stocker les rapports générés pour ne pas recalculer à chaque fois
# Historiser les prévisions ML
# Mettre en cache les KPI calculés

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Enum
from sqlalchemy.sql import func
from app.database import Base
import enum


class TypeRapport(str, enum.Enum):
    JOURNALIER  = "journalier"
    HEBDOMADAIRE = "hebdomadaire"
    MENSUEL     = "mensuel"
    PERSONNALISE = "personnalise"


class StatutRapport(str, enum.Enum):
    EN_COURS  = "en_cours"
    TERMINE   = "termine"
    ECHEC     = "echec"


# ── Table rapports ─────────────────────────────────────────────
# Stocke chaque rapport généré avec ses données JSON
class Rapport(Base):
    __tablename__ = "rapports"

    id           = Column(Integer, primary_key=True, index=True)
    type_rapport = Column(Enum(TypeRapport), nullable=False)
    statut       = Column(Enum(StatutRapport), default=StatutRapport.EN_COURS)
    titre        = Column(String(300), nullable=False)

    # Période couverte par le rapport
    date_debut   = Column(DateTime(timezone=True), nullable=True)
    date_fin     = Column(DateTime(timezone=True), nullable=True)

    # Filtres appliqués
    entrepot_id  = Column(Integer, nullable=True)   # null = tous les entrepôts
    produit_id   = Column(Integer, nullable=True)   # null = tous les produits

    # Données calculées stockées en JSON
    # Ex: {"total_produits": 42, "total_mouvements": 128, ...}
    donnees_json = Column(Text, nullable=True)

    # Qui a généré ce rapport
    genere_par   = Column(Integer, nullable=True)   # user_id
    created_at   = Column(DateTime(timezone=True), server_default=func.now())


# ── Table previsions ───────────────────────────────────────────
# Stocke les prévisions ML calculées par Prophet
# Pour ne pas recalculer Prophet à chaque requête (lent !)
class Prevision(Base):
    __tablename__ = "previsions"

    id            = Column(Integer, primary_key=True, index=True)
    produit_id    = Column(Integer, nullable=False, index=True)
    entrepot_id   = Column(Integer, nullable=True)
    produit_nom   = Column(String(200), nullable=True)

    # Résultat de Prophet
    quantite_prevue     = Column(Float, nullable=False)
    date_prevision      = Column(DateTime(timezone=True), nullable=False)
    jours_avant_rupture = Column(Integer, nullable=True)
    confiance           = Column(Float, nullable=True)   # 0 à 1

    # Quand cette prévision a été calculée
    calcule_le   = Column(DateTime(timezone=True), server_default=func.now())
    est_active   = Column(Boolean, default=True)


# ── Table calculs_profit_perte ─────────────────────────────────
# Historise chaque calcul P&L effectué par l'admin
class CalculProfitPerte(Base):
    __tablename__ = "calculs_profit_perte"

    id                = Column(Integer, primary_key=True, index=True)

    # Dépenses saisies par l'admin
    depense_eau       = Column(Float, default=0.0, nullable=False)
    depense_electricite = Column(Float, default=0.0, nullable=False)
    depense_salaires  = Column(Float, default=0.0, nullable=False)
    depense_pertes_produits = Column(Float, default=0.0, nullable=False)
    depense_autres    = Column(Float, default=0.0, nullable=False)

    # Résultats calculés automatiquement
    total_depenses    = Column(Float, nullable=False)
    valeur_stock      = Column(Float, nullable=False)
    chiffre_affaires  = Column(Float, nullable=True, default=0.0)  # CA réel depuis sorties
    profit            = Column(Float, nullable=False)   # peut être négatif
    statut            = Column(String(20), nullable=False)  # benefice / perte / equilibre

    # Analyse IA (texte généré par le LLM)
    analyse_ia        = Column(Text, nullable=True)

    # Qui a fait le calcul
    calcule_par_id    = Column(Integer, nullable=True)
    calcule_par_nom   = Column(String(200), nullable=True)
    calcule_le        = Column(DateTime(timezone=True), server_default=func.now())