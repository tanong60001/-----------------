const test = require('node:test');
const assert = require('node:assert/strict');

const dailyPayments = require('../modules-v107-home-daily-payments.js');

test('summarizes today bills by cash, transfer, outstanding, and order count', () => {
  const summary = dailyPayments.summarize([
    { total: 1200, method: 'เงินสด', status: 'สำเร็จ' },
    { total: 850, method: 'โอนเงิน', status: 'สำเร็จ' },
    { total: 500, method: 'ค้างชำระ', status: 'ค้างชำระ', received: 0 },
  ]);

  assert.deepEqual(summary, {
    sales: 2550,
    cash: 1200,
    transfer: 850,
    outstanding: 500,
    orders: 3,
  });
});

test('counts a partial cash deposit as cash and only the remainder as outstanding', () => {
  const summary = dailyPayments.summarize([
    {
      total: 1000,
      method: 'เงินสด',
      status: 'ค้างชำระ',
      deposit_amount: 300,
      received: 300,
      change: 0,
    },
  ]);

  assert.equal(summary.cash, 300);
  assert.equal(summary.outstanding, 700);
  assert.equal(summary.sales, 1000);
});

test('uses the current remaining amount and effective returned total', () => {
  const summary = dailyPayments.summarize([
    {
      total: 1000,
      method: 'โอนเงิน',
      status: 'ค้างชำระ',
      deposit_amount: 200,
      return_info: JSON.stringify({ new_total: 900, remaining_amount: 250, paid_amount: 650 }),
    },
    { total: 400, method: 'เงินสด', status: 'ยกเลิก' },
    { total: 300, method: 'เงินสด', status: 'คืนสินค้า' },
  ]);

  assert.deepEqual(summary, {
    sales: 900,
    cash: 0,
    transfer: 650,
    outstanding: 250,
    orders: 1,
  });
});
