/**
 * SK POS — modules-v4.js  (โหลดหลัง modules-v3.js)
 *
 * ██████████████████████████████████████████████████████████████████
 *  CASH DENOMINATION TRACKING — ครบ 100% ตั้งแต่เปิดจนปิดร้าน
 * ██████████████████████████████████████████████████████████████████
 *
 * A. OPEN SESSION  — เปิดรอบ: นับแบงค์ตั้งต้น
 * B. BILL CHECKOUT — รับเงินสด: denomination grid (override window.bcMethod)
 *                    บันทึก received+change denominations (override window.bcConfirm)
 * C. CLOSE SESSION — ปิดรอบ: นับแบงค์จริง
 * D. DRAWER PANEL  — panel สรุปแบงค์ real-time
 *
 * ─── หลักการ override ───────────────────────────────────────────
 *  onclick="fn()" ค้นหาใน window scope → window.fn = ... ใช้ได้ ✅
 *  fn() เรียกตรงภายในฟังก์ชัน → ใช้ closure → window.fn ไม่มีผล ❌
 *  ดังนั้น: override bcMethod (onclick) แทน bcRenderPayDetail (เรียกภายใน)
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

// ──────────────────────────────────────────────────────────────────
// SHARED UTILS
// ──────────────────────────────────────────────────────────────────

function v4EmptyDenoms() {
  const s = {};
  [...BILLS, ...COINS].forEach(d => { s[d.value] = 0; });
  return s;
}

function v4Total(state) {
  return [...BILLS, ...COINS].reduce((s, d) => s + (state[d.value] || 0) * d.value, 0);
}

function v4Card(d, isCoin, prefix, qty) {
  const accent   = isCoin ? '#DAA520' : d.bg;
  const txtColor = isCoin ? '#8B6914' : d.color;
  const active   = qty > 0;
  return `
    <div id="v4c-${prefix}-${d.value}"
      onclick="v4Add('${prefix}',${d.value},1)"
      style="border-radius:12px;border:2px solid ${active ? accent : isCoin ? '#DAA52030' : 'var(--border-light)'};
        background:${active ? (isCoin ? '#FFFBEB' : `color-mix(in srgb,${accent} 12%,var(--bg-surface))`) : 'var(--bg-surface)'};
        padding:10px 6px;cursor:pointer;text-align:center;position:relative;overflow:hidden;
        transition:all .12s;user-select:none;-webkit-tap-highlight-color:transparent;">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;border-radius:10px 10px 0 0;background:${accent};opacity:${active ? '1' : '.3'};"></div>
      <div id="v4badge-${prefix}-${d.value}" style="position:absolute;top:6px;right:6px;
        width:20px;height:20px;border-radius:50%;
        background:${active ? accent : 'var(--border-light)'};
        color:${active ? '#fff' : 'var(--text-tertiary)'};
        font-size:11px;font-weight:700;
        display:flex;align-items:center;justify-content:center;">${qty}</div>
      <div style="font-size:${d.value >= 1000 ? '17px' : '20px'};font-weight:800;
        color:${active ? txtColor : 'var(--text-tertiary)'};
        margin:10px 0 3px;font-family:var(--font-display);">${d.label}</div>
      <div id="v4sub-${prefix}-${d.value}" style="font-size:10px;color:var(--text-tertiary);">
        ${active ? `฿${formatNum(qty * d.value)}` : '—'}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:3px;">
        <button onclick="event.stopPropagation();v4Add('${prefix}',${d.value},-1)"
          style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border-default);
            background:var(--bg-base);cursor:pointer;font-size:17px;color:var(--danger);
            display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;">−</button>
        <span id="v4qty-${prefix}-${d.value}"
          style="font-size:14px;font-weight:700;min-width:18px;text-align:center;">${qty}</span>
        <button onclick="event.stopPropagation();v4Add('${prefix}',${d.value},1)"
          style="width:26px;height:26px;border-radius:50%;border:none;
            background:${accent};cursor:pointer;font-size:17px;color:#fff;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;">+</button>
      </div>
    </div>`;
}

function v4Grid(state, prefix) {
  return `
    <div style="font-size:11px;font-weight:700;color:var(--text-secondary);
      text-transform:uppercase;letter-spacing:.6px;
      display:flex;align-items:center;gap:5px;margin-bottom:8px;">
      <i class="material-icons-round" style="font-size:14px;color:var(--primary);">payments</i>ธนบัตร
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:14px;">
      ${BILLS.map(d => v4Card(d, false, prefix, state[d.value] || 0)).join('')}
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--text-secondary);
      text-transform:uppercase;letter-spacing:.6px;
      display:flex;align-items:center;gap:5px;margin-bottom:8px;
      padding-top:12px;border-top:1px solid var(--border-light);">
      <i class="material-icons-round" style="font-size:14px;color:#B8860B;">toll</i>เหรียญ
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;">
      ${COINS.map(d => v4Card(d, true, prefix, state[d.value] || 0)).join('')}
    </div>`;
}

window._v4States = {};

window.v4Add = function (prefix, value, delta) {
  const state = window._v4States[prefix];
  if (!state) return;
  state[value] = Math.max(0, (state[value] || 0) + delta);
  const qty     = state[value];
  const d       = [...BILLS, ...COINS].find(x => x.value === value);
  if (!d) return;
  const isCoin  = COINS.some(x => x.value === value);
  const accent  = isCoin ? '#DAA520' : d.bg;
  const txtColor = isCoin ? '#8B6914' : d.color;
  const active  = qty > 0;
  const card    = document.getElementById(`v4c-${prefix}-${value}`);
  const badge   = document.getElementById(`v4badge-${prefix}-${value}`);
  const sub     = document.getElementById(`v4sub-${prefix}-${value}`);
  const qtyEl   = document.getElementById(`v4qty-${prefix}-${value}`);
  if (card) {
    card.style.borderColor = active ? accent : isCoin ? '#DAA52030' : 'var(--border-light)';
    card.style.background  = active ? (isCoin ? '#FFFBEB' : `color-mix(in srgb,${accent} 12%,var(--bg-surface))`) : 'var(--bg-surface)';
  }
  if (badge) { badge.textContent = qty; badge.style.background = active ? accent : 'var(--border-light)'; badge.style.color = active ? '#fff' : 'var(--text-tertiary)'; }
  if (sub)   sub.textContent  = active ? `฿${formatNum(qty * value)}` : '—';
  if (qtyEl) qtyEl.textContent = qty;
  window._v4States[prefix + '_onChange']?.();
};


// ══════════════════════════════════════════════════════════════════
// A. OPEN SESSION
// ══════════════════════════════════════════════════════════════════

window.openCashSession = async function () {
  const { data: existing } = await db.from('cash_session').select('id').eq('status','open').limit(1).maybeSingle();
  if (existing) { toast('มีรอบที่เปิดอยู่แล้ว ปิดรอบก่อนจึงจะเปิดได้','warning'); return; }

  const state = v4EmptyDenoms();
  window._v4States['open'] = state;
  window._v4States['open_onChange'] = () => {
    const tot = v4Total(state);
    const el  = document.getElementById('v4open-total');
    if (el) el.textContent = `฿${formatNum(tot)}`;
    const btn = document.getElementById('v4open-confirm-btn');
    if (btn) { btn.disabled = tot === 0; btn.style.opacity = tot > 0 ? '1' : '.5'; }
  };

  const ov = document.createElement('div');
  ov.id = 'v4-open-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:20px;width:100%;max-width:580px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5);">
      <div style="background:linear-gradient(135deg,#065f46,#059669);padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">เปิดรอบเงินสด</div>
          <div style="font-size:17px;font-weight:700;color:#fff;">นับแบงค์ตั้งต้นในลิ้นชัก</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:rgba(255,255,255,.7);margin-bottom:2px;">ยอดตั้งต้น</div>
          <div id="v4open-total" style="font-size:26px;font-weight:800;color:#fff;font-family:var(--font-display);">฿0</div>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:18px;">${v4Grid(state,'open')}</div>
      <div style="padding:14px 18px;border-top:1px solid var(--border-light);background:var(--bg-base);display:flex;gap:10px;flex-shrink:0;">
        <button onclick="document.getElementById('v4-open-overlay').remove()"
          style="flex:1;padding:12px;border:1.5px solid var(--border-default);border-radius:var(--radius-md);background:none;cursor:pointer;font-family:var(--font-thai);font-size:14px;color:var(--text-secondary);">ยกเลิก</button>
        <button id="v4open-confirm-btn" onclick="v4ConfirmOpen()" disabled
          style="flex:2;padding:12px;border:none;border-radius:var(--radius-md);background:#059669;color:#fff;font-family:var(--font-thai);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;opacity:.5;transition:opacity .15s;">
          <i class="material-icons-round" style="font-size:18px;">lock_open</i> เปิดรอบ
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
};

window.v4ConfirmOpen = async function () {
  const state = window._v4States['open'];
  const tot   = v4Total(state);
  if (tot === 0) { toast('กรุณานับแบงค์ก่อนเปิดรอบ','warning'); return; }
  const btn = document.getElementById('v4open-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
  try {
    await db.from('cash_session').insert({ opened_by: USER?.username, opening_amt: tot, opening_denominations: { ...state } });
    document.getElementById('v4-open-overlay')?.remove();
    toast(`เปิดรอบสำเร็จ — ยอดตั้งต้น ฿${formatNum(tot)}`,'success');
    logActivity('เปิดรอบเงินสด',`ยอดเปิด ฿${formatNum(tot)} (นับแบงค์แล้ว)`);
    renderCashDrawer?.(); loadCashBalance?.();
  } catch(e) {
    console.error('[v4] open:',e); toast('ไม่สามารถเปิดรอบได้','error');
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="material-icons-round" style="font-size:18px;">lock_open</i> เปิดรอบ'; }
  }
};


// ══════════════════════════════════════════════════════════════════
// B. BILL CHECKOUT — override window.bcMethod (เรียกจาก onclick)
// ══════════════════════════════════════════════════════════════════

window.bcMethod = function (m) {
  if (m==='debt' && checkoutState.customer.type==='general') { toast('ค้างชำระได้เฉพาะลูกค้าประจำ','warning'); return; }
  checkoutState.method = m;
  document.querySelectorAll('.pay-method-card').forEach(b => b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  if (m === 'cash') {
    v4RenderCashDenom();
  } else {
    v4RenderNonCash(m);
  }
  if (m === 'transfer') {
    getShopConfig().then(rc => {
      if (rc?.promptpay_number) {
        const payload = generatePromptPayPayload(rc.promptpay_number, checkoutState.total);
        sendToDisplay({ type:'payment_method', method:m, total:checkoutState.total, qrPayload:payload, qrLabel:`พร้อมเพย์ ${rc.promptpay_number}` });
      } else { sendToDisplay({ type:'payment_method', method:m, total:checkoutState.total }); }
    });
  } else { sendToDisplay({ type:'payment_method', method:m, total:checkoutState.total }); }
};

function v4RenderCashDenom() {
  const el = document.getElementById('bc-pay-detail');
  if (!el) return;
  const state = v4EmptyDenoms();
  window._v4States['recv'] = state;
  window._v4States['recv_onChange'] = v4UpdateCashSummary;
  checkoutState.received = 0; checkoutState.change = 0;
  checkoutState.receivedDenominations = state;
  el.innerHTML = `
    <div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:12px;
        background:var(--bg-base);border-radius:var(--radius-md);border:1px solid var(--border-light);margin-bottom:14px;">
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">ต้องชำระ</div>
          <div style="font-size:17px;font-weight:800;color:var(--primary);font-family:var(--font-display);">฿${formatNum(checkoutState.total)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">รับมาแล้ว</div>
          <div id="v4-recv-total" style="font-size:17px;font-weight:800;color:var(--text-primary);font-family:var(--font-display);">฿0</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">เงินทอน</div>
          <div id="v4-change-total" style="font-size:17px;font-weight:800;color:var(--text-tertiary);font-family:var(--font-display);">—</div>
        </div>
      </div>
      <div>${v4Grid(state,'recv')}</div>
      <div id="v4-change-section" style="display:none;border-top:1px solid var(--border-light);margin-top:14px;padding-top:12px;">
        <div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:5px;margin-bottom:10px;">
          <i class="material-icons-round" style="font-size:14px;">currency_exchange</i>ทอนลูกค้า (ระบบคำนวณให้)
        </div>
        <div id="v4-change-cards" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;"></div>
        <div id="v4-change-coin-cards" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px;"></div>
      </div>
    </div>`;
  v4UpdateOkBtn();
}

function v4UpdateCashSummary() {
  const state  = window._v4States['recv'];
  const recv   = v4Total(state);
  const total  = checkoutState?.total || 0;
  const change = recv - total;
  checkoutState.received = recv;
  checkoutState.change   = Math.max(0, change);
  const recvEl  = document.getElementById('v4-recv-total');
  const chgEl   = document.getElementById('v4-change-total');
  const chgSec  = document.getElementById('v4-change-section');
  if (recvEl) { recvEl.textContent = `฿${formatNum(recv)}`; recvEl.style.color = recv >= total ? 'var(--success)' : recv > 0 ? 'var(--warning)' : 'var(--text-primary)'; }
  if (chgEl) {
    if (recv < total) { chgEl.textContent = recv > 0 ? `-฿${formatNum(total-recv)}` : '—'; chgEl.style.color = recv > 0 ? 'var(--danger)' : 'var(--text-tertiary)'; }
    else { chgEl.textContent = `฿${formatNum(change)}`; chgEl.style.color = change > 0 ? '#15803d' : 'var(--success)'; }
  }
  if (chgSec) chgSec.style.display = recv >= total ? 'block' : 'none';
  if (recv >= total) { checkoutState.changeDenominations = calcChangeDenominations(change); v4RenderChangeMini(checkoutState.changeDenominations); }
  v4UpdateOkBtn();
}

function v4RenderChangeMini(cd) {
  const bGrid = document.getElementById('v4-change-cards');
  const cGrid = document.getElementById('v4-change-coin-cards');
  if (!bGrid || !cGrid) return;
  function mini(d, isCoin) {
    const qty = cd[d.value] || 0; if (!qty) return '';
    const accent = isCoin ? '#DAA520' : d.bg;
    return `<div style="border-radius:10px;border:2px solid ${accent};background:${isCoin?'#FFFBEB':`color-mix(in srgb,${accent} 12%,var(--bg-surface))`};padding:7px 4px;text-align:center;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accent};border-radius:8px 8px 0 0;"></div>
      <div style="font-size:${d.value>=1000?'13px':'15px'};font-weight:800;color:${isCoin?'#8B6914':d.color};margin-top:3px;font-family:var(--font-display);">${d.label}</div>
      <div style="width:20px;height:20px;border-radius:50%;background:${accent};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:3px auto;">${qty}</div>
      <div style="font-size:9px;color:var(--text-tertiary);">฿${formatNum(qty*d.value)}</div>
    </div>`;
  }
  bGrid.innerHTML = BILLS.map(d=>mini(d,false)).join('') || '<div style="grid-column:1/-1;font-size:12px;color:var(--text-tertiary);padding:4px 0;">ไม่มีธนบัตรทอน</div>';
  cGrid.innerHTML = COINS.map(d=>mini(d,true)).join('');
}

function v4UpdateOkBtn() {
  const btn = document.getElementById('bc-ok-btn');
  if (!btn) return;
  const ok = checkoutState?.method==='cash'
    ? v4Total(window._v4States?.['recv']||{}) >= (checkoutState?.total||0)
    : !!checkoutState?.method;
  btn.disabled = !ok; btn.style.opacity = ok?'1':'.45'; btn.style.cursor = ok?'pointer':'not-allowed';
}

function v4RenderNonCash(m) {
  const el = document.getElementById('bc-pay-detail');
  if (!el) return;
  if (m === 'transfer') {
    el.innerHTML = `<div style="text-align:center;" id="bc-qr-wrap"><div style="color:var(--text-tertiary);padding:20px;"><i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;">hourglass_empty</i>กำลังโหลด QR...</div></div>`;
    getShopConfig().then(rc => {
      const wrap = document.getElementById('bc-qr-wrap'); if (!wrap) return;
      if (rc?.promptpay_number) {
        const payload = generatePromptPayPayload(rc.promptpay_number, checkoutState.total);
        wrap.innerHTML = `
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">สแกน QR พร้อมเพย์</div>
          <div id="bc-qr-canvas" style="display:inline-block;padding:12px;background:#fff;border-radius:14px;border:3px solid var(--primary);"></div>
          <div style="margin-top:10px;font-size:24px;font-weight:900;color:var(--primary);">฿${formatNum(checkoutState.total)}</div>
          <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">${rc.promptpay_number}</div>`;
        renderQRInto(document.getElementById('bc-qr-canvas'), payload, 170);
      } else {
        wrap.innerHTML = `<div style="padding:30px;color:var(--text-tertiary);"><i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;">qr_code</i><div style="font-size:13px;">กรุณาตั้งค่าเบอร์พร้อมเพย์ในหน้าผู้ดูแลระบบ</div></div>`;
      }
    });
    checkoutState.received = checkoutState.total; checkoutState.change = 0;
    setTimeout(v4UpdateOkBtn, 600);
  } else if (m === 'credit') {
    el.innerHTML = `<div style="text-align:center;padding:24px;"><i class="material-icons-round" style="font-size:52px;color:#6366f1;display:block;margin-bottom:12px;">credit_card</i><div style="font-size:15px;font-weight:600;color:var(--text-secondary);">รูดบัตรเครดิต</div><div style="font-size:30px;font-weight:900;color:var(--primary);margin-top:8px;">฿${formatNum(checkoutState.total)}</div><div style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">กดยืนยันเมื่อรูดบัตรเสร็จแล้ว</div></div>`;
    checkoutState.received = checkoutState.total; checkoutState.change = 0; v4UpdateOkBtn();
  } else if (m === 'debt') {
    el.innerHTML = `<div style="text-align:center;padding:24px;"><i class="material-icons-round" style="font-size:52px;color:var(--warning);display:block;margin-bottom:12px;">pending</i><div style="font-size:15px;font-weight:600;color:var(--text-secondary);">บันทึกเป็นหนี้ค้างชำระ</div><div style="font-size:30px;font-weight:900;color:var(--warning);margin-top:8px;">฿${formatNum(checkoutState.total)}</div><div style="margin-top:12px;padding:10px 16px;background:var(--bg-base);border-radius:8px;font-size:13px;color:var(--text-secondary);">ลูกค้า: <strong>${checkoutState.customer.name}</strong></div></div>`;
    checkoutState.received = 0; checkoutState.change = 0; v4UpdateOkBtn();
  }
}


// ══════════════════════════════════════════════════════════════════
// override window.bcConfirm — sync state + บันทึก denomination
// ══════════════════════════════════════════════════════════════════

window.bcConfirm = async function () {
  if (window.isProcessingPayment) return;
  if (!checkoutState?.method) { toast('กรุณาเลือกวิธีชำระเงิน','warning'); return; }
  if (checkoutState.method === 'cash') {
    const recv  = v4Total(window._v4States?.['recv'] || {});
    if (recv < checkoutState.total) { toast('ยอดรับเงินไม่เพียงพอ','error'); return; }
    checkoutState.received             = recv;
    checkoutState.change               = recv - checkoutState.total;
    checkoutState.receivedDenominations = { ...(window._v4States['recv'] || {}) };
    checkoutState.changeDenominations   = calcChangeDenominations(checkoutState.change);
  }
  closeBillCheckout();
  await v4CompletePayment();
};

async function v4CompletePayment() {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;
  try {
    const { data: session } = await db.from('cash_session').select('*').eq('status','open').order('opened_at',{ascending:false}).limit(1).single();
    const { data: bill, error: billError } = await db.from('บิลขาย').insert({
      date: new Date().toISOString(),
      method: {cash:'เงินสด',transfer:'โอนเงิน',credit:'บัตรเครดิต',debt:'ค้างชำระ'}[checkoutState.method]||'เงินสด',
      total: checkoutState.total, discount: checkoutState.discount,
      received: checkoutState.received, change: checkoutState.change,
      customer_name: checkoutState.customer.name, customer_id: checkoutState.customer.id||null,
      staff_name: USER?.username,
      status: checkoutState.method==='debt'?'ค้างชำระ':'สำเร็จ',
      denominations: checkoutState.receivedDenominations,
    }).select().single();
    if (billError) throw billError;

    for (const item of cart) {
      const prod = products.find(p => p.id === item.id);
      await db.from('รายการในบิล').insert({ bill_id:bill.id, product_id:item.id, name:item.name, qty:item.qty, price:item.price, cost:item.cost, total:item.price*item.qty });
      await db.from('สินค้า').update({ stock:(prod?.stock||0)-item.qty }).eq('id',item.id);
      await db.from('stock_movement').insert({ product_id:item.id, product_name:item.name, type:'ขาย', direction:'out', qty:item.qty, stock_before:prod?.stock||0, stock_after:(prod?.stock||0)-item.qty, ref_id:bill.id, ref_table:'บิลขาย', staff_name:USER?.username });
    }

    if (checkoutState.method === 'cash' && session) {
      await db.from('cash_transaction').insert({
        session_id: session.id, type:'ขาย', direction:'in',
        amount: checkoutState.received, change_amt: checkoutState.change,
        net_amount: checkoutState.total, balance_after: 0,
        ref_id: bill.id, ref_table:'บิลขาย', staff_name: USER?.username,
        denominations: checkoutState.receivedDenominations,       // แบงค์รับมา
        change_denominations: checkoutState.changeDenominations,  // แบงค์ทอนออก
      });
    }

    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id',checkoutState.customer.id).single();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase||0)+checkoutState.total,
        visit_count: (cust?.visit_count||0)+1,
        debt_amount: checkoutState.method==='debt'?(cust?.debt_amount||0)+checkoutState.total:(cust?.debt_amount||0),
      }).eq('id',checkoutState.customer.id);
    }

    logActivity('ขายสินค้า',`บิล #${bill.bill_no} ยอด ฿${formatNum(checkoutState.total)}`,bill.id,'บิลขาย');
    sendToDisplay({ type:'thanks', billNo:bill.bill_no, total:checkoutState.total });
    cart = [];
    await loadProducts();
    renderCart(); renderProductGrid(); updateHomeStats();
    Swal.fire({ icon:'success', title:'บันทึกการขายสำเร็จ', text:`บิล #${bill.bill_no} | ยอด ฿${formatNum(checkoutState.total)}`, confirmButtonColor:'#10B981', timer:3000, timerProgressBar:true });
  } catch(e) {
    console.error('[v4] completePayment:',e); toast('เกิดข้อผิดพลาดในการบันทึก','error');
  } finally { window.isProcessingPayment = false; }
}


// ══════════════════════════════════════════════════════════════════
// C. CLOSE SESSION
// ══════════════════════════════════════════════════════════════════

window.closeCashSessionWithCount = async function (session, expectedBalance) {
  const state = v4EmptyDenoms();
  window._v4States['cls'] = state;
  window._v4States['cls_onChange'] = () => {
    const counted = v4Total(state); const diff = counted - expectedBalance;
    const cEl = document.getElementById('v4close-counted');
    const dEl = document.getElementById('v4close-diff');
    if (cEl) { cEl.textContent=`฿${formatNum(counted)}`; cEl.style.color=counted>=expectedBalance?'var(--success)':'var(--text-primary)'; }
    if (dEl) { dEl.textContent=`${diff>=0?'+':''}฿${formatNum(diff)}`; dEl.style.color=diff===0?'var(--success)':diff>0?'var(--warning)':'var(--danger)'; }
  };

  const ov = document.createElement('div');
  ov.id = 'v4-close-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:20px;width:100%;max-width:580px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5);">
      <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:18px 22px;flex-shrink:0;">
        <div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">ปิดรอบเงินสด</div>
        <div style="font-size:17px;font-weight:700;color:#fff;">นับยอดจริงในลิ้นชัก</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:12px 18px;background:var(--bg-base);border-bottom:1px solid var(--border-light);flex-shrink:0;">
        <div style="text-align:center;"><div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">ระบบคาดว่ามี</div><div style="font-size:17px;font-weight:800;color:var(--primary);font-family:var(--font-display);">฿${formatNum(expectedBalance)}</div></div>
        <div style="text-align:center;"><div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">นับได้จริง</div><div id="v4close-counted" style="font-size:17px;font-weight:800;color:var(--text-primary);font-family:var(--font-display);">฿0</div></div>
        <div style="text-align:center;"><div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">ผลต่าง</div><div id="v4close-diff" style="font-size:17px;font-weight:800;color:var(--text-tertiary);font-family:var(--font-display);">—</div></div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:18px;">${v4Grid(state,'cls')}</div>
      <div style="padding:14px 18px;border-top:1px solid var(--border-light);background:var(--bg-base);flex-shrink:0;">
        <input id="v4-close-note" class="form-input" placeholder="หมายเหตุ (ถ้ามี)" style="margin-bottom:10px;">
        <div style="display:flex;gap:10px;">
          <button onclick="document.getElementById('v4-close-overlay').remove()"
            style="flex:1;padding:12px;border:1.5px solid var(--border-default);border-radius:var(--radius-md);background:none;cursor:pointer;font-family:var(--font-thai);font-size:14px;color:var(--text-secondary);">ยกเลิก</button>
          <button id="v4-close-confirm-btn" onclick="v4ConfirmClose('${session.id}',${expectedBalance})"
            style="flex:2;padding:12px;border:none;border-radius:var(--radius-md);background:#7c3aed;color:#fff;font-family:var(--font-thai);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i class="material-icons-round" style="font-size:18px;">lock</i> ยืนยันปิดรอบ
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
};

window.v4ConfirmClose = async function (sessionId, expectedBalance) {
  const state = window._v4States['cls'];
  const counted = v4Total(state); const diff = counted - expectedBalance;
  const note = document.getElementById('v4-close-note')?.value || '';
  const { isConfirmed } = await Swal.fire({
    icon: diff===0?'success':diff>0?'warning':'error',
    title: diff===0?'✅ ยอดตรง!':diff>0?`⚠️ เงินเกิน ฿${formatNum(diff)}`:`🚨 เงินขาด ฿${formatNum(Math.abs(diff))}`,
    html: `<div style="font-size:15px;">นับได้ <strong>฿${formatNum(counted)}</strong><br>ระบบคาด <strong>฿${formatNum(expectedBalance)}</strong></div>`,
    showCancelButton:true, confirmButtonText:'ยืนยันปิดรอบ', cancelButtonText:'ยกเลิก',
    confirmButtonColor: diff===0?'#10B981':'#7c3aed',
  });
  if (!isConfirmed) return;
  const btn = document.getElementById('v4-close-confirm-btn');
  if (btn) { btn.disabled=true; btn.textContent='กำลังบันทึก...'; }
  try {
    await db.from('cash_session').update({
      status:'closed', closed_at:new Date().toISOString(), closed_by:USER?.username,
      closing_amt:counted, expected_amt:expectedBalance, diff_amt:diff,
      closing_denominations:{...state}, note:note||null,
    }).eq('id',sessionId);
    document.getElementById('v4-close-overlay')?.remove();
    toast('ปิดรอบสำเร็จ','success');
    logActivity('ปิดรอบเงินสด',`นับ ฿${formatNum(counted)} คาด ฿${formatNum(expectedBalance)} ต่าง ฿${formatNum(diff)}`);
    renderCashDrawer?.(); loadCashBalance?.();
  } catch(e) {
    console.error('[v4] close:',e); toast('ไม่สามารถปิดรอบได้','error');
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="material-icons-round" style="font-size:18px;">lock</i> ยืนยันปิดรอบ'; }
  }
};


// ══════════════════════════════════════════════════════════════════
// D. DRAWER PANEL — wrap window.renderCashDrawer
// ══════════════════════════════════════════════════════════════════

const _v4OrigRender = window.renderCashDrawer;
window.renderCashDrawer = async function () {
  await _v4OrigRender?.apply(this, arguments);
  await v4InjectPanel();
};

async function v4InjectPanel() {
  document.getElementById('v4-denom-panel')?.remove();
  const { data: sess } = await db.from('cash_session').select('*').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
  if (!sess) return;
  const { data: txs } = await db.from('cash_transaction').select('direction,denominations,change_denominations').eq('session_id',sess.id);
  const net = v4CalcNet(sess, txs||[]);
  const netTot = v4Total(net);

  function panelCard(d, isCoin) {
    const qty=net[d.value]||0, accent=isCoin?'#DAA520':d.bg, active=qty>0;
    return `<div style="border-radius:10px;border:2px solid ${active?accent:'var(--border-light)'};background:${active?(isCoin?'#FFFBEB':`color-mix(in srgb,${accent} 10%,var(--bg-surface))`):'var(--bg-base)'};padding:8px 5px;text-align:center;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accent};border-radius:8px 8px 0 0;opacity:${active?'1':'.2'};"></div>
      <div style="font-size:${d.value>=1000?'13px':'15px'};font-weight:800;color:${active?(isCoin?'#8B6914':d.color):'var(--text-tertiary)'};margin-top:4px;font-family:var(--font-display);">${d.label}</div>
      <div style="width:22px;height:22px;border-radius:50%;background:${active?accent:'var(--border-light)'};color:${active?'#fff':'var(--text-tertiary)'};font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:4px auto 3px;">${qty}</div>
      <div style="font-size:9px;color:${active?'var(--text-secondary)':'var(--text-tertiary)'};">${active?`฿${formatNum(qty*d.value)}`:'—'}</div>
    </div>`;
  }

  const anchor = document.querySelector('.cash-history');
  if (!anchor) return;
  const panel = document.createElement('div');
  panel.id = 'v4-denom-panel'; panel.style.marginTop = '20px';
  panel.innerHTML = `
    <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:16px;overflow:hidden;">
      <div style="padding:13px 18px;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 72%,#000));display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;"><i class="material-icons-round" style="color:rgba(255,255,255,.9);font-size:20px;">account_balance</i>
          <div><div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.8px;">แบงค์ในลิ้นชักตอนนี้</div><div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:1px;">คำนวณจาก denomination จริงทุกรายการ</div></div>
        </div>
        <div style="text-align:right;"><div style="font-size:10px;color:rgba(255,255,255,.65);margin-bottom:1px;">รวมทั้งหมด</div><div style="font-size:22px;font-weight:800;color:#fff;font-family:var(--font-display);">฿${formatNum(netTot)}</div></div>
      </div>
      <div style="padding:13px 16px 8px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:5px;margin-bottom:10px;"><i class="material-icons-round" style="font-size:13px;color:var(--primary);">payments</i>ธนบัตร</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;">${BILLS.map(d=>panelCard(d,false)).join('')}</div>
      </div>
      <div style="padding:0 16px 13px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:5px;margin-bottom:10px;padding-top:10px;border-top:1px solid var(--border-light);"><i class="material-icons-round" style="font-size:13px;color:#B8860B;">toll</i>เหรียญ</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;">${COINS.map(d=>panelCard(d,true)).join('')}</div>
      </div>
      <div style="padding:9px 16px;background:var(--bg-base);border-top:1px solid var(--border-light);font-size:11px;color:var(--text-tertiary);display:flex;align-items:center;gap:5px;"><i class="material-icons-round" style="font-size:13px;">info</i>อัปเดตอัตโนมัติทุกครั้งที่มีรายการใหม่</div>
    </div>`;
  anchor.insertAdjacentElement('afterend', panel);
}

function v4CalcNet(sess, txs) {
  const net = v4EmptyDenoms();
  const all = [...BILLS,...COINS];
  const op  = sess.opening_denominations || {};
  all.forEach(d => { net[d.value] += Number(op[d.value]||0); });
  txs.forEach(tx => {
    const isIn=tx.direction==='in', den=tx.denominations||{}, chg=tx.change_denominations||{};
    all.forEach(d => {
      if (isIn) { net[d.value]+=Number(den[d.value]||0); net[d.value]-=Number(chg[d.value]||0); }
      else      { net[d.value]-=Number(den[d.value]||0); net[d.value]+=Number(chg[d.value]||0); }
    });
  });
  all.forEach(d => { if (net[d.value]<0) net[d.value]=0; });
  return net;
}

// SQL Migration helper
window.v4SQL = `ALTER TABLE cash_session ADD COLUMN IF NOT EXISTS opening_denominations jsonb DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS closing_denominations jsonb DEFAULT '{}'::jsonb;
ALTER TABLE cash_transaction ADD COLUMN IF NOT EXISTS change_denominations jsonb DEFAULT '{}'::jsonb;
UPDATE cash_session SET opening_denominations='{}' WHERE opening_denominations IS NULL;
UPDATE cash_session SET closing_denominations='{}' WHERE closing_denominations IS NULL;
UPDATE cash_transaction SET change_denominations='{}' WHERE change_denominations IS NULL;`;

console.info('%c[modules-v4.js] ✅%c override: openCashSession | bcMethod | bcConfirm | closeCashSessionWithCount | renderCashDrawer','color:#10B981;font-weight:700','color:#6B7280');

// ══════════════════════════════════════════════════════════════════
// E. UI REDESIGN — denomination grid สวยงาม + แสดงยอดคงเหลือ
//    ทอนเงิน — พนักงานกดเอง ดึงข้อมูลจากลิ้นชัก
// ══════════════════════════════════════════════════════════════════

/** ดึงยอดแบงค์ปัจจุบันในลิ้นชัก async */
async function v4GetCurrentDenoms() {
  const { data: sess } = await db.from('cash_session').select('*')
    .eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
  if (!sess) return null;
  const { data: txs } = await db.from('cash_transaction')
    .select('direction,denominations,change_denominations').eq('session_id', sess.id);
  return v4CalcNet(sess, txs || []);
}

