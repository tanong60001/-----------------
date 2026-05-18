(function () {
  'use strict';

  const money = v => Number(v || 0);
  const fmt = v => {
    try {
      return typeof formatNum === 'function'
        ? formatNum(v)
        : Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } catch (_) {
      return Number(v || 0).toLocaleString();
    }
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const dateOnly = d => {
    try { return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (_) { return '-'; }
  };
  const timeOnly = d => {
    try { return new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return '-'; }
  };

  function ensureStyle() {
    if (document.getElementById('v39-sales-polish-style')) return;
    const style = document.createElement('style');
    style.id = 'v39-sales-polish-style';
    style.textContent = `
      .v39-payment-loader{position:fixed;inset:0;z-index:1055;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.34);backdrop-filter:blur(10px)}
      .v39-payment-loader.show{display:flex}
      .v39-loader-box{width:min(420px,calc(100vw - 32px));background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 28px 80px rgba(15,23,42,.24);padding:26px;text-align:center;color:#0f172a}
      .v39-loader-mark{width:58px;height:58px;border-radius:50%;margin:0 auto 14px;background:#ecfdf5;display:grid;place-items:center;color:#10b981;position:relative}
      .v39-loader-mark:before{content:'';position:absolute;inset:-5px;border-radius:50%;border:3px solid #d1fae5;border-top-color:#10b981;animation:v39spin .85s linear infinite}
      .v39-loader-box h3{font-size:20px;margin:0 0 4px;font-weight:900;color:#0f172a}
      .v39-loader-box p{margin:0;color:#64748b;font-size:14px}
      @keyframes v39spin{to{transform:rotate(360deg)}}

      .v39-history{display:flex;flex-direction:column;gap:18px;width:min(100%,1680px);margin:0 auto}
      .v39-history-hero{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:22px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;box-shadow:0 14px 34px rgba(15,23,42,.05)}
      .v39-history-title{display:flex;gap:14px;align-items:center}
      .v39-history-title .icon{width:46px;height:46px;border-radius:8px;background:#fee2e2;color:#dc2626;display:grid;place-items:center}
      .v39-history-title h2{margin:0;font-size:24px;font-weight:900;color:#0f172a}
      .v39-history-title p{margin:2px 0 0;color:#64748b;font-size:13px}
      .v39-history-filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .v39-search{min-width:320px;height:46px;border:1px solid #dbe5ef;background:#f8fafc;border-radius:8px;display:flex;align-items:center;gap:10px;padding:0 14px}
      .v39-search i{font-size:20px;color:#94a3b8}
      .v39-search input{border:0;outline:0;background:transparent;width:100%;font-weight:700;color:#0f172a}
      .v39-date{height:46px;border:1px solid #dbe5ef;border-radius:8px;background:#fff;color:#0f172a;padding:0 12px;font-weight:800}
      .v39-export{height:46px;border:0;border-radius:8px;background:#0f172a;color:#fff;padding:0 16px;display:inline-flex;align-items:center;gap:8px;font-weight:900;box-shadow:0 12px 24px rgba(15,23,42,.12)}
      .v39-stats{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:12px}
      .v39-stat{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;display:flex;gap:12px;align-items:center;min-height:82px}
      .v39-stat .dot{width:40px;height:40px;border-radius:8px;display:grid;place-items:center;color:#fff}
      .v39-stat b{display:block;font-size:21px;color:#0f172a;line-height:1;font-weight:900}
      .v39-stat span{display:block;margin-top:5px;color:#64748b;font-size:12px;font-weight:800}
      .v39-table-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:visible;box-shadow:0 16px 36px rgba(15,23,42,.05)}
      .v39-sales-table{width:100%;border-collapse:separate;border-spacing:0}
      .v39-sales-table th{background:#f8fafc;color:#475569;font-size:12px;font-weight:900;text-align:left;padding:14px 18px;border-bottom:1px solid #e2e8f0;white-space:nowrap}
      .v39-sales-table td{padding:15px 18px;border-bottom:1px solid #eef2f7;vertical-align:middle;color:#334155}
      .v39-sales-table tbody tr:hover td{background:#fff7ed}
      .v39-sales-table tbody tr:last-child td{border-bottom:0}
      .v39-bill-no{font-size:17px;font-weight:950;color:#dc2626}
      .v39-sub{font-size:12px;color:#94a3b8;margin-top:2px}
      .v39-customer{font-weight:900;color:#0f172a}
      .v39-money{font-size:17px;font-weight:950;color:#0f172a;text-align:right}
      .v39-discount{font-size:11px;color:#dc2626;margin-top:2px}
      .v39-pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900;white-space:nowrap}
      .v39-pill.cash{background:#ecfdf5;color:#047857}.v39-pill.transfer{background:#eff6ff;color:#1d4ed8}.v39-pill.credit{background:#f5f3ff;color:#6d28d9}.v39-pill.debt{background:#fff7ed;color:#c2410c}.v39-pill.other{background:#f1f5f9;color:#475569}
      .v39-status.success{background:#dcfce7;color:#15803d}.v39-status.warn{background:#fef3c7;color:#b45309}.v39-status.info{background:#dbeafe;color:#1d4ed8}.v39-status.danger{background:#fee2e2;color:#b91c1c}.v39-status.neutral{background:#f1f5f9;color:#475569}
      .v39-actions-wrap{position:relative;display:flex;justify-content:flex-end}
      .v39-actions-toggle{width:38px;height:38px;border-radius:8px;border:1px solid #dbe5ef;background:#fff;color:#475569;display:inline-grid;place-items:center;transition:.15s;box-shadow:0 6px 14px rgba(15,23,42,.04)}
      .v39-actions-toggle:hover,.v39-actions-wrap.open .v39-actions-toggle{background:#0f172a;color:#fff;border-color:#0f172a;box-shadow:0 10px 20px rgba(15,23,42,.14)}
      .v39-actions{position:absolute;right:0;top:44px;z-index:20;display:none;gap:7px;justify-content:flex-end;flex-wrap:wrap;min-width:220px;padding:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 18px 36px rgba(15,23,42,.14)}
      .v39-actions-wrap.open .v39-actions{display:flex}
      .v39-action{width:38px;height:38px;border-radius:8px;border:1px solid #dbe5ef;background:#fff;color:#475569;display:inline-grid;place-items:center;transition:.15s;box-shadow:0 6px 14px rgba(15,23,42,.04)}
      .v39-action i{font-size:18px}.v39-action:hover{transform:translateY(-1px);box-shadow:0 10px 20px rgba(15,23,42,.09)}
      .v39-action.view{color:#2563eb;border-color:#bfdbfe;background:#eff6ff}.v39-action.print{color:#0f766e;border-color:#99f6e4;background:#f0fdfa}.v39-action.pay{color:#059669;border-color:#bbf7d0;background:#ecfdf5}.v39-action.return{color:#d97706;border-color:#fed7aa;background:#fff7ed}.v39-action.cancel{color:#dc2626;border-color:#fecaca;background:#fef2f2}
      .v39-empty{padding:54px;text-align:center;color:#94a3b8}.v39-empty i{font-size:46px;color:#cbd5e1}
      .v39-filter-bar{display:flex;flex-wrap:wrap;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;box-shadow:0 8px 20px rgba(15,23,42,.04)}
      .v39-filter-bar .v39-filter-label{display:inline-flex;align-items:center;gap:6px;color:#64748b;font-weight:900;font-size:12px;margin-right:6px;padding:6px 0}
      .v39-filter-bar .v39-filter-label i{font-size:18px;color:#94a3b8}
      .v39-chip{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#475569;border-radius:999px;padding:7px 14px;font-size:12px;font-weight:900;cursor:pointer;transition:.15s;white-space:nowrap}
      .v39-chip:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(15,23,42,.06)}
      .v39-chip.active{background:#dc2626;border-color:#dc2626;color:#fff;box-shadow:0 8px 18px rgba(220,38,38,.22)}
      .v39-chip.active.warn{background:#d97706;border-color:#d97706}
      .v39-chip.active.info{background:#2563eb;border-color:#2563eb}
      .v39-chip.active.danger{background:#b91c1c;border-color:#b91c1c}
      .v39-chip .count{background:rgba(15,23,42,.08);color:inherit;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:900}
      .v39-chip.active .count{background:rgba(255,255,255,.22);color:#fff}
      @media(max-width:1100px){.v39-history-hero{grid-template-columns:1fr}.v39-history-filters{justify-content:flex-start}.v39-stats{grid-template-columns:repeat(2,1fr)}.v39-search{min-width:220px}}
      @media(max-width:720px){.v39-stats{grid-template-columns:1fr}.v39-sales-table{min-width:980px}.v39-table-wrap{overflow:auto}.v39-history-hero{padding:16px}.v39-history-filters{display:grid;grid-template-columns:1fr}.v39-search{min-width:0}.v39-export{justify-content:center}.v39-actions{position:static;min-width:0;margin-top:8px}}
    `;
    document.head.appendChild(style);
  }

  function ensureLoader() {
    let el = document.getElementById('v39-payment-loader');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'v39-payment-loader';
    el.className = 'v39-payment-loader';
    el.innerHTML = `<div class="v39-loader-box">
      <div class="v39-loader-mark"><i class="material-icons-round">receipt_long</i></div>
      <h3 id="v39-loader-title">กำลังบันทึกบิล</h3>
      <p id="v39-loader-sub">ระบบกำลังตัดสต็อกและบันทึกข้อมูล กรุณารอสักครู่</p>
    </div>`;
    document.body.appendChild(el);
    return el;
  }

  window.v39ShowPaymentLoading = function (title = 'กำลังบันทึกบิล', sub = 'ระบบกำลังตัดสต็อกและบันทึกข้อมูล กรุณารอสักครู่') {
    ensureStyle();
    const el = ensureLoader();
    const t = document.getElementById('v39-loader-title');
    const s = document.getElementById('v39-loader-sub');
    if (t) t.textContent = title;
    if (s) s.textContent = sub;
    el.classList.add('show');
  };

  window.v39HidePaymentLoading = function () {
    const el = document.getElementById('v39-payment-loader');
    if (el) el.classList.remove('show');
  };

  function wrapPayment(name) {
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__v39Loader) return;
    window[name] = async function () {
      window.v39ShowPaymentLoading(
        'กำลังบันทึกบิลจัดส่ง',
        'กำลังยืนยันการชำระเงิน ตัดสต็อก และอัปเดตสถานะบิล'
      );
      try {
        return await fn.apply(this, arguments);
      } finally {
        window.v39HidePaymentLoading();
      }
    };
    window[name].__v39Loader = true;
    try { if (name === 'completePayment') completePayment = window[name]; } catch (_) {}
    try { if (name === 'v9Sale') v9Sale = window[name]; } catch (_) {}
  }

  function methodClass(method) {
    const m = String(method || '');
    if (/เงินสด/.test(m)) return 'cash';
    if (/โอน|พร้อมเพย์/.test(m)) return 'transfer';
    if (/เครดิต|บัตร/.test(m)) return 'credit';
    if (/ค้าง|บางส่วน/.test(m)) return 'debt';
    return 'other';
  }

  function statusClass(status) {
    const s = String(status || '');
    if (/สำเร็จ|ชำระแล้ว/.test(s)) return 'success';
    if (/ค้าง|บางส่วน|รอ/.test(s)) return 'warn';
    if (/โครงการ|จัดส่ง/.test(s)) return 'info';
    if (/ยกเลิก|คืน/.test(s)) return 'danger';
    return 'neutral';
  }

  function deliveryText(bill) {
    const s = String(bill?.delivery_status || '');
    if (s) return s;
    const mode = String(bill?.delivery_mode || '');
    if (/ส่ง|จัดส่ง/.test(mode)) return 'รอจัดส่ง';
    return 'รับเอง / ไม่จัดส่ง';
  }

  function canReturn(b) {
    return !/ยกเลิก|คืนสินค้า/.test(String(b?.status || '')) && !b?.project_id;
  }

  function isDebtLike(b) {
    return /ค้าง|บางส่วน/.test(String(b?.status || '')) || money(b?.deposit_amount) > 0 && money(b?.deposit_amount) < money(b?.total);
  }

  function isCancelledBill(b) {
    return /ยกเลิก|คืนสินค้า|คืนบางส่วน/.test(String(b?.status || ''));
  }

  function isProjectBillV39(b) {
    if (!b) return false;
    if (b.project_id) return true;
    const text = `${b.customer_name || ''} ${b.method || ''} ${b.status || ''} ${b.note || ''}`;
    return /\[โครงการ\]|เบิกของโครงการ|จ่ายของให้โครงการ|ต้นทุนโครงการ|project/i.test(text);
  }

  function isUnshippedBill(b) {
    if (isCancelledBill(b) || isProjectBillV39(b)) return false;
    const mode = String(b?.delivery_mode || '').toLowerCase();
    const dstatus = String(b?.delivery_status || '');
    if (mode === 'deliver' || mode === 'partial') {
      return !/สำเร็จ|delivered/i.test(dstatus);
    }
    return /รอจัดส่ง/.test(dstatus) || /รอจัดส่ง/.test(String(b?.status || ''));
  }

  function isUnpaidBill(b) {
    if (isCancelledBill(b) || isProjectBillV39(b)) return false;
    const total = money(b?.total);
    const paid = money(b?.deposit_amount);
    if (paid >= total && total > 0) return false;
    const status = String(b?.status || '');
    const method = String(b?.method || '');
    return paid <= 0 && /ค้าง|debt/i.test(status + ' ' + method);
  }

  function isPartialPaidBill(b) {
    if (isCancelledBill(b) || isProjectBillV39(b)) return false;
    const total = money(b?.total);
    const paid = money(b?.deposit_amount);
    return paid > 0 && paid < total;
  }

  function isIncompleteBill(b) {
    return isUnshippedBill(b) || isUnpaidBill(b) || isPartialPaidBill(b);
  }

  function isDepositOpenBillV39(b) {
    if (isCancelledBill(b) || isProjectBillV39(b)) return false;
    const dep = money(b?.deposit_amount);
    const total = money(b?.total);
    if (dep <= 0) return false;
    const status = String(b?.status || '');
    const dstatus = String(b?.delivery_status || '');
    const debtLike = /ค้าง|บางส่วน/.test(status) || dep < total;
    const pending = /รอ|จัดส่ง/.test(dstatus);
    return debtLike || pending;
  }

  window.v39HistoryFilter = window.v39HistoryFilter || 'all';
  window.v39SetHistoryFilter = function (key) {
    window.v39HistoryFilter = key || 'all';
    window.v39LoadHistoryData?.();
  };

  window.v39ToggleHistoryActions = function (billId, ev) {
    ev?.stopPropagation?.();
    const target = document.querySelector(`[data-v39-actions="${billId}"]`);
    document.querySelectorAll('.v39-actions-wrap.open').forEach(el => {
      if (el !== target) el.classList.remove('open');
    });
    target?.classList.toggle('open');
  };

  if (!window.__v39HistoryActionsClose) {
    document.addEventListener('click', ev => {
      if (ev.target?.closest?.('.v39-actions-wrap')) return;
      document.querySelectorAll('.v39-actions-wrap.open').forEach(el => el.classList.remove('open'));
    });
    window.__v39HistoryActionsClose = true;
  }

  window.renderHistory = async function () {
    ensureStyle();
    const section = document.getElementById('page-history');
    if (!section) return;
    const today = appLocalDateKey();
    section.innerHTML = `<div class="v39-history">
      <div class="v39-history-hero">
        <div class="v39-history-title">
          <div class="icon"><i class="material-icons-round">history</i></div>
          <div><h2>ประวัติการขาย</h2><p>ตรวจสอบบิล พิมพ์เอกสาร รับชำระ คืนสินค้า และยกเลิกบิลในหน้าเดียว</p></div>
        </div>
        <div class="v39-history-filters">
          <label class="v39-search"><i class="material-icons-round">search</i><input type="text" id="history-search" placeholder="ค้นหาบิล ลูกค้า พนักงาน..."></label>
          <input type="date" class="v39-date" id="history-date" value="${today}" onchange="v39LoadHistoryData()">
          <button class="v39-export" onclick="exportHistory()"><i class="material-icons-round">download</i> Export</button>
        </div>
      </div>
      <div id="history-stats" class="v39-stats"></div>
      <div class="v39-table-wrap">
        <table class="v39-sales-table">
          <thead><tr><th>บิล</th><th>วันเวลา</th><th>ลูกค้า</th><th>วิธีชำระ</th><th>จัดส่ง</th><th class="text-right">ยอดรวม</th><th>สถานะ</th><th style="text-align:right">จัดการ</th></tr></thead>
          <tbody id="history-tbody"></tbody>
        </table>
      </div>
    </div>`;
    document.getElementById('history-search')?.addEventListener('input', window.v39LoadHistoryData);
    await window.v39LoadHistoryData();
  };

  window.v39LoadHistoryData = async function () {
    const date = document.getElementById('history-date')?.value || appLocalDateKey();
    const search = (document.getElementById('history-search')?.value || '').toLowerCase();
    const activeFilter = window.v39HistoryFilter || 'all';
    const depositFilterOn = window.v68HistoryFilter === 'depositPending';
    const broaden = !!search || activeFilter !== 'all' || depositFilterOn;
    let query = db.from('บิลขาย').select('*').order('date', { ascending: false });
    if (broaden) {
      query = query.range(0, 4999);
    } else {
      query = query.gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59');
    }
    const { data: bills, error } = await query;
    if (error) {
      if (typeof toast === 'function') toast('โหลดประวัติการขายไม่สำเร็จ', 'error');
      return;
    }
    const scopedBills = broaden ? (bills || []) : (bills || []).filter(b => String(b.date || '').slice(0, 10) === date);
    let filtered = scopedBills.filter(b => {
      const hay = `${b.bill_no || ''} ${b.customer_name || ''} ${b.staff_name || ''} ${b.method || ''} ${b.status || ''}`.toLowerCase();
      return !search || hay.includes(search);
    });
    const filterCounts = {
      incomplete: filtered.filter(isIncompleteBill).length,
      unshipped: filtered.filter(isUnshippedBill).length,
      unpaid: filtered.filter(isUnpaidBill).length,
      partial: filtered.filter(isPartialPaidBill).length,
    };
    if (depositFilterOn) filtered = filtered.filter(isDepositOpenBillV39);
    else if (activeFilter === 'incomplete') filtered = filtered.filter(isIncompleteBill);
    else if (activeFilter === 'unshipped') filtered = filtered.filter(isUnshippedBill);
    else if (activeFilter === 'unpaid') filtered = filtered.filter(isUnpaidBill);
    else if (activeFilter === 'partial') filtered = filtered.filter(isPartialPaidBill);
    const valid = filtered.filter(b => !/ยกเลิก|คืนสินค้า/.test(String(b.status || '')));
    const totalSales = valid.reduce((s, b) => s + money(b.total), 0);
    const totalDiscount = filtered.reduce((s, b) => s + money(b.discount), 0);
    const stats = [
      ['#dc2626', 'receipt_long', filtered.length, 'บิลทั้งหมด'],
      ['#16a34a', 'payments', '฿' + fmt(totalSales), 'ยอดขายสุทธิ'],
      ['#2563eb', 'qr_code_2', filtered.filter(b => /โอน|พร้อมเพย์/.test(String(b.method || ''))).length, 'โอนเงิน'],
      ['#f59e0b', 'local_shipping', filtered.filter(b => /รอ|จัดส่ง/.test(deliveryText(b))).length, 'งานจัดส่ง'],
      ['#7c3aed', 'sell', '฿' + fmt(totalDiscount), 'ส่วนลดรวม'],
    ];
    const statsEl = document.getElementById('history-stats');
    if (statsEl) statsEl.innerHTML = stats.map(s => `<div class="v39-stat"><div class="dot" style="background:${s[0]}"><i class="material-icons-round">${s[1]}</i></div><div><b>${esc(s[2])}</b><span>${esc(s[3])}</span></div></div>`).join('');

    const filterBar = document.getElementById('history-filter-bar');
    if (filterBar) {
      const chips = [
        { key: 'all', label: 'ทั้งหมด', icon: 'list_alt', count: null, tone: '' },
        { key: 'incomplete', label: 'ยังไม่สำเร็จ', icon: 'pending_actions', count: filterCounts.incomplete, tone: 'warn' },
        { key: 'unshipped', label: 'ยังไม่ส่ง', icon: 'local_shipping', count: filterCounts.unshipped, tone: 'info' },
        { key: 'unpaid', label: 'ยังไม่ชำระ', icon: 'money_off', count: filterCounts.unpaid, tone: 'danger' },
        { key: 'partial', label: 'ชำระไม่ครบ', icon: 'price_change', count: filterCounts.partial, tone: 'warn' },
      ];
      filterBar.innerHTML = `<span class="v39-filter-label"><i class="material-icons-round">filter_alt</i>หมวดบิล:</span>`
        + chips.map(c => `<button type="button" class="v39-chip ${activeFilter === c.key ? 'active ' + c.tone : ''}" onclick="v39SetHistoryFilter('${c.key}')"><i class="material-icons-round" style="font-size:15px">${c.icon}</i>${esc(c.label)}${c.count != null ? `<span class="count">${c.count}</span>` : ''}</button>`).join('');
    }

    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="v39-empty"><i class="material-icons-round">receipt_long</i><div>ไม่พบประวัติการขาย</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(b => {
      const printFn = typeof window.v24ShowDocSelector === 'function' ? 'v24ShowDocSelector' : 'v5PrintFromHistory';
      const retFn = typeof window.v10ShowReturnModal === 'function' ? `v10ShowReturnModal('${b.id}')` : `v12ReturnBill('${b.id}')`;
      return `<tr>
        <td><div class="v39-bill-no">#${esc(b.bill_no || b.id)}</div><div class="v39-sub">${esc(b.staff_name || '-')}</div></td>
        <td><div style="font-weight:900;color:#0f172a">${esc(dateOnly(b.date))}</div><div class="v39-sub">${esc(timeOnly(b.date))}</div></td>
        <td><div class="v39-customer">${esc(b.customer_name || 'ลูกค้าทั่วไป')}</div><div class="v39-sub">${esc(b.customer_phone || b.delivery_phone || '')}</div></td>
        <td><span class="v39-pill ${methodClass(b.method)}"><i class="material-icons-round" style="font-size:15px">${methodClass(b.method) === 'cash' ? 'payments' : methodClass(b.method) === 'transfer' ? 'qr_code' : methodClass(b.method) === 'credit' ? 'credit_card' : 'schedule'}</i>${esc(b.method || '-')}</span></td>
        <td><span class="v39-pill other"><i class="material-icons-round" style="font-size:15px">local_shipping</i>${esc(deliveryText(b))}</span></td>
        <td class="v39-money">฿${fmt(b.total)}${money(b.discount) > 0 ? `<div class="v39-discount">ลด ฿${fmt(b.discount)}</div>` : ''}</td>
        <td><span class="v39-pill v39-status ${statusClass(b.status)}">${esc(b.status || '-')}</span></td>
        <td><div class="v39-actions-wrap" data-v39-actions="${b.id}">
          <button class="v39-actions-toggle" onclick="v39ToggleHistoryActions('${b.id}', event)" title="จัดการ"><i class="material-icons-round">more_horiz</i></button>
          <div class="v39-actions">
            <button class="v39-action view" onclick="viewBillDetail('${b.id}')" title="ดูรายละเอียด"><i class="material-icons-round">receipt</i></button>
            <button class="v39-action print" onclick="${printFn}('${b.id}')" title="พิมพ์เอกสาร"><i class="material-icons-round">print</i></button>
            ${isDebtLike(b) && typeof window.v20BMCPayDebt === 'function' ? `<button class="v39-action pay" onclick="v20BMCPayDebt('${b.id}')" title="รับชำระ"><i class="material-icons-round">payments</i></button>` : ''}
            ${canReturn(b) && (typeof window.v10ShowReturnModal === 'function' || typeof window.v12ReturnBill === 'function') ? `<button class="v39-action return" onclick="${retFn}" title="คืนสินค้า"><i class="material-icons-round">assignment_return</i></button>` : ''}
            ${!/ยกเลิก|คืนสินค้า/.test(String(b.status || '')) ? `<button class="v39-action cancel" onclick="cancelBill('${b.id}')" title="ยกเลิก"><i class="material-icons-round">cancel</i></button>` : ''}
          </div>
        </div></td>
      </tr>`;
    }).join('');
  };

  window.v5LoadHistoryData = window.v39LoadHistoryData;
  window.loadHistoryData = window.v39LoadHistoryData;
  try { renderHistory = window.renderHistory; } catch (_) {}
  try { loadHistoryData = window.v39LoadHistoryData; } catch (_) {}
  try { v5LoadHistoryData = window.v39LoadHistoryData; } catch (_) {}

  function install() {
    ensureStyle();
    wrapPayment('v9Sale');
    wrapPayment('completePayment');
    wrapPayment('v12DQMarkDone');
    wrapPayment('v20BMCPayDebt');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
