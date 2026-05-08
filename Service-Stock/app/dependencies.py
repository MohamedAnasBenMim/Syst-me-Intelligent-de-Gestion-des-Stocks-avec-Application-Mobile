# app/dependencies.py — service_stock/
# Dépendances FastAPI : JWT, rôles, session DB

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.auth import verify_token
from app.database import get_db
from app.config import settings


# ── Scheme HTTPBearer ──────────────────────────────────────
security = HTTPBearer(auto_error=False)


# ══════════════════════════════════════════════════════════
# DÉPENDANCE : Vérifier le JWT
# ══════════════════════════════════════════════════════════
def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """
    Vérifie le token JWT à chaque requête protégée.

    Returns:
        dict {'user_id': int, 'role': str}

    Raises:
        HTTPException 401 si token absent/invalide/expiré
    """
    internal_secret = request.headers.get("X-Internal-Service-Secret")
    if settings.INTEGRATION_SERVICE_SECRET and internal_secret == settings.INTEGRATION_SERVICE_SECRET:
        return {"user_id": 0, "role": "admin", "email": "integration@e-fatoora.local"}

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token manquant",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    user = verify_token(token)
    if user.get("role"):
        user["role"] = str(user["role"]).lower()
    return user


# ══════════════════════════════════════════════════════════
# DÉPENDANCE : Contrôler les rôles
# ══════════════════════════════════════════════════════════
def require_role(*roles: str):
    """
    Contrôle l'accès par rôle.

    Usage :
        @router.post("/produits")
        async def create(user=Depends(require_role("admin", "gestionnaire")))

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
