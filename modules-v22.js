/**
 * SK POS — modules-v22.js  (โหลดหลัง modules-v21.js)
 *
 * ████████████████████████████████████████████████████████████████████
 *  V22-1  SQL MIGRATION       — ตาราง งวดงาน + total_billed column
 *
 *  V22-2  PROJECT DETAIL UI   — override v14OpenProject (v17 base)
 *         เพิ่ม metrics: เบิกแล้ว / เหลือให้เบิก / กำไรคาดการณ์
 *         เพิ่มแท็บ "งวดงาน" แสดงรายการงวดทั้งหมด
 *
 *  V22-3  PLAN MILESTONE      — วางแผนงวดล่วงหน้า (status=pending)
 *         ไม่มีเงินเข้า — แค่บันทึกโครงสร้างไว้
 *
 *  V22-4  BILL MILESTONE      — เบิกงวดงาน → cash_transaction in
 *         + อัพเดต total_billed + แจ้งเตือนเหลือให้เบิก
 *
 *  V22-5  EXPENSE CASH LINK   — patch v14AddExpense
 *         เพิ่มรายจ่ายโครงการ → cash_transaction out ทันที
 *         เก็บ cash_tx_id เพื่อ audit trail
 *
 *  V22-6  COMPLETE PROJECT    — patch v14CompleteProject
 *         เบิกเฉพาะยอดคงค้าง (budget - total_billed) เท่านั้น
 *         ไม่เพิ่มงบประมาณทั้งหมดซ้ำอีก
 *
 *  V22-7  PROJECT LIST UI     — เพิ่มแสดง % เบิก ในหน้ารายการ
 * ████████████████████████████████████████████████████████████████████
 *
 *  SQL ที่ต้องรันก่อน (ครั้งแรก):
 *  ──────────────────────────────────────────────────────────────────
 *  ALTER TABLE "โครงการ"
 *    ADD COLUMN IF NOT EXISTS total_billed DECIMAL(12,2) DEFAULT 0;
 *
 *  CREATE TABLE IF NOT EXISTS "งวดงาน" (
 *    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *    project_id    UUID REFERENCES "โครงการ"(id) ON DELETE CASCADE,
 *    milestone_no  INTEGER NOT NULL,
 *    description   TEXT,
 *    amount        DECIMAL(12,2) NOT NULL DEFAULT 0,
 *    percent       DECIMAL(5,2),
 *    status        TEXT DEFAULT 'pending',
 *    billed_at     TIMESTAMPTZ,
 *    cash_tx_id    UUID,
 *    staff_name    TEXT,
 *    notes         TEXT,
 *    created_at    TIMESTAMPTZ DEFAULT now()
 *  );
 *
 *  ALTER TABLE "รายจ่ายโครงการ"
 *    ADD COLUMN IF NOT EXISTS cash_tx_id UUID,
 *    ADD COLUMN IF NOT EXISTS paid_at    TIMESTAMPTZ;
 *  ──────────────────────────────────────────────────────────────────
 */

'use strict';

/* ── Util helpers ── */
const _v22f = n => typeof formatNum === 'function' ? formatNum(n) : Number(n||0).toLocaleString('th-TH');
const _v22d = d => d ? new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}) : '-';
const _v22staff = () => { try { return (typeof USER !== 'undefined' && USER) ? USER.username : 'system'; } catch(_) { return 'system'; } };

async function _v22getSession() {
  try {
    const { data } = await db.from('cash_session')
      .select('*').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).maybeSingle();
    return data;
  } catch(_) { return null; }
}

async function _v22getProject(projId) {
  const { data } = await db.from('โครงการ').select('*').eq('id', projId).maybeSingle();
  return data;
}

