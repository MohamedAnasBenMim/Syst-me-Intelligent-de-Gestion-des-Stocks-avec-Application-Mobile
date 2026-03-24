# app/routes.py — service_mouvement/

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
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
    produit_id   : int,
    entrepot_id  : int,
    quantite     : float,
    token        : str,
    mouvement_ref: Optional[str] = None
) -> dict:
    """
    Appelle Service Stock PATCH /stocks/augmenter.
    Utilisé pour ENTREE (entrepot_dest) et TRANSFERT (entrepot_dest).
    """
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/augmenter",
            json={
                "produit_id"    : produit_id,
                "entrepot_id"   : entrepot_id,
                "quantite"      : quantite,
                "mouvement_ref" : mouvement_ref
            },
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
    produit_id   : int,
    entrepot_id  : int,
    quantite     : float,
    token        : str,
    mouvement_ref: Optional[str] = None
) -> dict:
    """
    Appelle Service Stock PATCH /stocks/diminuer.
    Utilisé pour SORTIE (entrepot_source) et TRANSFERT (entrepot_source).
    Si stock insuffisant → Service Stock retourne 400 → on propage l'erreur.
    """
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/diminuer",
            json={
                "produit_id"    : produit_id,
                "entrepot_id"   : entrepot_id,
                "quantite"      : quantite,
                "mouvement_ref" : mouvement_ref
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.json().get("detail", "Erreur Service Stock")
        )
    return response.json()


async def recuperer_nom_entrepot(entrepot_id: int, token: str) -> str:
    """
    Appelle Service Warehouse GET /entrepots/{id}
    pour récupérer le nom de l'entrepôt (dénormalisation).
    Retourne "Entrepôt {id}" si le service ne répond pas.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.WAREHOUSE_SERVICE_URL}/api/v1/entrepots/{entrepot_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
        if response.status_code == 200:
            return response.json().get("nom", f"Entrepôt {entrepot_id}")
    except Exception:
        pass
    return f"Entrepôt {entrepot_id}"


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

    # ── Récupérer les noms pour dénormalisation ────────────────
    produit_nom = data.produit_nom or await recuperer_nom_produit(
        data.produit_id, token
    )

    entrepot_source_nom = data.entrepot_source_nom
    if data.entrepot_source_id and not entrepot_source_nom:
        entrepot_source_nom = await recuperer_nom_entrepot(
            data.entrepot_source_id, token
        )

    entrepot_dest_nom = data.entrepot_dest_nom
    if data.entrepot_dest_id and not entrepot_dest_nom:
        entrepot_dest_nom = await recuperer_nom_entrepot(
            data.entrepot_dest_id, token
        )

    # ── Orchestration selon le type de mouvement ──────────────
    if data.type_mouvement == TypeMouvement.ENTREE:
        # Augmenter le stock de l'entrepôt destination
        await appeler_stock_augmenter(
            produit_id   = data.produit_id,
            entrepot_id  = data.entrepot_dest_id,
            quantite     = data.quantite,
            token        = token,
            mouvement_ref= data.reference
        )

    elif data.type_mouvement == TypeMouvement.SORTIE:
        # Diminuer le stock de l'entrepôt source
        await appeler_stock_diminuer(
            produit_id   = data.produit_id,
            entrepot_id  = data.entrepot_source_id,
            quantite     = data.quantite,
            token        = token,
            mouvement_ref= data.reference
        )

    elif data.type_mouvement == TypeMouvement.TRANSFERT:
        # Étape 1 — Diminuer le stock source
        await appeler_stock_diminuer(
            produit_id   = data.produit_id,
            entrepot_id  = data.entrepot_source_id,
            quantite     = data.quantite,
            token        = token,
            mouvement_ref= data.reference
        )
        # Étape 2 — Augmenter le stock destination
        await appeler_stock_augmenter(
            produit_id   = data.produit_id,
            entrepot_id  = data.entrepot_dest_id,
            quantite     = data.quantite,
            token        = token,
            mouvement_ref= data.reference
        )

    # ── Enregistrer le mouvement dans sgs_mouvement ───────────
    nouveau_mouvement = Mouvement(
        type_mouvement      = data.type_mouvement,
        statut              = StatutMouvement.VALIDE,
        produit_id          = data.produit_id,
        produit_nom         = produit_nom,
        quantite            = data.quantite,
        entrepot_source_id  = data.entrepot_source_id,
        entrepot_source_nom = entrepot_source_nom,
        entrepot_dest_id    = data.entrepot_dest_id,
        entrepot_dest_nom   = entrepot_dest_nom,
        zone_source_id      = data.zone_source_id,
        zone_dest_id        = data.zone_dest_id,
        reference           = data.reference,
        motif               = data.motif,
        note                = data.note,
        utilisateur_id      = current_user.get("user_id"),
        utilisateur_nom     = current_user.get("email"),
    )
    db.add(nouveau_mouvement)
    db.commit()
    db.refresh(nouveau_mouvement)
    return nouveau_mouvement


@router.get(
    "/mouvements",
    response_model=MouvementList,
    summary="Historique des mouvements",
    description="""
    Retourne la liste paginée des mouvements avec filtres optionnels :
    - **type_mouvement** : entree / sortie / transfert
    - **produit_id**     : filtre par produit
    - **entrepot_id**    : filtre par entrepôt source OU destination
    - **statut**         : en_attente / valide / annule
    """
)
async def lister_mouvements(
    type_mouvement : Optional[str] = Query(None, description="entree / sortie / transfert"),
    produit_id     : Optional[int] = Query(None),
    entrepot_id    : Optional[int] = Query(None, description="Entrepôt source OU destination"),
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
    if entrepot_id:
        query = query.filter(
            (Mouvement.entrepot_source_id == entrepot_id) |
            (Mouvement.entrepot_dest_id   == entrepot_id)
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
    summary="Annuler un mouvement",
    description="Annule un mouvement en changeant son statut à 'annule'. Réservé à l'administrateur."
)
async def annuler_mouvement(
    mouvement_id : int,
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(get_current_admin)
):
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

    mouvement.statut = StatutMouvement.ANNULE
    db.commit()
    return MessageResponse(
        message=f"Mouvement {mouvement_id} annulé avec succès"
    )