// V62: conservative Supabase request optimizer.
(function () {
  'use strict';

  const PRODUCT_TABLE = '\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
  const RECIPE_TABLE = '\u0e2a\u0e39\u0e15\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
  const UNIT_TABLE = 'product_units';
  const RECIPE_CACHE_MS = 60 * 1000;
  const PRODUCT_CACHE_MS = 3 * 60 * 1000;
  const CATEGORY_CACHE_MS = 10 * 60 * 1000;
  const STALE_REFRESH_MS = 20 * 1000;
  const PRODUCT_CACHE_KEY = 'sk:v62:products:v1';
  const CATEGORY_CACHE_KEY = 'sk:v62:categories:v1';

  const recipeCache = new Map();
  const tableSelectCache = new Map();

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

  function assignProducts(rows) {
    if (!Array.isArray(rows)) return;
    try { products = rows; } catch (_) {}
    window.products = rows;
    try { window._v9ProductsCache = rows; } catch (_) {}
  }

  function categoriesCache() {
    try { if (Array.isArray(categories)) return categories; } catch (_) {}
    return Array.isArray(window.categories) ? window.categories : [];
  }

  function assignCategories(rows) {
    if (!Array.isArray(rows)) return;
    try { categories = rows; } catch (_) {}
    window.categories = rows;
  }

  function readLocalCache(key, maxAge) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.rows) || Date.now() - Number(parsed.at || 0) > maxAge) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeLocalCache(key, rows) {
    if (!Array.isArray(rows)) return;
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), rows }));
    } catch (_) {}
  }

  function clearRecipeCache() {
    recipeCache.clear();
    tableSelectCache.clear();
  }

  function clearProductCache() {
    try { localStorage.removeItem(PRODUCT_CACHE_KEY); } catch (_) {}
    window.__v62ProductsDirtyAt = Date.now();
  }

  function clearCategoryCache() {
    try { localStorage.removeItem(CATEGORY_CACHE_KEY); } catch (_) {}
    window.__v62CategoriesDirtyAt = Date.now();
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

  function installProductLoadCache() {
    const original = window.loadProducts;
    if (typeof original !== 'function' || original.__v62ProductCache) return;
    let inFlight = null;
    let lastNetworkAt = 0;

    const refreshNetwork = async function () {
      if (inFlight) return inFlight;
      inFlight = Promise.resolve(original.apply(this, arguments))
        .then(result => {
          const rows = productsCache();
          if (rows.length) {
            writeLocalCache(PRODUCT_CACHE_KEY, rows);
            lastNetworkAt = Date.now();
            if (Number(window.__v62ProductsDirtyAt || 0) <= lastNetworkAt) window.__v62ProductsDirtyAt = 0;
          }
          return result;
        })
        .finally(() => { inFlight = null; });
      return inFlight;
    };

    const wrapped = async function (force = false) {
      if (force || window.__v62ForceNetworkProducts) return refreshNetwork.apply(this, arguments);

      const dirtyAt = Number(window.__v62ProductsDirtyAt || 0);
      if (dirtyAt > lastNetworkAt) return refreshNetwork.apply(this, arguments);

      const localRows = productsCache();
      if (localRows.length && Date.now() - lastNetworkAt < PRODUCT_CACHE_MS) {
        if (Date.now() - lastNetworkAt > STALE_REFRESH_MS) refreshNetwork.apply(this, arguments).catch(() => {});
        return localRows;
      }

      const cached = readLocalCache(PRODUCT_CACHE_KEY, PRODUCT_CACHE_MS);
      if (cached?.rows?.length) {
        assignProducts(cached.rows);
        lastNetworkAt = Number(cached.at || Date.now());
        if (Date.now() - lastNetworkAt > STALE_REFRESH_MS) refreshNetwork.apply(this, arguments).catch(() => {});
        return cached.rows;
      }

      return refreshNetwork.apply(this, arguments);
    };

    Object.defineProperty(wrapped, '__v62ProductCache', { value: true });
    Object.defineProperty(wrapped, '__v62Coalesced', { value: true });
    setGlobal('loadProducts', wrapped);
  }

  function installCategoryLoadCache() {
    const original = window.loadCategories;
    if (typeof original !== 'function' || original.__v62CategoryCache) return;
    let inFlight = null;
    let lastNetworkAt = 0;

    const refreshNetwork = async function () {
      if (inFlight) return inFlight;
      inFlight = Promise.resolve(original.apply(this, arguments))
        .then(result => {
          const rows = categoriesCache();
          if (rows.length) {
            writeLocalCache(CATEGORY_CACHE_KEY, rows);
            lastNetworkAt = Date.now();
            if (Number(window.__v62CategoriesDirtyAt || 0) <= lastNetworkAt) window.__v62CategoriesDirtyAt = 0;
          }
          return result;
        })
        .finally(() => { inFlight = null; });
      return inFlight;
    };

    const wrapped = async function (force = false) {
      if (force) return refreshNetwork.apply(this, arguments);
      const dirtyAt = Number(window.__v62CategoriesDirtyAt || 0);
      if (dirtyAt > lastNetworkAt) return refreshNetwork.apply(this, arguments);
      const localRows = categoriesCache();
      if (localRows.length && Date.now() - lastNetworkAt < CATEGORY_CACHE_MS) return localRows;
      const cached = readLocalCache(CATEGORY_CACHE_KEY, CATEGORY_CACHE_MS);
      if (cached?.rows?.length) {
        assignCategories(cached.rows);
        lastNetworkAt = Number(cached.at || Date.now());
        try { renderCategories?.(); } catch (_) {}
        refreshNetwork.apply(this, arguments).catch(() => {});
        return cached.rows;
      }
      return refreshNetwork.apply(this, arguments);
    };

    Object.defineProperty(wrapped, '__v62CategoryCache', { value: true });
    Object.defineProperty(wrapped, '__v62Coalesced', { value: true });
    setGlobal('loadCategories', wrapped);
  }

  function installRecipeSelectCache() {
    if (!window.db || window.db.__v62RecipeCache || typeof window.db.from !== 'function') return;
    const originalFrom = window.db.from.bind(window.db);

    window.db.from = function (table) {
      const builder = originalFrom(table);
      const cacheableTable = sameTable(table, RECIPE_TABLE) || sameTable(table, UNIT_TABLE);
      const productTable = sameTable(table, PRODUCT_TABLE);
      const categoryTable = sameTable(table, 'categories');
      if (!cacheableTable && !productTable && !categoryTable) return builder;

      let current = builder;
      const state = { table: String(table || ''), select: '', filters: [], mutating: false };
      let proxy;

      const runCurrent = () => Promise.resolve(current).then(result => {
        if (state.mutating) {
          if (cacheableTable) clearRecipeCache();
          if (productTable) clearProductCache();
          if (categoryTable) clearCategoryCache();
        }
        return result;
      });

      const handler = {
        get(_, prop) {
          if (prop === 'then') {
            return (resolve, reject) => {
              const canCache = cacheableTable && !state.mutating && state.select;
              const cacheKey = `${state.table}|${state.select}|${state.filters.join('&') || 'all'}`;
              const cached = canCache ? tableSelectCache.get(cacheKey) || recipeCache.get(cacheKey) : null;
              if (cached && Date.now() - cached.at < RECIPE_CACHE_MS) {
                return Promise.resolve(cached.promise || cached.result).then(resolve, reject);
              }
              const request = runCurrent().then(result => {
                if (canCache && !result?.error) {
                  tableSelectCache.set(cacheKey, { at: Date.now(), result });
                  recipeCache.set(cacheKey, { at: Date.now(), result });
                }
                return result;
              });
              if (canCache) tableSelectCache.set(cacheKey, { at: Date.now(), promise: request });
              return request.then(resolve, reject);
            };
          }
          if (prop === 'catch') return reject => runCurrent().catch(reject);
          if (prop === 'finally') return cb => runCurrent().finally(cb);
          const value = current[prop];
          if (typeof value !== 'function') return value;
          return function () {
            if (prop === 'select') state.select = String(arguments[0] || '*');
            if (cacheableTable && prop !== 'select' && !/insert|update|upsert|delete/.test(String(prop))) {
              const args = Array.from(arguments).map(arg => {
                try { return JSON.stringify(arg); } catch (_) { return String(arg); }
              }).join(',');
              state.filters.push(`${String(prop)}(${args})`);
            }
            if (/insert|update|upsert|delete/.test(String(prop))) {
              state.mutating = true;
              clearRecipeCache();
              if (productTable) clearProductCache();
              if (categoryTable) clearCategoryCache();
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
    window.__v62ClearProductCache = clearProductCache;
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
    installProductLoadCache();
    installCategoryLoadCache();
    installRecipeSelectCache();
    installLeanAlerts();
    installLeanCashBalance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  [400, 1200, 2500, 5000].forEach(delay => setTimeout(boot, delay));
})();