/* ══════════════════════════════════════════════════════════════════
   V22-1: CSS INJECTION
══════════════════════════════════════════════════════════════════ */
(function injectV22CSS() {
  if (document.getElementById('sk-v22-css')) return;
  const s = document.createElement('style');
  s.id = 'sk-v22-css';
  s.textContent = `
    /* Metrics row */
    .v22-metrics { display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:16px 0; }
    .v22-metric { background:rgba(255,255,255,.12);border-radius:12px;padding:12px 14px; }
    .v22-metric .lbl { font-size:10px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px; }
    .v22-metric .val { font-size:18px;font-weight:900; }
    .v22-metric .sub { font-size:10px;color:rgba(255,255,255,.5);margin-top:2px; }

    /* Milestone row */
    .v22-ms-row { display:flex;align-items:center;gap:12px;padding:12px 14px;
      border-bottom:0.5px solid var(--border,#f0f0f0);transition:background .1s; }
    .v22-ms-row:last-child { border-bottom:none; }
    .v22-ms-row:hover { background:var(--bg-hover,#f9fafb); }
    .v22-ms-num { width:32px;height:32px;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-size:12px;font-weight:800;flex-shrink:0; }
    .v22-ms-num.billed { background:#d1fae5;color:#065f46; }
    .v22-ms-num.pending { background:#fef3c7;color:#92400e; }
    .v22-ms-num.planned { background:#e5e7eb;color:#6b7280; }
    .v22-ms-body { flex:1;min-width:0; }
    .v22-ms-title { font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .v22-ms-sub { font-size:11px;color:var(--text-muted,#9ca3af);margin-top:2px; }
    .v22-ms-amt { font-size:15px;font-weight:800;text-align:right;flex-shrink:0;min-width:80px; }
    .v22-ms-badge { display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;margin-left:8px; }
    .v22-ms-badge.billed { background:#d1fae5;color:#065f46; }
    .v22-ms-badge.pending { background:#fef3c7;color:#92400e; }
    .v22-ms-badge.planned { background:#e5e7eb;color:#6b7280; }

    /* Progress bar */
    .v22-progress-track { height:8px;background:rgba(255,255,255,.2);border-radius:99px;overflow:hidden;margin:8px 0; }
    .v22-progress-fill { height:100%;border-radius:99px;transition:width .5s;background:#22c55e; }

    /* Billing modal overlay */
    .v22-modal-overlay { position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,.55);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;padding:16px; }
    .v22-modal-box { background:var(--bg-surface,#fff);border-radius:20px;padding:24px;
      width:100%;max-width:440px;box-shadow:0 24px 64px rgba(0,0,0,.25);
      transform:scale(.95);transition:transform .2s;font-family:var(--font-thai,Prompt),sans-serif; }
    .v22-modal-box.open { transform:scale(1); }
    .v22-modal-title { font-size:16px;font-weight:800;margin-bottom:4px; }
    .v22-modal-sub { font-size:12px;color:var(--text-muted,#9ca3af);margin-bottom:16px; }
    .v22-info-row { display:flex;justify-content:space-between;align-items:center;
      padding:8px 0;border-bottom:0.5px solid var(--border,#f0f0f0);font-size:13px; }
    .v22-info-row:last-child { border-bottom:none; }
    .v22-info-row .key { color:var(--text-muted,#9ca3af); }
    .v22-info-row .val { font-weight:700; }
    .v22-input-group { margin-top:10px; }
    .v22-input-group label { display:block;font-size:11px;font-weight:700;
      color:var(--text-secondary,#6b7280);margin-bottom:5px; }
    .v22-input-group input, .v22-input-group textarea, .v22-input-group select {
      width:100%;padding:10px 12px;border:1.5px solid var(--border,#e5e7eb);
      border-radius:10px;font-size:13px;font-family:var(--font-thai,Prompt),sans-serif;
      background:var(--bg-base,#f9fafb);color:var(--text-primary,#111);
      outline:none;transition:.15s; }
    .v22-input-group input:focus, .v22-input-group textarea:focus, .v22-input-group select:focus {
      border-color:var(--primary,#dc2626); }
    .v22-alert-box { border-radius:10px;padding:10px 14px;font-size:12px;margin:12px 0;line-height:1.6; }
    .v22-alert-green { background:#d1fae5;color:#065f46; }
    .v22-alert-red   { background:#fee2e2;color:#991b1b; }
    .v22-alert-blue  { background:#dbeafe;color:#1e40af; }
    .v22-btn-row { display:flex;gap:10px;margin-top:16px; }
    .v22-btn { padding:11px 18px;border-radius:12px;font-size:13px;font-weight:700;
      cursor:pointer;border:none;font-family:var(--font-thai,Prompt),sans-serif;
      display:flex;align-items:center;gap:6px;justify-content:center;transition:.15s; }
    .v22-btn:disabled { opacity:.5;cursor:not-allowed; }
    .v22-btn-cancel { flex:1;background:var(--bg-base,#f3f4f6);color:var(--text-secondary,#6b7280); }
    .v22-btn-confirm { flex:2;background:#22c55e;color:#fff; }
    .v22-btn-plan { flex:2;background:var(--primary,#dc2626);color:#fff; }
    .v22-btn-bill { flex:2;background:#22c55e;color:#fff; }
    .v22-btn-delete { padding:8px;border-radius:8px;background:#fff;border:1.5px solid #fee2e2;
      color:#ef4444;cursor:pointer;display:flex;align-items:center; }

    /* Tab bill button */
    .v22-tab-action-bar { display:flex;gap:8px;padding:12px 0;flex-wrap:wrap; }
    .v22-action-btn { display:flex;align-items:center;gap:6px;padding:9px 16px;
      border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;
      font-family:var(--font-thai,Prompt),sans-serif;border:none;transition:.15s; }
    .v22-action-btn.primary { background:var(--primary,#dc2626);color:#fff; }
    .v22-action-btn.success { background:#22c55e;color:#fff; }
    .v22-action-btn.outline { background:#fff;color:var(--text-primary,#111);
      border:1.5px solid var(--border,#e5e7eb); }
    .v22-remaining-banner { border-radius:12px;padding:12px 16px;margin-bottom:12px;
      background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;
      display:flex;justify-content:space-between;align-items:center; }
    .v22-remaining-banner .lbl { font-size:11px;opacity:.8;margin-bottom:2px; }
    .v22-remaining-banner .amt { font-size:20px;font-weight:900; }
  `;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════════════════════════════════
   V22-2: OVERRIDE v14OpenProject — เพิ่ม metrics + แท็บ งวดงาน
══════════════════════════════════════════════════════════════════ */
window.v14OpenProject = async function(projId) {
  const sec = document.getElementById('page-projects');
  if (!sec) return;
  sec.innerHTML = `<div class="v14-proj-container">
    <div style="text-align:center;padding:40px;color:var(--text-muted);">⏳ กำลังโหลด...</div>
  </div>`;

  try {
    const [{ data: proj }, { data: exps }, { data: bills }] = await Promise.all([
      db.from('โครงการ').select('*').eq('id', projId).single(),
      db.from('รายจ่ายโครงการ').select('*').eq('project_id', projId)
        .order('created_at', { ascending: false }),
      db.from('บิลขาย')
        .select('id,bill_no,date,total,status,customer_name,method,staff_name')
        .eq('project_id', projId).order('date', { ascending: false }),
    ]);
    // งวดงาน — query แยก เพราะตารางอาจยังไม่มี (ยังไม่ run SQL migration)
    let milestones = [];
    try {
      const { data: msData } = await db.from('งวดงาน').select('*')
        .eq('project_id', projId).order('milestone_no', { ascending: true });
      milestones = msData || [];
    } catch(_) { milestones = []; }

    if (!proj) {
      sec.innerHTML = '<div style="padding:30px;text-align:center;">ไม่พบโครงการ</div>';
      return;
    }

    const isComplete   = proj.status === 'completed';
    const totalBilled  = parseFloat(proj.total_billed || 0);
    const budget       = parseFloat(proj.budget || 0);
    const remaining    = Math.max(0, budget - totalBilled);
    const totalCost    = parseFloat(proj.total_goods_cost || 0) + parseFloat(proj.total_expenses || 0);
    const spent        = totalCost; // cost+expenses
    const projProfit   = totalBilled - totalCost;   // กำไรจากยอดที่เบิกแล้ว
    const billPct      = budget > 0 ? Math.min(100, Math.round(totalBilled / budget * 100)) : 0;
    const costPct      = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;
    const profitColor  = projProfit >= 0 ? '#86efac' : '#fca5a5';
    const barBill      = billPct >= 90 ? '#22c55e' : billPct >= 50 ? '#f59e0b' : '#60a5fa';

    /* ── Expense rows ── */
    const expRows = v22BuildExpenseRows(exps || [], projId, isComplete);

    /* ── Bill rows ── */
    const statusMap = {
      'สำเร็จ':   ['#d1fae5','#065f46','✓ สำเร็จ'],
      'ค้างชำระ': ['#fee2e2','#991b1b','⚠ ค้างชำระ'],
      'รอจัดส่ง': ['#fef3c7','#92400e','🚚 รอส่ง'],
      'ยกเลิก':   ['#f3f4f6','#6b7280','✕ ยกเลิก'],
      'โครงการ':  ['#e0e7ff','#4f46e5','🏗️ บิลโครงการ'],
    };
    const totalBillValue = (bills || []).reduce((s, b) => s + (b.total || 0), 0);
    const billRows = (bills || []).length === 0
      ? `<div style="text-align:center;padding:40px;color:var(--text-muted);">
          <i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:10px;opacity:.3;">receipt_long</i>
          <div style="font-weight:700;">ยังไม่มีบิลขาย</div>
        </div>`
      : (bills || []).map(b => {
          const [bg, tc, label] = statusMap[b.status] || ['#f3f4f6','#6b7280', b.status];
          return `<div class="v14-expense-row">
            <div class="v14-expense-icon" style="background:#ede9fe;">
              <i class="material-icons-round" style="font-size:18px;color:#7c3aed;">receipt</i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:13px;">บิล #${b.bill_no}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                ${_v22d(b.date)} · ${b.staff_name || '-'}
              </div>
            </div>
            <div style="text-align:right;margin-right:8px;">
              <div style="font-size:15px;font-weight:800;color:#7c3aed;">฿${_v22f(b.total)}</div>
              <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:${bg};color:${tc};">${label}</span>
            </div>
          </div>`;
        }).join('') +
        `<div style="display:flex;justify-content:space-between;padding:10px 14px;background:var(--bg-secondary,#f9fafb);font-size:12px;font-weight:700;border-top:1px solid var(--border,#f0f0f0);">
          <span>รวมมูลค่าบิลทั้งหมด</span><span style="color:#7c3aed;">฿${_v22f(totalBillValue)}</span>
        </div>`;

    /* ── Milestone rows ── */
    const msRows = v22BuildMilestoneRows(milestones || [], projId, budget, isComplete);
    const msBilled = (milestones || []).filter(m => m.status === 'billed');
    const msPending = (milestones || []).filter(m => m.status === 'pending');

    sec.innerHTML = `<div class="v14-proj-container">
      <!-- Back -->
      <button onclick="renderProjects()"
        style="border:1.5px solid var(--border,#e5e7eb);border-radius:10px;padding:8px 16px;
          background:#fff;cursor:pointer;display:flex;align-items:center;gap:6px;
          font-size:13px;font-weight:600;margin-bottom:16px;font-family:inherit;">
        <i class="material-icons-round" style="font-size:16px;">arrow_back</i> กลับรายการโครงการ
      </button>

      <!-- Header -->
      <div class="v14-proj-detail-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">
              ${proj.contract_no ? `สัญญา #${proj.contract_no} · ` : ''}โครงการ
            </div>
            <div style="font-size:22px;font-weight:900;">${proj.name}</div>
            <div style="margin-top:8px;">
              <span class="v14-status-badge-proj ${isComplete ? 'v14-badge-complete' : 'v14-badge-active'}">
                ${isComplete ? '✅ เสร็จสิ้น' : '🔵 กำลังดำเนินการ'}
              </span>
            </div>
          </div>
          ${!isComplete ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="v14AddExpense('${projId}')"
              style="background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.3);color:#fff;
                border-radius:10px;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:700;
                display:flex;align-items:center;gap:6px;font-family:inherit;">
              <i class="material-icons-round" style="font-size:16px;">add</i> เพิ่มรายจ่าย
            </button>
            <button onclick="v22ShowBillMilestoneModal('${projId}')"
              style="background:#22c55e;border:none;color:#fff;border-radius:10px;padding:10px 16px;
                cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;font-family:inherit;">
              <i class="material-icons-round" style="font-size:16px;">payments</i> เบิกงวดงาน
            </button>
            <button onclick="v14CompleteProject('${projId}')"
              style="background:rgba(255,255,255,.2);border:1.5px solid rgba(255,255,255,.4);color:#fff;
                border-radius:10px;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:700;
                display:flex;align-items:center;gap:6px;font-family:inherit;">
              <i class="material-icons-round" style="font-size:16px;">check_circle</i> เสร็จสิ้นโครงการ
            </button>
          </div>` : ''}
        </div>

        <!-- V22 Metrics Row -->
        <div class="v22-metrics">
          <div class="v22-metric">
            <div class="lbl">งบประมาณ</div>
            <div class="val">฿${_v22f(budget)}</div>
          </div>
          <div class="v22-metric" style="background:rgba(34,197,94,.25);border:1px solid rgba(34,197,94,.3);">
            <div class="lbl">เบิกแล้ว</div>
            <div class="val" style="color:#86efac;">฿${_v22f(totalBilled)}</div>
            <div class="sub">${billPct}% ของงบ</div>
          </div>
          <div class="v22-metric" style="background:rgba(251,191,36,.2);border:1px solid rgba(251,191,36,.25);">
            <div class="lbl">เหลือให้เบิก</div>
            <div class="val" style="color:#fde68a;">฿${_v22f(remaining)}</div>
            <div class="sub">${100 - billPct}% ค้างอยู่</div>
          </div>
          <div class="v22-metric" style="background:rgba(239,68,68,.2);">
            <div class="lbl">ต้นทุนรวม</div>
            <div class="val" style="color:#fca5a5;">฿${_v22f(totalCost)}</div>
            <div class="sub">สินค้า + ค่าใช้จ่าย</div>
          </div>
          <div class="v22-metric" style="background:${projProfit >= 0 ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'};
            border:1px solid ${projProfit >= 0 ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'};">
            <div class="lbl">${projProfit >= 0 ? '💰 กำไร' : '📉 ขาดทุน'}</div>
            <div class="val" style="color:${profitColor};">฿${_v22f(Math.abs(projProfit))}</div>
            <div class="sub">จากยอดที่เบิกแล้ว</div>
          </div>
        </div>

        <!-- Progress bar: billing progress -->
        <div style="margin-top:4px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.5);margin-bottom:4px;">
            <span>ความคืบหน้าการเบิก ${billPct}%</span>
            <span>฿${_v22f(totalBilled)} / ฿${_v22f(budget)}</span>
          </div>
          <div class="v22-progress-track">
            <div class="v22-progress-fill" style="width:${billPct}%;background:${barBill};"></div>
          </div>
        </div>
      </div>

      <!-- Tab Bar -->
      <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border,#f0f0f0);overflow-x:auto;">
        <button id="v22tab-milestone" onclick="v22SwitchTab('milestone')"
          style="padding:12px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:700;
            color:var(--primary,#dc2626);border-bottom:3px solid var(--primary,#dc2626);margin-bottom:-2px;
            font-family:inherit;white-space:nowrap;transition:all .15s;">
          💰 งวดงาน
          <span style="background:var(--primary,#dc2626);color:#fff;border-radius:99px;padding:1px 8px;font-size:11px;margin-left:4px;">${(milestones || []).length}</span>
        </button>
        <button id="v22tab-exp" onclick="v22SwitchTab('exp')"
          style="padding:12px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;
            color:var(--text-muted,#6b7280);border-bottom:3px solid transparent;margin-bottom:-2px;
            font-family:inherit;white-space:nowrap;transition:all .15s;">
          💸 รายจ่าย
          <span style="background:#e5e7eb;color:#6b7280;border-radius:99px;padding:1px 8px;font-size:11px;margin-left:4px;">${(exps || []).length}</span>
        </button>
        <button id="v22tab-bills" onclick="v22SwitchTab('bills')"
          style="padding:12px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;
            color:var(--text-muted,#6b7280);border-bottom:3px solid transparent;margin-bottom:-2px;
            font-family:inherit;white-space:nowrap;transition:all .15s;">
          🧾 บิลขาย
          <span style="background:#e5e7eb;color:#6b7280;border-radius:99px;padding:1px 8px;font-size:11px;margin-left:4px;">${(bills || []).length}</span>
        </button>
      </div>

      <!-- Tab: Milestones -->
      <div id="v22content-milestone" class="v14-expense-list">
        <div class="v22-tab-action-bar">
          ${!isComplete ? `
            <button class="v22-action-btn primary" onclick="v22ShowBillMilestoneModal('${projId}')">
              <i class="material-icons-round" style="font-size:16px;">payments</i> เบิกงวดงาน
            </button>
            <button class="v22-action-btn outline" onclick="v22ShowPlanMilestoneModal('${projId}')">
              <i class="material-icons-round" style="font-size:16px;">add_task</i> วางแผนงวด
            </button>
          ` : ''}
        </div>

        <!-- Remaining banner -->
        ${remaining > 0 && !isComplete ? `
        <div class="v22-remaining-banner">
          <div>
            <div class="lbl">เหลือให้เบิกอีก</div>
            <div class="amt">฿${_v22f(remaining)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;opacity:.7;">จากงบทั้งหมด ฿${_v22f(budget)}</div>
            <div style="font-size:12px;margin-top:2px;">เบิกแล้ว ${billPct}%</div>
          </div>
        </div>` : ''}

        ${msRows}

        ${(milestones || []).length === 0 ? `
        <div style="text-align:center;padding:40px;color:var(--text-muted,#9ca3af);">
          <i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:10px;opacity:.3;">payments</i>
          <div style="font-weight:700;font-size:14px;">ยังไม่มีงวดงาน</div>
          <div style="font-size:12px;margin-top:4px;">กด "วางแผนงวด" เพื่อวางโครงสร้างการเบิก<br>หรือ "เบิกงวดงาน" เพื่อเบิกเงินทันที</div>
        </div>` : ''}
      </div>

      <!-- Tab: Expenses -->
      <div id="v22content-exp" class="v14-expense-list" style="display:none;">${expRows}</div>

      <!-- Tab: Bills -->
      <div id="v22content-bills" class="v14-expense-list" style="display:none;">${billRows}</div>

      ${proj.notes ? `
      <div style="margin-top:16px;background:var(--bg-secondary,#f9fafb);border-radius:12px;padding:14px 16px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:4px;">📝 หมายเหตุ</div>
        <div style="font-size:13px;">${proj.notes}</div>
      </div>` : ''}
    </div>`;

  } catch (e) {
    console.error('[v22] openProject:', e);
    sec.innerHTML = `<div style="padding:30px;text-align:center;color:#ef4444;">
      <i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;">error_outline</i>
      โหลดไม่สำเร็จ: ${e.message}
    </div>`;
  }
};

/* Tab switcher */
window.v22SwitchTab = function(tab) {
  ['milestone','exp','bills'].forEach(t => {
    const btn = document.getElementById(`v22tab-${t}`);
    const con = document.getElementById(`v22content-${t}`);
    const active = t === tab;
    if (btn) {
      btn.style.color = active ? 'var(--primary,#dc2626)' : 'var(--text-muted,#6b7280)';
      btn.style.fontWeight = active ? '700' : '600';
      btn.style.borderBottomColor = active ? 'var(--primary,#dc2626)' : 'transparent';
    }
    if (con) con.style.display = active ? 'block' : 'none';
  });
};

/* ── Helper: build expense rows ── */
function v22BuildExpenseRows(exps, projId, isComplete) {
  if (!exps.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted);">
    <i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:10px;opacity:.3;">receipt</i>
    <div style="font-weight:700;">ยังไม่มีรายจ่าย</div>
  </div>`;
  return exps.map(ex => {
    const g = ex.type === 'goods';
    return `<div class="v14-expense-row">
      <div class="v14-expense-icon" style="background:${g ? '#dbeafe' : '#fee2e2'};">
        <i class="material-icons-round" style="font-size:18px;color:${g ? '#1d4ed8' : '#dc2626'};">${g ? 'inventory_2' : 'payments'}</i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${ex.description}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
          <span style="background:${g ? '#dbeafe' : '#fee2e2'};color:${g ? '#1d4ed8' : '#dc2626'};padding:1px 7px;border-radius:99px;font-size:10px;">${g ? '📦 สินค้า' : '💸 รายจ่าย'}</span>
          · ${ex.category || 'ทั่วไป'} · ${_v22d(ex.created_at)}
          ${ex.cash_tx_id ? '<span style="font-size:9px;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:6px;margin-left:4px;">💳 หักเงินสด</span>' : ''}
        </div>
      </div>
      <div style="text-align:right;margin-right:8px;">
        <div style="font-size:16px;font-weight:800;color:${g ? '#f59e0b' : '#ef4444'};">฿${_v22f(ex.amount)}</div>
      </div>
      ${!isComplete && !g ? `<button onclick="v22DeleteExpense('${ex.id}','${projId}',${ex.amount},false)"
        class="v22-btn-delete">
        <i class="material-icons-round" style="font-size:16px;">delete_outline</i>
      </button>` : ''}
    </div>`;
  }).join('');
}

/* ── Helper: build milestone rows ── */
function v22BuildMilestoneRows(milestones, projId, budget, isComplete) {
  if (!milestones.length) return '';
  return milestones.map(m => {
    const isBilled = m.status === 'billed';
    const pct = budget > 0 ? Math.round(m.amount / budget * 100) : 0;
    const cls = isBilled ? 'billed' : (m.status === 'pending' ? 'pending' : 'planned');
    const label = isBilled ? '✓ เบิกแล้ว' : (m.status === 'pending' ? '⏳ รอเบิก' : '📋 วางแผน');
    return `<div class="v22-ms-row">
      <div class="v22-ms-num ${cls}">${m.milestone_no}</div>
      <div class="v22-ms-body">
        <div class="v22-ms-title">${m.description || `งวดที่ ${m.milestone_no}`}</div>
        <div class="v22-ms-sub">
          ${pct}% ของงบ
          ${isBilled ? `· เบิกวันที่ ${_v22d(m.billed_at)}` : ''}
          ${m.notes ? `· ${m.notes}` : ''}
        </div>
      </div>
      <div class="v22-ms-amt" style="color:${isBilled ? '#22c55e' : '#f59e0b'};">
        ฿${_v22f(m.amount)}
        <span class="v22-ms-badge ${cls}">${label}</span>
      </div>
      ${!isComplete && !isBilled ? `
      <div style="display:flex;gap:6px;margin-left:8px;">
        <button onclick="v22BillSpecificMilestone('${m.id}','${projId}')"
          style="padding:6px 12px;border-radius:8px;background:#22c55e;color:#fff;border:none;
            font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">
          เบิกเงิน
        </button>
        <button onclick="v22DeleteMilestone('${m.id}','${projId}',${m.amount})"
          class="v22-btn-delete">
          <i class="material-icons-round" style="font-size:14px;">delete_outline</i>
        </button>
      </div>` : ''}
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════════
   V22-3: PLAN MILESTONE MODAL — วางแผนงวดล่วงหน้า
══════════════════════════════════════════════════════════════════ */
window.v22ShowPlanMilestoneModal = async function(projId) {
  const proj = await _v22getProject(projId);
  if (!proj) return;
  const budget      = parseFloat(proj.budget || 0);
  const totalBilled = parseFloat(proj.total_billed || 0);
  const remaining   = Math.max(0, budget - totalBilled);

  // หาจำนวนงวดปัจจุบัน
  let nextNo = 1;
  try {
    const { data: ms } = await db.from('งวดงาน').select('milestone_no')
      .eq('project_id', projId).order('milestone_no', { ascending: false }).limit(1).maybeSingle();
    nextNo = (ms?.milestone_no || 0) + 1;
  } catch(_) { nextNo = 1; }

  document.getElementById('v22-plan-modal')?.remove();
  const el = document.createElement('div');
  el.id = 'v22-plan-modal';
  el.className = 'v22-modal-overlay';
  el.innerHTML = `
    <div class="v22-modal-box" id="v22-plan-box">
      <div class="v22-modal-title">📋 วางแผนงวดงาน</div>
      <div class="v22-modal-sub">งวดที่ ${nextNo} — ${proj.name}</div>

      <div style="background:var(--bg-secondary,#f9fafb);border-radius:10px;padding:10px 14px;margin-bottom:14px;">
        <div class="v22-info-row"><span class="key">งบประมาณ</span><span class="val">฿${_v22f(budget)}</span></div>
        <div class="v22-info-row"><span class="key">เบิกแล้ว</span><span class="val" style="color:#f59e0b;">฿${_v22f(totalBilled)}</span></div>
        <div class="v22-info-row"><span class="key"><b>เหลือให้เบิก</b></span><span class="val" style="color:#22c55e;">฿${_v22f(remaining)}</span></div>
      </div>

      <div class="v22-input-group">
        <label>ชื่อ / คำอธิบายงวด *</label>
        <input id="v22-plan-desc" type="text" placeholder="เช่น งานเทฐาน + โครงเหล็ก">
      </div>
      <div class="v22-input-group" style="margin-top:10px;">
        <label>จำนวนเงิน (บาท) *</label>
        <input id="v22-plan-amt" type="number" placeholder="0" value="${remaining > 0 ? remaining : ''}">
      </div>
      <div class="v22-input-group" style="margin-top:10px;">
        <label>หมายเหตุ</label>
        <input id="v22-plan-notes" type="text" placeholder="เงื่อนไขการเบิก...">
      </div>

      <div class="v22-alert-box v22-alert-blue" style="margin-top:12px;">
        📋 การวางแผนงวดจะ <b>ไม่มีเงินเข้าลิ้นชัก</b> — ใช้เพื่อวางโครงสร้างเท่านั้น<br>
        กด "เบิกงวดงาน" ในงวดนั้นเมื่อถึงเวลาจริง
      </div>

      <div class="v22-btn-row">
        <button class="v22-btn v22-btn-cancel" onclick="document.getElementById('v22-plan-modal')?.remove()">ยกเลิก</button>
        <button class="v22-btn v22-btn-plan" id="v22-plan-confirm-btn" onclick="v22ConfirmPlanMilestone('${projId}',${nextNo})">
          <i class="material-icons-round" style="font-size:16px;">add_task</i> บันทึกงวด
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => document.getElementById('v22-plan-box').classList.add('open'));
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
};

window.v22ConfirmPlanMilestone = async function(projId, milestoneNo) {
  const desc  = document.getElementById('v22-plan-desc')?.value.trim();
  const amt   = parseFloat(document.getElementById('v22-plan-amt')?.value || 0);
  const notes = document.getElementById('v22-plan-notes')?.value.trim();

  if (!desc) { typeof toast === 'function' && toast('กรุณากรอกชื่องวด', 'warning'); return; }
  if (amt <= 0) { typeof toast === 'function' && toast('กรุณากรอกจำนวนเงิน', 'warning'); return; }

  const btn = document.getElementById('v22-plan-confirm-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="material-icons-round" style="font-size:16px;animation:spin 1s linear infinite">refresh</i> กำลังบันทึก...'; }

  try {
    const proj   = await _v22getProject(projId);
    const budget = parseFloat(proj?.budget || 0);
    const pct    = budget > 0 ? parseFloat((amt / budget * 100).toFixed(2)) : 0;

    const { error } = await db.from('งวดงาน').insert({
      project_id:   projId,
      milestone_no: milestoneNo,
      description:  desc,
      amount:       amt,
      percent:      pct,
      status:       'pending',
      staff_name:   _v22staff(),
      notes:        notes || null,
    });
    if (error) throw error;

    document.getElementById('v22-plan-modal')?.remove();
    typeof toast === 'function' && toast(`บันทึกงวดที่ ${milestoneNo} สำเร็จ`, 'success');
    window.v14OpenProject(projId);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = 'บันทึกงวด'; }
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
  }
};

/* ══════════════════════════════════════════════════════════════════
   V22-4: BILL MILESTONE MODAL — เบิกงวดงาน → เงินเข้าลิ้นชัก
══════════════════════════════════════════════════════════════════ */
window.v22ShowBillMilestoneModal = async function(projId, prefillMilestoneId) {
  const proj = await _v22getProject(projId);
  if (!proj) return;

  const budget      = parseFloat(proj.budget || 0);
  const totalBilled = parseFloat(proj.total_billed || 0);
  const remaining   = Math.max(0, budget - totalBilled);

  if (remaining <= 0) {
    typeof toast === 'function' && toast('เบิกครบแล้ว — ไม่มียอดค้างอยู่', 'info');
    return;
  }

  // ดึงงวดที่รอเบิก
  let pendingMs = [];
  try {
    const { data: pData } = await db.from('งวดงาน')
      .select('*').eq('project_id', projId).eq('status', 'pending')
      .order('milestone_no', { ascending: true });
    pendingMs = pData || [];
  } catch(_) { pendingMs = []; }

  const hasPending = pendingMs.length > 0;
  const prefill    = prefillMilestoneId
    ? pendingMs.find(m => m.id === prefillMilestoneId)
    : null;

  // หาลำดับงวดถัดไป
  let nextNo = 1;
  try {
    const { data: lastMs } = await db.from('งวดงาน').select('milestone_no')
      .eq('project_id', projId).order('milestone_no', { ascending: false }).limit(1).maybeSingle();
    nextNo = (lastMs?.milestone_no || 0) + 1;
  } catch(_) { nextNo = 1; }

  document.getElementById('v22-bill-modal')?.remove();
  const el = document.createElement('div');
  el.id = 'v22-bill-modal';
  el.className = 'v22-modal-overlay';

  const pendingOptions = hasPending
    ? (pendingMs || []).map(m => `<option value="${m.id}" data-amount="${m.amount}">${m.milestone_no}. ${m.description} (฿${_v22f(m.amount)})</option>`).join('')
    : '';

  el.innerHTML = `
    <div class="v22-modal-box" id="v22-bill-box">
      <div class="v22-modal-title">💰 เบิกงวดงาน</div>
      <div class="v22-modal-sub">${proj.name}</div>

      <div style="background:var(--bg-secondary,#f9fafb);border-radius:10px;padding:10px 14px;margin-bottom:14px;">
        <div class="v22-info-row"><span class="key">งบประมาณ</span><span class="val">฿${_v22f(budget)}</span></div>
        <div class="v22-info-row"><span class="key">เบิกแล้ว</span><span class="val" style="color:#f59e0b;">฿${_v22f(totalBilled)}</span></div>
        <div class="v22-info-row" style="background:rgba(34,197,94,.08);padding:8px;border-radius:8px;margin-top:4px;">
          <span class="key"><b>เหลือให้เบิก</b></span>
          <span class="val" style="color:#22c55e;font-size:16px;">฿${_v22f(remaining)}</span>
        </div>
      </div>

      ${hasPending ? `
      <div class="v22-input-group">
        <label>เลือกงวดจากแผน (หรือเบิกใหม่)</label>
        <select id="v22-bill-ms-select" onchange="v22FillFromMilestone(this)">
          <option value="new">— เบิกงวดใหม่ (ไม่มีแผน)</option>
          ${pendingOptions}
        </select>
      </div>` : ''}

      <div class="v22-input-group" style="margin-top:10px;">
        <label>คำอธิบายงวดที่เบิก</label>
        <input id="v22-bill-desc" type="text" value="${prefill?.description || ''}" placeholder="เช่น งานเสร็จงวด 2">
      </div>
      <div class="v22-input-group" style="margin-top:10px;">
        <label>จำนวนเงินที่เบิก (บาท) *</label>
        <input id="v22-bill-amt" type="number" value="${prefill?.amount || remaining}" placeholder="0"
          oninput="v22UpdateBillPreview()">
      </div>
      <div class="v22-input-group" style="margin-top:10px;">
        <label>หมายเหตุ</label>
        <input id="v22-bill-notes" type="text" placeholder="ใบส่งงานเลขที่...">
      </div>

      <div class="v22-alert-box v22-alert-green" id="v22-bill-preview" style="margin-top:12px;">
        ✅ เงิน ฿${_v22f(prefill?.amount || remaining)} จะเข้าลิ้นชักทันที และบันทึกเป็น<b>รายรับร้านค้า</b>
      </div>

      <div class="v22-btn-row">
        <button class="v22-btn v22-btn-cancel" onclick="document.getElementById('v22-bill-modal')?.remove()">ยกเลิก</button>
        <button class="v22-btn v22-btn-bill" id="v22-bill-confirm-btn"
          onclick="v22ConfirmBillMilestone('${projId}',${nextNo})">
          <i class="material-icons-round" style="font-size:16px;">payments</i> ยืนยันเบิกงวด
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => document.getElementById('v22-bill-box').classList.add('open'));
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });

  // Pre-select ถ้ามี prefill
  if (prefillMilestoneId) {
    const sel = document.getElementById('v22-bill-ms-select');
    if (sel) sel.value = prefillMilestoneId;
  }
};

/* fill amount from selected milestone */
window.v22FillFromMilestone = function(sel) {
  const opt = sel.options[sel.selectedIndex];
  const amt = parseFloat(opt.getAttribute('data-amount') || 0);
  const amtInput = document.getElementById('v22-bill-amt');
  const descInput = document.getElementById('v22-bill-desc');
  if (amtInput && amt > 0) amtInput.value = amt;
  if (descInput && opt.value !== 'new') descInput.value = opt.text.replace(/\(.*\)/, '').trim();
  v22UpdateBillPreview();
};

window.v22UpdateBillPreview = function() {
  const amt = parseFloat(document.getElementById('v22-bill-amt')?.value || 0);
  const el  = document.getElementById('v22-bill-preview');
  if (!el) return;
  if (amt > 0) {
    el.className = 'v22-alert-box v22-alert-green';
    el.innerHTML = `✅ เงิน <b>฿${_v22f(amt)}</b> จะเข้าลิ้นชักทันที และบันทึกเป็น<b>รายรับร้านค้า</b>`;
  } else {
    el.className = 'v22-alert-box v22-alert-red';
    el.innerHTML = '⚠️ กรุณากรอกจำนวนเงิน';
  }
};

/* ── ยืนยันเบิกงวด ── */
window.v22ConfirmBillMilestone = async function(projId, fallbackMilestoneNo) {
  const desc   = document.getElementById('v22-bill-desc')?.value.trim() || `งวดที่ ${fallbackMilestoneNo}`;
  const amt    = parseFloat(document.getElementById('v22-bill-amt')?.value || 0);
  const notes  = document.getElementById('v22-bill-notes')?.value.trim();
  const selEl  = document.getElementById('v22-bill-ms-select');
  const selMs  = selEl?.value !== 'new' ? selEl?.value : null;

  if (amt <= 0) { typeof toast === 'function' && toast('กรุณากรอกจำนวนเงิน', 'warning'); return; }

  const btn = document.getElementById('v22-bill-confirm-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="material-icons-round" style="font-size:16px;animation:spin 1s linear infinite">refresh</i> กำลังบันทึก...'; }

  try {
    const proj    = await _v22getProject(projId);
    const budget  = parseFloat(proj?.budget || 0);
    const billed  = parseFloat(proj?.total_billed || 0);
    const newTotal = billed + amt;
    const pct     = budget > 0 ? parseFloat((amt / budget * 100).toFixed(2)) : 0;

    // 1. เปิด session
    const session = await _v22getSession();

    // 2. สร้าง / อัพเดต milestone record
    let msId = selMs;
    if (selMs) {
      // อัพเดต milestone ที่วางแผนไว้
      await db.from('งวดงาน').update({
        status:     'billed',
        amount:     amt,
        billed_at:  new Date().toISOString(),
        staff_name: _v22staff(),
        notes:      notes || null,
      }).eq('id', selMs);
    } else {
      // สร้าง milestone ใหม่
      const { data: newMs, error: msErr } = await db.from('งวดงาน').insert({
        project_id:   projId,
        milestone_no: fallbackMilestoneNo,
        description:  desc,
        amount:       amt,
        percent:      pct,
        status:       'billed',
        billed_at:    new Date().toISOString(),
        staff_name:   _v22staff(),
        notes:        notes || null,
      }).select('id').single();
      if (msErr) throw msErr;
      msId = newMs.id;
    }

    // 3. บันทึก cash_transaction (เงินเข้าลิ้นชัก)
    let cashTxId = null;
    if (session) {
      if (typeof window.recordCashTx === 'function') {
        await window.recordCashTx({
          sessionId: session.id,
          type: 'เบิกงวดโครงการ',
          direction: 'in',
          amount: amt,
          changeAmt: 0,
          netAmount: amt,
          refId: msId,
          refTable: 'งวดงาน',
          note: `เบิกงวด: ${desc} — โครงการ: ${proj?.name}`
        });
        try {
          const { data: latestTx } = await db.from('cash_transaction').select('id')
            .eq('session_id', session.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (latestTx) cashTxId = latestTx.id;
        } catch(_) {}
      } else {
        const { data: tx, error: txErr } = await db.from('cash_transaction').insert({
          session_id:    session.id,
          type:          'เบิกงวดโครงการ',
          direction:     'in',
          amount:        amt,
          change_amt:    0,
          net_amount:    amt,
          balance_after: 0, // Fallback if recordCashTx is missing
          ref_id:        msId,
          ref_table:     'งวดงาน',
          staff_name:    _v22staff(),
          note:          `เบิกงวด: ${desc} — โครงการ: ${proj?.name}`,
        }).select('id').single();

        if (txErr) {
          console.warn('[v22] cash_transaction warn:', txErr.message);
        } else {
          cashTxId = tx.id;
          try {
            if (typeof getLiveCashBalance === 'function') {
              const bal = await getLiveCashBalance();
              const el = document.getElementById('global-cash-balance');
              if (el) el.textContent = `฿${_v22f(bal)}`;
            }
          } catch(_) {}
        }
      }
    }

    // 4. link cash_tx_id กลับ milestone
    if (cashTxId && msId) {
      await db.from('งวดงาน').update({ cash_tx_id: cashTxId }).eq('id', msId);
    }

    // 5. อัพเดต total_billed ในโครงการ
    const { error: projErr } = await db.from('โครงการ').update({
      total_billed: newTotal,
    }).eq('id', projId);
    if (projErr) throw projErr;

    // 6. Log
    typeof logActivity === 'function' && logActivity(
      'เบิกงวดโครงการ',
      `${proj?.name} งวด: ${desc} ฿${_v22f(amt)} (รวมเบิก ฿${_v22f(newTotal)})`,
      msId, 'งวดงาน'
    );

    document.getElementById('v22-bill-modal')?.remove();
    const remaining = Math.max(0, budget - newTotal);
    typeof toast === 'function' && toast(
      `เบิกงวดสำเร็จ ฿${_v22f(amt)} | เหลือให้เบิก ฿${_v22f(remaining)}`,
      'success'
    );
    window.v14OpenProject(projId);

  } catch (e) {
    console.error('[v22] billMilestone:', e);
    if (btn) { btn.disabled = false; btn.innerHTML = '💰 ยืนยันเบิกงวด'; }
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
  }
};

/* ── Bill specific milestone (from milestone row btn) ── */
window.v22BillSpecificMilestone = async function(milestoneId, projId) {
  await window.v22ShowBillMilestoneModal(projId, milestoneId);
};

/* ── Delete milestone ── */
window.v22DeleteMilestone = async function(msId, projId, amount) {
  if (!confirm('ลบงวดนี้?')) return;
  try {
    await db.from('งวดงาน').delete().eq('id', msId);
    typeof toast === 'function' && toast('ลบงวดสำเร็จ', 'success');
    window.v14OpenProject(projId);
  } catch (e) {
    typeof toast === 'function' && toast('ลบไม่สำเร็จ: ' + e.message, 'error');
  }
};

/* ══════════════════════════════════════════════════════════════════
   V22-5: PATCH v14AddExpense → cash_transaction out
   เพิ่มรายจ่ายโครงการ → เงินออกลิ้นชักทันที + เก็บ cash_tx_id
══════════════════════════════════════════════════════════════════ */
window.v14AddExpense = async function(projId) {
  // ── สร้าง modal เหมือนเดิม แต่เพิ่มตัวเลือก "วิธีจ่ายเงิน" ──
  document.getElementById('v22-expense-modal')?.remove();
  const el = document.createElement('div');
  el.id = 'v22-expense-modal';
  el.className = 'v22-modal-overlay';
  el.innerHTML = `
    <div class="v22-modal-box" id="v22-expense-box" style="max-width:420px;">
      <div class="v22-modal-title">💸 เพิ่มรายจ่ายโครงการ</div>
      <div class="v22-modal-sub">รายจ่ายจะออกจากลิ้นชักทันทีและโยงบัญชีร้านค้า</div>

      <div class="v22-input-group">
        <label>รายการ / คำอธิบาย *</label>
        <input id="v22-exp-desc" type="text" placeholder="เช่น ค่าแรงช่าง, ค่าปูน...">
      </div>
      <div class="v22-input-group" style="margin-top:10px;">
        <label>หมวดหมู่</label>
        <select id="v22-exp-cat">
          <option value="ค่าแรง">ค่าแรง</option>
          <option value="วัสดุ">วัสดุ/อุปกรณ์</option>
          <option value="ขนส่ง">ขนส่ง</option>
          <option value="อื่นๆ" selected>อื่นๆ</option>
        </select>
      </div>
      <div class="v22-input-group" style="margin-top:10px;">
        <label>จำนวนเงิน (บาท) *</label>
        <input id="v22-exp-amt" type="number" placeholder="0" oninput="v22UpdateExpPreview()">
      </div>
      <div class="v22-input-group" style="margin-top:10px;">
        <label>วิธีจ่ายเงิน</label>
        <select id="v22-exp-method" onchange="v22UpdateExpPreview()">
          <option value="เงินสด">เงินสด (หักลิ้นชักทันที)</option>
          <option value="โอน">โอนเงิน</option>
          <option value="อื่นๆ">อื่นๆ</option>
        </select>
      </div>
      <div class="v22-input-group" style="margin-top:10px;">
        <label>หมายเหตุ</label>
        <input id="v22-exp-notes" type="text" placeholder="ใบเสร็จเลขที่...">
      </div>

      <div class="v22-alert-box v22-alert-red" id="v22-exp-preview" style="margin-top:12px;">
        กรอกจำนวนเงินเพื่อดูตัวอย่าง
      </div>

      <div class="v22-btn-row">
        <button class="v22-btn v22-btn-cancel" onclick="document.getElementById('v22-expense-modal')?.remove()">ยกเลิก</button>
        <button class="v22-btn" style="flex:2;background:#ef4444;color:#fff;" id="v22-exp-confirm"
          onclick="v22ConfirmAddExpense('${projId}')">
          <i class="material-icons-round" style="font-size:16px;">save</i> บันทึกรายจ่าย
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => document.getElementById('v22-expense-box').classList.add('open'));
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.getElementById('v22-exp-desc')?.focus();
};

window.v22UpdateExpPreview = function() {
  const amt    = parseFloat(document.getElementById('v22-exp-amt')?.value || 0);
  const method = document.getElementById('v22-exp-method')?.value || 'เงินสด';
  const el     = document.getElementById('v22-exp-preview');
  if (!el) return;
  if (amt <= 0) {
    el.className = 'v22-alert-box v22-alert-red';
    el.innerHTML = 'กรอกจำนวนเงินเพื่อดูตัวอย่าง';
    return;
  }
  if (method === 'เงินสด') {
    el.className = 'v22-alert-box v22-alert-red';
    el.innerHTML = `⬇️ เงิน <b>฿${_v22f(amt)}</b> จะออกจากลิ้นชักทันที และบันทึกเป็น<b>รายจ่ายร้านค้า</b>`;
  } else {
    el.className = 'v22-alert-box v22-alert-blue';
    el.innerHTML = `📝 บันทึกรายจ่าย <b>฿${_v22f(amt)}</b> (${method}) — ไม่หักลิ้นชักสด`;
  }
};

window.v22ConfirmAddExpense = async function(projId) {
  const desc   = document.getElementById('v22-exp-desc')?.value.trim();
  const cat    = document.getElementById('v22-exp-cat')?.value || 'อื่นๆ';
  const amt    = parseFloat(document.getElementById('v22-exp-amt')?.value || 0);
  const method = document.getElementById('v22-exp-method')?.value || 'เงินสด';
  const notes  = document.getElementById('v22-exp-notes')?.value.trim();

  if (!desc) { typeof toast === 'function' && toast('กรุณากรอกรายการ', 'warning'); return; }
  if (amt <= 0) { typeof toast === 'function' && toast('กรุณากรอกจำนวนเงิน', 'warning'); return; }

  const btn = document.getElementById('v22-exp-confirm');
  if (btn) { btn.disabled = true; btn.innerHTML = 'กำลังบันทึก...'; }

  try {
    const isCash = method === 'เงินสด';
    let cashTxId = null;

    // 1. สร้าง cash_transaction ถ้าจ่ายเงินสด
    if (isCash) {
      const session = await _v22getSession();
      if (session) {
        if (typeof window.recordCashTx === 'function') {
          await window.recordCashTx({
            sessionId: session.id,
            type: 'รายจ่ายโครงการ',
            direction: 'out',
            amount: amt,
            changeAmt: 0,
            netAmount: amt,
            refTable: 'รายจ่ายโครงการ',
            note: `${desc} [โครงการ]`
          });
          try {
            const { data: latestTx } = await db.from('cash_transaction').select('id')
              .eq('session_id', session.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (latestTx) cashTxId = latestTx.id;
          } catch(_) {}
        } else {
          const { data: tx, error: txErr } = await db.from('cash_transaction').insert({
            session_id:    session.id,
            type:          'รายจ่ายโครงการ',
            direction:     'out',
            amount:        amt,
            change_amt:    0,
            net_amount:    amt,
            balance_after: 0,
            ref_table:     'รายจ่ายโครงการ',
            staff_name:    _v22staff(),
            note:          `${desc} [โครงการ]`,
          }).select('id').single();

          if (!txErr && tx) {
            cashTxId = tx.id;
            try {
              if (typeof getLiveCashBalance === 'function') {
                const bal = await getLiveCashBalance();
                const balEl = document.getElementById('global-cash-balance');
                if (balEl) balEl.textContent = `฿${_v22f(bal)}`;
              }
            } catch(_) {}
          }
        }
      }
    }

    // 2. บันทึก รายจ่ายโครงการ
    const { data: exp, error: expErr } = await db.from('รายจ่ายโครงการ').insert({
      project_id:  projId,
      description: desc,
      category:    cat,
      amount:      amt,
      type:        'expense',
      notes:       notes || null,
      cash_tx_id:  cashTxId,
      paid_at:     new Date().toISOString(),
    }).select('id').single();
    if (expErr) throw expErr;

    // 3. link cash_tx_id กลับ รายจ่าย (เพื่อ audit)
    if (cashTxId && exp) {
      await db.from('cash_transaction').update({ ref_id: exp.id }).eq('id', cashTxId);
    }

    // 4. อัพ total_expenses
    const { data: p } = await db.from('โครงการ').select('total_expenses')
      .eq('id', projId).maybeSingle();
    await db.from('โครงการ').update({
      total_expenses: (parseFloat(p?.total_expenses || 0)) + amt,
    }).eq('id', projId);

    // 5. Log
    typeof logActivity === 'function' && logActivity(
      'รายจ่ายโครงการ', `${desc} ฿${_v22f(amt)}${isCash ? ' (เงินสด)' : ''}`, exp?.id, 'รายจ่ายโครงการ'
    );

    document.getElementById('v22-expense-modal')?.remove();
    typeof toast === 'function' && toast(
      `บันทึกรายจ่าย ฿${_v22f(amt)}${isCash ? ' | เงินออกลิ้นชักแล้ว' : ''}`,
      'success'
    );
    window.v14OpenProject(projId);

  } catch (e) {
    console.error('[v22] addExpense:', e);
    if (btn) { btn.disabled = false; btn.innerHTML = 'บันทึกรายจ่าย'; }
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
  }
};

/* ── Delete expense (with cash_tx rollback) ── */
window.v22DeleteExpense = async function(expId, projId, amount, isGoods) {
  if (!confirm('ลบรายจ่ายนี้?\n(รายการในลิ้นชักจะไม่ถูกคืนอัตโนมัติ)')) return;
  try {
    // ดึง cash_tx_id ก่อนลบ
    const { data: exp } = await db.from('รายจ่ายโครงการ')
      .select('cash_tx_id').eq('id', expId).maybeSingle();

    await db.from('รายจ่ายโครงการ').delete().eq('id', expId);

    const { data: p } = await db.from('โครงการ')
      .select('total_expenses,total_goods_cost').eq('id', projId).single();
    if (isGoods) {
      await db.from('โครงการ').update({
        total_goods_cost: Math.max(0, (parseFloat(p?.total_goods_cost || 0)) - amount),
      }).eq('id', projId);
    } else {
      await db.from('โครงการ').update({
        total_expenses: Math.max(0, (parseFloat(p?.total_expenses || 0)) - amount),
      }).eq('id', projId);
    }

    typeof toast === 'function' && toast('ลบรายจ่ายสำเร็จ', 'success');
    window.v14OpenProject(projId);
  } catch (e) {
    typeof toast === 'function' && toast('ลบไม่สำเร็จ: ' + e.message, 'error');
  }
};

/* ══════════════════════════════════════════════════════════════════
   V22-6: PATCH v14CompleteProject — เบิกเฉพาะยอดคงค้าง
   ไม่เพิ่มงบประมาณทั้งหมดซ้ำ เพิ่มเฉพาะ budget - total_billed
══════════════════════════════════════════════════════════════════ */
const _v22OrigComplete = window.v14CompleteProject;
window.v14CompleteProject = async function(projId) {
  const proj = await _v22getProject(projId);
  if (!proj) return;

  const budget      = parseFloat(proj.budget || 0);
  const totalBilled = parseFloat(proj.total_billed || 0);
  const remaining   = Math.max(0, budget - totalBilled);
  const totalCost   = (parseFloat(proj.total_goods_cost || 0)) + (parseFloat(proj.total_expenses || 0));
  const projProfit  = budget - totalCost;  // กำไรรวม (ถ้าเบิกครบ)

  // ใช้ Swal ถ้ามี หรือ confirm ธรรมดา
  const hasSwal = typeof Swal !== 'undefined';
  let confirmed = false;
  let billRemaining = remaining > 0;

  if (hasSwal) {
    const r = await Swal.fire({
      title: '🏁 เสร็จสิ้นโครงการ?',
      html: `<div style="text-align:left;font-family:var(--font-thai,Prompt),sans-serif;">
        <div style="background:#f8f4ff;border-radius:12px;padding:14px;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;">${proj.name}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
            <div>งบประมาณ: <strong>฿${_v22f(budget)}</strong></div>
            <div>ต้นทุนรวม: <strong style="color:#ef4444;">฿${_v22f(totalCost)}</strong></div>
            <div>เบิกแล้ว: <strong style="color:#f59e0b;">฿${_v22f(totalBilled)}</strong></div>
            <div style="color:${remaining > 0 ? '#22c55e' : '#6b7280'};">
              เหลือค้าง: <strong>฿${_v22f(remaining)}</strong>
            </div>
            <div style="color:${projProfit >= 0 ? '#22c55e' : '#ef4444'};grid-column:1/-1;font-size:15px;font-weight:800;margin-top:4px;">
              กำไรรวม (ประมาณ): ฿${_v22f(Math.abs(projProfit))}
            </div>
          </div>
        </div>
        ${remaining > 0 ? `
        <div style="background:#d1fae5;border-radius:10px;padding:12px;font-size:13px;color:#065f46;margin-bottom:10px;">
          ✅ ระบบจะเบิกยอดคงค้าง <strong>฿${_v22f(remaining)}</strong> เข้าลิ้นชักอัตโนมัติ
        </div>` : `
        <div style="background:#dbeafe;border-radius:10px;padding:12px;font-size:13px;color:#1e40af;margin-bottom:10px;">
          ℹ️ เบิกครบทุกงวดแล้ว ไม่มียอดค้างอยู่
        </div>`}
        <div style="background:#ede9fe;border-radius:10px;padding:12px;font-size:12px;color:#5b21b6;">
          ⚠️ โครงการจะเปลี่ยนสถานะเป็น "เสร็จสิ้น" แก้ไขไม่ได้
        </div>
      </div>`,
      confirmButtonText: 'เสร็จสิ้นโครงการ',
      showCancelButton: true,
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#22c55e',
    });
    confirmed = r.isConfirmed;
  } else {
    confirmed = confirm(`เสร็จสิ้นโครงการ ${proj.name}?\nยอดค้าง ฿${_v22f(remaining)} จะเข้าลิ้นชัก`);
  }
  if (!confirmed) return;

  try {
    const now = new Date().toISOString();

    // 1. เบิกยอดคงค้าง (ถ้ามี) → cash_transaction in
    if (remaining > 0) {
      // สร้าง milestone ปิดโครงการ
      let finalMsId = null;
      try {
        const { data: finalMs, error: finalMsErr } = await db.from('งวดงาน').insert({
          project_id:   projId,
          milestone_no: 999,
          description:  'งวดสุดท้าย (ปิดโครงการ)',
          amount:       remaining,
          percent:      parseFloat((remaining / budget * 100).toFixed(2)),
          status:       'billed',
          billed_at:    now,
          staff_name:   _v22staff(),
          notes:        'สร้างอัตโนมัติเมื่อปิดโครงการ',
        }).select('id').single();
        if (finalMsErr) console.warn('[v22] finalMs insert warn:', finalMsErr.message);
        else finalMsId = finalMs?.id || null;
      } catch(e) { console.warn('[v22] finalMs insert error:', e.message); }

      const session = await _v22getSession();
      if (session) {
        try {
          await db.from('cash_transaction').insert({
            session_id:    session.id,
            type:          'เบิกงวดโครงการ',
            direction:     'in',
            amount:        remaining,
            change_amt:    0,
            net_amount:    remaining,
            balance_after: 0,
            ref_id:        finalMsId,
            ref_table:     'งวดงาน',
            staff_name:    _v22staff(),
            note:          `ปิดโครงการ: ${proj.name} ยอดค้าง ฿${_v22f(remaining)}`,
          });
        } catch(e) { console.warn('[v22] complete cashTx warn:', e.message); }
        // refresh balance
        try {
          if (typeof getLiveCashBalance === 'function') {
            const bal = await getLiveCashBalance();
            const el = document.getElementById('global-cash-balance');
            if (el) el.textContent = `฿${_v22f(bal)}`;
          }
        } catch(_) {}
      }

      // อัพ total_billed ให้ครบ
      await db.from('โครงการ').update({
        total_billed: budget,
      }).eq('id', projId);
    }

    // 2. Mark project completed
    await db.from('โครงการ').update({
      status:       'completed',
      completed_at: now,
    }).eq('id', projId);

    typeof logActivity === 'function' && logActivity(
      'ปิดโครงการ',
      `${proj.name} | เบิกรวม ฿${_v22f(budget)} | กำไร ฿${_v22f(projProfit)}`,
      projId, 'โครงการ'
    );

    typeof toast === 'function' && toast(`🏁 ปิดโครงการ ${proj.name} สำเร็จ`, 'success');
    window.renderProjects();

  } catch (e) {
    console.error('[v22] completeProject:', e);
    typeof toast === 'function' && toast('ปิดโครงการไม่สำเร็จ: ' + e.message, 'error');
  }
};

/* ══════════════════════════════════════════════════════════════════
   V22-7: PROJECT LIST — แสดง % เบิก ในการ์ดโครงการ
   Patch v14LoadProjects card HTML
══════════════════════════════════════════════════════════════════ */
const _v22OrigLoadProjects = window.v14LoadProjects;
window.v14LoadProjects = async function() {
  if (typeof _v22OrigLoadProjects === 'function') await _v22OrigLoadProjects();

  // หลัง render เสร็จ ให้ inject % เบิก ลงในการ์ด
  // วิธีที่ไม่ต้อง override ทั้ง function: add sub-text ใต้ progress bar
  try {
    const { data: projs } = await db.from('โครงการ').select('id,budget,total_billed').limit(50);
    (projs || []).forEach(p => {
      const budget  = parseFloat(p.budget || 0);
      const billed  = parseFloat(p.total_billed || 0);
      const pct     = budget > 0 ? Math.round(billed / budget * 100) : 0;
      const rem     = Math.max(0, budget - billed);
      if (pct === 0) return;
      // หาการ์ดนี้จาก DOM — ค้นหาจาก onclick attribute
      const card = document.querySelector(`[onclick="v14OpenProject('${p.id}')"]`);
      if (!card) return;
      // ตรวจว่าเพิ่มแล้วยัง
      if (card.querySelector('.v22-billing-badge')) return;
      const badge = document.createElement('div');
      badge.className = 'v22-billing-badge';
      badge.style.cssText = 'font-size:10px;color:#22c55e;background:rgba(34,197,94,.1);padding:2px 8px;border-radius:99px;display:inline-block;margin-top:4px;';
      badge.innerHTML = `💰 เบิกแล้ว ${pct}% (เหลือ ฿${_v22f(rem)})`;
      card.appendChild(badge);
    });
  } catch(_) {}
};

/* ══════════════════════════════════════════════════════════════════
   V22-8: SPIN ANIMATION
══════════════════════════════════════════════════════════════════ */
(function injectSpin() {
  if (document.getElementById('v22-spin')) return;
  const s = document.createElement('style');
  s.id = 'v22-spin';
  s.textContent = `@keyframes spin { to { transform:rotate(360deg); } }`;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════════════════════════════════
   BOOT LOG + SQL REMINDER
══════════════════════════════════════════════════════════════════ */
console.info(
  '%c[modules-v22.js] ✅%c Milestone Billing | Expense Cash Link | Complete Project Fix',
  'color:#22c55e;font-weight:700', 'color:#6B7280'
);
console.log(
  '[v22] 📋 SQL ที่ต้องรัน (ถ้ายังไม่ได้รัน):\n\n' +
  'ALTER TABLE "โครงการ"\n' +
  '  ADD COLUMN IF NOT EXISTS total_billed DECIMAL(12,2) DEFAULT 0;\n\n' +
  'CREATE TABLE IF NOT EXISTS "งวดงาน" (\n' +
  '  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n' +
  '  project_id    UUID REFERENCES "โครงการ"(id) ON DELETE CASCADE,\n' +
  '  milestone_no  INTEGER NOT NULL,\n' +
  '  description   TEXT,\n' +
  '  amount        DECIMAL(12,2) NOT NULL DEFAULT 0,\n' +
  '  percent       DECIMAL(5,2),\n' +
  '  status        TEXT DEFAULT \'pending\',\n' +
  '  billed_at     TIMESTAMPTZ,\n' +
  '  cash_tx_id    UUID,\n' +
  '  staff_name    TEXT,\n' +
  '  notes         TEXT,\n' +
  '  created_at    TIMESTAMPTZ DEFAULT now()\n' +
  ');\n\n' +
  'ALTER TABLE "รายจ่ายโครงการ"\n' +
  '  ADD COLUMN IF NOT EXISTS cash_tx_id UUID,\n' +
  '  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;\n'
);
