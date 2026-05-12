/**
 * SK POS — v73: link ALL orphan bills (not just debt bills) by customer_name.
 * ════════════════════════════════════════════════════════════════════════════
 * Why this exists:
 *   The customer page shows `customer.total_purchase` which is computed by
 *   v68's syncAllCustomers. v68 requires `bill.customer_id` to be set — so
 *   ANY bill where the cashier forgot to pick the customer (but typed the
 *   name correctly in customer_name) is invisible to the totals.
 *
 *   v68 already has linkOrphanDebtBills, but it only handles bills that look
 *   like debt candidates. Regular paid bills with a typed name don't get
 *   linked → they never count toward total_purchase or visit_count.
 *
 * What v73 does:
 *   1. Scans non-cancelled bills with customer_id IS NULL and a non-generic
 *      customer_name. For each, finds an exact-name customer match (case &
 *      whitespace normalized).
 *   2. Updates bill.customer_id (and fills in delivery_phone if empty) when
 *      the name maps to EXACTLY ONE customer — never auto-links on ambiguity.
 *   3. Invalidates v68's sync cache and re-renders the customer page.
 *
 * Safety:
 *   - Skips bills with status ยกเลิก / คืนสินค้า / โครงการ.
 *   - Refuses to link when the name maps to more than one customer.
 *   - Skips generic names like "ลูกค้าทั่วไป" / "general".
 *   - Runs at most once per page-load + on-demand via the sync button.
 *   - All updates wrapped in try/catch; failures are logged not thrown.
 */
