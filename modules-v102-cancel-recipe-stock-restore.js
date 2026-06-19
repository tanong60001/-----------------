(function () {
  'use strict';

  console.log('[v102] cancel bill stock restore loaded');

  const BILL_TABLE = 'บิลขาย';
  const PRODUCT_TABLE = 'สินค้า';
  const MOVE_TABLE = 'stock_movement';
  const EPS = 0.000001;

  const num = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const fmt = value => {
    try {
      return typeof formatNum === 'function'
        ? formatNum(value)
        : num(value).toLocaleString('th-TH', { maximumFractionDigits: 4 });
    } catch (_) {
      return num(value).toLocaleString('th-TH', { maximumFractionDigits: 4 });
    }
  };

  const staff = () => {
    try { return USER?.username || localStorage.getItem('current_staff_name') || 'system'; }
    catch (_) { return 'system'; }
  };

  function database() {
    try {
      if (typeof db !== 'undefined' && db?.from) return db;
    } catch (_) {}
    if (window.db?.from) return window.db;
    throw new Error('database not ready');
  }

  function isCancelled(value) {
    return /ยกเลิก/.test(String(value || ''));
  }

  async function fetchBill(billId) {
    const { data, error } = await database().from(BILL_TABLE)
      .select('id,bill_no,status')
      .eq('id', billId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function aggregateNetOutgoing(movements) {
    const byProduct = new Map();

    (movements || []).forEach(move => {
      const productId = move?.product_id;
      if (!productId) return;
      const direction = String(move.direction || '').toLowerCase();
      if (direction !== 'out' && direction !== 'in') return;

      const key = String(productId);
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          product_id: productId,
          product_name: move.product_name || '',
          qty: 0,
          sources: [],
        });
      }

      const row = byProduct.get(key);
      const qty = num(move.qty);
      row.qty += direction === 'out' ? qty : -qty;
      if (direction === 'out' && move.type) row.sources.push(String(move.type));
      if (!row.product_name && move.product_name) row.product_name = move.product_name;
    });

    return [...byProduct.values()]
      .map(row => ({ ...row, qty: Number(row.qty.toFixed(6)) }))
      .filter(row => row.qty > EPS);
  }

  async function loadBillStockMovements(billId) {
    const { data, error } = await database().from(MOVE_TABLE)
      .select('id,product_id,product_name,type,direction,qty,stock_before,stock_after,ref_id,ref_table,note')
      .eq('ref_id', billId);
    if (error) throw error;
    return (data || []).filter(row => String(row.ref_id || '') === String(billId));
  }

  async function restoreProductStock(row, bill) {
    const { data: product, error } = await database().from(PRODUCT_TABLE)
      .select('id,name,stock,unit')
      .eq('id', row.product_id)
      .maybeSingle();
    if (error) throw error;
    if (!product?.id) throw new Error(`ไม่พบสินค้า/วัตถุดิบ ${row.product_name || row.product_id}`);

    const before = num(product.stock);
    const after = Number((before + row.qty).toFixed(6));
    const update = await database().from(PRODUCT_TABLE)
      .update({ stock: after, updated_at: new Date().toISOString() })
      .eq('id', row.product_id);
    if (update.error) throw update.error;

    const sourceText = [...new Set(row.sources || [])].slice(0, 4).join(', ');
    const insert = await database().from(MOVE_TABLE).insert({
      product_id: row.product_id,
      product_name: product.name || row.product_name || row.product_id,
      type: 'ยกเลิกบิล',
      direction: 'in',
      qty: row.qty,
      stock_before: before,
      stock_after: after,
      ref_id: bill.id,
      ref_table: BILL_TABLE,
      staff_name: staff(),
      note: `[cancel_restore:${bill.id}] คืนสต็อกจากบิล #${bill.bill_no || bill.id}${sourceText ? ` (${sourceText})` : ''}`,
    });
    if (insert.error) throw insert.error;

    try {
      const local = Array.isArray(window.products)
        ? window.products.find(item => String(item.id) === String(row.product_id))
        : null;
      if (local) local.stock = after;
    } catch (_) {}

    return { name: product.name || row.product_name || row.product_id, qty: row.qty, unit: product.unit || '' };
  }

  async function restoreCancelledBillStock(billId, options = {}) {
    database();
    const bill = options.bill || await fetchBill(billId);
    if (!bill?.id) throw new Error('ไม่พบบิล');
    if (!isCancelled(bill.status) && !options.force) return { restored: 0, rows: [] };

    const movements = await loadBillStockMovements(bill.id);
    const rows = aggregateNetOutgoing(movements);
    if (!rows.length) return { restored: 0, rows: [] };

    const restored = [];
    for (const row of rows) {
      restored.push(await restoreProductStock(row, bill));
    }

    try { await loadProducts?.(); } catch (_) {}
    try { window.renderProductGrid?.(); } catch (_) {}
    try { window.renderInventory?.(); } catch (_) {}
    try { window.v66ReloadRecipes?.(); } catch (_) {}

    if (typeof logActivity === 'function') {
      logActivity(
        'คืนสต็อกยกเลิกบิล',
        `บิล #${bill.bill_no || bill.id} คืน ${restored.length} รายการ`,
        bill.id,
        BILL_TABLE
      );
    }

    return { restored: restored.length, rows: restored };
  }

  async function restoreCancelledBillStockByBillNo(billNo, options = {}) {
    const { data: bill, error } = await database().from(BILL_TABLE)
      .select('id,bill_no,status')
      .eq('bill_no', billNo)
      .maybeSingle();
    if (error) throw error;
    if (!bill?.id) throw new Error(`ไม่พบบิล #${billNo}`);
    return restoreCancelledBillStock(bill.id, { ...options, bill });
  }

  function patchCancelBill() {
    const original = window.cancelBill;
    if (typeof original !== 'function' || original.__v102CancelStockRestore) return;

    const wrapped = async function (billId, ...args) {
      let beforeBill = null;
      try { beforeBill = await fetchBill(billId); } catch (_) {}

      const result = await original.call(this, billId, ...args);

      try {
        const afterBill = await fetchBill(billId);
        if (!afterBill || !isCancelled(afterBill.status) || isCancelled(beforeBill?.status)) return result;

        const restored = await restoreCancelledBillStock(billId, { bill: afterBill });
        if (restored.restored > 0) {
          const totalQty = restored.rows.reduce((sum, row) => sum + num(row.qty), 0);
          toast?.(`คืนสต็อกยกเลิกบิลแล้ว ${restored.restored} รายการ (${fmt(totalQty)})`, 'success');
        }
      } catch (error) {
        console.error('[v102] cancel stock restore:', error);
        toast?.('ยกเลิกบิลแล้ว แต่คืนสต็อกไม่สำเร็จ: ' + (error.message || error), 'error');
      }

      return result;
    };

    Object.defineProperty(wrapped, '__v102CancelStockRestore', { value: true });
    if (original.__v79ProjectCancel) Object.defineProperty(wrapped, '__v79ProjectCancel', { value: true });
    window.cancelBill = wrapped;
    try { cancelBill = wrapped; } catch (_) {}
  }

  window.v102RestoreCancelledBillStock = restoreCancelledBillStock;
  window.v102RestoreCancelledBillStockByBillNo = restoreCancelledBillStockByBillNo;

  function install() {
    patchCancelBill();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 800);
  setTimeout(install, 1800);
  setTimeout(install, 3200);
})();
