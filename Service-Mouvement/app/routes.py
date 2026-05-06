# app/routes.py — service_mouvement/

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
import httpx

from app.database import get_db
from app.models import Mouvement, TypeMouvement, StatutMouvement
from app.schemas import (
    MouvementCreate, MouvementUpdate, MouvementResponse, MouvementList,
    MessageResponse
)
from app.dependencies import (
    get_current_user,
    get_current_admin,
    get_current_gestionnaire_or_admin,
    get_all_roles,
    get_pagination
)
from app.config import settings

router = APIRouter()

# Instance HTTPBearer pour extraire le token brut
security = HTTPBearer()


# ═══════════════════════════════════════════════════════════
# FONCTIONS UTILITAIRES — Appels HTTP vers Service Stock
# ═══════════════════════════════════════════════════════════

async def appeler_stock_augmenter(
    produit_id    : int,
    location_id   : int,   # = depot_id si DEPOT, = magasin_id si MAGASIN
    quantite      : float,
    token         : str,
    mouvement_ref : Optional[str] = None,
    location_type : Optional[str] = None,   # "DEPOT" | "MAGASIN"
) -> dict:
    """
    Appelle Service Stock PATCH /stocks/augmenter.
    Utilisé pour ENTREE (entrepot_dest) et TRANSFERT (entrepot_dest).
    location_id = depot_id ou magasin_id selon location_type.
    """
    payload = {
        "produit_id"    : produit_id,
        "quantite"      : quantite,
        "mouvement_ref" : mouvement_ref,
    }
    if location_type == "DEPOT":
        payload["depot_id"]      = location_id
        payload["location_type"] = "DEPOT"
    elif location_type == "MAGASIN":
        payload["magasin_id"]    = location_id
        payload["location_type"] = "MAGASIN"
    else:
        payload["entrepot_id"] = location_id   # compat legacy sans location_type

    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/augmenter",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Service Stock erreur augmenter : {response.json()}"
        )
    return response.json()


async def appeler_stock_diminuer(
    produit_id    : int,
    location_id   : int,   # = depot_id si DEPOT, = magasin_id si MAGASIN
    quantite      : float,
    token         : str,
    mouvement_ref : Optional[str] = None,
    location_type : Optional[str] = None,   # "DEPOT" | "MAGASIN"
) -> dict:
    """
    Appelle Service Stock PATCH /stocks/diminuer.
    Utilisé pour SORTIE (entrepot_source) et TRANSFERT (entrepot_source).
    location_id = depot_id ou magasin_id selon location_type.
    Si stock insuffisant → Service Stock retourne 400 → on propage l'erreur.
    """
    payload = {
        "produit_id"    : produit_id,
        "quantite"      : quantite,
        "mouvement_ref" : mouvement_ref,
    }
    if location_type == "DEPOT":
        payload["depot_id"]      = location_id
        payload["location_type"] = "DEPOT"
    elif location_type == "MAGASIN":
        payload["magasin_id"]    = location_id
        payload["location_type"] = "MAGASIN"
    else:
        payload["entrepot_id"] = location_id   # compat legacy sans location_type

    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/diminuer",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.json().get("detail", "Erreur Service Stock")
        )
    return response.json()


