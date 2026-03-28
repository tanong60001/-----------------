/**
 * SK POS — modules-v14.js  (โหลดหลัง modules-v13.js)
 * ════════════════════════════════════════════════════════════════════
 *  V14-1  CASH DRAWER CHANGE  — แสดงแบงค์ในลิ้นชัก ให้พนักงานนับทอนเอง
 *  V14-2  DEBT METHOD FIX     — กด "ค้างชำระ" → ถัดไป → หน้าพิมพ์
 *  V14-3  DQ UNIT CONVERSION  — จัดส่งสำเร็จ หัก cost ตาม conv_rate จริง
 *  V14-4  BMC PRINT MENU      — ปุ่มพิมพ์ใน History แสดงหลายตัวเลือก
 *  V14-5  PROJECT SYSTEM      — ระบบโครงการของร้าน (สมบูรณ์แบบ)
 * ════════════════════════════════════════════════════════════════════
 *
 *  SQL ที่ต้อง run ก่อน:
 *
 *  CREATE TABLE IF NOT EXISTS โครงการ (
 *    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *    created_at TIMESTAMPTZ DEFAULT NOW(),
 *    name TEXT NOT NULL,
 *    contract_no TEXT,
 *    budget NUMERIC NOT NULL DEFAULT 0,
 *    status TEXT DEFAULT 'active',
 *    total_expenses NUMERIC DEFAULT 0,
 *    total_goods_cost NUMERIC DEFAULT 0,
 *    completed_at TIMESTAMPTZ,
 *    notes TEXT
 *  );
 *
 *  CREATE TABLE IF NOT EXISTS รายจ่ายโครงการ (
 *    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *    created_at TIMESTAMPTZ DEFAULT NOW(),
 *    project_id UUID REFERENCES โครงการ(id) ON DELETE CASCADE,
 *    description TEXT NOT NULL,
 *    amount NUMERIC NOT NULL DEFAULT 0,
 *    category TEXT DEFAULT 'ทั่วไป',
 *    type TEXT DEFAULT 'expense',
 *    bill_id UUID,
 *    notes TEXT
 *  );
 *
 *  ALTER TABLE บิลขาย ADD COLUMN IF NOT EXISTS project_id UUID;
 */

'use strict';

/* ─── Denomination helpers ──────────────────────────────────────── */
const V14_BILLS = [
  { value:1000, label:'1,000', bg:'linear-gradient(145deg,#3b0764,#7c3aed)', shadow:'rgba(124,58,237,.35)' },
  { value:500,  label:'500',   bg:'linear-gradient(145deg,#052e16,#16a34a)', shadow:'rgba(22,163,74,.35)' },
  { value:100,  label:'100',   bg:'linear-gradient(145deg,#7f1d1d,#dc2626)', shadow:'rgba(220,38,38,.35)' },
  { value:50,   label:'50',    bg:'linear-gradient(145deg,#1e3a8a,#2563eb)', shadow:'rgba(37,99,235,.35)' },
  { value:20,   label:'20',    bg:'linear-gradient(145deg,#14532d,#15803d)', shadow:'rgba(21,128,61,.35)' },
];
const V14_COINS = [
  { value:10, label:'10', bg:'linear-gradient(145deg,#78350f,#d97706)', shadow:'rgba(217,119,6,.3)' },
  { value:5,  label:'5',  bg:'linear-gradient(145deg,#374151,#6b7280)', shadow:'rgba(107,114,128,.3)' },
  { value:2,  label:'2',  bg:'linear-gradient(145deg,#92400e,#ca8a04)', shadow:'rgba(202,138,4,.3)' },
  { value:1,  label:'1',  bg:'linear-gradient(145deg,#1f2937,#4b5563)', shadow:'rgba(75,85,99,.3)' },
];
const V14_ALL = [...V14_BILLS,...V14_COINS];

const v14fmt = n => typeof formatNum==='function' ? formatNum(n) : Number(n||0).toLocaleString('th-TH');

/* ─── CSS Inject ────────────────────────────────────────────────── */
(function injectV14CSS(){
  if(document.getElementById('v14-styles')) return;
  const s=document.createElement('style'); s.id='v14-styles';
  s.textContent=`
/* ── V14 Drawer Change Panel ─────────────────────────────────────── */
.v14-change-panel { background:#fefce8; border:2px solid #fde68a; border-radius:16px; padding:16px; margin-top:12px; }
.v14-change-panel-title { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.v14-change-amt { font-size:26px; font-weight:900; color:#d97706; letter-spacing:-.5px; }
.v14-change-progress { font-size:13px; color:#92400e; font-weight:600; }
.v14-drawer-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:8px; }
.v14-drawer-coin-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
.v14-drawer-btn {
  border:none; border-radius:12px; padding:12px 6px 8px;
  cursor:pointer; position:relative; transition:all .15s;
  display:flex; flex-direction:column; align-items:center; gap:5px;
  box-shadow:0 3px 10px var(--v14sh,rgba(0,0,0,.12));
  user-select:none; opacity:1;
}
.v14-drawer-btn.empty { opacity:.35; cursor:not-allowed; }
.v14-drawer-btn:hover:not(.empty) { transform:translateY(-2px); }
.v14-drawer-btn:active:not(.empty) { transform:scale(.93); }
.v14-drawer-btn-lbl { font-size:14px; font-weight:800; color:#fff; }
.v14-drawer-count { font-size:11px; color:rgba(255,255,255,.75); font-weight:600; }
.v14-drawer-chosen { 
  position:absolute; top:-7px; right:-7px;
  background:#22c55e; color:#fff; border-radius:12px; padding:2px 8px;
  font-size:12px; font-weight:800; min-width:22px; text-align:center;
  display:none; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,.2);
}
.v14-drawer-chosen.show { display:block; }
.v14-coin-drawer {
  border:none; border-radius:50%; width:60px; height:60px;
  cursor:pointer; position:relative; transition:all .15s;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px;
  box-shadow:0 3px 8px var(--v14sh,rgba(0,0,0,.12)); user-select:none; margin:0 auto;
}
.v14-coin-drawer.empty { opacity:.35; cursor:not-allowed; }
.v14-coin-drawer-lbl { font-size:12px; font-weight:800; color:#fff; }
.v14-coin-drawer-cnt { font-size:9px; color:rgba(255,255,255,.7); }
.v14-coin-chosen {
  position:absolute; top:-5px; right:-5px;
  background:#22c55e; color:#fff; border-radius:9px; padding:1px 5px;
  font-size:10px; font-weight:800; display:none; border:2px solid #fff;
}
.v14-coin-chosen.show { display:block; }
.v14-change-ok { 
  background:#f0fdf4; border:1.5px solid #86efac; border-radius:12px;
  padding:14px; text-align:center; margin-top:8px;
}
.v14-change-ok .ok-ico { font-size:36px; color:#10b981; }
.v14-change-ok .ok-txt { font-size:16px; font-weight:800; color:#15803d; margin-top:4px; }

/* ── BMC Print Dropdown ──────────────────────────────────────────── */
.v14-print-dropdown { position:relative; display:inline-block; }
.v14-print-menu {
  display:none; position:absolute; right:0; top:100%; z-index:999;
  background:#fff; border:1.5px solid var(--border,#e5e7eb); border-radius:12px;
  box-shadow:0 8px 24px rgba(0,0,0,.12); min-width:160px; overflow:hidden;
  animation:v14FadeIn .15s ease;
}
.v14-print-menu.open { display:block; }
@keyframes v14FadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
.v14-print-menu-item {
  display:flex; align-items:center; gap:8px; padding:10px 14px;
  font-size:13px; cursor:pointer; color:var(--text-primary,#111); border:none;
  background:none; width:100%; font-family:inherit; transition:background .1s; text-align:left;
}
.v14-print-menu-item:hover { background:var(--bg-secondary,#f9fafb); }
.v14-print-menu-item i { font-size:16px; color:var(--text-muted,#9ca3af); }

/* ── Project System ──────────────────────────────────────────────── */
.v14-proj-container { max-width:900px; margin:0 auto; padding:20px; }
.v14-proj-header {
  background:linear-gradient(135deg,#1e1b4b,#312e81);
  color:#fff; border-radius:20px; padding:24px 28px; margin-bottom:20px;
  display:flex; align-items:center; justify-content:space-between;
}
.v14-proj-title { font-size:22px; font-weight:800; display:flex; align-items:center; gap:10px; }
.v14-proj-subtitle { font-size:13px; color:rgba(255,255,255,.65); margin-top:4px; }
.v14-proj-add-btn {
  background:#fff; color:#1e1b4b; border:none; border-radius:12px;
  padding:12px 20px; font-size:14px; font-weight:700; cursor:pointer;
  display:flex; align-items:center; gap:6px; transition:all .15s; font-family:inherit;
}
.v14-proj-add-btn:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(0,0,0,.15); }

.v14-proj-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
.v14-proj-stat { background:#fff; border-radius:14px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.06); border:1px solid var(--border,#f0f0f0); }
.v14-proj-stat .lbl { font-size:11px; font-weight:700; color:var(--text-muted,#9ca3af); text-transform:uppercase; letter-spacing:.5px; }
.v14-proj-stat .val { font-size:22px; font-weight:900; margin-top:4px; }

.v14-proj-cards { display:flex; flex-direction:column; gap:12px; }
.v14-proj-card {
  background:#fff; border-radius:16px; padding:20px 24px;
  box-shadow:0 2px 10px rgba(0,0,0,.06); border:1.5px solid var(--border,#f0f0f0);
  cursor:pointer; transition:all .18s;
}
.v14-proj-card:hover { box-shadow:0 6px 20px rgba(30,27,75,.1); transform:translateY(-2px); border-color:#c7d2fe; }
.v14-proj-card-head { display:flex; align-items:center; gap:14px; margin-bottom:12px; }
.v14-proj-icon {
  width:48px; height:48px; border-radius:14px;
  background:linear-gradient(135deg,#3730a3,#6366f1);
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.v14-proj-icon i { font-size:26px; color:#fff; }
.v14-proj-name { font-size:17px; font-weight:800; color:var(--text-primary,#111); }
.v14-proj-contract { font-size:12px; color:var(--text-muted,#9ca3af); margin-top:2px; }
.v14-proj-progress-bar { height:8px; background:#e5e7eb; border-radius:99px; overflow:hidden; margin-bottom:10px; }
.v14-proj-progress-fill { height:100%; border-radius:99px; transition:width .4s ease; }
.v14-proj-nums { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
.v14-proj-num { background:var(--bg-secondary,#f9fafb); border-radius:10px; padding:10px 12px; }
.v14-proj-num .n-lbl { font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; }
.v14-proj-num .n-val { font-size:16px; font-weight:800; margin-top:3px; }

/* Project Detail */
.v14-proj-detail-header {
  background:linear-gradient(135deg,#312e81,#4338ca);
  color:#fff; border-radius:20px; padding:20px 24px; margin-bottom:16px;
}
.v14-expense-list { display:flex; flex-direction:column; gap:6px; }
.v14-expense-row {
  background:#fff; border:1.5px solid var(--border,#f0f0f0); border-radius:12px;
  padding:12px 16px; display:flex; align-items:center; gap:12px; transition:all .12s;
}
.v14-expense-row:hover { border-color:#c7d2fe; }
.v14-expense-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.v14-status-badge-proj {
  display:inline-flex; align-items:center; gap:4px; padding:3px 10px;
  border-radius:20px; font-size:11px; font-weight:700;
}
.v14-badge-active   { background:#ede9fe; color:#5b21b6; }
.v14-badge-complete { background:#d1fae5; color:#065f46; }
.v14-badge-goods    { background:#dbeafe; color:#1d4ed8; }
.v14-badge-expense  { background:#fee2e2; color:#991b1b; }

/* Customer type - project card in checkout */
.v14-proj-cust-card {
  border:2px solid var(--border,#e5e7eb); border-radius:14px;
  padding:18px 12px; cursor:pointer; text-align:center; transition:all .18s;
  background:#fff;
}
.v14-proj-cust-card:hover { border-color:#6366f1; transform:translateY(-2px); }
.v14-proj-cust-card.selected { border-color:#6366f1; background:#eef2ff; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
.v14-proj-cust-card i { font-size:28px; color:#6366f1; display:block; margin-bottom:8px; }
.v14-proj-cust-card h4 { font-size:13px; font-weight:700; margin:0 0 3px; }
.v14-proj-cust-card p { font-size:11px; color:var(--text-muted,#9ca3af); margin:0; }
`;
  document.head.appendChild(s);
})();


