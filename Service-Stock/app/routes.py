# app/routes.py — service_stock/
# Tous les endpoints CRUD du Stock Service

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import httpx
import logging

from app.database import get_db
from app.dependencies import (
    get_current_user,
    only_admin,
    admin_or_manager,
    all_roles,
)
from app import models, schemas
from app.schemas import _verifier_marge
from app.config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer()


async def _notifier_alerte(
    produit:     models.Produit,
    stock:       models.Stock,
    niveau:      str,
    token:       str,
):
    """Appelle le Service Alertes après chaque modification de stock."""
    niveau_upper = niveau.upper()
    location_id  = stock.depot_id or stock.magasin_id or stock.entrepot_id
    if niveau_upper == "NORMAL":
        payload = {
            "produit_id":        produit.id,
            "entrepot_id":       location_id,
            "niveau":            "NORMAL",
            "quantite_actuelle": stock.quantite,
        }
    else:
        payload = {
            "produit_id":        produit.id,
            "produit_nom":       produit.designation,
            "entrepot_id":       location_id,
            "niveau":            niveau_upper,
            "quantite_actuelle": stock.quantite,
            "seuil_alerte_min":  produit.seuil_alerte_min,
            "seuil_alerte_max":  produit.seuil_alerte_max,
        }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.ALERT_SERVICE_URL}/api/v1/alertes/declencher",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
    except Exception as e:
        logger.warning(f"Alerte non envoyée (service indisponible) : {e}")


router = APIRouter()


# ══════════════════════════════════════════════════════════
# FONCTIONS UTILITAIRES PRIVÉES
# ══════════════════════════════════════════════════════════

def _generer_reference(db: Session) -> str:
    prefix = f"PRD-{datetime.now().strftime('%Y%m%d')}-"
    derniere = (
        db.query(models.Produit.reference)
        .filter(models.Produit.reference.like(f"{prefix}%"))
        .order_by(models.Produit.reference.desc())
        .first()
    )
    if derniere and derniere[0]:
        try:
            num = int(derniere[0].split("-")[-1]) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f"{prefix}{num:04d}"


def _calculer_niveau_alerte(quantite: float, produit_id: int, db: Session) -> str:
    if quantite == 0:
        return "rupture"
    produit = db.query(models.Produit).filter(models.Produit.id == produit_id).first()
    if not produit:
        return "normal"
    if quantite <= produit.seuil_alerte_min:
        return "critique"
    if quantite > produit.seuil_alerte_max:
        return "surstock"
    return "normal"


def _enrichir_produit(produit: models.Produit) -> schemas.ProduitResponse:
    """Construit ProduitResponse avec avertissement marge calculé."""
    r = schemas.ProduitResponse.model_validate(produit)
    _, warning = _verifier_marge(produit.prix_achat, produit.prix_vente, produit.type_produit)
    r.avertissement_marge = warning
    return r


# ══════════════════════════════════════════════════════════
# ENDPOINTS — FOURNISSEURS
# ══════════════════════════════════════════════════════════

@router.get(
    "/fournisseurs",
    response_model=schemas.FournisseurList,
    tags=["Fournisseurs"],
    summary="Lister tous les fournisseurs",
)
async def list_fournisseurs(
    actifs_seulement: bool = Query(True),
    skip:  int             = Query(0,   ge=0),
    limit: int             = Query(100, ge=1, le=500),
    db:    Session         = Depends(get_db),
    _user: dict            = Depends(get_current_user),
):
    query = db.query(models.Fournisseur)
    if actifs_seulement:
        query = query.filter(models.Fournisseur.est_actif == True)
    total        = query.count()
    fournisseurs = query.order_by(models.Fournisseur.nom).offset(skip).limit(limit).all()

    # Enrichir avec le nombre de produits liés
    result = []
    for f in fournisseurs:
        r = schemas.FournisseurResponse.model_validate(f)
        r.nb_produits = len(f.produit_fournisseurs)
        result.append(r)

    return schemas.FournisseurList(total=total, fournisseurs=result)


@router.post(
    "/fournisseurs",
    response_model=schemas.FournisseurResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Fournisseurs"],
    summary="Créer un fournisseur",
)
async def create_fournisseur(
    data:  schemas.FournisseurCreate,
    db:    Session = Depends(get_db),
    _user: dict    = Depends(admin_or_manager),
):
    fournisseur = models.Fournisseur(**data.model_dump())
    db.add(fournisseur)
    db.commit()
    db.refresh(fournisseur)
    r = schemas.FournisseurResponse.model_validate(fournisseur)
    r.nb_produits = 0
    return r