async def verifier_anomalies_mouvement(token: str):
    """
    Appelle Service Alertes pour déclencher la détection d'anomalies
    après chaque nouveau mouvement. Ne bloque pas si le service ne répond pas.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{settings.ALERTES_SERVICE_URL}/api/v1/alertes/anomalies/detecter",
                headers={"Authorization": f"Bearer {token}"},
            )
    except Exception:
        pass  # Service Alertes indisponible → on continue sans bloquer


async def declencher_anomalie_stock_insuffisant(
    produit_id:         int,
    produit_nom:        str,
    entrepot_id:        int,
    entrepot_nom:       str,
    quantite_demandee:  float,
    quantite_disponible: float,
    type_mouvement:     str,
    token:              str,
) -> None:
    """
    Crée une alerte CRITIQUE de type anomalie lorsqu'une sortie ou un transfert
    est tenté avec une quantité supérieure au stock disponible.
    Ne bloque pas si Service Alertes ne répond pas.
    """
    manque  = round(quantite_demandee - quantite_disponible, 2)
    message = (
        f"🚫 ANOMALIE STOCK INSUFFISANT — {type_mouvement} de {quantite_demandee} unités "
        f"refusé pour {produit_nom} dans {entrepot_nom} — "
        f"Stock disponible : {quantite_disponible} unités — "
        f"Manque : {manque} unités"
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.ALERTES_SERVICE_URL}/api/v1/alertes/declencher",
                json={
                    "produit_id":        produit_id,
                    "produit_nom":       produit_nom,
                    "entrepot_id":       entrepot_id,
                    "entrepot_nom":      entrepot_nom,
                    "niveau":            "CRITIQUE",
                    "quantite_actuelle": quantite_disponible,
                    "message":           message,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    except Exception:
        pass


async def indexer_mouvement_dans_rag(mouvement_id: int, produit_id: int,
                                      entrepot_id: int, token: str):
    """
    Appelle Service IA-RAG pour indexer le nouveau mouvement dans ChromaDB.
    Ne bloque pas si le service IA-RAG ne répond pas.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.IA_RAG_SERVICE_URL}/api/v1/ia/embedding/vectoriser",
                json={"produit_id": produit_id, "entrepot_id": entrepot_id,
                      "force_update": False},
                headers={"Authorization": f"Bearer {token}"},
            )
    except Exception:
        pass  # IA-RAG indisponible → on continue sans bloquer


async def recuperer_nom_entrepot(entrepot_id: int, token: str, location_type: Optional[str] = None) -> str:
    """
    Résout le nom d'un dépôt ou magasin depuis Service Warehouse.
    Essaie /depots/{id} puis /magasins/{id} si le premier échoue.
    """
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            endpoints = []
            if location_type == "DEPOT":
                endpoints = ["depots", "magasins"]
            elif location_type == "MAGASIN":
                endpoints = ["magasins", "depots"]
            else:
                endpoints = ["depots", "magasins"]

            for ep in endpoints:
                r = await client.get(
                    f"{settings.WAREHOUSE_SERVICE_URL}/api/v1/{ep}/{entrepot_id}",
                    headers=headers,
                )
                if r.status_code == 200:
                    return r.json().get("nom", f"Entrepôt {entrepot_id}")
    except Exception:
        pass
    return f"Entrepôt {entrepot_id}"


