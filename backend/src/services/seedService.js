import { providerService } from './providerService.js';
import { cacheService } from '../config/redis.js';
import { dbPool } from '../config/database.js';
import { logger } from '../config/logger.js';

// Bounding Box Tunisie par défaut
const DEFAULT_BBOX = {
  minLon: 7.52,
  minLat: 30.24,
  maxLon: 11.60,
  maxLat: 37.56,
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

function generateTileList(bbox, minZ, maxZ) {
  const list = [];
  for (let z = minZ; z <= maxZ; z++) {
    const minX = lon2tile(bbox.minLon, z);
    const maxX = lon2tile(bbox.maxLon, z);
    const minY = lat2tile(bbox.maxLat, z);
    const maxY = lat2tile(bbox.minLat, z);

    for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
      for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
        list.push({ z, x, y });
      }
    }
  }
  return list;
}

// In-memory runtime state for live downloading
class SeedEngine {
  constructor() {
    this.activeTask = {
      running: false,
      paused: false,
      provider: null,
      minZoom: 6,
      maxZoom: 12,
      totalTiles: 0,
      downloaded: 0,
      cacheHits: 0,
      errors: 0,
      currentZoom: null,
      speedTilesPerSec: 0,
      startTime: null,
    };

    // State per provider
    this.layersState = {
      'esri-imagery': { downloaded: 0, totalTiles: 25206, percent: 0, status: 'idle' },
      'esri-streets': { downloaded: 0, totalTiles: 25206, percent: 0, status: 'idle' },
      'esri-topo': { downloaded: 0, totalTiles: 25206, percent: 0, status: 'idle' },
      'osm-standard': { downloaded: 0, totalTiles: 25206, percent: 0, status: 'idle' },
    };

    this.queue = [];
    this.workersCount = 6;
    this.stopRequested = false;
  }

