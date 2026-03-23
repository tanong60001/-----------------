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
  if (m==='debt' && checkoutState.customer.type==='general') { toast('ติดหนี้ได้เฉพาะลูกค้าประจำ','warning'); return; }
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
      method: {cash:'เงินสด',transfer:'โอนเงิน',credit:'บัตรเครดิต',debt:'ติดหนี้'}[checkoutState.method]||'เงินสด',
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
      onclick="${noStock ? '' : `v4Add('${prefix}',${d.value},1)`}"
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
  if (m === 'debt' && checkoutState.customer.type === 'general') { toast('ติดหนี้ได้เฉพาะลูกค้าประจำ','warning'); return; }
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

