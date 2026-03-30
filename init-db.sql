-- init-db.sql — Création de toutes les bases de données SGS
-- Exécuté automatiquement au démarrage du conteneur PostgreSQL

-- Microservices applicatifs
CREATE DATABASE sgs_auth;
CREATE DATABASE sgs_warehouse;
CREATE DATABASE sgs_stock;
CREATE DATABASE sgs_mouvement;
CREATE DATABASE sgs_alert;
CREATE DATABASE sgs_notification;
CREATE DATABASE sgs_reporting;
CREATE DATABASE sgs_ia_rag;

-- Infrastructure
CREATE DATABASE sgs_n8n;      -- Base de données pour n8n (automatisation)
