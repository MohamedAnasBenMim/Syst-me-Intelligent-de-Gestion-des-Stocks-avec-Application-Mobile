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
    lorsqu'une alerte critique, rupture ou expiration proche est déclenchée.
    Ne bloque pas si le service IA-RAG ne répond pas.
    """
    if alerte.niveau not in (NiveauAlerte.CRITIQUE, NiveauAlerte.RUPTURE, NiveauAlerte.EXPIRATION_PROCHE):
        return

    # Pour expiration proche : contexte spécifique "promotion"
    if alerte.niveau == NiveauAlerte.EXPIRATION_PROCHE:
        contexte = (
            f"{alerte.message or ''} — "
            "Le produit arrive à expiration. Recommander une action commerciale "
            "(promotion, déstockage, don) pour écouler le stock avant la date limite."
        )
    else:
        contexte = alerte.message

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
                    "contexte_supplementaire": contexte
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    except Exception:
        pass  # IA-RAG indisponible → on continue sans bloquer


async def get_user_email(user_id: int, token: str) -> tuple[str | None, str | None]:
    """
    Appelle Service Auth pour récupérer l'email et le nom d'un utilisateur par son ID.
    Retourne (email, nom) ou (None, None) si indisponible.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/auth/utilisateurs/{user_id}/email",
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code == 200:
                data = r.json()
                return data.get("email"), data.get("nom")
    except Exception:
        pass
    return None, None


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
        NiveauAlerte.RUPTURE          : f"🚨 RUPTURE de stock — {data.produit_nom or data.produit_id} dans {data.entrepot_nom or data.entrepot_id} — quantité = 0",
        NiveauAlerte.CRITIQUE         : f"⚠️ Stock CRITIQUE — {data.produit_nom or data.produit_id} dans {data.entrepot_nom or data.entrepot_id} — quantité = {data.quantite_actuelle} (min: {data.seuil_alerte_min})",
        NiveauAlerte.SURSTOCK         : f"📦 SURSTOCK — {data.produit_nom or data.produit_id} dans {data.entrepot_nom or data.entrepot_id} — quantité = {data.quantite_actuelle} (max: {data.seuil_alerte_max})",
        NiveauAlerte.EXPIRATION_PROCHE: data.message or f"📅 EXPIRATION PROCHE — {data.produit_nom or data.produit_id} dans {data.entrepot_nom or data.entrepot_id} — Recommandation IA : envisager une promotion pour écouler le stock avant expiration",
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


