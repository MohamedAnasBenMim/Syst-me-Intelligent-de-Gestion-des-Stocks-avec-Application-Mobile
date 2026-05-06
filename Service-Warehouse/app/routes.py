# app/routes.py — service_warehouse/
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, List
import httpx

from app.database import get_db
from app.config import settings
from app.schemas import (
    MessageResponse,
    DepotCreate, DepotUpdate, DepotResponse, DepotList,
    MagasinCreate, MagasinUpdate, MagasinResponse, MagasinList,
    TransfertDepotMagasin, TransfertMagasinDepot, TransfertResponse,
    CapaciteUpdate,
)
from app.models import Depot, Magasin
from app.dependencies import (
    get_current_user,
    get_current_admin,
    get_current_gestionnaire_or_admin,
    get_all_roles,
)

router = APIRouter()
security = HTTPBearer()


# ═══════════════════════════════════════════════════════════
# ROUTES DÉPÔTS
# ═══════════════════════════════════════════════════════════

@router.get("/depots", response_model=DepotList, tags=["Dépôts"])
def lister_depots(
    actif_seulement: bool    = Query(default=True),
    db:              Session = Depends(get_db),
    _user:           dict    = Depends(get_current_user),
):
    q = db.query(Depot)
    if actif_seulement:
        q = q.filter(Depot.est_actif == True)
    depots = q.order_by(Depot.depot_type, Depot.nom).all()
    result = []
    for d in depots:
        r = DepotResponse(
            id=d.id, nom=d.nom, code=d.code, depot_type=d.depot_type,
            adresse=d.adresse, ville=d.ville, latitude=d.latitude, longitude=d.longitude,
            capacite_max=d.capacite_max, capacite_utilisee=d.capacite_utilisee,
            taux_occupation=d.taux_occupation,
            responsable=d.responsable, telephone=d.telephone,
            email_responsable=d.email_responsable, notes=d.notes,
            est_actif=d.est_actif, nb_magasins=d.nb_magasins, created_at=d.created_at,
        )
        result.append(r)
    return DepotList(total=len(result), depots=result)


@router.post("/depots", response_model=DepotResponse, status_code=status.HTTP_201_CREATED, tags=["Dépôts"])
def creer_depot(
    data: DepotCreate,
    db:   Session = Depends(get_db),
    _user:dict    = Depends(get_current_gestionnaire_or_admin),
):
    if db.query(Depot).filter(Depot.code == data.code).first():
        raise HTTPException(status_code=400, detail=f"Code '{data.code}' déjà utilisé")
    d = Depot(**data.model_dump())
    db.add(d); db.commit(); db.refresh(d)
    return DepotResponse(
        id=d.id, nom=d.nom, code=d.code, depot_type=d.depot_type,
        adresse=d.adresse, ville=d.ville, latitude=d.latitude, longitude=d.longitude,
        capacite_max=d.capacite_max, capacite_utilisee=d.capacite_utilisee,
        taux_occupation=d.taux_occupation,
        responsable=d.responsable, telephone=d.telephone,
        email_responsable=d.email_responsable, notes=d.notes,
        est_actif=d.est_actif, nb_magasins=0, created_at=d.created_at,
    )


@router.get("/depots/{depot_id}", response_model=DepotResponse, tags=["Dépôts"])
def get_depot(depot_id: int, db: Session = Depends(get_db), _user: dict = Depends(get_current_user)):
    d = db.query(Depot).filter(Depot.id == depot_id).first()
    if not d:
        raise HTTPException(status_code=404, detail=f"Dépôt {depot_id} introuvable")
    return DepotResponse(
        id=d.id, nom=d.nom, code=d.code, depot_type=d.depot_type,
        adresse=d.adresse, ville=d.ville, latitude=d.latitude, longitude=d.longitude,
        capacite_max=d.capacite_max, capacite_utilisee=d.capacite_utilisee,
        taux_occupation=d.taux_occupation,
        responsable=d.responsable, telephone=d.telephone,
        email_responsable=d.email_responsable, notes=d.notes,
        est_actif=d.est_actif, nb_magasins=d.nb_magasins, created_at=d.created_at,
    )