/* ════════════════════════════════════════════════════════════════
   V14-1: CASH DRAWER — แสดงแบงค์ในลิ้นชัก ให้พนักงานนับทอนเอง
════════════════════════════════════════════════════════════════ */

/* ดึงยอดแบงค์ในลิ้นชักจาก cash_session + cash_transactions */
async function v14GetDrawerDenoms() {
  const drawer = {};
  V14_ALL.forEach(d => { drawer[d.value] = 0; });
  try {
    const { data: sess } = await db.from('cash_session').select('*')
      .eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (!sess) return drawer;
    // เพิ่มแบงค์เปิดลิ้นชัก (ถ้ามี field opening_denominations)
    const od = sess.opening_denominations || sess.denominations || {};
    Object.entries(od).forEach(([v,c]) => {
      const k = Number(v);
      if (drawer[k] !== undefined) drawer[k] += Number(c)||0;
    });
    // นำธุรกรรมมาหักลบ
    const { data: txns } = await db.from('cash_transaction')
      .select('direction,denominations,change_denominations').eq('session_id', sess.id);
    (txns||[]).forEach(tx => {
      const dir = tx.direction==='in' ? 1 : -1;
      if (tx.denominations) Object.entries(tx.denominations).forEach(([v,c]) => {
        const k=Number(v); if(drawer[k]!==undefined) drawer[k]+=dir*(Number(c)||0);
      });
      // เงินทอนออกจากลิ้นชัก
      if (tx.change_denominations && tx.direction==='in') Object.entries(tx.change_denominations).forEach(([v,c]) => {
        const k=Number(v); if(drawer[k]!==undefined) drawer[k]-=(Number(c)||0);
      });
    });
    // clamp ≥ 0
    Object.keys(drawer).forEach(k => { if (drawer[k]<0) drawer[k]=0; });
  } catch(e) { console.warn('[v14] drawer denoms:', e.message); }
  return drawer;
}

/* State สำหรับเงินทอนที่พนักงานเลือก */
if (!window.v14State) window.v14State = {};
window.v14State.changeGiven = {};   // denomination → count
window.v14State.drawerDenoms = {};  // denomination → available in drawer

window.v12S5 = function(container) {
  // render เริ่มต้น (ดึง drawer async)
  v14RenderCashStep(container, false, {});
  v14GetDrawerDenoms().then(dd => {
    window.v14State.drawerDenoms = dd;
    window.v14State.changeGiven = {};
    V14_ALL.forEach(d => { v14State.changeGiven[d.value] = 0; });
    v14RenderCashStep(container, true, dd);
  });
};

