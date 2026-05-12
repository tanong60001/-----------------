/**
 * SK POS — v72: extended realtime sync + local cache to save Supabase egress.
 * ════════════════════════════════════════════════════════════════════════════
 * Goals:
 *   1. Subscribe to more tables (customer, ชำระหนี้, หนี้เดิมยกมา, รายการในบิล,
 *      stock_movement) so that when device A saves a bill or payment, device B
 *      refreshes the page it's looking at — without a manual reload.
 *   2. Lean on local cache aggressively (v62 product cache, v68 customer-sync
 *      cache) and invalidate them precisely on realtime events. This keeps
 *      Supabase reads to a minimum without ever showing stale data after a
 *      remote save.
 *   3. Cross-tab cache invalidation via BroadcastChannel + localStorage event.
 *
 * Safety rules:
 *   - Never wraps `db.from()` / never touches the supabase query builder.
 *   - Realtime is layered on top of v46's existing channel pattern.
 *   - Channel failure or "missing db" is non-fatal — we log and bail.
 *   - All UI-refresh calls are debounced (350-600 ms) to coalesce bursts.
 *   - Honors existing patches: just calls public functions (loadProducts,
 *     loadCustomerData, v68SyncCustomerTotals, v68RenderDebts,
 *     v39LoadHistoryData) that other modules already provide.
 */
