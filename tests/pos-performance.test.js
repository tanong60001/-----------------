const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function saleHarness({ conflict = false, stock = 10 } = {}) {
  const calls = [];
  const context = {
    console: { log() {}, warn() {}, error() {} },
    toast() {},
    cart: [{ id: 'p1', name: 'A', qty: 2, price: 15, unit: 'ชิ้น', conv_rate: 1 }],
    checkoutState: { method: 'transfer', total: 30, received: 30, customer: {} },
    db: { from(table) {
      const query = { table, operation: 'read', filters: [],
        select() { return this; }, in(key, value) { this.filters.push([key, value]); return this; },
        eq(key, value) { this.filters.push([key, value]); return this; },
        insert(rows) { this.operation = 'insert'; this.rows = rows; return this; },
        update(rows) { this.operation = 'update'; this.rows = rows; return this; },
        single() { return this; }, maybeSingle() { return this; },
        then(resolve, reject) {
          calls.push({ table, operation: this.operation, rows: this.rows, filters: this.filters });
          let data = null;
          if (table === 'สูตรสินค้า') data = [];
          if (table === 'สินค้า' && this.operation === 'read') data = [{ id: 'p1', name: 'A', stock, cost: 5, unit: 'ชิ้น' }];
          if (table === 'สินค้า' && this.operation === 'update') data = conflict ? null : { id: 'p1', stock: this.rows.stock };
          if (table === 'บิลขาย' && this.operation === 'insert') data = { id: 'b1', bill_no: 123, total: 30 };
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    } },
  };
  context.window = context;
  vm.createContext(context);
  const source = read('modules-v36-usage-safety.js');
  vm.runInContext(source.slice(0, source.indexOf('  function installSaleSafety()')) + '\nwindow.testSale = runSafeSale; })();', context);
  return { context, calls };
}

test('sale reads only sold products once and persists real bill references', async () => {
  const { context, calls } = saleHarness();
  const bill = await context.testSale();
  assert.equal(bill.id, 'b1');
  const reads = calls.filter(call => call.table === 'สินค้า' && call.operation === 'read');
  assert.equal(reads.length, 1);
  assert.equal(JSON.stringify(reads[0].filters), JSON.stringify([['id', ['p1']]]));
  assert.equal(calls.find(call => call.table === 'รายการในบิล').rows[0].bill_id, 'b1');
  assert.equal(calls.find(call => call.table === 'stock_movement').rows[0].ref_id, 'b1');
  const stockWrite = calls.find(call => call.table === 'สินค้า' && call.operation === 'update');
  assert.equal(stockWrite.rows.stock, 8);
  assert.equal(stockWrite.filters.find(([key]) => key === 'stock')[1], 10);
  assert.equal(context.cart.length, 0);
});

test('insufficient stock never creates a bill', async () => {
  const { context, calls } = saleHarness({ stock: 1 });
  await assert.rejects(context.testSale(), /สต็อกไม่พอ/);
  assert.equal(calls.some(call => call.table === 'บิลขาย' && call.operation === 'insert'), false);
  assert.equal(context.cart.length, 1);
});

test('concurrent stock change marks the bill for review and keeps the cart', async () => {
  const { context, calls } = saleHarness({ conflict: true });
  await assert.rejects(context.testSale(), /สต็อกถูกเปลี่ยน/);
  assert.equal(calls.find(call => call.table === 'บิลขาย' && call.operation === 'update').rows.status, 'รอตรวจสอบ');
  assert.equal(context.cart.length, 1);
  assert.equal(context.__posPaymentLock, false);
});

test('double submission creates only one bill', async () => {
  const { context, calls } = saleHarness();
  await Promise.all([context.testSale(), context.testSale()]);
  assert.equal(calls.filter(call => call.table === 'บิลขาย' && call.operation === 'insert').length, 1);
});

test('bill events on POS invalidate caches without loading customer totals', async () => {
  let syncs = 0;
  let invalidations = 0;
  let storageWrites = 0;
  const callbacks = {};
  const timers = [];
  const context = {
    console: { info() {}, warn() {} }, currentPage: 'pos',
    document: { readyState: 'complete', getElementById: () => null },
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    BroadcastChannel: class { postMessage() {} },
    localStorage: { setItem() { storageWrites++; }, removeItem() {} },
    addEventListener() {},
    v68SyncCustomerTotals: async () => { syncs++; },
    v68InvalidateCustomerSync: () => { invalidations++; },
    db: { channel() { return {
      on(_, filter, callback) { callbacks[filter.table] = callback; return this; },
      subscribe() { return this; },
    }; } },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('modules-v72-realtime-cache-sync.js'), context);
  timers.shift()();
  callbacks['บิลขาย']({ eventType: 'INSERT' });
  for (const callback of timers.splice(0)) await callback();
  assert.equal(syncs, 0);
  assert.equal(invalidations, 1);
  assert.equal(storageWrites, 0);
});

test('overlapping customer syncs share one request and invalidation discards its cache', async () => {
  const source = read('modules-v68-customer-debt-stock-history-fixes.js');
  const block = source.slice(source.indexOf('  let syncCache = null;'), source.indexOf('  async function syncCustomer(customerId)'));
  let calls = 0;
  let resolve;
  const context = { syncAllCustomers() { calls++; return new Promise(done => { resolve = done; }); } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(block + '\nwindow.getSync = getSyncedCustomers;', context);
  const first = context.getSync(true);
  const second = context.getSync(true);
  assert.equal(calls, 1);
  context.v68InvalidateCustomerSync();
  resolve({ rows: [] });
  await Promise.all([first, second]);
  const fresh = context.getSync(false);
  assert.equal(calls, 2);
  resolve({ rows: [] });
  await fresh;
  await context.getSync(false);
  assert.equal(calls, 2);
});
