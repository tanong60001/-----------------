const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function offlineHarness() {
  const calls = [], storage = new Map();
  let next = null, authChanged, clientOptions;
  function builder(table, initial = []) {
    const steps = initial.slice();
    let query;
    query = new Proxy({}, { get(_, name) {
      if (name === 'then') return (resolve, reject) => {
        calls.push({ table, steps: steps.slice() });
        const response = next || Promise.resolve({ data: [{ id: 'p1', stock: 5 }], error: null });
        next = null;
        return response.then(resolve, reject);
      };
      return (...args) => { steps.push([name, ...args]); return query; };
    } });
    return query;
  }
  const context = {
    navigator: { onLine: true }, console,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    addEventListener() {}, dispatchEvent() {}, CustomEvent: class {},
    supabase: { createClient(url, key, options) {
      clientOptions = options;
      return { from: builder, rpc: (name, args) => builder(name, [['rpc', args]]),
        auth: { onAuthStateChange(fn) { authChanged = fn; } } };
    } },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('offline-db.js'), context);
  const options = { auth: { persistSession: false } };
  const db = context.supabase.createClient('https://example.test', 'public', options);
  assert.equal(clientOptions, options);
  return { context, db, calls, storage, hold() { const value = deferred(); next = value.promise; return value; }, authChanged: () => authChanged() };
}

test('20 concurrent identical reads use one request; completed reads are never cached', async () => {
  const h = offlineHarness(), gate = h.hold();
  const readers = Array.from({ length: 20 }, () => Promise.resolve(h.db.from('products').select('id,stock').eq('id', 'p1')));
  await tick();
  assert.equal(h.calls.length, 1);
  gate.resolve({ data: [{ id: 'p1', stock: 5 }], error: null });
  const results = await Promise.all(readers);
  results[0].data[0].stock = 999;
  assert.equal(results[1].data[0].stock, 5);
  await h.db.from('products').select('id,stock').eq('id', 'p1');
  assert.equal(h.calls.length, 2);
});

test('reads with different filters or projections remain separate', async () => {
  const h = offlineHarness();
  await Promise.all([
    h.db.from('products').select('stock').eq('id', 'p1'),
    h.db.from('products').select('stock').eq('id', 'p2'),
    h.db.from('products').select('id,stock').eq('id', 'p1'),
  ]);
  assert.equal(h.calls.length, 3);
});

test('read after a write cannot join a pending read from before the write', async () => {
  const h = offlineHarness(), gate = h.hold();
  const old = Promise.resolve(h.db.from('products').select('stock'));
  await tick();
  await h.db.from('products').update({ stock: 6 }).eq('id', 'p1');
  await h.db.from('products').select('stock');
  assert.equal(h.calls.length, 3);
  gate.resolve({ data: [{ id: 'p1', stock: 5 }], error: null });
  await old;
});

test('failed reads are retried and auth changes break request sharing', async () => {
  const h = offlineHarness(), gate = h.hold();
  const first = Promise.resolve(h.db.from('products').select('stock'));
  await tick();
  h.authChanged();
  await h.db.from('products').select('stock');
  assert.equal(h.calls.length, 2);
  gate.resolve({ data: null, error: { message: 'temporary failure' } });
  await first;
  await h.db.from('products').select('stock');
  assert.equal(h.calls.length, 3);
});

test('writes remain separate; RPC stays lazy and invalidates pending reads', async () => {
  const h = offlineHarness();
  h.db.rpc('cleanup', {});
  await tick();
  assert.equal(h.calls.length, 0);
  await Promise.all([
    h.db.from('products').update({ stock: 4 }).eq('id', 'p1'),
    h.db.from('products').update({ stock: 4 }).eq('id', 'p1'),
  ]);
  assert.equal(h.calls.length, 2);
  const gate = h.hold();
  const old = Promise.resolve(h.db.from('products').select('stock'));
  await tick();
  await h.db.rpc('apply_stock', {}).single();
  await h.db.from('products').select('stock');
  assert.equal(h.calls.length, 5);
  gate.resolve({ data: [], error: null }); await old;
});

test('offline writes still queue and synchronize to the real server', async () => {
  const h = offlineHarness();
  h.context.navigator.onLine = false;
  await h.db.from('products').update({ stock: 3 }).eq('id', 'p1');
  assert.equal(h.calls.length, 0);
  assert.equal(h.context.SK_OFFLINE.queueCount(), 1);
  h.context.navigator.onLine = true;
  await h.context.SK_OFFLINE.flushQueue();
  assert.equal(h.calls.length, 1);
  assert.equal(h.context.SK_OFFLINE.queueCount(), 0);
});

