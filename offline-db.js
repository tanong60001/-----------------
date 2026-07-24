/* SK POS offline-first data layer
 * Keeps the existing Supabase API shape while providing a local cache and
 * an offline write queue. The normal online client remains the source of truth.
 */
(function () {
  'use strict';

  const originalSupabase = window.supabase || {};
  const originalCreateClient = originalSupabase.createClient;
  const TABLE_PREFIX = 'sk:offline:table:';
  const QUEUE_KEY = 'sk:offline:write-queue:v1';
  const ID_PREFIX = 'sk:offline:id:';
  const runtime = { remote: null, syncing: false };

  const isOffline = () => window.SK_FORCE_OFFLINE === true || navigator.onLine === false;
  const tableKey = table => TABLE_PREFIX + encodeURIComponent(String(table || ''));
  const nowIso = () => new Date().toISOString();
  const makeId = () => {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return `${ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };
  const safeRead = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value == null ? fallback : value; } catch (_) { return fallback; }
  };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };

  function seedRows(table) {
    // Reuse the existing product/category caches on first offline launch.
    if (String(table) === 'สินค้า') {
      const cached = safeRead('sk:v62:products:v1', null);
      if (Array.isArray(cached)) return cached;
    }
    if (String(table) === 'categories') {
      const cached = safeRead('sk:v62:categories:v1', null);
      if (Array.isArray(cached)) return cached;
    }
    return [];
  }

  function loadRows(table) {
    const key = tableKey(table);
    const cached = safeRead(key, null);
    if (Array.isArray(cached)) return cached;
    const seeded = seedRows(table);
    if (seeded.length) safeWrite(key, seeded);
    return seeded;
  }

  function saveRows(table, rows) { safeWrite(tableKey(table), Array.isArray(rows) ? rows : []); }
  function readQueue() { return safeRead(QUEUE_KEY, []); }
  function writeQueue(queue) { safeWrite(QUEUE_KEY, queue); }

  function queueWrite(entry) {
    const queue = readQueue();
    queue.push({ ...entry, queued_at: nowIso() });
    writeQueue(queue);
    window.dispatchEvent(new CustomEvent('sk:offline-queued', { detail: { count: queue.length } }));
  }

  function valueMatches(row, op, field, expected) {
    const actual = row?.[field];
    const a = actual == null ? null : actual;
    switch (op) {
      case 'eq': return String(a) === String(expected);
      case 'neq': return String(a) !== String(expected);
      case 'gt': return Number(a) > Number(expected);
      case 'gte': return Number(a) >= Number(expected);
      case 'lt': return Number(a) < Number(expected);
      case 'lte': return Number(a) <= Number(expected);
      case 'is': return expected === null ? a == null : Boolean(a) === Boolean(expected);
      case 'like': return String(a ?? '').includes(String(expected).replace(/%/g, ''));
      case 'ilike': return String(a ?? '').toLowerCase().includes(String(expected).replace(/%/g, '').toLowerCase());
      case 'in': return (Array.isArray(expected) ? expected : String(expected).replace(/[()]/g, '').split(',')).map(String).includes(String(a));
      default: return true;
    }
  }

  function applyOr(row, expression) {
    return String(expression || '').split(',').some(part => {
      const m = part.trim().match(/^([^\.]+)\.(eq|ilike|like)\.(.*)$/i);
      return m ? valueMatches(row, m[2].toLowerCase(), m[1], m[3]) : true;
    });
  }

  function applyLocalQuery(table, rows, steps, single) {
    let result = rows.slice();
    for (const step of steps) {
      const [name, ...args] = step;
      if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is', 'like', 'ilike', 'in'].includes(name)) {
        result = result.filter(row => valueMatches(row, name, args[0], args[1]));
      } else if (name === 'or') {
        result = result.filter(row => applyOr(row, args[0]));
      } else if (name === 'match') {
        const obj = args[0] || {};
        result = result.filter(row => Object.entries(obj).every(([k, v]) => valueMatches(row, 'eq', k, v)));
      } else if (name === 'order') {
        const [field, options] = args;
        const ascending = options?.ascending !== false;
        result.sort((a, b) => {
          const av = a?.[field], bv = b?.[field];
          if (av === bv) return 0;
          if (av == null) return ascending ? -1 : 1;
          if (bv == null) return ascending ? 1 : -1;
          return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
        });
      } else if (name === 'range') {
        result = result.slice(Number(args[0]) || 0, (Number(args[1]) || 0) + 1);
      } else if (name === 'limit') {
        result = result.slice(0, Number(args[0]) || 0);
      }
    }
    const selectStep = steps.find(step => step[0] === 'select');
    const columns = selectStep?.[1];
    if (columns && columns !== '*' && typeof columns === 'string' && !columns.includes('(')) {
      const fields = columns.split(',').map(x => x.trim()).filter(Boolean);
      result = result.map(row => Object.fromEntries(fields.map(field => [field, row?.[field]])));
    }
    if (single) {
      if (!result.length) return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
      return { data: result[0], error: null };
    }
    return { data: result, error: null };
  }

  function matchesFilters(row, steps) {
    return applyLocalQuery('__filter__', [row], steps, false).data.length > 0;
  }

  function localMutation(table, action, payload, steps, single) {
    let rows = loadRows(table);
    if (action === 'insert') {
      const incoming = (Array.isArray(payload) ? payload : [payload]).filter(Boolean).map(value => ({
        id: value.id || makeId(), created_at: value.created_at || nowIso(), ...value
      }));
      if (String(table) === 'บิลขาย') {
        const maxBill = rows.reduce((max, row) => Math.max(max, Number(row.bill_no) || 0), 0);
        incoming.forEach((row, index) => { if (!row.bill_no) row.bill_no = maxBill + index + 1; });
      }
      rows.push(...incoming);
      saveRows(table, rows);
      const data = single ? incoming[0] : incoming;
      return { data, error: null };
    }
    if (action === 'update') {
      const changed = [];
      rows = rows.map(row => {
        if (!matchesFilters(row, steps)) return row;
        const next = { ...row, ...(payload || {}), updated_at: nowIso() };
        changed.push(next); return next;
      });
      saveRows(table, rows);
      return { data: single ? (changed[0] || null) : changed, error: null };
    }
    if (action === 'delete') {
      const removed = rows.filter(row => matchesFilters(row, steps));
      rows = rows.filter(row => !matchesFilters(row, steps));
      saveRows(table, rows);
      return { data: single ? (removed[0] || null) : removed, error: null };
    }
    if (action === 'upsert') {
      const incoming = (Array.isArray(payload) ? payload : [payload]).filter(Boolean);
      const changed = [];
      incoming.forEach(value => {
        const id = value.id;
        const index = id ? rows.findIndex(row => String(row.id) === String(id)) : -1;
        const next = { ...(index >= 0 ? rows[index] : {}), id: id || makeId(), created_at: value.created_at || nowIso(), ...value };
        if (index >= 0) rows[index] = next; else rows.push(next);
        changed.push(next);
      });
      saveRows(table, rows);
      return { data: single ? changed[0] : changed, error: null };
    }
    return applyLocalQuery(table, rows, steps, single);
  }

  function replayRemote(table, steps) {
    if (!runtime.remote) throw new Error('Supabase client unavailable');
    let query = runtime.remote.from(table);
    for (const step of steps) {
      const [name, ...args] = step;
      if (typeof query?.[name] === 'function') query = query[name](...args);
    }
    return query;
  }

  function isMutation(action) { return ['insert', 'update', 'delete', 'upsert'].includes(action); }

  async function executeRemote(table, steps) {
    const result = await replayRemote(table, steps);
    if (result && typeof result.then === 'function') return await result;
    return result;
  }

  function cacheRemoteResult(table, result) {
    const data = result?.data;
    if (!Array.isArray(data) && !data?.id) return;
    const incoming = Array.isArray(data) ? data : [data];
    const current = loadRows(table);
    const byId = new Map(current.map(row => [String(row.id), row]));
    incoming.forEach(row => {
      if (row?.id && byId.has(String(row.id))) byId.set(String(row.id), { ...byId.get(String(row.id)), ...row });
      else if (row?.id) byId.set(String(row.id), row);
      else current.push(row);
    });
    saveRows(table, Array.from(byId.values()));
  }

  async function flushQueue() {
    if (runtime.syncing || isOffline() || !runtime.remote) return;
    const queue = readQueue();
    if (!queue.length) return;
    runtime.syncing = true;
    const remaining = [];
    for (const entry of queue) {
      try {
        const result = await executeRemote(entry.table, entry.steps);
        if (result?.error) throw result.error;
        cacheRemoteResult(entry.table, result);
      } catch (_) { remaining.push(entry); }
    }
    writeQueue(remaining);
    runtime.syncing = false;
    window.dispatchEvent(new CustomEvent('sk:offline-synced', { detail: { remaining: remaining.length } }));
  }

  class Builder {
    constructor(table) { this.table = table; this.steps = []; this.action = 'select'; this.payload = null; this.singleMode = false; }
    select(...args) { this.steps.push(['select', ...args]); return this; }
    insert(payload, ...args) { this.action = 'insert'; this.payload = payload; this.steps.push(['insert', payload, ...args]); return this; }
    update(payload) { this.action = 'update'; this.payload = payload; this.steps.push(['update', payload]); return this; }
    delete(...args) { this.action = 'delete'; this.steps.push(['delete', ...args]); return this; }
    upsert(payload, ...args) { this.action = 'upsert'; this.payload = payload; this.steps.push(['upsert', payload, ...args]); return this; }
    eq(...args) { this.steps.push(['eq', ...args]); return this; }
    neq(...args) { this.steps.push(['neq', ...args]); return this; }
    gt(...args) { this.steps.push(['gt', ...args]); return this; }
    gte(...args) { this.steps.push(['gte', ...args]); return this; }
    lt(...args) { this.steps.push(['lt', ...args]); return this; }
    lte(...args) { this.steps.push(['lte', ...args]); return this; }
    is(...args) { this.steps.push(['is', ...args]); return this; }
    like(...args) { this.steps.push(['like', ...args]); return this; }
    ilike(...args) { this.steps.push(['ilike', ...args]); return this; }
    in(...args) { this.steps.push(['in', ...args]); return this; }
    or(...args) { this.steps.push(['or', ...args]); return this; }
    match(...args) { this.steps.push(['match', ...args]); return this; }
    order(...args) { this.steps.push(['order', ...args]); return this; }
    range(...args) { this.steps.push(['range', ...args]); return this; }
    limit(...args) { this.steps.push(['limit', ...args]); return this; }
    single() { this.singleMode = true; this.steps.push(['single']); return this; }
    maybeSingle() { this.singleMode = true; this.steps.push(['maybeSingle']); return this; }
    throwOnError() { return this; }
    csv() { this.steps.push(['csv']); return this; }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    catch(reject) { return this.execute().catch(reject); }
    finally(handler) { return this.execute().finally(handler); }
    async execute() {
      // Keep terminal modifiers for the real Supabase builder (`single()` is
      // what changes the returned data from an array to one object).
      const replaySteps = this.steps.slice();
      if (!isOffline() && runtime.remote) {
        try {
          const remoteResult = await executeRemote(this.table, replaySteps);
          if (!remoteResult?.error) {
            cacheRemoteResult(this.table, remoteResult);
            return remoteResult;
          }
          if (!isMutation(this.action)) return applyLocalQuery(this.table, loadRows(this.table), this.steps, this.singleMode);
        } catch (error) {
          if (!isMutation(this.action)) return applyLocalQuery(this.table, loadRows(this.table), this.steps, this.singleMode);
        }
      }
      const localResult = isMutation(this.action)
        ? localMutation(this.table, this.action, this.payload, this.steps, this.singleMode)
        : applyLocalQuery(this.table, loadRows(this.table), this.steps, this.singleMode);
      if (isMutation(this.action)) queueWrite({ table: this.table, steps: replaySteps });
      return localResult;
    }
  }

  function makeClient(url, key) {
    try { runtime.remote = originalCreateClient ? originalCreateClient(url, key) : null; } catch (_) { runtime.remote = null; }
    const client = {
      from(table) { return new Builder(table); },
      rpc(name, args) {
        if (!isOffline() && runtime.remote?.rpc) return runtime.remote.rpc(name, args);
        return Promise.resolve({ data: null, error: { message: `RPC ${name} unavailable offline` } });
      },
      channel(...args) {
        if (runtime.remote?.channel && !isOffline()) return runtime.remote.channel(...args);
        return { on() { return this; }, subscribe(callback) { callback?.('CHANNEL_ERROR'); return this; }, unsubscribe() {} };
      }
    };
    return client;
  }

  window.supabase = { ...originalSupabase, createClient: makeClient };
  window.SK_OFFLINE = { isOffline, flushQueue, queueCount: () => readQueue().length };

  function renderStatus() {
    let badge = document.getElementById('sk-offline-status');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'sk-offline-status';
      badge.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:10000;padding:6px 11px;border-radius:999px;font:700 12px/1.2 Arial,sans-serif;box-shadow:0 3px 12px rgba(15,23,42,.15);pointer-events:none;transition:.2s';
      document.body.appendChild(badge);
    }
    const offline = isOffline();
    const count = readQueue().length;
    badge.textContent = offline ? `ออฟไลน์${count ? ` • รอซิงก์ ${count}` : ''}` : (count ? `ออนไลน์ • รอซิงก์ ${count}` : 'ออนไลน์');
    badge.style.background = offline ? '#fff7ed' : '#ecfdf5';
    badge.style.color = offline ? '#c2410c' : '#047857';
    badge.style.border = `1px solid ${offline ? '#fdba74' : '#86efac'}`;
  }

  window.addEventListener('online', () => { renderStatus(); flushQueue(); });
  window.addEventListener('offline', renderStatus);
  window.addEventListener('sk:offline-queued', renderStatus);
  window.addEventListener('sk:offline-synced', renderStatus);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderStatus);
  else renderStatus();

  // Small fallbacks keep the POS usable if CDN libraries have not been cached yet.
  if (!window.Swal) {
    window.Swal = { fire: async options => {
      const opts = options || {};
      let value = opts.value;
      if (opts.input && typeof window.prompt === 'function') value = window.prompt(opts.inputLabel || opts.title || '', opts.inputValue || '');
      const confirmed = opts.showCancelButton && typeof window.confirm === 'function' ? window.confirm(opts.title || 'ยืนยันรายการ?') : true;
      return { isConfirmed: confirmed, value: confirmed ? value : undefined };
    } };
  }
})();
