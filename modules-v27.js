/**
 * SK POS — modules-v21.js (โหลดหลัง modules-v20.js)
 * ════════════════════════════════════════════════════════════════════
 *  V21-1  CASH DRAWER REDESIGN  — หน้าลิ้นชักเงินสดใหม่ทั้งหมด
 *         • ดีไซน์แบงค์/เหรียญสมจริง สไตล์ Physical Drawer
 *         • 3 โหมด: ขายเงินสด | รายจ่าย | เบิกเงิน
 *         • เอฟเฟค animation แบงค์วิ่งเข้า-ออก
 *         • นับแบงค์รับ/ทอน/จ่าย แยกชัดเจน
 *
 *  V21-2  PAYROLL UNLIMITED PAY — จ่ายเงินเดือนซ้ำได้ไม่จำกัด
 *         • ลบ lock "จ่ายแล้ว" ออก
 *         • แสดงประวัติจ่ายเดือนนี้ + หักลบเพดานอัตโนมัติ
 *         • คำนวณยอดคงเหลือแม่นยำ
 * ════════════════════════════════════════════════════════════════════
 */
'use strict';
console.log('[v21] Loading modules-v21.js — Cash Drawer Redesign + Payroll Fix');

/* ─── Safe helpers ──────────────────────────────────────────────── */
const _v21fmt = n => typeof formatNum === 'function'
  ? formatNum(n) : Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const _v21Staff = () => window.USER?.username || 'พนักงาน';

/* ─── Denomination definitions ─────────────────────────────────── */
const V21_BILLS = [
  { value: 1000, label: '1,000', color: '#6b4c9a', bg: 'linear-gradient(145deg,#3b0764,#7c3aed)', thaiColor: 'น้ำตาล' },
  { value: 500,  label: '500',   color: '#16a34a', bg: 'linear-gradient(145deg,#052e16,#16a34a)', thaiColor: 'เขียว' },
  { value: 100,  label: '100',   color: '#dc2626', bg: 'linear-gradient(145deg,#7f1d1d,#dc2626)', thaiColor: 'แดง' },
  { value: 50,   label: '50',    color: '#2563eb', bg: 'linear-gradient(145deg,#1e3a8a,#2563eb)', thaiColor: 'น้ำเงิน' },
  { value: 20,   label: '20',    color: '#15803d', bg: 'linear-gradient(145deg,#14532d,#15803d)', thaiColor: 'เขียวอ่อน' },
];
const V21_COINS = [
  { value: 10,   label: '10',   color: '#d97706', bg: 'linear-gradient(145deg,#78350f,#d97706)' },
  { value: 5,    label: '5',    color: '#6b7280', bg: 'linear-gradient(145deg,#374151,#6b7280)' },
  { value: 2,    label: '2',    color: '#ca8a04', bg: 'linear-gradient(145deg,#92400e,#ca8a04)' },
  { value: 1,    label: '1',    color: '#4b5563', bg: 'linear-gradient(145deg,#1f2937,#4b5563)' },
];
const V21_ALL = [...V21_BILLS, ...V21_COINS];

