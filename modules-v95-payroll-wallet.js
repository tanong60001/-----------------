/* ════════════════════════════════════════════════════════════════════
   modules-v95-payroll-wallet.js
   ─────────────────────────────────────────────────────────────────────
   "กระเป๋าเงินพนักงาน" (Employee Wallet) — ยกเครื่องระบบเบิกเงิน + จ่ายเงินเดือน
   ให้ใช้ง่ายขึ้น ลดความผิดพลาดจากการเบิกบ่อย/หลายคนกรอก

   แนวคิด: พนักงานแต่ละคนมี "ยอดคงเหลือเดียว" ที่อัปเดตสด
     ค่าแรงสะสมเดือนนี้  (+)
     − เบิกเงินที่ยังค้าง (−)   ← รวมหนี้ยกมาจากเดือนก่อนด้วย
     = ยอดสุทธิ (netPayable)
        • บวก = ร้านค้างจ่ายพนักงาน
        • ลบ  = พนักงานค้างร้าน (หนี้) → ยกไปเดือนถัดไปอัตโนมัติ

   จุดเด่นที่แก้ปัญหาเดิม:
   1) ตอนเบิก โชว์ "คงเหลือ / หลังเบิกเหลือเท่าไหร่" สดๆ + เตือนเมื่อเบิกเกิน
      (ไม่บล็อก — ยังเบิกเกินจนติดลบได้ตามที่ต้องการ)
   2) ปุ่มเงินก้อนกดเร็ว (100/500/1000) ลดพิมพ์ผิด + กันกดยืนยันซ้ำ
   3) หน้าจ่ายเงินเดือนคำนวณยอดสุทธิ + หักหนี้ให้อัตโนมัติ → กดปุ่มเดียวจบ
      ("ปรับยอด" ค่อยเปิดช่องแก้เองเฉพาะกรณีพิเศษ)
   4) สมุดบัญชีรายคน เปิดดูทุกรายการเบิก/จ่ายย้อนหลังได้

   ไม่แก้ schema — คำนวณจากตารางเดิม: พนักงาน / เช็คชื่อ / เบิกเงิน / จ่ายเงินเดือน
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const EMP_TABLE = 'พนักงาน';
  const ATT_TABLE = 'เช็คชื่อ';
  const ADV_TABLE = 'เบิกเงิน';
  const PAY_TABLE = 'จ่ายเงินเดือน';

  function num(v) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function money(v) {
    if (typeof window.formatNum === 'function') return window.formatNum(v);
    return num(v).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function dDate(v) {
    if (typeof window.formatDate === 'function') return window.formatDate(v);
    try { return new Date(v).toLocaleDateString('th-TH'); } catch (_) { return v; }
  }
  // ยอดเงินแบบสั้นสำหรับเซลล์แคบ: 500, 1.6k, 18k
  function cmoney(v) {
    const n = num(v);
    if (n < 1000) return String(n);
    const k = n / 1000;
    return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + 'k';
  }
  // เซลล์วันในตาราง Excel: หลักพันโชว์เต็ม (1500) · หลักหมื่นขึ้นไปย่อเป็น k (12k)
  function xlAdv(v) {
    const n = Math.round(num(v));
    return n < 10000 ? String(n) : Math.round(n / 1000) + 'k';
  }
  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function notify(msg, type) { if (typeof toast === 'function') toast(msg, type || 'info'); }
  function noteExtraDeductions(note) {
    const text = String(note || '');
    const marked = text.match(/\[payroll_extra_deduct=([0-9,]+(?:\.\d+)?)\]/gi);
    if (marked?.length) {
      return marked.reduce((sum, raw) => {
        const match = raw.match(/=([0-9,]+(?:\.\d+)?)/);
        return sum + num(String(match?.[1] || '').replace(/,/g, ''));
      }, 0);
    }
    const patterns = [
      /(?:หัก)?ประกันสังคม\s*฿?\s*([0-9,]+(?:\.\d+)?)/gi,
      /(?:หัก)?อื่น\s*ๆ\s*฿?\s*([0-9,]+(?:\.\d+)?)/gi,
      /(?:หัก)?อื่นๆ\s*฿?\s*([0-9,]+(?:\.\d+)?)/gi,
    ];
    return patterns.reduce((sum, re) => {
      let match;
      while ((match = re.exec(text))) sum += num(String(match[1] || '').replace(/,/g, ''));
      return sum;
    }, 0);
  }

  // ──────────────────────────────────────
  // CSS
  // ──────────────────────────────────────
  (function injectCSS() {
    if (document.getElementById('v95-css')) return;
    const s = document.createElement('style');
    s.id = 'v95-css';
    s.textContent = `
      .v95-wal-line{display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:14px;}
      .v95-wal-line .lbl{color:#64748b;display:flex;align-items:center;gap:6px;}
      .v95-wal-line .val{font-weight:800;}
      .v95-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-weight:800;font-size:13px;}
      .v95-chip.pos{background:#dcfce7;color:#15803d;}
      .v95-chip.neg{background:#fee2e2;color:#b91c1c;}
      .v95-chip.zero{background:#f1f5f9;color:#475569;}
      .v95-quick{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
      .v95-quick button{flex:1;min-width:70px;border:1.5px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:10px 4px;font-weight:800;color:#334155;cursor:pointer;font-size:14px;transition:.15s;}
      .v95-quick button:hover{border-color:#d97706;background:#fffbeb;color:#b45309;}
      .v95-quick button.clear{flex:0 0 auto;min-width:46px;color:#94a3b8;}
      .v95-warn{margin-top:12px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:700;display:flex;align-items:flex-start;gap:8px;line-height:1.45;}
      .v95-warn.ok{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;}
      .v95-warn.over{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;}
      .v95-paycard{background:#fff;border-radius:18px;border:2px solid #e2e8f0;padding:18px;cursor:pointer;transition:.18s;box-shadow:0 4px 14px rgba(0,0,0,.04);position:relative;}
      .v95-paycard:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.08);border-color:#cbd5e1;}
      .v95-paycard.paid{border-color:#10b981;background:#f0fdf4;}
      .v95-paycard.debt{border-color:#fca5a5;}
      .v95-pill-paid{position:absolute;top:-10px;right:14px;background:#10b981;color:#fff;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:800;box-shadow:0 2px 8px rgba(16,185,129,.4);}
      .v95-big{display:flex;flex-direction:column;border:none;cursor:pointer;border-radius:14px;padding:16px;font-weight:900;font-size:17px;color:#fff;width:100%;align-items:center;gap:2px;transition:.15s;box-shadow:0 6px 18px rgba(0,0,0,.12);}
      .v95-big:active{transform:scale(.98);}
      .v95-big small{font-weight:600;font-size:12px;opacity:.9;}
      .v95-big.pay{background:linear-gradient(135deg,#059669,#10b981);}
      .v95-big.pay.transfer{background:linear-gradient(135deg,#1d4ed8,#3b82f6);}
      .v95-big.debtonly{background:linear-gradient(135deg,#d97706,#f59e0b);}
      .v95-ghost{background:#fff;border:1.5px solid #cbd5e1;color:#475569;border-radius:12px;padding:12px;font-weight:800;cursor:pointer;width:100%;}
      .v95-ghost:hover{background:#f8fafc;}
      .v95-method{border:2px solid #e2e8f0;background:#fff;color:#475569;border-radius:13px;padding:14px 10px;font-weight:800;font-size:15px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;font-family:inherit;transition:.15s;}
      .v95-method .mi{font-size:24px;}
      .v95-method:hover{border-color:#cbd5e1;}
      .v95-method.on{border-color:#059669;background:#ecfdf5;color:#047857;box-shadow:0 4px 14px rgba(5,150,105,.16);}
      .v95-method.on.transfer{border-color:#2563eb;background:#eff6ff;color:#1d4ed8;box-shadow:0 4px 14px rgba(37,99,235,.16);}
      .v95-adj{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .v95-adj .fld label{font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;}
      .v95-adj .fld input,.v95-adj .fld select{width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;font-weight:700;box-sizing:border-box;}
      .v95-ledger-row{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-radius:10px;margin-bottom:6px;font-size:13px;}
      .v95-ledger-row.adv{background:#fff7ed;}
      .v95-ledger-row.pay{background:#eff6ff;}

      /* ── ตารางรายเดือน ── */
      .v95-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px;}
      .v95-month-nav{display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:4px;}
      .v95-month-nav button{border:none;background:#f1f5f9;color:#334155;width:38px;height:38px;border-radius:9px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
      .v95-month-nav button:disabled{opacity:.3;cursor:not-allowed;}
      .v95-month-nav .lbl{font-weight:900;color:#1e293b;padding:0 12px;min-width:120px;text-align:center;font-size:15px;}
      .v95-search{flex:1;min-width:160px;position:relative;}
      .v95-search input{width:100%;box-sizing:border-box;height:46px;border:1.5px solid #e2e8f0;border-radius:12px;padding:0 14px 0 40px;font-size:15px;font-weight:600;}
      .v95-search i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#94a3b8;}
      .v95-tool-btn{height:46px;border:none;border-radius:12px;padding:0 16px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:14px;}
      .v95-tool-btn.xls{background:#dcfce7;color:#15803d;}
      .v95-tool-btn.print{background:#e0e7ff;color:#3730a3;}
      .v95-admin-note{font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:6px 12px;font-weight:700;}

      .v95-table-wrap{overflow:hidden;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.04);}
      table.v95-tbl{border-collapse:separate;border-spacing:0;table-layout:fixed;width:100%;font-size:12px;}
      .v95-tbl th,.v95-tbl td{padding:0;text-align:center;border-bottom:1px solid #eef2f7;overflow:hidden;}
      .v95-tbl thead th{background:#f8fafc;color:#475569;font-weight:800;font-size:11px;height:38px;border-bottom:2px solid #e2e8f0;}
      .v95-tbl th.v95-wk{color:#cbd5e1;}
      /* คอลัมน์ชื่อ */
      .v95-tbl .v95-name{width:148px;text-align:left;padding:7px 10px;cursor:pointer;border-right:1px solid #eef2f7;}
      .v95-tbl tbody tr:hover .v95-name,.v95-tbl tbody tr:hover td{background:#f8fafc;}
      .v95-nm-top{font-weight:900;color:#1e293b;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .v95-nm-sub{font-size:10.5px;color:#94a3b8;font-weight:700;}
      .v95-nm-net{font-size:12px;font-weight:900;margin-top:1px;}
      /* เซลล์รายวัน (กว้างเท่ากันแบ่งพื้นที่ที่เหลือ) */
      .v95-day{height:44px;line-height:1.05;padding:0 1px;}
      .v95-day .sym{font-size:13px;font-weight:900;}
      .v95-day .adv{font-size:8px;font-weight:800;color:#c2410c;display:block;margin-top:1px;line-height:1;white-space:nowrap;letter-spacing:-.3px;}
      .v95-day.wk{background:#fafbfc;}
      /* คอลัมน์สรุป */
      .v95-sum{width:58px;font-weight:900;padding:6px 4px;font-size:12px;border-left:1px solid #f1f5f9;}
      .v95-tbl tbody tr{cursor:pointer;}
      .v95-tbl tbody tr.paid-row .v95-name{border-left:3px solid #10b981;}
      .v95-foot td{background:#f8fafc;font-weight:900;color:#1e293b;height:42px;border-top:2px solid #e2e8f0;}
      /* ── การ์ดมือถือ (จ่ายเงินเดือน) ── */
      .v95-mcard{background:#fff;border:1px solid #eef2f7;border-radius:16px;padding:13px 14px;margin-bottom:10px;box-shadow:0 2px 10px rgba(15,23,42,.05);cursor:pointer;}
      .v95-mcard:active{transform:scale(.99);}
      .v95-mcard.settled{border-color:#a7f3d0;background:#f0fdf4;}
      .v95-mc-head{display:flex;align-items:center;gap:11px;}
      .v95-mc-av{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);color:#475569;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:19px;flex:0 0 auto;}
      .v95-mc-name{font-weight:900;color:#1e293b;font-size:15.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .v95-mc-sub{font-size:11.5px;color:#94a3b8;font-weight:700;}
      .v95-mc-pay{font-size:21px;font-weight:900;color:#059669;line-height:1;}
      .v95-mc-foot{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:11px;padding-top:10px;border-top:1px dashed #eef2f7;}
      .v95-mc-chip{font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:999px;}
      .v95-mc-chip.debt{background:#fff7ed;color:#c2410c;}
      .v95-mc-chip.adv{background:#fef9c3;color:#a16207;}
      .v95-mc-go{margin-left:auto;font-size:12.5px;font-weight:800;color:#2563eb;}
      .v95-mcard.settled .v95-mc-go{color:#059669;}
      @media(max-width:680px){
        .v95-tbl{font-size:10px;}
        .v95-tbl .v95-name{width:96px;padding:5px 5px;}
        .v95-nm-top{font-size:11px;}.v95-nm-sub{font-size:9px;}.v95-nm-net{font-size:10px;}
        .v95-day .sym{font-size:11px;}.v95-day .adv{font-size:7px;}
        .v95-sum{width:38px;font-size:9px;padding:4px 1px;}
      }
      @media print{
        body *{visibility:hidden;}
        #v95-grid, #v95-grid *{visibility:visible;}
        #v95-grid{position:absolute;left:0;top:0;width:100%;}
        .v95-toolbar, .v95-tbl tbody tr{cursor:auto;}
        .v95-table-wrap{overflow:visible!important;box-shadow:none;border:none;}
        table.v95-tbl{font-size:10px;width:100%;}
        .v95-tbl .v95-name{box-shadow:none;min-width:120px;}
        .v95-day{width:auto;min-width:0;}
        @page{size:landscape;margin:8mm;}
      }
    `;
    document.head.appendChild(s);
  })();

  // เดือนที่กำลังดูอยู่ (วันที่ 1 ของเดือน) — เปลี่ยนได้เฉพาะแอดมินสำหรับย้อนหลัง
  let v95View = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  function isAdmin() { return !!(typeof USER !== 'undefined' && USER && USER.role === 'admin'); }
  function isCurrentMonth(d) {
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  }
  // หนี้เดิมยกมา (ตั้งโดยแอดมิน) — ไม่ใช่การเบิกรายวันปกติ
  function isCarried(a) { return /ยกมา/.test(String(a && a.reason || '')); }
  function dayOf(value) {
    // คืนเลขวันที่ (1..31) ตามเวลาท้องถิ่นจาก timestamp/date string
    const raw = String(value || '');
    const m = raw.match(/^\d{4}-\d{2}-(\d{2})/);
    if (m) return parseInt(m[1], 10);
    const d = new Date(value); return Number.isNaN(d.getTime()) ? 0 : d.getDate();
  }
  function attDateKey(row) {
    const raw = String(row && row.date || '');
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const d = new Date(row && row.date);
    return Number.isNaN(d.getTime()) ? raw.slice(0, 10) : dateKey(d);
  }
  function normStatus(status) {
    const st = String(status || '').trim();
    return st === 'มาครึ่งวัน' ? 'ครึ่งวัน' : st;
  }
  function isWorkStatus(status) {
    const st = normStatus(status);
    return !!st && st !== 'ขาด' && st !== 'ลา';
  }
  function attendanceStamp(row, fallback) {
    const value = row && (row.updated_at || row.created_at || row.time_out || row.time_in || row.date || row.id);
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) ? time : fallback;
  }
  function normalizeAttendanceRows(rows) {
    const map = new Map();
    (rows || []).forEach((row, index) => {
      const empId = String(row && row.employee_id || '');
      const day = attDateKey(row);
      if (!empId || !day) return;
      const key = empId + '|' + day;
      const next = Object.assign({}, row, { __dateKey: day, __rowStamp: attendanceStamp(row, index) });
      const old = map.get(key);
      if (!old || next.__rowStamp >= old.__rowStamp) map.set(key, next);
    });
    return Array.from(map.values());
  }

  // ════════════════════════════════════════
  // CORE: คำนวณกระเป๋าเงิน + ข้อมูลรายวันของทุกคน (ตามเดือนที่ดู)
  // ════════════════════════════════════════
  async function computeWallets(viewDate) {
    const vd = viewDate || v95View;
    const y = vd.getFullYear(), mo = vd.getMonth();
    const ms = dateKey(new Date(y, mo, 1));
    const me = dateKey(new Date(y, mo + 1, 0));
    const meAt = me + 'T23:59:59';
    const daysInMonth = new Date(y, mo + 1, 0).getDate();

    const emps = (await loadEmployees()).filter(e => e.status === 'ทำงาน');
    const [attR, monthAdvR, outAdvR, paidR] = await Promise.all([
      db.from(ATT_TABLE).select('*').gte('date', ms).lte('date', me),
      // เบิกทุกสถานะที่เกิดในเดือนนี้ → ใช้โชว์รายวันในตาราง
      db.from(ADV_TABLE).select('*').gte('date', ms + 'T00:00:00').lte('date', meAt),
      // หนี้เบิกที่ยังค้าง (อนุมัติ) จนถึงสิ้นเดือนที่ดู → ใช้คำนวณ/ตัดหนี้
      db.from(ADV_TABLE).select('*').eq('status', 'อนุมัติ').lte('date', meAt),
      db.from(PAY_TABLE).select('*').eq('month', ms),
    ]);
    const att = normalizeAttendanceRows(attR.data || []), monthAdv = monthAdvR.data || [],
      outAdv = outAdvR.data || [], paid = paidR.data || [];

    return emps.map(emp => {
      const eid = String(emp.id);
      const ma = att.filter(a => String(a.employee_id) === eid);
      const wd = ma.filter(a => isWorkStatus(a.status)).length;
      const td = ma.reduce((s, a) => s + num(a.deduction), 0);

      let earn;
      if (emp.pay_type === 'รายเดือน') earn = num(emp.salary) - td;
      else earn = (wd * num(emp.daily_wage)) - td;
      earn = Math.max(0, earn);

      // แผนผังรายวัน: สถานะ + ยอดเบิกรวมต่อวัน
      const dayStatus = {}, dayAdv = {};
      ma.forEach(a => { dayStatus[dayOf(a.date)] = normStatus(a.status); });
      let monthAdvSum = 0;
      // ไม่นับ "หนี้เดิมยกมา" เป็นการเบิกรายวันของเดือนนี้ (แต่ยังเป็นหนี้ใน debtRemaining)
      monthAdv.filter(a => String(a.employee_id) === eid && !isCarried(a)).forEach(a => {
        const d = dayOf(a.date); dayAdv[d] = (dayAdv[d] || 0) + num(a.amount); monthAdvSum += num(a.amount);
      });

      // ตาราง 'จ่ายเงินเดือน' เก็บเฉพาะ net_paid + deduct_withdraw เป็นคอลัมน์
      const myPaid = paid.filter(p => String(p.employee_id) === eid);
      const consumedEarn = myPaid.reduce((s, p) => s + num(p.net_paid) + num(p.deduct_withdraw) + noteExtraDeductions(p.note), 0);
      const wageRemaining = Math.max(0, earn - consumedEarn);

      // หนี้เบิกคงค้าง (ข้ามเดือน, ถึงสิ้นเดือนที่ดู) — เรียงเก่า→ใหม่ (ใช้ตัด FIFO)
      const myAdv = outAdv.filter(a => String(a.employee_id) === eid)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      const debtRemaining = myAdv.reduce((s, a) => s + num(a.amount), 0);
      const carriedDebt = myAdv.filter(isCarried).reduce((s, a) => s + num(a.amount), 0); // หนี้เดิมยกมา

      const netPayable = wageRemaining - debtRemaining; // ติดลบได้ = พนักงานค้างร้าน
      const fullySettled = wageRemaining <= 0.01 && debtRemaining <= 0.01;

      return {
        emp, ms, wd, earn, td, daysInMonth,
        wageRemaining, debtRemaining, carriedDebt, netPayable, monthAdvSum,
        advances: myAdv, pastPays: myPaid, dayStatus, dayAdv,
        hasPaid: myPaid.length > 0, fullySettled,
      };
    });
  }

  // กระเป๋าของคนเดียว (ใช้ตอนเปิด popup เบิกเงิน — อิงเดือนปัจจุบันเสมอ)
  async function walletFor(empId) {
    const all = await computeWallets(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    return all.find(w => String(w.emp.id) === String(empId)) || null;
  }

  // ════════════════════════════════════════
  // 1) POPUP เบิกเงิน (ฉลาดขึ้น + โชว์ยอดสด)
  // ════════════════════════════════════════
  window.openAdvanceWizard = async function (empId, empName) {
    let w = null;
    try { w = await walletFor(empId); } catch (_) {}
    const wageRem = w ? w.wageRemaining : 0;
    const debtRem = w ? w.debtRemaining : 0;
    const net = w ? w.netPayable : 0;

    const netChip = net >= 0
      ? `<span class="v95-chip pos">ร้านค้างจ่าย ฿${money(net)}</span>`
      : `<span class="v95-chip neg">พนักงานค้างร้าน ฿${money(-net)}</span>`;

    const { value: res } = await Swal.fire({
      width: 440,
      html: `
        <div style="text-align:left;">
          <div style="text-align:center;margin-bottom:14px;">
            <div style="font-size:12px;letter-spacing:1px;color:#d97706;font-weight:800;">CASH ADVANCE</div>
            <h3 style="margin:4px 0 2px;color:#1e293b;display:flex;align-items:center;justify-content:center;gap:6px;">
              <i class="material-icons-round" style="color:#d97706;">receipt_long</i> เบิกเงินล่วงหน้า</h3>
            <div style="font-weight:800;color:#334155;">${empName}</div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px 16px;margin-bottom:14px;">
            <div class="v95-wal-line"><span class="lbl"><i class="material-icons-round" style="font-size:16px;color:#16a34a;">savings</i> ค่าแรงสะสมเดือนนี้</span><span class="val" style="color:#16a34a;">฿${money(wageRem)}</span></div>
            <div class="v95-wal-line" style="border-top:1px dashed #e2e8f0;"><span class="lbl"><i class="material-icons-round" style="font-size:16px;color:#f59e0b;">account_balance_wallet</i> เบิกค้างอยู่</span><span class="val" style="color:#dc2626;">฿${money(debtRem)}</span></div>
            <div style="text-align:center;margin-top:8px;">${netChip}</div>
          </div>

          <label style="font-size:13px;font-weight:700;color:#475569;">ยอดที่ต้องการเบิก (฿)</label>
          <input type="number" id="v95-adv-amt" inputmode="numeric" min="1" placeholder="0"
            style="width:100%;box-sizing:border-box;font-size:28px;font-weight:900;text-align:center;color:#b45309;border:2px solid #fed7aa;border-radius:12px;padding:12px;margin-top:6px;outline:none;">
          <div class="v95-quick">
            <button type="button" onclick="window.__v95AddAmt(100)">+100</button>
            <button type="button" onclick="window.__v95AddAmt(500)">+500</button>
            <button type="button" onclick="window.__v95AddAmt(1000)">+1,000</button>
            <button type="button" class="clear" onclick="window.__v95AddAmt(0,true)">ล้าง</button>
          </div>

          <div id="v95-adv-preview" class="v95-warn ok" style="display:none;"></div>

          <label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-top:14px;">หมายเหตุ</label>
          <input type="text" id="v95-adv-reason" placeholder="เช่น เบิกค่ากับข้าว"
            style="width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;margin-top:4px;">

          ${isAdmin() ? `
          <label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-top:12px;">วันที่เบิก <span style="color:#d97706;">(แอดมินเลือกย้อนได้)</span></label>
          <input type="date" id="v95-adv-date" value="${dateKey(new Date())}"
            style="width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;margin-top:4px;font-weight:700;">
          ` : ''}

          <label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-top:12px;">ช่องทางจ่าย</label>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button type="button" id="v95-m-cash" class="v95-pay-method active" onclick="window.__v95Method('เงินสด')"
              style="flex:1;border:2px solid #d97706;background:#fffbeb;color:#b45309;border-radius:10px;padding:10px;font-weight:800;cursor:pointer;">เงินสด</button>
            <button type="button" id="v95-m-trans" class="v95-pay-method" onclick="window.__v95Method('โอนเงิน')"
              style="flex:1;border:2px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:10px;padding:10px;font-weight:800;cursor:pointer;">โอนเงิน</button>
          </div>
          <input type="hidden" id="v95-m-val" value="เงินสด">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันเบิก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#d97706',
      didOpen: () => {
        // helpers ภายใน popup
        window.__v95AddAmt = (v, clear) => {
          const el = document.getElementById('v95-adv-amt');
          el.value = clear ? '' : (num(el.value) + v);
          window.__v95Preview();
        };
        window.__v95Method = (m) => {
          document.getElementById('v95-m-val').value = m;
          const c = document.getElementById('v95-m-cash'), t = document.getElementById('v95-m-trans');
          const on = (b) => { b.style.borderColor = '#d97706'; b.style.background = '#fffbeb'; b.style.color = '#b45309'; };
          const off = (b) => { b.style.borderColor = '#e2e8f0'; b.style.background = '#f8fafc'; b.style.color = '#64748b'; };
          if (m === 'เงินสด') { on(c); off(t); } else { on(t); off(c); }
        };
        window.__v95Preview = () => {
          const amt = num(document.getElementById('v95-adv-amt').value);
          const box = document.getElementById('v95-adv-preview');
          if (!amt) { box.style.display = 'none'; return; }
          const after = net - amt; // ยอดสุทธิหลังเบิก
          box.style.display = 'flex';
          if (after >= 0) {
            box.className = 'v95-warn ok';
            box.innerHTML = `<i class="material-icons-round" style="font-size:18px;">check_circle</i>
              <span>หลังเบิก ร้านยังค้างจ่ายอีก <strong>฿${money(after)}</strong></span>`;
          } else {
            box.className = 'v95-warn over';
            box.innerHTML = `<i class="material-icons-round" style="font-size:18px;">warning</i>
              <span>เบิกเกินค่าแรงสะสม! หลังเบิก <strong>พนักงานจะค้างร้าน ฿${money(-after)}</strong> (ยกไปหักเดือนถัดไป)</span>`;
          }
        };
        document.getElementById('v95-adv-amt').addEventListener('input', window.__v95Preview);
        document.getElementById('v95-adv-amt').focus();
      },
      preConfirm: () => {
        const amt = num(document.getElementById('v95-adv-amt').value);
        if (!amt || amt <= 0) { Swal.showValidationMessage('กรุณาระบุยอดเบิก'); return false; }
        // วันที่: แอดมินเลือกย้อนได้ / พนักงานเป็นวันนี้เสมอ
        const dEl = document.getElementById('v95-adv-date');
        const dateVal = (isAdmin() && dEl && dEl.value) ? dEl.value : null;
        return {
          amt,
          method: document.getElementById('v95-m-val').value,
          reason: document.getElementById('v95-adv-reason').value.trim(),
          dateVal,
        };
      },
    });

    if (!res) return;
    const { amt, method, reason, dateVal } = res;
    // ISO: ถ้าแอดมินเลือกวัน ใช้วันนั้น (เที่ยง) ไม่งั้นเวลาปัจจุบัน
    const advISO = dateVal ? new Date(dateVal + 'T12:00:00').toISOString() : new Date().toISOString();

    const save = async (denom = null) => {
      const { data: ins, error } = await db.from(ADV_TABLE).insert({
        employee_id: empId, amount: amt, reason,
        date: advISO, status: 'อนุมัติ',
        approved_by: (typeof USER !== 'undefined' && USER) ? USER.username : null,
      }).select().single();
      if (error) { notify('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }

      if (method === 'เงินสด' && typeof recordCashTx === 'function') {
        try {
          const { data: sess } = await db.from('cash_session').select('id').eq('status', 'open').limit(1).maybeSingle();
          if (sess) await recordCashTx({ sessionId: sess.id, type: 'เบิกเงิน', direction: 'out', amount: amt, netAmount: amt, refId: ins.id, denominations: denom, note: `${empName} ${reason}`.trim() });
        } catch (_) {}
      }
      if (typeof logActivity === 'function') logActivity('เบิกเงิน', `${empName} ฿${money(amt)} ${reason}`.trim());
      Swal.fire({ icon: 'success', title: 'บันทึกการเบิกแล้ว', text: `${empName} ฿${money(amt)}`, timer: 1600, showConfirmButton: false });
      if (typeof renderAttendance === 'function') renderAttendance();
    };

    if (method === 'เงินสด') {
      try { if (typeof assertCashEnough === 'function') await assertCashEnough(amt, 'เบิกเงิน'); }
      catch (e) { Swal.fire({ icon: 'error', title: 'เงินสดไม่พอ', text: e.message }); return; }
      if (typeof window.v26StartCashWizard === 'function') {
        await window.v26StartCashWizard({ title: 'จ่ายเงินสดเบิกล่วงหน้า', desc: 'นับเงินจ่ายให้พนักงาน', targetAmount: amt, mustBeExact: true, onConfirm: save });
      } else { await save(); }
    } else {
      await save();
    }
  };

  // ════════════════════════════════════════
  // 2) หน้าจ่ายเงินเดือน — ตารางรายเดือนทุกคนในแผ่นเดียว
  // ════════════════════════════════════════
  const V95_SYM = {
    'มา': { s: '✓', c: '#16a34a' },
    'มาสาย': { s: '▲', c: '#d97706' },
    'ครึ่งวัน': { s: '◐', c: '#0891b2' },
    'มาครึ่งวัน': { s: '◐', c: '#0891b2' },
    'ลา': { s: '○', c: '#7c3aed' },
    'ขาด': { s: '✗', c: '#dc2626' },
  };

  async function renderPayrollWallet() {
    const sec = document.getElementById('att-body') || document.getElementById('page-att');
    if (!sec) return;
    sec.innerHTML = '<div style="padding:48px;text-align:center;color:#64748b;font-weight:800">กำลังโหลดตารางเงินเดือน...</div>';

    let wallets;
    try { wallets = await computeWallets(v95View); }
    catch (e) { notify('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error'); return; }
    window._v95Pay = wallets;

    const ml = v95View.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    const daysInMonth = wallets[0] ? wallets[0].daysInMonth : new Date(v95View.getFullYear(), v95View.getMonth() + 1, 0).getDate();
    const y = v95View.getFullYear(), mo = v95View.getMonth();
    // Option C: ร้านค้างจ่าย = ค่าแรงที่ต้องจ่ายเต็ม (ไม่หักหนี้อัตโนมัติ), หนี้เดิมแยกต่างหาก
    const totalOwed = wallets.reduce((s, w) => s + Math.max(0, w.wageRemaining), 0);
    const totalDebt = wallets.reduce((s, w) => s + Math.max(0, w.carriedDebt), 0); // หนี้เดิมยกมารวม (ไม่รวมเบิกเดือนนี้)
    const totalEarn = wallets.reduce((s, w) => s + w.earn, 0);
    const totalAdv = wallets.reduce((s, w) => s + w.monthAdvSum, 0);
    const unpaidCount = wallets.filter(w => w.wageRemaining > 0.01).length;
    const canBack = isAdmin();

    // หัวคอลัมน์รายวัน
    let dayHead = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const wkd = new Date(y, mo, d).getDay();
      const wk = (wkd === 0 || wkd === 6) ? ' v95-wk' : '';
      dayHead += `<th class="v95-day${wk}">${d}</th>`;
    }

    const totalNetRow = wallets.reduce((s, w) => s + Math.max(0, w.wageRemaining), 0); // ต้องจ่ายเต็ม

    sec.innerHTML = `
      <div style="max-width:100%;margin:0 auto;padding:0 8px 40px;">
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:18px;padding:18px 22px;color:#fff;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <button onclick="renderAttendance()" style="background:rgba(255,255,255,.12);border:none;color:#fff;width:40px;height:40px;border-radius:10px;cursor:pointer;"><i class="material-icons-round">arrow_back</i></button>
              <div>
                <h2 style="margin:0;display:flex;align-items:center;gap:8px;font-size:22px;"><i class="material-icons-round">table_chart</i> ตารางเงินเดือน</h2>
                <div style="opacity:.8;font-weight:600;font-size:13px;margin-top:2px;">รายงานทั้งเดือน · ยังไม่จ่าย ${unpaidCount} คน</div>
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <div style="background:rgba(255,255,255,.1);border-radius:12px;padding:10px 16px;"><div style="font-size:11px;opacity:.8;">ร้านค้างจ่ายรวม</div><div style="font-size:20px;font-weight:900;color:#86efac;">฿${money(totalOwed)}</div></div>
              ${totalDebt > 0 ? `<div style="background:rgba(255,255,255,.1);border-radius:12px;padding:10px 16px;"><div style="font-size:11px;opacity:.8;">หนี้เดิมยกมารวม</div><div style="font-size:20px;font-weight:900;color:#fca5a5;">฿${money(totalDebt)}</div></div>` : ''}
            </div>
          </div>
        </div>

        <div class="v95-toolbar">
          <div class="v95-month-nav">
            <button onclick="window.v95ShiftMonth(-1)" ${canBack ? '' : 'disabled title="ย้อนหลังเฉพาะแอดมิน"'}>‹</button>
            <span class="lbl">${ml}</span>
            <button onclick="window.v95ShiftMonth(1)" ${isCurrentMonth(v95View) ? 'disabled' : ''}>›</button>
          </div>
          <div class="v95-search">
            <i class="material-icons-round">search</i>
            <input type="text" id="v95-search-in" placeholder="ค้นหาชื่อพนักงาน..." oninput="window.v95FilterRows(this.value)">
          </div>
          <button class="v95-tool-btn xls" onclick="window.v95ExportExcel()"><i class="material-icons-round" style="font-size:18px;">grid_on</i> Excel</button>
          ${!canBack ? `<span class="v95-admin-note">ดูได้เฉพาะเดือนปัจจุบัน · ย้อนหลังต้องเป็นแอดมิน</span>` : ''}
        </div>

        <div id="v95-grid">
          ${isMobile() ? `
            <div id="v95-tbody">${wallets.map(w => payMobileCard(w)).join('')}</div>
          ` : `
          <div class="v95-table-wrap">
            <table class="v95-tbl">
              <thead>
                <tr>
                  <th class="v95-name">พนักงาน</th>
                  ${dayHead}
                  <th class="v95-sum">วัน</th>
                  <th class="v95-sum">ค่าแรง</th>
                  <th class="v95-sum">เบิก</th>
                  <th class="v95-sum">ต้องจ่าย</th>
                </tr>
              </thead>
              <tbody id="v95-tbody">
                ${wallets.map(w => payRow(w, y, mo, daysInMonth)).join('')}
              </tbody>
              <tfoot>
                <tr class="v95-foot">
                  <td class="v95-name" style="background:#f8fafc;">รวมทั้งหมด</td>
                  <td colspan="${daysInMonth}" style="text-align:right;padding-right:12px;color:#94a3b8;">รวม ${wallets.length} คน</td>
                  <td class="v95-sum" style="background:#f8fafc;">—</td>
                  <td class="v95-sum" style="background:#f8fafc;color:#16a34a;">฿${money(totalEarn)}</td>
                  <td class="v95-sum" style="background:#f8fafc;color:#c2410c;">฿${money(totalAdv)}</td>
                  <td class="v95-sum" style="background:#f8fafc;color:${totalNetRow >= 0 ? '#059669' : '#dc2626'};">฿${money(totalNetRow)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style="font-size:12px;color:#94a3b8;margin-top:10px;display:flex;gap:14px;flex-wrap:wrap;">
            <span style="color:#16a34a;font-weight:800;">✓ มา</span>
            <span style="color:#d97706;font-weight:800;">▲ สาย</span>
            <span style="color:#0891b2;font-weight:800;">◐ ครึ่งวัน</span>
            <span style="color:#7c3aed;font-weight:800;">○ ลา</span>
            <span style="color:#dc2626;font-weight:800;">✗ ขาด</span>
            <span style="color:#c2410c;font-weight:800;">ตัวเลขส้ม = ยอดเบิกวันนั้น </span>
            <span style="margin-left:auto;">แตะที่แถวเพื่อจ่ายเงินเดือน</span>
          </div>`}
        </div>
        <div id="v95-detail" style="display:none;margin-top:18px;"></div>
      </div>`;
  }
  // ── ล็อกให้ wallet เป็นหน้าจ่ายเงินเดือนเสมอ ──
  // โมดูลเก่า (เช่น v41-payroll-hotfix) จะ re-assign renderPayroll กลับด้วย
  // setTimeout หลายรอบในช่วง ~7 วินาทีแรก จึงต้องใช้ accessor + setter no-op
  // เพื่อ "เมิน" การยึดกลับนั้น แต่ยังให้ assignment ไม่ throw (โมดูลเก่าเป็น strict)
  (function lockPayroll() {
    ['renderPayroll', 'renderPayrollV26'].forEach(function (key) {
      try {
        Object.defineProperty(window, key, {
          configurable: true,
          get: function () { return renderPayrollWallet; },
          set: function () { /* ignore legacy reclaim */ },
        });
      } catch (_) {
        window[key] = renderPayrollWallet;
      }
    });
  })();

  function payRow(w, y, mo, daysInMonth) {
    const { emp, wd, earn, monthAdvSum, wageRemaining, debtRemaining, carriedDebt, hasPaid, fullySettled, dayStatus, dayAdv } = w;
    // Option C: ต้องจ่าย = ค่าแรงเต็ม (ไม่หักหนี้อัตโนมัติ) · หนี้เดิมแยกแสดง
    const payable = wageRemaining;
    const netColor = fullySettled ? '#059669' : '#94a3b8';
    // ไม่โชว์ "จ่าย ฿X" แล้ว (ซ้ำกับคอลัมน์ "ต้องจ่าย") — เหลือเฉพาะสถานะ
    const netText = fullySettled ? 'เคลียร์ครบ ✓'
      : (payable <= 0 && debtRemaining > 0 ? 'รอเก็บหนี้' : '');

    let days = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const wkd = new Date(y, mo, d).getDay();
      const wk = (wkd === 0 || wkd === 6) ? ' wk' : '';
      const st = dayStatus[d];
      const sym = st && V95_SYM[st] ? `<span class="sym" style="color:${V95_SYM[st].c};">${V95_SYM[st].s}</span>` : `<span class="sym" style="color:#cbd5e1;">·</span>`;
      const adv = dayAdv[d] ? `<span class="adv" title="เบิก ฿${money(dayAdv[d])}">${money(dayAdv[d])}</span>` : '';
      days += `<td class="v95-day${wk}">${sym}${adv}</td>`;
    }

    const safeName = `${emp.name} ${emp.lastname || ''}`.trim();
    return `
      <tr class="${fullySettled ? 'paid-row' : ''}" data-name="${safeName.toLowerCase()}" onclick="window.v95ShowDetail('${emp.id}')">
        <td class="v95-name">
          <div class="v95-nm-top">${safeName} ${hasPaid ? '<span style="color:#10b981;font-size:11px;">●</span>' : ''}</div>
          <div class="v95-nm-sub">${emp.pay_type || ''} · ${wd} วัน</div>
          ${netText ? `<div class="v95-nm-net" style="color:${netColor};">${netText}</div>` : ''}
          ${carriedDebt > 0 ? `<div style="font-size:11px;font-weight:800;color:#d97706;">หนี้เดิม ฿${money(carriedDebt)}</div>` : ''}
        </td>
        ${days}
        <td class="v95-sum" style="color:#475569;">${wd}</td>
        <td class="v95-sum" style="color:#16a34a;">฿${money(earn)}</td>
        <td class="v95-sum" style="color:#c2410c;">฿${money(monthAdvSum)}</td>
        <td class="v95-sum" style="color:${netColor};">฿${money(payable)}</td>
      </tr>`;
  }

  function isMobile() { return window.innerWidth <= 768; }

  // ── การ์ดจ่ายเงินเดือนสำหรับมือถือ (ไม่เลื่อนซ้ายขวา · แตะเพื่อจ่าย) ──
  function payMobileCard(w) {
    const { emp, wd, wageRemaining, carriedDebt, monthAdvSum, hasPaid, fullySettled } = w;
    const payable = wageRemaining;
    const safeName = `${emp.name} ${emp.lastname || ''}`.trim();
    return `
      <div class="v95-mcard${fullySettled ? ' settled' : ''}" data-name="${safeName.toLowerCase()}" onclick="window.v95ShowDetail('${emp.id}')">
        <div class="v95-mc-head">
          <div class="v95-mc-av">${(emp.name || '?')[0]}</div>
          <div style="flex:1;min-width:0;">
            <div class="v95-mc-name">${safeName} ${hasPaid ? '<span style="color:#10b981;font-size:11px;">●</span>' : ''}</div>
            <div class="v95-mc-sub">${emp.pay_type || ''} · ${wd} วัน</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:#94a3b8;font-weight:700;">ต้องจ่าย</div>
            <div class="v95-mc-pay">฿${money(payable)}</div>
          </div>
        </div>
        <div class="v95-mc-foot">
          ${carriedDebt > 0 ? `<span class="v95-mc-chip debt">หนี้เดิม ฿${money(carriedDebt)}</span>` : ''}
          ${monthAdvSum > 0 ? `<span class="v95-mc-chip adv">เบิกเดือนนี้ ฿${money(monthAdvSum)}</span>` : ''}
          <span class="v95-mc-go">${fullySettled ? 'เคลียร์ครบ ✓' : 'แตะเพื่อจ่าย ›'}</span>
        </div>
      </div>`;
  }

  // ── ย้อน/เดินหน้าเดือน (ย้อนหลังเฉพาะแอดมิน, ไม่เกินเดือนปัจจุบัน) ──
  window.v95ShiftMonth = function (delta) {
    const target = new Date(v95View.getFullYear(), v95View.getMonth() + delta, 1);
    const cur = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    if (target > cur) return; // ห้ามเกินเดือนปัจจุบัน
    if (target < cur && !isAdmin()) { notify('ดูย้อนหลังได้เฉพาะแอดมิน', 'warning'); return; }
    v95View = target;
    renderPayrollWallet();
  };

  window.v95FilterRows = function (q) {
    const term = String(q || '').trim().toLowerCase();
    document.querySelectorAll('#v95-tbody tr, #v95-tbody .v95-mcard').forEach(tr => {
      const name = tr.getAttribute('data-name') || '';
      tr.style.display = (!term || name.includes(term)) ? '' : 'none';
    });
  };

  // สถานะ → สัญลักษณ์ + สี (ARGB) สำหรับ Excel
  function xlStatus(st) {
    switch (st) {
      case 'มา': return { sym: '✓', fill: 'FFD1FAE5', text: 'FF047857' };
      case 'มาสาย': return { sym: '▲', fill: 'FFFFEDD5', text: 'FFC2410C' };
      case 'ครึ่งวัน': case 'มาครึ่งวัน': return { sym: '◐', fill: 'FFE0F2FE', text: 'FF0369A1' };
      case 'ลา': return { sym: '○', fill: 'FFEDE9FE', text: 'FF6D28D9' };
      case 'ขาด': return { sym: '✗', fill: 'FFFEE2E2', text: 'FFB91C1C' };
      default: return { sym: '', fill: 'FFFFFFFF', text: 'FF94A3B8' };
    }
  }
  async function v95Shop() {
    try {
      const rc = (typeof getShopConfig === 'function') ? (await getShopConfig()) || {} : {};
      return rc.shop_name || 'หจก. เอส เค วัสดุ';
    } catch (_) { return 'หจก. เอส เค วัสดุ'; }
  }

  // ── ส่งออก/พิมพ์ "ตารางหน้านี้" เป็น Excel ──
  window.v95ExportExcel = async function () {
    if (!window.ExcelJS) { notify('โมดูล Excel ยังโหลดไม่พร้อม กรุณารีเฟรชแล้วลองใหม่', 'error'); return; }
    let wallets = window._v95Pay;
    try {
      if (!wallets || !wallets.length) wallets = await computeWallets(v95View);
    } catch (e) { notify('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error'); return; }
    if (!wallets || !wallets.length) { notify('ไม่มีข้อมูลพนักงาน', 'warning'); return; }

    notify('กำลังสร้าง Excel...', 'info');
    try {
      const shop = await v95Shop();
      const ml = v95View.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
      const y = v95View.getFullYear(), mo = v95View.getMonth();
      const days = wallets[0].daysInMonth;

      const wb = new ExcelJS.Workbook();
      wb.creator = 'SK POS';
      const ws = wb.addWorksheet('ตารางเงินเดือน', {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }],
        pageSetup: {
          paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
          horizontalCentered: true, margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
        },
      });

      // ชื่อ + วัน + (วันทำงาน, ค่าแรงจริง, หนี้เบิกยกมา, เบิกเดือนนี้, หักหนี้เบิก, รับจริง)
      const lastCol = 1 + days + 6;
      const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
      const cWage = () => colLetter(days + 3), cThis = () => colLetter(days + 5), cDeduct = () => colLetter(days + 6);

      // แถว 1: ชื่อร้าน
      ws.mergeCells(1, 1, 1, lastCol);
      const c1 = ws.getCell(1, 1); c1.value = shop;
      c1.font = { bold: true, size: 15 }; c1.alignment = { horizontal: 'center' };
      // แถว 2: หัวเรื่อง
      ws.mergeCells(2, 1, 2, lastCol);
      const c2 = ws.getCell(2, 1); c2.value = `ตารางเงินเดือน · เดือน ${ml}`;
      c2.font = { bold: true, size: 12, color: { argb: 'FF475569' } }; c2.alignment = { horizontal: 'center' };

      // แถว 3: หัวคอลัมน์
      const head = ['พนักงาน'];
      for (let d = 1; d <= days; d++) head.push(String(d));
      head.push('วันทำงาน', 'ค่าแรงจริง', 'หนี้เบิกยกมา', 'เบิกเดือนนี้', 'หักหนี้เบิก', 'พนักงานรับจริง');
      const hr = ws.getRow(3); hr.values = head; hr.height = 28;
      hr.eachCell((cell, col) => {
        cell.font = { bold: true, size: 9, color: { argb: col === days + 6 ? 'FFB45309' : col === days + 7 ? 'FF047857' : 'FF475569' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col === days + 6 ? 'FFFEF3C7' : col === days + 7 ? 'FFD1FAE5' : 'FFF1F5F9' } };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
      });

      // ความกว้างคอลัมน์
      ws.getColumn(1).width = 22;
      for (let d = 1; d <= days; d++) ws.getColumn(1 + d).width = 5.2;
      [8, 12, 13, 12, 12, 14].forEach((wd, i) => { ws.getColumn(days + 2 + i).width = wd; });

      // แถวพนักงาน
      let r = 4;
      wallets.forEach(w => {
        const row = ws.getRow(r);
        row.height = 26;
        const nameCell = row.getCell(1);
        nameCell.value = `${w.emp.name} ${w.emp.lastname || ''}`.trim() + `\n${w.emp.pay_type || ''} · ${w.wd} วัน`;
        nameCell.font = { bold: true, size: 10 };
        nameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        for (let d = 1; d <= days; d++) {
          const cell = row.getCell(1 + d);
          const meta = xlStatus(w.dayStatus[d]);
          const adv = w.dayAdv[d];
          cell.value = meta.sym + (adv ? `\n${xlAdv(adv)}` : '');
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.font = { size: 9, bold: true, color: { argb: adv ? 'FFC2410C' : meta.text } };
          if (w.dayStatus[d]) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.fill } };
        }

        // คอลัมน์สรุป + สูตร
        const put = (col, val, fmt, color, fill) => {
          const cell = row.getCell(col);
          cell.value = val;
          if (fmt) cell.numFmt = fmt;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { bold: true, size: 10, color: { argb: color || 'FF475569' } };
          if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
          return cell;
        };
        put(days + 2, w.wd, '0', 'FF475569');                              // วันทำงาน
        put(days + 3, w.earn, '#,##0', 'FF16A34A');                        // ค่าแรงจริง
        put(days + 4, w.carriedDebt, '#,##0', 'FFB45309');                 // หนี้เบิกยกมา
        put(days + 5, w.monthAdvSum, '#,##0', 'FFC2410C');                 // เบิกเดือนนี้
        // หักหนี้เบิก — ช่องให้กรอกเอง (เว้นว่าง, ไฮไลต์เหลือง)
        const inp = put(days + 6, null, '#,##0', 'FFB45309', 'FFFEF9C3');
        inp.border = { outline: { style: 'thin', color: { argb: 'FFFCD34D' } } };
        // พนักงานรับจริง — สูตร: ค่าแรงจริง − เบิกเดือนนี้ − หักหนี้เบิก
        const net = put(days + 7, { formula: `${cWage()}${r}-${cThis()}${r}-${cDeduct()}${r}` }, '#,##0', 'FF047857', 'FFD1FAE5');
        net.font = { bold: true, size: 11, color: { argb: 'FF047857' } };
        r++;
      });

      // แถวรวม (ใช้สูตร SUM ทุกช่องเงิน)
      const firstRow = 4, lastRow = r - 1;
      const tr = ws.getRow(r); tr.height = 22;
      tr.getCell(1).value = 'รวมทั้งหมด';
      tr.getCell(1).font = { bold: true, size: 11 };
      tr.getCell(1).alignment = { vertical: 'middle' };
      [days + 3, days + 4, days + 5, days + 6, days + 7].forEach((c) => {
        const L = colLetter(c);
        const cell = tr.getCell(c);
        cell.value = { formula: `SUM(${L}${firstRow}:${L}${lastRow})` };
        cell.numFmt = '#,##0';
        cell.font = { bold: true, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      tr.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; cell.border = { top: { style: 'medium', color: { argb: 'FFCBD5E1' } } }; });

      // คำอธิบายใต้ตาราง
      const noteRow = ws.getRow(r + 2);
      noteRow.getCell(1).value = 'วิธีใช้: กรอกตัวเลขในช่อง "หักหนี้เบิก" (สีเหลือง) แล้วช่อง "พนักงานรับจริง" จะคำนวณให้อัตโนมัติ → นำยอดไปคีย์ในระบบ';
      ws.mergeCells(r + 2, 1, r + 2, lastCol);
      noteRow.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF92400E' } };

      // เส้นตารางทุกช่อง (หัวตาราง → แถวรวม) ให้สวยงาม
      const thin = { style: 'thin', color: { argb: 'FFD9E1EC' } };
      const med = { style: 'medium', color: { argb: 'FFB8C4D4' } };
      for (let rr = 3; rr <= r; rr++) {
        for (let cc = 1; cc <= lastCol; cc++) {
          ws.getRow(rr).getCell(cc).border = {
            top: rr === r ? med : thin,
            bottom: rr === 3 ? med : thin,
            left: cc === 1 ? med : thin,
            right: cc === lastCol ? med : thin,
          };
        }
      }

      ws.pageSetup.printArea = `A1:${colLetter(lastCol)}${r + 2}`;

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ตารางเงินเดือน_${ml.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify('ดาวน์โหลด Excel สำเร็จ', 'success');
    } catch (err) {
      console.error('[v95] excel:', err);
      notify('สร้าง Excel ไม่สำเร็จ: ' + (err?.message || err), 'error');
    }
  };

  window.v95ShowDetail = function (eid) {
    const w = (window._v95Pay || []).find(x => String(x.emp.id) === String(eid));
    const wrap = document.getElementById('v95-detail');
    const grid = document.getElementById('v95-grid');
    if (!w || !wrap || !grid) return;
    grid.style.display = 'none';
    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const { emp, wd, earn, td, wageRemaining, debtRemaining, netPayable, advances, pastPays, fullySettled } = w;

    if (fullySettled) {
      const totalPaid = pastPays.reduce((s, p) => s + num(p.net_paid), 0);
      const lastPd = pastPays[pastPays.length - 1];
      wrap.innerHTML = `
        ${backBtn()}
        <div class="v95-paycard paid" style="cursor:default;text-align:center;padding:40px 20px;max-width:560px;margin:0 auto;">
          <i class="material-icons-round" style="font-size:64px;color:#10b981;">task_alt</i>
          <h2 style="color:#059669;margin:12px 0 6px;">เคลียร์ครบแล้ว</h2>
          <p style="color:#475569;">${emp.name} · ${lastPd ? new Date(lastPd.paid_date).toLocaleString('th-TH') : 'ไม่มียอดค้าง'}</p>
          ${totalPaid > 0 ? `<div style="font-size:30px;font-weight:900;color:#059669;margin-top:10px;">฿${money(totalPaid)}</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:6px;">รวมรับเข้ากระเป๋าเดือนนี้</div>` : ''}
          <div style="margin-top:20px;text-align:left;">${ledgerHTML(advances, pastPays)}</div>
        </div>`;
      return;
    }

    // ── Option C: จ่ายค่าแรงเต็มเป็นค่าเริ่มต้น + เลือกหักหนี้เองตอนจ่าย ──
    const hasWage = wageRemaining > 0.009;
    const summaryRows = `
      <div class="v95-wal-line"><span class="lbl">ค่าแรงเดือนนี้ (${wd} วัน)</span><span class="val" style="color:#16a34a;">+฿${money(earn + td)}</span></div>
      ${td > 0 ? `<div class="v95-wal-line"><span class="lbl">หักสาย/ขาด</span><span class="val" style="color:#dc2626;">−฿${money(td)}</span></div>` : ''}
      <div class="v95-wal-line" style="border-top:1px dashed #e2e8f0;"><span class="lbl">ค่าแรงสุทธิ (จ่ายได้)</span><span class="val" style="color:#059669;">฿${money(wageRemaining)}</span></div>
      ${debtRemaining > 0 ? `<div class="v95-wal-line"><span class="lbl"><i class="material-icons-round" style="font-size:15px;color:#d97706;">account_balance_wallet</i> หนี้เดิม/เบิกคงค้าง</span><span class="val" style="color:#d97706;">฿${money(debtRemaining)}</span></div>` : ''}
    `;

    wrap.innerHTML = `
      ${backBtn()}
      <div class="v95-paycard" style="cursor:default;max-width:520px;margin:0 auto;padding:22px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
          <div style="width:54px;height:54px;border-radius:16px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);color:#475569;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;">${(emp.name || '?')[0]}</div>
          <div><div style="font-weight:900;font-size:19px;color:#1e293b;">${emp.name} ${emp.lastname || ''}</div>
            <div style="font-size:13px;color:#64748b;font-weight:600;">${emp.position || 'พนักงาน'} · ${emp.pay_type || ''}</div></div>
        </div>

        <div style="background:#f8fafc;border:1px solid #eef2f7;border-radius:16px;padding:8px 18px;">
          ${summaryRows}
        </div>

        ${debtRemaining > 0 ? `
        <div style="margin-top:14px;background:#fffbeb;border:1.5px solid #fde68a;border-radius:16px;padding:14px 16px;">
          <label style="font-size:13px;font-weight:800;color:#b45309;display:flex;align-items:center;gap:6px;"><i class="material-icons-round" style="font-size:18px;">account_balance_wallet</i> หักหนี้เดิม/เบิก ครั้งนี้</label>
          <div style="font-size:11.5px;color:#92400e;font-weight:600;margin-top:2px;">ใส่ถ้าต้องการหัก · คงค้าง ฿${money(debtRemaining)} (ไม่ใส่ = ไม่หัก)</div>
          <input type="number" id="v95-d-${eid}" value="0" min="0" max="${Math.min(debtRemaining, wageRemaining)}" oninput="window.v95RecalcPay('${eid}')"
            style="width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid #fcd34d;border-radius:12px;padding:12px;font-size:22px;font-weight:900;text-align:right;color:#b45309;outline:none;">
          <div id="v95-dhint-${eid}" style="font-size:12px;color:#92400e;margin-top:7px;text-align:right;font-weight:700;"></div>
        </div>` : `<input type="hidden" id="v95-d-${eid}" value="0">`}

        <div style="margin-top:16px;">
          <div style="font-size:13px;font-weight:800;color:#475569;margin-bottom:8px;">เลือกวิธีจ่าย</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button type="button" class="v95-method on" id="v95-mc-${eid}" onclick="window.v95SetPayMethod('${eid}','เงินสด')"><span class="mi">💵</span> เงินสด</button>
            <button type="button" class="v95-method" id="v95-mt-${eid}" onclick="window.v95SetPayMethod('${eid}','โอนเงิน')"><span class="mi">🏦</span> โอนเงิน</button>
          </div>
          <input type="hidden" id="v95-m-${eid}" value="เงินสด">
        </div>

        <button class="v95-big pay" id="v95-paybtn-${eid}" style="margin-top:16px;" onclick="window.v95PayMain('${eid}')" ${hasWage ? '' : 'disabled'}>
          <span id="v95-recvlbl-${eid}">${hasWage ? `จ่าย ฿${money(wageRemaining)}` : 'ไม่มีค่าแรงให้จ่ายเดือนนี้'}</span>
          <small id="v95-paysub-${eid}">${hasWage ? '💵 เงินสด — กดเพื่อนับเงิน' : (debtRemaining > 0 ? 'หนี้เดิมยกไปเดือนหน้า' : '')}</small>
        </button>

        <button class="v95-ghost" style="margin-top:10px;" onclick="window.v95ToggleAdjust('${eid}')">
          <i class="material-icons-round" style="font-size:16px;vertical-align:middle;">tune</i> หักประกันสังคม / อื่นๆ (ถ้ามี)</button>

        <div id="v95-adjbox-${eid}" style="display:none;margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px;">
          <div class="v95-adj">
            <div class="fld"><label>หักประกันสังคม (฿)</label>
              <input type="number" id="v95-s-${eid}" value="0" min="0" oninput="window.v95RecalcPay('${eid}')"></div>
            <div class="fld"><label>หักอื่นๆ (฿)</label>
              <input type="number" id="v95-o-${eid}" value="0" min="0" oninput="window.v95RecalcPay('${eid}')"></div>
            <div class="fld" style="grid-column:1/-1;"><label>หมายเหตุ</label>
              <input type="text" id="v95-n-${eid}" placeholder="หมายเหตุ..."></div>
          </div>
        </div>

        <div style="margin-top:18px;">${ledgerHTML(advances, pastPays)}</div>
      </div>`;

    window.v95RecalcPay(eid);
  };

  // ── เลือกวิธีจ่าย (เงินสด/โอนเงิน) ──
  window.v95SetPayMethod = function (eid, m) {
    const hid = document.getElementById(`v95-m-${eid}`);
    if (hid) hid.value = m;
    const c = document.getElementById(`v95-mc-${eid}`), t = document.getElementById(`v95-mt-${eid}`);
    if (c) c.className = 'v95-method' + (m === 'เงินสด' ? ' on' : '');
    if (t) t.className = 'v95-method' + (m === 'โอนเงิน' ? ' on transfer' : '');
    window.v95RecalcPay(eid);
  };

  // ── คำนวณยอดรับจริงสด (Option C): รับ = ค่าแรง − หักหนี้ − ปกส − อื่นๆ ──
  window.v95RecalcPay = function (eid) {
    const w = (window._v95Pay || []).find(x => String(x.emp.id) === String(eid));
    if (!w) return;
    const d = num(document.getElementById(`v95-d-${eid}`)?.value);
    const ss = num(document.getElementById(`v95-s-${eid}`)?.value);
    const o = num(document.getElementById(`v95-o-${eid}`)?.value);
    const method = document.getElementById(`v95-m-${eid}`)?.value || 'เงินสด';
    const recv = w.wageRemaining - d - ss - o;
    const lbl = document.getElementById(`v95-recvlbl-${eid}`);
    const sub = document.getElementById(`v95-paysub-${eid}`);
    const hint = document.getElementById(`v95-dhint-${eid}`);
    const btn = document.getElementById(`v95-paybtn-${eid}`);
    let err = '';
    if (d > w.debtRemaining + 0.009) err = `หักหนี้เกินยอดค้าง (฿${money(w.debtRemaining)})`;
    else if (d + ss + o > w.wageRemaining + 0.009) err = `รวมหักเกินค่าแรง (฿${money(w.wageRemaining)})`;
    if (hint) hint.innerHTML = err ? `<span style="color:#dc2626;">${err}</span>` : (d > 0 ? `หักหนี้ ฿${money(d)} · เหลือหนี้ ฿${money(w.debtRemaining - d)}` : `หักได้สูงสุด ฿${money(Math.min(w.debtRemaining, w.wageRemaining))}`);
    if (lbl) lbl.textContent = err ? 'ยอดไม่ถูกต้อง' : `จ่าย ฿${money(Math.max(0, recv))}`;
    if (sub) sub.textContent = err ? '' : (w.wageRemaining > 0 ? (method === 'เงินสด' ? '💵 เงินสด — กดเพื่อนับเงิน' : '🏦 โอนเงิน — กดเพื่อบันทึก') : '');
    if (btn) { const noPay = w.wageRemaining <= 0.009 && (d + ss + o) <= 0; btn.disabled = !!err || noPay; btn.className = 'v95-big ' + (method === 'โอนเงิน' ? 'pay transfer' : 'pay'); }
  };

  // ── ยืนยันจ่าย (Option C) ──
  window.v95PayMain = function (eid) {
    const w = (window._v95Pay || []).find(x => String(x.emp.id) === String(eid));
    if (!w) return;
    const d = num(document.getElementById(`v95-d-${eid}`)?.value);
    const ss = num(document.getElementById(`v95-s-${eid}`)?.value);
    const o = num(document.getElementById(`v95-o-${eid}`)?.value);
    const method = document.getElementById(`v95-m-${eid}`)?.value || 'เงินสด';
    const note = document.getElementById(`v95-n-${eid}`)?.value || '';
    const recv = Math.max(0, w.wageRemaining - d - ss - o);
    doPay(w, { recv, debt: d, ss, oth: o, method, note, oNote: '' });
  };

  function backBtn() {
    return `<button class="v95-ghost" style="width:auto;margin-bottom:16px;" onclick="window.v95HideDetail()">
      <i class="material-icons-round" style="font-size:16px;vertical-align:middle;">arrow_back</i> กลับหน้ารวม</button>`;
  }
  window.v95HideDetail = function () {
    const wrap = document.getElementById('v95-detail'), grid = document.getElementById('v95-grid');
    if (wrap) wrap.style.display = 'none';
    if (grid) grid.style.display = 'block';
  };

  window.v95ToggleAdjust = function (eid) {
    const box = document.getElementById(`v95-adjbox-${eid}`);
    if (box) { box.style.display = box.style.display === 'none' ? 'block' : 'none'; if (box.style.display === 'block') window.v95RecalcPay(eid); }
  };

  function ledgerHTML(advances, pastPays) {
    const items = [];
    (advances || []).forEach(a => items.push({ t: a.date, type: 'adv', txt: a.reason || 'เบิกเงิน', amt: -num(a.amount) }));
    (pastPays || []).forEach(p => items.push({ t: p.paid_date, type: 'pay', txt: 'จ่ายเงินเดือน' + (p.deduct_withdraw > 0 ? ` (หักหนี้ ฿${money(p.deduct_withdraw)})` : ''), amt: num(p.net_paid) }));
    items.sort((a, b) => new Date(b.t) - new Date(a.t));
    if (!items.length) return `<div style="font-size:13px;color:#94a3b8;text-align:center;">— ยังไม่มีรายการเบิก/จ่ายเดือนนี้ —</div>`;
    return `
      <div style="font-size:13px;font-weight:800;color:#475569;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <i class="material-icons-round" style="font-size:18px;">history</i> สมุดบัญชีรายคน</div>
      ${items.map(i => `
        <div class="v95-ledger-row ${i.type}">
          <span style="color:#475569;">${dDate(i.t)} · ${i.txt}</span>
          <strong style="color:${i.amt < 0 ? '#dc2626' : '#059669'};">${i.amt < 0 ? '−' : '+'}฿${money(Math.abs(i.amt))}</strong>
        </div>`).join('')}`;
  }

  // ── "จ่ายเต็มจำนวน" (อัตโนมัติ) ──
  window.v95PayFull = function (eid) {
    const w = (window._v95Pay || []).find(x => String(x.emp.id) === String(eid));
    if (!w) return;
    const settleDebt = Math.min(w.debtRemaining, w.wageRemaining);
    const recv = Math.max(0, w.wageRemaining - settleDebt);
    doPay(w, { recv, debt: settleDebt, ss: 0, oth: 0, method: 'เงินสด', note: '', oNote: '' });
  };

  // ── คำนวณยอดในโหมดปรับเอง ──
  window.v95CalcAdjust = function (eid) {
    const w = (window._v95Pay || []).find(x => String(x.emp.id) === String(eid));
    if (!w) return;
    const r = num(document.getElementById(`v95-r-${eid}`)?.value);
    const d = num(document.getElementById(`v95-d-${eid}`)?.value);
    const ss = num(document.getElementById(`v95-s-${eid}`)?.value);
    const o = num(document.getElementById(`v95-o-${eid}`)?.value);
    const tot = r + d + ss + o;
    const msg = document.getElementById(`v95-adjmsg-${eid}`);
    const btn = document.getElementById(`v95-adjbtn-${eid}`);
    let err = '';
    if (r < 0 || d < 0 || ss < 0 || o < 0) err = 'ห้ามกรอกค่าติดลบ';
    else if (d > w.debtRemaining) err = `หักหนี้เกินยอดค้าง (฿${money(w.debtRemaining)})`;
    else if (tot > w.wageRemaining) err = `รวมทุกช่อง ฿${money(tot)} เกินค่าแรงคงเหลือ ฿${money(w.wageRemaining)}`;
    if (msg) {
      msg.style.color = err ? '#dc2626' : '#15803d';
      msg.innerHTML = err
        ? `<i class="material-icons-round" style="font-size:16px;vertical-align:middle;">error</i> ${err}`
        : `รับจริง ฿${money(r)} · หักหนี้ ฿${money(d)} · เหลือค่าแรงไม่ตัด ฿${money(w.wageRemaining - tot)}`;
    }
    if (btn) btn.disabled = !!err;
  };

  window.v95DoPay = function (eid, fromAdjust) {
    const w = (window._v95Pay || []).find(x => String(x.emp.id) === String(eid));
    if (!w) return;
    if (fromAdjust) {
      doPay(w, {
        recv: num(document.getElementById(`v95-r-${eid}`)?.value),
        debt: num(document.getElementById(`v95-d-${eid}`)?.value),
        ss: num(document.getElementById(`v95-s-${eid}`)?.value),
        oth: num(document.getElementById(`v95-o-${eid}`)?.value),
        method: document.getElementById(`v95-m-${eid}`)?.value || 'เงินสด',
        note: document.getElementById(`v95-n-${eid}`)?.value || '',
        oNote: '',
      });
    }
  };

  // ── บันทึกการจ่ายจริง (ใช้ร่วมทั้ง 2 โหมด) ──
  async function doPay(w, p) {
    const { emp } = w;
    const { recv, debt, ss, oth, method, note, oNote } = p;
    const tot = recv + debt + ss + oth;
    if (tot > w.wageRemaining + 0.01) { notify('ยอดรวมเกินค่าแรงคงเหลือ!', 'error'); return; }
    if (debt > w.debtRemaining + 0.01) { notify('หักหนี้เกินยอดค้าง!', 'error'); return; }
    if (tot <= 0) { notify('ไม่มียอดให้บันทึก', 'error'); return; }

    const confirm = await Swal.fire({
      title: 'ยืนยันจ่ายเงินเดือน',
      html: `<div style="text-align:left;font-size:15px;line-height:1.7;">
        <strong>${emp.name} ${emp.lastname || ''}</strong><br>
        💵 รับจริง: <strong>฿${money(recv)}</strong> (${method})<br>
        ${debt > 0 ? `🟠 หักหนี้เบิก: ฿${money(debt)}<br>` : ''}
        ${ss > 0 ? `หักประกันสังคม: ฿${money(ss)}<br>` : ''}
        ${oth > 0 ? `หักอื่นๆ: ฿${money(oth)}<br>` : ''}
      </div>`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    if (method === 'เงินสด' && recv > 0 && typeof assertCashEnough === 'function') {
      try { await assertCashEnough(recv, 'จ่ายเงินเดือน'); }
      catch (e) { Swal.fire({ icon: 'error', title: 'เงินสดไม่พอ', text: e.message }); return; }
    }

    const persist = async (denom = null) => {
      const now = new Date();
      // ใช้เดือนที่กำลังดูอยู่ (รองรับย้อนจ่ายเดือนก่อน) ไม่ใช่เดือนปัจจุบันเสมอ
      const ms = w.ms || dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
      const noteParts = [];
      if (debt > 0) noteParts.push(`หักหนี้ ฿${money(debt)}`);
      if (ss > 0) noteParts.push(`ประกันสังคม ฿${money(ss)}`);
      if (oth > 0) noteParts.push(`อื่นๆ ฿${money(oth)}${oNote ? ' (' + oNote + ')' : ''}`);
      const extraMarker = ss + oth > 0 ? ` [payroll_extra_deduct=${ss + oth}]` : '';
      const noteFull = `${note} (จ่ายทาง ${method})${noteParts.length ? ' [' + noteParts.join(', ') + ']' : ''}${extraMarker}`.trim();

      // merge-or-insert: เดือนละ 1 แถวต่อคน (สะสมยอด) — ตรงกับ v33
      // ตาราง 'จ่ายเงินเดือน' ไม่มีคอลัมน์ deduct_ss/deduct_other → เก็บใน note
      let pIns;
      const { data: existing } = await db.from(PAY_TABLE)
        .select('*').eq('employee_id', emp.id).eq('month', ms).maybeSingle();
      if (existing) {
        const { data: upd, error: uErr } = await db.from(PAY_TABLE).update({
          working_days: w.wd, base_salary: w.earn,
          deduct_withdraw: num(existing.deduct_withdraw) + debt,
          deduct_absent: w.td,
          net_paid: num(existing.net_paid) + recv,
          paid_date: now.toISOString(),
          staff_name: (typeof USER !== 'undefined' && USER) ? USER.username : null,
          note: (existing.note ? existing.note + ' | ' : '') + noteFull,
        }).eq('id', existing.id).select().single();
        if (uErr) { notify('บันทึกไม่สำเร็จ: ' + uErr.message, 'error'); return; }
        pIns = upd;
      } else {
        const { data: ins, error: iErr } = await db.from(PAY_TABLE).insert({
          employee_id: emp.id, month: ms, working_days: w.wd, base_salary: w.earn,
          deduct_withdraw: debt, deduct_absent: w.td,
          bonus: 0, net_paid: recv, paid_date: now.toISOString(),
          staff_name: (typeof USER !== 'undefined' && USER) ? USER.username : null, note: noteFull,
        }).select().single();
        if (iErr) { notify('บันทึกไม่สำเร็จ: ' + iErr.message, 'error'); return; }
        pIns = ins;
      }

      if (method === 'เงินสด' && recv > 0 && typeof recordCashTx === 'function') {
        try {
          const { data: sess } = await db.from('cash_session').select('id').eq('status', 'open').limit(1).maybeSingle();
          if (sess) await recordCashTx({ sessionId: sess.id, type: 'จ่ายเงินเดือน', direction: 'out', amount: recv, netAmount: recv, refId: pIns?.id, denominations: denom, note: `${emp.name} ${note}`.trim() });
        } catch (_) {}
      }

      // ตัดหนี้เบิก FIFO (เก่าก่อน)
      if (debt > 0) {
        let rem = debt;
        for (const a of w.advances) {
          if (rem <= 0) break;
          if (num(a.amount) <= rem) { await db.from(ADV_TABLE).update({ status: 'ชำระแล้ว' }).eq('id', a.id); rem -= num(a.amount); }
          else { await db.from(ADV_TABLE).update({ amount: num(a.amount) - rem }).eq('id', a.id); rem = 0; }
        }
      }

      if (typeof logActivity === 'function') logActivity('จ่ายเงินเดือน', `${emp.name} ฿${money(recv)}`);
      Swal.fire({ icon: 'success', title: 'จ่ายเงินเดือนสำเร็จ', text: `${emp.name} รับ ฿${money(recv)}`, timer: 1700, showConfirmButton: false });
      renderPayrollWallet();
    };

    if (method === 'เงินสด' && recv > 0 && typeof window.v26StartCashWizard === 'function') {
      await window.v26StartCashWizard({ title: 'จ่ายเงินเดือน (นับเงิน)', desc: `จ่ายให้ ${emp.name}`, targetAmount: recv, mustBeExact: true, onConfirm: persist });
    } else {
      await persist();
    }
  }

  // ════════════════════════════════════════
  // เตือนจ่ายเงินเดือนทุกสิ้นเดือน (เด้งตอนเข้าระบบ)
  // ════════════════════════════════════════
  (function monthEndReminder() {
    function isLastDay() { const d = new Date(); return d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
    function monthKey() { const d = new Date(); return `v95_payday_reminder_${d.getFullYear()}_${d.getMonth() + 1}`; }
    function loggedIn() { const a = document.getElementById('app-layout'); return a && !a.classList.contains('hidden'); }

    async function showReminder() {
      if (typeof Swal === 'undefined') return;
      let unpaid = 0;
      try {
        const ws = await computeWallets(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        unpaid = ws.filter(w => !w.fullySettled).length;
      } catch (_) {}
      const ml = new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
      const r = await Swal.fire({
        width: 580,
        background: 'linear-gradient(135deg,#7c2d12 0%,#b45309 55%,#d97706 100%)',
        color: '#fff',
        showCancelButton: true,
        confirmButtonText: '💰 ไปจ่ายเงินเดือน',
        cancelButtonText: 'ไว้ทีหลัง',
        confirmButtonColor: '#fff',
        cancelButtonColor: 'rgba(255,255,255,.18)',
        customClass: { confirmButton: 'v95-reminder-confirm' },
        html: `
          <div style="padding:14px 6px;text-align:center;">
            <div style="font-size:64px;line-height:1;margin-bottom:8px;">🗓️</div>
            <div style="font-size:13px;letter-spacing:2px;font-weight:800;opacity:.9;">PAYDAY · ${ml}</div>
            <h1 style="margin:8px 0 6px;font-size:34px;font-weight:950;line-height:1.1;">ถึงกำหนดจ่ายเงินเดือน</h1>
            <p style="font-size:17px;font-weight:600;opacity:.95;margin:0 0 14px;">วันนี้เป็น<strong>วันสิ้นเดือน</strong> — กรุณาจ่ายเงินเดือนพนักงาน<br><strong>ภายในวันนี้</strong></p>
            ${unpaid > 0 ? `<div style="display:inline-block;background:rgba(0,0,0,.22);border-radius:999px;padding:10px 22px;font-size:18px;font-weight:900;">ยังไม่จ่าย ${unpaid} คน</div>` : `<div style="display:inline-block;background:rgba(255,255,255,.2);border-radius:999px;padding:10px 22px;font-size:16px;font-weight:800;">✓ จ่ายครบทุกคนแล้ว</div>`}
          </div>`,
      });
      try { localStorage.setItem(monthKey(), '1'); } catch (_) {}
      if (r.isConfirmed) {
        try { if (typeof window.go === 'function') window.go('att'); } catch (_) {}
        setTimeout(() => { try { if (typeof window.v96ShowTab === 'function') window.v96ShowTab('payroll'); else if (typeof window.renderPayrollV26 === 'function') window.renderPayrollV26(); } catch (_) {} }, 400);
      }
    }

    // style ปุ่มยืนยันให้เด่น
    const st = document.createElement('style');
    st.textContent = `.v95-reminder-confirm{color:#b45309!important;font-weight:900!important;font-size:17px!important;padding:12px 26px!important;border-radius:12px!important;}`;
    document.head.appendChild(st);

    const iv = setInterval(() => {
      if (!isLastDay()) return;
      if (!loggedIn()) return;
      try { if (localStorage.getItem(monthKey())) { clearInterval(iv); return; } } catch (_) {}
      clearInterval(iv);
      showReminder();
    }, 3000);
  })();

  console.log('[v95] payroll-wallet loaded');
})();