@router.get(
    "/fournisseurs/{fournisseur_id}",
    response_model=schemas.FournisseurResponse,
    tags=["Fournisseurs"],
    summary="Détail d'un fournisseur",
)
async def get_fournisseur(
    fournisseur_id: int,
    db:             Session = Depends(get_db),
    _user:          dict    = Depends(get_current_user),
):
    f = db.query(models.Fournisseur).filter(models.Fournisseur.id == fournisseur_id).first()
    if not f:
        raise HTTPException(status_code=404, detail=f"Fournisseur {fournisseur_id} introuvable")
    r = schemas.FournisseurResponse.model_validate(f)
    r.nb_produits = len(f.produit_fournisseurs)
    return r


@router.put(
    "/fournisseurs/{fournisseur_id}",
    response_model=schemas.FournisseurResponse,
    tags=["Fournisseurs"],
    summary="Modifier un fournisseur",
)
async def update_fournisseur(
    fournisseur_id: int,
    data:           schemas.FournisseurUpdate,
    db:             Session = Depends(get_db),
    _user:          dict    = Depends(admin_or_manager),
):
    f = db.query(models.Fournisseur).filter(models.Fournisseur.id == fournisseur_id).first()
    if not f:
        raise HTTPException(status_code=404, detail=f"Fournisseur {fournisseur_id} introuvable")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(f, field, value)
    db.commit()
    db.refresh(f)
    r = schemas.FournisseurResponse.model_validate(f)
    r.nb_produits = len(f.produit_fournisseurs)
    return r


@router.delete(
    "/fournisseurs/{fournisseur_id}",
    response_model=schemas.MessageResponse,
    tags=["Fournisseurs"],
    summary="Désactiver un fournisseur (soft delete)",
)
async def delete_fournisseur(
    fournisseur_id: int,
    db:             Session = Depends(get_db),
    _user:          dict    = Depends(only_admin),
):
    f = db.query(models.Fournisseur).filter(models.Fournisseur.id == fournisseur_id).first()
    if not f:
        raise HTTPException(status_code=404, detail=f"Fournisseur {fournisseur_id} introuvable")
    f.est_actif = False
    db.commit()
    return schemas.MessageResponse(message=f"Fournisseur '{f.nom}' désactivé")


@router.post(
    "/fournisseurs/{fournisseur_id}/produits",
    response_model=schemas.MessageResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Fournisseurs"],
    summary="Lier un produit à ce fournisseur",
)
async def lier_produit_fournisseur(
    fournisseur_id: int,
    data:           schemas.LierProduitFournisseurRequest,
    db:             Session = Depends(get_db),
    _user:          dict    = Depends(admin_or_manager),
):
    f = db.query(models.Fournisseur).filter(models.Fournisseur.id == fournisseur_id).first()
    if not f:
        raise HTTPException(status_code=404, detail=f"Fournisseur {fournisseur_id} introuvable")
    p = db.query(models.Produit).filter(models.Produit.id == data.produit_id).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Produit {data.produit_id} introuvable")

    existant = db.query(models.ProduitFournisseur).filter(
        models.ProduitFournisseur.produit_id     == data.produit_id,
        models.ProduitFournisseur.fournisseur_id == fournisseur_id,
    ).first()
    if existant:
        raise HTTPException(status_code=400, detail="Lien produit-fournisseur déjà existant")

    lien = models.ProduitFournisseur(
        produit_id     = data.produit_id,
        fournisseur_id = fournisseur_id,
        prix_achat     = data.prix_achat,
        est_prefere    = data.est_prefere,
    )
    db.add(lien)
    db.commit()
    return schemas.MessageResponse(message=f"Produit {p.designation} lié au fournisseur {f.nom}")


@router.delete(
    "/fournisseurs/{fournisseur_id}/produits/{produit_id}",
    response_model=schemas.MessageResponse,
    tags=["Fournisseurs"],
    summary="Délier un produit de ce fournisseur",
)
async def delier_produit_fournisseur(
    fournisseur_id: int,
    produit_id:     int,
    db:             Session = Depends(get_db),
    _user:          dict    = Depends(admin_or_manager),
):
    lien = db.query(models.ProduitFournisseur).filter(
        models.ProduitFournisseur.produit_id     == produit_id,
        models.ProduitFournisseur.fournisseur_id == fournisseur_id,
    ).first()
    if not lien:
        raise HTTPException(status_code=404, detail="Lien produit-fournisseur introuvable")
    db.delete(lien)
    db.commit()
    return schemas.MessageResponse(message="Lien supprimé")


