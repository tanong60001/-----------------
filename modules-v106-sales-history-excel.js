(function () {
  'use strict';

  const VERSION = 'v106';
  const BILL_TABLE = 'บิลขาย';
  const ITEM_TABLE = 'รายการในบิล';
  const PRODUCT_TABLE = 'สินค้า';
  const SHOP_TABLE = 'ตั้งค่าร้านค้า';
  const EXPENSE_TABLE = 'รายจ่าย';
  const ATTENDANCE_TABLE = 'เช็คชื่อ';
  const EMPLOYEE_TABLE = 'พนักงาน';
  const PAYROLL_TABLE = 'จ่ายเงินเดือน';
  const PURCHASE_TABLE = 'purchase_order';
  const ADVANCE_TABLE = 'เบิกเงิน';
  const DEBT_PAYMENT_TABLE = 'ชำระหนี้';
  const PROJECT_EXPENSE_TABLE = 'รายจ่ายโครงการ';
  const PROJECT_MILESTONE_TABLE = 'งวดงาน';
  const CASH_TRANSACTION_TABLE = 'cash_transaction';
  const CUSTOMER_TABLE = 'customer';
  const PAYABLE_TABLE = 'เจ้าหนี้';
  const BILL_SELECT = 'id,bill_no,date,customer_name,customer_phone,delivery_phone,delivery_address,customer_address,address,method,discount,total,return_info,deposit_amount,received,change,delivery_mode,delivery_status,staff_name,status,note,cancel_reason,project_id';
  const ITEM_SELECT = 'id,bill_id,product_id,name,qty,price,cost,total,unit,created_at';
  const PRODUCT_SELECT = 'id,name,barcode,category,unit,cost';
  const SHOP_SELECT = 'shop_name';
  const EXPENSE_SELECT = 'id,date,description,category,amount,method,note';
  const ATTENDANCE_SELECT = 'employee_id,status,date,deduction,note';
  const EMPLOYEE_SELECT = 'id,name,daily_wage';
  const PAYROLL_SELECT = 'id,employee_id,net_paid,paid_date,note';
  const PURCHASE_SELECT = 'id,date,total,method,status,supplier';
  const ADVANCE_SELECT = 'id,date,amount,status';
  const DEBT_PAYMENT_SELECT = 'id,date,amount,method,note';
  const PROJECT_EXPENSE_SELECT = 'id,project_id,bill_id,type,amount,paid_at,created_at,description,category';
  const PROJECT_MILESTONE_SELECT = 'id,project_id,amount,billed_at,created_at,description,milestone_no,status';
  const CASH_TRANSACTION_SELECT = 'id,direction,amount,net_amount,created_at,type,note,ref_table,ref_id';
  const CUSTOMER_SELECT = 'id,debt_amount';
  const PAYABLE_SELECT = 'id,balance';
  const PAGE_SIZE = 1000;
  const CHUNK_SIZE = 150;
  const TOP_LIMIT = 100;
  const FONT = 'Tahoma';
  const COLORS = {
    navy: 'FF0F172A',
    slate: 'FF334155',
    muted: 'FF64748B',
    line: 'FFE2E8F0',
    soft: 'FFF8FAFC',
    teal: 'FF0F766E',
    tealSoft: 'FFCCFBF1',
    green: 'FF15803D',
    greenSoft: 'FFDCFCE7',
    blue: 'FF1D4ED8',
    blueSoft: 'FFDBEAFE',
    amber: 'FFB45309',
    amberSoft: 'FFFEF3C7',
    red: 'FFB91C1C',
    redSoft: 'FFFEE2E2',
    purple: 'FF7E22CE',
    purpleSoft: 'FFF3E8FF',
    white: 'FFFFFFFF',
  };

  const number = value => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const text = (value, fallback = '') => {
    const output = String(value == null ? '' : value).trim();
    return output || fallback;
  };

  const money = value => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const quantity = value => Math.round((number(value) + Number.EPSILON) * 1000000) / 1000000;

  function notify(message, type = 'info') {
    if (typeof toast === 'function') toast(message, type);
    else console.log(`[${VERSION}] ${message}`);
  }

  function isAdminUser() {
    try {
      if (window.__SK_ACCESS_GUARD__?.isAdmin) return window.__SK_ACCESS_GUARD__.isAdmin();
    } catch (_) {}
    try {
      return typeof USER !== 'undefined' && String(USER?.role || '').toLowerCase() === 'admin';
    } catch (_) {
      return false;
    }
  }

  function denyNonAdminExport() {
    notify('รายงานต้นทุนและกำไรเปิดให้ใช้งานเฉพาะผู้ดูแลระบบเท่านั้น', 'warning');
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function localInputValue(value) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function localDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fileDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  function thaiDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  function parseInfo(value) {
    if (!value) return {};
    if (typeof value === 'object') return value || {};
    try { return JSON.parse(value); } catch (_) { return {}; }
  }

  function effectiveBillTotal(bill) {
    const info = parseInfo(bill?.return_info);
    return Math.max(0, money(info.new_total ?? bill?.total));
  }

  function isExcludedFromRanking(bill) {
    return /ยกเลิก|คืนสินค้า/.test(text(bill?.status));
  }

  function isProjectBill(bill) {
    const value = [bill?.project_id, bill?.customer_name, bill?.method, bill?.status].filter(Boolean).join(' ');
    return Boolean(bill?.project_id) || /\[โครงการ\]|โครงการ|จ่ายของให้โครงการ|เบิกของโครงการ|project/i.test(value);
  }

  function isDebtText(value) {
    const output = text(value);
    if (/บัตรเครดิต|credit\s*card|card/i.test(output)) return false;
    return /ค้างชำระ|เครดิตร้าน|เจ้าหนี้|^เครดิต$|debt/i.test(output);
  }

  function isCodBill(bill) {
    return /ชำระหน้างาน|เก็บปลายทาง|cod/i.test(`${bill?.status || ''} ${bill?.method || ''}`);
  }

  function initialBillCollection(bill) {
    if (isProjectBill(bill) || isCodBill(bill) || isDebtText(bill?.method)) return 0;
    const info = parseInfo(bill?.return_info);
    const total = Math.max(0, money(info.original_total ?? bill?.total));
    const tendered = Math.max(0, money(number(bill?.received) - number(bill?.change)));
    if (tendered > 0) return Math.min(total, tendered);
    const deposit = Math.max(0, money(bill?.deposit_amount));
    if (deposit > 0 && deposit < total) return deposit;
    return total;
  }

  function isStockExpense(row) {
    const output = [row?.category, row?.description, row?.note].filter(Boolean).join(' ').toLowerCase();
    return /stock|purchase|inventory|สต็อก|สต๊อก|เข้าคลัง|ซื้อสินค้า|รับสินค้า|ซื้อรอบ|ชำระเจ้าหนี้/.test(output);
  }

  function isCreditorPayment(row) {
    return /ชำระเจ้าหนี้|จ่ายเจ้าหนี้/.test(`${row?.category || ''} ${row?.description || ''}`);
  }

  function isRefundExpense(row) {
    return /คืนมัดจำ|คืนเงิน|refund/i.test(`${row?.category || ''} ${row?.description || ''}`);
  }

  function isWageExpense(row) {
    return /ค่าแรง|เงินเดือน|ค่าจ้าง|wage|salary|payroll/i.test(`${row?.category || ''} ${row?.description || ''}`);
  }

  function methodKey(value) {
    const output = text(value);
    if (/เงินสด|สด/.test(output)) return 'เงินสด';
    if (/โอน|พร้อมเพย์|transfer/i.test(output)) return 'เงินโอน';
    if (/บัตร|credit card/i.test(output)) return 'บัตร';
    if (/เช็ค/.test(output)) return 'เช็ค';
    if (/โครงการ|project/i.test(output)) return 'โครงการ';
    return output || 'อื่น ๆ';
  }

  function dedupeProjectRetries(rows, timeField) {
    const kept = [];
    const retryWindowMs = 5000;
    [...(rows || [])].sort((a, b) => new Date(a?.[timeField] || a?.created_at || 0) - new Date(b?.[timeField] || b?.created_at || 0)).forEach(row => {
      const key = [row?.project_id, row?.description || row?.bill_id || row?.milestone_no, row?.category || row?.type]
        .map(value => text(value).toLocaleLowerCase('th-TH')).join('|');
      const rowTime = new Date(row?.[timeField] || row?.created_at || 0).getTime() || 0;
      const oldIndex = kept.findIndex(old => {
        const oldKey = [old?.project_id, old?.description || old?.bill_id || old?.milestone_no, old?.category || old?.type]
          .map(value => text(value).toLocaleLowerCase('th-TH')).join('|');
        const oldTime = new Date(old?.[timeField] || old?.created_at || 0).getTime() || 0;
        return oldKey === key && Math.abs(oldTime - rowTime) <= retryWindowMs && Math.abs(number(old?.amount) - number(row?.amount)) <= 0.01;
      });
      if (oldIndex >= 0) {
        const oldTime = new Date(kept[oldIndex]?.[timeField] || kept[oldIndex]?.created_at || 0).getTime() || 0;
        if (rowTime >= oldTime) kept[oldIndex] = row;
      } else kept.push(row);
    });
    return kept;
  }

  function itemTotal(item) {
    return money(item?.total == null ? number(item?.qty) * number(item?.price) : item.total);
  }

  function chunks(values, size = CHUNK_SIZE) {
    const output = [];
    for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
    return output;
  }

  async function fetchPaged(table, select, configure) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = db.from(table).select(select || '*');
      if (configure) query = configure(query);
      query = query.range(from, from + PAGE_SIZE - 1);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return rows;
  }

  async function fetchBills(start, end) {
    return fetchPaged(BILL_TABLE, BILL_SELECT, query => query
      .gte('date', start.toISOString())
      .lte('date', end.toISOString())
      .order('date', { ascending: true }));
  }

  async function fetchItems(billIds) {
    if (!billIds.length) return [];
    const groups = chunks(billIds);
    const parts = [];
    for (const group of groups) {
      parts.push(await fetchPaged(ITEM_TABLE, ITEM_SELECT, query => query.in('bill_id', group).order('id', { ascending: true })));
    }
    return parts.flat();
  }

  async function fetchProducts(productIds) {
    if (!productIds.length) return [];
    try {
      const parts = [];
      for (const group of chunks(productIds)) {
        parts.push(await fetchPaged(PRODUCT_TABLE, PRODUCT_SELECT, query => query.in('id', group)));
      }
      return parts.flat();
    } catch (error) {
      console.warn(`[${VERSION}] product details unavailable:`, error);
      return [];
    }
  }

  async function fetchShop() {
    try {
      const { data, error } = await db.from(SHOP_TABLE).select(SHOP_SELECT).limit(1).maybeSingle();
      if (error) throw error;
      return data || {};
    } catch (error) {
      console.warn(`[${VERSION}] shop details unavailable:`, error);
      return {};
    }
  }

  async function fetchOptionalPaged(table, select, configure, warnings, label = table) {
    try {
      return await fetchPaged(table, select, configure);
    } catch (error) {
      console.warn(`[${VERSION}] ${label} unavailable:`, error);
      warnings.push(`ไม่สามารถอ่านข้อมูล ${label}: ${error?.message || error}`);
      return [];
    }
  }

  async function fetchFinancialSources(start, end) {
    const warnings = [];
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const startDate = localDateKey(start);
    const endDate = localDateKey(end);
    const [expenses, attendance, payroll, purchases, advances, debtPayments, projectExpensesRaw, milestonesRaw, cashTransactions, customers, payables] = await Promise.all([
      fetchOptionalPaged(EXPENSE_TABLE, EXPENSE_SELECT, query => query.gte('date', startIso).lte('date', endIso).order('date', { ascending: true }), warnings, 'รายจ่ายร้าน'),
      fetchOptionalPaged(ATTENDANCE_TABLE, ATTENDANCE_SELECT, query => query.gte('date', startDate).lte('date', endDate).order('date', { ascending: true }), warnings, 'เช็คชื่อและค่าแรง'),
      fetchOptionalPaged(PAYROLL_TABLE, PAYROLL_SELECT, query => query.gte('paid_date', startIso).lte('paid_date', endIso).order('paid_date', { ascending: true }), warnings, 'เงินเดือนที่จ่าย'),
      fetchOptionalPaged(PURCHASE_TABLE, PURCHASE_SELECT, query => query.gte('date', startIso).lte('date', endIso).order('date', { ascending: true }), warnings, 'รายการซื้อสินค้า'),
      fetchOptionalPaged(ADVANCE_TABLE, ADVANCE_SELECT, query => query.gte('date', startIso).lte('date', endIso).order('date', { ascending: true }), warnings, 'เงินเบิกล่วงหน้า'),
      fetchOptionalPaged(DEBT_PAYMENT_TABLE, DEBT_PAYMENT_SELECT, query => query.gte('date', startIso).lte('date', endIso).order('date', { ascending: true }), warnings, 'รับชำระหนี้'),
      fetchOptionalPaged(PROJECT_EXPENSE_TABLE, PROJECT_EXPENSE_SELECT, query => query.gte('paid_at', startIso).lte('paid_at', endIso).order('paid_at', { ascending: true }), warnings, 'รายจ่ายโครงการ'),
      fetchOptionalPaged(PROJECT_MILESTONE_TABLE, PROJECT_MILESTONE_SELECT, query => query.eq('status', 'billed').gte('billed_at', startIso).lte('billed_at', endIso).order('billed_at', { ascending: true }), warnings, 'รายได้งวดโครงการ'),
      fetchOptionalPaged(CASH_TRANSACTION_TABLE, CASH_TRANSACTION_SELECT, query => query.gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: true }), warnings, 'รายการลิ้นชักเงินสด'),
      fetchOptionalPaged(CUSTOMER_TABLE, CUSTOMER_SELECT, query => query.gt('debt_amount', 0).order('id', { ascending: true }), warnings, 'ลูกหนี้คงค้างปัจจุบัน'),
      fetchOptionalPaged(PAYABLE_TABLE, PAYABLE_SELECT, query => query.gt('balance', 0).order('id', { ascending: true }), warnings, 'เจ้าหนี้คงค้างปัจจุบัน'),
    ]);

    const employeeIds = [...new Set(attendance.map(row => row.employee_id).filter(Boolean).map(String))];
    const employees = [];
    for (const group of chunks(employeeIds)) {
      try {
        const rows = await fetchPaged(EMPLOYEE_TABLE, EMPLOYEE_SELECT, query => query.in('id', group));
        employees.push(...rows);
      } catch (error) {
        console.warn(`[${VERSION}] employee wages unavailable:`, error);
        warnings.push(`ไม่สามารถอ่านอัตราค่าแรงพนักงาน: ${error?.message || error}`);
        break;
      }
    }
    return {
      expenses,
      attendance,
      employees,
      payroll,
      purchases,
      advances,
      debtPayments,
      projectExpenses: dedupeProjectRetries(projectExpensesRaw, 'paid_at'),
      milestones: dedupeProjectRetries(milestonesRaw, 'billed_at'),
      cashTransactions,
      customers,
      payables,
      warnings,
    };
  }

  function prepareFinancialReport(data, start, end) {
    const sources = data.financial || {};
    const report = data.report;
    const productById = report.productById;
    const activeBills = report.validBills;
    const storeBills = activeBills.filter(bill => !isProjectBill(bill));
    const projectBills = activeBills.filter(isProjectBill);
    const costRows = [];
    const expenseRows = [];
    const cashRows = [];
    const warnings = [...(sources.warnings || [])];

    const pushCash = (row, direction, amount, extra = {}) => {
      const value = Math.max(0, money(amount));
      if (!value) return;
      cashRows.push({
        date: row?.date || row?.paid_date || row?.paid_at || row?.billed_at || row?.created_at || '',
        type: extra.type || '-',
        category: extra.category || '-',
        description: extra.description || row?.description || row?.note || '-',
        method: extra.method || row?.method || '-',
        source: extra.source || '-',
        reference: extra.reference || row?.bill_no || row?.id || '-',
        cashIn: direction === 'in' ? value : 0,
        cashOut: direction === 'out' ? value : 0,
        note: extra.note || '-',
      });
    };

    let missingCostCount = 0;
    let unallocatedRevenue = 0;
    storeBills.forEach(bill => {
      const billItems = report.itemsByBill.get(String(bill.id)) || [];
      const info = parseInfo(bill.return_info);
      const returned = Array.isArray(info.return_items) ? info.return_items : [];
      const billRevenue = effectiveBillTotal(bill);
      const itemRevenue = billItems.reduce((sum, item) => sum + itemTotal(item), 0);
      const originalTotal = number(info.original_total) || billRevenue + number(info.return_total);
      const itemsAlreadyNet = returned.length > 0 && Math.abs(itemRevenue - billRevenue) <= Math.abs(itemRevenue - originalTotal);
      const returnBalance = new Map();
      if (!itemsAlreadyNet) returned.forEach(item => {
        const key = `${item.product_id || text(item.name).toLocaleLowerCase('th-TH')}|${text(item.unit).toLocaleLowerCase('th-TH')}`;
        returnBalance.set(key, number(returnBalance.get(key)) + number(item.qty));
      });

      const itemParts = billItems.map(item => {
        const product = productById.get(String(item.product_id || '')) || {};
        const key = `${item.product_id || text(item.name).toLocaleLowerCase('th-TH')}|${text(item.unit).toLocaleLowerCase('th-TH')}`;
        const fallbackKey = `${item.product_id || text(item.name).toLocaleLowerCase('th-TH')}|`;
        const balance = number(returnBalance.get(key) ?? returnBalance.get(fallbackKey));
        const returnedQty = Math.min(number(item.qty), balance);
        if (returnedQty > 0) {
          const targetKey = returnBalance.has(key) ? key : fallbackKey;
          returnBalance.set(targetKey, Math.max(0, balance - returnedQty));
        }
        const soldQty = quantity(Math.max(0, number(item.qty) - (itemsAlreadyNet ? 0 : returnedQty)));
        const itemCost = number(item.cost);
        const productCost = number(product.cost);
        const unitCost = itemCost > 0 ? itemCost : productCost;
        let costSource = itemCost > 0 ? 'ต้นทุนที่บันทึกตอนขาย' : (productCost > 0 ? 'ต้นทุนสินค้าปัจจุบัน (สำรอง)' : 'ไม่พบข้อมูลต้นทุน');
        if (!item.product_id && unitCost <= 0) costSource = 'ค่าบริการ/รายการพิเศษ ไม่มีสินค้าอ้างอิง';
        if (item.product_id && unitCost <= 0 && soldQty > 0) missingCostCount += 1;
        return {
          item,
          product,
          soldQty,
          returnedQty: quantity(itemsAlreadyNet ? 0 : returnedQty),
          grossSales: money(number(item.price) * soldQty),
          unitCost: money(unitCost),
          totalCost: money(unitCost * soldQty),
          costSource,
        };
      }).filter(part => part.soldQty > 0 || part.grossSales > 0);

      const grossAfterReturns = money(itemParts.reduce((sum, part) => sum + part.grossSales, 0));
      const allocationRatio = grossAfterReturns > 0 ? billRevenue / grossAfterReturns : 0;
      itemParts.forEach(part => {
        const netSales = money(part.grossSales * allocationRatio);
        const grossProfit = money(netSales - part.totalCost);
        costRows.push({
          date: bill.date,
          billNo: text(bill.bill_no || bill.id, '-'),
          customer: text(bill.customer_name, 'ลูกค้าทั่วไป'),
          staff: text(bill.staff_name, '-'),
          status: text(bill.status, '-'),
          productId: text(part.item.product_id, '-'),
          productName: text(part.item.name || part.product.name, 'ไม่ระบุชื่อสินค้า'),
          barcode: text(part.product.barcode, '-'),
          category: text(part.product.category, 'ไม่ระบุหมวดสินค้า'),
          unit: text(part.item.unit || part.product.unit, '-'),
          soldQty: part.soldQty,
          returnedQty: part.returnedQty,
          unitPrice: money(part.item.price),
          grossSales: part.grossSales,
          allocatedDiscount: money(Math.max(0, part.grossSales - netSales)),
          netSales,
          unitCost: part.unitCost,
          totalCost: part.totalCost,
          grossProfit,
          margin: netSales > 0 ? grossProfit / netSales : 0,
          costSource: part.costSource,
        });
      });
      const allocated = money(itemParts.reduce((sum, part) => sum + money(part.grossSales * allocationRatio), 0));
      const gap = money(billRevenue - allocated);
      if (Math.abs(gap) > 0.01) {
        unallocatedRevenue = money(unallocatedRevenue + gap);
        costRows.push({
          date: bill.date,
          billNo: text(bill.bill_no || bill.id, '-'),
          customer: text(bill.customer_name, 'ลูกค้าทั่วไป'),
          staff: text(bill.staff_name, '-'),
          status: text(bill.status, '-'),
          productId: '-', productName: 'ส่วนต่างยอดบิล / ไม่มีรายการสินค้า', barcode: '-', category: 'ปรับปรุงรายงาน', unit: '-',
          soldQty: 0, returnedQty: 0, unitPrice: 0, grossSales: gap, allocatedDiscount: 0, netSales: gap,
          unitCost: 0, totalCost: 0, grossProfit: gap, margin: gap > 0 ? 1 : 0, costSource: 'ปรับยอดให้ตรงกับยอดสุทธิของบิล',
        });
      }
    });

    const storeRevenue = money(storeBills.reduce((sum, bill) => sum + effectiveBillTotal(bill), 0));
    const projectBillValue = money(projectBills.reduce((sum, bill) => sum + effectiveBillTotal(bill), 0));
    const storeCogs = money(costRows.reduce((sum, row) => sum + row.totalCost, 0));
    const employeeById = new Map((sources.employees || []).map(employee => [String(employee.id), employee]));
    const attendanceWageRows = [];
    (sources.attendance || []).forEach(row => {
      const employee = employeeById.get(String(row.employee_id || '')) || {};
      const dailyWage = number(employee.daily_wage);
      let amount = 0;
      if (/^(มา|มาสาย)$/.test(text(row.status))) amount = dailyWage;
      else if (/ลาครึ่งวัน|ครึ่งวัน|มาครึ่งวัน/.test(text(row.status))) amount = dailyWage / 2;
      amount = money(Math.max(0, amount - number(row.deduction)));
      const project = /\[สถานที่ทำงาน:โครงการ:|โครงการ|project/i.test(text(row.note));
      attendanceWageRows.push({
        date: row.date,
        employeeId: row.employee_id,
        employeeName: text(employee.name || row.employee_name, `พนักงาน #${row.employee_id || '-'}`),
        status: text(row.status, '-'),
        dailyWage: money(dailyWage),
        deduction: money(row.deduction),
        amount,
        scope: project ? 'โครงการ' : 'หน้าร้าน',
        note: text(row.note, '-'),
      });
    });

    let storeExpenses = 0;
    let legacyStoreWages = 0;
    (sources.expenses || []).forEach(row => {
      const amount = money(row.amount);
      const refund = isRefundExpense(row);
      const creditor = isCreditorPayment(row);
      const stock = isStockExpense(row);
      const wage = isWageExpense(row);
      const duplicatePurchaseCash = stock && (sources.purchases || []).some(purchase =>
        !isDebtText(purchase.method) && !/ยกเลิก/.test(text(purchase.status))
        && localDateKey(purchase.date) === localDateKey(row.date)
        && Math.abs(number(purchase.total) - amount) <= 0.01);
      const duplicatePayrollCash = wage && (sources.payroll || []).some(payroll =>
        localDateKey(payroll.paid_date) === localDateKey(row.date)
        && Math.abs(number(payroll.net_paid) - amount) <= 0.01);
      const cashDuplicate = duplicatePurchaseCash || duplicatePayrollCash;
      const cashOutImpact = cashDuplicate ? 0 : amount;
      let category = 'รายจ่ายดำเนินงาน';
      let pnlImpact = amount;
      let note = 'หักเป็นค่าใช้จ่ายในงบกำไรขาดทุน';
      if (refund) { category = 'เงินคืนลูกค้า'; pnlImpact = 0; note = 'ไม่หักซ้ำ เพราะยอดขายใช้ยอดสุทธิหลังคืนแล้ว'; }
      else if (creditor) { category = 'ชำระเจ้าหนี้'; pnlImpact = 0; note = 'กระแสเงินสดเท่านั้น ต้นทุนรับรู้ผ่านต้นทุนขาย'; }
      else if (stock) { category = 'ซื้อสต็อก/สินค้า'; pnlImpact = 0; note = 'กระแสเงินสดเท่านั้น ต้นทุนรับรู้เมื่อขายสินค้า'; }
      else if (wage) {
        category = 'ค่าแรงบันทึกในรายจ่าย';
        const description = text(row.description).toLocaleLowerCase('th-TH');
        const duplicate = attendanceWageRows.some(att => localDateKey(att.date) === localDateKey(row.date)
          && text(att.employeeName).length > 1 && description.includes(text(att.employeeName).toLocaleLowerCase('th-TH')));
        if (duplicate) { pnlImpact = 0; note = 'ไม่นับซ้ำกับค่าแรงจากเช็คชื่อของวันเดียวกัน'; }
        else { legacyStoreWages = money(legacyStoreWages + amount); note = 'หักเป็นค่าแรง เนื่องจากไม่พบรายการเช็คชื่อที่ตรงกัน'; }
      } else storeExpenses = money(storeExpenses + amount);
      if (cashDuplicate) note += duplicatePurchaseCash
        ? ' | ไม่นับเงินจ่ายซ้ำกับรายการซื้อสินค้ายอดเดียวกันในวันเดียวกัน'
        : ' | ไม่นับเงินจ่ายซ้ำกับประวัติจ่ายเงินเดือนยอดเดียวกันในวันเดียวกัน';
      expenseRows.push({
        date: row.date, source: EXPENSE_TABLE, sourceId: row.id, category, description: text(row.description, '-'),
        method: text(row.method, '-'), scope: 'หน้าร้าน', recordedAmount: amount, pnlImpact, cashIn: 0, cashOut: cashOutImpact,
        note: `${note}${row.note ? ` | ${row.note}` : ''}`,
      });
      if (!cashDuplicate) pushCash(row, 'out', amount, { type: category, category: text(row.category, category), source: EXPENSE_TABLE, note });
    });

    let projectRevenue = 0;
    (sources.milestones || []).forEach(row => {
      const amount = money(row.amount);
      projectRevenue = money(projectRevenue + amount);
      pushCash(row, 'in', amount, { type: 'รับเงินงวดโครงการ', category: 'รายได้โครงการ', source: PROJECT_MILESTONE_TABLE, description: text(row.description, `งวดที่ ${row.milestone_no || '-'}`), method: 'โครงการ' });
    });

    let projectExpenses = 0;
    (sources.projectExpenses || []).forEach(row => {
      const internalGoods = text(row.type) === 'goods';
      const linkedItems = report.itemsByBill.get(String(row.bill_id || '')) || [];
      const linkedCost = money(linkedItems.reduce((sum, item) => {
        const product = productById.get(String(item.product_id || '')) || {};
        const unitCost = number(item.cost) > 0 ? number(item.cost) : number(product.cost);
        return sum + unitCost * number(item.qty);
      }, 0));
      const pnlImpact = internalGoods && linkedCost > 0 ? linkedCost : money(row.amount);
      const cashOut = internalGoods ? 0 : money(row.amount);
      projectExpenses = money(projectExpenses + pnlImpact);
      expenseRows.push({
        date: row.paid_at || row.created_at, source: PROJECT_EXPENSE_TABLE, sourceId: row.id,
        category: internalGoods ? 'สินค้าเบิกใช้ในโครงการ' : 'รายจ่ายโครงการ', description: text(row.description, '-'), method: '-', scope: 'โครงการ',
        recordedAmount: money(row.amount), pnlImpact, cashIn: 0, cashOut,
        note: internalGoods ? `ใช้ต้นทุนสินค้าจริงจากบิลที่เชื่อมโยง${linkedCost > 0 ? '' : ' (ไม่พบต้นทุน จึงใช้ยอดบันทึก)'}` : 'รายจ่ายจ่ายจริงของโครงการ',
      });
      if (cashOut > 0) pushCash(row, 'out', cashOut, { type: 'รายจ่ายโครงการ', category: text(row.category, '-'), source: PROJECT_EXPENSE_TABLE });
    });

    let storeWages = money(attendanceWageRows.filter(row => row.scope === 'หน้าร้าน').reduce((sum, row) => sum + row.amount, 0) + legacyStoreWages);
    let projectWages = money(attendanceWageRows.filter(row => row.scope === 'โครงการ').reduce((sum, row) => sum + row.amount, 0));
    attendanceWageRows.forEach(row => expenseRows.push({
      date: row.date, source: ATTENDANCE_TABLE, sourceId: row.employeeId, category: 'ค่าแรงค้างรับรู้จากเช็คชื่อ',
      description: `${row.employeeName} (${row.status})`, method: 'ยังไม่ใช่เงินจ่าย', scope: row.scope,
      recordedAmount: row.amount, pnlImpact: row.amount, cashIn: 0, cashOut: 0,
      note: `ค่าแรงรายวัน ${row.dailyWage.toLocaleString('th-TH')} หักสาย/หักอื่น ${row.deduction.toLocaleString('th-TH')} | ${row.note}`,
    }));

    const payrollPaid = money((sources.payroll || []).reduce((sum, row) => sum + number(row.net_paid), 0));
    const usePayrollAsLabor = attendanceWageRows.length === 0 && legacyStoreWages <= 0 && payrollPaid > 0;
    (sources.payroll || []).forEach(row => {
      const amount = money(row.net_paid);
      const pnlImpact = usePayrollAsLabor ? amount : 0;
      if (pnlImpact) storeWages = money(storeWages + pnlImpact);
      expenseRows.push({
        date: row.paid_date, source: PAYROLL_TABLE, sourceId: row.id, category: 'เงินเดือนที่จ่ายจริง',
        description: text(row.employee_name || row.note, `พนักงาน #${row.employee_id || '-'}`), method: text(row.method, '-'), scope: 'หน้าร้าน',
        recordedAmount: amount, pnlImpact, cashIn: 0, cashOut: amount,
        note: usePayrollAsLabor ? 'ใช้เป็นค่าแรงแทน เพราะไม่พบข้อมูลเช็คชื่อในช่วงนี้' : 'ไม่หักกำไรซ้ำ เพราะรับรู้ค่าแรงจากเช็คชื่อแล้ว',
      });
      pushCash(row, 'out', amount, { type: 'จ่ายเงินเดือน', category: 'ค่าแรง', source: PAYROLL_TABLE, description: text(row.employee_name || row.note, '-'), note: usePayrollAsLabor ? 'ใช้เป็นต้นทุนแรงงานด้วย' : 'กระแสเงินสด ไม่หักกำไรซ้ำ' });
    });

    (data.bills || []).filter(bill => !isProjectBill(bill)).forEach(bill => {
      const amount = initialBillCollection(bill);
      pushCash(bill, 'in', amount, { type: 'รับเงินจากการขาย', category: 'ยอดขายหน้าร้าน', source: BILL_TABLE, description: `บิล ${text(bill.bill_no || bill.id, '-')}`, method: methodKey(bill.method) });
    });
    (sources.debtPayments || []).forEach(row => pushCash(row, 'in', row.amount, { type: 'รับชำระหนี้ลูกค้า', category: 'ลูกหนี้การค้า', source: DEBT_PAYMENT_TABLE }));

    const directBillPayments = (sources.cashTransactions || []).filter(row => row.direction === 'in'
      && /รับชำระบิล/.test(`${row.type || ''} ${row.note || ''}`)
      && (String(row.ref_table || '') === BILL_TABLE || !/รับชำระหนี้/.test(text(row.type))));
    directBillPayments.forEach(row => pushCash(row, 'in', number(row.net_amount) || number(row.amount), { type: 'รับชำระบิลย้อนหลัง', category: 'ลูกหนี้จากบิล', source: CASH_TRANSACTION_TABLE, method: 'เงินสด' }));

    (sources.purchases || []).filter(row => !isDebtText(row.method) && !/ยกเลิก/.test(text(row.status))).forEach(row => {
      pushCash(row, 'out', row.total, { type: 'ซื้อสินค้าแบบจ่ายทันที', category: 'ซื้อสต็อก', source: PURCHASE_TABLE, description: text(row.supplier, '-'), note: 'ไม่หักกำไรทันที เพราะใช้ต้นทุนขายจากสินค้าที่ขายจริง' });
    });
    (sources.advances || []).filter(row => /อนุมัติ/.test(text(row.status))).forEach(row => {
      pushCash(row, 'out', row.amount, { type: 'เบิกเงินล่วงหน้า', category: 'ลูกหนี้พนักงาน/เงินทดรอง', source: ADVANCE_TABLE, note: 'ไม่ใช่ค่าใช้จ่ายซ้ำ หากนำไปหักตอนจ่ายเงินเดือน' });
    });

    const expenseRefundKeys = new Set((sources.expenses || []).filter(isRefundExpense).map(row => `${Math.round(number(row.amount))}|${localDateKey(row.date)}`));
    (sources.cashTransactions || []).filter(row => row.direction === 'out' && /คืนเงิน|คืนมัดจำ|refund/i.test(`${row.type || ''} ${row.note || ''}`)).forEach(row => {
      const amount = number(row.net_amount) || number(row.amount);
      const key = `${Math.round(amount)}|${localDateKey(row.created_at)}`;
      if (!expenseRefundKeys.has(key)) pushCash(row, 'out', amount, { type: 'คืนเงินลูกค้า', category: 'เงินคืน', source: CASH_TRANSACTION_TABLE, note: 'ไม่หักกำไรซ้ำ เพราะยอดขายเป็นยอดสุทธิหลังคืน' });
    });

    const totalRevenue = money(storeRevenue + projectRevenue);
    const totalCogs = storeCogs;
    const grossProfit = money(totalRevenue - totalCogs);
    const totalOperatingExpenses = money(storeExpenses + projectExpenses + storeWages + projectWages);
    const netProfit = money(grossProfit - totalOperatingExpenses);
    const cashIn = money(cashRows.reduce((sum, row) => sum + row.cashIn, 0));
    const cashOut = money(cashRows.reduce((sum, row) => sum + row.cashOut, 0));
    const currentCustomerDebt = money((sources.customers || []).reduce((sum, row) => sum + number(row.debt_amount), 0));
    const currentPayable = money((sources.payables || []).reduce((sum, row) => sum + number(row.balance), 0));

    if (missingCostCount) warnings.push(`พบ ${missingCostCount.toLocaleString('th-TH')} รายการขายที่ไม่มีต้นทุนสินค้า กำไรอาจสูงกว่าจริง`);
    if (Math.abs(unallocatedRevenue) > 0.01) warnings.push(`มีส่วนต่างยอดบิล ${money(unallocatedRevenue).toLocaleString('th-TH')} บาท ระบบเพิ่มแถวปรับปรุงเพื่อให้ยอดขายตรงกัน`);
    if (usePayrollAsLabor) warnings.push('ไม่พบข้อมูลเช็คชื่อในช่วงที่เลือก จึงใช้เงินเดือนที่จ่ายจริงเป็นต้นทุนแรงงานแทน');
    if (projectBillValue > 0) warnings.push(`บิลเบิกของ/บิลโครงการ ${projectBillValue.toLocaleString('th-TH')} บาทไม่นับเป็นรายได้ซ้ำ รายได้โครงการใช้จากงวดงานที่รับเงิน`);

    return {
      start,
      end,
      costRows,
      expenseRows,
      cashRows,
      attendanceWageRows,
      warnings,
      laborBasis: usePayrollAsLabor ? 'เงินเดือนที่จ่ายจริง (ไม่พบเช็คชื่อ)' : 'ค่าแรงค้างรับรู้จากเช็คชื่อ + ค่าแรงเดิมที่ไม่ซ้ำ',
      totals: {
        storeRevenue, projectRevenue, totalRevenue, storeCogs, totalCogs, grossProfit,
        storeExpenses, projectExpenses, storeWages, projectWages, totalOperatingExpenses, netProfit,
        grossMargin: totalRevenue > 0 ? grossProfit / totalRevenue : 0,
        netMargin: totalRevenue > 0 ? netProfit / totalRevenue : 0,
        payrollPaid, cashIn, cashOut, netCash: money(cashIn - cashOut),
        purchasesPaid: money(cashRows.filter(row => row.type === 'ซื้อสินค้าแบบจ่ายทันที').reduce((sum, row) => sum + row.cashOut, 0)),
        advancesPaid: money(cashRows.filter(row => row.type === 'เบิกเงินล่วงหน้า').reduce((sum, row) => sum + row.cashOut, 0)),
        refundsPaid: money(cashRows.filter(row => row.type === 'คืนเงินลูกค้า' || row.type === 'เงินคืนลูกค้า').reduce((sum, row) => sum + row.cashOut, 0)),
        currentCustomerDebt, currentPayable, projectBillValue,
      },
    };
  }

  function prepareReportData(bills, items, products) {
    const billById = new Map((bills || []).map(bill => [String(bill.id), bill]));
    const productById = new Map((products || []).map(product => [String(product.id), product]));
    const itemsByBill = new Map();
    (items || []).forEach(item => {
      const key = String(item.bill_id || '');
      if (!itemsByBill.has(key)) itemsByBill.set(key, []);
      itemsByBill.get(key).push(item);
    });

    const validBills = (bills || []).filter(bill => !isExcludedFromRanking(bill));
    const validBillIds = new Set(validBills.map(bill => String(bill.id)));
    const soldItems = (items || []).filter(item => validBillIds.has(String(item.bill_id)) && number(item.qty) > 0);
    const itemFinancials = new Map();
    itemsByBill.forEach((billItems, billId) => {
      const bill = billById.get(String(billId)) || {};
      const grossTotal = money(billItems.reduce((sum, item) => sum + itemTotal(item), 0));
      const billDiscount = Math.min(Math.max(0, money(bill.discount)), grossTotal);
      billItems.forEach(item => {
        const grossSales = itemTotal(item);
        const allocatedDiscount = grossTotal > 0 ? money(billDiscount * grossSales / grossTotal) : 0;
        itemFinancials.set(item, {
          grossSales,
          allocatedDiscount,
          netSales: money(Math.max(0, grossSales - allocatedDiscount)),
        });
      });
    });
    const rankingMap = new Map();

    soldItems.forEach(item => {
      const product = productById.get(String(item.product_id || '')) || {};
      const name = text(item.name || product.name, 'ไม่ระบุชื่อสินค้า');
      const unit = text(item.unit || product.unit, 'ไม่ระบุหน่วย');
      const productKey = item.product_id ? String(item.product_id) : name.toLocaleLowerCase('th-TH');
      const key = `${productKey}|${unit.toLocaleLowerCase('th-TH')}`;
      if (!rankingMap.has(key)) {
        rankingMap.set(key, {
          name,
          barcode: text(product.barcode, '-'),
          category: text(product.category, 'ไม่ระบุหมวดสินค้า'),
          unit,
          bills: new Set(),
          qty: 0,
          sales: 0,
        });
      }
      const row = rankingMap.get(key);
      row.bills.add(String(item.bill_id));
      row.qty += number(item.qty);
      row.sales += itemFinancials.get(item)?.netSales ?? itemTotal(item);
    });

    const rankingRows = [...rankingMap.values()].map(row => ({
      ...row,
      billCount: row.bills.size,
      qty: quantity(row.qty),
      sales: money(row.sales),
      averagePrice: row.qty > 0 ? money(row.sales / row.qty) : 0,
    }));

    const byQuantity = [...rankingRows]
      .sort((a, b) => b.qty - a.qty || b.sales - a.sales || a.name.localeCompare(b.name, 'th'))
      .slice(0, TOP_LIMIT);
    const bySales = [...rankingRows]
      .sort((a, b) => b.sales - a.sales || b.qty - a.qty || a.name.localeCompare(b.name, 'th'))
      .slice(0, TOP_LIMIT);

    return {
      billById,
      productById,
      itemsByBill,
      itemFinancials,
      validBills,
      soldItems,
      byQuantity,
      bySales,
      totalSoldQty: quantity(rankingRows.reduce((sum, row) => sum + row.qty, 0)),
      totalSoldSales: money(rankingRows.reduce((sum, row) => sum + row.sales, 0)),
    };
  }

  const thinBorder = () => ({
    top: { style: 'thin', color: { argb: COLORS.line } },
    left: { style: 'thin', color: { argb: COLORS.line } },
    bottom: { style: 'thin', color: { argb: COLORS.line } },
    right: { style: 'thin', color: { argb: COLORS.line } },
  });

  function fill(argb) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  }

  function baseSheet(sheet, title, subtitle, lastColumn, landscape = true) {
    sheet.mergeCells(1, 1, 1, lastColumn);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.fill = fill(COLORS.teal);
    titleCell.font = { name: FONT, size: 18, bold: true, color: { argb: COLORS.white } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 34;

    sheet.mergeCells(2, 1, 2, lastColumn);
    const subtitleCell = sheet.getCell(2, 1);
    subtitleCell.value = subtitle;
    subtitleCell.fill = fill(COLORS.tealSoft);
    subtitleCell.font = { name: FONT, size: 10.5, color: { argb: COLORS.navy } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    sheet.getRow(2).height = 24;

    sheet.mergeCells(3, 1, 3, lastColumn);
    const printCell = sheet.getCell(3, 1);
    printCell.value = `สร้างรายงานเมื่อ ${thaiDateTime(new Date())}`;
    printCell.font = { name: FONT, size: 9, color: { argb: COLORS.muted } };
    printCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(3).height = 19;
    sheet.getRow(4).height = 8;

    sheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];
    sheet.properties.defaultRowHeight = 20;
    sheet.pageSetup = {
      paperSize: 9,
      orientation: landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: false,
      margins: { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.25 },
    };
    sheet.pageSetup.printTitlesRow = '1:5';
    sheet.headerFooter.oddHeader = `&C&B${title}`;
    sheet.headerFooter.oddFooter = '&Lรายงานจาก SK POS&Cหน้า &P จาก &N&R&A';
  }

  function styleHeader(row) {
    row.height = 30;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = fill(COLORS.slate);
      cell.font = { name: FONT, size: 9.5, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder();
    });
  }

  function styleDataRows(sheet, firstRow, lastRow, lastColumn) {
    for (let rowNumber = firstRow; rowNumber <= lastRow; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      row.height = 22;
      for (let column = 1; column <= lastColumn; column += 1) {
        const cell = row.getCell(column);
        cell.font = { name: FONT, size: 9, color: { argb: COLORS.navy } };
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = { bottom: { style: 'hair', color: { argb: COLORS.line } } };
        if (rowNumber % 2 === 0) cell.fill = fill(COLORS.soft);
      }
    }
  }

  function applyWidths(sheet, widths) {
    widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  }

  function addAutoFilter(sheet, headerRow, lastColumn, lastDataRow, lastPrintRow = lastDataRow) {
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: Math.max(headerRow, lastDataRow), column: lastColumn },
    };
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(lastColumn).letter}${Math.max(headerRow, lastPrintRow)}`;
  }

  function styleStatusCell(cell, status) {
    const value = text(status);
    let fg = COLORS.blueSoft;
    let color = COLORS.blue;
    if (/สำเร็จ|จัดส่งแล้ว/.test(value)) { fg = COLORS.greenSoft; color = COLORS.green; }
    else if (/ค้าง|บางส่วน|รอ/.test(value)) { fg = COLORS.amberSoft; color = COLORS.amber; }
    else if (/ยกเลิก|คืน/.test(value)) { fg = COLORS.redSoft; color = COLORS.red; }
    cell.fill = fill(fg);
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: color } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }

  function formulaValue(cell, formula, result, numFmt = '#,##0.00') {
    cell.value = { formula, result: numFmt.includes('%') ? number(result) : money(result) };
    cell.numFmt = numFmt;
  }

  function addProfitLossSheet(workbook, financial, shop) {
    const sheet = workbook.addWorksheet('งบกำไรขาดทุน', { properties: { tabColor: { argb: COLORS.red } } });
    const totals = financial.totals;
    const shopName = text(shop.shop_name, 'ร้านค้า');
    baseSheet(sheet, `${shopName} • งบกำไร–ขาดทุนฉบับสมบูรณ์`, `ช่วง ${thaiDateTime(financial.start)} ถึง ${thaiDateTime(financial.end)} • เกณฑ์ค่าแรง: ${financial.laborBasis}`, 10, true);
    sheet.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];

    const cards = [
      ['รายได้รวม', totals.totalRevenue, COLORS.blueSoft, COLORS.blue, 'B11'],
      ['ต้นทุนขาย', totals.totalCogs, COLORS.amberSoft, COLORS.amber, '-B13'],
      ['กำไรขั้นต้น', totals.grossProfit, COLORS.greenSoft, COLORS.green, 'B14'],
      ['กำไรสุทธิ', totals.netProfit, totals.netProfit >= 0 ? COLORS.tealSoft : COLORS.redSoft, totals.netProfit >= 0 ? COLORS.teal : COLORS.red, 'B22'],
    ];
    cards.forEach((card, index) => {
      const firstColumn = index * 2 + 1;
      sheet.mergeCells(5, firstColumn, 5, firstColumn + 1);
      sheet.mergeCells(6, firstColumn, 6, firstColumn + 1);
      const label = sheet.getCell(5, firstColumn);
      label.value = card[0];
      label.fill = fill(card[2]);
      label.font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.muted } };
      label.alignment = { horizontal: 'center', vertical: 'middle' };
      const value = sheet.getCell(6, firstColumn);
      value.value = { formula: card[4], result: card[1] };
      value.fill = fill(card[2]);
      value.font = { name: FONT, size: 16, bold: true, color: { argb: card[3] } };
      value.alignment = { horizontal: 'center', vertical: 'middle' };
      value.numFmt = '#,##0.00" บาท";[Red](#,##0.00" บาท")';
    });
    sheet.getRow(5).height = 23;
    sheet.getRow(6).height = 34;

    sheet.mergeCells('A8:F8');
    sheet.getCell('A8').value = 'งบผลการดำเนินงาน (Management P&L)';
    sheet.mergeCells('H8:J8');
    sheet.getCell('H8').value = 'กระแสเงินสดและภาระคงค้าง';
    ['A8', 'H8'].forEach(address => {
      const cell = sheet.getCell(address);
      cell.fill = fill(COLORS.slate);
      cell.font = { name: FONT, size: 11, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle' };
    });

    const costLastRow = Math.max(6, 5 + financial.costRows.length);
    const expenseLastRow = Math.max(6, 5 + financial.expenseRows.length);
    const cashLastRow = Math.max(6, 5 + financial.cashRows.length);
    const expensePnlRange = `'ค่าใช้จ่ายและค่าแรง'!$K$6:$K$${expenseLastRow}`;
    const expenseCategoryRange = `'ค่าใช้จ่ายและค่าแรง'!$F$6:$F$${expenseLastRow}`;
    const expenseScopeRange = `'ค่าใช้จ่ายและค่าแรง'!$I$6:$I$${expenseLastRow}`;
    const pnlRows = [
      [9, 'รายได้จากการขายหน้าร้าน', totals.storeRevenue, 'ยอดบิลสุทธิ ไม่รวมบิลยกเลิก/คืนทั้งบิล', `SUM('ต้นทุนและกำไรรายสินค้า'!$R$6:$R$${costLastRow})`],
      [10, 'รายได้โครงการจากงวดงาน', totals.projectRevenue, 'ใช้รายการงวดงานที่รับรู้รายได้ ป้องกันนับบิลเบิกของซ้ำ', `SUMIFS('กระแสเงินสด'!$J$6:$J$${cashLastRow},'กระแสเงินสด'!$D$6:$D$${cashLastRow},"รับเงินงวดโครงการ")`],
      [11, 'รายได้รวม', totals.totalRevenue, 'รวมรายได้หน้าร้านและรายได้โครงการ', 'SUM(B9:B10)'],
      [13, 'หัก ต้นทุนสินค้าที่ขาย (COGS)', -totals.totalCogs, 'ต้นทุนต่อหน่วย ณ เวลาขาย × จำนวนสุทธิหลังคืน', `-SUM('ต้นทุนและกำไรรายสินค้า'!$T$6:$T$${costLastRow})`],
      [14, 'กำไรขั้นต้น', totals.grossProfit, 'รายได้รวมลบต้นทุนขาย', 'B11+B13'],
      [16, 'หัก รายจ่ายดำเนินงานร้าน', -totals.storeExpenses, 'ไม่รวมซื้อสต็อก ชำระเจ้าหนี้ เงินคืน และค่าแรงที่นับแยก', `-SUMIFS(${expensePnlRange},${expenseCategoryRange},"รายจ่ายดำเนินงาน")`],
      [17, 'หัก รายจ่าย/วัสดุโครงการ', -totals.projectExpenses, 'สินค้าเบิกใช้โครงการใช้ต้นทุนจริง ไม่ใช้ราคาขาย', `-SUM(SUMIFS(${expensePnlRange},${expenseCategoryRange},"รายจ่ายโครงการ"),SUMIFS(${expensePnlRange},${expenseCategoryRange},"สินค้าเบิกใช้ในโครงการ"))`],
      [18, 'หัก ค่าแรงหน้าร้าน', -totals.storeWages, financial.laborBasis, `-SUM(SUMIFS(${expensePnlRange},${expenseScopeRange},"หน้าร้าน",${expenseCategoryRange},"ค่าแรงค้างรับรู้จากเช็คชื่อ"),SUMIFS(${expensePnlRange},${expenseScopeRange},"หน้าร้าน",${expenseCategoryRange},"ค่าแรงบันทึกในรายจ่าย"),SUMIFS(${expensePnlRange},${expenseScopeRange},"หน้าร้าน",${expenseCategoryRange},"เงินเดือนที่จ่ายจริง"))`],
      [19, 'หัก ค่าแรงโครงการ', -totals.projectWages, 'แยกจากหมายเหตุสถานที่ทำงานในเช็คชื่อ', `-SUMIFS(${expensePnlRange},${expenseScopeRange},"โครงการ",${expenseCategoryRange},"ค่าแรงค้างรับรู้จากเช็คชื่อ")`],
      [20, 'ค่าใช้จ่ายดำเนินงานรวม', -totals.totalOperatingExpenses, 'รวมรายจ่ายและค่าแรงทั้งหมดที่มีผลต่อกำไร', 'SUM(B16:B19)'],
      [22, 'กำไรสุทธิจากการดำเนินงาน', totals.netProfit, 'กำไรขั้นต้นลบค่าใช้จ่ายดำเนินงานรวม', 'B14+B20'],
      [23, 'อัตรากำไรสุทธิ', totals.netMargin, 'กำไรสุทธิหารด้วยรายได้รวม', 'IFERROR(B22/B11,0)'],
    ];
    pnlRows.forEach(([rowNumber, label, result, note, formula]) => {
      sheet.getCell(rowNumber, 1).value = label;
      sheet.mergeCells(rowNumber, 3, rowNumber, 6);
      sheet.getCell(rowNumber, 3).value = note;
      formulaValue(sheet.getCell(rowNumber, 2), formula, result, rowNumber === 23 ? '0.0%' : '#,##0.00;[Red](#,##0.00)');
      sheet.getCell(rowNumber, 1).font = { name: FONT, size: 9.5, bold: [11, 14, 20, 22, 23].includes(rowNumber), color: { argb: COLORS.navy } };
      sheet.getCell(rowNumber, 2).font = { name: FONT, size: [22, 23].includes(rowNumber) ? 12 : 9.5, bold: [11, 14, 20, 22, 23].includes(rowNumber), color: { argb: rowNumber === 22 ? (totals.netProfit >= 0 ? COLORS.green : COLORS.red) : COLORS.navy } };
      sheet.getCell(rowNumber, 2).alignment = { horizontal: 'right' };
      sheet.getCell(rowNumber, 3).font = { name: FONT, size: 8.5, italic: true, color: { argb: COLORS.muted } };
      sheet.getCell(rowNumber, 3).alignment = { wrapText: true };
      if ([11, 14, 20, 22].includes(rowNumber)) {
        for (let column = 1; column <= 6; column += 1) sheet.getCell(rowNumber, column).fill = fill(rowNumber === 22 ? (totals.netProfit >= 0 ? COLORS.greenSoft : COLORS.redSoft) : COLORS.soft);
      }
      sheet.getRow(rowNumber).height = 24;
    });

    const cashRows = [
      ['เงินรับจริงรวม', totals.cashIn, COLORS.green],
      ['เงินจ่ายจริงรวม', -totals.cashOut, COLORS.red],
      ['กระแสเงินสดสุทธิ', totals.netCash, totals.netCash >= 0 ? COLORS.teal : COLORS.red],
      ['ซื้อสินค้าแบบจ่ายทันที', -totals.purchasesPaid, COLORS.amber],
      ['เงินเดือนที่จ่ายจริง', -totals.payrollPaid, COLORS.purple],
      ['เงินเบิกล่วงหน้า', -totals.advancesPaid, COLORS.amber],
      ['เงินคืนลูกค้า', -totals.refundsPaid, COLORS.red],
      ['ลูกหนี้คงค้างปัจจุบัน', totals.currentCustomerDebt, COLORS.blue],
      ['เจ้าหนี้คงค้างปัจจุบัน', -totals.currentPayable, COLORS.red],
      ['บิลเบิกของ/บิลโครงการ', totals.projectBillValue, COLORS.muted],
    ];
    cashRows.forEach((item, index) => {
      const rowNumber = 9 + index;
      sheet.mergeCells(rowNumber, 8, rowNumber, 9);
      sheet.getCell(rowNumber, 8).value = item[0];
      sheet.getCell(rowNumber, 10).value = item[1];
      sheet.getCell(rowNumber, 8).font = { name: FONT, size: 9, bold: index === 2, color: { argb: COLORS.navy } };
      sheet.getCell(rowNumber, 10).font = { name: FONT, size: index === 2 ? 11 : 9, bold: index === 2, color: { argb: item[2] } };
      sheet.getCell(rowNumber, 10).numFmt = '#,##0.00;[Red](#,##0.00)';
      sheet.getCell(rowNumber, 10).alignment = { horizontal: 'right' };
      for (let column = 8; column <= 10; column += 1) sheet.getCell(rowNumber, column).border = { bottom: { style: 'hair', color: { argb: COLORS.line } } };
      if (index === 2) for (let column = 8; column <= 10; column += 1) sheet.getCell(rowNumber, column).fill = fill(totals.netCash >= 0 ? COLORS.tealSoft : COLORS.redSoft);
    });

    const warningRow = 26;
    sheet.mergeCells(warningRow, 1, warningRow, 10);
    sheet.getCell(warningRow, 1).value = financial.warnings.length
      ? `ข้อควรตรวจสอบ: ${financial.warnings.join(' • ')}`
      : 'สถานะข้อมูล: ไม่พบคำเตือนสำคัญ ยอดรวมผ่านการกระทบยอดเบื้องต้น';
    sheet.getCell(warningRow, 1).fill = fill(financial.warnings.length ? COLORS.amberSoft : COLORS.greenSoft);
    sheet.getCell(warningRow, 1).font = { name: FONT, size: 9, italic: true, color: { argb: financial.warnings.length ? COLORS.amber : COLORS.green } };
    sheet.getCell(warningRow, 1).alignment = { vertical: 'middle', wrapText: true };
    sheet.getRow(warningRow).height = Math.min(72, 30 + financial.warnings.length * 7);
    applyWidths(sheet, [32, 18, 18, 18, 18, 18, 3, 23, 13, 18]);
    sheet.pageSetup.printArea = `A1:J${warningRow}`;
  }

  function addCostDetailSheet(workbook, financial) {
    const columns = [
      'ลำดับ', 'วันที่ขาย', 'เวลาขาย', 'เลขที่บิล', 'ลูกค้า', 'พนักงานขาย', 'สถานะบิล', 'รหัสสินค้า', 'ชื่อสินค้า', 'บาร์โค้ด', 'หมวดสินค้า', 'หน่วย',
      'จำนวนขายสุทธิ', 'จำนวนคืนที่หัก', 'ราคาขาย/หน่วย', 'ยอดก่อนส่วนลด', 'ส่วนลดจัดสรร', 'ยอดขายสุทธิ', 'ต้นทุน/หน่วย', 'ต้นทุนรวม', 'กำไรขั้นต้น', 'อัตรากำไร', 'แหล่งต้นทุน',
    ];
    const sheet = workbook.addWorksheet('ต้นทุนและกำไรรายสินค้า', { properties: { tabColor: { argb: COLORS.amber } } });
    baseSheet(sheet, 'ต้นทุนสินค้าและกำไรขั้นต้นรายบรรทัด', `ตรวจสอบต้นทุนทุกสินค้าที่ขายในช่วง ${thaiDateTime(financial.start)} ถึง ${thaiDateTime(financial.end)}`, columns.length, true);
    styleHeader(sheet.addRow(columns));
    financial.costRows.forEach((item, index) => {
      const date = new Date(item.date);
      const row = sheet.addRow([
        index + 1, Number.isNaN(date.getTime()) ? '' : date, Number.isNaN(date.getTime()) ? '' : date,
        item.billNo, item.customer, item.staff, item.status, item.productId, item.productName, item.barcode, item.category, item.unit,
        item.soldQty, item.returnedQty, item.unitPrice, item.grossSales, item.allocatedDiscount, item.netSales,
        item.unitCost, item.totalCost, item.grossProfit, item.margin, item.costSource,
      ]);
      row.getCell(2).numFmt = 'dd/mm/yyyy';
      row.getCell(3).numFmt = 'hh:mm';
      [13, 14].forEach(column => { row.getCell(column).numFmt = '#,##0.######'; });
      [15, 16, 17, 18, 19, 20, 21].forEach(column => { row.getCell(column).numFmt = '#,##0.00;[Red](#,##0.00)'; });
      row.getCell(22).numFmt = '0.0%';
      styleStatusCell(row.getCell(7), item.status);
      if (/ไม่พบข้อมูลต้นทุน/.test(item.costSource)) {
        row.getCell(19).fill = fill(COLORS.redSoft);
        row.getCell(23).fill = fill(COLORS.redSoft);
        row.getCell(23).font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.red } };
      }
    });
    const firstDataRow = 6;
    const lastDataRow = 5 + financial.costRows.length;
    if (financial.costRows.length) styleDataRows(sheet, firstDataRow, lastDataRow, columns.length);
    financial.costRows.forEach((item, index) => {
      styleStatusCell(sheet.getRow(firstDataRow + index).getCell(7), item.status);
      if (/ไม่พบข้อมูลต้นทุน/.test(item.costSource)) {
        sheet.getRow(firstDataRow + index).getCell(19).fill = fill(COLORS.redSoft);
        sheet.getRow(firstDataRow + index).getCell(23).fill = fill(COLORS.redSoft);
      }
    });
    if (!financial.costRows.length) {
      sheet.mergeCells(6, 1, 6, columns.length);
      sheet.getCell(6, 1).value = 'ไม่พบรายการขายที่ใช้คำนวณต้นทุนในช่วงนี้';
      sheet.getCell(6, 1).alignment = { horizontal: 'center' };
      sheet.getCell(6, 1).font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
    }
    const totalRow = sheet.getRow(financial.costRows.length ? lastDataRow + 1 : 7);
    totalRow.getCell(1).value = 'รวม / กระทบยอด';
    sheet.mergeCells(totalRow.number, 1, totalRow.number, 12);
    const sumColumns = { 13: 'soldQty', 14: 'returnedQty', 16: 'grossSales', 17: 'allocatedDiscount', 18: 'netSales', 20: 'totalCost', 21: 'grossProfit' };
    Object.entries(sumColumns).forEach(([column, key]) => {
      const col = Number(column);
      const result = financial.costRows.reduce((sum, row) => sum + number(row[key]), 0);
      totalRow.getCell(col).value = financial.costRows.length ? { formula: `SUM(${sheet.getColumn(col).letter}${firstDataRow}:${sheet.getColumn(col).letter}${lastDataRow})`, result: money(result) } : 0;
      totalRow.getCell(col).numFmt = [13, 14].includes(col) ? '#,##0.######' : '#,##0.00;[Red](#,##0.00)';
    });
    totalRow.getCell(22).value = { formula: `IFERROR(U${totalRow.number}/R${totalRow.number},0)`, result: financial.totals.storeRevenue > 0 ? (financial.totals.storeRevenue - financial.totals.storeCogs) / financial.totals.storeRevenue : 0 };
    totalRow.getCell(22).numFmt = '0.0%';
    for (let column = 1; column <= columns.length; column += 1) {
      totalRow.getCell(column).fill = fill(COLORS.slate);
      totalRow.getCell(column).font = { name: FONT, size: 9.5, bold: true, color: { argb: COLORS.white } };
      totalRow.getCell(column).border = thinBorder();
    }
    applyWidths(sheet, [8, 13, 10, 16, 23, 17, 17, 15, 30, 17, 20, 13, 15, 15, 15, 17, 16, 17, 16, 17, 17, 14, 30]);
    addAutoFilter(sheet, 5, columns.length, Math.max(5, lastDataRow), totalRow.number);
  }

  function addExpenseDetailSheet(workbook, financial) {
    const columns = ['ลำดับ', 'วันที่', 'เวลา', 'แหล่งข้อมูล', 'รหัสอ้างอิง', 'ประเภทที่จัดหมวด', 'รายละเอียด', 'วิธีชำระ', 'ขอบเขต', 'ยอดที่บันทึก', 'ผลต่องบกำไร–ขาดทุน', 'เงินรับ', 'เงินจ่าย', 'หลักการนับ/หมายเหตุ'];
    const sheet = workbook.addWorksheet('ค่าใช้จ่ายและค่าแรง', { properties: { tabColor: { argb: COLORS.red } } });
    baseSheet(sheet, 'รายละเอียดค่าใช้จ่าย ค่าแรง และรายการที่ป้องกันการหักซ้ำ', `ทุกแถวแสดงทั้งผลต่อกำไรและผลต่อเงินสด • ช่วง ${thaiDateTime(financial.start)} ถึง ${thaiDateTime(financial.end)}`, columns.length, true);
    styleHeader(sheet.addRow(columns));
    financial.expenseRows.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)).forEach((item, index) => {
      const date = new Date(item.date);
      const row = sheet.addRow([
        index + 1, Number.isNaN(date.getTime()) ? '' : date, Number.isNaN(date.getTime()) ? '' : date,
        item.source, text(item.sourceId, '-'), item.category, item.description, item.method, item.scope,
        item.recordedAmount, item.pnlImpact, item.cashIn, item.cashOut, item.note,
      ]);
      row.getCell(2).numFmt = 'dd/mm/yyyy';
      row.getCell(3).numFmt = 'hh:mm';
      [10, 11, 12, 13].forEach(column => { row.getCell(column).numFmt = '#,##0.00;[Red](#,##0.00)'; });
      if (item.pnlImpact === 0 && item.recordedAmount > 0) {
        row.getCell(11).fill = fill(COLORS.amberSoft);
        row.getCell(14).fill = fill(COLORS.amberSoft);
      }
    });
    const firstDataRow = 6;
    const lastDataRow = 5 + financial.expenseRows.length;
    if (financial.expenseRows.length) styleDataRows(sheet, firstDataRow, lastDataRow, columns.length);
    financial.expenseRows.forEach((item, index) => {
      if (item.pnlImpact === 0 && item.recordedAmount > 0) {
        sheet.getRow(firstDataRow + index).getCell(11).fill = fill(COLORS.amberSoft);
        sheet.getRow(firstDataRow + index).getCell(14).fill = fill(COLORS.amberSoft);
      }
    });
    if (!financial.expenseRows.length) {
      sheet.mergeCells(6, 1, 6, columns.length);
      sheet.getCell(6, 1).value = 'ไม่พบค่าใช้จ่ายหรือค่าแรงในช่วงที่เลือก';
      sheet.getCell(6, 1).alignment = { horizontal: 'center' };
    }
    const totalRow = sheet.getRow(financial.expenseRows.length ? lastDataRow + 1 : 7);
    totalRow.getCell(1).value = 'รวม';
    sheet.mergeCells(totalRow.number, 1, totalRow.number, 9);
    [10, 11, 12, 13].forEach(column => {
      const result = financial.expenseRows.reduce((sum, row) => sum + number({ 10: row.recordedAmount, 11: row.pnlImpact, 12: row.cashIn, 13: row.cashOut }[column]), 0);
      totalRow.getCell(column).value = financial.expenseRows.length ? { formula: `SUM(${sheet.getColumn(column).letter}${firstDataRow}:${sheet.getColumn(column).letter}${lastDataRow})`, result: money(result) } : 0;
      totalRow.getCell(column).numFmt = '#,##0.00;[Red](#,##0.00)';
    });
    for (let column = 1; column <= columns.length; column += 1) {
      totalRow.getCell(column).fill = fill(COLORS.slate);
      totalRow.getCell(column).font = { name: FONT, size: 9.5, bold: true, color: { argb: COLORS.white } };
      totalRow.getCell(column).border = thinBorder();
    }
    applyWidths(sheet, [8, 13, 10, 20, 16, 25, 35, 17, 13, 17, 21, 16, 16, 48]);
    addAutoFilter(sheet, 5, columns.length, Math.max(5, lastDataRow), totalRow.number);
  }

  function addCashFlowSheet(workbook, financial) {
    const columns = ['ลำดับ', 'วันที่', 'เวลา', 'ประเภทรายการ', 'หมวด', 'รายละเอียด', 'วิธีรับ/จ่าย', 'แหล่งข้อมูล', 'เลขอ้างอิง', 'เงินเข้า', 'เงินออก', 'เงินสุทธิ', 'หมายเหตุ'];
    const sheet = workbook.addWorksheet('กระแสเงินสด', { properties: { tabColor: { argb: COLORS.green } } });
    baseSheet(sheet, 'กระแสเงินสดรับ–จ่ายแบบละเอียด', `เงินสดจริงแยกจากกำไรทางบัญชี • ช่วง ${thaiDateTime(financial.start)} ถึง ${thaiDateTime(financial.end)}`, columns.length, true);
    styleHeader(sheet.addRow(columns));
    financial.cashRows.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)).forEach((item, index) => {
      const date = new Date(item.date);
      const row = sheet.addRow([
        index + 1, Number.isNaN(date.getTime()) ? '' : date, Number.isNaN(date.getTime()) ? '' : date,
        item.type, item.category, item.description, item.method, item.source, item.reference,
        item.cashIn, item.cashOut, money(item.cashIn - item.cashOut), item.note,
      ]);
      row.getCell(2).numFmt = 'dd/mm/yyyy';
      row.getCell(3).numFmt = 'hh:mm';
      [10, 11, 12].forEach(column => { row.getCell(column).numFmt = '#,##0.00;[Red](#,##0.00)'; });
      row.getCell(item.cashIn > 0 ? 10 : 11).fill = fill(item.cashIn > 0 ? COLORS.greenSoft : COLORS.redSoft);
    });
    const firstDataRow = 6;
    const lastDataRow = 5 + financial.cashRows.length;
    if (financial.cashRows.length) styleDataRows(sheet, firstDataRow, lastDataRow, columns.length);
    financial.cashRows.forEach((item, index) => sheet.getRow(firstDataRow + index).getCell(item.cashIn > 0 ? 10 : 11).fill = fill(item.cashIn > 0 ? COLORS.greenSoft : COLORS.redSoft));
    if (!financial.cashRows.length) {
      sheet.mergeCells(6, 1, 6, columns.length);
      sheet.getCell(6, 1).value = 'ไม่พบกระแสเงินสดในช่วงที่เลือก';
      sheet.getCell(6, 1).alignment = { horizontal: 'center' };
    }
    const totalRow = sheet.getRow(financial.cashRows.length ? lastDataRow + 1 : 7);
    totalRow.getCell(1).value = 'รวมกระแสเงินสด';
    sheet.mergeCells(totalRow.number, 1, totalRow.number, 9);
    [[10, financial.totals.cashIn], [11, financial.totals.cashOut], [12, financial.totals.netCash]].forEach(([column, result]) => {
      totalRow.getCell(column).value = financial.cashRows.length ? { formula: `${column === 12 ? '' : 'SUM('}${column === 12 ? `J${totalRow.number}-K${totalRow.number}` : `${sheet.getColumn(column).letter}${firstDataRow}:${sheet.getColumn(column).letter}${lastDataRow})`}`, result } : result;
      totalRow.getCell(column).numFmt = '#,##0.00;[Red](#,##0.00)';
    });
    for (let column = 1; column <= columns.length; column += 1) {
      totalRow.getCell(column).fill = fill(COLORS.slate);
      totalRow.getCell(column).font = { name: FONT, size: 9.5, bold: true, color: { argb: COLORS.white } };
      totalRow.getCell(column).border = thinBorder();
    }
    applyWidths(sheet, [8, 13, 10, 25, 22, 36, 18, 20, 17, 17, 17, 17, 45]);
    addAutoFilter(sheet, 5, columns.length, Math.max(5, lastDataRow), totalRow.number);
  }

  function addChecksSheet(workbook, financial, data) {
    const sheet = workbook.addWorksheet('ตรวจสอบรายงาน', { properties: { tabColor: { argb: COLORS.purple } } });
    baseSheet(sheet, 'การกระทบยอดและคุณภาพข้อมูล', 'ใช้หน้านี้ตรวจว่ารายงานรวมตรงกับรายละเอียด และดูข้อจำกัดของข้อมูลต้นทาง', 7, false);
    const columns = ['ลำดับ', 'รายการตรวจสอบ', 'ค่าจากสรุป', 'ค่าจากรายละเอียด', 'ผลต่าง', 'สถานะ', 'คำอธิบาย/วิธีแก้'];
    styleHeader(sheet.addRow(columns));
    const detailRevenue = money(financial.costRows.reduce((sum, row) => sum + row.netSales, 0));
    const detailCogs = money(financial.costRows.reduce((sum, row) => sum + row.totalCost, 0));
    const detailExpenses = money(financial.expenseRows.reduce((sum, row) => sum + row.pnlImpact, 0));
    const detailCashIn = money(financial.cashRows.reduce((sum, row) => sum + row.cashIn, 0));
    const detailCashOut = money(financial.cashRows.reduce((sum, row) => sum + row.cashOut, 0));
    const missingCosts = financial.costRows.filter(row => /ไม่พบข้อมูลต้นทุน/.test(row.costSource)).length;
    const checks = [
      ['ยอดขายหน้าร้านเทียบรายละเอียดสินค้า', financial.totals.storeRevenue, detailRevenue, money(financial.totals.storeRevenue - detailRevenue), Math.abs(financial.totals.storeRevenue - detailRevenue) <= 0.02 ? 'ผ่าน' : 'เตือน', 'ผลต่างควรเป็นศูนย์; แถวปรับปรุงยอดบิลจะช่วยกระทบยอด'],
      ['ต้นทุนขายเทียบรายละเอียดสินค้า', financial.totals.totalCogs, detailCogs, money(financial.totals.totalCogs - detailCogs), Math.abs(financial.totals.totalCogs - detailCogs) <= 0.02 ? 'ผ่าน' : 'เตือน', 'รวมต้นทุนต่อหน่วยคูณจำนวนขายสุทธิ'],
      ['ค่าใช้จ่าย P&L เทียบรายละเอียด', financial.totals.totalOperatingExpenses, detailExpenses, money(financial.totals.totalOperatingExpenses - detailExpenses), Math.abs(financial.totals.totalOperatingExpenses - detailExpenses) <= 0.02 ? 'ผ่าน' : 'เตือน', 'รวมเฉพาะคอลัมน์ผลต่องบกำไร–ขาดทุน'],
      ['เงินรับเทียบกระแสเงินสด', financial.totals.cashIn, detailCashIn, money(financial.totals.cashIn - detailCashIn), Math.abs(financial.totals.cashIn - detailCashIn) <= 0.02 ? 'ผ่าน' : 'เตือน', 'เงินรับจากขาย รับชำระหนี้ รับชำระบิล และโครงการ'],
      ['เงินจ่ายเทียบกระแสเงินสด', financial.totals.cashOut, detailCashOut, money(financial.totals.cashOut - detailCashOut), Math.abs(financial.totals.cashOut - detailCashOut) <= 0.02 ? 'ผ่าน' : 'เตือน', 'ซื้อสินค้า รายจ่าย เงินเดือน เบิกเงิน โครงการ และเงินคืน'],
      ['รายการขายที่ไม่มีต้นทุน', 0, missingCosts, missingCosts, missingCosts === 0 ? 'ผ่าน' : 'เตือน', 'กรอกต้นทุนสินค้าให้ครบเพื่อไม่ให้กำไรสูงกว่าจริง'],
    ];
    checks.forEach((check, index) => {
      const row = sheet.addRow([index + 1, ...check]);
      [3, 4, 5].forEach(column => { row.getCell(column).numFmt = '#,##0.00;[Red](#,##0.00)'; });
      styleStatusCell(row.getCell(6), check[4] === 'ผ่าน' ? 'สำเร็จ' : 'รอตรวจสอบ');
    });
    const firstDataRow = 6;
    const lastCheckRow = 5 + checks.length;
    styleDataRows(sheet, firstDataRow, lastCheckRow, columns.length);
    checks.forEach((check, index) => styleStatusCell(sheet.getRow(firstDataRow + index).getCell(6), check[4] === 'ผ่าน' ? 'สำเร็จ' : 'รอตรวจสอบ'));

    let rowNumber = lastCheckRow + 2;
    sheet.mergeCells(rowNumber, 1, rowNumber, 7);
    sheet.getCell(rowNumber, 1).value = 'จำนวนข้อมูลต้นทางที่นำมาใช้';
    sheet.getCell(rowNumber, 1).fill = fill(COLORS.slate);
    sheet.getCell(rowNumber, 1).font = { name: FONT, size: 11, bold: true, color: { argb: COLORS.white } };
    rowNumber += 1;
    const sourceCounts = [
      [BILL_TABLE, data.bills.length], [ITEM_TABLE, data.items.length], [EXPENSE_TABLE, data.financial.expenses.length],
      [ATTENDANCE_TABLE, data.financial.attendance.length], [PAYROLL_TABLE, data.financial.payroll.length], [PURCHASE_TABLE, data.financial.purchases.length],
      [ADVANCE_TABLE, data.financial.advances.length], [DEBT_PAYMENT_TABLE, data.financial.debtPayments.length],
      [PROJECT_EXPENSE_TABLE, data.financial.projectExpenses.length], [PROJECT_MILESTONE_TABLE, data.financial.milestones.length],
      [CASH_TRANSACTION_TABLE, data.financial.cashTransactions.length],
    ];
    sourceCounts.forEach(([source, count]) => {
      sheet.getCell(rowNumber, 1).value = source;
      sheet.mergeCells(rowNumber, 1, rowNumber, 3);
      sheet.getCell(rowNumber, 4).value = count;
      sheet.getCell(rowNumber, 4).numFmt = '#,##0';
      sheet.getCell(rowNumber, 5).value = 'แถว';
      rowNumber += 1;
    });

    sheet.mergeCells(rowNumber + 1, 1, rowNumber + 1, 7);
    sheet.getCell(rowNumber + 1, 1).value = financial.warnings.length ? `คำเตือน: ${financial.warnings.join(' • ')}` : 'ไม่พบคำเตือนจากแหล่งข้อมูล';
    sheet.getCell(rowNumber + 1, 1).fill = fill(financial.warnings.length ? COLORS.amberSoft : COLORS.greenSoft);
    sheet.getCell(rowNumber + 1, 1).font = { name: FONT, size: 9, color: { argb: financial.warnings.length ? COLORS.amber : COLORS.green } };
    sheet.getCell(rowNumber + 1, 1).alignment = { wrapText: true };
    sheet.getRow(rowNumber + 1).height = Math.min(80, 30 + financial.warnings.length * 8);
    applyWidths(sheet, [9, 38, 18, 18, 16, 14, 52]);
    sheet.pageSetup.printArea = `A1:G${rowNumber + 1}`;
  }

  function addSummarySheet(workbook, report, bills, start, end, shop) {
    const sheet = workbook.addWorksheet('สรุปรายงาน', { properties: { tabColor: { argb: COLORS.teal } } });
    const shopName = text(shop.shop_name, 'ร้านค้า');
    baseSheet(sheet, `${shopName} · รายงานประวัติการขาย`, `ช่วงที่เลือก: ${thaiDateTime(start)} ถึง ${thaiDateTime(end)}`, 10, true);
    sheet.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];

    const validSales = money(report.validBills.reduce((sum, bill) => sum + effectiveBillTotal(bill), 0));
    const discounts = money(report.validBills.reduce((sum, bill) => sum + number(bill.discount), 0));
    const soldQty = quantity(report.soldItems.reduce((sum, item) => sum + number(item.qty), 0));
    const customerCount = new Set(report.validBills.map(bill => text(bill.customer_name, 'ลูกค้าทั่วไป'))).size;
    const cards = [
      ['จำนวนบิลในช่วง', bills.length, COLORS.blueSoft, COLORS.blue, '#,##0'],
      ['บิลที่นับเป็นยอดขาย', report.validBills.length, COLORS.greenSoft, COLORS.green, '#,##0'],
      ['ยอดขายสุทธิ', validSales, COLORS.tealSoft, COLORS.teal, '#,##0.00" บาท"'],
      ['ส่วนลดรวม', discounts, COLORS.amberSoft, COLORS.amber, '#,##0.00" บาท"'],
      ['จำนวนหน่วยที่ขาย', soldQty, COLORS.purpleSoft, COLORS.purple, '#,##0.######'],
    ];
    cards.forEach((card, index) => {
      const firstColumn = index * 2 + 1;
      sheet.mergeCells(5, firstColumn, 5, firstColumn + 1);
      sheet.mergeCells(6, firstColumn, 6, firstColumn + 1);
      const label = sheet.getCell(5, firstColumn);
      label.value = card[0];
      label.fill = fill(card[2]);
      label.font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.muted } };
      label.alignment = { horizontal: 'center', vertical: 'middle' };
      const value = sheet.getCell(6, firstColumn);
      value.value = card[1];
      value.fill = fill(card[2]);
      value.font = { name: FONT, size: 17, bold: true, color: { argb: card[3] } };
      value.alignment = { horizontal: 'center', vertical: 'middle' };
      value.numFmt = card[4];
    });
    sheet.getRow(5).height = 23;
    sheet.getRow(6).height = 35;

    const methodMap = new Map();
    report.validBills.forEach(bill => {
      const key = text(bill.method, 'ไม่ระบุวิธีชำระ');
      const old = methodMap.get(key) || { count: 0, sales: 0 };
      old.count += 1;
      old.sales += effectiveBillTotal(bill);
      methodMap.set(key, old);
    });
    const statusMap = new Map();
    (bills || []).forEach(bill => {
      const key = text(bill.status, 'ไม่ระบุสถานะ');
      const old = statusMap.get(key) || { count: 0, sales: 0 };
      old.count += 1;
      old.sales += effectiveBillTotal(bill);
      statusMap.set(key, old);
    });

    sheet.mergeCells('A8:D8');
    sheet.getCell('A8').value = 'สรุปตามวิธีชำระเงิน';
    sheet.mergeCells('F8:I8');
    sheet.getCell('F8').value = 'สรุปตามสถานะบิล';
    ['A8', 'F8'].forEach(address => {
      const cell = sheet.getCell(address);
      cell.fill = fill(COLORS.slate);
      cell.font = { name: FONT, size: 11, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    sheet.getRow(8).height = 25;

    const methodHeader = sheet.getRow(9);
    ['วิธีชำระเงิน', 'จำนวนบิล', 'ยอดขายสุทธิ', 'สัดส่วนยอดขาย'].forEach((value, index) => { methodHeader.getCell(index + 1).value = value; });
    for (let column = 1; column <= 4; column += 1) {
      const cell = methodHeader.getCell(column);
      cell.fill = fill(COLORS.tealSoft);
      cell.font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.teal } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder();
    }
    const statusHeader = sheet.getRow(9);
    ['สถานะบิล', 'จำนวนบิล', 'ยอดตามสถานะ', 'สัดส่วนจำนวนบิล'].forEach((value, index) => { statusHeader.getCell(index + 6).value = value; });
    for (let column = 6; column <= 9; column += 1) {
      const cell = statusHeader.getCell(column);
      cell.fill = fill(COLORS.blueSoft);
      cell.font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.blue } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder();
    }

    const methodRows = [...methodMap.entries()].sort((a, b) => b[1].sales - a[1].sales);
    const statusRows = [...statusMap.entries()].sort((a, b) => b[1].count - a[1].count);
    const breakdownCount = Math.max(methodRows.length, statusRows.length, 1);
    for (let index = 0; index < breakdownCount; index += 1) {
      const row = sheet.getRow(10 + index);
      const method = methodRows[index];
      if (method) {
        row.getCell(1).value = method[0];
        row.getCell(2).value = method[1].count;
        row.getCell(3).value = money(method[1].sales);
        row.getCell(4).value = validSales > 0 ? method[1].sales / validSales : 0;
        row.getCell(3).numFmt = '#,##0.00';
        row.getCell(4).numFmt = '0.0%';
      }
      const status = statusRows[index];
      if (status) {
        row.getCell(6).value = status[0];
        row.getCell(7).value = status[1].count;
        row.getCell(8).value = money(status[1].sales);
        row.getCell(9).value = bills.length ? status[1].count / bills.length : 0;
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(9).numFmt = '0.0%';
      }
      [1, 2, 3, 4, 6, 7, 8, 9].forEach(column => {
        const cell = row.getCell(column);
        cell.font = { name: FONT, size: 9, color: { argb: COLORS.navy } };
        cell.border = { bottom: { style: 'hair', color: { argb: COLORS.line } } };
        cell.alignment = { vertical: 'middle', horizontal: [2, 3, 4, 7, 8, 9].includes(column) ? 'right' : 'left' };
      });
    }

    const topStart = 11 + breakdownCount;
    sheet.mergeCells(topStart, 1, topStart, 4);
    sheet.getCell(topStart, 1).value = 'สินค้าเด่นตามจำนวน (10 อันดับแรก)';
    sheet.mergeCells(topStart, 6, topStart, 9);
    sheet.getCell(topStart, 6).value = 'สินค้าเด่นตามยอดขาย (10 อันดับแรก)';
    [sheet.getCell(topStart, 1), sheet.getCell(topStart, 6)].forEach(cell => {
      cell.fill = fill(COLORS.slate);
      cell.font = { name: FONT, size: 11, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    const topHeader = sheet.getRow(topStart + 1);
    ['อันดับ', 'สินค้า', 'จำนวน', 'ยอดขาย'].forEach((value, index) => { topHeader.getCell(index + 1).value = value; });
    ['อันดับ', 'สินค้า', 'ยอดขาย', 'จำนวน'].forEach((value, index) => { topHeader.getCell(index + 6).value = value; });
    [1, 2, 3, 4, 6, 7, 8, 9].forEach(column => {
      const cell = topHeader.getCell(column);
      cell.fill = fill(COLORS.tealSoft);
      cell.font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.teal } };
      cell.border = thinBorder();
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    for (let index = 0; index < 10; index += 1) {
      const row = sheet.getRow(topStart + 2 + index);
      const quantity = report.byQuantity[index];
      const sales = report.bySales[index];
      if (quantity) {
        [index + 1, quantity.name, quantity.qty, quantity.sales].forEach((value, ci) => { row.getCell(ci + 1).value = value; });
        row.getCell(3).numFmt = '#,##0.######';
        row.getCell(4).numFmt = '#,##0.00';
      }
      if (sales) {
        [index + 1, sales.name, sales.sales, sales.qty].forEach((value, ci) => { row.getCell(ci + 6).value = value; });
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(9).numFmt = '#,##0.######';
      }
      [1, 2, 3, 4, 6, 7, 8, 9].forEach(column => {
        const cell = row.getCell(column);
        cell.font = { name: FONT, size: 9, color: { argb: COLORS.navy } };
        cell.border = { bottom: { style: 'hair', color: { argb: COLORS.line } } };
        cell.alignment = { vertical: 'middle', horizontal: [1, 3, 4, 6, 8, 9].includes(column) ? 'right' : 'left' };
      });
    }

    const noteRow = topStart + 13;
    sheet.mergeCells(noteRow, 1, noteRow, 10);
    sheet.getCell(noteRow, 1).value = `หมายเหตุ: ลูกค้าที่ไม่ระบุชื่อจะแสดงเป็น “ลูกค้าทั่วไป” · มีลูกค้าในยอดขาย ${customerCount.toLocaleString('th-TH')} ราย · อันดับสินค้าตัดบิลยกเลิกและบิลคืนสินค้าทั้งบิลออก และใช้จำนวนคงเหลือหลังคืนบางส่วน`;
    sheet.getCell(noteRow, 1).fill = fill(COLORS.amberSoft);
    sheet.getCell(noteRow, 1).font = { name: FONT, size: 9, italic: true, color: { argb: COLORS.amber } };
    sheet.getCell(noteRow, 1).alignment = { vertical: 'middle', wrapText: true };
    sheet.getRow(noteRow).height = 33;
    sheet.pageSetup.printArea = `A1:J${noteRow}`;
    applyWidths(sheet, [8, 28, 15, 16, 3, 16, 28, 16, 16, 3]);
  }

  function addBillDetailSheet(workbook, report, bills, start, end) {
    const columns = [
      'ลำดับ', 'เลขที่บิล', 'วันที่ขาย', 'เวลาขาย', 'ชื่อลูกค้า', 'เบอร์โทรลูกค้า', 'ที่อยู่ / สถานที่จัดส่ง',
      'วิธีชำระเงิน', 'จำนวนรายการสินค้า', 'จำนวนหน่วยรวม', 'ยอดสินค้าตามรายการ', 'ส่วนลดทั้งบิล',
      'ยอดสุทธิของบิล', 'เงินมัดจำ', 'จำนวนเงินที่รับ', 'เงินทอน', 'รูปแบบรับสินค้า', 'สถานะจัดส่ง',
      'พนักงานขาย', 'สถานะบิล', 'หมายเหตุ', 'เหตุผลที่ยกเลิก',
    ];
    const sheet = workbook.addWorksheet('รายละเอียดบิล', { properties: { tabColor: { argb: COLORS.blue } } });
    baseSheet(sheet, 'รายละเอียดบิลขาย', `ทุกบิลในช่วง ${thaiDateTime(start)} ถึง ${thaiDateTime(end)} (รวมบิลยกเลิกและรายการคืนเพื่อการตรวจสอบ)`, columns.length, true);
    const headerRow = sheet.addRow(columns);
    styleHeader(headerRow);
    let totalItemCount = 0;
    let totalQty = 0;
    let totalItemSales = 0;
    (bills || []).forEach((bill, index) => {
      const date = new Date(bill.date);
      const billItems = report.itemsByBill.get(String(bill.id)) || [];
      const qty = quantity(billItems.reduce((sum, item) => sum + number(item.qty), 0));
      const sales = money(billItems.reduce((sum, item) => sum + itemTotal(item), 0));
      totalItemCount += billItems.length;
      totalQty += qty;
      totalItemSales += sales;
      const row = sheet.addRow([
        index + 1,
        text(bill.bill_no || bill.id, '-'),
        Number.isNaN(date.getTime()) ? '' : date,
        Number.isNaN(date.getTime()) ? '' : date,
        text(bill.customer_name, 'ลูกค้าทั่วไป'),
        text(bill.customer_phone || bill.delivery_phone, '-'),
        text(bill.delivery_address || bill.customer_address || bill.address, '-'),
        text(bill.method, 'ไม่ระบุวิธีชำระ'),
        billItems.length,
        qty,
        sales,
        money(bill.discount),
        effectiveBillTotal(bill),
        money(bill.deposit_amount),
        money(bill.received),
        money(bill.change),
        text(bill.delivery_mode, 'รับเอง / ไม่ระบุ'),
        text(bill.delivery_status, 'ไม่ระบุสถานะจัดส่ง'),
        text(bill.staff_name, '-'),
        text(bill.status, 'ไม่ระบุสถานะ'),
        text(bill.note, '-'),
        text(bill.cancel_reason, '-'),
      ]);
      row.getCell(3).numFmt = 'dd/mm/yyyy';
      row.getCell(4).numFmt = 'hh:mm';
      row.getCell(10).numFmt = '#,##0.######';
      [11, 12, 13, 14, 15, 16].forEach(column => { row.getCell(column).numFmt = '#,##0.00'; });
      styleStatusCell(row.getCell(20), bill.status);
    });
    const firstDataRow = 6;
    const lastDataRow = 5 + bills.length;
    styleDataRows(sheet, firstDataRow, lastDataRow, columns.length);
    (bills || []).forEach((bill, index) => styleStatusCell(sheet.getRow(firstDataRow + index).getCell(20), bill.status));

    const totalRow = sheet.getRow(lastDataRow + 1);
    totalRow.getCell(1).value = 'รวมทั้งหมด';
    sheet.mergeCells(totalRow.number, 1, totalRow.number, 8);
    const totals = {
      9: totalItemCount,
      10: money(totalQty),
      11: money(totalItemSales),
      12: money((bills || []).reduce((sum, bill) => sum + number(bill.discount), 0)),
      13: money((bills || []).reduce((sum, bill) => sum + effectiveBillTotal(bill), 0)),
      14: money((bills || []).reduce((sum, bill) => sum + number(bill.deposit_amount), 0)),
      15: money((bills || []).reduce((sum, bill) => sum + number(bill.received), 0)),
      16: money((bills || []).reduce((sum, bill) => sum + number(bill.change), 0)),
    };
    Object.entries(totals).forEach(([column, result]) => {
      const col = Number(column);
      const letter = sheet.getColumn(col).letter;
      totalRow.getCell(col).value = { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`, result };
      totalRow.getCell(col).numFmt = col === 9 ? '#,##0' : (col === 10 ? '#,##0.######' : '#,##0.00');
    });
    for (let column = 1; column <= columns.length; column += 1) {
      const cell = totalRow.getCell(column);
      cell.fill = fill(COLORS.slate);
      cell.font = { name: FONT, size: 9.5, bold: true, color: { argb: COLORS.white } };
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', horizontal: column >= 9 && column <= 16 ? 'right' : 'left' };
    }
    totalRow.height = 25;
    applyWidths(sheet, [8, 16, 13, 10, 24, 17, 34, 18, 13, 14, 17, 15, 17, 14, 16, 14, 19, 20, 18, 18, 30, 28]);
    addAutoFilter(sheet, 5, columns.length, lastDataRow, totalRow.number);
  }

  function addItemDetailSheet(workbook, report, items, start, end) {
    const columns = [
      'ลำดับ', 'เลขที่บิล', 'วันที่ขาย', 'เวลาขาย', 'ชื่อลูกค้า', 'เบอร์โทรลูกค้า', 'วิธีชำระเงิน',
      'สถานะบิล', 'ชื่อสินค้า', 'บาร์โค้ดสินค้า', 'หมวดสินค้า', 'จำนวน', 'หน่วย', 'ราคาต่อหน่วย',
      'ยอดขายก่อนส่วนลด', 'ส่วนลดที่เฉลี่ยให้รายการ', 'ยอดขายสุทธิของรายการ', 'พนักงานขาย', 'หมายเหตุบิล',
    ];
    const sheet = workbook.addWorksheet('รายการสินค้าในบิล', { properties: { tabColor: { argb: COLORS.green } } });
    baseSheet(sheet, 'รายการสินค้าที่ขาย แยกตามบิล', `รายละเอียดทุกรายการสินค้าในช่วง ${thaiDateTime(start)} ถึง ${thaiDateTime(end)}`, columns.length, true);
    styleHeader(sheet.addRow(columns));
    (items || []).forEach((item, index) => {
      const bill = report.billById.get(String(item.bill_id)) || {};
      const product = report.productById.get(String(item.product_id || '')) || {};
      const finance = report.itemFinancials.get(item) || { grossSales: itemTotal(item), allocatedDiscount: 0, netSales: itemTotal(item) };
      const date = new Date(bill.date || item.created_at);
      const row = sheet.addRow([
        index + 1,
        text(bill.bill_no || bill.id || item.bill_id, '-'),
        Number.isNaN(date.getTime()) ? '' : date,
        Number.isNaN(date.getTime()) ? '' : date,
        text(bill.customer_name, 'ลูกค้าทั่วไป'),
        text(bill.customer_phone || bill.delivery_phone, '-'),
        text(bill.method, 'ไม่ระบุวิธีชำระ'),
        text(bill.status, 'ไม่ระบุสถานะ'),
        text(item.name || product.name, 'ไม่ระบุชื่อสินค้า'),
        text(product.barcode, '-'),
        text(product.category, 'ไม่ระบุหมวดสินค้า'),
        quantity(item.qty),
        text(item.unit || product.unit, 'ไม่ระบุหน่วย'),
        money(item.price),
        finance.grossSales,
        finance.allocatedDiscount,
        finance.netSales,
        text(bill.staff_name, '-'),
        text(bill.note, '-'),
      ]);
      row.getCell(3).numFmt = 'dd/mm/yyyy';
      row.getCell(4).numFmt = 'hh:mm';
      row.getCell(12).numFmt = '#,##0.######';
      [14, 15, 16, 17].forEach(column => { row.getCell(column).numFmt = '#,##0.00'; });
      styleStatusCell(row.getCell(8), bill.status);
    });
    const firstDataRow = 6;
    const lastDataRow = 5 + items.length;
    if (items.length) styleDataRows(sheet, firstDataRow, lastDataRow, columns.length);
    (items || []).forEach((item, index) => {
      const bill = report.billById.get(String(item.bill_id)) || {};
      styleStatusCell(sheet.getRow(firstDataRow + index).getCell(8), bill.status);
    });
    if (!items.length) {
      const emptyRow = sheet.getRow(6);
      emptyRow.getCell(1).value = 'ไม่พบรายการสินค้าในบิลของช่วงเวลานี้';
      sheet.mergeCells(6, 1, 6, columns.length);
      emptyRow.getCell(1).font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
      emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      emptyRow.height = 28;
    }
    const totalRow = sheet.getRow(items.length ? lastDataRow + 1 : 7);
    totalRow.getCell(1).value = 'รวมทุกรายการ';
    sheet.mergeCells(totalRow.number, 1, totalRow.number, 11);
    const qtyTotal = quantity((items || []).reduce((sum, item) => sum + number(item.qty), 0));
    const grossTotal = money((items || []).reduce((sum, item) => sum + (report.itemFinancials.get(item)?.grossSales ?? itemTotal(item)), 0));
    const discountTotal = money((items || []).reduce((sum, item) => sum + number(report.itemFinancials.get(item)?.allocatedDiscount), 0));
    const netTotal = money((items || []).reduce((sum, item) => sum + (report.itemFinancials.get(item)?.netSales ?? itemTotal(item)), 0));
    totalRow.getCell(12).value = items.length ? { formula: `SUM(L${firstDataRow}:L${lastDataRow})`, result: qtyTotal } : 0;
    totalRow.getCell(15).value = items.length ? { formula: `SUM(O${firstDataRow}:O${lastDataRow})`, result: grossTotal } : 0;
    totalRow.getCell(16).value = items.length ? { formula: `SUM(P${firstDataRow}:P${lastDataRow})`, result: discountTotal } : 0;
    totalRow.getCell(17).value = items.length ? { formula: `SUM(Q${firstDataRow}:Q${lastDataRow})`, result: netTotal } : 0;
    totalRow.getCell(12).numFmt = '#,##0.######';
    [15, 16, 17].forEach(column => { totalRow.getCell(column).numFmt = '#,##0.00'; });
    for (let column = 1; column <= columns.length; column += 1) {
      const cell = totalRow.getCell(column);
      cell.fill = fill(COLORS.slate);
      cell.font = { name: FONT, size: 9.5, bold: true, color: { argb: COLORS.white } };
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', horizontal: [12, 15, 16, 17].includes(column) ? 'right' : 'left' };
    }
    totalRow.height = 25;
    applyWidths(sheet, [8, 16, 13, 10, 24, 17, 18, 18, 30, 18, 21, 13, 14, 16, 18, 18, 18, 18, 30]);
    addAutoFilter(sheet, 5, columns.length, lastDataRow, totalRow.number);
  }

  function addRankingSheet(workbook, rows, mode, start, end, overallTotal) {
    const byQuantity = mode === 'quantity';
    const title = byQuantity ? 'สินค้าขายดี 100 อันดับ ตามจำนวน' : 'สินค้าขายดี 100 อันดับ ตามยอดขาย';
    const sheetName = byQuantity ? 'ขายดีตามจำนวน' : 'ขายดีตามยอดขาย';
    const columns = [
      'อันดับ', 'ชื่อสินค้า', 'บาร์โค้ดสินค้า', 'หมวดสินค้า', 'หน่วยที่ขาย', 'จำนวนบิลที่มีสินค้า',
      'จำนวนที่ขาย', 'ยอดขายสุทธิ', 'ราคาขายสุทธิเฉลี่ยต่อหน่วย', byQuantity ? 'สัดส่วนจากจำนวนทั้งหมด' : 'สัดส่วนจากยอดขายทั้งหมด',
    ];
    const sheet = workbook.addWorksheet(sheetName, { properties: { tabColor: { argb: byQuantity ? COLORS.purple : COLORS.amber } } });
    baseSheet(sheet, title, `ช่วง ${thaiDateTime(start)} ถึง ${thaiDateTime(end)} · ไม่รวมบิลยกเลิกและบิลคืนสินค้าทั้งบิล`, columns.length, false);
    styleHeader(sheet.addRow(columns));
    const denominator = number(overallTotal);
    rows.forEach((item, index) => {
      const row = sheet.addRow([
        index + 1,
        item.name,
        item.barcode,
        item.category,
        item.unit,
        item.billCount,
        item.qty,
        item.sales,
        item.averagePrice,
        denominator > 0 ? (byQuantity ? item.qty : item.sales) / denominator : 0,
      ]);
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '#,##0.######';
      [8, 9].forEach(column => { row.getCell(column).numFmt = '#,##0.00'; });
      row.getCell(10).numFmt = '0.0%';
      if (index < 3) {
        const medalFill = [COLORS.amberSoft, 'FFF1F5F9', 'FFFFEDD5'][index];
        for (let column = 1; column <= columns.length; column += 1) row.getCell(column).fill = fill(medalFill);
        row.getCell(1).font = { name: FONT, size: 11, bold: true, color: { argb: COLORS.amber } };
      }
    });
    const firstDataRow = 6;
    const lastDataRow = 5 + rows.length;
    styleDataRows(sheet, firstDataRow, lastDataRow, columns.length);
    rows.slice(0, 3).forEach((_, index) => {
      const row = sheet.getRow(firstDataRow + index);
      const medalFill = [COLORS.amberSoft, 'FFF1F5F9', 'FFFFEDD5'][index];
      for (let column = 1; column <= columns.length; column += 1) row.getCell(column).fill = fill(medalFill);
      row.getCell(1).font = { name: FONT, size: 11, bold: true, color: { argb: COLORS.amber } };
    });
    if (!rows.length) {
      const empty = sheet.addRow(['ไม่พบสินค้าที่นำมาจัดอันดับในช่วงเวลานี้']);
      sheet.mergeCells(empty.number, 1, empty.number, columns.length);
      empty.getCell(1).font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
      empty.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    const noteRow = sheet.lastRow.number + 2;
    sheet.mergeCells(noteRow, 1, noteRow, columns.length);
    sheet.getCell(noteRow, 1).value = 'หมายเหตุ: ยอดขายสินค้าเป็นยอดสุทธิหลังเฉลี่ยส่วนลดทั้งบิลตามสัดส่วนมูลค่าสินค้า · ถ้าสินค้าชนิดเดียวกันขายคนละหน่วย ระบบจะแยกอันดับตามหน่วย เพื่อไม่ให้จำนวน “ชิ้น / กล่อง / เมตร / คิว” ปนกัน';
    sheet.getCell(noteRow, 1).fill = fill(COLORS.amberSoft);
    sheet.getCell(noteRow, 1).font = { name: FONT, size: 9, italic: true, color: { argb: COLORS.amber } };
    sheet.getCell(noteRow, 1).alignment = { vertical: 'middle', wrapText: true };
    sheet.getRow(noteRow).height = 30;
    applyWidths(sheet, [9, 31, 19, 23, 15, 17, 16, 18, 20, 20]);
    addAutoFilter(sheet, 5, columns.length, Math.max(5, lastDataRow));
    sheet.pageSetup.printArea = `A1:J${noteRow}`;
  }

  async function buildWorkbook(data, start, end) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SK POS';
    workbook.company = text(data.shop?.shop_name, 'SK POS');
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;
    workbook.properties.date1904 = false;

    addProfitLossSheet(workbook, data.financialReport, data.shop || {});
    addCostDetailSheet(workbook, data.financialReport);
    addExpenseDetailSheet(workbook, data.financialReport);
    addCashFlowSheet(workbook, data.financialReport);
    addChecksSheet(workbook, data.financialReport, data);
    addSummarySheet(workbook, data.report, data.bills, start, end, data.shop || {});
    addBillDetailSheet(workbook, data.report, data.bills, start, end);
    addItemDetailSheet(workbook, data.report, data.items, start, end);
    addRankingSheet(workbook, data.report.byQuantity, 'quantity', start, end, data.report.totalSoldQty);
    addRankingSheet(workbook, data.report.bySales, 'sales', start, end, data.report.totalSoldSales);
    return workbook;
  }

  async function gatherReport(start, end) {
    const bills = await fetchBills(start, end);
    const billIds = bills.map(bill => bill.id).filter(Boolean);
    const [items, shop, financial] = await Promise.all([fetchItems(billIds), fetchShop(), fetchFinancialSources(start, end)]);
    const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean).map(String))];
    const products = await fetchProducts(productIds);
    const data = { bills, items, products, shop, financial, report: prepareReportData(bills, items, products) };
    data.financialReport = prepareFinancialReport(data, start, end);
    return data;
  }

  function selectedRange() {
    const startValue = document.getElementById('v106-sales-start')?.value;
    const endValue = document.getElementById('v106-sales-end')?.value;
    if (!startValue || !endValue) throw new Error('กรุณาเลือกวันและเวลาเริ่มต้นกับสิ้นสุดให้ครบ');
    const start = new Date(startValue);
    const end = new Date(endValue);
    end.setSeconds(59, 999);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('วันหรือเวลาที่เลือกไม่ถูกต้อง');
    if (end < start) throw new Error('เวลาสิ้นสุดต้องไม่น้อยกว่าเวลาเริ่มต้น');
    return { start, end };
  }

  function setModalRange(start, end) {
    const startInput = document.getElementById('v106-sales-start');
    const endInput = document.getElementById('v106-sales-end');
    if (startInput) startInput.value = localInputValue(start);
    if (endInput) endInput.value = localInputValue(end);
  }

  window.v106SetSalesRange = function (preset) {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    if (preset === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (preset === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 0, 0);
    } else if (preset === 'sevenDays') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (preset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }
    setModalRange(start, end);
  };

  function openExportModal() {
    if (!isAdminUser()) {
      denyNonAdminExport();
      return;
    }
    if (!window.ExcelJS) {
      notify('ระบบสร้าง Excel ยังโหลดไม่พร้อม กรุณารีเฟรชหน้าแล้วลองอีกครั้ง', 'error');
      return;
    }
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const html = `
      <div style="text-align:left">
        <div style="background:linear-gradient(135deg,#ecfdf5,#eff6ff);border:1px solid #bbf7d0;border-radius:14px;padding:14px 16px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px;color:#0f766e;font-weight:900;font-size:15px"><i class="material-icons-round">table_view</i> รายงานประวัติการขายแบบละเอียด</div>
          <div style="font-size:12px;color:#475569;line-height:1.7;margin-top:5px">เลือกได้ละเอียดถึงนาที รายงานจะรวมชื่อลูกค้า วิธีชำระ รายละเอียดทุกบิล และสินค้าทุกชิ้น</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">
          <label style="display:grid;gap:6px;font-size:12px;font-weight:800;color:#334155">วันและเวลาเริ่มต้น
            <input type="datetime-local" step="60" class="form-input" id="v106-sales-start" value="${localInputValue(start)}" style="width:100%">
          </label>
          <label style="display:grid;gap:6px;font-size:12px;font-weight:800;color:#334155">วันและเวลาสิ้นสุด
            <input type="datetime-local" step="60" class="form-input" id="v106-sales-end" value="${localInputValue(now)}" style="width:100%">
          </label>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin:12px 0 14px">
          <button type="button" class="btn btn-outline btn-sm" onclick="v106SetSalesRange('today')">วันนี้</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="v106SetSalesRange('yesterday')">เมื่อวาน</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="v106SetSalesRange('sevenDays')">7 วันล่าสุด</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="v106SetSalesRange('thisMonth')">เดือนนี้</button>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;font-size:12px;color:#475569;line-height:1.8">
          <b style="color:#0f172a">ภายในไฟล์ Excel มี 10 หน้า พร้อมกระทบยอด</b>
          <div>1. งบกำไร–ขาดทุน: รายได้ − ต้นทุนสินค้า − รายจ่าย − ค่าแรง = กำไรสุทธิ</div>
          <div>2. ต้นทุนและกำไรรายสินค้า พร้อมแจ้งสินค้าที่ไม่มีต้นทุน</div>
          <div>3. ค่าใช้จ่ายและค่าแรง แยกผลต่อกำไรกับผลต่อเงินสด ป้องกันหักซ้ำ</div>
          <div>4. กระแสเงินสดรับ–จ่ายจริง รวมซื้อสินค้า เงินเดือน เบิกเงิน และเงินคืน</div>
          <div>5. หน้าตรวจสอบรายงานและคำเตือนคุณภาพข้อมูล</div>
          <div>6–10. สรุปยอดขาย รายละเอียดบิล รายการสินค้า และอันดับสินค้าขายดี</div>
        </div>
        <button type="button" class="btn btn-primary" id="v106-sales-download" onclick="v106DownloadSalesExcel(this)" style="width:100%;margin-top:14px;display:flex;justify-content:center;align-items:center;gap:8px;background:linear-gradient(135deg,#0f766e,#15803d);border:none">
          <i class="material-icons-round">download</i> สร้างรายงานกำไรสุทธิแบบสมบูรณ์
        </button>
      </div>`;
    if (typeof openModal === 'function') openModal('ส่งออกประวัติการขาย Excel', html);
    else if (typeof Swal !== 'undefined') Swal.fire({ title: 'ส่งออกประวัติการขาย Excel', html, showConfirmButton: false, width: 680 });
  }

  async function downloadSalesExcel(button) {
    if (!isAdminUser()) {
      denyNonAdminExport();
      return;
    }
    if (!window.ExcelJS) return notify('ระบบสร้าง Excel ยังโหลดไม่พร้อม กรุณารีเฟรชหน้าแล้วลองอีกครั้ง', 'error');
    let range;
    try {
      range = selectedRange();
    } catch (error) {
      notify(error.message, 'warning');
      return;
    }

    const originalHtml = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="material-icons-round" style="animation:spin 1s linear infinite">sync</i> กำลังคำนวณต้นทุน ค่าแรง รายจ่าย และกำไรสุทธิ...';
    }
    notify('กำลังรวบรวมยอดขาย ต้นทุน ค่าแรง รายจ่าย โครงการ และกระแสเงินสด...', 'info');
    try {
      const data = await gatherReport(range.start, range.end);
      if (!data.bills.length) throw new Error('ไม่พบประวัติการขายในช่วงวันและเวลาที่เลือก');
      const workbook = await buildWorkbook(data, range.start, range.end);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ประวัติการขาย_${fileDateTime(range.start)}-ถึง-${fileDateTime(range.end)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      notify(`ดาวน์โหลดรายงาน 10 ชีตสำเร็จ • กำไรสุทธิ ${data.financialReport.totals.netProfit.toLocaleString('th-TH')} บาท • ${data.bills.length.toLocaleString('th-TH')} บิล`, 'success');
      if (typeof closeModal === 'function') closeModal();
      else if (typeof Swal !== 'undefined') Swal.close();
    } catch (error) {
      console.error(`[${VERSION}] sales history excel:`, error);
      notify(`สร้างรายงานไม่สำเร็จ: ${error?.message || error}`, 'error');
    } finally {
      if (button && document.body.contains(button)) {
        button.disabled = false;
        button.innerHTML = originalHtml;
      }
    }
  }

  function relabelHistoryExportButton() {
    document.querySelectorAll('#page-history button[onclick*="exportHistory"], #page-history button.v39-export').forEach(button => {
      const admin = isAdminUser();
      if (!admin) {
        button.disabled = true;
        button.setAttribute('aria-hidden', 'true');
        button.style.setProperty('display', 'none', 'important');
        return;
      }
      button.disabled = false;
      button.removeAttribute('aria-hidden');
      button.style.removeProperty('display');
      if (button.dataset.v106SalesExcel === '1') return;
      button.dataset.v106SalesExcel = '1';
      button.setAttribute('onclick', 'v106OpenSalesExport()');
      button.innerHTML = '<i class="material-icons-round">table_view</i> ส่งออก Excel แบบละเอียด';
      button.title = 'เลือกช่วงวันและเวลา แล้วส่งออกรายละเอียดบิลกับสินค้าขายดี 100 อันดับ';
      button.style.whiteSpace = 'nowrap';
    });
  }

  function boot() {
    window.v106OpenSalesExport = openExportModal;
    window.v106DownloadSalesExcel = downloadSalesExcel;
    window.v106BuildSalesWorkbook = buildWorkbook;
    window.v106PrepareSalesReport = prepareReportData;
    window.v106PrepareFinancialReport = prepareFinancialReport;
    window.exportHistory = openExportModal;
    try { exportHistory = openExportModal; } catch (_) {}
    relabelHistoryExportButton();
    new MutationObserver(relabelHistoryExportButton).observe(document.body, { childList: true, subtree: true });
    console.info(`[${VERSION}] detailed sales history Excel loaded`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
