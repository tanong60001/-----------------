/**
 * SK POS — modules-v13.js  (โหลดหลัง modules-v12.js)
 * ════════════════════════════════════════════════════════════════
 *  V13-1  SMART CUSTOMER SKIP  — ลูกค้าทั่วไปข้ามไปชำระเงินโดยตรง
 *  V13-2  DEBT METHOD          — เพิ่ม "ค้างเครดิต" ในหน้าชำระเงิน
 *  V13-3  ENHANCED CASH        — ตารางนับแบงค์/เหรียญสีแบงค์จริง
 *                                 + หน้าเงินทอนพนักงานนับเอง
 *  V13-4  DELIVERY AUTOFILL    — ดึงที่อยู่ลูกค้า + แสดง take/deliver
 *  V13-5  RETURN IN BMC        — ปุ่มคืนสินค้า item-level ใน History
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

/* ─── Safe Fallbacks ─────────────────────────────────────────── */
if (typeof v12State === 'undefined') { window.v12State = { step:1, total:0, customer:{type:'general'}, method:'cash', paymentType:'full', depositAmount:0, deliveryMode:'self', receivedDenominations:{}, changeDenominations:{}, received:0, change:0 }; }
if (typeof formatNum === 'undefined') { window.formatNum = n => Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:0,maximumFractionDigits:2}); }

/* ─── Thai Banknote & Coin Definitions (Real colors) ─────────── */
const V13_BILLS = [
  { value:1000, label:'1,000', bg:'linear-gradient(145deg,#3b0764,#7c3aed)', shadow:'rgba(124,58,237,0.35)' },
  { value:500,  label:'500',   bg:'linear-gradient(145deg,#052e16,#16a34a)', shadow:'rgba(22,163,74,0.35)' },
  { value:100,  label:'100',   bg:'linear-gradient(145deg,#7f1d1d,#dc2626)', shadow:'rgba(220,38,38,0.35)' },
  { value:50,   label:'50',    bg:'linear-gradient(145deg,#1e3a8a,#2563eb)', shadow:'rgba(37,99,235,0.35)' },
  { value:20,   label:'20',    bg:'linear-gradient(145deg,#14532d,#15803d)', shadow:'rgba(21,128,61,0.35)' },
];
const V13_COINS = [
  { value:10, label:'10', bg:'linear-gradient(145deg,#78350f,#d97706)', shadow:'rgba(217,119,6,0.3)' },
  { value:5,  label:'5',  bg:'linear-gradient(145deg,#374151,#6b7280)', shadow:'rgba(107,114,128,0.3)' },
  { value:2,  label:'2',  bg:'linear-gradient(145deg,#92400e,#ca8a04)', shadow:'rgba(202,138,4,0.3)' },
  { value:1,  label:'1',  bg:'linear-gradient(145deg,#1f2937,#4b5563)', shadow:'rgba(75,85,99,0.3)' },
];
const V13_ALL_DENOMS = [...V13_BILLS, ...V13_COINS];

/* ─── CSS Inject ─────────────────────────────────────────────── */
(function injectV13CSS() {
  if (document.getElementById('v13-styles')) return;
  const s = document.createElement('style');
  s.id = 'v13-styles';
  s.textContent = `
/* ── V13 Denomination Buttons ─────────────────────────────────── */
.v13-denom-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:10px; }
.v13-coin-grid  { display:grid; grid-template-columns:repeat(4,1fr); gap:8px;  margin-bottom:14px; }
.v13-denom-btn {
  border:none; border-radius:14px; padding:14px 8px 10px;
  cursor:pointer; transition:all .15s; position:relative;
  display:flex; flex-direction:column; align-items:center; gap:6px;
  box-shadow:0 4px 12px var(--v13-shadow,rgba(0,0,0,.15));
  user-select:none; -webkit-user-select:none;
}
.v13-denom-btn:hover { transform:translateY(-2px); box-shadow:0 8px 20px var(--v13-shadow,rgba(0,0,0,.2)); }
.v13-denom-btn:active { transform:scale(.95); }
.v13-denom-label { font-size:15px; font-weight:800; color:#fff; letter-spacing:-.3px; }
.v13-denom-sub   { font-size:11px; font-weight:500; color:rgba(255,255,255,.7); }
.v13-denom-count-badge {
  position:absolute; top:-7px; right:-7px;
  background:#f59e0b; color:#fff;
  border-radius:12px; padding:2px 8px;
  font-size:12px; font-weight:800; min-width:22px; text-align:center;
  display:none; border:2px solid #fff;
  box-shadow:0 2px 6px rgba(0,0,0,.2);
}
.v13-denom-count-badge.show { display:block; }
.v13-coin-btn {
  border:none; border-radius:50%; width:64px; height:64px;
  cursor:pointer; transition:all .15s; position:relative;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
  box-shadow:0 4px 10px var(--v13-shadow,rgba(0,0,0,.15));
  user-select:none; margin:0 auto;
}
.v13-coin-btn:hover  { transform:translateY(-2px) scale(1.05); }
.v13-coin-btn:active { transform:scale(.9); }
.v13-coin-label { font-size:13px; font-weight:800; color:#fff; }
.v13-coin-sub   { font-size:9px; font-weight:500; color:rgba(255,255,255,.7); }
.v13-coin-count-badge {
  position:absolute; top:-5px; right:-5px;
  background:#f59e0b; color:#fff;
  border-radius:10px; padding:1px 6px;
  font-size:11px; font-weight:800;
  display:none; border:2px solid #fff;
}
.v13-coin-count-badge.show { display:block; }

/* ── Cash Summary Bar ──────────────────────────────────────────── */
.v13-cash-bar {
  display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;
  background:var(--bg-secondary,#f8fafc); border-radius:14px;
  padding:14px; margin-bottom:16px;
}
.v13-cash-cell { text-align:center; }
.v13-cash-cell .lbl { font-size:11px; font-weight:600; color:var(--text-muted,#9ca3af); margin-bottom:4px; text-transform:uppercase; letter-spacing:.5px; }
.v13-cash-cell .val { font-size:22px; font-weight:800; letter-spacing:-.5px; }

/* ── Change Breakdown Table ──────────────────────────────────── */
.v13-change-section { margin-top:12px; }
.v13-change-title {
  font-size:13px; font-weight:700; color:#15803d;
  margin-bottom:10px; display:flex; align-items:center; gap:6px;
}
.v13-change-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:8px; }
.v13-change-coin-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
.v13-chg-item {
  border-radius:12px; padding:10px 6px 8px;
  display:flex; flex-direction:column; align-items:center; gap:5px;
  position:relative;
}
.v13-chg-item .chg-lbl { font-size:13px; font-weight:800; color:#fff; }
.v13-chg-item .chg-cnt { font-size:18px; font-weight:900; color:#fff; line-height:1; }
.v13-chg-item .chg-sub { font-size:10px; font-weight:500; color:rgba(255,255,255,.7); }
.v13-chg-total-bar {
  background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px;
  padding:10px 14px; display:flex; justify-content:space-between; align-items:center;
}

/* ── Debt Method Card ────────────────────────────────────────── */
.v13-method-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
@media(max-width:768px) { .v13-method-grid-4 { grid-template-columns:1fr 1fr; } }
.v13-method-card-debt {
  border:2px solid var(--border,#e5e7eb); border-radius:14px;
  padding:20px 12px; cursor:pointer; text-align:center; transition:all .18s;
}
.v13-method-card-debt:hover:not(.disabled) { border-color:#f59e0b; transform:translateY(-2px); box-shadow:0 6px 20px rgba(245,158,11,.15); }
.v13-method-card-debt.selected { border-color:#f59e0b; background:#fffbeb; box-shadow:0 0 0 3px rgba(245,158,11,.12); }
.v13-method-card-debt.disabled { opacity:.4; cursor:not-allowed; }
.v13-method-card-debt i { font-size:28px; color:var(--text-muted,#9ca3af); margin-bottom:8px; display:block; }
.v13-method-card-debt.selected i { color:#f59e0b; }
.v13-method-card-debt h4 { font-size:14px; font-weight:700; margin:0 0 3px; }
.v13-method-card-debt p  { font-size:11px; color:var(--text-muted,#9ca3af); margin:0; }

/* ── Customer Step enhancements ──────────────────────────────── */
.v13-general-fast {
  margin-top:16px; padding:12px 16px; border-radius:12px;
  background:linear-gradient(135deg,#eff6ff,#dbeafe);
  border:1.5px solid #93c5fd;
  display:flex; align-items:center; gap:12px;
}
.v13-general-fast i { font-size:22px; color:#1d4ed8; }
.v13-general-fast p { font-size:13px; color:#1e40af; margin:0; }

/* ── Partial delivery pill ────────────────────────────────────── */
.v13-mode-pill {
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 8px; border-radius:20px; font-size:11px; font-weight:700;
}
.v13-mode-take    { background:#dbeafe; color:#1e40af; }
.v13-mode-deliver { background:#ede9fe; color:#5b21b6; }
`;
  document.head.appendChild(s);
})();