@router.get(
    "/fournisseurs/{fournisseur_id}/produits",
    tags=["Fournisseurs"],
    summary="Produits liés à ce fournisseur",
)
async def get_produits_fournisseur(
    fournisseur_id: int,
    db:             Session = Depends(get_db),
    _user:          dict    = Depends(get_current_user),
):
    f = db.query(models.Fournisseur).filter(models.Fournisseur.id == fournisseur_id).first()
    if not f:
        raise HTTPException(status_code=404, detail=f"Fournisseur {fournisseur_id} introuvable")
    return [
        {
            "produit_id":   lien.produit_id,
            "designation":  lien.produit.designation if lien.produit else None,
            "reference":    lien.produit.reference   if lien.produit else None,
            "prix_achat":   lien.prix_achat,
            "est_prefere":  lien.est_prefere,
        }
        for lien in f.produit_fournisseurs
    ]


# ══════════════════════════════════════════════════════════
# ENDPOINTS — PRODUITS
# ══════════════════════════════════════════════════════════

@router.get(
    "/produits",
    response_model=List[schemas.ProduitResponse],
    tags=["Produits"],
    summary="Lister tous les produits actifs",
)
async def list_produits(
    categorie:    Optional[str]            = Query(None),
    type_produit: Optional[schemas.TypeProduit]   = Query(None),
    pattern_vente:Optional[schemas.PatternVente]  = Query(None),
    skip:  int    = Query(0,   ge=0),
    limit: int    = Query(100, ge=1, le=500),
    db:    Session = Depends(get_db),
    _user: dict    = Depends(get_current_user),
):
    query = db.query(models.Produit).filter(models.Produit.est_actif == True)
    if categorie:
        query = query.filter(models.Produit.categorie == categorie)
    if type_produit:
        query = query.filter(models.Produit.type_produit == type_produit.value)
    if pattern_vente:
        query = query.filter(models.Produit.pattern_vente == pattern_vente.value)
    produits = query.offset(skip).limit(limit).all()
    return [_enrichir_produit(p) for p in produits]


@router.post(
    "/produits",
    response_model=schemas.ProduitResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Produits"],
    summary="Créer un nouveau produit",
)
async def create_produit(
    data:        schemas.ProduitCreate,
    db:          Session                      = Depends(get_db),
    _user:       dict                         = Depends(admin_or_manager),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    reference = data.reference
    if not reference:
        reference = _generer_reference(db)
    else:
        reference = reference.upper().strip()
        existant = db.query(models.Produit).filter(
            models.Produit.reference == reference
        ).first()
        if existant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Référence '{reference}' déjà utilisée",
            )

    payload = data.model_dump()
    payload["reference"] = reference

    # Calculer la marge si les deux prix sont fournis
    marge, _ = _verifier_marge(
        payload.get("prix_achat"),
        payload.get("prix_vente"),
        payload.get("type_produit", "CONSOMMABLE"),
    )
    payload["marge_calculee"] = marge

    produit = models.Produit(**payload)
    db.add(produit)
    db.commit()
    db.refresh(produit)

    # Alerte expiration si dans les 30 jours
    if produit.date_expiration:
        jours = (produit.date_expiration - date.today()).days
        if 0 <= jours <= 30:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{settings.ALERT_SERVICE_URL}/api/v1/alertes/declencher",
                        json={
                            "produit_id":        produit.id,
                            "produit_nom":       produit.designation,
                            "entrepot_id":       0,
                            "niveau":            "EXPIRATION_PROCHE",
                            "quantite_actuelle": 0,
                            "message": (
                                f"EXPIRATION PROCHE — {produit.designation} — "
                                f"dans {jours} jour(s)"
                            ),
                        },
                        headers={"Authorization": f"Bearer {credentials.credentials}"},
                    )
            except Exception as e:
                logger.warning(f"Alerte expiration non envoyée : {e}")

    return _enrichir_produit(produit)


@router.get(
    "/produits/{produit_id}",
    response_model=schemas.ProduitResponse,
    tags=["Produits"],
    summary="Détail d'un produit",
)
async def get_produit(
    produit_id: int,
    db:         Session = Depends(get_db),
    _user:      dict    = Depends(get_current_user),
):
    produit = db.query(models.Produit).filter(
        models.Produit.id        == produit_id,
        models.Produit.est_actif == True,
    ).first()
    if not produit:
        raise HTTPException(status_code=404, detail=f"Produit {produit_id} introuvable")
    return _enrichir_produit(produit)


