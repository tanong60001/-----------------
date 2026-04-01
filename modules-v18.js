/**
 * SK POS — modules-v18.js  (โหลดหลัง modules-v17.js)
 * ══════════════════════════════════════════════════════════════════
 *  V18-1  CHECKOUT STEP FIX   — แก้ root cause ที่แท้จริง:
 *         non-cash ต้องตั้ง step = v12GetMaxStep() ไม่ใช่ 6
 *         เพราะ v12IsLastStep() = (step === v12GetMaxStep())
 *         non-cash: max=5 → step=5 → renderFn=v12S6 ✓
 *         cash:     max=6 → step=6 → renderFn=v12S6 ✓
 *
 *  V18-2  DASHBOARD UTC FIX   — ใช้ Proxy patch db.from().gte()
 *         แปลง 'YYYY-MM-DDT00:00:00' (local) → UTC ISO
 *         '2026-03-29T00:00:00+07:00' → Supabase เข้าใจถูก
 *
 *  V18-3  PROJECT SELLING PRICE — บันทึกราคาขาย (total) ไม่ใช่ cost
 *         เข้าโครงการ เพื่อหักจากงบประมาณ
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

/* ════════════════════════════════════════════════════════════════
   V18-1: CHECKOUT STEP FIX
   
   Root cause: ทุก v13-v17 ตั้ง v12State.step = 6 hardcode
   แต่ v12GetMaxStep() คืน 5 สำหรับ non-cash
   → v12IsLastStep() = (6 === 5) = FALSE ตลอด
   → v12RenderStepBody เข้า else branch → backBtn = ย้อนกลับ
   → map[6] = undefined → body ว่าง
   
   Fix: ตั้ง v12State.step = _v18MaxStep() ซึ่ง delegate ไปที่
        v12GetMaxStep() ถ้ามี หรือ คำนวณเอง
════════════════════════════════════════════════════════════════ */

function _v18MaxStep() {
  /* ใช้ v12GetMaxStep ของ original ถ้ามี */
  if (typeof v12GetMaxStep === 'function') return v12GetMaxStep();
  /* fallback: cash=6, others=5 */
  return v12State.method === 'cash' ? 6 : 5;
}

/* Override v12NextStep — self-contained, เรียก v12CompletePayment ล่าสุด */
window.v12NextStep = function() {
  const t = typeof toast === 'function' ? toast : m => alert(m);

  /* Step 1: general → ข้าม 2,3 ไป 4 */
  if (v12State.step === 1 && v12State.customer?.type === 'general') {
    v12State.step = 4;
    _v18ui(); return;
  }

  /* Step 2 validation */
  if (v12State.step === 2) {
    const nd = v12State.deliveryMode === 'deliver' || v12State.deliveryMode === 'partial';
    if (nd && !v12State.deliveryDate) { t('กรุณาระบุวันที่นัดส่ง', 'warning'); return; }
    if (nd && v12State.customer?.type === 'general') { t('บิลจัดส่งต้องระบุลูกค้า', 'warning'); return; }
  }

  /* Step 3 validation */
  if (v12State.step === 3 && v12State.paymentType === 'deposit') {
    const dep = Number(document.getElementById('v12-deposit-input')?.value || 0);
    if (!dep || dep <= 0) { t('กรุณาระบุยอดมัดจำ', 'warning'); return; }
    if (dep >= v12State.total) { t('ยอดมัดจำต้องน้อยกว่ายอดรวม', 'warning'); return; }
    v12State.depositAmount = dep;
  }

  /* Step 4: method validation */
  if (v12State.step === 4) {
    if (!v12State.method) { t('กรุณาเลือกวิธีชำระเงิน', 'warning'); return; }
  }

  /* Step 4 → complete (non-cash: debt / transfer / credit) */
  if (v12State.step === 4 && v12State.method !== 'cash') {
    const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    v12State.received = v12State.method === 'debt' ? 0 : payAmt;
    v12State.change   = 0;
    /* ← KEY FIX: ใช้ v12GetMaxStep() ไม่ใช่ 6 */
    v12State.step = _v18MaxStep();
    _v18ui(); /* แสดง "กำลังบันทึก..." ก่อน */
    window.v12CompletePayment(); /* เรียก latest override */
    return;
  }

  /* Step 5 (cash): validate received */
  if (v12State.step === 5) {
    const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    const allD   = (typeof V13_ALL !== 'undefined' ? V13_ALL : typeof V14_ALL !== 'undefined' ? V14_ALL : []);
    const recv   = allD.reduce((s,d) => s + d.value * (v12State.receivedDenominations?.[d.value] || 0), 0);
    if (recv < payAmt) { t('ยอดรับเงินไม่เพียงพอ', 'error'); return; }
    v12State.received = recv;
    v12State.change   = recv - payAmt;
    if (typeof calcChangeDenominations === 'function') {
      v12State.changeDenominations = calcChangeDenominations(v12State.change);
    }
    /* ← KEY FIX: cash max=6 ซึ่งตรงอยู่แล้ว */
    v12State.step = _v18MaxStep();
    _v18ui();
    window.v12CompletePayment();
    return;
  }

  /* Default: ไปขั้นต่อไป */
  v12State.step++;
  _v18ui();
};

