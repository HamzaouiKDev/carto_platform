import { cacheService } from '../config/redis.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { geocodeService } from './geocodeService.js';

/**
 * Format meters into human-readable distance (m / km)
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format seconds into human-readable duration (min / h min)
 */
function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours} h ${remainingMins} min` : `${hours} h`;
}

/**
 * Translate OSRM step maneuver to natural French instructions
 */
function translateManeuver(step, stepIndex, totalSteps) {
  const maneuver = step.maneuver || {};
  const type = maneuver.type || 'continue';
  const modifier = maneuver.modifier || '';
  const roadName = step.name && step.name.trim().length > 0 ? step.name.trim() : 'voie sans nom';

  if (stepIndex === 0) {
    return `Départ sur ${roadName}`;
  }
  if (stepIndex === totalSteps - 1 || type === 'arrive') {
    return `Vous êtes arrivé à votre destination (${roadName})`;
  }

  const modifierMap = {
    'straight': 'tout droit',
    'slight right': 'légèrement à droite',
    'right': 'à droite',
    'sharp right': 'franchement à droite',
    'slight left': 'légèrement à gauche',
    'left': 'à gauche',
    'sharp left': 'franchement à gauche',
    'uturn': 'demi-tour'
  };

  const modFr = modifierMap[modifier] || modifier;

  switch (type) {
    case 'turn':
      return `Tournez ${modFr} sur ${roadName}`;
    case 'new name':
      return `Continuez sur ${roadName}`;
    case 'depart':
      return `Partez vers le nord sur ${roadName}`;
    case 'arrive':
      return `Arrivée à destination sur ${roadName}`;
    case 'merge':
      return `Rejoignez la circulation sur ${roadName}`;
    case 'on ramp':
      return `Prenez la bretelle d'accès vers ${roadName}`;
    case 'off ramp':
      return `Prenez la sortie vers ${roadName}`;
    case 'fork':
      return `À l'embranchement, serrez ${modFr} vers ${roadName}`;
    case 'end of road':
      return `Au bout de la route, tournez ${modFr} sur ${roadName}`;
    case 'continue':
      return `Continuez ${modFr} sur ${roadName}`;
    case 'roundabout':
    case 'rotary':
      const exit = maneuver.exit ? `${maneuver.exit}e` : 'première';
      return `Au rond-point, prenez la ${exit} sortie sur ${roadName}`;
    default:
      return `Continuez sur ${roadName}`;
  }
}

/**
 * Determine icon type for frontend rendering
 */
function getManeuverIcon(maneuver) {
  const type = maneuver?.type || 'continue';
  const modifier = maneuver?.modifier || '';

  if (type === 'arrive') return 'flag';
  if (type === 'roundabout' || type === 'rotary') return 'rotate-cw';
  if (type === 'uturn' || modifier === 'uturn') return 'corner-down-left';
  if (modifier.includes('right')) return 'corner-up-right';
  if (modifier.includes('left')) return 'corner-up-left';
  return 'arrow-up';
}