async def recuperer_nom_zone(zone_id: int, token: str) -> str:
    """
    Appelle Service Warehouse GET /zones/{id}
    pour récupérer le nom de la zone (dénormalisation).
    Retourne "Zone {id}" si le service ne répond pas.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.WAREHOUSE_SERVICE_URL}/api/v1/zones/{zone_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
        if response.status_code == 200:
            return response.json().get("nom", f"Zone {zone_id}")
    except Exception:
        pass
    return f"Zone {zone_id}"


async def recuperer_produit_details(produit_id: int, token: str) -> dict:
    """
    Appelle Service Stock GET /produits/{id}
    pour récupérer tous les détails du produit (dont date_expiration et reference).
    Retourne {} si indisponible.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/produits/{produit_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    return {}


async def assigner_reference_produit(produit_id: int, token: str) -> None:
    """
    Appelle Service Stock PATCH /produits/{id}/ajouter-reference
    pour auto-générer et assigner une référence au produit.
    Ne bloque pas si le service ne répond pas.
    """
    try:
        async with httpx.AsyncClient() as client:
            await client.patch(
                f"{settings.STOCK_SERVICE_URL}/api/v1/produits/{produit_id}/ajouter-reference",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
    except Exception:
        pass


async def appeler_ia_recommandation_expiration(
    produit_id: int,
    produit_nom: str,
    entrepot_id: int,
    stock_actuel: float,
    prix_actuel: float,
    jours_restants: int,
    date_expiration: str,
    token: str,
) -> str | None:
    """
    Appelle Service IA-RAG POST /ia/recommander-promotion pour un produit proche de l'expiration.
    Retourne le texte de recommandation IA (pourcentage + motif),
    ou None si l'IA ne répond pas dans les 10 secondes.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{settings.IA_RAG_SERVICE_URL}/api/v1/ia/recommander-promotion",
                json={
                    "produit_id":              produit_id,
                    "produit_nom":             produit_nom,
                    "stock_actuel":            stock_actuel,
                    "prix_actuel":             prix_actuel,
                    "jours_avant_expiration":  jours_restants,
                    "contexte_supplementaire": f"Date d'expiration : {date_expiration}",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
        if r.status_code == 200:
            data = r.json()
            if data.get("success"):
                pct    = data.get("pourcentage_suggere", 0)
                motif  = data.get("motif", "")
                prix_p = data.get("prix_promo_estime")
                msg    = f"Promotion -{pct:.0f}% recommandée"
                if prix_p:
                    msg += f" (prix promo : {prix_p} DT)"
                if motif:
                    msg += f" — {motif}"
                return msg
    except Exception:
        pass
    return None  # IA indisponible → fallback sur texte par défaut


async def declencher_alerte_expiration(
    produit_id: int,
    produit_nom: str,
    entrepot_id: int,
    entrepot_nom: str,
    quantite: float,
    date_expiration: str,
    jours_restants: int,
    token: str,
) -> None:
    """
    Appelle Service Alertes pour déclencher une alerte d'expiration proche.
    La recommandation IA (promotion) est générée automatiquement par Service Alertes.
    Ne bloque pas si le service ne répond pas.
    """
    message = (
        f"EXPIRATION PROCHE — {produit_nom} dans {entrepot_nom} — "
        f"Date d'expiration : {date_expiration} (dans {jours_restants} jour(s)) — "
        f"Quantité en stock : {quantite} — "
        f"Recommandation IA : envisager une promotion pour écouler le stock avant expiration."
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.ALERTES_SERVICE_URL}/api/v1/alertes/declencher",
                json={
                    "produit_id":        produit_id,
                    "produit_nom":       produit_nom,
                    "entrepot_id":       entrepot_id,
                    "entrepot_nom":      entrepot_nom,
                    "niveau":            "expiration_proche",
                    "quantite_actuelle": quantite,
                    "message":           message,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    except Exception:
        pass  # Service Alertes indisponible → on continue sans bloquer


async def recuperer_nom_produit(produit_id: int, token: str) -> str:
    """
    Appelle Service Stock GET /produits/{id}
    pour récupérer le nom du produit (dénormalisation).
    Retourne "Produit {id}" si le service ne répond pas.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/produits/{produit_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
        if response.status_code == 200:
            return response.json().get("designation", f"Produit {produit_id}")
    except Exception:
        pass
    return f"Produit {produit_id}"


async def appeler_warehouse_update_capacite(
    location_id   : int,
    delta         : float,
    token         : str,
    location_type : Optional[str] = None,
) -> None:
    """
    Met à jour capacite_utilisee dans Service-Warehouse (best-effort).
    location_type "DEPOT" → PATCH /depots/{id}/capacite
    location_type "MAGASIN" → PATCH /magasins/{id}/capacite
    Sans location_type → essaie les deux.
    """
    if not location_id:
        return
    endpoints = (
        ["depots"]   if location_type == "DEPOT"
        else ["magasins"] if location_type == "MAGASIN"
        else ["depots", "magasins"]
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for ep in endpoints:
                r = await client.patch(
                    f"{settings.WAREHOUSE_SERVICE_URL}/api/v1/{ep}/{location_id}/capacite",
                    json={"delta": delta},
                    headers={"Authorization": f"Bearer {token}"},
                )
                if r.status_code == 200:
                    break
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════
# ROUTES MOUVEMENTS
# ═══════════════════════════════════════════════════════════

@router.post(
    "/mouvements",
    response_model=MouvementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un mouvement de stock",
    description="""
    Orchestre un mouvement de stock :
    - **ENTREE**    → augmente le stock de entrepot_dest
    - **SORTIE**    → diminue le stock de entrepot_source
    - **TRANSFERT** → diminue entrepot_source + augmente entrepot_dest
    """
)
async def creer_mouvement(
    data        : MouvementCreate,
    db          : Session                      = Depends(get_db),
    current_user: dict                         = Depends(get_all_roles),
    credentials : HTTPAuthorizationCredentials = Depends(security)
):
    # ── Extraire le token brut pour les appels inter-services ──
    # credentials.credentials = le token JWT brut sans "Bearer "
    token = credentials.credentials

    # ── Validations spécifiques aux mouvements d'ENTREE ───────
    if data.type_mouvement == TypeMouvement.ENTREE:
        produit_details = await recuperer_produit_details(data.produit_id, token)

        # 1. Bloquer si la date de fabrication est dans le futur (produit invalide)
        date_fabrication_str = produit_details.get("date_fabrication")
        if date_fabrication_str:
            date_fab = date.fromisoformat(date_fabrication_str)
            if date_fab > date.today():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Mouvement d'entrée refusé : date de fabrication invalide ({date_fabrication_str}) — "
                        "le produit ne peut pas avoir été fabriqué dans le futur."
                    )
                )

        # 2. Bloquer si le produit est déjà expiré (date_expiration ≤ aujourd'hui)
        date_expiration_str = produit_details.get("date_expiration")
        if date_expiration_str:
            date_exp = date.fromisoformat(date_expiration_str)
            if date_exp < date.today():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Mouvement d'entrée refusé : le produit est périmé depuis le {date_expiration_str}. "
                        "Ce produit ne peut pas entrer en stock."
                    )
                )
            if date_exp == date.today():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Mouvement d'entrée refusé : le produit expire aujourd'hui ({date_expiration_str}). "
                        "Veuillez retirer ce produit du circuit."
                    )
                )

        # 2. Auto-assigner une référence si le produit n'en a pas
        if not produit_details.get("reference"):
            await assigner_reference_produit(data.produit_id, token)

    # ── Récupérer les noms pour dénormalisation ────────────────
    produit_nom = data.produit_nom or await recuperer_nom_produit(
        data.produit_id, token
    )

    entrepot_source_nom = data.entrepot_source_nom
    if data.entrepot_source_id and not entrepot_source_nom:
        entrepot_source_nom = await recuperer_nom_entrepot(
            data.entrepot_source_id, token, location_type=data.source_type
        )

    entrepot_dest_nom = data.entrepot_dest_nom
    if data.entrepot_dest_id and not entrepot_dest_nom:
        entrepot_dest_nom = await recuperer_nom_entrepot(
            data.entrepot_dest_id, token, location_type=data.destination_type
        )

    # ── Récupérer les noms des zones selon le type de mouvement ──
    zone_source_nom = data.zone_source_nom
    if data.zone_source_id and not zone_source_nom:
        if data.type_mouvement in (TypeMouvement.SORTIE, TypeMouvement.TRANSFERT):
            zone_source_nom = await recuperer_nom_zone(data.zone_source_id, token)

    zone_dest_nom = data.zone_dest_nom
    if data.zone_dest_id and not zone_dest_nom:
        if data.type_mouvement in (TypeMouvement.ENTREE, TypeMouvement.TRANSFERT):
            zone_dest_nom = await recuperer_nom_zone(data.zone_dest_id, token)

    # ── Orchestration selon le type de mouvement ──────────────
    if data.type_mouvement == TypeMouvement.ENTREE:
        await appeler_stock_augmenter(
            produit_id    = data.produit_id,
            location_id   = data.entrepot_dest_id,
            quantite      = data.quantite,
            token         = token,
            mouvement_ref = data.reference,
            location_type = data.destination_type,
        )

    elif data.type_mouvement == TypeMouvement.SORTIE:
        try:
            await appeler_stock_diminuer(
                produit_id    = data.produit_id,
                location_id   = data.entrepot_source_id,
                quantite      = data.quantite,
                token         = token,
                mouvement_ref = data.reference,
                location_type = data.source_type,
            )
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            if detail.get("error") == "Stock insuffisant":
                await declencher_anomalie_stock_insuffisant(
                    produit_id          = data.produit_id,
                    produit_nom         = produit_nom,
                    entrepot_id         = data.entrepot_source_id,
                    entrepot_nom        = entrepot_source_nom or f"Dépôt/Magasin {data.entrepot_source_id}",
                    quantite_demandee   = data.quantite,
                    quantite_disponible = detail.get("disponible", 0),
                    type_mouvement      = "SORTIE",
                    token               = token,
                )
            raise

    elif data.type_mouvement == TypeMouvement.TRANSFERT:
        # Étape 1 — Diminuer le stock source (dépôt)
        try:
            await appeler_stock_diminuer(
                produit_id    = data.produit_id,
                location_id   = data.entrepot_source_id,
                quantite      = data.quantite,
                token         = token,
                mouvement_ref = data.reference,
                location_type = data.source_type,
            )
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            if detail.get("error") == "Stock insuffisant":
                await declencher_anomalie_stock_insuffisant(
                    produit_id          = data.produit_id,
                    produit_nom         = produit_nom,
                    entrepot_id         = data.entrepot_source_id,
                    entrepot_nom        = entrepot_source_nom or f"Dépôt/Magasin {data.entrepot_source_id}",
                    quantite_demandee   = data.quantite,
                    quantite_disponible = detail.get("disponible", 0),
                    type_mouvement      = "TRANSFERT",
                    token               = token,
                )
            raise
        # Étape 2 — Augmenter le stock destination (magasin)
        await appeler_stock_augmenter(
            produit_id    = data.produit_id,
            location_id   = data.entrepot_dest_id,
            quantite      = data.quantite,
            token         = token,
            mouvement_ref = data.reference,
            location_type = data.destination_type,
        )

    # ── Enregistrer le mouvement dans sgs_mouvement ───────────
    # Mapper entrepot_source_id/dest_id vers les colonnes typées du modèle
    src_is_magasin = data.source_type == "MAGASIN"
    dst_is_magasin = data.destination_type == "MAGASIN"

    nouveau_mouvement = Mouvement(
        type_mouvement          = data.type_mouvement,
        statut                  = StatutMouvement.VALIDE,
        produit_id              = data.produit_id,
        produit_nom             = produit_nom,
        quantite                = data.quantite,
        source_type             = data.source_type,
        source_depot_id         = data.entrepot_source_id if not src_is_magasin else None,
        source_depot_nom        = entrepot_source_nom     if not src_is_magasin else None,
        source_magasin_id       = data.entrepot_source_id if src_is_magasin else None,
        source_magasin_nom      = entrepot_source_nom     if src_is_magasin else None,
        destination_type        = data.destination_type,
        destination_depot_id    = data.entrepot_dest_id   if not dst_is_magasin else None,
        destination_depot_nom   = entrepot_dest_nom       if not dst_is_magasin else None,
        destination_magasin_id  = data.entrepot_dest_id   if dst_is_magasin else None,
        destination_magasin_nom = entrepot_dest_nom       if dst_is_magasin else None,
        reference               = data.reference,
        motif                   = data.motif,
        note                    = data.note,
        fournisseur_id          = data.fournisseur_id,
        fournisseur_nom         = data.fournisseur_nom,
        utilisateur_id          = current_user.get("user_id"),
        utilisateur_nom         = current_user.get("email") or current_user.get("nom"),
    )
    db.add(nouveau_mouvement)
    db.commit()
    db.refresh(nouveau_mouvement)

    # ── Mise à jour taux d'occupation dans Service-Warehouse (best-effort) ──
    if data.type_mouvement == TypeMouvement.ENTREE and data.entrepot_dest_id:
        await appeler_warehouse_update_capacite(
            data.entrepot_dest_id, data.quantite, token, data.destination_type
        )
    elif data.type_mouvement == TypeMouvement.SORTIE and data.entrepot_source_id:
        await appeler_warehouse_update_capacite(
            data.entrepot_source_id, -data.quantite, token, data.source_type
        )
    elif data.type_mouvement == TypeMouvement.TRANSFERT:
        if data.entrepot_source_id:
            await appeler_warehouse_update_capacite(
                data.entrepot_source_id, -data.quantite, token, data.source_type
            )
        if data.entrepot_dest_id:
            await appeler_warehouse_update_capacite(
                data.entrepot_dest_id, data.quantite, token, data.destination_type
            )

    # Mise à jour automatique de ChromaDB (ne bloque pas la réponse)
    await indexer_mouvement_dans_rag(
        nouveau_mouvement.id, data.produit_id,
        data.entrepot_dest_id or data.entrepot_source_id, token
    )

    # Détection automatique d'anomalies — envoie email si anomalie détectée
    await verifier_anomalies_mouvement(token)

    # ── Construire la réponse avec avertissements (ENTREE uniquement) ──
    avertissements = []

    if data.type_mouvement == TypeMouvement.ENTREE:
        date_exp_str = produit_details.get("date_expiration")
        if date_exp_str:
            date_exp      = date.fromisoformat(date_exp_str)
            jours_restants = (date_exp - date.today()).days

            if jours_restants <= 0:
                # Déjà expiré (cas normalement bloqué plus haut, sécurité)
                avertissements.append(
                    f"⛔ Ce produit est périmé depuis le {date_exp_str}. "
                    "Ne pas mettre en vente — retirez-le du stock immédiatement."
                )
            elif jours_restants == 0:
                avertissements.append(
                    f"🚨 Ce produit expire AUJOURD'HUI ({date_exp_str}). "
                    "Il ne doit pas être acheté ni mis en vente."
                )
            elif jours_restants <= 7:
                # ── Appel IA synchrone (promotion recommandée) ──
                prix_actuel = float(produit_details.get("prix_unitaire") or 0)
                recommandation_ia = await appeler_ia_recommandation_expiration(
                    produit_id      = data.produit_id,
                    produit_nom     = produit_nom,
                    entrepot_id     = data.entrepot_dest_id,
                    stock_actuel    = data.quantite,
                    prix_actuel     = prix_actuel,
                    jours_restants  = jours_restants,
                    date_expiration = date_exp_str,
                    token           = token,
                )
                texte_ia = (
                    f" Recommandation IA : {recommandation_ia}"
                    if recommandation_ia
                    else " Lancez une promotion immédiate pour écouler le stock."
                )
                avertissements.append(
                    f"🔴 EXPIRATION TRÈS PROCHE — {produit_nom} expire dans "
                    f"{jours_restants} jour(s) ({date_exp_str}). "
                    f"Ne pas recommander l'achat.{texte_ia}"
                )
            elif jours_restants <= 30:
                # ── Appel IA synchrone (promotion recommandée) ──
                prix_actuel = float(produit_details.get("prix_unitaire") or 0)
                recommandation_ia = await appeler_ia_recommandation_expiration(
                    produit_id      = data.produit_id,
                    produit_nom     = produit_nom,
                    entrepot_id     = data.entrepot_dest_id,
                    stock_actuel    = data.quantite,
                    prix_actuel     = prix_actuel,
                    jours_restants  = jours_restants,
                    date_expiration = date_exp_str,
                    token           = token,
                )
                texte_ia = (
                    f" Recommandation IA : {recommandation_ia}"
                    if recommandation_ia
                    else " Envisager une promotion pour écouler le stock."
                )
                avertissements.append(
                    f"⚠️ Expiration proche — {produit_nom} expire dans "
                    f"{jours_restants} jour(s) ({date_exp_str}).{texte_ia}"
                )

            # Déclencher l'alerte async (email + IA) si expiration ≤ 30 jours
            if 0 < jours_restants <= 30:
                await declencher_alerte_expiration(
                    produit_id      = data.produit_id,
                    produit_nom     = produit_nom,
                    entrepot_id     = data.entrepot_dest_id,
                    entrepot_nom    = entrepot_dest_nom or f"Entrepôt {data.entrepot_dest_id}",
                    quantite        = data.quantite,
                    date_expiration = date_exp_str,
                    jours_restants  = jours_restants,
                    token           = token,
                )

    # ── Construire la réponse finale avec les avertissements ──────
    reponse = MouvementResponse.model_validate(nouveau_mouvement)
    reponse.avertissements = avertissements if avertissements else None
    return reponse


