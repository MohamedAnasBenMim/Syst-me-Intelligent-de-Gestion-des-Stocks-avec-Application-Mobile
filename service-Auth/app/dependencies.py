# app/dependencies.py — service_auth/
# Dépendances FastAPI : JWT, rôles, session DB

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.auth import verify_token, is_token_blacklisted
from app.database import get_db


# ── Scheme HTTPBearer ──────────────────────────────────────
security = HTTPBearer()


# ══════════════════════════════════════════════════════════
# DÉPENDANCE : Vérifier le JWT
# ══════════════════════════════════════════════════════════
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db:          Session                      = Depends(get_db),
) -> dict:
    """
    Vérifie le token JWT à chaque requête protégée.
    Vérifie aussi que le token n'est pas blacklisté.

    Returns:
        dict {'user_id': int, 'role': str}

    Raises:
        HTTPException 401 si token invalide/expiré/blacklisté
    """
    # Extraire le token depuis le header Authorization
    token = credentials.credentials

    # Vérifier le token JWT
    user_data = verify_token(token)

    # Vérifier si le token est blacklisté (logout)
    if is_token_blacklisted(token, db):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token révoqué — veuillez vous reconnecter",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_data


# ══════════════════════════════════════════════════════════
# DÉPENDANCE : Contrôler les rôles
# ══════════════════════════════════════════════════════════
def require_role(*roles: str):
    """
    Contrôle l'accès par rôle.

    Usage :
        @router.get("/users")
        async def list_users(user=Depends(require_role("admin")))

    Raises:
        HTTPException 403 si rôle non autorisé
    """
    def checker(
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé. Rôles autorisés : {list(roles)}",
            )
        return current_user
    return checker


# ══════════════════════════════════════════════════════════
# RACCOURCIS PRATIQUES
# ══════════════════════════════════════════════════════════
only_admin       = require_role("admin")
admin_or_manager = require_role("admin", "gestionnaire")
all_roles        = require_role("admin", "gestionnaire", "operateur")