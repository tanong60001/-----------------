/**
 * SK POS — modules-v23.js  (โหลดหลัง modules-v22.js)
 * ████████████████████████████████████████████████████████████████████
 *
 *  V23-FIX  CRITICAL: cart variable desync
 *           app.js ใช้ `let cart = []` → cart อยู่ใน closure scope
 *           ไม่ใช่ `window.cart` → ต้องอ่าน cart จาก startCheckout
 *           ที่ snapshot ไว้ตอน checkout เริ่ม
 *
 *  V23-1  AUTO PROJECT METHOD  — Step 4 เลือก "จ่ายของให้โครงการ" อัตโนมัติ
 *  V23-2  STOCK DEDUCTION FIX  — Self-contained v12CompletePayment
 *  V23-3  BUSY FLAG RESET      — Clear ทุก busy flag
 *
 * ████████████████████████████████████████████████████████████████████
 */

'use strict';

/* ── Helpers ───────────────────────────────────────────────── */
const _v23f = n => typeof formatNum === 'function' ? formatNum(n) : Number(n || 0).toLocaleString('th-TH');
const _v23staff = () => { try { return (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown'; } catch(_) { return 'unknown'; } };

function _v23ui() {
  if (typeof v12UpdateStepBar === 'function') v12UpdateStepBar();
  if (typeof v12RenderStepBody === 'function') v12RenderStepBody();
}


/* ════════════════════════════════════════════════════════════════
   V23-FIX: CART SNAPSHOT
   
   ปัญหา: app.js ใช้ `let cart = []` ซึ่งไม่ได้อยู่บน window
   ─ addToCart() push สินค้าเข้า `cart` (closure scope)
   ─ แต่ modules ภายนอกเข้าถึง `cart` ไม่ได้ตรงๆ
   
   แก้: ดักจับ cart reference จาก startCheckout chain
   v12 startCheckout อ่าน `cart.forEach(item => ...)` 
   → cart ยังอ่านได้ผ่าน v12RenderShell → cart.map()
   
   วิธีที่ง่ายที่สุด: Snapshot cart items ไว้ตอน checkout เริ่ม
════════════════════════════════════════════════════════════════ */

// เก็บ cart snapshot ไว้ใช้ตอน completePayment
window._v23CartSnapshot = [];

// Patch startCheckout เพื่อ snapshot cart
(function patchStartCheckout() {
  function tryPatch() {
    if (typeof window.startCheckout !== 'function') {
      setTimeout(tryPatch, 300);
      return;
    }
    if (window.startCheckout._v23patched) return;
    
    const _origStart = window.startCheckout;
    window.startCheckout = function() {
      // ก่อน startCheckout เดิมทำงาน ให้ snapshot cart ไว้
      // cart ถูกเข้าถึงในที่นี้ผ่าน v12 startCheckout ซึ่งอ่านจาก scope ของ modules-v12.js
      // แต่เราต้อง snapshot ก่อนที่มันจะถูก clear
      
      // อ่าน cart items จาก v12RenderShell → v12LeftFooterHTML → cart
      // วิธีที่ดีที่สุด: อ่าน DOM elements ไม่ได้เพราะยังไม่ render
      // วิธีที่ safe ที่สุด: ใช้ getCartItems helper ที่ app.js expose ไว้
      
      // เรียก original startCheckout ก่อน
      _origStart.apply(this, arguments);
      
      // หลัง startCheckout ทำงาน → v12State.itemModes มีข้อมูลแล้ว
      // snapshot จาก DOM (v12-cart-list) หรือจาก v12State
      // อ่านจาก .v12-cart-item elements
      _v23SnapshotCart();
    };
    window.startCheckout._v23patched = true;
    console.log('[v23] ✅ startCheckout patched for cart snapshot');
  }
  
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryPatch);
  else tryPatch();
  setTimeout(tryPatch, 500);
  setTimeout(tryPatch, 1500);
})();

function _v23SnapshotCart() {
  // วิธี 1: อ่านจาก global `cart` ถ้าเข้าถึงได้
  // ใน `modules-v12.js` ซึ่งโหลดหลัง `app.js` ดังนั้น `cart` ที่เห็นในนั้นคือตัวเดียวกับ app.js
  // ← modules-v12.js ใช้ `cart` ได้เพราะ `let` ที่ top-level ของ `<script>` tag
  //   จะอยู่ใน "script scope" ไม่ใช่ block scope → accessible จาก script tags อื่น ❌ ผิด!
  // 
  // ← จริงๆ `let` ใน `<script>` tag จะถูก hoist ใน "global script scope"  
  //   → script tags อื่นจะเข้าถึง `cart` ได้ แต่ไม่ผ่าน `window.cart`
  //   → ถ้า modules-v12.js อ้าง `cart` ตรงๆ ก็จะเข้าถึงตัวเดียวกับ app.js ได้
  //   → แต่ modules-v23.js ก็เข้าถึง `cart` ตรงๆ ได้เช่นกัน!
  //
  // ทดสอบจริง: `let` at top-level of `<script>` = accessible from other `<script>` tags
  // BUT NOT on `window` object
  
  try {
    // `cart` ที่แก้ top-level ของ app.js เป็น `let` → accessible ข้าม script tags
    // ← เข้าถึงได้เพราะ `let` ใน script tag ยังอยู่ใน global scope (ไม่ใช่ module)
    if (typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0) {
      window._v23CartSnapshot = cart.map(item => ({
        id: item.id, name: item.name, price: item.price,
        cost: item.cost || 0, qty: item.qty,
        unit: item.unit || 'ชิ้น', stock: item.stock,
      }));
      console.log('[v23] ✅ Cart snapshot:', window._v23CartSnapshot.length, 'items');
      return;
    }
  } catch(e) {
    console.warn('[v23] Cannot access `cart` variable:', e.message);
  }
  
  // วิธี 2: อ่านจาก v12State.itemModes (มี product IDs)
  if (typeof v12State !== 'undefined' && v12State.itemModes) {
    const ids = Object.keys(v12State.itemModes);
    if (ids.length > 0 && typeof products !== 'undefined') {
      window._v23CartSnapshot = ids.map(id => {
        const prod = products.find(p => p.id === id);
        const modes = v12State.itemModes[id];
        return prod ? {
          id: prod.id, name: prod.name, price: prod.price,
          cost: prod.cost || 0, qty: (modes.take || 0) + (modes.deliver || 0),
          unit: prod.unit || 'ชิ้น', stock: prod.stock,
        } : null;
      }).filter(Boolean);
      console.log('[v23] ✅ Cart snapshot (from itemModes):', window._v23CartSnapshot.length, 'items');
      return;
    }
  }
  
  // วิธี 3: อ่านจาก DOM
  const cartItems = document.querySelectorAll('.v12-cart-item');
  if (cartItems.length > 0) {
    console.log('[v23] Cart snapshot from DOM:', cartItems.length, 'items (limited info)');
  }
  
  console.warn('[v23] ⚠️ Could not snapshot cart');
}

/**
 * ดึง cart items ที่ถูกต้อง
 * ลำดับ priority: cart (global let) > _v23CartSnapshot > window.cart
 */
function _v23GetCartItems() {
  try {
    if (typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0) {
      return cart;
    }
  } catch(_) {}
  
  if (window._v23CartSnapshot && window._v23CartSnapshot.length > 0) {
    return window._v23CartSnapshot;
  }
  
  if (window.cart && Array.isArray(window.cart) && window.cart.length > 0) {
    return window.cart;
  }
  
  return [];
}

/**
 * Clear cart อย่างปลอดภัย — ใช้ splice เท่านั้น ไม่สร้าง array ใหม่
 */
function _v23ClearCart() {
  try {
    if (typeof cart !== 'undefined' && Array.isArray(cart)) {
      cart.splice(0, cart.length);
    }
  } catch(_) {}
  // ล้าง snapshot ด้วย
  window._v23CartSnapshot = [];
}


/* ════════════════════════════════════════════════════════════════
   V23-1: STEP 4 OVERRIDE — Auto-select "จ่ายของให้โครงการ" สำหรับโครงการ
════════════════════════════════════════════════════════════════ */
window.v12S4 = function(container) {
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const isGen  = v12State.customer?.type === 'general';
  const isProj = v12State.customer?.type === 'project';

  /* PROJECT TYPE: auto-select 'project' method, lock other methods */
  if (isProj) {
    v12State.method = 'project';
    container.innerHTML = `
      <h2 class="v12-step-title">วิธีชำระเงิน</h2>
      <p class="v12-step-subtitle">ยอดที่ต้องรับ: <strong style="color:#3b82f6;font-size:20px;">฿${_v23f(payAmt)}</strong></p>
      <div class="sk-pay-grid">
        ${['เงินสด', 'โอนเงิน', 'บัตรเครดิต', 'ค้างชำระ'].map((m, i) => `
          <div class="sk-pay-card disabled">
            <i class="material-icons-round">${['payments', 'account_balance', 'credit_card', 'pending_actions'][i]}</i>
            <div class="sk-pay-title">${m}</div>
          </div>`).join('')}
        <div class="sk-pay-card selected" data-method="project">
          <div class="sk-sel-dot"><i class="material-icons-round">check</i></div>
          <i class="material-icons-round" style="color:#6366f1;">business_center</i>
          <div class="sk-pay-title" style="color:#3730a3;">จ่ายของให้โครงการ</div>
          <div class="sk-pay-sub">ตัดสต็อกทันที</div>
        </div>
      </div>
      <div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:14px;padding:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <i class="material-icons-round" style="font-size:20px;color:#6366f1;">business_center</i>
          <div style="font-weight:700;color:#3730a3;font-size:14px;">📦 จ่ายของให้โครงการ</div>
        </div>
        <div style="font-size:13px;color:#4338ca;line-height:1.8;">
          โครงการ: <strong>${v12State.customer.project_name || ''}</strong><br>
          ยอด: <strong>฿${_v23f(payAmt)}</strong> — ตัดสต็อกทันที<br>
          ไม่นับเป็นรายรับ — บันทึกเป็นต้นทุนโครงการอัตโนมัติ
        </div>
      </div>`;
    setTimeout(() => {
      const nb = document.getElementById('v12-next-btn');
      if (nb) {
        nb.disabled = false;
        nb.className = 'v12-btn-next green';
        nb.innerHTML = '<i class="material-icons-round">check</i> ยืนยัน — จ่ายของให้โครงการ';
      }
    }, 30);
    return;
  }

  /* NORMAL / REGISTERED customer: no project card */
  const cards = [
    { key: 'cash',     icon: 'payments',        label: 'เงินสด',       sub: 'นับแบงค์/เหรียญ' },
    { key: 'transfer', icon: 'account_balance', label: 'โอนเงิน',      sub: 'PromptPay / QR' },
    { key: 'credit',   icon: 'credit_card',     label: 'บัตรเครดิต',   sub: 'Visa / Master' },
    { key: 'debt',     icon: 'pending_actions', label: 'ค้างชำระ',     sub: isGen ? '⚠ ต้องมีลูกค้า' : 'บันทึกหนี้' },
  ];
  if (v12State.method === 'project') v12State.method = null;

  container.innerHTML = `
    <h2 class="v12-step-title">วิธีชำระเงิน</h2>
    <p class="v12-step-subtitle">ยอดที่ต้องรับ: <strong style="color:#3b82f6;font-size:20px;letter-spacing:-.3px;">฿${_v23f(payAmt)}</strong></p>
    <div class="sk-pay-grid">
      ${cards.map(c => {
    const sel = v12State.method === c.key;
    const dis = c.key === 'debt' && isGen;
    return `<div class="sk-pay-card ${sel ? 'selected' : ''} ${dis ? 'disabled' : ''}"
          data-method="${c.key}"
          onclick="${dis ? `_st('ต้องเลือกลูกค้าก่อน','warning')` : `_skSetMethod('${c.key}')`}">
          <div class="sk-sel-dot"><i class="material-icons-round">check</i></div>
          <i class="material-icons-round">${c.icon}</i>
          <div class="sk-pay-title">${c.label}</div>
          <div class="sk-pay-sub">${c.sub}</div>
        </div>`;
  }).join('')}
    </div>
    <div id="sk-pay-info">${typeof _skPayInfo === 'function' ? _skPayInfo(v12State.method || '') : ''}</div>`;
  setTimeout(() => { if (typeof _skRefreshNextBtn === 'function') _skRefreshNextBtn(); }, 20);
};


/* ════════════════════════════════════════════════════════════════
   V23-3: CLEAR ALL BUSY FLAGS
════════════════════════════════════════════════════════════════ */
window._v16busy = false;
window._v17busy = false;
window._v18busy = false;


/* ════════════════════════════════════════════════════════════════
   V23-2: v12CompletePayment — SELF-CONTAINED REWRITE
════════════════════════════════════════════════════════════════ */

async function _v23FetchUnits(ids) {
  const um = {}, bm = {}, cm = {};
  if (!ids.length) return { um, bm, cm };
  try {
    const [{ data: units }, { data: prods }] = await Promise.all([
      db.from('product_units').select('product_id,unit_name,conv_rate').in('product_id', ids),
      db.from('สินค้า').select('id,unit,cost').in('id', ids),
    ]);
    (units || []).forEach(u => {
      if (!um[u.product_id]) um[u.product_id] = {};
      um[u.product_id][u.unit_name] = parseFloat(u.conv_rate) || 1;
    });
    (prods || []).forEach(p => {
      bm[p.id] = p.unit || 'ชิ้น';
      cm[p.id] = parseFloat(p.cost) || 0;
    });
  } catch (e) { console.warn('[v23] fetchUnits:', e.message); }
  return { um, bm, cm };
}

function _v23BaseQty(qty, su, pid, um, bm) {
  const bu = bm[pid] || su;
  if (su === bu) return qty;
  const cr = um[pid]?.[su];
  return cr ? parseFloat((qty * cr).toFixed(6)) : qty;
}

function _v23ConvRate(su, pid, um, bm) {
  const bu = bm[pid] || su;
  if (su === bu) return 1;
  return parseFloat(um[pid]?.[su]) || 1;
}


window.v12CompletePayment = async function() {
  // ── Guard: ป้องกันกดซ้ำ ──
  if (window._v23busy) {
    console.warn('[v23] ⚠️ Already processing payment, skipping');
    return;
  }
  window._v23busy = true;
  window._v16busy = false;
  window._v17busy = false;
  window._v18busy = false;

  try { if (typeof isProcessingPayment !== 'undefined') isProcessingPayment = true; } catch(_) {}

  try {
    /* ── Get cart items (CRITICAL FIX) ── */
    const cartArr = _v23GetCartItems();
    
    if (!cartArr || cartArr.length === 0) {
      console.error('[v23] ❌ EMPTY CART! Cannot complete payment.');
      console.log('[v23] Debug: typeof cart =', typeof cart);
      try { console.log('[v23] Debug: cart length =', cart?.length); } catch(_) {}
      console.log('[v23] Debug: snapshot =', window._v23CartSnapshot?.length);
      console.log('[v23] Debug: window.cart =', window.cart?.length);
      if (typeof toast === 'function') toast('ไม่พบสินค้าในตะกร้า กรุณาลองใหม่', 'error');
      return;
    }
    
    console.log('[v23] 🛒 Cart items for payment:', cartArr.length, cartArr.map(i => `${i.name}×${i.qty}`).join(', '));

    /* ── Identify type ── */
    const isProj = v12State.method === 'project'
                || (v12State.customer?.type === 'project' && !!v12State.customer?.project_id);
    const isDebt = v12State.method === 'debt' && !isProj;
    const isCash = v12State.method === 'cash';
    
    const methodMap = {
      cash: 'เงินสด', transfer: 'โอนเงิน', credit: 'บัตรเครดิต',
      debt: 'ค้างชำระ', project: 'จ่ายของให้โครงการ'
    };
    const delivMap = { self: 'รับเอง', deliver: 'จัดส่ง', partial: 'รับบางส่วน' };

    const isCodFull = (v12State.deliveryMode !== 'self' && v12State.deliveryPaymentMode === 'cod' && v12State.paymentType === 'full');
    const isPayNowFull = (v12State.deliveryMode !== 'self' && v12State.deliveryPaymentMode === 'pay_now' && v12State.paymentType === 'full');

    const payAmt = (isDebt || isProj || isCodFull) ? 0 : (v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total);
    const debtAmt = (isDebt && !isProj) ? v12State.total : (v12State.paymentType === 'deposit' ? (v12State.total - v12State.depositAmount) : 0);
    const billStatus = isProj ? 'จ่ายของให้โครงการ'
                     : isDebt ? 'ค้างชำระ'
                     : debtAmt > 0 ? 'ค้างชำระ'
                     : isCodFull ? 'ชำระหน้างาน'
                     : isPayNowFull ? 'ชำระแล้ว'
                     : v12State.deliveryMode !== 'self' ? 'รอจัดส่ง'
                     : 'สำเร็จ';
    const hasDeliver = Object.values(v12State.itemModes || {}).some(m => m.deliver > 0);

    /* ── Cash session ── */
    let session = null;
    if (isCash) {
      try {
        const { data } = await db.from('cash_session').select('*')
          .eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
        session = data;
      } catch(_) {}
    }

    /* ── Unit info ── */
    const ids = [...new Set(cartArr.map(i => i.id).filter(Boolean))];
    const { um, bm, cm } = await _v23FetchUnits(ids);

    /* ── Insert bill ── */
    const billData = {
      date: new Date().toISOString(),
      method: isCodFull ? 'ชำระหน้างาน' : (isProj ? 'โครงการ' : (methodMap[v12State.method] || 'เงินสด')),
      total: v12State.total,
      discount: v12State.discount || 0,
      received: payAmt,
      change: (isDebt || isProj || isCodFull) ? 0 : (v12State.change || 0),
      customer_name: isProj ? `[โครงการ] ${v12State.customer.project_name}` : (v12State.customer?.name || 'ลูกค้าทั่วไป'),
      customer_id: (!isProj && v12State.customer?.id) ? v12State.customer.id : null,
      project_id: isProj ? v12State.customer.project_id : null,
      staff_name: _v23staff(),
      status: billStatus,
      denominations: v12State.receivedDenominations || {},
      change_denominations: v12State.changeDenominations || {},
      delivery_mode: delivMap[v12State.deliveryMode] || 'รับเอง',
      delivery_date: v12State.deliveryDate || null,
      delivery_address: v12State.deliveryAddress || null,
      delivery_phone: v12State.deliveryPhone || null,
      delivery_status: hasDeliver ? 'รอจัดส่ง' : 'สำเร็จ',
      deposit_amount: v12State.depositAmount || 0,
    };

    const { data: bill, error: be } = await db.from('บิลขาย').insert(billData).select().single();
    if (be) throw be;

    console.log('[v23] ✅ Bill created:', bill.bill_no, '| Status:', billStatus, '| isProj:', isProj);

    /* ── Bill items + STOCK DEDUCTION ── */
    let projCostTotal = 0;
    for (const item of cartArr) {
      const modes = (v12State.itemModes || {})[item.id] || { take: item.qty, deliver: 0 };
      const su = item.unit || 'ชิ้น';
      const cr = _v23ConvRate(su, item.id, um, bm);
      const costPerUnit = (cm[item.id] || item.cost || 0) * cr;

      await db.from('รายการในบิล').insert({
        bill_id: bill.id, product_id: item.id, name: item.name,
        qty: item.qty, price: item.price, cost: costPerUnit,
        total: item.price * item.qty, unit: su,
        take_qty: modes.take, deliver_qty: modes.deliver,
      });

      /* ─── ตัดสต็อก (ถ้า take > 0) ─── */
      if (modes.take > 0) {
        const baseQty = _v23BaseQty(modes.take, su, item.id, um, bm);
        const bu = bm[item.id] || su;

        // ดึงสต็อกปัจจุบันจาก DB โดยตรง (ไม่พึ่ง local products array)
        let stockBefore = 0;
        try {
          const { data: dbProd } = await db.from('สินค้า').select('stock').eq('id', item.id).maybeSingle();
          stockBefore = parseFloat(dbProd?.stock ?? 0);
        } catch(_) {
          try {
            const allP = typeof products !== 'undefined' ? products : [];
            const prod = allP.find(p => p.id === item.id);
            stockBefore = parseFloat(prod?.stock ?? 0);
          } catch(_2) {}
        }

        const stockAfter = parseFloat((stockBefore - baseQty).toFixed(6));

        // อัพเดตสต็อกใน DB
        const { error: stockErr } = await db.from('สินค้า')
          .update({ stock: stockAfter, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        if (stockErr) {
          console.error('[v23] ❌ Stock update FAILED for', item.name, stockErr);
        } else {
          console.log(`[v23] ✅ Stock deducted: ${item.name} | ${stockBefore} → ${stockAfter} (−${baseQty} ${bu})`);
        }

        // อัพเดต local products array ด้วย
        try {
          if (typeof products !== 'undefined') {
            const prod = products.find(p => p.id === item.id);
            if (prod) prod.stock = stockAfter;
          }
        } catch(_) {}

        // บันทึก stock_movement
        try {
          await db.from('stock_movement').insert({
            product_id: item.id, product_name: item.name,
            type: isProj ? 'จ่ายของให้โครงการ' : 'ขาย',
            direction: 'out', qty: baseQty,
            stock_before: stockBefore, stock_after: stockAfter,
            ref_id: bill.id, ref_table: 'บิลขาย', staff_name: _v23staff(),
            note: cr !== 1 ? `${modes.take} ${su} × ${cr} = ${baseQty} ${bu}` : null,
          });
        } catch(e) { console.warn('[v23] stock_movement:', e.message); }

        if (isProj) projCostTotal += costPerUnit * modes.take;
      }
    }

    /* ── Project: บันทึกรายจ่ายโครงการ ── */
    if (isProj) {
      const projId = v12State.customer?.project_id;
      const saleTotal = v12State.total;
      const names = cartArr.map(i => `${i.name} ×${i.qty}`).join(', ');
      try {
        await db.from('รายจ่ายโครงการ').insert({
          project_id: projId,
          description: `สินค้าจากร้าน: ${names}`,
          amount: saleTotal,
          category: 'สินค้า',
          type: 'goods',
          bill_id: bill.id,
          paid_at: new Date().toISOString(),
          notes: `บิล #${bill.bill_no} | ราคาขาย ฿${saleTotal.toLocaleString('th-TH')}`,
        });
        if (projId) {
          const { data: pj } = await db.from('โครงการ')
            .select('total_goods_cost').eq('id', projId).maybeSingle();
          await db.from('โครงการ').update({
            total_goods_cost: (pj?.total_goods_cost || 0) + saleTotal,
          }).eq('id', projId);
        }
      } catch(e) { console.warn('[v23] projExpense:', e.message); }
    }

    /* ── Cash transaction (เงินสด) ── */
    if (isCash && session && (v12State.received || 0) > 0) {
      try {
        await db.from('cash_transaction').insert({
          session_id: session.id, type: 'ขาย', direction: 'in',
          amount: v12State.received, change_amt: v12State.change,
          net_amount: payAmt, balance_after: 0,
          ref_id: bill.id, ref_table: 'บิลขาย', staff_name: _v23staff(),
          denominations: v12State.receivedDenominations || {},
          change_denominations: v12State.changeDenominations || {},
        });
      } catch(e) { console.warn('[v23] cashTx:', e.message); }
    }

    /* ── Customer update (ไม่ใช่โครงการ) ── */
    if (!isProj && v12State.customer?.id) {
      try {
        const { data: cu } = await db.from('customer')
          .select('total_purchase,visit_count,debt_amount')
          .eq('id', v12State.customer.id).maybeSingle();
        await db.from('customer').update({
          total_purchase: (cu?.total_purchase || 0) + v12State.total,
          visit_count: (cu?.visit_count || 0) + 1,
          debt_amount: (cu?.debt_amount || 0) + debtAmt,
        }).eq('id', v12State.customer.id);
      } catch(e) { console.warn('[v23] cust:', e.message); }
    }

    /* ── Log + Display ── */
    if (typeof logActivity === 'function') {
      const actType = isProj ? 'ขายโครงการ' : 'ขายสินค้า';
      const actDesc = `บิล #${bill.bill_no} ฿${_v23f(v12State.total)}${isProj ? ` [${v12State.customer.project_name}]` : isDebt ? ' [ค้างชำระ]' : ''}`;
      logActivity(actType, actDesc, bill.id, 'บิลขาย');
    }
    if (typeof sendToDisplay === 'function') {
      sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: v12State.total });
    }

    /* ── Finalize ── */
    v12State.savedBill = bill;
    
    // ← CRITICAL: ใช้ splice เท่านั้น ไม่ assign window.cart = []
    _v23ClearCart();

    // Reload products จาก DB เพื่อให้สต็อกถูกต้อง 100%
    if (typeof loadProducts === 'function') await loadProducts();
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderProductGrid === 'function') renderProductGrid();
    if (typeof updateHomeStats === 'function') updateHomeStats();

    _v23ui(); // render Step 6 (success)

    console.log('[v23] ✅ Payment complete:', bill.bill_no, '| Method:', v12State.method, '| Project:', isProj);

  } catch(e) {
    console.error('[v23] ❌ payment error:', e);
    if (typeof toast === 'function') toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    v12State.step = v12State.method === 'cash' ? 5 : 4;
    _v23ui();
  } finally {
    // ── ALWAYS reset ALL busy flags ──
    window._v23busy = false;
    window._v16busy = false;
    window._v17busy = false;
    window._v18busy = false;
    try { if (typeof isProcessingPayment !== 'undefined') isProcessingPayment = false; } catch(_) {}
  }
};

/* ── Sync ALL aliases ── */
window.v15CompletePayment = window.v12CompletePayment;
window.v13CompletePayment = window.v12CompletePayment;
window.v16CompletePayment = window.v12CompletePayment;
window.v17CompletePayment = window.v12CompletePayment;
window.v18CompletePayment = window.v12CompletePayment;


/* ════════════════════════════════════════════════════════════════
   V23 NextStep Override
════════════════════════════════════════════════════════════════ */
window.v12NextStep = async function() {
  const t = typeof toast === 'function' ? toast : m => alert(m);

  /* Step 1: project → ต้องเลือกโครงการก่อน */
  if (v12State.step === 1 && v12State.customer?.type === 'project') {
    if (!v12State.customer.project_id) {
      t('⚠️ กรุณาเลือกโครงการก่อนกดถัดไป', 'warning');
      return;
    }
  }

  /* Step 1: general → skip to 4 */
  if (v12State.step === 1 && v12State.customer?.type === 'general') {
    v12State.step = 4; _v23ui(); return;
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

  /* COD Bypass */
  if (v12State.step === 3 && v12State.deliveryMode !== 'self' && v12State.deliveryPaymentMode === 'cod' && v12State.paymentType === 'full') {
    v12State.method = 'cash'; // Default method placeholder
    v12State.received = 0;
    v12State.change = 0;
    v12State.step = typeof v12GetMaxStep === 'function' ? v12GetMaxStep() : 6;
    _v23SnapshotCart();
    _v23ui();
    window.v12CompletePayment();
    return;
  }

  /* Step 4: method validation */
  if (v12State.step === 4) {
    if (!v12State.method) { t('กรุณาเลือกวิธีชำระเงิน', 'warning'); return; }

    /* V23-4: ห้ามเบิกเกินงบประมาณโครงการ */
    if (v12State.method === 'project' && v12State.customer?.project_id) {
      try {
        const { data: proj } = await db.from('โครงการ')
          .select('budget,total_goods_cost,total_expenses')
          .eq('id', v12State.customer.project_id).maybeSingle();
        if (proj) {
          const budget = parseFloat(proj.budget || 0);
          const spent = parseFloat(proj.total_goods_cost || 0) + parseFloat(proj.total_expenses || 0);
          const remaining = Math.max(0, budget - spent);
          if (v12State.total > remaining) {
            await Swal.fire({
              icon: 'warning',
              title: '⚠️ เกินงบประมาณโครงการ',
              html: `
                <div style="text-align:left;font-size:14px;line-height:2;">
                  <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:16px;margin-bottom:12px;">
                    <div style="font-size:18px;font-weight:800;color:#dc2626;text-align:center;">
                      ⛔ ยอดเบิก ฿${_v23f(v12State.total)} เกินงบคงเหลือ ฿${_v23f(remaining)}
                    </div>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;">
                      <div style="font-size:11px;color:#64748b;">งบประมาณรวม</div>
                      <div style="font-size:16px;font-weight:700;color:#3b82f6;">฿${_v23f(budget)}</div>
                    </div>
                    <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;">
                      <div style="font-size:11px;color:#64748b;">ใช้ไปแล้ว</div>
                      <div style="font-size:16px;font-weight:700;color:#ef4444;">฿${_v23f(spent)}</div>
                    </div>
                    <div style="background:#f0fdf4;border-radius:8px;padding:10px;text-align:center;">
                      <div style="font-size:11px;color:#64748b;">คงเหลือ</div>
                      <div style="font-size:16px;font-weight:700;color:#10b981;">฿${_v23f(remaining)}</div>
                    </div>
                    <div style="background:#fef3c7;border-radius:8px;padding:10px;text-align:center;">
                      <div style="font-size:11px;color:#64748b;">ยอดเบิกครั้งนี้</div>
                      <div style="font-size:16px;font-weight:700;color:#d97706;">฿${_v23f(v12State.total)}</div>
                    </div>
                  </div>
                  <div style="margin-top:12px;font-size:12px;color:#64748b;text-align:center;">
                    กรุณาลดจำนวนสินค้า หรือเพิ่มงบประมาณโครงการก่อน
                  </div>
                </div>
              `,
              confirmButtonText: 'เข้าใจแล้ว',
              confirmButtonColor: '#dc2626',
            });
            return;
          }
        }
      } catch(e) {
        console.warn('[v23] budget check:', e.message);
      }
    }
  }

  /* Step 4 → complete (non-cash: project / debt / transfer / credit) */
  if (v12State.step === 4 && v12State.method !== 'cash') {
    const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    v12State.received = (v12State.method === 'debt' || v12State.method === 'project') ? 0 : payAmt;
    v12State.change = 0;
    v12State.step = typeof v12GetMaxStep === 'function' ? v12GetMaxStep() : 5;
    
    // Snapshot cart ก่อน completePayment
    _v23SnapshotCart();
    
    _v23ui();
    window.v12CompletePayment();
    return;
  }

  /* Step 5 (cash): validate received */
  if (v12State.step === 5) {
    const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    const allD = (typeof V13_ALL !== 'undefined' ? V13_ALL : typeof V14_ALL !== 'undefined' ? V14_ALL : []);
    const recv = allD.reduce((s, d) => s + d.value * (v12State.receivedDenominations?.[d.value] || 0), 0);
    if (recv < payAmt) { t('ยอดรับเงินไม่เพียงพอ', 'error'); return; }
    v12State.received = recv;
    v12State.change = recv - payAmt;
    if (typeof calcChangeDenominations === 'function') {
      v12State.changeDenominations = calcChangeDenominations(v12State.change);
    }
    v12State.step = typeof v12GetMaxStep === 'function' ? v12GetMaxStep() : 6;
    
    // Snapshot cart ก่อน completePayment
    _v23SnapshotCart();
    
    _v23ui();
    window.v12CompletePayment();
    return;
  }

  /* Default: go next */
  v12State.step++;
  _v23ui();
};

window.v12PrevStep = function() {
  const gen = v12State.customer?.type === 'general';
  if ((v12State.step === 4 || v12State.step === 5) && gen) v12State.step = 1;
  else if (v12State.step === 5) v12State.step = 4;
  else if (v12State.step > 1) v12State.step--;
  _v23ui();
};


/* ════════════════════════════════════════════════════════════════
   V23: PATCH closeCheckout — reset state properly
════════════════════════════════════════════════════════════════ */
(function patchCloseCheckout() {
  function tryPatch() {
    if (typeof window.closeCheckout !== 'function') {
      setTimeout(tryPatch, 300);
      return;
    }
    if (window.closeCheckout._v23patched) return;
    
    const _origClose = window.closeCheckout;
    window.closeCheckout = function() {
      _origClose.apply(this, arguments);
      
      // Reset v12State สำหรับ checkout ถัดไป
      if (typeof v12State !== 'undefined') {
        v12State.savedBill = null;
        v12State.step = 1;
        v12State.method = null;
        v12State.received = 0;
        v12State.change = 0;
        v12State.receivedDenominations = {};
        v12State.changeDenominations = {};
        v12State.depositAmount = 0;
        v12State.deliveryMode = 'self';
        v12State.itemModes = {};
        v12State.customer = { type: 'general', id: null, name: 'ลูกค้าทั่วไป' };
        v12State.paymentType = 'full';
      }
      
      // Clear snapshot
      window._v23CartSnapshot = [];
      
      // Reset busy flags
      window._v23busy = false;
      window._v16busy = false;
      window._v17busy = false;
      window._v18busy = false;
    };
    window.closeCheckout._v23patched = true;
    console.log('[v23] ✅ closeCheckout patched');
  }
  
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryPatch);
  else tryPatch();
  setTimeout(tryPatch, 500);
})();


/* ════════════════════════════════════════════════════════════════
   LOG
════════════════════════════════════════════════════════════════ */
console.info(
  '%c[v23] ✅%c CartDesyncFix | AutoProjectMethod | StockDeduction | BusyFlagReset',
  'color:#dc2626;font-weight:900', 'color:#6B7280'
);