/* ════════════════════════════════════════════════════════════════
   V13-1: SMART CUSTOMER SKIP
   ลูกค้าทั่วไป → ข้ามไป Step 4 (วิธีชำระ) โดยตรง
   ลูกค้าประจำ / ใหม่ → ผ่าน step 2, 3 ปกติ
════════════════════════════════════════════════════════════════ */

/* --- Step Bar (รู้จักการ skip) --------------------------------- */
window.v12UpdateStepBar = function () {
  const bar = document.getElementById('v12-steps-bar');
  if (!bar) return;

  const isGeneral  = v12State.customer.type === 'general';
  const needsCash  = v12State.method === 'cash';

  let labels, stepNumbers;
  if (isGeneral) {
    // ลูกค้าทั่วไป: 3 step (cash) หรือ 2 step (non-cash)
    labels      = needsCash ? ['ลูกค้า','วิธีชำระ','รับเงิน','บันทึก'] : ['ลูกค้า','วิธีชำระ','บันทึก'];
    stepNumbers = needsCash ? [1,4,5,6] : [1,4,6];
  } else {
    labels      = needsCash ? ['ลูกค้า','รูปแบบรับ','ชำระเงิน','วิธีชำระ','รับเงิน','บันทึก']
                            : ['ลูกค้า','รูปแบบรับ','ชำระเงิน','วิธีชำระ','บันทึก'];
    stepNumbers = needsCash ? [1,2,3,4,5,6] : [1,2,3,4,6];
  }

  bar.innerHTML = labels.map((lbl, i) => {
    const realStep = stepNumbers[i];
    const isActive = realStep === v12State.step;
    const isDone   = realStep < v12State.step;
    const cls      = isActive ? 'active' : isDone ? 'done' : '';
    const connCls  = isDone ? 'done' : '';
    return `<div class="v12-step-pill ${cls}">
      <span class="pill-num">${isDone ? '<i class="material-icons-round" style="font-size:11px">check</i>' : (i+1)}</span>
      ${lbl}
    </div>${i < labels.length-1 ? `<div class="v12-step-connector ${connCls}"></div>` : ''}`;
  }).join('');
};

/* --- Next Step (กระโดด step สำหรับ general) -------------------- */
const _v13OrigNextStep = window.v12NextStep;
window.v12NextStep = function () {
  const t = typeof toast === 'function' ? toast : m => alert(m);
  const isGeneral = v12State.customer.type === 'general';

  // Step 1: ลูกค้าทั่วไป → ข้ามไป step 4
  if (v12State.step === 1 && isGeneral) {
    v12State.step = 4;
    v12UpdateUI();
    return;
  }

  // Step 4: ค้างเครดิต validation
  if (v12State.step === 4 && v12State.method === 'debt') {
    if (isGeneral) { t('ค้างเครดิตได้เฉพาะลูกค้าประจำ/ลูกค้าใหม่เท่านั้น','warning'); return; }
    // debt method → ไม่ต้องนับแบงค์ → บันทึกเลย
    v12State.received = 0;
    v12State.change   = 0;
    v12State.step     = 6;
    v13CompletePayment();
    return;
  }

  // Step 4: non-cash (ไม่ใช่ cash ไม่ใช่ debt) → บันทึกเลย
  if (v12State.step === 4 && v12State.method !== 'cash' && v12State.method !== 'debt') {
    if (!v12State.method) { t('กรุณาเลือกวิธีชำระเงิน','warning'); return; }
    const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    v12State.received = payAmt;
    v12State.change   = 0;
    v12State.step     = 6;
    v13CompletePayment();
    return;
  }

  // Step 5 (cash): ตรวจเงินที่รับ → บันทึก
  if (v12State.step === 5) {
    const payAmt   = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    const received = Object.entries(v12State.receivedDenominations).reduce((s,[v,c])=>s+Number(v)*c,0);
    if (received < payAmt) { t('ยอดรับเงินไม่เพียงพอ','error'); return; }
    v12State.received   = received;
    v12State.change     = received - payAmt;
    v12State.changeDenominations = typeof calcChangeDenominations === 'function' ? calcChangeDenominations(v12State.change) : {};
    v12State.step = 6;
    v13CompletePayment();
    return;
  }

  // Delegate to original for remaining cases (steps 1→2, 2→3, 3→4 for member)
  _v13OrigNextStep?.();
};

/* --- Prev Step (reverse skip สำหรับ general) -------------------- */
const _v13OrigPrevStep = window.v12PrevStep;
window.v12PrevStep = function () {
  const isGeneral = v12State.customer.type === 'general';
  // Step 4, general → กลับไป step 1
  if (v12State.step === 4 && isGeneral) { v12State.step = 1; v12UpdateUI(); return; }
  // Step 5, general (cash) → กลับไป step 4
  if (v12State.step === 5 && isGeneral) { v12State.step = 4; v12UpdateUI(); return; }
  _v13OrigPrevStep?.();
};

/* --- v12UpdateUI helper (v12 internal, expose if needed) ------- */
if (typeof window.v12UpdateUI === 'undefined') {
  window.v12UpdateUI = function() {
    v12UpdateStepBar();
    v12RenderStepBody();
  };
}


