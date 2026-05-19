(function () {
  'use strict';

  const F = () => window.SK_FUEL;

  async function loadData() {
    const f = F();
    const [tanks, vehicles, deliveries, dispenses] = await Promise.all([
      f.select(f.TABLES.tank, '*', { order: 'name' }),
      f.select(f.TABLES.vehicle, '*', { order: 'name' }),
      f.select(f.TABLES.delivery, '*', { order: 'created_at', ascending: false, limit: 80 }),
      f.select(f.TABLES.dispense, '*,vehicle(name,plate_no),fuel_tank(name,fuel_type)', { order: 'dispensed_at', ascending: false, limit: 30 }),
    ]);
    return { tanks, vehicles, deliveries, dispenses };
  }

  function pendingDeliveryOptions(deliveries) {
    const f = F();
    return deliveries
      .filter(d => d.status !== 'done' && d.status !== 'cancel')
      .map(d => `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px">
        <input type="checkbox" class="v85-bill" value="${f.esc(d.bill_id)}">
        <span><b>#${f.esc(d.bill_id || '-')}</b> ${f.esc(d.drop_address || '')} ${d.distance_km_estimate ? `· ~${f.fmt(d.distance_km_estimate)} km` : ''}</span>
      </label>`)
      .join('') || '<div style="color:#64748b;font-weight:800">ยังไม่มีงานส่งที่รอผูกน้ำมัน</div>';
  }

  window.renderFuelDispense = async function () {
    const f = F();
    f.injectStyle();
    const section = document.getElementById('page-fuel-dispense');
    if (!section) return;
    section.innerHTML = f.pageShell('local_gas_station', 'จ่ายน้ำมันออก', 'บันทึกน้ำมันจากถังร้านเข้ารถ พร้อมผูกบิลส่งของ',
      `<button class="fuel-btn" onclick="v85OpenDispenseForm()"><i class="material-icons-round">local_gas_station</i>บันทึกจ่ายน้ำมัน</button>
       <button class="fuel-btn secondary" onclick="v85OpenExternalRefill()"><i class="material-icons-round">receipt_long</i>เติมนอกปั๊ม</button>`);
    try {
      const schema = await f.schemaStatus();
      if (!schema.ready) {
        section.querySelector('.fuel-page').insertAdjacentHTML('beforeend', f.schemaWarning(schema.missing));
        return;
      }
      const data = await loadData();
      window.__v85FuelData = data;
      const today = f.todayKey();
      const todayDispenses = data.dispenses.filter(d => String(d.dispensed_at || '').slice(0, 10) === today);
      const todayLiters = todayDispenses.reduce((s, d) => s + f.num(d.qty_l), 0);
      const linked = data.dispenses.filter(d => {
        try { return Array.isArray(d.bill_ids) ? d.bill_ids.length : JSON.parse(d.bill_ids || '[]').length; } catch (_) { return false; }
      }).length;
      section.querySelector('.fuel-page').insertAdjacentHTML('beforeend', `
        <div class="fuel-grid three">
          <div class="fuel-kpi"><div class="dot" style="background:#16a34a"><i class="material-icons-round">water_drop</i></div><div><b>${f.fmt(todayLiters)} L</b><span>จ่ายออกวันนี้</span></div></div>
          <div class="fuel-kpi"><div class="dot"><i class="material-icons-round">local_gas_station</i></div><div><b>${data.tanks.length}</b><span>ถังใช้งาน</span></div></div>
          <div class="fuel-kpi"><div class="dot" style="background:#f59e0b"><i class="material-icons-round">link</i></div><div><b>${linked}</b><span>รายการที่ผูกบิลแล้ว</span></div></div>
        </div>
        <div class="fuel-card"><div class="fuel-card-head"><h3><i class="material-icons-round">history</i>ประวัติจ่ายน้ำมัน</h3></div>
          <div class="fuel-card-body"><table class="fuel-table">
            <thead><tr><th>เวลา</th><th>ถัง</th><th>รถ</th><th>ลิตร</th><th>เลขไมล์</th><th>บิลที่ผูก</th><th>ผู้บันทึก</th></tr></thead>
            <tbody>${data.dispenses.length ? data.dispenses.map(d => {
              let billIds = [];
              try { billIds = Array.isArray(d.bill_ids) ? d.bill_ids : JSON.parse(d.bill_ids || '[]'); } catch (_) {}
              return `<tr>
                <td>${f.esc(f.thDate(d.dispensed_at))}</td>
                <td>${f.esc(d.fuel_tank?.name || '-')}</td>
                <td><b>${f.esc(d.vehicle?.name || '-')}</b><div style="color:#64748b;font-size:12px">${f.esc(d.vehicle?.plate_no || '')}</div></td>
                <td><span class="fuel-pill good">${f.fmt(d.qty_l)} L</span></td>
                <td>${d.odometer_km ? f.fmt(d.odometer_km) + ' km' : '-'}</td>
                <td>${billIds.length ? billIds.map(id => `<span class="fuel-pill gray">#${f.esc(id)}</span>`).join(' ') : '<span class="fuel-pill warn">ยังไม่ผูก</span>'}</td>
                <td>${f.esc(d.staff_name || '-')}</td>
              </tr>`;
            }).join('') : '<tr><td colspan="7"><div class="fuel-empty"><i class="material-icons-round">local_gas_station</i>ยังไม่มีประวัติจ่ายน้ำมัน</div></td></tr>'}</tbody>
          </table></div>
        </div>`);
    } catch (error) {
      section.querySelector('.fuel-page')?.insertAdjacentHTML('beforeend', `<div class="fuel-schema-warn">โหลดข้อมูลไม่สำเร็จ: ${f.esc(error.message || error)}</div>`);
    }
  };

  window.v85OpenDispenseForm = async function () {
    const f = F();
    const data = window.__v85FuelData || await loadData();
    if (!data.tanks.length || !data.vehicles.length) {
      return Swal.fire({ icon: 'warning', title: 'ต้องมีถังและรถก่อน', text: 'เพิ่มทะเบียนรถและถังน้ำมันก่อนบันทึกจ่ายน้ำมัน' });
    }
    const tankOptions = data.tanks.map(t => `<option value="${f.esc(t.id)}">${f.esc(t.name)} · ${f.esc(t.fuel_type)} · คงเหลือ ${f.fmt(t.current_level_l)} L</option>`).join('');
    const vehicleOptions = data.vehicles.map(v => `<option value="${f.esc(v.id)}" data-avg="${f.esc(v.avg_kmpl || 0)}">${f.esc(v.name || v.plate_no)} · ${f.esc(v.plate_no || '')}</option>`).join('');
    const r = await Swal.fire({
      title: '⛽ บันทึกจ่ายน้ำมันออก',
      width: 680,
      html: `<div class="sk-fuel-form two">
        <div class="sk-fuel-fld"><label><i class="material-icons-round">propane_tank</i> ถัง</label><select id="v85-tank">${tankOptions}</select></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">directions_car</i> รถ</label><select id="v85-vehicle">${vehicleOptions}</select></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">water_drop</i> ปริมาณ (ลิตร)</label><input id="v85-qty" type="number" step="0.01" placeholder="เช่น 25"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">speed</i> เลขไมล์ (ไม่บังคับ)</label><input id="v85-odo" type="number" step="0.1"></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">receipt_long</i> ผูกกับบิลที่จะส่ง</label><div style="max-height:160px;overflow:auto;border:1.5px solid #cbd5e1;border-radius:11px;padding:10px;background:#f8fafc">${pendingDeliveryOptions(data.deliveries)}</div></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">note</i> หมายเหตุ</label><textarea id="v85-note"></textarea></div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: '✓ บันทึกจ่ายน้ำมัน',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'sk-fuel-popup' },
      preConfirm: () => {
        const qty = f.num(document.getElementById('v85-qty')?.value);
        if (qty <= 0) return Swal.showValidationMessage('กรุณากรอกปริมาณมากกว่า 0');
        return {
          tankId: Number(document.getElementById('v85-tank')?.value),
          vehicleId: Number(document.getElementById('v85-vehicle')?.value),
          qty,
          odometer: f.num(document.getElementById('v85-odo')?.value) || null,
          billIds: [...document.querySelectorAll('.v85-bill:checked')].map(el => el.value),
          note: document.getElementById('v85-note')?.value.trim() || null,
        };
      },
    });
    if (!r.isConfirmed) return;
    const { error } = await db.rpc('sk_fuel_dispense', {
      p_tank_id: r.value.tankId,
      p_vehicle_id: r.value.vehicleId,
      p_qty_l: r.value.qty,
      p_bill_ids: r.value.billIds,
      p_staff: f.staff(),
      p_note: r.value.note,
      p_odometer: r.value.odometer,
    });
    if (error) return toast?.('จ่ายน้ำมันไม่สำเร็จ: ' + error.message, 'error');
    toast?.('บันทึกจ่ายน้ำมันแล้ว', 'success');
    window.__v85FuelData = null;
    window.renderFuelDispense?.();
  };

  window.v85OpenExternalRefill = async function () {
    const f = F();
    const data = window.__v85FuelData || await loadData();
    if (!data.vehicles.length) return Swal.fire({ icon: 'warning', title: 'ยังไม่มีรถ', text: 'เพิ่มทะเบียนรถก่อน' });
    const vehicleOptions = data.vehicles.map(v => `<option value="${f.esc(v.id)}">${f.esc(v.name || v.plate_no)} · ${f.esc(v.plate_no || '')}</option>`).join('');
    const r = await Swal.fire({
      title: '🏪 เติมน้ำมันจากปั๊มนอก',
      html: `<div class="sk-fuel-form two">
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">directions_car</i> รถ</label><select id="v85-ext-vehicle">${vehicleOptions}</select></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">water_drop</i> ปริมาณ (ลิตร)</label><input id="v85-ext-qty" type="number" step="0.01"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">payments</i> ราคาต่อลิตร</label><input id="v85-ext-price" type="number" step="0.01"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">store</i> ชื่อปั๊ม</label><input id="v85-ext-station"></div>
        <div class="sk-fuel-fld"><label><i class="material-icons-round">receipt</i> เลขใบเสร็จ</label><input id="v85-ext-receipt"></div>
        <div class="sk-fuel-fld full"><label><i class="material-icons-round">note</i> หมายเหตุ</label><textarea id="v85-ext-note"></textarea></div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: '✓ บันทึกเติมนอก',
      cancelButtonText: 'ยกเลิก',
      width: 600,
      customClass: { popup: 'sk-fuel-popup' },
      preConfirm: () => {
        const qty = f.num(document.getElementById('v85-ext-qty')?.value);
        if (qty <= 0) return Swal.showValidationMessage('กรุณากรอกปริมาณมากกว่า 0');
        const price = f.num(document.getElementById('v85-ext-price')?.value);
        return {
          vehicle_id: Number(document.getElementById('v85-ext-vehicle')?.value),
          qty_l: qty,
          price_per_l: price,
          total_cost: qty * price,
          station_name: document.getElementById('v85-ext-station')?.value.trim() || null,
          receipt_no: document.getElementById('v85-ext-receipt')?.value.trim() || null,
          staff_name: f.staff(),
          note: document.getElementById('v85-ext-note')?.value.trim() || null,
        };
      },
    });
    if (!r.isConfirmed) return;
    const { error } = await db.from(f.TABLES.externalRefill).insert(r.value);
    if (error) return toast?.('บันทึกเติมนอกไม่สำเร็จ: ' + error.message, 'error');
    toast?.('บันทึกเติมน้ำมันนอกปั๊มแล้ว', 'success');
    window.__v85FuelData = null;
    window.renderFuelDispense?.();
  };

  console.log('[v85] fuel dispense loaded');
})();
