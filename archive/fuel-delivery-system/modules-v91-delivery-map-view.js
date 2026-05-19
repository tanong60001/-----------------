/* ════════════════════════════════════════════════════════════════
   V91: DELIVERY MAP VIEW (EMBEDDED PANEL)
   ────────────────────────────────────────────────────────────────
   • Inject large Leaflet map panel ลงในหน้าคิวจัดส่ง (page-delivery)
     แสดงตลอดเวลาที่เปิดหน้า ไม่ใช่ modal แล้ว
   • หมุดร้าน (แดง) + บิลที่มีพิกัด (น้ำเงิน เรียงตามวัน) + คลิก = popup
   • Refresh เมื่อหน้าเปลี่ยน + auto-fit bounds
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmt(v) {
    const n = Number(v || 0);
    try { return typeof formatNum === 'function' ? formatNum(n) : n.toLocaleString('th-TH'); }
    catch (_) { return n.toLocaleString('th-TH'); }
  }

  let mapInstance = null;
  let markersLayer = null;
  let lastLoadAt = 0;

  /* ─────── Inject map panel ─────── */
  function ensureMapPanel() {
    const sec = document.getElementById('page-delivery');
    if (!sec) return;
    if (sec.classList.contains('hidden')) return; // หน้ายังไม่ active
    if (document.getElementById('v91-map-panel')) return; // already added

    // หา container ของ v34 — div ที่ครอบ stats grid
    const container = sec.querySelector('[style*="max-width:1200px"]');
    if (!container) return;

    const panel = document.createElement('div');
    panel.id = 'v91-map-panel';
    panel.style.cssText = 'background:#fff;border-radius:18px;border:1.5px solid #c7d2fe;overflow:hidden;margin-bottom:20px;box-shadow:0 16px 40px rgba(67,56,202,.08)';
    panel.innerHTML = `
      <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:12px 18px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px;color:#fff;font-weight:900">
          <i class="material-icons-round">map</i>
          <span style="font-size:15px">แผนที่งานจัดส่งทั้งหมด</span>
          <span id="v91-map-stats" style="background:rgba(255,255,255,.2);padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:900">โหลด...</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button id="v91-map-refresh" type="button" onclick="window.v91RefreshMap?.()" style="background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:8px;font-family:inherit;font-weight:900;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="material-icons-round" style="font-size:15px">refresh</i> รีเฟรช</button>
          <button id="v91-map-fit" type="button" onclick="window.v91FitMap?.()" style="background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:8px;font-family:inherit;font-weight:900;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="material-icons-round" style="font-size:15px">center_focus_strong</i> ปรับมุมมอง</button>
        </div>
      </div>
      <div id="v91-map" style="height:420px;background:#f1f5f9"></div>
      <div id="v91-legend" style="padding:10px 18px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;gap:18px;flex-wrap:wrap;font-size:12px;font-weight:850;color:#475569">
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:14px;height:14px;background:#dc2626;border-radius:50%;display:inline-block"></span> ร้าน</span>
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:14px;height:14px;background:#2563eb;border-radius:50%;display:inline-block"></span> บิลรอจัดส่ง</span>
        <span style="display:inline-flex;align-items:center;gap:6px;color:#92400e"><i class="material-icons-round" style="font-size:14px">warning</i> <span id="v91-no-pin-count">0</span> บิลยังไม่มีหมุด</span>
        <span style="margin-left:auto;color:#94a3b8">💡 คลิกหมุดเพื่อดูรายละเอียด</span>
      </div>
    `;
    container.insertBefore(panel, container.firstChild);
    initMap();
  }

  function initMap() {
    if (typeof L === 'undefined') {
      const map = document.getElementById('v91-map');
      if (map) map.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">⏳ Leaflet ยังโหลดไม่เสร็จ...</div>';
      setTimeout(initMap, 1000);
      return;
    }
    if (mapInstance) return;
    const mapEl = document.getElementById('v91-map');
    if (!mapEl) return;
    mapInstance = L.map(mapEl, { zoomControl: true }).setView([13.7563, 100.5018], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(mapInstance);
    markersLayer = L.layerGroup().addTo(mapInstance);
    setTimeout(() => mapInstance.invalidateSize(), 200);
    window.v91RefreshMap?.();
  }

  window.v91RefreshMap = async function () {
    if (!mapInstance || !markersLayer) return;
    // debounce — ไม่เรียกซ้ำเกินทุก 5s
    if (Date.now() - lastLoadAt < 5000) return;
    lastLoadAt = Date.now();
    try {
      const [shopRes, billsRes, assignmentsRes] = await Promise.all([
        db.from('shop_config').select('pickup_lat,pickup_lng').eq('id', 1).maybeSingle(),
        db.from('บิลขาย').select('id,bill_no,customer_id,customer_name,delivery_address,delivery_status,delivery_mode,total,delivery_date,delivery_phone,status').order('delivery_date', { ascending: true }).range(0, 499),
        db.from('delivery_assignment').select('bill_id,drop_lat,drop_lng,drop_address,status').range(0, 499),
      ]);

      const shopLat = Number(shopRes?.data?.pickup_lat || localStorage.getItem('sk_pickup_lat') || 0);
      const shopLng = Number(shopRes?.data?.pickup_lng || localStorage.getItem('sk_pickup_lng') || 0);
      const hasShop = Math.abs(shopLat) > 0.001 && Math.abs(shopLng) > 0.001;

      // กรอง: ยกเว้นบิลยกเลิก/คืน, ที่ยังไม่ส่ง, และไม่ใช่ "รับเอง"
      const pendingBills = (billsRes.data || []).filter(b => {
        if (/ยกเลิก|คืนสินค้า/.test(String(b.status || ''))) return false;
        const ds = String(b.delivery_status || '');
        const mode = String(b.delivery_mode || '');
        return ds !== 'จัดส่งสำเร็จ' && mode && mode !== 'รับเอง';
      });

      const assignmentMap = new Map((assignmentsRes.data || []).map(a => [String(a.bill_id), a]));

      // ★ Fallback: ลูกค้าสมัครสมาชิก → ใช้ customer.lat/lng เป็นหมุด
      const customerIds = [...new Set(pendingBills.map(b => b.customer_id).filter(Boolean))];
      let custMap = new Map();
      if (customerIds.length) {
        const { data: customers } = await db.from('customer')
          .select('id,lat,lng,address').in('id', customerIds);
        custMap = new Map((customers || [])
          .filter(c => c.lat && c.lng)
          .map(c => [String(c.id), c]));
      }

      const billsWithPin = [];
      const billsWithoutPin = [];
      pendingBills.forEach(b => {
        let a = assignmentMap.get(String(b.id));
        // ถ้า assignment ไม่มีหมุด ลอง fallback จากลูกค้า
        if ((!a?.drop_lat || !a?.drop_lng) && b.customer_id) {
          const c = custMap.get(String(b.customer_id));
          if (c?.lat && c?.lng) {
            a = { ...(a || {}), drop_lat: c.lat, drop_lng: c.lng, drop_address: (a?.drop_address || c.address || ''), _from_customer: true };
          }
        }
        if (a?.drop_lat && a?.drop_lng) billsWithPin.push({ bill: b, assignment: a });
        else billsWithoutPin.push(b);
      });

      // Update stats
      const statsEl = document.getElementById('v91-map-stats');
      if (statsEl) statsEl.textContent = `${billsWithPin.length} หมุด / ${pendingBills.length} รอส่ง`;
      const noPinEl = document.getElementById('v91-no-pin-count');
      if (noPinEl) noPinEl.textContent = billsWithoutPin.length;

      // Clear & redraw markers
      markersLayer.clearLayers();
      const allMarkers = [];

      if (hasShop) {
        const shopIcon = L.divIcon({
          html: '<div style="width:42px;height:42px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 4px 12px rgba(220,38,38,.5);display:flex;align-items:center;justify-content:center"><i class="material-icons-round" style="color:#fff;font-size:24px">store</i></div>',
          iconSize: [42, 42],
          iconAnchor: [21, 21],
          className: '',
        });
        const m = L.marker([shopLat, shopLng], { icon: shopIcon }).addTo(markersLayer);
        m.bindPopup('<b style="color:#dc2626">🏪 ร้าน</b><br><span style="color:#64748b">จุดต้นทาง</span>');
        allMarkers.push(m);
      }

      billsWithPin.forEach((entry, idx) => {
        const { bill, assignment } = entry;
        const billIcon = L.divIcon({
          html: `<div style="width:36px;height:36px;background:#2563eb;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(37,99,235,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:900;font-family:Prompt,system-ui"><span style="transform:rotate(45deg)">${idx + 1}</span></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          className: '',
        });
        const m = L.marker([assignment.drop_lat, assignment.drop_lng], { icon: billIcon }).addTo(markersLayer);
        const gmapsUrl = hasShop
          ? `https://www.google.com/maps/dir/?api=1&origin=${shopLat},${shopLng}&destination=${assignment.drop_lat},${assignment.drop_lng}&travelmode=driving`
          : `https://www.google.com/maps/search/?api=1&query=${assignment.drop_lat},${assignment.drop_lng}`;
        m.bindPopup(`
          <div style="min-width:220px;font-family:Prompt,system-ui">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="background:#2563eb;color:#fff;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:900">#${esc(bill.bill_no || idx + 1)}</span>
              <b style="color:#0f172a;font-size:14px">${esc(bill.customer_name || '-')}</b>
            </div>
            <div style="font-size:12.5px;color:#475569;margin-bottom:3px"><b>💰</b> ฿${fmt(bill.total)}</div>
            ${bill.delivery_phone ? `<div style="font-size:12.5px;color:#475569;margin-bottom:3px"><b>📱</b> ${esc(bill.delivery_phone)}</div>` : ''}
            ${assignment.drop_address ? `<div style="font-size:12px;color:#64748b;margin-bottom:8px;line-height:1.4">${esc(assignment.drop_address)}</div>` : ''}
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <a href="${gmapsUrl}" target="_blank" rel="noopener" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;background:#10b981;color:#fff;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:900;text-decoration:none">
                <i class="material-icons-round" style="font-size:14px">map</i> Google Maps
              </a>
              <button type="button" onclick="window.v12DQMarkDone?.('${esc(bill.id)}')" style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:7px 10px;font-family:inherit;font-weight:900;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px">
                <i class="material-icons-round" style="font-size:14px">check_circle</i> ส่งสำเร็จ
              </button>
            </div>
          </div>
        `);
        allMarkers.push(m);
      });

      window.__v91Markers = allMarkers;
      // Auto-fit on first load
      if (allMarkers.length > 1) {
        const group = L.featureGroup(allMarkers);
        mapInstance.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 16 });
      } else if (allMarkers.length === 1) {
        mapInstance.setView(allMarkers[0].getLatLng(), 14);
      }
      setTimeout(() => mapInstance.invalidateSize(), 100);
    } catch (e) {
      console.error('[v91] refresh map failed:', e);
      const statsEl = document.getElementById('v91-map-stats');
      if (statsEl) statsEl.textContent = 'โหลดข้อมูลไม่สำเร็จ';
    }
  };

  window.v91FitMap = function () {
    const markers = window.__v91Markers || [];
    if (!mapInstance || markers.length === 0) return;
    if (markers.length > 1) {
      const group = L.featureGroup(markers);
      mapInstance.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 16 });
    } else {
      mapInstance.setView(markers[0].getLatLng(), 14);
    }
  };

  /* ─────── Boot ─────── */
  function attachObserver() {
    const sec = document.getElementById('page-delivery');
    if (!sec || sec.__v91Observing) return;
    sec.__v91Observing = true;
    const obs = new MutationObserver(() => {
      if (!sec.classList.contains('hidden')) {
        ensureMapPanel();
        // refresh เมื่อ page-delivery render ใหม่
        if (mapInstance) setTimeout(() => window.v91RefreshMap?.(), 300);
      }
    });
    obs.observe(sec, { childList: true, subtree: false });
    obs.observe(sec, { attributes: true, attributeFilter: ['class'] });
    if (!sec.classList.contains('hidden')) ensureMapPanel();
  }
  setTimeout(attachObserver, 1500);
  setTimeout(attachObserver, 4000);

  console.log('[v91] delivery map view (embedded) loaded');
})();
