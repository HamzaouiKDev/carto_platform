// scripts/precache_sector.mjs
// Pré-télécharge les tuiles de la zone test de Tunis (Zoom 11 à 16) dans Redis
import http from 'http';

const API_KEY = 'cpt_live_JNkRURbRup63LRSkuEr9AhpSaPqnJDjD';
const PROVIDERS = ['esri-imagery', 'esri-streets'];

// BBox Grand Tunis (Zone des ménages tests)
const BBOX = {
  minLon: 10.12,
  maxLon: 10.24,
  minLat: 36.78,
  maxLat: 36.86
};

function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

function fetchTile(provider, z, x, y) {
  return new Promise((resolve) => {
    const url = `http://localhost/api/tiles/${provider}/${z}/${x}/${y}?key=${API_KEY}`;
    http.get(url, (res) => {
      res.resume(); // Consomme les données pour libérer le socket
      resolve(res.statusCode === 200 || res.statusCode === 304);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function main() {
  console.log('🚀 Démarrage du pré-chargement local (Seeding) pour Grand Tunis (Zoom 11 -> 16)...');
  
  let totalSuccess = 0;
  let totalCount = 0;

  for (const provider of PROVIDERS) {
    console.log(`\n📦 Pré-chargement pour le fond : ${provider}`);
    for (let z = 11; z <= 16; z++) {
      const minX = lon2tile(BBOX.minLon, z);
      const maxX = lon2tile(BBOX.maxLon, z);
      const minY = lat2tile(BBOX.maxLat, z);
      const maxY = lat2tile(BBOX.minLat, z);

      const tiles = [];
      for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
        for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
          tiles.push({ z, x, y });
        }
      }

      process.stdout.write(`  Zoom ${z} (${tiles.length} tuiles) : `);
      let zSuccess = 0;

      // Par batchs de 6 requêtes en parallèle
      const BATCH_SIZE = 6;
      for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
        const batch = tiles.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(t => fetchTile(provider, t.z, t.x, t.y)));
        zSuccess += results.filter(Boolean).length;
      }

      totalSuccess += zSuccess;
      totalCount += tiles.length;
      console.log(`✅ ${zSuccess}/${tiles.length} en cache`);
    }
  }

  console.log(`\n🎉 Terminé ! ${totalSuccess}/${totalCount} tuiles stockées en cache local.`);
  console.log('Vous pouvez maintenant couper Internet et zoomer librement jusqu\'au niveau 16+ sans aucun écran noir !');
}

main().catch(console.error);
