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
