const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function columnNumber(value) {
  if (typeof value === 'number') return value;
  return String(value).toUpperCase().split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function columnLetter(value) {
  let number = Number(value);
  let output = '';
  while (number > 0) {
    number -= 1;
    output = String.fromCharCode(65 + (number % 26)) + output;
    number = Math.floor(number / 26);
  }
  return output;
}

class FakeCell { constructor() { this.value = null; } }

class FakeRow {
  constructor(sheet, number) { this.sheet = sheet; this.number = number; }
  getCell(column) { return this.sheet.getCell(this.number, column); }
  eachCell(options, callback) {
    for (let column = 1; column <= Math.max(1, this.sheet.maxColumn); column += 1) callback(this.getCell(column), column);
  }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.cells = new Map();
    this.rows = new Map();
    this.columns = new Map();
    this.maxRow = 0;
    this.maxColumn = 0;
    this.properties = {};
    this.pageSetup = {};
    this.headerFooter = {};
  }
  getCell(rowOrAddress, column) {
    let row = rowOrAddress;
    let col = column;
    if (typeof rowOrAddress === 'string') {
      const match = rowOrAddress.match(/^([A-Z]+)(\d+)$/i);
      col = columnNumber(match[1]);
      row = Number(match[2]);
    }
    col = columnNumber(col);
    this.maxRow = Math.max(this.maxRow, Number(row));
    this.maxColumn = Math.max(this.maxColumn, col);
    const key = `${row}:${col}`;
    if (!this.cells.has(key)) this.cells.set(key, new FakeCell());
    return this.cells.get(key);
  }
  getRow(number) {
    this.maxRow = Math.max(this.maxRow, number);
    if (!this.rows.has(number)) this.rows.set(number, new FakeRow(this, number));
    return this.rows.get(number);
  }
  addRow(values) {
    const row = this.getRow(this.maxRow + 1);
    (values || []).forEach((value, index) => { row.getCell(index + 1).value = value; });
    return row;
  }
  getColumn(value) {
    const number = columnNumber(value);
    if (!this.columns.has(number)) this.columns.set(number, { number, letter: columnLetter(number) });
    return this.columns.get(number);
  }
  mergeCells() {}
  get lastRow() { return this.getRow(this.maxRow); }
}

class FakeWorkbook {
  constructor() {
    this.worksheets = [];
    this.calcProperties = {};
    this.properties = {};
    this.xlsx = { writeBuffer: async () => new ArrayBuffer(0) };
  }
  addWorksheet(name) {
    const sheet = new FakeSheet(name);
    this.worksheets.push(sheet);
    return sheet;
  }
}

function loadReportFunctions(options = {}) {
  const context = {
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Date,
    Intl,
    Map,
    Set,
    MutationObserver: class { observe() {} },
    ExcelJS: { Workbook: FakeWorkbook },
    USER: options.user,
    toast: options.toast,
    openModal: options.openModal,
    document: {
      readyState: 'complete',
      body: {},
      querySelectorAll() { return options.buttons || []; },
    },
  };
  context.window = context;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'modules-v106-sales-history-excel.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'modules-v106-sales-history-excel.js' });
  return context;
}

function fakeButton() {
  const properties = new Map();
  return {
    dataset: {},
    style: {
      setProperty(name, value) { properties.set(name, value); },
      removeProperty(name) { properties.delete(name); },
      getPropertyValue(name) { return properties.get(name) || ''; },
    },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
  };
}

function sourceData(overrides = {}) {
  return {
    expenses: [], attendance: [], employees: [], payroll: [], purchases: [], advances: [], debtPayments: [],
    projectExpenses: [], milestones: [], cashTransactions: [], customers: [], payables: [], warnings: [],
    ...overrides,
  };
}

