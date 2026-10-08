# 📚 Guide d'Intégration & SDK Développeur (CartoPlatform)

Ce guide technique explique comment intégrer les services de votre serveur cartographique souverain (**tuiles cartographiques, calcul d'itinéraires voiture & piéton, géocodage et recherche**) dans vos applications web, mobiles ou logiciels SIG de bureau.

---

## 🔑 1. Authentification & Clés d'API

Toutes les requêtes de vos applications clientes peuvent s'authentifier de deux manières équivalentes :

### Méthode A : Paramètre d'URL (Recommandé pour Leaflet, QGIS & Tuiles XYZ)
```text
http://localhost:8085/api/tiles/esri-imagery/{z}/{x}/{y}.png?key=VOTRE_CLE_API
```

### Méthode B : En-tête HTTP (Recommandé pour requêtes API JSON, Symfony, Mobile)
```http
x-api-key: VOTRE_CLE_API
```

> **Exemple de clé valide pour les tests :**
> `cpt_live_W01Qz6EkU3_yUWpevm_pYFYIGREC8rLk`

---

## 🌿 2. Intégration Web avec Leaflet.js

Leaflet est la bibliothèque cartographique recommandée pour le web, légère (40 Ko) et compatible avec tous les frameworks.

### Code complet prêt à l'emploi :
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Carte Interactive Souveraine</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    #map { width: 100%; height: 600px; border-radius: 8px; }
  </style>
</head>
<body>

<div id="map"></div>

<script>
  const SERVER_URL = 'http://localhost:8085';
  const API_KEY = 'cpt_live_W01Qz6EkU3_yUWpevm_pYFYIGREC8rLk';

  // 1. Initialisation de la carte
  const map = L.map('map', {
    center: [36.8065, 10.1815], // Tunis
    zoom: 12,
    minZoom: 5,
    maxZoom: 18,
    maxNativeZoom: 18, // Bloque proprement à la résolution max disponible
    bounceAtZoomLimits: true
  });

  // 2. Ajout du fond de carte Satellite Esri HD souverain
  L.tileLayer(`${SERVER_URL}/api/tiles/esri-imagery/{z}/{x}/{y}.png?key=${API_KEY}`, {
    attribution: '&copy; CartoPlatform &copy; Esri',
    maxZoom: 18,
    maxNativeZoom: 18,
    keepBuffer: 6
  }).addTo(map);

  // 3. Fonction pour tracer un itinéraire (Voiture ou Piéton)
  async function tracerItineraire(depart, arrivee, mode = 'car') {
    const url = `${SERVER_URL}/api/routing/route?start=${depart}&end=${arrivee}&mode=${mode}&key=${API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.geometry) {
        // Tracé GeoJSON
        const routeLine = L.geoJSON(data.geometry, {
          style: {
            color: mode === 'foot' ? '#10B981' : '#06B6D4',
            weight: 6,
            opacity: 0.85
          }
        }).addTo(map);

        map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

        console.log(`Itinéraire ${data.modeTitle} : ${data.distanceFormatted} en ${data.durationFormatted}`);
      }
    } catch (err) {
      console.error('Erreur itinéraire :', err);
    }
  }

  // Exemple : Itinéraire Tunis ➔ Carthage
  tracerItineraire('10.1815,36.8065', '10.3217,36.8529', 'car');
</script>
</body>
</html>
```

---

## 🐘 3. Intégration Symfony / PHP (`app_emploi`)

### A. Service Symfony (`src/Service/CartoPlatformService.php`)
```php
<?php
namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;

class CartoPlatformService
{
    private string $baseUrl;
    private string $apiKey;
    private HttpClientInterface $httpClient;

    public function __construct(
        HttpClientInterface $httpClient,
        string $baseUrl = 'http://localhost:8085',
        string $apiKey = 'cpt_live_W01Qz6EkU3_yUWpevm_pYFYIGREC8rLk'
    ) {
        $this->httpClient = $httpClient;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
    }

    /**
     * Calcul d'itinéraire pour tournée d'enquêteurs
     * @param string $mode 'car' (Voiture) ou 'foot' (Piéton)
     */
    public function getItineraire(float $latDep, float $lonDep, float $latArr, float $lonArr, string $mode = 'car'): array
    {
        $response = $this->httpClient->request('GET', "{$this->baseUrl}/api/routing/route", [
            'query' => [
                'start' => "{$lonDep},{$latDep}",
                'end'   => "{$lonArr},{$latArr}",
                'mode'  => $mode,
                'steps' => 'true'
            ],
            'headers' => [
                'x-api-key' => $this->apiKey
            ]
        ]);

        return $response->toArray();
    }

    /**
     * URL de tuiles cartographiques pour Twig / Leaflet
     */
    public function getTileUrl(string $provider = 'esri-imagery'): string
    {
        return "{$this->baseUrl}/api/tiles/{$provider}/{z}/{x}/{y}.png?key={$this->apiKey}";
    }
}
```

### B. Affichage dans un template Twig (`templates/agent/household/map.html.twig`)
```html
<div id="household-map" style="height: 500px; width: 100%;"></div>

<script>
  const map = L.map('household-map').setView([{{ household.latitude }}, {{ household.longitude }}], 14);

  L.tileLayer('http://localhost:8085/api/tiles/esri-imagery/{z}/{x}/{y}.png?key=cpt_live_W01Qz6EkU3_yUWpevm_pYFYIGREC8rLk', {
    maxZoom: 18,
    maxNativeZoom: 18
  }).addTo(map);

  L.marker([{{ household.latitude }}, {{ household.longitude }}])
    .addTo(map)
    .bindPopup('<b>Ménage #{{ household.code }}</b><br>{{ household.address }}')
    .openPopup();
</script>
```

---

## 🗺️ 4. Intégration dans QGIS (Logiciel SIG Desktop)

Pour afficher vos fonds de carte souverains directement dans QGIS :

1. Dans QGIS, ouvrez le panneau **Explorateur** (*Browser*) à gauche.
2. Faites un clic droit sur **Tuiles XYZ** (*XYZ Tiles*) ➔ **Nouvelle connexion...**.
3. Remplissez les paramètres :
   * **Nom :** `CartoPlatform - Esri Satellite HD`
   * **URL :** `http://localhost:8085/api/tiles/esri-imagery/{z}/{x}/{y}.png?key=cpt_live_W01Qz6EkU3_yUWpevm_pYFYIGREC8rLk`
   * **Zoom Min :** `0`
   * **Zoom Max :** `18`
4. Validez en cliquant sur **OK**. La couche est immédiatement disponible et superposable avec vos shapefiles et données cadastrales !

---

## 📱 5. Applications Mobiles & Tablettes CAPI (Terrain / Hors-Ligne)

Pour les applications tablettes (Flutter, Android CAPI, React Native) :

* **Mode En Ligne** : Les requêtes chargent les tuiles directement depuis le serveur via Wi-Fi/4G.
* **Mode 100% Hors-Ligne** : 
  1. Pré-téléchargez les cartes via l'onglet **« Téléchargement Hors-Ligne »** du dashboard ([http://localhost:8085](http://localhost:8085)).
  2. Les tuiles sont stockées dans le cache du serveur local ou synchronisées en local sur la tablette avant le départ sur le terrain.

### Exemple Flutter (flutter_map) :
```dart
TileLayer(
  urlTemplate: 'http://localhost:8085/api/tiles/esri-imagery/{z}/{x}/{y}.png?key=cpt_live_W01Qz6EkU3_yUWpevm_pYFYIGREC8rLk',
  userAgentPackageName: 'tn.ins.capi.app',
  maxNativeZoom: 18,
)
```

---

## 💻 6. Référence des Endpoints REST

### 1. Obtenir une Tuile Cartographique
```http
GET /api/tiles/{provider}/{z}/{x}/{y}.png?key={API_KEY}
```
* **Providers disponibles :**
  * `esri-imagery` (Satellite HD Esri, MaxZoom 18)
  * `esri-streets` (Plan Urbain Esri, MaxZoom 19)
  * `esri-topo` (Relief Topographique Esri, MaxZoom 19)
  * `osm-standard` (OpenStreetMap, MaxZoom 19)

### 2. Calculer un Itinéraire Multi-Modal
```http
GET /api/routing/route?start={lon,lat}&end={lon,lat}&mode={car|foot|bike}&steps=true&key={API_KEY}
```
* **Paramètres :**
  * `start` : Coordonnées de départ `lon,lat` ou nom de ville/rue (ex: `Tunis`).
  * `end` : Coordonnées d'arrivée `lon,lat` ou nom de lieu (ex: `Carthage`).
  * `mode` :
    * `car` : Voiture (itinéraires rapides, autoroutes, sens uniques).
    * `foot` : Piéton (trottoirs, allées piétonnes, chemins de terre).
    * `bike` : Vélo (voies apaisées, pistes cyclables).
  * `steps` : `true` pour inclure la feuille de route pas-à-pas en français.

### 3. Recherche d'Adresse (Géocodage Direct)
```http
GET /api/geocode?q={Recherche}&limit=5
```
* **Retour :** Liste d'objets avec `displayName`, `lat`, `lon` et bounding box.

### 4. Géocodage Inversé (Coordonnées ➔ Adresse)
```http
GET /api/reverse-geocode?lat={latitude}&lon={longitude}
```

---

## 📊 7. Codes de Réponse HTTP

| Code | Statut | Signification |
| :--- | :--- | :--- |
| **`200 OK`** | Succès | Données retournées. L'en-tête `X-Cache: HIT` signale une réponse immédiate depuis Redis (< 5 ms). |
| **`304 Not Modified`** | Cache ETag | La tuile est déjà en cache chez le client (0 octet transféré). |
| **`401 Unauthorized`** | Non Authentifié | Clé d'API absente ou invalide. |
| **`403 Forbidden`** | Accès Refusé | Clé révoquée, domaine non autorisé ou méthode HTTP interdite. |
| **`429 Too Many Requests`** | Quota Dépassé | Limite de débit atteinte. L'en-tête `X-RateLimit-Reset` indique l'expiration. |
| **`502 Bad Gateway`** | Upstream Erreur | Le fournisseur distant est inaccessible. Le circuit-breaker protège le système. |