(function () {
  'use strict';

  if (typeof db === 'undefined' || typeof db.channel !== 'function') {
    console.warn('[v72] supabase client not ready — skipping realtime sync setup');
    return;
  }

  let channel = null;
  const tag = '[v72]';
  const BC_NAME = 'sk-pos-sync';
  let bc = null;
  try { if ('BroadcastChannel' in window) bc = new BroadcastChannel(BC_NAME); } catch (_) {}

  function broadcast(kind, extra) {
    try { bc?.postMessage({ kind, at: Date.now(), ...(extra || {}) }); } catch (_) {}
    // Also write to localStorage so other tabs that don't share the BC scope
    // still get a storage event.
    try {
      localStorage.setItem('sk:v72:bc', JSON.stringify({ kind, at: Date.now(), ...(extra || {}) }));
    } catch (_) {}
  }

  function debounce(fn, delay) {
    let t = 0;
    return function () {
      clearTimeout(t);
      t = setTimeout(() => { try { fn(); } catch (e) { console.warn(tag, 'debounced fn:', e); } }, delay);
    };
  }

  function currentPageId() {
    try { return window.currentPage || ''; } catch (_) { return ''; }
  }
  function visibleSection(id) {
    const el = document.getElementById(id);
    return !!(el && el.offsetParent !== null);
  }

  /* ─────────────────────────────────────────────────────────────
     Cache invalidation primitives
  ───────────────────────────────────────────────────────────── */

  function invalidateProductsCache() {
    // v62 watches __v62ProductsDirtyAt to know its localStorage cache is stale.
    try { window.__v62ProductsDirtyAt = Date.now(); } catch (_) {}
    try { localStorage.removeItem('sk:v62:products:v1'); } catch (_) {}
  }
  function invalidateCategoriesCache() {
    try { window.__v62CategoriesDirtyAt = Date.now(); } catch (_) {}
    try { localStorage.removeItem('sk:v62:categories:v1'); } catch (_) {}
  }
  function invalidateCustomerSync(force) {
    // v68 keeps a 15 s closure cache. The only safe way to clear it from
    // outside is to call v68SyncCustomerTotals(true) which sets the cache
    // pointer to null inside the closure. We do that lazily — only if the
    // user is on a page that consumes it.
    if (!force && currentPageId() !== 'debt' && currentPageId() !== 'customer') return;
    if (typeof window.v68SyncCustomerTotals === 'function') {
      window.v68SyncCustomerTotals(true).catch(err => console.warn(tag, 'force sync:', err));
    }
  }

  /* ─────────────────────────────────────────────────────────────
     Page refresh hooks (debounced)
  ───────────────────────────────────────────────────────────── */

  const refreshDebtPage = debounce(async () => {
    if (currentPageId() !== 'debt') return;
    try {
      if (typeof window.v68SyncCustomerTotals === 'function') await window.v68SyncCustomerTotals(true);
      if (typeof window.v68RenderDebts === 'function') await window.v68RenderDebts();
      else if (typeof window.renderDebts === 'function') await window.renderDebts();
    } catch (e) { console.warn(tag, 'debt refresh:', e); }
  }, 450);

  const refreshCustomerPage = debounce(async () => {
    if (currentPageId() !== 'customer') return;
    try {
      if (typeof window.v68SyncCustomerTotals === 'function') await window.v68SyncCustomerTotals(true);
      if (typeof window.loadCustomerData === 'function') await window.loadCustomerData();
    } catch (e) { console.warn(tag, 'customer refresh:', e); }
  }, 450);

  const refreshHistoryPage = debounce(async () => {
    if (currentPageId() !== 'history') return;
    try {
      if (typeof window.v39LoadHistoryData === 'function') await window.v39LoadHistoryData();
      else if (typeof window.loadHistoryData === 'function') await window.loadHistoryData();
    } catch (e) { console.warn(tag, 'history refresh:', e); }
  }, 450);

  const refreshDashboard = debounce(async () => {
    if (currentPageId() !== 'dash' && currentPageId() !== 'home') return;
    try {
      if (typeof window.updateHomeStats === 'function') window.updateHomeStats();
      if (typeof window.renderDashboard === 'function') await window.renderDashboard();
    } catch (e) { console.warn(tag, 'dashboard refresh:', e); }
  }, 600);

  const refreshInventory = debounce(async () => {
    if (currentPageId() !== 'inv') return;
    try {
      if (typeof window.renderInventory === 'function') await window.renderInventory();
    } catch (e) { console.warn(tag, 'inventory refresh:', e); }
  }, 450);

  /* ─────────────────────────────────────────────────────────────
     Realtime handlers — one per table.
  ───────────────────────────────────────────────────────────── */

  function onBillsChanged(payload) {
    console.info(tag, 'realtime: บิลขาย', payload?.eventType || payload?.type || '');
    invalidateCustomerSync(true);
    broadcast('bills', { event: payload?.eventType });
    refreshDebtPage();
    refreshCustomerPage();
    refreshHistoryPage();
    refreshDashboard();
  }
  function onBillItemsChanged() {
    invalidateProductsCache();
    invalidateCustomerSync();
    refreshInventory();
    refreshHistoryPage();
  }
  function onCustomerChanged() {
    invalidateCustomerSync(true);
    broadcast('customer');
    refreshCustomerPage();
    refreshDebtPage();
  }
  function onPaymentsChanged() {
    invalidateCustomerSync(true);
    broadcast('payments');
    refreshDebtPage();
    refreshCustomerPage();
  }
  function onOpeningDebtChanged() {
    invalidateCustomerSync(true);
    refreshDebtPage();
    refreshCustomerPage();
  }
  function onStockMovementChanged() {
    invalidateProductsCache();
    refreshInventory();
    refreshDashboard();
  }
  function onProjectsChanged() {
    broadcast('projects');
    try { if (typeof window.renderProjects === 'function' && currentPageId() === 'project') window.renderProjects(); } catch (_) {}
  }
  function onProjectExpenseChanged() {
    broadcast('project_expense');
    try { if (typeof window.renderProjects === 'function' && currentPageId() === 'project') window.renderProjects(); } catch (_) {}
  }

  function install() {
    if (channel) return;
    try {
      channel = db.channel('v72-extended-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'บิลขาย' }, onBillsChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'รายการในบิล' }, onBillItemsChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customer' }, onCustomerChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ชำระหนี้' }, onPaymentsChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'หนี้เดิมยกมา' }, onOpeningDebtChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movement' }, onStockMovementChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'โครงการ' }, onProjectsChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'รายจ่ายโครงการ' }, onProjectExpenseChanged)
        .subscribe(status => console.info(tag, 'realtime sync:', status));
    } catch (e) {
      console.warn(tag, 'realtime channel failed:', e);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     Cross-tab listener — when another tab receives a realtime
     event, it broadcasts; we mirror the invalidation locally.
  ───────────────────────────────────────────────────────────── */
  function onCrossTabMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    const k = msg.kind;
    if (k === 'bills') {
      invalidateCustomerSync(true);
      refreshDebtPage();
      refreshHistoryPage();
      refreshCustomerPage();
      refreshDashboard();
    } else if (k === 'customer') {
      invalidateCustomerSync(true);
      refreshCustomerPage();
      refreshDebtPage();
    } else if (k === 'payments') {
      invalidateCustomerSync(true);
      refreshDebtPage();
      refreshCustomerPage();
    } else if (k === 'projects' || k === 'project_expense') {
      try { if (currentPageId() === 'project' && typeof window.renderProjects === 'function') window.renderProjects(); } catch (_) {}
    }
  }

  bc && (bc.onmessage = e => onCrossTabMessage(e.data));
  window.addEventListener('storage', e => {
    if (e.key !== 'sk:v72:bc' || !e.newValue) return;
    try { onCrossTabMessage(JSON.parse(e.newValue)); } catch (_) {}
  });

  /* ─────────────────────────────────────────────────────────────
     Optional: keep v62 product cache fresh longer when realtime
     is healthy. v62 expires its cache after 3 minutes by default;
     realtime invalidates on change, so we can be more permissive.
     We don't override v62 — we just don't dirty-mark it ourselves
     unless realtime tells us to (which is the default behavior).
  ───────────────────────────────────────────────────────────── */

  function boot() {
    install();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 800));
  } else {
    setTimeout(boot, 800);
  }
  // Re-install if v46/v62 booted later and reset the channel state.
  setTimeout(install, 2500);
  setTimeout(install, 6000);

  // Optional debugging helper
  window.v72Status = () => ({
    channel: channel?.state || null,
    bc: !!bc,
    currentPage: currentPageId(),
  });

  console.info(tag, 'extended realtime + cross-tab cache invalidation loaded');
})();
