/**
 * SK POS — Home daily payment summary
 * แสดงยอดขาย เงินสด เงินโอน และยอดค้างชำระของบิลที่ออกวันนี้
 */
(function (root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root || !root.document) return;

  root.SKHomeDailyPayments = api;

  let latestRequest = 0;

  function setText(id, value) {
    const element = root.document.getElementById(id);
    if (element) element.textContent = value;
  }

  function money(value) {
    const formatter = typeof formatNum === 'function' ? formatNum : root.formatNum;
    const formatted = typeof formatter === 'function'
      ? formatter(value)
      : api.number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 });
    return `฿${formatted}`;
  }

  function todayIsoRange(now) {
    const start = new Date(now || Date.now());
    const end = new Date(start);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function loadTodayBills(range) {
    const columns = 'id,total,method,status,date,return_info,deposit_amount,received,change,project_id,customer_name';
    const allRows = typeof fetchAllRows === 'function' ? fetchAllRows : root.fetchAllRows;
    if (typeof allRows === 'function') {
      return allRows('บิลขาย', columns, query =>
        query.gte('date', range.start).lte('date', range.end));
    }

    const database = typeof db !== 'undefined' ? db : root.db;
    const result = await database.from('บิลขาย').select(columns)
      .gte('date', range.start).lte('date', range.end);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function updateHomeStats() {
    const requestId = ++latestRequest;
    const username = typeof USER !== 'undefined' ? USER?.username : root.USER?.username;
    setText('home-username', username || 'User');

    try {
      const bills = await loadTodayBills(todayIsoRange());
      const summary = api.summarize(bills);
      if (requestId !== latestRequest) return;

      setText('home-sales', money(summary.sales));
      setText('home-cash-daily', money(summary.cash));
      setText('home-transfer-daily', money(summary.transfer));
      setText('home-debt-daily', money(summary.outstanding));
      const formatter = typeof formatNum === 'function' ? formatNum : root.formatNum;
      setText('home-orders', typeof formatter === 'function'
        ? formatter(summary.orders)
        : summary.orders.toLocaleString('th-TH'));

      // ยอดลิ้นชักยังคงแสดงที่แถบด้านข้าง และต้องอัปเดตตามเดิม
      const cashBalance = typeof getCashBalance === 'function' ? getCashBalance : root.getCashBalance;
      if (typeof cashBalance === 'function') {
        const balance = await cashBalance();
        if (requestId === latestRequest) setText('global-cash-balance', money(balance));
      }
      const alerts = typeof updateAlerts === 'function' ? updateAlerts : root.updateAlerts;
      if (typeof alerts === 'function') await alerts();
    } catch (error) {
      console.error('[v107] Home daily payment summary error:', error);
      if (requestId !== latestRequest) return;
      ['home-sales', 'home-cash-daily', 'home-transfer-daily', 'home-debt-daily']
        .forEach(id => setText(id, '—'));
      setText('home-orders', '—');
    }
  }

  root.updateHomeStats = updateHomeStats;
  console.log('[v107] Home daily payment summary loaded');
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const number = value => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function parseInfo(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return {}; }
  }

  function effectiveTotal(bill) {
    const info = parseInfo(bill?.return_info);
    return Math.max(0, number(info.new_total ?? bill?.total));
  }

  function isClosed(bill) {
    return /ยกเลิก|คืนสินค้า/.test(String(bill?.status || ''));
  }

  function isDebtText(value) {
    const text = String(value || '').trim();
    if (/บัตรเครดิต|credit\s*card|card/i.test(text)) return false;
    return /ค้างชำระ|ค้างเครดิต|เครดิตร้าน|เจ้าหนี้|^เครดิต$|debt|บางส่วน|ชำระหน้างาน|เก็บปลายทาง|\bcod\b/i.test(text);
  }

  function methodKey(value) {
    const text = String(value || '');
    if (/เงินสด|สด|cash/i.test(text)) return 'cash';
    if (/โอน|พร้อมเพย์|transfer|promptpay/i.test(text)) return 'transfer';
    if (isDebtText(text)) return 'debt';
    return 'other';
  }

  function outstandingAmount(bill) {
    const total = effectiveTotal(bill);
    if (total <= 0) return 0;

    const info = parseInfo(bill?.return_info);
    if (info.remaining_amount !== undefined && info.remaining_amount !== null) {
      return Math.min(total, Math.max(0, number(info.remaining_amount)));
    }

    const deposit = Math.max(0, number(bill?.deposit_amount));
    const tendered = Math.max(0, number(bill?.received) - number(bill?.change));
    const recordedPaid = Math.max(0, number(info.paid_amount));
    const hasOutstandingStatus = isDebtText(`${bill?.method || ''} ${bill?.status || ''}`)
      || (deposit > 0 && deposit < total - 0.009);

    if (!hasOutstandingStatus) return 0;
    const paid = Math.min(total, Math.max(deposit, tendered, recordedPaid));
    return Math.max(0, total - paid);
  }

  function summarize(bills) {
    return (bills || []).reduce((summary, bill) => {
      if (!bill || isClosed(bill)) return summary;

      const total = effectiveTotal(bill);
      const outstanding = outstandingAmount(bill);
      const collected = Math.max(0, total - outstanding);
      const method = methodKey(bill.method);

      summary.sales += total;
      summary.outstanding += outstanding;
      summary.orders += 1;
      if (method === 'cash') summary.cash += collected;
      if (method === 'transfer') summary.transfer += collected;
      return summary;
    }, { sales: 0, cash: 0, transfer: 0, outstanding: 0, orders: 0 });
  }

  return {
    number,
    parseInfo,
    effectiveTotal,
    isClosed,
    isDebtText,
    methodKey,
    outstandingAmount,
    summarize,
  };
});
