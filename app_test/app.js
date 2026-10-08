/**
 * ==============================================================================
 *  INS SIG TEST APP — Logique Principale (app.js)
 *  100% Autonome, Robuste, sans dépendance externe bloquante
 * ==============================================================================
 */

(function () {
  'use strict';

  // Variables globales
  let map = null;
  let currentTileLayer = null;
  let currentBasemapType = 'satellite';
  let markersLayerGroup = null;
  let routeLayerGroup = null;
  let routeStartMarker = null;
  let routeEndMarker = null;

  let allPoints = [];
  let selectedPoint = null;

  // Position et état de l'Enquêteur Terrain (INS Agent)
  let surveyorCoords = {
    lat: 36.8188,
    lng: 10.1650,
    label: '🚶‍♂️ Enquêteur Terrain INS'
  };
  let surveyorMarker = null;

  // État de l'itinéraire
  let routeStartCoords = null; // { lat, lng, label }
  let routeEndCoords = null;   // { lat, lng, label }
  let routeMode = 'car';       // 'car' | 'foot' | 'bike'
  let pickingMode = null;      // 'start' | 'end' | 'add_point'

  const API_KEY = 'cpt_live_NZnhGQVnBhdjc_xBjF4lWcz6LLa9t4ze';
  // Détection automatique de l'adresse du serveur Carto (si ouvert via HTTP ou double-clic fichier local)
  const API_BASE_URL = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
    ? `${window.location.origin}/api`
    : 'http://172.31.5.111:8085/api';

  // Bureau INS Central (Point de référence de secours)
  const INS_CENTRAL = {
    lat: 36.8000,
    lng: 10.1800,
    label: 'Direction Générale INS (Tunis Centre)'
  };

  // ── 1. DEFINITION DES FONDS DE CARTE (100% SERVEUR LOCAL PLATEFORME) ─────
  const BASEMAPS = {
    plan: {
      name: 'Plan des Rues (Serveur Local)',
      url: `${API_BASE_URL}/tiles/esri-streets/{z}/{x}/{y}?key=${API_KEY}`,
      attribution: '&copy; Carto Platform Locale — Plan Rues',
      maxZoom: 19,
      maxNativeZoom: 19
    },
    satellite: {
      name: 'Satellite HD (Serveur Local)',
      url: `${API_BASE_URL}/tiles/esri-imagery/{z}/{x}/{y}?key=${API_KEY}`,
      attribution: '&copy; Carto Platform Locale — Satellite HD',
      maxZoom: 19,
      maxNativeZoom: 19
    },
    topo: {
      name: 'Relief / Topo (Serveur Local)',
      url: `${API_BASE_URL}/tiles/esri-topo/{z}/{x}/{y}?key=${API_KEY}`,
      attribution: '&copy; Carto Platform Locale — Topographie',
      maxZoom: 18,
      maxNativeZoom: 18
    },
    osm: {
      name: 'OSM Standard (Serveur Local)',
      url: `${API_BASE_URL}/tiles/osm-standard/{z}/{x}/{y}?key=${API_KEY}`,
      attribution: '&copy; Carto Platform Locale — OpenStreetMap',
      maxZoom: 19,
      maxNativeZoom: 19
    }
  };

  // ── 2. INITIALISATION PRINCIPALE ──────────────────────────────────────────
  function initApp() {
    // 1. Initialiser la carte IMMÉDIATEMENT (ne rien attendre !)
    initMap();

    // 2. Créer le marqueur de l'enquêteur terrain
    createOrUpdateSurveyorMarker();

    // 3. Attacher les écouteurs d'événements immédiatement
    setupEventListeners();

    // 4. Définir le point A par défaut sur la position de l'enquêteur
    setRouteStart(surveyorCoords.lat, surveyorCoords.lng, surveyorCoords.label);

    // 5. Charger ou initialiser la base de données de manière asynchrone sans bloquer l'interface
    if (window.CartoDB) {
      window.CartoDB.init().then(() => {
        window.CartoDB.getConfig('basemap_choice', 'satellite').then((saved) => {
          if (saved && saved !== currentBasemapType) switchBasemap(saved);
        });
        refreshPoints();
      }).catch((err) => {
        console.warn('Erreur init DB, utilisation secours:', err);
        refreshPoints();
      });
    } else {
      refreshPoints();
    }
  }

  // ── 3. CARTE LEAFLET ───────────────────────────────────────────────────────
  function initMap() {
    if (map) return;

    if (typeof L === 'undefined') {
      alert('Erreur: La bibliothèque Leaflet n\'a pas pu être chargée. Vérifiez votre connexion.');
      return;
    }

    map = L.map('map', {
      center: [36.8188, 10.1800],
      zoom: 12,
      zoomControl: false
    });

    // Contrôles de zoom haute visibilité (+ et -) positionnés sous le sélecteur
    L.control.zoom({ position: 'topright' }).addTo(map);

    markersLayerGroup = L.layerGroup().addTo(map);
    routeLayerGroup = L.layerGroup().addTo(map);

    // Appliquer le fond plan local par défaut immédiatement
    switchBasemap('plan');

    // Clic sur la carte
    map.on('click', function (e) {
      if (pickingMode === 'start') {
        setRouteStart(e.latlng.lat, e.latlng.lng, `GPS (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`);
        setPickingMode(null);
        showToast('Point de départ (A) défini', 'info');
      } else if (pickingMode === 'end') {
        setRouteEnd(e.latlng.lat, e.latlng.lng, `GPS (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`);
        setPickingMode(null);
        showToast('Point d\'arrivée (B) défini', 'info');
      } else if (pickingMode === 'add_point') {
        openAddPointPrompt(e.latlng.lat, e.latlng.lng);
        setPickingMode(null);
      } else {
        closeOptionsFlyout();
      }
    });

    // Suivi coordonnées curseur en direct (WGS-84)
    map.on('mousemove', function (e) {
      const el = document.getElementById('bar-cursor-coords');
      if (el) {
        el.textContent = `${e.latlng.lat.toFixed(6)}° N, ${e.latlng.lng.toFixed(6)}° E`;
      }
    });
  }

  // ── 3.1 GESTION DU MARQUEUR DE L'ENQUÊTEUR TERRAIN & GPS ────────────────────
  let surveyorAccuracyCircle = null;

  function updateSurveyorCoordsDisplay() {
    const el = document.getElementById('bar-surveyor-coords');
    if (el) {
      el.textContent = `${surveyorCoords.lat.toFixed(6)}° N, ${surveyorCoords.lng.toFixed(6)}° E`;
    }
  }

  function getSurveyorPopupHtml() {
    return `
      <div class="popup-household-box">
        <div class="popup-title">
          <span>🚶‍♂️</span> <strong>${escapeHtml(surveyorCoords.label || 'Enquêteur Terrain INS')}</strong>
        </div>
        <div class="popup-meta">
          <div><strong>Statut :</strong> Agent INS en mission terrain</div>
          <div style="color: #38bdf8; font-family: monospace; font-size: 0.74rem; margin-top: 3px;">
            📍 <strong>Latitude :</strong> ${surveyorCoords.lat.toFixed(6)}° N<br/>
            📍 <strong>Longitude :</strong> ${surveyorCoords.lng.toFixed(6)}° E
          </div>
          ${surveyorCoords.accuracy ? `<div style="color: #34d399; font-size: 0.72rem; margin-top: 2px;">🎯 Précision capteur GPS : ±${surveyorCoords.accuracy} m</div>` : ''}
          <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">
            Système : WGS-84 (EPSG:4326) · Glissez l'icône pour simuler un déplacement
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
          <button class="popup-btn popup-btn-calc" onclick="window.CartoApp.locateWithGPS()">
            📍 Ré-acquérir position GPS réelle
          </button>
          <button class="popup-btn" style="background: rgba(255,255,255,0.1); color:#fff;" onclick="window.CartoApp.copySurveyorGPS()">
            📋 Copier coordonnées GPS
          </button>
        </div>
      </div>
    `;
  }

  function createOrUpdateSurveyorMarker() {
    if (!map) return;
    updateSurveyorCoordsDisplay();

    if (surveyorMarker) {
      surveyorMarker.setLatLng([surveyorCoords.lat, surveyorCoords.lng]);
      surveyorMarker.setPopupContent(getSurveyorPopupHtml());
      return;
    }

    const surveyorIcon = L.divIcon({
      className: 'surveyor-marker-icon',
      html: `
        <div class="surveyor-pulse-container" title="Enquêteur Terrain (Glissez pour déplacer)">
          <div class="surveyor-pulse-ring"></div>
          <div class="surveyor-badge">
            <span class="surveyor-emoji">🚶‍♂️</span>
            <span class="surveyor-tag">Agent</span>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    surveyorMarker = L.marker([surveyorCoords.lat, surveyorCoords.lng], {
      icon: surveyorIcon,
      draggable: true,
      zIndexOffset: 1200
    }).addTo(map);

    surveyorMarker.bindTooltip(`
      <div style="font-size: 0.8rem; font-family: inherit; text-align: center;">
        <strong style="color: #34d399;">🚶‍♂️ Enquêteur Terrain INS</strong><br/>
        <span style="color: #38bdf8; font-family: monospace; font-size: 0.72rem;">${surveyorCoords.lat.toFixed(6)}, ${surveyorCoords.lng.toFixed(6)}</span><br/>
        <span style="color: #94a3b8; font-size: 0.7rem;">(Glissez pour déplacer votre position)</span>
      </div>
    `, { direction: 'top', offset: [0, -18] });

    surveyorMarker.bindPopup(getSurveyorPopupHtml(), { offset: [0, -20] });

    surveyorMarker.on('dragend', function (e) {
      const pos = e.target.getLatLng();
      surveyorCoords.lat = +pos.lat.toFixed(6);
      surveyorCoords.lng = +pos.lng.toFixed(6);
      surveyorCoords.label = '🚶‍♂️ Enquêteur Terrain INS';
      delete surveyorCoords.accuracy;

      if (surveyorAccuracyCircle) {
        map.removeLayer(surveyorAccuracyCircle);
        surveyorAccuracyCircle = null;
      }

      surveyorMarker.setPopupContent(getSurveyorPopupHtml());
      surveyorMarker.setTooltipContent(`
        <div style="font-size: 0.8rem; font-family: inherit; text-align: center;">
          <strong style="color: #34d399;">🚶‍♂️ Enquêteur Terrain INS</strong><br/>
          <span style="color: #38bdf8; font-family: monospace; font-size: 0.72rem;">${surveyorCoords.lat.toFixed(6)}, ${surveyorCoords.lng.toFixed(6)}</span><br/>
          <span style="color: #94a3b8; font-size: 0.7rem;">(Glissez pour déplacer votre position)</span>
        </div>
      `);

      updateSurveyorCoordsDisplay();

      // Si le point de départ correspond à l'enquêteur, le mettre à jour automatiquement
      if (!routeStartCoords || routeStartCoords.label.includes('Enquêteur') || routeStartCoords.label.includes('GPS')) {
        setRouteStart(surveyorCoords.lat, surveyorCoords.lng, '🚶‍♂️ Enquêteur Terrain INS');
      }

      updateFlyoutSurveyorDistance();
      renderMarkers();
      showToast(`Position enquêteur : ${surveyorCoords.lat.toFixed(6)}, ${surveyorCoords.lng.toFixed(6)}`, 'info');
    });

    surveyorMarker.on('click', function (e) {
      surveyorMarker.setPopupContent(getSurveyorPopupHtml());
    });
  }

  function centerOnSurveyor() {
    if (!map || !surveyorCoords) return;
    map.flyTo([surveyorCoords.lat, surveyorCoords.lng], 15, { duration: 0.6 });
    if (surveyorMarker) {
      surveyorMarker.openTooltip();
    }
    showToast('Centré sur l\'enquêteur terrain INS', 'info');
  }

  function locateWithGPS() {
    const btn = document.getElementById('btn-gps-locate');
    if (!navigator.geolocation) {
      showToast('La géolocalisation n\'est pas supportée par ce navigateur', 'error');
      return;
    }

    if (btn) {
      btn.classList.add('btn-gps-active');
      btn.innerHTML = '<span>⏳</span> <span>Recherche GPS...</span>';
    }
    showToast('Recherche du signal GPS haute précision...', 'info');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = +pos.coords.latitude.toFixed(6);
        const lng = +pos.coords.longitude.toFixed(6);
        const acc = Math.round(pos.coords.accuracy || 10);

        surveyorCoords.lat = lat;
        surveyorCoords.lng = lng;
        surveyorCoords.accuracy = acc;
        surveyorCoords.label = '📍 Position GPS Réelle';

        if (surveyorMarker) {
          surveyorMarker.setLatLng([lat, lng]);
          surveyorMarker.setPopupContent(getSurveyorPopupHtml());
          surveyorMarker.setTooltipContent(`
            <div style="font-size: 0.8rem; font-family: inherit; text-align: center;">
              <strong style="color: #34d399;">📍 Position GPS Réelle</strong><br/>
              <span style="color: #38bdf8; font-family: monospace; font-size: 0.72rem;">${lat.toFixed(6)}, ${lng.toFixed(6)} (±${acc}m)</span>
            </div>
          `);
        }

        // Cercle de précision GPS
        if (surveyorAccuracyCircle) {
          map.removeLayer(surveyorAccuracyCircle);
        }
        surveyorAccuracyCircle = L.circle([lat, lng], {
          radius: acc,
          color: '#06b6d4',
          fillColor: '#38bdf8',
          fillOpacity: 0.15,
          weight: 1.5,
          dashArray: '4,4'
        }).addTo(map);

        surveyorAccuracyCircle.bindTooltip(`Précision GPS réelle : ±${acc} m`, { direction: 'bottom' });

        map.flyTo([lat, lng], 16, { duration: 0.8 });

        if (surveyorMarker) {
          surveyorMarker.openPopup();
        }

        if (!routeStartCoords || routeStartCoords.label.includes('Enquêteur') || routeStartCoords.label.includes('GPS')) {
          setRouteStart(lat, lng, '📍 Position GPS Réelle');
        }

        updateSurveyorCoordsDisplay();
        updateFlyoutSurveyorDistance();
        renderMarkers();

        if (btn) {
          btn.classList.remove('btn-gps-active');
          btn.innerHTML = '<span>📍</span> <span>GPS Fixé (±' + acc + 'm)</span>';
          btn.style.background = '#059669';
        }

        showToast(`✅ GPS fixé avec succès : ${lat.toFixed(6)}, ${lng.toFixed(6)} (précision ±${acc}m)`, 'success');
      },
      (err) => {
        if (btn) {
          btn.classList.remove('btn-gps-active');
          btn.innerHTML = '<span>📍</span> <span>Position GPS</span>';
        }
        let msg = 'Impossible d\'obtenir la position GPS';
        if (err.code === 1) msg = 'Accès GPS refusé par le navigateur ou l\'utilisateur';
        else if (err.code === 2) msg = 'Signal GPS indisponible sur cet appareil';
        else if (err.code === 3) msg = 'Délai d\'attente GPS dépassé (timeout)';
        showToast(msg, 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  }

  function copySurveyorGPS() {
    const text = `${surveyorCoords.lat.toFixed(6)}, ${surveyorCoords.lng.toFixed(6)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`Coordonnées GPS copiées : ${text}`, 'success');
      }).catch(() => {
        prompt('Coordonnées GPS (WGS-84) :', text);
      });
    } else {
      prompt('Coordonnées GPS (WGS-84) :', text);
    }
  }

  function switchBasemap(type) {
    if (!BASEMAPS[type]) type = 'satellite';
    currentBasemapType = type;

    if (currentTileLayer) {
      map.removeLayer(currentTileLayer);
    }

    const cfg = BASEMAPS[type];
    currentTileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom || 19,
      maxNativeZoom: cfg.maxNativeZoom || 13, // Utilise le niveau natif disponible en cache hors-ligne
      keepBuffer: 10,    // Maintient les tuiles précédentes en mémoire pour une navigation fluide hors-ligne
      subdomains: 'abcd'
    });

    currentTileLayer.on('tileerror', function () {
      // Évite les alertes intempestives quand l'utilisateur navigue hors-ligne sur une zone non pré-chargée
    });

    currentTileLayer.addTo(map);

    // Mémoriser dans IndexedDB
    if (window.CartoDB) {
      window.CartoDB.setConfig('basemap_choice', type);
    }

    document.querySelectorAll('.basemap-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.basemap === type);
    });

    showToast(`Fond de carte : ${cfg.name}`, 'info');
  }

  // ── 4. POINTS DE MENAGES & POIS (CERCLES DYNAMIQUES) ──────────────────────
  async function refreshPoints() {
    if (window.CartoDB) {
      allPoints = await window.CartoDB.getAllPoints();
    }
    if (!allPoints || allPoints.length === 0) {
      // Générer automatiquement si vide
      if (window.CartoDB) {
        allPoints = await window.CartoDB.generateRandomPoints(30, true);
      }
    }
    renderMarkers();
    updateCounts();
  }

  function updateCounts() {
    const menages = allPoints.filter(p => p.type === 'menage');
    const pois = allPoints.filter(p => p.type === 'poi');
    const recense = menages.filter(m => m.statut === 'recense').length;
    const aRevisiter = menages.filter(m => m.statut === 'a_revisiter').length;

    const elTotal = document.getElementById('legend-total-val');
    const elRecense = document.getElementById('legend-recense-val');
    const elRevisiter = document.getElementById('legend-revisiter-val');
    const elPoi = document.getElementById('legend-poi-val');

    if (elTotal) elTotal.textContent = allPoints.length;
    if (elRecense) elRecense.textContent = recense;
    if (elRevisiter) elRevisiter.textContent = aRevisiter;
    if (elPoi) elPoi.textContent = pois.length;
  }

  function getFormattedDistance(lat1, lon1, lat2, lon2) {
    const dKm = getHaversineDistanceKm(lat1, lon1, lat2, lon2);
    if (dKm < 1) {
      return `${Math.round(dKm * 1000)} m`;
    }
    return `${dKm.toFixed(2)} km`;
  }

  function updateFlyoutSurveyorDistance() {
    if (!selectedPoint) return;
    const distEl = document.getElementById('flyout-dist-val');
    if (!distEl) return;
    
    const dKm = getHaversineDistanceKm(surveyorCoords.lat, surveyorCoords.lng, selectedPoint.lat, selectedPoint.lng);
    if (dKm < 1) {
      distEl.textContent = `${Math.round(dKm * 1000)} m (~${Math.max(1, Math.ceil((dKm * 1000) / 75))} min à pied)`;
    } else {
      distEl.textContent = `${dKm.toFixed(2)} km (~${Math.max(1, Math.ceil(dKm * 2))} min en voiture)`;
    }
  }

  function renderMarkers() {
    if (!markersLayerGroup) return;
    markersLayerGroup.clearLayers();

    allPoints.forEach((point) => {
      if (point.type === 'poi') {
        const poiMarker = L.circleMarker([point.lat, point.lng], {
          radius: 12, // Grandeur uniforme pour les POIs
          fillColor: point.color || '#0284c7',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.95
        });

        poiMarker.bindTooltip(`
          <div style="font-size: 0.8rem; font-family: inherit;">
            <strong style="color: #fff;">${point.icon || '📍'} ${escapeHtml(point.nom)}</strong><br/>
            <span style="color: #94a3b8;">${escapeHtml(point.adresse || 'Grand Tunis')}</span>
          </div>
        `, { direction: 'top', offset: [0, -10] });

        // Popup direct attaché au point d'intérêt
        const poiDistStr = getFormattedDistance(surveyorCoords.lat, surveyorCoords.lng, point.lat, point.lng);
        const poiPopupHtml = `
          <div class="popup-household-box">
            <div class="popup-title">
              <span>${point.icon || '📍'}</span> <strong>${escapeHtml(point.nom)}</strong>
            </div>
            <div class="popup-meta">
              <div><strong>Type :</strong> ${escapeHtml(point.poi_type || 'Service')}</div>
              <div><strong>Adresse :</strong> ${escapeHtml(point.adresse || 'Grand Tunis')}</div>
              <div style="color: #38bdf8; font-weight:600; margin-top:3px; font-size:0.78rem;">
                🚶‍♂️ Distance enquêteur : <strong>${poiDistStr}</strong>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
              <button class="popup-btn popup-btn-calc" onclick="window.CartoApp.calcRouteToPoint(${point.id})">
                🧭 Calculer l'itinéraire
              </button>
            </div>
          </div>
        `;
        poiMarker.bindPopup(poiPopupHtml, { maxWidth: 280, offset: [0, -10], closeButton: true });

        poiMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          selectedPoint = point;
          closeOptionsFlyout();
        });

        markersLayerGroup.addLayer(poiMarker);
      } else {
        // Grandeur identique et uniforme pour TOUS les ménages
        const radius = 10;
        const color = getStatusColor(point.statut);
        const opacity = 0.88;

        const circleMarker = L.circleMarker([point.lat, point.lng], {
          radius: radius,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          opacity: 0.95,
          fillOpacity: opacity
        });

        circleMarker.bindTooltip(`
          <div style="font-size: 0.8rem; font-family: inherit;">
            <strong style="color: #fff;">${escapeHtml(point.chef_menage)}</strong><br/>
            <span style="color: #94a3b8;">${point.code}</span> • <span>${point.taille} pers.</span><br/>
            <span style="color: ${color}; font-weight: 600;">● ${formatStatus(point.statut)}</span>
          </div>
        `, { direction: 'top', offset: [0, -radius] });

        // Popup direct attaché au point du ménage (seule rubrique qui s'ouvre)
        const distStr = getFormattedDistance(surveyorCoords.lat, surveyorCoords.lng, point.lat, point.lng);
        const popupHtml = `
          <div class="popup-household-box">
            <div class="popup-title">
              <span>🏠</span> <strong>${escapeHtml(point.chef_menage)}</strong>
            </div>
            <div class="popup-meta">
              <div><strong>Code :</strong> ${point.code} (${point.taille} personnes)</div>
              <div><strong>Statut :</strong> <span style="color:${color}; font-weight:700;">● ${formatStatus(point.statut)}</span></div>
              <div><strong>Logement :</strong> ${escapeHtml(point.type_logement || 'Appartement')}</div>
              <div style="color: #38bdf8; font-family: monospace; font-size: 0.72rem; margin-top: 2px;">
                📍 <strong>GPS :</strong> ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}
              </div>
              <div style="color: #34d399; font-weight:600; margin-top:3px; font-size:0.78rem;">
                🚶‍♂️ Distance enquêteur : <strong>${distStr}</strong>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
              <button class="popup-btn popup-btn-calc" onclick="window.CartoApp.calcRouteToPoint(${point.id})">
                🧭 Calculer l'itinéraire
              </button>
              <button class="popup-btn popup-btn-quest" onclick="window.CartoApp.openQuestionnaireForPoint(${point.id})">
                📋 Ouvrir questionnaire <span class="badge-disabled" style="font-size:0.6rem; padding:1px 6px;">Bientôt</span>
              </button>
            </div>
          </div>
        `;
        circleMarker.bindPopup(popupHtml, { maxWidth: 290, offset: [0, -radius], closeButton: true });

        circleMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          selectedPoint = point;
          closeOptionsFlyout();
        });

        markersLayerGroup.addLayer(circleMarker);
      }
    });
  }

  function getStatusColor(statut) {
    switch (statut) {
      case 'recense': return '#10B981';
      case 'a_revisiter': return '#F59E0B';
      case 'absent': return '#3B82F6';
      case 'refus': return '#EF4444';
      default: return '#94A3B8';
    }
  }

  function formatStatus(statut) {
    switch (statut) {
      case 'recense': return 'Recensé';
      case 'a_revisiter': return 'À revisiter';
      case 'absent': return 'Absent';
      case 'refus': return 'Refus';
      default: return statut;
    }
  }

  // ── 5. OPTIONS AU CLIC SUR UN CERCLE / RUBRIQUE DU MÉNAGE ─────────────────
  function openOptionsFlyout(point) {
    selectedPoint = point;
    map.panTo([point.lat, point.lng], { animate: true, duration: 0.35 });

    const badge = document.getElementById('flyout-badge');
    const title = document.getElementById('flyout-title');
    const meta1 = document.getElementById('flyout-meta-1');
    const meta2 = document.getElementById('flyout-meta-2');
    const meta3 = document.getElementById('flyout-meta-3');
    const meta4 = document.getElementById('flyout-meta-4');

    if (point.type === 'poi') {
      badge.textContent = 'POINT D\'INTÉRÊT / INFRASTRUCTURE';
      badge.style.background = 'rgba(2, 132, 199, 0.25)';
      badge.style.color = '#38bdf8';
      title.textContent = `${point.icon || '📍'} ${point.nom}`;
      meta1.textContent = `Type : ${point.poi_type || 'Service'}`;
      meta2.textContent = `GPS : ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
      meta3.textContent = `Adresse : ${point.adresse || 'Grand Tunis'}`;
      meta4.textContent = `Statut : Opérationnel`;
      document.getElementById('action-change-status').style.display = 'none';
      const questBtn = document.getElementById('action-open-questionnaire');
      if (questBtn) questBtn.style.display = 'none';
    } else {
      badge.textContent = `MÉNAGE — ${point.code}`;
      badge.style.background = 'rgba(16, 185, 129, 0.25)';
      badge.style.color = '#34d399';
      title.textContent = point.chef_menage;
      meta1.textContent = `Taille : ${point.taille} personnes · Statut : ${formatStatus(point.statut)}`;
      meta2.textContent = `GPS : ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
      meta3.textContent = `Logement : ${point.type_logement || 'Non spécifié'} (${point.tranche_revenu || ''})`;
      meta4.textContent = `Adresse : ${point.adresse || 'Grand Tunis'}`;
      document.getElementById('action-change-status').style.display = 'flex';
      const questBtn = document.getElementById('action-open-questionnaire');
      if (questBtn) questBtn.style.display = 'flex';
    }

    updateFlyoutSurveyorDistance();
    document.getElementById('options-flyout').classList.add('open');
  }

  function closeOptionsFlyout() {
    document.getElementById('options-flyout').classList.remove('open');
  }

  // ── 6. CALCULATEUR D'ITINÉRAIRE ───────────────────────────────────────────
  function setRouteStart(lat, lng, label) {
    routeStartCoords = { lat: +lat, lng: +lng, label: label || 'Départ' };
    const inp = document.getElementById('input-start');
    if (inp) inp.value = routeStartCoords.label;

    if (routeStartMarker) {
      routeLayerGroup.removeLayer(routeStartMarker);
      routeStartMarker = null;
    }

    // Si le départ n'est pas la position de l'enquêteur, afficher le marqueur A vert
    const isSurveyor = (Math.abs(lat - surveyorCoords.lat) < 0.0001 && Math.abs(lng - surveyorCoords.lng) < 0.0001);
    if (!isSurveyor) {
      routeStartMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'custom-route-marker',
          html: `<div style="background:#10b981; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; border:2px solid #fff; box-shadow:0 0 10px #10b981; font-family:sans-serif;">A</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).bindTooltip(`🏁 Départ : ${routeStartCoords.label}`).addTo(routeLayerGroup);
    }
  }

  function setRouteEnd(lat, lng, label) {
    routeEndCoords = { lat: +lat, lng: +lng, label: label || 'Arrivée' };
    const inp = document.getElementById('input-end');
    if (inp) inp.value = routeEndCoords.label;

    if (routeEndMarker) {
      routeLayerGroup.removeLayer(routeEndMarker);
      routeEndMarker = null;
    }

    routeEndMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'custom-route-marker',
        html: `<div style="background:#ef4444; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; border:2px solid #fff; box-shadow:0 0 10px #ef4444; font-family:sans-serif;">B</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    }).bindTooltip(`🎯 Arrivée : ${routeEndCoords.label}`).addTo(routeLayerGroup);
  }

  async function calculateRoute() {
    if (!routeStartCoords || !routeEndCoords) {
      showToast('Veuillez définir un point de départ (A) et d\'arrivée (B)', 'error');
      return;
    }

    const calcBtn = document.getElementById('btn-do-calc');
    if (calcBtn) {
      calcBtn.disabled = true;
      calcBtn.innerHTML = '<span>⏳</span> <span>Calcul en cours...</span>';
    }

    const lon1 = routeStartCoords.lng;
    const lat1 = routeStartCoords.lat;
    const lon2 = routeEndCoords.lng;
    const lat2 = routeEndCoords.lat;

    let routeResult = null;

    // Appel EXCLUSIF à l'API de routage OSRM de la plateforme locale
    try {
      const apiUrl = `${API_BASE_URL}/routing/route?start=${lon1},${lat1}&end=${lon2},${lat2}&mode=${routeMode}`;
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'x-api-key': API_KEY }
      });

      if (res.ok) {
        routeResult = await res.json();
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast('Erreur serveur local : ' + (errJson.message || `Code HTTP ${res.status}`), 'error');
      }
    } catch (err) {
      showToast('Serveur local non joignable sur ' + API_BASE_URL + ' : ' + err.message, 'error');
    }

    if (calcBtn) {
      calcBtn.disabled = false;
      calcBtn.innerHTML = '<span>🚀</span> <span>Calculer l\'Itinéraire</span>';
    }

    if (!routeResult || !routeResult.geometry) {
      return;
    }

    displayRouteOnMap(routeResult);
    displayRouteInPanel(routeResult);
  }

  function displayRouteOnMap(route) {
    // Supprimer les anciennes lignes
    routeLayerGroup.eachLayer((layer) => {
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        routeLayerGroup.removeLayer(layer);
      }
    });

    const latlngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

    // Ombre sous le tracé pour contraste sur satellite
    L.polyline(latlngs, {
      color: '#000000',
      weight: 8,
      opacity: 0.6
    }).addTo(routeLayerGroup);

    // Ligne cyan brillante
    const routeLine = L.polyline(latlngs, {
      color: '#06b6d4',
      weight: 5,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(routeLayerGroup);

    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    showToast(`Itinéraire : ${route.distanceFormatted} (${route.durationFormatted})`, 'success');
  }

  function displayRouteInPanel(route) {
    document.getElementById('route-summary-box').style.display = 'flex';
    document.getElementById('route-dist-val').textContent = route.distanceFormatted;
    document.getElementById('route-dur-val').textContent = route.durationFormatted;

    const list = document.getElementById('route-steps-list');
    list.innerHTML = '';

    const steps = route.steps || [];
    if (steps.length === 0) {
      list.innerHTML = `<div style="font-size: 0.78rem; color: var(--text-muted); text-align: center;">Trajet direct affiché sur la carte</div>`;
      return;
    }

    steps.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'route-step-item';
      item.innerHTML = `
        <span class="step-num">${s.stepIndex}</span>
        <div style="flex: 1;">
          <div style="color: #fff; font-weight: 500;">${escapeHtml(s.instruction)}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted);">${s.distanceFormatted} ${s.durationFormatted ? '• ' + s.durationFormatted : ''}</div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  // ── 7. ACTIONS DE LA RUBRIQUE DU MÉNAGE ───────────────────────────────────
  function routeToSelectedPoint() {
    if (!selectedPoint) return;
    
    // Départ = Position actuelle de l'Enquêteur Terrain
    setRouteStart(surveyorCoords.lat, surveyorCoords.lng, '🚶‍♂️ Enquêteur Terrain INS');

    // Arrivée = Point du Ménage sélectionné
    const label = selectedPoint.type === 'menage' ?
      `🏠 Ménage : ${selectedPoint.chef_menage || selectedPoint.code}` :
      `📍 ${selectedPoint.nom || 'Point'}`;

    setRouteEnd(selectedPoint.lat, selectedPoint.lng, label);
    closeOptionsFlyout();
    if (map) map.closePopup();
    calculateRoute();
  }

  function openHouseholdQuestionnaire() {
    if (!selectedPoint) return;
    const nom = selectedPoint.chef_menage || selectedPoint.nom || 'Ménage';
    const code = selectedPoint.code || 'MEN-2026';

    const targetEl = document.getElementById('modal-quest-target');
    if (targetEl) targetEl.textContent = `${code} — ${nom}`;

    const modal = document.getElementById('modal-questionnaire-overlay');
    if (modal) modal.classList.add('active');
  }

  function closeHouseholdQuestionnaire() {
    const modal = document.getElementById('modal-questionnaire-overlay');
    if (modal) modal.classList.remove('active');
  }

  function setAsRouteStartPoint() {
    if (!selectedPoint) return;
    const label = selectedPoint.type === 'menage' ?
      `${selectedPoint.code} (${selectedPoint.chef_menage})` :
      selectedPoint.nom;

    setRouteStart(selectedPoint.lat, selectedPoint.lng, label);
    openItineraryPanel();
    closeOptionsFlyout();
    showToast(`Point A défini : ${label}`, 'info');
  }

  async function changeSelectedStatus() {
    if (!selectedPoint || selectedPoint.type !== 'menage') return;
    const current = selectedPoint.statut;
    const options = ['recense', 'a_revisiter', 'absent', 'refus'];
    const next = options[(options.indexOf(current) + 1) % options.length];

    selectedPoint.statut = next;
    selectedPoint.circle_color = getStatusColor(next);

    if (window.CartoDB) {
      await window.CartoDB.updatePoint(selectedPoint);
    }
    await refreshPoints();

    document.getElementById('flyout-meta-2').textContent = `Statut : ${formatStatus(next)}`;
    showToast(`Nouveau statut : ${formatStatus(next)}`, 'success');
  }

  async function deleteSelectedPoint() {
    if (!selectedPoint) return;
    const nom = selectedPoint.chef_menage || selectedPoint.nom || 'Point';
    if (confirm(`Confirmez-vous la suppression de : "${nom}" ?`)) {
      if (window.CartoDB) {
        await window.CartoDB.deletePoint(selectedPoint.id);
      }
      closeOptionsFlyout();
      await refreshPoints();
      showToast('Point supprimé de la base locale', 'info');
    }
  }

  // ── 8. GENERATION ALEATOIRE DE POINTS DE TEST ──────────────────────────────
  async function generateRandomBatch(count) {
    showToast(`Génération de ${count} points aléatoires...`, 'info');
    const bounds = map ? map.getBounds() : null;
    if (window.CartoDB) {
      await window.CartoDB.generateRandomPoints(count, false, bounds);
    }
    await refreshPoints();
    showToast(`✅ ${count} nouveaux points ajoutés !`, 'success');
  }

  async function resetAllRandom() {
    if (confirm('Voulez-vous réinitialiser et générer 35 points aléatoires ?')) {
      if (window.CartoDB) {
        await window.CartoDB.generateRandomPoints(35, true);
      }
      await refreshPoints();
      showToast('Données réinitialisées avec 35 points de test', 'success');
    }
  }

  function openAddPointPrompt(lat, lng) {
    const chef = prompt('Nom du chef de ménage (ou nom du point d\'intérêt) :', 'Ménage Enquête Test');
    if (!chef) return;

    const newPoint = {
      type: 'menage',
      code: `MEN-2026-TUN-${Math.floor(1000 + Math.random() * 9000)}`,
      chef_menage: chef.trim(),
      taille: Math.floor(1 + Math.random() * 6),
      statut: 'recense',
      type_logement: 'Appartement',
      tranche_revenu: '1500 - 3000 DT',
      adresse: 'Position carte',
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      circle_radius: 12,
      circle_color: '#10B981',
      circle_opacity: 0.85
    };

    if (window.CartoDB) {
      window.CartoDB.addPoint(newPoint).then(() => {
        refreshPoints();
        showToast('Nouveau ménage enregistré !', 'success');
      });
    }
  }

  // ── 9. ECOUTEURS D'EVENEMENTS ──────────────────────────────────────────────
  function setupEventListeners() {
    // Boutons sélecteur de fond de carte
    document.querySelectorAll('.basemap-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchBasemap(btn.dataset.basemap));
    });

    // Bouton Itinéraire (Header)
    const btnToggleItin = document.getElementById('btn-toggle-itinerary');
    if (btnToggleItin) btnToggleItin.addEventListener('click', toggleItineraryPanel);

    const btnCloseItin = document.getElementById('btn-close-itinerary');
    if (btnCloseItin) btnCloseItin.addEventListener('click', closeItineraryPanel);

    // Modes de transport
    document.querySelectorAll('.mode-transport-btn').forEach((btn) => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.mode-transport-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        routeMode = btn.dataset.mode;
        if (routeStartCoords && routeEndCoords) calculateRoute();
      });
    });

    // Sélecteur A et B sur la carte
    const btnPickA = document.getElementById('btn-pick-start');
    if (btnPickA) btnPickA.addEventListener('click', () => setPickingMode('start'));

    const btnPickB = document.getElementById('btn-pick-end');
    if (btnPickB) btnPickB.addEventListener('click', () => setPickingMode('end'));

    const btnCalc = document.getElementById('btn-do-calc');
    if (btnCalc) btnCalc.addEventListener('click', calculateRoute);

    // Bouton Génération Aléatoire (Header)
    const btnRandom = document.getElementById('btn-random-generate');
    if (btnRandom) {
      btnRandom.addEventListener('click', () => {
        const val = prompt('Combien de points aléatoires souhaitez-vous générer (10 à 100) ?', '25');
        const count = parseInt(val, 10);
        if (count && count > 0) generateRandomBatch(Math.min(150, count));
      });
    }

    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) btnReset.addEventListener('click', resetAllRandom);

    // Bouton Ajouter Point (Header)
    const btnAdd = document.getElementById('btn-add-point');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        setPickingMode('add_point');
        showToast('Cliquez sur la carte à l\'endroit désiré pour placer le point', 'info');
      });
    }

    // Bouton Centrer Enquêteur (Header)
    const btnCenterSurv = document.getElementById('btn-center-surveyor');
    if (btnCenterSurv) btnCenterSurv.addEventListener('click', centerOnSurveyor);

    // Bouton Position GPS Réelle (Header)
    const btnGpsLoc = document.getElementById('btn-gps-locate');
    if (btnGpsLoc) btnGpsLoc.addEventListener('click', locateWithGPS);

    // Actions de la Rubrique du Ménage (au clic d'un cercle ou popup)
    const actRoute = document.getElementById('action-calc-route');
    if (actRoute) actRoute.addEventListener('click', routeToSelectedPoint);

    const actQuest = document.getElementById('action-open-questionnaire');
    if (actQuest) actQuest.addEventListener('click', openHouseholdQuestionnaire);

    const btnCloseQuestModal = document.getElementById('btn-close-quest-modal');
    if (btnCloseQuestModal) btnCloseQuestModal.addEventListener('click', closeHouseholdQuestionnaire);

    const btnAckQuestModal = document.getElementById('btn-ack-quest-modal');
    if (btnAckQuestModal) btnAckQuestModal.addEventListener('click', closeHouseholdQuestionnaire);

    const actStart = document.getElementById('action-set-start');
    if (actStart) actStart.addEventListener('click', setAsRouteStartPoint);

    const actStatus = document.getElementById('action-change-status');
    if (actStatus) actStatus.addEventListener('click', changeSelectedStatus);

    const actDelete = document.getElementById('action-delete-point');
    if (actDelete) actDelete.addEventListener('click', deleteSelectedPoint);

    const btnCloseFlyout = document.getElementById('btn-close-flyout');
    if (btnCloseFlyout) btnCloseFlyout.addEventListener('click', closeOptionsFlyout);
  }

  // Exposer les méthodes globales pour les clics depuis les popups Leaflet
  window.CartoApp = {
    calcRouteToPoint: (id) => {
      const pt = allPoints.find(p => p.id === id);
      if (pt) {
        selectedPoint = pt;
        routeToSelectedPoint();
      }
    },
    openQuestionnaireForPoint: (id) => {
      const pt = allPoints.find(p => p.id === id);
      if (pt) {
        selectedPoint = pt;
        openHouseholdQuestionnaire();
      }
    },
    centerOnSurveyor: centerOnSurveyor,
    locateWithGPS: locateWithGPS,
    copySurveyorGPS: copySurveyorGPS
  };

  function setPickingMode(mode) {
    pickingMode = mode;
    const startBtn = document.getElementById('btn-pick-start');
    const endBtn = document.getElementById('btn-pick-end');

    if (startBtn) startBtn.classList.toggle('active', mode === 'start');
    if (endBtn) endBtn.classList.toggle('active', mode === 'end');

    if (mode) {
      if (map) map.getContainer().style.cursor = 'crosshair';
      if (mode === 'start') showToast('Cliquez sur la carte pour choisir le départ (A)', 'info');
      if (mode === 'end') showToast('Cliquez sur la carte pour choisir l\'arrivée (B)', 'info');
    } else {
      if (map) map.getContainer().style.cursor = '';
    }
  }

  function toggleItineraryPanel() {
    const p = document.getElementById('itinerary-panel');
    p.classList.toggle('open');
    const btn = document.getElementById('btn-toggle-itinerary');
    if (btn) btn.classList.toggle('active', p.classList.contains('open'));
  }

  function openItineraryPanel() {
    const p = document.getElementById('itinerary-panel');
    p.classList.add('open');
    const btn = document.getElementById('btn-toggle-itinerary');
    if (btn) btn.classList.add('active');
  }

  function closeItineraryPanel() {
    const p = document.getElementById('itinerary-panel');
    p.classList.remove('open');
    const btn = document.getElementById('btn-toggle-itinerary');
    if (btn) btn.classList.remove('active');
  }

  // ── 10. UTILITAIRES DE GÉODÉSIE & CALCUL DE DISTANCE GPS ─────────────────────
  /**
   * Calcul précis de la distance entre deux coordonnées GPS (WGS-84)
   * Utilise en priorité la méthode géodésique de Leaflet (ellipsoïde WGS-84)
   * avec repli sur la formule de Haversine rigoureuse (R = 6371.0088 km).
   */
  function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
    const p1Lat = +lat1;
    const p1Lon = +lon1;
    const p2Lat = +lat2;
    const p2Lon = +lon2;

    if (isNaN(p1Lat) || isNaN(p1Lon) || isNaN(p2Lat) || isNaN(p2Lon)) {
      return 0;
    }

    // 1. Calcul géodésique standard Leaflet si disponible
    if (typeof L !== 'undefined' && typeof L.latLng === 'function') {
      try {
        const dMeters = L.latLng(p1Lat, p1Lon).distanceTo(L.latLng(p2Lat, p2Lon));
        if (!isNaN(dMeters)) return dMeters / 1000;
      } catch (e) {
        // Fallback sur formule trigonométrique
      }
    }

    // 2. Formule de Haversine standard WGS-84
    const R = 6371.0088; // Rayon moyen volumétrique IUGG
    const dLat = (p2Lat - p1Lat) * Math.PI / 180;
    const dLon = (p2Lon - p1Lon) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1Lat * Math.PI / 180) * Math.cos(p2Lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showToast(msg, type = 'info') {
    let container = document.getElementById('toast-stack');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-stack';
      container.className = 'toast-stack';
      document.body.appendChild(container);
    }

    const t = document.createElement('div');
    t.className = 'toast-msg';

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    t.innerHTML = `<span>${icon}</span> <span>${escapeHtml(msg)}</span>`;
    container.appendChild(t);

    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s ease';
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  // Lancement automatique dès que le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