test('complete P&L subtracts COGS, operating expense, project cost and accrued labor without cash duplicates', () => {
  const api = loadReportFunctions();
  const start = new Date('2026-08-01T00:00:00+07:00');
  const end = new Date('2026-08-01T23:59:59+07:00');
  const bills = [
    { id: 'b1', bill_no: '001', total: 100, received: 100, change: 0, method: 'เงินสด', status: 'สำเร็จ', date: '2026-08-01T09:00:00+07:00' },
    { id: 'b2', bill_no: '002', total: 80, project_id: 'p1', method: 'โครงการ', status: 'สำเร็จ', date: '2026-08-01T10:00:00+07:00' },
  ];
  const items = [
    { id: 'i1', bill_id: 'b1', product_id: 'p-store', name: 'สินค้า A', qty: 2, price: 50, cost: 30, total: 100, unit: 'ชิ้น' },
    { id: 'i2', bill_id: 'b2', product_id: 'p-project', name: 'สินค้าโครงการ', qty: 2, price: 40, cost: 20, total: 80, unit: 'ชิ้น' },
  ];
  const products = [
    { id: 'p-store', name: 'สินค้า A', cost: 30, unit: 'ชิ้น' },
    { id: 'p-project', name: 'สินค้าโครงการ', cost: 20, unit: 'ชิ้น' },
  ];
  const financial = sourceData({
    expenses: [
      { id: 'e1', date: '2026-08-01T11:00:00+07:00', description: 'ค่าเช่า', category: 'ค่าใช้จ่ายทั่วไป', amount: 10, method: 'เงินสด' },
      { id: 'e2', date: '2026-08-01T12:00:00+07:00', description: 'ซื้อสินค้า', category: 'ซื้อสินค้า', amount: 50, method: 'เงินสด' },
      { id: 'e3', date: '2026-08-01T13:00:00+07:00', description: 'คืนเงินลูกค้า', category: 'คืนเงิน', amount: 5, method: 'เงินสด' },
    ],
    attendance: [{ employee_id: 'emp1', date: '2026-08-01', status: 'มา', deduction: 0, note: '' }],
    employees: [{ id: 'emp1', name: 'พนักงานหนึ่ง', daily_wage: 20 }],
    payroll: [{ id: 'pay1', employee_id: 'emp1', employee_name: 'พนักงานหนึ่ง', paid_date: '2026-08-01T17:00:00+07:00', net_paid: 20 }],
    purchases: [{ id: 'po1', date: '2026-08-01T12:00:00+07:00', total: 50, method: 'เงินสด', status: 'รับแล้ว', supplier: 'ร้านส่ง' }],
    advances: [{ id: 'a1', date: '2026-08-01T15:00:00+07:00', amount: 5, status: 'อนุมัติ' }],
    debtPayments: [{ id: 'd1', date: '2026-08-01T16:00:00+07:00', amount: 10, method: 'เงินสด' }],
    projectExpenses: [{ id: 'pe1', project_id: 'p1', bill_id: 'b2', type: 'goods', amount: 80, paid_at: '2026-08-01T10:00:00+07:00', description: 'เบิกสินค้าไปโครงการ' }],
    milestones: [{ id: 'm1', project_id: 'p1', amount: 200, billed_at: '2026-08-01T08:00:00+07:00', description: 'รับงวดงาน' }],
    cashTransactions: [{ id: 'tx1', direction: 'out', amount: 5, net_amount: 5, created_at: '2026-08-01T13:00:00+07:00', type: 'คืนเงินลูกค้า' }],
    customers: [{ id: 'c1', debt_amount: 20 }],
    payables: [{ id: 'cr1', balance: 30 }],
  });
  const report = api.v106PrepareSalesReport(bills, items, products);
  const result = api.v106PrepareFinancialReport({ bills, items, products, report, financial }, start, end);

  assert.equal(result.totals.storeRevenue, 100);
  assert.equal(result.totals.projectRevenue, 200);
  assert.equal(result.totals.totalRevenue, 300);
  assert.equal(result.totals.totalCogs, 60);
  assert.equal(result.totals.storeExpenses, 10);
  assert.equal(result.totals.projectExpenses, 40);
  assert.equal(result.totals.storeWages, 20);
  assert.equal(result.totals.totalOperatingExpenses, 70);
  assert.equal(result.totals.netProfit, 170);
  assert.equal(result.totals.cashIn, 310);
  assert.equal(result.totals.cashOut, 90);
  assert.equal(result.totals.netCash, 220);
  assert.equal(result.costRows.reduce((sum, row) => sum + row.netSales, 0), 100);
  assert.equal(result.expenseRows.reduce((sum, row) => sum + row.pnlImpact, 0), 70);
});

test('legacy wage expense is not double counted with payroll paid on the same day', () => {
  const api = loadReportFunctions();
  const start = new Date('2026-08-02T00:00:00+07:00');
  const end = new Date('2026-08-02T23:59:59+07:00');
  const bills = [{ id: 'b1', total: 100, received: 100, method: 'เงินสด', status: 'สำเร็จ', date: '2026-08-02T09:00:00+07:00' }];
  const items = [{ bill_id: 'b1', product_id: 'p1', name: 'สินค้า', qty: 1, price: 100, cost: 30, total: 100 }];
  const products = [{ id: 'p1', cost: 30 }];
  const financial = sourceData({
    expenses: [{ id: 'e1', date: '2026-08-02T17:00:00+07:00', description: 'ค่าแรงพนักงาน', category: 'ค่าแรง', amount: 50, method: 'เงินสด' }],
    payroll: [{ id: 'pay1', paid_date: '2026-08-02T17:00:00+07:00', net_paid: 50 }],
  });
  const report = api.v106PrepareSalesReport(bills, items, products);
  const result = api.v106PrepareFinancialReport({ bills, items, products, report, financial }, start, end);

  assert.equal(result.totals.storeWages, 50);
  assert.equal(result.totals.payrollPaid, 50);
  assert.equal(result.totals.cashOut, 50);
  assert.equal(result.totals.netProfit, 20);
});

