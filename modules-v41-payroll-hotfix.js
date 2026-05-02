(function () {
  'use strict';

  console.log('[v41-payroll-hotfix] loaded');

  function money(n) {
    return Number(n || 0).toLocaleString('th-TH');
  }

  function num(v) {
    var n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function dateKey(value) {
    if (!value) return '';
    var raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function monthRange(d) {
    var start = new Date(d.getFullYear(), d.getMonth(), 1);
    var end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start: dateKey(start), end: dateKey(end), startAt: dateKey(start) + 'T00:00:00', endAt: dateKey(end) + 'T23:59:59' };
  }

  function fullName(emp) {
    return [emp && emp.name, emp && emp.lastname].filter(Boolean).join(' ').trim();
  }

  function injectStyle() {
    if (document.getElementById('v41-payroll-style')) return;
    var s = document.createElement('style');
    s.id = 'v41-payroll-style';
    s.textContent = `
      .v41-pay-wrap{max-width:1180px;margin:0 auto;padding:0 8px 40px}
      .v41-pay-hero{border-radius:24px;overflow:hidden;background:linear-gradient(135deg,#111827 0%,#273449 52%,#101828 100%);box-shadow:0 22px 54px rgba(15,23,42,.2);color:#fff;margin-bottom:22px}
      .v41-pay-hero-main{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;align-items:center;padding:30px}
      .v41-pay-back{height:46px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.1);color:#fff;font-weight:900;padding:0 18px;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
      .v41-pay-title{display:flex;align-items:center;gap:16px;margin-top:18px}.v41-pay-icon{width:62px;height:62px;border-radius:18px;background:#f59e0b;display:grid;place-items:center;color:#fff;box-shadow:0 14px 30px rgba(245,158,11,.28)}
      .v41-pay-kicker{font-size:12px;letter-spacing:2px;color:#fbbf24;font-weight:950}.v41-pay-h1{font-size:36px;line-height:1;font-weight:950;letter-spacing:0;margin-top:6px}.v41-pay-sub{color:#cbd5e1;font-size:14px;font-weight:800;margin-top:8px}
      .v41-total-card{border:1px solid rgba(251,191,36,.34);background:rgba(245,158,11,.11);border-radius:22px;padding:20px;text-align:right}.v41-total-card span{display:block;color:#fbbf24;font-size:12px;font-weight:950;letter-spacing:.8px}.v41-total-card strong{display:block;font-size:42px;line-height:1.1;color:#fff7cc;margin-top:12px}
      .v41-statbar{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(255,255,255,.1);background:rgba(15,23,42,.26)}.v41-stat{padding:18px 22px;border-left:1px solid rgba(255,255,255,.08)}.v41-stat:first-child{border-left:0}.v41-stat i{font-size:22px;color:#a5b4fc}.v41-stat span{display:block;color:#94a3b8;font-size:12px;font-weight:900;margin-top:6px}.v41-stat strong{display:block;font-size:26px;font-weight:950;margin-top:4px}
      .v41-console{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;box-shadow:0 16px 38px rgba(15,23,42,.07)}.v41-console-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;flex-wrap:wrap;margin-bottom:18px}.v41-console h3{margin:0;color:#0f172a;font-size:22px;font-weight:950}.v41-console p{margin:6px 0 0;color:#64748b;font-size:13px;font-weight:700}.v41-load-chip{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:8px 12px;color:#475569;font-size:12px;font-weight:900}
      .v41-picker{display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:10px;align-items:center}.v41-picker select{height:52px;border:1.5px solid #dbe3ef;border-radius:12px;padding:0 14px;font:inherit;font-weight:900;color:#0f172a;background:#fff}.v41-action{height:52px;border:0;border-radius:12px;background:#111827;color:#fff;font-weight:950;padding:0 20px;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
      .v41-swal-popup{padding:0!important;border-radius:18px!important;overflow:hidden}.v41-slip{font-family:inherit;text-align:left;background:#fff;color:#0f172a}.v41-slip-head{background:linear-gradient(135deg,#111827,#263244);color:#fff;padding:24px 26px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:start}.v41-slip-kicker{font-size:11px;font-weight:950;letter-spacing:1.8px;color:#fbbf24}.v41-slip-name{font-size:24px;font-weight:950;margin-top:6px}.v41-slip-meta{color:#cbd5e1;font-size:12px;font-weight:800;margin-top:6px}.v41-net-badge{text-align:right}.v41-net-badge span{display:block;color:#fbbf24;font-size:11px;font-weight:950;letter-spacing:.8px}.v41-net-badge strong{display:block;font-size:44px;line-height:1;color:#fff7cc;margin-top:8px}
      .v41-slip-body{padding:22px 26px}.v41-slip-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:18px}.v41-bill-panel{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}.v41-bill-row{display:grid;grid-template-columns:1fr auto;gap:16px;padding:12px 14px;border-top:1px solid #e2e8f0;align-items:center}.v41-bill-row:first-child{border-top:0}.v41-bill-row span{color:#64748b;font-weight:850}.v41-bill-row b{font-size:16px}.v41-bill-row.--total{background:#ecfdf5}.v41-bill-row.--total span,.v41-bill-row.--total b{color:#047857;font-weight:950}.v41-bill-row.--warn{background:#fff7ed}.v41-bill-row.--warn b{color:#d97706}
      .v41-entry-panel{border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc}.v41-entry-title{font-size:14px;font-weight:950;margin-bottom:12px;color:#111827}.v41-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v41-field label{display:block;font-size:11px;font-weight:950;color:#64748b;margin-bottom:6px}.v41-field input,.v41-field select{width:100%;height:42px;border:1.5px solid #dbe3ef;border-radius:10px;background:#fff;padding:0 11px;font:inherit;font-weight:850;color:#0f172a;box-sizing:border-box}.v41-field input:focus,.v41-field select:focus{outline:none;border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.14)}.v41-field.--full{grid-column:1/-1}
      .v41-calc{margin-top:12px;border-radius:14px;padding:13px 14px;background:#eef2ff;border:1px solid #c7d2fe;color:#312e81}.v41-calc-row{display:flex;justify-content:space-between;gap:14px;font-weight:900;font-size:13px}.v41-calc-row + .v41-calc-row{margin-top:6px}.v41-calc strong{font-size:18px}.v41-calc.--bad{background:#fee2e2;border-color:#fecaca;color:#991b1b}.v41-save-btn{width:100%;height:50px;margin-top:14px;border:0;border-radius:13px;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;font-weight:950;font-size:15px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.v41-save-btn:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:760px){.v41-pay-hero-main,.v41-slip-head,.v41-slip-grid{grid-template-columns:1fr}.v41-statbar{grid-template-columns:repeat(2,1fr)}.v41-picker{grid-template-columns:1fr}.v41-net-badge{text-align:left}.v41-form-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function isActive(emp) {
    return !emp.status || emp.status === 'ทำงาน';
  }

  function isWorkday(att) {
    var st = String(att && att.status || '').trim();
    return st !== 'ขาด' && st !== 'ลา';
  }

  async function loadPayrollRows() {
    var now = new Date();
    var range = monthRange(now);
    var emps = (await loadEmployees()).filter(isActive);
    var results = await Promise.all([
      db.from('เช็คชื่อ').select('*').gte('date', range.start).lte('date', range.end),
      db.from('เบิกเงิน').select('*').eq('status', 'อนุมัติ').gte('date', range.startAt).lte('date', range.endAt),
      db.from('เบิกเงิน').select('*').eq('status', 'อนุมัติ').order('date', { ascending: true }),
      db.from('จ่ายเงินเดือน').select('*').eq('month', range.start),
      db.from('จ่ายเงินเดือน').select('*').gte('paid_date', range.startAt).lte('paid_date', range.endAt)
    ]);

    var att = results[0].data || [];
    var adv = results[1].data || [];
    var allAdv = results[2].data || [];
    var paid = [];
    var seen = {};
    [results[3].data || [], results[4].data || []].forEach(function (list) {
      list.forEach(function (row) {
        var key = row.id || [row.employee_id, row.month, row.paid_date].join('|');
        if (!seen[key]) { seen[key] = true; paid.push(row); }
      });
    });

    var rows = emps.map(function (emp) {
      var empId = String(emp.id);
      var myAtt = att.filter(function (a) { return String(a.employee_id) === empId; });
      var myAdv = adv.filter(function (a) { return String(a.employee_id) === empId; });
      var myAllAdv = allAdv.filter(function (a) { return String(a.employee_id) === empId; });
      var myPaid = paid.filter(function (p) { return String(p.employee_id) === empId; });
      var workDays = myAtt.filter(isWorkday).length;
      var absentDeduct = myAtt.reduce(function (s, a) { return s + num(a.deduction); }, 0);
      var gross = String(emp.pay_type || '').trim() === 'รายเดือน'
        ? num(emp.salary) - absentDeduct
        : (workDays * num(emp.daily_wage)) - absentDeduct;
      gross = Math.max(0, gross);
      var advanceTotal = myAdv.reduce(function (s, a) { return s + num(a.amount); }, 0);
      var advanceAllTotal = myAllAdv.reduce(function (s, a) { return s + num(a.amount); }, 0);
      var paidNet = myPaid.reduce(function (s, p) { return s + num(p.net_paid); }, 0);
      var paidAdvance = myPaid.reduce(function (s, p) { return s + num(p.deduct_withdraw); }, 0);
      var netLeft = Math.max(0, gross - paidNet - paidAdvance);
      return {
        emp: emp,
        att: myAtt,
        adv: myAdv,
        allAdv: myAllAdv,
        paid: myPaid,
        workDays: workDays,
        absentDeduct: absentDeduct,
        gross: gross,
        advanceTotal: advanceTotal,
        advanceAllTotal: advanceAllTotal,
        advanceLeft: Math.max(0, advanceAllTotal),
        monthAdvanceLeft: Math.max(0, advanceTotal - paidAdvance),
        paidNet: paidNet,
        paidAdvance: paidAdvance,
        netLeft: netLeft
      };
    });

    window._v41Payroll = { range: range, rows: rows, attendanceRows: att.length, advanceRows: adv.length, allAdvanceRows: allAdv.length, paidRows: paid.length };
    return window._v41Payroll;
  }

  function optionRows(rows) {
    return rows.map(function (r) {
      return '<option value="' + r.emp.id + '">' + fullName(r.emp) + ' | ' + r.workDays + ' วัน | ฿' + money(r.netLeft) + '</option>';
    }).join('');
  }

  var hotfixRenderPayroll = window.renderPayroll = window.renderPayrollV26 = async function () {
    var sec = document.getElementById('page-att');
    if (!sec) return;
    injectStyle();
    sec.innerHTML = '<div style="padding:48px;text-align:center;color:#64748b;font-weight:800">กำลังโหลดเงินเดือน...</div>';
    try {
      var data = await loadPayrollRows();
      var monthLabel = new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
      var totalNet = data.rows.reduce(function (s, r) { return s + r.netLeft; }, 0);
      var totalGross = data.rows.reduce(function (s, r) { return s + r.gross; }, 0);
      var paidCount = data.rows.filter(function (r) { return r.paid.length > 0; }).length;
      var pending = data.rows.length - paidCount;

      sec.innerHTML =
        '<div class="v41-pay-wrap">' +
          '<div class="v41-pay-hero">' +
            '<div class="v41-pay-hero-main">' +
              '<div>' +
                '<button class="v41-pay-back" onclick="renderAttendance()"><i class="material-icons-round">arrow_back</i> กลับเช็คชื่อ</button>' +
                '<div class="v41-pay-title">' +
                  '<div class="v41-pay-icon"><i class="material-icons-round">payments</i></div>' +
                  '<div><div class="v41-pay-kicker">HR · PAYROLL CONSOLE v42</div><div class="v41-pay-h1">จ่ายเงินเดือน</div><div class="v41-pay-sub">' + monthLabel + '</div></div>' +
                '</div>' +
              '</div>' +
              '<div class="v41-total-card"><span>ยอดค้างจ่ายรวม</span><strong>฿' + money(totalNet) + '</strong></div>' +
            '</div>' +
            '<div class="v41-statbar">' +
              '<div class="v41-stat"><i class="material-icons-round">groups</i><span>พนักงาน</span><strong>' + data.rows.length + '</strong></div>' +
              '<div class="v41-stat"><i class="material-icons-round" style="color:#6ee7b7">check_circle</i><span>จ่ายแล้ว</span><strong style="color:#6ee7b7">' + paidCount + '</strong></div>' +
              '<div class="v41-stat"><i class="material-icons-round" style="color:#fcd34d">pending</i><span>รอจ่าย</span><strong style="color:#fcd34d">' + pending + '</strong></div>' +
              '<div class="v41-stat"><i class="material-icons-round" style="color:#f9a8d4">savings</i><span>สะสมเดือนนี้</span><strong>฿' + money(totalGross) + '</strong></div>' +
            '</div>' +
          '</div>' +
          '<div class="v41-console">' +
            '<div class="v41-console-head"><div><h3>เลือกพนักงานเพื่อออกใบจ่าย</h3><p>เลือกชื่อแล้วเปิดใบจ่ายแบบบิล ระบบจะคำนวณยอดคงเหลือให้ระหว่างกรอก</p></div>' +
              '<div class="v41-load-chip">เช็คชื่อ ' + data.attendanceRows + ' รายการ · เบิกเดือนนี้ ' + data.advanceRows + ' รายการ · เบิกค้างทั้งหมด ' + data.allAdvanceRows + ' รายการ</div></div>' +
            '<div class="v41-picker">' +
              '<select id="v41-pay-emp">' +
                '<option value="">-- เลือกพนักงาน --</option>' + optionRows(data.rows) +
              '</select>' +
              '<button class="v41-action" onclick="v41OpenSelectedPayroll()"><i class="material-icons-round">receipt_long</i> เปิดใบจ่าย</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    } catch (e) {
      console.error('[v41-payroll-hotfix]', e);
      sec.innerHTML = '<div style="padding:40px;text-align:center;color:#dc2626;font-weight:800">โหลดเงินเดือนไม่สำเร็จ: ' + (e.message || e) + '</div>';
    }
  };

  function installHotfixOverride(rerenderIfOld) {
    window.renderPayroll = hotfixRenderPayroll;
    window.renderPayrollV26 = hotfixRenderPayroll;
    window.__v41PayrollHotfixActive = true;
    var sec = document.getElementById('page-att');
    if (rerenderIfOld && sec && !/PAYROLL HOTFIX v41/.test(sec.textContent || '') && sec.querySelector('.p33-card,.p31-card')) {
      setTimeout(function () { hotfixRenderPayroll(); }, 0);
    }
  }

  function scheduleHotfixOverride() {
    [0, 350, 700, 1200, 1800, 2800, 4200, 6500].forEach(function (delay) {
      setTimeout(function () { installHotfixOverride(true); }, delay);
    });
  }

  window.v41OpenSelectedPayroll = function () {
    var eid = document.getElementById('v41-pay-emp') && document.getElementById('v41-pay-emp').value;
    if (!eid) { toast && toast('กรุณาเลือกพนักงาน', 'warning'); return; }
    window.v41OpenPayrollPopup(eid);
  };

  window.v41ValidatePayroll = function (eid) {
    var r = (window._v41Payroll && window._v41Payroll.rows || []).find(function (x) { return String(x.emp.id) === String(eid); });
    if (!r) return false;
    var recv = num(document.getElementById('v41-recv-' + eid).value);
    var debt = num(document.getElementById('v41-debt-' + eid).value);
    var ss = num(document.getElementById('v41-ss-' + eid).value);
    var other = num(document.getElementById('v41-other-' + eid).value);
    var total = recv + debt + ss + other;
    var remaining = Math.max(0, r.netLeft - total);
    var ok = total > 0 && debt <= r.advanceLeft && total <= r.netLeft && recv >= 0 && debt >= 0 && ss >= 0 && other >= 0;
    var msg = document.getElementById('v41-msg-' + eid);
    if (msg) {
      msg.className = 'v41-calc' + (ok ? '' : ' --bad');
      msg.innerHTML =
        '<div class="v41-calc-row"><span>ยอดที่กรอกแล้ว</span><strong>฿' + money(total) + '</strong></div>' +
        '<div class="v41-calc-row"><span>ยังจัดสรร/จ่ายเพิ่มได้อีก</span><strong>฿' + money(remaining) + '</strong></div>' +
        (!ok ? '<div class="v41-calc-row"><span>สถานะ</span><strong>' + (total <= 0 ? 'กรุณากรอกยอดจ่ายหรือยอดหัก' : 'ยอดรวมเกิน หรือหักหนี้เกินยอดเบิกค้าง') + '</strong></div>' : '');
    }
    var btn = document.getElementById('v41-save-' + eid);
    if (btn) btn.disabled = !ok;
    return ok;
  };

  window.v41OpenPayrollPopup = function (eid) {
    var r = (window._v41Payroll && window._v41Payroll.rows || []).find(function (x) { return String(x.emp.id) === String(eid); });
    if (!r || typeof Swal === 'undefined') return;
    injectStyle();
    var html =
      '<div class="v41-slip">' +
        '<div class="v41-slip-head">' +
          '<div><div class="v41-slip-kicker">PAYROLL SLIP</div><div class="v41-slip-name">' + fullName(r.emp) + '</div><div class="v41-slip-meta">' + (r.emp.position || 'พนักงาน') + ' · ' + new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }) + '</div></div>' +
          '<div class="v41-net-badge"><span>ยอดสุทธิคงเหลือ</span><strong>฿' + money(r.netLeft) + '</strong></div>' +
        '</div>' +
        '<div class="v41-slip-body">' +
          '<div class="v41-slip-grid">' +
            '<div class="v41-bill-panel">' +
              '<div class="v41-bill-row"><span>วันทำงาน</span><b>' + r.workDays + ' วัน</b></div>' +
              '<div class="v41-bill-row"><span>ค่าแรงสะสม</span><b>฿' + money(r.gross) + '</b></div>' +
              '<div class="v41-bill-row"><span>หักขาด/สาย</span><b>-฿' + money(r.absentDeduct) + '</b></div>' +
              '<div class="v41-bill-row"><span>จ่ายไปแล้ว</span><b>-฿' + money(r.paidNet) + '</b></div>' +
              '<div class="v41-bill-row"><span>เบิกเดือนนี้</span><b>฿' + money(r.advanceTotal) + '</b></div>' +
              '<div class="v41-bill-row --warn"><span>เบิกค้างชำระทั้งหมด</span><b>฿' + money(r.advanceLeft) + '</b></div>' +
              '<div class="v41-bill-row --total"><span>ยอดสุทธิคงเหลือ</span><b>฿' + money(r.netLeft) + '</b></div>' +
            '</div>' +
            '<div class="v41-entry-panel">' +
              '<div class="v41-entry-title">กรอกยอดจ่ายครั้งนี้</div>' +
              '<div class="v41-form-grid">' +
                '<div class="v41-field"><label>ยอดจ่ายสุทธิ</label><input id="v41-recv-' + eid + '" type="number" value="" placeholder="0" min="0" oninput="v41ValidatePayroll(\'' + eid + '\')"></div>' +
                '<div class="v41-field"><label>หักหนี้เบิก</label><input id="v41-debt-' + eid + '" type="number" value="" placeholder="0" min="0" oninput="v41ValidatePayroll(\'' + eid + '\')"></div>' +
                '<div class="v41-field"><label>หักประกันสังคม</label><input id="v41-ss-' + eid + '" type="number" value="" placeholder="0" min="0" oninput="v41ValidatePayroll(\'' + eid + '\')"></div>' +
                '<div class="v41-field"><label>หักอื่น ๆ</label><input id="v41-other-' + eid + '" type="number" value="" placeholder="0" min="0" oninput="v41ValidatePayroll(\'' + eid + '\')"></div>' +
                '<div class="v41-field"><label>วิธีจ่าย</label><select id="v41-method-' + eid + '"><option value="เงินสด">เงินสด</option><option value="โอนเงิน">โอนเงิน</option></select></div>' +
                '<div class="v41-field"><label>หมายเหตุ</label><input id="v41-note-' + eid + '" type="text" placeholder="ถ้ามี"></div>' +
              '</div>' +
              '<div id="v41-msg-' + eid + '" class="v41-calc"></div>' +
              '<button class="v41-save-btn" id="v41-save-' + eid + '" onclick="v41SavePayroll(\'' + eid + '\')"><i class="material-icons-round">payments</i> ยืนยันจ่ายเงินเดือน</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    Swal.fire({ html: html, width: 900, showConfirmButton: false, showCloseButton: true, customClass: { popup: 'v41-swal-popup' }, didOpen: function () { v41ValidatePayroll(eid); } });
  };

  window.v41SavePayroll = async function (eid) {
    var r = (window._v41Payroll && window._v41Payroll.rows || []).find(function (x) { return String(x.emp.id) === String(eid); });
    if (!r || !v41ValidatePayroll(eid)) return;
    var recv = num(document.getElementById('v41-recv-' + eid).value);
    var debt = num(document.getElementById('v41-debt-' + eid).value);
    var ss = num(document.getElementById('v41-ss-' + eid).value);
    var other = num(document.getElementById('v41-other-' + eid).value);
    var method = document.getElementById('v41-method-' + eid).value;
    var note = document.getElementById('v41-note-' + eid).value || '';
    var ok = await Swal.fire({
      title: 'ยืนยันจ่ายเงินเดือน',
      html: '<b>' + fullName(r.emp) + '</b><br>รับจริง ฿' + money(recv) + '<br>รวมหัก ฿' + money(debt + ss + other),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    });
    if (!ok.isConfirmed) return;
    if (method === 'เงินสด' && recv > 0 && typeof assertCashEnough === 'function') {
      try { await assertCashEnough(recv, 'จ่ายเงินเดือน'); } catch (e) { Swal.fire({ icon: 'error', title: 'เงินสดไม่พอ', text: e.message }); return; }
    }
    var noteText = ['จ่ายทาง ' + method, note].filter(Boolean).join(' | ');
    if (ss) noteText += ' | หักประกันสังคม ฿' + ss;
    if (other) noteText += ' | หักอื่น ๆ ฿' + other;
    var res = await db.from('จ่ายเงินเดือน').insert({
      employee_id: eid,
      month: window._v41Payroll.range.start,
      working_days: r.workDays,
      base_salary: r.gross,
      deduct_withdraw: debt,
      deduct_absent: r.absentDeduct,
      bonus: 0,
      net_paid: recv,
      paid_date: new Date().toISOString(),
      staff_name: (window.USER && USER.username) || '',
      note: noteText
    }).select().single();
    if (res.error) { Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: res.error.message }); return; }
    if (debt > 0) {
      try {
        var advRes = await db.from('เบิกเงิน').select('*').eq('employee_id', eid).eq('status', 'อนุมัติ').order('date', { ascending: true });
        var remainingDebt = debt;
        for (var i = 0; i < (advRes.data || []).length; i++) {
          var adv = advRes.data[i];
          var advAmount = num(adv.amount);
          if (remainingDebt <= 0) break;
          if (advAmount <= remainingDebt) {
            await db.from('เบิกเงิน').update({ status: 'ชำระแล้ว' }).eq('id', adv.id);
            remainingDebt -= advAmount;
          } else {
            await db.from('เบิกเงิน').update({ amount: advAmount - remainingDebt }).eq('id', adv.id);
            remainingDebt = 0;
          }
        }
      } catch (e) {
        console.warn('[v41-payroll] update advance debt:', e);
      }
    }
    await Swal.fire({ icon: 'success', title: 'บันทึกเงินเดือนแล้ว', timer: 1200, showConfirmButton: false });
    renderPayrollV26();
  };

  installHotfixOverride(false);
  scheduleHotfixOverride();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleHotfixOverride);
  } else {
    scheduleHotfixOverride();
  }
})();
