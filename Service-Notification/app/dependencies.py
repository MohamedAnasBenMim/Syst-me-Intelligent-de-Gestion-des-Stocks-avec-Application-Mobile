# app/dependencies.py — service_notification/

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.database import get_db
from app.config import settings


# ── Scheme HTTPBearer ──────────────────────────────────────
security = HTTPBearer()


# ── Vérification JWT ───────────────────────────────────────
def verify_token(token: str) -> dict:
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


# ── Dépendances utilisateur ────────────────────────────────
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    token = credentials.credentials
    return verify_token(token)


def get_current_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : droits administrateur requis"
        )
    return current_user


def get_current_gestionnaire_or_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
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
    role = current_user.get("role")
    if role not in ["admin", "gestionnaire", "operateur"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : authentification requise"
        )
    return current_user


# ── Pagination ─────────────────────────────────────────────
def get_pagination(page: int = 1, per_page: int = 10) -> dict:
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