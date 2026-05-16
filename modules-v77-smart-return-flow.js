(function () {
  'use strict';

  const BILL_TABLE = 'บิลขาย';
  const ITEM_TABLE = 'รายการในบิล';
  const PRODUCT_TABLE = 'สินค้า';
  const MOVE_TABLE = 'stock_movement';
  const CUSTOMER_TABLE = 'customer';

  const num = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const money = v => Math.round(num(v) * 100) / 100;
  const fmt = v => {
    try { return typeof formatNum === 'function' ? formatNum(v) : money(v).toLocaleString('th-TH'); }
    catch (_) { return money(v).toLocaleString('th-TH'); }
  };
  const parseInfo = info => {
    if (!info) return {};
    if (typeof info === 'object') return info || {};
    try { return JSON.parse(info) || {}; } catch (_) { return {}; }
  };
  const staff = () => {
    try { return (typeof v10Staff === 'function' ? v10Staff() : null) || USER?.username || 'system'; }
    catch (_) { return 'system'; }
  };
  const setGlobal = (name, value) => {
    try { window[name] = value; } catch (_) {}
    try { Function('n', 'v', 'try{eval(n+"=v")}catch(e){}')(name, value); } catch (_) {}
  };

  function isDebtBill(bill) {
    return /ค้าง/.test(String(bill?.method || '')) || /ค้าง/.test(String(bill?.status || ''));
  }

  function isTransferBill(bill) {
    return /โอน|พร้อมเพย์|บัตร|เครดิต/.test(String(bill?.method || ''));
  }

  function itemKey(row) {
    return [row.product_id || '', row.name || '', row.unit || row.sell_unit || ''].join('|');
  }

  async function askReturnSettlement(bill, totalReturn, debtDeduction) {
    const opts = {
      unpaid: 'ยังไม่ได้รับเงิน / หักยอดบิลเท่านั้น',
      cash: 'คืนเงินสด',
      transfer: 'คืนเงินโอน',
    };
    if (isDebtBill(bill) && debtDeduction > 0) opts.debt = 'หักหนี้ลูกค้า';

    let inputValue = 'unpaid';
    if (isDebtBill(bill) && debtDeduction > 0) inputValue = 'debt';
    else if (String(bill.method || '').includes('เงินสด')) inputValue = 'cash';
    else if (isTransferBill(bill)) inputValue = 'transfer';

    const { value, isConfirmed } = await Swal.fire({
      title: 'เลือกวิธีจัดการยอดคืน',
      html: `<div style="text-align:left;line-height:1.7">
        <div>ยอดคืน: <strong style="color:#dc2626">฿${fmt(totalReturn)}</strong></div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">ถ้าลูกค้ายังไม่ได้จ่ายหรือสินค้ายังไม่ได้ส่ง ให้เลือก “ยังไม่ได้รับเงิน” เพื่อหักเฉพาะยอดบิล</div>
      </div>`,
      input: 'select',
      inputOptions: opts,
      inputValue,
      showCancelButton: true,
      confirmButtonText: 'ดำเนินการคืน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });
    return isConfirmed ? value : null;
  }

  async function recordCashRefund(bill, totalReturn, reason) {
    if (typeof window.v28ExpenseWiz === 'function' && typeof loadDrawer === 'function') {
      const drawer = await loadDrawer();
      await new Promise(resolve => {
        window.v28ExpenseWiz(totalReturn, drawer, async res => {
          try {
            const { data: sess } = await db.from('cash_session')
              .select('id')
              .eq('status', 'open')
              .order('opened_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (sess?.id) {
              await db.from('cash_transaction').insert({
                session_id: sess.id,
                type: 'คืนเงิน',
                direction: 'out',
                amount: res.outTotal,
                change_amt: res.inTotal,
                net_amount: totalReturn,
                balance_after: 0,
                ref_id: bill.id,
                ref_table: BILL_TABLE,
                staff_name: staff(),
                denominations: res.out,
                change_denominations: res.in,
                note: `คืนบิล #${bill.bill_no}: ${reason}`,
              });
            }
          } catch (e) {
            console.error('[v77] cash refund:', e);
          }
          resolve();
        });
      });
      return true;
    }

    const { data: sess } = await db.from('cash_session')
      .select('id')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sess?.id && typeof window.recordCashTx === 'function') {
      await window.recordCashTx({
        sessionId: sess.id,
        type: 'คืนเงิน',
        direction: 'out',
        amount: totalReturn,
        netAmount: totalReturn,
        refId: bill.id,
        refTable: BILL_TABLE,
        note: `คืนบิล #${bill.bill_no}: ${reason}`,
      });
    }
    return true;
  }

  async function updateReturnedBillItems(billId, selectedItems) {
    const { data: currentItems, error } = await db.from(ITEM_TABLE).select('*').eq('bill_id', billId);
    if (error) throw error;

    const selectedByKey = {};
    selectedItems.forEach(it => {
      const key = itemKey(it);
      selectedByKey[key] = (selectedByKey[key] || 0) + num(it.return_qty);
    });

    for (const row of (currentItems || [])) {
      const key = itemKey(row);
      let returnQty = selectedByKey[key] || 0;
      if (returnQty <= 0) continue;

      const oldQty = num(row.qty);
      const oldTake = num(row.take_qty);
      const oldDeliver = num(row.deliver_qty);

      const nextQty = Math.max(0, oldQty - returnQty);
      let nextTake = oldTake;
      let nextDeliver = oldDeliver;

      if (oldDeliver > 0) {
        const cutDeliver = Math.min(oldDeliver, returnQty);
        nextDeliver = Math.max(0, oldDeliver - cutDeliver);
        returnQty -= cutDeliver;
      }
      if (returnQty > 0 && oldTake > 0) {
        const cutTake = Math.min(oldTake, returnQty);
        nextTake = Math.max(0, oldTake - cutTake);
      }

      const patch = {
        qty: nextQty,
        take_qty: nextTake,
        deliver_qty: nextDeliver,
        total: money(nextQty * num(row.price)),
      };
      await db.from(ITEM_TABLE).update(patch).eq('id', row.id);
    }
  }

  function nextDeliveryStatus(bill, allReturnItems, originalItems) {
    if (allReturnItems.length && originalItems.every(it => {
      const returned = allReturnItems
        .filter(ri => String(ri.name || '') === String(it.name || ''))
        .reduce((s, ri) => s + num(ri.qty), 0);
      return returned >= num(it.qty);
    })) return 'ยกเลิก';

    const remainingDeliver = originalItems.reduce((s, it) => {
      const ret = allReturnItems
        .filter(ri => String(ri.name || '') === String(it.name || ''))
        .reduce((sum, ri) => sum + num(ri.qty), 0);
      return s + Math.max(0, num(it.deliver_qty) - ret);
    }, 0);
    if (remainingDeliver > 0) return 'รอจัดส่ง';
    if (String(bill.delivery_status || '').includes('รอ')) return 'สำเร็จ';
    return bill.delivery_status || 'สำเร็จ';
  }

  async function smartConfirmReturn() {
    const bill = window._v10ReturnBill;
    const items = (window._v10ReturnItems || []).filter(it => num(it.return_qty) > 0);
    const reason = document.getElementById('v10-return-reason')?.value?.trim();
    if (!items.length) return window.toast?.('เลือกรายการคืนสินค้า', 'error');
    if (!reason) return window.toast?.('ระบุเหตุผล', 'error');

    const totalReturn = money(items.reduce((s, it) => s + num(it.return_qty) * num(it.price), 0));
    const allItems = window._v10ReturnItems || [];
    const origTotal = num(bill.return_info?.original_total ?? bill.total ?? 0);
    const prevReturnTotal = num(bill.return_info?.return_total);
    const depositPaid = num(bill.deposit_amount);
    const debtRemaining = isDebtBill(bill) ? Math.max(0, origTotal - depositPaid - prevReturnTotal) : 0;
    const debtDeduction = isDebtBill(bill) ? Math.min(totalReturn, debtRemaining) : 0;

    const settlement = await askReturnSettlement(bill, totalReturn, debtDeduction);
    if (!settlement) return;

    const cf = await Swal.fire({
      title: 'ยืนยันคืนสินค้า?',
      html: `<div style="line-height:1.7">คืน ${items.length} รายการ ยอด ฿${fmt(totalReturn)}<br><strong>${settlement === 'unpaid' ? 'หักเฉพาะยอดบิล' : settlement === 'debt' ? 'หักหนี้ลูกค้า' : settlement === 'cash' ? 'คืนเงินสด' : 'คืนเงินโอน'}</strong></div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });
    if (!cf.isConfirmed) return;

    if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังคืนสินค้า...');
    try {
      const { data: originalBillItems } = await db.from(ITEM_TABLE).select('*').eq('bill_id', bill.id);

      for (const item of items) {
        const convRate = num(item.conv_rate) || 1;
        const billItem = (originalBillItems || []).find(row => itemKey(row) === itemKey(item))
          || (originalBillItems || []).find(row => String(row.name || '') === String(item.name || ''));
        const delivered = /จัดส่งสำเร็จ/.test(String(bill.delivery_status || ''));
        const returnSellQty = num(item.return_qty);
        const pendingDeliverCut = delivered ? 0 : Math.min(num(billItem?.deliver_qty), returnSellQty);
        const stockReturnSellQty = Math.max(0, returnSellQty - pendingDeliverCut);
        item.__v77_stock_return_qty = stockReturnSellQty;
        if (stockReturnSellQty <= 0) continue;
        const baseQty = parseFloat((stockReturnSellQty * convRate).toFixed(6));
        const { data: prod } = await db.from(PRODUCT_TABLE).select('stock,unit').eq('id', item.product_id).maybeSingle();
        const stockBefore = num(prod?.stock);
        const stockAfter = parseFloat((stockBefore + baseQty).toFixed(6));
        const baseUnit = prod?.unit || item.base_unit || 'ชิ้น';
        await db.from(PRODUCT_TABLE).update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', item.product_id);
        await db.from(MOVE_TABLE).insert({
          product_id: item.product_id,
          product_name: item.name,
          type: 'คืนสินค้า',
          direction: 'in',
          qty: baseQty,
          stock_before: stockBefore,
          stock_after: stockAfter,
          ref_id: bill.id,
          ref_table: BILL_TABLE,
          staff_name: staff(),
          note: convRate !== 1 ? `คืนเข้าสต็อก ${stockReturnSellQty} ${item.sell_unit} (= ${baseQty} ${baseUnit}) - ${reason}` : reason,
        });
      }

      await updateReturnedBillItems(bill.id, items);

      let refundDone = false;
      let refundMethod = settlement;
      if (settlement === 'cash') {
        refundDone = await recordCashRefund(bill, totalReturn, reason);
        refundMethod = 'เงินสด';
      } else if (settlement === 'transfer') {
        refundDone = true;
        refundMethod = 'โอนเงิน';
      } else if (settlement === 'debt' && bill.customer_id && debtDeduction > 0) {
        const { data: c } = await db.from(CUSTOMER_TABLE).select('debt_amount,total_purchase').eq('id', bill.customer_id).maybeSingle();
        if (c) {
          await db.from(CUSTOMER_TABLE).update({
            debt_amount: Math.max(0, num(c.debt_amount) - debtDeduction),
            total_purchase: Math.max(0, num(c.total_purchase) - totalReturn),
          }).eq('id', bill.customer_id);
        }
      } else if (settlement === 'unpaid' && bill.customer_id) {
        const { data: c } = await db.from(CUSTOMER_TABLE).select('total_purchase').eq('id', bill.customer_id).maybeSingle();
        if (c) await db.from(CUSTOMER_TABLE).update({ total_purchase: Math.max(0, num(c.total_purchase) - totalReturn) }).eq('id', bill.customer_id);
      }

      if ((settlement === 'cash' || settlement === 'transfer') && bill.customer_id) {
        const { data: c } = await db.from(CUSTOMER_TABLE).select('total_purchase').eq('id', bill.customer_id).maybeSingle();
        if (c) await db.from(CUSTOMER_TABLE).update({ total_purchase: Math.max(0, num(c.total_purchase) - totalReturn) }).eq('id', bill.customer_id);
      }

      const prevRI = Array.isArray(bill.return_info?.return_items) ? bill.return_info.return_items : [];
      const newRI = items.map(it => ({
        name: it.name,
        product_id: it.product_id || null,
        qty: num(it.return_qty),
        price: num(it.price),
        unit: it.sell_unit,
        total: money(num(it.return_qty) * num(it.price)),
        cost: num(it.cost),
        return_cost: money(num(it.cost) * num(it.return_qty)),
        conv_rate: num(it.conv_rate) || 1,
        base_unit: it.base_unit,
        stock_return_qty: num(it.__v77_stock_return_qty),
      }));
      const allRI = [...prevRI, ...newRI];
      const allReturnTotal = money(allRI.reduce((s, it) => s + num(it.total), 0));
      const allReturnCost = money(allRI.reduce((s, it) => s + (num(it.return_cost) || num(it.cost) * num(it.qty)), 0));
      const newBillTotal = Math.max(0, money(origTotal - allReturnTotal));
      const allFull = allItems.every(it => num(it.return_qty) + num(it.already_returned) >= num(it.qty));
      const newStatus = (allFull || newBillTotal <= 0) ? 'คืนสินค้า' : 'คืนบางส่วน';
      const deliveryStatus = nextDeliveryStatus(bill, allRI, originalBillItems || []);

      await db.from(BILL_TABLE).update({
        return_info: {
          ...parseInfo(bill.return_info),
          returned_at: new Date().toISOString(),
          returned_by: staff(),
          return_reason: reason,
          return_items: allRI,
          return_total: allReturnTotal,
          return_cost_total: allReturnCost,
          original_total: origTotal,
          new_total: newBillTotal,
          refund_method: refundMethod,
          settlement_mode: settlement,
        },
        total: newBillTotal,
        status: newStatus,
        delivery_status: deliveryStatus,
      }).eq('id', bill.id);

      if (typeof window.logActivity === 'function') window.logActivity('คืนสินค้า', `บิล #${bill.bill_no} | ${items.map(it => `${it.name} x${it.return_qty} ${it.sell_unit}`).join(', ')} | ฿${fmt(totalReturn)} | ${settlement}`, bill.id, BILL_TABLE);

      if (typeof window.loadProducts === 'function') await window.loadProducts();
      if (typeof window.closeModal === 'function') window.closeModal();
      if (typeof window.loadHistoryData === 'function') window.loadHistoryData();
      if (typeof window.updateHomeStats === 'function') window.updateHomeStats();
      if (typeof window.renderDebts === 'function') window.renderDebts();
      if (typeof window.v12BMCLoad === 'function') window.v12BMCLoad();
      if (typeof v9HideOverlay === 'function') v9HideOverlay();

      await Swal.fire({
        icon: 'success',
        title: 'คืนสินค้าสำเร็จ',
        html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center"><div style="background:#fef2f2;padding:10px;border-radius:8px"><div style="font-size:11px;color:#64748b">ยอดคืน</div><b style="color:#dc2626">฿${fmt(totalReturn)}</b></div><div style="background:#f0fdf4;padding:10px;border-radius:8px"><div style="font-size:11px;color:#64748b">ยอดบิลใหม่</div><b style="color:#15803d">฿${fmt(newBillTotal)}</b></div></div>`,
        confirmButtonColor: '#10B981',
      });
    } catch (e) {
      if (typeof v9HideOverlay === 'function') v9HideOverlay();
      console.error('[v77] return failed:', e);
      window.toast?.('คืนสินค้าไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  }

  function install() {
    if (typeof window.v10ConfirmReturn !== 'function') return setTimeout(install, 300);
    if (window.v10ConfirmReturn.__v77SmartReturn) return;
    const originalShowReturn = window.v10ShowReturnModal;
    if (typeof originalShowReturn === 'function' && !originalShowReturn.__v77SmartReturn) {
      const wrappedShowReturn = async function (...args) {
        const out = await originalShowReturn.apply(this, args);
        const info = parseInfo(window._v10ReturnBill?.return_info);
        if (info.settlement_mode && Array.isArray(window._v10ReturnItems)) {
          window._v10ReturnItems.forEach(it => {
            it.already_returned = 0;
            it.max_returnable = Math.max(0, num(it.qty));
            if (it.return_qty > it.max_returnable) it.return_qty = it.max_returnable;
          });
          try { if (typeof window.v10RenderReturnModal === 'function') window.v10RenderReturnModal(); } catch (_) {}
        }
        return out;
      };
      Object.defineProperty(wrappedShowReturn, '__v77SmartReturn', { value: true });
      setGlobal('v10ShowReturnModal', wrappedShowReturn);
    }
    Object.defineProperty(smartConfirmReturn, '__v77SmartReturn', { value: true });
    setGlobal('v10ConfirmReturn', smartConfirmReturn);
  }

  install();
  console.log('[v77] smart return flow loaded');
})();
