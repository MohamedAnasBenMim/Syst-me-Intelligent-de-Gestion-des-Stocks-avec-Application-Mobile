# app/routes.py — service_warehouse/
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.models import Entrepot, Zone
from app.schemas import (
    EntrepotCreate, EntrepotUpdate, EntrepotResponse, EntrepotList,
    ZoneCreate, ZoneUpdate, ZoneResponse, ZoneList,
    MessageResponse
)
from app.dependencies import (
    get_current_user,
    get_current_admin,
    get_current_gestionnaire_or_admin,
    get_pagination
)
from app.config import settings

router = APIRouter()

# Instance HTTPBearer pour extraire le token brut
security = HTTPBearer()


# ═══════════════════════════════════════════════════════════
# FONCTION UTILITAIRE — Calculer capacite_utilisee
# ═══════════════════════════════════════════════════════════

async def calculer_capacite_utilisee(entrepot_id: int, token: str) -> float:
    """
    Appelle Service Stock GET /stocks/entrepot/{id}
    et somme toutes les quantités pour calculer
    la capacité utilisée en temps réel.
    Retourne 0.0 si Service Stock ne répond pas.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/entrepot/{entrepot_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
        if response.status_code == 200:
            stocks = response.json()
            return sum(s["quantite"] for s in stocks)
    except Exception:
        pass
    return 0.0


# ═══════════════════════════════════════════════════════════
# ROUTES ENTREPÔTS
# ═══════════════════════════════════════════════════════════

@router.post(
    "/entrepots",
    response_model=EntrepotResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un entrepôt",
    description="Crée un nouvel entrepôt avec ses zones initiales. Réservé à l'administrateur."
)
def creer_entrepot(
    entrepot_data: EntrepotCreate,
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(get_current_admin)
):
    # Vérifier que le code est unique
    existant = db.query(Entrepot).filter(Entrepot.code == entrepot_data.code).first()
    if existant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un entrepôt avec le code '{entrepot_data.code}' existe déjà"
        )

    # Créer l'entrepôt
    zones_data    = entrepot_data.zones or []
    entrepot_dict = entrepot_data.model_dump(exclude={"zones"})
    nouvel_entrepot = Entrepot(**entrepot_dict)
    db.add(nouvel_entrepot)
    db.flush()

    # Créer les zones initiales
    for zone_data in zones_data:
        zone_existante = db.query(Zone).filter(
            Zone.entrepot_id == nouvel_entrepot.id,
            Zone.code        == zone_data.code
        ).first()
        if zone_existante:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le code de zone '{zone_data.code}' est déjà utilisé dans cet entrepôt"
            )
        nouvelle_zone = Zone(
            **zone_data.model_dump(),
            entrepot_id=nouvel_entrepot.id
        )
        db.add(nouvelle_zone)

    db.commit()
    db.refresh(nouvel_entrepot)
    return nouvel_entrepot


@router.get(
    "/entrepots",
    response_model=EntrepotList,
    summary="Lister les entrepôts",
    description="Retourne la liste paginée de tous les entrepôts avec capacité utilisée en temps réel."
)
async def lister_entrepots(
    db          : Session                      = Depends(get_db),
    current_user: dict                         = Depends(get_current_user),
    pagination  : dict                         = Depends(get_pagination),
    credentials : HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    total    = db.query(Entrepot).count()
    entrepots = (
        db.query(Entrepot)
        .offset(pagination["skip"])
        .limit(pagination["limit"])
        .all()
    )

    # Calculer capacite_utilisee en temps réel pour chaque entrepôt
    for entrepot in entrepots:
        entrepot.capacite_utilisee = await calculer_capacite_utilisee(
            entrepot.id, token
        )

    return EntrepotList(
        total     = total,
        page      = pagination["page"],
        per_page  = pagination["per_page"],
        entrepots = entrepots
    )


@router.get(
    "/entrepots/{entrepot_id}",
    response_model=EntrepotResponse,
    summary="Détail d'un entrepôt",
    description="Retourne les détails d'un entrepôt avec capacité utilisée en temps réel."
)
async def get_entrepot(
    entrepot_id : int,
    db          : Session                      = Depends(get_db),
    current_user: dict                         = Depends(get_current_user),
    credentials : HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    entrepot = db.query(Entrepot).filter(Entrepot.id == entrepot_id).first()
    if not entrepot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entrepôt avec l'id {entrepot_id} introuvable"
        )

    # Calculer capacite_utilisee en temps réel
    entrepot.capacite_utilisee = await calculer_capacite_utilisee(
        entrepot_id, token
    )

    return entrepot


@router.put(
    "/entrepots/{entrepot_id}",
    response_model=EntrepotResponse,
    summary="Modifier un entrepôt",
    description="Modifie les informations d'un entrepôt existant. Réservé à l'administrateur."
)
def modifier_entrepot(
    entrepot_id  : int,
    entrepot_data: EntrepotUpdate,
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(get_current_admin)
):
    entrepot = db.query(Entrepot).filter(Entrepot.id == entrepot_id).first()
    if not entrepot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entrepôt avec l'id {entrepot_id} introuvable"
        )

    for champ, valeur in entrepot_data.model_dump(exclude_unset=True).items():
        setattr(entrepot, champ, valeur)

    db.commit()
    db.refresh(entrepot)
    return entrepot


@router.delete(
    "/entrepots/{entrepot_id}",
    response_model=MessageResponse,
    summary="Supprimer un entrepôt",
    description="Supprime un entrepôt et toutes ses zones. Réservé à l'administrateur."
)
async def supprimer_entrepot(
    entrepot_id : int,
    db          : Session                      = Depends(get_db),
    current_user: dict                         = Depends(get_current_admin),
    credentials : HTTPAuthorizationCredentials = Depends(security)
):
    token    = credentials.credentials
    entrepot = db.query(Entrepot).filter(Entrepot.id == entrepot_id).first()
    if not entrepot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entrepôt avec l'id {entrepot_id} introuvable"
        )

    # Vérifier que l'entrepôt n'a pas de stock actif via Service Stock
    capacite_utilisee = await calculer_capacite_utilisee(entrepot_id, token)
    if capacite_utilisee > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer : stock actif de {capacite_utilisee} unités"
        )

    db.delete(entrepot)
    db.commit()
    return MessageResponse(message=f"Entrepôt '{entrepot.nom}' supprimé avec succès")


# ═══════════════════════════════════════════════════════════
# ROUTES ZONES
# ═══════════════════════════════════════════════════════════

@router.post(
    "/entrepots/{entrepot_id}/zones",
    response_model=ZoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter une zone à un entrepôt",
    description="Crée une nouvelle zone dans un entrepôt existant. Réservé au gestionnaire et à l'administrateur."
)
def creer_zone(
    entrepot_id: int,
    zone_data  : ZoneCreate,
    db         : Session = Depends(get_db),
    current_user: dict   = Depends(get_current_gestionnaire_or_admin)
):
    entrepot = db.query(Entrepot).filter(Entrepot.id == entrepot_id).first()
    if not entrepot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entrepôt avec l'id {entrepot_id} introuvable"
        )

    zone_existante = db.query(Zone).filter(
        Zone.entrepot_id == entrepot_id,
        Zone.code        == zone_data.code
    ).first()
    if zone_existante:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le code de zone '{zone_data.code}' est déjà utilisé dans cet entrepôt"
        )

    if zone_data.entrepot_id != entrepot_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'entrepot_id dans le body ne correspond pas à l'URL"
        )

    nouvelle_zone = Zone(**zone_data.model_dump())
    db.add(nouvelle_zone)
    db.commit()
    db.refresh(nouvelle_zone)
    return nouvelle_zone


@router.get(
    "/entrepots/{entrepot_id}/zones",
    response_model=ZoneList,
    summary="Lister les zones d'un entrepôt",
    description="Retourne toutes les zones d'un entrepôt donné."
)
def lister_zones(
    entrepot_id : int,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user)
):
    entrepot = db.query(Entrepot).filter(Entrepot.id == entrepot_id).first()
    if not entrepot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entrepôt avec l'id {entrepot_id} introuvable"
        )

    zones = db.query(Zone).filter(Zone.entrepot_id == entrepot_id).all()
    return ZoneList(
        total       = len(zones),
        entrepot_id = entrepot_id,
        zones       = zones
    )


@router.get(
    "/zones/{zone_id}",
    response_model=ZoneResponse,
    summary="Détail d'une zone",
    description="Retourne les détails d'une zone spécifique."
)
def get_zone(
    zone_id     : int,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user)
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone avec l'id {zone_id} introuvable"
        )
    return zone


@router.put(
    "/zones/{zone_id}",
    response_model=ZoneResponse,
    summary="Modifier une zone",
    description="Modifie les informations d'une zone existante. Réservé au gestionnaire et à l'administrateur."
)
def modifier_zone(
    zone_id     : int,
    zone_data   : ZoneUpdate,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_gestionnaire_or_admin)
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone avec l'id {zone_id} introuvable"
        )

    for champ, valeur in zone_data.model_dump(exclude_unset=True).items():
        setattr(zone, champ, valeur)

    db.commit()
    db.refresh(zone)
    return zone


@router.delete(
    "/zones/{zone_id}",
    response_model=MessageResponse,
    summary="Supprimer une zone",
    description="Supprime une zone d'un entrepôt. Réservé à l'administrateur."
)
def supprimer_zone(
    zone_id     : int,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_admin)
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone avec l'id {zone_id} introuvable"
        )

    db.delete(zone)
    db.commit()
    return MessageResponse(message=f"Zone '{zone.nom}' supprimée avec succès")