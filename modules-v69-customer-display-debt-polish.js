(function () {
  'use strict';

  console.log('[v69] customer-display + debt-billing polish loaded');

  const CUSTOMER_TABLE = 'customer';
  const BILL_TABLE = 'บิลขาย';

  const num = v => { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function activeCart() {
    try { if (Array.isArray(cart)) return cart; } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }

  function cartTotal() {
    try { if (typeof getCartTotal === 'function') return getCartTotal(); } catch (_) {}
    return activeCart().reduce((s, i) => s + num(i.price) * num(i.qty), 0);
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
    if (v12?.customer?.name) return { src: 'v12', c: v12.customer };
    const cs = getCheckoutState();
    if (cs?.customer?.name) return { src: 'checkoutState', c: cs.customer };
    return { src: '', c: null };
  }

  function sendDisplay(data) {
    try { if (typeof sendToDisplay === 'function') sendToDisplay(data); } catch (_) {}
  }

  function setGlobalFn(name, fn) {
    try { window[name] = fn; } catch (_) {}
    try { Function('n', 'f', 'window[n]=f;eval(n+"=f");')(name, fn); } catch (_) {}
  }

  /* ─────────────────────────────────────────────────────────────
     1) Robust customer-display sync (cart + customer)
  ───────────────────────────────────────────────────────────── */

  function customerTypeOf(c) {
    if (!c) return 'general';
    const t = String(c.type || '').toLowerCase();
    if (t === 'general') return 'general';
    if (t === 'new') return 'new';
    if (t === 'project') return 'member';
    return 'member';
  }

  function sendCustomerSnapshot() {
    const { c } = activeCustomer();
    if (!c) return;
    const name = String(c.name || '').trim();
    if (!name) return;
    sendDisplay({
      type: 'customer',
      name: name || 'ลูกค้าทั่วไป',
      customerType: customerTypeOf(c),
      phone: c.phone || '',
      address: c.address || '',
      debtAmount: num(c.debt_amount),
      customerKind: c.customer_type || '',
    });
  }

  function sendCustomerDraft() {
    const { c } = activeCustomer();
    sendDisplay({
      type: 'customer_draft',
      name: String(c?.name || '').trim(),
      phone: String(c?.phone || '').trim(),
      address: String(c?.address || '').trim(),
    });
  }

  function sendCartSnapshot() {
    sendDisplay({ type: 'cart', cart: activeCart(), total: cartTotal() });
  }

  function replayState() {
    sendCartSnapshot();
    sendCustomerSnapshot();
  }

  window.addEventListener('message', e => {
    const data = e?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'cd_request_state') replayState();
  });

  // Cart hash watchdog (700 ms) — catches paths that mutate cart directly.
  let lastCartHash = '';
  let lastCustHash = '';
  function cartHash() {
    const list = activeCart();
    let h = list.length + ':';
    for (const it of list) {
      h += (it?.id || '') + '|' + (it?.unit || '') + '|' + num(it?.qty) + '|' + num(it?.price) + ';';
    }
    return h + '#' + num(cartTotal()).toFixed(2);
  }
  function custHash() {
    const { c } = activeCustomer();
    if (!c) return '-';
    return [c.id || '', c.name || '', c.phone || '', c.address || '', c.type || '', num(c.debt_amount)].join('|');
  }
  setInterval(() => {
    try {
      const h = cartHash();
      if (h !== lastCartHash) { lastCartHash = h; sendCartSnapshot(); }
      const ch = custHash();
      if (ch !== lastCustHash) { lastCustHash = ch; sendCustomerSnapshot(); }
    } catch (_) {}
  }, 700);

  /* ─────────────────────────────────────────────────────────────
     2) Hook the REAL checkout flow used in this build (v12/v13).
        - v13PickCustomer(id,name,phone,address)
        - v13SaveNewCustomer (uses v12State.customer.*)
        - v13RenderCustForm — re-bind input listeners on each render
        - Also keep app.js' selectCustomer/createNewCustomer hooks
  ───────────────────────────────────────────────────────────── */

  async function hydrateFromDB(id, fallbackName) {
    if (typeof db === 'undefined') return null;
    try {
      let row = null;
      if (id) {
        const { data } = await db.from(CUSTOMER_TABLE)
          .select('id,name,phone,address,debt_amount,customer_type,credit_limit')
          .eq('id', id).maybeSingle();
        row = data || null;
      }
      if (!row && fallbackName) {
        const { data } = await db.from(CUSTOMER_TABLE)
          .select('id,name,phone,address,debt_amount,customer_type,credit_limit')
          .ilike('name', String(fallbackName).trim()).limit(2);
        if ((data || []).length === 1) row = data[0];
      }
      if (row && (!row.phone || !row.address)) {
        const tryCol = async (col, value) => {
          if (!value) return null;
          const { data } = await db.from(BILL_TABLE)
            .select('delivery_phone,delivery_address')
            .eq(col, value).order('date', { ascending: false }).limit(1);
          return Array.isArray(data) ? data[0] : data;
        };
        const fb = (row.id && await tryCol('customer_id', row.id))
          || await tryCol('customer_name', row.name);
        if (fb) {
          row.phone = row.phone || fb.delivery_phone || '';
          row.address = row.address || fb.delivery_address || '';
        }
      }
      return row;
    } catch (e) {
      console.warn('[v69] hydrateFromDB:', e);
      return null;
    }
  }

  async function fillCustomer(id, name, phone, address) {
    const v12 = getV12State();
    const cs = getCheckoutState();
    // Try DB enrichment if we have an id and any field is missing
    let enriched = null;
    if (id && (!phone || !address)) {
      enriched = await hydrateFromDB(id, name);
    }
    const finalPhone = phone || enriched?.phone || '';
    const finalAddress = address || enriched?.address || '';
    const debt = num(enriched?.debt_amount);

    if (v12?.customer) {
      v12.customer.id = id || v12.customer.id || null;
      v12.customer.name = name || v12.customer.name;
      v12.customer.phone = finalPhone;
      v12.customer.address = finalAddress;
      if (enriched) v12.customer.debt_amount = debt;
      // Mirror into delivery fields if cashier hasn't typed something else.
      if (finalPhone && !v12.deliveryPhone) v12.deliveryPhone = finalPhone;
      if (finalAddress && !v12.deliveryAddress) v12.deliveryAddress = finalAddress;
    }
    if (cs?.customer) {
      cs.customer.id = id || cs.customer.id || null;
      cs.customer.name = name || cs.customer.name;
      cs.customer.phone = finalPhone;
      cs.customer.address = finalAddress;
      if (enriched) cs.customer.debt_amount = debt;
    }
    sendCustomerSnapshot();
  }

  // Hook v13PickCustomer / v12PickCustomer (selects existing customer in member list)
  function patchPickCustomerVariants() {
    ['v13PickCustomer', 'v12PickCustomer'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__v69) return;
      const wrapped = function (id, n, phone, address) {
        const r = orig.apply(this, arguments);
        Promise.resolve().then(() => fillCustomer(id, n, phone, address)).catch(()=>{});
        return r;
      };
      Object.defineProperty(wrapped, '__v69', { value: true });
      setGlobalFn(name, wrapped);
    });
  }

  // Hook v13SaveNewCustomer / v12SaveNewCustomer (saves the new customer form)
  function patchSaveNewCustomerVariants() {
    ['v13SaveNewCustomer', 'v12SaveNewCustomer'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__v69) return;
      const wrapped = async function (...args) {
        const r = await orig.apply(this, args);
        const v12 = getV12State();
        const c = v12?.customer;
        if (c?.id) {
          await fillCustomer(c.id, c.name, c.phone, c.address);
        } else if (c?.name) {
          sendCustomerSnapshot();
        }
        return r;
      };
      Object.defineProperty(wrapped, '__v69', { value: true });
      setGlobalFn(name, wrapped);
    });
  }

  // Hook v13RenderCustForm — every render re-binds input listeners so typing
  // immediately propagates to v12State + customer display.
  function bindV13NewCustomerInputs() {
    const nameEl = document.getElementById('v13-new-name') || document.getElementById('v12-new-cust-name');
    const phoneEl = document.getElementById('v13-new-phone') || document.getElementById('v12-new-cust-phone');
    const addrEl = document.getElementById('v13-new-address') || document.getElementById('v12-new-cust-address');
    if (!nameEl && !phoneEl && !addrEl) return;
    const push = () => {
      const v12 = getV12State();
      if (v12?.customer) {
        if (nameEl) v12.customer.name = nameEl.value.trim();
        if (phoneEl) v12.customer.phone = phoneEl.value.trim();
        if (addrEl) v12.customer.address = addrEl.value.trim();
        v12.customer.type = v12.customer.type || 'new';
      }
      sendCustomerDraft();
      sendCustomerSnapshot();
    };
    [nameEl, phoneEl, addrEl].forEach(el => {
      if (!el || el.dataset.v69Bound === '1') return;
      el.dataset.v69Bound = '1';
      el.addEventListener('input', push);
      el.addEventListener('change', push);
    });
    push();
  }

  function patchRenderCustFormVariants() {
    ['v13RenderCustForm', 'v12RenderCustForm'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__v69) return;
      const wrapped = function (...args) {
        const r = orig.apply(this, args);
        setTimeout(bindV13NewCustomerInputs, 0);
        return r;
      };
      Object.defineProperty(wrapped, '__v69', { value: true });
      setGlobalFn(name, wrapped);
    });
  }

  // Hook v13SelectCustType / v12SelectCustType: clear customer for 'general'.
  function patchSelectCustTypeVariants() {
    ['v13SelectCustType', 'v12SelectCustType'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__v69) return;
      const wrapped = function (type) {
        const r = orig.apply(this, arguments);
        setTimeout(() => {
          if (type === 'general') {
            sendDisplay({ type: 'customer', name: 'ลูกค้าทั่วไป', customerType: 'general', phone: '', address: '' });
          } else if (type === 'new') {
            bindV13NewCustomerInputs();
            sendCustomerDraft();
          }
        }, 30);
        return r;
      };
      Object.defineProperty(wrapped, '__v69', { value: true });
      setGlobalFn(name, wrapped);
    });
  }

  // Step transitions: replay state so display catches up.
  function patchStepNav() {
    ['nextCheckoutStep', 'v12NextStep', 'v12Goto', 'v13NextStep'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__v69) return;
      const wrapped = function (...args) {
        const r = orig.apply(this, args);
        setTimeout(replayState, 40);
        return r;
      };
      Object.defineProperty(wrapped, '__v69', { value: true });
      setGlobalFn(name, wrapped);
    });
  }

  // Also keep the original app.js selectCustomer/createNewCustomer wrappers
  function patchAppCustomerFns() {
    const sel = window.selectCustomer;
    if (typeof sel === 'function' && !sel.__v69) {
      const wrapped = function (id, name) {
        const r = sel.apply(this, arguments);
        Promise.resolve().then(() => fillCustomer(id, name, '', '')).catch(()=>{});
        return r;
      };
      Object.defineProperty(wrapped, '__v69', { value: true });
      setGlobalFn('selectCustomer', wrapped);
    }
    const create = window.createNewCustomer;
    if (typeof create === 'function' && !create.__v69) {
      const wrapped = async function () {
        const r = await create.apply(this, arguments);
        const cs = getCheckoutState();
        if (cs?.customer?.id) await fillCustomer(cs.customer.id, cs.customer.name, '', '');
        return r;
      };
      Object.defineProperty(wrapped, '__v69', { value: true });
      setGlobalFn('createNewCustomer', wrapped);
    }
  }

  function rebindAll() {
    patchPickCustomerVariants();
    patchSaveNewCustomerVariants();
    patchRenderCustFormVariants();
    patchSelectCustTypeVariants();
    patchStepNav();
    patchAppCustomerFns();
    bindV13NewCustomerInputs();
  }

  // Re-bind on DOM mutations (the v13 form is re-rendered on type switch)
  function startDomObserver() {
    const body = document.body;
    if (!body) return;
    const mo = new MutationObserver(() => {
      try { bindV13NewCustomerInputs(); } catch (_) {}
    });
    mo.observe(body, { childList: true, subtree: true });
  }

  /* ─────────────────────────────────────────────────────────────
     3) Defensive: wrap bill-loader-named functions to resync cart
  ───────────────────────────────────────────────────────────── */
  function wrapBillLoaders() {
    const PATTERNS = [
      /loadBill/i, /fromBill/i, /reuseBill/i, /cloneBill/i, /copyBill/i,
      /importBill/i, /repeatBill/i, /restoreBill/i, /reloadBill/i,
      /pullBill/i, /resumeCart/i, /restoreCart/i, /openPendingBill/i,
    ];
    Object.keys(window).forEach(key => {
      try {
        if (typeof window[key] !== 'function') return;
        if (!PATTERNS.some(p => p.test(key))) return;
        if (window[key].__v69CartSync) return;
        const original = window[key];
        const wrapped = function (...args) {
          const result = original.apply(this, args);
          const sync = () => { setTimeout(sendCartSnapshot, 0); setTimeout(sendCartSnapshot, 350); };
          if (result && typeof result.then === 'function') {
            return result.then(v => { sync(); return v; }).catch(err => { sync(); throw err; });
          }
          sync();
          return result;
        };
        Object.defineProperty(wrapped, '__v69CartSync', { value: true });
        try { window[key] = wrapped; } catch (_) {}
      } catch (_) {}
    });
  }

  /* ─────────────────────────────────────────────────────────────
     4) "Smart ใบวางบิล" button on debt page
  ───────────────────────────────────────────────────────────── */
  function injectDebtBillingStyle() {
    if (document.getElementById('v69-debt-billing-style')) return;
    const s = document.createElement('style');
    s.id = 'v69-debt-billing-style';
    s.textContent = `
      .v69-billing-btn{background:#fff;color:#dc2626;border:1.5px solid #fecaca;padding:8px 14px;border-radius:8px;font-weight:900;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .15s ease;font-family:inherit;font-size:13px;box-shadow:0 1px 2px rgba(220,38,38,.08)}
      .v69-billing-btn:hover{background:#fef2f2;border-color:#fca5a5;transform:translateY(-1px);box-shadow:0 6px 14px rgba(220,38,38,.18)}
      .v69-billing-btn i{font-size:18px}
      .v69-billing-tip{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#fff7ed,#fef2f2);border:1px solid #fed7aa;color:#9a3412;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:900;margin-left:8px}
    `;
    document.head.appendChild(s);
  }
  function patchDebtPageButtons() {
    injectDebtBillingStyle();
    const section = document.getElementById('page-debt');
    if (!section || section.dataset.v69Bound === '1') return;
    section.dataset.v69Bound = '1';
    const inject = () => {
      const rows = section.querySelectorAll('.debt-table tbody tr');
      rows.forEach(tr => {
        const actions = tr.querySelector('.debt-actions');
        if (!actions || actions.dataset.v69Billing === '1') return;
        const payBtn = actions.querySelector('.btn-pay');
        if (!payBtn) return;
        const onclick = payBtn.getAttribute('onclick') || '';
        const m = onclick.match(/recordDebtPayment\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/);
        if (!m) return;
        const cid = m[1];
        const cname = m[2];
        const printBtn = document.createElement('button');
        printBtn.className = 'v69-billing-btn';
        printBtn.title = 'พิมพ์ใบวางบิล (รวมทุกบิลค้างของลูกค้านี้)';
        printBtn.innerHTML = '<i class="material-icons-round">receipt_long</i><span>ใบวางบิล</span>';
        printBtn.onclick = () => {
          if (typeof window.v24PrintBillingNote === 'function') {
            window.v24PrintBillingNote(cid, cname.replace(/\\'/g, "'"));
          } else {
            (window.toast || (() => {}))('ยังไม่พบโมดูลพิมพ์ใบวางบิล', 'warning');
          }
        };
        actions.insertBefore(printBtn, payBtn);
        actions.dataset.v69Billing = '1';
      });
      const hero = section.querySelector('.debt-hero-left p');
      if (hero && !hero.querySelector('.v69-billing-tip')) {
        hero.insertAdjacentHTML('beforeend',
          ' <span class="v69-billing-tip"><i class="material-icons-round" style="font-size:14px">receipt_long</i> มีปุ่ม “ใบวางบิล” ในทุกแถวลูกค้าค้างชำระแล้ว</span>');
      }
    };
    inject();
    new MutationObserver(inject).observe(section, { childList: true, subtree: true });
  }
  function watchDebtPage() {
    const tryBind = () => {
      const section = document.getElementById('page-debt');
      if (section) patchDebtPageButtons();
    };
    tryBind();
    const orig = window.showPage;
    if (typeof orig === 'function' && !orig.__v69DebtBound) {
      const wrapped = function (page) {
        const r = orig.apply(this, arguments);
        if (page === 'debt' || page === 'customer') setTimeout(tryBind, 30);
        if (page === 'customer') setTimeout(refreshCustomerPage, 60);
        return r;
      };
      Object.defineProperty(wrapped, '__v69DebtBound', { value: true });
      setGlobalFn('showPage', wrapped);
    }
    const origRender = window.v68RenderDebts || window.renderDebts;
    if (typeof origRender === 'function' && !origRender.__v69Bound) {
      const wrapped = async function (...args) {
        const r = await origRender.apply(this, args);
        setTimeout(tryBind, 30);
        return r;
      };
      Object.defineProperty(wrapped, '__v69Bound', { value: true });
      setGlobalFn('v68RenderDebts', wrapped);
      setGlobalFn('renderDebts', wrapped);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     5) Customer page totals — force fresh sync each visit
  ───────────────────────────────────────────────────────────── */
  function refreshCustomerPage() {
    if (typeof window.v68SyncCustomerTotals === 'function') {
      window.v68SyncCustomerTotals(true)
        .then(() => {
          if (typeof window.loadCustomerData === 'function') {
            try { window.loadCustomerData(); } catch (_) {}
          }
        })
        .catch(err => console.warn('[v69] force sync:', err));
    }
  }
  function patchCustomerPageLoad() {
    const orig = window.loadCustomerData;
    if (typeof orig !== 'function' || orig.__v69) return;
    const wrapped = async function (...args) {
      // Force fresh sync (v68's wrapper uses force=false which can serve 15 s stale data)
      try {
        if (typeof window.v68SyncCustomerTotals === 'function') {
          await window.v68SyncCustomerTotals(true);
        }
      } catch (_) {}
      return orig.apply(this, args);
    };
    Object.defineProperty(wrapped, '__v69', { value: true });
    setGlobalFn('loadCustomerData', wrapped);
  }

  /* ─────────────────────────────────────────────────────────────
     Boot
  ───────────────────────────────────────────────────────────── */
  function boot() {
    rebindAll();
    wrapBillLoaders();
    watchDebtPage();
    patchCustomerPageLoad();
    startDomObserver();
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
