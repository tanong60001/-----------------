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
      return original.apply(this, arguments);
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
        return pr.apply(this, arguments);
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

  function boot() {
    injectStyle();
    installProjectPrintGuards();
    installPrintClickGuard();
    installAdminCommissionSection();
    [300, 900, 1800, 3500, 7000, 12000].forEach(delay => setTimeout(() => {
      injectStyle();
      installProjectPrintGuards();
      installAdminCommissionSection();
    }, delay));
    if (!window.__v50FinalInterval) {
      window.__v50FinalInterval = setInterval(() => {
        injectStyle();
        installProjectPrintGuards();
        installAdminCommissionSection();
      }, 2500);
      setTimeout(() => clearInterval(window.__v50FinalInterval), 45000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