/* ═══════════════════════════════════════════════════════════════════
   V21-1 : CSS INJECTION
═══════════════════════════════════════════════════════════════════ */
(function v21InjectCSS() {
  document.getElementById('v21-css')?.remove();
  const s = document.createElement('style');
  s.id = 'v21-css';
  s.textContent = `
/* ─── Cash Drawer Body ─── */
.v21-drawer-wrap {
  max-width: 1200px; margin: 0 auto; padding: 0 8px;
}
.v21-drawer-outer {
  background: #3e2723; padding: 8px; border-radius: 28px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.05);
  border: 3px solid #2e150b;
}
.v21-drawer-inner {
  background: linear-gradient(180deg, #d7ccc8 0%, #c4b5ab 100%);
  padding: 24px; border-radius: 22px;
}

/* ─── Header Banner ─── */
.v21-banner {
  background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
  border-radius: 18px; padding: 20px 24px; margin-bottom: 20px;
  color: #fff; display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 12px; position: relative; overflow: hidden;
}
.v21-banner::before {
  content:''; position:absolute; top:-40px; right:-20px;
  width:150px; height:150px; border-radius:50%;
  background:rgba(255,255,255,0.07);
}
.v21-banner h2 { font-size:20px; font-weight:800; display:flex; align-items:center; gap:8px; }
.v21-banner-bal { font-size:28px; font-weight:900; letter-spacing:-1px; }
.v21-banner-sub { font-size:12px; opacity:0.8; }

/* ─── Mode Tabs ─── */
.v21-mode-tabs {
  display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center;
}
.v21-mode-tab {
  padding: 12px 24px; border-radius: 14px; font-size: 14px; font-weight: 700;
  border: 2px solid rgba(0,0,0,0.1); cursor: pointer; transition: all 0.25s;
  background: rgba(255,255,255,0.6); color: #5d4037; display: flex; align-items: center; gap: 8px;
  font-family: inherit; backdrop-filter: blur(4px);
}
.v21-mode-tab:hover { background: rgba(255,255,255,0.85); transform: translateY(-2px); }
.v21-mode-tab.active { background: #dc2626; color: #fff; border-color: #dc2626; box-shadow: 0 6px 20px rgba(220,38,38,0.3); }
.v21-mode-tab i { font-size: 20px; }

/* ─── Section Label ─── */
.v21-sec-label {
  display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
}
.v21-sec-label h3 {
  font-size: 14px; font-weight: 800; color: #4e342e; text-transform: uppercase; letter-spacing: 2px;
}
.v21-sec-label .line { flex:1; height:1px; background: #4e342e33; }

/* ─── Bill Compartment ─── */
.v21-bill-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
@media (max-width: 768px) { .v21-bill-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 480px) { .v21-bill-grid { grid-template-columns: repeat(2, 1fr); } }

.v21-bill-comp {
  background: #efebe9; border-radius: 16px; padding: 16px 12px 12px;
  border-bottom: 4px solid #a1887f; display: flex; flex-direction: column;
  align-items: center; position: relative; overflow: visible; cursor: pointer;
  transition: all 0.2s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
}
.v21-bill-comp:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
.v21-bill-comp:active { transform: scale(0.96); }
.v21-bill-comp .count-badge {
  position: absolute; top: 6px; right: 6px; min-width: 24px; height: 20px;
  border-radius: 10px; font-size: 11px; font-weight: 800; color: #fff;
  display: flex; align-items: center; justify-content: center; padding: 0 6px;
  z-index: 5; transition: all 0.3s;
}
.v21-bill-comp .count-badge.zero { opacity: 0.4; }

/* Bill visual */
.v21-bill-visual {
  width: 100%; max-width: 100px; aspect-ratio: 5/3; border-radius: 10px;
  display: flex; align-items: flex-end; justify-content: flex-end; padding: 6px;
  position: relative; overflow: hidden; margin-bottom: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 2px solid rgba(255,255,255,0.25);
}
.v21-bill-visual span {
  color: rgba(255,255,255,0.5); font-weight: 900; font-size: 20px; position: relative; z-index: 1;
}
.v21-bill-visual::before {
  content:''; position:absolute; inset: 0 0 auto 0; height: 20%; background: rgba(255,255,255,0.12);
}

.v21-bill-name { font-size: 12px; font-weight: 800; color: #5d4037; text-transform: uppercase; }
.v21-bill-avail { font-size: 10px; color: #5d4037aa; font-style: italic; }

/* ─── Coin Tray ─── */
.v21-coin-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
@media (max-width: 640px) { .v21-coin-grid { grid-template-columns: repeat(2, 1fr); } }

.v21-coin-comp {
  background: #efebe9; border-radius: 16px; padding: 14px 10px 10px;
  border-bottom: 4px solid #a1887f; display: flex; flex-direction: column;
  align-items: center; position: relative; cursor: pointer; transition: all 0.2s;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
}
.v21-coin-comp:hover { transform: translateY(-2px); }
.v21-coin-comp:active { transform: scale(0.96); }
.v21-coin-comp .count-badge {
  position: absolute; top: 4px; right: 4px; min-width: 20px; height: 18px;
  border-radius: 9px; font-size: 10px; font-weight: 800; color: #fff;
  display: flex; align-items: center; justify-content: center; padding: 0 5px; z-index: 5;
}
.v21-coin-visual {
  width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-weight: 900; font-size: 16px; color: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); margin-bottom: 8px;
  border: 3px solid rgba(255,255,255,0.3);
}
.v21-coin-name { font-size: 11px; font-weight: 800; color: #5d4037; }
.v21-coin-avail { font-size: 9px; color: #5d4037aa; font-style: italic; }

/* ─── Summary Bar ─── */
.v21-summary {
  background: #fff; border-radius: 16px; padding: 16px 20px; margin-top: 20px;
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
  border: 2px solid #e8e0dc; box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}
.v21-sum-cell { text-align: center; }
.v21-sum-cell .lbl { font-size: 11px; color: #8d6e63; font-weight: 600; text-transform: uppercase; }
.v21-sum-cell .val { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }

/* ─── Action Buttons ─── */
.v21-actions {
  display: flex; gap: 12px; margin-top: 16px; justify-content: center; flex-wrap: wrap;
}
.v21-btn {
  padding: 14px 32px; border-radius: 14px; font-size: 15px; font-weight: 700;
  border: none; cursor: pointer; transition: all 0.25s; display: flex; align-items: center; gap: 8px;
  font-family: inherit;
}
.v21-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.v21-btn-primary { background: linear-gradient(135deg, #dc2626, #b91c1c); color: #fff; box-shadow: 0 6px 20px rgba(220,38,38,0.3); }
.v21-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(220,38,38,0.4); }
.v21-btn-secondary { background: #efebe9; color: #5d4037; border: 2px solid #d7ccc8; }
.v21-btn-secondary:hover { background: #d7ccc8; }

/* ─── Flying Bill Animation ─── */
@keyframes v21-fly-in {
  0%   { transform: translateY(-80px) rotate(-15deg) scale(0.3); opacity: 0; }
  50%  { transform: translateY(10px) rotate(5deg) scale(1.1); opacity: 1; }
  100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
}
@keyframes v21-fly-out {
  0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
  50%  { transform: translateY(-30px) rotate(-10deg) scale(1.05); opacity: 0.8; }
  100% { transform: translateY(80px) rotate(15deg) scale(0.3); opacity: 0; }
}
.v21-anim-in { animation: v21-fly-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.v21-anim-out { animation: v21-fly-out 0.35s cubic-bezier(0.55,0.06,0.68,0.19) forwards; }
.v21-bill-comp.pulse { animation: v21-pulse 0.3s ease; }
@keyframes v21-pulse { 0%{box-shadow:0 0 0 0 rgba(220,38,38,0.4)} 70%{box-shadow:0 0 0 12px rgba(220,38,38,0)} 100%{box-shadow:0 0 0 0 rgba(220,38,38,0)} }

/* ─── Float Label for Denomination Count ─── */
.v21-float-num {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  font-size: 32px; font-weight: 900; color: #dc2626; pointer-events: none;
  animation: v21-float 0.6s ease-out forwards; z-index: 50;
}
@keyframes v21-float {
  0%   { opacity:1; transform: translate(-50%,-50%) scale(1.5); }
  100% { opacity:0; transform: translate(-50%,-120%) scale(0.8); }
}

/* ─── Quick Cash Session Buttons ─── */
.v21-session-bar {
  display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center;
}
.v21-session-btn {
  padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 700;
  border: 2px solid; cursor: pointer; display: flex; align-items: center; gap: 6px;
  transition: all 0.2s; font-family: inherit; background: rgba(255,255,255,0.7);
}
.v21-session-btn:hover { transform: translateY(-1px); }

/* ─── Payroll Fix Styles ─── */
.v21-pay-history {
  background: #fef3c7; border: 2px solid #fbbf24; border-radius: 12px;
  padding: 14px 18px; margin-bottom: 16px;
}
.v21-pay-history h4 { font-size: 13px; font-weight: 700; color: #92400e; margin: 0 0 8px; display: flex; align-items: center; gap: 6px; }
.v21-pay-history-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0; border-bottom: 1px dashed #fcd34d; font-size: 13px;
}
.v21-pay-history-row:last-child { border-bottom: none; }
.v21-pay-ceil {
  background: #dcfce7; border: 2px solid #86efac; border-radius: 12px;
  padding: 14px 18px; margin-bottom: 16px; text-align: center;
}
.v21-pay-ceil .val { font-size: 26px; font-weight: 900; color: #15803d; }
.v21-pay-ceil .lbl { font-size: 12px; color: #166534; }

/* Transaction History Improvements */
.v21-tx-list { max-height: 400px; overflow-y: auto; }
.v21-tx-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9; transition: background 0.15s;
}
.v21-tx-item:hover { background: #f8fafc; }
.v21-tx-icon {
  width: 36px; height: 36px; border-radius: 10px; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
}
.v21-tx-icon.in { background: #dcfce7; color: #16a34a; }
.v21-tx-icon.out { background: #fee2e2; color: #dc2626; }
`;
  document.head.appendChild(s);
})();


/* ═══════════════════════════════════════════════════════════════════
   V21-1 : STATE MANAGEMENT
═══════════════════════════════════════════════════════════════════ */
if (!window.v21State) window.v21State = {};
window.v21State = {
  mode: 'sell',        // 'sell' | 'expense' | 'withdraw'
  denoms: {},          // denomination → count being entered
  drawerDenoms: {},    // current drawer state
  session: null,
  balance: 0,
};

function v21ResetDenoms() {
  V21_ALL.forEach(d => { window.v21State.denoms[d.value] = 0; });
}
v21ResetDenoms();