/** สร้าง card สำหรับทอนเงิน — แสดงยอดคงเหลือในลิ้นชัก */
function v4ChangeCard(d, isCoin, prefix, qty, available) {
  const accent   = isCoin ? '#DAA520' : d.bg;
  const txtColor = isCoin ? '#8B6914' : d.color;
  const active   = qty > 0;
  const avail    = available || 0;
  const noStock  = avail === 0;
  return `
    <div id="v4c-${prefix}-${d.value}"
      onclick="${noStock ? '' : `v4AddChange('${prefix}',${d.value},1,${avail})`}"
      style="border-radius:12px;
        border:2px solid ${active ? accent : noStock ? '#e5e7eb' : isCoin ? '#DAA52030' : 'var(--border-light)'};
        background:${noStock ? '#f9fafb' : active ? (isCoin ? '#FFFBEB' : `color-mix(in srgb,${accent} 12%,var(--bg-surface))`) : 'var(--bg-surface)'};
        padding:10px 6px;cursor:${noStock ? 'not-allowed' : 'pointer'};text-align:center;
        position:relative;overflow:hidden;transition:all .12s;
        user-select:none;-webkit-tap-highlight-color:transparent;
        opacity:${noStock ? '.45' : '1'};">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;border-radius:10px 10px 0 0;
        background:${noStock ? '#d1d5db' : accent};opacity:${active ? '1' : noStock ? '.4' : '.3'};"></div>
      <!-- stock badge -->
      <div style="position:absolute;top:6px;left:5px;
        font-size:9px;font-weight:700;color:${noStock ? '#9ca3af' : avail <= 2 ? '#dc2626' : '#6b7280'};
        background:${noStock ? '#f3f4f6' : avail <= 2 ? '#fee2e2' : '#f3f4f6'};
        border-radius:4px;padding:1px 4px;line-height:1.4;">x${avail}</div>
      <!-- qty badge -->
      <div id="v4badge-${prefix}-${d.value}" style="
        position:absolute;top:6px;right:5px;
        width:20px;height:20px;border-radius:50%;
        background:${active ? accent : 'var(--border-light)'};
        color:${active ? '#fff' : 'var(--text-tertiary)'};
        font-size:11px;font-weight:700;
        display:flex;align-items:center;justify-content:center;">${qty}</div>
      <div style="font-size:${d.value >= 1000 ? '17px' : '20px'};font-weight:800;
        color:${noStock ? '#9ca3af' : active ? txtColor : 'var(--text-tertiary)'};
        margin:12px 0 3px;font-family:var(--font-display);">${d.label}</div>
      <div id="v4sub-${prefix}-${d.value}" style="font-size:10px;color:var(--text-tertiary);">
        ${active ? `฿${formatNum(qty * d.value)}` : '—'}
      </div>
      ${noStock ? '' : `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:3px;">
        <button onclick="event.stopPropagation();v4AddChange('${prefix}',${d.value},-1,${avail})"
          style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border-default);
            background:var(--bg-base);cursor:pointer;font-size:17px;color:var(--danger);
            display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;">−</button>
        <span id="v4qty-${prefix}-${d.value}"
          style="font-size:14px;font-weight:700;min-width:18px;text-align:center;">${qty}</span>
        <button onclick="event.stopPropagation();v4AddChange('${prefix}',${d.value},1,${avail})"
          style="width:26px;height:26px;border-radius:50%;border:none;
            background:${accent};cursor:pointer;font-size:17px;color:#fff;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;">+</button>
      </div>`}
    </div>`;
}

/** กด +/− ทอนเงิน — จำกัดไม่ให้เกินยอดคงเหลือในลิ้นชัก */
window.v4AddChange = function(prefix, value, delta, available) {
  const state   = window._v4States[prefix];
  if (!state) return;
  const newQty  = Math.max(0, Math.min((state[value] || 0) + delta, available));
  state[value]  = newQty;
  const qty     = newQty;
  const d       = [...BILLS, ...COINS].find(x => x.value === value);
  if (!d) return;
  const isCoin  = COINS.some(x => x.value === value);
  const accent  = isCoin ? '#DAA520' : d.bg;
  const active  = qty > 0;
  const badge   = document.getElementById(`v4badge-${prefix}-${value}`);
  const sub     = document.getElementById(`v4sub-${prefix}-${value}`);
  const qtyEl   = document.getElementById(`v4qty-${prefix}-${value}`);
  const card    = document.getElementById(`v4c-${prefix}-${value}`);
  if (badge) { badge.textContent = qty; badge.style.background = active ? accent : 'var(--border-light)'; badge.style.color = active ? '#fff' : 'var(--text-tertiary)'; }
  if (sub)   sub.textContent = active ? `฿${formatNum(qty * value)}` : '—';
  if (qtyEl) qtyEl.textContent = qty;
  if (card) {
    card.style.borderColor = active ? accent : isCoin ? '#DAA52030' : 'var(--border-light)';
    card.style.background  = active ? (isCoin ? '#FFFBEB' : `color-mix(in srgb,${accent} 12%,var(--bg-surface))`) : 'var(--bg-surface)';
  }
  window._v4States[prefix + '_onChange']?.();
};

/** Render หน้า Cash denomination แบบใหม่ พร้อมยอดลิ้นชัก */
async function v4RenderCashDenomFull() {
  const el = document.getElementById('bc-pay-detail');
  if (!el) return;

  const state = v4EmptyDenoms();
  window._v4States['recv'] = state;

  // โหลด skeleton ก่อน
  el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-tertiary);">
    <i class="material-icons-round" style="font-size:30px;display:block;margin-bottom:8px;animation:spin 1s linear infinite;">sync</i>
    โหลดข้อมูลลิ้นชัก...
  </div>`;

  // ดึงยอดลิ้นชักปัจจุบัน
  const currentDenoms = await v4GetCurrentDenoms() || v4EmptyDenoms();
  window._v4DrawerDenoms = currentDenoms;

  checkoutState.received = 0; checkoutState.change = 0;
  checkoutState.receivedDenominations = state;

  window._v4States['recv_onChange'] = () => v4UpdateCashSummaryFull(currentDenoms);

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0;">
      <!-- Summary bar -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:10px;
        background:var(--bg-base);border-radius:var(--radius-md);border:1px solid var(--border-light);margin-bottom:12px;">
        <div style="text-align:center;">
          <div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">ต้องชำระ</div>
          <div style="font-size:18px;font-weight:800;color:var(--primary);font-family:var(--font-display);">฿${formatNum(checkoutState.total)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">รับมาแล้ว</div>
          <div id="v4-recv-total" style="font-size:18px;font-weight:800;color:var(--text-primary);font-family:var(--font-display);">฿0</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">เงินทอน</div>
          <div id="v4-change-total" style="font-size:18px;font-weight:800;color:var(--text-tertiary);font-family:var(--font-display);">—</div>
        </div>
      </div>

      <!-- แบงค์รับ -->
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;
        display:flex;align-items:center;gap:5px;margin-bottom:8px;">
        <i class="material-icons-round" style="font-size:14px;color:var(--primary);">south_east</i>รับจากลูกค้า
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px;">
        ${BILLS.map(d => v4Card(d, false, 'recv', 0)).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding-top:8px;border-top:1px dashed var(--border-light);margin-bottom:14px;">
        ${COINS.map(d => v4Card(d, true, 'recv', 0)).join('')}
      </div>

      <!-- ทอนเงิน (ซ่อนจนรับมาครบ) -->
      <div id="v4-change-section" style="display:none;">
        <div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.6px;
          display:flex;align-items:center;gap:5px;margin-bottom:6px;padding-top:10px;border-top:1px solid var(--border-light);">
          <i class="material-icons-round" style="font-size:14px;">north_west</i>ทอนให้ลูกค้า
          <span style="font-size:10px;font-weight:400;color:var(--text-tertiary);margin-left:4px;">(xN = จำนวนในลิ้นชัก)</span>
        </div>
        <div style="padding:8px 10px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#15803d;">ต้องทอน</span>
          <strong id="v4-must-change" style="font-size:16px;color:#15803d;">฿0</strong>
        </div>
        <div style="padding:6px 10px;margin-bottom:8px;background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#9a3412;">ทอนแล้ว</span>
          <strong id="v4-gave-change" style="font-size:16px;color:#9a3412;">฿0</strong>
        </div>
        <div id="v4-change-bill-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px;"></div>
        <div id="v4-change-coin-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;"></div>
        <div id="v4-change-warn" style="display:none;padding:8px 10px;background:#fee2e2;border-radius:8px;border:1px solid #fca5a5;font-size:12px;color:#dc2626;margin-top:8px;"></div>
      </div>
    </div>`;

  v4UpdateOkBtn();
}

function v4UpdateCashSummaryFull(currentDenoms) {
  const state  = window._v4States['recv'];
  const recv   = v4Total(state);
  const total  = checkoutState?.total || 0;
  const change = recv - total;
  checkoutState.received = recv;
  checkoutState.change   = Math.max(0, change);

  const recvEl  = document.getElementById('v4-recv-total');
  const chgEl   = document.getElementById('v4-change-total');
  const chgSec  = document.getElementById('v4-change-section');

  if (recvEl) { recvEl.textContent = `฿${formatNum(recv)}`; recvEl.style.color = recv >= total ? 'var(--success)' : recv > 0 ? 'var(--warning)' : 'var(--text-primary)'; }
  if (chgEl) {
    if (recv < total) { chgEl.textContent = recv > 0 ? `-฿${formatNum(total-recv)}` : '—'; chgEl.style.color = recv > 0 ? 'var(--danger)' : 'var(--text-tertiary)'; }
    else { chgEl.textContent = `฿${formatNum(change)}`; chgEl.style.color = change > 0 ? '#15803d' : 'var(--success)'; }
  }

  if (chgSec) {
    if (recv >= total) {
      chgSec.style.display = 'block';
      v4RenderChangeGrid(change, currentDenoms);
    } else {
      chgSec.style.display = 'none';
    }
  }
  v4UpdateOkBtn();
}

function v4RenderChangeGrid(mustChange, currentDenoms) {
  // reset change state
  if (!window._v4States['chg']) {
    window._v4States['chg'] = v4EmptyDenoms();
    window._v4States['chg_onChange'] = () => v4UpdateChangeSummary(mustChange);
  } else {
    // clear to 0
    Object.keys(window._v4States['chg']).forEach(k => { window._v4States['chg'][k] = 0; });
  }

  const mustEl = document.getElementById('v4-must-change');
  if (mustEl) mustEl.textContent = `฿${formatNum(mustChange)}`;

  const bGrid = document.getElementById('v4-change-bill-grid');
  const cGrid = document.getElementById('v4-change-coin-grid');
  if (!bGrid || !cGrid) return;

  const state = window._v4States['chg'];
  bGrid.innerHTML = BILLS.map(d => v4ChangeCard(d, false, 'chg', state[d.value]||0, currentDenoms[d.value]||0)).join('');
  cGrid.innerHTML = COINS.map(d => v4ChangeCard(d, true,  'chg', state[d.value]||0, currentDenoms[d.value]||0)).join('');

  v4UpdateChangeSummary(mustChange);
}

function v4UpdateChangeSummary(mustChange) {
  const state   = window._v4States['chg'];
  const gave    = v4Total(state);
  const diff    = gave - mustChange;

  const gaveEl  = document.getElementById('v4-gave-change');
  const warnEl  = document.getElementById('v4-change-warn');

  if (gaveEl) { gaveEl.textContent = `฿${formatNum(gave)}`; gaveEl.style.color = gave >= mustChange ? '#059669' : '#9a3412'; }

  if (warnEl) {
    if (mustChange === 0) { warnEl.style.display='none'; }
    else if (gave === 0)  { warnEl.style.display='none'; }
    else if (diff < 0)    { warnEl.style.display='block'; warnEl.textContent = `ทอนยังไม่ครบ ขาดอยู่ ฿${formatNum(-diff)}`; }
    else if (diff > 0)    { warnEl.style.display='block'; warnEl.textContent = `ทอนเกิน ฿${formatNum(diff)} — กรุณาตรวจสอบ`; warnEl.style.background='#fff7ed'; warnEl.style.borderColor='#fed7aa'; warnEl.style.color='#9a3412'; }
    else                  { warnEl.style.display='none'; }
  }

  // sync changeDenominations เข้า checkoutState
  checkoutState.changeDenominations = { ...state };
  v4UpdateOkBtn();
}

