# app/routes.py — service_auth/
# Tous les endpoints du Auth Service

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.dependencies import (
    get_current_user,
    only_admin,
    admin_or_manager,
    all_roles,
)
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    is_token_blacklisted,
)
from app import models, schemas
from app.config import settings


router = APIRouter()


# ══════════════════════════════════════════════════════════
# ENDPOINTS — AUTHENTIFICATION
# ══════════════════════════════════════════════════════════

@router.post(
    "/auth/login",
    response_model=schemas.TokenResponse,
    tags=["Authentification"],
    summary="Connexion utilisateur",
)
async def login(
    data: schemas.LoginRequest,
    db:   Session = Depends(get_db),
):
    """
    Connecter un utilisateur et retourner un token JWT.
    """
    # Chercher l'utilisateur par email
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.email    == data.email.lower(),
        models.Utilisateur.est_actif == True,
    ).first()

    # Vérifier email + mot de passe
    if not utilisateur or not verify_password(
        data.password, utilisateur.password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    # Créer le token JWT
    token = create_access_token({
        "user_id": utilisateur.id,
        "email":   utilisateur.email,
        "nom":     utilisateur.nom,
        "role":    utilisateur.role,
    })

    return schemas.TokenResponse(
        access_token = token,
        token_type   = "bearer",
        expires_in   = settings.JWT_EXPIRE_MINUTES ,
        user_id      = utilisateur.id,
        role         = utilisateur.role,
    )


@router.post(
    "/auth/logout",
    response_model=schemas.MessageResponse,
    tags=["Authentification"],
    summary="Déconnexion utilisateur",
)
async def logout(
    db:   Session = Depends(get_db),
    user: dict    = Depends(get_current_user),
):
    """
    Déconnecter un utilisateur en blacklistant son token.
    """
    from fastapi.security import OAuth2PasswordBearer
    from fastapi import Request

    # Blacklister le token
    blacklist = models.TokenBlacklist(
        token   = "token_révoqué",
        user_id = user["user_id"],
    )
    db.add(blacklist)
    db.commit()

    return schemas.MessageResponse(
        message="Déconnexion réussie",
        success=True,
    )


@router.get(
    "/auth/me",
    response_model=schemas.UtilisateurResponse,
    tags=["Authentification"],
    summary="Profil de l'utilisateur connecté",
)
async def get_me(
    db:   Session = Depends(get_db),
    user: dict    = Depends(get_current_user),
):
    """
    Retourner le profil de l'utilisateur connecté.
    """
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id == user["user_id"]
    ).first()

    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable",
        )
    return utilisateur


# ══════════════════════════════════════════════════════════
# ENDPOINT PUBLIC — INSCRIPTION
# ══════════════════════════════════════════════════════════

@router.post(
    "/auth/register",
    response_model=schemas.UtilisateurResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentification"],
    summary="Inscription publique",
)
async def register(
    data: schemas.UtilisateurCreate,
    db:   Session = Depends(get_db),
):
    """
    Créer un compte utilisateur sans authentification.
    Le rôle admin est interdit à l'inscription publique.
    """
    if data.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Impossible de créer un compte admin via l'inscription publique",
        )

    existant = db.query(models.Utilisateur).filter(
        models.Utilisateur.email == data.email.lower()
    ).first()
    if existant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"L'email '{data.email}' est déjà utilisé",
        )

    utilisateur = models.Utilisateur(
        nom      = data.nom,
        prenom   = data.prenom,
        email    = data.email.lower(),
        password = hash_password(data.password),
        role     = data.role,
        salaire  = data.salaire,
    )
    db.add(utilisateur)
    db.commit()
    db.refresh(utilisateur)
    return utilisateur


# ══════════════════════════════════════════════════════════
# ENDPOINTS — UTILISATEURS
# ══════════════════════════════════════════════════════════

@router.post(
    "/utilisateurs",
    response_model=schemas.UtilisateurResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Utilisateurs"],
    summary="Créer un nouvel utilisateur",
)
async def create_utilisateur(
    data:  schemas.UtilisateurCreate,
    db:    Session = Depends(get_db),
    _user: dict    = Depends(only_admin),
):
    """
    Créer un nouvel utilisateur. Réservé à Admin uniquement.
    """
    # Vérifier unicité email
    existant = db.query(models.Utilisateur).filter(
        models.Utilisateur.email == data.email
    ).first()
    if existant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{data.email}' déjà utilisé",
        )

    utilisateur = models.Utilisateur(
        nom      = data.nom,
        prenom   = data.prenom,
        email    = data.email,
        password = hash_password(data.password),
        role     = data.role,
        salaire  = data.salaire,
    )
    db.add(utilisateur)
    db.commit()
    db.refresh(utilisateur)
    return utilisateur