@router.get(
    "/mouvements",
    response_model=MouvementList,
    summary="Historique des mouvements",
    description="""
    Retourne la liste paginée des mouvements avec filtres optionnels :
    - **type_mouvement** : entree / sortie / transfert
    - **produit_id**     : filtre par produit
    - **location_id**    : filtre par dépôt/magasin source OU destination
    - **statut**         : en_attente / valide / annule
    """
)
async def lister_mouvements(
    type_mouvement : Optional[str] = Query(None, description="entree / sortie / transfert"),
    produit_id     : Optional[int] = Query(None),
    location_id    : Optional[int] = Query(None, description="ID dépôt ou magasin source OU destination"),
    entrepot_id    : Optional[int] = Query(None, description="Alias legacy pour location_id"),
    statut         : Optional[str] = Query(None, description="en_attente / valide / annule"),
    db             : Session       = Depends(get_db),
    current_user   : dict          = Depends(get_current_user),
    pagination     : dict          = Depends(get_pagination)
):
    query = db.query(Mouvement)

    if type_mouvement:
        query = query.filter(Mouvement.type_mouvement == type_mouvement)
    if produit_id:
        query = query.filter(Mouvement.produit_id == produit_id)
    fid = location_id or entrepot_id
    if fid:
        query = query.filter(
            (Mouvement.source_depot_id      == fid) | (Mouvement.source_magasin_id      == fid) |
            (Mouvement.destination_depot_id == fid) | (Mouvement.destination_magasin_id == fid)
        )
    if statut:
        query = query.filter(Mouvement.statut == statut)

    total      = query.count()
    mouvements = (
        query
        .order_by(Mouvement.created_at.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
        .all()
    )
    return MouvementList(
        total      = total,
        page       = pagination["page"],
        per_page   = pagination["per_page"],
        mouvements = mouvements
    )


@router.get(
    "/mouvements/{mouvement_id}",
    response_model=MouvementResponse,
    summary="Détail d'un mouvement",
)
async def get_mouvement(
    mouvement_id : int,
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(get_current_user)
):
    mouvement = db.query(Mouvement).filter(
        Mouvement.id == mouvement_id
    ).first()
    if not mouvement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mouvement {mouvement_id} introuvable"
        )
    return mouvement