@router.put("/depots/{depot_id}", response_model=DepotResponse, tags=["Dépôts"])
def modifier_depot(
    depot_id: int, data: DepotUpdate,
    db: Session = Depends(get_db), _user: dict = Depends(get_current_gestionnaire_or_admin),
):
    d = db.query(Depot).filter(Depot.id == depot_id).first()
    if not d:
        raise HTTPException(status_code=404, detail=f"Dépôt {depot_id} introuvable")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(d, field, value)
    db.commit(); db.refresh(d)
    return DepotResponse(
        id=d.id, nom=d.nom, code=d.code, depot_type=d.depot_type,
        adresse=d.adresse, ville=d.ville, latitude=d.latitude, longitude=d.longitude,
        capacite_max=d.capacite_max, capacite_utilisee=d.capacite_utilisee,
        taux_occupation=d.taux_occupation,
        responsable=d.responsable, telephone=d.telephone,
        email_responsable=d.email_responsable, notes=d.notes,
        est_actif=d.est_actif, nb_magasins=d.nb_magasins, created_at=d.created_at,
    )


@router.delete("/depots/{depot_id}", response_model=MessageResponse, tags=["Dépôts"])
def supprimer_depot(depot_id: int, db: Session = Depends(get_db), _user: dict = Depends(get_current_admin)):
    d = db.query(Depot).filter(Depot.id == depot_id).first()
    if not d:
        raise HTTPException(status_code=404, detail=f"Dépôt {depot_id} introuvable")
    if db.query(Magasin).filter(Magasin.depot_id == depot_id, Magasin.est_actif == True).count() > 0:
        raise HTTPException(status_code=400, detail="Impossible de supprimer un dépôt qui a des magasins actifs")
    d.est_actif = False
    db.commit()
    return MessageResponse(message=f"Dépôt '{d.nom}' désactivé")


@router.patch("/depots/{depot_id}/capacite", tags=["Dépôts"])
def update_depot_capacite(
    depot_id: int, data: CapaciteUpdate,
    db: Session = Depends(get_db), _user: dict = Depends(get_current_user),
):
    d = db.query(Depot).filter(Depot.id == depot_id).first()
    if not d:
        raise HTTPException(status_code=404, detail=f"Dépôt {depot_id} introuvable")
    d.capacite_utilisee = max(0.0, d.capacite_utilisee + data.delta)
    db.commit()
    return {"ok": True, "capacite_utilisee": d.capacite_utilisee}


@router.get("/depots/{depot_id}/magasins", response_model=MagasinList, tags=["Dépôts"])
def magasins_du_depot(depot_id: int, db: Session = Depends(get_db), _user: dict = Depends(get_current_user)):
    d = db.query(Depot).filter(Depot.id == depot_id).first()
    if not d:
        raise HTTPException(status_code=404, detail=f"Dépôt {depot_id} introuvable")
    magasins = db.query(Magasin).filter(Magasin.depot_id == depot_id, Magasin.est_actif == True).all()
    result = [
        MagasinResponse(
            id=m.id, nom=m.nom, code=m.code, depot_id=m.depot_id,
            depot_nom=d.nom, depot_code=d.code,
            adresse=m.adresse, ville=m.ville, latitude=m.latitude, longitude=m.longitude,
            capacite_max=m.capacite_max, capacite_utilisee=m.capacite_utilisee,
            taux_occupation=m.taux_occupation,
            responsable=m.responsable, telephone=m.telephone,
            email_responsable=m.email_responsable, horaires_ouverture=m.horaires_ouverture,
            notes=m.notes, est_actif=m.est_actif, created_at=m.created_at,
        ) for m in magasins
    ]
    return MagasinList(total=len(result), magasins=result)


@router.get("/depots/{depot_id}/tree", tags=["Dépôts"])
def arbre_depot(depot_id: int, db: Session = Depends(get_db), _user: dict = Depends(get_current_user)):
    d = db.query(Depot).filter(Depot.id == depot_id).first()
    if not d:
        raise HTTPException(status_code=404, detail=f"Dépôt {depot_id} introuvable")
    magasins = db.query(Magasin).filter(Magasin.depot_id == depot_id).all()
    return {
        "id": d.id, "nom": d.nom, "code": d.code, "depot_type": d.depot_type,
        "capacite_max": d.capacite_max, "capacite_utilisee": d.capacite_utilisee,
        "taux_occupation": d.taux_occupation, "est_actif": d.est_actif,
        "magasins": [
            {
                "id": m.id, "nom": m.nom, "code": m.code,
                "capacite_max": m.capacite_max, "capacite_utilisee": m.capacite_utilisee,
                "taux_occupation": m.taux_occupation, "est_actif": m.est_actif,
                "horaires_ouverture": m.horaires_ouverture,
            }
            for m in magasins
        ],
    }


