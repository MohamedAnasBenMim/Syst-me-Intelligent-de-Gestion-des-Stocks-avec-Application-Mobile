# app/routes.py — service_auth/
# Tous les endpoints du Auth Service

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import or_
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials  # noqa: F401 — utilisé dans logout
from sqlalchemy.orm import Session
from typing import List
import logging
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


async def _envoyer_email_otp(destinataire: str, otp: str, prenom: str) -> None:
    """Envoie le code OTP de réinitialisation par email via SMTP Gmail."""
    message = MIMEMultipart("alternative")
    message["From"]    = settings.SMTP_USER
    message["To"]      = destinataire
    message["Subject"] = "SGS SaaS — Votre code de réinitialisation"

    contenu_html = f"""
    <html>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0F1F3D;padding:24px;border-radius:8px 8px 0 0;">
        <h1 style="color:white;margin:0;font-size:22px;">SGS SaaS</h1>
      </div>
      <div style="background:#f8f9fa;padding:28px;border:1px solid #dee2e6;">
        <h2 style="color:#1e293b;margin-top:0;">Réinitialisation de mot de passe</h2>
        <p>Bonjour <strong>{prenom}</strong>,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.<br>
           Utilisez le code ci-dessous pour confirmer votre identité :</p>

        <div style="text-align:center;margin:32px 0;">
          <div style="display:inline-block;background:linear-gradient(135deg,#5784BA,#9AC8EB);
                      border-radius:14px;padding:20px 40px;">
            <span style="font-size:38px;font-weight:900;color:white;
                         letter-spacing:10px;font-family:monospace;">
              {otp}
            </span>
          </div>
        </div>

        <p style="text-align:center;font-size:13px;color:#64748b;">
          Ce code est valable <strong>15 minutes</strong>.<br>
          Si vous n'avez pas fait cette demande, ignorez cet email.
        </p>
      </div>
      <div style="background:#6c757d;padding:10px;border-radius:0 0 8px 8px;text-align:center;">
        <p style="color:white;margin:0;font-size:12px;">
          SGS SaaS — Système de Gestion de Stock
        </p>
      </div>
    </body>
    </html>
    """
    message.attach(MIMEText(contenu_html, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            message,
            hostname  = settings.SMTP_HOST,
            port      = settings.SMTP_PORT,
            username  = settings.SMTP_USER,
            password  = settings.SMTP_PASSWORD,
            start_tls = True,
        )
        logger.info(f"[RESET PASSWORD] Code OTP envoyé à {destinataire}")
    except Exception as e:
        logger.error(f"[RESET PASSWORD] Échec envoi OTP à {destinataire} : {e}")

from app.database import get_db
from app.dependencies import get_current_user, only_admin
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    generate_otp,
    create_otp_session,
    verify_otp_session,
)
from app import models, schemas
from app.config import settings

security = HTTPBearer()


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
    # Chercher l'utilisateur par email (sans filtre est_actif pour distinguer les cas)
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.email == data.email.lower(),
    ).first()

    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Aucun compte trouvé avec cet email. Veuillez créer un compte.",
        )
    if not utilisateur.est_actif:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Votre compte a été désactivé. Contactez un administrateur.",
        )
    if not verify_password(data.password, utilisateur.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe incorrect.",
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
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db:          Session                      = Depends(get_db),
    user:        dict                         = Depends(get_current_user),
):
    token = credentials.credentials
    blacklist = models.TokenBlacklist(token=token, user_id=user["user_id"])
    db.add(blacklist)
    db.commit()
    return schemas.MessageResponse(message="Déconnexion réussie", success=True)


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
# ENDPOINT PUBLIC — MOT DE PASSE OUBLIÉ
# ══════════════════════════════════════════════════════════

@router.post(
    "/auth/forgot-password",
    response_model=schemas.ForgotPasswordResponse,
    tags=["Authentification"],
    summary="Envoyer un code OTP de réinitialisation par email",
)
async def forgot_password(
    data:       schemas.ForgotPasswordRequest,
    background: BackgroundTasks,
    db:         Session = Depends(get_db),
):
    """
    Génère un code OTP à 6 chiffres, l'envoie par email en arrière-plan,
    et retourne immédiatement un session_token (JWT signé).
    Retourne toujours succès pour ne pas révéler si l'email existe.
    """
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.email     == data.email.lower().strip(),
        models.Utilisateur.est_actif == True,
    ).first()

    session_token = None
    if utilisateur:
        otp           = generate_otp()
        session_token = create_otp_session(utilisateur.id, utilisateur.email, otp)
        # Envoi email en arrière-plan — ne bloque plus la réponse HTTP
        background.add_task(
            _envoyer_email_otp,
            destinataire = utilisateur.email,
            otp          = otp,
            prenom       = utilisateur.prenom,
        )

    return schemas.ForgotPasswordResponse(
        message       = "Si cet email est associé à un compte, un code de vérification a été envoyé.",
        session_token = session_token,
    )