/* ════════════════════════════════════════════════════════════════
   V13-2: CUSTOMER STEP ENHANCEMENT
   Step 1 — แสดง "ข้ามอัตโนมัติ" สำหรับทั่วไป
            เพิ่มที่อยู่ในฟอร์มลูกค้าใหม่
════════════════════════════════════════════════════════════════ */
window.v12S1 = function (container) {
  container.innerHTML = `
    <h2 class="v12-step-title">เลือกลูกค้า</h2>
    <p class="v12-step-subtitle">เลือกประเภทลูกค้าเพื่อบันทึกบิล</p>
    <div class="v12-cust-grid">
      <div class="v12-cust-card ${v12State.customer.type==='general'?'selected':''}"
           onclick="v13SelectCustType('general')">
        <i class="material-icons-round">shopping_bag</i>
        <h4>ลูกค้าทั่วไป</h4>
        <p>ไม่ระบุข้อมูล</p>
      </div>
      <div class="v12-cust-card ${v12State.customer.type==='member'?'selected':''}"
           onclick="v13SelectCustType('member')">
        <i class="material-icons-round">star</i>
        <h4>ลูกค้าประจำ</h4>
        <p>เลือกจากรายชื่อ</p>
      </div>
      <div class="v12-cust-card ${v12State.customer.type==='new'?'selected':''}"
           onclick="v13SelectCustType('new')">
        <i class="material-icons-round">person_add</i>
        <h4>เพิ่มลูกค้าใหม่</h4>
        <p>สร้างข้อมูลใหม่</p>
      </div>
    </div>
    <div id="v12-cust-form"></div>
    ${v12State.customer.type==='general' ? `
    <div class="v13-general-fast">
      <i class="material-icons-round">flash_on</i>
      <p>ลูกค้าทั่วไป — กด <strong>ถัดไป</strong> เพื่อข้ามไปชำระเงินโดยตรง ⚡</p>
    </div>` : ''}`;

  v13RenderCustForm(document.getElementById('v12-cust-form'));
};

window.v13SelectCustType = function (type) {
  v12State.customer = { type, id: null, name: type==='general' ? 'ลูกค้าทั่วไป' : '', phone:'', address:'' };
  document.querySelectorAll('.v12-cust-card').forEach((c,i) => {
    c.classList.toggle('selected', ['general','member','new'][i] === type);
  });
  const form = document.getElementById('v12-cust-form');
  if (form) v13RenderCustForm(form);
  // แสดง/ซ่อน fast hint
  const existing = document.querySelector('.v13-general-fast');
  if (existing) existing.remove();
  if (type === 'general') {
    const hint = document.createElement('div');
    hint.className = 'v13-general-fast';
    hint.innerHTML = `<i class="material-icons-round">flash_on</i><p>ลูกค้าทั่วไป — กด <strong>ถัดไป</strong> เพื่อข้ามไปชำระเงินโดยตรง ⚡</p>`;
    form.parentElement?.appendChild(hint);
  }
};

function v13RenderCustForm(container) {
  if (!container) return;
  const type = v12State.customer.type;
  if (type === 'general') { container.innerHTML = ''; return; }
  if (type === 'member') {
    container.innerHTML = `
      <div class="v12-cust-search">
        <div style="position:relative;margin-bottom:8px;">
          <i class="material-icons-round" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;color:var(--text-muted,#9ca3af);">search</i>
          <input type="text" id="v13-cust-search" placeholder="ค้นหาชื่อ / เบอร์..."
            style="width:100%;padding:10px 12px 10px 40px;border:1.5px solid var(--border,#d1d5db);
              border-radius:10px;font-size:14px;font-family:inherit;"
            oninput="v13SearchCustomer(this.value)">
        </div>
        <div id="v13-cust-results" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
          <div style="padding:20px;text-align:center;color:var(--text-muted,#9ca3af);font-size:13px;">
            <i class="material-icons-round" style="font-size:32px;display:block;margin-bottom:6px;opacity:.4;">person_search</i>
            พิมพ์เพื่อค้นหาลูกค้า
          </div>
        </div>
      </div>`;
    // โหลดลูกค้าล่าสุด 10 คน
    v13SearchCustomer('');
    return;
  }
  if (type === 'new') {
    container.innerHTML = `
      <div style="background:var(--bg-secondary,#f9fafb);border-radius:14px;padding:16px;margin-top:4px;border:1.5px solid var(--border,#e5e7eb);">
        <div style="font-size:13px;font-weight:700;color:var(--text-secondary,#374151);margin-bottom:12px;">
          📋 ข้อมูลลูกค้าใหม่
        </div>
        <div class="v12-form-row">
          <div class="v12-form-group">
            <label>ชื่อ-นามสกุล *</label>
            <input type="text" id="v13-new-name" placeholder="ชื่อลูกค้า" value="${v12State.customer.name||''}"
              oninput="v12State.customer.name=this.value.trim()"
              style="border:1.5px solid var(--border,#d1d5db);border-radius:8px;padding:9px 12px;font-size:14px;font-family:inherit;width:100%;">
          </div>
          <div class="v12-form-group">
            <label>เบอร์โทรศัพท์</label>
            <input type="tel" id="v13-new-phone" placeholder="0XX-XXX-XXXX" value="${v12State.customer.phone||''}"
              oninput="v12State.customer.phone=this.value.trim()"
              style="border:1.5px solid var(--border,#d1d5db);border-radius:8px;padding:9px 12px;font-size:14px;font-family:inherit;width:100%;">
          </div>
        </div>
        <div class="v12-form-group" style="margin-top:8px;">
          <label>ที่อยู่</label>
          <textarea id="v13-new-address" rows="2" placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
            oninput="v12State.customer.address=this.value.trim()"
            style="border:1.5px solid var(--border,#d1d5db);border-radius:8px;padding:9px 12px;font-size:13px;
              font-family:inherit;width:100%;resize:vertical;">${v12State.customer.address||''}</textarea>
        </div>
        <button onclick="v13SaveNewCustomer()"
          style="margin-top:12px;width:100%;padding:11px;border-radius:10px;border:none;
            background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;
            font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
            display:flex;align-items:center;justify-content:center;gap:8px;">
          <i class="material-icons-round" style="font-size:16px;">person_add</i>
          ${v12State.customer.id ? '✅ บันทึกแล้ว — แก้ไขอีกครั้ง' : 'บันทึกลูกค้าใหม่'}
        </button>
      </div>`;
    return;
  }
}

window.v13SearchCustomer = async function (q) {
  const res = document.getElementById('v13-cust-results');
  if (!res) return;
  try {
    let query = db.from('customer').select('id,name,phone,address,debt_amount,total_purchase').order('name').limit(30);
    if (q.trim()) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data } = await query;
    if (!data?.length) {
      res.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">ไม่พบลูกค้า "${q}"</div>`;
      return;
    }
    res.innerHTML = data.map(c => {
      const isSel = v12State.customer.id === c.id;
      return `<div onclick="v13PickCustomer('${c.id}','${(c.name||'').replace(/'/g,"\\'")}','${(c.phone||'').replace(/'/g,"\\'")}','${(c.address||'').replace(/'/g,"\\'").replace(/\n/g,' ')}')"
        style="padding:11px 14px;border-radius:10px;cursor:pointer;
          border:1.5px solid ${isSel?'#10b981':'transparent'};
          background:${isSel?'#f0fdf4':'var(--bg-secondary,#f9fafb)'};
          display:flex;align-items:center;gap:10px;transition:all .12s;">
        <div style="width:38px;height:38px;border-radius:10px;
          background:${isSel?'#10b981':'var(--border,#e5e7eb)'};
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="material-icons-round" style="font-size:20px;color:#fff;">${isSel?'check':'person'}</i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:13px;">${c.name}</div>
          <div style="font-size:11px;color:var(--text-muted,#9ca3af);">
            ${c.phone||'ไม่ระบุเบอร์'}
            ${c.debt_amount>0?`<span style="color:#dc2626;font-weight:600;"> · หนี้ ฿${formatNum(c.debt_amount)}</span>`:''}
          </div>
        </div>
        ${c.address?'<i class="material-icons-round" style="font-size:15px;color:#8b5cf6;flex-shrink:0;" title="มีที่อยู่">location_on</i>':''}
      </div>`;
    }).join('');
  } catch(e) {
    res.innerHTML = `<div style="padding:16px;text-align:center;color:#ef4444;font-size:12px;">โหลดข้อมูลไม่สำเร็จ</div>`;
  }
};

