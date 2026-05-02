(function () {
  'use strict';

  console.log('[v46] multi-device, scanner, payroll patch loaded');

  const SCAN_GAP_MS = 90;
  const SCAN_IDLE_MS = 700;
  let scanBuffer = '';
  let lastScanKeyAt = 0;
  let realtimeChannel = null;

  const fmt = n => typeof formatNum === 'function'
    ? formatNum(n)
    : Number(n || 0).toLocaleString('th-TH');
  const num = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));

  const thaiToEn = {
    'ๅ': '1', '/': '2', '-': '3', 'ภ': '4', 'ถ': '5', 'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0',
    'ข': '-', 'ช': '=', 'ๆ': 'q', 'ไ': 'w', 'ำ': 'e', 'พ': 'r', 'ะ': 't', 'ั': 'y', 'ี': 'u', 'ร': 'i',
    'น': 'o', 'ย': 'p', 'บ': '[', 'ล': ']', 'ฃ': '\\', 'ฟ': 'a', 'ห': 's', 'ก': 'd', 'ด': 'f',
    'เ': 'g', '้': 'h', '่': 'j', 'า': 'k', 'ส': 'l', 'ว': ';', 'ง': "'", 'ผ': 'z', 'ป': 'x',
    'แ': 'c', 'อ': 'v', 'ิ': 'b', 'ื': 'n', 'ท': 'm', 'ม': ',', 'ใ': '.', 'ฝ': '/',
    '+': '!', '๑': '@', '๒': '#', '๓': '$', '๔': '%', 'ู': '^', '฿': '&', '๕': '*', '๖': '(',
    '๗': ')', '๘': '_', '๙': '+', '๐': 'Q', '"': 'W', 'ฎ': 'E', 'ฑ': 'R', 'ธ': 'T', 'ํ': 'Y',
    '๊': 'U', 'ณ': 'I', 'ฯ': 'O', 'ญ': 'P', 'ฐ': '{', ',': '}', 'ฅ': '|', 'ฤ': 'A', 'ฆ': 'S',
    'ฏ': 'D', 'โ': 'F', 'ฌ': 'G', '็': 'H', '๋': 'J', 'ษ': 'K', 'ศ': 'L', 'ซ': ':', '.': '"',
    '(': 'Z', ')': 'X', 'ฉ': 'C', 'ฮ': 'V', 'ฺ': 'B', '์': 'N', '?': 'M', 'ฒ': '<', 'ฬ': '>',
    'ฦ': '?',
  };
  const thaiDigits = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' };

  function normalizeBarcode(raw) {
    const text = String(raw || '').trim();
    if (!/[ก-๙]/.test(text)) return text;
    return text.split('').map(ch => thaiDigits[ch] || thaiToEn[ch] || ch).join('').trim();
  }

  function isPosPage() {
    try { return currentPage === 'pos'; } catch (_) { return false; }
  }

  function isEditable(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function clearScannerInput() {
    scanBuffer = '';
    const search = document.getElementById('pos-search');
    if (search) {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function processBarcode(raw) {
    const code = normalizeBarcode(raw);
    if (!code) return false;
    const ok = typeof window.v40AddBarcodeToCartOnce === 'function'
      ? window.v40AddBarcodeToCartOnce(code)
      : addBarcodeFallback(code);
    if (ok) clearScannerInput();
    return ok;
  }

  function addBarcodeFallback(code) {
    const list = (() => {
      try { if (Array.isArray(products)) return products; } catch (_) {}
      return Array.isArray(window.products) ? window.products : [];
    })();
    const found = list.find(p => String(p.barcode || '').trim() === code);
    const search = document.getElementById('pos-search');
    if (!found) {
      if (search) search.value = code;
      if (typeof toast === 'function') toast('ไม่พบบาร์โค้ดนี้ในระบบ', 'warning');
      return false;
    }
    if (num(found.stock) <= 0) {
      if (typeof toast === 'function') toast('สินค้าหมดสต็อก', 'error');
      return false;
    }
    if (typeof addToCart === 'function') addToCart(found.id);
    if (typeof toast === 'function') toast(`เพิ่ม ${found.name} แล้ว`, 'success');
    return true;
  }

  function installHardwareScanner() {
    if (window.__v46ScannerInstalled) return;
    window.__v46ScannerInstalled = true;

    document.addEventListener('keydown', event => {
      if (!isPosPage() || event.ctrlKey || event.altKey || event.metaKey) return;
      const search = document.getElementById('pos-search');
      if (!search) return;
      const active = document.activeElement;

      if (event.key === 'Enter' || event.key === 'Tab') {
        const raw = active === search ? search.value : scanBuffer;
        if (raw) {
          event.preventDefault();
          event.stopPropagation();
          processBarcode(raw);
          scanBuffer = '';
        }
        return;
      }

      if (event.key.length !== 1 || isEditable(active)) return;

      const now = Date.now();
      if (now - lastScanKeyAt > SCAN_GAP_MS) scanBuffer = '';
      lastScanKeyAt = now;
      scanBuffer += event.key;

      event.preventDefault();
      event.stopPropagation();
      search.focus({ preventScroll: true });
      search.value = normalizeBarcode(scanBuffer);
      search.dispatchEvent(new Event('input', { bubbles: true }));

      clearTimeout(window.__v46ScanIdleTimer);
      window.__v46ScanIdleTimer = setTimeout(() => { scanBuffer = ''; }, SCAN_IDLE_MS);
    }, true);

    document.addEventListener('keydown', event => {
      const search = document.getElementById('pos-search');
      if (!isPosPage() || event.key !== 'Enter' || document.activeElement !== search) return;
      const code = normalizeBarcode(search.value);
      if (!code) return;
      event.preventDefault();
      event.stopPropagation();
      processBarcode(code);
    }, true);
  }

  function debounce(fn, delay) {
    let t = 0;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, delay);
    };
  }

  const refreshProducts = debounce(async () => {
    try {
      if (typeof loadProducts === 'function') await loadProducts();
      try { window._v9ProductsCache = products; } catch (_) {}
      if (isPosPage() && typeof renderProductGrid === 'function') renderProductGrid();
      if (currentPage === 'inv' && typeof renderInventory === 'function') renderInventory();
      if (typeof updateHomeStats === 'function') updateHomeStats();
    } catch (e) {
      console.warn('[v46] realtime products refresh:', e);
    }
  }, 350);

  const refreshCash = debounce(async () => {
    try {
      if (typeof loadCashBalance === 'function') await loadCashBalance();
      if (currentPage === 'cash' && typeof renderCashDrawer === 'function') await renderCashDrawer();
    } catch (e) {
      console.warn('[v46] realtime cash refresh:', e);
    }
  }, 350);

  const refreshPayroll = debounce(async () => {
    try {
      if (currentPage === 'att' && typeof renderPayrollV26 === 'function' && window._v41Payroll) await renderPayrollV26();
    } catch (e) {
      console.warn('[v46] realtime payroll refresh:', e);
    }
  }, 500);

  function installRealtimeSync() {
    if (realtimeChannel || typeof db === 'undefined' || typeof db.channel !== 'function') return;
    try {
      realtimeChannel = db.channel('v46-multi-device-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'สินค้า' }, refreshProducts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'บิลขาย' }, () => {
          refreshProducts();
          try { if (typeof updateHomeStats === 'function') updateHomeStats(); } catch (_) {}
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'จ่ายเงินเดือน' }, refreshPayroll)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_session' }, refreshCash)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_transaction' }, refreshCash)
        .subscribe(status => console.info('[v46] realtime sync:', status));
    } catch (e) {
      console.warn('[v46] realtime unavailable:', e);
    }
  }

  async function activeCashSession() {
    const { data, error } = await db.from('cash_session')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function payrollRow(eid) {
    return (window._v41Payroll?.rows || []).find(x => String(x.emp.id) === String(eid));
  }

  function payrollName(emp) {
    return [emp?.name, emp?.lastname].filter(Boolean).join(' ').trim();
  }

  function currentUserName() {
    try { return USER?.username || ''; } catch (_) { return ''; }
  }

  async function reduceAdvanceDebt(eid, amount) {
    let remainingDebt = num(amount);
    if (remainingDebt <= 0) return;
    const advRes = await db.from('เบิกเงิน')
      .select('*')
      .eq('employee_id', eid)
      .eq('status', 'อนุมัติ')
      .order('date', { ascending: true });
    if (advRes.error) throw advRes.error;
    for (const adv of (advRes.data || [])) {
      if (remainingDebt <= 0) break;
      const advAmount = num(adv.amount);
      if (advAmount <= remainingDebt) {
        await db.from('เบิกเงิน').update({ status: 'ชำระแล้ว' }).eq('id', adv.id);
        remainingDebt -= advAmount;
      } else {
        await db.from('เบิกเงิน').update({ amount: advAmount - remainingDebt }).eq('id', adv.id);
        remainingDebt = 0;
      }
    }
  }

  async function savePayrollRow(payload, extra) {
    const insertRes = await db.from('จ่ายเงินเดือน').insert(payload).select().single();
    if (!insertRes.error) return insertRes.data;

    const msg = String(insertRes.error.message || '');
    const duplicate = insertRes.error.code === '23505' || /duplicate|unique/i.test(msg);
    if (!duplicate) throw insertRes.error;

    const existingRes = await db.from('จ่ายเงินเดือน')
      .select('*')
      .eq('employee_id', payload.employee_id)
      .eq('month', payload.month)
      .limit(1)
      .maybeSingle();
    if (existingRes.error) throw existingRes.error;
    if (!existingRes.data) throw insertRes.error;

    const existing = existingRes.data;
    const oldNote = String(existing.note || '').trim();
    const newNote = String(payload.note || '').trim();
    const updatePayload = {
      working_days: payload.working_days,
      base_salary: payload.base_salary,
      deduct_withdraw: num(existing.deduct_withdraw) + num(payload.deduct_withdraw),
      deduct_absent: payload.deduct_absent,
      bonus: num(existing.bonus) + num(payload.bonus),
      net_paid: num(existing.net_paid) + num(payload.net_paid),
      paid_date: payload.paid_date,
      staff_name: payload.staff_name,
      note: [oldNote, newNote ? `เพิ่ม ${new Date().toLocaleString('th-TH')}: ${newNote}` : ''].filter(Boolean).join('\n'),
    };
    const updateRes = await db.from('จ่ายเงินเดือน').update(updatePayload).eq('id', existing.id).select().single();
    if (updateRes.error) throw updateRes.error;
    updateRes.data.__v46Merged = true;
    updateRes.data.__v46CurrentPaid = extra.currentPaid;
    return updateRes.data;
  }

  function installPayrollSavePatch() {
    if (window.v41SavePayroll?.__v46multiPay) return;
    window.v41SavePayroll = async function (eid) {
      const row = payrollRow(eid);
      if (!row || typeof window.v41ValidatePayroll === 'function' && !window.v41ValidatePayroll(eid)) return;
      if (window.__v46PayrollSaving) return;

      const btn = document.getElementById('v41-save-' + eid);
      const recv = num(document.getElementById('v41-recv-' + eid)?.value);
      const debt = num(document.getElementById('v41-debt-' + eid)?.value);
      const ss = num(document.getElementById('v41-ss-' + eid)?.value);
      const other = num(document.getElementById('v41-other-' + eid)?.value);
      const method = document.getElementById('v41-method-' + eid)?.value || 'เงินสด';
      const note = document.getElementById('v41-note-' + eid)?.value || '';
      const name = payrollName(row.emp);

      const ok = await Swal.fire({
        title: 'ยืนยันจ่ายเงินเดือน',
        html: `<b>${esc(name)}</b><br>รับจริง ฿${fmt(recv)}<br>รวมหัก ฿${fmt(debt + ss + other)}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626',
      });
      if (!ok.isConfirmed) return;

      window.__v46PayrollSaving = true;
      if (btn) btn.disabled = true;
      try {
        let session = null;
        if (method === 'เงินสด' && recv > 0) {
          if (typeof assertCashEnough === 'function') await assertCashEnough(recv, 'จ่ายเงินเดือน');
          session = await activeCashSession();
          if (!session) throw new Error('ยังไม่ได้เปิดรอบลิ้นชักเงินสด');
        }

        let noteText = ['จ่ายทาง ' + method, note].filter(Boolean).join(' | ');
        if (ss) noteText += ' | หักประกันสังคม ฿' + ss;
        if (other) noteText += ' | หักอื่น ๆ ฿' + other;

        const payload = {
          employee_id: eid,
          month: window._v41Payroll.range.start,
          working_days: row.workDays,
          base_salary: row.gross,
          deduct_withdraw: debt,
          deduct_absent: row.absentDeduct,
          bonus: 0,
          net_paid: recv,
          paid_date: new Date().toISOString(),
          staff_name: currentUserName(),
          note: noteText,
        };
        const saved = await savePayrollRow(payload, { currentPaid: recv });

        if (debt > 0) await reduceAdvanceDebt(eid, debt);

        if (method === 'เงินสด' && recv > 0 && typeof window.recordCashTx === 'function') {
          await window.recordCashTx({
            sessionId: session.id,
            type: 'จ่ายเงินเดือน',
            direction: 'out',
            amount: recv,
            netAmount: recv,
            refId: saved.id,
            refTable: 'จ่ายเงินเดือน',
            note: name,
          });
        }
        try { if (typeof logActivity === 'function') logActivity('จ่ายเงินเดือน', `${name} ฿${fmt(recv)}`, saved.id, 'จ่ายเงินเดือน'); } catch (_) {}
        await Swal.fire({
          icon: 'success',
          title: saved.__v46Merged ? 'บันทึกเพิ่มในงวดเดิมแล้ว' : 'บันทึกเงินเดือนแล้ว',
          timer: 1200,
          showConfirmButton: false,
        });
        if (typeof renderPayrollV26 === 'function') await renderPayrollV26();
        if (typeof loadCashBalance === 'function') await loadCashBalance();
      } catch (e) {
        console.error('[v46] payroll save:', e);
        await Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e.message || String(e) });
      } finally {
        window.__v46PayrollSaving = false;
        if (btn) btn.disabled = false;
      }
    };
    window.v41SavePayroll.__v46multiPay = true;
  }

  function injectStyle() {
    if (document.getElementById('v46-style')) return;
    const style = document.createElement('style');
    style.id = 'v46-style';
    style.textContent = `
      .product-card .product-img,
      .product-list-img{
        overflow:hidden!important;
        background:#f8fafc!important;
      }
      .product-card .product-img img,
      .product-list-img img{
        width:100%!important;
        height:100%!important;
        min-width:100%!important;
        min-height:100%!important;
        object-fit:cover!important;
        object-position:center!important;
        display:block!important;
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyle();
    installHardwareScanner();
    installRealtimeSync();
    installPayrollSavePatch();
    [300, 900, 1800, 3500].forEach(delay => setTimeout(installPayrollSavePatch, delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
