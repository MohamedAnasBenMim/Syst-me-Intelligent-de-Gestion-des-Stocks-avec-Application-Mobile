# app/routes.py — service_stock/
# Tous les endpoints CRUD du Stock Service

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
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
    if niveau == "normal":
        payload = {
            "produit_id":       produit.id,
            "entrepot_id":      stock.entrepot_id,
            "niveau":           "normal",
            "quantite_actuelle": stock.quantite,
        }
    else:
        payload = {
            "produit_id":        produit.id,
            "produit_nom":       produit.designation,
            "entrepot_id":       stock.entrepot_id,
            "niveau":            niveau,
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
# ENDPOINTS — PRODUITS
# ══════════════════════════════════════════════════════════

@router.get(
    "/produits",
    response_model=List[schemas.ProduitResponse],
    tags=["Produits"],
    summary="Lister tous les produits actifs",
)
async def list_produits(
    categorie: Optional[str] = Query(None),
    skip:      int           = Query(0,   ge=0),
    limit:     int           = Query(100, ge=1, le=500),
    db:        Session       = Depends(get_db),
    _user:     dict          = Depends(get_current_user),
):
    query = db.query(models.Produit).filter(
        models.Produit.est_actif == True
    )
    if categorie:
        query = query.filter(models.Produit.categorie == categorie)
    return query.offset(skip).limit(limit).all()


@router.post(
    "/produits",
    response_model=schemas.ProduitResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Produits"],
    summary="Créer un nouveau produit",
)
async def create_produit(
    data:  schemas.ProduitCreate,
    db:    Session = Depends(get_db),
    _user: dict    = Depends(admin_or_manager),
):
    existant = db.query(models.Produit).filter(
        models.Produit.reference == data.reference
    ).first()
    if existant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Référence '{data.reference}' déjà utilisée",
        )
    produit = models.Produit(**data.model_dump())
    db.add(produit)
    db.commit()
    db.refresh(produit)
    return produit


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit {produit_id} introuvable",
        )
    return produit


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
    produit = db.query(models.Produit).filter(
        models.Produit.id == produit_id
    ).first()
    if not produit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit {produit_id} introuvable",
        )
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(produit, field, value)
    db.commit()
    db.refresh(produit)
    return produit


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
    produit = db.query(models.Produit).filter(
        models.Produit.id == produit_id
    ).first()
    if not produit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit {produit_id} introuvable",
        )
    stock_existant = db.query(models.Stock).filter(
        models.Stock.produit_id == produit_id,
        models.Stock.quantite   >  0,
    ).first()
    if stock_existant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer : stock > 0",
        )
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
    entrepot_id: Optional[int] = Query(None),
    db:          Session       = Depends(get_db),
    _user:       dict          = Depends(get_current_user),
):
    query = db.query(models.Stock)
    if entrepot_id:
        query = query.filter(models.Stock.entrepot_id == entrepot_id)
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
    return schemas.StockAlertResponse(
        total_alertes=len(stocks),
        stocks=stocks,
    )


@router.get(
    "/stocks/entrepot/{entrepot_id}",
    response_model=List[schemas.StockResponse],
    tags=["Stocks"],
    summary="Stocks d'un entrepôt",
)
async def get_stocks_par_entrepot(
    entrepot_id: int,
    db:          Session = Depends(get_db),
    _user:       dict    = Depends(get_current_user),
):
    return db.query(models.Stock).filter(
        models.Stock.entrepot_id == entrepot_id
    ).all()


@router.get(
    "/stocks/produit/{produit_id}",
    response_model=List[schemas.StockResponse],
    tags=["Stocks"],
    summary="Stock d'un produit dans tous les entrepôts",
)
async def get_stocks_par_produit(
    produit_id: int,
    db:         Session = Depends(get_db),
    _user:      dict    = Depends(get_current_user),
):
    return db.query(models.Stock).filter(
        models.Stock.produit_id == produit_id
    ).all()


# ══════════════════════════════════════════════════════════
# ENDPOINTS — AUGMENTER / DIMINUER
# Appelés exclusivement par Service Mouvement (port 8004)
# ══════════════════════════════════════════════════════════