# ═══════════════════════════════════════════════════════════
# ROUTES MAGASINS
# ═══════════════════════════════════════════════════════════

def _magasin_to_response(m: Magasin, depot: Depot | None = None) -> MagasinResponse:
    return MagasinResponse(
        id=m.id, nom=m.nom, code=m.code, depot_id=m.depot_id,
        depot_nom=depot.nom  if depot else None,
        depot_code=depot.code if depot else None,
        adresse=m.adresse, ville=m.ville, latitude=m.latitude, longitude=m.longitude,
        capacite_max=m.capacite_max, capacite_utilisee=m.capacite_utilisee,
        taux_occupation=m.taux_occupation,
        responsable=m.responsable, telephone=m.telephone,
        email_responsable=m.email_responsable, horaires_ouverture=m.horaires_ouverture,
        notes=m.notes, est_actif=m.est_actif, created_at=m.created_at,
    )


@router.get("/magasins", response_model=MagasinList, tags=["Magasins"])
def lister_magasins(
    depot_id:        Optional[int] = Query(default=None),
    actif_seulement: bool          = Query(default=True),
    db:              Session       = Depends(get_db),
    _user:           dict          = Depends(get_current_user),
):
    q = db.query(Magasin)
    if depot_id:
        q = q.filter(Magasin.depot_id == depot_id)
    if actif_seulement:
        q = q.filter(Magasin.est_actif == True)
    magasins = q.order_by(Magasin.nom).all()
    depots_map = {d.id: d for d in db.query(Depot).all()}
    result = [_magasin_to_response(m, depots_map.get(m.depot_id)) for m in magasins]
    return MagasinList(total=len(result), magasins=result)


@router.post("/magasins", response_model=MagasinResponse, status_code=status.HTTP_201_CREATED, tags=["Magasins"])
def creer_magasin(
    data: MagasinCreate,
    db:   Session = Depends(get_db),
    _user:dict    = Depends(get_current_gestionnaire_or_admin),
):
    depot = db.query(Depot).filter(Depot.id == data.depot_id, Depot.est_actif == True).first()
    if not depot:
        raise HTTPException(status_code=404, detail=f"Dépôt {data.depot_id} introuvable ou inactif")
    if db.query(Magasin).filter(Magasin.code == data.code).first():
        raise HTTPException(status_code=400, detail=f"Code '{data.code}' déjà utilisé")
    m = Magasin(**data.model_dump())
    db.add(m); db.commit(); db.refresh(m)
    return _magasin_to_response(m, depot)


@router.get("/magasins/{magasin_id}", response_model=MagasinResponse, tags=["Magasins"])
def get_magasin(magasin_id: int, db: Session = Depends(get_db), _user: dict = Depends(get_current_user)):
    m = db.query(Magasin).filter(Magasin.id == magasin_id).first()
    if not m:
        raise HTTPException(status_code=404, detail=f"Magasin {magasin_id} introuvable")
    depot = db.query(Depot).filter(Depot.id == m.depot_id).first()
    return _magasin_to_response(m, depot)


@router.put("/magasins/{magasin_id}", response_model=MagasinResponse, tags=["Magasins"])
def modifier_magasin(
    magasin_id: int, data: MagasinUpdate,
    db: Session = Depends(get_db), _user: dict = Depends(get_current_gestionnaire_or_admin),
):
    m = db.query(Magasin).filter(Magasin.id == magasin_id).first()
    if not m:
        raise HTTPException(status_code=404, detail=f"Magasin {magasin_id} introuvable")
    if data.depot_id and data.depot_id != m.depot_id:
        new_depot = db.query(Depot).filter(Depot.id == data.depot_id, Depot.est_actif == True).first()
        if not new_depot:
            raise HTTPException(status_code=404, detail=f"Dépôt {data.depot_id} introuvable")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    db.commit(); db.refresh(m)
    depot = db.query(Depot).filter(Depot.id == m.depot_id).first()
    return _magasin_to_response(m, depot)