@router.put(
    "/produits/{produit_id}",
    response_model=schemas.ProduitResponse,
    tags=["Produits"],
    summary="Modifier un produit",
)
async def update_produit(
    produit_id: int,
    data:       schemas.ProduitUpdate,
    db:         Session = Depends(get_db),
    _user:      dict    = Depends(admin_or_manager),
):
    produit = db.query(models.Produit).filter(models.Produit.id == produit_id).first()
    if not produit:
        raise HTTPException(status_code=404, detail=f"Produit {produit_id} introuvable")

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(produit, field, value)

    # Recalculer la marge si prix modifiés
    marge, _ = _verifier_marge(produit.prix_achat, produit.prix_vente, produit.type_produit)
    produit.marge_calculee = marge

    db.commit()
    db.refresh(produit)
    return _enrichir_produit(produit)


@router.patch(
    "/produits/{produit_id}/ajouter-reference",
    response_model=schemas.ProduitResponse,
    tags=["Produits"],
    summary="Assigner automatiquement une référence",
)
async def ajouter_reference_produit(
    produit_id: int,
    db:         Session = Depends(get_db),
    _user:      dict    = Depends(all_roles),
):
    produit = db.query(models.Produit).filter(models.Produit.id == produit_id).first()
    if not produit:
        raise HTTPException(status_code=404, detail=f"Produit {produit_id} introuvable")
    if produit.reference:
        return _enrichir_produit(produit)
    produit.reference = _generer_reference(db)
    db.commit()
    db.refresh(produit)
    return _enrichir_produit(produit)


@router.delete(
    "/produits/{produit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Produits"],
    summary="Supprimer un produit (soft delete)",
)
async def delete_produit(
    produit_id: int,
    db:         Session = Depends(get_db),
    _user:      dict    = Depends(only_admin),
):
    produit = db.query(models.Produit).filter(models.Produit.id == produit_id).first()
    if not produit:
        raise HTTPException(status_code=404, detail=f"Produit {produit_id} introuvable")
    stock_existant = db.query(models.Stock).filter(
        models.Stock.produit_id == produit_id,
        models.Stock.quantite   >  0,
    ).first()
    if stock_existant:
        raise HTTPException(status_code=400, detail="Impossible de supprimer : stock > 0")
    produit.est_actif = False
    db.commit()


# ══════════════════════════════════════════════════════════
# ENDPOINTS — STOCKS (consultation)
# ══════════════════════════════════════════════════════════

@router.get(
    "/stocks",
    response_model=List[schemas.StockResponse],
    tags=["Stocks"],
    summary="Lister tous les niveaux de stock",
)
async def list_stocks(
    depot_id:    Optional[int] = Query(None),
    magasin_id:  Optional[int] = Query(None),
    entrepot_id: Optional[int] = Query(None, description="Alias legacy pour depot_id/magasin_id"),
    produit_id:  Optional[int] = Query(None),
    db:          Session       = Depends(get_db),
    _user:       dict          = Depends(get_current_user),
):
    query = db.query(models.Stock)
    if depot_id:
        query = query.filter(models.Stock.depot_id == depot_id)
    elif magasin_id:
        query = query.filter(models.Stock.magasin_id == magasin_id)
    elif entrepot_id:
        query = query.filter(models.Stock.entrepot_id == entrepot_id)
    if produit_id:
        query = query.filter(models.Stock.produit_id == produit_id)
    return query.all()


@router.get(
    "/stocks/alertes",
    response_model=schemas.StockAlertResponse,
    tags=["Stocks"],
    summary="Produits en alerte",
)
async def get_stocks_en_alerte(
    db:    Session = Depends(get_db),
    _user: dict    = Depends(admin_or_manager),
):
    stocks = db.query(models.Stock).filter(
        models.Stock.niveau_alerte.in_(["critique", "rupture", "surstock"])
    ).all()
    return schemas.StockAlertResponse(total_alertes=len(stocks), stocks=stocks)


@router.get(
    "/stocks/depot/{depot_id}",
    response_model=List[schemas.StockResponse],
    tags=["Stocks"],
    summary="Stocks d'un dépôt",
)
async def get_stocks_par_depot(
    depot_id: int,
    db:       Session = Depends(get_db),
    _user:    dict    = Depends(get_current_user),
):
    return db.query(models.Stock).filter(models.Stock.depot_id == depot_id).all()


