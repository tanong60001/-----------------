'use strict';
console.log('[v30] ✅ LOADED: Fast Sale Batch Optimizer');

/**
 * modules-v30-fastsale.js
 * SK POS — optimized window.v9Sale
 *
 * Reduces sequential DB roundtrips from ~16–34 down to ~4–6 regardless of cart size:
 *   1. Fetch cash_session + สินค้า in PARALLEL before bill insert
 *   2. Batch insert all รายการในบิล in one call
 *   3. Batch insert all stock_movement records in one call
 *   4. Parallel stock updates via Promise.all
 *   5. MTO recipe fetches in parallel, then batched ops
 *   6. Post-save ops (recordCashTx, customer update, logActivity) run in parallel, non-blocking
 *   7. Skip re-fetch of รายการในบิล — use in-memory billItems array for printing
 *   8. loadProducts + getLiveCashBalance run in background (non-blocking before Swal)
 *   9. closeCheckout + v9HideOverlay fire BEFORE the print dialog (same as original)
 */

function _v30PatchSale(attempt) {
  attempt = attempt || 0;
  if (typeof window.v9Sale !== 'function' || typeof window.v9ShowOverlay !== 'function') {
    if (attempt < 30) setTimeout(function () { _v30PatchSale(attempt + 1); }, 300);
    return;
  }
  if (window._v30Patched) return;
  window._v30Patched = true;

  window.v9Sale = async function () {
    if (window.isProcessingPayment) return;
    window.isProcessingPayment = true;
    v9ShowOverlay('กำลังบันทึกบิล...', 'โปรดรอสักครู่');

    try {
      // ── STEP 0: inject customer address into checkoutState (FIX-46 logic, kept) ──
      if (checkoutState?.customer?.id) {
        try {
          const { data: custPre } = await db.from('customer')
            .select('address,phone').eq('id', checkoutState.customer.id).maybeSingle();
          if (custPre) {
            checkoutState.customer.address = custPre.address || '';
            checkoutState.customer.phone = custPre.phone || '';
          }
        } catch (_) { }
      }

      // ── STEP 1: Fetch cash_session + สินค้า in PARALLEL ──────────────────────────
      const [sessionRes, prodsRes] = await Promise.all([
        db.from('cash_session')
          .select('*').eq('status', 'open')
          .order('opened_at', { ascending: false }).limit(1).maybeSingle(),
        db.from('สินค้า').select('id,name,stock,product_type,unit,cost'),
      ]);
      const session = sessionRes?.data ?? null;
      const stockMap = {};
      (prodsRes?.data || []).forEach(function (p) { stockMap[p.id] = p; });

      // ── STEP 2: Insert bill ───────────────────────────────────────────────────────
      const methodTH = { cash: 'เงินสด', transfer: 'โอนเงิน', credit: 'บัตรเครดิต', debt: 'ค้างชำระ' };
      const { data: bill, error: billErr } = await db.from('บิลขาย').insert({
        date: new Date().toISOString(),
        method: methodTH[checkoutState.method] || 'เงินสด',
        total: checkoutState.total,
        discount: checkoutState.discount || 0,
        received: checkoutState.received || 0,
        change: checkoutState.change || 0,
        customer_name: checkoutState.customer?.name || null,
        customer_id: checkoutState.customer?.id || null,
        customer_address: checkoutState.customer?.address || null,
        customer_phone: checkoutState.customer?.phone || null,
        staff_name: v9Staff(),
        status: checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
      }).select().single();
      if (billErr) throw new Error(billErr.message);

      // ── STEP 3: Build in-memory arrays (no awaits in loop) ───────────────────────
      const billItems = [];      // rows for รายการในบิล batch insert
      const movements = [];      // rows for stock_movement batch insert
      const stockUpdatePromises = []; // promises for parallel สินค้า.update
      const mtoItems = [];       // { item, sellUnit } for MTO products

      const cartSnapshot = Array.isArray(window.cart) ? window.cart : (typeof cart !== 'undefined' ? cart : []);

      for (const item of cartSnapshot) {
        const fresh = stockMap[item.id] || {};
        const convRate = parseFloat(item.conv_rate || 1);
        const baseQty = parseFloat((item.qty * convRate).toFixed(6));
        const sellUnit = item.unit || fresh.unit || 'ชิ้น';
        const isMTO = !!(item.is_mto || fresh.product_type === 'ตามบิล');
        const costPerBase = parseFloat(fresh.cost || item.cost || 0);
        const costPerSellUnit = parseFloat((costPerBase * convRate).toFixed(6));

        // bill item row (always)
        billItems.push({
          bill_id: bill.id,
          product_id: item.id,
          name: item.name,
          qty: item.qty,
          price: parseFloat(item.price || 0),
          cost: costPerSellUnit,
          total: parseFloat((item.price * item.qty).toFixed(2)),
          unit: sellUnit,
        });

        if (!isMTO) {
          const stockBefore = parseFloat(fresh.stock || 0);
          const stockAfter = parseFloat(Math.max(0, stockBefore - baseQty).toFixed(6));

          stockUpdatePromises.push(
            db.from('สินค้า')
              .update({ stock: stockAfter, updated_at: new Date().toISOString() })
              .eq('id', item.id)
          );

          movements.push({
            product_id: item.id,
            product_name: item.name,
            type: 'ขาย',
            direction: 'out',
            qty: baseQty,
            stock_before: stockBefore,
            stock_after: stockAfter,
            ref_id: bill.id,
            ref_table: 'บิลขาย',
            staff_name: v9Staff(),
            note: convRate !== 1
              ? `ขาย ${item.qty} ${sellUnit} (${baseQty} ${fresh.unit || ''})`
              : null,
          });
        } else {
          mtoItems.push({ item, sellUnit });
        }
      }

      // ── STEP 4: Handle MTO — fetch all recipes in parallel ───────────────────────
      if (mtoItems.length > 0) {
        try {
          const recipeResults = await Promise.all(
            mtoItems.map(function (m) {
              return db.from('สูตรสินค้า').select('*').eq('product_id', m.item.id);
            })
          );

          for (let i = 0; i < mtoItems.length; i++) {
            const { item, sellUnit } = mtoItems[i];
            const recipes = recipeResults[i]?.data || [];
            for (const r of recipes) {
              const mat = stockMap[r.material_id] || {};
              const needed = parseFloat((r.quantity * item.qty).toFixed(6));
              const matBefore = parseFloat(mat.stock || 0);
              const matAfter = parseFloat(Math.max(0, matBefore - needed).toFixed(6));

              stockUpdatePromises.push(
                db.from('สินค้า')
                  .update({ stock: matAfter, updated_at: new Date().toISOString() })
                  .eq('id', r.material_id)
              );

              movements.push({
                product_id: r.material_id,
                product_name: mat.name || r.material_id,
                type: 'ใช้ผลิต(ขาย)',
                direction: 'out',
                qty: needed,
                stock_before: matBefore,
                stock_after: matAfter,
                ref_id: bill.id,
                ref_table: 'บิลขาย',
                staff_name: v9Staff(),
                note: `บิล #${bill.bill_no}: ${item.name} × ${item.qty} ${sellUnit}`,
              });
            }
          }
        } catch (e) {
          console.warn('[v30Sale] BOM:', e.message);
        }
      }

      // ── STEP 5: Batch-insert bill items + stock movements + parallel stock updates
      const batchOps = [];
      if (billItems.length > 0) {
        batchOps.push(db.from('รายการในบิล').insert(billItems));
      }
      if (movements.length > 0) {
        batchOps.push(db.from('stock_movement').insert(movements));
      }
      batchOps.push(...stockUpdatePromises);

      await Promise.all(batchOps);

      // ── STEP 6: Post-save ops in parallel (non-blocking) ─────────────────────────
      const postOps = [];

      // Cash transaction
      if (checkoutState.method === 'cash' && session) {
        let chgD = checkoutState.changeDenominations || {};
        if (!Object.values(chgD).some(function (v) { return Number(v) > 0; }) && checkoutState.change > 0) {
          chgD = typeof calcChangeDenominations === 'function'
            ? calcChangeDenominations(checkoutState.change) : {};
        }
        postOps.push(
          window.recordCashTx({
            sessionId: session.id,
            type: 'ขาย',
            direction: 'in',
            amount: checkoutState.received,
            changeAmt: checkoutState.change,
            netAmount: checkoutState.total,
            refId: bill.id,
            refTable: 'บิลขาย',
            denominations: checkoutState.receivedDenominations || null,
            changeDenominations: chgD || null,
            note: null,
          }).catch(function (e) { console.warn('[v30Sale] recordCashTx:', e); })
        );
      }

      // Customer update
      if (checkoutState.customer?.id) {
        postOps.push(
          db.from('customer')
            .select('total_purchase,visit_count,debt_amount')
            .eq('id', checkoutState.customer.id)
            .maybeSingle()
            .then(function (res) {
              const cust = res?.data || {};
              return db.from('customer').update({
                total_purchase: (cust.total_purchase || 0) + checkoutState.total,
                visit_count: (cust.visit_count || 0) + 1,
                debt_amount: checkoutState.method === 'debt'
                  ? (cust.debt_amount || 0) + checkoutState.total
                  : (cust.debt_amount || 0),
              }).eq('id', checkoutState.customer.id);
            })
            .catch(function (e) { console.warn('[v30Sale] customer update:', e); })
        );
      }

      // logActivity (fire-and-forget style but included in parallel)
      if (typeof logActivity === 'function') {
        postOps.push(
          Promise.resolve().then(function () {
            logActivity('ขายสินค้า', `บิล #${bill.bill_no} ฿${formatNum(checkoutState.total)}`, bill.id, 'บิลขาย');
          }).catch(function (e) { console.warn('[v30Sale] logActivity:', e); })
        );
      }

      // Run all post-save ops in parallel — intentionally NOT awaited before UI
      const postSavePromise = Promise.all(postOps);

      // sendToDisplay is synchronous (postMessage) — no await needed
      typeof sendToDisplay === 'function' &&
        sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: checkoutState.total });

      // ── STEP 7: Clear cart immediately ───────────────────────────────────────────
      try { cart = []; } catch (_) { try { window.cart = []; } catch (_2) { } }

      // ── STEP 8: Hide overlay + close checkout BEFORE print dialog ────────────────
      v9HideOverlay();
      typeof closeCheckout === 'function' && closeCheckout();

      // ── STEP 9: Kick off background refresh (non-blocking) ───────────────────────
      const bgRefresh = Promise.resolve().then(async function () {
        try {
          await loadProducts?.();
          try {
            if (typeof products !== 'undefined') window._v9ProductsCache = products;
          } catch (_) { }
          renderCart?.();
          renderProductGrid?.();
          updateHomeStats?.();
        } catch (e) { console.warn('[v30Sale] loadProducts bg:', e); }

        try {
          const nb = await getLiveCashBalance?.();
          ['cash-current-balance', 'global-cash-balance'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.textContent = `฿${formatNum(nb)}`;
          });
        } catch (e) { console.warn('[v30Sale] getLiveCashBalance bg:', e); }
      });

      // ── STEP 10: Show Swal success + print dialog ─────────────────────────────────
      const { value: printChoice } = await Swal.fire({
        icon: 'success',
        title: `บิล #${bill.bill_no} สำเร็จ`,
        html: `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0 16px;text-align:center;">
          <div style="background:#f0fdf4;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">ยอดขาย</div>
            <div style="font-size:16px;font-weight:800;color:#059669;">฿${formatNum(bill.total)}</div>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">รับมา</div>
            <div style="font-size:16px;font-weight:800;color:#2563eb;">฿${formatNum(checkoutState.received)}</div>
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">เงินทอน</div>
            <div style="font-size:16px;font-weight:800;color:#d97706;">฿${formatNum(Math.max(0, checkoutState.change))}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;">รูปแบบพิมพ์ใบเสร็จ</div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button onclick="Swal.getConfirmButton().click();window._v9PrintFmt='80mm'"
            style="padding:12px 18px;border-radius:10px;border:2px solid #DC2626;
              background:#fff5f5;cursor:pointer;font-size:13px;font-weight:700;color:#DC2626;min-width:90px;">
            <div style="font-size:22px;margin-bottom:4px;">🧾</div>
            80mm<br><span style="font-size:10px;font-weight:400;color:#666;">เครื่องพิมพ์</span>
          </button>
          <button onclick="Swal.getConfirmButton().click();window._v9PrintFmt='A4'"
            style="padding:12px 18px;border-radius:10px;border:2px solid #2563eb;
              background:#eff6ff;cursor:pointer;font-size:13px;font-weight:700;color:#2563eb;min-width:90px;">
            <div style="font-size:22px;margin-bottom:4px;">📄</div>
            A4<br><span style="font-size:10px;font-weight:400;color:#666;">ใบเสร็จเต็ม</span>
          </button>
          <button onclick="Swal.getDenyButton().click()"
            style="padding:12px 18px;border-radius:10px;border:2px solid #d1d5db;
              background:#f9fafb;cursor:pointer;font-size:13px;font-weight:700;color:#6b7280;min-width:90px;">
            <div style="font-size:22px;margin-bottom:4px;">⏭️</div>
            ข้าม<br><span style="font-size:10px;font-weight:400;color:#666;">ไม่พิมพ์</span>
          </button>
        </div>`,
        showConfirmButton: true,
        showDenyButton: true,
        showCancelButton: false,
        confirmButtonText: '',
        denyButtonText: '',
        customClass: { confirmButton: 'swal-hidden-btn', denyButton: 'swal-hidden-btn' },
        didOpen: function () {
          document.querySelectorAll('.swal-hidden-btn').forEach(function (b) { b.style.display = 'none'; });
          window._v9PrintFmt = null;
        },
        timer: 15000,
        timerProgressBar: true,
      });

      // ── STEP 11: Print using in-memory billItems (no DB re-fetch) ────────────────
      const fmt = window._v9PrintFmt;
      if (fmt && typeof printReceipt === 'function') {
        printReceipt(bill, billItems, fmt);
      }
      window._v9PrintFmt = null;

      // Ensure post-save ops finish in background (already running, just suppress unhandled rejection)
      postSavePromise.catch(function (e) { console.warn('[v30Sale] postSave:', e); });
      bgRefresh.catch(function (e) { console.warn('[v30Sale] bgRefresh:', e); });

    } catch (e) {
      v9HideOverlay();
      typeof toast === 'function' && toast('เกิดข้อผิดพลาด: ' + (e.message || e), 'error');
      console.error('[v30Sale]', e);
    } finally {
      window.isProcessingPayment = false;
    }
  };

  console.log('[v30] ✓ v9Sale → optimized batch version');
}

_v30PatchSale();
