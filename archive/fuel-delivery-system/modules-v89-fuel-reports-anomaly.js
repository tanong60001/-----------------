(function () {
  'use strict';

  const F = () => window.SK_FUEL;

  window.renderFuelReports = async function () {
    const f = F();
    f.injectStyle();
    const section = document.getElementById('page-fuel-report');
    if (!section) return;
    const date = window.__v89ReportDate || f.todayKey();
    section.innerHTML = f.pageShell('analytics', 'รายงานรถ/น้ำมัน', 'สรุประยะทาง น้ำมัน km/L และรายการผิดปกติ',
      `<input type="date" class="fuel-btn secondary" style="color:#0f172a" value="${f.esc(date)}" onchange="window.__v89ReportDate=this.value;renderFuelReports()">
       <button class="fuel-btn secondary" onclick="renderFuelReports()"><i class="material-icons-round">refresh</i>รีเฟรช</button>`);
    try {
      const schema = await f.schemaStatus();
      if (!schema.ready) {
        section.querySelector('.fuel-page').insertAdjacentHTML('beforeend', f.schemaWarning(schema.missing));
        return;
      }
      const [summary, dispenses, assignments, trips] = await Promise.all([
        db.from(f.TABLES.dailySummary).select('*').eq('day', date),
        db.from(f.TABLES.dispense).select('*,vehicle(name,plate_no)').gte('dispensed_at', date + 'T00:00:00').lte('dispensed_at', date + 'T23:59:59'),
        db.from(f.TABLES.delivery).select('*,vehicle(name,plate_no)').gte('completed_at', date + 'T00:00:00').lte('completed_at', date + 'T23:59:59'),
        db.from(f.TABLES.trip).select('*,vehicle(name,plate_no)').gte('started_at', date + 'T00:00:00').lte('started_at', date + 'T23:59:59'),
      ]);
      if (summary.error) throw summary.error;
      if (dispenses.error) throw dispenses.error;
      if (assignments.error) throw assignments.error;
      if (trips.error) throw trips.error;

      const sumRows = summary.data || [];
      const totalKm = sumRows.reduce((s, r) => s + f.num(r.total_km), 0);
      const totalFuel = sumRows.reduce((s, r) => s + f.num(r.total_fuel_l), 0);
      const totalCost = sumRows.reduce((s, r) => s + f.num(r.total_fuel_cost), 0);
      const anomalies = [];
      (dispenses.data || []).forEach(d => {
        let ids = [];
        try { ids = Array.isArray(d.bill_ids) ? d.bill_ids : JSON.parse(d.bill_ids || '[]'); } catch (_) {}
        if (!ids.length) anomalies.push({ level: 'warn', code: 'fuel_no_bill', text: `จ่ายน้ำมัน ${f.fmt(d.qty_l)} L ให้ ${d.vehicle?.name || '-'} แต่ยังไม่ผูกบิล`, at: d.dispensed_at });
      });
      (assignments.data || []).forEach(a => {
        if (a.status === 'done' && !f.num(a.actual_fuel_l)) anomalies.push({ level: 'info', code: 'bill_no_fuel', text: `บิล #${a.bill_id} ส่งสำเร็จ แต่ยังไม่พบน้ำมันที่ผูก`, at: a.completed_at });
        const flags = Array.isArray(a.anomaly_flags) ? a.anomaly_flags : [];
        flags.forEach(flag => anomalies.push({ level: 'bad', code: flag, text: `บิล #${a.bill_id}: ${flag}`, at: a.completed_at }));
      });
      (trips.data || []).forEach(t => {
        if (t.status !== 'done' && String(t.started_at || '').slice(0, 10) === date) anomalies.push({ level: 'warn', code: 'open_trip', text: `ทริป ${t.destination_label || t.purpose || '-'} ยังไม่ปิดงาน`, at: t.started_at });
      });

      section.querySelector('.fuel-page').insertAdjacentHTML('beforeend', `
        <div class="fuel-grid three">
          <div class="fuel-kpi"><div class="dot"><i class="material-icons-round">route</i></div><div><b>${f.fmt(totalKm)} km</b><span>ระยะรวม</span></div></div>
          <div class="fuel-kpi"><div class="dot" style="background:#16a34a"><i class="material-icons-round">local_gas_station</i></div><div><b>${f.fmt(totalFuel)} L</b><span>น้ำมันรวม</span></div></div>
          <div class="fuel-kpi"><div class="dot" style="background:#f59e0b"><i class="material-icons-round">payments</i></div><div><b>฿${f.fmt(totalCost)}</b><span>ค่าน้ำมัน</span></div></div>
        </div>
        <div class="fuel-card"><div class="fuel-card-head"><h3><i class="material-icons-round">summarize</i>สรุปต่อรถ</h3></div>
          <div class="fuel-card-body"><table class="fuel-table"><thead><tr><th>รถ</th><th>งานส่ง</th><th>km รวม</th><th>น้ำมัน</th><th>km/L จริง</th><th>Baseline</th><th>ค่าน้ำมัน</th></tr></thead>
          <tbody>${sumRows.length ? sumRows.map(r => {
            const kmpl = f.num(r.actual_kmpl);
            const base = f.num(r.baseline_kmpl);
            const tone = base > 0 && kmpl > 0 && kmpl < base * 0.6 ? 'bad' : 'good';
            return `<tr>
              <td><b>${f.esc(r.vehicle_name || '-')}</b><div style="color:#64748b;font-size:12px">${f.esc(r.plate_no || '')}</div></td>
              <td>${f.fmt(r.delivery_count)}</td>
              <td>${f.fmt(r.total_km)} km</td>
              <td>${f.fmt(r.total_fuel_l)} L</td>
              <td><span class="fuel-pill ${tone}">${r.actual_kmpl == null ? '-' : f.fmt(r.actual_kmpl)}</span></td>
              <td>${r.baseline_kmpl == null ? '-' : f.fmt(r.baseline_kmpl)}</td>
              <td>฿${f.fmt(r.total_fuel_cost)}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="7"><div class="fuel-empty"><i class="material-icons-round">analytics</i>ยังไม่มีข้อมูลสรุปของวันนี้</div></td></tr>'}</tbody></table></div>
        </div>
        <div class="fuel-card"><div class="fuel-card-head"><h3><i class="material-icons-round">warning</i>รายการที่ควรตรวจ</h3></div>
          <div class="fuel-card-body"><table class="fuel-table"><thead><tr><th>เวลา</th><th>รหัส</th><th>รายละเอียด</th></tr></thead>
          <tbody>${anomalies.length ? anomalies.map(a => `<tr><td>${f.esc(f.thDate(a.at))}</td><td><span class="fuel-pill ${a.level === 'bad' ? 'bad' : a.level === 'warn' ? 'warn' : 'gray'}">${f.esc(a.code)}</span></td><td>${f.esc(a.text)}</td></tr>`).join('') : '<tr><td colspan="3"><div class="fuel-empty"><i class="material-icons-round">check_circle</i>ยังไม่พบรายการผิดปกติ</div></td></tr>'}</tbody></table></div>
        </div>`);
    } catch (error) {
      section.querySelector('.fuel-page')?.insertAdjacentHTML('beforeend', `<div class="fuel-schema-warn">โหลดรายงานไม่สำเร็จ: ${f.esc(error.message || error)}</div>`);
    }
  };

  console.log('[v89] fuel reports loaded');
})();