test('product loads honor the full TTL, while forced and dirty loads fetch immediately', async () => {
  let now = 1000000, loads = 0;
  const context = {
    console, products: [{ id: 'p1', stock: 5 }], categories: [],
    Date: class extends Date { static now() { return now; } },
    document: { readyState: 'complete', getElementById: () => null },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, setTimeout() {},
    loadProducts: async () => { loads++; },
  };
  context.window = context; vm.createContext(context);
  vm.runInContext(read('modules-v62-supabase-optimizer.js'), context);
  await context.loadProducts();
  for (let i = 0; i < 5; i++) { now += 30000; await context.loadProducts(); }
  assert.equal(loads, 1);
  await context.loadProducts(true); assert.equal(loads, 2);
  now++; context.__v62ProductsDirtyAt = now;
  await context.loadProducts(); assert.equal(loads, 3);
  now += 180001; await context.loadProducts(); assert.equal(loads, 4);
});

function realtimeHarness(page) {
  const timers = new Map(), events = {}, listeners = {};
  const counts = { home: 0, dash: 0, projects: 0, debt: 0, sync: 0 };
  let id = 0;
  const context = {
    console: { info() {}, warn() {} }, currentPage: page,
    document: { hidden: false, readyState: 'complete', getElementById: () => null,
      addEventListener(name, fn) { (listeners[name] ||= []).push(fn); } },
    setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    BroadcastChannel: class { postMessage() {} }, localStorage: { removeItem() {} }, addEventListener() {},
    updateHomeStats: async () => { counts.home++; }, renderDashboard: async () => { counts.dash++; },
    renderProjects: async () => { counts.projects++; }, v68RenderDebts: async () => { counts.debt++; },
    v68SyncCustomerTotals: async () => { counts.sync++; },
    db: { channel() { return { on(_, filter, callback) { events[filter.table] = callback; return this; }, subscribe() { return this; } }; } },
  };
  context.window = context; vm.createContext(context);
  vm.runInContext(read('modules-v72-realtime-cache-sync.js'), context);
  async function flush() { const jobs = [...timers.values()]; timers.clear(); for (const fn of jobs) await fn(); }
  return { context, events, counts, flush, show() { context.document.hidden = false; listeners.visibilitychange.forEach(fn => fn()); } };
}

test('bill events load only the visible report and perform one debt render', async () => {
  const h = realtimeHarness('home'); await h.flush();
  h.events['บิลขาย']({ eventType: 'INSERT' }); await h.flush();
  assert.equal(h.counts.home, 1); assert.equal(h.counts.dash, 0);
  h.context.currentPage = 'dash';
  h.events['บิลขาย']({ eventType: 'UPDATE' }); await h.flush();
  assert.equal(h.counts.home, 1); assert.equal(h.counts.dash, 1);
  h.context.currentPage = 'debt';
  h.events['บิลขาย']({ eventType: 'UPDATE' }); await h.flush();
  assert.equal(h.counts.debt, 1); assert.equal(h.counts.sync, 0);
});

test('project event bursts refresh once; hidden tabs defer work until visible', async () => {
  const h = realtimeHarness('project'); await h.flush();
  h.context.document.hidden = true;
  for (let i = 0; i < 20; i++) { h.events['โครงการ'](); h.events['รายจ่ายโครงการ'](); }
  await h.flush(); assert.equal(h.counts.projects, 0);
  h.show(); await h.flush(); assert.equal(h.counts.projects, 1);
});

test('POS home-stat calls update sidebar cash without reading the daily report', async () => {
  let reads = 0, cash = 0, alerts = 0;
  const elements = {};
  const context = { console, currentPage: 'pos',
    document: { getElementById: id => (elements[id] ||= {}) },
    fetchAllRows: async () => { reads++; return []; },
    getCashBalance: async () => { cash++; return 321; }, updateAlerts: async () => { alerts++; },
  };
  context.window = context; vm.createContext(context);
  vm.runInContext(read('modules-v107-home-daily-payments.js'), context);
  await context.updateHomeStats();
  assert.equal(reads, 0); assert.equal(cash, 1); assert.equal(alerts, 0);
  assert.match(elements['global-cash-balance'].textContent, /321/);
  context.currentPage = 'home'; await context.updateHomeStats();
  assert.equal(reads, 1); assert.equal(cash, 2); assert.equal(alerts, 1);
});
