/* ==========================================================================
   LOSTLINK LIVE CAMPUS MAP - INTERACTIVE ZONE CONTROLLER
   ========================================================================== */

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
    const res = await api('/items');
    allItems = res.items || [];
  } catch (e) {
    /* empty */
  }

  let activeZone = null;
  const zoneEntries = [];

  // Filter and render reports below the map
  function show(zoneName) {
    const list = allItems.filter(i => !zoneName || i.zone === zoneName);
    const titleEl = $('#zoneTitle');
    if (titleEl) {
      if (zoneName) {
        titleEl.textContent = `📍 ${zoneName} (${list.length} ${list.length === 1 ? 'active report' : 'active reports'})`;
      } else {
        titleEl.textContent = `All active campus reports (${allItems.length})`;
      }
    }

    const itemsContainer = $('#zoneItems');
    if (itemsContainer) {
      if (list.length === 0) {
        itemsContainer.innerHTML = '<p class="empty-map-state">✨ No active reports in this building right now. Everything is clear!</p>';
      } else {
        itemsContainer.innerHTML = list.map(i => `
          <a class="map-report-card" href="item.html?id=${i.id}" title="Click to view report details">
            <span class="map-report-icon ${esc(i.type)}">${icon(i.category)}</span>
            <span>
              <b>${esc(i.name)}</b>
              <small>⌖ ${esc(i.zone)} &middot; ${i.type === 'lost' ? '🔴 Lost' : '🟢 Found'}</small>
            </span>
            <strong>&rarr;</strong>
          </a>
        `).join('');
      }
    }
  }

  // Select/highlight a zone across pins, circles, and reports
  function selectZone(zoneName, panMap = true) {
    activeZone = zoneName;
    show(zoneName);

    zoneEntries.forEach(entry => {
      const isMatch = zoneName && entry.name.toLowerCase() === zoneName.toLowerCase();
      const total = entry.zoneData.lost + entry.zoneData.found;

      // Update Pin element style
      if (entry.pinElement) {
        if (isMatch) {
          entry.pinElement.classList.add('is-selected-pin');
        } else {
          entry.pinElement.classList.remove('is-selected-pin');
        }
      }

      // Update Ground Circle style
      if (entry.circle) {
        if (isMatch) {
          entry.circle.setStyle({
            weight: 3.5,
            fillOpacity: total > 0 ? 0.38 : 0.22,
            dashArray: null,
            color: total > 0 ? '#ea580c' : '#0284c7',
            fillColor: total > 0 ? '#f97316' : '#38bdf8'
          });
        } else {
          entry.circle.setStyle({
            weight: 2,
            fillOpacity: total > 0 ? 0.22 : 0.08,
            dashArray: total > 0 ? '6, 6' : '3, 5',
            color: total > 0 ? (entry.zoneData.lost > 0 ? '#f97316' : '#10b981') : '#64748b',
            fillColor: total > 0 ? (entry.zoneData.lost > 0 ? '#ea580c' : '#059669') : '#334155'
          });
        }
      }

      if (isMatch && panMap && map) {
        map.panTo([entry.zoneData.lat, entry.zoneData.lng], {
          animate: true,
          duration: 0.55
        });
      }
    });
  }

  // Expose globally for interactive popup buttons
  window.selectCampusZone = function (zoneName) {
    selectZone(zoneName, true);
    const resultsEl = document.getElementById('zoneTitle');
    if (resultsEl) {
      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const showAllBtn = $('#showAllZones');
  if (showAllBtn) {
    showAllBtn.onclick = () => selectZone(null, false);
  }

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

  // Layer 1: High-resolution satellite photography
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; High-Resolution Aerial View'
  });

  // Layer 2: Detailed Campus Street Map
  const streets = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc',
    attribution: '&copy; OpenStreetMap contributors'
  });

  // Start with Satellite as default
  satellite.addTo(map);

  // Link UI toolbar buttons
  const btnSat = $('#btnSatellite');
  const btnStr = $('#btnStreets');
  if (btnSat && btnStr) {
    btnSat.onclick = () => {
      map.removeLayer(streets);
      satellite.addTo(map);
      btnSat.classList.add('active');
      btnStr.classList.remove('active');
    };
    btnStr.onclick = () => {
      map.removeLayer(satellite);
      streets.addTo(map);
      btnStr.classList.add('active');
      btnSat.classList.remove('active');
    };
  }

  // Locate Me button
  const btnLocate = $('#btnLocateMe');
  const locateLabel = $('#locateBtnLabel');
  let myLocMarker = null;

  if (btnLocate) {
    btnLocate.onclick = () => {
      if (!navigator.geolocation) {
        toast('Geolocation is not supported by your browser.');
        return;
      }
      if (locateLabel) locateLabel.textContent = 'Locating...';

      navigator.geolocation.getCurrentPosition(
        pos => {
          if (locateLabel) locateLabel.textContent = 'Where am I?';
          const { latitude, longitude, accuracy } = pos.coords;
          if (myLocMarker) map.removeLayer(myLocMarker);

          myLocMarker = L.circleMarker([latitude, longitude], {
            radius: 10,
            fillColor: '#38bdf8',
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.95
          }).addTo(map);

          myLocMarker.bindPopup(`
            <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:6px;">
              <b style="font-size:13px;color:#0f172a;">📍 You are here!</b>
              <p style="font-size:11px;color:#64748b;margin:3px 0 0;">Estimated within ${Math.round(accuracy)} meters</p>
            </div>
          `).openPopup();

          map.setView([latitude, longitude], 18, { animate: true });
        },
        () => {
          if (locateLabel) locateLabel.textContent = 'Where am I?';
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

  // Render enhanced interactive building pins
  data.zones.forEach(z => {
    const total = z.lost + z.found;
    const iconSym = zoneIcons[z.name] || '📍';
    const hasItems = total > 0;
    const typeClass = hasItems ? (z.lost > 0 ? 'type-lost' : 'type-found') : 'is-empty';

    // 1. Soft Campus Architectural Ground Circle
    const circle = L.circle([z.lat, z.lng], {
      radius: 36,
      color: hasItems ? (z.lost > 0 ? '#f97316' : '#10b981') : '#64748b',
      fillColor: hasItems ? (z.lost > 0 ? '#ea580c' : '#059669') : '#334155',
      fillOpacity: hasItems ? 0.22 : 0.08,
      weight: 2,
      dashArray: hasItems ? '6, 6' : '3, 5'
    }).addTo(map);

    // 2. Custom HTML Floating Pin with needle & radar pulse
    const pinId = 'pin-' + z.name.replace(/\s+/g, '-').toLowerCase();
    const pinHtml = `
      <div id="${pinId}" class="campus-pin ${typeClass}" data-zone="${esc(z.name)}">
        ${hasItems ? '<div class="pin-radar-ring"></div>' : ''}
        <div class="pin-body">
          <span class="pin-icon">${iconSym}</span>
          <span class="pin-name">${esc(z.name)}</span>
          <span class="pin-badge">${total}</span>
        </div>
      </div>
    `;

    const marker = L.marker([z.lat, z.lng], {
      title: z.name,
      icon: L.divIcon({
        className: 'campus-pin-anchor',
        html: pinHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      })
    }).addTo(map);

    // 3. Hover Tooltip
    marker.bindTooltip(`
      <div class="pin-tooltip-content">
        <b>${iconSym} ${esc(z.name)}</b>
        <span>${hasItems ? `🔥 ${total} active ${total === 1 ? 'report' : 'reports'}` : '✨ All Clear &middot; No reports'}</span>
      </div>
    `, {
      direction: 'top',
      offset: [0, -42],
      className: 'custom-pin-tooltip',
      opacity: 1
    });

    // 4. Interactive Click Popup
    const itemsHtml = z.items.map(i => `
      <a class="popup-report-link" href="item.html?id=${i.id}">
        <span>${i.type === 'lost' ? '🔴' : '🟢'}</span>
        <b>${esc(i.name)}</b>
      </a>
    `).join('');

    marker.bindPopup(`
      <div class="campus-popup-card">
        <div class="popup-head">
          <span class="popup-icon-badge">${iconSym}</span>
          <div class="popup-title-box">
            <h3>${esc(z.name)}</h3>
            <span class="popup-subtitle">Chitkara University &middot; Rajpura Campus</span>
          </div>
        </div>

        <div class="popup-metrics-bar">
          ${hasItems
            ? `<span class="metric-pill lost-pill">🔴 ${z.lost} Lost</span>
               <span class="metric-pill found-pill">🟢 ${z.found} Found</span>`
            : `<span class="metric-pill clear-pill">✨ All Clear &middot; No Reports</span>`
          }
        </div>

        <div class="popup-item-scroller">
          ${itemsHtml || '<p class="popup-empty-msg">No active lost or found items reported in this building.</p>'}
        </div>

        <button type="button" class="popup-filter-btn" onclick="window.selectCampusZone('${esc(z.name)}')">
          <span>Focus reports below &darr;</span>
        </button>
      </div>
    `, {
      offset: [0, -32],
      maxWidth: 290
    });

    // Keep entry reference for dynamic styling
    zoneEntries.push({
      name: z.name,
      zoneData: z,
      marker,
      circle,
      pinId
    });

    // Wire up events
    marker.on('click', () => {
      selectZone(z.name, false);
    });

    marker.on('mouseover', () => {
      if (activeZone !== z.name) {
        circle.setStyle({
          weight: 3,
          fillOpacity: hasItems ? 0.35 : 0.18,
          dashArray: null
        });
      }
    });

    marker.on('mouseout', () => {
      if (activeZone !== z.name) {
        circle.setStyle({
          weight: 2,
          fillOpacity: hasItems ? 0.22 : 0.08,
          dashArray: hasItems ? '6, 6' : '3, 5'
        });
      }
    });
  });

  // Attach DOM pin references once Leaflet injects them
  setTimeout(() => {
    zoneEntries.forEach(entry => {
      entry.pinElement = document.getElementById(entry.pinId);
    });
  }, 150);

  // Re-calculate map dimensions
  setTimeout(() => {
    map.invalidateSize();
  }, 350);
})();