@router.post(
    "/alertes/verifier-expirations",
    summary="Scanner tout le stock et déclencher les alertes d'expiration proche",
    description="""
    Parcourt tous les produits actifs en stock.
    Pour chaque produit dont la date d'expiration est dans les **30 prochains jours**
    et dont la quantité en stock est > 0, déclenche automatiquement une alerte
    *expiration_proche* avec recommandation IA (promotion).

    Peut être appelé manuellement ou planifié (cron / n8n).
    """
)
async def verifier_expirations_stock(
    seuil_jours : int                          = Query(30, ge=1, le=365, description="Nombre de jours avant expiration pour déclencher l'alerte"),
    db          : Session                      = Depends(get_db),
    current_user: dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials : HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    alertes_declenchees = 0
    produits_analyses   = 0
    erreurs             = []

    # ── 1. Récupérer tous les produits actifs depuis Service Stock ──
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/produits?limit=500",
                headers={"Authorization": f"Bearer {token}"},
            )
            produits = r.json() if r.status_code == 200 else []
    except Exception as e:
        return {
            "success": False,
            "message": f"Impossible de contacter Service Stock : {e}",
            "alertes_declenchees": 0,
            "produits_analyses": 0,
        }

    today = datetime.now().date()

    for produit in produits:
        date_exp_str = produit.get("date_expiration")
        if not date_exp_str:
            continue  # produit sans date d'expiration → on ignore

        try:
            date_exp = datetime.strptime(date_exp_str, "%Y-%m-%d").date()
        except ValueError:
            continue

        jours_restants = (date_exp - today).days
        if jours_restants <= 0 or jours_restants > seuil_jours:
            continue  # déjà expiré ou loin de l'échéance

        produits_analyses += 1
        produit_id  = produit.get("id")
        produit_nom = produit.get("designation", f"Produit {produit_id}")

        # ── 2. Récupérer les stocks de ce produit dans tous les entrepôts ──
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                rs = await client.get(
                    f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/produit/{produit_id}",
                    headers={"Authorization": f"Bearer {token}"},
                )
                stocks = rs.json() if rs.status_code == 200 else []
        except Exception:
            stocks = []

        for stock in stocks:
            quantite = float(stock.get("quantite") or 0)
            if quantite <= 0:
                continue  # pas de stock → pas d'alerte

            entrepot_id  = stock.get("entrepot_id", 0)
            entrepot_nom = f"Entrepôt {entrepot_id}"

            # ── Récupérer le nom de l'entrepôt ──
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    rw = await client.get(
                        f"{settings.WAREHOUSE_SERVICE_URL}/api/v1/entrepots/{entrepot_id}",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if rw.status_code == 200:
                        entrepot_nom = rw.json().get("nom", entrepot_nom)
            except Exception:
                pass

            # ── Vérifier qu'une alerte identique n'est pas déjà active ──
            alerte_existante = db.query(Alerte).filter(
                Alerte.produit_id  == produit_id,
                Alerte.entrepot_id == entrepot_id,
                Alerte.niveau      == NiveauAlerte.EXPIRATION_PROCHE,
                Alerte.statut      == StatutAlerte.ACTIVE,
            ).first()
            if alerte_existante:
                continue  # déjà alerté pour ce produit+entrepôt

            # ── 3. Créer l'alerte et notifier ──
            message = (
                f"📅 EXPIRATION PROCHE — {produit_nom} dans {entrepot_nom} — "
                f"Date d'expiration : {date_exp_str} (dans {jours_restants} jour(s)) — "
                f"Quantité en stock : {quantite} — "
                f"Recommandation IA : envisager une promotion pour écouler le stock avant expiration."
            )
            nouvelle_alerte = Alerte(
                niveau              = NiveauAlerte.EXPIRATION_PROCHE,
                statut              = StatutAlerte.ACTIVE,
                produit_id          = produit_id,
                produit_nom         = produit_nom,
                entrepot_id         = entrepot_id,
                entrepot_nom        = entrepot_nom,
                quantite_actuelle   = quantite,
                message             = message,
                notification_envoyee= False,
            )
            db.add(nouvelle_alerte)
            db.commit()
            db.refresh(nouvelle_alerte)

            await notifier_responsables(nouvelle_alerte, token)
            nouvelle_alerte.notification_envoyee = True
            db.commit()

            await generer_recommandation_ia(nouvelle_alerte, token)
            alertes_declenchees += 1

    return {
        "success":            True,
        "message":            f"Scan terminé — {produits_analyses} produit(s) analysé(s)",
        "seuil_jours":        seuil_jours,
        "produits_analyses":  produits_analyses,
        "alertes_declenchees": alertes_declenchees,
    }


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

    anomalies_detectees    = []
    alertes_creees         = 0
    notifications_a_envoyer = []  # Liste des (email, nom, mouvement, raison) à notifier

    def creer_alerte(m, type_anomalie, raison):
        nonlocal alertes_creees
        # Éviter de créer un doublon d'alerte pour le même mouvement
        existante = db.query(Alerte).filter(
            Alerte.produit_id == (m.get("produit_id") or 0),
            Alerte.message.contains(f"mouvement #{m.get('id')}"),
            Alerte.statut == StatutAlerte.ACTIVE
        ).first()
        if not existante:
            db.add(Alerte(
                niveau            = NiveauAlerte.CRITIQUE,
                statut            = StatutAlerte.ACTIVE,
                produit_id        = m.get("produit_id") or 0,
                produit_nom       = m.get("produit_nom", ""),
                entrepot_id       = m.get("entrepot_source_id") or m.get("entrepot_dest_id") or 0,
                quantite_actuelle = float(m.get("quantite") or 0),
                message           = f"ANOMALIE [{type_anomalie}] mouvement #{m.get('id')} — {raison}"
            ))
            alertes_creees += 1
            # Enregistrer pour notification email à l'utilisateur concerné
            utilisateur_id = m.get("utilisateur_id")
            if utilisateur_id:
                notifications_a_envoyer.append({
                    "utilisateur_id": utilisateur_id,
                    "utilisateur_nom": m.get("utilisateur_nom", ""),
                    "produit_id":  m.get("produit_id"),
                    "produit_nom": m.get("produit_nom", ""),
                    "entrepot_id": m.get("entrepot_source_id") or m.get("entrepot_dest_id"),
                    "entrepot_nom": m.get("entrepot_source_nom") or m.get("entrepot_dest_nom", ""),
                    "quantite":    float(m.get("quantite") or 0),
                    "raison":      raison,
                })

    # ════════════════════════════════════════════════════
    # ANOMALIE 1 — Quantité = 0
    # ════════════════════════════════════════════════════
    for m in mouvements:
        if float(m.get("quantite") or 0) == 0:
            raison = "Mouvement enregistré avec une quantité de 0 — saisie invalide"
            anomalies_detectees.append({
                "mouvement_id":  m.get("id"),
                "produit_id":    m.get("produit_id"),
                "produit_nom":   m.get("produit_nom"),
                "quantite":      0,
                "type":          m.get("type_mouvement"),
                "date":          (m.get("created_at") or "")[:10],
                "type_anomalie": "quantite_zero",
                "raison":        raison
            })
            creer_alerte(m, "quantite_zero", raison)

    # ════════════════════════════════════════════════════
    # ANOMALIE 2 — Stock négatif après sortie
    # ════════════════════════════════════════════════════
    for m in mouvements:
        if m.get("type_mouvement") != "sortie":
            continue
        stock_apres = m.get("stock_apres")
        if stock_apres is not None and float(stock_apres) < 0:
            raison = (
                f"Sortie de {m.get('quantite')} unités a rendu le stock négatif "
                f"({stock_apres} unités) — impossible physiquement"
            )
            anomalies_detectees.append({
                "mouvement_id":  m.get("id"),
                "produit_id":    m.get("produit_id"),
                "produit_nom":   m.get("produit_nom"),
                "quantite":      float(m.get("quantite") or 0),
                "type":          "sortie",
                "date":          (m.get("created_at") or "")[:10],
                "type_anomalie": "stock_negatif",
                "raison":        raison
            })
            creer_alerte(m, "stock_negatif", raison)

    # ════════════════════════════════════════════════════
    # ANOMALIE 3 — Doublon exact (même seconde)
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
                diff  = int((dt_m2 - dt_m).total_seconds())
                raison = (
                    f"Doublon probable — même mouvement ({m.get('type_mouvement')}, "
                    f"{m.get('quantite')} unités, produit {m.get('produit_id')}) "
                    f"répété {diff} secondes après (IDs: {m.get('id')} et {m2.get('id')})"
                )
                anomalies_detectees.append({
                    "mouvement_id":  m2.get("id"),
                    "produit_id":    m2.get("produit_id"),
                    "produit_nom":   m2.get("produit_nom"),
                    "quantite":      float(m2.get("quantite") or 0),
                    "type":          m2.get("type_mouvement"),
                    "date":          (m2.get("created_at") or "")[:10],
                    "type_anomalie": "doublon",
                    "raison":        raison
                })
                creer_alerte(m2, "doublon", raison)

    db.commit()

    # ── Envoyer notifications email aux utilisateurs concernés ──
    # utilisateur_nom dans les mouvements contient l'email (stocké depuis le JWT)
    notifications_envoyees = 0
    for notif in notifications_a_envoyer:
        # L'email est stocké dans utilisateur_nom du mouvement
        user_email = notif.get("utilisateur_nom")
        if not user_email or "@" not in user_email:
            # Fallback : appel Auth si utilisateur_nom n'est pas un email
            user_email, _ = await get_user_email(notif["utilisateur_id"], token)
        if not user_email:
            continue
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{settings.NOTIFICATION_SERVICE_URL}/api/v1/notifications/envoyer",
                    json={
                        "type":               "alerte_stock",
                        "niveau":             "critique",
                        "produit_id":         notif["produit_id"],
                        "produit_nom":        notif["produit_nom"],
                        "entrepot_id":        notif["entrepot_id"],
                        "entrepot_nom":       notif["entrepot_nom"],
                        "quantite":           notif["quantite"],
                        "message":            notif["raison"],
                        "destinataire_email": user_email,
                        "destinataire_nom":   notif.get("utilisateur_nom", ""),
                    },
                    headers={"Authorization": f"Bearer {token}"},
                )
            notifications_envoyees += 1
        except Exception:
            pass

    return {
        "success":                  True,
        "message":                  f"Analyse terminée — {len(mouvements)} mouvements analysés",
        "total_mouvements":         len(mouvements),
        "anomalies_count":          len(anomalies_detectees),
        "alertes_creees":           alertes_creees,
        "notifications_envoyees":   notifications_envoyees,
        "anomalies":                anomalies_detectees
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