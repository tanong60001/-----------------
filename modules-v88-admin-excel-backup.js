(function () {
  'use strict';

  const FILE_TAG = 'SK-POS-Accounting-Report';
  const RANGE_SPECS = [
    { key: 'sales', table: 'บิลขาย', sheet: 'บิลขาย', dateField: 'date', kind: 'time' },
    { key: 'expenses', table: 'รายจ่าย', sheet: 'รายจ่ายร้าน', dateField: 'date', kind: 'time' },
    { key: 'purchases', table: 'purchase_order', sheet: 'ใบซื้อสินค้า', dateField: 'date', kind: 'time' },
    { key: 'quotations', table: 'ใบเสนอราคา', sheet: 'ใบเสนอราคา', dateField: 'date', kind: 'time' },
    { key: 'debtPayments', table: 'ชำระหนี้', sheet: 'รับชำระหนี้', dateField: 'date', kind: 'time' },
    { key: 'cashSessions', table: 'cash_session', sheet: 'รอบลิ้นชัก', dateField: 'opened_at', kind: 'time' },
    { key: 'cashTransactions', table: 'cash_transaction', sheet: 'เงินสดลิ้นชัก', dateField: 'created_at', kind: 'time' },
    { key: 'stockMoves', table: 'stock_movement', sheet: 'เคลื่อนไหวสต็อก', dateField: 'created_at', kind: 'time' },
    { key: 'attendance', table: 'เช็คชื่อ', sheet: 'เช็คชื่อ', dateField: 'date', kind: 'date' },
    { key: 'advances', table: 'เบิกเงิน', sheet: 'เบิกเงินพนักงาน', dateField: 'date', kind: 'time' },
    { key: 'payroll', table: 'จ่ายเงินเดือน', sheet: 'จ่ายเงินเดือน', dateField: 'paid_date', kind: 'time' },
    { key: 'projectExpenses', table: 'รายจ่ายโครงการ', sheet: 'รายจ่ายโครงการ', dateField: 'created_at', kind: 'time' },
    { key: 'milestones', table: 'งวดงาน', sheet: 'งวดงาน', dateField: 'billed_at', kind: 'time' },
    { key: 'logs', table: 'log_กิจกรรม', sheet: 'บันทึกกิจกรรม', dateField: 'time', kind: 'time' },
  ];
  const SNAPSHOT_SPECS = [
    { key: 'products', table: 'สินค้า', sheet: 'สินค้า' },
    { key: 'productUnits', table: 'product_units', sheet: 'หน่วยสินค้า' },
    { key: 'recipes', table: 'สูตรสินค้า', sheet: 'สูตรสินค้า' },
    { key: 'categories', table: 'categories', sheet: 'หมวดสินค้า' },
    { key: 'customers', table: 'customer', sheet: 'ลูกค้า' },
    { key: 'employees', table: 'พนักงาน', sheet: 'พนักงาน' },
    { key: 'suppliers', table: 'ซัพพลายเออร์', sheet: 'ซัพพลายเออร์' },
    { key: 'payables', table: 'เจ้าหนี้', sheet: 'เจ้าหนี้' },
    { key: 'projects', table: 'โครงการ', sheet: 'โครงการ' },
    { key: 'users', table: 'ผู้ใช้งาน', sheet: 'ผู้ใช้งาน' },
    { key: 'permissions', table: 'สิทธิ์การเข้าถึง', sheet: 'สิทธิ์เข้าถึง' },
    { key: 'shop', table: 'ตั้งค่าร้านค้า', sheet: 'ตั้งค่าร้าน' },
  ];
  const LINKED_SPECS = [
    { key: 'saleItems', table: 'รายการในบิล', sheet: 'รายการบิลขาย', parentKey: 'sales', idKey: 'bill_id' },
    { key: 'purchaseItems', table: 'purchase_item', sheet: 'รายการใบซื้อ', parentKey: 'purchases', idKey: 'order_id' },
    { key: 'quotationItems', table: 'รายการใบเสนอราคา', sheet: 'รายการใบเสนอราคา', parentKey: 'quotations', idKey: 'quotation_id' },
  ];
  const CORE_COLUMNS = {
    'บิลขาย': ['bill_no', 'date', 'customer_name', 'method', 'status', 'total'],
    'รายการบิลขาย': ['bill_id', 'name', 'qty', 'unit', 'price', 'cost', 'total'],
    'รายจ่ายร้าน': ['date', 'description', 'category', 'method', 'amount', 'staff_name'],
    'สินค้า': ['name', 'barcode', 'category', 'price', 'cost', 'stock', 'unit'],
    'ลูกค้า': ['name', 'phone', 'address', 'total_purchase', 'visit_count', 'debt_amount'],
    'พนักงาน': ['name', 'lastname', 'phone', 'position', 'pay_type', 'daily_wage', 'salary', 'status'],
  };
  const FIELD_LABELS = {
    id: 'รหัส', created_at: 'วันที่สร้าง', updated_at: 'วันที่แก้ไข', date: 'วันเวลา', time: 'วันเวลา',
    opened_at: 'เวลาเปิด', closed_at: 'เวลาปิด', paid_at: 'เวลาจ่าย', paid_date: 'วันที่จ่าย',
    billed_at: 'วันที่เรียกเก็บ', due_date: 'ครบกำหนด', bill_no: 'เลขบิล', bill_id: 'รหัสบิล',
    product_id: 'รหัสสินค้า', customer_id: 'รหัสลูกค้า', employee_id: 'รหัสพนักงาน',
    supplier_id: 'รหัสผู้ขาย', project_id: 'รหัสโครงการ', quotation_id: 'รหัสใบเสนอราคา',
    purchase_order_id: 'รหัสใบซื้อ', order_id: 'รหัสใบซื้อ', session_id: 'รหัสรอบลิ้นชัก',
    ref_id: 'รหัสอ้างอิง', ref_table: 'ตารางอ้างอิง', name: 'ชื่อ', lastname: 'นามสกุล',
    customer_name: 'ชื่อลูกค้า', product_name: 'ชื่อสินค้า', username: 'ผู้ใช้งาน',
    staff_name: 'ผู้บันทึก', approved_by: 'ผู้อนุมัติ', phone: 'เบอร์โทร', email: 'อีเมล',
    address: 'ที่อยู่', barcode: 'บาร์โค้ด', category: 'หมวด', type: 'ประเภท',
    direction: 'ทิศทาง', method: 'วิธีชำระ', status: 'สถานะ', description: 'รายละเอียด',
    details: 'รายละเอียด', note: 'หมายเหตุ', notes: 'หมายเหตุ', reason: 'เหตุผล',
    amount: 'จำนวนเงิน', total: 'ยอดรวม', received: 'รับเงิน', change: 'เงินทอน',
    price: 'ราคาขาย', cost: 'ต้นทุน', cost_per_unit: 'ต้นทุนต่อหน่วย', stock: 'สต็อก',
    stock_before: 'สต็อกก่อน', stock_after: 'สต็อกหลัง', qty: 'จำนวน', quantity: 'จำนวน',
    unit: 'หน่วย', unit_name: 'ชื่อหน่วย', conv_rate: 'อัตราแปลง', total_purchase: 'ยอดซื้อสะสม',
    visit_count: 'จำนวนครั้งซื้อ', debt_amount: 'หนี้คงค้าง', daily_wage: 'ค่าแรงรายวัน',
    salary: 'เงินเดือน', net_paid: 'จ่ายสุทธิ', deduction: 'หักเงิน', deduct_withdraw: 'หักเบิก',
    position: 'ตำแหน่ง', pay_type: 'รูปแบบค่าจ้าง', month: 'เดือน', budget: 'งบประมาณ',
    balance: 'ยอดคงเหลือ', paid_amount: 'จ่ายแล้ว',
  };
  const UI = {
    menuTitle: '\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e1a\u0e31\u0e0d\u0e0a\u0e35 Excel',
    menuDesc: '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e0a\u0e48\u0e27\u0e07\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48 \u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e35\u0e1e\u0e2d\u0e23\u0e4c\u0e17\u0e23\u0e32\u0e22\u0e23\u0e31\u0e1a \u0e23\u0e32\u0e22\u0e08\u0e48\u0e32\u0e22 \u0e42\u0e04\u0e23\u0e07\u0e01\u0e32\u0e23 \u0e41\u0e25\u0e30\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19',
    sectionTitle: '\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e1a\u0e31\u0e0d\u0e0a\u0e35 Excel',
    back: '\u0e01\u0e25\u0e31\u0e1a\u0e40\u0e21\u0e19\u0e39\u0e2b\u0e25\u0e31\u0e01',
    start: '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19',
    end: '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e2a\u0e34\u0e49\u0e19\u0e2a\u0e38\u0e14',
    export: '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23 Excel',
    denied: '\u0e40\u0e21\u0e19\u0e39\u0e19\u0e35\u0e49\u0e43\u0e0a\u0e49\u0e44\u0e14\u0e49\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e1c\u0e39\u0e49\u0e14\u0e39\u0e41\u0e25\u0e23\u0e30\u0e1a\u0e1a',
    note: '\u0e44\u0e1f\u0e25\u0e4c\u0e19\u0e35\u0e49\u0e40\u0e19\u0e49\u0e19\u0e17\u0e33\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e1a\u0e31\u0e0d\u0e0a\u0e35 \u0e08\u0e30\u0e2a\u0e23\u0e38\u0e1b\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e40\u0e07\u0e34\u0e19\u0e40\u0e02\u0e49\u0e32 \u0e40\u0e07\u0e34\u0e19\u0e2d\u0e2d\u0e01 \u0e42\u0e04\u0e23\u0e07\u0e01\u0e32\u0e23 \u0e41\u0e25\u0e30\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19 \u0e42\u0e14\u0e22\u0e43\u0e0a\u0e49\u0e0a\u0e37\u0e48\u0e2d\u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49\u0e41\u0e17\u0e19\u0e23\u0e2b\u0e31\u0e2a\u0e22\u0e32\u0e27 \u0e41\u0e25\u0e30\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e1e\u0e34\u0e21\u0e1e\u0e4c A4',
  };

  function notify(message, type) {
    if (typeof toast === 'function') toast(message, type || 'info');
    else console.log(message);
  }

  function currentUser() {
    try {
      if (typeof USER !== 'undefined' && USER) return USER;
    } catch (_) {}
    return window.USER || null;
  }

  function localDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function defaultRange() {
    const now = new Date();
    return { start: localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), end: localDateKey(now) };
  }

  function rangeValue(range, kind, edge) {
    if (kind === 'date') return edge === 'start' ? range.start : range.end;
    return edge === 'start' ? `${range.start}T00:00:00` : `${range.end}T23:59:59.999`;
  }

  async function getRows(table, buildQuery) {
    if (typeof fetchAllRows === 'function') return fetchAllRows(table, '*', buildQuery || (query => query));
    const rows = [];
    for (let from = 0; ; from += 1000) {
      let query = db.from(table).select('*').range(from, from + 999);
      query = buildQuery ? buildQuery(query) : query;
      const result = await query;
      if (result.error) throw result.error;
      rows.push(...(result.data || []));
      if (!result.data || result.data.length < 1000) break;
    }
    return rows;
  }

  async function loadSpec(spec, range) {
    try {
      const rows = await getRows(spec.table, query => !spec.dateField ? query : query
        .gte(spec.dateField, rangeValue(range, spec.kind, 'start'))
        .lte(spec.dateField, rangeValue(range, spec.kind, 'end'))
        .order(spec.dateField, { ascending: true }));
      return { ...spec, rows, error: '' };
    } catch (error) {
      console.warn('[v88] table export failed:', spec.table, error);
      return { ...spec, rows: [], error: error?.message || String(error) };
    }
  }

  function chunks(values, size) {
    const groups = [];
    for (let index = 0; index < values.length; index += size) groups.push(values.slice(index, index + size));
    return groups;
  }

  async function loadLinkedSpec(spec, loaded) {
    const ids = (loaded[spec.parentKey]?.rows || []).map(row => row.id).filter(Boolean);
    if (!ids.length) return { ...spec, rows: [], error: '' };
    try {
      const parts = await Promise.all(chunks(ids, 180).map(group => getRows(spec.table, query => query.in(spec.idKey, group))));
      return { ...spec, rows: parts.flat(), error: '' };
    } catch (error) {
      console.warn('[v88] linked export failed:', spec.table, error);
      return { ...spec, rows: [], error: error?.message || String(error) };
    }
  }

  function fieldLabel(key) {
    return FIELD_LABELS[key] || String(key || '').replace(/_/g, ' ').trim();
  }

  function collectKeys(sheetName, rows) {
    const seen = new Set();
    const keys = [];
    [...(CORE_COLUMNS[sheetName] || []), ...rows.flatMap(row => Object.keys(row || {}))].forEach(key => {
      if (!seen.has(key)) { seen.add(key); keys.push(key); }
    });
    return keys.length ? keys : ['รายการ'];
  }

  function cellValue(value) {
    if (value == null) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? value : '';
    if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function money(row, key) {
    const number = Number(row?.[key] || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function setupSheet(sheet, columns, range, title) {
    const lastColumn = Math.max(1, columns.length);
    sheet.mergeCells(1, 1, 1, lastColumn);
    sheet.getCell(1, 1).value = `${FILE_TAG} - ${title}`;
    sheet.getCell(1, 1).font = { name: 'Arial', bold: true, size: 15, color: { argb: 'FF0F172A' } };
    sheet.mergeCells(2, 1, 2, lastColumn);
    sheet.getCell(2, 1).value = `\u0e0a\u0e48\u0e27\u0e07\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48: ${range.start} \u0e16\u0e36\u0e07 ${range.end}`;
    sheet.mergeCells(3, 1, 3, lastColumn);
    sheet.getCell(3, 1).value = `\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e44\u0e1f\u0e25\u0e4c: ${new Date().toLocaleString('th-TH')} \u0e42\u0e14\u0e22 ${currentUser()?.username || 'admin'}`;
    sheet.views = [{ state: 'frozen', ySplit: 5 }];
    sheet.pageSetup = { paperSize: 9, orientation: columns.length > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.pageSetup.printTitlesRow = '1:5';
    sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
  }

  function styleHeader(row) {
    row.eachCell(cell => {
      cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  }

  function styleBody(sheet, headerRow, lastRow, lastColumn) {
    for (let rowNumber = headerRow + 1; rowNumber <= lastRow; rowNumber += 1) {
      sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, cell => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        if (typeof cell.value === 'number') { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'top' }; }
      });
    }
    sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: Math.max(headerRow, lastRow), column: lastColumn } };
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(lastColumn).letter}${Math.max(headerRow, lastRow)}`;
  }

  function addDataSheet(workbook, spec, range) {
    const sheet = workbook.addWorksheet(spec.sheet);
    const keys = collectKeys(spec.sheet, spec.rows);
    const labels = keys.map(fieldLabel);
    setupSheet(sheet, keys, range, spec.sheet);
    sheet.addRow([]);
    styleHeader(sheet.addRow(labels));
    if (spec.rows.length) spec.rows.forEach(row => sheet.addRow(keys.map(key => cellValue(row?.[key]))));
    else sheet.addRow([spec.error ? `โหลดข้อมูลไม่สำเร็จ: ${spec.error}` : 'ไม่มีรายการในช่วงวันที่นี้']);
    keys.forEach((key, index) => {
      let width = labels[index].length + 2;
      spec.rows.slice(0, 220).forEach(row => { width = Math.max(width, String(cellValue(row?.[key])).length + 2); });
      sheet.getColumn(index + 1).width = Math.min(28, Math.max(10, width));
    });
    styleBody(sheet, 5, sheet.rowCount, keys.length);
    return { sheet: spec.sheet, table: spec.table, count: spec.rows.length, error: spec.error };
  }

  function addSummary(workbook, range, loaded, summaries) {
    const activeSales = (loaded.sales?.rows || []).filter(row => !/ยกเลิก|คืนสินค้า/i.test(String(row?.status || '')));
    const sum = (key, field) => (loaded[key]?.rows || []).reduce((total, row) => total + money(row, field), 0);
    const sheet = workbook.addWorksheet('สรุปรายงาน');
    setupSheet(sheet, ['หัวข้อ', 'ค่า'], range, 'สรุปรายงาน');
    sheet.addRow([]);
    styleHeader(sheet.addRow(['หัวข้อ', 'ค่า']));
    [['ช่วงวันที่เริ่ม', range.start], ['ช่วงวันที่สิ้นสุด', range.end], ['ผู้สร้างไฟล์', currentUser()?.username || 'admin'],
      ['จำนวนบิลขาย', loaded.sales?.rows?.length || 0], ['ยอดบิลขายที่ไม่ยกเลิก', activeSales.reduce((total, row) => total + money(row, 'total'), 0)],
      ['จำนวนรายการในบิลขาย', loaded.saleItems?.rows?.length || 0], ['รายจ่ายร้าน', sum('expenses', 'amount')],
      ['ยอดใบซื้อสินค้า', sum('purchases', 'total')], ['รับชำระหนี้', sum('debtPayments', 'amount')],
      ['เบิกเงินพนักงาน', sum('advances', 'amount')], ['จ่ายเงินเดือนสุทธิ', sum('payroll', 'net_paid')],
      ['ชีทข้อมูลที่สร้าง', summaries.length], ['ชีทที่โหลดไม่สำเร็จ', summaries.filter(item => item.error).length]].forEach(row => sheet.addRow(row));
    sheet.getColumn(1).width = 28; sheet.getColumn(2).width = 24; styleBody(sheet, 5, sheet.rowCount, 2);
    const index = workbook.addWorksheet('สารบัญชีท');
    setupSheet(index, ['ชีท', 'ตาราง', 'จำนวน', 'สถานะ'], range, 'สารบัญชีท');
    index.addRow([]); styleHeader(index.addRow(['ชื่อชีท', 'ตารางข้อมูล', 'จำนวนรายการ', 'สถานะ']));
    summaries.forEach(item => index.addRow([item.sheet, item.table, item.count, item.error ? `โหลดไม่สำเร็จ: ${item.error}` : 'พร้อมใช้งาน']));
    [20, 24, 14, 44].forEach((width, column) => { index.getColumn(column + 1).width = width; });
    styleBody(index, 5, index.rowCount, 4);
  }

  function byId(rows, nameBuilder) {
    const map = new Map();
    (rows || []).forEach(row => {
      if (row?.id) map.set(String(row.id), nameBuilder(row));
    });
    return map;
  }

  function rowDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 19) : date.toLocaleString('th-TH');
  }

  function label(value, fallback) {
    return String(value || '').trim() || fallback || '-';
  }

  function addReportSheet(workbook, range, title, columns, rows) {
    const sheet = workbook.addWorksheet(title);
    setupSheet(sheet, columns, range, title);
    sheet.addRow([]);
    styleHeader(sheet.addRow(columns));
    if (rows.length) rows.forEach(row => sheet.addRow(row));
    else sheet.addRow(['No records']);
    columns.forEach((column, index) => {
      let width = String(column).length + 2;
      rows.slice(0, 240).forEach(row => { width = Math.max(width, String(cellValue(row[index])).length + 2); });
      sheet.getColumn(index + 1).width = Math.min(30, Math.max(11, width));
    });
    styleBody(sheet, 5, sheet.rowCount, columns.length);
  }

  async function reportRows(table, range, dateField, kind, extraQuery) {
    return getRows(table, query => {
      let next = query.gte(dateField, rangeValue(range, kind || 'time', 'start')).lte(dateField, rangeValue(range, kind || 'time', 'end'));
      next = extraQuery ? extraQuery(next) : next;
      return next.order(dateField, { ascending: true });
    });
  }

  async function loadAccountingReport(range) {
    const table = Object.fromEntries([...RANGE_SPECS, ...SNAPSHOT_SPECS].map(spec => [spec.key, spec.table]));
    const results = await Promise.all([
      reportRows(table.sales, range, 'date', 'time'),
      reportRows(table.expenses, range, 'date', 'time'),
      reportRows(table.purchases, range, 'date', 'time'),
      reportRows(table.debtPayments, range, 'date', 'time'),
      reportRows(table.advances, range, 'date', 'time'),
      reportRows(table.payroll, range, 'paid_date', 'time'),
      reportRows(table.projectExpenses, range, 'paid_at', 'time', query => query.not('paid_at', 'is', null)),
      reportRows(table.milestones, range, 'billed_at', 'time', query => query.eq('status', 'billed')),
      getRows(table.customers),
      getRows(table.employees),
      getRows(table.projects),
    ]);
    const [sales, expenses, purchases, debtPayments, advances, payroll, projectExpenses, milestones, customers, employees, projects] = results;
    return {
      sales, expenses, purchases, debtPayments, advances, payroll, projectExpenses, milestones,
      customerName: byId(customers, row => label(row.name, 'Customer')),
      employeeName: byId(employees, row => label([row.name, row.lastname].filter(Boolean).join(' '), 'Employee')),
      projectName: byId(projects, row => label(row.name, 'Project')),
    };
  }

  function isCanceled(value) {
    return /cancel|void|\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01|\u0e04\u0e37\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32/i.test(String(value || ''));
  }

  function accountSheets(data) {
    const income = [];
    data.sales.filter(row => !isCanceled(row.status)).forEach(row => income.push([
      rowDate(row.date), 'Sales', label(row.bill_no, '-'), label(row.customer_name, 'General customer'),
      label(row.method, '-'), label(row.status, '-'), money(row, 'total'), label(row.note, ''),
    ]));
    data.debtPayments.forEach(row => income.push([
      rowDate(row.date), 'Debt payment', '-', label(data.customerName.get(String(row.customer_id)), 'Customer'),
      label(row.method, '-'), label(row.status, 'Received'), money(row, 'amount'), label(row.note, ''),
    ]));
    data.milestones.forEach(row => income.push([
      rowDate(row.billed_at), 'Project milestone', label(row.milestone_no, '-'),
      label(data.projectName.get(String(row.project_id)), 'Project'), label(row.method, '-'),
      label(row.status, 'Billed'), money(row, 'amount'), label(row.note || row.description, ''),
    ]));

    const expense = [];
    data.expenses.filter(row => !isCanceled(row.status)).forEach(row => expense.push([
      rowDate(row.date), 'Store expense', label(row.description, '-'), label(row.category, '-'),
      label(row.method, '-'), money(row, 'amount'), label(row.staff_name, ''), label(row.note, ''),
    ]));
    data.purchases.filter(row => !isCanceled(row.status)).forEach(row => expense.push([
      rowDate(row.date), 'Inventory purchase', label(row.supplier, '-'), 'Purchase order',
      label(row.method, '-'), money(row, 'total'), label(row.staff_name, ''), label(row.note, ''),
    ]));
    data.projectExpenses.forEach(row => expense.push([
      rowDate(row.paid_at || row.created_at), 'Project expense',
      label(data.projectName.get(String(row.project_id)), 'Project'), label(row.category || row.type, '-'),
      label(row.method, '-'), money(row, 'amount'), label(row.staff_name, ''), label(row.description || row.notes, ''),
    ]));
    data.advances.filter(row => !isCanceled(row.status)).forEach(row => expense.push([
      rowDate(row.date), 'Employee advance', label(data.employeeName.get(String(row.employee_id)), 'Employee'),
      'Staff', label(row.method, '-'), money(row, 'amount'), label(row.approved_by, ''), label(row.reason, ''),
    ]));
    data.payroll.filter(row => !isCanceled(row.status)).forEach(row => expense.push([
      rowDate(row.paid_date), 'Payroll', label(data.employeeName.get(String(row.employee_id)), 'Employee'),
      label(row.month, 'Staff'), label(row.method, '-'), money(row, 'net_paid'),
      label(row.paid_by || row.staff_name, ''), label(row.note, ''),
    ]));

    const project = [];
    data.milestones.forEach(row => project.push([
      rowDate(row.billed_at), label(data.projectName.get(String(row.project_id)), 'Project'),
      'Income', label(row.title || row.description, 'Milestone'), money(row, 'amount'), label(row.status, 'Billed'),
    ]));
    data.projectExpenses.forEach(row => project.push([
      rowDate(row.paid_at || row.created_at), label(data.projectName.get(String(row.project_id)), 'Project'),
      'Expense', label(row.description || row.category, 'Project expense'), -money(row, 'amount'), label(row.status, 'Paid'),
    ]));

    const employee = [];
    data.advances.forEach(row => employee.push([
      rowDate(row.date), label(data.employeeName.get(String(row.employee_id)), 'Employee'),
      'Advance', money(row, 'amount'), label(row.status, '-'), label(row.reason, ''),
    ]));
    data.payroll.forEach(row => employee.push([
      rowDate(row.paid_date), label(data.employeeName.get(String(row.employee_id)), 'Employee'),
      'Payroll', money(row, 'net_paid'), label(row.status, 'Paid'), label(row.note, ''),
    ]));
    return { income, expense, project, employee };
  }

  function addAccountingSummary(workbook, range, sheets) {
    const incomeTotal = sheets.income.reduce((sum, row) => sum + money({ value: row[6] }, 'value'), 0);
    const expenseTotal = sheets.expense.reduce((sum, row) => sum + money({ value: row[5] }, 'value'), 0);
    addReportSheet(workbook, range, 'Summary', ['Item', 'Amount'], [
      ['Income total', incomeTotal],
      ['Expense total', expenseTotal],
      ['Net cash report', incomeTotal - expenseTotal],
      ['Income rows', sheets.income.length],
      ['Expense rows', sheets.expense.length],
      ['Project rows', sheets.project.length],
      ['Employee rows', sheets.employee.length],
    ]);
  }

  async function buildWorkbook(range) {
    const data = await loadAccountingReport(range);
    const sheets = accountSheets(data);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = FILE_TAG; workbook.created = new Date();
    addAccountingSummary(workbook, range, sheets);
    addReportSheet(workbook, range, 'Income', ['Date', 'Type', 'Reference', 'Customer or Project', 'Method', 'Status', 'Amount', 'Note'], sheets.income);
    addReportSheet(workbook, range, 'Expense', ['Date', 'Type', 'Description', 'Category', 'Method', 'Amount', 'Recorded by', 'Note'], sheets.expense);
    addReportSheet(workbook, range, 'Projects', ['Date', 'Project', 'Flow', 'Description', 'Amount', 'Status'], sheets.project);
    addReportSheet(workbook, range, 'Employees', ['Date', 'Employee', 'Type', 'Amount', 'Status', 'Note'], sheets.employee);
    return workbook;
  }

  async function saveWorkbook() {
    const start = document.getElementById('v88-excel-start')?.value;
    const end = document.getElementById('v88-excel-end')?.value;
    const button = document.getElementById('v88-excel-export');
    if (!start || !end) return notify('กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด', 'warning');
    if (start > end) return notify('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด', 'warning');
    if (!window.ExcelJS) return notify('โมดูลสร้าง Excel ยังโหลดไม่พร้อม กรุณารีเฟรชหน้าแล้วลองอีกครั้ง', 'error');
    if (button) { button.disabled = true; button.innerHTML = '<i class="material-icons-round">sync</i> กำลังสร้าง Excel...'; }
    try {
      const buffer = await (await buildWorkbook({ start, end })).xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a'); link.href = url; link.download = `${FILE_TAG}_${start}_to_${end}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify('สร้างเอกสาร Excel เรียบร้อย', 'success');
    } catch (error) {
      console.error('[v88] excel export:', error); notify(`สร้าง Excel ไม่สำเร็จ: ${error?.message || error}`, 'error');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = '<i class="material-icons-round">description</i> สร้างเอกสาร Excel'; }
    }
  }

  function installStyle() {
    if (document.getElementById('v88-admin-excel-style')) return;
    const style = document.createElement('style'); style.id = 'v88-admin-excel-style';
    style.textContent = `.v88-excel{max-width:1180px;margin:0 auto 30px;color:#0f172a}.v88-excel-panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,.07)}.v88-excel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.v88-excel-title{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:900}.v88-excel-body{padding:20px}.v88-excel-grid{display:grid;grid-template-columns:repeat(2,minmax(0,220px)) minmax(220px,1fr);gap:12px;align-items:end}.v88-excel-note{margin-top:16px;padding:14px;border:1px solid #dbeafe;border-radius:12px;background:#eff6ff;color:#334155;font-size:13px;line-height:1.65}.v88-excel-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}.v88-excel-list span{display:flex;gap:7px;align-items:center;min-height:36px;padding:8px 10px;border-radius:9px;background:#f8fafc;border:1px solid #eef2f7;font-size:12px;font-weight:800;color:#475569}.v88-excel-menu .v36-admin-menu-icon{background:#dcfce7!important;color:#15803d!important}@media(max-width:760px){.v88-excel-grid,.v88-excel-list{grid-template-columns:1fr}.v88-excel-head{align-items:flex-start;flex-direction:column}.v88-excel-body{padding:16px}}`;
    document.head.appendChild(style);
  }

  function renderSection() {
    if (currentUser()?.role !== 'admin') return notify(UI.denied, 'error');
    const page = document.getElementById('page-admin'); const range = defaultRange(); if (!page) return;
    page.innerHTML = `<div class="v88-excel"><div class="v88-excel-panel"><div class="v88-excel-head"><div class="v88-excel-title"><i class="material-icons-round">description</i> ${UI.sectionTitle}</div><button type="button" class="btn btn-ghost" onclick="renderAdmin()"><i class="material-icons-round">arrow_back</i> ${UI.back}</button></div><div class="v88-excel-body"><div class="v88-excel-grid"><div class="form-group" style="margin:0"><label class="form-label">${UI.start}</label><input type="date" class="form-input" id="v88-excel-start" value="${range.start}"></div><div class="form-group" style="margin:0"><label class="form-label">${UI.end}</label><input type="date" class="form-input" id="v88-excel-end" value="${range.end}"></div><button type="button" class="btn btn-primary" id="v88-excel-export"><i class="material-icons-round">description</i> ${UI.export}</button></div><div class="v88-excel-note">${UI.note}</div><div class="v88-excel-list"><span><i class="material-icons-round">receipt_long</i> Income report</span><span><i class="material-icons-round">payments</i> Expense report</span><span><i class="material-icons-round">business_center</i> Project report</span><span><i class="material-icons-round">print</i> A4 print setup</span></div></div></div></div>`;
    document.getElementById('v88-excel-export')?.addEventListener('click', saveWorkbook);
  }

  function injectCard() {
    const grid = document.querySelector('#page-admin .v36-admin-menu-grid');
    if (!grid || grid.querySelector('.v88-excel-menu')) return;
    grid.insertAdjacentHTML('beforeend', `<button type="button" class="v36-admin-menu-card v88-excel-menu" onclick="v88OpenExcelBackup()"><span class="v36-admin-menu-icon"><i class="material-icons-round">description</i></span><span class="v36-admin-menu-text"><span class="v36-admin-menu-title">${UI.menuTitle}</span><span class="v36-admin-menu-desc">${UI.menuDesc}</span></span><i class="material-icons-round v36-admin-menu-arrow">chevron_right</i></button>`);
  }

  function patchAdmin() {
    if (typeof window.renderAdmin !== 'function') return false;
    if (!window.renderAdmin.__v88ExcelBackup) {
      const original = window.renderAdmin;
      const wrapped = async function () { const result = await original.apply(this, arguments); injectCard(); return result; };
      wrapped.__v88ExcelBackup = true; window.renderAdmin = wrapped; try { renderAdmin = wrapped; } catch (_) {}
    }
    injectCard(); return true;
  }

  function boot() {
    installStyle(); window.v88OpenExcelBackup = renderSection; let attempts = 0;
    const timer = setInterval(() => { attempts += 1; if (patchAdmin() || attempts > 40) clearInterval(timer); }, 250);
    new MutationObserver(injectCard).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