window.v13PickCustomer = function (id, name, phone, address) {
  v12State.customer.id      = id;
  v12State.customer.name    = name;
  v12State.customer.phone   = phone || '';
  v12State.customer.address = address || '';
  const form = document.getElementById('v12-cust-form');
  if (form) v13RenderCustForm(form);
  if (typeof toast === 'function') toast(`เลือกลูกค้า: ${name}`, 'success');
};

window.v13SaveNewCustomer = async function () {
  const name    = document.getElementById('v13-new-name')?.value?.trim() || v12State.customer.name;
  const phone   = document.getElementById('v13-new-phone')?.value?.trim() || v12State.customer.phone;
  const address = document.getElementById('v13-new-address')?.value?.trim() || v12State.customer.address;
  if (!name) { if (typeof toast==='function') toast('กรุณากรอกชื่อลูกค้า','warning'); return; }
  try {
    const { data, error } = await db.from('customer').insert({
      name, phone: phone||null, address: address||null,
      total_purchase:0, visit_count:0, debt_amount:0
    }).select().single();
    if (error) throw error;
    v12State.customer.id      = data.id;
    v12State.customer.name    = data.name;
    v12State.customer.phone   = data.phone || '';
    v12State.customer.address = data.address || '';
    if (typeof toast==='function') toast(`บันทึก "${data.name}" สำเร็จ ✅`,'success');
    // Re-render form
    const form = document.getElementById('v12-cust-form');
    if (form) v13RenderCustForm(form);
  } catch(e) { if (typeof toast==='function') toast('บันทึกไม่สำเร็จ: '+e.message,'error'); }
};


/* ════════════════════════════════════════════════════════════════
   V13-2: DEBT METHOD — เพิ่ม "ค้างเครดิต" ใน Step 4
════════════════════════════════════════════════════════════════ */
window.v12S4 = function (container) {
  const payAmt   = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const isGlobal = v12State.customer.type === 'general';

  container.innerHTML = `
    <h2 class="v12-step-title">วิธีชำระเงิน</h2>
    <p class="v12-step-subtitle">ยอดที่ต้องรับ: <strong style="color:var(--primary,#3b82f6);font-size:20px;letter-spacing:-.5px;">฿${formatNum(payAmt)}</strong></p>

    <div class="v13-method-grid-4">
      <!-- เงินสด -->
      <div class="v12-method-card ${v12State.method==='cash'?'selected':''}" onclick="v13SetMethod('cash')">
        <i class="material-icons-round" style="font-size:30px;">payments</i>
        <h4>เงินสด</h4>
        <p>นับแบงค์/เหรียญ</p>
      </div>
      <!-- โอนเงิน -->
      <div class="v12-method-card ${v12State.method==='transfer'?'selected':''}" onclick="v13SetMethod('transfer')">
        <i class="material-icons-round" style="font-size:30px;">account_balance</i>
        <h4>โอนเงิน</h4>
        <p>PromptPay / QR</p>
      </div>
      <!-- บัตรเครดิต -->
      <div class="v12-method-card ${v12State.method==='credit'?'selected':''}" onclick="v13SetMethod('credit')">
        <i class="material-icons-round" style="font-size:30px;">credit_card</i>
        <h4>บัตรเครดิต</h4>
        <p>Visa / Master</p>
      </div>
      <!-- ค้างเครดิต (disabled for general) -->
      <div class="v13-method-card-debt ${v12State.method==='debt'?'selected':''} ${isGlobal?'disabled':''}"
           onclick="${isGlobal?"(typeof toast==='function'&&toast('ต้องเลือกลูกค้าก่อน','warning'))":"v13SetMethod('debt')"}">
        <i class="material-icons-round" style="font-size:28px;">pending_actions</i>
        <h4>ค้างเครดิต</h4>
        <p>${isGlobal?'ต้องเลือกลูกค้า':'บันทึกเป็นหนี้ลูกค้า'}</p>
      </div>
    </div>

    <div id="v13-method-info" style="margin-top:14px;">${v13MethodInfoHTML(payAmt)}</div>`;
};

function v13MethodInfoHTML(payAmt) {
  const m = v12State.method;
  if (m === 'transfer') {
    return `<div class="v12-qr-box">
      <i class="material-icons-round" style="font-size:52px;color:#8b5cf6;">qr_code_2</i>
      <p>สแกน PromptPay เพื่อโอน <strong>฿${formatNum(payAmt)}</strong></p>
      <p style="font-size:12px;margin-top:4px;color:var(--text-muted,#9ca3af);">หลังโอนแล้ว กด "ถัดไป" ได้เลย</p>
    </div>`;
  }
  if (m === 'credit') {
    return `<div style="background:#faf5ff;border:1.5px solid #e9d5ff;border-radius:14px;padding:20px;text-align:center;">
      <i class="material-icons-round" style="font-size:42px;color:#7c3aed;display:block;margin-bottom:8px;">credit_card</i>
      <div style="font-size:15px;font-weight:700;color:#5b21b6;">รูดบัตรเครดิต</div>
      <div style="font-size:22px;font-weight:900;color:#7c3aed;margin-top:4px;">฿${formatNum(payAmt)}</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:6px;">กด "ถัดไป" หลังรูดบัตรสำเร็จ</div>
    </div>`;
  }
  if (m === 'debt') {
    const custName = v12State.customer.name || 'ลูกค้า';
    return `<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:14px;padding:16px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <i class="material-icons-round" style="font-size:24px;color:#d97706;">warning_amber</i>
        <div style="font-size:14px;font-weight:700;color:#92400e;">บันทึกเป็นหนี้ค้างชำระ</div>
      </div>
      <div style="font-size:13px;color:#92400e;line-height:1.7;">
        ระบบจะบันทึกยอด <strong>฿${formatNum(payAmt)}</strong><br>
        เป็นหนี้ค้างชำระของ <strong>${custName}</strong><br>
        และเพิ่มยอดหนี้ในประวัติลูกค้าอัตโนมัติ
      </div>
    </div>`;
  }
  // cash: show nothing (step 5 handles it)
  return `<div style="padding:16px;text-align:center;color:var(--text-muted,#9ca3af);font-size:13px;">
    <i class="material-icons-round" style="font-size:36px;display:block;margin-bottom:6px;opacity:.5;">payments</i>
    กด "ถัดไป" เพื่อนับแบงค์รับเงิน
  </div>`;
}

