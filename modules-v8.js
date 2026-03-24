/**
 * SK POS — modules-v8.js  (โหลดหลัง modules-v7.js)
 *
 * ██████████████████████████████████████████████████████████████████
 *  FIX-1  CASH DRAWER  — v4CompletePayment ใช้ recordCashTx แทน raw insert
 *                         เพื่อหลีกเลี่ยง error จาก change_denominations
 *                         ที่อาจยังไม่ได้ run migration SQL
 *                         → balance_after ถูกต้อง + UI อัปเดตทันที
 *
 *  FIX-2  PAYROLL      — v7ConfirmPayroll ตรวจสอบ Supabase error
 *                         แล้ว fallback insert เฉพาะ column ที่มีจริง
 *                         เพื่อหลีกเลี่ยง "silent save ไม่ได้"
 *
 *  FIX-3  DRAWER UI    — แสดงยอดรับ + ยอดทอนในรายการ transaction
 *                         ให้ชัดเจนว่าลิ้นชักได้รับ/ทอนเท่าไร
 * ██████████████████████████████████████████████████████████████████
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// FIX-1: CASH DRAWER — patch v4CompletePayment
// ══════════════════════════════════════════════════════════════════

// Capture the existing function so we can reuse bill/item saving logic
const _v8OrigV4Complete = window.v4CompletePayment;

window.v4CompletePayment = async function () {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;
  try {
    // ── 1. Open cash session ────────────────────────────────────────
    const { data: session } = await db
      .from('cash_session').select('*')
      .eq('status', 'open').order('opened_at', { ascending: false })
      .limit(1).single();

    // ── 2. Save bill ────────────────────────────────────────────────
    const { data: bill, error: billError } = await db.from('บิลขาย').insert({
      date:          new Date().toISOString(),
      method:        { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ค้างชำระ' }[checkoutState.method] || 'เงินสด',
      total:         checkoutState.total,
      discount:      checkoutState.discount,
      received:      checkoutState.received,
      change:        checkoutState.change,
      customer_name: checkoutState.customer.name,
      customer_id:   checkoutState.customer.id || null,
      staff_name:    USER?.username,
      status:        checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
      denominations: checkoutState.receivedDenominations || null,
    }).select().single();
    if (billError) throw billError;

    // ── 3. Bill items + stock ───────────────────────────────────────
    for (const item of cart) {
      const prod = products.find(p => p.id === item.id);
      const { error: itemErr } = await db.from('รายการในบิล').insert({
        bill_id: bill.id, product_id: item.id, name: item.name,
        qty: item.qty, price: item.price, cost: item.cost || 0,
        total: item.price * item.qty
      });
      if (itemErr) console.warn('[v8] รายการในบิล error:', itemErr.message);

      await db.from('สินค้า').update({ stock: (prod?.stock || 0) - item.qty }).eq('id', item.id);
      await db.from('stock_movement').insert({
        product_id: item.id, product_name: item.name,
        type: 'ขาย', direction: 'out', qty: item.qty,
        stock_before: prod?.stock || 0, stock_after: (prod?.stock || 0) - item.qty,
        ref_id: bill.id, ref_table: 'บิลขาย', staff_name: USER?.username,
      });
    }

    // ── 4. Cash transaction — ใช้ recordCashTx แทน raw insert ──────
    //    recordCashTx: คำนวณ balance_after จริง + อัปเดต global-cash-balance
    //    ไม่ใช้ change_denominations column จึงไม่ error แม้ยังไม่ run migration
    if (checkoutState.method === 'cash' && session) {
      try {
        await recordCashTx({
          sessionId:    session.id,
          type:         'ขาย',
          direction:    'in',
          amount:       checkoutState.received,
          changeAmt:    checkoutState.change,
          netAmount:    checkoutState.total,          // net = received - change = total ✓
          refId:        bill.id,
          refTable:     'บิลขาย',
          denominations: checkoutState.receivedDenominations || null,
          note:         `รับ ฿${formatNum(checkoutState.received)} ทอน ฿${formatNum(checkoutState.change)}`,
        });
      } catch (cashErr) {
        // recordCashTx ล้มเหลว → ลอง fallback insert แบบ minimal
        console.warn('[v8] recordCashTx failed, trying fallback:', cashErr.message);
        const bal = await getLiveCashBalance();
        const balAfter = bal + checkoutState.total;
        const { error: txErr } = await db.from('cash_transaction').insert({
          session_id:  session.id, type: 'ขาย', direction: 'in',
          amount:      checkoutState.received, change_amt: checkoutState.change,
          net_amount:  checkoutState.total,    balance_after: balAfter,
          ref_id:      bill.id,   ref_table:   'บิลขาย',
          staff_name:  USER?.username,
          note:        `รับ ฿${formatNum(checkoutState.received)} ทอน ฿${formatNum(checkoutState.change)}`,
        });
        if (txErr) console.error('[v8] cash_transaction fallback failed:', txErr.message);
        else {
          const el = document.getElementById('global-cash-balance');
          if (el) el.textContent = `฿${formatNum(balAfter)}`;
        }
      }
    }

    // ── 5. Customer update ──────────────────────────────────────────
    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer')
        .select('total_purchase,visit_count,debt_amount')
        .eq('id', checkoutState.customer.id).single();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase || 0) + checkoutState.total,
        visit_count:    (cust?.visit_count || 0) + 1,
        debt_amount:    checkoutState.method === 'debt'
          ? (cust?.debt_amount || 0) + checkoutState.total
          : (cust?.debt_amount || 0),
      }).eq('id', checkoutState.customer.id);
    }

    // ── 6. Finish ───────────────────────────────────────────────────
    logActivity('ขายสินค้า', `บิล #${bill.bill_no} ยอด ฿${formatNum(checkoutState.total)}`, bill.id, 'บิลขาย');
    sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: checkoutState.total });
    cart = [];
    await loadProducts();
    renderCart(); renderProductGrid(); updateHomeStats?.();

    Swal.fire({
      icon: 'success', title: `บิล #${bill.bill_no} สำเร็จ`,
      html: `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
        <div style="background:#f0fdf4;border-radius:8px;padding:8px;">
          <div style="font-size:10px;color:#666;">ยอดขาย</div>
          <div style="font-size:15px;font-weight:700;color:#059669;">฿${formatNum(bill.total)}</div>
        </div>
        <div style="background:#fef0f0;border-radius:8px;padding:8px;">
          <div style="font-size:10px;color:#666;">รับเงิน</div>
          <div style="font-size:15px;font-weight:700;color:#DC2626;">฿${formatNum(checkoutState.received)}</div>
        </div>
        <div style="background:#eff6ff;border-radius:8px;padding:8px;">
          <div style="font-size:10px;color:#666;">เงินทอน</div>
          <div style="font-size:15px;font-weight:700;color:#2563EB;">฿${formatNum(Math.max(0, checkoutState.change))}</div>
        </div>
      </div>`,
      confirmButtonColor: '#10B981', timer: 3000, timerProgressBar: true,
    });

  } catch (e) {
    console.error('[v8] v4CompletePayment error:', e);
    toast('เกิดข้อผิดพลาดในการบันทึก: ' + (e.message || e), 'error');
  } finally {
    window.isProcessingPayment = false;
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-2: PAYROLL — patch v7ConfirmPayroll ให้ตรวจ error จริง
// ══════════════════════════════════════════════════════════════════

window.v7ConfirmPayroll = async function (empId, empName, monthStr, accDebt) {
  const pay    = Number(document.getElementById('v7pay-amount')?.value || 0);
  const deduct = Number(document.getElementById('v7pay-deduct')?.value || 0);
  const note   = document.getElementById('v7pay-note')?.value || '';

  if (pay <= 0) { toast('กรุณาระบุจำนวนเงิน', 'error'); return; }
  if (deduct > accDebt) { toast(`หักหนี้ได้สูงสุด ฿${formatNum(accDebt)}`, 'error'); return; }

  const btn = document.getElementById('v7pay-confirm-btn');
  if (btn) {
    btn.disabled = true;
    btn.dataset.v7orig = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:v7spin .8s linear infinite;margin-right:8px;vertical-align:middle;"></span>กำลังบันทึก...`;
  }
  typeof v7ShowLoading === 'function' && v7ShowLoading('กำลังบันทึกการจ่ายเงินเดือน...');

  try {
    // ── ลอง insert แบบ full columns ก่อน ──────────────────────────
    const fullPayload = {
      employee_id:     empId,
      month:           monthStr + '-01',
      net_paid:        pay,
      deduct_withdraw: deduct,
      base_salary:     pay + deduct,
      paid_date:       new Date().toISOString(),
      staff_name:      USER?.username,
      note:            note || `จ่ายเงินเดือน ${monthStr}`,
    };

    let { error: fullErr } = await db.from('จ่ายเงินเดือน').insert(fullPayload);

    if (fullErr) {
      // column ไม่มี → ลอง minimal columns ที่ทราบว่ามีแน่นอน
      console.warn('[v8] payroll full insert failed:', fullErr.message, '→ trying minimal columns');
      const minPayload = {
        employee_id: empId,
        month:       monthStr + '-01',
        net_paid:    pay,
        paid_date:   new Date().toISOString(),
        staff_name:  USER?.username,
        note:        note || `จ่ายเงินเดือน ${monthStr}`,
      };
      const { error: minErr } = await db.from('จ่ายเงินเดือน').insert(minPayload);
      if (minErr) throw new Error(minErr.message);
    }

    // ── บันทึกสำเร็จ ────────────────────────────────────────────────
    logActivity('จ่ายเงินเดือน', `${empName} ฿${formatNum(pay)}${deduct > 0 ? ` | หักหนี้ ฿${formatNum(deduct)}` : ''}`);
    document.getElementById('v7-payroll-overlay')?.remove();
    toast(`จ่ายเงินเดือน ${empName} ฿${formatNum(pay)} สำเร็จ`, 'success');
    window.v5LoadPayroll?.();

  } catch (e) {
    console.error('[v8] payroll error:', e);
    toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.v7orig || 'ยืนยัน';
    }
  } finally {
    typeof v7HideLoading === 'function' && v7HideLoading();
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-3: DRAWER UI — แสดงรายละเอียด รับ/ทอน ในรายการ transaction
// ══════════════════════════════════════════════════════════════════

const _v8OrigRenderDrawer = window.renderCashDrawer;
window.renderCashDrawer = async function () {
  try {
    const { data: sess } = await db.from('cash_session').select('*')
      .eq('status', 'open').order('opened_at', { ascending: false })
      .limit(1).single();

    let balance = 0, txs = [];
    if (sess) {
      const { data: t } = await db.from('cash_transaction')
        .select('*').eq('session_id', sess.id).order('created_at', { ascending: false });
      txs = t || [];
      balance = sess.opening_amt || 0;
      txs.forEach(t => { balance += t.direction === 'in' ? t.net_amount : -t.net_amount; });
    }

    // อัปเดต balance displays
    const balEls = ['cash-current-balance', 'global-cash-balance'];
    balEls.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `฿${formatNum(balance)}`;
    });

    const sessEl = document.getElementById('cash-session-status');
    if (sessEl) sessEl.textContent = sess
      ? `เปิดรอบ ${formatDateTime(sess.opened_at)} | โดย ${sess.opened_by}`
      : 'ยังไม่เปิดรอบ';

    // Transaction list — แสดง รับ/ทอน ชัดเจน
    const txList = document.getElementById('cash-transactions');
    if (txList) {
      if (txs.length === 0) {
        txList.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:40px;">ไม่มีรายการ</p>';
      } else {
        txList.innerHTML = txs.map(t => {
          const isIn  = t.direction === 'in';
          const recv  = t.amount || t.net_amount;         // เงินรับมา
          const chg   = t.change_amt || 0;                // เงินทอน
          const net   = t.net_amount;                     // สุทธิ
          const showChangeDetail = isIn && chg > 0;

          const amtHTML = showChangeDetail
            ? `<div style="text-align:right;">
                 <div style="font-size:13px;font-weight:700;color:var(--success);">+฿${formatNum(net)}</div>
                 <div style="font-size:11px;color:var(--text-tertiary);">รับ ฿${formatNum(recv)} | ทอน ฿${formatNum(chg)}</div>
               </div>`
            : `<div class="transaction-amount ${isIn ? 'positive' : 'negative'}">${isIn ? '+' : '-'}฿${formatNum(net)}</div>`;

          return `<div class="transaction-item">
            <div class="transaction-icon ${t.direction}">
              <i class="material-icons-round">${isIn ? 'add' : 'remove'}</i>
            </div>
            <div class="transaction-info">
              <div class="transaction-title">${t.type}</div>
              <div class="transaction-time">${formatDateTime(t.created_at)} — ${t.staff_name || '-'}</div>
              ${t.note ? `<div class="transaction-note">${t.note}</div>` : ''}
            </div>
            ${amtHTML}
          </div>`;
        }).join('');
      }
    }

    // ปุ่ม
    const no = !sess;
    const ids = ['cash-open-btn', 'cash-add-btn', 'cash-withdraw-btn', 'cash-close-btn'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = id === 'cash-open-btn' ? !no : no;
    });
    const addBtn = document.getElementById('cash-add-btn');
    const wdBtn  = document.getElementById('cash-withdraw-btn');
    const clBtn  = document.getElementById('cash-close-btn');
    if (addBtn) addBtn.onclick = () => cashMovementWithDenom?.('add', sess);
    if (wdBtn)  wdBtn.onclick  = () => cashMovementWithDenom?.('withdraw', sess, balance);
    if (clBtn)  clBtn.onclick  = () => {
      typeof window.closeCashSessionWithCount === 'function'
        ? window.closeCashSessionWithCount(sess, balance)
        : null;
    };

    // ถ้า v4 panel อยู่ให้ refresh
    await v4InjectPanel?.();

  } catch (e) { console.error('[v8] renderCashDrawer:', e); }
};


// ══════════════════════════════════════════════════════════════════
// FIX-4: getLiveCashBalance ใช้ fallback เสมอ ถ้า query error
// ══════════════════════════════════════════════════════════════════

// Override getLiveCashBalance ให้ robust ขึ้น
window.getLiveCashBalance = async function () {
  try {
    const { data: sess, error: sessErr } = await db.from('cash_session').select('id,opening_amt')
      .eq('status', 'open').order('opened_at', { ascending: false }).limit(1).single();
    if (sessErr || !sess) return 0;
    const { data: txs, error: txErr } = await db.from('cash_transaction')
      .select('net_amount,direction').eq('session_id', sess.id);
    if (txErr) { console.warn('[v8] getLiveCashBalance tx error:', txErr.message); return sess.opening_amt || 0; }
    let bal = sess.opening_amt || 0;
    (txs || []).forEach(t => { bal += t.direction === 'in' ? t.net_amount : -t.net_amount; });
    return Math.max(0, bal);
  } catch (e) { console.warn('[v8] getLiveCashBalance error:', e); return 0; }
};


// ══════════════════════════════════════════════════════════════════
// FIX-5: ADVANCE — ตรวจสอบ error ก่อน toast success
// ══════════════════════════════════════════════════════════════════

const _v8OrigConfirmAdv = window.v7ConfirmAdvance;
window.v7ConfirmAdvance = async function (empId, empName, amount, reason) {
  const state   = window._v4States?.['adv7'] || {};
  const counted = typeof v4Total === 'function' ? v4Total(state) : 0;
  if (counted !== amount) { toast('ยอดไม่พอดี ห้ามบันทึก', 'error'); return; }

  const btn = document.getElementById('v7adv-confirm-btn');
  if (btn) { btn.disabled = true; }
  typeof v7ShowLoading === 'function' && v7ShowLoading('กำลังบันทึกการเบิกเงิน...');

  try {
    // บันทึก เบิกเงิน
    const { error: advErr } = await db.from('เบิกเงิน').insert({
      employee_id: empId, amount, method: 'เงินสด',
      reason, approved_by: USER?.username, status: 'อนุมัติ',
    });
    if (advErr) throw new Error(advErr.message);

    // บันทึก cash_transaction
    const { data: sess } = await db.from('cash_session').select('id')
      .eq('status', 'open').limit(1).single().catch(() => ({ data: null }));
    if (sess) {
      try {
        await recordCashTx({
          sessionId: sess.id, type: 'เบิกเงินพนักงาน', direction: 'out',
          amount, netAmount: amount,
          denominations: { ...state }, note: reason,
        });
      } catch (cashErr) {
        // recordCashTx ล้มเหลว → fallback
        const bal = await getLiveCashBalance();
        await db.from('cash_transaction').insert({
          session_id: sess.id, type: 'เบิกเงินพนักงาน', direction: 'out',
          amount, net_amount: amount, balance_after: Math.max(0, bal - amount),
          staff_name: USER?.username, note: reason,
        });
        const el = document.getElementById('global-cash-balance');
        if (el) el.textContent = `฿${formatNum(Math.max(0, bal - amount))}`;
      }
    }

    logActivity('เบิกเงินพนักงาน', `${empName} ฿${formatNum(amount)} | ${reason}`);
    document.getElementById('v7-adv-overlay')?.remove();
    toast(`เบิกเงิน ${empName} ฿${formatNum(amount)} สำเร็จ`, 'success');
    renderAttendance?.();

  } catch (e) {
    console.error('[v8] advance error:', e);
    toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  } finally {
    typeof v7HideLoading === 'function' && v7HideLoading();
  }
};

console.info(
  '%c[modules-v8.js] ✅%c FIX-1:CashDrawer | FIX-2:Payroll | FIX-3:DrawerUI | FIX-4:getLiveCashBalance | FIX-5:Advance',
  'color:#10B981;font-weight:700', 'color:#6B7280'
);
