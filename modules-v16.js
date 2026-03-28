/**
 * SK POS — modules-v16.js  (โหลดหลัง modules-v15.js)
 * ══════════════════════════════════════════════════════════════════
 *  DEFINITIVE CHECKOUT REWRITE — แก้ทุกปัญหา checkout อย่างสมบูรณ์
 *
 *  Root Causes ที่แก้:
 *  1. _v15pay() เรียก window.v15CompletePayment (ไม่ใช่ v12) → project ไม่บันทึก
 *  2. v12S4 ใช้ onclick="v13SetMethod" → สำหรับ project type ปุ่ม disabled → ไม่ update btn
 *  3. ปุ่ม "ถัดไป" ไม่เปลี่ยนเป็น "ยืนยันการขาย" เมื่อเลือก method
 *  4. Project billing ไม่บันทึกลง รายจ่ายโครงการ
 *
 *  วิธีแก้: Override functions ทั้งหมดด้วย self-contained versions ใหม่
 *  ไม่พึ่ง function chain จาก v13/v14/v15 เลย
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

/* ── Helpers ─────────────────────────────────────────────────── */
const _sf = n => typeof formatNum === 'function' ? formatNum(n) : Number(n || 0).toLocaleString('th-TH');
const _ss = () => (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown';
const _st = (m, type = 'warning') => typeof toast === 'function' ? toast(m, type) : alert(m);

function _sui() {
  if (typeof v12UpdateStepBar  === 'function') v12UpdateStepBar();
  if (typeof v12RenderStepBody === 'function') v12RenderStepBody();
}

/* ── Inject CSS ──────────────────────────────────────────────── */
(function injectCSS() {
  if (document.getElementById('v16-css')) return;
  const s = document.createElement('style');
  s.id = 'v16-css';
  s.textContent = `
/* ── SK Method Cards ─────────────────────────────────────────── */
.sk-pay-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
@media(max-width:600px){ .sk-pay-grid { grid-template-columns:repeat(2,1fr); } }
.sk-pay-card {
  border:2px solid var(--border,#e5e7eb); border-radius:16px; padding:20px 12px;
  cursor:pointer; text-align:center; transition:all .2s; position:relative;
  background:var(--bg-primary,#fff); user-select:none;
}
.sk-pay-card:hover:not(.disabled):not(.selected) {
  border-color:#d1d5db; transform:translateY(-2px);
  box-shadow:0 6px 20px rgba(0,0,0,.08);
}
.sk-pay-card.selected {
  border-color:#10b981; background:#f0fdf4;
  box-shadow:0 0 0 3px rgba(16,185,129,.12);
}
.sk-pay-card.selected i { color:#10b981 !important; }
.sk-pay-card.selected .sk-pay-title { color:#065f46; }
.sk-pay-card.disabled { opacity:.38; cursor:not-allowed; }
.sk-pay-card i { font-size:32px; color:var(--text-muted,#9ca3af); display:block; margin-bottom:10px; }
.sk-pay-title { font-size:14px; font-weight:700; margin:0 0 4px; }
.sk-pay-sub   { font-size:11px; color:var(--text-muted,#9ca3af); margin:0; }
.sk-pay-card .sk-sel-dot {
  position:absolute; top:8px; right:8px; width:16px; height:16px; border-radius:50%;
  background:#10b981; display:none; align-items:center; justify-content:center;
}
.sk-pay-card.selected .sk-sel-dot { display:flex; }
.sk-pay-card .sk-sel-dot i { font-size:10px; color:#fff; display:block; margin:0; }

/* ── Step 6 Success ──────────────────────────────────────────── */
.sk-s6-wrap { padding:4px 0; }
.sk-s6-banner {
  border-radius:20px; padding:28px 24px; text-align:center;
  margin-bottom:20px; position:relative; overflow:hidden;
}
.sk-s6-banner.success { background:linear-gradient(135deg,#ecfdf5,#d1fae5); border:2px solid #6ee7b7; }
.sk-s6-banner.debt    { background:linear-gradient(135deg,#fffbeb,#fef3c7); border:2px solid #fde68a; }
.sk-s6-banner.project { background:linear-gradient(135deg,#eef2ff,#e0e7ff); border:2px solid #c7d2fe; }
.sk-s6-banner .sk-s6-icon {
  width:64px; height:64px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  margin:0 auto 14px; font-size:36px;
}
.sk-s6-banner.success .sk-s6-icon { background:#10b981; }
.sk-s6-banner.debt    .sk-s6-icon { background:#f59e0b; }
.sk-s6-banner.project .sk-s6-icon { background:#6366f1; }
.sk-s6-banner .sk-s6-icon i { font-size:34px; color:#fff; }
.sk-s6-banner h3 { font-size:20px; font-weight:900; margin:0 0 6px; }
.sk-s6-banner p  { font-size:14px; margin:0; opacity:.75; }

.sk-s6-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
@media(max-width:500px){ .sk-s6-stats { grid-template-columns:1fr 1fr; } }
.sk-s6-stat {
  background:var(--bg-secondary,#f9fafb); border-radius:14px; padding:14px 12px;
  border:1.5px solid var(--border,#f0f0f0); text-align:center;
}
.sk-s6-stat .s-lbl { font-size:11px; font-weight:600; color:var(--text-muted,#9ca3af); text-transform:uppercase; letter-spacing:.4px; margin-bottom:5px; }
.sk-s6-stat .s-val { font-size:18px; font-weight:900; letter-spacing:-.4px; }

.sk-s6-print-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-top:16px; }
@media(max-width:500px){ .sk-s6-print-grid { grid-template-columns:1fr; } }
.sk-print-card {
  border:1.5px solid var(--border,#e5e7eb); border-radius:14px; padding:14px 16px;
  cursor:pointer; display:flex; align-items:center; gap:12px; transition:all .15s;
  background:var(--bg-primary,#fff); font-family:inherit;
}
.sk-print-card:hover { border-color:#3b82f6; background:#eff6ff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(59,130,246,.12); }
.sk-print-card i { font-size:22px; color:#3b82f6; flex-shrink:0; }
.sk-print-card .pk-title { font-size:13px; font-weight:700; margin:0 0 2px; }
.sk-print-card .pk-sub   { font-size:11px; color:var(--text-muted,#9ca3af); margin:0; }
.sk-print-card.primary { background:linear-gradient(135deg,#1d4ed8,#3b82f6); border-color:#1d4ed8; }
.sk-print-card.primary:hover { background:linear-gradient(135deg,#1e40af,#2563eb); }
.sk-print-card.primary i, .sk-print-card.primary .pk-title, .sk-print-card.primary .pk-sub { color:#fff !important; }
.sk-done-btn {
  width:100%; padding:15px; border:none; border-radius:14px; margin-top:14px;
  background:linear-gradient(135deg,#10b981,#059669); color:#fff; font-size:15px;
  font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center;
  gap:8px; font-family:inherit; transition:all .15s;
}
.sk-done-btn:hover { background:linear-gradient(135deg,#059669,#047857); transform:translateY(-1px); }
`;
  document.head.appendChild(s);
})();


/* ════════════════════════════════════════════════════════════════
   STEP BAR — สะอาด ไม่มี dependency
════════════════════════════════════════════════════════════════ */
window.v12UpdateStepBar = function() {
  const bar = document.getElementById('v12-steps-bar');
  if (!bar) return;
  const gen  = v12State.customer?.type === 'general';
  const cash = v12State.method === 'cash';
  let labels, steps;
  if (gen) {
    labels = cash ? ['ลูกค้า','วิธีชำระ','รับเงิน','บันทึก'] : ['ลูกค้า','วิธีชำระ','บันทึก'];
    steps  = cash ? [1,4,5,6] : [1,4,6];
  } else {
    labels = cash ? ['ลูกค้า','รูปแบบรับ','ชำระเงิน','วิธีชำระ','รับเงิน','บันทึก']
                  : ['ลูกค้า','รูปแบบรับ','ชำระเงิน','วิธีชำระ','บันทึก'];
    steps  = cash ? [1,2,3,4,5,6] : [1,2,3,4,6];
  }
  bar.innerHTML = labels.map((lbl, i) => {
    const r = steps[i], done = r < v12State.step, active = r === v12State.step;
    const cls = done ? 'done' : active ? 'active' : '';
    const num = done ? '<i class="material-icons-round" style="font-size:11px">check</i>' : (i + 1);
    const conn = i < labels.length - 1 ? `<div class="v12-step-connector ${done ? 'done' : ''}"></div>` : '';
    return `<div class="v12-step-pill ${cls}"><span class="pill-num">${num}</span>${lbl}</div>${conn}`;
  }).join('');
};


/* ════════════════════════════════════════════════════════════════
   NAVIGATION — v12NextStep / v12PrevStep (self-contained)
   ← หัวใจหลัก: เรียก window.v12CompletePayment (latest override)
════════════════════════════════════════════════════════════════ */
window.v12NextStep = function() {
  /* Step 1: general → jump to step 4 */
  if (v12State.step === 1 && v12State.customer?.type === 'general') {
    v12State.step = 4; _sui(); return;
  }
  /* Step 2: delivery validation */
  if (v12State.step === 2) {
    const needDel = v12State.deliveryMode === 'deliver' || v12State.deliveryMode === 'partial';
    if (needDel && !v12State.deliveryDate) { _st('กรุณาระบุวันที่นัดส่ง'); return; }
    if (needDel && v12State.customer?.type === 'general') { _st('บิลจัดส่งต้องระบุลูกค้า'); return; }
  }
  /* Step 3: deposit validation */
  if (v12State.step === 3 && v12State.paymentType === 'deposit') {
    const dep = Number(document.getElementById('v12-deposit-input')?.value || 0);
    if (!dep || dep <= 0) { _st('กรุณาระบุยอดมัดจำ'); return; }
    if (dep >= v12State.total) { _st('ยอดมัดจำต้องน้อยกว่ายอดรวม'); return; }
    v12State.depositAmount = dep;
  }
  /* Step 4: method validation */
  if (v12State.step === 4) {
    if (!v12State.method) { _st('กรุณาเลือกวิธีชำระเงิน'); return; }
    if (v12State.method === 'debt' || v12State.method === 'transfer' || v12State.method === 'credit') {
      /* Non-cash: ข้ามไป step 6 แล้ว complete */
      const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
      v12State.received = v12State.method === 'debt' ? 0 : payAmt;
      v12State.change   = 0;
      v12State.step     = 6;
      _sui();
      window.v12CompletePayment(); /* ← เรียก LATEST override เสมอ */
      return;
    }
  }
  /* Step 5 (cash): validate received amount */
  if (v12State.step === 5) {
    const payAmt  = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    const allDenoms = [...(typeof V13_ALL !== 'undefined' ? V13_ALL : []),
                       ...(typeof V14_ALL !== 'undefined' && !window.V13_ALL ? V14_ALL : [])];
    const allD    = allDenoms.length > 0 ? allDenoms
      : [{value:1000},{value:500},{value:100},{value:50},{value:20},{value:10},{value:5},{value:2},{value:1}];
    const recv    = allD.reduce((s,d) => s + d.value * (v12State.receivedDenominations?.[d.value] || 0), 0);
    if (recv < payAmt) { _st('ยอดรับเงินไม่เพียงพอ', 'error'); return; }
    v12State.received = recv;
    v12State.change   = recv - payAmt;
    if (typeof calcChangeDenominations === 'function') {
      v12State.changeDenominations = calcChangeDenominations(v12State.change);
    }
    v12State.step = 6;
    _sui();
    window.v12CompletePayment(); /* ← เรียก LATEST override เสมอ */
    return;
  }
  /* Default: go to next step */
  v12State.step++;
  _sui();
};

window.v12PrevStep = function() {
  const gen = v12State.customer?.type === 'general';
  if ((v12State.step === 4 || v12State.step === 5) && gen) { v12State.step = 1; }
  else if (v12State.step === 5) { v12State.step = 4; }
  else if (v12State.step > 1)   { v12State.step--; }
  _sui();
};


/* ════════════════════════════════════════════════════════════════
   STEP 4: PAYMENT METHOD — SELF-CONTAINED (no v13SetMethod)
════════════════════════════════════════════════════════════════ */
window._skSetMethod = function(method) {
  v12State.method = method;
  /* Update card visual */
  document.querySelectorAll('.sk-pay-card').forEach(c => {
    const sel = c.dataset.method === method;
    c.classList.toggle('selected', sel);
  });
  /* Update info panel */
  const infoEl = document.getElementById('sk-pay-info');
  if (infoEl) infoEl.innerHTML = _skPayInfo(method);
  /* Update step bar (cash changes step count) */
  if (typeof v12UpdateStepBar === 'function') v12UpdateStepBar();
  /* Update next button */
  _skRefreshNextBtn();
};

function _skRefreshNextBtn() {
  const nb = document.getElementById('v12-next-btn');
  if (!nb) return;
  const m = v12State.method;
  if (!m) { nb.className = 'v12-btn-next'; nb.disabled = true; return; }
  nb.disabled = false;
  if (m === 'cash') {
    nb.className = 'v12-btn-next';
    nb.innerHTML = 'ถัดไป <i class="material-icons-round">arrow_forward</i>';
  } else {
    nb.className = 'v12-btn-next green';
    nb.innerHTML = '<i class="material-icons-round">check</i> ยืนยันการขาย';
  }
}

function _skPayInfo(method) {
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  if (method === 'transfer') return `
    <div style="background:#faf5ff;border:1.5px solid #e9d5ff;border-radius:14px;padding:20px;text-align:center;margin-top:4px;">
      <i class="material-icons-round" style="font-size:48px;color:#8b5cf6;display:block;margin-bottom:8px;">qr_code_2</i>
      <div style="font-size:15px;font-weight:700;color:#5b21b6;">สแกน PromptPay</div>
      <div style="font-size:22px;font-weight:900;color:#7c3aed;margin-top:4px;">฿${_sf(payAmt)}</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:6px;">หลังโอนแล้วกด "ยืนยันการขาย"</div>
    </div>`;
  if (method === 'credit') return `
    <div style="background:#fefce8;border:1.5px solid #fde68a;border-radius:14px;padding:20px;text-align:center;margin-top:4px;">
      <i class="material-icons-round" style="font-size:48px;color:#ca8a04;display:block;margin-bottom:8px;">credit_card</i>
      <div style="font-size:15px;font-weight:700;color:#854d0e;">รูดบัตรเครดิต</div>
      <div style="font-size:22px;font-weight:900;color:#d97706;margin-top:4px;">฿${_sf(payAmt)}</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:6px;">หลังรูดบัตรแล้วกด "ยืนยันการขาย"</div>
    </div>`;
  if (method === 'debt') return `
    <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:14px;padding:16px;margin-top:4px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <i class="material-icons-round" style="font-size:22px;color:#dc2626;">warning_amber</i>
        <div style="font-weight:700;color:#991b1b;font-size:14px;">บันทึกเป็นหนี้ค้างชำระ</div>
      </div>
      <div style="font-size:13px;color:#7f1d1d;line-height:1.7;">
        ยอด <strong>฿${_sf(payAmt)}</strong> จะบันทึกเป็นหนี้<br>
        ของ <strong>${v12State.customer?.name || 'ลูกค้า'}</strong>
      </div>
    </div>`;
  if (method === 'cash') return `
    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:16px;margin-top:4px;text-align:center;">
      <i class="material-icons-round" style="font-size:40px;color:#10b981;display:block;margin-bottom:6px;">payments</i>
      <div style="font-size:14px;font-weight:700;color:#15803d;">กด "ถัดไป" เพื่อนับแบงค์</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:4px;">รับเงินสด ฿${_sf(payAmt)}</div>
    </div>`;
  return '';
}

window.v12S4 = function(container) {
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const isGen  = v12State.customer?.type === 'general';
  const isProj = v12State.customer?.type === 'project';

  /* PROJECT TYPE: force debt, show locked view */
  if (isProj) {
    v12State.method = 'debt';
    container.innerHTML = `
      <h2 class="v12-step-title">วิธีชำระเงิน</h2>
      <p class="v12-step-subtitle">ยอดที่ต้องรับ: <strong style="color:#3b82f6;font-size:20px;">฿${_sf(payAmt)}</strong></p>
      <div class="sk-pay-grid">
        ${['เงินสด','โอนเงิน','บัตรเครดิต'].map((m, i) => `
          <div class="sk-pay-card disabled">
            <i class="material-icons-round">${['payments','account_balance','credit_card'][i]}</i>
            <div class="sk-pay-title">${m}</div>
          </div>`).join('')}
        <div class="sk-pay-card selected" data-method="debt">
          <div class="sk-sel-dot"><i class="material-icons-round">check</i></div>
          <i class="material-icons-round" style="color:#6366f1;">pending_actions</i>
          <div class="sk-pay-title" style="color:#3730a3;">ค้างเครดิต</div>
          <div class="sk-pay-sub">บิลโครงการ</div>
        </div>
      </div>
      <div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:14px;padding:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <i class="material-icons-round" style="font-size:20px;color:#6366f1;">business_center</i>
          <div style="font-weight:700;color:#3730a3;font-size:14px;">บิลโครงการ</div>
        </div>
        <div style="font-size:13px;color:#4338ca;line-height:1.8;">
          โครงการ: <strong>${v12State.customer.project_name || ''}</strong><br>
          ยอด: <strong>฿${_sf(payAmt)}</strong> บันทึกเป็นค้างชำระ<br>
          ต้นทุนสินค้าหักไปยังโครงการอัตโนมัติ
        </div>
      </div>`;
    /* Force update next button directly */
    setTimeout(() => {
      const nb = document.getElementById('v12-next-btn');
      if (nb) {
        nb.disabled = false;
        nb.className = 'v12-btn-next green';
        nb.innerHTML = '<i class="material-icons-round">check</i> ยืนยันการขาย';
      }
    }, 30);
    return;
  }

  /* NORMAL TYPE: 4 cards */
  const cards = [
    { key:'cash',     icon:'payments',           label:'เงินสด',     sub:'นับแบงค์/เหรียญ' },
    { key:'transfer', icon:'account_balance',    label:'โอนเงิน',    sub:'PromptPay / QR' },
    { key:'credit',   icon:'credit_card',        label:'บัตรเครดิต', sub:'Visa / Master' },
    { key:'debt',     icon:'pending_actions',    label:'ค้างเครดิต', sub: isGen ? '⚠ ต้องมีลูกค้า' : 'บันทึกหนี้' },
  ];

  container.innerHTML = `
    <h2 class="v12-step-title">วิธีชำระเงิน</h2>
    <p class="v12-step-subtitle">ยอดที่ต้องรับ: <strong style="color:#3b82f6;font-size:20px;letter-spacing:-.3px;">฿${_sf(payAmt)}</strong></p>
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
    <div id="sk-pay-info">${_skPayInfo(v12State.method || '')}</div>`;

  /* Refresh button after render */
  setTimeout(_skRefreshNextBtn, 20);
};


/* ════════════════════════════════════════════════════════════════
   STEP 6: SUCCESS — Beautiful Professional Design
════════════════════════════════════════════════════════════════ */
window.v12S6 = function(container) {
  if (!v12State?.savedBill) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 20px;">
        <div style="width:64px;height:64px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <i class="material-icons-round" style="font-size:32px;color:#9ca3af;">hourglass_empty</i>
        </div>
        <p style="color:var(--text-muted,#9ca3af);font-size:15px;font-weight:600;">กำลังบันทึก...</p>
      </div>`;
    return;
  }

  const b      = v12State.savedBill;
  const method = v12State.method || 'cash';
  const isDebt = method === 'debt';
  const isCash = method === 'cash';
  const isProj = v12State.customer?.type === 'project';
  const hasDel = v12State.deliveryMode !== 'self';
  const isDep  = v12State.paymentType === 'deposit';

  const bannerClass = isProj ? 'project' : isDebt ? 'debt' : 'success';
  const bannerIcon  = isProj ? 'business_center' : isDebt ? 'pending_actions' : 'check_circle';
  const bannerTitle = isProj ? 'บันทึกบิลโครงการสำเร็จ!' : isDebt ? 'บันทึกค้างชำระสำเร็จ!' : 'บันทึกการขายสำเร็จ!';
  const mLbl = {cash:'💵 เงินสด', transfer:'📱 โอนเงิน', credit:'💳 บัตรเครดิต', debt:'📋 ค้างชำระ'}[method] || method;

  /* Build stats */
  const stats = [];
  stats.push({ lbl:'เลขบิล', val:`#${b.bill_no}`, color:'#3b82f6' });
  stats.push({ lbl:'ยอดสุทธิ', val:`฿${_sf(v12State.total)}`, color:'#10b981' });
  if (isCash) {
    stats.push({ lbl:'เงินทอน', val:`฿${_sf(v12State.change)}`, color:'#d97706' });
  } else if (isDebt || isProj) {
    stats.push({ lbl:'ค้างชำระ', val:`฿${_sf(v12State.total)}`, color:'#dc2626' });
  } else {
    stats.push({ lbl:'วิธีชำระ', val:mLbl, color:'#6366f1' });
  }

  /* Change chips */
  let chgHtml = '';
  if (isCash && (v12State.change || 0) > 0 && typeof calcChangeDenominations === 'function') {
    const m = calcChangeDenominations(v12State.change);
    const allD = [...(typeof V13_ALL !== 'undefined' ? V13_ALL : []),
                  ...(typeof V14_ALL !== 'undefined' && !window.V13_ALL ? V14_ALL : [])];
    const chips = allD.filter(d => (m[d.value] || 0) > 0)
      .map(d => `<span style="background:#dcfce7;color:#166534;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700;">฿${d.label} ×${m[d.value]}</span>`)
      .join('');
    if (chips) chgHtml = `
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:600;color:#15803d;margin-bottom:8px;">💵 แบงค์ทอนให้ลูกค้า</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
      </div>`;
  }

  /* Print buttons */
  const prints = [
    { icon:'receipt',       title:'ใบเสร็จ 80mm', sub:'ใช้กับเครื่องพิมพ์ความร้อน', fn:`v12PrintReceipt80mm('${b.id}')`, primary:true },
    { icon:'description',   title:'ใบเสร็จ A4',   sub:'พิมพ์บน A4/เก็บเป็นไฟล์',    fn:`v12PrintReceiptA4('${b.id}')` },
  ];
  if (hasDel) prints.push({ icon:'local_shipping', title:'ใบส่งของ', sub:'สำหรับคนขับส่งสินค้า', fn:`v12PrintDeliveryNote('${b.id}')` });
  if (isDep)  prints.push({ icon:'receipt_long',    title:'ใบมัดจำ',  sub:'ใบรับเงินมัดจำ',       fn:`v12PrintDeposit('${b.id}')` });

  container.innerHTML = `
    <div class="sk-s6-wrap">
      <!-- Banner -->
      <div class="sk-s6-banner ${bannerClass}">
        <div class="sk-s6-icon"><i class="material-icons-round">${bannerIcon}</i></div>
        <h3>${bannerTitle}</h3>
        <p>${v12State.customer?.name || 'ลูกค้าทั่วไป'} · ${mLbl}</p>
      </div>

      <!-- Stats -->
      <div class="sk-s6-stats">
        ${stats.map(s => `<div class="sk-s6-stat">
          <div class="s-lbl">${s.lbl}</div>
          <div class="s-val" style="color:${s.color};">${s.val}</div>
        </div>`).join('')}
      </div>

      ${chgHtml}

      ${hasDel ? `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:12px;color:#5b21b6;display:flex;align-items:center;gap:8px;">
        <i class="material-icons-round" style="font-size:16px;flex-shrink:0;">info</i>
        สินค้าที่รอส่งจะตัดสต็อกเมื่อกด "จัดส่งสำเร็จ" ในคิวส่งของ
      </div>` : ''}

      ${isDep ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:13px;">
        <div style="font-weight:700;color:#92400e;margin-bottom:4px;">💰 มัดจำ / ค้างชำระ</div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">มัดจำ</span><span style="font-weight:700;color:#d97706;">฿${_sf(v12State.depositAmount)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">คงค้าง</span><span style="font-weight:700;color:#ef4444;">฿${_sf(v12State.total - v12State.depositAmount)}</span></div>
      </div>` : ''}

      ${isProj ? `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:13px;color:#3730a3;">
        <div style="font-weight:700;margin-bottom:4px;">🏗️ ${v12State.customer.project_name}</div>
        <div style="font-size:12px;color:#6366f1;">ต้นทุนสินค้าถูกบันทึกไปยังโครงการแล้ว</div>
      </div>` : ''}

      <!-- Print Cards -->
      <div style="font-size:12px;font-weight:600;color:var(--text-muted,#9ca3af);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🖨️ พิมพ์เอกสาร</div>
      <div class="sk-s6-print-grid">
        ${prints.map(p => `
          <button class="sk-print-card ${p.primary ? 'primary' : ''}" onclick="${p.fn}">
            <i class="material-icons-round">${p.icon}</i>
            <div>
              <div class="pk-title">${p.title}</div>
              <div class="pk-sub">${p.sub}</div>
            </div>
          </button>`).join('')}
      </div>

      <!-- Done Button -->
      <button class="sk-done-btn" onclick="typeof closeCheckout==='function'&&closeCheckout()">
        <i class="material-icons-round">done_all</i> เสร็จสิ้น
      </button>
    </div>`;

  /* Hide next, update back */
  const nb = document.getElementById('v12-next-btn');
  const bb = document.getElementById('v12-back-btn');
  if (nb) nb.style.display = 'none';
  if (bb) {
    bb.style.display = 'flex';
    bb.innerHTML = '<i class="material-icons-round">done_all</i> เสร็จสิ้น';
    bb.className = 'v12-btn-next green';
    bb.onclick = () => typeof closeCheckout === 'function' && closeCheckout();
  }
};


/* ════════════════════════════════════════════════════════════════
   COMPLETE PAYMENT — handles ALL cases with conv_rate
════════════════════════════════════════════════════════════════ */
async function _sfetchUnits(ids) {
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
    (prods || []).forEach(p => { bm[p.id] = p.unit || 'ชิ้น'; cm[p.id] = parseFloat(p.cost) || 0; });
  } catch(e) { console.warn('[v16] fetchUnits:', e.message); }
  return { um, bm, cm };
}

window.v12CompletePayment = async function() {
  if (window._v16busy) return;
  window._v16busy = true;
  try { if (typeof isProcessingPayment !== 'undefined') isProcessingPayment = true; } catch(_) {}

  /* Show loading */
  _sui();

  try {
    /* Identify payment type */
    const isProj = (v12State.customer?.type === 'project' || v12State._forceDebt) && !!v12State.customer?.project_id;
    const isDebt = v12State.method === 'debt';
    const isCash = v12State.method === 'cash';
    const methodMap = { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ค้างเครดิต' };
    const delivMap  = { self:'รับเอง', deliver:'จัดส่ง', partial:'รับบางส่วน' };

    const payAmt  = (isDebt || isProj) ? 0 : (v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total);
    const debtAmt = (isDebt && !isProj) ? v12State.total : (v12State.paymentType === 'deposit' ? (v12State.total - v12State.depositAmount) : 0);
    const billStatus = (isDebt || isProj) ? 'ค้างชำระ' : (debtAmt > 0 ? 'ค้างชำระ' : (v12State.deliveryMode !== 'self' ? 'รอจัดส่ง' : 'สำเร็จ'));
    const hasDeliver = Object.values(v12State.itemModes || {}).some(m => m.deliver > 0);

    /* Cash session */
    let session = null;
    if (isCash) {
      try {
        const { data } = await db.from('cash_session').select('*')
          .eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
        session = data;
      } catch(_) {}
    }

    const cartArr = window.cart || (typeof cart !== 'undefined' ? cart : []);
    const ids = [...new Set(cartArr.map(i => i.id).filter(Boolean))];
    const { um, bm, cm } = await _sfetchUnits(ids);

    /* Insert bill */
    const { data: bill, error: be } = await db.from('บิลขาย').insert({
      date:             new Date().toISOString(),
      method:           methodMap[v12State.method] || 'เงินสด',
      total:            v12State.total,
      discount:         v12State.discount || 0,
      received:         payAmt,
      change:           (isDebt || isProj) ? 0 : (v12State.change || 0),
      customer_name:    v12State.customer?.name || 'ลูกค้าทั่วไป',
      customer_id:      (!isProj && v12State.customer?.id) ? v12State.customer.id : null,
      project_id:       isProj ? v12State.customer.project_id : null,
      staff_name:       _ss(),
      status:           billStatus,
      denominations:    v12State.receivedDenominations || {},
      change_denominations: v12State.changeDenominations || {},
      delivery_mode:    delivMap[v12State.deliveryMode] || 'รับเอง',
      delivery_date:    v12State.deliveryDate   || null,
      delivery_address: v12State.deliveryAddress || null,
      delivery_phone:   v12State.deliveryPhone  || null,
      delivery_status:  hasDeliver ? 'รอจัดส่ง' : 'สำเร็จ',
      deposit_amount:   v12State.depositAmount || 0,
    }).select().single();
    if (be) throw be;

    /* Bill items + stock deduction */
    let projCost = 0;
    for (const item of cartArr) {
      const modes   = (v12State.itemModes || {})[item.id] || { take: item.qty, deliver: 0 };
      const su      = item.unit || 'ชิ้น';
      const bu      = bm[item.id] || su;
      let   cr      = 1;
      if (su !== bu) { const pu = um[item.id] || {}; cr = parseFloat(pu[su]) || 1; }
      const costPSU = (cm[item.id] || item.cost || 0) * cr;

      await db.from('รายการในบิล').insert({
        bill_id: bill.id, product_id: item.id, name: item.name,
        qty: item.qty, price: item.price, cost: costPSU,
        total: item.price * item.qty, unit: su,
        take_qty: modes.take, deliver_qty: modes.deliver,
      });

      if (modes.take > 0) {
        const baseQty = parseFloat((modes.take * cr).toFixed(6));
        const allP    = typeof products !== 'undefined' ? products : [];
        const prod    = allP.find(p => p.id === item.id);
        const sb      = parseFloat(prod?.stock ?? 0);
        const sa      = parseFloat((sb - baseQty).toFixed(6));
        await db.from('สินค้า').update({ stock: sa, updated_at: new Date().toISOString() }).eq('id', item.id);
        if (prod) prod.stock = sa;
        try {
          await db.from('stock_movement').insert({
            product_id: item.id, product_name: item.name,
            type: isProj ? 'โครงการ' : 'ขาย', direction: 'out', qty: baseQty,
            stock_before: sb, stock_after: sa,
            ref_id: bill.id, ref_table: 'บิลขาย', staff_name: _ss(),
            note: cr !== 1 ? `${modes.take} ${su} × ${cr} = ${baseQty} ${bu}` : null,
          });
        } catch(e) { console.warn('[v16] smov:', e.message); }
        if (isProj) projCost += costPSU * modes.take;
      }
    }

    /* Project: record goods cost */
    if (isProj && projCost > 0) {
      const names = cartArr.map(i => `${i.name} ×${i.qty}`).join(', ');
      try {
        await db.from('รายจ่ายโครงการ').insert({
          project_id: v12State.customer.project_id,
          description: `สินค้าจากร้าน: ${names}`,
          amount: projCost, category: 'สินค้า', type: 'goods',
          bill_id: bill.id, notes: `บิล #${bill.bill_no}`,
        });
        const { data: pj } = await db.from('โครงการ').select('total_goods_cost')
          .eq('id', v12State.customer.project_id).maybeSingle();
        await db.from('โครงการ').update({ total_goods_cost: (pj?.total_goods_cost || 0) + projCost })
          .eq('id', v12State.customer.project_id);
      } catch(e) { console.warn('[v16] projCost:', e.message); }
    }

    /* Cash transaction */
    if (isCash && session && (v12State.received || 0) > 0) {
      try {
        await db.from('cash_transaction').insert({
          session_id: session.id, type: 'ขาย', direction: 'in',
          amount: v12State.received, change_amt: v12State.change,
          net_amount: payAmt, balance_after: 0,
          ref_id: bill.id, ref_table: 'บิลขาย', staff_name: _ss(),
          denominations: v12State.receivedDenominations || {},
          change_denominations: v12State.changeDenominations || {},
        });
      } catch(e) { console.warn('[v16] cashTx:', e.message); }
    }

    /* Customer update */
    if (!isProj && v12State.customer?.id) {
      try {
        const { data: cu } = await db.from('customer')
          .select('total_purchase,visit_count,debt_amount')
          .eq('id', v12State.customer.id).maybeSingle();
        await db.from('customer').update({
          total_purchase: (cu?.total_purchase || 0) + v12State.total,
          visit_count:    (cu?.visit_count    || 0) + 1,
          debt_amount:    (cu?.debt_amount    || 0) + debtAmt,
        }).eq('id', v12State.customer.id);
      } catch(e) { console.warn('[v16] cust:', e.message); }
    }

    /* Log + display */
    if (typeof logActivity === 'function') logActivity(
      isProj ? 'ขายโครงการ' : 'ขายสินค้า',
      `บิล #${bill.bill_no} ฿${_sf(v12State.total)}${isProj ? ` [${v12State.customer.project_name}]` : isDebt ? ' [ค้างชำระ]' : ''}`,
      bill.id, 'บิลขาย'
    );
    if (typeof sendToDisplay === 'function') sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: v12State.total });

    /* Finalize */
    v12State.savedBill = bill;
    window.cart = [];
    if (typeof loadProducts       === 'function') await loadProducts();
    if (typeof renderCart         === 'function') renderCart();
    if (typeof renderProductGrid  === 'function') renderProductGrid();
    if (typeof updateHomeStats    === 'function') updateHomeStats();
    _sui(); /* renders S6 */

  } catch(e) {
    console.error('[v16] payment:', e);
    _st('เกิดข้อผิดพลาด: ' + e.message, 'error');
    v12State.step = v12State.method === 'cash' ? 5 : 4;
    _sui();
  } finally {
    window._v16busy = false;
    try { if (typeof isProcessingPayment !== 'undefined') isProcessingPayment = false; } catch(_) {}
  }
};

