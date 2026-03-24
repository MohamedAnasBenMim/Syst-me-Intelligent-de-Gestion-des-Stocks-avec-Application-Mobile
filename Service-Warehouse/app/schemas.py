# app/schemas.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


# ═══════════════════════════════════════════════════════════
# SCHEMAS ZONE
# ═══════════════════════════════════════════════════════════

class ZoneBase(BaseModel):
    nom: str = Field(..., min_length=2, max_length=100, description="Nom de la zone")
    code: str = Field(..., min_length=1, max_length=20, description="Code unique dans l'entrepôt")
    capacite_max: float = Field(default=100.0, gt=0, description="Capacité maximale de la zone")
    est_actif: bool = Field(default=True)

    @field_validator('code')
    @classmethod
    def code_uppercase(cls, v: str) -> str:
        return v.upper().strip()

    @field_validator('nom')
    @classmethod
    def nom_strip(cls, v: str) -> str:
        return v.strip()


class ZoneCreateInline(ZoneBase):
    """
    Schema utilisé DANS EntrepotCreate.
    Pas besoin de entrepot_id ici car il sera assigné
    automatiquement depuis l'entrepôt parent lors de la création.

    Exemple d'utilisation :
    POST /entrepots  →  body contient une liste de ZoneCreateInline
    """
    pass


class ZoneCreate(ZoneBase):
    """
    Schema utilisé pour créer une zone SEULE après la création de l'entrepôt.
    entrepot_id est obligatoire car l'entrepôt existe déjà en BDD.

    Exemple d'utilisation :
    POST /entrepots/{entrepot_id}/zones  →  body est un ZoneCreate
    """
    entrepot_id: int = Field(..., gt=0, description="ID de l'entrepôt parent")


class ZoneUpdate(BaseModel):
    """
    Schema pour modifier une zone existante.
    Tous les champs sont optionnels — on modifie uniquement ce qu'on envoie.

    Exemple d'utilisation :
    PUT /zones/{zone_id}  →  body est un ZoneUpdate
    """
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    capacite_max: Optional[float] = Field(None, gt=0)
    est_actif: Optional[bool] = None


class ZoneResponse(ZoneBase):
    """
    Schema retourné au client après création ou consultation d'une zone.
    Inclut les champs générés par la BDD (id, entrepot_id, timestamps).
    """
    id: int
    entrepot_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ZoneList(BaseModel):
    """
    Schema pour retourner la liste de toutes les zones d'un entrepôt.

    Exemple d'utilisation :
    GET /entrepots/{entrepot_id}/zones  →  retourne un ZoneList
    """
    total: int
    entrepot_id: int
    zones: list[ZoneResponse]


# ═══════════════════════════════════════════════════════════
# SCHEMAS ENTREPÔT
# ═══════════════════════════════════════════════════════════

class EntrepotBase(BaseModel):
    nom: str = Field(..., min_length=2, max_length=100, description="Nom de l'entrepôt")
    code: str = Field(..., min_length=2, max_length=20, description="Code unique de l'entrepôt")
    adresse: Optional[str] = Field(None, max_length=255)
    ville: Optional[str] = Field(None, max_length=100)
    capacite_max: float = Field(default=1000.0, gt=0, description="Capacité maximale en unités")
    responsable: Optional[str] = Field(None, max_length=100)
    telephone: Optional[str] = Field(None, max_length=20)
    est_actif: bool = Field(default=True)

    @field_validator('code')
    @classmethod
    def code_uppercase(cls, v: str) -> str:
        return v.upper().strip()

    @field_validator('nom')
    @classmethod
    def nom_strip(cls, v: str) -> str:
        return v.strip()


class EntrepotCreate(EntrepotBase):
    """
    Schema pour créer un entrepôt avec ses zones initiales.
    Les zones utilisent ZoneCreateInline (sans entrepot_id)
    car l'entrepôt n'existe pas encore en BDD au moment de l'envoi.
    L'entrepot_id sera assigné automatiquement dans la route après
    insertion de l'entrepôt en BDD.

    Exemple de body envoyé :
    POST /entrepots
    {
        "nom": "Entrepôt Tunis-Nord",
        "code": "TN-001",
        "ville": "Tunis",
        "capacite_max": 1000.0,
        "responsable": "Ahmed Ben Ali",
        "zones": [
            { "nom": "Zone Alimentaire", "code": "A", "capacite_max": 200.0 },
            { "nom": "Zone Électronique", "code": "B", "capacite_max": 300.0 },
            { "nom": "Zone Fragile",      "code": "C", "capacite_max": 150.0 }
        ]
    }
    """
    zones: Optional[list[ZoneCreateInline]] = Field(
        default=[],
        description="Zones initiales de l'entrepôt (optionnel, ajoutables plus tard)"
    )


class EntrepotUpdate(BaseModel):
    """
    Schema pour modifier un entrepôt existant.
    Tous les champs sont optionnels — on modifie uniquement ce qu'on envoie.

    Exemple d'utilisation :
    PUT /entrepots/{entrepot_id}  →  body est un EntrepotUpdate
    """
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    adresse: Optional[str] = Field(None, max_length=255)
    ville: Optional[str] = Field(None, max_length=100)
    capacite_max: Optional[float] = Field(None, gt=0)
    responsable: Optional[str] = Field(None, max_length=100)
    telephone: Optional[str] = Field(None, max_length=20)
    est_actif: Optional[bool] = None


class EntrepotResponse(EntrepotBase):
    """
    Schema retourné au client après création ou consultation d'un entrepôt.
    Inclut :
    - les champs générés par la BDD (id, capacite_utilisee, timestamps)
    - le taux_occupation calculé automatiquement en %
    - la liste des zones de l'entrepôt
    """
    id: int
    capacite_utilisee: float
    taux_occupation: float = 0.0
    zones: list[ZoneResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator('taux_occupation', mode='before')
    @classmethod
    def calculer_taux(cls, v, info):
        """
        Calcule automatiquement le taux d'occupation en %.
        taux = (capacite_utilisee / capacite_max) * 100
        """
        data = info.data
        capacite_max = data.get('capacite_max', 0)
        capacite_utilisee = data.get('capacite_utilisee', 0)
        if capacite_max > 0:
            return round((capacite_utilisee / capacite_max) * 100, 2)
        return 0.0

    model_config = {"from_attributes": True}


class EntrepotList(BaseModel):
    """
    Schema pour retourner la liste paginée des entrepôts.

    Exemple d'utilisation :
    GET /entrepots?page=1&per_page=10  →  retourne un EntrepotList
    """
    total: int
    page: int
    per_page: int
    entrepots: list[EntrepotResponse]


# ═══════════════════════════════════════════════════════════
# SCHEMAS RÉPONSES GÉNÉRIQUES
# ═══════════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    """Réponse simple avec message de succès"""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Réponse retournée en cas d'erreur"""
    detail: str
    success: bool = False