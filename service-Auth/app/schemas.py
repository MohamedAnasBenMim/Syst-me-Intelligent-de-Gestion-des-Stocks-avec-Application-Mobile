# app/schemas.py — service_auth/
# Validation des données JSON avec Pydantic

from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum


# ══════════════════════════════════════════════════════════
# ÉNUMÉRATIONS
# ══════════════════════════════════════════════════════════
class RoleEnum(str, Enum):
    admin        = "admin"
    gestionnaire = "gestionnaire"
    operateur    = "operateur"


# ══════════════════════════════════════════════════════════
# SCHEMAS AUTHENTIFICATION
# ══════════════════════════════════════════════════════════
class LoginRequest(BaseModel):
    """Données reçues pour le login."""
    email:    str = Field(..., description="Email de l'utilisateur")
    password: str = Field(..., min_length=6, description="Mot de passe")


class TokenResponse(BaseModel):
    """Token JWT retourné après login."""
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int
    user_id:      int
    role:         str


# ══════════════════════════════════════════════════════════
# SCHEMAS UTILISATEUR
# ══════════════════════════════════════════════════════════
class UtilisateurCreate(BaseModel):
    """Données reçues pour créer un utilisateur."""
    nom:      str = Field(..., min_length=2, max_length=100)
    prenom:   str = Field(..., min_length=2, max_length=100)
    email:    str = Field(..., description="Email unique")
    password: str = Field(..., min_length=6)
    role:     RoleEnum = RoleEnum.operateur

    @validator("email")
    def email_lowercase(cls, v: str) -> str:
        return v.lower().strip()

    @validator("password")
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Mot de passe trop court (minimum 6 caractères)")
        return v


class UtilisateurUpdate(BaseModel):
    """Données reçues pour modifier un utilisateur."""
    nom:       Optional[str]       = None
    prenom:    Optional[str]       = None
    email:     Optional[str]       = None
    role:      Optional[RoleEnum]  = None
    est_actif: Optional[bool]      = None


class UtilisateurResponse(BaseModel):
    """Données retournées par l'API pour un utilisateur."""
    id:         int
    nom:        str
    prenom:     str
    email:      str
    role:       str
    est_actif:  bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    """Données reçues pour changer le mot de passe."""
    ancien_password:  str = Field(..., min_length=6)
    nouveau_password: str = Field(..., min_length=6)

    @validator("nouveau_password")
    def passwords_different(cls, v: str, values: dict) -> str:
        if "ancien_password" in values and v == values["ancien_password"]:
            raise ValueError(
                "Le nouveau mot de passe doit être différent de l'ancien"
            )
        return v


# ══════════════════════════════════════════════════════════
# SCHEMAS GÉNÉRIQUES
# ══════════════════════════════════════════════════════════
class MessageResponse(BaseModel):
    """Réponse simple avec un message."""
    message: str
    success: bool = True