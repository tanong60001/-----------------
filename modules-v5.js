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
