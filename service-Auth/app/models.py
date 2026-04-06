# app/models.py — service_auth/
# Tables PostgreSQL via SQLAlchemy

from sqlalchemy import (
    Column, Integer, String,
    DateTime, Boolean, Float
)
from sqlalchemy.sql import func
from app.database import Base


# ══════════════════════════════════════════════════════════
# TABLE : Utilisateurs
# ══════════════════════════════════════════════════════════
class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom        = Column(String(100), nullable=False)
    prenom     = Column(String(100), nullable=False)
    email      = Column(String(200), unique=True, nullable=False, index=True)
    password   = Column(String(200), nullable=False)
    role       = Column(String(50),  nullable=False, default="operateur")
    # admin | gestionnaire | operateur
    salaire    = Column(Float, nullable=True)    # DT/mois — renseigné par l'admin
    est_actif  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<Utilisateur id={self.id} email={self.email} role={self.role}>"


# ══════════════════════════════════════════════════════════
# TABLE : Tokens révoqués (blacklist JWT)
# ══════════════════════════════════════════════════════════
class TokenBlacklist(Base):
    __tablename__ = "token_blacklist" #Cette table sert à stocker les tokens JWT révoqués.

    id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    token      = Column(String(500), unique=True, nullable=False)
    user_id    = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<TokenBlacklist id={self.id} user_id={self.user_id}>"