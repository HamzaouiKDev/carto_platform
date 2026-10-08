<div align="center">

# 🗺️ CartoPlatform — Plateforme Cartographique Souveraine
### Passerelle API SIG Haute Performance, Cache Multi-Niveaux & Système Hors-Ligne (Offline-First)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green.svg?style=for-the-badge&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_PostGIS_3.4-336791.svg?style=for-the-badge&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-Cache_In--Memory-DC382D.svg?style=for-the-badge&logo=redis)
![Docker](https://img.shields.io/badge/Docker-Compose_Ready-2496ED.svg?style=for-the-badge&logo=docker)
![License](https://img.shields.io/badge/License-Propriétaire_INS-orange.svg?style=for-the-badge)

<p align="center">
  <b>Solution cartographique complète d'entreprise garantissant l'indépendance, la souveraineté des données géographiques et la continuité opérationnelle des enquêtes terrain même en zone blanche (100% hors-ligne).</b>
</p>

---

</div>

## 📌 Présentation Générale

**CartoPlatform** est une infrastructure géospatiale moderne conçue pour répondre aux exigences critiques des institutions statistiques et d'aménagement du territoire (ex. Institut National de la Statistique - INS).

La plateforme résout trois défis majeurs :
1. **Souveraineté & Continuité Hors-Ligne (Offline-First)** : Couverture cartographique complète du territoire national (Tunisie du Zoom 5 au Zoom 15 pré-téléchargée dans un cache local ultra-rapide) permettant aux enquêteurs de travailler sur le terrain sans aucune dépendance à Internet.
2. **Accélération & Écran Protecteur (Proxy-Cache)** : Lorsque la connectivité est disponible, la passerelle absorbe et met en cache persistant les tuiles Satellite HD et Plans jusqu'au **Zoom 19** (précision toitures et parcelles) en divisant par 98% les requêtes vers les fournisseurs externes.
3. **Services SIG Intégrés** : Moteur de calcul d'itinéraires multi-modes (Voiture, Piéton, Vélo), géocodage d'adresses, dessin et numérisation vectorielle sur le terrain (polygones, cercles, mesures de distance et surfaces).

---

## 🏗️ Architecture Technique

```
                              ┌─────────────────────────────────────────┐
                              │     Clients Web & Mobiles / CAPI        │
                              │  (Portail SIG, App Enquêteurs, SIG Web) │
                              └────────────────────┬────────────────────┘
                                                   │ HTTP / REST (API Key)
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                CARTO PLATFORM GATEWAY                                │
│                                                                                      │
│   ┌───────────────────┐     ┌─────────────────────┐     ┌────────────────────────┐   │
│   │   Authentification│     │    Rate Limiter     │     │    Circuit Breaker     │   │
│   │   & Clés API      │     │  Anti-DDoS / Quotas │     │   Résilience Fournisseurs│ │
│   └─────────┬─────────┘     └──────────┬──────────┘     └───────────┬────────────┘   │
│             │                          │                            │                │
│             └──────────────────────────┼────────────────────────────┘                │
│                                        ▼                                             │
│                       ┌─────────────────────────────────┐                            │
│                       │   Moteur de Cache Multi-Niveaux │                            │
│                       └────────┬───────────────┬────────┘                            │
│                                │               │                                     │
│                  HIT (< 1 ms)  │               │ MISS (En ligne)                     │
│                                ▼               ▼                                     │
│                     ┌────────────────────┐   ┌────────────────────────────────┐      │
│                     │    REDIS CACHE     │   │     Fournisseurs Carto Tiers   │      │
│                     │  1.3M+ Tuiles en   │   │  - OpenStreetMap (Plan Rues)   │      │
│                     │  Mémoire / Disque  │   │  - Esri World Imagery (Sat HD) │      │
│                     └────────────────────┘   │  - Esri World Topo & Streets   │      │
│                                              └────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                     ┌──────────────────────────────────────┐
                     │         POSTGRESQL / POSTGIS         │
                     │  - Découpage territorial INS (Gouv)  │
                     │  - Points de ménages & bâtiments     │
                     │  - Journaux d'audit et métriques API │
                     └──────────────────────────────────────┘
```

---

## ✨ Fonctionnalités Clés

### 🛰️ 1. Multi-Fonds de Carte Haute Définition
* **Satellite HD (Esri World Imagery)** : Imagerie spatiale haute résolution jusqu'au Zoom 19 (bâtiments, parcelles, voiries).
* **Plan des Rues (Esri Streets & OpenStreetMap)** : Plans détaillés avec noms des voies, repères et toponymie.
* **Topographie & Relief (Esri Topo)** : Courbes de niveau, reliefs et hydrographie.
* **OpenStreetMap National** : 393 204 tuiles souveraines pré-chargées localement pour tout le pays.

### 🚗 2. Services Géographiques & Calcul d'Itinéraires
* **Routage multi-modes** :
  * 🚙 **Voiture** : Calcul de temps de trajet et itinéraires optimisés pour véhicules.
  * 🚶 **Piéton** : Guidage pas à pas pour les agents de recensement à pied dans les ruelles.
  * 🚲 **Vélo** : Prise en compte du relief et pistes praticables.
* **Géocodage & Recherche d'Adresses** : Recherche instantanée de villes, délégations et points d'intérêt.

### 📐 3. Outils SIG & Numérisation Terrain
* Outils de dessin vectoriel interactifs (points, lignes, polygones, cercles).
* Calcul automatique en temps réel des surfaces (m², hectares) et des distances (m, km).
* Export de données en formats standards : **GeoJSON**, **Shapefile**, **KML**, **CSV**.

### 🛡️ 4. Sécurité, Gouvernance & Monitoring
* **Authentification par jetons API** (`cpt_live_...`) avec gestion des permissions par rôle.
* **Circuit Breaker** : Détection automatique des pannes réseau externes avec bascule sans interruption.
* **Métriques Prometheus** : Suivi en direct du débit, latence, hit-ratio du cache sur `/api/metrics`.
* **Documentation Interactive Swagger / OpenAPI** sur `/api/docs`.

---

## 📂 Structure du Répertoire

```bash
carto_platform/
├── backend/                  # Passerelle API Node.js / Express
│   ├── src/
│   │   ├── config/           # Configuration DB, Redis, Logger, Métriques
│   │   ├── controllers/      # Contrôleurs tuiles, styles, géocodage, routage
│   │   ├── services/         # Logique métier et proxy-cache
│   │   ├── middlewares/      # Auth, Rate Limiter, Audit Logger
│   │   └── routes/           # Endpoints de l'API REST
│   └── migrations/           # Schémas SQL spatiaux PostGIS
├── frontend/                 # Interface Web Cartographique Moderne
│   └── public/
│       ├── app.js            # Logique Leaflet & gestion des calques
│       ├── index.html        # Tableau de bord SIG institutionnel
│       └── style.css         # Design system premium (mode clair/sombre)
├── app_test/                 # Application mobile / tablette dédiée Enquêteurs
│   ├── app.js                # Moteur cartographique léger
│   ├── db.js                 # Stockage local hors-ligne IndexedDB
│   └── index.html            # Interface simplifiée pour le terrain
├── scripts/                  # Scripts d'automatisation, seeding et maintenance
│   ├── download_osm_tunisia.py  # Téléchargeur haute performance multi-thread
│   └── master_runner.py         # Superviseur autonome de déploiement
├── docker-compose.yml        # Orchestration locale / développement
├── docker-compose.production.yml # Configuration haute disponibilité pour production
└── README.md                 # Documentation du projet
```

---

## 🚀 Démarrage Rapide (Déploiement Docker)

### Prérequis
* Docker & Docker Compose v2+
* 4 Go de RAM recommandés
* 30 Go d'espace disque (pour le cache de tuiles)

### 1. Clonage du dépôt
```bash
git clone https://github.com/HamzaouiKDev/carto_platform.git
cd carto_platform
```

### 2. Configuration des variables d'environnement
Copiez le modèle de configuration :
```bash
cp .env.example .env
```
Ajustez les mots de passe de PostgreSQL et Redis dans le fichier `.env`.

### 3. Lancement des conteneurs
```bash
docker compose -f docker-compose.production.yml up -d
```

### 4. Accès aux interfaces
* 🗺️ **Portail SIG Principal** : `http://localhost:8085` (ou IP du serveur)
* 📱 **Application Terrain Enquêteurs** : `http://localhost:8085/app_test/`
* 📚 **Documentation API Swagger** : `http://localhost:4000/api/docs`
* 🩺 **Sonde de Santé Système** : `http://localhost:4000/api/health`

---

## 📡 Endpoints Clés de l'API

| Méthode | Endpoint | Description |
| :---: | :--- | :--- |
| `GET` | `/api/tiles/:provider/:z/:x/:y` | Fournit la tuile cartographique (Cache HIT en < 1ms) |
| `GET` | `/api/geocode/search?q={query}` | Recherche d'adresses et toponymes |
| `GET` | `/api/routing?mode={car\|foot}&from={coords}&to={coords}` | Calcul d'itinéraire avec instructions détaillées |
| `GET` | `/api/providers` | Liste des fournisseurs et état des disjoncteurs |
| `GET` | `/api/health` | Diagnostic de santé (PostgreSQL, PostGIS, Redis, Mémoire) |
| `GET` | `/api/metrics` | Métriques brutes Prometheus pour Grafana |

---

## 🔒 Confidentialité & Sécurité
Ce projet est développé pour un usage institutionnel. Toutes les données d'enquêtes, coordonnées géographiques des ménages et configurations sensibles sont protégées par chiffrement et ne transitent jamais par des services cloud tiers sans autorisation.

---

<div align="center">
  <sub>Développé avec passion pour l'Institut National de la Statistique (INS Tunisie) 🇹🇳</sub>
</div>
