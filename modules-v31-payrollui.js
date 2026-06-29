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
  var p31Num = function (v) {
    var n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  var p31DateKey = function (value) {
    if (!value) return '';
    var raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  var p31MonthRange = function (date) {
    var start = new Date(date.getFullYear(), date.getMonth(), 1);
    var end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    var ms = p31DateKey(start);
    var me = p31DateKey(end);
    return { ms: ms, me: me, startAt: ms + 'T00:00:00', endAt: me + 'T23:59:59' };
  };
  var p31InMonth = function (rowDate, ms, me) {
    var k = p31DateKey(rowDate);
    return k >= ms && k <= me;
  };
  var p31ActiveEmployee = function (e) {
    return !e.status || e.status === 'ทำงาน';
  };
  var p31IsMonthly = function (emp) {
    return String(emp.pay_type || '').trim() === 'รายเดือน';
  };
  var p31NormStatus = function (status) {
    var st = String(status || '').trim();
    return st === 'มาครึ่งวัน' ? 'ครึ่งวัน' : st;
  };
  var p31IsWorkday = function (row) {
    var st = p31NormStatus(row && row.status);
    return !!st && st !== 'ขาด' && st !== 'ลา';
  };
  var p31EmpName = function (emp) {
    return [emp && emp.name, emp && emp.lastname].filter(Boolean).join(' ').trim();
  };
  var p31MoneyInput = function (id) {
    return p31Num(document.getElementById(id) && document.getElementById(id).value);
  };
  var p31MergeRows = function () {
    var seen = {};
    var out = [];
    Array.prototype.slice.call(arguments).forEach(function (list) {
      (list || []).forEach(function (row) {
        var key = row.id || [row.employee_id, row.month, row.paid_date, row.net_paid].join('|');
        if (seen[key]) return;
        seen[key] = true;
        out.push(row);
      });
    });
    return out;
  };
  var p31AttendanceStamp = function (row, fallback) {
    var value = row && (row.updated_at || row.created_at || row.time_out || row.time_in || row.date || row.id);
    var time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) ? time : fallback;
  };
  var p31NormalizeAttendanceRows = function (rows) {
    var map = {};
    (rows || []).forEach(function (row, index) {
      var empId = String(row && row.employee_id || '');
      var day = p31DateKey(row && row.date);
      if (!empId || !day) return;
      var key = empId + '|' + day;
      var next = Object.assign({}, row, { __dateKey: day, __rowStamp: p31AttendanceStamp(row, index) });
      if (!map[key] || next.__rowStamp >= map[key].__rowStamp) map[key] = next;
    });
    return Object.keys(map).map(function (key) { return map[key]; });
  };
  var p31PayLimit = function (s) {
    return Math.max(0, p31Num(s && s.earn) - p31Num(s && s.sumPaidNet) - p31Num(s && s.sumPaidWithdraw));
  };

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
    var range = p31MonthRange(now);
    var ms = range.ms;
    var me = range.me;
    var ml  = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

    sec.innerHTML = '<div class="p31-wrap"><div style="text-align:center;padding:48px;color:#94A3B8;">' +
      '<i class="material-icons-round" style="font-size:40px;animation:v23spin .8s linear infinite;display:block;margin-bottom:12px;">sync</i>' +
      'กำลังโหลดข้อมูล...</div></div>';

    Promise.all([
      loadEmployees(),
      db.from('เช็คชื่อ').select('*').gte('date', ms).lte('date', me),
      db.from('เช็คชื่อ').select('*').order('date', { ascending: false }).limit(1000),
      db.from('เบิกเงิน').select('*').eq('status', 'อนุมัติ').gte('date', range.startAt).lte('date', range.endAt),
      db.from('จ่ายเงินเดือน').select('*').eq('month', ms).order('paid_date', { ascending: true }),
      db.from('จ่ายเงินเดือน').select('*').gte('paid_date', range.startAt).lte('paid_date', range.endAt).order('paid_date', { ascending: true }),
    ]).then(function (results) {
      var emps    = (results[0] || []).filter(p31ActiveEmployee);
      var rawAtt  = p31MergeRows(results[1].data || [], results[2].data || []).filter(function (a) { return p31InMonth(a.date, ms, me); });
      var att     = p31NormalizeAttendanceRows(rawAtt);
      var adv     = (results[3].data || []).filter(function (a) { return p31InMonth(a.date, ms, me); });
      var paid    = p31MergeRows(results[4].data || [], results[5].data || []).filter(function (p) {
        return p.month === ms || p31InMonth(p.paid_date || p.month, ms, me);
      });
      var emojis  = ['👨‍💼','👩‍💼','🧑‍🔧','👨‍🔬','👩‍🍳','👨‍🎤','👩‍🎨','👨‍🚀','👨‍🚒','👮','🕵️','🤵'];
      window._p31PayrollDebug = { monthStart: ms, monthEnd: me, employees: emps.length, attendanceRows: att.length, advances: adv.length, paidRows: paid.length };

      window._v26Pay = emps.map(function (emp) {
        var empId = String(emp.id);
        var ma   = att.filter(function (a) { return String(a.employee_id) === empId; });
        var wd   = ma.filter(p31IsWorkday).length;
        var td   = ma.reduce(function (s, a) { return s + p31Num(a.deduction); }, 0);
        var earn = p31IsMonthly(emp) ? p31Num(emp.salary) - td : (wd * p31Num(emp.daily_wage)) - td;
        var myA  = adv.filter(function (a) { return String(a.employee_id) === empId; });
        var taGross      = myA.reduce(function (s, a) { return s + p31Num(a.amount); }, 0);
        var pastPays     = paid.filter(function (p) { return String(p.employee_id) === empId; });
        var sumPaidNet   = pastPays.reduce(function (s, p) { return s + p31Num(p.net_paid); }, 0);
        var sumPaidWithdraw  = pastPays.reduce(function (s, p) { return s + p31Num(p.deduct_withdraw); }, 0);
        var sumTotalDeduct   = 0;
        var taLeft = Math.max(0, taGross - sumPaidWithdraw);
        var net   = Math.max(0, earn - sumPaidNet - sumPaidWithdraw);
        var emoji = emojis[emp.id.charCodeAt(0) % emojis.length];
        return { emp: emp, wd: wd, td: td, earn: earn, ta: taLeft, taGross: taGross, myA: myA, net: net,
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

      var pickerHTML =
        '<div style="background:#fff;border:1.5px solid #e2e8f0;border-radius:18px;padding:22px;box-shadow:0 10px 28px rgba(15,23,42,.06);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;">' +
            '<div>' +
              '<h3 style="margin:0;color:#0f172a;font-size:20px;font-weight:900;">เลือกพนักงานเพื่อออกใบจ่าย</h3>' +
              '<div style="color:#64748b;font-size:13px;margin-top:4px;">เลือกชื่อจากดรอปดาว แล้วระบบจะแสดงรายละเอียดเงินเดือนในป็อปอัพ</div>' +
            '</div>' +
            '<button class="p31-confirm-btn" style="width:auto;margin:0;padding:12px 20px;" onclick="p31OpenEmployeePicker()">' +
              '<i class="material-icons-round">person_search</i>เลือกพนักงาน' +
            '</button>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:minmax(240px,1fr) auto;gap:10px;align-items:center;">' +
            '<select id="p31-emp-select" class="form-input" style="height:46px;border:1.5px solid #dbe3ef;border-radius:12px;padding:0 14px;font:inherit;font-weight:700;color:#0f172a;background:#fff;">' +
              '<option value="">-- เลือกพนักงาน --</option>' +
              window._v26Pay.map(function (s) {
                return '<option value="' + s.emp.id + '">' + p31EmpName(s.emp) + ' | ' + s.wd + ' วัน | ฿' + _pf(s.net) + '</option>';
              }).join('') +
            '</select>' +
            '<button class="p31-back" style="background:#0f172a;border-color:#0f172a;color:#fff;" onclick="p31OpenSelectedPaySlip()">' +
              '<i class="material-icons-round">receipt_long</i>แสดงใบจ่าย' +
            '</button>' +
          '</div>' +
          '<div style="margin-top:14px;color:#94a3b8;font-size:12px;">ข้อมูลที่โหลดได้: เช็คชื่อ ' + att.length + ' รายการ / เงินเบิก ' + adv.length + ' รายการ</div>' +
        '</div>';

      sec.innerHTML =
        '<div class="p31-wrap">' +
          bannerHTML +
          pickerHTML +
          '<div id="v26-pay-grid" style="display:none;"></div>' +
          '<div id="v26-pay-detail-wrap" style="display:none;margin-top:4px;"></div>' +
        '</div>';
    }).catch(function (e) {
      console.error('[v31] renderPayroll:', e);
      sec.innerHTML = '<div style="padding:40px;text-align:center;color:#EF4444;">' +
        '<i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:10px;">error_outline</i>' +
        'โหลดไม่สำเร็จ: ' + e.message + '</div>';
    });
  };

  window.p31OpenSelectedPaySlip = function () {
    var eid = document.getElementById('p31-emp-select') && document.getElementById('p31-emp-select').value;
    if (!eid) { if (typeof toast === 'function') toast('กรุณาเลือกพนักงาน', 'warning'); return; }
    window.p31ShowPaySlipPopup(eid);
  };

  window.p31OpenEmployeePicker = function () {
    var rows = window._v26Pay || [];
    if (!rows.length) { if (typeof toast === 'function') toast('ยังไม่มีข้อมูลพนักงาน', 'warning'); return; }
    if (typeof Swal === 'undefined') return;
    Swal.fire({
      title: 'เลือกพนักงาน',
      html: '<select id="p31-swal-emp" class="swal2-select" style="width:80%">' +
        '<option value="">-- เลือกพนักงาน --</option>' +
        rows.map(function (s) {
          return '<option value="' + s.emp.id + '">' + p31EmpName(s.emp) + ' | ทำงาน ' + s.wd + ' วัน | คงเหลือ ฿' + _pf(s.net) + '</option>';
        }).join('') +
      '</select>',
      showCancelButton: true,
      confirmButtonText: 'แสดงใบจ่าย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
      preConfirm: function () {
        var eid = document.getElementById('p31-swal-emp').value;
        if (!eid) {
          Swal.showValidationMessage('กรุณาเลือกพนักงาน');
          return false;
        }
        return eid;
      }
    }).then(function (r) {
      if (r.isConfirmed && r.value) window.p31ShowPaySlipPopup(r.value);
    });
  };

  window.p31ValidatePaySlip = function (eid) {
    var s = (window._v26Pay || []).find(function (x) { return String(x.emp.id) === String(eid); });
    if (!s) return false;
    var recv = p31MoneyInput('v26r-' + eid);
    var debt = p31MoneyInput('v26d-' + eid);
    var ss = p31MoneyInput('v26s-' + eid);
    var oth = p31MoneyInput('v26o-' + eid);
    var total = recv + debt + ss + oth;
    var limit = p31PayLimit(s);
    var maxDebt = p31Num(s.ta);
    var msg = document.getElementById('v26vm-' + eid);
    var btn = document.getElementById('v26pb-' + eid);
    var sum = document.getElementById('v26-sum-d-' + eid);
    if (sum) sum.textContent = '฿' + _pf(debt + ss + oth);
    var ok = true;
    var text = 'ยอดรวมที่กรอก ฿' + _pf(total) + ' / เพดานจ่าย ฿' + _pf(limit);
    if (debt > maxDebt) { ok = false; text = 'หักหนี้เกินยอดเบิกค้าง ฿' + _pf(maxDebt); }
    else if (total > limit) { ok = false; text = 'ยอดรวมเกินเพดานจ่าย ฿' + _pf(limit); }
    else if (recv < 0 || debt < 0 || ss < 0 || oth < 0) { ok = false; text = 'ห้ามกรอกค่าติดลบ'; }
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = ok ? '#dcfce7' : '#fee2e2';
      msg.style.color = ok ? '#166534' : '#991b1b';
      msg.textContent = text;
    }
    if (btn) btn.disabled = !ok;
    return ok;
  };

  window.p31ShowPaySlipPopup = function (eid) {
    var s = (window._v26Pay || []).find(function (x) { return String(x.emp.id) === String(eid); });
    if (!s) return;
    if (typeof Swal === 'undefined') { window.v26ShowPayDetail(eid); return; }
    var emp = s.emp;
    var limit = p31PayLimit(s);
    var debtLeft = p31Num(s.ta);
    var html =
      '<div style="text-align:left">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px"><b>วันทำงาน</b><br><span style="font-size:22px;font-weight:900">' + s.wd + ' วัน</span></div>' +
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px"><b>ค่าแรงสะสม</b><br><span style="font-size:22px;font-weight:900">฿' + _pf(s.earn) + '</span></div>' +
          '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px"><b>เบิกค้าง</b><br><span style="font-size:22px;font-weight:900;color:#d97706">฿' + _pf(debtLeft) + '</span></div>' +
          '<div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:10px"><b>จ่ายได้คงเหลือ</b><br><span style="font-size:22px;font-weight:900;color:#059669">฿' + _pf(limit) + '</span></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<label>ยอดจ่ายสุทธิ<input class="swal2-input" style="width:100%;margin:6px 0 0" type="number" id="v26r-' + eid + '" value="' + limit + '" min="0" oninput="p31ValidatePaySlip(\'' + eid + '\')"></label>' +
          '<label>หักหนี้เบิก<input class="swal2-input" style="width:100%;margin:6px 0 0" type="number" id="v26d-' + eid + '" value="0" min="0" max="' + debtLeft + '" oninput="p31ValidatePaySlip(\'' + eid + '\')"></label>' +
          '<label>หักประกันสังคม<input class="swal2-input" style="width:100%;margin:6px 0 0" type="number" id="v26s-' + eid + '" value="0" min="0" oninput="p31ValidatePaySlip(\'' + eid + '\')"></label>' +
          '<label>หักอื่น ๆ<input class="swal2-input" style="width:100%;margin:6px 0 0" type="number" id="v26o-' + eid + '" value="0" min="0" oninput="p31ValidatePaySlip(\'' + eid + '\')"></label>' +
          '<label style="grid-column:1/-1">หมายเหตุหักอื่น ๆ<input class="swal2-input" style="width:100%;margin:6px 0 0" type="text" id="v26on-' + eid + '"></label>' +
          '<label>วิธีจ่าย<select class="swal2-select" style="width:100%;margin:6px 0 0" id="v26m-' + eid + '"><option value="เงินสด">เงินสด</option><option value="โอนเงิน">โอนเงิน</option></select></label>' +
          '<label>หมายเหตุ<input class="swal2-input" style="width:100%;margin:6px 0 0" type="text" id="v26pn-' + eid + '"></label>' +
        '</div>' +
        '<div class="p31-deduct-sum" style="margin-top:12px"><div class="dl">รวมหักครั้งนี้</div><div class="dv" id="v26-sum-d-' + eid + '">฿0</div></div>' +
        '<div class="p31-vmsg" id="v26vm-' + eid + '"></div>' +
        '<button class="p31-confirm-btn" id="v26pb-' + eid + '" onclick="v26DoPay(\'' + eid + '\')"><i class="material-icons-round">payments</i>ยืนยันจ่ายเงินเดือน</button>' +
      '</div>';
    Swal.fire({
      title: 'ใบจ่ายเงินเดือน: ' + p31EmpName(emp),
      html: html,
      width: 780,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: function () { window.p31ValidatePaySlip(eid); }
    });
  };

  window.v26DoPay = async function (eid) {
    var s = (window._v26Pay || []).find(function (x) { return String(x.emp.id) === String(eid); });
    if (!s || !window.p31ValidatePaySlip(eid)) return;
    var recv = p31MoneyInput('v26r-' + eid);
    var debt = p31MoneyInput('v26d-' + eid);
    var ss = p31MoneyInput('v26s-' + eid);
    var oth = p31MoneyInput('v26o-' + eid);
    var method = (document.getElementById('v26m-' + eid) && document.getElementById('v26m-' + eid).value) || 'เงินสด';
    var note = (document.getElementById('v26pn-' + eid) && document.getElementById('v26pn-' + eid).value) || '';
    var oNote = (document.getElementById('v26on-' + eid) && document.getElementById('v26on-' + eid).value) || '';
    var ok = await Swal.fire({
      title: 'ยืนยันจ่ายเงินเดือน',
      html: '<p><strong>' + p31EmpName(s.emp) + '</strong></p><p>รับจริง: ฿' + _pf(recv) + '</p>' +
        (debt ? '<p>หักหนี้: ฿' + _pf(debt) + '</p>' : '') +
        (ss ? '<p>หักประกันสังคม: ฿' + _pf(ss) + '</p>' : '') +
        (oth ? '<p>หักอื่น ๆ: ฿' + _pf(oth) + '</p>' : ''),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    });
    if (!ok.isConfirmed) return;
    if (method === 'เงินสด' && recv > 0 && typeof assertCashEnough === 'function') {
      try { await assertCashEnough(recv, 'จ่ายเงินเดือน'); }
      catch (e) { Swal.fire({ icon: 'error', title: 'เงินสดไม่พอ', text: e.message }); return; }
    }
    var now = new Date();
    var ms = p31MonthRange(now).ms;
    var noteBits = [];
    if (note) noteBits.push(note);
    noteBits.push('จ่ายทาง ' + method);
    if (ss) noteBits.push('หักประกันสังคม ฿' + ss);
    if (oth) noteBits.push('หักอื่น ๆ ฿' + oth + (oNote ? ' (' + oNote + ')' : ''));
    var ins = {
      employee_id: eid,
      month: ms,
      working_days: p31Num(s.wd),
      base_salary: Math.max(0, p31Num(s.earn)),
      deduct_withdraw: debt,
      deduct_absent: p31Num(s.td),
      bonus: 0,
      net_paid: recv,
      paid_date: now.toISOString(),
      staff_name: (window.USER && USER.username) || '',
      note: noteBits.join(' | ')
    };
    var res = await db.from('จ่ายเงินเดือน').insert(ins).select().single();
    if (res.error) { Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: res.error.message }); return; }
    if (method === 'เงินสด' && recv > 0) {
      try {
        var sessRes = await db.from('cash_session').select('id').eq('status', 'open').limit(1).maybeSingle();
        if (sessRes.data && typeof recordCashTx === 'function') {
          await recordCashTx({ sessionId: sessRes.data.id, type: 'จ่ายเงินเดือน', direction: 'out', amount: recv, netAmount: recv, refId: res.data && res.data.id, refTable: 'จ่ายเงินเดือน', note: p31EmpName(s.emp) });
        }
      } catch (e) { console.warn('[p31] cash transaction:', e); }
    }
    if (debt > 0) {
      try {
        var advs = await db.from('เบิกเงิน').select('*').eq('employee_id', eid).eq('status', 'อนุมัติ').order('date');
        var rem = debt;
        for (var i = 0; i < (advs.data || []).length; i++) {
          var a = advs.data[i];
          if (rem <= 0) break;
          if (p31Num(a.amount) <= rem) {
            await db.from('เบิกเงิน').update({ status: 'ชำระแล้ว' }).eq('id', a.id);
            rem -= p31Num(a.amount);
          } else {
            await db.from('เบิกเงิน').update({ amount: p31Num(a.amount) - rem }).eq('id', a.id);
            rem = 0;
          }
        }
      } catch (e) { console.warn('[p31] advance update:', e); }
    }
    if (typeof logActivity === 'function') {
      try { logActivity('จ่ายเงินเดือน', p31EmpName(s.emp) + ' ฿' + _pf(recv)); } catch (_) {}
    }
    await Swal.fire({ icon: 'success', title: 'บันทึกเงินเดือนแล้ว', timer: 1300, showConfirmButton: false });
    window.renderPayrollV26();
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
