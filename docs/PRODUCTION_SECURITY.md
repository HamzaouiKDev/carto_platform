# Guide de Déploiement en Production, Sécurité & Conformité des Licences

Ce document détaille les recommandations d'architecture de production pour CartoPlatform Enterprise, couvrant le durcissement de la sécurité, la gestion des secrets et le respect strict des licences des fournisseurs cartographiques.

---

## 1. Respect Strict des Licences des Fournisseurs Cartographiques

L'un des risques majeurs d'un serveur cartographique réside dans la violation des conditions d'utilisation (Terms of Service - TOS) des fournisseurs :

### 1.1 Google Maps / Google Map Tiles API
* **Conditions officielles** : Les tuiles Google Maps ne peuvent être téléchargées en masse ou stockées sur disque de façon permanente pour une utilisation hors-ligne.
* **Mise en œuvre dans CartoPlatform** :
  - Utilisation exclusive de la **Google Maps Tile API officielle** (2D Tiles) avec session éphémère.
  - Mise en cache Redis strictement limitée à la durée de session (TTL court).
  - Présentation obligatoire du logo Google et de l'attribution légale `© Google`.
  - Pas d'exposition de la clé privée côté client : le backend injecte la clé côté serveur.

### 1.2 Esri / ArcGIS Online
* **Conditions officielles** : L'accès aux tuiles World Imagery et World Street Map est soumis aux conditions d'Esri Master License Agreement. L'attribution visible `Tiles © Esri, Maxar, Earthstar Geographics` est obligatoire.
* **Mise en œuvre** :
  - Attribution automatique injectée via l'en-tête HTTP `X-Carto-Attribution` et affichée dans la barre de statut de la carte.
  - Respect des quotas d'appels et mise en cache Redis LRU des tuiles consultées.

### 1.3 OpenStreetMap (OSM)
* **Tile Usage Policy** : Les serveurs officiels `tile.openstreetmap.org` interdisent le scraping agressif, exigent un en-tête `User-Agent` valide et unique identifiant le projet avec une adresse de contact, et imposent l'attribution `© OpenStreetMap contributors`.
* **Mise en œuvre** :
  - La variable `OSM_USER_AGENT` est automatiquement transmise à chaque requête.
  - Le rate limiter local protège contre les dépassements de fréquence.

### 1.4 MapTiler Cloud
* Nécessite une clé API `MAPTILER_API_KEY`. Respect des limites mensuelles de tuiles vectorielles/raster.

---

## 2. Sécurité des Clés d'API & Jetons (API Tokens)

1. **Stockage Chiffré & Haché** :
   - Les clés générées (`cpt_live_...`) ne sont **JAMAIS stockées en clair** dans PostgreSQL.
   - Seul le hash cryptographique **SHA-256** est persisté.
   - La clé n'est affichée **qu'une seule fois** à la création.

2. **Scoping Strict des Jetons** :
   - **Restriction par domaine** : Vérification du header `Origin` et `Referer`.
   - **Restriction par adresse IP** : Blocage immédiat des requêtes hors subnet autorisé.
   - **Restriction par méthode HTTP** : Droit de lecture seule (`GET`) pour les clients Web GIS.
   - **Quota journalier** : Blocage automatique avec statut HTTP `429 Too Many Requests` en cas de dépassement.

3. **Protection contre le Brute Force & SSRF** :
   - Middleware de rate-limiting dynamique via Redis (fenêtre glissante).
   - Validation stricte des coordonnées `z/x/y` (expressions régulières numériques) pour empêcher toute injection d'URL ou traversée de répertoire.

---

## 3. Déploiement Production avec `docker-compose.production.yml`

1. Placez votre certificat SSL/TLS valide (Let's Encrypt / Certbot).
2. Lancez le cluster durci :
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```
3. Les conteneurs PostgreSQL et Redis sont placés dans un réseau interne isolé (`carto-internal-backend`) sans aucun port exposé sur l'hôte, interdisant tout accès externe direct.
