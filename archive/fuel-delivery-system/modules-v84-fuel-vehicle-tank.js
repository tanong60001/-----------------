(function () {
  'use strict';

  const F = () => window.SK_FUEL;

  async function loadData() {
    const f = F();
    const [vehicles, tanks, refills, trips, odometers] = await Promise.all([
      f.select(f.TABLES.vehicle, '*', { order: 'created_at', ascending: false }),
      f.select(f.TABLES.tank, '*', { order: 'created_at', ascending: false }),
      f.select(f.TABLES.refill, '*,fuel_tank(name,fuel_type)', { order: 'refilled_at', ascending: false, limit: 12 }),
      f.select(f.TABLES.trip, '*,vehicle(name,plate_no)', { order: 'started_at', ascending: false, limit: 12 }),
      f.select(f.TABLES.odometer, '*,vehicle(name,plate_no)', { order: 'recorded_at', ascending: false, limit: 12 }),
    ]);
    return { vehicles, tanks, refills, trips, odometers };
  }

  function vehicleRows(rows) {
    const f = F();
    if (!rows.length) return `<tr><td colspan="6"><div class="fuel-empty"><i class="material-icons-round">directions_car</i>ยังไม่มีทะเบียนรถ</div></td></tr>`;
    return rows.map(v => `<tr>
      <td><b>${f.esc(v.name || '-')}</b><div style="color:#64748b;font-size:12px">${f.esc(v.driver_default || '')}</div></td>
      <td><span class="fuel-pill">${f.esc(v.plate_no || '-')}</span></td>
      <td>${f.esc(v.fuel_type || '-')}</td>
      <td>${f.fmt(v.tank_capacity_l)} L</td>
      <td>${f.fmt(v.avg_kmpl)} km/L</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="fuel-btn secondary" onclick="v84OpenTrip('${f.js(v.id)}')"><i class="material-icons-round">route</i>ใช้รถ</button>
        <button class="fuel-btn secondary" onclick="v84RecordOdometer('${f.js(v.id)}')"><i class="material-icons-round">speed</i>ไมล์</button>
        <button class="fuel-btn secondary" onclick="v84OpenVehicleForm('${f.js(v.id)}')"><i class="material-icons-round">edit</i></button>
      </td>
    </tr>`).join('');
  }

  function tankRows(rows) {
    const f = F();
    if (!rows.length) return `<tr><td colspan="5"><div class="fuel-empty"><i class="material-icons-round">local_gas_station</i>ยังไม่มีถังน้ำมัน</div></td></tr>`;
    return rows.map(t => {
      const pct = f.num(t.capacity_l) > 0 ? Math.round((f.num(t.current_level_l) / f.num(t.capacity_l)) * 100) : 0;
      const tone = pct < 20 ? 'bad' : pct < 40 ? 'warn' : 'good';
      return `<tr>
        <td><b>${f.esc(t.name || '-')}</b></td>
        <td>${f.esc(t.fuel_type || '-')}</td>
        <td>${f.fmt(t.capacity_l)} L</td>
        <td><span class="fuel-pill ${tone}">${f.fmt(t.current_level_l)} L (${pct}%)</span></td>
        <td style="text-align:right;white-space:nowrap"><button class="fuel-btn good" onclick="v84OpenTankRefill('${f.js(t.id)}')"><i class="material-icons-round">add</i>เติมเข้า</button><button class="fuel-btn secondary" onclick="v84OpenTankForm('${f.js(t.id)}')"><i class="material-icons-round">edit</i></button></td>
      </tr>`;
    }).join('');
  }

  window.renderFuelVehicleTank = async function () {
    const f = F();
    f.injectStyle();
    const section = document.getElementById('page-fuel-vehicle');
    if (!section) return;
    section.innerHTML = f.pageShell('directions_car', 'ทะเบียนรถ / ถังน้ำมัน', 'จัดการรถ ถังน้ำมัน ใช้รถไปหน้างาน และจดเลขไมล์',
      `<button class="fuel-btn" onclick="v84OpenVehicleForm()"><i class="material-icons-round">add</i>เพิ่มรถ</button>
       <button class="fuel-btn" onclick="v84OpenTankForm()"><i class="material-icons-round">add</i>เพิ่มถัง</button>
       <button class="fuel-btn secondary" onclick="v83OpenFuelSettings()"><i class="material-icons-round">settings</i>ตั้งค่า</button>`);
    try {
      const schema = await f.schemaStatus();
      if (!schema.ready) {
        section.querySelector('.fuel-page').insertAdjacentHTML('beforeend', f.schemaWarning(schema.missing));
        return;
      }
      const data = await loadData();
      const totalTank = data.tanks.reduce((s, t) => s + f.num(t.current_level_l), 0);
      const tripRows = data.trips.length ? data.trips.map(t => `<tr>
        <td>${f.esc(f.thDate(t.started_at))}</td>
        <td><b>${f.esc(t.vehicle?.name || '-')}</b><div style="color:#64748b;font-size:12px">${f.esc(t.vehicle?.plate_no || '')}</div></td>
        <td>${f.esc(t.destination_label || t.purpose || '-')}</td>
        <td>${t.distance_km ? f.fmt(t.distance_km) : '~' + f.fmt(t.distance_km_estimate)} km</td>
        <td><span class="fuel-pill ${t.status === 'done' ? 'good' : 'warn'}">${f.esc(t.status || '-')}</span></td>
        <td style="text-align:right">${t.status !== 'done' && t.status !== 'cancel' ? `<button class="fuel-btn good" onclick="v84CompleteTrip('${f.js(t.id)}')"><i class="material-icons-round">flag</i>จบงาน</button>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="6"><div class="fuel-empty">ยังไม่มีทริปใช้รถ</div></td></tr>';
      section.querySelector('.fuel-page').insertAdjacentHTML('beforeend', `
        <div class="fuel-grid three">
          <div class="fuel-kpi"><div class="dot"><i class="material-icons-round">directions_car</i></div><div><b>${data.vehicles.length}</b><span>รถที่ลงทะเบียน</span></div></div>
          <div class="fuel-kpi"><div class="dot" style="background:#16a34a"><i class="material-icons-round">local_gas_station</i></div><div><b>${f.fmt(totalTank)} L</b><span>น้ำมันคงเหลือรวม</span></div></div>
          <div class="fuel-kpi"><div class="dot" style="background:#f59e0b"><i class="material-icons-round">route</i></div><div><b>${data.trips.filter(t => t.status !== 'done').length}</b><span>ทริปที่ยังไม่ปิด</span></div></div>
        </div>
        <div class="fuel-grid">
          <div class="fuel-card"><div class="fuel-card-head"><h3><i class="material-icons-round">directions_car</i>ทะเบียนรถ</h3></div><div class="fuel-card-body"><table class="fuel-table"><thead><tr><th>รถ</th><th>ทะเบียน</th><th>ชนิดน้ำมัน</th><th>ถังรถ</th><th>เฉลี่ย</th><th style="text-align:right">จัดการ</th></tr></thead><tbody>${vehicleRows(data.vehicles)}</tbody></table></div></div>
          <div class="fuel-card"><div class="fuel-card-head"><h3><i class="material-icons-round">local_gas_station</i>ถังน้ำมันร้าน</h3></div><div class="fuel-card-body"><table class="fuel-table"><thead><tr><th>ถัง</th><th>ชนิด</th><th>ความจุ</th><th>คงเหลือ</th><th style="text-align:right">จัดการ</th></tr></thead><tbody>${tankRows(data.tanks)}</tbody></table></div></div>
        </div>
        <div class="fuel-grid">
          <div class="fuel-card"><div class="fuel-card-head"><h3><i class="material-icons-round">history</i>เติมเข้าถังล่าสุด</h3></div><div class="fuel-card-body"><table class="fuel-table"><thead><tr><th>เวลา</th><th>ถัง</th><th>ลิตร</th><th>ยอดเงิน</th></tr></thead><tbody>${data.refills.length ? data.refills.map(r => `<tr><td>${f.esc(f.thDate(r.refilled_at))}</td><td>${f.esc(r.fuel_tank?.name || '-')}</td><td>${f.fmt(r.qty_l)} L</td><td>฿${f.fmt(r.total_cost)}</td></tr>`).join('') : '<tr><td colspan="4"><div class="fuel-empty">ยังไม่มีประวัติเติมเข้า</div></td></tr>'}</tbody></table></div></div>
          <div class="fuel-card"><div class="fuel-card-head"><h3><i class="material-icons-round">speed</i>จดเลขไมล์ล่าสุด</h3></div><div class="fuel-card-body"><table class="fuel-table"><thead><tr><th>เวลา</th><th>รถ</th><th>เลขไมล์</th><th>Variance</th></tr></thead><tbody>${data.odometers.length ? data.odometers.map(o => `<tr><td>${f.esc(f.thDate(o.recorded_at))}</td><td>${f.esc(o.vehicle?.name || '-')}</td><td>${f.fmt(o.odometer_km)} km</td><td><span class="fuel-pill ${o.flag_mismatch ? 'bad' : 'good'}">${f.fmt(o.variance_pct)}%</span></td></tr>`).join('') : '<tr><td colspan="4"><div class="fuel-empty">ยังไม่มีประวัติเลขไมล์</div></td></tr>'}</tbody></table></div></div>
        </div>
        <div class="fuel-card"><div class="fuel-card-head"><h3><i class="material-icons-round">route</i>ทริปใช้รถไปหน้างาน</h3></div><div class="fuel-card-body"><table class="fuel-table"><thead><tr><th>เริ่ม</th><th>รถ</th><th>ปลายทาง</th><th>ระยะ</th><th>สถานะ</th><th style="text-align:right">ทำ</th></tr></thead><tbody>${tripRows}</tbody></table></div></div>`);
    } catch (error) {
      section.querySelector('.fuel-page')?.insertAdjacentHTML('beforeend', `<div class="fuel-schema-warn">โหลดข้อมูลไม่สำเร็จ: ${f.esc(error.message || error)}</div>`);
    }
  };

  window.v84OpenVehicleForm = async function (vehicleId = null) {
    const f = F();
    const existing = vehicleId ? (await f.select(f.TABLES.vehicle, '*')).find(v => String(v.id) === String(vehicleId)) : null;
    const r = await Swal.fire({
      title: existing ? '✏️ แก้ไขรถ' : '🚛 เพิ่มรถใหม่',
      html: `<div class="sk-fuel-form two">
        <div class="sk-fuel-fld"><label><i class="material-icons-round">directions_car</i> ชื่อรถ</label><input id="v84-name" placeholder="เช่น ฮีโน่แดง" value="${f.esc(existing?.name || '')}"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">badge</i> ทะเบียน</label><input id="v84-plate" placeholder="เช่น 2คง-6789" value="${f.esc(existing?.plate_no || '')}"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">local_gas_station</i> ชนิดน้ำมัน</label><select id="v84-fuel"><option>ดีเซล</option><option>เบนซิน</option></select></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">propane_tank</i> ความจุถังรถ (L)</label><input id="v84-cap" type="number" step="0.01" placeholder="เช่น 80" value="${f.esc(existing?.tank_capacity_l || '')}"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">speed</i> ค่าเฉลี่ย km/L</label><input id="v84-avg" type="number" step="0.01" placeholder="เช่น 8.5" value="${f.esc(existing?.avg_kmpl || '')}"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">person</i> พขร. หลัก</label><input id="v84-driver" placeholder="ชื่อคนขับหลัก" value="${f.esc(existing?.driver_default || '')}"></div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: existing ? 'บันทึก' : '✓ เพิ่มรถ',
      cancelButtonText: 'ยกเลิก',
      width: 620,
      customClass: { popup: 'sk-fuel-popup' },
      didOpen: () => { const sel = document.getElementById('v84-fuel'); if (sel && existing?.fuel_type) sel.value = existing.fuel_type; },
      preConfirm: () => {
        const plate = document.getElementById('v84-plate')?.value.trim();
        if (!plate) return Swal.showValidationMessage('กรุณากรอกทะเบียนรถ');
        return {
          name: document.getElementById('v84-name')?.value.trim(),
          plate_no: plate,
          fuel_type: document.getElementById('v84-fuel')?.value,
          tank_capacity_l: f.num(document.getElementById('v84-cap')?.value),
          avg_kmpl: f.num(document.getElementById('v84-avg')?.value),
          driver_default: document.getElementById('v84-driver')?.value.trim(),
          active: true,
        };
      },
    });
    if (!r.isConfirmed) return;
    const q = existing
      ? db.from(F().TABLES.vehicle).update(r.value).eq('id', existing.id)
      : db.from(F().TABLES.vehicle).insert(r.value);
    const { error } = await q;
    if (error) return toast?.('บันทึกรถไม่สำเร็จ: ' + error.message, 'error');
    toast?.('บันทึกรถเรียบร้อย', 'success');
    window.renderFuelVehicleTank?.();
  };

  window.v84OpenTankForm = async function (tankId = null) {
    const f = F();
    const existing = tankId ? (await f.select(f.TABLES.tank, '*')).find(t => String(t.id) === String(tankId)) : null;
    const r = await Swal.fire({
      title: existing ? '✏️ แก้ไขถังน้ำมัน' : '🛢️ เพิ่มถังน้ำมันร้าน',
      html: `<div class="sk-fuel-form two">
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">label</i> ชื่อถัง</label><input id="v84-tank-name" placeholder="ถังดีเซลข้างร้าน" value="${f.esc(existing?.name || '')}"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">local_gas_station</i> ชนิดน้ำมัน</label><select id="v84-tank-fuel"><option>ดีเซล</option><option>เบนซิน</option></select></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">propane_tank</i> ความจุ (L)</label><input id="v84-tank-cap" type="number" step="0.01" placeholder="เช่น 2000" value="${f.esc(existing?.capacity_l || '')}"></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">water_drop</i> คงเหลือปัจจุบัน (L)</label><input id="v84-tank-level" type="number" step="0.01" placeholder="เช่น 1500" value="${f.esc(existing?.current_level_l || '')}"></div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: existing ? 'บันทึก' : '✓ เพิ่มถัง',
      cancelButtonText: 'ยกเลิก',
      width: 580,
      customClass: { popup: 'sk-fuel-popup' },
      didOpen: () => { const sel = document.getElementById('v84-tank-fuel'); if (sel && existing?.fuel_type) sel.value = existing.fuel_type; },
      preConfirm: () => {
        const name = document.getElementById('v84-tank-name')?.value.trim();
        if (!name) return Swal.showValidationMessage('กรุณากรอกชื่อถัง');
        return {
          name,
          fuel_type: document.getElementById('v84-tank-fuel')?.value,
          capacity_l: f.num(document.getElementById('v84-tank-cap')?.value),
          current_level_l: f.num(document.getElementById('v84-tank-level')?.value),
          active: true,
        };
      },
    });
    if (!r.isConfirmed) return;
    const q = existing
      ? db.from(F().TABLES.tank).update(r.value).eq('id', existing.id)
      : db.from(F().TABLES.tank).insert(r.value);
    const { error } = await q;
    if (error) return toast?.('บันทึกถังไม่สำเร็จ: ' + error.message, 'error');
    toast?.('บันทึกถังเรียบร้อย', 'success');
    window.renderFuelVehicleTank?.();
  };

  window.v84OpenTankRefill = async function (tankId) {
    const f = F();
    const r = await Swal.fire({
      title: '⛽ เติมน้ำมันเข้าถังร้าน',
      html: `<div class="sk-fuel-form two">
        <div class="sk-fuel-fld"><label><i class="material-icons-round">water_drop</i> ปริมาณ (L)</label><input id="v84-refill-qty" type="number" step="0.01" placeholder="เช่น 200"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">payments</i> ราคาต่อลิตร</label><input id="v84-refill-price" type="number" step="0.01" placeholder="เช่น 28.50"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">store</i> Supplier</label><input id="v84-refill-supplier" placeholder="ชื่อปั๊ม/ตัวแทน"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">receipt</i> เลขใบส่ง/บิล</label><input id="v84-refill-invoice"></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">note</i> หมายเหตุ</label><textarea id="v84-refill-note"></textarea></div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: '✓ บันทึกเติมเข้า',
      cancelButtonText: 'ยกเลิก',
      width: 600,
      customClass: { popup: 'sk-fuel-popup' },
      preConfirm: () => {
        const qty = f.num(document.getElementById('v84-refill-qty')?.value);
        if (qty <= 0) return Swal.showValidationMessage('กรุณากรอกปริมาณมากกว่า 0');
        const price = f.num(document.getElementById('v84-refill-price')?.value);
        return {
          qty,
          price,
          supplier: document.getElementById('v84-refill-supplier')?.value.trim() || null,
          invoice: document.getElementById('v84-refill-invoice')?.value.trim() || null,
          note: document.getElementById('v84-refill-note')?.value.trim() || null,
        };
      },
    });
    if (!r.isConfirmed) return;
    const params = {
      p_tank_id: Number(tankId), p_qty_l: r.value.qty, p_price_per_l: r.value.price,
      p_supplier: r.value.supplier,
      p_invoice: r.value.invoice,
      p_staff: f.staff(),
      p_note: r.value.note,
    };
    const { error } = await db.rpc('sk_fuel_tank_refill', params);
    if (error) return toast?.('เติมเข้าไม่สำเร็จ: ' + error.message, 'error');
    toast?.('เติมน้ำมันเข้าถังแล้ว', 'success');
    window.renderFuelVehicleTank?.();
  };

  window.v84OpenTrip = async function (vehicleId) {
    const f = F();
    const vehicle = (await f.select(f.TABLES.vehicle, '*')).find(v => String(v.id) === String(vehicleId));
    // ดึงพิกัดร้านเป็น default center
    const { data: shop } = await db.from('shop_config').select('pickup_lat,pickup_lng').eq('id', 1).maybeSingle();
    const shopLat = Number(shop?.pickup_lat || localStorage.getItem('sk_pickup_lat') || 13.7563);
    const shopLng = Number(shop?.pickup_lng || localStorage.getItem('sk_pickup_lng') || 100.5018);
    let pickedLat = null, pickedLng = null;

    const r = await Swal.fire({
      title: `🚛 ออกใช้รถ — ${f.esc(vehicle?.name || vehicleId)}`,
      html: `<div class="sk-fuel-form two">
        <div class="sk-fuel-fld"><label><i class="material-icons-round">person</i> พขร.</label><input id="v84-trip-driver" value="${f.esc(vehicle?.driver_default || '')}"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">flag</i> จุดประสงค์</label><select id="v84-trip-purpose"><option value="survey">ไปดูหน้างาน</option><option value="pickup">ไปรับสินค้า</option><option value="errand">ธุระทั่วไป</option><option value="other">อื่น ๆ</option></select></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">place</i> ปลายทาง (ป้ายชื่อ)</label><input id="v84-trip-dest" placeholder="เช่น สวนหลวง, ไปรับเหล็กที่สมบูรณ์"></div>
        <div class="sk-fuel-fld full">
          <label><i class="material-icons-round">map</i> ปักหมุดปลายทาง (ลากบนแผนที่)</label>
          <div id="v84-trip-map" style="height:240px;border:1.5px solid #cbd5e1;border-radius:11px;overflow:hidden"></div>
          <div id="v84-trip-distinfo" style="font-size:12px;color:#475569;font-weight:850;margin-top:6px">ลากหมุดเลือกปลายทาง ระบบจะคำนวณระยะให้</div>
        </div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">note</i> หมายเหตุ</label><textarea id="v84-trip-note"></textarea></div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: '▶️ เริ่มออกรถ',
      cancelButtonText: 'ยกเลิก',
      width: 680,
      customClass: { popup: 'sk-fuel-popup' },
      didOpen: () => {
        if (typeof L === 'undefined') return;
        const map = L.map('v84-trip-map').setView([shopLat, shopLng], 14);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        const shopIcon = L.divIcon({ html: '<div style="width:34px;height:34px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 4px 10px rgba(220,38,38,.4);display:flex;align-items:center;justify-content:center;color:#fff"><i class="material-icons-round" style="font-size:18px">store</i></div>', iconSize:[34,34], iconAnchor:[17,17], className:'' });
        L.marker([shopLat, shopLng], { icon: shopIcon }).addTo(map).bindTooltip('🏪 ร้าน');
        let dest = null;
        const setDest = (lat, lng) => {
          pickedLat = lat; pickedLng = lng;
          if (!dest) {
            const destIcon = L.divIcon({ html: '<div style="width:34px;height:34px;background:#16a34a;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(22,163,74,.4);display:flex;align-items:center;justify-content:center;color:#fff"><i class="material-icons-round" style="font-size:18px;transform:rotate(45deg)">place</i></div>', iconSize:[34,34], iconAnchor:[17,34], className:'' });
            dest = L.marker([lat, lng], { draggable: true, icon: destIcon }).addTo(map);
            dest.on('dragend', () => { const p = dest.getLatLng(); setDest(p.lat, p.lng); });
          } else {
            dest.setLatLng([lat, lng]);
          }
          const R=6371, toRad=d=>d*Math.PI/180;
          const dLat=toRad(lat-shopLat), dLng=toRad(lng-shopLng);
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(shopLat))*Math.cos(toRad(lat))*Math.sin(dLng/2)**2;
          const km = 2 * R * Math.asin(Math.sqrt(a)) * 1.3;
          const info = document.getElementById('v84-trip-distinfo');
          if (info) info.innerHTML = `<b style="color:#16a34a">${km.toFixed(2)} km</b> · ไป-กลับ ~${(km*2).toFixed(1)} km ${vehicle?.avg_kmpl ? `· ใช้น้ำมัน ~${((km*2)/vehicle.avg_kmpl).toFixed(2)} L` : ''}`;
        };
        map.on('click', e => setDest(e.latlng.lat, e.latlng.lng));
        setTimeout(() => map.invalidateSize(), 200);
      },
      preConfirm: () => ({
        vehicle_id: Number(vehicleId),
        driver_name: document.getElementById('v84-trip-driver')?.value.trim(),
        purpose: document.getElementById('v84-trip-purpose')?.value,
        destination_label: document.getElementById('v84-trip-dest')?.value.trim(),
        pickup_lat: shopLat, pickup_lng: shopLng,
        drop_lat: pickedLat, drop_lng: pickedLng,
        distance_km_estimate: pickedLat ? null : null, // จะเซ็ตข้างล่าง
        note: document.getElementById('v84-trip-note')?.value.trim(),
        staff_name: f.staff(),
        status: 'driving',
      }),
    });
    if (!r.isConfirmed) return;
    // คำนวณ distance_km_estimate
    if (r.value.drop_lat && r.value.drop_lng) {
      const R=6371, toRad=d=>d*Math.PI/180;
      const dLat=toRad(r.value.drop_lat-r.value.pickup_lat), dLng=toRad(r.value.drop_lng-r.value.pickup_lng);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(r.value.pickup_lat))*Math.cos(toRad(r.value.drop_lat))*Math.sin(dLng/2)**2;
      r.value.distance_km_estimate = Math.round((2 * R * Math.asin(Math.sqrt(a)) * 1.3) * 100) / 100;
    }
    const { error } = await db.from(f.TABLES.trip).insert(r.value);
    if (error) return toast?.('เริ่มออกรถไม่สำเร็จ: ' + error.message, 'error');
    toast?.(`▶️ เริ่มออกรถ — ${r.value.destination_label || 'ไม่ระบุปลายทาง'}`, 'success');
    window.renderFuelVehicleTank?.();
  };

  window.v84RecordOdometer = async function (vehicleId) {
    const f = F();
    const r = await Swal.fire({
      title: '📏 จดเลขไมล์',
      html: `<div class="sk-fuel-form">
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">speed</i> เลขไมล์ปัจจุบัน (km)</label><input id="v84-odo" type="number" step="0.1" placeholder="เช่น 85420"></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">note</i> หมายเหตุ</label><textarea id="v84-odo-note"></textarea></div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: '✓ บันทึกเลขไมล์',
      cancelButtonText: 'ยกเลิก',
      width: 520,
      customClass: { popup: 'sk-fuel-popup' },
      preConfirm: () => {
        const odo = f.num(document.getElementById('v84-odo')?.value);
        if (odo <= 0) return Swal.showValidationMessage('กรุณากรอกเลขไมล์');
        return {
          odometer: odo,
          note: document.getElementById('v84-odo-note')?.value.trim() || null,
        };
      },
    });
    if (!r.isConfirmed) return;
    const { data, error } = await db.rpc('sk_record_odometer', {
      p_vehicle_id: Number(vehicleId),
      p_odometer_km: r.value.odometer,
      p_staff: f.staff(),
      p_note: r.value.note,
    });
    if (error) return toast?.('จดเลขไมล์ไม่สำเร็จ: ' + error.message, 'error');
    const flag = data?.flag_mismatch ? ' มีระยะคลาดเคลื่อนเกินเกณฑ์' : '';
    toast?.('บันทึกเลขไมล์แล้ว' + flag, data?.flag_mismatch ? 'warning' : 'success');
    window.renderFuelVehicleTank?.();
  };

  window.v84CompleteTrip = async function (tripId) {
    const f = F();
    const trip = (await f.select(f.TABLES.trip, '*')).find(t => String(t.id) === String(tripId));
    if (!trip) return toast?.('ไม่พบทริปนี้', 'error');
    const { data: veh } = await db.from('vehicle').select('id,name,avg_kmpl,fuel_type').eq('id', trip.vehicle_id).maybeSingle();
    const kmpl = Number(veh?.avg_kmpl || 0);
    const defaultKm = trip.distance_km || trip.distance_km_estimate || 0;
    const fuelPreview = kmpl > 0 ? `~${((defaultKm * 2) / kmpl).toFixed(2)} L` : '—';
    const r = await Swal.fire({
      title: '🏁 จบงานออกรถ — หักน้ำมัน',
      html: `<div class="sk-fuel-form">
        <div style="background:linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%);border:1.5px solid #7dd3fc;border-radius:14px;padding:12px 16px;margin-bottom:8px;display:grid;gap:6px">
          <div style="font-size:11px;font-weight:900;color:#075985;text-transform:uppercase;letter-spacing:.4px">ตัวอย่างการหักน้ำมัน</div>
          <div style="display:flex;justify-content:space-between"><span>รถ:</span><b>${f.esc(veh?.name || '-')}</b></div>
          <div style="display:flex;justify-content:space-between"><span>ระยะ (ไป-กลับ ×2):</span><b>${(defaultKm * 2).toFixed(2)} km</b></div>
          <div style="display:flex;justify-content:space-between"><span>คาดใช้น้ำมัน:</span><b style="color:#0284c7">${fuelPreview}</b></div>
        </div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">straighten</i> ระยะทางจริง (km) — แก้ไขได้</label><input id="v84-trip-done-km" type="number" step="0.01" value="${f.esc(defaultKm || '')}"></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">note</i> หมายเหตุ</label><textarea id="v84-trip-done-note">${f.esc(trip.note || '')}</textarea></div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: '✓ จบงาน + หักน้ำมัน',
      cancelButtonText: 'ยกเลิก',
      width: 520,
      customClass: { popup: 'sk-fuel-popup' },
      preConfirm: () => {
        const km = f.num(document.getElementById('v84-trip-done-km')?.value);
        if (km <= 0) return Swal.showValidationMessage('กรุณากรอกระยะทางจริง');
        return {
          distance_km: km,
          route_source: 'manual',
          status: 'done',
          completed_at: new Date().toISOString(),
          note: document.getElementById('v84-trip-done-note')?.value.trim() || null,
        };
      },
    });
    if (!r.isConfirmed) return;
    const { error } = await db.from(f.TABLES.trip).update(r.value).eq('id', tripId);
    if (error) return toast?.('จบงานไม่สำเร็จ: ' + error.message, 'error');
    // ★ auto-deduct น้ำมัน (ไป-กลับ) จากถังร้าน
    if (typeof window.v90AutoDeductFuel === 'function' && veh?.avg_kmpl) {
      await window.v90AutoDeductFuel({
        billId: 'TRIP-' + tripId,
        vehicleId: veh.id,
        vehicleKmpl: veh.avg_kmpl,
        distanceKm: r.value.distance_km,
        note: `auto: ทริปออกรถ (${trip.destination_label || trip.purpose})`,
      });
    } else {
      toast?.('จบทริปแล้ว', 'success');
    }
    window.renderFuelVehicleTank?.();
  };

  console.log('[v84] fuel vehicle/tank loaded');
})();