test('workbook builder produces all ten audit-ready worksheets', async () => {
  const api = loadReportFunctions();
  const start = new Date('2026-08-03T00:00:00+07:00');
  const end = new Date('2026-08-03T23:59:59+07:00');
  const bills = [{ id: 'b1', bill_no: '003', total: 100, received: 100, method: 'เงินสด', status: 'สำเร็จ', date: '2026-08-03T09:00:00+07:00' }];
  const items = [{ bill_id: 'b1', product_id: 'p1', name: 'สินค้า', qty: 1, price: 100, cost: 30, total: 100, unit: 'ชิ้น' }];
  const products = [{ id: 'p1', name: 'สินค้า', cost: 30, unit: 'ชิ้น' }];
  const financial = sourceData();
  const report = api.v106PrepareSalesReport(bills, items, products);
  const data = { bills, items, products, shop: { shop_name: 'ร้านทดสอบ' }, financial, report };
  data.financialReport = api.v106PrepareFinancialReport(data, start, end);

  const workbook = await api.v106BuildSalesWorkbook(data, start, end);
  assert.deepEqual(Array.from(workbook.worksheets, sheet => sheet.name), [
    'งบกำไรขาดทุน',
    'ต้นทุนและกำไรรายสินค้า',
    'ค่าใช้จ่ายและค่าแรง',
    'กระแสเงินสด',
    'ตรวจสอบรายงาน',
    'สรุปรายงาน',
    'รายละเอียดบิล',
    'รายการสินค้าในบิล',
    'ขายดีตามจำนวน',
    'ขายดีตามยอดขาย',
  ]);
  assert.equal(workbook.worksheets[0].getCell('B22').value.formula, 'B14+B20');
  assert.equal(workbook.worksheets[0].getCell('B22').value.result, 70);
});

test('detailed financial export is hidden and blocked for non-admin users', () => {
  const button = fakeButton();
  const messages = [];
  let modalOpened = false;
  const api = loadReportFunctions({
    user: { role: 'staff' },
    buttons: [button],
    toast(message, type) { messages.push({ message, type }); },
    openModal() { modalOpened = true; },
  });

  assert.equal(button.disabled, true);
  assert.equal(button.style.getPropertyValue('display'), 'none');
  api.v106OpenSalesExport();
  assert.equal(modalOpened, false);
  assert.match(messages.at(-1).message, /เฉพาะผู้ดูแลระบบ/);
});

test('admin users can see and open the detailed financial export', () => {
  const button = fakeButton();
  let modalOpened = false;
  const api = loadReportFunctions({
    user: { role: 'admin' },
    buttons: [button],
    openModal() { modalOpened = true; },
  });

  assert.equal(button.disabled, false);
  assert.equal(button.onclick, 'v106OpenSalesExport()');
  api.v106OpenSalesExport();
  assert.equal(modalOpened, true);
});

test('financial export uses explicit column projections instead of broad table reads', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'modules-v106-sales-history-excel.js'), 'utf8');
  const projections = [
    'BILL_SELECT', 'ITEM_SELECT', 'PRODUCT_SELECT', 'SHOP_SELECT', 'EXPENSE_SELECT',
    'ATTENDANCE_SELECT', 'EMPLOYEE_SELECT', 'PAYROLL_SELECT', 'PURCHASE_SELECT',
    'ADVANCE_SELECT', 'DEBT_PAYMENT_SELECT', 'PROJECT_EXPENSE_SELECT',
    'PROJECT_MILESTONE_SELECT', 'CASH_TRANSACTION_SELECT', 'CUSTOMER_SELECT', 'PAYABLE_SELECT',
  ];

  projections.forEach(name => assert.match(source, new RegExp(`const ${name} = '[^']+';`)));
  assert.doesNotMatch(source, /\.select\(['"]\*['"]\)/);
  assert.doesNotMatch(source, /fetchPaged\([^\n]+,\s*['"]\*['"]/);
});