window.v13SetMethod = function (method) {
  v12State.method = method;
  // Clear denominations on method switch
  if (method !== 'cash') { V13_ALL_DENOMS.forEach(d => { v12State.receivedDenominations[d.value] = 0; }); }
  // Update card selection
  document.querySelectorAll('.v12-method-card').forEach((c,i) => {
    c.classList.toggle('selected', ['cash','transfer','credit'][i] === method);
  });
  document.querySelectorAll('.v13-method-card-debt').forEach(c => {
    c.classList.toggle('selected', method === 'debt');
  });
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const info = document.getElementById('v13-method-info');
  if (info) info.innerHTML = v13MethodInfoHTML(payAmt);
  // Update step bar (cash = 6 steps, others = 5 steps)
  v12UpdateStepBar();

  // Also keep original v12SetMethod compatibility
  if (typeof window.v12SetMethod === 'function' && window.v12SetMethod !== v13SetMethod) {
    // avoid loop — don't call
  }
};
// Also patch v12SetMethod alias
window.v12SetMethod = window.v13SetMethod;


/* ════════════════════════════════════════════════════════════════
   V13-3: ENHANCED CASH COUNTING (Step 5)
   ตารางนับแบงค์/เหรียญสีแบงค์จริง + หน้าเงินทอนพนักงานนับเอง
════════════════════════════════════════════════════════════════ */
window.v12S5 = function (container) {
  v13RenderCashStep(container);
};

function v13RenderCashStep(container) {
  if (!container) return;
  const payAmt   = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const received = V13_ALL_DENOMS.reduce((s,d) => s + d.value*(v12State.receivedDenominations[d.value]||0), 0);
  const change   = received - payAmt;
  const enough   = received >= payAmt;
  const deficit  = payAmt - received;

  // Status color
  const statusColor = received === 0 ? '#9ca3af' : enough ? '#10b981' : '#f59e0b';
  const statusText  = received === 0 ? 'รอนับเงิน...' : enough ? `ทอน ฿${formatNum(change)}` : `ขาด ฿${formatNum(deficit)}`;

  container.innerHTML = `
    <h2 class="v12-step-title">รับเงินสด</h2>
    <p class="v12-step-subtitle">กดแบงค์/เหรียญที่รับจากลูกค้า | กดค้างเพื่อลบ</p>

    <!-- Summary Bar -->
    <div class="v13-cash-bar">
      <div class="v13-cash-cell">
        <div class="lbl">ยอดที่รับ</div>
        <div class="val" style="color:var(--primary,#3b82f6);">฿${formatNum(payAmt)}</div>
      </div>
      <div class="v13-cash-cell">
        <div class="lbl">รับมาแล้ว</div>
        <div class="val" id="v13-recv-display" style="color:${enough?'#10b981':'var(--text-primary,#111)'};">฿${formatNum(received)}</div>
      </div>
      <div class="v13-cash-cell">
        <div class="lbl">${enough?'เงินทอน':'ยังขาด'}</div>
        <div class="val" id="v13-diff-display" style="color:${statusColor};">฿${formatNum(enough?change:deficit)}</div>
      </div>
    </div>

    <!-- Quick Amounts -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
      <span style="font-size:12px;color:var(--text-muted,#9ca3af);">พอดี:</span>
      ${v13QuickAmounts(payAmt)}
      <button onclick="v13ClearDenoms()"
        style="margin-left:auto;border:1.5px solid #fca5a5;border-radius:8px;padding:6px 12px;
          background:#fff;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer;
          display:flex;align-items:center;gap:4px;">
        <i class="material-icons-round" style="font-size:14px;">refresh</i> ล้าง
      </button>
    </div>

    <!-- Bill Denominations -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary,#374151);margin-bottom:8px;
      display:flex;align-items:center;gap:6px;">
      <i class="material-icons-round" style="font-size:16px;">payments</i> ธนบัตร
    </div>
    <div class="v13-denom-grid">
      ${V13_BILLS.map(d => {
        const cnt = v12State.receivedDenominations[d.value] || 0;
        return `<div class="v13-denom-btn" style="background:${d.bg};--v13-shadow:${d.shadow};"
          onclick="v13AddDenom(${d.value})"
          oncontextmenu="event.preventDefault();v13RemoveDenom(${d.value})"
          title="คลิก=เพิ่ม | กดค้าง=ลบ">
          <span class="v13-denom-count-badge ${cnt>0?'show':''}" id="v13-cnt-${d.value}">${cnt}</span>
          <span class="v13-denom-label">฿${d.label}</span>
          <span class="v13-denom-sub">${cnt>0?`×${cnt} = ฿${formatNum(d.value*cnt)}`:' '}</span>
        </div>`;
      }).join('')}
    </div>

    <!-- Coin Denominations -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary,#374151);margin:10px 0 8px;
      display:flex;align-items:center;gap:6px;">
      <i class="material-icons-round" style="font-size:16px;">toll</i> เหรียญ
    </div>
    <div class="v13-coin-grid">
      ${V13_COINS.map(d => {
        const cnt = v12State.receivedDenominations[d.value] || 0;
        return `<div class="v13-coin-btn" style="background:${d.bg};--v13-shadow:${d.shadow};"
          onclick="v13AddDenom(${d.value})"
          oncontextmenu="event.preventDefault();v13RemoveDenom(${d.value})">
          <span class="v13-coin-count-badge ${cnt>0?'show':''}" id="v13-cnt-${d.value}">${cnt}</span>
          <span class="v13-coin-label">฿${d.label}</span>
        </div>`;
      }).join('')}
    </div>

    <!-- Change Section -->
    <div id="v13-change-section">
      ${enough ? v13ChangeHTML(change) : ''}
    </div>`;
}

function v13QuickAmounts(payAmt) {
  const candidates = [
    payAmt,
    Math.ceil(payAmt/100)*100,
    Math.ceil(payAmt/500)*500,
    Math.ceil(payAmt/1000)*1000,
  ].filter((v,i,a)=>a.indexOf(v)===i && v>=payAmt).slice(0,4);
  return candidates.map(v => `
    <button class="v12-quick-btn" onclick="v13SetExact(${v})">฿${formatNum(v)}</button>`
  ).join('');
}

function v13ChangeHTML(change) {
  if (change <= 0) {
    return `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:16px;text-align:center;margin-top:4px;">
      <i class="material-icons-round" style="font-size:40px;color:#10b981;display:block;">check_circle</i>
      <div style="font-size:18px;font-weight:800;color:#15803d;margin-top:4px;">พอดี — ไม่มีเงินทอน ✅</div>
    </div>`;
  }
  // Build change denomination chips
  const chgMap = typeof calcChangeDenominations==='function' ? calcChangeDenominations(change) : {};
  const allDenoms = [...V13_BILLS, ...V13_COINS];
  const chips = allDenoms.filter(d=>(chgMap[d.value]||0)>0);

  return `<div class="v13-change-section">
    <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:14px;padding:14px 16px;margin-bottom:12px;
      display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:12px;font-weight:600;color:#92400e;">💵 เงินทอนให้ลูกค้า</div>
        <div style="font-size:11px;color:#a16207;margin-top:2px;">พนักงานนับแบงค์ตามรายการด้านล่าง</div>
      </div>
      <div style="font-size:28px;font-weight:900;color:#d97706;">฿${formatNum(change)}</div>
    </div>
    ${chips.length>0 ? `
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary,#374151);margin-bottom:8px;">
      แนะนำแบงค์/เหรียญที่ทอน:
    </div>
    <div class="v13-change-grid">
      ${chips.filter(d=>d.value>=20).map(d => `
        <div class="v13-chg-item" style="background:${d.bg};">
          <span class="chg-lbl">฿${d.label}</span>
          <span class="chg-cnt">×${chgMap[d.value]}</span>
          <span class="chg-sub">= ฿${formatNum(d.value*chgMap[d.value])}</span>
        </div>`).join('')}
    </div>
    ${chips.filter(d=>d.value<20).length>0?`
    <div class="v13-change-coin-grid">
      ${chips.filter(d=>d.value<20).map(d => `
        <div class="v13-chg-item" style="background:${d.bg};border-radius:50%;width:64px;height:64px;margin:0 auto;">
          <span class="chg-lbl">฿${d.label}</span>
          <span class="chg-cnt">×${chgMap[d.value]}</span>
        </div>`).join('')}
    </div>`:''}
    `:''}
  </div>`;
}