  async initFromDb() {
    try {
      // Create seed_state table if not exists for persistence
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS carto_seed_state (
          provider_id VARCHAR(64) PRIMARY KEY,
          downloaded INT NOT NULL DEFAULT 0,
          total_tiles INT NOT NULL DEFAULT 0,
          percent NUMERIC(5,2) NOT NULL DEFAULT 0,
          status VARCHAR(20) NOT NULL DEFAULT 'idle',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const res = await dbPool.query('SELECT * FROM carto_seed_state');
      for (const row of res.rows) {
        this.layersState[row.provider_id] = {
          downloaded: parseInt(row.downloaded, 10),
          totalTiles: parseInt(row.total_tiles, 10),
          percent: parseFloat(row.percent),
          status: row.status,
        };
      }
    } catch (e) {
      logger.warn('Could not load seed state from DB, using defaults', { error: e.message });
    }
  }

  async persistState(providerId) {
    const s = this.layersState[providerId];
    if (!s) return;
    try {
      await dbPool.query(`
        INSERT INTO carto_seed_state (provider_id, downloaded, total_tiles, percent, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (provider_id) DO UPDATE SET
          downloaded = EXCLUDED.downloaded,
          total_tiles = EXCLUDED.total_tiles,
          percent = EXCLUDED.percent,
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [providerId, s.downloaded, s.totalTiles, s.percent, s.status]);
    } catch (e) {
      // non-blocking
    }
  }

  getStatus() {
    return {
      activeTask: this.activeTask,
      layersState: this.layersState,
      timestamp: new Date().toISOString(),
    };
  }

  async startSeed({ provider = 'esri-imagery', minZoom = 6, maxZoom = 12, overwrite = false }) {
    if (this.activeTask.running && !this.activeTask.paused) {
      throw new Error(`Un téléchargement est déjà en cours pour ${this.activeTask.provider}`);
    }

    this.stopRequested = false;

    // If resuming the same provider while paused
    if (this.activeTask.paused && this.activeTask.provider === provider && this.queue.length > 0) {
      this.activeTask.running = true;
      this.activeTask.paused = false;
      this.layersState[provider].status = 'running';
      this.runWorkers();
      return this.getStatus();
    }

    // Generate new queue
    this.queue = generateTileList(DEFAULT_BBOX, minZoom, maxZoom);
    const total = this.queue.length;

    this.activeTask = {
      running: true,
      paused: false,
      provider,
      minZoom,
      maxZoom,
      totalTiles: total,
      downloaded: 0,
      cacheHits: 0,
      errors: 0,
      currentZoom: minZoom,
      speedTilesPerSec: 0,
      startTime: Date.now(),
    };

    this.layersState[provider] = {
      downloaded: 0,
      totalTiles: total,
      percent: 0,
      status: 'running',
    };

    logger.info(`Starting tile download for ${provider} (Zoom ${minZoom}-${maxZoom}, ${total} tiles)`);
    this.runWorkers();
    return this.getStatus();
  }

  pauseSeed() {
    if (!this.activeTask.running) return this.getStatus();
    this.activeTask.running = false;
    this.activeTask.paused = true;
    if (this.activeTask.provider && this.layersState[this.activeTask.provider]) {
      this.layersState[this.activeTask.provider].status = 'paused';
      this.persistState(this.activeTask.provider);
    }
    logger.info(`Tile downloading paused for ${this.activeTask.provider}`);
    return this.getStatus();
  }

  stopSeed() {
    this.stopRequested = true;
    this.queue = [];
    const prov = this.activeTask.provider;
    this.activeTask.running = false;
    this.activeTask.paused = false;

    if (prov && this.layersState[prov]) {
      this.layersState[prov].status = this.layersState[prov].percent >= 100 ? 'completed' : 'idle';
      this.persistState(prov);
    }
    logger.info('Tile downloading stopped');
    return this.getStatus();
  }

  async purgeCache(provider) {
    if (this.activeTask.running && this.activeTask.provider === provider) {
      this.stopSeed();
    }
    await cacheService.del(`tile:${provider}:*`);
    this.layersState[provider] = {
      downloaded: 0,
      totalTiles: 25206,
      percent: 0,
      status: 'idle',
    };
    await this.persistState(provider);
    logger.info(`Cache purged for provider: ${provider}`);
    return this.getStatus();
  }

  async runWorkers() {
    const prov = this.activeTask.provider;
    let lastTime = Date.now();
    let lastDownloaded = this.activeTask.downloaded;

    const worker = async () => {
      while (this.queue.length > 0 && this.activeTask.running && !this.stopRequested) {
        const item = this.queue.shift();
        this.activeTask.currentZoom = item.z;

        try {
          // Fetch tile through providerService (caches in Redis)
          const tile = await providerService.getTile(prov, item.z, item.x, item.y);
          this.activeTask.downloaded++;
          if (tile.isCacheHit) {
            this.activeTask.cacheHits++;
          }
        } catch (err) {
          this.activeTask.errors++;
        }

        // Periodic stats calculation
        const now = Date.now();
        if (now - lastTime >= 1000) {
          const delta = this.activeTask.downloaded - lastDownloaded;
          this.activeTask.speedTilesPerSec = Math.round(delta / ((now - lastTime) / 1000));
          lastTime = now;
          lastDownloaded = this.activeTask.downloaded;

          // Update layer percent
          const percent = parseFloat(((this.activeTask.downloaded / Math.max(1, this.activeTask.totalTiles)) * 100).toFixed(1));
          this.layersState[prov].downloaded = this.activeTask.downloaded;
          this.layersState[prov].percent = percent;
          this.persistState(prov);
        }

        // Modest throttle to prevent network saturation (15ms delay)
        await new Promise(r => setTimeout(r, 15));
      }
    };

    const pool = Array.from({ length: this.workersCount }, () => worker());
    await Promise.all(pool);

    if (this.queue.length === 0 && !this.stopRequested) {
      this.activeTask.running = false;
      this.activeTask.paused = false;
      this.layersState[prov].status = 'completed';
      this.layersState[prov].downloaded = this.activeTask.downloaded;
      this.layersState[prov].percent = 100;
      this.persistState(prov);
      logger.info(`Downloading 100% completed for ${prov}!`);
    }
  }
}

export const seedEngine = new SeedEngine();
seedEngine.initFromDb();
