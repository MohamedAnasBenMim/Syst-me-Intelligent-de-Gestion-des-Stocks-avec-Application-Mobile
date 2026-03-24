# app/auth.py — service_auth/
# Logique JWT + hachage mots de passe

from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext #Bibliothèque pour hachage sécurisé des mots de passe
from fastapi import HTTPException, status

from app.config import settings


# ── Hachage des mots de passe ──────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hacher un mot de passe avec bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifier un mot de passe contre son hash bcrypt."""
    return pwd_context.verify(plain_password, hashed_password)


# ── Génération du token JWT ────────────────────────────────
def create_access_token(data: dict) -> str:
    """
    Générer un token JWT signé.
    Appelé uniquement dans Auth Service après login réussi.

    Args:
        data: dict contenant user_id et role

    Returns:
        Token JWT encodé
    """
    payload = data.copy()
    expire  = datetime.utcnow() + timedelta(
        minutes=settings.JWT_EXPIRE_MINUTES
    )
    payload.update({
        "exp":  expire,
        "iat":  datetime.utcnow(),
        "type": "access",
    })
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


# ── Vérification du token JWT ──────────────────────────────
def verify_token(token: str) -> dict:
    """
    Décoder et valider un token JWT.

    Returns:
        dict {'user_id': int, 'role': str}

    Raises:
        HTTPException 401 si token invalide ou expiré
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: Optional[int] = payload.get("user_id")
        role:    Optional[str] = payload.get("role")

        if user_id is None or role is None:
            raise credentials_exception

        return {"user_id": user_id, "role": role}

    except JWTError:
        raise credentials_exception


# ── Vérification token blacklist ───────────────────────────
def is_token_blacklisted(token: str, db) -> bool:
    """
    Vérifier si un token est dans la blacklist (déconnexion).
    """
    from app.models import TokenBlacklist
    blacklisted = db.query(TokenBlacklist).filter(
        TokenBlacklist.token == token
    ).first()
    return blacklisted is not None