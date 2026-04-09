# app/routes.py — service_reporting/
#
# ═══════════════════════════════════════════════════════
# OÙ EST LE ML ?
# ═══════════════════════════════════════════════════════
#
# ML DESCRIPTIF  → fonction calculer_kpi()
#   → collecte données depuis tous les services
#   → calcule statistiques (moyennes, totaux, taux)
#   → alimente le tableau de bord
#
# ML PRÉDICTIF   → fonction predire_rupture_adaptative()
#   → utilise Prophet (Facebook) sur l'historique
#   → prédit quand le stock va tomber en rupture
#   → génère la recommandation de commande
# ═══════════════════════════════════════════════════════

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
import asyncio
import httpx
import json
import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.ensemble import IsolationForest

from app.database import get_db
from app.models import Rapport, Prevision, TypeRapport, StatutRapport, CalculProfitPerte
from app.schemas import (
    DashboardResponse, KPIGlobaux, TopProduit,
    PrevisionML, RapportCreate, RapportResponse, MessageResponse,
    DepensesInput, ProfitPerteResponse, DetailDepenses, DetailStock,
    AnalyseIA, ProfitPerteHistorique,
    PertesProduitsResponse, PerteCategorieDetail, ProduitPerimeDetail,
    SalairesResponse, SalaireEmployeDetail,
)
from app.dependencies import (
    get_current_user,
    get_current_admin,
    get_current_gestionnaire_or_admin,
    get_all_roles,
    get_pagination
)
from app.config import settings

router   = APIRouter()
security = HTTPBearer()


# ═══════════════════════════════════════════════════════
# FONCTIONS ML — APPELS INTER-SERVICES
# ═══════════════════════════════════════════════════════

async def recuperer_stocks(token: str) -> list:
    """Récupère tous les stocks depuis Service Stock."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            return r.json() if r.status_code == 200 else []
    except Exception:
        return []


async def recuperer_mouvements(token: str) -> list:
    """
    Récupère l'historique des mouvements depuis Service Mouvement.
    Ces données alimentent Prophet pour les prévisions.
    """
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.MOUVEMENT_SERVICE_URL}/api/v1/mouvements?per_page=500",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            return r.json().get("mouvements", []) if r.status_code == 200 else []
    except Exception:
        return []


async def recuperer_entrepots(token: str) -> list:
    """Récupère les entrepôts depuis Service Warehouse."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.WAREHOUSE_SERVICE_URL}/api/v1/entrepots",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            return r.json().get("entrepots", []) if r.status_code == 200 else []
    except Exception:
        return []


