(function () {
  'use strict';
  /**
   * modules-v23-projectui.js
   * SK POS — Professional Project Detail UI Redesign
   * Wrapped in IIFE to avoid const conflicts with modules-v23.js (_v23f)
   */

  /* ── Local utils (no global conflict) ── */
  const pFmt = n => typeof formatNum === 'function' ? formatNum(n) : Number(n || 0).toLocaleString('th-TH');
  const pDate = d => d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  /* ══════════════════════════════════════════════════════════════
     CSS INJECTION
  ══════════════════════════════════════════════════════════════ */
  (function injectCSS() {
    if (document.getElementById('sk-v23ui-css')) return;
    const s = document.createElement('style');
    s.id = 'sk-v23ui-css';
    s.textContent = `
      .v23-wrap { font-family:var(--font,'Prompt'),sans-serif; }

      /* Back */
      .v23-back { display:inline-flex;align-items:center;gap:8px;padding:10px 20px;
        background:var(--bg-surface,#fff);border:1.5px solid var(--border,#e5e7eb);
        border-radius:12px;cursor:pointer;font-size:13px;font-weight:600;
        color:var(--text-secondary,#6b7280);margin-bottom:20px;
        transition:all .15s;font-family:inherit; }
      .v23-back:hover { border-color:#4F46E5;color:#4F46E5;background:#F5F3FF; }
      .v23-back i { font-size:18px; }

      /* ══ HERO ══ */
      .v23-hero { border-radius:22px;overflow:hidden;margin-bottom:20px;
        background:linear-gradient(140deg,#1E1B4B 0%,#312E81 45%,#5B21B6 100%);
        box-shadow:0 10px 40px rgba(79,70,229,.22),0 2px 8px rgba(0,0,0,.12);
        position:relative; }
      .v23-hero::before { content:'';position:absolute;top:-80px;right:-80px;width:320px;height:320px;
        border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,.22) 0%,transparent 70%);pointer-events:none; }
      .v23-hero::after { content:'';position:absolute;bottom:-100px;left:-50px;width:260px;height:260px;
        border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 70%);pointer-events:none; }

      .v23-hero-top { padding:26px 28px 20px;position:relative;z-index:2; }
      .v23-hero-row { display:flex;justify-content:space-between;align-items:flex-start;
        flex-wrap:wrap;gap:16px;margin-bottom:18px; }
      .v23-hero-lbl { font-size:10px;color:rgba(255,255,255,.45);text-transform:uppercase;
        letter-spacing:1.2px;margin-bottom:6px;font-weight:600; }
      .v23-hero-name { font-size:28px;font-weight:900;color:#fff;letter-spacing:-.5px;
        line-height:1.2;margin-bottom:12px; }
      .v23-hero-badges { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
      .v23-badge-on { display:inline-flex;align-items:center;gap:6px;padding:5px 14px;
        background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.3);border-radius:99px;
        color:#6ee7b7;font-size:12px;font-weight:700; }
      .v23-badge-dot { width:7px;height:7px;border-radius:50%;background:#34d399;
        animation:v23dot 2s ease-in-out infinite;flex-shrink:0; }
      @keyframes v23dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
      .v23-badge-off { display:inline-flex;align-items:center;gap:6px;padding:5px 14px;
        background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.35);border-radius:99px;
        color:#a5b4fc;font-size:12px;font-weight:700; }
      .v23-contract-chip { display:inline-flex;align-items:center;gap:4px;padding:5px 12px;
        background:rgba(255,255,255,.1);border-radius:99px;
        color:rgba(255,255,255,.6);font-size:11px;font-weight:600; }
      .v23-contract-chip i { font-size:13px; }

      .v23-hero-acts { display:flex;gap:8px;flex-wrap:wrap;align-items:center; }
      .v23-btn-glass { display:inline-flex;align-items:center;gap:7px;padding:10px 18px;
        border:1.5px solid rgba(255,255,255,.2);border-radius:12px;
        background:rgba(255,255,255,.08);color:#fff;font-size:13px;font-weight:700;
        cursor:pointer;font-family:inherit;transition:all .15s;backdrop-filter:blur(6px);white-space:nowrap; }
      .v23-btn-glass:hover { background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.35);transform:translateY(-1px); }
      .v23-btn-glass i { font-size:16px; }
      .v23-btn-em { display:inline-flex;align-items:center;gap:7px;padding:10px 18px;
        border:none;border-radius:12px;background:linear-gradient(135deg,#10B981,#059669);
        color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
        transition:all .15s;box-shadow:0 3px 12px rgba(16,185,129,.35);white-space:nowrap; }
      .v23-btn-em:hover { transform:translateY(-1px);box-shadow:0 5px 16px rgba(16,185,129,.4); }
      .v23-btn-em i { font-size:16px; }

      /* ── METRICS ── */
      .v23-metrics { display:grid;grid-template-columns:repeat(5,1fr);
        border-top:1px solid rgba(255,255,255,.08);position:relative;z-index:2; }
      @media(max-width:900px) { .v23-metrics { grid-template-columns:repeat(3,1fr); } }
      @media(max-width:560px) { .v23-metrics { grid-template-columns:repeat(2,1fr); } }
      .v23-m { padding:18px 16px 16px;position:relative;overflow:hidden; }
      .v23-m + .v23-m { border-left:1px solid rgba(255,255,255,.07); }
      .v23-m-ic { position:absolute;top:14px;right:12px;font-size:22px;opacity:.15;color:#fff; }
      .v23-m-lbl { font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;
        letter-spacing:.9px;margin-bottom:8px;font-weight:700; }
      .v23-m-val { font-size:20px;font-weight:900;color:#fff;letter-spacing:-.5px;line-height:1;
        font-family:var(--num,'DM Sans'),sans-serif; }
      .v23-m-sub { font-size:10px;color:rgba(255,255,255,.35);margin-top:5px;font-weight:500; }
      .v23-m.cg .v23-m-val { color:#6ee7b7; }
      .v23-m.ca .v23-m-val { color:#fde68a; }
      .v23-m.cr .v23-m-val { color:#fca5a5; }

      /* ── PROGRESS ── */
      .v23-prog { padding:12px 28px 20px;position:relative;z-index:2; }
      .v23-prog-hd { display:flex;justify-content:space-between;align-items:center;
        font-size:10px;color:rgba(255,255,255,.4);margin-bottom:7px;font-weight:600;letter-spacing:.3px; }
      .v23-prog-pct { font-size:13px;font-weight:900;color:rgba(255,255,255,.8); }
      .v23-prog-track { height:8px;background:rgba(255,255,255,.12);border-radius:99px;overflow:hidden; }
      .v23-prog-fill { height:100%;border-radius:99px;transition:width .7s cubic-bezier(.4,0,.2,1); }

      /* ══ TABS ══ */
      .v23-tabs { display:flex;gap:4px;padding:5px;
        background:var(--bg-secondary,#F3F4F6);border-radius:16px;margin-bottom:20px; }
      .v23-tab { flex:1;padding:11px 14px;border:none;border-radius:12px;cursor:pointer;
        font-size:13px;font-weight:600;color:var(--text-muted,#9ca3af);background:none;
        font-family:inherit;transition:all .2s;display:flex;align-items:center;
        justify-content:center;gap:7px;white-space:nowrap; }
      .v23-tab.on { background:#fff;color:#4F46E5;font-weight:800;
        box-shadow:0 2px 10px rgba(79,70,229,.1),0 1px 4px rgba(0,0,0,.06); }
      .v23-tab i { font-size:16px; }
      .v23-tc { padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700; }
      .v23-tab.on .v23-tc { background:#EEF2FF;color:#4F46E5; }
      .v23-tab:not(.on) .v23-tc { background:rgba(0,0,0,.06);color:var(--text-muted,#9ca3af); }

      /* ══ PANEL ══ */
      .v23-panel { background:var(--bg-surface,#fff);border-radius:18px;
        border:1px solid var(--border,#f0f0f0);
        box-shadow:0 1px 12px rgba(0,0,0,.05);overflow:hidden; }

      /* Action bar */
      .v23-abar { display:flex;gap:8px;padding:14px 16px;
        border-bottom:1px solid var(--border,#f0f0f0);flex-wrap:wrap;align-items:center; }
      .v23-abtn { display:inline-flex;align-items:center;gap:6px;padding:9px 16px;
        border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;
        font-family:inherit;border:none;transition:all .15s; }
      .v23-abtn.ap { background:#4F46E5;color:#fff;box-shadow:0 2px 10px rgba(79,70,229,.28); }
      .v23-abtn.ap:hover { background:#4338CA;transform:translateY(-1px); }
      .v23-abtn.as { background:#10B981;color:#fff;box-shadow:0 2px 10px rgba(16,185,129,.28); }
      .v23-abtn.as:hover { background:#059669;transform:translateY(-1px); }
      .v23-abtn.ao { background:var(--bg-surface,#fff);color:var(--text-secondary,#374151);
        border:1.5px solid var(--border,#e5e7eb); }
      .v23-abtn.ao:hover { border-color:#4F46E5;color:#4F46E5;background:#F5F3FF; }
      .v23-abtn i { font-size:15px; }

      /* Remaining banner */
      .v23-rem { margin:12px 16px 0;border-radius:14px;padding:14px 20px;
        background:linear-gradient(135deg,#1D4ED8,#4F46E5);
        display:flex;justify-content:space-between;align-items:center;
        box-shadow:0 4px 16px rgba(79,70,229,.2); }
      .v23-rem .rl { }
      .v23-rem .rl .rll { font-size:11px;color:rgba(255,255,255,.65);margin-bottom:4px;font-weight:600; }
      .v23-rem .rl .rla { font-size:24px;font-weight:900;color:#fff;
        font-family:var(--num,'DM Sans'),sans-serif;letter-spacing:-.5px; }
      .v23-rem .rr { text-align:right; }
      .v23-rem .rr .rrs { font-size:11px;color:rgba(255,255,255,.55); }
      .v23-rem .rr .rrp { font-size:13px;font-weight:700;color:rgba(255,255,255,.85);margin-top:3px; }

      /* ══ MILESTONE ROWS ══ */
      .v23-ms-wrap { padding:6px 0; }
      .v23-ms-row { display:flex;align-items:center;gap:14px;padding:14px 18px;
        border-bottom:1px solid var(--border,#f5f5f5);transition:background .12s; }
      .v23-ms-row:last-child { border-bottom:none; }
      .v23-ms-row:hover { background:var(--bg-secondary,#fafafa); }
      .v23-ms-num { width:40px;height:40px;border-radius:50%;display:flex;align-items:center;
        justify-content:center;font-size:14px;font-weight:900;flex-shrink:0;
        font-family:var(--num,'DM Sans'),sans-serif; }
      .v23-ms-num.nb { background:#D1FAE5;color:#065F46; }
      .v23-ms-num.np { background:#FEF3C7;color:#92400E; }
      .v23-ms-num.nl { background:#EDE9FE;color:#5B21B6; }
      .v23-ms-body { flex:1;min-width:0; }
      .v23-ms-title { font-size:14px;font-weight:700;color:var(--text-primary,#111827);
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px; }
      .v23-ms-meta { display:flex;align-items:center;gap:7px;flex-wrap:wrap; }
      .v23-ms-chip { display:inline-flex;align-items:center;gap:3px;padding:3px 10px;
        border-radius:99px;font-size:10px;font-weight:700; }
      .v23-ms-chip.cb { background:#D1FAE5;color:#065F46; }
      .v23-ms-chip.cp { background:#FEF3C7;color:#92400E; }
      .v23-ms-chip.cl { background:#EDE9FE;color:#5B21B6; }
      .v23-ms-date { font-size:11px;color:var(--text-muted,#9ca3af); }
      .v23-ms-right { text-align:right;flex-shrink:0; }
      .v23-ms-amt { font-size:17px;font-weight:900;letter-spacing:-.5px;
        font-family:var(--num,'DM Sans'),sans-serif; }
      .v23-ms-pct { font-size:10px;color:var(--text-muted,#9ca3af);margin-top:3px; }
      .v23-ms-btns { display:flex;gap:6px;margin-left:10px;flex-shrink:0; }
      .v23-bill-btn { padding:7px 14px;border-radius:10px;background:#10B981;color:#fff;
        border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;
        transition:all .15s;white-space:nowrap; }
      .v23-bill-btn:hover { background:#059669;transform:translateY(-1px); }
      .v23-del-btn { padding:7px;border-radius:10px;background:var(--bg-surface,#fff);
        border:1.5px solid #FEE2E2;color:#EF4444;cursor:pointer;
        display:flex;align-items:center;justify-content:center;transition:all .15s; }
      .v23-del-btn:hover { background:#FEE2E2; }
      .v23-del-btn i { font-size:15px; }

      /* ══ EXPENSE ROWS ══ */
      .v23-exp-row { display:flex;align-items:center;gap:14px;padding:14px 18px;
        border-bottom:1px solid var(--border,#f5f5f5);transition:background .12s; }
      .v23-exp-row:last-child { border-bottom:none; }
      .v23-exp-row:hover { background:var(--bg-secondary,#fafafa); }
      .v23-exp-ic { width:42px;height:42px;border-radius:13px;display:flex;
        align-items:center;justify-content:center;flex-shrink:0; }
      .v23-exp-ic i { font-size:21px; }
      .v23-exp-body { flex:1;min-width:0; }
      .v23-exp-title { font-size:14px;font-weight:700;color:var(--text-primary,#111827);margin-bottom:4px; }
      .v23-exp-meta { display:flex;align-items:center;gap:6px;flex-wrap:wrap; }
      .v23-cat-chip { padding:3px 9px;border-radius:99px;font-size:10px;font-weight:700; }
      .v23-exp-right { text-align:right;flex-shrink:0; }
      .v23-exp-amt { font-size:16px;font-weight:900;letter-spacing:-.3px;
        font-family:var(--num,'DM Sans'),sans-serif; }
      .v23-cash-tag { display:inline-block;font-size:9px;padding:2px 7px;
        border-radius:5px;background:#D1FAE5;color:#065F46;font-weight:700;margin-top:3px; }

      /* ══ BILL ROWS ══ */
      .v23-bill-row { display:flex;align-items:center;gap:14px;padding:14px 18px;
        border-bottom:1px solid var(--border,#f5f5f5);transition:background .12s; }
      .v23-bill-row:last-child { border-bottom:none; }
      .v23-bill-row:hover { background:var(--bg-secondary,#fafafa); }
      .v23-bill-ic { width:42px;height:42px;border-radius:13px;background:#EDE9FE;
        display:flex;align-items:center;justify-content:center;flex-shrink:0; }
      .v23-bill-ic i { font-size:21px;color:#7C3AED; }
      .v23-bill-body { flex:1;min-width:0; }
      .v23-bill-no { font-size:14px;font-weight:800;color:var(--text-primary,#111827);margin-bottom:4px; }
      .v23-bill-meta { display:flex;align-items:center;gap:6px;font-size:11px;
        color:var(--text-muted,#9ca3af);flex-wrap:wrap; }
      .v23-bill-chip { padding:3px 9px;border-radius:99px;font-size:10px;font-weight:700; }
      .v23-bill-right { text-align:right;flex-shrink:0; }
      .v23-bill-amt { font-size:17px;font-weight:900;color:#7C3AED;letter-spacing:-.3px;
        font-family:var(--num,'DM Sans'),sans-serif; }

      /* Total footer */
      .v23-total-bar { display:flex;justify-content:space-between;align-items:center;
        padding:14px 18px;background:var(--bg-secondary,#F9FAFB);
        border-top:1.5px solid var(--border,#f0f0f0); }
      .v23-total-bar .tl { font-size:13px;font-weight:700;color:var(--text-secondary,#6b7280); }
      .v23-total-bar .tv { font-size:18px;font-weight:900;font-family:var(--num,'DM Sans'),sans-serif; }

      /* Empty state */
      .v23-empty { text-align:center;padding:52px 24px; }
      .v23-empty i { font-size:54px;color:#D1D5DB;display:block;margin-bottom:16px; }
      .v23-empty-h { font-size:15px;font-weight:700;color:var(--text-secondary,#6b7280);margin-bottom:6px; }
      .v23-empty-s { font-size:13px;color:var(--text-muted,#9ca3af);line-height:1.7; }

      /* Notes */
      .v23-notes { border-radius:14px;border:1.5px dashed var(--border,#E5E7EB);
        padding:16px 20px;margin-top:20px;background:var(--bg-secondary,#fafafa); }
      .v23-notes-hd { font-size:11px;font-weight:700;color:var(--text-muted,#9ca3af);
        text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px;
        display:flex;align-items:center;gap:6px; }
      .v23-notes-hd i { font-size:15px; }
      .v23-notes-body { font-size:14px;color:var(--text-secondary,#374151);line-height:1.75; }

      /* Spin */
      @keyframes v23spin { to { transform:rotate(360deg); } }
    `;
    document.head.appendChild(s);
  })();

  /* ══════════════════════════════════════════════════════════════
     MAIN OVERRIDE
  ══════════════════════════════════════════════════════════════ */
  window.v14OpenProject = async function (projId) {
    const sec = document.getElementById('page-projects');
    if (!sec) return;

    sec.innerHTML = `<div class="v23-wrap">
      <div style="padding:40px;text-align:center;color:var(--text-muted);">
        <i class="material-icons-round" style="font-size:40px;animation:v23spin .8s linear infinite;display:block;margin-bottom:12px;">sync</i>
        กำลังโหลดโครงการ...
      </div></div>`;

    try {
      const [projRes, expsRes, billsRes] = await Promise.all([
        db.from('โครงการ').select('*').eq('id', projId).single(),
        db.from('รายจ่ายโครงการ').select('*').eq('project_id', projId).order('created_at', { ascending: false }),
        db.from('บิลขาย').select('id,bill_no,date,total,status,staff_name').eq('project_id', projId).order('date', { ascending: false }),
      ]);

      let milestones = [];
      try {
        const { data } = await db.from('งวดงาน').select('*').eq('project_id', projId).order('milestone_no', { ascending: true });
        milestones = data || [];
      } catch (_) { }

      const proj = projRes.data;
      if (!proj) { sec.innerHTML = '<div style="padding:30px;text-align:center;">ไม่พบโครงการ</div>'; return; }

      const exps  = expsRes.data  || [];
      const bills = billsRes.data || [];
      const done  = proj.status === 'completed';

      const budget    = parseFloat(proj.budget || 0);
      const billed    = parseFloat(proj.total_billed || 0);
      const remain    = Math.max(0, budget - billed);
      const totalCost = parseFloat(proj.total_goods_cost || 0) + parseFloat(proj.total_expenses || 0);
      const profit    = billed - totalCost;
      const billPct   = budget > 0 ? Math.min(100, Math.round(billed / budget * 100)) : 0;
      const progClr   = billPct >= 90 ? '#34D399' : billPct >= 50 ? '#FBBF24' : '#60A5FA';
      const profClr   = profit >= 0 ? '#6EE7B7' : '#FCA5A5';
      const billTotal = bills.reduce((s, b) => s + (b.total || 0), 0);
      const expTotal  = exps.reduce((s, e) => s + (e.amount || 0), 0);

      const msHTML  = buildMilestoneRows(milestones, projId, budget, done);
      const expHTML = buildExpenseRows(exps, projId, done);
      const blHTML  = buildBillRows(bills);

      sec.innerHTML = `<div class="v23-wrap">

        <!-- BACK -->
        <button class="v23-back" onclick="renderProjects()">
          <i class="material-icons-round">arrow_back</i>กลับรายการโครงการ
        </button>

        <!-- HERO -->
        <div class="v23-hero">
          <div class="v23-hero-top">
            <div class="v23-hero-row">
              <div>
                <div class="v23-hero-lbl">${proj.contract_no ? 'สัญญา #' + proj.contract_no + ' · ' : ''}โครงการก่อสร้าง</div>
                <div class="v23-hero-name">${proj.name}</div>
                <div class="v23-hero-badges">
                  ${done
                    ? `<span class="v23-badge-off"><i class="material-icons-round" style="font-size:14px">check_circle</i>เสร็จสิ้นแล้ว</span>`
                    : `<span class="v23-badge-on"><span class="v23-badge-dot"></span>กำลังดำเนินการ</span>`}
                  ${proj.contract_no ? `<span class="v23-contract-chip"><i class="material-icons-round">description</i>#${proj.contract_no}</span>` : ''}
                </div>
              </div>
              ${!done ? `
              <div class="v23-hero-acts">
                <button class="v23-btn-glass" onclick="v14AddExpense('${projId}')">
                  <i class="material-icons-round">add_circle_outline</i>รายจ่าย
                </button>
                <button class="v23-btn-em" onclick="v22ShowBillMilestoneModal('${projId}')">
                  <i class="material-icons-round">payments</i>เบิกงวดงาน
                </button>
                <button class="v23-btn-glass" onclick="v14CompleteProject('${projId}')">
                  <i class="material-icons-round">flag</i>ปิดโครงการ
                </button>
              </div>` : ''}
            </div>
          </div>

          <!-- METRICS -->
          <div class="v23-metrics">
            <div class="v23-m">
              <i class="material-icons-round v23-m-ic">account_balance_wallet</i>
              <div class="v23-m-lbl">งบประมาณ</div>
              <div class="v23-m-val">฿${pFmt(budget)}</div>
              <div class="v23-m-sub">ยอดสัญญา</div>
            </div>
            <div class="v23-m cg">
              <i class="material-icons-round v23-m-ic">moving</i>
              <div class="v23-m-lbl">เบิกแล้ว</div>
              <div class="v23-m-val">฿${pFmt(billed)}</div>
              <div class="v23-m-sub">${billPct}% ของงบ</div>
            </div>
            <div class="v23-m ca">
              <i class="material-icons-round v23-m-ic">hourglass_top</i>
              <div class="v23-m-lbl">คงเหลือเบิก</div>
              <div class="v23-m-val">฿${pFmt(remain)}</div>
              <div class="v23-m-sub">${100 - billPct}% ค้างอยู่</div>
            </div>
            <div class="v23-m cr">
              <i class="material-icons-round v23-m-ic">receipt_long</i>
              <div class="v23-m-lbl">ต้นทุนรวม</div>
              <div class="v23-m-val">฿${pFmt(totalCost)}</div>
              <div class="v23-m-sub">สินค้า + ค่าใช้จ่าย</div>
            </div>
            <div class="v23-m">
              <i class="material-icons-round v23-m-ic">${profit >= 0 ? 'trending_up' : 'trending_down'}</i>
              <div class="v23-m-lbl">${profit >= 0 ? 'กำไร' : 'ขาดทุน'}</div>
              <div class="v23-m-val" style="color:${profClr}">฿${pFmt(Math.abs(profit))}</div>
              <div class="v23-m-sub">จากยอดที่เบิกแล้ว</div>
            </div>
          </div>

          <!-- PROGRESS -->
          <div class="v23-prog">
            <div class="v23-prog-hd">
              <span>ความคืบหน้าการเบิก</span>
              <span class="v23-prog-pct">${billPct}%</span>
            </div>
            <div class="v23-prog-track">
              <div class="v23-prog-fill" style="width:${billPct}%;background:${progClr}"></div>
            </div>
          </div>
        </div>

        <!-- TABS -->
        <div class="v23-tabs">
          <button id="v23t-ms" class="v23-tab on" onclick="v23Tab('ms')">
            <i class="material-icons-round">layers</i>งวดงาน<span class="v23-tc">${milestones.length}</span>
          </button>
          <button id="v23t-exp" class="v23-tab" onclick="v23Tab('exp')">
            <i class="material-icons-round">payments</i>รายจ่าย<span class="v23-tc">${exps.length}</span>
          </button>
          <button id="v23t-bill" class="v23-tab" onclick="v23Tab('bill')">
            <i class="material-icons-round">receipt_long</i>บิลขาย<span class="v23-tc">${bills.length}</span>
          </button>
        </div>

        <!-- TAB: MILESTONE -->
        <div id="v23c-ms">
          <div class="v23-panel">
            ${!done ? `
            <div class="v23-abar">
              <button class="v23-abtn as" onclick="v22ShowBillMilestoneModal('${projId}')">
                <i class="material-icons-round">payments</i>เบิกงวดงาน
              </button>
              <button class="v23-abtn ao" onclick="v22ShowPlanMilestoneModal('${projId}')">
                <i class="material-icons-round">add_task</i>วางแผนงวด
              </button>
            </div>` : ''}
            ${remain > 0 && !done ? `
            <div class="v23-rem">
              <div class="rl">
                <div class="rll">เหลือให้เบิกอีก</div>
                <div class="rla">฿${pFmt(remain)}</div>
              </div>
              <div class="rr">
                <div class="rrs">จากงบทั้งหมด ฿${pFmt(budget)}</div>
                <div class="rrp">เบิกไปแล้ว ${billPct}%</div>
              </div>
            </div>` : ''}
            ${milestones.length > 0
              ? `<div class="v23-ms-wrap">${msHTML}</div>`
              : `<div class="v23-empty">
                  <i class="material-icons-round">layers</i>
                  <div class="v23-empty-h">ยังไม่มีงวดงาน</div>
                  <div class="v23-empty-s">กด "วางแผนงวด" เพื่อวางโครงสร้างล่วงหน้า<br>หรือ "เบิกงวดงาน" เพื่อรับเงินทันที</div>
                </div>`}
          </div>
        </div>

        <!-- TAB: EXPENSE -->
        <div id="v23c-exp" style="display:none">
          <div class="v23-panel">
            ${!done ? `
            <div class="v23-abar">
              <button class="v23-abtn ap" onclick="v14AddExpense('${projId}')">
                <i class="material-icons-round">add</i>เพิ่มรายจ่าย
              </button>
            </div>` : ''}
            ${exps.length > 0
              ? expHTML
              : `<div class="v23-empty">
                  <i class="material-icons-round">receipt</i>
                  <div class="v23-empty-h">ยังไม่มีรายจ่าย</div>
                  <div class="v23-empty-s">เพิ่มค่าแรง วัสดุ หรือค่าใช้จ่ายอื่นๆ<br>เพื่อติดตามต้นทุนโครงการ</div>
                </div>`}
            ${exps.length > 0 ? `
            <div class="v23-total-bar">
              <span class="tl">รวมรายจ่ายทั้งหมด</span>
              <span class="tv" style="color:#EF4444">฿${pFmt(expTotal)}</span>
            </div>` : ''}
          </div>
        </div>

        <!-- TAB: BILLS -->
        <div id="v23c-bill" style="display:none">
          <div class="v23-panel">
            ${bills.length > 0
              ? blHTML
              : `<div class="v23-empty">
                  <i class="material-icons-round">receipt_long</i>
                  <div class="v23-empty-h">ยังไม่มีบิลขาย</div>
                  <div class="v23-empty-s">บิลที่ขายให้โครงการนี้จะแสดงที่นี่อัตโนมัติ</div>
                </div>`}
            ${bills.length > 0 ? `
            <div class="v23-total-bar">
              <span class="tl">มูลค่าบิลทั้งหมด</span>
              <span class="tv" style="color:#7C3AED">฿${pFmt(billTotal)}</span>
            </div>` : ''}
          </div>
        </div>

        ${proj.notes ? `
        <div class="v23-notes">
          <div class="v23-notes-hd"><i class="material-icons-round">sticky_note_2</i>หมายเหตุโครงการ</div>
          <div class="v23-notes-body">${proj.notes}</div>
        </div>` : ''}

      </div>`;

    } catch (e) {
      console.error('[v23ui] openProject:', e);
      sec.innerHTML = `<div style="padding:40px;text-align:center;color:#EF4444;">
        <i class="material-icons-round" style="font-size:44px;display:block;margin-bottom:12px;">error_outline</i>
        <div style="font-weight:700;">โหลดไม่สำเร็จ</div>
        <div style="font-size:13px;color:#9ca3af;margin-top:6px;">${e.message}</div>
      </div>`;
    }
  };

  /* ── Tab switcher (global — called from onclick) ── */
  window.v23Tab = function (tab) {
    ['ms', 'exp', 'bill'].forEach(function (t) {
      var btn = document.getElementById('v23t-' + t);
      var con = document.getElementById('v23c-' + t);
      var on = t === tab;
      if (btn) btn.className = 'v23-tab' + (on ? ' on' : '');
      if (con) con.style.display = on ? '' : 'none';
    });
  };

  /* ════════════════════════════════════════════════════════════
     ROW BUILDERS (local — closure access only)
  ════════════════════════════════════════════════════════════ */
  function buildMilestoneRows(milestones, projId, budget, done) {
    return milestones.map(function (m) {
      var isBilled  = m.status === 'billed';
      var isPending = m.status === 'pending';
      var pct  = budget > 0 ? Math.round(m.amount / budget * 100) : 0;
      var nCls = isBilled ? 'nb' : isPending ? 'np' : 'nl';
      var cCls = isBilled ? 'cb' : isPending ? 'cp' : 'cl';
      var cLbl = isBilled ? '✓ เบิกแล้ว' : isPending ? '⏳ รอเบิก' : '📋 วางแผน';
      var aClr = isBilled ? '#10B981' : isPending ? '#F59E0B' : '#8B5CF6';
      return '<div class="v23-ms-row">' +
        '<div class="v23-ms-num ' + nCls + '">' + m.milestone_no + '</div>' +
        '<div class="v23-ms-body">' +
          '<div class="v23-ms-title">' + (m.description || 'งวดที่ ' + m.milestone_no) + '</div>' +
          '<div class="v23-ms-meta">' +
            '<span class="v23-ms-chip ' + cCls + '">' + cLbl + '</span>' +
            '<span class="v23-ms-date">' + pct + '% ของงบ' +
              (isBilled ? ' · เบิก ' + pDate(m.billed_at) : '') +
              (m.notes ? ' · ' + m.notes : '') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="v23-ms-right">' +
          '<div class="v23-ms-amt" style="color:' + aClr + '">฿' + pFmt(m.amount) + '</div>' +
          '<div class="v23-ms-pct">' + pct + '%</div>' +
        '</div>' +
        (!done && !isBilled
          ? '<div class="v23-ms-btns">' +
              '<button class="v23-bill-btn" onclick="v22BillSpecificMilestone(\'' + m.id + '\',\'' + projId + '\')">เบิกเงิน</button>' +
              '<button class="v23-del-btn" onclick="v22DeleteMilestone(\'' + m.id + '\',\'' + projId + '\',' + m.amount + ')">' +
                '<i class="material-icons-round">delete_outline</i>' +
              '</button>' +
            '</div>'
          : '') +
      '</div>';
    }).join('');
  }

  function buildExpenseRows(exps, projId, done) {
    return exps.map(function (ex) {
      var isGoods = ex.type === 'goods';
      var icBg    = isGoods ? '#DBEAFE' : '#FEE2E2';
      var icClr   = isGoods ? '#1D4ED8' : '#DC2626';
      var icName  = isGoods ? 'inventory_2' : 'payments';
      var catBg   = isGoods ? '#DBEAFE' : '#FEF3C7';
      var catClr  = isGoods ? '#1D4ED8' : '#92400E';
      var aClr    = isGoods ? '#F59E0B' : '#EF4444';
      return '<div class="v23-exp-row">' +
        '<div class="v23-exp-ic" style="background:' + icBg + '">' +
          '<i class="material-icons-round" style="color:' + icClr + '">' + icName + '</i>' +
        '</div>' +
        '<div class="v23-exp-body">' +
          '<div class="v23-exp-title">' + ex.description + '</div>' +
          '<div class="v23-exp-meta">' +
            '<span class="v23-cat-chip" style="background:' + catBg + ';color:' + catClr + '">' +
              (isGoods ? '📦 สินค้า' : '💸 รายจ่าย') +
            '</span>' +
            '<span style="font-size:11px;color:var(--text-muted,#9ca3af)">' + (ex.category || 'ทั่วไป') + '</span>' +
            '<span style="font-size:11px;color:var(--text-muted,#9ca3af)">' + pDate(ex.created_at) + '</span>' +
            (ex.cash_tx_id ? '<span class="v23-cash-tag">💳 หักเงินสด</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="v23-exp-right">' +
          '<div class="v23-exp-amt" style="color:' + aClr + '">฿' + pFmt(ex.amount) + '</div>' +
        '</div>' +
        (!done && !isGoods
          ? '<button class="v23-del-btn" onclick="v22DeleteExpense(\'' + ex.id + '\',\'' + projId + '\',' + ex.amount + ',false)" style="margin-left:8px;">' +
              '<i class="material-icons-round">delete_outline</i>' +
            '</button>'
          : '') +
      '</div>';
    }).join('');
  }

  function buildBillRows(bills) {
    var STATUS = {
      'สำเร็จ':   ['#D1FAE5', '#065F46', '✓ สำเร็จ'],
      'ค้างชำระ': ['#FEE2E2', '#991B1B', '⚠ ค้างชำระ'],
      'รอจัดส่ง': ['#FEF3C7', '#92400E', '🚚 รอส่ง'],
      'ยกเลิก':   ['#F3F4F6', '#6B7280', '✕ ยกเลิก'],
      'โครงการ':  ['#E0E7FF', '#4F46E5', '🏗️ โครงการ'],
    };
    return bills.map(function (b) {
      var s = STATUS[b.status] || ['#F3F4F6', '#6B7280', b.status || '—'];
      return '<div class="v23-bill-row">' +
        '<div class="v23-bill-ic"><i class="material-icons-round">receipt</i></div>' +
        '<div class="v23-bill-body">' +
          '<div class="v23-bill-no">บิล #' + b.bill_no + '</div>' +
          '<div class="v23-bill-meta">' +
            '<span class="v23-bill-chip" style="background:' + s[0] + ';color:' + s[1] + '">' + s[2] + '</span>' +
            '<span>' + pDate(b.date) + '</span>' +
            '<span>' + (b.staff_name || '—') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="v23-bill-right">' +
          '<div class="v23-bill-amt">฿' + pFmt(b.total) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  console.info('%c[v23-projectui] ✅%c Professional UI loaded (IIFE-safe)', 'color:#4F46E5;font-weight:700', 'color:#6B7280');

})(); // end IIFE