@router.put(
    "/mouvements/{mouvement_id}",
    response_model=MouvementResponse,
    summary="Modifier un mouvement",
    description="Seuls le statut, le motif et la note sont modifiables."
)
async def modifier_mouvement(
    mouvement_id : int,
    data         : MouvementUpdate,
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(get_current_gestionnaire_or_admin)
):
    mouvement = db.query(Mouvement).filter(
        Mouvement.id == mouvement_id
    ).first()
    if not mouvement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mouvement {mouvement_id} introuvable"
        )

    for champ, valeur in data.model_dump(exclude_unset=True).items():
        setattr(mouvement, champ, valeur)

    db.commit()
    db.refresh(mouvement)
    return mouvement


@router.delete(
    "/mouvements/{mouvement_id}",
    response_model=MessageResponse,
    summary="Annuler un mouvement et corriger le stock",
    description="""
    Annule un mouvement et **inverse automatiquement le stock** :
    - **ENTREE annulée**    → diminue le stock de entrepot_dest (on retire ce qui a été ajouté)
    - **SORTIE annulée**    → augmente le stock de entrepot_source (on remet ce qui a été retiré)
    - **TRANSFERT annulé**  → augmente entrepot_source + diminue entrepot_dest (on inverse le transfert)

    Réservé au gestionnaire et à l'administrateur.
    """
)
async def annuler_mouvement(
    mouvement_id : int,
    db           : Session                      = Depends(get_db),
    current_user : dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials  : HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    mouvement = db.query(Mouvement).filter(
        Mouvement.id == mouvement_id
    ).first()
    if not mouvement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mouvement {mouvement_id} introuvable"
        )
    if mouvement.statut == StatutMouvement.ANNULE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce mouvement est déjà annulé"
        )

    # ── Résoudre les IDs source/dest depuis les colonnes typées ──
    src_id   = mouvement.source_depot_id      or mouvement.source_magasin_id
    src_type = mouvement.source_type
    dst_id   = mouvement.destination_depot_id or mouvement.destination_magasin_id
    dst_type = mouvement.destination_type

    if not src_id and not dst_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce mouvement ne contient pas d'information de localisation — annulation impossible."
        )

    # ── Inverser le stock selon le type de mouvement ──────────
    try:
        if mouvement.type_mouvement == TypeMouvement.ENTREE:
            await appeler_stock_diminuer(
                produit_id    = mouvement.produit_id,
                location_id   = dst_id,
                quantite      = mouvement.quantite,
                token         = token,
                mouvement_ref = f"ANNULATION-{mouvement_id}",
                location_type = dst_type,
            )

        elif mouvement.type_mouvement == TypeMouvement.SORTIE:
            await appeler_stock_augmenter(
                produit_id    = mouvement.produit_id,
                location_id   = src_id,
                quantite      = mouvement.quantite,
                token         = token,
                mouvement_ref = f"ANNULATION-{mouvement_id}",
                location_type = src_type,
            )

        elif mouvement.type_mouvement == TypeMouvement.TRANSFERT:
            await appeler_stock_augmenter(
                produit_id    = mouvement.produit_id,
                location_id   = src_id,
                quantite      = mouvement.quantite,
                token         = token,
                mouvement_ref = f"ANNULATION-{mouvement_id}",
                location_type = src_type,
            )
            await appeler_stock_diminuer(
                produit_id    = mouvement.produit_id,
                location_id   = dst_id,
                quantite      = mouvement.quantite,
                token         = token,
                mouvement_ref = f"ANNULATION-{mouvement_id}",
                location_type = dst_type,
            )

    except HTTPException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible d'annuler : correction du stock échouée — {e.detail}"
        )

    # ── Inverser la capacite_utilisee dans Service-Warehouse (best-effort) ──
    if mouvement.type_mouvement == TypeMouvement.ENTREE and dst_id:
        await appeler_warehouse_update_capacite(dst_id, -mouvement.quantite, token, dst_type)
    elif mouvement.type_mouvement == TypeMouvement.SORTIE and src_id:
        await appeler_warehouse_update_capacite(src_id, mouvement.quantite, token, src_type)
    elif mouvement.type_mouvement == TypeMouvement.TRANSFERT:
        if src_id:
            await appeler_warehouse_update_capacite(src_id,  mouvement.quantite, token, src_type)
        if dst_id:
            await appeler_warehouse_update_capacite(dst_id, -mouvement.quantite, token, dst_type)

    # ── Marquer le mouvement comme annulé ─────────────────────
    mouvement.statut = StatutMouvement.ANNULE
    db.commit()

    return MessageResponse(
        message=f"Mouvement {mouvement_id} annulé — stock corrigé automatiquement"
    )