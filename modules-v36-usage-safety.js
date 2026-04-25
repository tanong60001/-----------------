'use strict';
console.log('[v36] Usage safety patch loaded');

(function () {
  const money = n => Number(n || 0);
  const fmt = n => typeof formatNum === 'function'
    ? formatNum(n)
    : money(n).toLocaleString('th-TH');

  const txt = {
    product: 'สินค้า',
    bill: 'บิลขาย',
    billItem: 'รายการในบิล',
    sale: 'ขาย',
    cash: 'เงินสด',
    transfer: 'โอนเงิน',
    credit: 'บัตรเครดิต',
    debt: 'ค้างชำระ',
    success: 'สำเร็จ',
    pendingDelivery: 'รอจัดส่ง',
    delivered: 'จัดส่งสำเร็จ',
    deliveryMove: 'จัดส่ง',
  };

  function userName() {
    try { return USER?.username || 'system'; } catch (_) { return 'system'; }
  }

  async function queryOne(table, select, filters) {
    let q = db.from(table).select(select);
    (filters || []).forEach(f => { q = q.eq(f[0], f[1]); });
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function openSession() {
    const { data, error } = await db.from('cash_session')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function must(res, label) {
    const out = await res;
    if (out && out.error) {
      throw new Error((label ? label + ': ' : '') + out.error.message);
    }
    return out;
  }

  function activeCart() {
    try {
      if (Array.isArray(cart)) return cart;
    } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }

  function setCartEmpty() {
    try { cart = []; } catch (_) {}
    try { window.cart = []; } catch (_) {}
  }

  function paymentMethodName(method) {
    return ({ cash: txt.cash, transfer: txt.transfer, credit: txt.credit, debt: txt.debt })[method] || txt.cash;
  }

  function htmlAttr(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function toastV36(message, type) {
    try {
      if (typeof toast === 'function') toast(message, type);
    } catch (_) {}
  }

  function hideOverlayNowV36() {
    try { if (typeof v9HideOverlay === 'function') v9HideOverlay(); } catch (_) {}
    try { document.getElementById('v9-overlay')?.remove(); } catch (_) {}
  }

  function jsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
  }

  async function refreshAfterSale() {
    try { if (typeof loadProducts === 'function') await loadProducts(); } catch (e) { console.warn('[v36] loadProducts:', e); }
    try {
      if (typeof products !== 'undefined') window._v9ProductsCache = products;
    } catch (_) {}
    try { if (typeof renderCart === 'function') renderCart(); } catch (_) {}
    try { window.v36BestSellerCache = null; } catch (_) {}
    try { if (typeof renderProductGrid === 'function') renderProductGrid(); } catch (_) {}
    try { if (typeof updateHomeStats === 'function') updateHomeStats(); } catch (_) {}
    try { if (typeof loadCashBalance === 'function') await loadCashBalance(); } catch (_) {}
    try {
      if (typeof renderCashDrawer === 'function') {
        const onCash = !document.getElementById('page-cash')?.classList.contains('hidden');
        if (onCash) await renderCashDrawer();
      }
    } catch (_) {}
  }

  async function assertCashReady(method) {
    if (method !== 'cash') return null;
    const session = await openSession();
    if (!session) {
      if (typeof Swal !== 'undefined') {
        await Swal.fire({
          icon: 'warning',
          title: 'ยังไม่ได้เปิดลิ้นชัก',
          text: 'กรุณาเปิดรอบลิ้นชักก่อนรับชำระด้วยเงินสด เพื่อให้ยอดเงินสดเชื่อมครบทุกจุด',
          confirmButtonText: 'ตกลง',
        });
      } else if (typeof toast === 'function') {
        toast('กรุณาเปิดลิ้นชักก่อนรับเงินสด', 'warning');
      }
      throw new Error('ยังไม่ได้เปิดลิ้นชักเงินสด');
    }
    return session;
  }

  async function buildSaleRows(bill, cartSnapshot) {
    const { data: productRows, error } = await db.from(txt.product)
      .select('id,name,stock,product_type,unit,cost');
    if (error) throw error;

    const stockMap = {};
    (productRows || []).forEach(p => { stockMap[p.id] = p; });

    const billItems = [];
    const movements = [];
    const now = new Date().toISOString();
    const stockUpdateMap = new Map();
    const queueStockUpdate = (productId, stockAfter) => {
      stockUpdateMap.set(productId, { stock: stockAfter, updated_at: now });
    };

    for (const item of cartSnapshot) {
      const fresh = stockMap[item.id];
      if (!fresh) throw new Error('ไม่พบสินค้าในคลัง: ' + (item.name || item.id));

      const convRate = Number(item.conv_rate || 1);
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const baseQty = Number((qty * convRate).toFixed(6));
      const sellUnit = item.unit || fresh.unit || 'ชิ้น';
      const isMto = !!(item.is_mto || fresh.product_type === 'ตามบิล');
      const costPerBase = Number(fresh.cost || item.cost || 0);

      if (!qty || qty <= 0) throw new Error('จำนวนสินค้าไม่ถูกต้อง: ' + (item.name || fresh.name));
      if (price < 0) throw new Error('ราคาสินค้าติดลบ: ' + (item.name || fresh.name));

      billItems.push({
        bill_id: bill.id,
        product_id: item.id,
        name: item.name || fresh.name,
        qty,
        price,
        cost: Number((costPerBase * convRate).toFixed(6)),
        total: Number((price * qty).toFixed(2)),
        unit: sellUnit,
      });

      if (isMto) {
        const { data: recipes, error: recipeError } = await db.from('สูตรสินค้า')
          .select('*')
          .eq('product_id', item.id);
        if (recipeError) throw recipeError;

        for (const recipe of (recipes || [])) {
          const mat = stockMap[recipe.material_id];
          if (!mat) throw new Error('ไม่พบวัตถุดิบของสูตร: ' + (recipe.material_id || 'unknown'));
          const needed = Number((Number(recipe.quantity || 0) * qty).toFixed(6));
          const matBefore = Number(mat.stock || 0);
          if (matBefore < needed) {
            throw new Error(`วัตถุดิบไม่พอ: ${mat.name || recipe.material_id} มี ${fmt(matBefore)} ต้องใช้ ${fmt(needed)}`);
          }
          const matAfter = Number((matBefore - needed).toFixed(6));
          mat.stock = matAfter;
          queueStockUpdate(recipe.material_id, matAfter);
          movements.push({
            product_id: recipe.material_id,
            product_name: mat.name || recipe.material_id,
            type: 'ใช้ผลิต(ขาย)',
            direction: 'out',
            qty: needed,
            stock_before: matBefore,
            stock_after: matAfter,
            ref_id: bill.id,
            ref_table: txt.bill,
            staff_name: userName(),
            note: `บิล #${bill.bill_no || bill.id}: ${item.name || fresh.name} x ${qty} ${sellUnit}`,
          });
        }
        continue;
      }

      const before = Number(fresh.stock || 0);
      if (before < baseQty) {
        throw new Error(`สต็อกไม่พอ: ${item.name || fresh.name} มี ${fmt(before)} ต้องใช้ ${fmt(baseQty)}`);
      }

      const after = Number((before - baseQty).toFixed(6));
      fresh.stock = after;
      queueStockUpdate(item.id, after);
      movements.push({
        product_id: item.id,
        product_name: item.name || fresh.name,
        type: txt.sale,
        direction: 'out',
        qty: baseQty,
        stock_before: before,
        stock_after: after,
        ref_id: bill.id,
        ref_table: txt.bill,
        staff_name: userName(),
        note: convRate !== 1 ? `ขาย ${qty} ${sellUnit} (${baseQty} ${fresh.unit || ''})` : null,
      });
    }

    const stockUpdates = Array.from(stockUpdateMap.entries()).map(([productId, data]) =>
      db.from(txt.product).update(data).eq('id', productId)
    );

    return { billItems, movements, stockUpdates };
  }

  async function runSafeSale() {
    if (window.__posPaymentLock) return;
    window.__posPaymentLock = true;
    window.isProcessingPayment = true;

    let bill = null;
    try {
      if (!window.checkoutState) throw new Error('ไม่พบข้อมูลชำระเงิน');
      const cartSnapshot = activeCart().map(item => ({ ...item }));
      if (!cartSnapshot.length) throw new Error('ไม่มีสินค้าในตะกร้า');
      if (!money(checkoutState.total) || money(checkoutState.total) <= 0) throw new Error('ยอดขายไม่ถูกต้อง');

      const session = await assertCashReady(checkoutState.method);
      if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังบันทึกบิล...', 'ระบบกำลังตรวจสอบข้อมูลและตัดสต็อก');

      if (checkoutState.customer?.id) {
        try {
          const { data: custPre } = await db.from('customer')
            .select('address,phone')
            .eq('id', checkoutState.customer.id)
            .maybeSingle();
          if (custPre) {
            checkoutState.customer.address = custPre.address || '';
            checkoutState.customer.phone = custPre.phone || '';
          }
        } catch (_) {}
      }

      const billRes = await must(db.from(txt.bill).insert({
        date: new Date().toISOString(),
        method: paymentMethodName(checkoutState.method),
        total: money(checkoutState.total),
        discount: money(checkoutState.discount),
        received: money(checkoutState.received),
        change: money(checkoutState.change),
        customer_name: checkoutState.customer?.name || null,
        customer_id: checkoutState.customer?.id || null,
        customer_address: checkoutState.customer?.address || null,
        customer_phone: checkoutState.customer?.phone || null,
        staff_name: typeof v9Staff === 'function' ? v9Staff() : userName(),
        status: checkoutState.method === 'debt' ? txt.debt : txt.success,
      }).select().single(), 'บันทึกบิล');
      bill = billRes.data;

      const { billItems, movements, stockUpdates } = await buildSaleRows(bill, cartSnapshot);
      if (billItems.length) await must(db.from(txt.billItem).insert(billItems), 'บันทึกรายการในบิล');
      if (movements.length) await must(db.from('stock_movement').insert(movements), 'บันทึกประวัติสต็อก');

      const stockResults = await Promise.all(stockUpdates);
      stockResults.forEach((res, i) => {
        if (res?.error) throw new Error('ตัดสต็อกไม่สำเร็จรายการที่ ' + (i + 1) + ': ' + res.error.message);
      });

      if (checkoutState.method === 'cash') {
        let changeDenoms = checkoutState.changeDenominations || {};
        if (!Object.values(changeDenoms || {}).some(v => Number(v) > 0) && money(checkoutState.change) > 0 && typeof calcChangeDenominations === 'function') {
          changeDenoms = calcChangeDenominations(money(checkoutState.change));
        }
        if (typeof window.recordCashTx !== 'function') throw new Error('ไม่พบระบบบันทึกเงินสดเข้าลิ้นชัก');
        await window.recordCashTx({
          sessionId: session.id,
          type: txt.sale,
          direction: 'in',
          amount: money(checkoutState.received),
          changeAmt: money(checkoutState.change),
          netAmount: money(checkoutState.total),
          refId: bill.id,
          refTable: txt.bill,
          denominations: checkoutState.receivedDenominations || {},
          changeDenominations: changeDenoms || {},
        });
      }

      if (checkoutState.customer?.id) {
        const { data: cust } = await db.from('customer')
          .select('total_purchase,visit_count,debt_amount')
          .eq('id', checkoutState.customer.id)
          .maybeSingle();
        await must(db.from('customer').update({
          total_purchase: money(cust?.total_purchase) + money(checkoutState.total),
          visit_count: money(cust?.visit_count) + 1,
          debt_amount: checkoutState.method === 'debt'
            ? money(cust?.debt_amount) + money(checkoutState.total)
            : money(cust?.debt_amount),
        }).eq('id', checkoutState.customer.id), 'อัปเดตลูกค้า');
      }

      if (typeof logActivity === 'function') {
        await Promise.resolve(logActivity(txt.sale, `บิล #${bill.bill_no || bill.id} ฿${fmt(checkoutState.total)}`, bill.id, txt.bill));
      }

      if (typeof sendToDisplay === 'function') {
        sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: checkoutState.total });
      }

      setCartEmpty();
      if (typeof closeCheckout === 'function') closeCheckout();
      await refreshAfterSale();
      if (typeof v9HideOverlay === 'function') v9HideOverlay();

      const result = typeof Swal !== 'undefined'
        ? await Swal.fire({
            icon: 'success',
            title: `บิล #${bill.bill_no || ''} สำเร็จ`,
            html: `<div style="font-size:15px">ยอดขาย <b>฿${fmt(bill.total)}</b></div>`,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'พิมพ์ 80mm',
            denyButtonText: 'พิมพ์ A4',
            cancelButtonText: 'ไม่พิมพ์',
            confirmButtonColor: '#dc2626',
            denyButtonColor: '#2563eb',
          })
        : {};

      const printFmt = result.isConfirmed ? '80mm' : (result.isDenied ? 'A4' : null);
      if (printFmt && typeof printReceipt === 'function') printReceipt(bill, billItems, printFmt);
      return bill;
    } catch (e) {
      if (typeof v9HideOverlay === 'function') v9HideOverlay();
      console.error('[v36] sale failed:', e);
      if (bill?.id) {
        try {
          await db.from(txt.bill).update({
            status: 'รอตรวจสอบ',
            note: 'บันทึกไม่ครบ: ' + (e.message || e),
          }).eq('id', bill.id);
        } catch (_) {}
      }
      if (typeof toast === 'function') toast('บันทึกขายไม่สำเร็จ: ' + (e.message || e), 'error');
      else alert('บันทึกขายไม่สำเร็จ: ' + (e.message || e));
      throw e;
    } finally {
      window.isProcessingPayment = false;
      window.__posPaymentLock = false;
    }
  }

  function installSaleSafety() {
    window.v9Sale = runSafeSale;
    window.v9Sale.__v36safe = true;
    window.completePayment = async function () {
      return window.v9Sale();
    };
    window.completePayment.__v36safe = true;
  }

  function installCashSafety() {
    const originalOpen = window.openCashSession;
    if (typeof originalOpen === 'function' && !originalOpen.__v36safe) {
      window.openCashSession = async function () {
        if (window.__cashOpenLock) return;
        window.__cashOpenLock = true;
        try {
          const session = await openSession();
          if (session) {
            if (typeof toast === 'function') toast('มีรอบลิ้นชักเปิดอยู่แล้ว ไม่ต้องเปิดซ้ำ', 'info');
            if (typeof renderCashDrawer === 'function') await renderCashDrawer();
            return;
          }
          return await originalOpen.apply(this, arguments);
        } finally {
          window.__cashOpenLock = false;
        }
      };
      window.openCashSession.__v36safe = true;
    }

    const originalRecordCash = window.recordCashTx;
    if (typeof originalRecordCash === 'function' && !originalRecordCash.__v36safe) {
      window.recordCashTx = async function (args) {
        const a = { ...(args || {}) };
        const net = money(a.netAmount ?? a.net_amount ?? a.amount);
        const amount = money(a.amount ?? net);
        const change = money(a.changeAmt ?? a.change_amt);
        if (!Number.isFinite(net) || !Number.isFinite(amount) || !Number.isFinite(change) || net < 0 || amount < 0 || change < 0) {
          throw new Error('ยอดเงินสดไม่ถูกต้อง');
        }
        if ((a.direction === 'in' || a.direction === 'out') && net <= 0) {
          throw new Error('ยอดเงินสดต้องมากกว่า 0');
        }
        if (!a.sessionId && !a.session_id) {
          const session = await openSession();
          if (!session) throw new Error('ยังไม่ได้เปิดลิ้นชักเงินสด');
          a.sessionId = session.id;
        }
        return await originalRecordCash.call(this, a);
      };
      window.recordCashTx.__v36safe = true;
    }

    const originalCashMovement = window.cashMovement;
    if (typeof originalCashMovement === 'function' && !originalCashMovement.__v36safe) {
      window.cashMovement = async function (type, session) {
        const liveSession = session || await openSession();
        if (!liveSession) return notify('กรุณาเปิดลิ้นชักก่อนทำรายการเงินสด', 'warning');

        const isAdd = type === 'add';
        if (typeof Swal === 'undefined') return originalCashMovement.apply(this, arguments);
        const { value, isConfirmed } = await Swal.fire({
          title: isAdd ? 'เพิ่มเงินเข้าลิ้นชัก' : 'เบิกเงินออกจากลิ้นชัก',
          html: `
            <input id="v36-cash-amt" class="swal2-input" type="number" min="1" step="0.01" placeholder="จำนวนเงิน">
            <input id="v36-cash-note" class="swal2-input" type="text" placeholder="หมายเหตุ (ถ้ามี)">
          `,
          showCancelButton: true,
          confirmButtonText: 'บันทึก',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: isAdd ? '#10b981' : '#ef4444',
          preConfirm: () => {
            const amount = money(document.getElementById('v36-cash-amt')?.value);
            if (!Number.isFinite(amount) || amount <= 0) {
              Swal.showValidationMessage('กรุณาระบุจำนวนเงินมากกว่า 0');
              return false;
            }
            return {
              amount,
              note: document.getElementById('v36-cash-note')?.value || '',
            };
          },
        });
        if (!isConfirmed || !value) return;

        await must(db.from('cash_transaction').insert({
          session_id: liveSession.id,
          type: isAdd ? 'เพิ่มเงิน' : 'เบิกเงิน',
          direction: isAdd ? 'in' : 'out',
          amount: value.amount,
          net_amount: value.amount,
          balance_after: 0,
          staff_name: userName(),
          note: value.note || null,
        }), 'บันทึกรายการลิ้นชัก');
        notify(isAdd ? 'เพิ่มเงินสำเร็จ' : 'เบิกเงินสำเร็จ', 'success');
        if (typeof renderCashDrawer === 'function') await renderCashDrawer();
      };
      window.cashMovement.__v36safe = true;
    }
  }

  function checkoutMethodLabelV36(method) {
    return ({ cash: 'เงินสด', transfer: 'โอน/พร้อมเพย์', credit: 'บัตรเครดิต', debt: 'ค้างชำระ', project: 'จ่ายของให้โครงการ' })[method] || '-';
  }

  function checkoutCartV36() {
    return activeCart();
  }

  function renderCheckoutShellV36() {
    document.getElementById('v36-checkout-style')?.remove();
    document.head.insertAdjacentHTML('beforeend', `
      <style id="v36-checkout-style">
        #checkout-overlay.checkout-overlay{background:rgba(15,23,42,.28)!important;backdrop-filter:blur(8px);padding:18px!important}
        .checkout-modal{width:min(1120px,96vw);height:min(760px,92vh);max-height:92vh;border-radius:18px;background:#f8fbff;border:1px solid #d7e3ef;box-shadow:0 26px 70px rgba(30,64,100,.22);display:grid;grid-template-columns:330px minmax(0,1fr);grid-template-rows:80px minmax(0,1fr) auto;overflow:hidden;padding:0}
        .checkout-modal::before{content:'สรุปรายการ';display:block;grid-column:1;grid-row:1;z-index:2;background:#eaf3ff;border-right:1px solid #d4e2f0;padding:26px 24px;font-size:22px;font-weight:900;color:#172033}
        .checkout-progress{grid-column:2;grid-row:1;align-self:start;height:80px;background:#fff;border-bottom:1px solid #dbe7f2;display:flex;align-items:center;justify-content:center;gap:28px;padding:0 28px;margin:0}
        .checkout-progress::before{content:'ชำระเงิน';position:absolute;left:356px;top:25px;font-size:15px;font-weight:900;color:#172033}
        .progress-step{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;min-width:82px;color:#8392a5}
        .progress-step:not(:last-child)::after{content:'';position:absolute;top:16px;left:58px;width:58px;height:2px;background:#d7e4ef}
        .progress-step.completed:not(:last-child)::after,.progress-step.active:not(:last-child)::after{background:#cbd5e1}
        .step-num{width:32px;height:32px;border-radius:999px;background:#eaf2fb;border:2px solid #cddcea;color:#66798e;display:flex;align-items:center;justify-content:center;font-weight:900}
        .progress-step.active .step-num{background:#64748b;border-color:#64748b;color:#fff;box-shadow:0 0 0 5px #e2e8f0}
        .progress-step.completed .step-num{background:#64748b;border-color:#64748b;color:#fff}
        .progress-step span{font-size:11px;font-weight:900;color:#76869a}
        .progress-step.active span{color:#475569}
        .checkout-content{grid-column:2;grid-row:2;background:#f8fbff;padding:28px 30px;overflow:auto}
        .checkout-footer{grid-column:2;grid-row:3;background:#fff;border-top:1px solid #dbe7f2;padding:18px 30px;display:flex;gap:12px;justify-content:space-between}
        .checkout-footer .btn{border-radius:8px;height:44px;font-weight:900}
        #checkout-cancel{margin-right:auto;border:1px solid #cbd8e6;color:#526274;background:#fff}
        #checkout-back{border:1px solid #cbd8e6;color:#526274;background:#fff}
        #checkout-next{margin-left:auto;background:#475569;border-color:#475569;color:#fff;min-width:210px}
        .v36-checkout-summary{grid-column:1;grid-row:1 / span 3;background:#eaf3ff;border-right:1px solid #d4e2f0;padding:88px 22px 24px;display:flex;flex-direction:column;min-height:0}
        .v36-checkout-items{display:flex;flex-direction:column;gap:10px;overflow:auto;padding-right:4px}
        .v36-checkout-item{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #d8e5f1}
        .v36-checkout-ico{width:38px;height:38px;border-radius:8px;background:#dbeafe;color:#314760;display:flex;align-items:center;justify-content:center}
        .v36-checkout-name{font-size:14px;font-weight:900;color:#263449;line-height:1.25}
        .v36-checkout-meta{font-size:12px;color:#718198;margin-top:2px}
        .v36-checkout-price{font-weight:900;color:#1f2b3d;white-space:nowrap}
        .v36-checkout-total{margin-top:auto;border-top:1px solid #cbd8e6;padding-top:18px;display:flex;align-items:flex-end;justify-content:space-between;color:#6b7b90}
        .v36-checkout-total strong{font-size:42px;color:#334155;line-height:1;font-weight:900}
        .v36-step-title{text-align:center;font-size:30px;font-weight:900;color:#172033;margin:8px 0 26px}
        .v36-option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;max-width:720px;margin:0 auto}
        .customer-type-btn,.payment-method-btn{border:1.5px solid #ccd8e4;background:#fff;border-radius:12px;min-height:130px;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;cursor:pointer;transition:.18s;box-shadow:0 10px 24px rgba(31,45,61,.035)}
        .customer-type-btn:hover,.payment-method-btn:hover{transform:translateY(-1px);border-color:#a6b8c9}
        .customer-type-btn.selected,.payment-method-btn.selected{border-color:#64748b;background:#f8fafc;box-shadow:0 0 0 3px #e2e8f0}
        .customer-type-icon,.payment-method-btn i{width:54px;height:54px;border-radius:50%;background:#dbeafe;color:#516579;display:flex;align-items:center;justify-content:center;font-size:28px}
        .customer-type-btn.selected .customer-type-icon,.payment-method-btn.selected i{background:#64748b;color:#fff}
        .customer-type-info h4,.payment-method-btn span{font-size:16px;font-weight:900;color:#35445a}
        .customer-type-info p{font-size:12px;color:#8291a5;margin:2px 0 0}
        .amount-display{background:#f8fafc;border:1px solid #dbe3ec;border-radius:14px;padding:18px;text-align:center}
        .amount-label{font-size:13px;color:#607184;font-weight:800}.amount-value{font-size:42px;color:#334155;font-weight:900}
        #checkout-overlay .checkout-modal.v36-checkout-modal{width:min(1160px,96vw)!important;height:min(760px,92vh)!important;max-width:min(1160px,96vw)!important;max-height:92vh!important;border-radius:18px!important;background:#f8fbff!important;border:1px solid #d7e3ef!important;box-shadow:0 26px 70px rgba(30,64,100,.22)!important;display:grid!important;grid-template-columns:330px minmax(0,1fr)!important;grid-template-rows:80px minmax(0,1fr) auto!important;overflow:hidden!important;padding:0!important;margin:auto!important;color:#172033!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal::before{content:'รายการในตะกร้า'!important;background:#edf7ff!important;color:#172033!important;border-right:1px solid #d4e2f0!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .v36-checkout-summary{background:#edf7ff!important;color:#263449!important;border-right:1px solid #d4e2f0!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .v36-checkout-item{background:#fff!important;border:1px solid #d8e5f1!important;border-radius:10px!important;padding:10px!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .checkout-progress{background:#fff!important;color:#76869a!important;border-bottom:1px solid #dbe7f2!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .progress-line{background:#dbe7f2!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .step-num{background:#eff5fb!important;border-color:#dce7f2!important;color:#8190a3!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .progress-step.active .step-num,#checkout-overlay .checkout-modal.v36-checkout-modal .progress-step.completed .step-num{background:#64748b!important;border-color:#64748b!important;color:#fff!important;box-shadow:0 0 0 5px #e2e8f0!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .progress-step.active span{color:#475569!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .checkout-content{background:#f8fbff!important;color:#172033!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .checkout-footer{background:#fff!important;border-top:1px solid #dbe7f2!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .customer-type-btn,#checkout-overlay .checkout-modal.v36-checkout-modal .payment-method-btn{background:#fff!important;color:#35445a!important;border:1.5px solid #ccd8e4!important;box-shadow:0 10px 24px rgba(31,45,61,.035)!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .customer-type-btn.selected,#checkout-overlay .checkout-modal.v36-checkout-modal .payment-method-btn.selected{background:#f8fafc!important;border-color:#64748b!important;box-shadow:0 0 0 3px #e2e8f0!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal .customer-type-btn.selected .customer-type-icon,#checkout-overlay .checkout-modal.v36-checkout-modal .payment-method-btn.selected i{background:#64748b!important;color:#fff!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal #checkout-next{background:#475569!important;border-color:#475569!important;color:#fff!important}
        @media(max-width:860px){.checkout-modal{grid-template-columns:1fr;height:94vh}.checkout-modal::before,.v36-checkout-summary{display:none}.checkout-progress,.checkout-content,.checkout-footer{grid-column:1}.checkout-progress::before{left:24px}.v36-option-grid{grid-template-columns:1fr}.checkout-content{padding:22px}.progress-step:not(:last-child)::after{display:none}}
      </style>`);
  }

  function syncCheckoutSummaryV36() {
    const modal = document.querySelector('.checkout-modal');
    if (!modal) return;
    renderCheckoutShellV36();
    modal.classList.add('v36-checkout-modal');
    let box = modal.querySelector('.v36-checkout-summary');
    if (!box) {
      box = document.createElement('aside');
      box.className = 'v36-checkout-summary';
      modal.prepend(box);
    }
    const items = checkoutCartV36();
    const totalQty = items.reduce((s, x) => s + money(x.qty), 0);
    const subtotal = items.reduce((s, x) => s + money(x.price) * money(x.qty), 0);
    box.innerHTML = `
      <div class="v36-checkout-items">
        ${items.map(item => `<div class="v36-checkout-item">
          <div class="v36-checkout-ico"><i class="material-icons-round">inventory_2</i></div>
          <div><div class="v36-checkout-name">${htmlAttr(item.name || '')}</div><div class="v36-checkout-meta">x${fmt(item.qty)} ${htmlAttr(item.unit || '')}</div></div>
          <div class="v36-checkout-price">฿${fmt(money(item.price) * money(item.qty))}</div>
        </div>`).join('') || '<div style="color:#7b8a9d">ไม่มีสินค้า</div>'}
      </div>
      <div class="v36-checkout-total"><div><div>รวม</div><div style="font-size:12px">${fmt(totalQty)} ชิ้น</div></div><strong>฿${fmt(subtotal)}</strong></div>`;
  }

  function installCheckoutRedesignV36() {
    renderCheckoutShellV36();
    window.v36CheckoutRedesignInstalled = true;
    if (window.renderCheckoutStep?.__v36redesign) return;

    const originalStart = window.startCheckout;
    if (typeof originalStart === 'function' && !originalStart.__v36redesign) {
      window.startCheckout = function () {
        const out = originalStart.apply(this, arguments);
        setTimeout(() => {
          syncCheckoutSummaryV36();
          const modal = document.querySelector('.checkout-modal');
          if (modal) modal.dataset.v36Checkout = 'active';
        }, 20);
        return out;
      };
      try { startCheckout = window.startCheckout; } catch (_) {}
      window.startCheckout.__v36redesign = true;
    }

    const originalRender = window.renderCheckoutStep;
    if (typeof originalRender === 'function') {
      window.renderCheckoutStep = function () {
        const out = originalRender.apply(this, arguments);
        syncCheckoutSummaryV36();
        const content = document.getElementById('checkout-content');
        if (content && !content.querySelector('.v36-step-title')) {
          const title = document.createElement('div');
          title.className = 'v36-step-title';
          title.textContent = ['เลือกลูกค้า', 'เลือกวิธีชำระเงิน', 'รับเงินสด', 'ตรวจสอบและบันทึก'][Math.max(0, (checkoutState?.step || 1) - 1)] || 'ชำระเงิน';
          content.prepend(title);
        }
        const step1 = content?.querySelector('.customer-selection');
        if (step1) step1.classList.add('v36-option-grid');
        const step2 = content?.querySelector('.payment-methods');
        if (step2) step2.classList.add('v36-option-grid');
        return out;
      };
      try { renderCheckoutStep = window.renderCheckoutStep; } catch (_) {}
      window.renderCheckoutStep.__v36redesign = true;
    }
  }

  function installCartPanelRedesignV36() {
    document.getElementById('v36-cart-style')?.remove();
  }

  function installReturnFlowWatchdogV36() {
    const originalReturn = window.v10ConfirmReturn;
    if (typeof originalReturn !== 'function' || originalReturn.__v36returnSafe) return;

    window.v10ConfirmReturn = async function () {
      if (window.__v36ReturnBusy) {
        toastV36('ระบบกำลังทำรายการคืนสินค้าอยู่ กรุณารอสักครู่', 'warning');
        return;
      }

      window.__v36ReturnBusy = true;
      const originalShowOverlay = window.v9ShowOverlay;
      let restored = false;

      const restoreReturnHooks = () => {
        if (restored) return;
        restored = true;
        if (typeof originalShowOverlay === 'function') {
          window.v9ShowOverlay = originalShowOverlay;
          try { v9ShowOverlay = originalShowOverlay; } catch (_) {}
        }
      };

      if (typeof originalShowOverlay === 'function') {
        window.v9ShowOverlay = function (msg, sub) {
          if (window.__v36ReturnBusy && String(msg || '').includes('กำลังดำเนินการ')) {
            hideOverlayNowV36();
            return;
          }
          return originalShowOverlay.apply(this, arguments);
        };
        try { v9ShowOverlay = window.v9ShowOverlay; } catch (_) {}
      }

      let finished = false;
      const watchdog = setTimeout(() => {
        if (finished) return;
        hideOverlayNowV36();
        toastV36('ระบบคืนสินค้ารอนานผิดปกติ ยกเลิกหน้ารอแล้ว กรุณาตรวจสอบรายการก่อนทำซ้ำ', 'warning');
        window.__v36ReturnBusy = false;
        restoreReturnHooks();
      }, 120000);

      try {
        return await originalReturn.apply(this, arguments);
      } catch (err) {
        console.error('[v36] Return flow failed:', err);
        hideOverlayNowV36();
        toastV36('คืนสินค้าไม่สำเร็จ กรุณาลองใหม่หรือตรวจสอบรายการ', 'error');
      } finally {
        finished = true;
        clearTimeout(watchdog);
        restoreReturnHooks();
        window.__v36ReturnBusy = false;
      }
    };
    window.v10ConfirmReturn.__v36returnSafe = true;
  }

  function denomTotalV36(counts) {
    return Object.entries(counts || {}).reduce((sum, pair) => sum + (money(pair[0]) * money(pair[1])), 0);
  }

  function canMakeDrawerAmountV36(drawer, amount) {
    const goal = Math.round(money(amount));
    if (goal <= 0) return true;
    const denoms = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
    const dp = new Uint8Array(goal + 1);
    dp[0] = 1;
    for (const value of denoms) {
      const rawCount = money(drawer?.[value] ?? drawer?.[String(value)] ?? 0);
      const count = Math.min(Math.max(0, Math.floor(rawCount)), Math.floor(goal / value));
      for (let n = 0; n < count; n++) {
        for (let total = goal; total >= value; total--) {
          if (dp[total - value]) dp[total] = 1;
        }
      }
      if (dp[goal]) return true;
    }
    return !!dp[goal];
  }

  async function openReturnCashDenomWizardV36(amount, drawer, onConfirm, fallback, required) {
    const liveDrawer = typeof window.v32LoadDrawer === 'function'
      ? await window.v32LoadDrawer()
      : (drawer || {});
    const drawerTotal = denomTotalV36(liveDrawer);

    if (drawerTotal < amount) {
      toastV36('\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01\u0E44\u0E21\u0E48\u0E1E\u0E2D\u0E14\u0E35\u0E01\u0E31\u0E1A\u0E22\u0E2D\u0E14\u0E04\u0E37\u0E19 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E40\u0E1B\u0E34\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E41\u0E1A\u0E1A\u0E40\u0E14\u0E34\u0E21', 'warning');
      return fallback();
    }

    hideOverlayNowV36();
    const out = await window.v32ShowDenomWizard({
      title: '\u0E19\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E04\u0E37\u0E19\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32',
      subtitle: '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E18\u0E19\u0E1A\u0E31\u0E15\u0E23/\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D\u0E08\u0E32\u0E01\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E22\u0E2D\u0E14\u0E04\u0E37\u0E19 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E15\u0E31\u0E14\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01\u0E17\u0E31\u0E19\u0E17\u0E35\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01',
      icon: '<i class="material-icons-round">assignment_return</i>',
      dir: 'out',
      targetAmount: amount,
      mustBeExact: false,
      drawer: liveDrawer,
      showBalance: true,
      balance: drawerTotal,
      confirmText: '\u0E16\u0E31\u0E14\u0E44\u0E1B',
      cancelText: '\u0E22\u0E49\u0E2D\u0E19\u0E01\u0E25\u0E31\u0E1A'
    });

    if (!out) {
      toastV36('\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E19\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E04\u0E37\u0E19 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E19\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E43\u0E2B\u0E49\u0E04\u0E23\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01', 'warning');
      if (required) setTimeout(() => openReturnCashDenomWizardV36(amount, drawer, onConfirm, fallback, required), 120);
      return;
    }

    const outTotal = denomTotalV36(out);
    const changeTarget = Math.max(0, outTotal - amount);
    let inCounts = {};
    let inTotal = 0;

    if (changeTarget > 0) {
      inCounts = await window.v32ShowDenomWizard({
        title: '\u0E19\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E17\u0E2D\u0E19\u0E01\u0E25\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01',
        subtitle: '\u0E19\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E17\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E23\u0E31\u0E1A\u0E01\u0E25\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E22\u0E2D\u0E14\u0E17\u0E2D\u0E19',
        icon: '<i class="material-icons-round">keyboard_return</i>',
        dir: 'in',
        targetAmount: changeTarget,
        mustBeExact: true,
        showBalance: false,
        confirmText: '\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E04\u0E37\u0E19\u0E40\u0E07\u0E34\u0E19',
        cancelText: '\u0E22\u0E49\u0E2D\u0E19\u0E01\u0E25\u0E31\u0E1A'
      });
      if (!inCounts) {
        toastV36('\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E19\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E17\u0E2D\u0E19 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E19\u0E31\u0E1A\u0E43\u0E2B\u0E49\u0E04\u0E23\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01', 'warning');
        if (required) setTimeout(() => openReturnCashDenomWizardV36(amount, drawer, onConfirm, fallback, required), 120);
        return;
      }
      inTotal = denomTotalV36(inCounts);
    }

    if (typeof onConfirm === 'function') onConfirm({ out, outTotal, in: inCounts, inTotal, __v36ReturnCash: true });
    return undefined;
  }

  function installReturnCashDenomWizardV36() {
    const originalExpenseWizard = window.v28ExpenseWiz;
    if (typeof originalExpenseWizard !== 'function' || originalExpenseWizard.__v36returnDenom) return;

    window.__v36OriginalV28ExpenseWiz = window.__v36OriginalV28ExpenseWiz || originalExpenseWizard;
    window.v28ExpenseWiz = function (expAmt, drawer, onConfirm) {
      const amount = money(expAmt);
      const fallback = () => originalExpenseWizard.call(this, expAmt, drawer, onConfirm);

      if (typeof window.v32ShowDenomWizard !== 'function') {
        return fallback();
      }

      openReturnCashDenomWizardV36(amount, drawer, onConfirm, fallback, !!window.__v36ReturnBusy).catch(err => {
        console.error('[v36] return cash denomination wizard failed:', err);
        toastV36('\u0E40\u0E1B\u0E34\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E04\u0E37\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E43\u0E0A\u0E49\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E14\u0E34\u0E21\u0E41\u0E17\u0E19', 'warning');
        fallback();
      });
      return undefined;
    };
    window.v28ExpenseWiz.__v36returnDenom = true;
  }

  function installProductValidation() {
    installProductImagePaste();

    const originalSave = window.saveProduct;
    if (typeof originalSave === 'function' && !originalSave.__v36safe) {
      window.saveProduct = async function () {
        const id = document.getElementById('prod-id')?.value || '';
        const name = (document.getElementById('prod-name')?.value || '').trim();
        const barcode = (document.getElementById('prod-barcode')?.value || '').trim();
        const price = money(document.getElementById('prod-price')?.value);
        const cost = money(document.getElementById('prod-cost')?.value);
        const stock = money(document.getElementById('prod-stock')?.value);
        const minStock = money(document.getElementById('prod-min-stock')?.value);

        if (!name) return toast?.('กรุณาระบุชื่อสินค้า', 'warning');
        if (!Number.isFinite(price) || price < 0) return toast?.('ราคาขายต้องไม่ติดลบ', 'warning');
        if (!Number.isFinite(cost) || cost < 0) return toast?.('ต้นทุนต้องไม่ติดลบ', 'warning');
        if (!Number.isFinite(stock) || stock < 0) return toast?.('สต็อกต้องไม่ติดลบ', 'warning');
        if (!Number.isFinite(minStock) || minStock < 0) return toast?.('สต็อกขั้นต่ำต้องไม่ติดลบ', 'warning');

        if (barcode) {
          let q = db.from(txt.product).select('id,name').eq('barcode', barcode);
          const { data, error } = await q.limit(2);
          if (error) throw error;
          const duplicate = (data || []).find(p => String(p.id) !== String(id));
          if (duplicate) {
            return toast?.(`บาร์โค้ดนี้ใช้กับสินค้า "${duplicate.name}" อยู่แล้ว`, 'warning');
          }
        }
        return await originalSave.apply(this, arguments);
      };
      window.saveProduct.__v36safe = true;
    }

    const originalDeleteProduct = window.deleteProduct;
    if (typeof originalDeleteProduct === 'function' && !originalDeleteProduct.__v36safe) {
      window.deleteProduct = async function (productId) {
        const used = await queryOne(txt.billItem, 'id', [['product_id', productId]]);
        if (used) {
          return Swal.fire({
            icon: 'warning',
            title: 'ลบสินค้าไม่ได้',
            text: 'สินค้านี้เคยอยู่ในบิลขายแล้ว เพื่อไม่ให้ประวัติบิลเสียหายให้ปรับสต็อกเป็น 0 หรือเปลี่ยนชื่อว่าเลิกขายแทน',
            confirmButtonText: 'ตกลง',
          });
        }
        return await originalDeleteProduct.apply(this, arguments);
      };
      window.deleteProduct.__v36safe = true;
    }
  }

  function readImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('อ่านรูปภาพไม่ได้'));
      };
      img.src = url;
    });
  }

  async function canvasToBlob(canvas, type, quality) {
    return await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('แปลงรูปภาพไม่ได้'));
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    if (parts.length < 2) throw new Error('รูปภาพไม่ถูกต้อง');
    const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/webp';
    const bin = atob(parts[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function isImageDataUrl(value) {
    return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || ''));
  }

  function productImagePathFromUrl(url) {
    const raw = String(url || '');
    if (!raw || !raw.includes('/storage/v1/object/public/product-images/')) return null;
    try {
      const u = new URL(raw);
      const marker = '/storage/v1/object/public/product-images/';
      const idx = u.pathname.indexOf(marker);
      if (idx < 0) return null;
      return decodeURIComponent(u.pathname.slice(idx + marker.length));
    } catch (_) {
      const marker = 'product-images/';
      const idx = raw.indexOf(marker);
      return idx >= 0 ? raw.slice(idx + marker.length) : null;
    }
  }

  async function removeOldProductImage(oldUrl) {
    const path = productImagePathFromUrl(oldUrl);
    if (!path || !db?.storage) return;
    try { await db.storage.from('product-images').remove([path]); } catch (_) {}
  }

  async function uploadProductImageBlob(blob, nameHint) {
    if (!db?.storage) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase Storage');
    const finalBlob = blob.type === 'image/webp' && blob.size <= 120 * 1024
      ? blob
      : (await compressProductImage(blob)).blob;
    const safeName = String(nameHint || 'product')
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42) || 'product';
    const fileName = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.webp`;
    const { error } = await db.storage.from('product-images').upload(fileName, finalBlob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw new Error('อัปโหลดรูปไป Supabase Storage ไม่สำเร็จ: ' + error.message);
    const { data } = db.storage.from('product-images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function compressAdImage(blob) {
    if (!blob || !String(blob.type || '').startsWith('image/')) {
      throw new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพ');
    }
    const img = await readImage(blob);
    const srcW = img.naturalWidth || img.width || 1920;
    const srcH = img.naturalHeight || img.height || 640;
    const targetW = 1920;
    const targetH = 640;
    const scale = Math.max(targetW / srcW, targetH / srcH);
    const drawW = Math.round(srcW * scale);
    const drawH = Math.round(srcH * scale);
    const dx = Math.round((targetW - drawW) / 2);
    const dy = Math.round((targetH - drawH) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, drawW, drawH);
    let best = null;
    for (const q of [0.78, 0.68, 0.58, 0.48, 0.38, 0.3]) {
      const out = await canvasToBlob(canvas, 'image/webp', q);
      if (out && (!best || out.size < best.size)) best = out;
      if (out && out.size <= 360 * 1024) return out;
    }
    if (!best) {
      for (const q of [0.7, 0.58, 0.46, 0.34]) {
        const out = await canvasToBlob(canvas, 'image/jpeg', q);
        if (out && (!best || out.size < best.size)) best = out;
        if (out && out.size <= 420 * 1024) return out;
      }
    }
    if (!best) throw new Error('บีบอัดรูปโฆษณาไม่สำเร็จ');
    return best;
  }

  async function uploadAdImageBlobV36(blob, nameHint) {
    if (!db?.storage) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase Storage');
    const finalBlob = await compressAdImage(blob);
    const safeName = String(nameHint || 'ad')
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42) || 'ad';
    const ext = finalBlob.type === 'image/jpeg' ? 'jpg' : 'webp';
    const fileName = `ads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.${ext}`;
    const { error } = await db.storage.from('product-images').upload(fileName, finalBlob, {
      contentType: finalBlob.type || (ext === 'jpg' ? 'image/jpeg' : 'image/webp'),
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw new Error('อัปโหลดรูปโฆษณาไป Supabase ไม่สำเร็จ: ' + error.message);
    const { data } = db.storage.from('product-images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function saveCustomerAdSettingsRemoteV36(settings) {
    if (!db?.storage) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase Storage');
    const fileName = 'ads/customer-display-settings.json';
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const { error } = await db.storage.from('product-images').upload(fileName, blob, {
      contentType: 'application/json',
      cacheControl: '60',
      upsert: true,
    });
    if (error) throw new Error('บันทึกตั้งค่าโฆษณาไป Supabase ไม่สำเร็จ: ' + error.message);
    const { data } = db.storage.from('product-images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function uploadImageValueIfNeeded(value, oldValue, nameHint) {
    const imgValue = String(value || '').trim();
    if (!isImageDataUrl(imgValue)) return imgValue || null;
    const url = await uploadProductImageBlob(dataUrlToBlob(imgValue), nameHint);
    await removeOldProductImage(oldValue);
    return url;
  }

  async function compressProductImage(blob) {
    if (!blob || !String(blob.type || '').startsWith('image/')) {
      throw new Error('ไฟล์ที่วางไม่ใช่รูปภาพ');
    }

    const img = await readImage(blob);
    const sourceMax = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    let maxSide = Math.min(1000, sourceMax || 1000);
    let best = null;

    for (let scaleTry = 0; scaleTry < 5; scaleTry++) {
      const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const w = Math.max(1, Math.round((img.naturalWidth || img.width) * ratio));
      const h = Math.max(1, Math.round((img.naturalHeight || img.height) * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      const candidates = [];
      for (const type of ['image/webp', 'image/jpeg']) {
        for (const q of [0.72, 0.6, 0.48, 0.36, 0.28]) {
          const out = await canvasToBlob(canvas, type, q);
          if (out) candidates.push(out);
        }
      }

      candidates.sort((a, b) => a.size - b.size);
      if (candidates[0] && (!best || candidates[0].size < best.size)) best = candidates[0];
      if (best && best.size <= 90 * 1024) break;
      maxSide = Math.round(maxSide * 0.78);
    }

    if (!best) throw new Error('บีบอัดรูปภาพไม่สำเร็จ');
    return {
      blob: best,
      dataUrl: await blobToDataUrl(best),
      size: best.size,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    };
  }

  async function fetchImageFromUrl(url) {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) throw new Error('โหลดรูปจาก URL ไม่สำเร็จ');
    const blob = await res.blob();
    if (!String(blob.type || '').startsWith('image/')) throw new Error('URL นี้ไม่ใช่ไฟล์รูปภาพ');
    return blob;
  }

  function setProductImagePreview(dataUrl, metaText) {
    const imgInput = document.getElementById('prod-img');
    const preview = document.getElementById('v36-prod-img-preview');
    const meta = document.getElementById('v36-prod-img-meta');
    if (imgInput) imgInput.value = dataUrl || '';
    if (preview) {
      preview.innerHTML = dataUrl
        ? `<img src="${dataUrl}" alt="product" style="width:100%;height:100%;object-fit:cover">`
        : '<i class="material-icons-round" style="font-size:34px;color:#94a3b8">image</i>';
    }
    if (meta) meta.textContent = metaText || (dataUrl ? 'พร้อมบันทึกรูปภาพ' : 'วางรูปภาพหรือ URL รูปภาพได้ที่นี่');
  }

  async function handleProductImageBlob(blob) {
    const meta = document.getElementById('v36-prod-img-meta');
    if (meta) meta.textContent = 'กำลังบีบอัดรูปภาพ...';
    const out = await compressProductImage(blob);
    setProductImagePreview(out.dataUrl, `บีบอัดแล้ว ${(out.size / 1024).toFixed(1)} KB`);
  }

  function installProductImagePaste() {
    const originalModal = window.showAddProductModal;
    if (typeof originalModal !== 'function') return;
    if (originalModal.__v36imagepaste) {
      enhanceProductImageInput();
      enhanceV9ProductImageInput();
      return;
    }

    window.showAddProductModal = function () {
      const result = originalModal.apply(this, arguments);
      setTimeout(enhanceProductImageInput, 30);
      setTimeout(enhanceV9ProductImageInput, 30);
      return result;
    };
    window.showAddProductModal.__v36imagepaste = true;

    enhanceProductImageInput();
    enhanceV9ProductImageInput();
  }

  function installProductStorageBridge() {
    if (typeof window.uploadImageToSupabase === 'function' && !window.uploadImageToSupabase.__v36storage) {
      window.uploadImageToSupabase = async function (file) {
        if (!file) return null;
        return await uploadProductImageBlob(file, file.name || document.getElementById('v9prod-name')?.value || 'product');
      };
      window.uploadImageToSupabase.__v36storage = true;
    }

    const originalV9Save = window.v9SaveProduct;
    if (typeof originalV9Save === 'function' && !originalV9Save.__v36storage) {
      window.v9SaveProduct = async function () {
        const img = document.getElementById('v9prod-img');
        const oldImg = document.getElementById('v9prod-img-old');
        const name = document.getElementById('v9prod-name')?.value || 'product';
        if (img && isImageDataUrl(img.value)) {
          const meta = document.getElementById('v36-v9prod-img-meta');
          if (meta) meta.textContent = 'กำลังอัปโหลดรูปไป Supabase Storage...';
          img.value = await uploadImageValueIfNeeded(img.value, oldImg?.value, name);
          if (oldImg) oldImg.value = img.value;
          setV9ProductImagePreview(img.value, 'อัปโหลดแล้ว จะบันทึกเฉพาะ URL รูปภาพ');
        } else if (img && !String(img.value || '').trim() && oldImg?.value) {
          await removeOldProductImage(oldImg.value);
        }
        return await originalV9Save.apply(this, arguments);
      };
      window.v9SaveProduct.__v36storage = true;
    }

    const originalBaseSave = window.saveProduct;
    if (typeof originalBaseSave === 'function' && !originalBaseSave.__v36storage) {
      window.saveProduct = async function () {
        const img = document.getElementById('prod-img');
        const name = document.getElementById('prod-name')?.value || 'product';
        if (img && isImageDataUrl(img.value)) {
          const meta = document.getElementById('v36-prod-img-meta');
          if (meta) meta.textContent = 'กำลังอัปโหลดรูปไป Supabase Storage...';
          img.value = await uploadImageValueIfNeeded(img.value, '', name);
          setProductImagePreview(img.value, 'อัปโหลดแล้ว จะบันทึกเฉพาะ URL รูปภาพ');
        }
        return await originalBaseSave.apply(this, arguments);
      };
      window.saveProduct.__v36storage = true;
      window.saveProduct.__v36safe = !!originalBaseSave.__v36safe;
    }
  }

  function installProductImageMigrationTool() {
    if (window.v36MigrateProductImagesToStorage) return;
    window.v36MigrateProductImagesToStorage = async function () {
      const { data, error } = await db.from(txt.product).select('id,name,img_url');
      if (error) throw error;
      const rows = (data || []).filter(p => isImageDataUrl(p.img_url));
      if (!rows.length) {
        notify('ไม่มีรูป Base64 ที่ต้องย้าย', 'info');
        return { total: 0, done: 0 };
      }
      let done = 0;
      for (const p of rows) {
        const url = await uploadImageValueIfNeeded(p.img_url, '', p.name || p.id);
        const res = await db.from(txt.product).update({ img_url: url, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (res.error) throw res.error;
        done++;
      }
      if (typeof loadProducts === 'function') await loadProducts();
      notify(`ย้ายรูปสินค้าไป Storage สำเร็จ ${done}/${rows.length} รูป`, 'success');
      return { total: rows.length, done };
    };
  }

  const PERMISSION_DEFS = [
    { key: 'can_pos', page: 'pos', label: 'POS ขาย', icon: 'point_of_sale', desc: 'ขายสินค้าและออกบิล' },
    { key: 'can_inv', page: 'inv', label: 'คลังสินค้า', icon: 'inventory_2', desc: 'ดู/แก้ไขสินค้าและสต็อก' },
    { key: 'can_manage', page: 'manage', label: 'จัดการสินค้า', icon: 'settings_suggest', desc: 'หมวดหมู่ หน่วยนับ สูตร ซัพพลายเออร์ ผลิต' },
    { key: 'can_cash', page: 'cash', label: 'ลิ้นชักเงินสด', icon: 'account_balance_wallet', desc: 'เปิด/ปิดรอบ เพิ่ม/เบิกเงิน' },
    { key: 'can_exp', page: 'exp', label: 'รายจ่าย', icon: 'receipt_long', desc: 'บันทึกและดูรายจ่าย' },
    { key: 'can_debt', page: 'debt', label: 'ลูกค้าค้างชำระ', icon: 'groups', desc: 'ดูหนี้และรับชำระหนี้' },
    { key: 'can_customer', page: 'customer', label: 'ลูกค้าประจำ', icon: 'star', desc: 'จัดการข้อมูลลูกค้า' },
    { key: 'can_purchase', page: 'purchase', label: 'รับสินค้าเข้า', icon: 'local_shipping', desc: 'รับสินค้าเข้าคลังและเจ้าหนี้' },
    { key: 'can_payable', page: 'payable', label: 'เจ้าหนี้ร้าน', icon: 'account_balance', desc: 'ดู/ชำระเจ้าหนี้และซัพพลายเออร์' },
    { key: 'can_quotation', page: 'quotation', label: 'ใบเสนอราคา', icon: 'description', desc: 'สร้างและจัดการใบเสนอราคา' },
    { key: 'can_delivery', page: 'delivery', label: 'คิวจัดส่ง', icon: 'local_shipping', desc: 'ดูคิวและปิดงานจัดส่ง' },
    { key: 'can_projects', page: 'projects', label: 'โครงการ', icon: 'business_center', desc: 'ติดตามงบ รายจ่าย และกำไรโครงการ' },
    { key: 'can_att', page: 'att', label: 'พนักงาน/เงินเดือน', icon: 'badge', desc: 'เช็กชื่อ เงินเดือน และ HR' },
    { key: 'can_dash', page: 'dash', label: 'Dashboard', icon: 'analytics', desc: 'ดูรายงานและวิเคราะห์ธุรกิจ' },
    { key: 'can_history', page: 'history', label: 'ประวัติขาย', icon: 'history', desc: 'ดูบิลย้อนหลังและยกเลิก/พิมพ์ซ้ำ' },
    { key: 'can_log', page: 'log', label: 'ประวัติกิจกรรม', icon: 'manage_search', desc: 'ดู log การใช้งานระบบ' },
  ];

  const PERMISSION_PAGE_MAP = PERMISSION_DEFS.reduce((acc, item) => {
    acc[item.page] = item.key;
    return acc;
  }, {
    home: null,
    admin: '__admin__',
    ap: 'can_payable',
    vendor: 'can_payable',
  });

  let v36PermissionColumns = null;

  function canAccessPageV36(page) {
    if (!USER) return false;
    if (USER.role === 'admin') return true;
    const key = PERMISSION_PAGE_MAP[page];
    if (key === null || key === undefined) return true;
    if (key === '__admin__') return false;
    if (key === 'can_history') return USER_PERMS?.can_history === true || USER_PERMS?.can_log === true;
    if (key === 'can_payable') return USER_PERMS?.can_payable === true || USER_PERMS?.can_purchase === true;
    return USER_PERMS?.[key] === true;
  }

  function deniedPermissionNoticeV36(page) {
    const def = PERMISSION_DEFS.find(d => d.page === page);
    const pageName = def?.label || page || 'หน้านี้';
    notify(`คุณไม่มีสิทธิ์เข้าถึง ${pageName}`, 'warning');
  }

  function applyNavPermissionsV36() {
    if (!USER) return;
    const isAdmin = USER.role === 'admin';
    document.getElementById('nav-admin-section')?.style.setProperty('display', isAdmin ? 'block' : 'none');
    document.getElementById('nav-admin')?.style.setProperty('display', isAdmin ? 'flex' : 'none');
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      const page = item.dataset.page;
      if (page === 'admin') return;
      const allowed = canAccessPageV36(page);
      item.style.display = allowed ? '' : 'none';
      item.classList.remove('v36-no-permission');
      item.style.opacity = '';
      item.style.filter = '';
      item.style.cursor = '';
      item.title = '';
    });
  }

  function installPermissionMapCompleteness() {
    try {
      if (typeof PAGE_PERM_MAP !== 'undefined') {
        Object.assign(PAGE_PERM_MAP, PERMISSION_PAGE_MAP, {
          customer: 'can_customer',
          quotation: 'can_quotation',
          payable: 'can_payable',
          history: 'can_history',
          delivery: 'can_delivery',
          projects: 'can_projects',
          manage: 'can_manage',
          ap: 'can_payable',
          vendor: 'can_payable',
          admin: '__admin__',
        });
      }
    } catch (e) {
      console.warn('[v36-perms] map patch skipped:', e);
    }

    if (typeof window.hasPermission !== 'function' || !window.hasPermission.__v36perms) {
      window.hasPermission = canAccessPageV36;
      try { hasPermission = canAccessPageV36; } catch (_) {}
      window.hasPermission.__v36perms = true;
    }

    if (typeof window.applyNavPermissions !== 'function' || !window.applyNavPermissions.__v36perms) {
      window.applyNavPermissions = applyNavPermissionsV36;
      try { applyNavPermissions = applyNavPermissionsV36; } catch (_) {}
      window.applyNavPermissions.__v36perms = true;
    }

    if (typeof window.go === 'function' && !window.go.__v36perms) {
      const originalGo = window.go;
      window.go = function (page) {
        if (!canAccessPageV36(page)) {
          deniedPermissionNoticeV36(page);
          page = 'home';
        }
        if (page === 'history' && USER_PERMS?.can_log === true) USER_PERMS.can_history = true;
        if ((page === 'payable' || page === 'ap' || page === 'vendor') && USER_PERMS?.can_purchase === true) USER_PERMS.can_payable = true;
        return originalGo.call(this, page);
      };
      try { go = window.go; } catch (_) {}
      window.go.__v36perms = true;
    }

    if (!document.__v36PermissionClickGuard) {
      document.__v36PermissionClickGuard = true;
      document.addEventListener('click', (ev) => {
        const item = ev.target?.closest?.('[data-page], .action-btn[onclick*="go("], .action-card[onclick*="go("]');
        if (!item || item.closest?.('.nav-item[data-page]')) return;
        let page = item.dataset?.page || '';
        if (!page) {
          const raw = item.getAttribute('onclick') || '';
          const m = raw.match(/go\(['"]([^'"]+)['"]\)/);
          page = m ? m[1] : '';
        }
        if (!page || canAccessPageV36(page)) return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
        deniedPermissionNoticeV36(page);
      }, true);
    }

    setTimeout(applyNavPermissionsV36, 100);
  }

  async function detectPermissionColumns(rows) {
    if (v36PermissionColumns) return v36PermissionColumns;
    const sample = rows && rows[0] ? rows[0] : null;
    if (sample) {
      v36PermissionColumns = new Set(Object.keys(sample));
      return v36PermissionColumns;
    }
    v36PermissionColumns = new Set(['user_id', ...PERMISSION_DEFS.map(p => p.key)]);
    return v36PermissionColumns;
  }

  function missingPermissionColumns(columns) {
    if (!columns || !columns.size) return [];
    return PERMISSION_DEFS.map(p => p.key).filter(key => !columns.has(key));
  }

  function permissionMigrationSQL(keys) {
    return keys.map(k => `alter table "สิทธิ์การเข้าถึง" add column if not exists ${k} boolean default false;`).join('\n');
  }

  async function saveUserPermissionsV36(userId) {
    const payload = {};
    PERMISSION_DEFS.forEach(def => {
      const el = document.getElementById(`v36perm-${userId}-${def.key}`);
      payload[def.key] = !!el?.checked;
    });

    const cols = await detectPermissionColumns();
    const missing = missingPermissionColumns(cols);
    const writable = {};
    Object.entries(payload).forEach(([key, val]) => {
      if (!cols || cols.has(key)) writable[key] = val;
    });

    try {
      const { data: ex, error: exErr } = await db.from('สิทธิ์การเข้าถึง').select('id').eq('user_id', userId).maybeSingle();
      if (exErr) throw exErr;
      const res = ex
        ? await db.from('สิทธิ์การเข้าถึง').update(writable).eq('user_id', userId)
        : await db.from('สิทธิ์การเข้าถึง').insert({ user_id: userId, ...writable });
      if (res.error) throw res.error;
      if (USER?.id === userId) {
        USER_PERMS = { ...(USER_PERMS || {}), ...payload };
        applyNavPermissionsV36();
      }
      if (missing.length) {
        notify('บันทึกสิทธิ์ที่ตารางรองรับแล้ว แต่ยังมีคอลัมน์สิทธิ์ใหม่ที่ต้องเพิ่มใน Supabase', 'warning');
      } else {
        notify('บันทึกสิทธิ์สำเร็จ', 'success');
      }
    } catch (e) {
      console.error('[v36-perms] save:', e);
      notify('บันทึกสิทธิ์ไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  }

  function setAllPermissionsV36(userId, checked) {
    PERMISSION_DEFS.forEach(def => {
      const el = document.getElementById(`v36perm-${userId}-${def.key}`);
      if (el) el.checked = checked;
    });
    saveUserPermissionsV36(userId);
  }

  function renderMissingPermissionWarning(missing) {
    if (!missing.length) return '';
    const sql = permissionMigrationSQL(missing);
    window.v36PermissionSQL = sql;
    return `
      <div style="margin-bottom:14px;padding:12px 14px;border:1px solid #fde68a;background:#fffbeb;border-radius:12px;color:#92400e;font-size:12px;line-height:1.55">
        <b>ต้องเพิ่มคอลัมน์สิทธิ์ใน Supabase อีก ${missing.length} ช่อง</b>
        <div style="margin-top:4px">คัดลอก SQL จาก <code>window.v36PermissionSQL</code> ไปรันใน Supabase SQL Editor เพื่อให้สิทธิ์ใหม่บันทึกได้ครบ</div>
      </div>`;
  }

  function effectivePermissionChecked(perms, def) {
    if (perms?.[def.key] === true) return true;
    if (perms?.[def.key] === false) return false;
    if (def.key === 'can_history') return perms?.can_log === true;
    if (def.key === 'can_payable') return perms?.can_purchase === true;
    if (def.key === 'can_delivery') return perms?.can_purchase === true || perms?.can_pos === true;
    if (def.key === 'can_customer') return perms?.can_debt === true || perms?.can_pos === true;
    if (def.key === 'can_quotation') return perms?.can_pos === true;
    if (def.key === 'can_projects') return perms?.can_dash === true || perms?.can_exp === true;
    const legacyCore = ['can_pos', 'can_inv', 'can_cash', 'can_exp', 'can_debt', 'can_att', 'can_purchase', 'can_dash', 'can_log'];
    return legacyCore.every(key => perms?.[key] === true);
  }

  async function renderUserPermsV36(container) {
    if (!container) container = document.querySelector('#admin-content, .admin-content, [data-tab-content="users"]');
    if (!container) return;
    container.innerHTML = '<div style="padding:28px;text-align:center;color:#94a3b8">กำลังโหลดสิทธิ์...</div>';

    let users = [], perms = [];
    try {
      const [ur, pr] = await Promise.all([
        db.from('ผู้ใช้งาน').select('*').order('username'),
        db.from('สิทธิ์การเข้าถึง').select('*'),
      ]);
      if (ur.error) throw ur.error;
      if (pr.error) throw pr.error;
      users = ur.data || [];
      perms = pr.data || [];
    } catch (e) {
      container.innerHTML = `<div style="padding:24px;color:#dc2626">โหลดสิทธิ์ไม่สำเร็จ: ${htmlAttr(e.message || e)}</div>`;
      return;
    }

    const cols = await detectPermissionColumns(perms);
    const missing = missingPermissionColumns(cols);
    const permMap = {};
    perms.forEach(p => { permMap[p.user_id] = p; });

    container.innerHTML = `
      ${renderMissingPermissionWarning(missing)}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap">
        <div>
          <h3 style="font-size:16px;font-weight:800;margin:0 0 3px">จัดการผู้ใช้งานและสิทธิ์</h3>
          <div style="font-size:12px;color:#94a3b8">${users.length} บัญชี - สิทธิ์ครบตามเมนูระบบ</div>
        </div>
        <button class="btn btn-primary" onclick="showAddUserModal?.()"><i class="material-icons-round">person_add</i> เพิ่มผู้ใช้งาน</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${users.map(user => {
          const isAdmin = user.role === 'admin';
          const p = permMap[user.id] || {};
          return `
            <div style="border:1.5px solid ${isAdmin ? '#fca5a5' : '#e2e8f0'};border-radius:16px;overflow:hidden;background:#fff">
              <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;background:${isAdmin ? '#fff5f5' : '#f8fafc'}">
                <div style="width:44px;height:44px;border-radius:50%;background:${isAdmin ? '#dc2626' : '#6366f1'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900">${htmlAttr(String(user.username || '?').charAt(0).toUpperCase())}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:15px;font-weight:800;color:#334155">${htmlAttr(user.username || '-')}</div>
                  <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:800;background:${isAdmin ? '#fee2e2' : '#ede9fe'};color:${isAdmin ? '#dc2626' : '#6366f1'}">${isAdmin ? 'Admin' : 'Staff'}</span>
                  ${isAdmin ? '<span style="font-size:11px;color:#94a3b8;margin-left:8px">Admin มีสิทธิ์ทั้งหมดอัตโนมัติ</span>' : ''}
                </div>
                <div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">
                  ${!isAdmin ? `<button type="button" class="btn btn-ghost btn-sm" onclick="setAllPermissionsV36('${user.id}',true)">เลือกทั้งหมด</button>
                  <button type="button" class="btn btn-ghost btn-sm" onclick="setAllPermissionsV36('${user.id}',false)">ล้าง</button>` : ''}
                  <button type="button" class="btn btn-ghost btn-sm" onclick="v9EditUserPin?.('${jsString(user.id)}','${jsString(user.username || '')}')"><i class="material-icons-round">pin</i> แก้ PIN</button>
                  ${user.id !== USER?.id ? `<button type="button" class="btn btn-ghost btn-sm" style="color:#dc2626;border-color:#fecaca" onclick="deleteUser('${jsString(user.id)}','${jsString(user.username || '')}')"><i class="material-icons-round">delete</i></button>` : ''}
                </div>
              </div>
              ${isAdmin ? '' : `
                <div style="padding:14px 18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px">
                  ${PERMISSION_DEFS.map(def => {
                    const checked = effectivePermissionChecked(p, def);
                    const unsupported = missing.includes(def.key);
                    return `
                      <label style="display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;border:1.5px solid ${checked ? '#ef4444' : '#e2e8f0'};background:${unsupported ? '#f8fafc' : checked ? '#fff1f2' : '#fff'};cursor:${unsupported ? 'not-allowed' : 'pointer'};opacity:${unsupported ? '.62' : '1'}">
                        <input type="checkbox" id="v36perm-${user.id}-${def.key}" ${checked ? 'checked' : ''} ${unsupported ? 'disabled' : ''} onchange="saveUserPermissionsV36('${user.id}')" style="width:16px;height:16px;accent-color:#ef4444">
                        <i class="material-icons-round" style="font-size:18px;color:${checked ? '#ef4444' : '#64748b'}">${def.icon}</i>
                        <div style="min-width:0">
                          <div style="font-size:12px;font-weight:800;color:#1e293b">${htmlAttr(def.label)}</div>
                          <div style="font-size:10px;color:#94a3b8;margin-top:1px">${htmlAttr(def.desc)}</div>
                        </div>
                      </label>`;
                  }).join('')}
                </div>`}
            </div>`;
        }).join('')}
      </div>`;
  }

  function installPermissionUICompleteness() {
    installPermissionMapCompleteness();
    window.renderUserPerms = renderUserPermsV36;
    window.v36SavePermission = saveUserPermissionsV36;
    window.saveUserPermissionsV36 = saveUserPermissionsV36;
    window.setAllPermissionsV36 = setAllPermissionsV36;
    window.savePermission = saveUserPermissionsV36;
    window.v9SavePermission = saveUserPermissionsV36;
  }

  function enhanceProductImageInput() {
    const form = document.getElementById('product-form');
    const imgInput = document.getElementById('prod-img');
    if (!form || !imgInput || form.__v36imagepasteReady) return;
    form.__v36imagepasteReady = true;

    imgInput.type = 'text';
    imgInput.placeholder = 'วางรูปภาพ, วาง URL รูปภาพ หรือเลือกไฟล์';

    const tools = document.createElement('div');
    tools.id = 'v36-prod-img-tools';
    tools.innerHTML = `
      <div id="v36-prod-img-drop" style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:14px;padding:12px;background:#f8fafc;display:grid;grid-template-columns:82px 1fr;gap:12px;align-items:center;cursor:pointer">
        <div id="v36-prod-img-preview" style="width:82px;height:82px;border-radius:12px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${imgInput.value ? `<img src="${htmlAttr(imgInput.value)}" alt="product" style="width:100%;height:100%;object-fit:cover">` : '<i class="material-icons-round" style="font-size:34px;color:#94a3b8">image</i>'}
        </div>
        <div>
          <div style="font-weight:800;color:#0f172a;font-size:13px">วางรูปจากเว็บได้ทันที</div>
          <div id="v36-prod-img-meta" style="margin-top:4px;color:#64748b;font-size:12px;line-height:1.5">คัดลอกรูปภาพแล้วกด Ctrl+V หรือวาง URL รูปภาพ ระบบจะบีบอัดให้อัตโนมัติ</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" id="v36-prod-img-pick" class="btn btn-ghost btn-sm"><i class="material-icons-round">upload</i> เลือกรูป</button>
            <button type="button" id="v36-prod-img-clear" class="btn btn-ghost btn-sm"><i class="material-icons-round">delete</i> ล้างรูป</button>
          </div>
        </div>
      </div>
      <input id="v36-prod-img-file" type="file" accept="image/*" style="display:none">
    `;
    imgInput.insertAdjacentElement('afterend', tools);

    const drop = document.getElementById('v36-prod-img-drop');
    const file = document.getElementById('v36-prod-img-file');
    const pick = document.getElementById('v36-prod-img-pick');
    const clear = document.getElementById('v36-prod-img-clear');

    pick?.addEventListener('click', () => file?.click());
    clear?.addEventListener('click', () => setProductImagePreview('', 'ล้างรูปแล้ว'));
    file?.addEventListener('change', async () => {
      const blob = file.files?.[0];
      if (!blob) return;
      try { await handleProductImageBlob(blob); }
      catch (e) { notify('บีบอัดรูปไม่สำเร็จ: ' + (e.message || e), 'error'); }
    });

    imgInput.addEventListener('input', () => {
      const value = imgInput.value.trim();
      if (value && !value.startsWith('data:')) setProductImagePreview(value, 'ใช้ URL รูปภาพนี้ หรือกด Ctrl+V เพื่อบีบอัดเป็นไฟล์เล็ก');
      if (!value) setProductImagePreview('', 'วางรูปภาพหรือ URL รูปภาพได้ที่นี่');
    });

    form.addEventListener('paste', async (ev) => {
      const items = Array.from(ev.clipboardData?.items || []);
      const imageItem = items.find(item => item.type && item.type.startsWith('image/'));
      if (imageItem) {
        ev.preventDefault();
        try { await handleProductImageBlob(imageItem.getAsFile()); }
        catch (e) { notify('วางรูปไม่สำเร็จ: ' + (e.message || e), 'error'); }
        return;
      }

      const text = ev.clipboardData?.getData('text/plain')?.trim();
      const pasteTarget = ev.target;
      const isImageTarget = pasteTarget === imgInput || tools.contains(pasteTarget);
      if (isImageTarget && text && /^https?:\/\//i.test(text)) {
        ev.preventDefault();
        try {
          const meta = document.getElementById('v36-prod-img-meta');
          if (meta) meta.textContent = 'กำลังโหลดรูปจาก URL...';
          await handleProductImageBlob(await fetchImageFromUrl(text));
        } catch (e) {
          imgInput.value = text;
          setProductImagePreview(text, 'เว็บนี้ไม่อนุญาตให้ดึงรูปมาบีบอัด จึงใช้ URL แทน');
        }
      }
    });

    drop?.addEventListener('dragover', ev => {
      ev.preventDefault();
      drop.style.borderColor = '#2563eb';
      drop.style.background = '#eff6ff';
    });
    drop?.addEventListener('dragleave', () => {
      drop.style.borderColor = '#cbd5e1';
      drop.style.background = '#f8fafc';
    });
    drop?.addEventListener('drop', async ev => {
      ev.preventDefault();
      drop.style.borderColor = '#cbd5e1';
      drop.style.background = '#f8fafc';
      const blob = ev.dataTransfer?.files?.[0];
      const url = ev.dataTransfer?.getData('text/uri-list') || ev.dataTransfer?.getData('text/plain');
      try {
        if (blob) await handleProductImageBlob(blob);
        else if (url && /^https?:\/\//i.test(url.trim())) await handleProductImageBlob(await fetchImageFromUrl(url.trim()));
      } catch (e) {
        notify('เพิ่มรูปไม่สำเร็จ: ' + (e.message || e), 'error');
      }
    });
  }

  function setV9ProductImagePreview(dataUrl, metaText) {
    const hidden = document.getElementById('v9prod-img');
    const oldHidden = document.getElementById('v9prod-img-old');
    const wrap = document.getElementById('v9prod-img-preview-wrap');
    const img = document.getElementById('v9prod-img-preview');
    const meta = document.getElementById('v36-v9prod-img-meta');
    const file = document.getElementById('prod-img-upload');
    if (hidden) hidden.value = dataUrl || '';
    if (file) file.value = '';
    if (wrap) wrap.style.display = dataUrl ? 'block' : 'none';
    if (img) img.src = dataUrl || '';
    if (meta) {
      const oldText = oldHidden?.value ? ' มีรูปเดิมอยู่แล้ว' : '';
      meta.textContent = metaText || (dataUrl ? 'พร้อมบันทึกรูปภาพ' : 'วางรูปภาพจากเว็บ หรือเลือกไฟล์ ระบบจะบีบอัดให้อัตโนมัติ' + oldText);
    }
  }

  async function handleV9ProductImageBlob(blob) {
    const meta = document.getElementById('v36-v9prod-img-meta');
    if (meta) meta.textContent = 'กำลังบีบอัดรูปภาพ...';
    const out = await compressProductImage(blob);
    setV9ProductImagePreview(out.dataUrl, `บีบอัดแล้ว ${(out.size / 1024).toFixed(1)} KB`);
  }

  function enhanceV9ProductImageInput() {
    const form = document.getElementById('v9-product-form');
    const hidden = document.getElementById('v9prod-img');
    const file = document.getElementById('prod-img-upload');
    if (!form || !hidden || form.__v36v9imagepasteReady) return;
    form.__v36v9imagepasteReady = true;

    const previewWrap = document.getElementById('v9prod-img-preview-wrap');
    const imageBox = previewWrap?.parentElement || hidden.parentElement;
    if (!imageBox) return;

    const helper = document.createElement('div');
    helper.id = 'v36-v9prod-img-helper';
    helper.style.cssText = 'margin-top:10px;border:1px dashed #cbd5e1;border-radius:12px;padding:10px;background:#f8fafc;color:#475569;font-size:12px;line-height:1.5;text-align:left;';
    helper.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start">
        <i class="material-icons-round" style="font-size:20px;color:#2563eb;margin-top:1px">content_paste</i>
        <div style="flex:1">
          <div style="font-weight:800;color:#0f172a">วางรูปจากเว็บได้เลย</div>
          <div id="v36-v9prod-img-meta">คัดลอกรูปภาพแล้วกด Ctrl+V หรือวาง URL/ลากรูปมาที่ช่องนี้ ระบบจะบีบอัดให้อัตโนมัติ</div>
        </div>
      </div>
    `;
    imageBox.appendChild(helper);

    if (file && !file.__v36compressChange) {
      file.__v36compressChange = true;
      file.removeAttribute('onchange');
      file.addEventListener('change', async () => {
        const blob = file.files?.[0];
        if (!blob) return;
        try { await handleV9ProductImageBlob(blob); }
        catch (e) { notify('บีบอัดรูปไม่สำเร็จ: ' + (e.message || e), 'error'); }
      });
    }

    const handlePaste = async (ev) => {
      const items = Array.from(ev.clipboardData?.items || []);
      const imageItem = items.find(item => item.type && item.type.startsWith('image/'));
      if (imageItem) {
        ev.preventDefault();
        try { await handleV9ProductImageBlob(imageItem.getAsFile()); }
        catch (e) { notify('วางรูปไม่สำเร็จ: ' + (e.message || e), 'error'); }
        return;
      }

      const text = ev.clipboardData?.getData('text/plain')?.trim();
      const target = ev.target;
      const targetIsImageArea = helper.contains(target) || imageBox.contains(target);
      if (targetIsImageArea && text && /^https?:\/\//i.test(text)) {
        ev.preventDefault();
        try {
          const meta = document.getElementById('v36-v9prod-img-meta');
          if (meta) meta.textContent = 'กำลังโหลดรูปจาก URL...';
          await handleV9ProductImageBlob(await fetchImageFromUrl(text));
        } catch (e) {
          setV9ProductImagePreview(text, 'เว็บนี้ไม่อนุญาตให้ดึงรูปมาบีบอัด จึงใช้ URL แทน');
        }
      }
    };
    form.addEventListener('paste', handlePaste);

    const dropTarget = imageBox;
    dropTarget.addEventListener('dragover', ev => {
      ev.preventDefault();
      helper.style.borderColor = '#2563eb';
      helper.style.background = '#eff6ff';
    });
    dropTarget.addEventListener('dragleave', () => {
      helper.style.borderColor = '#cbd5e1';
      helper.style.background = '#f8fafc';
    });
    dropTarget.addEventListener('drop', async ev => {
      ev.preventDefault();
      helper.style.borderColor = '#cbd5e1';
      helper.style.background = '#f8fafc';
      const blob = ev.dataTransfer?.files?.[0];
      const url = ev.dataTransfer?.getData('text/uri-list') || ev.dataTransfer?.getData('text/plain');
      try {
        if (blob) await handleV9ProductImageBlob(blob);
        else if (url && /^https?:\/\//i.test(url.trim())) await handleV9ProductImageBlob(await fetchImageFromUrl(url.trim()));
      } catch (e) {
        notify('เพิ่มรูปไม่สำเร็จ: ' + (e.message || e), 'error');
      }
    });
  }

  async function settleDeliveryStockOnce(billId, items) {
    const deliverItems = (items || []).filter(i => money(i.deliver_qty) > 0 && i.product_id);
    for (const it of deliverItems) {
      const existed = await queryOne('stock_movement', 'id', [
        ['ref_id', billId],
        ['product_id', it.product_id],
        ['type', txt.deliveryMove],
      ]);
      if (existed) continue;

      const prod = await queryOne(txt.product, 'id,name,stock,unit', [['id', it.product_id]]);
      if (!prod) throw new Error('ไม่พบสินค้า: ' + (it.name || it.product_id));

      let deducted = money(it.deliver_qty);
      if (typeof _v20FetchConv === 'function' && typeof _v20BaseQty === 'function') {
        const conv = await _v20FetchConv([it.product_id]);
        deducted = _v20BaseQty(deducted, it.unit || prod.unit || 'ชิ้น', it.product_id, conv.um || {}, conv.bm || {});
      }

      const before = money(prod.stock);
      if (before < deducted) {
        throw new Error(`สต็อกไม่พอสำหรับจัดส่ง: ${it.name || prod.name} มี ${fmt(before)} ต้องใช้ ${fmt(deducted)}`);
      }
      const after = Number((before - deducted).toFixed(6));
      await must(db.from(txt.product).update({ stock: after, updated_at: new Date().toISOString() }).eq('id', it.product_id), 'ตัดสต็อกจัดส่ง');
      await must(db.from('stock_movement').insert({
        product_id: it.product_id,
        product_name: it.name || prod.name,
        type: txt.deliveryMove,
        direction: 'out',
        qty: deducted,
        stock_before: before,
        stock_after: after,
        ref_id: billId,
        ref_table: txt.bill,
        staff_name: userName(),
      }), 'บันทึกประวัติสต็อกจัดส่ง');
    }
  }

  async function fetchBillAndItems(billId) {
    const [billRes, itemRes] = await Promise.all([
      db.from(txt.bill).select('*').eq('id', billId).maybeSingle(),
      db.from(txt.billItem).select('*').eq('bill_id', billId),
    ]);
    if (billRes.error) throw billRes.error;
    if (itemRes.error) throw itemRes.error;
    return { bill: billRes.data, items: itemRes.data || [] };
  }

  function effectiveTotal(bill) {
    let info = bill?.return_info || {};
    if (typeof info === 'string') {
      try { info = JSON.parse(info); } catch (_) { info = {}; }
    }
    return money(info.new_total ?? bill?.total);
  }

  function effectivePaidForDelivery(bill, total) {
    const deposit = money(bill?.deposit_amount);
    if (deposit > 0) return Math.min(deposit, total);

    const received = money(bill?.received);
    const change = money(bill?.change);
    const netReceived = Math.max(0, received - change);
    if (netReceived >= total) return total;

    const method = String(bill?.method || '');
    const status = String(bill?.status || '');
    const isDebt = method === txt.debt || status === txt.debt;
    if (!isDebt && status !== txt.debt && (status === txt.success || status === txt.pendingDelivery)) {
      return total;
    }

    return Math.min(netReceived, total);
  }

  function installDeliverySafety() {
    window.v12DQMarkDone = async function (billId) {
      if (window.__deliveryDoneLocks?.[billId]) return;
      window.__deliveryDoneLocks = window.__deliveryDoneLocks || {};
      window.__deliveryDoneLocks[billId] = true;
      try {
        const { bill, items } = await fetchBillAndItems(billId);
        if (!bill) return toast?.('ไม่พบบิล', 'error');
        if (bill.delivery_status === txt.delivered) {
          return toast?.('บิลนี้จัดส่งสำเร็จไปแล้ว', 'info');
        }

        const total = effectiveTotal(bill);
        const paid = effectivePaidForDelivery(bill, total);
        const remaining = Math.max(0, total - paid);
        let action = remaining > 0 ? 'pay' : 'done';

        if (typeof Swal !== 'undefined') {
          const result = await Swal.fire({
            icon: 'question',
            title: 'ยืนยันจัดส่งสำเร็จ?',
            html: remaining > 0
              ? `<div style="text-align:left;line-height:1.8">
                  <div>ยอดบิล: <b>฿${fmt(total)}</b></div>
                  <div>มัดจำแล้ว: <b style="color:#16a34a">฿${fmt(paid)}</b></div>
                  <div>ยอดคงเหลือ: <b style="color:#dc2626">฿${fmt(remaining)}</b></div>
                </div>`
              : 'ระบบจะตัดสต็อกเฉพาะรายการที่ยังไม่เคยตัด และปิดสถานะจัดส่งให้',
            showCancelButton: true,
            showDenyButton: remaining > 0,
            confirmButtonText: remaining > 0 ? 'รับชำระตอนนี้' : 'ยืนยัน',
            denyButtonText: 'บันทึกเป็นหนี้',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#10b981',
            denyButtonColor: '#f59e0b',
          });
          if (result.isDismissed) return;
          action = result.isDenied ? 'debt' : (remaining > 0 ? 'pay' : 'done');
        } else if (!confirm('ยืนยันจัดส่งสำเร็จ?')) {
          return;
        }

        await settleDeliveryStockOnce(billId, items);
        await must(db.from(txt.bill).update({
          delivery_status: txt.delivered,
          status: remaining > 0 ? txt.debt : txt.success,
        }).eq('id', billId), 'อัปเดตสถานะจัดส่ง');

        if (remaining > 0 && action === 'debt' && bill.customer_id) {
          const { data: cust } = await db.from('customer').select('debt_amount').eq('id', bill.customer_id).maybeSingle();
          await must(db.from('customer').update({
            debt_amount: money(cust?.debt_amount) + remaining,
          }).eq('id', bill.customer_id), 'บันทึกหนี้ลูกค้า');
        }

        if (typeof logActivity === 'function') {
          await Promise.resolve(logActivity(txt.delivered, `บิล #${bill.bill_no || billId}${remaining > 0 ? ' ยอดคงเหลือ ฿' + fmt(remaining) : ''}`, billId, txt.bill));
        }
        if (typeof loadProducts === 'function') await loadProducts();
        if (typeof renderDelivery === 'function') await renderDelivery();
        if (typeof updateHomeStats === 'function') updateHomeStats();

        if (remaining > 0 && action === 'pay' && typeof v20BMCPayDebt === 'function') {
          await v20BMCPayDebt(billId);
        } else {
          toast?.(action === 'debt' ? 'จัดส่งสำเร็จ และบันทึกยอดคงเหลือเป็นหนี้แล้ว' : 'จัดส่งสำเร็จ', 'success');
        }
      } catch (e) {
        console.error('[v36] delivery failed:', e);
        toast?.('จัดส่งไม่สำเร็จ: ' + (e.message || e), 'error');
      } finally {
        delete window.__deliveryDoneLocks[billId];
      }
    };
    window.v12DQMarkDone.__v36safe = true;
  }

  function installAdminSafety() {
    const originalDeleteCat = window.deleteCat;
    if (typeof originalDeleteCat === 'function' && !originalDeleteCat.__v36safe) {
      window.deleteCat = async function (id) {
        const { data: cat } = await db.from('categories').select('name').eq('id', id).maybeSingle();
        if (cat?.name) {
          const used = await queryOne(txt.product, 'id', [['category', cat.name]]);
          if (used) {
            return Swal.fire({
              icon: 'warning',
              title: 'ลบหมวดหมู่ไม่ได้',
              text: 'ยังมีสินค้าอยู่ในหมวดหมู่นี้ กรุณาย้ายสินค้าออกก่อน',
              confirmButtonText: 'ตกลง',
            });
          }
        }
        if (typeof Swal !== 'undefined') {
          const confirmed = await Swal.fire({
            icon: 'warning',
            title: 'ยืนยันลบหมวดหมู่?',
            text: cat?.name || '',
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc2626',
          });
          if (!confirmed.isConfirmed) return;
        }
        return await originalDeleteCat.apply(this, arguments);
      };
      window.deleteCat.__v36safe = true;
    }

    const originalDeleteUser = window.deleteUser;
    if (typeof originalDeleteUser === 'function' && !originalDeleteUser.__v36safe) {
      window.deleteUser = async function (id, name) {
        let currentUserId = null;
        try { currentUserId = USER?.id || null; } catch (_) {}
        if (String(id) === String(currentUserId)) {
          return toast?.('ไม่สามารถลบผู้ใช้ที่กำลังล็อกอินอยู่', 'warning');
        }
        try {
          const { data: target } = await db.from('ผู้ใช้งาน').select('role').eq('id', id).maybeSingle();
          if (target?.role === 'admin') {
            const { data: admins } = await db.from('ผู้ใช้งาน').select('id').eq('role', 'admin');
            if ((admins || []).length <= 1) {
              return toast?.('ต้องเหลือผู้ดูแลระบบอย่างน้อย 1 คน', 'warning');
            }
          }
        } catch (e) {
          console.warn('[v36] deleteUser admin check:', e);
        }
        return await originalDeleteUser.apply(this, arguments);
      };
      window.deleteUser.__v36safe = true;
    }
  }

  function installProductDeleteWithStockHistoryCleanup() {
    if (window.deleteProduct?.__v36stockCleanup) return;
    window.deleteProduct = async function (productId) {
      const product = (typeof products !== 'undefined' ? products : []).find(p => String(p.id) === String(productId));
      const usedInBill = await queryOne(txt.billItem, 'id', [['product_id', productId]]);
      if (usedInBill) {
        return Swal.fire({
          icon: 'warning',
          title: 'ลบสินค้าไม่ได้',
          text: 'สินค้านี้เคยอยู่ในบิลขายแล้ว เพื่อไม่ให้ประวัติบิลเสียหายให้ปรับสต็อกเป็น 0 หรือเปลี่ยนชื่อว่าเลิกขายแทน',
          confirmButtonText: 'ตกลง',
        });
      }

      const confirmed = await Swal.fire({
        icon: 'warning',
        title: `ลบ "${product?.name || 'สินค้า'}"?`,
        text: 'ระบบจะลบประวัติการปรับสต็อกของสินค้านี้ก่อน แล้วลบสินค้าออกจากคลัง',
        showCancelButton: true,
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626',
      });
      if (!confirmed.isConfirmed) return;

      try {
        await must(db.from('stock_movement').delete().eq('product_id', productId), 'ลบประวัติสต็อก');
        await must(db.from(txt.product).delete().eq('id', productId), 'ลบสินค้า');
        toast?.('ลบสินค้าสำเร็จ', 'success');
        if (typeof loadProducts === 'function') await loadProducts();
        if (typeof renderInventory === 'function') renderInventory();
      } catch (e) {
        console.error('[v36] delete product with stock cleanup:', e);
        Swal.fire({
          icon: 'error',
          title: 'ลบสินค้าไม่สำเร็จ',
          text: e.message || String(e),
          confirmButtonText: 'ตกลง',
        });
      }
    };
    window.deleteProduct.__v36safe = true;
    window.deleteProduct.__v36stockCleanup = true;
  }

  function adminStatCardV36(icon, label, value, color) {
    return `
      <div class="v36-admin-stat">
        <div class="v36-admin-stat-icon" style="background:${color}18;color:${color}"><i class="material-icons-round">${icon}</i></div>
        <div>
          <div class="v36-admin-stat-value">${htmlAttr(value)}</div>
          <div class="v36-admin-stat-label">${htmlAttr(label)}</div>
        </div>
      </div>`;
  }

  function installAdminRedesign() {
    if (window.renderAdmin?.__v36redesign) return;
    window.renderAdmin = async function () {
      const page = document.getElementById('page-admin');
      if (!page) return;
      if (USER?.role !== 'admin') {
        page.innerHTML = `<div style="text-align:center;padding:80px;"><i class="material-icons-round" style="font-size:64px;color:var(--danger)">block</i><p style="font-size:18px;margin-top:16px;">เข้าถึงได้เฉพาะผู้ดูแลระบบ</p></div>`;
        return;
      }

      let users = [], cats = [], shopConf = null;
      try {
        const [ur, cr, sr] = await Promise.all([
          db.from('ผู้ใช้งาน').select('*').order('username'),
          db.from('categories').select('*').order('name'),
          db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle(),
        ]);
        if (ur.error) throw ur.error;
        if (cr.error) throw cr.error;
        if (sr.error) throw sr.error;
        users = ur.data || [];
        cats = cr.data || [];
        shopConf = sr.data || null;
      } catch (e) {
        page.innerHTML = `<div style="padding:24px;color:#dc2626">โหลดหน้าผู้ดูแลไม่สำเร็จ: ${htmlAttr(e.message || e)}</div>`;
        return;
      }

      const admins = users.filter(u => u.role === 'admin').length;
      const staff = users.length - admins;
      page.innerHTML = `
        <style>
          .v36-admin{max-width:1280px;margin:0 auto 30px;display:flex;flex-direction:column;gap:18px}
          .v36-admin-hero{background:#111827;color:#fff;border-radius:18px;padding:22px;display:grid;grid-template-columns:1.2fr .8fr;gap:18px;box-shadow:0 18px 40px rgba(15,23,42,.16)}
          .v36-admin-title{font-size:24px;font-weight:900;margin:0 0 6px}
          .v36-admin-sub{color:#cbd5e1;font-size:13px;line-height:1.6}
          .v36-admin-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
          .v36-admin-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:13px;display:flex;align-items:center;gap:12px}
          .v36-admin-hero .v36-admin-stat{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14)}
          .v36-admin-stat-icon{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
          .v36-admin-stat-value{font-size:20px;font-weight:900;color:inherit;line-height:1}
          .v36-admin-stat-label{font-size:11px;color:#94a3b8;margin-top:4px;font-weight:700}
          .v36-admin-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.85fr);gap:18px;align-items:start}
          .v36-admin-panel{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.05)}
          .v36-admin-panel-h{padding:16px 18px;border-bottom:1px solid #eef2f7;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f8fafc}
          .v36-admin-panel-title{display:flex;align-items:center;gap:9px;font-weight:900;color:#111827}
          .v36-admin-panel-b{padding:18px}
          .v36-admin-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .v36-admin-cats{display:flex;flex-wrap:wrap;gap:8px}
          .v36-admin-cat{display:inline-flex;align-items:center;gap:7px;border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:7px 10px;font-size:13px;font-weight:700;color:#334155}
          .v36-admin-cat-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
          .v36-admin-cat button{border:none;background:transparent;color:#94a3b8;cursor:pointer;padding:0;line-height:1;display:flex}
          @media(max-width:900px){.v36-admin-hero,.v36-admin-grid{grid-template-columns:1fr}.v36-admin-stats,.v36-admin-form-grid{grid-template-columns:1fr}}
        </style>
        <div class="v36-admin">
          <div class="v36-admin-hero">
            <div>
              <div class="v36-admin-title">ผู้ดูแลระบบ</div>
              <div class="v36-admin-sub">จัดการข้อมูลร้าน ผู้ใช้งาน สิทธิ์การเข้าถึง และหมวดหมู่สินค้าในหน้าเดียว</div>
            </div>
            <div class="v36-admin-stats">
              ${adminStatCardV36('groups', 'บัญชีทั้งหมด', users.length, '#38bdf8')}
              ${adminStatCardV36('admin_panel_settings', 'ผู้ดูแล', admins, '#f87171')}
              ${adminStatCardV36('badge', 'พนักงาน', staff, '#34d399')}
            </div>
          </div>

          <div class="v36-admin-grid">
            <div class="v36-admin-panel">
              <div class="v36-admin-panel-h">
                <div class="v36-admin-panel-title"><i class="material-icons-round">store</i> ตั้งค่าร้านค้า</div>
                <button class="btn btn-primary" form="shop-form"><i class="material-icons-round">save</i> บันทึก</button>
              </div>
              <div class="v36-admin-panel-b">
                <form id="shop-form">
                  <div class="v36-admin-form-grid">
                    <div class="form-group"><label class="form-label">ชื่อร้าน (ไทย)</label><input type="text" class="form-input" id="shop-name" value="${htmlAttr(shopConf?.shop_name || SHOP_CONFIG.name)}"></div>
                    <div class="form-group"><label class="form-label">ชื่อร้าน (อังกฤษ)</label><input type="text" class="form-input" id="shop-name-en" value="${htmlAttr(shopConf?.shop_name_en || SHOP_CONFIG.nameEn)}"></div>
                    <div class="form-group"><label class="form-label">เบอร์โทร</label><input type="text" class="form-input" id="shop-phone" value="${htmlAttr(shopConf?.phone || SHOP_CONFIG.phone)}"></div>
                    <div class="form-group"><label class="form-label">เลขผู้เสียภาษี</label><input type="text" class="form-input" id="shop-tax" value="${htmlAttr(shopConf?.tax_id || SHOP_CONFIG.taxId)}"></div>
                  </div>
                  <div class="form-group"><label class="form-label">ที่อยู่</label><textarea class="form-input" id="shop-addr" rows="3">${htmlAttr(shopConf?.address || SHOP_CONFIG.address)}</textarea></div>
                  <div class="v36-admin-form-grid">
                    <div class="form-group"><label class="form-label">PromptPay</label><input type="text" class="form-input" id="shop-promptpay" value="${htmlAttr(shopConf?.promptpay_number || '')}"></div>
                    <div class="form-group"><label class="form-label">Footer ใบเสร็จ</label><input type="text" class="form-input" id="shop-footer" value="${htmlAttr(shopConf?.receipt_footer || SHOP_CONFIG.note)}"></div>
                  </div>
                </form>
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:18px">
              <div class="v36-admin-panel">
                <div class="v36-admin-panel-h">
                  <div class="v36-admin-panel-title"><i class="material-icons-round">category</i> หมวดหมู่สินค้า</div>
                </div>
                <div class="v36-admin-panel-b">
                  <div class="v36-admin-cats" style="margin-bottom:14px">
                    ${(cats || []).map(c => `<span class="v36-admin-cat"><span class="v36-admin-cat-dot" style="background:${htmlAttr(c.color || '#64748b')}"></span>${htmlAttr(c.name || '')}<button onclick="deleteCat('${jsString(c.id)}')" title="ลบ"><i class="material-icons-round" style="font-size:16px">close</i></button></span>`).join('') || '<span style="color:#94a3b8;font-size:13px">ยังไม่มีหมวดหมู่</span>'}
                  </div>
                  <form id="cat-form" style="display:grid;grid-template-columns:1fr 52px auto;gap:8px;align-items:center">
                    <input type="text" class="form-input" id="cat-name" placeholder="ชื่อหมวดหมู่">
                    <input type="color" class="form-input" id="cat-color" value="#DC2626" style="height:42px;padding:4px">
                    <button type="submit" class="btn btn-primary"><i class="material-icons-round">add</i> เพิ่ม</button>
                  </form>
                </div>
              </div>
            </div>
          </div>

          <div class="v36-admin-panel">
            <div class="v36-admin-panel-h">
              <div class="v36-admin-panel-title"><i class="material-icons-round">manage_accounts</i> ผู้ใช้งานและสิทธิ์</div>
              <button class="btn btn-primary" onclick="showAddUserModal?.()"><i class="material-icons-round">person_add</i> เพิ่มผู้ใช้</button>
            </div>
            <div class="v36-admin-panel-b" id="v36-admin-permissions"></div>
          </div>
        </div>`;

      document.getElementById('shop-form').onsubmit = async (e) => {
        e.preventDefault();
        const d = {
          shop_name: document.getElementById('shop-name').value,
          shop_name_en: document.getElementById('shop-name-en').value,
          address: document.getElementById('shop-addr').value,
          phone: document.getElementById('shop-phone').value,
          tax_id: document.getElementById('shop-tax').value,
          promptpay_number: document.getElementById('shop-promptpay').value,
          receipt_footer: document.getElementById('shop-footer').value,
          updated_by: USER?.username,
          updated_at: new Date().toISOString(),
        };
        if (shopConf) await must(db.from('ตั้งค่าร้านค้า').update(d).eq('id', shopConf.id), 'บันทึกตั้งค่าร้าน');
        else await must(db.from('ตั้งค่าร้านค้า').insert(d), 'บันทึกตั้งค่าร้าน');
        toast?.('บันทึกตั้งค่าร้านสำเร็จ', 'success');
      };

      document.getElementById('cat-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('cat-name').value.trim();
        const color = document.getElementById('cat-color').value;
        if (!name) return;
        await must(db.from('categories').insert({ name, color }), 'เพิ่มหมวดหมู่');
        toast?.('เพิ่มหมวดหมู่สำเร็จ', 'success');
        if (typeof loadCategories === 'function') await loadCategories();
        window.renderAdmin();
      };

      renderUserPermsV36(document.getElementById('v36-admin-permissions'));
    };
    window.renderAdmin.__v36redesign = true;
  }

  function adminMenuCardV36(icon, title, desc, section, color) {
    return `
      <button type="button" class="v36-admin-menu-card" onclick="v36AdminOpenSection('${section}')">
        <span class="v36-admin-menu-icon" style="background:${color}18;color:${color}"><i class="material-icons-round">${icon}</i></span>
        <span class="v36-admin-menu-text">
          <span class="v36-admin-menu-title">${htmlAttr(title)}</span>
          <span class="v36-admin-menu-desc">${htmlAttr(desc)}</span>
        </span>
        <i class="material-icons-round v36-admin-menu-arrow">chevron_right</i>
      </button>`;
  }

  function adminMenuStylesV36() {
    return `
      <style>
        .v36-admin{max-width:1180px;margin:0 auto 30px;display:flex;flex-direction:column;gap:18px}
        .v36-admin-hero{background:#111827;color:#fff;border-radius:18px;padding:22px;display:grid;grid-template-columns:1.2fr .8fr;gap:18px;box-shadow:0 18px 40px rgba(15,23,42,.16)}
        .v36-admin-title{font-size:24px;font-weight:900;margin:0 0 6px}
        .v36-admin-sub{color:#cbd5e1;font-size:13px;line-height:1.6}
        .v36-admin-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .v36-admin-stat{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:13px;display:flex;align-items:center;gap:12px}
        .v36-admin-stat-icon{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .v36-admin-stat-value{font-size:20px;font-weight:900;color:inherit;line-height:1}
        .v36-admin-stat-label{font-size:11px;color:#94a3b8;margin-top:4px;font-weight:700}
        .v36-admin-menu-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .v36-admin-menu-card{width:100%;text-align:left;border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:18px;display:flex;align-items:center;gap:14px;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.05);transition:transform .15s,box-shadow .15s,border-color .15s}
        .v36-admin-menu-card:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(15,23,42,.09);border-color:#cbd5e1}
        .v36-admin-menu-icon{width:52px;height:52px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .v36-admin-menu-icon i{font-size:26px}
        .v36-admin-menu-text{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
        .v36-admin-menu-title{font-size:16px;font-weight:900;color:#111827}
        .v36-admin-menu-desc{font-size:12px;color:#64748b;line-height:1.5}
        .v36-admin-menu-arrow{color:#94a3b8}
        .v36-admin-panel{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.05)}
        .v36-admin-panel-h{padding:16px 18px;border-bottom:1px solid #eef2f7;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f8fafc}
        .v36-admin-panel-title{display:flex;align-items:center;gap:9px;font-weight:900;color:#111827}
        .v36-admin-panel-b{padding:18px}
        .v36-admin-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .v36-admin-cats{display:flex;flex-wrap:wrap;gap:8px}
        .v36-admin-cat{display:inline-flex;align-items:center;gap:7px;border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:7px 10px;font-size:13px;font-weight:700;color:#334155}
        .v36-admin-cat-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
        .v36-admin-cat button{border:none;background:transparent;color:#94a3b8;cursor:pointer;padding:0;line-height:1;display:flex}
        @media(max-width:900px){.v36-admin-hero,.v36-admin-menu-grid,.v36-admin-stats,.v36-admin-form-grid{grid-template-columns:1fr}}
      </style>`;
  }

  function getCustomerAdSettingsV36() {
    try {
      return JSON.parse(localStorage.getItem('sk_customer_display_ads') || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function customerAdDbV36() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('sk_pos_customer_ads', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('images', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveCustomerAdImageV36(fileOrBlob, name) {
    const url = await uploadAdImageBlobV36(fileOrBlob, name);
    return { src: url, name: name || fileOrBlob.name || 'ad' };
  }

  async function saveCustomerAdImageLocalV36(fileOrBlob, name) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(fileOrBlob);
    });
    const dbi = await customerAdDbV36();
    const row = {
      id: 'ad_' + Date.now() + '_' + Math.random().toString(16).slice(2),
      name: name || fileOrBlob.name || 'image',
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    await new Promise((resolve, reject) => {
      const tx = dbi.transaction('images', 'readwrite');
      tx.objectStore('images').put(row);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    dbi.close();
    return { id: row.id, name: row.name };
  }

  async function getCustomerAdImageSrcV36(id) {
    const dbi = await customerAdDbV36();
    const row = await new Promise((resolve, reject) => {
      const tx = dbi.transaction('images', 'readonly');
      const req = tx.objectStore('images').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    dbi.close();
    return row?.dataUrl || '';
  }

  function adNotifyV36(message, type) {
    if (typeof notify === 'function') notify(message, type);
    else if (typeof toast === 'function') toast(message, type);
    else console.log(message);
  }

  function dedupeAdImagesV36(items) {
    const seen = new Set();
    return (items || []).filter(item => {
      const key = String(item?.id || item?.src || item || '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderCustomerAdSettingsV36(body) {
    const settings = {
      enabled: true,
      interval: 8,
      title: 'โปรโมชั่นวันนี้',
      subtitle: 'ขอบคุณที่ใช้บริการ',
      images: [],
      ...getCustomerAdSettingsV36(),
    };
    let storedImages = dedupeAdImagesV36((settings.images || []).filter(x => x?.id || (x?.src && x?.name)));
    body.innerHTML = `
      <form id="v36-customer-ad-form">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <label style="display:flex;align-items:center;gap:10px;border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#fff;font-weight:800;color:#111827">
            <input type="checkbox" id="v36-ad-enabled" ${settings.enabled ? 'checked' : ''}>
            เปิดแสดงโฆษณาบนหน้าจอลูกค้า
          </label>
          <div class="form-group" style="margin:0">
            <label class="form-label">เปลี่ยนรูปทุกกี่วินาที</label>
            <input type="number" class="form-input" id="v36-ad-interval" min="3" max="60" value="${htmlAttr(settings.interval || 8)}">
          </div>
        </div>
        <div class="v36-admin-form-grid">
          <div class="form-group"><label class="form-label">หัวข้อ</label><input type="text" class="form-input" id="v36-ad-title" value="${htmlAttr(settings.title || '')}"></div>
          <div class="form-group"><label class="form-label">ข้อความรอง</label><input type="text" class="form-input" id="v36-ad-subtitle" value="${htmlAttr(settings.subtitle || '')}"></div>
        </div>
        <div style="border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:13px;line-height:1.55">
          <b>ขนาดรูปโฆษณาที่แนะนำ: 1920 x 640 px</b>
          <div>สัดส่วน 3:1 ระบบจะ crop/resize เป็น 1920 x 640 px และบีบอัดเป็น WebP ประมาณไม่เกิน 360 KB ก่อนอัปโหลด</div>
        </div>
        <div class="form-group">
          <label class="form-label">ลิงก์รูปโฆษณา (ใส่ได้หลายรูป แยกบรรทัด)</label>
          <textarea class="form-input" id="v36-ad-images" rows="4" placeholder="https://...">${htmlAttr((settings.images || []).map(x => (x && !x.name && !x.id) ? x.src : (typeof x === 'string' ? x : '')).filter(Boolean).join('\n'))}</textarea>
        </div>
        <div id="v36-ad-paste" tabindex="0" style="border:2px dashed #cbd5e1;border-radius:14px;background:#f8fafc;padding:18px;text-align:center;color:#475569;font-weight:800;margin-bottom:12px;outline:none">
          ก๊อปวางรูปที่นี่ หรือกดเลือกรูปจากเครื่อง
          <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-top:4px">รองรับ Ctrl+V / คลิกแล้ววาง / ไฟล์รูปจากเครื่อง</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
          <input type="file" id="v36-ad-file" accept="image/*" style="display:none">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('v36-ad-file').click()"><i class="material-icons-round">add_photo_alternate</i> เลือกรูปจากไฟล์</button>
          <span style="font-size:12px;color:#64748b">รูปจากไฟล์/ก๊อปวางจะอัปโหลดไป Supabase Storage แล้วเก็บเป็นลิงก์ ใช้กับเครื่องอื่นได้</span>
        </div>
        <div id="v36-ad-preview" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px"></div>
        <button type="submit" class="btn btn-primary"><i class="material-icons-round">save</i> บันทึกโฆษณาหน้าจอลูกค้า</button>
      </form>`;

    const imagesEl = document.getElementById('v36-ad-images');
    const renderPreview = async () => {
      const urls = Array.from(new Set(String(imagesEl.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)));
      const stored = await Promise.all(storedImages.map(async (item, i) => ({
        ...item,
        src: item.src || await getCustomerAdImageSrcV36(item.id),
        index: i,
      })));
      const previewItems = dedupeAdImagesV36([
        ...urls.map(src => ({ src, label: 'ลิงก์รูป' })),
        ...stored.map(x => ({ ...x, label: x.name || 'รูปจากเครื่อง' })),
      ].filter(x => x.src));
      document.getElementById('v36-ad-preview').innerHTML = previewItems.map(item => `
        <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#f8fafc">
          <div style="aspect-ratio:16/9"><img src="${htmlAttr(item.src)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.parentElement.style.display='none'"></div>
          <div style="padding:7px 9px;font-size:11px;color:#64748b;display:flex;justify-content:space-between;gap:6px;align-items:center">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${htmlAttr(item.label)}</span>
            ${item.id || item.src ? `<button type="button" data-ad-key="${htmlAttr(item.id || item.src)}" style="border:none;background:#fee2e2;color:#b91c1c;border-radius:999px;padding:3px 7px;cursor:pointer;font-size:11px">ลบ</button>` : ''}
          </div>
        </div>`).join('');
      document.querySelectorAll('[data-ad-key]').forEach(btn => {
        btn.onclick = () => {
          storedImages = storedImages.filter(x => (x.id || x.src) !== btn.dataset.adKey);
          renderPreview();
        };
      });
    };
    imagesEl.addEventListener('input', renderPreview);
    const addImageFile = async (file) => {
      if (!file || !file.type?.startsWith('image/')) return;
      try {
        adNotifyV36('กำลังอัปโหลดรูปไป Supabase...', 'info');
        const saved = await saveCustomerAdImageV36(file, file.name);
        storedImages = dedupeAdImagesV36([...storedImages, saved]);
        await renderPreview();
        adNotifyV36('อัปโหลดรูปโฆษณาแล้ว ใช้กับเครื่องอื่นได้', 'success');
      } catch (e) {
        console.error('[v36] save ad image:', e);
        try {
          const savedLocal = await saveCustomerAdImageLocalV36(file, file.name);
          storedImages = dedupeAdImagesV36([...storedImages, savedLocal]);
          await renderPreview();
          adNotifyV36('อัปโหลด Supabase ไม่สำเร็จ จึงเก็บรูปไว้ในเครื่องนี้ชั่วคราว', 'warning');
        } catch (_) {
          adNotifyV36('บันทึกรูปไม่สำเร็จ: ' + (e.message || e), 'error');
        }
      }
    };
    document.getElementById('v36-ad-file').addEventListener('change', async (ev) => {
      const file = ev.target.files?.[0];
      await addImageFile(file);
      ev.target.value = '';
    });
    document.getElementById('v36-ad-paste').addEventListener('paste', async (ev) => {
      const files = Array.from(ev.clipboardData?.items || [])
        .filter(item => item.type?.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean);
      if (files.length) {
        ev.preventDefault();
        for (const file of files) await addImageFile(file);
        return;
      }
      const text = ev.clipboardData?.getData('text')?.trim();
      if (text && /^https?:\/\//i.test(text)) {
        ev.preventDefault();
        imagesEl.value = [imagesEl.value.trim(), text].filter(Boolean).join('\n');
        renderPreview();
      }
    });
    document.getElementById('v36-customer-ad-form').onsubmit = async (ev) => {
      ev.preventDefault();
      const urlImages = String(imagesEl.value || '').split(/\r?\n/)
        .map(src => ({ src: src.trim() }))
        .filter(x => x.src);
      const images = dedupeAdImagesV36([...urlImages, ...storedImages]);
      const data = {
        enabled: document.getElementById('v36-ad-enabled').checked,
        interval: Math.max(3, Number(document.getElementById('v36-ad-interval').value || 8)),
        title: document.getElementById('v36-ad-title').value.trim(),
        subtitle: document.getElementById('v36-ad-subtitle').value.trim(),
        images,
        updatedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem('sk_customer_display_ads', JSON.stringify(data));
        adNotifyV36('กำลังบันทึกตั้งค่าโฆษณาไป Supabase...', 'info');
        const remoteUrl = await saveCustomerAdSettingsRemoteV36(data);
        localStorage.setItem('sk_customer_display_ads_url', remoteUrl);
        adNotifyV36('บันทึกโฆษณาหน้าจอลูกค้าแล้ว เครื่องอื่นใช้ได้ผ่าน Supabase', 'success');
      } catch (e) {
        console.error('[v36] save ad settings:', e);
        adNotifyV36('บันทึกในเครื่องแล้ว แต่ส่งขึ้น Supabase ไม่สำเร็จ: ' + (e.message || e), 'warning');
      }
    };
    renderPreview();
  }

  function installAdminMenuOnlyRedesign() {
    if (window.renderAdmin?.__v36menuOnly) return;

    window.v36AdminOpenSection = async function (section) {
      const page = document.getElementById('page-admin');
      if (!page) return;
      const titles = {
        shop: ['store', 'ตั้งค่าร้านค้า'],
        docs: ['receipt_long', 'ตั้งค่าใบเสร็จ / เอกสาร'],
        users: ['manage_accounts', 'ผู้ใช้งานและสิทธิ์'],
        cats: ['category', 'หมวดหมู่สินค้า'],
      };
      const [icon, title] = section === 'ads'
        ? ['desktop_windows', 'โฆษณาหน้าจอลูกค้า 1920 x 640 px']
        : (titles[section] || titles.shop);
      page.innerHTML = `
        ${adminMenuStylesV36()}
        <div class="v36-admin">
          <div class="v36-admin-panel">
            <div class="v36-admin-panel-h">
              <div class="v36-admin-panel-title"><i class="material-icons-round">${icon}</i> ${title}</div>
              <button class="btn btn-ghost" onclick="renderAdmin()"><i class="material-icons-round">arrow_back</i> กลับเมนูหลัก</button>
            </div>
            <div class="v36-admin-panel-b" id="v36-admin-section-body"></div>
          </div>
        </div>`;
      const body = document.getElementById('v36-admin-section-body');

      if (section === 'docs') {
        if (typeof v10RenderDocSettingsInto === 'function') {
          body.innerHTML = '<div id="v9-admin-content"></div>';
          await v10RenderDocSettingsInto(document.getElementById('v9-admin-content'));
        } else {
          body.innerHTML = '<div style="padding:20px;color:#dc2626">ไม่พบโมดูลตั้งค่าใบเสร็จ</div>';
        }
        return;
      }

      if (section === 'users') {
        await renderUserPermsV36(body);
        return;
      }

      if (section === 'ads') {
        renderCustomerAdSettingsV36(body);
        return;
      }

      if (section === 'shop') {
        const { data: shopConf, error } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle();
        if (error) { body.innerHTML = `<div style="color:#dc2626">โหลดข้อมูลร้านไม่สำเร็จ: ${htmlAttr(error.message)}</div>`; return; }
        body.innerHTML = `
          <form id="shop-form">
            <div class="v36-admin-form-grid">
              <div class="form-group"><label class="form-label">ชื่อร้าน (ไทย)</label><input type="text" class="form-input" id="shop-name" value="${htmlAttr(shopConf?.shop_name || SHOP_CONFIG.name)}"></div>
              <div class="form-group"><label class="form-label">ชื่อร้าน (อังกฤษ)</label><input type="text" class="form-input" id="shop-name-en" value="${htmlAttr(shopConf?.shop_name_en || SHOP_CONFIG.nameEn)}"></div>
              <div class="form-group"><label class="form-label">เบอร์โทร</label><input type="text" class="form-input" id="shop-phone" value="${htmlAttr(shopConf?.phone || SHOP_CONFIG.phone)}"></div>
              <div class="form-group"><label class="form-label">เลขผู้เสียภาษี</label><input type="text" class="form-input" id="shop-tax" value="${htmlAttr(shopConf?.tax_id || SHOP_CONFIG.taxId)}"></div>
            </div>
            <div class="form-group"><label class="form-label">ที่อยู่</label><textarea class="form-input" id="shop-addr" rows="3">${htmlAttr(shopConf?.address || SHOP_CONFIG.address)}</textarea></div>
            <div class="v36-admin-form-grid">
              <div class="form-group"><label class="form-label">PromptPay</label><input type="text" class="form-input" id="shop-promptpay" value="${htmlAttr(shopConf?.promptpay_number || '')}"></div>
              <div class="form-group"><label class="form-label">Footer ใบเสร็จ</label><input type="text" class="form-input" id="shop-footer" value="${htmlAttr(shopConf?.receipt_footer || SHOP_CONFIG.note)}"></div>
            </div>
            <button type="submit" class="btn btn-primary"><i class="material-icons-round">save</i> บันทึกตั้งค่าร้าน</button>
          </form>`;
        document.getElementById('shop-form').onsubmit = async (e) => {
          e.preventDefault();
          const d = {
            shop_name: document.getElementById('shop-name').value,
            shop_name_en: document.getElementById('shop-name-en').value,
            address: document.getElementById('shop-addr').value,
            phone: document.getElementById('shop-phone').value,
            tax_id: document.getElementById('shop-tax').value,
            promptpay_number: document.getElementById('shop-promptpay').value,
            receipt_footer: document.getElementById('shop-footer').value,
            updated_by: USER?.username,
            updated_at: new Date().toISOString(),
          };
          if (shopConf) await must(db.from('ตั้งค่าร้านค้า').update(d).eq('id', shopConf.id), 'บันทึกตั้งค่าร้าน');
          else await must(db.from('ตั้งค่าร้านค้า').insert(d), 'บันทึกตั้งค่าร้าน');
          toast?.('บันทึกตั้งค่าร้านสำเร็จ', 'success');
        };
        return;
      }

      if (section === 'cats') {
        const { data: cats, error } = await db.from('categories').select('*').order('name');
        if (error) { body.innerHTML = `<div style="color:#dc2626">โหลดหมวดหมู่ไม่สำเร็จ: ${htmlAttr(error.message)}</div>`; return; }
        body.innerHTML = `
          <div class="v36-admin-cats" style="margin-bottom:14px">
            ${(cats || []).map(c => `<span class="v36-admin-cat"><span class="v36-admin-cat-dot" style="background:${htmlAttr(c.color || '#64748b')}"></span>${htmlAttr(c.name || '')}<button onclick="deleteCat('${jsString(c.id)}')" title="ลบ"><i class="material-icons-round" style="font-size:16px">close</i></button></span>`).join('') || '<span style="color:#94a3b8;font-size:13px">ยังไม่มีหมวดหมู่</span>'}
          </div>
          <form id="cat-form" style="display:grid;grid-template-columns:1fr 52px auto;gap:8px;align-items:center">
            <input type="text" class="form-input" id="cat-name" placeholder="ชื่อหมวดหมู่">
            <input type="color" class="form-input" id="cat-color" value="#DC2626" style="height:42px;padding:4px">
            <button type="submit" class="btn btn-primary"><i class="material-icons-round">add</i> เพิ่ม</button>
          </form>`;
        document.getElementById('cat-form').onsubmit = async (e) => {
          e.preventDefault();
          const name = document.getElementById('cat-name').value.trim();
          const color = document.getElementById('cat-color').value;
          if (!name) return;
          await must(db.from('categories').insert({ name, color }), 'เพิ่มหมวดหมู่');
          toast?.('เพิ่มหมวดหมู่สำเร็จ', 'success');
          if (typeof loadCategories === 'function') await loadCategories();
          window.v36AdminOpenSection('cats');
        };
      }
    };

    window.renderAdmin = async function () {
      const page = document.getElementById('page-admin');
      if (!page) return;
      if (USER?.role !== 'admin') {
        page.innerHTML = `<div style="text-align:center;padding:80px;"><i class="material-icons-round" style="font-size:64px;color:var(--danger)">block</i><p style="font-size:18px;margin-top:16px;">เข้าถึงได้เฉพาะผู้ดูแลระบบ</p></div>`;
        return;
      }

      let users = [], cats = [];
      try {
        const [ur, cr] = await Promise.all([
          db.from('ผู้ใช้งาน').select('id,role').order('username'),
          db.from('categories').select('id').order('name'),
        ]);
        if (ur.error) throw ur.error;
        if (cr.error) throw cr.error;
        users = ur.data || [];
        cats = cr.data || [];
      } catch (e) {
        page.innerHTML = `<div style="padding:24px;color:#dc2626">โหลดหน้าผู้ดูแลไม่สำเร็จ: ${htmlAttr(e.message || e)}</div>`;
        return;
      }

      const admins = users.filter(u => u.role === 'admin').length;
      const staff = users.length - admins;
      page.innerHTML = `
        ${adminMenuStylesV36()}
        <div class="v36-admin">
          <div class="v36-admin-hero">
            <div>
              <div class="v36-admin-title">ผู้ดูแลระบบ</div>
              <div class="v36-admin-sub">เลือกเมนูที่ต้องการจัดการก่อน ระบบจะแสดงรายละเอียดเฉพาะส่วนนั้น</div>
            </div>
            <div class="v36-admin-stats">
              ${adminStatCardV36('groups', 'บัญชีทั้งหมด', users.length, '#38bdf8')}
              ${adminStatCardV36('admin_panel_settings', 'ผู้ดูแล', admins, '#f87171')}
              ${adminStatCardV36('category', 'หมวดหมู่', cats.length, '#34d399')}
            </div>
          </div>
          <div class="v36-admin-menu-grid">
            ${adminMenuCardV36('desktop_windows', 'โฆษณาหน้าจอลูกค้า', 'แปะรูปโปรโมชันหรือประกาศให้แสดงบนจอลูกค้า', 'ads', '#f97316')}
            ${adminMenuCardV36('store', 'ตั้งค่าร้านค้า', 'ชื่อร้าน ที่อยู่ เบอร์โทร เลขภาษี PromptPay และ footer ใบเสร็จ', 'shop', '#0ea5e9')}
            ${adminMenuCardV36('receipt_long', 'ตั้งค่าใบเสร็จ / เอกสาร', 'ปรับใบเสร็จ 80mm, A4, ใบเสนอราคา และใบรับเงิน', 'docs', '#dc2626')}
            ${adminMenuCardV36('manage_accounts', 'ผู้ใช้งานและสิทธิ์', 'เพิ่มผู้ใช้ แก้ PIN และกำหนดสิทธิ์การเข้าถึงเมนู', 'users', '#7c3aed')}
            ${adminMenuCardV36('category', 'หมวดหมู่สินค้า', 'เพิ่ม ลบ และจัดการหมวดหมู่สินค้า', 'cats', '#16a34a')}
          </div>
        </div>`;
    };
    window.renderAdmin.__v36menuOnly = true;
  }

  function productSearchTextV36(p) {
    return [p?.name, p?.barcode, p?.category, p?.note, p?.unit].filter(Boolean).join(' ').toLowerCase();
  }

  function normalizeSearchV36(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactSearchV36(value) {
    return normalizeSearchV36(value).replace(/\s+/g, '');
  }

  function fuzzyIncludesV36(haystack, needle) {
    if (!needle) return true;
    if (haystack.includes(needle)) return true;
    const compactHay = haystack.replace(/\s+/g, '');
    const compactNeedle = needle.replace(/\s+/g, '');
    if (compactNeedle && compactHay.includes(compactNeedle)) return true;
    let pos = 0;
    for (const ch of compactNeedle) {
      pos = compactHay.indexOf(ch, pos);
      if (pos === -1) return false;
      pos++;
    }
    return compactNeedle.length >= 3;
  }

  function productSmartMatchV36(product, query) {
    const q = normalizeSearchV36(query);
    if (!q) return true;
    const hay = normalizeSearchV36(productSearchTextV36(product));
    const tokens = q.split(' ').filter(Boolean);
    return tokens.every(token => fuzzyIncludesV36(hay, token));
  }

  function installSmartRecipeMaterialPicker() {
    if (window.__v36SmartRecipePicker) return;
    window.__v36SmartRecipePicker = true;

    function rawMaterialsV36() {
      const list = typeof v9GetProducts === 'function' ? v9GetProducts() : (typeof products !== 'undefined' ? products : []);
      return (list || []).filter(p => p.is_raw || p.product_type === 'both');
    }

    function enhanceSelect(select) {
      if (!select || select.__v36smartPicker) return;
      select.__v36smartPicker = true;
      const rowId = select.id || Math.random().toString(36).slice(2);
      const listId = `v36-mat-list-${rowId}`;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      const input = document.createElement('input');
      input.className = select.className || 'form-input';
      input.setAttribute('list', listId);
      input.placeholder = 'พิมพ์ชื่อ / บาร์โค้ด / หมวดหมู่วัตถุดิบ';
      input.style.cssText = (select.getAttribute('style') || '') + ';width:100%;';
      const dataList = document.createElement('datalist');
      dataList.id = listId;

      const fillOptions = (term = '') => {
        const q = String(term || '').trim().toLowerCase();
        const tokens = q.split(/\s+/).filter(Boolean);
        const opts = rawMaterialsV36()
          .map(p => {
            const hay = productSearchTextV36(p);
            const score = !tokens.length ? 1 : tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
            return { p, score, hay };
          })
          .filter(x => !tokens.length || x.score > 0)
          .sort((a, b) => b.score - a.score || String(a.p.name || '').localeCompare(String(b.p.name || ''), 'th'))
          .slice(0, 40);
        dataList.innerHTML = opts.map(({ p }) => {
          const label = `${p.name || ''}${p.barcode ? ' | ' + p.barcode : ''}${p.unit ? ' (' + p.unit + ')' : ''}`;
          return `<option value="${htmlAttr(label)}"></option>`;
        }).join('');
      };

      const syncToSelect = () => {
        const val = input.value.trim().toLowerCase();
        const mats = rawMaterialsV36();
        const found = mats.find(p => {
          const label = `${p.name || ''}${p.barcode ? ' | ' + p.barcode : ''}${p.unit ? ' (' + p.unit + ')' : ''}`.toLowerCase();
          return label === val || String(p.name || '').toLowerCase() === val || String(p.barcode || '').toLowerCase() === val;
        }) || mats.find(p => productSearchTextV36(p).includes(val));
        if (found) {
          select.value = found.id;
          input.value = `${found.name || ''}${found.barcode ? ' | ' + found.barcode : ''}${found.unit ? ' (' + found.unit + ')' : ''}`;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      const selected = rawMaterialsV36().find(p => String(p.id) === String(select.value));
      if (selected) input.value = `${selected.name || ''}${selected.barcode ? ' | ' + selected.barcode : ''}${selected.unit ? ' (' + selected.unit + ')' : ''}`;
      fillOptions(input.value);
      input.addEventListener('input', () => fillOptions(input.value));
      input.addEventListener('change', syncToSelect);
      input.addEventListener('blur', syncToSelect);

      select.style.display = 'none';
      select.parentNode.insertBefore(wrap, select);
      wrap.appendChild(input);
      wrap.appendChild(dataList);
      wrap.appendChild(select);
    }

    window.v36EnhanceRecipePickers = function () {
      document.querySelectorAll('select[id^="v9rec-mat-prod-"],select[id^="v9re-mat-"]').forEach(enhanceSelect);
    };

    const origAddMat = window.v9RecipeAddMat;
    window.v9RecipeAddMat = function () {
      const out = origAddMat?.apply(this, arguments);
      setTimeout(window.v36EnhanceRecipePickers, 0);
      return out;
    };

    const origEditFull = window.v9RecipeEditFull;
    if (typeof origEditFull === 'function') {
      window.v9RecipeEditFull = async function () {
        const timer = setInterval(() => window.v36EnhanceRecipePickers?.(), 120);
        try { return await origEditFull.apply(this, arguments); }
        finally { setTimeout(() => clearInterval(timer), 2000); }
      };
    }
  }

  function productRowHtmlV36(p) {
    const stockState = Number(p.stock || 0) <= 0 ? 'out' : Number(p.stock || 0) <= Number(p.min_stock || 0) ? 'low' : 'ok';
    const stockStyle = stockState === 'out'
      ? 'background:#fef2f2;color:#ef4444'
      : stockState === 'low'
        ? 'background:#fffbeb;color:#f59e0b'
        : 'background:#f0fdf4;color:#10b981';
    return `<tr style="transition:background .2s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
      <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9"><div style="width:40px;height:40px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden">${p.img_url ? `<img src="${htmlAttr(p.img_url)}" style="width:100%;height:100%;object-fit:cover">` : `<i class="material-icons-round" style="color:#cbd5e1">image</i>`}</div></td>
      <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9"><strong style="font-size:14px">${htmlAttr(p.name || '')}</strong>${p.note ? `<br><span style="font-size:11px;color:#94a3b8">${htmlAttr(p.note)}</span>` : ''}</td>
      <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:12px;color:#64748b">${htmlAttr(p.barcode || '-')}</td>
      <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9"><span style="background:#eff6ff;color:#3b82f6;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${htmlAttr(p.category || '-')}</span></td>
      <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;font-size:14px">฿${fmt(p.price)}</td>
      <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;text-align:right;color:#64748b">฿${fmt(p.cost || 0)}</td>
      <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;${stockStyle}">${fmt(p.stock)} ${htmlAttr(p.unit || '')}</span></td>
      <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;text-align:right"><div style="display:flex;gap:4px;justify-content:flex-end">
        <button onclick="editProduct('${jsString(p.id)}')" style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="แก้ไข"><i class="material-icons-round" style="font-size:16px;color:#3b82f6">edit</i></button>
        <button onclick="adjustStock('${jsString(p.id)}')" style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="ปรับสต็อก"><i class="material-icons-round" style="font-size:16px;color:#f59e0b">tune</i></button>
        <button onclick="generateBarcode?.('${jsString(p.id)}')" style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="บาร์โค้ด"><i class="material-icons-round" style="font-size:16px;color:#8b5cf6">qr_code</i></button>
        <button onclick="v34PrintPriceSticker?.('${jsString(p.id)}')" style="width:32px;height:32px;border:1px solid #d1fae5;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="ปริ้นสติกเกอร์ราคา"><i class="material-icons-round" style="font-size:16px;color:#10b981">label</i></button>
        <button onclick="deleteProduct('${jsString(p.id)}')" style="width:32px;height:32px;border:1px solid #fecaca;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="ลบ"><i class="material-icons-round" style="font-size:16px;color:#ef4444">delete</i></button>
      </div></td>
    </tr>`;
  }

  function installInventoryFiltersAndImport() {
    if (window.renderInventory?.__v36invTools) return;
    window.v36InvFilter = window.v36InvFilter || 'all';
    window.v36InvSearch = window.v36InvSearch || '';
    window.v36SetInvFilter = function (filter) {
      window.v36InvFilter = filter || 'all';
      window.renderInventory?.();
    };

    window.renderInventory = async function () {
      const section = document.getElementById('page-inv');
      if (!section) return;
      await loadProducts();
      const search = (window.v36InvSearch || document.getElementById('v36-inv-search')?.value || '').toLowerCase();
      const filter = window.v36InvFilter || 'all';
      const total = products.length;
      const lowList = products.filter(p => Number(p.stock || 0) <= Number(p.min_stock || 0) && Number(p.stock || 0) > 0);
      const outList = products.filter(p => Number(p.stock || 0) <= 0);
      const value = products.reduce((s, p) => s + ((Number(p.cost || 0)) * (Number(p.stock || 0))), 0);
      let filtered = products.filter(p => {
        const matchSearch = productSmartMatchV36(p, search);
        const matchFilter = filter === 'low' ? lowList.some(x => x.id === p.id) : filter === 'out' ? outList.some(x => x.id === p.id) : true;
        return matchSearch && matchFilter;
      });

      section.innerHTML = `
      <div style="max-width:1200px;margin:0 auto;padding-bottom:30px">
        <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #93c5fd;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
          <div style="display:flex;align-items:center;gap:16px">
            <div style="width:56px;height:56px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(59,130,246,.1)">
              <i class="material-icons-round" style="font-size:32px;color:#3b82f6">inventory_2</i>
            </div>
            <div><h2 style="margin:0;font-size:24px;color:#1e40af;font-weight:700">คลังสินค้า</h2><div style="color:#3b82f6;font-size:14px;margin-top:4px">จัดการสต็อกและข้อมูลสินค้า</div></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="showImportProductsCsvModal()" style="background:#fff;color:#3b82f6;border:1px solid #93c5fd;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px"><i class="material-icons-round" style="font-size:16px">upload_file</i>นำเข้า CSV</button>
            <button onclick="exportInventory?.()" style="background:#fff;color:#3b82f6;border:1px solid #93c5fd;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px"><i class="material-icons-round" style="font-size:16px">download</i>CSV</button>
            <button onclick="showAddProductModal()" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px;box-shadow:0 4px 12px rgba(37,99,235,.25)"><i class="material-icons-round" style="font-size:16px">add</i>เพิ่มสินค้า</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px">
          ${invStatCardV36('all', 'สินค้าทั้งหมด', total, '#3b82f6', filter)}
          ${invStatCardV36('low', 'ใกล้หมด', lowList.length, '#f59e0b', filter)}
          ${invStatCardV36('out', 'หมดสต็อก', outList.length, '#ef4444', filter)}
          <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
            <div style="font-size:28px;font-weight:800;color:#10b981">฿${fmt(value)}</div>
            <div style="font-size:13px;color:#64748b;margin-top:4px">มูลค่าคลัง</div>
          </div>
        </div>

        <div style="background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.03);border:1px solid #e2e8f0;overflow:hidden">
          <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div style="position:relative;max-width:430px;flex:1;min-width:240px">
              <i class="material-icons-round" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:20px">search</i>
              <input type="text" id="v36-inv-search" placeholder="ค้นหาสินค้า / บาร์โค้ด / หมวดหมู่..." value="${htmlAttr(search)}" style="width:100%;padding:10px 12px 10px 40px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;outline:none">
            </div>
            <div style="font-size:12px;color:#64748b;font-weight:700">แสดง ${fmt(filtered.length)} จาก ${fmt(total)} รายการ</div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;white-space:nowrap">
              <thead><tr style="background:#fff">
                <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">รูป</th>
                <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">สินค้า</th>
                <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">บาร์โค้ด</th>
                <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">หมวด</th>
                <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:right;border-bottom:2px solid #f1f5f9">ราคาขาย</th>
                <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:right;border-bottom:2px solid #f1f5f9">ต้นทุน</th>
                <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:center;border-bottom:2px solid #f1f5f9">สต็อก</th>
                <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:right;border-bottom:2px solid #f1f5f9">จัดการ</th>
              </tr></thead>
              <tbody>${filtered.length ? filtered.map(productRowHtmlV36).join('') : `<tr><td colspan="8" style="padding:40px;text-align:center;color:#94a3b8">ไม่พบสินค้า</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      </div>`;

      const searchInput = document.getElementById('v36-inv-search');
      searchInput?.addEventListener('input', () => {
        window.v36InvSearch = searchInput.value || '';
        clearTimeout(window.__v36InvSearchTimer);
        window.__v36InvSearchTimer = setTimeout(() => window.renderInventory(), 180);
      });
      if (searchInput && window.v36InvSearch) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
      const pa = document.getElementById('page-actions'); if (pa) pa.innerHTML = '';
    };
    window.renderInventory.__v36invTools = true;
  }

  function invStatCardV36(filter, label, count, color, active) {
    return `<button onclick="v36SetInvFilter('${filter}')" style="background:#fff;border-radius:12px;padding:16px;border:1.5px solid ${active === filter ? color : '#e2e8f0'};text-align:center;cursor:pointer;box-shadow:${active === filter ? '0 0 0 3px ' + color + '22' : 'none'}">
      <div style="font-size:28px;font-weight:800;color:${color}">${fmt(count)}</div>
      <div style="font-size:13px;color:#64748b;margin-top:4px">${label}</div>
    </button>`;
  }

  function parseCsvV36(text) {
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (ch === '"' && inQuotes && next === '"') { cell += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
      if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(v => String(v).trim() !== '')) rows.push(row);
        row = [];
        continue;
      }
      cell += ch;
    }
    row.push(cell);
    if (row.some(v => String(v).trim() !== '')) rows.push(row);
    return rows;
  }

  window.showImportProductsCsvModal = function () {
    const sample = 'name,barcode,category,price,cost,stock,min_stock,unit,note,img_url\nปูนซีเมนต์,8850000000010,ก่อสร้าง,150,120,20,5,ถุง,ตัวอย่างสินค้า,';
    Swal.fire({
      title: 'นำเข้าสินค้าจาก CSV',
      width: 720,
      html: `
        <div style="text-align:left;line-height:1.55">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px">
            <b>หัวคอลัมน์ที่รองรับ</b>
            <div style="font-family:monospace;font-size:12px;color:#475569;margin-top:6px">name, barcode, category, price, cost, stock, min_stock, unit, note, img_url</div>
          </div>
          <div style="font-size:12px;color:#64748b;margin-bottom:6px">ตัวอย่างไฟล์</div>
          <pre style="white-space:pre-wrap;background:#111827;color:#e5e7eb;border-radius:8px;padding:10px;font-size:12px;overflow:auto">${htmlAttr(sample)}</pre>
          <input id="v36-csv-file" type="file" accept=".csv,text/csv" class="swal2-file" style="display:block;width:100%;margin-top:12px">
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:#475569">
            <input id="v36-csv-upsert" type="checkbox" checked style="width:16px;height:16px"> ถ้าบาร์โค้ดซ้ำ ให้อัปเดตสินค้าเดิม
          </label>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'นำเข้า',
      cancelButtonText: 'ยกเลิก',
      preConfirm: async () => {
        const file = document.getElementById('v36-csv-file')?.files?.[0];
        if (!file) { Swal.showValidationMessage('กรุณาเลือกไฟล์ CSV'); return false; }
        return { text: await file.text(), upsert: document.getElementById('v36-csv-upsert')?.checked !== false };
      },
    }).then(async res => {
      if (!res.isConfirmed || !res.value) return;
      await importProductsCsvV36(res.value.text, res.value.upsert);
    });
  };

  async function importProductsCsvV36(text, upsert) {
    try {
      const rows = parseCsvV36(String(text || '').replace(/^\uFEFF/, ''));
      if (rows.length < 2) return toast?.('ไฟล์ไม่มีข้อมูลสินค้า', 'warning');
      const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
      const idx = key => headers.indexOf(key);
      if (idx('name') < 0) return toast?.('CSV ต้องมีคอลัมน์ name', 'warning');
      const existingByBarcode = {};
      if (upsert) {
        const { data } = await db.from(txt.product).select('id,barcode');
        (data || []).forEach(p => { if (p.barcode) existingByBarcode[String(p.barcode)] = p.id; });
      }
      let inserted = 0, updated = 0, skipped = 0;
      for (const row of rows.slice(1)) {
        const get = key => idx(key) >= 0 ? String(row[idx(key)] ?? '').trim() : '';
        const name = get('name');
        if (!name) { skipped++; continue; }
        const data = {
          name,
          barcode: get('barcode') || null,
          category: get('category') || null,
          price: Number(get('price') || 0),
          cost: Number(get('cost') || 0),
          stock: Number(get('stock') || 0),
          min_stock: Number(get('min_stock') || 0),
          unit: get('unit') || 'ชิ้น',
          note: get('note') || null,
          img_url: get('img_url') || null,
          updated_at: new Date().toISOString(),
        };
        if (!Number.isFinite(data.price) || !Number.isFinite(data.cost) || !Number.isFinite(data.stock) || !Number.isFinite(data.min_stock)) {
          skipped++; continue;
        }
        const existingId = data.barcode ? existingByBarcode[String(data.barcode)] : null;
        if (upsert && existingId) {
          await must(db.from(txt.product).update(data).eq('id', existingId), 'อัปเดตสินค้า');
          updated++;
        } else {
          await must(db.from(txt.product).insert(data), 'เพิ่มสินค้า');
          inserted++;
        }
      }
      await loadProducts?.();
      await window.renderInventory?.();
      Swal.fire({ icon: 'success', title: 'นำเข้าสำเร็จ', text: `เพิ่ม ${inserted} รายการ, อัปเดต ${updated} รายการ, ข้าม ${skipped} รายการ` });
    } catch (e) {
      console.error('[v36] import csv:', e);
      Swal.fire({ icon: 'error', title: 'นำเข้าไม่สำเร็จ', text: e.message || String(e) });
    }
  }

  function bestSellerScoreV36(p) {
    const cache = window.v36BestSellerCache;
    if (!cache || !p) return 0;
    const nameKey = normalizeBestSellerNameV36(p.name);
    return Number(cache.byId?.[p.id] || cache.byName?.[nameKey] || 0);
  }

  function normalizeBestSellerNameV36(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function isBestSellerV36(p) {
    const cache = window.v36BestSellerCache;
    const score = bestSellerScoreV36(p);
    if (!cache || !score) return false;
    const key = String(p?.id || '');
    const name = normalizeBestSellerNameV36(p?.name);
    return cache.topIds?.has(key) || cache.topNames?.has(name);
  }

  function bestSellerBadgeV36(p) {
    if (!isBestSellerV36(p)) return '';
    return '<span style="position:absolute;top:10px;right:0;z-index:3;background:#f97316;color:#fff;font-size:10px;font-weight:900;line-height:1;padding:6px 8px;border-radius:999px 0 0 999px;box-shadow:0 5px 14px rgba(249,115,22,.25);letter-spacing:0">สินค้าขายดี</span>';
  }

  async function loadBestSellerCacheV36(force) {
    const now = Date.now();
    if (!force && window.v36BestSellerCache && now - window.v36BestSellerCache.loadedAt < 300000) return window.v36BestSellerCache;
    if (window.v36BestSellerLoading) return window.v36BestSellerLoading;
    window.v36BestSellerLoading = (async () => {
      try {
        let data = [];
        let res = await db.from(txt.billItem).select('product_id,name,qty').limit(5000);
        if (res.error) {
          console.warn('[v36] best seller product_id fallback:', res.error);
          res = await db.from(txt.billItem).select('name,qty').limit(5000);
        }
        if (res.error) throw res.error;
        data = res.data || [];
        const byId = {};
        const byName = {};
        (data || []).forEach(row => {
          const qty = Number(row.qty || 0) || 1;
          if (row.product_id) byId[row.product_id] = (byId[row.product_id] || 0) + qty;
          const name = normalizeBestSellerNameV36(row.name);
          if (name) byName[name] = (byName[name] || 0) + qty;
        });
        const productList = Array.isArray(typeof products !== 'undefined' ? products : window.products) ? (typeof products !== 'undefined' ? products : window.products) : [];
        const ranked = productList.length
          ? productList.map(p => ({
              type: 'product',
              id: String(p.id || ''),
              name: normalizeBestSellerNameV36(p.name),
              score: Number(byId[p.id] || byName[normalizeBestSellerNameV36(p.name)] || 0),
            })).filter(x => x.score > 0).sort((a, b) => b.score - a.score)
          : (Object.keys(byId).length
              ? Object.entries(byId).map(([key, score]) => ({ type: 'id', key, score }))
              : Object.entries(byName).map(([key, score]) => ({ type: 'name', key, score }))
            ).sort((a, b) => b.score - a.score);
        const topCount = Math.min(8, ranked.length);
        const topIds = new Set();
        const topNames = new Set();
        ranked.slice(0, topCount).forEach(item => {
          if (item.type === 'product') {
            if (item.id) topIds.add(item.id);
            if (item.name) topNames.add(item.name);
          } else {
            (item.type === 'id' ? topIds : topNames).add(item.key);
          }
        });
        window.v36BestSellerCache = { byId, byName, topIds, topNames, loadedAt: Date.now() };
        return window.v36BestSellerCache;
      } catch (e) {
        console.warn('[v36] best seller cache:', e);
        window.v36BestSellerCache = { byId: {}, byName: {}, topIds: new Set(), topNames: new Set(), loadedAt: Date.now() };
        return window.v36BestSellerCache;
      } finally {
        window.v36BestSellerLoading = null;
      }
    })();
    return window.v36BestSellerLoading;
  }

  function installLimitedPosProductGrid(force) {
    if (window.renderProductGrid?.__v36limited && !force) {
      try { renderProductGrid = window.renderProductGrid; } catch (_) {}
      return;
    }
    window.v36PosLimit = window.v36PosLimit || 60;
    window.v36PosKey = '';
    window.v36ShowMoreProducts = function () {
      window.v36PosLimit = (window.v36PosLimit || 60) + 60;
      window.renderProductGrid?.();
    };
    window.renderProductGrid = function () {
      const container = document.getElementById('pos-product-grid');
      if (!container) return;
      const searchTerm = document.getElementById('pos-search')?.value?.toLowerCase() || '';
      const viewMode = document.querySelector('.view-btn.active')?.dataset?.view || 'grid';
      const cat = typeof activeCategory !== 'undefined' ? activeCategory : 'ทั้งหมด';
      const key = `${searchTerm}|${cat}|${viewMode}`;
      if (window.v36PosKey !== key) {
        window.v36PosKey = key;
        window.v36PosLimit = 60;
      }
      const all = (typeof products !== 'undefined' ? products : []).filter(p => {
        const matchSearch = productSmartMatchV36(p, searchTerm);
        const matchCategory = cat === 'ทั้งหมด' || cat === 'เธ—เธฑเนเธเธซเธกเธ”' || p.category === cat;
        const catText = String(cat || '');
        const matchCategoryFinal = matchCategory || !cat || catText.includes('หมด') || catText.includes('เธซเธก');
        return matchSearch && matchCategoryFinal;
      }).sort((a, b) => {
        const diff = bestSellerScoreV36(b) - bestSellerScoreV36(a);
        if (diff) return diff;
        return String(a.name || '').localeCompare(String(b.name || ''), 'th');
      });
      if (!window.v36BestSellerCache && !window.v36BestSellerLoading) {
        loadBestSellerCacheV36().then(() => window.renderProductGrid?.());
      }
      const shown = all.slice(0, window.v36PosLimit || 60);
      const countEl = document.getElementById('products-count');
      if (countEl) countEl.textContent = `แสดง ${shown.length} จาก ${all.length} รายการ (ทั้งหมด ${products.length})`;
      const renderCard = p => {
        const inCart = (typeof cart !== 'undefined' ? cart : []).find(c => c.id === p.id);
        const isLow = Number(p.stock || 0) <= Number(p.min_stock || 0) && Number(p.stock || 0) > 0;
        const isOut = Number(p.stock || 0) <= 0;
        if (viewMode === 'list') {
          return `<div class="product-list-item ${isOut ? 'out-of-stock' : ''}" style="position:relative;overflow:hidden" onclick="addToCart('${jsString(p.id)}')">
            ${bestSellerBadgeV36(p)}
            <div class="product-list-img">${p.img_url ? `<img src="${htmlAttr(p.img_url)}" alt="${htmlAttr(p.name)}" loading="lazy">` : `<i class="material-icons-round">inventory_2</i>`}</div>
            <div class="product-list-info"><div class="product-name">${htmlAttr(p.name || '')}</div><div class="product-sku">${htmlAttr(p.barcode || '-')}</div></div>
            <div class="product-list-right"><span class="product-price">฿${fmt(p.price)}</span><span class="product-stock ${isLow ? 'low' : ''} ${isOut ? 'out' : ''}">${isOut ? 'หมด' : fmt(p.stock)}</span>${inCart ? `<span class="product-badge">${inCart.qty}</span>` : ''}</div>
          </div>`;
        }
        return `<div class="product-card ${isOut ? 'out-of-stock' : ''}" style="position:relative;overflow:hidden" onclick="addToCart('${jsString(p.id)}')">
          ${bestSellerBadgeV36(p)}
          <div class="product-img">${p.img_url ? `<img src="${htmlAttr(p.img_url)}" alt="${htmlAttr(p.name)}" loading="lazy">` : `<i class="material-icons-round">inventory_2</i>`}${inCart ? `<span class="product-badge">${inCart.qty}</span>` : ''}</div>
          <div class="product-info"><div class="product-name">${htmlAttr(p.name || '')}</div><div class="product-sku">${htmlAttr(p.barcode || '-')}</div><div class="product-footer"><span class="product-price">฿${fmt(p.price)}</span><span class="product-stock ${isLow ? 'low' : ''} ${isOut ? 'out' : ''}">${isOut ? 'หมด' : fmt(p.stock)}</span></div></div>
        </div>`;
      };
      container.className = viewMode === 'list' ? 'product-list' : 'product-grid';
      container.style.gridTemplateColumns = viewMode === 'grid' && window.innerWidth >= 1280 ? 'repeat(8,minmax(0,1fr))' : '';
      container.innerHTML = shown.map(renderCard).join('') + (shown.length < all.length ? `
        <button type="button" onclick="v36ShowMoreProducts()" style="grid-column:1/-1;margin:8px auto 0;padding:10px 18px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">
          <i class="material-icons-round">expand_more</i> แสดงเพิ่มอีก ${Math.min(60, all.length - shown.length)} รายการ
        </button>` : '');
    };
    window.renderProductGrid.__v36limited = true;
    try { renderProductGrid = window.renderProductGrid; } catch (_) {}
  }

  function installAll() {
    installSaleSafety();
    installCashSafety();
    installCheckoutRedesignV36();
    installCartPanelRedesignV36();
    installReturnFlowWatchdogV36();
    installReturnCashDenomWizardV36();
    installProductValidation();
    installProductDeleteWithStockHistoryCleanup();
    installProductStorageBridge();
    installProductImageMigrationTool();
    installPermissionUICompleteness();
    installDeliverySafety();
    installAdminSafety();
    installAdminRedesign();
    installAdminMenuOnlyRedesign();
    installSmartRecipeMaterialPicker();
    installInventoryFiltersAndImport();
    installLimitedPosProductGrid(true);
    console.log('[v36] Usage safety patch applied');
  }

  setTimeout(installAll, 400);
  setTimeout(installAll, 1400);
  setTimeout(installAll, 2600);
})();
