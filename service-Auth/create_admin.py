# create_admin.py — Service-Auth/
# Script à lancer UNE SEULE FOIS pour créer l'admin initial

import os
from dotenv import load_dotenv
from app.database import SessionLocal, engine, Base
from app.models import Utilisateur
from app.auth import hash_password

# Charger le .env global
load_dotenv(r"C:\Users\nherz\OneDrive\Desktop\Projet Gestion-Stock\.env")

# Lire depuis .env — jamais en dur dans le code !
ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# Créer les tables si elles n'existent pas
Base.metadata.create_all(bind=engine)

def create_admin():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("❌ ADMIN_EMAIL ou ADMIN_PASSWORD manquant dans .env !")
        return

    db = SessionLocal()
    try:
        existant = db.query(Utilisateur).filter(
            Utilisateur.email == ADMIN_EMAIL
        ).first()

        if existant:
            print("✅ Admin existe déjà !")
            return

        admin = Utilisateur(
            nom       = "Admin",
            prenom    = "SGS",
            email     = ADMIN_EMAIL,
            password  = hash_password(ADMIN_PASSWORD),
            role      = "admin",
            est_actif = True,
        )
        db.add(admin)
        db.commit()
        print("✅ Admin créé avec succès !")
        print(f"   Email : {ADMIN_EMAIL}")
        print(f"   Role  : admin")

    finally:
        db.close()

if __name__ == "__main__":
    create_admin()