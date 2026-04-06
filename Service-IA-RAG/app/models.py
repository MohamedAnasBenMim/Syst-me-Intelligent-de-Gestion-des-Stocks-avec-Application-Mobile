# app/models.py — service_ia_rag/
#
# Pourquoi une BDD PostgreSQL ici en plus de ChromaDB ?
# ─ ChromaDB  → stocke les VECTEURS (embeddings) des mouvements
# ─ PostgreSQL → stocke les RECOMMANDATIONS générées + logs + feedbacks
#
# Les deux sont complémentaires :
#   ChromaDB  = mémoire sémantique (recherche par similarité)
#   PostgreSQL = historique structuré (requêtes SQL, audits)

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Enum, JSON
from sqlalchemy.sql import func
from app.database import Base
import enum


class TypeRecommandation(str, enum.Enum):
    REAPPROVISIONNEMENT = "reapprovisionnement"
    TRANSFERT           = "transfert"
    ALERTE_STOCK        = "alerte_stock"
    OPTIMISATION        = "optimisation"
    PROMOTION           = "promotion"


class StatutRecommandation(str, enum.Enum):
    GENEREE   = "generee"
    ENVOYEE   = "envoyee"
    VUE       = "vue"
    ACCEPTEE  = "acceptee"
    REJETEE   = "rejetee"
    APPLIQUEE = "appliquee"


class UrgenceLevel(str, enum.Enum):
    BASSE    = "basse"
    MOYENNE  = "moyenne"
    HAUTE    = "haute"
    CRITIQUE = "critique"


# ── Table recommandations ──────────────────────────────────
# Stocke chaque recommandation générée par le pipeline RAG
class Recommandation(Base):
    __tablename__ = "recommandations"

    id          = Column(Integer, primary_key=True, index=True)
    produit_id  = Column(Integer, nullable=False, index=True)
    entrepot_id = Column(Integer, nullable=True,  index=True)
    alerte_id   = Column(Integer, nullable=True)

    type   = Column(Enum(TypeRecommandation), default=TypeRecommandation.REAPPROVISIONNEMENT)
    statut = Column(Enum(StatutRecommandation), default=StatutRecommandation.GENEREE)
    urgence = Column(Enum(UrgenceLevel), default=UrgenceLevel.MOYENNE)

    titre               = Column(String(300), nullable=False)
    contenu             = Column(Text,        nullable=False)
    quantite_suggeree   = Column(Float,       nullable=True)
    fournisseur_suggere = Column(String(200), nullable=True)

    confiance_score  = Column(Float, default=0.5)
    sources_rag      = Column(JSON,  nullable=True)
    contexte_utilise = Column(JSON,  nullable=True)

    temps_generation_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ── Table feedbacks ────────────────────────────────────────
class RecommandationFeedback(Base):
    __tablename__ = "recommandation_feedbacks"

    id                = Column(Integer, primary_key=True, index=True)
    recommandation_id = Column(Integer, nullable=False, index=True)
    user_id           = Column(Integer, nullable=True)

    rating          = Column(Integer, nullable=True)
    comment         = Column(Text,    nullable=True)
    action_taken    = Column(String(50), nullable=True)
    quantite_reelle = Column(Float,   nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Table logs embedding ───────────────────────────────────
class EmbeddingLog(Base):
    __tablename__ = "embedding_logs"

    id          = Column(Integer, primary_key=True, index=True)
    operation   = Column(String(50), nullable=False)
    source_type = Column(String(50), nullable=True)
    source_id   = Column(Integer,    nullable=True)

    documents_count = Column(Integer, default=0)
    chunks_created  = Column(Integer, default=0)
    duration_ms     = Column(Integer, nullable=True)

    success       = Column(Boolean, default=True)
    error_message = Column(Text,    nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Table requêtes RAG ─────────────────────────────────────
class RAGQuery(Base):
    __tablename__ = "rag_queries"

    id          = Column(Integer, primary_key=True, index=True)
    query_text  = Column(Text,    nullable=False)
    produit_id  = Column(Integer, nullable=True)
    entrepot_id = Column(Integer, nullable=True)

    documents_retrieved  = Column(Integer, default=0)
    top_similarity_score = Column(Float,   nullable=True)

    llm_response    = Column(Text,        nullable=True)
    llm_tokens_used = Column(Integer,     nullable=True)
    llm_model       = Column(String(100), nullable=True)

    search_time_ms = Column(Integer, nullable=True)
    llm_time_ms    = Column(Integer, nullable=True)
    total_time_ms  = Column(Integer, nullable=True)

    success       = Column(Boolean, default=True)
    error_message = Column(Text,    nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
