(function () {
  'use strict';

  console.log('[v47] POS image, inventory limit, project bill polish loaded');

  const PROJECT_METHOD = 'เบิกของโครงการ';
  const PROJECT_STATUS = 'เบิกของโครงการ';

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

  function isProjectBill(bill) {
    if (!bill) return false;
    const text = `${bill.method || ''} ${bill.status || ''} ${bill.customer_name || ''} ${bill.note || ''}`;
    return !!bill.project_id || /\[โครงการ\]|โครงการ|เบิกของโครงการ|จ่ายของให้โครงการ/.test(text);
  }

  function injectStyle() {
    document.getElementById('v47-pos-project-style')?.remove();
    const style = document.createElement('style');
    style.id = 'v47-pos-project-style';
    style.textContent = `
      #pos-product-grid.product-grid{
        align-items:stretch!important;
      }
      #pos-product-grid .product-card{
        min-height:310px!important;
        display:flex!important;
      }
      #pos-product-grid .product-card .product-img{
        height:auto!important;
        min-height:154px!important;
        aspect-ratio:1 / .78!important;
        flex:0 0 auto!important;
        overflow:hidden!important;
        background:#f8fafc!important;
      }
      #pos-product-grid .product-card .product-img img{
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
      #pos-product-grid .product-list-img{
        overflow:hidden!important;
        background:#f8fafc!important;
      }
      #pos-product-grid .product-list-img img{
        width:100%!important;
        height:100%!important;
        object-fit:cover!important;
        object-position:center!important;
        transform:scale(1.08)!important;
        display:block!important;
      }
      #checkout-overlay .v36-mixed-method-card:not(.selected){
        border-color:#dbe3ec!important;
        background:#fff!important;
        box-shadow:0 10px 24px rgba(15,23,42,.04)!important;
      }
      #checkout-overlay .v36-mixed-method-card:not(.selected) i{
        background:#eef4fb!important;
        color:#64748b!important;
      }
      #checkout-overlay .v36-mixed-method-card:not(.selected) h4,
      #checkout-overlay .v36-mixed-method-card:not(.selected) span{
        color:#334155!important;
      }
      #checkout-overlay .v36-mixed-method-card.selected{
        border-color:#0f766e!important;
        background:linear-gradient(180deg,#f0fdfa,#ffffff)!important;
        box-shadow:0 0 0 2px #ccfbf1,0 14px 28px rgba(15,118,110,.08)!important;
      }
      #checkout-overlay .v36-mixed-pay-box{
        border-color:#cbd5e1!important;
        box-shadow:0 14px 30px rgba(15,23,42,.055)!important;
      }
      #checkout-overlay .v36-mixed-icon{
        background:#eef4fb!important;
        color:#475569!important;
      }
      #checkout-overlay .v36-mixed-title{
        color:#334155!important;
      }
      .v47-project-method-note{
        margin-top:12px;
        border:1.5px solid #bae6fd;
        background:#f0f9ff;
        color:#075985;
        border-radius:14px;
        padding:14px 16px;
        font-weight:850;
        line-height:1.55;
      }
      .v47-project-method-note strong{
        color:#0c4a6e;
        font-weight:950;
      }
      .v47-project-badge{
        display:inline-flex;
        align-items:center;
        gap:6px;
        border-radius:999px;
        background:#e0f2fe;
        color:#075985;
        border:1px solid #bae6fd;
        padding:5px 10px;
        font-size:12px;
        font-weight:950;
        white-space:nowrap;
      }
      @media(max-width:760px){
        #pos-product-grid .product-card{min-height:286px!important}
        #pos-product-grid .product-card .product-img{min-height:142px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function forceInventoryLimit() {
    window.v36InvLimit = Math.min(Number(window.v36InvLimit || 60), 60);
    if (window.v36SetInvFilter && !window.v36SetInvFilter.__v47limit) {
      const original = window.v36SetInvFilter;
      window.v36SetInvFilter = function (filter) {
        window.v36InvLimit = 60;
        return original.apply(this, arguments);
      };
      window.v36SetInvFilter.__v47limit = true;
    }
    if (window.v36ShowMoreInventory && !window.v36ShowMoreInventory.__v47limit) {
      const originalMore = window.v36ShowMoreInventory;
      window.v36ShowMoreInventory = function () {
        if (!window.v36InvLimit) window.v36InvLimit = 60;
        return originalMore.apply(this, arguments);
      };
      window.v36ShowMoreInventory.__v47limit = true;
    }
  }

  async function markSavedProjectBill() {
    let bill = null;
    try { bill = window.v12State?.savedBill; } catch (_) {}
    if (!bill?.id || !isProjectBill(bill)) return;
    const patch = {
      method: PROJECT_METHOD,
      status: PROJECT_STATUS,
      received: 0,
      change: 0,
      deposit_amount: 0,
    };
    try {
      const { data, error } = await db.from('บิลขาย').update(patch).eq('id', bill.id).select().maybeSingle();
      if (error) throw error;
      Object.assign(bill, data || patch);
      window.v12State.savedBill = bill;
    } catch (e) {
      console.warn('[v47] mark project bill:', e);
    }
  }

  function installProjectCompletionPatch() {
    if (window.v12CompletePayment?.__v47project) return;
    const original = window.v12CompletePayment;
    if (typeof original !== 'function') return;
    window.v12CompletePayment = async function () {
      const result = await original.apply(this, arguments);
      await markSavedProjectBill();
      return result;
    };
    window.v12CompletePayment.__v47project = true;
    try { v12CompletePayment = window.v12CompletePayment; } catch (_) {}
  }

  function installProjectMethodUI() {
    if (window.v12S4?.__v47project) return;
    const original = window.v12S4;
    if (typeof original !== 'function') return;
    window.v12S4 = function (container) {
      const result = original.apply(this, arguments);
      setTimeout(() => {
        let isProject = false;
        try { isProject = v12State?.customer?.type === 'project' || !!v12State?.customer?.project_id || !!v12State?._forceDebt; } catch (_) {}
        if (!isProject) return;
        try { v12State.method = 'project'; } catch (_) {}
        const root = container || document.getElementById('v12-step-body') || document.getElementById('checkout-content');
        root?.querySelectorAll?.('.v12-method-card,.v13-method-card-debt,.payment-method-btn').forEach(card => {
          card.classList.remove('selected');
          card.style.opacity = '.38';
          card.style.pointerEvents = 'none';
        });
        const debtCard = root?.querySelector?.('.v13-method-card-debt, .v12-method-card[onclick*="debt"], .payment-method-btn[onclick*="debt"]');
        if (debtCard) {
          debtCard.classList.add('selected');
          debtCard.style.opacity = '1';
          debtCard.style.pointerEvents = 'none';
          const icon = debtCard.querySelector('i.material-icons-round,.material-icons-round');
          if (icon) icon.textContent = 'business_center';
          const title = debtCard.querySelector('h4,span,.sk-pay-title');
          if (title) title.textContent = PROJECT_METHOD;
          const sub = debtCard.querySelector('p,.sk-pay-sub');
          if (sub) sub.textContent = 'ตัดสต็อกเข้าต้นทุนโครงการ';
        }
        const info = root?.querySelector?.('#v13-method-info,#v12-method-extra') || root;
        const projectName = (() => { try { return v12State?.customer?.project_name || v12State?.customer?.name || '-'; } catch (_) { return '-'; } })();
        const html = `
          <div class="v47-project-method-note">
            <strong>บิลโครงการ: ${esc(projectName)}</strong><br>
            ระบบจะตัดสต็อกและบันทึกเป็นต้นทุน/รายจ่ายของโครงการ ไม่ใช่หนี้ลูกค้าค้างชำระ และจะไม่แสดง QR เก็บเงินบนเอกสารโครงการ
          </div>`;
        if (info && info.id) info.innerHTML = html;
        else if (root && !root.querySelector('.v47-project-method-note')) root.insertAdjacentHTML('beforeend', html);
      }, 80);
      return result;
    };
    window.v12S4.__v47project = true;
    try { v12S4 = window.v12S4; } catch (_) {}
  }

  function projectStatusText(bill) {
    if (!isProjectBill(bill)) return String(bill?.status || '-');
    return 'เบิกสินค้าเข้าโครงการ';
  }

  function projectMethodText(bill) {
    if (!isProjectBill(bill)) return String(bill?.method || '-');
    return PROJECT_METHOD;
  }

  async function printProjectDocument(bill, items) {
    const rows = (items || []).map((item, index) => `
      <tr>
        <td class="c">${index + 1}</td>
        <td>${esc(item.name || '')}</td>
        <td class="c">${fmt(item.qty || 0)}</td>
        <td class="c">${esc(item.unit || 'ชิ้น')}</td>
        <td class="r">฿${fmt(item.price || 0)}</td>
        <td class="r strong">฿${fmt(money(item.total || money(item.qty) * money(item.price)))}</td>
      </tr>`).join('');
    const projectName = String(bill.customer_name || '').replace(/^\[โครงการ\]\s*/, '') || '-';
    const total = money(bill.total);
    const dateText = new Date(bill.date || Date.now()).toLocaleString('th-TH', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    const win = window.open('', '_blank', 'width=920,height=980');
    if (!win) {
      if (typeof toast === 'function') toast('กรุณาอนุญาต popup เพื่อพิมพ์เอกสาร', 'error');
      return;
    }
    win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเบิกสินค้าโครงการ #${esc(bill.bill_no || '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{margin:0;background:#f8fafc;font-family:Sarabun,sans-serif;color:#0f172a}.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:12mm 14mm;display:flex;flex-direction:column}.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:4px solid #0ea5e9;padding-bottom:12px}.shop h1{margin:0;font-size:22px;color:#dc2626;font-weight:900}.shop p{margin:4px 0 0;color:#64748b;font-size:11px;line-height:1.45}.doc{text-align:right}.doc h2{margin:0;background:#0ea5e9;color:#fff;border-radius:10px;padding:10px 18px;font-size:20px}.doc small{display:block;margin-top:6px;color:#64748b;font-weight:800}.notice{margin:16px 0;border:1.5px solid #bae6fd;background:#f0f9ff;border-radius:12px;padding:12px 14px;color:#075985;font-weight:800;line-height:1.55}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}.box{border:1px solid #e2e8f0;border-radius:10px;padding:12px}.box span{display:block;font-size:11px;color:#64748b;font-weight:800}.box b{display:block;margin-top:3px;font-size:16px}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#0f172a;color:#fff;padding:9px 8px;font-size:12px;text-align:left}td{border-bottom:1px solid #e2e8f0;padding:8px;font-size:12px}tr:nth-child(even) td{background:#f8fafc}.c{text-align:center}.r{text-align:right}.strong{font-weight:900}.summary{margin-left:auto;margin-top:16px;width:260px;border-radius:12px;overflow:hidden;border:1px solid #bae6fd}.summary div{display:flex;justify-content:space-between;padding:10px 12px;background:#f0f9ff;font-weight:800}.summary strong{font-size:22px;color:#0369a1}.sign{margin-top:auto;display:flex;justify-content:space-around;gap:40px;padding-top:34px}.sig{text-align:center;min-width:190px}.line{height:32px;border-bottom:1.5px solid #64748b;margin-bottom:6px}.foot{text-align:center;color:#94a3b8;border-top:1px solid #e2e8f0;margin-top:28px;padding-top:8px;font-size:11px}@media print{body{background:#fff}.page{margin:0}}
</style></head><body><div class="page">
<div class="top"><div class="shop"><h1>SK POS</h1><p>เอกสารภายในสำหรับเบิกสินค้าเข้าโครงการ<br>ไม่ใช่ใบแจ้งหนี้ และไม่ต้องสแกน QR เพื่อชำระเงิน</p></div><div class="doc"><h2>ใบเบิกสินค้าโครงการ</h2><small>PROJECT ISSUE NOTE</small><small>เลขที่ #${esc(bill.bill_no || '-')}</small></div></div>
<div class="notice">สถานะ: <b>${projectStatusText(bill)}</b> | เอกสารนี้ใช้เพื่อตัดสต็อกและบันทึกต้นทุนโครงการ ไม่บันทึกเป็นหนี้ลูกค้า</div>
<div class="grid"><div class="box"><span>โครงการ</span><b>${esc(projectName)}</b></div><div class="box"><span>วันที่</span><b>${esc(dateText)}</b></div><div class="box"><span>ผู้ทำรายการ</span><b>${esc(bill.staff_name || '-')}</b></div><div class="box"><span>ประเภทเอกสาร</span><b>${PROJECT_METHOD}</b></div></div>
<table><thead><tr><th style="width:46px;text-align:center">#</th><th>สินค้า</th><th style="width:82px;text-align:center">จำนวน</th><th style="width:82px;text-align:center">หน่วย</th><th style="width:110px;text-align:right">ราคา</th><th style="width:120px;text-align:right">รวม</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="c">ไม่มีรายการสินค้า</td></tr>'}</tbody></table>
<div class="summary"><div><span>มูลค่าสินค้าที่เบิก</span><strong>฿${fmt(total)}</strong></div></div>
<div class="sign"><div class="sig"><div class="line"></div><b>ผู้เบิก / ผู้รับสินค้า</b></div><div class="sig"><div class="line"></div><b>ผู้อนุมัติ</b></div></div>
<div class="foot">เอกสารนี้ไม่มี QR ชำระเงิน เพราะเป็นการเบิกของเข้าโครงการ</div>
</div><script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close()},1200)},500)}<\/script></body></html>`);
    win.document.close();
  }

  async function loadBillAndItems(billId) {
    const [{ data: bill, error: billError }, { data: items, error: itemError }] = await Promise.all([
      db.from('บิลขาย').select('*').eq('id', billId).maybeSingle(),
      db.from('รายการในบิล').select('*').eq('bill_id', billId),
    ]);
    if (billError) throw billError;
    if (itemError) throw itemError;
    return { bill, items: items || [] };
  }

  function installProjectPrintPatch() {
    if (window.__v47ProjectPrint) return;
    window.__v47ProjectPrint = true;

    const wrapSelector = name => {
      const original = window[name];
      if (typeof original !== 'function') return;
      window[name] = async function (billId) {
        try {
          const { bill, items } = await loadBillAndItems(billId);
          if (isProjectBill(bill)) return printProjectDocument(bill, items);
        } catch (e) {
          console.warn('[v47] project print check:', e);
        }
        return original.apply(this, arguments);
      };
      try { if (name === 'v24ShowDocSelector') v24ShowDocSelector = window[name]; } catch (_) {}
      try { if (name === 'v12PrintReceiptA4') v12PrintReceiptA4 = window[name]; } catch (_) {}
      try { if (name === 'v5PrintFromHistory') v5PrintFromHistory = window[name]; } catch (_) {}
    };
    wrapSelector('v24ShowDocSelector');
    wrapSelector('v12PrintReceiptA4');
    wrapSelector('v5PrintFromHistory');

    const originalDoc = window.v24PrintDocument;
    if (typeof originalDoc === 'function') {
      window.v24PrintDocument = async function (bill, items, docType) {
        if (isProjectBill(bill)) return printProjectDocument(bill, items || []);
        return originalDoc.apply(this, arguments);
      };
      try { v24PrintDocument = window.v24PrintDocument; } catch (_) {}
    }
  }

  function boot() {
    injectStyle();
    forceInventoryLimit();
    installProjectCompletionPatch();
    installProjectMethodUI();
    installProjectPrintPatch();
    [250, 800, 1600, 3200].forEach(delay => setTimeout(() => {
      injectStyle();
      forceInventoryLimit();
      installProjectCompletionPatch();
      installProjectMethodUI();
      installProjectPrintPatch();
    }, delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
