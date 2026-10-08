/**
 * CARTO PLATFORM ENTERPRISE — SCRIPT DE PRÉ-TÉLÉCHARGEMENT (SEEDING) DES TUILES
 * 
 * Permet de pré-remplir le cache Redis et/ou d'enregistrer les tuiles localement
 * pour un fonctionnement 100% hors-ligne (ex: tablettes CAPI sur le terrain).
 */

import http from 'http';

// Bounding Box Tunisie par défaut
const DEFAULT_BBOX = {
  minLon: 7.52,
  minLat: 30.24,
  maxLon: 11.60,
  maxLat: 37.56,
};

// Arguments CLI
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v;
  return acc;
}, {});

const PROVIDER = args.provider || 'esri-imagery'; // esri-imagery, esri-streets, esri-topo, osm-standard
const MIN_ZOOM = parseInt(args.minZoom || '6', 10);
const MAX_ZOOM = parseInt(args.maxZoom || '11', 10); // 11 = bon compromis taille/détail, 13 = urbain fin
const CONCURRENCY = parseInt(args.concurrency || '8', 10);
const API_URL = args.apiUrl || 'http://localhost:4000/api';

/**
 * Conversion coordonnées GPS (WGS84) vers coordonnées de tuile (Web Mercator)
 */
function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

/**
 * Calcul de la liste exhaustive des tuiles à télécharger
 */
function generateTileQueue(bbox, minZ, maxZ) {
  const queue = [];
  for (let z = minZ; z <= maxZ; z++) {
    const minX = lon2tile(bbox.minLon, z);
    const maxX = lon2tile(bbox.maxLon, z);
    const minY = lat2tile(bbox.maxLat, z); // En Web Mercator Y pointe vers le sud
    const maxY = lat2tile(bbox.minLat, z);

    for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
      for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
        queue.push({ z, x, y });
      }
    }
  }
  return queue;
}

/**
 * Téléchargement d'une tuile individuelle via l'API Gateway (remplit le cache Redis)
 */
async function fetchTile(tile) {
  const url = `${API_URL}/tiles/${PROVIDER}/${tile.z}/${tile.x}/${tile.y}.png`;
  try {
    const res = await fetch(url);
    if (!res.ok && res.status !== 304) {
      throw new Error(`HTTP ${res.status}`);
    }
    const isHit = res.headers.get('x-cache') === 'HIT' || res.status === 304;
    return { success: true, isHit };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Worker Pool asynchrone pour cadence maîtrisée
 */
async function runSeeder() {
  console.log('================================================================');
  console.log(' CARTO PLATFORM — PRÉ-TÉLÉCHARGEMENT DES TUILES CARTOGRAPHIQUES');
  console.log('================================================================');
  console.log(`Fournisseur cible : ${PROVIDER}`);
  console.log(`Niveaux de Zoom   : ${MIN_ZOOM} à ${MAX_ZOOM}`);
  console.log(`Bounding Box      : [Lon: ${DEFAULT_BBOX.minLon} -> ${DEFAULT_BBOX.maxLon}, Lat: ${DEFAULT_BBOX.minLat} -> ${DEFAULT_BBOX.maxLat}]`);

  const queue = generateTileQueue(DEFAULT_BBOX, MIN_ZOOM, MAX_ZOOM);
  const total = queue.length;
  console.log(`Total de tuiles à traiter : ${total.toLocaleString()}`);
  console.log('----------------------------------------------------------------');

  let completed = 0;
  let cacheHits = 0;
  let errors = 0;
  const startTime = Date.now();

  async function worker() {
    while (queue.length > 0) {
      const tile = queue.shift();
      const res = await fetchTile(tile);

      completed++;
      if (res.success) {
        if (res.isHit) cacheHits++;
      } else {
        errors++;
      }

      if (completed % 50 === 0 || completed === total) {
        const percent = ((completed / total) * 100).toFixed(1);
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = (completed / Math.max(1, elapsedSec)).toFixed(1);
        process.stdout.write(
          `\r[${percent}%] ${completed}/${total} tuiles | Hits Redis: ${cacheHits} | Erreurs: ${errors} | Vitesse: ${rate} t/s `
        );
      }
    }
  }

  // Lancement des workers en parallèle
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n================================================================');
  console.log(`✅ Téléchargement terminé en ${durationSec}s !`);
  console.log(`   - Tuiles traitées : ${completed}`);
  console.log(`   - Déjà en cache   : ${cacheHits}`);
  console.log(`   - Nouvelles tuiles: ${completed - cacheHits}`);
  console.log(`   - Échecs          : ${errors}`);
  console.log('Toutes ces tuiles sont désormais stockées en cache ultra-rapide.');
  console.log('================================================================');
}

runSeeder().catch(err => {
  console.error('\n❌ Erreur fatale seeder:', err);
  process.exit(1);
});
