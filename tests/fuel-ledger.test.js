const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fuel = require('../modules-v108-fuel-ledger.js');
const root = path.resolve(__dirname, '..');

test('fuel summary calculates received, dispensed, stock and unique vehicles', () => {
  const rows = [
    { transaction_type: 'receive', fuel_type: 'ดีเซล', liters: 100, occurred_at: '2026-08-28T01:00:00Z' },
    { transaction_type: 'dispense', fuel_type: 'ดีเซล', liters: 20, vehicle_plate: '83-1000', occurred_at: '2026-08-28T02:00:00Z' },
    { transaction_type: 'dispense', fuel_type: 'ดีเซล', liters: 15, vehicle_plate: '83-1000', occurred_at: '2026-08-28T03:00:00Z' },
    { transaction_type: 'receive', fuel_type: 'ดีเซล', liters: 40, occurred_at: '2026-08-27T01:00:00Z' },
  ];

  const summary = fuel.summarize(rows, new Date('2026-08-28T12:00:00'));
  assert.equal(summary.stock, 105);
  assert.equal(summary.receivedToday, 100);
  assert.equal(summary.dispensedToday, 35);
  assert.equal(summary.vehicleCount, 1);
});

test('diesel balance equals received liters minus dispensed liters', () => {
  const balances = fuel.balanceByType([
    { transaction_type: 'receive', fuel_type: 'ดีเซล', liters: 80 },
    { transaction_type: 'dispense', fuel_type: 'ดีเซล', liters: 25.5 },
  ]);

  assert.equal(balances['ดีเซล'], 54.5);
});

test('dispense validation requires plate, driver and sufficient stock', () => {
  const base = {
    transaction_type: 'dispense',
    fuel_type: 'ดีเซล',
    occurred_at: '2026-08-28T10:00',
    liters: 30,
    vehicle_plate: '83-1234',
    driver_name: 'สมชาย',
  };

  assert.equal(fuel.validateDraft(base, { ดีเซล: 40 }).ok, true);
  assert.equal(fuel.validateDraft({ ...base, vehicle_plate: '' }, { ดีเซล: 40 }).field, 'fuel-plate');
  assert.equal(fuel.validateDraft({ ...base, driver_name: '' }, { ดีเซล: 40 }).field, 'fuel-driver');
  assert.equal(fuel.validateDraft({ ...base, liters: 50 }, { ดีเซล: 40 }).field, 'fuel-liters');
});

test('history filtering supports month, type and driver or plate search', () => {
  const rows = [
    { id: 1, fuel_type: 'ดีเซล', occurred_at: '2026-08-20T10:00:00', vehicle_plate: '83-1234', driver_name: 'สมชาย' },
    { id: 2, fuel_type: 'ดีเซล', occurred_at: '2026-08-21T10:00:00', vehicle_plate: 'กข-999', driver_name: 'สมหญิง' },
    { id: 3, fuel_type: 'ดีเซล', occurred_at: '2026-07-20T10:00:00', vehicle_plate: '83-1234', driver_name: 'สมชาย' },
  ];

  const filtered = fuel.filterTransactions(rows, { type: 'ดีเซล', month: '2026-08', search: 'สมชาย' });
  assert.deepEqual(filtered.map(row => row.id), [1]);
});

test('fuel menu, page, assets, navigation and database migration are wired together', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'migrations', 'fuel_inventory.sql'), 'utf8');

  assert.match(index, /data-page="fuel"/);
  assert.match(index, /id="page-fuel"/);
  assert.match(index, /fuel-ledger-v2\.css/);
  assert.match(index, /app\.js\?v=13/);
  assert.match(index, /modules-v108-fuel-ledger\.js\?v=4/);
  assert.match(app, /case 'fuel':/);
  assert.match(migration, /create table if not exists public\.fuel_transactions/i);
  assert.match(migration, /create or replace function public\.sk_validate_fuel_stock/i);
  assert.match(migration, /create or replace function public\.sk_fuel_health/i);
  assert.match(migration, /fuel_transactions_diesel_only/i);
});
