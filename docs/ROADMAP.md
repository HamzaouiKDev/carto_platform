# Feuille de Route & Évolutions Futures — CartoPlatform

Ce document présente les améliorations architecturales recommandées pour accompagner la montée en charge à l'échelle nationale et internationale.

---

## 1. Intégration du Format PMTiles (Protomaps)
* **Description** : PMTiles est un format d'archive cartographique sans serveur (Serverless) permettant de stocker l'intégralité d'un pays ou du monde en un seul fichier (ex: `tunisia.pmtiles`).
* **Avantages** :
  - Zéro base de données nécessaire pour servir les tuiles de fond.
  - Requêtes par plages d'octets HTTP (`Range requests`) directes depuis un bucket S3/MinIO.
  - Coût d'hébergement divisé par 10 et performances maximales.

## 2. Support Natif des Cloud-Optimized GeoTIFF (COG) avec TiTiler
* **Description** : Déploiement d'un micro-service dédié (ex: TiTiler basé sur FastAPI et GDAL/Rasterio) pour le traitement à la volée d'orthophotos et d'images satellites multi-spectrales internes (Sentinel-2, Pléiades, drones).
* **Avantages** : Découpage, rééchantillonnage et reprojection en temps réel sans duplication de stockage.

## 3. Générateur de Tuiles Vectorielles PostGIS MVT (pg_tileserv / Martin)
* **Description** : Intégration d'un serveur de tuiles vectorielles écrit en Rust (`Martin`) ou Go (`pg_tileserv`) connecté directement à PostGIS via `ST_AsMVT()`.
* **Impact** : Rendu vectoriel ultra-fluide dans MapLibre GL JS avec filtrage dynamique et changement de style instantané côté client (sans re-télécharger d'images).

## 4. Déploiement Kubernetes (K8s) & Auto-Scaling HPA
* **Description** : Création de Helm charts pour Kubernetes avec Horizontal Pod Autoscaler (HPA).
* **Déclencheur d'échelle** : Métrique Prometheus `carto_http_request_duration_seconds` (p95 > 250ms) ou utilisation CPU > 70%.

## 5. Rendu 3D Terrain & Bâtiments
* **Description** : Intégration des données MNT (Modèle Numérique de Terrain) en format Terrain-RGB / Terrarium pour extrusion 3D des bâtiments et ombrage de relief réaliste dans le Studio Carto.
