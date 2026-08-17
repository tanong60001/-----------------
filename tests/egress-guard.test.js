const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('sales history no longer polls Supabase every eight seconds', () => {
  const source = read('modules-v82-checkout-history-polish.js');
  assert.doesNotMatch(source, /POLL_INTERVAL\s*=\s*8000/);
  assert.doesNotMatch(source, /doRefreshHistory\(['"]poll['"]\)/);
  assert.match(source, /FOCUS_REFRESH_MAX_AGE\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
});

test('history reads lean columns and never scans every bill on every render', () => {
  const source = read('modules-v68-customer-debt-stock-history-fixes.js');
  assert.match(source, /select\(HISTORY_COLUMNS\)/);
  assert.match(source, /if \(filter === 'incomplete'\)/);
  assert.doesNotMatch(source, /\.range\(0,\s*9999\)/);
  assert.doesNotMatch(source, /db\.from\(BILL_TABLE\)\s*\n\s*\.select\(['"]\*['"]\)/);
  assert.match(source, /options\?\.type === 'input'/);
});

test('history decorators reuse rendered rows instead of querying bills again', () => {
  const decorators = [
    ['modules-v70-checkout-polish-deposit.js', 'fetchDepositBills'],
    ['modules-v71-checkout-banner-stats-fix.js', 'fetchHistoryBills'],
  ];
  for (const [file, functionName] of decorators) {
    const source = read(file);
    const pattern = new RegExp(`async function ${functionName}\\(\\) \\{([\\s\\S]*?)\\n  \\}`);
    const fetchBlock = source.match(pattern)?.[1] || '';
    assert.match(fetchBlock, /__v68HistoryRows/, file);
    assert.doesNotMatch(fetchBlock, /db\.from/, file);
  }
});

test('only one Supabase channel subscribes to bill changes', () => {
  const v46 = read('modules-v46-multidevice-scanner-payroll.js');
  const v48 = read('modules-v48-final-staff-sales.js');
  const v72 = read('modules-v72-realtime-cache-sync.js');
  assert.doesNotMatch(v46, /postgres_changes[^\n]+table: 'บิลขาย'/);
  assert.doesNotMatch(v48, /db\.channel\(['"]v48-staff-sales/);
  assert.match(v48, /BroadcastChannel\(['"]sk-pos-sync['"]\)/);
  assert.match(v72, /postgres_changes[^\n]+table: 'บิลขาย'/);
  assert.doesNotMatch(v72, /postgres_changes[^\n]+table: 'รายการในบิล'/);
});

test('Realtime product updates are merged into the local product cache', () => {
  const storage = new Map();
  const context = {
    console,
    products: [
      { id: 'p1', name: 'A', stock: 3 },
      { id: 'p2', name: 'B', stock: 4 },
    ],
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    document: { readyState: 'complete', getElementById: () => null },
    setTimeout: () => 0,
    clearTimeout: () => {},
    loadProducts: async () => {},
    categories: [],
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('modules-v62-supabase-optimizer.js'), context);

  assert.equal(typeof context.__v62ApplyProductRealtime, 'function');
  assert.equal(context.__v62ApplyProductRealtime({
    eventType: 'UPDATE',
    new: { id: 'p1', name: 'A', stock: 9 },
    old: { id: 'p1' },
  }), true);
  assert.equal(context.products.find(row => row.id === 'p1').stock, 9);
  assert.equal(JSON.parse(storage.get('sk:v62:products:v1')).rows.length, 2);
});
