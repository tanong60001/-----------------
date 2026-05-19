(function () {
  'use strict';

  const F = () => window.SK_FUEL;

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = d => Number(d) * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  async function fetchRouteDistance(pickup, drop, fallbackKm) {
    if (!pickup?.lat || !pickup?.lng || !drop?.lat || !drop?.lng) {
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

  // sync เฉพาะตอน user กดปุ่ม "ซิงค์บิลรอส่ง" หรือ stale (>5 นาที)
  // ไม่ทำทุก loadData() แล้ว — ลด egress
  let lastSyncAt = 0;
  async function loadData({ forceSync = false } = {}) {
    const f = F();
    if (forceSync || Date.now() - lastSyncAt > 5 * 60 * 1000) {
      await syncAssignmentsFromBills();
      lastSyncAt = Date.now();
    }
    const [assignments, vehicles, bills] = await Promise.all([
      f.select(f.TABLES.delivery, '*', { order: 'created_at', ascending: false, limit: 250 }),
      f.select(f.TABLES.vehicle, '*', { order: 'name' }),
      db.from('บิลขาย').select('id,bill_no,customer_id,customer_name,delivery_phone,delivery_address,delivery_status,delivery_mode,date,status,total')
        .gte('date', new Date(Date.now() - 30 * 86400000).toISOString())
        .order('date', { ascending: false }).range(0, 499),
    ]);
    if (bills.error) throw bills.error;
    return { assignments, vehicles, bills: bills.data || [] };
  }

  async function syncAssignmentsFromBills() {
    const f = F();
    try {
      // ดึงเฉพาะบิล 30 วันล่าสุด (ไม่ใช่ทั้งหมด)
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await db.from('บิลขาย')
        .select('id,bill_no,customer_id,customer_name,delivery_address,delivery_status,delivery_mode,date,status')
        .gte('date', since)
        .order('date', { ascending: false })
        .range(0, 499);
      if (error) throw error;

      const needRows = (data || []).filter(b => {
        const delivery = `${b.delivery_status || ''} ${b.delivery_mode || ''}`;
        const terminal = /ยกเลิก|คืนสินค้า/.test(String(b.status || ''));
        return !terminal && /รอ|จัดส่ง|ส่ง/.test(delivery) && !/สำเร็จ|จัดส่งสำเร็จ|รับเอง|ไม่จัดส่ง/.test(delivery);
      });

      if (!needRows.length) return;

      // ตรวจว่า assignment มีอยู่แล้วหรือยัง — ทำ insert เฉพาะที่ไม่มี
      const billIds = needRows.map(b => String(b.id));
      const { data: existing } = await db.from(f.TABLES.delivery)
        .select('bill_id,drop_lat,drop_lng').in('bill_id', billIds);
      const existingMap = new Map((existing || []).map(x => [String(x.bill_id), x]));

      // ★ ดึงพิกัดลูกค้า (signup สมัครสมาชิกแล้ว) — ใช้เติม drop_lat/lng ได้
      const customerIds = [...new Set(needRows.map(b => b.customer_id).filter(Boolean))];
      let customerCoords = new Map();
      if (customerIds.length) {
        const { data: customers } = await db.from('customer')
          .select('id,lat,lng,address').in('id', customerIds);
        customerCoords = new Map((customers || [])
          .filter(c => c.lat && c.lng)
          .map(c => [String(c.id), c]));
      }

      // Insert ใหม่: รวมพิกัดจาก customer (ถ้ามี)
      const newRows = [];
      const updateRows = [];
      needRows.forEach(b => {
        const cust = b.customer_id ? customerCoords.get(String(b.customer_id)) : null;
        const existsRow = existingMap.get(String(b.id));
        if (!existsRow) {
          // ใหม่
          newRows.push({
            bill_id: String(b.id),
            drop_address: b.delivery_address || cust?.address || null,
            drop_lat: cust?.lat || null,
            drop_lng: cust?.lng || null,
            drop_pinned_by: cust?.lat ? 'customer' : (b.delivery_address ? 'staff' : null),
            drop_pinned_at: cust?.lat ? new Date().toISOString() : null,
            status: cust?.lat ? 'pinned' : 'pending',
          });
        } else if (cust?.lat && !existsRow.drop_lat) {
          // backfill: assignment เก่ายังไม่มีพิกัด แต่ลูกค้ามี
          updateRows.push({ bill_id: String(b.id), lat: cust.lat, lng: cust.lng, address: cust.address });
        }
      });

      if (newRows.length) await db.from(f.TABLES.delivery).insert(newRows);
      // backfill rows
      for (const u of updateRows) {
        await db.from(f.TABLES.delivery).update({
          drop_lat: u.lat, drop_lng: u.lng,
          drop_pinned_by: 'customer',
          drop_pinned_at: new Date().toISOString(),
          status: 'pinned',
          drop_address: u.address,
        }).eq('bill_id', u.bill_id);
      }
    } catch (error) {
      console.warn('[v88] sync delivery assignments skipped:', error);
    }
  }

  function statusPill(status) {
    const f = F();
    const map = {
      pending: ['warn', 'รอจัดส่ง'],
      pinned: ['good', 'ปักหมุดแล้ว'],
      driving: ['', 'กำลังส่ง'],
      done: ['good', 'ส่งแล้ว'],
      cancel: ['bad', 'ยกเลิก'],
    };
    const [tone, label] = map[status] || ['gray', status || '-'];
    return `<span class="fuel-pill ${tone}">${f.esc(label)}</span>`;
  }

  function rows(assignments, vehicles, bills = []) {
    const f = F();
    if (!assignments.length) return `<tr><td colspan="8"><div class="fuel-empty"><i class="material-icons-round">local_shipping</i>ยังไม่มีงานส่ง</div></td></tr>`;
    const vehicleMap = new Map(vehicles.map(v => [String(v.id), v]));
    const billMap = new Map(bills.map(b => [String(b.id), b]));
    return assignments.map(a => {
      const v = vehicleMap.get(String(a.vehicle_id));
      const b = billMap.get(String(a.bill_id));
      return `<tr>
        <td><b>#${f.esc(b?.bill_no || a.bill_id || '-')}</b><div style="color:#64748b;font-size:12px">${f.esc(b?.customer_name || f.thDate(a.created_at))}</div></td>
        <td>${f.esc(a.drop_address || b?.delivery_address || '-')}</td>
        <td>${a.drop_lat && a.drop_lng ? `<span class="fuel-pill good">มีหมุด</span>` : `<span class="fuel-pill warn">ยังไม่มีหมุด</span>`}</td>
        <td>${a.distance_km ? f.fmt(a.distance_km) + ' km' : a.distance_km_estimate ? '~' + f.fmt(a.distance_km_estimate) + ' km' : '-'}</td>
        <td>${v ? `<b>${f.esc(v.name || '-')}</b><div style="color:#64748b;font-size:12px">${f.esc(v.plate_no || '')}</div>` : '-'}</td>
        <td>${statusPill(a.status)}</td>
        <td>${f.esc(a.driver_name || '-')}</td>
        <td style="text-align:right;white-space:nowrap">
          ${a.status !== 'done' && a.status !== 'cancel' ? `<button class="fuel-btn good" onclick="v88CompleteDelivery('${f.js(a.bill_id)}')"><i class="material-icons-round">check_circle</i>ส่งสำเร็จ</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  window.renderDeliveryAssignments = async function () {
    const f = F();
    f.injectStyle();
    const section = document.getElementById('page-delivery');
    if (!section) return;
    section.innerHTML = f.pageShell('local_shipping', 'บิลที่รอส่งทั้งหมด', 'ติดตามงานส่ง ปักหมุด และผูกรถตอนกดส่งสำเร็จ — บิลที่ยกเลิกจะถูกตัดทิ้งอัตโนมัติ',
          `<button class="fuel-btn secondary" onclick="v88CreateAssignmentFromBill()"><i class="material-icons-round">add_task</i>เพิ่มงานจากบิล</button>
           <button class="fuel-btn secondary" onclick="v88ForceSyncReload()"><i class="material-icons-round">sync</i>ซิงค์บิลรอส่ง</button>`);
    try {
      const schema = await f.schemaStatus();
      if (!schema.ready) {
        section.querySelector('.fuel-page').insertAdjacentHTML('beforeend', f.schemaWarning(schema.missing));
        return;
      }
      const data = await loadData();
      window.__v88DeliveryData = data;

      // ★ Filter assignments: ตัดบิลที่ยกเลิกออก + จับ customer.lat/lng เป็น fallback หมุด
      const billMap = new Map(data.bills.map(b => [String(b.id), b]));
      const cancelledIds = new Set();
      data.bills.forEach(b => {
        if (/ยกเลิก|คืนสินค้า/.test(String(b.status || ''))) cancelledIds.add(String(b.id));
      });

      // ดึง customer.lat/lng สำหรับ fallback
      const customerIds = [...new Set(data.bills.map(b => b.customer_id).filter(Boolean))];
      let custMap = new Map();
      if (customerIds.length) {
        const { data: customers } = await db.from('customer')
          .select('id,lat,lng,address').in('id', customerIds);
        custMap = new Map((customers || []).map(c => [String(c.id), c]));
      }

      // Enrich assignments + filter cancelled
      let visibleAssignments = data.assignments
        .filter(a => !cancelledIds.has(String(a.bill_id)))
        .filter(a => a.status !== 'cancel')
        .map(a => {
          if (!a.drop_lat || !a.drop_lng) {
            const bill = billMap.get(String(a.bill_id));
            const cust = bill?.customer_id ? custMap.get(String(bill.customer_id)) : null;
            if (cust?.lat && cust?.lng) {
              return { ...a, drop_lat: Number(cust.lat), drop_lng: Number(cust.lng), drop_address: a.drop_address || cust.address, drop_pinned_by: a.drop_pinned_by || 'customer-fallback' };
            }
          }
          return a;
        });

      const today = f.todayKey();
      const todayRows = visibleAssignments.filter(a => String(a.created_at || '').slice(0, 10) === today || String(a.completed_at || '').slice(0, 10) === today);
      const pending = visibleAssignments.filter(a => a.status !== 'done' && a.status !== 'cancel').length;
      const doneToday = todayRows.filter(a => a.status === 'done').length;
      const kmToday = todayRows.reduce((s, a) => s + f.num(a.distance_km), 0);
      const withPin = visibleAssignments.filter(a => a.drop_lat && a.drop_lng).length;
      section.querySelector('.fuel-page').insertAdjacentHTML('beforeend', `
        <div class="fuel-grid three">
          <div class="fuel-kpi"><div class="dot" style="background:#f59e0b"><i class="material-icons-round">pending_actions</i></div><div><b>${pending}</b><span>บิลที่รอส่ง</span></div></div>
          <div class="fuel-kpi"><div class="dot" style="background:#0284c7"><i class="material-icons-round">place</i></div><div><b>${withPin}</b><span>มีหมุดแล้ว</span></div></div>
          <div class="fuel-kpi"><div class="dot" style="background:#16a34a"><i class="material-icons-round">check_circle</i></div><div><b>${doneToday}</b><span>ส่งสำเร็จวันนี้</span></div></div>
        </div>
        <div class="fuel-card"><div class="fuel-card-head"><h3><i class="material-icons-round">local_shipping</i>รายการงานส่ง</h3></div>
          <div class="fuel-card-body"><table class="fuel-table"><thead><tr><th>บิล</th><th>ที่อยู่ส่ง</th><th>หมุด</th><th>ระยะ</th><th>รถ</th><th>สถานะ</th><th>พขร.</th><th style="text-align:right">ทำ</th></tr></thead><tbody>${rows(visibleAssignments, data.vehicles, data.bills)}</tbody></table></div>
        </div>`);
    } catch (error) {
      section.querySelector('.fuel-page')?.insertAdjacentHTML('beforeend', `<div class="fuel-schema-warn">โหลดงานส่งไม่สำเร็จ: ${f.esc(error.message || error)}</div>`);
    }
  };

  window.v88CreateAssignmentFromBill = async function () {
    const f = F();
    const { data: bills } = await db.from('บิลขาย')
      .select('id,bill_no,customer_name,delivery_address,delivery_status,delivery_mode,date')
      .order('date', { ascending: false })
      .range(0, 199);
    const options = (bills || []).map(b => `<option value="${f.esc(b.id)}" data-address="${f.esc(b.delivery_address || '')}">#${f.esc(b.bill_no || b.id)} · ${f.esc(b.customer_name || '-')} · ${f.esc(b.delivery_status || '')}</option>`).join('');
    const result = await Swal.fire({
      title: '📦 เพิ่มงานส่งจากบิล',
      html: `<div class="sk-fuel-form">
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">receipt_long</i> เลือกบิล</label><select id="v88-bill">${options}</select></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">place</i> ที่อยู่ส่ง</label><textarea id="v88-address"></textarea></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">straighten</i> ระยะประมาณ (km)</label><input id="v88-km" type="number" step="0.01"></div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: '✓ สร้างงานส่ง',
      cancelButtonText: 'ยกเลิก',
      width: 600,
      customClass: { popup: 'sk-fuel-popup' },
      didOpen: () => {
        const sel = document.getElementById('v88-bill');
        const addr = document.getElementById('v88-address');
        const sync = () => { if (addr && sel) addr.value = sel.options[sel.selectedIndex]?.dataset?.address || ''; };
        sel?.addEventListener('change', sync);
        sync();
      },
      preConfirm: () => {
        const billId = document.getElementById('v88-bill')?.value.trim();
        if (!billId) return Swal.showValidationMessage('กรุณากรอกรหัสบิล');
        return {
          bill_id: billId,
          drop_address: document.getElementById('v88-address')?.value.trim(),
          distance_km_estimate: f.num(document.getElementById('v88-km')?.value),
          drop_pinned_by: 'staff',
          status: 'pending',
        };
      },
    });
    if (!result.isConfirmed) return;
    const { error } = await db.from(f.TABLES.delivery).upsert(result.value, { onConflict: 'bill_id' });
    if (error) return toast?.('สร้างงานส่งไม่สำเร็จ: ' + error.message, 'error');
    toast?.('สร้างงานส่งแล้ว', 'success');
    window.renderDeliveryAssignments?.();
  };

  window.v88CompleteDelivery = async function (billId) {
    const f = F();
    const data = window.__v88DeliveryData || await loadData();
    const assignment = data.assignments.find(a => String(a.bill_id) === String(billId));
    const vehicleOptions = data.vehicles.map(v => `<option value="${f.esc(v.id)}" data-driver="${f.esc(v.driver_default || '')}">${f.esc(v.name || v.plate_no)} · ${f.esc(v.plate_no || '')}</option>`).join('');
    if (!vehicleOptions) return Swal.fire({ icon: 'warning', title: 'ยังไม่มีรถ', text: 'เพิ่มทะเบียนรถก่อนกดส่งสำเร็จ' });
    const r = await Swal.fire({
      title: `ส่งสำเร็จ — บิล #${billId}`,
      width: 680,
      html: `<div class="fuel-form" style="text-align:left">
        <div class="fuel-field"><label>ที่อยู่ส่ง</label><input class="swal2-input" value="${f.esc(assignment?.drop_address || '-')}" disabled></div>
        <div class="fuel-field"><label>เลือกรถ</label><select id="v88-vehicle" class="swal2-select">${vehicleOptions}</select></div>
        <div class="fuel-field"><label>พขร.</label><input id="v88-driver" class="swal2-input" value="${f.esc(data.vehicles[0]?.driver_default || '')}"></div>
        <div class="fuel-field"><label>ระยะทางจริง (ถ้าไม่ปักหมุด/ไม่ใช้ routing)</label><input id="v88-km" class="swal2-input" type="number" step="0.01" value="${f.esc(assignment?.distance_km_estimate || '')}"></div>
        <div class="fuel-field"><label>เลขไมล์เริ่ม (ไม่บังคับ)</label><input id="v88-odo-start" class="swal2-input" type="number" step="0.1"></div>
        <div class="fuel-field"><label>เลขไมล์จบ (ไม่บังคับ)</label><input id="v88-odo-end" class="swal2-input" type="number" step="0.1"></div>
        <div class="fuel-field"><label>หมายเหตุ</label><textarea id="v88-note" class="swal2-textarea"></textarea></div>
        <div style="font-size:12px;color:#64748b;font-weight:800">ถ้ามีหมุด ระบบจะลองคำนวณระยะจาก OSRM ก่อน แล้ว fallback เป็นเส้นตรง x 1.3</div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันส่งสำเร็จ',
      didOpen: () => {
        const sel = document.getElementById('v88-vehicle');
        sel?.addEventListener('change', () => {
          const opt = sel.options[sel.selectedIndex];
          const driver = opt?.dataset?.driver || '';
          const input = document.getElementById('v88-driver');
          if (input && !input.value) input.value = driver;
        });
      },
      preConfirm: () => {
        const vehicleId = Number(document.getElementById('v88-vehicle')?.value);
        const km = f.num(document.getElementById('v88-km')?.value);
        if (!vehicleId) return Swal.showValidationMessage('กรุณาเลือกรถ');
        if (km <= 0 && (!assignment?.drop_lat || !assignment?.drop_lng)) return Swal.showValidationMessage('กรุณากรอกระยะทางจริง');
        return {
          vehicleId,
          driver: document.getElementById('v88-driver')?.value.trim(),
          km,
          odoStart: f.num(document.getElementById('v88-odo-start')?.value) || null,
          odoEnd: f.num(document.getElementById('v88-odo-end')?.value) || null,
          note: document.getElementById('v88-note')?.value.trim() || null,
        };
      },
    });
    if (!r.isConfirmed) return;
    const pickup = {
      lat: Number(assignment?.pickup_lat || localStorage.getItem('sk_pickup_lat') || 0),
      lng: Number(assignment?.pickup_lng || localStorage.getItem('sk_pickup_lng') || 0),
    };
    const drop = { lat: Number(assignment?.drop_lat || 0), lng: Number(assignment?.drop_lng || 0) };
    // กัน routing ส่งไป (0,0) ที่ Greenwich UK
    const hasValidPickup = Math.abs(pickup.lat) > 0.001 && Math.abs(pickup.lng) > 0.001;
    const hasValidDrop = Math.abs(drop.lat) > 0.001 && Math.abs(drop.lng) > 0.001;

    let route;
    if (r.value.odoStart && r.value.odoEnd) {
      route = { distance_km: Math.max(0, r.value.odoEnd - r.value.odoStart), route_source: 'odometer' };
    } else if (hasValidPickup && hasValidDrop) {
      route = await fetchRouteDistance(pickup, drop, r.value.km || assignment?.distance_km_estimate);
    } else {
      // ไม่มีพิกัด → ใช้ค่าที่พนักงานกรอกหรือ estimate
      const fallbackKm = r.value.km || assignment?.distance_km_estimate || 0;
      if (fallbackKm <= 0) {
        return toast?.('ไม่มีพิกัดและไม่ได้กรอกระยะ — กรุณากรอกระยะทาง หรือให้ลูกค้าปักหมุด หรือตั้งพิกัดร้านใน Settings', 'error');
      }
      route = { distance_km: fallbackKm, route_source: 'manual' };
    }
    const { error } = await db.rpc('sk_complete_delivery', {
      p_bill_id: String(billId),
      p_vehicle_id: r.value.vehicleId,
      p_driver_name: r.value.driver,
      p_distance_km: route.distance_km,
      p_route_polyline: null,
      p_route_source: route.route_source,
      p_odometer_start: r.value.odoStart,
      p_odometer_end: r.value.odoEnd,
      p_photo_url: null,
      p_note: r.value.note,
      p_staff: f.staff(),
    });
    if (error) return toast?.('ปิดงานส่งไม่สำเร็จ: ' + error.message, 'error');
    await db.from('บิลขาย').update({ delivery_status: 'จัดส่งสำเร็จ' }).eq('id', billId);
    toast?.(`ปิดงานส่งแล้ว (${f.fmt(route.distance_km)} km)`, 'success');
    window.__v88DeliveryData = null;
    window.renderDeliveryAssignments?.();
  };

  // Override the first delivery-complete dialog with a safer flow:
  // route distance comes from the customer's pinned coordinates when available.
  window.v88CompleteDelivery = async function (billId) {
    const f = F();
    const data = window.__v88DeliveryData || await loadData();
    const assignment = data.assignments.find(a => String(a.bill_id) === String(billId));
    if (!assignment) return toast?.('ไม่พบงานจัดส่งของบิลนี้', 'error');
    let billRow = data.bills.find(b => String(b.id) === String(billId)) || {};
    if (!billRow.id) {
      const billRes = await db.from('บิลขาย')
        .select('id,bill_no,customer_name,delivery_address,delivery_status,delivery_mode,total,method,status')
        .eq('id', billId)
        .maybeSingle();
      billRow = billRes.data || {};
    }

    const vehicleOptions = data.vehicles.map(v => `<option value="${f.esc(v.id)}" data-driver="${f.esc(v.driver_default || '')}">${f.esc(v.name || v.plate_no)} · ${f.esc(v.plate_no || '')}</option>`).join('');
    if (!vehicleOptions) return Swal.fire({ icon: 'warning', title: 'ยังไม่มีรถ', text: 'เพิ่มทะเบียนรถก่อนกดส่งสำเร็จ' });

    const pickup = {
      lat: Number(assignment.pickup_lat || localStorage.getItem('sk_pickup_lat') || 0),
      lng: Number(assignment.pickup_lng || localStorage.getItem('sk_pickup_lng') || 0),
    };
    const drop = { lat: Number(assignment.drop_lat || 0), lng: Number(assignment.drop_lng || 0) };
    const hasValidPickup = Math.abs(pickup.lat) > 0.001 && Math.abs(pickup.lng) > 0.001;
    const hasValidDrop = Math.abs(drop.lat) > 0.001 && Math.abs(drop.lng) > 0.001;
    const pinnedRoute = hasValidPickup && hasValidDrop
      ? await fetchRouteDistance(pickup, drop, assignment.distance_km_estimate)
      : null;
    const needManualKm = !pinnedRoute?.distance_km;
    const currentMethod = billRow.method || billRow.payment_method || 'เดิม';
    const paymentOptions = ['เดิม', 'เงินสด', 'โอนเงิน', 'ค้างชำระ', 'เงินสด+โอน', 'จ่ายให้โครงการ']
      .map(m => `<option value="${f.esc(m)}" ${m === currentMethod ? 'selected' : ''}>${f.esc(m === 'เดิม' ? `ใช้วิธีเดิม (${currentMethod || '-'})` : m)}</option>`)
      .join('');

    const r = await Swal.fire({
      title: `ปิดงานจัดส่ง #${f.esc(billRow.bill_no || billId)}`,
      width: 760,
      html: `<style>
        .v88-done{font-family:inherit;text-align:left;color:#172033}
        .v88-route{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;background:linear-gradient(135deg,#ecfdf5,#eff6ff);border:1px solid #bfdbfe;border-radius:18px;padding:16px;margin-bottom:14px}
        .v88-route strong{font-size:32px;line-height:1;color:#0f766e}
        .v88-route small{display:block;color:#64748b;font-weight:800;margin-top:4px}
        .v88-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .v88-field label{display:block;font-size:13px;font-weight:900;color:#475569;margin:0 0 6px 4px}
        .v88-field input,.v88-field select,.v88-field textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:14px;padding:13px 14px;font:inherit;font-weight:800;background:#fff;color:#172033}
        .v88-field textarea{min-height:76px;resize:vertical}
        .v88-span{grid-column:1/-1}
        .v88-warn{background:#fff7ed;border:1px solid #fdba74;color:#9a3412;border-radius:14px;padding:10px 12px;font-weight:900;margin-top:10px}
      </style>
      <div class="v88-done">
        <div class="v88-route">
          <div>
            <div style="font-size:13px;font-weight:950;color:#0f766e">ระยะทางจากหมุดลูกค้า</div>
            <strong>${pinnedRoute?.distance_km ? f.fmt(pinnedRoute.distance_km) : '--'} km</strong>
            <small>${pinnedRoute?.route_source ? `คำนวณจาก ${f.esc(pinnedRoute.route_source)} และจะถูกใช้เป็นระยะจริง` : 'ยังไม่มีพิกัดครบ ระบบจะให้กรอกระยะสำรอง'}</small>
          </div>
          <div style="width:54px;height:54px;border-radius:16px;background:#10b981;color:#fff;display:grid;place-items:center"><span class="material-icons-round" style="font-size:34px">route</span></div>
        </div>
        <div class="v88-grid">
          <div class="v88-field v88-span"><label>ที่อยู่จัดส่ง</label><input value="${f.esc(assignment.drop_address || billRow.delivery_address || '-')}" disabled></div>
          <div class="v88-field"><label>รถจัดส่ง</label><select id="v88-vehicle">${vehicleOptions}</select></div>
          <div class="v88-field"><label>วิธีชำระของบิล</label><select id="v88-payment">${paymentOptions}</select></div>
          <div class="v88-field"><label>พขร.</label><input id="v88-driver" value="${f.esc(data.vehicles[0]?.driver_default || '')}"></div>
          <div class="v88-field"><label>ระยะสำรอง (ใช้เมื่อไม่มีหมุด)</label><input id="v88-km" type="number" step="0.01" value="${f.esc(assignment.distance_km_estimate || '')}" ${needManualKm ? '' : 'disabled'}></div>
          <div class="v88-field"><label>เลขไมล์เริ่ม (บันทึกประกอบ)</label><input id="v88-odo-start" type="number" step="0.1"></div>
          <div class="v88-field"><label>เลขไมล์จบ (บันทึกประกอบ)</label><input id="v88-odo-end" type="number" step="0.1"></div>
          <div class="v88-field v88-span"><label>หมายเหตุ</label><textarea id="v88-note" placeholder="หมายเหตุการจัดส่ง"></textarea></div>
        </div>
        ${needManualKm ? '<div class="v88-warn">ยังไม่มีหมุดร้าน/หมุดลูกค้าครบ จึงต้องกรอกระยะสำรองก่อนปิดงาน</div>' : ''}
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'บันทึกจัดส่งสำเร็จ',
      cancelButtonText: 'ยกเลิก',
      didOpen: () => {
        const sel = document.getElementById('v88-vehicle');
        sel?.addEventListener('change', () => {
          const opt = sel.options[sel.selectedIndex];
          const driver = opt?.dataset?.driver || '';
          const input = document.getElementById('v88-driver');
          if (input && driver) input.value = driver;
        });
      },
      preConfirm: () => {
        const vehicleId = Number(document.getElementById('v88-vehicle')?.value);
        const km = f.num(document.getElementById('v88-km')?.value);
        if (!vehicleId) return Swal.showValidationMessage('กรุณาเลือกรถ');
        if (needManualKm && km <= 0) return Swal.showValidationMessage('ไม่มีพิกัดครบ กรุณากรอกระยะสำรอง');
        return {
          vehicleId,
          paymentMethod: document.getElementById('v88-payment')?.value || 'เดิม',
          driver: document.getElementById('v88-driver')?.value.trim(),
          km,
          odoStart: f.num(document.getElementById('v88-odo-start')?.value) || null,
          odoEnd: f.num(document.getElementById('v88-odo-end')?.value) || null,
          note: document.getElementById('v88-note')?.value.trim() || null,
        };
      },
    });
    if (!r.isConfirmed) return;

    const route = pinnedRoute?.distance_km
      ? pinnedRoute
      : { distance_km: r.value.km || assignment.distance_km_estimate || 0, route_source: 'manual_fallback' };
    if (route.distance_km <= 0) return toast?.('ไม่มีพิกัดและไม่มีระยะสำรอง กรุณาให้ลูกค้าปักหมุดหรือกรอกระยะก่อน', 'error');

    const { error } = await db.rpc('sk_complete_delivery', {
      p_bill_id: String(billId),
      p_vehicle_id: r.value.vehicleId,
      p_driver_name: r.value.driver,
      p_distance_km: route.distance_km,
      p_route_polyline: null,
      p_route_source: route.route_source,
      p_odometer_start: r.value.odoStart,
      p_odometer_end: r.value.odoEnd,
      p_photo_url: null,
      p_note: r.value.note,
      p_staff: f.staff(),
    });
    if (error) return toast?.('ปิดงานส่งไม่สำเร็จ: ' + error.message, 'error');

    const billPatch = { delivery_status: 'จัดส่งสำเร็จ' };
    if (r.value.paymentMethod && r.value.paymentMethod !== 'เดิม') billPatch.method = r.value.paymentMethod;
    await db.from('บิลขาย').update(billPatch).eq('id', billId);
    toast?.(`ปิดงานส่งแล้ว (${f.fmt(route.distance_km)} km)`, 'success');
    window.__v88DeliveryData = null;
    window.renderDeliveryAssignments?.();
  };

  window.v88ForceSyncReload = function () {
    lastSyncAt = 0;
    window.renderDeliveryAssignments?.();
  };

  console.log('[v88] delivery assignment loaded');
})();