@router.post(
    "/auth/clerk-login",
    response_model=schemas.TokenResponse,
    tags=["Authentification"],
    summary="Connexion via Google OAuth (Clerk)",
)
async def clerk_login(
    data: schemas.ClerkLoginRequest,
    db:   Session = Depends(get_db),
):
    """
    Reçoit les données OAuth Google vérifiées par Clerk côté frontend,
    puis crée ou retrouve l'utilisateur SGS et retourne notre JWT.
    """
    # 1. Valider les données reçues du frontend
    email = (data.email or "").lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email invalide")

    if not data.clerk_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Identifiant Google manquant")

    prenom = data.prenom or email.split("@")[0]
    nom    = data.nom    or ""

    logger.info(f"[CLERK LOGIN] Tentative — clerk_id={data.clerk_user_id} email={email}")

    # 2. Trouver ou créer l'utilisateur SGS — recherche par clerk_user_id OU email
    utilisateur = db.query(models.Utilisateur).filter(
        or_(
            models.Utilisateur.clerk_user_id == data.clerk_user_id,
            models.Utilisateur.email == email,
        )
    ).first()

    if not utilisateur:
        utilisateur = models.Utilisateur(
            prenom        = prenom,
            nom           = nom,
            email         = email,
            password      = hash_password(f"google_{data.clerk_user_id}_{settings.JWT_SECRET_KEY[:8]}"),
            role          = "operateur",
            clerk_user_id = data.clerk_user_id,
        )
        db.add(utilisateur)
        db.commit()
        db.refresh(utilisateur)
        logger.info(f"[CLERK LOGIN] Nouvel utilisateur Google créé : {email}")
    else:
        # Réactiver si désactivé, stocker clerk_user_id si absent, mettre à jour les infos
        if not utilisateur.est_actif:
            utilisateur.est_actif = True
        if not utilisateur.clerk_user_id:
            utilisateur.clerk_user_id = data.clerk_user_id
        utilisateur.prenom = utilisateur.prenom or prenom
        utilisateur.nom    = utilisateur.nom    or nom
        db.commit()
        db.refresh(utilisateur)
        logger.info(f"[CLERK LOGIN] Utilisateur existant connecté : {email} (id={utilisateur.id})")

    # 3. Retourner notre JWT SGS
    token = create_access_token({
        "user_id": utilisateur.id,
        "email":   utilisateur.email,
        "nom":     utilisateur.nom,
        "role":    utilisateur.role,
    })
    return schemas.TokenResponse(
        access_token = token,
        token_type   = "bearer",
        expires_in   = settings.JWT_EXPIRE_MINUTES,
        user_id      = utilisateur.id,
        role         = utilisateur.role,
    )


@router.post(
    "/auth/reset-password",
    response_model=schemas.MessageResponse,
    tags=["Authentification"],
    summary="Valider le code OTP et définir le nouveau mot de passe",
)
async def reset_password(
    data: schemas.ResetPasswordRequest,
    db:   Session = Depends(get_db),
):
    """
    Vérifie le code OTP via le session_token signé,
    puis met à jour le mot de passe si le code est correct.
    """
    payload = verify_otp_session(data.session_token, data.otp_code)

    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id        == payload["user_id"],
        models.Utilisateur.email     == payload["email"],
        models.Utilisateur.est_actif == True,
    ).first()

    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable",
        )

    utilisateur.password = hash_password(data.nouveau_password)
    db.commit()

    return schemas.MessageResponse(
        message="Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.",
        success=True,
    )


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
    email_normalise = data.email.lower().strip()

    # Vérifier unicité email
    existant = db.query(models.Utilisateur).filter(
        models.Utilisateur.email == email_normalise
    ).first()
    if existant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{email_normalise}' déjà utilisé",
        )

    utilisateur = models.Utilisateur(
        nom      = data.nom,
        prenom   = data.prenom,
        email    = email_normalise,
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
    Lister tous les utilisateurs (actifs et désactivés). Réservé à Admin.
    """
    return db.query(models.Utilisateur).all()


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
    updates = data.dict(exclude_unset=True)
    if "email" in updates:
        updates["email"] = updates["email"].lower().strip()
    for field, value in updates.items():
        setattr(utilisateur, field, value)
    db.commit()
    db.refresh(utilisateur)
    return utilisateur


@router.delete(
    "/utilisateurs/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Utilisateurs"],
    summary="Supprimer définitivement un utilisateur",
)
async def delete_utilisateur(
    user_id: int,
    db:      Session = Depends(get_db),
    current: dict    = Depends(only_admin),
):
    """
    Suppression physique — la ligne est supprimée de la base.
    L'email est libéré et peut être réutilisé pour un nouveau compte.
    Un admin ne peut pas se supprimer lui-même.
    """
    if current.get("user_id") == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez pas supprimer votre propre compte",
        )
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id == user_id
    ).first()
    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur {user_id} introuvable",
        )
    db.delete(utilisateur)
    db.commit()


@router.patch(
    "/utilisateurs/{user_id}/desactiver",
    response_model=schemas.MessageResponse,
    tags=["Utilisateurs"],
    summary="Désactiver un compte utilisateur",
)
async def desactiver_utilisateur(
    user_id: int,
    db:      Session = Depends(get_db),
    current: dict    = Depends(only_admin),
):
    """
    Désactivation logique — est_actif = False.
    Le compte est suspendu mais l'email reste réservé.
    """
    if current.get("user_id") == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez pas désactiver votre propre compte",
        )
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
    return schemas.MessageResponse(message=f"Compte de {utilisateur.prenom} {utilisateur.nom} désactivé.", success=True)


@router.patch(
    "/utilisateurs/{user_id}/reactiver",
    response_model=schemas.MessageResponse,
    tags=["Utilisateurs"],
    summary="Réactiver un compte utilisateur désactivé",
)
async def reactiver_utilisateur(
    user_id: int,
    db:      Session = Depends(get_db),
    _user:   dict    = Depends(only_admin),
):
    """
    Réactivation logique — est_actif = True.
    Permet à l'admin de réactiver un compte suspendu.
    """
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id == user_id
    ).first()
    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur {user_id} introuvable",
        )
    utilisateur.est_actif = True
    db.commit()
    return schemas.MessageResponse(message=f"Compte de {utilisateur.prenom} {utilisateur.nom} réactivé.", success=True)


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