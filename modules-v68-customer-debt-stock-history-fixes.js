(function () {
  'use strict';

  console.log('[v68] customer debt, stock and history fixes loaded');

  const BILL_TABLE = 'บิลขาย';
  const ITEM_TABLE = 'รายการในบิล';
  const CUSTOMER_TABLE = 'customer';
  const PAYMENT_TABLE = 'ชำระหนี้';
  const PRODUCT_TABLE = 'สินค้า';
  const STOCK_TABLE = 'stock_movement';
  const OPENING_DEBT_TABLE = 'หนี้เดิมยกมา';

  const num = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => {
    try { return typeof formatNum === 'function' ? formatNum(value) : num(value).toLocaleString('th-TH'); }
    catch (_) { return num(value).toLocaleString('th-TH'); }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
  const js = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const staff = () => {
    try { return USER?.username || localStorage.getItem('current_staff_name') || 'system'; }
    catch (_) { return 'system'; }
  };

  function parseInfo(value) {
    if (!value) return {};
    if (typeof value === 'object') return value || {};
    try { return JSON.parse(value); } catch (_) { return {}; }
  }

  function effectiveTotal(bill) {
    const info = parseInfo(bill?.return_info);
    return Math.max(0, num(info.new_total ?? bill?.total));
  }

  function isTerminalBill(bill) {
    return /ยกเลิก|คืนสินค้า/.test(String(bill?.status || ''));
  }

  function isProjectBill(bill) {
    const text = `${bill?.status || ''} ${bill?.method || ''}`;
    return /จ่ายของให้โครงการ/.test(text) || !!bill?.project_id;
  }

  function shouldCountPurchase(bill) {
    return !!bill?.customer_id && !isTerminalBill(bill) && !isProjectBill(bill) && effectiveTotal(bill) > 0;
  }

  function isDebtCandidate(bill) {
    if (!bill || isTerminalBill(bill) || isProjectBill(bill)) return false;
    const total = effectiveTotal(bill);
    if (total <= 0) return false;
    const deposit = num(bill.deposit_amount);
    const status = String(bill.status || '');
    return /ค้าง|บางส่วน|ชำระหน้างาน/.test(status) || (deposit > 0 && deposit < total);
  }

  function billDate(value) {
    if (!value) return '-';
    try { return new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (_) { return String(value).slice(0, 10); }
  }

  function billTime(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return ''; }
  }

  function remainingAfterBillPaid(bill) {
    return Math.max(0, effectiveTotal(bill) - num(bill.deposit_amount));
  }

  function debtBillRows(bills, startingPaidPool = 0) {
    let paidPool = startingPaidPool;
    return (bills || [])
      .filter(isDebtCandidate)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      .map(bill => {
        const total = effectiveTotal(bill);
        const billPaid = Math.min(total, num(bill.deposit_amount));
        const beforePayment = Math.max(0, total - billPaid);
        const fifoPaid = Math.min(beforePayment, paidPool);
        paidPool = Math.max(0, paidPool - fifoPaid);
        const paid = billPaid + fifoPaid;
        const remaining = Math.max(0, total - paid);
        return { bill, total, paid, billPaid, fifoPaid, remaining };
      });
  }

  function buildDebtRows(bills, payments, openingDebt = 0, openingKey = 'opening') {
    let paidPool = (payments || []).reduce((sum, row) => sum + num(row.amount), 0);
    const rows = [];
    if (openingDebt > 0) {
      const openingPaid = Math.min(openingDebt, paidPool);
      paidPool = Math.max(0, paidPool - openingPaid);
      rows.push({
        bill: {
          id: `opening-${openingKey}`,
          bill_no: 'ยกมา',
          date: null,
          total: openingDebt,
          status: 'หนี้ยกมา',
          customer_name: 'ยอดหนี้ยกมา',
          __openingDebt: true,
        },
        total: openingDebt,
        paid: openingPaid,
        billPaid: 0,
        fifoPaid: openingPaid,
        remaining: Math.max(0, openingDebt - openingPaid),
      });
    }
    rows.push(...debtBillRows(bills, paidPool));
    return rows;
  }

  async function updateBillDebtStatus(row) {
    const bill = row.bill;
    if (!bill?.id || bill.__openingDebt || isTerminalBill(bill)) return;
    const info = parseInfo(bill.return_info);
    info.paid_amount = row.paid;
    info.remaining_amount = row.remaining;
    info.bill_paid_amount = row.billPaid;
    info.fifo_paid_amount = row.fifoPaid;
    const nextStatus = row.remaining <= 0
      ? (bill.delivery_status === 'รอจัดส่ง' ? 'รอจัดส่ง' : 'สำเร็จ')
      : (row.paid > 0 ? 'จ่ายแล้วบางส่วน' : 'ค้างชำระ');
    const oldInfo = parseInfo(bill.return_info);
    const needsUpdate = String(bill.status || '') !== nextStatus
      || Math.abs(num(oldInfo.paid_amount) - row.paid) > 0.009
      || Math.abs(num(oldInfo.remaining_amount) - row.remaining) > 0.009;
    if (needsUpdate) {
      await db.from(BILL_TABLE).update({ status: nextStatus, return_info: info }).eq('id', bill.id);
    }
  }

  async function linkOrphanDebtBills(customers, bills) {
    const byName = new Map();
    (customers || []).forEach(customer => {
      const key = String(customer.name || '').trim().toLowerCase();
      if (!key) return;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(customer);
    });

    for (const bill of (bills || [])) {
      if (bill.customer_id || !isDebtCandidate(bill)) continue;
      const key = String(bill.customer_name || '').trim().toLowerCase();
      if (!key || /ทั่วไป|general/.test(key)) continue;
      const matches = byName.get(key) || [];
      if (matches.length === 1) {
        const customer = matches[0];
        await db.from(BILL_TABLE).update({
          customer_id: customer.id,
          delivery_phone: bill.delivery_phone || customer.phone || null,
        }).eq('id', bill.id);
        bill.customer_id = customer.id;
        bill.delivery_phone = bill.delivery_phone || customer.phone || null;
      }
    }
  }

  function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function openingDebtByCustomer(customers, openingRows) {
    const byId = new Map();
    const byName = new Map();
    (openingRows || []).forEach(row => {
      const amount = num(row.debt_amount);
      if (amount <= 0) return;
      if (row.customer_id) {
        const key = String(row.customer_id);
        byId.set(key, (byId.get(key) || 0) + amount);
      } else {
        const nameKey = normalizeName(row.customer_name);
        if (nameKey) byName.set(nameKey, (byName.get(nameKey) || 0) + amount);
      }
    });
    const result = new Map();
    (customers || []).forEach(customer => {
      const idKey = String(customer.id);
      const nameKey = normalizeName(customer.name);
      result.set(idKey, num(byId.get(idKey)) + num(byName.get(nameKey)));
    });
    return result;
  }

  async function syncAllCustomers() {
    if (typeof db === 'undefined') return { rows: [], orphanRows: [], customers: [] };
    const [{ data: customers, error: custErr }, { data: bills, error: billErr }, { data: payments, error: payErr }, { data: openingDebts, error: openingErr }] = await Promise.all([
      db.from(CUSTOMER_TABLE).select('id,name,phone,address,total_purchase,visit_count,debt_amount,credit_limit,customer_type').limit(10000),
      db.from(BILL_TABLE).select('id,bill_no,date,total,method,status,delivery_status,deposit_amount,customer_id,customer_name,delivery_phone,project_id,return_info').order('date', { ascending: true }).limit(10000),
      db.from(PAYMENT_TABLE).select('customer_id,amount,date').limit(10000),
      db.from(OPENING_DEBT_TABLE).select('customer_id,customer_name,debt_amount,brought_forward_date,source').limit(10000),
    ]);
    if (custErr) throw custErr;
    if (billErr) throw billErr;
    if (payErr) throw payErr;
    if (openingErr) throw openingErr;

    await linkOrphanDebtBills(customers || [], bills || []);
    const openingByCustomer = openingDebtByCustomer(customers || [], openingDebts || []);
    const hasOpeningRows = (openingDebts || []).some(row => num(row.debt_amount) > 0);

    const billsByCustomer = new Map();
    (bills || []).forEach(bill => {
      if (!bill.customer_id) return;
      const key = String(bill.customer_id);
      if (!billsByCustomer.has(key)) billsByCustomer.set(key, []);
      billsByCustomer.get(key).push(bill);
    });
    const paysByCustomer = new Map();
    (payments || []).forEach(payment => {
      if (!payment.customer_id) return;
      const key = String(payment.customer_id);
      if (!paysByCustomer.has(key)) paysByCustomer.set(key, []);
      paysByCustomer.get(key).push(payment);
    });

    const debtRows = [];
    for (const customer of (customers || [])) {
      const key = String(customer.id);
      const custBills = billsByCustomer.get(key) || [];
      const custPays = paysByCustomer.get(key) || [];
      const purchaseBills = custBills.filter(shouldCountPurchase);
      const totalPurchase = purchaseBills.reduce((sum, bill) => sum + effectiveTotal(bill), 0);
      const visitCount = purchaseBills.length;
      const rawBillDebt = debtBillRows(custBills, 0).reduce((sum, row) => sum + row.remaining, 0);
      const tableOpeningDebt = num(openingByCustomer.get(String(customer.id)));
      const fallbackOpeningDebt = hasOpeningRows ? 0 : Math.max(0, num(customer.debt_amount) - rawBillDebt);
      const openingDebt = tableOpeningDebt > 0 ? tableOpeningDebt : fallbackOpeningDebt;
      const rows = buildDebtRows(custBills, custPays, openingDebt, customer.id);
      const computedDebtAmount = rows.reduce((sum, row) => sum + row.remaining, 0);
      const debtAmount = !hasOpeningRows && num(customer.debt_amount) > computedDebtAmount
        ? num(customer.debt_amount)
        : computedDebtAmount;
      rows.forEach(row => {
        if (row.remaining > 0) debtRows.push({ customer, ...row });
      });

      for (const row of rows) {
        await updateBillDebtStatus(row);
      }

      const changed = Math.abs(num(customer.total_purchase) - totalPurchase) > 0.009
        || Math.abs(num(customer.debt_amount) - debtAmount) > 0.009
        || Math.round(num(customer.visit_count)) !== visitCount;
      if (changed) {
        await db.from(CUSTOMER_TABLE).update({
          total_purchase: Number(totalPurchase.toFixed(2)),
          visit_count: visitCount,
          debt_amount: Number(debtAmount.toFixed(2)),
        }).eq('id', customer.id);
        customer.total_purchase = totalPurchase;
        customer.visit_count = visitCount;
        customer.debt_amount = debtAmount;
      }
    }

    const orphanRows = buildDebtRows((bills || []).filter(bill => !bill.customer_id), [])
      .filter(row => row.remaining > 0);
    return { rows: debtRows, orphanRows, customers: customers || [], openingDebtLoaded: hasOpeningRows, openingDebtCount: (openingDebts || []).length };
  }

  let syncCache = null;
  async function getSyncedCustomers(force = false) {
    if (!force && syncCache && Date.now() - syncCache.at < 15000) return syncCache.data;
    const data = await syncAllCustomers();
    syncCache = { at: Date.now(), data };
    return data;
  }

  async function syncCustomer(customerId) {
    const synced = await getSyncedCustomers(true);
    return synced.rows.filter(row => String(row.customer.id) === String(customerId));
  }

  window.v68SyncCustomerTotals = force => getSyncedCustomers(force !== false);

  window.v24BuildDebtBreakdown = async function (customerId, opts = {}) {
    const rows = await syncCustomer(customerId);
    const customer = rows[0]?.customer || (await db.from(CUSTOMER_TABLE).select('*').eq('id', customerId).maybeSingle()).data || null;
    const map = new Map();
    rows.forEach(row => {
      map.set(String(row.bill.id), {
        paid: row.paid,
        remaining: row.remaining,
        total: row.total,
        row: {
          id: row.bill.id,
          bill: row.bill,
          bill_no: row.bill.bill_no,
          date: row.bill.date,
          total: row.total,
          paid: row.paid,
          billPaid: row.billPaid,
          fifoPaid: row.fifoPaid,
          adjustmentPaid: 0,
          remaining: row.remaining,
          returnTotal: num(parseInfo(row.bill.return_info).return_total),
          originalTotal: num(parseInfo(row.bill.return_info).original_total || row.bill.total || row.total),
          effectiveTotal: row.total,
        },
      });
    });
    return {
      map,
      rows: rows.map(row => ({
        id: row.bill.id,
        bill: row.bill,
        bill_no: row.bill.bill_no,
        date: row.bill.date,
        total: row.total,
        paid: row.paid,
        billPaid: row.billPaid,
        fifoPaid: row.fifoPaid,
        adjustmentPaid: 0,
        remaining: row.remaining,
        returnTotal: num(parseInfo(row.bill.return_info).return_total),
        originalTotal: num(parseInfo(row.bill.return_info).original_total || row.bill.total || row.total),
        effectiveTotal: row.total,
      })),
      totalDebt: rows.reduce((sum, row) => sum + row.remaining, 0),
      originalTotal: rows.reduce((sum, row) => sum + row.total, 0),
      paidTotal: rows.reduce((sum, row) => sum + row.paid, 0),
      customer,
    };
  };
  window.v24ApplyDebtPaymentsFIFO = async customerId => (await window.v24BuildDebtBreakdown(customerId)).map;
  window.v9AutoUpdateBillStatus = window.v24ApplyDebtPaymentsFIFO;

  function injectStyle() {
    if (document.getElementById('v68-fix-style')) return;
    const style = document.createElement('style');
    style.id = 'v68-fix-style';
    style.textContent = `
      .v68-click-stat{cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
      .v68-click-stat:hover{transform:translateY(-1px);border-color:#93c5fd!important;box-shadow:0 14px 28px rgba(15,23,42,.08)}
      .v68-click-stat.active{outline:3px solid rgba(37,99,235,.14);border-color:#2563eb!important}
      .v68-debt-search{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:0 12px;height:44px;min-width:min(100%,360px)}
      .v68-debt-search i{color:#94a3b8}.v68-debt-search input{border:0;outline:0;background:transparent;width:100%;font:inherit;font-weight:800;color:#0f172a}
      .v68-orphan{margin-top:18px;border:1px solid #fed7aa;background:#fff7ed;border-radius:16px;overflow:hidden}
      .v68-orphan-head{padding:14px 18px;color:#9a3412;font-weight:950;border-bottom:1px solid #fed7aa;display:flex;align-items:center;gap:8px}
      .v68-orphan table{width:100%;border-collapse:collapse;background:#fff}.v68-orphan th,.v68-orphan td{padding:11px 14px;border-bottom:1px solid #ffedd5;text-align:left;font-size:13px}.v68-orphan th{background:#fff7ed;color:#9a3412;font-weight:950}
      .debt-container{padding:24px;max-width:1200px;margin:0 auto;animation:fade-in-up .4s ease-out}
      .debt-hero{background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);border-radius:16px;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;box-shadow:0 4px 15px rgba(220,38,38,.05);border:1px solid rgba(220,38,38,.1);flex-wrap:wrap;gap:20px}
      .debt-hero-left h2{color:#991b1b;font-size:24px;font-weight:800;margin:0 0 8px;display:flex;align-items:center;gap:8px}.debt-hero-left p{color:#b91c1c;margin:0;font-size:14px;opacity:.9;font-weight:700}
      .debt-stat-boxes{display:flex;gap:16px;flex-wrap:wrap}.debt-stat-box{background:#fff;border-radius:12px;padding:16px 24px;box-shadow:0 4px 12px rgba(0,0,0,.03);min-width:180px;border:1px solid #fff}.debt-stat-box .lbl{font-size:13px;color:#64748b;font-weight:700;margin-bottom:4px}.debt-stat-box .val{font-size:28px;font-weight:900;color:#1e293b;line-height:1.1}.debt-stat-box.danger .val{color:#dc2626}
      .debt-table-card{background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.04);border:1px solid #f1f5f9;overflow-x:auto}.debt-table{width:100%;border-collapse:collapse;min-width:800px}.debt-table th{background:#f8fafc;color:#475569;font-size:13px;font-weight:800;padding:16px 20px;text-align:left;border-bottom:2px solid #e2e8f0;white-space:nowrap}.debt-table td{padding:16px 20px;border-bottom:1px solid #f1f5f9;color:#1e293b;vertical-align:middle}.debt-table tbody tr:hover{background:#fdf2f8}
      .debt-cust-name{font-weight:800;color:#0f172a;display:flex;align-items:center;gap:14px}.debt-avatar{width:42px;height:42px;border-radius:12px;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;flex-shrink:0}.debt-amt{font-weight:900;color:#dc2626;font-size:16px;background:#fef2f2;padding:4px 10px;border-radius:8px;display:inline-block}.debt-bills{min-width:260px;display:flex;flex-direction:column;gap:6px}.debt-bill-chip{border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:7px 9px;font-size:12px;line-height:1.35}.debt-bill-chip strong{color:#0f172a;font-size:12.5px}.debt-bill-chip .meta{color:#64748b;margin-left:4px}.debt-bill-chip .money{color:#dc2626;font-weight:900;float:right;margin-left:10px}.debt-bill-chip .sub{color:#64748b;margin-top:2px}
      .debt-actions{display:flex;gap:8px;justify-content:flex-end}.btn-pay{background:#dc2626;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:800;display:flex;align-items:center;gap:6px;cursor:pointer;transition:all .2s;font-family:inherit;font-size:13px}.btn-pay:hover{background:#b91c1c;transform:translateY(-1px);box-shadow:0 4px 10px rgba(220,38,38,.25)}.btn-icon-soft{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:none;background:#f1f5f9;color:#64748b;cursor:pointer;transition:all .2s}.btn-icon-soft:hover{background:#e2e8f0;color:#0f172a;transform:translateY(-1px)}
      .v68-picked-customer{margin:0 0 18px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:18px;padding:18px 22px;border:2px solid #10b981;border-radius:18px;background:linear-gradient(135deg,#ecfdf5,#fff 60%,#eff6ff);box-shadow:0 18px 38px rgba(16,185,129,.13)}
      .v68-picked-icon{width:66px;height:66px;border-radius:20px;background:#10b981;color:#fff;display:grid;place-items:center;flex:0 0 auto}.v68-picked-icon i{font-size:38px}
      .v68-picked-label{font-size:12px;font-weight:950;color:#059669;text-transform:uppercase}.v68-picked-name{font-size:32px;font-weight:950;color:#0f172a;line-height:1.08}.v68-picked-phone,.v68-picked-address{font-size:14px;font-weight:850;color:#475569;margin-top:4px;display:flex;align-items:center;gap:6px}.v68-picked-note{font-size:12px;font-weight:850;color:#0f766e;margin-top:7px}
      .v68-picked-meta{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:8px}.v68-picked-debt{display:inline-flex;align-items:center;gap:6px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:950}
      @media(max-width:768px){.debt-hero{flex-direction:column;align-items:flex-start}.debt-stat-boxes{width:100%}.debt-stat-box{flex:1;min-width:140px}}
    `;
    document.head.appendChild(style);
  }

  window.v68RenderDebts = window.renderDebts = async function () {
    injectStyle();
    const section = document.getElementById('page-debt');
    if (!section) return;
    section.innerHTML = `<div style="padding:80px;text-align:center;color:#94a3b8;font-weight:800">กำลังซิงค์ยอดลูกหนี้จากบิลจริง...</div>`;
    try {
      const search = String(window.v68DebtSearch || '').toLowerCase();
      const sync = await getSyncedCustomers(false);
      const grouped = new Map();
      sync.rows.forEach(row => {
        const id = String(row.customer.id);
        if (!grouped.has(id)) grouped.set(id, { customer: row.customer, rows: [], total: 0 });
        grouped.get(id).rows.push(row);
        grouped.get(id).total += row.remaining;
      });
      let customers = [...grouped.values()].sort((a, b) => b.total - a.total);
      if (search) {
        customers = customers.filter(group => {
          const c = group.customer;
          const hay = `${c.name || ''} ${c.phone || ''} ${group.rows.map(row => row.bill.bill_no).join(' ')}`.toLowerCase();
          return hay.includes(search);
        });
      }
      const total = customers.reduce((sum, group) => sum + group.total, 0);
      const orphanRows = sync.orphanRows.filter(row => {
        if (!search) return true;
        const hay = `${row.bill.bill_no || ''} ${row.bill.customer_name || ''} ${row.bill.delivery_phone || ''}`.toLowerCase();
        return hay.includes(search);
      });
      const orphanTotal = orphanRows.reduce((sum, row) => sum + row.remaining, 0);
      const openingWarn = !sync.openingDebtLoaded
        ? `<div style="margin-bottom:14px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:14px;padding:12px 16px;font-weight:900;display:flex;align-items:center;gap:8px"><i class="material-icons-round">warning</i> ยังไม่พบข้อมูลในตารางหนี้เดิมยกมา ระบบจะไม่ลดยอดหนี้เดิมลงอัตโนมัติเพื่อกันยอดหาย</div>`
        : '';

      const tableRows = customers.map(group => {
        const c = group.customer;
        const bills = group.rows.map(row => `<div class="debt-bill-chip">
          <div><strong>#${esc(row.bill.bill_no || '-')}</strong><span class="meta">${esc(billDate(row.bill.date))}</span><span class="money">฿${fmt(row.remaining)}</span></div>
          <div class="sub">ยอดบิล ฿${fmt(row.total)} / ชำระแล้ว ฿${fmt(row.paid)} / คงเหลือ ฿${fmt(row.remaining)}</div>
        </div>`).join('');
        return `<tr>
          <td><div class="debt-cust-name"><div class="debt-avatar">${esc(String(c.name || '?').slice(0, 1))}</div><div><div style="font-size:15px">${esc(c.name || '-')}</div><div style="font-size:12px;color:#64748b;margin-top:4px">ID: ${esc(String(c.id).slice(0, 8))}</div></div></div></td>
          <td>${esc(c.phone || '-')}</td>
          <td><div class="debt-bills">${bills}</div></td>
          <td style="text-align:right">฿${fmt(c.credit_limit)}</td>
          <td style="text-align:right"><span class="debt-amt">฿${fmt(group.total)}</span></td>
          <td><div class="debt-actions"><button class="btn-pay" onclick="recordDebtPayment('${c.id}','${js(c.name || '')}')"><i class="material-icons-round" style="font-size:18px">payments</i> รับชำระ</button><button class="btn-icon-soft" onclick="viewDebtHistory('${c.id}','${js(c.name || '')}')" title="ประวัติลูกหนี้"><i class="material-icons-round" style="font-size:18px">history</i></button></div></td>
        </tr>`;
      }).join('');

      const orphanHtml = orphanRows.length ? `<div class="v68-orphan">
        <div class="v68-orphan-head"><i class="material-icons-round">warning</i> บิลค้างที่ยังไม่ผูกลูกค้าประจำ ${orphanRows.length} ใบ รวม ฿${fmt(orphanTotal)}</div>
        <table><thead><tr><th>บิล</th><th>ลูกค้าในบิล</th><th>วันที่</th><th style="text-align:right">คงเหลือ</th><th>จัดการ</th></tr></thead><tbody>
          ${orphanRows.map(row => `<tr><td>#${esc(row.bill.bill_no || row.bill.id)}</td><td>${esc(row.bill.customer_name || '-')}</td><td>${esc(billDate(row.bill.date))}</td><td style="text-align:right;color:#b91c1c;font-weight:900">฿${fmt(row.remaining)}</td><td><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" onclick="viewBillDetail('${row.bill.id}')"><i class="material-icons-round">receipt</i> ดูบิล</button><button class="btn btn-primary btn-sm" onclick="v68LinkDebtBillToCustomer('${row.bill.id}')"><i class="material-icons-round">link</i> ผูกลูกค้า</button></div></td></tr>`).join('')}
        </tbody></table>
      </div>` : '';

      section.innerHTML = `
        <div class="debt-container">
          <div class="debt-hero">
            <div class="debt-hero-left">
              <h2><i class="material-icons-round" style="font-size:28px">account_balance_wallet</i> จัดการลูกหนี้</h2>
              <p>ซิงค์จากบิลค้างชำระจริง และแสดงบิลที่ยังไม่ผูกลูกค้าให้ตรวจได้ทันที</p>
            </div>
            <div class="debt-stat-boxes">
              <div class="debt-stat-box danger"><div class="lbl">ยอดหนี้รวมทั้งหมด</div><div class="val">฿${fmt(total + orphanTotal)}</div></div>
              <div class="debt-stat-box"><div class="lbl">ลูกค้าค้างชำระ</div><div class="val">${customers.length} ราย</div></div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            <label class="v68-debt-search"><i class="material-icons-round">search</i><input value="${esc(window.v68DebtSearch || '')}" placeholder="ค้นหาลูกค้า เบอร์โทร หรือเลขบิล..." oninput="window.v68DebtSearch=this.value;v68RenderDebts()"></label>
            <button class="btn btn-outline" onclick="v68SyncCustomerTotals(true).then(()=>{toast?.('ซิงค์ยอดลูกค้าเรียบร้อย','success');v68RenderDebts();})"><i class="material-icons-round">sync</i> ซิงค์ยอด</button>
          </div>
          ${openingWarn}
          <div class="debt-table-card">
            ${customers.length ? `<table class="debt-table"><thead><tr><th>ข้อมูลลูกค้า</th><th>ติดต่อ</th><th>บิลที่ยังค้างอยู่</th><th style="text-align:right">วงเงินเครดิต</th><th style="text-align:right">ยอดหนี้คงค้าง</th><th style="text-align:right">จัดการ</th></tr></thead><tbody>${tableRows}</tbody></table>` : `<div style="padding:52px;text-align:center;color:#64748b"><i class="material-icons-round" style="font-size:46px;color:#cbd5e1">check_circle</i><h3 style="margin:8px 0 0;color:#0f172a">ไม่พบลูกค้าค้างชำระ</h3></div>`}
          </div>
          ${orphanHtml}
        </div>`;
    } catch (error) {
      console.error('[v68] render debts:', error);
      section.innerHTML = `<div style="padding:40px;color:#dc2626;font-weight:800">โหลดลูกหนี้ไม่สำเร็จ: ${esc(error.message || error)}</div>`;
    }
  };
  try { renderDebts = window.renderDebts; } catch (_) {}

  window.v68LinkDebtBillToCustomer = async function (billId) {
    try {
      const [{ data: bill, error: billErr }, { data: customers, error: custErr }] = await Promise.all([
        db.from(BILL_TABLE).select('id,bill_no,customer_name,delivery_phone').eq('id', billId).maybeSingle(),
        db.from(CUSTOMER_TABLE).select('id,name,phone').order('name', { ascending: true }).limit(10000),
      ]);
      if (billErr) throw billErr;
      if (custErr) throw custErr;
      const options = {};
      (customers || []).forEach(c => { options[c.id] = `${c.name}${c.phone ? ' - ' + c.phone : ''}`; });
      const guess = (customers || []).find(c => String(c.name || '').trim().toLowerCase() === String(bill?.customer_name || '').trim().toLowerCase());
      const result = await Swal.fire({
        title: `ผูกบิล #${bill?.bill_no || ''} กับลูกค้า`,
        input: 'select',
        inputOptions: options,
        inputValue: guess?.id || '',
        showCancelButton: true,
        confirmButtonText: 'ผูกลูกค้า',
        cancelButtonText: 'ยกเลิก',
        inputValidator: value => !value ? 'กรุณาเลือกลูกค้า' : undefined,
      });
      if (!result.isConfirmed || !result.value) return;
      const customer = (customers || []).find(c => String(c.id) === String(result.value));
      if (!customer) throw new Error('ไม่พบลูกค้าที่เลือก');
      const { error } = await db.from(BILL_TABLE).update({
        customer_id: customer.id,
        customer_name: customer.name,
        delivery_phone: bill?.delivery_phone || customer.phone || null,
      }).eq('id', billId);
      if (error) throw error;
      syncCache = null;
      await getSyncedCustomers(true);
      toast?.('ผูกบิลกับลูกค้าเรียบร้อย', 'success');
      window.v68RenderDebts?.();
    } catch (error) {
      console.error('[v68] link debt bill:', error);
      toast?.('ผูกลูกค้าไม่สำเร็จ: ' + (error.message || error), 'error');
    }
  };

  if (typeof window.loadCustomerData === 'function' && !window.loadCustomerData.__v68CustomerSync) {
    const originalLoadCustomerData = window.loadCustomerData;
    window.loadCustomerData = async function () {
      try { await getSyncedCustomers(false); } catch (error) { console.warn('[v68] customer page sync skipped:', error); }
      return originalLoadCustomerData.apply(this, arguments);
    };
    window.loadCustomerData.__v68CustomerSync = true;
    try { loadCustomerData = window.loadCustomerData; } catch (_) {}
  }

  async function loadHistoryBills() {
    const date = document.getElementById('history-date')?.value || new Date().toISOString().split('T')[0];
    const search = (document.getElementById('history-search')?.value || '').toLowerCase();
    let query = db.from(BILL_TABLE).select('*').order('date', { ascending: false });
    if (search) query = query.range(0, 4999);
    else query = query.gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59');
    const { data, error } = await query;
    if (error) throw error;
    const scoped = search ? (data || []) : (data || []).filter(b => String(b.date || '').slice(0, 10) === date);
    return scoped.filter(b => {
      const hay = `${b.bill_no || ''} ${b.customer_name || ''} ${b.staff_name || ''} ${b.method || ''} ${b.status || ''}`.toLowerCase();
      return !search || hay.includes(search);
    });
  }

  function deliveryText(bill) {
    const s = String(bill?.delivery_status || '');
    if (s) return s;
    return /ส่ง|จัดส่ง/.test(String(bill?.delivery_mode || '')) ? 'รอจัดส่ง' : 'รับเอง / ไม่จัดส่ง';
  }

  function methodClass(method) {
    const m = String(method || '');
    if (/เงินสด/.test(m)) return 'cash';
    if (/โอน|พร้อมเพย์/.test(m)) return 'transfer';
    if (/บัตร|เครดิต/.test(m)) return 'credit';
    if (/ค้าง/.test(m)) return 'debt';
    return 'other';
  }

  function statusClass(status) {
    const s = String(status || '');
    if (/สำเร็จ|รอจัดส่ง/.test(s)) return 'done';
    if (/ค้าง|บางส่วน/.test(s)) return 'debt';
    if (/ยกเลิก|คืน/.test(s)) return 'cancel';
    return 'other';
  }

  window.v68SetHistoryFilter = function (filter) {
    window.v68HistoryFilter = window.v68HistoryFilter === filter ? 'all' : filter;
    window.v39LoadHistoryData?.();
  };

  window.v39LoadHistoryData = window.loadHistoryData = async function () {
    try {
      const bills = await loadHistoryBills();
      const filter = window.v68HistoryFilter || 'all';
      const valid = bills.filter(b => !/ยกเลิก|คืนสินค้า/.test(String(b.status || '')));
      const stats = [
        ['all', '#dc2626', 'receipt_long', bills.length, 'บิลทั้งหมด'],
        ['valid', '#16a34a', 'payments', '฿' + fmt(valid.reduce((s, b) => s + num(b.total), 0)), 'ยอดขายสุทธิ'],
        ['transfer', '#2563eb', 'qr_code_2', bills.filter(b => /โอน|พร้อมเพย์/.test(String(b.method || ''))).length, 'โอนเงิน'],
        ['delivery', '#f59e0b', 'local_shipping', bills.filter(b => /รอ|จัดส่ง/.test(deliveryText(b))).length, 'งานจัดส่ง'],
        ['discount', '#7c3aed', 'sell', '฿' + fmt(bills.reduce((s, b) => s + num(b.discount), 0)), 'ส่วนลดรวม'],
      ];
      const statsEl = document.getElementById('history-stats');
      if (statsEl) statsEl.innerHTML = stats.map(s => `<div class="v39-stat v68-click-stat ${filter === s[0] ? 'active' : ''}" onclick="v68SetHistoryFilter('${s[0]}')"><div class="dot" style="background:${s[1]}"><i class="material-icons-round">${s[2]}</i></div><div><b>${esc(s[3])}</b><span>${esc(s[4])}</span></div></div>`).join('');

      let filtered = bills;
      if (filter === 'valid') filtered = valid;
      else if (filter === 'transfer') filtered = bills.filter(b => /โอน|พร้อมเพย์/.test(String(b.method || '')));
      else if (filter === 'delivery') filtered = bills.filter(b => /รอ|จัดส่ง/.test(deliveryText(b)));
      else if (filter === 'discount') filtered = bills.filter(b => num(b.discount) > 0);

      const tbody = document.getElementById('history-tbody');
      if (!tbody) return;
      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="v39-empty"><i class="material-icons-round">receipt_long</i><div>ไม่พบบิลในหมวดนี้</div></div></td></tr>`;
        return;
      }
      tbody.innerHTML = filtered.map(b => {
        const debtLike = /ค้าง|บางส่วน/.test(String(b.status || '')) || (num(b.deposit_amount) > 0 && num(b.deposit_amount) < effectiveTotal(b));
        const terminal = /ยกเลิก|คืนสินค้า/.test(String(b.status || ''));
        return `<tr>
          <td><div class="v39-bill-no">#${esc(b.bill_no || b.id)}</div><div class="v39-sub">${esc(b.staff_name || '-')}</div></td>
          <td><div style="font-weight:900;color:#0f172a">${esc(billDate(b.date))}</div><div class="v39-sub">${esc(billTime(b.date))}</div></td>
          <td><div class="v39-customer">${esc(b.customer_name || 'ลูกค้าทั่วไป')}</div><div class="v39-sub">${esc(b.delivery_phone || '')}</div></td>
          <td><span class="v39-pill ${methodClass(b.method)}"><i class="material-icons-round" style="font-size:15px">${methodClass(b.method) === 'cash' ? 'payments' : methodClass(b.method) === 'transfer' ? 'qr_code' : methodClass(b.method) === 'credit' ? 'credit_card' : 'schedule'}</i>${esc(b.method || '-')}</span></td>
          <td><span class="v39-pill other"><i class="material-icons-round" style="font-size:15px">local_shipping</i>${esc(deliveryText(b))}</span></td>
          <td class="v39-money">฿${fmt(b.total)}${num(b.discount) > 0 ? `<div class="v39-discount">ลด ฿${fmt(b.discount)}</div>` : ''}</td>
          <td><span class="v39-pill v39-status ${statusClass(b.status)}">${esc(b.status || '-')}</span>${!b.customer_id && debtLike ? '<div class="v39-sub" style="color:#d97706">ยังไม่ผูกลูกค้า</div>' : ''}</td>
          <td><div class="v39-actions-wrap" data-v39-actions="${esc(b.id)}">
            <button class="v39-actions-toggle" onclick="v39ToggleHistoryActions('${esc(b.id)}', event)" title="จัดการ"><i class="material-icons-round">more_horiz</i></button>
            <div class="v39-actions">
              <button class="v39-action view" onclick="viewBillDetail('${esc(b.id)}')" title="ดูรายละเอียด"><i class="material-icons-round">receipt</i></button>
              <button class="v39-action print" onclick="${typeof window.v24ShowDocSelector === 'function' ? 'v24ShowDocSelector' : 'v5PrintFromHistory'}('${esc(b.id)}')" title="พิมพ์เอกสาร"><i class="material-icons-round">print</i></button>
              ${debtLike && typeof window.v20BMCPayDebt === 'function' ? `<button class="v39-action pay" onclick="v20BMCPayDebt('${esc(b.id)}')" title="รับชำระ"><i class="material-icons-round">payments</i></button>` : ''}
              ${!terminal && !isProjectBill(b) ? `<button class="v39-action return" onclick="${typeof window.v10ShowReturnModal === 'function' ? `v10ShowReturnModal('${esc(b.id)}')` : `v12ReturnBill('${esc(b.id)}')`}" title="คืนสินค้า"><i class="material-icons-round">assignment_return</i></button><button class="v39-action cancel" onclick="cancelBill('${esc(b.id)}')" title="ยกเลิก"><i class="material-icons-round">cancel</i></button>` : ''}
            </div>
          </div></td>
        </tr>`;
      }).join('');
    } catch (error) {
      console.error('[v68] history:', error);
      toast?.('โหลดประวัติการขายไม่สำเร็จ: ' + (error.message || error), 'error');
    }
  };
  try { v39LoadHistoryData = window.v39LoadHistoryData; loadHistoryData = window.v39LoadHistoryData; } catch (_) {}

  window.adjustStock = async function (productId) {
    try {
      if (typeof window.v52CanAdjustStock === 'function' && !window.v52CanAdjustStock()) {
        toast?.('ไม่มีสิทธิ์ปรับสต็อก', 'warning');
        return false;
      }
      const { data: product, error } = await db.from(PRODUCT_TABLE).select('*').eq('id', productId).maybeSingle();
      if (error) throw error;
      if (!product) throw new Error('ไม่พบสินค้า');
      const result = await Swal.fire({
        title: `ปรับสต็อก: ${product.name}`,
        html: `<div style="text-align:left;line-height:1.7"><div>สต็อกปัจจุบัน: <strong>${fmt(product.stock)} ${esc(product.unit || '')}</strong></div><input id="swal-adj" class="swal2-input" type="number" step="0.000001" placeholder="ใส่ + เพิ่ม หรือ - ลด"><input id="swal-adj-note" class="swal2-input" placeholder="หมายเหตุ เช่น ตรวจนับ/แก้ยอดผิด"></div>`,
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
          const delta = Number(document.getElementById('swal-adj')?.value || 0);
          if (!Number.isFinite(delta) || delta === 0) {
            Swal.showValidationMessage('กรุณากรอกจำนวนเพิ่มหรือลด');
            return false;
          }
          return { delta, note: document.getElementById('swal-adj-note')?.value?.trim() || '' };
        },
      });
      if (!result.isConfirmed || !result.value) return false;
      const before = num(product.stock);
      const delta = result.value.delta;
      const after = Math.max(0, Number((before + delta).toFixed(6)));
      const actualDelta = Number((after - before).toFixed(6));
      const update = await db.from(PRODUCT_TABLE).update({ stock: after, updated_at: new Date().toISOString() }).eq('id', productId);
      if (update.error) throw update.error;
      const movement = await db.from(STOCK_TABLE).insert({
        product_id: product.id,
        product_name: product.name,
        type: 'ปรับสต็อก',
        direction: actualDelta >= 0 ? 'in' : 'out',
        qty: Math.abs(actualDelta),
        stock_before: before,
        stock_after: after,
        staff_name: staff(),
        note: result.value.note || 'ปรับสต็อกจากหน้าคลัง',
      });
      if (movement.error) throw movement.error;
      try { logActivity?.('ปรับสต็อกสินค้า', `"${product.name}" | ${fmt(before)} → ${fmt(after)} (${actualDelta >= 0 ? 'เพิ่ม' : 'ลด'} ${fmt(Math.abs(actualDelta))})`, product.id, PRODUCT_TABLE); } catch (_) {}
      toast?.('ปรับสต็อกสำเร็จ', 'success');
      if (typeof loadProducts === 'function') await loadProducts();
      if (typeof renderInventory === 'function') renderInventory();
      return true;
    } catch (error) {
      console.error('[v68] adjust stock:', error);
      toast?.('ปรับสต็อกไม่สำเร็จ: ' + (error.message || error), 'error');
      return false;
    }
  };
  window.adjustStock.__v68StockFix = true;
  try { adjustStock = window.adjustStock; } catch (_) {}

  function getCheckoutState() {
    try { return checkoutState || window.checkoutState || null; }
    catch (_) { return window.checkoutState || null; }
  }

  function setGlobalFn(name, fn) {
    window[name] = fn;
    try { Function('name', 'fn', 'window[name] = fn; eval(name + " = fn");')(name, fn); }
    catch (_) {}
  }

  function sendCustomerToDisplay(customer, type = 'member') {
    try {
      sendToDisplay?.({
        type: 'customer',
        name: customer?.name || 'ลูกค้าทั่วไป',
        customerType: type,
        phone: customer?.phone || '',
        address: customer?.address || '',
        debtAmount: num(customer?.debt_amount),
        customerKind: customer?.customer_type || '',
      });
    } catch (_) {}
  }

  async function loadCustomerDetails(customerId, fallbackName = '') {
    const latestBillContact = async (column, value) => {
      if (!value) return null;
      const { data: bills } = await db.from(BILL_TABLE)
        .select('customer_name,delivery_phone,delivery_address,date')
        .eq(column, value)
        .order('date', { ascending: false })
        .limit(1);
      return Array.isArray(bills) ? bills[0] : bills;
    };
    let customer = null;
    if (customerId) {
      const { data } = await db.from(CUSTOMER_TABLE)
        .select('id,name,phone,address,debt_amount,customer_type')
        .eq('id', customerId)
        .maybeSingle();
      customer = data || null;
    }
    if (!customer && fallbackName) customer = { id: customerId, name: fallbackName };
    if (!customer) return null;

    if (!customer.phone || !customer.address) {
      try {
        const bill = await latestBillContact('customer_id', customer.id)
          || await latestBillContact('customer_name', customer.name);
        customer.phone = customer.phone || bill?.delivery_phone || '';
        customer.address = customer.address || bill?.delivery_address || '';
      } catch (_) {}
    }
    return customer;
  }

  function selectedCustomerCard(customer, note = 'กำลังไปขั้นตอนชำระเงิน') {
    const content = document.getElementById('checkout-content') || document.getElementById('v12-step-body');
    if (!content || !customer?.name) return;
    document.getElementById('v68-selected-customer-bar')?.remove();
    const barHtml = `<div id="v68-selected-customer-bar" class="v68-picked-customer">
      <div class="v68-picked-icon"><i class="material-icons-round">check</i></div>
      <div class="v68-picked-body">
        <div class="v68-picked-label">เลือกลูกค้าแล้ว</div>
        <div class="v68-picked-name">${esc(customer.name)}</div>
        <div class="v68-picked-meta">
          ${customer.phone ? `<div class="v68-picked-phone"><i class="material-icons-round" style="font-size:17px">call</i>${esc(customer.phone)}</div>` : ''}
          ${customer.address ? `<div class="v68-picked-address"><i class="material-icons-round" style="font-size:17px">location_on</i>${esc(customer.address)}</div>` : ''}
          ${num(customer.debt_amount) > 0 ? `<div class="v68-picked-debt"><i class="material-icons-round" style="font-size:15px">account_balance_wallet</i>หนี้ ฿${fmt(customer.debt_amount)}</div>` : ''}
        </div>
        <div class="v68-picked-note">${esc(note)}</div>
      </div>
    </div>`;
    content.insertAdjacentHTML('afterbegin', barHtml);
  }

  function advanceAfterCustomerPicked(customer, type = 'member') {
    if (!customer?.id && type !== 'general') return;
    sendCartToDisplay();
    selectedCustomerCard(customer);
    sendCustomerToDisplay(customer, type);
    const state = getCheckoutState();
    if (state && Number(state.step) === 1) {
      clearTimeout(window.__v68CustomerAdvanceTimer);
      window.__v68CustomerAdvanceTimer = setTimeout(() => {
        const latest = getCheckoutState();
        if (latest && Number(latest.step) === 1 && typeof nextCheckoutStep === 'function') nextCheckoutStep();
      }, 520);
    }
  }

  async function hydrateCheckoutCustomer() {
    const state = getCheckoutState();
    if (!state?.customer) return state;
    const name = String(state.customer.name || '').trim();
    const hasRealName = name && !/ลูกค้าทั่วไป|general/i.test(name);

    if (state.customer.id) {
      const data = await loadCustomerDetails(state.customer.id, state.customer.name);
      if (data) {
        state.customer.id = data.id;
        state.customer.name = data.name || state.customer.name;
        state.customer.phone = data.phone || state.customer.phone || '';
        state.customer.address = data.address || state.customer.address || '';
        state.customer.debt_amount = data.debt_amount || 0;
        state.customer.customer_type = data.customer_type || '';
      }
      return state;
    }

    if (hasRealName) {
      const { data } = await db.from(CUSTOMER_TABLE).select('id,name,phone,address,debt_amount,customer_type').ilike('name', name).limit(2);
      if ((data || []).length === 1) {
        const full = await loadCustomerDetails(data[0].id, data[0].name) || data[0];
        state.customer.type = state.customer.type || 'member';
        state.customer.id = full.id;
        state.customer.name = full.name || name;
        state.customer.phone = full.phone || '';
        state.customer.address = full.address || '';
        state.customer.debt_amount = full.debt_amount || 0;
        state.customer.customer_type = full.customer_type || '';
      }
    }
    return state;
  }

  async function guardDebtCustomerBeforeSale() {
    const state = await hydrateCheckoutCustomer();
    if (!state) return;
    const isDebt = state.method === 'debt' || /ค้าง/.test(String(state.method || ''));
    if (isDebt && !state.customer?.id) {
      throw new Error('บิลค้างชำระต้องเลือกลูกค้าประจำก่อนบันทึก เพื่อไม่ให้เกิดบิลค้างที่ไม่ผูกลูกค้า');
    }
  }

  function bindCustomerDraftInputs() {
    const nameInput = document.getElementById('new-customer-name');
    const phoneInput = document.getElementById('new-customer-phone');
    if (!nameInput || nameInput.dataset.v68DraftBound === '1') return;
    if (!document.getElementById('new-customer-address')) {
      const group = document.createElement('div');
      group.className = 'form-group';
      group.innerHTML = `<label class="form-label">ที่อยู่</label><textarea class="form-input" id="new-customer-address" rows="2" placeholder="ที่อยู่ลูกค้า" style="min-height:74px;resize:vertical"></textarea>`;
      const phoneGroup = phoneInput?.closest('.form-group');
      phoneGroup?.insertAdjacentElement('afterend', group);
    }
    const addressInput = document.getElementById('new-customer-address');
    nameInput.dataset.v68DraftBound = '1';
    const sendDraft = () => {
      const name = nameInput.value.trim();
      const phone = phoneInput?.value?.trim() || '';
      const address = addressInput?.value?.trim() || '';
      try { sendToDisplay?.({ type: 'customer_draft', name, phone, address }); } catch (_) {}
    };
    nameInput.addEventListener('input', sendDraft);
    phoneInput?.addEventListener('input', sendDraft);
    addressInput?.addEventListener('input', sendDraft);
    sendDraft();
  }

  function currentNewCustomerAddress() {
    return document.getElementById('new-customer-address')?.value?.trim() || '';
  }

  function activeCartForDisplay() {
    try { if (Array.isArray(cart)) return cart; } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }

  function cartTotalForDisplay() {
    try { if (typeof getCartTotal === 'function') return getCartTotal(); } catch (_) {}
    return activeCartForDisplay().reduce((sum, item) => sum + num(item.price) * num(item.qty), 0);
  }

  function sendCartToDisplay() {
    try {
      if (typeof sendToDisplay !== 'function') return;
      const cartRows = activeCartForDisplay();
      sendToDisplay({ type: 'cart', cart: cartRows, total: cartTotalForDisplay() });
    } catch (_) {}
  }

  function installCheckoutCustomerFlowFixes() {
    if (window.__v68CheckoutCustomerFlowFixes) return;
    window.__v68CheckoutCustomerFlowFixes = true;

    ['completePayment', 'v12CompletePayment'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function') return;
      const wrapped = async function (...args) {
        try {
          await guardDebtCustomerBeforeSale();
          return await original.apply(this, args);
        } catch (error) {
          console.error('[v68] checkout customer guard:', error);
          toast?.(error.message || 'ตรวจสอบลูกค้าก่อนบันทึกบิลไม่สำเร็จ', 'error');
          return false;
        }
      };
      Object.defineProperty(wrapped, '__v68CustomerGuard', { value: true });
      setGlobalFn(name, wrapped);
    });

    const originalSelect = window.selectCustomer;
    if (typeof originalSelect === 'function') {
      setGlobalFn('selectCustomer', async function (id, name) {
        const result = originalSelect.apply(this, arguments);
        let customer = { id, name };
        try {
          const data = await loadCustomerDetails(id, name);
          if (data) customer = data;
          const state = getCheckoutState();
          if (state?.customer) {
            state.customer.id = customer.id;
            state.customer.name = customer.name || name;
            state.customer.phone = customer.phone || '';
            state.customer.address = customer.address || '';
            state.customer.debt_amount = customer.debt_amount || 0;
            state.customer.customer_type = customer.customer_type || '';
            state.customer.type = 'member';
          }
        } catch (_) {}
        advanceAfterCustomerPicked(customer, 'member');
        return result;
      });
    }

    const originalCreate = window.createNewCustomer;
    if (typeof originalCreate === 'function') {
      setGlobalFn('createNewCustomer', async function () {
        const address = currentNewCustomerAddress();
        const result = await originalCreate.apply(this, arguments);
        const state = getCheckoutState();
        if (state?.customer?.id) {
          try {
            if (address) await db.from(CUSTOMER_TABLE).update({ address, updated_at: new Date().toISOString() }).eq('id', state.customer.id);
            const data = await loadCustomerDetails(state.customer.id, state.customer.name);
            if (data) {
              state.customer.id = data.id;
              state.customer.name = data.name || state.customer.name;
              state.customer.phone = data.phone || '';
              state.customer.address = data.address || address || '';
              state.customer.debt_amount = data.debt_amount || 0;
              state.customer.customer_type = data.customer_type || '';
            }
          } catch (_) {}
          advanceAfterCustomerPicked(state.customer, 'new');
        }
        return result;
      });
    }

    const originalType = window.selectCustomerType;
    if (typeof originalType === 'function') {
      setGlobalFn('selectCustomerType', async function () {
        const result = await originalType.apply(this, arguments);
        setTimeout(bindCustomerDraftInputs, 0);
        const state = getCheckoutState();
        if (state?.customer?.type === 'general') sendCustomerToDisplay(state.customer, 'general');
        return result;
      });
    }

    const content = document.getElementById('checkout-content');
    if (content && window.MutationObserver) {
      new MutationObserver(() => bindCustomerDraftInputs()).observe(content, { childList: true, subtree: true });
    }

    const originalRenderCart = window.renderCart;
    if (typeof originalRenderCart === 'function' && !originalRenderCart.__v68DisplayCartSync) {
      const wrappedRenderCart = function (...args) {
        const result = originalRenderCart.apply(this, args);
        setTimeout(sendCartToDisplay, 0);
        return result;
      };
      Object.defineProperty(wrappedRenderCart, '__v68DisplayCartSync', { value: true });
      setGlobalFn('renderCart', wrappedRenderCart);
    }

    const wrapDisplaySync = name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__v68DisplaySync) return;
      const wrapped = function (...args) {
        const result = original.apply(this, args);
        const sync = () => setTimeout(sendCartToDisplay, 0);
        if (result && typeof result.then === 'function') return result.then(value => { sync(); return value; });
        sync();
        return result;
      };
      Object.defineProperty(wrapped, '__v68DisplaySync', { value: true });
      setGlobalFn(name, wrapped);
    };
    ['addToCart', 'updateCartQty', 'removeFromCart', 'v64ConfirmUnitAdd', 'v9ConfirmUnitAdd', 'v66RecipeAwareAddToCart'].forEach(wrapDisplaySync);
    setTimeout(() => ['addToCart', 'updateCartQty', 'removeFromCart', 'v64ConfirmUnitAdd', 'v9ConfirmUnitAdd', 'v66RecipeAwareAddToCart'].forEach(wrapDisplaySync), 600);
    setTimeout(() => ['addToCart', 'updateCartQty', 'removeFromCart', 'v64ConfirmUnitAdd', 'v9ConfirmUnitAdd', 'v66RecipeAwareAddToCart'].forEach(wrapDisplaySync), 1800);
  }

  async function bootSync() {
    try { await getSyncedCustomers(true); } catch (error) { console.warn('[v68] initial customer sync skipped:', error); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => {
    injectStyle();
    installCheckoutCustomerFlowFixes();
    setTimeout(bootSync, 1200);
  });
  else {
    injectStyle();
    installCheckoutCustomerFlowFixes();
    setTimeout(bootSync, 1200);
  }
})();
