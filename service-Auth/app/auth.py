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


# ── OTP de réinitialisation (code 6 chiffres, 15 min) ─────
import hashlib, random as _random

def generate_otp() -> str:
    """Génère un code OTP à 6 chiffres."""
    return f"{_random.randint(100000, 999999)}"


def create_otp_session(user_id: int, email: str, otp: str) -> str:
    """
    Génère un JWT signé contenant le hash SHA-256 de l'OTP.
    Valable 15 minutes. Retourné au frontend après envoi de l'email.
    """
    otp_hash = hashlib.sha256(otp.encode()).hexdigest()
    payload = {
        "user_id":  user_id,
        "email":    email,
        "otp_hash": otp_hash,
        "type":     "otp_reset",
        "exp":      datetime.utcnow() + timedelta(minutes=15),
        "iat":      datetime.utcnow(),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verify_otp_session(token: str, otp_code: str) -> dict:
    """
    Vérifie le JWT de session OTP et le code saisi par l'utilisateur.
    Retourne {'user_id': int, 'email': str} ou lève HTTPException.
    """
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Code invalide ou expiré",
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "otp_reset":
            raise invalid
        expected = hashlib.sha256(otp_code.strip().encode()).hexdigest()
        if expected != payload.get("otp_hash"):
            raise invalid
        return {"user_id": payload["user_id"], "email": payload["email"]}
    except HTTPException:
        raise
    except Exception:
        raise invalid


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