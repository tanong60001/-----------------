const test = require('node:test');
const assert = require('node:assert/strict');
const PayrollCore = require('../payroll-core.js');

const augustWorkDates = ['01', '03', '04', '05', '06', '07', '08', '10', '11', '12', '13', '14', '15', '17'];

function attendance(statuses, deductions = {}) {
  return statuses.map((status, index) => ({
    date: `2026-08-${augustWorkDates[index]}`,
    status,
    deduction: deductions[status] || 0,
  }));
}

test('monthly paid leave accrues salary without a deduction', () => {
  const result = PayrollCore.calculateAttendancePay(
    { pay_type: 'รายเดือน', salary: 7500 },
    attendance([...Array(12).fill('มา'), 'ลา', 'ลา']),
    26,
  );

  assert.equal(result.workDays, 14);
  assert.equal(result.attendanceDeduction, 0);
  assert.equal(result.earn, 4038.46);
});

test('daily late deductions reduce the wage shown on payroll', () => {
  const result = PayrollCore.calculateAttendancePay(
    { pay_type: 'รายวัน', daily_wage: 350 },
    attendance(
      [...Array(8).fill('มา'), 'มาสาย', 'มาสาย', 'ลา', 'ลา', 'ขาด', 'ขาด'],
      { มาสาย: 18 },
    ),
    26,
  );

  assert.equal(result.workDays, 10);
  assert.equal(result.grossBeforeDeductions, 3500);
  assert.equal(result.attendanceDeduction, 36);
  assert.equal(result.earn, 3464);
});

test('new and legacy payroll notes count each deduction exactly once', () => {
  const current = PayrollCore.parseNoteDeductions(
    '(จ่ายทาง เงินสด) [ประกันสังคม ฿100, อื่นๆ ฿50] [payroll_ss=100] [payroll_other=50]'
      + ' | (จ่ายทางโอน) [payroll_ss=75]',
  );
  assert.deepEqual(current, { socialSecurity: 175, other: 50, unclassified: 0, total: 225 });

  const legacy = PayrollCore.parseNoteDeductions(
    'ประกันสังคม ฿100, อื่นๆ ฿50 [payroll_extra_deduct=150]',
  );
  assert.deepEqual(legacy, { socialSecurity: 100, other: 50, unclassified: 0, total: 150 });
});

test('received cash and every deduction reduce the same wage balance', () => {
  const totals = PayrollCore.paymentTotals([{
    net_paid: 1000,
    deduct_withdraw: 500,
    bonus: 0,
    note: '[payroll_ss=100] [payroll_other=50]',
  }]);

  assert.deepEqual(totals, {
    netPaid: 1000,
    debtDeducted: 500,
    socialSecurity: 100,
    other: 50,
    bonus: 0,
    accounted: 1650,
  });
});

test('a paid past month keeps its recorded wage snapshot after a rate increase', () => {
  const balance = PayrollCore.resolvePayrollBalance({
    monthStart: '2026-07-01',
    currentMonthStart: '2026-08-01',
    attendancePay: {
      workDays: 27,
      grossBeforeDeductions: 9990,
      attendanceDeduction: 0,
      earn: 9990,
    },
    paymentRows: [{
      working_days: 27,
      base_salary: 9720,
      deduct_absent: 0,
      net_paid: 2000,
      deduct_withdraw: 7720,
      bonus: 0,
      paid_date: '2026-07-31T10:00:00Z',
      note: '',
    }],
  });

  assert.equal(balance.useStoredSnapshot, true);
  assert.equal(balance.entitlement, 9720);
  assert.equal(balance.consumed, 9720);
  assert.equal(balance.remaining, 0);
});
