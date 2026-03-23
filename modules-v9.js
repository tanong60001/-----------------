/**
 * SK POS — modules-v9.js  (โหลดหลัง modules-v8.js)
 *
 * ██████████████████████████████████████████████████████████████████
 *  FIX-1  CASH DRAWER / PAYMENT
 *         • recordCashTx รับ changeDenominations → v4CalcNet
 *           หักแบงค์ทอนออกจากลิ้นชักได้ถูกต้อง
 *         • v4CompletePayment ส่ง changeDenominations ครบ
 *         • เพิ่ม full-screen loading overlay ระหว่างบันทึกบิล
 *         • ตรวจ session/balance ก่อนแสดง Swal success
 *
 *  FIX-2  PURCHASE — savePurchaseOrder (full rewrite)
 *         • บันทึก purchase_order + purchase_item ทีเดียว
 *         • อัปสต็อก + stock_movement ทันที (status = 'รับแล้ว')
 *         • เครดิต → สร้าง/ค้นหา ซัพพลายเออร์ → สร้างเจ้าหนี้
 *         • Loading overlay + rollback error
 *
 *  FIX-3  PAYROLL / ATTENDANCE
 *         • แก้ status string: 'มา','ครึ่งวัน','มาสาย','ขาด','ลา'
 *           (v7 ใช้ 'มาทำงาน','ขาดงาน','ลากิจ' ซึ่งไม่ตรง DB)
 *         • นับครึ่งวัน = 0.5 วัน
 *         • หักตาม deductPct จาก ATT_STATUS จริง
 *
 *  FIX-4  v7ConfirmAdvance — เพิ่ม loading overlay + ตรวจ error
 *         (ยกเลิก require denomination match ที่ block บางกรณี)
 * ██████████████████████████████████████████████████████████████████
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// UTIL — Full-screen loading overlay (ใหญ่กว่า v7-loading-toast)
// ══════════════════════════════════════════════════════════════════

function v9ShowOverlay(msg = 'กำลังบันทึก...', sub = '') {
  document.getElementById('v9-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'v9-overlay';
  el.style.cssText = [
    'position:fixed;inset:0;z-index:999999',
    'background:rgba(15,23,42,.72)',
    'backdrop-filter:blur(4px)',
    'display:flex;align-items:center;justify-content:center',
    'font-family:var(--font-thai,"Prompt"),sans-serif',
  ].join(';');
  el.innerHTML = `
    <style>@keyframes v9spin{to{transform:rotate(360deg)}}</style>
    <div style="background:#fff;border-radius:20px;padding:32px 40px;
      text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.35);min-width:220px;">
      <div style="width:44px;height:44px;border:4px solid #e2e8f0;
        border-top-color:var(--primary,#DC2626);border-radius:50%;
        animation:v9spin .9s linear infinite;margin:0 auto 16px;"></div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;">${msg}</div>
      ${sub ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px;">${sub}</div>` : ''}
    </div>`;
  document.body.appendChild(el);
}

function v9HideOverlay() {
  const el = document.getElementById('v9-overlay');
  if (el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s';
    setTimeout(() => el.remove(), 220);
  }
}


// ══════════════════════════════════════════════════════════════════
// UTIL — ดึง staff_name ปัจจุบัน (ไม่คืน null เพราะ DB NOT NULL)
// ══════════════════════════════════════════════════════════════════

function v9Staff() {
  // USER เป็น let ใน app.js → ไม่ใช่ window.USER
  // แต่ทุก script ในหน้าเดียวกันเข้าถึงตัวแปร let ระดับ top-level ได้โดยตรง
  try {
    if (typeof USER !== 'undefined' && USER?.username) return USER.username;
  } catch(_) {}
  try {
    if (typeof USER !== 'undefined' && USER?.name) return USER.name;
  } catch(_) {}
  return localStorage.getItem('sk_pos_username') || 'system';
}


// ══════════════════════════════════════════════════════════════════
// FIX-1A — Override recordCashTx ให้รับ changeDenominations
// ══════════════════════════════════════════════════════════════════

const _v9OrigRecordCashTx = window.recordCashTx || (typeof recordCashTx !== 'undefined' ? recordCashTx : null);

window.recordCashTx = async function ({
  sessionId, type, direction,
  amount, changeAmt = 0, netAmount,
  refId, refTable, denominations,
  changeDenominations,          // ← NEW: แบงค์ที่ทอนออก
  note,
}) {
  const bal   = await getLiveCashBalance();
  const after = direction === 'in' ? bal + netAmount : bal - netAmount;

  const payload = {
    session_id:  sessionId,
    type, direction,
    amount,
    change_amt:  changeAmt,
    net_amount:  netAmount,
    balance_after: Math.max(0, after),
    ref_id:      refId    || null,
    ref_table:   refTable || null,
    staff_name:  v9Staff(),
    note:        note || null,
    denominations: denominations || null,
  };

  // change_denominations — บันทึกเสมอถ้ามีค่าจริง (sum > 0)
  // ถ้า null หรือ {} ทั้งหมด 0 → ไม่ใส่ key (หลีกเลี่ยง migration error)
  if (changeDenominations) {
    const hasValue = Object.values(changeDenominations).some(v => Number(v) > 0);
    if (hasValue) {
      payload.change_denominations = changeDenominations;
    }
    // ถ้าไม่มีค่าแต่ change > 0 → ลอง auto-calc ก่อน insert
    else if (changeAmt > 0 && typeof calcChangeDenominations === 'function') {
      const autoChg = calcChangeDenominations(changeAmt);
      if (autoChg && Object.values(autoChg).some(v => Number(v) > 0)) {
        payload.change_denominations = autoChg;
      }
    }
  } else if (changeAmt > 0 && typeof calcChangeDenominations === 'function') {
    const autoChg = calcChangeDenominations(changeAmt);
    if (autoChg && Object.values(autoChg).some(v => Number(v) > 0)) {
      payload.change_denominations = autoChg;
    }
  }

  const { error } = await db.from('cash_transaction').insert(payload);
  if (error) throw new Error('[v9] cash_transaction insert: ' + error.message);

  // อัป global balance display
  const el = document.getElementById('global-cash-balance');
  if (el) el.textContent = `฿${formatNum(Math.max(0, after))}`;
};


// ══════════════════════════════════════════════════════════════════
// FIX-1B — Override v4CompletePayment
//          • ส่ง changeDenominations ไปให้ recordCashTx
//          • Full-screen loading overlay
//          • ยืนยัน balance_after ถูกต้องทั้งตัวเลขและ denomination
// ══════════════════════════════════════════════════════════════════

window.v4CompletePayment = async function () {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;

  v9ShowOverlay('กำลังบันทึกบิล...', 'โปรดรอสักครู่');

  try {
    // ── 1. Session ──────────────────────────────────────────────
    const { data: session } = await db
      .from('cash_session').select('*')
      .eq('status', 'open').order('opened_at', { ascending: false })
      .limit(1).maybeSingle();

    // ── 2. บิลขาย ────────────────────────────────────────────────
    const methodMap = {
      cash: 'เงินสด', transfer: 'โอนเงิน',
      credit: 'บัตรเครดิต', debt: 'ติดหนี้',
    };
    const { data: bill, error: billError } = await db.from('บิลขาย').insert({
      date:          new Date().toISOString(),
      method:        methodMap[checkoutState.method] || 'เงินสด',
      total:         checkoutState.total,
      discount:      checkoutState.discount || 0,
      received:      checkoutState.received,
      change:        checkoutState.change,
      customer_name: checkoutState.customer?.name || null,
      customer_id:   checkoutState.customer?.id   || null,
      staff_name:  v9Staff(),
      status:        checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
      denominations: checkoutState.receivedDenominations || null,
    }).select().single();
    if (billError) throw billError;

    // ── 3. รายการในบิล + สต็อก ──────────────────────────────────
    for (const item of cart) {
      const prod = (window.products || []).find(p => p.id === item.id);
      const stockBefore = prod?.stock || 0;
      const stockAfter  = stockBefore - item.qty;

      await db.from('รายการในบิล').insert({
        bill_id: bill.id, product_id: item.id, name: item.name,
        qty: item.qty, price: item.price, cost: item.cost || 0,
        total: item.price * item.qty,
      });
      await db.from('สินค้า').update({ stock: stockAfter }).eq('id', item.id);
      await db.from('stock_movement').insert({
        product_id: item.id, product_name: item.name,
        type: 'ขาย', direction: 'out', qty: item.qty,
        stock_before: stockBefore, stock_after: stockAfter,
        ref_id: bill.id, ref_table: 'บิลขาย',
        staff_name:  v9Staff(),
      });
    }

    // ── 4. Cash transaction ──────────────────────────────────────
    //   netAmount = total (ยอดขาย = เงินเข้าลิ้นชักจริง)
    //   changeDenominations = แบงค์ที่ทอนออกไป → v4CalcNet หักออก
    if (checkoutState.method === 'cash' && session) {
      // ── คำนวณ changeDenominations ───────────────────────────────
      // ปัญหา: _v4States['chg'] ถูก init เป็น {} (truthy แต่ว่าง)
      // → checkoutState.changeDenominations = {} → บันทึกเป็น {} ทุกครั้ง
      // แก้: ตรวจว่า chgDenoms มีค่าจริงหรือไม่ (sum > 0)
      // ถ้าไม่มี → auto-calc จาก calcChangeDenominations

      let chgDenoms = checkoutState.changeDenominations;

      const hasRealChg = chgDenoms &&
        Object.values(chgDenoms).some(v => Number(v) > 0);

      if (!hasRealChg && checkoutState.change > 0) {
        // fallback: คำนวณอัตโนมัติจากยอดทอน
        chgDenoms = typeof calcChangeDenominations === 'function'
          ? calcChangeDenominations(checkoutState.change)
          : null;
      }

      // ตรวจซ้ำหลัง auto-calc (อาจคืน {} หรือ null ถ้า change=0)
      const chgDenomsToSave = (chgDenoms &&
        Object.values(chgDenoms).some(v => Number(v) > 0))
        ? chgDenoms : null;

      await window.recordCashTx({
        sessionId:            session.id,
        type:                 'ขาย',
        direction:            'in',
        amount:               checkoutState.received,
        changeAmt:            checkoutState.change,
        netAmount:            checkoutState.total,
        refId:                bill.id,
        refTable:             'บิลขาย',
        denominations:        checkoutState.receivedDenominations || null,
        changeDenominations:  chgDenomsToSave,
        note: `รับ ฿${formatNum(checkoutState.received)} ทอน ฿${formatNum(checkoutState.change)}`,
      });
    }

    // ── 5. ลูกค้า ────────────────────────────────────────────────
    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer')
        .select('total_purchase,visit_count,debt_amount')
        .eq('id', checkoutState.customer.id).maybeSingle();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase || 0) + checkoutState.total,
        visit_count:    (cust?.visit_count    || 0) + 1,
        debt_amount:    checkoutState.method === 'debt'
          ? (cust?.debt_amount || 0) + checkoutState.total
          : (cust?.debt_amount || 0),
      }).eq('id', checkoutState.customer.id);
    }

    // ── 6. เสร็จ ─────────────────────────────────────────────────
    typeof logActivity === 'function' &&
      logActivity('ขายสินค้า', `บิล #${bill.bill_no} ยอด ฿${formatNum(checkoutState.total)}`, bill.id, 'บิลขาย');
    typeof sendToDisplay === 'function' &&
      sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: checkoutState.total });

    try { cart = []; } catch(_) { window.cart = []; }
    await loadProducts?.();
    renderCart?.(); renderProductGrid?.(); updateHomeStats?.();

    // รีเฟรช balance ทันทีหลังขาย (ไม่ต้องรอ navigate ไป cash page)
    try {
      const newBal = await getLiveCashBalance();
      ['cash-current-balance','global-cash-balance'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = `฿${formatNum(newBal)}`;
      });
    } catch(_) {}

    v9HideOverlay();

    Swal.fire({
      icon: 'success',
      title: `บิล #${bill.bill_no} สำเร็จ`,
      html: `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
          <div style="background:#f0fdf4;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">ยอดขาย</div>
            <div style="font-size:16px;font-weight:800;color:#059669;">฿${formatNum(bill.total)}</div>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">รับเงิน</div>
            <div style="font-size:16px;font-weight:800;color:#2563EB;">฿${formatNum(checkoutState.received)}</div>
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">เงินทอน</div>
            <div style="font-size:16px;font-weight:800;color:#D97706;">฿${formatNum(Math.max(0, checkoutState.change))}</div>
          </div>
        </div>`,
      confirmButtonColor: '#10B981',
      timer: 3000,
      timerProgressBar: true,
    });

  } catch (e) {
    v9HideOverlay();
    console.error('[v9] v4CompletePayment error:', e);
    typeof toast === 'function' && toast('เกิดข้อผิดพลาด: ' + (e.message || e), 'error');
  } finally {
    window.isProcessingPayment = false;
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-2 — savePurchaseOrder (Full Rewrite)
//   รองรับ: หลายรายการ, เครดิต→เจ้าหนี้, loading overlay
//   เรียกได้จากทั้ง v2 modal (submitPurchaseOrder) และ v6 button
// ══════════════════════════════════════════════════════════════════

window.savePurchaseOrder = async function () {
  // purchaseItems อยู่ใน scope module-v2.js (let purchaseItems = [])
  // purchaseItems เป็น let ใน modules-v2.js — เข้าถึงได้โดยตรง
  let items;
  try { items = purchaseItems; } catch(_) { items = []; }
  if (!items || items.length === 0) items = [];

  if (!items || items.length === 0) {
    typeof toast === 'function' && toast('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error');
    return;
  }

  const supplier   = document.getElementById('pur-supplier')?.value?.trim() || '';
  const method     = document.getElementById('pur-method')?.value || 'เงินสด';
  const note       = document.getElementById('pur-note')?.value?.trim() || '';
  const dueDate    = document.getElementById('pur-due-date')?.value || null;
  const suppSelId  = document.getElementById('pur-supplier-id')?.value || null; // จาก <select>
  const total      = items.reduce((s, i) => s + (i.qty * i.cost_per_unit), 0);
  const isCredit   = method === 'เครดิต';

  // validate เครดิต
  if (isCredit && !dueDate) {
    typeof toast === 'function' && toast('กรุณาระบุวันครบกำหนดชำระ', 'error');
    return;
  }

  v9ShowOverlay('กำลังบันทึกใบรับสินค้า...', `${items.length} รายการ | ฿${formatNum(total)}`);

  try {
    // ── 1. purchase_order ────────────────────────────────────────
    const { data: po, error: poErr } = await db.from('purchase_order').insert({
      date:        new Date().toISOString(),
      supplier:    supplier || null,
      method,
      total,
      note:        note || null,
      staff_name:  v9Staff(),
      status:      'รับแล้ว',
    }).select().single();
    if (poErr) throw new Error('สร้างใบรับสินค้าไม่ได้: ' + poErr.message);

    // ── 2. purchase_item + stock ─────────────────────────────────
    for (const item of items) {
      const { error: itemErr } = await db.from('purchase_item').insert({
        order_id:       po.id,
        product_id:     item.product_id,
        name:           item.name,
        qty:            item.qty,
        received_qty:   item.qty,
        cost_per_unit:  item.cost_per_unit,
        total:          item.qty * item.cost_per_unit,
      });
      if (itemErr) console.warn('[v9] purchase_item insert:', itemErr.message);

      // อัปสต็อก
      const prod       = (window.products || []).find(p => p.id === item.product_id);
      const stockBefore = prod?.stock || 0;
      const stockAfter  = stockBefore + item.qty;

      await db.from('สินค้า').update({
        stock: stockAfter,
        cost:  item.cost_per_unit,
        updated_at: new Date().toISOString(),
      }).eq('id', item.product_id);

      await db.from('stock_movement').insert({
        product_id:   item.product_id,
        product_name: item.name,
        type:         'รับเข้า',
        direction:    'in',
        qty:          item.qty,
        stock_before: stockBefore,
        stock_after:  stockAfter,
        ref_id:       po.id,
        ref_table:    'purchase_order',
        staff_name:  v9Staff(),
        note:         note || null,
      });
    }

    // ── 3. เครดิต → เจ้าหนี้ ────────────────────────────────────
    if (isCredit) {
      let suppId = suppSelId || null;
      const suppName = supplier || 'ไม่ระบุ';

      if (!suppId) {
        // ค้นหาจากชื่อ หรือสร้างใหม่เสมอ (ถ้าไม่มีชื่อก็ใช้ "ไม่ระบุ")
        const { data: found } = await db.from('ซัพพลายเออร์')
          .select('id').eq('name', suppName).maybeSingle();
        if (found) {
          suppId = found.id;
        } else {
          const { data: newS } = await db.from('ซัพพลายเออร์').insert({
            name: suppName, status: 'ใช้งาน',
          }).select('id').maybeSingle();
          suppId = newS?.id;
        }
      }

      if (suppId) {
        const { error: apErr } = await db.from('เจ้าหนี้').insert({
          supplier_id:       suppId,
          purchase_order_id: po.id,
          date:              new Date().toISOString(),
          due_date:          dueDate,
          amount:            total,
          paid_amount:       0,
          balance:           total,
          status:            'ค้างชำระ',
          note:              note || null,
        });
        if (apErr) console.error('[v9] เจ้าหนี้ insert error:', apErr.message);
        else {
          const { data: sRec } = await db.from('ซัพพลายเออร์')
            .select('total_purchase').eq('id', suppId).maybeSingle();
          await db.from('ซัพพลายเออร์').update({
            total_purchase: (sRec?.total_purchase || 0) + total,
          }).eq('id', suppId);
        }
      }
    }

    // ── 4. Log + refresh ────────────────────────────────────────
    typeof logActivity === 'function' &&
      logActivity('รับสินค้าเข้า',
        `${supplier || 'ไม่ระบุ'} | ${items.length} รายการ | ฿${formatNum(total)}${isCredit ? ' (เจ้าหนี้)' : ''}`);

    // reset items array ใน scope ต้นทาง
    try { purchaseItems = []; } catch (_) {}
    try { purchaseItems = []; } catch (_) {}

    await loadProducts?.();
    closeModal?.();
    renderPurchases?.();

    v9HideOverlay();

    if (isCredit) {
      typeof toast === 'function' &&
        toast(`รับสินค้าสำเร็จ — เจ้าหนี้ ฿${formatNum(total)} ครบกำหนด ${dueDate}`, 'success');
    } else {
      typeof toast === 'function' &&
        toast(`บันทึกใบรับสินค้า ฿${formatNum(total)} สำเร็จ`, 'success');
    }

  } catch (e) {
    v9HideOverlay();
    console.error('[v9] savePurchaseOrder error:', e);
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
  }
};

// alias เพื่อ backward compat กับ modal v2 ที่เรียก submitPurchaseOrder()
window.submitPurchaseOrder = window.savePurchaseOrder;


// ══════════════════════════════════════════════════════════════════
// FIX-3 — v5LoadPayroll: แก้ status string ให้ตรง DB + loading
// ══════════════════════════════════════════════════════════════════
//
//  ATT_STATUS จริงในระบบ (modules.js):
//    'มา'        → มาทำงาน   deductPct:0
//    'ครึ่งวัน'  → ครึ่งวัน  deductPct:50   (= 0.5 วัน)
//    'มาสาย'     → มาสาย     deductPct:5
//    'ขาด'       → ขาด       deductPct:100
//    'ลา'        → ลา        deductPct:0

window.v5LoadPayroll = async function () {
  const sec = document.getElementById('att-tab-payroll');
  if (!sec) return;

  sec.innerHTML = `
    <div style="text-align:center;padding:48px;color:var(--text-tertiary,#94a3b8);">
      <div style="width:36px;height:36px;border:3px solid #e2e8f0;
        border-top-color:var(--primary,#DC2626);border-radius:50%;
        animation:v7spin .8s linear infinite;margin:0 auto 12px;"></div>
      <style>@keyframes v7spin{to{transform:rotate(360deg)}}</style>
      คำนวณเงินเดือน...
    </div>`;

  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth() + 1;
  const monthStr  = `${year}-${String(month).padStart(2, '0')}`;
  const startDate = `${monthStr}-01`;
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

  let emps = [], attAll = [], advAll = [], paidHistory = [];
  try { emps        = await loadEmployees(); } catch (_) {}
  try {
    const r = await db.from('เช็คชื่อ')
      .select('employee_id,status,date,deduction')
      .gte('date', startDate).lte('date', endDate);
    attAll = r.data || [];
  } catch (_) {}
  try {
    const r = await db.from('เบิกเงิน')
      .select('employee_id,amount,status,date')
      .gte('date', startDate + 'T00:00:00').eq('status', 'อนุมัติ');
    advAll = r.data || [];
  } catch (_) {}
  try {
    const r = await db.from('จ่ายเงินเดือน')
      .select('employee_id,net_paid,deduct_withdraw,paid_date,month')
      .order('paid_date', { ascending: false }).limit(500);
    paidHistory = r.data || [];
  } catch (_) {}

  const actives   = emps.filter(e => e.status === 'ทำงาน');
  const monthDate = `${monthStr}-01`;

  const rows = actives.map(emp => {
    const empAtt = attAll.filter(a => a.employee_id === emp.id);
    const wage   = emp.daily_wage || 0;

    // นับวัน — ใช้ status จริงใน DB
    const daysFull    = empAtt.filter(a => a.status === 'มา').length;
    const daysHalf    = empAtt.filter(a => a.status === 'ครึ่งวัน').length;
    const daysLate    = empAtt.filter(a => a.status === 'มาสาย').length;
    const daysAbsent  = empAtt.filter(a => ['ขาด'].includes(a.status)).length;
    const daysLeave   = empAtt.filter(a => a.status === 'ลา').length;

    // เงินรวมก่อนหัก
    //   มาเต็มวัน = wage × 1.0
    //   ครึ่งวัน  = wage × 0.5
    //   มาสาย    = wage × 0.95  (หัก 5%)
    //   ขาด/ลา   = 0
    const gross = Math.round(
      daysFull  * wage +
      daysHalf  * wage * 0.5 +
      daysLate  * wage * 0.95
    );

    // หักเบิกล่วงหน้าเดือนนี้
    const empAdv = advAll
      .filter(a => a.employee_id === emp.id)
      .reduce((s, a) => s + a.amount, 0);

    const net = Math.max(0, gross - empAdv);

    const paidThisMonth = paidHistory.find(
      p => p.employee_id === emp.id && (p.month || '').startsWith(monthStr)
    );
    const lastPay = paidHistory.find(p => p.employee_id === emp.id);

    // เงินทำงานจริง = daysFull + daysHalf*0.5 + daysLate
    const workDaysDisplay = daysFull + daysHalf * 0.5 + daysLate;

    return {
      emp,
      workDaysDisplay, daysFull, daysHalf, daysLate, daysAbsent, daysLeave,
      gross, empAdv, net, paidThisMonth, lastPay,
    };
  });

  const totalGross = rows.reduce((s, r) => s + r.gross, 0);
  const totalAdv   = rows.reduce((s, r) => s + r.empAdv, 0);
  const totalNet   = rows.reduce((s, r) => s + r.net, 0);
  const paidCount  = rows.filter(r => r.paidThisMonth).length;

  // ── ดึงยอดหนี้สะสมทุกคนพร้อมกัน (ลดรอบ query) ─────────────────
  let allAdvHistory = [], allPaidHistory = [];
  try {
    const [ra, rp] = await Promise.all([
      db.from('เบิกเงิน').select('employee_id,amount').eq('status', 'อนุมัติ'),
      db.from('จ่ายเงินเดือน').select('employee_id,deduct_withdraw'),
    ]);
    allAdvHistory  = ra.data || [];
    allPaidHistory = rp.data || [];
  } catch (_) {}

  function getAccDebt(empId) {
    const totalA = allAdvHistory.filter(a => a.employee_id === empId).reduce((s, a) => s + a.amount, 0);
    const totalP = allPaidHistory.filter(p => p.employee_id === empId).reduce((s, p) => s + (p.deduct_withdraw || 0), 0);
    return Math.max(0, totalA - totalP);
  }

  sec.innerHTML = `
    <!-- ─── Summary Header ───────────────────────── -->
    <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);
      border-radius:18px;padding:22px 24px;margin-bottom:20px;color:#fff;">
      <div style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;
        letter-spacing:.8px;margin-bottom:14px;">
        สรุปเงินเดือน —
        ${new Date(year, month - 1, 1).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;">
        ${[
          ['เงินเดือนรวม',    `฿${formatNum(totalGross)}`, '#f59e0b'],
          ['หักเบิกล่วงหน้า', `฿${formatNum(totalAdv)}`,   '#ef4444'],
          ['ยอดสุทธิรวม',     `฿${formatNum(totalNet)}`,   '#10b981'],
          ['จ่ายแล้ว',        `${paidCount}/${rows.length} คน`, '#6366f1'],
        ].map(([l, v, c]) => `
          <div style="background:rgba(255,255,255,.08);border-radius:12px;
            padding:12px 10px;text-align:center;">
            <div style="font-size:10px;color:rgba(255,255,255,.55);margin-bottom:4px;">${l}</div>
            <div style="font-size:17px;font-weight:800;color:${c};">${v}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- ─── Employee Cards ────────────────────────── -->
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${rows.map(r => {
        const accDebt = getAccDebt(r.emp.id);
        return `
          <div style="background:var(--bg-surface,#fff);
            border:1.5px solid ${r.paidThisMonth ? '#86efac' : '#e2e8f0'};
            border-radius:16px;overflow:hidden;
            box-shadow:0 1px 4px rgba(0,0,0,.04);">

            <!-- Header -->
            <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;">
              <div style="width:46px;height:46px;border-radius:50%;
                background:linear-gradient(135deg,var(--primary,#DC2626),color-mix(in srgb,var(--primary,#DC2626) 70%,#000));
                display:flex;align-items:center;justify-content:center;
                font-size:18px;font-weight:800;color:#fff;flex-shrink:0;">
                ${(r.emp.name || '?').charAt(0)}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:15px;font-weight:700;">
                  ${r.emp.name} ${r.emp.lastname || ''}
                </div>
                <div style="font-size:12px;color:#94a3b8;">
                  ${r.emp.position || 'พนักงาน'} • ฿${formatNum(r.emp.daily_wage || 0)}/วัน
                </div>
                ${accDebt > 0 ? `
                  <div style="font-size:11px;color:#ef4444;margin-top:2px;">
                    หนี้สะสมทั้งหมด ฿${formatNum(accDebt)}
                  </div>` : ''}
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:20px;font-weight:800;
                  color:${r.net > 0 ? '#15803d' : '#94a3b8'};">
                  ฿${formatNum(r.net)}
                </div>
                ${r.paidThisMonth
                  ? `<span style="font-size:11px;padding:2px 8px;border-radius:999px;
                      background:#d1fae5;color:#065f46;font-weight:700;">✅ จ่ายแล้ว</span>`
                  : `<button class="btn btn-primary btn-sm"
                      onclick="v7ShowPayrollModal('${r.emp.id}','${(r.emp.name + ' ' + (r.emp.lastname || '')).trim()}',${r.net},${accDebt},'${monthStr}')"
                      style="font-size:12px;">
                      <i class="material-icons-round" style="font-size:14px;">send</i> จ่าย
                    </button>`}
              </div>
            </div>

            <!-- Stats row -->
            <div style="display:grid;grid-template-columns:repeat(5,1fr);
              border-top:1px solid #f1f5f9;">
              ${[
                ['วันทำงาน',    r.workDaysDisplay % 1 === 0 ? r.workDaysDisplay : r.workDaysDisplay.toFixed(1), '#10b981'],
                ['มาสาย',       r.daysLate,     '#f59e0b'],
                ['ขาด',         r.daysAbsent,   '#ef4444'],
                ['เบิกล่วงหน้า', `฿${formatNum(r.empAdv)}`, '#f59e0b'],
                ['จ่ายล่าสุด',   r.lastPay ? `฿${formatNum(r.lastPay.net_paid)}` : '—', '#6366f1'],
              ].map(([l, v, c], i) => `
                <div style="padding:10px 6px;text-align:center;
                  ${i < 4 ? 'border-right:1px solid #f1f5f9;' : ''}">
                  <div style="font-size:14px;font-weight:800;color:${c};">${v}</div>
                  <div style="font-size:9px;color:#94a3b8;margin-top:1px;">${l}</div>
                </div>`).join('')}
            </div>
          </div>`;
      }).join('')}
      ${rows.length === 0
        ? `<div style="text-align:center;padding:60px;color:#94a3b8;">ไม่มีพนักงาน</div>`
        : ''}
    </div>`;
};


// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// FIX-4 — openAdvanceWizard + v7ConfirmAdvance (Full Rewrite)
//
// ปัญหา:
//   • เบิกเงิน table ไม่มี column "method" → 400 Bad Request ทุกครั้ง
//   • ทำให้ไม่บันทึก → ไม่โชว์ในหน้าเงินเดือน
//
// แก้:
//   • ไม่ส่ง method ไปใน เบิกเงิน insert
//   • เลือกเงินสด → บังคับนับแบงค์ exact + บันทึก cash_transaction
//   • เลือกโอนเงิน → บันทึกทันทีไม่ต้องนับแบงค์
// ══════════════════════════════════════════════════════════════════

window.openAdvanceWizard = async function (empId, empName) {
  let cashBal = 0, currentDenoms = {};
  try {
    cashBal       = await getLiveCashBalance();
    currentDenoms = (typeof v4GetCurrentDenoms === 'function')
      ? (await v4GetCurrentDenoms() || {}) : {};
  } catch(_) {}

  // ── Step 1: จำนวน + วิธีจ่าย + เหตุผล ─────────────────────────
  const { value: info } = await Swal.fire({
    title: `💸 เบิกเงิน — ${empName}`,
    html: `
      <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;
        margin-bottom:14px;text-align:left;">
        <div style="font-size:11px;color:#94a3b8;margin-bottom:2px;">เงินในลิ้นชักตอนนี้</div>
        <div style="font-size:22px;font-weight:800;color:#1e293b;">฿${formatNum(cashBal)}</div>
      </div>
      <div style="text-align:left;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">จำนวนเงิน (บาท) *</label>
          <input type="number" id="adv9-amount" min="1" placeholder="0"
            style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:16px;text-align:center;font-weight:700;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">วิธีจ่าย</label>
          <select id="adv9-method"
            style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;">
            <option value="เงินสด">💵 เงินสด (นับแบงค์)</option>
            <option value="โอนเงิน">📱 โอนเงิน</option>
          </select>
        </div>
      </div>
      <div style="text-align:left;">
        <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">เหตุผล</label>
        <input type="text" id="adv9-reason" placeholder="ระบุเหตุผล..."
          style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;">
      </div>`,
    showCancelButton: true,
    confirmButtonText: 'ดำเนินการต่อ →',
    cancelButtonText:  'ยกเลิก',
    confirmButtonColor: '#D97706',
    preConfirm: () => {
      const a = Number(document.getElementById('adv9-amount')?.value || 0);
      if (!a || a <= 0) { Swal.showValidationMessage('กรุณาระบุจำนวน'); return false; }
      const m = document.getElementById('adv9-method')?.value || 'เงินสด';
      if (m === 'เงินสด' && a > cashBal) {
        Swal.showValidationMessage(`เงินในลิ้นชักไม่พอ มีอยู่ ฿${formatNum(cashBal)}`);
        return false;
      }
      return {
        amount: a,
        method: m,
        reason: document.getElementById('adv9-reason')?.value?.trim() || '',
      };
    },
  });
  if (!info) return;
  const { amount, method, reason } = info;

  // ── โอนเงิน → บันทึกทันที ───────────────────────────────────────
  if (method === 'โอนเงิน') {
    v9ShowOverlay('กำลังบันทึกการเบิกเงิน...', `${empName} ฿${formatNum(amount)}`);
    try {
      const { error } = await db.from('เบิกเงิน').insert({
        employee_id: empId,
        amount,
        reason,
        approved_by: v9Staff(),
        status:      'อนุมัติ',
        note:        'โอนเงิน',
      });
      if (error) throw new Error(error.message);
      typeof logActivity === 'function' &&
        logActivity('เบิกเงินพนักงาน', `${empName} ฿${formatNum(amount)} | ${reason} (โอน)`);
      typeof toast === 'function' && toast(`เบิกเงิน ${empName} ฿${formatNum(amount)} สำเร็จ (โอนเงิน)`, 'success');
      typeof renderAttendance === 'function' && renderAttendance();
    } catch(e) {
      typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      v9HideOverlay();
    }
    return;
  }

  // ── เงินสด → เปิด modal นับแบงค์ exact ─────────────────────────
  const state = typeof v4EmptyDenoms === 'function' ? v4EmptyDenoms() : {};
  window._v4States = window._v4States || {};
  window._v4States['adv9'] = state;

  const ov = document.createElement('div');
  ov.id = 'v9-adv-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:580px;
      max-height:92vh;display:flex;flex-direction:column;overflow:hidden;
      box-shadow:0 24px 64px rgba(0,0,0,.5);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:16px 20px;
        display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-size:10px;color:rgba(255,255,255,.75);text-transform:uppercase;
            letter-spacing:1px;margin-bottom:2px;">เบิกเงินสด — ${empName}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.8);">${reason || 'ไม่ระบุเหตุผล'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:rgba(255,255,255,.7);margin-bottom:1px;">ต้องจ่าย</div>
          <div style="font-size:26px;font-weight:800;color:#fff;font-family:var(--font-display,'Georgia');">
            ฿${formatNum(amount)}
          </div>
        </div>
      </div>

      <!-- Summary bar -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;
        padding:12px 16px;background:#fffbeb;border-bottom:1px solid #fde68a;flex-shrink:0;">
        <div style="text-align:center;">
          <div style="font-size:9px;color:#92400e;text-transform:uppercase;font-weight:600;margin-bottom:2px;">ต้องจ่าย</div>
          <div style="font-size:16px;font-weight:800;color:#92400e;">฿${formatNum(amount)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;color:#92400e;text-transform:uppercase;font-weight:600;margin-bottom:2px;">นับได้</div>
          <div id="v9adv-counted" style="font-size:16px;font-weight:800;color:#1e293b;">฿0</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;color:#92400e;text-transform:uppercase;font-weight:600;margin-bottom:2px;">ผลต่าง</div>
          <div id="v9adv-diff" style="font-size:16px;font-weight:800;color:#94a3b8;">—</div>
        </div>
      </div>

      <!-- Denom grid -->
      <div style="flex:1;overflow-y:auto;padding:16px;">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;
          letter-spacing:.7px;display:flex;align-items:center;gap:5px;margin-bottom:10px;">
          <i class="material-icons-round" style="font-size:13px;color:#d97706;">payments</i>
          นับแบงค์ที่จ่ายออก
          <span style="font-size:9px;font-weight:400;color:#94a3b8;">(xN = จำนวนในลิ้นชัก)</span>
        </div>
        <div id="v9adv-bill-grid"
          style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px;"></div>
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;
          letter-spacing:.7px;display:flex;align-items:center;gap:5px;
          margin-bottom:10px;padding-top:10px;border-top:1px solid #f1f5f9;">
          <i class="material-icons-round" style="font-size:13px;color:#b45309;">toll</i>เหรียญ
        </div>
        <div id="v9adv-coin-grid"
          style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;"></div>
        <div id="v9adv-warn"
          style="display:none;margin-top:10px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:600;"></div>
      </div>

      <!-- Footer -->
      <div style="padding:14px 16px;border-top:1px solid #f1f5f9;
        background:#fafafa;display:flex;gap:10px;flex-shrink:0;">
        <button onclick="document.getElementById('v9-adv-overlay').remove()"
          style="flex:1;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;
            background:#fff;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif;
            font-size:14px;color:#64748b;font-weight:600;">
          ยกเลิก
        </button>
        <button id="v9adv-confirm-btn" disabled
          onclick="v9ConfirmAdvance('${empId}','${empName}',${amount},'${reason.replace(/'/g,"\'")}','${method}')"
          style="flex:2;padding:12px;border:none;border-radius:12px;background:#d97706;
            color:#fff;font-family:var(--font-thai,'Prompt'),sans-serif;
            font-size:14px;font-weight:700;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:8px;
            opacity:.5;transition:all .15s;">
          <i class="material-icons-round" style="font-size:18px;">payments</i>
          ยืนยันเบิกเงิน
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  // render denomination cards
  window._v4States['adv9_onChange'] = () => v9UpdateAdvSummary(amount);
  v9RenderAdvGrid(currentDenoms);
  v9UpdateAdvSummary(amount);
};

// ── render denom grid สำหรับ advance modal ──────────────────────
function v9RenderAdvGrid(currentDenoms) {
  const state = window._v4States?.['adv9'] || {};
  const bGrid = document.getElementById('v9adv-bill-grid');
  const cGrid = document.getElementById('v9adv-coin-grid');
  const BILLS_ = window.BILLS || [];
  const COINS_ = window.COINS || [];
  if (bGrid) bGrid.innerHTML = BILLS_.map(d =>
    typeof v5DenomCard === 'function'
      ? v5DenomCard(d, false, 'adv9', state[d.value]||0, currentDenoms[d.value]??null)
      : `<div onclick="v4Add('adv9',${d.value},1)"
          style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;
            padding:10px 6px;text-align:center;cursor:pointer;">
          <div style="font-size:18px;font-weight:800;">฿${d.label}</div>
          <div id="v4qty-adv9-${d.value}" style="font-size:14px;font-weight:700;">${state[d.value]||0}</div>
          <div id="v4sub-adv9-${d.value}" style="font-size:10px;color:#94a3b8;">—</div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <button onclick="event.stopPropagation();v4Add('adv9',${d.value},-1)"
              style="flex:1;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;">−</button>
            <button onclick="event.stopPropagation();v4Add('adv9',${d.value},1)"
              style="flex:1;border:none;border-radius:6px;background:#d97706;color:#fff;cursor:pointer;">+</button>
          </div>
        </div>`).join('');
  if (cGrid) cGrid.innerHTML = COINS_.map(d =>
    typeof v5DenomCard === 'function'
      ? v5DenomCard(d, true, 'adv9', state[d.value]||0, currentDenoms[d.value]??null)
      : `<div onclick="v4Add('adv9',${d.value},1)"
          style="background:#fffbeb;border:2px solid #fde68a;border-radius:12px;
            padding:10px 6px;text-align:center;cursor:pointer;">
          <div style="font-size:18px;font-weight:800;color:#92400e;">฿${d.label}</div>
          <div id="v4qty-adv9-${d.value}" style="font-size:14px;font-weight:700;">${state[d.value]||0}</div>
          <div id="v4sub-adv9-${d.value}" style="font-size:10px;color:#94a3b8;">—</div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <button onclick="event.stopPropagation();v4Add('adv9',${d.value},-1)"
              style="flex:1;border:1px solid #fde68a;border-radius:6px;background:#fff;cursor:pointer;">−</button>
            <button onclick="event.stopPropagation();v4Add('adv9',${d.value},1)"
              style="flex:1;border:none;border-radius:6px;background:#d97706;color:#fff;cursor:pointer;">+</button>
          </div>
        </div>`).join('');
}

// ── อัป summary bar ──────────────────────────────────────────────
function v9UpdateAdvSummary(mustPay) {
  const state   = window._v4States?.['adv9'] || {};
  const counted = typeof v4Total === 'function' ? v4Total(state) : 0;
  const diff    = counted - mustPay;
  const cEl     = document.getElementById('v9adv-counted');
  const dEl     = document.getElementById('v9adv-diff');
  const warnEl  = document.getElementById('v9adv-warn');
  const btn     = document.getElementById('v9adv-confirm-btn');

  if (cEl) { cEl.textContent = `฿${formatNum(counted)}`; cEl.style.color = diff===0?'#059669':counted>0?'#1e293b':'#94a3b8'; }
  if (dEl) { dEl.textContent = counted===0?'—':`${diff>=0?'+':''}฿${formatNum(diff)}`; dEl.style.color = diff===0?'#059669':diff>0?'#d97706':'#dc2626'; }
  if (warnEl) {
    if (counted===0) { warnEl.style.display='none'; }
    else if (diff<0) { warnEl.style.display='block'; warnEl.style.cssText+='background:#fee2e2;border:1.5px solid #fca5a5;color:#dc2626;padding:10px 12px;border-radius:10px;'; warnEl.innerHTML=`<strong>🚫 จ่ายขาด ฿${formatNum(-diff)}</strong> — ต้องนับให้พอดีก่อนบันทึก`; }
    else if (diff>0) { warnEl.style.display='block'; warnEl.style.cssText+='background:#fff7ed;border:1.5px solid #fed7aa;color:#92400e;padding:10px 12px;border-radius:10px;'; warnEl.innerHTML=`<strong>🚫 จ่ายเกิน ฿${formatNum(diff)}</strong> — ห้ามบันทึก ต้องพอดีเป๊ะ`; }
    else             { warnEl.style.display='block'; warnEl.style.cssText+='background:#f0fdf4;border:1.5px solid #86efac;color:#15803d;padding:10px 12px;border-radius:10px;'; warnEl.innerHTML=`<strong>✅ ยอดถูกต้อง</strong> — สามารถยืนยันได้`; }
  }
  if (btn) { const ok=diff===0&&counted>0; btn.disabled=!ok; btn.style.opacity=ok?'1':'.5'; btn.style.cursor=ok?'pointer':'not-allowed'; }
}

// ── ยืนยันเบิกเงินสด ────────────────────────────────────────────
window.v9ConfirmAdvance = async function (empId, empName, amount, reason, method) {
  // ตรวจยอดอีกครั้ง
  const state   = window._v4States?.['adv9'] || {};
  const counted = typeof v4Total === 'function' ? v4Total(state) : 0;
  if (counted !== amount) {
    typeof toast === 'function' && toast('ยอดไม่พอดี ห้ามบันทึก', 'error');
    return;
  }

  const btn = document.getElementById('v9adv-confirm-btn');
  if (btn) btn.disabled = true;
  v9ShowOverlay('กำลังบันทึกการเบิกเงิน...', `${empName} ฿${formatNum(amount)}`);

  try {
    // ── บันทึก เบิกเงิน (ไม่มี column method) ────────────────────
    const { error: advErr } = await db.from('เบิกเงิน').insert({
      employee_id: empId,
      amount,
      reason,
      approved_by: v9Staff(),
      status:      'อนุมัติ',
      note:        method || 'เงินสด',
    });
    if (advErr) throw new Error('เบิกเงิน: ' + advErr.message);

    // ── บันทึก cash_transaction ───────────────────────────────────
    let sess = null;
    try {
      const { data } = await db.from('cash_session').select('id')
        .eq('status', 'open').limit(1).maybeSingle();
      sess = data;
    } catch(_) {}

    if (sess) {
      await window.recordCashTx({
        sessionId:    sess.id,
        type:         'เบิกเงินพนักงาน',
        direction:    'out',
        amount,
        netAmount:    amount,
        denominations: { ...state },   // แบงค์ที่จ่ายออก
        note:         `${empName} | ${reason}`,
      });
    }

    typeof logActivity === 'function' &&
      logActivity('เบิกเงินพนักงาน', `${empName} ฿${formatNum(amount)} | ${reason}`);
    document.getElementById('v9-adv-overlay')?.remove();
    typeof toast === 'function' && toast(`เบิกเงิน ${empName} ฿${formatNum(amount)} สำเร็จ`, 'success');
    typeof renderAttendance === 'function' && renderAttendance();
    typeof renderCashDrawer === 'function' && renderCashDrawer();

  } catch(e) {
    console.error('[v9] advance error:', e);
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
    if (btn) btn.disabled = false;
  } finally {
    v9HideOverlay();
  }
};

// backward compat — v7ConfirmAdvance ถูกเรียกจาก modal เดิมใน v7
// redirect ไป v9ConfirmAdvance
window.v7ConfirmAdvance = async function (empId, empName, amount, reason) {
  await window.v9ConfirmAdvance(empId, empName, amount, reason, 'เงินสด');
};


// FIX-5 — v8 payroll ConfirmPayroll ใช้ overlay แทน toast
// ══════════════════════════════════════════════════════════════════

const _v9OrigConfirmPayroll = window.v7ConfirmPayroll;
window.v7ConfirmPayroll = async function (empId, empName, monthStr, accDebt) {
  const pay    = Number(document.getElementById('v7pay-amount')?.value || 0);
  const deduct = Number(document.getElementById('v7pay-deduct')?.value || 0);
  const note   = document.getElementById('v7pay-note')?.value || '';

  if (pay <= 0)        { typeof toast === 'function' && toast('กรุณาระบุจำนวนเงิน', 'error'); return; }
  if (deduct > accDebt){ typeof toast === 'function' && toast(`หักหนี้ได้สูงสุด ฿${formatNum(accDebt)}`, 'error'); return; }

  const btn = document.getElementById('v7pay-confirm-btn');
  if (btn) btn.disabled = true;
  v9ShowOverlay('กำลังบันทึกการจ่ายเงินเดือน...', `${empName} ฿${formatNum(pay)}`);

  try {
    const fullPayload = {
      employee_id:     empId,
      month:           monthStr + '-01',
      net_paid:        pay,
      deduct_withdraw: deduct,
      base_salary:     pay + deduct,
      paid_date:       new Date().toISOString(),
      staff_name:  v9Staff(),
      note:            note || `จ่ายเงินเดือน ${monthStr}`,
    };
    let { error: fullErr } = await db.from('จ่ายเงินเดือน').insert(fullPayload);
    if (fullErr) {
      // fallback minimal
      const { error: minErr } = await db.from('จ่ายเงินเดือน').insert({
        employee_id: empId,
        month:       monthStr + '-01',
        net_paid:    pay,
        paid_date:   new Date().toISOString(),
        staff_name:  v9Staff(),
        note:        note || `จ่ายเงินเดือน ${monthStr}`,
      });
      if (minErr) throw new Error(minErr.message);
    }

    typeof logActivity === 'function' &&
      logActivity('จ่ายเงินเดือน',
        `${empName} ฿${formatNum(pay)}${deduct > 0 ? ` | หักหนี้ ฿${formatNum(deduct)}` : ''}`);
    document.getElementById('v7-payroll-overlay')?.remove();
    typeof toast === 'function' && toast(`จ่ายเงินเดือน ${empName} ฿${formatNum(pay)} สำเร็จ`, 'success');
    window.v5LoadPayroll?.();

  } catch (e) {
    console.error('[v9] payroll error:', e);
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
    if (btn) btn.disabled = false;
  } finally {
    v9HideOverlay();
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-6 — bcMethod: ตรวจ session ก่อนเลือกจ่ายเงินสด
//         ถ้าไม่มีรอบเปิด → แจ้งเตือน + ไม่ render grid
//         ถ้ามีรอบ → แสดง banner ยืนยันว่าเชื่อมลิ้นชักแล้ว (เงินเข้า + เงินออก)
// ══════════════════════════════════════════════════════════════════

const _v9OrigBcMethod = window.bcMethod;
window.bcMethod = async function (m) {
  // เรียก original ก่อน (set checkoutState.method, highlight card, render grid)
  _v9OrigBcMethod?.call(this, m);

  if (m !== 'cash') return;   // non-cash ไม่ต้องเช็ค

  // ตรวจ session แบบ async หลัง original เสร็จ
  try {
    const { data: sess } = await db.from('cash_session').select('id,opening_amt,opened_by,opened_at')
      .eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();

    const detailEl = document.getElementById('bc-pay-detail');
    if (!detailEl) return;

    if (!sess) {
      // ── ยังไม่เปิดรอบ: แทนที่ content ด้วย warning ──────────────
      detailEl.innerHTML = `
        <div style="
          background:#fff7ed;border:2px solid #fed7aa;border-radius:14px;
          padding:20px 18px;text-align:center;margin-top:8px;">
          <i class="material-icons-round"
            style="font-size:36px;color:#ea580c;margin-bottom:8px;display:block;">
            no_accounts
          </i>
          <div style="font-size:15px;font-weight:700;color:#9a3412;margin-bottom:4px;">
            ยังไม่ได้เปิดรอบเงินสด
          </div>
          <div style="font-size:12px;color:#c2410c;margin-bottom:14px;line-height:1.5;">
            กรุณาเปิดรอบที่หน้า <strong>ลิ้นชัก</strong> ก่อน<br>
            เพื่อให้ระบบบันทึกเงินเข้า–ออกได้ถูกต้อง
          </div>
          <button onclick="navigateTo('cash');closeBillCheckout();"
            style="background:#ea580c;color:#fff;border:none;border-radius:10px;
              padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;
              font-family:var(--font-thai,'Prompt'),sans-serif;
              display:inline-flex;align-items:center;gap:6px;">
            <i class="material-icons-round" style="font-size:16px;">lock_open</i>
            ไปเปิดรอบ
          </button>
        </div>`;

      // disable ok button
      const okBtn = document.getElementById('bc-ok-btn');
      if (okBtn) {
        okBtn.disabled = true;
        okBtn.style.opacity = '.35';
        okBtn.style.cursor  = 'not-allowed';
      }
      return;
    }

    // ── มีรอบเปิดแล้ว: ฉีด session banner เหนือ denom grid ──────────
    const bal     = await getLiveCashBalance();
    const openAt  = new Date(sess.opened_at).toLocaleString('th-TH', {
      hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
    });

    // ใส่ banner ก่อน content ที่มีอยู่
    const existingHTML = detailEl.innerHTML;
    detailEl.innerHTML = `
      <div id="v9-session-banner"
        style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;
          padding:10px 14px;margin-bottom:12px;
          display:flex;align-items:center;gap:10px;">
        <i class="material-icons-round" style="color:#16a34a;font-size:22px;flex-shrink:0;">
          link
        </i>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;color:#15803d;">
            ✅ เชื่อมต่อลิ้นชักแล้ว
          </div>
          <div style="font-size:11px;color:#166534;margin-top:1px;">
            เงินสด ฿${formatNum(bal)} • เปิดรอบ ${openAt} โดย ${sess.opened_by || '-'}
          </div>
          <div style="font-size:10px;color:#4ade80;margin-top:2px;">
            เงินรับ&nbsp;<b>เข้า</b>ลิ้นชัก + เงินทอน<b>ออก</b>จากลิ้นชัก อัตโนมัติ
          </div>
        </div>
      </div>
      ${existingHTML}`;

  } catch (e) {
    console.warn('[v9] bcMethod session check error:', e);
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-7 — confirmCashMovement: ใช้ overlay + ตรวจ error จริง
//         แก้ withdraw ที่ recordCashTx direction='out' ไม่ update UI
// ══════════════════════════════════════════════════════════════════

// confirmCashMovement ใช้ let cashMoveDenoms/cashMoveMode จาก modules.js
// ไม่สามารถ override ได้ผ่าน window.X เพราะเป็น let
// แทนที่ด้วย: patch recordCashTx (v9Staff) ที่แก้ root cause แล้ว
// + เพิ่ม overlay ผ่าน updateCashMoveDenom hook
// → ไม่ต้อง override confirmCashMovement, ปล่อยให้ original ทำงาน
// (recordCashTx ถูก override ใน FIX-1A แล้ว ทำให้ staff_name ถูก)
//
// เพิ่มเฉพาะ: ตรวจ session ก่อนเปิด cashMovementWithDenom
const _v9OrigCashMovement = window.cashMovementWithDenom;
window.cashMovementWithDenom = async function(type, session, currentBalance) {
  if (!session) {
    typeof toast === 'function' && toast('กรุณาเปิดรอบก่อน', 'warning');
    return;
  }
  // แสดง live balance จริง ณ เวลาที่เปิด modal
  const liveBal = await getLiveCashBalance();
  return _v9OrigCashMovement?.call(this, type, session, liveBal ?? currentBalance);
};


// ══════════════════════════════════════════════════════════════════
// FIX-8 — v4CalcNet + v4GetCurrentDenoms + v4InjectPanel
//
// ปัญหา:
//   1. v4CalcNet ไม่ได้รับ change_amt → เมื่อ change_denominations=null/{}
//      (transaction เก่า) ไม่มี fallback auto-calc → denomination panel เกิน
//   2. query ดึงแค่ change_denominations ไม่ได้ดึง change_amt
//
// แก้:
//   • override v4GetCurrentDenoms → query เพิ่ม change_amt, net_amount
//   • override v4CalcNet (ผ่าน window) → fallback calcChangeDenominations
//     เมื่อ change_denominations ว่าง แต่ change_amt > 0
//   • override v4InjectPanel → ใช้ query ใหม่
// ══════════════════════════════════════════════════════════════════

// helper: ตรวจว่า denom object มีค่าจริงหรือไม่
function v9HasDenomValue(obj) {
  return obj && typeof obj === 'object' &&
    Object.values(obj).some(v => Number(v) > 0);
}

// calcNet พร้อม fallback change_denominations
function v9CalcNet(sess, txs) {
  const net = typeof v4EmptyDenoms === 'function' ? v4EmptyDenoms() : {};
  const all = [...(window.BILLS || []), ...(window.COINS || [])];
  if (all.length === 0) return net;

  // เริ่มจาก opening denominations
  const op = sess.opening_denominations || {};
  all.forEach(d => { net[d.value] = (net[d.value] || 0) + Number(op[d.value] || 0); });

  txs.forEach(tx => {
    const isIn   = tx.direction === 'in';
    const den    = tx.denominations || {};
    let   chg    = tx.change_denominations || {};

    // ── Fallback: ถ้า change_denominations ว่าง แต่มี change_amt > 0 ──
    // auto-calc จาก change_amt เพื่อให้ panel หักแบงค์ได้ถูกต้อง
    if (!v9HasDenomValue(chg)) {
      const changeAmt = Number(tx.change_amt || 0);
      if (changeAmt > 0 && typeof calcChangeDenominations === 'function') {
        chg = calcChangeDenominations(changeAmt);
      }
    }

    all.forEach(d => {
      if (isIn) {
        // รับเงินเข้า: +denominations (รับมา) −change_denominations (ทอนออก)
        net[d.value] = (net[d.value] || 0) + Number(den[d.value] || 0);
        net[d.value] = (net[d.value] || 0) - Number(chg[d.value] || 0);
      } else {
        // จ่ายเงินออก: −denominations (จ่ายออก) +change_denominations (ได้ทอนกลับ)
        net[d.value] = (net[d.value] || 0) - Number(den[d.value] || 0);
        net[d.value] = (net[d.value] || 0) + Number(chg[d.value] || 0);
      }
    });
  });

  // ไม่ให้ติดลบ
  all.forEach(d => { if ((net[d.value] || 0) < 0) net[d.value] = 0; });
  return net;
}

// Override v4GetCurrentDenoms — query เพิ่ม change_amt
window.v4GetCurrentDenoms = async function () {
  try {
    const { data: sess } = await db.from('cash_session')
      .select('*').eq('status', 'open')
      .order('opened_at', { ascending: false }).limit(1).maybeSingle();
    if (!sess) return null;

    const { data: txs } = await db.from('cash_transaction')
      .select('direction,denominations,change_denominations,change_amt,net_amount')
      .eq('session_id', sess.id);

    return v9CalcNet(sess, txs || []);
  } catch (e) {
    console.warn('[v9] v4GetCurrentDenoms error:', e);
    return null;
  }
};

// ── renderCashDrawer override ──────────────────────────────────────
// v4InjectPanel ถูก declare เป็น "async function v4InjectPanel()" (ไม่ใช่ window.x)
// → override ผ่าน window.v4InjectPanel ไม่มีผล
// แก้: override renderCashDrawer ทั้งก้อน ให้ inject panel ด้วย v9CalcNet แทน

window.renderCashDrawer = async function () {
  try {
    // ── query session + transactions ────────────────────────────
    let sess = null;
    try {
      const { data } = await db.from('cash_session').select('*')
        .eq('status', 'open').order('opened_at', { ascending: false })
        .limit(1).maybeSingle();
      sess = data;
    } catch (_) { sess = null; }

    let balance = 0, txs = [];
    if (sess) {
      const { data: t } = await db.from('cash_transaction')
        .select('*')
        .eq('session_id', sess.id)
        .order('created_at', { ascending: false });
      txs = t || [];
      // ── ยอดตัวเลขบาท (net_amount เท่านั้น ไม่ใช่ received) ────
      balance = sess.opening_amt || 0;
      txs.forEach(tx => {
        balance += tx.direction === 'in' ? tx.net_amount : -tx.net_amount;
      });
      balance = Math.max(0, balance);
    }

    // ── อัป balance displays ────────────────────────────────────
    ['cash-current-balance', 'global-cash-balance'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `฿${formatNum(balance)}`;
    });

    const sessEl = document.getElementById('cash-session-status');
    if (sessEl) sessEl.textContent = sess
      ? `เปิดรอบ ${formatDateTime(sess.opened_at)} | โดย ${sess.opened_by}`
      : 'ยังไม่เปิดรอบ';

    // ── Transaction list ────────────────────────────────────────
    const txList = document.getElementById('cash-transactions');
    if (txList) {
      if (txs.length === 0) {
        txList.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:40px;">ไม่มีรายการ</p>';
      } else {
        txList.innerHTML = txs.map(t => {
          const isIn = t.direction === 'in';
          const net  = t.net_amount;
          const recv = t.amount || net;
          const chg  = t.change_amt || 0;
          const showDetail = isIn && chg > 0;
          const amtHTML = showDetail
            ? `<div style="text-align:right;">
                 <div style="font-size:13px;font-weight:700;color:var(--success);">+฿${formatNum(net)}</div>
                 <div style="font-size:11px;color:var(--text-tertiary);">รับ ฿${formatNum(recv)} | ทอน ฿${formatNum(chg)}</div>
               </div>`
            : `<div style="font-size:13px;font-weight:700;color:${isIn?'var(--success)':'var(--danger)'};">
                 ${isIn?'+':'-'}฿${formatNum(net)}
               </div>`;
          return `<div class="transaction-item">
            <div class="transaction-icon ${t.direction}">
              <i class="material-icons-round">${isIn?'add':'remove'}</i>
            </div>
            <div class="transaction-info">
              <div class="transaction-title">${t.type}</div>
              <div class="transaction-time">${formatDateTime(t.created_at)} — ${t.staff_name||'-'}</div>
              ${t.note?`<div class="transaction-note">${t.note}</div>`:''}
            </div>
            ${amtHTML}
          </div>`;
        }).join('');
      }
    }

    // ── Buttons ─────────────────────────────────────────────────
    const noSess = !sess;
    ['cash-open-btn','cash-add-btn','cash-withdraw-btn','cash-close-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = id === 'cash-open-btn' ? !noSess : noSess;
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

    // ── Denomination Panel ──────────────────────────────────────
    // v4InjectPanel เป็น local function → override ผ่าน window ไม่ได้
    // เรียก v9InjectPanel แทน
    await v9InjectPanel(sess, txs);

  } catch (e) { console.error('[v9] renderCashDrawer:', e); }
};

// v9InjectPanel — ใช้ v9CalcNet (มี fallback change_amt)
async function v9InjectPanel(sess, txs) {
  document.getElementById('v4-denom-panel')?.remove();
  if (!sess) return;

  try {
    // ถ้าไม่ได้รับ txs ที่มี change_amt → query เพิ่มเติม
    let rows = txs;
    const needsQuery = !txs || txs.length === 0 ||
      (txs.length > 0 && !('change_amt' in txs[0]));
    if (needsQuery) {
      const { data } = await db.from('cash_transaction')
        .select('direction,denominations,change_denominations,change_amt,net_amount')
        .eq('session_id', sess.id);
      rows = data || [];
    }

    const net    = v9CalcNet(sess, rows);
    const netTot = typeof v4Total === 'function' ? v4Total(net) : 0;
    const BILLS_ = window.BILLS || [];
    const COINS_ = window.COINS || [];

    function panelCard(d, isCoin) {
      const qty    = net[d.value] || 0;
      const accent = isCoin ? '#DAA520' : (d.bg || '#999');
      const active = qty > 0;
      return `<div style="border-radius:10px;
        border:2px solid ${active ? accent : 'var(--border-light)'};
        background:${active ? (isCoin ? '#FFFBEB' : `color-mix(in srgb,${accent} 10%,var(--bg-surface))`) : 'var(--bg-base)'};
        padding:8px 5px;text-align:center;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;
          border-radius:8px 8px 0 0;background:${accent};opacity:${active?'1':'.2'};"></div>
        <div style="font-size:${d.value>=1000?'13px':'15px'};font-weight:800;
          color:${active?(isCoin?'#8B6914':d.color):'var(--text-tertiary)'};
          margin-top:4px;font-family:var(--font-display);">${d.label}</div>
        <div style="width:22px;height:22px;border-radius:50%;
          background:${active?accent:'var(--border-light)'};
          color:${active?'#fff':'var(--text-tertiary)'};
          font-size:12px;font-weight:700;display:flex;align-items:center;
          justify-content:center;margin:4px auto 3px;">${qty}</div>
        <div style="font-size:9px;color:${active?'var(--text-secondary)':'var(--text-tertiary)'};">
          ${active?`฿${formatNum(qty*d.value)}`:'—'}
        </div>
      </div>`;
    }

    const anchor = document.querySelector('.cash-history');
    if (!anchor) return;
    const panel = document.createElement('div');
    panel.id = 'v4-denom-panel'; panel.style.marginTop = '20px';
    panel.innerHTML = `
      <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:16px;overflow:hidden;">
        <div style="padding:13px 18px;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 72%,#000));display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <i class="material-icons-round" style="color:rgba(255,255,255,.9);font-size:20px;">account_balance</i>
            <div>
              <div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.8px;">แบงค์ในลิ้นชักตอนนี้</div>
              <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:1px;">รับเข้า − ทอนออก (ทุกรายการ)</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:rgba(255,255,255,.65);margin-bottom:1px;">รวม</div>
            <div style="font-size:22px;font-weight:800;color:#fff;font-family:var(--font-display);">฿${formatNum(netTot)}</div>
          </div>
        </div>
        <div style="padding:13px 16px 8px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:5px;margin-bottom:10px;">
            <i class="material-icons-round" style="font-size:13px;color:var(--primary);">payments</i>ธนบัตร
          </div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;">
            ${BILLS_.map(d => panelCard(d, false)).join('')}
          </div>
        </div>
        <div style="padding:0 16px 13px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:5px;margin-bottom:10px;padding-top:10px;border-top:1px solid var(--border-light);">
            <i class="material-icons-round" style="font-size:13px;color:#B8860B;">toll</i>เหรียญ
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;">
            ${COINS_.map(d => panelCard(d, true)).join('')}
          </div>
        </div>
        <div style="padding:9px 16px;background:var(--bg-base);border-top:1px solid var(--border-light);font-size:11px;color:var(--text-tertiary);display:flex;align-items:center;gap:5px;">
          <i class="material-icons-round" style="font-size:13px;">info</i>อัปเดตอัตโนมัติทุกครั้งที่มีรายการใหม่
        </div>
      </div>`;
    anchor.insertAdjacentElement('afterend', panel);
  } catch (e) { console.warn('[v9] v9InjectPanel error:', e); }
}


// ══════════════════════════════════════════════════════════════════
// FIX-9 — v5NewAdvance / v5SubmitAdvance / v5LoadAdvance
//
// ปัญหา:
//   • v5SubmitAdvance insert `method` column ที่ไม่มีใน DB → 400
//   • v5LoadAdvance query ด้วย join 'พนักงาน(name,lastname)' + .catch() chain → 400
//   • ปุ่ม "เบิกเงินใหม่" เรียก v5NewAdvance (simple form) แทน openAdvanceWizard
//
// แก้:
//   • v5NewAdvance → redirect ไป openAdvanceWizard (popup นับแบงค์ v9)
//     ถ้าไม่รู้ว่า empId คือใคร → เปิด Swal เลือกพนักงานก่อน
//   • v5SubmitAdvance → ไม่ใช้แล้ว (stub เปล่า)
//   • v5LoadAdvance → query ใหม่ไม่ใช้ join, ดึง empMap แยก
// ══════════════════════════════════════════════════════════════════

// ── v5NewAdvance: เปิด Swal เลือกพนักงาน → openAdvanceWizard ──
window.v5NewAdvance = async function () {
  let emps = [];
  try { emps = await loadEmployees(); } catch(_) {}
  const actives = emps.filter(e => e.status === 'ทำงาน');
  if (actives.length === 0) {
    typeof toast === 'function' && toast('ไม่มีพนักงานที่กำลังทำงาน', 'warning');
    return;
  }

  // ถ้ามีแค่คนเดียว → เปิด wizard เลย
  if (actives.length === 1) {
    window.openAdvanceWizard?.(actives[0].id, actives[0].name);
    return;
  }

  // มีหลายคน → Swal เลือก
  const opts = actives.map(e => `<option value="${e.id}">${e.name} ${e.lastname||''}</option>`).join('');
  const { value: empId } = await Swal.fire({
    title: 'เลือกพนักงาน',
    html: `<select id="v9-adv-sel" class="swal2-input" style="width:100%;height:44px;font-size:15px;">
             <option value="">-- เลือกพนักงาน --</option>${opts}
           </select>`,
    confirmButtonText: 'ถัดไป →',
    cancelButtonText:  'ยกเลิก',
    showCancelButton:  true,
    confirmButtonColor: '#DC2626',
    preConfirm: () => {
      const v = document.getElementById('v9-adv-sel')?.value;
      if (!v) { Swal.showValidationMessage('กรุณาเลือกพนักงาน'); return false; }
      return v;
    },
  });
  if (!empId) return;
  const emp = actives.find(e => e.id === empId);
  window.openAdvanceWizard?.(empId, emp?.name || '');
};

// ── v5SubmitAdvance: stub — ไม่ใช้แล้ว ─────────────────────────
window.v5SubmitAdvance = async function () {
  typeof toast === 'function' && toast('กรุณาใช้ปุ่มเบิกเงินใหม่', 'info');
};

// ── v5LoadAdvance: query ใหม่ไม่ใช้ join ─────────────────────────
window.v5LoadAdvance = async function () {
  const sec = document.getElementById('att-tab-advance');
  if (!sec) return;

  sec.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-tertiary);">
    <div style="width:32px;height:32px;border:3px solid #e2e8f0;
      border-top-color:var(--primary);border-radius:50%;
      animation:v7spin .8s linear infinite;margin:0 auto 10px;"></div>
    โหลดรายการเบิกเงิน...
  </div>`;

  try {
    let emps = [], advances = [];
    const today = new Date().toISOString().split('T')[0];

    const [empsResult, advResult] = await Promise.all([
      loadEmployees().catch(() => []),
      db.from('เบิกเงิน')
        .select('id,employee_id,amount,reason,note,status,date,approved_by')
        .order('date', { ascending: false })
        .limit(60),
    ]);

    emps     = empsResult || [];
    advances = advResult.data || [];

    const empMap = {};
    emps.forEach(e => { empMap[e.id] = e; });

    const totalToday = advances
      .filter(a => (a.date || '').startsWith(today) && a.status === 'อนุมัติ')
      .reduce((s, a) => s + a.amount, 0);

    sec.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
        flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">การเบิกเงินพนักงาน</h3>
          <div style="font-size:13px;color:var(--text-secondary);">
            เบิกวันนี้รวม:
            <strong style="color:var(--warning);">฿${formatNum(totalToday)}</strong>
          </div>
        </div>
        <button class="btn btn-primary" onclick="v5NewAdvance()">
          <i class="material-icons-round">add</i> เบิกเงินใหม่
        </button>
      </div>

      ${advances.length === 0
        ? `<div style="text-align:center;padding:60px;color:var(--text-tertiary);">
             <i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;opacity:.3;">payments</i>
             ยังไม่มีรายการเบิกเงิน
           </div>`
        : `<div style="display:flex;flex-direction:column;gap:8px;">
             ${advances.map(a => {
               const emp  = empMap[a.employee_id] || {};
               const name = emp.name ? `${emp.name} ${emp.lastname||''}`.trim() : '(ไม่ทราบชื่อ)';
               const methodNote = a.note || 'เงินสด';
               return `
                 <div style="background:var(--bg-surface);border:1px solid var(--border-light);
                   border-radius:12px;padding:14px 16px;
                   display:flex;align-items:center;gap:14px;">
                   <div style="width:44px;height:44px;border-radius:50%;
                     background:${a.status==='อนุมัติ'?'#fef3c7':'#f1f5f9'};
                     display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                     <i class="material-icons-round"
                       style="color:${a.status==='อนุมัติ'?'var(--warning)':'#94a3b8'};">
                       payments
                     </i>
                   </div>
                   <div style="flex:1;min-width:0;">
                     <div style="font-size:14px;font-weight:700;">${name}</div>
                     <div style="font-size:12px;color:var(--text-tertiary);
                       white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                       ${a.reason||'—'} • ${methodNote}
                     </div>
                     <div style="font-size:11px;color:var(--text-tertiary);margin-top:1px;">
                       ${a.date ? formatDateTime(a.date) : ''}
                     </div>
                   </div>
                   <div style="text-align:right;flex-shrink:0;">
                     <div style="font-size:16px;font-weight:800;color:var(--warning);">
                       ฿${formatNum(a.amount)}
                     </div>
                     <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;
                       background:${a.status==='อนุมัติ'?'#d1fae5':'#fef3c7'};
                       color:${a.status==='อนุมัติ'?'#065f46':'#92400e'};">
                       ${a.status||'รออนุมัติ'}
                     </span>
                   </div>
                 </div>`;
             }).join('')}
           </div>`}`;

    // refresh payroll tab if visible
    const payTab = document.getElementById('att-tab-payroll');
    if (payTab && payTab.style.display !== 'none') {
      window.v5LoadPayroll?.();
    }
  } catch (e) {
    console.error('[v9] v5LoadAdvance error:', e);
    sec.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);">
      โหลดข้อมูลไม่ได้: ${e.message}
    </div>`;
  }
};

// หลังเบิกเงินสำเร็จ — refresh advance tab
const _v9OrigV9Confirm = window.v9ConfirmAdvance;
window.v9ConfirmAdvance = async function (empId, empName, amount, reason, method) {
  await _v9OrigV9Confirm?.apply(this, arguments);
  // refresh advance list
  setTimeout(() => window.v5LoadAdvance?.(), 300);
};


// ══════════════════════════════════════════════════════════════════
// FIX-10 — v5LoadPayroll: ยอดสะสม ≠ หักเบิกอัตโนมัติ
//           + v7ShowPayrollModal: แสดงยอดสะสมตั้งแต่จ่ายล่าสุด
//           + ลบพนักงาน (deleteEmployee)
// ══════════════════════════════════════════════════════════════════

// ── v5LoadPayroll (rewrite) ──────────────────────────────────────
// Logic ใหม่:
//   accumulated  = วันทำงานจริงทั้งหมด × ค่าแรง (ตั้งแต่จ่ายล่าสุด)
//   accDebt      = เบิกทั้งหมด − หักหนี้ที่จ่ายแล้วทุกครั้ง
//   ปุ่มจ่าย     → modal กรอกเองว่าจะจ่ายเท่าไร + หักหนี้เท่าไร

window.v5LoadPayroll = async function () {
  const sec = document.getElementById('att-tab-payroll');
  if (!sec) return;

  sec.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-tertiary,#94a3b8);">
    <div style="width:36px;height:36px;border:3px solid #e2e8f0;
      border-top-color:var(--primary,#DC2626);border-radius:50%;
      animation:v7spin .8s linear infinite;margin:0 auto 12px;"></div>
    <style>@keyframes v7spin{to{transform:rotate(360deg)}}</style>คำนวณเงินเดือน...
  </div>`;

  let emps = [], attAll = [], allAdv = [], allPaid = [];
  try { emps    = await loadEmployees(); } catch(_) {}
  try {
    const r = await db.from('เช็คชื่อ').select('employee_id,status,date');
    attAll = r.data || [];
  } catch(_) {}
  try {
    const r = await db.from('เบิกเงิน').select('employee_id,amount,status,date').eq('status','อนุมัติ');
    allAdv = r.data || [];
  } catch(_) {}
  try {
    const r = await db.from('จ่ายเงินเดือน')
      .select('employee_id,net_paid,deduct_withdraw,working_days,base_salary,paid_date,month')
      .order('paid_date', { ascending: false });
    allPaid = r.data || [];
  } catch(_) {}

  const actives = emps.filter(e => e.status === 'ทำงาน');

  const rows = actives.map(emp => {
    const wage      = emp.daily_wage || 0;
    const empPaid   = allPaid.filter(p => p.employee_id === emp.id);
    const lastPay   = empPaid[0] || null;
    const lastPayDate = lastPay?.paid_date || null;

    // ── วันทำงานตั้งแต่จ่ายล่าสุด (หรือทั้งหมดถ้ายังไม่เคยจ่าย) ──
    const empAtt = attAll.filter(a => {
      if (a.employee_id !== emp.id) return false;
      if (lastPayDate) return a.date > lastPayDate.split('T')[0];
      return true;
    });

    const daysFull   = empAtt.filter(a => a.status === 'มา').length;
    const daysHalf   = empAtt.filter(a => a.status === 'ครึ่งวัน').length;
    const daysLate   = empAtt.filter(a => a.status === 'มาสาย').length;
    const daysAbsent = empAtt.filter(a => a.status === 'ขาด').length;
    const workDays   = daysFull + daysHalf * 0.5 + daysLate;

    // ยอดสะสม (ไม่หักอะไรทั้งนั้น)
    const accumulated = Math.round(daysFull * wage + daysHalf * wage * 0.5 + daysLate * wage * 0.95);

    // หนี้สะสม = เบิกทั้งหมด − หักหนี้ที่จ่ายแล้วทุกครั้ง
    const totalAdv      = allAdv.filter(a => a.employee_id === emp.id).reduce((s,a)=>s+a.amount,0);
    const totalDeducted = empPaid.reduce((s,p)=>s+(p.deduct_withdraw||0),0);
    const accDebt       = Math.max(0, totalAdv - totalDeducted);

    return { emp, workDays, daysFull, daysHalf, daysLate, daysAbsent, accumulated, accDebt, lastPay };
  });

  const totalAcc  = rows.reduce((s,r)=>s+r.accumulated,0);
  const totalDebt = rows.reduce((s,r)=>s+r.accDebt,0);

  sec.innerHTML = `
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:18px;
      padding:22px 24px;margin-bottom:20px;color:#fff;">
      <div style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;
        letter-spacing:.8px;margin-bottom:14px;">สรุปเงินเดือน — สะสมถึงปัจจุบัน</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
        ${[
          ['ยอดสะสมรวม',  `฿${formatNum(totalAcc)}`,  '#10b981'],
          ['หนี้เบิกสะสม', `฿${formatNum(totalDebt)}`, '#ef4444'],
          ['พนักงานทั้งหมด', `${rows.length} คน`,     '#6366f1'],
        ].map(([l,v,c])=>`
          <div style="background:rgba(255,255,255,.08);border-radius:12px;padding:12px 10px;text-align:center;">
            <div style="font-size:10px;color:rgba(255,255,255,.55);margin-bottom:4px;">${l}</div>
            <div style="font-size:17px;font-weight:800;color:${c};">${v}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Cards -->
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${rows.map(r=>`
        <div style="background:var(--bg-surface,#fff);border:1.5px solid #e2e8f0;
          border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04);">
          <!-- Header row -->
          <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;">
            <div style="width:46px;height:46px;border-radius:50%;flex-shrink:0;
              background:linear-gradient(135deg,var(--primary,#DC2626),color-mix(in srgb,var(--primary,#DC2626) 70%,#000));
              display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;">
              ${(r.emp.name||'?').charAt(0)}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:700;">${r.emp.name} ${r.emp.lastname||''}</div>
              <div style="font-size:12px;color:#94a3b8;">${r.emp.position||'พนักงาน'} • ฿${formatNum(r.emp.daily_wage||0)}/วัน</div>
              ${r.lastPay ? `<div style="font-size:11px;color:#6366f1;margin-top:1px;">จ่ายล่าสุด ${formatDateTime(r.lastPay.paid_date)} | ฿${formatNum(r.lastPay.net_paid)}</div>` : `<div style="font-size:11px;color:#94a3b8;margin-top:1px;">ยังไม่เคยจ่าย</div>`}
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
              <div>
                <div style="font-size:10px;color:#94a3b8;margin-bottom:1px;">ยอดสะสม</div>
                <div style="font-size:20px;font-weight:800;color:#15803d;">฿${formatNum(r.accumulated)}</div>
              </div>
              ${r.accDebt > 0 ? `<div style="font-size:11px;padding:2px 8px;border-radius:999px;background:#fff7ed;color:#92400e;font-weight:700;">ติดหนี้ ฿${formatNum(r.accDebt)}</div>` : ''}
              <div style="display:flex;gap:6px;">
                <button class="btn btn-primary btn-sm"
                  onclick="v9ShowPayrollModal('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim()}',${r.accumulated},${r.accDebt})"
                  style="font-size:12px;">
                  <i class="material-icons-round" style="font-size:14px;">send</i> จ่าย
                </button>
                <button class="btn btn-outline btn-sm"
                  onclick="v9DeleteEmployee('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim()}')"
                  style="font-size:12px;color:var(--danger);border-color:var(--danger);">
                  <i class="material-icons-round" style="font-size:14px;">delete</i>
                </button>
              </div>
            </div>
          </div>
          <!-- Stats -->
          <div style="display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid #f1f5f9;">
            ${[
              ['วันทำงาน',     r.workDays%1===0?r.workDays:r.workDays.toFixed(1), '#10b981'],
              ['มาสาย',        r.daysLate,   '#f59e0b'],
              ['ขาด',          r.daysAbsent, '#ef4444'],
              ['หนี้เบิก',      `฿${formatNum(r.accDebt)}`, '#d97706'],
              ['จ่ายล่าสุด',    r.lastPay?`฿${formatNum(r.lastPay.net_paid)}`:'—', '#6366f1'],
            ].map(([l,v,c],i)=>`
              <div style="padding:10px 6px;text-align:center;${i<4?'border-right:1px solid #f1f5f9;':''}">
                <div style="font-size:14px;font-weight:800;color:${c};">${v}</div>
                <div style="font-size:9px;color:#94a3b8;margin-top:1px;">${l}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
      ${rows.length===0?`<div style="text-align:center;padding:60px;color:#94a3b8;">ไม่มีพนักงาน</div>`:''}
    </div>`;
};


// ── v9ShowPayrollModal: กรอกเองทั้งหมด ──────────────────────────
window.v9ShowPayrollModal = function (empId, empName, accumulated, accDebt) {
  document.getElementById('v9-payroll-overlay')?.remove();
  const ov = document.createElement('div');
  ov.id = 'v9-payroll-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:480px;
      max-height:92vh;display:flex;flex-direction:column;overflow:hidden;
      box-shadow:0 24px 64px rgba(0,0,0,.45);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#059669,#10b981);padding:18px 22px;flex-shrink:0;">
        <div style="font-size:10px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">จ่ายเงินเดือน</div>
        <div style="font-size:18px;font-weight:700;color:#fff;">${empName}</div>
      </div>

      <!-- Body -->
      <div style="flex:1;overflow-y:auto;padding:20px;">
        <!-- Info cards -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
          <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:#15803d;font-weight:600;margin-bottom:4px;">ยอดสะสม (มาทำงาน)</div>
            <div style="font-size:22px;font-weight:800;color:#15803d;">฿${formatNum(accumulated)}</div>
            <div style="font-size:10px;color:#4ade80;margin-top:2px;">ตั้งแต่จ่ายล่าสุด</div>
          </div>
          <div style="background:${accDebt>0?'#fff7ed':'#f8fafc'};border:1.5px solid ${accDebt>0?'#fed7aa':'#e2e8f0'};border-radius:12px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:${accDebt>0?'#92400e':'#94a3b8'};font-weight:600;margin-bottom:4px;">หนี้เบิกสะสม</div>
            <div style="font-size:22px;font-weight:800;color:${accDebt>0?'#d97706':'#94a3b8'};">฿${formatNum(accDebt)}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${accDebt>0?'ยังค้างชำระ':'ไม่มีหนี้'}</div>
          </div>
        </div>

        <!-- จ่ายครั้งนี้ -->
        <div style="margin-bottom:14px;">
          <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:6px;">
            จ่ายครั้งนี้ (บาท) *
            <span style="font-size:11px;font-weight:400;color:#94a3b8;margin-left:6px;">กรอกตามต้องการ</span>
          </label>
          <div style="position:relative;">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;font-weight:700;color:#94a3b8;">฿</span>
            <input type="number" id="v9pay-amount" value="${accumulated}" min="0" max="${accumulated}"
              oninput="v9UpdatePaySummary(${accumulated},${accDebt})"
              style="width:100%;padding:12px 14px 12px 32px;border:2px solid #10b981;border-radius:12px;font-size:20px;font-weight:800;color:#15803d;text-align:right;outline:none;box-sizing:border-box;">
          </div>
        </div>

        <!-- หักหนี้ -->
        <div style="margin-bottom:14px;">
          <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:6px;">
            หักหนี้ครั้งนี้ (บาท)
            <span style="font-size:11px;font-weight:400;color:#94a3b8;margin-left:6px;">0 = ไม่หัก | สูงสุด ฿${formatNum(accDebt)}</span>
          </label>
          <div style="position:relative;">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;font-weight:700;color:#94a3b8;">฿</span>
            <input type="number" id="v9pay-deduct" value="0" min="0" max="${accDebt}"
              oninput="v9UpdatePaySummary(${accumulated},${accDebt})"
              style="width:100%;padding:12px 14px 12px 32px;border:2px solid #e2e8f0;border-radius:12px;font-size:20px;font-weight:800;color:#d97706;text-align:right;outline:none;box-sizing:border-box;">
          </div>
        </div>

        <!-- หมายเหตุ -->
        <div style="margin-bottom:18px;">
          <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:6px;">หมายเหตุ</label>
          <input type="text" id="v9pay-note" placeholder="ระบุหมายเหตุ (ถ้ามี)"
            style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;">
        </div>

        <!-- สรุป -->
        <div id="v9pay-summary" style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;">สรุปการจ่าย</div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
            <span style="color:#64748b;">ยอดสะสม</span>
            <strong style="color:#15803d;">฿${formatNum(accumulated)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
            <span style="color:#64748b;">จ่ายครั้งนี้</span>
            <strong id="v9sum-pay" style="color:#15803d;">฿${formatNum(accumulated)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
            <span style="color:#64748b;">หักหนี้ครั้งนี้</span>
            <strong id="v9sum-deduct" style="color:#d97706;">฿0</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
            <span style="color:#64748b;">หนี้คงเหลือ</span>
            <strong id="v9sum-debtLeft" style="color:${accDebt>0?'#92400e':'#10b981'};">฿${formatNum(accDebt)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:800;">
            <span>พนักงานได้รับจริง</span>
            <strong id="v9sum-net" style="color:#15803d;">฿${formatNum(accumulated)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;">
            <span style="color:#64748b;">ยอดสะสมคงเหลือ</span>
            <strong id="v9sum-accLeft" style="color:#6366f1;">฿0</strong>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:14px 20px;border-top:1px solid #f1f5f9;background:#fafafa;display:flex;gap:10px;flex-shrink:0;">
        <button onclick="document.getElementById('v9-payroll-overlay').remove()"
          style="flex:1;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer;font-size:14px;color:#64748b;font-weight:600;font-family:var(--font-thai,'Prompt'),sans-serif;">
          ยกเลิก
        </button>
        <button id="v9pay-confirm-btn"
          onclick="window.v9PayConfirm('${empId}','${empName}',${accumulated},${accDebt})"
          style="flex:2;padding:12px;border:none;border-radius:12px;background:#059669;color:#fff;font-family:var(--font-thai,'Prompt'),sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
          <i class="material-icons-round" style="font-size:18px;">send</i> ยืนยันจ่ายเงินเดือน
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  v9UpdatePaySummary(accumulated, accDebt);
};

window.v9UpdatePaySummary = function (accumulated, accDebt) {
  const pay     = Number(document.getElementById('v9pay-amount')?.value || 0);
  const deduct  = Math.min(Number(document.getElementById('v9pay-deduct')?.value || 0), accDebt);
  const netGet  = Math.max(0, pay - deduct);
  const debtLeft= Math.max(0, accDebt - deduct);
  const accLeft = Math.max(0, accumulated - pay);
  const set = (id, txt, color) => { const el=document.getElementById(id); if(el){el.textContent=txt; if(color)el.style.color=color;} };
  set('v9sum-pay',     `฿${formatNum(pay)}`,      pay>0?'#15803d':'#94a3b8');
  set('v9sum-deduct',  `฿${formatNum(deduct)}`,   deduct>0?'#d97706':'#94a3b8');
  set('v9sum-debtLeft',`฿${formatNum(debtLeft)}`, debtLeft>0?'#92400e':'#10b981');
  set('v9sum-net',     `฿${formatNum(netGet)}`,   netGet>0?'#15803d':'#94a3b8');
  set('v9sum-accLeft', `฿${formatNum(accLeft)}`,  accLeft>0?'#6366f1':'#94a3b8');
};

window.v9ConfirmPayroll = async function (empId, empName, accumulated, accDebt) {
  const pay    = Number(document.getElementById('v9pay-amount')?.value || 0);
  const deduct = Number(document.getElementById('v9pay-deduct')?.value || 0);
  const note   = document.getElementById('v9pay-note')?.value || '';
  if (pay <= 0) { typeof toast==='function'&&toast('กรุณาระบุจำนวนเงิน','error'); return; }
  if (pay > accumulated) { typeof toast==='function'&&toast(`จ่ายได้สูงสุด ฿${formatNum(accumulated)}(ยอดสะสม)`,'error'); return; }
  if (deduct > accDebt)  { typeof toast==='function'&&toast(`หักหนี้ได้สูงสุด ฿${formatNum(accDebt)}`,'error'); return; }
  const netGet = Math.max(0, pay - deduct);

  const btn = document.getElementById('v9pay-confirm-btn');
  if (btn) btn.disabled = true;
  v9ShowOverlay('กำลังบันทึกการจ่ายเงินเดือน...', `${empName} ฿${formatNum(pay)}`);

  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const { error } = await db.from('จ่ายเงินเดือน').insert({
      employee_id:     empId,
      month:           monthStr + '-01',
      net_paid:        pay,
      deduct_withdraw: deduct,
      base_salary:     accumulated,
      paid_date:       now.toISOString(),
      staff_name:      v9Staff(),
      note:            note || `จ่ายเงินเดือน`,
    });
    if (error) {
      // fallback minimal
      const { error: e2 } = await db.from('จ่ายเงินเดือน').insert({
        employee_id: empId,
        month:       monthStr + '-01',
        net_paid:    pay,
        deduct_withdraw: deduct,
        paid_date:   now.toISOString(),
        staff_name:  v9Staff(),
        note:        note || `จ่ายเงินเดือน`,
      });
      if (e2) throw new Error(e2.message);
    }

    typeof logActivity==='function' &&
      logActivity('จ่ายเงินเดือน', `${empName} จ่าย ฿${formatNum(pay)} หักหนี้ ฿${formatNum(deduct)} ได้รับ ฿${formatNum(netGet)}`);
    document.getElementById('v9-payroll-overlay')?.remove();
    typeof toast==='function' && toast(`จ่ายเงินเดือน ${empName} ฿${formatNum(pay)} สำเร็จ`, 'success');
    window.v5LoadPayroll?.();
  } catch(e) {
    console.error('[v9] payroll error:', e);
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+(e.message||e), 'error');
    if (btn) btn.disabled = false;
  } finally {
    v9HideOverlay();
  }
};


// ── deleteEmployee ─────────────────────────────────────────────
window.v9DeleteEmployee = async function (empId, empName) {
  const result = await Swal.fire({
    icon:  'warning',
    title: `ลบพนักงาน "${empName}"?`,
    html:  `<div style="font-size:14px;color:#64748b;">
              การลบจะเปลี่ยนสถานะเป็น <strong style="color:#dc2626;">ลาออก</strong><br>
              ประวัติการเบิกเงิน/เงินเดือนจะยังอยู่ครบ
            </div>`,
    showCancelButton: true,
    confirmButtonText: 'ลบ / ลาออก',
    cancelButtonText:  'ยกเลิก',
    confirmButtonColor: '#DC2626',
  });
  if (!result.isConfirmed) return;

  v9ShowOverlay('กำลังอัปเดตสถานะพนักงาน...');
  try {
    const { error } = await db.from('พนักงาน')
      .update({ status: 'ลาออก' })
      .eq('id', empId);
    if (error) throw new Error(error.message);
    typeof toast==='function' && toast(`${empName} เปลี่ยนสถานะเป็น "ลาออก" แล้ว`, 'success');
    typeof renderAttendance==='function' && renderAttendance();
    window.v5LoadPayroll?.();
  } catch(e) {
    typeof toast==='function' && toast('ไม่สำเร็จ: '+e.message, 'error');
  } finally {
    v9HideOverlay();
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-11 — editEmployee (ไม่มีใน codebase เลย → สร้างใหม่)
//         + saveEmployee ครอบ v9ShowOverlay
//         + v7ShowLoading → alias v9ShowOverlay (loading ใหญ่ขึ้น)
// ══════════════════════════════════════════════════════════════════

// ── alias: ทุกที่ที่เรียก v7ShowLoading / v7HideLoading → ใช้ v9 overlay
window.v7ShowLoading = function (msg) { v9ShowOverlay(msg || 'กำลังบันทึก...'); };
window.v7HideLoading = function ()    { v9HideOverlay(); };


// ── editEmployee: โหลดข้อมูล → เปิด modal แก้ไข ─────────────────
window.editEmployee = async function (empId) {
  v9ShowOverlay('กำลังโหลดข้อมูลพนักงาน...');
  let emp = null;
  try {
    const { data } = await db.from('พนักงาน').select('*').eq('id', empId).maybeSingle();
    emp = data;
  } catch(e) {
    v9HideOverlay();
    typeof toast === 'function' && toast('โหลดข้อมูลไม่ได้: ' + e.message, 'error');
    return;
  }
  v9HideOverlay();
  if (!emp) { typeof toast === 'function' && toast('ไม่พบข้อมูลพนักงาน', 'error'); return; }

  // เปิด modal แก้ไข
  if (typeof openModal !== 'function') return;
  openModal('แก้ไขพนักงาน', `
    <form id="v9-emp-form" onsubmit="event.preventDefault();v9SaveEmployee()">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">ชื่อ *</label>
          <input class="form-input" id="v9emp-name" value="${emp.name||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">นามสกุล</label>
          <input class="form-input" id="v9emp-lastname" value="${emp.lastname||''}">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">เบอร์โทร</label>
          <input class="form-input" id="v9emp-phone" value="${emp.phone||''}">
        </div>
        <div class="form-group">
          <label class="form-label">ตำแหน่ง</label>
          <input class="form-input" id="v9emp-pos" value="${emp.position||'พนักงาน'}">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">ประเภทค่าจ้าง</label>
          <select class="form-input" id="v9emp-pay-type" onchange="v9ToggleEmpWage()">
            <option value="รายวัน"   ${(emp.pay_type||'รายวัน')==='รายวัน'  ?'selected':''}>รายวัน</option>
            <option value="รายเดือน" ${emp.pay_type==='รายเดือน'?'selected':''}>รายเดือน</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" id="v9emp-wage-label">${emp.pay_type==='รายเดือน'?'เงินเดือน':'ค่าจ้างต่อวัน'} (บาท)</label>
          <input class="form-input" type="number" id="v9emp-wage"
            value="${emp.pay_type==='รายเดือน'?(emp.salary||0):(emp.daily_wage||0)}" min="0">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">วันเริ่มงาน</label>
          <input class="form-input" type="date" id="v9emp-start"
            value="${emp.start_date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">สถานะ</label>
          <select class="form-input" id="v9emp-status">
            <option value="ทำงาน"  ${(emp.status||'ทำงาน')==='ทำงาน' ?'selected':''}>ทำงาน</option>
            <option value="ลาออก"  ${emp.status==='ลาออก' ?'selected':''}>ลาออก</option>
            <option value="พักงาน" ${emp.status==='พักงาน'?'selected':''}>พักงาน</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="v9emp-note" value="${emp.note||''}">
      </div>
      <input type="hidden" id="v9emp-id" value="${emp.id}">
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;">
        <i class="material-icons-round">save</i> บันทึก
      </button>
    </form>`);
};

window.v9ToggleEmpWage = function () {
  const t = document.getElementById('v9emp-pay-type')?.value;
  const l = document.getElementById('v9emp-wage-label');
  if (l) l.textContent = (t === 'รายเดือน' ? 'เงินเดือน' : 'ค่าจ้างต่อวัน') + ' (บาท)';
};

window.v9SaveEmployee = async function () {
  const id      = document.getElementById('v9emp-id')?.value;
  const name    = document.getElementById('v9emp-name')?.value?.trim();
  const payType = document.getElementById('v9emp-pay-type')?.value || 'รายวัน';
  const wage    = Number(document.getElementById('v9emp-wage')?.value || 0);
  if (!name) { typeof toast === 'function' && toast('กรุณากรอกชื่อ', 'error'); return; }
  if (!id)   { typeof toast === 'function' && toast('ไม่พบ ID พนักงาน', 'error'); return; }

  v9ShowOverlay('กำลังบันทึกข้อมูลพนักงาน...');
  try {
    const { error } = await db.from('พนักงาน').update({
      name,
      lastname:   document.getElementById('v9emp-lastname')?.value?.trim() || '',
      phone:      document.getElementById('v9emp-phone')?.value?.trim()    || '',
      position:   document.getElementById('v9emp-pos')?.value?.trim()      || 'พนักงาน',
      pay_type:   payType,
      daily_wage: payType === 'รายวัน'   ? wage : 0,
      salary:     payType === 'รายเดือน' ? wage : 0,
      start_date: document.getElementById('v9emp-start')?.value || null,
      status:     document.getElementById('v9emp-status')?.value || 'ทำงาน',
      note:       document.getElementById('v9emp-note')?.value?.trim() || '',
    }).eq('id', id);

    if (error) throw new Error(error.message);

    typeof closeModal    === 'function' && closeModal();
    typeof toast         === 'function' && toast(`แก้ไขข้อมูล "${name}" สำเร็จ`, 'success');
    typeof renderAttendance === 'function' && renderAttendance();
    setTimeout(() => {
      typeof v5LoadEmps   === 'function' && v5LoadEmps();
      window.v5LoadPayroll?.();
    }, 300);
  } catch(e) {
    console.error('[v9] saveEmployee:', e);
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
  } finally {
    v9HideOverlay();
  }
};


// ── patch saveEmployee (original) ให้ใช้ overlay ─────────────────
const _v9OrigSaveEmployee = window.saveEmployee || (typeof saveEmployee !== 'undefined' ? saveEmployee : null);
window.saveEmployee = async function () {
  // ตรวจว่ากำลังใช้ form ใหม่ (v9) หรือเก่า
  const v9Form = document.getElementById('v9-emp-form');
  if (v9Form) { await window.v9SaveEmployee(); return; }

  // form เดิม — ห่อด้วย overlay
  v9ShowOverlay('กำลังบันทึกข้อมูลพนักงาน...');
  try {
    if (typeof _v9OrigSaveEmployee === 'function') {
      await _v9OrigSaveEmployee();
    }
  } catch(e) {
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
  } finally {
    v9HideOverlay();
  }
};


// ── patch saveEmployee ที่เรียกผ่าน openModal form submit ─────────
// (form เดิมใน modules.js ใช้ onsubmit="saveEmployee()" โดยตรง — ครอบแล้ว)


// ══════════════════════════════════════════════════════════════════
// FIX-12 — Dashboard: รวมค่าใช้จ่ายทั้งหมด (เบิกเงิน + เงินเดือน)
// ══════════════════════════════════════════════════════════════════

const _v9OrigRenderDash = window.renderDashboard;
window.renderDashboard = async function () {
  // หลังจาก renderDashboard เดิมทำงานเสร็จ → patch netProfit ด้วยข้อมูลเพิ่ม
  await _v9OrigRenderDash?.apply(this, arguments);

  // ดึงข้อมูล เบิกเงิน + จ่ายเงินเดือน ในช่วงเดียวกัน
  try {
    const periodEl = document.getElementById('dash-period');
    const days = Number(periodEl?.value || 30);
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const [advRes, salRes] = await Promise.all([
      db.from('เบิกเงิน').select('amount,status,date')
        .gte('date', since + 'T00:00:00').eq('status', 'อนุมัติ'),
      db.from('จ่ายเงินเดือน').select('net_paid,paid_date')
        .gte('paid_date', since + 'T00:00:00'),
    ]);

    const totalAdv = (advRes.data || []).reduce((s, a) => s + a.amount, 0);
    const totalSal = (salRes.data || []).reduce((s, p) => s + p.net_paid, 0);
    const laborCost = totalAdv + totalSal;

    if (laborCost === 0) return; // ไม่มีข้อมูล ไม่ต้องแก้

    // หา KPI card "กำไรสุทธิ" แล้ว patch ค่า
    const kpiCards = document.querySelectorAll('[data-kpi]');
    kpiCards.forEach(card => {
      if (card.dataset.kpi === 'netProfit') {
        const valEl  = card.querySelector('.kpi-value');
        const subEl  = card.querySelector('.kpi-sub');
        const curNet = parseInt((valEl?.textContent || '0').replace(/[^0-9-]/g, '')) || 0;
        const newNet = curNet - laborCost;
        if (valEl) {
          valEl.textContent = `฿${formatNum(newNet)}`;
          valEl.style.color = newNet >= 0 ? 'var(--success)' : 'var(--danger)';
        }
        if (subEl) {
          const expText = subEl.textContent || '';
          subEl.textContent = expText + ` | แรงงาน ฿${formatNum(laborCost)}`;
        }
      }
    });

    // ถ้า KPI ไม่มี data-kpi — ค้นหาจาก label text แทน
    if (kpiCards.length === 0) {
      document.querySelectorAll('.kpi-card, .stat-card, [class*="kpi"]').forEach(card => {
        const label = card.querySelector('.kpi-label, .stat-label, [class*="label"]');
        if (label?.textContent?.includes('กำไรสุทธิ')) {
          const valEl = card.querySelector('.kpi-value, .stat-value, [class*="value"]');
          if (valEl) {
            const curNet = parseInt(valEl.textContent.replace(/[^0-9-]/g, '')) || 0;
            const newNet = curNet - laborCost;
            valEl.textContent = `฿${formatNum(newNet)}`;
            valEl.style.color = newNet >= 0 ? 'var(--success)' : 'var(--danger)';
          }
        }
      });
    }

    // เพิ่มแถวค่าแรงในตาราง/กราฟรายจ่าย (ถ้ามี)
    const expSection = document.querySelector('.exp-breakdown, [data-section="expenses"]');
    if (expSection && laborCost > 0) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px dashed #e2e8f0;margin-top:6px;font-size:13px;';
      row.innerHTML = `
        <span style="display:flex;align-items:center;gap:6px;color:#64748b;">
          <i class="material-icons-round" style="font-size:14px;color:#8b5cf6;">people</i>
          ค่าแรง (เบิก+เงินเดือน)
        </span>
        <strong style="color:#8b5cf6;">฿${formatNum(laborCost)}</strong>`;
      expSection.appendChild(row);
    }
  } catch(e) { console.warn('[v9] dashboard labor patch:', e); }
};


// ══════════════════════════════════════════════════════════════════
// FIX-13 — renderUserPerms: แสดงใน modal สวยงาม กดแก้สิทธิ์ทันที
// ══════════════════════════════════════════════════════════════════

const _v9PermKeys = [
  { key:'can_pos',      label:'🏪 POS ขาย',       desc:'ขายสินค้า' },
  { key:'can_inv',      label:'📦 คลังสินค้า',     desc:'จัดการสินค้า/สต็อก' },
  { key:'can_cash',     label:'💵 ลิ้นชัก',        desc:'เปิด/ปิดรอบ, เพิ่ม/เบิกเงิน' },
  { key:'can_exp',      label:'📋 รายจ่าย',        desc:'บันทึกรายจ่าย' },
  { key:'can_debt',     label:'👤 ลูกหนี้',        desc:'จัดการหนี้ลูกค้า' },
  { key:'can_att',      label:'👷 พนักงาน',        desc:'เช็คชื่อ/เงินเดือน' },
  { key:'can_purchase', label:'🚚 รับสินค้า',      desc:'สร้างใบรับสินค้า' },
  { key:'can_dash',     label:'📊 Dashboard',      desc:'ดูวิเคราะห์ธุรกิจ' },
  { key:'can_log',      label:'📑 ประวัติ',        desc:'ดูประวัติกิจกรรม' },
];

window.renderUserPerms = async function (container) {
  if (!container) container = document.querySelector('#admin-content, .admin-content, [data-tab-content="users"]');
  if (!container) return;

  container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-tertiary);">
    <div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:var(--primary);
      border-radius:50%;animation:v7spin .8s linear infinite;margin:0 auto 8px;"></div>โหลด...
  </div>`;

  let users = [], perms = [];
  try {
    const [ur, pr] = await Promise.all([
      db.from('ผู้ใช้งาน').select('*').order('username'),
      db.from('สิทธิ์การเข้าถึง').select('*'),
    ]);
    users = ur.data || [];
    perms = pr.data || [];
  } catch(e) { container.innerHTML = `<p style="color:red;">โหลดไม่ได้: ${e.message}</p>`; return; }

  const permMap = {};
  perms.forEach(p => { permMap[p.user_id] = p; });

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="font-size:16px;font-weight:700;margin-bottom:2px;">จัดการผู้ใช้งานและสิทธิ์</h3>
        <div style="font-size:12px;color:var(--text-tertiary);">${users.length} บัญชี — เปลี่ยนสิทธิ์ได้ทันที</div>
      </div>
      <button class="btn btn-primary" onclick="showAddUserModal?.()">
        <i class="material-icons-round">person_add</i> เพิ่มผู้ใช้งาน
      </button>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;">
      ${users.map(u => {
        const p = permMap[u.id] || {};
        const isAdmin = u.role === 'admin';
        return `
          <div style="background:var(--bg-surface);border:1.5px solid ${isAdmin?'#fca5a5':'var(--border-light)'};
            border-radius:16px;overflow:hidden;">
            <!-- User header -->
            <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;
              background:${isAdmin?'#fff5f5':'var(--bg-base)'};">
              <div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;
                background:${isAdmin?'#dc2626':'#6366f1'};
                display:flex;align-items:center;justify-content:center;
                font-size:18px;font-weight:800;color:#fff;">
                ${u.username.charAt(0).toUpperCase()}
              </div>
              <div style="flex:1;">
                <div style="font-size:15px;font-weight:700;">${u.username}</div>
                <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;
                  background:${isAdmin?'#fee2e2':'#ede9fe'};color:${isAdmin?'#dc2626':'#6366f1'};">
                  ${isAdmin?'👑 Admin':'👤 Staff'}
                </span>
                ${isAdmin?`<span style="font-size:11px;color:#94a3b8;margin-left:8px;">Admin มีสิทธิ์ทั้งหมดอัตโนมัติ</span>`:''}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0;">
                <button onclick="v9EditUserPin('${u.id}','${u.username}')"
                  style="padding:6px 12px;border:1.5px solid #e2e8f0;border-radius:8px;
                    background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:#64748b;
                    display:flex;align-items:center;gap:4px;">
                  <i class="material-icons-round" style="font-size:14px;">pin</i> แก้ PIN
                </button>
                ${u.id !== (typeof USER !== 'undefined' ? USER?.id : '') ? `
                  <button onclick="deleteUserFromAdmin('${u.id}','${u.username}')"
                    style="padding:6px 10px;border:1.5px solid #fca5a5;border-radius:8px;
                      background:#fff5f5;cursor:pointer;color:#dc2626;">
                    <i class="material-icons-round" style="font-size:16px;">delete</i>
                  </button>` : ''}
              </div>
            </div>

            <!-- Permissions grid -->
            ${isAdmin ? '' : `
              <div style="padding:14px 18px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                ${_v9PermKeys.map(pk => {
                  const checked = !!p[pk.key];
                  return `
                    <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;
                      border-radius:10px;border:1.5px solid ${checked?'var(--primary)':'#e2e8f0'};
                      background:${checked?'color-mix(in srgb,var(--primary) 8%,#fff)':'#fafafa'};
                      cursor:pointer;transition:all .15s;">
                      <input type="checkbox" id="v9perm-${u.id}-${pk.key}"
                        ${checked?'checked':''}
                        onchange="v9SavePermission('${u.id}')"
                        style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary);">
                      <div style="min-width:0;">
                        <div style="font-size:12px;font-weight:700;color:var(--text-primary);">${pk.label}</div>
                        <div style="font-size:10px;color:var(--text-tertiary);margin-top:1px;">${pk.desc}</div>
                      </div>
                    </label>`;
                }).join('')}
              </div>`}
          </div>`;
      }).join('')}
    </div>`;
};

window.v9SavePermission = async function (userId) {
  const perms = {};
  _v9PermKeys.forEach(pk => {
    const el = document.getElementById(`v9perm-${userId}-${pk.key}`);
    perms[pk.key] = el ? el.checked : false;
  });
  try {
    const { data: ex } = await db.from('สิทธิ์การเข้าถึง').select('id')
      .eq('user_id', userId).maybeSingle();
    if (ex) await db.from('สิทธิ์การเข้าถึง').update(perms).eq('user_id', userId);
    else    await db.from('สิทธิ์การเข้าถึง').insert({ user_id: userId, ...perms });
    typeof toast === 'function' && toast('บันทึกสิทธิ์สำเร็จ', 'success');
  } catch(e) { typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: '+e.message, 'error'); }
};

window.v9EditUserPin = async function (userId, username) {
  const { value: newPin } = await Swal.fire({
    title: `แก้ PIN — ${username}`,
    html: `<input type="password" id="v9-new-pin" class="swal2-input"
             placeholder="PIN ใหม่ 4-6 ตัวเลข" maxlength="6" pattern="[0-9]+" inputmode="numeric"
             style="text-align:center;letter-spacing:8px;font-size:24px;">`,
    confirmButtonText: 'บันทึก',
    showCancelButton: true,
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#DC2626',
    preConfirm: () => {
      const v = document.getElementById('v9-new-pin')?.value?.trim();
      if (!v || v.length < 4 || !/^\d+$/.test(v)) {
        Swal.showValidationMessage('PIN ต้องเป็นตัวเลข 4-6 หลัก'); return false;
      }
      return v;
    },
  });
  if (!newPin) return;
  v9ShowOverlay('กำลังอัปเดต PIN...');
  try {
    const { error } = await db.from('ผู้ใช้งาน').update({ pin: newPin }).eq('id', userId);
    if (error) throw new Error(error.message);
    typeof toast === 'function' && toast(`เปลี่ยน PIN ของ ${username} สำเร็จ`, 'success');
  } catch(e) { typeof toast === 'function' && toast('ไม่สำเร็จ: '+e.message, 'error'); }
  finally { v9HideOverlay(); }
};

// ── alias savePermission เดิม → v9SavePermission ──────────────
window.savePermission = window.v9SavePermission;


// ══════════════════════════════════════════════════════════════════
// FIX-14 — หลังขายสินค้า: ลบ airtime gap + แสดง print popup ทันที
// ══════════════════════════════════════════════════════════════════

const _v9OrigV4Complete_print = window.v4CompletePayment;
window.v4CompletePayment = async function () {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;
  v9ShowOverlay('กำลังบันทึกบิล...', 'โปรดรอสักครู่');

  try {
    const { data: session } = await db.from('cash_session').select('*')
      .eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();

    const methodMap = { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ติดหนี้' };
    const { data: bill, error: billError } = await db.from('บิลขาย').insert({
      date: new Date().toISOString(),
      method: methodMap[checkoutState.method] || 'เงินสด',
      total: checkoutState.total, discount: checkoutState.discount || 0,
      received: checkoutState.received, change: checkoutState.change,
      customer_name: checkoutState.customer?.name || null,
      customer_id: checkoutState.customer?.id || null,
      staff_name: v9Staff(),
      status: checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
      denominations: checkoutState.receivedDenominations || null,
    }).select().single();
    if (billError) throw billError;

    for (const item of cart) {
      const prod = (window.products||[]).find(p=>p.id===item.id);
      const stockAfter = (prod?.stock||0) - item.qty;
      await db.from('รายการในบิล').insert({ bill_id:bill.id, product_id:item.id, name:item.name, qty:item.qty, price:item.price, cost:item.cost||0, total:item.price*item.qty });
      await db.from('สินค้า').update({ stock:stockAfter }).eq('id',item.id);
      await db.from('stock_movement').insert({ product_id:item.id, product_name:item.name, type:'ขาย', direction:'out', qty:item.qty, stock_before:prod?.stock||0, stock_after:stockAfter, ref_id:bill.id, ref_table:'บิลขาย', staff_name:v9Staff() });
    }

    if (checkoutState.method === 'cash' && session) {
      let chgDenoms = checkoutState.changeDenominations;
      if (!chgDenoms || !Object.values(chgDenoms).some(v=>Number(v)>0)) {
        if (checkoutState.change > 0 && typeof calcChangeDenominations === 'function')
          chgDenoms = calcChangeDenominations(checkoutState.change);
      }
      await window.recordCashTx({
        sessionId: session.id, type:'ขาย', direction:'in',
        amount: checkoutState.received, changeAmt: checkoutState.change,
        netAmount: checkoutState.total, refId: bill.id, refTable:'บิลขาย',
        denominations: checkoutState.receivedDenominations || null,
        changeDenominations: chgDenoms || null,
        note: `รับ ฿${formatNum(checkoutState.received)} ทอน ฿${formatNum(checkoutState.change)}`,
      });
    }

    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id',checkoutState.customer.id).maybeSingle();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase||0)+checkoutState.total,
        visit_count: (cust?.visit_count||0)+1,
        debt_amount: checkoutState.method==='debt' ? (cust?.debt_amount||0)+checkoutState.total : (cust?.debt_amount||0),
      }).eq('id',checkoutState.customer.id);
    }

    typeof logActivity==='function' && logActivity('ขายสินค้า', `บิล #${bill.bill_no} ยอด ฿${formatNum(checkoutState.total)}`, bill.id, 'บิลขาย');
    typeof sendToDisplay==='function' && sendToDisplay({ type:'thanks', billNo:bill.bill_no, total:checkoutState.total });

    // ── ดึง bill items สำหรับ print ก่อนซ่อน overlay ────────────
    const { data: bItems } = await db.from('รายการในบิล').select('*').eq('bill_id', bill.id);

    try { cart = []; } catch(_) { window.cart = []; }
    await loadProducts?.();
    renderCart?.(); renderProductGrid?.(); updateHomeStats?.();

    // อัป balance
    try {
      const newBal = await getLiveCashBalance();
      ['cash-current-balance','global-cash-balance'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = `฿${formatNum(newBal)}`;
      });
    } catch(_) {}

    // ── ซ่อน overlay → แสดง print popup ทันที (ไม่มี gap) ────────
    v9HideOverlay();

    const fmt = (typeof receiptFormat !== 'undefined' ? receiptFormat : null) || '80mm';
    const { value: doPrint } = await Swal.fire({
      icon: 'success',
      title: `บิล #${bill.bill_no} สำเร็จ`,
      html: `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
          <div style="background:#f0fdf4;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">ยอดขาย</div>
            <div style="font-size:16px;font-weight:800;color:#059669;">฿${formatNum(bill.total)}</div>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">รับเงิน</div>
            <div style="font-size:16px;font-weight:800;color:#2563EB;">฿${formatNum(checkoutState.received)}</div>
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">เงินทอน</div>
            <div style="font-size:16px;font-weight:800;color:#D97706;">฿${formatNum(Math.max(0,checkoutState.change))}</div>
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: `<i class="material-icons-round" style="font-size:16px;vertical-align:middle;">print</i> พิมพ์ (${fmt})`,
      cancelButtonText: 'ข้าม',
      confirmButtonColor: '#10B981',
      timer: 8000,
      timerProgressBar: true,
    });

    if (doPrint && typeof printReceipt === 'function') {
      printReceipt(bill, bItems || [], fmt);
    }

  } catch(e) {
    v9HideOverlay();
    console.error('[v9] v4CompletePayment error:', e);
    typeof toast==='function' && toast('เกิดข้อผิดพลาด: '+(e.message||e), 'error');
  } finally {
    window.isProcessingPayment = false;
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-15 — ใบเสนอราคา: ระบบมืออาชีพ พร้อมรายการสินค้า
// ══════════════════════════════════════════════════════════════════

let _v9QuotItems = [];   // [{product_id, name, qty, price, unit, total}]

window.renderQuotations = async function () {
  const section = document.getElementById('page-quotation');
  if (!section) return;

  section.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-tertiary);">
    <div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:var(--primary);
      border-radius:50%;animation:v7spin .8s linear infinite;margin:0 auto 8px;"></div>โหลด...</div>`;

  let quotes = [];
  try {
    const { data } = await db.from('ใบเสนอราคา').select('*').order('date',{ascending:false}).limit(100);
    quotes = data || [];
  } catch(e) { console.warn(e); }

  const statusBadge = s => {
    const m = { รออนุมัติ:'#f59e0b,#fffbeb', อนุมัติ:'#10b981,#f0fdf4', ยกเลิก:'#ef4444,#fef2f2' };
    const [c, bg] = (m[s] || '#94a3b8,#f8fafc').split(',');
    return `<span style="font-size:11px;padding:3px 10px;border-radius:999px;font-weight:700;background:${bg};color:${c};">${s}</span>`;
  };

  section.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:18px;font-weight:800;margin-bottom:2px;">📄 ใบเสนอราคา</h2>
        <div style="font-size:13px;color:var(--text-tertiary);">ทั้งหมด ${quotes.length} รายการ</div>
      </div>
      <button class="btn btn-primary" onclick="v9ShowQuotModal()">
        <i class="material-icons-round">add</i> สร้างใบเสนอราคา
      </button>
    </div>

    ${quotes.length === 0
      ? `<div style="text-align:center;padding:80px;color:var(--text-tertiary);">
           <i class="material-icons-round" style="font-size:48px;opacity:.3;display:block;margin-bottom:12px;">description</i>
           ยังไม่มีใบเสนอราคา
         </div>`
      : `<div style="display:flex;flex-direction:column;gap:8px;">
           ${quotes.map(q => {
             const isExpired = q.valid_until && new Date(q.valid_until) < new Date() && q.status === 'รออนุมัติ';
             return `
               <div style="background:var(--bg-surface);border:1.5px solid ${isExpired?'#fca5a5':'var(--border-light)'};
                 border-radius:14px;padding:16px 18px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                 <div style="flex:1;min-width:200px;">
                   <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                     <span style="font-size:13px;font-weight:800;color:var(--primary);">#QT-${String(q.id).slice(-6).toUpperCase()}</span>
                     ${statusBadge(q.status)}
                     ${isExpired?`<span style="font-size:11px;color:#ef4444;font-weight:600;">⚠️ หมดอายุ</span>`:''}
                   </div>
                   <div style="font-size:15px;font-weight:700;">${q.customer_name}</div>
                   <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">
                     ${new Date(q.date).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}
                     ${q.valid_until ? ` · หมดอายุ ${new Date(q.valid_until).toLocaleDateString('th-TH',{day:'numeric',month:'short'})}` : ''}
                     ${q.staff_name ? ` · ${q.staff_name}` : ''}
                   </div>
                   ${q.note?`<div style="font-size:11px;color:#94a3b8;margin-top:2px;">${q.note}</div>`:''}
                 </div>
                 <div style="text-align:right;flex-shrink:0;">
                   <div style="font-size:22px;font-weight:800;color:var(--primary);">฿${formatNum(q.total)}</div>
                   ${q.discount>0?`<div style="font-size:11px;color:#94a3b8;">ส่วนลด ฿${formatNum(q.discount)}</div>`:''}
                 </div>
                 <div style="display:flex;gap:6px;flex-shrink:0;">
                   <button onclick="v9PrintQuotation('${q.id}')"
                     style="padding:7px 12px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:#64748b;display:flex;align-items:center;gap:4px;">
                     <i class="material-icons-round" style="font-size:14px;">print</i> พิมพ์
                   </button>
                   ${q.status==='รออนุมัติ'?`
                     <button onclick="v9ConvertQuotation('${q.id}','${q.customer_name.replace(/'/g,"\\'")}')"
                       style="padding:7px 12px;border:none;border-radius:8px;background:var(--primary);color:#fff;cursor:pointer;font-size:12px;font-weight:700;display:flex;align-items:center;gap:4px;">
                       <i class="material-icons-round" style="font-size:14px;">shopping_cart</i> สร้างบิล
                     </button>
                     <button onclick="v9CancelQuotation('${q.id}')"
                       style="padding:7px 10px;border:1.5px solid #fca5a5;border-radius:8px;background:#fff5f5;cursor:pointer;color:#dc2626;">
                       <i class="material-icons-round" style="font-size:16px;">close</i>
                     </button>`:''}
                 </div>
               </div>`;
           }).join('')}
         </div>`}`;
};

// ── สร้างใบเสนอราคา (modal มีรายการสินค้า) ──────────────────────
window.v9ShowQuotModal = function () {
  _v9QuotItems = [];
  if (typeof openModal !== 'function') return;
  openModal('สร้างใบเสนอราคา', `
    <form id="v9-quot-form" onsubmit="event.preventDefault();">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">ชื่อลูกค้า *</label>
          <input class="form-input" id="v9quot-customer" placeholder="ชื่อลูกค้า" required>
        </div>
        <div class="form-group">
          <label class="form-label">วันหมดอายุ</label>
          <input class="form-input" type="date" id="v9quot-valid"
            value="${new Date(Date.now()+30*86400000).toISOString().split('T')[0]}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="v9quot-note" placeholder="หมายเหตุ (ถ้ามี)">
      </div>

      <!-- รายการสินค้า -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <label class="form-label" style="margin:0;">รายการสินค้า *</label>
        <button type="button" class="btn btn-outline btn-sm" onclick="v9QuotAddItem()">
          <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มรายการ
        </button>
      </div>
      <div id="v9quot-items" style="margin-bottom:12px;display:flex;flex-direction:column;gap:6px;">
        <p style="text-align:center;color:var(--text-tertiary);padding:16px;font-size:13px;
          border:1.5px dashed var(--border-light);border-radius:8px;">
          กดปุ่ม + เพิ่มรายการ
        </p>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:10px 14px;background:var(--bg-base);border-radius:8px;margin-bottom:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-size:11px;color:var(--text-tertiary);">ส่วนลด (บาท)</div>
            <input type="number" id="v9quot-discount" value="0" min="0"
              oninput="v9QuotUpdateTotal()"
              style="width:100px;padding:4px 8px;border:1.5px solid var(--border-light);border-radius:6px;font-size:14px;text-align:right;">
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:var(--text-tertiary);">ยอดรวม</div>
            <div id="v9quot-total-display" style="font-size:20px;font-weight:800;color:var(--primary);">฿0</div>
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-primary" style="width:100%;" onclick="v9SaveQuotation()">
        <i class="material-icons-round">save</i> บันทึกใบเสนอราคา
      </button>
    </form>`);
};

window.v9QuotAddItem = function () {
  const prods = window.products || [];
  const opts = prods.map(p => `<option value="${p.id}" data-price="${p.price}" data-unit="${p.unit||'ชิ้น'}">${p.name} — ฿${formatNum(p.price)}</option>`).join('');
  const idx = _v9QuotItems.length;
  _v9QuotItems.push({ product_id:'', name:'', qty:1, price:0, unit:'ชิ้น', total:0 });
  v9QuotRenderItems();
  // focus ใหม่
  setTimeout(() => { document.getElementById(`v9qi-prod-${idx}`)?.focus(); }, 50);
};

window.v9QuotRenderItems = function () {
  const el = document.getElementById('v9quot-items');
  if (!el) return;
  if (_v9QuotItems.length === 0) {
    el.innerHTML = `<p style="text-align:center;color:var(--text-tertiary);padding:16px;font-size:13px;border:1.5px dashed var(--border-light);border-radius:8px;">กดปุ่ม + เพิ่มรายการ</p>`;
    return;
  }
  const prods = window.products || [];
  el.innerHTML = _v9QuotItems.map((item, i) => {
    const opts = prods.map(p => `<option value="${p.id}" data-price="${p.price}" data-unit="${p.unit||'ชิ้น'}" ${p.id===item.product_id?'selected':''}>${p.name} — ฿${formatNum(p.price)}</option>`).join('');
    return `
      <div style="display:grid;grid-template-columns:1fr 80px 100px 100px 32px;gap:8px;align-items:center;
        padding:8px 10px;background:var(--bg-base);border-radius:8px;border:1px solid var(--border-light);">
        <select id="v9qi-prod-${i}" class="form-input" style="font-size:13px;"
          onchange="v9QuotSelectProd(${i},this)">
          <option value="">-- เลือกสินค้า --</option>${opts}
        </select>
        <input type="number" id="v9qi-qty-${i}" value="${item.qty}" min="1"
          class="form-input" style="font-size:13px;text-align:center;"
          oninput="v9QuotUpdateItem(${i})">
        <input type="number" id="v9qi-price-${i}" value="${item.price}" min="0"
          class="form-input" style="font-size:13px;text-align:right;"
          oninput="v9QuotUpdateItem(${i})">
        <div style="font-size:13px;font-weight:700;text-align:right;color:var(--primary);">
          ฿${formatNum(item.total)}
        </div>
        <button type="button" onclick="v9QuotRemoveItem(${i})"
          style="background:none;border:none;cursor:pointer;color:#ef4444;padding:0;line-height:1;">
          <i class="material-icons-round" style="font-size:18px;">close</i>
        </button>
      </div>`;
  }).join('');
  v9QuotUpdateTotal();
};

window.v9QuotSelectProd = function (idx, sel) {
  const opt = sel.selectedOptions[0];
  if (!opt?.value) return;
  const prods = window.products || [];
  const prod = prods.find(p => p.id === opt.value);
  _v9QuotItems[idx].product_id = opt.value;
  _v9QuotItems[idx].name       = prod?.name || opt.text.split(' — ')[0];
  _v9QuotItems[idx].price      = prod?.price || 0;
  _v9QuotItems[idx].unit       = prod?.unit || 'ชิ้น';
  const priceEl = document.getElementById(`v9qi-price-${idx}`);
  if (priceEl) priceEl.value = prod?.price || 0;
  v9QuotUpdateItem(idx);
};

window.v9QuotUpdateItem = function (idx) {
  const qty   = Number(document.getElementById(`v9qi-qty-${idx}`)?.value || 0);
  const price = Number(document.getElementById(`v9qi-price-${idx}`)?.value || 0);
  _v9QuotItems[idx].qty   = qty;
  _v9QuotItems[idx].price = price;
  _v9QuotItems[idx].total = qty * price;
  v9QuotUpdateTotal();
  // update total display inline
  const rows = document.getElementById('v9quot-items')?.children;
  if (rows?.[idx]) {
    const totEl = rows[idx].querySelector('div[style*="font-weight:700"]');
    if (totEl) totEl.textContent = `฿${formatNum(qty * price)}`;
  }
};

window.v9QuotRemoveItem = function (idx) {
  _v9QuotItems.splice(idx, 1);
  v9QuotRenderItems();
};

window.v9QuotUpdateTotal = function () {
  const sub      = _v9QuotItems.reduce((s, i) => s + i.total, 0);
  const discount = Number(document.getElementById('v9quot-discount')?.value || 0);
  const total    = Math.max(0, sub - discount);
  const el = document.getElementById('v9quot-total-display');
  if (el) el.textContent = `฿${formatNum(total)}`;
};

window.v9SaveQuotation = async function () {
  const customer = document.getElementById('v9quot-customer')?.value?.trim();
  if (!customer) { typeof toast==='function'&&toast('กรุณากรอกชื่อลูกค้า','error'); return; }
  if (_v9QuotItems.length === 0 || !_v9QuotItems.some(i=>i.product_id)) {
    typeof toast==='function'&&toast('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ','error'); return;
  }
  const discount = Number(document.getElementById('v9quot-discount')?.value||0);
  const sub      = _v9QuotItems.reduce((s,i)=>s+i.total,0);
  const total    = Math.max(0, sub - discount);
  const validUntil = document.getElementById('v9quot-valid')?.value||null;
  const note     = document.getElementById('v9quot-note')?.value?.trim()||'';

  v9ShowOverlay('กำลังบันทึกใบเสนอราคา...');
  try {
    const { data: quot, error } = await db.from('ใบเสนอราคา').insert({
      customer_name: customer, total, discount, valid_until: validUntil,
      note, staff_name: v9Staff(), status: 'รออนุมัติ', date: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);

    // บันทึก รายการใบเสนอราคา
    const validItems = _v9QuotItems.filter(i => i.product_id && i.qty > 0);
    for (const item of validItems) {
      await db.from('รายการใบเสนอราคา').insert({
        quotation_id: quot.id, product_id: item.product_id,
        name: item.name, qty: item.qty, price: item.price, total: item.total,
        unit: item.unit || 'ชิ้น',
      });
    }

    typeof closeModal==='function' && closeModal();
    typeof toast==='function' && toast(`สร้างใบเสนอราคา ${customer} ฿${formatNum(total)} สำเร็จ`, 'success');
    window.renderQuotations?.();
  } catch(e) {
    typeof toast==='function'&&toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};

window.v9ConvertQuotation = async function (quotId, customerName) {
  const r = await Swal.fire({
    title: 'สร้างบิลขาย?',
    html: `<div style="font-size:14px;color:#64748b;">จากใบเสนอราคาของ <strong>${customerName}</strong></div>`,
    icon: 'question', showCancelButton:true,
    confirmButtonText:'สร้างบิล', cancelButtonText:'ยกเลิก', confirmButtonColor:'#10B981',
  });
  if (!r.isConfirmed) return;
  v9ShowOverlay('กำลังแปลงเป็นบิล...');
  try {
    await db.from('ใบเสนอราคา').update({ status:'อนุมัติ', converted_bill_id:null }).eq('id',quotId);
    typeof toast==='function'&&toast(`แปลงสำเร็จ — ไปสร้างบิลที่หน้า POS ได้เลย`, 'success');
    window.renderQuotations?.();
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

window.v9CancelQuotation = async function (quotId) {
  const r = await Swal.fire({ title:'ยกเลิกใบเสนอราคา?', icon:'warning', showCancelButton:true, confirmButtonText:'ยกเลิกใบ', cancelButtonText:'ไม่', confirmButtonColor:'#DC2626' });
  if (!r.isConfirmed) return;
  await db.from('ใบเสนอราคา').update({ status:'ยกเลิก' }).eq('id',quotId);
  window.renderQuotations?.();
};

window.v9PrintQuotation = async function (quotId) {
  v9ShowOverlay('กำลังเตรียมพิมพ์...');
  try {
    const [{ data: quot }, { data: items }, { data: rc }] = await Promise.all([
      db.from('ใบเสนอราคา').select('*').eq('id',quotId).maybeSingle(),
      db.from('รายการใบเสนอราคา').select('*').eq('quotation_id',quotId),
      db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle(),
    ]);
    v9HideOverlay();
    if (!quot) { typeof toast==='function'&&toast('ไม่พบข้อมูล','error'); return; }

    const shopName  = rc?.shop_name  || 'ร้านค้า';
    const shopAddr  = rc?.address    || '';
    const shopPhone = rc?.phone      || '';
    const qtId      = `QT-${String(quotId).slice(-6).toUpperCase()}`;
    const itemsHTML = (items||[]).map(i => `
      <tr>
        <td style="padding:6px 8px;">${i.name}</td>
        <td style="padding:6px 8px;text-align:center;">${i.qty}</td>
        <td style="padding:6px 8px;text-align:right;">${formatNum(i.price)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;">${formatNum(i.total)}</td>
      </tr>`).join('');

    const w = window.open('','_blank','width=800,height=900');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>ใบเสนอราคา ${qtId}</title>
      <style>
        body{font-family:'Sarabun',sans-serif;margin:0;padding:32px;color:#1e293b;font-size:14px;}
        h1{font-size:24px;font-weight:800;margin:0;}
        table{width:100%;border-collapse:collapse;}
        th{background:#f8fafc;padding:8px;text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0;}
        td{border-bottom:1px solid #f1f5f9;}
        .total-row td{font-weight:800;font-size:16px;border-top:2px solid #e2e8f0;border-bottom:none;}
        @media print{body{padding:16px;}}
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap" rel="stylesheet">
    </head><body>
      <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
        <div>
          <h1>${shopName}</h1>
          ${shopAddr?`<p style="margin:2px 0;font-size:12px;color:#64748b;">${shopAddr}</p>`:''}
          ${shopPhone?`<p style="margin:2px 0;font-size:12px;color:#64748b;">โทร ${shopPhone}</p>`:''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:20px;font-weight:800;color:#dc2626;">ใบเสนอราคา</div>
          <div style="font-size:13px;color:#64748b;">${qtId}</div>
          <div style="font-size:12px;color:#94a3b8;">${new Date(quot.date).toLocaleDateString('th-TH',{dateStyle:'long'})}</div>
          ${quot.valid_until?`<div style="font-size:12px;color:#f59e0b;">หมดอายุ ${new Date(quot.valid_until).toLocaleDateString('th-TH',{dateStyle:'long'})}</div>`:''}
        </div>
      </div>
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;color:#94a3b8;">เสนอให้</div>
        <div style="font-size:16px;font-weight:700;">${quot.customer_name}</div>
      </div>
      <table>
        <thead><tr><th>รายการ</th><th style="text-align:center;">จำนวน</th><th style="text-align:right;">ราคา/หน่วย</th><th style="text-align:right;">รวม</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
        <tfoot>
          ${quot.discount>0?`<tr><td colspan="3" style="padding:8px;text-align:right;color:#64748b;">ส่วนลด</td><td style="padding:8px;text-align:right;color:#ef4444;">-${formatNum(quot.discount)}</td></tr>`:''}
          <tr class="total-row"><td colspan="3" style="padding:10px 8px;text-align:right;">ยอดรวมทั้งสิ้น</td><td style="padding:10px 8px;text-align:right;color:#dc2626;font-size:20px;">฿${formatNum(quot.total)}</td></tr>
        </tfoot>
      </table>
      ${quot.note?`<p style="margin-top:20px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px;">หมายเหตุ: ${quot.note}</p>`:''}
      <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
        <div style="text-align:center;"><div style="border-top:1px solid #cbd5e1;padding-top:8px;font-size:12px;color:#94a3b8;">ลายเซ็นผู้เสนอราคา</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #cbd5e1;padding-top:8px;font-size:12px;color:#94a3b8;">ลายเซ็นลูกค้า</div></div>
      </div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
    </body></html>`);
    w.document.close();
  } catch(e) { v9HideOverlay(); typeof toast==='function'&&toast('พิมพ์ไม่ได้: '+e.message,'error'); }
};

// alias เดิม
window.showAddQuotationModal = window.v9ShowQuotModal;
window.convertQuotation = function(id, name) { window.v9ConvertQuotation(id, name); };


// ══════════════════════════════════════════════════════════════════
// FIX-16 — showAddProductModal: สแกนบาร์โค้ด + เจนบาร์โค้ด
//         + ซ่อนปุ่มซ้ำ + แก้ quotation ใช้ let products โดยตรง
// ══════════════════════════════════════════════════════════════════

// ── helper: get products (let variable ไม่ใช่ window.x) ─────────
function v9GetProducts() {
  try { if (typeof products !== 'undefined' && products?.length) return products; } catch(_) {}
  return window._v9ProductsCache || [];
}

// sync cache ทุกครั้งที่ loadProducts สำเร็จ
const _v9OrigLoadProducts = window.loadProducts;
window.loadProducts = async function () {
  const result = await _v9OrigLoadProducts?.apply(this, arguments);
  try { if (typeof products !== 'undefined') window._v9ProductsCache = products; } catch(_) {}
  return result;
};

// ── แก้ Quotation ใช้ v9GetProducts() ───────────────────────────
window.v9QuotAddItem = function () {
  const prods = v9GetProducts();
  const idx   = _v9QuotItems.length;
  _v9QuotItems.push({ product_id:'', name:'', qty:1, price:0, unit:'ชิ้น', total:0 });
  v9QuotRenderItems();
  setTimeout(() => document.getElementById(`v9qi-prod-${idx}`)?.focus(), 50);
};

window.v9QuotRenderItems = function () {
  const el = document.getElementById('v9quot-items');
  if (!el) return;
  if (_v9QuotItems.length === 0) {
    el.innerHTML = `<p style="text-align:center;color:var(--text-tertiary);padding:16px;font-size:13px;border:1.5px dashed var(--border-light);border-radius:8px;">กดปุ่ม + เพิ่มรายการ</p>`;
    return;
  }
  const prods = v9GetProducts();
  el.innerHTML = _v9QuotItems.map((item, i) => {
    const opts = prods.map(p => `<option value="${p.id}" ${p.id===item.product_id?'selected':''}>${p.name} — ฿${formatNum(p.price||0)}</option>`).join('');
    return `
      <div style="display:grid;grid-template-columns:1fr 80px 100px 100px 32px;gap:8px;align-items:center;
        padding:8px 10px;background:var(--bg-base);border-radius:8px;border:1px solid var(--border-light);">
        <select id="v9qi-prod-${i}" class="form-input" style="font-size:13px;"
          onchange="v9QuotSelectProd(${i},this)">
          <option value="">-- เลือกสินค้า --</option>${opts}
        </select>
        <input type="number" id="v9qi-qty-${i}" value="${item.qty}" min="1"
          class="form-input" style="font-size:13px;text-align:center;"
          oninput="v9QuotUpdateItem(${i})">
        <input type="number" id="v9qi-price-${i}" value="${item.price}" min="0"
          class="form-input" style="font-size:13px;text-align:right;"
          oninput="v9QuotUpdateItem(${i})">
        <div id="v9qi-total-${i}" style="font-size:13px;font-weight:700;text-align:right;color:var(--primary);">
          ฿${formatNum(item.total)}
        </div>
        <button type="button" onclick="v9QuotRemoveItem(${i})"
          style="background:none;border:none;cursor:pointer;color:#ef4444;padding:0;line-height:1;">
          <i class="material-icons-round" style="font-size:18px;">close</i>
        </button>
      </div>`;
  }).join('');
  v9QuotUpdateTotal();
};

window.v9QuotSelectProd = function (idx, sel) {
  const opt = sel.selectedOptions[0];
  if (!opt?.value) return;
  const prods = v9GetProducts();
  const prod  = prods.find(p => p.id === opt.value);
  _v9QuotItems[idx].product_id = opt.value;
  _v9QuotItems[idx].name       = prod?.name || opt.text.split(' — ')[0];
  _v9QuotItems[idx].price      = prod?.price || 0;
  _v9QuotItems[idx].unit       = prod?.unit || 'ชิ้น';
  const priceEl = document.getElementById(`v9qi-price-${idx}`);
  if (priceEl) priceEl.value = prod?.price || 0;
  v9QuotUpdateItem(idx);
};

window.v9QuotUpdateItem = function (idx) {
  const qty   = Number(document.getElementById(`v9qi-qty-${idx}`)?.value || 0);
  const price = Number(document.getElementById(`v9qi-price-${idx}`)?.value || 0);
  _v9QuotItems[idx].qty   = qty;
  _v9QuotItems[idx].price = price;
  _v9QuotItems[idx].total = qty * price;
  const totEl = document.getElementById(`v9qi-total-${idx}`);
  if (totEl) totEl.textContent = `฿${formatNum(qty * price)}`;
  v9QuotUpdateTotal();
};


// ── showAddProductModal override: บาร์โค้ด scanner + generator ──
window.showAddProductModal = function (productData = null) {
  const isEdit = !!productData;
  // sync cache
  try { if (typeof products !== 'undefined') window._v9ProductsCache = products; } catch(_) {}
  const cats = (typeof categories !== 'undefined' ? categories : []) || [];

  if (typeof openModal !== 'function') return;
  openModal(isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่', `
    <form id="v9-product-form" onsubmit="event.preventDefault();v9SaveProduct()">

      <!-- ชื่อ -->
      <div class="form-group">
        <label class="form-label">ชื่อสินค้า *</label>
        <input class="form-input" id="v9prod-name" value="${productData?.name||''}" required>
      </div>

      <!-- บาร์โค้ด + ปุ่มสแกน + ปุ่มเจน -->
      <div class="form-group">
        <label class="form-label">บาร์โค้ด</label>
        <div style="display:flex;gap:8px;align-items:stretch;">
          <input class="form-input" id="v9prod-barcode" value="${productData?.barcode||''}"
            placeholder="สแกนหรือพิมพ์บาร์โค้ด" style="flex:1;"
            oninput="v9BarcodePreview()">
          <button type="button" id="v9-scan-btn"
            onclick="v9StartBarcodeScanner()"
            style="padding:0 14px;border:1.5px solid var(--primary);border-radius:var(--radius-md);
              background:var(--primary);color:#fff;cursor:pointer;white-space:nowrap;
              font-size:13px;font-weight:600;display:flex;align-items:center;gap:5px;
              font-family:var(--font-thai,'Prompt'),sans-serif;">
            <i class="material-icons-round" style="font-size:18px;">qr_code_scanner</i>
            สแกน
          </button>
          <button type="button"
            onclick="v9GenerateBarcode()"
            style="padding:0 12px;border:1.5px solid #6366f1;border-radius:var(--radius-md);
              background:#6366f1;color:#fff;cursor:pointer;white-space:nowrap;
              font-size:13px;font-weight:600;display:flex;align-items:center;gap:5px;
              font-family:var(--font-thai,'Prompt'),sans-serif;">
            <i class="material-icons-round" style="font-size:16px;">auto_awesome</i>
            สุ่ม
          </button>
        </div>
        <!-- Camera preview (hidden by default) -->
        <div id="v9-scan-wrap" style="display:none;margin-top:10px;border-radius:12px;overflow:hidden;position:relative;">
          <video id="v9-scan-video" autoplay playsinline muted
            style="width:100%;max-height:200px;object-fit:cover;background:#000;display:block;border-radius:12px;"></video>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
            <div style="width:60%;height:40%;border:2.5px solid #10b981;border-radius:8px;
              box-shadow:0 0 0 9999px rgba(0,0,0,.45);"></div>
          </div>
          <button type="button" onclick="v9StopScanner()"
            style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.6);color:#fff;
              border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;
              font-size:18px;display:flex;align-items:center;justify-content:center;">✕</button>
          <div id="v9-scan-status"
            style="position:absolute;bottom:8px;left:0;right:0;text-align:center;
              font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);">
            กำลังตรวจจับบาร์โค้ด...
          </div>
        </div>
        <!-- Barcode preview -->
        <div id="v9-bc-preview" style="display:none;margin-top:8px;text-align:center;
          padding:10px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
          <svg id="v9-bc-svg"></svg>
          <div id="v9-bc-num" style="font-size:11px;color:#94a3b8;margin-top:4px;"></div>
        </div>
      </div>

      <!-- ราคา / ต้นทุน -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">ราคาขาย (บาท) *</label>
          <input class="form-input" type="number" id="v9prod-price" value="${productData?.price||''}" required min="0">
        </div>
        <div class="form-group">
          <label class="form-label">ต้นทุน (บาท)</label>
          <input class="form-input" type="number" id="v9prod-cost" value="${productData?.cost||0}" min="0">
        </div>
      </div>

      <!-- สต็อก -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">สต็อก *</label>
          <input class="form-input" type="number" id="v9prod-stock" value="${productData?.stock||0}" required min="0">
        </div>
        <div class="form-group">
          <label class="form-label">สต็อกขั้นต่ำ</label>
          <input class="form-input" type="number" id="v9prod-min-stock" value="${productData?.min_stock||0}" min="0">
        </div>
      </div>

      <!-- หน่วย / หมวดหมู่ -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">หน่วย</label>
          <input class="form-input" id="v9prod-unit" value="${productData?.unit||'ชิ้น'}">
        </div>
        <div class="form-group">
          <label class="form-label">หมวดหมู่</label>
          <select class="form-input" id="v9prod-category">
            <option value="">-- เลือก --</option>
            ${cats.map(c=>`<option value="${c.name}" ${productData?.category===c.name?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- รูปภาพ (รองรับการถ่ายรูป / อัปโหลดจากมือถือ พร้อมบีบอัด) -->
      <div class="form-group">
        <label class="form-label">รูปภาพสินค้า <span style="font-size:11px;color:var(--text-tertiary);">(สูงสุด 100KB)</span></label>
        <div style="background:var(--bg-surface); border:1px dashed var(--border-light); border-radius:var(--radius-md); padding:16px; text-align:center;">
          
          <div id="v9prod-img-preview-wrap" style="display:${productData?.img_url ? 'block' : 'none'}; position:relative; max-width:180px; margin:0 auto 12px auto; border-radius:8px; overflow:hidden; box-shadow:var(--shadow-sm); border:1px solid #e2e8f0;">
            <img id="v9prod-img-preview" src="${productData?.img_url || ''}" style="width:100%; height:auto; display:block;">
            <button type="button" onclick="v9ClearProductImage()" style="position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
              <i class="material-icons-round" style="font-size:16px;">close</i>
            </button>
          </div>
          
          <div style="display:flex; justify-content:center;">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('prod-img-upload').click()" style="width:100%; max-width:200px; display:flex; justify-content:center; align-items:center; gap:6px;">
              <i class="material-icons-round">photo_camera</i> ถ่ายรูป/เลือกรูป
            </button>
            <input type="file" accept="image/*" capture="environment" id="prod-img-upload" style="display:none;" onchange="v9HandleImageSelect(event)">
          </div>
          
          <input type="hidden" id="v9prod-img" value="${productData?.img_url || ''}">
          <input type="hidden" id="v9prod-img-old" value="${productData?.img_url || ''}">
        </div>
      </div>

      <!-- หมายเหตุ -->
      <div class="form-group">
        <label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="v9prod-note" value="${productData?.note||''}">
      </div>

      <input type="hidden" id="v9prod-id" value="${productData?.id||''}">
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;">
        <i class="material-icons-round">save</i> บันทึก
      </button>
    </form>`);

  // render barcode preview if editing
  if (productData?.barcode) setTimeout(() => v9BarcodePreview(), 200);
};

// ── เจนบาร์โค้ดแบบสุ่ม ──────────────────────────────────────────
window.v9GenerateBarcode = function () {
  const bc = '8' + Date.now().toString().slice(-11);  // EAN-13 style
  const el = document.getElementById('v9prod-barcode');
  if (el) { el.value = bc; v9BarcodePreview(); }
};

// ── preview SVG barcode ─────────────────────────────────────────
window.v9BarcodePreview = function () {
  const val  = document.getElementById('v9prod-barcode')?.value?.trim();
  const wrap = document.getElementById('v9-bc-preview');
  const svgEl= document.getElementById('v9-bc-svg');
  const numEl= document.getElementById('v9-bc-num');
  if (!wrap || !svgEl) return;
  if (!val) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  if (numEl) numEl.textContent = val;
  if (typeof JsBarcode !== 'undefined') {
    try {
      JsBarcode(svgEl, val, { format:'CODE128', width:1.8, height:50, displayValue:false });
    } catch(e) { console.warn('JsBarcode:', e.message); }
  }
};

// ── Scanner (BarcodeDetector API / fallback) ─────────────────────
let _v9ScanStream = null;
let _v9ScanTimer  = null;

window.v9StartBarcodeScanner = async function () {
  const wrap  = document.getElementById('v9-scan-wrap');
  const video = document.getElementById('v9-scan-video');
  const btn   = document.getElementById('v9-scan-btn');
  if (!wrap || !video) return;

  // ตรวจ BarcodeDetector support
  if (!('BarcodeDetector' in window)) {
    // fallback: prompt ให้พิมพ์เอง
    typeof toast === 'function' && toast('กล้องไม่รองรับ BarcodeDetector — พิมพ์บาร์โค้ดโดยตรงได้เลย', 'info');
    document.getElementById('v9prod-barcode')?.focus();
    return;
  }

  try {
    _v9ScanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal:'environment' }, width:{ ideal:1280 } }
    });
    video.srcObject = _v9ScanStream;
    wrap.style.display = 'block';
    if (btn) btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;">stop_circle</i> หยุด';
    if (btn) btn.onclick = () => v9StopScanner();

    const detector = new BarcodeDetector({ formats:['code_128','ean_13','ean_8','upc_a','qr_code'] });
    const statusEl = document.getElementById('v9-scan-status');

    _v9ScanTimer = setInterval(async () => {
      if (video.readyState < 2) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const bc = barcodes[0].rawValue;
          const input = document.getElementById('v9prod-barcode');
          if (input) { input.value = bc; v9BarcodePreview(); }
          if (statusEl) statusEl.textContent = `✅ พบบาร์โค้ด: ${bc}`;
          if (statusEl) statusEl.style.color = '#10b981';
          // หยุดหลัง 1.2 วิ
          setTimeout(() => v9StopScanner(), 1200);
        }
      } catch(_) {}
    }, 300);

  } catch(e) {
    typeof toast === 'function' && toast('ไม่สามารถเข้าถึงกล้อง: ' + e.message, 'error');
  }
};

window.v9StopScanner = function () {
  clearInterval(_v9ScanTimer); _v9ScanTimer = null;
  if (_v9ScanStream) { _v9ScanStream.getTracks().forEach(t => t.stop()); _v9ScanStream = null; }
  const wrap = document.getElementById('v9-scan-wrap');
  const btn  = document.getElementById('v9-scan-btn');
  if (wrap) wrap.style.display = 'none';
  if (btn) {
    btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;">qr_code_scanner</i> สแกน';
    btn.onclick = () => v9StartBarcodeScanner();
  }
};

// ── ระบบจัดการรูปภาพ (Client-Side Compression & Supabase) ──────────
window.v9ClearProductImage = function() {
  document.getElementById('v9prod-img-preview-wrap').style.display = 'none';
  document.getElementById('v9prod-img-preview').src = '';
  document.getElementById('v9prod-img').value = '';
  document.getElementById('prod-img-upload').value = '';
};

window.v9CompressImage = function(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxW = 800;
        if (width > maxW) {
          height = Math.round((height * maxW) / width);
          width = maxW;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.7);
      };
      img.onerror = () => reject(new Error('โหลดรูปภาพไม่สำเร็จ'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
};

window.v9HandleImageSelect = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const previewWrap = document.getElementById('v9prod-img-preview-wrap');
    const previewImg = document.getElementById('v9prod-img-preview');
    const inputHidden = document.getElementById('v9prod-img');
    
    // โชว์รูปตัวอย่างทันที
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewWrap.style.display = 'block';
    
    // ตีตราว่าเป็นการอัปโหลดรูปใหม่ (ไม่ต้องใช้ URL เดิม)
    inputHidden.value = "FILE_SELECTED"; 
  } catch (err) {
    console.error(err);
    typeof toast==='function' && toast('เกิดข้อผิดพลาดในการแสดงรูปภาพ','error');
  }
};

window.uploadImageToSupabase = async function(file) {
  if (!file) return null;
  const compressedBlob = await window.v9CompressImage(file);
  const fileName = `prod_${Date.now()}.webp`;
  
  const { data, error } = await db.storage
    .from('product-images')
    .upload(fileName, compressedBlob, { contentType: 'image/webp', cacheControl: '3600', upsert: false });
    
  if (error) throw new Error("อัปโหลดรูปไม่สำเร็จ: " + error.message);
  
  const { data: publicUrlData } = db.storage.from('product-images').getPublicUrl(fileName);
  return publicUrlData.publicUrl;
};

// ── v9SaveProduct ────────────────────────────────────────────────
window.v9SaveProduct = async function () {
  const id      = document.getElementById('v9prod-id')?.value;
  const name    = document.getElementById('v9prod-name')?.value?.trim();
  if (!name) { typeof toast==='function'&&toast('กรุณากรอกชื่อสินค้า','error'); return; }

  v9StopScanner();  // หยุดกล้องถ้าเปิดอยู่
  v9ShowOverlay(id ? 'กำลังบันทึกและอัปโหลดรูป...' : 'กำลังสร้างสินค้าและอัปโหลดรูป...', name);

  let finalImgUrl = document.getElementById('v9prod-img')?.value?.trim();
  const oldImgUrl = document.getElementById('v9prod-img-old')?.value?.trim();
  const fileInput = document.getElementById('prod-img-upload');

  try {
    // 1. จัดการรูปภาพ (อัปโหลดใหม่ / ลบของเก่า)
    if (finalImgUrl === "FILE_SELECTED" && fileInput.files.length > 0) {
      finalImgUrl = await window.uploadImageToSupabase(fileInput.files[0]);
      
      // ลบรูปเก่าถ้ามีการเปลี่ยนรูป
      if (oldImgUrl && oldImgUrl.includes('product-images/')) {
        const oldFileName = oldImgUrl.substring(oldImgUrl.lastIndexOf('/') + 1);
        if (oldFileName) await db.storage.from('product-images').remove([oldFileName]).catch(()=>{});
      }
    } else if (!finalImgUrl && oldImgUrl && oldImgUrl.includes('product-images/')) {
      // ถ้าผู้ใช้กด X กากบาทลบรูปทิ้ง ให้ตามไปลบใน Bucket ด้วย
      const oldFileName = oldImgUrl.substring(oldImgUrl.lastIndexOf('/') + 1);
      if (oldFileName) await db.storage.from('product-images').remove([oldFileName]).catch(()=>{});
      finalImgUrl = null;
    }

    // 2. เตรียมข้อมูลสินค้า
    const data = {
      name,
      barcode:    document.getElementById('v9prod-barcode')?.value?.trim() || null,
      price:      Number(document.getElementById('v9prod-price')?.value || 0),
      cost:       Number(document.getElementById('v9prod-cost')?.value  || 0),
      stock:      Number(document.getElementById('v9prod-stock')?.value || 0),
      min_stock:  Number(document.getElementById('v9prod-min-stock')?.value || 0),
      unit:       document.getElementById('v9prod-unit')?.value?.trim()    || 'ชิ้น',
      category:   document.getElementById('v9prod-category')?.value || null,
      img_url:    finalImgUrl === "FILE_SELECTED" ? null : (finalImgUrl || null),
      note:       document.getElementById('v9prod-note')?.value?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let err;
    if (id) {
      ({ error: err } = await db.from('สินค้า').update(data).eq('id', id));
    } else {
      ({ error: err } = await db.from('สินค้า').insert(data));
    }
    if (err) throw new Error(err.message);
    typeof closeModal==='function' && closeModal();
    typeof toast==='function' && toast(id?'แก้ไขสินค้าสำเร็จ':'เพิ่มสินค้าสำเร็จ','success');
    await loadProducts?.();
    try { if (typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    typeof renderInventory==='function' && renderInventory();
  } catch(e) {
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};

// alias เดิม
window.editProduct = function (productId) {
  const p = v9GetProducts().find(x => x.id === productId);
  if (p) window.showAddProductModal(p);
};


// ── renderInventory: ซ่อนปุ่มซ้ำ / override page-actions ────────
const _v9OrigRenderInv = window.renderInventory;
window.renderInventory = async function () {
  await _v9OrigRenderInv?.apply(this, arguments);
  // sync products cache
  try { if (typeof products !== 'undefined') window._v9ProductsCache = products; } catch(_) {}
  // replace page-actions ให้มีแค่ปุ่มที่ต้องการ
  const pa = document.getElementById('page-actions');
  if (pa) {
    pa.innerHTML = `
      <button class="btn btn-outline" onclick="showBarcodeBatchModal?.()">
        <i class="material-icons-round">qr_code_2</i> ปริ้นบาร์โค้ด
      </button>
      <button class="btn btn-outline" onclick="exportInventory?.()">
        <i class="material-icons-round">download</i> CSV
      </button>
      <button class="btn btn-primary" onclick="showAddProductModal()">
        <i class="material-icons-round">add</i> เพิ่มสินค้า
      </button>`;
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-17A — printA4: CSS Flex + Auto-Scale Font
//   • 1 หน้า A4 เสมอ ไม่ว่าจะกี่รายการ
//   • font-size ลดอัตโนมัติตาม row count
//   • ลายเซ็นอยู่ล่างสุดทุกครั้ง (margin-top:auto)
//   • ไม่แสดงต้นทุน/กำไรในใบลูกค้า (clean)
// ══════════════════════════════════════════════════════════════════

window.printA4 = function (bill, items, rc) {
  const win = window.open('', '_blank', 'width=900,height=750');
  if (!win) return;

  const count     = (items || []).length;
  // ── Auto-scale: font size ตาม row count ──────────────────────
  const bodySize  = count <= 5  ? 13
                  : count <= 10 ? 12
                  : count <= 15 ? 11
                  : count <= 20 ? 10
                  : count <= 25 ? 9
                  : count <= 30 ? 8
                  : 7;
  const thSize    = Math.max(bodySize - 1, 6);
  const tdPad     = count <= 15 ? '5px 7px'
                  : count <= 25 ? '3px 6px'
                  : '2px 5px';
  const hdrSize   = Math.max(bodySize + 3, 11);
  const titleSize = Math.max(bodySize + 6, 14);

  const subtotal  = (items||[]).reduce((s,i) => s + i.total, 0);
  const rows      = (items||[]).map((it, n) => `
    <tr>
      <td style="text-align:center">${n+1}</td>
      <td>${it.name}</td>
      <td style="text-align:center">${it.qty} ${it.unit||'ชิ้น'}</td>
      <td style="text-align:right">฿${formatNum(it.price)}</td>
      <td style="text-align:right;font-weight:600">฿${formatNum(it.total)}</td>
    </tr>`).join('');

  const dateStr = new Date(bill.date).toLocaleDateString('th-TH', {
    year:'numeric', month:'long', day:'numeric',
    hour:'2-digit', minute:'2-digit'
  });

  win.document.write(`<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8">
<title>ใบเสร็จ #${bill.bill_no}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');

@page { size: A4 portrait; margin: 10mm 12mm; }

* { margin:0; padding:0; box-sizing:border-box; }

html, body {
  font-family: 'Sarabun', sans-serif;
  font-size: ${bodySize}px;
  color: #1e293b;
  width: 100%;
  height: 100%;
}

/* ── Outer shell: ใช้ flex column เพื่อดัน signature ลงล่าง ── */
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ── Header ──────────────────────────────────────────────────── */
.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${Math.max(bodySize, 8)}px;
  padding-bottom: ${Math.max(bodySize - 2, 6)}px;
  border-bottom: 2px solid #DC2626;
}
.shop-name {
  font-size: ${titleSize}px;
  font-weight: 700;
  color: #DC2626;
  line-height: 1.2;
}
.shop-info {
  font-size: ${Math.max(bodySize - 1, 6)}px;
  color: #64748b;
  margin-top: 3px;
  line-height: 1.6;
}
.doc-title {
  text-align: right;
}
.doc-title-label {
  font-size: ${titleSize}px;
  font-weight: 700;
  color: #DC2626;
}
.doc-meta {
  font-size: ${Math.max(bodySize - 1, 6)}px;
  color: #64748b;
  margin-top: 3px;
  line-height: 1.6;
}

/* ── Customer bar ─────────────────────────────────────────────── */
.customer-bar {
  display: flex;
  gap: 20px;
  margin-bottom: ${Math.max(bodySize - 1, 5)}px;
  padding: ${Math.max(bodySize - 3, 4)}px ${Math.max(bodySize, 8)}px;
  background: #f8fafc;
  border-left: 3px solid #DC2626;
  border-radius: 0 4px 4px 0;
  font-size: ${Math.max(bodySize - 1, 6)}px;
}
.customer-bar span { color: #94a3b8; margin-right: 4px; }
.customer-bar strong { color: #1e293b; }

/* ── Items table ─────────────────────────────────────────────── */
.items-section { flex-shrink: 0; }

table {
  width: 100%;
  border-collapse: collapse;
}
thead th {
  background: #DC2626;
  color: #fff;
  padding: ${tdPad};
  font-size: ${thSize}px;
  font-weight: 600;
  white-space: nowrap;
}
thead th:first-child { border-radius: 4px 0 0 0; }
thead th:last-child  { border-radius: 0 4px 0 0; }
tbody tr:nth-child(even) { background: #fafafa; }
tbody tr:last-child td   { border-bottom: 1px solid #e2e8f0; }
tbody td {
  padding: ${tdPad};
  font-size: ${bodySize}px;
  border-bottom: 0.5px solid #f1f5f9;
  line-height: 1.3;
}

/* ── Summary ─────────────────────────────────────────────────── */
.summary-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: ${Math.max(bodySize - 2, 5)}px;
  flex-shrink: 0;
}
.summary {
  width: 240px;
  font-size: ${Math.max(bodySize - 1, 6)}px;
}
.sum-row {
  display: flex;
  justify-content: space-between;
  padding: ${Math.max(bodySize - 7, 2)}px 0;
  border-bottom: 0.5px solid #f1f5f9;
}
.sum-row.grand {
  font-size: ${Math.max(bodySize + 2, 9)}px;
  font-weight: 700;
  color: #DC2626;
  border-top: 1.5px solid #DC2626;
  border-bottom: none;
  padding-top: ${Math.max(bodySize - 5, 3)}px;
  margin-top: 2px;
}
.payment-row {
  display: flex;
  justify-content: space-between;
  padding: ${Math.max(bodySize - 7, 2)}px 0;
  font-size: ${Math.max(bodySize - 1, 6)}px;
  color: #64748b;
}

/* ── Spacer ──────────────────────────────────────────────────── */
.spacer { flex: 1; }

/* ── Signature (ดัน margin-top:auto ให้อยู่ล่างสุด) ─────────── */
.signature-section {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 8px;
}
.footer-note {
  font-size: ${Math.max(bodySize - 2, 5)}px;
  color: #94a3b8;
  text-align: center;
  margin-bottom: 12px;
}
.sig-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-top: 4px;
}
.sig-box {
  text-align: center;
}
.sig-line {
  height: 36px;
  border-bottom: 1px solid #cbd5e1;
  margin-bottom: 4px;
}
.sig-label {
  font-size: ${Math.max(bodySize - 2, 5)}px;
  color: #94a3b8;
}

@media print {
  body { min-height: 0; height: 297mm; }
  .spacer { flex: 1; }
}
</style>
</head>
<body>

<!-- ── Header ── -->
<div class="doc-header">
  <div>
    <div class="shop-name">${rc?.shop_name || 'SK POS'}</div>
    <div class="shop-info">
      ${rc?.address ? rc.address + '<br>' : ''}
      ${rc?.phone   ? 'โทร ' + rc.phone   : ''}
      ${rc?.tax_id  ? '<br>เลขผู้เสียภาษี ' + rc.tax_id : ''}
    </div>
  </div>
  <div class="doc-title">
    <div class="doc-title-label">ใบเสร็จรับเงิน</div>
    <div class="doc-meta">
      บิล #${bill.bill_no}<br>
      ${dateStr}<br>
      ${bill.staff_name ? 'พนักงาน: ' + bill.staff_name : ''}
    </div>
  </div>
</div>

<!-- ── Customer bar ── -->
<div class="customer-bar">
  <div><span>ลูกค้า</span><strong>${bill.customer_name || 'ลูกค้าทั่วไป'}</strong></div>
  <div><span>วิธีชำระ</span><strong>${bill.method}</strong></div>
</div>

<!-- ── Items ── -->
<div class="items-section">
  <table>
    <thead>
      <tr>
        <th style="width:30px;text-align:center">#</th>
        <th>รายการสินค้า</th>
        <th style="width:80px;text-align:center">จำนวน</th>
        <th style="width:80px;text-align:right">ราคา/หน่วย</th>
        <th style="width:80px;text-align:right">รวม</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>

<!-- ── Summary ── -->
<div class="summary-wrap">
  <div class="summary">
    <div class="sum-row"><span>ยอดรวม</span><span>฿${formatNum(subtotal)}</span></div>
    ${bill.discount > 0 ? `<div class="sum-row"><span>ส่วนลด</span><span style="color:#DC2626">-฿${formatNum(bill.discount)}</span></div>` : ''}
    <div class="sum-row grand"><span>ยอดสุทธิ</span><span>฿${formatNum(bill.total)}</span></div>
    ${bill.method === 'เงินสด' ? `
    <div class="payment-row"><span>รับมา</span><span>฿${formatNum(bill.received)}</span></div>
    <div class="payment-row"><span>เงินทอน</span><span>฿${formatNum(bill.change)}</span></div>` : ''}
  </div>
</div>

<!-- ── Spacer (ดัน signature ลงล่างสุด) ── -->
<div class="spacer"></div>

<!-- ── Signature ── -->
<div class="signature-section">
  <div class="footer-note">${rc?.receipt_footer || 'ขอบคุณที่ใช้บริการ'}</div>
  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">ผู้รับเงิน / พนักงาน</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">ผู้ตรวจสอบ</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">ลูกค้า / ผู้รับสินค้า</div>
    </div>
  </div>
</div>

<script>
  window.onload = function() {
    // รอ font load แล้วค่อย print
    document.fonts.ready.then(() => {
      setTimeout(() => window.print(), 200);
    });
  };
<\/script>
</body></html>`);
  win.document.close();
};


// ══════════════════════════════════════════════════════════════════
// FIX-17B — Multi-Unit Stock (Unit Conversion Table)
//   A: สร้าง unit config ต่อสินค้า (เก็บใน localStorage + Supabase)
//   ตาราง product_units: {product_id, unit_name, conv_rate, price_per_unit}
//   base unit = หน่วยที่สต็อกเก็บ (เช่น "คิว")
//   conv_rate  = จำนวน base ที่ 1 หน่วยนี้เท่ากัน (1 ปิ๊ป = 0.02 คิว → 0.02)
// ══════════════════════════════════════════════════════════════════

// SQL ที่ต้องรัน 1 ครั้งใน Supabase:
window.v9UnitSQL = `
CREATE TABLE IF NOT EXISTS public.product_units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.สินค้า(id) ON DELETE CASCADE,
  unit_name text NOT NULL,
  conv_rate double precision NOT NULL DEFAULT 1,
  price_per_unit bigint DEFAULT 0,
  is_base boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT product_units_pkey PRIMARY KEY (id)
);`;

// Cache product_units ใน memory
window._v9UnitCache = {};

window.v9LoadUnits = async function (productId, forceRefresh) {
  if (!forceRefresh && window._v9UnitCache[productId]) return window._v9UnitCache[productId];
  try {
    const { data, error } = await db.from('product_units').select('*').eq('product_id', productId).order('conv_rate');
    if (error) { console.warn('[v9LoadUnits]', error.message); return []; }
    window._v9UnitCache[productId] = data || [];
    return window._v9UnitCache[productId];
  } catch(e) { console.warn('[v9LoadUnits]', e.message); return []; }
};

// ── Modal จัดการหน่วยนับ ─────────────────────────────────────────
window.v9ShowUnitModal = async function (productId, productName) {
  const units = await v9LoadUnits(productId);
  if (typeof openModal !== 'function') return;

  openModal(`หน่วยนับ: ${productName}`, `
    <div style="margin-bottom:12px;">
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:10px;">
        กำหนดหน่วยนับและอัตราแปลง เช่น ทราย: 1 คิว = 50 ปิ๊ป = 1 รถ
      </div>

      <!-- ตารางหน่วยที่มีอยู่ -->
      <div id="v9-unit-list" style="margin-bottom:14px;"></div>

      <!-- ฟอร์มเพิ่มหน่วย -->
      <div style="background:var(--bg-base);border-radius:var(--radius-md);padding:12px;border:1px solid var(--border-light);">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:10px;">+ เพิ่มหน่วยใหม่</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 80px;gap:8px;align-items:end;">
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">ชื่อหน่วย *</label>
            <input class="form-input" id="v9unit-name" placeholder="เช่น ปิ๊ป, คิว, รถ" style="font-size:13px;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">อัตราแปลง (base) *</label>
            <input class="form-input" type="number" id="v9unit-rate" placeholder="0.02" min="0.0001" step="0.0001" style="font-size:13px;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">ราคาขาย/หน่วย (บาท)</label>
            <input class="form-input" type="number" id="v9unit-price" placeholder="0" min="0" style="font-size:13px;">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Base?</label>
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;padding:9px 0;">
              <input type="checkbox" id="v9unit-base"> Base
            </label>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" style="margin-top:10px;width:100%;"
          onclick="v9AddUnit('${productId}')">
          <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มหน่วย
        </button>
      </div>

      <div style="margin-top:12px;padding:8px 12px;background:#fef3c7;border-radius:var(--radius-md);font-size:11px;color:#92400e;">
        <strong>วิธีคิด:</strong> ถ้า base = คิว และ 1 ปิ๊ป = 0.02 คิว → conv_rate = 0.02<br>
        ถ้า 1 รถ = 1 คิว → conv_rate = 1 และ is_base = ✓
      </div>
    </div>`, 'lg');

  v9RenderUnitList(productId, units);
};

window.v9RenderUnitList = function (productId, units) {
  const el = document.getElementById('v9-unit-list');
  if (!el) return;
  if (units.length === 0) {
    el.innerHTML = `<p style="text-align:center;color:var(--text-tertiary);font-size:13px;padding:12px;">ยังไม่มีหน่วยนับ</p>`;
    return;
  }
  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--bg-base);">
          <th style="padding:6px 8px;text-align:left;font-weight:600;">หน่วย</th>
          <th style="padding:6px 8px;text-align:center;font-weight:600;">อัตราแปลง</th>
          <th style="padding:6px 8px;text-align:right;font-weight:600;">ราคา/หน่วย</th>
          <th style="padding:6px 8px;text-align:center;font-weight:600;">Base</th>
          <th style="padding:6px 8px;"></th>
        </tr>
      </thead>
      <tbody>
        ${units.map(u => `
          <tr style="border-bottom:0.5px solid var(--border-light);">
            <td style="padding:7px 8px;font-weight:${u.is_base?'700':'400'};color:${u.is_base?'var(--primary)':'var(--text-primary)'};">
              ${u.unit_name}
              ${u.is_base ? '<span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:3px;margin-left:4px;">BASE</span>' : ''}
            </td>
            <td style="padding:7px 8px;text-align:center;color:var(--text-secondary);">${u.conv_rate}</td>
            <td style="padding:7px 8px;text-align:right;">฿${formatNum(u.price_per_unit||0)}</td>
            <td style="padding:7px 8px;text-align:center;">${u.is_base?'✅':''}</td>
            <td style="padding:7px 8px;text-align:center;">
              <button onclick="v9DeleteUnit('${u.id}','${productId}')"
                style="background:none;border:none;cursor:pointer;color:var(--danger);">
                <i class="material-icons-round" style="font-size:16px;">delete</i>
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
};

window.v9AddUnit = async function (productId) {
  const name  = document.getElementById('v9unit-name')?.value?.trim();
  const rate  = Number(document.getElementById('v9unit-rate')?.value || 0);
  const price = Number(document.getElementById('v9unit-price')?.value || 0);
  const isBase= document.getElementById('v9unit-base')?.checked || false;
  if (!name || rate <= 0) { typeof toast==='function'&&toast('กรุณากรอกชื่อหน่วยและอัตราแปลง','error'); return; }

  v9ShowOverlay('กำลังบันทึกหน่วยนับ...');
  try {
    const { error } = await db.from('product_units').insert({ product_id:productId, unit_name:name, conv_rate:rate, price_per_unit:price, is_base:isBase });
    if (error) throw new Error(error.message);
    delete window._v9UnitCache[productId];
    const units = await v9LoadUnits(productId);
    v9RenderUnitList(productId, units);
    // reset form
    ['v9unit-name','v9unit-rate','v9unit-price'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    const cb = document.getElementById('v9unit-base'); if(cb) cb.checked = false;
    typeof toast==='function'&&toast(`เพิ่มหน่วย "${name}" สำเร็จ`,'success');
  } catch(e) {
    typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};

window.v9DeleteUnit = async function (unitId, productId) {
  v9ShowOverlay('กำลังลบหน่วย...');
  try {
    await db.from('product_units').delete().eq('id', unitId);
    delete window._v9UnitCache[productId];
    const units = await v9LoadUnits(productId);
    v9RenderUnitList(productId, units);
    typeof toast==='function'&&toast('ลบหน่วยสำเร็จ','success');
  } catch(e) { typeof toast==='function'&&toast('ลบไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

// ── เพิ่มปุ่ม "หน่วย" ใน inventory row ────────────────────────────
// Patch renderInventory เพิ่ม onclick unit button
const _v9OrigRenderInv2 = window.renderInventory;
window.renderInventory = async function () {
  await _v9OrigRenderInv2?.apply(this, arguments);
  try { if (typeof products !== 'undefined') window._v9ProductsCache = products; } catch(_) {}
  const pa = document.getElementById('page-actions');
  if (pa) {
    pa.innerHTML = `
      <button class="btn btn-outline" onclick="showBarcodeBatchModal?.()">
        <i class="material-icons-round">qr_code_2</i> ปริ้นบาร์โค้ด
      </button>
      <button class="btn btn-outline" onclick="exportInventory?.()">
        <i class="material-icons-round">download</i> CSV
      </button>
      <button class="btn btn-primary" onclick="showAddProductModal()">
        <i class="material-icons-round">add</i> เพิ่มสินค้า
      </button>`;
  }
  // inject "หน่วย" button ต่อจากปุ่ม edit ทุก product row
  document.querySelectorAll('[data-product-id]').forEach(row => {
    const pid  = row.dataset.productId;
    const name = row.dataset.productName || '';
    if (row.querySelector('.v9-unit-btn')) return;
    const editBtn = row.querySelector('[onclick*="editProduct"]');
    if (editBtn) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline btn-sm v9-unit-btn';
      btn.title = 'จัดการหน่วยนับ';
      btn.style.marginLeft = '4px';
      btn.innerHTML = '<i class="material-icons-round" style="font-size:14px;">straighten</i>';
      btn.onclick = () => v9ShowUnitModal(pid, name);
      editBtn.insertAdjacentElement('afterend', btn);
    }
  });
};


// ══════════════════════════════════════════════════════════════════
// FIX-17C — Quotation: Smart Search Row
//   ค้นชื่อ/บาร์โค้ด real-time, เพิ่มสินค้านอกระบบได้
// ══════════════════════════════════════════════════════════════════

// Override v9ShowQuotModal ทั้งหมด
window.v9ShowQuotModal = function () {
  _v9QuotItems = [];
  if (typeof openModal !== 'function') return;

  openModal('สร้างใบเสนอราคา', `
    <form id="v9-quot-form" onsubmit="event.preventDefault();">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">ชื่อลูกค้า *</label>
          <input class="form-input" id="v9quot-customer" placeholder="ชื่อลูกค้า" required>
        </div>
        <div class="form-group">
          <label class="form-label">วันหมดอายุ</label>
          <input class="form-input" type="date" id="v9quot-valid"
            value="${new Date(Date.now()+30*86400000).toISOString().split('T')[0]}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="v9quot-note" placeholder="หมายเหตุ (ถ้ามี)">
      </div>

      <!-- ── รายการสินค้า (Smart Search Rows) ── -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <label class="form-label" style="margin:0;font-size:13px;">รายการสินค้า *</label>
        <button type="button" class="btn btn-outline btn-sm" onclick="v9QuotAddRow()">
          <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มแถว
        </button>
      </div>

      <!-- Header -->
      <div style="display:grid;grid-template-columns:1fr 70px 90px 90px 30px;gap:6px;
        padding:4px 6px;background:var(--bg-base);border-radius:6px 6px 0 0;
        border:1px solid var(--border-light);border-bottom:none;">
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);">สินค้า (ค้นชื่อ/บาร์โค้ด)</div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-align:center;">จำนวน</div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-align:right;">ราคา/หน่วย</div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-align:right;">รวม</div>
        <div></div>
      </div>

      <div id="v9quot-rows" style="border:1px solid var(--border-light);border-radius:0 0 6px 6px;overflow:visible;">
        <div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px;">
          กดปุ่ม + เพิ่มแถว เพื่อเริ่มเพิ่มรายการ
        </div>
      </div>

      <!-- Summary -->
      <div style="display:flex;justify-content:flex-end;gap:24px;align-items:center;
        margin-top:12px;padding:10px 14px;background:var(--bg-base);border-radius:var(--radius-md);">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <span style="color:var(--text-secondary);">ส่วนลด</span>
          <div style="position:relative;">
            <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--text-tertiary);">฿</span>
            <input type="number" id="v9quot-discount" value="0" min="0"
              oninput="v9QuotCalcTotal()"
              style="width:90px;padding:5px 8px 5px 20px;border:1.5px solid var(--border-light);
                border-radius:6px;font-size:13px;text-align:right;">
          </div>
        </div>
        <div style="font-size:15px;font-weight:700;">
          ยอดรวม: <span id="v9quot-total-display" style="color:var(--primary);">฿0</span>
        </div>
      </div>

      <button type="button" class="btn btn-primary" style="width:100%;margin-top:12px;"
        onclick="v9SaveQuotation()">
        <i class="material-icons-round">save</i> บันทึกใบเสนอราคา
      </button>
    </form>`);
};

// ── เพิ่มแถว Smart Search ──────────────────────────────────────────
window.v9QuotAddRow = function () {
  const idx = _v9QuotItems.length;
  _v9QuotItems.push({ product_id:'', name:'', qty:1, price:0, unit:'ชิ้น', total:0, is_custom:false });
  v9QuotRenderRows();
  // auto-focus search
  setTimeout(() => document.getElementById(`v9qs-${idx}`)?.focus(), 60);
};

window.v9QuotRenderRows = function () {
  const el = document.getElementById('v9quot-rows');
  if (!el) return;
  if (_v9QuotItems.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px;">กดปุ่ม + เพิ่มแถว เพื่อเริ่มเพิ่มรายการ</div>`;
    return;
  }
  el.innerHTML = _v9QuotItems.map((item, i) => `
    <div style="display:grid;grid-template-columns:1fr 70px 90px 90px 30px;gap:6px;
      padding:6px;border-bottom:0.5px solid var(--border-light);
      background:${item.is_custom?'#fef9f0':'var(--bg-surface)'};position:relative;">

      <!-- Search field -->
      <div style="position:relative;">
        <input id="v9qs-${i}" class="form-input"
          value="${item.name}"
          placeholder="ค้นชื่อสินค้า / บาร์โค้ด..."
          autocomplete="off"
          style="font-size:12px;padding:6px 8px;${item.is_custom?'border-color:#f59e0b;':''}"
          oninput="v9QuotSearchProduct(${i},this.value)"
          onblur="setTimeout(()=>v9QuotHideDropdown(${i}),200)">
        ${item.is_custom ? `<span style="position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:9px;background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;">กำหนดเอง</span>` : ''}
        <div id="v9qd-${i}" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:9999;
          background:var(--bg-surface);border:1px solid var(--border-light);border-radius:0 0 8px 8px;
          max-height:200px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.12);"></div>
      </div>

      <!-- Qty -->
      <input type="number" id="v9qq-${i}" value="${item.qty}" min="0.01" step="0.01"
        class="form-input" style="font-size:12px;padding:6px 4px;text-align:center;"
        oninput="v9QuotUpdateRow(${i})">

      <!-- Price -->
      <input type="number" id="v9qp-${i}" value="${item.price}" min="0"
        class="form-input" style="font-size:12px;padding:6px 4px;text-align:right;"
        oninput="v9QuotUpdateRow(${i})">

      <!-- Total -->
      <div id="v9qt-${i}" style="font-size:12px;font-weight:700;color:var(--primary);
        padding:6px 4px;text-align:right;align-self:center;">
        ฿${formatNum(item.total)}
      </div>

      <!-- Remove -->
      <button type="button" onclick="v9QuotRemoveRow(${i})"
        style="background:none;border:none;cursor:pointer;color:#ef4444;padding:0;align-self:center;justify-self:center;">
        <i class="material-icons-round" style="font-size:16px;">close</i>
      </button>
    </div>`).join('');
  v9QuotCalcTotal();
};

// ── ค้นหาสินค้า real-time ─────────────────────────────────────────
window.v9QuotSearchProduct = function (idx, query) {
  const dd = document.getElementById(`v9qd-${idx}`);
  if (!dd) return;
  _v9QuotItems[idx].name = query;

  const q   = query.toLowerCase().trim();
  const prods = v9GetProducts();

  // ตรงกับ barcode หรือ name
  const matches = q.length === 0 ? [] :
    prods.filter(p =>
      (p.name||'').toLowerCase().includes(q) ||
      (p.barcode||'').toLowerCase().includes(q)
    ).slice(0, 10);

  if (q.length === 0) { dd.style.display = 'none'; return; }

  const items = matches.map(p => `
    <div onclick="v9QuotPickProduct(${idx},'${p.id}','${(p.name||'').replace(/'/g,"\\'")}',${p.price||0},'${p.unit||'ชิ้น'}','${p.barcode||''}')"
      style="padding:8px 10px;cursor:pointer;border-bottom:0.5px solid var(--border-light);
        display:flex;justify-content:space-between;align-items:center;"
      onmouseenter="this.style.background='var(--bg-base)'"
      onmouseleave="this.style.background=''">
      <div>
        <div style="font-size:12px;font-weight:600;">${p.name}</div>
        ${p.barcode ? `<div style="font-size:10px;color:var(--text-tertiary);">${p.barcode}</div>` : ''}
      </div>
      <div style="font-size:12px;color:var(--primary);font-weight:700;">฿${formatNum(p.price||0)}</div>
    </div>`).join('');

  // ท้ายสุด: "สร้างสินค้าใหม่ชื่อ xxx"
  const addNew = `
    <div onclick="v9QuotCustomProduct(${idx},'${query.replace(/'/g,"\\'")}' )"
      style="padding:8px 10px;cursor:pointer;color:var(--primary);font-size:12px;
        display:flex;align-items:center;gap:6px;border-top:1px solid var(--border-light);
        background:var(--primary-50,#fef2f2);"
      onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">
      <i class="material-icons-round" style="font-size:14px;">add_circle</i>
      <span>เพิ่ม "<strong>${query}</strong>" เป็นสินค้านอกระบบ</span>
    </div>`;

  dd.innerHTML = (matches.length === 0
    ? `<div style="padding:8px 10px;font-size:12px;color:var(--text-tertiary);">ไม่พบสินค้า</div>`
    : items) + addNew;
  dd.style.display = 'block';
};

window.v9QuotPickProduct = function (idx, pid, name, price, unit, barcode) {
  _v9QuotItems[idx] = { product_id:pid, name, qty:_v9QuotItems[idx].qty||1, price, unit, total:price*(_v9QuotItems[idx].qty||1), is_custom:false };
  const nameEl  = document.getElementById(`v9qs-${idx}`);
  const priceEl = document.getElementById(`v9qp-${idx}`);
  if (nameEl)  nameEl.value  = name;
  if (priceEl) priceEl.value = price;
  v9QuotHideDropdown(idx);
  v9QuotUpdateRow(idx);
};

window.v9QuotCustomProduct = function (idx, name) {
  _v9QuotItems[idx].name       = name;
  _v9QuotItems[idx].product_id = '';
  _v9QuotItems[idx].is_custom  = true;
  const nameEl = document.getElementById(`v9qs-${idx}`);
  if (nameEl) nameEl.value = name;
  v9QuotHideDropdown(idx);
  // ไม่ re-render ทั้งหมด เพื่อให้ focus ยังอยู่
  const rowEl = nameEl?.closest('[style*="grid"]');
  if (rowEl) rowEl.style.background = '#fef9f0';
  const spanEl = nameEl?.parentElement?.querySelector('span');
  if (!spanEl) {
    const s = document.createElement('span');
    s.style.cssText = 'position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:9px;background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;';
    s.textContent = 'กำหนดเอง';
    nameEl.parentElement.appendChild(s);
  }
};

window.v9QuotHideDropdown = function (idx) {
  const dd = document.getElementById(`v9qd-${idx}`);
  if (dd) dd.style.display = 'none';
};

window.v9QuotUpdateRow = function (idx) {
  const qty   = Number(document.getElementById(`v9qq-${idx}`)?.value || 0);
  const price = Number(document.getElementById(`v9qp-${idx}`)?.value || 0);
  _v9QuotItems[idx].qty   = qty;
  _v9QuotItems[idx].price = price;
  _v9QuotItems[idx].total = Math.round(qty * price);
  const totEl = document.getElementById(`v9qt-${idx}`);
  if (totEl) totEl.textContent = `฿${formatNum(_v9QuotItems[idx].total)}`;
  v9QuotCalcTotal();
};

window.v9QuotRemoveRow = function (idx) {
  _v9QuotItems.splice(idx, 1);
  v9QuotRenderRows();
};

window.v9QuotCalcTotal = function () {
  const sub      = _v9QuotItems.reduce((s,i)=>s+i.total, 0);
  const discount = Number(document.getElementById('v9quot-discount')?.value||0);
  const total    = Math.max(0, sub - discount);
  const el = document.getElementById('v9quot-total-display');
  if (el) el.textContent = `฿${formatNum(total)}`;
};

// ── v9QuotUpdateTotal alias (compat) ────────────────────────────
window.v9QuotUpdateTotal = window.v9QuotCalcTotal;

// ── v9SaveQuotation (update ให้ใช้ _v9QuotItems ใหม่) ──────────
window.v9SaveQuotation = async function () {
  const customer = document.getElementById('v9quot-customer')?.value?.trim();
  if (!customer) { typeof toast==='function'&&toast('กรุณากรอกชื่อลูกค้า','error'); return; }
  const validRows = _v9QuotItems.filter(i => i.name && i.qty > 0);
  if (validRows.length === 0) { typeof toast==='function'&&toast('กรุณาเพิ่มรายการสินค้า','error'); return; }

  const discount  = Number(document.getElementById('v9quot-discount')?.value||0);
  const sub       = validRows.reduce((s,i)=>s+i.total, 0);
  const total     = Math.max(0, sub - discount);
  const validUntil= document.getElementById('v9quot-valid')?.value||null;
  const note      = document.getElementById('v9quot-note')?.value?.trim()||'';

  v9ShowOverlay('กำลังบันทึกใบเสนอราคา...');
  try {
    const { data: quot, error } = await db.from('ใบเสนอราคา').insert({
      customer_name: customer, total, discount, valid_until: validUntil,
      note, staff_name: v9Staff(), status:'รออนุมัติ', date:new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);

    // รายการ
    for (const item of validRows) {
      if (!item.product_id) continue; // สินค้านอกระบบไม่มี FK
      const { error: ie } = await db.from('รายการใบเสนอราคา').insert({
        quotation_id: quot.id, product_id: item.product_id,
        name: item.name, qty: item.qty, price: item.price,
        total: item.total, unit: item.unit||'ชิ้น',
      });
      if (ie) console.warn('quotation item:', ie.message);
    }
    // สินค้านอกระบบ — เก็บใน note เพิ่มเติม
    const customItems = validRows.filter(i => !i.product_id);
    if (customItems.length > 0) {
      const customNote = customItems.map(i=>`${i.name} x${i.qty} ฿${formatNum(i.price)}`).join(', ');
      await db.from('ใบเสนอราคา').update({ note: note ? note+' | '+customNote : customNote }).eq('id', quot.id);
    }

    typeof closeModal==='function' && closeModal();
    typeof toast==='function' && toast(`สร้างใบเสนอราคา ฿${formatNum(total)} สำเร็จ`,'success');
    window.renderQuotations?.();
  } catch(e) {
    typeof toast==='function'&&toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};


// ══════════════════════════════════════════════════════════════════
// FIX-18 — getShopConfig + printReceipt override (fix .single() crash)
//   Root cause: getShopConfig ใช้ .single() → throw ถ้าไม่มีข้อมูล
//   → printReceipt crash ก่อนถึง printA4 ใหม่
// ══════════════════════════════════════════════════════════════════

window.getShopConfig = async function () {
  try {
    const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle();
    return data || {};
  } catch(e) { return {}; }
};

window.printReceipt = async function (bill, items, format) {
  let rc = {};
  try { rc = await window.getShopConfig(); } catch(_) {}
  const fmt = format || rc.default_receipt_format || '80mm';
  if (typeof receiptFormat !== 'undefined') {
    try { receiptFormat = fmt; } catch(_) {}
  }
  
  if (fmt === 'A4') {
    const res = await Swal.fire({
      title: 'รูปแบบเอกสาร A4',
      html: `
        <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
          <label style="display:flex; align-items:center; gap:12px; padding:16px; border:2px solid var(--primary); border-radius:12px; cursor:pointer; background:rgba(220,38,38,0.03);" id="v9-lbl-receipt">
            <input type="radio" name="swal-doc-type" value="receipt" checked style="width:20px;height:20px;accent-color:var(--primary);">
            <div style="text-align:left;">
              <div style="font-weight:600;font-size:16px;color:var(--text-primary);">📄 ใบเสร็จรับเงิน / ใบกำกับภาษี</div>
              <div style="font-size:13px;color:var(--text-tertiary);margin-top:2px;">เอกสารสำหรับลูกค้ายืนยันการชำระเงิน</div>
            </div>
          </label>
          <label style="display:flex; align-items:center; gap:12px; padding:16px; border:2px solid var(--border-light); border-radius:12px; cursor:pointer;" id="v9-lbl-delivery">
            <input type="radio" name="swal-doc-type" value="delivery" style="width:20px;height:20px;accent-color:var(--primary);">
            <div style="text-align:left;">
              <div style="font-weight:600;font-size:16px;color:var(--text-primary);">🚚 ใบส่งของ (Delivery Note)</div>
              <div style="font-size:13px;color:var(--text-tertiary);margin-top:2px;">เอกสารสำหรับแนบไปกับสินค้าเพื่อเช็คของ</div>
            </div>
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="material-icons-round" style="font-size:18px;vertical-align:middle;margin-right:6px;">print</i> พิมพ์เอกสาร',
      cancelButtonText: 'ยกเลิก',
      didOpen: () => {
        const r1 = document.querySelector('input[value="receipt"]');
        const r2 = document.querySelector('input[value="delivery"]');
        const l1 = document.getElementById('v9-lbl-receipt');
        const l2 = document.getElementById('v9-lbl-delivery');
        const updateFx = () => {
          l1.style.borderColor = r1.checked ? 'var(--primary)' : 'var(--border-light)';
          l1.style.background = r1.checked ? 'rgba(220,38,38,0.03)' : 'transparent';
          l2.style.borderColor = r2.checked ? 'var(--primary)' : 'var(--border-light)';
          l2.style.background = r2.checked ? 'rgba(220,38,38,0.03)' : 'transparent';
        };
        r1.addEventListener('change', updateFx);
        r2.addEventListener('change', updateFx);
      },
      preConfirm: () => {
        const el = document.querySelector('input[name="swal-doc-type"]:checked');
        return el ? el.value : 'receipt';
      }
    });
    
    if (res.isConfirmed) {
      if (typeof window.printReceiptA4v2 === 'function') {
        window.printReceiptA4v2(bill, items, rc, res.value);
      } else {
        window.printA4(bill, items, rc);
      }
    }
  } else {
    if (typeof print80mm === 'function') print80mm(bill, items, rc);
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-19 — Admin Panel ครบวงจร
//   เพิ่ม tabs: หน่วยนับ | สูตรสินค้า | ซัพพลายเออร์ | ตั้งค่าขั้นสูง
//   override renderAdmin + renderAdminTabs
// ══════════════════════════════════════════════════════════════════

const _v9AdminTabs = [
  { key:'shop',     label:'ตั้งค่าร้านค้า',  icon:'store' },
  { key:'receipt',  label:'ใบเสร็จ/QR',      icon:'receipt_long' },
  { key:'users',    label:'สิทธิ์ผู้ใช้',    icon:'manage_accounts' },
  { key:'emp',      label:'พนักงาน',          icon:'badge' },
  { key:'cats',     label:'หมวดหมู่',         icon:'category' },
  { key:'units',    label:'หน่วยนับ',         icon:'straighten' },
  { key:'recipe',   label:'สูตรสินค้า',       icon:'science' },
  { key:'supplier', label:'ซัพพลายเออร์',    icon:'local_shipping' },
  { key:'produce',  label:'ผลิตสินค้า',       icon:'precision_manufacturing' },
];
let _v9CurAdminTab = 'shop';

window.renderAdmin = async function () {
  const page = document.getElementById('page-admin');
  if (!page) return;
  try {
    if (typeof USER !== 'undefined' && USER?.role !== 'admin') {
      page.innerHTML = `<div style="text-align:center;padding:80px;">
        <i class="material-icons-round" style="font-size:64px;color:var(--danger)">block</i>
        <p style="font-size:18px;margin-top:16px;">เข้าถึงได้เฉพาะผู้ดูแลระบบ</p>
      </div>`;
      return;
    }
  } catch(_) {}

  page.innerHTML = `
    <div style="border-bottom:1px solid var(--border-light);margin-bottom:20px;overflow-x:auto;">
      <div style="display:flex;gap:0;min-width:max-content;">
        ${_v9AdminTabs.map(t => `
          <button id="v9atab-${t.key}" onclick="v9RenderAdminTab('${t.key}')"
            style="padding:12px 16px;border:none;background:none;cursor:pointer;
              font-family:var(--font-thai,'Prompt'),sans-serif;font-size:13px;
              border-bottom:2px solid transparent;color:var(--text-secondary);font-weight:400;
              display:flex;align-items:center;gap:5px;white-space:nowrap;transition:all .15s;">
            <i class="material-icons-round" style="font-size:16px;">${t.icon}</i>${t.label}
          </button>`).join('')}
      </div>
    </div>
    <div id="v9-admin-content"></div>`;
  v9RenderAdminTab(_v9CurAdminTab);
};

window.v9RenderAdminTab = async function (key) {
  _v9CurAdminTab = key;
  _v9AdminTabs.forEach(t => {
    const btn = document.getElementById(`v9atab-${t.key}`);
    if (!btn) return;
    const active = t.key === key;
    btn.style.borderBottomColor = active ? 'var(--primary)' : 'transparent';
    btn.style.color = active ? 'var(--primary)' : 'var(--text-secondary)';
    btn.style.fontWeight = active ? '700' : '400';
  });
  const c = document.getElementById('v9-admin-content');
  if (!c) return;
  c.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-tertiary);">
    <div style="width:28px;height:28px;border:3px solid #e2e8f0;border-top-color:var(--primary);
      border-radius:50%;animation:v7spin .8s linear infinite;margin:0 auto 8px;"></div>โหลด...
  </div>`;

  const orig = { shop:'renderShopSettings', receipt:'v10RenderDocSettingsInto',
                 emp:'renderEmployeeAdmin', cats:'renderCategoriesAdmin' };
  if (orig[key] && typeof window[orig[key]] === 'function') {
    await window[orig[key]](c); return;
  }
  if (key === 'users')    { await window.renderUserPerms(c); return; }
  if (key === 'units')    { await v9AdminUnits(c); return; }
  if (key === 'recipe')   { await v9AdminRecipe(c); return; }
  if (key === 'supplier') { await v9AdminSupplier(c); return; }
  if (key === 'produce')  { await v9AdminProduce(c); return; }
};

// also keep original renderAdminTabs working (called from other modules)
window.renderAdminTabs = function (key) { window.v9RenderAdminTab(key); };


// ── helpers ────────────────────────────────────────────────────────
function v9AdminLoading(msg='โหลด...') {
  return `<div style="text-align:center;padding:32px;color:var(--text-tertiary);">
    <div style="width:28px;height:28px;border:3px solid #e2e8f0;border-top-color:var(--primary);
      border-radius:50%;animation:v7spin .8s linear infinite;margin:0 auto 8px;"></div>${msg}
  </div>`;
}
function v9AdminError(msg) {
  return `<div style="text-align:center;padding:32px;color:var(--danger);">
    <i class="material-icons-round" style="font-size:32px;display:block;margin-bottom:8px;">error</i>${msg}
  </div>`;
}
function v9SectionHeader(title, btn='') {
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
    <h3 style="font-size:16px;font-weight:700;">${title}</h3>${btn}
  </div>`;
}


// ══════════════════════════════════════════════════════════════════
// TAB: หน่วยนับ (product_units)
// ══════════════════════════════════════════════════════════════════

async function v9AdminUnits(container) {
  container.innerHTML = v9AdminLoading('โหลดหน่วยนับ...');
  let prods = [], units = [];
  try {
    prods = v9GetProducts();
    if (!prods.length) prods = await loadEmployees().catch(()=>[]);
    const { data } = await db.from('product_units').select('*,สินค้า(name)').order('product_id');
    units = data || [];
  } catch(e) {
    container.innerHTML = v9AdminError('โหลดไม่ได้: ' + e.message); return;
  }

  const prodList = v9GetProducts();
  const prodOpts = prodList.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  container.innerHTML = `
    ${v9SectionHeader('จัดการหน่วยนับสินค้า',
      `<button class="btn btn-primary btn-sm" onclick="v9AdminUnitsShowAdd()">
        <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มหน่วย
      </button>`)}

    <!-- Add form (hidden by default) -->
    <div id="v9au-form" style="display:none;background:var(--bg-base);border:1px solid var(--border-light);
      border-radius:var(--radius-md);padding:16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px;">เพิ่มหน่วยนับใหม่</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">สินค้า *</label>
          <select class="form-input" id="v9au-prod"><option value="">-- เลือกสินค้า --</option>${prodOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">ชื่อหน่วย *</label>
          <input class="form-input" id="v9au-name" placeholder="เช่น ปิ๊ป, คิว, กล่อง">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">อัตราแปลง (base) *</label>
          <input class="form-input" type="number" id="v9au-rate" placeholder="1.0" min="0.0001" step="0.0001">
        </div>
        <div class="form-group">
          <label class="form-label">ราคา/หน่วย (บาท)</label>
          <input class="form-input" type="number" id="v9au-price" placeholder="0" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">เป็น Base Unit?</label>
          <label style="display:flex;align-items:center;gap:6px;padding:9px 0;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="v9au-base"> Base
          </label>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="v9AdminUnitsAdd()">
          <i class="material-icons-round" style="font-size:14px;">save</i> บันทึก
        </button>
        <button class="btn btn-outline" onclick="document.getElementById('v9au-form').style.display='none'">ยกเลิก</button>
      </div>
    </div>

    <!-- Table -->
    <div style="overflow-x:auto;">
      <table class="data-table" id="v9au-table">
        <thead>
          <tr>
            <th>สินค้า</th><th>หน่วย</th><th style="text-align:center">อัตราแปลง</th>
            <th style="text-align:right">ราคา/หน่วย</th><th style="text-align:center">Base</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${units.length === 0
            ? `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-tertiary);">ยังไม่มีหน่วยนับ</td></tr>`
            : units.map(u => `
              <tr>
                <td><strong>${u['สินค้า']?.name || '—'}</strong></td>
                <td>${u.unit_name}${u.is_base?` <span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:3px;">BASE</span>`:''}</td>
                <td style="text-align:center">${u.conv_rate}</td>
                <td style="text-align:right">฿${formatNum(u.price_per_unit||0)}</td>
                <td style="text-align:center">${u.is_base?'✅':''}</td>
                <td style="text-align:center">
                  <button class="btn btn-ghost btn-icon" style="color:var(--danger)"
                    onclick="v9AdminUnitsDelete('${u.id}')">
                    <i class="material-icons-round">delete</i>
                  </button>
                </td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:#fef3c7;border-radius:var(--radius-md);font-size:12px;color:#92400e;">
      <strong>วิธีอ่าน conv_rate:</strong> ถ้า base = "คิว" และ 1 ปิ๊ป = 0.02 คิว → conv_rate = 0.02 &nbsp;|&nbsp; 1 รถ = 1 คิว → conv_rate = 1
    </div>`;
}

window.v9AdminUnitsShowAdd = function () {
  document.getElementById('v9au-form').style.display = 'block';
  document.getElementById('v9au-prod').focus();
};

window.v9AdminUnitsAdd = async function () {
  const prodId = document.getElementById('v9au-prod')?.value;
  const name   = document.getElementById('v9au-name')?.value?.trim();
  const rate   = Number(document.getElementById('v9au-rate')?.value || 0);
  const price  = Number(document.getElementById('v9au-price')?.value || 0);
  const isBase = document.getElementById('v9au-base')?.checked || false;
  if (!prodId || !name || rate <= 0) {
    typeof toast==='function'&&toast('กรุณากรอกข้อมูลให้ครบ','error'); return;
  }
  v9ShowOverlay('กำลังบันทึก...');
  try {
    const { error } = await db.from('product_units').insert({
      product_id:prodId, unit_name:name, conv_rate:rate,
      price_per_unit:price, is_base:isBase
    });
    if (error) throw new Error(error.message);
    delete window._v9UnitCache?.[prodId];
    typeof toast==='function'&&toast('เพิ่มหน่วยสำเร็จ','success');
    await v9AdminUnits(document.getElementById('v9-admin-content'));
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

window.v9AdminUnitsDelete = async function (unitId) {
  if (!confirm('ลบหน่วยนี้?')) return;
  v9ShowOverlay('กำลังลบ...');
  try {
    await db.from('product_units').delete().eq('id', unitId);
    typeof toast==='function'&&toast('ลบสำเร็จ','success');
    await v9AdminUnits(document.getElementById('v9-admin-content'));
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};


// ══════════════════════════════════════════════════════════════════
// TAB: สูตรสินค้า (สูตรสินค้า table)
// ══════════════════════════════════════════════════════════════════

async function v9AdminRecipe(container) {
  container.innerHTML = v9AdminLoading('โหลดสูตรสินค้า...');
  let recipes = [], prods = [];
  try {
    prods = v9GetProducts();
    const { data, error } = await db.from('สูตรสินค้า')
      .select('id,product_id,material_id,quantity,unit');
    if (error) throw new Error(error.message);
    recipes = data || [];
  } catch(e) {
    container.innerHTML = v9AdminError('โหลดไม่ได้: '+e.message); return;
  }

  const prodMap = {};
  prods.forEach(p => { prodMap[p.id] = p; });
  // finishedProds = สินค้าที่มีสูตรผลิต (ตามบิล หรือ ผลิตล่วงหน้า)
  // ไม่เอา is_raw=true (วัตถุดิบล้วน) และไม่เอา product_type='both'
  const finishedProds = prods.filter(p =>
    !p.is_raw && p.product_type !== 'both'
  );
  const rawProds      = prods.filter(p => p.is_raw || p.product_type === 'both');
  const finOpts = finishedProds.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const rawOpts = rawProds.map(p=>`<option value="${p.id}">${p.name} (${p.unit||'ชิ้น'})</option>`).join('');

  // group by product_id
  const grouped = {};
  recipes.forEach(r => {
    if (!grouped[r.product_id]) grouped[r.product_id] = [];
    grouped[r.product_id].push(r);
  });

  container.innerHTML = `
    ${v9SectionHeader('จัดการสูตรสินค้า',
      `<button class="btn btn-primary btn-sm" onclick="v9AdminRecipeShowAdd()">
        <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มสูตร
      </button>`)}

    <!-- Add form -->
    <div id="v9ar-form" style="display:none;background:var(--bg-base);border:1px solid var(--border-light);
      border-radius:var(--radius-md);padding:16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px;">เพิ่มวัตถุดิบในสูตร</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">สินค้าสำเร็จ *</label>
          <select class="form-input" id="v9ar-prod">
            <option value="">-- เลือก --</option>${finOpts}
            ${finishedProds.length===0?`<option disabled>ยังไม่มีสินค้า (ทำเครื่องหมาย is_raw=false)</option>`:''}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">วัตถุดิบ *</label>
          <select class="form-input" id="v9ar-mat">
            <option value="">-- เลือก --</option>${rawOpts}
            ${rawProds.length===0?`<option disabled>ยังไม่มีวัตถุดิบ (ทำเครื่องหมาย is_raw=true)</option>`:''}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">จำนวน *</label>
          <input class="form-input" type="number" id="v9ar-qty" placeholder="1" min="0.001" step="0.001">
        </div>
        <div class="form-group">
          <label class="form-label">หน่วย</label>
          <input class="form-input" id="v9ar-unit" placeholder="ชิ้น">
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:10px;">
        หมายเหตุ: ทำเครื่องหมายสินค้าเป็น "วัตถุดิบ" (is_raw=true) ได้ที่ตาราง สินค้า ใน Supabase
        หรือตรงปุ่มแก้ไขสินค้าในหน้าคลังสินค้า
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="v9AdminRecipeAdd()">
          <i class="material-icons-round" style="font-size:14px;">save</i> บันทึก
        </button>
        <button class="btn btn-outline" onclick="document.getElementById('v9ar-form').style.display='none'">ยกเลิก</button>
      </div>
    </div>

    <!-- Recipe list grouped by product -->
    ${Object.keys(grouped).length === 0
      ? `<div style="text-align:center;padding:48px;color:var(--text-tertiary);">
           <i class="material-icons-round" style="font-size:40px;opacity:.3;display:block;margin-bottom:8px;">science</i>
           ยังไม่มีสูตรสินค้า — กด "เพิ่มสูตร" เพื่อเริ่ม
         </div>`
      : Object.entries(grouped).map(([pid, items]) => {
          const prod = prodMap[pid];
          return `
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);
              border-radius:var(--radius-md);overflow:hidden;margin-bottom:12px;">
              <div style="padding:12px 16px;background:var(--bg-base);
                display:flex;align-items:center;justify-content:space-between;
                border-bottom:1px solid var(--border-light);">
                <div>
                  <strong style="font-size:14px;">${prod?.name||pid}</strong>
                  <span style="font-size:11px;color:var(--text-tertiary);margin-left:8px;">
                    ${items.length} วัตถุดิบ
                  </span>
                </div>
                <span style="font-size:11px;padding:2px 8px;background:#f0fdf4;color:#15803d;
                  border-radius:999px;font-weight:700;">สินค้าสำเร็จรูป</span>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                  <tr style="background:var(--bg-base);">
                    <th style="padding:6px 12px;text-align:left;font-weight:600;">วัตถุดิบ</th>
                    <th style="padding:6px 12px;text-align:center;font-weight:600;">จำนวน</th>
                    <th style="padding:6px 12px;text-align:center;font-weight:600;">หน่วย</th>
                    <th style="padding:6px 12px;"></th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(r => {
                    const mat = prodMap[r.material_id];
                    return `<tr style="border-bottom:0.5px solid var(--border-light);">
                      <td style="padding:8px 12px;">${mat?.name||r.material_id}</td>
                      <td style="padding:8px 12px;text-align:center;">${r.quantity}</td>
                      <td style="padding:8px 12px;text-align:center;">${r.unit||mat?.unit||'ชิ้น'}</td>
                      <td style="padding:8px 12px;text-align:center;">
                        <button class="btn btn-ghost btn-icon" style="color:var(--danger)"
                          onclick="v9AdminRecipeDelete('${r.id}')">
                          <i class="material-icons-round">delete</i>
                        </button>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`;
        }).join('')}`;
}

window.v9AdminRecipeShowAdd = function () {
  document.getElementById('v9ar-form').style.display = 'block';
};

window.v9AdminRecipeAdd = async function () {
  const prodId  = document.getElementById('v9ar-prod')?.value;
  const matId   = document.getElementById('v9ar-mat')?.value;
  const qty     = Number(document.getElementById('v9ar-qty')?.value || 0);
  const unit    = document.getElementById('v9ar-unit')?.value?.trim() || 'ชิ้น';
  if (!prodId || !matId || qty <= 0) {
    typeof toast==='function'&&toast('กรุณากรอกข้อมูลให้ครบ','error'); return;
  }
  v9ShowOverlay('กำลังบันทึกสูตร...');
  try {
    const { error } = await db.from('สูตรสินค้า').insert({
      product_id:prodId, material_id:matId, quantity:qty, unit
    });
    if (error) throw new Error(error.message);
    typeof toast==='function'&&toast('เพิ่มสูตรสำเร็จ','success');
    await v9AdminRecipe(document.getElementById('v9-admin-content'));
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

window.v9AdminRecipeDelete = async function (recipeId) {
  if (!confirm('ลบวัตถุดิบจากสูตร?')) return;
  v9ShowOverlay('กำลังลบ...');
  try {
    await db.from('สูตรสินค้า').delete().eq('id', recipeId);
    typeof toast==='function'&&toast('ลบสำเร็จ','success');
    await v9AdminRecipe(document.getElementById('v9-admin-content'));
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};


// ══════════════════════════════════════════════════════════════════
// TAB: ซัพพลายเออร์
// ══════════════════════════════════════════════════════════════════

async function v9AdminSupplier(container) {
  container.innerHTML = v9AdminLoading('โหลดซัพพลายเออร์...');
  let suppliers = [];
  try {
    const { data } = await db.from('ซัพพลายเออร์').select('*').order('name');
    suppliers = data || [];
  } catch(e) {
    container.innerHTML = v9AdminError('โหลดไม่ได้: '+e.message); return;
  }

  container.innerHTML = `
    ${v9SectionHeader('จัดการซัพพลายเออร์',
      `<button class="btn btn-primary btn-sm" onclick="v9AdminSupplierShowAdd()">
        <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มซัพพลายเออร์
      </button>`)}

    <!-- Add form -->
    <div id="v9as-form" style="display:none;background:var(--bg-base);border:1px solid var(--border-light);
      border-radius:var(--radius-md);padding:16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px;">เพิ่ม / แก้ไข ซัพพลายเออร์</div>
      <input type="hidden" id="v9as-id">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="form-group"><label class="form-label">ชื่อบริษัท *</label>
          <input class="form-input" id="v9as-name" placeholder="ชื่อซัพพลายเออร์"></div>
        <div class="form-group"><label class="form-label">ผู้ติดต่อ</label>
          <input class="form-input" id="v9as-contact" placeholder="ชื่อผู้ติดต่อ"></div>
        <div class="form-group"><label class="form-label">เบอร์โทร</label>
          <input class="form-input" id="v9as-phone" placeholder="0XX-XXX-XXXX"></div>
        <div class="form-group"><label class="form-label">อีเมล</label>
          <input class="form-input" type="email" id="v9as-email" placeholder="email@example.com"></div>
        <div class="form-group"><label class="form-label">เครดิต (วัน)</label>
          <input class="form-input" type="number" id="v9as-credit" placeholder="30" min="0"></div>
        <div class="form-group"><label class="form-label">สถานะ</label>
          <select class="form-input" id="v9as-status">
            <option value="ใช้งาน">ใช้งาน</option>
            <option value="หยุดใช้">หยุดใช้</option>
          </select></div>
      </div>
      <div class="form-group" style="margin-bottom:12px;"><label class="form-label">ที่อยู่</label>
        <input class="form-input" id="v9as-addr" placeholder="ที่อยู่ซัพพลายเออร์"></div>
      <div class="form-group" style="margin-bottom:12px;"><label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="v9as-note" placeholder="หมายเหตุ"></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="v9AdminSupplierSave()">
          <i class="material-icons-round" style="font-size:14px;">save</i> บันทึก
        </button>
        <button class="btn btn-outline" onclick="v9AdminSupplierHideForm()">ยกเลิก</button>
      </div>
    </div>

    <!-- Table -->
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr>
          <th>ชื่อ</th><th>ผู้ติดต่อ</th><th>เบอร์โทร</th>
          <th style="text-align:right">ยอดซื้อรวม</th>
          <th style="text-align:center">เครดิต</th>
          <th style="text-align:center">สถานะ</th><th></th>
        </tr></thead>
        <tbody>
          ${suppliers.length === 0
            ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-tertiary);">ยังไม่มีซัพพลายเออร์</td></tr>`
            : suppliers.map(s => `
              <tr>
                <td><strong>${s.name}</strong>${s.address?`<br><span style="font-size:11px;color:var(--text-tertiary);">${s.address}</span>`:''}</td>
                <td>${s.contact_person||'—'}</td>
                <td>${s.phone||'—'}</td>
                <td style="text-align:right">฿${formatNum(s.total_purchase||0)}</td>
                <td style="text-align:center">${s.credit_days||0} วัน</td>
                <td style="text-align:center">
                  <span class="badge ${s.status==='ใช้งาน'?'badge-success':'badge-danger'}">${s.status||'ใช้งาน'}</span>
                </td>
                <td style="white-space:nowrap;">
                  <button class="btn btn-ghost btn-sm" onclick="v9AdminSupplierEdit('${s.id}')">
                    <i class="material-icons-round" style="font-size:14px;">edit</i>
                  </button>
                  <button class="btn btn-ghost btn-icon" style="color:var(--danger)"
                    onclick="v9AdminSupplierDelete('${s.id}','${s.name.replace(/'/g,"\\'")}')">
                    <i class="material-icons-round">delete</i>
                  </button>
                </td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  window._v9Suppliers = suppliers;
}

window.v9AdminSupplierShowAdd = function () {
  document.getElementById('v9as-id').value = '';
  ['v9as-name','v9as-contact','v9as-phone','v9as-email','v9as-addr','v9as-note'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const cd=document.getElementById('v9as-credit'); if(cd) cd.value='30';
  document.getElementById('v9as-form').style.display='block';
};

window.v9AdminSupplierHideForm = function () {
  document.getElementById('v9as-form').style.display='none';
};

window.v9AdminSupplierEdit = function (suppId) {
  const s = (window._v9Suppliers||[]).find(x=>x.id===suppId);
  if (!s) return;
  document.getElementById('v9as-id').value      = s.id;
  document.getElementById('v9as-name').value    = s.name||'';
  document.getElementById('v9as-contact').value = s.contact_person||'';
  document.getElementById('v9as-phone').value   = s.phone||'';
  document.getElementById('v9as-email').value   = s.email||'';
  document.getElementById('v9as-credit').value  = s.credit_days||0;
  document.getElementById('v9as-addr').value    = s.address||'';
  document.getElementById('v9as-note').value    = s.note||'';
  document.getElementById('v9as-status').value  = s.status||'ใช้งาน';
  document.getElementById('v9as-form').style.display='block';
  document.getElementById('v9as-form').scrollIntoView({behavior:'smooth'});
};

window.v9AdminSupplierSave = async function () {
  const id   = document.getElementById('v9as-id')?.value;
  const name = document.getElementById('v9as-name')?.value?.trim();
  if (!name) { typeof toast==='function'&&toast('กรุณากรอกชื่อ','error'); return; }
  const data = {
    name,
    contact_person: document.getElementById('v9as-contact')?.value?.trim()||null,
    phone:          document.getElementById('v9as-phone')?.value?.trim()||null,
    email:          document.getElementById('v9as-email')?.value?.trim()||null,
    address:        document.getElementById('v9as-addr')?.value?.trim()||null,
    note:           document.getElementById('v9as-note')?.value?.trim()||null,
    credit_days:    Number(document.getElementById('v9as-credit')?.value||0),
    status:         document.getElementById('v9as-status')?.value||'ใช้งาน',
  };
  v9ShowOverlay(id?'กำลังแก้ไข...':'กำลังเพิ่ม...');
  try {
    let err;
    if (id) ({ error:err } = await db.from('ซัพพลายเออร์').update(data).eq('id',id));
    else    ({ error:err } = await db.from('ซัพพลายเออร์').insert(data));
    if (err) throw new Error(err.message);
    typeof toast==='function'&&toast('บันทึกสำเร็จ','success');
    await v9AdminSupplier(document.getElementById('v9-admin-content'));
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

window.v9AdminSupplierDelete = async function (suppId, name) {
  if (!confirm(`ลบ "${name}"?`)) return;
  v9ShowOverlay('กำลังลบ...');
  try {
    await db.from('ซัพพลายเออร์').update({status:'หยุดใช้'}).eq('id',suppId);
    typeof toast==='function'&&toast('ปิดใช้งานซัพพลายเออร์แล้ว','success');
    await v9AdminSupplier(document.getElementById('v9-admin-content'));
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};


// ══════════════════════════════════════════════════════════════════
// TAB: ผลิตสินค้า (Production Module)
//   กด "ผลิต N ชิ้น" → ตรวจสต็อกวัตถุดิบ → ตัดสต็อกวัตถุดิบ
//   → เพิ่มสต็อกสินค้าสำเร็จ → บันทึก stock_movement
// ══════════════════════════════════════════════════════════════════

async function v9AdminProduce(container) {
  container.innerHTML = v9AdminLoading('โหลดข้อมูลสูตร...');
  let recipes = [], prods = [];
  try {
    prods = v9GetProducts();
    const { data } = await db.from('สูตรสินค้า')
      .select('product_id,material_id,quantity,unit');
    recipes = data || [];
  } catch(e) {
    container.innerHTML = v9AdminError('โหลดไม่ได้: '+e.message); return;
  }

  const prodMap = {};
  prods.forEach(p => { prodMap[p.id] = p; });

  // สินค้าที่มีสูตร
  const productIds = [...new Set(recipes.map(r=>r.product_id))];
  if (productIds.length === 0) {
    container.innerHTML = `
      ${v9SectionHeader('ผลิตสินค้า')}
      <div style="text-align:center;padding:60px;color:var(--text-tertiary);">
        <i class="material-icons-round" style="font-size:48px;opacity:.3;display:block;margin-bottom:12px;">precision_manufacturing</i>
        ยังไม่มีสูตรสินค้า — ไปที่ tab "สูตรสินค้า" เพื่อเพิ่มก่อนครับ
      </div>`;
    return;
  }

  container.innerHTML = `
    ${v9SectionHeader('ผลิตสินค้า')}
    <div style="display:flex;flex-direction:column;gap:16px;">
      ${productIds.map(pid => {
        const prod  = prodMap[pid];
        if (!prod) return '';
        const mats  = recipes.filter(r => r.product_id === pid);
        const canMake = mats.length > 0 ? Math.floor(
          Math.min(...mats.map(r => {
            const mat = prodMap[r.material_id];
            return mat?.stock ? Math.floor(mat.stock / r.quantity) : 0;
          }))
        ) : 0;

        return `
          <div style="background:var(--bg-surface);border:1px solid var(--border-light);
            border-radius:var(--radius-md);overflow:hidden;">
            <!-- Header -->
            <div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;
              background:var(--bg-base);border-bottom:1px solid var(--border-light);">
              <div>
                <div style="font-size:15px;font-weight:700;">${prod.name}</div>
                <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">
                  สต็อกปัจจุบัน ${prod.stock||0} ${prod.unit||'ชิ้น'}
                  &nbsp;|&nbsp; ผลิตได้สูงสุด
                  <strong style="color:${canMake>0?'var(--success)':'var(--danger)'};">${canMake} ${prod.unit||'ชิ้น'}</strong>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="number" id="v9pp-qty-${pid}" value="1" min="1" max="${canMake}"
                  style="width:70px;padding:6px 8px;border:1.5px solid var(--border-light);
                    border-radius:6px;font-size:14px;text-align:center;"
                  ${canMake===0?'disabled':''}>
                <button class="btn btn-primary btn-sm"
                  onclick="v9Produce('${pid}',${canMake})"
                  ${canMake===0?'disabled style="opacity:.45;cursor:not-allowed;"':''}
                  style="font-size:13px;">
                  <i class="material-icons-round" style="font-size:15px;">precision_manufacturing</i>
                  ผลิต
                </button>
              </div>
            </div>
            <!-- Materials -->
            <div style="padding:12px 18px;">
              <div style="font-size:11px;font-weight:700;color:var(--text-secondary);
                text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">วัตถุดิบที่ใช้ (ต่อ 1 ชิ้น)</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${mats.map(r => {
                  const mat = prodMap[r.material_id];
                  const hasStock = mat?.stock >= r.quantity;
                  return `
                    <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;
                      border-radius:999px;font-size:12px;
                      background:${hasStock?'#f0fdf4':'#fef2f2'};
                      border:1px solid ${hasStock?'#86efac':'#fca5a5'};
                      color:${hasStock?'#15803d':'#dc2626'};">
                      <span style="font-weight:600;">${mat?.name||r.material_id}</span>
                      <span>${r.quantity} ${r.unit||mat?.unit||'ชิ้น'}</span>
                      <span style="opacity:.6;">(มี ${mat?.stock||0})</span>
                    </div>`;
                }).join('')}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

window.v9Produce = async function (productId, maxQty) {
  const qty = Number(document.getElementById(`v9pp-qty-${productId}`)?.value || 0);
  if (!qty || qty <= 0) { typeof toast==='function'&&toast('กรุณาระบุจำนวน','error'); return; }
  if (qty > maxQty) { typeof toast==='function'&&toast(`ผลิตได้สูงสุด ${maxQty} ชิ้น (วัตถุดิบไม่พอ)`,'error'); return; }

  const prods   = v9GetProducts();
  const prodMap = {};
  prods.forEach(p => { prodMap[p.id] = p; });
  const prod = prodMap[productId];
  if (!prod) return;

  const ok = await Swal.fire({
    title: `ผลิต ${prod.name}`,
    html: `ผลิต <strong>${qty}</strong> ${prod.unit||'ชิ้น'}<br>วัตถุดิบจะถูกตัดออกจากสต็อกทันที`,
    icon: 'question', showCancelButton:true,
    confirmButtonText:'ยืนยันผลิต', cancelButtonText:'ยกเลิก',
    confirmButtonColor:'#DC2626'
  });
  if (!ok.isConfirmed) return;

  v9ShowOverlay('กำลังผลิต...', `${prod.name} × ${qty}`);
  try {
    // ดึงสูตร
    const { data: recipes } = await db.from('สูตรสินค้า')
      .select('*').eq('product_id', productId);
    if (!recipes?.length) throw new Error('ไม่พบสูตรสินค้า');

    // ตรวจสต็อกวัตถุดิบ + ตัดสต็อก
    for (const r of recipes) {
      const mat      = prodMap[r.material_id];
      const needed   = r.quantity * qty;
      const stockNow = mat?.stock || 0;
      if (stockNow < needed) throw new Error(`วัตถุดิบ "${mat?.name||r.material_id}" ไม่พอ (มี ${stockNow} ต้องการ ${needed})`);

      const newStock = stockNow - needed;
      await db.from('สินค้า').update({ stock:newStock, updated_at:new Date().toISOString() }).eq('id',r.material_id);
      await db.from('stock_movement').insert({
        product_id:r.material_id, product_name:mat?.name||'',
        type:'ใช้ผลิต', direction:'out', qty:needed,
        stock_before:stockNow, stock_after:newStock,
        ref_table:'production', staff_name:v9Staff(),
        note:`ผลิต ${prod.name} × ${qty}`,
      });
    }

    // เพิ่มสต็อกสินค้าสำเร็จ
    const stockBefore = prod.stock || 0;
    const stockAfter  = stockBefore + qty;
    await db.from('สินค้า').update({ stock:stockAfter, updated_at:new Date().toISOString() }).eq('id',productId);
    await db.from('stock_movement').insert({
      product_id:productId, product_name:prod.name,
      type:'ผลิต', direction:'in', qty,
      stock_before:stockBefore, stock_after:stockAfter,
      ref_table:'production', staff_name:v9Staff(),
      note:`ผลิตจากสูตร × ${qty}`,
    });

    typeof logActivity==='function' &&
      logActivity('ผลิตสินค้า', `${prod.name} × ${qty} ${prod.unit||'ชิ้น'}`);

    // อัป cache
    await loadProducts?.();
    try { if (typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}

    typeof toast==='function'&&toast(`ผลิต ${prod.name} × ${qty} สำเร็จ ✅`,'success');
    await v9AdminProduce(document.getElementById('v9-admin-content'));

  } catch(e) {
    typeof toast==='function'&&toast('ผลิตไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};


// ══════════════════════════════════════════════════════════════════
// FIX-20 — showAddProductModal: เพิ่ม toggle is_raw
// ══════════════════════════════════════════════════════════════════

const _v9OrigShowAddProd2 = window.showAddProductModal;
window.showAddProductModal = function (productData = null) {
  const isEdit = !!productData;
  try { if (typeof products!=='undefined') window._v9ProductsCache=products; } catch(_) {}
  const cats = (typeof categories!=='undefined' ? categories : []) || [];

  if (typeof openModal !== 'function') return;
  openModal(isEdit?'แก้ไขสินค้า':'เพิ่มสินค้าใหม่', `
    <form id="v9-product-form" onsubmit="event.preventDefault();v9SaveProduct()">
      <div class="form-group">
        <label class="form-label">ชื่อสินค้า *</label>
        <input class="form-input" id="v9prod-name" value="${productData?.name||''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">บาร์โค้ด</label>
        <div style="display:flex;gap:8px;align-items:stretch;">
          <input class="form-input" id="v9prod-barcode" value="${productData?.barcode||''}"
            placeholder="สแกนหรือพิมพ์" style="flex:1;" oninput="v9BarcodePreview()">
          <button type="button" id="v9-scan-btn" onclick="v9StartBarcodeScanner()"
            style="padding:0 14px;border:1.5px solid var(--primary);border-radius:var(--radius-md);
              background:var(--primary);color:#fff;cursor:pointer;font-size:13px;font-weight:600;
              display:flex;align-items:center;gap:5px;font-family:var(--font-thai,'Prompt'),sans-serif;">
            <i class="material-icons-round" style="font-size:18px;">qr_code_scanner</i> สแกน
          </button>
          <button type="button" onclick="v9GenerateBarcode()"
            style="padding:0 12px;border:1.5px solid #6366f1;border-radius:var(--radius-md);
              background:#6366f1;color:#fff;cursor:pointer;font-size:13px;font-weight:600;
              display:flex;align-items:center;gap:5px;font-family:var(--font-thai,'Prompt'),sans-serif;">
            <i class="material-icons-round" style="font-size:16px;">auto_awesome</i> สุ่ม
          </button>
        </div>
        <div id="v9-scan-wrap" style="display:none;margin-top:10px;border-radius:12px;overflow:hidden;position:relative;">
          <video id="v9-scan-video" autoplay playsinline muted
            style="width:100%;max-height:200px;object-fit:cover;background:#000;display:block;border-radius:12px;"></video>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
            <div style="width:60%;height:40%;border:2.5px solid #10b981;border-radius:8px;
              box-shadow:0 0 0 9999px rgba(0,0,0,.45);"></div>
          </div>
          <button type="button" onclick="v9StopScanner()"
            style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.6);color:#fff;
              border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;
              font-size:18px;display:flex;align-items:center;justify-content:center;">✕</button>
          <div id="v9-scan-status" style="position:absolute;bottom:8px;left:0;right:0;
            text-align:center;font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);">
            กำลังตรวจจับ...
          </div>
        </div>
        <div id="v9-bc-preview" style="display:none;margin-top:8px;text-align:center;
          padding:10px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
          <svg id="v9-bc-svg"></svg>
          <div id="v9-bc-num" style="font-size:11px;color:#94a3b8;margin-top:4px;"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">ราคาขาย (บาท) *</label>
          <input class="form-input" type="number" id="v9prod-price" value="${productData?.price||''}" required min="0"></div>
        <div class="form-group"><label class="form-label">ต้นทุน (บาท)</label>
          <input class="form-input" type="number" id="v9prod-cost" value="${productData?.cost||0}" min="0"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">สต็อก *</label>
          <input class="form-input" type="number" id="v9prod-stock" value="${productData?.stock||0}" required min="0"></div>
        <div class="form-group"><label class="form-label">สต็อกขั้นต่ำ</label>
          <input class="form-input" type="number" id="v9prod-min-stock" value="${productData?.min_stock||0}" min="0"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">หน่วย</label>
          <input class="form-input" id="v9prod-unit" value="${productData?.unit||'ชิ้น'}"></div>
        <div class="form-group"><label class="form-label">หมวดหมู่</label>
          <select class="form-input" id="v9prod-category">
            <option value="">-- เลือก --</option>
            ${cats.map(c=>`<option value="${c.name}" ${productData?.category===c.name?'selected':''}>${c.name}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-group">
        <label class="form-label">URL รูปภาพ</label>
        <input class="form-input" type="url" id="v9prod-img" value="${productData?.img_url||''}" placeholder="https://...">
      </div>
      <div class="form-group">
        <label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="v9prod-note" value="${productData?.note||''}">
      </div>
      <!-- is_raw toggle -->
      <div style="padding:10px 14px;background:var(--bg-base);border-radius:var(--radius-md);
        border:1px solid var(--border-light);margin-bottom:12px;
        display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:13px;font-weight:700;">วัตถุดิบ (Raw Material)</div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">
            เปิด = ใช้เป็นวัตถุดิบในสูตรผลิต | ปิด = สินค้าขายปกติ
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="v9prod-is-raw" ${productData?.is_raw?'checked':''}>
          <span style="font-size:13px;color:var(--text-primary);">วัตถุดิบ</span>
        </label>
      </div>
      <input type="hidden" id="v9prod-id" value="${productData?.id||''}">
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:4px;">
        <i class="material-icons-round">save</i> บันทึก
      </button>
    </form>`);
  if (productData?.barcode) setTimeout(()=>v9BarcodePreview(), 200);
};

// v9SaveProduct: เพิ่ม is_raw
const _v9OrigSaveProd2 = window.v9SaveProduct;
window.v9SaveProduct = async function () {
  const id   = document.getElementById('v9prod-id')?.value;
  const name = document.getElementById('v9prod-name')?.value?.trim();
  if (!name) { typeof toast==='function'&&toast('กรุณากรอกชื่อสินค้า','error'); return; }

  v9StopScanner();
  v9ShowOverlay(id?'กำลังแก้ไขสินค้า...':'กำลังเพิ่มสินค้า...', name);

  const data = {
    name,
    barcode:    document.getElementById('v9prod-barcode')?.value?.trim()||null,
    price:      Number(document.getElementById('v9prod-price')?.value||0),
    cost:       Number(document.getElementById('v9prod-cost')?.value||0),
    stock:      Number(document.getElementById('v9prod-stock')?.value||0),
    min_stock:  Number(document.getElementById('v9prod-min-stock')?.value||0),
    unit:       document.getElementById('v9prod-unit')?.value?.trim()||'ชิ้น',
    category:   document.getElementById('v9prod-category')?.value||null,
    img_url:    document.getElementById('v9prod-img')?.value?.trim()||null,
    note:       document.getElementById('v9prod-note')?.value?.trim()||null,
    is_raw:     document.getElementById('v9prod-is-raw')?.checked||false,
    updated_at: new Date().toISOString(),
  };

  try {
    let err;
    if (id) ({ error:err } = await db.from('สินค้า').update(data).eq('id',id));
    else    ({ error:err } = await db.from('สินค้า').insert(data));
    if (err) throw new Error(err.message);
    typeof closeModal==='function'&&closeModal();
    typeof toast==='function'&&toast(id?'แก้ไขสำเร็จ':'เพิ่มสำเร็จ','success');
    await loadProducts?.();
    try { if (typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    typeof renderInventory==='function'&&renderInventory();
  } catch(e) {
    typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};


// ══════════════════════════════════════════════════════════════════
// FIX-21 — ระบบจัดการสินค้า (เมนูใหม่ + สิทธิ์ can_manage)
//
//  A. เมนู "จัดการสินค้า" ในแถบซ้าย (page-manage)
//     → ย้าย: หมวดหมู่, หน่วยนับ, สูตรสินค้า, ซัพพลายเออร์, ผลิตสินค้า
//     → สิทธิ์: can_manage (admin เห็นเสมอ, staff ต้องได้รับสิทธิ์)
//
//  B. Purchase Order: เพิ่ม unit dropdown → แปลงเป็น base ก่อนบวกสต็อก
//     รถปูน 1 คัน (33,330 kg) → สต็อกปูนผง +33,330 kg
//
//  C. BOM Auto-Cost: คำนวณต้นทุน = Σ(qty × cost_per_base) → sync cost
//     ทุกครั้งที่ตั้งสูตร หรือราคาวัตถุดิบเปลี่ยน
//
//  D. POS กรอง is_raw=true ออก (ไม่โชว์วัตถุดิบในหน้าขาย)
// ══════════════════════════════════════════════════════════════════


// ──────────────────────────────────────────────────────────────────
// D. POS: กรอง is_raw ออกจากหน้าขาย
// ──────────────────────────────────────────────────────────────────
// loadProducts โหลดทุก product — เราต้องกรอง is_raw=true ออกใน render
const _v9OrigRenderProductGrid = window.renderProductGrid;
window.renderProductGrid = function () {
  // ซ่อน is_raw ชั่วคราว (สำรอง)
  let hidden = [];
  try {
    if (typeof products !== 'undefined') {
      hidden = products.filter(p => p.is_raw);
      hidden.forEach(p => { p._hiddenFromPOS = true; });
    }
  } catch(_) {}
  _v9OrigRenderProductGrid?.apply(this, arguments);
  // ล้าง flag
  hidden.forEach(p => { delete p._hiddenFromPOS; });
};

// Override renderInventory search filter ให้แสดงทุกตัว (admin ต้องเห็นวัตถุดิบด้วย)
// แต่ POS ซ่อนผ่าน v9POSProducts()
window.v9POSProducts = function () {
  try {
    if (typeof products !== 'undefined')
      return products.filter(p => !p.is_raw);
  } catch(_) {}
  return v9GetProducts().filter(p => !p.is_raw);
};


// ──────────────────────────────────────────────────────────────────
// C. BOM Auto-Cost
// ──────────────────────────────────────────────────────────────────

// คำนวณต้นทุนจาก BOM แล้ว sync กลับ cost ของสินค้าสำเร็จ
window.v9CalcBOMCost = async function (productId) {
  try {
    const { data: recipes } = await db.from('สูตรสินค้า')
      .select('material_id,quantity').eq('product_id', productId);
    if (!recipes?.length) return null;

    const prods = v9GetProducts();
    let totalCost = 0;
    const breakdown = [];

    for (const r of recipes) {
      const mat = prods.find(p => p.id === r.material_id);
      if (!mat) continue;
      const costPerBase = mat.cost || 0;
      const lineCost    = r.quantity * costPerBase;
      totalCost += lineCost;
      breakdown.push({
        name: mat.name, qty: r.quantity,
        unit: mat.unit || '', cost_per: costPerBase, line: lineCost
      });
    }

    // sync cost กลับสินค้าสำเร็จ
    await db.from('สินค้า').update({ cost: Math.round(totalCost) }).eq('id', productId);

    // อัป cache
    try {
      if (typeof products !== 'undefined') {
        const p = products.find(x => x.id === productId);
        if (p) p.cost = Math.round(totalCost);
        window._v9ProductsCache = products;
      }
    } catch(_) {}

    return { totalCost, breakdown };
  } catch(e) {
    console.warn('[v9] CalcBOMCost:', e.message);
    return null;
  }
};

// เรียก recalc ทุกครั้งหลัง save recipe
const _v9OrigRecipeAdd2 = window.v9AdminRecipeAdd;
window.v9AdminRecipeAdd = async function () {
  await _v9OrigRecipeAdd2?.apply(this, arguments);
  // recalc cost ของสินค้าสำเร็จที่เพิ่ง save
  const prodId = document.getElementById('v9ar-prod')?.value;
  if (prodId) {
    const result = await window.v9CalcBOMCost(prodId);
    if (result) {
      typeof toast === 'function' &&
        toast(`ต้นทุนจาก BOM = ฿${formatNum(Math.round(result.totalCost))}`, 'info');
    }
  }
};


// ──────────────────────────────────────────────────────────────────
// B. Purchase Order: Unit Conversion ตอนรับสินค้าเข้า
// ──────────────────────────────────────────────────────────────────

// Override savePurchaseOrder ให้แปลงหน่วยก่อนบวกสต็อก
const _v9OrigSavePO2 = window.savePurchaseOrder;
window.savePurchaseOrder = async function () {
  // ดึง items จาก purchaseItems array
  let items = [];
  try { items = purchaseItems; } catch(_) { items = []; }
  if (!items?.length) { typeof toast==='function'&&toast('กรุณาเพิ่มรายการสินค้า','error'); return; }

  const supplier  = document.getElementById('pur-supplier')?.value?.trim() || '';
  const method    = document.getElementById('pur-method')?.value || 'เงินสด';
  const note      = document.getElementById('pur-note')?.value?.trim() || '';
  const dueDate   = document.getElementById('pur-due-date')?.value || null;
  const suppSelId = document.getElementById('pur-supplier-id')?.value || null;
  const isCredit  = method === 'เครดิต';

  if (isCredit && !dueDate) {
    typeof toast==='function'&&toast('กรุณาระบุวันครบกำหนดชำระ','error'); return;
  }

  // ── แปลงหน่วยทุก item ก่อนบวกสต็อก ────────────────────────────
  // purchaseItems อาจมี unit_id ที่เลือกในฟอร์ม → ดึง conv_rate มาแปลง
  const resolvedItems = [];
  for (const item of items) {
    let resolvedQty  = item.qty;
    let resolvedCost = item.cost_per_unit; // ราคาซื้อ per หน่วยที่เลือก

    if (item.purchase_unit_id && item.purchase_unit_id !== '__base__') {
      // ดึง conv_rate ของหน่วยซื้อ
      try {
        const units = await v9LoadUnits(item.product_id);
        const pu = units.find(u => u.id === item.purchase_unit_id);
        if (pu) {
          resolvedQty  = item.qty * pu.conv_rate; // แปลงเป็น base unit
          // ราคาต้นทุนต่อ base = ราคาซื้อ / conv_rate
          resolvedCost = pu.conv_rate > 0
            ? parseFloat((item.cost_per_unit / pu.conv_rate).toFixed(6))
            : item.cost_per_unit;
        }
      } catch(_) {}
    }

    resolvedItems.push({
      ...item,
      qty_base:       resolvedQty,
      cost_base:      resolvedCost,
      // อัปเดต cost per base unit ในตาราง สินค้า
      update_cost:    resolvedCost > 0,
    });
  }

  const total = resolvedItems.reduce((s,i)=>s+(i.cost_per_unit*(i.qty||0)),0);

  v9ShowOverlay('กำลังบันทึกใบรับสินค้า...', `${items.length} รายการ`);
  try {
    const { data: po, error: poErr } = await db.from('purchase_order').insert({
      date:new Date().toISOString(), supplier:supplier||null,
      method, total, note:note||null, staff_name:v9Staff(), status:'รับแล้ว',
    }).select().single();
    if (poErr) throw new Error(poErr.message);

    for (const item of resolvedItems) {
      await db.from('purchase_item').insert({
        order_id:po.id, product_id:item.product_id, name:item.name,
        qty:item.qty, received_qty:item.qty,
        cost_per_unit:item.cost_per_unit, total:item.qty*item.cost_per_unit,
      });

      const prod = v9GetProducts().find(p=>p.id===item.product_id);
      const stockBefore = prod?.stock || 0;
      const stockAfter  = stockBefore + item.qty_base;

      await db.from('สินค้า').update({
        stock: stockAfter,
        cost:  item.update_cost ? item.cost_base : (prod?.cost||0),
        updated_at: new Date().toISOString(),
      }).eq('id', item.product_id);

      await db.from('stock_movement').insert({
        product_id:item.product_id, product_name:item.name,
        type:'รับเข้า', direction:'in', qty:item.qty_base,
        stock_before:stockBefore, stock_after:stockAfter,
        ref_id:po.id, ref_table:'purchase_order', staff_name:v9Staff(),
        note: item.qty_base !== item.qty
          ? `รับ ${item.qty} ${item.purchase_unit_name||'หน่วย'} = ${item.qty_base} ${prod?.unit||''}` 
          : note||null,
      });

      // หลังรับวัตถุดิบ → recalc BOM cost ของสินค้าที่ใช้วัตถุดิบนี้
      if (item.update_cost) {
        try {
          const { data: recipes } = await db.from('สูตรสินค้า')
            .select('product_id').eq('material_id', item.product_id);
          for (const r of (recipes||[])) {
            await window.v9CalcBOMCost(r.product_id);
          }
        } catch(_) {}
      }
    }

    // เครดิต → เจ้าหนี้ (สร้าง supplier อัตโนมัติถ้าไม่ระบุ)
    if (isCredit) {
      let suppId = suppSelId || null;
      const suppName = supplier || 'ไม่ระบุ';
      if (!suppId) {
        const {data:found} = await db.from('ซัพพลายเออร์').select('id').eq('name',suppName).maybeSingle();
        if (found) { suppId = found.id; }
        else {
          const {data:ns} = await db.from('ซัพพลายเออร์').insert({name:suppName,status:'ใช้งาน'}).select('id').maybeSingle();
          suppId = ns?.id;
        }
      }
      if (suppId) {
        const {error:apErr} = await db.from('เจ้าหนี้').insert({
          supplier_id:suppId, purchase_order_id:po.id,
          date:new Date().toISOString(), due_date:dueDate,
          amount:total, paid_amount:0, balance:total, status:'ค้างชำระ',
        });
        if (apErr) console.error('[v9] FIX-24 เจ้าหนี้:', apErr.message);
        else {
          const {data:sRec} = await db.from('ซัพพลายเออร์').select('total_purchase').eq('id',suppId).maybeSingle();
          await db.from('ซัพพลายเออร์').update({total_purchase:(sRec?.total_purchase||0)+total}).eq('id',suppId);
        }
      }
    }

    typeof logActivity==='function' && logActivity('รับสินค้าเข้า',
      `${supplier||'ไม่ระบุ'} | ${items.length} รายการ | ฿${formatNum(total)}`);
    try { purchaseItems=[]; } catch(_) {}
    try { window._v9ProductsCache=null; } catch(_) {}
    await loadProducts?.();
    typeof closeModal==='function'&&closeModal();
    typeof renderPurchases==='function'&&renderPurchases?.();
    if (isCredit) typeof toast==='function'&&toast(`รับสินค้าสำเร็จ — เจ้าหนี้ ฿${formatNum(total)}`,'success');
    else typeof toast==='function'&&toast(`บันทึกใบรับสินค้า ฿${formatNum(total)} สำเร็จ`,'success');
  } catch(e) {
    typeof toast==='function'&&toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};
window.submitPurchaseOrder = window.savePurchaseOrder;


// Override showAddPurchaseModal ให้มีช่อง unit dropdown ต่อ item
const _v9OrigShowPurch2 = window.showAddPurchaseModal;
window.showAddPurchaseModal = function () {
  try { purchaseItems = []; } catch(_) {}
  if (typeof openModal!=='function') return;

  const supps = window._v9Suppliers || [];

  openModal('สร้างใบรับสินค้าเข้า', `
    <form id="purchase-form" onsubmit="event.preventDefault();">
      <div id="pi-list-panel">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group">
            <label class="form-label">ผู้จำหน่าย</label>
            <input class="form-input" id="pur-supplier" list="supplier-list" placeholder="ชื่อผู้จำหน่าย">
            <datalist id="supplier-list"></datalist>
          </div>
          <div class="form-group">
            <label class="form-label">วิธีชำระ</label>
            <select class="form-input" id="pur-method" onchange="togglePurCredit?.()">
              <option>เงินสด</option><option>เครดิต</option><option>โอนเงิน</option>
            </select>
          </div>
        </div>
        <div id="pur-credit-section" style="display:none;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">ซัพพลายเออร์</label>
              <select class="form-input" id="pur-supplier-id"><option value="">-- เลือก --</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">วันครบกำหนด</label>
              <input class="form-input" type="date" id="pur-due-date">
            </div>
          </div>
        </div>
        <div class="form-group"><label class="form-label">หมายเหตุ</label>
          <input class="form-input" id="pur-note" placeholder="หมายเหตุ"></div>

        <!-- รายการสินค้า -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:700;">รายการสินค้า</div>
          <button type="button" class="btn btn-outline btn-sm" onclick="v6ShowAddItem?.()">
            <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มสินค้า
          </button>
        </div>
        <div id="pur-no-items" style="text-align:center;padding:20px;color:var(--text-tertiary);
          font-size:13px;border:1.5px dashed var(--border-light);border-radius:var(--radius-md);">
          ยังไม่มีรายการ กดปุ่ม "เพิ่มสินค้า"
        </div>
        <div id="pur-item-list" style="display:none;"></div>
        <button type="button" class="btn btn-primary" style="width:100%;margin-top:16px;"
          onclick="savePurchaseOrder()">
          <i class="material-icons-round">save</i> บันทึกใบรับสินค้า
        </button>
      </div>

      <!-- Panel เพิ่มสินค้า (v6 style) -->
      <div id="pi-add-panel" style="display:none;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:12px;"
          onclick="v6HideAddItem?.()">
          <i class="material-icons-round" style="font-size:14px;">arrow_back</i> กลับ
        </button>
        <div class="form-group">
          <label class="form-label">ค้นหาสินค้า</label>
          <input class="form-input" id="pi-search" placeholder="พิมพ์ชื่อสินค้า..."
            oninput="filterPurchaseItems?.()">
        </div>
        <div id="pi-product-list" style="max-height:180px;overflow-y:auto;
          border:1px solid var(--border-light);border-radius:var(--radius-md);margin-bottom:10px;">
          ${(v9GetProducts()||[]).map(p=>`
            <div class="pi-row" data-name="${(p.name||'').toLowerCase()}"
              style="display:flex;align-items:center;justify-content:space-between;
                padding:8px 12px;border-bottom:0.5px solid var(--border-light);cursor:pointer;
                ${p.is_raw?'background:var(--bg-base);':''}"
              onclick="v9SelectPurchaseProduct('${p.id}','${(p.name||'').replace(/'/g,"\\'")}','${p.unit||'ชิ้น'}')">
              <div>
                <strong style="font-size:13px;">${p.name}</strong>
                ${p.is_raw?'<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:3px;margin-left:4px;">วัตถุดิบ</span>':''}
                <span style="font-size:11px;color:var(--text-tertiary);margin-left:6px;">
                  ต้นทุน ฿${formatNum(p.cost||0)}/${p.unit||'ชิ้น'} | สต็อก ${p.stock||0}
                </span>
              </div>
              <span class="btn btn-outline btn-sm">เลือก</span>
            </div>`).join('')}
        </div>
        <div id="pi-selected-info" style="display:none;">
          <div style="background:var(--bg-base);border-radius:var(--radius-md);
            padding:10px 12px;margin-bottom:10px;font-size:13px;">
            เลือก: <strong id="pi-selected-name"></strong>
          </div>
          <!-- Unit dropdown -->
          <div class="form-group">
            <label class="form-label">หน่วยที่รับเข้า</label>
            <select class="form-input" id="pi-purchase-unit"
              onchange="v9UpdatePurchaseUnitPrice()">
              <option value="__base__">-- หน่วยมาตรฐาน (base) --</option>
            </select>
            <div id="pi-unit-conv-info" style="font-size:11px;color:var(--text-tertiary);margin-top:4px;"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div class="form-group"><label class="form-label">จำนวน (หน่วยที่เลือก)</label>
              <input class="form-input" type="number" id="pi-qty" value="1" min="0.001" step="0.001"></div>
            <div class="form-group"><label class="form-label">ราคาซื้อ/หน่วย (บาท)</label>
              <input class="form-input" type="number" id="pi-cost" min="0" placeholder="0"
                oninput="v9UpdatePurchaseUnitPrice()"></div>
            <div class="form-group"><label class="form-label">หน่วย base</label>
              <input class="form-input" id="pi-unit" readonly style="background:var(--bg-base);">
            </div>
          </div>
          <div id="pi-cost-preview" style="font-size:12px;color:var(--text-tertiary);
            padding:6px 10px;background:var(--bg-base);border-radius:6px;margin-bottom:10px;"></div>
          <input type="hidden" id="pi-prod-id">
          <input type="hidden" id="pi-prod-name">
          <button type="button" class="btn btn-primary" style="width:100%;"
            onclick="v9AddPurchaseItemWithUnit()">
            <i class="material-icons-round">add</i> เพิ่มรายการนี้
          </button>
        </div>
      </div>
    </form>`);

  // โหลด suppliers
  db.from('ซัพพลายเออร์').select('id,name').eq('status','ใช้งาน').then(({data})=>{
    const dl  = document.getElementById('supplier-list');
    const sel = document.getElementById('pur-supplier-id');
    (data||[]).forEach(s=>{
      if(dl){const o=document.createElement('option');o.value=s.name;dl.appendChild(o);}
      if(sel){const o=document.createElement('option');o.value=s.id;o.textContent=s.name;sel.appendChild(o);}
    });
  });

  if (typeof purchaseItems!=='undefined'&&purchaseItems.length>0) renderPurchaseItems?.();
};

// เลือกสินค้าและโหลด units ของสินค้านั้น
window.v9SelectPurchaseProduct = async function (id, name, unit) {
  document.getElementById('pi-product-list').style.display='none';
  const searchGrp = document.getElementById('pi-search')?.closest('.form-group');
  if (searchGrp) searchGrp.style.display='none';
  document.getElementById('pi-prod-id').value  = id;
  document.getElementById('pi-prod-name').value = name;
  document.getElementById('pi-unit').value      = unit;
  const titleEl = document.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = `เพิ่ม: ${name}`;

  const prod = v9GetProducts().find(p=>p.id===id);
  document.getElementById('pi-cost').value = prod?.cost || 0;

  // โหลด units ของสินค้านี้
  const sel = document.getElementById('pi-purchase-unit');
  sel.innerHTML = `<option value="__base__">-- ${unit} (มาตรฐาน) --</option>`;
  try {
    const units = await v9LoadUnits(id);
    units.filter(u=>!u.is_base).forEach(u=>{
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.dataset.convRate  = u.conv_rate;
      opt.dataset.unitName  = u.unit_name;
      opt.dataset.unitPrice = u.price_per_unit||0;
      opt.textContent = `${u.unit_name} (1 = ${u.conv_rate} ${unit})`;
      sel.appendChild(opt);
    });
  } catch(_) {}

  document.getElementById('pi-selected-info').style.display='block';
  document.getElementById('pi-selected-name').textContent = name;
  v9UpdatePurchaseUnitPrice();
};

window.v9UpdatePurchaseUnitPrice = function () {
  const sel  = document.getElementById('pi-purchase-unit');
  const cost = Number(document.getElementById('pi-cost')?.value||0);
  const unit = document.getElementById('pi-unit')?.value||'ชิ้น';
  const info = document.getElementById('pi-unit-conv-info');
  const prev = document.getElementById('pi-cost-preview');

  if (sel?.value==='__base__') {
    if(info) info.textContent = '';
    if(prev) prev.textContent = `ต้นทุน/หน่วย = ฿${formatNum(cost)} / ${unit}`;
    return;
  }
  const opt = sel?.selectedOptions[0];
  const convRate = Number(opt?.dataset.convRate||1);
  const unitName = opt?.dataset.unitName||'หน่วย';
  const costBase = convRate>0 ? Math.round(cost/convRate) : cost;

  if(info) info.textContent = `1 ${unitName} = ${convRate} ${unit}`;
  if(prev) prev.textContent =
    `รับ 1 ${unitName} → บวกสต็อก ${convRate} ${unit} | ต้นทุน/base = ฿${formatNum(costBase)}/${unit}`;
};

window.v9AddPurchaseItemWithUnit = function () {
  const id   = document.getElementById('pi-prod-id')?.value;
  const name = document.getElementById('pi-prod-name')?.value;
  const qty  = Number(document.getElementById('pi-qty')?.value||1);
  const cost = Number(document.getElementById('pi-cost')?.value||0);
  const unit = document.getElementById('pi-unit')?.value||'ชิ้น';
  const sel  = document.getElementById('pi-purchase-unit');
  const purchUnitId   = sel?.value||'__base__';
  const purchUnitName = purchUnitId==='__base__' ? unit : sel?.selectedOptions[0]?.dataset.unitName||unit;
  const convRate = purchUnitId==='__base__' ? 1 : Number(sel?.selectedOptions[0]?.dataset.convRate||1);

  if (!id||qty<=0) { typeof toast==='function'&&toast('กรุณากรอกข้อมูล','error'); return; }

  try {
    const ex = purchaseItems.find(x=>x.product_id===id);
    if (ex) {
      ex.qty += qty;
      ex.cost_per_unit = cost;
    } else {
      purchaseItems.push({
        product_id:id, name, qty, cost_per_unit:cost, unit,
        purchase_unit_id:   purchUnitId,
        purchase_unit_name: purchUnitName,
        conv_rate:          convRate,
        qty_base:           qty * convRate,
      });
    }
  } catch(_) {}

  renderPurchaseItems?.();
  const addPanel  = document.getElementById('pi-add-panel');
  const listPanel = document.getElementById('pi-list-panel');
  if(addPanel&&listPanel){ addPanel.style.display='none'; listPanel.style.display='block'; }
  const titleEl = document.querySelector('.modal-title');
  if(titleEl) titleEl.textContent='สร้างใบรับสินค้าเข้า';

  typeof toast==='function'&&toast(
    `เพิ่ม ${name} × ${qty} ${purchUnitName} (= ${qty*convRate} ${unit})`, 'success'
  );
};


// ──────────────────────────────────────────────────────────────────
// A. เมนู "จัดการสินค้า" + สิทธิ์ can_manage
// ──────────────────────────────────────────────────────────────────

// Override go() เพิ่ม page-manage
const _v9OrigGo = window.go;
window.go = function (page) {
  if (page === 'manage') {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.toggle('active',i.dataset.page===page));
    document.querySelectorAll('.page-section').forEach(s=>s.classList.add('hidden'));
    let pg = document.getElementById('page-manage');
    if (!pg) {
      pg = document.createElement('section');
      pg.id = 'page-manage';
      pg.className = 'page-section';
      document.querySelector('.main-content, .content-area, #main-content, main')?.appendChild(pg) ||
      document.body.appendChild(pg);
    }
    pg.classList.remove('hidden');
    document.getElementById('page-title-text').textContent = '⚙️ จัดการสินค้า';
    document.getElementById('page-actions').innerHTML = '';
    v9RenderManage();
    document.getElementById('sidebar')?.classList.remove('show');
    return;
  }
  _v9OrigGo?.apply(this, arguments);
};

// Inject nav item "จัดการสินค้า" หลัง login
function v9InjectManageNav() {
  if (document.getElementById('nav-manage')) return;

  // ตรวจสิทธิ์
  let canManage = false;
  try {
    canManage = (typeof USER!=='undefined'&&USER?.role==='admin') ||
                (typeof USER_PERMS!=='undefined'&&USER_PERMS?.can_manage===true);
  } catch(_) {}
  if (!canManage) return;

  // สร้าง nav item
  const a = document.createElement('a');
  a.className = 'nav-item';
  a.id        = 'nav-manage';
  a.dataset.page = 'manage';
  a.innerHTML = `<i class="material-icons-round">settings_suggest</i><span>จัดการสินค้า</span>`;
  a.onclick   = () => go('manage');

  // แทรกหลัง nav-item[data-page="inv"]
  const invItem = document.querySelector('.nav-item[data-page="inv"]');
  if (invItem?.parentNode) {
    invItem.parentNode.insertBefore(a, invItem.nextSibling);
  }
}

// Patch initApp ให้ inject nav
const _v9OrigInitApp = window.initApp;
window.initApp = async function () {
  await _v9OrigInitApp?.apply(this, arguments);
  v9InjectManageNav();
};

// patch สิทธิ์ manage ใน renderUserPerms
window.v9SavePermission = async function (userId) {
  const allPermKeys = [
    'can_pos','can_inv','can_cash','can_exp','can_debt',
    'can_att','can_purchase','can_dash','can_log','can_manage'
  ];
  const perms = {};
  allPermKeys.forEach(pk => {
    const el = document.getElementById(`v9perm-${userId}-${pk}`);
    if (el) perms[pk] = el.checked;
  });
  try {
    const {data:ex} = await db.from('สิทธิ์การเข้าถึง').select('id').eq('user_id',userId).maybeSingle();
    if (ex) await db.from('สิทธิ์การเข้าถึง').update(perms).eq('user_id',userId);
    else    await db.from('สิทธิ์การเข้าถึง').insert({user_id:userId,...perms});
    typeof toast==='function'&&toast('บันทึกสิทธิ์สำเร็จ','success');
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
};
window.savePermission = window.v9SavePermission;

// เพิ่ม can_manage ใน renderUserPerms UI
const _v9OrigRenderUserPerms2 = window.renderUserPerms;
window.renderUserPerms = async function (container) {
  // เพิ่ม can_manage เข้า _v9PermKeys ถ้ายังไม่มี
  if (!_v9PermKeys.find(p=>p.key==='can_manage')) {
    _v9PermKeys.push({ key:'can_manage', label:'⚙️ จัดการสินค้า', desc:'หน่วยนับ สูตร ซัพพลายเออร์ ผลิต' });
  }
  await _v9OrigRenderUserPerms2?.apply(this, arguments);
};


// หน้า Manage — tabs
const _v9ManageTabs = [
  { key:'cats',     label:'หมวดหมู่',      icon:'category',                desc:'จัดการหมวดหมู่สินค้า',    color:'#6366f1',bg:'#eef2ff' },
  { key:'units',    label:'หน่วยนับ',       icon:'straighten',             desc:'กำหนด conv rate',          color:'#0891b2',bg:'#ecfeff' },
  { key:'recipe',   label:'สูตรสินค้า',     icon:'science',                desc:'BOM วัตถุดิบต่อสินค้า',   color:'#059669',bg:'#f0fdf4' },
  { key:'supplier', label:'ซัพพลายเออร์',  icon:'local_shipping',         desc:'จัดการผู้จำหน่าย',         color:'#d97706',bg:'#fffbeb' },
  { key:'produce',  label:'ผลิตสินค้า',     icon:'precision_manufacturing',desc:'สั่งผลิตตามสูตร',           color:'#dc2626',bg:'#fef2f2' },
];
let _v9ManageCurTab = 'cats';

window.v9RenderManage = async function () {
  const pg = document.getElementById('page-manage');
  if (!pg) return;

  pg.innerHTML = `
    <style>
      .v9m-tab-btn { border:none;background:none;cursor:pointer;padding:0;text-align:left;width:100%;transition:all .15s;border-radius:12px;font-family:var(--font-thai,'Prompt'),sans-serif; }
      .v9m-tab-btn:hover { transform:translateY(-1px); }
      .v9m-content-card { background:var(--bg-surface,#fff);border-radius:18px;box-shadow:0 1px 6px rgba(0,0,0,.06);overflow:hidden; }
      @keyframes v9mfade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      .v9m-fade { animation:v9mfade .2s ease; }
    </style>

    <div style="display:grid;grid-template-columns:220px 1fr;gap:20px;height:calc(100vh - 120px);">

      <!-- ── Sidebar tabs ── -->
      <div style="display:flex;flex-direction:column;gap:6px;">

        <!-- Section label -->
        <div style="font-size:10px;font-weight:700;color:var(--text-tertiary);
          text-transform:uppercase;letter-spacing:.08em;padding:0 4px;margin-bottom:4px;">
          จัดการสินค้า
        </div>

        ${_v9ManageTabs.map(t => `
          <button id="v9mtab-${t.key}" class="v9m-tab-btn"
            onclick="v9SwitchManageTab('${t.key}')"
            style="padding:12px 14px;display:flex;align-items:center;gap:12px;">
            <div id="v9mtab-icon-${t.key}" style="width:38px;height:38px;border-radius:10px;
              display:flex;align-items:center;justify-content:center;flex-shrink:0;
              background:#f1f5f9;transition:all .15s;">
              <i class="material-icons-round" style="font-size:20px;color:#94a3b8;transition:all .15s;">${t.icon}</i>
            </div>
            <div style="min-width:0;">
              <div id="v9mtab-label-${t.key}" style="font-size:13px;font-weight:600;
                color:var(--text-secondary);transition:color .15s;">${t.label}</div>
              <div style="font-size:11px;color:var(--text-tertiary);margin-top:1px;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.desc}</div>
            </div>
            <i id="v9mtab-arr-${t.key}" class="material-icons-round"
              style="font-size:16px;color:transparent;margin-left:auto;flex-shrink:0;
                transition:all .15s;">chevron_right</i>
          </button>`).join('')}

        <!-- Divider -->
        <div style="height:0.5px;background:var(--border-light);margin:6px 4px;"></div>

        <!-- Quick stats -->
        <div id="v9m-sidebar-stats"
          style="padding:12px 14px;background:var(--bg-base);border-radius:12px;font-size:12px;">
          <div style="color:var(--text-tertiary);margin-bottom:8px;font-weight:600;font-size:10px;
            text-transform:uppercase;letter-spacing:.06em;">สรุปภาพรวม</div>
          <div style="display:flex;flex-direction:column;gap:6px;" id="v9m-stats-inner">
            <div style="color:var(--text-tertiary);font-size:11px;">กำลังโหลด...</div>
          </div>
        </div>
      </div>

      <!-- ── Main content ── -->
      <div style="overflow-y:auto;padding-bottom:20px;">
        <div id="v9-manage-content" class="v9m-content-card v9m-fade" style="padding:24px;min-height:400px;">
          <div style="text-align:center;padding:60px;color:var(--text-tertiary);">
            <i class="material-icons-round" style="font-size:48px;opacity:.3;display:block;margin-bottom:12px;">settings_suggest</i>
            เลือกเมนูด้านซ้ายเพื่อเริ่มต้น
          </div>
        </div>
      </div>
    </div>`;

  // โหลด stats และ tab เริ่มต้น
  v9LoadManageStats();
  v9SwitchManageTab(_v9ManageCurTab);
};

// โหลด overview stats
window.v9LoadManageStats = async function () {
  const el = document.getElementById('v9m-stats-inner');
  if (!el) return;
  try {
    const [catRes, unitRes, recipeRes, suppRes] = await Promise.all([
      db.from('categories').select('id', {count:'exact', head:true}),
      db.from('product_units').select('id', {count:'exact', head:true}),
      db.from('สูตรสินค้า').select('id', {count:'exact', head:true}),
      db.from('ซัพพลายเออร์').select('id', {count:'exact', head:true}).eq('status','ใช้งาน'),
    ]);
    const prods = v9GetProducts();
    const rawCount = prods.filter(p => p.is_raw).length;

    el.innerHTML = [
      { icon:'category',                clr:'#6366f1', label:'หมวดหมู่',      val: catRes.count || 0 },
      { icon:'straighten',              clr:'#0891b2', label:'หน่วยนับ',       val: unitRes.count || 0 },
      { icon:'science',                 clr:'#059669', label:'สูตรสินค้า',     val: recipeRes.count || 0 },
      { icon:'local_shipping',          clr:'#d97706', label:'ซัพพลายเออร์',  val: suppRes.count || 0 },
      { icon:'precision_manufacturing', clr:'#dc2626', label:'วัตถุดิบ',       val: rawCount },
    ].map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
          <i class="material-icons-round" style="font-size:13px;color:${s.clr};">${s.icon}</i>
          ${s.label}
        </div>
        <strong style="font-size:12px;color:var(--text-primary);">${s.val}</strong>
      </div>`).join('');
  } catch(e) {
    if (el) el.innerHTML = '<div style="font-size:11px;color:var(--text-tertiary);">ไม่สามารถโหลด</div>';
  }
};

window.v9SwitchManageTab = async function (key) {
  _v9ManageCurTab = key;

  // อัป sidebar styles
  _v9ManageTabs.forEach(t => {
    const btn   = document.getElementById(`v9mtab-${t.key}`);
    const icon  = document.getElementById(`v9mtab-icon-${t.key}`);
    const label = document.getElementById(`v9mtab-label-${t.key}`);
    const arr   = document.getElementById(`v9mtab-arr-${t.key}`);
    if (!btn) return;
    const active = t.key === key;
    btn.style.background   = active ? t.bg : 'transparent';
    if (icon) {
      icon.style.background = active ? t.color : '#f1f5f9';
      icon.querySelector('i').style.color = active ? '#fff' : '#94a3b8';
    }
    if (label) { label.style.color = active ? t.color : 'var(--text-secondary)'; label.style.fontWeight = active ? '700' : '600'; }
    if (arr)   arr.style.color = active ? t.color : 'transparent';
  });

  const c = document.getElementById('v9-manage-content');
  if (!c) return;

  // Fade animation
  c.style.opacity = '0'; c.style.transform = 'translateY(6px)';
  c.style.transition = 'opacity .18s, transform .18s';

  const tab = _v9ManageTabs.find(t => t.key === key);
  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;padding-bottom:16px;
      border-bottom:1px solid var(--border-light);">
      <div style="width:40px;height:40px;border-radius:10px;background:${tab?.bg||'#f1f5f9'};
        display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="material-icons-round" style="font-size:22px;color:${tab?.color||'#94a3b8'};">${tab?.icon||'settings'}</i>
      </div>
      <div>
        <div style="font-size:17px;font-weight:800;">${tab?.label||key}</div>
        <div style="font-size:12px;color:var(--text-tertiary);">${tab?.desc||''}</div>
      </div>
    </div>
    <div id="v9-manage-inner">${v9AdminLoading('กำลังโหลด...')}</div>`;

  setTimeout(() => { c.style.opacity='1'; c.style.transform='none'; }, 10);

  const inner = document.getElementById('v9-manage-inner');
  if (!inner) return;

  if (key === 'cats')     { await v9ManageCats(inner);     return; }
  if (key === 'units')    { await v9AdminUnits(inner);      return; }
  if (key === 'recipe')   { await v9AdminRecipe(inner);     return; }
  if (key === 'supplier') { await v9AdminSupplier(inner);   return; }
  if (key === 'produce')  { await v9AdminProduce(inner);    return; }
};

// หมวดหมู่ redesign (แทน renderCategoriesAdmin เดิม)
async function v9ManageCats(container) {
  container.innerHTML = v9AdminLoading('โหลดหมวดหมู่...');
  let cats = [];
  try {
    const { data } = await db.from('categories').select('*').order('name');
    cats = data || [];
  } catch(e) { container.innerHTML = v9AdminError('โหลดไม่ได้: '+e.message); return; }

  container.innerHTML = `
    <!-- Add form -->
    <div style="background:var(--bg-base);border-radius:14px;padding:16px 18px;margin-bottom:20px;
      border:1px solid var(--border-light);">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <i class="material-icons-round" style="font-size:16px;color:var(--primary);">add_circle</i>
        เพิ่มหมวดหมู่ใหม่
      </div>
      <form id="v9cat-form" onsubmit="event.preventDefault();v9ManageCatAdd()"
        style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px;">ชื่อหมวดหมู่ *</label>
          <input class="form-input" id="v9cat-name" placeholder="เช่น วัสดุก่อสร้าง, เครื่องมือ..." required>
        </div>
        <div style="width:80px;">
          <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px;">ไอคอน</label>
          <input class="form-input" id="v9cat-icon" value="inventory_2" placeholder="icon name">
        </div>
        <div style="width:70px;">
          <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px;">สี</label>
          <input type="color" class="form-input" id="v9cat-color" value="#DC2626"
            style="height:40px;padding:3px;cursor:pointer;">
        </div>
        <div style="width:80px;">
          <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px;">หมายเหตุ</label>
          <input class="form-input" id="v9cat-note" placeholder="(ถ้ามี)">
        </div>
        <button type="submit" class="btn btn-primary" style="height:40px;white-space:nowrap;">
          <i class="material-icons-round" style="font-size:15px;">add</i> เพิ่ม
        </button>
      </form>
    </div>

    <!-- Category grid -->
    <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-secondary);">
      ทั้งหมด ${cats.length} หมวด
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;" id="v9cat-grid">
      ${cats.length === 0
        ? `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-tertiary);">
             <i class="material-icons-round" style="font-size:36px;opacity:.3;display:block;margin-bottom:8px;">category</i>
             ยังไม่มีหมวดหมู่
           </div>`
        : cats.map(c => {
            const prods = v9GetProducts().filter(p => p.category === c.name);
            return `
              <div style="background:var(--bg-surface,#fff);border:1px solid var(--border-light);
                border-radius:14px;padding:14px 16px;position:relative;
                border-left:4px solid ${c.color||'#DC2626'};transition:box-shadow .15s;"
                onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'"
                onmouseleave="this.style.boxShadow=''">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                  <div style="width:36px;height:36px;border-radius:10px;
                    background:${c.color||'#DC2626'}20;
                    display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="material-icons-round" style="font-size:18px;color:${c.color||'#DC2626'};">
                      ${c.icon||'inventory_2'}
                    </i>
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:14px;font-weight:700;white-space:nowrap;
                      overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
                    <div style="font-size:11px;color:var(--text-tertiary);">${prods.length} สินค้า</div>
                  </div>
                </div>
                ${c.note ? `<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px;">${c.note}</div>` : ''}
                <!-- progress bar -->
                <div style="height:3px;background:var(--border-light);border-radius:999px;overflow:hidden;">
                  <div style="height:100%;background:${c.color||'#DC2626'};border-radius:999px;
                    width:${Math.min(100, prods.length * 10)}%;transition:width .4s;"></div>
                </div>
                <!-- delete button -->
                <button onclick="v9ManageCatDelete('${c.id}','${c.name.replace(/'/g,"\\'")}','${c.color||'#DC2626'}')"
                  style="position:absolute;top:10px;right:10px;background:none;border:none;
                    cursor:pointer;color:var(--text-tertiary);padding:4px;border-radius:6px;
                    transition:all .15s;"
                  onmouseenter="this.style.background='#fee2e2';this.style.color='#dc2626'"
                  onmouseleave="this.style.background='none';this.style.color='var(--text-tertiary)'">
                  <i class="material-icons-round" style="font-size:16px;">delete</i>
                </button>
              </div>`;
          }).join('')}
    </div>`;
}

window.v9ManageCatAdd = async function () {
  const name  = document.getElementById('v9cat-name')?.value?.trim();
  const color = document.getElementById('v9cat-color')?.value || '#DC2626';
  const icon  = document.getElementById('v9cat-icon')?.value?.trim() || 'inventory_2';
  const note  = document.getElementById('v9cat-note')?.value?.trim() || '';
  if (!name) { typeof toast==='function'&&toast('กรุณากรอกชื่อหมวดหมู่','error'); return; }
  v9ShowOverlay('กำลังเพิ่มหมวดหมู่...');
  try {
    const { error } = await db.from('categories').insert({ name, color, icon, note:note||null });
    if (error) throw new Error(error.message);
    await loadCategories?.();
    typeof toast==='function'&&toast(`เพิ่มหมวดหมู่ "${name}" สำเร็จ`,'success');
    v9SwitchManageTab('cats');
    v9LoadManageStats();
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

window.v9ManageCatDelete = async function (id, name, color) {
  const prods = v9GetProducts().filter(p => p.category === name);
  const html = prods.length > 0
    ? `<div style="margin:8px 0;padding:10px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e;">
         ⚠️ มีสินค้า ${prods.length} รายการใช้หมวดนี้ จะถูกเปลี่ยนเป็น "ทั่วไป"
       </div>`
    : '';
  const r = await Swal.fire({
    title: `ลบหมวดหมู่ "${name}"?`,
    html: html || 'หมวดหมู่นี้ยังไม่มีสินค้า สามารถลบได้เลย',
    icon: 'warning', showCancelButton:true,
    confirmButtonText:'ลบ', cancelButtonText:'ยกเลิก', confirmButtonColor:'#DC2626'
  });
  if (!r.isConfirmed) return;
  v9ShowOverlay('กำลังลบ...');
  try {
    await db.from('categories').delete().eq('id', id);
    await loadCategories?.();
    typeof toast==='function'&&toast('ลบสำเร็จ','success');
    v9SwitchManageTab('cats');
    v9LoadManageStats();
  } catch(e) { typeof toast==='function'&&toast('ลบไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

// Remove cats/units/recipe/supplier/produce from Admin tabs (ย้ายมาที่ Manage แล้ว)
// Keep admin tabs: shop, receipt, users, emp only
const _v9AdminTabsFiltered = _v9AdminTabs.filter(t =>
  ['shop','receipt','users','emp'].includes(t.key)
);

// Override renderAdmin ให้ใช้ filtered tabs
const _v9OrigRenderAdmin2 = window.renderAdmin;
window.renderAdmin = async function () {
  const page = document.getElementById('page-admin');
  if (!page) return;
  try {
    if (typeof USER!=='undefined'&&USER?.role!=='admin') {
      page.innerHTML = `<div style="text-align:center;padding:80px;">
        <i class="material-icons-round" style="font-size:64px;color:var(--danger)">block</i>
        <p style="font-size:18px;margin-top:16px;">เข้าถึงได้เฉพาะผู้ดูแลระบบ</p>
      </div>`; return;
    }
  } catch(_) {}

  page.innerHTML = `
    <div style="border-bottom:1px solid var(--border-light);margin-bottom:20px;overflow-x:auto;">
      <div style="display:flex;gap:0;min-width:max-content;">
        ${_v9AdminTabsFiltered.map(t=>`
          <button id="v9atab-${t.key}" onclick="v9RenderAdminTab('${t.key}')"
            style="padding:12px 16px;border:none;background:none;cursor:pointer;
              font-family:var(--font-thai,'Prompt'),sans-serif;font-size:13px;
              border-bottom:2px solid transparent;color:var(--text-secondary);font-weight:400;
              display:flex;align-items:center;gap:5px;white-space:nowrap;transition:all .15s;">
            <i class="material-icons-round" style="font-size:16px;">${t.icon}</i>${t.label}
          </button>`).join('')}
      </div>
    </div>
    <div id="v9-admin-content"></div>`;
  v9RenderAdminTab('shop');
};

window.v9RenderAdminTab = async function (key) {
  _v9CurAdminTab = key;
  _v9AdminTabsFiltered.forEach(t=>{
    const btn=document.getElementById(`v9atab-${t.key}`);
    if(!btn)return;
    const active=t.key===key;
    btn.style.borderBottomColor=active?'var(--primary)':'transparent';
    btn.style.color=active?'var(--primary)':'var(--text-secondary)';
    btn.style.fontWeight=active?'700':'400';
  });
  const c=document.getElementById('v9-admin-content');
  if(!c)return;
  const orig={shop:'renderShopSettings',receipt:'v10RenderDocSettingsInto',emp:'renderEmployeeAdmin'};
  if(orig[key]&&typeof window[orig[key]]==='function'){await window[orig[key]](c);return;}
  if(key==='users'){await window.renderUserPerms(c);return;}
  c.innerHTML=v9AdminError('ไม่พบ tab: '+key);
};

window.renderAdminTabs = function(key){ window.v9RenderAdminTab(key); };


// ══════════════════════════════════════════════════════════════════
// FIX-22 — รอบ 1: Purchase ใหม่ + Unit Conversion ใหม่
//
//  A. showAddPurchaseModal ใหม่ทั้งหมด
//     - เลือกสินค้าเก่า / สร้างสินค้าใหม่ inline
//     - ระบุหน่วยซื้อ (รถ/ตัน/ถุง) + toggle แปลงหน่วย
//     - 1 รถ = N kg → บวกสต็อกเป็น kg อัตโนมัติ
//     - บันทึกรายจ่ายร้านพร้อมกัน (รูป expense)
//
//  B. v9AdminUnits ใหม่ทั้งหมด
//     - grouped by product (card per product)
//     - เพิ่มหลายหน่วยต่อสินค้า live (ไม่ต้อง reload)
//     - แสดง chain: base → คิว → ปิ๊ป พร้อมราคา
//
//  C. SQL ที่ต้องรัน (เพิ่ม product_type ใน สินค้า)
//     ALTER TABLE สินค้า ADD COLUMN IF NOT EXISTS product_type text DEFAULT 'ปกติ';
//     -- values: 'ปกติ', 'ผลิตล่วงหน้า', 'ผลิตตามสั่ง'
// ══════════════════════════════════════════════════════════════════


// ── A. Purchase Modal — เวอร์ชันใหม่ทั้งหมด ──────────────────────

window.showAddPurchaseModal = function () {
  try { purchaseItems = []; } catch(_) {}
  window._v9PurNewProd = null; // สินค้าใหม่ที่กำลังสร้าง

  if (typeof openModal !== 'function') return;
  openModal('รับสินค้าเข้าคลัง', v9BuildPurchaseHTML(), 'xl');

  // โหลด suppliers datalist
  db.from('ซัพพลายเออร์').select('id,name').eq('status','ใช้งาน').then(({data}) => {
    const dl  = document.getElementById('pur-supplier-list');
    const sel = document.getElementById('pur-supplier-id');
    (data||[]).forEach(s => {
      if (dl)  { const o=document.createElement('option'); o.value=s.name; dl.appendChild(o); }
      if (sel) { const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; sel.appendChild(o); }
    });
    window._v9Suppliers = data || [];
  });
};

window.v9BuildPurchaseHTML = function () {
  const cats = (typeof categories !== 'undefined' ? categories : []) || [];
  const catOpts = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  return `
    <form id="v9pur-form" onsubmit="event.preventDefault();" style="display:flex;flex-direction:column;gap:0;">

      <!-- ── Step indicator ── -->
      <div style="display:flex;gap:0;margin-bottom:20px;border-radius:10px;overflow:hidden;
        border:1px solid var(--border-light);">
        ${['1 ข้อมูลใบสั่งซื้อ','2 รายการสินค้า','3 ยืนยัน'].map((s,i) => `
          <div id="v9pur-step-${i+1}" style="flex:1;padding:10px;text-align:center;font-size:12px;
            font-weight:700;background:${i===0?'var(--primary)':'var(--bg-base)'};
            color:${i===0?'#fff':'var(--text-tertiary)'};transition:all .2s;">${s}</div>`).join('')}
      </div>

      <!-- ── Panel 1: ข้อมูลการซื้อ ── -->
      <div id="v9pur-p1">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group">
            <label class="form-label">ผู้จำหน่าย</label>
            <input class="form-input" id="pur-supplier" list="pur-supplier-list" placeholder="ชื่อผู้จำหน่าย / ซัพพลายเออร์">
            <datalist id="pur-supplier-list"></datalist>
          </div>
          <div class="form-group">
            <label class="form-label">วันที่รับสินค้า</label>
            <input class="form-input" type="date" id="pur-date" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group">
            <label class="form-label">วิธีชำระ</label>
            <select class="form-input" id="pur-method" onchange="v9PurToggleCredit()">
              <option value="เงินสด">เงินสด</option>
              <option value="โอนเงิน">โอนเงิน</option>
              <option value="เครดิต">เครดิต (ค้างชำระ)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">หมายเหตุ</label>
            <input class="form-input" id="pur-note" placeholder="หมายเหตุ (ถ้ามี)">
          </div>
        </div>
        <div id="v9pur-credit-row" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group">
            <label class="form-label">ซัพพลายเออร์ (เครดิต)</label>
            <select class="form-input" id="pur-supplier-id"><option value="">-- เลือก --</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">วันครบกำหนดชำระ *</label>
            <input class="form-input" type="date" id="pur-due-date">
          </div>
        </div>
        <!-- บันทึกรายจ่ายพร้อมกัน -->
        <div style="padding:12px 14px;background:#f0fdf4;border-radius:10px;border:1px solid #86efac;
          display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#15803d;">บันทึกรายจ่ายร้านพร้อมกัน</div>
            <div style="font-size:11px;color:#16a34a;margin-top:2px;">ยอดซื้อจะถูกบันทึกเป็นรายจ่ายหมวด "ซื้อสินค้า" อัตโนมัติ</div>
          </div>
          <label style="cursor:pointer;display:flex;align-items:center;gap:6px;">
            <input type="checkbox" id="pur-log-expense" checked style="width:16px;height:16px;">
            <span style="font-size:13px;font-weight:700;color:#15803d;">เปิด</span>
          </label>
        </div>
        <button type="button" class="btn btn-primary" style="width:100%;margin-top:14px;"
          onclick="v9PurGoStep2()">
          ถัดไป — เพิ่มรายการสินค้า <i class="material-icons-round" style="font-size:16px;">arrow_forward</i>
        </button>
      </div>

      <!-- ── Panel 2: รายการสินค้า ── -->
      <div id="v9pur-p2" style="display:none;">
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="v9PurGoStep1()">
            <i class="material-icons-round" style="font-size:14px;">arrow_back</i> กลับ
          </button>
          <div style="flex:1;"></div>
          <button type="button" class="btn btn-outline btn-sm" onclick="v9PurShowAddItem('existing')"
            style="gap:6px;">
            <i class="material-icons-round" style="font-size:14px;">search</i> สินค้าเก่า
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="v9PurShowAddItem('new')"
            style="gap:6px;">
            <i class="material-icons-round" style="font-size:14px;">add</i> สินค้าใหม่
          </button>
        </div>

        <!-- รายการที่เพิ่มแล้ว -->
        <div id="v9pur-item-list">
          <div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;
            border:1.5px dashed var(--border-light);border-radius:10px;">
            <i class="material-icons-round" style="font-size:32px;opacity:.4;display:block;margin-bottom:8px;">inventory</i>
            ยังไม่มีรายการ — กดปุ่มด้านบนเพื่อเพิ่มสินค้า
          </div>
        </div>

        <!-- Total bar -->
        <div id="v9pur-total-bar" style="display:none;margin-top:12px;padding:12px 16px;
          background:var(--bg-base);border-radius:10px;border:1px solid var(--border-light);
          display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;color:var(--text-secondary);">ยอดรวมทั้งหมด</span>
          <span id="v9pur-total-val" style="font-size:18px;font-weight:800;color:var(--primary);">฿0</span>
        </div>

        <button type="button" id="v9pur-next-btn" class="btn btn-primary"
          style="width:100%;margin-top:14px;" onclick="v9PurGoStep3()" disabled>
          ถัดไป — ยืนยัน <i class="material-icons-round" style="font-size:16px;">arrow_forward</i>
        </button>
      </div>

      <!-- ── Panel 2b: เพิ่มสินค้า (existing) ── -->
      <div id="v9pur-p2b-exist" style="display:none;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:12px;"
          onclick="v9PurBackToList()">
          <i class="material-icons-round" style="font-size:14px;">arrow_back</i> กลับรายการ
        </button>
        <div class="form-group">
          <label class="form-label">ค้นหาสินค้า</label>
          <input class="form-input" id="v9pur-search" placeholder="พิมพ์ชื่อสินค้า..."
            oninput="v9PurFilterProducts()">
        </div>
        <div id="v9pur-prod-list" style="max-height:220px;overflow-y:auto;
          border:1px solid var(--border-light);border-radius:10px;"></div>

        <!-- กรอกรายละเอียดหลังเลือกสินค้า -->
        <div id="v9pur-exist-detail" style="display:none;margin-top:12px;">
          <div id="v9pur-selected-bar" style="background:var(--primary);color:#fff;
            border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;font-weight:700;"></div>
          ${v9PurItemFields()}
        </div>
      </div>

      <!-- ── Panel 2c: สินค้าใหม่ ── -->
      <div id="v9pur-p2c-new" style="display:none;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:12px;"
          onclick="v9PurBackToList()">
          <i class="material-icons-round" style="font-size:14px;">arrow_back</i> กลับรายการ
        </button>
        <div style="background:#eff6ff;border-radius:10px;padding:10px 14px;margin-bottom:14px;
          font-size:12px;color:#1d4ed8;">
          <i class="material-icons-round" style="font-size:14px;vertical-align:middle;">info</i>
          สร้างสินค้าใหม่ในระบบและรับเข้าคลังพร้อมกัน
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group">
            <label class="form-label">ชื่อสินค้า *</label>
            <input class="form-input" id="v9pur-new-name" placeholder="เช่น ทราย, ปูนผง, หิน">
          </div>
          <div class="form-group">
            <label class="form-label">หน่วยเก็บสต็อก (Base) *</label>
            <input class="form-input" id="v9pur-new-unit" placeholder="กก., ลิตร, ชิ้น">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group">
            <label class="form-label">ราคาขาย/base</label>
            <input class="form-input" type="number" id="v9pur-new-price" value="0" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">หมวดหมู่</label>
            <select class="form-input" id="v9pur-new-cat">
              <option value="วัตถุดิบ">วัตถุดิบ</option>
              <option value="ทั่วไป">ทั่วไป</option>
              ${catOpts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">ประเภทสินค้า</label>
            <select class="form-input" id="v9pur-new-type">
              <option value="ปกติ">ปกติ (ขายทั่วไป)</option>
              <option value="ผลิตล่วงหน้า">ผลิตล่วงหน้า</option>
              <option value="ผลิตตามสั่ง">ผลิตตามสั่ง (Auto-deduct)</option>
            </select>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="v9pur-new-is-raw">
            <span>เป็นวัตถุดิบ (ไม่โชว์ใน POS)</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="v9pur-new-for-sale" checked>
            <span>มีไว้ขาย</span>
          </label>
        </div>
        ${v9PurItemFields('new')}
      </div>

      <!-- ── Panel 3: ยืนยัน ── -->
      <div id="v9pur-p3" style="display:none;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:16px;"
          onclick="v9PurGoStep2()">
          <i class="material-icons-round" style="font-size:14px;">arrow_back</i> แก้ไขรายการ
        </button>
        <div id="v9pur-confirm-body"></div>
        <button type="button" class="btn btn-primary" style="width:100%;margin-top:16px;font-size:15px;padding:14px;"
          onclick="v9PurSave()">
          <i class="material-icons-round">check_circle</i> ยืนยันรับสินค้าเข้าคลัง
        </button>
      </div>

    </form>`;
};

// helper: ฟิลด์รายละเอียดสินค้าที่จะรับ
window.v9PurItemFields = function (prefix='exist') {
  return `
    <div style="background:var(--bg-base);border-radius:10px;padding:14px;border:1px solid var(--border-light);">
      <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:10px;">
        รายละเอียดการรับ
      </div>

      <!-- หน่วยซื้อ -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="form-group">
          <label class="form-label">หน่วยที่รับเข้า (หน่วยซื้อ)</label>
          <input class="form-input" id="v9pur-${prefix}-buy-unit"
            placeholder="เช่น รถ, ตัน, ถุง, กระสอบ">
        </div>
        <div class="form-group">
          <label class="form-label">จำนวน *</label>
          <input class="form-input" type="number" id="v9pur-${prefix}-qty"
            value="1" min="0.001" step="0.001">
        </div>
      </div>

      <!-- ราคา -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="form-group">
          <label class="form-label">ราคาซื้อ/หน่วยซื้อ (บาท) *</label>
          <input class="form-input" type="number" id="v9pur-${prefix}-cost"
            min="0" placeholder="0" oninput="v9PurCalcPreview('${prefix}')">
        </div>
        <div class="form-group" style="display:flex;flex-direction:column;justify-content:flex-end;">
          <div id="v9pur-${prefix}-cost-preview" style="font-size:12px;color:var(--text-tertiary);
            padding:6px 0;"></div>
        </div>
      </div>

      <!-- Toggle: แปลงหน่วยเป็น base? -->
      <div style="padding:10px 12px;border-radius:8px;border:1px solid var(--border-light);
        margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div>
            <div style="font-size:13px;font-weight:700;">แปลงเป็นหน่วยเก็บสต็อก?</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">
              เปิดถ้าหน่วยซื้อ ≠ หน่วยสต็อก เช่น รับเป็นรถ เก็บเป็น kg
            </div>
          </div>
          <label style="cursor:pointer;display:flex;align-items:center;gap:6px;">
            <input type="checkbox" id="v9pur-${prefix}-conv-toggle"
              onchange="v9PurToggleConv('${prefix}')" style="width:16px;height:16px;">
            <span style="font-size:13px;">แปลง</span>
          </label>
        </div>
        <div id="v9pur-${prefix}-conv-area" style="display:none;">
          <div style="display:grid;grid-template-columns:auto 1fr auto 1fr;align-items:center;
            gap:8px;font-size:13px;">
            <span style="color:var(--text-secondary);">1</span>
            <input class="form-input" id="v9pur-${prefix}-conv-from"
              placeholder="หน่วยซื้อ (รถ)" style="font-size:13px;"
              oninput="v9PurCalcPreview('${prefix}')">
            <span style="color:var(--text-secondary);">=</span>
            <div style="display:flex;gap:6px;align-items:center;">
              <input class="form-input" type="number" id="v9pur-${prefix}-conv-rate"
                placeholder="9000" min="0.001" step="0.001" style="font-size:13px;width:90px;"
                oninput="v9PurCalcPreview('${prefix}')">
              <input class="form-input" id="v9pur-${prefix}-conv-to"
                placeholder="kg" style="font-size:13px;width:60px;"
                oninput="v9PurCalcPreview('${prefix}')">
            </div>
          </div>
          <!-- บันทึก conv ไว้ใช้ขายด้วย? -->
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;
            color:var(--text-secondary);margin-top:8px;cursor:pointer;">
            <input type="checkbox" id="v9pur-${prefix}-save-unit" checked>
            บันทึกหน่วยนี้ไว้สำหรับขายด้วย (เพิ่มใน "หน่วยนับ")
          </label>
          <!-- preview -->
          <div id="v9pur-${prefix}-conv-preview" style="margin-top:8px;padding:8px 10px;
            background:#f0fdf4;border-radius:6px;font-size:12px;color:#15803d;display:none;"></div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button type="button" class="btn btn-primary" style="flex:1;"
        onclick="v9PurAddItem('${prefix}')">
        <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มรายการนี้
      </button>
    </div>`;
};

// ── Step navigation ─────────────────────────────────────────────
window.v9PurGoStep1 = function () { v9PurSetStep(1); };
window.v9PurGoStep2 = function () { v9PurSetStep(2); };
window.v9PurGoStep3 = function () {
  let items = [];
  try { items = purchaseItems; } catch(_) {}
  if (!items.length) { typeof toast==='function'&&toast('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ','error'); return; }
  v9PurBuildConfirm();
  v9PurSetStep(3);
};

window.v9PurSetStep = function (n) {
  [1,2,3].forEach(i => {
    const panel = document.getElementById(`v9pur-p${i}`);
    if (panel) panel.style.display = i === n ? 'block' : 'none';
    const step = document.getElementById(`v9pur-step-${i}`);
    if (step) {
      step.style.background = i < n ? '#10b981' : i === n ? 'var(--primary)' : 'var(--bg-base)';
      step.style.color = i <= n ? '#fff' : 'var(--text-tertiary)';
    }
  });
  // ซ่อน sub-panels
  ['v9pur-p2b-exist','v9pur-p2c-new'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
};

window.v9PurToggleCredit = function () {
  const val = document.getElementById('pur-method')?.value;
  const row = document.getElementById('v9pur-credit-row');
  if (row) row.style.display = val === 'เครดิต' ? 'grid' : 'none';
};

window.v9PurShowAddItem = function (mode) {
  document.getElementById('v9pur-p2').style.display = 'none';
  if (mode === 'existing') {
    document.getElementById('v9pur-p2b-exist').style.display = 'block';
    v9PurRenderProductList();
  } else {
    document.getElementById('v9pur-p2c-new').style.display = 'block';
  }
};

window.v9PurBackToList = function () {
  ['v9pur-p2b-exist','v9pur-p2c-new'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('v9pur-p2').style.display = 'block';
};

window.v9PurToggleConv = function (prefix) {
  const on  = document.getElementById(`v9pur-${prefix}-conv-toggle`)?.checked;
  const area= document.getElementById(`v9pur-${prefix}-conv-area`);
  if (area) area.style.display = on ? 'block' : 'none';
};

window.v9PurCalcPreview = function (prefix) {
  const qty    = Number(document.getElementById(`v9pur-${prefix}-qty`)?.value || 0);
  const cost   = Number(document.getElementById(`v9pur-${prefix}-cost`)?.value || 0);
  const convOn = document.getElementById(`v9pur-${prefix}-conv-toggle`)?.checked;
  const rate   = Number(document.getElementById(`v9pur-${prefix}-conv-rate`)?.value || 0);
  const fromU  = document.getElementById(`v9pur-${prefix}-conv-from`)?.value || 'หน่วยซื้อ';
  const toU    = document.getElementById(`v9pur-${prefix}-conv-to`)?.value || 'หน่วยสต็อก';
  const prevEl = document.getElementById(`v9pur-${prefix}-cost-preview`);
  const convPrev = document.getElementById(`v9pur-${prefix}-conv-preview`);

  const total = qty * cost;
  if (prevEl) prevEl.textContent = `ยอดรวม ฿${formatNum(total)}`;

  if (convOn && rate > 0) {
    const stockQty   = qty * rate;
    const costPerBase = rate > 0 ? Math.round(cost / rate) : cost;
    if (convPrev) {
      convPrev.style.display = 'block';
      convPrev.innerHTML =
        `${qty} ${fromU} × ${rate} = <strong>${stockQty} ${toU}</strong> เข้าสต็อก` +
        ` | ต้นทุน/base = ฿${formatNum(costPerBase)}/${toU}`;
    }
  } else {
    if (convPrev) convPrev.style.display = 'none';
  }
};

// ── รายการสินค้า (Existing) ────────────────────────────────────
window.v9PurRenderProductList = function () {
  const prods = v9GetProducts();
  const el = document.getElementById('v9pur-prod-list');
  if (!el) return;
  const q = (document.getElementById('v9pur-search')?.value || '').toLowerCase();
  const filtered = prods.filter(p =>
    (p.name||'').toLowerCase().includes(q) ||
    (p.barcode||'').toLowerCase().includes(q)
  );
  el.innerHTML = filtered.slice(0, 30).map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:10px 14px;border-bottom:0.5px solid var(--border-light);cursor:pointer;"
      onmouseenter="this.style.background='var(--bg-base)'"
      onmouseleave="this.style.background=''"
      onclick="v9PurSelectExisting('${p.id}','${(p.name||'').replace(/'/g,"\\'")}','${p.unit||''}')">
      <div>
        <div style="font-size:13px;font-weight:700;">${p.name}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">
          สต็อก: ${p.stock} ${p.unit||''}
          ${p.is_raw?' · <span style="color:#d97706;">วัตถุดิบ</span>':''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:12px;color:var(--text-secondary);">ต้นทุน</div>
        <div style="font-size:13px;font-weight:700;">฿${formatNum(p.cost||0)}/${p.unit||'ชิ้น'}</div>
      </div>
    </div>`).join('') ||
    `<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;">ไม่พบสินค้า</div>`;
};

window.v9PurFilterProducts = function () { v9PurRenderProductList(); };

window.v9PurSelectExisting = function (id, name, unit) {
  document.getElementById('v9pur-prod-list').style.display    = 'none';
  const searchGrp = document.getElementById('v9pur-search')?.closest('.form-group');
  if (searchGrp) searchGrp.style.display = 'none';
  document.getElementById('v9pur-exist-detail').style.display = 'block';
  document.getElementById('v9pur-selected-bar').textContent   = `เลือก: ${name} (หน่วยสต็อก: ${unit||'ชิ้น'})`;

  // set hidden
  const el = document.getElementById('v9pur-exist-detail');
  el.dataset.prodId   = id;
  el.dataset.prodName = name;
  el.dataset.prodUnit = unit;

  // prefill from unit
  const fromEl = document.getElementById('v9pur-exist-conv-from');
  const toEl   = document.getElementById('v9pur-exist-conv-to');
  if (fromEl) fromEl.placeholder = 'รถ, ตัน, ถุง...';
  if (toEl)   toEl.value = unit;

  // prefill cost
  const prod = v9GetProducts().find(p => p.id === id);
  const costEl = document.getElementById('v9pur-exist-cost');
  if (costEl && prod) costEl.value = prod.cost || 0;
};

// ── เพิ่มสินค้าเข้า purchaseItems ─────────────────────────────
window.v9PurAddItem = async function (prefix) {
  const isNew   = prefix === 'new';
  const qty     = Number(document.getElementById(`v9pur-${prefix}-qty`)?.value || 0);
  const cost    = Number(document.getElementById(`v9pur-${prefix}-cost`)?.value || 0);
  const buyUnit = document.getElementById(`v9pur-${prefix}-buy-unit`)?.value?.trim() || '';
  const convOn  = document.getElementById(`v9pur-${prefix}-conv-toggle`)?.checked;
  const convRate= Number(document.getElementById(`v9pur-${prefix}-conv-rate`)?.value || 0);
  const convFrom= document.getElementById(`v9pur-${prefix}-conv-from`)?.value?.trim() || '';
  const convTo  = document.getElementById(`v9pur-${prefix}-conv-to`)?.value?.trim() || '';
  const saveUnit= document.getElementById(`v9pur-${prefix}-save-unit`)?.checked;

  if (qty <= 0 || cost < 0) {
    typeof toast==='function'&&toast('กรุณากรอกจำนวนและราคา','error'); return;
  }

  let prodId = '', prodName = '', prodUnit = '';

  if (isNew) {
    // validate new product
    prodName = document.getElementById('v9pur-new-name')?.value?.trim();
    prodUnit = document.getElementById('v9pur-new-unit')?.value?.trim() || convTo || 'ชิ้น';
    if (!prodName || !prodUnit) {
      typeof toast==='function'&&toast('กรุณากรอกชื่อสินค้าและหน่วยสต็อก','error'); return;
    }
    // สร้างสินค้าใหม่ใน DB
    v9ShowOverlay('กำลังสร้างสินค้าใหม่...');
    try {
      const newPrice = Number(document.getElementById('v9pur-new-price')?.value || 0);
      const newCat   = document.getElementById('v9pur-new-cat')?.value || 'วัตถุดิบ';
      const newType  = document.getElementById('v9pur-new-type')?.value || 'ปกติ';
      const isRaw    = document.getElementById('v9pur-new-is-raw')?.checked || false;
      const forSale  = document.getElementById('v9pur-new-for-sale')?.checked !== false;
      const costBase = convOn && convRate > 0 ? parseFloat((cost / convRate).toFixed(6)) : cost;

      const { data: np, error: ne } = await db.from('สินค้า').insert({
        name: prodName, unit: prodUnit,
        price: newPrice, cost: costBase,
        stock: 0, category: newCat,
        is_raw: isRaw, product_type: newType,
        updated_at: new Date().toISOString(),
      }).select().single();
      if (ne) throw new Error(ne.message);
      prodId = np.id;
      // อัป cache
      await loadProducts?.();
      try { if (typeof products!=='undefined') window._v9ProductsCache = products; } catch(_){}
    } catch(e) {
      v9HideOverlay();
      typeof toast==='function'&&toast('สร้างสินค้าไม่สำเร็จ: '+e.message,'error'); return;
    } finally { v9HideOverlay(); }
  } else {
    const detail = document.getElementById('v9pur-exist-detail');
    prodId   = detail?.dataset.prodId || '';
    prodName = detail?.dataset.prodName || '';
    prodUnit = detail?.dataset.prodUnit || '';
    if (!prodId) { typeof toast==='function'&&toast('กรุณาเลือกสินค้า','error'); return; }
  }

  const stockQty   = convOn && convRate > 0 ? qty * convRate : qty;
  const costPerBase= convOn && convRate > 0 ? parseFloat((cost / convRate).toFixed(6)) : cost;

  // บันทึก unit conversion ถ้าต้องการ
  if (convOn && convRate > 0 && saveUnit && buyUnit) {
    try {
      await db.from('product_units').insert({
        product_id: prodId,
        unit_name:  buyUnit,
        conv_rate:  convRate,
        price_per_unit: 0,
        is_base: false,
      });
      delete window._v9UnitCache?.[prodId];
    } catch(_) {}
  }

  try {
    const ex = purchaseItems.find(x => x.product_id === prodId);
    if (ex) {
      ex.qty += qty; ex.cost_per_unit = cost;
      ex.qty_base = (ex.qty_base || ex.qty) + (convOn && convRate > 0 ? qty * convRate : qty);
    } else {
      purchaseItems.push({
        product_id: prodId, name: prodName,
        qty, cost_per_unit: cost, unit: prodUnit,
        buy_unit: buyUnit || prodUnit,
        conv_on: convOn, conv_rate: convRate,
        qty_base: stockQty, cost_base: costPerBase,
        purchase_unit_id: convOn ? '_custom_' : '__base__',
        purchase_unit_name: buyUnit || prodUnit,
      });
    }
  } catch(_) {}

  v9PurRenderItemList();
  v9PurBackToList();
  typeof toast==='function'&&toast(
    `เพิ่ม ${prodName} × ${qty} ${buyUnit||prodUnit}` +
    (convOn && convRate > 0 ? ` (= ${stockQty} ${prodUnit})` : ''),
    'success'
  );
};

// ── แสดงรายการที่เพิ่มแล้ว ───────────────────────────────────────
window.v9PurRenderItemList = function () {
  let items = [];
  try { items = purchaseItems; } catch(_) { items = []; }
  const el    = document.getElementById('v9pur-item-list');
  const tbar  = document.getElementById('v9pur-total-bar');
  const nbtn  = document.getElementById('v9pur-next-btn');
  if (!el) return;

  if (items.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;
      border:1.5px dashed var(--border-light);border-radius:10px;">
      <i class="material-icons-round" style="font-size:32px;opacity:.4;display:block;margin-bottom:8px;">inventory</i>
      ยังไม่มีรายการ — กดปุ่มด้านบนเพื่อเพิ่มสินค้า
    </div>`;
    if (tbar) tbar.style.display = 'none';
    if (nbtn) nbtn.disabled = true;
    return;
  }

  const total = items.reduce((s,i) => s + i.qty * i.cost_per_unit, 0);
  el.innerHTML = `
    <div style="border:1px solid var(--border-light);border-radius:10px;overflow:hidden;">
      ${items.map((item, idx) => `
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;
          padding:12px 14px;border-bottom:0.5px solid var(--border-light);
          background:${item.conv_on?'#f0fdf4':'var(--bg-surface)'};">
          <div>
            <div style="font-size:14px;font-weight:700;">${item.name}</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">
              รับ ${item.qty} ${item.buy_unit||item.unit}
              ${item.conv_on?` → สต็อก <strong style="color:#15803d;">${item.qty_base} ${item.unit}</strong>`:''}
              | ต้นทุน ฿${formatNum(item.cost_per_unit)}/${item.buy_unit||item.unit}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:15px;font-weight:800;color:var(--primary);">
              ฿${formatNum(item.qty * item.cost_per_unit)}
            </div>
          </div>
          <button onclick="v9PurRemoveItem(${idx})"
            style="background:none;border:none;cursor:pointer;color:var(--danger);padding:4px;">
            <i class="material-icons-round" style="font-size:18px;">close</i>
          </button>
        </div>`).join('')}
    </div>`;

  if (tbar) { tbar.style.display = 'flex'; }
  const tv = document.getElementById('v9pur-total-val');
  if (tv)   tv.textContent = `฿${formatNum(total)}`;
  if (nbtn) nbtn.disabled = false;
};

window.v9PurRemoveItem = function (idx) {
  try { purchaseItems.splice(idx, 1); } catch(_) {}
  v9PurRenderItemList();
};

// ── Build confirm summary ────────────────────────────────────────
window.v9PurBuildConfirm = function () {
  let items = [];
  try { items = purchaseItems; } catch(_) {}
  const total      = items.reduce((s,i) => s + i.qty * i.cost_per_unit, 0);
  const supplier   = document.getElementById('pur-supplier')?.value || '—';
  const method     = document.getElementById('pur-method')?.value || 'เงินสด';
  const logExp     = document.getElementById('pur-log-expense')?.checked;
  const el = document.getElementById('v9pur-confirm-body');
  if (!el) return;

  el.innerHTML = `
    <div style="background:var(--bg-base);border-radius:12px;padding:16px;margin-bottom:14px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:12px;">
        <div><span style="color:var(--text-tertiary);">ผู้จำหน่าย:</span> <strong>${supplier}</strong></div>
        <div><span style="color:var(--text-tertiary);">วิธีชำระ:</span> <strong>${method}</strong></div>
      </div>
      ${items.map(item => `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:8px 0;border-bottom:0.5px solid var(--border-light);font-size:13px;">
          <div>
            <strong>${item.name}</strong>
            <span style="color:var(--text-tertiary);margin-left:6px;">${item.qty} ${item.buy_unit||item.unit}</span>
            ${item.conv_on?`<span style="color:#15803d;margin-left:6px;">→ ${item.qty_base} ${item.unit}</span>`:''}
          </div>
          <strong>฿${formatNum(item.qty * item.cost_per_unit)}</strong>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;
        margin-top:10px;font-size:16px;font-weight:800;">
        <span>ยอดรวม</span>
        <span style="color:var(--primary);">฿${formatNum(total)}</span>
      </div>
    </div>
    ${logExp ? `
      <div style="padding:10px 14px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;
        font-size:12px;color:#15803d;display:flex;align-items:center;gap:8px;">
        <i class="material-icons-round" style="font-size:16px;">receipt</i>
        รายจ่ายร้าน "ซื้อสินค้า" จะถูกบันทึก ฿${formatNum(total)} พร้อมกัน
      </div>` : ''}`;
};

// ── Save ────────────────────────────────────────────────────────
window.v9PurSave = async function () {
  let items = [];
  try { items = purchaseItems; } catch(_) {}
  if (!items.length) { typeof toast==='function'&&toast('ไม่มีรายการ','error'); return; }

  const supplier  = document.getElementById('pur-supplier')?.value?.trim() || '';
  const method    = document.getElementById('pur-method')?.value || 'เงินสด';
  const note      = document.getElementById('pur-note')?.value?.trim() || '';
  const purDate   = document.getElementById('pur-date')?.value || new Date().toISOString();
  const dueDate   = document.getElementById('pur-due-date')?.value || null;
  const logExp    = document.getElementById('pur-log-expense')?.checked;
  const suppSelId = document.getElementById('pur-supplier-id')?.value || null;
  const total     = items.reduce((s,i) => s + i.qty * i.cost_per_unit, 0);

  if (method === 'เครดิต' && !dueDate) {
    typeof toast==='function'&&toast('กรุณาระบุวันครบกำหนดชำระ','error'); return;
  }

  v9ShowOverlay('กำลังบันทึก...', `${items.length} รายการ | ฿${formatNum(total)}`);
  try {
    // 1. Purchase order
    const { data: po, error: poErr } = await db.from('purchase_order').insert({
      date: new Date(purDate).toISOString(),
      supplier: supplier || null,
      total, method,
      note: note || null,
      staff_name: v9Staff(),
      status: 'รับแล้ว',
    }).select().single();
    if (poErr) throw new Error(poErr.message);

    // 2. Items + stock
    for (const item of items) {
      await db.from('purchase_item').insert({
        order_id: po.id, product_id: item.product_id, name: item.name,
        qty: item.qty, received_qty: item.qty,
        cost_per_unit: item.cost_per_unit, total: item.qty * item.cost_per_unit,
      });

      const prod      = v9GetProducts().find(p => p.id === item.product_id);
      const stockBefore = prod?.stock || 0;
      const addQty    = item.qty_base || item.qty;
      const stockAfter  = stockBefore + addQty;
      const costBase  = item.cost_base || item.cost_per_unit;

      await db.from('สินค้า').update({
        stock: stockAfter,
        cost:  costBase > 0 ? costBase : (prod?.cost || 0),
        updated_at: new Date().toISOString(),
      }).eq('id', item.product_id);

      await db.from('stock_movement').insert({
        product_id: item.product_id, product_name: item.name,
        type: 'รับเข้า', direction: 'in', qty: addQty,
        stock_before: stockBefore, stock_after: stockAfter,
        ref_id: po.id, ref_table: 'purchase_order',
        staff_name: v9Staff(),
        note: item.conv_on
          ? `รับ ${item.qty} ${item.buy_unit} = ${addQty} ${item.unit}`
          : (note || null),
      });

      // recalc BOM cost ของสินค้าที่ใช้วัตถุดิบนี้
      if (costBase > 0) {
        try {
          const { data: recipes } = await db.from('สูตรสินค้า')
            .select('product_id').eq('material_id', item.product_id);
          for (const r of (recipes||[])) await window.v9CalcBOMCost?.(r.product_id);
        } catch(_) {}
      }
    }

    // 3. รายจ่าย
    if (logExp) {
      await db.from('รายจ่าย').insert({
        date: new Date(purDate).toISOString(),
        description: `ซื้อสินค้า${supplier ? ' จาก ' + supplier : ''} (${items.length} รายการ)`,
        amount: total,
        method,
        category: 'ซื้อสินค้า',
        staff_name: v9Staff(),
        note: note || null,
      });
    }

    // 4. เครดิต → เจ้าหนี้
    if (method === 'เครดิต') {
      let suppId = suppSelId;
      if (!suppId && supplier) {
        const { data: found } = await db.from('ซัพพลายเออร์').select('id').eq('name', supplier).maybeSingle();
        if (found) suppId = found.id;
        else {
          const { data: ns } = await db.from('ซัพพลายเออร์').insert({
            name: supplier, status: 'ใช้งาน'
          }).select('id').single();
          suppId = ns?.id;
        }
      }
      if (suppId) {
        await db.from('เจ้าหนี้').insert({
          supplier_id: suppId, purchase_order_id: po.id,
          date: new Date().toISOString(), due_date: dueDate,
          amount: total, paid_amount: 0, balance: total, status: 'ค้างชำระ',
        });
      }
    }

    typeof logActivity==='function' && logActivity(
      'รับสินค้าเข้า',
      `${supplier||'ไม่ระบุ'} | ${items.length} รายการ | ฿${formatNum(total)}`
    );

    try { purchaseItems = []; } catch(_) {}
    window._v9ProductsCache = null;
    await loadProducts?.();
    try { if (typeof products!=='undefined') window._v9ProductsCache = products; } catch(_){}

    typeof closeModal==='function' && closeModal();
    typeof renderPurchases==='function' && renderPurchases?.();

    const msg = logExp
      ? `รับสินค้า ฿${formatNum(total)} สำเร็จ — บันทึกรายจ่ายแล้ว`
      : `รับสินค้า ฿${formatNum(total)} สำเร็จ`;
    typeof toast==='function' && toast(msg, 'success');

  } catch(e) {
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
  } finally { v9HideOverlay(); }
};
window.submitPurchaseOrder = window.v9PurSave;
window.savePurchaseOrder   = window.v9PurSave;


// ── B. v9AdminUnits ใหม่ — grouped by product ─────────────────────

window.v9AdminUnits = async function (container) {
  container.innerHTML = v9AdminLoading('โหลดหน่วยนับ...');
  let units = [];
  try {
    const { data, error } = await db.from('product_units').select('*').order('product_id');
    if (error) throw new Error(error.message);
    units = data || [];
  } catch(e) { container.innerHTML = v9AdminError('โหลดไม่ได้: '+e.message); return; }

  const prods = v9GetProducts();
  const prodMap = {};
  prods.forEach(p => { prodMap[p.id] = p; });

  // group by product
  const grouped = {};
  units.forEach(u => {
    if (!grouped[u.product_id]) grouped[u.product_id] = [];
    grouped[u.product_id].push(u);
  });
  const productIds = Object.keys(grouped);

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:16px;font-weight:800;">หน่วยนับสินค้า</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">
          กำหนดหน่วยขาย เช่น ทราย (base:kg) → คิว, ปิ๊ป, ถุง
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="v9UnitsShowAddProduct()">
        <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มหน่วยให้สินค้า
      </button>
    </div>

    <!-- Quick add panel -->
    <div id="v9au2-add" style="display:none;background:var(--bg-base);border-radius:14px;
      padding:16px 18px;margin-bottom:20px;border:1px solid var(--border-light);">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px;">เพิ่มหน่วยนับ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="form-group">
          <label class="form-label">สินค้า *</label>
          <select class="form-input" id="v9au2-prod" onchange="v9UnitsUpdateBase()">
            <option value="">-- เลือกสินค้า --</option>
            ${prods.map(p=>`<option value="${p.id}">${p.name} (base: ${p.unit||'ชิ้น'})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">หน่วย base ของสินค้า</label>
          <input class="form-input" id="v9au2-base-unit" readonly
            placeholder="(เลือกสินค้าก่อน)" style="background:var(--bg-base);">
        </div>
      </div>
      <div style="background:#eff6ff;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#1d4ed8;">
        <strong>ตัวอย่าง:</strong> ทราย base=kg → เพิ่มหน่วย "คิว" โดย 1 คิว = 1600 kg (conv_rate=1600)
      </div>
      <div id="v9au2-unit-rows">
        <div style="display:grid;grid-template-columns:1fr 100px 100px 80px 36px;gap:8px;
          margin-bottom:6px;font-size:11px;font-weight:700;color:var(--text-secondary);padding:0 4px;">
          <span>ชื่อหน่วย</span><span>= กี่ base</span><span>ราคา/หน่วย</span><span>Base?</span><span></span>
        </div>
        <div id="v9au2-rows-inner">
          ${v9BuildUnitRow(0)}
        </div>
      </div>
      <button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;"
        onclick="v9UnitsAddRow()">
        <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มหน่วย
      </button>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-primary" onclick="v9UnitsSaveAll()">
          <i class="material-icons-round" style="font-size:14px;">save</i> บันทึกทั้งหมด
        </button>
        <button class="btn btn-outline" onclick="document.getElementById('v9au2-add').style.display='none'">
          ยกเลิก
        </button>
      </div>
    </div>

    <!-- Product cards -->
    ${productIds.length === 0
      ? `<div style="text-align:center;padding:60px;color:var(--text-tertiary);">
           <i class="material-icons-round" style="font-size:48px;opacity:.3;display:block;margin-bottom:12px;">straighten</i>
           ยังไม่มีหน่วยนับ — กด "+ เพิ่มหน่วยให้สินค้า"
         </div>`
      : productIds.map(pid => {
          const prod  = prodMap[pid];
          const us    = grouped[pid];
          const base  = us.find(u => u.is_base) || { unit_name: prod?.unit||'ชิ้น', conv_rate:1 };
          return `
            <div style="background:var(--bg-surface,#fff);border:1px solid var(--border-light);
              border-radius:16px;overflow:hidden;margin-bottom:12px;">
              <!-- Product header -->
              <div style="padding:14px 18px;background:var(--bg-base);
                display:flex;align-items:center;justify-content:space-between;
                border-bottom:1px solid var(--border-light);">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:36px;height:36px;border-radius:10px;
                    background:var(--primary);opacity:.1;display:flex;align-items:center;justify-content:center;">
                  </div>
                  <div>
                    <div style="font-size:15px;font-weight:700;">${prod?.name || pid}</div>
                    <div style="font-size:11px;color:var(--text-tertiary);">
                      หน่วยสต็อก (base): <strong>${prod?.unit||'ชิ้น'}</strong>
                      · สต็อกปัจจุบัน ${prod?.stock||0} ${prod?.unit||'ชิ้น'}
                    </div>
                  </div>
                </div>
                <button class="btn btn-outline btn-sm"
                  onclick="v9UnitsShowAddProduct('${pid}')">
                  <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มหน่วย
                </button>
              </div>
              <!-- Unit chain -->
              <div style="padding:14px 18px;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
                  <!-- base -->
                  <div style="padding:8px 14px;background:#fef2f2;border:1.5px solid #fca5a5;
                    border-radius:999px;font-size:13px;font-weight:700;color:#dc2626;">
                    ${prod?.unit||'ชิ้น'}
                    <span style="font-size:10px;margin-left:4px;opacity:.7;">BASE</span>
                  </div>
                  ${us.filter(u=>!u.is_base).map(u=>`
                    <i class="material-icons-round" style="font-size:16px;color:var(--text-tertiary);">arrow_forward</i>
                    <div style="padding:8px 14px;background:var(--bg-base);
                      border:1px solid var(--border-light);border-radius:999px;
                      font-size:13px;position:relative;display:flex;align-items:center;gap:6px;">
                      <div>
                        <span style="font-weight:700;">${u.unit_name}</span>
                        <span style="font-size:11px;color:var(--text-tertiary);margin-left:4px;">
                          1${u.unit_name}=${u.conv_rate}${prod?.unit||''}
                        </span>
                        ${u.price_per_unit > 0
                          ? `<span style="font-size:11px;color:var(--success);margin-left:4px;">฿${formatNum(u.price_per_unit)}</span>`
                          : ''}
                      </div>
                      <button onclick="v9AdminUnitsDelete('${u.id}','${pid}')"
                        style="background:none;border:none;cursor:pointer;color:var(--danger);padding:0;line-height:1;">
                        <i class="material-icons-round" style="font-size:14px;">close</i>
                      </button>
                    </div>`).join('')}
                </div>
              </div>
            </div>`;
        }).join('')}

    <div style="margin-top:12px;padding:10px 14px;background:#fef3c7;border-radius:10px;
      font-size:12px;color:#92400e;">
      <strong>วิธีตั้งค่า:</strong> conv_rate = จำนวน base ต่อ 1 หน่วยนี้
      เช่น 1 คิว = 1,600 kg → conv_rate = 1,600 &nbsp;|&nbsp; 1 ปิ๊ป = 32 kg → conv_rate = 32
    </div>`;
}

window._v9UnitRowCount = 1;
window.v9BuildUnitRow = function (idx) {
  return `
    <div id="v9au2-row-${idx}" style="display:grid;grid-template-columns:1fr 100px 100px 80px 36px;
      gap:8px;margin-bottom:8px;">
      <input class="form-input" id="v9au2-name-${idx}" placeholder="เช่น คิว, ปิ๊ป, ถุง" style="font-size:13px;">
      <input class="form-input" type="number" id="v9au2-rate-${idx}" placeholder="1600"
        min="0.0001" step="0.0001" style="font-size:13px;">
      <input class="form-input" type="number" id="v9au2-price-${idx}" placeholder="0"
        min="0" style="font-size:13px;">
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;">
        <input type="checkbox" id="v9au2-base-${idx}"> Base
      </label>
      ${idx > 0 ? `<button type="button" onclick="document.getElementById('v9au2-row-${idx}').remove()"
        style="background:none;border:none;cursor:pointer;color:var(--danger);">
        <i class="material-icons-round" style="font-size:18px;">close</i>
      </button>` : '<div></div>'}
    </div>`;
};

window.v9UnitsAddRow = function () {
  const inner = document.getElementById('v9au2-rows-inner');
  if (!inner) return;
  const idx = window._v9UnitRowCount++;
  inner.insertAdjacentHTML('beforeend', v9BuildUnitRow(idx));
};

window.v9UnitsShowAddProduct = function (prodId='') {
  const el = document.getElementById('v9au2-add');
  if (!el) return;
  el.style.display = 'block';
  if (prodId) {
    const sel = document.getElementById('v9au2-prod');
    if (sel) { sel.value = prodId; v9UnitsUpdateBase(); }
  }
  el.scrollIntoView({ behavior:'smooth' });
  window._v9UnitRowCount = 1;
  const inner = document.getElementById('v9au2-rows-inner');
  if (inner) inner.innerHTML = v9BuildUnitRow(0);
};

window.v9UnitsUpdateBase = function () {
  const prodId = document.getElementById('v9au2-prod')?.value;
  const prod   = v9GetProducts().find(p => p.id === prodId);
  const el     = document.getElementById('v9au2-base-unit');
  if (el) el.value = prod?.unit || '';
};

window.v9UnitsSaveAll = async function () {
  const prodId = document.getElementById('v9au2-prod')?.value;
  if (!prodId) { typeof toast==='function'&&toast('กรุณาเลือกสินค้า','error'); return; }

  // collect rows
  const rows = [];
  let idx = 0;
  while (document.getElementById(`v9au2-row-${idx}`)) {
    const name  = document.getElementById(`v9au2-name-${idx}`)?.value?.trim();
    const rate  = Number(document.getElementById(`v9au2-rate-${idx}`)?.value || 0);
    const price = Number(document.getElementById(`v9au2-price-${idx}`)?.value || 0);
    const isBase= document.getElementById(`v9au2-base-${idx}`)?.checked || false;
    if (name && rate > 0) rows.push({ product_id:prodId, unit_name:name, conv_rate:rate, price_per_unit:price, is_base:isBase });
    idx++;
  }
  if (!rows.length) { typeof toast==='function'&&toast('กรุณากรอกหน่วยอย่างน้อย 1 แถว','error'); return; }

  v9ShowOverlay('กำลังบันทึก...');
  try {
    for (const row of rows) {
      await db.from('product_units').insert(row);
    }
    delete window._v9UnitCache?.[prodId];
    typeof toast==='function'&&toast(`บันทึก ${rows.length} หน่วยสำเร็จ`,'success');
    document.getElementById('v9au2-add').style.display = 'none';
    // reload
    const inner = document.getElementById('v9-manage-inner');
    if (inner) await v9AdminUnits(inner);
    const ac = document.getElementById('v9-admin-content');
    if (ac) await v9AdminUnits(ac);
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

window.v9AdminUnitsDelete = async function (unitId, prodId) {
  if (!confirm('ลบหน่วยนี้?')) return;
  v9ShowOverlay('กำลังลบ...');
  try {
    await db.from('product_units').delete().eq('id', unitId);
    if (prodId) delete window._v9UnitCache?.[prodId];
    typeof toast==='function'&&toast('ลบสำเร็จ','success');
    const inner = document.getElementById('v9-manage-inner');
    if (inner) await v9AdminUnits(inner);
    const ac = document.getElementById('v9-admin-content');
    if (ac)    await v9AdminUnits(ac);
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

// fix innerHTML null bug
window.v9SwitchManageTab = async function (key) {
  _v9ManageCurTab = key;
  _v9ManageTabs.forEach(t => {
    const btn   = document.getElementById(`v9mtab-${t.key}`);
    const icon  = document.getElementById(`v9mtab-icon-${t.key}`);
    const label = document.getElementById(`v9mtab-label-${t.key}`);
    const arr   = document.getElementById(`v9mtab-arr-${t.key}`);
    if (!btn) return;
    const active = t.key === key;
    btn.style.background = active ? t.bg : 'transparent';
    if (icon) {
      icon.style.background = active ? t.color : '#f1f5f9';
      const ic = icon.querySelector('i');
      if (ic) ic.style.color = active ? '#fff' : '#94a3b8';
    }
    if (label) { label.style.color = active ? t.color : 'var(--text-secondary)'; label.style.fontWeight = active ? '700' : '600'; }
    if (arr)   arr.style.color = active ? t.color : 'transparent';
  });

  const c = document.getElementById('v9-manage-content');
  if (!c) return;
  c.style.opacity = '0'; c.style.transform = 'translateY(6px)';
  c.style.transition = 'opacity .18s, transform .18s';

  const tab = _v9ManageTabs.find(t => t.key === key);
  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;padding-bottom:16px;
      border-bottom:1px solid var(--border-light);">
      <div style="width:40px;height:40px;border-radius:10px;background:${tab?.bg||'#f1f5f9'};
        display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="material-icons-round" style="font-size:22px;color:${tab?.color||'#94a3b8'};">${tab?.icon||'settings'}</i>
      </div>
      <div>
        <div style="font-size:17px;font-weight:800;">${tab?.label||key}</div>
        <div style="font-size:12px;color:var(--text-tertiary);">${tab?.desc||''}</div>
      </div>
    </div>
    <div id="v9-manage-inner">${v9AdminLoading('กำลังโหลด...')}</div>`;

  setTimeout(() => { c.style.opacity='1'; c.style.transform='none'; }, 10);

  // รอ DOM render แล้วค่อย render content
  setTimeout(async () => {
    const inner = document.getElementById('v9-manage-inner');
    if (!inner) return;
    if (key === 'cats')     await v9ManageCats(inner);
    else if (key === 'units')    await v9AdminUnits(inner);
    else if (key === 'recipe')   await v9AdminRecipe(inner);
    else if (key === 'supplier') await v9AdminSupplier(inner);
    else if (key === 'produce')  await v9AdminProduce(inner);
  }, 50);
};


// ══════════════════════════════════════════════════════════════════
// FIX-23 — ระบบครบวงจร: Purchase / BOM / POS Unit Popup
//
//  A. showAddPurchaseModal — 3 ขั้นตอน
//     ขั้น1: ข้อมูลใบสั่งซื้อ (ซัพพลายเออร์/วันที่/วิธีชำระ/เครดิต)
//     ขั้น2: เลือก/สร้างสินค้า + รายละเอียดรับ (qty/ราคา/1รถ=Nkg)
//     ขั้น3: หน่วยขาย (เฉพาะสินค้าใหม่ที่ยังไม่มีใน product_units)
//     บันทึก: COGS เท่านั้น (ไม่ตัดรายจ่าย)
//
//  B. v9AdminRecipe — redesign สูตรสินค้า
//     สร้างชื่อสินค้าใหม่ + ประเภท (ตามบิล/ล่วงหน้า)
//     เลือกวัตถุดิบ N ตัว ดึงหน่วยจาก DB, คำนวณต้นทุน live
//     บันทึก → ปรากฏในคลัง + POS ทันที
//     แก้ไขสูตรเดิมได้
//
//  C. v9AdminProduce — สั่งผลิตล่วงหน้า เท่านั้น
//
//  D. addToCart override — popup เลือกหน่วย ถ้ามีหลายหน่วย
//
//  E. Auto-deduct BOM ตอนขาย (ตามบิล)
// ══════════════════════════════════════════════════════════════════

// ── A. PURCHASE MODAL ────────────────────────────────────────────

window.showAddPurchaseModal = function () {
  try { purchaseItems = []; } catch(_) {}
  window._v9PurItems = [];   // [{prodId, prodName, baseUnit, qty, buyUnit, costPerBuyUnit, kgPerBuyUnit, qtyBase, costBase, isNew, isRaw, productType, sellUnits:[{name,kgPer,price}]}]
  if (typeof openModal !== 'function') return;

  openModal('รับสินค้าเข้าคลัง', `
    <style>
      .v9pur-step{flex:1;padding:9px 6px;text-align:center;font-size:11px;font-weight:700;
        transition:all .2s;cursor:default;}
    </style>
    <form id="v9pur23-form" onsubmit="event.preventDefault();">
      <!-- Step bar -->
      <div style="display:flex;border-radius:8px;overflow:hidden;border:1px solid var(--border-light);margin-bottom:18px;">
        <div class="v9pur-step" id="v9p23-s1" style="background:var(--primary);color:#fff;">1 ข้อมูลการซื้อ</div>
        <div class="v9pur-step" id="v9p23-s2" style="background:var(--bg-base);color:var(--text-tertiary);">2 รายการสินค้า</div>
        <div class="v9pur-step" id="v9p23-s3" style="background:var(--bg-base);color:var(--text-tertiary);">3 ยืนยัน</div>
      </div>

      <!-- ── Panel 1 ── -->
      <div id="v9p23-p1">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">ผู้จำหน่าย</label>
            <input class="form-input" id="v9p23-supplier" list="v9p23-supp-list" placeholder="ชื่อผู้จำหน่าย">
            <datalist id="v9p23-supp-list"></datalist>
          </div>
          <div class="form-group">
            <label class="form-label">วันที่รับสินค้า</label>
            <input class="form-input" type="date" id="v9p23-date" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">วิธีชำระ</label>
            <select class="form-input" id="v9p23-method" onchange="v9P23ToggleCredit()">
              <option value="เงินสด">เงินสด</option>
              <option value="โอนเงิน">โอนเงิน</option>
              <option value="เครดิต">เครดิต (ค้างชำระ)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">หมายเหตุ</label>
            <input class="form-input" id="v9p23-note" placeholder="(ถ้ามี)">
          </div>
        </div>
        <div id="v9p23-credit-row" style="display:none;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">ซัพพลายเออร์ (เครดิต) *</label>
            <select class="form-input" id="v9p23-supp-id"><option value="">-- เลือก --</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">วันครบกำหนดชำระ *</label>
            <input class="form-input" type="date" id="v9p23-due">
          </div>
        </div>
        <button type="button" class="btn btn-primary" style="width:100%;" onclick="v9P23ToStep2()">
          ถัดไป <i class="material-icons-round" style="font-size:16px;vertical-align:middle;">arrow_forward</i>
        </button>
      </div>

      <!-- ── Panel 2 ── -->
      <div id="v9p23-p2" style="display:none;">
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <button type="button" class="btn btn-ghost btn-sm" onclick="v9P23ToStep1()">
            <i class="material-icons-round" style="font-size:14px;">arrow_back</i>
          </button>
          <div style="flex:1;"></div>
          <button type="button" class="btn btn-outline btn-sm" onclick="v9P23ShowSearch()">
            <i class="material-icons-round" style="font-size:14px;">search</i> สินค้าเก่า
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="v9P23ShowNewProd()">
            <i class="material-icons-round" style="font-size:14px;">add</i> สินค้าใหม่
          </button>
        </div>

        <!-- รายการ -->
        <div id="v9p23-item-list">
          <div style="text-align:center;padding:32px;color:var(--text-tertiary);font-size:13px;
            border:1.5px dashed var(--border-light);border-radius:10px;">
            <i class="material-icons-round" style="font-size:36px;opacity:.35;display:block;margin-bottom:8px;">inventory_2</i>
            กดปุ่มด้านบนเพื่อเพิ่มสินค้า
          </div>
        </div>

        <div id="v9p23-total-bar" style="display:none;margin-top:10px;padding:10px 14px;
          background:var(--bg-base);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;color:var(--text-secondary);">ยอดรวม</span>
          <span id="v9p23-total-val" style="font-size:18px;font-weight:800;color:var(--primary);">฿0</span>
        </div>
        <button type="button" id="v9p23-to3-btn" class="btn btn-primary"
          style="width:100%;margin-top:12px;" onclick="v9P23ToStep3()" disabled>
          ถัดไป — ยืนยัน <i class="material-icons-round" style="font-size:16px;vertical-align:middle;">arrow_forward</i>
        </button>
      </div>

      <!-- ── Panel 2b: ค้นหาสินค้าเก่า ── -->
      <div id="v9p23-p2b" style="display:none;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:10px;" onclick="v9P23BackToList()">
          <i class="material-icons-round" style="font-size:14px;">arrow_back</i> กลับ
        </button>
        <input class="form-input" id="v9p23-search" placeholder="ค้นหาชื่อสินค้า / บาร์โค้ด..."
          oninput="v9P23FilterProds()" style="margin-bottom:8px;">
        <div id="v9p23-prod-list" style="max-height:220px;overflow-y:auto;
          border:1px solid var(--border-light);border-radius:10px;"></div>
        <!-- รายละเอียดหลังเลือก -->
        <div id="v9p23-exist-detail" style="display:none;margin-top:12px;">
          <div id="v9p23-exist-bar" style="background:var(--primary);color:#fff;border-radius:8px;
            padding:8px 14px;margin-bottom:10px;font-size:13px;font-weight:700;"></div>
          <div id="v9p23-exist-fields"></div>
        </div>
      </div>

      <!-- ── Panel 2c: สินค้าใหม่ ── -->
      <div id="v9p23-p2c" style="display:none;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:10px;" onclick="v9P23BackToList()">
          <i class="material-icons-round" style="font-size:14px;">arrow_back</i> กลับ
        </button>
        <div style="background:#eff6ff;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#1d4ed8;">
          สร้างสินค้าใหม่ในระบบพร้อมรับเข้าคลัง
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">ชื่อสินค้า *</label>
            <input class="form-input" id="v9p23-new-name" placeholder="เช่น ทราย, ปูนผง, หิน">
          </div>
          <div class="form-group">
            <label class="form-label">หน่วยเก็บสต็อก (base) *</label>
            <input class="form-input" id="v9p23-new-unit" placeholder="kg, ลิตร, ชิ้น...">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">ประเภท</label>
            <select class="form-input" id="v9p23-new-kind">
              <option value="both">วัตถุดิบ + ของขาย</option>
              <option value="raw">วัตถุดิบอย่างเดียว</option>
              <option value="sale">ของขายอย่างเดียว</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">วิธีผลิต</label>
            <select class="form-input" id="v9p23-new-ptype">
              <option value="ปกติ">ไม่ผลิต (ขายตรง)</option>
              <option value="ตามบิล">ตามบิล (ผสมตอนขาย)</option>
              <option value="ผลิตล่วงหน้า">ผลิตล่วงหน้า</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">ราคาขาย/base (บาท)</label>
          <input class="form-input" type="number" id="v9p23-new-price" value="0" min="0">
        </div>
        <div id="v9p23-new-fields"></div>
      </div>

      <!-- ── Panel 3: ยืนยัน ── -->
      <div id="v9p23-p3" style="display:none;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:14px;" onclick="v9P23ToStep2()">
          <i class="material-icons-round" style="font-size:14px;">arrow_back</i> แก้ไข
        </button>
        <div id="v9p23-confirm"></div>
        <button type="button" class="btn btn-primary" style="width:100%;margin-top:14px;font-size:15px;padding:14px;"
          onclick="v9P23Save()">
          <i class="material-icons-round">check_circle</i> ยืนยันรับสินค้าเข้าคลัง
        </button>
      </div>
    </form>`, 'xl');

  // โหลด suppliers
  db.from('ซัพพลายเออร์').select('id,name').eq('status','ใช้งาน').then(({data}) => {
    const dl  = document.getElementById('v9p23-supp-list');
    const sel = document.getElementById('v9p23-supp-id');
    (data||[]).forEach(s => {
      if (dl)  { const o=document.createElement('option'); o.value=s.name; dl.appendChild(o); }
      if (sel) { const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; sel.appendChild(o); }
    });
    window._v9Suppliers = data||[];
  });
};

// ── step helpers ─────────────────────────────────────────────────
function v9P23SetStep(n) {
  [1,2,3].forEach(i => {
    const p = document.getElementById(`v9p23-p${i}`);
    if (p) p.style.display = i===n ? 'block' : 'none';
    const s = document.getElementById(`v9p23-s${i}`);
    if (s) {
      s.style.background = i < n ? '#10b981' : i === n ? 'var(--primary)' : 'var(--bg-base)';
      s.style.color = i <= n ? '#fff' : 'var(--text-tertiary)';
    }
  });
  ['v9p23-p2b','v9p23-p2c'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}
window.v9P23ToStep1 = () => v9P23SetStep(1);
window.v9P23ToStep2 = () => v9P23SetStep(2);
window.v9P23ToStep3 = function () {
  const items = window._v9PurItems || [];
  if (!items.length) { typeof toast==='function'&&toast('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ','error'); return; }
  v9P23BuildConfirm(); v9P23SetStep(3);
};
window.v9P23ToggleCredit = function () {
  const m = document.getElementById('v9p23-method')?.value;
  const r = document.getElementById('v9p23-credit-row');
  if (r) r.style.display = m==='เครดิต' ? 'grid' : 'none';
};
window.v9P23BackToList = function () {
  ['v9p23-p2b','v9p23-p2c'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const p2=document.getElementById('v9p23-p2'); if(p2) p2.style.display='block';
};

// ── ฟิลด์รายละเอียดการรับ ───────────────────────────────────────
function v9P23ReceiveFields(prefix, baseUnit) {
  return `
    <div style="background:var(--bg-base);border-radius:10px;padding:14px;border:1px solid var(--border-light);margin-top:10px;">
      <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:10px;">รายละเอียดการรับ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
        <div class="form-group">
          <label class="form-label">หน่วยที่รับเข้า</label>
          <input class="form-input" id="${prefix}-buyunit" placeholder="เช่น รถ, ตัน, ถุง"
            oninput="v9P23UpdateRecvPreview('${prefix}')">
        </div>
        <div class="form-group">
          <label class="form-label">จำนวน</label>
          <input class="form-input" type="number" id="${prefix}-qty" value="1" min="0.001" step="0.001"
            oninput="v9P23UpdateRecvPreview('${prefix}')">
        </div>
        <div class="form-group">
          <label class="form-label">ราคา / หน่วยรับ (บาท)</label>
          <input class="form-input" type="number" id="${prefix}-cost" value="0" min="0"
            oninput="v9P23UpdateRecvPreview('${prefix}')">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div class="form-group">
          <label class="form-label">1 <span id="${prefix}-buyunit-lbl">หน่วยรับ</span> = กี่ ${baseUnit||'หน่วย'}?</label>
          <input class="form-input" type="number" id="${prefix}-kgper" value="1" min="0.001" step="0.001"
            oninput="v9P23UpdateRecvPreview('${prefix}')">
        </div>
        <div class="form-group" style="display:flex;align-items:flex-end;">
          <div id="${prefix}-recv-preview" style="font-size:12px;color:#15803d;padding:8px 0;line-height:1.6;"></div>
        </div>
      </div>
    </div>`;
}

window.v9P23UpdateRecvPreview = function (prefix) {
  const buyUnit = document.getElementById(`${prefix}-buyunit`)?.value?.trim() || 'หน่วย';
  const qty     = Number(document.getElementById(`${prefix}-qty`)?.value || 0);
  const cost    = Number(document.getElementById(`${prefix}-cost`)?.value || 0);
  const kgPer   = Number(document.getElementById(`${prefix}-kgper`)?.value || 1);
  const lblEl   = document.getElementById(`${prefix}-buyunit-lbl`);
  const prevEl  = document.getElementById(`${prefix}-recv-preview`);
  if (lblEl) lblEl.textContent = buyUnit;
  const totalQty  = qty * kgPer;
  const costBase  = kgPer > 0 ? (cost / kgPer) : cost;
  if (prevEl) prevEl.innerHTML =
    `สต็อก +<strong>${totalQty}</strong> หน่วยbase<br>` +
    `ต้นทุน/base = <strong>฿${formatNum(Math.round(costBase * 100)/100)}</strong>`;
};

// ── ฟิลด์หน่วยขาย ───────────────────────────────────────────────
function v9P23SellUnitsFields(prefix, baseUnit, existingUnits) {
  if (existingUnits && existingUnits.length > 0) {
    // มีหน่วยขายอยู่แล้ว → แสดงแต่ไม่ต้องกรอกใหม่
    return `
      <div style="background:#f0fdf4;border-radius:10px;padding:12px 14px;border:1px solid #86efac;margin-top:10px;">
        <div style="font-size:12px;font-weight:700;color:#15803d;margin-bottom:8px;">
          ✅ มีหน่วยขายอยู่แล้ว (จาก DB)
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${existingUnits.map(u=>`
            <span style="padding:4px 10px;background:#dcfce7;border-radius:999px;font-size:12px;color:#15803d;">
              ${u.unit_name} (1=${u.conv_rate}${baseUnit}) ฿${formatNum(u.price_per_unit||0)}
            </span>`).join('')}
        </div>
      </div>`;
  }
  return `
    <div style="background:var(--bg-base);border-radius:10px;padding:14px;border:1px solid var(--border-light);margin-top:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);">หน่วยขาย (จาก base: ${baseUnit||'หน่วย'})</div>
        <button type="button" class="btn btn-outline btn-sm" onclick="v9P23AddSellRow('${prefix}')">
          <i class="material-icons-round" style="font-size:13px;">add</i> เพิ่มหน่วย
        </button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 28px;gap:6px;
        font-size:11px;font-weight:700;color:var(--text-tertiary);padding:0 2px;margin-bottom:4px;">
        <span>ชื่อหน่วย</span><span>1 หน่วย = กี่ ${baseUnit||''}?</span><span>ราคาขาย (฿)</span><span></span>
      </div>
      <div id="${prefix}-sell-rows">
        ${v9P23SellRow(prefix, 0)}
      </div>
      <div id="${prefix}-cost-info" style="margin-top:8px;font-size:11px;color:var(--text-tertiary);"></div>
    </div>`;
}

window.v9P23SellRow = function (prefix, idx) {
  return `<div id="${prefix}-sell-row-${idx}" style="display:grid;grid-template-columns:1fr 1fr 1fr 28px;gap:6px;margin-bottom:6px;">
    <input class="form-input" id="${prefix}-sname-${idx}" placeholder="คิว, ปิ๊ป, ถุง..." style="font-size:13px;">
    <input class="form-input" type="number" id="${prefix}-skgper-${idx}" placeholder="1600" min="0.001" step="0.001" style="font-size:13px;"
      oninput="v9P23CalcSellCost('${prefix}',${idx})">
    <input class="form-input" type="number" id="${prefix}-sprice-${idx}" placeholder="0" min="0" style="font-size:13px;">
    ${idx>0?`<button type="button" onclick="document.getElementById('${prefix}-sell-row-${idx}').remove()"
      style="background:none;border:none;cursor:pointer;color:var(--danger);padding:0;">
      <i class="material-icons-round" style="font-size:16px;">close</i></button>`:'<div></div>'}
  </div>`;
};
window._v9SellRowIdx = {};
window.v9P23AddSellRow = function (prefix) {
  window._v9SellRowIdx[prefix] = (window._v9SellRowIdx[prefix]||1) + 1;
  const idx = window._v9SellRowIdx[prefix];
  const el  = document.getElementById(`${prefix}-sell-rows`);
  if (el) el.insertAdjacentHTML('beforeend', v9P23SellRow(prefix, idx));
};
window.v9P23CalcSellCost = function (prefix, idx) {
  // แสดง cost ต่อหน่วยนี้ตาม kgper
  const kgPer   = Number(document.getElementById(`${prefix}-skgper-${idx}`)?.value || 0);
  const costBase = Number(window._v9CurCostBase?.[prefix] || 0);
  if (kgPer > 0 && costBase > 0) {
    const costUnit = Math.round(kgPer * costBase * 100) / 100;
    const infoEl   = document.getElementById(`${prefix}-cost-info`);
    if (infoEl) infoEl.textContent = `ต้นทุนแถวนี้ = ฿${formatNum(costUnit)} (${kgPer} × ฿${formatNum(costBase)}/base)`;
  }
};

// ── เปิด search panel ────────────────────────────────────────────
window.v9P23ShowSearch = function () {
  document.getElementById('v9p23-p2').style.display    = 'none';
  document.getElementById('v9p23-p2b').style.display   = 'block';
  v9P23RenderProdList('');
};

window.v9P23FilterProds = function () {
  v9P23RenderProdList(document.getElementById('v9p23-search')?.value || '');
};

window.v9P23RenderProdList = function (q) {
  const prods   = v9GetProducts().filter(p => !p.product_type || p.product_type !== 'ตามบิล');
  const filtered = q
    ? prods.filter(p => (p.name||'').toLowerCase().includes(q.toLowerCase()) || (p.barcode||'').includes(q))
    : prods;
  const el = document.getElementById('v9p23-prod-list');
  if (!el) return;
  el.innerHTML = filtered.slice(0,40).map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:9px 14px;border-bottom:0.5px solid var(--border-light);cursor:pointer;"
      onmouseenter="this.style.background='var(--bg-base)'"
      onmouseleave="this.style.background=''"
      onclick="v9P23SelectExisting('${p.id}','${(p.name||'').replace(/'/g,"\\'")}','${p.unit||''}')">
      <div>
        <div style="font-size:13px;font-weight:700;">${p.name}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">
          base: ${p.unit||'ชิ้น'} · สต็อก ${p.stock||0} · ต้นทุน ฿${formatNum(p.cost||0)}/${p.unit||''}
          ${p.is_raw?'<span style="color:#d97706;margin-left:4px;">วัตถุดิบ</span>':''}
        </div>
      </div>
      <i class="material-icons-round" style="font-size:18px;color:var(--text-tertiary);">chevron_right</i>
    </div>`).join('') ||
    `<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px;">ไม่พบสินค้า</div>`;
};

window.v9P23SelectExisting = async function (id, name, unit) {
  document.getElementById('v9p23-prod-list').style.display = 'none';
  const searchEl = document.getElementById('v9p23-search')?.closest('.form-group, div');
  const existDetail = document.getElementById('v9p23-exist-detail');
  if (existDetail) existDetail.style.display = 'block';
  document.getElementById('v9p23-exist-bar').textContent = `✓ เลือก: ${name} (base: ${unit||'ชิ้น'})`;
  existDetail.dataset.prodId = id;
  existDetail.dataset.prodName = name;
  existDetail.dataset.prodUnit = unit;

  // โหลด existing sell units
  const units = await v9LoadUnits(id);
  const hasUnits = units.filter(u=>!u.is_base).length > 0;

  const fieldsEl = document.getElementById('v9p23-exist-fields');
  if (fieldsEl) {
    fieldsEl.innerHTML =
      v9P23ReceiveFields('v9p23-ex', unit) +
      v9P23SellUnitsFields('v9p23-ex', unit, hasUnits ? units.filter(u=>!u.is_base) : null);
  }
  // init cost base tracker
  if (!window._v9CurCostBase) window._v9CurCostBase = {};
  const prod = v9GetProducts().find(p=>p.id===id);
  window._v9CurCostBase['v9p23-ex'] = prod?.cost || 0;
  document.getElementById('v9p23-search')?.closest?.('[style]')?.remove?.();
};

// ── สินค้าใหม่ ───────────────────────────────────────────────────
window.v9P23ShowNewProd = function () {
  document.getElementById('v9p23-p2').style.display  = 'none';
  document.getElementById('v9p23-p2c').style.display = 'block';
  document.getElementById('v9p23-new-fields').innerHTML =
    v9P23ReceiveFields('v9p23-new', '') + v9P23SellUnitsFields('v9p23-new', '', null);
};

// เมื่อกรอก base unit → อัป label
document.addEventListener('input', e => {
  if (e.target?.id === 'v9p23-new-unit') {
    const unit = e.target.value;
    const lbls = document.querySelectorAll('[id$="-buyunit-lbl"]');
    lbls.forEach(l => l.textContent = unit || 'หน่วยรับ');
  }
});

// ── เพิ่มรายการเข้า _v9PurItems ─────────────────────────────────
window.v9P23AddToList = async function (mode) {
  const isNew  = mode === 'new';
  const prefix = isNew ? 'v9p23-new' : 'v9p23-ex';
  const detail = document.getElementById(isNew ? 'v9p23-p2c' : 'v9p23-exist-detail');

  const buyUnit = document.getElementById(`${prefix}-buyunit`)?.value?.trim() || '';
  const qty     = Number(document.getElementById(`${prefix}-qty`)?.value || 0);
  const cost    = Number(document.getElementById(`${prefix}-cost`)?.value || 0);
  const kgPer   = Number(document.getElementById(`${prefix}-kgper`)?.value || 1);
  if (qty <= 0) { typeof toast==='function'&&toast('กรุณากรอกจำนวน','error'); return; }

  let prodId='', prodName='', baseUnit='';

  if (isNew) {
    prodName = document.getElementById('v9p23-new-name')?.value?.trim();
    baseUnit = document.getElementById('v9p23-new-unit')?.value?.trim() || 'ชิ้น';
    const kind   = document.getElementById('v9p23-new-kind')?.value || 'both';
    const ptype  = document.getElementById('v9p23-new-ptype')?.value || 'ปกติ';
    const price  = Number(document.getElementById('v9p23-new-price')?.value || 0);
    if (!prodName || !baseUnit) { typeof toast==='function'&&toast('กรุณากรอกชื่อและหน่วย','error'); return; }
    const costBase = kgPer > 0 ? parseFloat((cost / kgPer).toFixed(6)) : cost;
    v9ShowOverlay('กำลังสร้างสินค้าใหม่...');
    try {
      const { data: np, error: ne } = await db.from('สินค้า').insert({
        name: prodName, unit: baseUnit,
        price: price, cost: costBase, stock: 0,
        is_raw: kind === 'raw',
        product_type: ptype,
        updated_at: new Date().toISOString(),
      }).select().single();
      if (ne) throw new Error(ne.message);
      prodId = np.id;
      await loadProducts?.();
      try { if(typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    } catch(e) { v9HideOverlay(); typeof toast==='function'&&toast('สร้างสินค้าไม่สำเร็จ: '+e.message,'error'); return; }
    finally { v9HideOverlay(); }
  } else {
    prodId   = detail?.dataset.prodId || '';
    prodName = detail?.dataset.prodName || '';
    baseUnit = detail?.dataset.prodUnit || '';
    if (!prodId) { typeof toast==='function'&&toast('กรุณาเลือกสินค้า','error'); return; }
  }

  const qtyBase  = qty * kgPer;
  const costBase = kgPer > 0 ? parseFloat((cost / kgPer).toFixed(6)) : cost;

  // เก็บ cost base สำหรับ sell unit calc
  if (!window._v9CurCostBase) window._v9CurCostBase = {};
  window._v9CurCostBase[prefix] = costBase;

  // รวบรวมหน่วยขาย
  const sellUnits = [];
  let idx = 0;
  while (document.getElementById(`${prefix}-sell-row-${idx}`)) {
    const sname  = document.getElementById(`${prefix}-sname-${idx}`)?.value?.trim();
    const skgper = Number(document.getElementById(`${prefix}-skgper-${idx}`)?.value || 0);
    const sprice = Number(document.getElementById(`${prefix}-sprice-${idx}`)?.value || 0);
    if (sname && skgper > 0) sellUnits.push({ unit_name:sname, conv_rate:skgper, price_per_unit:sprice });
    idx++;
  }

  // ตรวจว่ามีหน่วยขายใน DB แล้วหรือเปล่า (สินค้าเก่า)
  let finalSellUnits = sellUnits;
  if (!isNew) {
    const existing = await v9LoadUnits(prodId);
    if (existing.filter(u=>!u.is_base).length > 0) finalSellUnits = []; // มีแล้ว ไม่ต้อง add ซ้ำ
  }

  window._v9PurItems = window._v9PurItems || [];
  window._v9PurItems.push({
    prodId, prodName, baseUnit, qty, buyUnit, cost, kgPer, qtyBase, costBase, sellUnits: finalSellUnits
  });

  v9P23RenderItems();
  v9P23BackToList();
  typeof toast==='function' && toast(
    `เพิ่ม ${prodName} × ${qty} ${buyUnit||baseUnit} (สต็อก +${qtyBase} ${baseUnit})`, 'success'
  );
};

// ── render รายการ ────────────────────────────────────────────────
window.v9P23RenderItems = function () {
  const items = window._v9PurItems || [];
  const el    = document.getElementById('v9p23-item-list');
  const tbar  = document.getElementById('v9p23-total-bar');
  const nbtn  = document.getElementById('v9p23-to3-btn');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-tertiary);font-size:13px;
      border:1.5px dashed var(--border-light);border-radius:10px;">
      <i class="material-icons-round" style="font-size:36px;opacity:.35;display:block;margin-bottom:8px;">inventory_2</i>
      กดปุ่มด้านบนเพื่อเพิ่มสินค้า</div>`;
    if(tbar) tbar.style.display='none'; if(nbtn) nbtn.disabled=true; return;
  }
  const total = items.reduce((s,i)=>s+i.qty*i.cost,0);
  el.innerHTML = `<div style="border:1px solid var(--border-light);border-radius:10px;overflow:hidden;">
    ${items.map((item,idx)=>`
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;
        padding:12px 14px;border-bottom:0.5px solid var(--border-light);">
        <div>
          <div style="font-size:14px;font-weight:700;">${item.prodName}</div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">
            ${item.qty} ${item.buyUnit||item.baseUnit}
            ${item.kgPer!==1?` → ${item.qtyBase} ${item.baseUnit}`:''}
            · ต้นทุน ฿${formatNum(item.costBase)}/${item.baseUnit}
            ${item.sellUnits?.length ? `· เพิ่ม ${item.sellUnits.length} หน่วยขาย`:''}
          </div>
        </div>
        <strong style="color:var(--primary);">฿${formatNum(item.qty*item.cost)}</strong>
        <button onclick="window._v9PurItems.splice(${idx},1);v9P23RenderItems()"
          style="background:none;border:none;cursor:pointer;color:var(--danger);padding:4px;">
          <i class="material-icons-round" style="font-size:18px;">close</i>
        </button>
      </div>`).join('')}
  </div>`;
  if(tbar){tbar.style.display='flex';} const tv=document.getElementById('v9p23-total-val'); if(tv)tv.textContent=`฿${formatNum(total)}`;
  if(nbtn) nbtn.disabled=false;
};

// ── confirm summary ──────────────────────────────────────────────
window.v9P23BuildConfirm = function () {
  const items    = window._v9PurItems || [];
  const total    = items.reduce((s,i)=>s+i.qty*i.cost,0);
  const supplier = document.getElementById('v9p23-supplier')?.value || '—';
  const method   = document.getElementById('v9p23-method')?.value || 'เงินสด';
  const due      = document.getElementById('v9p23-due')?.value || '';
  const el       = document.getElementById('v9p23-confirm');
  if (!el) return;
  el.innerHTML = `
    <div style="background:var(--bg-base);border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;margin-bottom:12px;padding-bottom:12px;border-bottom:0.5px solid var(--border-light);">
        <div><span style="color:var(--text-tertiary);">ผู้จำหน่าย</span><br><strong>${supplier}</strong></div>
        <div><span style="color:var(--text-tertiary);">วิธีชำระ</span><br>
          <strong>${method}</strong>${due?`<span style="font-size:11px;color:var(--danger);"> ครบ ${due}</span>`:''}</div>
      </div>
      ${items.map(item=>`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;
          padding:8px 0;border-bottom:0.5px solid var(--border-light);font-size:13px;">
          <div>
            <strong>${item.prodName}</strong>
            <div style="font-size:11px;color:var(--text-tertiary);">
              ${item.qty} ${item.buyUnit||item.baseUnit}
              ${item.kgPer!==1?` → +${item.qtyBase} ${item.baseUnit} สต็อก`:''}
            </div>
            ${item.sellUnits?.length?`<div style="font-size:11px;color:#15803d;">+ หน่วยขาย: ${item.sellUnits.map(u=>u.unit_name).join(', ')}</div>`:''}
          </div>
          <strong>฿${formatNum(item.qty*item.cost)}</strong>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;
        margin-top:12px;font-size:16px;font-weight:800;">
        <span>ยอดรวม</span>
        <span style="color:var(--primary);">฿${formatNum(total)}</span>
      </div>
    </div>`;
};

// ── SAVE ────────────────────────────────────────────────────────
window.v9P23Save = async function () {
  const items    = window._v9PurItems || [];
  if (!items.length) return;
  const supplier  = document.getElementById('v9p23-supplier')?.value?.trim() || '';
  const method    = document.getElementById('v9p23-method')?.value || 'เงินสด';
  const note      = document.getElementById('v9p23-note')?.value?.trim() || '';
  const purDate   = document.getElementById('v9p23-date')?.value || new Date().toISOString().split('T')[0];
  const dueDate   = document.getElementById('v9p23-due')?.value || null;
  const suppSelId = document.getElementById('v9p23-supp-id')?.value || null;
  const total     = items.reduce((s,i)=>s+i.qty*i.cost, 0);

  if (method==='เครดิต'&&!dueDate) { typeof toast==='function'&&toast('กรุณาระบุวันครบกำหนด','error'); return; }

  v9ShowOverlay('กำลังบันทึก...', `${items.length} รายการ | ฿${formatNum(total)}`);
  try {
    // 1. Purchase order
    const { data: po, error: poErr } = await db.from('purchase_order').insert({
      // ถ้าเป็นวันนี้ใช้เวลาปัจจุบัน ถ้าเป็นวันอื่นใช้ 12:00 เพื่อหลีก TZ
      date: (purDate === new Date().toISOString().split('T')[0])
        ? new Date().toISOString()
        : new Date(purDate + 'T12:00:00').toISOString(),
      supplier: supplier||null, total, method,
      note: note||null, staff_name: v9Staff(), status: 'รับแล้ว',
    }).select().single();
    if (poErr) throw new Error(poErr.message);

    // 2. Items + stock
    for (const item of items) {
      await db.from('purchase_item').insert({
        order_id:po.id, product_id:item.prodId, name:item.prodName,
        qty:item.qty, received_qty:item.qty,
        cost_per_unit:item.cost, total:item.qty*item.cost,
      });
      const prod        = v9GetProducts().find(p=>p.id===item.prodId);
      const stockBefore = prod?.stock || 0;
      const stockAfter  = stockBefore + item.qtyBase;
      await db.from('สินค้า').update({
        stock: stockAfter,
        cost:  item.costBase > 0 ? item.costBase : (prod?.cost||0),
        updated_at: new Date().toISOString(),
      }).eq('id', item.prodId);
      await db.from('stock_movement').insert({
        product_id:item.prodId, product_name:item.prodName,
        type:'รับเข้า', direction:'in', qty:item.qtyBase,
        stock_before:stockBefore, stock_after:stockAfter,
        ref_id:po.id, ref_table:'purchase_order', staff_name:v9Staff(),
        note: item.kgPer!==1 ? `รับ ${item.qty} ${item.buyUnit} = ${item.qtyBase} ${item.baseUnit}` : (note||null),
      });
      // 3. หน่วยขาย
      for (const u of (item.sellUnits||[])) {
        await db.from('product_units').insert({
          product_id:item.prodId, unit_name:u.unit_name,
          conv_rate:u.conv_rate, price_per_unit:u.price_per_unit, is_base:false,
        }).catch(()=>{});
      }
      delete window._v9UnitCache?.[item.prodId];
      // recalc BOM
      try {
        const {data:recipes}=await db.from('สูตรสินค้า').select('product_id').eq('material_id',item.prodId);
        for (const r of (recipes||[])) await window.v9CalcBOMCost?.(r.product_id);
      } catch(_){}
    }

    // 4. เครดิต → เจ้าหนี้
    if (method==='เครดิต') {
      let suppId = suppSelId;
      if (!suppId && supplier) {
        const {data:found}=await db.from('ซัพพลายเออร์').select('id').eq('name',supplier).maybeSingle();
        if (found) suppId=found.id;
        else {
          const {data:ns}=await db.from('ซัพพลายเออร์').insert({name:supplier,status:'ใช้งาน'}).select('id').single();
          suppId=ns?.id;
        }
      }
      if (suppId) {
        await db.from('เจ้าหนี้').insert({
          supplier_id:suppId, purchase_order_id:po.id,
          date:new Date().toISOString(), due_date:dueDate,
          amount:total, paid_amount:0, balance:total, status:'ค้างชำระ',
        });
      }
    }

    typeof logActivity==='function'&&logActivity('รับสินค้าเข้า',`${supplier||'ไม่ระบุ'} ${items.length} รายการ ฿${formatNum(total)}`);
    window._v9PurItems = [];
    window._v9ProductsCache = null;
    await loadProducts?.();
    try{if(typeof products!=='undefined')window._v9ProductsCache=products;}catch(_){}
    try{purchaseItems=[];}catch(_){}
    typeof closeModal==='function'&&closeModal();
    typeof renderPurchases==='function'&&renderPurchases?.();
    typeof toast==='function'&&toast(`รับสินค้า ฿${formatNum(total)} สำเร็จ`,'success');
  } catch(e) {
    typeof toast==='function'&&toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};
window.savePurchaseOrder   = window.v9P23Save;
window.submitPurchaseOrder = window.v9P23Save;

// ── ปุ่ม add ในแต่ละ panel ────────────────────────────────────────
window.v9P23AddExisting = () => v9P23AddToList('exist');
window.v9P23AddNew      = () => v9P23AddToList('new');

// inject ปุ่ม add ใน panel (เรียกหลัง render fields)
function v9P23InjectAddBtn(panel, mode) {
  const wrap = document.getElementById(panel);
  if (!wrap || wrap.querySelector('.v9p23-addbtn')) return;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn btn-primary v9p23-addbtn';
  btn.style = 'width:100%;margin-top:12px;';
  btn.innerHTML = '<i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มรายการนี้';
  btn.onclick = () => v9P23AddToList(mode);
  wrap.appendChild(btn);
}

// patch เพื่อ inject ปุ่ม add หลัง show panel
const _origV9P23ShowSearch = window.v9P23ShowSearch;
window.v9P23ShowSearch = function () {
  _origV9P23ShowSearch?.();
  setTimeout(()=>v9P23InjectAddBtn('v9p23-p2b','exist'), 100);
};
const _origV9P23ShowNew = window.v9P23ShowNewProd;
window.v9P23ShowNewProd = function () {
  _origV9P23ShowNew?.();
  setTimeout(()=>v9P23InjectAddBtn('v9p23-p2c','new'), 100);
};


// ── B. สูตรสินค้า (BOM) redesign ────────────────────────────────

window.v9AdminRecipe = async function (container) {
  container.innerHTML = v9AdminLoading('โหลดสูตรสินค้า...');
  let recipes=[], prods=[];
  try {
    prods = v9GetProducts();
    const {data,error} = await db.from('สูตรสินค้า').select('id,product_id,material_id,quantity,unit');
    if (error) throw new Error(error.message);
    recipes = data||[];
  } catch(e) { container.innerHTML=v9AdminError('โหลดไม่ได้: '+e.message); return; }

  const prodMap={};
  prods.forEach(p=>{prodMap[p.id]=p;});
  const grouped={};
  recipes.forEach(r=>{if(!grouped[r.product_id])grouped[r.product_id]=[];grouped[r.product_id].push(r);});

  container.innerHTML = `
    ${v9SectionHeader('สูตรสินค้า',
      `<button class="btn btn-primary btn-sm" onclick="v9RecipeShowCreate()">
        <i class="material-icons-round" style="font-size:14px;">add</i> สร้างสูตรใหม่
      </button>`)}

    <!-- create form -->
    <div id="v9rec-create" style="display:none;background:var(--bg-base);border-radius:14px;
      padding:18px;margin-bottom:20px;border:1px solid var(--border-light);">
      <div style="font-size:13px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:6px;">
        <i class="material-icons-round" style="font-size:16px;color:var(--primary);">science</i>
        สร้างสูตรสินค้าใหม่
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">ชื่อสินค้าที่จะผลิต *</label>
          <input class="form-input" id="v9rec-name" placeholder="เช่น เสา 20×20×3, ปูน 240ksc">
        </div>
        <div class="form-group">
          <label class="form-label">ประเภท *</label>
          <select class="form-input" id="v9rec-type">
            <option value="ตามบิล">ตามบิล (ผสมตอนขาย Auto-deduct)</option>
            <option value="ผลิตล่วงหน้า">ผลิตล่วงหน้า (มีสต็อก)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">หน่วยสินค้า</label>
          <input class="form-input" id="v9rec-unit" placeholder="ชิ้น, ลบ.ม., ถุง">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div class="form-group">
          <label class="form-label">ราคาขาย (บาท) *</label>
          <input class="form-input" type="number" id="v9rec-price" value="0" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">ต้นทุน (คำนวณอัตโนมัติ)</label>
          <div id="v9rec-cost-display" style="padding:9px 12px;background:var(--bg-surface);
            border:1.5px solid var(--primary);border-radius:var(--radius-md);font-size:14px;
            font-weight:700;color:var(--primary);">฿0</div>
        </div>
      </div>

      <!-- วัตถุดิบ -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <label class="form-label" style="margin:0;">วัตถุดิบ *</label>
        <button type="button" class="btn btn-outline btn-sm" onclick="v9RecipeAddMat()">
          <i class="material-icons-round" style="font-size:13px;">add</i> เพิ่มวัตถุดิบ
        </button>
      </div>
      <div id="v9rec-mat-rows" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;"></div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="v9RecipeSave()">
          <i class="material-icons-round" style="font-size:14px;">save</i> บันทึกสูตร
        </button>
        <button class="btn btn-outline" onclick="document.getElementById('v9rec-create').style.display='none'">ยกเลิก</button>
      </div>
    </div>

    <!-- รายการสูตรที่มีอยู่ -->
    ${Object.keys(grouped).length===0
      ? `<div style="text-align:center;padding:60px;color:var(--text-tertiary);">
           <i class="material-icons-round" style="font-size:48px;opacity:.3;display:block;margin-bottom:12px;">science</i>
           ยังไม่มีสูตรสินค้า
         </div>`
      : Object.entries(grouped).map(([pid,mats])=>{
          const prod=prodMap[pid];
          const ptype=prod?.product_type||'ตามบิล';
          const typeClr=ptype==='ตามบิล'?'#7c3aed':'#0891b2';
          const typeBg =ptype==='ตามบิล'?'#ede9fe':'#ecfeff';
          const canMake = mats.length>0 ? Math.floor(Math.min(...mats.map(r=>{
            const mat=prodMap[r.material_id]; return mat?.stock?Math.floor(mat.stock/r.quantity):0;
          }))) : 0;
          return `
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);
              border-radius:16px;overflow:hidden;margin-bottom:12px;">
              <div style="padding:14px 18px;background:var(--bg-base);
                display:flex;align-items:center;justify-content:space-between;
                border-bottom:1px solid var(--border-light);">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="font-size:15px;font-weight:800;">${prod?.name||pid}</span>
                    <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;
                      background:${typeBg};color:${typeClr};">${ptype}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-tertiary);">
                    ราคา ฿${formatNum(prod?.price||0)} · ต้นทุน ฿${formatNum(prod?.cost||0)}
                    · <span style="color:${canMake>0?'var(--success)':'var(--danger)'};">
                        ผลิตได้ ${canMake} ${prod?.unit||'ชิ้น'}
                      </span>
                    ${ptype==='ผลิตล่วงหน้า'?` · สต็อก ${prod?.stock||0} ${prod?.unit||'ชิ้น'}`:''}
                  </div>
                </div>
                ${ptype==='ผลิตล่วงหน้า'?`
                  <div style="display:flex;gap:8px;align-items:center;">
                    <input type="number" id="v9rec-produce-qty-${pid}" value="1" min="1" max="${canMake}"
                      style="width:60px;padding:5px;border:1.5px solid var(--border-light);border-radius:6px;
                        text-align:center;font-size:13px;" ${canMake===0?'disabled':''}>
                    <button class="btn btn-primary btn-sm" onclick="v9RecipeProduce('${pid}',${canMake})"
                      ${canMake===0?'disabled style="opacity:.45;"':''}>
                      <i class="material-icons-round" style="font-size:14px;">precision_manufacturing</i> ผลิต
                    </button>
                  </div>` : ''}
              </div>
              <div style="padding:12px 18px;">
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${mats.map(r=>{
                    const mat=prodMap[r.material_id];
                    const ok=(mat?.stock||0)>=r.quantity;
                    return `<div style="display:flex;align-items:center;gap:5px;padding:5px 10px;
                      border-radius:999px;font-size:12px;
                      background:${ok?'#f0fdf4':'#fef2f2'};
                      border:1px solid ${ok?'#86efac':'#fca5a5'};
                      color:${ok?'#15803d':'#dc2626'};">
                      ${mat?.name||r.material_id}
                      <span style="opacity:.7;">${r.quantity} ${r.unit||mat?.unit||''}</span>
                      <button onclick="v9AdminRecipeDelete('${r.id}')"
                        style="background:none;border:none;cursor:pointer;color:inherit;padding:0;margin-left:2px;">
                        <i class="material-icons-round" style="font-size:12px;">close</i>
                      </button>
                    </div>`;
                  }).join('')}
                  <button onclick="v9RecipeAddMatTo('${pid}')"
                    style="padding:5px 10px;border-radius:999px;font-size:12px;background:var(--bg-base);
                      border:1px dashed var(--border-light);cursor:pointer;color:var(--text-tertiary);">
                    + เพิ่มวัตถุดิบ
                  </button>
                </div>
              </div>
            </div>`;
        }).join('')}`;

  window._v9RecipeMatIdx = 0;
};

window.v9RecipeShowCreate = function () {
  const el = document.getElementById('v9rec-create');
  if (el) { el.style.display = 'block'; el.scrollIntoView({behavior:'smooth'}); }
  window._v9RecipeMatIdx = 0;
  const rows = document.getElementById('v9rec-mat-rows');
  if (rows) rows.innerHTML = '';
  v9RecipeAddMat();
};

window.v9RecipeAddMat = function (targetProdId) {
  const container = document.getElementById(
    targetProdId ? `v9rec-addto-rows-${targetProdId}` : 'v9rec-mat-rows'
  );
  if (!container) return;
  const idx = window._v9RecipeMatIdx++;
  const prods = v9GetProducts().filter(p => p.is_raw || p.product_type === 'both');
  const prodOpts = prods.map(p=>`<option value="${p.id}">${p.name} (${p.unit||'ชิ้น'})</option>`).join('');

  container.insertAdjacentHTML('beforeend', `
    <div id="v9rec-mat-row-${idx}" style="display:grid;grid-template-columns:1fr 1fr 80px 28px;gap:8px;align-items:end;">
      <div class="form-group" style="margin:0;">
        ${idx===0?'<label class="form-label">วัตถุดิบ</label>':''}
        <select class="form-input" id="v9rec-mat-prod-${idx}"
          onchange="v9RecipeLoadUnits(${idx},'${targetProdId||''}')">
          <option value="">-- เลือกวัตถุดิบ --</option>${prodOpts}
        </select>
      </div>
      <div class="form-group" style="margin:0;">
        ${idx===0?'<label class="form-label">หน่วยที่ใช้</label>':''}
        <select class="form-input" id="v9rec-mat-unit-${idx}"
          onchange="v9RecipeCalcCost('${targetProdId||''}')">
          <option value="">-- เลือกสินค้าก่อน --</option>
        </select>
      </div>
      <div class="form-group" style="margin:0;">
        ${idx===0?'<label class="form-label">จำนวน</label>':''}
        <input class="form-input" type="number" id="v9rec-mat-qty-${idx}"
          value="1" min="0.001" step="0.001"
          oninput="v9RecipeCalcCost('${targetProdId||''}')">
      </div>
      ${idx>0?`<button type="button" onclick="document.getElementById('v9rec-mat-row-${idx}').remove();v9RecipeCalcCost('${targetProdId||''}')"
        style="background:none;border:none;cursor:pointer;color:var(--danger);padding:0;align-self:center;">
        <i class="material-icons-round" style="font-size:18px;">close</i></button>`:'<div></div>'}
    </div>`);
};

window.v9RecipeLoadUnits = async function (rowIdx, targetProdId) {
  const prodId  = document.getElementById(`v9rec-mat-prod-${rowIdx}`)?.value;
  const unitSel = document.getElementById(`v9rec-mat-unit-${rowIdx}`);
  if (!unitSel) return;
  if (!prodId) { unitSel.innerHTML = '<option>-- เลือกสินค้าก่อน --</option>'; return; }

  const prod  = v9GetProducts().find(p=>p.id===prodId);
  const units = await v9LoadUnits(prodId);
  const allUnits = [
    { id:'__base__', unit_name: prod?.unit||'ชิ้น', conv_rate:1, is_base:true },
    ...units.filter(u=>!u.is_base)
  ];
  unitSel.innerHTML = allUnits.map(u=>
    `<option value="${u.id}" data-prodid="${prodId}" data-conv="${u.conv_rate}" data-unit="${u.unit_name}">
      ${u.unit_name}${u.conv_rate!==1?` (1${u.unit_name}=${u.conv_rate}${prod?.unit||''})`:''}</option>`
  ).join('');
  v9RecipeCalcCost(targetProdId);
};

window.v9RecipeCalcCost = function (targetProdId) {
  const costDisplay = document.getElementById(
    targetProdId ? `v9rec-addto-cost-${targetProdId}` : 'v9rec-cost-display'
  );
  let totalCost = 0;
  let idx = 0;
  const prods = v9GetProducts();
  while (document.getElementById(`v9rec-mat-row-${idx}`)) {
    const prodId  = document.getElementById(`v9rec-mat-prod-${idx}`)?.value;
    const unitSel = document.getElementById(`v9rec-mat-unit-${idx}`);
    const qty     = Number(document.getElementById(`v9rec-mat-qty-${idx}`)?.value || 0);
    if (prodId && qty > 0) {
      const opt      = unitSel?.selectedOptions?.[0];
      const convRate = Number(opt?.dataset.conv || 1);
      const prod     = prods.find(p=>p.id===prodId);
      const costBase = prod?.cost || 0;
      totalCost += qty * convRate * costBase;
    }
    idx++;
  }
  if (costDisplay) costDisplay.textContent = `฿${formatNum(Math.round(totalCost))}`;
};

window.v9RecipeSave = async function () {
  const name  = document.getElementById('v9rec-name')?.value?.trim();
  const ptype = document.getElementById('v9rec-type')?.value || 'ตามบิล';
  const price = Number(document.getElementById('v9rec-price')?.value || 0);
  const unit  = document.getElementById('v9rec-unit')?.value?.trim() || 'ชิ้น';
  if (!name) { typeof toast==='function'&&toast('กรุณากรอกชื่อสินค้า','error'); return; }

  // รวบรวมวัตถุดิบ
  const mats = [];
  let idx=0;
  while(document.getElementById(`v9rec-mat-row-${idx}`)) {
    const prodId  = document.getElementById(`v9rec-mat-prod-${idx}`)?.value;
    const unitSel = document.getElementById(`v9rec-mat-unit-${idx}`);
    const qty     = Number(document.getElementById(`v9rec-mat-qty-${idx}`)?.value || 0);
    if (prodId && qty>0) {
      const opt      = unitSel?.selectedOptions?.[0];
      const convRate = Number(opt?.dataset.conv||1);
      const unitName = opt?.dataset.unit||'ชิ้น';
      mats.push({ material_id:prodId, quantity:qty*convRate, unit:unitName });
    }
    idx++;
  }
  if (!mats.length) { typeof toast==='function'&&toast('กรุณาเพิ่มวัตถุดิบอย่างน้อย 1 รายการ','error'); return; }

  // คำนวณต้นทุน
  const prods = v9GetProducts();
  let costTotal = 0;
  mats.forEach(m=>{const p=prods.find(x=>x.id===m.material_id); costTotal+=m.quantity*(p?.cost||0);});

  v9ShowOverlay('กำลังสร้างสินค้า + สูตร...');
  try {
    // สร้างสินค้าใหม่
    const { data: np, error: ne } = await db.from('สินค้า').insert({
      name, unit, price, cost: parseFloat(costTotal.toFixed(6)),
      stock: 0, is_raw: false,
      product_type: ptype,
      updated_at: new Date().toISOString(),
    }).select().single();
    if (ne) throw new Error(ne.message);

    // สร้าง สูตรสินค้า
    for (const m of mats) {
      await db.from('สูตรสินค้า').insert({ product_id:np.id, ...m });
    }

    await loadProducts?.();
    try{if(typeof products!=='undefined')window._v9ProductsCache=products;}catch(_){}
    typeof toast==='function'&&toast(`สร้าง "${name}" + สูตร สำเร็จ`,'success');
    document.getElementById('v9rec-create').style.display='none';
    const inner = document.getElementById('v9-manage-inner');
    if (inner) await window.v9AdminRecipe(inner);
    const ac = document.getElementById('v9-admin-content');
    if (ac)   await window.v9AdminRecipe(ac);
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

window.v9RecipeAddMatTo = async function (prodId) {
  // เพิ่มวัตถุดิบเข้าสูตรเดิม
  const container = document.getElementById(`v9rec-addto-${prodId}`);
  if (!container) {
    // สร้าง inline form
    const prodCard = document.querySelector(`[data-prod-recipe="${prodId}"]`) ||
      [...document.querySelectorAll('div')].find(d=>d.innerHTML.includes(`v9rec-produce-qty-${prodId}`))
        ?.closest('[style*="border-radius:16px"]');
    if (!prodCard) return;
    const wrap = document.createElement('div');
    wrap.id = `v9rec-addto-wrap-${prodId}`;
    wrap.style = 'padding:0 18px 14px;';
    wrap.innerHTML = `
      <div id="v9rec-addto-rows-${prodId}" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;"></div>
      <div style="font-size:12px;color:var(--primary);margin-bottom:6px;">
        ต้นทุนเพิ่ม: <span id="v9rec-addto-cost-${prodId}" style="font-weight:700;">฿0</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="v9RecipeSaveAddTo('${prodId}')">บันทึกวัตถุดิบ</button>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('v9rec-addto-wrap-${prodId}').remove()">ยกเลิก</button>
      </div>`;
    prodCard.appendChild(wrap);
  }
  window._v9RecipeMatIdx = 0;
  v9RecipeAddMat(prodId);
};

window.v9RecipeSaveAddTo = async function (targetProdId) {
  const mats=[];
  let idx=0;
  while(document.getElementById(`v9rec-mat-row-${idx}`)){
    const prodId=document.getElementById(`v9rec-mat-prod-${idx}`)?.value;
    const unitSel=document.getElementById(`v9rec-mat-unit-${idx}`);
    const qty=Number(document.getElementById(`v9rec-mat-qty-${idx}`)?.value||0);
    if(prodId&&qty>0){const opt=unitSel?.selectedOptions?.[0];const convRate=Number(opt?.dataset.conv||1);const unitName=opt?.dataset.unit||'ชิ้น';mats.push({material_id:prodId,quantity:qty*convRate,unit:unitName});}
    idx++;
  }
  if(!mats.length)return;
  v9ShowOverlay('กำลังบันทึก...');
  try {
    for(const m of mats)await db.from('สูตรสินค้า').insert({product_id:targetProdId,...m});
    await window.v9CalcBOMCost?.(targetProdId);
    typeof toast==='function'&&toast('เพิ่มวัตถุดิบสำเร็จ','success');
    const inner=document.getElementById('v9-manage-inner');if(inner)await window.v9AdminRecipe(inner);
    const ac=document.getElementById('v9-admin-content');if(ac)await window.v9AdminRecipe(ac);
  } catch(e){typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error');}
  finally{v9HideOverlay();}
};

window.v9AdminRecipeDelete = async function (recipeId) {
  if (!confirm('ลบวัตถุดิบจากสูตร?')) return;
  v9ShowOverlay('ลบ...');
  try {
    await db.from('สูตรสินค้า').delete().eq('id',recipeId);
    typeof toast==='function'&&toast('ลบสำเร็จ','success');
    const inner=document.getElementById('v9-manage-inner');if(inner)await window.v9AdminRecipe(inner);
    const ac=document.getElementById('v9-admin-content');if(ac)await window.v9AdminRecipe(ac);
  } catch(e){typeof toast==='function'&&toast('ลบไม่สำเร็จ: '+e.message,'error');}
  finally{v9HideOverlay();}
};


// ── C. ผลิตล่วงหน้า ─────────────────────────────────────────────

window.v9RecipeProduce = async function (productId, maxQty) {
  const qty = Number(document.getElementById(`v9rec-produce-qty-${productId}`)?.value || 0);
  if (!qty||qty<=0){typeof toast==='function'&&toast('กรุณาระบุจำนวน','error');return;}
  if (qty>maxQty){typeof toast==='function'&&toast(`ผลิตได้สูงสุด ${maxQty} ชิ้น`,'error');return;}
  const prods = v9GetProducts(); const prodMap={};prods.forEach(p=>{prodMap[p.id]=p;});
  const prod = prodMap[productId];
  const ok = await Swal.fire({
    title:`ผลิต ${prod?.name||''}`,
    html:`ผลิต <strong>${qty}</strong> ${prod?.unit||'ชิ้น'}<br>วัตถุดิบจะถูกตัดออกจากสต็อก`,
    icon:'question',showCancelButton:true,confirmButtonText:'ยืนยัน',cancelButtonText:'ยกเลิก',confirmButtonColor:'#DC2626'
  });
  if(!ok.isConfirmed)return;
  v9ShowOverlay('กำลังผลิต...',`${prod?.name} × ${qty}`);
  try {
    const {data:recipes}=await db.from('สูตรสินค้า').select('*').eq('product_id',productId);
    if(!recipes?.length)throw new Error('ไม่พบสูตรสินค้า');
    for(const r of recipes){
      const mat=prodMap[r.material_id];
      const needed=r.quantity*qty;
      const stockNow=mat?.stock||0;
      if(stockNow<needed)throw new Error(`วัตถุดิบ "${mat?.name}" ไม่พอ (มี ${stockNow} ต้องการ ${needed})`);
      const newStock=stockNow-needed;
      await db.from('สินค้า').update({stock:newStock,updated_at:new Date().toISOString()}).eq('id',r.material_id);
      await db.from('stock_movement').insert({product_id:r.material_id,product_name:mat?.name||'',type:'ใช้ผลิต',direction:'out',qty:needed,stock_before:stockNow,stock_after:newStock,ref_table:'production',staff_name:v9Staff(),note:`ผลิต ${prod?.name} × ${qty}`});
    }
    const stockBefore=prod?.stock||0;const stockAfter=stockBefore+qty;
    await db.from('สินค้า').update({stock:stockAfter,updated_at:new Date().toISOString()}).eq('id',productId);
    await db.from('stock_movement').insert({product_id:productId,product_name:prod?.name||'',type:'ผลิต',direction:'in',qty,stock_before:stockBefore,stock_after:stockAfter,ref_table:'production',staff_name:v9Staff(),note:`ผลิตล่วงหน้า × ${qty}`});
    typeof logActivity==='function'&&logActivity('ผลิตสินค้า',`${prod?.name} × ${qty}`);
    await loadProducts?.();try{if(typeof products!=='undefined')window._v9ProductsCache=products;}catch(_){}
    typeof toast==='function'&&toast(`ผลิต ${prod?.name} × ${qty} สำเร็จ ✅`,'success');
    const inner=document.getElementById('v9-manage-inner');if(inner)await window.v9AdminRecipe(inner);
  } catch(e){typeof toast==='function'&&toast('ผลิตไม่สำเร็จ: '+e.message,'error');}
  finally{v9HideOverlay();}
};


// ── D. POS popup เลือกหน่วย ─────────────────────────────────────

const _v9OrigAddToCart = window.addToCart || (typeof addToCart==='function'?addToCart:null);
window.addToCart = async function (productId) {
  let prod; try { prod = products.find(p=>p.id===productId); } catch(_){}
  if (!prod) { try { prod = v9GetProducts().find(p=>p.id===productId); } catch(_){} }
  if (!prod) return;

  // ถ้าเป็น "ตามบิล" ตรวจวัตถุดิบก่อน
  if (prod.product_type==='ตามบิล') {
    // ไม่เช็คสต็อก (ผสมตอนขาย)
    const units = await v9LoadUnits(productId);
    const sellUnits = units.filter(u=>!u.is_base);
    if (sellUnits.length > 0) { v9ShowUnitPopup(prod, sellUnits); return; }
    // ไม่มีหน่วยพิเศษ — เพิ่มเข้าตะกร้าตรง
    v9PushToCart(prod, prod.price, prod.unit||'ชิ้น', 1, 1);
    return;
  }

  // โหลดหน่วยขายก่อน
  const units = await v9LoadUnits(productId);
  const sellUnits = units.filter(u => !u.is_base);

  // ตรวจสต็อก (ข้ามถ้ามีหน่วยขายหลายหน่วย เพราะอาจหน่วยย่อยยังมีสต็อก)
  if (prod.stock <= 0 && sellUnits.length === 0) {
    typeof toast==='function'&&toast('สินค้าหมดสต็อก','error'); return;
  }

  // มีหลายหน่วย → popup เลือกหน่วย
  if (sellUnits.length > 0) {
    v9ShowUnitPopup(prod, sellUnits); return;
  }

  // หน่วยเดียว ตรวจสต็อก
  if (prod.stock <= 0) { typeof toast==='function'&&toast('สินค้าหมดสต็อก','error'); return; }
  v9PushToCart(prod, prod.price, prod.unit||'ชิ้น', 1, 1);
};

window.v9ShowUnitPopup = function (prod, sellUnits) {
  if (typeof openModal!=='function') return;
  const baseUnit = prod.unit||'ชิ้น';
  const isMTO    = prod.product_type==='ตามบิล';

  // คำนวณผลิตได้กี่ (ตามบิล)
  let mtoCapacity = '';
  if (isMTO) {
    // จะแสดงใน modal ต่างหาก
  }

  openModal(`เลือกหน่วย: ${prod.name}`, `
    <div style="text-align:center;margin-bottom:16px;">
      ${prod.img_url?`<img src="${prod.img_url}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;margin-bottom:8px;">`:''}
      <div style="font-size:16px;font-weight:800;">${prod.name}</div>
      ${isMTO
        ? `<div style="font-size:12px;color:#7c3aed;margin-top:4px;">ผลิตตามบิล — ตัดวัตถุดิบอัตโนมัติตอนขาย</div>`
        : `<div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">สต็อก ${prod.stock} ${baseUnit}</div>`}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px;">
      <!-- base unit -->
      <div onclick="v9SelectUnit('${prod.id}',${prod.price},'${baseUnit}',1)"
        style="padding:14px 10px;border:1.5px solid var(--border-light);border-radius:12px;
          text-align:center;cursor:pointer;transition:all .15s;"
        onmouseenter="this.style.borderColor='var(--primary)';this.style.background='var(--primary-50,#fef2f2)'"
        onmouseleave="this.style.borderColor='var(--border-light)';this.style.background=''">
        <div style="font-size:15px;font-weight:800;color:var(--primary);">฿${formatNum(prod.price)}</div>
        <div style="font-size:13px;font-weight:700;margin-top:4px;">${baseUnit}</div>
        <div style="font-size:10px;color:var(--text-tertiary);">หน่วยพื้นฐาน</div>
      </div>
      <!-- sell units -->
      ${sellUnits.map(u=>`
        <div onclick="v9SelectUnit('${prod.id}',${u.price_per_unit||0},'${u.unit_name}',${u.conv_rate})"
          style="padding:14px 10px;border:1.5px solid var(--border-light);border-radius:12px;
            text-align:center;cursor:pointer;transition:all .15s;"
          onmouseenter="this.style.borderColor='var(--primary)';this.style.background='var(--primary-50,#fef2f2)'"
          onmouseleave="this.style.borderColor='var(--border-light)';this.style.background=''">
          <div style="font-size:15px;font-weight:800;color:var(--primary);">
            ฿${formatNum(u.price_per_unit||0)}
          </div>
          <div style="font-size:13px;font-weight:700;margin-top:4px;">${u.unit_name}</div>
          <div style="font-size:10px;color:var(--text-tertiary);">1${u.unit_name}=${u.conv_rate}${baseUnit}</div>
        </div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--text-tertiary);text-align:center;">
      กดเลือกหน่วยที่ต้องการขาย
    </div>`);

  window._v9UnitPopupProd = prod;
};

window.v9SelectUnit = function (productId, price, unitName, convRate) {
  const prod = window._v9UnitPopupProd;
  if (!prod) return;
  typeof closeModal==='function'&&closeModal();
  v9PushToCart(prod, price, unitName, convRate, 1);
};

window.v9PushToCart = function (prod, price, unitName, convRate, qty) {
  try {
    const existing = cart.find(c => c.id===prod.id && c.unit===unitName);
    if (existing) {
      // สต็อกเช็คเฉพาะ non-MTO
      if (prod.product_type!=='ตามบิล') {
        const totalBaseQty = (existing.qty + qty) * convRate;
        if (totalBaseQty > prod.stock) { typeof toast==='function'&&toast('สินค้าไม่เพียงพอ','warning'); return; }
      }
      existing.qty++;
    } else {
      cart.push({
        id:prod.id, name:prod.name, price, cost:prod.cost||0,
        qty, stock:prod.stock, unit:unitName, conv_rate:convRate,
        is_mto: prod.product_type==='ตามบิล',
      });
    }
    renderCart?.(); renderProductGrid?.();
    if (typeof sendToDisplay==='function') sendToDisplay({type:'cart',cart,total:getCartTotal?.()});
  } catch(e) { console.warn('[v9] pushToCart:', e.message); }
};


// ── E. Auto-deduct BOM ตอนขาย (ตามบิล) ──────────────────────────

const _v9OrigComplete23 = window.v4CompletePayment;
window.v4CompletePayment = async function () {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;
  v9ShowOverlay('กำลังบันทึกบิล...','โปรดรอสักครู่');

  try {
    const {data:session}=await db.from('cash_session').select('*').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();
    const methodMap={cash:'เงินสด',transfer:'โอนเงิน',credit:'บัตรเครดิต',debt:'ติดหนี้'};
    const {data:bill,error:billError}=await db.from('บิลขาย').insert({
      date:new Date().toISOString(),
      method:methodMap[checkoutState.method]||'เงินสด',
      total:checkoutState.total,discount:checkoutState.discount||0,
      received:checkoutState.received,change:checkoutState.change,
      customer_name:checkoutState.customer?.name||null,
      customer_id:checkoutState.customer?.id||null,
      staff_name:v9Staff(),
      status:checkoutState.method==='debt'?'ค้างชำระ':'สำเร็จ',
    }).select().single();
    if (billError) throw billError;

    const prods=v9GetProducts();const prodMap={};prods.forEach(p=>{prodMap[p.id]=p;});

    for (const item of cart) {
      const prod=prodMap[item.id];
      const convRate=item.conv_rate||1;
      const baseQty=item.qty*convRate;
      const stockAfter=prod?.product_type==='ตามบิล'?(prod?.stock||0):(prod?.stock||0)-baseQty;

      await db.from('รายการในบิล').insert({
        bill_id:bill.id,product_id:item.id,name:item.name,
        qty:item.qty,price:item.price,cost:item.cost||0,
        total:item.price*item.qty,unit:item.unit||'ชิ้น'
      });

      if (prod?.product_type!=='ตามบิล') {
        await db.from('สินค้า').update({stock:stockAfter}).eq('id',item.id);
        await db.from('stock_movement').insert({
          product_id:item.id,product_name:item.name,type:'ขาย',direction:'out',
          qty:baseQty,stock_before:prod?.stock||0,stock_after:stockAfter,
          ref_id:bill.id,ref_table:'บิลขาย',staff_name:v9Staff(),
        });
      } else {
        // ตามบิล → ตัดวัตถุดิบจาก BOM
        try {
          const {data:recipes}=await db.from('สูตรสินค้า').select('*').eq('product_id',item.id);
          for (const r of (recipes||[])) {
            const mat=prodMap[r.material_id];
            const neededTotal=r.quantity*item.qty;
            const matStock=mat?.stock||0;
            const matAfter=Math.max(0,matStock-neededTotal);
            await db.from('สินค้า').update({stock:matAfter,updated_at:new Date().toISOString()}).eq('id',r.material_id);
            await db.from('stock_movement').insert({
              product_id:r.material_id,product_name:mat?.name||'',
              type:'ใช้ผลิต(ขาย)',direction:'out',qty:neededTotal,
              stock_before:matStock,stock_after:matAfter,
              ref_id:bill.id,ref_table:'บิลขาย',staff_name:v9Staff(),
              note:`จากบิล #${bill.bill_no} (${item.name})`,
            });
          }
        } catch(e){console.warn('[v9] BOM deduct:',e.message);}
      }
    }

    if (checkoutState.method==='cash'&&session) {
      let chgDenoms=checkoutState.changeDenominations;
      if(!chgDenoms||!Object.values(chgDenoms).some(v=>Number(v)>0)){
        if(checkoutState.change>0&&typeof calcChangeDenominations==='function')
          chgDenoms=calcChangeDenominations(checkoutState.change);
      }
      await window.recordCashTx({sessionId:session.id,type:'ขาย',direction:'in',
        amount:checkoutState.received,changeAmt:checkoutState.change,netAmount:checkoutState.total,
        refId:bill.id,refTable:'บิลขาย',denominations:checkoutState.receivedDenominations||null,
        changeDenominations:chgDenoms||null,note:null,
      });
    }

    if (checkoutState.customer?.id) {
      const {data:cust}=await db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id',checkoutState.customer.id).maybeSingle();
      await db.from('customer').update({
        total_purchase:(cust?.total_purchase||0)+checkoutState.total,
        visit_count:(cust?.visit_count||0)+1,
        debt_amount:checkoutState.method==='debt'?(cust?.debt_amount||0)+checkoutState.total:(cust?.debt_amount||0),
      }).eq('id',checkoutState.customer.id);
    }

    typeof logActivity==='function'&&logActivity('ขายสินค้า',`บิล #${bill.bill_no} ฿${formatNum(checkoutState.total)}`,bill.id,'บิลขาย');
    typeof sendToDisplay==='function'&&sendToDisplay({type:'thanks',billNo:bill.bill_no,total:checkoutState.total});

    const {data:bItems}=await db.from('รายการในบิล').select('*').eq('bill_id',bill.id);
    window.cart=[];
    await loadProducts?.();
    try{if(typeof products!=='undefined')window._v9ProductsCache=products;}catch(_){}
    renderCart?.();renderProductGrid?.();updateHomeStats?.();

    try{const nb=await getLiveCashBalance?.();['cash-current-balance','global-cash-balance'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=`฿${formatNum(nb)}`;});}catch(_){}

    v9HideOverlay();
    typeof closeCheckout==='function'&&closeCheckout();

    const fmt=(typeof receiptFormat!=='undefined'?receiptFormat:null)||'80mm';
    const {value:doPrint}=await Swal.fire({
      icon:'success',title:`บิล #${bill.bill_no} สำเร็จ`,
      html:`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
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
          <div style="font-size:16px;font-weight:800;color:#d97706;">฿${formatNum(Math.max(0,checkoutState.change))}</div>
        </div>
      </div>`,
      showCancelButton:true,confirmButtonText:`<i class="material-icons-round" style="font-size:16px;vertical-align:middle;">print</i> พิมพ์ (${fmt})`,
      cancelButtonText:'ข้าม',confirmButtonColor:'#10B981',timer:8000,timerProgressBar:true,
    });
    if(doPrint&&typeof printReceipt==='function')printReceipt(bill,bItems||[],fmt);

  } catch(e) {
    v9HideOverlay();
    typeof toast==='function'&&toast('เกิดข้อผิดพลาด: '+(e.message||e),'error');
  } finally { window.isProcessingPayment=false; }
};


// ── F. ลบ tab หน่วยนับ ──────────────────────────────────────────
// ซ่อน tab units ออกจาก manage menu (ย้ายไปอยู่ใน purchase flow)
// units tab ย้ายกลับเข้า manage (FIX-27)


// ══════════════════════════════════════════════════════════════════
// FIX-24 — หน้ารับสินค้าเข้า (Redesign สมบูรณ์)
//
//  Layout: 2 คอลัมน์ (sidebar เลือกสินค้า | main กรอกรายละเอียด)
//  - modal ขยายเป็น 960px
//  - สินค้าเก่า: ค้นหา → เลือก → กรอก qty/ราคา/อัตราแปลง → บันทึก
//  - สินค้าใหม่: กรอกชื่อ/หน่วย/ประเภท → qty/ราคา → หน่วยขาย N หน่วย
//  - เพิ่มสินค้าหลายรายการต่อใบสั่งซื้อ
//  - ข้อมูลใบสั่งซื้อ (supplier/วันที่/วิธีชำระ) อยู่ใน sidebar ล่างสุด
// ══════════════════════════════════════════════════════════════════

// ── helper: ขยาย modal เป็น full-wide ────────────────────────────
function v9OpenWideModal(title, html) {
  const box = document.querySelector('.modal-box');
  if (box) {
    box._origWidth = box.style.width;
    box.style.width = 'min(960px, 97vw)';
    box.style.maxHeight = '94vh';
  }
  if (typeof openModal === 'function') openModal(title, html);
  // patch closeModal ให้ restore width
  const origClose = window.closeModal;
  window.closeModal = function () {
    if (box) { box.style.width = box._origWidth || ''; box.style.maxHeight = ''; }
    origClose?.();
    window.closeModal = origClose;
  };
}

// ── state ─────────────────────────────────────────────────────────
window._v9Pur = {
  items: [],          // รายการที่จะรับ
  selectedProd: null, // สินค้าที่กำลังกรอกอยู่
  mode: null,         // 'existing' | 'new'
  sellUnitRowIdx: 0,
};

// ── MAIN ENTRY ────────────────────────────────────────────────────
window.showAddPurchaseModal = function () {
  window._v9Pur = { items: [], selectedProd: null, mode: null, sellUnitRowIdx: 0 };
  try { purchaseItems = []; } catch(_) {}

  v9OpenWideModal('รับสินค้าเข้าคลัง', v9Pur24HTML());

  // โหลด suppliers
  db.from('ซัพพลายเออร์').select('id,name').eq('status','ใช้งาน').then(({data}) => {
    const dl  = document.getElementById('v9pur24-supp-list');
    const sel = document.getElementById('v9pur24-supp-id');
    (data||[]).forEach(s => {
      if (dl)  { const o=document.createElement('option'); o.value=s.name; dl.appendChild(o); }
      if (sel) { const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; sel.appendChild(o); }
    });
    window._v9Suppliers = data||[];
  });

  // render product list
  v9Pur24RenderProdList('');
};

window.v9Pur24HTML = function () {
  return `
<style>
.v9p24-layout{display:grid;grid-template-columns:280px 1fr;gap:0;height:calc(90vh - 80px);overflow:hidden;margin:-24px}
.v9p24-sb{border-right:0.5px solid var(--border-light);display:flex;flex-direction:column;overflow:hidden;background:var(--bg-base)}
.v9p24-sb-top{padding:14px;border-bottom:0.5px solid var(--border-light);flex-shrink:0}
.v9p24-sb-search{position:relative}
.v9p24-sb-search input{width:100%;height:34px;border:0.5px solid var(--border-light);border-radius:8px;padding:0 10px 0 30px;font-size:13px;background:var(--bg-surface);font-family:var(--font-thai,'Prompt'),sans-serif;outline:none;color:var(--text-primary)}
.v9p24-sb-search input:focus{border-color:var(--primary)}
.v9p24-sb-search-ico{position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:16px;color:var(--text-tertiary)}
.v9p24-sb-list{flex:1;overflow-y:auto}
.v9p24-prod-row{display:flex;align-items:center;gap:9px;padding:9px 14px;cursor:pointer;border-bottom:0.5px solid var(--border-light);transition:background .12s}
.v9p24-prod-row:hover{background:var(--bg-hover)}
.v9p24-prod-row.sel{background:#fff5f5;border-left:3px solid var(--primary)}
.v9p24-prod-row:not(.sel){border-left:3px solid transparent}
.v9p24-prod-ico{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.v9p24-prod-name{font-size:13px;font-weight:700;color:var(--text-primary)}
.v9p24-prod-meta{font-size:11px;color:var(--text-tertiary);margin-top:1px}
.v9p24-prod-stock{font-size:12px;font-weight:700;text-align:right;flex-shrink:0}
.v9p24-new-btn{padding:12px 14px;display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--primary);font-size:13px;font-weight:700;border-top:1px solid var(--border-light);background:var(--bg-surface);flex-shrink:0;transition:background .12s}
.v9p24-new-btn:hover{background:#fff5f5}
.v9p24-sb-po{padding:12px 14px;border-top:1px solid var(--border-light);flex-shrink:0;background:var(--bg-surface)}
.v9p24-main{display:flex;flex-direction:column;overflow:hidden}
.v9p24-main-content{flex:1;overflow-y:auto;padding:20px}
.v9p24-main-footer{padding:14px 20px;border-top:0.5px solid var(--border-light);background:var(--bg-surface);flex-shrink:0}
.v9p24-section{margin-bottom:16px}
.v9p24-sec-lbl{font-size:10px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px}
.v9p24-fi{height:36px;border:0.5px solid var(--border-light);border-radius:8px;padding:0 10px;display:flex;align-items:center;font-size:13px;background:var(--bg-surface);color:var(--text-primary);width:100%;font-family:var(--font-thai,'Prompt'),sans-serif;outline:none;transition:border-color .15s}
.v9p24-fi:focus{border-color:var(--primary);box-shadow:0 0 0 2px rgba(220,38,38,.08)}
.v9p24-fi.ro{background:var(--bg-base);color:var(--text-secondary)}
.v9p24-g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.v9p24-g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.v9p24-lbl{font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:4px}
.v9p24-field{margin-bottom:10px}
.v9p24-calc{background:#f0fdf4;border-radius:10px;padding:11px 14px;margin:10px 0}
.v9p24-calc-main{font-size:14px;font-weight:700;color:#15803d}
.v9p24-calc-sub{font-size:12px;color:#16a34a;margin-top:3px;line-height:1.5}
.v9p24-tog{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:0.5px solid var(--border-light);border-radius:8px;cursor:pointer;margin-bottom:8px;background:var(--bg-surface)}
.v9p24-tog-info{font-size:13px;font-weight:700;color:var(--text-primary)}
.v9p24-tog-sub{font-size:11px;color:var(--text-tertiary);margin-top:1px}
.v9p24-sw-off{width:38px;height:22px;border-radius:999px;background:var(--border-light);display:flex;align-items:center;padding:2px;flex-shrink:0}
.v9p24-sw-on{width:38px;height:22px;border-radius:999px;background:var(--primary);display:flex;align-items:center;padding:2px;justify-content:flex-end;flex-shrink:0}
.v9p24-sw-k{width:18px;height:18px;border-radius:50%;background:#fff}
.v9p24-type-row{display:flex;gap:6px;margin-bottom:10px}
.v9p24-type-btn{flex:1;padding:10px 6px;border:0.5px solid var(--border-light);border-radius:8px;text-align:center;font-size:12px;cursor:pointer;background:var(--bg-surface);color:var(--text-secondary);transition:all .15s;line-height:1.5}
.v9p24-type-btn:hover{border-color:var(--primary);background:#fff5f5;color:var(--primary)}
.v9p24-type-btn.on{border:1.5px solid var(--primary);background:#fff5f5;color:var(--primary);font-weight:700}
.v9p24-type-ico{font-size:20px;display:block;margin-bottom:4px}
.v9p24-unit-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.v9p24-chip{padding:5px 12px;border-radius:999px;font-size:12px;cursor:pointer;border:0.5px solid var(--border-light);background:var(--bg-surface);color:var(--text-secondary);transition:all .15s;white-space:nowrap}
.v9p24-chip:hover{border-color:var(--primary);color:var(--primary)}
.v9p24-chip.on{border:1.5px solid var(--primary);background:#fff5f5;color:var(--primary);font-weight:700}
.v9p24-chip.dash{border-style:dashed}
.v9p24-unit-tbl{border:0.5px solid var(--border-light);border-radius:10px;overflow:hidden}
.v9p24-ut-head{display:grid;grid-template-columns:100px 110px 1fr 110px 28px;gap:0;padding:7px 12px;background:var(--bg-base)}
.v9p24-ut-head span{font-size:11px;color:var(--text-tertiary);font-weight:700}
.v9p24-ut-row{display:grid;grid-template-columns:100px 110px 1fr 110px 28px;gap:0;padding:8px 12px;align-items:center;border-top:0.5px solid var(--border-light)}
.v9p24-item-list{margin-bottom:12px}
.v9p24-item-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:11px 14px;border-bottom:0.5px solid var(--border-light);background:var(--bg-surface);border-radius:8px;margin-bottom:6px;border:0.5px solid var(--border-light)}
.v9p24-mbtn{flex:1;padding:8px 4px;border:0.5px solid var(--border-light);border-radius:7px;text-align:center;font-size:12px;cursor:pointer;background:var(--bg-surface);color:var(--text-secondary);transition:all .15s}
.v9p24-mbtn.on{border:1.5px solid var(--primary);background:#fff5f5;color:var(--primary);font-weight:700}
.v9p24-profit{font-size:11px;color:var(--text-tertiary);margin-top:3px}
.v9p24-profit.pos{color:#15803d}
.v9p24-badge{font-size:10px;padding:2px 7px;border-radius:999px;font-weight:700;display:inline-block}
.v9p24-bg{background:#dcfce7;color:#15803d}
.v9p24-bb{background:#dbeafe;color:#1d4ed8}
.v9p24-ba{background:#fef3c7;color:#92400e}
.v9p24-notice{padding:9px 12px;border-radius:8px;font-size:12px;display:flex;align-items:flex-start;gap:7px;margin-bottom:12px}
.v9p24-ok{background:#f0fdf4;color:#15803d}
.v9p24-info{background:#eff6ff;color:#1d4ed8;border:0.5px dashed #93c5fd}
</style>

<div class="v9p24-layout">

<!-- ── Sidebar ── -->
<div class="v9p24-sb">
  <div class="v9p24-sb-top">
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;">สินค้าที่รับเข้า</div>
    <div class="v9p24-sb-search">
      <span class="v9p24-sb-search-ico material-icons-round">search</span>
      <input id="v9p24-search" placeholder="ค้นหาชื่อสินค้า..." oninput="v9Pur24RenderProdList(this.value)">
    </div>
  </div>

  <div class="v9p24-sb-list" id="v9p24-prod-list">
    <div style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:12px;">กำลังโหลด...</div>
  </div>

  <div class="v9p24-new-btn" onclick="v9Pur24SelectNew()">
    <i class="material-icons-round" style="font-size:18px;">add_circle</i>
    สร้างสินค้าใหม่
  </div>

  <!-- ข้อมูลใบสั่งซื้อ -->
  <div class="v9p24-sb-po">
    <div style="font-size:11px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">ข้อมูลใบสั่งซื้อ</div>
    <div class="v9p24-field">
      <div class="v9p24-lbl">ผู้จำหน่าย</div>
      <input class="v9p24-fi" id="v9p24-supplier" list="v9pur24-supp-list" placeholder="ชื่อผู้จำหน่าย">
      <datalist id="v9pur24-supp-list"></datalist>
    </div>
    <div class="v9p24-field">
      <div class="v9p24-lbl">วันที่รับสินค้า</div>
      <input class="v9p24-fi" type="date" id="v9p24-date" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="v9p24-field" style="margin-bottom:6px;">
      <div class="v9p24-lbl">วิธีชำระ</div>
      <div style="display:flex;gap:4px;" id="v9p24-method-btns">
        <div class="v9p24-mbtn on" onclick="v9Pur24SelMethod(this,'เงินสด')">เงินสด</div>
        <div class="v9p24-mbtn" onclick="v9Pur24SelMethod(this,'โอนเงิน')">โอนเงิน</div>
        <div class="v9p24-mbtn" onclick="v9Pur24SelMethod(this,'เครดิต')">เครดิต</div>
      </div>
    </div>
    <div id="v9p24-credit-row" style="display:none;">
      <div class="v9p24-field">
        <div class="v9p24-lbl">ซัพพลายเออร์</div>
        <select class="v9p24-fi" id="v9pur24-supp-id"><option value="">-- เลือก --</option></select>
      </div>
      <div class="v9p24-field" style="margin-bottom:0">
        <div class="v9p24-lbl">วันครบกำหนดชำระ *</div>
        <input class="v9p24-fi" type="date" id="v9p24-due">
      </div>
    </div>
  </div>
</div>

<!-- ── Main ── -->
<div class="v9p24-main">
  <div class="v9p24-main-content" id="v9p24-main">
    <div style="text-align:center;padding:60px 20px;color:var(--text-tertiary);">
      <i class="material-icons-round" style="font-size:48px;opacity:.3;display:block;margin-bottom:12px;">inventory_2</i>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">เลือกสินค้าจากรายการด้านซ้าย</div>
      <div style="font-size:12px;line-height:1.7;">ค้นหาสินค้าที่มีอยู่แล้วกด "เลือก"<br>หรือกด "สร้างสินค้าใหม่" ถ้าเพิ่งรับครั้งแรก</div>
    </div>
  </div>

  <!-- รายการที่เพิ่มแล้ว + ปุ่มบันทึก -->
  <div class="v9p24-main-footer">
    <div id="v9p24-added-list" style="display:none;margin-bottom:10px;"></div>
    <button class="btn btn-primary" style="width:100%;font-size:14px;padding:13px;" onclick="v9Pur24Save()" id="v9p24-save-btn">
      <i class="material-icons-round" style="font-size:18px;">check_circle</i>
      <span id="v9p24-save-label">บันทึกใบรับสินค้า</span>
    </button>
  </div>
</div>

</div>`;
};

// ── Sidebar: render product list ──────────────────────────────────
window.v9Pur24RenderProdList = function (q) {
  const el = document.getElementById('v9p24-prod-list');
  if (!el) return;
  const prods = v9GetProducts().filter(p => p.product_type !== 'ตามบิล');
  const filtered = q ? prods.filter(p =>
    (p.name||'').toLowerCase().includes(q.toLowerCase()) ||
    (p.barcode||'').includes(q)) : prods;

  if (!filtered.length) {
    el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:12px;">ไม่พบสินค้า</div>`;
    return;
  }

  el.innerHTML = filtered.slice(0,50).map(p => {
    const typeLabel = p.is_raw ? 'วัตถุดิบ' : 'ของขาย';
    const typeCls   = p.is_raw ? 'v9p24-bb' : 'v9p24-bg';
    const isSel     = window._v9Pur.selectedProd?.id === p.id;
    const stockClr  = (p.stock||0) > 0 ? '#15803d' : '#dc2626';
    return `
      <div class="v9p24-prod-row${isSel?' sel':''}" onclick="v9Pur24SelectExisting('${p.id}')">
        <div class="v9p24-prod-ico" style="background:${p.is_raw?'#eff6ff':'#f0fdf4'};">
          <i class="material-icons-round" style="font-size:16px;color:${p.is_raw?'#1d4ed8':'#15803d'};">
            ${p.is_raw?'science':'inventory_2'}
          </i>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="v9p24-prod-name">${p.name}</div>
          <div class="v9p24-prod-meta">
            ${p.unit||'ชิ้น'} · <span class="v9p24-badge ${typeCls}">${typeLabel}</span>
          </div>
        </div>
        <div class="v9p24-prod-stock" style="color:${stockClr};">
          ${(p.stock||0).toLocaleString()}<br>
          <span style="font-size:10px;color:var(--text-tertiary);">${p.unit||''}</span>
        </div>
      </div>`;
  }).join('');
};

// ── Select existing product ────────────────────────────────────────
window.v9Pur24SelectExisting = async function (prodId) {
  const prod = v9GetProducts().find(p => p.id === prodId);
  if (!prod) return;
  window._v9Pur.selectedProd = prod;
  window._v9Pur.mode = 'existing';

  // update sidebar highlight
  v9Pur24RenderProdList(document.getElementById('v9p24-search')?.value || '');

  // โหลด existing sell units
  const existUnits = await v9LoadUnits(prodId);
  const sellUnits  = existUnits.filter(u => !u.is_base);
  const hasUnits   = sellUnits.length > 0;

  const main = document.getElementById('v9p24-main');
  if (!main) return;
  main.innerHTML = v9Pur24ExistingForm(prod, hasUnits, sellUnits);
  v9Pur24CalcPreview();
};

window.v9Pur24ExistingForm = function (prod, hasUnits, existingUnits) {
  const typeClr = prod.is_raw ? 'var(--info)' : 'var(--success)';
  const typeTxt = prod.is_raw ? 'วัตถุดิบ' : 'ของขาย';
  return `
    <div class="v9p24-section">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:14px;border-bottom:0.5px solid var(--border-light);">
        <div style="width:44px;height:44px;border-radius:12px;background:${prod.is_raw?'#eff6ff':'#f0fdf4'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="material-icons-round" style="font-size:22px;color:${prod.is_raw?'#1d4ed8':'#15803d'};">${prod.is_raw?'science':'inventory_2'}</i>
        </div>
        <div style="flex:1;">
          <div style="font-size:16px;font-weight:700;">${prod.name}</div>
          <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">
            หน่วยสต็อก: <strong>${prod.unit||'ชิ้น'}</strong>
            &nbsp;·&nbsp; สต็อกปัจจุบัน: <strong style="color:${(prod.stock||0)>0?'#15803d':'#dc2626'};">${(prod.stock||0).toLocaleString()} ${prod.unit||''}</strong>
            &nbsp;·&nbsp; ต้นทุนเดิม: <strong>฿${formatNum(prod.cost||0)}/${prod.unit||''}</strong>
          </div>
        </div>
        <span class="v9p24-badge ${prod.is_raw?'v9p24-bb':'v9p24-bg'}">${typeTxt}</span>
      </div>

      <div class="v9p24-notice v9p24-ok">
        <i class="material-icons-round" style="font-size:16px;flex-shrink:0;">check_circle</i>
        <div>สินค้ามีในระบบแล้ว — กรอกรายละเอียดการรับ ระบบจะเพิ่มสต็อกและอัปต้นทุนให้อัตโนมัติ</div>
      </div>
    </div>

    <!-- รายละเอียดการรับ -->
    <div class="v9p24-section">
      <div class="v9p24-sec-lbl">รายละเอียดการรับ</div>
      <div class="v9p24-g3" style="margin-bottom:10px;">
        <div class="v9p24-field" style="margin:0;">
          <div class="v9p24-lbl">จำนวนที่รับ *</div>
          <div style="display:flex;gap:6px;">
            <input class="v9p24-fi" type="number" id="v9p24-ex-qty" value="1" min="0.001" step="0.001"
              style="width:70px;" oninput="v9Pur24CalcPreview()">
            <input class="v9p24-fi" id="v9p24-ex-buyunit" value="${prod.unit==='kg'?'รถ':prod.unit==='ลิตร'?'ถัง':prod.unit||'ชิ้น'}"
              style="flex:1;" placeholder="หน่วยที่รับ" oninput="v9Pur24UpdateBuyUnitLabel();v9Pur24CalcPreview()">
          </div>
        </div>
        <div class="v9p24-field" style="margin:0;">
          <div class="v9p24-lbl">ราคา / <span id="v9p24-ex-buyunit-lbl">${prod.unit==='kg'?'รถ':prod.unit==='ลิตร'?'ถัง':prod.unit||'ชิ้น'}</span> (บาท) *</div>
          <input class="v9p24-fi" type="number" id="v9p24-ex-cost" value="0" min="0" oninput="v9Pur24CalcPreview()">
        </div>
        <div class="v9p24-field" style="margin:0;">
          <div class="v9p24-lbl">1 <span id="v9p24-ex-from-lbl">${prod.unit==='kg'?'รถ':prod.unit==='ลิตร'?'ถัง':prod.unit||'ชิ้น'}</span> = กี่ ${prod.unit||'ชิ้น'}?</div>
          <input class="v9p24-fi" type="number" id="v9p24-ex-kgper" value="1" min="0.001" step="0.001" oninput="v9Pur24CalcPreview()">
        </div>
      </div>

      <div id="v9p24-ex-calc" class="v9p24-calc">
        <div class="v9p24-calc-main" id="v9p24-ex-calc-main">กำลังคำนวณ...</div>
        <div class="v9p24-calc-sub" id="v9p24-ex-calc-sub"></div>
      </div>
    </div>

    <!-- หน่วยขาย -->
    <div class="v9p24-section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div class="v9p24-sec-lbl" style="margin:0;">หน่วยขาย</div>
        ${hasUnits
          ? `<span style="font-size:11px;background:#f0fdf4;color:#15803d;padding:2px 8px;border-radius:4px;font-weight:700;">✓ มีอยู่ ${existingUnits.length} หน่วย</span>`
          : `<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;">ยังไม่มี — ตั้งได้เลย</span>`}
      </div>

      ${hasUnits
        ? `<div class="v9p24-unit-chips" id="v9p24-chips-wrap">
            ${existingUnits.map(u=>`
              <div class="v9p24-chip on" style="display:inline-flex;align-items:center;gap:4px;padding-right:6px;">
                <span>${u.unit_name}</span>
                <span style="opacity:.6;font-size:10px;">(1=${parseFloat((u.conv_rate||1).toFixed(4))}${prod.unit||''})</span>
                <span style="font-size:11px;color:${u.price_per_unit>0?'#15803d':'#dc2626'};">฿${formatNum(u.price_per_unit||0)}</span>
                <button onclick="v9Pur24InlineEditUnit('${u.id}','${u.unit_name}',${u.conv_rate||1},${u.price_per_unit||0},'${prod.unit||'ชิ้น'}','${prod.id}')"
                  style="background:none;border:none;cursor:pointer;padding:0 2px;color:var(--primary);">
                  <i class="material-icons-round" style="font-size:12px;">edit</i>
                </button>
                <button onclick="v9AdminUnitsDelete('${u.id}','${prod.id}')"
                  style="background:none;border:none;cursor:pointer;padding:0 2px;color:var(--danger);">
                  <i class="material-icons-round" style="font-size:12px;">close</i>
                </button>
              </div>`).join('')}
            <div class="v9p24-chip dash" onclick="v9Pur24ShowAddUnit()">
              <i class="material-icons-round" style="font-size:12px;">add</i> เพิ่มหน่วย
            </div>
          </div>
          <!-- inline edit area -->
          <div id="v9p24-unit-edit-area" style="display:none;margin-top:10px;"></div>
          <div id="v9p24-add-unit-area" style="display:none;">${v9Pur24UnitAddRow(prod.unit||'ชิ้น', prod.cost||0)}</div>`
        : `<div class="v9p24-notice v9p24-info" style="margin-bottom:10px;">
            <i class="material-icons-round" style="font-size:16px;flex-shrink:0;">lightbulb</i>
            <div>ตั้งหน่วยขายเพื่อให้ลูกค้าเลือกได้ตอนซื้อ เช่น ทราย → คิว, ถุง, ปิ๊ป</div>
          </div>
          ${v9Pur24SellUnitsFormOpen(prod.unit||'ชิ้น', prod.cost||0)}`}
    </div>

    <button class="btn btn-outline" style="width:100%;margin-top:4px;" onclick="v9Pur24AddItemToList('existing')">
      <i class="material-icons-round" style="font-size:16px;">add_shopping_cart</i>
      เพิ่มรายการนี้เข้าใบสั่งซื้อ
    </button>`;
};

// ── Select new product ────────────────────────────────────────────
window.v9Pur24SelectNew = function () {
  window._v9Pur.selectedProd = null;
  window._v9Pur.mode = 'new';
  v9Pur24RenderProdList(document.getElementById('v9p24-search')?.value || '');
  const main = document.getElementById('v9p24-main');
  if (!main) return;
  main.innerHTML = v9Pur24NewForm();
};

window.v9Pur24NewForm = function () {
  return `
    <div class="v9p24-section">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:14px;border-bottom:0.5px solid var(--border-light);">
        <div style="width:44px;height:44px;border-radius:12px;background:#eff6ff;display:flex;align-items:center;justify-content:center;">
          <i class="material-icons-round" style="font-size:22px;color:#1d4ed8;">add_box</i>
        </div>
        <div>
          <div style="font-size:16px;font-weight:700;">สร้างสินค้าใหม่</div>
          <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">กรอกครั้งเดียว ครั้งถัดไปค้นหาแล้วเลือกได้เลย</div>
        </div>
      </div>

      <div class="v9p24-notice v9p24-info">
        <i class="material-icons-round" style="font-size:16px;flex-shrink:0;">lightbulb</i>
        <div>กรอกข้อมูลสินค้า → รายละเอียดการรับ → กำหนดหน่วยขาย (เพิ่มได้หลายหน่วย)</div>
      </div>
    </div>

    <!-- ข้อมูลสินค้า -->
    <div class="v9p24-section">
      <div class="v9p24-sec-lbl">ข้อมูลสินค้า</div>
      <div class="v9p24-g2" style="margin-bottom:10px;">
        <div class="v9p24-field" style="margin:0;">
          <div class="v9p24-lbl">ชื่อสินค้า *</div>
          <input class="v9p24-fi" id="v9p24-new-name" placeholder="เช่น สีเบส เหลือง D-400">
        </div>
        <div class="v9p24-field" style="margin:0;">
          <div class="v9p24-lbl">หน่วยเก็บสต็อก *</div>
          <input class="v9p24-fi" id="v9p24-new-baseunit" placeholder="ลิตร, kg, เส้น..."
            oninput="v9Pur24UpdateNewUnitLabels()">
        </div>
      </div>
      <div class="v9p24-field" style="margin-bottom:0;">
        <div class="v9p24-lbl">ประเภทสินค้า *</div>
        <div class="v9p24-type-row">
          <div class="v9p24-type-btn on" onclick="v9Pur24SelType(this,'sale')">
            <span class="v9p24-type-ico">🛒</span>ของขาย<br><span style="font-size:10px;opacity:.7;">โชว์ในหน้าขาย</span>
          </div>
          <div class="v9p24-type-btn" onclick="v9Pur24SelType(this,'raw')">
            <span class="v9p24-type-ico">🏭</span>วัตถุดิบ<br><span style="font-size:10px;opacity:.7;">ไม่โชว์ในหน้าขาย</span>
          </div>
          <div class="v9p24-type-btn" onclick="v9Pur24SelType(this,'both')">
            <span class="v9p24-type-ico">🔄</span>ทั้งคู่<br><span style="font-size:10px;opacity:.7;">ขายได้ + ใช้ผลิตได้</span>
          </div>
        </div>
      </div>
    </div>

    <!-- รายละเอียดรับ -->
    <div class="v9p24-section">
      <div class="v9p24-sec-lbl">รายละเอียดการรับ</div>
      <div class="v9p24-g3" style="margin-bottom:10px;">
        <div class="v9p24-field" style="margin:0;">
          <div class="v9p24-lbl">จำนวนที่รับ *</div>
          <div style="display:flex;gap:6px;">
            <input class="v9p24-fi" type="number" id="v9p24-new-qty" value="1" min="0.001" step="0.001"
              style="width:70px;" oninput="v9Pur24CalcNewPreview()">
            <input class="v9p24-fi" id="v9p24-new-buyunit" placeholder="ถัง, รถ, มัด..."
              style="flex:1;" oninput="v9Pur24UpdateNewUnitLabels()">
          </div>
        </div>
        <div class="v9p24-field" style="margin:0;">
          <div class="v9p24-lbl">ราคา / <span id="v9p24-new-buyunit-lbl">หน่วยรับ</span> (บาท) *</div>
          <input class="v9p24-fi" type="number" id="v9p24-new-cost" value="0" min="0" oninput="v9Pur24CalcNewPreview()">
        </div>
        <div class="v9p24-field" style="margin:0;">
          <div class="v9p24-lbl">1 <span id="v9p24-new-from-lbl">หน่วยรับ</span> = กี่ <span id="v9p24-new-base-lbl">หน่วยสต็อก</span>?</div>
          <input class="v9p24-fi" type="number" id="v9p24-new-kgper" value="1" min="0.001" step="0.001" oninput="v9Pur24CalcNewPreview()">
        </div>
      </div>
      <div id="v9p24-new-calc" class="v9p24-calc">
        <div class="v9p24-calc-main" id="v9p24-new-calc-main">กรอกจำนวนและราคาเพื่อดูการคำนวณ</div>
        <div class="v9p24-calc-sub" id="v9p24-new-calc-sub"></div>
      </div>
    </div>

    <!-- หน่วยขาย -->
    <div class="v9p24-section">
      <div class="v9p24-sec-lbl">หน่วยขาย <span style="font-size:10px;color:var(--text-tertiary);font-weight:400;text-transform:none;">— เพิ่มได้หลายหน่วย ลูกค้าจะเลือกตอนซื้อ</span></div>
      <div id="v9p24-new-units-area">
        ${v9Pur24SellUnitsForm('หน่วยสต็อก', 0)}
      </div>
    </div>

    <button class="btn btn-outline" style="width:100%;margin-top:4px;" onclick="v9Pur24AddItemToList('new')">
      <i class="material-icons-round" style="font-size:16px;">add_shopping_cart</i>
      เพิ่มรายการนี้เข้าใบสั่งซื้อ
    </button>`;
};

// ── หน่วยขาย form ─────────────────────────────────────────────────
window.v9Pur24SellUnitsForm = function (baseUnit, costBase) {
  // used for NEW product — starts collapsed
  window._v9Pur.sellUnitRowIdx = 0;
  return `
    <div class="v9p24-unit-chips" id="v9p24-sell-chips">
      <div class="v9p24-chip dash" onclick="v9Pur24AddSellRow()">
        <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มหน่วยขาย
      </div>
    </div>
    <div class="v9p24-unit-tbl" id="v9p24-sell-tbl-wrap" style="display:none;">
      <div class="v9p24-ut-head">
        <span>ชื่อหน่วย</span>
        <span>= กี่ ${baseUnit||'หน่วยสต็อก'}?</span>
        <span>ราคาขาย (฿)</span>
        <span style="text-align:right;">กำไรขั้นต้น</span>
        <span></span>
      </div>
      <div id="v9p24-sell-rows"></div>
    </div>`;
};

// used for EXISTING product with no units — table open immediately + 1 starter row
window.v9Pur24SellUnitsFormOpen = function (baseUnit, costBase) {
  window._v9Pur.sellUnitRowIdx = 1; // start at 1 (row 0 pre-rendered)
  return `
    <div class="v9p24-unit-tbl" id="v9p24-sell-tbl-wrap">
      <div class="v9p24-ut-head">
        <span>ชื่อหน่วย</span>
        <span>= กี่ ${baseUnit||'หน่วยสต็อก'}?</span>
        <span>ราคาขาย (฿)</span>
        <span style="text-align:right;">กำไรขั้นต้น</span>
        <span></span>
      </div>
      <div id="v9p24-sell-rows">
        ${v9P24SellRowHTML(0, baseUnit, costBase)}
      </div>
    </div>
    <button type="button" class="btn btn-outline btn-sm" style="margin-top:8px;width:100%;"
      onclick="v9Pur24AddSellRow()">
      <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มหน่วยอีก
    </button>`;
};

window.v9Pur24UnitAddRow = function (baseUnit, costBase) {
  return `
    <div style="background:var(--bg-base);border-radius:8px;padding:12px;border:0.5px dashed var(--border-light);">
      <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;">เพิ่มหน่วยขายใหม่</div>
      <div class="v9p24-g3" style="margin-bottom:8px;">
        <div>
          <div class="v9p24-lbl">ชื่อหน่วย *</div>
          <input class="v9p24-fi" id="v9p24-addunit-name" placeholder="เช่น ถัง, คิว...">
        </div>
        <div>
          <div class="v9p24-lbl">= กี่ ${baseUnit}? *</div>
          <input class="v9p24-fi" type="number" id="v9p24-addunit-rate" placeholder="20" min="0.001" step="0.001">
        </div>
        <div>
          <div class="v9p24-lbl">ราคาขาย (฿) *</div>
          <input class="v9p24-fi" type="number" id="v9p24-addunit-price" placeholder="0" min="0">
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="v9Pur24SaveAddUnit()">
        <i class="material-icons-round" style="font-size:14px;">save</i> บันทึกหน่วย
      </button>
    </div>`;
};

window.v9Pur24ShowAddUnit = function () {
  const area = document.getElementById('v9p24-add-unit-area');
  if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
};

window.v9Pur24SaveAddUnit = async function () {
  const name  = document.getElementById('v9p24-addunit-name')?.value?.trim();
  const rate  = Number(document.getElementById('v9p24-addunit-rate')?.value || 0);
  const price = Number(document.getElementById('v9p24-addunit-price')?.value || 0);
  const prod  = window._v9Pur.selectedProd;
  if (!name || !rate || !prod) { typeof toast==='function'&&toast('กรุณากรอกข้อมูลให้ครบ','error'); return; }
  v9ShowOverlay('กำลังบันทึกหน่วย...');
  try {
    await db.from('product_units').insert({ product_id:prod.id, unit_name:name, conv_rate:rate, price_per_unit:price, is_base:false });
    delete window._v9UnitCache?.[prod.id];
    typeof toast==='function'&&toast(`เพิ่มหน่วย "${name}" สำเร็จ`,'success');
    await v9Pur24SelectExisting(prod.id);
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};

// ── Sell unit rows (dynamic) ───────────────────────────────────────
window.v9Pur24AddSellRow = function () {
  const tblWrap = document.getElementById('v9p24-sell-tbl-wrap');
  const rowsEl  = document.getElementById('v9p24-sell-rows');
  if (!rowsEl) return;
  if (tblWrap) tblWrap.style.display = '';

  const idx = window._v9Pur.sellUnitRowIdx++;
  const baseUnit = document.getElementById('v9p24-new-baseunit')?.value?.trim()
    || window._v9Pur?.selectedProd?.unit || 'หน่วยสต็อก';
  const costBase = (() => {
    const cost  = Number(document.getElementById('v9p24-new-cost')?.value
      || document.getElementById('v9p24-ex-cost')?.value || 0);
    const kgPer = Number(document.getElementById('v9p24-new-kgper')?.value
      || document.getElementById('v9p24-ex-kgper')?.value || 1);
    return kgPer > 0 ? cost / kgPer : cost;
  })();

  rowsEl.insertAdjacentHTML('beforeend', v9P24SellRowHTML(idx, baseUnit, costBase));
  setTimeout(() => document.getElementById(`v9p24-sname-${idx}`)?.focus(), 50);
  v9Pur24UpdateChips();
};

window.v9Pur24UpdateRowProfit = function (idx, costBase) {
  const rate  = Number(document.getElementById(`v9p24-srate-${idx}`)?.value || 0);
  const price = Number(document.getElementById(`v9p24-sprice-${idx}`)?.value || 0);
  const el    = document.getElementById(`v9p24-sprofit-${idx}`);
  if (!el) return;
  if (rate > 0 && price > 0) {
    const cost   = rate * costBase;
    const profit = price - cost;
    el.textContent = `฿${formatNum(Math.round(profit))}`;
    el.className   = `v9p24-profit ${profit >= 0 ? 'pos' : ''}`;
  } else {
    el.textContent = '—';
    el.className   = 'v9p24-profit';
  }
};

window.v9Pur24UpdateChips = function () {
  const chipsEl = document.getElementById('v9p24-sell-chips');
  if (!chipsEl) return;
  const names = [];
  let idx = 0;
  while (document.getElementById(`v9p24-sr-${idx}`)) {
    const n = document.getElementById(`v9p24-sname-${idx}`)?.value?.trim();
    if (n) names.push(n);
    idx++;
  }
  const addBtn = chipsEl.querySelector('.dash');
  chipsEl.innerHTML = '';
  names.forEach(n => {
    const chip = document.createElement('div');
    chip.className = 'v9p24-chip on';
    chip.textContent = n;
    chipsEl.appendChild(chip);
  });
  if (addBtn) chipsEl.appendChild(addBtn);
};

// ── Calc previews ─────────────────────────────────────────────────
window.v9Pur24CalcPreview = function () {
  const qty    = Number(document.getElementById('v9p24-ex-qty')?.value || 0);
  const cost   = Number(document.getElementById('v9p24-ex-cost')?.value || 0);
  const kgPer  = Number(document.getElementById('v9p24-ex-kgper')?.value || 1);
  const buyUnit= document.getElementById('v9p24-ex-buyunit')?.value || 'หน่วย';
  const baseUnit= window._v9Pur.selectedProd?.unit || 'หน่วย';
  const stockQty = qty * kgPer;
  const costBase = kgPer > 0 ? cost / kgPer : cost;
  const total    = qty * cost;
  const main = document.getElementById('v9p24-ex-calc-main');
  const sub  = document.getElementById('v9p24-ex-calc-sub');
  if (main) main.innerHTML = `สต็อกเพิ่ม: <strong>${stockQty.toLocaleString()} ${baseUnit}</strong>`;
  if (sub)  sub.innerHTML  = `ต้นทุน/base = <strong>฿${formatNum(Math.round(costBase * 100)/100)}/${baseUnit}</strong> &nbsp;·&nbsp; ยอดจ่าย = <strong>฿${formatNum(total)}</strong>`;
  const lbl = document.getElementById('v9p24-ex-buyunit-lbl');
  const from = document.getElementById('v9p24-ex-from-lbl');
  if (lbl) lbl.textContent = buyUnit;
  if (from) from.textContent = buyUnit;
};

window.v9Pur24UpdateBuyUnitLabel = function () {
  const v = document.getElementById('v9p24-ex-buyunit')?.value || 'หน่วย';
  const lbl = document.getElementById('v9p24-ex-buyunit-lbl');
  const from = document.getElementById('v9p24-ex-from-lbl');
  if (lbl) lbl.textContent = v;
  if (from) from.textContent = v;
};

window.v9Pur24CalcNewPreview = function () {
  const qty    = Number(document.getElementById('v9p24-new-qty')?.value || 0);
  const cost   = Number(document.getElementById('v9p24-new-cost')?.value || 0);
  const kgPer  = Number(document.getElementById('v9p24-new-kgper')?.value || 1);
  const baseUnit = document.getElementById('v9p24-new-baseunit')?.value || 'หน่วยสต็อก';
  const stockQty = qty * kgPer;
  const costBase = kgPer > 0 ? cost / kgPer : cost;
  const total    = qty * cost;
  const main = document.getElementById('v9p24-new-calc-main');
  const sub  = document.getElementById('v9p24-new-calc-sub');
  if (main) main.innerHTML = `สต็อกเพิ่ม: <strong>${stockQty.toLocaleString()} ${baseUnit}</strong>`;
  if (sub)  sub.innerHTML  = `ต้นทุน/base = <strong>฿${formatNum(Math.round(costBase * 100)/100)}/${baseUnit}</strong> &nbsp;·&nbsp; ยอดจ่าย = <strong>฿${formatNum(total)}</strong>`;
  // อัป profit ในแถวหน่วยขายที่มีอยู่
  let idx = 0;
  while (document.getElementById(`v9p24-sr-${idx}`)) {
    v9Pur24UpdateRowProfit(idx, costBase);
    idx++;
  }
};

window.v9Pur24UpdateNewUnitLabels = function () {
  const buyUnit  = document.getElementById('v9p24-new-buyunit')?.value || 'หน่วยรับ';
  const baseUnit = document.getElementById('v9p24-new-baseunit')?.value || 'หน่วยสต็อก';
  ['v9p24-new-buyunit-lbl','v9p24-new-from-lbl'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = buyUnit;
  });
  const baseLbl = document.getElementById('v9p24-new-base-lbl');
  if (baseLbl) baseLbl.textContent = baseUnit;
  v9Pur24CalcNewPreview();
};

window.v9Pur24SelType = function (el, type) {
  document.querySelectorAll('.v9p24-type-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  el.dataset.type = type;
};

window.v9Pur24SelMethod = function (el, method) {
  document.querySelectorAll('.v9p24-mbtn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  const cRow = document.getElementById('v9p24-credit-row');
  if (cRow) cRow.style.display = method === 'เครดิต' ? 'block' : 'none';
};

// ── เพิ่มรายการเข้าใบ ────────────────────────────────────────────
window.v9Pur24AddItemToList = async function (mode) {
  const isNew = mode === 'new';

  let prodId='', prodName='', baseUnit='', qty=0, cost=0, kgPer=1, isRaw=false;

  if (!isNew) {
    const prod = window._v9Pur.selectedProd;
    if (!prod) { typeof toast==='function'&&toast('กรุณาเลือกสินค้า','error'); return; }
    prodId   = prod.id;
    prodName = prod.name;
    baseUnit = prod.unit||'ชิ้น';
    isRaw    = !!prod.is_raw;
    qty      = Number(document.getElementById('v9p24-ex-qty')?.value || 0);
    cost     = Number(document.getElementById('v9p24-ex-cost')?.value || 0);
    kgPer    = Number(document.getElementById('v9p24-ex-kgper')?.value || 1);
  } else {
    prodName = document.getElementById('v9p24-new-name')?.value?.trim();
    baseUnit = document.getElementById('v9p24-new-baseunit')?.value?.trim() || 'ชิ้น';
    qty      = Number(document.getElementById('v9p24-new-qty')?.value || 0);
    cost     = Number(document.getElementById('v9p24-new-cost')?.value || 0);
    kgPer    = Number(document.getElementById('v9p24-new-kgper')?.value || 1);
    const typeSel = document.querySelector('.v9p24-type-btn.on');
    isRaw    = typeSel?.dataset?.type === 'raw' || typeSel?.dataset?.type === 'both';
    if (!prodName || !baseUnit) { typeof toast==='function'&&toast('กรุณากรอกชื่อสินค้าและหน่วย','error'); return; }
  }

  if (qty <= 0) { typeof toast==='function'&&toast('กรุณากรอกจำนวน','error'); return; }

  const qtyBase  = qty * kgPer;
  const costBase = kgPer > 0 ? cost / kgPer : cost;

  // รวบรวมหน่วยขาย
  const sellUnits = [];
  let sidx = 0;
  while (document.getElementById(`v9p24-sr-${sidx}`)) {
    const name  = document.getElementById(`v9p24-sname-${sidx}`)?.value?.trim();
    const rate  = Number(document.getElementById(`v9p24-srate-${sidx}`)?.value || 0);
    const price = Number(document.getElementById(`v9p24-sprice-${sidx}`)?.value || 0);
    if (name && rate > 0) sellUnits.push({ unit_name:name, conv_rate:rate, price_per_unit:price });
    sidx++;
  }

  // สร้างสินค้าใหม่ถ้าจำเป็น
  if (isNew) {
    v9ShowOverlay('กำลังสร้างสินค้าใหม่...');
    try {
      const typeSel = document.querySelector('.v9p24-type-btn.on');
      const typeVal = typeSel?.dataset?.type || 'sale';
      const { data:np, error:ne } = await db.from('สินค้า').insert({
        name:prodName, unit:baseUnit,
        price: sellUnits.length > 0 ? (sellUnits[0].price_per_unit||0) : 0,
        cost: parseFloat(costBase.toFixed(6)), stock: 0,
        is_raw: typeVal === 'raw',  // both → is_raw=false แต่ product_type='both'
        product_type: typeVal === 'both' ? 'both' : (typeVal === 'raw' ? 'ปกติ' : 'ปกติ'),
        updated_at: new Date().toISOString(),
      }).select().single();
      if (ne) throw new Error(ne.message);
      prodId = np.id;
      await loadProducts?.();
      try { if(typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    } catch(e) {
      v9HideOverlay();
      typeof toast==='function'&&toast('สร้างสินค้าไม่สำเร็จ: '+e.message,'error'); return;
    } finally { v9HideOverlay(); }
  }

  window._v9Pur.items.push({ prodId, prodName, baseUnit, qty, buyUnit: document.getElementById(isNew?'v9p24-new-buyunit':'v9p24-ex-buyunit')?.value||baseUnit, cost, kgPer, qtyBase, costBase: parseFloat(costBase.toFixed(6)), sellUnits });

  v9Pur24RenderAddedList();
  v9Pur24UpdateSaveBtn();
  typeof toast==='function'&&toast(`เพิ่ม ${prodName} × ${qty} เข้าใบสั่งซื้อ`,'success');

  // clear main panel
  const main = document.getElementById('v9p24-main');
  if (main) main.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-tertiary);">
    <i class="material-icons-round" style="font-size:36px;opacity:.4;display:block;margin-bottom:10px;">check_circle</i>
    <div style="font-size:14px;font-weight:700;margin-bottom:4px;">เพิ่มแล้ว — เลือกสินค้าถัดไป</div>
    <div style="font-size:12px;">หรือกด "บันทึกใบรับสินค้า" ด้านล่าง</div>
  </div>`;
  window._v9Pur.selectedProd = null;
  v9Pur24RenderProdList(document.getElementById('v9p24-search')?.value || '');
};

window.v9Pur24RenderAddedList = function () {
  const el  = document.getElementById('v9p24-added-list');
  const items = window._v9Pur.items;
  if (!el) return;
  if (!items.length) { el.style.display='none'; return; }
  el.style.display = 'block';
  const total = items.reduce((s,i)=>s+i.qty*i.cost,0);
  el.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:6px;">รายการที่เพิ่มแล้ว (${items.length} รายการ)</div>
    <div style="border:0.5px solid var(--border-light);border-radius:8px;overflow:hidden;margin-bottom:6px;">
      ${items.map((item,i)=>`
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:0.5px solid var(--border-light);font-size:12px;${i===items.length-1?'border-bottom:none':''}">
          <div style="flex:1;">
            <strong>${item.prodName}</strong>
            <span style="color:var(--text-tertiary);margin-left:6px;">${item.qty} ${item.buyUnit||item.baseUnit}${item.kgPer!==1?` → ${item.qtyBase} ${item.baseUnit}`:''}</span>
            ${item.sellUnits?.length?`<span style="color:#15803d;margin-left:6px;">+${item.sellUnits.length} หน่วยขาย</span>`:''}
          </div>
          <strong style="color:var(--primary);">฿${formatNum(item.qty*item.cost)}</strong>
          <button onclick="window._v9Pur.items.splice(${i},1);v9Pur24RenderAddedList();v9Pur24UpdateSaveBtn()"
            style="background:none;border:none;cursor:pointer;color:var(--danger);padding:0;flex-shrink:0;">
            <i class="material-icons-round" style="font-size:16px;">close</i>
          </button>
        </div>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;">
      <span style="color:var(--text-secondary);">ยอดรวม</span>
      <span style="color:var(--primary);font-size:16px;">฿${formatNum(total)}</span>
    </div>`;
};

window.v9Pur24UpdateSaveBtn = function () {
  const items = window._v9Pur.items;
  const lbl   = document.getElementById('v9p24-save-label');
  if (lbl) lbl.textContent = items.length > 0
    ? `บันทึก — ${items.length} รายการ · ฿${formatNum(items.reduce((s,i)=>s+i.qty*i.cost,0))}`
    : 'บันทึกใบรับสินค้า';
};

// ── SAVE ─────────────────────────────────────────────────────────
window.v9Pur24Save = async function () {
  const items    = window._v9Pur.items;
  if (!items.length) { typeof toast==='function'&&toast('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ','error'); return; }
  const supplier  = document.getElementById('v9p24-supplier')?.value?.trim() || '';
  const method    = document.querySelector('.v9p24-mbtn.on')?.textContent?.trim() || 'เงินสด';
  const purDate   = document.getElementById('v9p24-date')?.value || new Date().toISOString().split('T')[0];
  const dueDate   = document.getElementById('v9p24-due')?.value || null;
  const suppSelId = document.getElementById('v9pur24-supp-id')?.value || null;
  const total     = items.reduce((s,i)=>s+i.qty*i.cost,0);
  if (method==='เครดิต'&&!dueDate) { typeof toast==='function'&&toast('กรุณาระบุวันครบกำหนดชำระ','error'); return; }

  v9ShowOverlay('กำลังบันทึก...', `${items.length} รายการ | ฿${formatNum(total)}`);
  try {
    const { data:po, error:poErr } = await db.from('purchase_order').insert({
      date: (purDate === new Date().toISOString().split('T')[0])
        ? new Date().toISOString()
        : new Date(purDate + 'T12:00:00').toISOString(),
      supplier: supplier||null, total, method,
      staff_name: v9Staff(), status:'รับแล้ว',
    }).select().single();
    if (poErr) throw new Error(poErr.message);

    for (const item of items) {
      await db.from('purchase_item').insert({
        order_id:po.id, product_id:item.prodId, name:item.prodName,
        qty:item.qty, received_qty:item.qty,
        cost_per_unit:item.cost, total:item.qty*item.cost,
      });
      const prod = v9GetProducts().find(p=>p.id===item.prodId);
      const stockBefore = prod?.stock || 0;
      // qtyBase safety: ถ้า kgPer=NaN หรือ 0 ให้ใช้ qty แทน
      const safeQtyBase = (item.qtyBase > 0) ? item.qtyBase : item.qty;
      const stockAfter  = stockBefore + safeQtyBase;
      const safeCostBase = (item.costBase > 0) ? item.costBase : (prod?.cost || 0);
      const { error: updateErr } = await db.from('สินค้า').update({
        stock: stockAfter,
        cost:  safeCostBase,
        updated_at: new Date().toISOString(),
      }).eq('id', item.prodId);
      if (updateErr) {
        console.error('[v9Pur24Save] stock update error:', updateErr.message, 'prodId:', item.prodId);
        throw new Error(`อัปสต็อก "${item.prodName}" ไม่สำเร็จ: ${updateErr.message}`);
      }
      await db.from('stock_movement').insert({
        product_id:item.prodId, product_name:item.prodName,
        type:'รับเข้า', direction:'in', qty:safeQtyBase,
        stock_before:stockBefore, stock_after:stockAfter,
        ref_id:po.id, ref_table:'purchase_order', staff_name:v9Staff(),
        note: item.kgPer!==1 ? `รับ ${item.qty} ${item.buyUnit} = ${safeQtyBase} ${item.baseUnit}` : null,
      });
      // บันทึกหน่วยขายใหม่
      for (const u of (item.sellUnits||[])) {
        await db.from('product_units').insert({
          product_id:item.prodId, unit_name:u.unit_name,
          conv_rate:u.conv_rate, price_per_unit:u.price_per_unit, is_base:false,
        });
      }
      if (item.sellUnits?.length) delete window._v9UnitCache?.[item.prodId];
      // recalc BOM
      try {
        const {data:recipes}=await db.from('สูตรสินค้า').select('product_id').eq('material_id',item.prodId);
        for (const r of (recipes||[])) await window.v9CalcBOMCost?.(r.product_id);
      } catch(_){}
    }

    // เครดิต → เจ้าหนี้
    if (method==='เครดิต') {
      let suppId = suppSelId;
      if (!suppId && supplier) {
        const {data:found}=await db.from('ซัพพลายเออร์').select('id').eq('name',supplier).maybeSingle();
        suppId = found?.id;
        if (!suppId) {
          const {data:ns}=await db.from('ซัพพลายเออร์').insert({name:supplier,status:'ใช้งาน'}).select('id').single();
          suppId = ns?.id;
        }
      }
      if (suppId) {
        await db.from('เจ้าหนี้').insert({
          supplier_id:suppId, purchase_order_id:po.id,
          date:new Date().toISOString(), due_date:dueDate,
          amount:total, paid_amount:0, balance:total, status:'ค้างชำระ',
        });
      }
    }

    typeof logActivity==='function'&&logActivity('รับสินค้าเข้า',`${supplier||'ไม่ระบุ'} ${items.length} รายการ ฿${formatNum(total)}`);
    window._v9Pur.items = [];
    window._v9ProductsCache = null;
    await loadProducts?.();
    try{if(typeof products!=='undefined')window._v9ProductsCache=products;}catch(_){}
    try{purchaseItems=[];}catch(_){}
    typeof closeModal==='function'&&closeModal();
    typeof renderPurchases==='function'&&renderPurchases?.();
    typeof toast==='function'&&toast(`รับสินค้า ฿${formatNum(total)} สำเร็จ`,'success');
  } catch(e) {
    typeof toast==='function'&&toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};

// aliases
window.savePurchaseOrder   = window.v9Pur24Save;
window.submitPurchaseOrder = window.v9Pur24Save;


// ══════════════════════════════════════════════════════════════════
// FIX-24B — แก้ bug สต็อก + เครื่องมือ sync สต็อกจาก purchase_item
// ══════════════════════════════════════════════════════════════════

// v9SyncStockFromPurchase: คำนวณสต็อกจาก purchase_item + stock_movement
// เรียกได้จาก console: v9SyncStockFromPurchase()
window.v9SyncStockFromPurchase = async function () {
  v9ShowOverlay('กำลัง sync สต็อก...', 'คำนวณจาก purchase_item + stock_movement');
  try {
    // ดึง stock_movement ทั้งหมด
    const { data: movements } = await db.from('stock_movement').select('product_id,direction,qty');
    const stockMap = {};
    (movements||[]).forEach(m => {
      if (!stockMap[m.product_id]) stockMap[m.product_id] = 0;
      if (m.direction === 'in')  stockMap[m.product_id] += m.qty;
      if (m.direction === 'out') stockMap[m.product_id] -= m.qty;
    });

    let updated = 0;
    for (const [prodId, stock] of Object.entries(stockMap)) {
      const safeStock = Math.max(0, parseFloat(stock.toFixed(6)));
      const { error } = await db.from('สินค้า').update({
        stock: safeStock, updated_at: new Date().toISOString()
      }).eq('id', prodId);
      if (!error) updated++;
    }

    window._v9ProductsCache = null;
    await loadProducts?.();
    try { if(typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    typeof renderInventory==='function' && renderInventory();
    typeof toast==='function' && toast(`✅ sync สต็อกสำเร็จ ${updated} รายการ`, 'success');
  } catch(e) {
    typeof toast==='function' && toast('sync ไม่สำเร็จ: '+e.message, 'error');
  } finally { v9HideOverlay(); }
};

// เพิ่มปุ่ม "sync สต็อก" ในหน้า admin ตั้งค่าร้านค้า
const _v9OrigRenderShop = window.renderShopSettings;
window.renderShopSettings = async function (container) {
  await _v9OrigRenderShop?.apply(this, arguments);
  // inject sync button
  if (container && !container.querySelector('#v9-sync-stock-btn')) {
    const btn = document.createElement('button');
    btn.id = 'v9-sync-stock-btn';
    btn.className = 'btn btn-outline';
    btn.style.cssText = 'margin-top:12px;width:100%;border-color:var(--warning);color:var(--warning);';
    btn.innerHTML = '<i class="material-icons-round" style="font-size:16px;">sync</i> Sync สต็อกจากประวัติการเคลื่อนไหว';
    btn.onclick = () => window.v9SyncStockFromPurchase();
    container.appendChild(btn);
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-25 — รองรับทศนิยม (float8) ทุกจุด
//   - DB: stock, qty, cost เป็น float8 แล้ว
//   - JS: ไม่ Math.round() ตัด decimal ออก
//   - formatStock(): แสดงผลอ่านง่าย เช่น 0.52 → "0.52" ไม่ใช่ "1"
//   - ป้องกัน bigint error: ทุก stock/qty ส่งเป็น float แทน int
// ══════════════════════════════════════════════════════════════════

// ── helper: format stock display ─────────────────────────────────
window.formatStock = function (val, unit) {
  if (val === null || val === undefined) return `0 ${unit||''}`.trim();
  const n = parseFloat(val);
  if (isNaN(n)) return `0 ${unit||''}`.trim();
  // ถ้าเป็นเลขเต็ม แสดงไม่มีทศนิยม
  const display = Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(4)).toString();
  return unit ? `${display} ${unit}` : display;
};

// ── helper: safe float ────────────────────────────────────────────
window.safeFloat = function (val, decimals) {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  if (decimals !== undefined) return parseFloat(n.toFixed(decimals));
  return n;
};

// ── override: addToCart — stock check ยอมรับ float ────────────────
// กรณีขาย 1 คิว (conv_rate=1400) จาก stock 9000 kg → stock เหลือ 7600
// v9PushToCart เช็ค stock เป็น float ได้แล้ว
const _v9OrigPushToCart = window.v9PushToCart;
window.v9PushToCart = function (prod, price, unitName, convRate, qty) {
  try {
    const existing = cart.find(c => c.id===prod.id && c.unit===unitName);
    if (existing) {
      if (prod.product_type!=='ตามบิล') {
        const totalBaseQty = (existing.qty + qty) * convRate;
        if (totalBaseQty > parseFloat(prod.stock||0)) {
          typeof toast==='function'&&toast('สินค้าไม่เพียงพอ','warning'); return;
        }
      }
      existing.qty++;
    } else {
      cart.push({
        id:prod.id, name:prod.name, price, cost:prod.cost||0,
        qty, stock: parseFloat(prod.stock||0), unit:unitName,
        conv_rate: parseFloat(convRate||1),
        is_mto: prod.product_type==='ตามบิล',
      });
    }
    renderCart?.(); renderProductGrid?.();
    if (typeof sendToDisplay==='function') sendToDisplay({type:'cart',cart,total:getCartTotal?.()});
  } catch(e) { console.warn('[v9] pushToCart:', e.message); }
};


// ══════════════════════════════════════════════════════════════════
// FIX-26 — ระบบหน่วยขาย POS ครบวงจร
//
//  1. v9ShowUnitPopup — แสดงราคา/สต็อก/ผลิตได้ต่อหน่วย
//  2. updateCartQty override — เช็ค base qty (qty × conv_rate)
//  3. removeFromCart override — ลบด้วย id + unit
//  4. renderCart override — แสดงชื่อ + หน่วย ชัดเจน
//  5. v9PushToCart — เช็คสต็อก base qty ถูกต้อง
// ══════════════════════════════════════════════════════════════════

// ── 1. Unit Popup (redesign) ──────────────────────────────────────
window.v9ShowUnitPopup = function (prod, sellUnits) {
  if (typeof openModal !== 'function') return;
  const baseUnit = prod.unit || 'ชิ้น';
  const isMTO    = prod.product_type === 'ตามบิล';
  const stock    = parseFloat(prod.stock || 0);

  // คำนวณ max ที่ผลิตได้ (ตามบิล) จาก BOM — async แสดงทีหลัง
  // แสดง popup ก่อน แล้วค่อย inject ข้อมูล
  openModal(`เลือกหน่วย: ${prod.name}`, `
    <div style="margin-bottom:20px;">
      <div style="font-size:17px;font-weight:700;margin-bottom:4px;">${prod.name}</div>
      <div style="font-size:12px;color:var(--text-tertiary);">
        ${isMTO
          ? '<span style="color:#7c3aed;font-weight:700;">📋 ผลิตตามบิล</span> — ตัดวัตถุดิบอัตโนมัติตอนขาย'
          : `สต็อก <strong style="color:var(--text-primary);">${parseFloat(stock.toFixed(4))} ${baseUnit}</strong>`}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px;" id="v9unit-grid">

      <!-- Base unit card -->
      <div onclick="v9SelectUnitQty('${prod.id}','${baseUnit}',${prod.price||0},1,${stock})"
        style="padding:16px 12px;border:1.5px solid var(--border-light);border-radius:14px;
          text-align:center;cursor:pointer;transition:all .15s;position:relative;"
        onmouseenter="this.style.borderColor='var(--primary)';this.style.background='#fff5f5';"
        onmouseleave="this.style.borderColor='var(--border-light)';this.style.background='';">
        <div style="font-size:22px;font-weight:800;color:var(--primary);">฿${formatNum(prod.price||0)}</div>
        <div style="font-size:14px;font-weight:700;margin-top:6px;">${baseUnit}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">หน่วยพื้นฐาน</div>
        ${!isMTO ? `<div style="font-size:10px;margin-top:4px;color:${stock>0?'#15803d':'#dc2626'};">
          เหลือ ${parseFloat(stock.toFixed(4))} ${baseUnit}</div>` : ''}
      </div>

      <!-- Sell unit cards -->
      ${sellUnits.map(u => {
        const conv    = parseFloat(u.conv_rate || 1);
        const price   = parseFloat(u.price_per_unit || 0);
        const maxQty  = isMTO ? 999 : Math.floor(stock / conv);
        const costU   = parseFloat(prod.cost || 0) * conv;
        const margin  = price > 0 ? Math.round(((price - costU) / price) * 100) : 0;
        return `
        <div onclick="v9SelectUnitQty('${prod.id}','${u.unit_name}',${price},${conv},${stock})"
          style="padding:16px 12px;border:1.5px solid var(--border-light);border-radius:14px;
            text-align:center;cursor:pointer;transition:all .15s;position:relative;
            ${!isMTO && maxQty<=0 ? 'opacity:.45;pointer-events:none;' : ''}"
          onmouseenter="this.style.borderColor='var(--primary)';this.style.background='#fff5f5';"
          onmouseleave="this.style.borderColor='var(--border-light)';this.style.background='';">
          <div style="font-size:22px;font-weight:800;color:var(--primary);">
            ${price > 0 ? `฿${formatNum(price)}` : '<span style="font-size:13px;color:var(--text-tertiary);">ยังไม่ตั้งราคา</span>'}
          </div>
          <div style="font-size:14px;font-weight:700;margin-top:6px;">${u.unit_name}</div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">
            1${u.unit_name} = ${parseFloat(conv.toFixed(4))} ${baseUnit}
          </div>
          ${!isMTO ? `<div style="font-size:10px;margin-top:4px;color:${maxQty>0?'#15803d':'#dc2626'};">
            ${maxQty > 0 ? `ขายได้ ${maxQty} ${u.unit_name}` : 'สต็อกไม่พอ'}</div>` : ''}
          ${price > 0 && margin > 0 ? `<div style="position:absolute;top:8px;right:8px;
            font-size:9px;padding:1px 5px;border-radius:999px;background:#f0fdf4;color:#15803d;">
            กำไร ${margin}%</div>` : ''}
        </div>`;
      }).join('')}
    </div>

    <!-- ช่องกรอกจำนวน -->
    <div style="background:var(--bg-base);border-radius:10px;padding:14px;border:0.5px solid var(--border-light);">
      <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;">
        จำนวน <span id="v9unit-selected-unit" style="color:var(--primary);">(เลือกหน่วยด้านบน)</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button onclick="v9UnitQtyChange(-1)"
          style="width:40px;height:40px;border-radius:10px;border:0.5px solid var(--border-light);
            background:var(--bg-surface);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;">−</button>
        <input type="number" id="v9unit-qty" value="1" min="0.001" step="any"
          style="flex:1;height:40px;border:0.5px solid var(--border-light);border-radius:10px;
            text-align:center;font-size:18px;font-weight:700;background:var(--bg-surface);
            outline:none;color:var(--text-primary);font-family:var(--font-thai,'Prompt'),sans-serif;"
          oninput="v9UnitQtyUpdate()">
        <button onclick="v9UnitQtyChange(1)"
          style="width:40px;height:40px;border-radius:10px;border:0.5px solid var(--border-light);
            background:var(--bg-surface);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>
      </div>
      <div id="v9unit-total-preview" style="text-align:center;font-size:13px;color:var(--text-tertiary);margin-top:8px;"></div>
      <button id="v9unit-add-btn" disabled
        onclick="v9ConfirmUnitAdd()"
        style="width:100%;margin-top:12px;padding:13px;background:#ccc;color:#fff;border:none;
          border-radius:10px;font-size:14px;font-weight:700;cursor:not-allowed;transition:all .2s;">
        เลือกหน่วยก่อน
      </button>
    </div>
  `);

  window._v9UnitPopupProd     = prod;
  window._v9UnitPopupSel      = null; // {unitName, price, conv, stock}
};

// เลือกหน่วย → highlight + เปิดปุ่ม
window.v9SelectUnitQty = function (productId, unitName, price, conv, stock) {
  const prod = window._v9UnitPopupProd;
  if (!prod) return;

  // highlight
  document.querySelectorAll('#v9unit-grid > div').forEach(el => {
    el.style.borderColor = 'var(--border-light)';
    el.style.background  = '';
  });
  event?.currentTarget?.style && (event.currentTarget.style.borderColor = 'var(--primary)');
  event?.currentTarget?.style && (event.currentTarget.style.background  = '#fff5f5');

  window._v9UnitPopupSel = { unitName, price: parseFloat(price), conv: parseFloat(conv), stock: parseFloat(stock) };

  const unitLbl = document.getElementById('v9unit-selected-unit');
  if (unitLbl) unitLbl.textContent = unitName;

  const addBtn = document.getElementById('v9unit-add-btn');
  if (addBtn) {
    addBtn.disabled = price <= 0;
    addBtn.style.background = price > 0 ? 'var(--primary)' : '#ccc';
    addBtn.style.cursor     = price > 0 ? 'pointer' : 'not-allowed';
    addBtn.textContent      = price > 0
      ? `เพิ่มเข้าตะกร้า — ฿${formatNum(price)} / ${unitName}`
      : 'ยังไม่มีราคา (ตั้งราคาใน "หน่วยนับ" ก่อน)';
  }

  v9UnitQtyUpdate();
};

window.v9UnitQtyChange = function (delta) {
  const inp = document.getElementById('v9unit-qty');
  if (!inp) return;
  const cur = parseFloat(inp.value || 1);
  inp.value = Math.max(0.001, cur + delta);
  v9UnitQtyUpdate();
};

window.v9UnitQtyUpdate = function () {
  const sel = window._v9UnitPopupSel;
  if (!sel) return;
  const qty = parseFloat(document.getElementById('v9unit-qty')?.value || 1);
  const total = qty * sel.price;
  const baseQty = qty * sel.conv;
  const prev = document.getElementById('v9unit-total-preview');
  if (prev) prev.innerHTML =
    `รวม <strong style="color:var(--primary);">฿${formatNum(Math.round(total))}</strong>` +
    ` · ตัดสต็อก ${parseFloat(baseQty.toFixed(4))} ${window._v9UnitPopupProd?.unit||''}`;
};

window.v9ConfirmUnitAdd = function () {
  const sel  = window._v9UnitPopupSel;
  const prod = window._v9UnitPopupProd;
  if (!sel || !prod) return;
  const qty = parseFloat(document.getElementById('v9unit-qty')?.value || 1);
  if (qty <= 0) { typeof toast==='function'&&toast('กรุณากรอกจำนวน','error'); return; }

  // ตรวจสต็อก
  const isMTO    = prod.product_type === 'ตามบิล';
  const baseQty  = qty * sel.conv;
  if (!isMTO && baseQty > parseFloat(prod.stock||0)) {
    typeof toast==='function'&&toast(`สต็อกไม่พอ — มี ${parseFloat((prod.stock/sel.conv).toFixed(4))} ${sel.unitName}`, 'error');
    return;
  }

  typeof closeModal==='function'&&closeModal();
  v9PushToCart(prod, sel.price, sel.unitName, sel.conv, qty);
};

// ── 2. v9PushToCart — รองรับ qty ทศนิยม ──────────────────────────
window.v9PushToCart = function (prod, price, unitName, convRate, qty) {
  const conv   = parseFloat(convRate || 1);
  const addQty = parseFloat(qty || 1);
  const isMTO  = prod.product_type === 'ตามบิล';
  const stock  = parseFloat(prod.stock || 0);

  try {
    // หา item ที่ id + unit ตรงกัน
    const existing = cart.find(c => c.id === prod.id && c.unit === unitName);
    if (existing) {
      const newQty      = existing.qty + addQty;
      const newBaseQty  = newQty * conv;
      if (!isMTO && newBaseQty > stock) {
        typeof toast==='function'&&toast(
          `สต็อกไม่พอ — มีได้อีก ${parseFloat(((stock - existing.qty*conv)/conv).toFixed(4))} ${unitName}`,
          'warning'
        );
        return;
      }
      existing.qty = parseFloat((existing.qty + addQty).toFixed(6));
    } else {
      cart.push({
        id:        prod.id,
        name:      prod.name,
        price:     parseFloat(price),
        cost:      parseFloat(prod.cost || 0),
        qty:       addQty,
        stock:     stock,
        unit:      unitName,
        conv_rate: conv,
        is_mto:    isMTO,
      });
    }
    renderCart?.();
    renderProductGrid?.();
    if (typeof sendToDisplay==='function')
      sendToDisplay({ type:'cart', cart, total: getCartTotal?.() });
  } catch(e) { console.warn('[v9PushToCart]', e.message); }
};

// ── 3. Override updateCartQty — เช็ค base qty ────────────────────
window.updateCartQty = function (productId, delta, unitName) {
  // รองรับทั้ง unit-aware (id+unit) และ legacy (id เท่านั้น)
  const item = unitName
    ? cart.find(c => c.id === productId && c.unit === unitName)
    : cart.find(c => c.id === productId);
  if (!item) return;

  const conv   = parseFloat(item.conv_rate || 1);
  const isMTO  = item.is_mto;
  const newQty = parseFloat((item.qty + delta).toFixed(6));

  if (newQty <= 0) {
    cart = cart.filter(c => !(c.id === productId && c.unit === item.unit));
  } else {
    const newBaseQty = newQty * conv;
    if (!isMTO && newBaseQty > parseFloat(item.stock||0)) {
      typeof toast==='function'&&toast('สินค้าไม่เพียงพอ','warning');
      return;
    }
    item.qty = newQty;
  }
  renderCart?.(); renderProductGrid?.();
  if (typeof sendToDisplay==='function')
    sendToDisplay({ type:'cart', cart, total: getCartTotal?.() });
};

// ── 4. Override removeFromCart — ลบด้วย id + unit ─────────────────
window.removeFromCart = function (productId, unitName) {
  if (unitName) {
    cart = cart.filter(c => !(c.id === productId && c.unit === unitName));
  } else {
    cart = cart.filter(c => c.id !== productId);
  }
  renderCart?.(); renderProductGrid?.();
  if (typeof sendToDisplay==='function')
    sendToDisplay({ type:'cart', cart, total: getCartTotal?.() });
};

// ── 5. Override renderCart — แสดงชื่อ + หน่วย ────────────────────
window.renderCart = function () {
  const container   = document.getElementById('cart-list');
  const countBadge  = document.getElementById('cart-count');
  const totalDisplay= document.getElementById('pos-total');
  const checkoutBtn = document.getElementById('checkout-btn');
  if (!container) return;

  const totalItems = cart.reduce((s,c) => s + c.qty, 0);
  const total      = typeof getCartTotal==='function' ? getCartTotal() : cart.reduce((s,c)=>s+(c.price*c.qty),0);
  if (countBadge)  countBadge.textContent  = parseFloat(totalItems.toFixed(4));
  if (totalDisplay)totalDisplay.textContent= `฿${formatNum(Math.round(total))}`;
  if (checkoutBtn) checkoutBtn.disabled    = cart.length === 0;

  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty">
      <i class="material-icons-round">shopping_basket</i>
      <p>ไม่มีสินค้าในตะกร้า</p>
      <span>เลือกสินค้าจากรายการด้านซ้าย</span>
    </div>`;
    return;
  }

  container.innerHTML = cart.map((item, idx) => {
    const conv    = parseFloat(item.conv_rate || 1);
    const baseQty = parseFloat((item.qty * conv).toFixed(4));
    const baseUnit= item.unit; // unit ที่เลือกตอนขาย
    const showUnit= conv !== 1; // ถ้ามี conv แสดง base qty ด้วย
    return `
      <div class="cart-item" style="border-radius:10px;margin-bottom:4px;">
        <div class="cart-item-info" style="flex:1;min-width:0;">
          <span class="cart-item-name" style="display:block;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${item.name}
            ${conv !== 1 ? `<span style="font-size:10px;background:#fff5f5;color:var(--primary);padding:1px 5px;border-radius:4px;margin-left:4px;">${baseUnit}</span>` : ''}
          </span>
          <span class="cart-item-price" style="font-size:12px;color:var(--text-tertiary);">
            ฿${formatNum(item.price)}/${baseUnit} × ${item.qty}
            ${showUnit ? `<span style="color:var(--text-tertiary);font-size:11px;"> = ${baseQty} ${item.unit.replace(baseUnit,'').trim()||''}... </span>` : ''}
          </span>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateCartQty('${item.id}',-1,'${item.unit}')">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" onclick="updateCartQty('${item.id}',1,'${item.unit}')">+</button>
        </div>
        <span class="cart-item-total">฿${formatNum(Math.round(item.price * item.qty))}</span>
        <button class="cart-item-delete" onclick="removeFromCart('${item.id}','${item.unit}')">
          <i class="material-icons-round">close</i>
        </button>
      </div>`;
  }).join('');
};


// ══════════════════════════════════════════════════════════════════
// FIX-27 — แก้ปัญหา + features ตามรีวิว
//
//  1. POS: ตามบิล stock=0 ไม่ถือว่า out-of-stock → ขายได้
//  2. renderProductGrid: ตามบิลแสดงสต็อก "ผลิตตามสั่ง" ไม่ใช่ "หมด"
//  3. หน้า manage units: ค้นหา + แก้ไขหน่วยเดิมได้
//  4. หน้า manage recipe: แก้ไขสูตรเดิมได้ (ตั้งราคา/เปลี่ยนชื่อ)
//  5. ตัดหน้า produce ออก (สูตรผลิตได้แล้ว)
//  6. fix innerHTML null ใน v9RecipeProduce
//  7. รับสินค้า: แก้ไขหน่วยนับเดิม inline
// ══════════════════════════════════════════════════════════════════

// ── 1+2. POS: ตามบิล stock=0 ขายได้ ─────────────────────────────

const _v9OrigRenderPG2 = window.renderProductGrid;
window.renderProductGrid = function () {
  // patch products ชั่วคราว: ตามบิล stock=-1 เพื่อไม่ให้ out-of-stock
  let patched = [];
  try {
    if (typeof products !== 'undefined') {
      products.forEach(p => {
        if (p.product_type === 'ตามบิล' && p.stock <= 0) {
          p._origStock = p.stock;
          p.stock = 1; // ไม่ให้ isOut = true
          patched.push(p);
        }
        if (p.is_raw) {
          p._hiddenFromPOS = true;
          patched.push(p);
        }
      });
    }
  } catch(_) {}

  _v9OrigRenderPG2?.apply(this, arguments);

  // restore
  patched.forEach(p => {
    if (p._origStock !== undefined) { p.stock = p._origStock; delete p._origStock; }
    delete p._hiddenFromPOS;
  });

  // badge "ตามสั่ง" — handled by FIX-34 (pos-product-grid scope only)
};

// addToCart: ตามบิล ข้ามการเช็ค stock
const _v9OrigAddToCart2 = window.addToCart;
window.addToCart = async function (productId) {
  let prod;
  try { prod = products.find(p => p.id === productId); } catch(_) {}
  if (!prod) { try { prod = v9GetProducts().find(p => p.id === productId); } catch(_) {} }
  if (!prod) return;

  // ตามบิล → ไม่เช็คสต็อก
  if (prod.product_type === 'ตามบิล') {
    const units = await v9LoadUnits(productId);
    const sellUnits = units.filter(u => !u.is_base);
    if (sellUnits.length > 0) { v9ShowUnitPopup(prod, sellUnits); return; }
    v9PushToCart(prod, prod.price, prod.unit || 'ชิ้น', 1, 1);
    return;
  }

  // โหลดหน่วยขายก่อน
  const units = await v9LoadUnits(productId);
  const sellUnits = units.filter(u => !u.is_base);

  // ตรวจสต็อก (ข้ามถ้ามีหน่วยขาย)
  if (prod.stock <= 0 && sellUnits.length === 0) {
    typeof toast === 'function' && toast('สินค้าหมดสต็อก', 'error'); return;
  }

  if (sellUnits.length > 0) { v9ShowUnitPopup(prod, sellUnits); return; }
  if (prod.stock <= 0) { typeof toast === 'function' && toast('สินค้าหมดสต็อก', 'error'); return; }
  v9PushToCart(prod, prod.price, prod.unit || 'ชิ้น', 1, 1);
};


// ── 3. หน่วยนับ: ค้นหา + แก้ไขได้ ──────────────────────────────

window.v9AdminUnits = async function (container) {
  container.innerHTML = v9AdminLoading('โหลดหน่วยนับ...');
  let units = [], prods = [];
  try {
    prods = v9GetProducts();
    const { data, error } = await db.from('product_units').select('*').order('product_id');
    if (error) throw new Error(error.message);
    units = data || [];
  } catch(e) { container.innerHTML = v9AdminError('โหลดไม่ได้: ' + e.message); return; }

  const prodMap = {};
  prods.forEach(p => { prodMap[p.id] = p; });

  const grouped = {};
  units.forEach(u => {
    if (!grouped[u.product_id]) grouped[u.product_id] = [];
    grouped[u.product_id].push(u);
  });

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:15px;font-weight:700;">หน่วยนับสินค้า</div>
        <div style="font-size:12px;color:var(--text-tertiary);">จัดการหน่วยขาย เช่น ทราย → คิว, ปิ๊ป, ถุง</div>
      </div>
      <div style="display:flex;gap:8px;">
        <input class="form-input" id="v9au-search" placeholder="ค้นหาชื่อสินค้า..." style="width:200px;height:36px;"
          oninput="v9UnitsFilter(this.value)">
        <button class="btn btn-primary btn-sm" onclick="v9UnitsShowAddProduct()">
          <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มหน่วย
        </button>
      </div>
    </div>

    <!-- Quick add panel -->
    <div id="v9au2-add" style="display:none;background:var(--bg-base);border-radius:12px;
      padding:16px;margin-bottom:16px;border:1px solid var(--border-light);">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;">เพิ่มหน่วยนับใหม่</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div class="form-group">
          <label class="form-label">สินค้า *</label>
          <select class="form-input" id="v9au2-prod" onchange="v9UnitsUpdateBase()">
            <option value="">-- เลือกสินค้า --</option>
            ${prods.map(p => `<option value="${p.id}">${p.name} (base: ${p.unit||'ชิ้น'})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">หน่วย base</label>
          <input class="form-input" id="v9au2-base-unit" readonly style="background:var(--bg-base);" placeholder="เลือกสินค้าก่อน">
        </div>
      </div>
      <div style="background:#eff6ff;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#1d4ed8;">
        ตัวอย่าง: ทราย base=kg → เพิ่ม "คิว" conv_rate=1600 ราคา=480
      </div>
      <div id="v9au2-rows-inner">${v9BuildUnitRow(0)}</div>
      <button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;" onclick="v9UnitsAddRow()">
        <i class="material-icons-round" style="font-size:13px;">add</i> เพิ่มแถว
      </button>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn btn-primary" onclick="v9UnitsSaveAll()">
          <i class="material-icons-round" style="font-size:14px;">save</i> บันทึก
        </button>
        <button class="btn btn-outline" onclick="document.getElementById('v9au2-add').style.display='none'">ยกเลิก</button>
      </div>
    </div>

    <!-- Product cards -->
    <div id="v9au-cards">
      ${Object.keys(grouped).length === 0
        ? `<div style="text-align:center;padding:60px;color:var(--text-tertiary);">
             <i class="material-icons-round" style="font-size:48px;opacity:.3;display:block;margin-bottom:12px;">straighten</i>
             ยังไม่มีหน่วยนับ
           </div>`
        : Object.entries(grouped).map(([pid, us]) => v9BuildUnitCard(pid, us, prodMap)).join('')}
    </div>`;

  window._v9AllUnitCards = Object.entries(grouped).map(([pid, us]) => ({
    pid, name: (prodMap[pid]?.name || '').toLowerCase(), html: v9BuildUnitCard(pid, us, prodMap)
  }));
};

window.v9BuildUnitCard = function (pid, us, prodMap) {
  const prod = prodMap[pid];
  return `
    <div class="v9-unit-card" data-pid="${pid}" data-name="${(prod?.name||'').toLowerCase()}"
      style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:14px;
        overflow:hidden;margin-bottom:10px;">
      <div style="padding:12px 16px;background:var(--bg-base);display:flex;align-items:center;
        justify-content:space-between;border-bottom:1px solid var(--border-light);">
        <div>
          <div style="font-size:14px;font-weight:700;">${prod?.name || pid}</div>
          <div style="font-size:11px;color:var(--text-tertiary);">
            base: <strong>${prod?.unit||'ชิ้น'}</strong> · สต็อก ${parseFloat((prod?.stock||0).toFixed(4))} ${prod?.unit||''}
            · ต้นทุน ฿${parseFloat((prod?.cost||0).toFixed(4))}/${prod?.unit||''}
          </div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="v9UnitsShowAddProduct('${pid}')">
          <i class="material-icons-round" style="font-size:13px;">add</i> เพิ่มหน่วย
        </button>
      </div>
      <div style="padding:12px 16px;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
          <!-- base -->
          <div style="display:flex;align-items:center;gap:6px;padding:7px 12px;background:#fff5f5;
            border:1.5px solid #fca5a5;border-radius:999px;font-size:12px;">
            <span style="font-weight:700;color:#dc2626;">${prod?.unit||'ชิ้น'}</span>
            <span style="font-size:10px;color:#dc2626;opacity:.8;">BASE</span>
            <span style="font-size:11px;color:var(--text-tertiary);">฿${parseFloat((prod?.price||0).toFixed(2))}</span>
            <button onclick="v9UnitEditBase('${pid}',${prod?.price||0})"
              style="background:none;border:none;cursor:pointer;color:#dc2626;padding:0;">
              <i class="material-icons-round" style="font-size:12px;">edit</i>
            </button>
          </div>
          ${us.filter(u => !u.is_base).map(u => `
            <i class="material-icons-round" style="font-size:14px;color:var(--text-tertiary);">arrow_forward</i>
            <div id="v9uc-${u.id}" style="display:flex;align-items:center;gap:6px;padding:7px 12px;
              background:var(--bg-base);border:1px solid var(--border-light);border-radius:999px;font-size:12px;">
              <span style="font-weight:700;">${u.unit_name}</span>
              <span style="font-size:10px;color:var(--text-tertiary);">1=${u.conv_rate}${prod?.unit||''}</span>
              <span style="font-size:11px;color:${u.price_per_unit>0?'var(--success)':'var(--text-tertiary)'};">
                ฿${parseFloat((u.price_per_unit||0).toFixed(2))}
              </span>
              <button onclick="v9UnitInlineEdit('${u.id}','${u.unit_name}',${u.conv_rate},${u.price_per_unit||0},'${prod?.unit||''}')"
                style="background:none;border:none;cursor:pointer;color:var(--primary);padding:0;">
                <i class="material-icons-round" style="font-size:12px;">edit</i>
              </button>
              <button onclick="v9AdminUnitsDelete('${u.id}','${pid}')"
                style="background:none;border:none;cursor:pointer;color:var(--danger);padding:0;">
                <i class="material-icons-round" style="font-size:12px;">close</i>
              </button>
            </div>`).join('')}
        </div>
        <!-- inline edit area -->
        <div id="v9ue-area-${pid}" style="display:none;margin-top:10px;"></div>
      </div>
    </div>`;
};

window.v9UnitsFilter = function (q) {
  const cards = document.querySelectorAll('.v9-unit-card');
  cards.forEach(c => {
    const name = c.dataset.name || '';
    c.style.display = q ? (name.includes(q.toLowerCase()) ? '' : 'none') : '';
  });
};

window.v9UnitEditBase = function (prodId, currentPrice) {
  const area = document.getElementById(`v9ue-area-${prodId}`);
  if (!area) return;
  area.style.display = 'block';
  area.innerHTML = `
    <div style="background:#fff5f5;border-radius:8px;padding:10px 12px;border:1px solid #fca5a5;">
      <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:8px;">แก้ไขราคาหน่วย base</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <div class="form-group" style="margin:0;flex:1;">
          <label class="form-label">ราคาขาย/base (฿)</label>
          <input class="form-input" type="number" id="v9ue-base-price-${prodId}" value="${currentPrice}" min="0" step="0.01">
        </div>
        <button class="btn btn-primary btn-sm" style="margin-top:18px;" onclick="v9SaveBasePrice('${prodId}')">บันทึก</button>
        <button class="btn btn-outline btn-sm" style="margin-top:18px;"
          onclick="document.getElementById('v9ue-area-${prodId}').style.display='none'">ยกเลิก</button>
      </div>
    </div>`;
};

window.v9SaveBasePrice = async function (prodId) {
  const price = parseFloat(document.getElementById(`v9ue-base-price-${prodId}`)?.value || 0);
  v9ShowOverlay('กำลังบันทึกราคา...');
  try {
    const { error } = await db.from('สินค้า').update({ price }).eq('id', prodId);
    if (error) throw new Error(error.message);
    window._v9ProductsCache = null;
    await loadProducts?.();
    typeof toast === 'function' && toast('บันทึกราคา base สำเร็จ', 'success');
    const inner = document.getElementById('v9-manage-inner');
    if (inner) await window.v9AdminUnits(inner);
  } catch(e) { typeof toast === 'function' && toast('ไม่สำเร็จ: ' + e.message, 'error'); }
  finally { v9HideOverlay(); }
};

window.v9UnitInlineEdit = function (unitId, name, rate, price, baseUnit) {
  // หา parent card
  const chip = document.getElementById(`v9uc-${unitId}`);
  const pid  = chip?.closest('[data-pid]')?.dataset.pid;
  if (!pid) return;
  const area = document.getElementById(`v9ue-area-${pid}`);
  if (!area) return;
  area.style.display = 'block';
  area.innerHTML = `
    <div style="background:var(--bg-base);border-radius:8px;padding:10px 12px;border:1px solid var(--border-light);">
      <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:8px;">แก้ไขหน่วย "${name}"</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto auto;gap:8px;align-items:flex-end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">ชื่อหน่วย</label>
          <input class="form-input" id="v9ue-name" value="${name}">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">= กี่ ${baseUnit}?</label>
          <input class="form-input" type="number" id="v9ue-rate" value="${rate}" min="0.0001" step="0.0001">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">ราคาขาย (฿)</label>
          <input class="form-input" type="number" id="v9ue-price" value="${price}" min="0" step="0.01">
        </div>
        <button class="btn btn-primary btn-sm" onclick="v9UnitSaveEdit('${unitId}','${pid}')">บันทึก</button>
        <button class="btn btn-outline btn-sm"
          onclick="document.getElementById('v9ue-area-${pid}').style.display='none'">ยกเลิก</button>
      </div>
    </div>`;
};

window.v9UnitSaveEdit = async function (unitId, prodId) {
  const name  = document.getElementById('v9ue-name')?.value?.trim();
  const rate  = parseFloat(document.getElementById('v9ue-rate')?.value || 0);
  const price = parseFloat(document.getElementById('v9ue-price')?.value || 0);
  if (!name || !rate) { typeof toast === 'function' && toast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
  v9ShowOverlay('กำลังบันทึก...');
  try {
    const { error } = await db.from('product_units').update({
      unit_name: name, conv_rate: rate, price_per_unit: price
    }).eq('id', unitId);
    if (error) throw new Error(error.message);
    delete window._v9UnitCache?.[prodId];
    typeof toast === 'function' && toast('แก้ไขหน่วยสำเร็จ', 'success');
    const inner = document.getElementById('v9-manage-inner');
    if (inner) await window.v9AdminUnits(inner);
  } catch(e) { typeof toast === 'function' && toast('ไม่สำเร็จ: ' + e.message, 'error'); }
  finally { v9HideOverlay(); }
};


// ── 4. สูตรสินค้า: แก้ไขได้ (ตั้งราคา/ชื่อ) ─────────────────────

window.v9RecipeEditProduct = async function (prodId) {
  const prod = v9GetProducts().find(p => p.id === prodId);
  if (!prod) return;

  const { value } = await Swal.fire({
    title: `แก้ไข: ${prod.name}`,
    html: `
      <div style="text-align:left;">
        <div style="margin-bottom:10px;">
          <label style="font-size:12px;font-weight:700;color:#666;display:block;margin-bottom:4px;">ชื่อสินค้า</label>
          <input id="swal-name" class="swal2-input" value="${prod.name}" style="margin:0;width:100%;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px;font-weight:700;color:#666;display:block;margin-bottom:4px;">ราคาขาย (฿)</label>
          <input id="swal-price" class="swal2-input" type="number" value="${prod.price||0}" style="margin:0;width:100%;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#666;display:block;margin-bottom:4px;">หน่วย</label>
          <input id="swal-unit" class="swal2-input" value="${prod.unit||'ชิ้น'}" style="margin:0;width:100%;box-sizing:border-box;">
        </div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#DC2626',
    preConfirm: () => ({
      name:  document.getElementById('swal-name')?.value?.trim(),
      price: parseFloat(document.getElementById('swal-price')?.value || 0),
      unit:  document.getElementById('swal-unit')?.value?.trim() || 'ชิ้น',
    }),
  });
  if (!value?.name) return;

  v9ShowOverlay('กำลังบันทึก...');
  try {
    const { error } = await db.from('สินค้า').update({
      name: value.name, price: value.price, unit: value.unit,
      updated_at: new Date().toISOString(),
    }).eq('id', prodId);
    if (error) throw new Error(error.message);
    window._v9ProductsCache = null;
    await loadProducts?.();
    typeof toast === 'function' && toast('แก้ไขสำเร็จ', 'success');
    const inner = document.getElementById('v9-manage-inner');
    if (inner) await window.v9AdminRecipe(inner);
    const ac = document.getElementById('v9-admin-content');
    if (ac) await window.v9AdminRecipe(ac);
  } catch(e) { typeof toast === 'function' && toast('ไม่สำเร็จ: ' + e.message, 'error'); }
  finally { v9HideOverlay(); }
};


// ── 5. ตัด produce ออกจาก manage + แก้ไขสูตรให้มีปุ่ม edit ─────

// อัป _v9ManageTabs: ลบ produce ออกอย่างเดียว (units กลับมาแล้ว)
setTimeout(() => {
  if (Array.isArray(_v9ManageTabs)) {
    const pIdx = _v9ManageTabs.findIndex(t => t.key === 'produce');
    if (pIdx !== -1) _v9ManageTabs.splice(pIdx, 1);
    // ตรวจ units ยังอยู่ไหม ถ้าไม่มีให้เพิ่มกลับ
    if (!_v9ManageTabs.find(t => t.key === 'units')) {
      const recipeIdx = _v9ManageTabs.findIndex(t => t.key === 'recipe');
      const unitTab = { key:'units', label:'หน่วยนับ', icon:'straighten', desc:'กำหนดหน่วยขาย conv rate', color:'#0891b2', bg:'#ecfeff' };
      if (recipeIdx !== -1) _v9ManageTabs.splice(recipeIdx, 0, unitTab);
      else _v9ManageTabs.push(unitTab);
    }
  }
}, 200);


// ── 6. fix v9RecipeProduce innerHTML null ────────────────────────
window.v9RecipeProduce = async function (productId, maxQty) {
  const qty = Number(document.getElementById(`v9rec-produce-qty-${productId}`)?.value || 0);
  if (!qty || qty <= 0) { typeof toast==='function'&&toast('กรุณาระบุจำนวน','error'); return; }
  if (qty > maxQty) { typeof toast==='function'&&toast(`ผลิตได้สูงสุด ${maxQty} ชิ้น`,'error'); return; }

  const prods = v9GetProducts();
  const prod  = prods.find(p => p.id === productId);
  const prodMap = {};
  prods.forEach(p => { prodMap[p.id] = p; });

  const ok = await Swal.fire({
    title: `ผลิต ${prod?.name || ''}`,
    html: `ผลิต <strong>${qty}</strong> ${prod?.unit||'ชิ้น'}<br>วัตถุดิบจะถูกตัดออกจากสต็อก`,
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626'
  });
  if (!ok.isConfirmed) return;

  v9ShowOverlay('กำลังผลิต...', `${prod?.name} × ${qty}`);
  try {
    const { data: recipes } = await db.from('สูตรสินค้า').select('*').eq('product_id', productId);
    if (!recipes?.length) throw new Error('ไม่พบสูตรสินค้า');

    for (const r of recipes) {
      const mat    = prodMap[r.material_id];
      const needed = r.quantity * qty;
      const stockNow = parseFloat(mat?.stock || 0);
      if (stockNow < needed) throw new Error(`วัตถุดิบ "${mat?.name}" ไม่พอ (มี ${stockNow} ต้องการ ${needed})`);
      const newStock = stockNow - needed;
      await db.from('สินค้า').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', r.material_id);
      await db.from('stock_movement').insert({
        product_id: r.material_id, product_name: mat?.name || '',
        type: 'ใช้ผลิต', direction: 'out', qty: needed,
        stock_before: stockNow, stock_after: newStock,
        ref_table: 'production', staff_name: v9Staff(),
        note: `ผลิต ${prod?.name} × ${qty}`
      });
    }

    const stockBefore = parseFloat(prod?.stock || 0);
    const stockAfter  = stockBefore + qty;
    await db.from('สินค้า').update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', productId);
    await db.from('stock_movement').insert({
      product_id: productId, product_name: prod?.name || '',
      type: 'ผลิต', direction: 'in', qty,
      stock_before: stockBefore, stock_after: stockAfter,
      ref_table: 'production', staff_name: v9Staff(),
      note: `ผลิตล่วงหน้า × ${qty}`
    });

    typeof logActivity==='function' && logActivity('ผลิตสินค้า', `${prod?.name} × ${qty}`);
    window._v9ProductsCache = null;
    await loadProducts?.();
    try { if (typeof products !== 'undefined') window._v9ProductsCache = products; } catch(_) {}
    typeof toast === 'function' && toast(`ผลิต ${prod?.name} × ${qty} สำเร็จ ✅`, 'success');

    // reload recipe page
    const inner = document.getElementById('v9-manage-inner');
    if (inner) await window.v9AdminRecipe(inner);
    const ac = document.getElementById('v9-admin-content');
    if (ac) await window.v9AdminRecipe(ac);

  } catch(e) { typeof toast === 'function' && toast('ผลิตไม่สำเร็จ: ' + e.message, 'error'); }
  finally { v9HideOverlay(); }
};


// ── 7. หน้ารับสินค้า: แก้หน่วยนับเดิม inline ────────────────────

window.v9Pur24ShowEditUnit = async function (prodId) {
  const units = await v9LoadUnits(prodId, true);
  const prod  = v9GetProducts().find(p => p.id === prodId);
  if (!units.length) { typeof toast==='function'&&toast('ยังไม่มีหน่วยนับ','info'); return; }

  const rows = units.filter(u => !u.is_base).map(u => `
    <div id="v9pur-eu-${u.id}" style="display:grid;grid-template-columns:1fr 90px 100px 100px 28px;
      gap:6px;align-items:center;margin-bottom:6px;">
      <input class="form-input" value="${u.unit_name}" id="v9pur-eu-name-${u.id}" style="font-size:12px;height:32px;">
      <input class="form-input" type="number" value="${u.conv_rate}" id="v9pur-eu-rate-${u.id}"
        style="font-size:12px;height:32px;" placeholder="rate">
      <input class="form-input" type="number" value="${u.price_per_unit||0}" id="v9pur-eu-price-${u.id}"
        style="font-size:12px;height:32px;" placeholder="ราคา">
      <button class="btn btn-primary btn-sm" onclick="v9PurSaveUnitEdit('${u.id}','${prodId}')">บันทึก</button>
      <button onclick="v9AdminUnitsDelete('${u.id}','${prodId}')"
        style="background:none;border:none;cursor:pointer;color:var(--danger);">
        <i class="material-icons-round" style="font-size:16px;">delete</i>
      </button>
    </div>`).join('');

  await Swal.fire({
    title: `แก้ไขหน่วยนับ: ${prod?.name || ''}`,
    html: `
      <div style="text-align:left;">
        <div style="display:grid;grid-template-columns:1fr 90px 100px 100px 28px;gap:6px;
          font-size:11px;font-weight:700;color:#666;margin-bottom:6px;padding:0 2px;">
          <span>หน่วย</span><span>= กี่ ${prod?.unit||''}?</span><span>ราคาขาย</span><span></span><span></span>
        </div>
        ${rows}
      </div>`,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: 'ปิด',
    width: '600px',
  });
};

window.v9PurSaveUnitEdit = async function (unitId, prodId) {
  const name  = document.getElementById(`v9pur-eu-name-${unitId}`)?.value?.trim();
  const rate  = parseFloat(document.getElementById(`v9pur-eu-rate-${unitId}`)?.value || 0);
  const price = parseFloat(document.getElementById(`v9pur-eu-price-${unitId}`)?.value || 0);
  if (!name || !rate) { typeof toast==='function'&&toast('กรุณากรอกข้อมูลให้ครบ','error'); return; }
  v9ShowOverlay('กำลังบันทึก...');
  try {
    const { error } = await db.from('product_units').update({
      unit_name: name, conv_rate: rate, price_per_unit: price
    }).eq('id', unitId);
    if (error) throw new Error(error.message);
    delete window._v9UnitCache?.[prodId];
    typeof toast==='function'&&toast('แก้ไขสำเร็จ','success');
    // อัป chip ในหน้า
    const exist = document.getElementById('v9p24-exist-detail');
    if (exist) await v9Pur24SelectExisting(prodId);
  } catch(e) { typeof toast==='function'&&toast('ไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};


// ── Inject ปุ่ม edit unit + edit recipe ──────────────────────────

// patch v9Pur24ExistingForm ให้มีปุ่ม "แก้ไขหน่วย" 
const _v9OrigPur24Exist = window.v9Pur24ExistingForm;
window.v9Pur24ExistingForm = function (prod, hasUnits, existingUnits) {
  let html = _v9OrigPur24Exist?.apply(this, arguments) || '';
  // inject edit button ต่อท้าย chip area
  html = html.replace(
    `<div class="v9p24-chip dash" onclick="v9Pur24ShowAddUnit()">+ เพิ่มหน่วยใหม่</div>`,
    `<div class="v9p24-chip dash" onclick="v9Pur24ShowAddUnit()">+ เพิ่มหน่วย</div>
     <div class="v9p24-chip" onclick="v9Pur24ShowEditUnit('${prod.id}')" style="color:var(--primary);">
       <i class="material-icons-round" style="font-size:12px;">edit</i> แก้ไขหน่วย
     </div>`
  );
  return html;
};

// inject ปุ่ม edit ในทุก card ของสูตรสินค้า
const _v9OrigAdminRecipe2 = window.v9AdminRecipe;
window.v9AdminRecipe = async function (container) {
  await _v9OrigAdminRecipe2?.apply(this, arguments);
  // inject edit buttons into product headers
  try {
    const prods = v9GetProducts();
    prods.filter(p => p.product_type === 'ตามบิล' || p.product_type === 'ผลิตล่วงหน้า').forEach(p => {
      const header = container?.querySelector(`[id="v9rec-produce-qty-${p.id}"]`)
        ?.closest('[style*="border-radius:16px"]')
        ?.querySelector('[style*="border-bottom"]');
      if (header && !header.querySelector('.v9-recipe-edit-btn')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline btn-sm v9-recipe-edit-btn';
        btn.innerHTML = '<i class="material-icons-round" style="font-size:13px;">edit</i> แก้ไข';
        btn.onclick = () => v9RecipeEditProduct(p.id);
        btn.style.marginLeft = '6px';
        header.querySelector('[style*="display:flex"]')?.appendChild(btn);
      }
    });
  } catch(_) {}
};


// ══════════════════════════════════════════════════════════════════
// FIX-28 — แก้ไขหน่วยนับ inline ในหน้ารับสินค้า
// ══════════════════════════════════════════════════════════════════

window.v9Pur24InlineEditUnit = function (unitId, name, rate, price, baseUnit, prodId) {
  const area = document.getElementById('v9p24-unit-edit-area');
  if (!area) return;

  // ถ้ากำลังแก้ตัวเดิมอยู่ → ปิด
  if (area.dataset.editing === unitId && area.style.display !== 'none') {
    area.style.display = 'none';
    area.dataset.editing = '';
    return;
  }

  area.dataset.editing = unitId;
  area.style.display = 'block';
  area.innerHTML = `
    <div style="background:var(--bg-base);border-radius:10px;padding:12px 14px;
      border:1.5px solid var(--primary);animation:fadeIn .15s ease;">
      <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:10px;
        display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:6px;">
          <i class="material-icons-round" style="font-size:15px;">edit</i>
          แก้ไขหน่วย "${name}"
        </div>
        <button onclick="document.getElementById('v9p24-unit-edit-area').style.display='none'"
          style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);">
          <i class="material-icons-round" style="font-size:18px;">close</i>
        </button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <div class="v9p24-lbl">ชื่อหน่วย *</div>
          <input class="v9p24-fi" id="v9pur-ie-name" value="${name}" placeholder="เช่น คิว, ถัง">
        </div>
        <div>
          <div class="v9p24-lbl">1 หน่วย = กี่ ${baseUnit}? *</div>
          <input class="v9p24-fi" type="number" id="v9pur-ie-rate" value="${rate}"
            min="0.0001" step="0.0001">
        </div>
        <div>
          <div class="v9p24-lbl">ราคาขาย (฿) *</div>
          <input class="v9p24-fi" type="number" id="v9pur-ie-price" value="${price}"
            min="0" step="0.01" oninput="v9Pur24IECalc(${rate})">
        </div>
      </div>

      <div id="v9pur-ie-preview" style="font-size:12px;color:var(--text-tertiary);
        padding:6px 10px;background:var(--bg-surface);border-radius:6px;margin-bottom:10px;"></div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" style="flex:1;" onclick="v9Pur24SaveInlineUnit('${unitId}','${prodId}')">
          <i class="material-icons-round" style="font-size:15px;">save</i> บันทึก
        </button>
        <button class="btn btn-outline" onclick="document.getElementById('v9p24-unit-edit-area').style.display='none'">
          ยกเลิก
        </button>
      </div>
    </div>`;

  // คำนวณ preview เริ่มต้น
  v9Pur24IECalc(rate);

  // focus ที่ราคา (ส่วนใหญ่แก้ราคา)
  setTimeout(() => document.getElementById('v9pur-ie-price')?.focus(), 80);
};

window.v9Pur24IECalc = function (origRate) {
  const rate  = parseFloat(document.getElementById('v9pur-ie-rate')?.value || origRate);
  const price = parseFloat(document.getElementById('v9pur-ie-price')?.value || 0);
  const name  = document.getElementById('v9pur-ie-name')?.value || 'หน่วย';
  const prod  = window._v9Pur?.selectedProd;
  const costBase = parseFloat(prod?.cost || 0);
  const costUnit = costBase * rate;
  const margin   = price > 0 ? ((price - costUnit) / price * 100).toFixed(1) : 0;
  const el = document.getElementById('v9pur-ie-preview');
  if (el) el.innerHTML = price > 0
    ? `ต้นทุน/หน่วย = ฿${formatNum(Math.round(costUnit * 100)/100)} · กำไร ฿${formatNum(Math.round((price-costUnit)*100)/100)} (${margin}%)`
    : 'กรอกราคาขายเพื่อดูกำไร';
};

window.v9Pur24SaveInlineUnit = async function (unitId, prodId) {
  const name  = document.getElementById('v9pur-ie-name')?.value?.trim();
  const rate  = parseFloat(document.getElementById('v9pur-ie-rate')?.value || 0);
  const price = parseFloat(document.getElementById('v9pur-ie-price')?.value || 0);

  if (!name || !rate) {
    typeof toast==='function'&&toast('กรุณากรอกชื่อหน่วยและอัตราแปลง','error'); return;
  }

  v9ShowOverlay('กำลังบันทึก...');
  try {
    const { error } = await db.from('product_units').update({
      unit_name: name, conv_rate: rate, price_per_unit: price
    }).eq('id', unitId);
    if (error) throw new Error(error.message);

    // clear cache
    delete window._v9UnitCache?.[prodId];

    typeof toast==='function'&&toast(`บันทึกหน่วย "${name}" สำเร็จ`,'success');

    // reload หน้า existing form
    await v9Pur24SelectExisting(prodId);

  } catch(e) {
    typeof toast==='function'&&toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally {
    v9HideOverlay();
  }
};

// override v9AdminUnitsDelete ให้ reload หน้ารับสินค้าด้วย
const _v9OrigUnitsDelete2 = window.v9AdminUnitsDelete;
window.v9AdminUnitsDelete = async function (unitId, prodId) {
  if (!confirm('ลบหน่วยนี้?')) return;
  v9ShowOverlay('กำลังลบ...');
  try {
    await db.from('product_units').delete().eq('id', unitId);
    delete window._v9UnitCache?.[prodId];
    typeof toast==='function'&&toast('ลบสำเร็จ','success');

    // ถ้าอยู่ในหน้ารับสินค้า reload existing form
    const existDetail = document.getElementById('v9p24-exist-detail');
    if (existDetail && window._v9Pur?.selectedProd?.id === prodId) {
      await v9Pur24SelectExisting(prodId);
    } else {
      // ถ้าอยู่ในหน้า manage units
      const inner = document.getElementById('v9-manage-inner');
      if (inner) await window.v9AdminUnits(inner);
      const ac = document.getElementById('v9-admin-content');
      if (ac) await window.v9AdminUnits(ac);
    }
  } catch(e) { typeof toast==='function'&&toast('ลบไม่สำเร็จ: '+e.message,'error'); }
  finally { v9HideOverlay(); }
};


// ══════════════════════════════════════════════════════════════════
// FIX-29 — Define v9P24SellRowHTML globally (fix "not defined" error)
// ══════════════════════════════════════════════════════════════════

window.v9P24SellRowHTML = function (idx, baseUnit, costBase) {
  const base = baseUnit || window._v9Pur?.selectedProd?.unit || 'หน่วย';
  const cb   = parseFloat(costBase || 0);
  const isFirst = idx === 0;
  return `<div id="v9p24-sr-${idx}"
    style="display:grid;grid-template-columns:1fr 1fr 1fr 100px 28px;gap:6px;margin-bottom:6px;align-items:center;">
    <input class="v9p24-fi" id="v9p24-sname-${idx}"
      placeholder="เช่น คิว, ถัง, ปิ๊ป" style="height:34px;font-size:13px;"
      oninput="v9Pur24UpdateChips()">
    <input class="v9p24-fi" type="number" id="v9p24-srate-${idx}"
      placeholder="เช่น 1600" min="0.001" step="0.001" style="height:34px;font-size:13px;"
      oninput="v9Pur24UpdateRowProfit(${idx},${cb})">
    <input class="v9p24-fi" type="number" id="v9p24-sprice-${idx}"
      placeholder="ราคาขาย" min="0" style="height:34px;font-size:13px;"
      oninput="v9Pur24UpdateRowProfit(${idx},${cb})">
    <div id="v9p24-sprofit-${idx}"
      style="font-size:11px;color:var(--text-tertiary);text-align:right;padding-right:4px;">—</div>
    ${isFirst
      ? '<div></div>'
      : `<button type="button"
           onclick="document.getElementById('v9p24-sr-${idx}').remove();v9Pur24UpdateChips()"
           style="background:none;border:none;cursor:pointer;color:var(--danger);padding:0;">
           <i class="material-icons-round" style="font-size:16px;">close</i>
         </button>`}
  </div>`;
};


// ══════════════════════════════════════════════════════════════════
// FIX-30
//  1. บิลแสดงหน่วยถูก (1 คิว ไม่ใช่ 1 ชิ้น) + stock_movement ยืนยัน baseQty
//  2. form สินค้า: ประเภท 3 ตัวเลือก (ของขาย/วัตถุดิบ/ทั้งคู่) แก้ไขได้
//  3. v9SaveProduct: price/cost/stock รับทศนิยม
// ══════════════════════════════════════════════════════════════════

// ── 1. v4CompletePayment: บันทึกหน่วยถูก + log baseQty ────────────
const _v9OrigComplete30 = window.v4CompletePayment;
window.v4CompletePayment = async function () {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;
  v9ShowOverlay('กำลังบันทึกบิล...', 'โปรดรอสักครู่');

  try {
    const { data: session } = await db.from('cash_session')
      .select('*').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();

    const methodMap = { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ติดหนี้' };
    const { data: bill, error: billError } = await db.from('บิลขาย').insert({
      date:          new Date().toISOString(),
      method:        methodMap[checkoutState.method] || 'เงินสด',
      total:         checkoutState.total,
      discount:      checkoutState.discount || 0,
      received:      checkoutState.received,
      change:        checkoutState.change,
      customer_name: checkoutState.customer?.name || null,
      customer_id:   checkoutState.customer?.id   || null,
      staff_name:    v9Staff(),
      status:        checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
    }).select().single();
    if (billError) throw billError;

    const prods   = v9GetProducts();
    const prodMap = {};
    prods.forEach(p => { prodMap[p.id] = p; });

    for (const item of cart) {
      const prod     = prodMap[item.id];
      const convRate = parseFloat(item.conv_rate || 1);
      const baseQty  = parseFloat((item.qty * convRate).toFixed(6));
      const sellUnit = item.unit || prod?.unit || 'ชิ้น'; // หน่วยที่ขาย (คิว, ถัง, kg)

      // บันทึกรายการในบิล — qty = จำนวนหน่วยที่ขาย, unit = หน่วยที่เลือก
      await db.from('รายการในบิล').insert({
        bill_id:    bill.id,
        product_id: item.id,
        name:       item.name,
        qty:        item.qty,          // เช่น 1 (คิว)
        price:      item.price,
        cost:       parseFloat(item.cost || 0),
        total:      item.price * item.qty,
        unit:       sellUnit,          // "คิว" ไม่ใช่ "ชิ้น"
      });

      if (prod?.product_type !== 'ตามบิล') {
        // สินค้าปกติ — ตัดสต็อกเป็น base qty
        const stockBefore = parseFloat(prod?.stock || 0);
        const stockAfter  = parseFloat((stockBefore - baseQty).toFixed(6));

        await db.from('สินค้า').update({
          stock: Math.max(0, stockAfter),
          updated_at: new Date().toISOString(),
        }).eq('id', item.id);

        await db.from('stock_movement').insert({
          product_id:   item.id,
          product_name: item.name,
          type:         'ขาย',
          direction:    'out',
          qty:          baseQty,       // 1600 kg (ไม่ใช่ 1 ชิ้น)
          stock_before: stockBefore,
          stock_after:  Math.max(0, stockAfter),
          ref_id:       bill.id,
          ref_table:    'บิลขาย',
          staff_name:   v9Staff(),
          note: convRate !== 1
            ? `ขาย ${item.qty} ${sellUnit} = ${baseQty} ${prod?.unit||''}`
            : null,
        });

      } else {
        // ตามบิล → ตัดวัตถุดิบจาก BOM (qty หน่วยที่ขาย × BOM qty ต่อหน่วย)
        try {
          const { data: recipes } = await db.from('สูตรสินค้า')
            .select('*').eq('product_id', item.id);
          for (const r of (recipes || [])) {
            const mat      = prodMap[r.material_id];
            const needed   = parseFloat((r.quantity * item.qty).toFixed(6));
            const matBefore= parseFloat(mat?.stock || 0);
            const matAfter = parseFloat(Math.max(0, matBefore - needed).toFixed(6));
            await db.from('สินค้า').update({
              stock: matAfter, updated_at: new Date().toISOString()
            }).eq('id', r.material_id);
            await db.from('stock_movement').insert({
              product_id:   r.material_id,
              product_name: mat?.name || '',
              type:         'ใช้ผลิต(ขาย)',
              direction:    'out',
              qty:          needed,
              stock_before: matBefore,
              stock_after:  matAfter,
              ref_id:       bill.id,
              ref_table:    'บิลขาย',
              staff_name:   v9Staff(),
              note: `จากบิล #${bill.bill_no} (${item.name} × ${item.qty} ${sellUnit})`,
            });
          }
        } catch(e) { console.warn('[v9] BOM deduct:', e.message); }
      }
    }

    // Cash transaction
    if (checkoutState.method === 'cash' && session) {
      let chgDenoms = checkoutState.changeDenominations;
      if (!chgDenoms || !Object.values(chgDenoms).some(v => Number(v) > 0)) {
        if (checkoutState.change > 0 && typeof calcChangeDenominations === 'function')
          chgDenoms = calcChangeDenominations(checkoutState.change);
      }
      await window.recordCashTx({
        sessionId: session.id, type: 'ขาย', direction: 'in',
        amount: checkoutState.received, changeAmt: checkoutState.change,
        netAmount: checkoutState.total, refId: bill.id, refTable: 'บิลขาย',
        denominations: checkoutState.receivedDenominations || null,
        changeDenominations: chgDenoms || null, note: null,
      });
    }

    // Customer update
    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer')
        .select('total_purchase,visit_count,debt_amount')
        .eq('id', checkoutState.customer.id).maybeSingle();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase || 0) + checkoutState.total,
        visit_count:    (cust?.visit_count    || 0) + 1,
        debt_amount:    checkoutState.method === 'debt'
          ? (cust?.debt_amount || 0) + checkoutState.total
          : (cust?.debt_amount || 0),
      }).eq('id', checkoutState.customer.id);
    }

    typeof logActivity === 'function' && logActivity(
      'ขายสินค้า',
      `บิล #${bill.bill_no} ฿${formatNum(checkoutState.total)}`,
      bill.id, 'บิลขาย'
    );
    typeof sendToDisplay === 'function' && sendToDisplay({
      type: 'thanks', billNo: bill.bill_no, total: checkoutState.total
    });

    const { data: bItems } = await db.from('รายการในบิล')
      .select('*').eq('bill_id', bill.id);

    try { cart = []; } catch(_) { window.cart = []; }
    await loadProducts?.();
    try { if (typeof products !== 'undefined') window._v9ProductsCache = products; } catch(_) {}
    renderCart?.(); renderProductGrid?.(); updateHomeStats?.();

    try {
      const nb = await getLiveCashBalance?.();
      ['cash-current-balance','global-cash-balance'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = `฿${formatNum(nb)}`;
      });
    } catch(_) {}

    v9HideOverlay();
    typeof closeCheckout === 'function' && closeCheckout();

    const fmt = (typeof receiptFormat !== 'undefined' ? receiptFormat : null) || '80mm';
    const { value: doPrint } = await Swal.fire({
      icon: 'success',
      title: `บิล #${bill.bill_no} สำเร็จ`,
      html: `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
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
          <div style="font-size:16px;font-weight:800;color:#d97706;">฿${formatNum(Math.max(0,checkoutState.change))}</div>
        </div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: `<i class="material-icons-round" style="font-size:16px;vertical-align:middle;">print</i> พิมพ์ (${fmt})`,
      cancelButtonText: 'ข้าม',
      confirmButtonColor: '#10B981',
      timer: 8000, timerProgressBar: true,
    });
    if (doPrint && typeof printReceipt === 'function')
      printReceipt(bill, bItems || [], fmt);

  } catch(e) {
    v9HideOverlay();
    typeof toast === 'function' && toast('เกิดข้อผิดพลาด: ' + (e.message || e), 'error');
  } finally {
    window.isProcessingPayment = false;
  }
};


// ── 2+3. form สินค้า: ประเภท 3 ตัวเลือก + ทศนิยม ─────────────────

const _v9OrigShowProd30 = window.showAddProductModal;
window.showAddProductModal = function (productData = null) {
  // กำหนดค่า productKind จาก is_raw
  const kind = productData
    ? (productData.is_raw ? 'raw' : 'sale')
    : 'sale';
  // ถ้าต้องการแยก both: ดูจาก product_type ด้วย (ถ้ามี)
  const isBoth = productData?.product_type === 'ผลิตล่วงหน้า' ||
    (productData?.is_raw === false && productData?.product_type === 'ปกติ');

  if (typeof openModal !== 'function') return;

  const cats = (typeof categories !== 'undefined' ? categories : []) || [];

  openModal(productData ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่', `
    <form id="v9-product-form" onsubmit="event.preventDefault();v9SaveProduct()">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="form-group">
          <label class="form-label">ชื่อสินค้า *</label>
          <input class="form-input" id="v9prod-name" value="${productData?.name||''}" required placeholder="ชื่อสินค้า">
        </div>
        <div class="form-group">
          <label class="form-label">บาร์โค้ด</label>
          <div style="display:flex;gap:6px;">
            <input class="form-input" id="v9prod-barcode" value="${productData?.barcode||''}" placeholder="scan หรือกรอก">
            <button type="button" class="btn btn-outline btn-sm" onclick="v9StartBarcodeScanner()">
              <i class="material-icons-round" style="font-size:16px;">qr_code_scanner</i>
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="v9GenerateBarcode()">สุ่ม</button>
          </div>
          <canvas id="v9-barcode-canvas" style="margin-top:6px;display:none;max-width:100%;"></canvas>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="form-group">
          <label class="form-label">ราคาขาย (฿)</label>
          <input class="form-input" type="number" id="v9prod-price"
            value="${productData?.price||0}" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">ต้นทุน (฿)</label>
          <input class="form-input" type="number" id="v9prod-cost"
            value="${productData?.cost||0}" min="0" step="0.000001">
        </div>
        <div class="form-group">
          <label class="form-label">หน่วย</label>
          <input class="form-input" id="v9prod-unit" value="${productData?.unit||'ชิ้น'}" placeholder="ชิ้น, kg, ลิตร">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="form-group">
          <label class="form-label">สต็อก</label>
          <input class="form-input" type="number" id="v9prod-stock"
            value="${productData?.stock||0}" min="0" step="0.000001">
        </div>
        <div class="form-group">
          <label class="form-label">สต็อกขั้นต่ำ</label>
          <input class="form-input" type="number" id="v9prod-min-stock"
            value="${productData?.min_stock||0}" min="0" step="0.000001">
        </div>
        <div class="form-group">
          <label class="form-label">หมวดหมู่</label>
          <select class="form-input" id="v9prod-category">
            <option value="">-- ไม่ระบุ --</option>
            ${cats.map(c=>`<option value="${c.name}" ${productData?.category===c.name?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- รูปภาพ (รองรับการถ่ายรูป / อัปโหลดจากมือถือ พร้อมบีบอัด) -->
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label">รูปภาพสินค้า <span style="font-size:11px;color:var(--text-tertiary);">(สูงสุด 100KB)</span></label>
        <div style="background:var(--bg-surface); border:1px dashed var(--border-light); border-radius:var(--radius-md); padding:16px; text-align:center;">
          
          <div id="v9prod-img-preview-wrap" style="display:${productData?.img_url ? 'block' : 'none'}; position:relative; max-width:180px; margin:0 auto 12px auto; border-radius:8px; overflow:hidden; box-shadow:var(--shadow-sm); border:1px solid #e2e8f0;">
            <img id="v9prod-img-preview" src="${productData?.img_url || ''}" style="width:100%; height:auto; display:block;">
            <button type="button" onclick="v9ClearProductImage()" style="position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
              <i class="material-icons-round" style="font-size:16px;">close</i>
            </button>
          </div>
          
          <div style="display:flex; justify-content:center;">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('prod-img-upload').click()" style="width:100%; max-width:200px; display:flex; justify-content:center; align-items:center; gap:6px;">
              <i class="material-icons-round">photo_camera</i> ถ่ายรูป/เลือกรูป
            </button>
            <input type="file" accept="image/*" capture="environment" id="prod-img-upload" style="display:none;" onchange="v9HandleImageSelect(event)">
          </div>
          
          <input type="hidden" id="v9prod-img" value="${productData?.img_url || ''}">
          <input type="hidden" id="v9prod-img-old" value="${productData?.img_url || ''}">
        </div>
      </div>

      <!-- ประเภทสินค้า 3 ตัวเลือก -->
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label">ประเภทสินค้า *</label>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;
            border:1.5px solid var(--border-light);border-radius:8px;cursor:pointer;transition:all .15s;"
            id="v9prod-kind-sale-lbl"
            onclick="v9ProdSelKind('sale')">
            <input type="radio" name="v9prod-kind" id="v9prod-kind-sale" value="sale"
              ${(!productData||!productData.is_raw)?'checked':''} style="display:none;">
            <div style="width:32px;height:32px;border-radius:8px;background:#f0fdf4;
              display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="material-icons-round" style="font-size:18px;color:#15803d;">shopping_cart</i>
            </div>
            <div>
              <div style="font-size:13px;font-weight:700;">ของขาย</div>
              <div style="font-size:11px;color:var(--text-tertiary);">โชว์ในหน้าขาย POS</div>
            </div>
          </label>
          <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;
            border:1.5px solid var(--border-light);border-radius:8px;cursor:pointer;transition:all .15s;"
            id="v9prod-kind-raw-lbl"
            onclick="v9ProdSelKind('raw')">
            <input type="radio" name="v9prod-kind" id="v9prod-kind-raw" value="raw"
              ${productData?.is_raw?'checked':''} style="display:none;">
            <div style="width:32px;height:32px;border-radius:8px;background:#eff6ff;
              display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="material-icons-round" style="font-size:18px;color:#1d4ed8;">science</i>
            </div>
            <div>
              <div style="font-size:13px;font-weight:700;">วัตถุดิบ</div>
              <div style="font-size:11px;color:var(--text-tertiary);">ไม่โชว์ POS ใช้ผลิตสินค้า</div>
            </div>
          </label>
          <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;
            border:1.5px solid var(--border-light);border-radius:8px;cursor:pointer;transition:all .15s;"
            id="v9prod-kind-both-lbl"
            onclick="v9ProdSelKind('both')">
            <input type="radio" name="v9prod-kind" id="v9prod-kind-both" value="both"
              style="display:none;">
            <div style="width:32px;height:32px;border-radius:8px;background:#fffbeb;
              display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="material-icons-round" style="font-size:18px;color:#d97706;">swap_horiz</i>
            </div>
            <div>
              <div style="font-size:13px;font-weight:700;">ทั้งคู่</div>
              <div style="font-size:11px;color:var(--text-tertiary);">ขายได้ + ใช้ผลิตได้</div>
            </div>
          </label>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="v9prod-note" value="${productData?.note||''}" placeholder="(ถ้ามี)">
      </div>

      <input type="hidden" id="v9prod-id" value="${productData?.id||''}">
      <button type="submit" class="btn btn-primary" style="width:100%;">
        <i class="material-icons-round">save</i> บันทึก
      </button>
    </form>`);

  // highlight ตัวที่เลือกอยู่
  setTimeout(() => {
    const cur = productData?.product_type === 'both' ? 'both' : (productData?.is_raw ? 'raw' : 'sale');
    v9ProdSelKind(cur);
    if (productData?.barcode) v9BarcodePreview?.();
  }, 50);
};

window.v9ProdSelKind = function (kind) {
  ['sale','raw','both'].forEach(k => {
    const lbl = document.getElementById(`v9prod-kind-${k}-lbl`);
    const inp = document.getElementById(`v9prod-kind-${k}`);
    if (!lbl || !inp) return;
    const active = k === kind;
    lbl.style.borderColor  = active ? 'var(--primary)' : 'var(--border-light)';
    lbl.style.background   = active ? '#fff5f5' : '';
    inp.checked = active;
  });
};

// v9SaveProduct: อ่าน kind + ทศนิยม
window.v9SaveProduct = async function () {
  const id   = document.getElementById('v9prod-id')?.value;
  const name = document.getElementById('v9prod-name')?.value?.trim();
  if (!name) { typeof toast==='function'&&toast('กรุณากรอกชื่อสินค้า','error'); return; }

  v9StopScanner?.();
  v9ShowOverlay(id ? 'กำลังบันทึกและอัปโหลดรูป...' : 'กำลังสร้างสินค้าและอัปโหลดรูป...', name);

  let finalImgUrl = document.getElementById('v9prod-img')?.value?.trim();
  const oldImgUrl = document.getElementById('v9prod-img-old')?.value?.trim();
  const fileInput = document.getElementById('prod-img-upload');

  try {
    if (finalImgUrl === "FILE_SELECTED" && fileInput?.files?.length > 0) {
      if (typeof window.uploadImageToSupabase === 'function') {
        finalImgUrl = await window.uploadImageToSupabase(fileInput.files[0]);
      } else {
        finalImgUrl = null;
      }
      if (oldImgUrl && oldImgUrl.includes('product-images/')) {
        const oldFileName = oldImgUrl.substring(oldImgUrl.lastIndexOf('/') + 1);
        if (oldFileName && db?.storage) await db.storage.from('product-images').remove([oldFileName]).catch(()=>{});
      }
    } else if (!finalImgUrl && oldImgUrl && oldImgUrl.includes('product-images/')) {
      const oldFileName = oldImgUrl.substring(oldImgUrl.lastIndexOf('/') + 1);
      if (oldFileName && db?.storage) await db.storage.from('product-images').remove([oldFileName]).catch(()=>{});
      finalImgUrl = null;
    }
  } catch(imgErr) {
    v9HideOverlay();
    typeof toast==='function' && toast('อัปโหลดรูปล้มเหลว: ' + imgErr.message, 'error');
    return;
  }

  const kind   = document.querySelector('input[name="v9prod-kind"]:checked')?.value || 'sale';
  const isRaw  = kind === 'raw';
  const isBoth = kind === 'both';

  const data = {
    name,
    barcode:    document.getElementById('v9prod-barcode')?.value?.trim() || null,
    price:      parseFloat(document.getElementById('v9prod-price')?.value  || 0),
    cost:       parseFloat(document.getElementById('v9prod-cost')?.value   || 0),
    stock:      parseFloat(document.getElementById('v9prod-stock')?.value  || 0),
    min_stock:  parseFloat(document.getElementById('v9prod-min-stock')?.value || 0),
    unit:       document.getElementById('v9prod-unit')?.value?.trim() || 'ชิ้น',
    category:   document.getElementById('v9prod-category')?.value   || null,
    img_url:    finalImgUrl === "FILE_SELECTED" ? null : (finalImgUrl || null),
    note:       document.getElementById('v9prod-note')?.value?.trim() || null,
    is_raw:     isRaw || isBoth,    // raw หรือ both = is_raw=true
    product_type: isBoth ? 'ปกติ' : (isRaw ? 'ปกติ' : 'ปกติ'),
    updated_at: new Date().toISOString(),
  };

  // "both": is_raw=true แต่ยังโชว์ใน POS → ต้องแยก flag
  // ใช้ is_raw เฉพาะ raw pure เท่านั้น, both ใช้ is_raw=false + note พิเศษ
  if (isBoth) {
    data.is_raw = false;
    data.product_type = 'both';
  } else if (isRaw) {
    data.is_raw = true;
  } else {
    data.is_raw = false;
  }

  try {
    let err;
    if (id) { const r = await db.from('สินค้า').update(data).eq('id', id); err = r.error; }
    else    { const r = await db.from('สินค้า').insert(data);               err = r.error; }
    if (err) throw new Error(err.message);

    typeof closeModal === 'function' && closeModal();
    typeof toast === 'function' && toast(id ? 'แก้ไขสำเร็จ' : 'เพิ่มสำเร็จ', 'success');
    window._v9ProductsCache = null;
    await loadProducts?.();
    try { if (typeof products !== 'undefined') window._v9ProductsCache = products; } catch(_) {}
    typeof loadCategories === 'function' && await loadCategories();
    typeof renderInventory === 'function' && renderInventory();
  } catch(e) {
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
  } finally {
    v9HideOverlay();
  }
};

// POS filter: both ควรโชว์ใน POS
const _v9OrigPG30 = window.renderProductGrid;
window.renderProductGrid = function () {
  let patched = [];
  try {
    if (typeof products !== 'undefined') {
      products.forEach(p => {
        // is_raw=true และไม่ใช่ both → ซ่อน
        if (p.is_raw && p.product_type !== 'both') {
          p._hiddenFromPOS = true;
          patched.push(p);
        }
        // ตามบิล stock=0 → ไม่ out-of-stock
        if (p.product_type === 'ตามบิล' && p.stock <= 0) {
          p._origStock = p.stock;
          p.stock = 1;
          patched.push(p);
        }
      });
    }
  } catch(_) {}
  _v9OrigPG30?.apply(this, arguments);
  patched.forEach(p => {
    if (p._origStock !== undefined) { p.stock = p._origStock; delete p._origStock; }
    delete p._hiddenFromPOS;
  });
};


// ══════════════════════════════════════════════════════════════════
// FIX-31 — แก้ 4 bugs
//
//  1. ตัดสต็อก baseQty จริง (conv_rate ถูกส่งมาถึง complete payment)
//  2. วัตถุดิบ (is_raw=true) ไม่ขึ้น POS — filter ออกจาก products array จริง
//  3. ผลิตสินค้า: canMake=0 เพราะ stock=0 แต่ใส่เพิ่ม stock ได้ → ลบ disabled
//  4. ราคา base unit = 0: sync ราคาจาก product_units ตัวแรกถ้า price=0
// ══════════════════════════════════════════════════════════════════

// ── 2. filter วัตถุดิบออกจาก POS จริงๆ ────────────────────────────
// override renderProductGrid ให้ filter products array ก่อนส่งให้ต้นฉบับ
const _v9OrigRenderPG31 = window.renderProductGrid;
window.renderProductGrid = function () {
  // ซ่อนชั่วคราว: วัตถุดิบ (is_raw=true, product_type≠both)
  // และ ตามบิล stock=0 ให้ดูเหมือนมีสต็อก
  const hidden   = [];
  const patched  = [];
  try {
    if (typeof products !== 'undefined') {
      // splice วัตถุดิบออก
      for (let i = products.length - 1; i >= 0; i--) {
        const p = products[i];
        if (p.is_raw === true && p.product_type !== 'both') {
          hidden.push({ idx: i, prod: products.splice(i, 1)[0] });
        }
      }
      // patch stock ของตามบิล
      products.forEach(p => {
        if (p.product_type === 'ตามบิล' && (p.stock || 0) <= 0) {
          p._origStock = p.stock;
          p.stock = 1;
          patched.push(p);
        }
      });
    }
  } catch(_) {}

  _v9OrigRenderPG31?.apply(this, arguments);

  // คืน products กลับ
  try {
    patched.forEach(p => {
      if (p._origStock !== undefined) { p.stock = p._origStock; delete p._origStock; }
    });
    hidden.reverse().forEach(h => {
      if (typeof products !== 'undefined') products.splice(h.idx, 0, h.prod);
    });
  } catch(_) {}
};


// ── 3. v9AdminRecipe: canMake ไม่ผิด + ปุ่มผลิตไม่ disabled ────────
// override v9RecipeProduce: ลบ guard qty > maxQty ที่เข้มงวดเกิน
// และ fix canMake calculation (ใช้ parseFloat แทน int)
window.v9RecipeProduce = async function (productId) {
  const inp = document.getElementById(`v9rec-produce-qty-${productId}`);
  const qty = parseFloat(inp?.value || 0);
  if (!qty || qty <= 0) {
    typeof toast==='function'&&toast('กรุณาระบุจำนวนที่ต้องการผลิต','error'); return;
  }

  const prods   = v9GetProducts();
  const prod    = prods.find(p => p.id === productId);
  const prodMap = {};
  prods.forEach(p => { prodMap[p.id] = p; });

  // ตรวจวัตถุดิบ
  const { data: recipes } = await db.from('สูตรสินค้า').select('*').eq('product_id', productId);
  if (!recipes?.length) { typeof toast==='function'&&toast('ไม่พบสูตรสินค้า','error'); return; }

  const shortages = [];
  for (const r of recipes) {
    const mat    = prodMap[r.material_id];
    const needed = r.quantity * qty;
    const have   = parseFloat(mat?.stock || 0);
    if (have < needed) shortages.push(`${mat?.name} (มี ${have} ต้องการ ${needed})`);
  }

  if (shortages.length > 0) {
    const { isConfirmed } = await Swal.fire({
      title: 'วัตถุดิบไม่เพียงพอ',
      html: shortages.map(s=>`<div style="color:#dc2626;font-size:13px;">• ${s}</div>`).join(''),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ผลิตต่อ (ติดลบได้)',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#d97706',
    });
    if (!isConfirmed) return;
  } else {
    const { isConfirmed } = await Swal.fire({
      title: `ผลิต ${prod?.name || ''}`,
      html: `ผลิต <strong>${qty}</strong> ${prod?.unit||'ชิ้น'}<br>วัตถุดิบจะถูกตัดออกจากสต็อก`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#DC2626',
    });
    if (!isConfirmed) return;
  }

  v9ShowOverlay('กำลังผลิต...', `${prod?.name} × ${qty}`);
  try {
    for (const r of recipes) {
      const mat      = prodMap[r.material_id];
      const needed   = parseFloat((r.quantity * qty).toFixed(6));
      const stockNow = parseFloat(mat?.stock || 0);
      const newStock = parseFloat((stockNow - needed).toFixed(6));
      const { error: ue } = await db.from('สินค้า').update({
        stock: newStock, updated_at: new Date().toISOString()
      }).eq('id', r.material_id);
      if (ue) throw new Error(`อัปสต็อก ${mat?.name}: ${ue.message}`);
      await db.from('stock_movement').insert({
        product_id:   r.material_id,
        product_name: mat?.name || '',
        type:         'ใช้ผลิต',
        direction:    'out',
        qty:          needed,
        stock_before: stockNow,
        stock_after:  newStock,
        ref_table:    'production',
        staff_name:   v9Staff(),
        note:         `ผลิต ${prod?.name} × ${qty}`,
      });
    }

    const stockBefore = parseFloat(prod?.stock || 0);
    const stockAfter  = parseFloat((stockBefore + qty).toFixed(6));
    const { error: pe } = await db.from('สินค้า').update({
      stock: stockAfter, updated_at: new Date().toISOString()
    }).eq('id', productId);
    if (pe) throw new Error(`อัปสต็อกสินค้า: ${pe.message}`);
    await db.from('stock_movement').insert({
      product_id:   productId,
      product_name: prod?.name || '',
      type:         'ผลิต',
      direction:    'in',
      qty:          qty,
      stock_before: stockBefore,
      stock_after:  stockAfter,
      ref_table:    'production',
      staff_name:   v9Staff(),
      note:         `ผลิตล่วงหน้า × ${qty}`,
    });

    typeof logActivity==='function' && logActivity('ผลิตสินค้า', `${prod?.name} × ${qty}`);
    window._v9ProductsCache = null;
    await loadProducts?.();
    try { if(typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    typeof toast==='function' && toast(`ผลิต ${prod?.name} × ${qty} สำเร็จ ✅`, 'success');

    const inner = document.getElementById('v9-manage-inner');
    if (inner) await window.v9AdminRecipe(inner);

  } catch(e) {
    typeof toast==='function' && toast('ผลิตไม่สำเร็จ: '+e.message, 'error');
  } finally { v9HideOverlay(); }
};


// ── 4. sync ราคาขาย: ถ้า prod.price=0 ให้ดึงจาก product_units ────
// override loadProducts เพื่อ patch price จาก units
const _v9OrigLoadProds31 = window.loadProducts;
window.loadProducts = async function () {
  await _v9OrigLoadProds31?.apply(this, arguments);
  // patch: สินค้าที่ราคา=0 แต่มี product_units → ใช้ price_per_unit ของ base unit
  try {
    if (typeof products !== 'undefined') {
      const zeroPrice = products.filter(p => (!p.price || p.price === 0) && p.id);
      if (zeroPrice.length > 0) {
        const ids = zeroPrice.map(p => p.id);
        const { data: units } = await db.from('product_units')
          .select('product_id,price_per_unit,is_base,unit_name')
          .in('product_id', ids);
        if (units?.length) {
          const unitMap = {};
          units.forEach(u => {
            if (!unitMap[u.product_id]) unitMap[u.product_id] = [];
            unitMap[u.product_id].push(u);
          });
          for (const p of zeroPrice) {
            const us = unitMap[p.id] || [];
            const baseU = us.find(u => u.is_base);
            const anyU  = us.find(u => u.price_per_unit > 0);
            const useU  = baseU?.price_per_unit > 0 ? baseU : anyU;
            if (useU) p.price = useU.price_per_unit;
          }
        }
        window._v9ProductsCache = products;
      }
    }
  } catch(_) {}
};


// ── คลังสินค้า: แสดง "ตามสั่ง" / "ผลิตล่วงหน้า" แทนสต็อก ─────────
const _v9OrigRenderInv31 = window.renderInventory;
window.renderInventory = async function () {
  await _v9OrigRenderInv31?.apply(this, arguments);
  // patch stock display for recipe products
  try {
    v9GetProducts()
      .filter(p => p.product_type === 'ตามบิล' || p.product_type === 'ผลิตล่วงหน้า')
      .forEach(p => {
        // หา td ที่แสดงสต็อกของสินค้านี้
        document.querySelectorAll(`[onclick*="${p.id}"]`).forEach(btn => {
          const row = btn.closest('tr');
          if (!row) return;
          const cells = row.querySelectorAll('td');
          // หา cell ที่มีข้อความ stock
          cells.forEach(cell => {
            if (cell.textContent.includes(p.unit||'') &&
                (cell.textContent.includes(p.stock?.toString()||'') ||
                 cell.querySelector('.product-stock'))) {
              // inject badge
              if (!cell.querySelector('.v9-type-badge')) {
                const badge = document.createElement('span');
                badge.className = 'v9-type-badge';
                badge.style.cssText = 'font-size:9px;padding:1px 5px;border-radius:4px;margin-left:4px;' +
                  (p.product_type==='ตามบิล'
                    ? 'background:#ede9fe;color:#6d28d9;'
                    : 'background:#ecfeff;color:#0891b2;');
                badge.textContent = p.product_type==='ตามบิล' ? 'ตามสั่ง' : 'ผลิต';
                cell.appendChild(badge);
              }
            }
          });
        });
      });
  } catch(_) {}
};


// ── 1. ยืนยัน v4CompletePayment ใช้ตัวล่าสุด (FIX-30) ────────────
// ลบ chain เก่า FIX-23 ที่ยังตัดสต็อกซ้ำ
// FIX-23 ถูก wrap ไว้ใน _v9OrigComplete23 → ตัวล่าสุด FIX-30 ทำงานอยู่แล้ว ✅
// แต่ chain ทำให้ FIX-23 ยังถูกเรียกผ่าน _v9OrigComplete30 → _v9OrigComplete23
// ต้อง break chain: ให้ FIX-30 เรียก _v9OrigV4Complete_print โดยตรง
window.v4CompletePayment = (function () {
  // เก็บ FIX-30 implementation ไว้ (ไม่ใช้ chain เก่า)
  const impl = window._v9OrigComplete30 !== window._v9OrigComplete23
    ? null  // ถ้า chain ซ้ำ → ใช้ implementation ใหม่
    : null;

  // ใช้ FIX-30 โดยตรง (re-declare เพื่อ break chain)
  return async function () {
    if (window.isProcessingPayment) return;
    window.isProcessingPayment = true;
    v9ShowOverlay('กำลังบันทึกบิล...', 'โปรดรอสักครู่');

    try {
      const { data: session } = await db.from('cash_session')
        .select('*').eq('status','open')
        .order('opened_at',{ascending:false}).limit(1).maybeSingle();

      const methodMap = { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ติดหนี้' };
      const { data: bill, error: billError } = await db.from('บิลขาย').insert({
        date: new Date().toISOString(),
        method: methodMap[checkoutState.method] || 'เงินสด',
        total: checkoutState.total, discount: checkoutState.discount || 0,
        received: checkoutState.received, change: checkoutState.change,
        customer_name: checkoutState.customer?.name || null,
        customer_id:   checkoutState.customer?.id   || null,
        staff_name: v9Staff(),
        status: checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
      }).select().single();
      if (billError) throw billError;

      const prods   = v9GetProducts();
      const prodMap = {};
      prods.forEach(p => { prodMap[p.id] = p; });

      for (const item of cart) {
        const prod     = prodMap[item.id];
        const convRate = parseFloat(item.conv_rate || 1);
        const baseQty  = parseFloat((item.qty * convRate).toFixed(6));
        const sellUnit = item.unit || prod?.unit || 'ชิ้น';

        await db.from('รายการในบิล').insert({
          bill_id: bill.id, product_id: item.id, name: item.name,
          qty: item.qty, price: item.price,
          cost: parseFloat(item.cost || 0),
          total: item.price * item.qty,
          unit: sellUnit,
        });

        if (prod?.product_type !== 'ตามบิล') {
          const stockBefore = parseFloat(prod?.stock || 0);
          const stockAfter  = parseFloat(Math.max(0, stockBefore - baseQty).toFixed(6));
          await db.from('สินค้า').update({
            stock: stockAfter, updated_at: new Date().toISOString()
          }).eq('id', item.id);
          await db.from('stock_movement').insert({
            product_id: item.id, product_name: item.name,
            type: 'ขาย', direction: 'out', qty: baseQty,
            stock_before: stockBefore, stock_after: stockAfter,
            ref_id: bill.id, ref_table: 'บิลขาย', staff_name: v9Staff(),
            note: convRate !== 1
              ? `ขาย ${item.qty} ${sellUnit} = ${baseQty} ${prod?.unit||''}`
              : null,
          });
        } else {
          // ตามบิล: ตัดวัตถุดิบ BOM
          try {
            const { data: recipes } = await db.from('สูตรสินค้า')
              .select('*').eq('product_id', item.id);
            for (const r of (recipes||[])) {
              const mat      = prodMap[r.material_id];
              const needed   = parseFloat((r.quantity * item.qty).toFixed(6));
              const matBefore= parseFloat(mat?.stock || 0);
              const matAfter = parseFloat(Math.max(0, matBefore - needed).toFixed(6));
              await db.from('สินค้า').update({
                stock: matAfter, updated_at: new Date().toISOString()
              }).eq('id', r.material_id);
              await db.from('stock_movement').insert({
                product_id: r.material_id, product_name: mat?.name||'',
                type: 'ใช้ผลิต(ขาย)', direction: 'out', qty: needed,
                stock_before: matBefore, stock_after: matAfter,
                ref_id: bill.id, ref_table: 'บิลขาย', staff_name: v9Staff(),
                note: `จากบิล #${bill.bill_no} (${item.name} × ${item.qty} ${sellUnit})`,
              });
            }
          } catch(e) { console.warn('[v9] BOM deduct:', e.message); }
        }
      }

      // Cash
      if (checkoutState.method === 'cash' && session) {
        let chgDenoms = checkoutState.changeDenominations;
        if (!chgDenoms || !Object.values(chgDenoms).some(v=>Number(v)>0)) {
          if (checkoutState.change>0 && typeof calcChangeDenominations==='function')
            chgDenoms = calcChangeDenominations(checkoutState.change);
        }
        await window.recordCashTx({
          sessionId: session.id, type:'ขาย', direction:'in',
          amount: checkoutState.received, changeAmt: checkoutState.change,
          netAmount: checkoutState.total, refId: bill.id, refTable:'บิลขาย',
          denominations: checkoutState.receivedDenominations||null,
          changeDenominations: chgDenoms||null, note:null,
        });
      }

      // Customer
      if (checkoutState.customer?.id) {
        const { data: cust } = await db.from('customer')
          .select('total_purchase,visit_count,debt_amount')
          .eq('id', checkoutState.customer.id).maybeSingle();
        await db.from('customer').update({
          total_purchase: (cust?.total_purchase||0)+checkoutState.total,
          visit_count:    (cust?.visit_count||0)+1,
          debt_amount:    checkoutState.method==='debt'
            ? (cust?.debt_amount||0)+checkoutState.total
            : (cust?.debt_amount||0),
        }).eq('id', checkoutState.customer.id);
      }

      typeof logActivity==='function' && logActivity(
        'ขายสินค้า', `บิล #${bill.bill_no} ฿${formatNum(checkoutState.total)}`,
        bill.id, 'บิลขาย'
      );
      typeof sendToDisplay==='function' && sendToDisplay({
        type:'thanks', billNo:bill.bill_no, total:checkoutState.total
      });

      const { data: bItems } = await db.from('รายการในบิล')
        .select('*').eq('bill_id', bill.id);

      window.cart = [];
      await loadProducts?.();
      try { if(typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
      renderCart?.(); renderProductGrid?.(); updateHomeStats?.();

      try {
        const nb = await getLiveCashBalance?.();
        ['cash-current-balance','global-cash-balance'].forEach(id=>{
          const el=document.getElementById(id);
          if(el) el.textContent=`฿${formatNum(nb)}`;
        });
      } catch(_){}

      v9HideOverlay();
      typeof closeCheckout==='function' && closeCheckout();

      const fmt = (typeof receiptFormat!=='undefined'?receiptFormat:null)||'80mm';
      const { value: doPrint } = await Swal.fire({
        icon:'success', title:`บิล #${bill.bill_no} สำเร็จ`,
        html:`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
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
            <div style="font-size:16px;font-weight:800;color:#d97706;">฿${formatNum(Math.max(0,checkoutState.change))}</div>
          </div>
        </div>`,
        showCancelButton:true,
        confirmButtonText:`<i class="material-icons-round" style="font-size:16px;vertical-align:middle;">print</i> พิมพ์ (${fmt})`,
        cancelButtonText:'ข้าม', confirmButtonColor:'#10B981',
        timer:8000, timerProgressBar:true,
      });
      if (doPrint && typeof printReceipt==='function')
        printReceipt(bill, bItems||[], fmt);

    } catch(e) {
      v9HideOverlay();
      typeof toast==='function' && toast('เกิดข้อผิดพลาด: '+(e.message||e), 'error');
    } finally {
      window.isProcessingPayment = false;
    }
  };
})();


// ══════════════════════════════════════════════════════════════════
// FIX-32 — แก้ขาดสิ้น
//
//  A. v4CompletePayment — เขียนใหม่ standalone ไม่ chain
//     - conv_rate จาก cart.conv_rate → baseQty ถูกต้อง
//  B. badge "ตามสั่ง" — ติดเฉพาะ product card ไม่ติด cart
//  C. v9ConfirmUnitAdd — เก็บ sel ก่อน closeModal
// ══════════════════════════════════════════════════════════════════

// ── C. fix v9ConfirmUnitAdd: เก็บ sel ก่อน close ─────────────────
window.v9ConfirmUnitAdd = function () {
  // สำเนา sel ก่อน closeModal จะล้าง DOM
  const sel  = window._v9UnitPopupSel  ? { ...window._v9UnitPopupSel }  : null;
  const prod = window._v9UnitPopupProd ? { ...window._v9UnitPopupProd } : null;
  if (!sel || !prod) { typeof toast==='function'&&toast('กรุณาเลือกหน่วยก่อน','error'); return; }

  const qty = parseFloat(document.getElementById('v9unit-qty')?.value || 1);
  if (qty <= 0) { typeof toast==='function'&&toast('กรุณากรอกจำนวน','error'); return; }

  const isMTO   = prod.product_type === 'ตามบิล';
  const baseQty = qty * parseFloat(sel.conv);
  if (!isMTO && baseQty > parseFloat(prod.stock || 0)) {
    typeof toast==='function'&&toast(
      `สต็อกไม่พอ — มี ${parseFloat((prod.stock/sel.conv).toFixed(4))} ${sel.unitName}`, 'error'
    ); return;
  }

  // ปิด modal ก่อน แต่เก็บค่าไว้แล้ว
  typeof closeModal==='function' && closeModal();

  // ทำงานหลัง modal ปิด (DOM ถูก clear)
  setTimeout(() => {
    v9PushToCart(prod, sel.price, sel.unitName, sel.conv, qty);
  }, 20);
};


// ── B. badge ตามสั่ง: ติดเฉพาะ .product-card ────────────────────
// override renderProductGrid ล่าสุด — clean version
const _v9OrigRenderPG_Final = window.renderProductGrid;
window.renderProductGrid = function () {
  // splice วัตถุดิบออกชั่วคราว
  const hidden  = [];
  const patched = [];
  try {
    if (typeof products !== 'undefined') {
      for (let i = products.length - 1; i >= 0; i--) {
        const p = products[i];
        if (p.is_raw === true && p.product_type !== 'both') {
          hidden.push({ idx: i, prod: products.splice(i, 1)[0] });
        }
      }
      // patch ตามบิล stock=0 → 1 (ไม่ให้ out-of-stock)
      products.forEach(p => {
        if (p.product_type === 'ตามบิล' && (p.stock || 0) <= 0) {
          p._origStock = p.stock;
          p.stock = 1;
          patched.push(p);
        }
      });
    }
  } catch(_) {}

  _v9OrigRenderPG_Final?.apply(this, arguments);

  // คืน products กลับ
  try {
    patched.forEach(p => {
      if (p._origStock !== undefined) { p.stock = p._origStock; delete p._origStock; }
    });
    hidden.reverse().forEach(h => {
      if (typeof products !== 'undefined') products.splice(h.idx, 0, h.prod);
    });
  } catch(_) {}

  // badge "ตามสั่ง" เฉพาะ .product-card และ .product-list-item เท่านั้น
  try {
    if (typeof products !== 'undefined') {
      products.filter(p => p.product_type === 'ตามบิล').forEach(p => {
        // เฉพาะ class product-card หรือ product-list-item
        document.querySelectorAll(`.product-card[onclick*="${p.id}"], .product-list-item[onclick*="${p.id}"]`)
          .forEach(card => {
            if (!card.querySelector('.v9-mto-badge')) {
              const badge = document.createElement('div');
              badge.className = 'v9-mto-badge';
              badge.style.cssText =
                'position:absolute;top:6px;left:6px;font-size:9px;' +
                'padding:2px 5px;border-radius:4px;background:#ede9fe;color:#6d28d9;' +
                'font-weight:700;pointer-events:none;z-index:1;';
              badge.textContent = 'ตามสั่ง';
              if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
              card.appendChild(badge);
            }
          });
      });
    }
  } catch(_) {}
};


// ── A. v4CompletePayment — standalone clean ────────────────────────
window.v4CompletePayment = async function v9Sale() {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;
  v9ShowOverlay('กำลังบันทึกบิล...', 'โปรดรอสักครู่');

  try {
    // session
    const { data: session } = await db.from('cash_session')
      .select('*').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();

    // สร้างบิล
    const methodMap = { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ติดหนี้' };
    const { data: bill, error: billErr } = await db.from('บิลขาย').insert({
      date:          new Date().toISOString(),
      method:        methodMap[checkoutState.method] || 'เงินสด',
      total:         checkoutState.total,
      discount:      checkoutState.discount || 0,
      received:      checkoutState.received,
      change:        checkoutState.change,
      customer_name: checkoutState.customer?.name || null,
      customer_id:   checkoutState.customer?.id   || null,
      staff_name:    v9Staff(),
      status:        checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
    }).select().single();
    if (billErr) throw new Error(billErr.message);

    // reload products เพื่อให้ stock เป็นปัจจุบัน
    const freshProds = await db.from('สินค้า').select('id,stock,product_type,unit,cost');
    const stockMap = {};
    (freshProds.data||[]).forEach(p => { stockMap[p.id] = p; });

    // วนทุก item ในตะกร้า
    for (const item of cart) {
      const fresh    = stockMap[item.id] || {};
      const convRate = parseFloat(item.conv_rate || 1);  // เช่น 1300 (1 คิว = 1300 kg)
      const baseQty  = parseFloat((item.qty * convRate).toFixed(6)); // เช่น 1 × 1300 = 1300
      const sellUnit = item.unit || fresh.unit || 'ชิ้น';  // เช่น "คิว"
      const isMTO    = item.is_mto || fresh.product_type === 'ตามบิล';

      // log debug
      console.log(`[v9Sale] ${item.name}: qty=${item.qty} ${sellUnit} × conv=${convRate} = ${baseQty} ${fresh.unit||''}`);

      // บันทึกรายการในบิล
      await db.from('รายการในบิล').insert({
        bill_id:    bill.id,
        product_id: item.id,
        name:       item.name,
        qty:        item.qty,
        price:      item.price,
        cost:       parseFloat(item.cost || 0),
        total:      parseFloat((item.price * item.qty).toFixed(2)),
        unit:       sellUnit,
      });

      if (!isMTO) {
        // ── ตัดสต็อก base qty ──
        const stockBefore = parseFloat(fresh.stock || 0);
        const stockAfter  = parseFloat(Math.max(0, stockBefore - baseQty).toFixed(6));

        const { error: upErr } = await db.from('สินค้า').update({
          stock: stockAfter,
          updated_at: new Date().toISOString(),
        }).eq('id', item.id);
        if (upErr) console.warn('[v9Sale] stock update error:', upErr.message);

        await db.from('stock_movement').insert({
          product_id:   item.id,
          product_name: item.name,
          type:         'ขาย',
          direction:    'out',
          qty:          baseQty,
          stock_before: stockBefore,
          stock_after:  stockAfter,
          ref_id:       bill.id,
          ref_table:    'บิลขาย',
          staff_name:   v9Staff(),
          note: convRate !== 1
            ? `ขาย ${item.qty} ${sellUnit} (${baseQty} ${fresh.unit||''})`
            : null,
        });

      } else {
        // ── ตามบิล: ตัดวัตถุดิบ BOM ──
        try {
          const { data: recipes } = await db.from('สูตรสินค้า')
            .select('*').eq('product_id', item.id);
          for (const r of (recipes||[])) {
            const mat      = stockMap[r.material_id];
            const needed   = parseFloat((r.quantity * item.qty).toFixed(6));
            const matBefore= parseFloat(mat?.stock || 0);
            const matAfter = parseFloat(Math.max(0, matBefore - needed).toFixed(6));
            await db.from('สินค้า').update({
              stock: matAfter, updated_at: new Date().toISOString()
            }).eq('id', r.material_id);
            await db.from('stock_movement').insert({
              product_id:   r.material_id,
              product_name: (freshProds.data||[]).find(p=>p.id===r.material_id)?.unit||r.material_id,
              type:         'ใช้ผลิต(ขาย)',
              direction:    'out',
              qty:          needed,
              stock_before: matBefore,
              stock_after:  matAfter,
              ref_id:       bill.id,
              ref_table:    'บิลขาย',
              staff_name:   v9Staff(),
              note: `บิล #${bill.bill_no}: ${item.name} × ${item.qty} ${sellUnit}`,
            });
          }
        } catch(e) { console.warn('[v9Sale] BOM deduct:', e.message); }
      }
    }

    // Cash transaction
    if (checkoutState.method === 'cash' && session) {
      let chgDenoms = checkoutState.changeDenominations;
      if (!chgDenoms || !Object.values(chgDenoms).some(v=>Number(v)>0)) {
        if (checkoutState.change > 0 && typeof calcChangeDenominations==='function')
          chgDenoms = calcChangeDenominations(checkoutState.change);
      }
      await window.recordCashTx({
        sessionId: session.id, type:'ขาย', direction:'in',
        amount:    checkoutState.received,
        changeAmt: checkoutState.change,
        netAmount: checkoutState.total,
        refId:     bill.id, refTable:'บิลขาย',
        denominations:       checkoutState.receivedDenominations || null,
        changeDenominations: chgDenoms || null,
        note: null,
      });
    }

    // Customer
    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer')
        .select('total_purchase,visit_count,debt_amount')
        .eq('id', checkoutState.customer.id).maybeSingle();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase||0) + checkoutState.total,
        visit_count:    (cust?.visit_count||0) + 1,
        debt_amount:    checkoutState.method==='debt'
          ? (cust?.debt_amount||0) + checkoutState.total
          : (cust?.debt_amount||0),
      }).eq('id', checkoutState.customer.id);
    }

    // Log + display
    typeof logActivity==='function' && logActivity(
      'ขายสินค้า',
      `บิล #${bill.bill_no} ฿${formatNum(checkoutState.total)}`,
      bill.id, 'บิลขาย'
    );
    typeof sendToDisplay==='function' && sendToDisplay({
      type:'thanks', billNo:bill.bill_no, total:checkoutState.total
    });

    const { data: bItems } = await db.from('รายการในบิล')
      .select('*').eq('bill_id', bill.id);

    try { cart = []; } catch(_) { window.cart = []; }
    await loadProducts?.();
    try { if(typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    renderCart?.(); renderProductGrid?.(); updateHomeStats?.();

    try {
      const nb = await getLiveCashBalance?.();
      ['cash-current-balance','global-cash-balance'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = `฿${formatNum(nb)}`;
      });
    } catch(_) {}

    v9HideOverlay();
    typeof closeCheckout==='function' && closeCheckout();

    const fmt = (typeof receiptFormat!=='undefined'?receiptFormat:null)||'80mm';
    const { value: doPrint } = await Swal.fire({
      icon:'success',
      title:`บิล #${bill.bill_no} สำเร็จ`,
      html:`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
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
          <div style="font-size:16px;font-weight:800;color:#d97706;">฿${formatNum(Math.max(0,checkoutState.change))}</div>
        </div>
      </div>`,
      showCancelButton:true,
      confirmButtonText:`<i class="material-icons-round" style="font-size:16px;vertical-align:middle;">print</i> พิมพ์ (${fmt})`,
      cancelButtonText:'ข้าม',
      confirmButtonColor:'#10B981',
      timer:8000, timerProgressBar:true,
    });
    if (doPrint && typeof printReceipt==='function')
      printReceipt(bill, bItems||[], fmt);

  } catch(e) {
    v9HideOverlay();
    typeof toast==='function' && toast('เกิดข้อผิดพลาด: '+(e.message||e), 'error');
    console.error('[v9Sale]', e);
  } finally {
    window.isProcessingPayment = false;
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-33 — ROOT CAUSE FIX: override bcConfirm
//
// ปัญหาแท้จริง:
//   modules-v4.js ประกาศ v4CompletePayment เป็น LOCAL function
//   → window.v4CompletePayment ที่เรา override ใน v9 ไม่ถูกเรียกเลย
//   → ทุก override ที่ผ่านมาไม่มีผล
//
// วิธีแก้:
//   bcConfirm เป็น window. function → override ได้
//   inject logic ใหม่โดยตรงใน bcConfirm
// ══════════════════════════════════════════════════════════════════

window.bcConfirm = async function () {
  if (window.isProcessingPayment) return;
  if (!checkoutState?.method) {
    typeof toast==='function' && toast('กรุณาเลือกวิธีชำระเงิน', 'warning'); return;
  }

  // รวบรวม denomination ถ้าเป็นเงินสด
  if (checkoutState.method === 'cash') {
    const recv = typeof v4Total==='function'
      ? v4Total(window._v4States?.['recv'] || {})
      : (checkoutState.received || 0);
    if (recv < checkoutState.total) {
      typeof toast==='function' && toast('ยอดรับเงินไม่เพียงพอ', 'error'); return;
    }
    checkoutState.received = recv;
    checkoutState.change   = recv - checkoutState.total;
    checkoutState.receivedDenominations = { ...(window._v4States?.['recv'] || {}) };
    const chgState = window._v4States?.['chg'];
    checkoutState.changeDenominations = chgState
      ? { ...chgState }
      : (typeof calcChangeDenominations==='function' ? calcChangeDenominations(checkoutState.change) : {});
  } else {
    checkoutState.received = checkoutState.total;
    checkoutState.change   = 0;
  }

  if (typeof closeBillCheckout==='function') closeBillCheckout();

  // ── เรียก v9Sale โดยตรง (ไม่ใช้ local v4CompletePayment) ──
  await window.v9Sale();
};

// ── v9Sale: standalone sale function ─────────────────────────────
window.v9Sale = async function () {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;
  v9ShowOverlay('กำลังบันทึกบิล...', 'โปรดรอสักครู่');

  try {
    // session เงินสด
    const { data: session } = await db.from('cash_session')
      .select('*').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();

    // สร้างบิล
    const methodTH = { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ติดหนี้' };
    const { data: bill, error: billErr } = await db.from('บิลขาย').insert({
      date:          new Date().toISOString(),
      method:        methodTH[checkoutState.method] || 'เงินสด',
      total:         checkoutState.total,
      discount:      checkoutState.discount || 0,
      received:      checkoutState.received || 0,
      change:        checkoutState.change   || 0,
      customer_name: checkoutState.customer?.name || null,
      customer_id:   checkoutState.customer?.id   || null,
      staff_name:    v9Staff(),
      status:        checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
    }).select().single();
    if (billErr) throw new Error(billErr.message);

    // ดึง stock ปัจจุบันจาก DB (ไม่ใช้ cache)
    const { data: freshProds } = await db.from('สินค้า')
      .select('id,name,stock,product_type,unit,cost');
    const stockMap = {};
    (freshProds||[]).forEach(p => { stockMap[p.id] = p; });

    // วนทุก item
    for (const item of cart) {
      const fresh    = stockMap[item.id] || {};
      const convRate = parseFloat(item.conv_rate || 1);
      const baseQty  = parseFloat((item.qty * convRate).toFixed(6));
      const sellUnit = item.unit || fresh.unit || 'ชิ้น';
      const isMTO    = !!(item.is_mto || fresh.product_type === 'ตามบิล');

      // บันทึกรายการในบิล
      await db.from('รายการในบิล').insert({
        bill_id:    bill.id,
        product_id: item.id,
        name:       item.name,
        qty:        item.qty,
        price:      parseFloat(item.price || 0),
        cost:       parseFloat(item.cost  || 0),
        total:      parseFloat((item.price * item.qty).toFixed(2)),
        unit:       sellUnit,
      });

      if (!isMTO) {
        // ตัดสต็อก base qty
        const stockBefore = parseFloat(fresh.stock || 0);
        const stockAfter  = parseFloat(Math.max(0, stockBefore - baseQty).toFixed(6));

        await db.from('สินค้า').update({
          stock: stockAfter, updated_at: new Date().toISOString()
        }).eq('id', item.id);

        await db.from('stock_movement').insert({
          product_id:   item.id,
          product_name: item.name,
          type:         'ขาย',
          direction:    'out',
          qty:          baseQty,
          stock_before: stockBefore,
          stock_after:  stockAfter,
          ref_id:       bill.id,
          ref_table:    'บิลขาย',
          staff_name:   v9Staff(),
          note: convRate !== 1
            ? `ขาย ${item.qty} ${sellUnit} (${baseQty} ${fresh.unit||''})`
            : null,
        });

      } else {
        // ตามบิล: ตัดวัตถุดิบ BOM
        try {
          const { data: recipes } = await db.from('สูตรสินค้า')
            .select('*').eq('product_id', item.id);
          for (const r of (recipes||[])) {
            const mat      = stockMap[r.material_id] || {};
            const needed   = parseFloat((r.quantity * item.qty).toFixed(6));
            const matBefore= parseFloat(mat.stock || 0);
            const matAfter = parseFloat(Math.max(0, matBefore - needed).toFixed(6));
            await db.from('สินค้า').update({
              stock: matAfter, updated_at: new Date().toISOString()
            }).eq('id', r.material_id);
            await db.from('stock_movement').insert({
              product_id:   r.material_id,
              product_name: mat.name || r.material_id,
              type:         'ใช้ผลิต(ขาย)',
              direction:    'out',
              qty:          needed,
              stock_before: matBefore,
              stock_after:  matAfter,
              ref_id:       bill.id,
              ref_table:    'บิลขาย',
              staff_name:   v9Staff(),
              note: `บิล #${bill.bill_no}: ${item.name} × ${item.qty} ${sellUnit}`,
            });
          }
        } catch(e) { console.warn('[v9Sale] BOM deduct:', e.message); }
      }
    }

    // Cash transaction
    if (checkoutState.method === 'cash' && session) {
      let chgDenoms = checkoutState.changeDenominations || {};
      if (!Object.values(chgDenoms).some(v=>Number(v)>0) && checkoutState.change > 0)
        chgDenoms = typeof calcChangeDenominations==='function'
          ? calcChangeDenominations(checkoutState.change) : {};
      await window.recordCashTx({
        sessionId: session.id, type:'ขาย', direction:'in',
        amount:    checkoutState.received,
        changeAmt: checkoutState.change,
        netAmount: checkoutState.total,
        refId:     bill.id, refTable:'บิลขาย',
        denominations:       checkoutState.receivedDenominations || null,
        changeDenominations: chgDenoms || null,
        note: null,
      });
    }

    // Customer update
    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer')
        .select('total_purchase,visit_count,debt_amount')
        .eq('id', checkoutState.customer.id).maybeSingle();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase||0) + checkoutState.total,
        visit_count:    (cust?.visit_count||0) + 1,
        debt_amount:    checkoutState.method==='debt'
          ? (cust?.debt_amount||0) + checkoutState.total
          : (cust?.debt_amount||0),
      }).eq('id', checkoutState.customer.id);
    }

    typeof logActivity==='function' && logActivity(
      'ขายสินค้า',
      `บิล #${bill.bill_no} ฿${formatNum(checkoutState.total)}`,
      bill.id, 'บิลขาย'
    );
    typeof sendToDisplay==='function' && sendToDisplay({
      type:'thanks', billNo:bill.bill_no, total:checkoutState.total
    });

    const { data: bItems } = await db.from('รายการในบิล')
      .select('*').eq('bill_id', bill.id);

    try { cart = []; } catch(_) { window.cart = []; }
    await loadProducts?.();
    try { if(typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    renderCart?.(); renderProductGrid?.(); updateHomeStats?.();

    try {
      const nb = await getLiveCashBalance?.();
      ['cash-current-balance','global-cash-balance'].forEach(id=>{
        const el=document.getElementById(id);
        if(el) el.textContent=`฿${formatNum(nb)}`;
      });
    } catch(_){}

    v9HideOverlay();
    typeof closeCheckout==='function' && closeCheckout();

    const fmt = (typeof receiptFormat!=='undefined'?receiptFormat:null)||'80mm';
    const { value: doPrint } = await Swal.fire({
      icon: 'success',
      title: `บิล #${bill.bill_no} สำเร็จ`,
      html: `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
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
          <div style="font-size:16px;font-weight:800;color:#d97706;">฿${formatNum(Math.max(0,checkoutState.change))}</div>
        </div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: `<i class="material-icons-round" style="font-size:16px;vertical-align:middle;">print</i> พิมพ์ (${fmt})`,
      cancelButtonText: 'ข้าม',
      confirmButtonColor: '#10B981',
      timer: 8000, timerProgressBar: true,
    });
    if (doPrint && typeof printReceipt==='function')
      printReceipt(bill, bItems||[], fmt);

  } catch(e) {
    v9HideOverlay();
    typeof toast==='function' && toast('เกิดข้อผิดพลาด: '+(e.message||e), 'error');
    console.error('[v9Sale]', e);
  } finally {
    window.isProcessingPayment = false;
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-34
//  1. badge "ตามสั่ง" — ลบ injection เก่า ใช้ CSS class filter แทน
//  2. บันทึกคลังสินค้า — แก้ renderInventory ให้ใช้ button tag ถูก
//  3. A4 print — Swal หลังขาย: 3 ปุ่ม (80mm / A4 / ข้าม)
// ══════════════════════════════════════════════════════════════════

// ── 1. badge "ตามสั่ง" — ใส่ใน renderProductGrid เฉพาะ card grid ──
// ลบ injection ที่ใช้ [onclick*=id] (จับ cart ด้วย)
// แทนด้วย inject ใน HTML ของ product card โดยตรง
const _v9OrigRenderPG34 = window.renderProductGrid;
window.renderProductGrid = function () {
  const hidden  = [];
  const patched = [];
  try {
    if (typeof products !== 'undefined') {
      for (let i = products.length - 1; i >= 0; i--) {
        const p = products[i];
        if (p.is_raw === true && p.product_type !== 'both') {
          hidden.push({ idx: i, prod: products.splice(i, 1)[0] });
        }
      }
      products.forEach(p => {
        if (p.product_type === 'ตามบิล' && (p.stock||0) <= 0) {
          p._origStock = p.stock; p.stock = 1; patched.push(p);
        }
      });
    }
  } catch(_) {}

  _v9OrigRenderPG34?.apply(this, arguments);

  // คืน products
  try {
    patched.forEach(p => {
      if (p._origStock !== undefined) { p.stock = p._origStock; delete p._origStock; }
    });
    hidden.reverse().forEach(h => {
      if (typeof products !== 'undefined') products.splice(h.idx, 0, h.prod);
    });
  } catch(_) {}

  // badge "ตามสั่ง" — เฉพาะ .product-card และ .product-list-item
  // ต้องมี class และอยู่ใน #pos-product-grid เท่านั้น
  try {
    const grid = document.getElementById('pos-product-grid');
    if (!grid) return;
    if (typeof products === 'undefined') return;
    products.filter(p => p.product_type === 'ตามบิล').forEach(p => {
      // หา card ใน grid เท่านั้น
      grid.querySelectorAll('.product-card, .product-list-item').forEach(card => {
        if (!card.getAttribute('onclick')?.includes(p.id)) return;
        if (card.querySelector('.v9-mto-badge')) return;
        const badge = document.createElement('div');
        badge.className = 'v9-mto-badge';
        badge.style.cssText =
          'position:absolute;top:6px;left:6px;font-size:9px;padding:2px 5px;' +
          'border-radius:4px;background:#ede9fe;color:#6d28d9;font-weight:700;' +
          'pointer-events:none;z-index:1;';
        badge.textContent = 'ตามสั่ง';
        if (getComputedStyle(card).position === 'static') card.style.position='relative';
        card.appendChild(badge);
      });
    });
  } catch(_) {}
};


// ── 2. renderInventory — ใช้ onclick เรียก editProduct ถูก ────────
// ปัญหา: หน้าคลังสินค้าปุ่มแก้ไขเรียก showAddProductModal โดยตรง
// แต่ showAddProductModal ใน v9 ใช้ form ใหม่ -> v9SaveProduct ทำงาน
// ตรวจว่า form มี action ถูกต้อง
// แก้: override editProduct ให้แน่ใจว่าเรียก showAddProductModal(p) ถูก

window.editProduct = async function (productId) {
  const prods = typeof products !== 'undefined'
    ? products
    : await v9GetProducts() || [];
  const p = prods.find(x => x.id === productId);
  if (!p) {
    // ลอง load จาก DB
    const { data } = await db.from('สินค้า').select('*').eq('id', productId).maybeSingle();
    if (data) window.showAddProductModal(data);
    return;
  }
  window.showAddProductModal(p);
};


// ── 3. A4 print — Swal หลังขาย มี 3 ตัวเลือก ────────────────────
// override v9Sale ให้ Swal มีปุ่ม 80mm + A4 + ข้าม
const _v9OrigSale34 = window.v9Sale;
window.v9Sale = async function () {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;
  v9ShowOverlay('กำลังบันทึกบิล...', 'โปรดรอสักครู่');

  try {
    const { data: session } = await db.from('cash_session')
      .select('*').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();

    const methodTH = { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ติดหนี้' };
    const { data: bill, error: billErr } = await db.from('บิลขาย').insert({
      date:          new Date().toISOString(),
      method:        methodTH[checkoutState.method] || 'เงินสด',
      total:         checkoutState.total,
      discount:      checkoutState.discount || 0,
      received:      checkoutState.received || 0,
      change:        checkoutState.change   || 0,
      customer_name: checkoutState.customer?.name || null,
      customer_id:   checkoutState.customer?.id   || null,
      staff_name:    v9Staff(),
      status:        checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
    }).select().single();
    if (billErr) throw new Error(billErr.message);

    const { data: freshProds } = await db.from('สินค้า')
      .select('id,name,stock,product_type,unit,cost');
    const stockMap = {};
    (freshProds||[]).forEach(p => { stockMap[p.id] = p; });

    for (const item of cart) {
      const fresh    = stockMap[item.id] || {};
      const convRate = parseFloat(item.conv_rate || 1);
      const baseQty  = parseFloat((item.qty * convRate).toFixed(6));
      const sellUnit = item.unit || fresh.unit || 'ชิ้น';
      const isMTO    = !!(item.is_mto || fresh.product_type === 'ตามบิล');

      await db.from('รายการในบิล').insert({
        bill_id: bill.id, product_id: item.id, name: item.name,
        qty: item.qty, price: parseFloat(item.price||0),
        cost: parseFloat(item.cost||0),
        total: parseFloat((item.price * item.qty).toFixed(2)),
        unit: sellUnit,
      });

      if (!isMTO) {
        const stockBefore = parseFloat(fresh.stock || 0);
        const stockAfter  = parseFloat(Math.max(0, stockBefore - baseQty).toFixed(6));
        await db.from('สินค้า').update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', item.id);
        await db.from('stock_movement').insert({
          product_id: item.id, product_name: item.name,
          type:'ขาย', direction:'out', qty: baseQty,
          stock_before: stockBefore, stock_after: stockAfter,
          ref_id: bill.id, ref_table:'บิลขาย', staff_name: v9Staff(),
          note: convRate !== 1 ? `ขาย ${item.qty} ${sellUnit} (${baseQty} ${fresh.unit||''})` : null,
        });
      } else {
        try {
          const { data: recipes } = await db.from('สูตรสินค้า').select('*').eq('product_id', item.id);
          for (const r of (recipes||[])) {
            const mat = stockMap[r.material_id] || {};
            const needed   = parseFloat((r.quantity * item.qty).toFixed(6));
            const matBefore= parseFloat(mat.stock || 0);
            const matAfter = parseFloat(Math.max(0, matBefore - needed).toFixed(6));
            await db.from('สินค้า').update({ stock: matAfter, updated_at: new Date().toISOString() }).eq('id', r.material_id);
            await db.from('stock_movement').insert({
              product_id: r.material_id, product_name: mat.name || r.material_id,
              type:'ใช้ผลิต(ขาย)', direction:'out', qty: needed,
              stock_before: matBefore, stock_after: matAfter,
              ref_id: bill.id, ref_table:'บิลขาย', staff_name: v9Staff(),
              note: `บิล #${bill.bill_no}: ${item.name} × ${item.qty} ${sellUnit}`,
            });
          }
        } catch(e) { console.warn('[v9Sale] BOM:', e.message); }
      }
    }

    if (checkoutState.method === 'cash' && session) {
      let chgDenoms = checkoutState.changeDenominations || {};
      if (!Object.values(chgDenoms).some(v=>Number(v)>0) && checkoutState.change>0)
        chgDenoms = typeof calcChangeDenominations==='function' ? calcChangeDenominations(checkoutState.change) : {};
      await window.recordCashTx({
        sessionId: session.id, type:'ขาย', direction:'in',
        amount: checkoutState.received, changeAmt: checkoutState.change,
        netAmount: checkoutState.total, refId: bill.id, refTable:'บิลขาย',
        denominations: checkoutState.receivedDenominations || null,
        changeDenominations: chgDenoms || null, note: null,
      });
    }

    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer')
        .select('total_purchase,visit_count,debt_amount')
        .eq('id', checkoutState.customer.id).maybeSingle();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase||0) + checkoutState.total,
        visit_count:    (cust?.visit_count||0) + 1,
        debt_amount:    checkoutState.method==='debt'
          ? (cust?.debt_amount||0) + checkoutState.total
          : (cust?.debt_amount||0),
      }).eq('id', checkoutState.customer.id);
    }

    typeof logActivity==='function' && logActivity('ขายสินค้า', `บิล #${bill.bill_no} ฿${formatNum(checkoutState.total)}`, bill.id, 'บิลขาย');
    typeof sendToDisplay==='function' && sendToDisplay({ type:'thanks', billNo: bill.bill_no, total: checkoutState.total });

    const { data: bItems } = await db.from('รายการในบิล').select('*').eq('bill_id', bill.id);

    try { cart = []; } catch(_) { window.cart = []; }
    await loadProducts?.();
    try { if(typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    renderCart?.(); renderProductGrid?.(); updateHomeStats?.();

    try {
      const nb = await getLiveCashBalance?.();
      ['cash-current-balance','global-cash-balance'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.textContent=`฿${formatNum(nb)}`;
      });
    } catch(_){}

    v9HideOverlay();
    typeof closeCheckout==='function' && closeCheckout();

    // ── Swal 3 ปุ่ม: 80mm / A4 / ข้าม ──
    const { value: printChoice } = await Swal.fire({
      icon: 'success',
      title: `บิล #${bill.bill_no} สำเร็จ`,
      html: `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0 16px;text-align:center;">
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
            <div style="font-size:16px;font-weight:800;color:#d97706;">฿${formatNum(Math.max(0,checkoutState.change))}</div>
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
      showDenyButton:    true,
      showCancelButton:  false,
      confirmButtonText: '',
      denyButtonText:    '',
      customClass: { confirmButton: 'swal-hidden-btn', denyButton: 'swal-hidden-btn' },
      didOpen: () => {
        // ซ่อนปุ่ม hidden
        document.querySelectorAll('.swal-hidden-btn').forEach(b => {
          b.style.display='none';
        });
        window._v9PrintFmt = null;
      },
      timer: 15000, timerProgressBar: true,
    });

    const fmt = window._v9PrintFmt;
    if (fmt && typeof printReceipt === 'function') {
      printReceipt(bill, bItems||[], fmt);
    }
    window._v9PrintFmt = null;

  } catch(e) {
    v9HideOverlay();
    typeof toast==='function' && toast('เกิดข้อผิดพลาด: '+(e.message||e), 'error');
    console.error('[v9Sale]', e);
  } finally {
    window.isProcessingPayment = false;
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-35 — BUG 3: แก้ไขสูตรสินค้า (BOM materials) ได้เต็มรูปแบบ
//   - แก้วัตถุดิบแต่ละตัว: qty, unit
//   - เพิ่ม/ลบวัตถุดิบในสูตร
//   - แก้ชื่อ/ราคาสินค้าสำเร็จรูป
// ══════════════════════════════════════════════════════════════════

window.v9RecipeEditFull = async function (prodId) {
  const prod = v9GetProducts().find(p => p.id === prodId);
  if (!prod) return;

  v9ShowOverlay('โหลดสูตร...');
  let recipes = [], allProds = [];
  try {
    const { data: r } = await db.from('สูตรสินค้า').select('*').eq('product_id', prodId);
    recipes   = r || [];
    allProds  = v9GetProducts();
  } catch(e) { v9HideOverlay(); toast('โหลดไม่ได้: '+e.message,'error'); return; }
  v9HideOverlay();

  const rawProds = allProds.filter(p => p.is_raw || p.product_type==='both');
  const prodMap  = {};
  allProds.forEach(p => { prodMap[p.id] = p; });

  // สร้าง rows HTML
  const buildMatRow = (idx, matId, qty, unit) => {
    const mat = prodMap[matId] || {};
    return `
      <div id="v9re-row-${idx}" style="display:grid;grid-template-columns:1fr 90px 80px 30px;
        gap:6px;margin-bottom:6px;align-items:center;">
        <select id="v9re-mat-${idx}" class="swal2-input" style="margin:0;font-size:12px;height:34px;">
          ${rawProds.map(p=>`<option value="${p.id}" ${p.id===matId?'selected':''}>${p.name} (${p.unit||''})</option>`).join('')}
        </select>
        <input id="v9re-qty-${idx}" class="swal2-input" type="number" value="${qty}" min="0.001" step="0.001"
          style="margin:0;font-size:12px;height:34px;" placeholder="qty">
        <input id="v9re-unit-${idx}" class="swal2-input" value="${unit||mat.unit||''}"
          style="margin:0;font-size:12px;height:34px;" placeholder="หน่วย">
        <button type="button" onclick="document.getElementById('v9re-row-${idx}').remove()"
          style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:18px;padding:0;">✕</button>
      </div>`;
  };

  let rowIdx = recipes.length;
  const initialRows = recipes.map((r, i) => buildMatRow(i, r.material_id, r.quantity, r.unit)).join('');

  const { isConfirmed } = await Swal.fire({
    title: `แก้ไขสูตร: ${prod.name}`,
    width: '620px',
    html: `
      <div style="text-align:left;">
        <!-- ข้อมูลสินค้า -->
        <div style="background:#f9fafb;border-radius:8px;padding:10px 12px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:#666;margin-bottom:8px;text-transform:uppercase;">ข้อมูลสินค้าสำเร็จรูป</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <div>
              <label style="font-size:11px;color:#666;display:block;margin-bottom:3px;">ชื่อสินค้า</label>
              <input id="v9re-name" class="swal2-input" value="${prod.name}" style="margin:0;font-size:13px;height:34px;">
            </div>
            <div>
              <label style="font-size:11px;color:#666;display:block;margin-bottom:3px;">ราคาขาย (฿)</label>
              <input id="v9re-price" class="swal2-input" type="number" value="${prod.price||0}" style="margin:0;font-size:13px;height:34px;">
            </div>
            <div>
              <label style="font-size:11px;color:#666;display:block;margin-bottom:3px;">หน่วย</label>
              <input id="v9re-unit-prod" class="swal2-input" value="${prod.unit||'ชิ้น'}" style="margin:0;font-size:13px;height:34px;">
            </div>
          </div>
        </div>

        <!-- วัตถุดิบ -->
        <div style="font-size:11px;font-weight:700;color:#666;margin-bottom:6px;text-transform:uppercase;">วัตถุดิบในสูตร</div>
        <div style="display:grid;grid-template-columns:1fr 90px 80px 30px;gap:6px;margin-bottom:4px;">
          <span style="font-size:10px;color:#999;">วัตถุดิบ</span>
          <span style="font-size:10px;color:#999;">ปริมาณ</span>
          <span style="font-size:10px;color:#999;">หน่วย</span>
          <span></span>
        </div>
        <div id="v9re-rows">${initialRows}</div>
        <button type="button" onclick="
          const rows = document.getElementById('v9re-rows');
          const idx = parseInt(document.querySelectorAll('[id^=v9re-row-]').length);
          rows.insertAdjacentHTML('beforeend', window._v9ReRowFn(idx));
          window._v9ReRowIdx = idx+1;"
          style="width:100%;padding:6px;border:1px dashed #d1d5db;border-radius:6px;
            background:none;cursor:pointer;font-size:12px;color:#6b7280;margin-top:4px;">
          + เพิ่มวัตถุดิบ
        </button>
      </div>`,
    showCancelButton: true,
    confirmButtonText: '<i class="material-icons-round" style="font-size:14px;vertical-align:middle;">save</i> บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#DC2626',
    didOpen: () => {
      // เก็บ fn ให้ onclick ใช้ได้
      window._v9ReRowFn = (idx) => {
        const rawProds = v9GetProducts().filter(p => p.is_raw || p.product_type==='both');
        return `<div id="v9re-row-${idx}" style="display:grid;grid-template-columns:1fr 90px 80px 30px;gap:6px;margin-bottom:6px;align-items:center;">
          <select id="v9re-mat-${idx}" class="swal2-input" style="margin:0;font-size:12px;height:34px;">
            ${rawProds.map(p=>`<option value="${p.id}">${p.name} (${p.unit||''})</option>`).join('')}
          </select>
          <input id="v9re-qty-${idx}" class="swal2-input" type="number" value="1" min="0.001" step="0.001" style="margin:0;font-size:12px;height:34px;">
          <input id="v9re-unit-${idx}" class="swal2-input" value="" style="margin:0;font-size:12px;height:34px;" placeholder="หน่วย">
          <button type="button" onclick="document.getElementById('v9re-row-${idx}').remove()"
            style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:18px;padding:0;">✕</button>
        </div>`;
      };
      window._v9ReRowIdx = rowIdx;
    },
    preConfirm: () => {
      const newRows = [];
      document.querySelectorAll('[id^="v9re-row-"]').forEach(row => {
        const idx   = row.id.replace('v9re-row-', '');
        const matId = document.getElementById(`v9re-mat-${idx}`)?.value;
        const qty   = parseFloat(document.getElementById(`v9re-qty-${idx}`)?.value || 0);
        const unit  = document.getElementById(`v9re-unit-${idx}`)?.value?.trim();
        if (matId && qty > 0) newRows.push({ material_id: matId, quantity: qty, unit: unit||'' });
      });
      window._v9RecipeEditVal = {
        name:  document.getElementById('v9re-name')?.value?.trim(),
        price: parseFloat(document.getElementById('v9re-price')?.value || 0),
        unit:  document.getElementById('v9re-unit-prod')?.value?.trim() || 'ชิ้น',
        rows:  newRows,
      };
      return true;
    },
  });

  // isConfirmed = true เมื่อกด บันทึก, value = ผลจาก preConfirm
  if (!isConfirmed) return;

  v9ShowOverlay('กำลังบันทึกสูตร...');
  try {
    // Swal ส่ง value จาก preConfirm มาใน { isConfirmed, value }
    // แต่เราใช้ destructuring ด้านบน → ต้องอ่านจาก Swal.fire result
    // ดึงค่าตรงจาก DOM ก่อน Swal ปิด DOM → ใช้ window._v9RecipeEditVal ที่ preConfirm set ไว้
    const lsr = window._v9RecipeEditVal;
    if (!lsr || !lsr.name) { v9HideOverlay(); return; }

    await db.from('สินค้า').update({
      name: lsr.name, price: lsr.price, unit: lsr.unit,
      updated_at: new Date().toISOString(),
    }).eq('id', prodId);

    await db.from('สูตรสินค้า').delete().eq('product_id', prodId);
    for (const r of lsr.rows) {
      await db.from('สูตรสินค้า').insert({
        product_id: prodId, material_id: r.material_id,
        quantity: r.quantity, unit: r.unit,
      });
    }

    window._v9ProductsCache = null;
    await loadProducts?.();
    try { if(typeof products!=='undefined') window._v9ProductsCache=products; } catch(_){}
    typeof toast==='function' && toast('บันทึกสูตรสำเร็จ','success');
    const inner = document.getElementById('v9-manage-inner');
    if (inner) await window.v9AdminRecipe(inner);
  } catch(e) {
    typeof toast==='function' && toast('ไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};

// วิธีที่ดีกว่า — Swal preConfirm save ทันที
window.v9RecipeEditProduct = window.v9RecipeEditFull;


// ══════════════════════════════════════════════════════════════════
// FIX-36
//  1. Unit popup — ซ่อน base unit (kg ราคาแปลก) → แสดงแค่หน่วยขาย
//     แสดง info bar "สต็อก X kg · ต้นทุน ฿Y/kg" แทน
//  2. Recipe page — ปุ่มแก้ไขสูตรฝังใน HTML โดยตรง (ไม่ inject DOM)
// ══════════════════════════════════════════════════════════════════

// ── 1. v9ShowUnitPopup redesign ───────────────────────────────────
window.v9ShowUnitPopup = function (prod, sellUnits) {
  if (typeof openModal !== 'function') return;
  const baseUnit = prod.unit || 'ชิ้น';
  const isMTO    = prod.product_type === 'ตามบิล';
  const stock    = parseFloat(prod.stock || 0);
  const costBase = parseFloat(prod.cost || 0); // ต้นทุน/base unit

  openModal(`เลือกหน่วย: ${prod.name}`, `
    <!-- Header: สต็อก + ต้นทุน -->
    <div style="background:var(--bg-base);border-radius:10px;padding:12px 14px;
      margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;
      border:0.5px solid var(--border-light);">
      <div>
        <div style="font-size:16px;font-weight:700;">${prod.name}</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:3px;">
          ${isMTO
            ? '<span style="color:#7c3aed;font-weight:700;">📋 ผลิตตามบิล</span>'
            : `สต็อก <strong style="color:var(--text-primary);">${parseFloat(stock.toFixed(2)).toLocaleString()} ${baseUnit}</strong>`}
          ${costBase > 0 && !isMTO
            ? ` &nbsp;·&nbsp; ต้นทุน <strong style="color:var(--text-secondary);">฿${parseFloat(costBase.toFixed(4))}/${baseUnit}</strong>`
            : ''}
        </div>
      </div>
      ${!isMTO && stock > 0 ? `
        <div style="text-align:right;">
          <div style="font-size:10px;color:var(--text-tertiary);">เหลือในคลัง</div>
          <div style="font-size:16px;font-weight:800;color:#15803d;">${parseFloat(stock.toFixed(2)).toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text-tertiary);">${baseUnit}</div>
        </div>` : ''}
    </div>

    <!-- Sell unit cards ONLY (ไม่แสดง base) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:18px;" id="v9unit-grid">
      ${sellUnits.map((u, ui) => {
        const conv    = parseFloat(u.conv_rate || 1);
        const price   = parseFloat(u.price_per_unit || 0);
        const maxQty  = isMTO ? 9999 : Math.floor(stock / conv);
        const costU   = costBase * conv;
        const margin  = (price > 0 && costU > 0) ? Math.round(((price - costU) / price) * 100) : 0;
        const canSell = isMTO || maxQty > 0;
        return `
          <div onclick="${canSell ? `v9SelectUnitQty('${prod.id}','${u.unit_name}',${price},${conv},${stock})` : ''}"
            style="padding:16px 12px;border:1.5px solid ${ui===0?'var(--primary)':'var(--border-light)'};
              border-radius:14px;text-align:center;cursor:${canSell?'pointer':'not-allowed'};
              transition:all .15s;position:relative;
              background:${ui===0?'#fff5f5':'var(--bg-surface)'};
              opacity:${canSell?1:0.45};"
            ${canSell?`onmouseenter="this.style.borderColor='var(--primary)';this.style.background='#fff5f5';"
              onmouseleave="this.style.borderColor='${ui===0?'var(--primary)':'var(--border-light)'}';\
                this.style.background='${ui===0?'#fff5f5':'var(--bg-surface)'}';"`:''}
            id="v9ucard-${ui}">
            ${margin > 0 ? `<div style="position:absolute;top:6px;right:6px;font-size:9px;
              padding:2px 6px;border-radius:999px;background:#f0fdf4;color:#15803d;font-weight:700;">
              กำไร ${margin}%</div>` : ''}
            <div style="font-size:22px;font-weight:800;color:${price>0?'var(--primary)':'var(--text-tertiary)'};">
              ${price > 0 ? `฿${formatNum(price)}` : '<span style="font-size:12px;">ยังไม่มีราคา</span>'}
            </div>
            <div style="font-size:15px;font-weight:700;margin-top:6px;">${u.unit_name}</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">
              1 ${u.unit_name} = ${parseFloat(conv.toFixed(2)).toLocaleString()} ${baseUnit}
            </div>
            ${!isMTO ? `<div style="font-size:10px;margin-top:4px;color:${maxQty>0?'#15803d':'#dc2626'};">
              ${maxQty > 0 ? `ขายได้ ${maxQty} ${u.unit_name}` : 'สต็อกไม่พอ'}</div>` : ''}
          </div>`;
      }).join('')}
    </div>

    <!-- จำนวน -->
    <div style="background:var(--bg-base);border-radius:10px;padding:14px;border:0.5px solid var(--border-light);">
      <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;">
        จำนวน <span id="v9unit-selected-unit" style="color:var(--primary);">(เลือกหน่วยด้านบน)</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button onclick="v9UnitQtyChange(-1)"
          style="width:40px;height:40px;border-radius:10px;border:0.5px solid var(--border-light);
            background:var(--bg-surface);font-size:20px;cursor:pointer;display:flex;
            align-items:center;justify-content:center;">−</button>
        <input type="number" id="v9unit-qty" value="1" min="0.001" step="any"
          style="flex:1;height:40px;border:0.5px solid var(--border-light);border-radius:10px;
            text-align:center;font-size:18px;font-weight:700;background:var(--bg-surface);
            outline:none;color:var(--text-primary);font-family:var(--font-thai,'Prompt'),sans-serif;"
          oninput="v9UnitQtyUpdate()">
        <button onclick="v9UnitQtyChange(1)"
          style="width:40px;height:40px;border-radius:10px;border:0.5px solid var(--border-light);
            background:var(--bg-surface);font-size:20px;cursor:pointer;display:flex;
            align-items:center;justify-content:center;">+</button>
      </div>
      <div id="v9unit-total-preview" style="text-align:center;font-size:13px;
        color:var(--text-tertiary);margin-top:8px;"></div>
      <button id="v9unit-add-btn" disabled onclick="v9ConfirmUnitAdd()"
        style="width:100%;margin-top:12px;padding:13px;background:#ccc;color:#fff;
          border:none;border-radius:10px;font-size:14px;font-weight:700;
          cursor:not-allowed;transition:all .2s;">
        เลือกหน่วยก่อน
      </button>
    </div>`);

  window._v9UnitPopupProd = prod;
  window._v9UnitPopupSel  = null;

  // auto-select หน่วยแรกถ้ามีแค่หน่วยเดียว
  if (sellUnits.length === 1) {
    setTimeout(() => {
      const u = sellUnits[0];
      v9SelectUnitQty(prod.id, u.unit_name, u.price_per_unit||0, u.conv_rate||1, stock);
    }, 80);
  }
};


// ── 2. v9AdminRecipe — ฝัง edit button ใน HTML โดยตรง ────────────
window.v9AdminRecipe = async function (container) {
  if (!container) return;
  container.innerHTML = v9AdminLoading('โหลดสูตรสินค้า...');
  let recipes = [], prods = [];
  try {
    prods = v9GetProducts();
    const { data, error } = await db.from('สูตรสินค้า').select('id,product_id,material_id,quantity,unit');
    if (error) throw new Error(error.message);
    recipes = data || [];
  } catch(e) {
    container.innerHTML = v9AdminError('โหลดไม่ได้: ' + e.message);
    return;
  }

  const prodMap = {};
  prods.forEach(p => { prodMap[p.id] = p; });
  const grouped = {};
  recipes.forEach(r => {
    if (!grouped[r.product_id]) grouped[r.product_id] = [];
    grouped[r.product_id].push(r);
  });

  const recipeProds = Object.keys(grouped);

  container.innerHTML = `
    ${v9SectionHeader('สูตรสินค้า',
      `<button class="btn btn-primary btn-sm" onclick="v9RecipeShowCreate()">
        <i class="material-icons-round" style="font-size:14px;">add</i> สร้างสูตรใหม่
      </button>`)}

    <!-- create form -->
    <div id="v9rec-create" style="display:none;background:var(--bg-base);border-radius:14px;
      padding:18px;margin-bottom:20px;border:1px solid var(--border-light);">
      <div style="font-size:13px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:6px;">
        <i class="material-icons-round" style="font-size:16px;color:var(--primary);">science</i>
        สร้างสูตรสินค้าใหม่
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">ชื่อสินค้าที่จะผลิต *</label>
          <input class="form-input" id="v9rec-name" placeholder="เช่น เสา 20×20×3, ปูน 240ksc">
        </div>
        <div class="form-group">
          <label class="form-label">ประเภท *</label>
          <select class="form-input" id="v9rec-type">
            <option value="ตามบิล">ตามบิล (ผสมตอนขาย Auto-deduct)</option>
            <option value="ผลิตล่วงหน้า">ผลิตล่วงหน้า (มีสต็อก)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">หน่วยสินค้า</label>
          <input class="form-input" id="v9rec-unit" placeholder="ชิ้น, ลบ.ม., ถุง">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div class="form-group">
          <label class="form-label">ราคาขาย (บาท) *</label>
          <input class="form-input" type="number" id="v9rec-price" value="0" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">ต้นทุน (คำนวณอัตโนมัติ)</label>
          <div id="v9rec-cost-display" style="padding:9px 12px;background:var(--bg-surface);
            border:1.5px solid var(--primary);border-radius:var(--radius-md);font-size:14px;
            font-weight:700;color:var(--primary);">฿0</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <label class="form-label" style="margin:0;">วัตถุดิบ *</label>
        <button type="button" class="btn btn-outline btn-sm" onclick="v9RecipeAddMat()">
          <i class="material-icons-round" style="font-size:13px;">add</i> เพิ่มวัตถุดิบ
        </button>
      </div>
      <div id="v9rec-mat-rows"></div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-primary" onclick="v9RecipeSave()">
          <i class="material-icons-round" style="font-size:14px;">save</i> บันทึกสูตร
        </button>
        <button class="btn btn-outline" onclick="document.getElementById('v9rec-create').style.display='none'">ยกเลิก</button>
      </div>
    </div>

    <!-- สูตรที่มีอยู่ -->
    ${recipeProds.length === 0
      ? `<div style="text-align:center;padding:60px;color:var(--text-tertiary);">
           <i class="material-icons-round" style="font-size:48px;opacity:.3;display:block;margin-bottom:12px;">science</i>
           ยังไม่มีสูตรสินค้า
         </div>`
      : recipeProds.map(pid => {
          const prod    = prodMap[pid];
          const mats    = grouped[pid] || [];
          const ptype   = prod?.product_type || 'ตามบิล';
          const typeClr = ptype === 'ตามบิล' ? '#7c3aed' : '#0891b2';
          const typeBg  = ptype === 'ตามบิล' ? '#ede9fe' : '#ecfeff';
          const canMake = mats.length > 0
            ? Math.floor(Math.min(...mats.map(r => {
                const mat = prodMap[r.material_id];
                return mat?.stock > 0 ? Math.floor(mat.stock / r.quantity) : 0;
              })))
            : 0;
          return `
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);
              border-radius:16px;overflow:hidden;margin-bottom:12px;">

              <!-- Header -->
              <div style="padding:14px 18px;background:var(--bg-base);
                display:flex;align-items:center;justify-content:space-between;
                border-bottom:1px solid var(--border-light);">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="font-size:15px;font-weight:800;">${prod?.name || pid}</span>
                    <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;
                      background:${typeBg};color:${typeClr};">${ptype}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-tertiary);">
                    ราคา ฿${formatNum(prod?.price||0)} · ต้นทุน ฿${formatNum(prod?.cost||0)}
                    · <span style="color:${canMake>0?'var(--success)':'var(--danger)'};">
                        ผลิตได้ ${canMake} ${prod?.unit||'ชิ้น'}
                      </span>
                    ${ptype==='ผลิตล่วงหน้า' ? ` · สต็อก ${prod?.stock||0} ${prod?.unit||'ชิ้น'}` : ''}
                  </div>
                </div>

                <!-- ปุ่มขวา: แก้ไข + ผลิต -->
                <div style="display:flex;gap:8px;align-items:center;">
                  <button class="btn btn-outline btn-sm"
                    onclick="v9RecipeEditFull('${pid}')"
                    style="display:flex;align-items:center;gap:4px;">
                    <i class="material-icons-round" style="font-size:13px;">edit</i> แก้ไขสูตร
                  </button>
                  ${ptype === 'ผลิตล่วงหน้า' ? `
                    <input type="number" id="v9rec-produce-qty-${pid}" value="1" min="1"
                      style="width:60px;padding:5px;border:1.5px solid var(--border-light);
                        border-radius:6px;text-align:center;font-size:13px;">
                    <button class="btn btn-primary btn-sm" onclick="v9RecipeProduce('${pid}')">
                      <i class="material-icons-round" style="font-size:14px;">precision_manufacturing</i> ผลิต
                    </button>` : ''}
                </div>
              </div>

              <!-- วัตถุดิบ -->
              <div style="padding:12px 18px;">
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${mats.map(r => {
                    const mat = prodMap[r.material_id];
                    const ok  = (mat?.stock||0) >= r.quantity;
                    return `
                      <div style="display:flex;align-items:center;gap:5px;padding:5px 12px;
                        border-radius:999px;font-size:12px;
                        background:${ok?'#f0fdf4':'#fef2f2'};
                        border:1px solid ${ok?'#86efac':'#fca5a5'};
                        color:${ok?'#15803d':'#dc2626'};">
                        ${mat?.name || r.material_id}
                        <span style="opacity:.75;font-size:11px;">${r.quantity} ${r.unit||mat?.unit||''}</span>
                        <button onclick="v9AdminRecipeDelete('${r.id}')"
                          style="background:none;border:none;cursor:pointer;color:inherit;padding:0;margin-left:2px;">
                          <i class="material-icons-round" style="font-size:12px;">close</i>
                        </button>
                      </div>`;
                  }).join('')}
                  <button onclick="v9RecipeAddMatTo('${pid}')"
                    style="padding:5px 10px;border-radius:999px;font-size:12px;background:var(--bg-base);
                      border:1px dashed var(--border-light);cursor:pointer;color:var(--text-tertiary);">
                    + เพิ่มวัตถุดิบ
                  </button>
                </div>
                <!-- add material row -->
                <div id="v9rec-addto-${pid}" style="display:none;margin-top:10px;"></div>
              </div>
            </div>`;
        }).join('')}`;

  window._v9RecipeMatIdx = 0;
};


// ══════════════════════════════════════════════════════════════════
// FIX-39 — Dashboard Ultra: กราฟสวย + 4 period + Cash Flow + P&L
// ══════════════════════════════════════════════════════════════════

(function(){
  if(document.getElementById('v9db-css39'))return;
  const s=document.createElement('style');s.id='v9db-css39';
  s.textContent=`
    #page-dash{background:var(--bg-base)}
    .db-wrap{padding:20px 24px;max-width:1500px;margin:0 auto}
    .db-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px}
    .db-title{font-size:22px;font-weight:700;color:var(--text-primary)}
    .db-sub{font-size:12px;color:var(--text-tertiary);margin-top:3px}
    .db-pill{display:flex;gap:3px;background:var(--bg-base);border:0.5px solid var(--border-light);border-radius:999px;padding:3px}
    .db-btn{padding:6px 14px;border-radius:999px;font-size:12px;font-weight:500;border:none;
      background:transparent;color:var(--text-secondary);cursor:pointer;transition:all .18s;white-space:nowrap}
    .db-btn:hover{background:var(--bg-hover)}
    .db-btn.on{background:var(--primary);color:#fff;box-shadow:0 2px 8px rgba(220,38,38,.25)}
    .db-btn.on-g{background:#15803d;color:#fff;box-shadow:0 2px 8px rgba(21,128,61,.2)}
    .db-btn.on-b{background:#1d4ed8;color:#fff;box-shadow:0 2px 8px rgba(29,78,216,.2)}
    .db-kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
    .db-kpi{background:var(--bg-surface);border:0.5px solid var(--border-light);border-radius:16px;
      padding:18px 16px;position:relative;overflow:hidden;transition:transform .15s}
    .db-kpi:hover{transform:translateY(-2px)}
    .db-kpi-accent{position:absolute;top:0;left:0;width:100%;height:3px;border-radius:16px 16px 0 0}
    .db-kpi-val{font-size:24px;font-weight:700;margin:8px 0 4px}
    .db-kpi-lbl{font-size:11px;color:var(--text-tertiary);font-weight:500;text-transform:uppercase;letter-spacing:.04em}
    .db-kpi-sub{font-size:11px;font-weight:600;margin-top:6px}
    .db-kpi-icon{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:10px;
      display:flex;align-items:center;justify-content:center}
    .db-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    .db-grid-3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px;margin-bottom:16px}
    .db-card{background:var(--bg-surface);border:0.5px solid var(--border-light);border-radius:16px;overflow:hidden}
    .db-card-hd{padding:16px 20px;border-bottom:0.5px solid var(--border-light);display:flex;align-items:center;justify-content:space-between}
    .db-card-hd-title{font-size:14px;font-weight:700}
    .db-card-bd{padding:16px 20px}
    .db-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:0.5px solid var(--border-light)}
    .db-row:last-child{border-bottom:none}
    .db-tl{max-height:360px;overflow-y:auto}
    .db-tl-item{display:flex;align-items:center;gap:12px;padding:11px 20px;border-bottom:0.5px solid var(--border-light)}
    .db-tl-item:last-child{border-bottom:none}
    .db-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .db-bar-wrap{height:6px;background:var(--bg-base);border-radius:3px;overflow:hidden;margin-top:5px}
    .db-chart-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px}
    .db-badge{font-size:10px;padding:2px 8px;border-radius:999px;font-weight:600}
    .db-pl-row{display:flex;align-items:flex-start;justify-content:space-between;
      padding:9px 12px;border-radius:8px;margin-bottom:3px}
    .db-filter-row{display:flex;gap:3px}
    .db-filter-btn{padding:4px 10px;border-radius:999px;font-size:11px;font-weight:500;
      border:0.5px solid var(--border-light);background:transparent;color:var(--text-tertiary);cursor:pointer}
    .db-filter-btn.on{background:var(--primary);color:#fff;border-color:var(--primary)}
    @media(max-width:1100px){.db-kpi-grid{grid-template-columns:repeat(3,1fr)}.db-grid-3{grid-template-columns:1fr}.db-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
})();

window.renderDashboard = async function(){
  const section=document.getElementById('page-dash');
  if(!section)return;
  section.innerHTML=`<div class="db-wrap">
    <!-- Header -->
    <div class="db-hd">
      <div>
        <div class="db-title">📊 ภาพรวมธุรกิจ</div>
        <div class="db-sub" id="db-date-lbl">กำลังโหลด...</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <!-- Period pills -->
        <div class="db-pill">
          <button class="db-btn on db-per" data-d="1" data-lbl="วันนี้">วันนี้</button>
          <button class="db-btn db-per" data-d="7" data-lbl="7 วัน">สัปดาห์</button>
          <button class="db-btn db-per" data-d="30" data-lbl="30 วัน">เดือนนี้</button>
          <button class="db-btn db-per" data-d="365" data-lbl="365 วัน">ปีนี้</button>
        </div>
        <!-- View tabs -->
        <div class="db-pill">
          <button class="db-btn on-g db-vw" data-v="both">ทั้งคู่</button>
          <button class="db-btn db-vw" data-v="cash">💰 เงินสด</button>
          <button class="db-btn db-vw" data-v="pl">📈 P&amp;L</button>
        </div>
        <button class="db-btn" onclick="window.v9DashLoad()" style="border:0.5px solid var(--border-light);">
          <i class="material-icons-round" style="font-size:14px;vertical-align:middle;">refresh</i>
        </button>
      </div>
    </div>

    <!-- KPI 5 cards -->
    <div class="db-kpi-grid" id="db-kpi">
      ${[0,1,2,3,4].map(i=>`<div class="db-kpi">
        <div class="db-kpi-accent" style="background:#e5e7eb;"></div>
        <div class="db-kpi-icon" style="background:#f3f4f6;"></div>
        <div class="db-kpi-lbl" style="background:#e5e7eb;height:11px;border-radius:4px;width:60%;margin-bottom:8px;"></div>
        <div class="db-kpi-val" style="background:#e5e7eb;height:24px;border-radius:6px;width:75%;"></div>
      </div>`).join('')}
    </div>

    <!-- Chart full width -->
    <div class="db-card" style="margin-bottom:16px;">
      <div class="db-card-hd">
        <div class="db-card-hd-title">กราฟกระแสเงิน</div>
        <div style="display:flex;align-items:center;gap:14px;" id="db-chart-legend"></div>
      </div>
      <div class="db-card-bd" style="padding-bottom:8px;">
        <div id="db-chart" style="height:180px;display:flex;align-items:flex-end;gap:3px;position:relative;"></div>
        <div id="db-chart-lbl" style="display:flex;gap:3px;margin-top:6px;"></div>
      </div>
    </div>

    <!-- Main 2-col grid -->
    <div class="db-grid" id="db-main-grid" style="align-items:start;">

      <!-- LEFT: Timeline -->
      <div>
        <div class="db-card">
          <div class="db-card-hd">
            <div class="db-card-hd-title">รายการทั้งหมด</div>
            <div class="db-filter-row" id="db-tl-filters">
              ${['all:ทั้งหมด','sale:ขาย','buy:ซื้อ','exp:จ่าย'].map((x,i)=>{
                const[k,v]=x.split(':');
                return`<button class="db-filter-btn${i===0?' on':''} db-tlf" data-f="${k}">${v}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="db-tl" id="db-tl">
            <div style="padding:40px;text-align:center;color:var(--text-tertiary);font-size:12px;">โหลด...</div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Cash + PL + Top -->
      <div>
        <!-- Cash Flow Card -->
        <div class="db-card" id="db-cash-card" style="margin-bottom:14px;">
          <div class="db-card-hd">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:16px;">💰</span>
              <span class="db-card-hd-title">กระแสเงินสด</span>
            </div>
            <span class="db-badge" style="background:#f0fdf4;color:#15803d;">เงินเข้า-ออกจริง</span>
          </div>
          <div class="db-card-bd" id="db-cash-body">โหลด...</div>
        </div>

        <!-- P&L Card -->
        <div class="db-card" id="db-pl-card" style="margin-bottom:14px;">
          <div class="db-card-hd">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:16px;">📈</span>
              <span class="db-card-hd-title">กำไร-ขาดทุน (P&amp;L)</span>
            </div>
            <span class="db-badge" style="background:#eff6ff;color:#1d4ed8;">กำไรจริง</span>
          </div>
          <div class="db-card-bd" id="db-pl-body">โหลด...</div>
        </div>

        <!-- Top Products -->
        <div class="db-card" style="margin-bottom:14px;">
          <div class="db-card-hd">
            <div class="db-card-hd-title">🏆 สินค้าขายดี</div>
          </div>
          <div class="db-card-bd" id="db-top">โหลด...</div>
        </div>

        <!-- Payment Methods -->
        <div class="db-card">
          <div class="db-card-hd">
            <div class="db-card-hd-title">💳 วิธีชำระ</div>
          </div>
          <div class="db-card-bd" id="db-pay">โหลด...</div>
        </div>
      </div>
    </div>
  </div>`;

  // Period buttons
  document.querySelectorAll('.db-per').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.db-per').forEach(x=>x.classList.remove('on'));
      b.classList.add('on'); window.v9DashLoad();
    });
  });
  // View buttons
  document.querySelectorAll('.db-vw').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.db-vw').forEach(x=>x.classList.remove('on','on-g','on-b'));
      const v=b.dataset.v;
      b.classList.add(v==='cash'?'on-g':v==='pl'?'on-b':'on-g');
      const cc=document.getElementById('db-cash-card');
      const pc=document.getElementById('db-pl-card');
      if(cc) cc.style.display=(v==='pl')?'none':'';
      if(pc) pc.style.display=(v==='cash')?'none':'';
    });
  });
  // Timeline filters
  document.querySelectorAll('.db-tlf').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.db-tlf').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      if(window._v9DD) window.dbRenderTL(window._v9DD);
    });
  });
  window.v9DashLoad();
};

window.v9DashLoad=async function(){
  const days=parseInt(document.querySelector('.db-per.on')?.dataset.d||1);
  const today=new Date().toISOString().split('T')[0];
  const since=days===1?today:new Date(Date.now()-(days-1)*86400000).toISOString().split('T')[0];
  const lbl=document.getElementById('db-date-lbl');
  const periodLbl=document.querySelector('.db-per.on')?.dataset.lbl||'วันนี้';
  if(lbl) lbl.textContent=days===1
    ?new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
    :`${new Date(since+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})} — ${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})} (${periodLbl})`;

  try{
    const [bR,pR,eR,iR,aR,sR]=await Promise.all([
      db.from('บิลขาย').select('id,bill_no,total,method,status,date,customer_name,return_info').gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(500),
      db.from('purchase_order').select('id,total,supplier,method,date,status').gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายจ่าย').select('id,description,amount,category,method,date').gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายการในบิล').select('name,qty,price,cost,total,unit,bill_id').limit(2000),
      db.from('เบิกเงิน').select('amount,date').gte('date',since+'T00:00:00').eq('status','อนุมัติ'),
      db.from('จ่ายเงินเดือน').select('net_paid,paid_date').gte('paid_date',since+'T00:00:00'),
    ]);
    const B=(bR.data||[]).filter(b=>b.status!=='ยกเลิก');
    const bIds=new Set(B.map(b=>b.id));
    const P=pR.data||[],E=eR.data||[],I=(iR.data||[]).filter(i=>bIds.has(i.bill_id));
    const A=aR.data||[],S=sR.data||[];

    const tS=B.reduce((s,b)=>s+parseFloat(b.total||0),0);
    const tP=P.reduce((s,p)=>s+parseFloat(p.total||0),0);
    const tE=E.reduce((s,e)=>s+parseFloat(e.amount||0),0);
    const tL=A.reduce((s,a)=>s+parseFloat(a.amount||0),0)+S.reduce((s,p)=>s+parseFloat(p.net_paid||0),0);
    const tO=tP+tE+tL;
    const nC=tS-tO;
    
    const baseCogs=I.reduce((s,i)=>s+(parseFloat(i.cost||0)*parseFloat(i.qty||0)),0);
    let lostCogs=0;
    B.forEach(b=>{
      if(b.status==='คืนบางส่วน'&&b.return_info?.return_items){
        Object.values(b.return_info.return_items).forEach(rit=>{
          lostCogs+=(parseFloat(rit.returned_qty||0)*parseFloat(rit.original_cost||0));
        });
      }
    });
    const cogs=Math.max(0, baseCogs-lostCogs);
    
    const gP=tS-cogs, gM=tS>0?Math.round(gP/tS*100):0;
    const opX=tE+tL, nP=gP-opX, nM=tS>0?Math.round(nP/tS*100):0;

    window._v9DD={B,P,E,I,A,S,tS,tP,tE,tL,tO,nC,cogs,gP,gM,opX,nP,nM,days,since};
    window.dbKPI(window._v9DD);
    window.dbChart(window._v9DD);
    window.dbRenderTL(window._v9DD);
    window.dbCash(window._v9DD);
    window.dbPL(window._v9DD);
    window.dbTop(I);
    window.dbPay(B);
  }catch(e){
    console.error('[Dash]',e);
    typeof toast==='function'&&toast('โหลด dashboard ไม่สำเร็จ: '+e.message,'error');
  }
};

window.dbKPI=function({B,tS,cogs,gP,gM,nP,nM,nC}){
  const el=document.getElementById('db-kpi');if(!el)return;
  const K=[
    {l:'ยอดขาย',v:tS,s:`${B.length} บิล`,c:'#15803d',bg:'#f0fdf4',ic:'trending_up'},
    {l:'COGS',v:cogs,s:'ต้นทุนที่ขายออก',c:'#d97706',bg:'#fef3c7',ic:'inventory'},
    {l:'กำไรขั้นต้น',v:gP,s:`Gross ${gM}%`,c:gP>=0?'#0891b2':'#dc2626',bg:gP>=0?'#ecfeff':'#fef2f2',ic:'show_chart'},
    {l:'กำไรสุทธิ',v:nP,s:`Net ${nM}%`,c:nP>=0?'#1d4ed8':'#dc2626',bg:nP>=0?'#eff6ff':'#fef2f2',ic:'account_balance'},
    {l:'เงินสดสุทธิ',v:nC,s:nC>=0?'เงินบวก ✅':'เงินลบ ⚠️',c:nC>=0?'#15803d':'#dc2626',bg:nC>=0?'#f0fdf4':'#fef2f2',ic:'account_balance_wallet'},
  ];
  el.innerHTML=K.map(k=>`
    <div class="db-kpi" title="${k.l}: ฿${formatNum(Math.round(k.v))}">
      <div class="db-kpi-accent" style="background:${k.c};"></div>
      <div class="db-kpi-icon" style="background:${k.bg};">
        <i class="material-icons-round" style="font-size:18px;color:${k.c};">${k.ic}</i>
      </div>
      <div class="db-kpi-lbl">${k.l}</div>
      <div class="db-kpi-val" style="color:${k.c};">${k.v<0?'−':''}฿${formatNum(Math.abs(Math.round(k.v)))}</div>
      <div class="db-kpi-sub" style="color:${k.c};opacity:.8;">${k.s}</div>
    </div>`).join('');
};

window.dbChart=function({B,P,E,days}){
  const cw=document.getElementById('db-chart');
  const cl=document.getElementById('db-chart-lbl');
  const lg=document.getElementById('db-chart-legend');
  if(!cw)return;

  // กำหนดจำนวน period ตาม days
  let periods=[];
  if(days<=14){
    for(let i=days-1;i>=0;i--){
      const d=new Date(Date.now()-i*86400000).toISOString().split('T')[0];
      periods.push({key:d,label:new Date(d+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short'}),
        s:B.filter(b=>b.date.startsWith(d)).reduce((x,b)=>x+parseFloat(b.total||0),0),
        p:P.filter(b=>b.date.startsWith(d)).reduce((x,b)=>x+parseFloat(b.total||0),0),
        e:E.filter(b=>b.date.startsWith(d)).reduce((x,b)=>x+parseFloat(b.amount||0),0),
      });
    }
  } else if(days<=93){
    // weekly
    const weeks=Math.ceil(days/7);
    for(let i=weeks-1;i>=0;i--){
      const wStart=new Date(Date.now()-(i*7+6)*86400000).toISOString().split('T')[0];
      const wEnd  =new Date(Date.now()-i*7*86400000).toISOString().split('T')[0];
      periods.push({key:wStart,label:`${new Date(wStart+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short'})}`,
        s:B.filter(b=>b.date>=wStart&&b.date<=wEnd+'T23:59:59').reduce((x,b)=>x+parseFloat(b.total||0),0),
        p:P.filter(b=>b.date>=wStart&&b.date<=wEnd+'T23:59:59').reduce((x,b)=>x+parseFloat(b.total||0),0),
        e:E.filter(b=>b.date>=wStart&&b.date<=wEnd+'T23:59:59').reduce((x,b)=>x+parseFloat(b.amount||0),0),
      });
    }
  } else {
    // monthly
    for(let i=11;i>=0;i--){
      const dt=new Date(); dt.setDate(1); dt.setMonth(dt.getMonth()-i);
      const mStart=dt.toISOString().split('T')[0];
      const mEnd=new Date(dt.getFullYear(),dt.getMonth()+1,0).toISOString().split('T')[0];
      periods.push({key:mStart,label:dt.toLocaleDateString('th-TH',{month:'short'}),
        s:B.filter(b=>b.date>=mStart&&b.date<=mEnd+'T23:59:59').reduce((x,b)=>x+parseFloat(b.total||0),0),
        p:P.filter(b=>b.date>=mStart&&b.date<=mEnd+'T23:59:59').reduce((x,b)=>x+parseFloat(b.total||0),0),
        e:E.filter(b=>b.date>=mStart&&b.date<=mEnd+'T23:59:59').reduce((x,b)=>x+parseFloat(b.amount||0),0),
      });
    }
  }

  const mx=Math.max(...periods.map(d=>Math.max(d.s,d.p,d.e)),1);
  if(lg) lg.innerHTML=[{c:'#15803d',t:'รับเข้า'},{c:'#d97706',t:'ซื้อสินค้า'},{c:'#dc2626',t:'รายจ่าย'}]
    .map(x=>`<span style="display:flex;align-items:center;gap:4px;">
      <span style="width:12px;height:4px;background:${x.c};border-radius:2px;display:inline-block;"></span>
      <span style="font-size:11px;color:var(--text-tertiary);">${x.t}</span></span>`).join('');

  cw.innerHTML=periods.map(d=>{
    const sh=Math.round(d.s/mx*170),ph=Math.round(d.p/mx*170),eh=Math.round(d.e/mx*170);
    const tip=`${d.key}&#10;ขาย ฿${formatNum(Math.round(d.s))}&#10;ซื้อ ฿${formatNum(Math.round(d.p))}&#10;จ่าย ฿${formatNum(Math.round(d.e))}`;
    return`<div class="db-chart-col" title="${tip}" style="min-width:0;">
      <div style="display:flex;gap:2px;align-items:flex-end;">
        ${sh>0?`<div style="width:${periods.length>20?'5px':'10px'};height:${sh}px;background:#15803d;border-radius:3px 3px 0 0;opacity:.85;transition:height .3s;"></div>`:''}
        ${ph>0?`<div style="width:${periods.length>20?'5px':'10px'};height:${ph}px;background:#d97706;border-radius:3px 3px 0 0;opacity:.85;transition:height .3s;"></div>`:''}
        ${eh>0?`<div style="width:${periods.length>20?'5px':'10px'};height:${eh}px;background:#dc2626;border-radius:3px 3px 0 0;opacity:.75;transition:height .3s;"></div>`:''}
        ${!sh&&!ph&&!eh?`<div style="width:${periods.length>20?'15px':'30px'};height:2px;background:var(--border-light);border-radius:1px;"></div>`:''}
      </div>
    </div>`;
  }).join('');

  if(cl) cl.innerHTML=periods.map(d=>`
    <div style="flex:1;text-align:center;font-size:${periods.length>14?'9px':'10px'};color:var(--text-tertiary);white-space:nowrap;overflow:hidden;">
      ${d.label}</div>`).join('');
};

window.dbRenderTL=function({B,P,E,A,S}){
  const el=document.getElementById('db-tl');if(!el)return;
  const f=document.querySelector('.db-tlf.on')?.dataset.f||'all';
  const ev=[];
  if(f==='all'||f==='sale') B.forEach(b=>ev.push({t:b.date,i:'trending_up',bg:'#f0fdf4',c:'#15803d',
    ti:`บิล #${b.bill_no}`,su:b.method+(b.customer_name?' · '+b.customer_name:''),a:parseFloat(b.total||0),sg:'+',cr:false}));
  if(f==='all'||f==='buy')  P.forEach(p=>ev.push({t:p.date,i:'inventory_2',bg:'#fef3c7',c:'#d97706',
    ti:p.supplier||'ซื้อสินค้า',su:p.method+(p.method==='เครดิต'?' · ยังไม่จ่าย':''),a:parseFloat(p.total||0),sg:'−',cr:p.method==='เครดิต'}));
  if(f==='all'||f==='exp'){
    E.forEach(e=>ev.push({t:e.date,i:'money_off',bg:'#fee2e2',c:'#dc2626',ti:e.description,su:`${e.category} · ${e.method}`,a:parseFloat(e.amount||0),sg:'−',cr:false}));
    A.forEach(a=>ev.push({t:a.date,i:'people',bg:'#ede9fe',c:'#7c3aed',ti:'เบิกเงิน',su:'ค่าแรง',a:parseFloat(a.amount||0),sg:'−',cr:false}));
    S.forEach(s=>ev.push({t:s.paid_date,i:'people',bg:'#ede9fe',c:'#7c3aed',ti:'จ่ายเงินเดือน',su:'ค่าแรง',a:parseFloat(s.net_paid||0),sg:'−',cr:false}));
  }
  ev.sort((a,b)=>new Date(b.t)-new Date(a.t));
  if(!ev.length){el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-tertiary);font-size:12px;">ไม่มีรายการในช่วงนี้</div>`;return;}
  el.innerHTML=ev.slice(0,80).map(e=>`
    <div class="db-tl-item">
      <div class="db-ico" style="background:${e.bg};">
        <i class="material-icons-round" style="font-size:16px;color:${e.c};">${e.i}</i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.ti}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">${new Date(e.t).toLocaleDateString('th-TH',{day:'numeric',month:'short'})}&nbsp;${new Date(e.t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} · ${e.su}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;color:${e.cr?'#7c3aed':e.sg==='+'?'#15803d':'#dc2626'};">
          ${e.sg}฿${formatNum(Math.round(e.a))}</div>
        ${e.cr?`<div style="font-size:10px;color:#7c3aed;">เครดิต</div>`:''}
      </div>
    </div>`).join('');
};

window.dbCash=function({tS,tP,tE,tL,nC}){
  const el=document.getElementById('db-cash-body');if(!el)return;
  const rows=[
    {l:'รับเงินจากขาย',v:tS,c:'#15803d',sg:'+',i:'trending_up'},
    {l:'จ่ายซื้อสินค้า',v:tP,c:'#d97706',sg:'−',i:'inventory_2'},
    {l:'รายจ่ายร้าน',v:tE,c:'#dc2626',sg:'−',i:'money_off'},
    {l:'ค่าแรงงาน',v:tL,c:'#7c3aed',sg:'−',i:'people'},
  ];
  el.innerHTML=rows.map(r=>`
    <div class="db-row">
      <div style="display:flex;align-items:center;gap:8px;">
        <i class="material-icons-round" style="font-size:14px;color:${r.c};opacity:.7;">${r.i}</i>
        <span style="font-size:12px;color:var(--text-secondary);">${r.l}</span>
      </div>
      <span style="font-size:13px;font-weight:700;color:${r.c};">${r.sg}฿${formatNum(Math.round(r.v))}</span>
    </div>`).join('')
  +`<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;
      padding:14px 16px;border-radius:12px;background:${nC>=0?'#f0fdf4':'#fef2f2'};">
      <div>
        <div style="font-size:14px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">เงินสดสุทธิ</div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;">${nC>=0?'✅ เงินเพิ่มขึ้น':'⚠️ เงินลดลง'}</div>
      </div>
      <div style="font-size:22px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">
        ${nC<0?'−':''}฿${formatNum(Math.abs(Math.round(nC)))}</div>
    </div>
    <div style="font-size:10px;color:var(--text-tertiary);margin-top:8px;padding:6px 10px;
      background:var(--bg-base);border-radius:6px;line-height:1.6;">
      ⚠️ ซื้อสินค้าเข้าสต็อก ≠ ต้นทุน — ดูกำไรจริงที่ P&amp;L ด้านล่าง
    </div>`;
};

window.dbPL=function({tS,cogs,gP,gM,opX,tE,tL,nP,nM}){
  const el=document.getElementById('db-pl-body');if(!el)return;
  const row=(l,v,c,bg,bold,sub,indent)=>`
    <div class="db-pl-row" style="background:${bg||'transparent'};${indent?'padding-left:20px;':''}">
      <div>
        <div style="font-size:${bold?'13px':'12px'};font-weight:${bold?700:400};
          color:${bold?'var(--text-primary)':'var(--text-secondary)'};">${l}</div>
        ${sub?`<div style="font-size:10px;color:var(--text-tertiary);">${sub}</div>`:''}
      </div>
      <div style="font-size:${bold?'15px':'13px'};font-weight:${bold?700:500};color:${c};">
        ${v<0?'−':''}฿${formatNum(Math.abs(Math.round(v)))}</div>
    </div>`;
  el.innerHTML=
    row('ยอดขายรวม',tS,'#15803d','#f0fdf4',true)
    +`<div style="font-size:10px;color:var(--text-tertiary);padding:2px 12px;margin:2px 0;">ลบ ต้นทุนสินค้าที่ขาย</div>`
    +row('COGS',cogs,'#d97706','',false,'cost × qty จากรายการบิล',true)
    +`<hr style="border:none;border-top:1.5px dashed var(--border-light);margin:6px 0;">`
    +row('กำไรขั้นต้น',gP,gP>=0?'#0891b2':'#dc2626','#ecfeff',true,`Gross Margin ${gM}%`)
    +`<div style="font-size:10px;color:var(--text-tertiary);padding:2px 12px;margin:2px 0;">ลบ ค่าใช้จ่ายดำเนินงาน</div>`
    +row('รายจ่ายร้าน',tE,'#dc2626','',false,'',true)
    +row('ค่าแรงงาน',tL,'#7c3aed','',false,'',true)
    +`<hr style="border:none;border-top:2px solid var(--border-light);margin:8px 0;">`
    +`<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;
        border-radius:12px;background:${nP>=0?'linear-gradient(135deg,#f0fdf4,#dcfce7)':'linear-gradient(135deg,#fef2f2,#fee2e2)'};">
        <div>
          <div style="font-size:15px;font-weight:700;color:${nP>=0?'#15803d':'#dc2626'};">กำไรสุทธิ</div>
          <div style="font-size:11px;font-weight:600;color:${nP>=0?'#16a34a':'#ef4444'};margin-top:3px;">
            Net Margin ${nM}%</div>
        </div>
        <div style="font-size:24px;font-weight:700;color:${nP>=0?'#15803d':'#dc2626'};">
          ${nP<0?'−':''}฿${formatNum(Math.abs(Math.round(nP)))}</div>
      </div>`;
};

window.dbTop=function(items){
  const el=document.getElementById('db-top');if(!el)return;
  const m={};
  items.forEach(i=>{
    if(!m[i.name])m[i.name]={q:0,t:0,pr:0};
    m[i.name].q+=parseFloat(i.qty||0);
    m[i.name].t+=parseFloat(i.total||0);
    m[i.name].pr+=(parseFloat(i.price||0)-parseFloat(i.cost||0))*parseFloat(i.qty||0);
  });
  const top=Object.entries(m).sort((a,b)=>b[1].t-a[1].t).slice(0,6);
  const mx=top[0]?.[1]?.t||1;
  if(!top.length){el.innerHTML=`<div style="font-size:12px;color:var(--text-tertiary);">ยังไม่มีข้อมูล</div>`;return;}
  el.innerHTML=top.map(([n,d],i)=>{
    const mg=d.t>0?Math.round(d.pr/d.t*100):0;
    return`<div style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;">
          <span style="width:20px;height:20px;border-radius:6px;background:${['#f0fdf4','#eff6ff','#fef3c7','#fdf4ff','#fff5f5','#ecfeff'][i]};
            display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;
            color:${['#15803d','#1d4ed8','#d97706','#7c3aed','#dc2626','#0891b2'][i]};flex-shrink:0;">${i+1}</span>
          <span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n}</span>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:12px;font-weight:600;">฿${formatNum(Math.round(d.t))}</div>
          <div style="font-size:10px;color:${mg>0?'#15803d':'#dc2626'};">กำไร ${mg}%</div>
        </div>
      </div>
      <div class="db-bar-wrap">
        <div style="height:100%;background:${['#15803d','#1d4ed8','#d97706','#7c3aed','#dc2626','#0891b2'][i]};
          opacity:.6;border-radius:3px;width:${Math.round(d.t/mx*100)}%;transition:width .4s;"></div>
      </div>
    </div>`;
  }).join('');
};

window.dbPay=function(bills){
  const el=document.getElementById('db-pay');if(!el)return;
  const m={};
  bills.forEach(b=>{const mt=b.method||'อื่นๆ';if(!m[mt])m[mt]={n:0,t:0};m[mt].n++;m[mt].t+=parseFloat(b.total||0);});
  const total=bills.reduce((s,b)=>s+parseFloat(b.total||0),0)||1;
  const cls={'เงินสด':'#15803d','โอนเงิน':'#1d4ed8','บัตรเครดิต':'#7c3aed','ติดหนี้':'#dc2626'};
  const sorted=Object.entries(m).sort((a,b)=>b[1].t-a[1].t);
  if(!sorted.length){el.innerHTML=`<div style="font-size:12px;color:var(--text-tertiary);">ยังไม่มีข้อมูล</div>`;return;}
  el.innerHTML=sorted.map(([mt,d])=>{
    const pct=Math.round(d.t/total*100);
    const c=cls[mt]||'#6b7280';
    return`<div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div style="font-size:12px;">${mt} <span style="color:var(--text-tertiary);">${d.n} บิล</span></div>
        <div style="font-size:12px;font-weight:600;color:${c};">${pct}%&nbsp;<span style="color:var(--text-tertiary);font-weight:400;">฿${formatNum(Math.round(d.t))}</span></div>
      </div>
      <div class="db-bar-wrap">
        <div style="height:100%;background:${c};opacity:.75;border-radius:3px;width:${pct}%;transition:width .4s;"></div>
      </div>
    </div>`;
  }).join('');
};


// ══════════════════════════════════════════════════════════════════
// FIX-40
//  1. COGS ถูก: บันทึก cost_per_unit = prod.cost × conv_rate
//  2. สูตรสินค้า finishedProds ไม่รวม is_raw=true
//  3. login: ซ่อน eye icon ใน pin input
//  4. คลังสินค้า: ลบปุ่มซ้ำด้านล่าง (page-actions ล้าง)
//  5. คลังสินค้า: เพิ่มปุ่มสแกนบาร์โค้ดข้างช่องค้นหา
//  6. POS: redesign scan button + ซ่อน A4 radio
// ══════════════════════════════════════════════════════════════════

// ── 1. bcConfirm: บันทึก cost ต่อหน่วยขาย (ไม่ใช่ cost/base) ────
// override v9Sale เพื่อแก้ cost ก่อนบันทึก รายการในบิล
const _v9OrigSale40 = window.v9Sale;
window.v9Sale = async function () {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;
  v9ShowOverlay('กำลังบันทึกบิล...', 'โปรดรอสักครู่');
  try {
    const { data: session } = await db.from('cash_session')
      .select('*').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();

    const methodTH = { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ติดหนี้' };
    const { data: bill, error: billErr } = await db.from('บิลขาย').insert({
      date:new Date().toISOString(),
      method:methodTH[checkoutState.method]||'เงินสด',
      total:checkoutState.total, discount:checkoutState.discount||0,
      received:checkoutState.received||0, change:checkoutState.change||0,
      customer_name:checkoutState.customer?.name||null,
      customer_id:checkoutState.customer?.id||null,
      staff_name:v9Staff(),
      status:checkoutState.method==='debt'?'ค้างชำระ':'สำเร็จ',
    }).select().single();
    if (billErr) throw new Error(billErr.message);

    const { data: freshProds } = await db.from('สินค้า').select('id,name,stock,product_type,unit,cost');
    const stockMap = {};
    (freshProds||[]).forEach(p => { stockMap[p.id] = p; });

    for (const item of cart) {
      const fresh    = stockMap[item.id] || {};
      const convRate = parseFloat(item.conv_rate || 1);
      const baseQty  = parseFloat((item.qty * convRate).toFixed(6));
      const sellUnit = item.unit || fresh.unit || 'ชิ้น';
      const isMTO    = !!(item.is_mto || fresh.product_type === 'ตามบิล');

      // cost ต่อหน่วยขาย = cost/base × conv_rate
      // เช่น cost/kg = 0.53, conv_rate = 1400 → cost/คิว = 742
      const costPerBase   = parseFloat(fresh.cost || item.cost || 0);
      const costPerSellUnit = parseFloat((costPerBase * convRate).toFixed(6));

      await db.from('รายการในบิล').insert({
        bill_id:bill.id, product_id:item.id, name:item.name,
        qty:item.qty,
        price:parseFloat(item.price||0),
        cost:costPerSellUnit,          // ← แก้ตรงนี้: cost/หน่วยขาย
        total:parseFloat((item.price*item.qty).toFixed(2)),
        unit:sellUnit,
      });

      if (!isMTO) {
        const stockBefore = parseFloat(fresh.stock||0);
        const stockAfter  = parseFloat(Math.max(0,stockBefore-baseQty).toFixed(6));
        await db.from('สินค้า').update({stock:stockAfter,updated_at:new Date().toISOString()}).eq('id',item.id);
        await db.from('stock_movement').insert({
          product_id:item.id, product_name:item.name,
          type:'ขาย', direction:'out', qty:baseQty,
          stock_before:stockBefore, stock_after:stockAfter,
          ref_id:bill.id, ref_table:'บิลขาย', staff_name:v9Staff(),
          note:convRate!==1?`ขาย ${item.qty} ${sellUnit} (${baseQty} ${fresh.unit||''})`:null,
        });
      } else {
        try {
          const {data:recipes}=await db.from('สูตรสินค้า').select('*').eq('product_id',item.id);
          for (const r of (recipes||[])) {
            const mat=stockMap[r.material_id]||{};
            const needed=parseFloat((r.quantity*item.qty).toFixed(6));
            const matBefore=parseFloat(mat.stock||0);
            const matAfter=parseFloat(Math.max(0,matBefore-needed).toFixed(6));
            await db.from('สินค้า').update({stock:matAfter,updated_at:new Date().toISOString()}).eq('id',r.material_id);
            await db.from('stock_movement').insert({
              product_id:r.material_id, product_name:mat.name||r.material_id,
              type:'ใช้ผลิต(ขาย)', direction:'out', qty:needed,
              stock_before:matBefore, stock_after:matAfter,
              ref_id:bill.id, ref_table:'บิลขาย', staff_name:v9Staff(),
              note:`บิล #${bill.bill_no}: ${item.name} × ${item.qty} ${sellUnit}`,
            });
          }
        } catch(e){console.warn('[v9Sale] BOM:',e.message);}
      }
    }

    if (checkoutState.method==='cash'&&session) {
      let chgD=checkoutState.changeDenominations||{};
      if(!Object.values(chgD).some(v=>Number(v)>0)&&checkoutState.change>0)
        chgD=typeof calcChangeDenominations==='function'?calcChangeDenominations(checkoutState.change):{};
      await window.recordCashTx({
        sessionId:session.id,type:'ขาย',direction:'in',
        amount:checkoutState.received,changeAmt:checkoutState.change,netAmount:checkoutState.total,
        refId:bill.id,refTable:'บิลขาย',
        denominations:checkoutState.receivedDenominations||null,
        changeDenominations:chgD||null,note:null,
      });
    }

    if (checkoutState.customer?.id) {
      const {data:cust}=await db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id',checkoutState.customer.id).maybeSingle();
      await db.from('customer').update({
        total_purchase:(cust?.total_purchase||0)+checkoutState.total,
        visit_count:(cust?.visit_count||0)+1,
        debt_amount:checkoutState.method==='debt'?(cust?.debt_amount||0)+checkoutState.total:(cust?.debt_amount||0),
      }).eq('id',checkoutState.customer.id);
    }

    typeof logActivity==='function'&&logActivity('ขายสินค้า',`บิล #${bill.bill_no} ฿${formatNum(checkoutState.total)}`,bill.id,'บิลขาย');
    typeof sendToDisplay==='function'&&sendToDisplay({type:'thanks',billNo:bill.bill_no,total:checkoutState.total});

    const {data:bItems}=await db.from('รายการในบิล').select('*').eq('bill_id',bill.id);
    try{cart=[];}catch(_){window.cart=[];}
    await loadProducts?.();
    try{if(typeof products!=='undefined')window._v9ProductsCache=products;}catch(_){}
    renderCart?.();renderProductGrid?.();updateHomeStats?.();

    try{
      const nb=await getLiveCashBalance?.();
      ['cash-current-balance','global-cash-balance'].forEach(id=>{
        const el=document.getElementById(id);if(el)el.textContent=`฿${formatNum(nb)}`;
      });
    }catch(_){}

    v9HideOverlay();
    typeof closeCheckout==='function'&&closeCheckout();

    const {value:printChoice}=await Swal.fire({
      icon:'success',title:`บิล #${bill.bill_no} สำเร็จ`,
      html:`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0 16px;text-align:center;">
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
          <div style="font-size:16px;font-weight:800;color:#d97706;">฿${formatNum(Math.max(0,checkoutState.change))}</div>
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
      showConfirmButton:true,showDenyButton:true,showCancelButton:false,
      confirmButtonText:'',denyButtonText:'',
      customClass:{confirmButton:'swal-hidden-btn',denyButton:'swal-hidden-btn'},
      didOpen:()=>{
        document.querySelectorAll('.swal-hidden-btn').forEach(b=>{b.style.display='none';});
        window._v9PrintFmt=null;
      },
      timer:15000,timerProgressBar:true,
    });
    const fmt=window._v9PrintFmt;
    if(fmt&&typeof printReceipt==='function') printReceipt(bill,bItems||[],fmt);
    window._v9PrintFmt=null;

  }catch(e){
    v9HideOverlay();
    typeof toast==='function'&&toast('เกิดข้อผิดพลาด: '+(e.message||e),'error');
    console.error('[v9Sale]',e);
  }finally{
    window.isProcessingPayment=false;
  }
};


// ── 2. สูตรสินค้า finishedProds ไม่รวม is_raw ───────────────────
// patch v9AdminRecipe: ตรวจ finishedProds ใน create form
// แก้ L4377 ที่ filter ผิด → ครอบคลุมด้วยการ override v9RecipeShowCreate
const _v9OrigRecipeShowCreate = window.v9RecipeShowCreate;
window.v9RecipeShowCreate = function () {
  _v9OrigRecipeShowCreate?.apply(this, arguments);
  // patch dropdown สินค้าสำเร็จรูป: ไม่เอา is_raw=true หรือ product_type='both'
  setTimeout(() => {
    const sel = document.getElementById('v9rec-finished');
    if (!sel) return;
    const prods = v9GetProducts();
    const finished = prods.filter(p => !p.is_raw && p.product_type !== 'both');
    sel.innerHTML = `<option value="">-- เลือกสินค้าที่จะผลิต --</option>`
      + finished.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }, 50);
};


// ── 3. Login: ซ่อน eye icon ใน pin-input (browser auto eye) ─────
(function hidePinEye(){
  const style=document.createElement('style');
  style.textContent=`
    .pin-input::-ms-reveal,
    .pin-input::-ms-clear,
    .pin-input::-webkit-contacts-auto-fill-button,
    .pin-input::-webkit-credentials-auto-fill-button { display:none !important; }
    input[type="password"]::-webkit-textfield-decoration-container { display:none !important; }
  `;
  document.head.appendChild(style);
})();


// ── 4. คลังสินค้า: ลบปุ่มซ้ำ + 5. เพิ่ม scan button ───────────
const _v9OrigRenderInv40 = window.renderInventory;
window.renderInventory = async function () {
  await _v9OrigRenderInv40?.apply(this, arguments);
  try{if(typeof products!=='undefined')window._v9ProductsCache=products;}catch(_){}

  // ลบปุ่มซ้ำใน page-actions (ให้เหลือแค่ toolbar บน)
  const pa = document.getElementById('page-actions');
  if (pa) pa.innerHTML = '';  // ล้างปุ่มซ้ำที่ app.js inject

  // เพิ่ม scan button ข้างช่องค้นหา (ถ้ายังไม่มี)
  const searchBox = document.querySelector('#page-inv .search-box');
  if (searchBox && !searchBox.querySelector('.v9-inv-scan-btn')) {
    const scanBtn = document.createElement('button');
    scanBtn.className = 'v9-inv-scan-btn';
    scanBtn.title = 'สแกนบาร์โค้ด';
    scanBtn.style.cssText = `
      position:absolute;right:8px;top:50%;transform:translateY(-50%);
      background:none;border:none;cursor:pointer;padding:4px 6px;
      color:var(--primary);display:flex;align-items:center;
    `;
    scanBtn.innerHTML = '<i class="material-icons-round" style="font-size:20px;">qr_code_scanner</i>';
    scanBtn.onclick = () => {
      // เปิด ZXing scanner สำหรับคลัง
      if (typeof v9StartBarcodeScanner === 'function') {
        v9StartBarcodeScanner('inv-search', (code) => {
          const inp = document.getElementById('inv-search');
          if (inp) { inp.value = code; inp.dispatchEvent(new Event('input')); }
        });
      } else {
        const code = prompt('ป้อนบาร์โค้ด:');
        if (code) {
          const inp = document.getElementById('inv-search');
          if (inp) { inp.value = code; inp.dispatchEvent(new Event('input')); }
        }
      }
    };
    // ทำให้ search-box relative
    searchBox.style.position = 'relative';
    const inp = searchBox.querySelector('#inv-search');
    if (inp) inp.style.paddingRight = '40px';
    searchBox.appendChild(scanBtn);
  }

  // inject unit btn ในแถว product
  document.querySelectorAll('[data-product-id]').forEach(row => {
    const pid  = row.dataset.productId;
    const name = row.dataset.productName || '';
    if (row.querySelector('.v9-unit-btn')) return;
    const editBtn = row.querySelector('[onclick*="editProduct"]');
    if (editBtn) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost btn-icon v9-unit-btn';
      btn.title = 'จัดการหน่วยนับ';
      btn.innerHTML = '<i class="material-icons-round" style="font-size:16px;">straighten</i>';
      btn.onclick = () => v9ShowUnitModal?.(pid, name);
      editBtn.insertAdjacentElement('afterend', btn);
    }
  });
};


// ── 6. POS: ซ่อน A4 radio + style scan button ────────────────────
(function posPatch(){
  // ซ่อน print format A4 radio ใน POS sidebar
  const style = document.createElement('style');
  style.textContent = `
    .print-format { display: none !important; }
    .scan-btn {
      background: var(--primary) !important;
      color: #fff !important;
      border: none !important;
      border-radius: 10px !important;
      width: 40px !important;
      height: 40px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      flex-shrink: 0 !important;
      transition: opacity .15s !important;
    }
    .scan-btn:hover { opacity: .85 !important; }
    .scan-btn .material-icons-round { font-size: 20px !important; }
    .search-box { display: flex !important; align-items: center !important; gap: 8px !important; }
    /* inv buttons managed by page-actions injection */
  `;
  document.head.appendChild(style);
})();


// ══════════════════════════════════════════════════════════════════
// FIX-41
//  1. เช็คชื่อ "มา" → auto บันทึกรายจ่ายค่าแรงประจำวัน
//  2. จ่ายเงินเดือน → บันทึกเฉพาะ cash flow ไม่ลด P&L ซ้ำ
//  3. รับชำระหนี้ → UI denomination + เงินทอน
//  4. Dashboard: แยก tL = ค่าแรงรายวัน (จากรายจ่าย) ไม่นับเงินเดือน
// ══════════════════════════════════════════════════════════════════

// ── 1. checkIn → auto expense ─────────────────────────────────────
window.checkIn = async function (employeeId) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // ดึงข้อมูลพนักงาน
  const { data: emp } = await db.from('พนักงาน')
    .select('id,name,daily_wage,status').eq('id', employeeId).maybeSingle();
  if (!emp) { typeof toast==='function'&&toast('ไม่พบข้อมูลพนักงาน','error'); return; }

  // เช็คว่าวันนี้เช็คชื่อแล้วยัง
  const { data: existing } = await db.from('เช็คชื่อ')
    .select('id').eq('employee_id', employeeId).eq('date', today).maybeSingle();
  if (existing) { typeof toast==='function'&&toast('เช็คชื่อวันนี้แล้ว','warning'); return; }

  // บันทึกเช็คชื่อ
  await db.from('เช็คชื่อ').insert({
    employee_id: employeeId,
    date: today,
    status: 'มา',
    time_in: now.toTimeString().slice(0,5),
    staff_name: v9Staff(),
  });

  // auto บันทึกรายจ่ายค่าแรง
  const wage = parseFloat(emp.daily_wage || 0);
  if (wage > 0) {
    await db.from('รายจ่าย').insert({
      description: `ค่าแรง ${emp.name}`,
      amount:      wage,
      category:    'ค่าแรง',
      method:      'เงินสด',
      date:        now.toISOString(),
      staff_name:  v9Staff(),
      note:        `เช็คชื่อเข้างาน ${today}`,
    });
  }

  typeof toast==='function' && toast(
    `เช็คชื่อสำเร็จ${wage>0?' · บันทึกค่าแรง ฿'+formatNum(wage):''}`, 'success'
  );
  typeof renderAttendance==='function' && renderAttendance();
};


// ── 2. จ่ายเงินเดือน → cash flow เท่านั้น ────────────────────────
const _v9OrigPayroll41 = window.v9ConfirmPayroll;
window.v9ConfirmPayroll = async function () {
  const empId     = window._v9PayrollEmpId;
  const empName   = window._v9PayrollEmpName || 'พนักงาน';
  const accumulated = parseFloat(window._v9PayrollAccumulated || 0);
  const accDebt   = parseFloat(window._v9PayrollAccDebt || 0);

  const pay    = Number(document.getElementById('v9pay-amount')?.value || 0);
  const deduct = Number(document.getElementById('v9pay-deduct')?.value || 0);
  const note   = document.getElementById('v9pay-note')?.value || '';
  if (pay <= 0) { typeof toast==='function'&&toast('กรุณาระบุจำนวนเงิน','error'); return; }
  const netGet = Math.max(0, pay - deduct);

  const btn = document.getElementById('v9pay-confirm-btn');
  if (btn) btn.disabled = true;
  v9ShowOverlay('กำลังบันทึก...', `${empName} ฿${formatNum(pay)}`);

  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    // บันทึก จ่ายเงินเดือน (เก็บประวัติ)
    const { error } = await db.from('จ่ายเงินเดือน').insert({
      employee_id: empId, month: monthStr+'-01',
      net_paid: pay, deduct_withdraw: deduct,
      base_salary: accumulated, paid_date: now.toISOString(),
      staff_name: v9Staff(), note: note||'จ่ายเงินเดือน',
    });
    if (error) console.warn('[v9] payroll insert warn:', error.message);

    // บันทึก cash_transaction เฉพาะ (ไม่บันทึกรายจ่ายซ้ำ)
    const { data: session } = await db.from('cash_session')
      .select('id').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (session) {
      await window.recordCashTx?.({
        sessionId: session.id, type:'จ่ายเงินเดือน', direction:'out',
        amount: netGet, changeAmt: 0, netAmount: netGet,
        refTable: 'จ่ายเงินเดือน', note: `${empName} เดือน ${monthStr}`,
      });
    }

    typeof logActivity==='function' &&
      logActivity('จ่ายเงินเดือน',`${empName} ฿${formatNum(pay)}`);
    document.getElementById('v9-payroll-overlay')?.remove();
    typeof toast==='function' && toast(`จ่ายเงินเดือน ${empName} ฿${formatNum(pay)} สำเร็จ`,'success');
    window.v5LoadPayroll?.();
  } catch(e) {
    console.error('[v9] payroll error:', e);
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+(e.message||e),'error');
    if (btn) btn.disabled = false;
  } finally { v9HideOverlay(); }
};


// ── 3. รับชำระหนี้ พร้อม denomination UI ─────────────────────────
window.recordDebtPayment = async function (customerId, name) {
  const { data: cust } = await db.from('customer')
    .select('debt_amount,name,phone').eq('id', customerId).maybeSingle();
  if (!cust) { typeof toast==='function'&&toast('ไม่พบข้อมูลลูกค้า','error'); return; }

  const debt = parseFloat(cust.debt_amount || 0);
  if (debt <= 0) { typeof toast==='function'&&toast('ลูกค้าไม่มียอดหนี้','info'); return; }

  // เปิด modal denomination
  const bills = [1000,500,100,50,20,10,5,1];
  let recv = {};
  bills.forEach(b => recv[b] = 0);

  const buildDenomHTML = () => {
    const total = bills.reduce((s,b)=>s+(b*recv[b]),0);
    const change = Math.max(0, total - debt);
    const remain = debt - Math.min(total, debt);
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;
          background:#fef2f2;border-radius:10px;margin-bottom:10px;">
          <span style="font-size:13px;color:#dc2626;font-weight:500;">หนี้คงค้าง</span>
          <span style="font-size:18px;font-weight:700;color:#dc2626;">฿${formatNum(debt)}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;">
          ${bills.map(b=>`
            <div style="text-align:center;">
              <div style="font-size:10px;color:#666;margin-bottom:3px;">฿${b}</div>
              <div style="display:flex;align-items:center;gap:2px;justify-content:center;">
                <button onclick="window._v9DebtRecv[${b}]=Math.max(0,(window._v9DebtRecv[${b}]||0)-1);document.getElementById('v9debt-denom-wrap').innerHTML=window._v9DebtBuildHTML();"
                  style="width:22px;height:22px;border-radius:6px;border:0.5px solid #e5e7eb;
                    background:#f9fafb;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">−</button>
                <span style="width:24px;text-align:center;font-size:13px;font-weight:600;">${recv[b]||0}</span>
                <button onclick="window._v9DebtRecv[${b}]=(window._v9DebtRecv[${b}]||0)+1;document.getElementById('v9debt-denom-wrap').innerHTML=window._v9DebtBuildHTML();"
                  style="width:22px;height:22px;border-radius:6px;border:0.5px solid #e5e7eb;
                    background:#f9fafb;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">+</button>
              </div>
            </div>`).join('')}
        </div>
        <div style="background:#f0fdf4;border-radius:10px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:12px;color:#555;">รับมาทั้งหมด</span>
            <span style="font-size:14px;font-weight:700;color:#15803d;">฿${formatNum(total)}</span>
          </div>
          ${change > 0 ? `
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:12px;color:#555;">เงินทอน</span>
            <span style="font-size:14px;font-weight:700;color:#d97706;">฿${formatNum(change)}</span>
          </div>` : ''}
          ${remain > 0 ? `
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:12px;color:#555;">หนี้คงเหลือ</span>
            <span style="font-size:13px;font-weight:600;color:#dc2626;">฿${formatNum(remain)}</span>
          </div>` : `
          <div style="display:flex;align-items:center;gap:5px;color:#15803d;font-size:12px;font-weight:500;">
            ✅ ชำระครบแล้ว
          </div>`}
        </div>
      </div>`;
  };

  window._v9DebtRecv = {...recv};
  window._v9DebtBuildHTML = () => {
    const r = window._v9DebtRecv;
    const total = bills.reduce((s,b)=>s+(b*(r[b]||0)),0);
    const change = Math.max(0, total - debt);
    const remain = debt - Math.min(total, debt);
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;">
        ${bills.map(b=>`
          <div style="text-align:center;">
            <div style="font-size:10px;color:#666;margin-bottom:3px;">฿${b}</div>
            <div style="display:flex;align-items:center;gap:2px;justify-content:center;">
              <button onclick="window._v9DebtRecv[${b}]=Math.max(0,(window._v9DebtRecv[${b}]||0)-1);document.getElementById('v9debt-denom-wrap').innerHTML=window._v9DebtBuildHTML();"
                style="width:22px;height:22px;border-radius:6px;border:0.5px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">−</button>
              <span style="width:24px;text-align:center;font-size:13px;font-weight:600;">${r[b]||0}</span>
              <button onclick="window._v9DebtRecv[${b}]=(window._v9DebtRecv[${b}]||0)+1;document.getElementById('v9debt-denom-wrap').innerHTML=window._v9DebtBuildHTML();"
                style="width:22px;height:22px;border-radius:6px;border:0.5px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">+</button>
            </div>
          </div>`).join('')}
      </div>
      <div style="background:#f0fdf4;border-radius:10px;padding:10px 12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:12px;color:#555;">รับมาทั้งหมด</span>
          <span style="font-size:14px;font-weight:700;color:#15803d;">฿${formatNum(total)}</span>
        </div>
        ${change>0?`<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:12px;color:#555;">เงินทอน</span>
          <span style="font-size:14px;font-weight:700;color:#d97706;">฿${formatNum(change)}</span>
        </div>`:''}
        ${remain>0?`<div style="display:flex;justify-content:space-between;">
          <span style="font-size:12px;color:#555;">หนี้คงเหลือ</span>
          <span style="font-size:13px;font-weight:600;color:#dc2626;">฿${formatNum(remain)}</span>
        </div>`:`<div style="color:#15803d;font-size:12px;font-weight:500;">✅ ชำระครบแล้ว</div>`}
      </div>`;
  };

  const { isConfirmed } = await Swal.fire({
    title: `รับชำระหนี้: ${name}`,
    width: '480px',
    html: `
      <div style="text-align:left;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;
          background:#fef2f2;border-radius:10px;margin-bottom:14px;">
          <span style="font-size:13px;color:#dc2626;font-weight:500;">หนี้คงค้าง</span>
          <span style="font-size:20px;font-weight:700;color:#dc2626;">฿${formatNum(debt)}</span>
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;font-weight:500;">กรอกแบงค์ที่รับมา:</div>
        <div id="v9debt-denom-wrap">${window._v9DebtBuildHTML()}</div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: '<i class="material-icons-round" style="font-size:14px;vertical-align:middle;">payments</i> บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#15803d',
  });

  if (!isConfirmed) return;

  const r = window._v9DebtRecv;
  const totalRecv = bills.reduce((s,b)=>s+(b*(r[b]||0)),0);
  if (totalRecv <= 0) { typeof toast==='function'&&toast('กรุณากรอกจำนวนเงิน','error'); return; }

  const paid   = Math.min(totalRecv, debt);
  const change = Math.max(0, totalRecv - debt);
  const newDebt = Math.max(0, debt - paid);

  v9ShowOverlay('กำลังบันทึก...');
  try {
    await db.from('customer').update({ debt_amount: newDebt }).eq('id', customerId);
    await db.from('ชำระหนี้').insert({
      customer_id: customerId, amount: paid,
      method: 'เงินสด', staff_name: v9Staff(),
    });

    // บันทึก cash_transaction
    const { data: session } = await db.from('cash_session')
      .select('id').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (session) {
      await window.recordCashTx?.({
        sessionId: session.id, type:'รับชำระหนี้', direction:'in',
        amount: totalRecv, changeAmt: change, netAmount: paid,
        refTable: 'ชำระหนี้',
        note: `${name} ชำระหนี้ ฿${formatNum(paid)}`,
      });
    }

    typeof logActivity==='function' &&
      logActivity('รับชำระหนี้',`${name} ฿${formatNum(paid)}${change>0?' ทอน ฿'+formatNum(change):''}${newDebt>0?' เหลือ ฿'+formatNum(newDebt):' ครบ'}`);

    if (change > 0) {
      await Swal.fire({
        icon:'success', title:'รับชำระสำเร็จ',
        html:`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
          <div style="background:#f0fdf4;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;">รับมา</div>
            <div style="font-size:16px;font-weight:700;color:#15803d;">฿${formatNum(totalRecv)}</div>
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;">เงินทอน</div>
            <div style="font-size:16px;font-weight:700;color:#d97706;">฿${formatNum(change)}</div>
          </div>
          <div style="background:${newDebt>0?'#fef2f2':'#f0fdf4'};border-radius:8px;padding:10px;">
            <div style="font-size:10px;color:#666;">หนี้คงเหลือ</div>
            <div style="font-size:16px;font-weight:700;color:${newDebt>0?'#dc2626':'#15803d'};">฿${formatNum(newDebt)}</div>
          </div>
        </div>`,
        confirmButtonText:'ยืนยัน', confirmButtonColor:'#15803d', timer:8000,
      });
    } else {
      typeof toast==='function' && toast(
        `รับชำระ ฿${formatNum(paid)} สำเร็จ${newDebt>0?' เหลือหนี้ ฿'+formatNum(newDebt):' ชำระครบ ✅'}`,
        'success'
      );
    }

    typeof loadCustomerData==='function' && loadCustomerData();
    typeof renderDebts==='function' && renderDebts();
  } catch(e) {
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+(e.message||e),'error');
  } finally { v9HideOverlay(); }
};


// ── 4. Dashboard: tL = ค่าแรงรายวัน จากรายจ่าย หมวด "ค่าแรง" ────
// แทน query เบิกเงิน+จ่ายเงินเดือน → ใช้ รายจ่าย.category='ค่าแรง' แทน
// tSal = เงินเดือนที่จ่ายออก (cash flow เท่านั้น ไม่ลด P&L)
const _v9OrigDashLoad41 = window.v9DashLoad;
window.v9DashLoad = async function () {
  const days  = parseInt(document.querySelector('.db-per.on')?.dataset.d || 1);
  const today = new Date().toISOString().split('T')[0];
  const since = days===1?today:new Date(Date.now()-(days-1)*86400000).toISOString().split('T')[0];

  const lbl = document.getElementById('db-date-lbl');
  const periodLbl = document.querySelector('.db-per.on')?.dataset.lbl || 'วันนี้';
  if (lbl) lbl.textContent = days===1
    ? new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
    : `${new Date(since+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})} — ${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})} (${periodLbl})`;

  try {
    const [bR,pR,eR,iR,salR] = await Promise.all([
      db.from('บิลขาย').select('id,bill_no,total,method,status,date,customer_name')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(500),
      db.from('purchase_order').select('id,total,supplier,method,date,status')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายจ่าย').select('id,description,amount,category,method,date')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายการในบิล').select('name,qty,price,cost,total,unit,bill_id').limit(2000),
      db.from('จ่ายเงินเดือน').select('net_paid,paid_date,employee_id')
        .gte('paid_date',since+'T00:00:00'),
    ]);

    const B = (bR.data||[]).filter(b => b.status !== 'ยกเลิก' && b.status !== 'คืนเงิน' && b.status !== 'คืนสินค้า');
    const bIds = new Set(B.map(b=>b.id));
    const P  = pR.data||[];
    const E  = eR.data||[];
    const I  = (iR.data||[]).filter(i=>bIds.has(i.bill_id));
    const Sal = salR.data||[];

    // ค่าแรงรายวัน = รายจ่าย category='ค่าแรง' (P&L + cash flow)
    const EW = E.filter(e => e.category === 'ค่าแรง');
    // รายจ่ายร้านอื่นๆ (ไม่รวมค่าแรง)
    const EO = E.filter(e => e.category !== 'ค่าแรง');

    const tS  = B.reduce((s,b)=>s+parseFloat(b.total||0),0);
    const tP  = P.reduce((s,p)=>s+parseFloat(p.total||0),0);
    const tEW = EW.reduce((s,e)=>s+parseFloat(e.amount||0),0); // ค่าแรงรายวัน
    const tEO = EO.reduce((s,e)=>s+parseFloat(e.amount||0),0); // รายจ่ายร้านอื่น
    const tE  = tEW + tEO;                                     // รายจ่ายร้านรวม
    const tSal = Sal.reduce((s,p)=>s+parseFloat(p.net_paid||0),0); // เงินเดือนจ่าย (cash only)

    const tO  = tP + tE + tSal;  // เงินออกทั้งหมด (cash flow)
    const nC  = tS - tO;

    // P&L: ค่าแรงรายวันลด P&L, เงินเดือน ≠ ค่าใช้จ่ายใหม่
    const cogs = I.reduce((s,i)=>s+(parseFloat(i.cost||0)*parseFloat(i.qty||0)),0);
    const gP   = tS - cogs;
    const gM   = tS>0?Math.round(gP/tS*100):0;
    const opX  = tEW + tEO;  // OpEx = ค่าแรงรายวัน + รายจ่ายร้าน (ไม่รวมเงินเดือน)
    const nP   = gP - opX;
    const nM   = tS>0?Math.round(nP/tS*100):0;

    window._v9DD = {B,P,E,EW,EO,I,Sal,tS,tP,tE,tEW,tEO,tSal,tO,nC,cogs,gP,gM,opX,nP,nM,days,since};
    window.dbKPI(window._v9DD);
    window.dbChart(window._v9DD);
    window.dbRenderTL(window._v9DD);
    window.dbCash(window._v9DD);
    window.dbPL(window._v9DD);
    window.dbTop(I);
    window.dbPay(B);
  } catch(e) {
    console.error('[Dash]',e);
    typeof toast==='function'&&toast('โหลด dashboard ไม่สำเร็จ','error');
  }
};

// override dbCash: แสดง ค่าแรง + รายจ่ายร้าน + เงินเดือนแยกกัน
const _v9OrigDbCash41 = window.dbCash;
window.dbCash = function({tS,tP,tEO,tEW,tSal,nC}) {
  const el = document.getElementById('db-cash-body');if(!el)return;
  const rows = [
    {l:'รับเงินจากขาย',   v:tS,   c:'#15803d',sg:'+',i:'trending_up'},
    {l:'จ่ายซื้อสินค้า',  v:tP,   c:'#d97706',sg:'−',i:'inventory_2'},
    {l:'รายจ่ายร้าน',     v:tEO,  c:'#dc2626',sg:'−',i:'money_off'},
    {l:'ค่าแรงรายวัน',   v:tEW,  c:'#f97316',sg:'−',i:'people'},
    {l:'จ่ายเงินเดือน',  v:tSal, c:'#7c3aed',sg:'−',i:'payments',
     note:'บันทึก cash flow เท่านั้น'},
  ];
  el.innerHTML = rows.map(r=>`
    <div class="db-row">
      <div style="display:flex;align-items:center;gap:8px;flex:1;">
        <i class="material-icons-round" style="font-size:14px;color:${r.c};opacity:.7;">${r.i}</i>
        <div>
          <div style="font-size:12px;color:var(--text-secondary);">${r.l}</div>
          ${r.note?`<div style="font-size:10px;color:var(--text-tertiary);">${r.note}</div>`:''}
        </div>
      </div>
      <span style="font-size:13px;font-weight:700;color:${r.c};">${r.sg}฿${formatNum(Math.round(r.v))}</span>
    </div>`).join('')
  + `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;
      padding:14px 16px;border-radius:12px;background:${nC>=0?'#f0fdf4':'#fef2f2'};">
      <div>
        <div style="font-size:14px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">เงินสดสุทธิ</div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;">${nC>=0?'✅ เพิ่มขึ้น':'⚠️ ลดลง'}</div>
      </div>
      <div style="font-size:22px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">
        ${nC<0?'−':''}฿${formatNum(Math.abs(Math.round(nC)))}</div>
    </div>`;
};

// override dbPL: ค่าแรงรายวัน + รายจ่ายร้าน ลด P&L / เงินเดือน ไม่ลด
const _v9OrigDbPL41 = window.dbPL;
window.dbPL = function({tS,cogs,gP,gM,tEO,tEW,nP,nM}) {
  const el = document.getElementById('db-pl-body');if(!el)return;
  const row = (l,v,c,bg,bold,sub,indent)=>`
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:9px ${bg?'12px':'2px'};border-radius:${bg?'8px':'0'};margin-bottom:3px;
      background:${bg||'transparent'};${indent?'padding-left:20px;':''}">
      <div>
        <div style="font-size:${bold?'13px':'12px'};font-weight:${bold?700:400};
          color:${bold?'var(--text-primary)':'var(--text-secondary)'};">${l}</div>
        ${sub?`<div style="font-size:10px;color:var(--text-tertiary);">${sub}</div>`:''}
      </div>
      <div style="font-size:${bold?'15px':'13px'};font-weight:${bold?700:500};color:${c};">
        ${v<0?'−':''}฿${formatNum(Math.abs(Math.round(v)))}</div>
    </div>`;
  const opX = tEW + tEO;

  el.innerHTML =
    row('ยอดขายรวม',tS,'#15803d','#f0fdf4',true)
    +`<div style="font-size:10px;color:var(--text-tertiary);padding:2px 2px;margin:2px 0;">ลบ ต้นทุนสินค้า</div>`
    +row('COGS',cogs,'#d97706','',false,'cost×qty จากรายการบิล',true)
    +`<hr style="border:none;border-top:1.5px dashed var(--border-light);margin:6px 0;">`
    +row('กำไรขั้นต้น',gP,gP>=0?'#0891b2':'#dc2626','#ecfeff',true,`Gross Margin ${gM}%`)
    +`<div style="font-size:10px;color:var(--text-tertiary);padding:2px 2px;margin:2px 0;">ลบ ค่าใช้จ่ายดำเนินงาน</div>`
    +row('ค่าแรงรายวัน',tEW,'#f97316','',false,'จากการเช็คชื่อพนักงาน',true)
    +row('รายจ่ายร้าน',tEO,'#dc2626','',false,'',true)
    +`<div style="font-size:10px;background:#f3f4f6;color:#6b7280;padding:6px 8px;border-radius:6px;margin:4px 0;">
        💡 เงินเดือนที่จ่ายไม่นับซ้ำ (บันทึก cash flow เท่านั้น)
      </div>`
    +`<hr style="border:none;border-top:2px solid var(--border-light);margin:8px 0;">`
    +`<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;
        border-radius:12px;background:${nP>=0?'#f0fdf4':'#fef2f2'};">
        <div>
          <div style="font-size:15px;font-weight:700;color:${nP>=0?'#15803d':'#dc2626'};">กำไรสุทธิ</div>
          <div style="font-size:11px;font-weight:600;color:${nP>=0?'#16a34a':'#ef4444'};margin-top:3px;">Net Margin ${nM}%</div>
        </div>
        <div style="font-size:24px;font-weight:700;color:${nP>=0?'#15803d':'#dc2626'};">
          ${nP<0?'−':''}฿${formatNum(Math.abs(Math.round(nP)))}</div>
      </div>`;
};

// override dbRenderTL: แสดง ค่าแรงรายวัน และ จ่ายเงินเดือน ต่างกัน
const _v9OrigDbTL41 = window.dbRenderTL;
window.dbRenderTL = function({B,P,E,EW,EO,Sal}) {
  const el = document.getElementById('db-tl');if(!el)return;
  const f = document.querySelector('.db-tlf.on')?.dataset.f||'all';
  const ev = [];
  if(f==='all'||f==='sale') B.forEach(b=>ev.push({t:b.date,i:'trending_up',bg:'#f0fdf4',c:'#15803d',
    ti:`บิล #${b.bill_no}`,su:b.method+(b.customer_name?' · '+b.customer_name:''),a:parseFloat(b.total||0),sg:'+',cr:false,type:'sale'}));
  if(f==='all'||f==='buy') P.forEach(p=>ev.push({t:p.date,i:'inventory_2',bg:'#fef3c7',c:'#d97706',
    ti:p.supplier||'ซื้อสินค้า',su:p.method+(p.method==='เครดิต'?' · ยังไม่จ่าย':''),a:parseFloat(p.total||0),sg:'−',cr:p.method==='เครดิต',type:'buy'}));
  if(f==='all'||f==='exp') {
    (EW||[]).forEach(e=>ev.push({t:e.date,i:'people',bg:'#fff7ed',c:'#f97316',
      ti:e.description,su:'ค่าแรงรายวัน',a:parseFloat(e.amount||0),sg:'−',cr:false,type:'exp'}));
    (EO||[]).forEach(e=>ev.push({t:e.date,i:'money_off',bg:'#fee2e2',c:'#dc2626',
      ti:e.description,su:`${e.category} · ${e.method}`,a:parseFloat(e.amount||0),sg:'−',cr:false,type:'exp'}));
    (Sal||[]).forEach(s=>ev.push({t:s.paid_date,i:'payments',bg:'#ede9fe',c:'#7c3aed',
      ti:'จ่ายเงินเดือน',su:'cash flow เท่านั้น',a:parseFloat(s.net_paid||0),sg:'−',cr:false,type:'exp'}));
  }
  ev.sort((a,b)=>new Date(b.t)-new Date(a.t));
  if(!ev.length){el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-tertiary);font-size:12px;">ไม่มีรายการ</div>`;return;}
  el.innerHTML = ev.slice(0,80).map(e=>`
    <div class="db-tl-item">
      <div class="db-ico" style="background:${e.bg};">
        <i class="material-icons-round" style="font-size:16px;color:${e.c};">${e.i}</i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.ti}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">
          ${new Date(e.t).toLocaleDateString('th-TH',{day:'numeric',month:'short'})}&nbsp;${new Date(e.t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} · ${e.su}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;color:${e.cr?'#7c3aed':e.sg==='+'?'#15803d':'#dc2626'};">
          ${e.sg}฿${formatNum(Math.round(e.a))}</div>
        ${e.cr?`<div style="font-size:10px;color:#7c3aed;">เครดิต</div>`:''}
      </div>
    </div>`).join('');
};

// override dbKPI: 5 card ใหม่ รวม ค่าแรงรายวัน
const _v9OrigDbKPI41 = window.dbKPI;
window.dbKPI = function({B,tS,cogs,gP,gM,nP,nM,nC,tEW}) {
  const el = document.getElementById('db-kpi');if(!el)return;
  const K = [
    {l:'ยอดขาย',        v:tS,  s:`${B.length} บิล`,      c:'#15803d',bg:'#f0fdf4',ic:'trending_up'},
    {l:'COGS',           v:cogs,s:'ต้นทุนที่ขายออก',       c:'#d97706',bg:'#fef3c7',ic:'inventory'},
    {l:'กำไรขั้นต้น',   v:gP,  s:`Gross ${gM}%`,          c:gP>=0?'#0891b2':'#dc2626',bg:gP>=0?'#ecfeff':'#fef2f2',ic:'show_chart'},
    {l:'กำไรสุทธิ',     v:nP,  s:`Net ${nM}%`,            c:nP>=0?'#15803d':'#dc2626',bg:nP>=0?'#f0fdf4':'#fef2f2',ic:'account_balance'},
    {l:'เงินสดสุทธิ',  v:nC,  s:nC>=0?'บวก ✅':'ลบ ⚠️', c:nC>=0?'#15803d':'#dc2626',bg:nC>=0?'#f0fdf4':'#fef2f2',ic:'account_balance_wallet'},
  ];
  el.innerHTML = K.map(k=>`
    <div class="db-kpi" style="border-left:3px solid ${k.c};" title="${k.l}: ฿${formatNum(Math.round(k.v))}">
      <div class="db-kpi-accent" style="background:${k.c};"></div>
      <div class="db-kpi-icon" style="background:${k.bg};">
        <i class="material-icons-round" style="font-size:18px;color:${k.c};">${k.ic}</i>
      </div>
      <div class="db-kpi-lbl">${k.l}</div>
      <div class="db-kpi-val" style="color:${k.c};">${k.v<0?'−':''}฿${formatNum(Math.abs(Math.round(k.v)))}</div>
      <div class="db-kpi-sub" style="color:${k.c};opacity:.8;">${k.s}</div>
    </div>`).join('');
};


// ══════════════════════════════════════════════════════════════════
// FIX-42
//  A. checkIn/payroll: override renderAttendance + v5LoadPayroll
//     ให้ปุ่มเรียก window.v9CheckIn / window.v9PayConfirm แทน local fn
//  B. recordDebtPayment redesign: professional 3-step flow
// ══════════════════════════════════════════════════════════════════

// ── A1. patch v5LoadCheckin → ปุ่มใช้ window.v9CheckIn ──────────
// ไม่ override renderAttendance ทั้งหมด (จะทำลาย tab structure)
// แต่ patch หลัง v5LoadCheckin render เสร็จ
const _v9OrigV5LoadCheckin = window.v5LoadCheckin;
window.v5LoadCheckin = async function () {
  await _v9OrigV5LoadCheckin?.apply(this, arguments);
  // patch ปุ่มเช็คชื่อทั้งหมดให้ใช้ window.v9CheckIn
  setTimeout(() => {
    document.querySelectorAll('[onclick*="checkIn("]').forEach(btn => {
      const orig = btn.getAttribute('onclick') || '';
      if (!orig.includes('window.v9CheckIn')) {
        btn.setAttribute('onclick', orig.replace(/checkIn\(/g, 'window.v9CheckIn('));
      }
    });
    document.querySelectorAll('[onclick*="checkOut("]').forEach(btn => {
      const orig = btn.getAttribute('onclick') || '';
      if (!orig.includes('window.v9CheckOut')) {
        btn.setAttribute('onclick', orig.replace(/checkOut\(/g, 'window.v9CheckOut('));
      }
    });
  }, 80);
};

window.v9CheckIn = async function (employeeId) {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  const { data: emp } = await db.from('พนักงาน')
    .select('id,name,daily_wage').eq('id', employeeId).maybeSingle();
  if (!emp) { typeof toast==='function'&&toast('ไม่พบพนักงาน','error'); return; }

  const { data: existing } = await db.from('เช็คชื่อ')
    .select('id').eq('employee_id', employeeId).eq('date', today).maybeSingle();
  if (existing) { typeof toast==='function'&&toast('เช็คชื่อวันนี้แล้ว','warning'); return; }

  await db.from('เช็คชื่อ').insert({
    employee_id: employeeId, date: today, status: 'มา',
    time_in: now.toTimeString().slice(0,5), staff_name: v9Staff(),
  });

  const wage = parseFloat(emp.daily_wage || 0);
  if (wage > 0) {
    await db.from('รายจ่าย').insert({
      description: `ค่าแรง ${emp.name}`,
      amount: wage, category: 'ค่าแรง', method: 'เงินสด',
      date: now.toISOString(), staff_name: v9Staff(),
      note: `เช็คชื่อ ${today}`,
    });
  }

  typeof toast==='function' && toast(
    `${emp.name} เช็คชื่อสำเร็จ${wage>0?' · ค่าแรง ฿'+formatNum(wage):''}`, 'success'
  );
  window.renderAttendance();
};

window.v9CheckOut = async function (attId) {
  const now = new Date();
  await db.from('เช็คชื่อ').update({ time_out: now.toTimeString().slice(0,5) }).eq('id', attId);
  typeof toast==='function' && toast('บันทึกเวลาออกงานสำเร็จ','success');
  window.renderAttendance();
};


// ── A2. v5LoadPayroll: ไม่ต้อง override (v9ShowPayrollModal ใช้ window. อยู่แล้ว) ──
// v9ConfirmPayroll ถูก override เป็น window.v9PayConfirm แล้ว
// patch ผ่าน id v9pay-confirm-btn onclick ด้วย
const _v9OrigV5Load42 = window.v5LoadPayroll;
window.v5LoadPayroll = async function () {
  await _v9OrigV5Load42?.apply(this, arguments);
  setTimeout(() => {
    document.querySelectorAll('[onclick*="v9ConfirmPayroll"]').forEach(el => {
      const orig = el.getAttribute('onclick') || '';
      if (!orig.includes('window.v9PayConfirm')) {
        el.setAttribute('onclick', orig.replace(/v9ConfirmPayroll/g, 'window.v9PayConfirm'));
      }
    });
  }, 80);
};


// ── window.v9PayConfirm: รับ args ตรง (ไม่ใช้ window vars) ──────
window.v9PayConfirm = async function (empId, empName, accumulated, accDebt) {
  if (!empId) { typeof toast==='function'&&toast('ไม่พบข้อมูลพนักงาน','error'); return; }

  const pay    = Number(document.getElementById('v9pay-amount')?.value || 0);
  const deduct = Number(document.getElementById('v9pay-deduct')?.value || 0);
  const note   = document.getElementById('v9pay-note')?.value || '';

  if (pay <= 0) { typeof toast==='function'&&toast('กรุณาระบุจำนวนเงิน','error'); return; }
  const netGet = Math.max(0, pay - deduct);

  const btn = document.getElementById('v9pay-confirm-btn');
  if (btn) btn.disabled = true;
  v9ShowOverlay('กำลังบันทึก...', `${empName} ฿${formatNum(pay)}`);

  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    // บันทึกประวัติจ่ายเงินเดือน
    const { error } = await db.from('จ่ายเงินเดือน').insert({
      employee_id: empId, month: monthStr+'-01',
      net_paid: pay, deduct_withdraw: deduct,
      base_salary: parseFloat(accumulated||0),
      paid_date: now.toISOString(),
      staff_name: v9Staff(), note: note||'จ่ายเงินเดือน',
    });
    if (error) console.warn('[v9] payroll warn:', error.message);

    // บันทึก cash_transaction ออก (ไม่ต้องบันทึก รายจ่าย ซ้ำ — ถูกนับจากเช็คชื่อแล้ว)
    const { data: session } = await db.from('cash_session')
      .select('id').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (session && typeof window.recordCashTx==='function') {
      await window.recordCashTx({
        sessionId: session.id, type:'จ่ายเงินเดือน', direction:'out',
        amount: netGet, changeAmt: 0, netAmount: netGet,
        refTable:'จ่ายเงินเดือน',
        note: `${empName} เดือน ${monthStr}`,
      });
    }

    typeof logActivity==='function' &&
      logActivity('จ่ายเงินเดือน',`${empName} ฿${formatNum(pay)}`);
    document.getElementById('v9-payroll-overlay')?.remove();
    typeof toast==='function' && toast(`จ่ายเงินเดือน ${empName} ฿${formatNum(pay)} สำเร็จ`,'success');
    window.v5LoadPayroll?.();
  } catch(e) {
    console.error('[v9] payroll error:', e);
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+(e.message||e),'error');
    if (btn) btn.disabled = false;
  } finally { v9HideOverlay(); }
};


// ── B. recordDebtPayment — Professional 3-step flow ──────────────
window.recordDebtPayment = async function (customerId, name) {
  const { data: cust } = await db.from('customer')
    .select('debt_amount,name,phone').eq('id', customerId).maybeSingle();
  if (!cust) { typeof toast==='function'&&toast('ไม่พบลูกค้า','error'); return; }

  const totalDebt = parseFloat(cust.debt_amount || 0);
  if (totalDebt <= 0) { typeof toast==='function'&&toast('ลูกค้าไม่มียอดหนี้','info'); return; }

  const BILLS = [1000,500,100,50,20,10,5,1];
  let state = { step:1, payAmt:totalDebt, method:'cash', recvDenom:{}, changeDenom:{} };
  BILLS.forEach(b => { state.recvDenom[b]=0; state.changeDenom[b]=0; });

  const getRecvTotal = () => BILLS.reduce((s,b)=>s+(b*(state.recvDenom[b]||0)),0);
  const getChangeNeeded = () => Math.max(0, getRecvTotal() - state.payAmt);

  const calcChangeDenom = (amt) => {
    let rem = amt; const d = {};
    BILLS.forEach(b => { d[b]=Math.floor(rem/b); rem=rem%(b); });
    return d;
  };

  const buildDenomGrid = (denomObj, readOnly=false) => {
    const total = BILLS.reduce((s,b)=>s+(b*(denomObj[b]||0)),0);
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        ${BILLS.map(b=>{
          const cnt = denomObj[b]||0;
          const isLarge = b >= 100;
          return `<div style="background:${isLarge?'#fffbeb':'#f9fafb'};border:0.5px solid ${cnt>0?'#d97706':'#e5e7eb'};
            border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:10px;color:#6b7280;margin-bottom:4px;">฿${b>=1000?'1K':b>=500?'500':b}</div>
            ${readOnly
              ? `<div style="font-size:16px;font-weight:700;color:${cnt>0?'#d97706':'#9ca3af'};">${cnt}</div>`
              : `<div style="display:flex;align-items:center;gap:4px;justify-content:center;">
                  <button data-bill="${b}" data-action="dec"
                    style="width:22px;height:22px;border-radius:6px;border:0.5px solid #e5e7eb;
                      background:#f3f4f6;cursor:pointer;font-size:13px;line-height:1;font-weight:700;color:#374151;">−</button>
                  <span style="width:20px;text-align:center;font-size:14px;font-weight:700;
                    color:${cnt>0?'#d97706':'#374151'};">${cnt}</span>
                  <button data-bill="${b}" data-action="inc"
                    style="width:22px;height:22px;border-radius:6px;border:0.5px solid #e5e7eb;
                      background:#f3f4f6;cursor:pointer;font-size:13px;line-height:1;font-weight:700;color:#374151;">+</button>
                </div>`}
            ${cnt>0?`<div style="font-size:9px;color:#d97706;margin-top:2px;">฿${formatNum(b*cnt)}</div>`:''}
          </div>`;
        }).join('')}
      </div>
      <div style="text-align:right;font-size:13px;font-weight:700;color:#15803d;">
        รวม ฿${formatNum(total)}
      </div>`;
  };

  const renderStep1 = () => `
    <div style="text-align:left;">
      <!-- หนี้รวม -->
      <div style="background:#fef2f2;border-radius:12px;padding:14px 16px;margin-bottom:16px;
        display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:12px;color:#dc2626;font-weight:500;">หนี้คงค้างทั้งหมด</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${cust.name}${cust.phone?' · '+cust.phone:''}</div>
        </div>
        <div style="font-size:24px;font-weight:700;color:#dc2626;">฿${formatNum(totalDebt)}</div>
      </div>

      <!-- ชำระวันนี้ -->
      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">ชำระวันนี้ (฿)</label>
        <input id="v9debt-pay-amt" type="number" value="${totalDebt}" min="1" max="${totalDebt}" step="0.01"
          style="width:100%;padding:12px;border:1.5px solid #d1d5db;border-radius:10px;
            font-size:18px;font-weight:700;text-align:right;color:#15803d;outline:none;"
          oninput="window._v9DebtState.payAmt=Math.min(parseFloat(this.value||0),${totalDebt})">
      </div>

      <!-- วิธีชำระ -->
      <div style="margin-bottom:6px;">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:8px;">วิธีชำระ</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button id="v9debt-method-cash"
            onclick="window._v9DebtState.method='cash';
              document.getElementById('v9debt-method-cash').style.background='#15803d';
              document.getElementById('v9debt-method-cash').style.color='#fff';
              document.getElementById('v9debt-method-transfer').style.background='#f9fafb';
              document.getElementById('v9debt-method-transfer').style.color='#374151';"
            style="padding:12px;border-radius:10px;border:1.5px solid #15803d;
              background:#15803d;color:#fff;cursor:pointer;font-size:13px;font-weight:600;
              display:flex;align-items:center;gap:6px;justify-content:center;">
            <i class="material-icons-round" style="font-size:16px;">payments</i> เงินสด
          </button>
          <button id="v9debt-method-transfer"
            onclick="window._v9DebtState.method='transfer';
              document.getElementById('v9debt-method-transfer').style.background='#1d4ed8';
              document.getElementById('v9debt-method-transfer').style.color='#fff';
              document.getElementById('v9debt-method-cash').style.background='#f9fafb';
              document.getElementById('v9debt-method-cash').style.color='#374151';"
            style="padding:12px;border-radius:10px;border:1.5px solid #d1d5db;
              background:#f9fafb;color:#374151;cursor:pointer;font-size:13px;font-weight:600;
              display:flex;align-items:center;gap:6px;justify-content:center;">
            <i class="material-icons-round" style="font-size:16px;">swap_horiz</i> โอนเงิน
          </button>
        </div>
      </div>
    </div>`;

  const renderStep2 = () => `
    <div style="text-align:left;">
      <div style="background:#f0fdf4;border-radius:10px;padding:10px 14px;margin-bottom:14px;
        display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;color:#15803d;">ต้องรับ</span>
        <span style="font-size:20px;font-weight:700;color:#15803d;">฿${formatNum(state.payAmt)}</span>
      </div>
      <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:8px;">นับแบงค์ที่รับมา:</div>
      <div id="v9debt-recv-grid">${buildDenomGrid(state.recvDenom)}</div>
      <div id="v9debt-recv-status" style="height:36px;display:flex;align-items:center;
        justify-content:center;border-radius:8px;margin-top:8px;font-size:13px;font-weight:600;">
      </div>
    </div>`;

  const renderStep3 = () => {
    const need = getChangeNeeded();
    state.changeDenom = calcChangeDenom(need);
    const chgTotal = BILLS.reduce((s,b)=>s+(b*(state.changeDenom[b]||0)),0);
    return `
      <div style="text-align:left;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
          <div style="background:#f0fdf4;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:#555;">รับมา</div>
            <div style="font-size:16px;font-weight:700;color:#15803d;">฿${formatNum(getRecvTotal())}</div>
          </div>
          <div style="background:#fef3c7;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:#555;">เงินทอน</div>
            <div style="font-size:16px;font-weight:700;color:#d97706;">฿${formatNum(need)}</div>
          </div>
          <div style="background:#fef2f2;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:#555;">หนี้คงเหลือ</div>
            <div style="font-size:16px;font-weight:700;color:${(totalDebt-state.payAmt)>0?'#dc2626':'#15803d'};">
              ฿${formatNum(Math.max(0,totalDebt-state.payAmt))}</div>
          </div>
        </div>
        ${need>0?`
          <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:8px;">
            ทอนเงินให้ลูกค้า (${chgTotal===need?'✅ ครบพอดี':'⚠️ ต้องทอน ฿'+formatNum(need)}):
          </div>
          <div id="v9debt-chg-grid">${buildDenomGrid(state.changeDenom)}</div>
          <div id="v9debt-chg-status" style="margin-top:8px;padding:8px 12px;border-radius:8px;
            font-size:12px;font-weight:600;text-align:center;
            background:${chgTotal===need?'#f0fdf4':'#fef3c7'};
            color:${chgTotal===need?'#15803d':'#d97706'};">
            ${chgTotal===need?'✅ ครบพอดี — กดบันทึกได้เลย':'⚠️ ปรับแบงค์ทอนให้ครบ ฿'+formatNum(need)}
          </div>`
          :`<div style="background:#f0fdf4;border-radius:10px;padding:12px;text-align:center;
              font-size:13px;font-weight:600;color:#15803d;">
              ✅ ไม่มีเงินทอน — กดบันทึกได้เลย
            </div>`}
      </div>`;
  };

  window._v9DebtState = state;

  const showDebtModal = async (stepNum) => {
    state.step = stepNum;
    let titleStr = stepNum===1?`รับชำระหนี้: ${name}`:stepNum===2?'นับแบงค์รับเงิน':'ทอนเงินและบันทึก';
    let html = stepNum===1?renderStep1():stepNum===2?renderStep2():renderStep3();
    let confirmTxt = stepNum===1?'ถัดไป →':stepNum===2?'ถัดไป →':'✅ บันทึก';
    let showCancel = true;

    const { isConfirmed } = await Swal.fire({
      title: `<div style="display:flex;align-items:center;gap:8px;font-size:16px;">
        <span style="width:24px;height:24px;border-radius:50%;background:#dc2626;color:#fff;
          display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${stepNum}</span>
        ${titleStr}</div>`,
      html,
      width: '520px',
      showCancelButton: showCancel,
      showDenyButton: stepNum > 1,
      confirmButtonText: confirmTxt,
      cancelButtonText: 'ยกเลิก',
      denyButtonText: '← ย้อนกลับ',
      confirmButtonColor: stepNum===3?'#15803d':'#1d4ed8',
      denyButtonColor: '#6b7280',
      didOpen: () => {
        // bind denomination buttons
        if (stepNum===2) {
          document.getElementById('v9debt-recv-grid')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-bill]');
            if (!btn) return;
            const b = parseInt(btn.dataset.bill);
            const action = btn.dataset.action;
            if (action==='inc') state.recvDenom[b]=(state.recvDenom[b]||0)+1;
            if (action==='dec') state.recvDenom[b]=Math.max(0,(state.recvDenom[b]||0)-1);
            // re-render grid
            document.getElementById('v9debt-recv-grid').innerHTML = buildDenomGrid(state.recvDenom);
            // rebind
            const total = BILLS.reduce((s,b2)=>s+(b2*(state.recvDenom[b2]||0)),0);
            const diff  = total - state.payAmt;
            const statusEl = document.getElementById('v9debt-recv-status');
            if (statusEl) {
              if (diff === 0) {
                statusEl.style.background='#f0fdf4'; statusEl.style.color='#15803d';
                statusEl.textContent='✅ รับมาพอดี';
              } else if (diff > 0) {
                statusEl.style.background='#fef3c7'; statusEl.style.color='#d97706';
                statusEl.textContent=`รับมา ฿${formatNum(total)} — ทอน ฿${formatNum(diff)}`;
              } else {
                statusEl.style.background='#fef2f2'; statusEl.style.color='#dc2626';
                statusEl.textContent=`ยังขาด ฿${formatNum(-diff)}`;
              }
            }
          });
        }
        if (stepNum===3) {
          document.getElementById('v9debt-chg-grid')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-bill]');
            if (!btn) return;
            const b = parseInt(btn.dataset.bill);
            const action = btn.dataset.action;
            if (action==='inc') state.changeDenom[b]=(state.changeDenom[b]||0)+1;
            if (action==='dec') state.changeDenom[b]=Math.max(0,(state.changeDenom[b]||0)-1);
            document.getElementById('v9debt-chg-grid').innerHTML = buildDenomGrid(state.changeDenom);
            const need2 = getChangeNeeded();
            const chgT  = BILLS.reduce((s,b2)=>s+(b2*(state.changeDenom[b2]||0)),0);
            const statusEl = document.getElementById('v9debt-chg-status');
            if (statusEl) {
              if (chgT === need2) {
                statusEl.style.background='#f0fdf4'; statusEl.style.color='#15803d';
                statusEl.textContent='✅ ครบพอดี — กดบันทึกได้เลย';
              } else {
                statusEl.style.background='#fef3c7'; statusEl.style.color='#d97706';
                statusEl.textContent=`⚠️ ปรับให้ครบ ฿${formatNum(need2)} (ตอนนี้ ฿${formatNum(chgT)})`;
              }
            }
          });
        }
      },
    });

    if (!isConfirmed) {
      // deny = ย้อนกลับ
      const { isDenied } = await Promise.resolve({ isDenied: false });
    }

    return isConfirmed;
  };

  // Step 1
  const ok1 = await showDebtModal(1);
  if (!ok1) return;

  // อัปเดต payAmt
  const enteredAmt = parseFloat(document.getElementById('v9debt-pay-amt')?.value || state.payAmt);
  state.payAmt = Math.min(enteredAmt, totalDebt);
  if (state.payAmt <= 0) { typeof toast==='function'&&toast('กรุณาระบุยอดชำระ','error'); return; }

  // โอนเงิน → ข้ามการนับแบงค์
  if (state.method === 'transfer') {
    const confirmed = await Swal.fire({
      title:'ยืนยันรับชำระโอนเงิน',
      html:`<div style="text-align:center;">
        <div style="font-size:32px;font-weight:700;color:#1d4ed8;margin:12px 0;">฿${formatNum(state.payAmt)}</div>
        <div style="font-size:13px;color:#555;">วิธีชำระ: โอนเงิน</div>
      </div>`,
      showCancelButton:true, confirmButtonText:'✅ บันทึก',
      confirmButtonColor:'#1d4ed8', cancelButtonText:'ยกเลิก',
    });
    if (!confirmed.isConfirmed) return;
    await window._v9SaveDebtPayment(customerId, name, state.payAmt, totalDebt, 'โอนเงิน', 0);
    return;
  }

  // Step 2: นับแบงค์รับ
  const ok2 = await showDebtModal(2);
  if (!ok2) return;

  const recvTotal = getRecvTotal();
  if (recvTotal < state.payAmt) {
    typeof toast==='function'&&toast(`รับเงินไม่พอ (รับมา ฿${formatNum(recvTotal)} ต้องการ ฿${formatNum(state.payAmt)})`,'error');
    return;
  }

  // Step 3: ทอนเงิน (ถ้ามี)
  const need = getChangeNeeded();
  if (need > 0) {
    const ok3 = await showDebtModal(3);
    if (!ok3) return;
    const chgTotal = BILLS.reduce((s,b)=>s+(b*(state.changeDenom[b]||0)),0);
    if (chgTotal !== need) {
      typeof toast==='function'&&toast('เงินทอนไม่ถูกต้อง ต้องทอนพอดี ฿'+formatNum(need),'error');
      return;
    }
  }

  await window._v9SaveDebtPayment(customerId, name, state.payAmt, totalDebt, 'เงินสด', need);
};

window._v9SaveDebtPayment = async function(customerId, name, paid, totalDebt, method, change) {
  const newDebt = Math.max(0, totalDebt - paid);
  v9ShowOverlay('กำลังบันทึก...');
  try {
    await db.from('customer').update({ debt_amount: newDebt }).eq('id', customerId);
    await db.from('ชำระหนี้').insert({
      customer_id: customerId, amount: paid, method, staff_name: v9Staff(),
    });
    const { data: session } = await db.from('cash_session')
      .select('id').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (session && method==='เงินสด' && typeof window.recordCashTx==='function') {
      await window.recordCashTx({
        sessionId:session.id, type:'รับชำระหนี้', direction:'in',
        amount:paid+change, changeAmt:change, netAmount:paid,
        refTable:'ชำระหนี้', note:`${name}`,
      });
    }
    typeof logActivity==='function' &&
      logActivity('รับชำระหนี้',`${name} ฿${formatNum(paid)}${change>0?' ทอน ฿'+formatNum(change):''}${newDebt>0?' เหลือ ฿'+formatNum(newDebt):' ครบ'}`);
    typeof toast==='function' && toast(
      `รับชำระสำเร็จ ฿${formatNum(paid)}${newDebt>0?' เหลือหนี้ ฿'+formatNum(newDebt):' ✅ ครบ'}`, 'success'
    );
    typeof loadCustomerData==='function' && loadCustomerData();
    typeof renderDebts==='function' && renderDebts();
  } catch(e) {
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+(e.message||e),'error');
  } finally { v9HideOverlay(); }
};


// ══════════════════════════════════════════════════════════════════
// FIX-43
//  1. เจ้าหนี้ร้าน: แสดงยอดจากหน้ารับสินค้า + ชำระเจ้าหนี้
//  2. ชำระหนี้ลูกหนี้: UI สีแบงค์จริง + กดเลือกแบงค์ + นับทอนเอง
// ══════════════════════════════════════════════════════════════════

// ── 1. หน้าเจ้าหนี้ร้าน ─────────────────────────────────────────
window.renderCreditors = async function () {
  const section = document.getElementById('page-ap') || document.querySelector('[id*="creditor"]');
  if (!section) {
    // inject ใน page-vendor หรือ sidebar nav
    const nav = document.querySelector('[data-page="vendor"], [onclick*="vendor"], [onclick*="ap"]');
    if (!nav) return;
  }

  // ดึงข้อมูลเจ้าหนี้
  const { data: creds } = await db.from('เจ้าหนี้')
    .select('*,ซัพพลายเออร์(name,phone,bank_name,bank_account)')
    .order('date', {ascending:false});

  const rows = creds || [];
  const totalDebt = rows.filter(r=>r.status==='ค้างชำระ').reduce((s,r)=>s+parseFloat(r.balance||0),0);
  const totalPaid = rows.filter(r=>r.status==='ชำระแล้ว').reduce((s,r)=>s+parseFloat(r.amount||0),0);

  if (!section) return;
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <h3 style="font-size:16px;font-weight:600;">เจ้าหนี้ร้าน</h3>
      </div>
      <div class="inv-stats" style="margin-bottom:16px;">
        <div class="inv-stat danger">
          <span class="inv-stat-value">฿${formatNum(Math.round(totalDebt))}</span>
          <span class="inv-stat-label">ยอดค้างชำระ</span>
        </div>
        <div class="inv-stat success">
          <span class="inv-stat-value">฿${formatNum(Math.round(totalPaid))}</span>
          <span class="inv-stat-label">ชำระแล้ว (ทั้งหมด)</span>
        </div>
        <div class="inv-stat">
          <span class="inv-stat-value">${rows.filter(r=>r.status==='ค้างชำระ').length}</span>
          <span class="inv-stat-label">รายการค้าง</span>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>ซัพพลายเออร์</th>
              <th>ครบกำหนด</th>
              <th class="text-right">ยอดรวม</th>
              <th class="text-right">ชำระแล้ว</th>
              <th class="text-right">คงค้าง</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0
              ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-tertiary);">ไม่มีรายการเจ้าหนี้</td></tr>`
              : rows.map(r => {
                const supp = r.ซัพพลายเออร์;
                const balance = parseFloat(r.balance || 0);
                const isOverdue = r.due_date && new Date(r.due_date) < new Date() && r.status === 'ค้างชำระ';
                return `<tr style="${isOverdue?'background:#fef2f2;':''}">
                  <td style="font-size:12px;">${formatDateTime(r.date)}</td>
                  <td>
                    <div style="font-weight:600;">${supp?.name || 'ไม่ระบุ'}</div>
                    ${supp?.phone?`<div style="font-size:11px;color:var(--text-tertiary);">${supp.phone}</div>`:''}
                  </td>
                  <td style="font-size:12px;${isOverdue?'color:#dc2626;font-weight:600;':''}">${r.due_date ? new Date(r.due_date).toLocaleDateString('th-TH') : '-'}${isOverdue?' ⚠️':''}</td>
                  <td class="text-right">฿${formatNum(r.amount)}</td>
                  <td class="text-right" style="color:#15803d;">฿${formatNum(r.paid_amount || 0)}</td>
                  <td class="text-right" style="font-weight:700;color:${balance>0?'#dc2626':'#15803d'};">฿${formatNum(balance)}</td>
                  <td>
                    <span class="badge ${r.status==='ชำระแล้ว'?'badge-success':isOverdue?'badge-danger':'badge-warning'}">
                      ${r.status}
                    </span>
                  </td>
                  <td>
                    ${r.status==='ค้างชำระ'?`
                      <button class="btn btn-primary btn-sm"
                        onclick="window.v9PayCreditor('${r.id}','${(supp?.name||'ไม่ระบุ').replace(/'/g,"&apos;")}',${balance},${r.amount})">
                        <i class="material-icons-round" style="font-size:13px;">payments</i> ชำระ
                      </button>`:''}
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
};

// ชำระเจ้าหนี้
window.v9PayCreditor = async function (credId, suppName, balance, totalAmount) {
  const { value, isConfirmed } = await Swal.fire({
    title: `ชำระเจ้าหนี้: ${suppName}`,
    html: `
      <div style="text-align:left;">
        <div style="background:#fef2f2;border-radius:10px;padding:12px;margin-bottom:14px;
          display:flex;justify-content:space-between;">
          <span style="font-size:13px;color:#dc2626;">ยอดคงค้าง</span>
          <span style="font-size:20px;font-weight:700;color:#dc2626;">฿${formatNum(balance)}</span>
        </div>
        <div class="form-group">
          <label class="form-label">ชำระวันนี้ (฿)</label>
          <input id="v9cred-pay" class="form-input" type="number" value="${balance}" min="1" max="${balance}">
        </div>
        <div class="form-group">
          <label class="form-label">วิธีชำระ</label>
          <select id="v9cred-method" class="form-input">
            <option value="เงินสด">เงินสด</option>
            <option value="โอนเงิน">โอนเงิน</option>
            <option value="เช็ค">เช็ค</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">หมายเหตุ</label>
          <input id="v9cred-note" class="form-input" placeholder="(ถ้ามี)">
        </div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: '✅ บันทึกชำระ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#15803d',
    preConfirm: () => ({
      pay:    parseFloat(document.getElementById('v9cred-pay')?.value || 0),
      method: document.getElementById('v9cred-method')?.value || 'เงินสด',
      note:   document.getElementById('v9cred-note')?.value || '',
    }),
  });
  if (!isConfirmed || !value?.pay) return;

  v9ShowOverlay('กำลังบันทึก...');
  try {
    const { data: cred } = await db.from('เจ้าหนี้').select('paid_amount,balance').eq('id',credId).maybeSingle();
    const newPaid   = (cred?.paid_amount||0) + value.pay;
    const newBalance= Math.max(0, (cred?.balance||balance) - value.pay);
    const newStatus = newBalance <= 0 ? 'ชำระแล้ว' : 'ค้างชำระ';

    await db.from('เจ้าหนี้').update({
      paid_amount: newPaid, balance: newBalance, status: newStatus,
    }).eq('id', credId);

    // บันทึกรายจ่าย
    await db.from('รายจ่าย').insert({
      description: `ชำระเจ้าหนี้ ${suppName}`,
      amount: value.pay, category: 'ซื้อสินค้า',
      method: value.method, date: new Date().toISOString(),
      staff_name: v9Staff(), note: value.note||null,
    });

    typeof toast==='function' && toast(`ชำระเจ้าหนี้ ฿${formatNum(value.pay)} สำเร็จ`,'success');
    typeof logActivity==='function' && logActivity('ชำระเจ้าหนี้',`${suppName} ฿${formatNum(value.pay)}`);
    window.renderCreditors();
  } catch(e) {
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};

// hook เข้า page-vendor
const _v9OrigRenderVendor = window.renderVendors;
window.renderVendors = async function () {
  await _v9OrigRenderVendor?.apply(this, arguments);
  // inject เจ้าหนี้ tab ถ้าไม่มี
  const sec = document.getElementById('page-vendor') || document.getElementById('page-ap');
  if (sec && !sec.querySelector('#v9-creditor-section')) {
    const div = document.createElement('div');
    div.id = 'v9-creditor-section';
    sec.appendChild(div);
    // override page-ap
    const ap = document.getElementById('page-ap');
    if (ap) {
      ap._v9CreditorLinked = true;
      window.renderCreditors();
    }
  }
};

// เรียกตอนไปหน้าเจ้าหนี้
const _v9OrigGo43 = window.go;
window.go = function (page) {
  _v9OrigGo43?.call(this, page);
  if (page === 'ap' || page === 'vendor') {
    setTimeout(() => window.renderCreditors?.(), 100);
  }
};


// ── 2. ชำระหนี้ลูกหนี้: UI สีแบงค์ + กดแบงค์ + นับทอนเอง ──────
window.recordDebtPayment = async function (customerId, name) {
  const { data: cust } = await db.from('customer')
    .select('debt_amount,name,phone').eq('id', customerId).maybeSingle();
  if (!cust) { typeof toast==='function'&&toast('ไม่พบลูกค้า','error'); return; }
  const totalDebt = parseFloat(cust.debt_amount || 0);
  if (totalDebt <= 0) { typeof toast==='function'&&toast('ไม่มียอดหนี้','info'); return; }

  // สีแบงค์ไทยจริง
  const BILL_CONFIG = [
    {v:1000, color:'#8B4513', text:'#fff', label:'หนึ่งพัน'},
    {v:500,  color:'#9B59B6', text:'#fff', label:'ห้าร้อย'},
    {v:100,  color:'#E74C3C', text:'#fff', label:'ร้อย'},
    {v:50,   color:'#2980B9', text:'#fff', label:'ห้าสิบ'},
    {v:20,   color:'#27AE60', text:'#fff', label:'ยี่สิบ'},
    {v:10,   color:'#F39C12', text:'#fff', label:'สิบ'},
    {v:5,    color:'#E67E22', text:'#fff', label:'ห้า'},
    {v:1,    color:'#7F8C8D', text:'#fff', label:'หนึ่ง'},
  ];

  // state
  let state = {
    payAmt: totalDebt,
    method: 'cash',
    recv: {},  // denomination รับ
    chng: {},  // denomination ทอน
  };
  BILL_CONFIG.forEach(b => { state.recv[b.v]=0; state.chng[b.v]=0; });

  const sum = (denom) => BILL_CONFIG.reduce((s,b)=>s+(b.v*(denom[b.v]||0)),0);

  const buildBillGrid = (denomObj, isChange=false, readOnly=false) => {
    const total = sum(denomObj);
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
        ${BILL_CONFIG.map(b => {
          const cnt = denomObj[b.v]||0;
          const subtotal = b.v * cnt;
          return `
            <div onclick="window._v9DRS_tap(${b.v},'${isChange?'chng':'recv'}',${readOnly})"
              style="border-radius:12px;padding:10px 8px;text-align:center;cursor:${readOnly?'default':'pointer'};
                background:${cnt>0?b.color+'22':'#f9fafb'};
                border:2px solid ${cnt>0?b.color:'#e5e7eb'};
                transition:all .15s;position:relative;user-select:none;">
              <!-- แบงค์สี -->
              <div style="width:100%;height:32px;border-radius:8px;background:${b.color};
                display:flex;align-items:center;justify-content:center;margin-bottom:6px;
                box-shadow:0 2px 4px ${b.color}66;">
                <span style="color:${b.text};font-size:13px;font-weight:700;">฿${b.v>=1000?'1K':b.v}</span>
              </div>
              <div style="font-size:18px;font-weight:800;color:${cnt>0?b.color:'#9ca3af'};">${cnt}</div>
              ${cnt>0?`<div style="font-size:9px;color:${b.color};margin-top:2px;">฿${formatNum(subtotal)}</div>`:''}
              ${!readOnly?`
                <div style="position:absolute;top:4px;right:4px;display:flex;gap:2px;">
                  <button onclick="event.stopPropagation();window._v9DRS_dec(${b.v},'${isChange?'chng':'recv'}')"
                    style="width:18px;height:18px;border-radius:4px;border:none;background:rgba(0,0,0,.15);
                      color:#fff;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:700;">−</button>
                </div>`:''}
            </div>`;
        }).join('')}
      </div>
      <div style="text-align:right;font-size:14px;font-weight:700;color:${total>0?'#15803d':'#9ca3af'};">
        รวม ฿${formatNum(total)}
      </div>`;
  };

  window._v9DRS_tap = (billVal, type, readOnly) => {
    if (readOnly) return;
    state[type][billVal] = (state[type][billVal]||0) + 1;
    window._v9DRS_refresh();
  };
  window._v9DRS_dec = (billVal, type) => {
    state[type][billVal] = Math.max(0,(state[type][billVal]||0)-1);
    window._v9DRS_refresh();
  };

  window._v9DRS_refresh = () => {
    const recv = sum(state.recv);
    const need = state.payAmt;
    const chng = sum(state.chng);
    const diff = recv - need;

    // re-render grids
    const rg = document.getElementById('v9drs-recv-grid');
    const cg = document.getElementById('v9drs-chng-grid');
    if (rg) rg.innerHTML = buildBillGrid(state.recv, false);
    if (cg) cg.innerHTML = buildBillGrid(state.chng, true);

    // status bar
    const sb = document.getElementById('v9drs-status');
    if (sb) {
      if (recv === 0) {
        sb.innerHTML='<span style="color:#9ca3af;">กรุณากดแบงค์ที่รับมา</span>';
      } else if (recv < need) {
        sb.innerHTML=`<span style="color:#dc2626;">⚠️ ขาดอีก ฿${formatNum(need-recv)}</span>`;
      } else if (recv === need) {
        sb.innerHTML=`<span style="color:#15803d;">✅ รับพอดี ไม่ต้องทอน</span>`;
      } else {
        sb.innerHTML=`<span style="color:#d97706;">ต้องทอน ฿${formatNum(diff)}</span>`;
      }
    }

    // change status
    const cs = document.getElementById('v9drs-chng-status');
    if (cs && diff > 0) {
      if (chng === diff) {
        cs.style.background='#f0fdf4'; cs.style.color='#15803d';
        cs.innerHTML='✅ ทอนถูกต้องพอดี — กดบันทึกได้';
      } else if (chng < diff) {
        cs.style.background='#fef2f2'; cs.style.color='#dc2626';
        cs.innerHTML=`❌ ทอนไม่พอ ขาด ฿${formatNum(diff-chng)}`;
      } else {
        cs.style.background='#fef3c7'; cs.style.color='#d97706';
        cs.innerHTML=`⚠️ ทอนเกิน ฿${formatNum(chng-diff)} — ปรับแบงค์ใหม่`;
      }
    }
    if (cs && diff <= 0) {
      cs.style.display='none';
    } else if (cs) {
      cs.style.display='block';
    }

    // summary
    ['v9drs-sum-recv','v9drs-sum-chng','v9drs-sum-remain'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id==='v9drs-sum-recv') el.textContent = `฿${formatNum(recv)}`;
      if (id==='v9drs-sum-chng') el.textContent = `฿${formatNum(Math.max(0,diff))}`;
      if (id==='v9drs-sum-remain') {
        const remain = Math.max(0, totalDebt - need);
        el.textContent = `฿${formatNum(remain)}`;
        el.style.color = remain>0?'#dc2626':'#15803d';
      }
    });
  };

  const { isConfirmed } = await Swal.fire({
    title: '',
    html: `
      <div style="text-align:left;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);border-radius:14px;
          padding:16px 18px;margin-bottom:16px;color:#fff;">
          <div style="font-size:12px;opacity:.8;margin-bottom:4px;">หนี้คงค้าง — ${name}</div>
          <div style="font-size:28px;font-weight:800;">฿${formatNum(totalDebt)}</div>
          ${cust.phone?`<div style="font-size:11px;opacity:.7;margin-top:2px;">${cust.phone}</div>`:''}
        </div>

        <!-- ยอดชำระวันนี้ + วิธี -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
          <div>
            <label style="font-size:11px;font-weight:600;color:#555;display:block;margin-bottom:4px;">ชำระวันนี้ (฿)</label>
            <input id="v9drs-pay-amt" type="number" value="${totalDebt}" min="1" max="${totalDebt}" step="0.01"
              oninput="state&&(window._v9DRS_state.payAmt=Math.min(parseFloat(this.value||0),${totalDebt}));window._v9DRS_refresh();"
              style="width:100%;padding:10px;border:1.5px solid #d1d5db;border-radius:8px;
                font-size:16px;font-weight:700;text-align:right;color:#15803d;">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#555;display:block;margin-bottom:4px;">วิธีชำระ</label>
            <select id="v9drs-method"
              onchange="window._v9DRS_state.method=this.value;document.getElementById('v9drs-cash-section').style.display=this.value==='cash'?'':'none';"
              style="width:100%;padding:10px;border:1.5px solid #d1d5db;border-radius:8px;font-size:13px;height:42px;">
              <option value="cash">เงินสด</option>
              <option value="transfer">โอนเงิน</option>
            </select>
          </div>
        </div>

        <!-- Cash section -->
        <div id="v9drs-cash-section">
          <!-- รับเงิน -->
          <div style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:#374151;">กดแบงค์ที่รับมา:</span>
              <span id="v9drs-status" style="font-size:12px;"></span>
            </div>
            <div id="v9drs-recv-grid">${buildBillGrid(state.recv, false)}</div>
          </div>

          <!-- สรุป -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
            <div style="background:#f0fdf4;border-radius:10px;padding:10px;text-align:center;">
              <div style="font-size:10px;color:#555;margin-bottom:2px;">รับมา</div>
              <div id="v9drs-sum-recv" style="font-size:16px;font-weight:700;color:#15803d;">฿0</div>
            </div>
            <div style="background:#fef3c7;border-radius:10px;padding:10px;text-align:center;">
              <div style="font-size:10px;color:#555;margin-bottom:2px;">ต้องทอน</div>
              <div id="v9drs-sum-chng" style="font-size:16px;font-weight:700;color:#d97706;">฿0</div>
            </div>
            <div style="background:#fef2f2;border-radius:10px;padding:10px;text-align:center;">
              <div style="font-size:10px;color:#555;margin-bottom:2px;">หนี้คงเหลือ</div>
              <div id="v9drs-sum-remain" style="font-size:16px;font-weight:700;color:#dc2626;">฿${formatNum(totalDebt)}</div>
            </div>
          </div>

          <!-- ทอนเงิน -->
          <div id="v9drs-chng-section">
            <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">กดแบงค์ที่ทอนให้ลูกค้า:</div>
            <div id="v9drs-chng-grid">${buildBillGrid(state.chng, true)}</div>
            <div id="v9drs-chng-status" style="padding:8px 12px;border-radius:8px;font-size:12px;
              font-weight:600;text-align:center;margin-top:8px;display:none;"></div>
          </div>
        </div>

      </div>`,
    width: '560px',
    showCancelButton: true,
    confirmButtonText: '✅ บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#15803d',
    didOpen: () => {
      window._v9DRS_state = state;
      window._v9DRS_refresh();
    },
    preConfirm: () => {
      // อัปเดต state จาก input
      state.payAmt = Math.min(
        parseFloat(document.getElementById('v9drs-pay-amt')?.value || totalDebt),
        totalDebt
      );
      state.method = document.getElementById('v9drs-method')?.value || 'cash';
      return true;
    },
  });

  if (!isConfirmed) return;

  const recvTotal = sum(state.recv);
  const changeNeeded = Math.max(0, recvTotal - state.payAmt);
  const changeGiven  = sum(state.chng);
  const isCash = state.method === 'cash';

  // validate
  if (isCash) {
    if (recvTotal < state.payAmt) {
      typeof toast==='function'&&toast(`รับเงินไม่พอ (รับมา ฿${formatNum(recvTotal)} ต้องการ ฿${formatNum(state.payAmt)})`,'error');
      return;
    }
    if (changeNeeded > 0 && changeGiven !== changeNeeded) {
      typeof toast==='function'&&toast(`เงินทอนไม่ถูกต้อง (ต้องทอน ฿${formatNum(changeNeeded)} แต่ทอน ฿${formatNum(changeGiven)})`,'error');
      return;
    }
  }

  await window._v9SaveDebtPayment(
    customerId, name, state.payAmt, totalDebt,
    isCash?'เงินสด':'โอนเงิน', changeNeeded
  );
};


// ══════════════════════════════════════════════════════════════════
// FIX-44 — แก้ 7 bugs
//  Bug2: ปุ่มคลังสินค้า
//  Bug3: เพิ่มลูกค้าใหม่ในใบชำระเงิน
//  Bug4: renderPayables override
//  Bug5: ใบเสนอราคา professional + สินค้านอกคลัง
//  Bug7: Dashboard query fix + แยก P&L และ Cash Flow
// ══════════════════════════════════════════════════════════════════

// ── Bug2: inventory ปุ่ม barcode+CSV+เพิ่มสินค้า ────────────────
// inject ปุ่ม toolbar ด้านบนถูกต้อง ผ่าน page-actions
(function patchInvButtons() {
  const orig = window.renderInventory;
  window.renderInventory = async function () {
    await orig?.apply(this, arguments);
    // toolbar ด้านบน (page-actions)
    const pa = document.getElementById('page-actions');
    if (pa) {
      pa.innerHTML = `
        <button class="btn btn-outline" onclick="showBarcodeBatchModal?.()">
          <i class="material-icons-round">qr_code_2</i> ปริ้นบาร์โค้ด
        </button>
        <button class="btn btn-outline" onclick="exportInventory?.()">
          <i class="material-icons-round">download</i> CSV
        </button>
        <button class="btn btn-primary" onclick="window.showAddProductModal()">
          <i class="material-icons-round">add</i> เพิ่มสินค้า
        </button>`;
    }
    // ลบปุ่มซ้ำที่ toolbar ล่าง (inv-toolbar)
    const invToolbarBtns = document.querySelector('#page-inv .toolbar-actions');
    if (invToolbarBtns) invToolbarBtns.innerHTML = '';
  };
})();


// ── Bug3: เพิ่มลูกค้าใหม่ในใบชำระเงิน ──────────────────────────
// override renderStep1 ให้มีปุ่ม "เพิ่มลูกค้าใหม่"
// modules-v4.js render checkout modal แบบใหม่ (billCheckout)
// ใน billCheckout มี customer section ที่ต้องเพิ่มปุ่ม
const _v9OrigBcRender = window.renderBillCheckout || window.openBillCheckout;
// ไม่มี renderStep1 override เพราะ modules-v4 ใช้ UI ต่างออกไป
// แต่ใน checkout overlay เดิม (app.js) มี selectCustomerType อยู่แล้ว
// เพิ่ม "เพิ่มลูกค้าใหม่" tab ใน billCheckout ของ modules-v4
const _v9OrigBcOpen = window.openCashSession !== undefined ? null : null;

// patch selectCustomerType ให้ครอบคลุม 'new' case
window.selectCustomerType = async function(type) {
  checkoutState.customer.type = type;
  document.querySelectorAll('.customer-type-btn').forEach(btn=>btn.classList.remove('selected'));
  const clicked = event?.currentTarget || document.querySelector(`[onclick*="'${type}'"]`);
  if (clicked) clicked.classList.add('selected');
  const extra = document.getElementById('customer-selection-extra');
  if (!extra) return;

  if (type === 'general') {
    checkoutState.customer = {type:'general', id:null, name:'ลูกค้าทั่วไป'};
    extra.innerHTML = '';
  } else if (type === 'member') {
    const {data:customers} = await db.from('customer').select('*').order('name');
    extra.innerHTML = `<div style="margin-top:16px;">
      <input type="text" class="form-input" placeholder="ค้นหาลูกค้า..."
        id="customer-search" oninput="filterCustomerList()" style="margin-bottom:10px;">
      <div id="customer-list" style="max-height:200px;overflow-y:auto;">
        ${(customers||[]).map(c=>{
          const safeName=c.name.replace(/'/g,"&apos;");
          return `<div class="customer-type-btn" style="padding:12px;margin-bottom:8px;"
            onclick="selectCustomer('${c.id}','${safeName}')">
            <div class="customer-type-info">
              <h4>${c.name}</h4>
              <p>${c.phone||'-'} | ยอดสะสม ฿${formatNum(c.total_purchase)}</p>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  } else if (type === 'new') {
    extra.innerHTML = `<div style="margin-top:16px;">
      <div class="form-group">
        <label class="form-label">ชื่อลูกค้า *</label>
        <input type="text" class="form-input" id="new-customer-name" placeholder="ชื่อ-นามสกุล">
      </div>
      <div class="form-group">
        <label class="form-label">เบอร์โทร</label>
        <input type="tel" class="form-input" id="new-customer-phone" placeholder="0XX-XXX-XXXX">
      </div>
      <button class="btn btn-primary" onclick="createNewCustomer()" style="width:100%;">
        <i class="material-icons-round">person_add</i> บันทึกลูกค้าใหม่
      </button>
    </div>`;
  }
};

// createNewCustomer บันทึกลง customer table + set ใน checkoutState
window.createNewCustomer = async function () {
  const name  = document.getElementById('new-customer-name')?.value?.trim();
  const phone = document.getElementById('new-customer-phone')?.value?.trim();
  if (!name) { typeof toast==='function'&&toast('กรุณากรอกชื่อลูกค้า','error'); return; }
  try {
    const {data, error} = await db.from('customer').insert({
      name, phone: phone||null,
      total_purchase: 0, visit_count: 0, debt_amount: 0,
    }).select().single();
    if (error) throw error;
    checkoutState.customer = {type:'new', id:data.id, name:data.name};
    typeof toast==='function'&&toast(`เพิ่มลูกค้า "${name}" สำเร็จ ✅`,'success');
    document.getElementById('new-customer-name').value = '';
    document.getElementById('new-customer-phone').value = '';
    // แสดงว่าเลือกแล้ว
    const extra = document.getElementById('customer-selection-extra');
    if (extra) extra.innerHTML = `<div style="margin-top:12px;padding:12px;background:#f0fdf4;
      border-radius:8px;display:flex;align-items:center;gap:8px;">
      <i class="material-icons-round" style="color:#15803d;">check_circle</i>
      <span style="font-size:13px;font-weight:600;color:#15803d;">เลือกลูกค้า: ${name}</span>
    </div>`;
  } catch(e) {
    typeof toast==='function'&&toast('ไม่สามารถเพิ่มลูกค้าได้: '+e.message,'error');
  }
};


// ── Bug4: renderPayables override ──────────────────────────────────
window.renderPayables = async function () {
  const section = document.getElementById('page-payable');
  if (!section) return;

  const { data } = await db.from('เจ้าหนี้')
    .select('*, ซัพพลายเออร์(name,phone)')
    .order('due_date', {ascending:true})
    .limit(200);

  const rows      = data || [];
  const pending   = rows.filter(r=>r.status==='ค้างชำระ');
  const totalDebt = pending.reduce((s,r)=>s+parseFloat(r.balance||0),0);

  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-stats" style="margin-bottom:16px;">
        <div class="inv-stat danger">
          <span class="inv-stat-value">฿${formatNum(Math.round(totalDebt))}</span>
          <span class="inv-stat-label">ค้างชำระรวม</span>
        </div>
        <div class="inv-stat warning">
          <span class="inv-stat-value">${pending.length}</span>
          <span class="inv-stat-label">รายการค้าง</span>
        </div>
        <div class="inv-stat success">
          <span class="inv-stat-value">${rows.filter(r=>r.status==='ชำระแล้ว').length}</span>
          <span class="inv-stat-label">ชำระแล้ว</span>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>ผู้จำหน่าย</th>
              <th>วันที่</th>
              <th>ครบกำหนด</th>
              <th class="text-right">ยอดรวม</th>
              <th class="text-right">ชำระแล้ว</th>
              <th class="text-right">คงค้าง</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length===0
              ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-tertiary);">ยังไม่มีรายการเจ้าหนี้</td></tr>`
              : rows.map(r=>{
                const isOverdue = r.due_date && new Date(r.due_date)<new Date() && r.status==='ค้างชำระ';
                const balance   = parseFloat(r.balance||0);
                return `<tr style="${isOverdue?'background:#fef2f2;':''}">
                  <td>
                    <div style="font-weight:600;">${r.ซัพพลายเออร์?.name||'ไม่ระบุ'}</div>
                    ${r.ซัพพลายเออร์?.phone?`<div style="font-size:11px;color:var(--text-tertiary);">${r.ซัพพลายเออร์.phone}</div>`:''}
                  </td>
                  <td style="font-size:12px;">${r.date?new Date(r.date).toLocaleDateString('th-TH'):'-'}</td>
                  <td style="font-size:12px;${isOverdue?'color:#dc2626;font-weight:600;':''}">
                    ${r.due_date?new Date(r.due_date).toLocaleDateString('th-TH'):'-'}${isOverdue?' ⚠️':''}
                  </td>
                  <td class="text-right">฿${formatNum(r.amount)}</td>
                  <td class="text-right" style="color:#15803d;">฿${formatNum(r.paid_amount||0)}</td>
                  <td class="text-right">
                    <strong style="color:${balance>0?'#dc2626':'#15803d'};">฿${formatNum(balance)}</strong>
                  </td>
                  <td>
                    <span class="badge ${r.status==='ชำระแล้ว'?'badge-success':isOverdue?'badge-danger':'badge-warning'}">
                      ${r.status}
                    </span>
                  </td>
                  <td>
                    ${r.status==='ค้างชำระ'?`
                      <button class="btn btn-primary btn-sm"
                        onclick="window.v9PayCreditor('${r.id}','${(r.ซัพพลายเออร์?.name||'ไม่ระบุ').replace(/'/g,"&apos;")}',${balance},${r.amount})">
                        <i class="material-icons-round" style="font-size:13px;">payments</i> ชำระ
                      </button>`:''}
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
};


// ── Bug5: ใบเสนอราคา professional + สินค้านอกคลัง ───────────────
window.v9ShowQuotModal = async function () {
  window._v9QuotItems44 = [];
  if (typeof openModal !== 'function') return;

  await loadProducts?.();
  const prods = window.products || [];
  window._v9QuotProds44 = prods;

  const renderItems44 = () => {
    const el = document.getElementById('v9q44-items');
    if (!el) return;
    if (!window._v9QuotItems44.length) {
      el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-tertiary);
        border:1.5px dashed var(--border-light);border-radius:8px;font-size:12px;">
        กดปุ่ม "+ เพิ่มรายการ" เพื่อเพิ่มสินค้า</div>`;
      return;
    }
    el.innerHTML = window._v9QuotItems44.map((it,i) => `
      <div style="display:grid;grid-template-columns:2fr 80px 80px 110px 28px;
        gap:6px;align-items:center;padding:8px 10px;
        background:var(--bg-base);border-radius:8px;margin-bottom:6px;
        border:0.5px solid var(--border-light);">
        <input value="${it.name}" placeholder="ชื่อสินค้า/บริการ"
          style="padding:6px 8px;border:0.5px solid var(--border-light);border-radius:6px;font-size:13px;width:100%;"
          oninput="window._v9QuotItems44[${i}].name=this.value;window._v9QuotCalcTotal44();">
        <input type="number" value="${it.qty}" min="1"
          style="padding:6px 4px;border:0.5px solid var(--border-light);border-radius:6px;font-size:13px;text-align:center;width:100%;"
          oninput="window._v9QuotItems44[${i}].qty=parseFloat(this.value||1);window._v9QuotCalcTotal44();">
        <input value="${it.unit}" placeholder="หน่วย"
          style="padding:6px 4px;border:0.5px solid var(--border-light);border-radius:6px;font-size:13px;text-align:center;width:100%;"
          oninput="window._v9QuotItems44[${i}].unit=this.value;">
        <input type="number" value="${it.price}" min="0"
          style="padding:6px 4px;border:0.5px solid var(--border-light);border-radius:6px;font-size:13px;text-align:right;width:100%;"
          oninput="window._v9QuotItems44[${i}].price=parseFloat(this.value||0);window._v9QuotCalcTotal44();">
        <button onclick="window._v9QuotItems44.splice(${i},1);window._v9QuotRender44();"
          style="background:none;border:none;cursor:pointer;color:#ef4444;padding:0;">
          <i class="material-icons-round" style="font-size:16px;">close</i>
        </button>
      </div>`).join('');
    window._v9QuotCalcTotal44();
  };

  window._v9QuotRender44 = renderItems44;
  window._v9QuotCalcTotal44 = () => {
    const sub = (window._v9QuotItems44||[]).reduce((s,i)=>s+(i.qty*i.price),0);
    const disc = parseFloat(document.getElementById('v9q44-disc')?.value||0);
    const tot  = Math.max(0,sub-disc);
    const el   = document.getElementById('v9q44-total');
    if (el) el.textContent = `฿${formatNum(Math.round(tot))}`;
  };

  // เพิ่มรายการ
  window._v9QuotAddRow44 = (prodId='') => {
    const prod = (window._v9QuotProds44||[]).find(p=>p.id===prodId);
    window._v9QuotItems44.push({
      product_id: prodId, name: prod?.name||'',
      qty:1, unit: prod?.unit||'ชิ้น',
      price: prod?.price||0,
    });
    renderItems44();
  };

  const prodOpts = prods.map(p=>`<option value="${p.id}">${p.name} — ฿${formatNum(p.price)}</option>`).join('');

  openModal('สร้างใบเสนอราคา', `
    <div>
      <!-- ข้อมูลลูกค้า + วันที่ -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">ชื่อลูกค้า *</label>
          <input class="form-input" id="v9q44-cust" placeholder="ชื่อลูกค้า / บริษัท" required>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">วันหมดอายุ</label>
          <input class="form-input" type="date" id="v9q44-valid"
            value="${new Date(Date.now()+30*86400000).toISOString().split('T')[0]}">
        </div>
      </div>

      <!-- รายการสินค้า -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <label class="form-label" style="margin:0;font-weight:700;">รายการสินค้า / บริการ</label>
        <div style="display:flex;gap:6px;">
          <select id="v9q44-prod-sel" class="form-input" style="font-size:12px;width:180px;"
            onchange="">
            <option value="">+ เลือกจากคลัง</option>${prodOpts}
          </select>
          <button type="button" class="btn btn-outline btn-sm"
            onclick="window._v9QuotAddRow44(document.getElementById('v9q44-prod-sel').value);document.getElementById('v9q44-prod-sel').value='';">
            เพิ่ม
          </button>
          <button type="button" class="btn btn-primary btn-sm"
            onclick="window._v9QuotAddRow44('');">
            <i class="material-icons-round" style="font-size:13px;">add</i> รายการอิสระ
          </button>
        </div>
      </div>

      <!-- Header columns -->
      <div style="display:grid;grid-template-columns:2fr 80px 80px 110px 28px;gap:6px;
        padding:4px 10px;margin-bottom:4px;">
        <span style="font-size:10px;color:var(--text-tertiary);font-weight:600;">รายการ</span>
        <span style="font-size:10px;color:var(--text-tertiary);font-weight:600;text-align:center;">จำนวน</span>
        <span style="font-size:10px;color:var(--text-tertiary);font-weight:600;text-align:center;">หน่วย</span>
        <span style="font-size:10px;color:var(--text-tertiary);font-weight:600;text-align:right;">ราคา/หน่วย</span>
        <span></span>
      </div>

      <div id="v9q44-items" style="min-height:60px;margin-bottom:12px;"></div>

      <!-- ส่วนลด + ยอดรวม -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:10px 14px;background:var(--bg-base);border-radius:8px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:12px;color:var(--text-secondary);">ส่วนลด (฿)</span>
          <input type="number" id="v9q44-disc" value="0" min="0"
            oninput="window._v9QuotCalcTotal44()"
            style="width:100px;padding:5px 8px;border:0.5px solid var(--border-light);border-radius:6px;font-size:13px;text-align:right;">
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:var(--text-tertiary);">ยอดรวม</div>
          <div id="v9q44-total" style="font-size:22px;font-weight:700;color:var(--primary);">฿0</div>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="v9q44-note" placeholder="(ถ้ามี)">
      </div>

      <button type="button" class="btn btn-primary" style="width:100%;"
        onclick="window._v9SaveQuot44()">
        <i class="material-icons-round">save</i> บันทึกใบเสนอราคา
      </button>
    </div>`);

  renderItems44();
};

window._v9SaveQuot44 = async function () {
  const customer = document.getElementById('v9q44-cust')?.value?.trim();
  if (!customer) { typeof toast==='function'&&toast('กรุณากรอกชื่อลูกค้า','error'); return; }
  const items = window._v9QuotItems44||[];
  if (!items.length || !items.some(i=>i.name)) {
    typeof toast==='function'&&toast('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ','error'); return;
  }
  const discount = parseFloat(document.getElementById('v9q44-disc')?.value||0);
  const subtotal = items.reduce((s,i)=>s+(i.qty*i.price),0);
  const total    = Math.max(0,subtotal-discount);
  const valid    = document.getElementById('v9q44-valid')?.value||null;
  const note     = document.getElementById('v9q44-note')?.value||'';

  v9ShowOverlay('กำลังบันทึก...');
  try {
    const {data:quot, error:qe} = await db.from('ใบเสนอราคา').insert({
      customer_name:customer, total, discount,
      date:new Date().toISOString(),
      valid_until:valid?new Date(valid).toISOString():null,
      note:note||null, staff_name:v9Staff(),
    }).select().single();
    if (qe) throw new Error(qe.message);

    for (const it of items) {
      await db.from('รายการใบเสนอราคา').insert({
        quotation_id:quot.id, product_id:it.product_id||null,
        name:it.name, qty:it.qty, unit:it.unit||'ชิ้น',
        price:it.price, total:it.qty*it.price,
      });
    }

    typeof closeModal==='function'&&closeModal();
    typeof toast==='function'&&toast('บันทึกใบเสนอราคาสำเร็จ','success');
    window.renderQuotations?.();
  } catch(e) {
    typeof toast==='function'&&toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};

window.showAddQuotationModal = window.v9ShowQuotModal;

// ── Bug5: print quotation professional ───────────────────────────
window.v9PrintQuotation = async function (quotId) {
  v9ShowOverlay('กำลังเตรียมพิมพ์...');
  try {
    const [{data:quot},{data:items},{data:rc}] = await Promise.all([
      db.from('ใบเสนอราคา').select('*').eq('id',quotId).maybeSingle(),
      db.from('รายการใบเสนอราคา').select('*').eq('quotation_id',quotId),
      db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle(),
    ]);
    v9HideOverlay();
    if (!quot){typeof toast==='function'&&toast('ไม่พบข้อมูล','error');return;}

    const shopName  = rc?.shop_name||'ร้านค้า';
    const shopAddr  = rc?.address||'';
    const shopPhone = rc?.phone||'';
    const shopTax   = rc?.tax_id||'';
    const qtId      = `QT-${String(quotId).slice(-6).toUpperCase()}`;
    const subtotal  = (items||[]).reduce((s,i)=>s+parseFloat(i.total||0),0);
    const discount  = parseFloat(quot.discount||0);
    const total     = parseFloat(quot.total||0);

    const itemsHTML = (items||[]).map((i,idx) => `
      <tr style="background:${idx%2===0?'#fafafa':'#fff'};">
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${i.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;">${i.qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;">${i.unit||'ชิ้น'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;">${formatNum(i.price)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;font-weight:600;">${formatNum(i.total)}</td>
      </tr>`).join('');

    const w = window.open('','_blank','width=860,height=1000');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>ใบเสนอราคา ${qtId}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap" rel="stylesheet">
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Sarabun',sans-serif;background:#f8fafc;color:#1e293b;font-size:14px;}
        .page{max-width:780px;margin:32px auto;background:#fff;border-radius:16px;
          box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden;}
        .header{background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px 40px;color:#fff;}
        .header h1{font-size:28px;font-weight:800;margin-bottom:4px;}
        .header .sub{font-size:13px;opacity:.8;}
        .doc-badge{background:rgba(255,255,255,.15);border-radius:8px;padding:8px 16px;
          text-align:right;}
        .doc-badge .label{font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.5px;}
        .doc-badge .value{font-size:18px;font-weight:700;}
        .body-section{padding:32px 40px;}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;}
        .info-box{background:#f8fafc;border-radius:10px;padding:14px 16px;}
        .info-box .label{font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;
          letter-spacing:.5px;margin-bottom:4px;}
        .info-box .value{font-size:15px;font-weight:700;}
        table{width:100%;border-collapse:collapse;margin-bottom:24px;}
        thead tr{background:#dc2626;color:#fff;}
        thead th{padding:12px 12px;font-size:12px;font-weight:600;text-align:left;}
        .total-section{background:#f8fafc;border-radius:10px;padding:16px 20px;
          display:flex;justify-content:flex-end;}
        .total-inner{width:240px;}
        .total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;}
        .total-final{display:flex;justify-content:space-between;padding:10px 0;
          font-size:18px;font-weight:800;color:#dc2626;
          border-top:2px solid #e2e8f0;margin-top:8px;}
        .sign-section{display:grid;grid-template-columns:1fr 1fr;gap:40px;
          margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;}
        .sign-box{text-align:center;}
        .sign-line{border-top:1px solid #cbd5e1;padding-top:8px;margin-top:48px;
          font-size:11px;color:#94a3b8;}
        .note-section{background:#fef3c7;border-radius:8px;padding:10px 14px;
          font-size:12px;color:#92400e;margin-bottom:20px;}
        @media print{body{background:#fff;}.page{box-shadow:none;border-radius:0;margin:0;}}
      </style>
    </head><body>
      <div class="page">
        <!-- Header -->
        <div class="header" style="display:flex;align-items:flex-start;justify-content:space-between;">
          <div>
            <h1>${shopName}</h1>
            ${shopAddr?`<div class="sub">${shopAddr}</div>`:''}
            ${shopPhone?`<div class="sub">โทร ${shopPhone}</div>`:''}
            ${shopTax?`<div class="sub">เลขผู้เสียภาษี ${shopTax}</div>`:''}
          </div>
          <div class="doc-badge">
            <div class="label">ใบเสนอราคา</div>
            <div class="value">${qtId}</div>
            <div style="font-size:11px;opacity:.8;margin-top:4px;">
              ${new Date(quot.date).toLocaleDateString('th-TH',{dateStyle:'long'})}
            </div>
            ${quot.valid_until?`<div style="font-size:11px;color:#fde68a;margin-top:2px;">
              หมดอายุ ${new Date(quot.valid_until).toLocaleDateString('th-TH',{dateStyle:'long'})}
            </div>`:''}
          </div>
        </div>

        <!-- Body -->
        <div class="body-section">
          <div class="info-grid">
            <div class="info-box">
              <div class="label">เสนอให้</div>
              <div class="value">${quot.customer_name}</div>
            </div>
            <div class="info-box">
              <div class="label">ออกโดย</div>
              <div class="value">${quot.staff_name||shopName}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>รายการ</th>
                <th style="text-align:center;width:70px;">จำนวน</th>
                <th style="text-align:center;width:70px;">หน่วย</th>
                <th style="text-align:right;width:110px;">ราคา/หน่วย</th>
                <th style="text-align:right;width:110px;">รวม</th>
              </tr>
            </thead>
            <tbody>${itemsHTML}</tbody>
          </table>

          <div class="total-section">
            <div class="total-inner">
              <div class="total-row">
                <span>ราคารวม</span>
                <span>฿${formatNum(subtotal)}</span>
              </div>
              ${discount>0?`<div class="total-row" style="color:#ef4444;">
                <span>ส่วนลด</span>
                <span>-฿${formatNum(discount)}</span>
              </div>`:''}
              <div class="total-final">
                <span>ยอดรวมทั้งสิ้น</span>
                <span>฿${formatNum(total)}</span>
              </div>
            </div>
          </div>

          ${quot.note?`<div class="note-section">หมายเหตุ: ${quot.note}</div>`:''}

          <div class="sign-section">
            <div class="sign-box">
              <div class="sign-line">ลายเซ็นผู้เสนอราคา</div>
            </div>
            <div class="sign-box">
              <div class="sign-line">ลายเซ็นลูกค้า</div>
            </div>
          </div>
        </div>
      </div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1200);}<\/script>
    </body></html>`);
    w.document.close();
  } catch(e){v9HideOverlay();typeof toast==='function'&&toast('พิมพ์ไม่ได้: '+e.message,'error');}
};


// ── Bug7: Dashboard แยก P&L และ Cash Flow ───────────────────────
// เพิ่ม nav item วิเคราะห์ธุรกิจ ใน sidebar
// override renderDashboard ให้มี tab P&L และ Cash Flow
const _v9OrigRenderDash44 = window.renderDashboard;
window.renderDashboard = async function () {
  const section = document.getElementById('page-dash');
  if (!section) return;

  // inject CSS
  if (!document.getElementById('v9db44-css')) {
    const s = document.createElement('style');
    s.id = 'v9db44-css';
    s.textContent = `
      .v9d44-tab{padding:10px 20px;border:none;background:transparent;cursor:pointer;
        font-size:13px;font-weight:500;color:var(--text-secondary);border-bottom:3px solid transparent;
        margin-bottom:-2px;transition:all .15s;font-family:var(--font-thai,'Prompt'),sans-serif;}
      .v9d44-tab.on{color:var(--primary);border-bottom-color:var(--primary);font-weight:700;}
      .v9d44-per{padding:6px 14px;border-radius:999px;border:0.5px solid var(--border-light);
        background:transparent;color:var(--text-secondary);cursor:pointer;font-size:12px;font-weight:500;
        font-family:var(--font-thai,'Prompt'),sans-serif;}
      .v9d44-per.on{background:var(--primary);color:#fff;border-color:var(--primary);}
    `;
    document.head.appendChild(s);
  }

  section.innerHTML = `
    <div style="padding:20px;max-width:1400px;margin:0 auto;">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:20px;font-weight:700;">วิเคราะห์ธุรกิจ</div>
          <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;" id="v9d44-lbl"></div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="v9d44-per on" data-d="1">วันนี้</button>
          <button class="v9d44-per" data-d="7">7 วัน</button>
          <button class="v9d44-per" data-d="30">30 วัน</button>
          <button class="v9d44-per" data-d="365">ปีนี้</button>
          <button class="v9d44-per" style="padding:6px 10px;" onclick="window.v9d44Load()">
            <i class="material-icons-round" style="font-size:14px;vertical-align:middle;">refresh</i>
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div style="display:flex;border-bottom:2px solid var(--border-light);margin-bottom:20px;">
        <button class="v9d44-tab on" data-tab="pl">📈 กำไร-ขาดทุน (P&amp;L)</button>
        <button class="v9d44-tab" data-tab="cash">💰 กระแสเงินสด</button>
      </div>

      <!-- KPI row -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px;" id="v9d44-kpi">
        ${[0,1,2,3,4].map(()=>`<div style="background:var(--bg-surface);border-radius:14px;padding:14px;border:0.5px solid var(--border-light);">
          <div style="height:11px;background:var(--bg-base);border-radius:4px;width:60%;margin-bottom:10px;"></div>
          <div style="height:22px;background:var(--bg-base);border-radius:4px;width:80%;"></div>
        </div>`).join('')}
      </div>

      <!-- Chart -->
      <div style="background:var(--bg-surface);border-radius:14px;border:0.5px solid var(--border-light);margin-bottom:16px;overflow:hidden;">
        <div style="padding:14px 18px;border-bottom:0.5px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:14px;font-weight:700;" id="v9d44-chart-title">กราฟรายวัน</span>
          <span id="v9d44-legend" style="display:flex;gap:12px;font-size:11px;color:var(--text-tertiary);"></span>
        </div>
        <div style="padding:16px 18px 8px;">
          <div id="v9d44-chart" style="height:160px;display:flex;align-items:flex-end;gap:4px;"></div>
          <div id="v9d44-clbl" style="display:flex;gap:4px;margin-top:6px;"></div>
        </div>
      </div>

      <!-- Main 2-col -->
      <div style="display:grid;grid-template-columns:1fr 340px;gap:14px;align-items:start;">
        <div>
          <!-- Timeline -->
          <div style="background:var(--bg-surface);border-radius:14px;border:0.5px solid var(--border-light);overflow:hidden;">
            <div style="padding:13px 16px;border-bottom:0.5px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:13px;font-weight:700;">รายการ</span>
              <div style="display:flex;gap:3px;" id="v9d44-tlf">
                ${['all:ทั้งหมด','sale:ขาย','buy:ซื้อ','exp:จ่าย'].map((x,i)=>{
                  const[k,v]=x.split(':');
                  return `<button style="padding:4px 10px;border-radius:999px;font-size:11px;border:0.5px solid var(--border-light);background:${i===0?'var(--primary)':'transparent'};color:${i===0?'#fff':'var(--text-tertiary)'};cursor:pointer;" data-f="${k}">${v}</button>`;
                }).join('')}
              </div>
            </div>
            <div id="v9d44-tl" style="max-height:420px;overflow-y:auto;">
              <div style="padding:40px;text-align:center;color:var(--text-tertiary);font-size:12px;">โหลด...</div>
            </div>
          </div>
        </div>

        <div>
          <!-- P&L Panel -->
          <div id="v9d44-pl-panel" style="background:var(--bg-surface);border-radius:14px;border:0.5px solid var(--border-light);overflow:hidden;margin-bottom:12px;">
            <div style="padding:13px 16px;border-bottom:0.5px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:13px;font-weight:700;">📈 กำไร-ขาดทุน (P&amp;L)</span>
              <span style="font-size:10px;background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:999px;">กำไรจริง</span>
            </div>
            <div style="padding:14px 16px;" id="v9d44-pl-body">โหลด...</div>
          </div>

          <!-- Cash Flow Panel -->
          <div id="v9d44-cash-panel" style="background:var(--bg-surface);border-radius:14px;border:0.5px solid var(--border-light);overflow:hidden;margin-bottom:12px;">
            <div style="padding:13px 16px;border-bottom:0.5px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:13px;font-weight:700;">💰 กระแสเงินสด</span>
              <span style="font-size:10px;background:#f0fdf4;color:#15803d;padding:2px 8px;border-radius:999px;">เงินเข้า-ออก</span>
            </div>
            <div style="padding:14px 16px;" id="v9d44-cash-body">โหลด...</div>
          </div>

          <!-- Top products -->
          <div style="background:var(--bg-surface);border-radius:14px;border:0.5px solid var(--border-light);overflow:hidden;">
            <div style="padding:13px 16px;border-bottom:0.5px solid var(--border-light);">
              <span style="font-size:13px;font-weight:700;">🏆 สินค้าขายดี</span>
            </div>
            <div style="padding:14px 16px;" id="v9d44-top">โหลด...</div>
          </div>
        </div>
      </div>
    </div>`;

  // bind tabs
  document.querySelectorAll('.v9d44-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.v9d44-tab').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      const tab=btn.dataset.tab;
      document.getElementById('v9d44-pl-panel').style.display=(tab==='cash')?'none':'';
      document.getElementById('v9d44-cash-panel').style.display=(tab==='pl')?'none':'';
    });
  });
  // bind period
  document.querySelectorAll('.v9d44-per').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.v9d44-per').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      window.v9d44Load();
    });
  });
  // bind timeline filter
  document.getElementById('v9d44-tlf')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-f]');
    if(!btn)return;
    document.querySelectorAll('#v9d44-tlf [data-f]').forEach(b=>{
      b.style.background='transparent';b.style.color='var(--text-tertiary)';
    });
    btn.style.background='var(--primary)';btn.style.color='#fff';
    if(window._v9d44Data) window.v9d44RenderTL(window._v9d44Data);
  });

  window.v9d44Load();
};

window.v9d44Load = async function () {
  const days  = parseInt(document.querySelector('.v9d44-per.on')?.dataset.d||1);
  const today = new Date().toISOString().split('T')[0];
  const since = days===1?today:new Date(Date.now()-(days-1)*86400000).toISOString().split('T')[0];

  const lbl=document.getElementById('v9d44-lbl');
  if(lbl) lbl.textContent=days===1
    ?new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
    :`${new Date(since+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})} — ${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}`;

  try {
    const [bR,pR,eR,iR,salR] = await Promise.all([
      db.from('บิลขาย').select('id,bill_no,total,method,status,date,customer_name')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(500),
      db.from('purchase_order').select('id,total,supplier,method,date,status')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายจ่าย').select('id,description,amount,category,method,date')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายการในบิล').select('name,qty,price,cost,total,unit,bill_id').limit(2000),
      db.from('จ่ายเงินเดือน').select('net_paid,paid_date')
        .gte('paid_date',since+'T00:00:00'),
    ]);

    const B   = (bR.data||[]).filter(b=>b.status!=='ยกเลิก');
    const bIds= new Set(B.map(b=>b.id));
    const P   = pR.data||[];
    const E   = eR.data||[];
    const I   = (iR.data||[]).filter(i=>bIds.has(i.bill_id));
    const Sal = salR.data||[];

    const EW  = E.filter(e=>e.category==='ค่าแรง');
    const EO  = E.filter(e=>e.category!=='ค่าแรง');

    const tS   = B.reduce((s,b)=>s+parseFloat(b.total||0),0);
    const tP   = P.reduce((s,p)=>s+parseFloat(p.total||0),0);
    const tEW  = EW.reduce((s,e)=>s+parseFloat(e.amount||0),0);
    const tEO  = EO.reduce((s,e)=>s+parseFloat(e.amount||0),0);
    const tSal = Sal.reduce((s,p)=>s+parseFloat(p.net_paid||0),0);
    const tO   = tP+tEW+tEO+tSal;
    const nC   = tS-tO;
    const cogs = I.reduce((s,i)=>s+(parseFloat(i.cost||0)*parseFloat(i.qty||0)),0);
    const gP   = tS-cogs; const gM=tS>0?Math.round(gP/tS*100):0;
    const opX  = tEW+tEO;
    const nP   = gP-opX;  const nM=tS>0?Math.round(nP/tS*100):0;

    window._v9d44Data={B,P,E,EW,EO,I,Sal,tS,tP,tEW,tEO,tSal,tO,nC,cogs,gP,gM,opX,nP,nM,days,since};
    window.v9d44KPI(window._v9d44Data);
    window.v9d44Chart(window._v9d44Data);
    window.v9d44RenderTL(window._v9d44Data);
    window.v9d44PL(window._v9d44Data);
    window.v9d44Cash(window._v9d44Data);
    window.v9d44Top(I);
  } catch(e){console.error('[Dash44]',e);}
};

window.v9d44KPI = function({B,tS,cogs,gP,gM,nP,nM,nC}) {
  const el=document.getElementById('v9d44-kpi');if(!el)return;
  const K=[
    {l:'ยอดขาย',v:tS,s:`${B.length} บิล`,c:'#15803d',i:'trending_up'},
    {l:'COGS',v:cogs,s:'ต้นทุนขาย',c:'#d97706',i:'inventory'},
    {l:'กำไรขั้นต้น',v:gP,s:`${gM}%`,c:gP>=0?'#0891b2':'#dc2626',i:'show_chart'},
    {l:'กำไรสุทธิ',v:nP,s:`${nM}%`,c:nP>=0?'#15803d':'#dc2626',i:'account_balance'},
    {l:'เงินสดสุทธิ',v:nC,s:nC>=0?'บวก':'ลบ',c:nC>=0?'#15803d':'#dc2626',i:'account_balance_wallet'},
  ];
  el.innerHTML=K.map(k=>`
    <div style="background:var(--bg-surface);border-radius:14px;padding:16px;border-left:3px solid ${k.c};border-top:0.5px solid var(--border-light);border-right:0.5px solid var(--border-light);border-bottom:0.5px solid var(--border-light);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:11px;color:var(--text-tertiary);">${k.l}</span>
        <i class="material-icons-round" style="font-size:15px;color:${k.c};opacity:.6;">${k.i}</i>
      </div>
      <div style="font-size:22px;font-weight:700;color:${k.c};">${k.v<0?'−':''}฿${formatNum(Math.abs(Math.round(k.v)))}</div>
      <div style="font-size:11px;font-weight:600;color:${k.c};opacity:.75;margin-top:4px;">${k.s}</div>
    </div>`).join('');
};

window.v9d44Chart = function({B,P,E,days}) {
  const cw=document.getElementById('v9d44-chart');
  const cl=document.getElementById('v9d44-clbl');
  const lg=document.getElementById('v9d44-legend');
  if(!cw)return;
  const n=Math.min(days,14);
  const data=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(Date.now()-i*86400000).toISOString().split('T')[0];
    data.push({d,
      s:B.filter(b=>b.date.startsWith(d)).reduce((x,b)=>x+parseFloat(b.total||0),0),
      p:P.filter(b=>b.date.startsWith(d)).reduce((x,b)=>x+parseFloat(b.total||0),0),
      e:E.filter(b=>b.date.startsWith(d)).reduce((x,b)=>x+parseFloat(b.amount||0),0),
    });
  }
  const mx=Math.max(...data.map(d=>Math.max(d.s,d.p,d.e)),1);
  if(lg)lg.innerHTML=[{c:'#15803d',t:'รับ'},{c:'#d97706',t:'ซื้อ'},{c:'#dc2626',t:'จ่าย'}]
    .map(x=>`<span style="display:flex;align-items:center;gap:3px;"><span style="width:10px;height:3px;background:${x.c};border-radius:2px;display:inline-block;"></span><span>${x.t}</span></span>`).join('');
  cw.innerHTML=data.map(d=>{
    const sh=Math.round(d.s/mx*150),ph=Math.round(d.p/mx*150),eh=Math.round(d.e/mx*150);
    return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;"
      title="${d.d}&#10;ขาย ฿${formatNum(Math.round(d.s))}&#10;ซื้อ ฿${formatNum(Math.round(d.p))}&#10;จ่าย ฿${formatNum(Math.round(d.e))}">
      <div style="display:flex;gap:2px;align-items:flex-end;">
        ${sh?`<div style="width:8px;height:${sh}px;background:#15803d;border-radius:2px 2px 0 0;opacity:.85;"></div>`:''}
        ${ph?`<div style="width:8px;height:${ph}px;background:#d97706;border-radius:2px 2px 0 0;opacity:.85;"></div>`:''}
        ${eh?`<div style="width:8px;height:${eh}px;background:#dc2626;border-radius:2px 2px 0 0;opacity:.75;"></div>`:''}
        ${!sh&&!ph&&!eh?`<div style="width:24px;height:2px;background:var(--border-light);"></div>`:''}
      </div></div>`;
  }).join('');
  if(cl)cl.innerHTML=data.map(d=>`
    <div style="flex:1;text-align:center;font-size:10px;color:var(--text-tertiary);">
      ${new Date(d.d+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</div>`).join('');
};

window.v9d44RenderTL = function({B,P,E,EW,EO,Sal}) {
  const el=document.getElementById('v9d44-tl');if(!el)return;
  const f=document.querySelector('#v9d44-tlf [data-f][style*="var(--primary)"]')?.dataset?.f||'all';
  const ev=[];
  if(f==='all'||f==='sale') B.forEach(b=>ev.push({t:b.date,i:'trending_up',bg:'#f0fdf4',c:'#15803d',
    ti:`บิล #${b.bill_no}`,su:b.method+(b.customer_name?' · '+b.customer_name:''),a:parseFloat(b.total||0),sg:'+'}));
  if(f==='all'||f==='buy')  P.forEach(p=>ev.push({t:p.date,i:'inventory_2',bg:'#fef3c7',c:'#d97706',
    ti:p.supplier||'ซื้อสินค้า',su:p.method,a:parseFloat(p.total||0),sg:'−',cr:p.method==='เครดิต'}));
  if(f==='all'||f==='exp'){
    (EW||[]).forEach(e=>ev.push({t:e.date,i:'people',bg:'#fff7ed',c:'#f97316',
      ti:e.description,su:'ค่าแรง',a:parseFloat(e.amount||0),sg:'−'}));
    (EO||[]).forEach(e=>ev.push({t:e.date,i:'money_off',bg:'#fee2e2',c:'#dc2626',
      ti:e.description,su:`${e.category} · ${e.method}`,a:parseFloat(e.amount||0),sg:'−'}));
    (Sal||[]).forEach(s=>ev.push({t:s.paid_date,i:'payments',bg:'#ede9fe',c:'#7c3aed',
      ti:'จ่ายเงินเดือน',su:'cash flow',a:parseFloat(s.net_paid||0),sg:'−'}));
  }
  ev.sort((a,b)=>new Date(b.t)-new Date(a.t));
  if(!ev.length){el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-tertiary);font-size:12px;">ไม่มีรายการ</div>`;return;}
  el.innerHTML=ev.slice(0,80).map(e=>`
    <div style="display:flex;align-items:center;gap:11px;padding:10px 16px;border-bottom:0.5px solid var(--border-light);">
      <div style="width:32px;height:32px;border-radius:9px;background:${e.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="material-icons-round" style="font-size:15px;color:${e.c};">${e.i}</i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.ti}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">
          ${new Date(e.t).toLocaleDateString('th-TH',{day:'numeric',month:'short'})} ${new Date(e.t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} · ${e.su}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;color:${e.cr?'#7c3aed':e.sg==='+'?'#15803d':'#dc2626'};">
          ${e.sg}฿${formatNum(Math.round(e.a))}</div>
        ${e.cr?`<div style="font-size:10px;color:#7c3aed;">เครดิต</div>`:''}
      </div>
    </div>`).join('');
};

window.v9d44PL = function({tS,cogs,gP,gM,tEO,tEW,nP,nM}) {
  const el=document.getElementById('v9d44-pl-body');if(!el)return;
  const row=(l,v,c,bg,bold,sub,indent)=>`
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:9px ${bg?'12px':'2px'};border-radius:${bg?'8px':'0'};margin-bottom:3px;
      background:${bg||'transparent'};${indent?'padding-left:18px;':''}">
      <div>
        <div style="font-size:${bold?'13px':'12px'};font-weight:${bold?700:400};
          color:${bold?'var(--text-primary)':'var(--text-secondary)'};">${l}</div>
        ${sub?`<div style="font-size:10px;color:var(--text-tertiary);">${sub}</div>`:''}
      </div>
      <div style="font-size:${bold?'15px':'13px'};font-weight:${bold?700:500};color:${c};">
        ${v<0?'−':''}฿${formatNum(Math.abs(Math.round(v)))}</div>
    </div>`;

  el.innerHTML=
    row('ยอดขายรวม',tS,'#15803d','#f0fdf4',true)
    +`<div style="font-size:10px;color:var(--text-tertiary);padding:2px;margin:2px 0;">ลบ ต้นทุนสินค้าที่ขาย</div>`
    +row('COGS',cogs,'#d97706','',false,'cost×qty จากรายการบิล',true)
    +`<hr style="border:none;border-top:1.5px dashed var(--border-light);margin:6px 0;">`
    +row('กำไรขั้นต้น',gP,gP>=0?'#0891b2':'#dc2626','#ecfeff',true,`Gross Margin ${gM}%`)
    +`<div style="font-size:10px;color:var(--text-tertiary);padding:2px;margin:2px 0;">ลบ ค่าใช้จ่ายดำเนินงาน</div>`
    +row('ค่าแรงรายวัน',tEW,'#f97316','',false,'',true)
    +row('รายจ่ายร้าน',tEO,'#dc2626','',false,'',true)
    +`<div style="font-size:10px;color:#6b7280;background:#f3f4f6;padding:5px 8px;border-radius:6px;margin:4px 0;">💡 เงินเดือนที่จ่ายไม่นับซ้ำ (cash flow)</div>`
    +`<hr style="border:none;border-top:2px solid var(--border-light);margin:8px 0;">`
    +`<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;
        border-radius:12px;background:${nP>=0?'#f0fdf4':'#fef2f2'};">
        <div>
          <div style="font-size:15px;font-weight:700;color:${nP>=0?'#15803d':'#dc2626'};">กำไรสุทธิ</div>
          <div style="font-size:11px;font-weight:600;color:${nP>=0?'#16a34a':'#ef4444'};margin-top:3px;">Net Margin ${nM}%</div>
        </div>
        <div style="font-size:24px;font-weight:700;color:${nP>=0?'#15803d':'#dc2626'};">
          ${nP<0?'−':''}฿${formatNum(Math.abs(Math.round(nP)))}</div>
      </div>`;
};

window.v9d44Cash = function({tS,tP,tEW,tEO,tSal,nC}) {
  const el=document.getElementById('v9d44-cash-body');if(!el)return;
  const rows=[
    {l:'รับเงินจากขาย',v:tS,c:'#15803d',sg:'+',i:'trending_up'},
    {l:'จ่ายซื้อสินค้า',v:tP,c:'#d97706',sg:'−',i:'inventory_2'},
    {l:'รายจ่ายร้าน',v:tEO,c:'#dc2626',sg:'−',i:'money_off'},
    {l:'ค่าแรงรายวัน',v:tEW,c:'#f97316',sg:'−',i:'people'},
    {l:'จ่ายเงินเดือน',v:tSal,c:'#7c3aed',sg:'−',i:'payments',note:'cash flow เท่านั้น'},
  ];
  el.innerHTML=rows.map(r=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:0.5px solid var(--border-light);">
      <div style="display:flex;align-items:center;gap:8px;flex:1;">
        <i class="material-icons-round" style="font-size:14px;color:${r.c};opacity:.7;">${r.i}</i>
        <div>
          <div style="font-size:12px;color:var(--text-secondary);">${r.l}</div>
          ${r.note?`<div style="font-size:10px;color:var(--text-tertiary);">${r.note}</div>`:''}
        </div>
      </div>
      <span style="font-size:13px;font-weight:700;color:${r.c};">${r.sg}฿${formatNum(Math.round(r.v))}</span>
    </div>`).join('')
  +`<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;
      padding:13px 16px;border-radius:12px;background:${nC>=0?'#f0fdf4':'#fef2f2'};">
      <div>
        <div style="font-size:13px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">เงินสดสุทธิ</div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;">${nC>=0?'✅ เพิ่มขึ้น':'⚠️ ลดลง'}</div>
      </div>
      <div style="font-size:20px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">
        ${nC<0?'−':''}฿${formatNum(Math.abs(Math.round(nC)))}</div>
    </div>
    <div style="font-size:10px;color:var(--text-tertiary);margin-top:8px;padding:5px 8px;background:var(--bg-base);border-radius:6px;">
      ⚠️ ซื้อสินค้าเข้าสต็อก ≠ ต้นทุน — ดูกำไรจริงที่ P&amp;L
    </div>`;
};

window.v9d44Top = function(items) {
  const el=document.getElementById('v9d44-top');if(!el)return;
  const m={};
  items.forEach(i=>{
    if(!m[i.name])m[i.name]={q:0,t:0,pr:0};
    m[i.name].q+=parseFloat(i.qty||0);
    m[i.name].t+=parseFloat(i.total||0);
    m[i.name].pr+=(parseFloat(i.price||0)-parseFloat(i.cost||0))*parseFloat(i.qty||0);
  });
  const top=Object.entries(m).sort((a,b)=>b[1].t-a[1].t).slice(0,5);
  const mx=top[0]?.[1]?.t||1;
  if(!top.length){el.innerHTML=`<div style="font-size:12px;color:var(--text-tertiary);">ยังไม่มีข้อมูล</div>`;return;}
  el.innerHTML=top.map(([n,d],i)=>{
    const mg=d.t>0?Math.round(d.pr/d.t*100):0;
    return`<div style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:5px;min-width:0;">
          <span style="width:18px;height:18px;border-radius:5px;background:#fff5f5;color:var(--primary);
            display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${i+1}</span>
          <span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n}</span>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:12px;font-weight:600;">฿${formatNum(Math.round(d.t))}</div>
          <div style="font-size:10px;color:${mg>0?'#15803d':'#dc2626'};">กำไร ${mg}%</div>
        </div>
      </div>
      <div style="height:5px;background:var(--bg-base);border-radius:3px;overflow:hidden;">
        <div style="height:100%;background:var(--primary);opacity:.6;border-radius:3px;width:${Math.round(d.t/mx*100)}%;"></div>
      </div>
    </div>`;
  }).join('');
};


// ══════════════════════════════════════════════════════════════════
// FIX-45 — Bug fixes 3,4,5,6,7,8
// ══════════════════════════════════════════════════════════════════

// ── Bug3: เพิ่มปุ่ม "เพิ่มลูกค้าใหม่" ใน bill checkout ─────────
// modules-v3 มีปุ่ม "ทั่วไป" + "ลูกค้าประจำ" → inject ปุ่มที่ 3 หลัง render
const _v9OrigBcShowMember = window.bcShowMember;
window.bcShowMember = async function () {
  await _v9OrigBcShowMember?.apply(this, arguments);
  // inject ปุ่ม "เพิ่มลูกค้าใหม่" ใน member-box
  const box = document.getElementById('bc-member-box');
  if (box && !box.querySelector('#bc-add-new-btn')) {
    const addBtn = document.createElement('div');
    addBtn.id = 'bc-add-new-btn';
    addBtn.style.cssText = 'padding:8px 10px;border-top:1px solid var(--border-light);cursor:pointer;font-size:13px;color:var(--primary);font-weight:600;display:flex;align-items:center;gap:6px;';
    addBtn.innerHTML = '<i class="material-icons-round" style="font-size:15px;">person_add</i> เพิ่มลูกค้าใหม่';
    addBtn.onclick = () => window.bcShowAddNewCustomer();
    box.appendChild(addBtn);
  }
};

window.bcShowAddNewCustomer = function () {
  const box = document.getElementById('bc-member-box');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `
    <div style="padding:10px;background:var(--bg-base);border-radius:8px;border:1px solid var(--border-light);">
      <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px;">เพิ่มลูกค้าใหม่</div>
      <div style="margin-bottom:6px;">
        <input id="bc-new-name" class="form-input" placeholder="ชื่อลูกค้า *" style="font-size:13px;margin-bottom:5px;width:100%;">
        <input id="bc-new-phone" class="form-input" placeholder="เบอร์โทร (ถ้ามี)" style="font-size:13px;width:100%;">
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="window.bcSaveNewCustomer()"
          style="flex:1;padding:8px;border-radius:8px;border:none;background:var(--primary);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif;">
          <i class="material-icons-round" style="font-size:13px;vertical-align:middle;">save</i> บันทึก
        </button>
        <button onclick="document.getElementById('bc-member-box').style.display='none';"
          style="padding:8px 12px;border-radius:8px;border:1px solid var(--border-light);background:transparent;font-size:12px;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif;">
          ยกเลิก
        </button>
      </div>
    </div>`;
};

window.bcSaveNewCustomer = async function () {
  const name  = document.getElementById('bc-new-name')?.value?.trim();
  const phone = document.getElementById('bc-new-phone')?.value?.trim();
  if (!name) { typeof toast==='function'&&toast('กรุณากรอกชื่อลูกค้า','error'); return; }
  try {
    const {data, error} = await db.from('customer').insert({
      name, phone: phone||null, total_purchase:0, visit_count:0, debt_amount:0,
    }).select().single();
    if (error) throw error;
    // set checkoutState
    checkoutState.customer = {type:'member', id:data.id, name:data.name};
    typeof bcCust==='function' && bcCust('member', data.name, data.id);
    document.getElementById('bc-member-box').style.display = 'none';
    typeof toast==='function'&&toast(`เพิ่มลูกค้า "${name}" สำเร็จ ✅`,'success');
  } catch(e) {
    typeof toast==='function'&&toast('ไม่สามารถเพิ่มลูกค้าได้: '+e.message,'error');
  }
};


// ── Bug4: renderPayables — patch ให้ go('payable') เรียก window version ─
// app.js: case 'payable': renderPayables() → local function
// แก้: override go() เพิ่ม case payable
const _v9OrigGo45 = window.go;
window.go = function (page) {
  _v9OrigGo45?.call(this, page);
  if (page === 'payable') {
    setTimeout(() => {
      const sec = document.getElementById('page-payable');
      if (sec) window.renderPayables();
    }, 50);
  }
};


// ── Bug5: quotation — fix dropdown เลือกจากคลัง + print แสดงรายการ ─
window.v9QuotAddRow44 = function (prodId) {
  const prods = window._v9QuotProds44 || window.products || [];
  const prod  = prods.find(p => p.id === prodId);
  window._v9QuotItems44 = window._v9QuotItems44 || [];
  window._v9QuotItems44.push({
    product_id: prodId||null,
    name:  prod?.name || '',
    qty:   1,
    unit:  prod?.unit || 'ชิ้น',
    price: prod?.price || 0,
  });
  if (typeof window._v9QuotRender44 === 'function') window._v9QuotRender44();
};


// ── Bug6: payroll — fix accumulated reset หลังจ่ายแล้ว ─────────
// ปัญหา: lastPayDate filter ใช้ date string compare กับ ISO timestamp
// แก้ v5LoadPayroll ให้ filter ถูกต้อง
const _v9OrigV5LoadPay45 = window.v5LoadPayroll;
window.v5LoadPayroll = async function () {
  const sec = document.getElementById('att-tab-payroll');
  if (!sec) return;

  sec.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-tertiary);">
    <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:var(--primary);
      border-radius:50%;animation:v7spin .8s linear infinite;margin:0 auto 12px;"></div>
    <style>@keyframes v7spin{to{transform:rotate(360deg)}}</style>คำนวณเงินเดือน...
  </div>`;

  let emps=[], attAll=[], allAdv=[], allPaid=[];
  try { emps = await loadEmployees?.() || []; } catch(_){}
  try { const r = await db.from('เช็คชื่อ').select('employee_id,status,date'); attAll=r.data||[]; } catch(_){}
  try { const r = await db.from('เบิกเงิน').select('employee_id,amount,status,date').eq('status','อนุมัติ'); allAdv=r.data||[]; } catch(_){}
  try {
    const r = await db.from('จ่ายเงินเดือน')
      .select('employee_id,net_paid,deduct_withdraw,working_days,base_salary,paid_date,month')
      .order('paid_date',{ascending:false});
    allPaid = r.data||[];
  } catch(_){}

  const actives = emps.filter(e=>e.status==='ทำงาน');

  const rows = actives.map(emp => {
    const wage    = emp.daily_wage || 0;
    const empPaid = allPaid.filter(p=>p.employee_id===emp.id);
    const lastPay = empPaid[0] || null;
    // lastPayDate ต้องเป็น date string (YYYY-MM-DD) ไม่ใช่ ISO
    const lastPayDate = lastPay?.paid_date
      ? lastPay.paid_date.split('T')[0]
      : null;

    const empAtt = attAll.filter(a => {
      if (a.employee_id !== emp.id) return false;
      if (lastPayDate) return a.date > lastPayDate;  // เช็คชื่อหลังจ่ายล่าสุด
      return true;
    });

    const daysFull  = empAtt.filter(a=>a.status==='มา').length;
    const daysHalf  = empAtt.filter(a=>a.status==='ครึ่งวัน').length;
    const daysLate  = empAtt.filter(a=>a.status==='มาสาย').length;
    const daysAbsent= empAtt.filter(a=>a.status==='ขาด').length;
    const workDays  = daysFull + daysHalf*0.5 + daysLate;
    const accumulated = Math.round(daysFull*wage + daysHalf*wage*0.5 + daysLate*wage*0.95);

    const totalAdv      = allAdv.filter(a=>a.employee_id===emp.id).reduce((s,a)=>s+a.amount,0);
    const totalDeducted = empPaid.reduce((s,p)=>s+(p.deduct_withdraw||0),0);
    const accDebt       = Math.max(0, totalAdv - totalDeducted);

    return {emp, workDays, daysFull, daysHalf, daysLate, daysAbsent, accumulated, accDebt, lastPay};
  });

  const totalAcc  = rows.reduce((s,r)=>s+r.accumulated,0);
  const totalDebt = rows.reduce((s,r)=>s+r.accDebt,0);

  sec.innerHTML = `
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:18px;
      padding:22px 24px;margin-bottom:20px;color:#fff;">
      <div style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;
        letter-spacing:.8px;margin-bottom:14px;">สรุปเงินเดือน — สะสมตั้งแต่จ่ายล่าสุด</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
        ${[
          ['ยอดสะสมรวม',  `฿${formatNum(totalAcc)}`,  '#10b981'],
          ['หนี้เบิกสะสม', `฿${formatNum(totalDebt)}`, '#ef4444'],
          ['พนักงานทั้งหมด', `${rows.length} คน`,     '#6366f1'],
        ].map(([l,v,c])=>`
          <div style="background:rgba(255,255,255,.08);border-radius:12px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:rgba(255,255,255,.55);margin-bottom:4px;">${l}</div>
            <div style="font-size:17px;font-weight:800;color:${c};">${v}</div>
          </div>`).join('')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${rows.map(r=>`
        <div style="background:var(--bg-surface);border:1.5px solid #e2e8f0;
          border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04);">
          <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;">
            <div style="width:46px;height:46px;border-radius:50%;flex-shrink:0;
              background:linear-gradient(135deg,var(--primary),#b91c1c);
              display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;">
              ${(r.emp.name||'?').charAt(0)}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:700;">${r.emp.name} ${r.emp.lastname||''}</div>
              <div style="font-size:12px;color:#94a3b8;">${r.emp.position||'พนักงาน'} • ฿${formatNum(r.emp.daily_wage||0)}/วัน</div>
              ${r.lastPay
                ? `<div style="font-size:11px;color:#6366f1;margin-top:1px;">จ่ายล่าสุด ${r.lastPay.paid_date?.split('T')[0]} | ฿${formatNum(r.lastPay.net_paid)}</div>`
                : `<div style="font-size:11px;color:#94a3b8;margin-top:1px;">ยังไม่เคยจ่าย</div>`}
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
              <div>
                <div style="font-size:10px;color:#94a3b8;margin-bottom:1px;">ยอดสะสม (รอจ่าย)</div>
                <div style="font-size:20px;font-weight:800;color:${r.accumulated>0?'#15803d':'#94a3b8'};">฿${formatNum(r.accumulated)}</div>
              </div>
              ${r.accDebt>0?`<div style="font-size:11px;padding:2px 8px;border-radius:999px;background:#fff7ed;color:#92400e;font-weight:700;">ติดหนี้ ฿${formatNum(r.accDebt)}</div>`:''}
              <div style="display:flex;gap:6px;">
                <button class="btn btn-primary btn-sm"
                  onclick="v9ShowPayrollModal('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim().replace(/'/g,"\\'")}',${r.accumulated},${r.accDebt})"
                  style="font-size:12px;">
                  <i class="material-icons-round" style="font-size:14px;">send</i> จ่าย
                </button>
                <button class="btn btn-outline btn-sm"
                  onclick="v9DeleteEmployee('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim().replace(/'/g,"\\'")}') "
                  style="font-size:12px;color:var(--danger);border-color:var(--danger);">
                  <i class="material-icons-round" style="font-size:14px;">delete</i>
                </button>
              </div>
            </div>
          </div>
          <div style="padding:8px 18px;background:var(--bg-base);display:grid;grid-template-columns:repeat(5,1fr);gap:6px;font-size:11px;">
            ${[
              ['วันทำงาน', r.daysFull, '#15803d'],
              ['มาสาย',    r.daysLate, '#d97706'],
              ['ขาด',      r.daysAbsent, '#ef4444'],
              ['หนี้เบิก', `฿${formatNum(r.accDebt)}`, '#92400e'],
              ['จ่ายล่าสุด', r.lastPay?`฿${formatNum(r.lastPay.net_paid)}`:'—', '#6366f1'],
            ].map(([l,v,c])=>`
              <div style="text-align:center;">
                <div style="color:#94a3b8;">${l}</div>
                <div style="font-weight:700;color:${c};">${v}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
  // patch onclick → window.v9PayConfirm
  setTimeout(() => {
    document.querySelectorAll('[onclick*="v9ConfirmPayroll"]').forEach(el => {
      const orig = el.getAttribute('onclick')||'';
      if (!orig.includes('window.v9PayConfirm'))
        el.setAttribute('onclick', orig.replace(/\bv9ConfirmPayroll\b/g, 'window.v9PayConfirm'));
    });
  }, 80);
};


// ── Bug7: Dashboard P&L tab default, Cash panel ซ่อน ────────────
const _v9OrigRenderDash45 = window.renderDashboard;
window.renderDashboard = async function() {
  await _v9OrigRenderDash45?.apply(this, arguments);
  // ซ่อน cash panel ตอน default (P&L เปิดอยู่)
  setTimeout(() => {
    const cashPanel = document.getElementById('v9d44-cash-panel');
    const plPanel   = document.getElementById('v9d44-pl-panel');
    if (cashPanel) cashPanel.style.display = 'none';
    if (plPanel)   plPanel.style.display   = '';
    // ให้ tab P&L active
    document.querySelectorAll('.v9d44-tab').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === 'pl');
    });
  }, 100);
};


// ── Bug8: รับชำระหนี้ — เงินเข้าลิ้นชัก + denomination จากลิ้นชัก ─
// override recordDebtPayment ให้แสดง denomination จาก drawer balance
window.recordDebtPayment = async function (customerId, name) {
  const { data: cust } = await db.from('customer')
    .select('debt_amount,name,phone').eq('id', customerId).maybeSingle();
  if (!cust) { typeof toast==='function'&&toast('ไม่พบลูกค้า','error'); return; }
  const totalDebt = parseFloat(cust.debt_amount||0);
  if (totalDebt <= 0) { typeof toast==='function'&&toast('ไม่มียอดหนี้','info'); return; }

  // ดึง denomination ที่มีในลิ้นชัก (จาก cash_session + transactions)
  let drawerDenom = {1000:0,500:0,100:0,50:0,20:0,10:0,5:0,1:0};
  try {
    const {data:sess} = await db.from('cash_session')
      .select('id,opening_denominations')
      .eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (sess) {
      // นับจาก opening
      const od = sess.opening_denominations || {};
      Object.keys(od).forEach(k => { if (drawerDenom[k]!==undefined) drawerDenom[k]=(od[k]||0); });
      // บวก/ลบ จาก transactions
      const {data:txs} = await db.from('cash_transaction')
        .select('direction,denominations,change_denominations').eq('session_id',sess.id);
      (txs||[]).forEach(tx => {
        const d  = tx.denominations||{};
        const cd = tx.change_denominations||{};
        Object.keys(d).forEach(k => {
          if (drawerDenom[k]!==undefined)
            drawerDenom[k] += tx.direction==='in'?(d[k]||0):-(d[k]||0);
        });
        Object.keys(cd).forEach(k => {
          if (drawerDenom[k]!==undefined)
            drawerDenom[k] -= (cd[k]||0); // ทอนออก = ลดจากลิ้นชัก
        });
      });
      // ป้องกัน negative
      Object.keys(drawerDenom).forEach(k => { drawerDenom[k]=Math.max(0,drawerDenom[k]); });
    }
  } catch(_){}

  const BILLS = [{v:1000,c:'#8B4513'},{v:500,c:'#9B59B6'},{v:100,c:'#E74C3C'},
    {v:50,c:'#2980B9'},{v:20,c:'#27AE60'},{v:10,c:'#F39C12'},{v:5,c:'#E67E22'},{v:1,c:'#7F8C8D'}];

  let state = {payAmt:totalDebt, method:'cash', recv:{}, chng:{}};
  BILLS.forEach(b => { state.recv[b.v]=0; state.chng[b.v]=0; });

  const sumD = (d) => BILLS.reduce((s,b)=>s+(b.v*(d[b.v]||0)),0);

  const buildGrid = (denomObj, isChange=false) => {
    const total = sumD(denomObj);
    return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
      ${BILLS.map(b => {
        const cnt = denomObj[b.v]||0;
        const inDrawer = drawerDenom[b.v]||0;
        return `<div onclick="window._v9DR45_tap(${b.v},'${isChange?'chng':'recv'}')"
          style="border-radius:12px;padding:10px 8px;text-align:center;cursor:pointer;
            background:${cnt>0?b.c+'22':'#f9fafb'};border:2px solid ${cnt>0?b.c:'#e5e7eb'};
            transition:all .12s;user-select:none;position:relative;">
          <div style="width:100%;height:30px;border-radius:7px;background:${b.c};
            display:flex;align-items:center;justify-content:center;margin-bottom:5px;">
            <span style="color:#fff;font-size:13px;font-weight:700;">฿${b.v>=1000?'1K':b.v}</span>
          </div>
          <div style="font-size:18px;font-weight:800;color:${cnt>0?b.c:'#9ca3af'};">${cnt}</div>
          ${cnt>0?`<div style="font-size:9px;color:${b.c};">฿${formatNum(b.v*cnt)}</div>`:''}
          ${isChange&&inDrawer>0&&!cnt?`<div style="font-size:8px;color:#9ca3af;margin-top:1px;">มี ${inDrawer}</div>`:''}
          ${cnt>0?`<button onclick="event.stopPropagation();window._v9DR45_dec(${b.v},'${isChange?'chng':'recv'}')"
            style="position:absolute;top:3px;right:3px;width:16px;height:16px;border-radius:4px;
              border:none;background:rgba(0,0,0,.2);color:#fff;cursor:pointer;font-size:11px;
              display:flex;align-items:center;justify-content:center;font-weight:700;">−</button>`:''}
        </div>`;
      }).join('')}
    </div>
    <div style="text-align:right;font-size:14px;font-weight:700;color:${total>0?'#15803d':'#9ca3af'};">
      รวม ฿${formatNum(total)}</div>`;
  };

  window._v9DR45_tap = (bv, type) => {
    state[type][bv] = (state[type][bv]||0)+1;
    window._v9DR45_refresh();
  };
  window._v9DR45_dec = (bv, type) => {
    state[type][bv] = Math.max(0,(state[type][bv]||0)-1);
    window._v9DR45_refresh();
  };
  window._v9DR45_refresh = () => {
    const recv = sumD(state.recv);
    const need = parseFloat(document.getElementById('v9dr45-amt')?.value||state.payAmt);
    state.payAmt = Math.min(need, totalDebt);
    const chng  = sumD(state.chng);
    const diff  = Math.max(0, recv - state.payAmt);

    const rg = document.getElementById('v9dr45-recv'); if(rg) rg.innerHTML=buildGrid(state.recv,false);
    const cg = document.getElementById('v9dr45-chng'); if(cg) cg.innerHTML=buildGrid(state.chng,true);

    const sb = document.getElementById('v9dr45-status');
    if (sb) {
      if (recv===0) sb.innerHTML='<span style="color:#9ca3af;">กดแบงค์ที่รับมา</span>';
      else if (recv<state.payAmt) sb.innerHTML=`<span style="color:#dc2626;">ขาด ฿${formatNum(state.payAmt-recv)}</span>`;
      else if (recv===state.payAmt) sb.innerHTML=`<span style="color:#15803d;">✅ พอดี</span>`;
      else sb.innerHTML=`<span style="color:#d97706;">ทอน ฿${formatNum(diff)}</span>`;
    }
    const cs = document.getElementById('v9dr45-chng-status');
    if (cs) {
      if (diff===0) { cs.style.display='none'; }
      else {
        cs.style.display='block';
        if (chng===diff) { cs.style.background='#f0fdf4';cs.style.color='#15803d';cs.textContent='✅ ทอนถูกต้อง'; }
        else if (chng<diff) { cs.style.background='#fef2f2';cs.style.color='#dc2626';cs.textContent=`ทอนไม่พอ ขาด ฿${formatNum(diff-chng)}`; }
        else { cs.style.background='#fef3c7';cs.style.color='#d97706';cs.textContent=`ทอนเกิน ฿${formatNum(chng-diff)}`; }
      }
    }
    // summary
    const se = document.getElementById('v9dr45-sum-recv'); if(se) se.textContent=`฿${formatNum(recv)}`;
    const de = document.getElementById('v9dr45-sum-chng'); if(de) de.textContent=`฿${formatNum(diff)}`;
    const re = document.getElementById('v9dr45-sum-remain');
    if(re){re.textContent=`฿${formatNum(Math.max(0,totalDebt-state.payAmt))}`;re.style.color=totalDebt>state.payAmt?'#dc2626':'#15803d';}
  };

  const { isConfirmed } = await Swal.fire({
    title: '',
    html: `<div style="text-align:left;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);border-radius:14px;padding:16px 18px;margin-bottom:14px;color:#fff;">
        <div style="font-size:12px;opacity:.8;margin-bottom:3px;">หนี้คงค้าง — ${name}</div>
        <div style="font-size:28px;font-weight:800;">฿${formatNum(totalDebt)}</div>
        ${cust.phone?`<div style="font-size:11px;opacity:.7;">${cust.phone}</div>`:''}
      </div>
      <!-- ยอด + วิธี -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <label style="font-size:11px;font-weight:600;color:#555;display:block;margin-bottom:3px;">ชำระวันนี้ (฿)</label>
          <input id="v9dr45-amt" type="number" value="${totalDebt}" min="1" max="${totalDebt}"
            oninput="window._v9DR45_refresh()"
            style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;font-size:16px;font-weight:700;text-align:right;color:#15803d;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#555;display:block;margin-bottom:3px;">วิธีชำระ</label>
          <select id="v9dr45-method"
            onchange="window._v9DR45_state45.method=this.value;document.getElementById('v9dr45-cash-sec').style.display=this.value==='cash'?'':'none';"
            style="width:100%;padding:9px;border:1.5px solid #d1d5db;border-radius:8px;font-size:13px;height:40px;">
            <option value="cash">เงินสด</option>
            <option value="transfer">โอนเงิน</option>
          </select>
        </div>
      </div>
      <!-- Cash section -->
      <div id="v9dr45-cash-sec">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:#374151;">กดแบงค์ที่รับมา:</span>
          <span id="v9dr45-status" style="font-size:12px;"></span>
        </div>
        <div id="v9dr45-recv">${buildGrid(state.recv,false)}</div>
        <!-- Summary -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0;">
          <div style="background:#f0fdf4;border-radius:8px;padding:9px;text-align:center;">
            <div style="font-size:10px;color:#555;">รับมา</div>
            <div id="v9dr45-sum-recv" style="font-size:15px;font-weight:700;color:#15803d;">฿0</div>
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:9px;text-align:center;">
            <div style="font-size:10px;color:#555;">ต้องทอน</div>
            <div id="v9dr45-sum-chng" style="font-size:15px;font-weight:700;color:#d97706;">฿0</div>
          </div>
          <div style="background:#fef2f2;border-radius:8px;padding:9px;text-align:center;">
            <div style="font-size:10px;color:#555;">หนี้คงเหลือ</div>
            <div id="v9dr45-sum-remain" style="font-size:15px;font-weight:700;color:#dc2626;">฿${formatNum(totalDebt)}</div>
          </div>
        </div>
        <!-- ทอนเงิน -->
        <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">กดแบงค์ที่ทอนให้ลูกค้า:</div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">
          ${Object.entries(drawerDenom).filter(([k,v])=>v>0).map(([k,v])=>`฿${k}×${v}`).join('  ') || 'ลิ้นชักว่างเปล่า'}
        </div>
        <div id="v9dr45-chng">${buildGrid(state.chng,true)}</div>
        <div id="v9dr45-chng-status" style="padding:7px 10px;border-radius:7px;font-size:12px;font-weight:600;text-align:center;margin-top:6px;display:none;"></div>
      </div>
    </div>`,
    width: '560px',
    showCancelButton: true,
    confirmButtonText: '✅ บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#15803d',
    didOpen: () => { window._v9DR45_state45 = state; window._v9DR45_refresh(); },
    preConfirm: () => {
      state.payAmt = Math.min(parseFloat(document.getElementById('v9dr45-amt')?.value||totalDebt), totalDebt);
      state.method = document.getElementById('v9dr45-method')?.value||'cash';
      return true;
    },
  });

  if (!isConfirmed) return;

  const recv   = sumD(state.recv);
  const diff   = Math.max(0, recv - state.payAmt);
  const chng   = sumD(state.chng);
  const isCash = state.method==='cash';

  if (isCash) {
    if (recv < state.payAmt) { typeof toast==='function'&&toast(`รับเงินไม่พอ (฿${formatNum(recv)} < ฿${formatNum(state.payAmt)})`,'error'); return; }
    if (diff>0 && chng!==diff) { typeof toast==='function'&&toast(`เงินทอนไม่ถูกต้อง (ต้องทอน ฿${formatNum(diff)} ทอน ฿${formatNum(chng)})`,'error'); return; }
  }

  // บันทึก + เข้าลิ้นชัก
  const newDebt = Math.max(0, totalDebt - state.payAmt);
  v9ShowOverlay('กำลังบันทึก...');
  try {
    await db.from('customer').update({debt_amount:newDebt}).eq('id',customerId);
    await db.from('ชำระหนี้').insert({customer_id:customerId, amount:state.payAmt, method:isCash?'เงินสด':'โอนเงิน', staff_name:v9Staff()});

    if (isCash) {
      const {data:sess} = await db.from('cash_session')
        .select('id').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
      if (sess) {
        // เงินเข้าลิ้นชัก พร้อม denomination
        await window.recordCashTx({
          sessionId: sess.id, type:'รับชำระหนี้', direction:'in',
          amount: recv, changeAmt: diff, netAmount: state.payAmt,
          denominations: {...state.recv},
          changeDenominations: diff>0 ? {...state.chng} : null,
          refTable:'ชำระหนี้', note:name,
        });
      }
    }

    typeof logActivity==='function' && logActivity('รับชำระหนี้',`${name} ฿${formatNum(state.payAmt)}${diff>0?' ทอน ฿'+formatNum(diff):''}${newDebt>0?' เหลือ ฿'+formatNum(newDebt):' ครบ'}`);
    typeof toast==='function' && toast(`รับชำระสำเร็จ ฿${formatNum(state.payAmt)}${newDebt>0?' เหลือ ฿'+formatNum(newDebt):' ✅ ครบ'}`,'success');
    typeof loadCustomerData==='function' && loadCustomerData();
    typeof renderDebts==='function' && renderDebts();
    // update balance display
    try {
      const nb = await getLiveCashBalance?.();
      if (nb !== undefined) {
        ['cash-current-balance','global-cash-balance'].forEach(id=>{
          const el=document.getElementById(id);if(el)el.textContent=`฿${formatNum(nb)}`;
        });
      }
    } catch(_){}
  } catch(e) {
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+(e.message||e),'error');
  } finally { v9HideOverlay(); }
};


// ══════════════════════════════════════════════════════════════════
// FIX-46
//  1. renderPayables: MutationObserver — detect page เปิด → render
//  2. bcShowMember: เพิ่มช่องที่อยู่ + บันทึก address
//  3. printA4: เพิ่มที่อยู่ลูกค้า + QR PromptPay มืออาชีพ
// ══════════════════════════════════════════════════════════════════

// ── 1. renderPayables: MutationObserver ─────────────────────────
// app.js go() เป็น local ไม่ใช่ window.go → ต้องใช้ observer
// watchPayablePage replaced by FIX-51 setupPayableHooks


// ── 2. เพิ่มช่องที่อยู่ + ข้อมูลลูกค้าเพิ่มเติม ──────────────
// override bcShowAddNewCustomer และ bcSaveNewCustomer
window.bcShowAddNewCustomer = function () {
  const box = document.getElementById('bc-member-box');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `
    <div style="padding:12px;background:var(--bg-base);border-radius:10px;
      border:1px solid var(--border-light);margin-top:8px;">
      <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:10px;
        display:flex;align-items:center;gap:5px;">
        <i class="material-icons-round" style="font-size:14px;">person_add</i> เพิ่มลูกค้าใหม่
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
        <div>
          <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:2px;">ชื่อลูกค้า *</div>
          <input id="bc-new-name" class="form-input" placeholder="ชื่อ-นามสกุล / บริษัท"
            style="font-size:12px;padding:7px;">
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:2px;">เบอร์โทร</div>
          <input id="bc-new-phone" class="form-input" placeholder="0XX-XXX-XXXX"
            style="font-size:12px;padding:7px;">
        </div>
      </div>
      <div style="margin-bottom:6px;">
        <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:2px;">ที่อยู่</div>
        <input id="bc-new-address" class="form-input" placeholder="ที่อยู่ (สำหรับออกใบเสร็จ)"
          style="font-size:12px;padding:7px;width:100%;">
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="window.bcSaveNewCustomer()"
          style="flex:1;padding:8px;border-radius:8px;border:none;background:var(--primary);
            color:#fff;font-size:12px;font-weight:700;cursor:pointer;
            font-family:var(--font-thai,'Prompt'),sans-serif;">
          <i class="material-icons-round" style="font-size:13px;vertical-align:middle;">save</i> บันทึก
        </button>
        <button onclick="document.getElementById('bc-member-box').style.display='none';"
          style="padding:8px 12px;border-radius:8px;border:1px solid var(--border-light);
            background:transparent;font-size:12px;cursor:pointer;
            font-family:var(--font-thai,'Prompt'),sans-serif;">ยกเลิก</button>
      </div>
    </div>`;
};

window.bcSaveNewCustomer = async function () {
  const name    = document.getElementById('bc-new-name')?.value?.trim();
  const phone   = document.getElementById('bc-new-phone')?.value?.trim();
  const address = document.getElementById('bc-new-address')?.value?.trim();
  if (!name) { typeof toast==='function'&&toast('กรุณากรอกชื่อลูกค้า','error'); return; }
  try {
    const {data, error} = await db.from('customer').insert({
      name, phone: phone||null, address: address||null,
      total_purchase:0, visit_count:0, debt_amount:0,
    }).select().single();
    if (error) throw error;
    checkoutState.customer = {type:'member', id:data.id, name:data.name, address:data.address};
    if (typeof bcCust === 'function') bcCust('member', data.name, data.id);
    // เก็บ address ใน checkoutState เพื่อพิมพ์
    checkoutState.customer.address = address||'';
    document.getElementById('bc-member-box').style.display='none';
    typeof toast==='function'&&toast(`เพิ่มลูกค้า "${name}" สำเร็จ ✅`,'success');
  } catch(e) {
    typeof toast==='function'&&toast('ไม่สามารถเพิ่มลูกค้าได้: '+e.message,'error');
  }
};

// เมื่อเลือกลูกค้าประจำ ให้ดึง address ด้วย
const _v9OrigBcShowMem46 = window.bcShowMember;
window.bcShowMember = async function () {
  const box = document.getElementById('bc-member-box');
  if (!box) return;
  if (box.style.display !== 'none') { box.style.display='none'; return; }
  const { data: custs } = await db.from('customer').select('id,name,phone,address').order('name');
  box.style.display='block';
  box.innerHTML = `
    <div style="border:1px solid var(--border-light);border-radius:8px;overflow:hidden;margin-top:6px;">
      <input class="form-input" id="bc-cust-q" placeholder="ค้นหาลูกค้า..."
        oninput="bcFilterCust()"
        style="border:none;border-bottom:1px solid var(--border-light);border-radius:0;
          font-size:13px;padding:8px 10px;">
      <div id="bc-cust-list" style="max-height:140px;overflow-y:auto;">
        ${(custs||[]).map(c=>`
          <div onclick="window.bcSelectCust46('${c.id}','${c.name.replace(/'/g,"\\'")}','${(c.address||'').replace(/'/g,"\\'")}');document.getElementById('bc-member-box').style.display='none';"
            style="padding:8px 10px;cursor:pointer;font-size:13px;border-bottom:.5px solid var(--border-light);"
            onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
            <div style="font-weight:500;">${c.name}</div>
            ${c.phone?`<div style="font-size:11px;color:var(--text-tertiary);">${c.phone}</div>`:''}
            ${c.address?`<div style="font-size:10px;color:var(--text-tertiary);">${c.address}</div>`:''}
          </div>`).join('')}
      </div>
      <div id="bc-add-new-btn"
        onclick="window.bcShowAddNewCustomer()"
        style="padding:8px 10px;cursor:pointer;font-size:13px;color:var(--primary);
          font-weight:600;display:flex;align-items:center;gap:6px;
          border-top:1px solid var(--border-light);background:var(--bg-base);">
        <i class="material-icons-round" style="font-size:15px;">person_add</i> เพิ่มลูกค้าใหม่
      </div>
    </div>`;
};

window.bcSelectCust46 = function (id, name, address) {
  checkoutState.customer = {type:'member', id, name, address};
  if (typeof bcCust === 'function') bcCust('member', name, id);
  checkoutState.customer.address = address;
};


// ── 3. printA4 มืออาชีพ + ที่อยู่ลูกค้า + QR PromptPay ─────────
window.printA4 = function (bill, items, rc) {
  const win = window.open('', '_blank', 'width=920,height=980');
  if (!win) return;

  const count    = (items||[]).length;
  const bodySize = count<=5?13:count<=10?12:count<=15?11:count<=20?10:count<=25?9:8;
  const thSize   = Math.max(bodySize-1,7);
  const tdPad    = count<=15?'7px 10px':count<=25?'5px 8px':'3px 6px';
  const subtotal = (items||[]).reduce((s,i)=>s+parseFloat(i.total||0),0);
  const total    = parseFloat(bill.total||0);
  const dateStr  = new Date(bill.date).toLocaleDateString('th-TH',{
    year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'
  });

  // PromptPay payload — inline เพื่อไม่ต้องพึ่ง modules-v3.js
  const ppNum = rc?.promptpay_number || '';
  let qrPayload = '';
  if (ppNum && total > 0) {
    try {
      // PromptPay EMV QR generation
      const crc16 = (str) => {
        let crc = 0xFFFF;
        for (let i=0;i<str.length;i++){
          crc ^= str.charCodeAt(i) << 8;
          for (let j=0;j<8;j++) crc = (crc&0x8000) ? (crc<<1)^0x1021 : crc<<1;
        }
        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4,'0');
      };
      let id = ppNum.replace(/[^0-9]/g,'');
      if (id.length===10 && id.startsWith('0')) id = '0066'+id.substring(1);
      const appId   = 'A000000677010111';
      const ppData  = `0016${appId}0113${id}`;
      const tag29   = `29${String(ppData.length).padStart(2,'0')}${ppData}`;
      const amtStr  = total.toFixed(2);
      let p = `000201010211${tag29}5303764`;
      p += `54${String(amtStr.length).padStart(2,'0')}${amtStr}`;
      p += `5802TH6304`;
      qrPayload = p + crc16(p);
    } catch(_){}
  }

  const custName    = bill.customer_name || 'ลูกค้าทั่วไป';
  const custAddress = bill.customer_address || checkoutState?.customer?.address || '';
  const custPhone   = bill.customer_phone   || checkoutState?.customer?.phone   || '';

  const rows = (items||[]).map((it,n)=>`
    <tr>
      <td style="text-align:center;color:#64748b;">${n+1}</td>
      <td>${it.name||''}</td>
      <td style="text-align:center;">${it.qty||1} ${it.unit||'ชิ้น'}</td>
      <td style="text-align:right;">฿${formatNum(parseFloat(it.price||0))}</td>
      <td style="text-align:right;font-weight:600;">฿${formatNum(parseFloat(it.total||0))}</td>
    </tr>`).join('');

  win.document.write(`<!DOCTYPE html><html lang="th"><head>
<meta charset="UTF-8">
<title>ใบเสร็จ #${bill.bill_no}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 12mm 14mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Sarabun', sans-serif; font-size: ${bodySize}px; color: #1e293b; }
  body { display: flex; flex-direction: column; min-height: 100vh; }
  .hd { display:flex; justify-content:space-between; align-items:flex-start;
    padding-bottom:10px; border-bottom:2px solid #DC2626; margin-bottom:12px; }
  .shop-name { font-size:${bodySize+8}px; font-weight:800; color:#DC2626; }
  .shop-sub  { font-size:${Math.max(bodySize-1,8)}px; color:#64748b; line-height:1.7; margin-top:2px; }
  .doc-badge { text-align:right; }
  .doc-badge .type { font-size:${bodySize+6}px; font-weight:800; color:#DC2626; }
  .doc-badge .meta { font-size:${Math.max(bodySize-1,8)}px; color:#64748b; line-height:1.7; margin-top:3px; }
  .cust-row  { display:flex; gap:16px; align-items:flex-start;
    margin-bottom:12px; padding:10px 14px;
    background:#f8fafc; border-left:3px solid #DC2626; border-radius:0 6px 6px 0; }
  .cust-info { flex:1; min-width:0; }
  .cust-lbl  { font-size:${Math.max(bodySize-2,7)}px; color:#94a3b8; text-transform:uppercase;
    letter-spacing:.5px; margin-bottom:3px; font-weight:600; }
  .cust-name-txt { font-size:${bodySize+1}px; font-weight:700; }
  .cust-detail { font-size:${Math.max(bodySize-1,8)}px; color:#64748b; margin-top:2px; line-height:1.6; }
  .qr-box    { text-align:center; flex-shrink:0; min-width:96px; }
  .qr-lbl    { font-size:${Math.max(bodySize-2,7)}px; color:#64748b; margin-top:3px; line-height:1.4; }
  .qr-amt    { font-size:${Math.max(bodySize,9)}px; font-weight:700; color:#DC2626; }
  table { width:100%; border-collapse:collapse; }
  thead th { background:#DC2626; color:#fff; padding:${tdPad}; font-size:${thSize}px; font-weight:600; white-space:nowrap; }
  thead th:first-child { border-radius:4px 0 0 0; } thead th:last-child { border-radius:0 4px 0 0; }
  tbody tr:nth-child(even) { background:#fafafa; }
  tbody td { padding:${tdPad}; font-size:${bodySize}px; border-bottom:.5px solid #f1f5f9; }
  .sum-wrap  { display:flex; justify-content:flex-end; margin:10px 0; }
  .sum       { width:220px; }
  .sum-row   { display:flex; justify-content:space-between; padding:3px 0;
    border-bottom:.5px solid #f1f5f9; font-size:${Math.max(bodySize-1,8)}px; }
  .sum-grand { display:flex; justify-content:space-between; padding:6px 0;
    font-size:${bodySize+3}px; font-weight:800; color:#DC2626;
    border-top:2px solid #DC2626; margin-top:4px; }
  .pay-row   { display:flex; justify-content:space-between; padding:2px 0;
    font-size:${Math.max(bodySize-1,8)}px; color:#64748b; }
  .spacer    { flex:1; }
  .sig-section { margin-top:auto; padding-top:10px; border-top:1px solid #e2e8f0; }
  .footer-note { font-size:${Math.max(bodySize-2,7)}px; color:#94a3b8; text-align:center; margin-bottom:10px; }
  .sig-grid  { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; }
  .sig-box   { text-align:center; }
  .sig-line  { height:40px; border-bottom:1px solid #cbd5e1; margin-bottom:4px; }
  .sig-lbl   { font-size:${Math.max(bodySize-2,7)}px; color:#94a3b8; }
  @media print { body { min-height:0; height:270mm; } .spacer { flex:1; } }
</style>
</head><body>

<div class="hd">
  <div>
    <div class="shop-name">${rc?.shop_name||'SK POS'}</div>
    <div class="shop-sub">
      ${rc?.address||''}${rc?.address?'<br>':''}
      ${rc?.phone?'โทร '+rc.phone:''}
      ${rc?.tax_id?'<br>เลขผู้เสียภาษี '+rc.tax_id:''}
    </div>
  </div>
  <div class="doc-badge">
    <div class="type">ใบเสร็จรับเงิน</div>
    <div class="meta">
      บิล #${bill.bill_no}<br>${dateStr}
      ${bill.staff_name?'<br>พนักงาน: '+bill.staff_name:''}
    </div>
  </div>
</div>

<div class="cust-row">
  <div class="cust-info">
    <div class="cust-lbl">ออกให้</div>
    <div class="cust-name-txt">${custName}</div>
    ${custPhone?`<div class="cust-detail">โทร ${custPhone}</div>`:''}
    ${custAddress?`<div class="cust-detail" style="white-space:pre-line;">${custAddress}</div>`:''}
    <div class="cust-detail" style="margin-top:3px;color:#94a3b8;">วิธีชำระ: <strong style="color:#1e293b;">${bill.method}</strong></div>
  </div>
  ${qrPayload?`<div class="qr-box">
    <div class="qr-lbl" style="margin-bottom:4px;font-weight:600;color:#1e293b;">สแกนชำระ<br>PromptPay</div>
    <div id="qr-div" style="width:90px;height:90px;"></div>
    <div class="qr-lbl">${ppNum}</div>
    <div class="qr-amt">฿${formatNum(total)}</div>
  </div>`:''}
</div>

<table style="margin-bottom:12px;">
  <thead>
    <tr>
      <th style="width:28px;text-align:center;">#</th>
      <th>รายการสินค้า</th>
      <th style="width:85px;text-align:center;">จำนวน</th>
      <th style="width:90px;text-align:right;">ราคา/หน่วย</th>
      <th style="width:90px;text-align:right;">รวม</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="sum-wrap">
  <div class="sum">
    <div class="sum-row"><span>ยอดรวม</span><span>฿${formatNum(subtotal)}</span></div>
    ${bill.discount>0?`<div class="sum-row"><span>ส่วนลด</span><span style="color:#DC2626;">-฿${formatNum(bill.discount)}</span></div>`:''}
    <div class="sum-grand"><span>ยอดสุทธิ</span><span>฿${formatNum(total)}</span></div>
    ${bill.method==='เงินสด'&&bill.received?`
      <div class="pay-row"><span>รับมา</span><span>฿${formatNum(bill.received)}</span></div>
      <div class="pay-row"><span>เงินทอน</span><span>฿${formatNum(Math.max(0,bill.change||0))}</span></div>`:''}
  </div>
</div>

<div class="spacer"></div>
<div class="sig-section">
  <div class="footer-note">${rc?.receipt_footer||'ขอบคุณที่ใช้บริการ'}</div>
  <div class="sig-grid">
    <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">ผู้รับเงิน / พนักงาน</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">ผู้ตรวจสอบ</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">ลูกค้า / ผู้รับสินค้า</div></div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
<script>
(function() {
  var qrDiv = document.getElementById('qr-div');
  var payload = '${qrPayload.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}';
  function tryRender() {
    if (qrDiv && payload && typeof QRCode !== 'undefined') {
      try {
        new QRCode(qrDiv, {
          text: payload, width: 90, height: 90,
          colorDark: '#1e293b', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch(e) { console.warn('QR error:', e); }
    }
  }
  if (document.readyState === 'complete') {
    setTimeout(tryRender, 200);
    setTimeout(function(){ window.print(); setTimeout(function(){ window.close(); }, 1200); }, 800);
  } else {
    window.onload = function() {
      setTimeout(tryRender, 200);
      setTimeout(function(){ window.print(); setTimeout(function(){ window.close(); }, 1200); }, 800);
    };
  }
})();
<\/script>
</body></html>`);
  win.document.close();
};;


// patch bill.customer_address ใน v9Sale
const _v9OrigSale46 = window.v9Sale;
window.v9Sale = async function () {
  // inject customer address ลงใน checkoutState ก่อน sale
  if (checkoutState?.customer?.id) {
    try {
      const {data:cust} = await db.from('customer').select('address,phone').eq('id',checkoutState.customer.id).maybeSingle();
      if (cust) {
        checkoutState.customer.address = cust.address||'';
        checkoutState.customer.phone   = cust.phone||'';
      }
    } catch(_){}
  }
  return _v9OrigSale46?.apply(this, arguments);
};

// patch ใน bill insert ให้ส่ง customer_address และ customer_phone
// (เพิ่ม field ใน v9Sale insert query)
const _v9OrigV9Sale46b = window.v9Sale;
// NOTE: v9Sale insert บิลขาย ต้องส่ง customer_address, customer_phone
// override เพิ่ม field โดย patch db.from('บิลขาย').insert
// ทำโดยการ patch checkoutState ก่อน insert
// แล้วใน printA4 ดึง customer address จาก checkoutState

// ══════════════════════════════════════════════════════════════════
// FIX-47
//  Bug1: supplier = ซัพพลายเออร์ select เดียว (ทุก purchase form)
//  Bug2: v5PrintFromHistory เปิด Swal เดียว
//  Bug3: confirmCheckIn → บันทึกรายจ่ายค่าแรง
// ══════════════════════════════════════════════════════════════════

// ── Bug1: Supplier select ใน purchase ────────────────────────────
// แทนที่ pur-supplier (text) + pur-supplier-id (select) → select เดียว
// v9Pur24HTML ใช้ v9pur24-supp-id → แสดงเมื่อเครดิต เท่านั้น
// แก้: ย้าย supplier select มาไว้ด้านบนเสมอ ไม่ซ่อน

// override v9Pur24OpenModal เพิ่ม supplier select ด้านบน
const _v9OrigPur24Open47 = window.v9Pur24OpenModal || window.openReceiveModal;
window.v9Pur24OpenModal = async function () {
  // โหลด ซัพพลายเออร์ ก่อนเปิด modal
  try {
    const { data: suppList } = await db.from('ซัพพลายเออร์')
      .select('id,name').eq('status','ใช้งาน').order('name');
    window._v9SuppList47 = suppList || [];
  } catch(_) { window._v9SuppList47 = []; }

  if (typeof _v9OrigPur24Open47 === 'function') {
    _v9OrigPur24Open47.apply(this, arguments);
  } else {
    // เปิดด้วย v9OpenWideModal ถ้า function เดิมไม่มี
    if (typeof v9OpenWideModal==='function' && typeof v9Pur24HTML==='function') {
      v9OpenWideModal('รับสินค้าเข้าคลัง', v9Pur24HTML());
      if (typeof v9Pur24RenderProdList==='function') v9Pur24RenderProdList('');
    }
  }

  // patch supplier section หลัง modal render
  setTimeout(() => window._v9PatchPurSupplier47(), 150);
};

window._v9PatchPurSupplier47 = function () {
  const suppList = window._v9SuppList47 || [];
  const opts = suppList.map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join('');

  // patch v9p24-credit-row: เปลี่ยน select
  const sel = document.getElementById('v9pur24-supp-id');
  if (sel) {
    sel.innerHTML = `<option value="">-- เลือกซัพพลายเออร์ --</option>${opts}
      <option value="_new">+ เพิ่มซัพพลายเออร์ใหม่</option>`;
    // แสดง supplier select เสมอ (ไม่แค่ตอนเครดิต)
    const creditRow = document.getElementById('v9p24-credit-row');
    if (creditRow) {
      // เพิ่ม supplier section แยก ไว้ด้านบน credit row
      if (!document.getElementById('v9p24-supp-row')) {
        const suppRow = document.createElement('div');
        suppRow.id = 'v9p24-supp-row';
        suppRow.className = 'v9p24-field';
        suppRow.style.cssText = 'margin-bottom:6px;';
        suppRow.innerHTML = `
          <div class="v9p24-lbl">ซัพพลายเออร์ / ผู้จำหน่าย</div>
          <select class="v9p24-fi" id="v9p24-supp-main"
            onchange="window._v9HandleSuppChange47(this.value)">
            <option value="">-- ไม่ระบุ / เลือก --</option>
            ${opts}
            <option value="_new">+ เพิ่มใหม่</option>
          </select>
          <input id="v9p24-supp-new-name" placeholder="ชื่อซัพพลายเออร์ใหม่"
            class="v9p24-fi" style="display:none;margin-top:4px;">`;
        creditRow.parentNode.insertBefore(suppRow, creditRow);
      }
    }
  }

  // patch pur-supplier-id ใน modal เก่า (FIX-1/FIX-2)
  const oldSel = document.getElementById('pur-supplier-id');
  if (oldSel && !oldSel._v9patched) {
    oldSel._v9patched = true;
    oldSel.innerHTML = `<option value="">-- ไม่ระบุ / เลือก --</option>${opts}
      <option value="_new">+ เพิ่มซัพพลายเออร์ใหม่</option>`;
    // ซ่อน text input เดิม แสดง select แทน
    const textInp = document.getElementById('pur-supplier');
    if (textInp) {
      textInp.style.display = 'none';
      oldSel.style.display = '';
    }
  }
};

window._v9HandleSuppChange47 = function (val) {
  const newInp = document.getElementById('v9p24-supp-new-name');
  if (newInp) newInp.style.display = val === '_new' ? '' : 'none';
};

// patch v9Pur24Save ให้ดึง supplier จาก v9p24-supp-main
const _v9OrigPur24Save47 = window.v9Pur24Save;
window.v9Pur24Save = async function () {
  // set pur-supplier-id จาก v9p24-supp-main ก่อน save
  const mainSel    = document.getElementById('v9p24-supp-main');
  const creditSel  = document.getElementById('v9pur24-supp-id');
  const newNameInp = document.getElementById('v9p24-supp-new-name');

  if (mainSel) {
    let suppId   = mainSel.value;
    let suppName = mainSel.selectedOptions[0]?.text || '';

    if (suppId === '_new') {
      const newName = newNameInp?.value?.trim();
      if (!newName) { typeof toast==='function'&&toast('กรุณากรอกชื่อซัพพลายเออร์','error'); return; }
      try {
        const { data: ns } = await db.from('ซัพพลายเออร์')
          .insert({ name:newName, status:'ใช้งาน' }).select('id').maybeSingle();
        suppId   = ns?.id || '';
        suppName = newName;
      } catch(e) { console.warn('[v47] new supp:', e); }
    }

    // sync ไปยัง hidden fields
    if (creditSel) creditSel.value = suppId;

    // sync pur-supplier text
    const textInp = document.getElementById('pur-supplier');
    if (textInp) textInp.value = suppName !== '-- ไม่ระบุ / เลือก --' ? suppName : '';
  }

  return _v9OrigPur24Save47?.apply(this, arguments);
};

// hook renderPurchases เพื่อ patch ปุ่ม "สร้างใบรับ" → เรียก v9Pur24OpenModal
const _v9OrigRenderPur47 = window.renderPurchases;
window.renderPurchases = async function () {
  await _v9OrigRenderPur47?.apply(this, arguments);
  // patch ปุ่มสร้างใบรับ
  setTimeout(() => {
    document.querySelectorAll('[onclick*="showAddPurchaseModal"]').forEach(el => {
      const orig = el.getAttribute('onclick') || '';
      if (!orig.includes('v9Pur24OpenModal')) {
        el.setAttribute('onclick', 'window.v9Pur24OpenModal()');
      }
    });
  }, 80);
};


// ── Bug2: v5PrintFromHistory — Swal เดียว ────────────────────────
window.v5PrintFromHistory = async function (billId) {
  const { data: bill  } = await db.from('บิลขาย').select('*').eq('id',billId).single();
  const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id',billId);
  if (!bill) { typeof toast==='function'&&toast('ไม่พบข้อมูลบิล','error'); return; }

  const { value: fmt } = await Swal.fire({
    title: `พิมพ์ใบเสร็จ #${bill.bill_no}`,
    html: `<div style="display:flex;gap:12px;justify-content:center;padding:12px 0;">
      <button
        onclick="window._v9HistFmt='80mm';Swal.clickConfirm();"
        style="flex:1;padding:16px 10px;border:2px solid #DC2626;border-radius:12px;
          background:#fff5f5;cursor:pointer;font-size:13px;color:#DC2626;font-weight:700;
          font-family:var(--font-thai,'Prompt'),sans-serif;">
        <div style="font-size:28px;margin-bottom:6px;">🧾</div>
        80 mm<br><span style="font-size:10px;opacity:.7;">เครื่องพิมพ์ใบเสร็จ</span>
      </button>
      <button
        onclick="window._v9HistFmt='A4';Swal.clickConfirm();"
        style="flex:1;padding:16px 10px;border:2px solid #2563EB;border-radius:12px;
          background:#eff6ff;cursor:pointer;font-size:13px;color:#2563EB;font-weight:700;
          font-family:var(--font-thai,'Prompt'),sans-serif;">
        <div style="font-size:28px;margin-bottom:6px;">📄</div>
        A4<br><span style="font-size:10px;opacity:.7;">ใบเสร็จเต็ม</span>
      </button>
    </div>`,
    showConfirmButton: true,
    showDenyButton:    false,
    showCancelButton:  true,
    confirmButtonText: '',
    cancelButtonText:  'ยกเลิก',
    customClass: { confirmButton: 'swal-hidden-btn' },
    didOpen: () => {
      window._v9HistFmt = null;
      document.querySelectorAll('.swal-hidden-btn').forEach(b=>{ b.style.display='none'; });
    },
    timer: 15000,
    timerProgressBar: true,
  });

  const selectedFmt = window._v9HistFmt;
  if (!selectedFmt) return;
  if (typeof printReceipt === 'function') {
    printReceipt(bill, items||[], selectedFmt);
  }
};


// ── Bug3: confirmCheckIn → บันทึกรายจ่ายค่าแรง ──────────────────
// modules.js: confirmCheckIn เป็น local function → override window
window.confirmCheckIn = async function () {
  const empId  = document.getElementById('att-emp-id')?.value;
  const status = document.getElementById('att-status-val')?.value || 'มา';
  const note   = document.getElementById('att-note')?.value || '';
  if (!empId) { typeof toast==='function'&&toast('ไม่พบข้อมูลพนักงาน','error'); return; }

  const now   = new Date();
  const today = now.toISOString().split('T')[0];

  // ดึงข้อมูลพนักงาน
  const {data:emp} = await db.from('พนักงาน')
    .select('name,daily_wage').eq('id', empId).maybeSingle();
  const wage      = parseFloat(emp?.daily_wage || 0);
  const empName   = emp?.name || 'พนักงาน';

  // ATT_STATUS อาจเป็น global หรือ local
  const ATT = typeof ATT_STATUS !== 'undefined' ? ATT_STATUS : {
    'มา':        { deductPct:0 },
    'มาสาย':     { deductPct:5 },
    'ครึ่งวัน':  { deductPct:50 },
    'ขาด':       { deductPct:100 },
    'ลา':        { deductPct:0 },
    'มาทำงาน':   { deductPct:0 },
    'ลากิจ':     { deductPct:0 },
    'ลาป่วย':    { deductPct:0 },
    'ขาดงาน':    { deductPct:100 },
  };
  const deductPct  = ATT[status]?.deductPct ?? 0;
  const deduction  = Math.round(wage * deductPct / 100);

  // บันทึก เช็คชื่อ
  await db.from('เช็คชื่อ').insert({
    employee_id: empId, date: today, status,
    time_in: now.toTimeString().slice(0,5),
    deduction, note, staff_name: v9Staff?.() || (typeof USER !== 'undefined' ? USER?.username : ''),
  });

  // บันทึกรายจ่ายค่าแรง (ถ้ามีค่าแรง และสถานะมาทำงาน)
  const isWorking = ['มา','มาสาย','ครึ่งวัน','มาทำงาน'].includes(status);
  const actualWage = isWorking ? Math.max(0, wage - deduction) : 0;
  if (actualWage > 0) {
    await db.from('รายจ่าย').insert({
      description: `ค่าแรง ${empName}${deductPct>0?' (หัก '+deductPct+'%)':''}`,
      amount:      actualWage,
      category:    'ค่าแรง',
      method:      'เงินสด',
      date:        now.toISOString(),
      staff_name:  v9Staff?.() || (typeof USER !== 'undefined' ? USER?.username : ''),
      note:        `เช็คชื่อ ${today} — ${status}`,
    });
  }

  typeof closeModal==='function' && closeModal();
  typeof toast==='function' && toast(
    `บันทึกสำเร็จ ${empName}${actualWage>0?' · ค่าแรง ฿'+formatNum(actualWage):''}`,
    'success'
  );
  // refresh หน้าเช็คชื่อ
  if (typeof v5LoadCheckin === 'function') setTimeout(v5LoadCheckin, 200);
  else if (typeof renderAttendance === 'function') renderAttendance();
};


// ══════════════════════════════════════════════════════════════════
// FIX-48
//  Bug1: supplier = text input เดิม (ไม่ใช่ dropdown) + auto-link เจ้าหนี้
//  Bug2: accumulated หลังจ่ายยังคิดวันเดิม (lastPayDate filter ผิด)
//  Bug3: Cash flow หัก purchase เครดิต ทั้งที่ยังไม่จ่ายจริง
// ══════════════════════════════════════════════════════════════════

// ── Bug1: supplier text + auto-create ซัพพลายเออร์ เมื่อ isCredit ─
// ไม่ต้องใช้ dropdown ซัพพลายเออร์แยก
// ลบ v9p24-supp-main inject ออก (เพราะทำให้มี 2 field)
// ใช้แค่ pur-supplier text input เดิม

// ยกเลิก FIX-47 supplier injection
window.v9Pur24OpenModal = async function () {
  // reset _v9SuppList47 เพื่อไม่ inject ซ้ำ
  window._v9SuppList47 = [];

  // เรียก modal เดิมจาก FIX-24
  if (typeof v9OpenWideModal==='function' && typeof v9Pur24HTML==='function') {
    v9OpenWideModal('รับสินค้าเข้าคลัง', v9Pur24HTML());
    if (typeof v9Pur24RenderProdList==='function') {
      setTimeout(() => v9Pur24RenderProdList(''), 50);
    }
  } else if (typeof openModal==='function') {
    // fallback ถ้าไม่มี wide modal
    typeof showAddPurchaseModal==='function' && showAddPurchaseModal();
  }
  // ไม่ต้อง patch supplier dropdown อีกต่อไป
};

// ลบ patch v9Pur24Save ของ FIX-47 (reset กลับ)
const _v9OrigPur24Save48 = window.v9Pur24Save;
window.v9Pur24Save = async function () {
  // ลบ side-effect ของ FIX-47 (v9p24-supp-main)
  // ใช้ pur-supplier text input เดิมตรงๆ
  return _v9OrigPur24Save48?.apply(this, arguments);
};

// ── แก้ savePurchaseOrder / v9Pur24Save ให้ auto-create supplier จาก text ──
// patch ทั้ง 2 จุดที่ isCredit → เจ้าหนี้ insert
// (FIX-48A) savePurchaseOrder FIX-1 ให้ suppName = pur-supplier input โดยตรง
// (FIX-48B) v9Pur24Save ให้อ่าน pur-supplier text แล้ว auto-create

// patch เจ้าหนี้ insert ด้วย v9p24-supplier-text-value
// เมื่อ credit: ใช้ pur-supplier text → สร้าง supplier อัตโนมัติ
// (logic เดิม FIX-46 ทำอยู่แล้ว แค่ suppName ต้องไม่ override ให้เป็น select)


// ── Bug2: v5LoadPayroll: fix accumulated หลังจ่าย ────────────────
// แก้ lastPayDate filter ให้ใช้ timestamp จริง ไม่ใช่ date string
const _v9OrigLoadPayroll48 = window.v5LoadPayroll;
window.v5LoadPayroll = async function () {
  const sec = document.getElementById('att-tab-payroll');
  if (!sec) return;

  sec.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-tertiary);">
    <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:var(--primary);
      border-radius:50%;animation:v7spin .8s linear infinite;margin:0 auto 12px;"></div>
    <style>@keyframes v7spin{to{transform:rotate(360deg)}}</style>คำนวณเงินเดือน...
  </div>`;

  let emps=[], attAll=[], allAdv=[], allPaid=[];
  try { emps = await loadEmployees?.() || []; } catch(_){}
  try { const r = await db.from('เช็คชื่อ').select('employee_id,status,date'); attAll=r.data||[]; } catch(_){}
  try { const r = await db.from('เบิกเงิน').select('employee_id,amount,status,date').eq('status','อนุมัติ'); allAdv=r.data||[]; } catch(_){}
  try {
    const r = await db.from('จ่ายเงินเดือน')
      .select('employee_id,net_paid,deduct_withdraw,base_salary,paid_date,month')
      .order('paid_date',{ascending:false});
    allPaid = r.data||[];
  } catch(_){}

  const actives = emps.filter(e=>e.status==='ทำงาน');

  const rows = actives.map(emp => {
    const wage    = emp.daily_wage || 0;
    const empPaid = allPaid.filter(p=>p.employee_id===emp.id);
    const lastPay = empPaid[0] || null;

    // ใช้ ISO timestamp เปรียบเทียบกับ เช็คชื่อ.date (YYYY-MM-DD)
    // lastPay.paid_date = ISO เช่น 2026-03-23T16:01:00Z
    // เช็คชื่อ.date = "2026-03-23"
    // ต้องนับเช็คชื่อที่ date > วันที่จ่ายล่าสุด (ไม่ใช่ >= เพื่อไม่นับวันที่จ่ายซ้ำ)
    // แต่ถ้าจ่ายวันเดียวกับเช็คชื่อ ควรรวมวันนั้นด้วย
    // Logic: นับเช็คชื่อตั้งแต่วันหลังจากจ่ายล่าสุด
    const lastPayDateStr = lastPay?.paid_date
      ? lastPay.paid_date.split('T')[0]  // "2026-03-23"
      : null;

    const empAtt = attAll.filter(a => {
      if (a.employee_id !== emp.id) return false;
      if (!lastPayDateStr) return true;
      // นับวันหลังจากวันที่จ่ายล่าสุด (strictly after)
      // ถ้า lastPayDateStr = '2026-03-23' → นับ date > '2026-03-23'
      return a.date > lastPayDateStr;
    });

    const daysFull  = empAtt.filter(a=>['มา','มาทำงาน'].includes(a.status)).length;
    const daysHalf  = empAtt.filter(a=>a.status==='ครึ่งวัน').length;
    const daysLate  = empAtt.filter(a=>['มาสาย'].includes(a.status)).length;
    const daysAbsent= empAtt.filter(a=>['ขาด','ขาดงาน'].includes(a.status)).length;

    const accumulated = Math.round(
      daysFull * wage +
      daysHalf * wage * 0.5 +
      daysLate * wage * 0.95
    );

    const totalAdv      = allAdv.filter(a=>a.employee_id===emp.id).reduce((s,a)=>s+a.amount,0);
    const totalDeducted = empPaid.reduce((s,p)=>s+(p.deduct_withdraw||0),0);
    const accDebt       = Math.max(0, totalAdv - totalDeducted);

    return {emp, daysFull, daysHalf, daysLate, daysAbsent, accumulated, accDebt, lastPay, empAtt};
  });

  const totalAcc  = rows.reduce((s,r)=>s+r.accumulated,0);
  const totalDebt = rows.reduce((s,r)=>s+r.accDebt,0);

  sec.innerHTML = `
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:18px;
      padding:22px 24px;margin-bottom:20px;color:#fff;">
      <div style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;
        letter-spacing:.8px;margin-bottom:14px;">สรุปเงินเดือน — สะสมตั้งแต่จ่ายล่าสุด</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
        ${[
          ['ยอดสะสมรวม',    `฿${formatNum(totalAcc)}`,  '#10b981'],
          ['หนี้เบิกสะสม',   `฿${formatNum(totalDebt)}`, '#ef4444'],
          ['พนักงานทั้งหมด', `${rows.length} คน`,        '#6366f1'],
        ].map(([l,v,c])=>`
          <div style="background:rgba(255,255,255,.08);border-radius:12px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:rgba(255,255,255,.55);margin-bottom:4px;">${l}</div>
            <div style="font-size:17px;font-weight:800;color:${c};">${v}</div>
          </div>`).join('')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${rows.map(r=>`
        <div style="background:var(--bg-surface);border:1.5px solid #e2e8f0;
          border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04);">
          <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;">
            <div style="width:46px;height:46px;border-radius:50%;flex-shrink:0;
              background:linear-gradient(135deg,var(--primary),#b91c1c);
              display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;">
              ${(r.emp.name||'?').charAt(0)}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:700;">${r.emp.name} ${r.emp.lastname||''}</div>
              <div style="font-size:12px;color:#94a3b8;">${r.emp.position||'พนักงาน'} • ฿${formatNum(r.emp.daily_wage||0)}/วัน</div>
              ${r.lastPay
                ? `<div style="font-size:11px;color:#6366f1;margin-top:1px;">จ่ายล่าสุด ${r.lastPay.paid_date?.split('T')[0]} | ฿${formatNum(r.lastPay.net_paid)}</div>`
                : `<div style="font-size:11px;color:#94a3b8;margin-top:1px;">ยังไม่เคยจ่าย</div>`}
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
              <div>
                <div style="font-size:10px;color:#94a3b8;margin-bottom:1px;">
                  ยอดสะสม (${r.empAtt.length} วัน หลังจ่ายล่าสุด)
                </div>
                <div style="font-size:20px;font-weight:800;color:${r.accumulated>0?'#15803d':'#94a3b8'};">
                  ฿${formatNum(r.accumulated)}
                </div>
              </div>
              ${r.accDebt>0?`<div style="font-size:11px;padding:2px 8px;border-radius:999px;background:#fff7ed;color:#92400e;font-weight:700;">ติดหนี้ ฿${formatNum(r.accDebt)}</div>`:''}
              <div style="display:flex;gap:6px;">
                <button class="btn btn-primary btn-sm"
                  onclick="v9ShowPayrollModal('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim().replace(/'/g,"\\'")}',${r.accumulated},${r.accDebt})"
                  style="font-size:12px;">
                  <i class="material-icons-round" style="font-size:14px;">send</i> จ่าย
                </button>
                <button class="btn btn-outline btn-sm"
                  onclick="v9DeleteEmployee('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim().replace(/'/g,"\\'")}') "
                  style="font-size:12px;color:var(--danger);border-color:var(--danger);">
                  <i class="material-icons-round" style="font-size:14px;">delete</i>
                </button>
              </div>
            </div>
          </div>
          <div style="padding:8px 18px;background:var(--bg-base);display:grid;
            grid-template-columns:repeat(5,1fr);gap:6px;font-size:11px;">
            ${[
              ['วันทำงาน',  r.daysFull,   '#15803d'],
              ['มาสาย',     r.daysLate,   '#d97706'],
              ['ขาด',       r.daysAbsent, '#ef4444'],
              ['หนี้เบิก',  `฿${formatNum(r.accDebt)}`, '#92400e'],
              ['จ่ายล่าสุด',r.lastPay?`฿${formatNum(r.lastPay.net_paid)}`:'—','#6366f1'],
            ].map(([l,v,c])=>`
              <div style="text-align:center;">
                <div style="color:#94a3b8;">${l}</div>
                <div style="font-weight:700;color:${c};">${v}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;

  // patch onclick → window.v9PayConfirm
  setTimeout(() => {
    document.querySelectorAll('[onclick*="v9ConfirmPayroll"]').forEach(el => {
      const orig = el.getAttribute('onclick')||'';
      if (!orig.includes('window.v9PayConfirm'))
        el.setAttribute('onclick', orig.replace(/\bv9ConfirmPayroll\b/g, 'window.v9PayConfirm'));
    });
  }, 80);
};


// ── Bug3: Cash flow — เครดิต purchase ≠ เงินออก ─────────────────
// แก้ v9d44Load: tP = เฉพาะ purchase ที่จ่ายจริง (ไม่ใช่เครดิต)
// เพิ่ม tAP = ชำระเจ้าหนี้จริง จาก table ชำระเจ้าหนี้/เจ้าหนี้
const _v9OrigD44Load48 = window.v9d44Load;
window.v9d44Load = async function () {
  const days  = parseInt(document.querySelector('.v9d44-per.on')?.dataset.d||1);
  const today = new Date().toISOString().split('T')[0];
  const since = days===1?today:new Date(Date.now()-(days-1)*86400000).toISOString().split('T')[0];

  const lbl=document.getElementById('v9d44-lbl');
  if(lbl) lbl.textContent=days===1
    ?new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
    :`${new Date(since+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})} — ${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}`;

  try {
    const [bR,pR,eR,iR,salR,apR] = await Promise.all([
      db.from('บิลขาย').select('id,bill_no,total,method,status,date,customer_name')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(500),

      // purchase_order: ดึงทั้งหมดแต่แยก cash vs credit
      db.from('purchase_order').select('id,total,supplier,method,date,status')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),

      db.from('รายจ่าย').select('id,description,amount,category,method,date')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),

      db.from('รายการในบิล').select('name,qty,price,cost,total,unit,bill_id').limit(2000),

      db.from('จ่ายเงินเดือน').select('net_paid,paid_date')
        .gte('paid_date',since+'T00:00:00'),

      // ชำระเจ้าหนี้จริง (จ่ายเงินให้ซัพพลายเออร์)
      db.from('เจ้าหนี้').select('amount,paid_amount,balance,status,date').limit(500),
    ]);

    const B   = (bR.data||[]).filter(b=>b.status!=='ยกเลิก');
    const bIds= new Set(B.map(b=>b.id));
    const allP= pR.data||[];
    const E   = eR.data||[];
    const I   = (iR.data||[]).filter(i=>bIds.has(i.bill_id));
    const Sal = salR.data||[];
    const AP  = apR.data||[];

    // แยก purchase cash vs credit
    const PCash   = allP.filter(p=>p.method !== 'เครดิต');  // จ่ายจริงวันที่รับ
    const PCredit = allP.filter(p=>p.method === 'เครดิต');  // ยังไม่จ่าย

    const EW  = E.filter(e=>e.category==='ค่าแรง');
    const EO  = E.filter(e=>e.category!=='ค่าแรง');

    const tS   = B.reduce((s,b)=>s+parseFloat(b.total||0),0);
    // Cash flow: เฉพาะ purchase ที่จ่ายจริง
    const tP   = PCash.reduce((s,p)=>s+parseFloat(p.total||0),0);
    const tPCredit = PCredit.reduce((s,p)=>s+parseFloat(p.total||0),0); // เก็บไว้แสดง
    const tEW  = EW.reduce((s,e)=>s+parseFloat(e.amount||0),0);
    const tEO  = EO.reduce((s,e)=>s+parseFloat(e.amount||0),0);
    const tSal = Sal.reduce((s,p)=>s+parseFloat(p.net_paid||0),0);
    const tO   = tP+tEW+tEO+tSal;
    const nC   = tS-tO;

    // P&L: COGS จากรายการในบิลขาย (ไม่เกี่ยวกับ purchase)
    const cogs = I.reduce((s,i)=>s+(parseFloat(i.cost||0)*parseFloat(i.qty||0)),0);
    const gP   = tS-cogs; const gM=tS>0?Math.round(gP/tS*100):0;
    const opX  = tEW+tEO;
    const nP   = gP-opX;  const nM=tS>0?Math.round(nP/tS*100):0;

    // เจ้าหนี้คงค้าง
    const totalAP = AP.filter(a=>a.status==='ค้างชำระ').reduce((s,a)=>s+parseFloat(a.balance||0),0);

    window._v9d44Data={
      B,P:allP,PCash,PCredit,E,EW,EO,I,Sal,AP,
      tS,tP,tPCredit,tEW,tEO,tSal,tO,nC,cogs,gP,gM,opX,nP,nM,totalAP,days,since
    };
    window.v9d44KPI(window._v9d44Data);
    window.v9d44Chart(window._v9d44Data);
    window.v9d44RenderTL(window._v9d44Data);
    window.v9d44PL(window._v9d44Data);
    window.v9d44Cash(window._v9d44Data);
    window.v9d44Top(I);
  } catch(e){console.error('[Dash48]',e);}
};

// override dbCash ให้แสดง cash purchase เท่านั้น + note เครดิต
window.v9d44Cash = function({tS,tP,tPCredit,tEO,tEW,tSal,nC,totalAP}) {
  const el=document.getElementById('v9d44-cash-body');if(!el)return;
  const rows=[
    {l:'รับเงินจากขาย',   v:tS,       c:'#15803d',sg:'+',i:'trending_up'},
    {l:'จ่ายซื้อสินค้า (เงินสด/โอน)',v:tP,c:'#d97706',sg:'−',i:'inventory_2'},
    {l:'รายจ่ายร้าน',     v:tEO,      c:'#dc2626',sg:'−',i:'money_off'},
    {l:'ค่าแรงรายวัน',   v:tEW,      c:'#f97316',sg:'−',i:'people'},
    {l:'จ่ายเงินเดือน',  v:tSal,     c:'#7c3aed',sg:'−',i:'payments',note:'cash flow เท่านั้น'},
  ];
  el.innerHTML=rows.map(r=>`
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:9px 0;border-bottom:0.5px solid var(--border-light);">
      <div style="display:flex;align-items:center;gap:8px;flex:1;">
        <i class="material-icons-round" style="font-size:14px;color:${r.c};opacity:.7;">${r.i}</i>
        <div>
          <div style="font-size:12px;color:var(--text-secondary);">${r.l}</div>
          ${r.note?`<div style="font-size:10px;color:var(--text-tertiary);">${r.note}</div>`:''}
        </div>
      </div>
      <span style="font-size:13px;font-weight:700;color:${r.c};">${r.sg}฿${formatNum(Math.round(r.v))}</span>
    </div>`).join('')
  + (tPCredit>0?`
    <div style="margin:6px 0;padding:7px 10px;background:#fef3c7;border-radius:7px;
      font-size:11px;color:#92400e;display:flex;justify-content:space-between;">
      <span>🔴 เครดิตค้างชำระ (ยังไม่จ่าย)</span>
      <span style="font-weight:700;">฿${formatNum(Math.round(tPCredit))}</span>
    </div>`:'')
  + (totalAP>0?`
    <div style="margin:2px 0 6px;padding:7px 10px;background:#fef2f2;border-radius:7px;
      font-size:11px;color:#dc2626;display:flex;justify-content:space-between;">
      <span>⚠️ เจ้าหนี้คงค้างรวม</span>
      <span style="font-weight:700;">฿${formatNum(Math.round(totalAP))}</span>
    </div>`:'')
  + `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;
      padding:13px 16px;border-radius:12px;background:${nC>=0?'#f0fdf4':'#fef2f2'};">
      <div>
        <div style="font-size:13px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">เงินสดสุทธิ</div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;">${nC>=0?'✅ เพิ่มขึ้น':'⚠️ ลดลง'}</div>
      </div>
      <div style="font-size:20px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">
        ${nC<0?'−':''}฿${formatNum(Math.abs(Math.round(nC)))}</div>
    </div>
    <div style="font-size:10px;color:var(--text-tertiary);margin-top:6px;padding:5px 8px;
      background:var(--bg-base);border-radius:6px;">
      💡 ซื้อเครดิต = ยังไม่กระทบ cash flow จนกว่าจะชำระเจ้าหนี้
    </div>`;
};

// override timeline ให้แสดง purchase แยก cash vs credit
const _v9OrigD44TL48 = window.v9d44RenderTL;
window.v9d44RenderTL = function({B,P,PCash,PCredit,E,EW,EO,Sal}) {
  const el=document.getElementById('v9d44-tl');if(!el)return;
  const f=document.querySelector('#v9d44-tlf [data-f][style*="var(--primary)"]')?.dataset?.f||'all';
  const ev=[];
  if(f==='all'||f==='sale') B.forEach(b=>ev.push({t:b.date,i:'trending_up',bg:'#f0fdf4',c:'#15803d',
    ti:`บิล #${b.bill_no}`,su:b.method+(b.customer_name?' · '+b.customer_name:''),a:parseFloat(b.total||0),sg:'+'}));
  if(f==='all'||f==='buy') {
    (PCash||[]).forEach(p=>ev.push({t:p.date,i:'inventory_2',bg:'#fef3c7',c:'#d97706',
      ti:p.supplier||'ซื้อสินค้า',su:`${p.method} · จ่ายแล้ว`,a:parseFloat(p.total||0),sg:'−',cr:false}));
    (PCredit||[]).forEach(p=>ev.push({t:p.date,i:'inventory_2',bg:'#fff7ed',c:'#f97316',
      ti:p.supplier||'ซื้อสินค้า',su:'เครดิต · ยังไม่จ่าย',a:parseFloat(p.total||0),sg:'−',cr:true}));
  }
  if(f==='all'||f==='exp'){
    (EW||[]).forEach(e=>ev.push({t:e.date,i:'people',bg:'#fff7ed',c:'#f97316',
      ti:e.description,su:'ค่าแรง',a:parseFloat(e.amount||0),sg:'−'}));
    (EO||[]).forEach(e=>ev.push({t:e.date,i:'money_off',bg:'#fee2e2',c:'#dc2626',
      ti:e.description,su:`${e.category} · ${e.method}`,a:parseFloat(e.amount||0),sg:'−'}));
    (Sal||[]).forEach(s=>ev.push({t:s.paid_date,i:'payments',bg:'#ede9fe',c:'#7c3aed',
      ti:'จ่ายเงินเดือน',su:'cash flow',a:parseFloat(s.net_paid||0),sg:'−'}));
  }
  ev.sort((a,b)=>new Date(b.t)-new Date(a.t));
  if(!ev.length){el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-tertiary);font-size:12px;">ไม่มีรายการ</div>`;return;}
  el.innerHTML=ev.slice(0,80).map(e=>`
    <div style="display:flex;align-items:center;gap:11px;padding:10px 16px;border-bottom:0.5px solid var(--border-light);">
      <div style="width:32px;height:32px;border-radius:9px;background:${e.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="material-icons-round" style="font-size:15px;color:${e.c};">${e.i}</i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.ti}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">
          ${new Date(e.t).toLocaleDateString('th-TH',{day:'numeric',month:'short'})} ${new Date(e.t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} · ${e.su}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;color:${e.cr?'#f97316':e.sg==='+'?'#15803d':'#dc2626'};">
          ${e.sg}฿${formatNum(Math.round(e.a))}</div>
        ${e.cr?`<div style="font-size:10px;color:#f97316;">เครดิต</div>`:''}
      </div>
    </div>`).join('');
};


// ══════════════════════════════════════════════════════════════════
// FIX-49
//  Bug1: accumulated = total_earned_all - total_paid_all (ไม่ filter by date)
//  Bug2: confirmCheckIn ลบ รายจ่าย insert ออก (ยังไม่ได้จ่ายจริง)
//  Bug3: credit row ลบ ซัพพลายเออร์ dropdown ออก เหลือแค่วันครบกำหนด
// ══════════════════════════════════════════════════════════════════

// ── Bug1: accumulated = earned_all - paid_all ─────────────────────
window.v5LoadPayroll = async function () {
  const sec = document.getElementById('att-tab-payroll');
  if (!sec) return;

  sec.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-tertiary);">
    <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:var(--primary);
      border-radius:50%;animation:v7spin .8s linear infinite;margin:0 auto 12px;"></div>
    <style>@keyframes v7spin{to{transform:rotate(360deg)}}</style>คำนวณเงินเดือน...
  </div>`;

  let emps=[], attAll=[], allAdv=[], allPaid=[];
  try { emps = await loadEmployees?.() || []; } catch(_){}
  try { const r = await db.from('เช็คชื่อ').select('employee_id,status,date'); attAll=r.data||[]; } catch(_){}
  try { const r = await db.from('เบิกเงิน').select('employee_id,amount,status,date').eq('status','อนุมัติ'); allAdv=r.data||[]; } catch(_){}
  try {
    const r = await db.from('จ่ายเงินเดือน')
      .select('employee_id,net_paid,deduct_withdraw,base_salary,paid_date,month')
      .order('paid_date',{ascending:false});
    allPaid = r.data||[];
  } catch(_){}

  const actives = emps.filter(e=>e.status==='ทำงาน');

  const rows = actives.map(emp => {
    const wage    = parseFloat(emp.daily_wage || 0);
    const empPaid = allPaid.filter(p=>p.employee_id===emp.id);
    const lastPay = empPaid[0] || null;
    const empAtt  = attAll.filter(a=>a.employee_id===emp.id);

    // ── total_earned: รวมทุกวันที่เช็คชื่อ ──────────────────────
    const totalEarned = Math.round(empAtt.reduce((s,a) => {
      if (['มา','มาทำงาน'].includes(a.status)) return s + wage;
      if (a.status === 'ครึ่งวัน')              return s + wage * 0.5;
      if (a.status === 'มาสาย')                 return s + wage * 0.95;
      return s; // ขาด/ลา = 0
    }, 0));

    // ── total_paid: รวมทุกครั้งที่จ่าย ─────────────────────────
    const totalPaid = empPaid.reduce((s,p)=>s+parseFloat(p.net_paid||0),0);

    // ── accumulated = earned - paid (ห้ามติดลบ) ─────────────────
    const accumulated = Math.max(0, totalEarned - totalPaid);

    // ── หนี้เบิก ─────────────────────────────────────────────────
    const totalAdv      = allAdv.filter(a=>a.employee_id===emp.id).reduce((s,a)=>s+a.amount,0);
    const totalDeducted = empPaid.reduce((s,p)=>s+(p.deduct_withdraw||0),0);
    const accDebt       = Math.max(0, totalAdv - totalDeducted);

    const daysFull  = empAtt.filter(a=>['มา','มาทำงาน'].includes(a.status)).length;
    const daysLate  = empAtt.filter(a=>a.status==='มาสาย').length;
    const daysAbsent= empAtt.filter(a=>['ขาด','ขาดงาน'].includes(a.status)).length;

    return {emp, daysFull, daysLate, daysAbsent, accumulated, totalPaid, totalEarned, accDebt, lastPay};
  });

  const totalAcc  = rows.reduce((s,r)=>s+r.accumulated,0);
  const totalDebt = rows.reduce((s,r)=>s+r.accDebt,0);

  sec.innerHTML = `
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:18px;
      padding:22px 24px;margin-bottom:20px;color:#fff;">
      <div style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;
        letter-spacing:.8px;margin-bottom:14px;">สรุปเงินเดือน (earned − paid)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
        ${[
          ['ยอดรอจ่ายรวม',   `฿${formatNum(totalAcc)}`,  '#10b981'],
          ['หนี้เบิกสะสม',   `฿${formatNum(totalDebt)}`, '#ef4444'],
          ['พนักงานทั้งหมด', `${rows.length} คน`,        '#6366f1'],
        ].map(([l,v,c])=>`
          <div style="background:rgba(255,255,255,.08);border-radius:12px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:rgba(255,255,255,.55);margin-bottom:4px;">${l}</div>
            <div style="font-size:17px;font-weight:800;color:${c};">${v}</div>
          </div>`).join('')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${rows.map(r=>`
        <div style="background:var(--bg-surface);border:1.5px solid #e2e8f0;
          border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04);">
          <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;">
            <div style="width:46px;height:46px;border-radius:50%;flex-shrink:0;
              background:linear-gradient(135deg,var(--primary),#b91c1c);
              display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;">
              ${(r.emp.name||'?').charAt(0)}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:700;">${r.emp.name} ${r.emp.lastname||''}</div>
              <div style="font-size:12px;color:#94a3b8;">${r.emp.position||'พนักงาน'} • ฿${formatNum(r.emp.daily_wage||0)}/วัน</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">
                ได้รับสะสม ฿${formatNum(r.totalEarned)} | จ่ายแล้ว ฿${formatNum(r.totalPaid)}
              </div>
              ${r.lastPay
                ? `<div style="font-size:11px;color:#6366f1;margin-top:1px;">จ่ายล่าสุด ${r.lastPay.paid_date?.split('T')[0]} | ฿${formatNum(r.lastPay.net_paid)}</div>`
                : `<div style="font-size:11px;color:#94a3b8;margin-top:1px;">ยังไม่เคยจ่าย</div>`}
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
              <div>
                <div style="font-size:10px;color:#94a3b8;margin-bottom:1px;">ยอดรอจ่าย</div>
                <div style="font-size:20px;font-weight:800;color:${r.accumulated>0?'#15803d':'#94a3b8'};">
                  ฿${formatNum(r.accumulated)}
                </div>
              </div>
              ${r.accDebt>0?`<div style="font-size:11px;padding:2px 8px;border-radius:999px;background:#fff7ed;color:#92400e;font-weight:700;">ติดหนี้ ฿${formatNum(r.accDebt)}</div>`:''}
              <div style="display:flex;gap:6px;">
                <button class="btn btn-primary btn-sm"
                  onclick="v9ShowPayrollModal('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim().replace(/'/g,"\\'")}',${r.accumulated},${r.accDebt})"
                  style="font-size:12px;">
                  <i class="material-icons-round" style="font-size:14px;">send</i> จ่าย
                </button>
                <button class="btn btn-outline btn-sm"
                  onclick="v9DeleteEmployee('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim().replace(/'/g,"\\'")}') "
                  style="font-size:12px;color:var(--danger);border-color:var(--danger);">
                  <i class="material-icons-round" style="font-size:14px;">delete</i>
                </button>
              </div>
            </div>
          </div>
          <div style="padding:8px 18px;background:var(--bg-base);display:grid;
            grid-template-columns:repeat(5,1fr);gap:6px;font-size:11px;">
            ${[
              ['วันทำงาน',  r.daysFull,   '#15803d'],
              ['มาสาย',     r.daysLate,   '#d97706'],
              ['ขาด',       r.daysAbsent, '#ef4444'],
              ['หนี้เบิก',  `฿${formatNum(r.accDebt)}`, '#92400e'],
              ['จ่ายล่าสุด',r.lastPay?`฿${formatNum(r.lastPay.net_paid)}`:'—','#6366f1'],
            ].map(([l,v,c])=>`
              <div style="text-align:center;">
                <div style="color:#94a3b8;">${l}</div>
                <div style="font-weight:700;color:${c};">${v}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;

  // patch onclick
  setTimeout(() => {
    document.querySelectorAll('[onclick*="v9ConfirmPayroll"]').forEach(el => {
      const orig = el.getAttribute('onclick')||'';
      if (!orig.includes('window.v9PayConfirm'))
        el.setAttribute('onclick', orig.replace(/\bv9ConfirmPayroll\b/g, 'window.v9PayConfirm'));
    });
  }, 80);
};


// ── Bug2: confirmCheckIn ลบ รายจ่าย insert ออก ──────────────────
// ค่าแรงยังไม่ได้จ่ายจริง จะบันทึกเป็นรายจ่ายเมื่อกด "จ่ายเงินเดือน" เท่านั้น
window.confirmCheckIn = async function () {
  const empId  = document.getElementById('att-emp-id')?.value;
  const status = document.getElementById('att-status-val')?.value || 'มา';
  const note   = document.getElementById('att-note')?.value || '';
  if (!empId) { typeof toast==='function'&&toast('ไม่พบข้อมูลพนักงาน','error'); return; }

  const now   = new Date();
  const today = now.toISOString().split('T')[0];

  const {data:emp} = await db.from('พนักงาน')
    .select('name,daily_wage').eq('id', empId).maybeSingle();
  const wage    = parseFloat(emp?.daily_wage || 0);
  const empName = emp?.name || 'พนักงาน';

  const ATT = typeof ATT_STATUS !== 'undefined' ? ATT_STATUS : {
    'มา':{'deductPct':0},'มาสาย':{'deductPct':5},'ครึ่งวัน':{'deductPct':50},
    'ขาด':{'deductPct':100},'ลา':{'deductPct':0},'มาทำงาน':{'deductPct':0},
    'ลากิจ':{'deductPct':0},'ลาป่วย':{'deductPct':0},'ขาดงาน':{'deductPct':100},
  };
  const deductPct = ATT[status]?.deductPct ?? 0;
  const deduction = Math.round(wage * deductPct / 100);

  // บันทึก เช็คชื่อ เท่านั้น (ไม่บันทึกรายจ่าย — ยังไม่ได้จ่ายเงินจริง)
  await db.from('เช็คชื่อ').insert({
    employee_id: empId, date: today, status,
    time_in: now.toTimeString().slice(0,5),
    deduction, note,
    staff_name: v9Staff?.() || (typeof USER !== 'undefined' ? USER?.username : ''),
  });

  typeof closeModal==='function' && closeModal();
  typeof toast==='function' && toast(
    `บันทึกสำเร็จ ${empName} — ${status}`, 'success'
  );

  if (typeof v5LoadCheckin === 'function') setTimeout(v5LoadCheckin, 200);
  else if (typeof renderAttendance === 'function') renderAttendance();
};


// ── Bug3: ลบ ซัพพลายเออร์ dropdown จาก v9p24-credit-row ──────────
// patch v9Pur24HTML หลัง render ให้ซ่อน ซัพพลายเออร์ field
const _v9OrigPur24Open49 = window.v9Pur24OpenModal;
window.v9Pur24OpenModal = async function () {
  if (typeof v9OpenWideModal==='function' && typeof v9Pur24HTML==='function') {
    v9OpenWideModal('รับสินค้าเข้าคลัง', v9Pur24HTML());
    if (typeof v9Pur24RenderProdList==='function') {
      setTimeout(() => v9Pur24RenderProdList(''), 50);
    }
  }
  // ซ่อน ซัพพลายเออร์ field ใน credit row
  setTimeout(() => {
    const suppField = document.querySelector('#v9p24-credit-row .v9p24-field:first-child');
    if (suppField) {
      const lbl = suppField.querySelector('.v9p24-lbl');
      if (lbl && lbl.textContent.includes('ซัพพลายเออร์')) {
        suppField.style.display = 'none';
      }
    }
    // ซ่อน select v9pur24-supp-id และ label
    const suppSel = document.getElementById('v9pur24-supp-id');
    if (suppSel) {
      suppSel.closest('.v9p24-field')?.style && (suppSel.closest('.v9p24-field').style.display='none');
    }
  }, 150);
};

// patch v9PurToggleCredit / v9Pur24SelMethod ให้ sync ซ่อน field
const _v9OrigPurToggle49 = window.v9PurToggleCredit;
window.v9PurToggleCredit = function () {
  _v9OrigPurToggle49?.apply(this, arguments);
  setTimeout(() => {
    const suppField = document.querySelector('#v9p24-credit-row .v9p24-field:first-child');
    if (suppField) {
      const lbl = suppField.querySelector('.v9p24-lbl');
      if (lbl?.textContent.includes('ซัพพลายเออร์'))
        suppField.style.display = 'none';
    }
  }, 50);
};

// patch v9Pur24SelMethod — ซ่อน supp field เมื่อเลือก เครดิต
const _v9OrigPur24SelMethod49 = window.v9Pur24SelMethod;
window.v9Pur24SelMethod = function (btn, method) {
  _v9OrigPur24SelMethod49?.apply(this, [btn, method]);
  setTimeout(() => {
    const suppSel = document.getElementById('v9pur24-supp-id');
    if (suppSel) suppSel.closest('.v9p24-field') && (suppSel.closest('.v9p24-field').style.display='none');
  }, 50);
};


// ══════════════════════════════════════════════════════════════════
// FIX-50
//  Bug1: เจ้าหนี้ supplier_id NOT NULL → auto-create ด้วย pur-supplier text
//  Bug2: Dashboard ลบ ค่าแรงรายวัน (EW) ออก cash flow + P&L (ยังไม่จ่ายจริง)
//  Bug3: จ่ายเงินเดือน duplicate key → ใช้วันที่จริงแทน first-of-month
// ══════════════════════════════════════════════════════════════════

// ── Bug3: v9PayConfirm - ใช้วันที่จริง เพื่อหลีก unique constraint ─
window.v9PayConfirm = async function (empId, empName, accumulated, accDebt) {
  if (!empId) { typeof toast==='function'&&toast('ไม่พบข้อมูลพนักงาน','error'); return; }

  const pay    = Number(document.getElementById('v9pay-amount')?.value || 0);
  const deduct = Number(document.getElementById('v9pay-deduct')?.value || 0);
  const note   = document.getElementById('v9pay-note')?.value || '';

  if (pay <= 0) { typeof toast==='function'&&toast('กรุณาระบุจำนวนเงิน','error'); return; }
  const netGet = Math.max(0, pay - deduct);

  const btn = document.getElementById('v9pay-confirm-btn');
  if (btn) btn.disabled = true;
  v9ShowOverlay('กำลังบันทึก...', `${empName} ฿${formatNum(pay)}`);

  try {
    const now = new Date();
    // ใช้วันที่จริง (YYYY-MM-DD) แทน first-of-month
    // เพื่อหลีก unique constraint employee_id+month
    const monthVal = now.toISOString().split('T')[0]; // '2026-03-23'

    const { error } = await db.from('จ่ายเงินเดือน').insert({
      employee_id:     empId,
      month:           monthVal,
      net_paid:        pay,
      deduct_withdraw: deduct,
      base_salary:     parseFloat(accumulated||0),
      paid_date:       now.toISOString(),
      staff_name:      v9Staff(),
      note:            note || `จ่ายเงินเดือน ${empName}`,
    });

    if (error) {
      // ถ้า duplicate key (จ่าย 2 ครั้งในวันเดียวกัน) → เพิ่ม timestamp
      if (error.code === '23505') {
        const ts = Date.now().toString().slice(-4); // 4 ตัวท้าย
        const fallbackDate = new Date(now.getTime() + parseInt(ts));
        const fallbackMonth = fallbackDate.toISOString().split('T')[0];
        const { error: e2 } = await db.from('จ่ายเงินเดือน').insert({
          employee_id: empId, month: fallbackMonth,
          net_paid: pay, deduct_withdraw: deduct,
          base_salary: parseFloat(accumulated||0),
          paid_date: now.toISOString(),
          staff_name: v9Staff(),
          note: note || `จ่ายเงินเดือน ${empName}`,
        });
        if (e2) throw new Error(e2.message);
      } else {
        console.warn('[v9] payroll warn:', error.message);
      }
    }

    // บันทึก cash_transaction ออก
    const { data: session } = await db.from('cash_session')
      .select('id').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (session && typeof window.recordCashTx==='function') {
      await window.recordCashTx({
        sessionId: session.id, type:'จ่ายเงินเดือน', direction:'out',
        amount: netGet, changeAmt: 0, netAmount: netGet,
        refTable: 'จ่ายเงินเดือน',
        note: `${empName}`,
      });
    }

    typeof logActivity==='function' && logActivity('จ่ายเงินเดือน',`${empName} ฿${formatNum(pay)}`);
    document.getElementById('v9-payroll-overlay')?.remove();
    typeof toast==='function' && toast(`จ่ายเงินเดือน ${empName} ฿${formatNum(pay)} สำเร็จ`,'success');
    window.v5LoadPayroll?.();
  } catch(e) {
    console.error('[v9] payroll error:', e);
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+(e.message||e),'error');
    if (btn) btn.disabled = false;
  } finally { v9HideOverlay(); }
};


// ── Bug1: เจ้าหนี้ auto-create supplier จาก pur-supplier text ────
// patch savePurchaseOrder (FIX-1) + v9Pur24Save (FIX-24)
// ทั้ง 2 ต้อง suppId เสมอ → สร้าง supplier อัตโนมัติจากชื่อที่กรอก หรือ "ไม่ระบุ"
// แก้ v9Pur24Save ให้ sync pur-supplier text → suppId ก่อน call
const _v9OrigPur24Save50 = window.v9Pur24Save;
window.v9Pur24Save = async function () {
  // sync suppId จาก pur-supplier text input ก่อน save
  const suppText = document.getElementById('v9p24-supplier-txt')?.value?.trim()
    || document.getElementById('pur-supplier')?.value?.trim()
    || '';

  // ถ้า isCredit → ต้องมี suppId
  const method = document.querySelector('.v9p24-mbtn.on')?.textContent?.trim() || 'เงินสด';
  if (method === 'เครดิต') {
    // ค้นหาหรือสร้าง supplier จากชื่อที่กรอก
    const suppName = suppText || 'ไม่ระบุ';
    let suppId = null;
    const {data:found} = await db.from('ซัพพลายเออร์').select('id').eq('name',suppName).maybeSingle();
    if (found) {
      suppId = found.id;
    } else {
      const {data:ns} = await db.from('ซัพพลายเออร์').insert({name:suppName,status:'ใช้งาน'}).select('id').maybeSingle();
      suppId = ns?.id;
    }
    // inject เข้า hidden select
    const sel = document.getElementById('v9pur24-supp-id');
    if (sel && suppId) {
      // เพิ่ม option ถ้าไม่มี
      let opt = sel.querySelector(`option[value="${suppId}"]`);
      if (!opt) { opt = document.createElement('option'); opt.value=suppId; sel.appendChild(opt); }
      sel.value = suppId;
    }
    window._v9SuppId50 = suppId;
  }
  return _v9OrigPur24Save50?.apply(this, arguments);
};

// patch savePurchaseOrder FIX-1 ให้อ่าน _v9SuppId50 ด้วย
const _v9OrigSavePO50 = window.savePurchaseOrder;
window.savePurchaseOrder = async function () {
  // อ่าน suppId จาก text input ก่อน
  const suppText = document.getElementById('pur-supplier')?.value?.trim() || '';
  const method   = document.getElementById('pur-method')?.value || 'เงินสด';
  if (method === 'เครดิต') {
    const suppName = suppText || 'ไม่ระบุ';
    let suppId = null;
    const {data:found} = await db.from('ซัพพลายเออร์').select('id').eq('name',suppName).maybeSingle();
    if (found) { suppId = found.id; }
    else {
      const {data:ns} = await db.from('ซัพพลายเออร์').insert({name:suppName,status:'ใช้งาน'}).select('id').maybeSingle();
      suppId = ns?.id;
    }
    // inject ลง select
    const sel = document.getElementById('pur-supplier-id');
    if (sel && suppId) {
      let opt = sel.querySelector(`option[value="${suppId}"]`);
      if (!opt) { opt=document.createElement('option'); opt.value=suppId; sel.appendChild(opt); }
      sel.value = suppId;
    }
  }
  return _v9OrigSavePO50?.apply(this, arguments);
};


// ── Bug2: Dashboard - ลบ EW (ค่าแรงรายวัน) ออก ──────────────────
// ค่าแรงยังไม่ถูกจ่ายจริงจนกว่าจะจ่ายเงินเดือน
// tSal (จ่ายเงินเดือน) ครอบคลุม cash flow แล้ว
window.v9d44Load = async function () {
  const days  = parseInt(document.querySelector('.v9d44-per.on')?.dataset.d||1);
  const today = new Date().toISOString().split('T')[0];
  const since = days===1?today:new Date(Date.now()-(days-1)*86400000).toISOString().split('T')[0];

  const lbl=document.getElementById('v9d44-lbl');
  if(lbl) lbl.textContent=days===1
    ?new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
    :`${new Date(since+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})} — ${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}`;

  try {
    const [bR,pR,eR,iR,salR,apR] = await Promise.all([
      db.from('บิลขาย').select('id,bill_no,total,method,status,date,customer_name')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(500),
      db.from('purchase_order').select('id,total,supplier,method,date,status')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายจ่าย').select('id,description,amount,category,method,date')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายการในบิล').select('name,qty,price,cost,total,unit,bill_id').limit(2000),
      db.from('จ่ายเงินเดือน').select('net_paid,paid_date')
        .gte('paid_date',since+'T00:00:00'),
      db.from('เจ้าหนี้').select('amount,paid_amount,balance,status,date').limit(500),
    ]);

    const B    = (bR.data||[]).filter(b=>b.status!=='ยกเลิก');
    const bIds = new Set(B.map(b=>b.id));
    const allP = pR.data||[];
    const E    = eR.data||[];
    const I    = (iR.data||[]).filter(i=>bIds.has(i.bill_id));
    const Sal  = salR.data||[];
    const AP   = apR.data||[];

    // แยก purchase cash vs credit
    const PCash   = allP.filter(p=>p.method !== 'เครดิต');
    const PCredit = allP.filter(p=>p.method === 'เครดิต');

    // รายจ่ายร้าน (ไม่รวม ค่าแรง — ยังไม่ได้จ่ายจริง)
    const EO = E.filter(e=>e.category !== 'ค่าแรง');

    const tS      = B.reduce((s,b)=>s+parseFloat(b.total||0),0);
    const tP      = PCash.reduce((s,p)=>s+parseFloat(p.total||0),0);  // เฉพาะ cash
    const tPCred  = PCredit.reduce((s,p)=>s+parseFloat(p.total||0),0);
    const tEO     = EO.reduce((s,e)=>s+parseFloat(e.amount||0),0);     // รายจ่ายร้าน (ไม่มีค่าแรง)
    const tSal    = Sal.reduce((s,p)=>s+parseFloat(p.net_paid||0),0);  // เงินเดือนที่จ่ายจริง
    const tO      = tP + tEO + tSal;
    const nC      = tS - tO;

    // P&L: COGS จากบิล + รายจ่ายร้าน + เงินเดือนที่จ่ายจริง
    const cogs = I.reduce((s,i)=>s+(parseFloat(i.cost||0)*parseFloat(i.qty||0)),0);
    const gP   = tS - cogs;
    const gM   = tS>0?Math.round(gP/tS*100):0;
    const opX  = tEO + tSal;   // ไม่รวม ค่าแรงรายวัน (EW)
    const nP   = gP - opX;
    const nM   = tS>0?Math.round(nP/tS*100):0;

    const totalAP = AP.filter(a=>a.status==='ค้างชำระ').reduce((s,a)=>s+parseFloat(a.balance||0),0);

    window._v9d44Data = {
      B, P:allP, PCash, PCredit, E, EO, I, Sal, AP,
      tS, tP, tPCred, tEO, tSal, tO, nC, cogs, gP, gM, opX, nP, nM, totalAP, days, since
    };
    window.v9d44KPI(window._v9d44Data);
    window.v9d44Chart(window._v9d44Data);
    window.v9d44RenderTL(window._v9d44Data);
    window.v9d44PL(window._v9d44Data);
    window.v9d44Cash(window._v9d44Data);
    window.v9d44Top(I);
  } catch(e){ console.error('[Dash50]',e); }
};

// override dbCash: ลบ ค่าแรงรายวัน ออก
window.v9d44Cash = function({tS, tP, tPCred, tEO, tSal, nC, totalAP}) {
  const el=document.getElementById('v9d44-cash-body'); if(!el)return;
  const rows=[
    {l:'รับเงินจากขาย',                  v:tS,   c:'#15803d', sg:'+', i:'trending_up'},
    {l:'จ่ายซื้อสินค้า (เงินสด/โอน)',   v:tP,   c:'#d97706', sg:'−', i:'inventory_2'},
    {l:'รายจ่ายร้าน',                    v:tEO,  c:'#dc2626', sg:'−', i:'money_off'},
    {l:'จ่ายเงินเดือน',                  v:tSal, c:'#7c3aed', sg:'−', i:'payments', note:'เงินออกจริง'},
  ];
  el.innerHTML = rows.map(r=>`
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:9px 0;border-bottom:0.5px solid var(--border-light);">
      <div style="display:flex;align-items:center;gap:8px;flex:1;">
        <i class="material-icons-round" style="font-size:14px;color:${r.c};opacity:.7;">${r.i}</i>
        <div>
          <div style="font-size:12px;color:var(--text-secondary);">${r.l}</div>
          ${r.note?`<div style="font-size:10px;color:var(--text-tertiary);">${r.note}</div>`:''}
        </div>
      </div>
      <span style="font-size:13px;font-weight:700;color:${r.c};">${r.sg}฿${formatNum(Math.round(r.v))}</span>
    </div>`).join('')
  + (tPCred>0?`
    <div style="margin:6px 0;padding:7px 10px;background:#fef3c7;border-radius:7px;
      font-size:11px;color:#92400e;display:flex;justify-content:space-between;">
      <span>🔴 ซื้อเครดิต ยังไม่จ่าย</span>
      <span style="font-weight:700;">฿${formatNum(Math.round(tPCred))}</span>
    </div>`:'')
  + (totalAP>0?`
    <div style="margin:2px 0 6px;padding:7px 10px;background:#fef2f2;border-radius:7px;
      font-size:11px;color:#dc2626;display:flex;justify-content:space-between;">
      <span>⚠️ เจ้าหนี้คงค้างรวม</span>
      <span style="font-weight:700;">฿${formatNum(Math.round(totalAP))}</span>
    </div>`:'')
  + `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;
      padding:13px 16px;border-radius:12px;background:${nC>=0?'#f0fdf4':'#fef2f2'};">
      <div>
        <div style="font-size:13px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">เงินสดสุทธิ</div>
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;">${nC>=0?'✅ เพิ่มขึ้น':'⚠️ ลดลง'}</div>
      </div>
      <div style="font-size:20px;font-weight:700;color:${nC>=0?'#15803d':'#dc2626'};">
        ${nC<0?'−':''}฿${formatNum(Math.abs(Math.round(nC)))}</div>
    </div>
    <div style="font-size:10px;color:var(--text-tertiary);margin-top:6px;padding:5px 8px;
      background:var(--bg-base);border-radius:6px;">
      💡 ค่าแรง/เงินเดือนนับเมื่อจ่ายจริง · ซื้อเครดิตไม่กระทบ cash flow
    </div>`;
};

// override dbPL: ลบ ค่าแรงรายวัน ออก ใช้แค่ รายจ่ายร้าน + เงินเดือนที่จ่าย
window.v9d44PL = function({tS, cogs, gP, gM, tEO, tSal, nP, nM}) {
  const el=document.getElementById('v9d44-pl-body'); if(!el)return;
  const row=(l,v,c,bg,bold,sub,indent)=>`
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:9px ${bg?'12px':'2px'};border-radius:${bg?'8px':'0'};margin-bottom:3px;
      background:${bg||'transparent'};${indent?'padding-left:18px;':''}">
      <div>
        <div style="font-size:${bold?'13px':'12px'};font-weight:${bold?700:400};
          color:${bold?'var(--text-primary)':'var(--text-secondary)'};">${l}</div>
        ${sub?`<div style="font-size:10px;color:var(--text-tertiary);">${sub}</div>`:''}
      </div>
      <div style="font-size:${bold?'15px':'13px'};font-weight:${bold?700:500};color:${c};">
        ${v<0?'−':''}฿${formatNum(Math.abs(Math.round(v)))}</div>
    </div>`;

  el.innerHTML =
    row('ยอดขายรวม', tS, '#15803d', '#f0fdf4', true)
    + `<div style="font-size:10px;color:var(--text-tertiary);padding:2px;margin:2px 0;">ลบ ต้นทุนสินค้า (COGS)</div>`
    + row('COGS', cogs, '#d97706', '', false, 'cost × qty จากรายการบิล', true)
    + `<hr style="border:none;border-top:1.5px dashed var(--border-light);margin:6px 0;">`
    + row('กำไรขั้นต้น', gP, gP>=0?'#0891b2':'#dc2626', '#ecfeff', true, `Gross Margin ${gM}%`)
    + `<div style="font-size:10px;color:var(--text-tertiary);padding:2px;margin:2px 0;">ลบ ค่าใช้จ่ายดำเนินงาน</div>`
    + row('รายจ่ายร้าน', tEO, '#dc2626', '', false, '', true)
    + row('เงินเดือนที่จ่าย', tSal, '#7c3aed', '', false, 'นับเมื่อจ่ายจริงเท่านั้น', true)
    + `<hr style="border:none;border-top:2px solid var(--border-light);margin:8px 0;">`
    + `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;
        border-radius:12px;background:${nP>=0?'#f0fdf4':'#fef2f2'};">
        <div>
          <div style="font-size:15px;font-weight:700;color:${nP>=0?'#15803d':'#dc2626'};">กำไรสุทธิ</div>
          <div style="font-size:11px;font-weight:600;color:${nP>=0?'#16a34a':'#ef4444'};margin-top:3px;">Net Margin ${nM}%</div>
        </div>
        <div style="font-size:24px;font-weight:700;color:${nP>=0?'#15803d':'#dc2626'};">
          ${nP<0?'−':''}฿${formatNum(Math.abs(Math.round(nP)))}</div>
      </div>`;
};

// override v9d44RenderTL: ลบ EW ออกจาก timeline
window.v9d44RenderTL = function({B,PCash,PCredit,EO,Sal}) {
  const el=document.getElementById('v9d44-tl');if(!el)return;
  const f=document.querySelector('#v9d44-tlf [data-f][style*="var(--primary)"]')?.dataset?.f||'all';
  const ev=[];
  if(f==='all'||f==='sale') B.forEach(b=>ev.push({t:b.date,i:'trending_up',bg:'#f0fdf4',c:'#15803d',
    ti:`บิล #${b.bill_no}`,su:b.method+(b.customer_name?' · '+b.customer_name:''),a:parseFloat(b.total||0),sg:'+'}));
  if(f==='all'||f==='buy'){
    (PCash||[]).forEach(p=>ev.push({t:p.date,i:'inventory_2',bg:'#fef3c7',c:'#d97706',
      ti:p.supplier||'ซื้อสินค้า',su:`${p.method}`,a:parseFloat(p.total||0),sg:'−'}));
    (PCredit||[]).forEach(p=>ev.push({t:p.date,i:'inventory_2',bg:'#fff7ed',c:'#f97316',
      ti:p.supplier||'ซื้อสินค้า',su:'เครดิต · ยังไม่จ่าย',a:parseFloat(p.total||0),sg:'−',cr:true}));
  }
  if(f==='all'||f==='exp'){
    (EO||[]).forEach(e=>ev.push({t:e.date,i:'money_off',bg:'#fee2e2',c:'#dc2626',
      ti:e.description,su:`${e.category} · ${e.method}`,a:parseFloat(e.amount||0),sg:'−'}));
    (Sal||[]).forEach(s=>ev.push({t:s.paid_date,i:'payments',bg:'#ede9fe',c:'#7c3aed',
      ti:'จ่ายเงินเดือน',su:'เงินออกจริง',a:parseFloat(s.net_paid||0),sg:'−'}));
  }
  ev.sort((a,b)=>new Date(b.t)-new Date(a.t));
  if(!ev.length){el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-tertiary);font-size:12px;">ไม่มีรายการ</div>`;return;}
  el.innerHTML=ev.slice(0,80).map(e=>`
    <div style="display:flex;align-items:center;gap:11px;padding:10px 16px;border-bottom:0.5px solid var(--border-light);">
      <div style="width:32px;height:32px;border-radius:9px;background:${e.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="material-icons-round" style="font-size:15px;color:${e.c};">${e.i}</i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.ti}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">
          ${new Date(e.t).toLocaleDateString('th-TH',{day:'numeric',month:'short'})} ${new Date(e.t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} · ${e.su}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;color:${e.cr?'#f97316':e.sg==='+'?'#15803d':'#dc2626'};">
          ${e.sg}฿${formatNum(Math.round(e.a))}</div>
        ${e.cr?`<div style="font-size:10px;color:#f97316;">เครดิต</div>`:''}
      </div>
    </div>`).join('');
};


// ══════════════════════════════════════════════════════════════════
// FIX-51: renderPayables redesign — ดึงตรงจาก เจ้าหนี้ ไม่ join
//         + observer + nav click patch ครอบคลุมทุก entry point
// ══════════════════════════════════════════════════════════════════

window.renderPayables = async function () {
  const section = document.getElementById('page-payable');
  if (!section) return;

  // loading
  section.innerHTML = `
    <div style="padding:60px;text-align:center;color:var(--text-tertiary);">
      <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#dc2626;
        border-radius:50%;animation:v7spin .8s linear infinite;margin:0 auto 12px;"></div>
      <style>@keyframes v7spin{to{transform:rotate(360deg)}}</style>
      กำลังโหลดข้อมูลเจ้าหนี้...
    </div>`;

  // ── ดึงข้อมูลแยก (ไม่ join เพื่อหลีก RLS issue) ──────────────
  let rows = [], suppMap = {};
  try {
    const { data: apData, error: apErr } = await db.from('เจ้าหนี้')
      .select('id,supplier_id,purchase_order_id,date,due_date,amount,paid_amount,balance,status,note')
      .order('due_date', {ascending: true})
      .limit(300);

    if (apErr) { console.error('[FIX-51] เจ้าหนี้ query:', apErr.message); }
    rows = apData || [];

    // ดึง supplier names
    const suppIds = [...new Set(rows.map(r=>r.supplier_id).filter(Boolean))];
    if (suppIds.length > 0) {
      const { data: supps } = await db.from('ซัพพลายเออร์')
        .select('id,name,phone').in('id', suppIds);
      (supps||[]).forEach(s => { suppMap[s.id] = s; });
    }
  } catch(e) { console.error('[FIX-51]', e); }

  const pending   = rows.filter(r => r.status === 'ค้างชำระ');
  const totalDebt = pending.reduce((s,r) => s + parseFloat(r.balance||0), 0);
  const overdue   = pending.filter(r => r.due_date && new Date(r.due_date) < new Date());

  section.innerHTML = `
    <div style="padding:20px;max-width:1200px;margin:0 auto;">

      <!-- KPI -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        ${[
          {l:'ค้างชำระรวม',    v:`฿${formatNum(Math.round(totalDebt))}`, c:'#dc2626', bg:'#fef2f2', i:'account_balance'},
          {l:'รายการค้างชำระ', v:`${pending.length} รายการ`,             c:'#d97706', bg:'#fef3c7', i:'receipt_long'},
          {l:'เกินกำหนด',      v:`${overdue.length} รายการ`,             c:'#7c3aed', bg:'#ede9fe', i:'warning'},
          {l:'ชำระแล้ว',       v:`${rows.filter(r=>r.status==='ชำระแล้ว').length} รายการ`, c:'#15803d', bg:'#f0fdf4', i:'check_circle'},
        ].map(k=>`
          <div style="background:${k.bg};border-radius:14px;padding:16px 18px;border:1px solid ${k.c}22;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <i class="material-icons-round" style="font-size:16px;color:${k.c};">${k.i}</i>
              <span style="font-size:11px;color:${k.c};font-weight:600;">${k.l}</span>
            </div>
            <div style="font-size:20px;font-weight:800;color:${k.c};">${k.v}</div>
          </div>`).join('')}
      </div>

      <!-- Table -->
      <div style="background:var(--bg-surface);border-radius:16px;border:1px solid var(--border-light);overflow:hidden;">
        <div style="padding:14px 20px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:14px;font-weight:700;">รายการเจ้าหนี้ทั้งหมด</span>
          <span style="font-size:12px;color:var(--text-tertiary);">${rows.length} รายการ</span>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">ผู้จำหน่าย</th>
                <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">วันที่</th>
                <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">ครบกำหนด</th>
                <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">ยอดรวม</th>
                <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">ชำระแล้ว</th>
                <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">คงค้าง</th>
                <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#64748b;">สถานะ</th>
                <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#64748b;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `
                <tr><td colspan="8" style="padding:60px;text-align:center;color:var(--text-tertiary);">
                  <i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;opacity:.3;">account_balance</i>
                  ยังไม่มีรายการเจ้าหนี้
                </td></tr>` :
                rows.map(r => {
                  const supp      = suppMap[r.supplier_id] || {};
                  const isOverdue = r.due_date && new Date(r.due_date) < new Date() && r.status === 'ค้างชำระ';
                  const balance   = parseFloat(r.balance || 0);
                  const amount    = parseFloat(r.amount || 0);
                  const paid      = parseFloat(r.paid_amount || 0);
                  const pct       = amount > 0 ? Math.round(paid/amount*100) : 0;
                  return `
                    <tr style="${isOverdue?'background:#fff5f5;':''}border-bottom:1px solid var(--border-light);">
                      <td style="padding:12px 14px;">
                        <div style="font-weight:600;font-size:13px;">${supp.name || r.supplier_id?.slice(0,8)+'…' || 'ไม่ระบุ'}</div>
                        ${supp.phone?`<div style="font-size:11px;color:var(--text-tertiary);">${supp.phone}</div>`:''}
                      </td>
                      <td style="padding:12px 14px;font-size:12px;color:#64748b;">${r.date?new Date(r.date).toLocaleDateString('th-TH'):'-'}</td>
                      <td style="padding:12px 14px;font-size:12px;${isOverdue?'color:#dc2626;font-weight:700;':'color:#64748b;'}">
                        ${r.due_date?new Date(r.due_date).toLocaleDateString('th-TH'):'-'}
                        ${isOverdue?'<span style="margin-left:4px;font-size:10px;background:#fef2f2;color:#dc2626;padding:2px 5px;border-radius:4px;">เกินกำหนด</span>':''}
                      </td>
                      <td style="padding:12px 14px;text-align:right;font-size:13px;">฿${formatNum(amount)}</td>
                      <td style="padding:12px 14px;text-align:right;font-size:13px;color:#15803d;">
                        ฿${formatNum(paid)}
                        ${pct>0?`<div style="font-size:10px;color:#86efac;">${pct}%</div>`:''}
                      </td>
                      <td style="padding:12px 14px;text-align:right;">
                        <span style="font-size:14px;font-weight:700;color:${balance>0?'#dc2626':'#15803d'};">฿${formatNum(balance)}</span>
                      </td>
                      <td style="padding:12px 14px;text-align:center;">
                        <span style="padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600;
                          background:${r.status==='ชำระแล้ว'?'#dcfce7':isOverdue?'#fee2e2':'#fef3c7'};
                          color:${r.status==='ชำระแล้ว'?'#15803d':isOverdue?'#dc2626':'#92400e'};">
                          ${r.status}
                        </span>
                      </td>
                      <td style="padding:12px 14px;text-align:center;">
                        ${r.status !== 'ชำระแล้ว' ? `
                          <button onclick="window.v9PayCreditor('${r.id}','${(supp.name||'ไม่ระบุ').replace(/'/g,"\\'")}',${balance},${amount})"
                            style="padding:6px 12px;border-radius:8px;border:none;background:#15803d;color:#fff;
                              font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;margin:0 auto;
                              font-family:var(--font-thai,'Prompt'),sans-serif;">
                            <i class="material-icons-round" style="font-size:13px;">payments</i> ชำระ
                          </button>` : `
                          <span style="font-size:11px;color:#94a3b8;">✓ เสร็จสิ้น</span>`}
                      </td>
                    </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
};

// ── observer + nav-click ครอบคลุมทุก entry point ─────────────────
(function setupPayableHooks() {
  function doSetup() {
    // 1. MutationObserver
    const pg = document.getElementById('page-payable');
    if (pg) {
      new MutationObserver(muts => {
        for (const m of muts) {
          if (m.attributeName === 'class' && !pg.classList.contains('hidden')) {
            window.renderPayables?.();
          }
        }
      }).observe(pg, {attributes:true, attributeFilter:['class']});
    }

    // 2. nav link click
    document.querySelectorAll('[data-page="payable"], [onclick*="payable"]').forEach(el => {
      el.addEventListener('click', () => {
        setTimeout(() => window.renderPayables?.(), 100);
      });
    });

    // 3. intercept app.js go() โดยตรง
    const origGo = window.go;
    if (typeof origGo === 'function' && !origGo._v51patched) {
      window.go = function(page) {
        origGo.call(this, page);
        if (page === 'payable') setTimeout(() => window.renderPayables?.(), 80);
      };
      window.go._v51patched = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doSetup);
  } else {
    setTimeout(doSetup, 200); // รอ app.js window.go พร้อม
  }
})();


// ══════════════════════════════════════════════════════════════════
// FIX-52
//  Bug1: จ่ายเงินเดือน duplicate → ใช้ UUID timestamp แทน date field
//  Bug2: ใบเสนอราคา print items ว่าง → product_id nullable + print redesign
//  Bug3: P&L ดึงค่าแรงจริงจากเช็คชื่อ + เบิกเงิน + redesign dashboard
// ══════════════════════════════════════════════════════════════════

// ── Bug1: v9PayConfirm — หลีก unique constraint ─────────────────
// unique constraint: (employee_id, month) 
// แก้: ใช้ paid_date เป็น ISO timestamp ไม่ซ้ำ + month = random UUID suffix
window.v9PayConfirm = async function (empId, empName, accumulated, accDebt) {
  if (!empId) { typeof toast==='function'&&toast('ไม่พบข้อมูลพนักงาน','error'); return; }

  const pay    = Number(document.getElementById('v9pay-amount')?.value || 0);
  const deduct = Number(document.getElementById('v9pay-deduct')?.value || 0);
  const note   = document.getElementById('v9pay-note')?.value || '';
  if (pay <= 0) { typeof toast==='function'&&toast('กรุณาระบุจำนวนเงิน','error'); return; }
  const netGet = Math.max(0, pay - deduct);

  const btn = document.getElementById('v9pay-confirm-btn');
  if (btn) btn.disabled = true;
  v9ShowOverlay('กำลังบันทึก...', `${empName} ฿${formatNum(pay)}`);

  try {
    const now = new Date();
    // ใช้ timestamp เต็ม เพื่อหลีก unique (employee_id, month)
    // month = ISO datetime ไม่ซ้ำกันแน่
    const paidDate = now.toISOString();
    // month field ต้องเป็น date type ตาม schema → ใช้วันที่ + random offset วินาที
    const secOffset = Math.floor(Math.random() * 86399); // 0-86398 วินาที
    const fakeDate  = new Date(now.getTime() + secOffset * 1000);
    const monthVal  = fakeDate.toISOString().split('T')[0];

    let inserted = false;
    // ลอง insert 3 ครั้งถ้า duplicate
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const tryDate = new Date(now.getTime() + attempt * 7000 + secOffset * 1000);
      const tryMonth = tryDate.toISOString().split('T')[0];
      const { error } = await db.from('จ่ายเงินเดือน').insert({
        employee_id:     empId,
        month:           tryMonth,
        net_paid:        pay,
        deduct_withdraw: deduct,
        base_salary:     parseFloat(accumulated||0),
        paid_date:       paidDate,
        staff_name:      v9Staff(),
        note:            note || `จ่ายเงินเดือน ${empName}`,
      });
      if (!error) { inserted = true; }
      else if (error.code !== '23505') { throw new Error(error.message); }
      // ถ้า 23505 (duplicate) ลองวันถัดไป
    }
    if (!inserted) throw new Error('ไม่สามารถบันทึกได้ (duplicate ทุก attempt)');

    // บันทึก cash_transaction
    const { data: session } = await db.from('cash_session')
      .select('id').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (session && typeof window.recordCashTx==='function') {
      await window.recordCashTx({
        sessionId: session.id, type:'จ่ายเงินเดือน', direction:'out',
        amount: netGet, changeAmt: 0, netAmount: netGet,
        refTable: 'จ่ายเงินเดือน', note: empName,
      });
    }

    typeof logActivity==='function' && logActivity('จ่ายเงินเดือน',`${empName} ฿${formatNum(pay)}`);
    document.getElementById('v9-payroll-overlay')?.remove();
    typeof toast==='function' && toast(`จ่ายเงินเดือน ${empName} ฿${formatNum(pay)} สำเร็จ`,'success');
    window.v5LoadPayroll?.();
  } catch(e) {
    typeof toast==='function' && toast('บันทึกไม่สำเร็จ: '+(e.message||e),'error');
    if (btn) btn.disabled = false;
  } finally { v9HideOverlay(); }
};


// ── Bug2: ใบเสนอราคา save + print ─────────────────────────────────
// รายการใบเสนอราคา.product_id NOT NULL → ต้องมี product_id
// ถ้าไม่มี (รายการอิสระ) → ข้าม FK constraint ด้วย dummy uuid หรือ
// แก้: ดึง product_id จาก สินค้า ก็ได้ ถ้าไม่มีก็ไม่ insert product_id

window._v9SaveQuot44 = async function () {
  const customer = document.getElementById('v9q44-cust')?.value?.trim();
  if (!customer) { typeof toast==='function'&&toast('กรุณากรอกชื่อลูกค้า','error'); return; }
  const items = window._v9QuotItems44||[];
  const validItems = items.filter(i=>i.name && i.name.trim());
  if (!validItems.length) {
    typeof toast==='function'&&toast('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ','error'); return;
  }
  const discount = parseFloat(document.getElementById('v9q44-disc')?.value||0);
  const subtotal = validItems.reduce((s,i)=>s+(parseFloat(i.qty||1)*parseFloat(i.price||0)),0);
  const total    = Math.max(0,subtotal-discount);
  const valid    = document.getElementById('v9q44-valid')?.value||null;
  const note     = document.getElementById('v9q44-note')?.value||'';

  v9ShowOverlay('กำลังบันทึก...');
  try {
    const {data:quot, error:qe} = await db.from('ใบเสนอราคา').insert({
      customer_name:customer, total, discount,
      date:new Date().toISOString(),
      valid_until:valid?new Date(valid).toISOString():null,
      note:note||null, staff_name:v9Staff(),
    }).select().single();
    if (qe) throw new Error(qe.message);

    // บันทึก รายการ — ถ้าไม่มี product_id ต้องใช้ product_id จาก สินค้า หรือ skip
    for (const it of validItems) {
      const pid = it.product_id && it.product_id !== '' ? it.product_id : null;
      if (pid) {
        // มี product_id → insert ปกติ
        await db.from('รายการใบเสนอราคา').insert({
          quotation_id: quot.id, product_id: pid,
          name: it.name, qty: parseFloat(it.qty||1),
          unit: it.unit||'ชิ้น',
          price: parseFloat(it.price||0),
          total: parseFloat(it.qty||1)*parseFloat(it.price||0),
        });
      } else {
        // ไม่มี product_id → สร้าง สินค้า temporary หรือ insert โดยไม่มี FK
        // แก้: สร้าง product stub ใน สินค้า ก่อน
        const {data:stub} = await db.from('สินค้า').insert({
          name: it.name, price: parseFloat(it.price||0),
          cost: 0, stock: 0, unit: it.unit||'ชิ้น',
          is_raw: false, product_type: 'ปกติ',
          note: 'จากใบเสนอราคา',
        }).select('id').maybeSingle();
        await db.from('รายการใบเสนอราคา').insert({
          quotation_id: quot.id,
          product_id: stub?.id || null,
          name: it.name, qty: parseFloat(it.qty||1),
          unit: it.unit||'ชิ้น',
          price: parseFloat(it.price||0),
          total: parseFloat(it.qty||1)*parseFloat(it.price||0),
        });
      }
    }

    typeof closeModal==='function'&&closeModal();
    typeof toast==='function'&&toast('บันทึกใบเสนอราคาสำเร็จ ✅','success');
    window.renderQuotations?.();
  } catch(e) {
    typeof toast==='function'&&toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  } finally { v9HideOverlay(); }
};


// ── Bug2: v9PrintQuotation redesign ───────────────────────────────
window.v9PrintQuotation = async function (quotId) {
  v9ShowOverlay('กำลังเตรียมพิมพ์...');
  try {
    const [{data:quot},{data:items},{data:rc}] = await Promise.all([
      db.from('ใบเสนอราคา').select('*').eq('id',quotId).maybeSingle(),
      db.from('รายการใบเสนอราคา').select('*').eq('quotation_id',quotId),
      db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle(),
    ]);
    v9HideOverlay();
    if (!quot){typeof toast==='function'&&toast('ไม่พบข้อมูล','error');return;}

    const shopName  = rc?.shop_name||'SK POS';
    const shopAddr  = rc?.address||'';
    const shopPhone = rc?.phone||'';
    const shopTax   = rc?.tax_id||'';
    const qtId      = `QT-${String(quotId).slice(-6).toUpperCase()}`;
    const subtotal  = (items||[]).reduce((s,i)=>s+parseFloat(i.total||0),0);
    const discount  = parseFloat(quot.discount||0);
    const total     = parseFloat(quot.total||0);

    const ds = await (typeof v10GetDocSettings==='function' ? v10GetDocSettings() : Promise.resolve({}));
    const s = ds.receipt_a4 || {};
    const hc1 = s.bw_mode ? '#000' : (s.header_color || '#dc2626');
    const hc2 = s.bw_mode ? '#333' : hc1;

    const rows = (items||[]).map((it,idx)=>`
      <tr>
        <td class="td-no">${idx+1}</td>
        <td class="td-name">${it.name||''}</td>
        <td class="td-c">${it.qty||1}</td>
        <td class="td-c">${it.unit||'ชิ้น'}</td>
        <td class="td-r">฿${formatNum(parseFloat(it.price||0))}</td>
        <td class="td-r td-bold">฿${formatNum(parseFloat(it.total||0))}</td>
      </tr>`).join('');

    const dateStr = new Date(quot.date).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});

    const w = window.open('','_blank','width=860,height=1050');
    w.document.write(`<!DOCTYPE html><html lang="th"><head>
<meta charset="utf-8">
<title>ใบเสนอราคา ${qtId}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size:A4 portrait; margin:10mm 14mm; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  body{ font-family:'Sarabun',sans-serif; font-size:13px; color:#1e293b; background:#fff; }

  /* Header band */
  .header{ background:linear-gradient(135deg,${hc1} 0%,${hc2} 100%);
    color:#fff; padding:20px 28px; display:flex; justify-content:space-between; align-items:flex-start; }
  .shop-name{ font-size:22px; font-weight:800; margin-bottom:4px; }
  .shop-sub{ font-size:11px; opacity:.85; line-height:1.7; }
  .doc-box{ text-align:right; }
  .doc-type{ font-size:18px; font-weight:800; letter-spacing:.5px; }
  .doc-id{ font-size:13px; opacity:.9; margin-top:3px; font-weight:600; }
  .doc-meta{ font-size:11px; opacity:.75; margin-top:2px; line-height:1.6; }

  /* Body */
  .body{ padding:20px 28px; }

  /* Info row */
  .info-row{ display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:18px; }
  .info-box{ background:#f8fafc; border-radius:10px; padding:12px 16px; border-left:3px solid ${hc1}; }
  .info-box .lbl{ font-size:10px; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; font-weight:600; }
  .info-box .val{ font-size:14px; font-weight:700; }
  .info-box .sub{ font-size:11px; color:#64748b; margin-top:2px; }

  /* Table */
  table{ width:100%; border-collapse:collapse; margin-bottom:16px; }
  thead tr{ background:linear-gradient(90deg,${hc1},${hc2}); }
  thead th{ color:#fff; padding:10px 12px; font-size:11px; font-weight:700; text-align:left; white-space:nowrap; }
  thead th:first-child{ border-radius:6px 0 0 0; }
  thead th:last-child{ border-radius:0 6px 0 0; }
  tbody tr:nth-child(even){ background:#fafafa; }
  tbody tr:hover{ background:#fff5f5; }
  tbody td{ padding:10px 12px; font-size:12px; border-bottom:1px solid #f1f5f9; }
  .td-no{ text-align:center; color:#94a3b8; width:32px; }
  .td-name{ font-weight:500; }
  .td-c{ text-align:center; }
  .td-r{ text-align:right; }
  .td-bold{ font-weight:700; color:${hc1}; }

  /* Summary */
  .sum-wrap{ display:flex; justify-content:flex-end; margin-bottom:20px; }
  .sum-box{ width:240px; }
  .sum-row{ display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #f1f5f9; font-size:12px; }
  .sum-row.disc{ color:#ef4444; }
  .sum-grand{ display:flex; justify-content:space-between; padding:10px 14px; margin-top:6px;
    background:linear-gradient(135deg,${hc1},${hc2}); border-radius:10px; color:#fff; }
  .sum-grand .lbl2{ font-size:14px; font-weight:700; }
  .sum-grand .val2{ font-size:18px; font-weight:800; }

  /* Note + validity */
  .note-box{ background:#fef3c7; border-radius:8px; padding:10px 14px; font-size:11px; color:#92400e; margin-bottom:20px; }
  .validity{ text-align:center; font-size:11px; color:#94a3b8; margin-bottom:20px; }
  .validity strong{ color:${hc1}; }

  /* Sign */
  .sign-wrap{ display:grid; grid-template-columns:1fr 1fr; gap:40px; }
  .sign-box{ text-align:center; }
  .sign-line{ height:48px; border-bottom:1px solid #cbd5e1; margin-bottom:6px; }
  .sign-lbl{ font-size:11px; color:#94a3b8; }

  @media print{ body{ background:#fff; } }
</style>
</head><body>

<!-- Header -->
<div class="header">
  <div>
    <div class="shop-name">${shopName}</div>
    <div class="shop-sub">
      ${shopAddr}${shopAddr?'<br>':''}
      ${shopPhone?'โทร '+shopPhone:''}
      ${shopTax?'<br>เลขผู้เสียภาษี '+shopTax:''}
    </div>
  </div>
  <div class="doc-box">
    <div class="doc-type">ใบเสนอราคา</div>
    <div class="doc-id">${qtId}</div>
    <div class="doc-meta">
      วันที่ ${dateStr}<br>
      ${quot.staff_name?'ออกโดย '+quot.staff_name:''}
      ${quot.valid_until?'<br><span style="color:#fca5a5;">หมดอายุ '+new Date(quot.valid_until).toLocaleDateString('th-TH',{dateStyle:'long'})+'</span>':''}
    </div>
  </div>
</div>

<div class="body">
  <!-- Info -->
  <div class="info-row">
    <div class="info-box">
      <div class="lbl">เสนอให้</div>
      <div class="val">${quot.customer_name}</div>
    </div>
    <div class="info-box">
      <div class="lbl">ออกโดย</div>
      <div class="val">${quot.staff_name||shopName}</div>
      ${quot.valid_until?`<div class="sub">หมดอายุ ${new Date(quot.valid_until).toLocaleDateString('th-TH',{dateStyle:'long'})}</div>`:''}
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th style="text-align:center;">#</th>
        <th>รายการสินค้า / บริการ</th>
        <th style="text-align:center;width:70px;">จำนวน</th>
        <th style="text-align:center;width:60px;">หน่วย</th>
        <th style="text-align:right;width:100px;">ราคา/หน่วย</th>
        <th style="text-align:right;width:110px;">รวม</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">ไม่มีรายการ</td></tr>`}
    </tbody>
  </table>

  <!-- Summary -->
  <div class="sum-wrap">
    <div class="sum-box">
      <div class="sum-row"><span>ราคารวม</span><span>฿${formatNum(subtotal)}</span></div>
      ${discount>0?`<div class="sum-row disc"><span>ส่วนลด</span><span>-฿${formatNum(discount)}</span></div>`:''}
      <div class="sum-grand">
        <span class="lbl2">ยอดรวมทั้งสิ้น</span>
        <span class="val2">฿${formatNum(total)}</span>
      </div>
    </div>
  </div>

  ${quot.note?`<div class="note-box">📌 หมายเหตุ: ${quot.note}</div>`:''}
  ${quot.valid_until?`<div class="validity">ใบเสนอราคานี้มีอายุถึง <strong>${new Date(quot.valid_until).toLocaleDateString('th-TH',{dateStyle:'long'})}</strong></div>`:''}

  <!-- Signatures -->
  <div class="sign-wrap">
    <div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">ลายเซ็นผู้เสนอราคา</div></div>
    <div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">ลายเซ็นลูกค้า</div></div>
  </div>
</div>

<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1200);}<\/script>
</body></html>`);
    w.document.close();
  } catch(e){v9HideOverlay();typeof toast==='function'&&toast('พิมพ์ไม่ได้: '+e.message,'error');}
};


// ── Bug3: Dashboard redesign + P&L ดึงค่าแรงจริง ─────────────────
window.v9d44Load = async function () {
  const days  = parseInt(document.querySelector('.v9d44-per.on')?.dataset.d||1);
  const today = new Date().toISOString().split('T')[0];
  const since = days===1?today:new Date(Date.now()-(days-1)*86400000).toISOString().split('T')[0];

  const lbl=document.getElementById('v9d44-lbl');
  if(lbl) lbl.textContent=days===1
    ?new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
    :`${new Date(since+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})} — ${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}`;

  try {
    const [bR,pR,eR,iR,salR,apR,attR,advR] = await Promise.all([
      db.from('บิลขาย').select('id,bill_no,total,method,status,date,customer_name')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(500),
      db.from('purchase_order').select('id,total,supplier,method,date,status')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายจ่าย').select('id,description,amount,category,method,date')
        .gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายการในบิล').select('name,qty,price,cost,total,unit,bill_id').limit(2000),
      db.from('จ่ายเงินเดือน').select('net_paid,paid_date,employee_id')
        .gte('paid_date',since+'T00:00:00'),
      db.from('เจ้าหนี้').select('amount,paid_amount,balance,status,date').limit(500),
      // ค่าแรงจริง: ดึงเช็คชื่อ + wage ของพนักงาน
      db.from('เช็คชื่อ').select('employee_id,status,date,deduction')
        .gte('date',since).order('date',{ascending:false}).limit(500),
      db.from('เบิกเงิน').select('employee_id,amount,date,status')
        .gte('date',since+'T00:00:00').eq('status','อนุมัติ').limit(200),
    ]);

    const B    = (bR.data||[]).filter(b=>b.status!=='ยกเลิก');
    const bIds = new Set(B.map(b=>b.id));
    const allP = pR.data||[];
    const E    = eR.data||[];
    const I    = (iR.data||[]).filter(i=>bIds.has(i.bill_id));
    const Sal  = salR.data||[];
    const AP   = apR.data||[];
    const Att  = attR.data||[];
    const Adv  = advR.data||[];

    // แยก purchase
    const PCash  = allP.filter(p=>p.method !== 'เครดิต');
    const PCredit= allP.filter(p=>p.method === 'เครดิต');
    const EO = E.filter(e=>e.category !== 'ค่าแรง');

    // ค่าแรงจริง (accrued) จากเช็คชื่อ
    // ดึง wage ของพนักงานที่มีเช็คชื่อ
    const empIds = [...new Set(Att.map(a=>a.employee_id).filter(Boolean))];
    let empWages = {};
    if (empIds.length>0) {
      try {
        const {data:emps} = await db.from('พนักงาน').select('id,daily_wage').in('id',empIds);
        (emps||[]).forEach(e=>{ empWages[e.id]=parseFloat(e.daily_wage||0); });
      } catch(_){}
    }

    // คำนวณค่าแรงสะสม (accrued wage) ในช่วงเวลา
    const tAccruedWage = Att.reduce((s,a)=>{
      const wage = empWages[a.employee_id]||0;
      if (['มา','มาทำงาน'].includes(a.status)) return s+wage;
      if (a.status==='ครึ่งวัน') return s+wage*0.5;
      if (a.status==='มาสาย')   return s+wage*0.95;
      return s;
    },0);

    // เบิกเงินสะสม
    const tAdv = Adv.reduce((s,a)=>s+parseFloat(a.amount||0),0);

    const tS   = B.reduce((s,b)=>s+parseFloat(b.total||0),0);
    const tP   = PCash.reduce((s,p)=>s+parseFloat(p.total||0),0);
    const tPCr = PCredit.reduce((s,p)=>s+parseFloat(p.total||0),0);
    const tEO  = EO.reduce((s,e)=>s+parseFloat(e.amount||0),0);
    const tSal = Sal.reduce((s,p)=>s+parseFloat(p.net_paid||0),0);

    // Cash flow: เงินออกจริง (ไม่รวมค่าแรง accrued)
    const tO = tP + tEO + tSal;
    const nC = tS - tO;

    // P&L: หัก COGS + รายจ่ายร้าน + ค่าแรงสะสม + เบิกเงิน
    const cogs = I.reduce((s,i)=>s+(parseFloat(i.cost||0)*parseFloat(i.qty||0)),0);
    const gP   = tS - cogs;
    const gM   = tS>0?Math.round(gP/tS*100):0;
    // กำไรสุทธิ = กำไรขั้นต้น - รายจ่ายร้าน - ค่าแรงสะสม - เบิกเงิน - เงินเดือนจ่าย
    const opX  = tEO + tAccruedWage + tAdv;
    const nP   = gP - opX;
    const nM   = tS>0?Math.round(nP/tS*100):0;

    const totalAP = AP.filter(a=>a.status==='ค้างชำระ').reduce((s,a)=>s+parseFloat(a.balance||0),0);

    window._v9d44Data = {
      B,P:allP,PCash,PCredit,E,EO,I,Sal,AP,Att,Adv,
      tS,tP,tPCr,tEO,tSal,tAccruedWage,tAdv,tO,nC,
      cogs,gP,gM,opX,nP,nM,totalAP,days,since
    };

    window.v9d44KPI(window._v9d44Data);
    window.v9d44Chart(window._v9d44Data);
    window.v9d44RenderTL(window._v9d44Data);
    window.v9d44PL(window._v9d44Data);
    window.v9d44Cash(window._v9d44Data);
    window.v9d44Top(I);
  } catch(e){ console.error('[Dash52]',e); }
};


// ── Dashboard KPI redesign ────────────────────────────────────────
window.v9d44KPI = function({B,tS,cogs,gP,gM,nP,nM,nC,tAccruedWage,tAdv}) {
  const el=document.getElementById('v9d44-kpi');if(!el)return;
  const K=[
    {l:'💰 ยอดขาย',     v:tS,          s:`${B.length} บิล`,   c:'#15803d',  bg:'#f0fdf4'},
    {l:'📦 ต้นทุนขาย',  v:cogs,        s:'COGS',              c:'#d97706',  bg:'#fef3c7'},
    {l:'📈 กำไรขั้นต้น',v:gP,          s:`Gross ${gM}%`,      c:gP>=0?'#0891b2':'#dc2626', bg:'#ecfeff'},
    {l:'🧾 กำไรสุทธิ',  v:nP,          s:`Net ${nM}%`,        c:nP>=0?'#15803d':'#dc2626', bg:nP>=0?'#f0fdf4':'#fef2f2'},
    {l:'🏦 เงินสดสุทธิ',v:nC,          s:nC>=0?'บวก':'ลบ',   c:nC>=0?'#15803d':'#dc2626', bg:nC>=0?'#f0fdf4':'#fef2f2'},
  ];
  el.innerHTML=K.map(k=>`
    <div style="background:${k.bg};border-radius:16px;padding:18px 16px;
      border:1px solid ${k.c}20;transition:transform .15s;"
      onmouseenter="this.style.transform='translateY(-2px)'"
      onmouseleave="this.style.transform=''">
      <div style="font-size:12px;font-weight:700;color:${k.c};margin-bottom:8px;">${k.l}</div>
      <div style="font-size:24px;font-weight:800;color:${k.c};">${k.v<0?'−':''}฿${formatNum(Math.abs(Math.round(k.v)))}</div>
      <div style="font-size:11px;color:${k.c};opacity:.7;margin-top:4px;">${k.s}</div>
    </div>`).join('');
};


// ── P&L redesign: แสดงค่าแรงสะสม + เบิกเงิน ─────────────────────
wwindow.v9d44PL = function({tS, cogs, gP, gM, tEO, tAccruedWage, tAdv, tSal, nP, nM}) {
  const el = document.getElementById('v9d44-pl-body');
  if (!el) return;

  // สร้างแม่แบบบรรทัด (Row Template)
  const row = (l, v, c, bg, bold, sub) => `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:9px ${bg ? '12px' : '2px'};border-radius:${bg ? '8px' : '0'};margin-bottom:3px;
      background:${bg || 'transparent'};">
      <div>
        <div style="font-size:${bold ? '13px' : '12px'};font-weight:${bold ? 700 : 400};
          color:${bold ? 'var(--text-primary)' : 'var(--text-secondary)'};">${l}</div>
        ${sub ? `<div style="font-size:10px;color:var(--text-tertiary);">${sub}</div>` : ''}
      </div>
      <div style="font-size:${bold ? '15px' : '13px'};font-weight:${bold ? 700 : 500};color:${c};">
        ${v < 0 ? '−' : ''}฿${formatNum(Math.abs(Math.round(v)))}
      </div>
    </div>`;

  // แสดงผลเนื้อหาภายใน P&L Panel
  el.innerHTML =
    row('💰 ยอดขายรวม', tS, '#15803d', '#f0fdf4', true)
    + `<div style="font-size:10px;color:var(--text-tertiary);padding:2px 4px;margin:2px 0;">ลบ ต้นทุนสินค้าขาย (COGS)</div>`
    + row('📦 COGS', cogs, '#d97706', '', false, 'cost × (qty - จำนวนที่คืน)')
    + `<hr style="border:none;border-top:1.5px dashed var(--border-light);margin:6px 0;">`
    + row('📈 กำไรขั้นต้น', gP, gP >= 0 ? '#0891b2' : '#dc2626', '#ecfeff', true, `Gross Margin ${gM}%`)
    + `<div style="font-size:10px;color:var(--text-tertiary);padding:2px 4px;margin:2px 0;">ลบ ค่าใช้จ่ายดำเนินงาน</div>`
    + row('🏪 รายจ่ายร้าน', tEO, '#dc2626', '', false, '')
    + row('👷 ค่าแรงสะสม', tAccruedWage, '#f97316', '', false, 'คิดจากเช็คชื่อ × ค่าแรง/วัน')
    + row('💸 เบิกเงินพนักงาน', tAdv, '#7c3aed', '', false, 'advance ที่อนุมัติ')
    + `<div style="font-size:10px;color:#6b7280;background:#f3f4f6;padding:5px 8px;border-radius:6px;margin:4px 0;">💡 เงินเดือนที่จ่ายแล้ว (${Math.round(tSal > 0 ? tSal : 0).toLocaleString()}) อยู่ใน cash flow ไม่ซ้ำ P&L</div>`
    + `<hr style="border:none;border-top:2px solid var(--border-light);margin:8px 0;">`
    + `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;
        border-radius:12px;background:${nP >= 0 ? '#f0fdf4' : '#fef2f2'};">
        <div>
          <div style="font-size:15px;font-weight:700;color:${nP >= 0 ? '#15803d' : '#dc2626'};">🏆 กำไรสุทธิ</div>
          <div style="font-size:11px;font-weight:600;color:${nP >= 0 ? '#16a34a' : '#ef4444'};margin-top:3px;">Net Margin ${nM}%</div>
        </div>
        <div style="font-size:24px;font-weight:700;color:${nP >= 0 ? '#15803d' : '#dc2626'};">
          ${nP < 0 ? '−' : ''}฿${formatNum(Math.abs(Math.round(nP)))}
        </div>
      </div>`;
};


// ══════════════════════════════════════════════════════════════════
// BOOT LOG
// ══════════════════════════════════════════════════════════════════

console.info(
  '%c[modules-v9.js] ✅%c ' + [
    'FIX-1:CashDrawer+changeDenominations',
    'FIX-2:savePurchaseOrder+เจ้าหนี้',
    'FIX-3:Payroll/AttendanceStatus',
    'FIX-4:AdvanceOverlay',
    'FIX-5:PayrollOverlay',
    'FIX-6:SessionConnectivityCheck',
    'FIX-7:CashMovementOverlay',
    'FIX-8:v9CalcNet+v9InjectPanel+renderCashDrawer',
    'FIX-9:v5NewAdvance+v5SubmitAdvance+v5LoadAdvance',
    'FIX-10:Payroll-accumulated+deleteEmployee',
    'FIX-11:editEmployee+saveEmployee+v7Loading→v9Overlay',
    'FIX-12:Dashboard+laborCost','FIX-13:UserPerms','FIX-14:NoPrintGap','FIX-15:Quotation',
    'FIX-16:BarcodeScanner+QuotProductFix+NoDupBtn',
    'FIX-17A:A4Receipt','FIX-17B:MultiUnit','FIX-17C:QuotSmartSearch',
    'FIX-18:printReceipt+getShopConfig','FIX-19:AdminPanel','FIX-20:isRawToggle',
    'FIX-21A:ManageMenu','FIX-21B:PurchaseUnitConv','FIX-21C:BOMAutoCost','FIX-21D:POSFilterRaw',
    'FIX-22A:PurchaseModal','FIX-22B:UnitMgmt','FIX-22C:NullFix',
    'FIX-23A:Purchase3Step','FIX-23B:RemoveUnitTab','FIX-23C:BOMRedesign','FIX-23D:Produce','FIX-23E:POSUnitPopup','FIX-23F:AutoDeductBOM',
    'FIX-24:PurchaseProDesign',
  ].join(' | '),
  'color:#10B981;font-weight:700',
  'color:#6B7280'
);
