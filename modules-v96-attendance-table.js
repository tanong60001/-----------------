/* ════════════════════════════════════════════════════════════════════
   modules-v96-attendance-table.js
   ─────────────────────────────────────────────────────────────────────
   ยกเครื่องหน้า "เช็คชื่อ" ให้เป็นตารางรายเดือนสไตล์เดียวกับหน้าจ่ายเงินเดือน
   • แต่ละคน 1 แถวยาว · คอลัมน์ = วันที่ 1..สิ้นเดือน · พอดีจอ ไม่ต้องเลื่อน
   • คลิกช่องวัน → ป็อปอัพเลือกสถานะ → ถัดไปเลือกสถานที่ทำงาน (หน้าร้าน/โครงการ)
   • ดูย้อนหลังได้ (◀ ▶) — แก้วันย้อนหลังได้เฉพาะแอดมิน, พนักงานกดจะขึ้นบล็อก
   • ท้ายแถวมีปุ่ม "ลบ" (เปลี่ยนสถานะออก) และ "เบิกเงิน"

   ใช้คลาส/สไตล์ตารางร่วมกับ v95 (.v95-tbl ฯลฯ) เพื่อความสม่ำเสมอ
   เขียนลง schema เดิม: พนักงาน / เช็คชื่อ / โครงการ / รายจ่ายโครงการ
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const EMP_TABLE = 'พนักงาน';
  const ATT_TABLE = 'เช็คชื่อ';
  const PROJECT_TABLE = 'โครงการ';
  const PROJECT_EXPENSE_TABLE = 'รายจ่ายโครงการ';
  const ASSIGN_PREFIX = '[สถานที่ทำงาน:';
  const ATT_REF_PREFIX = 'attendance:';

  // สถานะ + สัญลักษณ์ + สี + ข้อมูลการหัก
  const ST = {
    'มา': { s: '✓', c: '#16a34a', label: 'มาทำงาน', info: 'เต็มวัน' },
    'มาสาย': { s: '▲', c: '#d97706', label: 'มาสาย', info: 'หัก 5%' },
    'ครึ่งวัน': { s: '◐', c: '#0891b2', label: 'มาครึ่งวัน', info: 'หัก 50%' },
    'ลา': { s: '○', c: '#7c3aed', label: 'ลา', info: 'ไม่หัก' },
    'ขาด': { s: '✗', c: '#dc2626', label: 'ขาด', info: 'หัก 100%' },
  };

  function num(v) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function money(v) { return (typeof window.formatNum === 'function') ? window.formatNum(v) : num(v).toLocaleString('th-TH'); }
  // เซลล์วันในตาราง Excel: หลักพันโชว์เต็ม (1500) · หลักหมื่นขึ้นไปย่อเป็น k (12k)
  function xlAdv(v) { const n = Math.round(num(v)); return n < 10000 ? String(n) : Math.round(n / 1000) + 'k'; }
  function notify(m, t) { if (typeof toast === 'function') toast(m, t || 'info'); }
  function staff() { try { return (typeof USER !== 'undefined' && USER) ? USER.username : 'system'; } catch (_) { return 'system'; } }
  function isAdmin() { return !!(typeof USER !== 'undefined' && USER && USER.role === 'admin'); }
  function nowTime() { return new Date().toTimeString().slice(0, 5); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function keyOf(y, mo, d) { return `${y}-${pad(mo + 1)}-${pad(d)}`; }
  function isWorking(st) { return st && st !== 'ขาด' && st !== 'ลา'; }
  function normSt(st) { return st === 'มาครึ่งวัน' ? 'ครึ่งวัน' : st; } // รวมข้อมูลเก่า
  // อ่านสถานที่ทำงานจากโน้ต: [สถานที่ทำงาน:หน้าร้าน] หรือ [สถานที่ทำงาน:โครงการ:ชื่อ]
  function parseWorkplace(note) {
    const m = String(note || '').match(/\[สถานที่ทำงาน:([^\]]+)\]/);
    if (!m) return '';
    const v = m[1].trim();
    if (v.startsWith('โครงการ:')) return '🏗️ โครงการ ' + v.slice('โครงการ:'.length).trim();
    return '🏪 ' + v;
  }
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  let v96View = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  function isCurrentMonth(d) { const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); }

  // ──────────────────────────────────────
  // CSS เฉพาะ v96 (ตารางใช้คลาส .v95-* ร่วม)
  // ──────────────────────────────────────
  (function injectCSS() {
    if (document.getElementById('v96-css')) return;
    const s = document.createElement('style');
    s.id = 'v96-css';
    s.textContent = `
      /* แก้กฎเก่า (v10/v11) ที่บังคับ #page-att>div>div:first-child เป็น flex/scroll
         ซึ่งไปโดน div ห่อเนื้อหาใน #att-body ทำให้เลย์เอาต์เพี้ยนเป็นคอลัมน์ */
      #page-att #att-body{display:block!important;width:100%!important;overflow:visible!important;}
      #page-att #att-body > div:first-child{display:block!important;overflow:visible!important;max-width:100%!important;}
      /* แถบ 3 หน้า */
      .v96-tabbar{display:flex;gap:8px;background:#f1f5f9;border-radius:14px;padding:6px;margin:0 8px 16px;flex-wrap:wrap;}
      .v96-tab{flex:1;min-width:120px;border:none;background:transparent;color:#64748b;font-weight:800;font-size:15px;padding:12px 10px;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:.15s;font-family:inherit;}
      .v96-tab i{font-size:20px;}
      .v96-tab:hover{color:#334155;background:#e2e8f0;}
      .v96-tab.on{background:#fff;color:#1e293b;box-shadow:0 3px 10px rgba(15,23,42,.1);}
      .v96-day-cell{cursor:pointer;transition:background .12s;}
      .v96-day-cell:hover{background:#eff6ff!important;}
      .v96-day-cell.today{background:#fffbeb;box-shadow:inset 0 0 0 2px #fcd34d;}
      .v96-day-cell{line-height:1.05;}
      .v96-day-cell .sym{font-size:13px;font-weight:900;}
      /* tooltip สถานที่ทำงาน (hover) */
      #v96-tip{position:fixed;z-index:100000;transform:translate(-50%,-100%);background:#0f172a;color:#fff;padding:8px 12px;border-radius:10px;font-size:12px;line-height:1.3;text-align:center;white-space:nowrap;box-shadow:0 10px 28px rgba(15,23,42,.3);pointer-events:none;display:none;}
      #v96-tip::after{content:'';position:absolute;left:50%;top:100%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#0f172a;}
      /* ── การ์ดมือถือ (เช็คชื่อ) ── */
      .v96-mcard{background:#fff;border:1px solid #eef2f7;border-radius:16px;padding:12px 13px;margin-bottom:10px;box-shadow:0 2px 10px rgba(15,23,42,.05);}
      .v96-mc-head{display:flex;align-items:center;gap:11px;}
      .v96-mc-av{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);color:#1d4ed8;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;flex:0 0 auto;}
      .v96-mc-name{font-weight:900;color:#1e293b;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .v96-mc-sub{font-size:11px;color:#94a3b8;font-weight:700;}
      .v96-mc-wd{font-size:20px;font-weight:900;color:#16a34a;line-height:1;}
      .v96-mc-btns{display:flex;gap:6px;flex:0 0 auto;}
      .v96-mc-act{flex:0 0 auto;width:40px;height:40px;border:none;border-radius:11px;background:#eff6ff;color:#2563eb;cursor:pointer;display:flex;align-items:center;justify-content:center;}
      .v96-mc-act i{font-size:20px;}
      .v96-mc-act.adv{background:#fff7ed;color:#d97706;}
      .v96-mc-act:active{transform:scale(.92);}
      .v96-mc-debt{margin-top:8px;font-size:12px;font-weight:800;color:#c2410c;background:#fff7ed;border-radius:8px;padding:5px 10px;text-align:center;}
      .v96-mdots{display:grid;grid-template-columns:repeat(15,1fr);gap:4px;margin-top:10px;}
      .v96-mdot{position:relative;aspect-ratio:1/1;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
      .v96-mdot b{font-size:10px;font-weight:800;color:rgba(255,255,255,.95);}
      .v96-mdot[style*="e8edf3"] b{color:#a3aec0;}
      .v96-mdot.today{box-shadow:0 0 0 2px #f59e0b;}
      .v96-dotadv{position:absolute;bottom:1px;right:1px;width:5px;height:5px;border-radius:50%;background:#c2410c;border:1px solid #fff;}
      .v96-locked{opacity:.55;}
      .v96-act{width:118px;padding:6px 6px;border-left:1px solid #f1f5f9;}
      .v96-act .row{display:flex;gap:5px;justify-content:center;}
      .v96-mini{border:none;border-radius:8px;padding:7px 9px;font-weight:800;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:3px;font-family:inherit;}
      .v96-mini.adv{background:#fff7ed;color:#c2410c;}
      .v96-mini.adv:hover{background:#ffedd5;}
      .v96-mini.del{background:#fef2f2;color:#dc2626;}
      .v96-mini.del:hover{background:#fee2e2;}
      /* ป็อปอัพเลือกสถานะ */
      .v96-st-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:6px;}
      .v96-st-opt{border:2px solid #eef2f7;border-radius:16px;padding:13px 6px;cursor:pointer;text-align:center;transition:.15s;background:#fff;}
      .v96-st-opt:hover{border-color:#cbd5e1;transform:translateY(-1px);}
      .v96-st-opt.on{border-color:var(--oc);background:var(--oc);box-shadow:0 8px 18px rgba(0,0,0,.16);transform:translateY(-2px);}
      .v96-st-sym{font-size:25px;font-weight:900;color:var(--oc);line-height:1;}
      .v96-st-label{font-weight:900;color:#1e293b;font-size:13px;margin-top:5px;}
      .v96-st-info{font-size:10.5px;color:#94a3b8;font-weight:700;margin-top:1px;}
      .v96-st-opt.on .v96-st-sym,.v96-st-opt.on .v96-st-label,.v96-st-opt.on .v96-st-info{color:#fff;}
      .v96-wp-seg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;}
      .v96-wp-btn{border:2px solid #e2e8f0;border-radius:14px;padding:16px 10px;cursor:pointer;font-weight:900;color:#475569;background:#fff;display:flex;flex-direction:column;align-items:center;gap:6px;transition:.15s;}
      .v96-wp-btn.on{border-color:#0f172a;background:#0f172a;color:#fff;}
      .v96-wp-btn i{font-size:26px;}
      /* ปฏิทินรายคน (ป็อปอัพ) — โปรเฟสชันแนล */
      .v96-emp-card{border-radius:18px;overflow:hidden;border:1px solid #e8edf3;box-shadow:0 12px 40px rgba(15,23,42,.12);}
      .v96-emp-head{background:linear-gradient(135deg,#1e293b 0%,#334155 60%,#475569 100%);padding:20px 18px 18px;color:#fff;text-align:center;position:relative;}
      .v96-emp-av{width:60px;height:60px;border-radius:18px;background:rgba(255,255,255,.16);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#fff;margin:0 auto 10px;border:1px solid rgba(255,255,255,.25);}
      .v96-emp-name{font-size:19px;font-weight:900;letter-spacing:.2px;}
      .v96-emp-sub{font-size:12.5px;color:#cbd5e1;font-weight:600;margin-top:3px;}
      .v96-emp-chips{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap;}
      .v96-emp-chip{background:rgba(255,255,255,.14);border-radius:999px;padding:5px 13px;font-size:12px;font-weight:800;}
      .v96-emp-body{background:#fff;padding:16px;}
      .v96-cal-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:6px;}
      .v96-cal-dow span{font-size:11px;font-weight:800;color:#94a3b8;text-align:center;}
      .v96-cal-dow span.we{color:#f87171;}
      .v96-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;}
      .v96-cal-empty{aspect-ratio:1/1;}
      .v96-cal-day{aspect-ratio:1/1;border-radius:11px;background:#f8fafc;display:flex;align-items:center;justify-content:center;position:relative;transition:.12s;}
      .v96-cal-day .d{position:absolute;top:4px;left:6px;font-size:9px;font-weight:800;color:#94a3b8;}
      .v96-cal-day.we .d{color:#fca5a5;}
      .v96-cal-day .s{font-size:17px;font-weight:900;line-height:1;}
      .v96-cal-day .a{position:absolute;bottom:3px;left:0;right:0;text-align:center;font-size:8px;font-weight:800;color:#c2410c;}
      .v96-cal-day.today{outline:2px solid #f59e0b;outline-offset:-2px;}
      .v96-cal-legend{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9;}
      .v96-cal-legend span{font-size:11px;font-weight:800;display:inline-flex;align-items:center;gap:3px;}
      @media print{
        body *{visibility:hidden;}
        #v96-grid, #v96-grid *{visibility:visible;}
        #v96-grid{position:absolute;left:0;top:0;width:100%;}
        .v96-act{display:none;}
        .v95-table-wrap{overflow:visible!important;box-shadow:none;border:none;}
        table.v95-tbl{font-size:10px;width:100%;}
        @page{size:landscape;margin:8mm;}
      }
    `;
    document.head.appendChild(s);
  })();

  // ──────────────────────────────────────
  // โหลดข้อมูลเดือนที่ดู
  // ──────────────────────────────────────
  async function loadMonth() {
    const y = v96View.getFullYear(), mo = v96View.getMonth();
    const ms = keyOf(y, mo, 1), me = keyOf(y, mo, new Date(y, mo + 1, 0).getDate());
    const emps = (await loadEmployees()).filter(e => e.status === 'ทำงาน');
    const [attR, advR] = await Promise.all([
      db.from(ATT_TABLE).select('*').gte('date', ms).lte('date', me),
      db.from('เบิกเงิน').select('employee_id,amount,date,reason').gte('date', ms + 'T00:00:00').lte('date', me + 'T23:59:59'),
    ]);
    const map = {};    // empId -> { day -> row }
    (attR.data || []).forEach(a => {
      const d = parseInt(String(a.date).slice(8, 10), 10);
      (map[String(a.employee_id)] = map[String(a.employee_id)] || {})[d] = a;
    });
    const advMap = {}; // empId -> { day -> sumAmount } (ไม่รวมหนี้ยกมา — ตรงกับตาราง)
    const advTotal = {}; // empId -> total
    const advRows = {}; // empId -> [ {date, amount, reason} ] (ทุกรายการ ไว้โชว์ในปฏิทินรายคน)
    (advR.data || []).forEach(a => {
      const eid = String(a.employee_id);
      (advRows[eid] = advRows[eid] || []).push(a);
      if (/ยกมา/.test(String(a.reason || ''))) return; // ข้ามหนี้เดิมยกมา (ไม่ใช่เบิกรายวัน)
      const d = parseInt(String(a.date).slice(8, 10), 10);
      const m = (advMap[eid] = advMap[eid] || {});
      m[d] = (m[d] || 0) + num(a.amount);
      advTotal[eid] = (advTotal[eid] || 0) + num(a.amount);
    });
    return { emps, map, advMap, advTotal, advRows, y, mo, daysInMonth: new Date(y, mo + 1, 0).getDate() };
  }

  // ──────────────────────────────────────
  // RENDER ตารางเช็คชื่อ
  // ──────────────────────────────────────
  async function renderAttendanceTable() {
    const sec = document.getElementById('att-body') || document.getElementById('page-att');
    if (!sec) return;
    sec.innerHTML = '<div style="padding:48px;text-align:center;color:#64748b;font-weight:800">กำลังโหลดตารางเช็คชื่อ...</div>';

    let data;
    try { data = await loadMonth(); }
    catch (e) { notify('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error'); return; }
    window._v96 = data;

    const { emps, map, advMap, advTotal, y, mo, daysInMonth } = data;
    const ml = v96View.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    const today = new Date();
    const todayDay = isCurrentMonth(v96View) ? today.getDate() : -1;
    const canBack = isAdmin();

    // สรุปวันนี้
    const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());
    const cnt = { 'มา': 0, 'มาสาย': 0, 'ครึ่งวัน': 0, 'ลา': 0, 'ขาด': 0 };
    let unmarked = 0;
    if (isCurrentMonth(v96View)) {
      emps.forEach(e => {
        const r = (map[String(e.id)] || {})[today.getDate()];
        const rs = r ? normSt(r.status) : null;
        if (rs && cnt[rs] !== undefined) cnt[rs]++; else if (!r) unmarked++;
      });
    }

    // หัวคอลัมน์รายวัน
    let dayHead = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const wkd = new Date(y, mo, d).getDay();
      const wk = (wkd === 0 || wkd === 6) ? ' v95-wk' : '';
      const tdc = (d === todayDay) ? ' style="color:#b45309;font-weight:900;"' : '';
      dayHead += `<th class="v95-day${wk}"${tdc}>${d}</th>`;
    }

    sec.innerHTML = `
      <div style="max-width:100%;margin:0 auto;padding:0 8px 40px;">
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:18px;padding:18px 22px;color:#fff;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
            <div>
              <h2 style="margin:0;display:flex;align-items:center;gap:8px;font-size:22px;"><i class="material-icons-round">how_to_reg</i> เช็คชื่อพนักงาน</h2>
              <div style="opacity:.8;font-weight:600;font-size:13px;margin-top:2px;">วันนี้ ${today.toLocaleDateString('th-TH', { dateStyle: 'long' })} · ยังไม่ลง <span id="v96-unmarked">${unmarked}</span> คน</div>
            </div>
            <div id="v96-stats" style="display:flex;gap:8px;flex-wrap:wrap;">
              ${v96StatsPillsHTML(cnt)}
            </div>
          </div>
        </div>

        <div class="v95-toolbar">
          <div class="v95-month-nav">
            <button onclick="window.v96ShiftMonth(-1)" ${canBack ? '' : 'disabled title="ย้อนหลังเฉพาะแอดมิน"'}>‹</button>
            <span class="lbl">${ml}</span>
            <button onclick="window.v96ShiftMonth(1)" ${isCurrentMonth(v96View) ? 'disabled' : ''}>›</button>
          </div>
          <div class="v95-search">
            <i class="material-icons-round">search</i>
            <input type="text" id="v96-search-in" placeholder="ค้นหาชื่อพนักงาน..." oninput="window.v96FilterRows(this.value)">
          </div>
          <button class="v95-tool-btn xls" onclick="window.v96ExcelReport()"><i class="material-icons-round" style="font-size:18px;">grid_on</i> Excel</button>
          <button class="v95-tool-btn" style="background:#e2e8f0;color:#334155;" onclick="showEmployeeModal()"><i class="material-icons-round" style="font-size:18px;">person_add</i> เพิ่มพนักงาน</button>
          ${!canBack ? `<span class="v95-admin-note">แก้วันย้อนหลังได้เฉพาะแอดมิน</span>` : ''}
        </div>

        <div id="v96-grid">
          ${isMobile() ? `
            <div id="v96-tbody">${emps.map(e => attMobileCard(e, map[String(e.id)] || {}, advMap[String(e.id)] || {}, advTotal[String(e.id)] || 0, y, mo, daysInMonth, todayDay)).join('')}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:8px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
              ${Object.entries(ST).map(([k, v]) => `<span style="color:${v.c};font-weight:800;">${v.s} ${v.label}</span>`).join('')}
            </div>` : `
          <div class="v95-table-wrap">
            <table class="v95-tbl">
              <thead>
                <tr>
                  <th class="v95-name">พนักงาน</th>
                  ${dayHead}
                  <th class="v95-sum">มา</th>
                  <th class="v95-sum">เบิก</th>
                  <th class="v96-act">จัดการ</th>
                </tr>
              </thead>
              <tbody id="v96-tbody">
                ${emps.map(e => attRow(e, map[String(e.id)] || {}, advMap[String(e.id)] || {}, advTotal[String(e.id)] || 0, y, mo, daysInMonth, todayDay)).join('')}
              </tbody>
            </table>
          </div>
          <div style="font-size:12px;color:#94a3b8;margin-top:10px;display:flex;gap:14px;flex-wrap:wrap;">
            ${Object.entries(ST).map(([k, v]) => `<span style="color:${v.c};font-weight:800;">${v.s} ${v.label}</span>`).join('')}
            <span style="margin-left:auto;">แตะช่องวันเพื่อลงเวลา · ชี้เมาส์ค้างเพื่อดูสถานที่ทำงาน</span>
          </div>`}
        </div>
      </div>`;
    if (!isMobile()) bindCellTips();
  }

  function isMobile() { return window.innerWidth <= 768; }

  // ── การ์ดเช็คชื่อสำหรับมือถือ: 1 คน/การ์ด · 30 วันเป็นจุดสีแถวเดียว (ไม่เลื่อนซ้ายขวา) ──
  function attMobileCard(emp, days, dayAdv, advTotal, y, mo, daysInMonth, todayDay) {
    let workDays = 0;
    let dots = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const r = days[d];
      const st = r ? normSt(r.status) : null;
      if (st && isWorking(st)) workDays++;
      const col = st && ST[st] ? ST[st].c : '#e8edf3';
      const adv = dayAdv[d] ? '<span class="v96-dotadv"></span>' : '';
      const today = d === todayDay ? ' today' : '';
      dots += `<span id="v96c-${emp.id}-${d}" class="v96-mdot${today}" style="background:${col};" onclick="window.v96EditCell('${emp.id}',${d})"><b>${d}</b>${adv}</span>`;
    }
    const safeName = `${emp.name} ${emp.lastname || ''}`.trim();
    return `
      <div class="v96-mcard" data-name="${safeName.toLowerCase()}">
        <div class="v96-mc-head">
          <div class="v96-mc-av" style="cursor:pointer;" onclick="window.v96ShowEmpDetail('${emp.id}')">${(emp.name || '?')[0]}</div>
          <div style="flex:1;min-width:0;cursor:pointer;" onclick="window.v96ShowEmpDetail('${emp.id}')">
            <div class="v96-mc-name">${safeName} <i class="material-icons-round" style="font-size:13px;color:#cbd5e1;vertical-align:middle;">calendar_month</i></div>
            <div class="v96-mc-sub">${emp.position || 'พนักงาน'} · ฿${money(emp.daily_wage || 0)}/วัน</div>
          </div>
          <div style="text-align:right;">
            <div class="v96-mc-wd" id="v96-wd-${emp.id}">${workDays}</div>
            <div style="font-size:10px;color:#94a3b8;font-weight:700;">มา (วัน)</div>
          </div>
          <div class="v96-mc-btns">
            <button class="v96-mc-act adv" onclick="event.stopPropagation();window.openAdvanceWizard('${emp.id}','${safeName.replace(/'/g, "\\'")}')" title="เบิกเงิน"><i class="material-icons-round">payments</i></button>
            <button class="v96-mc-act" onclick="event.stopPropagation();window.v96EditCell('${emp.id}',${todayDay > 0 ? todayDay : 1})" title="ลงวันนี้"><i class="material-icons-round">edit_calendar</i></button>
          </div>
        </div>
        ${(advTotal > 0) ? `<div class="v96-mc-debt">เบิกเดือนนี้รวม ฿${money(advTotal)}</div>` : ''}
        <div class="v96-mdots">${dots}</div>
      </div>`;
  }

  // tooltip แสดงสถานที่ทำงานเมื่อชี้เมาส์ค้าง (ไม่ต้องคลิก)
  function bindCellTips() {
    const body = document.getElementById('v96-tbody');
    if (!body || body.dataset.tipBound) return;
    body.dataset.tipBound = '1';
    const tipEl = () => {
      let t = document.getElementById('v96-tip');
      if (!t) { t = document.createElement('div'); t.id = 'v96-tip'; document.body.appendChild(t); }
      return t;
    };
    body.addEventListener('mouseover', (e) => {
      const cell = e.target.closest && e.target.closest('.v96-day-cell[data-tip]');
      if (!cell) return;
      const t = tipEl();
      t.innerHTML = cell.getAttribute('data-tip');
      t.style.display = 'block';
      const r = cell.getBoundingClientRect();
      t.style.left = (r.left + r.width / 2) + 'px';
      t.style.top = (r.top - 6) + 'px';
    });
    body.addEventListener('mouseout', (e) => {
      const cell = e.target.closest && e.target.closest('.v96-day-cell[data-tip]');
      if (!cell) return;
      const t = document.getElementById('v96-tip');
      if (t) t.style.display = 'none';
    });
  }

  // ── เนื้อในเซลล์วัน (สัญลักษณ์ + ยอดเบิก) ใช้ร่วมตอน render + อัปเดตเฉพาะจุด ──
  function v96CellInner(st, advAmt) {
    const meta = st && ST[st] ? ST[st] : null;
    const sym = meta ? `<span class="sym" style="color:${meta.c};">${meta.s}</span>` : `<span class="sym" style="color:#cbd5e1;">·</span>`;
    const adv = advAmt ? `<span class="adv" title="เบิก ฿${money(advAmt)}">${money(advAmt)}</span>` : '';
    return sym + adv;
  }
  function v96CellTip(st, note, advAmt) {
    if (!st) return '';
    const meta = ST[st];
    const wp = parseWorkplace(note);
    return `<div style="font-weight:800;">${meta ? meta.label : st}</div>`
      + (wp ? `<div style="opacity:.9;font-size:11px;margin-top:2px;">${wp}</div>` : (isWorking(st) ? `<div style="opacity:.7;font-size:11px;margin-top:2px;">ไม่ได้ระบุสถานที่</div>` : ''))
      + (advAmt ? `<div style="color:#fdba74;font-size:11px;margin-top:2px;">เบิก ฿${money(advAmt)}</div>` : '');
  }
  // ── สถิติหัวตาราง (วันนี้) ──
  function v96StatsPillsHTML(cnt) {
    return Object.entries(ST).map(([k, v]) => `<div style="background:rgba(255,255,255,.1);border-radius:10px;padding:7px 12px;text-align:center;"><div style="font-size:11px;opacity:.85;">${v.s} ${v.label}</div><div style="font-size:18px;font-weight:900;color:${v.c === '#dc2626' ? '#fca5a5' : '#fff'};">${cnt[k] || 0}</div></div>`).join('');
  }
  window.v96RefreshStats = function () {
    const d = window._v96;
    if (!d || !isCurrentMonth(v96View)) return;
    const today = new Date().getDate();
    const cnt = { 'มา': 0, 'มาสาย': 0, 'ครึ่งวัน': 0, 'ลา': 0, 'ขาด': 0 }; let unmarked = 0;
    d.emps.forEach(e => { const r = (d.map[String(e.id)] || {})[today]; const rs = r ? normSt(r.status) : null; if (rs && cnt[rs] !== undefined) cnt[rs]++; else if (!r) unmarked++; });
    const el = document.getElementById('v96-stats'); if (el) el.innerHTML = v96StatsPillsHTML(cnt);
    const um = document.getElementById('v96-unmarked'); if (um) um.textContent = unmarked;
  };
  // ── อัปเดตเฉพาะช่อง + เลข "มา" (ไม่รีโหลดทั้งหน้า) ──
  function v96UpdateCell(empId, day) {
    const d = window._v96; if (!d) return;
    const r = (d.map[String(empId)] || {})[day] || null;
    const st = r ? normSt(r.status) : null;
    const advAmt = (d.advMap[String(empId)] || {})[day] || 0;
    const cell = document.getElementById(`v96c-${empId}-${day}`);
    if (cell) {
      if (cell.classList.contains('v96-mdot')) {
        // มือถือ: จุดสี
        cell.style.background = st && ST[st] ? ST[st].c : '#e8edf3';
        cell.title = st && ST[st] ? ST[st].label : '';
        cell.innerHTML = `<b>${day}</b>` + (advAmt ? '<span class="v96-dotadv"></span>' : '');
      } else {
        cell.innerHTML = v96CellInner(st, advAmt);
        const tip = v96CellTip(st, r ? r.note : '', advAmt);
        if (tip) cell.setAttribute('data-tip', tip); else cell.removeAttribute('data-tip');
      }
    }
    const days = d.map[String(empId)] || {};
    let wd = 0; Object.keys(days).forEach(k => { if (isWorking(normSt(days[k].status))) wd++; });
    const wdCell = document.getElementById(`v96-wd-${empId}`);
    if (wdCell) wdCell.textContent = wd;
    window.v96RefreshStats();
  }

  function attRow(emp, days, dayAdv, advTotal, y, mo, daysInMonth, todayDay) {
    let workDays = 0;
    let cells = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const r = days[d];
      const st = r ? normSt(r.status) : null;
      if (st && isWorking(st)) workDays++;
      const wkd = new Date(y, mo, d).getDay();
      const wk = (wkd === 0 || wkd === 6) ? ' wk' : '';
      const td = (d === todayDay) ? ' today' : '';
      const tip = v96CellTip(st, r ? r.note : '', dayAdv[d]);
      const tipAttr = tip ? ` data-tip="${tip.replace(/"/g, '&quot;')}"` : '';
      cells += `<td id="v96c-${emp.id}-${d}" class="v95-day v96-day-cell${wk}${td}"${tipAttr} onclick="window.v96EditCell('${emp.id}',${d})">${v96CellInner(st, dayAdv[d])}</td>`;
    }
    const safeName = `${emp.name} ${emp.lastname || ''}`.trim();
    return `
      <tr data-name="${safeName.toLowerCase()}">
        <td class="v95-name" style="cursor:pointer;" onclick="window.v96ShowEmpDetail('${emp.id}')" title="ดูปฏิทิน + รายการเบิก">
          <div class="v95-nm-top">${safeName} <i class="material-icons-round" style="font-size:13px;color:#cbd5e1;vertical-align:middle;">calendar_month</i></div>
          <div class="v95-nm-sub">${emp.position || 'พนักงาน'} · ฿${money(emp.daily_wage || 0)}/วัน</div>
        </td>
        ${cells}
        <td class="v95-sum" id="v96-wd-${emp.id}" style="color:#16a34a;">${workDays}</td>
        <td class="v95-sum" style="color:#c2410c;">${advTotal ? '฿' + money(advTotal) : '-'}</td>
        <td class="v96-act">
          <div class="row">
            <button class="v96-mini adv" onclick="event.stopPropagation();openAdvanceWizard('${emp.id}','${safeName.replace(/'/g, "\\'")}')"><i class="material-icons-round" style="font-size:14px;">payments</i>เบิก</button>
            <button class="v96-mini del" onclick="event.stopPropagation();window.v96DeleteEmp('${emp.id}','${safeName.replace(/'/g, "\\'")}')"><i class="material-icons-round" style="font-size:14px;">delete</i>ลบ</button>
          </div>
        </td>
      </tr>`;
  }

  // ──────────────────────────────────────
  // ปฏิทินรายคน + รายการเบิก (แตะพนักงาน) — ใช้ได้ทั้งมือถือ/คอม
  // ──────────────────────────────────────
  window.v96ShowEmpDetail = function (empId) {
    const data = window._v96;
    if (!data || typeof Swal === 'undefined') return;
    const emp = data.emps.find(e => String(e.id) === String(empId));
    if (!emp) return;
    const { y, mo, daysInMonth } = data;
    const days = data.map[String(empId)] || {};
    const dayAdv = data.advMap[String(empId)] || {};
    const ml = new Date(y, mo, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    const todayD = isCurrentMonth(v96View) ? new Date().getDate() : -1;

    // นับสถานะ (ไว้ทำชิป)
    const cnt = { 'มา': 0, 'มาสาย': 0, 'ครึ่งวัน': 0, 'ลา': 0, 'ขาด': 0 };
    for (let d = 1; d <= daysInMonth; d++) { const s = days[d] ? normSt(days[d].status) : null; if (s && cnt[s] !== undefined) cnt[s]++; }
    const workDays = cnt['มา'] + cnt['มาสาย'] + cnt['ครึ่งวัน'];

    // ปฏิทิน 7 คอลัมน์
    const firstDow = new Date(y, mo, 1).getDay();
    let cal = '';
    for (let i = 0; i < firstDow; i++) cal += '<div class="v96-cal-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const st = days[d] ? normSt(days[d].status) : null;
      const meta = st && ST[st] ? ST[st] : null;
      const adv = dayAdv[d];
      const dow = new Date(y, mo, d).getDay();
      const we = (dow === 0 || dow === 6) ? ' we' : '';
      const td = (d === todayD) ? ' today' : '';
      cal += `<div class="v96-cal-day${we}${td}" style="${meta ? `background:${meta.c}1A;` : ''}">
        <div class="d">${d}</div>
        ${meta ? `<div class="s" style="color:${meta.c}">${meta.s}</div>` : ''}
        ${adv ? `<div class="a">${money(adv)}</div>` : ''}
      </div>`;
    }

    Swal.fire({
      width: 430,
      padding: 0,
      background: 'transparent',
      showConfirmButton: true,
      confirmButtonText: 'ปิด',
      confirmButtonColor: '#64748b',
      html: `
        <div class="v96-emp-card">
          <div class="v96-emp-head">
            <div class="v96-emp-av">${(emp.name || '?')[0]}</div>
            <div class="v96-emp-name">${emp.name} ${emp.lastname || ''}</div>
            <div class="v96-emp-sub">${emp.position || 'พนักงาน'} · ${ml}</div>
            <div class="v96-emp-chips">
              <span class="v96-emp-chip">มา ${workDays} วัน</span>
              ${cnt['ลา'] > 0 ? `<span class="v96-emp-chip">ลา ${cnt['ลา']}</span>` : ''}
              ${cnt['ขาด'] > 0 ? `<span class="v96-emp-chip">ขาด ${cnt['ขาด']}</span>` : ''}
            </div>
          </div>
          <div class="v96-emp-body">
            <div class="v96-cal-dow"><span class="we">อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span class="we">ส</span></div>
            <div class="v96-cal">${cal}</div>
            <div class="v96-cal-legend">
              ${Object.entries(ST).map(([k, v]) => `<span style="color:${v.c};">${v.s} ${v.label}</span>`).join('')}
            </div>
          </div>
        </div>`,
    });
  };

  // ──────────────────────────────────────
  // เครื่องมือ: เดือน / ค้นหา / ลบ
  // ──────────────────────────────────────
  window.v96ShiftMonth = function (delta) {
    const target = new Date(v96View.getFullYear(), v96View.getMonth() + delta, 1);
    const cur = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    if (target > cur) return;
    if (target < cur && !isAdmin()) { notify('ดูย้อนหลังได้เฉพาะแอดมิน', 'warning'); return; }
    v96View = target;
    renderAttendanceTable();
  };

  window.v96FilterRows = function (q) {
    const term = String(q || '').trim().toLowerCase();
    document.querySelectorAll('#v96-tbody tr, #v96-tbody .v96-mcard').forEach(tr => {
      const name = tr.getAttribute('data-name') || '';
      tr.style.display = (!term || name.includes(term)) ? '' : 'none';
    });
  };

  window.v96DeleteEmp = function (empId, name) {
    if (typeof window.v9DeleteEmployee === 'function') return window.v9DeleteEmployee(empId, name);
    if (typeof window.v35DeleteEmployee === 'function') return window.v35DeleteEmployee(empId, name);
    notify('ฟังก์ชันลบพนักงานยังไม่พร้อม', 'error');
  };

  // ──────────────────────────────────────
  // ส่งออก Excel: ตารางเช็คชื่อหน้านี้
  // ──────────────────────────────────────
  function xlSt(st) {
    switch (normSt(st)) {
      case 'มา': return { sym: '✓', fill: 'FFD1FAE5', text: 'FF047857' };
      case 'มาสาย': return { sym: '▲', fill: 'FFFFEDD5', text: 'FFC2410C' };
      case 'ครึ่งวัน': return { sym: '◐', fill: 'FFE0F2FE', text: 'FF0369A1' };
      case 'ลา': return { sym: '○', fill: 'FFEDE9FE', text: 'FF6D28D9' };
      case 'ขาด': return { sym: '✗', fill: 'FFFEE2E2', text: 'FFB91C1C' };
      default: return { sym: '', fill: 'FFFFFFFF', text: 'FF94A3B8' };
    }
  }
  // ปุ่ม Excel หน้าเช็คชื่อ → ใช้รายงานแบบเดิม (v94): ชีตสรุปรวม + ปฏิทินแยกรายคน
  window.v96ExcelReport = function () {
    if (typeof window.v94ExportPayroll === 'function') return window.v94ExportPayroll();
    if (typeof window.v26ShowCSVExport === 'function') return window.v26ShowCSVExport();
    return window.v96ExportExcel(); // สำรอง: ตารางกริดเดือนเดียว
  };

  window.v96ExportExcel = async function () {
    if (!window.ExcelJS) { notify('โมดูล Excel ยังไม่พร้อม กรุณารีเฟรชแล้วลองใหม่', 'error'); return; }
    let data = window._v96;
    try { if (!data) data = await loadMonth(); } catch (e) { notify('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error'); return; }
    if (!data || !data.emps.length) { notify('ไม่มีข้อมูลพนักงาน', 'warning'); return; }
    notify('กำลังสร้าง Excel...', 'info');
    try {
      let shop = 'หจก. เอส เค วัสดุ';
      try { if (typeof getShopConfig === 'function') { const rc = (await getShopConfig()) || {}; shop = rc.shop_name || shop; } } catch (_) {}
      const { emps, map, advMap, advTotal, y, mo, daysInMonth } = data;
      const ml = v96View.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

      const wb = new ExcelJS.Workbook(); wb.creator = 'SK POS';
      const ws = wb.addWorksheet('เช็คชื่อ', {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0, footer: 0 } },
      });
      const lastCol = 1 + daysInMonth + 2;
      const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

      ws.mergeCells(1, 1, 1, lastCol);
      const c1 = ws.getCell(1, 1); c1.value = shop; c1.font = { bold: true, size: 15 }; c1.alignment = { horizontal: 'center' };
      ws.mergeCells(2, 1, 2, lastCol);
      const c2 = ws.getCell(2, 1); c2.value = `ตารางเช็คชื่อ · เดือน ${ml}`; c2.font = { bold: true, size: 12, color: { argb: 'FF475569' } }; c2.alignment = { horizontal: 'center' };

      const head = ['พนักงาน'];
      for (let d = 1; d <= daysInMonth; d++) head.push(String(d));
      head.push('มา', 'เบิก');
      const hr = ws.getRow(3); hr.values = head; hr.height = 20;
      hr.eachCell((cell) => { cell.font = { bold: true, size: 9, color: { argb: 'FF475569' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } }; });

      ws.getColumn(1).width = 22;
      for (let d = 1; d <= daysInMonth; d++) ws.getColumn(1 + d).width = 5.2;
      ws.getColumn(daysInMonth + 2).width = 6; ws.getColumn(daysInMonth + 3).width = 10;

      let r = 4;
      emps.forEach(emp => {
        const eid = String(emp.id);
        const days = map[eid] || {}; const dadv = advMap[eid] || {};
        const row = ws.getRow(r); row.height = 26;
        const nameCell = row.getCell(1);
        nameCell.value = `${emp.name} ${emp.lastname || ''}`.trim() + `\n${emp.position || 'พนักงาน'} · ฿${money(emp.daily_wage || 0)}/วัน`;
        nameCell.font = { bold: true, size: 10 }; nameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        let wd = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const st = days[d] ? days[d].status : null;
          if (st && isWorking(st)) wd++;
          const meta = xlSt(st); const a = dadv[d];
          const cell = row.getCell(1 + d);
          cell.value = meta.sym + (a ? `\n${xlAdv(a)}` : '');
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.font = { size: 9, bold: true, color: { argb: a ? 'FFC2410C' : meta.text } };
          if (st) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.fill } };
        }
        const cMa = row.getCell(daysInMonth + 2); cMa.value = wd; cMa.alignment = { horizontal: 'center', vertical: 'middle' }; cMa.font = { bold: true, size: 10, color: { argb: 'FF16A34A' } };
        const cAdv = row.getCell(daysInMonth + 3); cAdv.value = advTotal[eid] || 0; cAdv.numFmt = '#,##0'; cAdv.alignment = { horizontal: 'center', vertical: 'middle' }; cAdv.font = { bold: true, size: 10, color: { argb: 'FFC2410C' } };
        r++;
      });

      ws.pageSetup.printArea = `A1:${colLetter(lastCol)}${r - 1}`;
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `เช็คชื่อ_${ml.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify('ดาวน์โหลด Excel สำเร็จ', 'success');
    } catch (err) { console.error('[v96] excel:', err); notify('สร้าง Excel ไม่สำเร็จ: ' + (err?.message || err), 'error'); }
  };

  // ──────────────────────────────────────
  // ป็อปอัพแก้ไขช่องวัน: สถานะ → สถานที่ทำงาน
  // ──────────────────────────────────────
  window.v96EditCell = async function (empId, day) {
    const data = window._v96;
    if (!data) return;
    const emp = data.emps.find(e => String(e.id) === String(empId));
    if (!emp) return;
    const { y, mo } = data;
    const dateObj = new Date(y, mo, day);
    const dayDate = startOfDay(dateObj);
    const today = startOfDay(new Date());

    // ── สิทธิ์ ──
    if (dayDate > today) {
      Swal.fire({ icon: 'info', title: 'ยังไม่ถึงวัน', text: 'ยังลงเวลาในวันอนาคตไม่ได้', confirmButtonColor: '#64748b' });
      return;
    }
    if (dayDate < today && !isAdmin()) {
      Swal.fire({ icon: 'error', iconHtml: '<i class="material-icons-round" style="font-size:48px;">lock</i>',
        title: 'แก้ไขย้อนหลังไม่ได้', html: '<div style="color:#64748b;">การแก้ไขวันย้อนหลังทำได้เฉพาะ <strong>แอดมิน</strong> เท่านั้น</div>',
        confirmButtonColor: '#dc2626' });
      return;
    }

    const dateKey = keyOf(y, mo, day);
    const existing = (data.map[String(empId)] || {})[day] || null;
    const curStatus = existing ? normSt(existing.status) : null;
    const dateLabel = dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });

    // ── STEP 1: เลือกสถานะ ──
    const stRes = await Swal.fire({
      width: 460,
      html: `
        <div style="text-align:center;margin-bottom:16px;">
          <div style="width:58px;height:58px;border-radius:18px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);color:#1d4ed8;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;margin:0 auto 10px;box-shadow:0 6px 16px rgba(37,99,235,.18);">${(emp.name || '?')[0]}</div>
          <h3 style="margin:0;color:#1e293b;font-size:19px;font-weight:900;">${emp.name} ${emp.lastname || ''}</h3>
          <div style="display:inline-flex;align-items:center;gap:5px;margin-top:7px;background:#eff6ff;color:#2563eb;font-weight:800;font-size:12.5px;padding:5px 13px;border-radius:999px;"><i class="material-icons-round" style="font-size:15px;">event</i> ${dateLabel}</div>
        </div>
        <div style="font-size:12.5px;font-weight:800;color:#64748b;text-align:left;margin-bottom:7px;">เลือกสถานะวันนี้</div>
        <div class="v96-st-grid" id="v96-st-grid">
          ${Object.entries(ST).map(([k, v]) => `
            <div class="v96-st-opt ${curStatus === k ? 'on' : ''}" style="--oc:${v.c};" data-st="${k}" onclick="window.__v96PickSt('${k}')">
              <div class="v96-st-sym">${v.s}</div>
              <div class="v96-st-label">${v.label}</div>
              <div class="v96-st-info">${v.info}</div>
            </div>`).join('')}
        </div>
        <input type="hidden" id="v96-st-val" value="${curStatus || ''}">
        <div style="text-align:left;margin-top:14px;">
          <label style="font-size:12.5px;font-weight:800;color:#64748b;display:block;margin-bottom:5px;">หมายเหตุ (ถ้ามี)</label>
          <input type="text" id="v96-st-note" placeholder="เช่น มาสายเพราะรถติด..." value="${(existing && existing.note ? stripAssign(existing.note) : '').replace(/"/g, '&quot;')}"
            style="width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:12px;padding:11px 12px;font-size:14px;outline:none;">
        </div>
      `,
      showCancelButton: true,
      showDenyButton: !!existing,
      denyButtonText: 'ลบรายการ',
      denyButtonColor: '#94a3b8',
      confirmButtonText: 'ถัดไป',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#2563eb',
      didOpen: () => {
        window.__v96PickSt = (k) => {
          document.getElementById('v96-st-val').value = k;
          document.querySelectorAll('#v96-st-grid .v96-st-opt').forEach(o => o.classList.toggle('on', o.dataset.st === k));
        };
      },
      preConfirm: () => {
        const st = document.getElementById('v96-st-val').value;
        if (!st) { Swal.showValidationMessage('กรุณาเลือกสถานะ'); return false; }
        return { status: st, note: document.getElementById('v96-st-note').value.trim() };
      },
    });

    if (stRes.isDenied) { await deleteCell(existing, emp); return; }
    if (!stRes.isConfirmed) return;
    const { status, note } = stRes.value;

    // ── STEP 2: สถานที่ทำงาน (เฉพาะวันที่มาทำงานจริง) ──
    let workplace = 'store', projectId = '', projectName = '';
    if (isWorking(status)) {
      const { data: projects } = await db.from(PROJECT_TABLE).select('id,name,status,total_expenses').eq('status', 'active').order('name');
      const active = projects || [];
      const wpRes = await Swal.fire({
        width: 460,
        html: `
          <div style="text-align:center;margin-bottom:4px;">
            <h3 style="margin:0;color:#1e293b;">เลือกสถานที่ทำงาน</h3>
            <div style="color:#64748b;font-weight:700;font-size:13px;">${emp.name} · ${dateLabel}</div>
          </div>
          <div class="v96-wp-seg">
            <div class="v96-wp-btn on" id="v96-wp-store" onclick="window.__v96WP('store')"><i class="material-icons-round">storefront</i>หน้าร้าน</div>
            <div class="v96-wp-btn" id="v96-wp-project" onclick="window.__v96WP('project')"><i class="material-icons-round">business_center</i>โครงการ</div>
          </div>
          <select id="v96-wp-select" disabled style="width:100%;box-sizing:border-box;margin-top:10px;border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-weight:700;${active.length ? '' : 'display:none;'}">
            <option value="">— เลือกโครงการ —</option>
            ${active.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
          ${active.length ? '' : '<div style="margin-top:10px;font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px;">ยังไม่มีโครงการ active — ลงได้เฉพาะหน้าร้าน</div>'}
        `,
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ย้อนกลับ',
        confirmButtonColor: '#059669',
        didOpen: () => {
          window.__v96WP = (t) => {
            window.__v96wp = t;
            document.getElementById('v96-wp-store').classList.toggle('on', t === 'store');
            document.getElementById('v96-wp-project').classList.toggle('on', t === 'project');
            const sel = document.getElementById('v96-wp-select');
            if (sel) { sel.disabled = t !== 'project'; if (t !== 'project') sel.value = ''; }
          };
          window.__v96wp = 'store';
        },
        preConfirm: () => {
          const t = window.__v96wp || 'store';
          if (t === 'project') {
            const sel = document.getElementById('v96-wp-select');
            if (!sel || !sel.value) { Swal.showValidationMessage('กรุณาเลือกโครงการ'); return false; }
            return { type: 'project', projectId: sel.value, projectName: sel.options[sel.selectedIndex].text };
          }
          return { type: 'store' };
        },
      });
      if (!wpRes.isConfirmed) return;
      workplace = wpRes.value.type;
      projectId = wpRes.value.projectId || '';
      projectName = wpRes.value.projectName || '';
    }

    await saveCell(emp, dateKey, day, status, note, workplace, projectId, projectName, existing);
  };

  // ──────────────────────────────────────
  // บันทึกช่องวันเดียว (+ จัดการค่าแรงโครงการ)
  // ──────────────────────────────────────
  // จำนวนวันทำงานของเดือน (หยุดเฉพาะอาทิตย์ = นับ จันทร์–เสาร์)
  function workdaysInMonth(dateStr) {
    const m = String(dateStr || '').match(/^(\d{4})-(\d{2})/);
    const now = new Date();
    const y = m ? +m[1] : now.getFullYear();
    const mo = m ? +m[2] - 1 : now.getMonth();
    const total = new Date(y, mo + 1, 0).getDate();
    let c = 0;
    for (let d = 1; d <= total; d++) if (new Date(y, mo, d).getDay() !== 0) c++; // 0 = อาทิตย์
    return c || 26;
  }
  // อัตราต่อวันของพนักงานรายเดือน = เงินเดือน ÷ วันทำงาน(จันทร์–เสาร์) ของเดือนนั้น
  function monthlyDayRate(emp, dateStr) { return num(emp.salary) / workdaysInMonth(dateStr); }
  function isSunday(dateStr) {
    const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).getDay() === 0 : false;
  }

  function calcDeduction(emp, status, dateStr) {
    let ded = 0;
    if (emp.pay_type === 'รายเดือน') {
      if (isSunday(dateStr)) return 0; // อาทิตย์ = วันหยุด ไม่หักเงินเดือน
      const dq = monthlyDayRate(emp, dateStr);
      if (status === 'ขาด') ded = dq;
      else if (status === 'ครึ่งวัน') ded = dq * 0.5;
      else if (status === 'มาสาย') ded = dq * 0.05;
    } else {
      const w = num(emp.daily_wage);
      if (status === 'ครึ่งวัน') ded = w * 0.5;
      else if (status === 'มาสาย') ded = w * 0.05;
    }
    return Math.round(ded);
  }
  function laborCost(emp, status, deduction, dateStr) {
    if (!isWorking(status)) return 0;
    const base = emp.pay_type === 'รายเดือน' ? monthlyDayRate(emp, dateStr) : num(emp.daily_wage);
    return Math.max(0, Math.round(base - num(deduction)));
  }
  function stripAssign(note) {
    return String(note || '').split('\n').filter(l => !l.trim().startsWith(ASSIGN_PREFIX)).join('\n').trim();
  }
  function makeAssign(baseNote, type, projectName) {
    const base = stripAssign(baseNote);
    const line = type === 'project' ? `${ASSIGN_PREFIX}โครงการ:${projectName || '-'}]` : `${ASSIGN_PREFIX}หน้าร้าน]`;
    return [base, line].filter(Boolean).join('\n');
  }

  async function removeProjectLabor(attendanceId) {
    if (!attendanceId) return;
    const { data: removed } = await db.from(PROJECT_EXPENSE_TABLE).delete()
      .ilike('notes', `%${ATT_REF_PREFIX}${attendanceId}%`).select('id,project_id,amount');
    for (const row of removed || []) {
      if (!row.project_id) continue;
      const { data: p } = await db.from(PROJECT_TABLE).select('total_expenses').eq('id', row.project_id).maybeSingle();
      await db.from(PROJECT_TABLE).update({ total_expenses: Math.max(0, num(p?.total_expenses) - num(row.amount)) }).eq('id', row.project_id);
    }
  }
  async function addProjectLabor(att, emp, projectId, amount) {
    if (!att?.id || !projectId || amount <= 0) return;
    const desc = `ค่าแรง ${emp.name || ''} ${emp.lastname || ''}`.trim();
    const notes = `${ATT_REF_PREFIX}${att.id} | ${att.status} | ${att.date}`;
    await db.from(PROJECT_EXPENSE_TABLE).insert({
      project_id: projectId, description: desc, category: 'ค่าแรง',
      amount, type: 'labor', notes, paid_at: null,
    });
    const { data: cur } = await db.from(PROJECT_TABLE).select('total_expenses').eq('id', projectId).maybeSingle();
    await db.from(PROJECT_TABLE).update({ total_expenses: num(cur?.total_expenses) + amount }).eq('id', projectId);
  }

  async function saveCell(emp, dateKey, day, status, note, workplace, projectId, projectName, existing) {
    try {
      const deduction = calcDeduction(emp, status, dateKey);
      const finalNote = isWorking(status) ? makeAssign(note, workplace, projectName) : stripAssign(note);
      const isToday = dateKey === keyOf(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
      const rec = {
        employee_id: emp.id, date: dateKey, status, deduction, note: finalNote, staff_name: staff(),
        time_in: (existing && existing.time_in) || (status !== 'ขาด' && isToday ? nowTime() : (existing ? existing.time_in : null)),
        time_out: (existing && existing.time_out) || null,
      };
      let att;
      if (existing && existing.id) {
        const { data, error } = await db.from(ATT_TABLE).update(rec).eq('id', existing.id).select().single();
        if (error) throw error; att = data;
      } else {
        const { data, error } = await db.from(ATT_TABLE).insert(rec).select().single();
        if (error) throw error; att = data;
      }
      // จัดการค่าแรงโครงการ: ลบของเดิมก่อนเสมอ แล้วเพิ่มใหม่ถ้าเป็นโครงการ
      await removeProjectLabor(att.id);
      if (isWorking(status) && workplace === 'project' && projectId) {
        await addProjectLabor(att, emp, projectId, laborCost(emp, status, deduction, dateKey));
      }
      if (typeof logActivity === 'function') logActivity('เช็คชื่อ', `${emp.name} ${status} (${dateKey})`);
      notify(`บันทึก ${emp.name} · ${ST[status] ? ST[status].label : status}`, 'success');
      // อัปเดตเฉพาะช่องที่กด (ไม่รีโหลดทั้งหน้า — ไม่เลื่อนขึ้น)
      if (window._v96 && document.getElementById(`v96c-${emp.id}-${day}`)) {
        (window._v96.map[String(emp.id)] = window._v96.map[String(emp.id)] || {})[day] = att;
        v96UpdateCell(emp.id, day);
      } else {
        renderAttendanceTable();
      }
    } catch (e) {
      console.error('[v96] saveCell:', e);
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e.message });
    }
  }

  async function deleteCell(existing, emp) {
    if (!existing || !existing.id) return;
    const ok = await Swal.fire({ icon: 'warning', title: 'ลบรายการลงเวลานี้?', text: `${emp.name} · ${existing.date}`, showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
    if (!ok.isConfirmed) return;
    try {
      await removeProjectLabor(existing.id);
      const { error } = await db.from(ATT_TABLE).delete().eq('id', existing.id);
      if (error) throw error;
      notify('ลบรายการแล้ว', 'success');
      const day = parseInt(String(existing.date).slice(8, 10), 10);
      if (window._v96 && window._v96.map[String(emp.id)] && document.getElementById(`v96c-${emp.id}-${day}`)) {
        delete window._v96.map[String(emp.id)][day];
        v96UpdateCell(emp.id, day);
      } else {
        renderAttendanceTable();
      }
    } catch (e) { Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e.message }); }
  }

  // ──────────────────────────────────────
  // เปลือก 3 แถบ (เช็คชื่อ / จ่ายเงินเดือน / ยอดขายพนักงาน)
  // ──────────────────────────────────────
  const V96_TABS = [
    { k: 'checkin', label: 'เช็คชื่อ', icon: 'how_to_reg' },
    { k: 'payroll', label: 'จ่ายเงินเดือน', icon: 'account_balance_wallet' },
    { k: 'sales', label: 'ยอดขายพนักงาน', icon: 'leaderboard' },
  ];
  function tabBarHTML(active) {
    return `<div class="v96-tabbar">${V96_TABS.map(t =>
      `<button class="v96-tab ${t.k === active ? 'on' : ''}" data-tab="${t.k}" onclick="window.v96ShowTab('${t.k}')"><i class="material-icons-round">${t.icon}</i> ${t.label}</button>`
    ).join('')}</div>`;
  }
  function ensureShell(active) {
    const sec = document.getElementById('page-att');
    if (!sec) return;
    if (!sec.querySelector('.v96-tabbar') || !document.getElementById('att-body')) {
      sec.innerHTML = tabBarHTML(active) + '<div id="att-body"></div>';
    }
    sec.querySelectorAll('.v96-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === active));
  }

  // เข้าหน้า/กลับมาหน้าเช็คชื่อ → สร้างเปลือกใหม่ + โหลดแถบเช็คชื่อ
  async function renderAttendanceEntry() {
    const sec = document.getElementById('page-att');
    if (!sec) return;
    sec.innerHTML = tabBarHTML('checkin') + '<div id="att-body"></div>';
    await renderAttendanceTable();
  }

  window.v96ShowTab = async function (tab) {
    ensureShell(tab);
    try {
      if (tab === 'payroll') {
        if (typeof window.renderPayrollV26 === 'function') await window.renderPayrollV26();
        else notify('โมดูลจ่ายเงินเดือนยังไม่พร้อม', 'error');
      } else if (tab === 'sales') {
        if (typeof window.renderStaffSalesDashboard === 'function') await window.renderStaffSalesDashboard();
        else notify('โมดูลยอดขายพนักงานยังไม่พร้อม', 'error');
      } else {
        await renderAttendanceTable();
      }
    } catch (e) { console.error('[v96] showTab:', e); notify('เปิดหน้าไม่สำเร็จ: ' + e.message, 'error'); }
    ensureShell(tab); // คงไฮไลต์แถบหลัง render
  };

  // ──────────────────────────────────────
  // ล็อกให้เปลือก 3 แถบเป็นหน้าเช็คชื่อเสมอ
  // ──────────────────────────────────────
  try {
    Object.defineProperty(window, 'renderAttendance', {
      configurable: true,
      get: function () { return renderAttendanceEntry; },
      set: function () { /* ignore legacy override */ },
    });
  } catch (_) { window.renderAttendance = renderAttendanceEntry; }

  console.log('[v96] attendance-table loaded');
})();
