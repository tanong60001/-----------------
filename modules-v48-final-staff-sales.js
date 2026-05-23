(function () {
  'use strict';

  console.log('[v48] final inventory/checkout/project/staff sales guards loaded');

  const BILL_TABLE = 'บิลขาย';
  const BILL_ITEM_TABLE = 'รายการในบิล';
  const EMP_TABLE = 'พนักงาน';
  const PROJECT_METHOD = 'เบิกของโครงการ';
  const PROJECT_STATUS = 'เบิกของโครงการ';
  const TIER_KEY = 'sk_staff_commission_tiers_v48';

  const money = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const fmt = value => typeof formatNum === 'function'
    ? formatNum(value)
    : money(value).toLocaleString('th-TH');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));

  const js = value => String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');

  function injectStyle() {
    let style = document.getElementById('v48-final-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'v48-final-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      #pos-product-grid .product-card .product-img,
      #pos-product-grid .product-list-img{overflow:hidden!important;background:#f8fafc!important}
      #pos-product-grid .product-card .product-img img,
      #pos-product-grid .product-list-img img{width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;object-fit:fill!important;object-position:center!important;transform:none!important;display:block!important}

      #checkout-overlay .v48-mixed-tone,
      #checkout-overlay .v36-mixed-method-card{border-color:#d8e1ea!important;background:#fff!important;box-shadow:0 10px 22px rgba(15,23,42,.035)!important;color:#334155!important}
      #checkout-overlay .v48-mixed-tone i,
      #checkout-overlay .v36-mixed-method-card i{background:#eef4fb!important;color:#64748b!important}
      #checkout-overlay .v48-mixed-tone h4,
      #checkout-overlay .v48-mixed-tone span,
      #checkout-overlay .v36-mixed-method-card h4,
      #checkout-overlay .v36-mixed-method-card span{color:#334155!important}
      #checkout-overlay .v48-mixed-tone.selected,
      #checkout-overlay .v36-mixed-method-card.selected{border-color:#64748b!important;background:linear-gradient(180deg,#f8fafc,#fff)!important;box-shadow:0 0 0 3px #e2e8f0,0 14px 26px rgba(71,85,105,.08)!important}
      #checkout-overlay .v48-mixed-tone.selected i,
      #checkout-overlay .v36-mixed-method-card.selected i{background:#64748b!important;color:#fff!important}
      #checkout-overlay .v36-mixed-pay-box{border-color:#cbd5e1!important;box-shadow:0 14px 30px rgba(15,23,42,.055)!important}
      #checkout-overlay .v36-mixed-icon{background:#eef4fb!important;color:#475569!important}
      #checkout-overlay .v36-mixed-title{color:#334155!important}

      .v48-sales{max-width:1320px;margin:0 auto;padding:0 8px 44px;color:#0f172a}
      .v48-sales-hero{border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 18px 42px rgba(15,23,42,.08);padding:22px;margin-bottom:16px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}
      .v48-sales-title{display:flex;gap:12px;align-items:center}
      .v48-sales-icon{width:46px;height:46px;border-radius:14px;background:#eef6ff;color:#2563eb;display:flex;align-items:center;justify-content:center}
      .v48-sales-title h2{margin:0;font-size:26px;font-weight:950}
      .v48-sales-title p{margin:3px 0 0;color:#64748b;font-size:13px;font-weight:800}
      .v48-sales-actions{display:flex;gap:8px;flex-wrap:wrap}
      .v48-btn{height:40px;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:10px;padding:0 13px;font-family:inherit;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .v48-btn.primary{background:#2563eb;border-color:#2563eb;color:#fff}
      .v48-month{height:40px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font-family:inherit;font-weight:900;color:#334155}
      .v48-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
      .v48-stat{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;box-shadow:0 10px 24px rgba(15,23,42,.045)}
      .v48-stat span{display:block;color:#64748b;font-size:12px;font-weight:900;margin-bottom:6px}
      .v48-stat strong{font-size:27px;font-weight:950;color:#0f172a}
      .v48-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 12px 28px rgba(15,23,42,.05)}
      .v48-panel-head{padding:16px 18px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .v48-panel-head strong{font-size:16px;font-weight:950}
      .v48-table-wrap{overflow:auto}
      .v48-table{width:100%;border-collapse:collapse;white-space:nowrap}
      .v48-table th{background:#f8fafc;color:#64748b;text-align:left;font-size:12px;font-weight:950;padding:12px 14px;border-bottom:1px solid #e2e8f0}
      .v48-table td{padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155}
      .v48-table tr.staff-row{cursor:pointer}
      .v48-table tr.staff-row:hover td{background:#f8fafc}
      .v48-table .right{text-align:right}
      .v48-rate{display:inline-flex;align-items:center;border-radius:999px;background:#eef6ff;color:#1d4ed8;font-size:12px;font-weight:950;padding:4px 9px}
      .v48-empty{padding:36px;text-align:center;color:#94a3b8;font-weight:900}
      .v48-bill-list{margin-top:14px}
      .v48-comm-row{display:grid;grid-template-columns:1fr 1fr 42px;gap:8px;margin-bottom:8px;align-items:center}
      .v48-comm-row input{height:40px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;font-family:inherit;font-weight:850}
      @media(max-width:900px){.v48-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.v48-sales-hero{align-items:flex-start}.v48-sales-actions{width:100%}.v48-btn,.v48-month{flex:1;justify-content:center}}
      @media(max-width:560px){.v48-stats{grid-template-columns:1fr}.v48-sales-title h2{font-size:22px}}
    `;
  }

  function normalizeMixedCardTone() {
    document.querySelectorAll('#checkout-overlay .v12-method-card,#checkout-overlay .payment-method-btn,#checkout-overlay .sk-pay-method,#checkout-overlay [onclick]').forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g, '');
      const raw = String(el.getAttribute('onclick') || '');
      if (/เงินโอน\+เงินสด|เงินโอน\+เงินสด/.test(text) || (/credit/.test(raw) && /เงินโอน|แยกยอด/.test(text))) {
        el.classList.add('v48-mixed-tone');
      }
    });
  }

  function installMixedToneObserver() {
    normalizeMixedCardTone();
    if (window.__v48MixedObserver) return;
    window.__v48MixedObserver = new MutationObserver(() => normalizeMixedCardTone());
    window.__v48MixedObserver.observe(document.body, { childList: true, subtree: true });
  }

  function isProjectBill(bill) {
    if (!bill) return false;
    const text = `${bill.project_id || ''} ${bill.method || ''} ${bill.status || ''} ${bill.customer_name || ''} ${bill.note || ''}`;
    return !!bill.project_id || /\[โครงการ\]|โครงการ|เบิกของโครงการ|จ่ายของให้โครงการ|ต้นทุนโครงการ|project/i.test(text);
  }

  function isCancelledBill(bill) {
    return /ยกเลิก|คืนสินค้า|void|cancel/i.test(`${bill?.status || ''} ${bill?.method || ''}`);
  }

  async function markSavedProjectBill() {
    let bill = null;
    try { bill = window.v12State?.savedBill; } catch (_) {}
    if (!bill?.id || !isProjectBill(bill)) return;
    const patch = { method: PROJECT_METHOD, status: PROJECT_STATUS, received: 0, change: 0, deposit_amount: 0 };
    try {
      const { data, error } = await db.from(BILL_TABLE).update(patch).eq('id', bill.id).select().maybeSingle();
      if (error) throw error;
      Object.assign(bill, data || patch);
      window.v12State.savedBill = bill;
    } catch (e) {
      console.warn('[v48] mark project bill:', e);
    }
  }

  function loadBillAndItems(billId) {
    return Promise.all([
      db.from(BILL_TABLE).select('*').eq('id', billId).maybeSingle(),
      db.from(BILL_ITEM_TABLE).select('*').eq('bill_id', billId),
    ]).then(([billRes, itemRes]) => {
      if (billRes.error) throw billRes.error;
      if (itemRes.error) throw itemRes.error;
      return { bill: billRes.data, items: itemRes.data || [] };
    });
  }

  function projectNameFromBill(bill) {
    return String(bill?.customer_name || '')
      .replace(/^\s*\[โครงการ\]\s*/i, '')
      .trim() || '-';
  }

  function writeProjectDocument(bill, items) {
    const total = money(bill?.total);
    const dateText = new Date(bill?.date || Date.now()).toLocaleString('th-TH', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const rows = (items || []).map((item, index) => {
      const qty = money(item.qty || item.quantity);
      const price = money(item.price || item.unit_price);
      const line = money(item.total || qty * price);
      return `<tr>
        <td class="c">${index + 1}</td>
        <td>${esc(item.name || item.product_name || '')}</td>
        <td class="c">${fmt(qty)}</td>
        <td class="c">${esc(item.unit || 'ชิ้น')}</td>
        <td class="r">฿${fmt(price)}</td>
        <td class="r strong">฿${fmt(line)}</td>
      </tr>`;
    }).join('');
    const win = window.open('', '_blank', 'width=920,height=980');
    if (!win) {
      if (typeof toast === 'function') toast('กรุณาอนุญาต popup เพื่อพิมพ์เอกสาร', 'error');
      return;
    }
    win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเบิกสินค้าโครงการ #${esc(bill?.bill_no || '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{margin:0;background:#e5e7eb;font-family:Sarabun,sans-serif;color:#111827}.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:12mm 14mm;display:flex;flex-direction:column}.top{display:flex;justify-content:space-between;gap:18px;border-bottom:4px solid #0f766e;padding-bottom:12px}.shop h1{margin:0;font-size:22px;font-weight:900;color:#111827}.shop p{margin:4px 0 0;color:#64748b;font-size:11px;line-height:1.45}.doc{text-align:right}.doc h2{margin:0;background:#0f766e;color:#fff;border-radius:8px;padding:9px 16px;font-size:20px}.doc small{display:block;margin-top:6px;color:#64748b;font-weight:800}.status{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}.status>div{border:1.5px solid #99f6e4;background:#f0fdfa;border-radius:10px;padding:10px 12px}.status span{display:block;color:#0f766e;font-size:11px;font-weight:900}.status b{display:block;margin-top:2px;font-size:15px}.notice{border:1.5px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;border-radius:10px;padding:11px 12px;font-size:12px;font-weight:850;line-height:1.55;margin-bottom:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.box{border:1px solid #e2e8f0;border-radius:9px;padding:10px}.box span{display:block;font-size:11px;color:#64748b;font-weight:850}.box b{display:block;margin-top:2px;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#374151;color:#fff;padding:8px;font-size:12px;text-align:left}td{border-bottom:1px solid #e5e7eb;padding:8px;font-size:12px}tr:nth-child(even) td{background:#f9fafb}.c{text-align:center}.r{text-align:right}.strong{font-weight:900}.summary{margin-left:auto;margin-top:14px;width:270px;border:1.5px solid #99f6e4;border-radius:10px;overflow:hidden}.summary div{display:flex;justify-content:space-between;padding:11px 12px;background:#f0fdfa;font-weight:850}.summary strong{font-size:22px;color:#0f766e}.sign{margin-top:auto;display:flex;justify-content:space-around;gap:42px;padding-top:34px}.sig{text-align:center;min-width:190px}.line{height:32px;border-bottom:1.5px solid #64748b;margin-bottom:6px}.foot{text-align:center;color:#94a3b8;border-top:1px solid #e2e8f0;margin-top:28px;padding-top:8px;font-size:11px}@media print{body{background:#fff}.page{margin:0}}
</style></head><body><div class="page">
<div class="top"><div class="shop"><h1>หจก. เอส เค วัสดุ</h1><p>เอกสารภายในสำหรับเบิกสินค้าเข้าโครงการ<br>เอกสารนี้ไม่ใช่ใบแจ้งหนี้และไม่มี QR เรียกเก็บเงิน</p></div><div class="doc"><h2>ใบเบิกสินค้าโครงการ</h2><small>PROJECT ISSUE NOTE</small><small>เลขที่: ${esc(bill?.bill_no || '-')}</small><small>${esc(dateText)}</small></div></div>
<div class="status"><div><span>สถานะเอกสาร</span><b>เบิกสินค้าเข้าโครงการแล้ว</b></div><div><span>สถานะชำระเงิน</span><b>ไม่ต้องรับชำระจากลูกค้า</b></div></div>
<div class="notice">บิลนี้ถูกจัดเป็นรายการโครงการ ระบบใช้เพื่อตัดสต็อกและบันทึกต้นทุนโครงการเท่านั้น จึงไม่แสดง QR เก็บเงิน และไม่นับเป็นยอดค้างชำระลูกค้า</div>
<div class="grid"><div class="box"><span>โครงการ</span><b>${esc(projectNameFromBill(bill))}</b></div><div class="box"><span>พนักงาน</span><b>${esc(bill?.staff_name || '-')}</b></div><div class="box"><span>วิธีบันทึก</span><b>${PROJECT_METHOD}</b></div><div class="box"><span>อ้างอิงบิล</span><b>#${esc(bill?.bill_no || '-')}</b></div></div>
<table><thead><tr><th style="width:46px;text-align:center">#</th><th>รายการสินค้า</th><th style="width:82px;text-align:center">จำนวน</th><th style="width:82px;text-align:center">หน่วย</th><th style="width:110px;text-align:right">ราคา</th><th style="width:120px;text-align:right">รวม</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="c">ไม่มีรายการสินค้า</td></tr>'}</tbody></table>
<div class="summary"><div><span>มูลค่าสินค้าที่เบิก</span><strong>฿${fmt(total)}</strong></div></div>
<div class="sign"><div class="sig"><div class="line"></div><b>ผู้รับสินค้า / โครงการ</b></div><div class="sig"><div class="line"></div><b>ผู้ส่งสินค้า / ผู้ขาย</b></div></div>
<div class="foot">เอกสารโครงการนี้ไม่มี QR ชำระเงิน เพื่อไม่ให้สับสนกับใบแจ้งยอดค้างชำระ</div>
</div><script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close()},1200)},500)}<\/script></body></html>`);
    win.document.close();
  }

  async function normalizeProjectBillRecord(bill) {
    if (!bill?.id || !isProjectBill(bill)) return bill;
    const patch = { method: PROJECT_METHOD, status: PROJECT_STATUS, received: 0, change: 0, deposit_amount: 0 };
    Object.assign(bill, patch);
    try {
      await db.from(BILL_TABLE).update(patch).eq('id', bill.id);
    } catch (e) {
      console.warn('[v48] normalize project bill:', e);
    }
    return bill;
  }

  function syncGlobal(name) {
    try {
      if (name === 'v12CompletePayment') v12CompletePayment = window[name];
      else if (name === 'v13CompletePayment') v13CompletePayment = window[name];
      else if (name === 'v15CompletePayment') v15CompletePayment = window[name];
      else if (name === 'v16CompletePayment') v16CompletePayment = window[name];
      else if (name === 'v17CompletePayment') v17CompletePayment = window[name];
      else if (name === 'v18CompletePayment') v18CompletePayment = window[name];
      else if (name === 'v24ShowDocSelector') v24ShowDocSelector = window[name];
      else if (name === 'v12PrintReceiptA4') v12PrintReceiptA4 = window[name];
      else if (name === 'v5PrintFromHistory') v5PrintFromHistory = window[name];
      else if (name === 'v12PrintDeposit') v12PrintDeposit = window[name];
      else if (name === 'v24PrintDocument') v24PrintDocument = window[name];
      else if (name === 'printA4') printA4 = window[name];
      else if (name === 'printReceiptA4v2') printReceiptA4v2 = window[name];
      else if (name === 'v37PrintReceiptA4Now') v37PrintReceiptA4Now = window[name];
      else if (name === 'renderAttendance') renderAttendance = window[name];
    } catch (_) {}
  }

  function wrapProjectById(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v48ProjectWrap) return;
    window[name] = async function (billId) {
      try {
        const { bill, items } = await loadBillAndItems(billId);
        if (isProjectBill(bill)) return writeProjectDocument(await normalizeProjectBillRecord(bill), items);
      } catch (e) {
        console.warn('[v48] project print route:', name, e);
      }
      return original.apply(this, arguments);
    };
    window[name].__v48ProjectWrap = true;
    syncGlobal(name);
  }

  function wrapProjectDoc(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v48ProjectWrap) return;
    window[name] = function (bill, items) {
      if (isProjectBill(bill)) {
        normalizeProjectBillRecord(bill);
        return writeProjectDocument(bill, items || []);
      }
      return original.apply(this, arguments);
    };
    window[name].__v48ProjectWrap = true;
    syncGlobal(name);
  }

  function installProjectGuards() {
    const pay = window.v12CompletePayment;
    if (typeof pay === 'function' && !pay.__v48ProjectComplete) {
      window.v12CompletePayment = async function () {
        const result = await pay.apply(this, arguments);
        await markSavedProjectBill();
        return result;
      };
      window.v12CompletePayment.__v48ProjectComplete = true;
      ['v12CompletePayment', 'v13CompletePayment', 'v15CompletePayment', 'v16CompletePayment', 'v17CompletePayment', 'v18CompletePayment'].forEach(name => {
        window[name] = window.v12CompletePayment;
        syncGlobal(name);
      });
    }
    ['v24ShowDocSelector', 'v12PrintReceiptA4', 'v5PrintFromHistory', 'v12PrintDeposit'].forEach(wrapProjectById);
    ['v24PrintDocument', 'printA4', 'printReceiptA4v2', 'v37PrintReceiptA4Now'].forEach(wrapProjectDoc);
  }

  function normalizeTiers(rows) {
    return (rows || [])
      .map(r => ({ threshold: money(r.threshold), rate: money(r.rate) }))
      .filter(r => r.threshold >= 0 && r.rate >= 0)
      .sort((a, b) => a.threshold - b.threshold);
  }

  function defaultTiers() {
    return [{ threshold: 500000, rate: 0.5 }, { threshold: 1000000, rate: 1 }];
  }

  function getTiersLocal() {
    try {
      const rows = JSON.parse(localStorage.getItem(TIER_KEY) || '[]');
      const tiers = normalizeTiers(rows);
      if (tiers.length) return tiers;
    } catch (_) {}
    return defaultTiers();
  }

  async function getTiers() {
    try {
      const { data, error } = await db.from('ตั้งค่าร้านค้า').select('doc_settings').limit(1).maybeSingle();
      if (error) throw error;
      const ds = typeof data?.doc_settings === 'string' ? JSON.parse(data.doc_settings || '{}') : (data?.doc_settings || {});
      const tiers = normalizeTiers(ds.staff_commission_tiers);
      if (tiers.length) {
        localStorage.setItem(TIER_KEY, JSON.stringify(tiers));
        return tiers;
      }
    } catch (e) {
      console.warn('[v48] commission settings remote read fallback:', e?.message || e);
    }
    return getTiersLocal();
  }

  function saveTiers(tiers) {
    localStorage.setItem(TIER_KEY, JSON.stringify(normalizeTiers(tiers)));
  }

  async function saveTiersRemote(tiers) {
    const normalized = normalizeTiers(tiers);
    saveTiers(normalized);
    try {
      const { data: row, error } = await db.from('ตั้งค่าร้านค้า').select('id,doc_settings').limit(1).maybeSingle();
      if (error) throw error;
      const ds = typeof row?.doc_settings === 'string' ? JSON.parse(row.doc_settings || '{}') : (row?.doc_settings || {});
      const payload = { doc_settings: { ...ds, staff_commission_tiers: normalized }, updated_at: new Date().toISOString() };
      if (row?.id) await db.from('ตั้งค่าร้านค้า').update(payload).eq('id', row.id);
      else await db.from('ตั้งค่าร้านค้า').insert(payload);
    } catch (e) {
      console.warn('[v48] commission settings remote save fallback:', e?.message || e);
    }
  }

  function commissionFor(total, tiers) {
    const tier = (tiers || []).reduce((best, row) => money(total) >= row.threshold ? row : best, { threshold: 0, rate: 0 });
    return { tier, commission: money(total) * money(tier.rate) / 100 };
  }

  function monthBounds(monthValue) {
    const [y, m] = String(monthValue || '').split('-').map(Number);
    const base = y && m ? new Date(y, m - 1, 1) : new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      mode: 'month',
      value: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      from: ymd(start), to: ymd(end),
      label: start.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  }

  /* YYYY-MM-DD ตามเวลาท้องถิ่น */
  function ymd(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  function rangeBounds(from, to) {
    const f = new Date(from + 'T00:00:00');
    const t = new Date(to + 'T23:59:59.999');
    const sameDay = ymd(f) === ymd(t);
    const sameMonth = f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth();
    let label;
    if (sameDay) {
      label = f.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    } else if (sameMonth) {
      label = `${f.getDate()}–${t.getDate()} ${f.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`;
    } else {
      label = `${f.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} — ${t.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return {
      mode: 'range',
      from: ymd(f), to: ymd(t),
      value: `${ymd(f)}_${ymd(t)}`,
      label,
      startISO: f.toISOString(),
      endISO: t.toISOString(),
    };
  }

  /* แปลง input จาก renderStaffSalesDashboard:
     - undefined / null → เดือนปัจจุบัน
     - "YYYY-MM" → เดือนนั้น (เดิม)
     - "YYYY-MM-DD_YYYY-MM-DD" → ช่วงวันที่
     - { from, to } → ช่วงวันที่
  */
  function resolveBounds(input) {
    if (!input) return monthBounds();
    if (typeof input === 'object' && input.from && input.to) return rangeBounds(input.from, input.to);
    const s = String(input);
    if (/^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [from, to] = s.split('_');
      return rangeBounds(from, to);
    }
    if (/^\d{4}-\d{2}$/.test(s)) return monthBounds(s);
    return monthBounds();
  }

  async function loadStaffSales(input) {
    const bounds = resolveBounds(input);
    const [{ data: bills, error: billError }, { data: emps }] = await Promise.all([
      db.from(BILL_TABLE)
        .select('id,bill_no,date,total,discount,received,change,staff_name,status,method,customer_name,project_id,note')
        .gte('date', bounds.startISO)
        .lte('date', bounds.endISO)
        .order('date', { ascending: false }),
      db.from(EMP_TABLE).select('id,name,lastname,status').order('name'),
    ]);
    if (billError) throw billError;
    const employeeNames = new Set((emps || []).map(e => `${e.name || ''} ${e.lastname || ''}`.trim()).filter(Boolean));
    const normalBills = (bills || []).filter(b => !isProjectBill(b) && !isCancelledBill(b));
    const byStaff = {};
    normalBills.forEach(b => {
      const key = String(b.staff_name || '').trim() || 'ไม่ระบุพนักงาน';
      if (!byStaff[key]) byStaff[key] = { name: key, bills: [], total: 0, knownEmployee: employeeNames.has(key) };
      byStaff[key].bills.push(b);
      byStaff[key].total += money(b.total);
    });
    const tiers = await getTiers();
    const staff = Object.values(byStaff).map(row => {
      const calc = commissionFor(row.total, tiers);
      return { ...row, rate: calc.tier.rate, threshold: calc.tier.threshold, commission: calc.commission };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'th'));
    return { bounds, bills: normalBills, staff, tiers };
  }

  function billRowsHTML(bills) {
    if (!bills.length) return '<div class="v48-empty">ยังไม่มีบิลขายในช่วงเดือนนี้</div>';
    return `<div class="v48-table-wrap"><table class="v48-table"><thead><tr><th>บิล</th><th>วันที่</th><th>ลูกค้า</th><th>วิธีชำระ</th><th>สถานะ</th><th class="right">ยอดขาย</th></tr></thead><tbody>
      ${bills.map(b => `<tr>
        <td><strong>#${esc(b.bill_no || b.id)}</strong></td>
        <td>${esc(new Date(b.date || Date.now()).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td>
        <td>${esc(b.customer_name || 'ลูกค้าทั่วไป')}</td>
        <td>${esc(b.method || '-')}</td>
        <td>${esc(b.status || '-')}</td>
        <td class="right"><strong>฿${fmt(b.total)}</strong></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }

  async function renderStaffSalesDashboard(input, selectedStaff) {
    const sec = document.getElementById('page-att');
    if (!sec) return;
    injectStyle();
    const current = resolveBounds(input);
    sec.innerHTML = `<div class="v48-sales"><div class="v48-sales-hero"><div class="v48-sales-title"><div class="v48-sales-icon"><i class="material-icons-round">leaderboard</i></div><div><h2>ยอดขายพนักงาน</h2><p>กำลังโหลดยอดขายและค่าคอมมิชชั่น...</p></div></div></div></div>`;
    try {
      const data = await loadStaffSales(current);
      const totalSales = data.staff.reduce((sum, row) => sum + row.total, 0);
      const totalCom = data.staff.reduce((sum, row) => sum + row.commission, 0);
      const activeStaff = selectedStaff || 'ทั้งหมด';
      const picked = activeStaff === 'ทั้งหมด'
        ? { name: 'ทั้งหมด', bills: data.bills }
        : data.staff.find(s => s.name === activeStaff);
      const tiersText = data.tiers.length
        ? data.tiers.map(t => `฿${fmt(t.threshold)} = ${fmt(t.rate)}%`).join(' · ')
        : 'ยังไม่ได้ตั้งค่า';

      sec.innerHTML = `<div class="v48-sales">
        <div class="v48-sales-hero">
          <div class="v48-sales-title">
            <div class="v48-sales-icon"><i class="material-icons-round">leaderboard</i></div>
            <div><h2>ยอดขายพนักงาน</h2><p>${esc(data.bounds.label)} · ไม่รวมบิลโครงการและบิลยกเลิก</p></div>
          </div>
          <div class="v48-sales-actions" style="flex-wrap:wrap;gap:6px;align-items:center">
            <button class="v48-btn" onclick="renderAttendance()"><i class="material-icons-round">arrow_back</i> กลับ</button>
            <div style="display:inline-flex;gap:4px;align-items:center;background:rgba(255,255,255,.92);border-radius:10px;padding:4px 8px">
              <input class="v48-date" type="date" value="${esc(data.bounds.from)}" id="v48-from" style="border:none;background:transparent;font-family:inherit;font-weight:700;color:#0f172a;font-size:13px">
              <span style="color:#64748b;font-size:12px;font-weight:600">—</span>
              <input class="v48-date" type="date" value="${esc(data.bounds.to)}" id="v48-to" style="border:none;background:transparent;font-family:inherit;font-weight:700;color:#0f172a;font-size:13px">
              <button class="v48-btn" style="padding:4px 8px;font-size:11px" onclick="v48ApplyDateRange()">ใช้ช่วงนี้</button>
            </div>
            <button class="v48-btn" onclick="v48QuickRange('today')">วันนี้</button>
            <button class="v48-btn" onclick="v48QuickRange('yesterday')">เมื่อวาน</button>
            <button class="v48-btn" onclick="v48QuickRange('7d')">7 วัน</button>
            <button class="v48-btn" onclick="v48QuickRange('month')">เดือนนี้</button>
            <button class="v48-btn" onclick="v48ShiftStaffSalesRange(-1)"><i class="material-icons-round">chevron_left</i></button>
            <button class="v48-btn" onclick="v48ShiftStaffSalesRange(1)"><i class="material-icons-round">chevron_right</i></button>
            <button class="v48-btn" onclick="v48OpenCommissionSettings()"><i class="material-icons-round">tune</i> ตั้งค่าคอม</button>
            <button class="v48-btn primary" onclick="renderStaffSalesDashboard(window.__v48StaffSalesRange,'${js(activeStaff)}')"><i class="material-icons-round">refresh</i> รีเฟรช</button>
          </div>
        </div>

        <div class="v48-stats">
          <div class="v48-stat"><span>ยอดขายรวม</span><strong>฿${fmt(totalSales)}</strong></div>
          <div class="v48-stat"><span>จำนวนบิล</span><strong>${fmt(data.bills.length)}</strong></div>
          <div class="v48-stat"><span>พนักงานที่มียอด</span><strong>${fmt(data.staff.length)}</strong></div>
          <div class="v48-stat"><span>ค่าคอมรวม</span><strong>฿${fmt(Math.round(totalCom))}</strong></div>
        </div>

        <div class="v48-panel">
          <div class="v48-panel-head"><strong>สรุปตามพนักงาน</strong><span style="color:#64748b;font-size:12px;font-weight:850">ขั้นคอม: ${esc(tiersText)}</span></div>
          <div class="v48-table-wrap"><table class="v48-table">
            <thead><tr><th>พนักงาน</th><th class="right">จำนวนบิล</th><th class="right">ยอดขายเดือนนี้</th><th class="right">อัตราคอม</th><th class="right">ค่าคอม</th></tr></thead>
            <tbody>${data.staff.length ? data.staff.map(row => `<tr class="staff-row" onclick="renderStaffSalesDashboard(window.__v48StaffSalesRange,'${js(row.name)}')">
              <td><strong>${esc(row.name)}</strong>${row.name === activeStaff ? ' <span class="v48-rate">กำลังดู</span>' : ''}</td>
              <td class="right">${fmt(row.bills.length)}</td>
              <td class="right"><strong>฿${fmt(row.total)}</strong></td>
              <td class="right"><span class="v48-rate">${fmt(row.rate)}%</span></td>
              <td class="right"><strong>฿${fmt(Math.round(row.commission))}</strong></td>
            </tr>`).join('') : '<tr><td colspan="5"><div class="v48-empty">ยังไม่มียอดขายพนักงานในเดือนนี้</div></td></tr>'}</tbody>
          </table></div>
        </div>

        <div class="v48-panel v48-bill-list">
          <div class="v48-panel-head"><strong>${activeStaff === 'ทั้งหมด' ? `บิลทั้งหมดในช่วง ${esc(data.bounds.label)}` : `บิลของ ${esc(picked?.name || 'พนักงาน')}`}</strong><button class="v48-btn" onclick="renderStaffSalesDashboard(window.__v48StaffSalesRange,'ทั้งหมด')"><i class="material-icons-round">select_all</i> ดูทั้งหมด</button></div>
          ${billRowsHTML(picked?.bills || [])}
        </div>
      </div>`;
      // เก็บทั้ง 2 ตัว: range (object) สำหรับ logic ใหม่ + month (string) สำหรับ backward compat
      window.__v48StaffSalesRange = data.bounds.mode === 'range'
        ? { from: data.bounds.from, to: data.bounds.to }
        : data.bounds.value;
      window.__v48StaffSalesMonth = data.bounds.value;
      window.__v48StaffSalesSelected = activeStaff;
      installStaffSalesRealtime();
    } catch (e) {
      console.error('[v48] staff sales:', e);
      sec.innerHTML = `<div class="v48-sales"><div class="v48-panel"><div class="v48-empty" style="color:#dc2626">โหลดรายงานยอดขายพนักงานไม่สำเร็จ: ${esc(e.message)}</div></div></div>`;
    }
  }

  function injectStaffSalesButton() {
    const grid = document.querySelector('#page-att .v26-actions-grid');
    if (!grid || grid.querySelector('[data-v48-staff-sales]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.dataset.v48StaffSales = '1';
    btn.innerHTML = '<i class="material-icons-round">leaderboard</i> ยอดขายพนักงาน';
    btn.onclick = () => renderStaffSalesDashboard();
    grid.insertBefore(btn, grid.children[2] || null);
  }

  function installAttendanceButtonWrap() {
    const current = window.renderAttendance;
    if (typeof current !== 'function' || current.__v48StaffSalesWrap) {
      injectStaffSalesButton();
      return;
    }
    window.renderAttendance = async function () {
      const result = await current.apply(this, arguments);
      setTimeout(injectStaffSalesButton, 30);
      setTimeout(injectStaffSalesButton, 300);
      return result;
    };
    window.renderAttendance.__v48StaffSalesWrap = true;
    syncGlobal('renderAttendance');
    injectStaffSalesButton();
  }

  function installStaffSalesRealtime() {
    if (window.__v48StaffSalesRealtime || !db?.channel) return;
    let timer = null;
    window.__v48StaffSalesRealtime = db.channel('v48-staff-sales')
      .on('postgres_changes', { event: '*', schema: 'public', table: BILL_TABLE }, () => {
        if (!document.querySelector('#page-att .v48-sales')) return;
        clearTimeout(timer);
        timer = setTimeout(() => renderStaffSalesDashboard(window.__v48StaffSalesRange || window.__v48StaffSalesMonth, window.__v48StaffSalesSelected), 500);
      })
      .subscribe(status => console.info('[v48] staff sales realtime:', status));
  }

  window.renderStaffSalesDashboard = renderStaffSalesDashboard;

  /* ── ช่วงวันที่ helpers ── */
  window.v48ApplyDateRange = function () {
    const fromEl = document.getElementById('v48-from');
    const toEl = document.getElementById('v48-to');
    const from = fromEl?.value, to = toEl?.value;
    if (!from || !to) return;
    if (from > to) {
      try { toast?.('วันเริ่มต้นต้องน้อยกว่าหรือเท่ากับวันสิ้นสุด', 'warning'); } catch (_) {}
      return;
    }
    renderStaffSalesDashboard({ from, to }, window.__v48StaffSalesSelected);
  };

  window.v48QuickRange = function (preset) {
    const today = new Date();
    let from, to;
    if (preset === 'today') {
      from = to = ymd(today);
    } else if (preset === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      from = to = ymd(y);
    } else if (preset === '7d') {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      from = ymd(s); to = ymd(today);
    } else if (preset === 'month') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      from = ymd(s); to = ymd(e);
    } else {
      return;
    }
    renderStaffSalesDashboard({ from, to }, window.__v48StaffSalesSelected);
  };

  window.v48ShiftStaffSalesRange = function (delta) {
    const cur = window.__v48StaffSalesRange;
    if (cur && typeof cur === 'object' && cur.from && cur.to) {
      // เลื่อนช่วงตามความกว้างของช่วง (1 วันก็เลื่อนทีละวัน, 7 วันก็เลื่อนทีละ 7 วัน)
      const f = new Date(cur.from + 'T00:00:00');
      const t = new Date(cur.to + 'T00:00:00');
      const widthDays = Math.round((t - f) / 86400000) + 1;
      const newF = new Date(f); newF.setDate(newF.getDate() + delta * widthDays);
      const newT = new Date(t); newT.setDate(newT.getDate() + delta * widthDays);
      return renderStaffSalesDashboard({ from: ymd(newF), to: ymd(newT) }, window.__v48StaffSalesSelected);
    }
    // fallback: shift by month (โหมดเก่า)
    return window.v48ShiftStaffSalesMonth(window.__v48StaffSalesMonth, delta);
  };

  window.v48ShiftStaffSalesMonth = function (monthValue, delta) {
    const [y, m] = String(monthValue || monthBounds().value).split('-').map(Number);
    const d = new Date(y || new Date().getFullYear(), (m || new Date().getMonth() + 1) - 1 + Number(delta || 0), 1);
    return renderStaffSalesDashboard(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  window.v48OpenCommissionSettings = async function () {
    const tiers = await getTiers();
    const rows = tiers.map(t => `<div class="v48-comm-row"><input type="number" min="0" step="1000" value="${t.threshold}" placeholder="ยอดขายตั้งแต่"><input type="number" min="0" step="0.01" value="${t.rate}" placeholder="% คอม"><button type="button" class="v48-btn" data-del><i class="material-icons-round">delete</i></button></div>`).join('');
    const html = `<div style="text-align:left"><p style="margin:0 0 10px;color:#64748b;font-weight:800">ตั้งขั้นคอมมิชชั่นจากยอดขายต่อเดือนของพนักงานแต่ละคน เช่น 500000 = 0.5%</p><div id="v48-comm-rows">${rows}</div><button type="button" class="v48-btn" id="v48-add-tier"><i class="material-icons-round">add</i> เพิ่มขั้น</button></div>`;
    const result = await Swal.fire({
      title: 'ตั้งค่าคอมมิชชั่น',
      html,
      width: 620,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      didOpen: () => {
        const box = document.getElementById('v48-comm-rows');
        const bind = () => box?.querySelectorAll('[data-del]').forEach(btn => {
          btn.onclick = () => {
            btn.closest('.v48-comm-row')?.remove();
          };
        });
        bind();
        document.getElementById('v48-add-tier')?.addEventListener('click', () => {
          box?.insertAdjacentHTML('beforeend', '<div class="v48-comm-row"><input type="number" min="0" step="1000" value="0" placeholder="ยอดขายตั้งแต่"><input type="number" min="0" step="0.01" value="0" placeholder="% คอม"><button type="button" class="v48-btn" data-del><i class="material-icons-round">delete</i></button></div>');
          bind();
        });
      },
      preConfirm: () => Array.from(document.querySelectorAll('#v48-comm-rows .v48-comm-row')).map(row => {
        const inputs = row.querySelectorAll('input');
        return { threshold: money(inputs[0]?.value), rate: money(inputs[1]?.value) };
      }).filter(row => row.threshold >= 0 && row.rate >= 0),
    });
    if (result.isConfirmed) {
      await saveTiersRemote(result.value || []);
      if (typeof toast === 'function') toast('บันทึกขั้นคอมมิชชั่นแล้ว', 'success');
      if (document.querySelector('#page-att .v48-sales')) renderStaffSalesDashboard(window.__v48StaffSalesRange || window.__v48StaffSalesMonth, window.__v48StaffSalesSelected);
    }
  };

  window.v48NormalizeProjectBill = async function (billId) {
    const { bill } = await loadBillAndItems(billId);
    if (!isProjectBill(bill)) return false;
    const { error } = await db.from(BILL_TABLE).update({ method: PROJECT_METHOD, status: PROJECT_STATUS, received: 0, change: 0, deposit_amount: 0 }).eq('id', billId);
    if (error) throw error;
    return true;
  };

  function boot() {
    injectStyle();
    installMixedToneObserver();
    installProjectGuards();
    installAttendanceButtonWrap();
    [150, 500, 1200, 2500, 4500, 7000].forEach(delay => setTimeout(() => {
      injectStyle();
      installMixedToneObserver();
      installProjectGuards();
      installAttendanceButtonWrap();
    }, delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