// Override bcMethod ใหม่ — เรียก async version
const _v4OrigBcMethod = window.bcMethod;
window.bcMethod = function(m) {
  if (m === 'debt' && checkoutState.customer.type === 'general') { toast('ค้างชำระได้เฉพาะลูกค้าประจำ','warning'); return; }
  checkoutState.method = m;
  document.querySelectorAll('.pay-method-card').forEach(b => b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  if (m === 'cash') {
    window._v4States['chg'] = null; // reset change state
    v4RenderCashDenomFull(); // async — โหลด drawer denoms
  } else {
    v4RenderNonCash(m);
  }
  if (m === 'transfer') {
    getShopConfig().then(rc => {
      if (rc?.promptpay_number) { const payload = generatePromptPayPayload(rc.promptpay_number, checkoutState.total); sendToDisplay({ type:'payment_method', method:m, total:checkoutState.total, qrPayload:payload, qrLabel:`พร้อมเพย์ ${rc.promptpay_number}` }); }
      else { sendToDisplay({ type:'payment_method', method:m, total:checkoutState.total }); }
    });
  } else { sendToDisplay({ type:'payment_method', method:m, total:checkoutState.total }); }
};

// Override bcConfirm — ใช้ chg state ด้วย
window.bcConfirm = async function() {
  if (window.isProcessingPayment) return;
  if (!checkoutState?.method) { toast('กรุณาเลือกวิธีชำระเงิน','warning'); return; }
  if (checkoutState.method === 'cash') {
    const recv  = v4Total(window._v4States?.['recv'] || {});
    if (recv < checkoutState.total) { toast('ยอดรับเงินไม่เพียงพอ','error'); return; }
    checkoutState.received              = recv;
    checkoutState.change                = recv - checkoutState.total;
    checkoutState.receivedDenominations = { ...(window._v4States['recv'] || {}) };
    // ใช้ chg state ที่พนักงานกดเอง แทน auto-calc
    const chgState = window._v4States['chg'];
    checkoutState.changeDenominations   = chgState ? { ...chgState } : calcChangeDenominations(checkoutState.change);
  }
  closeBillCheckout();
  await v4CompletePayment();
};


// ══════════════════════════════════════════════════════════════════
// F. EXPENSE — เพิ่ม denomination ทอนเงิน
// ══════════════════════════════════════════════════════════════════

window.showAddExpenseModal = function() {
  openModal('บันทึกรายจ่าย', `
    <form id="expense-form" onsubmit="event.preventDefault();">
      <div class="form-group"><label class="form-label">รายการ *</label>
        <input class="form-input" id="exp-desc" required placeholder="เช่น ค่าไฟ, ค่าน้ำ"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">หมวดหมู่</label>
          <select class="form-input" id="exp-cat">
            <option>ทั่วไป</option><option>ค่าสาธารณูปโภค</option>
            <option>ค่าขนส่ง</option><option>ค่าซ่อมบำรุง</option>
            <option>ค่าจ้างแรงงาน</option><option>อื่นๆ</option>
          </select></div>
        <div class="form-group"><label class="form-label">วิธีชำระ</label>
          <select class="form-input" id="exp-method" onchange="v4ExpMethodChange()">
            <option value="เงินสด">เงินสด</option>
            <option value="โอนเงิน">โอนเงิน</option>
            <option value="บัตรเครดิต">บัตรเครดิต</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">จำนวนเงิน (บาท) *</label>
        <input class="form-input" type="number" id="exp-amount" min="1" required
          oninput="v4ExpAmountChange()"></div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="exp-note"></div>

      <!-- Cash denomination section -->
      <div id="exp-cash-section" style="display:none;">
        <div style="height:1px;background:var(--border-light);margin:12px 0;"></div>
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;
          display:flex;align-items:center;gap:5px;margin-bottom:10px;">
          <i class="material-icons-round" style="font-size:14px;color:var(--danger);">north_west</i>จ่ายออก
        </div>

        <!-- Summary -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:10px;
          background:var(--bg-base);border-radius:var(--radius-md);border:1px solid var(--border-light);margin-bottom:12px;">
          <div style="text-align:center;">
            <div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;">ต้องจ่าย</div>
            <div id="exp-need-val" style="font-size:16px;font-weight:800;color:var(--danger);font-family:var(--font-display);">฿0</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;">จ่ายไป</div>
            <div id="exp-paid-val" style="font-size:16px;font-weight:800;color:var(--text-primary);font-family:var(--font-display);">฿0</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;">เงินทอน</div>
            <div id="exp-change-val" style="font-size:16px;font-weight:800;color:var(--text-tertiary);font-family:var(--font-display);">—</div>
          </div>
        </div>

        <!-- จ่ายออก grid -->
        <div id="exp-pay-grid"></div>

        <!-- รับทอนกลับ (ซ่อนจนจ่ายเกิน) -->
        <div id="exp-recv-change-section" style="display:none;margin-top:12px;">
          <div style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.6px;
            display:flex;align-items:center;gap:5px;margin-bottom:8px;">
            <i class="material-icons-round" style="font-size:14px;">south_east</i>รับเงินทอนกลับ
            <span style="font-size:10px;font-weight:400;color:var(--text-tertiary);">(xN = ในลิ้นชัก)</span>
          </div>
          <div style="padding:6px 10px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;margin-bottom:8px;display:flex;justify-content:space-between;">
            <span style="font-size:12px;color:#15803d;">ต้องรับทอน</span>
            <strong id="exp-must-recv" style="font-size:14px;color:#15803d;">฿0</strong>
          </div>
          <div id="exp-recv-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:6px;"></div>
          <div id="exp-recv-coin-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;"></div>
          <div style="padding:6px 10px;background:var(--bg-base);border-radius:8px;border:1px solid var(--border-default);margin-top:8px;display:flex;justify-content:space-between;">
            <span style="font-size:12px;color:var(--text-secondary);">รับทอนแล้ว</span>
            <strong id="exp-recv-total" style="font-size:14px;color:#15803d;">฿0</strong>
          </div>
        </div>
      </div>

      <button type="button" class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="v4ProcessExpense()">
        <i class="material-icons-round">save</i> บันทึกรายจ่าย
      </button>
    </form>`);
};

window.v4ExpMethodChange = function() {
  const method = document.getElementById('exp-method')?.value;
  const sec    = document.getElementById('exp-cash-section');
  if (!sec) return;
  if (method === 'เงินสด') {
    sec.style.display = 'block';
    v4ExpAmountChange();
  } else {
    sec.style.display = 'none';
  }
};

window.v4ExpAmountChange = async function() {
  const method = document.getElementById('exp-method')?.value;
  if (method !== 'เงินสด') return;
  const sec = document.getElementById('exp-cash-section');
  if (sec) sec.style.display = 'block';

  const amount = Number(document.getElementById('exp-amount')?.value || 0);
  const needEl = document.getElementById('exp-need-val');
  if (needEl) needEl.textContent = `฿${formatNum(amount)}`;

  // init pay state
  window._v4States['epay'] = v4EmptyDenoms();
  window._v4States['epay_onChange'] = v4UpdateExpSummary;

  const currentDenoms = await v4GetCurrentDenoms() || v4EmptyDenoms();
  window._v4ExpDrawerDenoms = currentDenoms;

  const grid = document.getElementById('exp-pay-grid');
  if (grid) grid.innerHTML = v4Grid(window._v4States['epay'], 'epay');

  // กันผู้ใช้ไม่ให้กดแบงค์เกินที่มีในลิ้นชัก (ใช้ v4AddChange เหมือนกัน)
  // re-render cards with available info
  const payGrid = document.getElementById('exp-pay-grid');
  if (payGrid) {
    payGrid.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:5px;margin-bottom:8px;">
        <i class="material-icons-round" style="font-size:14px;color:var(--primary);">payments</i>ธนบัตร
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px;">
        ${BILLS.map(d => v4ChangeCard(d, false, 'epay', 0, currentDenoms[d.value]||0)).join('')}
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:5px;margin-bottom:8px;padding-top:8px;border-top:1px dashed var(--border-light);">
        <i class="material-icons-round" style="font-size:14px;color:#B8860B;">toll</i>เหรียญ
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
        ${COINS.map(d => v4ChangeCard(d, true, 'epay', 0, currentDenoms[d.value]||0)).join('')}
      </div>`;
  }
  v4UpdateExpSummary();
};

function v4UpdateExpSummary() {
  const amount  = Number(document.getElementById('exp-amount')?.value || 0);
  const payState = window._v4States['epay'] || {};
  const paid    = v4Total(payState);
  const change  = paid - amount;

  const paidEl  = document.getElementById('exp-paid-val');
  const chgEl   = document.getElementById('exp-change-val');
  const recvSec = document.getElementById('exp-recv-change-section');
  const mustEl  = document.getElementById('exp-must-recv');

  if (paidEl) { paidEl.textContent = `฿${formatNum(paid)}`; paidEl.style.color = paid >= amount ? 'var(--success)' : 'var(--text-primary)'; }
  if (chgEl) {
    if (paid < amount) { chgEl.textContent = paid > 0 ? `-฿${formatNum(amount-paid)}` : '—'; chgEl.style.color = paid > 0 ? 'var(--danger)' : 'var(--text-tertiary)'; }
    else { chgEl.textContent = `฿${formatNum(change)}`; chgEl.style.color = change > 0 ? '#15803d' : 'var(--success)'; }
  }

  if (recvSec) {
    if (change > 0) {
      recvSec.style.display = 'block';
      if (mustEl) mustEl.textContent = `฿${formatNum(change)}`;
      v4RenderExpRecvGrid(change);
    } else {
      recvSec.style.display = 'none';
    }
  }
}

function v4RenderExpRecvGrid(mustRecv) {
  if (!window._v4States['erecv']) {
    window._v4States['erecv'] = v4EmptyDenoms();
    window._v4States['erecv_onChange'] = () => {
      const recv = v4Total(window._v4States['erecv']);
      const el = document.getElementById('exp-recv-total');
      if (el) { el.textContent = `฿${formatNum(recv)}`; el.style.color = recv >= mustRecv ? '#059669' : '#15803d'; }
    };
  }
  const drawerDenoms = window._v4ExpDrawerDenoms || v4EmptyDenoms();
  const state = window._v4States['erecv'];
  const rGrid = document.getElementById('exp-recv-grid');
  const cGrid = document.getElementById('exp-recv-coin-grid');
  if (rGrid) rGrid.innerHTML = BILLS.map(d => v4ChangeCard(d, false, 'erecv', state[d.value]||0, drawerDenoms[d.value]||0)).join('');
  if (cGrid) cGrid.innerHTML = COINS.map(d => v4ChangeCard(d, true,  'erecv', state[d.value]||0, drawerDenoms[d.value]||0)).join('');
}

window.v4ProcessExpense = async function() {
  const desc    = document.getElementById('exp-desc')?.value?.trim();
  const amount  = Number(document.getElementById('exp-amount')?.value || 0);
  const method  = document.getElementById('exp-method')?.value;
  const cat     = document.getElementById('exp-cat')?.value;
  const note    = document.getElementById('exp-note')?.value || '';
  if (!desc || amount <= 0) { toast('กรุณากรอกข้อมูลให้ครบ','error'); return; }

  let payDenoms    = null;
  let recvDenoms   = null;
  let paid         = amount;
  let changeBack   = 0;

  if (method === 'เงินสด') {
    payDenoms  = window._v4States['epay'] || {};
    paid       = v4Total(payDenoms);
    if (paid < amount) { toast('ยอดที่จ่ายน้อยกว่ารายจ่าย','error'); return; }
    changeBack = paid - amount;
    if (changeBack > 0) {
      recvDenoms = window._v4States['erecv'] || {};
      const recvTotal = v4Total(recvDenoms);
      if (Math.abs(recvTotal - changeBack) > 0) {
        const ok = await Swal.fire({ icon:'warning', title:'เงินทอนไม่ครบ?',
          html:`ต้องรับทอน <strong>฿${formatNum(changeBack)}</strong> แต่กรอกแค่ ฿${formatNum(recvTotal)}<br>ต้องการบันทึกต่อไหม?`,
          showCancelButton:true, confirmButtonText:'บันทึกต่อ', cancelButtonText:'แก้ไข' });
        if (!ok.isConfirmed) return;
      }
    }
    try { await assertCashEnough(amount,'จ่ายรายจ่าย'); } catch(e) {
      Swal.fire({icon:'error',title:'เงินในลิ้นชักไม่พอ',text:e.message}); return;
    }
  }

  closeModal();
  const { data: exp } = await db.from('รายจ่าย').insert({
    description:desc, amount, method, category:cat, note,
    staff_name:USER?.username, date:new Date().toISOString(),
    denominations: payDenoms
  }).select().single();

  if (method === 'เงินสด') {
    const { data: sess } = await db.from('cash_session').select('id').eq('status','open').limit(1).single();
    if (sess) {
      await recordCashTx({
        sessionId: sess.id, type:'รายจ่าย', direction:'out',
        amount: paid, changeAmt: changeBack, netAmount: amount,
        refId: exp?.id, refTable:'รายจ่าย',
        denominations: payDenoms,
        note: desc
      });
      // บันทึก change_denominations แยก (update record)
      if (changeBack > 0 && recvDenoms) {
        await db.from('cash_transaction')
          .update({ change_denominations: recvDenoms })
          .eq('ref_id', exp?.id).eq('type','รายจ่าย');
      }
    }
  }

  toast(`บันทึกรายจ่าย ฿${formatNum(amount)} สำเร็จ`,'success');
  logActivity('บันทึกรายจ่าย',`${desc} ฿${formatNum(amount)}`);
  if (typeof loadExpenseData === 'function') loadExpenseData();
};


// ══════════════════════════════════════════════════════════════════
// F. WITHDRAWAL WIZARD — เบิกเงินออก พร้อมนับแบงค์
// ══════════════════════════════════════════════════════════════════

window.v4OpenWithdrawWizard = async function (session) {
  if (!session) { toast('กรุณาเปิดรอบเงินสดก่อน','warning'); return; }

  v9ShowOverlay('กำลังโหลดข้อมูลลิ้นชัก...');
  const currentDenoms = await v4GetCurrentDenoms() || v4EmptyDenoms();
  v9HideOverlay();

  window._v4States['wd_stock'] = currentDenoms;
  const state = v4EmptyDenoms();
  window._v4States['wd'] = state;

  window._v4States['wd_onChange'] = () => {
    const tot = v4Total(state);
    const el  = document.getElementById('v4wd-total');
    if (el) el.textContent = `฿${formatNum(tot)}`;
    const btn = document.getElementById('v4wd-confirm-btn');
    if (btn) { btn.disabled = tot === 0; btn.style.opacity = tot > 0 ? '1' : '.5'; }
  };

  const ov = document.createElement('div');
  ov.id = 'v4-wd-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  
  // สร้าง Grid โดยใช้ v4ChangeCard เพื่อแสดงยอด Available
  const gridHtml = `
    <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:5px;margin-bottom:8px;">
      <i class="material-icons-round" style="font-size:14px;color:var(--primary);">payments</i>ธนบัตร (xN = ที่มีอยู่ในลิ้นชัก)
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:14px;">
      ${BILLS.map(d => v4ChangeCard(d, false, 'wd', 0, currentDenoms[d.value] || 0)).join('')}
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:5px;margin-bottom:8px;padding-top:12px;border-top:1px solid var(--border-light);">
      <i class="material-icons-round" style="font-size:14px;color:#B8860B;">toll</i>เหรียญ
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;">
      ${COINS.map(d => v4ChangeCard(d, true, 'wd', 0, currentDenoms[d.value] || 0)).join('')}
    </div>
  `;

  ov.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:20px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5);">
      <div style="background:linear-gradient(135deg,#b91c1c,#ef4444);padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">เบิกเงินออก (Withdraw)</div>
          <div style="font-size:17px;font-weight:700;color:#fff;">เลือกธนบัตรที่ต้องการเบิกออก</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:rgba(255,255,255,.7);margin-bottom:2px;">ยอดเบิกออก</div>
          <div id="v4wd-total" style="font-size:26px;font-weight:800;color:#fff;font-family:var(--font-display);">฿0</div>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:18px;">
        ${gridHtml}
        <div style="margin-top:20px;padding:15px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
          <label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">หมายเหตุ / เหตุผลการเบิก</label>
          <input type="text" id="v4wd-note" placeholder="เช่น นำเงินฝากธนาคาร, จ่ายค่าพัสดุ..." 
            style="width:100%;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;outline:none;">
        </div>
      </div>
      <div style="padding:14px 18px;border-top:1px solid var(--border-light);background:var(--bg-base);display:flex;gap:10px;flex-shrink:0;">
        <button onclick="document.getElementById('v4-wd-overlay').remove()"
          style="flex:1;padding:12px;border:1.5px solid var(--border-default);border-radius:var(--radius-md);background:none;cursor:pointer;font-family:var(--font-thai);font-size:14px;color:var(--text-secondary);">ยกเลิก</button>
        <button id="v4wd-confirm-btn" onclick="v4ConfirmWithdraw('${session.id}')" disabled
          style="flex:2;padding:12px;border:none;border-radius:var(--radius-md);background:#ef4444;color:#fff;font-family:var(--font-thai);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;opacity:.5;transition:opacity .15s;">
          <i class="material-icons-round" style="font-size:18px;">remove_circle</i> ยืนยันการเบิกเงิน
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
};

window.v4ConfirmWithdraw = async function (sessionId) {
  const state = window._v4States['wd'];
  const tot   = v4Total(state);
  const note  = document.getElementById('v4wd-note')?.value?.trim() || '';
  
  if (tot <= 0) { toast('กรุณาเลือกยอดเงินที่ต้องการเบิก','warning'); return; }

  const btn = document.getElementById('v4wd-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  try {
    await db.from('cash_transaction').insert({
      session_id: sessionId,
      type: 'เบิกเงิน',
      direction: 'out',
      amount: tot,
      net_amount: tot,
      balance_after: 0, 
      staff_name: USER?.username || 'system',
      note: note || 'เบิกเงินออก (นับแบงค์)',
      denominations: { ...state } // บันทึกว่าเบิกใบไหนออกไปบ้าง
    });

    document.getElementById('v4-wd-overlay')?.remove();
    toast(`เบิกเงินออก ฿${formatNum(tot)} สำเร็จ`,'success');
    logActivity('เบิกเงินออก', `ยอด ฿${formatNum(tot)} (นับแบงค์แล้ว) | หมายเหตุ: ${note || '-'}`);
    
    // รีเฟรชหน้าจอ
    if (typeof renderCashDrawer === 'function') renderCashDrawer();
    if (typeof loadCashBalance === 'function') loadCashBalance();
    
    // ถ้าแสดง panel real-time อยู่ ก็ให้รีอัปเดต
    if (typeof v4InjectPanel === 'function') v4InjectPanel();

  } catch(e) {
    console.error('[v4] withdraw error:', e);
    toast('ไม่สามารถบันทึกการเบิกเงินได้','error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;">remove_circle</i> ยืนยันการเบิกเงิน'; }
  }
};
/**
 * SK POS — modules-v5.js  (โหลดหลัง modules-v4.js)
 *
 * ██████████████████████████████████████████████████████████████████
 *  A. BILL COLORS     — สีแบงค์ตามจริง + พื้นหลังสี + ทั้งระบบ
 *  B. CHECKOUT UI     — ขยาย modal + จัดกริดใหม่ไม่ซ้อนทับ
 *  C. ATTENDANCE      — เช็คชื่อ / เบิกเงิน / เงินเดือน / ข้อมูลพนักงานพร้อมสรุป
 *  D. HISTORY         — ปุ่มพิมพ์ใบเสร็จในประวัติขาย (A4/80mm)
 *  E. RECEIPT SETTINGS — ตั้งค่าครบ + ซ่อนต้นทุน default
 *  F. LOADING STATES  — กด Save → spinner ทันที
 * ██████████████████████████████████████████████████████████████████
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// A. BILL COLORS — สีแบงค์ตามธนาคารแห่งประเทศไทย (ทั้งระบบ)
// ══════════════════════════════════════════════════════════════════
// override BILLS/COINS ให้ทุกโมดูลอื่นเห็น palette ใหม่นี้

window.BILLS = [
  { value: 1000, label: '1,000', name: 'พัน',
    bg: '#6B3A2A', color: '#fff', accent: '#A0522D',
    gradient: 'linear-gradient(135deg,#6B3A2A 0%,#8B4513 60%,#A0522D 100%)' },
  { value: 500,  label: '500',   name: 'ห้าร้อย',
    bg: '#4A1580', color: '#fff', accent: '#7B2FBE',
    gradient: 'linear-gradient(135deg,#4A1580 0%,#6A1FA0 60%,#7B2FBE 100%)' },
  { value: 100,  label: '100',   name: 'ร้อย',
    bg: '#B91C1C', color: '#fff', accent: '#DC2626',
    gradient: 'linear-gradient(135deg,#B91C1C 0%,#DC2626 60%,#EF4444 100%)' },
  { value: 50,   label: '50',    name: 'ห้าสิบ',
    bg: '#1D4ED8', color: '#fff', accent: '#2563EB',
    gradient: 'linear-gradient(135deg,#1D4ED8 0%,#2563EB 60%,#3B82F6 100%)' },
  { value: 20,   label: '20',    name: 'ยี่สิบ',
    bg: '#15803D', color: '#fff', accent: '#16A34A',
    gradient: 'linear-gradient(135deg,#15803D 0%,#16A34A 60%,#22C55E 100%)' },
];

window.COINS = [
  { value: 10, label: '10', name: 'สิบ',   bg: '#92400E', color: '#fff', accent: '#B45309', gradient: 'linear-gradient(135deg,#92400E,#B45309)' },
  { value: 5,  label: '5',  name: 'ห้า',   bg: '#9A3412', color: '#fff', accent: '#C2410C', gradient: 'linear-gradient(135deg,#9A3412,#C2410C)' },
  { value: 2,  label: '2',  name: 'สอง',   bg: '#6B7280', color: '#fff', accent: '#9CA3AF', gradient: 'linear-gradient(135deg,#6B7280,#9CA3AF)' },
  { value: 1,  label: '1',  name: 'หนึ่ง', bg: '#78716C', color: '#fff', accent: '#A8A29E', gradient: 'linear-gradient(135deg,#78716C,#A8A29E)' },
];

// ── Denomination card สวย มีพื้นหลังสีจริง ──────────────────────
function v5DenomCard(d, isCoin, prefix, qty, available) {
  const gradient = d.gradient || (isCoin ? 'linear-gradient(135deg,#92400E,#B45309)' : d.bg);
  const accent   = d.accent || d.bg;
  const active   = qty > 0;
  const avail    = available ?? null; // null = ไม่แสดง badge
  const noStock  = avail === 0;

  return `
    <div id="v4c-${prefix}-${d.value}"
      onclick="${noStock ? '' : `v4Add('${prefix}',${d.value},1)`}"
      style="
        border-radius:14px;
        background:${active ? gradient : isCoin ? '#fafaf9' : 'var(--bg-surface)'};
        border:2px solid ${active ? accent : noStock ? '#e5e7eb' : '#e2e8f0'};
        padding:0;cursor:${noStock ? 'not-allowed' : 'pointer'};
        text-align:center;position:relative;overflow:hidden;
        transition:all .15s;user-select:none;
        opacity:${noStock ? '.4' : '1'};
        box-shadow:${active ? `0 4px 12px ${accent}40` : '0 1px 3px rgba(0,0,0,.06)'};
        min-height:90px;display:flex;flex-direction:column;">

      ${/* available badge top-left */avail !== null ? `
        <div style="position:absolute;top:5px;left:5px;
          font-size:9px;font-weight:800;
          color:${noStock ? '#9ca3af' : avail <= 2 ? '#dc2626' : active ? 'rgba(255,255,255,.8)' : '#64748b'};
          background:${noStock ? '#f1f5f9' : avail <= 2 ? '#fee2e2' : active ? 'rgba(0,0,0,.2)' : '#f1f5f9'};
          border-radius:5px;padding:1px 5px;line-height:1.5;">x${avail}</div>` : ''}

      ${/* qty badge top-right */`
        <div id="v4badge-${prefix}-${d.value}" style="
          position:absolute;top:5px;right:5px;
          width:22px;height:22px;border-radius:50%;
          background:${active ? 'rgba(255,255,255,.25)' : '#e2e8f0'};
          color:${active ? '#fff' : '#94a3b8'};
          font-size:11px;font-weight:800;
          display:flex;align-items:center;justify-content:center;
          border:1.5px solid ${active ? 'rgba(255,255,255,.4)' : '#cbd5e1'};">${qty}</div>`}

      ${/* face value */`
        <div style="
          font-size:${d.value >= 1000 ? '20px' : '22px'};font-weight:900;
          color:${active ? '#fff' : isCoin ? accent : '#334155'};
          margin:18px 4px 2px;font-family:var(--font-display,'Georgia'),serif;
          text-shadow:${active ? '0 1px 3px rgba(0,0,0,.3)' : 'none'};
          line-height:1;">฿${d.label}</div>`}

      ${/* subtotal */`
        <div id="v4sub-${prefix}-${d.value}" style="
          font-size:9px;font-weight:600;
          color:${active ? 'rgba(255,255,255,.75)' : '#94a3b8'};
          margin-bottom:6px;">
          ${active ? `฿${formatNum(qty * d.value)}` : isCoin ? 'เหรียญ' : 'ธนบัตร'}
        </div>`}

      ${/* controls */!noStock ? `
        <div style="
          display:flex;align-items:center;justify-content:space-between;
          padding:5px 7px 7px;gap:3px;margin-top:auto;">
          <button onclick="event.stopPropagation();v4Add('${prefix}',${d.value},-1)"
            style="width:26px;height:26px;border-radius:50%;
              border:1.5px solid ${active ? 'rgba(255,255,255,.4)' : '#e2e8f0'};
              background:${active ? 'rgba(255,255,255,.15)' : 'var(--bg-base)'};
              cursor:pointer;font-size:16px;
              color:${active ? '#fff' : '#ef4444'};
              display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;
              font-weight:700;">−</button>
          <span id="v4qty-${prefix}-${d.value}"
            style="font-size:15px;font-weight:800;min-width:20px;text-align:center;
              color:${active ? '#fff' : '#334155'};">${qty}</span>
          <button onclick="event.stopPropagation();v4Add('${prefix}',${d.value},1)"
            style="width:26px;height:26px;border-radius:50%;border:none;
              background:${active ? 'rgba(255,255,255,.25)' : accent};
              cursor:pointer;font-size:16px;color:#fff;
              display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;
              font-weight:700;">+</button>
        </div>` : ''}
    </div>`;
}

// ── Change card (มี available จากลิ้นชัก) ──────────────────────
function v5ChangeCard(d, isCoin, prefix, qty, available) {
  const state = window._v4States?.[prefix] || {};
  return v5DenomCard(d, isCoin, prefix, qty, available);
}

// ── Override v4Add ให้ใช้ v5DenomCard style ──────────────────────
const _v5OrigAdd = window.v4Add;
window.v4Add = function(prefix, value, delta) {
  const state = window._v4States?.[prefix];
  if (!state) return;
  state[value] = Math.max(0, (state[value] || 0) + delta);
  const qty = state[value];
  const d   = [...BILLS, ...COINS].find(x => x.value === value);
  if (!d) return;
  const active   = qty > 0;
  const isCoin   = COINS.some(x => x.value === value);
  const gradient = d.gradient || d.bg;
  const accent   = d.accent || d.bg;

  const card  = document.getElementById(`v4c-${prefix}-${value}`);
  const badge = document.getElementById(`v4badge-${prefix}-${value}`);
  const sub   = document.getElementById(`v4sub-${prefix}-${value}`);
  const qtyEl = document.getElementById(`v4qty-${prefix}-${value}`);

  if (card) {
    card.style.background  = active ? gradient : isCoin ? '#fafaf9' : 'var(--bg-surface)';
    card.style.borderColor = active ? accent : '#e2e8f0';
    card.style.boxShadow   = active ? `0 4px 12px ${accent}40` : '0 1px 3px rgba(0,0,0,.06)';
  }
  if (badge) {
    badge.textContent      = qty;
    badge.style.background = active ? 'rgba(255,255,255,.25)' : '#e2e8f0';
    badge.style.color      = active ? '#fff' : '#94a3b8';
    badge.style.borderColor= active ? 'rgba(255,255,255,.4)' : '#cbd5e1';
  }
  if (sub)   sub.textContent  = active ? `฿${formatNum(qty * value)}` : isCoin ? 'เหรียญ' : 'ธนบัตร';
  if (sub)   sub.style.color  = active ? 'rgba(255,255,255,.75)' : '#94a3b8';
  if (qtyEl) { qtyEl.textContent = qty; qtyEl.style.color = active ? '#fff' : '#334155'; }

  // update face value color
  const faceEl = card?.querySelector(`div[style*="font-weight:900"]`);
  if (faceEl)  faceEl.style.color = active ? '#fff' : isCoin ? accent : '#334155';

  // update minus/plus colors
  const btns = card?.querySelectorAll('button');
  if (btns?.length >= 2) {
    btns[0].style.background  = active ? 'rgba(255,255,255,.15)' : 'var(--bg-base)';
    btns[0].style.borderColor = active ? 'rgba(255,255,255,.4)' : '#e2e8f0';
    btns[0].style.color       = active ? '#fff' : '#ef4444';
    btns[1].style.background  = active ? 'rgba(255,255,255,.25)' : accent;
  }

  window._v4States[prefix + '_onChange']?.();
};

// ── v5 Grid helper — ใช้ v5DenomCard ─────────────────────────────
function v5Grid(state, prefix, availableMap) {
  const avMap = availableMap || null;
  return `
    <div style="font-size:10px;font-weight:700;color:var(--text-secondary);
      text-transform:uppercase;letter-spacing:.8px;
      display:flex;align-items:center;gap:5px;margin-bottom:8px;">
      <i class="material-icons-round" style="font-size:13px;color:var(--primary);">payments</i>ธนบัตร
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px;">
      ${BILLS.map(d => v5DenomCard(d, false, prefix, state[d.value]||0, avMap ? avMap[d.value]??null : null)).join('')}
    </div>
    <div style="font-size:10px;font-weight:700;color:var(--text-secondary);
      text-transform:uppercase;letter-spacing:.8px;
      display:flex;align-items:center;gap:5px;margin-bottom:8px;
      padding-top:10px;border-top:1px solid var(--border-light);">
      <i class="material-icons-round" style="font-size:13px;color:#B45309;">toll</i>เหรียญ
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
      ${COINS.map(d => v5DenomCard(d, true, prefix, state[d.value]||0, avMap ? avMap[d.value]??null : null)).join('')}
    </div>`;
}


// ══════════════════════════════════════════════════════════════════
// B. CHECKOUT UI — ขยาย modal + ใช้ v5Grid
// ══════════════════════════════════════════════════════════════════

// Override openBillCheckout เพื่อขยาย modal
const _v5OrigOpenBillCheckout = window.openBillCheckout;
window.openBillCheckout = function() {
  _v5OrigOpenBillCheckout?.apply(this, arguments);
  // ขยาย modal หลัง render
  setTimeout(() => {
    const modal = document.querySelector('#bill-co-overlay > div');
    if (modal) {
      modal.style.maxWidth = '1100px';
      modal.style.maxHeight = '95vh';
    }
    const body = document.querySelector('#bill-co-overlay > div > div[style*="grid"]');
    if (body) {
      body.style.gridTemplateColumns = '1fr 1.2fr';
    }
  }, 0);
};

// Override v4RenderCashDenomFull ให้ใช้ v5Grid
const _v5OrigRenderCashDenom = window.v4RenderCashDenomFull;
window.v4RenderCashDenomFull = async function() {
  const el = document.getElementById('bc-pay-detail');
  if (!el) return;

  const state = typeof v4EmptyDenoms === 'function' ? v4EmptyDenoms() : {};
  window._v4States = window._v4States || {};
  window._v4States['recv'] = state;

  el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-tertiary);">
    <div style="width:32px;height:32px;border:3px solid var(--border-light);border-top-color:var(--primary);border-radius:50%;animation:v5spin 1s linear infinite;margin:0 auto 8px;"></div>
    <style>@keyframes v5spin{to{transform:rotate(360deg)}}</style>
    โหลดข้อมูลลิ้นชัก...
  </div>`;

  let currentDenoms = {};
  try { currentDenoms = await v4GetCurrentDenoms() || v4EmptyDenoms(); } catch(e) {}
  window._v4DrawerDenoms = currentDenoms;

  if (typeof v4EmptyDenoms === 'function') {
    [...BILLS,...COINS].forEach(d => { state[d.value] = 0; });
  }

  checkoutState.received = 0; checkoutState.change = 0;
  checkoutState.receivedDenominations = state;
  window._v4States['recv_onChange'] = () => {
    if (typeof v4UpdateCashSummaryFull === 'function') v4UpdateCashSummaryFull(currentDenoms);
  };

  el.innerHTML = `
    <div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:10px 12px;
        background:var(--bg-base);border-radius:12px;border:1px solid var(--border-light);margin-bottom:14px;">
        <div style="text-align:center;">
          <div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">ต้องชำระ</div>
          <div style="font-size:20px;font-weight:800;color:var(--primary);font-family:var(--font-display);">฿${formatNum(checkoutState.total)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">รับมาแล้ว</div>
          <div id="v4-recv-total" style="font-size:20px;font-weight:800;color:var(--text-primary);font-family:var(--font-display);">฿0</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">เงินทอน</div>
          <div id="v4-change-total" style="font-size:20px;font-weight:800;color:var(--text-tertiary);font-family:var(--font-display);">—</div>
        </div>
      </div>

      <div style="font-size:10px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.7px;
        display:flex;align-items:center;gap:5px;margin-bottom:10px;">
        <i class="material-icons-round" style="font-size:14px;">south_east</i>รับจากลูกค้า
      </div>
      ${v5Grid(state, 'recv')}

      <div id="v4-change-section" style="display:none;margin-top:14px;">
        <div style="height:1px;background:linear-gradient(90deg,transparent,var(--border-light),transparent);margin-bottom:14px;"></div>
        <div style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.7px;
          display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="display:flex;align-items:center;gap:5px;">
            <i class="material-icons-round" style="font-size:14px;">north_west</i>ทอนให้ลูกค้า
          </span>
          <span style="font-size:9px;font-weight:400;color:var(--text-tertiary);">xN = จำนวนในลิ้นชัก</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px;
          background:#f0fdf4;border-radius:10px;border:1.5px solid #86efac;margin-bottom:10px;">
          <div style="text-align:center;">
            <div style="font-size:9px;color:#15803d;font-weight:600;margin-bottom:2px;">ต้องทอน</div>
            <div id="v4-must-change" style="font-size:18px;font-weight:800;color:#15803d;">฿0</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:9px;color:#15803d;font-weight:600;margin-bottom:2px;">ทอนแล้ว</div>
            <div id="v4-gave-change" style="font-size:18px;font-weight:800;color:#9a3412;">฿0</div>
          </div>
        </div>
        <div id="v4-change-bill-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:8px;"></div>
        <div id="v4-change-coin-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;"></div>
        <div id="v4-change-warn" style="display:none;padding:8px 12px;background:#fee2e2;border-radius:10px;border:1.5px solid #fca5a5;font-size:12px;color:#dc2626;margin-top:8px;font-weight:600;"></div>
      </div>
    </div>`;
};


// ══════════════════════════════════════════════════════════════════
// C. ATTENDANCE — redesign ทุก tab
// ══════════════════════════════════════════════════════════════════

window.renderAttendance = async function() {
  const section = document.getElementById('page-att');
  if (!section) return;
  section.innerHTML = `
    <div style="padding-bottom:32px;">
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border-light);margin-bottom:0;overflow-x:auto;">
        ${[
          {id:'checkin', icon:'how_to_reg',  label:'เช็คชื่อ'},
          {id:'advance', icon:'payments',    label:'เบิกเงิน'},
          {id:'payroll', icon:'account_balance_wallet', label:'จ่ายเงินเดือน'},
          {id:'emps',    icon:'badge',       label:'ข้อมูลพนักงาน'},
        ].map((t,i) => `
          <button class="att-tab ${i===0?'active':''}" data-att="${t.id}" onclick="switchAttTab('${t.id}')"
            style="display:inline-flex;align-items:center;gap:6px;padding:13px 20px;border:none;border-bottom:3px solid ${i===0?'var(--primary)':'transparent'};margin-bottom:-2px;background:none;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif;font-size:13px;font-weight:${i===0?'700':'500'};color:${i===0?'var(--primary)':'var(--text-secondary)'};transition:all .15s;white-space:nowrap;">
            <i class="material-icons-round" style="font-size:18px;">${t.icon}</i>${t.label}
          </button>`).join('')}
      </div>
      <div id="att-tab-checkin" style="padding-top:20px;display:block;"></div>
      <div id="att-tab-advance" style="padding-top:20px;display:none;"></div>
      <div id="att-tab-payroll" style="padding-top:20px;display:none;"></div>
      <div id="att-tab-emps"    style="padding-top:20px;display:none;"></div>
    </div>`;
  await v5LoadCheckin();
};

window.switchAttTab = function(tab) {
  document.querySelectorAll('.att-tab').forEach(t => {
    const active = t.dataset.att === tab;
    t.classList.toggle('active', active);
    t.style.color       = active ? 'var(--primary)' : 'var(--text-secondary)';
    t.style.fontWeight  = active ? '700' : '500';
    t.style.borderBottomColor = active ? 'var(--primary)' : 'transparent';
  });
  ['checkin','advance','payroll','emps'].forEach(id => {
    const el = document.getElementById(`att-tab-${id}`);
    if (el) el.style.display = id === tab ? 'block' : 'none';
  });
  if (tab === 'checkin')  v5LoadCheckin();
  if (tab === 'advance')  v5LoadAdvance();
  if (tab === 'payroll')  v5LoadPayroll();
  if (tab === 'emps')     v5LoadEmps();
};

// ── C1. เช็คชื่อ ─────────────────────────────────────────────────
async function v5LoadCheckin() {
  const sec = document.getElementById('att-tab-checkin');
  if (!sec) return;
  sec.innerHTML = v5Loading('โหลดข้อมูลพนักงาน...');

  const today = new Date().toISOString().split('T')[0];
  const [emps, { data: attToday }] = await Promise.all([
    loadEmployees(),
    db.from('เช็คชื่อ').select('*').eq('date', today)
  ]);
  const actives = (emps || []).filter(e => e.status === 'ทำงาน');
  const attMap  = {};
  (attToday || []).forEach(a => { attMap[a.employee_id] = a; });

  const STATUS = {
    'มาทำงาน': { color:'#10B981', bg:'#d1fae5', label:'มาทำงาน' },
    'มาสาย':   { color:'#F59E0B', bg:'#fef3c7', label:'มาสาย' },
    'ลากิจ':   { color:'#6366F1', bg:'#e0e7ff', label:'ลากิจ' },
    'ลาป่วย':  { color:'#3B82F6', bg:'#dbeafe', label:'ลาป่วย' },
    'ขาดงาน':  { color:'#EF4444', bg:'#fee2e2', label:'ขาดงาน' },
  };

  const checkedIn = Object.values(attMap).filter(a => ['มาทำงาน','มาสาย'].includes(a.status)).length;
  const notYet    = actives.filter(e => !attMap[e.id]).length;

  sec.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <div>
        <h3 style="font-size:16px;font-weight:700;margin-bottom:6px;">${new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span style="padding:4px 12px;border-radius:999px;background:#d1fae5;color:#065f46;font-size:12px;font-weight:600;">✅ ${checkedIn} มาทำงาน</span>
          <span style="padding:4px 12px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:12px;font-weight:600;">⏳ ${notYet} ยังไม่ลง</span>
          <span style="padding:4px 12px;border-radius:999px;background:var(--bg-base);color:var(--text-secondary);font-size:12px;">${actives.length} คนทั้งหมด</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
      ${actives.map(emp => {
        const att    = attMap[emp.id];
        const st     = att ? STATUS[att.status] : null;
        const stLabel= att ? att.status : 'ยังไม่ลง';
        return `
          <div style="background:var(--bg-surface);border:1.5px solid ${st ? st.color+'30' : 'var(--border-light)'};border-radius:16px;padding:16px;transition:all .15s;box-shadow:0 1px 4px rgba(0,0,0,.04);">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
              <div>
                <div style="font-size:15px;font-weight:700;">${emp.name} ${emp.lastname||''}</div>
                <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">${emp.position||''} • ฿${formatNum(emp.daily_wage||0)}/วัน</div>
              </div>
              <span style="padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;flex-shrink:0;
                color:${st ? st.color : '#94a3b8'};background:${st ? st.bg : '#f1f5f9'};">${stLabel}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:12px;">
              <div style="background:var(--bg-base);border-radius:8px;padding:6px 10px;">
                <div style="color:var(--text-tertiary);margin-bottom:1px;">เข้างาน</div>
                <div style="font-weight:700;">${att?.time_in || '—'}</div>
              </div>
              <div style="background:var(--bg-base);border-radius:8px;padding:6px 10px;">
                <div style="color:var(--text-tertiary);margin-bottom:1px;">ออกงาน</div>
                <div style="font-weight:700;">${att?.time_out || '—'}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${!att
                ? `<button class="btn btn-primary btn-sm" style="flex:1;" onclick="showCheckInModal?.('${emp.id}','${emp.name}');setTimeout(v5LoadCheckin,800)">
                     <i class="material-icons-round" style="font-size:14px;">login</i> ลงชื่อเข้า
                   </button>`
                : `${!att.time_out
                    ? `<button class="btn btn-outline btn-sm" onclick="checkOutEmp?.('${att.id}');setTimeout(v5LoadCheckin,800)">
                         <i class="material-icons-round" style="font-size:14px;">logout</i> ออกงาน
                       </button>` : ''}
                   <button class="btn btn-ghost btn-sm" onclick="showEditAttModal?.('${att.id}','${emp.id}','${emp.name}');setTimeout(v5LoadCheckin,1000)">
                     <i class="material-icons-round" style="font-size:14px;">edit</i>
                   </button>`}
              <button class="btn btn-ghost btn-sm" style="color:var(--warning);" title="เบิกเงิน"
                onclick="openAdvanceWizard?.('${emp.id}','${emp.name}');setTimeout(v5LoadAdvance,1000)">
                <i class="material-icons-round" style="font-size:14px;">account_balance_wallet</i>
              </button>
            </div>
          </div>`;
      }).join('')}
    </div>
    ${actives.length===0 ? '<div style="text-align:center;padding:60px;color:var(--text-tertiary);">ยังไม่มีพนักงานที่ทำงานอยู่</div>' : ''}`;
}

// ── C2. เบิกเงิน ─────────────────────────────────────────────────
async function v5LoadAdvance() {
  const sec = document.getElementById('att-tab-advance');
  if (!sec) return;
  sec.innerHTML = v5Loading('โหลดรายการเบิกเงิน...');

  const today = new Date().toISOString().split('T')[0];
  const [emps, { data: advances }] = await Promise.all([
    loadEmployees(),
    db.from('เบิกเงิน').select('*, พนักงาน(name,lastname)').order('date',{ascending:false}).limit(60).catch(()=>({data:[]}))
  ]);
  const empMap = {};
  (emps||[]).forEach(e => { empMap[e.id] = e; });
  const totalToday = (advances||[]).filter(a => (a.date||'').startsWith(today) && a.status==='อนุมัติ').reduce((s,a)=>s+a.amount,0);

  sec.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <div>
        <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">การเบิกเงินพนักงาน</h3>
        <div style="font-size:13px;color:var(--text-secondary);">เบิกวันนี้รวม: <strong style="color:var(--warning);">฿${formatNum(totalToday)}</strong></div>
      </div>
      <button class="btn btn-primary" onclick="v5NewAdvance()"><i class="material-icons-round">add</i> เบิกเงินใหม่</button>
    </div>
    ${(advances||[]).length === 0
      ? `<div style="text-align:center;padding:60px;color:var(--text-tertiary);"><i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;opacity:.3;">payments</i>ยังไม่มีรายการเบิกเงิน</div>`
      : `<div style="display:flex;flex-direction:column;gap:8px;">
          ${(advances||[]).map(a => {
            const emp = a['พนักงาน'] || empMap[a.employee_id] || {};
            const name = emp.name ? `${emp.name} ${emp.lastname||''}`.trim() : a.employee_id;
            return `
              <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px;">
                <div style="width:44px;height:44px;border-radius:50%;background:${a.status==='อนุมัติ'?'#fef3c7':'#f1f5f9'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  <i class="material-icons-round" style="color:${a.status==='อนุมัติ'?'var(--warning)':'#94a3b8'};">payments</i>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:14px;font-weight:700;">${name}</div>
                  <div style="font-size:12px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.reason||'—'} • ${a.method||'เงินสด'}</div>
                  <div style="font-size:11px;color:var(--text-tertiary);margin-top:1px;">${a.date ? formatDateTime(a.date) : ''}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:16px;font-weight:800;color:var(--warning);">฿${formatNum(a.amount)}</div>
                  <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;
                    background:${a.status==='อนุมัติ'?'#d1fae5':'#fef3c7'};
                    color:${a.status==='อนุมัติ'?'#065f46':'#92400e'};">${a.status||'รออนุมัติ'}</span>
                </div>
              </div>`;
          }).join('')}
        </div>`}`;
}

window.v5NewAdvance = function() {
  let empsCache = [];
  openModal('เบิกเงินพนักงาน', `
    <form id="adv-form" onsubmit="event.preventDefault();">
      <div class="form-group"><label class="form-label">พนักงาน *</label>
        <select class="form-input" id="adv-emp-sel"><option value="">-- เลือกพนักงาน --</option></select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">จำนวน (บาท) *</label><input class="form-input" type="number" id="adv-amount" min="1" placeholder="0"></div>
        <div class="form-group"><label class="form-label">วิธีจ่าย</label>
          <select class="form-input" id="adv-method"><option>เงินสด</option><option>โอนเงิน</option></select></div>
      </div>
      <div class="form-group"><label class="form-label">เหตุผล</label><input class="form-input" id="adv-reason" placeholder="ระบุเหตุผล"></div>
      <button type="button" class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="v5SubmitAdvance()">
        <i class="material-icons-round">payments</i> อนุมัติเบิกเงิน
      </button>
    </form>`);
  loadEmployees().then(emps => {
    empsCache = emps || [];
    const sel = document.getElementById('adv-emp-sel');
    if (!sel) return;
    emps.filter(e => e.status==='ทำงาน').forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id; opt.textContent = `${e.name} ${e.lastname||''}`;
      sel.appendChild(opt);
    });
  });
};

window.v5SubmitAdvance = async function() {
  const empId  = document.getElementById('adv-emp-sel')?.value;
  const amount = Number(document.getElementById('adv-amount')?.value||0);
  const method = document.getElementById('adv-method')?.value||'เงินสด';
  const reason = document.getElementById('adv-reason')?.value||'';
  if (!empId)    { toast('กรุณาเลือกพนักงาน','error'); return; }
  if (amount<=0) { toast('กรุณาระบุจำนวน','error'); return; }
  v5SetLoading(true, 'adv-form', 'กำลังบันทึก...');
  try {
    await (window._doAdvance?.(empId, amount, method, reason, null)
      || db.from('เบิกเงิน').insert({ employee_id:empId, amount, method, reason, approved_by:USER?.username, status:'อนุมัติ' }));
    closeModal(); toast('บันทึกการเบิกเงินสำเร็จ','success'); v5LoadAdvance();
  } catch(e) { toast('เกิดข้อผิดพลาด','error'); v5SetLoading(false); }
};

// ── C3. จ่ายเงินเดือน ──────────────────────────────────────────
async function v5LoadPayroll() {
  const sec = document.getElementById('att-tab-payroll');
  if (!sec) return;
  sec.innerHTML = v5Loading('คำนวณเงินเดือน...');

  const now      = new Date();
  const year     = now.getFullYear();
  const month    = now.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2,'0')}`;
  const startDate = `${monthStr}-01`;
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

  const [emps, { data: attAll }, { data: advAll }, { data: paidAll }] = await Promise.all([
    loadEmployees(),
    db.from('เช็คชื่อ').select('employee_id,status,date').gte('date',startDate).lte('date',endDate),
    db.from('เบิกเงิน').select('employee_id,amount,status').gte('date',startDate+'T00:00:00').eq('status','อนุมัติ').catch(()=>({data:[]})),
    db.from('จ่ายเงินเดือน').select('employee_id,net_paid,paid_date').gte('paid_date',startDate+'T00:00:00').catch(()=>({data:[]}))
  ]);

  const actives = (emps||[]).filter(e => e.status==='ทำงาน');
  const paidMap = {};
  (paidAll||[]).forEach(p => { paidMap[p.employee_id] = p; });

  const rows = actives.map(emp => {
    const empAtt    = (attAll||[]).filter(a => a.employee_id===emp.id);
    const empAdv    = (advAll||[]).filter(a => a.employee_id===emp.id).reduce((s,a)=>s+a.amount,0);
    const daysWork  = empAtt.filter(a => a.status==='มาทำงาน').length;
    const daysLate  = empAtt.filter(a => a.status==='มาสาย').length;
    const daysAbsent= empAtt.filter(a => ['ขาดงาน','ลากิจ'].includes(a.status)).length;
    const wage      = emp.daily_wage || 0;
    const gross     = daysWork * wage + daysLate * wage * 0.75;
    const net       = Math.max(0, gross - empAdv);
    const isPaid    = !!paidMap[emp.id];
    return { emp, daysWork, daysLate, daysAbsent, gross, empAdv, net, isPaid };
  });

  const totalNet = rows.reduce((s,r)=>s+r.net, 0);

  sec.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <div>
        <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">จ่ายเงินเดือน — ${new Date(year, month-1, 1).toLocaleDateString('th-TH',{year:'numeric',month:'long'})}</h3>
        <div style="font-size:13px;color:var(--text-secondary);">ยอดรวมทั้งหมด: <strong style="color:var(--success);font-size:16px;">฿${formatNum(Math.round(totalNet))}</strong></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${rows.map(r => `
        <div style="background:var(--bg-surface);border:1.5px solid ${r.isPaid?'#86efac':'var(--border-light)'};border-radius:16px;padding:18px;
          ${r.isPaid?'opacity:.7;':''} transition:all .15s;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
            <div>
              <div style="font-size:15px;font-weight:700;">${r.emp.name} ${r.emp.lastname||''}</div>
              <div style="font-size:12px;color:var(--text-tertiary);">${r.emp.position||''} • ฿${formatNum(r.emp.daily_wage||0)}/วัน</div>
            </div>
            ${r.isPaid
              ? `<span style="padding:4px 12px;border-radius:999px;background:#d1fae5;color:#065f46;font-size:12px;font-weight:700;">✅ จ่ายแล้ว</span>`
              : `<button class="btn btn-primary btn-sm" onclick="v5PayEmployee('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim()}',${Math.round(r.net)},'${monthStr}')">
                   <i class="material-icons-round" style="font-size:14px;">send</i> จ่ายเงิน
                 </button>`}
          </div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;text-align:center;">
            ${[
              ['วันทำงาน', r.daysWork, '#10B981'],
              ['มาสาย',    r.daysLate, '#F59E0B'],
              ['ขาด',      r.daysAbsent, '#EF4444'],
              ['ยอดเบิก',  `฿${formatNum(r.empAdv)}`, '#F59E0B'],
              ['สุทธิ',    `฿${formatNum(Math.round(r.net))}`, '#10B981'],
            ].map(([l,v,c]) => `
              <div style="background:var(--bg-base);border-radius:10px;padding:8px 4px;">
                <div style="font-size:9px;color:var(--text-tertiary);margin-bottom:3px;">${l}</div>
                <div style="font-size:14px;font-weight:800;color:${c};">${v}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
      ${rows.length===0?`<div style="text-align:center;padding:60px;color:var(--text-tertiary);">ไม่มีพนักงาน</div>`:''}
    </div>`;
}

window.v5PayEmployee = async function(empId, empName, amount, monthStr) {
  const { isConfirmed } = await Swal.fire({
    title: `จ่ายเงินเดือน: ${empName}`,
    html: `<div style="font-size:30px;font-weight:900;color:var(--success);margin:8px 0;">฿${formatNum(amount)}</div>
           <p style="color:var(--text-secondary);font-size:13px;">บันทึกการจ่ายเงินเดือนนี้?</p>`,
    icon: 'question', showCancelButton: true,
    confirmButtonText: '✅ ยืนยันจ่าย', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#10B981'
  });
  if (!isConfirmed) return;
  // schema: employee_id, month(date), net_paid, paid_date, staff_name
  await db.from('จ่ายเงินเดือน').insert({
    employee_id: empId,
    month: monthStr + '-01',  // date field
    net_paid: amount,
    paid_date: new Date().toISOString(),
    staff_name: USER?.username,
    note: `จ่ายเงินเดือน ${monthStr}`
  });
  toast(`จ่ายเงินเดือน ${empName} ฿${formatNum(amount)} สำเร็จ`,'success');
  logActivity('จ่ายเงินเดือน',`${empName} ฿${formatNum(amount)}`);
  v5LoadPayroll();
};

// ── C4. ข้อมูลพนักงาน — card layout พร้อมสรุปสถิติ ─────────────
async function v5LoadEmps() {
  const sec = document.getElementById('att-tab-emps');
  if (!sec) return;
  sec.innerHTML = v5Loading('โหลดข้อมูลพนักงาน...');

  const now       = new Date();
  const monthStr  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const startDate = `${monthStr}-01`;

  const [emps, { data: attAll }, { data: advAll }, { data: paidAll }] = await Promise.all([
    loadEmployees(),
    db.from('เช็คชื่อ').select('employee_id,status').gte('date','2020-01-01'),
    db.from('เบิกเงิน').select('employee_id,amount').eq('status','อนุมัติ').catch(()=>({data:[]})),
    db.from('จ่ายเงินเดือน').select('employee_id,net_paid,paid_date').order('paid_date',{ascending:false}).catch(()=>({data:[]}))
  ]);

  sec.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
      <h3 style="font-size:16px;font-weight:700;">ข้อมูลพนักงานทั้งหมด (${(emps||[]).length} คน)</h3>
      <button class="btn btn-primary" onclick="showEmployeeModal?.();setTimeout(v5LoadEmps,1500)">
        <i class="material-icons-round">person_add</i> เพิ่มพนักงาน
      </button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${(emps||[]).map(emp => {
        const empAtt  = (attAll||[]).filter(a => a.employee_id===emp.id);
        const totalDays   = empAtt.filter(a => a.status==='มาทำงาน').length;
        const lateDays    = empAtt.filter(a => a.status==='มาสาย').length;
        const absentDays  = empAtt.filter(a => ['ขาดงาน','ลากิจ'].includes(a.status)).length;
        const totalAdv    = (advAll||[]).filter(a => a.employee_id===emp.id).reduce((s,a)=>s+a.amount,0);
        const advCount    = (advAll||[]).filter(a => a.employee_id===emp.id).length;
        const lastPay     = (paidAll||[]).find(p => p.employee_id===emp.id);

        return `
          <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:18px;overflow:hidden;
            transition:box-shadow .15s;box-shadow:0 1px 4px rgba(0,0,0,.04);">
            <!-- Header -->
            <div style="padding:16px 18px;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 70%,#000));display:flex;align-items:center;gap:12px;">
              <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;flex-shrink:0;">${emp.name.charAt(0)}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:15px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${emp.name} ${emp.lastname||''}</div>
                <div style="font-size:12px;color:rgba(255,255,255,.75);">${emp.position||'พนักงาน'} • ${emp.phone||'ไม่มีเบอร์'}</div>
              </div>
              <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;flex-shrink:0;
                background:${emp.status==='ทำงาน'?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'};
                color:${emp.status==='ทำงาน'?'#a7f3d0':'#fca5a5'};">${emp.status||'ทำงาน'}</span>
            </div>
            <!-- Stats -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--border-light);">
              ${[
                ['มาทำงาน', totalDays, '#10B981'],
                ['มาสาย',   lateDays,  '#F59E0B'],
                ['ขาดงาน',  absentDays,'#EF4444'],
                ['เบิกเงิน',advCount,  '#6366F1'],
              ].map(([l,v,c],i) => `
                <div style="padding:12px 8px;text-align:center;${i<3?'border-right:1px solid var(--border-light);':''}">
                  <div style="font-size:18px;font-weight:800;color:${c};">${v}</div>
                  <div style="font-size:10px;color:var(--text-tertiary);margin-top:1px;">${l}</div>
                </div>`).join('')}
            </div>
            <!-- Footer -->
            <div style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <div>
                <div style="font-size:10px;color:var(--text-tertiary);">จ่ายเดือนล่าสุด</div>
                <div style="font-size:13px;font-weight:700;color:var(--success);">${lastPay ? `฿${formatNum(lastPay.net_paid)}` : '—'}</div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-ghost btn-sm" onclick="editEmployee?.('${emp.id}');setTimeout(v5LoadEmps,1200)">
                  <i class="material-icons-round" style="font-size:14px;">edit</i>
                </button>
                <button class="btn btn-outline btn-sm" style="color:var(--warning);" onclick="openAdvanceWizard?.('${emp.id}','${emp.name}');setTimeout(v5LoadAdvance,1000)">
                  <i class="material-icons-round" style="font-size:14px;">account_balance_wallet</i> เบิกเงิน
                </button>
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>
    ${(emps||[]).length===0?'<div style="text-align:center;padding:60px;color:var(--text-tertiary);">ยังไม่มีพนักงาน</div>':''}`;
}


// ══════════════════════════════════════════════════════════════════
// D. HISTORY — ปุ่มพิมพ์ใบเสร็จในแต่ละบิล
// ══════════════════════════════════════════════════════════════════

window.renderHistory = async function() {
  const section = document.getElementById('page-history');
  if (!section) return;
  const today = new Date().toISOString().split('T')[0];
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <div class="search-box"><i class="material-icons-round">search</i>
          <input type="text" id="history-search" placeholder="ค้นหาบิล, ลูกค้า..."></div>
        <div class="toolbar-actions">
          <input type="date" class="form-input" id="history-date" value="${today}" style="width:160px;" onchange="v5LoadHistoryData()">
          <button class="btn btn-outline" onclick="exportHistory()"><i class="material-icons-round">download</i> Export</button>
        </div>
      </div>
      <div id="history-stats" class="inv-stats"></div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>บิล #</th><th>วันเวลา</th><th>ลูกค้า</th>
              <th>วิธีชำระ</th><th class="text-right">ยอดรวม</th>
              <th>พนักงาน</th><th>สถานะ</th><th>จัดการ</th>
            </tr>
          </thead>
          <tbody id="history-tbody"></tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('history-search').addEventListener('input', v5LoadHistoryData);
  await v5LoadHistoryData();
};

window.v5LoadHistoryData = async function() {
  const date   = document.getElementById('history-date')?.value || new Date().toISOString().split('T')[0];
  const search = document.getElementById('history-search')?.value?.toLowerCase() || '';
  const { data: bills } = await db.from('บิลขาย').select('*')
    .gte('date', date+'T00:00:00').lte('date', date+'T23:59:59')
    .order('date',{ascending:false});
  let filtered = (bills||[]).filter(b =>
    !search || b.bill_no?.toString().includes(search)
             || b.customer_name?.toLowerCase().includes(search)
             || b.staff_name?.toLowerCase().includes(search));

  const totalSales = filtered.filter(b=>b.status==='สำเร็จ').reduce((s,b)=>s+b.total,0);
  const statsEl = document.getElementById('history-stats');
  if (statsEl) statsEl.innerHTML = `
    <div class="inv-stat"><span class="inv-stat-value">${filtered.length}</span><span class="inv-stat-label">บิลทั้งหมด</span></div>
    <div class="inv-stat success"><span class="inv-stat-value">฿${formatNum(totalSales)}</span><span class="inv-stat-label">ยอดขายรวม</span></div>
    <div class="inv-stat warning"><span class="inv-stat-value">${filtered.filter(b=>b.method==='เงินสด').length}</span><span class="inv-stat-label">เงินสด</span></div>
    <div class="inv-stat"><span class="inv-stat-value">${filtered.filter(b=>b.method==='โอนเงิน').length}</span><span class="inv-stat-label">โอนเงิน</span></div>`;

  const tbody = document.getElementById('history-tbody');
  if (tbody) tbody.innerHTML = filtered.map(b => `
    <tr>
      <td><strong>#${b.bill_no}</strong></td>
      <td style="white-space:nowrap;font-size:12px;">${formatDateTime(b.date)}</td>
      <td>${b.customer_name||'ทั่วไป'}</td>
      <td><span class="badge ${b.method==='เงินสด'?'badge-success':'badge-info'}">${b.method}</span></td>
      <td class="text-right"><strong>฿${formatNum(b.total)}</strong></td>
      <td style="font-size:12px;">${b.staff_name||'-'}</td>
      <td><span class="badge ${b.status==='สำเร็จ'?'badge-success':b.status==='ค้างชำระ'?'badge-warning':'badge-danger'}">${b.status}</span></td>
      <td>
        <div style="display:flex;gap:4px;align-items:center;">
          <button class="btn btn-ghost btn-icon" onclick="viewBillDetail('${b.id}')" title="ดูรายละเอียด">
            <i class="material-icons-round">receipt</i>
          </button>
          <button class="btn btn-ghost btn-icon" style="color:var(--primary);" onclick="v5PrintFromHistory('${b.id}')" title="พิมพ์ใบเสร็จ">
            <i class="material-icons-round">print</i>
          </button>
          ${b.status==='สำเร็จ'
            ? `<button class="btn btn-ghost btn-icon" style="color:var(--danger);" onclick="cancelBill('${b.id}')" title="ยกเลิก">
                 <i class="material-icons-round">cancel</i>
               </button>` : ''}
        </div>
      </td>
    </tr>`).join('');
};

window.v5PrintFromHistory = async function(billId) {
  const { data: bill  } = await db.from('บิลขาย').select('*').eq('id',billId).single();
  const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id',billId);
  if (!bill) { toast('ไม่พบข้อมูลบิล','error'); return; }

  const { isDenied, isConfirmed } = await Swal.fire({
    title: `พิมพ์ใบเสร็จ #${bill.bill_no}`,
    html: `<div style="display:flex;gap:12px;justify-content:center;padding:8px 0;">
      <button style="flex:1;padding:16px 10px;border:2px solid #DC2626;border-radius:12px;background:#fff;cursor:pointer;font-size:14px;color:#DC2626;font-weight:700;" onclick="Swal.clickConfirm()">
        <div style="font-size:28px;margin-bottom:6px;">🧾</div>80 mm<br><span style="font-size:11px;opacity:.7;">เครื่องพิมพ์</span>
      </button>
      <button style="flex:1;padding:16px 10px;border:2px solid #2563EB;border-radius:12px;background:#fff;cursor:pointer;font-size:14px;color:#2563EB;font-weight:700;" onclick="Swal.clickDeny()">
        <div style="font-size:28px;margin-bottom:6px;">📄</div>A4<br><span style="font-size:11px;opacity:.7;">ใบเสร็จเต็ม</span>
      </button>
    </div>`,
    showConfirmButton: false, showDenyButton: false, showCancelButton: true,
    cancelButtonText: 'ยกเลิก',
    didOpen: () => {
      const btns = document.querySelector('.swal2-html-container').querySelectorAll('button');
      btns.forEach(b => b.addEventListener('click', () => {}));
    }
  });

  // Swal button approach — intercept by re-opening with custom
  const { value: fmt } = await Swal.fire({
    title: `พิมพ์ใบเสร็จ #${bill.bill_no}`,
    input: 'radio',
    inputOptions: { '80mm': '🧾 80mm — เครื่องพิมพ์ใบเสร็จ', 'A4': '📄 A4 — ใบเสร็จเต็ม' },
    inputValue: '80mm',
    showCancelButton: true,
    confirmButtonText: 'พิมพ์',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#DC2626'
  });
  if (!fmt) return;
  printReceipt(bill, items||[], fmt);
};


// ══════════════════════════════════════════════════════════════════
// E. RECEIPT SETTINGS — ซ่อน show_cost ใน 80mm default + config
// ══════════════════════════════════════════════════════════════════
// print80mmv2 และ printReceiptA4v2 ใช้ rc.show_cost จาก getShopConfig
// ตั้งค่า default ไม่แสดงต้นทุน — ผู้ใช้เปิดเองได้ใน admin

// Patch getShopConfig default
const _v5OrigGetShopConfig = window.getShopConfig;
window.getShopConfig = async function() {
  const rc = await _v5OrigGetShopConfig?.apply(this, arguments);
  if (rc && rc.show_cost === undefined) rc.show_cost = false; // default: ซ่อนต้นทุน
  return rc;
};


// ══════════════════════════════════════════════════════════════════
// F. LOADING STATES — spinner เมื่อกด save
// ══════════════════════════════════════════════════════════════════

function v5Loading(msg = 'กำลังโหลด...') {
  return `<div style="text-align:center;padding:48px;color:var(--text-tertiary);">
    <div style="width:36px;height:36px;border:3px solid var(--border-light);border-top-color:var(--primary);
      border-radius:50%;animation:v5spin 1s linear infinite;margin:0 auto 12px;"></div>
    <style>@keyframes v5spin{to{transform:rotate(360deg)}}</style>
    <div style="font-size:13px;">${msg}</div>
  </div>`;
}

function v5SetLoading(on, formId, msg = 'กำลังบันทึก...') {
  const form = document.getElementById(formId);
  if (!form) return;
  const btn = form.querySelector('.btn-primary');
  if (!btn) return;
  if (on) {
    btn.dataset.origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span style="width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:v5spin 1s linear infinite;margin-right:6px;vertical-align:middle;"></span>${msg}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.origText || btn.innerHTML;
  }
}

// Patch completePayment — แสดง loading state ใน bc-ok-btn
const _v5OrigCompletePayment = window.v4CompletePayment || window.completePayment;
window.v4CompletePayment = async function() {
  const btn = document.getElementById('bc-ok-btn');
  if (btn) {
    btn.dataset.origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span style="width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:v5spin 1s linear infinite;margin-right:8px;vertical-align:middle;"></span>กำลังบันทึก...`;
  }
  try {
    await _v5OrigCompletePayment?.apply(this, arguments);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.origText || ''; }
  }
};

console.info('%c[modules-v5.js] ✅%c A.สีแบงค์ | B.Checkout UI | C.Attendance | D.History Print | E.Receipt | F.Loading',
  'color:#8b5cf6;font-weight:700','color:#6B7280');
/**
 * SK POS — modules-v6.js  (โหลดหลัง modules-v5.js)
 *
 * ██████████████████████████████████████████████████████████████████
 *  แก้ไขทั้งหมดที่รายงาน:
 *
 *  FIX-1  ใบเสร็จ A4 — ซ่อนต้นทุนตามค่า rc.show_cost จริงๆ
 *  FIX-2  รับสินค้าเข้า — เพิ่มรายการแล้วไม่เด้งออก
 *  FIX-3  หน้าพนักงาน — Supabase .catch chain TypeError
 *  FIX-4  พิมพ์บาร์โค้ด — ถามจำนวน + layout สวย + เลือก format
 *  FIX-5  หน้า POS — ลบปุ่มเลือก format ออก ย้ายไปสเต็ป 4
 *  FIX-6  หน้าขาย (bcConfirm) — ถามพิมพ์หลังขาย + เลือก format
 * ██████████████████████████████████████████████████████████████████
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// FIX-1  ใบเสร็จ A4 — ซ่อน/แสดงต้นทุนตาม rc.show_cost
// ══════════════════════════════════════════════════════════════════
// แก้ printReceiptA4v2 โดยตรง — ถ้า show_cost === false ซ่อน column

window.printReceiptA4v2 = function(bill, items, rc) {
  const showCost = rc?.show_cost === true;   // default = false (ซ่อน)
  const showDisc = rc?.show_discount !== false;
  const showRecv = rc?.show_received !== false;
  const showChng = rc?.show_change   !== false;
  const showStaff= rc?.show_staff    !== false;
  const showCust = rc?.show_customer !== false;
  const showBillNo= rc?.show_billno  !== false;
  const showDate = rc?.show_datetime !== false;

  const subtotal = (items||[]).reduce((s,i)=>s+i.total, 0);
  const cost     = (items||[]).reduce((s,i)=>s+(i.cost||0)*i.qty, 0);
  const gp       = subtotal - cost;

  // สร้าง rows — ซ่อน column ต้นทุนถ้า show_cost = false
  const rows = (items||[]).map((i,n) => `
    <tr>
      <td class="num">${n+1}</td>
      <td class="desc"><strong>${i.name}</strong></td>
      <td class="center">${i.qty} ${i.unit||'ชิ้น'}</td>
      <td class="right">฿${formatNum(i.price)}</td>
      ${showCost ? `<td class="right cost">฿${formatNum(i.cost||0)}</td>` : ''}
      <td class="right total">฿${formatNum(i.total)}</td>
    </tr>`).join('');

  const win = window.open('','_blank','width=960,height=800');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:15mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Sarabun',sans-serif;font-size:13px;color:#111;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:14px;border-bottom:3px solid #DC2626}
.shop-name{font-size:26px;font-weight:800;color:#DC2626;line-height:1;margin-bottom:5px}
.shop-info{font-size:11.5px;color:#555;line-height:1.7}
.receipt-badge{background:#DC2626;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:1px;margin-bottom:8px;display:inline-block}
.bill-no{font-size:22px;font-weight:800;color:#DC2626}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;background:#fafafa;border-radius:8px;padding:10px 14px;border:1px solid #f0f0f0}
.meta-item span{font-size:10px;color:#999;display:block;margin-bottom:1px}
.meta-item strong{font-size:13px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead th{background:#DC2626;color:#fff;padding:8px 10px;text-align:left;font-size:11.5px}
thead th.right{text-align:right}thead th.center{text-align:center}
tbody tr:nth-child(even){background:#fff8f8}
td{padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:12.5px}
td.num{width:30px;color:#bbb;text-align:center}td.desc{font-weight:500}
td.center{text-align:center;color:#555}td.right{text-align:right}
td.cost{color:#aaa}td.total{font-weight:600}
.summary{margin-left:auto;width:260px}
.sum-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f5;font-size:12.5px}
.sum-row.gp span:last-child{color:#059669;font-weight:600}
.grand-row{display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:#DC2626;border-top:2.5px solid #DC2626;border-bottom:2.5px solid #DC2626;padding:8px 0;margin-top:4px}
.method-chip{display:inline-block;background:#DC2626;color:#fff;font-size:11px;padding:3px 8px;border-radius:3px;margin-bottom:6px}
.qr-wrap{text-align:center;margin-top:10px}
.qr-wrap img{width:90px;height:90px;border:2px solid #DC2626;border-radius:4px;padding:2px}
.footer{margin-top:20px;padding-top:10px;border-top:1px dashed #ddd;display:flex;justify-content:space-between;font-size:10.5px;color:#aaa}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>

<div class="header">
  <div>
    ${rc?.show_name!==false ? `<div class="shop-name">${rc.shop_name||'SK POS'}</div>` : ''}
    <div class="shop-info">
      ${rc?.show_address!==false&&rc?.address ? `${rc.address}<br>` : ''}
      ${rc?.show_phone!==false&&rc?.phone    ? `โทร ${rc.phone}` : ''}
      ${rc?.show_tax!==false&&rc?.tax_id     ? ` &nbsp;|&nbsp; เลขผู้เสียภาษี ${rc.tax_id}` : ''}
    </div>
  </div>
  <div style="text-align:right;">
    <div class="receipt-badge">ใบเสร็จรับเงิน</div>
    <div>
      ${showBillNo ? `<div class="bill-no">เลขที่ #${bill.bill_no}</div>` : ''}
      ${showDate   ? `<div style="font-size:12px;color:#555;">${new Date(bill.date).toLocaleString('th-TH',{dateStyle:'full',timeStyle:'short'})}</div>` : ''}
    </div>
  </div>
</div>

<div class="meta-grid">
  ${showCust  ? `<div class="meta-item"><span>ลูกค้า</span><strong>${bill.customer_name||'ลูกค้าทั่วไป'}</strong></div>` : ''}
  ${showStaff ? `<div class="meta-item"><span>พนักงาน</span><strong>${bill.staff_name||'-'}</strong></div>` : ''}
  <div class="meta-item"><span>วิธีชำระ</span><strong>${bill.method}</strong></div>
  <div class="meta-item"><span>สถานะ</span><strong style="color:${bill.status==='สำเร็จ'?'#059669':'#DC2626'}">${bill.status}</strong></div>
</div>

<table>
  <thead><tr>
    <th class="num">#</th>
    <th>รายการสินค้า</th>
    <th class="center">จำนวน</th>
    <th class="right">ราคา/หน่วย</th>
    ${showCost ? '<th class="right">ต้นทุน</th>' : ''}
    <th class="right">ยอดรวม</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="summary">
  <div class="sum-row"><span>ยอดรวม</span><span>฿${formatNum(subtotal)}</span></div>
  ${showCost && cost>0 ? `
  <div class="sum-row gp"><span>ต้นทุนรวม</span><span>฿${formatNum(cost)}</span></div>
  <div class="sum-row gp"><span>กำไรขั้นต้น</span><span>฿${formatNum(gp)} (${subtotal>0?Math.round(gp/subtotal*100):0}%)</span></div>` : ''}
  ${showDisc&&bill.discount ? `<div class="sum-row"><span>ส่วนลด</span><span style="color:#DC2626">-฿${formatNum(bill.discount)}</span></div>` : ''}
  <div class="grand-row"><span>ยอดสุทธิ</span><span>฿${formatNum(bill.total)}</span></div>
  <div style="margin-top:8px;"><span class="method-chip">${bill.method}</span></div>
  ${bill.method==='เงินสด'&&showRecv ? `<div class="sum-row"><span>รับมา</span><span>฿${formatNum(bill.received)}</span></div>` : ''}
  ${bill.method==='เงินสด'&&showChng ? `<div class="sum-row"><span>เงินทอน</span><span style="font-weight:700">฿${formatNum(bill.change)}</span></div>` : ''}
  ${rc?.promptpay_number&&rc?.show_promptpay_qr!==false ? `
  <div class="qr-wrap">
    <img src="https://promptpay.io/${rc.promptpay_number.replace(/[^0-9]/g,'')}.png">
    <div style="font-size:10px;color:#aaa;margin-top:3px;">สแกนโอนเงิน</div>
  </div>` : ''}
</div>

<div class="footer">
  <span>${rc?.receipt_footer||'ขอบคุณที่ใช้บริการ'}</span>
  <span>พิมพ์โดย ${showStaff?bill.staff_name:''} | ${new Date().toLocaleString('th-TH')}</span>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`);
  win.document.close();
};

// ── 80mm ก็ต้องซ่อน cost เหมือนกัน ───────────────────────────────
const _v6Orig80mm = window.print80mmv2;
window.print80mmv2 = function(bill, items, rc) {
  if (!rc) { _v6Orig80mm?.apply(this, arguments); return; }
  rc = { ...rc };
  // ถ้า show_cost = false ให้ set cost = 0 ใน items ก่อน
  if (!rc.show_cost) {
    items = (items||[]).map(i => ({ ...i, cost: 0 }));
  }
  _v6Orig80mm?.(bill, items, rc);
};


// ══════════════════════════════════════════════════════════════════
// FIX-2  รับสินค้าเข้า — addPurchaseItem ไม่ closeModal แล้วเด้งออก
// ══════════════════════════════════════════════════════════════════
// ปัญหา: addPurchaseItem() เรียก closeModal() ซึ่งปิด purchase modal ด้วย
// แก้: แทน closeModal ด้วยการซ่อน add-item form แล้ว render รายการ inline

window.addPurchaseItem = function() {
  const id   = document.getElementById('pi-prod-id')?.value;
  const name = document.getElementById('pi-prod-name')?.value;
  const qty  = Number(document.getElementById('pi-qty')?.value || 1);
  const cost = Number(document.getElementById('pi-cost')?.value || 0);
  const unit = document.getElementById('pi-unit')?.value || 'ชิ้น';
  if (!id || qty <= 0) { toast('กรุณากรอกข้อมูล','error'); return; }

  const ex = purchaseItems.find(x => x.product_id === id);
  if (ex) { ex.qty += qty; ex.cost_per_unit = cost; }
  else purchaseItems.push({ product_id: id, name, qty, cost_per_unit: cost, unit });

  renderPurchaseItems();

  // ไม่ closeModal() — แค่ซ่อน add-item panel กลับไปหน้า list
  const addPanel = document.getElementById('pi-add-panel');
  const listPanel= document.getElementById('pi-list-panel');
  if (addPanel && listPanel) {
    addPanel.style.display = 'none';
    listPanel.style.display = 'block';
    const titleEl = document.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = 'สร้างใบรับสินค้าเข้า';
  } else {
    // fallback: เรียก showAddPurchaseModal ซ้ำโดยไม่ reset items
    const savedItems = [...purchaseItems];
    closeModal();
    setTimeout(() => {
      window._purchaseItemsCache = savedItems;
      showAddPurchaseModal?.();
    }, 80);
  }

  toast(`เพิ่ม ${name} x${qty} แล้ว`, 'success');
};

// Override showAddPurchaseModal ให้มี 2 panel ใน modal เดียว
window.showAddPurchaseModal = function() {
  if (window._purchaseItemsCache) {
    purchaseItems = window._purchaseItemsCache;
    window._purchaseItemsCache = null;
  } else {
    purchaseItems = [];
  }

  openModal('สร้างใบรับสินค้าเข้า', `
    <form id="purchase-form" onsubmit="event.preventDefault();">

      <!-- ─── Panel หลัก ──────────────────────────── -->
      <div id="pi-list-panel">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label class="form-label">ผู้จำหน่าย</label>
            <input class="form-input" id="pur-supplier" list="supplier-list" placeholder="ชื่อผู้จำหน่าย">
            <datalist id="supplier-list"></datalist></div>
          <div class="form-group"><label class="form-label">วิธีชำระ</label>
            <select class="form-input" id="pur-method" onchange="togglePurCredit()">
              <option>เงินสด</option><option>เครดิต</option><option>โอนเงิน</option>
            </select></div>
        </div>
        <div id="pur-credit-section" style="display:none;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">ซัพพลายเออร์</label>
              <select class="form-input" id="pur-supplier-id"><option value="">-- เลือก --</option></select></div>
            <div class="form-group"><label class="form-label">วันครบกำหนด</label>
              <input class="form-input" type="date" id="pur-due-date"></div>
          </div>
        </div>
        <div class="form-group"><label class="form-label">หมายเหตุ</label>
          <input class="form-input" id="pur-note" placeholder="หมายเหตุ (ถ้ามี)"></div>

        <!-- รายการสินค้า -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:700;">รายการสินค้า</div>
          <button type="button" class="btn btn-outline btn-sm" onclick="v6ShowAddItem()">
            <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มสินค้า
          </button>
        </div>
        <div id="pur-no-items" style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px;border:1.5px dashed var(--border-light);border-radius:var(--radius-md);">
          ยังไม่มีรายการ กดปุ่ม "เพิ่มสินค้า"
        </div>
        <div id="pur-item-list" style="display:none;"></div>

        <button type="button" class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="savePurchaseOrder()">
          <i class="material-icons-round">save</i> บันทึกใบรับสินค้า
        </button>
      </div>

      <!-- ─── Panel เพิ่มสินค้า ─────────────────── -->
      <div id="pi-add-panel" style="display:none;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:12px;" onclick="v6HideAddItem()">
          <i class="material-icons-round" style="font-size:14px;">arrow_back</i> กลับ
        </button>
        <div class="form-group">
          <label class="form-label">ค้นหาสินค้า</label>
          <input class="form-input" id="pi-search" placeholder="พิมพ์ชื่อสินค้า..." oninput="filterPurchaseItems()">
        </div>
        <div id="pi-product-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius-md);margin-bottom:10px;">
          ${(products||[]).map(p => `
            <div class="pi-row" data-name="${(p.name||'').toLowerCase()}"
              style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:0.5px solid var(--border-light);cursor:pointer;"
              onclick="selectPurchaseProduct('${p.id}','${(p.name||'').replace(/'/g,"\\'")}','${p.unit||'ชิ้น'}')">
              <div>
                <strong style="font-size:13px;">${p.name}</strong>
                <span style="font-size:11px;color:var(--text-tertiary);margin-left:6px;">ต้นทุน ฿${formatNum(p.cost||0)} | สต็อก ${p.stock||0}</span>
              </div>
              <span class="btn btn-outline btn-sm">เลือก</span>
            </div>`).join('')}
        </div>
        <div id="pi-selected-info" style="display:none;">
          <div style="background:var(--bg-base);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:10px;font-size:13px;">
            เลือก: <strong id="pi-selected-name"></strong>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div class="form-group"><label class="form-label">จำนวน</label>
              <input class="form-input" type="number" id="pi-qty" value="1" min="1"></div>
            <div class="form-group"><label class="form-label">ต้นทุน/หน่วย</label>
              <input class="form-input" type="number" id="pi-cost" min="0" placeholder="0"></div>
            <div class="form-group"><label class="form-label">หน่วย</label>
              <input class="form-input" id="pi-unit" value="ชิ้น"></div>
          </div>
          <input type="hidden" id="pi-prod-id">
          <input type="hidden" id="pi-prod-name">
          <button type="button" class="btn btn-primary" style="width:100%;" onclick="addPurchaseItem()">
            <i class="material-icons-round">add</i> เพิ่มรายการนี้
          </button>
        </div>
      </div>

    </form>`);

  // Load suppliers
  db.from('ซัพพลายเออร์').select('id,name').eq('status','ใช้งาน').then(({data}) => {
    const dl  = document.getElementById('supplier-list');
    const sel = document.getElementById('pur-supplier-id');
    (data||[]).forEach(s => {
      if (dl) { const o = document.createElement('option'); o.value = s.name; dl.appendChild(o); }
      if (sel) { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; sel.appendChild(o); }
    });
  });

  // render ถ้ามี items cache
  if (purchaseItems.length > 0) renderPurchaseItems();
};

window.v6ShowAddItem = function() {
  document.getElementById('pi-list-panel').style.display = 'none';
  document.getElementById('pi-add-panel').style.display  = 'block';
  document.getElementById('pi-selected-info').style.display = 'none';
  const titleEl = document.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = 'เพิ่มสินค้าเข้าใบรับ';
  setTimeout(() => document.getElementById('pi-search')?.focus(), 100);
};

window.v6HideAddItem = function() {
  document.getElementById('pi-add-panel').style.display  = 'none';
  document.getElementById('pi-list-panel').style.display = 'block';
  const titleEl = document.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = 'สร้างใบรับสินค้าเข้า';
};

// Override selectPurchaseProduct ให้ทำงานกับ panel ใหม่
window.selectPurchaseProduct = function(id, name, unit) {
  document.getElementById('pi-product-list').style.display = 'none';
  document.getElementById('pi-search').closest('.form-group').style.display = 'none';
  const info = document.getElementById('pi-selected-info');
  const nameEl = document.getElementById('pi-selected-name');
  document.getElementById('pi-prod-id').value   = id;
  document.getElementById('pi-prod-name').value = name;
  document.getElementById('pi-unit').value      = unit;
  if (nameEl) nameEl.textContent = name;
  const prod = (products||[]).find(p => p.id === id);
  if (prod) document.getElementById('pi-cost').value = prod.cost || 0;
  if (info) info.style.display = 'block';
};


// ══════════════════════════════════════════════════════════════════
// FIX-3  หน้าพนักงาน — Supabase chain .catch TypeError
// ══════════════════════════════════════════════════════════════════
// Supabase JS v2: .order().limit() คืน PromiseLike ไม่ใช่ Promise ธรรมดา
// → ใช้ try/catch แทน .catch() ใน chain

// Override v5LoadAdvance ให้ใช้ try/catch
window.v5LoadAdvance && (async function patchLoadAdvance() {
  window.v5LoadAdvance = async function() {
    const sec = document.getElementById('att-tab-advance');
    if (!sec) return;
    sec.innerHTML = typeof v5Loading==='function' ? v5Loading('โหลดรายการเบิกเงิน...') : '<div style="padding:40px;text-align:center;">โหลด...</div>';

    const today = new Date().toISOString().split('T')[0];
    let emps = [], advances = [];
    try { emps = await loadEmployees(); } catch(e) { emps = []; }
    try {
      const { data } = await db.from('เบิกเงิน')
        .select('*, พนักงาน(name,lastname)')
        .order('date', { ascending: false })
        .limit(60);
      advances = data || [];
    } catch(e) { advances = []; }

    const empMap = {};
    emps.forEach(e => { empMap[e.id] = e; });
    const totalToday = advances.filter(a => (a.date||'').startsWith(today) && a.status==='อนุมัติ').reduce((s,a)=>s+a.amount, 0);

    sec.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">การเบิกเงินพนักงาน</h3>
          <div style="font-size:13px;color:var(--text-secondary);">เบิกวันนี้รวม: <strong style="color:var(--warning);">฿${formatNum(totalToday)}</strong></div>
        </div>
        <button class="btn btn-primary" onclick="v5NewAdvance?.()"><i class="material-icons-round">add</i> เบิกเงินใหม่</button>
      </div>
      ${advances.length === 0
        ? `<div style="text-align:center;padding:60px;color:var(--text-tertiary);"><i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;opacity:.3;">payments</i>ยังไม่มีรายการเบิกเงิน</div>`
        : `<div style="display:flex;flex-direction:column;gap:8px;">
            ${advances.map(a => {
              const emp  = a['พนักงาน'] || empMap[a.employee_id] || {};
              const name = emp.name ? `${emp.name} ${emp.lastname||''}`.trim() : '?';
              return `<div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px;">
                <div style="width:44px;height:44px;border-radius:50%;background:${a.status==='อนุมัติ'?'#fef3c7':'#f1f5f9'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  <i class="material-icons-round" style="color:${a.status==='อนุมัติ'?'var(--warning)':'#94a3b8'};">payments</i>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:14px;font-weight:700;">${name}</div>
                  <div style="font-size:12px;color:var(--text-tertiary);">${a.reason||'—'} • ${a.method||'เงินสด'}</div>
                  <div style="font-size:11px;color:var(--text-tertiary);">${a.date ? formatDateTime(a.date) : ''}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:16px;font-weight:800;color:var(--warning);">฿${formatNum(a.amount)}</div>
                  <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;background:${a.status==='อนุมัติ'?'#d1fae5':'#fef3c7'};color:${a.status==='อนุมัติ'?'#065f46':'#92400e'};">${a.status||'รออนุมัติ'}</span>
                </div>
              </div>`;
            }).join('')}
          </div>`}`;
  };
})();

// Override v5LoadPayroll ให้ใช้ try/catch
window.v5LoadPayroll && (async function patchLoadPayroll() {
  window.v5LoadPayroll = async function() {
    const sec = document.getElementById('att-tab-payroll');
    if (!sec) return;
    sec.innerHTML = typeof v5Loading==='function' ? v5Loading('คำนวณเงินเดือน...') : '<div style="padding:40px;text-align:center;">โหลด...</div>';

    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth() + 1;
    const monthStr  = `${year}-${String(month).padStart(2,'0')}`;
    const startDate = `${monthStr}-01`;
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

    let emps = [], attAll = [], advAll = [], paidAll = [];
    try { emps = await loadEmployees(); } catch(e) {}
    try { const r = await db.from('เช็คชื่อ').select('employee_id,status,date').gte('date',startDate).lte('date',endDate); attAll = r.data||[]; } catch(e) {}
    try { const r = await db.from('เบิกเงิน').select('employee_id,amount,status').gte('date',startDate+'T00:00:00').eq('status','อนุมัติ'); advAll = r.data||[]; } catch(e) {}
    try { const r = await db.from('จ่ายเงินเดือน').select('employee_id,net_paid,paid_date').gte('paid_date',startDate+'T00:00:00'); paidAll = r.data||[]; } catch(e) {}

    const actives = emps.filter(e => e.status==='ทำงาน');
    const paidMap = {};
    paidAll.forEach(p => { paidMap[p.employee_id] = p; });

    const rows = actives.map(emp => {
      const empAtt     = attAll.filter(a => a.employee_id===emp.id);
      const empAdv     = advAll.filter(a => a.employee_id===emp.id).reduce((s,a)=>s+a.amount, 0);
      const daysWork   = empAtt.filter(a => a.status==='มาทำงาน').length;
      const daysLate   = empAtt.filter(a => a.status==='มาสาย').length;
      const daysAbsent = empAtt.filter(a => ['ขาดงาน','ลากิจ'].includes(a.status)).length;
      const wage       = emp.daily_wage || 0;
      const gross      = daysWork * wage + daysLate * wage * 0.75;
      const net        = Math.max(0, gross - empAdv);
      const isPaid     = !!paidMap[emp.id];
      return { emp, daysWork, daysLate, daysAbsent, gross, empAdv, net, isPaid };
    });

    const totalNet = rows.reduce((s,r)=>s+r.net, 0);

    sec.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">จ่ายเงินเดือน — ${new Date(year,month-1,1).toLocaleDateString('th-TH',{year:'numeric',month:'long'})}</h3>
          <div style="font-size:13px;color:var(--text-secondary);">ยอดรวม: <strong style="color:var(--success);font-size:16px;">฿${formatNum(Math.round(totalNet))}</strong></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${rows.map(r => `
          <div style="background:var(--bg-surface);border:1.5px solid ${r.isPaid?'#86efac':'var(--border-light)'};border-radius:16px;padding:18px;opacity:${r.isPaid?.7:1};">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
              <div>
                <div style="font-size:15px;font-weight:700;">${r.emp.name} ${r.emp.lastname||''}</div>
                <div style="font-size:12px;color:var(--text-tertiary);">${r.emp.position||''} • ฿${formatNum(r.emp.daily_wage||0)}/วัน</div>
              </div>
              ${r.isPaid
                ? `<span style="padding:4px 12px;border-radius:999px;background:#d1fae5;color:#065f46;font-size:12px;font-weight:700;">✅ จ่ายแล้ว</span>`
                : `<button class="btn btn-primary btn-sm" onclick="v5PayEmployee?.('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim()}',${Math.round(r.net)},'${monthStr}')">
                     <i class="material-icons-round" style="font-size:14px;">send</i> จ่ายเงิน
                   </button>`}
            </div>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;text-align:center;">
              ${[['วันทำงาน',r.daysWork,'#10B981'],['มาสาย',r.daysLate,'#F59E0B'],['ขาดงาน',r.daysAbsent,'#EF4444'],['ยอดเบิก',`฿${formatNum(r.empAdv)}`,'#F59E0B'],['สุทธิ',`฿${formatNum(Math.round(r.net))}`,'#10B981']]
                .map(([l,v,c]) => `<div style="background:var(--bg-base);border-radius:10px;padding:8px 4px;"><div style="font-size:9px;color:var(--text-tertiary);margin-bottom:3px;">${l}</div><div style="font-size:14px;font-weight:800;color:${c};">${v}</div></div>`).join('')}
            </div>
          </div>`).join('')}
        ${rows.length===0?`<div style="text-align:center;padding:60px;color:var(--text-tertiary);">ไม่มีพนักงาน</div>`:''}
      </div>`;
  };
})();

