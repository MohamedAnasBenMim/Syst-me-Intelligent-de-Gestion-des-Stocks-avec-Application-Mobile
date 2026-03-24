# Dockerfile — service_warehouse/

# ── Image de base ──────────────────────────────────────────────
# Python 3.11 slim = image légère sans outils inutiles
FROM python:3.11-slim

# ── Répertoire de travail dans le conteneur ────────────────────
WORKDIR /app

# ── Variables d'environnement système ─────────────────────────
# PYTHONDONTWRITEBYTECODE : empêche Python de créer les fichiers .pyc
# PYTHONUNBUFFERED        : affiche les logs en temps réel dans Docker
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── Copier et installer les dépendances ────────────────────────
# On copie requirements.txt AVANT le code source
# → Si le code change mais pas les dépendances,
#   Docker réutilise le cache et ne réinstalle pas tout
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Copier le code source ──────────────────────────────────────
COPY . .

# ── Port exposé ────────────────────────────────────────────────
EXPOSE 8002

# ── Commande de démarrage ──────────────────────────────────────
# host 0.0.0.0 : écoute sur toutes les interfaces réseau du conteneur
# workers 2    : 2 processus pour gérer les requêtes simultanées
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "2"]