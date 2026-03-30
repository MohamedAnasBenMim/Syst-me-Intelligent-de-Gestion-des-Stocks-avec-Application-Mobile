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
import httpx
import json
import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.ensemble import IsolationForest

from app.database import get_db
from app.models import Rapport, Prevision, TypeRapport, StatutRapport
from app.schemas import (
    DashboardResponse, KPIGlobaux, TopProduit,
    PrevisionML, RapportCreate, RapportResponse, MessageResponse
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
                f"{settings.MOUVEMENT_SERVICE_URL}/api/v1/mouvements?limit=500",
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
            # Somme des stocks dans cet entrepôt
            stock_entrepot = sum(
                s.get("quantite", 0)
                for s in stocks
                if s.get("entrepot_id") == e.get("id")
            )
            taux_list.append(round(stock_entrepot / capacite_max * 100, 2))
    taux_moyen = round(sum(taux_list) / len(taux_list), 2) if taux_list else 0.0

    # ── Mouvements du jour ─────────────────────────────
    aujourd_hui = datetime.now().date()
    mvt_jour = sum(
        1 for m in mouvements
        if m.get("created_at", "")[:10] == str(aujourd_hui)
    )

    # ── Valeur totale du stock ─────────────────────────
    valeur_total = sum(
        s.get("quantite", 0) * s.get("produit", {}).get("prix_unitaire", 0)
        for s in stocks
    )

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
        quantite_cmd = int(conso_jour * 30 + seuil_min)
        return PrevisionML(
            produit_id          = produit_id,
            produit_nom         = produit_nom,
            stock_actuel        = stock_actuel,
            quantite_prevue     = round(max(stock_actuel - conso_jour, 0), 2),
            date_prevision      = date_rupture,
            jours_avant_rupture = jours,
            confiance           = confiance,
            recommandation      = (
                f"Commander {quantite_cmd} unités — "
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
            return _construire_resultat(stock_actuel * 0.1, 0.3,
                                        "aucune sortie enregistrée — estimation prudente")

        # ── Agréger par jour ──────────────────────────────
        df = pd.DataFrame([
            {"ds": pd.to_datetime(m["created_at"][:10]),
             "y":  float(m.get("quantite", 0))}
            for m in sorties
        ])
        df = df.groupby("ds")["y"].sum().reset_index().sort_values("ds")
        nb_jours = len(df)

        # ════════════════════════════════════════════════
        # CAS 1 — 1 JOUR : taux journalier
        # ════════════════════════════════════════════════
        if nb_jours == 1:
            conso_jour = float(df["y"].iloc[0])
            return _construire_resultat(conso_jour, 0.4,
                                        "1 journée de données — taux journalier direct")

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
    for stock in stocks[:10]:
        produit_info = stock.get("produit", {})
        previsions.append(predire_rupture_adaptative(
            historique_mouvements = mouvements,
            stock_actuel          = stock.get("quantite", 0),
            seuil_min             = produit_info.get("seuil_alerte_min", 10),
            produit_id            = stock.get("produit_id"),
            produit_nom           = produit_info.get("designation", ""),
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

    # ── Construire la matrice de features ──────────────
    # Features : [quantite, type_encoded, produit_id, entrepot_id]
    type_map = {"entree": 0, "sortie": 1, "transfert": 2}
    features, meta = [], []

    for m in mouvements:
        quantite    = float(m.get("quantite") or 0)
        type_mvt    = type_map.get(m.get("type_mouvement", ""), 0)
        produit_id  = float(m.get("produit_id") or 0)
        entrepot_id = float(m.get("entrepot_source_id") or m.get("entrepot_dest_id") or 0)

        features.append([quantite, type_mvt, produit_id, entrepot_id])
        meta.append({
            "id":          m.get("id"),
            "produit_id":  m.get("produit_id"),
            "produit_nom": m.get("produit_nom", f"Produit {m.get('produit_id')}"),
            "quantite":    quantite,
            "type":        m.get("type_mouvement"),
            "entrepot_id": int(entrepot_id),
            "created_at":  m.get("created_at", "")
        })

    X = np.array(features)

    # ── Entraîner Isolation Forest ──────────────────────
    # contamination=0.1 → 10% des données considérées comme anomalies
    model       = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
    predictions = model.fit_predict(X)   # -1 = anomalie, 1 = normal
    scores      = model.score_samples(X) # score négatif = plus anormal

    # ── Collecter les anomalies ─────────────────────────
    anomalies = []
    moyenne_quantite = float(np.mean(X[:, 0]))

    for i, pred in enumerate(predictions):
        if pred == -1:
            m_meta = meta[i]
            score  = round(float(scores[i]), 4)
            sens   = "élevée" if m_meta["quantite"] > moyenne_quantite else "basse"

            anomalies.append({
                "mouvement_id":   m_meta["id"],
                "produit_id":     m_meta["produit_id"],
                "produit_nom":    m_meta["produit_nom"],
                "entrepot_id":    m_meta["entrepot_id"],
                "quantite":       m_meta["quantite"],
                "type":           m_meta["type"],
                "date":           m_meta["created_at"][:10] if m_meta["created_at"] else "",
                "score_anomalie": score,
                "raison":         (
                    f"Quantité {m_meta['quantite']} inhabituellement {sens} "
                    f"pour un mouvement de type {m_meta['type']} "
                    f"(moyenne : {round(moyenne_quantite, 1)})"
                )
            })

    # Trier par score d'anomalie (les plus anormaux en premier)
    anomalies.sort(key=lambda x: x["score_anomalie"])

    return {
        "success":          True,
        "message":          f"Analyse terminée — {len(mouvements)} mouvements analysés",
        "total_mouvements": len(mouvements),
        "anomalies_count":  len(anomalies),
        "moyenne_quantite": round(moyenne_quantite, 2),
        "anomalies":        anomalies
    }