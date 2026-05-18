(function () {
  'use strict';

  console.log('[v71] checkout banner + 6-col stats + customer contact stickiness');

  // Claim ownership of the deposit chip immediately so v70 doesn't fight us
  // even before v71 finishes its delayed boot.
  window.__v71OwnsDepositChip = true;

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
     1) STICKY customer phone/address — wrap sendToDisplay so EVERY
        outbound { type:'customer' } message picks up the latest
        phone+address from v12State, even if the caller (v24-display.js
        polling) forgot to include them.
  ───────────────────────────────────────────────────────────── */
  function wrapSendCustomerEnricher() {
    const orig = window.sendToDisplay;
    if (typeof orig !== 'function' || orig.__v71Enrich) return;
    const wrapped = function (data) {
      try {
        if (data && data.type === 'customer') {
          const c = activeCustomer();
          if (c) {
            // Treat the cashier-typed value as truth when caller omitted fields.
            if (!('phone' in data) || !data.phone) data.phone = c.phone || '';
            if (!('address' in data) || !data.address) data.address = c.address || '';
            if (!data.customerType && c.type) {
              data.customerType = c.type === 'general' ? 'general'
                : c.type === 'new' ? 'new'
                : c.type === 'project' ? 'member' : 'member';
            }
            if (data.debtAmount == null) data.debtAmount = num(c.debt_amount);
            if (!data.customerKind && c.customer_type) data.customerKind = c.customer_type;
          }
        }
      } catch (_) {}
      return orig(data);
    };
    Object.defineProperty(wrapped, '__v71Enrich', { value: true });
    setGlobalFn('sendToDisplay', wrapped);
  }

  /* ─────────────────────────────────────────────────────────────
     2) Customer banner on the checkout popup (cashier-facing).
        Inserted as the first child of `.checkout-content` with
        position:sticky so it stays pinned to the top regardless of
        which step is being rendered.
  ───────────────────────────────────────────────────────────── */
  function injectBannerStyle() {
    if (document.getElementById('v71-banner-style')) return;
    const s = document.createElement('style');
    s.id = 'v71-banner-style';
    s.textContent = `
      .checkout-content > .v71-cust-banner{
        position:sticky;top:-10px;z-index:30;
        margin:-34px -38px 20px;padding:14px 26px;
        background:linear-gradient(135deg,#ecfdf5 0%,#f0fdfa 60%,#f0f9ff 100%);
        border-bottom:2px solid #99f6e4;
        display:flex;align-items:center;gap:16px;
        box-shadow:0 12px 24px rgba(15,23,42,.06);
        animation:v71-bn-in .3s cubic-bezier(.34,1.56,.64,1);
      }
      @keyframes v71-bn-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
      .v71-cust-banner.empty{background:linear-gradient(135deg,#fff7ed 0%,#fffbeb 100%);border-bottom-color:#fcd34d}
      .v71-cust-banner.draft{background:linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%);border-bottom-color:#93c5fd}
      .v71-cust-banner.project{background:linear-gradient(135deg,#eef2ff 0%,#ede9fe 100%);border-bottom-color:#a5b4fc}
      .v71-cb-ic{width:50px;height:50px;border-radius:14px;background:#10b981;color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 8px 22px rgba(16,185,129,.30)}
      .v71-cust-banner.empty .v71-cb-ic{background:#f59e0b;box-shadow:0 8px 22px rgba(245,158,11,.30)}
      .v71-cust-banner.draft .v71-cb-ic{background:#2563eb;box-shadow:0 8px 22px rgba(37,99,235,.30)}
      .v71-cust-banner.project .v71-cb-ic{background:#6366f1;box-shadow:0 8px 22px rgba(99,102,241,.30)}
      .v71-cb-ic i{font-size:26px}
      .v71-cb-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
      .v71-cb-label{font-size:11px;font-weight:900;color:#047857;text-transform:uppercase;letter-spacing:.7px;line-height:1}
      .v71-cust-banner.empty .v71-cb-label{color:#b45309}
      .v71-cust-banner.draft .v71-cb-label{color:#1d4ed8}
      .v71-cust-banner.project .v71-cb-label{color:#4f46e5}
      .v71-cb-name{font-size:24px;font-weight:950;color:#0f172a;line-height:1.15;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.3px}
      .v71-cb-sub{font-size:12px;font-weight:850;color:#475569;margin-top:4px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px}
      .v71-cb-sub span{display:inline-flex;align-items:center;gap:4px}
      .v71-cb-sub i{font-size:14px;color:#64748b}
      .v71-cb-tag{font-size:11px;font-weight:900;background:rgba(16,185,129,.14);color:#047857;padding:5px 12px;border-radius:999px;border:1px solid rgba(16,185,129,.28);white-space:nowrap}
      .v71-cust-banner.empty .v71-cb-tag{background:rgba(245,158,11,.14);color:#b45309;border-color:rgba(245,158,11,.28)}
      .v71-cust-banner.draft .v71-cb-tag{background:rgba(37,99,235,.14);color:#1d4ed8;border-color:rgba(37,99,235,.28)}
      .v71-cust-banner.project .v71-cb-tag{background:rgba(99,102,241,.14);color:#4f46e5;border-color:rgba(99,102,241,.28)}
      .v71-cb-debt{font-size:11px;font-weight:900;background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:999px;border:1px solid #fecaca}
      .v71-cb-side{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
    `;
    document.head.appendChild(s);
  }

  function bannerCls(c) {
    const t = String(c?.type || '').toLowerCase();
    if (t === 'general') return { tag: 'ลูกค้าทั่วไป', cls: 'empty', icon: 'shopping_bag', label: 'ลูกค้าทั่วไป — ไม่ระบุข้อมูล' };
    if (t === 'new')     return { tag: 'ลูกค้าใหม่',    cls: 'draft', icon: 'person_add', label: 'กำลังบันทึกลูกค้าใหม่' };
    if (t === 'project') return { tag: 'โครงการของร้าน', cls: 'project', icon: 'business_center', label: 'บิลโครงการ — บังคับค้างเครดิต' };
    return { tag: 'ลูกค้าประจำ', cls: '', icon: 'badge', label: 'ลูกค้าที่เลือก' };
  }

  function renderBanner() {
    const overlay = document.getElementById('checkout-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    const content = document.getElementById('checkout-content') || overlay.querySelector('.checkout-content');
    if (!content) return;
    injectBannerStyle();
    let banner = content.querySelector(':scope > .v71-cust-banner');
    const c = activeCustomer();
    const has = !!(c?.name && String(c.name).trim());
    const meta = bannerCls(c);
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'v71-cust-banner';
      content.prepend(banner);
    } else if (content.firstElementChild !== banner) {
      content.prepend(banner);
    }
    banner.className = 'v71-cust-banner ' + (has ? meta.cls : 'empty');
    const projectName = c?.project_name ? `[โครงการ] ${c.project_name}` : '';
    const showName = has ? (projectName || c.name) : 'ยังไม่ได้เลือกลูกค้า';
    const phone = c?.phone || '';
    const address = c?.address || '';
    const debt = num(c?.debt_amount);
    banner.innerHTML = `
      <div class="v71-cb-ic"><i class="material-icons-round">${has ? meta.icon : 'help_outline'}</i></div>
      <div class="v71-cb-body">
        <div class="v71-cb-label">${esc(has ? meta.label : 'ยังไม่ได้เลือกลูกค้า')}</div>
        <div class="v71-cb-name">${esc(showName)}</div>
        ${has ? `<div class="v71-cb-sub">
          ${phone ? `<span><i class="material-icons-round">call</i>${esc(phone)}</span>` : '<span style="color:#94a3b8"><i class="material-icons-round">call</i>ไม่มีเบอร์</span>'}
          ${address ? `<span><i class="material-icons-round">location_on</i>${esc(address).slice(0,90)}${address.length>90?'…':''}</span>` : '<span style="color:#94a3b8"><i class="material-icons-round">location_on</i>ไม่มีที่อยู่</span>'}
        </div>` : '<div class="v71-cb-sub"><span style="color:#92400e">กดเลือกประเภทลูกค้าด้านล่าง</span></div>'}
      </div>
      <div class="v71-cb-side">
        <span class="v71-cb-tag">${esc(meta.tag)}</span>
        ${has && debt > 0 ? `<span class="v71-cb-debt">หนี้ ฿${fmt(debt)}</span>` : ''}
      </div>
    `;
  }

  function watchCheckoutBanner() {
    const overlay = document.getElementById('checkout-overlay');
    if (!overlay) { setTimeout(watchCheckoutBanner, 400); return; }
    new MutationObserver(() => {
      if (!overlay.classList.contains('hidden')) renderBanner();
    }).observe(overlay, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setInterval(() => {
      if (!overlay.classList.contains('hidden')) renderBanner();
    }, 500);
    renderBanner();
  }

  /* ─────────────────────────────────────────────────────────────
     3) Force history stats into ONE row (6 columns, tight)
        + fix deposit/delivery logic so paid bills aren't tagged.
  ───────────────────────────────────────────────────────────── */
  function injectStatsStyle() {
    if (document.getElementById('v71-stats-style')) return;
    const s = document.createElement('style');
    s.id = 'v71-stats-style';
    s.textContent = `
      #history-stats.v39-stats{
        display:grid!important;
        grid-template-columns:repeat(5,minmax(0,1fr))!important;
        gap:12px!important;
      }
      #history-stats .v39-stat{
        padding:16px!important;min-height:82px!important;
        gap:12px!important;min-width:0!important;
      }
      #history-stats .v39-stat b{font-size:20px!important;white-space:nowrap}
      #history-stats .v39-stat span{font-size:12px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #history-stats .v39-stat .dot{width:40px!important;height:40px!important;flex-shrink:0}
      #history-stats .v39-stat .dot i{font-size:20px}
      @media(max-width:1100px){
        #history-stats.v39-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      }
      @media(max-width:680px){
        #history-stats.v39-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }

      /* Status cell — vertical stack, tight, left-aligned. Keeps the row
         from sprawling and avoids duplicating info already shown in the
         delivery column (e.g. "รอจัดส่ง"). */
      .v71-status-combo{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:4px!important;line-height:1.1;max-width:200px}
      .v71-status-combo > *{margin:0}
      .v71-status-combo .v39-pill{padding:4px 10px!important;font-size:12px!important;font-weight:900!important;border-radius:999px!important}
      .v71-pill-deposit{display:inline-flex;align-items:center;gap:4px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:900;white-space:nowrap}
      .v71-pill-deposit i{font-size:12px}
      /* Render any "ยังไม่ผูกลูกค้า" sibling under the combo as small muted text */
      .v71-status-combo + .v39-sub,
      .v71-status-combo ~ div[style*="d97706"]{font-size:10.5px!important;font-weight:800!important;margin-top:2px!important}
    `;
    document.head.appendChild(s);
  }

  function deliveryPending(b) {
    const s = String(b?.delivery_status || '');
    // Only "still pending" matters — exclude success / done.
    if (!s) return false;
    if (/สำเร็จ|เสร็จ|done/i.test(s)) return false;
    return /รอ/.test(s);
  }
  function depositOutstanding(b) {
    const dep = num(b?.deposit_amount);
    const total = num(b?.total);
    if (dep <= 0) return false;
    // Outstanding deposit = deposit is partial. Fully-deposit-paid bills
    // (dep ≥ total) are considered fully paid and should show "สำเร็จ" only.
    return dep < total - 0.009;
  }
  function isProjectBillV71(b) {
    if (!b) return false;
    if (b.project_id) return true;
    const text = `${b.customer_name || ''} ${b.method || ''} ${b.status || ''} ${b.note || ''}`;
    return /\[โครงการ\]|เบิกของโครงการ|จ่ายของให้โครงการ|ต้นทุนโครงการ|project/i.test(text);
  }

  function isDepositOpenBill(b) {
    // Counted into the "ใบติดมัดจำ" chip when there's deposit + remaining
    // payment OR deposit + still pending delivery. Project bills excluded.
    if (isProjectBillV71(b)) return false;
    if (/ยกเลิก|คืน/.test(String(b?.status || ''))) return false;
    return depositOutstanding(b) || (num(b?.deposit_amount) > 0 && deliveryPending(b) && /ค้าง|บางส่วน/.test(String(b?.status || '')));
  }

  async function fetchHistoryBills() {
    try {
      const search = (document.getElementById('history-search')?.value || '').toLowerCase();
      const depositOn = window.v68HistoryFilter === 'depositPending';
      const date = document.getElementById('history-date')?.value || appLocalDateKey();
      let q = db.from('บิลขาย').select('*').order('date', { ascending: false });
      // When deposit filter is active, ignore the date picker so the user
      // sees every outstanding-deposit bill, not just today's.
      if (search || depositOn) q = q.range(0, 4999);
      else q = q.gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59');
      const { data } = await q;
      return data || [];
    } catch (e) { return []; }
  }

  function patchDepositChip() {
    const stats = document.getElementById('history-stats');
    if (!stats) return;
    const all = stats.querySelectorAll('.v70-stat-deposit, .v71-stat-deposit');
    if (all.length <= 1) return;
    // Keep first, remove duplicates (race between v70 and v71 creating chips)
    for (let i = 1; i < all.length; i++) all[i].remove();
  }

  function patchHistoryRowPills() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    const cache = window.__v70BillCache || window.__v71BillCache;
    if (!cache || !cache.size) return;
    tbody.querySelectorAll('tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length < 7) return;
      const statusCell = cells[6];

      const actBtn = tr.querySelector('button[onclick*="viewBillDetail"]');
      const m = actBtn?.getAttribute('onclick')?.match(/viewBillDetail\('([^']+)'\)/);
      const billId = m ? m[1] : '';
      if (!billId) return;
      const bill = cache.get?.(billId);
      if (!bill) return;

      // Hash desired state so we skip work when nothing changed.
      // (We no longer add a "รอจัดส่ง" pill here — that info is already
      // shown in the delivery column to the left; duplicating it just
      // made the row look noisy.)
      const wantsDeposit = depositOutstanding(bill);
      const hash = `${billId}|${wantsDeposit ? num(bill.deposit_amount).toFixed(2) : 0}`;
      const staleV70 = statusCell.querySelector('.v70-pill-deposit, .v70-pill-pending');
      const stalePending = statusCell.querySelector('.v71-pill-pending');
      if (tr.dataset.v71Hash === hash && !staleV70 && !stalePending) return;

      let comboWrap = statusCell.querySelector('.v70-status-combo, .v71-status-combo');
      let statusPill = comboWrap ? comboWrap.querySelector('.v39-pill.v39-status') : statusCell.querySelector('.v39-pill.v39-status');
      if (!statusPill) return;

      if (!comboWrap) {
        comboWrap = document.createElement('div');
        comboWrap.className = 'v71-status-combo';
        statusPill.replaceWith(comboWrap);
        comboWrap.appendChild(statusPill);
      } else {
        comboWrap.className = 'v71-status-combo';
        // Clean ALL old deposit / pending pills (from v70 and v71 alike)
        comboWrap.querySelectorAll('.v70-pill-deposit, .v70-pill-pending, .v71-pill-deposit, .v71-pill-pending').forEach(e => e.remove());
      }
      if (wantsDeposit) {
        const span = document.createElement('span');
        span.className = 'v71-pill-deposit';
        span.innerHTML = `<i class="material-icons-round">savings</i>มัดจำ ฿${fmt(bill.deposit_amount)}`;
        comboWrap.appendChild(span);
      }
      tr.dataset.v71Hash = hash;
      tr.dataset.v70Combo = '1';
      tr.dataset.v71Combo = '1';
    });
  }

  function patchTotalsCellDepositInfo() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    const cache = window.__v70BillCache || window.__v71BillCache;
    if (!cache) return;
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.dataset.v71TotalDone === '1') return;
      const cells = tr.querySelectorAll('td');
      if (cells.length < 6) return;
      const totalCell = cells[5];
      const actBtn = tr.querySelector('button[onclick*="viewBillDetail"]');
      const m = actBtn?.getAttribute('onclick')?.match(/viewBillDetail\('([^']+)'\)/);
      const billId = m ? m[1] : '';
      const bill = cache.get?.(billId);
      if (!bill) return;
      tr.dataset.v71TotalDone = '1';
      const dep = num(bill.deposit_amount);
      if (!dep) return;
      const fullyPaid = dep >= num(bill.total) - 0.009;
      if (!fullyPaid) return;
      totalCell.querySelectorAll('.v39-discount').forEach(el => {
        if (/มัดจำ/.test(el.textContent || '')) el.remove();
      });
    });
  }

  async function refreshHistoryDecorations() {
    injectStatsStyle();
    const bills = await fetchHistoryBills();
    window.__v71BillCache = new Map();
    bills.forEach(b => window.__v71BillCache.set(b.id, b));
    window.__v70BillCache = window.__v71BillCache;

    // Clear row caches so freshly fetched data is reapplied.
    const tbody = document.getElementById('history-tbody');
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(tr => {
        delete tr.dataset.v71Hash;
        delete tr.dataset.v71TotalDone;
      });
    }

    // Deposit stat chip removed by user request — only the per-row "มัดจำ"
    // sub-pill remains (rendered by patchHistoryRowPills below). This keeps
    // the stats grid at its original symmetric 5-column layout.
    const stats = document.getElementById('history-stats');
    if (stats) {
      stats.querySelectorAll('.v70-stat-deposit, .v71-stat-deposit').forEach(el => el.remove());
    }
    // If the legacy depositPending filter is still set, clear it so the
    // user isn't trapped in an invisible filter after the chip is removed.
    if (window.v68HistoryFilter === 'depositPending') {
      window.v68HistoryFilter = 'all';
    }
    patchHistoryRowPills();
    patchTotalsCellDepositInfo();
  }

  function patchHistoryLoad() {
    const orig = window.v39LoadHistoryData || window.loadHistoryData;
    if (typeof orig !== 'function' || orig.__v71) return;
    const wrapped = async function (...args) {
      const r = await orig.apply(this, args);
      setTimeout(refreshHistoryDecorations, 60);
      setTimeout(refreshHistoryDecorations, 350);
      return r;
    };
    Object.defineProperty(wrapped, '__v71', { value: true });
    setGlobalFn('v39LoadHistoryData', wrapped);
    setGlobalFn('loadHistoryData', wrapped);
  }

  function watchHistoryPage() {
    patchHistoryLoad();
    const section = document.getElementById('page-history') || document.getElementById('page-sale-history');
    if (!section) { setTimeout(watchHistoryPage, 800); return; }
    if (section.dataset.v71Watching === '1') return;
    section.dataset.v71Watching = '1';
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        observer.disconnect();
        try {
          patchDepositChip();
          patchHistoryRowPills();
          patchTotalsCellDepositInfo();
        } catch (e) {
          console.warn('[v71] history decorate:', e);
        } finally {
          observer.observe(section, { childList: true, subtree: true });
        }
      });
    });
    observer.observe(section, { childList: true, subtree: true });
    injectStatsStyle();
    refreshHistoryDecorations();
  }

  /* ─────────────────────────────────────────────────────────────
     Boot
  ───────────────────────────────────────────────────────────── */
  function boot() {
    // Tell v70 to stop overwriting the deposit chip contents (v71's logic
    // is stricter — bills with deposit==total stay out of the count).
    window.__v71OwnsDepositChip = true;
    wrapSendCustomerEnricher();
    injectStatsStyle();
    injectBannerStyle();
    watchCheckoutBanner();
    watchHistoryPage();
  }
  function bootRepeat() {
    boot();
    setTimeout(boot, 800);
    setTimeout(boot, 2400);
    setTimeout(boot, 5000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(bootRepeat, 600));
  } else {
    setTimeout(bootRepeat, 600);
  }
})();
