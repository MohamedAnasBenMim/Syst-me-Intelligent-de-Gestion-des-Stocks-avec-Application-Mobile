# app/models.py — service_warehouse/
# Tables PostgreSQL via SQLAlchemy

from sqlalchemy import (
    Column, Integer, String,
    DateTime, Boolean, Float, Text
)
from sqlalchemy.sql import func
from app.database import Base


# ══════════════════════════════════════════════════════════
# TABLE : Entrepôts
# ══════════════════════════════════════════════════════════
class Entrepot(Base):
    __tablename__ = "entrepots"

    id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom          = Column(String(200), nullable=False)
    code         = Column(String(50),  unique=True, nullable=False, index=True)
    adresse      = Column(Text,        nullable=True)
    ville        = Column(String(100), nullable=True)
    capacite_max = Column(Float,       nullable=False, default=1000.0)
    capacite_utilisee = Column(Float,  nullable=False, default=0.0)
    responsable  = Column(String(200), nullable=True)
    telephone    = Column(String(50),  nullable=True)
    est_actif    = Column(Boolean,     default=True, nullable=False)
    created_at   = Column(DateTime,    server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime,    server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<Entrepot id={self.id} code={self.code} nom={self.nom}>"


# ══════════════════════════════════════════════════════════
# TABLE : Zones (sections d'un entrepôt)
# ══════════════════════════════════════════════════════════
class Zone(Base):
    __tablename__ = "zones"

    id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    entrepot_id  = Column(Integer, nullable=False, index=True)
    nom          = Column(String(100), nullable=False)
    code         = Column(String(50),  nullable=False)
    capacite_max = Column(Float,       nullable=False, default=100.0)
    est_actif    = Column(Boolean,     default=True, nullable=False)
    created_at   = Column(DateTime,    server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime,    server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<Zone id={self.id} code={self.code} entrepot={self.entrepot_id}>"