/* --- Denomination interaction helpers --- */
window.v13AddDenom = function (val) {
  if (!v12State.receivedDenominations) v12State.receivedDenominations = {};
  v12State.receivedDenominations[val] = (v12State.receivedDenominations[val]||0) + 1;
  v13UpdateCashUI();
};
window.v13RemoveDenom = function (val) {
  if (!v12State.receivedDenominations) return;
  v12State.receivedDenominations[val] = Math.max(0, (v12State.receivedDenominations[val]||0) - 1);
  v13UpdateCashUI();
};
window.v13SetExact = function (amt) {
  V13_ALL_DENOMS.forEach(d => { v12State.receivedDenominations[d.value] = 0; });
  let rem = amt;
  [...V13_BILLS, ...V13_COINS].sort((a,b)=>b.value-a.value).forEach(d => {
    const cnt = Math.floor(rem/d.value);
    v12State.receivedDenominations[d.value] = cnt;
    rem -= cnt*d.value;
  });
  v13UpdateCashUI();
};
window.v13ClearDenoms = function () {
  V13_ALL_DENOMS.forEach(d => { v12State.receivedDenominations[d.value] = 0; });
  v13UpdateCashUI();
};

function v13UpdateCashUI() {
  const payAmt   = v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total;
  const received = V13_ALL_DENOMS.reduce((s,d)=>s+d.value*(v12State.receivedDenominations[d.value]||0),0);
  const change   = received - payAmt;
  const enough   = received >= payAmt;

  // Update badges
  V13_ALL_DENOMS.forEach(d => {
    const cnt = v12State.receivedDenominations[d.value]||0;
    const badge = document.getElementById(`v13-cnt-${d.value}`);
    if (badge) {
      badge.textContent = cnt;
      badge.classList.toggle('show', cnt>0);
    }
    // Update sub-label for bills
    if (d.value>=20) {
      const btn = badge?.closest('.v13-denom-btn');
      const sub = btn?.querySelector('.v13-denom-sub');
      if (sub) sub.textContent = cnt>0 ? `×${cnt} = ฿${formatNum(d.value*cnt)}` : ' ';
    }
  });

  // Update summary bar
  const recvEl = document.getElementById('v13-recv-display');
  const diffEl = document.getElementById('v13-diff-display');
  if (recvEl) { recvEl.textContent=`฿${formatNum(received)}`; recvEl.style.color=enough?'#10b981':'var(--text-primary,#111)'; }
  if (diffEl) {
    const abs = Math.abs(change);
    diffEl.textContent = `฿${formatNum(abs)}`;
    diffEl.style.color = received===0?'#9ca3af':enough?'#d97706':'#f59e0b';
    const lbl = diffEl.previousElementSibling;
    if (lbl) lbl.textContent = enough?'เงินทอน':'ยังขาด';
  }

  // Update change section
  const chgSec = document.getElementById('v13-change-section');
  if (chgSec) chgSec.innerHTML = enough ? v13ChangeHTML(change) : '';

  // Update next button
  const nextBtn = document.getElementById('v12-next-btn');
  if (nextBtn) {
    nextBtn.disabled = !enough;
    nextBtn.className = `v12-btn-next${enough?' green':''}`;
    nextBtn.innerHTML = enough
      ? `<i class="material-icons-round">check</i> ยืนยัน — ทอน ฿${formatNum(change)}`
      : `ถัดไป <i class="material-icons-round">arrow_forward</i>`;
  }
}