async def recuperer_stats_alertes(token: str) -> dict:
    """Récupère les statistiques des alertes depuis Service Alertes."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.ALERTE_SERVICE_URL}/api/v1/alertes/stats",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            return r.json() if r.status_code == 200 else {}
    except Exception:
        return {}


# ═══════════════════════════════════════════════════════
# ML DESCRIPTIF — calculer_kpi()
# ═══════════════════════════════════════════════════════
# Collecte les données de tous les services
# et calcule les indicateurs clés (KPI)
# ═══════════════════════════════════════════════════════

async def calculer_kpi(token: str) -> KPIGlobaux:
    """
    ML DESCRIPTIF :
    Agrège les données de tous les services pour
    calculer les KPI du tableau de bord.

    Calculs effectués :
    → total_produits        : COUNT des produits actifs
    → total_entrepots       : COUNT des entrepôts actifs
    → total_mouvements_jour : COUNT mouvements d'aujourd'hui
    → taux_occupation_moyen : MOYENNE des taux d'occupation
    → valeur_stock_total    : SOMME des quantités × prix unitaire
    """
    stocks    = await recuperer_stocks(token)
    entrepots = await recuperer_entrepots(token)
    alertes   = await recuperer_stats_alertes(token)
    mouvements = await recuperer_mouvements(token)

    # ── Calcul taux occupation moyen ───────────────────
    # Calculé depuis les stocks réels / capacite_max entrepôt
    # (capacite_utilisee en DB peut être obsolète)
    taux_list = []
    for e in entrepots:
        capacite_max = e.get("capacite_max", 0)
        if capacite_max and capacite_max > 0:
            stock_entrepot = sum(
                s.get("quantite", 0)
                for s in stocks
                if s.get("entrepot_id") == e.get("id")
            )
            # Sanity check : si capacite_max < stock réel → valeur non configurée
            # On la met à jour dynamiquement pour ne pas afficher > 100%
            capacite_effective = max(capacite_max, stock_entrepot) if stock_entrepot > capacite_max else capacite_max
            taux = round(stock_entrepot / capacite_effective * 100, 2)
            taux_list.append(min(taux, 100.0))
    taux_moyen = round(sum(taux_list) / len(taux_list), 2) if taux_list else 0.0

    # ── Mouvements du jour ─────────────────────────────
    aujourd_hui = datetime.now().date()
    mvt_jour = sum(
        1 for m in mouvements
        if m.get("created_at", "")[:10] == str(aujourd_hui)
    )

    # ── Valeur totale du stock ─────────────────────────
    # Utilise l'API promotions/actives pour les prix promo (fiable)
    promos_kpi = await recuperer_promotions_actives(token)
    valeur_total = 0.0
    for s in stocks:
        produit    = s.get("produit") or {}
        quantite   = float(s.get("quantite", 0))
        pid        = s.get("produit_id")
        prix_unit  = float(produit.get("prix_unitaire") or 0)
        prix_promo = promos_kpi.get(pid, 0) or (float(produit.get("prix_promo") or 0) if produit.get("en_promotion") else 0)
        if prix_promo > 0:
            valeur_total += quantite * prix_promo
        else:
            valeur_total += quantite * prix_unit

    return KPIGlobaux(
        total_produits        = len(set(s["produit_id"] for s in stocks)),
        total_entrepots       = len(entrepots),
        total_stocks_actifs   = len(stocks),
        total_mouvements_jour = mvt_jour,
        total_alertes_actives = alertes.get("total_actives", 0),
        total_ruptures        = alertes.get("total_ruptures", 0),
        total_critiques       = alertes.get("total_critiques", 0),
        total_surstocks       = alertes.get("total_surstocks", 0),
        taux_occupation_moyen = taux_moyen,
        valeur_stock_total    = round(valeur_total, 2),
    )


# ═══════════════════════════════════════════════════════
# ML PRÉDICTIF — predire_rupture_adaptative()
# ═══════════════════════════════════════════════════════
# Utilise Prophet (Facebook) pour prédire
# quand un produit va tomber en rupture de stock
# ═══════════════════════════════════════════════════════

def predire_rupture_adaptative(
    historique_mouvements : list,
    stock_actuel          : float,
    seuil_min             : float,
    produit_id            : int,
    produit_nom           : str,
    periode               : int = 30,
) -> PrevisionML:
    """
    ML PRÉDICTIF ADAPTATIF :

    Choisit automatiquement le meilleur modèle selon les données :
    ─ 1 jour      → Taux journalier       (projection simple)
    ─ 2–6 jours   → Moyenne mobile        (statistique)
    ─ 7–29 jours  → Régression linéaire   (sklearn)
    ─ 30+ jours   → Prophet               (ML avancé)
    """
    from sklearn.linear_model import LinearRegression

    def _construire_resultat(conso_jour, confiance, methode):
        jours        = int(stock_actuel / max(conso_jour, 0.01))
        date_rupture = datetime.now() + timedelta(days=jours)
        quantite_cmd = int(conso_jour * periode + seuil_min)
        stock_fin    = round(max(stock_actuel - conso_jour * periode, 0), 2)
        rupture      = jours <= periode
        return PrevisionML(
            produit_id           = produit_id,
            produit_nom          = produit_nom,
            stock_actuel         = stock_actuel,
            quantite_prevue      = round(max(stock_actuel - conso_jour, 0), 2),
            date_prevision       = date_rupture,
            jours_avant_rupture  = jours,
            confiance            = confiance,
            stock_prevu          = stock_fin,
            rupture_dans_periode = rupture,
            recommandation       = (
                f"{'⚠ Rupture dans ' + str(jours) + 'j — c' if rupture else 'C'}"
                f"ommander {quantite_cmd} unités — "
                f"consommation estimée {round(conso_jour, 1)} unités/jour "
                f"({methode})"
            )
        )

    try:
        # ── Filtrer les sorties du produit ────────────────
        sorties = [
            m for m in historique_mouvements
            if m.get("produit_id") == produit_id
            and m.get("type_mouvement") == "sortie"
        ]

        if not sorties:
            # Estimation prudente : 3% du stock par jour
            conso_prudente = max(stock_actuel * 0.03, 0.5)
            return _construire_resultat(conso_prudente, 0.3,
                                        "aucune sortie enregistrée — estimation prudente (3%/jour)")

        # ── Agréger par jour ──────────────────────────────
        df = pd.DataFrame([
            {"ds": pd.to_datetime(m["created_at"][:10]),
             "y":  float(m.get("quantite", 0))}
            for m in sorties
        ])
        df = df.groupby("ds")["y"].sum().reset_index().sort_values("ds")
        nb_jours = len(df)

        # Total sorties sur toute la période connue → taux moyen lissé
        total_sorties = float(df["y"].sum())
        # Nombre de jours réels entre première et dernière sortie (min 1)
        if nb_jours > 1:
            periode_jours = max((df["ds"].iloc[-1] - df["ds"].iloc[0]).days, 1)
        else:
            periode_jours = 30  # On suppose que 1 sortie ponctuelle = 1 commande/mois

        conso_lissee = total_sorties / periode_jours

        # ════════════════════════════════════════════════
        # CAS 1 — 1 JOUR : taux lissé sur 30 jours
        # ════════════════════════════════════════════════
        if nb_jours == 1:
            # Une seule sortie ne représente pas la consommation quotidienne
            # On divise par 30 pour obtenir un taux mensuel
            conso_jour = max(conso_lissee, 0.5)
            return _construire_resultat(conso_jour, 0.4,
                                        f"1 sortie observée — taux lissé sur 30 jours")

        # ════════════════════════════════════════════════
        # CAS 2 — 2 à 6 JOURS : moyenne mobile
        # ════════════════════════════════════════════════
        if nb_jours < 7:
            conso_jour = float(df["y"].mean())
            return _construire_resultat(conso_jour, 0.6,
                                        f"moyenne mobile sur {nb_jours} jours")

        # ════════════════════════════════════════════════
        # CAS 3 — 7 à 29 JOURS : régression linéaire
        # ════════════════════════════════════════════════
        if nb_jours < 30:
            X = np.arange(nb_jours).reshape(-1, 1)
            y = df["y"].values
            model = LinearRegression().fit(X, y)
            conso_demain = max(float(model.predict([[nb_jours]])[0]), 0.1)
            r2 = max(float(model.score(X, y)), 0.0)
            confiance = round(0.6 + r2 * 0.2, 2)  # entre 0.60 et 0.80
            return _construire_resultat(conso_demain, confiance,
                                        f"régression linéaire sur {nb_jours} jours (R²={round(r2,2)})")

        # ════════════════════════════════════════════════
        # CAS 4 — 30+ JOURS : Prophet
        # ════════════════════════════════════════════════
        modele     = Prophet(yearly_seasonality=False, weekly_seasonality=True,
                             daily_seasonality=False, interval_width=0.80)
        modele.fit(df.rename(columns={"ds": "ds", "y": "y"}))
        futur      = modele.make_future_dataframe(periods=30, freq="D")
        previsions = modele.predict(futur)
        futures    = previsions[previsions["ds"] > datetime.now()].head(30)
        conso_jour = max(float(futures["yhat"].mean()), 0.1)

        stock_restant    = stock_actuel
        jours_avant_rupt = 30
        date_rupture     = datetime.now() + timedelta(days=30)
        for _, row in futures.iterrows():
            stock_restant -= max(row["yhat"], 0)
            if stock_restant <= seuil_min:
                jours_avant_rupt = int((row["ds"] - datetime.now()).days)
                date_rupture     = row["ds"].to_pydatetime()
                break

        quantite_cmd = int(conso_jour * 30 + seuil_min)
        return PrevisionML(
            produit_id          = produit_id,
            produit_nom         = produit_nom,
            stock_actuel        = stock_actuel,
            quantite_prevue     = round(max(stock_restant, 0), 2),
            date_prevision      = date_rupture,
            jours_avant_rupture = jours_avant_rupt,
            confiance           = 0.80,
            recommandation      = (
                f"Commander {quantite_cmd} unités avant le "
                f"{date_rupture.strftime('%d/%m/%Y')} — "
                f"Prophet sur {nb_jours} jours "
                f"(consommation moyenne : {round(conso_jour, 1)} unités/jour)"
            )
        )

    except Exception as e:
        return PrevisionML(
            produit_id          = produit_id,
            produit_nom         = produit_nom,
            stock_actuel        = stock_actuel,
            quantite_prevue     = stock_actuel,
            date_prevision      = datetime.now() + timedelta(days=30),
            jours_avant_rupture = 30,
            confiance           = 0.0,
            recommandation      = f"Prévision impossible — {str(e)[:80]}",
        )


# ═══════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════

@router.get(
    "/reporting/dashboard",
    response_model=DashboardResponse,
    summary="Tableau de bord complet",
    description="""
    Retourne les KPI globaux (ML Descriptif) et les
    prévisions de rupture (ML Prédictif via Prophet).
    Collecte les données de tous les microservices.
    """
)
async def get_dashboard(
    db          : Session                      = Depends(get_db),
    current_user: dict                         = Depends(get_all_roles),
    credentials : HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    # ── ML Descriptif : KPI ────────────────────────────
    kpi        = await calculer_kpi(token)
    stocks     = await recuperer_stocks(token)
    mouvements = await recuperer_mouvements(token)

    # ── Top produits ───────────────────────────────────
    # Compte les mouvements par produit_id
    compteur = {}
    for m in mouvements:
        pid = m.get("produit_id")
        if pid:
            compteur[pid] = compteur.get(pid, 0) + 1

    top_produits = []
    for produit_id, nb_mvt in sorted(
        compteur.items(), key=lambda x: x[1], reverse=True
    )[:5]:
        stock_prod = next(
            (s for s in stocks if s["produit_id"] == produit_id), {}
        )
        entrees = sum(
            m.get("quantite", 0) for m in mouvements
            if m.get("produit_id") == produit_id
            and m.get("type_mouvement") == "entree"
        )
        sorties = sum(
            m.get("quantite", 0) for m in mouvements
            if m.get("produit_id") == produit_id
            and m.get("type_mouvement") == "sortie"
        )
        top_produits.append(TopProduit(
            produit_id       = produit_id,
            produit_nom      = stock_prod.get("produit", {}).get("designation"),
            total_mouvements = nb_mvt,
            total_entree     = round(entrees, 2),
            total_sortie     = round(sorties, 2),
            stock_actuel     = stock_prod.get("quantite", 0),
            niveau_alerte    = stock_prod.get("niveau_alerte", "normal"),
        ))

    # ── ML Prédictif : Prévisions Prophet ─────────────
    # Pour les produits en alerte uniquement
    previsions = []
    stocks_en_alerte = [
        s for s in stocks
        if s.get("niveau_alerte") in ["critique", "rupture"]
    ]

    for stock in stocks_en_alerte[:5]:  # max 5 prévisions
        produit_info = stock.get("produit", {})
        prevision    = predire_rupture_adaptative(
            historique_mouvements = mouvements,
            stock_actuel          = stock.get("quantite", 0),
            seuil_min             = produit_info.get("seuil_alerte_min", 10),
            produit_id            = stock.get("produit_id"),
            produit_nom           = produit_info.get("designation", "Produit inconnu"),
        )
        previsions.append(prevision)

    return DashboardResponse(
        kpi           = kpi,
        top_produits  = top_produits,
        previsions_ml = previsions,
        alertes_actives = kpi.total_alertes_actives,
        generated_at  = datetime.now(),
    )


@router.get(
    "/reporting/previsions",
    response_model=List[PrevisionML],
    summary="Prévisions ML pour tous les produits",
    description="Utilise Prophet pour prédire les ruptures futures sur 30 jours."
)
async def get_previsions(
    produit_id  : Optional[int] = Query(None),
    periode     : int           = Query(30, ge=1, le=365, description="Horizon de prévision en jours (7/15/30/60)"),
    db          : Session       = Depends(get_db),
    current_user: dict          = Depends(get_all_roles),
    credentials : HTTPAuthorizationCredentials = Depends(security),
):
    token      = credentials.credentials
    stocks     = await recuperer_stocks(token)
    mouvements = await recuperer_mouvements(token)

    if produit_id:
        stocks = [s for s in stocks if s.get("produit_id") == produit_id]

    previsions = []
    for stock in stocks:
        produit_info = stock.get("produit", {})
        previsions.append(predire_rupture_adaptative(
            historique_mouvements = mouvements,
            stock_actuel          = stock.get("quantite", 0),
            seuil_min             = produit_info.get("seuil_alerte_min", 10),
            produit_id            = stock.get("produit_id"),
            produit_nom           = produit_info.get("designation", ""),
            periode               = periode,
        ))

    # Trier : ruptures dans la période d'abord, puis par jours_avant_rupture croissants
    previsions.sort(key=lambda p: (
        0 if p.rupture_dans_periode else 1,
        p.jours_avant_rupture if p.jours_avant_rupture is not None else 9999
    ))
    return previsions


@router.get(
    "/reporting/kpi",
    response_model=KPIGlobaux,
    summary="KPI globaux uniquement",
    description="ML Descriptif — calcule les indicateurs clés en temps réel."
)
async def get_kpi(
    current_user: dict = Depends(get_all_roles),
    credentials : HTTPAuthorizationCredentials = Depends(security),
):
    return await calculer_kpi(credentials.credentials)


@router.post(
    "/reporting/rapports",
    response_model=RapportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Générer un rapport",
)
async def generer_rapport(
    data        : RapportCreate,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_gestionnaire_or_admin),
    credentials : HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    kpi   = await calculer_kpi(token)

    titre = data.titre or f"Rapport {data.type_rapport.value} — {datetime.now().strftime('%d/%m/%Y')}"

    rapport = Rapport(
        type_rapport = data.type_rapport,
        statut       = StatutRapport.TERMINE,
        titre        = titre,
        date_debut   = data.date_debut,
        date_fin     = data.date_fin or datetime.now(),
        entrepot_id  = data.entrepot_id,
        donnees_json = json.dumps({
            "total_produits"        : kpi.total_produits,
            "total_entrepots"       : kpi.total_entrepots,
            "total_mouvements_jour" : kpi.total_mouvements_jour,
            "total_alertes_actives" : kpi.total_alertes_actives,
            "taux_occupation_moyen" : kpi.taux_occupation_moyen,
            "description"           : data.description,
        }),
        genere_par = current_user.get("user_id"),
    )
    db.add(rapport)
    db.commit()
    db.refresh(rapport)
    return rapport


@router.get(
    "/reporting/rapports",
    response_model=list[RapportResponse],
    summary="Lister les rapports générés",
)
async def lister_rapports(
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_gestionnaire_or_admin),
    pagination  : dict    = Depends(get_pagination),
):
    return (
        db.query(Rapport)
        .order_by(Rapport.created_at.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
        .all()
    )


# ═══════════════════════════════════════════════════════
# ML DÉTECTION D'ANOMALIES — Isolation Forest
# ═══════════════════════════════════════════════════════
# Analyse globale des mouvements pour détecter
# des comportements statistiquement anormaux
# ═══════════════════════════════════════════════════════

@router.get(
    "/reporting/anomalies",
    summary="Détecter les anomalies dans les mouvements (Isolation Forest)",
    description="""
    Utilise Isolation Forest (ML non supervisé) pour détecter
    des comportements anormaux dans l'ensemble des mouvements de stock :
    - Quantité inhabituellement grande ou petite
    - Fréquence suspecte d'un produit/entrepôt
    - Variation aberrante par rapport au comportement moyen
    Retourne la liste des mouvements anormaux avec leur score d'anomalie.
    """
)
async def detecter_anomalies_reporting(
    current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials : HTTPAuthorizationCredentials = Depends(security),
):
    token      = credentials.credentials
    mouvements = await recuperer_mouvements(token)

    if len(mouvements) < 5:
        return {
            "success": False,
            "message": "Pas assez de mouvements pour l'analyse (minimum 5)",
            "total_mouvements": len(mouvements),
            "anomalies_count": 0,
            "anomalies": []
        }

    # ── Récupérer les stocks actuels pour comparaison ──
    stocks = await recuperer_stocks(token)
    stock_map = {s.get("produit_id"): s.get("quantite", 0) for s in stocks}

    anomalies = []

    # ════════════════════════════════════════════════════
    # ANOMALIE 1 — Quantité = 0
    # Un mouvement de 0 unité n'a aucun sens métier
    # ════════════════════════════════════════════════════
    for m in mouvements:
        quantite = float(m.get("quantite") or 0)
        if quantite == 0:
            anomalies.append({
                "mouvement_id": m.get("id"),
                "produit_id":   m.get("produit_id"),
                "produit_nom":  m.get("produit_nom", f"Produit {m.get('produit_id')}"),
                "entrepot_id":  m.get("entrepot_source_id") or m.get("entrepot_dest_id"),
                "quantite":     quantite,
                "type":         m.get("type_mouvement"),
                "date":         (m.get("created_at") or "")[:10],
                "type_anomalie": "quantite_zero",
                "raison":       "Mouvement enregistré avec une quantité de 0 — saisie invalide"
            })

    # ════════════════════════════════════════════════════
    # ANOMALIE 2 — Sortie supérieure au stock disponible
    # Physiquement impossible de sortir plus qu'on n'a
    # ════════════════════════════════════════════════════
    for m in mouvements:
        if m.get("type_mouvement") != "sortie":
            continue
        quantite   = float(m.get("quantite") or 0)
        produit_id = m.get("produit_id")
        stock_dispo = stock_map.get(produit_id, 0)

        # stock_apres négatif = on a sorti plus qu'on n'avait
        stock_apres = m.get("stock_apres")
        if stock_apres is not None and float(stock_apres) < 0:
            anomalies.append({
                "mouvement_id": m.get("id"),
                "produit_id":   produit_id,
                "produit_nom":  m.get("produit_nom", f"Produit {produit_id}"),
                "entrepot_id":  m.get("entrepot_source_id"),
                "quantite":     quantite,
                "type":         "sortie",
                "date":         (m.get("created_at") or "")[:10],
                "type_anomalie": "stock_negatif",
                "raison":       (
                    f"Sortie de {quantite} unités a rendu le stock négatif "
                    f"({stock_apres} unités) — impossible physiquement"
                )
            })

    # ════════════════════════════════════════════════════
    # ANOMALIE 3 — Doublon exact (même produit, même quantité,
    #              même entrepôt, même seconde)
    # ════════════════════════════════════════════════════
    # Détection doublon dans une fenêtre de 60 secondes
    mvts_tries = sorted(mouvements, key=lambda x: x.get("created_at", ""))
    for idx, m in enumerate(mvts_tries):
        try:
            dt_m = datetime.fromisoformat((m.get("created_at") or "").replace("Z", "+00:00"))
        except Exception:
            continue
        for m2 in mvts_tries[idx + 1:]:
            try:
                dt_m2 = datetime.fromisoformat((m2.get("created_at") or "").replace("Z", "+00:00"))
            except Exception:
                continue
            if (dt_m2 - dt_m).total_seconds() > 60:
                break
            if (
                m.get("produit_id")     == m2.get("produit_id") and
                m.get("quantite")       == m2.get("quantite") and
                m.get("type_mouvement") == m2.get("type_mouvement") and
                (m.get("entrepot_source_id") or m.get("entrepot_dest_id")) ==
                (m2.get("entrepot_source_id") or m2.get("entrepot_dest_id"))
            ):
                diff = int((dt_m2 - dt_m).total_seconds())
                anomalies.append({
                    "mouvement_id":  m2.get("id"),
                    "produit_id":    m2.get("produit_id"),
                    "produit_nom":   m2.get("produit_nom", f"Produit {m2.get('produit_id')}"),
                    "entrepot_id":   m2.get("entrepot_source_id") or m2.get("entrepot_dest_id"),
                    "quantite":      float(m2.get("quantite") or 0),
                    "type":          m2.get("type_mouvement"),
                    "date":          (m2.get("created_at") or "")[:10],
                    "type_anomalie": "doublon",
                    "raison":        (
                        f"Doublon probable — même mouvement ({m.get('type_mouvement')}, "
                        f"{m.get('quantite')} unités, produit {m.get('produit_id')}) "
                        f"répété {diff} secondes après (IDs: {m.get('id')} et {m2.get('id')})"
                    )
                })

    return {
        "success":          True,
        "message":          f"Analyse terminée — {len(mouvements)} mouvements analysés",
        "total_mouvements": len(mouvements),
        "anomalies_count":  len(anomalies),
        "anomalies":        anomalies
    }


# ═══════════════════════════════════════════════════════
# PROFIT & PERTE — Helpers inter-services
# ═══════════════════════════════════════════════════════

async def recuperer_promotions_actives(token: str) -> dict:
    """
    Récupère les promotions actives depuis Service Stock.
    Retourne un dict {produit_id: prix_promo} pour usage direct.
    Plus fiable que le flag en_promotion sur le produit.
    """
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/promotions/actives",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            if r.status_code == 200:
                data = r.json()
                promos = data.get("promotions", []) if isinstance(data, dict) else []
                return {
                    p["produit_id"]: p["prix_promo"]
                    for p in promos
                    if p.get("produit_id") and p.get("prix_promo", 0) > 0
                }
    except Exception:
        pass
    return {}


async def recuperer_produits_avec_stocks(token: str) -> list:
    """Stocks avec détails produits (prix, promo, expiration)."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks",
                headers={"Authorization": f"Bearer {token}"},
                params={"per_page": 1000},
                timeout=10.0,
            )
            return r.json() if r.status_code == 200 else []
    except Exception:
        return []


