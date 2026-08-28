/**
 * SK POS — Fuel inventory ledger
 * รับน้ำมันเข้า / เติมให้รถ / คงเหลือและประวัติย้อนหลัง
 */
(function (root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root || !root.document) return;

  const TABLE = 'fuel_transactions';
  const COLUMNS = 'id,transaction_type,fuel_type,occurred_at,liters,vehicle_plate,driver_name,supplier,odometer_km,note,staff_name,created_at';
  const DIESEL = 'ดีเซล';
  const fuelTypes = [DIESEL];
  const state = {
    rows: [],
    type: 'ทั้งหมด',
    month: api.localMonthKey(new Date()),
    search: '',
    loading: false,
    requestId: 0,
    channel: null,
    refreshTimer: null,
    databaseReady: null,
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function currentUser() {
    try { return typeof USER !== 'undefined' ? USER : root.USER; }
    catch (_) { return root.USER; }
  }

  function database() {
    try { return typeof db !== 'undefined' ? db : root.db; }
    catch (_) { return root.db; }
  }

  function fmtLiters(value) {
    return api.number(value).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }

  function localDateTimeInput(date) {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
  }

  function renderShell() {
    const section = document.getElementById('page-fuel');
    if (!section) return;
    section.innerHTML = `
      <div class="fuel-page">
        <section class="fuel-hero fuel-hero-minimal">
          <div class="fuel-hero-main">
            <div class="fuel-hero-icon"><i class="material-icons-round">local_gas_station</i></div>
            <div>
              <span class="fuel-eyebrow">DIESEL LEDGER</span>
              <h2>น้ำมันดีเซล</h2>
              <p>บันทึกรับเข้าและเติมรถแบบเรียบง่าย</p>
            </div>
          </div>
          <div class="fuel-hero-balance"><span>คงเหลือ</span><strong id="fuel-hero-stock">—</strong><small>ลิตร</small></div>
          <div class="fuel-hero-actions">
            <button class="fuel-action receive" type="button" onclick="fuelOpenEntry('receive')"><i class="material-icons-round">add_circle</i> รับน้ำมันเข้า</button>
            <button class="fuel-action dispense" type="button" onclick="fuelOpenEntry('dispense')"><i class="material-icons-round">local_shipping</i> เติมน้ำมันให้รถ</button>
          </div>
        </section>

        <section class="fuel-stat-grid">
          <article class="fuel-stat stock"><div class="fuel-stat-icon"><i class="material-icons-round">water_drop</i></div><div class="fuel-stat-copy"><div class="fuel-stat-label">น้ำมันคงเหลือรวม</div><div class="fuel-stat-value" id="fuel-stat-stock">—</div></div></article>
          <article class="fuel-stat in"><div class="fuel-stat-icon"><i class="material-icons-round">south_west</i></div><div class="fuel-stat-copy"><div class="fuel-stat-label">รับเข้าวันนี้</div><div class="fuel-stat-value" id="fuel-stat-in">—</div></div></article>
          <article class="fuel-stat out"><div class="fuel-stat-icon"><i class="material-icons-round">north_east</i></div><div class="fuel-stat-copy"><div class="fuel-stat-label">ใช้ไปวันนี้</div><div class="fuel-stat-value" id="fuel-stat-out">—</div></div></article>
          <article class="fuel-stat vehicle"><div class="fuel-stat-icon"><i class="material-icons-round">airport_shuttle</i></div><div class="fuel-stat-copy"><div class="fuel-stat-label">รถที่เติมวันนี้</div><div class="fuel-stat-value" id="fuel-stat-vehicles">—</div></div></article>
        </section>

        <section class="fuel-history-panel">
          <div class="fuel-history-head">
            <div class="fuel-panel-heading" style="margin-bottom:0"><div class="fuel-panel-title"><i class="material-icons-round">history</i> ประวัติการเคลื่อนไหว</div><div class="fuel-panel-note" id="fuel-history-count">กำลังโหลด...</div></div>
            <div class="fuel-toolbar fuel-toolbar-minimal">
              <input class="fuel-control" id="fuel-search" type="search" placeholder="ค้นหาทะเบียนรถ คนขับ หรือผู้จำหน่าย">
              <input class="fuel-control" id="fuel-month-filter" type="month" value="${esc(state.month)}">
              <button class="fuel-reset-btn" type="button" onclick="fuelResetFilters()">ล้างตัวกรอง</button>
            </div>
          </div>
          <div id="fuel-data-area">
            <div class="fuel-empty"><i class="material-icons-round">hourglass_top</i>กำลังโหลดข้อมูลน้ำมัน...</div>
          </div>
        </section>
      </div>`;

    document.getElementById('fuel-search')?.addEventListener('input', event => {
      state.search = event.target.value;
      renderHistory();
    });
    document.getElementById('fuel-month-filter')?.addEventListener('change', event => {
      state.month = event.target.value;
      renderHistory();
    });
  }

  function setStat(id, value, unit) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = `${esc(value)}${unit ? `<span class="fuel-stat-unit">${esc(unit)}</span>` : ''}`;
  }

  function renderSummary() {
    const summary = api.summarize(state.rows, new Date());
    setStat('fuel-stat-stock', fmtLiters(summary.stock), 'ลิตร');
    const heroStock = document.getElementById('fuel-hero-stock');
    if (heroStock) heroStock.textContent = fmtLiters(summary.stock);
    setStat('fuel-stat-in', fmtLiters(summary.receivedToday), 'ลิตร');
    setStat('fuel-stat-out', fmtLiters(summary.dispensedToday), 'ลิตร');
    setStat('fuel-stat-vehicles', summary.vehicleCount.toLocaleString('th-TH'), 'คัน');

    const balances = api.balanceByType(state.rows);
    const max = Math.max(1, ...fuelTypes.map(type => Math.max(0, balances[type] || 0)));
    const tankGrid = document.getElementById('fuel-tank-grid');
    if (tankGrid) tankGrid.innerHTML = fuelTypes.map(type => {
      const amount = balances[type] || 0;
      const width = Math.min(100, Math.max(0, amount / max * 100));
      return `<article class="fuel-tank-card"><div class="name">${esc(type)}</div><div class="amount">${fmtLiters(amount)} <small>ลิตร</small></div><div class="fuel-tank-track"><span style="width:${width.toFixed(1)}%"></span></div></article>`;
    }).join('');
  }

  function transactionRow(row, mobile) {
    const receive = row.transaction_type === 'receive';
    const date = new Date(row.occurred_at || row.created_at);
    const dateText = Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    const timeText = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const subject = receive ? (row.supplier || 'รับเข้าโดยไม่ระบุผู้จำหน่าย') : (row.vehicle_plate || '-');
    const sub = receive ? (row.staff_name || '-') : (row.driver_name || '-');
    const note = row.note || (row.odometer_km ? `เลขไมล์ ${api.number(row.odometer_km).toLocaleString('th-TH')} กม.` : '-');
    const canDelete = currentUser()?.role === 'admin';
    const kind = `<span class="fuel-kind ${receive ? 'receive' : 'dispense'}"><i class="material-icons-round">${receive ? 'south_west' : 'north_east'}</i>${receive ? 'รับเข้า' : 'เติมรถ'}</span>`;
    const liters = `<span class="fuel-liters ${receive ? 'receive' : 'dispense'}">${receive ? '+' : '−'}${fmtLiters(row.liters)} ลิตร</span>`;
    const del = canDelete ? `<button class="fuel-delete" type="button" onclick="fuelDeleteTransaction('${esc(row.id)}')" title="ลบรายการ"><i class="material-icons-round">delete_outline</i></button>` : '';

    if (mobile) return `<article class="fuel-mobile-card"><div class="fuel-mobile-top">${kind}${liters}</div><div class="fuel-mobile-main"><div><strong>${esc(subject)}</strong><small>${receive ? 'ผู้บันทึก' : 'คนขับ'}: ${esc(sub)}</small></div><span style="font-size:11px;color:#64748b">${esc(row.fuel_type)}</span></div><div class="fuel-mobile-foot"><span>${esc(dateText)} ${esc(timeText)} · ${esc(note)}</span>${del}</div></article>`;
    return `<tr><td class="fuel-time"><strong>${esc(dateText)}</strong><small>${esc(timeText)}</small></td><td>${kind}</td><td><strong>${esc(row.fuel_type || '-')}</strong></td><td class="fuel-vehicle"><strong>${esc(subject)}</strong><small>${receive ? 'ผู้บันทึก' : 'คนขับ'}: ${esc(sub)}</small></td><td>${liters}</td><td class="fuel-note">${esc(note)}</td><td>${del}</td></tr>`;
  }

  function renderHistory() {
    const rows = api.filterTransactions(state.rows, { type: state.type, month: state.month, search: state.search });
    const count = document.getElementById('fuel-history-count');
    if (count) count.textContent = `${rows.length.toLocaleString('th-TH')} รายการ`;
    const area = document.getElementById('fuel-data-area');
    if (!area) return;
    if (!rows.length) {
      area.innerHTML = `<div class="fuel-empty"><i class="material-icons-round">inbox</i><strong>ยังไม่มีรายการในช่วงที่เลือก</strong><div style="margin-top:4px;font-size:12px">กด “รับน้ำมันเข้า” หรือ “เติมน้ำมันให้รถ” เพื่อเริ่มบันทึก</div></div>`;
      return;
    }
    area.innerHTML = `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>วันและเวลา</th><th>ประเภท</th><th>ชนิดน้ำมัน</th><th>ทะเบียน / ผู้เกี่ยวข้อง</th><th>จำนวน</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>${rows.map(row => transactionRow(row, false)).join('')}</tbody></table></div><div class="fuel-mobile-list">${rows.map(row => transactionRow(row, true)).join('')}</div>`;
  }

  function renderInstallError(error) {
    const area = document.getElementById('fuel-data-area');
    if (!area) return;
    area.innerHTML = `<div class="fuel-install-card"><i class="material-icons-round">database</i><div><h3>ยังไม่พบฐานข้อมูลน้ำมัน</h3><p>ติดตั้งไฟล์ <strong>migrations/fuel_inventory.sql</strong> ใน Supabase SQL Editor ก่อนเริ่มใช้งาน<br><small>${esc(error?.message || 'ไม่สามารถอ่านตาราง fuel_transactions')}</small></p><button type="button" onclick="fuelShowInstallHelp()">ดูวิธีติดตั้ง</button></div></div>`;
    ['fuel-stat-stock', 'fuel-stat-in', 'fuel-stat-out', 'fuel-stat-vehicles'].forEach(id => setStat(id, '—'));
  }

  async function loadFuelData() {
    const requestId = ++state.requestId;
    state.loading = true;
    try {
      if (navigator.onLine !== false && root.SK_FORCE_OFFLINE !== true && typeof database()?.rpc === 'function') {
        const health = await database().rpc('sk_fuel_health');
        if (health?.error || health?.data !== true) throw health?.error || new Error('ไม่พบฟังก์ชันตรวจสอบฐานข้อมูลน้ำมัน');
        state.databaseReady = true;
        if (typeof root.SK_OFFLINE?.flushQueue === 'function') await root.SK_OFFLINE.flushQueue();
      }
      const fetcher = typeof fetchAllRows === 'function' ? fetchAllRows : null;
      let rows;
      if (fetcher) {
        rows = await fetcher(TABLE, COLUMNS, query => query.order('occurred_at', { ascending: false }));
      } else {
        const result = await database().from(TABLE).select(COLUMNS).order('occurred_at', { ascending: false });
        if (result.error) throw result.error;
        rows = result.data || [];
      }
      if (requestId !== state.requestId) return;
      state.rows = (rows || []).filter(row => !row.fuel_type || row.fuel_type === DIESEL)
        .map(row => ({ ...row, fuel_type: DIESEL }))
        .sort((a, b) => String(b.occurred_at || '').localeCompare(String(a.occurred_at || '')));
      renderSummary();
      renderHistory();
    } catch (error) {
      state.databaseReady = false;
      console.error('[v108] fuel load error:', error);
      if (requestId === state.requestId) renderInstallError(error);
    } finally {
      state.loading = false;
    }
  }

  async function renderFuelLedger() {
    renderShell();
    subscribeRealtime();
    await loadFuelData();
  }

  function subscribeRealtime() {
    if (state.channel || typeof database()?.channel !== 'function') return;
    state.channel = database().channel('fuel-ledger-v108')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
        clearTimeout(state.refreshTimer);
        state.refreshTimer = setTimeout(() => {
          const section = document.getElementById('page-fuel');
          if (section && !section.classList.contains('hidden')) loadFuelData();
        }, 180);
      })
      .subscribe();
  }

  function fuelOpenEntry(kind) {
    const receive = kind === 'receive';
    const balances = api.balanceByType(state.rows);
    const available = balances[DIESEL] || 0;
    const intro = receive
      ? `<div class="fuel-form-intro receive"><i class="material-icons-round">add_circle</i><div><strong>รับน้ำมันดีเซลเข้าคลัง</strong><span>จำนวนที่บันทึกจะเพิ่มในยอดคงเหลือ</span></div></div>`
      : `<div class="fuel-form-intro dispense"><i class="material-icons-round">local_shipping</i><div><strong>เติมดีเซลให้รถ</strong><span>บันทึกทะเบียนและคนขับตามเวลาที่เติมจริง</span></div></div>`;
    const specificFields = receive
      ? `<div class="form-group"><label class="form-label">ผู้จำหน่าย / แหล่งรับ</label><input class="form-input" id="fuel-supplier" maxlength="120" placeholder="เช่น ปั๊ม ปตท. / รถส่งน้ำมัน"></div>`
      : `<div class="fuel-form-grid"><div class="form-group"><label class="form-label">ทะเบียนรถ *</label><input class="form-input" id="fuel-plate" maxlength="40" required placeholder="เช่น 83-1234 กาฬสินธุ์" list="fuel-plate-list"><datalist id="fuel-plate-list">${api.uniqueValues(state.rows, 'vehicle_plate').map(value => `<option value="${esc(value)}"></option>`).join('')}</datalist></div><div class="form-group"><label class="form-label">คนขับ ณ เวลานั้น *</label><input class="form-input" id="fuel-driver" maxlength="120" required placeholder="ชื่อคนขับ" list="fuel-driver-list"><datalist id="fuel-driver-list">${api.uniqueValues(state.rows, 'driver_name').map(value => `<option value="${esc(value)}"></option>`).join('')}</datalist></div></div><div class="form-group"><label class="form-label">เลขไมล์ (กม.)</label><input class="form-input" id="fuel-odometer" type="number" min="0" step="0.1" placeholder="ไม่บังคับ"></div>`;

    fuelCloseDrawer(true);
    const overlay = document.createElement('div');
    overlay.id = 'fuel-drawer-overlay';
    overlay.className = 'fuel-drawer-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = `
      <aside class="fuel-drawer" role="dialog" aria-modal="true" aria-labelledby="fuel-drawer-title">
        <header class="fuel-drawer-header">
          <div><span class="fuel-drawer-eyebrow">บันทึกน้ำมันดีเซล</span><h2 id="fuel-drawer-title">${receive ? 'รับน้ำมันเข้า' : 'เติมน้ำมันให้รถ'}</h2></div>
          <button type="button" onclick="fuelCloseDrawer()" aria-label="ปิด"><i class="material-icons-round">close</i></button>
        </header>
        <div class="fuel-drawer-body">
          ${intro}
          <div class="fuel-diesel-summary"><span><i class="material-icons-round">local_gas_station</i> ดีเซล</span><div><small>คงเหลือปัจจุบัน</small><strong>${fmtLiters(available)} ลิตร</strong></div></div>
          <form class="fuel-form" id="fuel-entry-form" data-kind="${kind}">
            <div class="fuel-form-grid">
              <div class="form-group"><label class="form-label">จำนวนลิตร *</label><input class="form-input fuel-liters-input" id="fuel-liters" type="number" min="0.001" step="0.001" required placeholder="0.000"></div>
              <div class="form-group"><label class="form-label">วันและเวลา *</label><input class="form-input" id="fuel-occurred" type="datetime-local" value="${localDateTimeInput(new Date())}" required></div>
            </div>
            ${specificFields}
            <div class="form-group"><label class="form-label">หมายเหตุ</label><textarea class="form-input" id="fuel-note" rows="3" maxlength="500" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"></textarea></div>
          </form>
        </div>
        <footer class="fuel-drawer-footer">
          <button class="fuel-drawer-cancel" type="button" onclick="fuelCloseDrawer()">ยกเลิก</button>
          <button class="fuel-form-submit ${receive ? '' : 'dispense'}" id="fuel-submit" type="submit" form="fuel-entry-form"><i class="material-icons-round">save</i>${receive ? 'บันทึกรับเข้า' : 'บันทึกการเติมรถ'}</button>
        </footer>
      </aside>`;
    overlay.addEventListener('mousedown', event => { if (event.target === overlay) fuelCloseDrawer(); });
    document.body.appendChild(overlay);
    document.body.classList.add('fuel-drawer-open');
    requestAnimationFrame(() => overlay.classList.add('show'));
    document.getElementById('fuel-entry-form').onsubmit = event => {
      event.preventDefault();
      fuelSaveEntry(kind);
    };
    document.addEventListener('keydown', fuelDrawerEscape);
    setTimeout(() => document.getElementById('fuel-liters')?.focus(), 230);
  }

  function fuelDrawerEscape(event) {
    if (event.key === 'Escape') fuelCloseDrawer();
  }

  function fuelCloseDrawer(immediate) {
    const overlay = document.getElementById('fuel-drawer-overlay');
    document.removeEventListener('keydown', fuelDrawerEscape);
    document.body.classList.remove('fuel-drawer-open');
    if (!overlay) return;
    overlay.classList.remove('show');
    if (immediate === true) overlay.remove();
    else setTimeout(() => overlay.remove(), 240);
  }

  async function fuelSaveEntry(kind) {
    const button = document.getElementById('fuel-submit');
    const draft = {
      transaction_type: kind,
      fuel_type: DIESEL,
      occurred_at: document.getElementById('fuel-occurred')?.value,
      liters: document.getElementById('fuel-liters')?.value,
      vehicle_plate: document.getElementById('fuel-plate')?.value,
      driver_name: document.getElementById('fuel-driver')?.value,
      supplier: document.getElementById('fuel-supplier')?.value,
      odometer_km: document.getElementById('fuel-odometer')?.value,
      note: document.getElementById('fuel-note')?.value,
    };
    const validation = api.validateDraft(draft, api.balanceByType(state.rows));
    if (!validation.ok) {
      toast(validation.message, 'warning');
      document.getElementById(validation.field)?.focus();
      return;
    }

    const payload = {
      transaction_type: kind,
      fuel_type: String(draft.fuel_type || '').trim(),
      occurred_at: new Date(draft.occurred_at).toISOString(),
      liters: api.number(draft.liters),
      vehicle_plate: kind === 'dispense' ? String(draft.vehicle_plate || '').trim().toUpperCase() : null,
      driver_name: kind === 'dispense' ? String(draft.driver_name || '').trim() : null,
      supplier: kind === 'receive' ? String(draft.supplier || '').trim() || null : null,
      odometer_km: kind === 'dispense' && draft.odometer_km !== '' ? api.number(draft.odometer_km) : null,
      note: String(draft.note || '').trim() || null,
      staff_name: currentUser()?.username || 'unknown',
    };

    if (button) button.disabled = true;
    try {
      if (navigator.onLine !== false && root.SK_FORCE_OFFLINE !== true && state.databaseReady === false) {
        throw new Error('กรุณาติดตั้ง migrations/fuel_inventory.sql ก่อนบันทึกข้อมูล');
      }
      const result = await database().from(TABLE).insert(payload).select().single();
      if (result.error) throw result.error;
      fuelCloseDrawer();
      toast(kind === 'receive' ? `รับน้ำมันเข้า ${fmtLiters(payload.liters)} ลิตรแล้ว` : `บันทึกเติมรถ ${payload.vehicle_plate} แล้ว`, 'success');
      if (typeof logActivity === 'function') {
        const detail = kind === 'receive'
          ? `${payload.fuel_type} +${fmtLiters(payload.liters)} ลิตร`
          : `${payload.vehicle_plate} · ${payload.driver_name} · ${payload.fuel_type} ${fmtLiters(payload.liters)} ลิตร`;
        logActivity(kind === 'receive' ? 'รับน้ำมันเข้า' : 'เติมน้ำมันรถ', detail, result.data?.id, TABLE);
      }
      await loadFuelData();
    } catch (error) {
      console.error('[v108] fuel save error:', error);
      const message = /คงเหลือ|insufficient|stock/i.test(String(error?.message || ''))
        ? 'น้ำมันคงเหลือไม่เพียงพอ กรุณาตรวจสอบยอดอีกครั้ง'
        : `บันทึกไม่สำเร็จ: ${error?.message || 'กรุณาติดตั้งฐานข้อมูลน้ำมันก่อน'}`;
      toast(message, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function fuelDeleteTransaction(id) {
    if (currentUser()?.role !== 'admin') {
      toast('เฉพาะผู้ดูแลระบบเท่านั้นที่ลบรายการน้ำมันได้', 'warning');
      return;
    }
    const row = state.rows.find(item => String(item.id) === String(id));
    const result = await Swal.fire({ title: 'ลบรายการน้ำมันนี้?', text: 'ยอดคงเหลือจะถูกคำนวณใหม่ทันที', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบรายการ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
    if (!result.isConfirmed) return;
    try {
      const response = await database().from(TABLE).delete().eq('id', id);
      if (response.error) throw response.error;
      toast('ลบรายการน้ำมันแล้ว', 'success');
      if (typeof logActivity === 'function') logActivity('ลบรายการน้ำมัน', `${row?.fuel_type || ''} ${fmtLiters(row?.liters || 0)} ลิตร`, id, TABLE);
      await loadFuelData();
    } catch (error) {
      toast(`ลบไม่สำเร็จ: ${error?.message || 'เกิดข้อผิดพลาด'}`, 'error');
    }
  }

  function fuelResetFilters() {
    state.type = 'ทั้งหมด';
    state.month = api.localMonthKey(new Date());
    state.search = '';
    const search = document.getElementById('fuel-search');
    const month = document.getElementById('fuel-month-filter');
    if (search) search.value = '';
    if (month) month.value = state.month;
    renderHistory();
  }

  function fuelShowInstallHelp() {
    Swal.fire({
      icon: 'info',
      title: 'วิธีติดตั้งฐานข้อมูลน้ำมัน',
      html: '<div style="text-align:left;line-height:1.75;font-size:14px">1. เปิด Supabase Dashboard ของร้าน<br>2. เข้าเมนู <b>SQL Editor</b> แล้วกด <b>New query</b><br>3. เปิดไฟล์ <b>migrations/fuel_inventory.sql</b><br>4. คัดลอก SQL ทั้งหมดไปวางและกด <b>Run</b><br>5. รีเฟรชโปรแกรม แล้วเข้าเมนูบันทึกน้ำมันอีกครั้ง<br><br><span style="color:#64748b">คู่มือฉบับเต็ม: docs/fuel-ledger-installation.md</span></div>',
      confirmButtonText: 'เข้าใจแล้ว',
      confirmButtonColor: '#0f766e',
    });
  }

  // โครงสร้างสำรองกรณี WebView/PWA ถือ CSS รุ่นเก่าไว้: อย่างน้อย Drawer
  // ต้องลอยชิดขวาและเลื่อนได้เสมอ ไม่ไหลลงใน document เหมือนฟอร์มปกติ
  function injectFuelDrawerCriticalStyles() {
    if (document.getElementById('fuel-drawer-critical-v4')) return;
    const style = document.createElement('style');
    style.id = 'fuel-drawer-critical-v4';
    style.textContent = `
      body.fuel-drawer-open{overflow:hidden!important}
      .fuel-drawer-overlay{position:fixed!important;inset:0!important;z-index:12050!important;display:flex!important;justify-content:flex-end!important;background:rgba(15,23,42,.38)!important;backdrop-filter:blur(3px)!important}
      .fuel-drawer{width:min(610px,calc(100vw - 24px))!important;height:100dvh!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;overflow:hidden!important;margin:0!important;color:#172033!important;background:#fff!important;border-radius:24px 0 0 24px!important;box-shadow:-24px 0 70px rgba(15,23,42,.16)!important;transform:translateX(100%)!important;transition:transform .24s cubic-bezier(.22,1,.36,1)!important}
      .fuel-drawer-overlay.show .fuel-drawer{transform:translateX(0)!important}
      .fuel-drawer-header{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:20px!important;padding:25px 27px 20px!important;border-bottom:1px solid #edf1f5!important}
      .fuel-drawer-header h2{margin:3px 0 0!important;font-size:22px!important}.fuel-drawer-header button{width:38px!important;height:38px!important;display:grid!important;place-items:center!important;border:0!important;border-radius:11px!important;background:#f1f5f9!important}
      .fuel-drawer-body{min-height:0!important;overflow-y:auto!important;padding:22px 27px 28px!important}
      .fuel-drawer-footer{display:grid!important;grid-template-columns:110px 1fr!important;gap:10px!important;padding:16px 27px max(17px,env(safe-area-inset-bottom))!important;border-top:1px solid #edf1f5!important;background:#fff!important}
      .fuel-drawer .fuel-form-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:0 12px!important}.fuel-drawer .form-input{width:100%!important;box-sizing:border-box!important}.fuel-drawer-footer .fuel-form-submit{width:100%!important;margin:0!important}
      @media(max-width:720px){.fuel-drawer{width:100%!important;border-radius:18px 0 0 18px!important}.fuel-drawer-header{padding:20px 18px 17px!important}.fuel-drawer-body{padding:18px!important}.fuel-drawer-footer{grid-template-columns:92px 1fr!important;padding:13px 18px max(14px,env(safe-area-inset-bottom))!important}.fuel-drawer .fuel-form-grid{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  injectFuelDrawerCriticalStyles();

  root.SKFuelLedger = api;
  root.renderFuelLedger = renderFuelLedger;
  root.fuelOpenEntry = fuelOpenEntry;
  root.fuelCloseDrawer = fuelCloseDrawer;
  root.fuelSaveEntry = fuelSaveEntry;
  root.fuelDeleteTransaction = fuelDeleteTransaction;
  root.fuelResetFilters = fuelResetFilters;
  root.fuelShowInstallHelp = fuelShowInstallHelp;

  // รองรับเครื่องที่ Service Worker ยังถือ app.js รุ่นเก่า ซึ่งรู้จัก section
  // แต่ยังไม่มี case 'fuel' ใน switch ทำให้เห็นหน้าว่างหลังคลิกเมนู
  (function installFuelNavigationFallback() {
    const originalGo = root.go;
    if (typeof originalGo !== 'function' || originalGo.__v108FuelNav) return;
    const wrappedGo = function (page) {
      const result = originalGo.apply(this, arguments);
      if (page === 'fuel') {
        const section = document.getElementById('page-fuel');
        const title = document.getElementById('page-title-text');
        if (section) {
          document.querySelectorAll('.page-section').forEach(item => item.classList.add('hidden'));
          section.classList.remove('hidden');
        }
        if (title) title.textContent = '⛽ บันทึกน้ำมัน';
        document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === 'fuel'));
        if (!section?.querySelector('.fuel-page')) renderFuelLedger();
      }
      return result;
    };
    Object.defineProperty(wrappedGo, '__v108FuelNav', { value: true });
    root.go = wrappedGo;
    try { go = wrappedGo; } catch (_) {}
  })();
  console.log('[v108] Fuel ledger loaded');
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const number = value => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function localDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function localMonthKey(value) {
    return localDateKey(value).slice(0, 7);
  }

  function balanceByType(rows) {
    return (rows || []).reduce((balances, row) => {
      const type = String(row?.fuel_type || 'อื่น ๆ');
      const amount = Math.max(0, number(row?.liters));
      balances[type] = number(balances[type]) + (row?.transaction_type === 'receive' ? amount : -amount);
      return balances;
    }, {});
  }

  function summarize(rows, now) {
    const today = localDateKey(now || new Date());
    const balances = balanceByType(rows);
    const result = {
      stock: Object.values(balances).reduce((sum, value) => sum + number(value), 0),
      receivedToday: 0,
      dispensedToday: 0,
      vehicleCount: 0,
    };
    const vehicles = new Set();
    (rows || []).forEach(row => {
      if (localDateKey(row?.occurred_at || row?.created_at) !== today) return;
      const amount = Math.max(0, number(row?.liters));
      if (row?.transaction_type === 'receive') result.receivedToday += amount;
      if (row?.transaction_type === 'dispense') {
        result.dispensedToday += amount;
        if (String(row?.vehicle_plate || '').trim()) vehicles.add(String(row.vehicle_plate).trim().toUpperCase());
      }
    });
    result.vehicleCount = vehicles.size;
    return result;
  }

  function filterTransactions(rows, filters) {
    const type = String(filters?.type || 'ทั้งหมด');
    const month = String(filters?.month || '');
    const search = String(filters?.search || '').trim().toLocaleLowerCase('th-TH');
    return (rows || []).filter(row => {
      if (type !== 'ทั้งหมด' && String(row?.fuel_type || '') !== type) return false;
      if (month && localMonthKey(row?.occurred_at || row?.created_at) !== month) return false;
      if (search) {
        const haystack = [row?.vehicle_plate, row?.driver_name, row?.supplier, row?.note, row?.staff_name]
          .filter(Boolean).join(' ').toLocaleLowerCase('th-TH');
        if (!haystack.includes(search)) return false;
      }
      return true;
    }).slice().sort((a, b) => String(b?.occurred_at || '').localeCompare(String(a?.occurred_at || '')));
  }

  function uniqueValues(rows, field) {
    return [...new Set((rows || []).map(row => String(row?.[field] || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'th'));
  }

  function validateDraft(draft, balances) {
    const type = String(draft?.fuel_type || 'ดีเซล').trim();
    const liters = number(draft?.liters);
    if (liters <= 0) return { ok: false, field: 'fuel-liters', message: 'กรุณากรอกจำนวนลิตรมากกว่า 0' };
    if (!draft?.occurred_at || Number.isNaN(new Date(draft.occurred_at).getTime())) return { ok: false, field: 'fuel-occurred', message: 'กรุณาระบุวันและเวลาให้ถูกต้อง' };
    if (draft?.transaction_type === 'dispense') {
      if (!String(draft?.vehicle_plate || '').trim()) return { ok: false, field: 'fuel-plate', message: 'กรุณากรอกทะเบียนรถ' };
      if (!String(draft?.driver_name || '').trim()) return { ok: false, field: 'fuel-driver', message: 'กรุณากรอกชื่อคนขับ ณ เวลาที่เติม' };
      const available = number(balances?.[type]);
      if (liters > available + 0.0005) return { ok: false, field: 'fuel-liters', message: `น้ำมัน ${type} คงเหลือไม่พอ (เหลือ ${available.toLocaleString('th-TH', { maximumFractionDigits: 3 })} ลิตร)` };
    }
    return { ok: true };
  }

  return { number, localDateKey, localMonthKey, balanceByType, summarize, filterTransactions, uniqueValues, validateDraft };
});
