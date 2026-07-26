/**
 * V105 — Delivery Control Board
 * แสดงงานจัดส่งทั้งหมดบนหน้าเดียว พร้อมสถานะวันที่และการชำระเงินที่อ่านได้ทันที
 */
(function () {
  'use strict';

  const state = {
    bills: [],
    items: [],
    filter: 'all',
    search: '',
    loading: false,
    requestId: 0,
  };

  const num = value => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const fmt = value => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(num(value));
  const money = value => `฿${fmt(value)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const js = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  function dateKey(value = new Date()) {
    if (typeof window.appLocalDateKey === 'function') return window.appLocalDateKey(value);
    const date = value instanceof Date ? value : new Date(value);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(key, amount) {
    const [year, month, day] = String(key).split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    date.setDate(date.getDate() + Number(amount || 0));
    return dateKey(date);
  }

  function parseInfo(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return {}; }
  }

  function effectiveTotal(bill) {
    const info = parseInfo(bill?.return_info);
    return Math.max(0, num(info.new_total ?? bill?.total));
  }

  function isDelivered(bill) {
    return /จัดส่งสำเร็จ|ส่งแล้ว|delivered|complete/i.test(String(bill?.delivery_status || ''));
  }

  function isCancelled(bill) {
    return /ยกเลิก|คืนสินค้า|cancel/i.test(`${bill?.status || ''} ${bill?.delivery_status || ''}`);
  }

  function isDeliveryBill(bill) {
    const mode = String(bill?.delivery_mode || '');
    const delivery = String(bill?.delivery_status || '');
    if (isCancelled(bill) || /รับเอง|ไม่จัดส่ง/.test(mode)) return false;
    return /ส่ง|จัดส่ง|deliver|partial/i.test(`${mode} ${delivery}`) || delivery === 'รอจัดส่ง';
  }

  function paymentInfo(bill) {
    const total = effectiveTotal(bill);
    const deposit = Math.max(0, num(bill?.deposit_amount));
    const netReceived = Math.max(0, num(bill?.received) - num(bill?.change));
    const text = `${bill?.method || ''} ${bill?.status || ''}`;
    const debtOrCod = /ค้าง|เครดิตร้าน|ชำระหน้างาน|เก็บปลายทาง|debt|cod/i.test(text);
    let paid = Math.max(deposit, netReceived);
    if (!debtOrCod && /สำเร็จ|ชำระแล้ว|รอจัดส่ง/.test(String(bill?.status || ''))) paid = total;
    paid = Math.min(total, paid);
    const remaining = Math.max(0, total - paid);
    if (remaining <= 0) return { key: 'paid', label: 'ชำระครบแล้ว', icon: 'paid', paid, remaining, total };
    if (paid > 0) return { key: 'partial', label: `เหลือเก็บ ${money(remaining)}`, icon: 'payments', paid, remaining, total };
    return { key: 'collect', label: `เก็บปลายทาง ${money(remaining)}`, icon: 'local_atm', paid, remaining, total };
  }

  function scheduleInfo(bill) {
    if (isDelivered(bill)) return { key: 'done', label: 'จัดส่งสำเร็จ', icon: 'check_circle', order: 5 };
    const today = dateKey();
    const tomorrow = addDays(today, 1);
    const deliveryDate = String(bill?.delivery_date || '').slice(0, 10);
    if (!deliveryDate) return { key: 'unscheduled', label: 'ยังไม่กำหนดวัน', icon: 'event_busy', order: 3 };
    if (deliveryDate < today) return { key: 'overdue', label: 'เกินกำหนด', icon: 'error', order: 0 };
    if (deliveryDate === today) return { key: 'today', label: 'ต้องส่งวันนี้', icon: 'today', order: 1 };
    if (deliveryDate === tomorrow) return { key: 'upcoming', label: 'ส่งพรุ่งนี้', icon: 'event', order: 2 };
    return { key: 'upcoming', label: 'งานถัดไป', icon: 'calendar_month', order: 2 };
  }

  function formatDeliveryDate(bill) {
    const raw = String(bill?.delivery_date || '').slice(0, 10);
    if (!raw) return 'ไม่ได้ระบุวันนัด';
    const [year, month, day] = raw.split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    return date.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function itemsForBill(billId) {
    return state.items.filter(item =>
      String(item.bill_id) === String(billId)
      && (num(item.deliver_qty) > 0 || num(item.qty) > 0)
    );
  }

  function deliveryQty(item) {
    return num(item.deliver_qty) > 0 ? num(item.deliver_qty) : num(item.qty);
  }

  function stats() {
    const deliveryBills = state.bills.filter(isDeliveryBill);
    const pending = deliveryBills.filter(bill => !isDelivered(bill));
    return {
      pending,
      overdue: pending.filter(bill => scheduleInfo(bill).key === 'overdue'),
      today: pending.filter(bill => scheduleInfo(bill).key === 'today'),
      upcoming: pending.filter(bill => scheduleInfo(bill).key === 'upcoming'),
      unscheduled: pending.filter(bill => scheduleInfo(bill).key === 'unscheduled'),
      doneToday: deliveryBills.filter(bill => isDelivered(bill) && String(bill.delivery_date || '').slice(0, 10) === dateKey()),
    };
  }

  function matchesSearch(bill) {
    const query = state.search.trim().toLowerCase();
    if (!query) return true;
    const itemNames = itemsForBill(bill.id).map(item => item.name).join(' ');
    return [
      bill.bill_no, bill.customer_name, bill.delivery_phone, bill.delivery_address,
      bill.staff_name, itemNames,
    ].some(value => String(value || '').toLowerCase().includes(query));
  }

  function visibleBills() {
    const summary = stats();
    let rows;
    if (state.filter === 'overdue') rows = summary.overdue;
    else if (state.filter === 'today') rows = summary.today;
    else if (state.filter === 'upcoming') rows = [...summary.upcoming, ...summary.unscheduled];
    else if (state.filter === 'done') rows = summary.doneToday;
    else rows = [...summary.pending, ...summary.doneToday];
    return rows.filter(matchesSearch).sort((a, b) => {
      const stage = scheduleInfo(a).order - scheduleInfo(b).order;
      if (stage) return stage;
      const dateA = String(a.delivery_date || '9999-12-31');
      const dateB = String(b.delivery_date || '9999-12-31');
      return dateA.localeCompare(dateB) || String(a.bill_no || '').localeCompare(String(b.bill_no || ''));
    });
  }

  function filterButton(key, icon, label, count) {
    return `<button type="button" class="v105-filter ${state.filter === key ? 'active' : ''}" data-filter="${key}">
      <i class="material-icons-round">${icon}</i><span>${label}</span><b>${fmt(count)}</b>
    </button>`;
  }

  function summaryCard(key, icon, label, value, help) {
    return `<button type="button" class="v105-summary ${key}" data-filter="${key === 'pending' ? 'all' : key}">
      <span class="v105-summary-icon"><i class="material-icons-round">${icon}</i></span>
      <span><small>${label}</small><strong>${fmt(value)}</strong><em>${help}</em></span>
    </button>`;
  }

  function billCard(bill) {
    const schedule = scheduleInfo(bill);
    const payment = paymentInfo(bill);
    const items = itemsForBill(bill.id);
    const totalQty = items.reduce((sum, item) => sum + deliveryQty(item), 0);
    const itemHtml = items.length ? items.map(item => `
      <div class="v105-item">
        <span><i class="material-icons-round">inventory_2</i><b>${esc(item.name || 'ไม่ระบุสินค้า')}</b></span>
        <strong>${fmt(deliveryQty(item))} ${esc(item.unit || 'ชิ้น')}</strong>
      </div>`).join('') : '<div class="v105-no-items">ไม่พบรายการสินค้าสำหรับจัดส่ง</div>';
    const phone = String(bill.delivery_phone || '').trim();
    const address = String(bill.delivery_address || '').trim();
    const safeId = js(bill.id);
    return `<article class="v12-dq-card v105-card ${schedule.key}" id="dq-card-${esc(bill.id)}" data-stage="${schedule.key}">
      <div class="v105-status-rail"></div>
      <header class="v105-card-head">
        <div class="v105-bill">
          <span class="v105-bill-no">บิล #${esc(bill.bill_no || bill.id)}</span>
          <span class="v105-status ${schedule.key}"><i class="material-icons-round">${schedule.icon}</i>${schedule.label}</span>
          <span class="v105-payment ${payment.key}"><i class="material-icons-round">${payment.icon}</i>${payment.label}</span>
        </div>
        <div class="v105-date"><small>กำหนดจัดส่ง</small><strong>${esc(formatDeliveryDate(bill))}</strong></div>
      </header>
      <div class="v12-dq-card-body v105-card-body">
        <section class="v105-customer">
          <div class="v105-avatar"><i class="material-icons-round">person</i></div>
          <div class="v105-customer-main">
            <small>ผู้รับสินค้า</small>
            <h3>${esc(bill.customer_name || 'ลูกค้าทั่วไป')}</h3>
            <div class="v105-contact">
              ${phone ? `<a href="tel:${esc(phone)}"><i class="material-icons-round">call</i>${esc(phone)}</a>` : '<span class="missing"><i class="material-icons-round">phone_disabled</i>ไม่มีเบอร์โทร</span>'}
              ${address ? `<span><i class="material-icons-round">location_on</i>${esc(address)}</span>` : '<span class="missing"><i class="material-icons-round">location_off</i>ไม่มีที่อยู่จัดส่ง</span>'}
            </div>
          </div>
          <div class="v105-amount"><small>ยอดบิล</small><strong>${money(payment.total)}</strong>${payment.remaining > 0 ? `<em>คงเหลือ ${money(payment.remaining)}</em>` : '<em class="paid">รับชำระครบ</em>'}</div>
        </section>
        <section class="v105-items">
          <div class="v105-items-head"><span>รายการที่ต้องส่ง</span><b>${fmt(items.length)} รายการ · ${fmt(totalQty)} หน่วย</b></div>
          <div class="v105-item-list">${itemHtml}</div>
        </section>
      </div>
      <footer class="v105-actions">
        <span class="v105-owner"><i class="material-icons-round">badge</i>ผู้ขาย ${esc(bill.staff_name || 'ไม่ระบุ')}</span>
        <div>
          <button type="button" class="v105-action print" onclick="v12DQPrintNote?.('${safeId}')"><i class="material-icons-round">print</i>ใบส่งของ</button>
          ${isDelivered(bill) ? '<span class="v105-complete-note"><i class="material-icons-round">verified</i>ปิดงานแล้ว</span>' : `<button type="button" class="v12-dq-btn done v105-action done" onclick="v12DQMarkDone?.('${safeId}')"><i class="material-icons-round">check_circle</i>จัดส่งสำเร็จ</button>`}
        </div>
      </footer>
    </article>`;
  }

  function groupRows(rows) {
    const definitions = [
      ['overdue', 'งานเกินกำหนด', 'ต้องเร่งติดตาม', 'error'],
      ['today', 'ต้องส่งวันนี้', 'งานที่ควรจัดลำดับก่อน', 'today'],
      ['upcoming', 'งานถัดไป', 'เรียงตามวันนัดส่ง', 'event_upcoming'],
      ['unscheduled', 'ยังไม่กำหนดวัน', 'ควรติดต่อลูกค้าเพื่อนัดหมาย', 'event_busy'],
      ['done', 'จัดส่งสำเร็จ', 'งานนัดวันนี้ที่ปิดแล้ว', 'task_alt'],
    ];
    return definitions.map(([key, title, help, icon]) => {
      const group = rows.filter(bill => scheduleInfo(bill).key === key);
      if (!group.length) return '';
      return `<section class="v105-group ${key}">
        <header class="v105-group-head"><div><i class="material-icons-round">${icon}</i><span><strong>${title}</strong><small>${help}</small></span></div><b>${fmt(group.length)} งาน</b></header>
        <div class="v105-card-list">${group.map(billCard).join('')}</div>
      </section>`;
    }).join('');
  }

  function renderBoard() {
    const area = document.getElementById('v105-board');
    if (!area) return;
    const rows = visibleBills();
    if (!rows.length) {
      area.innerHTML = `<div class="v105-empty"><i class="material-icons-round">local_shipping</i><h3>ไม่พบงานจัดส่ง</h3><p>${state.search ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ' : 'ไม่มีงานในสถานะที่เลือก'}</p></div>`;
      return;
    }
    area.innerHTML = groupRows(rows);
  }

  function renderDashboardData() {
    const summary = stats();
    const statArea = document.getElementById('v105-summary');
    const filters = document.getElementById('v105-filters');
    if (statArea) statArea.innerHTML = [
      summaryCard('pending', 'pending_actions', 'งานที่ยังไม่จบ', summary.pending.length, 'เห็นคิวเปิดทั้งหมด'),
      summaryCard('overdue', 'notification_important', 'เกินกำหนด', summary.overdue.length, summary.overdue.length ? 'ควรติดตามทันที' : 'ไม่มีงานล่าช้า'),
      summaryCard('today', 'local_shipping', 'ต้องส่งวันนี้', summary.today.length, 'งานนัดหมายวันนี้'),
      summaryCard('done', 'verified', 'สำเร็จตามนัดวันนี้', summary.doneToday.length, 'งานที่ปิดแล้ว'),
    ].join('');
    if (filters) filters.innerHTML = [
      filterButton('all', 'view_agenda', 'งานทั้งหมด', summary.pending.length + summary.doneToday.length),
      filterButton('overdue', 'error_outline', 'เกินกำหนด', summary.overdue.length),
      filterButton('today', 'today', 'วันนี้', summary.today.length),
      filterButton('upcoming', 'event_upcoming', 'งานถัดไป', summary.upcoming.length + summary.unscheduled.length),
      filterButton('done', 'task_alt', 'สำเร็จ', summary.doneToday.length),
    ].join('');
    renderBoard();
    const badge = document.getElementById('delivery-count-badge');
    if (badge) {
      badge.textContent = summary.pending.length;
      badge.classList.toggle('hidden', summary.pending.length === 0);
    }
  }

  async function decorateConcretePlans() {
    if (typeof window.v103DecorateDeliveryPlans !== 'function') return;
    try { await window.v103DecorateDeliveryPlans(); }
    catch (error) { console.warn('[V105] concrete delivery decoration skipped', error); }
  }

  async function fetchPagedRows(buildQuery, maxRows = 20000) {
    const pageSize = 1000;
    const rows = [];
    for (let from = 0; from < maxRows; from += pageSize) {
      const result = await buildQuery().range(from, Math.min(from + pageSize - 1, maxRows - 1));
      if (result?.error) throw result.error;
      const page = result?.data || [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }

  async function loadData() {
    const requestId = ++state.requestId;
    state.loading = true;
    const status = document.getElementById('v105-sync-status');
    if (status) status.innerHTML = '<i class="material-icons-round spin">sync</i>กำลังอัปเดตคิว...';
    try {
      const allBills = await fetchPagedRows(
        () => db.from('บิลขาย').select('*').order('delivery_date', { ascending: true }),
        20000
      );
      if (requestId !== state.requestId) return;
      // เก็บเฉพาะงานเปิดและงานสำเร็จที่นัดวันนี้ เพื่อไม่ดึงรายการสินค้าของประวัติเก่าทั้งหมด
      state.bills = allBills.filter(bill =>
        isDeliveryBill(bill)
        && (!isDelivered(bill) || String(bill.delivery_date || '').slice(0, 10) === dateKey())
      );
      const ids = state.bills.map(bill => bill.id).filter(Boolean);
      if (ids.length) {
        const chunks = [];
        for (let index = 0; index < ids.length; index += 100) chunks.push(ids.slice(index, index + 100));
        const itemPages = await Promise.all(chunks.map(chunk => fetchPagedRows(
          () => db.from('รายการในบิล').select('*').in('bill_id', chunk),
          Math.max(1000, chunk.length * 200)
        )));
        state.items = itemPages.flat();
      } else state.items = [];
      if (requestId !== state.requestId) return;
      renderDashboardData();
      await decorateConcretePlans();
      if (status) status.innerHTML = `<i class="material-icons-round">cloud_done</i>อัปเดต ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
    } catch (error) {
      console.error('[V105 Delivery Board]', error);
      const area = document.getElementById('v105-board');
      if (area) area.innerHTML = `<div class="v105-empty error"><i class="material-icons-round">cloud_off</i><h3>โหลดคิวจัดส่งไม่สำเร็จ</h3><p>${esc(error?.message || error)}</p><button type="button" id="v105-retry">ลองใหม่</button></div>`;
      document.getElementById('v105-retry')?.addEventListener('click', loadData);
      if (status) status.innerHTML = '<i class="material-icons-round">error</i>ข้อมูลยังไม่อัปเดต';
    } finally {
      state.loading = false;
    }
  }

  function injectStyles() {
    if (document.getElementById('v105-delivery-styles')) return;
    const style = document.createElement('style');
    style.id = 'v105-delivery-styles';
    style.textContent = `
      #page-delivery{background:#f6f8fc!important}.v105-wrap{--ink:#172033;--muted:#667085;--line:#e4e7ec;max-width:1420px;margin:0 auto;padding:0 0 34px;color:var(--ink);font-family:'Prompt',sans-serif}.v105-wrap *{box-sizing:border-box}.v105-hero{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:28px 30px;margin-bottom:20px;border-radius:22px;background:linear-gradient(125deg,#0f172a,#1e3a8a 55%,#2563eb);color:#fff;box-shadow:0 18px 38px rgba(30,58,138,.18)}.v105-hero:after{content:'';position:absolute;width:270px;height:270px;border:44px solid rgba(255,255,255,.06);border-radius:50%;right:-90px;top:-120px}.v105-hero-main{position:relative;z-index:1;display:flex;align-items:center;gap:18px}.v105-hero-icon{width:64px;height:64px;border-radius:18px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.18);display:grid;place-items:center}.v105-hero-icon i{font-size:35px}.v105-hero h2{font-size:27px;line-height:1.25;margin:0;font-weight:950;color:#fff!important}.v105-hero p{margin:6px 0 0;color:#dbeafe!important;font-size:14px;font-weight:700}.v105-hero-actions{position:relative;z-index:1;display:flex;align-items:center;gap:12px}.v105-sync{font-size:12px;color:#dbeafe;font-weight:800;display:flex;align-items:center;gap:6px}.v105-sync i{font-size:17px}.v105-refresh{height:44px;border:1px solid rgba(255,255,255,.22);border-radius:11px;background:rgba(255,255,255,.12);color:#fff;padding:0 16px;font-size:13px;font-weight:900;cursor:pointer;display:flex;align-items:center;gap:7px}.v105-refresh:hover{background:rgba(255,255,255,.2)}.v105-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}.v105-summary{min-width:0;border:1px solid var(--line);background:#fff;border-radius:17px;padding:18px;text-align:left;display:flex;align-items:center;gap:14px;cursor:pointer;box-shadow:0 7px 18px rgba(16,24,40,.04)}.v105-summary:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(16,24,40,.08)}.v105-summary-icon{width:48px;height:48px;flex:0 0 48px;border-radius:13px;display:grid;place-items:center;background:#eef2ff;color:#4f46e5}.v105-summary-icon i{font-size:25px}.v105-summary.overdue .v105-summary-icon{background:#fffbeb;color:#d97706}.v105-summary.today .v105-summary-icon{background:#fff7ed;color:#ea580c}.v105-summary.done .v105-summary-icon{background:#ecfdf3;color:#059669}.v105-summary span:last-child{min-width:0;display:grid;grid-template-columns:1fr auto;column-gap:9px;align-items:end;width:100%}.v105-summary small{font-size:12px;font-weight:900;color:var(--muted)}.v105-summary strong{grid-row:1/3;grid-column:2;font-size:31px;line-height:1;font-weight:950}.v105-summary em{font-size:11px;font-style:normal;color:#98a2b3;font-weight:750;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v105-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;background:#fff;border:1px solid var(--line);border-radius:17px;padding:11px;margin-bottom:20px;box-shadow:0 6px 18px rgba(16,24,40,.035)}.v105-filters{display:flex;gap:7px;overflow-x:auto}.v105-filter{height:43px;border:0;border-radius:10px;background:transparent;color:#667085;padding:0 14px;display:flex;align-items:center;gap:7px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}.v105-filter i{font-size:18px}.v105-filter b{border-radius:999px;background:#f2f4f7;padding:3px 7px;font-size:10px}.v105-filter.active{background:#172554;color:#fff}.v105-filter.active b{background:rgba(255,255,255,.17)}.v105-search{position:relative;flex:0 1 390px}.v105-search i{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:20px;color:#98a2b3}.v105-search input{width:100%;height:43px;border:1px solid var(--line);border-radius:10px;padding:0 14px 0 42px;font:inherit;font-size:13px;font-weight:750;outline:none}.v105-search input:focus{border-color:#6366f1;box-shadow:0 0 0 3px #eef2ff}.v105-group{margin-bottom:24px}.v105-group-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:11px;padding:0 5px}.v105-group-head>div{display:flex;align-items:center;gap:11px}.v105-group-head i{width:39px;height:39px;border-radius:11px;display:grid;place-items:center;background:#eef2ff;color:#4f46e5;font-size:21px}.v105-group.overdue .v105-group-head i{background:#fffbeb;color:#d97706}.v105-group.today .v105-group-head i{background:#fff7ed;color:#ea580c}.v105-group.done .v105-group-head i{background:#ecfdf3;color:#059669}.v105-group-head strong{display:block;font-size:16px;font-weight:950}.v105-group-head small{display:block;font-size:11px;color:#98a2b3;font-weight:750;margin-top:2px}.v105-group-head>b{border-radius:999px;background:#fff;border:1px solid var(--line);padding:7px 11px;color:#667085;font-size:11px;font-weight:900}.v105-card-list{display:grid;grid-template-columns:1fr;gap:16px}.v105-card{position:relative!important;display:block!important;overflow:hidden!important;margin:0!important;border:1px solid var(--line)!important;border-radius:19px!important;background:#fff!important;box-shadow:0 8px 24px rgba(16,24,40,.055)!important;transition:.2s ease}.v105-card:hover{transform:translateY(-1px);box-shadow:0 13px 32px rgba(16,24,40,.09)!important}.v105-status-rail{display:none!important}.v105-card-head{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:18px 22px 16px;border-bottom:1px solid #f2f4f7}.v105-bill{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.v105-bill-no{font-size:15px;font-weight:950;color:#344054;margin-right:4px}.v105-status,.v105-payment{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:950;white-space:nowrap}.v105-status i,.v105-payment i{font-size:16px}.v105-status.overdue{background:#fffbeb;color:#b45309}.v105-status.today{background:#fff7ed;color:#c2410c}.v105-status.upcoming{background:#eff6ff;color:#1d4ed8}.v105-status.unscheduled{background:#fffbeb;color:#b45309}.v105-status.done{background:#ecfdf3;color:#047857}.v105-payment.paid{background:#ecfdf3;color:#047857}.v105-payment.partial{background:#fffbeb;color:#b45309}.v105-payment.collect{background:#fff7ed;color:#c2410c}.v105-date{text-align:right;flex:0 0 auto}.v105-date small{display:block;font-size:10px;color:#98a2b3;font-weight:850}.v105-date strong{display:block;font-size:13px;color:#344054;font-weight:900;margin-top:3px}.v105-card-body{padding:0!important}.v105-customer{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:15px;align-items:center;padding:20px 22px 18px}.v105-avatar{width:50px;height:50px;border-radius:14px;background:#eef2ff;color:#4f46e5;display:grid;place-items:center}.v105-avatar i{font-size:26px}.v105-customer-main{min-width:0}.v105-customer-main>small{font-size:10px;color:#98a2b3;font-weight:850}.v105-customer-main h3{font-size:18px;line-height:1.35;font-weight:950;margin:2px 0 7px;color:#101828;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v105-contact{display:flex;gap:14px;flex-wrap:wrap}.v105-contact span,.v105-contact a{display:flex;align-items:center;gap:5px;color:#667085;font-size:12px;font-weight:750;text-decoration:none;max-width:760px}.v105-contact i{font-size:17px;color:#6366f1}.v105-contact .missing,.v105-contact .missing i{color:#d0d5dd}.v105-amount{text-align:right}.v105-amount small{display:block;font-size:10px;color:#98a2b3;font-weight:850}.v105-amount strong{display:block;font-size:23px;font-weight:950;color:#101828}.v105-amount em{display:block;font-size:11px;font-style:normal;font-weight:900;color:#b45309;margin-top:2px}.v105-amount em.paid{color:#047857}.v105-items{margin:0 22px 18px;border:1px solid #eaecf0;border-radius:14px;overflow:hidden}.v105-items-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;background:#f9fafb;color:#667085;font-size:11px;font-weight:900}.v105-items-head b{color:#344054}.v105-item-list{padding:5px 14px}.v105-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px dashed #eaecf0;font-size:13px}.v105-item:last-child{border-bottom:0}.v105-item span{display:flex;align-items:center;gap:8px;min-width:0}.v105-item i{font-size:18px;color:#98a2b3}.v105-item b{font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v105-item strong{color:#4338ca;font-size:14px;font-weight:950;white-space:nowrap}.v105-no-items{padding:15px;text-align:center;color:#98a2b3;font-size:12px;font-weight:750}.v105-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 22px 14px;border-top:1px solid #f2f4f7;background:#fcfcfd}.v105-owner{display:flex;align-items:center;gap:6px;color:#667085;font-size:11px;font-weight:800}.v105-owner i{font-size:17px}.v105-actions>div{display:flex;align-items:center;gap:8px}.v105-action{height:40px!important;border-radius:10px!important;padding:0 15px!important;display:inline-flex!important;align-items:center;justify-content:center;gap:6px;border:1px solid #d0d5dd;background:#fff;color:#475467;text-decoration:none;font:inherit;font-size:12px!important;font-weight:900!important;cursor:pointer;box-shadow:none!important}.v105-action i{font-size:17px!important}.v105-action.done{background:#059669!important;color:#fff!important;border-color:#059669!important}.v105-complete-note{display:inline-flex;align-items:center;gap:6px;color:#047857;font-size:12px;font-weight:900}.v105-complete-note i{font-size:19px}.v105-empty{display:grid;place-items:center;text-align:center;min-height:300px;border:1px dashed #d0d5dd;border-radius:18px;background:#fff;color:#98a2b3;padding:34px}.v105-empty i{font-size:52px;color:#d0d5dd}.v105-empty h3{font-size:17px;color:#475467;margin:10px 0 0}.v105-empty p{font-size:12px;margin:4px 0 0}.v105-empty.error{border-color:#fed7aa;background:#fff7ed}.v105-empty.error i,.v105-empty.error p{color:#c2410c}.v105-empty button{margin-top:12px;border:0;border-radius:9px;background:#172554;color:#fff;padding:10px 16px;font-size:12px;font-weight:900;cursor:pointer}.spin{animation:v105spin 1s linear infinite}@keyframes v105spin{to{transform:rotate(360deg)}}
      /* จัดแนวภายในใบงานให้ทุกส่วนใช้เส้นขอบซ้าย-ขวาและสัดส่วนเดียวกัน */
      .v105-card-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(190px,220px);min-height:78px;padding:17px 24px}
      .v105-date{min-width:0;padding-left:20px;border-left:1px solid #eaecf0}
      .v105-customer{grid-template-columns:58px minmax(0,1fr) minmax(190px,220px);gap:20px;padding:24px}
      .v105-avatar{width:56px;height:56px;border-radius:16px}
      .v105-amount{min-width:0;padding-left:24px;border-left:1px solid #eaecf0}
      .v105-items{margin:0 24px 20px}
      .v105-items-head{min-height:48px;padding:11px 16px}
      .v105-item-list{padding:5px 16px}
      .v105-actions{min-height:70px;padding:14px 24px}
      .v105-actions>div{justify-content:flex-end}
      .v105-action{min-width:128px;height:42px!important}
      @media(max-width:1000px){.v105-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v105-customer{grid-template-columns:56px minmax(0,1fr) 180px}.v105-card-head{grid-template-columns:minmax(0,1fr) 180px}}
      @media(max-width:700px){#page-delivery{margin:-16px!important;padding:12px!important}.v105-hero{padding:19px;border-radius:17px;align-items:flex-start}.v105-hero-icon{width:48px;height:48px}.v105-hero h2{font-size:20px}.v105-hero p{font-size:11px}.v105-hero-actions{flex-direction:column;align-items:flex-end}.v105-sync{display:none}.v105-summary-grid{gap:8px}.v105-summary{padding:12px;gap:8px}.v105-summary-icon{width:36px;height:36px;flex-basis:36px}.v105-summary strong{font-size:23px}.v105-summary em{display:none}.v105-toolbar{align-items:stretch;flex-direction:column}.v105-filters{order:2}.v105-search{flex:auto;width:100%}.v105-card-head{flex-direction:column;align-items:flex-start;padding:16px 17px 14px 20px}.v105-date{text-align:left}.v105-customer{grid-template-columns:auto minmax(0,1fr);padding:17px 17px 15px 20px}.v105-customer-main h3{font-size:16px}.v105-contact span,.v105-contact a{font-size:11px}.v105-amount{grid-column:1/-1;text-align:left;display:flex;align-items:center;gap:8px;padding-left:65px}.v105-amount small{display:none}.v105-amount strong{font-size:18px}.v105-items{margin:0 17px 15px 20px}.v105-item{font-size:12px}.v105-actions{align-items:flex-start;flex-direction:column;padding:12px 17px 14px 20px}.v105-actions>div{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.v105-action{height:42px!important;padding:0 8px!important}.v105-owner{width:100%;font-size:10px}}
      @media(max-width:700px){.v105-card-head{display:flex;min-height:0;padding:16px}.v105-date{width:100%;padding:12px 0 0;border-left:0;border-top:1px solid #eaecf0}.v105-customer{grid-template-columns:50px minmax(0,1fr);gap:12px;padding:16px}.v105-avatar{width:48px;height:48px;border-radius:14px}.v105-amount{padding:12px 0 0 62px;border-left:0;border-top:1px solid #eaecf0}.v105-items{margin:0 16px 16px}.v105-actions{min-height:0;padding:14px 16px}.v105-action{min-width:0}}
      @media(max-width:390px){.v105-summary-grid{grid-template-columns:1fr 1fr}.v105-summary small{font-size:9px}.v105-contact span{max-width:250px}.v105-action{font-size:11px!important}.v105-action i{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function bindEvents(section) {
    section.addEventListener('click', async event => {
      const filter = event.target.closest('[data-filter]');
      if (!filter) return;
      state.filter = filter.dataset.filter || 'all';
      renderDashboardData();
      await decorateConcretePlans();
    });
    document.getElementById('v105-refresh')?.addEventListener('click', () => {
      if (!state.loading) loadData();
    });
    document.getElementById('v105-search')?.addEventListener('input', event => {
      state.search = event.target.value || '';
      renderBoard();
      decorateConcretePlans();
    });
  }

  window.v12DQFilter = async function (filter = 'all') {
    state.filter = ['all', 'overdue', 'today', 'upcoming', 'done'].includes(filter) ? filter : 'all';
    if (!state.bills.length && !state.loading) await loadData();
    else {
      renderDashboardData();
      await decorateConcretePlans();
    }
  };

  window.renderDelivery = async function () {
    injectStyles();
    const section = document.getElementById('page-delivery');
    if (!section) return;
    state.filter = 'all';
    state.search = '';
    section.innerHTML = `
      <main class="v105-wrap">
        <header class="v105-hero">
          <div class="v105-hero-main"><span class="v105-hero-icon"><i class="material-icons-round">local_shipping</i></span><div><h2>ศูนย์ควบคุมงานจัดส่ง</h2><p>เห็นคิว สถานะ ลูกค้า สินค้า และยอดเก็บปลายทางครบในหน้าเดียว</p></div></div>
          <div class="v105-hero-actions"><span class="v105-sync" id="v105-sync-status"><i class="material-icons-round">cloud_queue</i>กำลังเตรียมข้อมูล</span><button type="button" class="v105-refresh" id="v105-refresh"><i class="material-icons-round">refresh</i>รีเฟรช</button></div>
        </header>
        <section class="v105-summary-grid" id="v105-summary">${Array.from({ length: 4 }, () => '<div class="v105-summary" style="min-height:72px"></div>').join('')}</section>
        <section class="v105-toolbar">
          <div class="v105-filters" id="v105-filters"></div>
          <label class="v105-search"><i class="material-icons-round">search</i><input id="v105-search" type="search" placeholder="ค้นหาเลขบิล ลูกค้า เบอร์โทร ที่อยู่ หรือสินค้า"></label>
        </section>
        <div id="v105-board"><div class="v105-empty"><i class="material-icons-round spin">sync</i><h3>กำลังจัดคิวงาน...</h3></div></div>
      </main>`;
    bindEvents(section);
    await loadData();
  };

  console.log('[V105] Delivery control board loaded');
})();
