(function () {
  'use strict';

  console.log('[v70] checkout customer banner + deposit stat + smoother sync');

  const num = v => { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const fmt = v => {
    try { if (typeof formatNum === 'function') return formatNum(v); } catch (_) {}
    return num(v).toLocaleString('th-TH');
  };

  function setGlobalFn(name, fn) {
    try { window[name] = fn; } catch (_) {}
    try { Function('n', 'f', 'window[n]=f;eval(n+"=f");')(name, fn); } catch (_) {}
  }

  function getV12State() {
    try { return v12State || window.v12State || null; }
    catch (_) { return window.v12State || null; }
  }

  function getCheckoutState() {
    try { return checkoutState || window.checkoutState || null; }
    catch (_) { return window.checkoutState || null; }
  }

  function activeCustomer() {
    const v12 = getV12State();
    if (v12?.customer?.name) return v12.customer;
    const cs = getCheckoutState();
    if (cs?.customer?.name) return cs.customer;
    return null;
  }

  /* ─────────────────────────────────────────────────────────────
     1) Smoother cart sync — debounce 'cart' messages to display
        Rapid cart mutations (scanner bursts, multi-item adds) get
        coalesced into a single post within ~80 ms.
  ───────────────────────────────────────────────────────────── */
  function wrapSendToDisplayDebounce() {
    const orig = window.sendToDisplay;
    if (typeof orig !== 'function' || orig.__v70Debounce) return;
    let pendingCart = null;
    let timerId = null;
    const flush = () => {
      timerId = null;
      if (pendingCart) {
        const data = pendingCart;
        pendingCart = null;
        try { orig(data); } catch (e) { console.warn('[v70] sendToDisplay flush:', e); }
      }
    };
    const wrapped = function (data) {
      if (data && data.type === 'cart') {
        pendingCart = data;
        if (!timerId) timerId = setTimeout(flush, 80);
        return;
      }
      // For non-cart messages, flush pending cart first (preserve order),
      // then send immediately.
      if (pendingCart && timerId) {
        clearTimeout(timerId);
        timerId = null;
        try { orig(pendingCart); } catch (_) {}
        pendingCart = null;
      }
      return orig(data);
    };
    Object.defineProperty(wrapped, '__v70Debounce', { value: true });
    setGlobalFn('sendToDisplay', wrapped);
  }

  /* ─────────────────────────────────────────────────────────────
     2) Customer name banner at the TOP of the checkout popup
  ───────────────────────────────────────────────────────────── */
  function injectCheckoutBannerStyle() {
    if (document.getElementById('v70-checkout-banner-style')) return;
    const s = document.createElement('style');
    s.id = 'v70-checkout-banner-style';
    s.textContent = `
      .v70-cust-banner{
        grid-column:1 / -1; grid-row:auto;
        margin:10px 18px 0; padding:10px 18px;
        background:linear-gradient(135deg,#ecfdf5 0%,#f0fdfa 70%,#ffffff 100%);
        border:1.5px solid #99f6e4;border-radius:14px;
        display:flex;align-items:center;gap:14px;
        box-shadow:0 8px 22px rgba(16,185,129,.10);
        position:relative;z-index:5;animation:v70-banner-in .3s cubic-bezier(.34,1.56,.64,1);
      }
      @keyframes v70-banner-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      .v70-cust-banner.empty{
        background:linear-gradient(135deg,#fff7ed 0%,#fffbeb 100%);
        border-color:#fde68a;box-shadow:0 8px 22px rgba(245,158,11,.10);
      }
      .v70-cust-banner.draft{background:linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%);border-color:#bfdbfe;box-shadow:0 8px 22px rgba(37,99,235,.10)}
      .v70-cust-banner.project{background:linear-gradient(135deg,#eef2ff 0%,#ede9fe 100%);border-color:#c7d2fe;box-shadow:0 8px 22px rgba(99,102,241,.10)}
      .v70-cb-ic{width:44px;height:44px;border-radius:13px;background:#10b981;color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 6px 18px rgba(16,185,129,.30)}
      .v70-cust-banner.empty .v70-cb-ic{background:#f59e0b;box-shadow:0 6px 18px rgba(245,158,11,.28)}
      .v70-cust-banner.draft .v70-cb-ic{background:#2563eb;box-shadow:0 6px 18px rgba(37,99,235,.30)}
      .v70-cust-banner.project .v70-cb-ic{background:#6366f1;box-shadow:0 6px 18px rgba(99,102,241,.28)}
      .v70-cb-ic i{font-size:24px}
      .v70-cb-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
      .v70-cb-label{font-size:11px;font-weight:900;color:#047857;text-transform:uppercase;letter-spacing:.6px;line-height:1}
      .v70-cust-banner.empty .v70-cb-label{color:#b45309}
      .v70-cust-banner.draft .v70-cb-label{color:#1d4ed8}
      .v70-cust-banner.project .v70-cb-label{color:#4f46e5}
      .v70-cb-name{font-size:22px;font-weight:950;color:#0f172a;line-height:1.15;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.3px}
      .v70-cb-sub{font-size:12px;font-weight:850;color:#475569;margin-top:3px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
      .v70-cb-sub span{display:inline-flex;align-items:center;gap:4px}
      .v70-cb-sub i{font-size:14px;color:#64748b}
      .v70-cb-tag{font-size:11px;font-weight:900;background:rgba(16,185,129,.12);color:#047857;padding:4px 10px;border-radius:999px;border:1px solid rgba(16,185,129,.25);white-space:nowrap}
      .v70-cust-banner.empty .v70-cb-tag{background:rgba(245,158,11,.12);color:#b45309;border-color:rgba(245,158,11,.25)}
      .v70-cust-banner.draft .v70-cb-tag{background:rgba(37,99,235,.12);color:#1d4ed8;border-color:rgba(37,99,235,.25)}
      .v70-cust-banner.project .v70-cb-tag{background:rgba(99,102,241,.12);color:#4f46e5;border-color:rgba(99,102,241,.25)}
      .v70-cb-debt{font-size:11px;font-weight:950;background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:999px;border:1px solid #fecaca}

      /* Make the modal grid leave space for the banner */
      .checkout-modal.v36-checkout-modal:has(.v70-cust-banner){
        grid-template-rows: 70px 86px minmax(0,1fr) auto !important;
      }
      .checkout-modal.v36-checkout-modal:has(.v70-cust-banner) .v70-cust-banner{
        grid-column: 2 / -1 !important; grid-row: 1 !important;
        margin: 12px 18px 0 !important;
      }
      .checkout-modal.v36-checkout-modal:has(.v70-cust-banner) .checkout-progress{
        grid-row: 2 !important;
      }
      .checkout-modal.v36-checkout-modal:has(.v70-cust-banner) .checkout-content{
        grid-row: 3 !important;
      }
      .checkout-modal.v36-checkout-modal:has(.v70-cust-banner) .checkout-footer{
        grid-row: 4 !important;
      }
      .checkout-modal.v36-checkout-modal:has(.v70-cust-banner)::before{
        grid-row: 1 / span 2 !important;
      }
      .checkout-modal.v36-checkout-modal:has(.v70-cust-banner) .v36-checkout-summary{
        grid-row: 1 / span 4 !important;
      }
    `;
    document.head.appendChild(s);
  }

  function customerTypeLabel(c) {
    const t = String(c?.type || '').toLowerCase();
    if (t === 'general') return { tag: 'ลูกค้าทั่วไป', cls: 'empty', icon: 'shopping_bag' };
    if (t === 'new') return { tag: 'ลูกค้าใหม่', cls: 'draft', icon: 'person_add' };
    if (t === 'project') return { tag: 'โครงการ', cls: 'project', icon: 'business_center' };
    return { tag: 'ลูกค้าประจำ', cls: '', icon: 'badge' };
  }

  function renderCheckoutCustomerBanner() {
    const modal = document.querySelector('.checkout-modal.v36-checkout-modal') || document.querySelector('.checkout-modal');
    if (!modal) return;
    // Only show banner when modal is open & visible
    const overlay = document.getElementById('checkout-overlay');
    if (!overlay || overlay.classList.contains('hidden')) {
      modal.querySelector('.v70-cust-banner')?.remove();
      return;
    }
    injectCheckoutBannerStyle();
    let banner = modal.querySelector('.v70-cust-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'v70-cust-banner empty';
      modal.prepend(banner);
    }
    const c = activeCustomer();
    const has = !!(c?.name && String(c.name).trim());
    const label = customerTypeLabel(c);
    const projectName = c?.project_name ? `[โครงการ] ${c.project_name}` : '';
    const showName = has ? (projectName || c.name) : 'ยังไม่ได้เลือกลูกค้า';
    const phone = c?.phone || '';
    const address = c?.address || '';
    const debt = num(c?.debt_amount);

    banner.className = 'v70-cust-banner ' + (has ? label.cls : 'empty');
    banner.innerHTML = `
      <div class="v70-cb-ic"><i class="material-icons-round">${has ? label.icon : 'help'}</i></div>
      <div class="v70-cb-body">
        <div class="v70-cb-label">${has ? 'ลูกค้าที่เลือก' : 'ยังไม่ได้เลือกลูกค้า'}</div>
        <div class="v70-cb-name">${esc(showName)}</div>
        ${has ? `<div class="v70-cb-sub">
          ${phone ? `<span><i class="material-icons-round">call</i>${esc(phone)}</span>` : ''}
          ${address ? `<span><i class="material-icons-round">location_on</i>${esc(address).slice(0,80)}${address.length>80?'…':''}</span>` : ''}
          ${!phone && !address ? '<span style="color:#94a3b8">ยังไม่มีข้อมูลติดต่อ</span>' : ''}
        </div>` : '<div class="v70-cb-sub"><span style="color:#92400e">กดเลือกประเภทลูกค้าจากบัตรด้านล่าง</span></div>'}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <span class="v70-cb-tag">${esc(label.tag)}</span>
        ${has && debt > 0 ? `<span class="v70-cb-debt">หนี้ ฿${fmt(debt)}</span>` : ''}
      </div>
    `;
  }

  function watchCheckoutModal() {
    const overlay = document.getElementById('checkout-overlay');
    if (!overlay) return;
    const observer = new MutationObserver(() => {
      renderCheckoutCustomerBanner();
    });
    observer.observe(overlay, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    // Periodic refresh — v12State changes don't always trigger DOM mutations
    setInterval(() => {
      if (!overlay.classList.contains('hidden')) renderCheckoutCustomerBanner();
    }, 600);
    renderCheckoutCustomerBanner();
  }

  /* ─────────────────────────────────────────────────────────────
     3) Deposit + pending-delivery: enhance status pill + add stat chip
  ───────────────────────────────────────────────────────────── */
  function injectDepositStyle() {
    if (document.getElementById('v70-deposit-style')) return;
    const s = document.createElement('style');
    s.id = 'v70-deposit-style';
    s.textContent = `
      .v70-status-combo{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:4px!important;line-height:1.1;max-width:200px}
      .v70-status-combo .v39-pill{padding:4px 10px!important;font-size:12px!important;font-weight:900!important;border-radius:999px!important}
      .v70-pill-deposit{display:inline-flex;align-items:center;gap:4px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:900;white-space:nowrap}
      .v70-pill-deposit i{font-size:12px}
      .v70-pill-pending{display:inline-flex;align-items:center;gap:4px;background:#fff1f2;color:#be123c;border:1px solid #fecdd3;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:900;white-space:nowrap}
      .v70-pill-pending i{font-size:12px}
      /* Tightly packed extra stat chip */
      .v70-stat-deposit{flex:0 1 auto!important;min-width:138px!important}
      .v70-stat-deposit .dot{background:#ea580c!important}
    `;
    document.head.appendChild(s);
  }

  function isDepositPendingBill(b) {
    const dep = num(b?.deposit_amount);
    const status = String(b?.status || '');
    const delivery = String(b?.delivery_status || '');
    const total = num(b?.total);
    const debtLike = /ค้าง|บางส่วน/.test(status) || (dep > 0 && dep < total);
    const pending = /รอ|จัดส่ง/.test(delivery);
    return dep > 0 && (debtLike || pending);
  }

  async function fetchDepositBills() {
    try {
      const date = document.getElementById('history-date')?.value || new Date().toISOString().split('T')[0];
      const search = (document.getElementById('history-search')?.value || '').toLowerCase();
      let q = db.from('บิลขาย').select('*').order('date', { ascending: false });
      if (search) q = q.range(0, 4999);
      else q = q.gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59');
      const { data } = await q;
      return data || [];
    } catch (e) {
      console.warn('[v70] fetchDepositBills:', e);
      return [];
    }
  }

  function injectDepositChip(count, amount) {
    // v71 owns the deposit chip entirely. v70 never creates or writes it
    // anymore — that prevents the v70/v71 fight that produced 2 chips with
    // different counts (one with the old loose logic, one with the strict).
    const stats = document.getElementById('history-stats');
    if (!stats) return;
    // De-dupe defensively in case both modules created one earlier.
    const all = stats.querySelectorAll('.v70-stat-deposit, .v71-stat-deposit');
    for (let i = 1; i < all.length; i++) all[i].remove();
  }

  function patchHistoryRowStatusPills() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    // For each row, parse the existing status text and append deposit/delivery pill
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.dataset.v70Combo === '1') return;
      const cells = tr.querySelectorAll('td');
      if (cells.length < 7) return;
      const statusCell = cells[6];
      const statusPill = statusCell.querySelector('.v39-pill.v39-status');
      if (!statusPill) return;
      // Check the bill id from the actions cell button onclick
      const actBtn = tr.querySelector('button[onclick*="viewBillDetail"]');
      const m = actBtn?.getAttribute('onclick')?.match(/viewBillDetail\('([^']+)'\)/);
      const billId = m ? m[1] : '';
      if (!billId) return;
      // Pull cached bill from window.__v70BillCache
      const bill = window.__v70BillCache?.get(billId);
      if (!bill) return;
      // Only add a "มัดจำ" sub-pill when there is still an outstanding
      // deposit. The "รอจัดส่ง" pill is intentionally omitted — that info
      // is already in the delivery column right next to status.
      const dep = num(bill.deposit_amount);
      const total = num(bill.total);
      const outstanding = dep > 0 && dep < total - 0.009;
      const extras = [];
      if (outstanding) extras.push(`<span class="v70-pill-deposit"><i class="material-icons-round">savings</i>มัดจำ ฿${fmt(dep)}</span>`);
      if (!extras.length) { tr.dataset.v70Combo = '1'; return; }
      const wrap = document.createElement('div');
      wrap.className = 'v70-status-combo';
      wrap.innerHTML = statusPill.outerHTML + extras.join('');
      statusPill.replaceWith(wrap);
      tr.dataset.v70Combo = '1';
    });
  }

  async function refreshDepositChipAndPills() {
    injectDepositStyle();
    const bills = await fetchDepositBills();
    window.__v70BillCache = new Map();
    bills.forEach(b => window.__v70BillCache.set(b.id, b));
    const depBills = bills.filter(isDepositPendingBill);
    const depTotal = depBills.reduce((s, b) => s + num(b.deposit_amount), 0);
    injectDepositChip(depBills.length, fmt(depTotal));

    // If user activated the depositPending filter, override tbody contents
    if (window.v68HistoryFilter === 'depositPending') {
      const tbody = document.getElementById('history-tbody');
      if (tbody && typeof window.v39LoadHistoryData === 'function') {
        // Replace rows by rendering only deposit bills using a recursive replay
        renderDepositOnlyRows(depBills, tbody);
      }
    }
    patchHistoryRowStatusPills();
  }

  function billDate(value) {
    if (!value) return '-';
    try { return new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (_) { return String(value).slice(0, 10); }
  }
  function billTime(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return ''; }
  }
  function deliveryText(b) {
    const s = String(b?.delivery_status || '');
    if (s) return s;
    return /ส่ง|จัดส่ง/.test(String(b?.delivery_mode || '')) ? 'รอจัดส่ง' : 'รับเอง / ไม่จัดส่ง';
  }
  function methodClass(method) {
    const m = String(method || '');
    if (/เงินสด/.test(m)) return 'cash';
    if (/โอน|พร้อมเพย์/.test(m)) return 'transfer';
    if (/บัตร|เครดิต/.test(m)) return 'credit';
    if (/ค้าง/.test(m)) return 'debt';
    return 'other';
  }
  function statusClass(status) {
    const s = String(status || '');
    if (/สำเร็จ|รอจัดส่ง/.test(s)) return 'done';
    if (/ค้าง|บางส่วน/.test(s)) return 'debt';
    if (/ยกเลิก|คืน/.test(s)) return 'cancel';
    return 'other';
  }
  function renderDepositOnlyRows(bills, tbody) {
    if (!bills.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="v39-empty"><i class="material-icons-round">savings</i><div>ไม่พบใบติดมัดจำที่รอจัดส่ง</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = bills.map(b => `<tr data-v70-combo="1">
      <td><div class="v39-bill-no">#${esc(b.bill_no || b.id)}</div><div class="v39-sub">${esc(b.staff_name || '-')}</div></td>
      <td><div style="font-weight:900;color:#0f172a">${esc(billDate(b.date))}</div><div class="v39-sub">${esc(billTime(b.date))}</div></td>
      <td><div class="v39-customer">${esc(b.customer_name || 'ลูกค้าทั่วไป')}</div><div class="v39-sub">${esc(b.delivery_phone || '')}</div></td>
      <td><span class="v39-pill ${methodClass(b.method)}">${esc(b.method || '-')}</span></td>
      <td><span class="v39-pill other"><i class="material-icons-round" style="font-size:15px">local_shipping</i>${esc(deliveryText(b))}</span></td>
      <td class="v39-money">฿${fmt(b.total)}<div class="v39-discount" style="color:#c2410c">มัดจำ ฿${fmt(b.deposit_amount)}</div></td>
      <td><div class="v70-status-combo">
        <span class="v39-pill v39-status ${statusClass(b.status)}">${esc(b.status || '-')}</span>
        <span class="v70-pill-deposit"><i class="material-icons-round">savings</i>มัดจำ ฿${fmt(b.deposit_amount)}</span>
      </div></td>
      <td><button class="v39-action view" onclick="viewBillDetail('${esc(b.id)}')"><i class="material-icons-round">receipt</i></button>
          <button class="v39-action print" onclick="${typeof window.v24ShowDocSelector === 'function' ? 'v24ShowDocSelector' : 'v5PrintFromHistory'}('${esc(b.id)}')" title="พิมพ์เอกสาร"><i class="material-icons-round">print</i></button>
      </td>
    </tr>`).join('');
  }

  function patchHistoryLoad() {
    const orig = window.v39LoadHistoryData || window.loadHistoryData;
    if (typeof orig !== 'function' || orig.__v70) return;
    const wrapped = async function (...args) {
      const r = await orig.apply(this, args);
      setTimeout(refreshDepositChipAndPills, 30);
      setTimeout(refreshDepositChipAndPills, 300);
      return r;
    };
    Object.defineProperty(wrapped, '__v70', { value: true });
    setGlobalFn('v39LoadHistoryData', wrapped);
    setGlobalFn('loadHistoryData', wrapped);
  }

  function watchHistoryPage() {
    patchHistoryLoad();
    const section = document.getElementById('page-history') || document.getElementById('page-sale-history');
    if (!section) return;
    if (section.dataset.v70Watching === '1') return;
    section.dataset.v70Watching = '1';
    let scheduled = false;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        mo.disconnect();
        try { patchHistoryRowStatusPills(); }
        catch (e) { console.warn('[v70] history pills:', e); }
        finally { mo.observe(section, { childList: true, subtree: true }); }
      });
    });
    mo.observe(section, { childList: true, subtree: true });
    refreshDepositChipAndPills();
  }

  /* ─────────────────────────────────────────────────────────────
     Boot
  ───────────────────────────────────────────────────────────── */
  function boot() {
    wrapSendToDisplayDebounce();
    injectCheckoutBannerStyle();
    watchCheckoutModal();
    patchHistoryLoad();
    watchHistoryPage();
  }

  function bootRepeat() {
    boot();
    setTimeout(boot, 800);
    setTimeout(boot, 2200);
    setTimeout(boot, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(bootRepeat, 600));
  } else {
    setTimeout(bootRepeat, 600);
  }
})();