async def recuperer_pertes_produits_auto(token: str) -> tuple[float, dict | None]:
    """
    Appelle GET /stocks/produits-perimes.
    Retourne (total_global, données_brutes) — (0.0, None) si indisponible.
    """
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/produits-perimes",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            if r.status_code == 200:
                data = r.json()
                return float(data.get("total_global", 0)), data
    except Exception:
        pass
    return 0.0, None


async def recuperer_salaires_auto(token: str) -> tuple[float, dict | None]:
    """
    Appelle GET /utilisateurs/salaires.
    Retourne (total_salaires, données_brutes) — (0.0, None) si indisponible.
    """
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/utilisateurs/salaires",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            if r.status_code == 200:
                data = r.json()
                return float(data.get("total_salaires", 0)), data
    except Exception:
        pass
    return 0.0, None


def _appeler_ia_analyse_pl(
    eau: float,
    electricite: float,
    salaires: float,
    pertes_produits: float,
    autres: float,
    total_depenses: float,
    valeur_stock: float,
    profit: float,
    statut: str,
) -> AnalyseIA | None:
    """
    Appel synchrone IA-RAG pour analyser le P&L.
    Timeout 5s — fallback None si indisponible.
    """
    try:
        noms = {
            "eau"            : eau,
            "électricité"    : electricite,
            "salaires"       : salaires,
            "pertes produits": pertes_produits,
            "autres"         : autres,
        }
        max_nom = max(noms, key=lambda k: noms[k])
        max_val = noms[max_nom]
        pct_max = round((max_val / total_depenses * 100) if total_depenses > 0 else 0, 1)

        prompt = (
            f"Analyse du P&L d'un entrepôt de stock :\n"
            f"- Total dépenses : {total_depenses:.2f} DT\n"
            f"- Eau : {eau:.2f} DT\n"
            f"- Électricité : {electricite:.2f} DT\n"
            f"- Salaires : {salaires:.2f} DT\n"
            f"- Pertes produits périmés : {pertes_produits:.2f} DT\n"
            f"- Autres : {autres:.2f} DT\n"
            f"- Valeur du stock sain : {valeur_stock:.2f} DT\n"
            f"- Résultat : {profit:.2f} DT ({statut})\n\n"
            f"Donne 3 recommandations courtes et concrètes pour améliorer la rentabilité."
        )

        with httpx.Client(timeout=5.0) as client:
            r = client.post(
                f"{settings.IA_RAG_SERVICE_URL}/api/v1/ia/question",
                json={"question": prompt},
            )
            if r.status_code == 200:
                reponse_ia = r.json().get("reponse", "")
                lignes = [l.strip(" -•") for l in reponse_ia.split("\n") if l.strip(" -•")]
                recommandations = [l for l in lignes if len(l) > 10][:3]
                if not recommandations:
                    recommandations = [reponse_ia[:200]]

                alerte = None
                if total_depenses > 0 and pertes_produits > total_depenses * 0.3:
                    alerte = (
                        f"Attention : les pertes produits représentent "
                        f"{round(pertes_produits / total_depenses * 100, 1)}% "
                        f"des dépenses — vérifiez la gestion des expirations."
                    )

                return AnalyseIA(
                    depense_plus_elevee     = max_nom,
                    pourcentage_depense_max = pct_max,
                    recommandations         = recommandations,
                    alerte_pertes_produits  = alerte,
                )
    except Exception:
        pass
    return None