function v14RenderCashStep(container, drawerReady, drawer) {
  if (!container) return;
  const payAmt   = v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total;
  const received = V14_ALL.reduce((s,d)=>s+d.value*(v12State.receivedDenominations?.[d.value]||0),0);
  const change   = received - payAmt;
  const enough   = received >= payAmt;

  container.innerHTML = `
    <h2 class="v12-step-title">รับเงินสด</h2>
    <p class="v12-step-subtitle">กดแบงค์/เหรียญที่รับจากลูกค้า | กดค้างเพื่อลบ</p>

    <!-- Summary -->
    <div class="v13-cash-bar">
      <div class="v13-cash-cell">
        <div class="lbl">ยอดที่รับ</div>
        <div class="val" style="color:var(--primary,#3b82f6);">฿${v14fmt(payAmt)}</div>
      </div>
      <div class="v13-cash-cell">
        <div class="lbl">รับมาแล้ว</div>
        <div class="val" id="v14-recv-disp" style="color:${enough?'#10b981':'var(--text-primary)'};">฿${v14fmt(received)}</div>
      </div>
      <div class="v13-cash-cell">
        <div class="lbl">${enough?'เงินทอน':'ยังขาด'}</div>
        <div class="val" id="v14-diff-disp" style="color:${received===0?'#9ca3af':enough?'#d97706':'#f59e0b'};">฿${v14fmt(enough?change:payAmt-received)}</div>
      </div>
    </div>

    <!-- Quick Amounts -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
      <span style="font-size:12px;color:var(--text-muted,#9ca3af);">พอดี:</span>
      ${[payAmt,Math.ceil(payAmt/100)*100,Math.ceil(payAmt/500)*500,Math.ceil(payAmt/1000)*1000]
        .filter((v,i,a)=>a.indexOf(v)===i&&v>=payAmt).slice(0,4)
        .map(v=>`<button class="v12-quick-btn" onclick="v14SetExact(${v})">฿${v14fmt(v)}</button>`).join('')}
      <button onclick="v14ClearReceive()" style="margin-left:auto;border:1.5px solid #fca5a5;border-radius:8px;padding:6px 12px;background:#fff;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;">
        <i class="material-icons-round" style="font-size:14px;">refresh</i> ล้าง
      </button>
    </div>

    <!-- Receive Bills -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
      <i class="material-icons-round" style="font-size:16px;">payments</i> ธนบัตรที่รับ
    </div>
    <div class="v13-denom-grid">
      ${V14_BILLS.map(d=>{
        const cnt=v12State.receivedDenominations?.[d.value]||0;
        return `<div class="v13-denom-btn" style="background:${d.bg};--v13-shadow:${d.shadow};"
          onclick="v14AddRecv(${d.value})" oncontextmenu="event.preventDefault();v14RemRecv(${d.value})">
          <span class="v13-denom-count-badge ${cnt>0?'show':''}" id="v14-rn-${d.value}">${cnt}</span>
          <span class="v13-denom-label">฿${d.label}</span>
          <span class="v13-denom-sub" id="v14-rs-${d.value}">${cnt>0?`×${cnt}`:' '}</span>
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin:10px 0 8px;display:flex;align-items:center;gap:6px;">
      <i class="material-icons-round" style="font-size:16px;">toll</i> เหรียญที่รับ
    </div>
    <div class="v13-coin-grid">
      ${V14_COINS.map(d=>{
        const cnt=v12State.receivedDenominations?.[d.value]||0;
        return `<div class="v13-coin-btn" style="background:${d.bg};" onclick="v14AddRecv(${d.value})" oncontextmenu="event.preventDefault();v14RemRecv(${d.value})">
          <span class="v13-coin-count-badge ${cnt>0?'show':''}" id="v14-rn-${d.value}">${cnt}</span>
          <span class="v13-coin-label">฿${d.label}</span>
        </div>`;
      }).join('')}
    </div>

    <!-- Change Section -->
    <div id="v14-change-area">${enough ? v14ChangeDrawerHTML(change, drawerReady, drawer) : ''}</div>`;

  // Update next button
  const nb = document.getElementById('v12-next-btn');
  if (nb) {
    nb.disabled = !enough;
    nb.className = `v12-btn-next${enough?' green':''}`;
    nb.innerHTML = enough
      ? `<i class="material-icons-round">check</i> ยืนยัน — ทอน ฿${v14fmt(change)}`
      : `ถัดไป <i class="material-icons-round">arrow_forward</i>`;
  }
}

function v14ChangeDrawerHTML(change, drawerReady, drawer) {
  const given   = V14_ALL.reduce((s,d)=>s+d.value*(window.v14State.changeGiven?.[d.value]||0),0);
  const deficit = change - given;
  const done    = Math.abs(deficit) < 0.01;

  let innerHTML = `
    <div class="v14-change-panel">
      <div class="v14-change-panel-title">
        <div>
          <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.5px;">💵 นับเงินทอน</div>
          <div class="v14-change-amt">฿${v14fmt(change)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#92400e;">นับแล้ว</div>
          <div id="v14-given-display" style="font-size:20px;font-weight:800;color:${done?'#10b981':'#d97706'};">฿${v14fmt(given)}</div>
          ${!done ? `<div style="font-size:12px;color:#b45309;">ขาด ฿${v14fmt(Math.max(0,deficit))}</div>` : `<div style="font-size:12px;color:#059669;">✅ ครบแล้ว</div>`}
        </div>
      </div>

      ${!drawerReady ? `<div style="text-align:center;padding:16px;color:#92400e;font-size:13px;"><i class="material-icons-round" style="font-size:30px;display:block;margin-bottom:6px;opacity:.5;">hourglass_empty</i>กำลังโหลดข้อมูลลิ้นชัก...</div>` : ''}

      ${drawerReady ? `
      <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <i class="material-icons-round" style="font-size:15px;">inbox</i> ธนบัตรในลิ้นชัก (คลิกเพื่อทอน)
      </div>
      <div class="v14-drawer-grid">
        ${V14_BILLS.map(d=>{
          const avail = drawer[d.value]||0;
          const chosen= window.v14State.changeGiven?.[d.value]||0;
          const empty = avail<=0;
          return `<div class="v14-drawer-btn ${empty?'empty':''}" style="background:${d.bg};--v14sh:${d.shadow};"
            ${empty?'':`onclick="v14AddGiven(${d.value})" oncontextmenu="event.preventDefault();v14RemGiven(${d.value})"`}>
            <span class="v14-drawer-chosen ${chosen>0?'show':''}" id="v14-gc-${d.value}">${chosen}</span>
            <span class="v14-drawer-btn-lbl">฿${d.label}</span>
            <span class="v14-drawer-count" id="v14-ga-${d.value}">${empty?'หมด':avail+' ใบ'}</span>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <i class="material-icons-round" style="font-size:15px;">paid</i> เหรียญในลิ้นชัก
      </div>
      <div class="v14-drawer-coin-grid">
        ${V14_COINS.map(d=>{
          const avail = drawer[d.value]||0;
          const chosen= window.v14State.changeGiven?.[d.value]||0;
          const empty = avail<=0;
          return `<div class="v14-coin-drawer ${empty?'empty':''}" style="background:${d.bg};--v14sh:${d.shadow};"
            ${empty?'':`onclick="v14AddGiven(${d.value})" oncontextmenu="event.preventDefault();v14RemGiven(${d.value})"`}>
            <span class="v14-coin-chosen ${chosen>0?'show':''}" id="v14-gc-${d.value}">${chosen}</span>
            <span class="v14-coin-drawer-lbl">฿${d.label}</span>
            <span class="v14-coin-drawer-cnt" id="v14-ga-${d.value}">${empty?'หมด':avail+'เ'}</span>
          </div>`;
        }).join('')}
      </div>

      <button onclick="v14ResetGiven()" style="border:1.5px solid #fcd34d;border-radius:8px;padding:6px 12px;background:transparent;color:#92400e;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;margin-bottom:8px;">
        <i class="material-icons-round" style="font-size:14px;">refresh</i> ล้างการนับทอน
      </button>

      ${done ? `<div class="v14-change-ok">
        <i class="material-icons-round ok-ico">check_circle</i>
        <div class="ok-txt">ทอนเงินครบ ฿${v14fmt(change)} ✅</div>
      </div>` : ''}
      ` : ''}
    </div>`;
  return innerHTML;
}

/* Receive Money Buttons */
window.v14AddRecv = function(val) {
  if (!v12State.receivedDenominations) v12State.receivedDenominations = {};
  v12State.receivedDenominations[val] = (v12State.receivedDenominations[val]||0)+1;
  v14UpdateRecvUI();
};
window.v14RemRecv = function(val) {
  if (!v12State.receivedDenominations) return;
  v12State.receivedDenominations[val] = Math.max(0,(v12State.receivedDenominations[val]||0)-1);
  v14UpdateRecvUI();
};
window.v14SetExact = function(amt) {
  V14_ALL.forEach(d=>{v12State.receivedDenominations[d.value]=0;});
  let rem=amt;
  [...V14_BILLS,...V14_COINS].sort((a,b)=>b.value-a.value).forEach(d=>{
    const cnt=Math.floor(rem/d.value); v12State.receivedDenominations[d.value]=cnt; rem-=cnt*d.value;
  });
  v14UpdateRecvUI();
};
window.v14ClearReceive = function() {
  V14_ALL.forEach(d=>{v12State.receivedDenominations[d.value]=0;});
  v14UpdateRecvUI();
};

/* Change Given Buttons */
window.v14AddGiven = function(val) {
  const drawer = window.v14State.drawerDenoms||{};
  const avail  = drawer[val]||0;
  const cur    = window.v14State.changeGiven?.[val]||0;
  if (cur >= avail) return;
  if (!window.v14State.changeGiven) window.v14State.changeGiven={};
  window.v14State.changeGiven[val] = cur+1;
  v14UpdateGivenUI();
};
window.v14RemGiven = function(val) {
  if (!window.v14State.changeGiven) return;
  window.v14State.changeGiven[val] = Math.max(0,(window.v14State.changeGiven[val]||0)-1);
  v14UpdateGivenUI();
};
window.v14ResetGiven = function() {
  V14_ALL.forEach(d=>{if(window.v14State.changeGiven) window.v14State.changeGiven[d.value]=0;});
  v14UpdateGivenUI();
};

function v14UpdateRecvUI() {
  const payAmt  = v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total;
  const received= V14_ALL.reduce((s,d)=>s+d.value*(v12State.receivedDenominations?.[d.value]||0),0);
  const change  = received-payAmt;
  const enough  = received>=payAmt;

  V14_ALL.forEach(d=>{
    const cnt = v12State.receivedDenominations?.[d.value]||0;
    const badge = document.getElementById(`v14-rn-${d.value}`);
    const sub   = document.getElementById(`v14-rs-${d.value}`);
    if (badge) { badge.textContent=cnt; badge.classList.toggle('show',cnt>0); }
    if (sub)   sub.textContent = cnt>0?`×${cnt}`:' ';
  });

  const rd=document.getElementById('v14-recv-disp'), dd=document.getElementById('v14-diff-disp');
  if (rd) { rd.textContent=`฿${v14fmt(received)}`; rd.style.color=enough?'#10b981':'var(--text-primary)'; }
  if (dd) {
    const abs=Math.abs(change);
    dd.textContent=`฿${v14fmt(abs)}`;
    dd.style.color=received===0?'#9ca3af':enough?'#d97706':'#f59e0b';
    const lbl=dd.previousElementSibling;
    if (lbl) lbl.textContent=enough?'เงินทอน':'ยังขาด';
  }

  const nb=document.getElementById('v12-next-btn');
  if (nb) {
    nb.disabled=!enough;
    nb.className=`v12-btn-next${enough?' green':''}`;
    nb.innerHTML=enough?`<i class="material-icons-round">check</i> ยืนยัน — ทอน ฿${v14fmt(change)}`:`ถัดไป <i class="material-icons-round">arrow_forward</i>`;
  }

  const ca=document.getElementById('v14-change-area');
  if (ca) ca.innerHTML=enough?v14ChangeDrawerHTML(change, Object.keys(window.v14State.drawerDenoms||{}).length>0, window.v14State.drawerDenoms||{}):'';
}

function v14UpdateGivenUI() {
  const payAmt  = v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total;
  const received= V14_ALL.reduce((s,d)=>s+d.value*(v12State.receivedDenominations?.[d.value]||0),0);
  const change  = received-payAmt;
  const given   = V14_ALL.reduce((s,d)=>s+d.value*(window.v14State.changeGiven?.[d.value]||0),0);
  const done    = Math.abs(change-given)<0.01;

  // Update chosen badges
  V14_ALL.forEach(d=>{
    const cnt = window.v14State.changeGiven?.[d.value]||0;
    const el  = document.getElementById(`v14-gc-${d.value}`);
    if (el) { el.textContent=cnt; el.classList.toggle('show',cnt>0); }
  });

  // Update given display
  const gd=document.getElementById('v14-given-display');
  if (gd) { gd.textContent=`฿${v14fmt(given)}`; gd.style.color=done?'#10b981':'#d97706'; }

  // Rebuild change panel (สำหรับ status text)
  const ca=document.getElementById('v14-change-area');
  if (ca && received>=payAmt) {
    ca.innerHTML=v14ChangeDrawerHTML(change, true, window.v14State.drawerDenoms||{});
  }
}

/* Store change denominations when moving to step 6 */
const _v14OrigNextStep = window.v12NextStep;
window.v12NextStep = function() {
  if (v12State.step === 5) {
    // Save changeGiven as changeDenominations
    v12State.changeDenominations = { ...(window.v14State.changeGiven||{}) };
  }
  _v14OrigNextStep?.();
};


/* ════════════════════════════════════════════════════════════════
   V14-2: DEBT METHOD FIX — v13SetMethod เรียก v12RenderStepBody
   + กด ถัดไป → v13CompletePayment → step 6 พร้อมปุ่มพิมพ์
════════════════════════════════════════════════════════════════ */
const _v14OrigSetMethod = window.v13SetMethod || window.v12SetMethod;
window.v13SetMethod = window.v12SetMethod = function(method) {
  v12State.method = method;
  // Reset receive denoms when switching
  if (method !== 'cash') V14_ALL.forEach(d=>{ v12State.receivedDenominations[d.value]=0; });

  // Update method card selection (v13 cards)
  document.querySelectorAll('.v12-method-card').forEach((c,i)=>{
    c.classList.toggle('selected',['cash','transfer','credit'][i]===method);
  });
  document.querySelectorAll('.v13-method-card-debt').forEach(c=>{
    c.classList.toggle('selected', method==='debt');
  });

  // Update info box
  const payAmt = v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total;
  const info = document.getElementById('v13-method-info');
  if (info && typeof v13MethodInfoHTML==='function') info.innerHTML = v13MethodInfoHTML(payAmt);

  // ← สำคัญ: อัพเดท step bar AND re-render body (แก้ bug ปุ่มถัดไปไม่เปลี่ยน)
  if (typeof v12UpdateStepBar==='function') v12UpdateStepBar();
  if (typeof v12RenderStepBody==='function') v12RenderStepBody();
};


/* ════════════════════════════════════════════════════════════════
   V14-3: DQ MARK DONE — หัก stock ด้วย conv_rate จาก product_units
════════════════════════════════════════════════════════════════ */
window.v12DQMarkDone = async function(billId) {
  if (typeof Swal==='undefined') {
    if (!confirm('ยืนยันการจัดส่งสำเร็จ? ระบบจะตัดสต็อกสินค้าที่จัดส่ง')) return;
  } else {
    const r = await Swal.fire({
      title:'ยืนยันจัดส่งสำเร็จ?', text:'ระบบจะตัดสต็อกสินค้าที่จัดส่งทันที',
      icon:'question', showCancelButton:true,
      confirmButtonText:'ยืนยัน จัดส่งสำเร็จ', cancelButtonText:'ยกเลิก',
      confirmButtonColor:'#10b981',
    });
    if (!r.isConfirmed) return;
  }

  try {
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
    const deliverItems = (items||[]).filter(i=>(i.deliver_qty||0)>0);
    if (!deliverItems.length) {
      typeof toast==='function' && toast('ไม่มีรายการที่ต้องจัดส่ง','warning'); return;
    }

    // ดึง product_units conv_rate สำหรับทุก product
    const prodIds = [...new Set(deliverItems.map(i=>i.product_id).filter(Boolean))];
    let unitMap = {};   // { product_id: { unit_name: conv_rate } }
    let baseMap = {};   // { product_id: base_unit }
    try {
      const [{ data: units }, { data: prods }] = await Promise.all([
        db.from('product_units').select('product_id,unit_name,conv_rate').in('product_id',prodIds),
        db.from('สินค้า').select('id,unit,cost').in('id',prodIds)
      ]);
      (units||[]).forEach(u=>{
        if (!unitMap[u.product_id]) unitMap[u.product_id]={};
        unitMap[u.product_id][u.unit_name] = u.conv_rate||1;
      });
      (prods||[]).forEach(p=>{ baseMap[p.id]={ unit:p.unit||'ชิ้น', cost:p.cost||0 }; });
    } catch(_) {}

    for (const it of deliverItems) {
      if (!it.product_id) continue;
      const sellUnit  = it.unit || 'ชิ้น';
      const baseUnit  = baseMap[it.product_id]?.unit || 'ชิ้น';
      let   convRate  = 1;
      const pu        = unitMap[it.product_id] || {};
      if (pu[sellUnit]) convRate = pu[sellUnit];
      if (sellUnit === baseUnit) convRate = 1;

      const baseQty   = parseFloat((it.deliver_qty * convRate).toFixed(6));
      const { data: prod } = await db.from('สินค้า').select('stock,cost').eq('id',it.product_id).maybeSingle();
      const sb = parseFloat(prod?.stock||0);
      const sa = parseFloat((sb - baseQty).toFixed(6));

      await db.from('สินค้า').update({ stock:sa, updated_at:new Date().toISOString() }).eq('id',it.product_id);
      try {
        await db.from('stock_movement').insert({
          product_id:it.product_id, product_name:it.name,
          type:'จัดส่ง', direction:'out', qty:baseQty,
          stock_before:sb, stock_after:sa,
          ref_id:billId, ref_table:'บิลขาย',
          staff_name:(typeof USER!=='undefined'&&USER)?USER.username:'system',
          note: convRate!==1 ? `ส่ง ${it.deliver_qty} ${sellUnit} = ${baseQty} ${baseUnit}` : null
        });
      } catch(_) {}

      if (typeof products!=='undefined') {
        const p = products.find(p=>p.id===it.product_id);
        if (p) p.stock = sa;
      }
    }

    await db.from('บิลขาย').update({ delivery_status:'จัดส่งสำเร็จ', status:'สำเร็จ' }).eq('id',billId);
    if (typeof logActivity==='function') logActivity('จัดส่งสำเร็จ',`บิล #${billId} ตัดสต็อกด้วย conv_rate`,billId,'บิลขาย');

    const card = document.getElementById(`dq-card-${billId}`);
    if (card) {
      card.style.cssText += 'opacity:0;transform:translateX(60px);transition:all .3s ease;';
      setTimeout(()=>card.remove(), 300);
    }
    typeof toast==='function' && toast('จัดส่งสำเร็จ! ตัดสต็อกเรียบร้อย','success');
    if (typeof loadProducts==='function') await loadProducts();
    if (typeof updateHomeStats==='function') updateHomeStats();
  } catch(e) {
    console.error('[v14] DQ done error:', e);
    typeof toast==='function' && toast('เกิดข้อผิดพลาด: '+e.message,'error');
  }
};


/* ════════════════════════════════════════════════════════════════
   V14-4: BMC PRINT DROPDOWN — ปุ่มพิมพ์หลายตัวเลือก
════════════════════════════════════════════════════════════════ */

/* Override row render ใน v12BMCLoad */
const _v14OrigBMCLoad = window.v12BMCLoad;
window.v12BMCLoad = async function() {
  await _v14OrigBMCLoad?.();
  v14InjectPrintDropdowns();
};

function v14InjectPrintDropdowns() {
  const tbody = document.getElementById('bmc-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(tr=>{
    const tds=tr.querySelectorAll('td'); if(!tds.length) return;
    const lastTd = tds[tds.length-1];
    if (lastTd.querySelector('.v14-print-dropdown')) return;

    // หา billId
    const btn = lastTd.querySelector('button[onclick]');
    if (!btn) return;
    const m = btn.getAttribute('onclick')?.match(/['"]([a-f0-9-]{36})['"]/);
    if (!m) return;
    const billId = m[1];

    // เช็ค delivery mode จาก delivery badge
    const hasDel = !!tr.querySelector('.v12-badge-yellow, .v12-badge-green[style*="ส่ง"]') ||
                   tr.textContent.includes('ส่ง');

    // เปลี่ยนปุ่ม print เดิม → dropdown
    const oldPrint = lastTd.querySelector('[onclick*="PrintReceipt80mm"]');
    if (oldPrint) {
      const dropdown = v14BuildPrintDropdown(billId, hasDel);
      oldPrint.replaceWith(dropdown);
      lastTd.querySelector('.v14-print-dropdown')?.addEventListener('click', e=>e.stopPropagation());
    }
  });
  // ปิด dropdown เมื่อคลิกนอก
  document.removeEventListener('click', v14ClosePrintDropdowns);
  document.addEventListener('click', v14ClosePrintDropdowns);
}

function v14ClosePrintDropdowns() {
  document.querySelectorAll('.v14-print-menu.open').forEach(m=>m.classList.remove('open'));
}

function v14BuildPrintDropdown(billId, hasDel) {
  const wrap = document.createElement('div');
  wrap.className = 'v14-print-dropdown';
  wrap.innerHTML = `
    <button class="v12-bmc-action-btn" onclick="v14TogglePrintMenu(this)" style="gap:3px;">
      <i class="material-icons-round" style="font-size:13px">print</i> พิมพ์
      <i class="material-icons-round" style="font-size:12px">arrow_drop_down</i>
    </button>
    <div class="v14-print-menu">
      <button class="v14-print-menu-item" onclick="v12PrintReceipt80mm('${billId}');v14ClosePrintDropdowns()">
        <i class="material-icons-round">receipt</i> ใบเสร็จ 80mm
      </button>
      <button class="v14-print-menu-item" onclick="v12PrintReceiptA4('${billId}');v14ClosePrintDropdowns()">
        <i class="material-icons-round">description</i> ใบเสร็จ A4
      </button>
      ${hasDel ? `<button class="v14-print-menu-item" onclick="v12PrintDeliveryNote('${billId}');v14ClosePrintDropdowns()">
        <i class="material-icons-round">local_shipping</i> ใบส่งของ
      </button>` : ''}
      <button class="v14-print-menu-item" onclick="v12PrintDeposit('${billId}');v14ClosePrintDropdowns()">
        <i class="material-icons-round">receipt_long</i> ใบมัดจำ
      </button>
    </div>`;
  return wrap;
}

window.v14TogglePrintMenu = function(btn) {
  v14ClosePrintDropdowns();
  const menu = btn.nextElementSibling;
  if (menu) menu.classList.toggle('open');
};

// Observer สำหรับ inject ใหม่เมื่อ tbody เปลี่ยน
(function watchBMCPrint(){
  const obs=new MutationObserver(()=>{ v14InjectPrintDropdowns(); v13InjectReturnButtons?.(); });
  const try1=()=>{ const el=document.getElementById('page-history')||document.body; obs.observe(el,{childList:true,subtree:true}); };
  try1();
})();


/* ════════════════════════════════════════════════════════════════
   V14-5: PROJECT MANAGEMENT SYSTEM — ระบบโครงการของร้าน
════════════════════════════════════════════════════════════════ */

/* ── Nav Injection ── */
(function injectProjectNav(){
  function tryInject(){
    // หา nav sidebar
    const nav = document.querySelector('.nav-menu, .sidebar-nav, nav[class*="nav"], [class*="sidebar"]');
    if (!nav || document.querySelector('[data-page="projects"]')) { if(!nav) setTimeout(tryInject,800); return; }
    const li = document.createElement('div');
    li.className = 'nav-item'; li.setAttribute('data-page','projects');
    li.setAttribute('onclick', "go('projects')");
    li.innerHTML = `<i class="material-icons-round">business</i><span>โครงการ</span>`;
    // สไตล์เดียวกับ nav-item อื่น
    li.style.cssText = nav.querySelector('.nav-item')?.style?.cssText || '';
    nav.appendChild(li);

    // เพิ่ม page section
    if (!document.getElementById('page-projects')) {
      const sec = document.createElement('section');
      sec.id = 'page-projects'; sec.className = 'page-section hidden';
      document.getElementById('main-content')?.appendChild(sec) ||
      document.querySelector('.main-content, main, .content-area')?.appendChild(sec);
    }
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',tryInject);
  else tryInject();
})();

/* Hook go() */
(function hookProjectNav(){
  function patchGo(){
    if (typeof go!=='function') { setTimeout(patchGo,200); return; }
    const _orig=go;
    window.go=function(page){
      _orig(page);
      if (page==='projects'){
        document.querySelectorAll('.page-section').forEach(s=>s.classList.add('hidden'));
        const sec=document.getElementById('page-projects');
        if (sec) sec.classList.remove('hidden');
        const titleEl=document.getElementById('page-title-text');
        if (titleEl) titleEl.textContent='🏗️ โครงการ';
        document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
        document.querySelector('[data-page="projects"]')?.classList.add('active');
        renderProjects();
      }
    };
  }
  patchGo();
})();

/* ── Project List ── */
window.renderProjects = async function() {
  const sec = document.getElementById('page-projects');
  if (!sec) return;
  sec.innerHTML = `<div class="v14-proj-container">
    <div class="v14-proj-header">
      <div>
        <div class="v14-proj-title"><i class="material-icons-round">business_center</i> โครงการของร้าน</div>
        <div class="v14-proj-subtitle">ติดตามงบประมาณ รายจ่าย และกำไรแต่ละโครงการ</div>
      </div>
      <button class="v14-proj-add-btn" onclick="v14ShowAddProject()">
        <i class="material-icons-round">add</i> เพิ่มโครงการ
      </button>
    </div>
    <div class="v14-proj-stats" id="v14-proj-stats">
      <div class="v14-proj-stat"><div class="lbl">โครงการทั้งหมด</div><div class="val" id="v14-ps-total" style="color:#6366f1;">-</div></div>
      <div class="v14-proj-stat"><div class="lbl">กำลังดำเนินการ</div><div class="val" id="v14-ps-active" style="color:#f59e0b;">-</div></div>
      <div class="v14-proj-stat"><div class="lbl">งบประมาณรวม</div><div class="val" id="v14-ps-budget" style="color:#3b82f6;font-size:16px;">-</div></div>
      <div class="v14-proj-stat"><div class="lbl">กำไรสุทธิรวม</div><div class="val" id="v14-ps-profit" style="font-size:16px;">-</div></div>
    </div>
    <div class="v14-proj-cards" id="v14-proj-cards">
      <div style="text-align:center;padding:40px;color:var(--text-muted);">⏳ กำลังโหลด...</div>
    </div>
  </div>`;
  await v14LoadProjects();
};

async function v14LoadProjects() {
  try {
    const { data: projs } = await db.from('โครงการ').select('*').order('created_at',{ascending:false});
    const list = projs||[];

    // Stats
    const totalBudget = list.reduce((s,p)=>s+p.budget,0);
    const totalProfit = list.reduce((s,p)=>s+(p.budget-p.total_expenses-p.total_goods_cost),0);
    const activeCount = list.filter(p=>p.status==='active').length;
    document.getElementById('v14-ps-total').textContent  = list.length;
    document.getElementById('v14-ps-active').textContent = activeCount;
    document.getElementById('v14-ps-budget').textContent = `฿${v14fmt(totalBudget)}`;
    const profitEl = document.getElementById('v14-ps-profit');
    if (profitEl) { profitEl.textContent=`฿${v14fmt(totalProfit)}`; profitEl.style.color=totalProfit>=0?'#10b981':'#ef4444'; }

    const cards = document.getElementById('v14-proj-cards');
    if (!cards) return;
    if (!list.length) {
      cards.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
        <i class="material-icons-round" style="font-size:64px;display:block;margin-bottom:12px;opacity:.3;">business_center</i>
        <div style="font-size:16px;font-weight:700;">ยังไม่มีโครงการ</div>
        <div style="font-size:13px;margin-top:6px;">กด "เพิ่มโครงการ" เพื่อเริ่มต้น</div>
      </div>`; return;
    }

    cards.innerHTML = list.map(p=>{
      const spent   = (p.total_expenses||0)+(p.total_goods_cost||0);
      const profit  = p.budget - spent;
      const pct     = p.budget>0 ? Math.min(100,Math.round(spent/p.budget*100)) : 0;
      const profitColor = profit>=0?'#10b981':'#ef4444';
      const barColor    = pct>=90?'#ef4444':pct>=70?'#f59e0b':'#6366f1';
      const isComplete  = p.status==='completed';
      return `
      <div class="v14-proj-card" onclick="v14OpenProject('${p.id}')">
        <div class="v14-proj-card-head">
          <div class="v14-proj-icon"><i class="material-icons-round">${isComplete?'check_circle':'construction'}</i></div>
          <div style="flex:1;min-width:0;">
            <div class="v14-proj-name">${p.name}</div>
            <div class="v14-proj-contract">
              ${p.contract_no?`สัญญา #${p.contract_no} · `:'' }
              <span class="v14-status-badge-proj ${isComplete?'v14-badge-complete':'v14-badge-active'}">
                ${isComplete?'✅ เสร็จสิ้น':'🔵 กำลังดำเนินการ'}
              </span>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:11px;color:var(--text-muted);">งบประมาณ</div>
            <div style="font-size:16px;font-weight:800;color:#3b82f6;">฿${v14fmt(p.budget)}</div>
          </div>
        </div>
        <div class="v14-proj-progress-bar"><div class="v14-proj-progress-fill" style="width:${pct}%;background:${barColor};"></div></div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">ใช้ไปแล้ว ${pct}% (฿${v14fmt(spent)} / ฿${v14fmt(p.budget)})</div>
        <div class="v14-proj-nums">
          <div class="v14-proj-num"><div class="n-lbl">💸 รายจ่ายทั่วไป</div><div class="n-val" style="color:#ef4444;">฿${v14fmt(p.total_expenses||0)}</div></div>
          <div class="v14-proj-num"><div class="n-lbl">📦 ต้นทุนสินค้า</div><div class="n-val" style="color:#f59e0b;">฿${v14fmt(p.total_goods_cost||0)}</div></div>
          <div class="v14-proj-num"><div class="n-lbl">${profit>=0?'💰 กำไร':'📉 ขาดทุน'}</div><div class="n-val" style="color:${profitColor};">฿${v14fmt(Math.abs(profit))}</div></div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('[v14] loadProjects:', e);
    const cards = document.getElementById('v14-proj-cards');
    if (cards) cards.innerHTML=`<div style="padding:30px;text-align:center;color:#ef4444;">โหลดไม่สำเร็จ: ${e.message}<br><small>ตรวจสอบว่า run SQL migration แล้ว</small></div>`;
  }
}

/* ── Add Project Modal ── */
window.v14ShowAddProject = function() {
  if (typeof Swal==='undefined') { alert('ต้องการ SweetAlert2'); return; }
  Swal.fire({
    title: '➕ เพิ่มโครงการใหม่',
    html: `<div style="text-align:left;display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px;">ชื่อโครงการ *</label>
        <input id="v14-pname" class="swal2-input" style="margin:0;width:100%;" placeholder="เช่น ก่อสร้างบ้าน นายสมชาย"></div>
      <div><label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px;">เลขที่สัญญา</label>
        <input id="v14-pcontract" class="swal2-input" style="margin:0;width:100%;" placeholder="เช่น CON-2025-001"></div>
      <div><label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px;">งบประมาณโครงการ (บาท) *</label>
        <input id="v14-pbudget" type="number" class="swal2-input" style="margin:0;width:100%;" placeholder="0" min="0"></div>
      <div><label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px;">หมายเหตุ</label>
        <textarea id="v14-pnotes" class="swal2-textarea" style="margin:0;width:100%;height:60px;" placeholder="รายละเอียดเพิ่มเติม..."></textarea></div>
    </div>`,
    confirmButtonText:'บันทึกโครงการ', showCancelButton:true, cancelButtonText:'ยกเลิก',
    confirmButtonColor:'#312e81', focusConfirm:false,
    preConfirm: async ()=>{
      const name   = document.getElementById('v14-pname').value.trim();
      const contr  = document.getElementById('v14-pcontract').value.trim();
      const budget = parseFloat(document.getElementById('v14-pbudget').value||0);
      const notes  = document.getElementById('v14-pnotes').value.trim();
      if (!name) return Swal.showValidationMessage('กรุณาระบุชื่อโครงการ');
      if (!budget||budget<=0) return Swal.showValidationMessage('กรุณาระบุงบประมาณ');
      const { data, error } = await db.from('โครงการ').insert({ name, contract_no:contr||null, budget, notes:notes||null, total_expenses:0, total_goods_cost:0, status:'active' }).select().single();
      if (error) return Swal.showValidationMessage('บันทึกไม่สำเร็จ: '+error.message);
      return data;
    }
  }).then(r=>{ if (r.isConfirmed && r.value) { typeof toast==='function'&&toast(`เพิ่มโครงการ "${r.value.name}" สำเร็จ`,'success'); v14LoadProjects(); } });
};

/* ── Project Detail ── */
window.v14OpenProject = async function(projId) {
  const sec = document.getElementById('page-projects');
  if (!sec) return;
  sec.innerHTML = `<div class="v14-proj-container"><div style="text-align:center;padding:40px;color:var(--text-muted);">⏳ กำลังโหลด...</div></div>`;
  try {
    const [{ data: proj }, { data: exps }] = await Promise.all([
      db.from('โครงการ').select('*').eq('id', projId).single(),
      db.from('รายจ่ายโครงการ').select('*').eq('project_id', projId).order('created_at',{ascending:false})
    ]);
    if (!proj) { sec.innerHTML='<div style="padding:30px;text-align:center;">ไม่พบโครงการ</div>'; return; }

    const spent   = (proj.total_expenses||0)+(proj.total_goods_cost||0);
    const profit  = proj.budget - spent;
    const pct     = proj.budget>0 ? Math.min(100,Math.round(spent/proj.budget*100)) : 0;
    const isComplete = proj.status==='completed';
    const profitColor = profit>=0?'#10b981':'#ef4444';

    sec.innerHTML = `<div class="v14-proj-container">
      <!-- Back button -->
      <button onclick="renderProjects()" style="border:1.5px solid var(--border,#e5e7eb);border-radius:10px;padding:8px 16px;background:#fff;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;margin-bottom:16px;font-family:inherit;">
        <i class="material-icons-round" style="font-size:16px;">arrow_back</i> กลับรายการโครงการ
      </button>

      <!-- Header -->
      <div class="v14-proj-detail-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">
              ${proj.contract_no?`สัญญา #${proj.contract_no} · `:''}โครงการ
            </div>
            <div style="font-size:22px;font-weight:900;">${proj.name}</div>
            <div style="margin-top:8px;">
              <span class="v14-status-badge-proj ${isComplete?'v14-badge-complete':'v14-badge-active'}">${isComplete?'✅ เสร็จสิ้น':'🔵 กำลังดำเนินการ'}</span>
            </div>
          </div>
          ${!isComplete ? `<div style="display:flex;gap:8px;">
            <button onclick="v14AddExpense('${projId}')" style="background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.3);color:#fff;border-radius:10px;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;font-family:inherit;">
              <i class="material-icons-round" style="font-size:16px;">add</i> เพิ่มรายจ่าย
            </button>
            <button onclick="v14CompleteProject('${projId}')" style="background:#22c55e;border:none;color:#fff;border-radius:10px;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;font-family:inherit;">
              <i class="material-icons-round" style="font-size:16px;">check_circle</i> เสร็จสิ้นโครงการ
            </button>
          </div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
          <div style="background:rgba(255,255,255,.1);border-radius:12px;padding:14px;">
            <div style="font-size:11px;color:rgba(255,255,255,.6);">งบประมาณ</div>
            <div style="font-size:20px;font-weight:900;margin-top:4px;">฿${v14fmt(proj.budget)}</div>
          </div>
          <div style="background:rgba(255,255,255,.1);border-radius:12px;padding:14px;">
            <div style="font-size:11px;color:rgba(255,255,255,.6);">รายจ่ายทั่วไป</div>
            <div style="font-size:20px;font-weight:900;margin-top:4px;color:#fca5a5;">฿${v14fmt(proj.total_expenses||0)}</div>
          </div>
          <div style="background:rgba(255,255,255,.1);border-radius:12px;padding:14px;">
            <div style="font-size:11px;color:rgba(255,255,255,.6);">ต้นทุนสินค้า</div>
            <div style="font-size:20px;font-weight:900;margin-top:4px;color:#fde68a;">฿${v14fmt(proj.total_goods_cost||0)}</div>
          </div>
          <div style="background:${profit>=0?'rgba(34,197,94,.2)':'rgba(239,68,68,.2)'};border-radius:12px;padding:14px;border:1.5px solid ${profit>=0?'rgba(34,197,94,.4)':'rgba(239,68,68,.4)'};">
            <div style="font-size:11px;color:rgba(255,255,255,.7);">${profit>=0?'💰 กำไร':'📉 ขาดทุน'}</div>
            <div style="font-size:20px;font-weight:900;margin-top:4px;color:${profit>=0?'#86efac':'#fca5a5'};">฿${v14fmt(Math.abs(profit))}</div>
          </div>
        </div>

        <div style="margin-top:14px;">
          <div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:6px;">ความคืบหน้าการใช้งบ</div>
          <div style="height:10px;background:rgba(255,255,255,.2);border-radius:99px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${pct>=90?'#ef4444':pct>=70?'#f59e0b':'#22c55e'};border-radius:99px;transition:width .4s;"></div>
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:4px;">ใช้ไปแล้ว ${pct}% (฿${v14fmt(spent)} / ฿${v14fmt(proj.budget)})</div>
        </div>
      </div>

      <!-- Expense List -->
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <i class="material-icons-round" style="font-size:18px;color:#6366f1;">receipt_long</i>
        รายการค่าใช้จ่าย (${(exps||[]).length} รายการ)
      </div>
      <div class="v14-expense-list" id="v14-exp-list">
        ${(exps||[]).length===0 ? `<div style="text-align:center;padding:40px;color:var(--text-muted);">
          <i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:8px;opacity:.3;">receipt</i>
          ยังไม่มีรายจ่าย — กด "เพิ่มรายจ่าย" ด้านบน
        </div>` : (exps||[]).map(ex=>{
          const isGoods = ex.type==='goods';
          return `<div class="v14-expense-row">
            <div class="v14-expense-icon" style="background:${isGoods?'#dbeafe':'#fee2e2'};">
              <i class="material-icons-round" style="font-size:18px;color:${isGoods?'#1d4ed8':'#dc2626'};">${isGoods?'inventory_2':'payments'}</i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:13px;">${ex.description}</div>
              <div style="font-size:11px;color:var(--text-muted);">
                <span class="v14-status-badge-proj ${isGoods?'v14-badge-goods':'v14-badge-expense'}">${isGoods?'📦 สินค้าจากร้าน':'💸 รายจ่าย'}</span>
                · ${ex.category} · ${new Date(ex.created_at).toLocaleDateString('th-TH')}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:16px;font-weight:800;color:${isGoods?'#f59e0b':'#ef4444'};">฿${v14fmt(ex.amount)}</div>
            </div>
            <button onclick="v14DeleteExpense('${ex.id}','${projId}',${ex.amount},${isGoods?'true':'false'})"
              style="border:1.5px solid #fee2e2;border-radius:8px;padding:6px;background:#fff;cursor:pointer;color:#ef4444;display:flex;align-items:center;">
              <i class="material-icons-round" style="font-size:16px;">delete_outline</i>
            </button>
          </div>`;
        }).join('')}
      </div>

      ${proj.notes?`<div style="margin-top:16px;background:#f8fafc;border-radius:12px;padding:14px 16px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:4px;">📝 หมายเหตุ</div>
        <div style="font-size:13px;color:var(--text-primary);">${proj.notes}</div>
      </div>`:''}
    </div>`;
  } catch(e) {
    sec.innerHTML=`<div style="padding:30px;text-align:center;color:#ef4444;">โหลดไม่สำเร็จ: ${e.message}</div>`;
  }
};

/* ── Add Expense ── */
window.v14AddExpense = function(projId) {
  Swal.fire({
    title:'➕ เพิ่มรายจ่ายโครงการ',
    html:`<div style="text-align:left;display:flex;flex-direction:column;gap:10px;">
      <div><label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px;">รายละเอียด *</label>
        <input id="v14-edesc" class="swal2-input" style="margin:0;width:100%;" placeholder="เช่น ค่าแรงงาน, ค่าเช่าแมคโคร"></div>
      <div><label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px;">หมวดหมู่</label>
        <select id="v14-ecat" class="swal2-select" style="margin:0;width:100%;">
          <option>ทั่วไป</option><option>ค่าแรง</option><option>ขนส่ง</option>
          <option>เช่าอุปกรณ์</option><option>อื่นๆ</option>
        </select></div>
      <div><label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px;">จำนวนเงิน (บาท) *</label>
        <input id="v14-eamt" type="number" class="swal2-input" style="margin:0;width:100%;" min="0" placeholder="0"></div>
      <div><label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px;">หมายเหตุ</label>
        <input id="v14-enotes" class="swal2-input" style="margin:0;width:100%;" placeholder="(ไม่บังคับ)"></div>
    </div>`,
    confirmButtonText:'บันทึก', showCancelButton:true, cancelButtonText:'ยกเลิก',
    confirmButtonColor:'#dc2626', focusConfirm:false,
    preConfirm: async ()=>{
      const desc   = document.getElementById('v14-edesc').value.trim();
      const cat    = document.getElementById('v14-ecat').value;
      const amount = parseFloat(document.getElementById('v14-eamt').value||0);
      const notes  = document.getElementById('v14-enotes').value.trim();
      if (!desc) return Swal.showValidationMessage('กรุณาระบุรายละเอียด');
      if (!amount||amount<=0) return Swal.showValidationMessage('กรุณาระบุจำนวนเงิน');
      // Insert expense
      const { error: eErr } = await db.from('รายจ่ายโครงการ').insert({ project_id:projId, description:desc, category:cat, amount, type:'expense', notes:notes||null });
      if (eErr) return Swal.showValidationMessage('บันทึกไม่สำเร็จ: '+eErr.message);
      // Update project total_expenses
      const { data: p } = await db.from('โครงการ').select('total_expenses').eq('id',projId).single();
      await db.from('โครงการ').update({ total_expenses:(p?.total_expenses||0)+amount }).eq('id',projId);
      return { desc, amount };
    }
  }).then(r=>{ if(r.isConfirmed) { typeof toast==='function'&&toast('บันทึกรายจ่ายสำเร็จ','success'); v14OpenProject(projId); } });
};

/* ── Delete Expense ── */
window.v14DeleteExpense = async function(expId, projId, amount, isGoods) {
  if (!confirm('ลบรายจ่ายนี้?')) return;
  try {
    await db.from('รายจ่ายโครงการ').delete().eq('id',expId);
    const { data: p } = await db.from('โครงการ').select('total_expenses,total_goods_cost').eq('id',projId).single();
    if (isGoods) await db.from('โครงการ').update({ total_goods_cost:Math.max(0,(p?.total_goods_cost||0)-amount) }).eq('id',projId);
    else         await db.from('โครงการ').update({ total_expenses:   Math.max(0,(p?.total_expenses||0)-amount)  }).eq('id',projId);
    typeof toast==='function'&&toast('ลบรายจ่ายสำเร็จ','success');
    v14OpenProject(projId);
  } catch(e) { typeof toast==='function'&&toast('ลบไม่สำเร็จ: '+e.message,'error'); }
};

/* ── Complete Project → เพิ่มรายได้ร้าน ── */
window.v14CompleteProject = async function(projId) {
  const { data: proj } = await db.from('โครงการ').select('*').eq('id',projId).single();
  if (!proj) return;
  const spent  = (proj.total_expenses||0)+(proj.total_goods_cost||0);
  const profit = proj.budget - spent;
  const r = await Swal.fire({
    title:'🏁 เสร็จสิ้นโครงการ?',
    html:`<div style="text-align:left;">
      <div style="background:#f8f4ff;border-radius:12px;padding:14px;margin-bottom:14px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:8px;">${proj.name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
          <div>งบประมาณ: <strong>฿${v14fmt(proj.budget)}</strong></div>
          <div>ค่าใช้จ่ายรวม: <strong>฿${v14fmt(spent)}</strong></div>
          <div style="color:${profit>=0?'#10b981':'#ef4444'};grid-column:1/-1;font-size:15px;font-weight:800;">
            ${profit>=0?'กำไร':'ขาดทุน'}: ฿${v14fmt(Math.abs(profit))}
          </div>
        </div>
      </div>
      <div style="font-size:13px;color:#5b21b6;background:#ede9fe;border-radius:10px;padding:12px;">
        ⚠️ ระบบจะเพิ่ม <strong>฿${v14fmt(proj.budget)}</strong> เข้ารายได้ร้านค้า<br>
        <small>การดำเนินการนี้ไม่สามารถย้อนกลับได้</small>
      </div>
    </div>`,
    confirmButtonText:'เสร็จสิ้นโครงการ', showCancelButton:true, cancelButtonText:'ยกเลิก',
    confirmButtonColor:'#22c55e',
  });
  if (!r.isConfirmed) return;

  try {
    // Mark project complete
    await db.from('โครงการ').update({ status:'completed', completed_at:new Date().toISOString() }).eq('id',projId);

    // เพิ่มงบประมาณเข้ารายได้ร้าน → บันทึกเป็นบิลพิเศษ
    const staff = (typeof USER!=='undefined'&&USER)?USER.username:'system';
    let billNo = `PRJ-${Date.now().toString().slice(-6)}`;
    try { const { data: last } = await db.from('บิลขาย').select('bill_no').order('bill_no',{ascending:false}).limit(1).maybeSingle(); if(last?.bill_no) billNo = `PRJ-${String(parseInt(last.bill_no)||0).padStart(6,'0')}`; } catch(_){}

    await db.from('บิลขาย').insert({
      date:        new Date().toISOString(),
      bill_no:     billNo,
      method:      'โครงการ',
      total:       proj.budget,
      received:    proj.budget,
      change:      0,
      customer_name: `โครงการ: ${proj.name}`,
      staff_name:  staff,
      status:      'สำเร็จ',
      delivery_mode:'รับเอง', delivery_status:'สำเร็จ',
      deposit_amount:0, discount:0,
      project_id:  projId,
    });

    if (typeof logActivity==='function') logActivity('เสร็จสิ้นโครงการ', `${proj.name} รายได้ ฿${v14fmt(proj.budget)}`, projId, 'โครงการ');
    if (typeof updateHomeStats==='function') updateHomeStats();

    typeof toast==='function'&&toast(`โครงการ "${proj.name}" เสร็จสิ้น — รายได้ ฿${v14fmt(proj.budget)} บันทึกแล้ว`,'success');
    renderProjects();
  } catch(e) {
    typeof toast==='function'&&toast('บันทึกไม่สำเร็จ: '+e.message,'error');
  }
};


/* ════════════════════════════════════════════════════════════════
   Project Checkout Integration
   ── เพิ่ม "โครงการของร้าน" ใน Step 1 ของ Checkout
════════════════════════════════════════════════════════════════ */

/* Override v12S1 เพิ่ม card โครงการ */
const _v14OrigV12S1 = window.v12S1;
window.v12S1 = function(container) {
  container.innerHTML = `
    <h2 class="v12-step-title">เลือกลูกค้า</h2>
    <p class="v12-step-subtitle">เลือกประเภทลูกค้าเพื่อบันทึกบิล</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
      <div class="v12-cust-card ${v12State.customer.type==='general'?'selected':''}" onclick="v13SelectCustType('general')">
        <i class="material-icons-round">shopping_bag</i><h4>ลูกค้าทั่วไป</h4><p>ไม่ระบุข้อมูล</p>
      </div>
      <div class="v12-cust-card ${v12State.customer.type==='member'?'selected':''}" onclick="v13SelectCustType('member')">
        <i class="material-icons-round">star</i><h4>ลูกค้าประจำ</h4><p>เลือกจากรายชื่อ</p>
      </div>
      <div class="v12-cust-card ${v12State.customer.type==='new'?'selected':''}" onclick="v13SelectCustType('new')">
        <i class="material-icons-round">person_add</i><h4>เพิ่มใหม่</h4><p>สร้างข้อมูลใหม่</p>
      </div>
      <div class="v14-proj-cust-card ${v12State.customer.type==='project'?'selected':''}" onclick="v14SelectProjectType()">
        <i class="material-icons-round">business_center</i><h4>โครงการร้าน</h4><p>บังคับค้างเครดิต</p>
      </div>
    </div>
    <div id="v12-cust-form"></div>
    ${v12State.customer.type==='general' ? `<div class="v13-general-fast"><i class="material-icons-round">flash_on</i><p>ลูกค้าทั่วไป — กด <strong>ถัดไป</strong> เพื่อข้ามไปชำระเงิน ⚡</p></div>` : ''}`;

  if (typeof v13RenderCustForm==='function') v13RenderCustForm(document.getElementById('v12-cust-form'));
};

window.v14SelectProjectType = async function() {
  // โหลดรายชื่อโครงการ active
  try {
    const { data: projs } = await db.from('โครงการ').select('id,name,budget,total_expenses,total_goods_cost').eq('status','active').order('name');
    if (!projs?.length) {
      typeof toast==='function'&&toast('ไม่มีโครงการที่กำลังดำเนินการ — กรุณาเพิ่มโครงการก่อน','warning'); return;
    }
    v12State.customer.type = 'project';
    document.querySelectorAll('.v12-cust-card').forEach(c=>c.classList.remove('selected'));
    document.querySelectorAll('.v14-proj-cust-card').forEach(c=>c.classList.add('selected'));

    const form = document.getElementById('v12-cust-form');
    if (form) {
      form.innerHTML = `<div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:14px;padding:16px;margin-top:8px;">
        <div style="font-size:13px;font-weight:700;color:#3730a3;margin-bottom:10px;">
          <i class="material-icons-round" style="font-size:16px;vertical-align:middle;">business</i> เลือกโครงการ *
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;" id="v14-proj-selector">
          ${projs.map(p=>{
            const spent = (p.total_expenses||0)+(p.total_goods_cost||0);
            const rem   = p.budget-spent;
            return `<div onclick="v14PickProject('${p.id}','${(p.name||'').replace(/'/g,"\\'")}',${p.budget})"
              style="padding:12px 14px;border-radius:10px;cursor:pointer;border:2px solid transparent;
                background:var(--bg-secondary,#f9fafb);transition:all .12s;"
              id="v14-pcard-${p.id}"
              onmouseover="this.style.borderColor='#6366f1'" onmouseout="this.style.borderColor='transparent'">
              <div style="font-weight:700;font-size:13px;">${p.name}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                งบเหลือ: <strong style="color:#10b981;">฿${v14fmt(Math.max(0,rem))}</strong> / ฿${v14fmt(p.budget)}
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="margin-top:10px;background:#fffbeb;border-radius:10px;padding:10px 12px;font-size:12px;color:#92400e;">
          ⚠️ บิลโครงการจะบังคับ <strong>ค้างชำระ</strong> และหักต้นทุนสินค้าไปยังโครงการ<br>
          รายได้จะรับรู้เมื่อ "เสร็จสิ้นโครงการ" เท่านั้น
        </div>
      </div>`;
    }
  } catch(e) { typeof toast==='function'&&toast('โหลดโครงการไม่สำเร็จ: '+e.message,'error'); }
};

window.v14PickProject = function(id, name, budget) {
  v12State.customer.id      = null;
  v12State.customer.name    = `[โครงการ] ${name}`;
  v12State.customer.project_id = id;
  v12State.customer.project_name = name;
  v12State.customer.project_budget = budget;
  // Force method to debt on step 4
  v12State._forceDebt = true;

  document.querySelectorAll('[id^="v14-pcard-"]').forEach(c=>{
    c.style.borderColor='transparent'; c.style.background='var(--bg-secondary,#f9fafb)';
  });
  const sel = document.getElementById(`v14-pcard-${id}`);
  if (sel) { sel.style.borderColor='#6366f1'; sel.style.background='#eef2ff'; }
  typeof toast==='function' && toast(`เลือกโครงการ: ${name}`,'success');
};

/* Override v13SelectCustType เพื่อ reset project state */
const _v14OrigSelectCustType = window.v13SelectCustType;
window.v13SelectCustType = function(type) {
  v12State.customer.project_id = null;
  v12State.customer.project_name = null;
  v12State._forceDebt = false;
  _v14OrigSelectCustType?.(type);
};

/* Override v12S4 — force debt card สำหรับโครงการ */
const _v14OrigV12S4 = window.v12S4;
window.v12S4 = function(container) {
  // ถ้าเป็น project type → set method = debt ทันที
  if (v12State.customer.type==='project' || v12State._forceDebt) {
    v12State.method = 'debt';
  }
  _v14OrigV12S4?.(container);
  // ถ้าโครงการ → disable method cards อื่น + แสดงข้อความ
  if (v12State.customer.type==='project') {
    setTimeout(()=>{
      document.querySelectorAll('.v12-method-card,.v13-method-card-debt').forEach(c=>{
        c.style.opacity='.35'; c.style.pointerEvents='none';
      });
      const debtCard = document.querySelector('.v13-method-card-debt');
      if (debtCard) { debtCard.style.opacity='1'; debtCard.style.pointerEvents='auto'; debtCard.classList.add('selected'); }
      const info = document.getElementById('v13-method-info');
      if (info) info.innerHTML=`<div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:14px;padding:14px;">
        <div style="font-weight:700;color:#3730a3;margin-bottom:6px;">🏗️ บิลโครงการ</div>
        <div style="font-size:13px;color:#4338ca;line-height:1.7;">
          โครงการ: <strong>${v12State.customer.project_name}</strong><br>
          ยอด: <strong>฿${v14fmt(v12State.total)}</strong> จะบันทึกเป็นค้างชำระ<br>
          ต้นทุนสินค้าจะหักไปยังโครงการอัตโนมัติ
        </div>
      </div>`;
    }, 50);
  }
};

/* Override v13CompletePayment สำหรับโครงการ */
const _v14OrigCompletePayment = window.v12CompletePayment;
window.v12CompletePayment = async function() {
  if (!(v12State.customer.type==='project' || v12State._forceDebt) || !v12State.customer.project_id) {
    return _v14OrigCompletePayment?.();
  }
  // Project bill
  if (typeof isProcessingPayment!=='undefined'&&isProcessingPayment) return;
  window.isProcessingPayment=true;
  if(typeof v12UpdateStepBar==='function') v12UpdateStepBar();
  if(typeof v12RenderStepBody==='function') v12RenderStepBody();

  try {
    const projId  = v12State.customer.project_id;
    const staff   = (typeof USER!=='undefined'&&USER)?USER.username:'system';
    let billNo = `B-${Date.now().toString().slice(-6)}`;
    try {
      const {data:last}=await db.from('บิลขาย').select('bill_no').order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(last?.bill_no&&/^\d+$/.test(String(last.bill_no))) billNo=String(parseInt(last.bill_no)+1).padStart(6,'0');
    } catch(_){}

    const { data: bill, error: billErr } = await db.from('บิลขาย').insert({
      date:           new Date().toISOString(),
      bill_no:        billNo,
      method:         'ค้างชำระ',
      total:          v12State.total,
      received:       0, change:0, discount:v12State.discount||0,
      customer_name:  `[โครงการ] ${v12State.customer.project_name}`,
      customer_id:    null,
      project_id:     projId,
      staff_name:     staff,
      status:         'ค้างชำระ',
      denominations:{}, change_denominations:{},
      delivery_mode:'รับเอง', delivery_status:'สำเร็จ', deposit_amount:0,
    }).select().single();
    if (billErr) throw billErr;

    // Insert items + deduct stock + record project goods cost
    let totalCost = 0;
    for (const item of (typeof cart!=='undefined'?cart:[])) {
      const modes = v12State.itemModes?.[item.id] || { take:item.qty, deliver:0 };
      await db.from('รายการในบิล').insert({
        bill_id:bill.id, product_id:item.id, name:item.name,
        qty:item.qty, price:item.price, cost:item.cost||0,
        total:item.price*item.qty, unit:item.unit||'ชิ้น',
        take_qty:modes.take, deliver_qty:modes.deliver,
      });
      // หักสต็อก (ไม่คิด multiplier แบบเก่า — ใช้ qty ตรง)
      if (modes.take > 0) {
        const prod = (typeof products!=='undefined') ? products.find(p=>p.id===item.id) : null;
        const sb   = parseFloat(prod?.stock||0);
        const sa   = parseFloat((sb-modes.take).toFixed(6));
        await db.from('สินค้า').update({stock:sa}).eq('id',item.id);
        if (prod) prod.stock=sa;
        const itemCost = (item.cost||0)*modes.take;
        totalCost += itemCost;
        try {
          await db.from('stock_movement').insert({
            product_id:item.id, product_name:item.name,
            type:'โครงการ', direction:'out', qty:modes.take,
            stock_before:sb, stock_after:sa,
            ref_id:bill.id, ref_table:'บิลขาย', staff_name:staff
          });
        } catch(_){}
      }
    }

    // Record goods cost in project expenses
    if (totalCost > 0) {
      const cartNames = (typeof cart!=='undefined'?cart:[]).map(i=>`${i.name} ×${i.qty}`).join(', ');
      await db.from('รายจ่ายโครงการ').insert({
        project_id:projId, description:`สินค้าจากร้าน: ${cartNames}`,
        amount:totalCost, category:'สินค้า', type:'goods', bill_id:bill.id, notes:`บิล #${bill.bill_no}`
      });
      const {data:p}=await db.from('โครงการ').select('total_goods_cost').eq('id',projId).single();
      await db.from('โครงการ').update({ total_goods_cost:(p?.total_goods_cost||0)+totalCost }).eq('id',projId);
    }

    if(typeof logActivity==='function') logActivity('ขายโครงการ',`บิล #${bill.bill_no} โครงการ ${v12State.customer.project_name} ฿${v14fmt(v12State.total)} (cost ฿${v14fmt(totalCost)})`,bill.id,'บิลขาย');
    if(typeof sendToDisplay==='function') sendToDisplay({type:'thanks',billNo:bill.bill_no,total:v12State.total});

    v12State.savedBill = bill;
    if(typeof cart!=='undefined') window.cart=[];
    if(typeof loadProducts==='function') await loadProducts();
    if(typeof renderCart==='function') renderCart();
    if(typeof renderProductGrid==='function') renderProductGrid();
    if(typeof updateHomeStats==='function') updateHomeStats();
    if(typeof v12UpdateStepBar==='function') v12UpdateStepBar();
    if(typeof v12RenderStepBody==='function') v12RenderStepBody();
  } catch(e) {
    console.error('[v14] project payment:', e);
    if(typeof toast==='function') toast('ผิดพลาด: '+e.message,'error');
    v12State.step=4;
    if(typeof v12UpdateUI==='function') v12UpdateUI();
  } finally { window.isProcessingPayment=false; }
};


/* ════════════════════════════════════════════════════════════════
   BOOT LOG
════════════════════════════════════════════════════════════════ */
console.info(
  '%c[modules-v14.js] ✅%c Cash Drawer | Debt Fix | DQ Conv | BMC Print | Project System',
  'color:#4338CA;font-weight:700','color:#6B7280'
);
