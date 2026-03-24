# app/auth.py — service_stock/
# Logique JWT — utilise config.py (zéro valeur codée en dur)

from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from app.config import settings   # ← depuis .env via config.py


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
    Utilisé uniquement dans les tests.
    La vraie génération se fait dans Auth Service.
    """
    payload = data.copy()
    expire  = datetime.utcnow() + timedelta(
        minutes=settings.JWT_EXPIRE_MINUTES   # ← depuis .env
    )
    payload.update({
        "exp":  expire,
        "iat":  datetime.utcnow(),
        "type": "access",
    })
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,        # ← depuis .env
        algorithm=settings.JWT_ALGORITHM,  # ← depuis .env
    )


# ── Vérification du token JWT ──────────────────────────────
def verify_token(token: str) -> dict:
    """
    Décoder et valider un token JWT.
    Appelé à chaque requête par dependencies.py.

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
            settings.JWT_SECRET_KEY,          # ← depuis .env
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: Optional[int] = payload.get("user_id")
        role:    Optional[str] = payload.get("role")

        if user_id is None or role is None:
            raise credentials_exception

        return {"user_id": user_id, "role": role}

    except JWTError:
        raise credentials_exception