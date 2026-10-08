// scripts/seed_all_tunisia.mjs
// Orchestrateur de téléchargement cartographique exhaustif pour toute la Tunisie
// Stockage permanent dans Redis (TTL=0) pour un fonctionnement 100% hors-ligne

import http from 'http';

const PROVIDERS = [
  { id: 'esri-imagery', name: 'Esri Satellite HD', minZoom: 6, maxZoom: 12 },
  { id: 'esri-streets', name: 'Esri World Street Map', minZoom: 6, maxZoom: 12 },
  { id: 'esri-topo',    name: 'Esri Relief Topo',     minZoom: 6, maxZoom: 12 },
  { id: 'osm-standard', name: 'OpenStreetMap Standard', minZoom: 6, maxZoom: 11 }, // z11 for OSM to respect usage limits
];

// Zones Urbaines Haute Résolution (Zoom 13 -> 16)
const HIGH_RES_ZONES = [
  {
    name: 'Grand Tunis (Tunis, Ariana, Ben Arous, Manouba)',
    bbox: { minLon: 10.05, maxLon: 10.35, minLat: 36.70, maxLat: 36.92 },
    minZoom: 13,
    maxZoom: 16,
    providers: ['esri-imagery', 'esri-streets']
  },
  {
    name: 'Sousse & Sahel',
    bbox: { minLon: 10.55, maxLon: 10.68, minLat: 35.78, maxLat: 35.88 },
    minZoom: 13,
    maxZoom: 15,
    providers: ['esri-imagery', 'esri-streets']
  },
  {
    name: 'Sfax Agglomération',
    bbox: { minLon: 10.70, maxLon: 10.82, minLat: 34.70, maxLat: 34.78 },
    minZoom: 13,
    maxZoom: 15,
    providers: ['esri-imagery', 'esri-streets']
  }
];

const API_KEY = 'cpt_live_JNkRURbRup63LRSkuEr9AhpSaPqnJDjD';

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body, status: res.statusCode });
        }
      });
    }).on('error', reject);
  });
}

function fetchTile(provider, z, x, y) {
  return new Promise((resolve) => {
    const url = `http://localhost/api/tiles/${provider}/${z}/${x}/${y}?key=${API_KEY}`;
    http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200 || res.statusCode === 304);
    }).on('error', () => {
      resolve(false);
    });
  });
}

function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runNationalSeed() {
  console.log('================================================================');
  console.log('🇹🇳 TÉLÉCHARGEMENT INTÉGRAL DE TOUTE LA TUNISIE (HORS-LIGNE 100%)');
  console.log('================================================================');
  console.log('Phase 1 : Couverture Nationale Totale (Zoom 6 à 12)');

  for (const prov of PROVIDERS) {
    console.log(`\n▶ Lancement téléchargement : ${prov.name} [${prov.id}] (Zoom ${prov.minZoom} -> ${prov.maxZoom})...`);
    
    try {
      const startRes = await postJson('http://localhost/api/seed/start', {
        provider: prov.id,
        minZoom: prov.minZoom,
        maxZoom: prov.maxZoom,
      });

      if (startRes.error) {
        console.warn(`  ⚠️ Réponse API : ${startRes.message}`);
      }

      // Polling de la progression
      let completed = false;
      while (!completed) {
        await sleep(1500);
        const status = await getJson('http://localhost/api/seed/status');
        const task = status.activeTask;
        const layer = status.layersState ? status.layersState[prov.id] : null;

        if (task && task.provider === prov.id && task.running) {
          const pct = ((task.downloaded / Math.max(1, task.totalTiles)) * 100).toFixed(1);
          const speed = task.speedTilesPerSec || 0;
          process.stdout.write(`\r  ⏳ [${prov.id}] Zoom ${task.currentZoom} | ${task.downloaded.toLocaleString()} / ${task.totalTiles.toLocaleString()} (${pct}%) | Vitesse: ${speed} tuiles/s   `);
        } else if (!task.running) {
          completed = true;
          const total = layer ? layer.downloaded : (task ? task.downloaded : 0);
          console.log(`\r  ✅ [${prov.id}] Terminé avec succès ! Total : ${total.toLocaleString()} tuiles en cache permanent.       `);
        }
      }
    } catch (err) {
      console.error(`  ❌ Erreur sur ${prov.id}:`, err.message);
    }
  }
}

async function runHighResSectors() {
  console.log('\n================================================================');
  console.log('Phase 2 : Secteurs Urbains et d\'Enquête à Haute Résolution (Zoom 13 -> 16)');
  console.log('================================================================');

  for (const zone of HIGH_RES_ZONES) {
    console.log(`\n📍 Zone : ${zone.name}`);
    for (const prov of zone.providers) {
      console.log(`  📦 Fournisseur : ${prov}`);
      for (let z = zone.minZoom; z <= zone.maxZoom; z++) {
        const minX = lon2tile(zone.bbox.minLon, z);
        const maxX = lon2tile(zone.bbox.maxLon, z);
        const minY = lat2tile(zone.bbox.maxLat, z);
        const maxY = lat2tile(zone.bbox.minLat, z);

        const tiles = [];
        for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
          for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
            tiles.push({ z, x, y });
          }
        }

        process.stdout.write(`    Zoom ${z} (${tiles.length} tuiles) : `);
        let count = 0;
        const BATCH_SIZE = 8;
        for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
          const batch = tiles.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(batch.map(t => fetchTile(prov, t.z, t.x, t.y)));
          count += results.filter(Boolean).length;
        }
        console.log(`✅ ${count}/${tiles.length} enregistrées`);
      }
    }
  }
}

async function main() {
  const startTime = Date.now();
  await runNationalSeed();
  await runHighResSectors();
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n================================================================');
  console.log(`🎉 OPÉRATION TERMINÉE EN ${elapsed} MINUTES !`);
  console.log('Toutes les cartes de la Tunisie sont à présent stockées à 100% en local.');
  console.log('================================================================\n');
}

main().catch(console.error);