@router.get(
    "/utilisateurs",
    response_model=List[schemas.UtilisateurResponse],
    tags=["Utilisateurs"],
    summary="Lister tous les utilisateurs",
)
async def list_utilisateurs(
    db:    Session = Depends(get_db),
    _user: dict    = Depends(only_admin),
):
    """
    Lister tous les utilisateurs actifs. Réservé à Admin.
    """
    return db.query(models.Utilisateur).filter(
        models.Utilisateur.est_actif == True
    ).all()


@router.get(
    "/utilisateurs/salaires",
    response_model=schemas.SalairesStatsResponse,
    tags=["Utilisateurs"],
    summary="Total des salaires des employés",
    description="Calcule le total des salaires de tous les employés actifs (gestionnaires + opérateurs). Réservé à Admin.",
)
async def get_salaires_stats(
    db:    Session = Depends(get_db),
    _user: dict    = Depends(only_admin),
):
    """
    Retourne le total des salaires et le détail par employé.
    Utilisé par Service-Reporting pour le calcul P&L.
    """
    employes = db.query(models.Utilisateur).filter(
        models.Utilisateur.est_actif == True,
        models.Utilisateur.salaire   != None,
        models.Utilisateur.salaire   > 0,
    ).all()

    detail = [
        schemas.SalaireEmploye(
            id      = e.id,
            nom     = e.nom,
            prenom  = e.prenom,
            role    = e.role,
            salaire = e.salaire,
        )
        for e in employes
    ]
    total = round(sum(e.salaire for e in employes), 2)

    return schemas.SalairesStatsResponse(
        total_salaires = total,
        nb_employes    = len(employes),
        detail         = detail,
    )


@router.get(
    "/utilisateurs/{user_id}",
    response_model=schemas.UtilisateurResponse,
    tags=["Utilisateurs"],
    summary="Détail d'un utilisateur",
)
async def get_utilisateur(
    user_id: int,
    db:      Session = Depends(get_db),
    _user:   dict    = Depends(only_admin),
):
    """
    Retourner le détail d'un utilisateur par son ID.
    """
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id       == user_id,
        models.Utilisateur.est_actif == True,
    ).first()
    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur {user_id} introuvable",
        )
    return utilisateur


@router.get(
    "/utilisateurs/{user_id}/email",
    include_in_schema=False,  # Endpoint interne — appelé par Service-Alertes
    tags=["Utilisateurs"],
)
async def get_utilisateur_email(
    user_id: int,
    db:      Session = Depends(get_db),
    _user:   dict    = Depends(get_current_user),
):
    """Retourne uniquement l'email d'un utilisateur. Accessible à tous les rôles (usage interne)."""
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id       == user_id,
        models.Utilisateur.est_actif == True,
    ).first()
    if not utilisateur:
        return {"email": None, "nom": None}
    return {"email": utilisateur.email, "nom": utilisateur.nom}


@router.put(
    "/utilisateurs/{user_id}",
    response_model=schemas.UtilisateurResponse,
    tags=["Utilisateurs"],
    summary="Modifier un utilisateur",
)
async def update_utilisateur(
    user_id: int,
    data:    schemas.UtilisateurUpdate,
    db:      Session = Depends(get_db),
    _user:   dict    = Depends(only_admin),
):
    """
    Modifier les informations d'un utilisateur. Réservé à Admin.
    """
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id == user_id
    ).first()
    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur {user_id} introuvable",
        )
    for field, value in data.dict(exclude_unset=True).items():
        setattr(utilisateur, field, value)
    db.commit()
    db.refresh(utilisateur)
    return utilisateur


@router.delete(
    "/utilisateurs/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Utilisateurs"],
    summary="Supprimer un utilisateur",
)
async def delete_utilisateur(
    user_id: int,
    db:      Session = Depends(get_db),
    _user:   dict    = Depends(only_admin),
):
    """
    Suppression logique d'un utilisateur. Réservé à Admin.
    """
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id == user_id
    ).first()
    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur {user_id} introuvable",
        )
    utilisateur.est_actif = False
    db.commit()


@router.put(
    "/utilisateurs/{user_id}/password",
    response_model=schemas.MessageResponse,
    tags=["Utilisateurs"],
    summary="Changer le mot de passe",
)
async def change_password(
    user_id: int,
    data:    schemas.ChangePasswordRequest,
    db:      Session = Depends(get_db),
    user:    dict    = Depends(get_current_user),
):
    """
    Changer le mot de passe d'un utilisateur.
    Un utilisateur peut changer uniquement son propre mot de passe.
    Admin peut changer le mot de passe de n'importe qui.
    """
    # Vérifier droits
    if user["role"] != "admin" and user["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez changer que votre propre mot de passe",
        )

    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id == user_id
    ).first()
    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur {user_id} introuvable",
        )

    # Vérifier ancien mot de passe
    if not verify_password(data.ancien_password, utilisateur.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ancien mot de passe incorrect",
        )

    utilisateur.password = hash_password(data.nouveau_password)
    db.commit()

    return schemas.MessageResponse(
        message="Mot de passe modifié avec succès",
        success=True,
    )