/**
 * SK POS — Business Analytics V4
 * แยกผลการดำเนินงาน (management P&L) ออกจากกระแสเงินจริงอย่างชัดเจน
 * พร้อมช่วงวันที่แบบ local-time, pagination, data-quality guard และ request race guard
 */
(function () {
  'use strict';

  const PAGE_SIZE = 1000;
  const MAX_SOURCE_ROWS = 200000;
  const MAX_ITEM_ROWS = 300000;
  const state = {
    requestId: 0,
    preset: 'today',
    start: '',
    end: '',
    report: null,
    previous: null,
  };

  const num = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(num(value)));
  const fmtMoney = value => `${num(value) < 0 ? '−' : ''}฿${fmt(Math.abs(num(value)))}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));

  function localKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function dateFromKey(key, endOfDay = false) {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1,
      endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }

  function addDays(key, amount) {
    const date = dateFromKey(key);
    date.setDate(date.getDate() + Number(amount || 0));
    return localKey(date);
  }

  function inclusiveDays(start, end) {
    return Math.max(1, Math.round((dateFromKey(end) - dateFromKey(start)) / 86400000) + 1);
  }

  function isoRange(start, end) {
    return { startIso: dateFromKey(start).toISOString(), endIso: dateFromKey(end, true).toISOString() };
  }

  function parseInfo(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return {}; }
  }

  function effectiveTotal(bill) {
    const info = parseInfo(bill?.return_info);
    return Math.max(0, num(info.new_total ?? bill?.total));
  }

  function isClosedBill(bill) {
    return /ยกเลิก|คืนสินค้า/.test(String(bill?.status || ''));
  }

  function isProjectBill(bill) {
    const text = [bill?.project_id, bill?.customer_name, bill?.method, bill?.status].filter(Boolean).join(' ');
    return Boolean(bill?.project_id) || /\[โครงการ\]|โครงการ|จ่ายของให้โครงการ|เบิกของโครงการ|project/i.test(text);
  }

  function isDebtText(value) {
    const text = String(value || '').trim();
    if (/บัตรเครดิต|credit\s*card|card/i.test(text)) return false;
    return /ค้างชำระ|เครดิตร้าน|เจ้าหนี้|^เครดิต$|debt/i.test(text);
  }

  function isCodBill(bill) {
    return /ชำระหน้างาน|เก็บปลายทาง|cod/i.test(`${bill?.status || ''} ${bill?.method || ''}`);
  }

  function methodKey(value) {
    const text = String(value || '');
    if (/เงินสด|สด/.test(text)) return 'cash';
    if (/โอน|พร้อมเพย์|transfer/i.test(text)) return 'transfer';
    if (/บัตร|credit card/i.test(text)) return 'card';
    if (/เช็ค/.test(text)) return 'cheque';
    if (/โครงการ|project/i.test(text)) return 'project';
    return 'other';
  }

  function initialBillCollection(bill) {
    if (isProjectBill(bill) || isCodBill(bill) || isDebtText(bill?.method)) return 0;
    const info = parseInfo(bill?.return_info);
    // เงินรับตอนออกบิลต้องใช้ยอดเดิมก่อนคืนสินค้า เพราะเงินคืนจะแสดงฝั่ง cash-out ตามวันที่คืน
    const total = Math.max(0, num(info.original_total ?? bill?.total));
    const tenderedNet = Math.max(0, num(bill?.received) - num(bill?.change));
    if (tenderedNet > 0) return Math.min(total, tenderedNet);
    const deposit = Math.max(0, num(bill?.deposit_amount));
    if (deposit > 0 && deposit < total) return deposit;
    return total;
  }

  function isStockExpense(row) {
    const text = [row?.category, row?.description, row?.note].filter(Boolean).join(' ').toLowerCase();
    return /stock|purchase|inventory|สต็อก|สต๊อก|เข้าคลัง|ซื้อสินค้า|รับสินค้า|ซื้อรอบ|ชำระเจ้าหนี้/.test(text);
  }

  function isCreditorPayment(row) {
    return /ชำระเจ้าหนี้|จ่ายเจ้าหนี้/.test(`${row?.category || ''} ${row?.description || ''}`);
  }

  function isRefundExpense(row) {
    return /คืนมัดจำ|คืนเงิน|refund/i.test(`${row?.category || ''} ${row?.description || ''}`);
  }

  function retryTime(row, field) {
    const time = new Date(row?.[field] || row?.created_at || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function dedupeProjectRetries(rows, timeField) {
    const kept = [];
    // กันเฉพาะ retry ที่เกิดติดกันจริง ๆ ไม่ลบรายการธุรกิจที่ยอดเท่ากันแต่บันทึกคนละเวลา
    const windowMs = 5 * 1000;
    [...(rows || [])].sort((a, b) => retryTime(a, timeField) - retryTime(b, timeField)).forEach(row => {
      const key = [row?.project_id, row?.description || row?.bill_id || row?.milestone_no, row?.category || row?.type]
        .map(value => String(value || '').trim().toLowerCase()).join('|');
      const oldIndex = kept.findIndex(old => {
        const oldKey = [old?.project_id, old?.description || old?.bill_id || old?.milestone_no, old?.category || old?.type]
          .map(value => String(value || '').trim().toLowerCase()).join('|');
        return oldKey === key && Math.abs(retryTime(old, timeField) - retryTime(row, timeField)) <= windowMs
          && Math.abs(num(old?.amount) - num(row?.amount)) <= 0.01;
      });
      if (oldIndex >= 0) {
        if (retryTime(row, timeField) >= retryTime(kept[oldIndex], timeField)) kept[oldIndex] = row;
      } else kept.push(row);
    });
    return kept;
  }

  function emptyScope() {
    return { revenue: 0, cogs: 0, expenses: 0, salary: 0, advance: 0, profit: 0 };
  }

  function ensureDay(map, key) {
    if (!key) return null;
    if (!map[key]) {
      map[key] = {
        ...emptyScope(), cashIn: 0, cashOut: 0, refunds: 0,
        store: emptyScope(), project: emptyScope(),
      };
    }
    return map[key];
  }

  function addManagement(map, key, field, value, scope = 'store') {
    const day = ensureDay(map, key);
    if (!day) return;
    const amount = num(value);
    day[field] += amount;
    day[scope][field] += amount;
  }

  function addCash(map, key, direction, value, refund = false) {
    const day = ensureDay(map, key);
    if (!day) return;
    const amount = num(value);
    if (direction === 'in') day.cashIn += amount;
    else day.cashOut += amount;
    if (refund) day.refunds += amount;
  }

  async function fetchPaged(label, buildQuery, options = {}) {
    const maxRows = options.maxRows || MAX_SOURCE_ROWS;
    const pageSize = options.pageSize || PAGE_SIZE;
    const rows = [];
    let truncated = false;
    for (let from = 0; from < maxRows; from += pageSize) {
      const result = await buildQuery().range(from, Math.min(from + pageSize - 1, maxRows - 1));
      if (result?.error) throw new Error(`${label}: ${result.error.message || result.error}`);
      const page = result?.data || [];
      rows.push(...page);
      if (page.length < pageSize) return { rows, truncated: false };
      if (rows.length >= maxRows) truncated = true;
    }
    return { rows, truncated };
  }

  async function fetchBillItems(billIds) {
    const ids = [...new Set((billIds || []).filter(Boolean))];
    const rows = [];
    let truncated = false;
    const chunks = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
    for (let i = 0; i < chunks.length; i += 4) {
      const batch = chunks.slice(i, i + 4);
      const results = await Promise.all(batch.map((chunk, batchIndex) => fetchPaged(
        `รายการในบิล ชุด ${i + batchIndex + 1}`,
        () => db.from('รายการในบิล').select('id,bill_id,name,qty,price,cost,total').in('bill_id', chunk).order('id', { ascending: true }),
        { maxRows: Math.min(MAX_ITEM_ROWS, Math.max(PAGE_SIZE, chunk.length * 300)) }
      )));
      results.forEach(result => { rows.push(...result.rows); truncated = truncated || result.truncated; });
      if (rows.length >= MAX_ITEM_ROWS) { truncated = true; break; }
    }
    return { rows: rows.slice(0, MAX_ITEM_ROWS), truncated };
  }

  function paidPurchase(row) {
    return !isDebtText(row?.method) && !/ยกเลิก/.test(String(row?.status || ''));
  }

  async function loadRange(start, end, options = {}) {
    if (typeof db === 'undefined') throw new Error('ระบบฐานข้อมูลยังไม่พร้อม');
    const { startIso, endIso } = isoRange(start, end);
    const warnings = [];

    const sources = await Promise.all([
      fetchPaged('บิลขาย', () => db.from('บิลขาย')
        .select('id,bill_no,total,method,status,date,return_info,project_id,customer_id,customer_name,deposit_amount,received,change,delivery_status,delivery_mode')
        .gte('date', startIso).lte('date', endIso).order('date', { ascending: true })),
      fetchPaged('รายการรับสินค้า', () => db.from('purchase_order')
        .select('id,total,method,date,status,supplier').gte('date', startIso).lte('date', endIso).order('date', { ascending: true })),
      fetchPaged('รายจ่ายร้าน', () => db.from('รายจ่าย')
        .select('id,amount,category,description,method,note,date').gte('date', startIso).lte('date', endIso).order('date', { ascending: true })),
      fetchPaged('เช็คชื่อ', () => db.from('เช็คชื่อ')
        .select('employee_id,status,date,deduction,note').gte('date', start).lte('date', end).order('date', { ascending: true })),
      fetchPaged('เบิกเงิน', () => db.from('เบิกเงิน')
        .select('id,amount,status,date').gte('date', startIso).lte('date', endIso).order('date', { ascending: true })),
      fetchPaged('รับชำระหนี้', () => db.from('ชำระหนี้')
        .select('id,customer_id,amount,method,note,date').gte('date', startIso).lte('date', endIso).order('date', { ascending: true })),
      fetchPaged('จ่ายเงินเดือน', () => db.from('จ่ายเงินเดือน')
        .select('id,net_paid,paid_date').gte('paid_date', startIso).lte('paid_date', endIso).order('paid_date', { ascending: true })),
      fetchPaged('รายจ่ายโครงการ', () => db.from('รายจ่ายโครงการ')
        .select('id,project_id,description,category,type,bill_id,amount,paid_at,created_at').not('paid_at', 'is', null)
        .gte('paid_at', startIso).lte('paid_at', endIso).order('paid_at', { ascending: true })),
      fetchPaged('รับเงินงวดโครงการ', () => db.from('งวดงาน')
        .select('id,project_id,milestone_no,description,amount,billed_at,created_at,status').eq('status', 'billed')
        .gte('billed_at', startIso).lte('billed_at', endIso).order('billed_at', { ascending: true })),
      fetchPaged('รายการลิ้นชัก', () => db.from('cash_transaction')
        .select('*').gte('created_at', startIso).lte('created_at', endIso)
        .order('created_at', { ascending: true })),
      fetchPaged('ลูกหนี้คงค้าง', () => db.from('customer').select('id,name,debt_amount').gt('debt_amount', 0).order('id', { ascending: true })),
      fetchPaged('เจ้าหนี้คงค้าง', () => db.from('เจ้าหนี้').select('id,balance,status').gt('balance', 0).order('id', { ascending: true })),
    ]);

    const [billS, purchaseS, expenseS, attendanceS, advanceS, debtS, payrollS, projectExpenseS, milestoneS, cashTxS, customerDebtS, payableS] = sources;
    const sourceNames = ['บิลขาย', 'รับสินค้า', 'รายจ่าย', 'เช็คชื่อ', 'เบิกเงิน', 'รับชำระหนี้', 'เงินเดือน', 'รายจ่ายโครงการ', 'งวดโครงการ', 'ลิ้นชัก', 'ลูกหนี้', 'เจ้าหนี้'];
    sources.forEach((source, index) => { if (source.truncated) warnings.push(`${sourceNames[index]}มีมากกว่าขีดจำกัดและอาจแสดงไม่ครบ`); });

    const bills = billS.rows;
    const activeBills = bills.filter(bill => !isClosedBill(bill));
    const storeBills = activeBills.filter(bill => !isProjectBill(bill));
    const cashSaleBills = bills.filter(bill => !isProjectBill(bill));
    const linkedProjectBillIds = projectExpenseS.rows.map(row => row.bill_id).filter(Boolean);
    const itemSource = await fetchBillItems([...activeBills.map(bill => bill.id), ...linkedProjectBillIds]);
    if (itemSource.truncated) warnings.push('รายการสินค้าในบิลมีจำนวนมากและอาจแสดงต้นทุนไม่ครบ');
    const items = itemSource.rows;

    const employeeIds = [...new Set(attendanceS.rows.map(row => row.employee_id).filter(Boolean))];
    const wageMap = {};
    for (let i = 0; i < employeeIds.length; i += 200) {
      const chunk = employeeIds.slice(i, i + 200);
      const result = await db.from('พนักงาน').select('id,daily_wage').in('id', chunk);
      if (result?.error) throw new Error(`ข้อมูลค่าแรง: ${result.error.message || result.error}`);
      (result.data || []).forEach(row => { wageMap[row.id] = num(row.daily_wage); });
    }

    const daily = {};
    const breakdown = {
      cashIn: { sales: 0, debt: 0, billPayments: 0, project: 0 },
      cashOut: { purchases: 0, creditors: 0, operating: 0, payroll: 0, advances: 0, project: 0, refunds: 0 },
      management: { storeRevenue: 0, projectRevenue: 0, cogs: 0, storeExpenses: 0, projectExpenses: 0, storeWages: 0, projectWages: 0 },
      methods: { cash: 0, transfer: 0, card: 0, cheque: 0, project: 0, other: 0 },
    };

    const itemByBill = new Map();
    items.forEach(item => {
      const key = String(item.bill_id);
      if (!itemByBill.has(key)) itemByBill.set(key, []);
      itemByBill.get(key).push(item);
    });

    const productMap = new Map();
    let invoiceRevenue = 0;
    let cogs = 0;
    let initialSalesCash = 0;
    let periodOutstanding = 0;

    storeBills.forEach(bill => {
      const key = localKey(bill.date);
      const revenue = effectiveTotal(bill);
      const collected = initialBillCollection(bill);
      const currentPaid = Math.min(revenue, Math.max(collected, num(bill.deposit_amount), num(parseInfo(bill.return_info).paid_amount)));
      invoiceRevenue += revenue;
      periodOutstanding += Math.max(0, revenue - currentPaid);
      addManagement(daily, key, 'revenue', revenue, 'store');
      breakdown.management.storeRevenue += revenue;

      const billItems = itemByBill.get(String(bill.id)) || [];
      let billCogs = billItems.reduce((sum, item) => sum + num(item.cost) * num(item.qty), 0);
      const info = parseInfo(bill.return_info);
      const returned = Array.isArray(info.return_items) ? info.return_items : [];
      const itemRevenue = billItems.reduce((sum, item) => sum + num(item.price) * num(item.qty), 0);
      const returnRevenue = returned.reduce((sum, item) => sum + num(item.total || num(item.price || item.sell_price) * num(item.qty)), 0);
      const originalTotal = num(info.original_total) || revenue + returnRevenue;
      // ระบบคืนรุ่นใหม่ลด qty ในรายการบิลแล้ว ส่วนข้อมูลรุ่นเก่ายังเก็บ qty เดิม
      // เลือกฐานที่ใกล้ยอดบิลสุทธิมากกว่าเพื่อไม่หักรายการคืนซ้ำสองครั้ง
      const itemsAlreadyNet = returned.length > 0
        && Math.abs(itemRevenue - revenue) <= Math.abs(itemRevenue - originalTotal);
      if (!itemsAlreadyNet) returned.forEach(ret => {
        let cost = num(ret.cost);
        const original = billItems.find(item => String(item.name) === String(ret.name));
        if (!cost) cost = num(original?.cost);
        billCogs -= cost * num(ret.qty);
      });
      billCogs = Math.max(0, billCogs);
      cogs += billCogs;
      addManagement(daily, key, 'cogs', billCogs, 'store');
      breakdown.management.cogs += billCogs;

      const billProducts = new Map();
      billItems.forEach(item => {
        const name = String(item.name || 'ไม่ระบุชื่อ');
        if (!billProducts.has(name)) billProducts.set(name, { qty: 0, revenue: 0, cost: 0 });
        const row = billProducts.get(name);
        row.qty += num(item.qty);
        row.revenue += num(item.price) * num(item.qty);
        row.cost += num(item.cost) * num(item.qty);
      });
      if (!itemsAlreadyNet) returned.forEach(ret => {
        const name = String(ret.name || 'ไม่ระบุชื่อ');
        const row = billProducts.get(name);
        if (!row) return;
        const original = billItems.find(item => String(item.name) === name);
        row.qty -= num(ret.qty);
        row.revenue -= num(ret.price || ret.sell_price || original?.price) * num(ret.qty);
        row.cost -= num(ret.cost || original?.cost) * num(ret.qty);
      });
      // กระจายส่วนลดระดับบิลตามสัดส่วนยอดสินค้า เพื่อให้ Top Products รวมแล้วตรงยอดขายสุทธิ
      const netItemRevenue = [...billProducts.values()].reduce((sum, row) => sum + Math.max(0, row.revenue), 0);
      const revenueRatio = netItemRevenue > 0 ? revenue / netItemRevenue : 1;
      billProducts.forEach((billRow, name) => {
        if (!productMap.has(name)) productMap.set(name, { qty: 0, revenue: 0, cost: 0 });
        const row = productMap.get(name);
        row.qty += Math.max(0, billRow.qty);
        row.revenue += Math.max(0, billRow.revenue) * revenueRatio;
        row.cost += Math.max(0, billRow.cost);
      });
    });

    cashSaleBills.forEach(bill => {
      const collected = initialBillCollection(bill);
      initialSalesCash += collected;
      breakdown.cashIn.sales += collected;
      breakdown.methods[methodKey(bill.method)] += collected;
      addCash(daily, localKey(bill.date), 'in', collected);
    });

    debtS.rows.forEach(row => {
      const amount = num(row.amount);
      breakdown.cashIn.debt += amount;
      breakdown.methods[methodKey(row.method)] += amount;
      addCash(daily, localKey(row.date), 'in', amount);
    });

    const directBillCashTx = cashTxS.rows.filter(row => {
      if (row.direction !== 'in') return false;
      const text = `${row.type || ''} ${row.note || ''}`;
      const pointsToBill = String(row.ref_table || '') === 'บิลขาย';
      // รุ่นเก่าบางชุดใช้ type="รับชำระหนี้" แต่ ref_table ชี้บิลขายและ note ระบุรับชำระบิล
      return /รับชำระบิล/.test(text) && (pointsToBill || !/รับชำระหนี้/.test(String(row.type || '')));
    });
    directBillCashTx.forEach(row => {
      const amount = num(row.net_amount) || num(row.amount);
      breakdown.cashIn.billPayments += amount;
      breakdown.methods.cash += amount;
      addCash(daily, localKey(row.created_at), 'in', amount);
    });

    const projectExpenses = dedupeProjectRetries(projectExpenseS.rows, 'paid_at');
    const milestones = dedupeProjectRetries(milestoneS.rows, 'billed_at');
    milestones.forEach(row => {
      const amount = num(row.amount);
      const key = localKey(row.billed_at);
      breakdown.cashIn.project += amount;
      breakdown.methods.project += amount;
      breakdown.management.projectRevenue += amount;
      addCash(daily, key, 'in', amount);
      addManagement(daily, key, 'revenue', amount, 'project');
    });

    const paidPurchases = purchaseS.rows.filter(paidPurchase);
    paidPurchases.forEach(row => {
      const amount = num(row.total);
      breakdown.cashOut.purchases += amount;
      addCash(daily, localKey(row.date), 'out', amount);
    });

    const refundSourceKeys = new Set();
    const refundKey = (row, dateField = 'date') => {
      const text = `${row?.description || ''} ${row?.note || ''}`;
      const bill = text.match(/บิล\s*#?\s*([^\s—:]+)/i)?.[1] || '';
      return `${bill || 'unknown'}|${Math.round(num(row?.net_amount) || num(row?.amount))}|${localKey(row?.[dateField])}`;
    };

    expenseS.rows.forEach(row => {
      const amount = num(row.amount);
      const key = localKey(row.date);
      const refund = isRefundExpense(row);
      if (refund) {
        breakdown.cashOut.refunds += amount;
        refundSourceKeys.add(refundKey(row));
      }
      else if (isCreditorPayment(row)) breakdown.cashOut.creditors += amount;
      else if (isStockExpense(row)) breakdown.cashOut.purchases += amount;
      else breakdown.cashOut.operating += amount;
      addCash(daily, key, 'out', amount, refund);
      if (!isStockExpense(row) && !refund) {
        breakdown.management.storeExpenses += amount;
        addManagement(daily, key, 'expenses', amount, 'store');
      }
    });

    projectExpenses.forEach(row => {
      const internalGoods = String(row.type || '') === 'goods';
      const linkedItems = itemByBill.get(String(row.bill_id || '')) || [];
      const linkedCost = linkedItems.reduce((sum, item) => sum + num(item.cost) * num(item.qty), 0);
      const amount = internalGoods && linkedCost > 0 ? linkedCost : num(row.amount);
      const key = localKey(row.paid_at);
      breakdown.management.projectExpenses += amount;
      addManagement(daily, key, 'expenses', amount, 'project');
      if (!internalGoods) {
        breakdown.cashOut.project += amount;
        addCash(daily, key, 'out', amount);
      }
    });

    // การคืนสินค้าแบบเดิมบางรายการบันทึกเฉพาะ cash_transaction โดยไม่มีแถวรายจ่าย
    // นับเฉพาะรายการที่ยังไม่มีคู่ในรายจ่าย เพื่อไม่หักซ้ำกับคืนมัดจำรุ่นใหม่
    cashTxS.rows.filter(row => row.direction === 'out' && /คืนเงิน|คืนมัดจำ|refund/i.test(`${row.type || ''} ${row.note || ''}`)).forEach(row => {
      const key = refundKey(row, 'created_at');
      if (refundSourceKeys.has(key)) return;
      const amount = num(row.net_amount) || num(row.amount);
      breakdown.cashOut.refunds += amount;
      addCash(daily, localKey(row.created_at), 'out', amount, true);
    });

    const approvedAdvances = advanceS.rows.filter(row => String(row.status || '') === 'อนุมัติ');
    approvedAdvances.forEach(row => {
      const amount = num(row.amount);
      breakdown.cashOut.advances += amount;
      addCash(daily, localKey(row.date), 'out', amount);
    });

    payrollS.rows.forEach(row => {
      const amount = num(row.net_paid);
      breakdown.cashOut.payroll += amount;
      addCash(daily, localKey(row.paid_date), 'out', amount);
    });

    attendanceS.rows.forEach(row => {
      const wage = num(wageMap[row.employee_id]);
      let amount = 0;
      if (/^(มา|มาสาย)$/.test(String(row.status || ''))) amount = wage;
      else if (/ลาครึ่งวัน|ครึ่งวัน|มาครึ่งวัน/.test(String(row.status || ''))) amount = wage / 2;
      amount = Math.max(0, amount - num(row.deduction));
      const project = /\[สถานที่ทำงาน:โครงการ:|โครงการ|project/i.test(String(row.note || ''));
      if (project) breakdown.management.projectWages += amount;
      else breakdown.management.storeWages += amount;
      addManagement(daily, localKey(row.date), 'salary', amount, project ? 'project' : 'store');
    });

    Object.values(daily).forEach(day => {
      for (const scope of ['store', 'project']) {
        const row = day[scope];
        row.profit = row.revenue - row.cogs - row.expenses - row.salary;
      }
      day.profit = day.store.profit + day.project.profit;
    });

    const cashIn = Object.values(breakdown.cashIn).reduce((sum, value) => sum + num(value), 0);
    const cashOut = Object.values(breakdown.cashOut).reduce((sum, value) => sum + num(value), 0);
    const storeProfit = breakdown.management.storeRevenue - breakdown.management.cogs
      - breakdown.management.storeExpenses - breakdown.management.storeWages;
    const projectProfit = breakdown.management.projectRevenue - breakdown.management.projectExpenses
      - breakdown.management.projectWages;
    const operatingProfit = storeProfit + projectProfit;
    const currentCustomerDebt = customerDebtS.rows.reduce((sum, row) => sum + num(row.debt_amount), 0);
    const currentPayable = payableS.rows.reduce((sum, row) => sum + num(row.balance), 0);
    const refunds = breakdown.cashOut.refunds;

    if (directBillCashTx.length > 0) warnings.push('รับชำระบิลย้อนหลังแบบเงินสดถูกนับจากลิ้นชัก; การรับแบบโอนย้อนหลังจากข้อมูลเก่าอาจไม่มีประวัติแยกรายการ');
    if (options.silent !== true && warnings.length === 0 && bills.length === 0 && expenseS.rows.length === 0) warnings.push('ไม่พบรายการในช่วงวันที่ที่เลือก');

    const topProducts = [...productMap.entries()].map(([name, row]) => ({
      name, qty: Math.max(0, row.qty), revenue: Math.max(0, row.revenue),
      profit: row.revenue - row.cost,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    return {
      start, end, generatedAt: new Date(), warnings, daily, topProducts,
      counts: { bills: bills.length, items: items.length, expenses: expenseS.rows.length, payments: debtS.rows.length },
      totals: {
        cashIn, cashOut, netCash: cashIn - cashOut, refunds,
        invoiceRevenue, initialSalesCash, cogs, storeProfit, projectProfit, operatingProfit,
        operatingMargin: (breakdown.management.storeRevenue + breakdown.management.projectRevenue) > 0
          ? operatingProfit / (breakdown.management.storeRevenue + breakdown.management.projectRevenue) * 100 : 0,
        periodOutstanding, currentCustomerDebt, currentPayable,
      },
      breakdown,
    };
  }

  window.DashboardAnalyticsV4 = { loadRange, localKey, isoRange };

  function injectStyles() {
    if (document.getElementById('dash-v4-styles')) return;
    const style = document.createElement('style');
    style.id = 'dash-v4-styles';
    style.textContent = `
      #page-dash .dash-v4{--d4-ink:#0f172a;--d4-muted:#64748b;--d4-line:#e2e8f0;--d4-card:#fff;max-width:1540px!important;margin:0 auto!important;padding:24px!important;border-radius:26px!important;background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 100%)!important;font-family:'Prompt','Inter',sans-serif;color:var(--d4-ink);min-height:calc(100vh - 80px)}
      .dash-v4 *{box-sizing:border-box}.dash-v4 button,.dash-v4 input{font:inherit}.d4-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.d4-brand{display:flex;align-items:center;gap:13px;min-width:0}.dash-v4 .dash-v3-icon-box{width:52px;height:52px;flex:0 0 52px;border-radius:16px;background:linear-gradient(135deg,#4f46e5,#7c3aed 55%,#db2777);color:#fff;display:grid;place-items:center;box-shadow:0 14px 28px rgba(79,70,229,.3);cursor:pointer}.d4-title{font-size:23px;font-weight:950;line-height:1.2;margin:0;letter-spacing:-.4px}.d4-subtitle{font-size:12px;font-weight:750;color:var(--d4-muted);margin:4px 0 0}.d4-head-actions{display:flex;gap:8px;align-items:center}.d4-ghost{height:40px;border:1px solid var(--d4-line);background:#fff;color:#334155;border-radius:11px;padding:0 13px;font-weight:900;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;box-shadow:0 6px 16px rgba(15,23,42,.04)}.d4-ghost:hover{border-color:#a5b4fc;color:#4338ca}.d4-filter{border:1px solid #dbeafe;background:rgba(255,255,255,.92);border-radius:18px;padding:12px;box-shadow:0 14px 34px rgba(15,23,42,.065);margin-bottom:16px}.d4-presets{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.d4-preset{height:38px;border:1px solid transparent;background:#f1f5f9;color:#475569;border-radius:10px;padding:0 14px;font-size:12px;font-weight:900;cursor:pointer}.d4-preset:hover{background:#e2e8f0}.d4-preset.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 8px 18px rgba(79,70,229,.28)}.d4-custom{display:none;grid-template-columns:auto minmax(150px,1fr) auto minmax(150px,1fr) auto;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--d4-line)}.d4-custom.show{display:grid}.d4-custom label{font-size:11px;font-weight:900;color:var(--d4-muted)}.d4-custom input{height:40px;border:1px solid var(--d4-line);border-radius:10px;padding:0 11px;color:#0f172a;background:#fff;min-width:0}.d4-apply{height:40px;border:0;border-radius:10px;background:#0f172a;color:#fff;padding:0 18px;font-size:12px;font-weight:900;cursor:pointer}.d4-range-line{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:10px;font-size:11px;font-weight:800;color:var(--d4-muted)}.d4-status{display:inline-flex;align-items:center;gap:6px}.d4-dot{width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 0 4px #d1fae5}.d4-alert{display:flex;align-items:flex-start;gap:10px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:13px;padding:11px 13px;margin-bottom:16px;font-size:11px;font-weight:800;line-height:1.55}.d4-alert.error{border-color:#fecaca;background:#fff1f2;color:#991b1b}.d4-kpis{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:13px!important;margin-bottom:16px}.d4-kpi{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--tone) 22%,#e2e8f0);border-radius:17px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 7%,#fff),#fff);padding:17px;min-width:0;box-shadow:0 10px 24px rgba(15,23,42,.05);cursor:pointer;text-align:left}.d4-kpi:after{content:'';position:absolute;width:92px;height:92px;border-radius:50%;right:-35px;top:-40px;background:color-mix(in srgb,var(--tone) 13%,transparent)}.d4-kpi:hover{transform:translateY(-2px);box-shadow:0 15px 30px rgba(15,23,42,.09)}.d4-kpi-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.d4-kpi-label{font-size:11px;font-weight:950;color:#475569}.d4-kpi-icon{width:31px;height:31px;border-radius:9px;display:grid;place-items:center;color:var(--tone);background:color-mix(in srgb,var(--tone) 12%,#fff);position:relative;z-index:1}.d4-value{font-size:27px;font-weight:950;line-height:1.12;margin-top:8px;letter-spacing:-.6px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.d4-kpi-foot{display:flex;justify-content:space-between;align-items:flex-end;gap:7px;margin-top:5px;color:var(--d4-muted);font-size:10px;font-weight:800;line-height:1.35}.d4-trend{white-space:nowrap;border-radius:999px;padding:3px 7px}.d4-trend.up{background:#dcfce7;color:#047857}.d4-trend.down{background:#fee2e2;color:#b91c1c}.d4-main{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(330px,.75fr);gap:16px;align-items:start}.d4-stack{display:grid;gap:16px;min-width:0}.d4-card{background:#fff;border:1px solid var(--d4-line);border-radius:18px;box-shadow:0 10px 26px rgba(15,23,42,.05);overflow:hidden;min-width:0}.d4-card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 17px;border-bottom:1px solid var(--d4-line)}.d4-card-title{font-size:14px;font-weight:950;display:flex;align-items:center;gap:8px}.d4-card-note{font-size:10px;color:var(--d4-muted);font-weight:800;text-align:right}.d4-card-body{padding:16px}.d4-tabs{display:inline-flex;gap:4px;background:#f1f5f9;padding:4px;border-radius:10px}.d4-tab{height:32px;border:0;background:transparent;color:#64748b;border-radius:8px;padding:0 11px;font-size:11px;font-weight:900;cursor:pointer}.d4-tab.active{background:#fff;color:#0f172a;box-shadow:0 4px 12px rgba(15,23,42,.09)}.d4-ledger{display:grid;gap:1px}.d4-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 5px;border-bottom:1px dashed #e2e8f0}.d4-row:last-child{border-bottom:0}.d4-row-label{font-size:12px;font-weight:900;color:#334155}.d4-row-help{font-size:10px;color:#94a3b8;font-weight:750;margin-top:2px}.d4-row-value{font-size:14px;font-weight:950;text-align:right;font-variant-numeric:tabular-nums}.d4-total{margin-top:10px;border-radius:12px;padding:13px 12px;background:#f8fafc;border:1px solid #e2e8f0}.d4-total .d4-row-label{font-size:13px}.d4-total .d4-row-value{font-size:19px}.d4-split{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.d4-mini{border-radius:13px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0}.d4-mini span{font-size:10px;font-weight:900;color:#64748b}.d4-mini strong{display:block;font-size:19px;font-weight:950;margin-top:3px}.d4-chart{height:230px;display:flex;align-items:stretch;gap:7px;padding:8px 2px 0;overflow-x:auto}.d4-chart-col{flex:1;min-width:30px;display:grid;grid-template-rows:1fr 21px;gap:5px;cursor:pointer}.d4-bars{display:flex;align-items:flex-end;justify-content:center;gap:3px;border-bottom:1px solid #cbd5e1;position:relative}.d4-bar{width:min(12px,35%);min-height:2px;border-radius:5px 5px 1px 1px}.d4-bar.in{background:linear-gradient(180deg,#34d399,#059669)}.d4-bar.out{background:linear-gradient(180deg,#fb7185,#e11d48)}.d4-chart-label{text-align:center;font-size:9px;font-weight:850;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.d4-chart-tip{display:none;position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%);z-index:5;background:#0f172a;color:#fff;border-radius:9px;padding:7px 9px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 8px 20px rgba(15,23,42,.25)}.d4-chart-col:hover .d4-chart-tip,.d4-chart-col:focus .d4-chart-tip{display:block}.d4-legend{display:flex;justify-content:center;gap:16px;margin-top:10px;font-size:10px;font-weight:850;color:#64748b}.d4-legend i{width:9px;height:9px;border-radius:3px;display:inline-block;margin-right:5px}.d4-product{margin-bottom:13px}.d4-product:last-child{margin-bottom:0}.d4-product-line{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.d4-product-name{font-size:11px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.d4-product-value{text-align:right;font-size:11px;font-weight:950;white-space:nowrap}.d4-track{height:5px;background:#f1f5f9;border-radius:999px;overflow:hidden;margin-top:6px}.d4-fill{height:100%;background:linear-gradient(90deg,#f59e0b,#f97316);border-radius:999px}.d4-obligations{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.d4-obligation{border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;padding:11px;min-width:0}.d4-obligation span{font-size:9px;font-weight:900;color:#9a3412;line-height:1.3}.d4-obligation strong{display:block;font-size:17px;font-weight:950;color:#c2410c;margin-top:4px;overflow-wrap:anywhere}.d4-loading{min-height:110px;border-radius:15px;background:linear-gradient(90deg,#eef2f7 25%,#fff 50%,#eef2f7 75%);background-size:800px 100%;animation:d4shimmer 1.5s linear infinite}.d4-modal{position:fixed;inset:0;background:rgba(15,23,42,.58);backdrop-filter:blur(4px);z-index:100000;display:grid;place-items:center;padding:14px}.d4-modal-box{width:min(620px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:19px;box-shadow:0 30px 70px rgba(15,23,42,.3)}.d4-modal-head{display:flex;justify-content:space-between;align-items:center;padding:17px 19px;border-bottom:1px solid #e2e8f0}.d4-modal-head h3{font-size:16px;margin:0;font-weight:950}.d4-modal-close{width:34px;height:34px;border:0;border-radius:9px;background:#f1f5f9;cursor:pointer}.d4-modal-body{padding:16px 19px}.d4-detail-row{display:flex;justify-content:space-between;gap:15px;padding:11px 0;border-bottom:1px dashed #e2e8f0;font-size:12px;font-weight:850}.d4-detail-row:last-child{border-bottom:0}.d4-detail-row strong{font-size:14px}.d4-empty{text-align:center;color:#94a3b8;font-size:12px;font-weight:800;padding:26px}.d4-error-box{text-align:center;padding:32px 18px}.d4-error-box i{font-size:38px;color:#ef4444}.d4-error-box h3{margin:8px 0 5px;font-size:17px}.d4-error-box p{color:#64748b;font-size:12px}.d4-retry{height:39px;border:0;border-radius:10px;background:#0f172a;color:#fff;padding:0 16px;font-weight:900;cursor:pointer}
      @keyframes d4shimmer{from{background-position:-800px 0}to{background-position:800px 0}}
      @media(max-width:1100px){.d4-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}.d4-main{grid-template-columns:1fr}.d4-side{grid-template-columns:1fr 1fr;display:grid}}
      @media(max-width:700px){#page-dash .dash-v4{padding:12px!important;border-radius:0!important}.d4-header{align-items:flex-start}.d4-title{font-size:18px}.dash-v4 .dash-v3-icon-box{width:43px;height:43px;flex-basis:43px;border-radius:12px}.d4-head-actions{flex-direction:column;align-items:stretch}.d4-ghost{height:36px;padding:0 9px}.d4-ghost span{display:none}.d4-filter{border-radius:14px;padding:9px}.d4-presets{display:grid;grid-template-columns:repeat(3,1fr)}.d4-preset{padding:0 5px;height:36px}.d4-custom.show{grid-template-columns:1fr 1fr}.d4-custom label{display:none}.d4-custom .d4-apply{grid-column:1/-1}.d4-range-line{align-items:flex-start;flex-direction:column}.d4-kpis{grid-template-columns:1fr 1fr!important;gap:8px!important}.d4-kpi{padding:13px;border-radius:13px}.d4-value{font-size:20px}.d4-kpi-foot{display:block}.d4-trend{display:inline-block;margin-top:4px}.d4-card{border-radius:14px}.d4-card-head{align-items:flex-start;flex-direction:column;padding:13px}.d4-card-note{text-align:left}.d4-card-body{padding:13px}.d4-split{grid-template-columns:1fr}.d4-side{display:grid;grid-template-columns:1fr}.d4-obligations{grid-template-columns:1fr}.d4-chart{height:205px}.d4-row{padding:10px 2px}.d4-row-label{font-size:11px}.d4-row-value{font-size:13px}}
      @media(max-width:390px){.d4-kpis{grid-template-columns:1fr!important}.d4-presets{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function rangeForPreset(preset) {
    const today = localKey(new Date());
    if (preset === '7') return { start: addDays(today, -6), end: today };
    if (preset === '30') return { start: addDays(today, -29), end: today };
    if (preset === 'month') return { start: `${today.slice(0, 7)}-01`, end: today };
    if (preset === 'year') return { start: `${today.slice(0, 4)}-01-01`, end: today };
    return { start: today, end: today };
  }

  function previousRange(start, end) {
    const days = inclusiveDays(start, end);
    const previousEnd = addDays(start, -1);
    return { start: addDays(previousEnd, -(days - 1)), end: previousEnd };
  }

  function rangeLabel(start, end) {
    const today = localKey(new Date());
    if (start === today && end === today) {
      return `วันนี้ · ${new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    const a = dateFromKey(start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const b = dateFromKey(end).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${a} – ${b} · ${inclusiveDays(start, end)} วัน`;
  }

  function shellHtml() {
    return `
      <div class="dash-v3-container dash-v4" data-dashboard-version="4">
        <header class="d4-header">
          <div class="d4-brand">
            <div class="dash-v3-icon-box" title="เปิดปฏิทินกำไร"><i class="material-icons-round">insights</i></div>
            <div><h2 class="d4-title">วิเคราะห์ธุรกิจ</h2><p class="d4-subtitle">ผลการดำเนินงาน · กระแสเงินจริง · ยอดค้าง แยกฐานบัญชีชัดเจน</p></div>
          </div>
          <div class="d4-head-actions">
            <button class="d4-ghost" id="d4-calendar"><i class="material-icons-round" style="font-size:17px">calendar_month</i><span>ปฏิทินกำไร</span></button>
            <button class="d4-ghost" id="d4-refresh"><i class="material-icons-round" style="font-size:17px">refresh</i><span>รีเฟรช</span></button>
          </div>
        </header>
        <section class="d4-filter">
          <div class="d4-presets" role="group" aria-label="เลือกช่วงเวลา">
            <button class="d4-preset active" data-preset="today">วันนี้</button>
            <button class="d4-preset" data-preset="7">7 วัน</button>
            <button class="d4-preset" data-preset="30">30 วัน</button>
            <button class="d4-preset" data-preset="month">เดือนนี้</button>
            <button class="d4-preset" data-preset="year">ปีนี้</button>
            <button class="d4-preset" data-preset="custom"><i class="material-icons-round" style="font-size:14px;vertical-align:-3px">date_range</i> เลือกช่วงวันที่</button>
          </div>
          <div class="d4-custom" id="d4-custom">
            <label for="d4-start">จากวันที่</label><input type="date" id="d4-start">
            <label for="d4-end">ถึงวันที่</label><input type="date" id="d4-end">
            <button class="d4-apply" id="d4-apply">แสดงรายงาน</button>
          </div>
          <div class="d4-range-line"><span id="dash-v3-date-label">กำลังเตรียมช่วงวันที่...</span><span class="d4-status" id="d4-data-status"><i class="d4-dot"></i>พร้อมโหลดข้อมูล</span></div>
        </section>
        <div id="d4-alert-wrap"></div>
        <section class="d4-kpis" id="dash-v3-kpi-container">${loadingCards(4)}</section>
        <section class="d4-main">
          <div class="d4-stack">
            <article class="d4-card">
              <div class="d4-card-head"><div><div class="d4-card-title"><i class="material-icons-round" style="color:#4f46e5">account_balance</i> รายละเอียดที่กระทบยอดได้</div><div class="d4-card-note" style="text-align:left;margin-top:3px">ผลการดำเนินงานไม่ปนกับวันที่รับ–จ่ายเงินจริง</div></div><div class="d4-tabs" role="tablist"><button class="d4-tab active" data-tab="pl" role="tab">ผลการดำเนินงาน</button><button class="d4-tab" data-tab="cash" role="tab">กระแสเงินจริง</button></div></div>
              <div class="d4-card-body" id="d4-ledger"><div class="d4-loading"></div></div>
            </article>
            <article class="d4-card">
              <div class="d4-card-head"><div class="d4-card-title"><i class="material-icons-round" style="color:#0ea5e9">bar_chart</i> แนวโน้มเงินเข้า–ออก</div><div class="d4-card-note" id="d4-chart-note">ปรับหน่วยเวลาอัตโนมัติตามช่วงที่เลือก</div></div>
              <div class="d4-card-body"><div class="d4-chart" id="dash-v3-chart-area"><div class="d4-loading" style="width:100%"></div></div><div class="d4-legend"><span><i style="background:#10b981"></i>เงินเข้า</span><span><i style="background:#e11d48"></i>เงินออก</span></div></div>
            </article>
          </div>
          <aside class="d4-stack d4-side">
            <article class="d4-card"><div class="d4-card-head"><div class="d4-card-title"><i class="material-icons-round" style="color:#f59e0b">emoji_events</i> สินค้าทำยอดสูงสุด</div><div class="d4-card-note">ตามยอดขายในบิล ไม่ใช่เงินรับ</div></div><div class="d4-card-body" id="dash-v3-top-products"><div class="d4-loading"></div></div></article>
            <article class="d4-card"><div class="d4-card-head"><div class="d4-card-title"><i class="material-icons-round" style="color:#ea580c">pending_actions</i> ยอดที่ต้องติดตาม</div><div class="d4-card-note">ยอดช่วงนี้และยอดคงค้างปัจจุบัน</div></div><div class="d4-card-body" id="dash-v3-truth-container"><div class="d4-loading"></div></div></article>
          </aside>
        </section>
      </div>`;
  }

  function loadingCards(count) {
    return Array.from({ length: count }, () => '<div class="d4-loading"></div>').join('');
  }

  function trend(current, previous, inverse = false) {
    const c = num(current); const p = num(previous);
    if (p === 0) return c === 0 ? { text: 'คงที่', cls: '' } : { text: 'ช่วงก่อน ฿0', cls: inverse ? 'down' : 'up' };
    const pct = Math.round((c - p) / Math.abs(p) * 100);
    const good = inverse ? pct <= 0 : pct >= 0;
    return { text: `${pct >= 0 ? '+' : ''}${pct}%`, cls: good ? 'up' : 'down' };
  }

  function renderKpis(report, previous) {
    const t = report.totals; const p = previous?.totals || {};
    const cards = [
      { key: 'cashIn', label: 'เงินจริงรับเข้า', value: t.cashIn, prev: p.cashIn, tone: '#059669', icon: 'south_west', help: 'ยอดรับก่อนหักเงินออก' },
      { key: 'cashOut', label: 'เงินจริงจ่ายออก', value: t.cashOut, prev: p.cashOut, tone: '#e11d48', icon: 'north_east', help: `รวมคืนลูกค้า ${fmtMoney(t.refunds)}`, inverse: true },
      { key: 'netCash', label: 'กระแสเงินสุทธิ', value: t.netCash, prev: p.netCash, tone: t.netCash >= 0 ? '#0ea5e9' : '#ef4444', icon: 'account_balance_wallet', help: 'เงินจริงเข้า − เงินจริงออก' },
      { key: 'profit', label: 'กำไรจากการดำเนินงาน', value: t.operatingProfit, prev: p.operatingProfit, tone: t.operatingProfit >= 0 ? '#4f46e5' : '#ef4444', icon: 'trending_up', help: `Margin ${t.operatingMargin.toFixed(1)}%` },
    ];
    document.getElementById('dash-v3-kpi-container').innerHTML = cards.map(card => {
      const delta = trend(card.value, card.prev, card.inverse);
      return `<button class="d4-kpi" data-detail="${card.key}" style="--tone:${card.tone}"><div class="d4-kpi-top"><span class="d4-kpi-label">${card.label}</span><span class="d4-kpi-icon"><i class="material-icons-round" style="font-size:17px">${card.icon}</i></span></div><div class="d4-value" style="color:${card.value < 0 ? '#dc2626' : '#0f172a'}">${fmtMoney(card.value)}</div><div class="d4-kpi-foot"><span>${card.help}</span><span class="d4-trend ${delta.cls}">${delta.text} จากช่วงก่อน</span></div></button>`;
    }).join('');
  }

  function ledgerRow(label, help, value, color = '#0f172a', sign = '') {
    return `<div class="d4-row"><div><div class="d4-row-label">${esc(label)}</div>${help ? `<div class="d4-row-help">${esc(help)}</div>` : ''}</div><div class="d4-row-value" style="color:${color}">${sign}${fmtMoney(value)}</div></div>`;
  }

  function renderLedger(mode = 'pl') {
    const report = state.report;
    if (!report) return;
    const b = report.breakdown; const t = report.totals;
    const el = document.getElementById('d4-ledger');
    if (!el) return;
    if (mode === 'cash') {
      const methods = b.methods;
      el.innerHTML = `<div class="d4-ledger">
        ${ledgerRow('ขายหน้าร้าน/มัดจำ', 'เงินที่รับตอนออกบิลในช่วงนี้', b.cashIn.sales, '#059669', '+')}
        ${ledgerRow('รับชำระหนี้ลูกค้า', 'ประวัติรับชำระตามวันที่รับเงินจริง', b.cashIn.debt, '#0284c7', '+')}
        ${ledgerRow('รับชำระบิลย้อนหลัง', 'รายการรับเงินสดที่อ้างอิงบิลโดยตรง', b.cashIn.billPayments, '#0ea5e9', '+')}
        ${ledgerRow('รับเงินงวดโครงการ', 'งวดที่บันทึกรับเงินในช่วงนี้', b.cashIn.project, '#7c3aed', '+')}
        <div class="d4-total">${ledgerRow('เงินจริงรับเข้ารวม', 'ยอดรับรวมทุกแหล่ง', t.cashIn, '#047857')}</div>
        <div class="d4-split"><div class="d4-mini"><span>รับเป็นเงินสด</span><strong>${fmtMoney(methods.cash)}</strong></div><div class="d4-mini"><span>รับเป็นเงินโอน</span><strong>${fmtMoney(methods.transfer)}</strong></div><div class="d4-mini"><span>รับผ่านบัตร</span><strong>${fmtMoney(methods.card)}</strong></div><div class="d4-mini"><span>โครงการ/เช็ค/อื่น ๆ</span><strong>${fmtMoney(methods.project + methods.cheque + methods.other)}</strong></div></div>
        ${ledgerRow('ซื้อสินค้าแบบจ่ายทันที', '', b.cashOut.purchases, '#be123c', '−')}
        ${ledgerRow('ชำระเจ้าหนี้', '', b.cashOut.creditors, '#be123c', '−')}
        ${ledgerRow('รายจ่ายดำเนินงาน', '', b.cashOut.operating, '#be123c', '−')}
        ${ledgerRow('เงินเดือนที่จ่ายจริง', '', b.cashOut.payroll, '#be123c', '−')}
        ${ledgerRow('เงินเบิกล่วงหน้า', 'เป็นเงินออก แต่ไม่หักกำไรซ้ำ', b.cashOut.advances, '#be123c', '−')}
        ${ledgerRow('รายจ่ายโครงการที่จ่ายจริง', '', b.cashOut.project, '#7c3aed', '−')}
        ${ledgerRow('คืนเงินลูกค้า', 'แยกจากรายจ่ายดำเนินงาน', b.cashOut.refunds, '#db2777', '−')}
        <div class="d4-total">${ledgerRow('กระแสเงินสุทธิ', 'เงินจริงรับเข้า − เงินจ่ายออกทุกช่องทาง', t.netCash, t.netCash >= 0 ? '#047857' : '#b91c1c')}</div>
      </div>`;
      return;
    }
    el.innerHTML = `<div class="d4-ledger">
      ${ledgerRow('ยอดขายตามบิลหน้าร้าน', 'รับรู้ตามบิล ไม่ขึ้นกับว่าจะเก็บเงินแล้วหรือยัง', b.management.storeRevenue, '#059669', '+')}
      ${ledgerRow('รายได้โครงการ', 'เงินงวดที่บันทึกในระบบโครงการ', b.management.projectRevenue, '#7c3aed', '+')}
      ${ledgerRow('ต้นทุนขาย (COGS)', 'ต้นทุนสินค้าของบิล หักรายการคืนแล้ว', b.management.cogs, '#d97706', '−')}
      ${ledgerRow('ค่าใช้จ่ายดำเนินงานร้าน', 'ไม่รวมซื้อสินค้า ชำระเจ้าหนี้ และคืนเงิน', b.management.storeExpenses, '#dc2626', '−')}
      ${ledgerRow('ค่าใช้จ่าย/สินค้าของโครงการ', '', b.management.projectExpenses, '#7c3aed', '−')}
      ${ledgerRow('ค่าแรงหน้าร้านตามเช็คชื่อ', 'ต้นทุนแรงงานที่เกิดขึ้น แม้ยังไม่ถึงวันจ่าย', b.management.storeWages, '#dc2626', '−')}
      ${ledgerRow('ค่าแรงโครงการตามเช็คชื่อ', '', b.management.projectWages, '#7c3aed', '−')}
      <div class="d4-split"><div class="d4-mini"><span>กำไรหน้าร้าน</span><strong style="color:${t.storeProfit >= 0 ? '#047857' : '#b91c1c'}">${fmtMoney(t.storeProfit)}</strong></div><div class="d4-mini"><span>กำไรโครงการ</span><strong style="color:${t.projectProfit >= 0 ? '#047857' : '#b91c1c'}">${fmtMoney(t.projectProfit)}</strong></div></div>
      <div class="d4-total">${ledgerRow('กำไรจากการดำเนินงาน', `Management P&L · Margin ${t.operatingMargin.toFixed(1)}%`, t.operatingProfit, t.operatingProfit >= 0 ? '#4338ca' : '#b91c1c')}</div>
    </div>`;
  }

  function aggregateChart(report) {
    const days = inclusiveDays(report.start, report.end);
    const mode = days <= 31 ? 'day' : days <= 120 ? 'week' : 'month';
    const groups = new Map();
    for (let key = report.start; key <= report.end; key = addDays(key, 1)) {
      const date = dateFromKey(key);
      let groupKey = key; let label = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      if (mode === 'week') {
        const weekStart = new Date(date); weekStart.setDate(date.getDate() - date.getDay());
        groupKey = localKey(weekStart); label = `สัปดาห์ ${weekStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`;
      } else if (mode === 'month') {
        groupKey = key.slice(0, 7); label = date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
      }
      if (!groups.has(groupKey)) groups.set(groupKey, { label, cashIn: 0, cashOut: 0, profit: 0 });
      const group = groups.get(groupKey); const row = report.daily[key] || {};
      group.cashIn += num(row.cashIn); group.cashOut += num(row.cashOut); group.profit += num(row.profit);
    }
    return { rows: [...groups.values()], mode };
  }

  function renderChart(report) {
    const chart = aggregateChart(report);
    const max = Math.max(1, ...chart.rows.map(row => Math.max(row.cashIn, row.cashOut)));
    const el = document.getElementById('dash-v3-chart-area');
    document.getElementById('d4-chart-note').textContent = chart.mode === 'day' ? 'สรุปรายวัน' : chart.mode === 'week' ? 'สรุปรายสัปดาห์' : 'สรุปรายเดือน';
    el.innerHTML = chart.rows.map(row => {
      const inHeight = Math.max(row.cashIn > 0 ? 2 : 0, Math.round(row.cashIn / max * 190));
      const outHeight = Math.max(row.cashOut > 0 ? 2 : 0, Math.round(row.cashOut / max * 190));
      return `<div class="d4-chart-col" tabindex="0"><div class="d4-bars"><div class="d4-chart-tip">${esc(row.label)}<br>เงินเข้า ${fmtMoney(row.cashIn)}<br>เงินออก ${fmtMoney(row.cashOut)}<br>กำไร ${fmtMoney(row.profit)}</div><i class="d4-bar in" style="height:${inHeight}px"></i><i class="d4-bar out" style="height:${outHeight}px"></i></div><div class="d4-chart-label">${esc(row.label)}</div></div>`;
    }).join('') || '<div class="d4-empty">ไม่มีข้อมูลกราฟในช่วงนี้</div>';
  }

  function renderProducts(report) {
    const el = document.getElementById('dash-v3-top-products');
    if (!report.topProducts.length) { el.innerHTML = '<div class="d4-empty">ไม่มีสินค้าขายในช่วงนี้</div>'; return; }
    const max = Math.max(1, report.topProducts[0].revenue);
    el.innerHTML = report.topProducts.map((row, index) => {
      const margin = row.revenue > 0 ? row.profit / row.revenue * 100 : 0;
      return `<div class="d4-product"><div class="d4-product-line"><div class="d4-product-name" title="${esc(row.name)}">${index + 1}. ${esc(row.name)}</div><div class="d4-product-value">${fmtMoney(row.revenue)}<div style="font-size:9px;color:${margin >= 0 ? '#059669' : '#dc2626'}">Margin ${margin.toFixed(1)}%</div></div></div><div class="d4-track"><div class="d4-fill" style="width:${Math.max(3, row.revenue / max * 100)}%"></div></div></div>`;
    }).join('');
  }

  function renderObligations(report) {
    const t = report.totals;
    document.getElementById('dash-v3-truth-container').innerHTML = `<div class="d4-obligations"><div class="d4-obligation"><span>ค้างรับจากบิลในช่วงนี้</span><strong>${fmtMoney(t.periodOutstanding)}</strong></div><div class="d4-obligation"><span>ลูกหนี้คงค้างทั้งหมดตอนนี้</span><strong>${fmtMoney(t.currentCustomerDebt)}</strong></div><div class="d4-obligation"><span>เจ้าหนี้คงค้างทั้งหมดตอนนี้</span><strong>${fmtMoney(t.currentPayable)}</strong></div></div><div style="font-size:10px;color:#94a3b8;font-weight:750;line-height:1.55;margin-top:10px">ยอดคงค้างทั้งหมดเป็นภาพ ณ เวลาที่เปิดรายงาน จึงไม่เปลี่ยนตามช่วงวันที่ ส่วน “ค้างรับจากบิลในช่วงนี้” เปลี่ยนตามวันที่ที่เลือก</div>`;
  }

  function renderWarnings(report) {
    const wrap = document.getElementById('d4-alert-wrap');
    if (!report.warnings.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `<div class="d4-alert"><i class="material-icons-round" style="font-size:19px">info</i><div>${report.warnings.map(esc).join('<br>')}</div></div>`;
  }

  function detailRows(key) {
    const r = state.report; const b = r.breakdown; const t = r.totals;
    if (key === 'cashIn') return ['เงินจริงรับเข้า', [['ขาย/มัดจำ', b.cashIn.sales], ['รับชำระหนี้', b.cashIn.debt], ['รับชำระบิลย้อนหลัง', b.cashIn.billPayments], ['งวดโครงการ', b.cashIn.project], ['รวม', t.cashIn]]];
    if (key === 'cashOut') return ['เงินจริงจ่ายออก', [['ซื้อสินค้าจ่ายทันที', b.cashOut.purchases], ['ชำระเจ้าหนี้', b.cashOut.creditors], ['รายจ่ายดำเนินงาน', b.cashOut.operating], ['เงินเดือน', b.cashOut.payroll], ['เบิกล่วงหน้า', b.cashOut.advances], ['รายจ่ายโครงการ', b.cashOut.project], ['คืนลูกค้า', b.cashOut.refunds], ['รวม', t.cashOut]]];
    if (key === 'netCash') return ['กระแสเงินสุทธิ', [['เงินจริงเข้า', t.cashIn], ['เงินจริงออก', -t.cashOut], ['สุทธิ', t.netCash]]];
    return ['กำไรจากการดำเนินงาน', [['ยอดขายหน้าร้าน', b.management.storeRevenue], ['รายได้โครงการ', b.management.projectRevenue], ['ต้นทุนขาย', -b.management.cogs], ['ค่าใช้จ่ายร้าน', -b.management.storeExpenses], ['ค่าใช้จ่ายโครงการ', -b.management.projectExpenses], ['ค่าแรง', -(b.management.storeWages + b.management.projectWages)], ['กำไรสุทธิ', t.operatingProfit]]];
  }

  function openDetail(key) {
    const [title, rows] = detailRows(key);
    document.getElementById('d4-detail-modal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'd4-modal'; modal.id = 'd4-detail-modal';
    modal.innerHTML = `<div class="d4-modal-box"><div class="d4-modal-head"><h3>${esc(title)}</h3><button class="d4-modal-close"><i class="material-icons-round">close</i></button></div><div class="d4-modal-body">${rows.map(([label, value]) => `<div class="d4-detail-row"><span>${esc(label)}</span><strong style="color:${value < 0 ? '#b91c1c' : '#0f172a'}">${fmtMoney(value)}</strong></div>`).join('')}</div></div>`;
    modal.addEventListener('click', event => { if (event.target === modal || event.target.closest('.d4-modal-close')) modal.remove(); });
    document.body.appendChild(modal);
  }

  function renderReport(report, previous) {
    state.report = report; state.previous = previous;
    renderKpis(report, previous); renderLedger('pl'); renderChart(report); renderProducts(report); renderObligations(report); renderWarnings(report);
    const status = document.getElementById('d4-data-status');
    status.innerHTML = `<i class="d4-dot"></i>อัปเดต ${report.generatedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · ${fmt(report.counts.bills)} บิล · ${fmt(report.counts.items)} รายการ`;
  }

  function renderError(error) {
    const safe = esc(error?.message || error || 'ไม่ทราบสาเหตุ');
    document.getElementById('d4-alert-wrap').innerHTML = `<div class="d4-alert error"><i class="material-icons-round">error</i><div>รายงานโหลดไม่ครบ จึงหยุดคำนวณเพื่อไม่แสดงยอด 0 ที่ทำให้เข้าใจผิด<br>${safe}</div></div>`;
    document.getElementById('dash-v3-kpi-container').innerHTML = `<div class="d4-card" style="grid-column:1/-1"><div class="d4-error-box"><i class="material-icons-round">cloud_off</i><h3>โหลดข้อมูลไม่สำเร็จ</h3><p>${safe}</p><button class="d4-retry" id="d4-retry">ลองใหม่</button></div></div>`;
    document.getElementById('d4-ledger').innerHTML = '<div class="d4-empty">รอโหลดข้อมูลใหม่</div>';
    document.getElementById('dash-v3-chart-area').innerHTML = '<div class="d4-empty">ไม่มีกราฟจนกว่าข้อมูลจะครบ</div>';
    document.getElementById('dash-v3-top-products').innerHTML = '<div class="d4-empty">ไม่มีข้อมูล</div>';
    document.getElementById('dash-v3-truth-container').innerHTML = '<div class="d4-empty">ไม่มีข้อมูล</div>';
    document.getElementById('d4-retry')?.addEventListener('click', refresh);
  }

  async function refresh() {
    const requestId = ++state.requestId;
    const range = state.preset === 'custom' ? { start: state.start, end: state.end } : rangeForPreset(state.preset);
    state.start = range.start; state.end = range.end;
    document.getElementById('dash-v3-date-label').textContent = rangeLabel(range.start, range.end);
    document.getElementById('d4-data-status').innerHTML = '<i class="material-icons-round" style="font-size:15px;animation:spin 1s linear infinite">refresh</i>กำลังตรวจข้อมูลทุกแหล่ง...';
    document.getElementById('dash-v3-kpi-container').innerHTML = loadingCards(4);
    document.getElementById('d4-ledger').innerHTML = '<div class="d4-loading"></div>';
    document.getElementById('dash-v3-chart-area').innerHTML = '<div class="d4-loading" style="width:100%"></div>';
    document.getElementById('dash-v3-top-products').innerHTML = '<div class="d4-loading"></div>';
    document.getElementById('dash-v3-truth-container').innerHTML = '<div class="d4-loading"></div>';
    document.getElementById('d4-alert-wrap').innerHTML = '';
    try {
      const prevRange = previousRange(range.start, range.end);
      const [report, previous] = await Promise.all([
        loadRange(range.start, range.end), loadRange(prevRange.start, prevRange.end, { silent: true }),
      ]);
      if (requestId !== state.requestId || !document.querySelector('#page-dash [data-dashboard-version="4"]')) return;
      renderReport(report, previous);
    } catch (error) {
      if (requestId !== state.requestId || !document.querySelector('#page-dash [data-dashboard-version="4"]')) return;
      console.error('[Dashboard V4]', error);
      renderError(error);
    }
  }

  function bindEvents(section) {
    section.querySelectorAll('.d4-preset').forEach(button => button.addEventListener('click', () => {
      section.querySelectorAll('.d4-preset').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      state.preset = button.dataset.preset;
      const custom = document.getElementById('d4-custom');
      custom.classList.toggle('show', state.preset === 'custom');
      if (state.preset === 'custom') {
        const defaults = { start: state.start || addDays(localKey(new Date()), -6), end: state.end || localKey(new Date()) };
        document.getElementById('d4-start').value = defaults.start;
        document.getElementById('d4-end').value = defaults.end;
        document.getElementById('dash-v3-date-label').textContent = 'เลือกวันเริ่มต้นและวันสิ้นสุด แล้วกด “แสดงรายงาน”';
      } else refresh();
    }));
    document.getElementById('d4-apply').addEventListener('click', () => {
      const start = document.getElementById('d4-start').value;
      const end = document.getElementById('d4-end').value;
      if (!start || !end) { typeof toast === 'function' && toast('กรุณาเลือกวันเริ่มต้นและวันสิ้นสุด', 'warning'); return; }
      if (start > end) { typeof toast === 'function' && toast('วันเริ่มต้นต้องไม่อยู่หลังวันสิ้นสุด', 'warning'); return; }
      state.start = start; state.end = end; state.preset = 'custom'; refresh();
    });
    document.getElementById('d4-refresh').addEventListener('click', refresh);
    document.getElementById('d4-calendar').addEventListener('click', () => {
      if (typeof window.v57OpenProfitCalendar === 'function') window.v57OpenProfitCalendar(0);
      else typeof toast === 'function' && toast('ปฏิทินกำไรยังโหลดไม่เสร็จ', 'info');
    });
    section.addEventListener('click', event => {
      const tab = event.target.closest('.d4-tab');
      if (tab) {
        section.querySelectorAll('.d4-tab').forEach(item => item.classList.remove('active'));
        tab.classList.add('active'); renderLedger(tab.dataset.tab);
      }
      const detail = event.target.closest('[data-detail]');
      if (detail && state.report) openDetail(detail.dataset.detail);
    });
  }

  window.renderDashboardV3 = async function () {
    injectStyles();
    const section = document.getElementById('page-dash');
    if (!section) return;
    state.preset = 'today';
    section.innerHTML = shellHtml();
    bindEvents(section);
    await refresh();
  };
})();