@router.get(
    "/stocks/magasin/{magasin_id}",
    response_model=List[schemas.StockResponse],
    tags=["Stocks"],
    summary="Stocks d'un magasin",
)
async def get_stocks_par_magasin(
    magasin_id: int,
    db:         Session = Depends(get_db),
    _user:      dict    = Depends(get_current_user),
):
    return db.query(models.Stock).filter(models.Stock.magasin_id == magasin_id).all()


@router.get(
    "/stocks/produit/{produit_id}",
    response_model=List[schemas.StockResponse],
    tags=["Stocks"],
    summary="Stock d'un produit dans tous les dépôts/magasins",
)
async def get_stocks_par_produit(
    produit_id: int,
    db:         Session = Depends(get_db),
    _user:      dict    = Depends(get_current_user),
):
    return db.query(models.Stock).filter(models.Stock.produit_id == produit_id).all()


# ══════════════════════════════════════════════════════════
# ENDPOINTS — AUGMENTER / DIMINUER
# Appelés exclusivement par Service Mouvement (port 8004)
# ══════════════════════════════════════════════════════════

@router.patch(
    "/stocks/augmenter",
    response_model=schemas.StockOperationResponse,
    tags=["Stocks"],
    summary="Augmenter le stock — appelé par Service Mouvement",
)
async def augmenter_stock(
    data:        schemas.StockAugmenter,
    db:          Session                      = Depends(get_db),
    _user:       dict                         = Depends(all_roles),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    produit = db.query(models.Produit).filter(
        models.Produit.id        == data.produit_id,
        models.Produit.est_actif == True,
    ).first()
    if not produit:
        raise HTTPException(status_code=404, detail=f"Produit {data.produit_id} introuvable")

    # entrepot_id est dénormalisé : = depot_id (DEPOT) ou magasin_id (MAGASIN)
    entrepot_id_val = data.entrepot_id or data.depot_id or data.magasin_id

    if data.numero_lot:
        # Entrée par lot : toujours créer un nouvel enregistrement
        stock = models.Stock(
            produit_id      = data.produit_id,
            entrepot_id     = entrepot_id_val,
            quantite        = data.quantite,
            numero_lot      = data.numero_lot,
            fournisseur_id  = data.fournisseur_id,
            fournisseur_nom = data.fournisseur_nom,
            prix_achat_lot  = data.prix_achat_lot,
            prix_vente_lot  = data.prix_vente_lot,
            date_reception  = data.date_reception or date.today(),
            emplacement     = data.emplacement,
            depot_id        = data.depot_id,
            magasin_id      = data.magasin_id,
            location_type   = data.location_type,
        )
        db.add(stock)
        quantite_avant = 0.0
    else:
        # Upsert sur (produit_id, depot_id ou magasin_id) selon location_type
        if data.location_type == "DEPOT" and data.depot_id:
            stock = db.query(models.Stock).filter(
                models.Stock.produit_id == data.produit_id,
                models.Stock.depot_id   == data.depot_id,
                models.Stock.numero_lot == None,
            ).first()
        elif data.location_type == "MAGASIN" and data.magasin_id:
            stock = db.query(models.Stock).filter(
                models.Stock.produit_id  == data.produit_id,
                models.Stock.magasin_id  == data.magasin_id,
                models.Stock.numero_lot  == None,
            ).first()
        else:
            stock = db.query(models.Stock).filter(
                models.Stock.produit_id  == data.produit_id,
                models.Stock.entrepot_id == entrepot_id_val,
                models.Stock.numero_lot  == None,
            ).first()

        if not stock:
            stock = models.Stock(
                produit_id    = data.produit_id,
                entrepot_id   = entrepot_id_val,
                quantite      = 0.0,
                depot_id      = data.depot_id,
                magasin_id    = data.magasin_id,
                location_type = data.location_type,
            )
            db.add(stock)
            db.flush()
        else:
            stock.entrepot_id = entrepot_id_val
            if data.depot_id:      stock.depot_id    = data.depot_id
            if data.magasin_id:    stock.magasin_id  = data.magasin_id
            if data.location_type: stock.location_type = data.location_type

        quantite_avant  = stock.quantite
        stock.quantite += data.quantite

    stock.niveau_alerte = _calculer_niveau_alerte(stock.quantite, data.produit_id, db)
    db.commit()
    db.refresh(stock)

    await _notifier_alerte(produit, stock, stock.niveau_alerte, credentials.credentials)

    return schemas.StockOperationResponse(
        produit_id     = data.produit_id,
        entrepot_id    = stock.entrepot_id,
        quantite_avant = quantite_avant,
        quantite_apres = stock.quantite,
        niveau_alerte  = stock.niveau_alerte,
        message        = f"Stock augmenté de {data.quantite} unités avec succès",
    )


@router.patch(
    "/stocks/diminuer",
    response_model=schemas.StockOperationResponse,
    tags=["Stocks"],
    summary="Diminuer le stock — appelé par Service Mouvement",
)
async def diminuer_stock(
    data:        schemas.StockDiminuer,
    db:          Session                      = Depends(get_db),
    _user:       dict                         = Depends(all_roles),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    produit = db.query(models.Produit).filter(
        models.Produit.id        == data.produit_id,
        models.Produit.est_actif == True,
    ).first()
    if not produit:
        raise HTTPException(status_code=404, detail=f"Produit {data.produit_id} introuvable")

    # Chercher par depot_id ou magasin_id si location_type précisé, sinon par entrepot_id (legacy)
    entrepot_id_val = data.entrepot_id or data.depot_id or data.magasin_id
    if data.location_type == "DEPOT" and data.depot_id:
        stock = db.query(models.Stock).filter(
            models.Stock.produit_id == data.produit_id,
            models.Stock.depot_id   == data.depot_id,
            models.Stock.numero_lot == None,
        ).first()
    elif data.location_type == "MAGASIN" and data.magasin_id:
        stock = db.query(models.Stock).filter(
            models.Stock.produit_id  == data.produit_id,
            models.Stock.magasin_id  == data.magasin_id,
            models.Stock.numero_lot  == None,
        ).first()
    else:
        stock = db.query(models.Stock).filter(
            models.Stock.produit_id  == data.produit_id,
            models.Stock.entrepot_id == entrepot_id_val,
            models.Stock.numero_lot  == None,
        ).first()

    if not stock:
        raise HTTPException(
            status_code=400,
            detail={
                "error":       "Stock inexistant",
                "produit_id":  data.produit_id,
                "entrepot_id": entrepot_id_val,
                "disponible":  0,
                "demande":     data.quantite,
            }
        )

    if stock.quantite < data.quantite:
        raise HTTPException(
            status_code=400,
            detail={
                "error":      "Stock insuffisant",
                "disponible": stock.quantite,
                "demande":    data.quantite,
                "manque":     data.quantite - stock.quantite,
            }
        )

    quantite_avant  = stock.quantite
    stock.quantite -= data.quantite
    stock.niveau_alerte = _calculer_niveau_alerte(stock.quantite, data.produit_id, db)
    db.commit()
    db.refresh(stock)

    await _notifier_alerte(produit, stock, stock.niveau_alerte, credentials.credentials)

    return schemas.StockOperationResponse(
        produit_id     = data.produit_id,
        entrepot_id    = stock.entrepot_id,
        quantite_avant = quantite_avant,
        quantite_apres = stock.quantite,
        niveau_alerte  = stock.niveau_alerte,
        message        = f"Stock diminué de {data.quantite} unités avec succès",
    )


# ══════════════════════════════════════════════════════════
# ENDPOINTS — PROMOTIONS
# ══════════════════════════════════════════════════════════

def _appliquer_promotion_sur_produit(produit: models.Produit, promo: models.Promotion, db: Session):
    produit.en_promotion = True
    produit.prix_promo   = promo.prix_promo
    db.commit()


def _retirer_promotion_sur_produit(produit: models.Produit, db: Session):
    produit.en_promotion = False
    produit.prix_promo   = None
    db.commit()


def _enrichir_promotion(promo: models.Promotion) -> schemas.PromotionResponse:
    r = schemas.PromotionResponse.model_validate(promo)
    if promo.produit:
        r.produit_nom       = promo.produit.designation
        r.produit_reference = promo.produit.reference
    return r


@router.post(
    "/promotions",
    response_model=schemas.PromotionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Promotions"],
    summary="Créer une promotion sur un produit",
)
async def create_promotion(
    data:  schemas.PromotionCreate,
    db:    Session = Depends(get_db),
    _user: dict    = Depends(admin_or_manager),
):
    produit = db.query(models.Produit).filter(
        models.Produit.id        == data.produit_id,
        models.Produit.est_actif == True,
    ).first()
    if not produit:
        raise HTTPException(status_code=404, detail=f"Produit {data.produit_id} introuvable")
    if produit.prix_unitaire <= 0:
        raise HTTPException(status_code=400,
                            detail="Le prix unitaire du produit doit être > 0")

    ancienne = db.query(models.Promotion).filter(
        models.Promotion.produit_id == data.produit_id,
        models.Promotion.est_active == True,
    ).first()
    if ancienne:
        ancienne.est_active = False

    prix_initial = produit.prix_unitaire
    prix_promo   = round(prix_initial * (1 - data.pourcentage_reduction / 100), 2)

    promo = models.Promotion(
        produit_id            = data.produit_id,
        pourcentage_reduction = data.pourcentage_reduction,
        prix_initial          = prix_initial,
        prix_promo            = prix_promo,
        motif                 = data.motif,
        date_debut            = data.date_debut,
        date_fin              = data.date_fin,
        recommandation_ia_id  = data.recommandation_ia_id,
        creee_par_id          = _user.get("user_id"),
        creee_par_nom         = _user.get("email") or _user.get("nom"),
        est_active            = True,
    )
    db.add(promo)
    db.flush()
    _appliquer_promotion_sur_produit(produit, promo, db)
    db.refresh(promo)
    return _enrichir_promotion(promo)


@router.get(
    "/promotions",
    response_model=schemas.PromotionList,
    tags=["Promotions"],
    summary="Lister toutes les promotions",
)
async def list_promotions(
    actives_seulement: bool          = Query(False),
    produit_id:        Optional[int] = Query(None),
    skip:              int           = Query(0,  ge=0),
    limit:             int           = Query(50, ge=1, le=200),
    db:                Session       = Depends(get_db),
    _user:             dict          = Depends(get_current_user),
):
    query = db.query(models.Promotion)
    if actives_seulement:
        query = query.filter(models.Promotion.est_active == True)
    if produit_id:
        query = query.filter(models.Promotion.produit_id == produit_id)

    total      = query.count()
    promotions = query.order_by(models.Promotion.created_at.desc()).offset(skip).limit(limit).all()
    return schemas.PromotionList(
        total=total, page=skip // limit + 1, per_page=limit,
        promotions=[_enrichir_promotion(p) for p in promotions],
    )


@router.get(
    "/promotions/actives",
    response_model=schemas.PromotionList,
    tags=["Promotions"],
    summary="Produits actuellement en promotion",
)
async def promotions_actives(
    db:    Session = Depends(get_db),
    _user: dict    = Depends(get_current_user),
):
    today      = date.today()
    promotions = db.query(models.Promotion).filter(
        models.Promotion.est_active  == True,
        models.Promotion.date_debut  <= today,
        (models.Promotion.date_fin   == None) | (models.Promotion.date_fin >= today),
    ).order_by(models.Promotion.created_at.desc()).all()
    return schemas.PromotionList(
        total=len(promotions), page=1, per_page=len(promotions),
        promotions=[_enrichir_promotion(p) for p in promotions],
    )


@router.get(
    "/promotions/{promotion_id}",
    response_model=schemas.PromotionResponse,
    tags=["Promotions"],
    summary="Détail d'une promotion",
)
async def get_promotion(
    promotion_id: int,
    db:           Session = Depends(get_db),
    _user:        dict    = Depends(get_current_user),
):
    promo = db.query(models.Promotion).filter(models.Promotion.id == promotion_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail=f"Promotion {promotion_id} introuvable")
    return _enrichir_promotion(promo)


@router.put(
    "/promotions/{promotion_id}",
    response_model=schemas.PromotionResponse,
    tags=["Promotions"],
    summary="Modifier une promotion",
)
async def update_promotion(
    promotion_id: int,
    data:         schemas.PromotionUpdate,
    db:           Session = Depends(get_db),
    _user:        dict    = Depends(admin_or_manager),
):
    promo = db.query(models.Promotion).filter(models.Promotion.id == promotion_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail=f"Promotion {promotion_id} introuvable")

    if data.pourcentage_reduction is not None:
        promo.pourcentage_reduction = data.pourcentage_reduction
        promo.prix_promo = round(promo.prix_initial * (1 - data.pourcentage_reduction / 100), 2)
        if promo.est_active and promo.produit:
            promo.produit.prix_promo = promo.prix_promo

    if data.date_fin is not None:
        promo.date_fin = data.date_fin
    if data.motif is not None:
        promo.motif = data.motif
    if data.est_active is not None:
        promo.est_active = data.est_active
        if promo.produit:
            if data.est_active:
                _appliquer_promotion_sur_produit(promo.produit, promo, db)
            else:
                _retirer_promotion_sur_produit(promo.produit, db)

    db.commit()
    db.refresh(promo)
    return _enrichir_promotion(promo)


@router.delete(
    "/promotions/{promotion_id}",
    response_model=schemas.MessageResponse,
    tags=["Promotions"],
    summary="Désactiver une promotion",
)
async def desactiver_promotion(
    promotion_id: int,
    db:           Session = Depends(get_db),
    _user:        dict    = Depends(admin_or_manager),
):
    promo = db.query(models.Promotion).filter(models.Promotion.id == promotion_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail=f"Promotion {promotion_id} introuvable")
    promo.est_active = False
    if promo.produit:
        _retirer_promotion_sur_produit(promo.produit, db)
    db.commit()
    return schemas.MessageResponse(
        message=f"Promotion {promotion_id} désactivée — prix normal rétabli ({promo.prix_initial} DT)"
    )


@router.post(
    "/promotions/appliquer-ia",
    response_model=schemas.PromotionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Promotions"],
    summary="Appliquer une recommandation IA comme promotion",
)
async def appliquer_recommandation_ia(
    produit_id: int,
    data:       schemas.AppliquerIARequest,
    db:         Session = Depends(get_db),
    _user:      dict    = Depends(admin_or_manager),
):
    produit = db.query(models.Produit).filter(
        models.Produit.id        == produit_id,
        models.Produit.est_actif == True,
    ).first()
    if not produit:
        raise HTTPException(status_code=404, detail=f"Produit {produit_id} introuvable")

    ancienne = db.query(models.Promotion).filter(
        models.Promotion.produit_id == produit_id,
        models.Promotion.est_active == True,
    ).first()
    if ancienne:
        ancienne.est_active = False

    prix_initial = produit.prix_unitaire
    prix_promo   = round(prix_initial * (1 - data.pourcentage_reduction / 100), 2)

    promo = models.Promotion(
        produit_id            = produit_id,
        pourcentage_reduction = data.pourcentage_reduction,
        prix_initial          = prix_initial,
        prix_promo            = prix_promo,
        motif                 = "Recommandation IA appliquée",
        date_debut            = date.today(),
        date_fin              = data.date_fin,
        recommandation_ia_id  = data.recommandation_ia_id,
        creee_par_id          = _user.get("user_id"),
        creee_par_nom         = _user.get("email") or _user.get("nom"),
        est_active            = True,
    )
    db.add(promo)
    db.flush()
    _appliquer_promotion_sur_produit(produit, promo, db)
    db.refresh(promo)
    return _enrichir_promotion(promo)


# ══════════════════════════════════════════════════════════
# ENDPOINT — PRODUITS PÉRIMÉS (pour le calcul P&L)
# ══════════════════════════════════════════════════════════

@router.get(
    "/stocks/produits-perimes",
    tags=["Stocks"],
    summary="Valeur des produits périmés par catégorie",
)
async def get_produits_perimes(
    db:    Session = Depends(get_db),
    _user: dict    = Depends(get_current_user),
):
    aujourd_hui = date.today()
    lignes = (
        db.query(models.Stock, models.Produit)
        .join(models.Produit, models.Stock.produit_id == models.Produit.id)
        .filter(
            models.Produit.date_expiration != None,
            models.Produit.date_expiration <  aujourd_hui,
            models.Produit.est_actif       == True,
            models.Stock.quantite          >  0,
        )
        .all()
    )

    categories: dict[str, dict] = {}
    for stock, produit in lignes:
        cat    = produit.categorie or "Sans catégorie"
        valeur = round(produit.prix_unitaire * stock.quantite, 2)
        if cat not in categories:
            categories[cat] = {"categorie": cat, "produits": [], "total_categorie": 0.0}
        categories[cat]["produits"].append({
            "produit_id":       produit.id,
            "reference":        produit.reference,
            "designation":      produit.designation,
            "date_expiration":  str(produit.date_expiration),
            "quantite_restante": stock.quantite,
            "prix_unitaire":    produit.prix_unitaire,
            "valeur_perdue":    valeur,
            "location_type":    stock.location_type,
            "depot_id":         stock.depot_id,
            "magasin_id":       stock.magasin_id,
        })
        categories[cat]["total_categorie"] = round(
            categories[cat]["total_categorie"] + valeur, 2
        )

    categories_list = list(categories.values())
    total_global    = round(sum(c["total_categorie"] for c in categories_list), 2)

    return {
        "date_calcul":  str(aujourd_hui),
        "nb_produits":  len(lignes),
        "total_global": total_global,
        "categories":   categories_list,
    }