/* ════════════════════════════════════════════════════════════════
   V13-4: COMPLETE PAYMENT — รองรับ debt method
════════════════════════════════════════════════════════════════ */
async function v13CompletePayment() {
  if (typeof isProcessingPayment !== 'undefined' && isProcessingPayment) return;
  window.isProcessingPayment = true;

  if (typeof v12UpdateStepBar === 'function') v12UpdateStepBar();
  if (typeof v12RenderStepBody === 'function') v12RenderStepBody();

  try {
    /* ── Cash session ── */
    let session = null;
    try {
      const { data } = await db.from('cash_session').select('*').eq('status','open')
        .order('opened_at',{ascending:false}).limit(1).single();
      session = data;
    } catch(_) {}

    const methodMap = { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ค้างชำระ' };
    const deliveryMap = { self:'รับเอง', deliver:'จัดส่ง', partial:'รับบางส่วน' };

    const isDebt      = v12State.method === 'debt';
    const payAmt      = isDebt ? 0 : (v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total);
    const debtAmt     = isDebt ? v12State.total : (v12State.paymentType==='deposit' ? (v12State.total - v12State.depositAmount) : 0);
    const hasDeliver  = Object.values(v12State.itemModes||{}).some(m=>m.deliver>0);
    const billStatus  = (debtAmt>0||isDebt) ? 'ค้างชำระ' : (v12State.deliveryMode!=='self' ? 'รอจัดส่ง' : 'สำเร็จ');

    const { data: bill, error: billErr } = await db.from('บิลขาย').insert({
      date:             new Date().toISOString(),
      method:           methodMap[v12State.method] || 'เงินสด',
      total:            v12State.total,
      discount:         v12State.discount || 0,
      received:         isDebt ? 0 : v12State.received,
      change:           isDebt ? 0 : v12State.change,
      customer_name:    v12State.customer.name || 'ลูกค้าทั่วไป',
      customer_id:      v12State.customer.id || null,
      staff_name:       (typeof USER!=='undefined'&&USER) ? USER.username : 'system',
      status:           billStatus,
      denominations:    v12State.receivedDenominations || {},
      change_denominations: v12State.changeDenominations || {},
      delivery_mode:    deliveryMap[v12State.deliveryMode] || 'รับเอง',
      delivery_date:    v12State.deliveryDate || null,
      delivery_address: v12State.deliveryAddress || null,
      delivery_phone:   v12State.deliveryPhone  || null,
      delivery_status:  hasDeliver ? 'รอจัดส่ง' : 'สำเร็จ',
      deposit_amount:   v12State.depositAmount || 0,
    }).select().single();
    if (billErr) throw billErr;

    /* ── Bill Items ── */
    for (const item of (typeof cart!=='undefined'?cart:[])) {
      const modes = v12State.itemModes?.[item.id] || { take:item.qty, deliver:0 };
      await db.from('รายการในบิล').insert({
        bill_id:     bill.id,
        product_id:  item.id,
        name:        item.name,
        qty:         item.qty,
        price:       item.price,
        cost:        item.cost || 0,
        total:       item.price * item.qty,
        unit:        item.unit || 'ชิ้น',
        take_qty:    modes.take,
        deliver_qty: modes.deliver,
      });
      /* ตัดสต็อก take_qty เท่านั้น (deliver_qty ตัดตอนจัดส่ง) */
      if (modes.take > 0) {
        const prod = (typeof products!=='undefined') ? products.find(p=>p.id===item.id) : null;
        const sb   = parseFloat(prod?.stock || 0);
        const sa   = parseFloat((sb - modes.take).toFixed(6));
        await db.from('สินค้า').update({ stock:sa, updated_at:new Date().toISOString() }).eq('id',item.id);
        if (prod) prod.stock = sa;
        try {
          await db.from('stock_movement').insert({
            product_id:item.id, product_name:item.name,
            type:'ขาย', direction:'out', qty:modes.take,
            stock_before:sb, stock_after:sa,
            ref_id:bill.id, ref_table:'บิลขาย',
            staff_name:(typeof USER!=='undefined'&&USER)?USER.username:'system',
          });
        } catch(_) {}
      }
    }

    /* ── Cash Transaction (เงินสดเท่านั้น) ── */
    if (v12State.method === 'cash' && session) {
      try {
        await db.from('cash_transaction').insert({
          session_id:  session.id,
          type:        'ขาย', direction:'in',
          amount:      v12State.received,
          change_amt:  v12State.change,
          net_amount:  payAmt,
          balance_after: 0,
          ref_id:      bill.id, ref_table:'บิลขาย',
          staff_name:  (typeof USER!=='undefined'&&USER)?USER.username:'system',
          denominations: v12State.receivedDenominations || {},
          change_denominations: v12State.changeDenominations || {},
        });
      } catch(_) {}
    }

    /* ── Update Customer ── */
    if (v12State.customer.id) {
      try {
        const { data: cust } = await db.from('customer')
          .select('total_purchase,visit_count,debt_amount')
          .eq('id', v12State.customer.id).maybeSingle();
        await db.from('customer').update({
          total_purchase: (cust?.total_purchase||0) + v12State.total,
          visit_count:    (cust?.visit_count||0) + 1,
          debt_amount:    (cust?.debt_amount||0) + debtAmt,
        }).eq('id', v12State.customer.id);
      } catch(_) {}
    }

    if (typeof logActivity === 'function')
      logActivity('ขายสินค้า', `บิล #${bill.bill_no} ยอด ฿${formatNum(v12State.total)}${isDebt?' [ค้างชำระ]':''}`, bill.id, 'บิลขาย');
    if (typeof sendToDisplay === 'function')
      sendToDisplay({ type:'thanks', billNo:bill.bill_no, total:v12State.total });

    v12State.savedBill = bill;

    // Clear cart
    if (typeof cart !== 'undefined') { window.cart = []; }
    if (typeof loadProducts==='function')    await loadProducts();
    if (typeof renderCart==='function')       renderCart();
    if (typeof renderProductGrid==='function') renderProductGrid();
    if (typeof updateHomeStats==='function')   updateHomeStats();

    if (typeof v12UpdateStepBar==='function') v12UpdateStepBar();
    if (typeof v12RenderStepBody==='function') v12RenderStepBody();

  } catch(e) {
    console.error('[v13] Payment error:', e);
    if (typeof toast==='function') toast('เกิดข้อผิดพลาด: '+e.message,'error');
    v12State.step = v12State.method==='cash' ? 5 : 4;
    if (typeof v12UpdateUI==='function') v12UpdateUI();
  } finally {
    window.isProcessingPayment = false;
  }
}

/* expose สำหรับ v12NextStep เดิม (ถ้า v12NextStep เรียก v12CompletePayment โดยตรง) */
window.v12CompletePayment = v13CompletePayment;


/* ════════════════════════════════════════════════════════════════
   Step 6 Complete — override เพื่อรองรับ debt method display
════════════════════════════════════════════════════════════════ */
const _v13OrigV12S6 = typeof v12S6 === 'function' ? v12S6 : null;
window.v12S6 = function (container) {
  if (!v12State.savedBill) {
    container.innerHTML = `<div style="text-align:center;padding:40px 0;">
      <div style="font-size:40px;margin-bottom:12px;">⏳</div>
      <p style="color:var(--text-muted,#9ca3af);">กำลังบันทึก...</p>
    </div>`;
    return;
  }
  const b         = v12State.savedBill;
  const isDebt    = v12State.method === 'debt';
  const hasDelivery = v12State.deliveryMode !== 'self';
  const isDeposit   = v12State.paymentType === 'deposit';
  const methodLabel = { cash:'💵 เงินสด', transfer:'📱 โอนเงิน', credit:'💳 บัตรเครดิต', debt:'⏳ ค้างชำระ' }[v12State.method] || v12State.method;

  const chgBreakdown = (v12State.method==='cash' && v12State.change>0) ? (() => {
    const chgMap = typeof calcChangeDenominations==='function' ? calcChangeDenominations(v12State.change) : {};
    const allD   = [...V13_BILLS,...V13_COINS];
    const chips  = allD.filter(d=>(chgMap[d.value]||0)>0)
      .map(d=>`<span style="background:#dcfce7;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;color:#166534;">฿${d.label} ×${chgMap[d.value]}</span>`)
      .join('');
    return `<div style="margin-top:8px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 14px;">
      <div style="font-size:12px;font-weight:600;color:#15803d;margin-bottom:6px;">💵 แบงค์ทอน:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
    </div>`;
  })() : '';

  // Partial delivery summary
  const partialSummary = v12State.deliveryMode==='partial' ? (() => {
    const rows = Object.entries(v12State.itemModes||{}).map(([id,m]) => {
      if (!m) return '';
      const item = (typeof cart!=='undefined'?cart:[]).find(c=>c.id===id);
      const name = item?.name || id;
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #f3f4f6;">
        <span>${name}</span>
        <span>
          <span class="v13-mode-pill v13-mode-take">รับ ${m.take}</span>
          ${m.deliver>0?`<span class="v13-mode-pill v13-mode-deliver" style="margin-left:4px;">ส่งทีหลัง ${m.deliver}</span>`:''}
        </span>
      </div>`;
    }).join('');
    return rows ? `<div style="margin-top:12px;background:var(--bg-secondary,#f9fafb);border-radius:10px;padding:10px 14px;">
      <div style="font-size:11px;font-weight:700;color:#5b21b6;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">📦 รายการรับ/ส่ง</div>
      ${rows}
    </div>` : '';
  })() : '';

  container.innerHTML = `
    <div class="v12-complete-box">
      <i class="material-icons-round" style="color:${isDebt?'#f59e0b':'#10b981'};">${isDebt?'pending_actions':'check_circle'}</i>
      <h3>${isDebt?'บันทึกหนี้ค้างชำระ!':'บันทึกการขายสำเร็จ!'}</h3>
      <p>บิล #${b.bill_no} | ฿${formatNum(v12State.total)}</p>
    </div>

    <table class="v12-summary-table">
      <tr><td>ลูกค้า</td><td>${v12State.customer.name}</td></tr>
      <tr><td>วิธีชำระ</td><td>${methodLabel}</td></tr>
      ${isDebt ? `
        <tr><td>ยอดหนี้</td><td style="color:#f59e0b;font-weight:700;">฿${formatNum(v12State.total)}</td></tr>` : ''}
      ${isDeposit && !isDebt ? `
        <tr><td>มัดจำ</td><td style="color:#f59e0b;font-weight:700;">฿${formatNum(v12State.depositAmount)}</td></tr>
        <tr><td>ค้างชำระ</td><td style="color:#ef4444;font-weight:700;">฿${formatNum(v12State.total-v12State.depositAmount)}</td></tr>` : ''}
      ${v12State.method==='cash' ? `
        <tr><td>รับมา</td><td>฿${formatNum(v12State.received)}</td></tr>
        <tr><td>เงินทอน</td><td style="color:#10b981;font-weight:700;">฿${formatNum(v12State.change)}</td></tr>` : ''}
      ${hasDelivery ? `
        <tr><td>จัดส่ง</td><td style="color:#8b5cf6;font-weight:600;">${v12State.deliveryMode==='deliver'?'🚚 ร้านไปส่ง':'📦 รับบางส่วน'}</td></tr>
        <tr><td>วันนัด</td><td>${v12State.deliveryDate||'-'}</td></tr>` : ''}
    </table>

    ${chgBreakdown}
    ${partialSummary}

    ${hasDelivery ? `<div class="v12-delivery-notice">
      <i class="material-icons-round" style="font-size:16px;flex-shrink:0">info</i>
      สินค้าที่รอส่งจะตัดสต็อกเมื่อกด "จัดส่งสำเร็จ" ในหน้าคิวส่งของ
    </div>` : ''}

    <div class="v12-print-options" style="margin-top:16px;">
      <button class="v12-print-btn primary" onclick="v12PrintReceipt80mm('${b.id}')">
        <i class="material-icons-round" style="font-size:16px">receipt</i> ใบเสร็จ 80mm
      </button>
      <button class="v12-print-btn" onclick="v12PrintReceiptA4('${b.id}')">
        <i class="material-icons-round" style="font-size:16px">description</i> ใบเสร็จ A4
      </button>
      ${hasDelivery ? `<button class="v12-print-btn" onclick="v12PrintDeliveryNote('${b.id}')">
        <i class="material-icons-round" style="font-size:16px">local_shipping</i> ใบส่งของ
      </button>` : ''}
      <button class="v12-print-btn" onclick="closeCheckout()" style="color:var(--text-muted);border-color:var(--border,#d1d5db);">
        <i class="material-icons-round" style="font-size:16px">close</i> ปิด
      </button>
    </div>`;

  const nextBtn = document.getElementById('v12-next-btn');
  if (nextBtn) nextBtn.style.display = 'none';
  const backBtn = document.getElementById('v12-back-btn');
  if (backBtn) {
    backBtn.style.display = 'flex';
    backBtn.innerHTML = `<i class="material-icons-round">done_all</i> เสร็จสิ้น`;
    backBtn.className = 'v12-btn-next green';
    backBtn.onclick = () => closeCheckout();
  }
};


/* ════════════════════════════════════════════════════════════════
   V13-5: RETURN IN BMC — ปุ่มคืนสินค้า item-level ใน History
   ใช้ v10ShowReturnModal จาก modules-v10.js (item-level + unit conv)
════════════════════════════════════════════════════════════════ */
const _v13OrigBMCLoad = window.v12BMCLoad;
window.v12BMCLoad = async function () {
  await _v13OrigBMCLoad?.();
  // หลังโหลดตาราง → inject ปุ่มคืน item-level ถ้า v10 พร้อม
  v13InjectReturnButtons();
};

function v13InjectReturnButtons() {
  const tbody = document.getElementById('bmc-tbody');
  if (!tbody) return;
  if (typeof window.v10ShowReturnModal !== 'function') return; // v10 ไม่ได้โหลด

  tbody.querySelectorAll('tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (!tds.length) return;
    const lastTd = tds[tds.length-1];
    if (lastTd.querySelector('.v13-item-return-btn')) return; // ฉีดแล้ว

    // หา billId จากปุ่มที่มีอยู่
    const anyBtn = lastTd.querySelector('button[onclick]');
    if (!anyBtn) return;
    const m = anyBtn.getAttribute('onclick')?.match(/['"]([a-f0-9-]{36})['"]/);
    if (!m) return;
    const billId = m[1];

    // เช็คสถานะจาก badge
    const statusEl = Array.from(tr.querySelectorAll('td')).find(td => td.querySelector('.v12-status-badge'));
    const status   = statusEl?.querySelector('.v12-status-badge')?.textContent?.trim() || '';
    const canReturn = !['✕ ยกเลิก','↩ คืนสินค้า'].some(s => status.includes(s.replace('↩ ','').replace('✕ ','')));

    if (canReturn) {
      // เปลี่ยนปุ่ม "คืน" เดิม (v12ReturnBill = ทั้งบิล) ให้เป็น v10ShowReturnModal (item-level)
      const oldReturnBtn = lastTd.querySelector('[onclick*="v12ReturnBill"]');
      if (oldReturnBtn) {
        oldReturnBtn.setAttribute('onclick', `v10ShowReturnModal('${billId}')`);
        oldReturnBtn.title = 'คืนสินค้า (เลือกรายการ)';
        oldReturnBtn.innerHTML = '<i class="material-icons-round" style="font-size:13px">assignment_return</i> คืน';
        oldReturnBtn.classList.add('v13-item-return-btn');
        return;
      }
      // ถ้าไม่มีปุ่มเดิม → สร้างใหม่
      const btn = document.createElement('button');
      btn.className = 'v12-bmc-action-btn v13-item-return-btn';
      btn.setAttribute('onclick', `v10ShowReturnModal('${billId}')`);
      btn.title = 'คืนสินค้า (เลือกรายการ)';
      btn.innerHTML = `<i class="material-icons-round" style="font-size:13px">assignment_return</i> คืน`;
      btn.style.cssText = 'color:#d97706;border-color:rgba(217,119,6,0.25);';
      // แทรกก่อนปุ่มยกเลิก
      const cancelBtn = lastTd.querySelector('[onclick*="cancelBill"]');
      if (cancelBtn) lastTd.querySelector('div').insertBefore(btn, cancelBtn);
      else lastTd.querySelector('div')?.appendChild(btn);
    }
  });
}

/* MutationObserver: ถ้า tbody re-render → inject ใหม่ */
(function watchBMCTbody() {
  const obs = new MutationObserver(() => {
    const tbody = document.getElementById('bmc-tbody');
    if (tbody && tbody.children.length > 0 && !tbody.querySelector('.v13-item-return-btn')) {
      v13InjectReturnButtons();
    }
  });
  const tryWatch = () => {
    const el = document.getElementById('page-history') || document.querySelector('.v12-bmc-container')?.closest('section');
    if (el) obs.observe(el, { childList:true, subtree:true });
    else setTimeout(tryWatch, 500);
  };
  tryWatch();
})();


/* ════════════════════════════════════════════════════════════════
   BOOT LOG
════════════════════════════════════════════════════════════════ */
console.info(
  '%c[modules-v13.js] ✅%c Smart Skip | Debt Method | Enhanced Cash | Delivery Autofill | Return BMC',
  'color:#8B5CF6;font-weight:700', 'color:#6B7280'
);
