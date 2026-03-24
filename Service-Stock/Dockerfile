# Dockerfile — service_stock/

# Image de base Python 3.11 légère
FROM python:3.11-slim

# Dossier de travail dans le conteneur
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Copier les dépendances en premier
# (optimise le cache Docker — si requirements.txt ne change pas
#  Docker ne réinstalle pas tout)
COPY requirements.txt .

# Installer les dépendances
RUN pip install --no-cache-dir -r requirements.txt

# Copier tout le code
COPY . .

# Exposer le port du service
EXPOSE 8003

# Lancer le service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]