@router.patch(
    "/stocks/augmenter",
    response_model=schemas.StockOperationResponse,
    tags=["Stocks"],
    summary="Augmenter le stock — appelé par Service Mouvement",
    description="Appelé lors d'une ENTREE ou TRANSFERT (entrepôt destination)."
)
async def augmenter_stock(
    data:        schemas.StockAugmenter,
    db:          Session                      = Depends(get_db),
    _user:       dict                         = Depends(all_roles),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    # Vérifier que le produit existe
    produit = db.query(models.Produit).filter(
        models.Produit.id        == data.produit_id,
        models.Produit.est_actif == True,
    ).first()
    if not produit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit {data.produit_id} introuvable"
        )

    # Chercher le stock existant ou en créer un nouveau
    stock = db.query(models.Stock).filter(
        models.Stock.produit_id  == data.produit_id,
        models.Stock.entrepot_id == data.entrepot_id,
    ).first()

    if not stock:
        # Premier stock de ce produit dans cet entrepôt
        stock = models.Stock(
            produit_id=data.produit_id,
            entrepot_id=data.entrepot_id,
            quantite=0.0,
        )
        db.add(stock)
        db.flush()

    # Sauvegarder la quantité avant modification
    quantite_avant  = stock.quantite

    # Augmenter le stock
    stock.quantite += data.quantite

    # Recalculer le niveau d'alerte
    stock.niveau_alerte = _calculer_niveau_alerte(
        stock.quantite, data.produit_id, db
    )

    db.commit()
    db.refresh(stock)

    await _notifier_alerte(produit, stock, stock.niveau_alerte, credentials.credentials)

    return schemas.StockOperationResponse(
        produit_id     = data.produit_id,
        entrepot_id    = data.entrepot_id,
        quantite_avant = quantite_avant,
        quantite_apres = stock.quantite,
        niveau_alerte  = stock.niveau_alerte,
        message        = f"Stock augmenté de {data.quantite} unités avec succès"
    )


@router.patch(
    "/stocks/diminuer",
    response_model=schemas.StockOperationResponse,
    tags=["Stocks"],
    summary="Diminuer le stock — appelé par Service Mouvement",
    description="Appelé lors d'une SORTIE ou TRANSFERT (entrepôt source). Vérifie que stock >= quantite."
)
async def diminuer_stock(
    data:        schemas.StockDiminuer,
    db:          Session                      = Depends(get_db),
    _user:       dict                         = Depends(all_roles),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    # Vérifier que le produit existe
    produit = db.query(models.Produit).filter(
        models.Produit.id        == data.produit_id,
        models.Produit.est_actif == True,
    ).first()
    if not produit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit {data.produit_id} introuvable"
        )

    # Vérifier que le stock existe
    stock = db.query(models.Stock).filter(
        models.Stock.produit_id  == data.produit_id,
        models.Stock.entrepot_id == data.entrepot_id,
    ).first()

    if not stock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error"      : "Stock inexistant",
                "produit_id" : data.produit_id,
                "entrepot_id": data.entrepot_id,
                "disponible" : 0,
                "demande"    : data.quantite,
            }
        )

    # Vérifier que le stock est suffisant
    if stock.quantite < data.quantite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error"      : "Stock insuffisant",
                "disponible" : stock.quantite,
                "demande"    : data.quantite,
                "manque"     : data.quantite - stock.quantite,
            }
        )

    # Sauvegarder la quantité avant modification
    quantite_avant  = stock.quantite

    # Diminuer le stock
    stock.quantite -= data.quantite

    # Recalculer le niveau d'alerte
    stock.niveau_alerte = _calculer_niveau_alerte(
        stock.quantite, data.produit_id, db
    )

    db.commit()
    db.refresh(stock)

    await _notifier_alerte(produit, stock, stock.niveau_alerte, credentials.credentials)

    return schemas.StockOperationResponse(
        produit_id     = data.produit_id,
        entrepot_id    = data.entrepot_id,
        quantite_avant = quantite_avant,
        quantite_apres = stock.quantite,
        niveau_alerte  = stock.niveau_alerte,
        message        = f"Stock diminué de {data.quantite} unités avec succès"
    )


# ══════════════════════════════════════════════════════════
# FONCTION UTILITAIRE PRIVÉE
# ══════════════════════════════════════════════════════════

def _calculer_niveau_alerte(
    quantite:   float,
    produit_id: int,
    db:         Session,
) -> str:
    """
    Calcule le niveau d'alerte selon la quantité et les seuils du produit.
    rupture  → quantite == 0
    critique → quantite < seuil_alerte_min
    surstock → quantite > seuil_alerte_max
    normal   → entre seuil_min et seuil_max
    """
    if quantite == 0:
        return "rupture"
    produit = db.query(models.Produit).filter(
        models.Produit.id == produit_id
    ).first()
    if not produit:
        return "normal"
    if quantite < produit.seuil_alerte_min:
        return "critique"
    if quantite > produit.seuil_alerte_max:
        return "surstock"
    return "normal"