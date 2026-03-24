# app/dependencies.py
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
    Retourne le payload (données de l'utilisateur) si le token est valide.
    Lève une HTTPException 401 si le token est invalide ou expiré.

    Le token est signé avec la même JWT_SECRET_KEY que le Service Auth,
    donc tous les services peuvent vérifier les tokens sans appeler le Service Auth.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        # Vérification que le payload contient bien un user_id
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
    Extrait et vérifie le token JWT depuis le header Authorization.
    Retourne le payload contenant : user_id, email, role.

    Utilisation dans une route :
        @router.get("/entrepots")
        def liste(current_user: dict = Depends(get_current_user)):
            ...
    """
    token = credentials.credentials
    return verify_token(token)


def get_current_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dépendance réservée aux administrateurs.
    Vérifie que le rôle de l'utilisateur est 'admin'.
    Lève une HTTPException 403 si l'utilisateur n'est pas admin.

    Utilisation dans une route réservée à l'admin :
        @router.post("/entrepots")
        def creer_entrepot(current_user: dict = Depends(get_current_admin)):
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
    Dépendance réservée aux gestionnaires ET aux administrateurs.
    Lève une HTTPException 403 si l'utilisateur est un simple opérateur.

    Utilisation dans une route réservée au gestionnaire ou admin :
        @router.post("/entrepots/{id}/zones")
        def creer_zone(current_user: dict = Depends(get_current_gestionnaire_or_admin)):
            ...
    """
    role = current_user.get("role")
    if role not in ["admin", "gestionnaire"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : droits gestionnaire ou administrateur requis"
        )
    return current_user


# ═══════════════════════════════════════════════════════════
# DÉPENDANCE PAGINATION
# ═══════════════════════════════════════════════════════════

def get_pagination(page: int = 1, per_page: int = 10) -> dict:
    """
    Dépendance de pagination réutilisable dans toutes les routes GET de liste.
    Calcule automatiquement l'offset depuis page et per_page.

    Paramètres query string :
        ?page=1&per_page=10

    Utilisation dans une route :
        @router.get("/entrepots")
        def liste(pagination: dict = Depends(get_pagination)):
            skip = pagination["skip"]
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
        "page": page,
        "per_page": per_page,
        "skip": (page - 1) * per_page,
        "limit": per_page
    }