export const routingService = {
  /**
   * Parse origin/destination into [lon, lat]
   */
  async resolveCoordinates(input, defaultLabel = 'Point') {
    if (Array.isArray(input) && input.length === 2) {
      const [lon, lat] = input.map(Number);
      if (!isNaN(lon) && !isNaN(lat)) {
        return { lon, lat, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
      }
    }

    if (typeof input === 'object' && input !== null) {
      const lat = Number(input.lat ?? input.latitude);
      const lon = Number(input.lon ?? input.lng ?? input.longitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        return { lon, lat, label: input.label || `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
      }
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      // Check if "lat,lon" or "lon,lat"
      const parts = trimmed.split(',').map(s => Number(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // Distinguish [lat, lon] vs [lon, lat]: In Tunisia lat is ~30-38, lon is ~7-12
        let lat, lon;
        if (parts[0] > 20 && parts[0] < 45 && parts[1] > 0 && parts[1] < 20) {
          lat = parts[0];
          lon = parts[1];
        } else {
          lon = parts[0];
          lat = parts[1];
        }
        return { lon, lat, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
      }

      // Address string -> Geocode with internal Nominatim proxy
      const geocoded = await geocodeService.geocode(trimmed, 1, 'tn');
      if (geocoded.results && geocoded.results.length > 0) {
        const top = geocoded.results[0];
        return {
          lon: top.lon,
          lat: top.lat,
          label: top.displayName.split(',').slice(0, 2).join(',')
        };
      }
    }

    throw new Error(`Impossible de résoudre les coordonnées pour : "${input}"`);
  },

  /**
   * Calculate Multi-modal route (Car, Pedestrian, Bicycle)
   */
  async calculateRoute({
    start,
    end,
    mode = 'car',
    steps = true,
    alternatives = false,
  }) {
    // 1. Normalize Mode
    const normalizedMode = mode.toLowerCase();
    let serviceUrl = config.routing.carUrl;
    let modeKey = 'car';
    let modeTitle = 'Voiture';

    if (normalizedMode === 'foot' || normalizedMode === 'pedestrian' || normalizedMode === 'walk') {
      serviceUrl = config.routing.footUrl;
      modeKey = 'foot';
      modeTitle = 'Piéton';
    } else if (normalizedMode === 'bike' || normalizedMode === 'bicycle' || normalizedMode === 'velo') {
      serviceUrl = config.routing.bikeUrl;
      modeKey = 'bike';
      modeTitle = 'Vélo';
    }

    // 2. Resolve Start & End coordinates
    const startPt = await this.resolveCoordinates(start, 'Départ');
    const endPt = await this.resolveCoordinates(end, 'Arrivée');

    // 3. Round coordinates for Cache Key (~10m precision)
    const rLon1 = startPt.lon.toFixed(4);
    const rLat1 = startPt.lat.toFixed(4);
    const rLon2 = endPt.lon.toFixed(4);
    const rLat2 = endPt.lat.toFixed(4);

    const cacheKey = `route:${modeKey}:${rLon1},${rLat1}:${rLon2},${rLat2}:${steps ? 1 : 0}`;

    // Check Redis Cache
    const cached = await cacheService.getJSON(cacheKey);
    if (cached) {
      return { ...cached, isCacheHit: true };
    }

    // 4. Build OSRM Query URL: {lon1},{lat1};{lon2},{lat2}
    const coordsStr = `${startPt.lon},${startPt.lat};${endPt.lon},${endPt.lat}`;
    const url = new URL(`${serviceUrl}/${coordsStr}`);
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('steps', steps ? 'true' : 'false');
    url.searchParams.set('alternatives', alternatives ? 'true' : 'false');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.routing.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': config.providers.osm.userAgent },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Moteur d'itinéraire (${modeTitle}) indisponible (HTTP ${response.status})`);
      }

      const raw = await response.json();
      if (raw.code !== 'Ok' || !raw.routes || raw.routes.length === 0) {
        throw new Error(`Aucun itinéraire ${modeTitle.toLowerCase()} praticable trouvé entre ces deux points`);
      }

      const primaryRoute = raw.routes[0];
      const leg = primaryRoute.legs?.[0] || {};
      const rawSteps = leg.steps || [];

      // 5. Structure Step-by-Step Instructions
      const totalStepsCount = rawSteps.length;
      const parsedSteps = rawSteps.map((s, idx) => {
        const instruction = translateManeuver(s, idx, totalStepsCount);
        const icon = getManeuverIcon(s.maneuver);
        return {
          stepIndex: idx + 1,
          instruction,
          roadName: s.name || '',
          distanceMeters: Math.round(s.distance),
          distanceFormatted: formatDistance(s.distance),
          durationSeconds: Math.round(s.duration),
          durationFormatted: formatDuration(s.duration),
          icon,
          maneuverType: s.maneuver?.type || 'continue',
          maneuverModifier: s.maneuver?.modifier || '',
          location: s.maneuver?.location || [0, 0], // [lon, lat]
        };
      });

      // Bounding box computation from GeoJSON coordinates
      const coords = primaryRoute.geometry?.coordinates || [];
      let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
      coords.forEach(([cLon, cLat]) => {
        if (cLon < minLon) minLon = cLon;
        if (cLon > maxLon) maxLon = cLon;
        if (cLat < minLat) minLat = cLat;
        if (cLat > maxLat) maxLat = cLat;
      });

      const formattedResult = {
        mode: modeKey,
        modeTitle,
        distanceMeters: Math.round(primaryRoute.distance),
        distanceFormatted: formatDistance(primaryRoute.distance),
        durationSeconds: Math.round(primaryRoute.duration),
        durationFormatted: formatDuration(primaryRoute.duration),
        summary: primaryRoute.summary || `${startPt.label} ➔ ${endPt.label}`,
        geometry: primaryRoute.geometry, // GeoJSON LineString
        bbox: coords.length > 0 ? [minLon, minLat, maxLon, maxLat] : null,
        waypoints: {
          start: {
            name: raw.waypoints?.[0]?.name || startPt.label,
            location: raw.waypoints?.[0]?.location || [startPt.lon, startPt.lat],
          },
          destination: {
            name: raw.waypoints?.[1]?.name || endPt.label,
            location: raw.waypoints?.[1]?.location || [endPt.lon, endPt.lat],
          },
        },
        stepsCount: parsedSteps.length,
        steps: parsedSteps,
        createdAt: new Date().toISOString(),
      };

      // 6. Cache route in Redis for 7 days
      await cacheService.setJSON(cacheKey, formattedResult, config.routing.cacheTtlSeconds);

      logger.info('Route calculated successfully', {
        mode: modeKey,
        distance: formattedResult.distanceFormatted,
        duration: formattedResult.durationFormatted,
      });

      return { ...formattedResult, isCacheHit: false };
    } catch (err) {
      clearTimeout(timeout);
      logger.error('Routing service error', {
        mode,
        error: err.message,
      });
      throw err;
    }
  },
};
