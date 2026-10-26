/* Live campus map (Satellite & Street Views) and zone report list. */
(async function () {
  if (document.body.dataset.page !== 'map') return;

  let data;
  try {
    data = await api('/map');
  } catch (e) {
    toast(e.message);
    return;
  }
  let allItems = [];
  try {
    allItems = (await api('/items')).items;
  } catch (e) { /* list stays empty */ }

  function show(zone) {
    const list = allItems.filter(i => !zone || i.zone === zone);
    $('#zoneTitle').textContent = zone ? `${zone} reports` : 'All active campus reports';
    $('#zoneItems').innerHTML = list.map(i => `<a class="map-report-card" href="item.html?id=${i.id}"><span class="map-report-icon ${esc(i.type)}">${icon(i.category)}</span><span><b>${esc(i.name)}</b><small>⌖ ${esc(i.zone)}</small></span><strong>→</strong></a>`).join('') || '<p class="empty-map-state">No active reports in this zone.</p>';
  }

  const showAll = $('#showAllZones');
  if (showAll) showAll.onclick = () => show();
  show();

  const el = $('#liveCampusMap');
  if (!el) return;
  if (typeof L === 'undefined') {
    el.innerHTML = '<p class="empty-map-state">The map could not load. Reports are listed below.</p>';
    return;
  }

  if (L.Icon && L.Icon.Default) {
    L.Icon.Default.imagePath = '/vendor/leaflet/images/';
  }

  const centerLat = data.center ? data.center.lat : 30.5159;
  const centerLng = data.center ? data.center.lng : 76.6601;

  const map = L.map(el, {
    center: [centerLat, centerLng],
    zoom: 17,
    minZoom: 14,
    maxZoom: 19
  });

  // Layer 1: High-resolution real satellite photography of Chitkara University campus
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; High-Resolution Aerial View'
  });

  // Layer 2: Detailed Campus Street Map (OpenStreetMap Humanitarian - colorful buildings, walkways & roads with NO watermark)
  const streets = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  // Layer 3: Standard OpenStreetMap
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  });

  // Start with Satellite view as default base layer
  satellite.addTo(map);

  // Layer switcher control (top-right)
  const baseLayers = {
    '🛰️ Satellite (Actual Campus)': satellite,
    '🗺️ Campus Map (Streets & Buildings)': streets,
    '🌐 OpenStreetMap Standard': osm
  };
  L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

  // Link UI toolbar buttons to switch layers
  const btnSat = $('#btnSatellite');
  const btnStr = $('#btnStreets');
  if (btnSat && btnStr) {
    btnSat.onclick = () => {
      map.removeLayer(streets);
      map.removeLayer(osm);
      satellite.addTo(map);
      btnSat.classList.add('active');
      btnStr.classList.remove('active');
    };
    btnStr.onclick = () => {
      map.removeLayer(satellite);
      map.removeLayer(osm);
      streets.addTo(map);
      btnStr.classList.add('active');
      btnSat.classList.remove('active');
    };
  }

  // Locate me button
  const btnLocate = $('#btnLocateMe');
  let myLocMarker = null;
  if (btnLocate) {
    btnLocate.onclick = () => {
      if (!navigator.geolocation) {
        toast('Geolocation is not supported by your browser.');
        return;
      }
      btnLocate.textContent = '📍 Locating...';
      navigator.geolocation.getCurrentPosition(
        pos => {
          btnLocate.textContent = '📍 Where am I?';
          const { latitude, longitude, accuracy } = pos.coords;
          if (myLocMarker) map.removeLayer(myLocMarker);
          myLocMarker = L.circleMarker([latitude, longitude], {
            radius: 9,
            fillColor: '#3b82f6',
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9
          }).addTo(map);
          myLocMarker.bindPopup(`<b>You are here!</b><br><small>Accuracy within ${Math.round(accuracy)}m</small>`).openPopup();
          map.setView([latitude, longitude], 18);
        },
        () => {
          btnLocate.textContent = '📍 Where am I?';
          toast('Could not detect location. Please allow location permissions in your browser.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };
  }

  // Zone building icons
  const zoneIcons = {
    'Square One': '☕',
    'Tesla Block': '⚡',
    'Turing Block': '💻',
    'Hostel Area': '🏠',
    'Martin Luther': '📚',
    'Rockfellar': '🔬',
    'Alpha Zone': '🎓',
    'Omega Zone': '🌿',
    'Sportorium': '🏟️',
    'Explotorium': '🚀'
  };

  // Add interactive building zones to map
  data.zones.forEach(z => {
    const total = z.lost + z.found;
    const iconSym = zoneIcons[z.name] || '📍';

    // Zone highlight circle on campus ground
    L.circle([z.lat, z.lng], {
      radius: 35,
      color: total > 0 ? (z.lost > 0 ? '#ea580c' : '#16a34a') : '#3b82f6',
      fillColor: total > 0 ? (z.lost > 0 ? '#f97316' : '#22c55e') : '#60a5fa',
      fillOpacity: 0.22,
      weight: 2
    }).addTo(map);

    // Zone marker badge with total count
    const marker = L.marker([z.lat, z.lng], {
      title: z.name,
      icon: L.divIcon({
        className: 'custom-campus-marker',
        html: `<div class="campus-badge ${total > 0 ? 'has-items' : ''}">
                 <span class="badge-icon">${iconSym}</span>
                 <span class="badge-name">${esc(z.name)}</span>
                 <span class="badge-count">${total}</span>
               </div>`,
        iconSize: [120, 36],
        iconAnchor: [60, 18]
      })
    }).addTo(map);

    const links = z.items.map(i => `<a class="popup-item-link ${i.type}" href="item.html?id=${i.id}">${i.type === 'lost' ? '🔴 Lost' : '🟢 Found'}: <b>${esc(i.name)}</b></a>`).join('');
    
    marker.bindPopup(`
      <div class="campus-popup">
        <div class="popup-header">
          <span class="popup-icon">${iconSym}</span>
          <div>
            <b>${esc(z.name)}</b>
            <small>Chitkara University Campus</small>
          </div>
        </div>
        <div class="popup-stats">
          <span class="stat-found">🟢 ${z.found} Found</span>
          <span class="stat-lost">🔴 ${z.lost} Lost</span>
        </div>
        <div class="popup-items">${links || '<p class="no-items">No active reports in this zone right now.</p>'}</div>
      </div>
    `);

    marker.on('click', () => {
      show(z.name);
      map.setView([z.lat, z.lng], 18, { animate: true });
    });
  });

  // Force map re-layout after rendering to prevent any gray-tile misalignment
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
})();
