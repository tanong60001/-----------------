/* ════════════════════════════════════════════════════════════════════
   modules-v94-payroll-excel-report.js
   ─────────────────────────────────────────────────────────────────────
   ยกเครื่องปุ่ม "ส่งออก CSV" ของหน้าพนักงาน/ลงเวลา ให้เป็นรายงาน Excel (.xlsx)
   ที่จัดรูปแบบสวยงาม พิมพ์ลง A4 ได้พอดี และมีหัวกระดาษชื่อ หจก. ทุกแผ่น

   ประกอบด้วย
   1) ชีต "เช็คชื่อ-กรอกข้อมูล" – จุดกรอกข้อมูลหลักที่สลิปทุกใบอ้างอิง
   2) ชีต "พิมพ์สลิป 4 คน"     – จัดหน้าสลิป 4 คนต่อกระดาษ A4
   3) ชีตรายคนและชีตตรวจหนี้   – เชื่อมสูตรจากชีตหลักอัตโนมัติ

   ลำดับตัดยอด: หักเบิกเดือนนี้ก่อน แล้วค่อยหักหนี้ยกมาจากเงินที่เหลือ
   สูตรยอดสุทธิ = ค่าจ้างรวม − หักสาย/ขาด − ประกันสังคม − หักอื่นๆ
                  − หักเบิกเดือนนี้ − หักหนี้ยกมา
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ATT_TABLE = 'เช็คชื่อ';
  const ADV_TABLE = 'เบิกเงิน';
  const PAY_TABLE = 'จ่ายเงินเดือน';
  const DEFAULT_SHOP = 'หจก. เอส เค วัสดุ';
  const MASTER_SHEET = 'เช็คชื่อ-กรอกข้อมูล';
  const PRINT_SHEET = 'พิมพ์สลิป 4 คน';
  const DEBT_SHEET = 'ตรวจสอบหนี้ยกมา';

  /* ───────────── helpers ───────────── */
  function n(v) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function r2(v) { return Math.round((n(v) + Number.EPSILON) * 100) / 100; }
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

  function noteAmount(note, label) {
    const rx = new RegExp(label + '\\s*฿?\\s*([0-9,]+(?:\\.\\d+)?)', 'gi');
    let sum = 0;
    let match;
    while ((match = rx.exec(String(note || '')))) sum += n(String(match[1]).replace(/,/g, ''));
    return r2(sum);
  }

  function payMonthKey(row) {
    return localDateKeyFromValue(row && row.month);
  }

  function isCarriedAdvance(row) {
    return /ยกมา/.test(String(row && row.reason || ''));
  }

  function latestPaidDate(rows) {
    const dates = (rows || []).map(p => new Date(p.paid_date)).filter(d => !Number.isNaN(d.getTime()));
    if (!dates.length) return null;
    return localDateKey(new Date(Math.max(...dates.map(d => d.getTime()))));
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
      // ยอดคงค้างในตารางเบิกเงินเป็นแหล่งจริงเพียงแหล่งเดียว:
      // รายการที่ชำระแล้วถูกเปลี่ยนสถานะ/ลดจำนวนไปแล้ว จึงห้ามลบ deduct_withdraw ซ้ำ
      db.from(ADV_TABLE).select('*').eq('status', 'อนุมัติ').lte('date', me + 'T23:59:59'),
      db.from(PAY_TABLE).select('*').eq('month', ms),
    ]);

    const queryError = attRes.error || advRes.error || payRes.error;
    if (queryError) throw queryError;

    const rawAtt = attRes.data || [];
    const att = normalizeAttendanceRows(rawAtt);
    const adv = advRes.data || [];
    const pays = payRes.data || [];

    const rows = emps.map(emp => {
      const myAtt = att.filter(a => String(a.employee_id) === String(emp.id));

      // ── ลงเวลา ──
      const workDays = myAtt.filter(a => isWorkStatus(a.status)).length;
      const lateAbsentDeduct = r2(myAtt.reduce((s, a) => s + n(a.deduction), 0));

      // ── ค่าจ้าง ──
      const isMonthly = emp.pay_type === 'รายเดือน';
      const wage = isMonthly ? n(emp.salary) : n(emp.daily_wage);
      const gross = isMonthly ? n(emp.salary) : r2(workDays * wage);

      // ── เบิก: แยกเดือนนี้ / ยกมา ──
      const empId = String(emp.id);
      const myAdv = adv.filter(a => String(a.employee_id) === empId);
      const advThisList = myAdv.filter(a => {
        const day = localDateKeyFromValue(a.date);
        return day >= ms && day <= me && !isCarriedAdvance(a);
      });
      const advThis = r2(advThisList.reduce((s, a) => s + n(a.amount), 0));
      const carriedList = myAdv.filter(a => localDateKeyFromValue(a.date) < ms || isCarriedAdvance(a));
      const carried = r2(carriedList.reduce((s, a) => s + n(a.amount), 0));

      // ── รอบจ่ายเดือนนี้ (รองรับทั้งข้อมูลเก่าหลายแถวและข้อมูลใหม่แบบรวมแถว) ──
      const payThisRows = pays.filter(p => String(p.employee_id) === empId && payMonthKey(p) === ms);
      const ss = r2(payThisRows.reduce((s, p) => s + (n(p.deduct_ss) || noteAmount(p.note, 'ประกันสังคม')), 0));
      const other = r2(payThisRows.reduce((s, p) => s + (n(p.deduct_other) || noteAmount(p.note, 'อื่นๆ')), 0));
      const paid = r2(payThisRows.reduce((s, p) => s + n(p.net_paid), 0));
      const paidDate = latestPaidDate(payThisRows);
      const debtPaidRecorded = r2(payThisRows.reduce((s, p) => s + n(p.deduct_withdraw), 0));

      // ยอดคงค้าง ณ ตอนส่งออก = รายการสถานะอนุมัติเท่านั้น
      // ถ้าเคยบันทึกจ่ายเดือนนี้แล้ว ledger ถูกตัดหนี้ไปแล้ว จึงเริ่มช่อง "หักครั้งนี้" ที่ 0
      const availableBeforeDebt = r2(Math.max(0, gross - lateAbsentDeduct - ss - other));
      // ลำดับตัดหนี้ของร้าน: หักยอดเบิกเดือนนี้ก่อน แล้วจึงหักหนี้ยกมาจากเงินที่เหลือ
      const debtDeductAdvance = r2(payThisRows.length ? 0 : Math.min(advThis, availableBeforeDebt));
      const availableAfterAdvance = r2(Math.max(0, availableBeforeDebt - debtDeductAdvance));
      const debtDeductCarried = r2(payThisRows.length ? 0 : Math.min(carried, availableAfterAdvance));
      const debtDeduct = r2(debtDeductCarried + debtDeductAdvance);
      const debtNext = r2(Math.max(0, carried - debtDeductCarried) + Math.max(0, advThis - debtDeductAdvance));
      const net = r2(Math.max(0, availableBeforeDebt - debtDeduct));

      return {
        emp, isMonthly, wage, gross, workDays, lateAbsentDeduct,
        advThis, carried, ss, other, debtDeductCarried, debtDeductAdvance, debtDeduct,
        debtNext, net, paid, paidDate, debtPaidRecorded,
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

  /* ───────────── ชีต 1: จุดกรอกข้อมูลหลัก (ทุกสลิปอ้างอิงชีตนี้) ───────────── */
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
      { h: 'หักประกัน\nสังคม', w: 11 },
      { h: 'หัก\nอื่นๆ', w: 9 },
      { h: 'เบิก\nเดือนนี้', w: 10 },
      { h: 'หนี้เบิก\nยกมา', w: 11 },
      { h: 'หักเบิก\nเดือนนี้', w: 11 },
      { h: 'หักหนี้\nยกมา', w: 11 },
      { h: 'จ่ายแล้ว', w: 11 },
      { h: 'วันที่จ่าย', w: 12 },
      { h: 'หนี้ยกไป\nเดือนหน้า', w: 12 },
      { h: 'สรุป\nรายรับ', w: 13 },
    ];
    const ws = wb.addWorksheet(MASTER_SHEET, { properties: { defaultRowHeight: 18 } });
    const last = cols.length;
    applyPageSetup(ws, last, 5, 'landscape');
    drawHeader(ws, last, shop,
      'หน้าเช็คชื่อและกรอกข้อมูลเงินเดือน',
      `ประจำเดือน ${data.monthLabel}  ·  กรอกเฉพาะช่องสีฟ้าในหน้านี้  ·  สลิปทุกใบเชื่อมกับหน้านี้อัตโนมัติ`);

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
        null, // ค่าจ้างรวม = สูตรจากประเภท × อัตรา × วันทำงาน
        row.lateAbsentDeduct,
        row.ss,
        row.other,
        row.advThis,
        row.carried,
        row.debtDeductAdvance,
        row.debtDeductCarried,
        row.paid,
        row.paidDate,
        null, // หนี้ยกไปเดือนหน้า = สูตร
        null, // สรุปรายรับ = สูตร (ใส่ด้านล่าง)
      ];
      vals.forEach((v, i) => { r.getCell(i + 1).value = v; });

      const grossFormula = `IF(${L[4]}${rN}="รายเดือน",${L[5]}${rN},${L[5]}${rN}*${L[6]}${rN})`;
      r.getCell(7).value = { formula: grossFormula, result: row.gross };
      // หนี้เดือนหน้า = หนี้ยกมาคงเหลือ + เบิกเดือนนี้คงเหลือ
      const debtNextFormula = `MAX(0,${L[11]}${rN}-${L[13]}${rN})+MAX(0,${L[12]}${rN}-${L[14]}${rN})`;
      r.getCell(17).value = { formula: debtNextFormula, result: row.debtNext };
      // สรุปรายรับ = ค่าจ้างรวม − รายการหักทั่วไป − หักเบิกเดือนนี้ − หักหนี้ยกมา
      const netFormula = `MAX(0,${L[7]}${rN}-${L[8]}${rN}-${L[9]}${rN}-${L[10]}${rN}-${L[13]}${rN}-${L[14]}${rN})`;
      r.getCell(18).value = { formula: netFormula, result: row.net };

      // จัดสไตล์ทั้งแถว
      r.height = 19;
      for (let ci = 1; ci <= last; ci++) {
        const cell = r.getCell(ci);
        cell.border = thinBorder();
        cell.font = { name: 'Tahoma', size: 9.5, color: { argb: 'FF1E293B' } };
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        if (ci === 1 || ci === 4 || ci === 6 || ci === 16) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (ci === 2 || ci === 3) cell.alignment = { horizontal: 'left', vertical: 'middle' };
        else { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.numFmt = '#,##0.00'; }
      }
      r.getCell(16).numFmt = '@';

      // ช่องสีฟ้าเป็นจุดกรอกเพียงจุดเดียว ส่วนสลิปทุกชีตเป็นสูตรอ้างอิง
      [5, 6, 8, 9, 10, 13, 14, 15, 16].forEach(ci => {
        const inputCell = r.getCell(ci);
        inputCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        inputCell.font = { name: 'Tahoma', bold: true, size: 9.5, color: { argb: 'FF075985' } };
        if (ci !== 16) {
          inputCell.dataValidation = {
            type: 'decimal',
            operator: 'greaterThanOrEqual',
            allowBlank: true,
            formulae: [0],
            showErrorMessage: true,
            errorTitle: 'ตัวเลขไม่ถูกต้อง',
            error: 'กรุณากรอกจำนวนตั้งแต่ 0 ขึ้นไป',
          };
        }
      });
      r.getCell(13).dataValidation = {
        type: 'decimal',
        operator: 'between',
        allowBlank: true,
        formulae: [0, `${L[11]}${rN}`],
        showErrorMessage: true,
        errorTitle: 'หักเบิกเดือนนี้เกินยอด',
        error: 'ยอดหักเบิกเดือนนี้ต้องไม่เกินยอดเบิกเดือนนี้',
      };
      r.getCell(14).dataValidation = {
        type: 'decimal',
        operator: 'between',
        allowBlank: true,
        formulae: [0, `${L[12]}${rN}`],
        showErrorMessage: true,
        errorTitle: 'หักหนี้ยกมาเกินยอด',
        error: 'ยอดหักหนี้ยกมาต้องไม่เกินยอดหนี้ยกมา',
      };
      // เน้นช่องสรุปรายรับ (สูตร) ให้เด่น
      const netCell = r.getCell(18);
      netCell.font = { name: 'Tahoma', bold: true, size: 10.5, color: { argb: 'FF065F46' } };
      netCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      const nextDebtCell = r.getCell(17);
      nextDebtCell.font = { name: 'Tahoma', bold: true, size: 10, color: { argb: row.debtNext > 0 ? 'FFB91C1C' : 'FF047857' } };
      nextDebtCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
      // หนี้ยกมา > 0 → เน้นแดง
      if (row.carried > 0) r.getCell(12).font = { name: 'Tahoma', bold: true, size: 9.5, color: { argb: 'FFB91C1C' } };
    });

    // แถวรวม
    const totN = firstData + data.rows.length;
    const tr = ws.getRow(totN);
    tr.getCell(1).value = 'รวมทั้งหมด';
    ws.mergeCells(totN, 1, totN, 5);
    [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18].forEach(ci => {
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
    tr.getCell(17).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
    tr.getCell(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
    tr.height = 22;

    // หมายเหตุท้ายตาราง
    const noteN = totN + 2;
    ws.mergeCells(noteN, 1, noteN, last);
    const nc = ws.getCell(noteN, 1);
    nc.value = '※ กรอก/แก้ไขเฉพาะช่องสีฟ้าในชีตนี้ แล้วสลิปทุกใบจะเปลี่ยนตามอัตโนมัติ   |   ตัดยอดตามลำดับ: หักเบิกเดือนนี้ก่อน แล้วค่อยหักหนี้ยกมา   |   หนี้ยกไป = (เบิกเดือนนี้ − หักเบิกเดือนนี้) + (หนี้ยกมา − หักหนี้ยกมา)';
    nc.font = { name: 'Tahoma', size: 9, italic: true, color: { argb: 'FF64748B' } };
    nc.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(noteN).height = 28;

    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: totN - 1, column: last } };
    ws.views = [{ state: 'frozen', ySplit: 5 }];
    ws.pageSetup.printArea = `A1:${L[last]}${noteN}`;
    return { ws, firstData, totalRow: totN };
  }

  function ref(masterRow, col) {
    return `='${MASTER_SHEET}'!$${col}$${masterRow}`;
  }

  function formulaCell(cell, masterRow, col, result) {
    cell.value = { formula: ref(masterRow, col).slice(1), result };
  }

  function styleBlockRange(ws, startRow, endRow, startCol, endCol) {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = ws.getCell(r, c);
        cell.border = thinBorder();
        if (!cell.font) cell.font = { name: 'Tahoma', size: 8.5, color: { argb: 'FF1E293B' } };
      }
    }
  }

  function buildSlipBlock(ws, data, row, shop, masterRow, startRow, startCol) {
    const endCol = startCol + 5;
    const merge = (r, c1, c2) => ws.mergeCells(r, c1, r, c2);
    const labelColEnd = startCol + 3;
    const valueColStart = startCol + 4;
    const valueColEnd = endCol;
    const name = `${row.emp.name} ${row.emp.lastname || ''}`.trim();

    merge(startRow, startCol, endCol);
    const shopCell = ws.getCell(startRow, startCol);
    shopCell.value = shop.name;
    shopCell.font = { name: 'Tahoma', bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
    shopCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
    shopCell.alignment = { horizontal: 'center', vertical: 'middle' };

    merge(startRow + 1, startCol, endCol);
    const title = ws.getCell(startRow + 1, startCol);
    title.value = `ใบสรุปค่าแรง · ${data.monthLabel}`;
    title.font = { name: 'Tahoma', bold: true, size: 9.5, color: { argb: 'FF7F1D1D' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };

    const info = [
      ['ชื่อพนักงาน', 'B', name],
      ['ตำแหน่ง', 'C', row.emp.position || 'พนักงาน'],
      ['ประเภทค่าจ้าง', 'D', row.isMonthly ? 'รายเดือน' : 'รายวัน'],
    ];
    info.forEach((item, idx) => {
      const rr = startRow + 2 + idx;
      merge(rr, startCol, startCol + 1);
      merge(rr, startCol + 2, endCol);
      const lc = ws.getCell(rr, startCol);
      lc.value = item[0];
      lc.font = { name: 'Tahoma', bold: true, size: 8.5, color: { argb: 'FF64748B' } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      lc.alignment = { vertical: 'middle' };
      const vc = ws.getCell(rr, startCol + 2);
      formulaCell(vc, masterRow, item[1], item[2]);
      vc.font = { name: 'Tahoma', bold: idx === 0, size: idx === 0 ? 9.5 : 8.5, color: { argb: 'FF0F172A' } };
      vc.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const moneyRows = [
      ['อัตราค่าจ้าง', 'E', row.wage],
      ['วันทำงาน', 'F', row.workDays, '0.##'],
      ['ค่าจ้างรวม', 'G', row.gross],
      ['หักสาย/ขาด', 'H', row.lateAbsentDeduct],
      ['หักประกันสังคม', 'I', row.ss],
      ['หักอื่นๆ', 'J', row.other],
      ['เบิกเดือนนี้', 'K', row.advThis],
      ['หนี้ยกมา', 'L', row.carried],
      ['หักเบิกเดือนนี้', 'M', row.debtDeductAdvance],
      ['หักหนี้ยกมา', 'N', row.debtDeductCarried],
      ['พนักงานรับสุทธิ', 'R', row.net, null, 'net'],
      ['หนี้ยกไปเดือนหน้า', 'Q', row.debtNext, null, 'debt'],
    ];
    const moneyStart = startRow + 5;
    moneyRows.forEach((item, idx) => {
      const rr = moneyStart + idx;
      merge(rr, startCol, labelColEnd);
      merge(rr, valueColStart, valueColEnd);
      const lc = ws.getCell(rr, startCol);
      lc.value = item[0];
      lc.font = { name: 'Tahoma', size: 8.2, bold: item[4] === 'net', color: { argb: 'FF475569' } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item[4] === 'net' ? 'FFECFDF5' : 'FFF8FAFC' } };
      lc.alignment = { vertical: 'middle', horizontal: 'left' };
      const vc = ws.getCell(rr, valueColStart);
      formulaCell(vc, masterRow, item[1], item[2]);
      vc.numFmt = item[3] || '฿#,##0.00;[Red]-฿#,##0.00;฿0.00';
      vc.alignment = { vertical: 'middle', horizontal: 'right' };
      vc.font = {
        name: 'Tahoma', bold: true, size: item[4] === 'net' ? 10.5 : 8.5,
        color: { argb: item[4] === 'net' ? 'FF047857' : (item[4] === 'debt' && row.debtNext > 0 ? 'FFB91C1C' : 'FF0F172A') },
      };
      if (item[4] === 'net') vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      if (item[4] === 'debt') vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    });

    const noteRow = startRow + 17;
    merge(noteRow, startCol, endCol);
    const note = ws.getCell(noteRow, startCol);
    note.value = 'ข้อมูลในสลิปเชื่อมจากชีต “เช็คชื่อ-กรอกข้อมูล” ห้ามกรอกทับในสลิป';
    note.font = { name: 'Tahoma', italic: true, size: 7.5, color: { argb: 'FF64748B' } };
    note.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const signRow = startRow + 18;
    merge(signRow, startCol, startCol + 2);
    merge(signRow, startCol + 3, endCol);
    ws.getCell(signRow, startCol).value = 'ลงชื่อผู้รับ ____________________';
    ws.getCell(signRow, startCol + 3).value = 'ผู้จ่าย ____________________';
    [startCol, startCol + 3].forEach(c => {
      const cell = ws.getCell(signRow, c);
      cell.font = { name: 'Tahoma', size: 7.8, color: { argb: 'FF475569' } };
      cell.alignment = { horizontal: 'center', vertical: 'bottom' };
    });

    styleBlockRange(ws, startRow, signRow, startCol, endCol);
    ws.getRow(startRow).height = 20;
    ws.getRow(startRow + 1).height = 17;
    for (let r = startRow + 2; r <= startRow + 16; r++) ws.getRow(r).height = 14;
    ws.getRow(noteRow).height = 18;
    ws.getRow(signRow).height = 22;
    return signRow;
  }

  function setupSlipColumns(ws, starts) {
    starts.forEach(startCol => {
      [7.5, 7.5, 7, 7, 9, 9].forEach((width, idx) => { ws.getColumn(startCol + idx).width = width; });
    });
  }

  function applySlipPageSetup(ws, orientation) {
    ws.pageSetup = {
      paperSize: 9,
      orientation: orientation || 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.15 },
    };
    ws.headerFooter = {
      oddFooter: '&Lระบบ SK POS&Cหน้า &P / &N&Rพิมพ์เมื่อ &D &T',
      evenFooter: '&Lระบบ SK POS&Cหน้า &P / &N&Rพิมพ์เมื่อ &D &T',
    };
  }

  function buildPrintSlips(wb, data, shop, firstMasterRow) {
    const ws = wb.addWorksheet(PRINT_SHEET, { properties: { defaultRowHeight: 14.5 } });
    ws.views = [{ showGridLines: false }];
    setupSlipColumns(ws, [1, 8]);
    ws.getColumn(7).width = 2.5;
    applySlipPageSetup(ws, 'portrait');

    data.rows.forEach((row, idx) => {
      const page = Math.floor(idx / 4);
      const pos = idx % 4;
      const pageStart = 1 + page * 40;
      const startRow = pageStart + (pos >= 2 ? 20 : 0);
      const startCol = pos % 2 === 0 ? 1 : 8;
      buildSlipBlock(ws, data, row, shop, firstMasterRow + idx, startRow, startCol);
      if (pos === 3 && idx < data.rows.length - 1) ws.getRow(pageStart + 38).addPageBreak();
    });

    const pages = Math.ceil(data.rows.length / 4);
    const lastRow = Math.max(19, pages * 40 - 1);
    ws.pageSetup.printArea = `A1:M${lastRow}`;
    return ws;
  }

  function uniqueSheetName(wb, base, idx) {
    const clean = safeName(base) || `พนักงาน_${idx + 1}`;
    let name = clean;
    let suffix = 2;
    while (wb.getWorksheet(name)) {
      const tail = `_${suffix++}`;
      name = clean.slice(0, 31 - tail.length) + tail;
    }
    return name;
  }

  function buildPersonalSlip(wb, data, row, shop, masterRow, idx) {
    const name = `${row.emp.name} ${row.emp.lastname || ''}`.trim();
    const ws = wb.addWorksheet(uniqueSheetName(wb, name, idx), { properties: { defaultRowHeight: 14.5 } });
    ws.views = [{ showGridLines: false }];
    setupSlipColumns(ws, [1]);
    applySlipPageSetup(ws, 'portrait');
    const lastRow = buildSlipBlock(ws, data, row, shop, masterRow, 1, 1);
    ws.pageSetup.fitToHeight = 1;
    ws.pageSetup.printArea = `A1:F${lastRow}`;
  }

  function buildDebtAudit(wb, data, shop, firstMasterRow) {
    const ws = wb.addWorksheet(DEBT_SHEET, { properties: { defaultRowHeight: 18 } });
    ws.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];
    applyPageSetup(ws, 9, 5, 'landscape');
    drawHeader(ws, 9, shop,
      'กระทบยอดหนี้ยกมา',
      `ยอด ณ เวลาส่งออก · นับเฉพาะรายการเบิกสถานะ “อนุมัติ” · ไม่ลบยอดหักหนี้ซ้ำ`);
    const headers = ['ลำดับ', 'พนักงาน', 'หนี้ก่อนเดือนนี้', 'เบิกคงค้างเดือนนี้', 'รวมคงค้าง', 'หักเบิกเดือนนี้', 'หักหนี้ยกมา', 'หนี้ยกไป', 'หักหนี้ที่บันทึกในระบบ'];
    const widths = [7, 23, 14, 16, 14, 14, 15, 14, 18];
    headers.forEach((h, idx) => {
      const cell = ws.getCell(5, idx + 1);
      cell.value = h;
      cell.font = { name: 'Tahoma', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder();
      ws.getColumn(idx + 1).width = widths[idx];
    });
    ws.getRow(5).height = 28;

    data.rows.forEach((row, idx) => {
      const rr = 6 + idx;
      const mr = firstMasterRow + idx;
      const values = [
        idx + 1,
        `${row.emp.name} ${row.emp.lastname || ''}`.trim(),
        { formula: ref(mr, 'L').slice(1), result: row.carried },
        { formula: ref(mr, 'K').slice(1), result: row.advThis },
        { formula: `C${rr}+D${rr}`, result: r2(row.carried + row.advThis) },
        { formula: ref(mr, 'M').slice(1), result: row.debtDeductAdvance },
        { formula: ref(mr, 'N').slice(1), result: row.debtDeductCarried },
        { formula: ref(mr, 'Q').slice(1), result: row.debtNext },
        row.debtPaidRecorded,
      ];
      values.forEach((v, ci) => {
        const cell = ws.getCell(rr, ci + 1);
        cell.value = v;
        cell.border = thinBorder();
        cell.font = { name: 'Tahoma', size: 9, color: { argb: 'FF1E293B' } };
        cell.alignment = { vertical: 'middle', horizontal: ci === 1 ? 'left' : (ci === 0 ? 'center' : 'right') };
        if (ci >= 2) cell.numFmt = '#,##0.00';
        if (idx % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
      ws.getCell(rr, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
      ws.getCell(rr, 8).font = { name: 'Tahoma', bold: true, size: 9.5, color: { argb: row.debtNext > 0 ? 'FFB91C1C' : 'FF047857' } };
    });
    const totalRow = 6 + data.rows.length;
    ws.mergeCells(totalRow, 1, totalRow, 2);
    ws.getCell(totalRow, 1).value = 'รวมทั้งหมด';
    for (let c = 3; c <= 9; c++) {
      const letter = ws.getColumn(c).letter;
      ws.getCell(totalRow, c).value = { formula: `SUM(${letter}6:${letter}${totalRow - 1})` };
      ws.getCell(totalRow, c).numFmt = '#,##0.00';
    }
    for (let c = 1; c <= 9; c++) {
      const cell = ws.getCell(totalRow, c);
      cell.border = thinBorder();
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.font = { name: 'Tahoma', bold: true, size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: c <= 2 ? 'center' : 'right', vertical: 'middle' };
    }
    const noteRow = totalRow + 2;
    ws.mergeCells(noteRow, 1, noteRow, 9);
    ws.getCell(noteRow, 1).value = 'ลำดับตัดยอด: หักเบิกเดือนนี้ก่อน แล้วค่อยหักหนี้ยกมา · หนี้ยกไป = (เบิกคงค้างเดือนนี้ − หักเบิกเดือนนี้) + (หนี้ก่อนเดือนนี้ − หักหนี้ยกมา)';
    ws.getCell(noteRow, 1).font = { name: 'Tahoma', italic: true, size: 9, color: { argb: 'FF92400E' } };
    ws.getCell(noteRow, 1).alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(noteRow).height = 30;
    ws.pageSetup.printArea = `A1:I${noteRow}`;
  }

  /* ───────────── สร้าง workbook ───────────── */
  async function buildWorkbook(year, month) {
    const shop = await getShop();
    const data = await gatherData(year, month);
    if (!data.rows.length) throw new Error('ไม่มีพนักงานสถานะ "ทำงาน"');

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SK POS';
    wb.created = new Date();
    wb.calcProperties.fullCalcOnLoad = true;

    const master = buildSummary(wb, data, shop);
    buildPrintSlips(wb, data, shop, master.firstData);
    buildDebtAudit(wb, data, shop, master.firstData);
    data.rows.forEach((row, idx) => buildPersonalSlip(wb, data, row, shop, master.firstData + idx, idx));

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
        <p style="font-size:14px;color:#475569;margin-top:6px;font-weight:600;">รายงานเงินเดือน + สลิปเชื่อมสูตร (Excel)</p>
        <p style="font-size:12px;color:#94a3b8;margin-top:2px;">กรอกหน้าแรกจุดเดียว · พิมพ์สลิป 4 คนต่อ A4</p>
      </div>
      <div class="form-group">
        <label class="form-label">เลือกเดือน</label>
        <input type="month" class="form-input" id="v94month" value="${val}">
      </div>
      <ul style="font-size:12px;color:#64748b;line-height:1.8;margin:10px 0 4px;padding-left:18px;">
        <li>ชีตแรก: กรอก/แก้ไขเฉพาะช่องสีฟ้า</li>
        <li>ชีตพิมพ์สลิป: จัดหน้า 4 คนต่อ A4</li>
        <li>ชีตรายคน: เป็นสลิปอย่างเดียวและเชื่อมสูตรจากหน้าแรก</li>
        <li>ชีตตรวจหนี้: กระทบยอดหนี้ยกมากับบัญชีกระดาษ</li>
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
      btn.title = 'รายงานเงินเดือน + สลิป 4 คนต่อ A4 (Excel)';
    });
  }

  function boot() {
    window.v26ShowCSVExport = openExportModal;   // override ปุ่มเดิม
    window.v94ExportPayroll = openExportModal;    // ชื่อใหม่เผื่อเรียกตรง
    window.v94BuildPayrollWorkbook = buildWorkbook; // ใช้ตรวจสอบ/สร้างไฟล์จากข้อมูลระบบโดยตรง
    relabelButtons();
    new MutationObserver(relabelButtons).observe(document.body, { childList: true, subtree: true });
    console.info('%c[v94] ✅%c Payroll Excel | Master-linked slips | 4-up A4 | Debt audit', 'color:#16a34a;font-weight:700', 'color:#6B7280');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