/* ═══════════════════════════════════════════════════════════════════
   V21-1 : DRAWER DENOMINATION CALCULATION (from session + transactions)
═══════════════════════════════════════════════════════════════════ */
async function v21GetDrawerState() {
  const drawer = {};
  V21_ALL.forEach(d => { drawer[d.value] = 0; });
  let balance = 0, session = null;
  try {
    const { data: sess } = await db.from('cash_session').select('*')
      .eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
    if (!sess) return { drawer, balance: 0, session: null };
    session = sess;
    balance = sess.opening_amt || 0;

    // Opening denominations
    const od = sess.opening_denominations || sess.denominations || {};
    Object.entries(od).forEach(([v, c]) => {
      const k = Number(v); if (drawer[k] !== undefined) drawer[k] += Number(c) || 0;
    });

    // Transactions
    const { data: txns } = await db.from('cash_transaction')
      .select('direction,denominations,change_denominations,net_amount,change_amt')
      .eq('session_id', sess.id);

    (txns || []).forEach(tx => {
      balance += tx.direction === 'in' ? tx.net_amount : -tx.net_amount;
      const den = tx.denominations || {};
      let chg = tx.change_denominations || {};

      // Fallback auto-calc change denoms
      if (!Object.values(chg).some(v => v > 0)) {
        const chgAmt = Number(tx.change_amt || 0);
        if (chgAmt > 0 && typeof calcChangeDenominations === 'function') {
          chg = calcChangeDenominations(chgAmt);
        }
      }

      V21_ALL.forEach(d => {
        if (tx.direction === 'in') {
          drawer[d.value] += Number(den[d.value] || 0);
          drawer[d.value] -= Number(chg[d.value] || 0);
        } else {
          drawer[d.value] -= Number(den[d.value] || 0);
          drawer[d.value] += Number(chg[d.value] || 0);
        }
      });
    });

    // Clamp ≥ 0
    V21_ALL.forEach(d => { if (drawer[d.value] < 0) drawer[d.value] = 0; });
  } catch (e) { console.warn('[v21] drawer state err:', e.message); }
  return { drawer, balance, session };
}


/* ═══════════════════════════════════════════════════════════════════
   V21-1 : RENDER CASH DRAWER (FULL OVERRIDE)
═══════════════════════════════════════════════════════════════════ */
window.renderCashDrawer = async function () {
  const section = document.getElementById('page-cash');
  if (!section) return;

  // Fetch state
  const { drawer, balance, session } = await v21GetDrawerState();
  window.v21State.drawerDenoms = drawer;
  window.v21State.balance = balance;
  window.v21State.session = session;
  v21ResetDenoms();

  const hasSession = !!session;

  section.innerHTML = `
    <div class="v21-drawer-wrap">
      <!-- Banner -->
      <div class="v21-banner">
        <div>
          <h2><i class="material-icons-round">account_balance_wallet</i> ลิ้นชักเงินสด</h2>
          <div class="v21-banner-sub">${hasSession ? `เปิดรอบเมื่อ ${typeof formatDateTime === 'function' ? formatDateTime(session.opened_at) : ''} โดย ${session.opened_by || ''}` : 'ยังไม่เปิดรอบ'}</div>
        </div>
        <div style="text-align:right;">
          <div class="v21-banner-sub">ยอดเงินปัจจุบัน</div>
          <div class="v21-banner-bal" id="v21-bal-display">฿${_v21fmt(balance)}</div>
        </div>
      </div>

      <!-- Session Quick Actions -->
      <div class="v21-session-bar">
        ${!hasSession
          ? `<button class="v21-session-btn" style="border-color:#16a34a;color:#16a34a;" onclick="v21OpenSession()">
              <i class="material-icons-round">lock_open</i> เปิดรอบเงินสด
            </button>`
          : `<button class="v21-session-btn" style="border-color:#3b82f6;color:#3b82f6;" onclick="v21AddCash()">
              <i class="material-icons-round">add_circle</i> เพิ่มเงิน
            </button>
            <button class="v21-session-btn" style="border-color:#dc2626;color:#dc2626;" onclick="v21CloseSession()">
              <i class="material-icons-round">lock</i> ปิดรอบ
            </button>
            <button class="v21-session-btn" style="border-color:#8b5cf6;color:#8b5cf6;" onclick="renderCashDrawer()">
              <i class="material-icons-round">refresh</i> รีเฟรช
            </button>`
        }
      </div>

      ${hasSession ? `
      <!-- Mode Tabs -->
      <div class="v21-mode-tabs">
        <button class="v21-mode-tab active" data-mode="sell" onclick="v21SetMode('sell')">
          <i class="material-icons-round">shopping_cart</i> ขายเงินสด
        </button>
        <button class="v21-mode-tab" data-mode="expense" onclick="v21SetMode('expense')">
          <i class="material-icons-round">receipt_long</i> รายจ่าย
        </button>
        <button class="v21-mode-tab" data-mode="withdraw" onclick="v21SetMode('withdraw')">
          <i class="material-icons-round">money_off</i> เบิกเงิน
        </button>
      </div>

      <!-- Mode Description -->
      <div id="v21-mode-desc" style="text-align:center;margin-bottom:16px;font-size:13px;color:#5d4037;font-weight:600;">
        💵 กดแบงค์/เหรียญที่รับจากลูกค้า — กดค้างเพื่อลบ
      </div>

      <!-- Drawer Body -->
      <div class="v21-drawer-outer">
        <div class="v21-drawer-inner">
          <!-- Bills -->
          <div class="v21-sec-label">
            <h3>💵 ช่องธนบัตร</h3>
            <div class="line"></div>
          </div>
          <div class="v21-bill-grid" id="v21-bills">
            ${V21_BILLS.map(d => v21BillHTML(d, drawer[d.value])).join('')}
          </div>

          <!-- Coins -->
          <div class="v21-sec-label">
            <h3>🪙 ถาดเหรียญ</h3>
            <div class="line"></div>
          </div>
          <div class="v21-coin-grid" id="v21-coins">
            ${V21_COINS.map(d => v21CoinHTML(d, drawer[d.value])).join('')}
          </div>

          <!-- Summary Bar -->
          <div class="v21-summary" id="v21-summary">
            <div class="v21-sum-cell">
              <div class="lbl">นับได้</div>
              <div class="val" id="v21-counted" style="color:#3b82f6;">฿0</div>
            </div>
            <div class="v21-sum-cell" id="v21-target-cell" style="display:none;">
              <div class="lbl" id="v21-target-lbl">ยอดที่ต้องรับ</div>
              <div class="val" id="v21-target-val" style="color:#d97706;">฿0</div>
            </div>
            <div class="v21-sum-cell" id="v21-diff-cell" style="display:none;">
              <div class="lbl" id="v21-diff-lbl">ส่วนต่าง</div>
              <div class="val" id="v21-diff-val" style="color:#ef4444;">฿0</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="v21-actions" id="v21-action-btns">
        <button class="v21-btn v21-btn-secondary" onclick="v21ResetUI()">
          <i class="material-icons-round">refresh</i> ล้างการนับ
        </button>
        <button class="v21-btn v21-btn-primary" id="v21-confirm-btn" onclick="v21ConfirmAction()" disabled>
          <i class="material-icons-round">check_circle</i> <span id="v21-confirm-text">ยืนยัน</span>
        </button>
      </div>
      ` : `
      <div style="text-align:center;padding:60px 20px;color:#8d6e63;">
        <i class="material-icons-round" style="font-size:64px;opacity:0.3;display:block;margin-bottom:16px;">lock</i>
        <p style="font-size:16px;font-weight:600;">กรุณาเปิดรอบเงินสดก่อนใช้งาน</p>
      </div>`}

      <!-- Transaction History -->
      ${hasSession ? `
      <div style="margin-top:24px;">
        <div class="v21-sec-label" style="margin-bottom:12px;">
          <h3>📋 ประวัติรายการวันนี้</h3>
          <div class="line"></div>
        </div>
        <div id="v21-tx-list" class="v21-tx-list" style="background:#fff;border-radius:16px;border:2px solid #e8e0dc;overflow:hidden;">
          <div style="text-align:center;padding:20px;color:#a1887f;">กำลังโหลด...</div>
        </div>
      </div>` : ''}
    </div>`;

  // Load transactions
  if (hasSession) {
    v21LoadTransactions(session.id);
  }

  // Update global balance
  const gBal = document.getElementById('global-cash-balance');
  if (gBal) gBal.textContent = `฿${_v21fmt(balance)}`;
  const cBal = document.getElementById('cash-current-balance');
  if (cBal) cBal.textContent = `฿${_v21fmt(balance)}`;
};