@router.delete("/magasins/{magasin_id}", response_model=MessageResponse, tags=["Magasins"])
def supprimer_magasin(magasin_id: int, db: Session = Depends(get_db), _user: dict = Depends(get_current_admin)):
    m = db.query(Magasin).filter(Magasin.id == magasin_id).first()
    if not m:
        raise HTTPException(status_code=404, detail=f"Magasin {magasin_id} introuvable")
    m.est_actif = False
    db.commit()
    return MessageResponse(message=f"Magasin '{m.nom}' désactivé")


@router.patch("/magasins/{magasin_id}/capacite", tags=["Magasins"])
def update_magasin_capacite(
    magasin_id: int, data: CapaciteUpdate,
    db: Session = Depends(get_db), _user: dict = Depends(get_current_user),
):
    m = db.query(Magasin).filter(Magasin.id == magasin_id).first()
    if not m:
        raise HTTPException(status_code=404, detail=f"Magasin {magasin_id} introuvable")
    m.capacite_utilisee = max(0.0, m.capacite_utilisee + data.delta)
    db.commit()
    return {"ok": True, "capacite_utilisee": m.capacite_utilisee}


# ═══════════════════════════════════════════════════════════
# ROUTES TRANSFERTS  (DÉPÔT ↔ MAGASIN)
# ═══════════════════════════════════════════════════════════

