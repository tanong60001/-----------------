/* ════════════════════════════════════════════════════════════════
   V90: DELIVERY ↔ VEHICLE BRIDGE
   ────────────────────────────────────────────────────────────────
   • Wrap window.v12DQMarkDone — เพิ่มขั้นตอน "เลือกรถ + ระยะ" ก่อน
   • ส่ง routing ผ่าน sk_complete_delivery RPC หลังบันทึก
   • Auto-create delivery_assignment ถ้าบิลยังไม่มี
   • Polish SweetAlert design สำหรับ fuel/vehicle ทั้งระบบ
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────── SHARED CSS POLISH ─────── */
  function injectPolishStyles() {
    if (document.getElementById('v90-polish-style')) return;
    const css = `
      /* SweetAlert popups — ระบบรถ/น้ำมัน */
      .swal2-popup.sk-fuel-popup {
        border-radius: 20px !important;
        padding: 28px 26px 24px !important;
        box-shadow: 0 30px 90px rgba(15,23,42,.22) !important;
        font-family: Prompt, Inter, system-ui, sans-serif !important;
      }
      .swal2-popup.sk-fuel-popup .swal2-title {
        font-size: 22px !important;
        font-weight: 950 !important;
        color: #0f172a !important;
        margin-bottom: 6px !important;
      }
      .swal2-popup.sk-fuel-popup .swal2-html-container {
        font-size: 14px !important;
        color: #475569 !important;
        margin: 14px 0 18px !important;
        text-align: left !important;
      }
      .swal2-popup.sk-fuel-popup .swal2-actions {
        gap: 10px !important;
        margin-top: 18px !important;
      }
      .swal2-popup.sk-fuel-popup .swal2-styled {
        height: 46px !important;
        border-radius: 11px !important;
        font-weight: 900 !important;
        font-size: 14px !important;
        padding: 0 22px !important;
        box-shadow: 0 6px 18px rgba(15,23,42,.10) !important;
      }
      .swal2-popup.sk-fuel-popup .swal2-confirm { background: #16a34a !important; }
      .swal2-popup.sk-fuel-popup .swal2-cancel  { background: #fff !important; color: #475569 !important; border: 1.5px solid #cbd5e1 !important; }
      .swal2-popup.sk-fuel-popup .swal2-deny    { background: #f59e0b !important; }

      /* Form inputs — ใช้ภายใน html ของ Swal */
      .sk-fuel-form { display: grid; gap: 14px; text-align: left; }
      .sk-fuel-form.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sk-fuel-fld { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .sk-fuel-fld.full { grid-column: 1 / -1; }
      .sk-fuel-fld label {
        font-size: 12px; font-weight: 900; color: #475569;
        display: flex; align-items: center; gap: 5px;
        text-transform: none;
      }
      .sk-fuel-fld label i { font-size: 16px; color: #94a3b8; }
      .sk-fuel-fld input, .sk-fuel-fld select, .sk-fuel-fld textarea {
        width: 100%; box-sizing: border-box;
        border: 1.5px solid #cbd5e1; border-radius: 11px;
        padding: 11px 13px; font-family: inherit; font-weight: 750;
        font-size: 14px; color: #0f172a; background: #fff;
        transition: border-color .15s, box-shadow .15s;
      }
      .sk-fuel-fld input:focus, .sk-fuel-fld select:focus, .sk-fuel-fld textarea:focus {
        outline: none; border-color: #16a34a;
        box-shadow: 0 0 0 3px rgba(22,163,74,.15);
      }
      .sk-fuel-fld textarea { min-height: 72px; resize: vertical; }

      /* Bill summary header ใน Swal */
      .sk-bill-summary {
        background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%);
        border: 1.5px solid #86efac;
        border-radius: 14px;
        padding: 14px 16px;
        display: grid; gap: 6px;
        margin-bottom: 14px;
      }
      .sk-bill-summary .row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; font-weight: 850; color: #064e3b; }
      .sk-bill-summary .row b { color: #047857; }
      .sk-bill-summary .total { font-size: 16px; font-weight: 950; color: #064e3b; border-top: 1.5px dashed #86efac; padding-top: 8px; margin-top: 4px; }

      /* Vehicle picker cards */
      .sk-veh-grid {
        display: grid; gap: 10px;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        max-height: 220px; overflow-y: auto; padding: 4px;
      }
      .sk-veh-card {
        position: relative;
        border: 2px solid #e2e8f0; background: #fff;
        border-radius: 14px; padding: 12px 12px 12px 14px;
        cursor: pointer; transition: all .15s;
        display: flex; flex-direction: column; gap: 4px;
        min-height: 86px;
      }
      .sk-veh-card:hover { border-color: #94a3b8; transform: translateY(-1px); }
      .sk-veh-card.selected {
        border-color: #16a34a;
        background: #f0fdf4;
        box-shadow: 0 0 0 3px rgba(22,163,74,.15);
      }
      .sk-veh-card .veh-name { font-size: 14px; font-weight: 900; color: #0f172a; line-height: 1.2; }
      .sk-veh-card .veh-plate { font-size: 11px; font-weight: 800; color: #64748b; }
      .sk-veh-card .veh-meta { font-size: 11px; font-weight: 800; color: #94a3b8; margin-top: 4px; }
      .sk-veh-card .veh-check {
        position: absolute; top: 8px; right: 8px;
        width: 22px; height: 22px; border-radius: 50%;
        background: #16a34a; color: #fff;
        display: none; align-items: center; justify-content: center;
        font-size: 14px;
      }
      .sk-veh-card.selected .veh-check { display: inline-flex; }

      /* Hint / info banners */
      .sk-info-banner {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px; border-radius: 11px;
        background: #eff6ff; border: 1px solid #bfdbfe;
        color: #1e40af; font-size: 12.5px; font-weight: 850;
      }
      .sk-info-banner i { color: #2563eb; font-size: 18px; }
      .sk-info-banner.warn { background: #fffbeb; border-color: #fde68a; color: #92400e; }
      .sk-info-banner.warn i { color: #f59e0b; }

      /* responsive */
      @media (max-width: 600px) {
        .sk-fuel-form.two { grid-template-columns: 1fr !important; }
        .sk-veh-grid { grid-template-columns: 1fr !important; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'v90-polish-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ─────── HELPERS ─────── */
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  async function fetchRouteDistance(pickup, drop, fallbackKm) {
    const hasPickup = Math.abs(pickup?.lat || 0) > 0.001 && Math.abs(pickup?.lng || 0) > 0.001;
    const hasDrop = Math.abs(drop?.lat || 0) > 0.001 && Math.abs(drop?.lng || 0) > 0.001;
    if (!hasPickup || !hasDrop) {
      return { distance_km: Number(fallbackKm || 0), route_source: 'manual' };
    }
    const fallback = Math.max(0, haversineKm(pickup.lat, pickup.lng, drop.lat, drop.lng) * 1.3);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=false`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      const json = await res.json();
      const route = json?.routes?.[0];
      if (route?.distance) return { distance_km: route.distance / 1000, route_source: 'osrm' };
    } catch (_) {}
    return { distance_km: fallback || Number(fallbackKm || 0), route_source: 'haversine_fallback' };
  }

  function fmt(v) {
    const n = Number(v || 0);
    try { return typeof formatNum === 'function' ? formatNum(n) : n.toLocaleString('th-TH'); }
    catch (_) { return n.toLocaleString('th-TH'); }
  }

  /* ─────── AUTO-DEDUCT FUEL จากถังร้าน (ไป-กลับ) ─────── */
  async function autoDeductFuelForBill({ billId, vehicleId, vehicleKmpl, distanceKm, note }) {
    try {
      if (!vehicleId || !distanceKm || distanceKm <= 0) return null;
      // หา vehicle เพื่อรู้ fuel_type
      const { data: veh } = await db.from('vehicle').select('id,fuel_type,avg_kmpl').eq('id', vehicleId).maybeSingle();
      if (!veh) return null;
      const kmpl = Number(vehicleKmpl || veh.avg_kmpl || 0);
      if (kmpl <= 0) {
        toast?.('รถยังไม่มีค่า km/L — ข้ามการหักน้ำมัน', 'warning');
        return null;
      }
      const fuelL = Math.round((distanceKm * 2 / kmpl) * 100) / 100;
      if (fuelL <= 0) return null;

      // หาถังที่ตรง fuel_type + คงเหลือมากสุด
      const { data: tanks } = await db.from('fuel_tank')
        .select('id,name,current_level_l,fuel_type,active')
        .eq('fuel_type', veh.fuel_type)
        .eq('active', true)
        .order('current_level_l', { ascending: false })
        .limit(1);
      const tank = tanks?.[0];
      if (!tank) {
        toast?.(`ไม่มีถัง${veh.fuel_type} ในระบบ — ข้ามการหักน้ำมัน`, 'warning');
        return null;
      }
      if (Number(tank.current_level_l || 0) < fuelL) {
        toast?.(`ถัง ${tank.name} มีน้ำมัน ${tank.current_level_l} L ไม่พอ (ต้อง ${fuelL} L)`, 'warning');
        // ยังเขียนต่อ ให้ RPC fail แทนการ silently skip
      }

      const { error } = await db.rpc('sk_fuel_dispense', {
        p_tank_id: Number(tank.id),
        p_vehicle_id: Number(vehicleId),
        p_qty_l: fuelL,
        p_bill_ids: [String(billId)],
        p_staff: window.SK_FUEL.staff(),
        p_note: note || 'auto-deduct',
        p_odometer: null,
      });
      if (error) {
        console.warn('[v90] auto-deduct fuel failed:', error);
        toast?.('หักน้ำมันอัตโนมัติไม่สำเร็จ: ' + error.message, 'warning');
        return null;
      }
      toast?.(`⛽ หักน้ำมัน ${fuelL} L จาก ${tank.name} (ไป-กลับ ${(distanceKm * 2).toFixed(1)} km ÷ ${kmpl} km/L)`, 'success');
      return { fuelL, tank };
    } catch (e) {
      console.error('[v90] autoDeduct error:', e);
      return null;
    }
  }
  window.v90AutoDeductFuel = autoDeductFuelForBill;
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ─────── GOOGLE MAPS HELPERS ─────── */
  function googleMapsDirectionsUrl(pickup, drop) {
    const hasPickup = pickup && Math.abs(pickup.lat || 0) > 0.001 && Math.abs(pickup.lng || 0) > 0.001;
    const hasDrop = drop && Math.abs(drop.lat || 0) > 0.001 && Math.abs(drop.lng || 0) > 0.001;
    if (!hasDrop) return null;
    if (hasPickup) {
      return `https://www.google.com/maps/dir/?api=1&origin=${pickup.lat},${pickup.lng}&destination=${drop.lat},${drop.lng}&travelmode=driving`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${drop.lat},${drop.lng}`;
  }
  window.v90OpenGoogleMaps = function (lat, lng, pickupLat, pickupLng) {
    const url = googleMapsDirectionsUrl(
      { lat: pickupLat, lng: pickupLng },
      { lat, lng }
    );
    if (url) window.open(url, '_blank', 'noopener');
    else toast?.('ยังไม่มีพิกัดจัดส่ง', 'warning');
  };

  /* ─────── PRETTY VEHICLE MODAL (with auto-distance + Google Maps) ─────── */
  async function showVehicleModal({ bill, vehicles, assignment, pickup }) {
    injectPolishStyles();
    const hasPin = !!(assignment?.drop_lat && assignment?.drop_lng);
    const billNo = bill?.bill_no || bill?.id;
    const billTotal = Number(bill?.total || 0);
    const drop = hasPin ? { lat: Number(assignment.drop_lat), lng: Number(assignment.drop_lng) } : null;
    const gmapsUrl = hasPin ? googleMapsDirectionsUrl(pickup, drop) : null;

    // ★ คำนวณระยะอัตโนมัติ Haversine × 1.3 ทันทีตอนเปิด (ไม่ต้องรอกด)
    let autoKm = 0;
    let autoSource = 'manual';
    if (hasPin && pickup?.lat && pickup?.lng) {
      autoKm = haversineKm(pickup.lat, pickup.lng, drop.lat, drop.lng) * 1.3;
      autoSource = 'haversine_x1.3';
    } else if (assignment?.distance_km_estimate) {
      autoKm = Number(assignment.distance_km_estimate);
      autoSource = 'estimate';
    }

    const vehiclesHtml = vehicles.map((v, idx) => `
      <div class="sk-veh-card ${idx === 0 ? 'selected' : ''}" data-vid="${esc(v.id)}" data-driver="${esc(v.driver_default || '')}" data-kmpl="${esc(v.avg_kmpl || 0)}" onclick="window.__v90PickVehicle(this)">
        <div class="veh-check"><i class="material-icons-round" style="font-size:14px">check</i></div>
        <div class="veh-name">${esc(v.name || '-')}</div>
        <div class="veh-plate">🚗 ${esc(v.plate_no || '-')}</div>
        <div class="veh-meta">${v.avg_kmpl ? `เฉลี่ย ${fmt(v.avg_kmpl)} km/L` : 'ยังไม่มีค่า km/L'} ${v.driver_default ? `· ${esc(v.driver_default)}` : ''}</div>
      </div>
    `).join('');

    window.__v90PickVehicle = function (el) {
      el.parentElement.querySelectorAll('.sk-veh-card').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      const driver = el.dataset.driver || '';
      const drvInput = document.getElementById('v90-driver');
      if (drvInput && !drvInput.value) drvInput.value = driver;
      // Update fuel estimate
      window.__v90UpdateFuelEstimate?.();
    };

    window.__v90UpdateFuelEstimate = function () {
      const selected = document.querySelector('.sk-veh-card.selected');
      const kmpl = Number(selected?.dataset?.kmpl || 0);
      const km = Number(document.getElementById('v90-km-display')?.dataset?.km || autoKm);
      const fuelL = kmpl > 0 && km > 0 ? (km * 2) / kmpl : 0;
      const el = document.getElementById('v90-fuel-est');
      if (el && kmpl > 0) {
        el.innerHTML = `<b style="color:#0284c7">${fuelL.toFixed(2)} L</b> <span style="color:#64748b">(${km.toFixed(1)} km × 2 ÷ ${kmpl} km/L)</span>`;
      } else if (el) {
        el.innerHTML = '<span style="color:#94a3b8">— (รถยังไม่มีค่า km/L)</span>';
      }
    };

    // Refine ด้วย OSRM ใน background (ถ้าได้ผลค่อยอัปเดต)
    window.__v90RefineRoute = async function () {
      if (!hasPin) return;
      const info = document.getElementById('v90-km-info');
      if (info) info.textContent = '⏳ กำลังตรวจสอบจาก map routing...';
      try {
        const route = await fetchRouteDistance(pickup, drop, autoKm);
        const km = route.distance_km;
        const disp = document.getElementById('v90-km-display');
        if (disp) {
          disp.textContent = km.toFixed(2) + ' km';
          disp.dataset.km = km;
        }
        if (info) {
          const label = route.route_source === 'osrm' ? '🗺️ คำนวณจากเส้นทางจริง (OSRM)' : '📏 คำนวณจากเส้นตรง × 1.3';
          info.innerHTML = label;
        }
        window.__v90UpdateFuelEstimate?.();
      } catch (_) {
        if (info) info.textContent = '📏 คำนวณจากเส้นตรง × 1.3';
      }
    };

    const html = `
      <div class="sk-bill-summary">
        <div class="row"><span>📦 บิล</span><b>#${esc(billNo)}</b></div>
        <div class="row"><span>👤 ลูกค้า</span><b>${esc(bill?.customer_name || '-')}</b></div>
        ${bill?.delivery_address ? `<div class="row"><span>📍 ที่อยู่</span><b style="text-align:right;max-width:60%">${esc(bill.delivery_address)}</b></div>` : ''}
        <div class="row total"><span>💰 ยอดบิล</span><b>฿${fmt(billTotal)}</b></div>
      </div>

      ${hasPin
        ? `<div style="display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;background:linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%);border:2px solid #7dd3fc;border-radius:14px;padding:14px 16px;margin-bottom:14px;box-shadow:0 8px 22px rgba(2,132,199,.10)">
            <div style="width:48px;height:48px;border-radius:12px;background:#0284c7;display:flex;align-items:center;justify-content:center;color:#fff">
              <i class="material-icons-round" style="font-size:26px">straighten</i>
            </div>
            <div style="min-width:0">
              <div style="font-size:11px;font-weight:900;color:#075985;text-transform:uppercase;letter-spacing:.4px">ระยะทาง (ไป-กลับ จะคำนวณ ×2)</div>
              <div style="display:flex;align-items:baseline;gap:8px;margin-top:2px">
                <span id="v90-km-display" data-km="${autoKm}" style="font-size:26px;font-weight:950;color:#0c4a6e;line-height:1">${autoKm.toFixed(2)} km</span>
              </div>
              <div id="v90-km-info" style="font-size:11.5px;color:#0369a1;font-weight:800;margin-top:3px">📏 คำนวณจากเส้นตรง × 1.3</div>
              <div style="font-size:12px;color:#475569;font-weight:850;margin-top:6px">⛽ น้ำมันโดยประมาณ: <span id="v90-fuel-est">—</span></div>
            </div>
            <a href="${gmapsUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;background:#0284c7;color:#fff;padding:9px 14px;border-radius:10px;font-size:12.5px;font-weight:900;text-decoration:none;white-space:nowrap;box-shadow:0 4px 10px rgba(2,132,199,.3)"><i class="material-icons-round" style="font-size:18px">map</i> Google Maps</a>
          </div>`
        : `<div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:14px;padding:12px 16px;margin-bottom:14px;display:flex;gap:10px;align-items:center">
            <i class="material-icons-round" style="color:#f59e0b;font-size:22px">warning</i>
            <div style="flex:1">
              <div style="font-weight:900;color:#92400e;font-size:13px">ยังไม่มีพิกัดจัดส่ง</div>
              <div style="font-size:12px;color:#a16207;font-weight:800">กรอกระยะทางเองด้านล่าง (กม.) — ระบบจะคูณ 2 เป็นไป-กลับ</div>
            </div>
          </div>`}

      <div class="sk-fuel-fld full" style="margin-top:8px">
        <label><i class="material-icons-round">local_shipping</i> เลือกรถที่ใช้ส่ง</label>
        <div class="sk-veh-grid">${vehiclesHtml}</div>
      </div>

      <div class="sk-fuel-form two" style="margin-top:14px">
        <div class="sk-fuel-fld">
          <label><i class="material-icons-round">person</i> พขร.</label>
          <input id="v90-driver" placeholder="ชื่อพนักงาน" value="${esc(vehicles[0]?.driver_default || '')}">
        </div>
        ${hasPin ? '' : `<div class="sk-fuel-fld">
          <label><i class="material-icons-round">straighten</i> ระยะทาง (km) <span style="color:#dc2626">*</span></label>
          <input id="v90-km-manual" type="number" step="0.01" placeholder="เช่น 5.2">
        </div>`}
        <div class="sk-fuel-fld full">
          <label><i class="material-icons-round">note</i> หมายเหตุ (ถ้ามี)</label>
          <textarea id="v90-note" placeholder="เช่น ลูกค้ารับของแล้ว เซ็นชื่อในบิลกระดาษ"></textarea>
        </div>
      </div>
    `;

    const result = await Swal.fire({
      title: '✅ ยืนยันจัดส่งสำเร็จ',
      html,
      width: 660,
      showCancelButton: true,
      confirmButtonText: '🚛 ยืนยัน — ดำเนินการต่อ',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'sk-fuel-popup' },
      didOpen: () => {
        window.__v90UpdateFuelEstimate?.();
        if (hasPin) setTimeout(() => window.__v90RefineRoute?.(), 300);
      },
      preConfirm: () => {
        const selected = document.querySelector('.sk-veh-card.selected');
        if (!selected) { Swal.showValidationMessage('กรุณาเลือกรถ'); return false; }
        let km = 0;
        if (hasPin) {
          km = Number(document.getElementById('v90-km-display')?.dataset?.km || autoKm);
        } else {
          km = Number(document.getElementById('v90-km-manual')?.value || 0);
          if (km <= 0) { Swal.showValidationMessage('กรุณากรอกระยะทาง'); return false; }
        }
        return {
          vehicleId: Number(selected.dataset.vid),
          vehicleKmpl: Number(selected.dataset.kmpl || 0),
          driver: document.getElementById('v90-driver')?.value?.trim() || '',
          km,
          note: document.getElementById('v90-note')?.value?.trim() || '',
        };
      },
    });
    delete window.__v90PickVehicle;
    delete window.__v90UpdateFuelEstimate;
    delete window.__v90RefineRoute;
    return result.isConfirmed ? result.value : null;
  }

  /* ─────── WRAP v12DQMarkDone ─────── */
  let origMarkDone = null;
  function patchMarkDone() {
    if (typeof window.v12DQMarkDone !== 'function') return;
    if (window.v12DQMarkDone.__v90Wrapped) return;
    origMarkDone = window.v12DQMarkDone;

    const wrapped = async function (billId) {
      try {
        if (!window.SK_FUEL) return origMarkDone(billId);
        const schema = await window.SK_FUEL.schemaStatus();
        if (!schema.ready) return origMarkDone(billId);

        const [billRes, vehicles, assignRes] = await Promise.all([
          db.from('บิลขาย').select('id,bill_no,customer_name,delivery_address,total,delivery_status,status,method,deposit_amount,return_info').eq('id', billId).maybeSingle(),
          window.SK_FUEL.select(window.SK_FUEL.TABLES.vehicle, '*', { order: 'name' }),
          db.from('delivery_assignment').select('*').eq('bill_id', String(billId)).maybeSingle(),
        ]);

        const bill = billRes?.data;
        const assignment = assignRes?.data;

        if (!bill) return origMarkDone(billId); // bill missing — let original handle
        if (bill.delivery_status === 'จัดส่งสำเร็จ') {
          return toast?.('บิลนี้จัดส่งสำเร็จไปแล้ว', 'info');
        }
        if (!vehicles.length) {
          toast?.('ยังไม่มีรถในระบบ — ใช้ flow เดิมไปก่อน', 'warning');
          return origMarkDone(billId);
        }

        const pickup = {
          lat: Number(assignment?.pickup_lat || localStorage.getItem('sk_pickup_lat') || 0),
          lng: Number(assignment?.pickup_lng || localStorage.getItem('sk_pickup_lng') || 0),
        };

        // 1) Show pretty vehicle modal (with routing auto-calc + Google Maps)
        const picked = await showVehicleModal({ bill, vehicles, assignment, pickup });
        if (!picked) return; // user cancelled

        // 2) Ensure assignment exists (auto-create if not)
        if (!assignment) {
          await db.from('delivery_assignment').upsert({
            bill_id: String(billId),
            drop_address: bill.delivery_address || null,
            drop_pinned_by: 'staff',
            status: 'pending',
            distance_km_estimate: picked.km || null,
          }, { onConflict: 'bill_id' });
        }

        // 3) Patch Swal.fire เพื่อ auto-confirm popup เก่า (เพราะเรายืนยันไปแล้ว)
        const origSwalFire = Swal.fire;
        let consumed = 0;
        Swal.fire = function (opts) {
          if (consumed < 2 && opts && typeof opts === 'object') {
            const t = String(opts.title || '');
            // v36's basic confirm (no remaining) — auto-confirm
            if (/ยืนยันจัดส่งสำเร็จ/.test(t) && !opts.showDenyButton) {
              consumed++;
              return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false, value: true });
            }
            // v14's "เลือกวิธีรับเงินปลายทาง (COD)" — let it show
            // v36's payment confirm — let it show (มี showDenyButton)
          }
          return origSwalFire.apply(this, arguments);
        };

        try {
          // 4) Call original (handles stock + status + payment if remaining > 0)
          // - ถ้าบิล status='ชำระหน้างาน' (COD) → v14 จะเปิด v12ShowCODPaymentModal (cash drawer + transfer + debt)
          // - ถ้ามียอดค้าง → v36 จะเปิด v20BMCPayDebt
          // - ถ้าไม่มียอดค้าง → ตัดสต็อก + ปิดสถานะเลย (เราข้าม confirm ผ่าน Swal patch)
          await origMarkDone(billId);
        } finally {
          Swal.fire = origSwalFire;
        }

        // 5) Calculate final routing + save vehicle info via RPC
        const drop = {
          lat: Number(assignment?.drop_lat || 0),
          lng: Number(assignment?.drop_lng || 0),
        };
        const route = await fetchRouteDistance(pickup, drop, picked.km);

        const { error: rpcErr } = await db.rpc('sk_complete_delivery', {
          p_bill_id: String(billId),
          p_vehicle_id: picked.vehicleId,
          p_driver_name: picked.driver,
          p_distance_km: route.distance_km,
          p_route_polyline: null,
          p_route_source: route.route_source,
          p_odometer_start: null,
          p_odometer_end: null,
          p_photo_url: null,
          p_note: picked.note,
          p_staff: window.SK_FUEL.staff(),
        });
        if (rpcErr) {
          console.warn('[v90] sk_complete_delivery failed:', rpcErr);
          toast?.('จัดส่งสำเร็จแล้ว แต่บันทึกรถไม่สำเร็จ: ' + rpcErr.message, 'warning');
        } else {
          // 6) Auto-deduct fuel จากถังร้าน (ไป-กลับ)
          await autoDeductFuelForBill({
            billId, vehicleId: picked.vehicleId, vehicleKmpl: picked.vehicleKmpl,
            distanceKm: route.distance_km, note: 'auto: จัดส่งบิล #' + (bill.bill_no || billId)
          });
          const srcLabel = route.route_source === 'osrm' ? 'แผนที่จริง'
            : route.route_source === 'haversine_fallback' ? 'เส้นตรง × 1.3'
            : 'กรอกเอง';
          toast?.(`✅ บันทึกรถ + ${route.distance_km.toFixed(1)} km (${srcLabel})`, 'success');
        }

        // refresh related views
        try { window.renderDeliveryAssignments?.(); } catch (_) {}
        try { window.renderFuelReports?.(); } catch (_) {}
        try { window.renderDelivery?.(); } catch (_) {}
      } catch (e) {
        console.error('[v90] wrapped markDone error:', e);
        toast?.('เกิดข้อผิดพลาด: ' + (e.message || e), 'error');
      }
    };
    wrapped.__v90Wrapped = true;
    window.v12DQMarkDone = wrapped;
    console.log('[v90] v12DQMarkDone wrapped with vehicle picker');
  }

  // Boot — wait until v12DQMarkDone is defined by v36
  setTimeout(patchMarkDone, 1500);
  setTimeout(patchMarkDone, 3000);
  setTimeout(patchMarkDone, 6000);
})();