/* ─── HTML Builders ──────────────────────────────────────────── */
function v21BillHTML(d, avail) {
  const cnt = window.v21State.denoms[d.value] || 0;
  return `
    <div class="v21-bill-comp" id="v21-b-${d.value}"
         onclick="v21AddDenom(${d.value})"
         oncontextmenu="event.preventDefault();v21RemDenom(${d.value})">
      <div class="count-badge ${cnt === 0 ? 'zero' : ''}" style="background:${d.color};" id="v21-badge-${d.value}">${cnt}</div>
      <div class="v21-bill-visual" style="background:${d.bg};">
        <span>${d.label}</span>
      </div>
      <div class="v21-bill-name">฿${d.label}</div>
      <div class="v21-bill-avail" id="v21-avail-${d.value}">คลัง: ${avail} ใบ</div>
    </div>`;
}

function v21CoinHTML(d, avail) {
  const cnt = window.v21State.denoms[d.value] || 0;
  return `
    <div class="v21-coin-comp" id="v21-c-${d.value}"
         onclick="v21AddDenom(${d.value})"
         oncontextmenu="event.preventDefault();v21RemDenom(${d.value})">
      <div class="count-badge ${cnt === 0 ? 'zero' : ''}" style="background:${d.color};" id="v21-badge-${d.value}">${cnt}</div>
      <div class="v21-coin-visual" style="background:${d.bg};">${d.label}</div>
      <div class="v21-coin-name">฿${d.label}</div>
      <div class="v21-coin-avail" id="v21-avail-${d.value}">คลัง: ${avail} เหรียญ</div>
    </div>`;
}


