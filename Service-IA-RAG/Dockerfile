FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Installer les dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Pré-télécharger le modèle d'embedding
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Corriger le makefile manquant dans le cmdstan bundlé de Prophet
# (cmdstanpy valide l'existence du makefile avant de charger le backend)
RUN python -c "\
import importlib.resources as r, os; \
p = str(r.files('prophet') / 'stan_model' / 'cmdstan-2.33.1'); \
f = os.path.join(p, 'makefile'); \
open(f, 'w').write('CMDSTAN_VERSION := 2.33.1\n'); \
print('makefile Prophet créé:', f) \
"

COPY . .

# Créer les dossiers de données
RUN mkdir -p /app/data/chroma /app/data/ml_models

EXPOSE 8008

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8008"]