/* Sync aliases — ทุกที่ที่เรียก v15/v13/v12CompletePayment จะมาที่ v16 */
window.v15CompletePayment = window.v12CompletePayment;
window.v13CompletePayment = window.v12CompletePayment;


/* ════════════════════════════════════════════════════════════════
   PROJECT NAV — robust injection
════════════════════════════════════════════════════════════════ */
window.goProjects = function() {
  document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
  const sec = document.getElementById('page-projects');
  if (sec) sec.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="projects"]')?.classList.add('active');
  const t = document.getElementById('page-title-text');
  if (t) t.textContent = '🏗️ โครงการ';
  document.getElementById('sidebar')?.classList.remove('show');
  if (typeof window.renderProjects === 'function') window.renderProjects();
};

(function ensureProjectNav() {
  function run() {
    /* Section */
    if (!document.getElementById('page-projects')) {
      const sec = document.createElement('section');
      sec.id = 'page-projects';
      sec.className = 'page-section hidden';
      const p = document.getElementById('page-home')?.parentNode
             || document.getElementById('main-content')
             || document.body;
      p.appendChild(sec);
    }
    /* Nav item */
    if (!document.querySelector('[data-page="projects"]')) {
      const nav = document.querySelector('nav.nav-menu, .nav-menu');
      if (!nav) return;
      const lbl = document.createElement('div');
      lbl.className = 'nav-section'; lbl.textContent = 'โครงการ';
      const a = document.createElement('a');
      a.className = 'nav-item'; a.setAttribute('data-page', 'projects');
      a.innerHTML = '<i class="material-icons-round">business_center</i><span>โครงการ</span>';
      a.style.cursor = 'pointer';
      a.addEventListener('click', () => window.goProjects());
      const adm = document.getElementById('nav-admin-section');
      if (adm) { nav.insertBefore(lbl, adm); nav.insertBefore(a, adm); }
      else      { nav.appendChild(lbl); nav.appendChild(a); }
    }
    /* go() patch */
    if (typeof go === 'function' && !go._v16p) {
      const orig = go;
      window.go = function(page) {
        if (page === 'projects') { window.goProjects(); return; }
        orig(page);
      };
      window.go._v16p = true;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  [400, 1500].forEach(t => setTimeout(run, t));
})();


/* ════════════════════════════════════════════════════════════════
   MISC FIXES
════════════════════════════════════════════════════════════════ */
/* BMC badges */
const _v16mb = window.v12BMCMethodBadge;
window.v12BMCMethodBadge = m => {
  const map = {
    'ค้างเครดิต': `<span class="v12-status-badge v12-badge-red"   style="font-size:11px">📋 ค้างชำระ</span>`,
    'ค้างชำระ':   `<span class="v12-status-badge v12-badge-red"   style="font-size:11px">⚠ ค้างชำระ</span>`,
    'โครงการ':    `<span class="v12-status-badge v12-badge-purple" style="font-size:11px">🏗️ โครงการ</span>`,
  };
  return map[m] || (_v16mb ? _v16mb(m) : `<span class="v12-status-badge v12-badge-gray" style="font-size:11px">${m || '-'}</span>`);
};

console.info('%c[v16] ✅ DEFINITIVE%c S4+NextStep+S6+CompletePayment+ProjectBilling',
  'color:#6366F1;font-weight:800', 'color:#6B7280');