/* ─── Mode Switching ─────────────────────────────────────────── */
window.v21SetMode = function (mode) {
  window.v21State.mode = mode;
  v21ResetDenoms();
  v21UpdateUI();

  // Update tab active state
  document.querySelectorAll('.v21-mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });

  // Update description
  const desc = document.getElementById('v21-mode-desc');
  if (desc) {
    const descs = {
      sell: '💵 กดแบงค์/เหรียญที่รับจากลูกค้า — กดค้างเพื่อลบ',
      expense: '💸 กดแบงค์/เหรียญที่จ่ายออก — กดค้างเพื่อลบ | เงินทอนจากคนนอกนับเข้า',
      withdraw: '🏧 กดแบงค์/เหรียญที่เบิกออก — ต้องพอดีจำนวน ห้ามขาดห้ามเกิน',
    };
    desc.textContent = descs[mode];
  }

  // Show/hide target cell
  const targetCell = document.getElementById('v21-target-cell');
  if (targetCell) targetCell.style.display = mode === 'sell' ? 'none' : 'none'; // Will be shown when amount is set
};


/* ─── Add/Remove Denomination ────────────────────────────────── */
window.v21AddDenom = function (value) {
  window.v21State.denoms[value] = (window.v21State.denoms[value] || 0) + 1;
  v21AnimateBill(value, 'in');
  v21UpdateUI();
};

window.v21RemDenom = function (value) {
  if ((window.v21State.denoms[value] || 0) <= 0) return;
  window.v21State.denoms[value]--;
  v21AnimateBill(value, 'out');
  v21UpdateUI();
};


/* ─── Bill Animation ─────────────────────────────────────────── */
function v21AnimateBill(value, direction) {
  const el = document.getElementById(`v21-b-${value}`) || document.getElementById(`v21-c-${value}`);
  if (!el) return;

  // Pulse effect on compartment
  el.classList.add('pulse');
  setTimeout(() => el.classList.remove('pulse'), 300);

  // Float number
  const floater = document.createElement('div');
  floater.className = 'v21-float-num';
  floater.textContent = direction === 'in' ? '+1' : '-1';
  floater.style.color = direction === 'in' ? '#16a34a' : '#dc2626';
  el.appendChild(floater);
  setTimeout(() => floater.remove(), 600);

  // Bill visual animation
  const visual = el.querySelector('.v21-bill-visual, .v21-coin-visual');
  if (visual) {
    visual.classList.remove('v21-anim-in', 'v21-anim-out');
    void visual.offsetWidth; // reflow
    visual.classList.add(direction === 'in' ? 'v21-anim-in' : 'v21-anim-out');
    setTimeout(() => visual.classList.remove('v21-anim-in', 'v21-anim-out'), 500);
  }
}


/* ─── Update UI ──────────────────────────────────────────────── */
function v21UpdateUI() {
  const total = V21_ALL.reduce((s, d) => s + d.value * (window.v21State.denoms[d.value] || 0), 0);

  // Update badges
  V21_ALL.forEach(d => {
    const cnt = window.v21State.denoms[d.value] || 0;
    const badge = document.getElementById(`v21-badge-${d.value}`);
    if (badge) {
      badge.textContent = cnt;
      badge.classList.toggle('zero', cnt === 0);
    }
  });

  // Update counted total
  const countedEl = document.getElementById('v21-counted');
  if (countedEl) countedEl.textContent = `฿${_v21fmt(total)}`;

  // Update confirm button
  const confirmBtn = document.getElementById('v21-confirm-btn');
  const confirmText = document.getElementById('v21-confirm-text');
  if (confirmBtn) {
    const mode = window.v21State.mode;
    if (mode === 'sell') {
      confirmBtn.disabled = total <= 0;
      if (confirmText) confirmText.textContent = total > 0 ? `ยืนยันรับเงิน ฿${_v21fmt(total)}` : 'ยืนยัน';
    } else if (mode === 'expense') {
      confirmBtn.disabled = total <= 0;
      if (confirmText) confirmText.textContent = total > 0 ? `ยืนยันจ่ายออก ฿${_v21fmt(total)}` : 'ยืนยัน';
    } else if (mode === 'withdraw') {
      confirmBtn.disabled = total <= 0;
      if (confirmText) confirmText.textContent = total > 0 ? `ยืนยันเบิก ฿${_v21fmt(total)}` : 'ยืนยัน';
    }
  }
}


/* ─── Reset ──────────────────────────────────────────────────── */
window.v21ResetUI = function () {
  v21ResetDenoms();
  v21UpdateUI();
};


/* ─── Confirm Action ─────────────────────────────────────────── */
window.v21ConfirmAction = async function () {
  const mode = window.v21State.mode;
  const total = V21_ALL.reduce((s, d) => s + d.value * (window.v21State.denoms[d.value] || 0), 0);
  if (total <= 0) return;

  const denomState = { ...window.v21State.denoms };
  const session = window.v21State.session;
  if (!session) { toast('ไม่มีรอบเงินสดเปิดอยู่', 'error'); return; }

  if (mode === 'sell') {
    // ขายเงินสด — รับเงินเข้า → ถามทอน
    const { value: noteVal, isConfirmed } = await Swal.fire({
      title: '💵 รับเงินสด',
      html: `<p>รับมา <strong style="color:#16a34a;">฿${_v21fmt(total)}</strong></p>
             <input id="v21-sell-note" class="swal2-input" placeholder="หมายเหตุ (ถ้ามี)">
             <div style="margin-top:12px;">
               <label style="font-size:13px;color:#64748b;">เงินทอน (ถ้ามี):</label>
               <input id="v21-sell-change" class="swal2-input" type="number" min="0" placeholder="0" value="0">
             </div>`,
      showCancelButton: true, confirmButtonText: 'ยืนยันรับเงิน', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#16a34a',
      preConfirm: () => ({
        note: document.getElementById('v21-sell-note').value,
        changeAmt: Number(document.getElementById('v21-sell-change').value || 0)
      })
    });
    if (!isConfirmed) return;

    const changeAmt = noteVal.changeAmt || 0;
    const netAmt = total - changeAmt;

    // ถ้ามีเงินทอน → เปิด wizard นับแบงค์ทอน
    if (changeAmt > 0) {
      await v21CountChange(changeAmt, async (changeDenoms) => {
        await v21RecordTx(session.id, 'ขายเงินสด', 'in', total, changeAmt, netAmt, denomState, changeDenoms, noteVal.note);
      });
    } else {
      await v21RecordTx(session.id, 'ขายเงินสด', 'in', total, 0, total, denomState, {}, noteVal.note);
    }

  } else if (mode === 'expense') {
    // รายจ่าย — จ่ายออก → ถามทอนจากคนนอก
    const { value: noteVal, isConfirmed } = await Swal.fire({
      title: '💸 จ่ายรายจ่าย',
      html: `<p>จ่ายออก <strong style="color:#dc2626;">฿${_v21fmt(total)}</strong></p>
             <input id="v21-exp-desc" class="swal2-input" placeholder="รายละเอียดรายจ่าย *" required>
             <select id="v21-exp-cat" class="swal2-select">
               <option>ทั่วไป</option><option>ค่าสาธารณูปโภค</option><option>ค่าขนส่ง</option>
               <option>ค่าซ่อมบำรุง</option><option>ค่าอาหาร</option><option>อื่นๆ</option>
             </select>
             <div style="margin-top:12px;">
               <label style="font-size:13px;color:#64748b;">ทอนจากคนนอก (ถ้ามี):</label>
               <input id="v21-exp-change" class="swal2-input" type="number" min="0" placeholder="0" value="0">
             </div>`,
      showCancelButton: true, confirmButtonText: 'ยืนยันจ่าย', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
      preConfirm: () => {
        const desc = document.getElementById('v21-exp-desc').value.trim();
        if (!desc) { Swal.showValidationMessage('กรุณาระบุรายละเอียด'); return false; }
        return {
          desc, cat: document.getElementById('v21-exp-cat').value,
          changeAmt: Number(document.getElementById('v21-exp-change').value || 0)
        };
      }
    });
    if (!isConfirmed) return;

    const changeAmt = noteVal.changeAmt || 0;
    const netAmt = total - changeAmt;

    // บันทึก cash_transaction ออก
    await v21RecordTx(session.id, 'รายจ่าย', 'out', total, changeAmt, netAmt, denomState, {}, `${noteVal.desc} (${noteVal.cat})`);

    // บันทึก รายจ่าย table ด้วย
    try {
      await db.from('รายจ่าย').insert({
        description: noteVal.desc, amount: netAmt, category: noteVal.cat,
        date: new Date().toISOString(), staff_name: _v21Staff(),
      });
    } catch (e) { console.warn('[v21] expense insert:', e.message); }

  } else if (mode === 'withdraw') {
    // เบิกเงิน — พอดี ห้ามขาดห้ามเกิน
    const { value: noteVal, isConfirmed } = await Swal.fire({
      title: '🏧 เบิกเงิน',
      html: `<p>ยอดเบิก <strong style="color:#d97706;">฿${_v21fmt(total)}</strong></p>
             <p style="font-size:13px;color:#64748b;">⚠️ ยอดต้องพอดี ห้ามขาดห้ามเกิน</p>
             <input id="v21-wd-note" class="swal2-input" placeholder="เหตุผลการเบิก *" required>`,
      showCancelButton: true, confirmButtonText: 'ยืนยันเบิก', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#d97706',
      preConfirm: () => {
        const note = document.getElementById('v21-wd-note').value.trim();
        if (!note) { Swal.showValidationMessage('กรุณาระบุเหตุผล'); return false; }
        return { note };
      }
    });
    if (!isConfirmed) return;

    await v21RecordTx(session.id, 'เบิกเงิน', 'out', total, 0, total, denomState, {}, noteVal.note);
  }

  // Refresh
  typeof toast === 'function' && toast('บันทึกสำเร็จ', 'success');
  typeof logActivity === 'function' && logActivity(mode === 'sell' ? 'รับเงินสด' : mode === 'expense' ? 'รายจ่าย' : 'เบิกเงิน', `฿${_v21fmt(total)}`);
  renderCashDrawer();
};


/* ─── Count Change (Wizard) ──────────────────────────────────── */
async function v21CountChange(changeAmt, onDone) {
  const changeDenoms = {};
  V21_ALL.forEach(d => { changeDenoms[d.value] = 0; });

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'v21-change-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;';

    function renderChangeWizard() {
      const counted = V21_ALL.reduce((s, d) => s + d.value * changeDenoms[d.value], 0);
      const diff = changeAmt - counted;
      const done = Math.abs(diff) < 0.01;

      overlay.innerHTML = `
        <div style="background:#fff;border-radius:20px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;padding:24px;">
          <div style="text-align:center;margin-bottom:16px;">
            <div style="font-size:12px;color:#92400e;font-weight:700;text-transform:uppercase;">💵 นับเงินทอน</div>
            <div style="font-size:28px;font-weight:900;color:#d97706;">฿${_v21fmt(changeAmt)}</div>
            <div style="font-size:14px;color:${done ? '#16a34a' : '#d97706'};font-weight:600;margin-top:4px;">
              ${done ? '✅ นับครบแล้ว!' : `ยังขาด ฿${_v21fmt(Math.max(0, diff))}`}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
            ${V21_BILLS.map(d => {
              const avail = window.v21State.drawerDenoms[d.value] || 0;
              const cnt = changeDenoms[d.value];
              const empty = avail <= 0;
              return `<div style="background:${empty ? '#f3f4f6' : d.bg};border-radius:12px;padding:10px;text-align:center;cursor:${empty ? 'not-allowed' : 'pointer'};opacity:${empty ? 0.4 : 1};"
                ${empty ? '' : `onclick="document.dispatchEvent(new CustomEvent('v21chg',{detail:{v:${d.value},d:1}}))"
                oncontextmenu="event.preventDefault();document.dispatchEvent(new CustomEvent('v21chg',{detail:{v:${d.value},d:-1}}))"`}>
                <div style="color:#fff;font-weight:900;font-size:16px;">฿${d.label}</div>
                <div style="color:rgba(255,255,255,0.7);font-size:11px;">${empty ? 'หมด' : `คลัง ${avail}`}</div>
                ${cnt > 0 ? `<div style="background:#fff;color:${d.color};border-radius:8px;padding:2px 8px;font-weight:900;font-size:14px;margin-top:4px;display:inline-block;">${cnt}</div>` : ''}
              </div>`;
            }).join('')}
          </div>

          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:16px;">
            ${V21_COINS.map(d => {
              const avail = window.v21State.drawerDenoms[d.value] || 0;
              const cnt = changeDenoms[d.value];
              const empty = avail <= 0;
              return `<div style="background:${empty ? '#f3f4f6' : '#f8fafc'};border:2px solid ${empty ? '#e5e7eb' : d.color};border-radius:10px;padding:8px;text-align:center;cursor:${empty ? 'not-allowed' : 'pointer'};opacity:${empty ? 0.4 : 1};"
                ${empty ? '' : `onclick="document.dispatchEvent(new CustomEvent('v21chg',{detail:{v:${d.value},d:1}}))"
                oncontextmenu="event.preventDefault();document.dispatchEvent(new CustomEvent('v21chg',{detail:{v:${d.value},d:-1}}))"`}>
                <div style="font-weight:900;font-size:14px;color:${d.color};">฿${d.label}</div>
                ${cnt > 0 ? `<div style="font-weight:900;font-size:13px;color:${d.color};">${cnt}x</div>` : ''}
              </div>`;
            }).join('')}
          </div>

          <div style="display:flex;gap:12px;justify-content:center;">
            <button onclick="document.dispatchEvent(new CustomEvent('v21chg',{detail:{action:'reset'}}))"
              style="padding:12px 24px;border-radius:12px;border:2px solid #e5e7eb;background:#fff;font-weight:700;cursor:pointer;font-family:inherit;">
              ล้าง
            </button>
            <button id="v21-chg-confirm" ${done ? '' : 'disabled'}
              onclick="document.dispatchEvent(new CustomEvent('v21chg',{detail:{action:'confirm'}}))"
              style="padding:12px 32px;border-radius:12px;border:none;background:${done ? '#16a34a' : '#d1d5db'};color:#fff;font-weight:700;cursor:pointer;font-family:inherit;font-size:15px;">
              ${done ? '✅ ยืนยันทอน' : 'นับให้ครบก่อน'}
            </button>
          </div>
        </div>`;
    }

    function handleEvent(e) {
      const { v, d: delta, action } = e.detail;
      if (action === 'reset') {
        V21_ALL.forEach(dd => { changeDenoms[dd.value] = 0; });
      } else if (action === 'confirm') {
        document.removeEventListener('v21chg', handleEvent);
        overlay.remove();
        onDone(changeDenoms).then(resolve);
        return;
      } else if (v && delta) {
        const cur = changeDenoms[v] || 0;
        changeDenoms[v] = Math.max(0, cur + delta);
      }
      renderChangeWizard();
    }

    document.addEventListener('v21chg', handleEvent);
    renderChangeWizard();
    document.body.appendChild(overlay);
  });
}