@router.post("/transfers/depot-to-magasin", response_model=TransfertResponse, tags=["Transferts"])
async def transfert_depot_vers_magasin(
    data:        TransfertDepotMagasin,
    db:          Session                      = Depends(get_db),
    _user:       dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    depot   = db.query(Depot).filter(Depot.id == data.depot_id,   Depot.est_actif   == True).first()
    magasin = db.query(Magasin).filter(Magasin.id == data.magasin_id, Magasin.est_actif == True).first()
    if not depot:
        raise HTTPException(status_code=404, detail=f"Dépôt {data.depot_id} introuvable")
    if not magasin:
        raise HTTPException(status_code=404, detail=f"Magasin {data.magasin_id} introuvable")
    if magasin.depot_id != data.depot_id:
        raise HTTPException(status_code=400,
            detail=f"Le magasin '{magasin.nom}' n'appartient pas au dépôt '{depot.nom}'")

    async with httpx.AsyncClient(timeout=10.0) as client:
        r_dim = await client.patch(
            f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/diminuer",
            json={
                "produit_id": data.produit_id, "entrepot_id": data.depot_id,
                "depot_id": data.depot_id, "location_type": "DEPOT",
                "quantite": data.quantite, "mouvement_ref": data.reference,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        if r_dim.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Stock dépôt insuffisant : {r_dim.json()}")

        r_aug = await client.patch(
            f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/augmenter",
            json={
                "produit_id": data.produit_id, "entrepot_id": data.magasin_id,
                "magasin_id": data.magasin_id, "location_type": "MAGASIN",
                "quantite": data.quantite, "mouvement_ref": data.reference,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        if r_aug.status_code != 200:
            await client.patch(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/augmenter",
                json={
                    "produit_id": data.produit_id, "entrepot_id": data.depot_id,
                    "depot_id": data.depot_id, "location_type": "DEPOT",
                    "quantite": data.quantite,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            raise HTTPException(status_code=502, detail=f"Erreur crédit magasin : {r_aug.json()}")

    qte_depot   = r_dim.json().get("quantite", 0)
    qte_magasin = r_aug.json().get("quantite", 0)
    depot.capacite_utilisee   = max(0, depot.capacite_utilisee   - data.quantite)
    magasin.capacite_utilisee = magasin.capacite_utilisee + data.quantite
    db.commit()
    return TransfertResponse(
        success=True,
        message=f"Transfert de {data.quantite} unités : {depot.nom} → {magasin.nom}",
        quantite_depot=qte_depot,
        quantite_magasin=qte_magasin,
    )


@router.post("/transfers/magasin-to-depot", response_model=TransfertResponse, tags=["Transferts"])
async def retour_magasin_vers_depot(
    data:        TransfertMagasinDepot,
    db:          Session                      = Depends(get_db),
    _user:       dict                         = Depends(get_current_gestionnaire_or_admin),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    magasin = db.query(Magasin).filter(Magasin.id == data.magasin_id, Magasin.est_actif == True).first()
    depot   = db.query(Depot).filter(Depot.id == data.depot_id,     Depot.est_actif   == True).first()
    if not magasin:
        raise HTTPException(status_code=404, detail=f"Magasin {data.magasin_id} introuvable")
    if not depot:
        raise HTTPException(status_code=404, detail=f"Dépôt {data.depot_id} introuvable")
    if magasin.depot_id != data.depot_id:
        raise HTTPException(status_code=400,
            detail=f"Le magasin '{magasin.nom}' n'appartient pas au dépôt '{depot.nom}'")

    async with httpx.AsyncClient(timeout=10.0) as client:
        r_dim = await client.patch(
            f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/diminuer",
            json={
                "produit_id": data.produit_id, "entrepot_id": data.magasin_id,
                "magasin_id": data.magasin_id, "location_type": "MAGASIN",
                "quantite": data.quantite,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        if r_dim.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Stock magasin insuffisant : {r_dim.json()}")

        r_aug = await client.patch(
            f"{settings.STOCK_SERVICE_URL}/api/v1/stocks/augmenter",
            json={
                "produit_id": data.produit_id, "entrepot_id": data.depot_id,
                "depot_id": data.depot_id, "location_type": "DEPOT",
                "quantite": data.quantite,
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    qte_magasin = r_dim.json().get("quantite", 0)
    qte_depot   = r_aug.json().get("quantite", 0) if r_aug.status_code == 200 else 0
    magasin.capacite_utilisee = max(0, magasin.capacite_utilisee - data.quantite)
    depot.capacite_utilisee   = depot.capacite_utilisee + data.quantite
    db.commit()
    return TransfertResponse(
        success=True,
        message=f"Retour de {data.quantite} unités : {magasin.nom} → {depot.nom}",
        quantite_depot=qte_depot,
        quantite_magasin=qte_magasin,
    )


# ═══════════════════════════════════════════════════════════
# ROUTE COHÉRENCE DES STOCKS
# ═══════════════════════════════════════════════════════════

@router.get("/coherence/check", tags=["Cohérence"])
async def verifier_coherence(
    db:          Session                      = Depends(get_db),
    _user:       dict                         = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    depots   = db.query(Depot).filter(Depot.est_actif == True).all()
    magasins = db.query(Magasin).filter(Magasin.est_actif == True).all()
    depot_ids   = [d.id for d in depots]
    magasin_ids = [m.id for m in magasins]

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                f"{settings.STOCK_SERVICE_URL}/api/v1/stocks",
                headers={"Authorization": f"Bearer {token}"},
                params={"per_page": 1000},
            )
            stocks = resp.json() if resp.status_code == 200 else []
            if isinstance(stocks, dict):
                stocks = stocks.get("stocks", [])
        except Exception:
            stocks = []

    from collections import defaultdict
    depot_qte   = defaultdict(lambda: defaultdict(float))
    magasin_qte = defaultdict(lambda: defaultdict(float))

    magasin_map = {m.id: m.depot_id for m in magasins}
    for s in stocks:
        pid          = s.get("produit_id")
        qte          = s.get("quantite", 0)
        loc_type     = s.get("location_type")
        did          = s.get("depot_id")
        mid          = s.get("magasin_id")
        # Fallback : utiliser entrepot_id si depot_id/magasin_id absents (compat legacy)
        if loc_type == "DEPOT" or (did and did in depot_ids):
            depot_qte[did][pid] += qte
        elif loc_type == "MAGASIN" or (mid and mid in magasin_ids):
            if mid in magasin_map:
                magasin_qte[magasin_map[mid]][pid] += qte
        else:
            eid = s.get("entrepot_id")
            if eid in depot_ids:
                depot_qte[eid][pid] += qte
            elif eid in magasin_map:
                magasin_qte[magasin_map[eid]][pid] += qte

    violations = []
    for depot in depots:
        for produit_id, qte_depot in depot_qte[depot.id].items():
            qte_magasins = magasin_qte[depot.id].get(produit_id, 0)
            if qte_magasins > qte_depot:
                violations.append({
                    "depot_id": depot.id,
                    "depot_nom": depot.nom,
                    "produit_id": produit_id,
                    "quantite_depot": qte_depot,
                    "quantite_magasins": qte_magasins,
                    "statut": "INCOHERENT",
                })

    return {
        "nb_violations": len(violations),
        "coherent": len(violations) == 0,
        "violations": violations,
    }

