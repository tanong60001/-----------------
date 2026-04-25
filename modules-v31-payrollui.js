(function () {
  'use strict';
  /**
   * modules-v31-payrollui.js
   * SK POS — Professional Payroll UI Redesign
   * Overrides: renderPayroll, v26ShowPayDetail
   * IIFE-wrapped to avoid const conflicts
   */

  var _pf = function (n) { return typeof formatNum === 'function' ? formatNum(n) : Number(n || 0).toLocaleString('th-TH'); };
  var _pd = function (d) { return d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };

  /* ══════════════════════════════════════════════════════════════
     CSS
  ══════════════════════════════════════════════════════════════ */
  (function injectCSS() {
    var old = document.getElementById('v31-payroll-css');
    if (old) old.remove();
    var s = document.createElement('style');
    s.id = 'v31-payroll-css';
    s.textContent = `
      /* ── PAYROLL PAGE WRAPPER ── */
      .p31-wrap { max-width:1100px;margin:0 auto;padding:0 4px; }

      /* ── HERO BANNER ── */
      .p31-hero { border-radius:22px;overflow:hidden;margin-bottom:24px;
        background:linear-gradient(135deg,#7F1D1D 0%,#DC2626 45%,#EF4444 100%);
        box-shadow:0 10px 40px rgba(220,38,38,.25);position:relative; }
      .p31-hero::before { content:'';position:absolute;top:-60px;right:-60px;
        width:280px;height:280px;border-radius:50%;
        background:radial-gradient(circle,rgba(255,255,255,.1) 0%,transparent 70%);pointer-events:none; }
      .p31-hero::after { content:'';position:absolute;bottom:-80px;left:-40px;
        width:220px;height:220px;border-radius:50%;
        background:radial-gradient(circle,rgba(255,255,255,.07) 0%,transparent 70%);pointer-events:none; }
      .p31-hero-top { padding:24px 28px 20px;position:relative;z-index:2; }
      .p31-hero-row { display:flex;justify-content:space-between;align-items:center;
        flex-wrap:wrap;gap:16px;margin-bottom:20px; }
      .p31-back { display:inline-flex;align-items:center;gap:8px;padding:10px 18px;
        background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.25);
        border-radius:12px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;
        font-family:inherit;transition:all .15s;backdrop-filter:blur(6px); }
      .p31-back:hover { background:rgba(255,255,255,.22);transform:translateX(-3px); }
      .p31-back i { font-size:16px; }
      .p31-title-block { }
      .p31-title-lbl { font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;
        letter-spacing:1.2px;font-weight:700;margin-bottom:5px; }
      .p31-title-h { font-size:26px;font-weight:900;color:#fff;letter-spacing:-.5px;margin-bottom:4px; }
      .p31-title-m { font-size:13px;color:rgba(255,255,255,.7);font-weight:500; }
      .p31-total-box { background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.2);
        padding:14px 24px;border-radius:18px;text-align:right;backdrop-filter:blur(8px); }
      .p31-total-lbl { font-size:10px;color:rgba(255,255,255,.6);text-transform:uppercase;
        letter-spacing:1px;font-weight:700;margin-bottom:4px; }
      .p31-total-val { font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px;
        font-family:var(--num,'DM Sans'),sans-serif; }

      /* ── STAT CHIPS ROW ── */
      .p31-stats { display:flex;gap:1px;background:rgba(0,0,0,.1);border-top:1px solid rgba(255,255,255,.1);
        position:relative;z-index:2; }
      .p31-stat { flex:1;padding:14px 16px;text-align:center; }
      .p31-stat + .p31-stat { border-left:1px solid rgba(255,255,255,.08); }
      .p31-stat .sl { font-size:10px;color:rgba(255,255,255,.45);text-transform:uppercase;
        letter-spacing:.8px;font-weight:700;margin-bottom:5px; }
      .p31-stat .sv { font-size:20px;font-weight:900;color:#fff;
        font-family:var(--num,'DM Sans'),sans-serif;letter-spacing:-.5px; }
      .p31-stat .ss { font-size:10px;color:rgba(255,255,255,.4);margin-top:3px; }
      .p31-stat.cg .sv { color:#86efac; }
      .p31-stat.cy .sv { color:#fde68a; }

      /* ── EMPLOYEE GRID ── */
      .p31-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:18px; }

      /* ── EMPLOYEE CARD ── */
      .p31-card { background:#fff;border-radius:20px;padding:20px;
        border:1.5px solid #F1F5F9;cursor:pointer;
        transition:all .25s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden;
        display:flex;flex-direction:column;gap:14px;
        box-shadow:0 2px 12px rgba(0,0,0,.04); }
      .p31-card:hover { transform:translateY(-6px);
        box-shadow:0 16px 40px rgba(0,0,0,.1);border-color:#FECACA; }
      .p31-card.is-paid { border-left:4px solid #22C55E; }
      .p31-card.is-pending { border-left:4px solid #EF4444; }
      .p31-card-shine { position:absolute;top:0;right:0;width:120px;height:120px;
        background:radial-gradient(circle at 80% 20%,rgba(220,38,38,.04),transparent 70%);
        pointer-events:none; }

      /* Card header */
      .p31-card-hd { display:flex;align-items:center;gap:12px; }
      .p31-ava { width:52px;height:52px;border-radius:16px;
        background:linear-gradient(135deg,#EF4444,#991B1B);
        color:#fff;display:flex;align-items:center;justify-content:center;
        font-size:26px;flex-shrink:0;
        box-shadow:0 6px 14px rgba(220,38,38,.2); }
      .p31-emp-info { flex:1;min-width:0; }
      .p31-emp-name { font-size:15px;font-weight:800;color:#0F172A;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .p31-emp-pos { font-size:12px;color:#94A3B8;margin-top:2px;font-weight:500; }
      .p31-paid-badge { display:inline-flex;align-items:center;gap:4px;padding:4px 10px;
        background:#DCFCE7;color:#166534;border-radius:99px;
        font-size:10px;font-weight:800;text-transform:uppercase;flex-shrink:0; }
      .p31-paid-badge i { font-size:13px; }
      .p31-pending-badge { display:inline-flex;align-items:center;gap:4px;padding:4px 10px;
        background:#FEF2F2;color:#991B1B;border-radius:99px;
        font-size:10px;font-weight:700;flex-shrink:0; }
      .p31-pending-badge i { font-size:13px; }

      /* Card stats */
      .p31-card-stats { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
      .p31-cs-box { background:#F8FAFC;border-radius:12px;padding:10px 12px; }
      .p31-cs-lbl { font-size:10px;color:#94A3B8;font-weight:700;text-transform:uppercase;
        letter-spacing:.5px;margin-bottom:4px; }
      .p31-cs-val { font-size:16px;font-weight:800;color:#334155;
        font-family:var(--num,'DM Sans'),sans-serif;letter-spacing:-.3px; }
      .p31-cs-val.warn { color:#D97706; }

      /* Card footer */
      .p31-card-ft { display:flex;align-items:center;justify-content:space-between;
        border-top:1px dashed #E2E8F0;padding-top:12px;margin-top:auto; }
      .p31-ft-lbl { font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;
        letter-spacing:.5px; }
      .p31-ft-val { font-size:22px;font-weight:900;letter-spacing:-.5px;
        font-family:var(--num,'DM Sans'),sans-serif; }
      .p31-card.is-paid .p31-ft-val { color:#22C55E; }
      .p31-card.is-pending .p31-ft-val { color:#DC2626; }
      .p31-ft-arr { color:#CBD5E1;transition:transform .2s,color .2s; }
      .p31-card:hover .p31-ft-arr { transform:translateX(4px);color:#EF4444; }

      /* ── DETAIL VIEW ── */
      .p31-detail-back { display:inline-flex;align-items:center;gap:8px;padding:10px 20px;
        background:#F1F5F9;color:#475569;border:none;border-radius:12px;
        font-weight:700;cursor:pointer;font-family:inherit;font-size:13px;
        transition:all .15s;margin-bottom:20px; }
      .p31-detail-back:hover { background:#E2E8F0; }

      .p31-detail-card { background:#fff;border-radius:22px;
        border:1.5px solid #F1F5F9;
        box-shadow:0 4px 20px rgba(0,0,0,.06);overflow:hidden;margin-bottom:20px; }
      .p31-detail-head { background:linear-gradient(135deg,#1E3A8A,#1D4ED8);
        padding:24px 28px;text-align:center;color:#fff; }
      .p31-detail-ava { width:72px;height:72px;border-radius:20px;
        background:rgba(255,255,255,.2);color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-size:36px;margin:0 auto 12px; }
      .p31-detail-name { font-size:20px;font-weight:900;margin-bottom:3px; }
      .p31-detail-pos { font-size:13px;opacity:.7;font-weight:500; }

      .p31-detail-body { padding:20px 24px; }

      /* Past pays alert */
      .p31-past-alert { background:#FEF9C3;border:1.5px solid #FDE047;border-radius:14px;
        padding:14px 16px;margin-bottom:16px; }
      .p31-past-alert-hd { font-size:13px;font-weight:800;color:#854D0E;margin-bottom:8px;
        display:flex;align-items:center;gap:6px; }
      .p31-past-alert-hd i { font-size:16px; }
      .p31-past-row { display:flex;justify-content:space-between;padding:5px 0;
        border-bottom:1px dashed #FDE047;font-size:13px;color:#92400E; }
      .p31-past-row:last-child { border-bottom:none; }
      .p31-past-row strong { color:#166534;font-weight:800; }

      /* Remaining banner */
      .p31-remain-box { background:linear-gradient(135deg,#DCFCE7,#BBFACC);
        border:1.5px solid #86EFAC;border-radius:14px;
        padding:14px 18px;text-align:center;margin-bottom:18px; }
      .p31-remain-lbl { font-size:11px;color:#166534;font-weight:700;text-transform:uppercase;
        letter-spacing:.5px;margin-bottom:4px; }
      .p31-remain-val { font-size:28px;font-weight:900;
        font-family:var(--num,'DM Sans'),sans-serif;letter-spacing:-.5px; }
      .p31-remain-zero { color:#DC2626;background:linear-gradient(135deg,#FEE2E2,#FCA5A5); }

      /* Info rows */
      .p31-info-row { display:flex;justify-content:space-between;align-items:center;
        padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:14px; }
      .p31-info-row:last-child { border-bottom:none; }
      .p31-info-row .ik { color:#64748B;font-weight:500; }
      .p31-info-row .iv { font-weight:800;color:#0F172A;
        font-family:var(--num,'DM Sans'),sans-serif; }
      .p31-info-row .iv.blue { color:#1D4ED8; }
      .p31-info-row .iv.amber { color:#D97706; }
      .p31-info-row .iv.red { color:#DC2626; }
      .p31-info-row .iv.green { color:#22C55E; }

      /* Deduct summary */
      .p31-deduct-sum { background:#FFF1F2;border:1.5px dashed #FECDD3;border-radius:14px;
        padding:14px 18px;display:flex;justify-content:space-between;align-items:center;
        margin:16px 0; }
      .p31-deduct-sum .dl { font-size:13px;font-weight:700;color:#BE123C; }
      .p31-deduct-sum .dv { font-size:22px;font-weight:900;color:#BE123C;
        font-family:var(--num,'DM Sans'),sans-serif; }

      /* Form section */
      .p31-form-section { background:#F8FAFC;border-radius:16px;padding:18px;margin-top:16px; }
      .p31-form-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
      @media(max-width:600px) { .p31-form-grid { grid-template-columns:1fr; } }
      .p31-field { }
      .p31-field label { display:block;font-size:11px;font-weight:700;color:#64748B;
        text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px; }
      .p31-field input, .p31-field select {
        width:100%;padding:11px 14px;border:1.5px solid #E2E8F0;border-radius:11px;
        font-size:15px;font-family:inherit;background:#fff;color:#0F172A;
        outline:none;transition:.15s;font-weight:600; }
      .p31-field input:focus, .p31-field select:focus { border-color:#DC2626; }
      .p31-field-full { grid-column:1/-1; }

      /* Validation msg */
      .p31-vmsg { border-radius:12px;padding:11px 14px;font-size:13px;margin:12px 0;
        font-weight:600;transition:all .2s; }

      /* Confirm button */
      .p31-confirm-btn { width:100%;margin-top:16px;padding:16px;border:none;
        border-radius:14px;background:linear-gradient(135deg,#DC2626,#991B1B);
        color:#fff;font-size:16px;font-weight:900;cursor:pointer;
        display:flex;align-items:center;justify-content:center;gap:10px;
        font-family:inherit;transition:all .2s;
        box-shadow:0 6px 20px rgba(220,38,38,.3);letter-spacing:.3px; }
      .p31-confirm-btn:hover:not(:disabled) { transform:translateY(-2px);
        box-shadow:0 10px 28px rgba(220,38,38,.4); }
      .p31-confirm-btn:disabled { opacity:.45;cursor:not-allowed;transform:none; }
      .p31-confirm-btn i { font-size:22px; }

      @media(max-width:768px) {
        .p31-hero-row { flex-direction:column; }
        .p31-total-box { text-align:center;width:100%; }
        .p31-stats { flex-wrap:wrap; }
        .p31-stat { min-width:50%; }
        .p31-grid { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(s);
  })();

  /* ══════════════════════════════════════════════════════════════
     OVERRIDE: renderPayroll
  ══════════════════════════════════════════════════════════════ */
  window.renderPayroll = window.renderPayrollV26 = function () {
    var sec = document.getElementById('page-att');
    if (!sec) return;

    var now = new Date();
    var ms  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    var me  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    var ml  = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

    sec.innerHTML = '<div class="p31-wrap"><div style="text-align:center;padding:48px;color:#94A3B8;">' +
      '<i class="material-icons-round" style="font-size:40px;animation:v23spin .8s linear infinite;display:block;margin-bottom:12px;">sync</i>' +
      'กำลังโหลดข้อมูล...</div></div>';

    Promise.all([
      loadEmployees(),
      db.from('เช็คชื่อ').select('*').gte('date', ms).lte('date', me),
      db.from('เบิกเงิน').select('*').eq('status', 'อนุมัติ').gte('date', ms + 'T00:00:00'),
      db.from('จ่ายเงินเดือน').select('*').eq('month', ms).order('paid_date', { ascending: true }),
    ]).then(function (results) {
      var emps    = (results[0] || []).filter(function (e) { return e.status === 'ทำงาน'; });
      var att     = results[1].data || [];
      var adv     = results[2].data || [];
      var paid    = results[3].data || [];
      var emojis  = ['👨‍💼','👩‍💼','🧑‍🔧','👨‍🔬','👩‍🍳','👨‍🎤','👩‍🎨','👨‍🚀','👨‍🚒','👮','🕵️','🤵'];

      window._v26Pay = emps.map(function (emp) {
        var ma   = att.filter(function (a) { return a.employee_id === emp.id; });
        var wd   = ma.filter(function (a) { return a.status !== 'ขาด' && a.status !== 'ลา'; }).length;
        var td   = ma.reduce(function (s, a) { return s + (a.deduction || 0); }, 0);
        var earn = emp.pay_type === 'รายเดือน' ? (emp.salary || 0) - td : (wd * (emp.daily_wage || 0)) - td;
        var myA  = adv.filter(function (a) { return a.employee_id === emp.id; });
        var taGross      = myA.reduce(function (s, a) { return s + a.amount; }, 0);
        var pastPays     = paid.filter(function (p) { return p.employee_id === emp.id; });
        var sumPaidNet   = pastPays.reduce(function (s, p) { return s + (p.net_paid || 0); }, 0);
        var sumPaidWithdraw  = pastPays.reduce(function (s, p) { return s + (p.deduct_withdraw || 0); }, 0);
        var sumTotalDeduct   = pastPays.reduce(function (s, p) { return s + (p.deduct_absent || 0) + (p.deduct_ss || 0) + (p.deduct_other || 0); }, 0);
        var net   = Math.max(0, earn - sumPaidNet - sumPaidWithdraw - sumTotalDeduct);
        var emoji = emojis[emp.id.charCodeAt(0) % emojis.length];
        return { emp: emp, wd: wd, td: td, earn: earn, taGross: taGross, net: net,
          pastPays: pastPays, sumPaidNet: sumPaidNet, sumPaidWithdraw: sumPaidWithdraw,
          sumTotalDeduct: sumTotalDeduct, paidCount: pastPays.length, emoji: emoji };
      });

      var totalNet  = window._v26Pay.reduce(function (s, x) { return s + x.net; }, 0);
      var totalEarn = window._v26Pay.reduce(function (s, x) { return s + x.earn; }, 0);
      var paidCount = window._v26Pay.filter(function (x) { return x.paidCount > 0; }).length;
      var pendCount = emps.length - paidCount;

      /* ── HERO BANNER ── */
      var bannerHTML =
        '<div class="p31-hero">' +
          '<div class="p31-hero-top">' +
            '<div class="p31-hero-row">' +
              '<div style="display:flex;align-items:center;gap:16px;">' +
                '<button class="p31-back" onclick="renderAttendance()">' +
                  '<i class="material-icons-round">arrow_back</i>กลับเช็คชื่อ' +
                '</button>' +
                '<div class="p31-title-block">' +
                  '<div class="p31-title-lbl">HR · เงินเดือนพนักงาน</div>' +
                  '<div class="p31-title-h">💳 จ่ายเงินเดือน</div>' +
                  '<div class="p31-title-m">' + ml + '</div>' +
                '</div>' +
              '</div>' +
              '<div class="p31-total-box">' +
                '<div class="p31-total-lbl">ยอดค้างจ่ายรวม</div>' +
                '<div class="p31-total-val">฿' + _pf(totalNet) + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="p31-stats">' +
            '<div class="p31-stat">' +
              '<div class="sl">พนักงาน</div>' +
              '<div class="sv">' + emps.length + '</div>' +
              '<div class="ss">คนที่กำลังทำงาน</div>' +
            '</div>' +
            '<div class="p31-stat cg">' +
              '<div class="sl">จ่ายแล้ว</div>' +
              '<div class="sv">' + paidCount + '</div>' +
              '<div class="ss">คน</div>' +
            '</div>' +
            '<div class="p31-stat cy">' +
              '<div class="sl">รอจ่าย</div>' +
              '<div class="sv">' + pendCount + '</div>' +
              '<div class="ss">คน</div>' +
            '</div>' +
            '<div class="p31-stat">' +
              '<div class="sl">สะสมเดือนนี้</div>' +
              '<div class="sv">฿' + _pf(totalEarn) + '</div>' +
              '<div class="ss">ยอดรวมก่อนหัก</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      /* ── CARDS ── */
      var cardsHTML = window._v26Pay.map(function (s) {
        var isPaid = s.paidCount > 0;
        return '<div onclick="v26ShowPayDetail(\'' + s.emp.id + '\')" class="p31-card ' + (isPaid ? 'is-paid' : 'is-pending') + '">' +
          '<div class="p31-card-shine"></div>' +
          '<div class="p31-card-hd">' +
            '<div class="p31-ava">' + s.emoji + '</div>' +
            '<div class="p31-emp-info">' +
              '<div class="p31-emp-name">' + s.emp.name + ' ' + (s.emp.lastname || '') + '</div>' +
              '<div class="p31-emp-pos">' + (s.emp.position || 'พนักงาน') + '</div>' +
            '</div>' +
            (isPaid
              ? '<div class="p31-paid-badge"><i class="material-icons-round">check_circle</i>จ่ายแล้ว</div>'
              : '<div class="p31-pending-badge"><i class="material-icons-round">schedule</i>รอจ่าย</div>') +
          '</div>' +
          '<div class="p31-card-stats">' +
            '<div class="p31-cs-box">' +
              '<div class="p31-cs-lbl">สะสมเดือนนี้</div>' +
              '<div class="p31-cs-val">฿' + _pf(s.earn) + '</div>' +
            '</div>' +
            '<div class="p31-cs-box">' +
              '<div class="p31-cs-lbl">เบิกล่วงหน้า</div>' +
              '<div class="p31-cs-val warn">฿' + _pf(s.taGross) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="p31-card-ft">' +
            '<div class="p31-ft-lbl">คงเหลือสุทธิ</div>' +
            '<div class="p31-ft-val">฿' + _pf(s.net) + '</div>' +
            '<i class="material-icons-round p31-ft-arr">chevron_right</i>' +
          '</div>' +
        '</div>';
      }).join('');

      sec.innerHTML =
        '<div class="p31-wrap">' +
          bannerHTML +
          '<div id="v26-pay-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:18px;">' +
            cardsHTML +
          '</div>' +
          '<div id="v26-pay-detail-wrap" style="display:none;margin-top:4px;"></div>' +
        '</div>';
    }).catch(function (e) {
      console.error('[v31] renderPayroll:', e);
      sec.innerHTML = '<div style="padding:40px;text-align:center;color:#EF4444;">' +
        '<i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:10px;">error_outline</i>' +
        'โหลดไม่สำเร็จ: ' + e.message + '</div>';
    });
  };

  /* ══════════════════════════════════════════════════════════════
     OVERRIDE: v26ShowPayDetail  (UI only — same logic as v27)
  ══════════════════════════════════════════════════════════════ */
  window.v26ShowPayDetail = function (eid) {
    var wrap = document.getElementById('v26-pay-detail-wrap');
    if (!wrap || !eid) return;
    var grid = document.getElementById('v26-pay-grid');
    if (grid) grid.style.display = 'none';
    wrap.style.display = 'block';

    var s = window._v26Pay ? window._v26Pay.find(function (x) { return x.emp.id === eid; }) : null;
    if (!s) return;

    var emp      = s.emp;
    var earn     = s.earn || 0;
    var pastPays = s.pastPays || [];
    var sumPN    = s.sumPaidNet || 0;
    var sumPD    = s.sumPaidWithdraw || 0;
    var sumTD    = s.sumTotalDeduct || 0;
    var remaining = Math.max(0, earn - sumPN - sumPD - sumTD);
    var totalAdv  = s.taGross || 0;
    var debtLeft  = Math.max(0, totalAdv - sumPD);

    var pastHTML = '';
    if (pastPays.length > 0) {
      pastHTML = '<div class="p31-past-alert">' +
        '<div class="p31-past-alert-hd"><i class="material-icons-round">warning_amber</i>' +
        'เดือนนี้จ่ายไปแล้ว ' + pastPays.length + ' ครั้ง (รวม ฿' + _pf(sumPN) + ')</div>' +
        pastPays.map(function (p, i) {
          return '<div class="p31-past-row">' +
            '<span>ครั้งที่ ' + (i + 1) + ' · ' + _pd(p.paid_date) + '</span>' +
            '<strong>฿' + _pf(p.net_paid) + '</strong></div>';
        }).join('') +
      '</div>';
    }

    wrap.innerHTML =
      '<button class="p31-detail-back" onclick="v26HidePayDetail()">' +
        '<i class="material-icons-round">arrow_back</i>กลับรายการพนักงาน' +
      '</button>' +

      '<div class="p31-detail-card">' +
        '<div class="p31-detail-head">' +
          '<div class="p31-detail-ava">' + (s.emoji || '👤') + '</div>' +
          '<div class="p31-detail-name">' + emp.name + ' ' + (emp.lastname || '') + '</div>' +
          '<div class="p31-detail-pos">' + (emp.position || '') + '</div>' +
        '</div>' +

        '<div class="p31-detail-body">' +
          pastHTML +

          '<div class="p31-remain-box' + (remaining <= 0 ? ' p31-remain-zero' : '') + '">' +
            '<div class="p31-remain-lbl">เพดานจ่ายได้สูงสุด</div>' +
            '<div class="p31-remain-val" style="color:' + (remaining > 0 ? '#166534' : '#DC2626') + '">฿' + _pf(remaining) + '</div>' +
          '</div>' +

          '<div>' +
            '<div class="p31-info-row"><span class="ik">วันทำงาน</span><span class="iv">' + (s.wd || 0) + ' วัน</span></div>' +
            '<div class="p31-info-row"><span class="ik">ค่าจ้างสะสม</span><span class="iv blue">฿' + _pf(earn) + '</span></div>' +
            '<div class="p31-info-row"><span class="ik">เบิกล่วงหน้าเดือนนี้</span><span class="iv amber">฿' + _pf(totalAdv) + '</span></div>' +
            '<div class="p31-info-row"><span class="ik">หนี้เบิกคงเหลือ</span><span class="iv red">฿' + _pf(debtLeft) + '</span></div>' +
            '<div class="p31-info-row"><span class="ik"><strong>เพดานจ่ายได้</strong></span><span class="iv green"><strong>฿' + _pf(remaining) + '</strong></span></div>' +
          '</div>' +

          '<div class="p31-deduct-sum">' +
            '<div class="dl">รวมหักเงินสะสมครั้งนี้</div>' +
            '<div class="dv" id="v26-sum-d-' + eid + '">฿0</div>' +
          '</div>' +

          '<div class="p31-form-section">' +
            '<div class="p31-form-grid">' +
              '<div class="p31-field">' +
                '<label>ยอดจ่ายสุทธิ (฿)</label>' +
                '<input type="number" id="v26r-' + eid + '" value="' + (remaining > 0 ? remaining : 0) + '" min="0"' +
                  ' oninput="v27PV(\'' + eid + '\',' + earn + ',' + (sumPN + sumPD + sumTD) + ',' + debtLeft + ')">' +
              '</div>' +
              '<div class="p31-field">' +
                '<label>หักหนี้เบิก (Max: ' + _pf(debtLeft) + ')</label>' +
                '<input type="number" id="v26d-' + eid + '" value="0" min="0" max="' + debtLeft + '"' +
                  ' oninput="v27PV(\'' + eid + '\',' + earn + ',' + (sumPN + sumPD + sumTD) + ',' + debtLeft + ')">' +
              '</div>' +
              '<div class="p31-field">' +
                '<label>หักประกันสังคม</label>' +
                '<input type="number" id="v26s-' + eid + '" value="0" min="0"' +
                  ' oninput="v27PV(\'' + eid + '\',' + earn + ',' + (sumPN + sumPD + sumTD) + ',' + debtLeft + ')">' +
              '</div>' +
              '<div class="p31-field">' +
                '<label>หักอื่นๆ</label>' +
                '<input type="number" id="v26o-' + eid + '" value="0" min="0"' +
                  ' oninput="v27PV(\'' + eid + '\',' + earn + ',' + (sumPN + sumPD + sumTD) + ',' + debtLeft + ')">' +
              '</div>' +
              '<div class="p31-field p31-field-full">' +
                '<label>หมายเหตุหักอื่นๆ</label>' +
                '<input type="text" id="v26on-' + eid + '" placeholder="ระบุเหตุผล...">' +
              '</div>' +
              '<div class="p31-field">' +
                '<label>วิธีจ่าย</label>' +
                '<select id="v26m-' + eid + '">' +
                  '<option value="เงินสด">เงินสด</option>' +
                  '<option value="โอนเงิน">โอนเงิน</option>' +
                '</select>' +
              '</div>' +
              '<div class="p31-field">' +
                '<label>หมายเหตุ</label>' +
                '<input type="text" id="v26pn-' + eid + '" placeholder="">' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="p31-vmsg" id="v26vm-' + eid + '"></div>' +

          '<button class="p31-confirm-btn" id="v26pb-' + eid + '" onclick="v26DoPay(\'' + eid + '\')">' +
            '<i class="material-icons-round">payments</i>ยืนยันจ่ายเงินเดือน' +
          '</button>' +
        '</div>' +
      '</div>';

    /* Also keep the legacy v26-pay-detail class for v26DoPay compatibility */
    if (typeof v27PV === 'function') v27PV(eid, earn, sumPN + sumPD + sumTD, debtLeft);
  };

  /* ── v26HidePayDetail ── */
  window.v26HidePayDetail = function () {
    var wrap = document.getElementById('v26-pay-detail-wrap');
    var grid = document.getElementById('v26-pay-grid');
    if (wrap) wrap.style.display = 'none';
    if (grid) grid.style.display = 'grid';
  };

  console.info('%c[v31-payrollui] ✅%c Professional Payroll UI (IIFE-safe)', 'color:#DC2626;font-weight:700', 'color:#6B7280');

})(); // end IIFE