(function () {
  'use strict';

  if (typeof db === 'undefined') {
    console.warn('[v73] db not ready — skipping orphan link');
    return;
  }

  const CUSTOMER_TABLE = 'customer';
  const BILL_TABLE = 'บิลขาย';
  const tag = '[v73]';

  const norm = v => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const isGeneric = n => !n || /ทั่วไป|general|ไม่ระบุ|^-+$/i.test(n);
  const isTerminal = s => /ยกเลิก|คืนสินค้า/.test(String(s || ''));

  let linkingPromise = null;
  let lastRunAt = 0;
  const MIN_INTERVAL_MS = 60_000; // don't re-run more than once a minute

  async function linkAllOrphanBills(force) {
    if (!force && Date.now() - lastRunAt < MIN_INTERVAL_MS) return { skipped: true };
    if (linkingPromise) return linkingPromise;
    linkingPromise = (async () => {
      try {
        const [{ data: customers, error: cErr }, { data: bills, error: bErr }] = await Promise.all([
          db.from(CUSTOMER_TABLE).select('id,name,phone').limit(10000),
          db.from(BILL_TABLE)
            .select('id,customer_id,customer_name,delivery_phone,status,method,project_id')
            .is('customer_id', null)
            .limit(10000),
        ]);
        if (cErr) throw cErr;
        if (bErr) throw bErr;

        // Build name → customers index
        const byName = new Map();
        (customers || []).forEach(c => {
          const k = norm(c.name);
          if (!k) return;
          if (!byName.has(k)) byName.set(k, []);
          byName.get(k).push(c);
        });

        let linked = 0;
        const skipped = { generic: 0, ambiguous: 0, terminal: 0, project: 0, nomatch: 0 };
        for (const bill of (bills || [])) {
          if (isTerminal(bill.status)) { skipped.terminal++; continue; }
          if (bill.project_id || /โครงการ/.test(String(bill.method || ''))) { skipped.project++; continue; }
          const name = bill.customer_name;
          if (isGeneric(name)) { skipped.generic++; continue; }
          const matches = byName.get(norm(name)) || [];
          if (matches.length === 0) { skipped.nomatch++; continue; }
          if (matches.length > 1) { skipped.ambiguous++; continue; }
          const c = matches[0];
          try {
            await db.from(BILL_TABLE).update({
              customer_id: c.id,
              delivery_phone: bill.delivery_phone || c.phone || null,
            }).eq('id', bill.id);
            linked++;
          } catch (e) {
            console.warn(tag, 'link bill failed:', bill.id, e);
          }
        }

        lastRunAt = Date.now();
        console.info(tag, `orphan-link done: linked=${linked}`, skipped);

        if (linked > 0 && typeof window.v68SyncCustomerTotals === 'function') {
          try { await window.v68SyncCustomerTotals(true); } catch (_) {}
        }
        return { linked, skipped };
      } catch (e) {
        console.warn(tag, 'orphan link error:', e);
        return { error: e.message };
      } finally {
        linkingPromise = null;
      }
    })();
    return linkingPromise;
  }

  // Expose for manual / programmatic use
  window.v73LinkOrphanBills = linkAllOrphanBills;

  /* ─────────────────────────────────────────────────────────────
     Wrap loadCustomerData so visiting the customer page auto-links
     (rate-limited to once per minute) before fetching display data.
  ───────────────────────────────────────────────────────────── */
  function patchLoadCustomerData() {
    const orig = window.loadCustomerData;
    if (typeof orig !== 'function' || orig.__v73OrphanLink) return;
    const wrapped = async function (...args) {
      // Fire orphan-link in the background; the displayed totals will get
      // updated by the v68 sync chain v73 triggers on success.
      linkAllOrphanBills(false).catch(() => {});
      return orig.apply(this, args);
    };
    Object.defineProperty(wrapped, '__v73OrphanLink', { value: true });
    try { window.loadCustomerData = wrapped; } catch (_) {}
  }

  /* ─────────────────────────────────────────────────────────────
     Add a "ผูกบิลที่หายไป" button on the customer page header.
     Runs the linker on-demand and re-renders the page.
  ───────────────────────────────────────────────────────────── */
  function injectStyle() {
    if (document.getElementById('v73-style')) return;
    const s = document.createElement('style');
    s.id = 'v73-style';
    s.textContent = `
      .v73-link-btn{background:#fff;color:#2563eb;border:1.5px solid #bfdbfe;padding:8px 14px;border-radius:8px;font-weight:900;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .15s ease;font-family:inherit;font-size:13px;box-shadow:0 1px 2px rgba(37,99,235,.08)}
      .v73-link-btn:hover{background:#eff6ff;border-color:#93c5fd;transform:translateY(-1px);box-shadow:0 6px 14px rgba(37,99,235,.18)}
      .v73-link-btn i{font-size:18px}
      .v73-link-btn[disabled]{opacity:.55;cursor:wait}
    `;
    document.head.appendChild(s);
  }

  function bindHeaderButton() {
    injectStyle();
    const section = document.getElementById('page-customer');
    if (!section) return;
    // Find a sensible insertion spot: the hero header area with "เพิ่มลูกค้า" button.
    const addBtn = section.querySelector('button[onclick*="showAddCustomerModal"]');
    if (!addBtn || addBtn.parentElement.querySelector('.v73-link-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'v73-link-btn';
    btn.title = 'รวมบิลเก่าที่ไม่ได้เลือกลูกค้า แต่ชื่อตรงกับลูกค้าประจำ ให้รวมเข้ายอดของลูกค้า';
    btn.innerHTML = '<i class="material-icons-round">link</i>ผูกบิลที่ตกหล่น';
    btn.onclick = async () => {
      btn.disabled = true;
      btn.innerHTML = '<i class="material-icons-round">sync</i>กำลังตรวจสอบ...';
      try {
        const r = await linkAllOrphanBills(true);
        if (r?.error) {
          (window.toast || (() => {}))('ผูกไม่สำเร็จ: ' + r.error, 'error');
        } else if (r?.linked > 0) {
          (window.toast || (() => {}))(`ผูกบิลตกหล่นเข้าลูกค้า ${r.linked} ใบ`, 'success');
        } else {
          (window.toast || (() => {}))('ไม่พบบิลที่ผูกได้เพิ่ม', 'info');
        }
        if (typeof window.loadCustomerData === 'function') await window.loadCustomerData();
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="material-icons-round">link</i>ผูกบิลที่ตกหล่น';
      }
    };
    addBtn.insertAdjacentElement('beforebegin', btn);
  }

  function watchCustomerPage() {
    bindHeaderButton();
    const section = document.getElementById('page-customer');
    if (!section) { setTimeout(watchCustomerPage, 800); return; }
    if (section.dataset.v73Watching === '1') return;
    section.dataset.v73Watching = '1';
    new MutationObserver(() => bindHeaderButton())
      .observe(section, { childList: true, subtree: true });
  }

  function boot() {
    patchLoadCustomerData();
    watchCustomerPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 800));
  } else {
    setTimeout(boot, 800);
  }
  setTimeout(boot, 2500);

  console.info(tag, 'orphan-bill linker loaded');
})();
