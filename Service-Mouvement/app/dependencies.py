# app/dependencies.py — service_mouvement/

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.database import get_db
from app.config import settings

# ═══════════════════════════════════════════════════════════
# CONFIGURATION HTTPBEARER
# ═══════════════════════════════════════════════════════════

# HTTPBearer affiche dans Swagger un champ "Value: Bearer <token>"
security = HTTPBearer()


# ═══════════════════════════════════════════════════════════
# VÉRIFICATION DU TOKEN JWT
# ═══════════════════════════════════════════════════════════

def verify_token(token: str) -> dict:
    """
    Décode et vérifie le token JWT.
    Retourne le payload (user_id, email, role) si valide.
    Lève une HTTPException 401 si invalide ou expiré.

    Le token est signé avec la même JWT_SECRET_KEY que
    Service Auth → tous les services peuvent le vérifier
    sans appeler Service Auth à chaque requête.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalide : user_id manquant"
            )
        return payload

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré"
        )


# ═══════════════════════════════════════════════════════════
# DÉPENDANCES UTILISATEUR COURANT
# ═══════════════════════════════════════════════════════════

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dépendance principale — injectée dans toutes les routes protégées.
    Retourne le payload : user_id, email, role.

    Utilisation :
        @router.get("/mouvements")
        def liste(current_user: dict = Depends(get_current_user)):
            ...
    """
    token = credentials.credentials
    return verify_token(token)


def get_current_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Réservé aux administrateurs.
    Lève 403 si l'utilisateur n'est pas admin.

    Utilisation :
        @router.delete("/mouvements/{id}")
        def annuler(current_user: dict = Depends(get_current_admin)):
            ...
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : droits administrateur requis"
        )
    return current_user


def get_current_gestionnaire_or_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Réservé aux gestionnaires ET administrateurs.
    Lève 403 si l'utilisateur est un simple opérateur.

    Utilisation :
        @router.post("/mouvements")
        def creer(current_user: dict = Depends(get_current_gestionnaire_or_admin)):
            ...
    """
    role = current_user.get("role")
    if role not in ["admin", "gestionnaire"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : droits gestionnaire ou administrateur requis"
        )
    return current_user


def get_all_roles(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Accessible à tous les rôles connectés :
    admin, gestionnaire, operateur.

    Utilisation :
        @router.post("/mouvements")
        def creer(current_user: dict = Depends(get_all_roles)):
            ...
    """
    role = current_user.get("role")
    if role not in ["admin", "gestionnaire", "operateur"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : authentification requise"
        )
    return current_user


# ═══════════════════════════════════════════════════════════
# DÉPENDANCE PAGINATION
# ═══════════════════════════════════════════════════════════

def get_pagination(page: int = 1, per_page: int = 10) -> dict:
    """
    Dépendance de pagination réutilisable dans toutes les routes GET.
    Calcule automatiquement l'offset depuis page et per_page.

    Paramètres query string : ?page=1&per_page=10

    Utilisation :
        @router.get("/mouvements")
        def liste(pagination: dict = Depends(get_pagination)):
            skip  = pagination["skip"]
            limit = pagination["limit"]
            ...
    """
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 10
    if per_page > 100:
        per_page = 100

    return {
        "page"    : page,
        "per_page": per_page,
        "skip"    : (page - 1) * per_page,
        "limit"   : per_page
    }