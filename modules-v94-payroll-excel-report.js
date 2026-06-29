/* ════════════════════════════════════════════════════════════════════
   modules-v94-payroll-excel-report.js
   ─────────────────────────────────────────────────────────────────────
   ยกเครื่องปุ่ม "ส่งออก CSV" ของหน้าพนักงาน/ลงเวลา ให้เป็นรายงาน Excel (.xlsx)
   ที่จัดรูปแบบสวยงาม พิมพ์ลง A4 ได้พอดี และมีหัวกระดาษชื่อ หจก. ทุกแผ่น

   ประกอบด้วย
   1) ชีต "สรุปจ่ายเงินเดือน"  – ตารางสรุปทุกคน + ช่อง "ยอดสุทธิ" เป็น "สูตร" แก้ไขได้
   2) ชีตปฏิทินรายคน           – ลงเวลาแบบปฏิทินจริง ใช้สัญลักษณ์ + สีแทนตัวเลขวัน

   สูตรยอดสุทธิที่ต้องจ่าย = ค่าจ้างรวม − หักสาย/ขาด − ประกันสังคม − หักอื่นๆ − เบิกเดือนนี้
   • "หนี้เบิกยกมา" คำนวณอัตโนมัติจากระบบ แสดงเพื่ออ้างอิง (ไม่หักให้อัตโนมัติ)
   • ช่องยอดสุทธิเป็นสูตรสดใน Excel ผู้ใช้พิมพ์ตัวเลขทับ หรือแก้สูตรได้เสมอ
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ATT_TABLE = 'เช็คชื่อ';
  const ADV_TABLE = 'เบิกเงิน';
  const PAY_TABLE = 'จ่ายเงินเดือน';
  const DEFAULT_SHOP = 'หจก. เอส เค วัสดุ';

  /* ───────────── helpers ───────────── */
  function n(v) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function r2(v) { return Math.round((n(v) + Number.EPSILON) * 100) / 100; }
  function fmt(v) { return n(v).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function notify(msg, type) { if (typeof toast === 'function') toast(msg, type || 'info'); else console.log(msg); }

  function localDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function safeName(v) {
    return String(v || 'export').replace(/[\\/:*?"<>|\[\]]+/g, '-').replace(/\s+/g, '_').slice(0, 26);
  }
  function localDateKeyFromValue(value) {
    if (!value) return '';
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? raw.slice(0, 10) : localDateKey(d);
  }
  function attDateKey(row) {
    return localDateKeyFromValue(row && row.date);
  }
  function normStatus(status) {
    const st = String(status || '').trim();
    return st === 'มาครึ่งวัน' ? 'ครึ่งวัน' : st;
  }
  function isWorkStatus(status) {
    const st = normStatus(status);
    return !!st && st !== 'ขาด' && st !== 'ลา';
  }
  function rowStamp(row, fallback) {
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
      const next = Object.assign({}, row, { __dateKey: day, __rowStamp: rowStamp(row, index) });
      const old = map.get(key);
      if (!old || next.__rowStamp >= old.__rowStamp) map.set(key, next);
    });
    return Array.from(map.values());
  }

  // ค่าสี/สัญลักษณ์ของแต่ละสถานะ (ARGB ไม่มี #)
  function statusMeta(status) {
    switch (String(status || '').trim()) {
      case 'มา': return { sym: '✓', label: 'มา', fill: 'FFD1FAE5', text: 'FF047857', pill: 'FFA7F3D0' };
      case 'มาสาย': return { sym: '▲', label: 'สาย', fill: 'FFFFEDD5', text: 'FFC2410C', pill: 'FFFED7AA' };
      case 'ครึ่งวัน':
      case 'มาครึ่งวัน': return { sym: '◐', label: 'ครึ่งวัน', fill: 'FFE0F2FE', text: 'FF0369A1', pill: 'FFBAE6FD' };
      case 'ลา': return { sym: '○', label: 'ลา', fill: 'FFEDE9FE', text: 'FF6D28D9', pill: 'FFDDD6FE' };
      case 'ขาด': return { sym: '✗', label: 'ขาด', fill: 'FFFEE2E2', text: 'FFB91C1C', pill: 'FFFECACA' };
      default: return { sym: '·', label: '', fill: 'FFF8FAFC', text: 'FF94A3B8', pill: 'FFE2E8F0' };
    }
  }

  async function getShop() {
    let rc = {};
    try { rc = (typeof getShopConfig === 'function') ? (await getShopConfig()) || {} : {}; } catch (_) {}
    return {
      name: rc.shop_name || DEFAULT_SHOP,
      nameEn: rc.shop_name_en || '',
      addr: rc.address || '',
      phone: rc.phone || '',
    };
  }

  async function getEmployees() {
    let rows = [];
    try { rows = (typeof loadEmployees === 'function') ? (await loadEmployees()) || [] : []; }
    catch (_) { rows = []; }
    return rows.filter(e => e.status === 'ทำงาน');
  }

  /* ───────────── ดึง + คำนวณข้อมูลทั้งเดือน ───────────── */
  async function gatherData(year, month /* 1-12 */) {
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const meDate = new Date(year, month, 0);          // วันสุดท้ายของเดือน
    const me = localDateKey(meDate);
    const monthLabel = new Date(year, month - 1, 1)
      .toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

    const emps = await getEmployees();

    const [attRes, advRes, payRes] = await Promise.all([
      db.from(ATT_TABLE).select('*').gte('date', ms).lte('date', me),
      // ดึงเบิกทั้งหมดตั้งแต่อดีตจนถึงสิ้นเดือนนี้ เพื่อแยก "ยกมา" กับ "เดือนนี้"
      db.from(ADV_TABLE).select('*').eq('status', 'อนุมัติ').lte('date', me + 'T23:59:59'),
      // จ่ายเงินเดือนเดือนนี้ + ย้อนหลัง (เพื่อหักยอดเบิกที่ชำระคืนไปแล้วออกจากหนี้ยกมา)
      db.from(PAY_TABLE).select('*').lte('month', ms),
    ]);

    const rawAtt = attRes.data || [];
    const att = normalizeAttendanceRows(rawAtt);
    const adv = advRes.data || [];
    const pays = payRes.data || [];

    const rows = emps.map(emp => {
      const myAtt = att.filter(a => String(a.employee_id) === String(emp.id));

      // ── ลงเวลา ──
      const perDay = {};
      myAtt.forEach(a => { perDay[a.__dateKey || attDateKey(a)] = { status: normStatus(a.status), deduction: n(a.deduction), note: a.note || '' }; });
      const count = k => myAtt.filter(a => normStatus(a.status) === k).length;
      const workDays = myAtt.filter(a => isWorkStatus(a.status)).length;
      const lateAbsentDeduct = r2(myAtt.reduce((s, a) => s + n(a.deduction), 0));

      // ── ค่าจ้าง ──
      const isMonthly = emp.pay_type === 'รายเดือน';
      const wage = isMonthly ? n(emp.salary) : n(emp.daily_wage);
      const gross = isMonthly ? n(emp.salary) : r2(workDays * wage);

      // ── เบิก: แยกเดือนนี้ / ยกมา ──
      const myAdv = adv.filter(a => a.employee_id === emp.id);
      const advThisList = myAdv.filter(a => a.date >= ms + 'T00:00:00' && a.date <= me + 'T23:59:59');
      const advThis = r2(advThisList.reduce((s, a) => s + n(a.amount), 0));
      const advPastGross = r2(myAdv.filter(a => a.date < ms + 'T00:00:00').reduce((s, a) => s + n(a.amount), 0));
      // หักยอดเบิกที่เคยถูกชำระคืนในรอบจ่ายก่อนหน้าเดือนนี้
      const paidWithdrawPast = r2(pays
        .filter(p => p.employee_id === emp.id && p.month < ms)
        .reduce((s, p) => s + n(p.deduct_withdraw), 0));
      const carried = r2(Math.max(0, advPastGross - paidWithdrawPast));

      // ── ปกส./อื่นๆ จากรอบจ่ายเดือนนี้ (ถ้ามี) ──
      const payThis = pays.find(p => p.employee_id === emp.id && p.month === ms);
      const ss = n(payThis?.deduct_ss);
      const other = n(payThis?.deduct_other);
      const paid = n(payThis?.net_paid);
      const paidDate = payThis?.paid_date ? new Date(payThis.paid_date).toLocaleDateString('th-TH') : '';

      const net = r2(gross - lateAbsentDeduct - ss - other - advThis);

      return {
        emp, isMonthly, wage, gross, workDays, lateAbsentDeduct,
        present: count('มา'), late: count('มาสาย'),
        half: count('ครึ่งวัน'),
        leave: count('ลา'), absent: count('ขาด'),
        advThis, carried, ss, other, net, paid, paidDate, perDay,
        advThisList,
      };
    });

    return { ms, me, year, month, monthLabel, rows };
  }

  /* ───────────── สไตล์พื้นฐานของหัวกระดาษ (ทุกชีต) ───────────── */
  function applyPageSetup(ws, lastCol, titleRows, orientation) {
    ws.pageSetup = {
      paperSize: 9,                 // A4
      orientation: orientation || 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.25 },
    };
    ws.pageSetup.printTitlesRow = `1:${titleRows}`;
    ws.headerFooter = {
      oddFooter: '&Lพิมพ์เมื่อ &D &T&Cหน้า &P / &N&Rระบบ SK POS',
      evenFooter: '&Lพิมพ์เมื่อ &D &T&Cหน้า &P / &N&Rระบบ SK POS',
    };
  }

  // วาดบล็อกหัวกระดาษ: ชื่อ หจก. + ชื่อรายงาน  (คืนเลขแถวถัดไป)
  function drawHeader(ws, lastCol, shop, title, subtitle) {
    const colL = ws.getColumn(lastCol).letter;
    // แถว 1: ชื่อ หจก.
    ws.mergeCells(`A1:${colL}1`);
    const c1 = ws.getCell('A1');
    c1.value = shop.name + (shop.nameEn ? `   (${shop.nameEn})` : '');
    c1.font = { name: 'Tahoma', bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    c1.alignment = { vertical: 'middle', horizontal: 'center' };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
    ws.getRow(1).height = 30;
    // แถว 2: ที่อยู่ / โทร (ถ้ามี)
    ws.mergeCells(`A2:${colL}2`);
    const c2 = ws.getCell('A2');
    c2.value = [shop.addr, shop.phone ? 'โทร. ' + shop.phone : ''].filter(Boolean).join('   ·   ') || ' ';
    c2.font = { name: 'Tahoma', size: 9, color: { argb: 'FFFEE2E2' } };
    c2.alignment = { vertical: 'middle', horizontal: 'center' };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
    ws.getRow(2).height = 15;
    // แถว 3: ชื่อรายงาน
    ws.mergeCells(`A3:${colL}3`);
    const c3 = ws.getCell('A3');
    c3.value = title;
    c3.font = { name: 'Tahoma', bold: true, size: 13, color: { argb: 'FF0F172A' } };
    c3.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(3).height = 22;
    // แถว 4: คำอธิบายย่อย
    ws.mergeCells(`A4:${colL}4`);
    const c4 = ws.getCell('A4');
    c4.value = subtitle;
    c4.font = { name: 'Tahoma', size: 10, color: { argb: 'FF475569' } };
    c4.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(4).height = 16;
    return 5; // แถวเริ่มเนื้อหา
  }

  function thinBorder() {
    const s = { style: 'thin', color: { argb: 'FFCBD5E1' } };
    return { top: s, left: s, bottom: s, right: s };
  }

  /* ───────────── ชีต 1: สรุปจ่ายเงินเดือน (มีสูตร) ───────────── */
  function buildSummary(wb, data, shop) {
    const cols = [
      { h: 'ลำดับ', w: 6 },
      { h: 'ชื่อ - สกุล', w: 22 },
      { h: 'ตำแหน่ง', w: 14 },
      { h: 'ประเภท', w: 9 },
      { h: 'อัตรา\n(บาท)', w: 10 },
      { h: 'วัน\nทำงาน', w: 7 },
      { h: 'ค่าจ้างรวม', w: 12 },
      { h: 'หักสาย/\nขาด', w: 10 },
      { h: 'ประกัน\nสังคม', w: 10 },
      { h: 'หัก\nอื่นๆ', w: 9 },
      { h: 'เบิก\nเดือนนี้', w: 10 },
      { h: 'ยอดสุทธิ\nที่ต้องจ่าย', w: 13 },
      { h: 'หนี้เบิก\nยกมา', w: 11 },
      { h: 'จ่ายแล้ว', w: 11 },
      { h: 'วันที่จ่าย', w: 12 },
    ];
    const ws = wb.addWorksheet('สรุปจ่ายเงินเดือน', { properties: { defaultRowHeight: 18 } });
    const last = cols.length;
    applyPageSetup(ws, last, 5, 'landscape');
    drawHeader(ws, last, shop,
      'สรุปการจ่ายเงินเดือนพนักงาน',
      `ประจำเดือน ${data.monthLabel}  ·  พนักงาน ${data.rows.length} คน  ·  ช่อง "ยอดสุทธิ" เป็นสูตร แก้ไขได้`);

    // หัวตาราง (แถว 5)
    const headRow = ws.getRow(5);
    cols.forEach((c, i) => {
      const cell = headRow.getCell(i + 1);
      cell.value = c.h;
      cell.font = { name: 'Tahoma', bold: true, size: 9.5, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder();
    });
    headRow.height = 30;
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; });

    // คอลัมน์ตัวอักษร (สำหรับสร้างสูตร)
    const L = {}; cols.forEach((c, i) => { L[i + 1] = ws.getColumn(i + 1).letter; });

    const firstData = 6;
    data.rows.forEach((row, idx) => {
      const rN = firstData + idx;
      const r = ws.getRow(rN);
      const e = row.emp;
      const vals = [
        idx + 1,
        `${e.name} ${e.lastname || ''}`.trim(),
        e.position || '',
        row.isMonthly ? 'รายเดือน' : 'รายวัน',
        row.wage,
        row.workDays,
        row.gross,
        row.lateAbsentDeduct,
        row.ss,
        row.other,
        row.advThis,
        null, // ยอดสุทธิ = สูตร (ใส่ด้านล่าง)
        row.carried,
        row.paid,
        row.paidDate,
      ];
      vals.forEach((v, i) => { r.getCell(i + 1).value = v; });

      // สูตรยอดสุทธิ: ค่าจ้างรวม − หักสาย/ขาด − ปกส − อื่นๆ − เบิกเดือนนี้
      const f = `${L[7]}${rN}-${L[8]}${rN}-${L[9]}${rN}-${L[10]}${rN}-${L[11]}${rN}`;
      r.getCell(12).value = { formula: f, result: row.net };

      // จัดสไตล์ทั้งแถว
      r.height = 19;
      for (let ci = 1; ci <= last; ci++) {
        const cell = r.getCell(ci);
        cell.border = thinBorder();
        cell.font = { name: 'Tahoma', size: 9.5, color: { argb: 'FF1E293B' } };
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        if (ci === 1 || ci === 4 || ci === 6 || ci === 15) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (ci === 2 || ci === 3) cell.alignment = { horizontal: 'left', vertical: 'middle' };
        else { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.numFmt = '#,##0.00'; }
      }
      // เน้นช่องยอดสุทธิ (สูตร) ให้เด่น + พื้นเหลืองอ่อน บอกว่าแก้ได้
      const netCell = r.getCell(12);
      netCell.font = { name: 'Tahoma', bold: true, size: 10.5, color: { argb: 'FF065F46' } };
      netCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      // หนี้ยกมา > 0 → เน้นแดง
      if (row.carried > 0) r.getCell(13).font = { name: 'Tahoma', bold: true, size: 9.5, color: { argb: 'FFB91C1C' } };
    });

    // แถวรวม
    const totN = firstData + data.rows.length;
    const tr = ws.getRow(totN);
    tr.getCell(1).value = 'รวมทั้งหมด';
    ws.mergeCells(totN, 1, totN, 5);
    [6, 7, 8, 9, 10, 11, 12, 13, 14].forEach(ci => {
      const col = L[ci];
      tr.getCell(ci).value = { formula: `SUM(${col}${firstData}:${col}${totN - 1})` };
    });
    for (let ci = 1; ci <= last; ci++) {
      const cell = tr.getCell(ci);
      cell.border = thinBorder();
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.font = { name: 'Tahoma', bold: true, size: 10, color: { argb: 'FF0F172A' } };
      if (ci === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      else if (ci >= 6) { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.numFmt = '#,##0.00'; }
    }
    tr.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
    tr.height = 22;

    // หมายเหตุท้ายตาราง
    const noteN = totN + 2;
    ws.mergeCells(noteN, 1, noteN, last);
    const nc = ws.getCell(noteN, 1);
    nc.value = '※ ยอดสุทธิ = ค่าจ้างรวม − หักสาย/ขาด − ประกันสังคม − หักอื่นๆ − เบิกเดือนนี้   |   "หนี้เบิกยกมา" เป็นยอดอ้างอิง ไม่ถูกหักอัตโนมัติ   |   ช่องสีเหลืองแก้ไขตัวเลข/สูตรได้';
    nc.font = { name: 'Tahoma', size: 9, italic: true, color: { argb: 'FF64748B' } };
    nc.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(noteN).height = 28;

    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: totN - 1, column: last } };
    ws.views = [{ state: 'frozen', ySplit: 5 }];
    ws.pageSetup.printArea = `A1:${L[last]}${noteN}`;
  }

  /* ───────────── ชีตปฏิทินรายคน ───────────── */
  function buildCalendar(wb, data, row, shop) {
    const e = row.emp;
    const sheetName = safeName(`${e.name}${e.lastname ? ' ' + e.lastname : ''}`) || 'พนักงาน';
    let ws;
    try { ws = wb.addWorksheet(sheetName); }
    catch (_) { ws = wb.addWorksheet(sheetName + '_' + Math.floor(Math.random() * 999)); }

    const last = 7;            // 7 วันต่อสัปดาห์
    applyPageSetup(ws, last, 5, 'landscape');
    for (let i = 1; i <= last; i++) ws.getColumn(i).width = 19;

    drawHeader(ws, last, shop,
      `ปฏิทินลงเวลา & สรุปเงินเดือน — ${e.name} ${e.lastname || ''}`.trim(),
      `${e.position || 'พนักงาน'}  ·  ${row.isMonthly ? 'รายเดือน ฿' + fmt(row.wage) : 'รายวัน ฿' + fmt(row.wage) + '/วัน'}  ·  ประจำเดือน ${data.monthLabel}`);

    // แถว 5: หัวข้อวันในสัปดาห์
    const dows = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const dowRow = ws.getRow(5);
    dows.forEach((d, i) => {
      const cell = dowRow.getCell(i + 1);
      cell.value = d;
      cell.font = { name: 'Tahoma', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (i === 0 || i === 6) ? 'FF7C3AED' : 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder();
    });
    dowRow.height = 20;

    // วาดวันแบบปฏิทิน (เริ่มแถว 6)
    const year = data.year, month = data.month;
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    let rN = 6;
    let dow = firstDow;
    // เติมช่องว่างก่อนวันที่ 1
    const fillBlank = (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = thinBorder();
    };
    let curRow = ws.getRow(rN);
    for (let i = 0; i < firstDow; i++) fillBlank(curRow.getCell(i + 1));

    for (let day = 1; day <= daysInMonth; day++) {
      const key = localDateKey(new Date(year, month - 1, day));
      const rec = row.perDay[key];
      const meta = statusMeta(rec?.status);
      const cell = curRow.getCell(dow + 1);

      const adv = (row.advThisList || []).filter(a => String(a.date).slice(0, 10) === key)
        .reduce((s, a) => s + n(a.amount), 0);

      // เนื้อหาในช่อง: เลขวัน + สัญลักษณ์/สถานะ + เบิก(ถ้ามี)
      let txt = `${day}`;
      if (meta.label) txt += `\n${meta.sym} ${meta.label}`;
      else txt += `\n${meta.sym}`;
      if (adv > 0) txt += `\n฿${fmt(adv)}`;
      cell.value = txt;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.fill } };
      cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: meta.text } };
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = thinBorder();

      if (dow === 6 || day === daysInMonth) {
        curRow.height = 50;
        // เติมช่องว่างหลังวันสุดท้าย
        if (day === daysInMonth) for (let i = dow + 1; i < 7; i++) fillBlank(curRow.getCell(i + 1));
        rN++;
        curRow = ws.getRow(rN);
        dow = 0;
      } else {
        dow++;
      }
    }

    // ── คำอธิบายสัญลักษณ์ (legend) ──
    const legendN = rN + 1;
    ws.mergeCells(legendN, 1, legendN, 7);
    const lg = ws.getCell(legendN, 1);
    lg.value = 'สัญลักษณ์:   ✓ มา      ▲ มาสาย      ◐ ครึ่งวัน      ○ ลา      ✗ ขาด      · ยังไม่ลงเวลา';
    lg.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FF334155' } };
    lg.alignment = { vertical: 'middle', horizontal: 'center' };
    lg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    lg.border = thinBorder();
    ws.getRow(legendN).height = 20;

    // ── กล่องสรุปเงินเดือนของคนนี้ ──
    const sumStart = legendN + 2;
    ws.mergeCells(sumStart, 1, sumStart, 7);
    const sh = ws.getCell(sumStart, 1);
    sh.value = 'สรุปเงินเดือนเดือนนี้';
    sh.font = { name: 'Tahoma', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    sh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
    sh.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(sumStart).height = 22;

    const items = [
      ['วันมาทำงาน', `${row.present} วัน`],
      ['มาสาย', `${row.late} วัน`],
      ['ครึ่งวัน', `${row.half} วัน`],
      ['ลา', `${row.leave} วัน`],
      ['ขาด', `${row.absent} วัน`],
      ['ค่าจ้างรวม', `฿${fmt(row.gross)}`],
      ['หักสาย/ขาด', `฿${fmt(row.lateAbsentDeduct)}`],
      ['ประกันสังคม', `฿${fmt(row.ss)}`],
      ['หักอื่นๆ', `฿${fmt(row.other)}`],
      ['เบิกเดือนนี้', `฿${fmt(row.advThis)}`],
      ['หนี้เบิกยกมา', `฿${fmt(row.carried)}`],
      ['ยอดสุทธิที่ต้องจ่าย', `฿${fmt(row.net)}`],
    ];
    // วาง 2 คอลัมน์ (label,value) x แถว — ใช้พื้นที่ A:C และ E:G
    const half = Math.ceil(items.length / 2);
    for (let i = 0; i < half; i++) {
      const rowN = sumStart + 1 + i;
      const rr = ws.getRow(rowN);
      const drawPair = (pair, labCol) => {
        if (!pair) return;
        ws.mergeCells(rowN, labCol, rowN, labCol + 1);
        const lc = ws.getCell(rowN, labCol);
        lc.value = pair[0];
        lc.font = { name: 'Tahoma', size: 10, color: { argb: 'FF475569' } };
        lc.alignment = { vertical: 'middle', horizontal: 'left' };
        lc.border = thinBorder();
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        const vc = ws.getCell(rowN, labCol + 2);
        vc.value = pair[1];
        const strong = pair[0] === 'ยอดสุทธิที่ต้องจ่าย';
        const debt = pair[0] === 'หนี้เบิกยกมา' && row.carried > 0;
        vc.font = { name: 'Tahoma', bold: strong || debt, size: strong ? 12 : 10, color: { argb: strong ? 'FF065F46' : (debt ? 'FFB91C1C' : 'FF0F172A') } };
        vc.alignment = { vertical: 'middle', horizontal: 'right' };
        vc.border = thinBorder();
        if (strong) vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      };
      drawPair(items[i], 1);          // คอลัมน์ A-C
      drawPair(items[i + half], 5);   // คอลัมน์ E-G (คอลัมน์ D เว้นเป็นช่องว่าง)
      rr.height = 18;
    }

    ws.views = [{ state: 'frozen', ySplit: 5 }];
    ws.pageSetup.printArea = `A1:G${sumStart + half}`;
  }

  /* ───────────── สร้าง workbook ───────────── */
  async function buildWorkbook(year, month) {
    const shop = await getShop();
    const data = await gatherData(year, month);
    if (!data.rows.length) throw new Error('ไม่มีพนักงานสถานะ "ทำงาน"');

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SK POS';
    wb.created = new Date();

    buildSummary(wb, data, shop);
    data.rows.forEach(row => buildCalendar(wb, data, row, shop));

    return { wb, data };
  }

  async function downloadExcel(year, month, btn) {
    if (!window.ExcelJS) { notify('โมดูล Excel ยังโหลดไม่พร้อม กรุณารีเฟรชหน้าแล้วลองอีกครั้ง', 'error'); return; }
    if (btn) btn.disabled = true;
    notify('กำลังสร้างรายงาน Excel...', 'info');
    try {
      const { wb, data } = await buildWorkbook(year, month);
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `เงินเดือนพนักงาน_${data.monthLabel.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify('ดาวน์โหลด Excel สำเร็จ', 'success');
      if (typeof closeModal === 'function') closeModal();
    } catch (err) {
      console.error('[v94] payroll excel:', err);
      notify('สร้างรายงานไม่สำเร็จ: ' + (err?.message || err), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ───────────── Modal เลือกเดือน (แทน v26ShowCSVExport) ───────────── */
  function openExportModal() {
    const now = new Date();
    const val = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const html = `
      <div style="text-align:center;margin-bottom:14px;">
        <i class="material-icons-round" style="font-size:46px;color:#16a34a;">grid_on</i>
        <p style="font-size:14px;color:#475569;margin-top:6px;font-weight:600;">รายงานเงินเดือน + ปฏิทินลงเวลา (Excel)</p>
        <p style="font-size:12px;color:#94a3b8;margin-top:2px;">พิมพ์ลง A4 ได้พอดี · ช่องยอดสุทธิเป็นสูตรแก้ไขได้</p>
      </div>
      <div class="form-group">
        <label class="form-label">เลือกเดือน</label>
        <input type="month" class="form-input" id="v94month" value="${val}">
      </div>
      <ul style="font-size:12px;color:#64748b;line-height:1.8;margin:10px 0 4px;padding-left:18px;">
        <li>ชีตสรุป: ตารางจ่ายเงินเดือนทุกคน + แถวรวม</li>
        <li>ชีตรายคน: ปฏิทินลงเวลาแบบสัญลักษณ์/สี</li>
        <li>หัวกระดาษทุกแผ่นมีชื่อ หจก.</li>
      </ul>
      <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="v94DownloadFromModal(this)">
        <i class="material-icons-round">download</i> ดาวน์โหลด Excel
      </button>`;
    if (typeof openModal === 'function') openModal('📊 ส่งออกรายงานเงินเดือน', html);
  }

  window.v94DownloadFromModal = function (btn) {
    const mv = document.getElementById('v94month')?.value;
    if (!mv) { notify('กรุณาเลือกเดือน', 'warning'); return; }
    const [y, m] = mv.split('-').map(Number);
    downloadExcel(y, m, btn);
  };

  /* ───────────── เชื่อมเข้าระบบ: แทนปุ่มเดิม + เปลี่ยนชื่อปุ่ม ───────────── */
  function relabelButtons() {
    document.querySelectorAll('button[onclick*="v26ShowCSVExport"]').forEach(btn => {
      if (btn.dataset.v94) return;
      btn.dataset.v94 = '1';
      btn.innerHTML = '<i class="material-icons-round">grid_on</i> ส่งออก Excel';
      btn.title = 'รายงานเงินเดือน + ปฏิทินลงเวลา (Excel)';
    });
  }

  function boot() {
    window.v26ShowCSVExport = openExportModal;   // override ปุ่มเดิม
    window.v94ExportPayroll = openExportModal;    // ชื่อใหม่เผื่อเรียกตรง
    relabelButtons();
    new MutationObserver(relabelButtons).observe(document.body, { childList: true, subtree: true });
    console.info('%c[v94] ✅%c Payroll Excel Report | A4 Calendar | Editable Net Formula', 'color:#16a34a;font-weight:700', 'color:#6B7280');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
