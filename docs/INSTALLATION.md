# Guide d'Installation & Démarrage — CartoPlatform Enterprise

Ce guide détaille pas à pas l'installation, la configuration et le déploiement de la plateforme cartographique CartoPlatform sous **Docker Desktop (Windows 11)** et **Linux (Ubuntu/Debian)**.

---

## 1. Prérequis Système

| Composant | Recommandé | Minimum |
| :--- | :--- | :--- |
| **OS** | Windows 11 avec WSL2 ou Linux Ubuntu 22.04+ | Windows 10 Pro / macOS |
| **Docker** | Docker Desktop 4.28+ avec Compose v2 | Docker Engine 24.0+ |
| **RAM** | 8 Go alloués à Docker | 4 Go |
| **CPU** | 4 cœurs virtuels | 2 cœurs |
| **Disque** | 20 Go d'espace libre (SSD) | 10 Go |

---

## 2. Configuration Initiale de l'Environnement

1. Accédez au répertoire de la plateforme :
   ```bash
   cd carto_platform
   ```

2. Créez votre fichier d'environnement local à partir du modèle fourni :
   ```bash
   cp .env.example .env
   ```

3. Modifiez `.env` avec vos valeurs de sécurité (générez des mots de passe robustes pour PostgreSQL, Redis et JWT).

---

## 3. Démarrage Rapide sous Docker Desktop (Windows)

1. Ouvrez un terminal PowerShell dans `d:\app_emploi\carto_platform` :
   ```powershell
   # 1. Vérification que Docker Desktop est bien en cours d'exécution
   docker info
   
   # 2. Construction et démarrage des conteneurs
   docker compose up -d --build
   ```

2. Suivre les logs de démarrage :
   ```powershell
   docker compose logs -f carto-api
   ```

3. Vérification de l'état de santé :
   ```powershell
   docker compose ps
   ```

---

## 4. Points d'Accès aux Services

| Service | URL Locale | Identifiants par Défaut |
| :--- | :--- | :--- |
| **Studio Web GIS & Admin** | `http://localhost:8085/` | Accès direct |
| **Documentation Swagger OpenAPI** | `http://localhost:4000/api/docs` | Public |
| **Endpoint Healthcheck** | `http://localhost:4000/api/health` | Public |
| **Métriques Prometheus** | `http://localhost:9090/` | Sans authentification |
| **Tableaux de bord Grafana** | `http://localhost:3000/` | `admin` / `GrafanaCarto2026!Pass` |
| **PostgreSQL + PostGIS** | `localhost:5432` (`carto_db`) | `carto_user` / `carto_secure_pass` |
| **Cache Redis 7** | `localhost:6379` | `redis_secure_pass` |

---

## 5. Exécution des Tests Automatisés

Pour exécuter la suite de tests d'intégration et de sécurité de l'API :
```powershell
docker compose exec carto-api npm test
```
