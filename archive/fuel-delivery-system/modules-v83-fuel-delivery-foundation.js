(function () {
  'use strict';

  const TABLES = {
    vehicle: 'vehicle',
    tank: 'fuel_tank',
    refill: 'fuel_tank_refill',
    dispense: 'fuel_dispense',
    externalRefill: 'vehicle_external_refill',
    delivery: 'delivery_assignment',
    trip: 'vehicle_trip',
    odometer: 'vehicle_odometer_log',
    dailySummary: 'vw_vehicle_daily_summary',
  };

  const num = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => {
    try { return typeof formatNum === 'function' ? formatNum(value) : num(value).toLocaleString('th-TH'); }
    catch (_) { return num(value).toLocaleString('th-TH'); }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
  const js = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const staff = () => {
    try { return USER?.username || localStorage.getItem('current_staff_name') || 'system'; }
    catch (_) { return 'system'; }
  };
  const todayKey = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const thDate = value => {
    if (!value) return '-';
    try { return new Date(value).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return String(value); }
  };

  let _injectedStyle = false;
  function injectStyle() {
    if (_injectedStyle || document.getElementById('v83-fuel-foundation-style')) { _injectedStyle = true; return; }
    _injectedStyle = true;
    const style = document.createElement('style');
    style.id = 'v83-fuel-foundation-style';
    style.textContent = `
      .fuel-page{width:min(100%,1500px);margin:0 auto;display:flex;flex-direction:column;gap:16px}
      .fuel-hero{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 14px 34px rgba(15,23,42,.05)}
      .fuel-title{display:flex;align-items:center;gap:14px}.fuel-title .ico{width:50px;height:50px;border-radius:10px;background:#eff6ff;color:#2563eb;display:grid;place-items:center}.fuel-title .ico i{font-size:30px}
      .fuel-title h2{margin:0;font-size:25px;font-weight:950;color:#0f172a}.fuel-title p{margin:3px 0 0;color:#64748b;font-size:13px;font-weight:750}
      .fuel-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .fuel-btn{border:0;border-radius:8px;height:42px;padding:0 14px;display:inline-flex;align-items:center;gap:7px;font-family:inherit;font-weight:900;cursor:pointer;background:#0f172a;color:#fff}
      .fuel-btn.secondary{background:#fff;color:#334155;border:1px solid #cbd5e1}.fuel-btn.good{background:#16a34a}.fuel-btn.warn{background:#f59e0b}.fuel-btn.danger{background:#dc2626}
      .fuel-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.fuel-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
      .fuel-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 12px 28px rgba(15,23,42,.045);overflow:hidden;min-width:0}
      .fuel-card-head{padding:15px 18px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:10px}
      .fuel-card-head h3{margin:0;font-size:16px;font-weight:950;color:#0f172a;display:flex;align-items:center;gap:8px}.fuel-card-body{padding:16px 18px}
      .fuel-table{width:100%;border-collapse:collapse}.fuel-table th{font-size:12px;color:#475569;background:#f8fafc;text-align:left;padding:11px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.fuel-table td{padding:12px 11px;border-bottom:1px solid #f1f5f9;color:#0f172a;vertical-align:middle}.fuel-table tr:hover td{background:#f8fafc}
      .fuel-pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900;background:#eef2ff;color:#3730a3}.fuel-pill.good{background:#dcfce7;color:#166534}.fuel-pill.warn{background:#fef3c7;color:#92400e}.fuel-pill.bad{background:#fee2e2;color:#991b1b}.fuel-pill.gray{background:#f1f5f9;color:#475569}
      .fuel-empty{padding:34px;text-align:center;color:#64748b;font-weight:850}.fuel-empty i{font-size:42px;color:#cbd5e1;display:block;margin-bottom:7px}
      .fuel-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;display:flex;gap:12px;align-items:center}.fuel-kpi .dot{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;color:#fff;background:#2563eb}.fuel-kpi b{font-size:24px;color:#0f172a}.fuel-kpi span{display:block;color:#64748b;font-size:12px;font-weight:850;margin-top:2px}
      .fuel-form{display:grid;gap:10px}.fuel-form.two{grid-template-columns:repeat(2,minmax(0,1fr))}.fuel-field label{display:block;font-size:12px;font-weight:900;color:#475569;margin-bottom:5px}.fuel-field input,.fuel-field select,.fuel-field textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:10px 11px;font-family:inherit;font-weight:750;color:#0f172a;background:#fff}.fuel-field textarea{min-height:74px;resize:vertical}.fuel-field.full{grid-column:1/-1}
      .fuel-schema-warn{border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:10px;padding:14px 16px;font-weight:850;line-height:1.65}
      @media(max-width:920px){.fuel-hero{display:grid}.fuel-grid,.fuel-grid.three,.fuel-form.two{grid-template-columns:1fr}.fuel-actions{justify-content:flex-start}.fuel-table{min-width:760px}.fuel-card{overflow:auto}}
    `;
    document.head.appendChild(style);
  }

  async function tableExists(table) {
    try {
      // head:true ไม่ดึง row จริง + count exact ก็ skip — ประหยัด egress
      const { error } = await db.from(table).select('id', { head: true, count: 'estimated' }).limit(0);
      return !error;
    } catch (_) {
      return false;
    }
  }

  async function schemaStatus() {
    const names = [TABLES.vehicle, TABLES.tank, TABLES.dispense, TABLES.delivery, TABLES.trip, TABLES.odometer];
    const checks = await Promise.all(names.map(async name => ({ name, ok: await tableExists(name) })));
    return { checks, ready: checks.every(x => x.ok), missing: checks.filter(x => !x.ok).map(x => x.name) };
  }

  function schemaWarning(missing) {
    return `<div class="fuel-schema-warn">
      <div style="font-size:15px;font-weight:950;margin-bottom:4px">ยังไม่ได้ติดตั้งฐานข้อมูลระบบรถ/น้ำมัน</div>
      <div>กรุณารันไฟล์ <b>migrations/fuel_delivery_schema.sql</b> ใน Supabase SQL Editor ก่อนใช้งานจริง</div>
      ${missing?.length ? `<div style="margin-top:6px">ตารางที่ยังไม่พบ: ${missing.map(esc).join(', ')}</div>` : ''}
    </div>`;
  }

  function pageShell(icon, title, subtitle, actions = '') {
    injectStyle();
    return `<div class="fuel-page">
      <div class="fuel-hero">
        <div class="fuel-title"><div class="ico"><i class="material-icons-round">${icon}</i></div><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div></div>
        ${actions ? `<div class="fuel-actions">${actions}</div>` : ''}
      </div>
    </div>`;
  }

  window.SK_FUEL = {
    TABLES, num, fmt, esc, js, staff, todayKey, thDate,
    injectStyle, schemaStatus, schemaWarning, pageShell,
    async select(table, columns = '*', options = {}) {
      let q = db.from(table).select(columns);
      if (options.order) q = q.order(options.order, { ascending: options.ascending ?? true });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  };

  window.v83OpenFuelSettings = async function () {
    try {
      const { data } = await db.from('shop_config').select('*').eq('id', 1).maybeSingle();
      const rawLat = num(data?.pickup_lat ?? localStorage.getItem('sk_pickup_lat'));
      const rawLng = num(data?.pickup_lng ?? localStorage.getItem('sk_pickup_lng'));
      const validCoord = (lat, lng) => lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && lat !== 0 && lng !== 0;
      const initLat = validCoord(rawLat, rawLng) ? rawLat : 13.7563;
      const initLng = validCoord(rawLat, rawLng) ? rawLng : 100.5018;
      let pickedLat = initLat, pickedLng = initLng, map = null, marker = null, searchTimer = null;
      const r = await Swal.fire({
        title: 'ตั้งค่าร้าน / แผนที่จัดส่ง',
        width: 1120,
        customClass: { popup: 'v83-map-settings-popup' },
        html: `<style>
          .v83-map-settings-popup{border-radius:18px!important;padding:0!important;overflow:hidden!important}
          .v83-map-settings-popup .swal2-title{font-size:28px!important;padding:24px 26px 6px!important;text-align:left!important;color:#0f172a!important}
          .v83-map-settings-popup .swal2-html-container{margin:0!important;padding:0 26px 8px!important;overflow:visible!important}
          .v83-map-settings{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(320px,.7fr);gap:18px;text-align:left}
          .v83-map-panel,.v83-setting-panel{border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 14px 35px rgba(15,23,42,.06);overflow:hidden}
          .v83-map-head{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
          .v83-search{display:flex;align-items:center;gap:8px;min-width:0;flex:1;background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;height:44px}
          .v83-search i{color:#64748b}.v83-search input{border:0;outline:0;width:100%;font-family:inherit;font-weight:800;color:#0f172a}
          .v83-map-tools{display:flex;gap:8px;flex-wrap:wrap}.v83-mini-btn{height:42px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-family:inherit;font-weight:900;padding:0 12px;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
          .v83-mini-btn.primary{background:#0f172a;color:#fff;border-color:#0f172a}
          #v83-shop-map{height:430px;background:#e2e8f0}.v83-coord-strip{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#475569;font-size:12px;font-weight:900}
          #v83-search-results{display:none;border-top:1px solid #e2e8f0;max-height:190px;overflow:auto}.v83-result{width:100%;text-align:left;border:0;border-bottom:1px solid #f1f5f9;background:#fff;padding:10px 12px;font-family:inherit;color:#0f172a;font-weight:850;cursor:pointer}.v83-result:hover{background:#eff6ff}
          .v83-setting-panel{padding:14px}.v83-setting-panel h3{font-size:16px;margin:0 0 12px;color:#0f172a;font-weight:950;display:flex;align-items:center;gap:8px}
          .v83-setting-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.v83-setting-field.full{grid-column:1/-1}.v83-setting-field label{display:block;font-size:12px;font-weight:950;color:#475569;margin-bottom:5px}
          .v83-setting-field input,.v83-setting-field select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;font-family:inherit;font-size:14px;font-weight:850;color:#0f172a;background:#fff}
          .v83-note{margin-top:12px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:10px 12px;font-size:12px;font-weight:850;line-height:1.55}
          .v83-map-settings-popup.v83-fullscreen{width:calc(100vw - 30px)!important;max-width:none!important;height:calc(100vh - 30px)!important}
          .v83-map-settings-popup.v83-fullscreen .swal2-html-container{height:calc(100vh - 142px)!important}
          .v83-map-settings-popup.v83-fullscreen .v83-map-settings{height:100%;grid-template-columns:minmax(0,1fr) 360px}.v83-map-settings-popup.v83-fullscreen .v83-map-panel{display:flex;flex-direction:column}.v83-map-settings-popup.v83-fullscreen #v83-shop-map{height:auto;flex:1;min-height:540px}
          @media(max-width:900px){.v83-map-settings{grid-template-columns:1fr}.v83-map-head{display:grid}.v83-map-tools{justify-content:stretch}.v83-mini-btn{flex:1;justify-content:center}#v83-shop-map{height:360px}.v83-setting-grid{grid-template-columns:1fr}}
        </style>
        <div class="v83-map-settings">
          <div class="v83-map-panel">
            <div class="v83-map-head">
              <div class="v83-search"><i class="material-icons-round">search</i><input id="v83-map-search" placeholder="ค้นหาชื่อร้าน ถนน ตำบล อำเภอ จังหวัด..."></div>
              <div class="v83-map-tools">
                <button type="button" id="v83-use-current" class="v83-mini-btn"><i class="material-icons-round">my_location</i> ตำแหน่งฉัน</button>
                <button type="button" id="v83-full-map" class="v83-mini-btn primary"><i class="material-icons-round">open_in_full</i> ขยายแผนที่</button>
              </div>
            </div>
            <div id="v83-shop-map"></div>
            <div id="v83-search-results"></div>
            <div class="v83-coord-strip"><span id="v83-coord-info"></span><span>คลิกบนแผนที่หรือลากหมุดเพื่อกำหนดที่ตั้งร้าน</span></div>
          </div>
          <div class="v83-setting-panel">
            <h3><i class="material-icons-round">tune</i> ค่าระบบจัดส่ง</h3>
            <div class="v83-setting-grid">
              <div class="v83-setting-field"><label>Lat</label><input id="v83-pickup-lat" type="number" step="0.0000001" value="${esc(initLat)}"></div>
              <div class="v83-setting-field"><label>Lng</label><input id="v83-pickup-lng" type="number" step="0.0000001" value="${esc(initLng)}"></div>
              <div class="v83-setting-field full"><label>ตัวคูณระยะประมาณ</label><input id="v83-mult" type="number" step="0.01" value="${esc(data?.distance_multiplier ?? 1.3)}"></div>
              <div class="v83-setting-field full"><label>Routing service</label><select id="v83-routing"><option value="osrm_demo">OSRM demo (ฟรี)</option><option value="none">ไม่ใช้ routing</option></select></div>
              <div class="v83-setting-field"><label>Fuel excess ratio</label><input id="v83-fuel-ratio" type="number" step="0.01" value="${esc(data?.fuel_excess_ratio ?? 1.5)}"></div>
              <div class="v83-setting-field"><label>Pin too close (เมตร)</label><input id="v83-pin-close" type="number" step="1" value="${esc(data?.pin_too_close_meters ?? 500)}"></div>
            </div>
            <div class="v83-note">ถ้าพิกัดเดิมผิด ระบบจะเริ่มที่กรุงเทพฯ ก่อน ให้ค้นหาหรือกดตำแหน่งฉัน แล้วลากหมุดให้ตรงหน้าร้าน</div>
          </div>
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'บันทึกตั้งค่า',
        cancelButtonText: 'ยกเลิก',
        didOpen: () => {
          const sel = document.getElementById('v83-routing');
          if (sel) sel.value = data?.routing_service || 'osrm_demo';
          const info = document.getElementById('v83-coord-info');
          const setStatus = text => { const box = document.getElementById('v83-search-results'); if (box) { box.style.display = 'block'; box.innerHTML = `<div class="v83-result" style="cursor:default;color:#64748b">${esc(text)}</div>`; } };
          const updateInfo = () => { if (info) info.innerHTML = `<i class="material-icons-round" style="font-size:15px;vertical-align:-3px;color:#2563eb">place</i> ${pickedLat.toFixed(6)}, ${pickedLng.toFixed(6)}`; };
          const setFromLatLng = (lat, lng, zoom = null) => {
            if (!validCoord(lat, lng)) return;
            pickedLat = lat; pickedLng = lng;
            document.getElementById('v83-pickup-lat').value = lat.toFixed(7);
            document.getElementById('v83-pickup-lng').value = lng.toFixed(7);
            marker?.setLatLng([lat, lng]);
            if (map) map.setView([lat, lng], zoom || map.getZoom());
            updateInfo();
          };
          updateInfo();
          if (typeof L === 'undefined') {
            const c = document.getElementById('v83-shop-map');
            if (c) c.innerHTML = '<div style="padding:34px;text-align:center;color:#64748b;font-weight:900">โหลด Leaflet ไม่สำเร็จ ใช้ช่อง Lat/Lng ด้านขวาแทน</div>';
            return;
          }
          map = L.map('v83-shop-map', { zoomControl: true }).setView([initLat, initLng], 15);
          const standard = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
          const voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '&copy; OpenStreetMap &copy; CARTO' });
          L.control.layers({ 'แผนที่ละเอียด': standard, 'แผนที่อ่านง่าย': voyager }, null, { position: 'topright' }).addTo(map);
          marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
          marker.bindPopup('ที่ตั้งร้าน').openPopup();
          marker.on('dragend', () => { const p = marker.getLatLng(); setFromLatLng(p.lat, p.lng); });
          map.on('click', e => setFromLatLng(e.latlng.lat, e.latlng.lng));
          ['v83-pickup-lat', 'v83-pickup-lng'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
              const la = num(document.getElementById('v83-pickup-lat').value);
              const ln = num(document.getElementById('v83-pickup-lng').value);
              if (validCoord(la, ln)) setFromLatLng(la, ln, 16);
            });
          });
          document.getElementById('v83-full-map')?.addEventListener('click', () => {
            Swal.getPopup()?.classList.toggle('v83-fullscreen');
            setTimeout(() => map.invalidateSize(), 220);
          });
          document.getElementById('v83-use-current')?.addEventListener('click', () => {
            if (!navigator.geolocation) return setStatus('เบราว์เซอร์นี้ไม่รองรับการอ่านตำแหน่ง');
            setStatus('กำลังอ่านตำแหน่งปัจจุบัน...');
            navigator.geolocation.getCurrentPosition(pos => {
              setFromLatLng(pos.coords.latitude, pos.coords.longitude, 17);
              const box = document.getElementById('v83-search-results'); if (box) box.style.display = 'none';
            }, () => setStatus('อ่านตำแหน่งไม่ได้ กรุณาอนุญาต Location หรือค้นหาด้วยชื่อสถานที่'), { enableHighAccuracy: true, timeout: 9000 });
          });
          document.getElementById('v83-map-search')?.addEventListener('input', ev => {
            clearTimeout(searchTimer);
            const q = ev.target.value.trim();
            const box = document.getElementById('v83-search-results');
            if (!q) { if (box) box.style.display = 'none'; return; }
            searchTimer = setTimeout(async () => {
              try {
                setStatus('กำลังค้นหาสถานที่...');
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=th&q=${encodeURIComponent(q)}`);
                const rows = await res.json();
                if (!rows?.length) return setStatus('ไม่พบสถานที่ ลองเพิ่มชื่ออำเภอหรือจังหวัด');
                box.style.display = 'block';
                box.innerHTML = rows.map((row, idx) => `<button type="button" class="v83-result" data-idx="${idx}">${esc(row.display_name)}</button>`).join('');
                box.querySelectorAll('.v83-result').forEach(btn => btn.addEventListener('click', () => {
                  const row = rows[Number(btn.dataset.idx)];
                  setFromLatLng(Number(row.lat), Number(row.lon), 17);
                  box.style.display = 'none';
                }));
              } catch (_) {
                setStatus('ค้นหาออนไลน์ไม่ได้ตอนนี้ แต่ยังคลิกเลือกบนแผนที่ได้');
              }
            }, 450);
          });
          setTimeout(() => map.invalidateSize(), 240);
        },
        preConfirm: () => {
          const pickup_lat = num(document.getElementById('v83-pickup-lat')?.value);
          const pickup_lng = num(document.getElementById('v83-pickup-lng')?.value);
          if (!validCoord(pickup_lat, pickup_lng)) return Swal.showValidationMessage('กรุณาเลือกพิกัดร้านให้ถูกต้อง');
          return {
            id: 1,
            pickup_lat,
            pickup_lng,
            distance_multiplier: num(document.getElementById('v83-mult')?.value) || 1.3,
            routing_service: document.getElementById('v83-routing')?.value || 'osrm_demo',
            fuel_excess_ratio: num(document.getElementById('v83-fuel-ratio')?.value) || 1.5,
            pin_too_close_meters: Math.round(num(document.getElementById('v83-pin-close')?.value) || 500),
            updated_at: new Date().toISOString(),
          };
        },
      });
      if (!r.isConfirmed) return;
      const { error } = await db.from('shop_config').upsert(r.value, { onConflict: 'id' });
      if (error) throw error;
      localStorage.setItem('sk_pickup_lat', r.value.pickup_lat);
      localStorage.setItem('sk_pickup_lng', r.value.pickup_lng);
      toast?.('บันทึกตั้งค่ารถ/น้ำมันแล้ว', 'success');
    } catch (error) {
      toast?.('บันทึกตั้งค่าไม่สำเร็จ: ' + (error.message || error), 'error');
    }
  };

  function ensureFuelAdminCard() {
      try {
        const grid = document.querySelector('#page-admin .v36-admin-menu-grid');
        if (grid && !document.getElementById('v83-admin-fuel-card')) {
          grid.insertAdjacentHTML('beforeend', `
            <button id="v83-admin-fuel-card" type="button" class="v36-admin-menu-card" onclick="v83OpenFuelSettings()">
              <span class="v36-admin-menu-icon" style="background:#0f766e18;color:#0f766e"><i class="material-icons-round">local_shipping</i></span>
              <span class="v36-admin-menu-text">
                <span class="v36-admin-menu-title">น้ำมัน / รถ / จัดส่ง</span>
                <span class="v36-admin-menu-desc">พิกัดร้าน ตัวคูณระยะทาง routing และ threshold ตรวจความผิดปกติ</span>
              </span>
              <i class="material-icons-round v36-admin-menu-arrow">chevron_right</i>
            </button>`);
        }
        const classicGrid = document.querySelector('#page-admin > div > div[style*="grid-template-columns"]');
        if (classicGrid && !document.getElementById('v83-admin-fuel-classic')) {
          classicGrid.insertAdjacentHTML('beforeend', `
            <div id="v83-admin-fuel-classic" style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
              <h3 style="font-size:15px;font-weight:600;margin-bottom:10px;"><i class="material-icons-round" style="vertical-align:middle;font-size:18px;">local_shipping</i> น้ำมัน / รถ / จัดส่ง</h3>
              <p style="color:var(--text-secondary);font-size:13px;margin:0 0 14px;">ตั้งค่าพิกัดร้าน routing และ threshold ตรวจความผิดปกติ</p>
              <button class="btn btn-primary" onclick="v83OpenFuelSettings()" style="width:100%;"><i class="material-icons-round">settings</i> เปิดตั้งค่า</button>
            </div>`);
        }
      } catch (error) {
        console.warn('[v83] admin fuel card skipped:', error);
      }
  }

  function patchAdminMenu() {
    const original = window.renderAdmin;
    if (typeof original !== 'function' || original.__v83FuelAdmin) return;
    const wrapped = async function (...args) {
      const result = await original.apply(this, args);
      ensureFuelAdminCard();
      return result;
    };
    Object.defineProperty(wrapped, '__v83FuelAdmin', { value: true });
    window.renderAdmin = wrapped;
    try { renderAdmin = wrapped; } catch (_) {}
    ensureFuelAdminCard();
  }

  patchAdminMenu();
  window.addEventListener('load', () => {
    setTimeout(patchAdminMenu, 800);
    setTimeout(ensureFuelAdminCard, 1200);
  });
  // observe เฉพาะหน้า admin (ลด CPU จาก observe ทั้ง document)
  function attachAdminObserver() {
    const adminPage = document.getElementById('page-admin');
    if (!adminPage || adminPage.__v83Observing) return;
    adminPage.__v83Observing = true;
    new MutationObserver(() => ensureFuelAdminCard()).observe(adminPage, { childList: true, subtree: false });
  }
  setTimeout(attachAdminObserver, 1500);
  setTimeout(attachAdminObserver, 4000);

  console.log('[v83] fuel/delivery foundation loaded');
})();