def _construire_pertes_response(data: dict) -> PertesProduitsResponse:
    """Convertit la réponse JSON du service Stock en PertesProduitsResponse."""
    categories = []
    for cat in data.get("categories", []):
        produits = [
            ProduitPerimeDetail(
                produit_id        = p["produit_id"],
                reference         = p["reference"],
                designation       = p["designation"],
                date_expiration   = p["date_expiration"],
                quantite_restante = p["quantite_restante"],
                prix_unitaire     = p["prix_unitaire"],
                valeur_perdue     = p["valeur_perdue"],
                entrepot_id       = p["entrepot_id"],
            )
            for p in cat.get("produits", [])
        ]
        categories.append(PerteCategorieDetail(
            categorie       = cat["categorie"],
            produits        = produits,
            total_categorie = cat["total_categorie"],
        ))
    return PertesProduitsResponse(
        date_calcul  = data.get("date_calcul", ""),
        nb_produits  = data.get("nb_produits", 0),
        total_global = data.get("total_global", 0.0),
        categories   = categories,
    )


def _construire_salaires_response(data: dict) -> SalairesResponse:
    """Convertit la réponse JSON du service Auth en SalairesResponse."""
    return SalairesResponse(
        total_salaires = data.get("total_salaires", 0.0),
        nb_employes    = data.get("nb_employes", 0),
        detail         = [
            SalaireEmployeDetail(
                id      = e["id"],
                nom     = e["nom"],
                prenom  = e["prenom"],
                role    = e["role"],
                salaire = e["salaire"],
            )
            for e in data.get("detail", [])
        ],
    )


