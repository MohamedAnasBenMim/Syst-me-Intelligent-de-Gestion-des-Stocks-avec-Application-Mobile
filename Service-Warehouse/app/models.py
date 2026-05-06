# app/models.py — service_warehouse/
# Tables PostgreSQL via SQLAlchemy

from sqlalchemy import (
    Column, Integer, String,
    DateTime, Boolean, Float, Text, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ══════════════════════════════════════════════════════════
# TABLE : Dépôts  (reçoivent les fournisseurs, alimentent les magasins)
# ══════════════════════════════════════════════════════════

class Depot(Base):
    __tablename__ = "depots"

    id                = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom               = Column(String(200), nullable=False)
    code              = Column(String(50),  unique=True, nullable=False, index=True)
    depot_type        = Column(String(20),  nullable=False, default="REGIONAL")
    adresse           = Column(Text,        nullable=True)
    ville             = Column(String(100), nullable=True)
    latitude          = Column(Float,       nullable=True)
    longitude         = Column(Float,       nullable=True)
    capacite_max      = Column(Float,       nullable=False, default=1000.0)
    capacite_utilisee = Column(Float,       nullable=False, default=0.0)
    responsable       = Column(String(200), nullable=True)
    telephone         = Column(String(50),  nullable=True)
    email_responsable = Column(String(200), nullable=True)
    notes             = Column(Text,        nullable=True)
    est_actif         = Column(Boolean,     default=True,   nullable=False)
    created_at        = Column(DateTime,    server_default=func.now(), nullable=False)
    updated_at        = Column(DateTime,    server_default=func.now(), onupdate=func.now())

    magasins = relationship("Magasin", back_populates="depot")

    @property
    def taux_occupation(self) -> float:
        if self.capacite_max and self.capacite_max > 0:
            return round((self.capacite_utilisee / self.capacite_max) * 100, 2)
        return 0.0

    @property
    def nb_magasins(self) -> int:
        return len([m for m in self.magasins if m.est_actif])

    def __repr__(self):
        return f"<Depot id={self.id} code={self.code} type={self.depot_type}>"


# ══════════════════════════════════════════════════════════
# TABLE : Magasins  (toujours rattachés à un Dépôt parent)
# ══════════════════════════════════════════════════════════
class Magasin(Base):
    __tablename__ = "magasins"

    id                 = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom                = Column(String(200), nullable=False)
    code               = Column(String(50),  unique=True, nullable=False, index=True)
    depot_id           = Column(Integer, ForeignKey("depots.id", ondelete="RESTRICT"),
                                nullable=False, index=True)
    adresse            = Column(Text,        nullable=True)
    ville              = Column(String(100), nullable=True)
    latitude           = Column(Float,       nullable=True)
    longitude          = Column(Float,       nullable=True)
    capacite_max       = Column(Float,       nullable=False, default=500.0)
    capacite_utilisee  = Column(Float,       nullable=False, default=0.0)
    responsable        = Column(String(200), nullable=True)
    telephone          = Column(String(50),  nullable=True)
    email_responsable  = Column(String(200), nullable=True)
    horaires_ouverture = Column(String(200), nullable=True)
    notes              = Column(Text,        nullable=True)
    est_actif          = Column(Boolean,     default=True,   nullable=False)
    created_at         = Column(DateTime,    server_default=func.now(), nullable=False)
    updated_at         = Column(DateTime,    server_default=func.now(), onupdate=func.now())

    depot = relationship("Depot", back_populates="magasins")

    @property
    def taux_occupation(self) -> float:
        if self.capacite_max and self.capacite_max > 0:
            return round((self.capacite_utilisee / self.capacite_max) * 100, 2)
        return 0.0

    def __repr__(self):
        return f"<Magasin id={self.id} code={self.code} depot_id={self.depot_id}>"