// ══════════════════════════════════════════════════════════════════
// modules-v33-fixes.js
//   1) Global loading overlay (ref-counted, blocks UI while busy)
//   2) Fix payroll duplicate-key error — v26DoPay uses UPSERT pattern
//   3) Fix payables: await re-render + loading to prevent double-click
//   4) Auto-wrap key render* functions with loading overlay
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  console.log('[v33-fixes] loading...');

  // ────────────────────────────────────────────
  // CSS
  // ────────────────────────────────────────────
  if (!document.getElementById('v33-loader-css')) {
    const css = document.createElement('style');
    css.id = 'v33-loader-css';
    css.textContent = `
      .v33-loader {
        position: fixed; inset: 0; z-index: 2147483646;
        background: rgba(15, 23, 42, 0.48);
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
        display: none; align-items: center; justify-content: center;
        animation: v33fadein 0.18s ease;
      }
      .v33-loader.v33-active { display: flex; }
      @keyframes v33fadein { from { opacity: 0; } to { opacity: 1; } }
      .v33-loader-box {
        background: #fff;
        padding: 28px 40px;
        border-radius: 22px;
        display: flex; flex-direction: column;
        align-items: center; gap: 16px;
        min-width: 220px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.35), 0 4px 20px rgba(0,0,0,0.15);
        font-family: 'Prompt', sans-serif;
      }
      .v33-spinner {
        width: 56px; height: 56px; border-radius: 50%;
        border: 5px solid #e2e8f0;
        border-top-color: #3b82f6;
        border-right-color: #6366f1;
        animation: v33spin 0.7s cubic-bezier(0.65, 0, 0.35, 1) infinite;
      }
      @keyframes v33spin { to { transform: rotate(360deg); } }
      .v33-loader-msg {
        font-size: 14.5px;
        font-weight: 600;
        color: #334155;
      }
      .v33-loader-sub {
        font-size: 12px;
        color: #94a3b8;
        margin-top: -8px;
      }
    `;
    document.head.appendChild(css);
  }

  // ────────────────────────────────────────────
  // DOM + Ref-counted API
  // ────────────────────────────────────────────
  let overlay = null;
  let count = 0;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'v33-loader';
    overlay.innerHTML =
      '<div class="v33-loader-box">' +
      '<div class="v33-spinner"></div>' +
      '<div class="v33-loader-msg" id="v33-loader-msg">กำลังโหลด...</div>' +
      '<div class="v33-loader-sub">โปรดรอสักครู่</div>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  window.showLoading = function (msg) {
    count++;
    const o = ensureOverlay();
    const m = o.querySelector('#v33-loader-msg');
    if (m && msg) m.textContent = msg;
    o.classList.add('v33-active');
  };

  window.hideLoading = function () {
    count = Math.max(0, count - 1);
    if (count === 0 && overlay) overlay.classList.remove('v33-active');
  };

  window.withLoading = async function (fn, msg) {
    window.showLoading(msg || 'กำลังโหลด...');
    try { return await fn(); }
    finally { window.hideLoading(); }
  };

  // Safety: force-hide overlay if something gets stuck
  window.forceHideLoading = function () {
    count = 0;
    if (overlay) overlay.classList.remove('v33-active');
  };

  // ────────────────────────────────────────────
  // OVERRIDE: v26DoPay — handle duplicate key constraint
  //   The DB 'จ่ายเงินเดือน' has a unique(employee_id, month) constraint,
  //   which means only ONE record per employee per month. If already exists,
  //   we MERGE the new payment into the existing record instead of INSERT.
  // ────────────────────────────────────────────
  function installV26DoPayOverride() {
    window.v26DoPay = async function (eid) {
      const s = window._v26Pay && window._v26Pay.find(function (x) { return x.emp && x.emp.id === eid; });
      if (!s) { toast('ไม่พบข้อมูลพนักงาน', 'error'); return; }

      const recv = Number((document.getElementById('v26r-' + eid) || {}).value || 0);
      const debt = Number((document.getElementById('v26d-' + eid) || {}).value || 0);
      const ss   = Number((document.getElementById('v26s-' + eid) || {}).value || 0);
      const oth  = Number((document.getElementById('v26o-' + eid) || {}).value || 0);
      const tot  = recv + debt + ss + oth;

      if (tot > s.net) { toast('ยอดรวมเกินยอดสะสม!', 'error'); return; }
      if (debt > s.ta) { toast('หักหนี้เกินยอดค้างชำระ!', 'error'); return; }

      const method = (document.getElementById('v26m-' + eid) || {}).value || 'เงินสด';
      const note   = (document.getElementById('v26pn-' + eid) || {}).value || '';
      const oNote  = (document.getElementById('v26on-' + eid) || {}).value || '';

      const r = await Swal.fire({
        title: 'ยืนยันจ่ายเงินเดือน',
        html:
          '<p><strong>' + s.emp.name + '</strong></p>' +
          '<p>รับจริง: ฿' + formatNum(recv) + '</p>' +
          (debt > 0 ? '<p>หักหนี้: ฿' + formatNum(debt) + '</p>' : '') +
          (ss > 0   ? '<p>หักประกันสังคม: ฿' + formatNum(ss) + '</p>' : '') +
          (oth > 0  ? '<p>หักอื่นๆ: ฿' + formatNum(oth) + (oNote ? ' (' + oNote + ')' : '') + '</p>' : ''),
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626'
      });
      if (!r.isConfirmed) return;

      if (method === 'เงินสด' && recv > 0) {
        try { await assertCashEnough(recv, 'จ่ายเงินเดือน'); }
        catch (e) { Swal.fire({ icon: 'error', title: 'เงินไม่พอ', text: e.message }); return; }
      }

      // Pre-count denominations (exact) BEFORE any DB write
      let payrollDenom = null;
      if (method === 'เงินสด' && recv > 0) {
        payrollDenom = await v33WizardOut(
          recv,
          '💸 จ่ายเงินเดือน ' + s.emp.name,
          'เลือกแบงค์/เหรียญที่จะจ่ายพนักงาน ฿' + v33FmtNum(recv)
        );
        if (!payrollDenom) {
          if (typeof toast === 'function') toast('ยกเลิกการจ่าย', 'info');
          return;
        }
      }

      // Lock the confirm button so it can't be double-clicked
      const btn = document.getElementById('v26pb-' + eid);
      if (btn) { btn.disabled = true; btn.style.opacity = 0.6; }

      window.showLoading('กำลังบันทึกการจ่ายเงินเดือน...');
      try {
        const now = new Date();
        const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const noteDetails = [];
        if (debt > 0) noteDetails.push('หักหนี้ ฿' + debt);
        if (ss > 0)   noteDetails.push('หักประกันสังคม ฿' + ss);
        if (oth > 0)  noteDetails.push('หักอื่นๆ ฿' + oth + (oNote ? ' (' + oNote + ')' : ''));
        const noteFull = (note + ' (จ่ายทาง ' + method + ') ' +
          (noteDetails.length ? '[' + noteDetails.join(', ') + ']' : '')).trim();

        // Check for existing record (unique constraint handling)
        const { data: existing } = await db.from('จ่ายเงินเดือน')
          .select('*').eq('employee_id', eid).eq('month', ms).maybeSingle();

        // NOTE: DB columns for จ่ายเงินเดือน do NOT include deduct_ss / deduct_other.
        // Those amounts are captured inside the `note` field instead.
        let pIns;
        if (existing) {
          // MERGE: add new payment to existing accumulated values
          const merged = {
            working_days: s.wd,
            base_salary: s.earn,
            deduct_withdraw: (existing.deduct_withdraw || 0) + debt,
            deduct_absent: s.td,
            net_paid: (existing.net_paid || 0) + recv,
            paid_date: now.toISOString(),
            staff_name: (typeof USER !== 'undefined' && USER ? USER.username : null),
            note: (existing.note ? existing.note + ' | ' : '') + noteFull
          };
          const upd = await db.from('จ่ายเงินเดือน').update(merged).eq('id', existing.id).select().single();
          if (upd.error) throw new Error(upd.error.message);
          pIns = upd.data;
        } else {
          const ins = await db.from('จ่ายเงินเดือน').insert({
            employee_id: eid,
            month: ms,
            working_days: s.wd,
            base_salary: s.earn,
            deduct_withdraw: debt,
            deduct_absent: s.td,
            bonus: 0,
            net_paid: recv,
            paid_date: now.toISOString(),
            staff_name: (typeof USER !== 'undefined' && USER ? USER.username : null),
            note: noteFull
          }).select().single();
          if (ins.error) throw new Error(ins.error.message);
          pIns = ins.data;
        }

        // Record cash transaction with pre-counted denominations
        if (method === 'เงินสด' && recv > 0) {
          const sessRes = await db.from('cash_session').select('id').eq('status', 'open').limit(1).maybeSingle();
          const sess = sessRes && sessRes.data;
          if (sess && typeof recordCashTx === 'function') {
            await recordCashTx({
              sessionId: sess.id, type: 'จ่ายเงินเดือน', direction: 'out',
              amount: recv, netAmount: recv, refId: pIns && pIns.id,
              denominations: payrollDenom,
              note: s.emp.name + ' ' + note,
              __v33skipWizard: true
            });
          }
        }

        // Update advance payment debts
        if (debt > 0) {
          const { data: advs } = await db.from('เบิกเงิน')
            .select('*').eq('employee_id', eid).eq('status', 'อนุมัติ').order('date');
          let rem = debt;
          for (const a of (advs || [])) {
            if (rem <= 0) break;
            if (a.amount <= rem) {
              await db.from('เบิกเงิน').update({ status: 'ชำระแล้ว' }).eq('id', a.id);
              rem -= a.amount;
            } else {
              await db.from('เบิกเงิน').update({ amount: a.amount - rem }).eq('id', a.id);
              rem = 0;
            }
          }
        }

        toast('จ่าย ' + s.emp.name + ' ฿' + formatNum(recv) + ' สำเร็จ', 'success');
        if (typeof logActivity === 'function') {
          logActivity('จ่ายเงินเดือน', s.emp.name + ' ฿' + formatNum(recv));
        }

        // Refresh payroll screen
        if (typeof window.renderPayrollV26 === 'function') {
          await window.renderPayrollV26();
        }
      } catch (err) {
        console.error('[v33-fixes] payroll save error:', err);
        toast('Error: ' + (err && err.message ? err.message : err), 'error');
      } finally {
        window.hideLoading();
        if (btn) { btn.disabled = false; btn.style.opacity = 1; }
      }
    };
  }

  // ────────────────────────────────────────────
  // OVERRIDE: payPayable — loading + await re-render
  // ────────────────────────────────────────────
  function installPayPayableOverride() {
    window.payPayable = async function (id, balance) {
      const { value, isConfirmed } = await Swal.fire({
        title: 'ชำระเจ้าหนี้',
        html: '<p>ยอดคงค้าง: <strong>฿' + formatNum(balance) + '</strong></p>' +
              '<input id="swal-pay" class="swal2-input" type="number" max="' + balance + '" value="' + balance + '">',
        showCancelButton: true,
        confirmButtonText: 'ชำระ',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => document.getElementById('swal-pay').value
      });

      if (!isConfirmed || !value) return;

      window.showLoading('กำลังบันทึกการชำระ...');
      try {
        const paid = Number(value);
        const { data: cur } = await db.from('เจ้าหนี้')
          .select('paid_amount, amount').eq('id', id).single();
        const newPaid = (cur && cur.paid_amount || 0) + paid;
        const newBalance = (cur && cur.amount || 0) - newPaid;
        const upd = await db.from('เจ้าหนี้').update({
          paid_amount: newPaid,
          balance: Math.max(0, newBalance),
          status: newBalance <= 0 ? 'ชำระแล้ว' : 'ค้างชำระ',
          updated_at: new Date().toISOString()
        }).eq('id', id);
        if (upd.error) throw new Error(upd.error.message);
        toast('บันทึกการชำระสำเร็จ', 'success');
        if (typeof window.renderPayables === 'function') {
          await window.renderPayables();
        }
      } catch (err) {
        console.error('[v33-fixes] payPayable error:', err);
        toast('Error: ' + (err && err.message ? err.message : err), 'error');
      } finally {
        window.hideLoading();
      }
    };
  }

  // ────────────────────────────────────────────
  // OVERRIDE: v9PayCreditor — refresh the VISIBLE page-payable after save.
  //   The original (modules-v9.js) calls window.renderCreditors() which
  //   targets page-ap, leaving page-payable stale so the user thinks the
  //   save didn't work and clicks again.
  // ────────────────────────────────────────────
  function installV9PayCreditorOverride() {
    window.v9PayCreditor = async function (credId, suppName, balance, totalAmount) {
      const { value, isConfirmed } = await Swal.fire({
        title: 'ชำระเจ้าหนี้: ' + suppName,
        html:
          '<div style="text-align:left;">' +
            '<div style="background:#fef2f2;border-radius:10px;padding:12px;margin-bottom:14px;' +
              'display:flex;justify-content:space-between;">' +
              '<span style="font-size:13px;color:#dc2626;">ยอดคงค้าง</span>' +
              '<span style="font-size:20px;font-weight:700;color:#dc2626;">฿' + formatNum(balance) + '</span>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">ชำระวันนี้ (฿)</label>' +
              '<input id="v9cred-pay" class="form-input" type="number" value="' + balance + '" min="1" max="' + balance + '">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">วิธีชำระ</label>' +
              '<select id="v9cred-method" class="form-input">' +
                '<option value="เงินสด">เงินสด</option>' +
                '<option value="โอนเงิน">โอนเงิน</option>' +
                '<option value="เช็ค">เช็ค</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">หมายเหตุ</label>' +
              '<input id="v9cred-note" class="form-input" placeholder="(ถ้ามี)">' +
            '</div>' +
          '</div>',
        showCancelButton: true,
        confirmButtonText: '✅ บันทึกชำระ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#15803d',
        preConfirm: () => ({
          pay: parseFloat(document.getElementById('v9cred-pay')?.value || 0),
          method: document.getElementById('v9cred-method')?.value || 'เงินสด',
          note: document.getElementById('v9cred-note')?.value || ''
        })
      });
      if (!isConfirmed || !value || !value.pay) return;

      // Guard against paying more than balance
      const payAmt = Math.min(value.pay, balance);

      window.showLoading('กำลังบันทึกการชำระ...');
      try {
        const { data: cred } = await db.from('เจ้าหนี้')
          .select('paid_amount,balance,amount').eq('id', credId).maybeSingle();
        const curPaid = parseFloat((cred && cred.paid_amount) || 0);
        const curAmt  = parseFloat((cred && cred.amount) || totalAmount || 0);
        const curBal  = parseFloat((cred && cred.balance) || balance);
        const newPaid = curPaid + payAmt;
        const newBalance = Math.max(0, curBal - payAmt);
        const newStatus = newBalance <= 0 ? 'ชำระแล้ว' : 'ค้างชำระ';

        const updRes = await db.from('เจ้าหนี้').update({
          paid_amount: newPaid, balance: newBalance, status: newStatus
        }).eq('id', credId);
        if (updRes.error) throw new Error(updRes.error.message);

        // Log as expense
        await db.from('รายจ่าย').insert({
          description: 'ชำระเจ้าหนี้ ' + suppName,
          amount: payAmt, category: 'ซื้อสินค้า',
          method: value.method, date: new Date().toISOString(),
          staff_name: (typeof v9Staff === 'function' ? v9Staff() : (typeof USER !== 'undefined' && USER ? USER.username : null)),
          note: value.note || null
        });

        if (typeof toast === 'function') toast('ชำระเจ้าหนี้ ฿' + formatNum(payAmt) + ' สำเร็จ', 'success');
        if (typeof logActivity === 'function') logActivity('ชำระเจ้าหนี้', suppName + ' ฿' + formatNum(payAmt));

        // Refresh whichever creditor list the user currently sees
        const payablePage = document.getElementById('page-payable');
        const apPage = document.getElementById('page-ap');
        if (payablePage && !payablePage.classList.contains('hidden') && typeof window.renderPayables === 'function') {
          await window.renderPayables();
        } else if (apPage && !apPage.classList.contains('hidden') && typeof window.renderCreditors === 'function') {
          await window.renderCreditors();
        } else {
          // Fallback: refresh both if available
          if (typeof window.renderPayables === 'function') await window.renderPayables();
          if (typeof window.renderCreditors === 'function') window.renderCreditors();
        }
      } catch (err) {
        console.error('[v33-fixes] v9PayCreditor error:', err);
        if (typeof toast === 'function') toast('บันทึกไม่สำเร็จ: ' + (err && err.message ? err.message : err), 'error');
      } finally {
        window.hideLoading();
      }
    };
  }

  // ────────────────────────────────────────────
  // OVERRIDE: renderCart — replace −/+ buttons with a numeric input.
  //   + setCartQty(id, qty, unit) helper sets qty directly.
  //   Barcode scanning and product-image-click still go through addToCart.
  // ────────────────────────────────────────────
  if (!document.getElementById('v33-qty-input-css')) {
    const css2 = document.createElement('style');
    css2.id = 'v33-qty-input-css';
    css2.textContent = `
      .cart-item-controls.v33-qty {
        display: flex; align-items: center; justify-content: center;
        min-width: 72px;
      }
      .v33-qty-input {
        width: 60px; height: 32px;
        text-align: center;
        font-size: 14px; font-weight: 700;
        color: #1e293b;
        border: 1.5px solid #e2e8f0;
        border-radius: 8px;
        background: #fff;
        outline: none;
        font-family: inherit;
        padding: 0 4px;
        transition: border-color 0.15s, box-shadow 0.15s;
        -moz-appearance: textfield;
        appearance: textfield;
      }
      .v33-qty-input::-webkit-outer-spin-button,
      .v33-qty-input::-webkit-inner-spin-button {
        -webkit-appearance: none; margin: 0;
      }
      .v33-qty-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
      }
    `;
    document.head.appendChild(css2);
  }

  window.setCartQty = function (productId, newQty, unitName) {
    if (typeof cart === 'undefined') return;
    const item = unitName
      ? cart.find(c => c.id === productId && c.unit === unitName)
      : cart.find(c => c.id === productId);
    if (!item) return;

    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty <= 0) {
      window.cart = cart.filter(c => !(c.id === productId && c.unit === item.unit));
    } else {
      const conv = parseFloat(item.conv_rate || 1);
      const newBaseQty = qty * conv;
      if (!item.is_mto && newBaseQty > parseFloat(item.stock || 0)) {
        if (typeof toast === 'function') toast('สินค้าไม่เพียงพอ', 'warning');
        item.qty = parseFloat(item.stock || 0) / conv;
      } else {
        item.qty = qty;
      }
    }
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderProductGrid === 'function') renderProductGrid();
    if (typeof sendToDisplay === 'function') {
      sendToDisplay({ type: 'cart', cart: window.cart, total: typeof getCartTotal === 'function' ? getCartTotal() : 0 });
    }
  };

  function installRenderCartOverride() {
    window.renderCart = function () {
      const container = document.getElementById('cart-list');
      const countBadge = document.getElementById('cart-count');
      const totalDisplay = document.getElementById('pos-total');
      const checkoutBtn = document.getElementById('checkout-btn');
      if (!container) return;

      const totalItems = cart.reduce((s, c) => s + c.qty, 0);
      const total = typeof getCartTotal === 'function' ? getCartTotal() : cart.reduce((s, c) => s + (c.price * c.qty), 0);
      if (countBadge) countBadge.textContent = parseFloat(totalItems.toFixed(4));
      if (totalDisplay) totalDisplay.textContent = '฿' + formatNum(Math.round(total));
      if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

      if (cart.length === 0) {
        container.innerHTML = '<div class="cart-empty">' +
          '<i class="material-icons-round">shopping_basket</i>' +
          '<p>ไม่มีสินค้าในตะกร้า</p>' +
          '<span>เลือกสินค้าจากรายการด้านซ้าย</span>' +
          '</div>';
        return;
      }

      container.innerHTML = cart.map((item) => {
        const conv = parseFloat(item.conv_rate || 1);
        const baseQty = parseFloat((item.qty * conv).toFixed(4));
        const baseUnit = item.unit;
        const showUnit = conv !== 1;
        const unitAttr = String(item.unit || '').replace(/'/g, "\\'");
        return '' +
          '<div class="cart-item" style="border-radius:10px;margin-bottom:4px;">' +
            '<div class="cart-item-info" style="flex:1;min-width:0;">' +
              '<span class="cart-item-name" style="display:block;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
                item.name +
                (conv !== 1 ? '<span style="font-size:10px;background:#fff5f5;color:var(--primary);padding:1px 5px;border-radius:4px;margin-left:4px;">' + baseUnit + '</span>' : '') +
              '</span>' +
              '<span class="cart-item-price" style="font-size:12px;color:var(--text-tertiary);">' +
                '฿' + formatNum(item.price) + '/' + baseUnit + ' × ' + item.qty +
                (showUnit ? '<span style="color:var(--text-tertiary);font-size:11px;"> = ' + baseQty + ' ' + (item.unit.replace(baseUnit, '').trim() || '') + '... </span>' : '') +
              '</span>' +
            '</div>' +
            '<div class="cart-item-controls v33-qty">' +
              '<input type="number" class="v33-qty-input" ' +
                'value="' + item.qty + '" min="0" step="any" ' +
                'onclick="event.stopPropagation(); this.select();" ' +
                'onchange="setCartQty(\'' + item.id + '\',this.value,\'' + unitAttr + '\')" ' +
                'onkeydown="if(event.key===\'Enter\'){this.blur();}">' +
            '</div>' +
            '<span class="cart-item-total">฿' + formatNum(Math.round(item.price * item.qty)) + '</span>' +
            '<button class="cart-item-delete" onclick="removeFromCart(\'' + item.id + '\',\'' + unitAttr + '\')">' +
              '<i class="material-icons-round">close</i>' +
            '</button>' +
          '</div>';
      }).join('');
    };
  }

  // ────────────────────────────────────────────
  // Auto-wrap render functions with loading overlay
  // (so every data load shows the spinner)
  // ────────────────────────────────────────────
  function wrapRender(name, msg) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    if (orig.__v33wrapped) return;
    const wrapped = async function () {
      window.showLoading(msg || 'กำลังโหลดข้อมูล...');
      try { return await orig.apply(this, arguments); }
      finally { window.hideLoading(); }
    };
    wrapped.__v33wrapped = true;
    window[name] = wrapped;
  }

  function installRenderWrappers() {
    const renders = [
      ['renderPayables',   'กำลังโหลดเจ้าหนี้...'],
      ['renderDebts',      'กำลังโหลดลูกค้าค้างชำระ...'],
      ['renderCustomers',  'กำลังโหลดลูกค้า...'],
      ['renderExpenses',   'กำลังโหลดรายจ่าย...'],
      ['renderPurchases',  'กำลังโหลดรายการรับสินค้า...'],
      ['renderInventory',  'กำลังโหลดคลังสินค้า...'],
      ['renderDashboard',  'กำลังโหลดรายงาน...'],
      ['renderDashboardV3','กำลังโหลดรายงาน...'],
      ['renderAttendance', 'กำลังโหลดพนักงาน...'],
      ['renderPayrollV26', 'กำลังคำนวณเงินเดือน...'],
      ['renderPayroll',    'กำลังคำนวณเงินเดือน...'],
      ['renderQuotations', 'กำลังโหลดใบเสนอราคา...'],
      ['renderProjects',   'กำลังโหลดโครงการ...'],
      ['renderCashDrawer', 'กำลังโหลดลิ้นชักเงินสด...'],
      ['renderReport',     'กำลังโหลดรายงาน...'],
      ['renderHistory',    'กำลังโหลดประวัติ...'],
      ['renderActivityLog','กำลังโหลดประวัติกิจกรรม...'],
      ['updateHomeStats',  'กำลังโหลดหน้าหลัก...'],
      ['renderAdmin',      'กำลังโหลด...']
    ];
    renders.forEach(function (pair) { wrapRender(pair[0], pair[1]); });
  }

  // ────────────────────────────────────────────
  // FIX: Cash drawer denomination ↔ balance mismatch.
  //   The original v32 _loadDrawer only subtracts for outgoing transactions
  //   that carry `denominations`. Many outflows (sales change, withdrawals
  //   without wizard, etc.) don't record denominations, so the bottom
  //   "แบงค์/เหรียญในลิ้นชัก" chip ends up HIGHER than the hero balance.
  //   After renderCashDrawer finishes, we reconcile: if denom-sum > balance,
  //   greedily remove bills/coins (largest first) until sums match.
  // ────────────────────────────────────────────
  const V33_DENOMS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
  const V33_BILL_META = {
    1000: { l: '1,000', bg: '#bda48d', type: 'bill' },
    500:  { l: '500',   bg: '#9a25ae', type: 'bill' },
    100:  { l: '100',   bg: '#ba1a1a', type: 'bill' },
    50:   { l: '50',    bg: '#0061a4', type: 'bill' },
    20:   { l: '20',    bg: '#006e1c', type: 'bill' },
    10:   { l: '10',    bg: 'linear-gradient(135deg,#FFD54F,#FFB300)', type: 'coin' },
    5:    { l: '5',     bg: 'linear-gradient(135deg,#CFD8DC,#90A4AE)', type: 'coin' },
    2:    { l: '2',     bg: 'linear-gradient(135deg,#FFD54F,#FBC02D)', type: 'coin' },
    1:    { l: '1',     bg: 'linear-gradient(135deg,#CFD8DC,#B0BEC5)', type: 'coin' }
  };

  function v33FmtNum(n) {
    return typeof formatNum === 'function' ? formatNum(n) : Number(n || 0).toLocaleString('th-TH');
  }

  async function v33ComputeDrawer() {
    const drawer = {};
    V33_DENOMS.forEach(v => { drawer[v] = 0; });
    try {
      const sr = await db.from('cash_session').select('*').eq('status', 'open')
        .order('opened_at', { ascending: false }).limit(1).maybeSingle();
      const sess = sr && sr.data;
      if (!sess) return { drawer, balance: 0 };

      const od = sess.opening_denominations || sess.denominations || {};
      Object.keys(od).forEach(k => {
        const n = Number(k);
        if (drawer[n] !== undefined) drawer[n] += Number(od[k]) || 0;
      });

      const tr = await db.from('cash_transaction')
        .select('net_amount,direction,denominations,change_denominations')
        .eq('session_id', sess.id);
      const txs = (tr.data) || [];

      let balance = sess.opening_amt || 0;
      txs.forEach(tx => {
        balance += tx.direction === 'in' ? Number(tx.net_amount || 0) : -Number(tx.net_amount || 0);
        const den = tx.denominations || {};
        const chg = tx.change_denominations || {};
        V33_DENOMS.forEach(v => {
          if (tx.direction === 'in') {
            drawer[v] += Number(den[v]) || 0;
            drawer[v] -= Number(chg[v]) || 0;
          } else {
            drawer[v] -= Number(den[v]) || 0;
            drawer[v] += Number(chg[v]) || 0;
          }
        });
      });
      V33_DENOMS.forEach(v => { if (drawer[v] < 0) drawer[v] = 0; });

      // Reconcile: if denom-sum doesn't match balance, greedily remove
      // from largest denominations until it does (outflows without
      // denomination data still need to be reflected).
      let denomSum = V33_DENOMS.reduce((s, v) => s + v * drawer[v], 0);
      let diff = denomSum - balance;
      if (diff > 0) {
        for (const v of V33_DENOMS) {
          while (diff >= v && drawer[v] > 0) {
            drawer[v] -= 1;
            diff -= v;
          }
          if (diff <= 0) break;
        }
      }
      return { drawer, balance };
    } catch (e) {
      console.warn('[v33-fixes] computeDrawer error:', e);
      return { drawer, balance: 0 };
    }
  }

  function v33RenderDenomList(drawer, balance) {
    const list = document.getElementById('v32-denom-list');
    const tot  = document.getElementById('v32-denom-total');
    if (!list) return;
    let html = '';
    let sum  = 0;
    V33_DENOMS.forEach(v => {
      const qty = drawer[v] || 0;
      if (qty <= 0) return;
      const m = V33_BILL_META[v];
      sum += v * qty;
      if (m.type === 'bill') {
        html +=
          '<div class="v32dc-chip" style="background:' + m.bg + ';">' +
            '<div class="dc-val">฿' + m.l + '</div>' +
            '<div class="dc-qty">' + qty + ' ใบ</div>' +
            '<div class="dc-sub">฿' + v33FmtNum(v * qty) + '</div>' +
          '</div>';
      } else {
        html +=
          '<div class="v32dc-chip" style="background:rgba(0,0,0,.06);border:1.5px solid #ddd;">' +
            '<div class="v32dc-coin" style="background:' + m.bg + ';">' +
              '<span style="color:#3e2723;font-size:13px;font-weight:900;">' + m.l + '</span>' +
            '</div>' +
            '<div class="dc-qty" style="color:#555;">' + qty + 'x</div>' +
            '<div class="dc-sub" style="color:#777;">฿' + v33FmtNum(v * qty) + '</div>' +
          '</div>';
      }
    });
    list.innerHTML = html || '<p style="color:#9e9e9e;font-size:13px;padding:8px 0;">ไม่มีข้อมูล denomination</p>';
    if (tot) tot.textContent = '฿' + v33FmtNum(sum);
  }

  function installCashDrawerReconcile() {
    const orig = window.renderCashDrawer;
    if (typeof orig !== 'function' || orig.__v33reconciled) return;
    const wrapped = async function () {
      const r = await orig.apply(this, arguments);
      try {
        const { drawer, balance } = await v33ComputeDrawer();
        v33RenderDenomList(drawer, balance);
      } catch (e) { console.warn('[v33-fixes] reconcile failed', e); }
      return r;
    };
    wrapped.__v33reconciled = true;
    wrapped.__v33wrapped = orig.__v33wrapped; // preserve loading-wrap flag
    window.renderCashDrawer = wrapped;
  }

  // ────────────────────────────────────────────
  // DASHBOARD — premium restyle.
  //   We DON'T touch calculations. We inject a richer CSS layer on top of
  //   dashboard-v3.js and add a "Thai executive summary" banner after each
  //   render, reading values back from the KPI DOM.
  // ────────────────────────────────────────────
  if (!document.getElementById('v33-dash-css')) {
    const css3 = document.createElement('style');
    css3.id = 'v33-dash-css';
    css3.textContent = `
      .dash-v3-container {
        padding: 32px 28px !important;
        background:
          radial-gradient(1200px 500px at 10% -10%, rgba(99,102,241,0.07), transparent 60%),
          radial-gradient(1000px 400px at 90% 0%, rgba(236,72,153,0.05), transparent 60%),
          linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%) !important;
        border-radius: 24px !important;
        min-height: calc(100vh - 80px) !important;
      }
      .dash-v3-header { margin-bottom: 20px !important; }
      .dash-v3-icon-box { box-shadow: 0 16px 32px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.25) !important; }
      .dash-v3-filter-group {
        box-shadow: 0 12px 36px rgba(15,23,42,0.08), 0 2px 8px rgba(15,23,42,0.04) !important;
        border: 1px solid rgba(226,232,240,0.9) !important;
      }
      .dash-v3-btn-per.active {
        background: linear-gradient(135deg, #4f46e5, #7c3aed) !important;
        box-shadow: 0 8px 20px rgba(79,70,229,0.42) !important;
      }

      /* Executive summary banner */
      .v33-dash-hero {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #312e81 100%);
        color: #fff;
        border-radius: 22px;
        padding: 24px 28px;
        margin-bottom: 24px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 20px;
        align-items: center;
        box-shadow: 0 20px 48px rgba(15,23,42,0.25);
        position: relative;
        overflow: hidden;
      }
      .v33-dash-hero::before {
        content: '';
        position: absolute;
        top: -40%; right: -10%;
        width: 420px; height: 420px;
        background: radial-gradient(circle, rgba(168,85,247,0.35), transparent 70%);
        border-radius: 50%;
        pointer-events: none;
      }
      .v33-dash-hero-title {
        font-size: 13px; font-weight: 700;
        color: rgba(255,255,255,0.7);
        letter-spacing: 0.6px; text-transform: uppercase;
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 10px;
      }
      .v33-dash-hero-msg {
        font-size: 17px; font-weight: 600;
        color: #e2e8f0; line-height: 1.65;
        max-width: 720px; position: relative;
      }
      .v33-dash-hero-msg b { color: #fff; font-weight: 800; }
      .v33-dash-hero-score {
        position: relative;
        text-align: right;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 18px;
        padding: 16px 22px;
        min-width: 180px;
        backdrop-filter: blur(6px);
      }
      .v33-dash-hero-score .lbl {
        font-size: 11px; font-weight: 700;
        color: rgba(255,255,255,0.65);
        letter-spacing: 0.5px; text-transform: uppercase;
      }
      .v33-dash-hero-score .val {
        font-size: 32px; font-weight: 900;
        letter-spacing: -1px; margin-top: 4px;
      }
      .v33-dash-hero-score .badge {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 11px; font-weight: 800;
        padding: 4px 10px; border-radius: 99px;
        margin-top: 6px;
      }

      /* KPI card refinements */
      .dash-v3-kpi-grid { gap: 18px !important; }
      .dash-v3-card {
        border-radius: 22px !important;
        box-shadow: 0 6px 24px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.04) !important;
        border: 1px solid rgba(226,232,240,0.9) !important;
      }
      .dash-v3-card:hover {
        box-shadow: 0 24px 48px rgba(15,23,42,0.10) !important;
      }
      .dash-v3-card::before { width: 6px !important; }

      /* P&L / CF rows polish */
      .dash-v3-row { padding: 14px 16px !important; border-radius: 10px !important; }
      .pl-line-item { font-size: 14.5px !important; }
      .pl-line-val  { font-size: 15.5px !important; }

      /* Net box punchier */
      .dash-v3-net-box {
        background: linear-gradient(135deg, var(--card-bg-sub, #0ea5e9), color-mix(in srgb, var(--card-bg-sub, #0ea5e9) 70%, #000)) !important;
        border-radius: 20px !important;
        padding: 22px 26px !important;
        box-shadow: 0 18px 40px rgba(15,23,42,0.20) !important;
        border: none !important;
      }

      /* Chart bars smoother */
      .dash-v3-bar { border-radius: 8px 8px 0 0 !important; box-shadow: 0 2px 8px rgba(15,23,42,0.10); }

      @media(max-width: 700px) {
        .v33-dash-hero { grid-template-columns: 1fr; }
        .v33-dash-hero-score { text-align: left; min-width: 0; }
      }
    `;
    document.head.appendChild(css3);
  }

  function v33ParseAmount(text) {
    if (!text) return 0;
    const negative = text.includes('−') || text.includes('-');
    const digits = String(text).replace(/[^\d.]/g, '');
    const n = parseFloat(digits) || 0;
    return negative ? -n : n;
  }

  function v33BuildDashHero() {
    const container = document.querySelector('#page-dash .dash-v3-container');
    if (!container) return;
    const kpiGrid = document.getElementById('dash-v3-kpi-container');
    if (!kpiGrid) return;

    const cards = kpiGrid.querySelectorAll('.dash-v3-card');
    if (cards.length < 4) return; // still skeleton

    const vals = Array.from(cards).map(c => {
      const amtEl = c.querySelector('div[style*="font-size: 26px"]') || c.querySelector('div[style*="font-size:26px"]');
      return v33ParseAmount(amtEl ? amtEl.textContent : '');
    });
    // The cards are: [ยอดขายจริงสุทธิ, ต้นทุนขาย, รอเก็บเงินปลายทาง, กำไรสุทธิ, สภาพคล่อง]
    const [revenue, cogs, codAmt, net, liquidity] = vals;
    const margin = revenue > 0 ? Math.round((net / revenue) * 100) : 0;

    let tone, icon, msg;
    if (revenue === 0) {
      tone = '#94a3b8';
      icon = 'hourglass_empty';
      msg = 'ยังไม่มีข้อมูลรายได้ในช่วงเวลานี้ — ลองเลือกช่วงเวลาที่มีการขายเพื่อดูภาพรวมธุรกิจอย่างละเอียด';
    } else if (net >= 0 && liquidity >= 0) {
      tone = '#10b981';
      icon = 'trending_up';
      msg = 'ช่วงนี้ร้าน <b>ทำกำไร</b> ได้ดี รายได้ <b>฿' + v33FmtNum(Math.abs(Math.round(revenue))) +
            '</b> ต้นทุน <b>฿' + v33FmtNum(Math.abs(Math.round(cogs))) +
            '</b> ส่งผลให้มีกำไรสุทธิ <b>฿' + v33FmtNum(Math.abs(Math.round(net))) +
            '</b> คิดเป็น <b>Margin ' + margin + '%</b> และเงินสดหมุนเวียนเป็นบวก <b>฿' +
            v33FmtNum(Math.abs(Math.round(liquidity))) + '</b> — ร้านอยู่ในภาวะแข็งแรง';
    } else if (net >= 0 && liquidity < 0) {
      tone = '#f59e0b';
      icon = 'warning_amber';
      msg = 'ร้าน <b>มีกำไร ฿' + v33FmtNum(Math.abs(Math.round(net))) +
            '</b> (Margin ' + margin + '%) แต่ <b>สภาพคล่องติดลบ ฿' +
            v33FmtNum(Math.abs(Math.round(liquidity))) +
            '</b> — อาจเพราะไปลงสต็อกหรือจ่ายหนี้ก้อนใหญ่ ควรเฝ้าติดตามเงินสดในลิ้นชัก';
    } else if (net < 0 && liquidity >= 0) {
      tone = '#0ea5e9';
      icon = 'info';
      msg = 'เงินสดยังหมุนเวียนได้ดี <b>฿' + v33FmtNum(Math.abs(Math.round(liquidity))) +
            '</b> แต่ <b>กำไรทางบัญชีติดลบ ฿' + v33FmtNum(Math.abs(Math.round(net))) +
            '</b> — รายได้ที่รับเข้ายังไม่ครอบคลุมต้นทุนและค่าใช้จ่าย ควรทบทวนราคาขายหรือควบคุมค่าใช้จ่าย';
    } else {
      tone = '#ef4444';
      icon = 'trending_down';
      msg = 'ช่วงนี้ร้าน <b>ขาดทุน ฿' + v33FmtNum(Math.abs(Math.round(net))) +
            '</b> และ <b>เงินสดติดลบ ฿' + v33FmtNum(Math.abs(Math.round(liquidity))) +
            '</b> — ควรรีบทบทวนโครงสร้างต้นทุน ราคาขาย และการเก็บหนี้อย่างเร่งด่วน';
    }

    const netSign = net < 0 ? '−' : '';
    const liqBadgeTxt = liquidity >= 0 ? 'เงินสดเพิ่ม' : 'เงินสดลด';
    const liqBadgeBg  = liquidity >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
    const liqBadgeCol = liquidity >= 0 ? '#6ee7b7' : '#fca5a5';

    let hero = document.getElementById('v33-dash-hero');
    if (!hero) {
      hero = document.createElement('div');
      hero.id = 'v33-dash-hero';
      hero.className = 'v33-dash-hero';
      const header = container.querySelector('.dash-v3-header');
      if (header && header.nextSibling) container.insertBefore(hero, header.nextSibling);
      else container.insertBefore(hero, container.firstChild);
    }

    hero.innerHTML =
      '<div>' +
        '<div class="v33-dash-hero-title">' +
          '<i class="material-icons-round" style="font-size:18px;color:' + tone + ';">' + icon + '</i>' +
          '<span>สรุปภาพรวมช่วงเวลานี้</span>' +
        '</div>' +
        '<div class="v33-dash-hero-msg">' + msg + '</div>' +
      '</div>' +
      '<div class="v33-dash-hero-score">' +
        '<div class="lbl">กำไรสุทธิ</div>' +
        '<div class="val" style="color:' + (net >= 0 ? '#6ee7b7' : '#fca5a5') + ';">' +
          netSign + '฿' + v33FmtNum(Math.abs(Math.round(net))) +
        '</div>' +
        '<span class="badge" style="background:' + liqBadgeBg + ';color:' + liqBadgeCol + ';">' +
          '<i class="material-icons-round" style="font-size:12px;">' +
            (liquidity >= 0 ? 'arrow_upward' : 'arrow_downward') + '</i>' +
          liqBadgeTxt + ' ฿' + v33FmtNum(Math.abs(Math.round(liquidity))) +
        '</span>' +
      '</div>';
  }

  function installDashboardEnhance() {
    const orig = window.renderDashboardV3;
    if (typeof orig !== 'function' || orig.__v33dashenhanced) return;
    const wrapped = async function () {
      const r = await orig.apply(this, arguments);
      // KPIs populate asynchronously inside loadData; poll briefly.
      let tries = 0;
      const t = setInterval(function () {
        tries++;
        const grid = document.getElementById('dash-v3-kpi-container');
        const cards = grid ? grid.querySelectorAll('.dash-v3-card') : [];
        if (cards.length >= 4) {
          v33BuildDashHero();
          clearInterval(t);
        } else if (tries > 40) {
          clearInterval(t);
        }
      }, 150);
      return r;
    };
    wrapped.__v33dashenhanced = true;
    wrapped.__v33wrapped = orig.__v33wrapped;
    window.renderDashboardV3 = wrapped;

    // Also react to filter/refresh clicks: rebuild hero after KPIs refresh.
    document.addEventListener('click', function (e) {
      const btn = e.target.closest && e.target.closest('.dash-v3-btn-per');
      if (!btn) return;
      let tries = 0;
      const t = setInterval(function () {
        tries++;
        const grid = document.getElementById('dash-v3-kpi-container');
        const cards = grid ? grid.querySelectorAll('.dash-v3-card') : [];
        if (cards.length >= 4 && !(grid.innerHTML || '').includes('dash-v3-skeleton')) {
          v33BuildDashHero();
          clearInterval(t);
        } else if (tries > 40) clearInterval(t);
      }, 150);
    });
  }

  // ════════════════════════════════════════════
  // UNIVERSAL CASH-OUT DENOMINATION WIZARD
  //   Every cash-out recorded via recordCashTx must carry `denominations`
  //   so the drawer stays in sync. If the caller didn't pass denominations,
  //   pop the v32 wizard with `mustBeExact: true` to force the user to count
  //   the exact bills/coins leaving the drawer.
  //
  //   Covers: bill refund (v10), bill cancel (v20), salary payment (v26),
  //   creditor payment (v9), and any future out-flow.
  // ════════════════════════════════════════════
  if (!document.getElementById('v33-wizard-z-css')) {
    const cz = document.createElement('style');
    cz.id = 'v33-wizard-z-css';
    // Push the wizard overlay above the v33 loading overlay
    cz.textContent = '.v27ov{z-index:2147483647 !important;}';
    document.head.appendChild(cz);
  }

  async function v33WizardOut(amount, title, subtitle) {
    if (!amount || amount <= 0) return null;
    if (typeof window.v32ShowDenomWizard !== 'function') return null;
    if (typeof window.v32LoadDrawer !== 'function') return null;

    // Temporarily hide v33 loading overlay so wizard can take focus
    const wasLoading = overlay && overlay.classList.contains('v33-active');
    if (wasLoading) overlay.classList.remove('v33-active');

    let drawer, balance;
    try {
      drawer = await window.v32LoadDrawer();
      balance = Object.keys(drawer).reduce((s, k) => s + Number(k) * (drawer[k] || 0), 0);
    } catch (e) { drawer = null; balance = 0; }

    const counts = await window.v32ShowDenomWizard({
      title: title || 'นับเงินจ่ายออกจากลิ้นชัก',
      subtitle: subtitle || 'เลือกแบงค์/เหรียญที่จะจ่ายออก — ต้องตรงยอดเป๊ะ ห้ามขาดห้ามเกิน',
      icon: '<i class="material-icons-round">payments</i>',
      targetAmount: amount,
      mustBeExact: true,
      drawer: drawer || undefined,
      showBalance: true, balance: balance,
      dir: 'out',
      confirmText: '✅ ยืนยันจ่าย ฿' + v33FmtNum(amount),
      cancelText: 'ข้าม (ไม่นับ)'
    });

    if (wasLoading) overlay.classList.add('v33-active');
    return counts || null;
  }

  function installRecordCashTxWrapper() {
    const orig = window.recordCashTx;
    if (typeof orig !== 'function') return;
    if (orig.__v33wrapped_out) return;

    const wrapped = async function (args) {
      try {
        const dir = args && args.direction;
        const amt = Number((args && (args.amount || args.netAmount)) || 0);
        const hasDen = args && args.denominations && Object.keys(args.denominations).length > 0;
        const skipWiz = args && args.__v33skipWizard === true;

        if (dir === 'out' && amt > 0 && !hasDen && !skipWiz) {
          const typeLabel = (args && args.type) || 'จ่ายเงิน';
          const noteLabel = (args && args.note) ? ' — ' + args.note : '';
          const counts = await v33WizardOut(
            amt,
            '💸 ' + typeLabel + ' ฿' + v33FmtNum(amt),
            'เลือกแบงค์/เหรียญที่จะจ่ายออกจากลิ้นชัก' + noteLabel
          );
          if (counts) {
            args.denominations = counts;
          } else {
            // User cancelled — warn + proceed (reconciliation will handle it)
            if (typeof toast === 'function') {
              toast('ไม่ได้นับแบงค์ — ระบบจะหักจากลิ้นชักอัตโนมัติ', 'warning');
            }
          }
        }
      } catch (e) { console.warn('[v33-fixes] wizard wrapper error:', e); }
      return orig.apply(this, arguments);
    };
    wrapped.__v33wrapped_out = true;
    window.recordCashTx = wrapped;
  }

  // Update v9PayCreditor override to also record a cash transaction for
  // the cash drawer (so the wizard pops + the drawer reflects the outflow).
  function installV9PayCreditorCashTx() {
    const orig = window.v9PayCreditor;
    if (typeof orig !== 'function') return;
    if (orig.__v33cashtx) return;

    // Replace with version that records cash transaction on cash payments
    window.v9PayCreditor = async function (credId, suppName, balance, totalAmount) {
      const { value, isConfirmed } = await Swal.fire({
        title: 'ชำระเจ้าหนี้: ' + suppName,
        html:
          '<div style="text-align:left;">' +
            '<div style="background:#fef2f2;border-radius:10px;padding:12px;margin-bottom:14px;' +
              'display:flex;justify-content:space-between;">' +
              '<span style="font-size:13px;color:#dc2626;">ยอดคงค้าง</span>' +
              '<span style="font-size:20px;font-weight:700;color:#dc2626;">฿' + formatNum(balance) + '</span>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">ชำระวันนี้ (฿)</label>' +
              '<input id="v9cred-pay" class="form-input" type="number" value="' + balance + '" min="1" max="' + balance + '">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">วิธีชำระ</label>' +
              '<select id="v9cred-method" class="form-input">' +
                '<option value="เงินสด">เงินสด</option>' +
                '<option value="โอนเงิน">โอนเงิน</option>' +
                '<option value="เช็ค">เช็ค</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">หมายเหตุ</label>' +
              '<input id="v9cred-note" class="form-input" placeholder="(ถ้ามี)">' +
            '</div>' +
          '</div>',
        showCancelButton: true,
        confirmButtonText: '✅ บันทึกชำระ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#15803d',
        preConfirm: () => ({
          pay: parseFloat(document.getElementById('v9cred-pay')?.value || 0),
          method: document.getElementById('v9cred-method')?.value || 'เงินสด',
          note: document.getElementById('v9cred-note')?.value || ''
        })
      });
      if (!isConfirmed || !value || !value.pay) return;

      const payAmt = Math.min(value.pay, balance);
      const isCash = value.method === 'เงินสด';

      // If cash payment: count denominations BEFORE any DB write.
      let denom = null;
      if (isCash) {
        denom = await v33WizardOut(
          payAmt,
          '💸 ชำระเจ้าหนี้ ' + suppName,
          'เลือกแบงค์/เหรียญที่จะจ่ายเจ้าหนี้ ฿' + v33FmtNum(payAmt)
        );
        if (!denom) {
          if (typeof toast === 'function') toast('ยกเลิกการชำระ', 'info');
          return;
        }
      }

      window.showLoading('กำลังบันทึกการชำระ...');
      try {
        const { data: cred } = await db.from('เจ้าหนี้')
          .select('paid_amount,balance,amount').eq('id', credId).maybeSingle();
        const curPaid = parseFloat((cred && cred.paid_amount) || 0);
        const curBal  = parseFloat((cred && cred.balance) || balance);
        const newPaid = curPaid + payAmt;
        const newBalance = Math.max(0, curBal - payAmt);
        const newStatus = newBalance <= 0 ? 'ชำระแล้ว' : 'ค้างชำระ';

        const updRes = await db.from('เจ้าหนี้').update({
          paid_amount: newPaid, balance: newBalance, status: newStatus
        }).eq('id', credId);
        if (updRes.error) throw new Error(updRes.error.message);

        // Log as expense
        const { data: expIns } = await db.from('รายจ่าย').insert({
          description: 'ชำระเจ้าหนี้ ' + suppName,
          amount: payAmt, category: 'ซื้อสินค้า',
          method: value.method, date: new Date().toISOString(),
          staff_name: (typeof v9Staff === 'function' ? v9Staff() : (typeof USER !== 'undefined' && USER ? USER.username : null)),
          note: value.note || null
        }).select().single();

        // Record cash-out with the pre-counted denominations (skip wizard re-prompt)
        if (isCash) {
          try {
            const sessRes = await db.from('cash_session').select('id').eq('status', 'open').limit(1).maybeSingle();
            const sess = sessRes && sessRes.data;
            if (sess && typeof recordCashTx === 'function') {
              await recordCashTx({
                sessionId: sess.id, type: 'ชำระเจ้าหนี้', direction: 'out',
                amount: payAmt, netAmount: payAmt,
                refId: expIns && expIns.id, refTable: 'รายจ่าย',
                denominations: denom,
                note: 'ชำระ ' + suppName + (value.note ? ' — ' + value.note : ''),
                __v33skipWizard: true
              });
            }
          } catch (e) { console.warn('[v33-fixes] creditor cash tx:', e); }
        }

        if (typeof toast === 'function') toast('ชำระเจ้าหนี้ ฿' + formatNum(payAmt) + ' สำเร็จ', 'success');
        if (typeof logActivity === 'function') logActivity('ชำระเจ้าหนี้', suppName + ' ฿' + formatNum(payAmt));

        const payablePage = document.getElementById('page-payable');
        const apPage = document.getElementById('page-ap');
        if (payablePage && !payablePage.classList.contains('hidden') && typeof window.renderPayables === 'function') {
          await window.renderPayables();
        } else if (apPage && !apPage.classList.contains('hidden') && typeof window.renderCreditors === 'function') {
          await window.renderCreditors();
        } else {
          if (typeof window.renderPayables === 'function') await window.renderPayables();
          if (typeof window.renderCreditors === 'function') window.renderCreditors();
        }
      } catch (err) {
        console.error('[v33-fixes] v9PayCreditor error:', err);
        if (typeof toast === 'function') toast('บันทึกไม่สำเร็จ: ' + (err && err.message ? err.message : err), 'error');
      } finally {
        window.hideLoading();
      }
    };
    window.v9PayCreditor.__v33cashtx = true;
  }

  // ────────────────────────────────────────────
  // FAST CHECKOUT
  //   1) Skip step-4 confirm screen — save immediately after denom confirm
  //   2) Blocking overlay + disabled buttons during save
  //   3) Parallelize v9Sale's independent DB writes for speed
  // ────────────────────────────────────────────
  function v33LockBtn(btn) {
    if (!btn || btn._v33locked) return;
    btn._v33locked = true;
    btn._v33PrevDisabled = btn.disabled;
    btn._v33PrevPE = btn.style.pointerEvents;
    btn._v33PrevOp = btn.style.opacity;
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.55';
  }
  function v33UnlockBtn(btn) {
    if (!btn || !btn._v33locked) return;
    btn.disabled = btn._v33PrevDisabled || false;
    btn.style.pointerEvents = btn._v33PrevPE || '';
    btn.style.opacity = btn._v33PrevOp || '';
    btn._v33locked = false;
  }
  function v33LockCheckoutButtons() {
    ['checkout-next', 'checkout-back', 'bc-ok-btn'].forEach(function (id) {
      v33LockBtn(document.getElementById(id));
    });
  }
  function v33UnlockCheckoutButtons() {
    ['checkout-next', 'checkout-back', 'bc-ok-btn'].forEach(function (id) {
      v33UnlockBtn(document.getElementById(id));
    });
  }

  function installFastCheckout() {
    // (1) Skip step-4 confirm: call completePayment directly after denom/method
    const _origNext = window.nextCheckoutStep;
    if (typeof _origNext === 'function' && !_origNext.__v33fast) {
      window.nextCheckoutStep = function () {
        const cs = window.checkoutState;
        try {
          // Cash at step 2 — open denom wizard, save right after confirm
          if (cs && cs.step === 2 && cs.method === 'cash' && typeof window.openDenomWizard === 'function') {
            window.openDenomWizard({
              label: 'รับเงินจากลูกค้า',
              targetAmount: cs.total - (cs.discount || 0),
              mustExact: false,
              onConfirm: async function (denomState, received) {
                cs.received = received;
                cs.change = received - cs.total;
                cs.receivedDenominations = denomState;
                if (typeof window.calcChangeDenominations === 'function' && cs.change > 0) {
                  cs.changeDenominations = window.calcChangeDenominations(cs.change);
                }
                cs.step = 4;
                v33LockCheckoutButtons();
                if (typeof window.completePayment === 'function') {
                  try { await window.completePayment(); } catch (e) { console.error(e); }
                }
              },
              onCancel: function () {}
            });
            return;
          }
          // Non-cash at step 2 — skip step 4 screen, save immediately
          if (cs && cs.step === 2 && cs.method && cs.method !== 'cash') {
            cs.received = cs.total;
            cs.change = 0;
            cs.step = 4;
            v33LockCheckoutButtons();
            if (typeof window.completePayment === 'function') {
              window.completePayment();
              return;
            }
          }
          // Standard UI step 3 cash — denom grid filled, save immediately
          if (cs && cs.step === 3 && cs.method === 'cash') {
            const received = Object.entries(cs.receivedDenominations || {})
              .reduce(function (s, kv) { return s + Number(kv[0]) * Number(kv[1] || 0); }, 0);
            if (received >= cs.total) {
              cs.received = received;
              cs.change = received - cs.total;
              if (typeof window.calcChangeDenominations === 'function') {
                cs.changeDenominations = window.calcChangeDenominations(cs.change);
              }
              cs.step = 4;
              v33LockCheckoutButtons();
              if (typeof window.completePayment === 'function') {
                window.completePayment();
                return;
              }
            }
          }
          // Step 4 — user clicked "บันทึกการขาย" directly; still lock buttons
          if (cs && cs.step === 4) {
            v33LockCheckoutButtons();
          }
        } catch (e) { console.warn('[v33-fixes] fast-checkout next:', e); }
        return _origNext.apply(this, arguments);
      };
      window.nextCheckoutStep.__v33fast = true;
    }

    // (2) Route completePayment → v9Sale (optimized by v30-fastsale).
    //     v2-patch's completePayment does sequential DB writes (slow);
    //     v9Sale does batch inserts + parallel ops (much faster).
    //     Fall back to original only if v9Sale is unavailable.
    const _origComplete = window.completePayment;
    if (typeof _origComplete === 'function' && !_origComplete.__v33fast) {
      window.completePayment = async function () {
        if (window.isProcessingPayment) return;
        v33LockCheckoutButtons();
        // Close the checkout overlay immediately so user sees progress
        if (typeof window.closeCheckout === 'function') {
          try { window.closeCheckout(); } catch (_) {}
        }
        try {
          if (typeof window.v9Sale === 'function') {
            return await window.v9Sale();
          }
          window.showLoading('กำลังบันทึกการขาย...');
          try {
            return await _origComplete.apply(this, arguments);
          } finally {
            window.hideLoading();
          }
        } catch (e) {
          console.error('[v33-fixes] completePayment error:', e);
          throw e;
        } finally {
          v33UnlockCheckoutButtons();
        }
      };
      window.completePayment.__v33fast = true;
    }

    // (3) Wrap bcConfirm — bill checkout UI
    const _origBc = window.bcConfirm;
    if (typeof _origBc === 'function' && !_origBc.__v33fast) {
      window.bcConfirm = async function () {
        if (window.isProcessingPayment) return;
        v33LockCheckoutButtons();
        window.showLoading('กำลังบันทึกการขาย...');
        try {
          return await _origBc.apply(this, arguments);
        } catch (e) {
          console.error('[v33-fixes] bcConfirm error:', e);
          throw e;
        } finally {
          window.hideLoading();
          v33UnlockCheckoutButtons();
        }
      };
      window.bcConfirm.__v33fast = true;
    }

  }

  // ────────────────────────────────────────────
  // ATTENDANCE SAVE — fix half-day bug + loading overlay
  //   Bug: v26SaveAll compared d.st === 'มาครึ่งวัน' (label),
  //        but v26Pick stores the KEY 'ครึ่งวัน'. Result: no 50% deduction.
  //   Fix: compare against the correct key 'ครึ่งวัน'.
  //   Plus: wrap with centered blocking loading overlay.
  // ────────────────────────────────────────────
  function installV26SaveAllFix() {
    if (typeof window.v26SaveAll !== 'function' || window.v26SaveAll.__v33fixed) return;
    window.v26SaveAll = async function () {
      const btn = document.getElementById('v26-save-btn');
      if (btn) { btn.classList.add('saving'); btn.innerHTML = '<i class="material-icons-round">sync</i> กำลังบันทึก...'; }
      window.showLoading('กำลังบันทึกการเช็คชื่อ...');
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      let ok = 0, skip = 0;
      try {
        // v26Att is let-scoped in modules-v26-hr.js — access via Script lexical scope (bare name), not window
        const att = (typeof v26Att !== 'undefined') ? v26Att : {};
        const entries = Object.entries(att);
        // Fetch employees in parallel for speed
        const empResults = await Promise.all(entries.map(function (kv) {
          if (!kv[1] || !kv[1].st) return Promise.resolve(null);
          return db.from('พนักงาน').select('daily_wage,salary,pay_type').eq('id', kv[0]).maybeSingle();
        }));

        const writes = [];
        entries.forEach(function (kv, idx) {
          const eid = kv[0], d = kv[1];
          if (!d.st) { skip++; return; }
          const emp = empResults[idx] ? empResults[idx].data : null;
          let ded = 0;
          if (emp && emp.pay_type === 'รายเดือน') {
            const dailyEq = (emp.salary || 0) / 30;
            if (d.st === 'ขาด') ded = dailyEq * 1;
            else if (d.st === 'ครึ่งวัน') ded = dailyEq * 0.5;   // ← FIX
            else if (d.st === 'มาสาย') ded = dailyEq * 0.05;
          } else {
            const dWage = (emp && emp.daily_wage) || 0;
            if (d.st === 'ครึ่งวัน') ded = dWage * 0.5;          // ← FIX
            else if (d.st === 'มาสาย') ded = dWage * 0.05;
          }
          ded = Math.round(ded);
          const staffName = (typeof USER !== 'undefined' && USER) ? USER.username : null;
          const rec = {
            employee_id: eid, date: today, status: d.st, deduction: ded,
            note: d.note || '', staff_name: staffName,
            time_in: d.tin || (d.st !== 'ขาด' ? now.toTimeString().slice(0, 5) : null)
          };
          if (d.aid) {
            writes.push(db.from('เช็คชื่อ').update(rec).eq('id', d.aid).then(function () { ok++; }));
          } else {
            writes.push(db.from('เช็คชื่อ').insert(rec).select().single().then(function (r) {
              if (r && r.data) att[eid].aid = r.data.id;
              ok++;
            }));
          }
        });
        await Promise.all(writes);
        if (typeof toast === 'function') {
          toast('บันทึกสำเร็จ ' + ok + ' คน' + (skip > 0 ? ' (ข้าม ' + skip + ')' : ''), 'success');
        }
        if (typeof logActivity === 'function') logActivity('เช็คชื่อพนักงาน', 'บันทึก ' + ok + ' คน');
      } catch (e) {
        console.error('[v33-fixes] v26SaveAll:', e);
        if (typeof toast === 'function') toast('Error: ' + (e.message || e), 'error');
      } finally {
        window.hideLoading();
        if (btn) { btn.classList.remove('saving'); btn.innerHTML = '<i class="material-icons-round">save</i> บันทึกทั้งหมด'; }
      }
    };
    window.v26SaveAll.__v33fixed = true;
  }

  // ────────────────────────────────────────────
  // PAYROLL PAGE — v33 Grand redesign (logic unchanged from v31)
  //   Majestic hero banner with glassmorphism + animated patterns
  //   Premium employee cards with gold/platinum accents for paid status
  //   Executive detail view with clearer input sections
  // ────────────────────────────────────────────
  function installPayrollV33() {
    // Inject premium CSS
    if (!document.getElementById('v33-payroll-css')) {
      const css = document.createElement('style');
      css.id = 'v33-payroll-css';
      css.textContent = `
        /* ═══ V33 PAYROLL — GRAND EDITION ═══ */
        .p33-wrap { max-width:1200px; margin:0 auto; padding:0 6px; font-family:'Prompt',sans-serif; }

        /* Hero banner — executive look */
        .p33-hero {
          position:relative; border-radius:28px; overflow:hidden;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #334155 100%);
          box-shadow: 0 20px 60px rgba(15,23,42,0.35), 0 2px 10px rgba(0,0,0,0.08);
          margin-bottom:28px;
        }
        .p33-hero::before {
          content:''; position:absolute; inset:0;
          background:
            radial-gradient(1200px 400px at -10% -40%, rgba(251,191,36,0.12), transparent 60%),
            radial-gradient(900px 500px at 110% 120%, rgba(99,102,241,0.15), transparent 55%),
            radial-gradient(600px 300px at 50% 0%, rgba(244,63,94,0.08), transparent 60%);
          pointer-events:none;
        }
        .p33-hero::after {
          content:''; position:absolute; inset:0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.6), transparent 70%);
          pointer-events:none;
        }
        .p33-hero-body { position:relative; z-index:2; padding:34px 38px 26px; }
        .p33-hero-top { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:26px; }
        .p33-hero-left { display:flex; align-items:center; gap:18px; }
        .p33-back {
          display:inline-flex; align-items:center; gap:8px;
          padding:11px 18px; background:rgba(255,255,255,0.08);
          border:1px solid rgba(255,255,255,0.15); border-radius:14px;
          color:#fff; font-size:13px; font-weight:700; cursor:pointer;
          backdrop-filter:blur(12px); transition:all 0.18s; font-family:inherit;
        }
        .p33-back:hover { background:rgba(255,255,255,0.16); transform:translateX(-3px); }
        .p33-back i { font-size:17px; }
        .p33-title-crumb {
          font-size:10.5px; color:rgba(251,191,36,0.9); letter-spacing:2.4px;
          text-transform:uppercase; font-weight:800; margin-bottom:6px;
        }
        .p33-title-main {
          display:flex; align-items:center; gap:14px;
          font-size:30px; font-weight:900; color:#fff; letter-spacing:-0.8px;
          margin-bottom:4px;
        }
        .p33-title-main .p33-gold-ico {
          width:46px; height:46px; border-radius:14px;
          background: linear-gradient(135deg,#fbbf24,#f59e0b,#d97706);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 8px 20px rgba(245,158,11,0.4);
        }
        .p33-title-main .p33-gold-ico i { color:#fff; font-size:26px; }
        .p33-title-sub { font-size:14px; color:rgba(255,255,255,0.6); font-weight:500; }

        .p33-headline-total {
          background: linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.08));
          border:1px solid rgba(251,191,36,0.25);
          border-radius:20px; padding:18px 28px; min-width:240px;
          backdrop-filter:blur(16px); text-align:right;
        }
        .p33-headline-label {
          font-size:10.5px; color:rgba(251,191,36,0.85); letter-spacing:1.5px;
          text-transform:uppercase; font-weight:800; margin-bottom:6px;
        }
        .p33-headline-val {
          font-size:36px; font-weight:900; color:#fef3c7; letter-spacing:-1.2px;
          text-shadow:0 2px 20px rgba(251,191,36,0.3);
        }

        /* Stats row */
        .p33-stats {
          display:grid; grid-template-columns:repeat(4,1fr); gap:1px;
          background:rgba(255,255,255,0.06); border-top:1px solid rgba(255,255,255,0.08);
          position:relative; z-index:2;
        }
        .p33-stat {
          padding:18px 20px; background:linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.28));
          position:relative; overflow:hidden;
        }
        .p33-stat::before {
          content:''; position:absolute; top:0; left:0; right:0; height:2px;
          background:linear-gradient(90deg, transparent, var(--stc,#fff), transparent);
          opacity:0.6;
        }
        .p33-stat.--emp { --stc:#818cf8; }
        .p33-stat.--paid { --stc:#34d399; }
        .p33-stat.--pending { --stc:#fbbf24; }
        .p33-stat.--sum { --stc:#f472b6; }
        .p33-stat-ico { font-size:18px; margin-bottom:6px; opacity:0.7; }
        .p33-stat-lbl { font-size:10.5px; color:rgba(255,255,255,0.55); font-weight:700;
          text-transform:uppercase; letter-spacing:1.2px; margin-bottom:5px; }
        .p33-stat-val { font-size:22px; font-weight:900; color:#fff; letter-spacing:-0.5px; }
        .p33-stat-sub { font-size:10.5px; color:rgba(255,255,255,0.4); margin-top:3px; font-weight:500; }

        /* Section header */
        .p33-section-hd {
          display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; padding:0 4px;
        }
        .p33-section-t { font-size:18px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:10px; }
        .p33-section-t::before {
          content:''; width:4px; height:22px;
          background:linear-gradient(180deg,#f59e0b,#d97706); border-radius:3px;
        }

        /* Grid */
        .p33-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:20px; }

        /* Card */
        .p33-card {
          position:relative; background:#fff; border-radius:24px; padding:24px;
          border:1.5px solid rgba(15,23,42,0.05);
          box-shadow: 0 4px 20px rgba(15,23,42,0.05);
          cursor:pointer; transition: all 0.28s cubic-bezier(.4,0,.2,1);
          overflow:hidden;
        }
        .p33-card:hover {
          transform:translateY(-6px);
          box-shadow:0 20px 50px rgba(15,23,42,0.14);
          border-color:rgba(251,191,36,0.45);
        }
        .p33-card.--paid {
          background:linear-gradient(165deg, #fffbeb 0%, #fff 55%);
          border-color:rgba(251,191,36,0.45);
        }
        .p33-card.--paid::before {
          content:''; position:absolute; top:0; left:0; right:0; height:5px;
          background:linear-gradient(90deg, #fbbf24, #f59e0b, #d97706, #f59e0b, #fbbf24);
        }
        .p33-card.--pending::before {
          content:''; position:absolute; top:0; left:0; right:0; height:5px;
          background:linear-gradient(90deg, #64748b, #94a3b8, #64748b);
        }
        .p33-card-shine {
          position:absolute; top:-40%; right:-40%; width:180px; height:180px;
          border-radius:50%; background:radial-gradient(circle, rgba(251,191,36,0.1) 0%, transparent 70%);
          pointer-events:none;
        }

        .p33-card-hd { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
        .p33-ava {
          width:58px; height:58px; border-radius:18px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          font-size:28px; color:#fff; font-weight:800;
          background:linear-gradient(135deg,#6366f1,#4f46e5,#4338ca);
          box-shadow:0 8px 20px rgba(99,102,241,0.3);
        }
        .p33-card.--paid .p33-ava {
          background:linear-gradient(135deg,#fbbf24,#f59e0b,#d97706);
          box-shadow:0 8px 20px rgba(245,158,11,0.35);
        }
        .p33-emp-info { flex:1; min-width:0; }
        .p33-emp-name { font-size:16px; font-weight:800; color:#0f172a;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:-0.3px; }
        .p33-emp-meta { font-size:12px; color:#64748b; font-weight:500; margin-top:3px;
          display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .p33-badge {
          display:inline-flex; align-items:center; gap:4px;
          padding:5px 10px; border-radius:99px; font-size:10.5px; font-weight:800;
          text-transform:uppercase; letter-spacing:0.4px; flex-shrink:0;
        }
        .p33-badge.--paid { background:linear-gradient(135deg,#fef3c7,#fde68a); color:#92400e; }
        .p33-badge.--pending { background:#f1f5f9; color:#64748b; }
        .p33-badge i { font-size:13px; }

        .p33-card-stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
        .p33-stat-box {
          padding:12px 14px; border-radius:14px;
          background:linear-gradient(160deg,#f8fafc,#f1f5f9);
          border:1px solid #e2e8f0;
        }
        .p33-sb-lbl { font-size:10.5px; color:#94a3b8; font-weight:700;
          text-transform:uppercase; letter-spacing:0.6px; margin-bottom:4px; }
        .p33-sb-val { font-size:18px; font-weight:900; color:#0f172a; letter-spacing:-0.3px; }
        .p33-sb-val.--warn { color:#d97706; }

        .p33-card-ft {
          display:flex; justify-content:space-between; align-items:center;
          padding-top:14px; border-top:1.5px dashed #e2e8f0;
        }
        .p33-ft-lbl { font-size:11px; color:#64748b; font-weight:700;
          text-transform:uppercase; letter-spacing:0.8px; }
        .p33-ft-val-wrap { display:flex; align-items:center; gap:8px; }
        .p33-ft-val { font-size:22px; font-weight:900; color:#059669; letter-spacing:-0.5px; }
        .p33-card.--paid .p33-ft-val { color:#b45309; }
        .p33-ft-arr {
          color:#94a3b8; background:#f1f5f9; border-radius:50%;
          padding:4px; font-size:18px !important; transition:all 0.2s;
        }
        .p33-card:hover .p33-ft-arr { background:#0f172a; color:#fff; transform:translateX(3px); }

        /* DETAIL VIEW */
        .p33-detail-back {
          display:inline-flex; align-items:center; gap:8px;
          padding:11px 20px; background:#fff; border:1.5px solid #e2e8f0;
          border-radius:14px; color:#334155; font-size:13px; font-weight:800;
          cursor:pointer; margin-bottom:20px; font-family:inherit;
          transition:all 0.18s;
        }
        .p33-detail-back:hover { background:#0f172a; color:#fff; border-color:#0f172a; }
        .p33-detail-card {
          background:#fff; border-radius:28px; overflow:hidden;
          border:1.5px solid #e2e8f0; box-shadow:0 8px 30px rgba(15,23,42,0.06);
        }
        .p33-dt-head {
          position:relative; padding:36px 32px 80px;
          background:linear-gradient(135deg,#0f172a 0%, #1e293b 60%, #334155 100%);
          color:#fff; text-align:center; overflow:hidden;
        }
        .p33-dt-head::before {
          content:''; position:absolute; inset:0;
          background:
            radial-gradient(600px 300px at 50% 0%, rgba(251,191,36,0.15), transparent 60%),
            radial-gradient(400px 200px at 20% 100%, rgba(99,102,241,0.2), transparent 60%);
        }
        .p33-dt-ava {
          width:90px; height:90px; margin:0 auto 14px; border-radius:28px;
          background:linear-gradient(135deg,#fbbf24,#f59e0b,#d97706);
          display:flex; align-items:center; justify-content:center;
          font-size:44px; color:#fff; font-weight:900; position:relative; z-index:2;
          box-shadow:0 14px 30px rgba(245,158,11,0.4);
        }
        .p33-dt-name { font-size:24px; font-weight:900; letter-spacing:-0.6px; margin-bottom:4px; position:relative; z-index:2; }
        .p33-dt-pos { font-size:13px; color:rgba(255,255,255,0.6); font-weight:500; position:relative; z-index:2; }

        .p33-dt-body { padding:32px; margin-top:-60px; position:relative; z-index:3; }

        .p33-remain-hero {
          background:linear-gradient(135deg,#10b981,#059669); color:#fff;
          padding:24px; border-radius:22px; text-align:center;
          box-shadow:0 14px 36px rgba(16,185,129,0.3);
          margin-bottom:20px; position:relative; overflow:hidden;
        }
        .p33-remain-hero::before {
          content:''; position:absolute; top:-40%; right:-20%; width:280px; height:280px;
          background:radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%);
        }
        .p33-remain-hero.--zero { background:linear-gradient(135deg,#dc2626,#991b1b); box-shadow:0 14px 36px rgba(220,38,38,0.3); }
        .p33-rh-lbl { font-size:11px; color:rgba(255,255,255,0.8); letter-spacing:1.5px;
          text-transform:uppercase; font-weight:800; margin-bottom:6px; position:relative; z-index:2; }
        .p33-rh-val { font-size:44px; font-weight:900; letter-spacing:-1.5px; position:relative; z-index:2; }

        .p33-past-alert {
          background:linear-gradient(135deg,#fffbeb,#fef3c7);
          border:1.5px solid #fcd34d; border-radius:16px; padding:16px 18px; margin-bottom:18px;
        }
        .p33-pa-hd {
          display:flex; align-items:center; gap:8px; font-size:13px; font-weight:800;
          color:#92400e; margin-bottom:10px;
        }
        .p33-pa-row {
          display:flex; justify-content:space-between; font-size:12.5px;
          padding:6px 10px; border-radius:8px; color:#78350f;
        }
        .p33-pa-row:nth-child(even) { background:rgba(253,186,116,0.2); }

        .p33-info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
        .p33-info-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:14px 16px; }
        .p33-info-k { font-size:10.5px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px; }
        .p33-info-v { font-size:17px; font-weight:800; color:#0f172a; }
        .p33-info-v.--blue { color:#2563eb; }
        .p33-info-v.--amber { color:#d97706; }
        .p33-info-v.--red { color:#dc2626; }

        .p33-form-hd {
          font-size:15px; font-weight:800; color:#0f172a; margin:8px 0 14px;
          display:flex; align-items:center; gap:10px;
        }
        .p33-form-hd::before {
          content:''; width:4px; height:18px; background:#0f172a; border-radius:3px;
        }
        .p33-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .p33-field { display:flex; flex-direction:column; gap:6px; }
        .p33-field.--full { grid-column:1/-1; }
        .p33-field label { font-size:12px; font-weight:700; color:#334155; }
        .p33-field input, .p33-field select {
          padding:12px 14px; border:1.5px solid #e2e8f0; border-radius:12px;
          font-size:14px; font-family:inherit; background:#fff;
          transition:all 0.15s; font-weight:600;
        }
        .p33-field input:focus, .p33-field select:focus {
          outline:none; border-color:#0f172a; box-shadow:0 0 0 4px rgba(15,23,42,0.08);
        }
        .p33-vmsg { margin:18px 0; }

        .p33-confirm-btn {
          width:100%; padding:18px; border:none; border-radius:18px;
          background:linear-gradient(135deg,#0f172a,#1e293b,#334155);
          color:#fff; font-size:16px; font-weight:900; cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:10px;
          box-shadow:0 12px 30px rgba(15,23,42,0.25); transition:all 0.2s;
          font-family:inherit; letter-spacing:-0.3px;
        }
        .p33-confirm-btn:hover:not(:disabled) {
          transform:translateY(-2px); box-shadow:0 18px 40px rgba(15,23,42,0.35);
        }
        .p33-confirm-btn:disabled {
          background:#cbd5e1; cursor:not-allowed; box-shadow:none;
        }
        .p33-confirm-btn i { font-size:22px; }

        @media (max-width:768px) {
          .p33-hero-body { padding:24px 20px 18px; }
          .p33-title-main { font-size:24px; }
          .p33-headline-total { width:100%; min-width:0; text-align:center; }
          .p33-headline-val { font-size:28px; }
          .p33-stats { grid-template-columns:repeat(2,1fr); }
          .p33-grid { grid-template-columns:1fr; }
          .p33-info-grid { grid-template-columns:1fr; }
          .p33-form-grid { grid-template-columns:1fr; }
          .p33-dt-head { padding:26px 20px 70px; }
          .p33-dt-body { padding:22px; }
          .p33-rh-val { font-size:34px; }
        }
      `;
      document.head.appendChild(css);
    }

    const fmtNum = function (n) {
      return (typeof formatNum === 'function') ? formatNum(n) : Number(n || 0).toLocaleString('th-TH');
    };
    const fmtDate = function (d) {
      return d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    };

    window.renderPayroll = window.renderPayrollV26 = async function () {
      const sec = document.getElementById('page-att');
      if (!sec) return;
      sec.innerHTML = '<div class="p33-wrap" style="padding:60px 0;text-align:center;color:#94a3b8;">' +
        '<i class="material-icons-round" style="font-size:42px;animation:v33spin .7s linear infinite;">sync</i>' +
        '<div style="margin-top:12px;font-weight:600;">กำลังโหลดข้อมูล...</div></div>';

      try {
        const now = new Date();
        const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const me = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const ml = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

        const [emps, attRes, advRes, paidRes] = await Promise.all([
          (typeof loadEmployees === 'function' ? loadEmployees() : Promise.resolve([])),
          db.from('เช็คชื่อ').select('*').gte('date', ms).lte('date', me),
          db.from('เบิกเงิน').select('*').eq('status', 'อนุมัติ').gte('date', ms + 'T00:00:00'),
          db.from('จ่ายเงินเดือน').select('*').eq('month', ms).order('paid_date', { ascending: true })
        ]);
        const activeEmps = (emps || []).filter(function (e) { return e.status === 'ทำงาน'; });
        const att = attRes.data || [];
        const adv = advRes.data || [];
        const paid = paidRes.data || [];
        const emojis = ['👨‍💼','👩‍💼','🧑‍🔧','👨‍🔬','👩‍🍳','👨‍🎤','👩‍🎨','👨‍🚀','👨‍🚒','👮','🕵️','🤵'];

        window._v26Pay = activeEmps.map(function (emp) {
          const ma = att.filter(function (a) { return a.employee_id === emp.id; });
          const wd = ma.filter(function (a) { return a.status !== 'ขาด' && a.status !== 'ลา'; }).length;
          const td = ma.reduce(function (s, a) { return s + (a.deduction || 0); }, 0);
          const earn = emp.pay_type === 'รายเดือน'
            ? (emp.salary || 0) - td
            : (wd * (emp.daily_wage || 0)) - td;
          const myA = adv.filter(function (a) { return a.employee_id === emp.id; });
          const taGross = myA.reduce(function (s, a) { return s + a.amount; }, 0);
          const pastPays = paid.filter(function (p) { return p.employee_id === emp.id; });
          const sumPaidNet = pastPays.reduce(function (s, p) { return s + (p.net_paid || 0); }, 0);
          const sumPaidWithdraw = pastPays.reduce(function (s, p) { return s + (p.deduct_withdraw || 0); }, 0);
          const sumTotalDeduct = pastPays.reduce(function (s, p) { return s + (p.deduct_absent || 0) + (p.deduct_ss || 0) + (p.deduct_other || 0); }, 0);
          const net = Math.max(0, earn - sumPaidNet - sumPaidWithdraw - sumTotalDeduct);
          const emoji = emojis[emp.id.charCodeAt(0) % emojis.length];
          return {
            emp: emp, wd: wd, td: td, earn: earn, ta: Math.max(0, taGross - sumPaidWithdraw),
            taGross: taGross, myA: myA, net: net, pastPays: pastPays,
            sumPaidNet: sumPaidNet, sumPaidWithdraw: sumPaidWithdraw, sumTotalDeduct: sumTotalDeduct,
            paidCount: pastPays.length, emoji: emoji
          };
        });

        const totalNet = window._v26Pay.reduce(function (s, x) { return s + x.net; }, 0);
        const totalEarn = window._v26Pay.reduce(function (s, x) { return s + x.earn; }, 0);
        const paidCount = window._v26Pay.filter(function (x) { return x.paidCount > 0; }).length;
        const pendCount = activeEmps.length - paidCount;

        const cardsHTML = window._v26Pay.map(function (s) {
          const isPaid = s.paidCount > 0;
          return '<div onclick="v26ShowPayDetail(\'' + s.emp.id + '\')" class="p33-card ' + (isPaid ? '--paid' : '--pending') + '">' +
            '<div class="p33-card-shine"></div>' +
            '<div class="p33-card-hd">' +
              '<div class="p33-ava">' + s.emoji + '</div>' +
              '<div class="p33-emp-info">' +
                '<div class="p33-emp-name">' + s.emp.name + ' ' + (s.emp.lastname || '') + '</div>' +
                '<div class="p33-emp-meta">' +
                  '<span>' + (s.emp.position || 'พนักงาน') + '</span>' +
                  '<span>·</span>' +
                  '<span>' + s.wd + ' วัน</span>' +
                '</div>' +
              '</div>' +
              (isPaid
                ? '<div class="p33-badge --paid"><i class="material-icons-round">workspace_premium</i>จ่ายแล้ว</div>'
                : '<div class="p33-badge --pending"><i class="material-icons-round">schedule</i>รอจ่าย</div>') +
            '</div>' +
            '<div class="p33-card-stats">' +
              '<div class="p33-stat-box">' +
                '<div class="p33-sb-lbl">สะสม</div>' +
                '<div class="p33-sb-val">฿' + fmtNum(s.earn) + '</div>' +
              '</div>' +
              '<div class="p33-stat-box">' +
                '<div class="p33-sb-lbl">เบิกค้าง</div>' +
                '<div class="p33-sb-val --warn">฿' + fmtNum(s.ta) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="p33-card-ft">' +
              '<span class="p33-ft-lbl">คงเหลือสุทธิ</span>' +
              '<div class="p33-ft-val-wrap">' +
                '<span class="p33-ft-val">฿' + fmtNum(s.net) + '</span>' +
                '<i class="material-icons-round p33-ft-arr">chevron_right</i>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');

        sec.innerHTML =
          '<div class="p33-wrap">' +
            '<div class="p33-hero">' +
              '<div class="p33-hero-body">' +
                '<div class="p33-hero-top">' +
                  '<div class="p33-hero-left">' +
                    '<button class="p33-back" onclick="renderAttendance()">' +
                      '<i class="material-icons-round">arrow_back</i>กลับเช็คชื่อ' +
                    '</button>' +
                    '<div>' +
                      '<div class="p33-title-crumb">HR · PAYROLL DASHBOARD</div>' +
                      '<div class="p33-title-main">' +
                        '<div class="p33-gold-ico"><i class="material-icons-round">diamond</i></div>' +
                        'จ่ายเงินเดือน' +
                      '</div>' +
                      '<div class="p33-title-sub">' + ml + '</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="p33-headline-total">' +
                    '<div class="p33-headline-label">ยอดค้างจ่ายรวม</div>' +
                    '<div class="p33-headline-val">฿' + fmtNum(totalNet) + '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="p33-stats">' +
                '<div class="p33-stat --emp">' +
                  '<i class="material-icons-round p33-stat-ico" style="color:#a5b4fc;">group</i>' +
                  '<div class="p33-stat-lbl">พนักงาน</div>' +
                  '<div class="p33-stat-val">' + activeEmps.length + '</div>' +
                  '<div class="p33-stat-sub">คนที่กำลังทำงาน</div>' +
                '</div>' +
                '<div class="p33-stat --paid">' +
                  '<i class="material-icons-round p33-stat-ico" style="color:#6ee7b7;">check_circle</i>' +
                  '<div class="p33-stat-lbl">จ่ายแล้ว</div>' +
                  '<div class="p33-stat-val" style="color:#6ee7b7;">' + paidCount + '</div>' +
                  '<div class="p33-stat-sub">คน</div>' +
                '</div>' +
                '<div class="p33-stat --pending">' +
                  '<i class="material-icons-round p33-stat-ico" style="color:#fcd34d;">pending</i>' +
                  '<div class="p33-stat-lbl">รอจ่าย</div>' +
                  '<div class="p33-stat-val" style="color:#fcd34d;">' + pendCount + '</div>' +
                  '<div class="p33-stat-sub">คน</div>' +
                '</div>' +
                '<div class="p33-stat --sum">' +
                  '<i class="material-icons-round p33-stat-ico" style="color:#f9a8d4;">savings</i>' +
                  '<div class="p33-stat-lbl">สะสมเดือนนี้</div>' +
                  '<div class="p33-stat-val">฿' + fmtNum(totalEarn) + '</div>' +
                  '<div class="p33-stat-sub">ยอดก่อนหัก</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="p33-section-hd">' +
              '<div class="p33-section-t">รายชื่อพนักงาน</div>' +
            '</div>' +
            '<div id="v26-pay-grid" class="p33-grid">' + cardsHTML + '</div>' +
            '<div id="v26-pay-detail-wrap" style="display:none;"></div>' +
          '</div>';
      } catch (e) {
        console.error('[v33-fixes] renderPayroll:', e);
        sec.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;">' +
          '<i class="material-icons-round" style="font-size:42px;display:block;margin-bottom:10px;">error_outline</i>' +
          'โหลดไม่สำเร็จ: ' + (e.message || e) + '</div>';
      }
    };

    window.v26ShowPayDetail = function (eid) {
      const wrap = document.getElementById('v26-pay-detail-wrap');
      if (!wrap || !eid) return;
      const grid = document.getElementById('v26-pay-grid');
      if (grid) grid.style.display = 'none';
      wrap.style.display = 'block';

      const s = window._v26Pay ? window._v26Pay.find(function (x) { return x.emp.id === eid; }) : null;
      if (!s) return;

      const emp = s.emp;
      const earn = s.earn || 0;
      const pastPays = s.pastPays || [];
      const sumPN = s.sumPaidNet || 0;
      const sumPD = s.sumPaidWithdraw || 0;
      const sumTD = s.sumTotalDeduct || 0;
      const remaining = Math.max(0, earn - sumPN - sumPD - sumTD);
      const totalAdv = s.taGross || 0;
      const debtLeft = Math.max(0, totalAdv - sumPD);

      let pastHTML = '';
      if (pastPays.length > 0) {
        pastHTML = '<div class="p33-past-alert">' +
          '<div class="p33-pa-hd"><i class="material-icons-round">history</i>' +
          'เดือนนี้จ่ายไปแล้ว ' + pastPays.length + ' ครั้ง · รวม ฿' + fmtNum(sumPN) + '</div>' +
          pastPays.map(function (p, i) {
            return '<div class="p33-pa-row">' +
              '<span>ครั้งที่ ' + (i + 1) + ' · ' + fmtDate(p.paid_date) + '</span>' +
              '<strong>฿' + fmtNum(p.net_paid) + '</strong></div>';
          }).join('') +
        '</div>';
      }

      wrap.innerHTML =
        '<button class="p33-detail-back" onclick="v26HidePayDetail()">' +
          '<i class="material-icons-round">arrow_back</i>กลับรายการพนักงาน' +
        '</button>' +
        '<div class="p33-detail-card">' +
          '<div class="p33-dt-head">' +
            '<div class="p33-dt-ava">' + (s.emoji || '👤') + '</div>' +
            '<div class="p33-dt-name">' + emp.name + ' ' + (emp.lastname || '') + '</div>' +
            '<div class="p33-dt-pos">' + (emp.position || 'พนักงาน') + ' · ฿' + fmtNum(emp.daily_wage || 0) + '/วัน</div>' +
          '</div>' +
          '<div class="p33-dt-body">' +
            '<div class="p33-remain-hero' + (remaining <= 0 ? ' --zero' : '') + '">' +
              '<div class="p33-rh-lbl">เพดานจ่ายได้สูงสุด</div>' +
              '<div class="p33-rh-val">฿' + fmtNum(remaining) + '</div>' +
            '</div>' +
            pastHTML +
            '<div class="p33-info-grid">' +
              '<div class="p33-info-box"><div class="p33-info-k">วันทำงาน</div><div class="p33-info-v">' + (s.wd || 0) + ' วัน</div></div>' +
              '<div class="p33-info-box"><div class="p33-info-k">ค่าจ้างสะสม</div><div class="p33-info-v --blue">฿' + fmtNum(earn) + '</div></div>' +
              '<div class="p33-info-box"><div class="p33-info-k">เบิกเดือนนี้</div><div class="p33-info-v --amber">฿' + fmtNum(totalAdv) + '</div></div>' +
              '<div class="p33-info-box"><div class="p33-info-k">หนี้เบิกคงเหลือ</div><div class="p33-info-v --red">฿' + fmtNum(debtLeft) + '</div></div>' +
            '</div>' +
            '<div class="p33-form-hd"><i class="material-icons-round" style="font-size:18px;">edit_note</i>กรอกรายการจ่าย</div>' +
            '<div class="p33-form-grid">' +
              '<div class="p33-field">' +
                '<label>ยอดจ่ายสุทธิ (฿)</label>' +
                '<input type="number" id="v26r-' + eid + '" value="' + (remaining > 0 ? remaining : 0) + '" min="0"' +
                  ' oninput="v27PV(\'' + eid + '\',' + earn + ',' + (sumPN + sumPD + sumTD) + ',' + debtLeft + ')">' +
              '</div>' +
              '<div class="p33-field">' +
                '<label>หักหนี้เบิก (Max ' + fmtNum(debtLeft) + ')</label>' +
                '<input type="number" id="v26d-' + eid + '" value="0" min="0" max="' + debtLeft + '"' +
                  ' oninput="v27PV(\'' + eid + '\',' + earn + ',' + (sumPN + sumPD + sumTD) + ',' + debtLeft + ')">' +
              '</div>' +
              '<div class="p33-field">' +
                '<label>หักประกันสังคม</label>' +
                '<input type="number" id="v26s-' + eid + '" value="0" min="0"' +
                  ' oninput="v27PV(\'' + eid + '\',' + earn + ',' + (sumPN + sumPD + sumTD) + ',' + debtLeft + ')">' +
              '</div>' +
              '<div class="p33-field">' +
                '<label>หักอื่นๆ</label>' +
                '<input type="number" id="v26o-' + eid + '" value="0" min="0"' +
                  ' oninput="v27PV(\'' + eid + '\',' + earn + ',' + (sumPN + sumPD + sumTD) + ',' + debtLeft + ')">' +
              '</div>' +
              '<div class="p33-field --full">' +
                '<label>หมายเหตุหักอื่นๆ</label>' +
                '<input type="text" id="v26on-' + eid + '" placeholder="ระบุเหตุผล...">' +
              '</div>' +
              '<div class="p33-field">' +
                '<label>วิธีจ่าย</label>' +
                '<select id="v26m-' + eid + '">' +
                  '<option value="เงินสด">เงินสด</option>' +
                  '<option value="โอนเงิน">โอนเงิน</option>' +
                '</select>' +
              '</div>' +
              '<div class="p33-field">' +
                '<label>หมายเหตุ</label>' +
                '<input type="text" id="v26pn-' + eid + '" placeholder="(ถ้ามี)">' +
              '</div>' +
            '</div>' +
            '<div class="p33-vmsg" id="v26vm-' + eid + '"></div>' +
            '<button class="p33-confirm-btn" id="v26pb-' + eid + '" onclick="v26DoPay(\'' + eid + '\')">' +
              '<i class="material-icons-round">payments</i>ยืนยันจ่ายเงินเดือน' +
            '</button>' +
          '</div>' +
        '</div>';

      if (typeof v27PV === 'function') v27PV(eid, earn, sumPN + sumPD + sumTD, debtLeft);
    };

    window.v26HidePayDetail = function () {
      const wrap = document.getElementById('v26-pay-detail-wrap');
      const grid = document.getElementById('v26-pay-grid');
      if (wrap) wrap.style.display = 'none';
      if (grid) grid.style.display = 'grid';
    };
  }

  // ────────────────────────────────────────────
  // Apply overrides — defer until other modules finish loading
  // (so we override the final version from v26/v31/app)
  // ────────────────────────────────────────────
  function applyAll() {
    installV26DoPayOverride();
    installPayPayableOverride();
    // Note: installV9PayCreditorCashTx supersedes installV9PayCreditorOverride
    //       (adds denom wizard + cash_transaction recording on top of it).
    installV9PayCreditorCashTx();
    installRecordCashTxWrapper();      // universal fallback wizard for out-flows
    installRenderCartOverride();
    installCashDrawerReconcile();
    installDashboardEnhance();
    installRenderWrappers();
    installFastCheckout();
    installV26SaveAllFix();
    installPayrollV33();
    console.log('[v33-fixes] overrides applied');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(applyAll, 300);
  } else {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(applyAll, 300); });
  }

  // Safety net: Esc key force-hides overlay (for stuck states)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('v33-active')) {
      // Allow Esc to hide if operation appears stuck (>3s)
      if (Date.now() - (overlay.dataset.shownAt || 0) > 3000) window.forceHideLoading();
    }
  });

  console.log('[v33-fixes] module registered');
})();