# ═══════════════════════════════════════════════════════
# PROFIT & PERTE — Routes
# ═══════════════════════════════════════════════════════

@router.get(
    "/reporting/pertes-produits",
    response_model=PertesProduitsResponse,
    summary="Pertes sur produits périmés par catégorie",
    description="Calcule automatiquement la valeur des produits périmés encore en stock, regroupés par catégorie.",
)
async def get_pertes_produits(
    _current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials  : HTTPAuthorizationCredentials = Depends(security),
):
    _, data = await recuperer_pertes_produits_auto(credentials.credentials)
    if data is None:
        return PertesProduitsResponse(
            date_calcul="", nb_produits=0, total_global=0.0, categories=[]
        )
    return _construire_pertes_response(data)


@router.get(
    "/reporting/salaires",
    response_model=SalairesResponse,
    summary="Total des salaires des employés",
    description="Récupère depuis Service-Auth le total des salaires de tous les employés actifs.",
)
async def get_salaires(
    _current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials  : HTTPAuthorizationCredentials = Depends(security),
):
    _, data = await recuperer_salaires_auto(credentials.credentials)
    if data is None:
        return SalairesResponse(total_salaires=0.0, nb_employes=0, detail=[])
    return _construire_salaires_response(data)


@router.post(
    "/reporting/profit-perte",
    response_model=ProfitPerteResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculer le Profit & Perte",
    description="""
    Calcule le résultat financier complet :

    - **eau, electricite, autres** : saisie manuelle
    - **salaires** : si omis (null), récupéré automatiquement depuis tous les employés (Service-Auth)
    - **pertes_produits** : si omis (null), calculé automatiquement depuis les produits périmés (Service-Stock)
    - Exclut les périmés de la valeur du stock (prix promo appliqué si en promotion)
    - Appelle l'IA-RAG pour analyse et recommandations
    - Sauvegarde dans l'historique
    """,
)
async def calculer_profit_perte(
    data        : DepensesInput,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_gestionnaire_or_admin),
    credentials : HTTPAuthorizationCredentials = Depends(security),
):
    token       = credentials.credentials
    aujourd_hui = datetime.now().date()

    # ── 1. Stocks + pertes + salaires + mouvements + promotions actives ─
    stocks, (pertes_val, pertes_data), (salaires_val, salaires_data), mouvements_all, promos_map = await asyncio.gather(
        recuperer_produits_avec_stocks(token),
        recuperer_pertes_produits_auto(token),
        recuperer_salaires_auto(token),
        recuperer_mouvements(token),
        recuperer_promotions_actives(token),
    )

    # ── 2. Décider pertes et salaires ─────────────────
    pertes_auto   = data.pertes_produits is None
    salaires_auto = data.salaires        is None

    montant_pertes   = pertes_val   if pertes_auto   else data.pertes_produits
    montant_salaires = salaires_val if salaires_auto else data.salaires

    # ── 3. Valeur du stock (hors périmés, prix promo depuis API) ──
    # promos_map = {produit_id: prix_promo} depuis /promotions/actives
    # Plus fiable que le flag en_promotion sur le produit
    nb_actifs  = 0
    nb_exclus  = 0
    val_normal = 0.0
    val_promo  = 0.0

    for s in stocks:
        produit    = s.get("produit") or {}
        quantite   = float(s.get("quantite", 0))
        date_exp   = produit.get("date_expiration")
        pid        = s.get("produit_id")
        prix_unit  = float(produit.get("prix_unitaire") or 0)
        # Prix promo : priorité à l'API promotions/actives, fallback sur le produit
        prix_promo_api = promos_map.get(pid, 0)
        prix_promo_pdt = float(produit.get("prix_promo") or 0) if produit.get("en_promotion") else 0
        prix_promo = prix_promo_api or prix_promo_pdt

        if date_exp:
            try:
                if datetime.fromisoformat(date_exp[:10]).date() < aujourd_hui:
                    nb_exclus += 1
                    continue
            except Exception:
                pass

        nb_actifs += 1
        if prix_promo > 0:
            val_promo += prix_promo * quantite
        else:
            val_normal += prix_unit * quantite

    valeur_stock = round(val_normal + val_promo, 2)

    # ── 4. CA réel = Σ(sorties × prix de vente) ───────
    # Utilise promos_map pour les prix promo (source directe = API promotions/actives)
    prix_par_produit: dict = {}
    for s in stocks:
        p   = s.get("produit") or {}
        pid = s.get("produit_id")
        prix_unit  = float(p.get("prix_unitaire") or 0)
        prix_promo = promos_map.get(pid) or (float(p.get("prix_promo") or 0) if p.get("en_promotion") else 0)
        prix_par_produit[pid] = {
            "prix":      prix_unit,
            "prix_vente": prix_promo if prix_promo > 0 else prix_unit,
        }

    chiffre_affaires = 0.0
    mouvements_sorties = [m for m in mouvements_all if m.get("type_mouvement") in ("sortie", "SORTIE")]
    for m in mouvements_sorties:
        pid = m.get("produit_id")
        qte = float(m.get("quantite", 0))
        info = prix_par_produit.get(pid, {})
        chiffre_affaires += qte * info.get("prix_vente", 0)
    chiffre_affaires = round(chiffre_affaires, 2)

    # ── 5. Totaux ─────────────────────────────────────
    total_depenses = round(
        data.eau + data.electricite + data.autres
        + montant_pertes + montant_salaires,
        2,
    )
    # Profit = CA réel - charges (si CA > 0), sinon fallback sur valeur stock
    base_calcul = chiffre_affaires if chiffre_affaires > 0 else valeur_stock
    profit      = round(base_calcul - total_depenses, 2)
    marge_brute = round(base_calcul - total_depenses, 2)
    taux_marge  = round((marge_brute / base_calcul * 100), 2) if base_calcul > 0 else 0.0
    statut = "benefice" if profit > 0 else ("perte" if profit < 0 else "equilibre")

    # ── 5. Analyse IA ─────────────────────────────────
    analyse_ia = _appeler_ia_analyse_pl(
        eau             = data.eau,
        electricite     = data.electricite,
        salaires        = montant_salaires,
        pertes_produits = montant_pertes,
        autres          = data.autres,
        total_depenses  = total_depenses,
        valeur_stock    = valeur_stock,
        profit          = profit,
        statut          = statut,
    )

    # ── 6. Sauvegarder ────────────────────────────────
    calcul = CalculProfitPerte(
        depense_eau             = data.eau,
        depense_electricite     = data.electricite,
        depense_salaires        = montant_salaires,
        depense_pertes_produits = montant_pertes,
        depense_autres          = data.autres,
        total_depenses          = total_depenses,
        valeur_stock            = valeur_stock,
        chiffre_affaires        = chiffre_affaires,
        profit                  = profit,
        statut                  = statut,
        analyse_ia              = json.dumps(analyse_ia.model_dump()) if analyse_ia else None,
        calcule_par_id          = current_user.get("user_id"),
        calcule_par_nom         = current_user.get("nom") or current_user.get("username"),
    )
    db.add(calcul)
    db.commit()
    db.refresh(calcul)

    # ── 7. Construire la réponse ───────────────────────
    return ProfitPerteResponse(
        chiffre_affaires = chiffre_affaires,
        marge_brute      = marge_brute,
        taux_marge       = taux_marge,
        total_depenses   = total_depenses,
        valeur_stock     = valeur_stock,
        profit           = profit,
        statut           = statut,
        detail_depenses = DetailDepenses(
            eau                  = data.eau,
            electricite          = data.electricite,
            salaires             = montant_salaires,
            pertes_produits      = montant_pertes,
            autres               = data.autres,
            total                = total_depenses,
            salaires_auto        = salaires_auto,
            pertes_produits_auto = pertes_auto,
        ),
        detail_stock    = DetailStock(
            nb_produits_actifs  = nb_actifs,
            nb_produits_exclus  = nb_exclus,
            valeur_stock_normal = round(val_normal, 2),
            valeur_stock_promo  = round(val_promo, 2),
            valeur_totale       = valeur_stock,
        ),
        pertes_produits = _construire_pertes_response(pertes_data) if pertes_data else None,
        salaires_detail = _construire_salaires_response(salaires_data) if salaires_data else None,
        analyse_ia      = analyse_ia,
        calcule_le      = calcul.calcule_le,
        calcul_id       = calcul.id,
    )


@router.get(
    "/reporting/profit-perte/historique",
    response_model=List[ProfitPerteHistorique],
    summary="Historique des calculs P&L",
    description="Liste tous les calculs P&L effectués, du plus récent au plus ancien.",
)
async def historique_profit_perte(
    db           : Session = Depends(get_db),
    _current_user: dict    = Depends(get_current_gestionnaire_or_admin),
    pagination   : dict    = Depends(get_pagination),
):
    return (
        db.query(CalculProfitPerte)
        .order_by(CalculProfitPerte.calcule_le.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
        .all()
    )