// Override v5LoadEmps ให้ใช้ try/catch
window.v5LoadEmps && (async function patchLoadEmps() {
  window.v5LoadEmps = async function() {
    const sec = document.getElementById('att-tab-emps');
    if (!sec) return;
    sec.innerHTML = typeof v5Loading==='function' ? v5Loading('โหลดข้อมูลพนักงาน...') : '<div style="padding:40px;text-align:center;">โหลด...</div>';

    let emps = [], attAll = [], advAll = [], paidAll = [];
    try { emps = await loadEmployees(); } catch(e) {}
    try { const r = await db.from('เช็คชื่อ').select('employee_id,status').gte('date','2020-01-01'); attAll = r.data||[]; } catch(e) {}
    try { const r = await db.from('เบิกเงิน').select('employee_id,amount').eq('status','อนุมัติ'); advAll = r.data||[]; } catch(e) {}
    try { const r = await db.from('จ่ายเงินเดือน').select('employee_id,net_paid,paid_date').order('paid_date',{ascending:false}).limit(200); paidAll = r.data||[]; } catch(e) {}

    sec.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
        <h3 style="font-size:16px;font-weight:700;">ข้อมูลพนักงานทั้งหมด (${emps.length} คน)</h3>
        <button class="btn btn-primary" onclick="showEmployeeModal?.();setTimeout(()=>v5LoadEmps?.(),1500)">
          <i class="material-icons-round">person_add</i> เพิ่มพนักงาน
        </button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
        ${emps.map(emp => {
          const empAtt    = attAll.filter(a => a.employee_id===emp.id);
          const totalDays = empAtt.filter(a => a.status==='มาทำงาน').length;
          const lateDays  = empAtt.filter(a => a.status==='มาสาย').length;
          const absDays   = empAtt.filter(a => ['ขาดงาน','ลากิจ'].includes(a.status)).length;
          const advCount  = advAll.filter(a => a.employee_id===emp.id).length;
          const lastPay   = paidAll.find(p => p.employee_id===emp.id);
          return `
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:18px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04);">
              <div style="padding:16px 18px;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 70%,#000));display:flex;align-items:center;gap:12px;">
                <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;flex-shrink:0;">${(emp.name||'?').charAt(0)}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:15px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${emp.name} ${emp.lastname||''}</div>
                  <div style="font-size:12px;color:rgba(255,255,255,.75);">${emp.position||'พนักงาน'} • ${emp.phone||'ไม่มีเบอร์'}</div>
                </div>
                <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;flex-shrink:0;background:${emp.status==='ทำงาน'?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'};color:${emp.status==='ทำงาน'?'#a7f3d0':'#fca5a5'};">${emp.status||'ทำงาน'}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--border-light);">
                ${[['มาทำงาน',totalDays,'#10B981'],['มาสาย',lateDays,'#F59E0B'],['ขาดงาน',absDays,'#EF4444'],['เบิกเงิน',advCount,'#6366F1']]
                  .map(([l,v,c],i) => `<div style="padding:12px 8px;text-align:center;${i<3?'border-right:1px solid var(--border-light);':''}"><div style="font-size:18px;font-weight:800;color:${c};">${v}</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:1px;">${l}</div></div>`).join('')}
              </div>
              <div style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div>
                  <div style="font-size:10px;color:var(--text-tertiary);">จ่ายเดือนล่าสุด</div>
                  <div style="font-size:13px;font-weight:700;color:var(--success);">${lastPay?`฿${formatNum(lastPay.net_paid)}`:'—'}</div>
                </div>
                <div style="display:flex;gap:6px;">
                  <button class="btn btn-ghost btn-sm" onclick="editEmployee?.('${emp.id}');setTimeout(()=>v5LoadEmps?.(),1200)">
                    <i class="material-icons-round" style="font-size:14px;">edit</i>
                  </button>
                  <button class="btn btn-outline btn-sm" style="color:var(--warning);" onclick="openAdvanceWizard?.('${emp.id}','${emp.name}');setTimeout(()=>v5LoadAdvance?.(),1000)">
                    <i class="material-icons-round" style="font-size:14px;">account_balance_wallet</i>
                  </button>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
      ${emps.length===0?'<div style="text-align:center;padding:60px;color:var(--text-tertiary);">ยังไม่มีพนักงาน</div>':''}`;
  };
})();


// ══════════════════════════════════════════════════════════════════
// FIX-4  พิมพ์บาร์โค้ด — ถามจำนวน + layout สวย + เลือก format
// ══════════════════════════════════════════════════════════════════

window.generateBarcode = async function(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const barcode = product.barcode || `SK${Date.now().toString().slice(-10)}`;
  if (!product.barcode) await db.from('สินค้า').update({ barcode }).eq('id', productId);

  const { value: formVals } = await Swal.fire({
    title: 'พิมพ์บาร์โค้ด',
    html: `
      <div style="text-align:left;font-size:14px;">
        <div style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:14px;">
          <div style="font-weight:700;margin-bottom:2px;">${product.name}</div>
          <div style="font-size:12px;color:#64748b;">${barcode}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">จำนวนที่จะพิมพ์</label>
            <input id="bc-qty-inp" type="number" value="1" min="1" max="100"
              style="width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;text-align:center;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">ขนาดกระดาษ</label>
            <select id="bc-format-sel" style="width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;">
              <option value="label">Label (58mm)</option>
              <option value="a4">A4 (เต็มแผ่น)</option>
            </select>
          </div>
        </div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: '<i class="material-icons-round" style="font-size:14px;vertical-align:middle;">print</i> พิมพ์',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#DC2626',
    preConfirm: () => ({
      qty:    parseInt(document.getElementById('bc-qty-inp')?.value || 1, 10),
      format: document.getElementById('bc-format-sel')?.value || 'label'
    })
  });
  if (!formVals) return;

  v6PrintBarcodeLabels(product, barcode, formVals.qty, formVals.format);
};

function v6PrintBarcodeLabels(product, barcode, qty, format) {
  const win = window.open('', '_blank', 'width=800,height=600');
  const labels = Array.from({ length: qty }, (_, i) => `
    <div class="label">
      <div class="shop-name">${window.SHOP_CONFIG?.nameEn || 'SK POS'}</div>
      <div class="prod-name">${product.name}</div>
      <svg class="barcode-svg" data-barcode="${barcode}"></svg>
      <div class="barcode-text">${barcode}</div>
      ${product.price ? `<div class="price">฿${formatNum(product.price)}</div>` : ''}
    </div>`).join('');

  const isA4 = format === 'a4';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page { size: ${isA4 ? 'A4' : '58mm auto'}; margin: ${isA4 ? '10mm' : '3mm'}; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Sarabun', sans-serif; background: #fff; }
.label-grid { display: ${isA4 ? 'grid' : 'flex flex-direction:column'}; ${isA4 ? 'grid-template-columns:repeat(4,1fr);gap:6px;' : ''} }
.label {
  width: ${isA4 ? 'auto' : '52mm'};
  border: 1px solid #e2e8f0; border-radius: 6px;
  padding: 6px 8px; text-align: center;
  page-break-inside: avoid; margin-bottom: ${isA4 ? '0' : '4mm'};
  background: #fff;
}
.shop-name { font-size: 9px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; }
.prod-name { font-size: 11px; font-weight: 700; margin: 3px 0; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.barcode-svg { width: 100%; height: 45px; margin: 3px 0; }
.barcode-text { font-size: 9px; color: #475569; letter-spacing: 1.5px; font-family: monospace; }
.price { font-size: 13px; font-weight: 800; color: #DC2626; margin-top: 3px; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
</head><body>
<div class="label-grid">${labels}</div>
<script>
window.onload = () => {
  document.querySelectorAll('.barcode-svg').forEach(svg => {
    try { JsBarcode(svg, svg.dataset.barcode, { format:'CODE128', width:1.8, height:40, displayValue:false, margin:2 }); } catch(e) {}
  });
  setTimeout(() => window.print(), 600);
};
<\/script>
</body></html>`);
  win.document.close();
}


// ══════════════════════════════════════════════════════════════════
// FIX-5  หน้า POS — ลบปุ่มเลือก format ออก
//         (format เลือกตอนสเต็ป 4 หลังยืนยันขาย)
// ══════════════════════════════════════════════════════════════════
// ซ่อน radio print-format ใน POS หลังโหลด
document.addEventListener('DOMContentLoaded', () => {
  const fmt = document.querySelector('[name="print-format"]')?.closest('div, label, .form-group');
  if (fmt) fmt.style.display = 'none';
});
// และซ่อนเมื่อ navigate ไปหน้า POS
const _v6OrigSwitchPage = window.switchPage;
window.switchPage = function(page) {
  _v6OrigSwitchPage?.apply(this, arguments);
  if (page === 'pos') {
    setTimeout(() => {
      document.querySelectorAll('[name="print-format"]').forEach(el => {
        const wrap = el.closest('div, label');
        if (wrap) wrap.style.display = 'none';
      });
    }, 100);
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-6  bcConfirm (bill checkout) — ถามพิมพ์ + เลือก format
// ══════════════════════════════════════════════════════════════════

const _v6OrigBcConfirm = window.bcConfirm;
window.bcConfirm = async function() {
  if (window.isProcessingPayment) return;
  if (!checkoutState?.method) { toast('กรุณาเลือกวิธีชำระเงิน','warning'); return; }

  if (checkoutState.method === 'cash') {
    const recv = typeof v4Total === 'function'
      ? v4Total(window._v4States?.['recv'] || {})
      : (checkoutState.received || 0);
    if (recv < (checkoutState.total || 0)) { toast('ยอดรับเงินไม่เพียงพอ','error'); return; }
    checkoutState.received              = recv;
    checkoutState.change                = recv - checkoutState.total;
    checkoutState.receivedDenominations = { ...(window._v4States?.['recv'] || {}) };
    const chgState = window._v4States?.['chg'];
    checkoutState.changeDenominations   = chgState
      ? { ...chgState }
      : (typeof calcChangeDenominations === 'function' ? calcChangeDenominations(checkoutState.change) : {});
  }

  closeBillCheckout?.();
  await v6CompleteSale();
};

async function v6CompleteSale() {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;

  // แสดง spinner
  const btn = document.getElementById('bc-ok-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:v5spin 1s linear infinite;margin-right:8px;vertical-align:middle;"></span>กำลังบันทึก...'; }

  try {
    const { data: sess } = await db.from('cash_session').select('*').eq('status','open').order('opened_at',{ascending:false}).limit(1).single();
    const { data: bill, error: bErr } = await db.from('บิลขาย').insert({
      date: new Date().toISOString(),
      method: {cash:'เงินสด',transfer:'โอนเงิน',credit:'บัตรเครดิต',debt:'ค้างชำระ'}[checkoutState.method] || 'เงินสด',
      total: checkoutState.total, discount: checkoutState.discount || 0,
      received: checkoutState.received, change: checkoutState.change || 0,
      customer_name: checkoutState.customer.name, customer_id: checkoutState.customer.id || null,
      staff_name: USER?.username,
      status: checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
      denominations: checkoutState.receivedDenominations || {}
    }).select().single();
    if (bErr) throw bErr;

    for (const item of cart) {
      const prod = products.find(p => p.id === item.id);
      await db.from('รายการในบิล').insert({ bill_id:bill.id, product_id:item.id, name:item.name, qty:item.qty, price:item.price, cost:item.cost||0, total:item.price*item.qty });
      await db.from('สินค้า').update({ stock:(prod?.stock||0)-item.qty }).eq('id',item.id);
      await db.from('stock_movement').insert({ product_id:item.id, product_name:item.name, type:'ขาย', direction:'out', qty:item.qty, stock_before:prod?.stock||0, stock_after:(prod?.stock||0)-item.qty, ref_id:bill.id, ref_table:'บิลขาย', staff_name:USER?.username });
    }

    if (checkoutState.method === 'cash' && sess && typeof recordCashTx === 'function') {
      await recordCashTx({
        sessionId: sess.id, type:'ขาย', direction:'in',
        amount: checkoutState.received, changeAmt: checkoutState.change || 0,
        netAmount: checkoutState.total, refId: bill.id, refTable:'บิลขาย',
        denominations: checkoutState.receivedDenominations,
        change_denominations: checkoutState.changeDenominations || {}
      });
    }

    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id',checkoutState.customer.id).single();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase||0) + checkoutState.total,
        visit_count:    (cust?.visit_count||0) + 1,
        debt_amount:    checkoutState.method==='debt' ? (cust?.debt_amount||0)+checkoutState.total : (cust?.debt_amount||0)
      }).eq('id', checkoutState.customer.id);
    }

    logActivity('ขายสินค้า', `บิล #${bill.bill_no} ยอด ฿${formatNum(checkoutState.total)}`, bill.id, 'บิลขาย');
    sendToDisplay?.({ type:'thanks', billNo:bill.bill_no, total:checkoutState.total });
    cart = [];
    await loadProducts();
    renderCart?.(); renderProductGrid?.(); updateHomeStats?.();

    // ถามพิมพ์ + เลือก format (สเต็ป 4)
    const { data: bItems } = await db.from('รายการในบิล').select('*').eq('bill_id', bill.id);
    const totalCost = (bItems||[]).reduce((s,i)=>s+(i.cost||0)*i.qty, 0);
    const gp = bill.total - totalCost;

    const rc = await (typeof getShopConfig === 'function' ? getShopConfig() : Promise.resolve({}));
    const askFmt = rc?.ask_format !== false;

    // ถาม format + พิมพ์
    const { value: fmt } = await Swal.fire({
      icon: 'success',
      title: `✅ บิล #${bill.bill_no} สำเร็จ`,
      html: `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0;text-align:center;">
          <div style="background:#f0fdf4;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">ยอดขาย</div>
            <div style="font-size:16px;font-weight:800;color:#059669;">฿${formatNum(bill.total)}</div>
          </div>
          <div style="background:#fff8f0;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">ต้นทุน</div>
            <div style="font-size:16px;font-weight:800;color:#f59e0b;">฿${formatNum(totalCost)}</div>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">กำไร</div>
            <div style="font-size:16px;font-weight:800;color:#2563eb;">฿${formatNum(gp)}</div>
          </div>
        </div>
        <div style="margin-top:10px;">
          <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">รูปแบบพิมพ์ใบเสร็จ</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <label style="border:2px solid #e2e8f0;border-radius:10px;padding:10px;cursor:pointer;text-align:center;transition:all .15s;">
              <input type="radio" name="v6fmt" value="80mm" style="display:none;">
              <div style="font-size:20px;margin-bottom:4px;">🧾</div>
              <div style="font-size:12px;font-weight:700;">80mm</div>
              <div style="font-size:10px;color:#94a3b8;">เครื่องพิมพ์</div>
            </label>
            <label style="border:2px solid #e2e8f0;border-radius:10px;padding:10px;cursor:pointer;text-align:center;transition:all .15s;">
              <input type="radio" name="v6fmt" value="A4" style="display:none;">
              <div style="font-size:20px;margin-bottom:4px;">📄</div>
              <div style="font-size:12px;font-weight:700;">A4</div>
              <div style="font-size:10px;color:#94a3b8;">ใบเสร็จเต็ม</div>
            </label>
            <label style="border:2px solid #e2e8f0;border-radius:10px;padding:10px;cursor:pointer;text-align:center;transition:all .15s;">
              <input type="radio" name="v6fmt" value="skip" checked style="display:none;">
              <div style="font-size:20px;margin-bottom:4px;">⏭️</div>
              <div style="font-size:12px;font-weight:700;">ข้าม</div>
              <div style="font-size:10px;color:#94a3b8;">ไม่พิมพ์</div>
            </label>
          </div>
        </div>`,
      showConfirmButton: true,
      showCancelButton: false,
      confirmButtonText: 'ยืนยัน',
      confirmButtonColor: '#DC2626',
      timer: 10000, timerProgressBar: true,
      didOpen: () => {
        // style radio labels
        document.querySelectorAll('[name="v6fmt"]').forEach(radio => {
          const lbl = radio.closest('label');
          radio.addEventListener('change', () => {
            document.querySelectorAll('[name="v6fmt"]').forEach(r => {
              const l = r.closest('label');
              l.style.borderColor = r.checked ? '#DC2626' : '#e2e8f0';
              l.style.background  = r.checked ? '#fff5f5' : '#fff';
            });
          });
          if (radio.checked) { lbl.style.borderColor = '#DC2626'; lbl.style.background = '#fff5f5'; }
        });
        // auto select format from settings
        const defaultFmt = rc?.default_format || '80mm';
        const autoRadio = document.querySelector(`[name="v6fmt"][value="${defaultFmt}"]`);
        if (autoRadio) { autoRadio.checked = true; autoRadio.dispatchEvent(new Event('change')); }
      },
      preConfirm: () => document.querySelector('[name="v6fmt"]:checked')?.value || 'skip'
    });

    if (fmt && fmt !== 'skip') {
      await printReceipt(bill, bItems||[], fmt);
    }

  } catch(e) {
    console.error('[v6] sale error:', e);
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  } finally {
    window.isProcessingPayment = false;
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.origText || 'ยืนยันการขาย'; }
  }
}

console.info('%c[modules-v6.js] ✅%c FIX-1:ต้นทุนใบเสร็จ | FIX-2:รับสินค้า | FIX-3:พนักงาน | FIX-4:บาร์โค้ด | FIX-5:Format POS | FIX-6:พิมพ์หลังขาย',
  'color:#f59e0b;font-weight:700','color:#6B7280');
/**
 * SK POS — modules-v7.js  (โหลดหลัง modules-v6.js)
 *
 * ██████████████████████████████████████████████████████████████████
 *  V7-1  EXACT CHANGE  — ทอนเงิน/รับเงินทอนต้องพอดีเป๊ะ บันทึกไม่ได้ถ้าขาด/เกิน
 *  V7-2  LOADING TOAST — spinner ทุก save operation
 *  V7-3  ADVANCE ใหม่  — เชื่อม drawer + popup นับแบงค์ (v5 style)
 *  V7-4  PAYROLL PRO   — สรุปทีมก่อน → เลือกรายคน → จ่าย พร้อม debt deduct
 * ██████████████████████████████████████████████████████████████████
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// V7-SHARED: Spinner utility
// ══════════════════════════════════════════════════════════════════

/** แสดง overlay loading แบบ fullscreen toast */
function v7ShowLoading(msg = 'กำลังบันทึก...') {
  let el = document.getElementById('v7-loading-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'v7-loading-toast';
    el.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(0);
      background:#1e293b;color:#fff;padding:12px 24px;border-radius:14px;
      display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;
      z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.3);font-family:var(--font-thai,'Prompt'),sans-serif;
      transition:all .2s;white-space:nowrap;`;
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <style>@keyframes v7spin{to{transform:rotate(360deg)}}</style>
    <div style="width:18px;height:18px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:v7spin .8s linear infinite;flex-shrink:0;"></div>
    <span>${msg}</span>`;
  el.style.display = 'flex';
  el.style.opacity = '1';
}

function v7HideLoading() {
  const el = document.getElementById('v7-loading-toast');
  if (el) { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; }, 200); }
}

/** Wrap async fn ด้วย loading toast */
async function v7WithLoading(msg, fn) {
  v7ShowLoading(msg);
  try { return await fn(); }
  finally { v7HideLoading(); }
}

/** Disable / enable submit button */
function v7BtnLoading(btn, on, originalHTML) {
  if (!btn) return;
  if (on) {
    btn.disabled = true;
    btn.dataset.v7orig = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:v7spin .8s linear infinite;margin-right:8px;vertical-align:middle;"></span>กำลังบันทึก...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.v7orig || originalHTML || btn.innerHTML;
  }
}


// ══════════════════════════════════════════════════════════════════
// V7-1  EXACT CHANGE ENFORCEMENT
//   - ทอนให้ลูกค้า (checkout): ต้องพอดีกับยอดทอน
//   - รับเงินทอนกลับ (expense): ต้องพอดีกับยอดทอน
//   - ปิดรอบ: ไม่บังคับพอดี (แจ้งเตือนแต่ยังบันทึกได้)
// ══════════════════════════════════════════════════════════════════

/** Patch v4UpdateOkBtn — เพิ่มการตรวจยอดทอนพอดี */
const _v7OrigUpdateOkBtn = window.v4UpdateOkBtn;
window.v4UpdateOkBtn = function() {
  const btn = document.getElementById('bc-ok-btn');
  if (!btn) return;

  let ok = false;
  if (checkoutState?.method === 'cash') {
    const recv    = typeof v4Total === 'function' ? v4Total(window._v4States?.['recv'] || {}) : 0;
    const total   = checkoutState?.total || 0;
    const enoughRecv = recv >= total;
    const mustChange  = recv - total;

    if (enoughRecv && mustChange > 0) {
      // ต้องมีทอน — ตรวจว่านับพอดีหรือยัง
      const chgState = window._v4States?.['chg'];
      const gave     = chgState ? v4Total(chgState) : 0;
      ok = Math.abs(gave - mustChange) === 0; // ต้องพอดีเป๊ะ
    } else {
      ok = enoughRecv && mustChange === 0; // พอดีพอดี ไม่ต้องทอน
      if (enoughRecv && mustChange === 0) ok = true;
      else if (enoughRecv && mustChange > 0) ok = false; // ยังไม่ได้นับทอน
      else ok = false;
    }
  } else {
    ok = !!checkoutState?.method;
  }

  btn.disabled       = !ok;
  btn.style.opacity  = ok ? '1' : '.45';
  btn.style.cursor   = ok ? 'pointer' : 'not-allowed';
};

/** Patch v4UpdateChangeSummary — บังคับ exact + update ok btn */
const _v7OrigUpdateChangeSummary = window.v4UpdateChangeSummary;
window.v4UpdateChangeSummary = function(mustChange) {
  const state   = window._v4States?.['chg'];
  const gave    = state ? v4Total(state) : 0;
  const diff    = gave - mustChange;

  const gaveEl  = document.getElementById('v4-gave-change');
  const warnEl  = document.getElementById('v4-change-warn');

  if (gaveEl) {
    gaveEl.textContent = `฿${formatNum(gave)}`;
    gaveEl.style.color = diff === 0 ? '#059669' : diff < 0 ? '#dc2626' : '#d97706';
  }

  if (warnEl) {
    if (mustChange === 0) {
      warnEl.style.display = 'none';
    } else if (gave === 0) {
      warnEl.style.display = 'block';
      warnEl.style.cssText = warnEl.style.cssText + ';background:#fee2e2;border-color:#fca5a5;color:#dc2626;';
      warnEl.innerHTML = `<strong>⚠️ กรุณานับแบงค์ทอน</strong> — ต้องทอน ฿${formatNum(mustChange)}`;
    } else if (diff < 0) {
      warnEl.style.display = 'block';
      warnEl.style.cssText = warnEl.style.cssText + ';background:#fee2e2;border-color:#fca5a5;color:#dc2626;';
      warnEl.innerHTML = `<strong>🚫 ทอนขาด ฿${formatNum(-diff)}</strong> — ห้ามบันทึก ต้องทอนให้ครบ`;
    } else if (diff > 0) {
      warnEl.style.display = 'block';
      warnEl.style.cssText = warnEl.style.cssText + ';background:#fff7ed;border-color:#fed7aa;color:#92400e;';
      warnEl.innerHTML = `<strong>🚫 ทอนเกิน ฿${formatNum(diff)}</strong> — ห้ามบันทึก ต้องทอนพอดี`;
    } else {
      warnEl.style.display = 'block';
      warnEl.style.cssText = warnEl.style.cssText + ';background:#f0fdf4;border-color:#86efac;color:#15803d;';
      warnEl.innerHTML = `<strong>✅ ยอดทอนถูกต้อง</strong> — สามารถบันทึกได้`;
    }
  }

  if (checkoutState) checkoutState.changeDenominations = state ? { ...state } : {};
  v4UpdateOkBtn();
};

/** Patch expense เงินทอน — ต้องพอดี */
const _v7OrigUpdateExpSummary = window.v7UpdateExpSummary || window.v4UpdateExpSummary;
// Override v4ProcessExpense ให้ตรวจยอดทอนพอดี
const _v7OrigProcessExpense = window.v4ProcessExpense;
window.v4ProcessExpense = async function() {
  const amount   = Number(document.getElementById('exp-amount')?.value || 0);
  const method   = document.getElementById('exp-method')?.value;

  if (method === 'เงินสด') {
    const payState = window._v4States?.['epay'] || {};
    const paid     = typeof v4Total === 'function' ? v4Total(payState) : 0;
    if (paid > 0 && paid > amount) {
      // มีเงินทอน — ตรวจว่ารับทอนพอดีหรือยัง
      const changeBack   = paid - amount;
      const recvState    = window._v4States?.['erecv'] || {};
      const recvTotal    = typeof v4Total === 'function' ? v4Total(recvState) : 0;
      const diff = recvTotal - changeBack;
      if (Math.abs(diff) > 0) {
        await Swal.fire({
          icon: 'error',
          title: diff < 0 ? `รับทอนขาด ฿${formatNum(-diff)}` : `รับทอนเกิน ฿${formatNum(diff)}`,
          text: `ต้องรับทอน ฿${formatNum(changeBack)} ให้พอดีเป๊ะก่อนบันทึก`,
          confirmButtonColor: '#DC2626'
        });
        return;
      }
    }
  }

  // ผ่านการตรวจแล้ว — โชว์ loading แล้วเรียก original
  const btn = document.querySelector('#expense-form .btn-primary') || document.querySelector('.modal-body .btn-primary');
  v7BtnLoading(btn, true);
  v7ShowLoading('กำลังบันทึกรายจ่าย...');
  try {
    await _v7OrigProcessExpense?.apply(this, arguments);
  } finally {
    v7HideLoading();
    v7BtnLoading(btn, false);
  }
};


// ══════════════════════════════════════════════════════════════════
// V7-2  LOADING TOAST — ครอบ save operations สำคัญ
// ══════════════════════════════════════════════════════════════════

// Patch savePurchaseOrder
const _v7OrigSavePO = window.savePurchaseOrder;
window.savePurchaseOrder = async function() {
  v7ShowLoading('กำลังบันทึกใบรับสินค้า...');
  try { return await _v7OrigSavePO?.apply(this, arguments); }
  finally { v7HideLoading(); }
};

// Patch saveShopSettings
const _v7OrigSaveShop = window.saveShopSettings;
window.saveShopSettings = async function() {
  v7ShowLoading('กำลังบันทึกข้อมูลร้าน...');
  try { return await _v7OrigSaveShop?.apply(this, arguments); }
  finally { v7HideLoading(); }
};

// Patch saveReceiptSettings
const _v7OrigSaveReceipt = window.saveReceiptSettings;
window.saveReceiptSettings = async function() {
  v7ShowLoading('กำลังบันทึกตั้งค่าใบเสร็จ...');
  try { return await _v7OrigSaveReceipt?.apply(this, arguments); }
  finally { v7HideLoading(); }
};

// ══════════════════════════════════════════════════════════════════
// V7-3  ADVANCE WIZARD — เชื่อม drawer + v5 denomination grid
// ══════════════════════════════════════════════════════════════════

window.openAdvanceWizard = async function(empId, empName) {
  // ตรวจ session
  let cashBal = 0;
  let currentDenoms = {};
  try {
    cashBal = await getLiveCashBalance();
    currentDenoms = typeof v4GetCurrentDenoms === 'function'
      ? await v4GetCurrentDenoms() || {}
      : {};
  } catch(e) {}

  // Step 1: กรอกจำนวน + เหตุผล
  const { value: info } = await Swal.fire({
    title: `💸 เบิกเงิน — ${empName}`,
    html: `
      <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:14px;text-align:left;">
        <div style="font-size:11px;color:#94a3b8;margin-bottom:2px;">เงินในลิ้นชักตอนนี้</div>
        <div style="font-size:22px;font-weight:800;color:#1e293b;">฿${formatNum(cashBal)}</div>
      </div>
      <div style="text-align:left;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">จำนวนเงิน (บาท) *</label>
          <input type="number" id="adv7-amount" min="1" max="${cashBal}" placeholder="0"
            style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:16px;text-align:center;font-weight:700;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">วิธีจ่าย</label>
          <select id="adv7-method" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;">
            <option value="เงินสด">💵 เงินสด</option>
            <option value="โอนเงิน">📱 โอนเงิน</option>
          </select>
        </div>
      </div>
      <div style="text-align:left;">
        <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">เหตุผล</label>
        <input type="text" id="adv7-reason" placeholder="ระบุเหตุผล..."
          style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;">
      </div>`,
    showCancelButton: true,
    confirmButtonText: 'ดำเนินการต่อ →',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#DC2626',
    preConfirm: () => {
      const a = Number(document.getElementById('adv7-amount')?.value || 0);
      if (!a || a <= 0) { Swal.showValidationMessage('กรุณาระบุจำนวน'); return false; }
      const m = document.getElementById('adv7-method')?.value || 'เงินสด';
      if (m === 'เงินสด' && a > cashBal) {
        Swal.showValidationMessage(`เงินในลิ้นชักไม่พอ มีอยู่ ฿${formatNum(cashBal)}`); return false;
      }
      return { amount: a, method: m, reason: document.getElementById('adv7-reason')?.value || '' };
    }
  });
  if (!info) return;

  const { amount, method, reason } = info;

  if (method !== 'เงินสด') {
    // โอน — บันทึกทันที
    await v7WithLoading('กำลังบันทึกการเบิกเงิน...', async () => {
      await db.from('เบิกเงิน').insert({ employee_id: empId, amount, method, reason, approved_by: USER?.username, status: 'อนุมัติ' });
      logActivity('เบิกเงินพนักงาน', `${empName} ฿${formatNum(amount)} | ${reason}`);
    });
    toast(`เบิกเงิน ${empName} ฿${formatNum(amount)} สำเร็จ`, 'success');
    renderAttendance?.();
    return;
  }

  // เงินสด — เปิด popup นับแบงค์ EXACT
  const state = typeof v4EmptyDenoms === 'function' ? v4EmptyDenoms() : {};
  window._v4States = window._v4States || {};
  window._v4States['adv7'] = state;

  const ov = document.createElement('div');
  ov.id = 'v7-adv-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = `
    <div style="background:var(--bg-surface,#fff);border-radius:20px;width:100%;max-width:580px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-size:10px;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">เบิกเงินพนักงาน</div>
          <div style="font-size:17px;font-weight:700;color:#fff;">${empName}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:rgba(255,255,255,.7);margin-bottom:1px;">ต้องจ่าย</div>
          <div style="font-size:26px;font-weight:800;color:#fff;font-family:var(--font-display,'Georgia');">฿${formatNum(amount)}</div>
        </div>
      </div>

      <!-- Summary bar -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:12px 16px;background:#fffbeb;border-bottom:1px solid #fde68a;flex-shrink:0;">
        <div style="text-align:center;">
          <div style="font-size:9px;color:#92400e;text-transform:uppercase;font-weight:600;margin-bottom:2px;">ต้องจ่าย</div>
          <div style="font-size:16px;font-weight:800;color:#92400e;">฿${formatNum(amount)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;color:#92400e;text-transform:uppercase;font-weight:600;margin-bottom:2px;">นับได้</div>
          <div id="v7adv-counted" style="font-size:16px;font-weight:800;color:#1e293b;">฿0</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;color:#92400e;text-transform:uppercase;font-weight:600;margin-bottom:2px;">ผลต่าง</div>
          <div id="v7adv-diff" style="font-size:16px;font-weight:800;color:#94a3b8;">—</div>
        </div>
      </div>

      <!-- Denom grid -->
      <div style="flex:1;overflow-y:auto;padding:16px;">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.7px;display:flex;align-items:center;gap:5px;margin-bottom:10px;">
          <i class="material-icons-round" style="font-size:13px;color:#d97706;">payments</i>นับแบงค์ที่จ่ายออก
          <span style="font-size:9px;font-weight:400;color:#94a3b8;">(xN = จำนวนในลิ้นชัก)</span>
        </div>
        <div id="v7adv-bill-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px;"></div>
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.7px;display:flex;align-items:center;gap:5px;margin-bottom:10px;padding-top:10px;border-top:1px solid #f1f5f9;">
          <i class="material-icons-round" style="font-size:13px;color:#b45309;">toll</i>เหรียญ
        </div>
        <div id="v7adv-coin-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;"></div>
        <div id="v7adv-warn" style="display:none;margin-top:10px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:600;"></div>
      </div>

      <!-- Footer -->
      <div style="padding:14px 16px;border-top:1px solid #f1f5f9;background:#fafafa;display:flex;gap:10px;flex-shrink:0;">
        <button onclick="document.getElementById('v7-adv-overlay').remove()"
          style="flex:1;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif;font-size:14px;color:#64748b;font-weight:600;">
          ยกเลิก
        </button>
        <button id="v7adv-confirm-btn" onclick="v7ConfirmAdvance('${empId}','${empName}',${amount},'${reason}')" disabled
          style="flex:2;padding:12px;border:none;border-radius:12px;background:#d97706;color:#fff;font-family:var(--font-thai,'Prompt'),sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;opacity:.5;transition:all .15s;">
          <i class="material-icons-round" style="font-size:18px;">payments</i> ยืนยันเบิกเงิน
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  // Render cards
  window._v4States['adv7_onChange'] = () => v7UpdateAdvSummary(amount, currentDenoms);
  v7RenderAdvGrid(currentDenoms);
  v7UpdateAdvSummary(amount, currentDenoms);
};

function v7RenderAdvGrid(currentDenoms) {
  const state  = window._v4States?.['adv7'] || {};
  const bGrid  = document.getElementById('v7adv-bill-grid');
  const cGrid  = document.getElementById('v7adv-coin-grid');
  if (bGrid) bGrid.innerHTML = BILLS.map(d => typeof v5DenomCard === 'function'
    ? v5DenomCard(d, false, 'adv7', state[d.value]||0, currentDenoms[d.value]??null)
    : `<div onclick="v4Add('adv7',${d.value},1)" style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;">
        <div style="font-size:18px;font-weight:800;">฿${d.label}</div>
        <div id="v4qty-adv7-${d.value}" style="font-size:14px;font-weight:700;">${state[d.value]||0}</div>
        <div id="v4badge-adv7-${d.value}" style="display:none;">${state[d.value]||0}</div>
        <div id="v4sub-adv7-${d.value}" style="font-size:10px;color:#94a3b8;">—</div>
        <div style="display:flex;gap:4px;margin-top:6px;">
          <button onclick="event.stopPropagation();v4Add('adv7',${d.value},-1)" style="flex:1;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;">−</button>
          <button onclick="event.stopPropagation();v4Add('adv7',${d.value},1)" style="flex:1;border:none;border-radius:6px;background:#d97706;color:#fff;cursor:pointer;">+</button>
        </div>
      </div>`).join('');
  if (cGrid) cGrid.innerHTML = COINS.map(d => typeof v5DenomCard === 'function'
    ? v5DenomCard(d, true, 'adv7', state[d.value]||0, currentDenoms[d.value]??null)
    : `<div onclick="v4Add('adv7',${d.value},1)" style="background:#fffbeb;border:2px solid #fde68a;border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;">
        <div style="font-size:18px;font-weight:800;color:#92400e;">฿${d.label}</div>
        <div id="v4qty-adv7-${d.value}" style="font-size:14px;font-weight:700;">${state[d.value]||0}</div>
        <div id="v4badge-adv7-${d.value}" style="display:none;">${state[d.value]||0}</div>
        <div id="v4sub-adv7-${d.value}" style="font-size:10px;color:#94a3b8;">—</div>
        <div style="display:flex;gap:4px;margin-top:6px;">
          <button onclick="event.stopPropagation();v4Add('adv7',${d.value},-1)" style="flex:1;border:1px solid #fde68a;border-radius:6px;background:#fff;cursor:pointer;">−</button>
          <button onclick="event.stopPropagation();v4Add('adv7',${d.value},1)" style="flex:1;border:none;border-radius:6px;background:#d97706;color:#fff;cursor:pointer;">+</button>
        </div>
      </div>`).join('');
}

window._v4States = window._v4States || {};
window._v4States['adv7_onChange'] = () => {};

function v7UpdateAdvSummary(mustPay, currentDenoms) {
  const state   = window._v4States?.['adv7'] || {};
  const counted = typeof v4Total === 'function' ? v4Total(state) : 0;
  const diff    = counted - mustPay;

  const cEl     = document.getElementById('v7adv-counted');
  const dEl     = document.getElementById('v7adv-diff');
  const warnEl  = document.getElementById('v7adv-warn');
  const confBtn = document.getElementById('v7adv-confirm-btn');

  if (cEl) { cEl.textContent = `฿${formatNum(counted)}`; cEl.style.color = diff === 0 ? '#059669' : counted > 0 ? '#1e293b' : '#94a3b8'; }
  if (dEl) {
    dEl.textContent = counted === 0 ? '—' : `${diff >= 0 ? '+' : ''}฿${formatNum(diff)}`;
    dEl.style.color = diff === 0 ? '#059669' : diff > 0 ? '#d97706' : '#dc2626';
  }
  if (warnEl) {
    if (counted === 0)    { warnEl.style.display='none'; }
    else if (diff < 0)    { warnEl.style.display='block'; warnEl.style.cssText+='background:#fee2e2;border:1.5px solid #fca5a5;color:#dc2626;'; warnEl.innerHTML=`<strong>🚫 จ่ายขาด ฿${formatNum(-diff)}</strong> — ต้องนับให้พอดีก่อนบันทึก`; }
    else if (diff > 0)    { warnEl.style.display='block'; warnEl.style.cssText+='background:#fff7ed;border:1.5px solid #fed7aa;color:#92400e;'; warnEl.innerHTML=`<strong>🚫 จ่ายเกิน ฿${formatNum(diff)}</strong> — ห้ามบันทึก ต้องพอดีเป๊ะ`; }
    else                  { warnEl.style.display='block'; warnEl.style.cssText+='background:#f0fdf4;border:1.5px solid #86efac;color:#15803d;'; warnEl.innerHTML=`<strong>✅ ยอดถูกต้อง</strong> — สามารถยืนยันได้`; }
  }
  if (confBtn) {
    const ok = diff === 0 && counted > 0;
    confBtn.disabled      = !ok;
    confBtn.style.opacity = ok ? '1' : '.5';
    confBtn.style.cursor  = ok ? 'pointer' : 'not-allowed';
  }
}

window.v7ConfirmAdvance = async function(empId, empName, amount, reason) {
  const state = window._v4States?.['adv7'] || {};
  const counted = typeof v4Total === 'function' ? v4Total(state) : 0;
  if (counted !== amount) { toast('ยอดไม่พอดี ห้ามบันทึก','error'); return; }

  const btn = document.getElementById('v7adv-confirm-btn');
  v7BtnLoading(btn, true);
  v7ShowLoading('กำลังบันทึกการเบิกเงิน...');

  try {
    await db.from('เบิกเงิน').insert({ employee_id: empId, amount, method: 'เงินสด', reason, approved_by: USER?.username, status: 'อนุมัติ' });
    const { data: sess } = await db.from('cash_session').select('id').eq('status','open').limit(1).single().catch(()=>({data:null}));
    if (sess && typeof recordCashTx === 'function') {
      await recordCashTx({ sessionId: sess.id, type:'เบิกเงินพนักงาน', direction:'out', amount, netAmount: amount, denominations: { ...state }, note: reason });
    }
    logActivity('เบิกเงินพนักงาน', `${empName} ฿${formatNum(amount)} | ${reason}`);
    document.getElementById('v7-adv-overlay')?.remove();
    toast(`เบิกเงิน ${empName} ฿${formatNum(amount)} สำเร็จ`, 'success');
    renderAttendance?.();
  } catch(e) {
    console.error('[v7] advance error:', e);
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    v7BtnLoading(btn, false);
  } finally {
    v7HideLoading();
  }
};


// ══════════════════════════════════════════════════════════════════
// V7-4  PAYROLL PRO — สรุปทีม → รายคน → จ่าย
// ══════════════════════════════════════════════════════════════════

// Override v5LoadPayroll
window.v5LoadPayroll = async function() {
  const sec = document.getElementById('att-tab-payroll');
  if (!sec) return;
  sec.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-tertiary,#94a3b8);">
    <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:var(--primary,#DC2626);border-radius:50%;animation:v7spin .8s linear infinite;margin:0 auto 12px;"></div>
    <style>@keyframes v7spin{to{transform:rotate(360deg)}}</style>คำนวณเงินเดือน...
  </div>`;

  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth() + 1;
  const monthStr  = `${year}-${String(month).padStart(2,'0')}`;
  const startDate = `${monthStr}-01`;
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

  let emps = [], attAll = [], advAll = [], paidHistory = [];
  try { emps = await loadEmployees(); } catch(e) {}
  try { const r = await db.from('เช็คชื่อ').select('employee_id,status,date').gte('date',startDate).lte('date',endDate); attAll = r.data||[]; } catch(e) {}
  try { const r = await db.from('เบิกเงิน').select('employee_id,amount,status,date').gte('date',startDate+'T00:00:00').eq('status','อนุมัติ'); advAll = r.data||[]; } catch(e) {}
  try { const r = await db.from('จ่ายเงินเดือน').select('employee_id,net_paid,paid_date,month').order('paid_date',{ascending:false}).limit(500); paidHistory = r.data||[]; } catch(e) {}

  const actives = emps.filter(e => e.status === 'ทำงาน');
  const monthDate = `${monthStr}-01`;

  // คำนวณแต่ละคน
  const rows = actives.map(emp => {
    const empAtt    = attAll.filter(a => a.employee_id === emp.id);
    const empAdv    = advAll.filter(a => a.employee_id === emp.id).reduce((s,a)=>s+a.amount, 0);
    const daysWork  = empAtt.filter(a => a.status==='มาทำงาน').length;
    const daysLate  = empAtt.filter(a => a.status==='มาสาย').length;
    const daysAbsent= empAtt.filter(a => ['ขาดงาน','ลากิจ'].includes(a.status)).length;
    const wage      = emp.daily_wage || 0;
    const gross     = daysWork * wage + daysLate * wage * 0.75;
    const net       = Math.max(0, gross - empAdv);
    // จ่ายแล้วเดือนนี้หรือยัง
    const paidThisMonth = paidHistory.find(p => p.employee_id===emp.id && (p.month||'').startsWith(monthStr));
    // สะสมหลังจ่ายครั้งล่าสุด
    const lastPay   = paidHistory.find(p => p.employee_id===emp.id);
    return { emp, daysWork, daysLate, daysAbsent, gross, empAdv, net, paidThisMonth, lastPay };
  });

  const totalGross = rows.reduce((s,r)=>s+r.gross, 0);
  const totalAdv   = rows.reduce((s,r)=>s+r.empAdv, 0);
  const totalNet   = rows.reduce((s,r)=>s+r.net, 0);
  const paidCount  = rows.filter(r=>r.paidThisMonth).length;

  sec.innerHTML = `
    <!-- ─── Header Summary ─────────────────────── -->
    <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:18px;padding:22px 24px;margin-bottom:20px;color:#fff;">
      <div style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;">
        สรุปเงินเดือน — ${new Date(year,month-1,1).toLocaleDateString('th-TH',{year:'numeric',month:'long'})}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;">
        ${[
          ['เงินเดือนรวม', `฿${formatNum(Math.round(totalGross))}`, '#f59e0b'],
          ['หักเบิกล่วงหน้า', `฿${formatNum(totalAdv)}`,           '#ef4444'],
          ['ยอดสุทธิรวม',    `฿${formatNum(Math.round(totalNet))}`, '#10b981'],
          ['จ่ายแล้ว',       `${paidCount}/${rows.length} คน`,    '#6366f1'],
        ].map(([l,v,c]) => `
          <div style="background:rgba(255,255,255,.08);border-radius:12px;padding:12px 10px;text-align:center;">
            <div style="font-size:10px;color:rgba(255,255,255,.55);margin-bottom:4px;">${l}</div>
            <div style="font-size:17px;font-weight:800;color:${c};">${v}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- ─── Employee Cards ─────────────────────── -->
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${rows.map(r => `
        <div style="background:var(--bg-surface,#fff);border:1.5px solid ${r.paidThisMonth?'#86efac':'#e2e8f0'};border-radius:16px;overflow:hidden;
          box-shadow:0 1px 4px rgba(0,0,0,.04);transition:all .15s;">
          <!-- Card header -->
          <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;">
            <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--primary,#DC2626),color-mix(in srgb,var(--primary,#DC2626) 70%,#000));display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;flex-shrink:0;">${(r.emp.name||'?').charAt(0)}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:700;">${r.emp.name} ${r.emp.lastname||''}</div>
              <div style="font-size:12px;color:#94a3b8;">${r.emp.position||'พนักงาน'} • ฿${formatNum(r.emp.daily_wage||0)}/วัน</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:20px;font-weight:800;color:${r.net>0?'#15803d':'#94a3b8'};">฿${formatNum(Math.round(r.net))}</div>
              ${r.paidThisMonth
                ? `<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:#d1fae5;color:#065f46;font-weight:700;">✅ จ่ายแล้ว</span>`
                : `<button class="btn btn-primary btn-sm" style="font-size:12px;" onclick="v7ShowPayrollModal('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim()}',${Math.round(r.net)},${r.empAdv},'${monthStr}')">
                     <i class="material-icons-round" style="font-size:14px;">send</i> จ่าย
                   </button>`}
            </div>
          </div>
          <!-- Stats row -->
          <div style="display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid #f1f5f9;">
            ${[
              ['วันทำงาน', r.daysWork, '#10b981'],
              ['มาสาย',    r.daysLate,  '#f59e0b'],
              ['ขาดงาน',   r.daysAbsent,'#ef4444'],
              ['เบิกล่วงหน้า',`฿${formatNum(r.empAdv)}`,'#f59e0b'],
              ['จ่ายล่าสุด', r.lastPay?`฿${formatNum(r.lastPay.net_paid)}`:'—', '#6366f1'],
            ].map(([l,v,c],i) => `
              <div style="padding:10px 6px;text-align:center;${i<4?'border-right:1px solid #f1f5f9;':''}">
                <div style="font-size:14px;font-weight:800;color:${c};">${v}</div>
                <div style="font-size:9px;color:#94a3b8;margin-top:1px;">${l}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
      ${rows.length===0?`<div style="text-align:center;padding:60px;color:#94a3b8;">ไม่มีพนักงาน</div>`:''}
    </div>`;
};

/** Modal จ่ายเงินเดือนรายคน — Professional */
window.v7ShowPayrollModal = async function(empId, empName, netAmt, advDeducted, monthStr) {
  // ดึงประวัติหนี้สะสม (advance ที่ยังค้างอยู่หลังปิดเดือนล่าสุด)
  let accDebt = 0;
  try {
    const { data: allAdv } = await db.from('เบิกเงิน')
      .select('amount,date').eq('employee_id', empId).eq('status','อนุมัติ');
    const { data: allPaid } = await db.from('จ่ายเงินเดือน')
      .select('deduct_withdraw,paid_date,net_paid').eq('employee_id', empId).order('paid_date',{ascending:false});
    const totalAdv   = (allAdv||[]).reduce((s,a)=>s+a.amount, 0);
    const totalPaidDeduct = (allPaid||[]).reduce((s,p)=>s+(p.deduct_withdraw||0), 0);
    accDebt = Math.max(0, totalAdv - totalPaidDeduct);
  } catch(e) {}

  const ov = document.createElement('div');
  ov.id = 'v7-payroll-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:500px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.45);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#059669,#10b981);padding:18px 22px;flex-shrink:0;">
        <div style="font-size:10px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">จ่ายเงินเดือน</div>
        <div style="font-size:18px;font-weight:700;color:#fff;">${empName}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px;">${new Date(monthStr+'-01').toLocaleDateString('th-TH',{year:'numeric',month:'long'})}</div>
      </div>

      <!-- Body -->
      <div style="flex:1;overflow-y:auto;padding:20px;">
        <!-- Summary cards -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
          <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:#15803d;font-weight:600;margin-bottom:4px;">เงินเดือนสุทธิเดือนนี้</div>
            <div style="font-size:22px;font-weight:800;color:#15803d;">฿${formatNum(netAmt)}</div>
            <div style="font-size:10px;color:#86efac;margin-top:2px;">หักเบิก ฿${formatNum(advDeducted)} แล้ว</div>
          </div>
          <div style="background:${accDebt>0?'#fff7ed':'#f8fafc'};border:1.5px solid ${accDebt>0?'#fed7aa':'#e2e8f0'};border-radius:12px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:${accDebt>0?'#92400e':'#94a3b8'};font-weight:600;margin-bottom:4px;">หนี้เบิกสะสมทั้งหมด</div>
            <div style="font-size:22px;font-weight:800;color:${accDebt>0?'#d97706':'#94a3b8'};">฿${formatNum(accDebt)}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${accDebt>0?'คงค้างจากทุกเดือน':'ไม่มีหนี้สะสม'}</div>
          </div>
        </div>

        <!-- Input: จ่ายครั้งนี้ -->
        <div style="margin-bottom:14px;">
          <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:6px;">
            จ่ายครั้งนี้ (บาท) *
            <span style="font-size:11px;font-weight:400;color:#94a3b8;margin-left:6px;">กรอกได้อิสระ</span>
          </label>
          <div style="position:relative;">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;font-weight:700;color:#94a3b8;">฿</span>
            <input type="number" id="v7pay-amount" value="${netAmt}" min="0"
              oninput="v7UpdatePaySummary(${netAmt},${accDebt})"
              style="width:100%;padding:12px 14px 12px 32px;border:2px solid #10b981;border-radius:12px;font-size:20px;font-weight:800;color:#15803d;text-align:right;outline:none;">
          </div>
        </div>

        <!-- Input: หักหนี้ครั้งนี้ -->
        <div style="margin-bottom:14px;">
          <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:6px;">
            หักหนี้ครั้งนี้ (บาท)
            <span style="font-size:11px;font-weight:400;color:#94a3b8;margin-left:6px;">0 = ไม่หัก</span>
          </label>
          <div style="position:relative;">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;font-weight:700;color:#94a3b8;">฿</span>
            <input type="number" id="v7pay-deduct" value="0" min="0" max="${accDebt}"
              oninput="v7UpdatePaySummary(${netAmt},${accDebt})"
              style="width:100%;padding:12px 14px 12px 32px;border:2px solid #e2e8f0;border-radius:12px;font-size:20px;font-weight:800;color:#92400e;text-align:right;outline:none;">
          </div>
        </div>

        <!-- หมายเหตุ -->
        <div style="margin-bottom:18px;">
          <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:6px;">หมายเหตุ</label>
          <input type="text" id="v7pay-note" placeholder="ระบุหมายเหตุ (ถ้ามี)"
            style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
        </div>

        <!-- Summary panel -->
        <div id="v7pay-summary" style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;">สรุปการจ่าย</div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
            <span style="color:#64748b;">จ่ายครั้งนี้</span><strong id="v7sum-pay" style="color:#15803d;">฿${formatNum(netAmt)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
            <span style="color:#64748b;">หักหนี้ครั้งนี้</span><strong id="v7sum-deduct" style="color:#d97706;">฿0</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
            <span style="color:#64748b;">หนี้คงเหลือ</span><strong id="v7sum-remain" style="color:${accDebt>0?'#92400e':'#10b981'};">฿${formatNum(accDebt)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:800;">
            <span>พนักงานได้รับจริง</span><strong id="v7sum-net" style="color:#15803d;">฿${formatNum(netAmt)}</strong>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:14px 20px;border-top:1px solid #f1f5f9;background:#fafafa;display:flex;gap:10px;flex-shrink:0;">
        <button onclick="document.getElementById('v7-payroll-overlay').remove()"
          style="flex:1;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer;font-size:14px;color:#64748b;font-weight:600;font-family:var(--font-thai,'Prompt'),sans-serif;">
          ยกเลิก
        </button>
        <button id="v7pay-confirm-btn" onclick="v7ConfirmPayroll('${empId}','${empName}','${monthStr}',${accDebt})"
          style="flex:2;padding:12px;border:none;border-radius:12px;background:#059669;color:#fff;font-family:var(--font-thai,'Prompt'),sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
          <i class="material-icons-round" style="font-size:18px;">send</i> ยืนยันจ่ายเงินเดือน
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  v7UpdatePaySummary(netAmt, accDebt);
};

window.v7UpdatePaySummary = function(baseNet, accDebt) {
  const pay     = Number(document.getElementById('v7pay-amount')?.value || 0);
  const deduct  = Math.min(Number(document.getElementById('v7pay-deduct')?.value || 0), accDebt);
  const remain  = Math.max(0, accDebt - deduct);
  const netGet  = Math.max(0, pay - deduct);

  const setEl = (id, txt, color) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = txt; if (color) el.style.color = color; }
  };
  setEl('v7sum-pay',    `฿${formatNum(pay)}`,   pay>0?'#15803d':'#94a3b8');
  setEl('v7sum-deduct', `฿${formatNum(deduct)}`, deduct>0?'#d97706':'#94a3b8');
  setEl('v7sum-remain', `฿${formatNum(remain)}`, remain>0?'#92400e':'#10b981');
  setEl('v7sum-net',    `฿${formatNum(netGet)}`,  netGet>0?'#15803d':'#94a3b8');
};

window.v7ConfirmPayroll = async function(empId, empName, monthStr, accDebt) {
  const pay    = Number(document.getElementById('v7pay-amount')?.value || 0);
  const deduct = Number(document.getElementById('v7pay-deduct')?.value || 0);
  const note   = document.getElementById('v7pay-note')?.value || '';
  if (pay <= 0) { toast('กรุณาระบุจำนวนเงิน','error'); return; }
  if (deduct > accDebt) { toast(`หักหนี้ได้สูงสุด ฿${formatNum(accDebt)}`,'error'); return; }

  const btn = document.getElementById('v7pay-confirm-btn');
  v7BtnLoading(btn, true);
  v7ShowLoading('กำลังบันทึกการจ่ายเงินเดือน...');

  try {
    await db.from('จ่ายเงินเดือน').insert({
      employee_id:     empId,
      month:           monthStr + '-01',
      net_paid:        pay,
      deduct_withdraw: deduct,
      base_salary:     pay + deduct,
      paid_date:       new Date().toISOString(),
      staff_name:      USER?.username,
      note:            note || `จ่ายเงินเดือน ${monthStr}`
    });
    logActivity('จ่ายเงินเดือน', `${empName} ฿${formatNum(pay)} | หักหนี้ ฿${formatNum(deduct)}`);
    document.getElementById('v7-payroll-overlay')?.remove();
    toast(`จ่ายเงินเดือน ${empName} ฿${formatNum(pay)} สำเร็จ`, 'success');
    window.v5LoadPayroll?.();
  } catch(e) {
    console.error('[v7] payroll error:', e);
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    v7BtnLoading(btn, false);
  } finally {
    v7HideLoading();
  }
};

console.info('%c[modules-v7.js] ✅%c V7-1:Exact Change | V7-2:Loading Toast | V7-3:Advance+Drawer | V7-4:Payroll Pro',
  'color:#10b981;font-weight:700','color:#6B7280');
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
