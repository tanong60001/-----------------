// V62: conservative Supabase request optimizer.
(function () {
  'use strict';

  const PRODUCT_TABLE = 'สินค้า';
  const RECIPE_TABLE = 'สูตรสินค้า';
  const RECIPE_CACHE_MS = 60 * 1000;

  const recipeCache = new Map();

  function sameTable(name, expected) {
    return String(name || '') === expected;
  }

  function setGlobal(name, value) {
    window[name] = value;
    try { Function('name', 'value', 'window[name] = value; eval(name + " = value");')(name, value); }
    catch (_) {}
  }

  function fmt(value) {
    try { return typeof formatNum === 'function' ? formatNum(value) : Number(value || 0).toLocaleString('th-TH'); }
    catch (_) { return Number(value || 0).toLocaleString('th-TH'); }
  }

  function productsCache() {
    try { if (Array.isArray(products)) return products; } catch (_) {}
    return Array.isArray(window.products) ? window.products : [];
  }

  function clearRecipeCache() {
    recipeCache.clear();
  }

  function installLoadCoalescing() {
    ['loadProducts', 'loadCategories'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__v62Coalesced) return;
      let inFlight = null;
      const wrapped = async function () {
        if (inFlight) return inFlight;
        inFlight = Promise.resolve(original.apply(this, arguments))
          .finally(() => { inFlight = null; });
        return inFlight;
      };
      Object.defineProperty(wrapped, '__v62Coalesced', { value: true });
      setGlobal(name, wrapped);
    });
  }

  function installRecipeSelectCache() {
    if (!window.db || window.db.__v62RecipeCache || typeof window.db.from !== 'function') return;
    const originalFrom = window.db.from.bind(window.db);

    window.db.from = function (table) {
      const builder = originalFrom(table);
      if (!sameTable(table, RECIPE_TABLE)) return builder;

      let current = builder;
      const state = { select: '', productId: null, mutating: false };
      let proxy;

      const runCurrent = () => Promise.resolve(current).then(result => {
        if (state.mutating) clearRecipeCache();
        return result;
      });

      const handler = {
        get(_, prop) {
          if (prop === 'then') {
            return (resolve, reject) => {
              const canCache = !state.mutating && state.productId != null && state.select;
              const cacheKey = `${state.select}|${state.productId}`;
              const cached = canCache ? recipeCache.get(cacheKey) : null;
              if (cached && Date.now() - cached.at < RECIPE_CACHE_MS) {
                return Promise.resolve(cached.promise || cached.result).then(resolve, reject);
              }
              const request = runCurrent().then(result => {
                if (canCache && !result?.error) {
                  recipeCache.set(cacheKey, { at: Date.now(), result });
                }
                return result;
              });
              if (canCache) recipeCache.set(cacheKey, { at: Date.now(), promise: request });
              return request.then(resolve, reject);
            };
          }
          if (prop === 'catch') return reject => runCurrent().catch(reject);
          if (prop === 'finally') return cb => runCurrent().finally(cb);
          const value = current[prop];
          if (typeof value !== 'function') return value;
          return function () {
            if (prop === 'select') state.select = String(arguments[0] || '*');
            if (prop === 'eq' && String(arguments[0]) === 'product_id') state.productId = String(arguments[1]);
            if (/insert|update|upsert|delete/.test(String(prop))) {
              state.mutating = true;
              clearRecipeCache();
            }
            current = value.apply(current, arguments);
            return proxy;
          };
        }
      };

      proxy = new Proxy(function () {}, handler);
      return proxy;
    };

    Object.defineProperty(window.db, '__v62RecipeCache', { value: true });
    window.__v62ClearRecipeCache = clearRecipeCache;
  }

  function installLeanAlerts() {
    const original = window.updateAlerts;
    if (typeof original !== 'function' || original.__v62LeanAlerts) return;

    const wrapped = async function () {
      const alertsList = document.getElementById('home-alerts');
      if (!alertsList) return;
      const alerts = [];
      try {
        const localProducts = productsCache();
        if (localProducts.length) {
          const tracked = localProducts.filter(p => Number(p.min_stock || 0) > 0);
          const lowCount = tracked.filter(p => Number(p.stock || 0) <= Number(p.min_stock || 0) && Number(p.stock || 0) > 0).length;
          const outCount = tracked.filter(p => Number(p.stock || 0) <= 0).length;
          if (outCount > 0) alerts.push({ type: 'danger', icon: 'warning', text: `สินค้าหมดสต็อก ${fmt(outCount)} รายการ` });
          if (lowCount > 0) alerts.push({ type: 'warning', icon: 'inventory', text: `สินค้าใกล้หมด ${fmt(lowCount)} รายการ` });
        } else {
          const { data: lowStock } = await db.from(PRODUCT_TABLE).select('stock,min_stock').gt('min_stock', 0);
          const rows = lowStock || [];
          const lowCount = rows.filter(p => Number(p.stock || 0) <= Number(p.min_stock || 0) && Number(p.stock || 0) > 0).length;
          const outCount = rows.filter(p => Number(p.stock || 0) <= 0).length;
          if (outCount > 0) alerts.push({ type: 'danger', icon: 'warning', text: `สินค้าหมดสต็อก ${fmt(outCount)} รายการ` });
          if (lowCount > 0) alerts.push({ type: 'warning', icon: 'inventory', text: `สินค้าใกล้หมด ${fmt(lowCount)} รายการ` });
        }

        const { count, error } = await db.from('cash_session')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open');
        if (!error && !count) alerts.push({ type: 'info', icon: 'account_balance_wallet', text: 'ยังไม่ได้เปิดลิ้นชักวันนี้' });
      } catch (error) {
        console.warn('[v62] lean alerts fallback:', error);
        return original.apply(this, arguments);
      }

      if (!alerts.length) alerts.push({ type: 'info', icon: 'check_circle', text: 'ระบบพร้อมใช้งาน' });
      alertsList.innerHTML = alerts.map(item => `<div class="alert-item alert-${item.type}"><i class="material-icons-round">${item.icon}</i><span>${item.text}</span></div>`).join('');
    };

    Object.defineProperty(wrapped, '__v62LeanAlerts', { value: true });
    setGlobal('updateAlerts', wrapped);
  }

  function installLeanCashBalance() {
    const original = window.getCashBalance;
    if (typeof original !== 'function' || original.__v62LeanCashBalance) return;

    const wrapped = async function () {
      try {
        const { data: session, error: sessionError } = await db.from('cash_session')
          .select('id,opening_amt')
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sessionError) throw sessionError;
        if (!session) return 0;

        const { data: transactions, error: txError } = await db.from('cash_transaction')
          .select('net_amount,direction')
          .eq('session_id', session.id);
        if (txError) throw txError;

        let balance = Number(session.opening_amt || 0);
        (transactions || []).forEach(tx => {
          balance += tx.direction === 'in' ? Number(tx.net_amount || 0) : -Number(tx.net_amount || 0);
        });
        return balance;
      } catch (error) {
        console.warn('[v62] lean cash balance fallback:', error);
        return original.apply(this, arguments);
      }
    };

    Object.defineProperty(wrapped, '__v62LeanCashBalance', { value: true });
    setGlobal('getCashBalance', wrapped);
  }

  function boot() {
    installLoadCoalescing();
    installRecipeSelectCache();
    installLeanAlerts();
    installLeanCashBalance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  [400, 1200, 2500, 5000].forEach(delay => setTimeout(boot, delay));
})();
