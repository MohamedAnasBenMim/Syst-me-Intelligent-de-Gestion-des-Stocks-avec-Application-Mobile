# app/routes.py — service_alertes/

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import httpx
import numpy as np
from sklearn.ensemble import IsolationForest

from app.database import get_db
from app.models import Alerte, NiveauAlerte, StatutAlerte
from app.schemas import (
    AlerteDeclenchement, AlerteResponse, AlerteUpdate,
    AlerteList, AlerteStats, MessageResponse
)
from app.dependencies import (
    get_current_user,
    get_current_admin,
    get_current_gestionnaire_or_admin,
    get_pagination
)
from app.config import settings

router  = APIRouter()
security = HTTPBearer()


# ═══════════════════════════════════════════════════════════
# FONCTION UTILITAIRE — Notifier Service Notification
# ═══════════════════════════════════════════════════════════

async def generer_recommandation_ia(alerte: Alerte, token: str):
    """
    Appelle Service IA-RAG pour générer automatiquement une recommandation
    lorsqu'une alerte critique ou rupture est déclenchée.
    Ne bloque pas si le service IA-RAG ne répond pas.
    """
    if alerte.niveau not in (NiveauAlerte.CRITIQUE, NiveauAlerte.RUPTURE):
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.IA_RAG_SERVICE_URL}/api/v1/ia/recommandation",
                json={
                    "produit_id":  alerte.produit_id,
                    "entrepot_id": alerte.entrepot_id,
                    "alerte_id":   alerte.id,
                    "stock_actuel": alerte.quantite_actuelle,
                    "seuil_min":   alerte.seuil_alerte_min,
                    "contexte_supplementaire": alerte.message
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    except Exception:
        pass  # IA-RAG indisponible → on continue sans bloquer


async def notifier_responsables(alerte: Alerte, token: str):
    """
    Appelle Service Notification pour envoyer
    email/push aux responsables concernés.
    Ne bloque pas si Service Notification ne répond pas.
    """
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{settings.NOTIFICATION_SERVICE_URL}/api/v1/notifications/envoyer",
                json={
                    "type"           : "alerte_stock",
                    "niveau"         : alerte.niveau,
                    "produit_id"     : alerte.produit_id,
                    "produit_nom"    : alerte.produit_nom,
                    "entrepot_id"    : alerte.entrepot_id,
                    "entrepot_nom"   : alerte.entrepot_nom,
                    "quantite"       : alerte.quantite_actuelle,
                    "message"        : alerte.message,
                    "alerte_id"      : alerte.id
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
    except Exception:
        # Service Notification indisponible → on continue sans bloquer
        pass


# ═══════════════════════════════════════════════════════════
# ROUTES ALERTES
# ═══════════════════════════════════════════════════════════

@router.post(
    "/alertes/declencher",
    response_model=AlerteResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,  # Endpoint interne — appelé par Service-Stock uniquement
    summary="Déclencher une alerte",
    description="""
    Appelé par Service Stock après chaque augmenter/diminuer.
    - Si niveau = normal   → résout les alertes actives existantes
    - Si niveau != normal  → crée une nouvelle alerte et notifie
    """
)
async def declencher_alerte(
    data        : AlerteDeclenchement,
    db          : Session                      = Depends(get_db),
    current_user: dict                         = Depends(get_current_user),
    credentials : HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    # ── Si niveau normal → résoudre les alertes actives ───
    if data.niveau == NiveauAlerte.NORMAL:
        alertes_actives = db.query(Alerte).filter(
            Alerte.produit_id  == data.produit_id,
            Alerte.entrepot_id == data.entrepot_id,
            Alerte.statut      == StatutAlerte.ACTIVE
        ).all()
        for alerte in alertes_actives:
            alerte.statut = StatutAlerte.RESOLUE
        db.commit()
        return AlerteResponse(
            id                   = 0,
            niveau               = NiveauAlerte.NORMAL,
            statut               = StatutAlerte.RESOLUE,
            produit_id           = data.produit_id,
            entrepot_id          = data.entrepot_id,
            quantite_actuelle    = data.quantite_actuelle,
            notification_envoyee = False,
            created_at           = datetime.now()
        )

    # ── Vérifier si une alerte identique est déjà active ──
    alerte_existante = db.query(Alerte).filter(
        Alerte.produit_id  == data.produit_id,
        Alerte.entrepot_id == data.entrepot_id,
        Alerte.niveau      == data.niveau,
        Alerte.statut      == StatutAlerte.ACTIVE
    ).first()

    if alerte_existante:
        # Mettre à jour la quantité actuelle
        alerte_existante.quantite_actuelle = data.quantite_actuelle
        db.commit()
        db.refresh(alerte_existante)
        return alerte_existante

    # ── Générer le message selon le niveau ─────────────────
    messages = {
        NiveauAlerte.RUPTURE : f"🚨 RUPTURE de stock — {data.produit_nom or data.produit_id} dans {data.entrepot_nom or data.entrepot_id} — quantité = 0",
        NiveauAlerte.CRITIQUE: f"⚠️ Stock CRITIQUE — {data.produit_nom or data.produit_id} dans {data.entrepot_nom or data.entrepot_id} — quantité = {data.quantite_actuelle} (min: {data.seuil_alerte_min})",
        NiveauAlerte.SURSTOCK: f"📦 SURSTOCK — {data.produit_nom or data.produit_id} dans {data.entrepot_nom or data.entrepot_id} — quantité = {data.quantite_actuelle} (max: {data.seuil_alerte_max})",
    }

    # ── Créer la nouvelle alerte ───────────────────────────
    nouvelle_alerte = Alerte(
        niveau              = data.niveau,
        statut              = StatutAlerte.ACTIVE,
        produit_id          = data.produit_id,
        produit_nom         = data.produit_nom,
        entrepot_id         = data.entrepot_id,
        entrepot_nom        = data.entrepot_nom,
        quantite_actuelle   = data.quantite_actuelle,
        seuil_alerte_min    = data.seuil_alerte_min,
        seuil_alerte_max    = data.seuil_alerte_max,
        message             = data.message or messages.get(data.niveau, ""),
        notification_envoyee= False
    )
    db.add(nouvelle_alerte)
    db.commit()
    db.refresh(nouvelle_alerte)

    # ── Notifier Service Notification ─────────────────────
    await notifier_responsables(nouvelle_alerte, token)
    nouvelle_alerte.notification_envoyee = True
    db.commit()
    db.refresh(nouvelle_alerte)

    # ── Recommandation IA automatique (critique/rupture) ──
    await generer_recommandation_ia(nouvelle_alerte, token)

    return nouvelle_alerte


@router.get(
    "/alertes",
    response_model=AlerteList,
    summary="Lister les alertes",
    description="""
    Retourne la liste paginée des alertes avec filtres :
    - **niveau**      : normal / critique / rupture / surstock
    - **statut**      : active / traitee / resolue / ignoree
    - **produit_id**  : filtre par produit
    - **entrepot_id** : filtre par entrepôt
    """
)
async def lister_alertes(
    niveau      : Optional[str] = Query(None),
    statut      : Optional[str] = Query(None),
    produit_id  : Optional[int] = Query(None),
    entrepot_id : Optional[int] = Query(None),
    db          : Session       = Depends(get_db),
    current_user: dict          = Depends(get_current_user),
    pagination  : dict          = Depends(get_pagination)
):
    query = db.query(Alerte)

    if niveau:
        query = query.filter(Alerte.niveau == niveau)
    if statut:
        query = query.filter(Alerte.statut == statut)
    if produit_id:
        query = query.filter(Alerte.produit_id == produit_id)
    if entrepot_id:
        query = query.filter(Alerte.entrepot_id == entrepot_id)

    total   = query.count()
    alertes = (
        query
        .order_by(Alerte.created_at.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
        .all()
    )
    return AlerteList(
        total   = total,
        page    = pagination["page"],
        per_page= pagination["per_page"],
        alertes = alertes
    )


@router.get(
    "/alertes/actives",
    response_model=AlerteList,
    summary="Alertes actives uniquement",
    description="Retourne toutes les alertes non traitées — ruptures, critiques, surstocks."
)
async def alertes_actives(
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
    pagination  : dict    = Depends(get_pagination)
):
    query = db.query(Alerte).filter(
        Alerte.statut == StatutAlerte.ACTIVE
    ).order_by(Alerte.created_at.desc())

    total   = query.count()
    alertes = query.offset(pagination["skip"]).limit(pagination["limit"]).all()

    return AlerteList(
        total   = total,
        page    = pagination["page"],
        per_page= pagination["per_page"],
        alertes = alertes
    )


@router.get(
    "/alertes/stats",
    response_model=AlerteStats,
    summary="Statistiques des alertes",
    description="Retourne les statistiques pour le tableau de bord."
)
async def stats_alertes(
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_gestionnaire_or_admin)
):
    return AlerteStats(
        total_actives  = db.query(Alerte).filter(Alerte.statut  == StatutAlerte.ACTIVE).count(),
        total_ruptures = db.query(Alerte).filter(Alerte.niveau  == NiveauAlerte.RUPTURE,  Alerte.statut == StatutAlerte.ACTIVE).count(),
        total_critiques= db.query(Alerte).filter(Alerte.niveau  == NiveauAlerte.CRITIQUE, Alerte.statut == StatutAlerte.ACTIVE).count(),
        total_surstocks= db.query(Alerte).filter(Alerte.niveau  == NiveauAlerte.SURSTOCK, Alerte.statut == StatutAlerte.ACTIVE).count(),
        total_traitees = db.query(Alerte).filter(Alerte.statut  == StatutAlerte.TRAITEE).count(),
        total_resolues = db.query(Alerte).filter(Alerte.statut  == StatutAlerte.RESOLUE).count(),
    )


# ═══════════════════════════════════════════════════════════
# ISOLATION FOREST — Détection d'anomalies en temps réel
# ═══════════════════════════════════════════════════════════

@router.post(
    "/alertes/anomalies/detecter",
    summary="Détecter les anomalies dans les mouvements (Isolation Forest)",
    description="""
    Utilise Isolation Forest (ML) pour détecter des comportements anormaux :
    - Quantité de mouvement inhabituellement grande ou petite
    - Fréquence de sorties suspecte par produit
    - Variation de stock aberrante
    Crée automatiquement des alertes pour les anomalies détectées.
    """
)
async def detecter_anomalies(
    db          : Session                      = Depends(get_db),
    current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials : HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    # ── Récupérer les mouvements depuis Service Mouvement ──
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{settings.MOUVEMENT_SERVICE_URL}/api/v1/mouvements?limit=500",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            mouvements = r.json().get("mouvements", []) if r.status_code == 200 else []
    except Exception:
        mouvements = []

    if len(mouvements) < 5:
        return {
            "success": False,
            "message": "Pas assez de mouvements pour l'analyse (minimum 5)",
            "anomalies": []
        }

    # ── Construire la matrice de features ──────────────────
    # Features : [quantite, type_encoded, produit_id, entrepot_id]
    features, meta = [], []
    type_map = {"entree": 0, "sortie": 1, "transfert": 2}

    for m in mouvements:
        quantite    = float(m.get("quantite") or 0)
        type_mvt    = type_map.get(m.get("type_mouvement", ""), 0)
        produit_id  = float(m.get("produit_id") or 0)
        entrepot_id = float(m.get("entrepot_source_id") or m.get("entrepot_dest_id") or 0)

        features.append([quantite, type_mvt, produit_id, entrepot_id])
        meta.append({
            "id":           m.get("id"),
            "produit_id":   m.get("produit_id"),
            "produit_nom":  m.get("produit_nom", f"Produit {m.get('produit_id')}"),
            "quantite":     quantite,
            "type":         m.get("type_mouvement"),
            "created_at":   m.get("created_at", "")
        })

    X = np.array(features)

    # ── Entraîner Isolation Forest ─────────────────────────
    # contamination=0.1 → 10% des données considérées comme anomalies
    model = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
    predictions = model.fit_predict(X)   # -1 = anomalie, 1 = normal
    scores      = model.score_samples(X) # score négatif = plus anormal

    # ── Collecter les anomalies ────────────────────────────
    anomalies_detectees = []
    alertes_creees      = 0

    for i, pred in enumerate(predictions):
        if pred == -1:
            m_meta = meta[i]
            score  = round(float(scores[i]), 4)

            anomalie = {
                "mouvement_id": m_meta["id"],
                "produit_id":   m_meta["produit_id"],
                "produit_nom":  m_meta["produit_nom"],
                "quantite":     m_meta["quantite"],
                "type":         m_meta["type"],
                "date":         m_meta["created_at"][:10] if m_meta["created_at"] else "",
                "score_anomalie": score,
                "raison": f"Quantité {m_meta['quantite']} inhabituellement {'élevée' if m_meta['quantite'] > np.mean(X[:,0]) else 'basse'} pour un mouvement de type {m_meta['type']}"
            }
            anomalies_detectees.append(anomalie)

            # Créer une alerte en base pour chaque anomalie
            nouvelle_alerte = Alerte(
                niveau            = NiveauAlerte.CRITIQUE,
                statut            = StatutAlerte.ACTIVE,
                produit_id        = m_meta["produit_id"] or 0,
                produit_nom       = m_meta["produit_nom"],
                entrepot_id       = 0,
                quantite_actuelle = m_meta["quantite"],
                message           = f"🤖 ANOMALIE IA — {anomalie['raison']} (score: {score})"
            )
            db.add(nouvelle_alerte)
            alertes_creees += 1

    db.commit()

    return {
        "success":           True,
        "message":           f"Analyse terminée — {len(mouvements)} mouvements analysés",
        "total_mouvements":  len(mouvements),
        "anomalies_count":   len(anomalies_detectees),
        "alertes_creees":    alertes_creees,
        "anomalies":         anomalies_detectees
    }


@router.get(
    "/alertes/{alerte_id}",
    response_model=AlerteResponse,
    summary="Détail d'une alerte"
)
async def get_alerte(
    alerte_id   : int,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user)
):
    alerte = db.query(Alerte).filter(Alerte.id == alerte_id).first()
    if not alerte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alerte {alerte_id} introuvable"
        )
    return alerte


@router.put(
    "/alertes/{alerte_id}",
    response_model=AlerteResponse,
    summary="Modifier le statut d'une alerte",
    description="Permet de marquer une alerte comme traitée, résolue ou ignorée."
)
async def modifier_alerte(
    alerte_id   : int,
    data        : AlerteUpdate,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_gestionnaire_or_admin)
):
    alerte = db.query(Alerte).filter(Alerte.id == alerte_id).first()
    if not alerte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alerte {alerte_id} introuvable"
        )

    alerte.statut = data.statut

    # Si traitée → enregistrer qui et quand
    if data.statut == StatutAlerte.TRAITEE:
        alerte.traite_par = current_user.get("user_id")
        alerte.traite_le  = datetime.now()

    db.commit()
    db.refresh(alerte)
    return alerte