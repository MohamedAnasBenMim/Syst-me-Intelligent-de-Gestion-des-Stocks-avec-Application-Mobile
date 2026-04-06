# app/routes.py — service_stock/
# Tous les endpoints CRUD du Stock Service

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
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
# FONCTIONS UTILITAIRES PRIVÉES
# ══════════════════════════════════════════════════════════

def _generer_reference(db: Session) -> str:
    """
    Génère une référence unique pour un produit.
    Format : PRD-YYYYMMDD-XXXX (XXXX = compteur auto-incrémenté)
    """
    prefix = f"PRD-{datetime.now().strftime('%Y%m%d')}-"
    # Trouver le dernier numéro utilisé pour ce préfixe
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
    # ── Auto-générer la référence si non fournie ───────────
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
    produit = models.Produit(**payload)
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


@router.patch(
    "/produits/{produit_id}/ajouter-reference",
    response_model=schemas.ProduitResponse,
    tags=["Produits"],
    summary="Assigner automatiquement une référence à un produit qui n'en a pas",
    description="Appelé par Service Mouvement lors d'une ENTREE si le produit n'a pas de référence."
)
async def ajouter_reference_produit(
    produit_id: int,
    db:         Session = Depends(get_db),
    _user:      dict    = Depends(all_roles),
):
    produit = db.query(models.Produit).filter(
        models.Produit.id == produit_id
    ).first()
    if not produit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit {produit_id} introuvable",
        )
    if produit.reference:
        # Déjà une référence → rien à faire
        return produit
    produit.reference = _generer_reference(db)
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


# ══════════════════════════════════════════════════════════
# ENDPOINTS — PROMOTIONS
# ══════════════════════════════════════════════════════════

def _appliquer_promotion_sur_produit(produit: models.Produit, promo: models.Promotion, db: Session):
    """Met à jour le produit avec le prix promotionnel."""
    produit.en_promotion = True
    produit.prix_promo   = promo.prix_promo
    db.commit()


def _retirer_promotion_sur_produit(produit: models.Produit, db: Session):
    """Retire la promotion du produit — remet prix normal."""
    produit.en_promotion = False
    produit.prix_promo   = None
    db.commit()


def _enrichir_promotion(promo: models.Promotion) -> schemas.PromotionResponse:
    """Construit la réponse avec les infos dénormalisées du produit."""
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
    description="""
    Crée une promotion manuelle (admin/gestionnaire) ou issue d'une recommandation IA.
    Calcule automatiquement : **prix_promo = prix_unitaire × (1 - pourcentage / 100)**.
    Met à jour le produit avec le prix promotionnel.
    """
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
        raise HTTPException(
            status_code=400,
            detail="Le prix unitaire du produit doit être > 0 pour appliquer une promotion"
        )

    # Désactiver l'ancienne promotion active si elle existe
    ancienne = db.query(models.Promotion).filter(
        models.Promotion.produit_id == data.produit_id,
        models.Promotion.est_active == True,
    ).first()
    if ancienne:
        ancienne.est_active = False

    # Calculer le prix promotionnel
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
    db.flush()  # pour avoir promo.id avant le commit

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
    actives_seulement: bool          = Query(False, description="Retourner uniquement les promotions actives"),
    produit_id:        Optional[int] = Query(None),
    skip:              int           = Query(0,   ge=0),
    limit:             int           = Query(50,  ge=1, le=200),
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
        total      = total,
        page       = skip // limit + 1,
        per_page   = limit,
        promotions = [_enrichir_promotion(p) for p in promotions],
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
        total      = len(promotions),
        page       = 1,
        per_page   = len(promotions),
        promotions = [_enrichir_promotion(p) for p in promotions],
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
    summary="Modifier une promotion (pourcentage, date_fin, motif)",
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
        # Mettre à jour le prix sur le produit si la promo est active
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
        message=f"Promotion {promotion_id} désactivée — produit revenu au prix normal ({promo.prix_initial} DT)"
    )


@router.post(
    "/promotions/appliquer-ia",
    response_model=schemas.PromotionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Promotions"],
    summary="Appliquer une recommandation IA comme promotion",
    description="""
    Applique directement la recommandation de promotion générée par l'IA.
    Fournir l'ID de la recommandation IA et le pourcentage suggéré.
    """
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

    # Désactiver l'ancienne promotion active
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
    description="""
    Identifie tous les produits périmés (date_expiration < aujourd'hui)
    ayant encore du stock > 0, et calcule leur valeur par catégorie.
    Utilisé par Service-Reporting pour le calcul P&L automatique.
    """,
)
async def get_produits_perimes(
    db:    Session = Depends(get_db),
    _user: dict    = Depends(get_current_user),
):
    aujourd_hui = date.today()

    # Jointure Stock ↔ Produit — produits périmés avec stock restant
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

    # Grouper par catégorie
    categories: dict[str, dict] = {}
    for stock, produit in lignes:
        cat     = produit.categorie or "Sans catégorie"
        valeur  = round(produit.prix_unitaire * stock.quantite, 2)

        if cat not in categories:
            categories[cat] = {"categorie": cat, "produits": [], "total_categorie": 0.0}

        categories[cat]["produits"].append({
            "produit_id"      : produit.id,
            "reference"       : produit.reference,
            "designation"     : produit.designation,
            "date_expiration" : str(produit.date_expiration),
            "quantite_restante": stock.quantite,
            "prix_unitaire"   : produit.prix_unitaire,
            "valeur_perdue"   : valeur,
            "entrepot_id"     : stock.entrepot_id,
        })
        categories[cat]["total_categorie"] = round(
            categories[cat]["total_categorie"] + valeur, 2
        )

    categories_list = list(categories.values())
    total_global    = round(sum(c["total_categorie"] for c in categories_list), 2)

    return {
        "date_calcul"  : str(aujourd_hui),
        "nb_produits"  : len(lignes),
        "total_global" : total_global,
        "categories"   : categories_list,
    }