/* ==========================================================================
   Final cash-link patch
   Normalizes every cash denomination payment through recordCashTx so the
   drawer balance, denomination chips, and transaction history stay together.
========================================================================== */
(function () {
  'use strict';

  const fmt = n => typeof formatNum === 'function'
    ? formatNum(n)
    : Number(n || 0).toLocaleString('th-TH');

  function staffName() {
    try {
      if (typeof USER !== 'undefined' && USER?.username) return USER.username;
    } catch (_) {}
    return 'system';
  }

  async function currentCashSession() {
    const { data } = await db.from('cash_session')
      .select('id')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data || null;
  }

  async function refreshCashViews() {
    try {
      if (typeof loadCashBalance === 'function') await loadCashBalance();
    } catch (_) {}
    try {
      const onCash = (typeof currentPage !== 'undefined' && currentPage === 'cash')
        || !document.getElementById('page-cash')?.classList.contains('hidden');
      if (onCash && typeof renderCashDrawer === 'function') await renderCashDrawer();
    } catch (_) {}
  }

  function normalizeCashArgs(args) {
    const a = { ...(args || {}) };
    a.changeAmt = Number(a.changeAmt ?? a.change_amt ?? 0);
    a.netAmount = Number(a.netAmount ?? a.net_amount ?? a.amount ?? 0);
    a.amount = Number(a.amount ?? a.netAmount ?? 0);
    a.changeDenominations = a.changeDenominations || a.change_denominations || null;
    if (!a.changeDenominations && a.changeAmt > 0 && typeof calcChangeDenominations === 'function') {
      a.changeDenominations = calcChangeDenominations(a.changeAmt);
    }
    return a;
  }

  async function recordCashIn(args) {
    const session = await currentCashSession();
    if (!session) {
      if (typeof toast === 'function') toast('ยังไม่ได้เปิดลิ้นชัก จึงไม่บันทึกเงินสดเข้าลิ้นชัก', 'warning');
      return false;
    }
    const a = normalizeCashArgs({ ...args, sessionId: session.id, direction: 'in' });
    if (typeof window.recordCashTx === 'function') {
      await window.recordCashTx(a);
    } else {
      await db.from('cash_transaction').insert({
        session_id: session.id,
        type: a.type,
        direction: 'in',
        amount: a.amount,
        change_amt: a.changeAmt,
        net_amount: a.netAmount,
        balance_after: 0,
        ref_id: a.refId || null,
        ref_table: a.refTable || null,
        staff_name: staffName(),
        note: a.note || null,
        denominations: a.denominations || null,
        change_denominations: a.changeDenominations || null,
      });
    }
    await refreshCashViews();
    return true;
  }

  async function ensureCashSessionOpen() {
    const session = await currentCashSession();
    if (session) return true;
    if (typeof toast === 'function') toast('กรุณาเปิดลิ้นชักก่อนรับเงินสด', 'warning');
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        icon: 'warning',
        title: 'ยังไม่ได้เปิดลิ้นชัก',
        text: 'กรุณาเปิดรอบลิ้นชักก่อนรับชำระด้วยเงินสด เพื่อให้ยอดเงินเชื่อมเข้าลิ้นชักครบถ้วน',
        confirmButtonText: 'ตกลง',
      });
    }
    return false;
  }

  (function installRecordCashTxFinalWrapper() {
    const orig = window.recordCashTx;
    if (typeof orig !== 'function' || orig.__v33finalcash) return;
    window.recordCashTx = async function (args) {
      const normalized = normalizeCashArgs(args);
      if (normalized.changeDenominations && !normalized.change_denominations) {
        normalized.change_denominations = normalized.changeDenominations;
      }
      const result = await orig.call(this, normalized);
      await refreshCashViews();
      return result;
    };
    window.recordCashTx.__v33finalcash = true;
  })();

  function effectiveTotal(bill) {
    let ret = bill?.return_info || {};
    if (typeof ret === 'string') {
      try { ret = JSON.parse(ret); } catch (_) { ret = {}; }
    }
    return Number(ret.new_total ?? bill?.total ?? 0);
  }

  async function showCashLinkedPayDialog(opts) {
    if (typeof Swal === 'undefined') {
      const amt = Number(prompt(opts.title + '\nยอดค้าง ฿' + fmt(opts.maxAmt), opts.defaultAmt || opts.maxAmt) || 0);
      if (amt > 0) opts.onConfirm(Math.min(amt, opts.maxAmt), 'เงินสด');
      return;
    }

    const rows = (opts.rows || []).map(r =>
      `<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #f1f5f9">
        <span style="color:#64748b">${r.label}</span>
        <strong style="color:${r.color || '#0f172a'}">${r.val}</strong>
      </div>`
    ).join('');

    const { value, isConfirmed } = await Swal.fire({
      title: opts.title,
      html: `<div style="text-align:left;font-size:14px">
        ${opts.billNo ? `<div style="font-size:12px;color:#64748b;margin-bottom:8px">บิล #${opts.billNo}</div>` : ''}
        ${rows}
        <label style="display:block;margin-top:14px;font-weight:700">ยอดรับชำระ</label>
        <input id="v33-pay-amt" class="swal2-input" type="number" min="1" max="${opts.maxAmt}" value="${opts.defaultAmt || opts.maxAmt}" style="margin:6px 0 0;width:100%">
        <label style="display:block;margin-top:12px;font-weight:700">วิธีชำระ</label>
        <select id="v33-pay-method" class="swal2-select" style="margin:6px 0 0;width:100%">
          <option value="เงินสด">เงินสด</option>
          <option value="โอนเงิน">โอนเงิน</option>
          <option value="บัตรเครดิต">บัตรเครดิต</option>
        </select>
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'รับชำระ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#10b981',
      preConfirm: () => {
        const amt = Number(document.getElementById('v33-pay-amt')?.value || 0);
        const method = document.getElementById('v33-pay-method')?.value || 'เงินสด';
        if (!amt || amt <= 0) {
          Swal.showValidationMessage('กรุณาระบุยอดรับชำระ');
          return false;
        }
        if (amt > opts.maxAmt) {
          Swal.showValidationMessage('ยอดรับชำระเกินยอดค้าง');
          return false;
        }
        return { amt, method };
      },
    });
    if (isConfirmed && value) opts.onConfirm(value.amt, value.method);
  }

  function installBillDebtPaymentOverride() {
    if (typeof window.v20BMCPayDebt !== 'function') return false;
    window.v20BMCPayDebt = async function (billId) {
      try {
        const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).single();
        if (!bill) {
          if (typeof toast === 'function') toast('ไม่พบบิล', 'error');
          return;
        }

        const total = effectiveTotal(bill);
        const rem = Math.max(0, total - Number(bill.deposit_amount || 0));
        if (rem <= 0) {
          if (typeof toast === 'function') toast('ไม่มียอดค้างชำระ', 'info');
          return;
        }

        const savePayment = async function (paidAmt, method, recvTotal, chgTotal, recvD, chgD) {
          if (method === 'เงินสด' && !(await ensureCashSessionOpen())) return;

          const newDeposit = Number(bill.deposit_amount || 0) + Number(paidAmt || 0);
          const full = newDeposit >= total;
          const nextStatus = full
            ? (bill.delivery_status === 'รอจัดส่ง' ? 'รอจัดส่ง' : 'สำเร็จ')
            : 'ค้างชำระ';

          await db.from('บิลขาย').update({
            deposit_amount: newDeposit,
            status: nextStatus,
            method: full ? method : bill.method,
          }).eq('id', billId);

          if (bill.customer_id) {
            try {
              const { data: cust } = await db.from('customer').select('debt_amount').eq('id', bill.customer_id).maybeSingle();
              if (cust) {
                await db.from('customer').update({
                  debt_amount: Math.max(0, Number(cust.debt_amount || 0) - Number(paidAmt || 0)),
                }).eq('id', bill.customer_id);
              }
            } catch (_) {}
          }

          if (method === 'เงินสด') {
            await recordCashIn({
              type: 'รับชำระบิล',
              amount: recvTotal || paidAmt,
              changeAmt: chgTotal || 0,
              netAmount: paidAmt,
              refId: billId,
              refTable: 'บิลขาย',
              denominations: recvD || {},
              changeDenominations: chgD || {},
              note: `รับชำระบิล #${bill.bill_no || billId}`,
            });
          }

          if (typeof logActivity === 'function') {
            logActivity('รับชำระบิล', `บิล #${bill.bill_no || billId} ฿${fmt(paidAmt)} ${method}${full ? ' (ครบ)' : ''}`, billId, 'บิลขาย');
          }
          if (typeof toast === 'function') toast(`รับชำระ ฿${fmt(paidAmt)} สำเร็จ${full ? ' ครบแล้ว' : ''}`, 'success');
          if (typeof v12BMCLoad === 'function') v12BMCLoad();
          if (typeof renderDebts === 'function') renderDebts();
          await refreshCashViews();
        };

        const rows = [
          { label: 'ลูกค้า', val: bill.customer_name || 'ลูกค้าทั่วไป' },
          { label: 'ยอดรวมบิล', val: '฿' + fmt(bill.total) },
        ];
        if (Number(bill.deposit_amount || 0) > 0) {
          rows.push({ label: 'ชำระแล้ว', val: '฿' + fmt(bill.deposit_amount), color: '#16a34a' });
        }
        rows.push({ label: 'ยอดค้างชำระ', val: '฿' + fmt(rem), color: '#ef4444' });

        await showCashLinkedPayDialog({
          title: 'รับชำระบิล',
          billNo: bill.bill_no,
          rows,
          maxAmt: rem,
          defaultAmt: rem,
          onConfirm: function (amt, method) {
            if (method === 'เงินสด' && typeof window.v28DebtPayWiz === 'function') {
              window.v28DebtPayWiz(bill.customer_id || '__bill__', bill.customer_name || 'ลูกค้า', amt, async function (paidAmt, recvTotal, chgTotal, recvD, chgD) {
                await savePayment(paidAmt, method, recvTotal, chgTotal, recvD, chgD);
              }, true);
            } else {
              savePayment(amt, method, 0, 0, {}, {});
            }
          },
        });
      } catch (e) {
        console.error('[v33-cash] bill payment:', e);
        if (typeof toast === 'function') toast('รับชำระบิลไม่สำเร็จ: ' + e.message, 'error');
      }
    };
    window.v20BMCPayDebt.__v33cashlinked = true;
    return true;
  }

  function installDebtPaymentOverride() {
    if (typeof window.recordDebtPayment !== 'function') return false;
    window.recordDebtPayment = async function (customerId, name) {
      try {
        const { data: cust } = await db.from('customer').select('debt_amount,name,phone').eq('id', customerId).maybeSingle();
        if (!cust) {
          if (typeof toast === 'function') toast('ไม่พบลูกค้า', 'error');
          return;
        }
        const debt = Number(cust.debt_amount || 0);
        if (debt <= 0) {
          if (typeof toast === 'function') toast('ลูกค้าไม่มียอดหนี้', 'info');
          return;
        }

        const saveDebt = async function (paidAmt, method, recvTotal, chgTotal, recvD, chgD) {
          if (method === 'เงินสด' && !(await ensureCashSessionOpen())) return;

          const newDebt = Math.max(0, debt - Number(paidAmt || 0));
          await db.from('customer').update({ debt_amount: newDebt }).eq('id', customerId);
          const { data: pay } = await db.from('ชำระหนี้').insert({
            customer_id: customerId,
            amount: paidAmt,
            method,
            staff_name: staffName(),
          }).select('id').maybeSingle();

          if (method === 'เงินสด') {
            await recordCashIn({
              type: 'รับชำระหนี้',
              amount: recvTotal || paidAmt,
              changeAmt: chgTotal || 0,
              netAmount: paidAmt,
              refId: pay?.id || null,
              refTable: 'ชำระหนี้',
              denominations: recvD || {},
              changeDenominations: chgD || {},
              note: `${name || cust.name || 'ลูกค้า'} ชำระหนี้`,
            });
          }

          if (typeof logActivity === 'function') logActivity('รับชำระหนี้', `${name || cust.name} ฿${fmt(paidAmt)}${newDebt > 0 ? ' เหลือ ฿' + fmt(newDebt) : ' ครบ'}`);
          if (typeof toast === 'function') toast(`รับชำระสำเร็จ ฿${fmt(paidAmt)}${newDebt > 0 ? ' เหลือหนี้ ฿' + fmt(newDebt) : ' ครบแล้ว'}`, 'success');
          if (typeof v9AutoUpdateBillStatus === 'function') await v9AutoUpdateBillStatus(customerId);
          if (typeof loadCustomerData === 'function') loadCustomerData();
          if (typeof renderDebts === 'function') renderDebts();
          await refreshCashViews();
        };

        await showCashLinkedPayDialog({
          title: 'รับชำระหนี้',
          rows: [
            { label: 'ลูกค้า', val: name || cust.name || 'ลูกค้า' },
            { label: 'หนี้คงค้างทั้งหมด', val: '฿' + fmt(debt), color: '#ef4444' },
          ],
          maxAmt: debt,
          defaultAmt: debt,
          onConfirm: function (amt, method) {
            if (method === 'เงินสด' && typeof window.v28DebtPayWiz === 'function') {
              window.v28DebtPayWiz(customerId, name || cust.name || 'ลูกค้า', amt, async function (paidAmt, recvTotal, chgTotal, recvD, chgD) {
                await saveDebt(paidAmt, method, recvTotal, chgTotal, recvD, chgD);
              }, true);
            } else {
              saveDebt(amt, method, 0, 0, {}, {});
            }
          },
        });
      } catch (e) {
        console.error('[v33-cash] debt payment:', e);
        if (typeof toast === 'function') toast('รับชำระหนี้ไม่สำเร็จ: ' + e.message, 'error');
      }
    };
    window.recordDebtPayment.__v33cashlinked = true;
    return true;
  }

  function installCashLinks() {
    installBillDebtPaymentOverride();
    installDebtPaymentOverride();
  }

  setTimeout(installCashLinks, 500);
  setTimeout(installCashLinks, 1200);
  console.log('[v33-cash] final cash link patch registered');
})();

