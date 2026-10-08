/**
 * CartoPlatform Enterprise Web GIS & Admin Dashboard Controller
 */
document.addEventListener('DOMContentLoaded', () => {

  // ── 1. GLOBAL STATE ─────────────────────────────────────────────────────────
  let map = null;
  let activeTileLayer = null;
  let drawnItems = null;
  let trafficChartInstance = null;
  let currentProvider = 'esri-imagery';
  let is3DMode = false;

  // Itinerary / Routing State
  let routeLayerGroup = null;
  let routeStartCoords = null; // [lat, lng]
  let routeEndCoords = null;   // [lat, lng]
  let routeStartMarker = null;
  let routeEndMarker = null;
  let routePolylineLayer = null;
  let activeRoutingMode = 'car'; // 'car' | 'foot' | 'bike'
  let pickingRoutePoint = null;  // 'start' | 'end' | null

  // ── 2. TAB NAVIGATION ───────────────────────────────────────────────────────
  const navTabs = document.querySelectorAll('.nav-tab-btn');
  const viewSections = document.querySelectorAll('.view-section');

  navTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      
      navTabs.forEach(b => b.classList.remove('active'));
      viewSections.forEach(s => s.classList.remove('active'));

      btn.classList.add('active');
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add('active');

      if (targetId === 'view-map' && map) {
        setTimeout(() => map.invalidateSize(), 150);
      } else if (targetId === 'view-dashboard') {
        loadDashboardStats();
      } else if (targetId === 'view-providers') {
        loadProvidersManagement();
      } else if (targetId === 'view-tokens') {
        loadTokens();
      } else if (targetId === 'view-audit') {
        loadAuditLogs();
      } else if (targetId === 'view-seed') {
        loadSeedStatus();
      }
    });
  });

  // ── 3. MAP INITIALIZATION (LEAFLET + TILES PROXY) ───────────────────────────
  function initMap() {
    // Default center: Tunis, Tunisia (36.8065° N, 10.1815° E)
    const initialCoords = [36.8065, 10.1815];
    const initialZoom = 12;

    map = L.map('map-container', {
      center: initialCoords,
      zoom: initialZoom,
      minZoom: 5,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: false,
      bounceAtZoomLimits: true,
    });

    // Create TileLayer using our secure API gateway proxy
    updateMapTileLayer(currentProvider);

    // FeatureGroup to store editable drawing layers
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // FeatureGroup for Itinerary Polyline and Markers
    routeLayerGroup = new L.FeatureGroup();
    map.addLayer(routeLayerGroup);

    // Map click handler for picking start / end points
    map.on('click', (e) => {
      handleMapClickForRouting(e.latlng);
    });

    // Leaflet.Draw Controls
    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
        remove: true
      },
      draw: {
        polyline: { shapeOptions: { color: '#06B6D4', weight: 4 } },
        polygon: { shapeOptions: { color: '#10B981', fillOpacity: 0.3 } },
        circle: { shapeOptions: { color: '#F59E0B', fillOpacity: 0.25 } },
        rectangle: { shapeOptions: { color: '#8B5CF6', fillOpacity: 0.3 } },
        marker: true,
        circlemarker: false,
      }
    });
    map.addControl(drawControl);

    // Handle Drawn Features & Measure
    map.on(L.Draw.Event.CREATED, (event) => {
      const layer = event.layer;
      const type = event.layerType;
      drawnItems.addLayer(layer);

      let measureText = '';
      if (type === 'polyline') {
        const latlngs = layer.getLatLngs();
        let distance = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
          distance += latlngs[i].distanceTo(latlngs[i + 1]);
        }
        measureText = `Distance : ${(distance / 1000).toFixed(2)} km (${Math.round(distance)} m)`;
      } else if (type === 'polygon' || type === 'rectangle') {
        const latlngs = layer.getLatLngs()[0];
        // Shoelace polygon area calculation in sq meters
        let area = 0;
        if (L.GeometryUtil && L.GeometryUtil.geodesicArea) {
          area = L.GeometryUtil.geodesicArea(latlngs);
        } else {
          area = 12500; // approximation placeholder if GeometryUtil not loaded
        }
        measureText = `Superficie : ${(area / 10000).toFixed(2)} ha (${Math.round(area)} m²)`;
      } else if (type === 'circle') {
        const radius = layer.getRadius();
        const area = Math.PI * radius * radius;
        measureText = `Rayon : ${Math.round(radius)} m | Surface : ${(area / 10000).toFixed(2)} ha`;
      } else if (type === 'marker') {
        const p = layer.getLatLng();
        measureText = `Point : ${p.lat.toFixed(5)}°N, ${p.lng.toFixed(5)}°E`;
      }

      document.getElementById('measureBox').innerHTML = `
        <strong style="color: var(--accent-cyan);">${measureText}</strong>
        <div style="font-size: 11px; margin-top: 4px; color: var(--text-dim);">${drawnItems.getLayers().length} élément(s) actif(s) sur la carte</div>
      `;
    });

    // Update Mouse Coordinates & Zoom in Status Bar
    map.on('mousemove', (e) => {
      document.getElementById('mapCoords').innerText = 
        `Curseur : ${e.latlng.lat.toFixed(5)}°N, ${e.latlng.lng.toFixed(5)}°E | Zoom : ${map.getZoom()}`;
    });

    // Parse URL permalink if present
    parseUrlPermalink();
  }

  const providerZoomLimits = {
    'esri-imagery': { minZoom: 5, maxZoom: 19, maxNativeZoom: 19 },
    'esri-streets': { minZoom: 5, maxZoom: 19, maxNativeZoom: 19 },
    'esri-topo': { minZoom: 5, maxZoom: 18, maxNativeZoom: 18 },
    'osm-standard': { minZoom: 5, maxZoom: 19, maxNativeZoom: 19 },
    'google-satellite': { minZoom: 5, maxZoom: 20, maxNativeZoom: 20 },
    'maptiler-satellite': { minZoom: 5, maxZoom: 19, maxNativeZoom: 19 },
  };

  function updateMapTileLayer(providerId) {
    if (activeTileLayer) {
      map.removeLayer(activeTileLayer);
    }

    currentProvider = providerId;
    const limits = providerZoomLimits[providerId] || { minZoom: 5, maxZoom: 18, maxNativeZoom: 18 };

    // Strictly lock zoom limits on the map: '+' button disables and wheel zoom stops at maxZoom
    map.setMinZoom(limits.minZoom);
    map.setMaxZoom(limits.maxZoom);

    // If current zoom is above this provider's limit, smoothly clamp it down
    if (map.getZoom() > limits.maxZoom) {
      map.setZoom(limits.maxZoom);
    }

    const tileUrl = `/api/tiles/${providerId}/{z}/{x}/{y}.png`;
    
    activeTileLayer = L.tileLayer(tileUrl, {
      minZoom: limits.minZoom,
      maxZoom: limits.maxZoom,
      maxNativeZoom: limits.maxNativeZoom, // Never requests missing tiles beyond native limit
      keepBuffer: 8,                      // Retains parent/surrounding tiles to prevent black flashes
      updateWhenIdle: false,              // Smooth continuous rendering while dragging
      updateWhenZooming: true,
      opacity: parseFloat(document.getElementById('opacitySlider').value || '1.0'),
    }).addTo(map);

    // Update Attribution
    const providerNames = {
      'esri-imagery': 'Tiles &copy; Esri World Imagery, Maxar, Earthstar',
      'esri-streets': 'Tiles &copy; Esri World Street Map',
      'esri-topo': 'Tiles &copy; Esri Topo & Contributors',
      'osm-standard': '&copy; OpenStreetMap contributors',
      'google-satellite': '&copy; Google Maps Data',
      'maptiler-satellite': '&copy; MapTiler & OpenStreetMap',
    };
    document.getElementById('mapAttribution').innerHTML = providerNames[providerId] || 'Tiles &copy; CartoPlatform';
  }

  // ── 4. MAP TOOLS & INTERACTION ──────────────────────────────────────────────
  // Style cards switcher
  const styleCards = document.querySelectorAll('.style-card');
  styleCards.forEach(card => {
    card.addEventListener('click', () => {
      const provider = card.getAttribute('data-provider');
      if (card.classList.contains('disabled-cloud-layer')) {
        alert(`ℹ️ Source Externe Cloud (${provider}) :\nCette source requiert une clé d'API commerciale dans le fichier .env et n'est pas pré-téléchargée hors-ligne.\n\nLes 4 fonds souverains (Esri Satellite, Esri Plan Urbain, Esri Relief Topo, OpenStreetMap) sont 100% préchargés et opérationnels hors-ligne.`);
        return;
      }
      styleCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      updateMapTileLayer(provider);
    });
  });

  // Toggle external cloud providers
  const btnToggleExternal = document.getElementById('btnToggleExternalProviders');
  const externalContainer = document.getElementById('externalProvidersContainer');
  const externalArrow = document.getElementById('externalProvidersArrow');
  if (btnToggleExternal && externalContainer) {
    btnToggleExternal.addEventListener('click', () => {
      const isHidden = externalContainer.style.display === 'none' || externalContainer.style.display === '';
      externalContainer.style.display = isHidden ? 'flex' : 'none';
      if (externalArrow) externalArrow.innerText = isHidden ? '▲' : '▼';
    });
  }

  // Layer Opacity slider
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityVal = document.getElementById('opacityVal');
  opacitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    opacityVal.innerText = `${Math.round(val * 100)}%`;
    if (activeTileLayer) {
      activeTileLayer.setOpacity(val);
    }
  });

  // Address Search / Geocoder
  const geocodeInput = document.getElementById('geocodeInput');
  const geocodeDropdown = document.getElementById('geocodeDropdown');
  let debounceTimeout = null;

  geocodeInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    const query = geocodeInput.value.trim();

    if (query.length < 2) {
      geocodeDropdown.style.display = 'none';
      return;
    }

    debounceTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();

        if (data.results && data.results.length > 0) {
          geocodeDropdown.innerHTML = '';
          data.results.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerText = item.displayName;
            div.addEventListener('click', () => {
              map.setView([item.lat, item.lon], 14, { animate: true });
              L.marker([item.lat, item.lon]).addTo(drawnItems).bindPopup(`<strong>${item.displayName}</strong>`).openPopup();
              geocodeDropdown.style.display = 'none';
              geocodeInput.value = item.displayName;
            });
            geocodeDropdown.appendChild(div);
          });
          geocodeDropdown.style.display = 'block';
        } else {
          geocodeDropdown.style.display = 'none';
        }
      } catch (err) {
        geocodeDropdown.style.display = 'none';
      }
    }, 350);
  });

  // Close search dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!geocodeInput.contains(e.target) && !geocodeDropdown.contains(e.target)) {
      geocodeDropdown.style.display = 'none';
    }
  });

  // Locate Me Button
  document.getElementById('btnLocate').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          map.setView([lat, lon], 15, { animate: true });
          L.circleMarker([lat, lon], { radius: 8, color: '#06B6D4', fillColor: '#38BDF8', fillOpacity: 0.9 })
            .addTo(drawnItems)
            .bindPopup('📍 Votre position actuelle')
            .openPopup();
        },
        () => alert('Impossible d\'obtenir votre géolocalisation.')
      );
    }
  });

  // 3D Perspective Toggle (CSS Transform Tilt)
  document.getElementById('btnToggle3D').addEventListener('click', () => {
    is3DMode = !is3DMode;
    const container = document.getElementById('map-container');
    if (is3DMode) {
      container.style.transform = 'perspective(900px) rotateX(25deg)';
      container.style.transition = 'transform 0.4s ease';
      document.getElementById('btnToggle3D').classList.add('active');
    } else {
      container.style.transform = 'none';
      document.getElementById('btnToggle3D').classList.remove('active');
    }
  });

  // Fullscreen Button
  document.getElementById('btnFullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });

  // Share View by URL
  document.getElementById('btnShareUrl').addEventListener('click', () => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const url = `${window.location.origin}${window.location.pathname}#lat=${center.lat.toFixed(5)}&lon=${center.lng.toFixed(5)}&zoom=${zoom}&provider=${currentProvider}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Lien de partage copié dans le presse-papier :\n${url}`);
    });
  });

  function parseUrlPermalink() {
    const hash = window.location.hash.substring(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const lat = parseFloat(params.get('lat'));
    const lon = parseFloat(params.get('lon'));
    const zoom = parseInt(params.get('zoom'), 10);
    const provider = params.get('provider');

    if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom)) {
      map.setView([lat, lon], zoom);
    }
    if (provider) {
      updateMapTileLayer(provider);
    }
  }

  // ── 3.1 GESTION DU CALCUL D'ITINÉRAIRE (VOITURE & PIÉTON) ────────────────────
  function createRouteMarker(label, latlng, cssClass) {
    const icon = L.divIcon({
      className: `custom-route-marker ${cssClass}`,
      html: label,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    return L.marker(latlng, { icon }).addTo(routeLayerGroup);
  }

  function handleMapClickForRouting(latlng) {
    if (!pickingRoutePoint) return;

    const latStr = latlng.lat.toFixed(5);
    const lonStr = latlng.lng.toFixed(5);
    const coordLabel = `${latStr}, ${lonStr}`;

    if (pickingRoutePoint === 'start') {
      routeStartCoords = [latlng.lat, latlng.lng];
      document.getElementById('routeStartInput').value = coordLabel;
      if (routeStartMarker) routeLayerGroup.removeLayer(routeStartMarker);
      routeStartMarker = createRouteMarker('A', latlng, 'marker-start');
      routeStartMarker.bindPopup(`<strong>Point de Départ (A)</strong><br>${coordLabel}`).openPopup();
      
      document.getElementById('btnPickStartOnMap').classList.remove('active');
      pickingRoutePoint = null;

      if (document.getElementById('routeEndInput').value.trim().length > 0) {
        calculateRoute();
      }
    } else if (pickingRoutePoint === 'end') {
      routeEndCoords = [latlng.lat, latlng.lng];
      document.getElementById('routeEndInput').value = coordLabel;
      if (routeEndMarker) routeLayerGroup.removeLayer(routeEndMarker);
      routeEndMarker = createRouteMarker('B', latlng, 'marker-end');
      routeEndMarker.bindPopup(`<strong>Point d'Arrivée (B)</strong><br>${coordLabel}`).openPopup();

      document.getElementById('btnPickEndOnMap').classList.remove('active');
      pickingRoutePoint = null;

      if (document.getElementById('routeStartInput').value.trim().length > 0) {
        calculateRoute();
      }
    }
  }

  // Mode Selection Buttons
  const modeButtons = document.querySelectorAll('.btn-mode');
  const routeModeBadge = document.getElementById('routeModeBadge');

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRoutingMode = btn.getAttribute('data-mode');

      const modeLabels = { car: 'Voiture', foot: 'Piéton', bike: 'Vélo' };
      if (routeModeBadge) routeModeBadge.innerText = modeLabels[activeRoutingMode] || 'Voiture';

      // Auto-recalculate if endpoints are set
      const startVal = document.getElementById('routeStartInput').value.trim();
      const endVal = document.getElementById('routeEndInput').value.trim();
      if (startVal && endVal) {
        calculateRoute();
      }
    });
  });

  // Pick Points on Map buttons
  const btnPickStart = document.getElementById('btnPickStartOnMap');
  const btnPickEnd = document.getElementById('btnPickEndOnMap');

  btnPickStart.addEventListener('click', () => {
    if (pickingRoutePoint === 'start') {
      pickingRoutePoint = null;
      btnPickStart.classList.remove('active');
    } else {
      pickingRoutePoint = 'start';
      btnPickStart.classList.add('active');
      btnPickEnd.classList.remove('active');
    }
  });

  btnPickEnd.addEventListener('click', () => {
    if (pickingRoutePoint === 'end') {
      pickingRoutePoint = null;
      btnPickEnd.classList.remove('active');
    } else {
      pickingRoutePoint = 'end';
      btnPickEnd.classList.add('active');
      btnPickStart.classList.remove('active');
    }
  });

  // Calculate Route function
  async function calculateRoute() {
    const startVal = document.getElementById('routeStartInput').value.trim();
    const endVal = document.getElementById('routeEndInput').value.trim();
    const btnCalc = document.getElementById('btnCalculateRoute');

    if (!startVal || !endVal) {
      alert('Veuillez indiquer un point de départ et un point d\'arrivée (cliquez sur les icônes 📍 et 🏁 ou saisissez un nom de ville).');
      return;
    }

    btnCalc.innerText = 'Calcul...';
    btnCalc.disabled = true;

    try {
      const url = `/api/routing/route?start=${encodeURIComponent(startVal)}&end=${encodeURIComponent(endVal)}&mode=${activeRoutingMode}&steps=true`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Erreur calcul itinéraire (${res.status})`);
      }

      // 1. Clear previous polyline
      if (routePolylineLayer) {
        routeLayerGroup.removeLayer(routePolylineLayer);
      }

      // 2. Select Polyline Color by Mode
      let routeColor = '#06B6D4'; // Cyan voiture
      if (activeRoutingMode === 'foot') routeColor = '#10B981'; // Emerald piéton
      if (activeRoutingMode === 'bike') routeColor = '#F59E0B'; // Amber vélo

      routePolylineLayer = L.geoJSON(data.geometry, {
        style: {
          color: routeColor,
          weight: 6,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round'
        }
      }).addTo(routeLayerGroup);

      // Fit map view to route bounds
      map.fitBounds(routePolylineLayer.getBounds(), { padding: [40, 40] });

      // Ensure start and end markers exist on map (especially for geocoded text names)
      if (data.waypoints && data.waypoints.start && data.waypoints.destination) {
        const sLoc = data.waypoints.start.location; // [lon, lat]
        const dLoc = data.waypoints.destination.location; // [lon, lat]

        if (!routeStartMarker) {
          routeStartMarker = createRouteMarker('A', [sLoc[1], sLoc[0]], 'marker-start');
        } else {
          routeStartMarker.setLatLng([sLoc[1], sLoc[0]]);
        }
        routeStartMarker.bindPopup(`<strong>Départ (A) :</strong> ${data.waypoints.start.name || 'Départ'}`);

        if (!routeEndMarker) {
          routeEndMarker = createRouteMarker('B', [dLoc[1], dLoc[0]], 'marker-end');
        } else {
          routeEndMarker.setLatLng([dLoc[1], dLoc[0]]);
        }
        routeEndMarker.bindPopup(`<strong>Arrivée (B) :</strong> ${data.waypoints.destination.name || 'Arrivée'}`);
      }

      // 3. Update Results Card
      document.getElementById('routeDistanceVal').innerText = data.distanceFormatted;
      document.getElementById('routeDurationVal').innerText = data.durationFormatted;
      
      const cacheBadge = document.getElementById('routeCacheBadge');
      if (data.isCacheHit) {
        cacheBadge.className = 'badge badge-cyan';
        cacheBadge.innerText = '⚡ En Cache';
      } else {
        cacheBadge.className = 'badge badge-emerald';
        cacheBadge.innerText = '🌐 Direct';
      }

      document.getElementById('routeStepsCount').innerText = data.stepsCount || 0;
      document.getElementById('routeResultsCard').style.display = 'block';

      // 4. Render Step-by-Step Navigation List
      const stepsContainer = document.getElementById('routeStepsContainer');
      stepsContainer.innerHTML = '';

      if (data.steps && data.steps.length > 0) {
        data.steps.forEach(step => {
          const stepDiv = document.createElement('div');
          stepDiv.className = 'route-step-item';

          let iconChar = '⬆️';
          if (step.icon === 'corner-up-left') iconChar = '↖️';
          else if (step.icon === 'corner-up-right') iconChar = '↗️';
          else if (step.icon === 'corner-down-left') iconChar = '↩️';
          else if (step.icon === 'rotate-cw') iconChar = '🔄';
          else if (step.icon === 'flag') iconChar = '🏁';

          stepDiv.innerHTML = `
            <div class="route-step-icon">${iconChar}</div>
            <div class="route-step-content">
              <div class="route-step-instruction">${step.instruction}</div>
              <div class="route-step-dist">${step.distanceFormatted} • ${step.durationFormatted}</div>
            </div>
          `;

          // Pan to step maneuver on click
          stepDiv.addEventListener('click', () => {
            if (step.location && step.location.length === 2) {
              const stepLatLng = [step.location[1], step.location[0]];
              map.setView(stepLatLng, 16, { animate: true });
              L.popup()
                .setLatLng(stepLatLng)
                .setContent(`<strong>Étape ${step.stepIndex}</strong><br>${step.instruction}<br><small style="color:#94A3B8;">${step.distanceFormatted}</small>`)
                .openOn(map);
            }
          });

          stepsContainer.appendChild(stepDiv);
        });
      }

    } catch (err) {
      alert(`Erreur itinéraire : ${err.message}`);
    } finally {
      btnCalc.innerText = '⚡ Calculer';
      btnCalc.disabled = false;
    }
  }

  document.getElementById('btnCalculateRoute').addEventListener('click', calculateRoute);

  // Inverser Départ et Arrivée
  document.getElementById('btnSwapRoutePoints').addEventListener('click', () => {
    const inputStart = document.getElementById('routeStartInput');
    const inputEnd = document.getElementById('routeEndInput');

    const tempVal = inputStart.value;
    inputStart.value = inputEnd.value;
    inputEnd.value = tempVal;

    const tempCoords = routeStartCoords;
    routeStartCoords = routeEndCoords;
    routeEndCoords = tempCoords;

    if (inputStart.value && inputEnd.value) {
      calculateRoute();
    }
  });

  // Effacer l'itinéraire
  document.getElementById('btnClearRoute').addEventListener('click', () => {
    routeLayerGroup.clearLayers();
    routeStartCoords = null;
    routeEndCoords = null;
    routeStartMarker = null;
    routeEndMarker = null;
    routePolylineLayer = null;
    pickingRoutePoint = null;

    document.getElementById('routeStartInput').value = '';
    document.getElementById('routeEndInput').value = '';
    document.getElementById('routeResultsCard').style.display = 'none';
    document.getElementById('btnPickStartOnMap').classList.remove('active');
    document.getElementById('btnPickEndOnMap').classList.remove('active');
  });

  // Toggle Steps Accordion
  document.getElementById('btnToggleRouteSteps').addEventListener('click', () => {
    const container = document.getElementById('routeStepsContainer');
    const arrow = document.getElementById('routeStepsArrow');
    if (container.style.display === 'none' || container.style.display === '') {
      container.style.display = 'block';
      arrow.innerText = '▲';
    } else {
      container.style.display = 'none';
      arrow.innerText = '▼';
    }
  });

  // GeoJSON / KML Import
  document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const geojson = JSON.parse(event.target.result);
        const geojsonLayer = L.geoJSON(geojson, {
          style: { color: '#06B6D4', weight: 3, fillOpacity: 0.3 }
        }).addTo(drawnItems);
        map.fitBounds(geojsonLayer.getBounds());
        alert(`Couche importée avec succès : ${file.name}`);
      } catch (err) {
        alert('Format de fichier invalide (GeoJSON attendu).');
      }
    };
    reader.readAsText(file);
  });

  // GeoJSON Export
  document.getElementById('btnExportGeoJSON').addEventListener('click', () => {
    const data = drawnItems.toGeoJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carto-export-${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Static Map Export / Image Preview
  document.getElementById('btnExportStatic').addEventListener('click', () => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const staticUrl = `/api/static-map?center=${center.lng.toFixed(4)},${center.lat.toFixed(4)}&zoom=${zoom}&provider=${currentProvider}`;
    window.open(staticUrl, '_blank');
  });

  // ── 5. ADMIN DASHBOARD DATA & CHARTS ─────────────────────────────────────────
  let currentDashboardPeriod = '24h';
  let currentDashboardTokenId = '';

  const periodLabels = {
    '1h': 'Dernière Heure',
    '24h': 'Dernières 24 Heures',
    '7d': '7 Derniers Jours',
    '30d': '30 Derniers Jours',
    'all': 'Tout l\'historique'
  };

  async function loadDashboardStats() {
    try {
      let url = `/api/statistics?period=${currentDashboardPeriod}`;
      if (currentDashboardTokenId) {
        url += `&tokenId=${encodeURIComponent(currentDashboardTokenId)}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!data.summary) return;

      // Update KPI Cards
      document.getElementById('kpiTotalCalls').innerText = Number(data.summary.totalCalls).toLocaleString();
      document.getElementById('kpiCacheHitRate').innerText = `${data.summary.cacheHitRatePercent}%`;
      document.getElementById('kpiCacheSub').innerText = `${Number(data.summary.cacheHits).toLocaleString()} tuiles servies depuis Redis`;
      document.getElementById('kpiLatency').innerText = `${data.summary.avgLatencyMs} ms`;
      document.getElementById('kpiLatencySub').innerText = `P95: ${data.summary.p95LatencyMs}ms | P99: ${data.summary.p99LatencyMs}ms`;

      // Subtitle with period & filter indication
      const periodName = periodLabels[currentDashboardPeriod] || currentDashboardPeriod;
      const subEl = document.getElementById('kpiCallsSub');
      if (subEl) {
        subEl.innerHTML = `<span style="color: var(--accent-emerald);">●</span> ${currentDashboardTokenId ? 'API Ciblée' : 'Global'} (${periodName})`;
      }

      // Update Global Success Rate KPI
      const successRateEl = document.getElementById('kpiSuccessRate');
      if (successRateEl) {
        const total = data.summary.totalCalls || 0;
        const success = data.summary.successCalls || 0;
        const rate = total > 0 ? ((success / total) * 100).toFixed(1) : 100;
        successRateEl.innerText = `${rate}%`;
      }

      // Update badge period
      const badgePeriodEl = document.getElementById('badgeTrafficPeriod');
      if (badgePeriodEl) {
        badgePeriodEl.innerText = periodName;
      }

      // Populate API filter dropdown if needed
      populateApiFilterSelect(data.tokensUsage || []);

      // Render Traffic Chart
      renderTrafficChart(data.timeline || [], currentDashboardPeriod);

      // Render HTTP Status Table
      renderHttpStatusTable(data.statusCodes || []);

      // Render Tokens / API Usage Table
      renderTokensUsageTable(data.tokensUsage || []);

      // Render Provider Usage Table
      renderProviderUsageTable(data.providers || []);

      // Render Top Endpoints Table
      renderTopEndpointsTable(data.topEndpoints || []);

    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    }
  }

  function populateApiFilterSelect(tokens) {
    const select = document.getElementById('selectApiFilter');
    if (!select) return;

    const previousVal = select.value || currentDashboardTokenId;
    let html = '<option value="">🌐 Toutes les APIs (Global)</option>';

    tokens.forEach(t => {
      const selected = t.id === previousVal ? 'selected' : '';
      const statusIcon = t.isRevoked ? '⏸️ [Désactivée]' : '▶️';
      html += `<option value="${t.id}" ${selected}>${statusIcon} ${t.name} (${t.prefix}...)</option>`;
    });

    select.innerHTML = html;
  }

  function renderTrafficChart(timeline, period = '24h') {
    const ctx = document.getElementById('trafficChart').getContext('2d');
    
    const labels = timeline.map(t => {
      const d = new Date(t.timestamp);
      if (period === '1h') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (period === '24h') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      }
    });

    const totalData = timeline.map(t => parseInt(t.total_calls, 10));
    const cacheData = timeline.map(t => parseInt(t.cache_hits, 10));

    if (trafficChartInstance) {
      trafficChartInstance.destroy();
    }

    const isLight = document.body.classList.contains('light-theme');

    trafficChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
        datasets: [
          {
            label: 'Total Requêtes',
            data: totalData.length > 0 ? totalData : [12, 19, 45, 120, 80, 65],
            borderColor: isLight ? '#0061AD' : '#06B6D4',
            backgroundColor: isLight ? 'rgba(0, 97, 173, 0.08)' : 'rgba(6, 182, 212, 0.1)',
            tension: 0.3,
            fill: true,
          },
          {
            label: 'Cache Hits Redis',
            data: cacheData.length > 0 ? cacheData : [10, 16, 40, 110, 72, 60],
            borderColor: '#10B981',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: isLight ? '#1E293B' : '#94A3B8', font: { family: 'Plus Jakarta Sans', weight: '600' } } }
        },
        scales: {
          x: { ticks: { color: isLight ? '#475569' : '#64748B' }, grid: { color: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)' } },
          y: { ticks: { color: isLight ? '#475569' : '#64748B' }, grid: { color: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }

  function renderTokensUsageTable(tokens) {
    const tbody = document.getElementById('tokensUsageTable');
    const badgeCount = document.getElementById('badgeApiCount');
    if (!tbody) return;

    if (badgeCount) {
      const activeCount = tokens.filter(t => !t.isRevoked).length;
      badgeCount.innerText = `${activeCount} / ${tokens.length} Clé(s) active(s)`;
    }

    if (!tokens || tokens.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-dim);">Aucune clé d\'API trouvée</td></tr>';
      return;
    }

    tbody.innerHTML = tokens.map(t => {
      const isFiltered = currentDashboardTokenId === t.id;
      const totalCalls = t.totalCalls || 0;
      const successCalls = t.successCalls || 0;
      const errorCalls = t.errorCalls || 0;
      const successRate = totalCalls > 0 ? ((successCalls / totalCalls) * 100).toFixed(1) + '%' : '100%';
      const lastCall = t.lastCallAt ? new Date(t.lastCallAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Jamais';

      return `
        <tr style="${isFiltered ? 'background: rgba(6, 182, 212, 0.08); outline: 1px solid var(--accent-cyan);' : ''}">
          <td>
            <strong>${t.name}</strong>
            ${isFiltered ? '<span class="badge badge-blue" style="margin-left: 6px; font-size: 10px;">Filtre Actif</span>' : ''}
          </td>
          <td><code>${t.prefix}...</code></td>
          <td>
            <span class="badge ${t.isRevoked ? 'badge-rose' : 'badge-green'}">
              ${t.isRevoked ? 'Désactivé' : 'Actif'}
            </span>
          </td>
          <td><strong>${Number(totalCalls).toLocaleString()}</strong></td>
          <td style="color: var(--accent-emerald);">${Number(successCalls).toLocaleString()} (${successRate})</td>
          <td style="color: ${errorCalls > 0 ? 'var(--accent-rose)' : 'var(--text-dim)'};">${Number(errorCalls).toLocaleString()}</td>
          <td>${Number(t.cacheHits || 0).toLocaleString()}</td>
          <td>${t.avgLatencyMs} ms</td>
          <td style="font-size: 12px; color: var(--text-muted);">${lastCall}</td>
          <td>
            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="btn btn-outline btn-dash-filter" data-id="${t.id}" style="padding: 3px 8px; font-size: 11px;">
                ${isFiltered ? '🌐 Global' : '🔍 Filtrer'}
              </button>
              ${t.isRevoked 
                ? `<button class="btn btn-success btn-dash-toggle" data-id="${t.id}" data-action="enable" title="Activer l'API" style="padding: 3px 7px; font-size: 11px;">▶️</button>` 
                : `<button class="btn btn-warning btn-dash-toggle" data-id="${t.id}" data-action="disable" title="Désactiver l'API" style="padding: 3px 7px; font-size: 11px;">⏸️</button>`
              }
              <button class="btn btn-danger btn-dash-delete" data-id="${t.id}" title="Supprimer définitivement l'API" style="padding: 3px 7px; font-size: 11px;">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach listeners for filter buttons in table
    tbody.querySelectorAll('.btn-dash-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        currentDashboardTokenId = (currentDashboardTokenId === id) ? '' : id;
        const select = document.getElementById('selectApiFilter');
        if (select) select.value = currentDashboardTokenId;
        loadDashboardStats();
      });
    });

    // Attach listeners for toggle buttons in table
    tbody.querySelectorAll('.btn-dash-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const isRevoked = action === 'disable';
        try {
          const res = await fetch(`/api/tokens/${id}/toggle`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isRevoked })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Erreur modification');
          loadDashboardStats();
          if (document.getElementById('view-tokens').classList.contains('active')) {
            loadTokens();
          }
        } catch (err) {
          alert('Erreur : ' + err.message);
        }
      });
    });

    // Attach listeners for delete buttons in table
    tbody.querySelectorAll('.btn-dash-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT cette clé d\'API ?')) return;
        try {
          const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Erreur suppression');
          if (currentDashboardTokenId === id) currentDashboardTokenId = '';
          loadDashboardStats();
          if (document.getElementById('view-tokens').classList.contains('active')) {
            loadTokens();
          }
        } catch (err) {
          alert('Erreur : ' + err.message);
        }
      });
    });
  }

  function renderHttpStatusTable(statusCodes) {
    const tbody = document.getElementById('httpStatusTable');
    if (!statusCodes || statusCodes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-dim);">Aucune donnée</td></tr>';
      return;
    }

    tbody.innerHTML = statusCodes.map(s => {
      const code = parseInt(s.http_status, 10);
      let badge = 'badge-green';
      if (code >= 400 && code < 500) badge = 'badge-amber';
      if (code >= 500) badge = 'badge-rose';

      return `
        <tr>
          <td><span class="badge ${badge}">${code}</span></td>
          <td>${code === 200 ? 'OK' : code === 304 ? 'Not Modified (Cache)' : code === 429 ? 'Rate Limited' : 'Erreur'}</td>
          <td><strong>${Number(s.count).toLocaleString()}</strong></td>
        </tr>
      `;
    }).join('');
  }

  function renderProviderUsageTable(providers) {
    const tbody = document.getElementById('providerUsageTable');
    if (!providers || providers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-dim);">Aucun appel</td></tr>';
      return;
    }

    const totalProviderCalls = providers.reduce((acc, p) => acc + parseInt(p.calls || 0, 10), 0);

    tbody.innerHTML = providers.map(p => {
      const calls = parseInt(p.calls || 0, 10);
      const share = totalProviderCalls > 0 ? ((calls / totalProviderCalls) * 100).toFixed(1) + '%' : '0%';
      return `
        <tr>
          <td><strong>${p.provider}</strong></td>
          <td><strong>${Number(calls).toLocaleString()}</strong></td>
          <td>${share}</td>
          <td><span class="badge badge-green">Actif</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderTopEndpointsTable(endpoints) {
    const tbody = document.getElementById('topEndpointsTable');
    if (!endpoints || endpoints.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-dim);">Aucun endpoint</td></tr>';
      return;
    }

    tbody.innerHTML = endpoints.map(e => `
      <tr>
        <td><code>${e.endpoint_path}</code></td>
        <td>${Number(e.calls).toLocaleString()}</td>
        <td>${e.avg_latency} ms</td>
      </tr>
    `).join('');
  }

  // Dashboard Controls Event Listeners
  document.getElementById('btnRefreshStats').addEventListener('click', loadDashboardStats);

  document.getElementById('btnExportStatsCsv').addEventListener('click', () => {
    let url = `/api/statistics?period=${currentDashboardPeriod}&format=csv`;
    if (currentDashboardTokenId) {
      url += `&tokenId=${encodeURIComponent(currentDashboardTokenId)}`;
    }
    window.location.href = url;
  });

  // Period Buttons Handler
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary', 'active');

      currentDashboardPeriod = btn.getAttribute('data-period');
      loadDashboardStats();
    });
  });

  // API Filter Select Handler
  const apiFilterSelect = document.getElementById('selectApiFilter');
  if (apiFilterSelect) {
    apiFilterSelect.addEventListener('change', (e) => {
      currentDashboardTokenId = e.target.value;
      loadDashboardStats();
    });
  }

  // Reset Statistics Button Handler
  const btnResetStats = document.getElementById('btnResetStats');
  if (btnResetStats) {
    btnResetStats.addEventListener('click', async () => {
      const isGlobal = !currentDashboardTokenId;
      const promptMsg = isGlobal
        ? '⚠️ ATTENTION : Vous allez réinitialiser TOUTES les statistiques cartographiques globales.\nTous les historiques de requêtes seront effacés et les compteurs remis à zéro.\n\nConfirmez-vous la réinitialisation ?'
        : '⚠️ Vous allez réinitialiser les statistiques de la clé d\'API sélectionnée.\nSes historiques et compteurs journaliers seront remis à zéro.\n\nConfirmez-vous la réinitialisation ?';

      if (!confirm(promptMsg)) return;

      try {
        const res = await fetch('/api/statistics/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenId: currentDashboardTokenId || null,
            resetQuota: true
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur lors de la réinitialisation');

        alert('✅ ' + (data.message || 'Statistiques réinitialisées avec succès'));
        loadDashboardStats();
        if (document.getElementById('view-tokens').classList.contains('active')) {
          loadTokens();
        }
      } catch (err) {
        alert('❌ Erreur : ' + err.message);
      }
    });
  }

  // ── 6. GESTION DES FOURNISSEURS ─────────────────────────────────────────────
  async function loadProvidersManagement() {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      const tbody = document.getElementById('providersManagementTable');

      if (!data.providers || data.providers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Aucun fournisseur configuré</td></tr>';
        return;
      }

      tbody.innerHTML = data.providers.map(p => {
        const isHealthy = p.healthStatus === 'HEALTHY';
        const cbState = p.circuitBreaker || 'CLOSED';
        return `
          <tr>
            <td><strong>${p.name}</strong><br><small style="color: var(--text-dim);">${p.id}</small></td>
            <td><span class="badge badge-blue">${p.type}</span></td>
            <td>Zoom ${p.minZoom} - ${p.maxZoom}</td>
            <td>Priorité ${p.priority}</td>
            <td>
              <span class="badge ${cbState === 'CLOSED' ? 'badge-green' : 'badge-rose'}">
                ${cbState === 'CLOSED' ? 'Normal (Fermé)' : 'Ouvert (Défaut)'}
              </span>
            </td>
            <td>
              <span class="badge ${isHealthy ? 'badge-green' : 'badge-amber'}">
                ${p.healthStatus}
              </span>
            </td>
            <td>
              <button class="btn btn-outline btn-test-provider" data-id="${p.id}" style="padding: 4px 8px; font-size: 11px;">
                ⚡ Tester Latence
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Wire test buttons
      document.querySelectorAll('.btn-test-provider').forEach(btn => {
        btn.addEventListener('click', async () => {
          const providerId = btn.getAttribute('data-id');
          btn.innerText = '⏳ Test...';
          try {
            const testRes = await fetch('/api/providers/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ providerId })
            });
            const result = await testRes.json();
            alert(`Résultat Test ${providerId} :\nStatut: ${result.status}\nLatence: ${result.latencyMs} ms\nTaille: ${result.tileSizeKb} Ko`);
            loadProvidersManagement();
          } catch (e) {
            alert(`Erreur test fournisseur : ${e.message}`);
          }
        });
      });

    } catch (err) {
      console.error('Failed to load providers', err);
    }
  }

  // ── 7. GESTION DES CLÉS D'API (TOKENS) ──────────────────────────────────────
  async function loadTokens() {
    try {
      const res = await fetch('/api/tokens');
      const data = await res.json();
      const tbody = document.getElementById('tokensTable');

      if (!data.tokens || data.tokens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-dim);">Aucune clé d\'API générée pour le moment</td></tr>';
        return;
      }

      tbody.innerHTML = data.tokens.map(t => `
        <tr>
          <td><strong>${t.name}</strong></td>
          <td><code>${t.token_prefix}...</code></td>
          <td>${t.allowed_domains && t.allowed_domains.length > 0 ? t.allowed_domains.join(', ') : 'Tous (*)'}</td>
          <td>${t.rate_limit_per_min} / min</td>
          <td>${Number(t.daily_quota).toLocaleString()}</td>
          <td>${Number(t.current_day_usage).toLocaleString()}</td>
          <td><span class="badge ${t.is_revoked ? 'badge-rose' : 'badge-green'}">${t.is_revoked ? 'Désactivé' : 'Actif'}</span></td>
          <td>
            <div style="display: flex; gap: 4px; align-items: center;">
              ${t.is_revoked 
                ? `<button class="btn btn-success btn-token-toggle" data-id="${t.id}" data-action="enable" style="padding: 4px 8px; font-size: 11px;">▶️ Activer</button>`
                : `<button class="btn btn-warning btn-token-toggle" data-id="${t.id}" data-action="disable" style="padding: 4px 8px; font-size: 11px;">⏸️ Désactiver</button>`
              }
              <button class="btn btn-danger btn-token-delete" data-id="${t.id}" style="padding: 4px 8px; font-size: 11px;">🗑️ Supprimer</button>
            </div>
          </td>
        </tr>
      `).join('');

      // Toggle active/inactive handler
      document.querySelectorAll('.btn-token-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const action = btn.getAttribute('data-action');
          const isRevoked = action === 'disable';

          try {
            const res = await fetch(`/api/tokens/${id}/toggle`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isRevoked })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Erreur modification');
            loadTokens();
            if (document.getElementById('view-dashboard').classList.contains('active')) {
              loadDashboardStats();
            }
          } catch (err) {
            alert('Erreur : ' + err.message);
          }
        });
      });

      // Permanent delete handler
      document.querySelectorAll('.btn-token-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (confirm('⚠️ Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT cette clé d\'API ? Cette action est irréversible.')) {
            try {
              const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' });
              const result = await res.json();
              if (!res.ok) throw new Error(result.message || 'Erreur suppression');
              loadTokens();
              if (document.getElementById('view-dashboard').classList.contains('active')) {
                loadDashboardStats();
              }
            } catch (err) {
              alert('Erreur : ' + err.message);
            }
          }
        });
      });

    } catch (err) {
      console.error('Failed to load tokens', err);
    }
  }

  // Modal Token Creation
  const newTokenModal = document.getElementById('newTokenModal');
  const secretRevealModal = document.getElementById('secretRevealModal');

  document.getElementById('btnOpenNewTokenModal').addEventListener('click', () => {
    newTokenModal.style.display = 'flex';
  });

  document.getElementById('btnCancelTokenModal').addEventListener('click', () => {
    newTokenModal.style.display = 'none';
  });

  document.getElementById('createTokenForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('tokenNameInput').value;
    const domains = document.getElementById('tokenDomainsInput').value.split(',').map(d => d.trim()).filter(Boolean);
    const rateLimit = parseInt(document.getElementById('tokenRateLimitInput').value, 10);
    const quota = parseInt(document.getElementById('tokenQuotaInput').value, 10);

    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          allowedDomains: domains,
          rateLimitPerMin: rateLimit,
          dailyQuota: quota
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Erreur HTTP ${res.status}`);
      }

      newTokenModal.style.display = 'none';
      document.getElementById('createTokenForm').reset();

      // Show One-Time Reveal Modal
      document.getElementById('revealedSecretText').innerText = data.secretKey;
      const exampleUrl = `${window.location.origin}/api/tiles/esri-imagery/{z}/{x}/{y}.png?key=${data.secretKey}`;
      const urlEl = document.getElementById('revealedSecretUrl');
      if (urlEl) urlEl.innerText = exampleUrl;
      secretRevealModal.style.display = 'flex';

      loadTokens();
    } catch (err) {
      alert(`Erreur création clé : ${err.message}`);
    }
  });

  function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      return new Promise((resolve, reject) => {
        document.execCommand('copy') ? resolve() : reject(new Error('Copy failed'));
        textArea.remove();
      });
    }
  }

  document.getElementById('btnCopySecret').addEventListener('click', () => {
    const text = document.getElementById('revealedSecretText').innerText;
    copyTextToClipboard(text).then(() => {
      alert('Clé secrète copiée dans le presse-papier ! Stockez-la en lieu sûr.');
    }).catch(() => {
      prompt('Veuillez copier manuellement votre clé ci-dessous :', text);
    });
  });

  document.getElementById('btnCloseSecretModal').addEventListener('click', () => {
    secretRevealModal.style.display = 'none';
  });

  // ── 8. JOURNAL D'AUDIT ──────────────────────────────────────────────────────
  async function loadAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs?limit=30');
      const data = await res.json();
      const tbody = document.getElementById('auditTable');

      if (!data.logs || data.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim);">Aucun événement d\'audit</td></tr>';
        return;
      }

      tbody.innerHTML = data.logs.map(log => {
        let badge = 'badge-blue';
        if (log.severity === 'WARNING') badge = 'badge-amber';
        if (log.severity === 'CRITICAL') badge = 'badge-rose';

        return `
          <tr>
            <td>${new Date(log.created_at).toLocaleString()}</td>
            <td><code>${log.action}</code></td>
            <td><span class="badge ${badge}">${log.severity}</span></td>
            <td>${log.user_email || 'Système / Anonyme'}</td>
            <td><code>${log.ip_address}</code></td>
            <td><small style="color: var(--text-muted);">${JSON.stringify(log.details || {})}</small></td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load audit logs', err);
    }
  }

  document.getElementById('btnRefreshAudit').addEventListener('click', loadAuditLogs);

  // ── 9. TÉLÉCHARGEMENT HORS-LIGNE & GESTION DU CACHE ─────────────────────────
  let currentSeedState = null;
  let seedPollingInterval = null;

  const seedLayerNames = {
    'esri-imagery': 'Satellite HD (Esri)',
    'esri-streets': 'Plan Urbain & Rues (Esri)',
    'esri-topo': 'Relief & Topo (Esri)',
    'osm-standard': 'OpenStreetMap Standard',
  };

  const seedLayerSelect = document.getElementById('seedLayerSelect');
  const seedZoomSelect = document.getElementById('seedZoomSelect');
  const seedOverwriteChk = document.getElementById('seedOverwriteChk');
  const btnSeedStart = document.getElementById('btnSeedStart');
  const btnSeedPause = document.getElementById('btnSeedPause');
  const btnSeedStop = document.getElementById('btnSeedStop');
  const btnSeedPurge = document.getElementById('btnSeedPurge');

  const seedPercentDisplay = document.getElementById('seedPercentDisplay');
  const seedProgressBarFill = document.getElementById('seedProgressBarFill');
  const seedStatusDesc = document.getElementById('seedStatusDesc');
  const seedTilesCounter = document.getElementById('seedTilesCounter');
  const seedSpeedDisplay = document.getElementById('seedSpeedDisplay');
  const seedHitsDisplay = document.getElementById('seedHitsDisplay');
  const seedCurrentZoomBadge = document.getElementById('seedCurrentZoomBadge');
  const seedStateHeaderBadge = document.getElementById('seedStateHeaderBadge');

  async function loadSeedStatus() {
    try {
      const res = await fetch('/api/seed/status');
      currentSeedState = await res.json();
      updateSeedUi();
    } catch (err) {
      console.error('Failed to load seed status', err);
    }
  }

  function updateSeedUi() {
    if (!currentSeedState) return;

    const selectedLayer = seedLayerSelect.value;
    const layers = currentSeedState.layersState || {};
    const task = currentSeedState.activeTask || {};
    const isRunning = task.running && !task.paused;
    const isPaused = task.paused;
    const isCurrentTask = (isRunning || isPaused) && task.provider === selectedLayer;

    const layerData = layers[selectedLayer] || { downloaded: 0, totalTiles: 25206, percent: 0, status: 'idle' };

    // Determine values to display
    const percent = isCurrentTask
      ? (task.totalTiles > 0 ? ((task.downloaded / task.totalTiles) * 100).toFixed(1) : 0)
      : (layerData.percent || 0);

    const downloaded = isCurrentTask ? task.downloaded : (layerData.downloaded || 0);
    const total = isCurrentTask ? task.totalTiles : (layerData.totalTiles || 25206);
    const speed = isCurrentTask ? (task.speedTilesPerSec || 0) : 0;
    const hits = isCurrentTask ? (task.cacheHits || 0) : 0;
    const currentZ = isCurrentTask && task.currentZoom ? task.currentZoom : '-';

    // Update Progress Card Elements
    seedPercentDisplay.innerText = `${percent}%`;
    seedProgressBarFill.style.width = `${percent}%`;
    seedTilesCounter.innerText = `${Number(downloaded).toLocaleString()} / ${Number(total).toLocaleString()}`;
    seedSpeedDisplay.innerText = `${speed} t/s`;
    seedHitsDisplay.innerText = `${Number(hits).toLocaleString()}`;
    seedCurrentZoomBadge.innerText = `Zoom : ${currentZ}`;

    // Update Buttons and Badges
    if (isRunning) {
      seedStateHeaderBadge.className = 'badge badge-blue';
      seedStateHeaderBadge.innerText = 'Téléchargement actif';

      btnSeedStart.disabled = true;
      btnSeedStart.innerText = '⏳ Téléchargement en cours...';
      btnSeedPause.disabled = false;
      btnSeedStop.disabled = false;

      seedStatusDesc.innerText = `Téléchargement actif sur ${seedLayerNames[task.provider] || task.provider} (Zoom ${task.currentZoom || '...'})`;

      if (!seedPollingInterval) {
        seedPollingInterval = setInterval(loadSeedStatus, 1500);
      }
    } else if (isPaused) {
      seedStateHeaderBadge.className = 'badge badge-amber';
      seedStateHeaderBadge.innerText = 'En pause';

      btnSeedStart.disabled = false;
      btnSeedStart.innerText = `⏯️ Reprendre le Téléchargement (${percent}%)`;
      btnSeedPause.disabled = true;
      btnSeedStop.disabled = false;

      seedStatusDesc.innerText = `Téléchargement en pause à ${percent}% — Prêt à reprendre`;
      clearInterval(seedPollingInterval);
      seedPollingInterval = null;
    } else {
      clearInterval(seedPollingInterval);
      seedPollingInterval = null;

      btnSeedPause.disabled = true;
      btnSeedStop.disabled = true;
      btnSeedStart.disabled = false;

      if (percent >= 100) {
        seedStateHeaderBadge.className = 'badge badge-green';
        seedStateHeaderBadge.innerText = '100% Complet';
        btnSeedStart.innerText = '🔄 Re-télécharger / Mettre à jour';
        seedStatusDesc.innerText = 'Prêt pour utilisation 100% hors-ligne';
      } else if (percent > 0) {
        seedStateHeaderBadge.className = 'badge badge-amber';
        seedStateHeaderBadge.innerText = `En attente (${percent}%)`;
        btnSeedStart.innerText = `🚀 Reprendre le Téléchargement (à ${percent}%)`;
        seedStatusDesc.innerText = `Téléchargement sauvegardé à ${percent}%`;
      } else {
        seedStateHeaderBadge.className = 'badge badge-green';
        seedStateHeaderBadge.innerText = 'Prêt';
        btnSeedStart.innerText = '🚀 Lancer le Téléchargement';
        seedStatusDesc.innerText = 'Prêt à démarrer';
      }
    }

    renderLayersSummaryTable(layers, task.provider, isRunning);
  }

  function renderLayersSummaryTable(layers, activeProvider, isRunning) {
    const tbody = document.getElementById('seedLayersSummaryTable');
    if (!tbody) return;

    const layerKeys = Object.keys(seedLayerNames);
    tbody.innerHTML = layerKeys.map(key => {
      const l = layers[key] || { downloaded: 0, totalTiles: 25206, percent: 0, status: 'idle' };
      const isActive = isRunning && activeProvider === key;
      const isComplete = l.percent >= 100;

      let badgeClass = 'badge-green';
      let badgeText = 'Prêt Hors-Ligne (100%)';
      if (isActive) {
        badgeClass = 'badge-blue';
        badgeText = 'En cours...';
      } else if (l.percent > 0 && !isComplete) {
        badgeClass = 'badge-amber';
        badgeText = `En pause (${l.percent}%)`;
      } else if (!isComplete) {
        badgeClass = 'badge-amber';
        badgeText = 'Non démarré (0%)';
      }

      return `
        <tr style="${isActive ? 'background: rgba(6, 182, 212, 0.08);' : ''}">
          <td>
            <strong>${seedLayerNames[key]}</strong><br>
            <small style="color: var(--text-dim); font-family: monospace;">${key}</small>
          </td>
          <td>${Number(l.downloaded || 0).toLocaleString()} / ${Number(l.totalTiles || 25206).toLocaleString()} tuiles</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                <div style="width: ${l.percent}%; height: 100%; background: var(--accent-cyan);"></div>
              </div>
              <span style="font-size: 12px; font-weight: 700; width: 45px;">${l.percent}%</span>
            </div>
          </td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td>
            <button class="btn btn-outline btn-select-seed-layer" data-layer="${key}" style="padding: 4px 10px; font-size: 11.5px;">
              ${isActive ? 'Afficher' : 'Télécharger'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-select-seed-layer').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.getAttribute('data-layer');
        // Update hidden native select
        seedLayerSelect.value = layer;
        // Update custom dropdown UI
        setCartoDropdown('layerDropdown', 'layerDropdownLabel', 'seedLayerSelect', layer);
        updateSeedUi();
      });
    });
  }

  // ── Custom Dropdown Logic ────────────────────────────────────────────────────
  function initCartoDropdown(dropdownId, triggerId, menuId, nativeSelectId, labelId) {
    const dropdown = document.getElementById(dropdownId);
    const trigger  = document.getElementById(triggerId);
    const menu     = document.getElementById(menuId);
    const native   = document.getElementById(nativeSelectId);
    if (!dropdown || !trigger || !menu || !native) return;

    // Toggle open
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      // Close all other dropdowns first
      document.querySelectorAll('.carto-dropdown.open').forEach(d => d.classList.remove('open'));
      if (!isOpen) dropdown.classList.add('open');
    });

    // Item selection
    menu.querySelectorAll('.carto-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const value = item.getAttribute('data-value');
        setCartoDropdown(dropdownId, labelId, nativeSelectId, value);
        dropdown.classList.remove('open');
        // Trigger change event on native select so existing listeners fire
        native.dispatchEvent(new Event('change'));
      });
    });
  }

  function setCartoDropdown(dropdownId, labelId, nativeSelectId, value) {
    const dropdown = document.getElementById(dropdownId);
    const labelEl  = document.getElementById(labelId);
    const native   = document.getElementById(nativeSelectId);
    if (!dropdown || !labelEl || !native) return;

    // Sync hidden native select
    native.value = value;

    // Update active class on items
    dropdown.querySelectorAll('.carto-dropdown-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-value') === value);
    });

    // Update trigger label text from the active item
    const activeItem = dropdown.querySelector('.carto-dropdown-item.active');
    if (activeItem) {
      // Use text content of first text node / title div, stripping sub text
      const titleEl = activeItem.querySelector('.carto-dd-title');
      labelEl.textContent = titleEl ? titleEl.textContent.trim() : activeItem.textContent.trim();
    }
  }

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.carto-dropdown.open').forEach(d => d.classList.remove('open'));
  });

  // Initialize both custom dropdowns
  initCartoDropdown('layerDropdown', 'layerDropdownTrigger', 'layerDropdownMenu', 'seedLayerSelect', 'layerDropdownLabel');
  initCartoDropdown('zoomDropdown',  'zoomDropdownTrigger',  'zoomDropdownMenu',  'seedZoomSelect',  'zoomDropdownLabel');

  // Event Listeners for Seed Actions
  seedLayerSelect.addEventListener('change', updateSeedUi);

  btnSeedStart.addEventListener('click', async () => {
    const layer = seedLayerSelect.value;
    const zoomParts = seedZoomSelect.value.split('-');
    const minZoom = parseInt(zoomParts[0], 10);
    const maxZoom = parseInt(zoomParts[1], 10);
    const overwrite = seedOverwriteChk.checked;

    btnSeedStart.innerText = 'Lancement...';
    btnSeedStart.disabled = true;

    try {
      const res = await fetch('/api/seed/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: layer, minZoom, maxZoom, overwrite })
      });
      const data = await res.json();
      currentSeedState = data.state;
      updateSeedUi();
    } catch (e) {
      alert(`Erreur lancement téléchargement : ${e.message}`);
      loadSeedStatus();
    }
  });

  btnSeedPause.addEventListener('click', async () => {
    btnSeedPause.innerText = 'Pause...';
    try {
      const res = await fetch('/api/seed/pause', { method: 'POST' });
      const data = await res.json();
      currentSeedState = data.state;
      updateSeedUi();
    } catch (e) {
      alert(`Erreur mise en pause : ${e.message}`);
    }
  });

  btnSeedStop.addEventListener('click', async () => {
    if (confirm('Voulez-vous vraiment arrêter le téléchargement ? La progression restera sauvegardée.')) {
      try {
        const res = await fetch('/api/seed/stop', { method: 'POST' });
        const data = await res.json();
        currentSeedState = data.state;
        updateSeedUi();
      } catch (e) {
        alert(`Erreur arrêt : ${e.message}`);
      }
    }
  });

  btnSeedPurge.addEventListener('click', async () => {
    const layer = seedLayerSelect.value;
    if (confirm(`Confirmez-vous la purge du cache pour ${seedLayerNames[layer]} ?\nLa progression de ce calque sera réinitialisée.`)) {
      try {
        const res = await fetch('/api/seed/purge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: layer })
        });
        const data = await res.json();
        currentSeedState = data.state;
        updateSeedUi();
        alert(`Cache vidé pour ${seedLayerNames[layer]}`);
      } catch (e) {
        alert(`Erreur purge : ${e.message}`);
      }
    }
  });

  // ── 10. SYSTEM HEALTH MONITORING ────────────────────────────────────────────
  async function checkSystemHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      const textElem = document.getElementById('healthStatusText');
      const pill = document.getElementById('healthPill');

      if (data.status === 'HEALTHY') {
        textElem.innerText = `Opérationnel (PG: ${data.dependencies.postgresql.latencyMs}ms | Redis: ${data.dependencies.redis.status})`;
        pill.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      } else {
        textElem.innerText = 'Système Dégradé';
        pill.style.borderColor = 'rgba(245, 158, 11, 0.5)';
      }
    } catch (e) {
      document.getElementById('healthStatusText').innerText = 'Serveur Non Connecté';
    }
  }

  // ── 11. GESTION DU GUIDE D'INTÉGRATION & EXEMPLES DE CODE ───────────────────
  // Documentation Tabs Switching
  const docTabButtons = document.querySelectorAll('.doc-tab-btn');
  const docPanels = document.querySelectorAll('.doc-panel');

  docTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      docTabButtons.forEach(b => b.classList.remove('active'));
      docPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanelId = btn.getAttribute('data-panel');
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // Dynamic Token Injection into all code examples
  const docApiKeyInput = document.getElementById('docApiKeyInput');
  if (docApiKeyInput) {
    docApiKeyInput.addEventListener('input', () => {
      const newKey = docApiKeyInput.value.trim() || 'VOTRE_CLE_API';
      document.querySelectorAll('.doc-key-placeholder').forEach(el => {
        el.innerText = newKey;
      });
    });
  }

  // Copy Code Buttons
  document.querySelectorAll('.btn-copy-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const codeBlock = btn.closest('.doc-code-block');
      if (!codeBlock) return;
      const codeEl = codeBlock.querySelector('.doc-code-content');
      if (!codeEl) return;

      copyTextToClipboard(codeEl.innerText).then(() => {
        const originalText = btn.innerText;
        btn.innerText = '✅ Copié !';
        btn.style.borderColor = 'var(--accent-emerald)';
        btn.style.color = 'var(--accent-emerald)';
        setTimeout(() => {
          btn.innerText = originalText;
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 2000);
      }).catch(() => {
        prompt('Copiez le code manuellement :', codeEl.innerText);
      });
    });
  });

  // ── THEME MANAGER (DARK / LIGHT THEME) ──────────────────────────────────
  function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeToggleIcon');
    const savedTheme = localStorage.getItem('ins_sig_theme') || 'dark';

    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      if (themeIcon) themeIcon.innerText = '🌙';
    } else {
      document.body.classList.remove('light-theme');
      if (themeIcon) themeIcon.innerText = '☀️';
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('ins_sig_theme', isLight ? 'light' : 'dark');
        if (themeIcon) themeIcon.innerText = isLight ? '🌙' : '☀️';
        if (document.getElementById('view-dashboard')?.classList.contains('active')) {
          loadDashboardStats();
        }
      });
    }
  }

  // ── AUTHENTICATION & FULL-PAGE LOGIN SCREEN ────────────────────────────
  function initAuth() {
    const userBtn = document.getElementById('userAuthBtn');
    const userAvatar = document.getElementById('userAvatar');
    const userLabel = document.getElementById('userLabel');
    const loginScreen = document.getElementById('loginScreen');
    const loginForm = document.getElementById('loginForm');
    const feedback = document.getElementById('loginFeedback');

    function updateAuthState() {
      const token = localStorage.getItem('ins_sig_token');
      const userStr = localStorage.getItem('ins_sig_user');
      let user = null;
      try {
        user = userStr ? JSON.parse(userStr) : null;
      } catch (e) {}

      if (token && user) {
        // Authenticated: Hide the login screen and show the platform!
        if (loginScreen) {
          loginScreen.classList.add('hidden');
          loginScreen.style.setProperty('display', 'none', 'important');
        }
        if (userBtn) {
          userBtn.classList.add('logged-in');
          userBtn.title = `Connecté : ${user.email} (${user.role ? user.role.toUpperCase() : 'ADMIN'}) — Cliquez pour vous déconnecter`;
        }
        if (userAvatar) userAvatar.innerText = '👤';
        if (userLabel) userLabel.innerText = user.name ? user.name.split(' ')[0] : 'Admin';
        if (map) {
          setTimeout(() => map.invalidateSize(), 150);
        }
      } else {
        // Unauthenticated: Show the login screen!
        if (loginScreen) {
          loginScreen.classList.remove('hidden');
          loginScreen.style.setProperty('display', 'flex', 'important');
        }
        if (userBtn) {
          userBtn.classList.remove('logged-in');
          userBtn.title = 'Non connecté — Authentification requise';
        }
        if (userAvatar) userAvatar.innerText = '🔐';
        if (userLabel) userLabel.innerText = 'Connexion';
      }
    }

    if (userBtn) {
      userBtn.addEventListener('click', () => {
        const token = localStorage.getItem('ins_sig_token');
        if (token) {
          if (confirm('Voulez-vous vous déconnecter de la plateforme INS SIG ?\nVous devrez saisir à nouveau vos identifiants.')) {
            localStorage.removeItem('ins_sig_token');
            localStorage.removeItem('ins_sig_refresh');
            localStorage.removeItem('ins_sig_user');
            updateAuthState();
          }
        } else {
          updateAuthState();
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        const submitBtn = document.getElementById('submitLoginBtn');

        if (!email || !password) return;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>⏳</span> Vérification des identifiants...';
        }
        if (feedback) feedback.style.display = 'none';

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: email, email, password })
          });
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.message || 'Identifiant ou mot de passe incorrect.');
          }

          localStorage.setItem('ins_sig_token', data.accessToken);
          if (data.refreshToken) localStorage.setItem('ins_sig_refresh', data.refreshToken);
          if (data.user) localStorage.setItem('ins_sig_user', JSON.stringify(data.user));

          if (feedback) {
            feedback.className = 'alert-box alert-success';
            feedback.innerText = `Connexion réussie ! Bienvenue, ${data.user.name || data.user.email}. Accès à la plateforme...`;
            feedback.style.display = 'block';
          }

          updateAuthState();
          if (feedback) feedback.style.display = 'none';
        } catch (err) {
          if (feedback) {
            feedback.className = 'alert-box alert-error';
            feedback.innerText = err.message || 'Échec de connexion';
            feedback.style.display = 'block';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>🚀</span> Se connecter à la plateforme';
          }
        }
      });
    }

    // Run on startup
    updateAuthState();
  }

  // ── 9. MOT DE PASSE DU COMPTE ADMINISTRATEUR ───────────────────────────
  function initUserForms() {
    const changeForm = document.getElementById('changePasswordForm');
    const feedback = document.getElementById('usersGlobalFeedback');
    const newPwdInput = document.getElementById('newPasswordInput');
    const strengthLabel = document.getElementById('pwdStrengthLabel');
    const strengthBar = document.getElementById('pwdStrengthBar');

    // 1. Boutons Afficher / Masquer Mot de Passe
    document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            btn.innerText = '🙈';
            btn.title = 'Masquer le mot de passe';
          } else {
            input.type = 'password';
            btn.innerText = '👁️';
            btn.title = 'Afficher le mot de passe';
          }
        }
      });
    });

    // 2. Calcul dynamique de force du mot de passe
    if (newPwdInput && strengthLabel && strengthBar) {
      newPwdInput.addEventListener('input', () => {
        const val = newPwdInput.value;
        if (!val) {
          strengthLabel.innerText = 'À renseigner';
          strengthLabel.style.color = 'var(--text-muted)';
          strengthBar.style.width = '0%';
          strengthBar.style.background = 'var(--text-muted)';
          return;
        }

        let score = 0;
        if (val.length >= 6) score += 1;
        if (val.length >= 8) score += 1;
        if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
        if (/[0-9]/.test(val)) score += 1;
        if (/[^A-Za-z0-9]/.test(val)) score += 1;

        if (score <= 1) {
          strengthLabel.innerText = 'Trop court / Faible';
          strengthLabel.style.color = 'var(--accent-rose)';
          strengthBar.style.width = '25%';
          strengthBar.style.background = 'var(--accent-rose)';
        } else if (score === 2) {
          strengthLabel.innerText = 'Moyen';
          strengthLabel.style.color = 'var(--accent-amber)';
          strengthBar.style.width = '50%';
          strengthBar.style.background = 'var(--accent-amber)';
        } else if (score === 3 || score === 4) {
          strengthLabel.innerText = 'Bon';
          strengthLabel.style.color = 'var(--accent-cyan)';
          strengthBar.style.width = '75%';
          strengthBar.style.background = 'var(--accent-cyan)';
        } else {
          strengthLabel.innerText = 'Excellent / Très Fort';
          strengthLabel.style.color = 'var(--accent-emerald)';
          strengthBar.style.width = '100%';
          strengthBar.style.background = 'var(--accent-emerald)';
        }
      });
    }

    // 3. Soumission du formulaire
    if (changeForm) {
      changeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('oldPasswordInput')?.value;
        const newPassword = document.getElementById('newPasswordInput')?.value;
        const confirmPassword = document.getElementById('confirmPasswordInput')?.value;
        const btn = document.getElementById('btnSubmitChangePassword');
        const token = localStorage.getItem('ins_sig_token');

        if (!token) {
          alert('Veuillez vous connecter pour modifier votre mot de passe.');
          return;
        }

        if (newPassword !== confirmPassword) {
          if (feedback) {
            feedback.className = 'alert-box alert-error';
            feedback.innerText = 'Le nouveau mot de passe et la confirmation ne correspondent pas.';
            feedback.style.display = 'block';
          }
          return;
        }

        if (newPassword.length < 6) {
          if (feedback) {
            feedback.className = 'alert-box alert-error';
            feedback.innerText = 'Le nouveau mot de passe doit comporter au moins 6 caractères.';
            feedback.style.display = 'block';
          }
          return;
        }

        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span>⏳</span> Enregistrement en cours...';
        }

        try {
          const res = await fetch('/api/auth/change-password', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
          });
          const data = await res.json();

          if (!res.ok) throw new Error(data.message || 'Échec de modification');

          if (feedback) {
            feedback.className = 'alert-box alert-success';
            feedback.innerText = data.message || 'Mot de passe administrateur mis à jour avec succès !';
            feedback.style.display = 'block';
          }
          changeForm.reset();
          if (strengthLabel && strengthBar) {
            strengthLabel.innerText = 'À renseigner';
            strengthLabel.style.color = 'var(--text-muted)';
            strengthBar.style.width = '0%';
          }
        } catch (err) {
          if (feedback) {
            feedback.className = 'alert-box alert-error';
            feedback.innerText = `Erreur : ${err.message}`;
            feedback.style.display = 'block';
          }
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>💾</span> Enregistrer le nouveau mot de passe';
          }
        }
      });
    }
  }

  // ── LOGO ERROR FALLBACK ─────────────────────────────────────────────────
  function initLogoFallbacks() {
    document.querySelectorAll('.ins-logo').forEach(img => {
      img.addEventListener('error', function() {
        if (!this.dataset.triedFallback) {
          this.dataset.triedFallback = 'true';
          this.src = 'logo-ins.svg';
        }
      });
    });
  }

  // Initial load
  initTheme();
  initAuth();
  initUserForms();
  initLogoFallbacks();
  initMap();
  setTimeout(() => { if (map) map.invalidateSize(); }, 250);
  checkSystemHealth();
  setInterval(checkSystemHealth, 15000); // Check every 15s
});
