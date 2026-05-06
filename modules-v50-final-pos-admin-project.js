(function () {
  'use strict';

  console.log('[v50] final POS compact, admin commission card, project print guard loaded');

  const BILL_TABLE = 'บิลขาย';
  const ITEM_TABLE = 'รายการในบิล';
  const PROJECT_METHOD = 'เบิกของโครงการ';
  const PROJECT_STATUS = 'เบิกของโครงการ';

  const money = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => typeof formatNum === 'function' ? formatNum(value) : money(value).toLocaleString('th-TH');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function parseInfoV50(value) {
    if (!value) return {};
    if (typeof value === 'string') {
      try { return JSON.parse(value) || {}; } catch (_) { return {}; }
    }
    return (typeof value === 'object') ? { ...value } : {};
  }

  function enrichPromoPrintBillV50(bill, items) {
    if (!bill) return bill;
    const list = Array.isArray(items) ? items : [];
    const info = parseInfoV50(bill.return_info);
    const existing = Array.isArray(info.item_discounts) ? info.item_discounts : [];
    const promoMap = (() => {
      try { return JSON.parse(localStorage.getItem('sk_pos_product_promotions_v1') || '{}') || {}; } catch (_) { return {}; }
    })();
    const productList = (() => {
      try { return Array.isArray(products) ? products : []; } catch (_) { return Array.isArray(window.products) ? window.products : []; }
    })();
    const byProduct = new Set(existing.map(d => String(d.product_id || '')));
    const inferred = list.map((item, index) => {
      const productId = item.product_id || item.id;
      if (!productId || byProduct.has(String(productId))) return null;
      const product = productList.find(p => String(p.id) === String(productId));
      const percent = Math.max(0, money(promoMap[productId]));
      const net = money(item.price || item.unit_price || 0);
      const original = money(item.original_price || product?.price || 0);
      const qty = money(item.qty || item.quantity || 1);
      const discountPerUnit = Math.max(0, original - net);
      if (percent <= 0 || original <= net || discountPerUnit <= 0) return null;
      return {
        product_id: productId,
        product_name: item.name || item.product_name || product?.name || '',
        cart_index: index,
        percent,
        discount_per_unit: Number(discountPerUnit.toFixed(2)),
        discount_total: Number((discountPerUnit * qty).toFixed(2)),
        original_price: Number(original.toFixed(2)),
        net_price: Number(net.toFixed(2)),
      };
    }).filter(Boolean);
    if (!existing.length && !inferred.length) return bill;
    return {
      ...bill,
      return_info: {
        ...info,
        item_discounts: [...existing, ...inferred],
      },
    };
  }

  function injectStyle() {
    document.getElementById('v50-final-style')?.remove();
    const style = document.createElement('style');
    style.id = 'v50-final-style';
    style.textContent = `
      .pos-products #pos-product-grid.product-grid{
        grid-template-columns:repeat(auto-fill,minmax(138px,1fr))!important;
        grid-auto-rows:258px!important;
        gap:12px!important;
        align-items:start!important;
        align-content:start!important;
      }
      .pos-products #pos-product-grid .product-card{
        min-height:0!important;
        height:258px!important;
        max-height:258px!important;
        border-width:1px!important;
        border-color:#e6edf5!important;
        border-radius:8px!important;
        box-shadow:none!important;
        display:flex!important;
        flex-direction:column!important;
        overflow:hidden!important;
        background:#fff!important;
      }
      .pos-products #pos-product-grid .product-card:hover{
        border-color:#cbd5e1!important;
        transform:translateY(-1px)!important;
        box-shadow:0 10px 22px rgba(15,23,42,.07)!important;
      }
      .pos-products #pos-product-grid .product-card .product-img{
        height:122px!important;
        min-height:0!important;
        flex:0 0 122px!important;
        aspect-ratio:auto!important;
        overflow:hidden!important;
        background:#f4f7fa!important;
      }
      .pos-products #pos-product-grid .product-card:hover .product-img{transform:none!important}
      .pos-products #pos-product-grid .product-card .product-img img{
        width:100%!important;
        height:100%!important;
        min-width:100%!important;
        min-height:100%!important;
        object-fit:cover!important;
        object-position:center!important;
        transform:scale(1.12)!important;
        transform-origin:center!important;
        display:block!important;
      }
      .pos-products #pos-product-grid .product-img i{font-size:30px!important;color:#cbd5e1!important}
      .pos-products #pos-product-grid .product-info{
        padding:11px 12px 12px!important;
        gap:6px!important;
        height:136px!important;
        min-height:136px!important;
        max-height:136px!important;
        flex:0 0 136px!important;
        display:flex!important;
        flex-direction:column!important;
        background:#fff!important;
      }
      .pos-products #pos-product-grid .product-name{
        font-size:12px!important;
        line-height:1.28!important;
        min-height:46px!important;
        max-height:46px!important;
        overflow:hidden!important;
        display:-webkit-box!important;
        -webkit-line-clamp:3!important;
        -webkit-box-orient:vertical!important;
      }
      .pos-products #pos-product-grid .product-sku{
        font-size:10px!important;
        line-height:1.2!important;
        height:16px!important;
        max-height:16px!important;
        margin-top:0!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
      }
      .pos-products #pos-product-grid .product-footer{
        margin-top:auto!important;
        height:30px!important;
        min-height:30px!important;
        align-items:flex-end!important;
        display:flex!important;
        justify-content:space-between!important;
        gap:8px!important;
      }
      .pos-products #pos-product-grid .product-price{font-size:17px!important;line-height:1!important}
      .pos-products #pos-product-grid .product-stock{font-size:11px!important;line-height:1!important;white-space:nowrap!important}

      .v50-commission-card .v36-admin-menu-icon{background:#ede9fe!important;color:#7c3aed!important}
    `;
    document.head.appendChild(style);
  }

  function isProjectBill(bill) {
    if (!bill) return false;
    const text = `${bill.project_id || ''} ${bill.customer_name || ''} ${bill.method || ''} ${bill.status || ''} ${bill.note || ''}`;
    return !!bill.project_id || /\[โครงการ\]|โครงการ|เบิกของโครงการ|จ่ายของให้โครงการ|ต้นทุนโครงการ|project/i.test(text);
  }

  async function loadBill(billId) {
    const [{ data: bill, error: billError }, { data: items, error: itemError }] = await Promise.all([
      db.from(BILL_TABLE).select('*').eq('id', billId).maybeSingle(),
      db.from(ITEM_TABLE).select('*').eq('bill_id', billId),
    ]);
    if (billError) throw billError;
    if (itemError) throw itemError;
    return { bill, items: items || [] };
  }

  async function normalizeProjectBill(bill) {
    if (!bill?.id || !isProjectBill(bill)) return bill;
    Object.assign(bill, { method: PROJECT_METHOD, status: PROJECT_STATUS, received: 0, change: 0, deposit_amount: 0 });
    try {
      await db.from(BILL_TABLE).update({
        method: PROJECT_METHOD,
        status: PROJECT_STATUS,
        received: 0,
        change: 0,
        deposit_amount: 0,
      }).eq('id', bill.id);
    } catch (e) {
      console.warn('[v50] normalize project bill:', e);
    }
    return bill;
  }

  function projectName(bill) {
    return String(bill?.customer_name || '').replace(/^\s*\[โครงการ\]\s*/i, '').trim() || '-';
  }

  async function printProjectDoc(bill, items) {
    bill = await normalizeProjectBill(bill);
    const rows = (items || []).map((item, index) => {
      const qty = money(item.qty || item.quantity);
      const price = money(item.price || item.unit_price);
      const total = money(item.total || qty * price);
      return `<tr><td class="c">${index + 1}</td><td>${esc(item.name || item.product_name || '')}</td><td class="c">${fmt(qty)}</td><td class="c">${esc(item.unit || 'ชิ้น')}</td><td class="r">฿${fmt(price)}</td><td class="r b">฿${fmt(total)}</td></tr>`;
    }).join('');
    const total = money(bill?.total);
    const date = new Date(bill?.date || Date.now()).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const win = window.open('', '_blank', 'width=920,height=980');
    if (!win) {
      if (typeof toast === 'function') toast('กรุณาอนุญาต popup เพื่อพิมพ์เอกสาร', 'error');
      return;
    }
    win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเบิกสินค้าโครงการ #${esc(bill?.bill_no || '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{margin:0;background:#f1f5f9;font-family:Sarabun,sans-serif;color:#0f172a}.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:12mm 14mm;display:flex;flex-direction:column}.top{display:flex;justify-content:space-between;gap:18px;border-bottom:4px solid #0f766e;padding-bottom:12px}.shop h1{margin:0;font-size:22px;font-weight:900}.shop p{margin:4px 0 0;color:#64748b;font-size:11px;line-height:1.45}.doc{text-align:right}.doc h2{margin:0;background:#0f766e;color:#fff;border-radius:8px;padding:9px 16px;font-size:20px}.doc small{display:block;margin-top:6px;color:#64748b;font-weight:800}.status{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}.status>div{border:1.5px solid #99f6e4;background:#f0fdfa;border-radius:10px;padding:10px 12px}.status span{display:block;color:#0f766e;font-size:11px;font-weight:900}.status b{display:block;margin-top:2px;font-size:15px}.notice{border:1.5px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;border-radius:10px;padding:11px 12px;font-size:12px;font-weight:850;line-height:1.55;margin-bottom:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.box{border:1px solid #e2e8f0;border-radius:9px;padding:10px}.box span{display:block;font-size:11px;color:#64748b;font-weight:850}.box b{display:block;margin-top:2px;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#334155;color:#fff;padding:8px;font-size:12px;text-align:left}td{border-bottom:1px solid #e5e7eb;padding:8px;font-size:12px}tr:nth-child(even) td{background:#f8fafc}.c{text-align:center}.r{text-align:right}.b{font-weight:900}.summary{margin-left:auto;margin-top:14px;width:270px;border:1.5px solid #99f6e4;border-radius:10px;overflow:hidden}.summary div{display:flex;justify-content:space-between;padding:11px 12px;background:#f0fdfa;font-weight:850}.summary strong{font-size:22px;color:#0f766e}.sign{margin-top:auto;display:flex;justify-content:space-around;gap:42px;padding-top:34px}.sig{text-align:center;min-width:190px}.line{height:32px;border-bottom:1.5px solid #64748b;margin-bottom:6px}.foot{text-align:center;color:#94a3b8;border-top:1px solid #e2e8f0;margin-top:28px;padding-top:8px;font-size:11px}@media print{body{background:#fff}.page{margin:0}}</style></head><body><div class="page">
<div class="top"><div class="shop"><h1>หจก. เอส เค วัสดุ</h1><p>เอกสารภายในสำหรับเบิกสินค้าเข้าโครงการ<br>ไม่ใช่ใบแจ้งหนี้ ไม่ใช่ยอดค้างชำระ และไม่มี QR เรียกเก็บเงิน</p></div><div class="doc"><h2>ใบเบิกสินค้าโครงการ</h2><small>PROJECT ISSUE NOTE</small><small>เลขที่: ${esc(bill?.bill_no || '-')}</small><small>${esc(date)}</small></div></div>
<div class="status"><div><span>สถานะเอกสาร</span><b>เบิกสินค้าเข้าโครงการแล้ว</b></div><div><span>สถานะชำระเงิน</span><b>ไม่ต้องรับชำระจากลูกค้า</b></div></div>
<div class="notice">เอกสารนี้ใช้สำหรับตัดสต็อกและบันทึกต้นทุนโครงการเท่านั้น จึงไม่แสดง QR และไม่นับเป็นหนี้ค้างชำระของลูกค้า</div>
<div class="grid"><div class="box"><span>โครงการ</span><b>${esc(projectName(bill))}</b></div><div class="box"><span>พนักงาน</span><b>${esc(bill?.staff_name || '-')}</b></div><div class="box"><span>วิธีบันทึก</span><b>${PROJECT_METHOD}</b></div><div class="box"><span>อ้างอิงบิล</span><b>#${esc(bill?.bill_no || '-')}</b></div></div>
<table><thead><tr><th style="width:46px;text-align:center">#</th><th>รายการสินค้า</th><th style="width:82px;text-align:center">จำนวน</th><th style="width:82px;text-align:center">หน่วย</th><th style="width:110px;text-align:right">ราคา</th><th style="width:120px;text-align:right">รวม</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="c">ไม่มีรายการสินค้า</td></tr>'}</tbody></table>
<div class="summary"><div><span>มูลค่าสินค้าที่เบิก</span><strong>฿${fmt(total)}</strong></div></div>
<div class="sign"><div class="sig"><div class="line"></div><b>ผู้รับสินค้า / โครงการ</b></div><div class="sig"><div class="line"></div><b>ผู้ส่งสินค้า / ผู้ขาย</b></div></div>
<div class="foot">เอกสารโครงการนี้ไม่มี QR ชำระเงิน เพื่อไม่ให้สับสนกับใบแจ้งยอดค้างชำระ</div>
</div><script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close()},1200)},500)}<\/script></body></html>`);
    win.document.close();
  }

  async function maybePrintProjectById(billId) {
    const { bill, items } = await loadBill(billId);
    if (!isProjectBill(bill)) return false;
    await printProjectDoc(bill, items);
    return true;
  }

  function sync(name) {
    try {
      if (name === 'v24ShowDocSelector') v24ShowDocSelector = window[name];
      else if (name === 'v37PrintBillA4Smart') v37PrintBillA4Smart = window[name];
      else if (name === 'v12PrintReceiptA4') v12PrintReceiptA4 = window[name];
      else if (name === 'v5PrintFromHistory') v5PrintFromHistory = window[name];
      else if (name === 'v24PrintDocument') v24PrintDocument = window[name];
      else if (name === 'printA4') printA4 = window[name];
      else if (name === 'printReceiptA4v2') printReceiptA4v2 = window[name];
      else if (name === 'printReceipt') printReceipt = window[name];
    } catch (_) {}
  }

  function wrapById(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v50Project) return;
    window[name] = async function (billId) {
      try {
        if (await maybePrintProjectById(billId)) return;
      } catch (e) {
        console.warn('[v50] project id print guard:', name, e);
      }
      return original.apply(this, arguments);
    };
    window[name].__v50Project = true;
    sync(name);
  }

  function wrapByBill(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v50Project) return;
    window[name] = async function (bill, items) {
      if (isProjectBill(bill)) return printProjectDoc(bill, items || []);
      const nextBill = enrichPromoPrintBillV50(bill, items || []);
      return original.call(this, nextBill, items || [], ...Array.prototype.slice.call(arguments, 2));
    };
    window[name].__v50Project = true;
    sync(name);
  }

  function installProjectPrintGuards() {
    ['v24ShowDocSelector', 'v37PrintBillA4Smart', 'v12PrintReceiptA4', 'v5PrintFromHistory', 'v12PrintDeposit', 'v12PrintDeliveryNote'].forEach(wrapById);
    ['v24PrintDocument', 'printA4', 'printReceiptA4v2', 'v37PrintReceiptA4Now'].forEach(wrapByBill);
    const pr = window.printReceipt;
    if (typeof pr === 'function' && !pr.__v50Project) {
      window.printReceipt = async function (bill, items, format) {
        if (isProjectBill(bill) && String(format || '').toLowerCase().includes('a4')) return printProjectDoc(bill, items || []);
        const nextBill = enrichPromoPrintBillV50(bill, items || []);
        return pr.call(this, nextBill, items || [], format);
      };
      window.printReceipt.__v50Project = true;
      sync('printReceipt');
    }
  }

  function installPrintClickGuard() {
    if (document.__v50ProjectPrintClickGuard) return;
    document.__v50ProjectPrintClickGuard = true;
    document.addEventListener('click', ev => {
      const btn = ev.target?.closest?.('[onclick*="v12PrintReceiptA4"],[onclick*="v24ShowDocSelector"],[onclick*="v37PrintBillA4Smart"],[onclick*="v5PrintFromHistory"]');
      if (!btn) return;
      const raw = btn.getAttribute('onclick') || '';
      const match = raw.match(/(?:v12PrintReceiptA4|v24ShowDocSelector|v37PrintBillA4Smart|v5PrintFromHistory)\(['"]([^'"]+)['"]\)/);
      if (!match) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      maybePrintProjectById(match[1]).then(done => {
        if (!done && typeof window.v24ShowDocSelector === 'function') window.v24ShowDocSelector(match[1]);
      }).catch(e => {
        console.warn('[v50] project print click guard:', e);
        if (typeof toast === 'function') toast('พิมพ์เอกสารไม่สำเร็จ: ' + e.message, 'error');
      });
    }, true);
  }

  function injectCommissionCard() {
    const grid = document.querySelector('#page-admin .v36-admin-menu-grid');
    if (!grid || grid.querySelector('.v50-commission-card')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'v36-admin-menu-card v50-commission-card';
    btn.onclick = () => window.v36AdminOpenSection ? window.v36AdminOpenSection('commission') : window.v49RenderCommissionAdmin?.();
    btn.innerHTML = `
      <span class="v36-admin-menu-icon"><i class="material-icons-round">workspace_premium</i></span>
      <span class="v36-admin-menu-text">
        <span class="v36-admin-menu-title">ตั้งค่าคอมมิชชั่น</span>
        <span class="v36-admin-menu-desc">กำหนดขั้นคอมยอดขายพนักงาน ใช้ได้เฉพาะผู้ดูแลระบบ</span>
      </span>
      <i class="material-icons-round v36-admin-menu-arrow">chevron_right</i>`;
    grid.appendChild(btn);
  }

  function installAdminCommissionSection() {
    const original = window.v36AdminOpenSection;
    if (typeof original === 'function' && !original.__v50Commission) {
      window.v36AdminOpenSection = async function (section) {
        if (section === 'commission') {
          return window.v49RenderCommissionAdmin?.();
        }
        return original.apply(this, arguments);
      };
      window.v36AdminOpenSection.__v50Commission = true;
    }
    injectCommissionCard();
  }

  function localDayBounds(day) {
    const d = day || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
    return {
      day: d,
      start: new Date(`${d}T00:00:00+07:00`).toISOString(),
      end: new Date(`${d}T23:59:59.999+07:00`).toISOString(),
    };
  }

  function rowTime(value) {
    return value ? (typeof formatDateTime === 'function' ? formatDateTime(value) : esc(value)) : '-';
  }

  function logBadge(type) {
    const text = String(type || '');
    if (/สต็อก|stock|สินค้า|แก้ไข|เพิ่มสินค้า|ลบสินค้า/i.test(text)) return ['#0f766e', '#ecfdf5', 'inventory_2'];
    if (/ขาย|บิล|รับชำระ/i.test(text)) return ['#dc2626', '#fef2f2', 'receipt_long'];
    if (/โครงการ/i.test(text)) return ['#4f46e5', '#eef2ff', 'business_center'];
    return ['#2563eb', '#eff6ff', 'manage_search'];
  }

  async function loadActivityRows(day) {
    const bounds = localDayBounds(day);
    const [logRes, stockRes] = await Promise.allSettled([
      db.from('log_กิจกรรม').select('*').gte('time', bounds.start).lte('time', bounds.end).order('time', { ascending: false }),
      db.from('stock_movement').select('*').gte('created_at', bounds.start).lte('created_at', bounds.end).order('created_at', { ascending: false }).limit(500),
    ]);
    const logs = logRes.status === 'fulfilled' && !logRes.value.error ? (logRes.value.data || []) : [];
    const stocks = stockRes.status === 'fulfilled' && !stockRes.value.error ? (stockRes.value.data || []) : [];
    if (logRes.status === 'fulfilled' && logRes.value.error) console.warn('[v50] activity log table:', logRes.value.error);
    if (stockRes.status === 'fulfilled' && stockRes.value.error) console.warn('[v50] stock movement log:', stockRes.value.error);

    const rows = [
      ...logs.map(l => ({
        time: l.time,
        user: l.username || 'system',
        type: l.type || '-',
        details: l.details || '-',
      })),
      ...stocks.map(s => {
        const before = s.stock_before ?? '-';
        const after = s.stock_after ?? '-';
        const qty = s.qty != null ? ` | จำนวน ${fmt(s.qty)}` : '';
        const dir = s.direction === 'in' ? 'เข้า' : (s.direction === 'out' ? 'ออก' : (s.direction || '-'));
        return {
          time: s.created_at || s.time || s.date,
          user: s.staff_name || 'system',
          type: `สต็อก: ${s.type || dir}`,
          details: `${s.product_name || '-'} | ${before} → ${after}${qty}${s.note ? ` | ${s.note}` : ''}`,
        };
      }),
    ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
    return { rows, day: bounds.day, stockError: stockRes.status === 'fulfilled' ? stockRes.value.error : stockRes.reason, logError: logRes.status === 'fulfilled' ? logRes.value.error : logRes.reason };
  }

  function renderActivityRows(rows) {
    if (!rows.length) return '<tr><td colspan="4" style="text-align:center;padding:34px;color:#94a3b8;font-weight:800">ไม่พบประวัติกิจกรรมในวันที่เลือก</td></tr>';
    return rows.map(row => {
      const [color, bg, icon] = logBadge(row.type);
      return `<tr>
        <td style="white-space:nowrap">${rowTime(row.time)}</td>
        <td><strong>${esc(row.user || 'system')}</strong></td>
        <td><span class="badge" style="display:inline-flex;align-items:center;gap:5px;background:${bg};color:${color};border:1px solid ${color}33"><i class="material-icons-round" style="font-size:14px">${icon}</i>${esc(row.type || '-')}</span></td>
        <td>${esc(row.details || '-')}</td>
      </tr>`;
    }).join('');
  }

  function installActivityHistory() {
    window.renderActivityLog = async function (dateValue) {
      const section = document.getElementById('page-log');
      if (!section) return;
      const selected = dateValue || document.getElementById('v36-log-date')?.value || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
      section.innerHTML = `<div class="inv-container"><div class="inv-toolbar"><h3 style="font-size:16px;font-weight:700">ประวัติกิจกรรม</h3><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input type="date" class="form-input" id="v36-log-date" value="${esc(selected)}" onchange="renderActivityLog(this.value)" style="width:160px"><button class="btn btn-outline" onclick="renderActivityLog()"><i class="material-icons-round">refresh</i> รีเฟรช</button></div></div><div class="table-wrapper"><table class="data-table"><tbody><tr><td style="padding:30px;text-align:center;color:#94a3b8">กำลังโหลด...</td></tr></tbody></table></div></div>`;
      try {
        const { rows, day, stockError, logError } = await loadActivityRows(selected);
        const warn = stockError || logError
          ? `<div style="margin:0 0 12px;padding:10px 12px;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:10px;font-size:12px;font-weight:800">บางตารางโหลดไม่ครบ: ${esc((stockError || logError)?.message || stockError || logError)}</div>`
          : '';
        section.innerHTML = `
          <div class="inv-container">
            <div class="inv-toolbar">
              <h3 style="font-size:16px;font-weight:700">ประวัติกิจกรรม (${day})</h3>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <input type="date" class="form-input" id="v36-log-date" value="${esc(day)}" onchange="renderActivityLog(this.value)" style="width:160px">
                <button class="btn btn-outline" onclick="renderActivityLog()"><i class="material-icons-round">refresh</i> รีเฟรช</button>
              </div>
            </div>
            <div style="color:#94a3b8;font-size:13px;margin:-6px 0 14px;font-weight:800">แสดง ${fmt(rows.length)} รายการ รวม log ระบบและประวัติสต็อก</div>
            ${warn}
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>วันเวลา</th><th>ผู้ใช้งาน</th><th>ประเภท</th><th>รายละเอียด</th></tr></thead>
                <tbody>${renderActivityRows(rows)}</tbody>
              </table>
            </div>
          </div>`;
      } catch (e) {
        console.error('[v50] activity history:', e);
        section.innerHTML = `<div class="inv-container"><div style="padding:30px;color:#dc2626">โหลดประวัติกิจกรรมไม่สำเร็จ: ${esc(e.message || e)}</div></div>`;
      }
    };
    try { renderActivityLog = window.renderActivityLog; } catch (_) {}
    window.renderActivityLog.__v50Combined = true;
  }

  const PROMO_KEY = 'sk_pos_product_promotions_v1';
  const PROMO_CAT = 'สินค้าลดราคา';
  function promoMapV50() {
    try { return JSON.parse(localStorage.getItem(PROMO_KEY) || '{}'); } catch (_) { return {}; }
  }
  function promoPercentV50(productId) {
    return Math.max(0, Number(promoMapV50()[productId] || 0));
  }
  function promoProductsV50() {
    try {
      return (products || []).filter(p => p && promoPercentV50(p.id) > 0);
    } catch (_) {
      return [];
    }
  }
  function promoPriceV50(product) {
    const percent = promoPercentV50(product?.id);
    const price = money(product?.price);
    const discount = price * percent / 100;
    return { percent, discount, net: Math.max(0, price - discount) };
  }
  function renderPromoProductGridV50() {
    const container = document.getElementById('pos-product-grid');
    if (!container) return;
    const searchTerm = String(document.getElementById('pos-search')?.value || '').toLowerCase();
    const viewMode = document.querySelector('.view-btn.active')?.dataset?.view || 'grid';
    const list = promoProductsV50().filter(p => {
      const hay = [p.name, p.barcode, p.category].filter(Boolean).join(' ').toLowerCase();
      return !searchTerm || hay.includes(searchTerm);
    });
    const countEl = document.getElementById('products-count');
    if (countEl) countEl.textContent = `แสดง ${list.length} จาก ${promoProductsV50().length} รายการ · ${PROMO_CAT}`;
    const cardPrice = p => {
      const promo = promoPriceV50(p);
      return `<span class="v50-promo-price">฿${fmt(promo.net)}</span><span class="v50-promo-old">฿${fmt(p.price)}</span>`;
    };
    if (viewMode === 'list') {
      container.className = 'product-list';
      container.innerHTML = list.map(p => {
        const inCart = (cart || []).find(c => c.id === p.id);
        const isLow = p.stock <= (p.min_stock || 0) && p.stock > 0;
        const isOut = p.stock <= 0;
        const promo = promoPriceV50(p);
        return `<div class="product-list-item ${isOut ? 'out-of-stock' : ''}" onclick="addToCart('${esc(String(p.id))}')">
          <div class="product-list-img v50-promo-img">${p.img_url ? `<img src="${esc(p.img_url)}" alt="${esc(p.name)}" loading="lazy">` : `<i class="material-icons-round">local_offer</i>`}<span class="v50-promo-ribbon">-${fmt(promo.percent)}%</span></div>
          <div class="product-list-info"><div class="product-name">${esc(p.name)}</div><div class="product-sku">${esc(p.barcode || p.category || '-')}</div></div>
          <div class="product-list-right">${cardPrice(p)}<span class="product-stock ${isLow ? 'low' : ''} ${isOut ? 'out' : ''}">${isOut ? 'หมด' : `${fmt(p.stock)}`}</span>${inCart ? `<span class="product-badge">${fmt(inCart.qty)}</span>` : ''}</div>
        </div>`;
      }).join('') || `<div style="grid-column:1/-1;text-align:center;padding:42px;color:#94a3b8;font-weight:800">ยังไม่มีสินค้าโปรโมชั่น</div>`;
      return;
    }
    container.className = 'product-grid';
    container.innerHTML = list.map(p => {
      const inCart = (cart || []).find(c => c.id === p.id);
      const isLow = p.stock <= (p.min_stock || 0) && p.stock > 0;
      const isOut = p.stock <= 0;
      const promo = promoPriceV50(p);
      return `<div class="product-card v50-promo-card ${isOut ? 'out-of-stock' : ''}" onclick="addToCart('${esc(String(p.id))}')">
        <div class="product-img v50-promo-img">
          ${p.img_url ? `<img src="${esc(p.img_url)}" alt="${esc(p.name)}" loading="lazy">` : `<i class="material-icons-round">local_offer</i>`}
          <span class="v50-promo-ribbon">-${fmt(promo.percent)}%</span>
          ${inCart ? `<span class="product-badge">${fmt(inCart.qty)}</span>` : ''}
        </div>
        <div class="product-info">
          <div class="product-name">${esc(p.name)}</div>
          <div class="product-sku">${esc(p.barcode || p.category || '-')}</div>
          <div class="product-footer">
            <span style="display:flex;flex-direction:column;gap:2px">${cardPrice(p)}</span>
            <span class="product-stock ${isLow ? 'low' : ''} ${isOut ? 'out' : ''}">${isOut ? 'หมด' : `${fmt(p.stock)}`}</span>
          </div>
        </div>
      </div>`;
    }).join('') || `<div style="grid-column:1/-1;text-align:center;padding:42px;color:#94a3b8;font-weight:800">ยังไม่มีสินค้าโปรโมชั่น</div>`;
  }

  function enhanceNormalPromoCardsV50() {
    const productList = (() => { try { return products || []; } catch (_) { return window.products || []; } })();
    if (!Array.isArray(productList) || !productList.length) return;
    document.querySelectorAll('#pos-product-grid [onclick*="addToCart"]').forEach(card => {
      const raw = card.getAttribute('onclick') || '';
      const match = raw.match(/addToCart\(['"]([^'"]+)['"]\)/);
      if (!match) return;
      const product = productList.find(p => String(p.id) === String(match[1]));
      if (!product) return;
      const promo = promoPriceV50(product);
      if (promo.percent <= 0) return;
      card.classList.add('v50-promo-card');
      const img = card.querySelector('.product-img,.product-list-img');
      if (img && !img.querySelector('.v50-promo-ribbon')) {
        img.classList.add('v50-promo-img');
        img.insertAdjacentHTML('afterbegin', `<span class="v50-promo-ribbon">-${fmt(promo.percent)}%</span>`);
      }
      const price = card.querySelector('.product-price');
      if (price && !price.dataset.v50PromoPrice) {
        price.dataset.v50PromoPrice = '1';
        price.innerHTML = `<span class="v50-promo-price">฿${fmt(promo.net)}</span><span class="v50-promo-old">฿${fmt(product.price)}</span>`;
      }
    });
  }

  function installPromoSaleCategory() {
    const style = document.getElementById('v50-promo-sale-style') || document.createElement('style');
    style.id = 'v50-promo-sale-style';
    style.textContent = `
      #pos-categories .cat-tab.v50-promo-tab{background:#fff1f2;color:#dc2626;border-color:#fecaca;font-weight:900}
      #pos-categories .cat-tab.v50-promo-tab.active{background:linear-gradient(135deg,#dc2626,#f97316);color:#fff;border-color:#dc2626;box-shadow:0 10px 22px rgba(220,38,38,.18)}
      .v50-promo-card{border-color:#fecaca!important}.v50-promo-img{position:relative}.v50-promo-ribbon{position:absolute;left:8px;top:8px;background:#dc2626;color:#fff;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:950;box-shadow:0 8px 18px rgba(220,38,38,.24)}
      .v50-promo-price{color:#dc2626!important;font-size:17px!important;font-weight:950!important;line-height:1}.v50-promo-old{color:#94a3b8!important;font-size:10px!important;text-decoration:line-through;font-weight:800}
    `;
    if (!style.parentNode) document.head.appendChild(style);

    if (typeof window.renderCategories === 'function' && !window.renderCategories.__v50PromoCat) {
      const originalRenderCategories = window.renderCategories;
      window.renderCategories = function () {
        const out = originalRenderCategories?.apply(this, arguments);
        const container = document.getElementById('pos-categories');
        if (container && !container.querySelector('[data-cat="__promo__"]')) {
          container.insertAdjacentHTML('beforeend', `<button class="cat-tab v50-promo-tab ${window.__v50PromoCategoryActive ? 'active' : ''}" data-cat="__promo__" onclick="v50FilterPromoCategory()"><i class="material-icons-round" style="font-size:15px;vertical-align:-3px">local_offer</i> ${PROMO_CAT}</button>`);
        }
        return out;
      };
      window.renderCategories.__v50PromoCat = true;
      try { renderCategories = window.renderCategories; } catch (_) {}
    }
    if (typeof window.filterByCategory === 'function' && !window.filterByCategory.__v50PromoCat) {
      const originalFilterByCategory = window.filterByCategory;
      window.filterByCategory = function (cat) {
        window.__v50PromoCategoryActive = false;
        return originalFilterByCategory?.apply(this, arguments);
      };
      window.filterByCategory.__v50PromoCat = true;
      try { filterByCategory = window.filterByCategory; } catch (_) {}
    }
    if (typeof window.renderProductGrid === 'function' && !window.renderProductGrid.__v50PromoCat) {
      const originalRenderProductGrid = window.renderProductGrid;
      window.renderProductGrid = function () {
        if (window.__v50PromoCategoryActive) return renderPromoProductGridV50();
        const out = originalRenderProductGrid?.apply(this, arguments);
        setTimeout(enhanceNormalPromoCardsV50, 0);
        return out;
      };
      window.renderProductGrid.__v50PromoCat = true;
      try { renderProductGrid = window.renderProductGrid; } catch (_) {}
    }
    window.v50FilterPromoCategory = function () {
      window.__v50PromoCategoryActive = true;
      document.querySelectorAll('#pos-categories .cat-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.cat === '__promo__'));
      renderPromoProductGridV50();
    };
    try { renderCategories?.(); } catch (_) {}
    setTimeout(enhanceNormalPromoCardsV50, 0);
  }

  function installPromoCartPricing() {
    if (window.addToCart?.__v50PromoPrice) return;
    let applyingPromoCart = false;

    function activeCartV50() {
      try { if (Array.isArray(cart)) return cart; } catch (_) {}
      return Array.isArray(window.cart) ? window.cart : [];
    }
    function syncCartV50(next) {
      try { cart = next; } catch (_) { window.cart = next; }
    }
    function applyPromoToCartItem(item, product) {
      if (!item || !product) return false;
      const percent = promoPercentV50(product.id);
      const currentOriginal = money(item.original_price ?? item.price ?? product.price);
      if (percent <= 0) {
        if (item.promo_percent || item.promo_discount) {
          item.price = currentOriginal;
          delete item.original_price;
          delete item.promo_percent;
          delete item.promo_discount;
          delete item.discount_total;
          return true;
        }
        return false;
      }
      const original = item.original_price != null ? money(item.original_price) : currentOriginal;
      const discount = Math.round((original * percent / 100) * 100) / 100;
      const net = Math.max(0, Math.round((original - discount) * 100) / 100);
      const changed = money(item.price) !== net || money(item.promo_discount) !== discount || money(item.promo_percent) !== percent;
      item.original_price = original;
      item.promo_percent = percent;
      item.promo_discount = discount;
      item.discount_total = Math.round((discount * money(item.qty || 1)) * 100) / 100;
      item.price = net;
      return changed;
    }
    function applyPromoToCart(productId) {
      if (applyingPromoCart) return false;
      applyingPromoCart = true;
      let changed = false;
      try {
        const list = activeCartV50();
        const productList = (() => { try { return products || []; } catch (_) { return window.products || []; } })();
        list.forEach(item => {
          if (productId && String(item.id) !== String(productId)) return;
          const product = productList.find(p => String(p.id) === String(item.id));
          changed = applyPromoToCartItem(item, product) || changed;
        });
        if (changed) {
          syncCartV50(list);
          try { renderCart?.(); } catch (_) {}
          try { renderProductGrid?.(); } catch (_) {}
          try { sendToDisplay?.({ type: 'cart', cart: list, total: getCartTotal?.() || 0 }); } catch (_) {}
        }
      } finally {
        applyingPromoCart = false;
      }
      return changed;
    }

    const originalAddToCart = window.addToCart;
    window.addToCart = async function (productId) {
      const result = await originalAddToCart?.apply(this, arguments);
      applyPromoToCart(productId);
      return result;
    };
    window.addToCart.__v50PromoPrice = true;
    try { addToCart = window.addToCart; } catch (_) {}

    const originalUpdateCartQty = window.updateCartQty;
    if (typeof originalUpdateCartQty === 'function' && !originalUpdateCartQty.__v50PromoPrice) {
      window.updateCartQty = function (productId) {
        const result = originalUpdateCartQty.apply(this, arguments);
        applyPromoToCart(productId);
        return result;
      };
      window.updateCartQty.__v50PromoPrice = true;
      try { updateCartQty = window.updateCartQty; } catch (_) {}
    }

    const originalGetCartTotal = window.getCartTotal;
    window.getCartTotal = function () {
      applyPromoToCart();
      const discount = Number(document.getElementById('pos-discount')?.value || 0);
      const total = activeCartV50().reduce((sum, item) => sum + money(item.price) * money(item.qty), 0);
      return Math.max(0, total - discount);
    };
    window.getCartTotal.__v50PromoPrice = true;
    try { getCartTotal = window.getCartTotal; } catch (_) {}

    setTimeout(() => applyPromoToCart(), 300);
  }

  function boot() {
    injectStyle();
    installProjectPrintGuards();
    installPrintClickGuard();
    installAdminCommissionSection();
    installActivityHistory();
    installPromoSaleCategory();
    installPromoCartPricing();
    [300, 900, 1800, 3500, 7000, 12000].forEach(delay => setTimeout(() => {
      injectStyle();
      installProjectPrintGuards();
      installAdminCommissionSection();
      installActivityHistory();
      installPromoSaleCategory();
      installPromoCartPricing();
    }, delay));
    if (!window.__v50FinalInterval) {
      window.__v50FinalInterval = setInterval(() => {
        injectStyle();
        installProjectPrintGuards();
        installAdminCommissionSection();
        installPromoSaleCategory();
        installPromoCartPricing();
      }, 2500);
      setTimeout(() => clearInterval(window.__v50FinalInterval), 45000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
