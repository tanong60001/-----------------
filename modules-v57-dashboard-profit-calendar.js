(function () {
  'use strict';

  console.log('[v57] dashboard profit calendar loaded');

  const money = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const fmt = value => {
    try {
      if (typeof formatNum === 'function') return formatNum(value);
    } catch (_) {}
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(money(value)));
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));

  function localDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function rowDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return localDate(date);
  }

  function monthInfo(offset = 0) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + Number(offset || 0), 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return {
      first,
      last,
      start: localDate(first),
      end: localDate(last),
      offset: Number(offset || 0),
    };
  }

  function parseReturnInfo(info) {
    if (!info) return {};
    if (typeof info === 'object') return info;
    try { return JSON.parse(info); } catch (_) { return {}; }
  }

  function effectiveBillTotal(bill) {
    const info = parseReturnInfo(bill?.return_info);
    return money(info.new_total ?? bill?.total);
  }

  function isStockPurchaseExpense(expense) {
    const text = [expense?.category, expense?.description, expense?.note, expense?.type].filter(Boolean).join(' ').toLowerCase();
    return /stock|purchase|po|inventory|สต็อก|สต๊อก|เข้าคลัง|ซื้อสินค้า|รับสินค้า|ซื้อสต็อก|ซื้อรอบ|สินค้าเข้าคลัง/.test(text);
  }

  function isProjectBill(bill) {
    const text = [bill?.project_id, bill?.customer_name, bill?.method, bill?.status].filter(Boolean).join(' ');
    return Boolean(bill?.project_id) || /\[โครงการ\]|โครงการ|เบิกของโครงการ|จ่ายของให้โครงการ|ต้นทุนโครงการ|project/i.test(text);
  }

  function ensureDay(map, key) {
    if (!map[key]) {
      map[key] = {
        revenue: 0, cogs: 0, expenses: 0, salary: 0, advance: 0, profit: 0,
        store: { revenue: 0, cogs: 0, expenses: 0, salary: 0, advance: 0, profit: 0 },
        project: { revenue: 0, cogs: 0, expenses: 0, salary: 0, advance: 0, profit: 0 },
      };
    }
    return map[key];
  }

  function add(map, key, field, amount, bucket = 'store') {
    if (!key) return;
    const day = ensureDay(map, key);
    const scope = bucket === 'project' ? day.project : day.store;
    const value = money(amount);
    scope[field] += value;
    day[field] += value;
  }

  async function loadMonthProfit(info) {
    if (typeof db === 'undefined') throw new Error('ระบบฐานข้อมูลยังไม่พร้อม');

    const startTime = info.start + 'T00:00:00';
    const endTime = info.end + 'T23:59:59';

    const [billR, expR, attR, advR, projExpR, projMsR] = await Promise.all([
      db.from('บิลขาย').select('id,total,method,status,date,return_info,project_id,customer_name').gte('date', startTime).lte('date', endTime).limit(12000),
      db.from('รายจ่าย').select('amount,category,description,note,date').gte('date', startTime).lte('date', endTime).limit(6000),
      db.from('เช็คชื่อ').select('employee_id,status,date,deduction,note').gte('date', startTime).lte('date', endTime).limit(6000),
      db.from('เบิกเงิน').select('amount,status,date').gte('date', startTime).lte('date', endTime).limit(6000),
      db.from('รายจ่ายโครงการ').select('amount,paid_at').not('paid_at', 'is', null).gte('paid_at', startTime).lte('paid_at', endTime).limit(6000),
      db.from('งวดงาน').select('amount,billed_at,status').eq('status', 'billed').gte('billed_at', startTime).lte('billed_at', endTime).limit(6000),
    ]);

    for (const result of [billR, expR, attR, advR, projExpR, projMsR]) {
      if (result.error) throw result.error;
    }

    const dayMap = {};
    const allBills = billR.data || [];
    const paidBills = allBills.filter(b =>
      (b.status === 'สำเร็จ' || b.status === 'คืนบางส่วน')
      && b.method !== 'ค้างชำระ'
      && b.method !== 'เครดิต'
      && !isProjectBill(b)
    );

    const billIds = paidBills.map(b => b.id).filter(Boolean).slice(0, 1000);
    let billItems = [];
    if (billIds.length) {
      const itemR = await db.from('รายการในบิล').select('name,qty,price,cost,bill_id').in('bill_id', billIds).limit(5000);
      if (itemR.error) throw itemR.error;
      billItems = itemR.data || [];
    }

    const billDate = {};
    paidBills.forEach(bill => {
      const key = rowDate(bill.date);
      billDate[bill.id] = key;
      add(dayMap, key, 'revenue', effectiveBillTotal(bill), 'store');
    });

    billItems.forEach(item => {
      add(dayMap, billDate[item.bill_id], 'cogs', money(item.cost) * money(item.qty), 'store');
    });

    paidBills.forEach(bill => {
      const infoReturn = parseReturnInfo(bill.return_info);
      if (bill.status !== 'คืนบางส่วน' || !Array.isArray(infoReturn.return_items)) return;
      const key = billDate[bill.id];
      infoReturn.return_items.forEach(ret => {
        let cost = money(ret.cost);
        if (!cost) {
          const original = billItems.find(item => item.bill_id === bill.id && item.name === ret.name);
          cost = money(original?.cost);
        }
        add(dayMap, key, 'cogs', -cost * money(ret.qty), 'store');
      });
    });

    (expR.data || []).filter(e => !isStockPurchaseExpense(e)).forEach(expense => {
      add(dayMap, rowDate(expense.date), 'expenses', expense.amount, 'store');
    });

    (projExpR.data || []).forEach(expense => {
      add(dayMap, rowDate(expense.paid_at), 'expenses', expense.amount, 'project');
    });

    (projMsR.data || []).forEach(milestone => {
      add(dayMap, rowDate(milestone.billed_at), 'revenue', milestone.amount, 'project');
    });

    (advR.data || []).filter(row => row.status === 'อนุมัติ').forEach(row => {
      add(dayMap, rowDate(row.date), 'advance', row.amount, 'store');
    });

    const attendances = attR.data || [];
    const empIds = [...new Set(attendances.map(row => row.employee_id).filter(Boolean))];
    let wages = {};
    if (empIds.length) {
      const empR = await db.from('พนักงาน').select('id,daily_wage').in('id', empIds);
      if (empR.error) throw empR.error;
      (empR.data || []).forEach(emp => { wages[emp.id] = money(emp.daily_wage); });
    }

    attendances.forEach(row => {
      const wage = wages[row.employee_id] || 0;
      let amount = 0;
      if (row.status === 'มา' || row.status === 'มาสาย') amount = wage;
      else if (row.status === 'ครึ่งวัน' || row.status === 'มาครึ่งวัน') amount = wage / 2;
      amount = Math.max(0, amount - money(row.deduction));
      const isProjectLabor = String(row.note || '').includes('โครงการ') || /project/i.test(String(row.note || ''));
      add(dayMap, rowDate(row.date), 'salary', amount, isProjectLabor ? 'project' : 'store');
    });

    Object.values(dayMap).forEach(day => {
      day.store.cogs = Math.max(0, day.store.cogs);
      day.project.cogs = Math.max(0, day.project.cogs);
      day.cogs = Math.max(0, day.cogs);
      day.store.profit = day.store.revenue - day.store.cogs - day.store.expenses - day.store.salary - day.store.advance;
      day.project.profit = day.project.revenue - day.project.cogs - day.project.expenses - day.project.salary - day.project.advance;
      day.profit = day.revenue - day.cogs - day.expenses - day.salary - day.advance;
    });

    return dayMap;
  }

  function scopeRow(row, mode) {
    if (mode === 'project') return row?.project || { profit: 0, revenue: 0, cogs: 0, expenses: 0, salary: 0, advance: 0 };
    if (mode === 'store') return row?.store || { profit: 0, revenue: 0, cogs: 0, expenses: 0, salary: 0, advance: 0 };
    return row || { profit: 0, revenue: 0, cogs: 0, expenses: 0, salary: 0, advance: 0 };
  }

  function modeTitle(mode) {
    if (mode === 'project') return 'โครงการ';
    if (mode === 'store') return 'หน้าร้าน';
    return 'รวมทั้งหมด';
  }

  function renderDays(dayMap, info, mode = 'all') {
    const cells = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => `<div class="v57-dow">${day}</div>`);
    for (let i = 0; i < info.first.getDay(); i++) cells.push('<div class="v57-day muted"></div>');

    for (let day = 1; day <= info.last.getDate(); day++) {
      const date = new Date(info.first.getFullYear(), info.first.getMonth(), day);
      const key = localDate(date);
      const row = scopeRow(dayMap[key], mode);
      const profit = money(row.profit);
      const cls = profit > 0 ? 'plus' : profit < 0 ? 'minus' : 'zero';
      cells.push(`
        <div class="v57-day ${cls}">
          <div class="v57-day-top"><b>${day}</b><span>${profit > 0 ? 'กำไร' : profit < 0 ? 'ขาดทุน' : 'ไม่มีรายการ'}</span></div>
          <strong>${profit < 0 ? '-' : ''}฿${fmt(Math.abs(profit))}</strong>
          <small>รายรับ ฿${fmt(row.revenue)}</small>
          <small>ต้นทุน/จ่าย ฿${fmt(row.cogs + row.expenses + row.salary + row.advance)}</small>
        </div>
      `);
    }
    return cells.join('');
  }

  function injectStyle() {
    if (document.getElementById('v57-dashboard-calendar-style')) return;
    const style = document.createElement('style');
    style.id = 'v57-dashboard-calendar-style';
    style.textContent = `
      .dash-v3-icon-box{cursor:pointer;position:relative}
      .dash-v3-icon-box:after{content:'ปฏิทินกำไร';position:absolute;left:50%;bottom:-23px;transform:translateX(-50%);font-size:10px;font-weight:900;color:#94a3b8;white-space:nowrap;opacity:0;transition:opacity .16s ease}
      .dash-v3-icon-box:hover:after{opacity:1}
      .v57-modal{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.62);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px}
      .v57-box{width:min(1120px,100%);max-height:92vh;background:#fff;border-radius:20px;box-shadow:0 34px 90px rgba(15,23,42,.34);overflow:hidden;display:flex;flex-direction:column}
      .v57-head{padding:20px 22px;background:linear-gradient(135deg,#4f46e5,#ec4899);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:14px}
      .v57-title{display:flex;align-items:center;gap:12px}.v57-title i{width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.16);display:grid;place-items:center}.v57-title h3{margin:0;color:#fff;font-size:20px;font-weight:950}.v57-title p{margin:4px 0 0;color:rgba(255,255,255,.78);font-size:12px;font-weight:800}
      .v57-nav{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.v57-nav button{height:38px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.12);color:#fff;border-radius:10px;padding:0 12px;font:inherit;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .v57-body{padding:18px 22px 22px;background:#f8fafc;overflow:auto}.v57-tabs{display:inline-flex;gap:6px;padding:6px;border:1px solid #e2e8f0;background:#fff;border-radius:14px;margin-bottom:14px}.v57-tabs button{height:38px;border:0;border-radius:10px;background:transparent;color:#64748b;padding:0 14px;font:inherit;font-weight:950;cursor:pointer}.v57-tabs button.on{background:#0f172a;color:#fff;box-shadow:0 8px 18px rgba(15,23,42,.16)}.v57-total{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid #e2e8f0;background:#fff;border-radius:15px;padding:14px 16px;margin-bottom:14px}.v57-total span{color:#64748b;font-size:12px;font-weight:950}.v57-total strong{font-size:26px;font-weight:950}
      .v57-grid{display:grid;grid-template-columns:repeat(7,minmax(118px,1fr));gap:9px}.v57-dow{text-align:center;color:#64748b;font-size:12px;font-weight:950;padding:8px}
      .v57-day{min-height:118px;border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:10px;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 18px rgba(15,23,42,.035)}.v57-day.muted{opacity:.35}.v57-day-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.v57-day-top b{font-size:14px}.v57-day-top span{font-size:11px;font-weight:950;border-radius:999px;padding:4px 8px;background:#f1f5f9;color:#64748b}.v57-day strong{font-size:20px;font-weight:950;color:#0f172a}.v57-day small{color:#64748b;font-size:11px;font-weight:850}
      .v57-day.plus{border-color:#bbf7d0;background:#f0fdf4}.v57-day.plus .v57-day-top span{background:#dcfce7;color:#047857}.v57-day.plus strong{color:#047857}
      .v57-day.minus{border-color:#fecaca;background:#fff1f2}.v57-day.minus .v57-day-top span{background:#fee2e2;color:#b91c1c}.v57-day.minus strong{color:#b91c1c}
      .v57-day.zero{background:#fff}.v57-loading{padding:46px;text-align:center;color:#64748b;font-weight:900}.v57-error{padding:24px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:14px;font-weight:900}
      @media(max-width:640px){.v57-head{align-items:flex-start;flex-direction:column}.v57-nav{justify-content:flex-start}.v57-grid{grid-template-columns:repeat(7,minmax(96px,1fr));overflow:auto}.v57-day{min-height:118px}.v57-total{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function modeTabs(offset, active) {
    const modes = [
      ['all', 'รวมทั้งหมด', 'insights'],
      ['store', 'หน้าร้าน', 'storefront'],
      ['project', 'โครงการ', 'business_center'],
    ];
    return `<div class="v57-tabs">${modes.map(([key, label, icon]) => `
      <button class="${active === key ? 'on' : ''}" onclick="v57OpenProfitCalendar(${offset}, '${key}')">
        <i class="material-icons-round" style="font-size:18px;vertical-align:-4px;margin-right:5px">${icon}</i>${label}
      </button>
    `).join('')}</div>`;
  }

  function shell(offset, body, mode = 'all') {
    const info = monthInfo(offset);
    const label = info.first.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    document.getElementById('v57-profit-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'v57-profit-modal';
    modal.className = 'v57-modal';
    modal.innerHTML = `
      <div class="v57-box">
        <div class="v57-head">
          <div class="v57-title"><i class="material-icons-round">insights</i><div><h3>ปฏิทินกำไรจริง</h3><p>${esc(label)} · มุมมอง${esc(modeTitle(mode))} · แสดงกำไรสุทธิรายวันและยอดรวมทั้งเดือน</p></div></div>
          <div class="v57-nav">
            <button onclick="v57OpenProfitCalendar(${info.offset - 1}, '${mode}')"><i class="material-icons-round">chevron_left</i>เดือนก่อน</button>
            <button onclick="v57OpenProfitCalendar(0, '${mode}')">เดือนนี้</button>
            <button onclick="v57OpenProfitCalendar(${info.offset + 1}, '${mode}')">เดือนถัดไป<i class="material-icons-round">chevron_right</i></button>
            <button onclick="document.getElementById('v57-profit-modal')?.remove()"><i class="material-icons-round">close</i></button>
          </div>
        </div>
        <div class="v57-body">${body}</div>
      </div>
    `;
    modal.addEventListener('click', event => {
      if (event.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
    return info;
  }

  window.v57OpenProfitCalendar = async function (offset = 0, mode = 'all') {
    const activeMode = ['all', 'store', 'project'].includes(mode) ? mode : 'all';
    const info = shell(offset, `${modeTabs(offset, activeMode)}<div class="v57-loading">กำลังคำนวณกำไรจริงรายวัน...</div>`, activeMode);
    try {
      const data = await loadMonthProfit(info);
      const total = Object.values(data).reduce((sum, row) => sum + money(scopeRow(row, activeMode).profit), 0);
      const totalHtml = `<div class="v57-total"><div><span>ยอดกำไรจริงรวมทั้งเดือน · ${esc(modeTitle(activeMode))}</span><strong style="color:${total >= 0 ? '#047857' : '#b91c1c'}">${total < 0 ? '-' : ''}฿${fmt(Math.abs(total))}</strong></div><span>เลือกมุมมองหน้าร้าน/โครงการ หรือเปลี่ยนเดือนจากปุ่มด้านบน</span></div>`;
      shell(offset, `${modeTabs(info.offset, activeMode)}${totalHtml}<div class="v57-grid">${renderDays(data, info, activeMode)}</div>`, activeMode);
    } catch (error) {
      console.error('[v57] profit calendar:', error);
      shell(offset, `${modeTabs(offset, activeMode)}<div class="v57-error">โหลดปฏิทินกำไรไม่สำเร็จ: ${esc(error.message || error)}</div>`, activeMode);
    }
  };

  function enhanceDashboardIcon() {
    injectStyle();
    const icon = document.querySelector('#page-dash .dash-v3-icon-box');
    if (!icon || icon.dataset.v57Bound === '1') return;
    icon.dataset.v57Bound = '1';
    icon.title = 'เปิดปฏิทินกำไรจริงรายวัน';
    icon.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      window.v57OpenProfitCalendar(0);
    });
  }

  function wrapDashboard() {
    if (window.renderDashboardV3?.__v57Calendar) return;
    const original = window.renderDashboardV3;
    if (typeof original !== 'function') return;
    window.renderDashboardV3 = async function () {
      const result = await original.apply(this, arguments);
      setTimeout(enhanceDashboardIcon, 0);
      return result;
    };
    window.renderDashboardV3.__v57Calendar = true;
    try { renderDashboardV3 = window.renderDashboardV3; } catch (_) {}
  }

  function boot() {
    injectStyle();
    wrapDashboard();
    enhanceDashboardIcon();
    [200, 800, 1600].forEach(delay => setTimeout(() => {
      wrapDashboard();
      enhanceDashboardIcon();
    }, delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
