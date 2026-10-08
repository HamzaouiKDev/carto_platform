import { seedEngine } from '../services/seedService.js';

export const seedController = {
  /**
   * GET /api/seed/status
   */
  getStatus(req, res) {
    return res.json(seedEngine.getStatus());
  },

  /**
   * POST /api/seed/start
   */
  async startSeed(req, res) {
    const { provider = 'esri-imagery', minZoom = 6, maxZoom = 11, overwrite = false } = req.body;
    try {
      const state = await seedEngine.startSeed({
        provider,
        minZoom: parseInt(minZoom, 10),
        maxZoom: parseInt(maxZoom, 10),
        overwrite,
      });
      return res.json({ message: 'Téléchargement démarré', state });
    } catch (err) {
      return res.status(400).json({ error: 'SeedError', message: err.message });
    }
  },

  /**
   * POST /api/seed/pause
   */
  pauseSeed(req, res) {
    const state = seedEngine.pauseSeed();
    return res.json({ message: 'Téléchargement mis en pause', state });
  },

  /**
   * POST /api/seed/stop
   */
  stopSeed(req, res) {
    const state = seedEngine.stopSeed();
    return res.json({ message: 'Téléchargement arrêté', state });
  },

  /**
   * POST /api/seed/purge
   */
  async purgeCache(req, res) {
    const { provider } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'BadRequest', message: 'provider is required' });
    }
    const state = await seedEngine.purgeCache(provider);
    return res.json({ message: `Cache purgé pour ${provider}`, state });
  }
};