window.v12PrevStep = function() {
  const gen = v12State.customer?.type === 'general';
  if ((v12State.step === 4 || v12State.step === 5) && gen) v12State.step = 1;
  else if (v12State.step === 5) v12State.step = 4;
  else if (v12State.step > 1)   v12State.step--;
  _v18ui();
};

function _v18ui() {
  if (typeof v12UpdateStepBar  === 'function') v12UpdateStepBar();
  if (typeof v12RenderStepBody === 'function') v12RenderStepBody();
}

/* patch _skSetMethod (v16) ให้ update ปุ่ม next ถูกต้อง */
const _v18OrigSM = window._skSetMethod;
window._skSetMethod = function(method) {
  v12State.method = method;
  /* อัพ card UI */
  document.querySelectorAll('.sk-pay-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.method === method);
  });
  /* อัพ info panel */
  const info = document.getElementById('sk-pay-info');
  if (info && typeof _skPayInfo === 'function') info.innerHTML = _skPayInfo(method);
  /* อัพ step bar */
  if (typeof v12UpdateStepBar === 'function') v12UpdateStepBar();
  /* อัพ next button โดยตรง — ไม่ re-render body */
  const nb = document.getElementById('v12-next-btn');
  if (nb && v12State.step === 4) {
    nb.disabled  = false;
    nb.className = method === 'cash' ? 'v12-btn-next' : 'v12-btn-next green';
    nb.innerHTML = method === 'cash'
      ? 'ถัดไป <i class="material-icons-round">arrow_forward</i>'
      : '<i class="material-icons-round">check</i> ยืนยันการขาย';
  }
};

/* patch v13SetMethod (เดิม) ให้ทำงานเหมือนกัน */
window.v13SetMethod = window.v12SetMethod = window._skSetMethod;


/* ════════════════════════════════════════════════════════════════
   V18-2: DASHBOARD UTC FIX — Proxy patch on db.from
   
   วิธีการ:
   - สร้าง Proxy ครอบ db ชั่วคราวระหว่าง renderDashboardV3
   - ทุก .gte() / .lte() ที่ column = 'date' | 'paid_date'
     จะแปลง 'YYYY-MM-DDThh:mm:ss' (local) → 'YYYY-MM-DDThh:mm:ss+TZ'
   - ทำให้ PostgreSQL (Supabase) ตีความเป็น local time ไม่ใช่ UTC
════════════════════════════════════════════════════════════════ */

