# app/dependencies.py — service_ia_rag/

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.database import get_db
from app.config import settings

security = HTTPBearer()


def verify_token(token: str) -> dict:
    """Vérifie et décode un token JWT."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token invalide")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    return verify_token(credentials.credentials)


def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé : admin requis")
    return current_user


def get_current_gestionnaire_or_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    if current_user.get("role") not in ["admin", "gestionnaire"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return current_user


def get_pagination(page: int = 1, per_page: int = 10) -> dict:
    page     = max(1, page)
    per_page = min(max(1, per_page), 100)
    return {
        "page": page,
        "per_page": per_page,
        "skip": (page - 1) * per_page,
        "limit": per_page
    }
