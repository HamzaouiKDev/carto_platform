/**
 * ==============================================================================
 *  INS SIG TEST APP — IndexedDB Database Layer (CartoMenagesDB)
 *  100% Autonome, sans blocage, avec sauvegarde immédiate et fallback mémoire
 * ==============================================================================
 */

(function (window) {
  'use strict';

  const DB_NAME = 'CartoMenagesDB_Standalone_v3';
  const DB_VERSION = 1;
  let dbInstance = null;

  const DEFAULT_API_KEY = 'cpt_live_NZnhGQVnBhdjc_xBjF4lWcz6LLa9t4ze';
  const DEFAULT_API_URL = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
    ? `${window.location.origin}/api`
    : 'http://172.31.5.111:8085/api';

  // Noms et prénoms tunisiens pour la génération aléatoire
  const PRENOMS = ['Mohamed', 'Kais', 'Amira', 'Fatma', 'Sami', 'Hassan', 'Leila', 'Noureddine', 'Sonia', 'Moncef', 'Ines', 'Habib', 'Rim', 'Zouhair', 'Salma', 'Tarek', 'Mounira', 'Wissem', 'Samia', 'Walid', 'Henda', 'Anis', 'Yassine', 'Meryem'];
  const NOMS = ['Trabelsi', 'Ben Youssef', 'Gharbi', 'Bouazizi', 'Mansouri', 'Chaabane', 'Riahi', 'Dridi', 'Jaziri', 'Khemiri', 'Cherif', 'Hammami', 'Chebbi', 'Marzouki', 'Bellagha', 'Ayari', 'Ben Amor', 'Zouari', 'Sassi', 'Belhadj'];
  const STATUTS = ['recense', 'a_revisiter', 'absent', 'refus'];
  const LOGEMENTS = ['Appartement', 'Villa', 'Maison traditionnelle', 'Studio', 'Duplex'];
  const REVENUS = ['< 800 DT', '800 - 1500 DT', '1500 - 3000 DT', '> 3000 DT'];

  const POI_TYPES = [
    { type: 'bureau_ins', label: 'Bureau Recensement INS', icon: '🏛️', color: '#0284c7' },
    { type: 'hopital', label: 'Centre de Santé / Hôpital', icon: '🏥', color: '#ef4444' },
    { type: 'ecole', label: 'Établissement Scolaire', icon: '🏫', color: '#f59e0b' },
    { type: 'mosquee', label: 'Mosquée / Repère', icon: '🕌', color: '#10b981' },
    { type: 'mairie', label: 'Municipalité / Délégation', icon: '🏢', color: '#8b5cf6' }
  ];

  // Données de secours en mémoire si IndexedDB est bloqué ou inaccessible
  let memoryFallbackPoints = [];
  let memoryFallbackConfig = {
    api_key: DEFAULT_API_KEY,
    api_base_url: DEFAULT_API_URL,
    basemap_choice: 'satellite'
  };

  const CartoDB = {
    /**
     * Initialise la base IndexedDB avec timeout de sécurité
     */
    init: function () {
      if (dbInstance) return Promise.resolve(dbInstance);

      return new Promise((resolve) => {
        // Sécurité : si IndexedDB prend plus de 2s, on résout quand même pour ne JAMAIS bloquer la carte !
        const safetyTimer = setTimeout(() => {
          console.warn('[CartoDB] Timeout initialisation IndexedDB, utilisation fallback');
          resolve(null);
        }, 2000);

        try {
          if (!window.indexedDB) {
            clearTimeout(safetyTimer);
            return resolve(null);
          }

          const req = indexedDB.open(DB_NAME, DB_VERSION);

          req.onupgradeneeded = function (e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('points')) {
              db.createObjectStore('points', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('config')) {
              db.createObjectStore('config', { keyPath: 'key' });
            }
          };

          req.onsuccess = function (e) {
            clearTimeout(safetyTimer);
            dbInstance = e.target.result;

            // Vérifier les données existantes
            CartoDB.countPoints().then((cnt) => {
              if (cnt === 0) {
                CartoDB.generateRandomPoints(30, true).then(() => resolve(dbInstance));
              } else {
                resolve(dbInstance);
              }
            }).catch(() => resolve(dbInstance));
          };

          req.onerror = function (e) {
            clearTimeout(safetyTimer);
            console.error('[CartoDB] Erreur ouverture IndexedDB:', e);
            resolve(null);
          };
        } catch (err) {
          clearTimeout(safetyTimer);
          console.error('[CartoDB] Exception IndexedDB:', err);
          resolve(null);
        }
      });
    },

    countPoints: function () {
      return new Promise((resolve) => {
        if (!dbInstance) return resolve(memoryFallbackPoints.length);
        try {
          const tx = dbInstance.transaction('points', 'readonly');
          const req = tx.objectStore('points').count();
          req.onsuccess = () => resolve(req.result || 0);
          req.onerror = () => resolve(memoryFallbackPoints.length);
        } catch (e) {
          resolve(memoryFallbackPoints.length);
        }
      });
    },

    getAllPoints: function () {
      return new Promise((resolve) => {
        if (!dbInstance) return resolve(memoryFallbackPoints);
        try {
          const tx = dbInstance.transaction('points', 'readonly');
          const req = tx.objectStore('points').getAll();
          req.onsuccess = () => {
            const items = req.result || [];
            if (items.length > 0) {
              memoryFallbackPoints = items;
              resolve(items);
            } else {
              resolve(memoryFallbackPoints);
            }
          };
          req.onerror = () => resolve(memoryFallbackPoints);
        } catch (e) {
          resolve(memoryFallbackPoints);
        }
      });
    },

    addPoint: function (point) {
      return new Promise((resolve) => {
        const item = {
          ...point,
          id: point.id || Date.now() + Math.floor(Math.random() * 1000),
          created_at: new Date().toISOString()
        };
        memoryFallbackPoints.push(item);

        if (!dbInstance) return resolve(item);
        try {
          const tx = dbInstance.transaction('points', 'readwrite');
          tx.objectStore('points').add(item);
          tx.oncomplete = () => resolve(item);
          tx.onerror = () => resolve(item);
        } catch (e) {
          resolve(item);
        }
      });
    },

    updatePoint: function (point) {
      return new Promise((resolve) => {
        const idx = memoryFallbackPoints.findIndex(p => p.id === point.id);
        if (idx !== -1) memoryFallbackPoints[idx] = { ...point };

        if (!dbInstance) return resolve(point);
        try {
          const tx = dbInstance.transaction('points', 'readwrite');
          tx.objectStore('points').put(point);
          tx.oncomplete = () => resolve(point);
          tx.onerror = () => resolve(point);
        } catch (e) {
          resolve(point);
        }
      });
    },

    deletePoint: function (id) {
      return new Promise((resolve) => {
        memoryFallbackPoints = memoryFallbackPoints.filter(p => p.id !== id);
        if (!dbInstance) return resolve(true);
        try {
          const tx = dbInstance.transaction('points', 'readwrite');
          tx.objectStore('points').delete(Number(id));
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(true);
        } catch (e) {
          resolve(true);
        }
      });
    },

    clearAllPoints: function () {
      return new Promise((resolve) => {
        memoryFallbackPoints = [];
        if (!dbInstance) return resolve(true);
        try {
          const tx = dbInstance.transaction('points', 'readwrite');
          tx.objectStore('points').clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(true);
        } catch (e) {
          resolve(true);
        }
      });
    },

    getConfig: function (key, defaultVal) {
      return new Promise((resolve) => {
        if (!dbInstance) return resolve(memoryFallbackConfig[key] || defaultVal);
        try {
          const tx = dbInstance.transaction('config', 'readonly');
          const req = tx.objectStore('config').get(key);
          req.onsuccess = () => resolve(req.result ? req.result.value : defaultVal);
          req.onerror = () => resolve(defaultVal);
        } catch (e) {
          resolve(defaultVal);
        }
      });
    },

    setConfig: function (key, value) {
      memoryFallbackConfig[key] = value;
      return new Promise((resolve) => {
        if (!dbInstance) return resolve(true);
        try {
          const tx = dbInstance.transaction('config', 'readwrite');
          tx.objectStore('config').put({ key, value });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(true);
        } catch (e) {
          resolve(true);
        }
      });
    },

    /**
     * Génère N points aléatoires (Ménages & POIs)
     */
    generateRandomPoints: function (count = 25, resetFirst = false, bounds = null) {
      return new Promise((resolve) => {
        if (resetFirst) {
          memoryFallbackPoints = [];
        }

        let minLat = 36.76, maxLat = 36.87;
        let minLng = 10.13, maxLng = 10.31;

        if (bounds && typeof bounds.getSouth === 'function') {
          minLat = bounds.getSouth();
          maxLat = bounds.getNorth();
          minLng = bounds.getWest();
          maxLng = bounds.getEast();
        }

        const generated = [];
        const timestamp = Date.now().toString().slice(-4);

        for (let i = 0; i < count; i++) {
          const isPOI = Math.random() < 0.22; // 22% de POIs utiles, 78% de ménages
          const lat = +(minLat + Math.random() * (maxLat - minLat)).toFixed(6);
          const lng = +(minLng + Math.random() * (maxLng - minLng)).toFixed(6);

          if (isPOI) {
            const poiMeta = POI_TYPES[Math.floor(Math.random() * POI_TYPES.length)];
            const poiNumber = Math.floor(1 + Math.random() * 20);
            generated.push({
              id: Date.now() + i,
              type: 'poi',
              poi_type: poiMeta.type,
              nom: `${poiMeta.label} n°${poiNumber}`,
              icon: poiMeta.icon,
              color: poiMeta.color,
              lat: lat,
              lng: lng,
              adresse: `Secteur ${Math.floor(1 + Math.random() * 15)}, Grand Tunis`,
              circle_radius: 13,
              circle_color: poiMeta.color,
              circle_opacity: 0.95
            });
          } else {
            const prenom = PRENOMS[Math.floor(Math.random() * PRENOMS.length)];
            const nom = NOMS[Math.floor(Math.random() * NOMS.length)];
            const taille = Math.floor(1 + Math.random() * 7);
            const statut = STATUTS[Math.floor(Math.random() * STATUTS.length)];
            const rev = REVENUS[Math.floor(Math.random() * REVENUS.length)];
            const log = LOGEMENTS[Math.floor(Math.random() * LOGEMENTS.length)];

            let color = '#10B981';
            if (statut === 'a_revisiter') color = '#F59E0B';
            if (statut === 'absent') color = '#3B82F6';
            if (statut === 'refus') color = '#EF4444';

            generated.push({
              id: Date.now() + i,
              type: 'menage',
              code: `MEN-2026-TUN-${timestamp}${i.toString().padStart(2, '0')}`,
              chef_menage: `${prenom} ${nom}`,
              taille: taille,
              statut: statut,
              type_logement: log,
              tranche_revenu: rev,
              adresse: `${Math.floor(1 + Math.random() * 120)} Rue de l'Indépendance`,
              telephone: `+216 71 ${Math.floor(100000 + Math.random() * 900000)}`,
              enqueteur_nom: `Agent INS #${Math.floor(1 + Math.random() * 15)}`,
              observations: statut === 'a_revisiter' ? 'Absent au 1er passage, repasser en soirée.' :
                            statut === 'absent' ? 'Porte fermée, avis de passage laissé.' :
                            statut === 'refus' ? 'Refus initial de coopérer.' : 'Enquête validée avec succès.',
              lat: lat,
              lng: lng,
              circle_radius: 10,
              circle_color: color,
              circle_opacity: 0.85
            });
          }
        }

        memoryFallbackPoints = resetFirst ? generated : [...memoryFallbackPoints, ...generated];

        if (!dbInstance) {
          return resolve(generated);
        }

        try {
          const tx = dbInstance.transaction('points', 'readwrite');
          const store = tx.objectStore('points');
          if (resetFirst) store.clear();
          for (const item of generated) {
            store.add(item);
          }
          tx.oncomplete = () => resolve(generated);
          tx.onerror = () => resolve(generated);
        } catch (e) {
          resolve(generated);
        }
      });
    }
  };

  window.CartoDB = CartoDB;
})(window);