/* หา timezone offset string: เช่น '+07:00' สำหรับ Bangkok */
function _v18tzStr() {
  const off = -(new Date().getTimezoneOffset()); // minutes
  const sign = off >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const mm = String(Math.abs(off) % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`; // e.g. '+07:00'
}

/* แปลง local datetime string → tz-aware */
function _v18fixDate(val) {
  if (!val || typeof val !== 'string') return val;
  /* ถ้ามี timezone แล้วไม่ต้องแก้ */
  if (val.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(val)) return val;
  if (!val.includes('T')) return val;
  return val + _v18tzStr();
}

/* สร้าง Proxy ที่ intercept .gte() และ .lte() */
function _v18wrapBuilder(builder) {
  const handler = {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== 'function') return orig;

      /* date-filter methods */
      if (['gte','gt','lte','lt'].includes(prop)) {
        return function(col, val, ...rest) {
          const fixed = (col === 'date' || col === 'paid_date') ? _v18fixDate(val) : val;
          const result = orig.call(target, col, fixed, ...rest);
          return _v18wrapBuilder(result);
        };
      }

      /* chain อื่นๆ ครอบ proxy ต่อ */
      return function(...args) {
        const result = orig.apply(target, args);
        if (result && typeof result === 'object' && result !== target) {
          return _v18wrapBuilder(result);
        }
        return result;
      };
    }
  };
  try { return new Proxy(builder, handler); }
  catch(_) { return builder; } /* fallback ถ้า Proxy ไม่รองรับ */
}

(function patchDashboard() {
  function tryPatch() {
    const origRender = window.renderDashboardV3;
    if (!origRender) { setTimeout(tryPatch, 300); return; }
    if (origRender._v18patched) return;

    window.renderDashboardV3 = async function() {
      /* Wrap db.from ชั่วคราว */
      const origFrom = db.from.bind(db);
      db.from = function(table) {
        return _v18wrapBuilder(origFrom(table));
      };
      try {
        await origRender.apply(this, arguments);
      } finally {
        db.from = origFrom; /* restore */
      }
    };
    window.renderDashboardV3._v18patched = true;
    console.log('[v18] Dashboard UTC patch ready. TZ offset:', _v18tzStr());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryPatch);
  else tryPatch();
})();


/* ════════════════════════════════════════════════════════════════
   V18-3: PROJECT PAYMENT — ใช้ราคาขาย (total) ลบงบประมาณ
   ไม่ใช่ cost — เพราะโครงการสนใจว่าซื้อสินค้าไปราคาเท่าไหร่
════════════════════════════════════════════════════════════════ */

/* Override v12CompletePayment สำหรับ project type */
const _v18OrigPay = window.v12CompletePayment;
window.v12CompletePayment = async function() {
  const isProj = (v12State.customer?.type === 'project' || v12State._forceDebt)
              && !!v12State.customer?.project_id;

  if (!isProj) return _v18OrigPay?.();

  if (window._v18busy) return;
  window._v18busy = true;
  try { if (typeof isProcessingPayment !== 'undefined') isProcessingPayment = true; } catch(_) {}

  _v18ui();

  try {
    const projId  = v12State.customer.project_id;
    const staff   = (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown';
    const cartArr = window.cart || (typeof cart !== 'undefined' ? cart : []);

    /* Unit map for stock deduction */
    const ids = [...new Set(cartArr.map(i => i.id).filter(Boolean))];
    const um = {}, bm = {};
    if (ids.length) {
      try {
        const [{ data: units }, { data: prods }] = await Promise.all([
          db.from('product_units').select('product_id,unit_name,conv_rate').in('product_id', ids),
          db.from('สินค้า').select('id,unit').in('id', ids),
        ]);
        (units || []).forEach(u => {
          if (!um[u.product_id]) um[u.product_id] = {};
          um[u.product_id][u.unit_name] = parseFloat(u.conv_rate) || 1;
        });
        (prods || []).forEach(p => { bm[p.id] = p.unit || 'ชิ้น'; });
      } catch(e) { console.warn('[v18] fetchUnits:', e.message); }
    }

    /* Insert bill */
    const { data: bill, error: be } = await db.from('บิลขาย').insert({
      date:             new Date().toISOString(),
      method:           'ค้างเครดิต',
      total:            v12State.total,
      discount:         v12State.discount || 0,
      received:         0, change: 0,
      customer_name:    `[โครงการ] ${v12State.customer.project_name}`,
      customer_id:      null,
      project_id:       projId,
      staff_name:       staff,
      status:           'ค้างชำระ',
      denominations: {}, change_denominations: {},
      delivery_mode: 'รับเอง', delivery_status: 'สำเร็จ', deposit_amount: 0,
    }).select().single();
    if (be) throw be;

    /* Items + stock deduction (ใช้ conv_rate) */
    for (const item of cartArr) {
      const modes  = (v12State.itemModes || {})[item.id] || { take: item.qty, deliver: 0 };
      const su     = item.unit || 'ชิ้น';
      
      let baseQty = modes.take;
      let bu = su;
      let cr = 1;
      
      if (typeof _v20BaseQty === 'function') {
        baseQty = _v20BaseQty(modes.take, su, item.id, um, bm);
        bu = bm[item.id] || su;
        cr = modes.take > 0 ? (baseQty / modes.take) : 1;
      } else {
        bu = bm[item.id] || su;
        cr = (su !== bu && um[item.id]?.[su]) ? parseFloat(um[item.id][su]) : 1;
        baseQty = parseFloat((modes.take * cr).toFixed(6));
      }

      await db.from('รายการในบิล').insert({
        bill_id: bill.id, product_id: item.id, name: item.name,
        qty: item.qty, price: item.price,
        cost: item.cost || 0,            /* cost สำหรับ COGS ของ dashboard */
        total: item.price * item.qty,
        unit: su,
        take_qty: modes.take, deliver_qty: modes.deliver,
      });

      if (modes.take > 0) {
        const allP    = typeof products !== 'undefined' ? products : [];
        const prod    = allP.find(p => p.id === item.id);
        const sb      = parseFloat(prod?.stock ?? 0);
        const sa      = parseFloat((sb - baseQty).toFixed(6));
        await db.from('สินค้า').update({ stock: sa, updated_at: new Date().toISOString() }).eq('id', item.id);
        if (prod) prod.stock = sa;
        try {
          await db.from('stock_movement').insert({
            product_id: item.id, product_name: item.name,
            type: 'โครงการ', direction: 'out', qty: baseQty,
            stock_before: sb, stock_after: sa,
            ref_id: bill.id, ref_table: 'บิลขาย', staff_name: staff,
            note: cr !== 1 ? `${modes.take} ${su} × ${cr} = ${baseQty} ${bu}` : null,
          });
        } catch(e) { console.warn('[v18] smov:', e.message); }
      }
    }

    /* ── บันทึกลงโครงการด้วย "ราคาขาย" (total) ── */
    const saleTotal = v12State.total; /* ← ราคาขาย รวม */
    const names = cartArr.map(i => `${i.name} ×${i.qty}`).join(', ');
    try {
      await db.from('รายจ่ายโครงการ').insert({
        project_id:  projId,
        description: `สินค้าจากร้าน: ${names}`,
        amount:      saleTotal,          /* ← ราคาขาย */
        category:    'สินค้า',
        type:        'goods',
        bill_id:     bill.id,
        notes:       `บิล #${bill.bill_no} | ราคาขาย ฿${saleTotal.toLocaleString('th-TH')}`,
      });
      /* อัพเดท total_goods_cost ของโครงการ */
      const { data: pj } = await db.from('โครงการ')
        .select('total_goods_cost').eq('id', projId).maybeSingle();
      await db.from('โครงการ').update({
        total_goods_cost: (pj?.total_goods_cost || 0) + saleTotal,
      }).eq('id', projId);
    } catch(e) { console.warn('[v18] projExpense:', e.message); }

    /* Log */
    if (typeof logActivity === 'function') {
      logActivity(
        'ขายโครงการ',
        `บิล #${bill.bill_no} "${v12State.customer.project_name}" ฿${saleTotal.toLocaleString('th-TH')}`,
        bill.id, 'บิลขาย'
      );
    }
    if (typeof sendToDisplay === 'function') {
      sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: v12State.total });
    }

    /* Finalize */
    v12State.savedBill = bill;
    window.cart = [];
    if (typeof loadProducts      === 'function') await loadProducts();
    if (typeof renderCart        === 'function') renderCart();
    if (typeof renderProductGrid === 'function') renderProductGrid();
    if (typeof updateHomeStats   === 'function') updateHomeStats();
    _v18ui(); /* ← render S6 พร้อม savedBill แล้ว */

  } catch(e) {
    console.error('[v18] projPay:', e);
    if (typeof toast === 'function') toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    v12State.step = 4;
    _v18ui();
  } finally {
    window._v18busy = false;
    try { if (typeof isProcessingPayment !== 'undefined') isProcessingPayment = false; } catch(_) {}
  }
};

/* Sync ALL aliases → v18 */
window.v17CompletePayment = window.v12CompletePayment;
window.v16CompletePayment = window.v12CompletePayment;
window.v15CompletePayment = window.v12CompletePayment;
window.v13CompletePayment = window.v12CompletePayment;

console.info(
  '%c[v18] ✅%c StepFix(getMaxStep) | Dashboard-UTC-Proxy | Project-SellingPrice',
  'color:#8B5CF6;font-weight:800', 'color:#6B7280'
);