/* ==========================================================================
   Deposit delivery settlement patch
   - Delivery note prints the remaining balance after deposit.
   - Completing delivery can collect the remaining payment before leaving debt.
========================================================================== */
(function () {
  'use strict';

  const doneDeliveryText = 'จัดส่งสำเร็จ';
  const pendingDebtText = 'ค้างชำระ';
  const successText = 'สำเร็จ';

  const fmt = n => typeof formatNum === 'function'
    ? formatNum(n)
    : Number(n || 0).toLocaleString('th-TH');

  function parseReturnInfo(info) {
    if (!info) return {};
    if (typeof info === 'object') return info;
    try { return JSON.parse(info); } catch (_) { return {}; }
  }

  function billEffectiveTotal(bill) {
    const ret = parseReturnInfo(bill && bill.return_info);
    return Number(ret.new_total ?? bill?.total ?? 0);
  }

  async function fetchBillAndItems(billId) {
    const [{ data: bill }, { data: items }] = await Promise.all([
      db.from('บิลขาย').select('*').eq('id', billId).maybeSingle(),
      db.from('รายการในบิล').select('*').eq('bill_id', billId),
    ]);
    return { bill, items: items || [] };
  }

  function deliveryPrintItems(items) {
    return (items || []).map(it => {
      let displayName = it.name || '';
      const taken = Number(it.take_qty || 0);
      const deliver = Number(it.deliver_qty || 0);
      if (taken > 0) {
        displayName += deliver > 0
          ? ` (รับแล้ว ${fmt(taken)}, ส่งรอบนี้ ${fmt(deliver)})`
          : ` (ลูกค้ารับไปเองแล้ว ${fmt(taken)})`;
      }
      return { ...it, name: displayName, qty: it.qty };
    });
  }

  async function settleDeliveredStock(billId, items) {
    const deliverItems = (items || []).filter(i => Number(i.deliver_qty || 0) > 0);
    let um = {}, bm = {};
    if (typeof _v20FetchConv === 'function') {
      const pids = deliverItems.map(i => i.product_id).filter(Boolean);
      try {
        const conv = await _v20FetchConv(pids);
        um = conv.um || {};
        bm = conv.bm || {};
      } catch (_) {}
    }

    for (const it of deliverItems) {
      if (!it.product_id) continue;
      const prod = (typeof products !== 'undefined' && Array.isArray(products))
        ? products.find(p => p.id === it.product_id)
        : null;
      const stockBefore = Number(prod?.stock || 0);
      let deducted = Number(it.deliver_qty || 0);
      if (typeof _v20BaseQty === 'function') {
        deducted = _v20BaseQty(deducted, it.unit || 'ชิ้น', it.product_id, um, bm);
      } else {
        deducted = deducted * 1400;
      }
      const stockAfter = Number((stockBefore - deducted).toFixed(6));

      await db.from('สินค้า').update({ stock: stockAfter }).eq('id', it.product_id);
      if (prod) prod.stock = stockAfter;
      try {
        await db.from('stock_movement').insert({
          product_id: it.product_id,
          product_name: it.name,
          type: 'จัดส่ง',
          direction: 'out',
          qty: deducted,
          stock_before: stockBefore,
          stock_after: stockAfter,
          ref_id: billId,
          ref_table: 'บิลขาย',
          staff_name: (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown',
        });
      } catch (e) {
        console.warn('[v33-delivery] stock movement skipped:', e);
      }
    }
  }

  window.v12PrintDeliveryNote = async function (billId) {
    try {
      const { bill, items } = await fetchBillAndItems(billId);
      if (!bill) {
        if (typeof toast === 'function') toast('ไม่พบบิล', 'error');
        return;
      }

      const effectiveTotal = billEffectiveTotal(bill);
      const deposit = Number(bill.deposit_amount || 0);
      const remaining = Math.max(0, effectiveTotal - deposit);
      const printableBill = {
        ...bill,
        total: deposit > 0 ? remaining : effectiveTotal,
        received: 0,
        change: 0,
        _original_total: effectiveTotal,
        _deposit_paid: deposit,
      };

      await v24PrintDocument(printableBill, deliveryPrintItems(items), 'delivery');
    } catch (e) {
      console.error('[v33-delivery] print delivery note:', e);
      if (typeof toast === 'function') toast('พิมพ์ใบส่งของไม่สำเร็จ: ' + e.message, 'error');
    }
  };

  window.v12DQPrintNote = function (billId) {
    return window.v12PrintDeliveryNote(billId);
  };

  window.v12DQMarkDone = async function (billId) {
    try {
      const { bill, items } = await fetchBillAndItems(billId);
      if (!bill) {
        if (typeof toast === 'function') toast('ไม่พบบิล', 'error');
        return;
      }

      const effectiveTotal = billEffectiveTotal(bill);
      const paid = Number(bill.deposit_amount || 0);
      const remaining = Math.max(0, effectiveTotal - paid);
      let action = remaining > 0 ? 'pay' : 'done';

      if (typeof Swal !== 'undefined') {
        const result = await Swal.fire({
          title: 'ยืนยันจัดส่งสำเร็จ?',
          html: remaining > 0
            ? `<div style="text-align:left;font-size:14px;line-height:1.7">
                <div>ยอดบิล: <strong>฿${fmt(effectiveTotal)}</strong></div>
                <div>มัดจำแล้ว: <strong style="color:#16a34a">฿${fmt(paid)}</strong></div>
                <div>ยอดคงเหลือ: <strong style="color:#dc2626">฿${fmt(remaining)}</strong></div>
                <div style="margin-top:8px;color:#64748b">เลือก "รับชำระตอนนี้" เพื่อปิดบิลเหมือนขายปกติ หรือเลือก "บันทึกเป็นหนี้" ถ้าลูกค้ายังค้างชำระ</div>
              </div>`
            : 'ระบบจะตัดสต็อกสินค้าที่จัดส่งและปิดบิลให้เรียบร้อย',
          icon: 'question',
          showCancelButton: true,
          showDenyButton: remaining > 0,
          confirmButtonText: remaining > 0 ? 'รับชำระตอนนี้' : 'ยืนยันจัดส่งสำเร็จ',
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

      await settleDeliveredStock(billId, items);

      const nextStatus = remaining > 0
        ? pendingDebtText
        : successText;
      await db.from('บิลขาย').update({
        delivery_status: doneDeliveryText,
        status: nextStatus,
      }).eq('id', billId);

      if (typeof logActivity === 'function') {
        logActivity(
          'จัดส่งสำเร็จ',
          `บิล #${bill.bill_no || billId} ตัดสต็อกแล้ว${remaining > 0 ? ' ยอดคงเหลือ ฿' + fmt(remaining) : ''}`,
          billId,
          'บิลขาย'
        );
      }

      if (typeof loadProducts === 'function') await loadProducts();
      if (typeof renderDelivery === 'function') await renderDelivery();
      if (typeof updateHomeStats === 'function') updateHomeStats();

      if (remaining > 0 && action === 'pay' && typeof v20BMCPayDebt === 'function') {
        setTimeout(() => v20BMCPayDebt(billId), 250);
      } else if (typeof toast === 'function') {
        toast(action === 'debt' ? 'จัดส่งสำเร็จ และบันทึกยอดคงเหลือเป็นหนี้แล้ว' : 'จัดส่งสำเร็จ', 'success');
      }
    } catch (e) {
      console.error('[v33-delivery] mark done:', e);
      if (typeof toast === 'function') toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
  };

  console.log('[v33-delivery] deposit settlement patch applied');
})();