/* ─── Record Transaction ─────────────────────────────────────── */
async function v21RecordTx(sessionId, type, direction, amount, changeAmt, netAmount, denoms, changeDenoms, note) {
  try {
    if (typeof window.recordCashTx === 'function') {
      await window.recordCashTx({
        sessionId, type, direction, amount, changeAmt, netAmount,
        denominations: denoms, changeDenominations: changeDenoms,
        note: note || '', refTable: type,
      });
    } else {
      await db.from('cash_transaction').insert({
        session_id: sessionId, type, direction, amount, change_amt: changeAmt,
        net_amount: netAmount, denominations: denoms, change_denominations: changeDenoms,
        staff_name: _v21Staff(), note: note || '',
        created_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('[v21] recordTx:', e);
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
  }
}


/* ─── Load Transactions ──────────────────────────────────────── */
async function v21LoadTransactions(sessionId) {
  const el = document.getElementById('v21-tx-list');
  if (!el) return;
  try {
    const { data: txs } = await db.from('cash_transaction').select('*')
      .eq('session_id', sessionId).order('created_at', { ascending: false });
    if (!txs || txs.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:30px;color:#a1887f;font-size:14px;">ยังไม่มีรายการ</div>';
      return;
    }
    el.innerHTML = txs.map(tx => {
      const isIn = tx.direction === 'in';
      const recv = tx.amount || tx.net_amount;
      const chg = tx.change_amt || 0;
      const net = tx.net_amount;
      return `
        <div class="v21-tx-item">
          <div class="v21-tx-icon ${isIn ? 'in' : 'out'}">
            <i class="material-icons-round">${isIn ? 'arrow_downward' : 'arrow_upward'}</i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:14px;color:#1e293b;">${tx.type}</div>
            <div style="font-size:12px;color:#94a3b8;">${typeof formatDateTime === 'function' ? formatDateTime(tx.created_at) : ''} · ${tx.staff_name || ''}</div>
            ${tx.note ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${tx.note}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:16px;font-weight:800;color:${isIn ? '#16a34a' : '#dc2626'};">${isIn ? '+' : '-'}฿${_v21fmt(net)}</div>
            ${isIn && chg > 0 ? `<div style="font-size:11px;color:#94a3b8;">รับ ฿${_v21fmt(recv)} ทอน ฿${_v21fmt(chg)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:#dc2626;">โหลดไม่ได้: ${e.message}</div>`;
  }
}


/* ─── Session Actions ────────────────────────────────────────── */
window.v21OpenSession = async function () {
  if (typeof openCashSession === 'function') return openCashSession();
  const { value, isConfirmed } = await Swal.fire({
    title: 'เปิดรอบเงินสด', input: 'number', inputLabel: 'ยอดเปิดลิ้นชัก (฿)',
    inputValue: 0, showCancelButton: true, confirmButtonText: 'เปิดรอบ', confirmButtonColor: '#16a34a',
  });
  if (!isConfirmed) return;
  await db.from('cash_session').insert({
    opened_at: new Date().toISOString(), opened_by: _v21Staff(),
    opening_amt: Number(value || 0), status: 'open',
  });
  typeof toast === 'function' && toast('เปิดรอบสำเร็จ', 'success');
  renderCashDrawer();
};

window.v21AddCash = async function () {
  if (typeof addOrWithdrawCash === 'function') return addOrWithdrawCash(true);
  // Fallback
  const { value, isConfirmed } = await Swal.fire({
    title: 'เพิ่มเงินในลิ้นชัก', input: 'number', inputLabel: 'จำนวนเงิน (฿)',
    showCancelButton: true, confirmButtonText: 'เพิ่ม',
  });
  if (!isConfirmed || !value) return;
  const session = window.v21State.session;
  if (session) {
    await v21RecordTx(session.id, 'เพิ่มเงิน', 'in', Number(value), 0, Number(value), {}, {}, 'เพิ่มเงิน');
    typeof toast === 'function' && toast('เพิ่มเงินสำเร็จ', 'success');
    renderCashDrawer();
  }
};

window.v21CloseSession = async function () {
  if (typeof v4StartCloseSession === 'function') return v4StartCloseSession();
  if (typeof closeCashSession === 'function') return closeCashSession(window.v21State.session, window.v21State.balance);
};


/* ═══════════════════════════════════════════════════════════════════
   V21-2 : PAYROLL FIX — UNLIMITED PAYMENTS + AUTO DEDUCTION
═══════════════════════════════════════════════════════════════════ */

/* Override v26ShowPayDetail to allow unlimited payments */
window.v26ShowPayDetail = function (eid) {
  const wrap = document.getElementById('v26-pay-detail-wrap');
  if (!wrap || !eid) return;
  document.getElementById('v26-pay-grid').style.display = 'none';
  wrap.style.display = 'block';

  const s = window._v26Pay?.find(x => x.emp.id === eid);
  if (!s) return;

  const emp = s.emp;
  const earn = s.earn || 0;                  // เงินสะสมเดือนนี้ (gross entitlement)
  const pastPays = s.pastPays || [];         // ประวัติจ่ายทั้งหมดเดือนนี้
  const sumPaidNet = s.sumPaidNet || 0;      // รวมจ่ายแล้ว
  const sumPaidDebt = s.sumPaidWithdraw || 0; // รวมหักหนี้แล้ว
  const remaining = Math.max(0, earn - sumPaidNet - sumPaidDebt - (s.sumTotalDeduct || 0)); // เพดานคงเหลือ
  const totalAdv = s.taGross || 0;           // เบิกเงินล่วงหน้าเดือนนี้
  const debtLeft = Math.max(0, totalAdv - sumPaidDebt); // หนี้เบิกคงเหลือ

  wrap.innerHTML = `
    <button onclick="v26HidePayDetail()" style="margin-bottom:20px; background:#e2e8f0; color:#475569; border:none; padding:10px 20px; border-radius:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px;">
      <i class="material-icons-round">arrow_back</i> กลับหน้าหลัก
    </button>

    <div class="v26-pay-detail" style="cursor:default; margin-bottom:24px;">
      <div class="v26-pay-detail-head">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
          <div class="v26-avatar" style="width:52px;height:52px;font-size:20px;">${(emp.name || '?')[0]}</div>
          <div>
            <div style="font-size:20px;font-weight:800;">${emp.name} ${emp.lastname || ''}</div>
            <div style="font-size:13px;color:#64748b;">${emp.position || ''} · ค่าจ้าง ฿${_v21fmt(emp.daily_wage || emp.salary || 0)}/วัน</div>
          </div>
        </div>
      </div>

      <div class="v26-pay-detail-body">

        ${/* ─── Payment History Warning ─── */
          pastPays.length > 0 ? `
          <div class="v21-pay-history">
            <h4>⚠️ เดือนนี้จ่ายไปแล้ว ${pastPays.length} ครั้ง (รวม ฿${_v21fmt(sumPaidNet)})</h4>
            ${pastPays.map((p, i) => `
              <div class="v21-pay-history-row">
                <span>ครั้งที่ ${i + 1} · ${new Date(p.paid_date).toLocaleDateString('th-TH')}</span>
                <strong style="color:#16a34a;">฿${_v21fmt(p.net_paid)}</strong>
              </div>`).join('')}
          </div>` : ''}

        <!-- Ceiling (เพดานคงเหลือ) -->
        <div class="v21-pay-ceil">
          <div class="lbl">เพดานยอดเงินเดือนคงเหลือ</div>
          <div class="val" style="color:${remaining > 0 ? '#16a34a' : '#dc2626'};">฿${_v21fmt(remaining)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">สะสม ฿${_v21fmt(earn)} − จ่ายแล้ว ฿${_v21fmt(sumPaidNet + sumPaidDebt + (s.sumTotalDeduct || 0))}</div>
        </div>

        ${remaining <= 0 ? `
          <div style="text-align:center;padding:20px;color:#dc2626;font-size:14px;">
            <i class="material-icons-round" style="font-size:36px;display:block;margin-bottom:8px;">warning</i>
            เดือนนี้จ่ายครบยอดแล้ว (ยังสามารถจ่ายเพิ่มได้ถ้าต้องการ)
          </div>` : ''}

        <!-- P&L Breakdown -->
        <div class="v26-pr"><span>วันทำงาน</span><strong>${s.wd || 0} วัน</strong></div>
        <div class="v26-pr"><span>ค่าจ้างสะสม (Gross)</span><strong style="color:#3b82f6;">฿${_v21fmt(earn)}</strong></div>
        <div class="v26-pr"><span>หักสาย/ขาด</span><strong style="color:#ef4444;">-฿${_v21fmt(s.td || 0)}</strong></div>
        <div class="v26-pr"><span>เบิกล่วงหน้า</span><strong style="color:#d97706;">฿${_v21fmt(totalAdv)}</strong></div>
        <div class="v26-pr"><span>หนี้เบิกคงค้าง</span><strong style="color:#92400e;">฿${_v21fmt(debtLeft)}</strong></div>
        <div class="v26-pr total"><span>เพดานจ่ายได้</span><strong style="color:#16a34a;">฿${_v21fmt(remaining)}</strong></div>

        <!-- Payment Fields -->
        <div class="v26-fields" style="margin-top:18px;">
          <div class="v26-field"><label>ยอดจ่าย (฿)</label>
            <input type="number" id="v26r-${eid}" value="${remaining > 0 ? remaining : 0}" min="0" max="${earn}" oninput="v21PayVal('${eid}',${earn},${sumPaidNet + sumPaidDebt + (s.sumTotalDeduct || 0)})"></div>
          <div class="v26-field"><label>หักหนี้เบิก (฿)</label>
            <input type="number" id="v26d-${eid}" value="0" min="0" max="${debtLeft}" oninput="v21PayVal('${eid}',${earn},${sumPaidNet + sumPaidDebt + (s.sumTotalDeduct || 0)})"></div>
          <div class="v26-field"><label>หักประกันสังคม (฿)</label>
            <input type="number" id="v26s-${eid}" value="0" min="0" oninput="v21PayVal('${eid}',${earn},${sumPaidNet + sumPaidDebt + (s.sumTotalDeduct || 0)})"></div>
          <div class="v26-field"><label>หักอื่นๆ (฿)</label>
            <input type="number" id="v26o-${eid}" value="0" min="0" oninput="v21PayVal('${eid}',${earn},${sumPaidNet + sumPaidDebt + (s.sumTotalDeduct || 0)})"></div>
        </div>
        <div class="v26-field" style="margin-top:10px;"><label>หมายเหตุหักอื่นๆ</label>
          <input type="text" id="v26on-${eid}" placeholder="ระบุเหตุผล..." style="width:100%;padding:10px 14px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:15px;font-family:inherit;"></div>

        <div class="v26-vmsg" id="v26vm-${eid}" style="margin-top:12px;padding:10px;border-radius:8px;font-size:13px;"></div>

        <div class="v26-fields" style="margin-top:14px;">
          <div class="v26-field"><label>วิธีจ่าย</label>
            <select id="v26m-${eid}" style="width:100%;padding:10px 14px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:15px;font-family:inherit;">
              <option value="เงินสด">เงินสด</option><option value="โอนเงิน">โอนเงิน</option>
            </select></div>
          <div class="v26-field"><label>หมายเหตุ</label>
            <input type="text" id="v26pn-${eid}" placeholder="หมายเหตุ..." style="width:100%;padding:10px 14px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:15px;font-family:inherit;"></div>
        </div>

        <button class="v26-pay-confirm" id="v26pb-${eid}" onclick="v26DoPay('${eid}')" style="width:100%;margin-top:16px;padding:16px;border:none;border-radius:14px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;font-size:16px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;">
          <i class="material-icons-round">payments</i> ยืนยันจ่ายเงินเดือน
        </button>
      </div>
    </div>`;

  v21PayVal(eid, earn, sumPaidNet + sumPaidDebt + (s.sumTotalDeduct || 0));
};


/* ─── Payroll Validation ─────────────────────────────────────── */
window.v21PayVal = function (eid, grossEarn, alreadyUsed) {
  const r = Number(document.getElementById(`v26r-${eid}`)?.value || 0);
  const d = Number(document.getElementById(`v26d-${eid}`)?.value || 0);
  const ss = Number(document.getElementById(`v26s-${eid}`)?.value || 0);
  const o = Number(document.getElementById(`v26o-${eid}`)?.value || 0);
  const t = r + d + ss + o;
  const maxLeft = grossEarn - alreadyUsed;
  const el = document.getElementById(`v26vm-${eid}`);
  const btn = document.getElementById(`v26pb-${eid}`);

  if (r < 0 || d < 0 || ss < 0 || o < 0) {
    if (el) { el.style.background = '#fee2e2'; el.style.color = '#dc2626'; el.innerHTML = `<i class="material-icons-round" style="font-size:16px;">error</i> ห้ามกรอกค่าติดลบ`; }
    if (btn) btn.disabled = true;
  } else if (t > grossEarn) {
    // Allow overpay but warn
    if (el) { el.style.background = '#fef3c7'; el.style.color = '#92400e'; el.innerHTML = `<i class="material-icons-round" style="font-size:16px;">warning</i> ยอดรวม ฿${_v21fmt(t)} เกินยอดสะสม ฿${_v21fmt(grossEarn)} (เกิน ฿${_v21fmt(t - grossEarn)}) — ยังจ่ายได้`; }
    if (btn) btn.disabled = false; // ให้จ่ายได้ ไม่ lock
  } else {
    if (el) { el.style.background = '#dcfce7'; el.style.color = '#16a34a'; el.innerHTML = `<i class="material-icons-round" style="font-size:16px;">check_circle</i> รับจริง ฿${_v21fmt(r)} | หักรวม ฿${_v21fmt(d + ss + o)} | คงเหลือ ฿${_v21fmt(Math.max(0, maxLeft - t))}`; }
    if (btn) btn.disabled = false;
  }
};


/* ─── Override v26 payroll data computation to include pastPays ─── */
const _v21OrigRenderPayroll = window.renderPayrollV26;
window.renderPayroll = window.renderPayrollV26 = async function () {
  const sec = document.getElementById('page-att');
  if (!sec) return;
  const now = new Date();
  const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const me = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const ml = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  const emps = (await loadEmployees()).filter(e => e.status === 'ทำงาน');
  const { data: att } = await db.from('เช็คชื่อ').select('*').gte('date', ms).lte('date', me);
  const { data: adv } = await db.from('เบิกเงิน').select('*').eq('status', 'อนุมัติ').gte('date', ms + 'T00:00:00');
  // ดึงทุก record ของเดือน ไม่ใช่แค่ record แรก
  const { data: paid } = await db.from('จ่ายเงินเดือน').select('*').eq('month', ms).order('paid_date', { ascending: true });

  window._v26Pay = emps.map(emp => {
    const ma = (att || []).filter(a => a.employee_id === emp.id);
    const wd = ma.filter(a => a.status !== 'ขาด' && a.status !== 'ลา').length;
    const td = ma.reduce((s, a) => s + (a.deduction || 0), 0);

    let earn = 0;
    if (emp.pay_type === 'รายเดือน') {
      earn = (emp.salary || 0) - td;
    } else {
      const w = emp.daily_wage || 0;
      earn = (wd * w) - td;
    }

    const myA = (adv || []).filter(a => a.employee_id === emp.id);
    const taGross = myA.reduce((s, a) => s + a.amount, 0);

    // ── ALL past payments this month (ไม่ lock) ──
    const pastPays = (paid || []).filter(p => p.employee_id === emp.id);
    const sumPaidNet = pastPays.reduce((s, p) => s + (p.net_paid || 0), 0);
    const sumPaidWithdraw = pastPays.reduce((s, p) => s + (p.deduct_withdraw || 0), 0);
    const sumTotalDeduct = pastPays.reduce((s, p) => s + (p.deduct_absent || 0) + (p.deduct_ss || 0) + (p.deduct_other || 0), 0);

    const net = Math.max(0, earn - sumPaidNet - sumPaidWithdraw - sumTotalDeduct);

    return {
      emp, wd, td, earn, taGross, net,
      pastPays, sumPaidNet, sumPaidWithdraw, sumTotalDeduct,
      paidCount: pastPays.length,
    };
  });

  // ── Render payroll list ──
  const totalNet = window._v26Pay.reduce((s, x) => s + x.net, 0);

  sec.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:0 8px;">
      <div class="v26-pay-banner">
        <div style="position:relative;z-index:1;">
          <h2 style="font-size:22px;font-weight:800;">💰 จ่ายเงินเดือน — ${ml}</h2>
          <p style="font-size:14px;opacity:0.8;margin-top:4px;">ยอดรวมคงค้าง: <strong style="font-size:20px;">฿${_v21fmt(totalNet)}</strong></p>
        </div>
        <button onclick="renderAttendance()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#fff;border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;position:relative;z-index:1;">
          <i class="material-icons-round">arrow_back</i> กลับเช็คชื่อ
        </button>
      </div>

      <div id="v26-pay-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${window._v26Pay.map(s => {
          const isPaid = s.paidCount > 0;
          return `
          <div class="v26-pay-card" onclick="v26ShowPayDetail('${s.emp.id}')" style="background:#fff;border-radius:16px;padding:20px;border:2px solid ${isPaid ? '#86efac' : '#e2e8f0'};cursor:pointer;transition:all 0.2s;position:relative;">
            ${isPaid ? `<div style="position:absolute;top:10px;right:10px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;">จ่ายแล้ว ${s.paidCount} ครั้ง</div>` : ''}
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <div class="v26-avatar" style="width:44px;height:44px;font-size:16px;">${(s.emp.name || '?')[0]}</div>
              <div>
                <div style="font-weight:700;font-size:15px;">${s.emp.name} ${s.emp.lastname || ''}</div>
                <div style="font-size:12px;color:#64748b;">${s.emp.position || ''}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
              <div><span style="color:#94a3b8;">สะสม</span><br><strong>฿${_v21fmt(s.earn)}</strong></div>
              <div><span style="color:#94a3b8;">จ่ายแล้ว</span><br><strong style="color:${s.sumPaidNet > 0 ? '#16a34a' : '#94a3b8'};">฿${_v21fmt(s.sumPaidNet)}</strong></div>
              <div><span style="color:#94a3b8;">เบิก</span><br><strong style="color:#d97706;">฿${_v21fmt(s.taGross)}</strong></div>
              <div><span style="color:#94a3b8;">คงเหลือ</span><br><strong style="color:${s.net > 0 ? '#3b82f6' : '#dc2626'};">฿${_v21fmt(s.net)}</strong></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div id="v26-pay-detail-wrap" style="display:none;margin-top:20px;"></div>
    </div>`;
};


console.info('%c[v21] ✅%c Cash Drawer Redesign + Payroll Unlimited Pay', 'color:#dc2626;font-weight:700', 'color:#6B7280');
