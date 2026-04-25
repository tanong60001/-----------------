/**
 * SK POS — modules-v19.js  (โหลดหลัง modules-v18.js)
 * ══════════════════════════════════════════════════════════════════
 *  V19-1  DASHBOARD UTC       — patch Supabase prototype (ไม่ใช้ Proxy)
 *  V19-2  CART AUTO-CLEAR     — ล้างตะกร้าหลังกด "เสร็จสิ้น"
 *  V19-3  PRINT SYSTEM        — ระบบพิมพ์เอกสารครบทุกประเภท
 *                               อ่านค่าจาก doc_settings จริง
 *                               A4 ตัดหน้าทุก 10 รายการ
 *                               เซ็นชื่อท้ายใบเสมอ
 *                               PromptPay จาก promptpay_number
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

/* ════════════════════════════════════════════════════════════════
   V19-1: DASHBOARD UTC FIX — Prototype patch (ไม่ใช้ Proxy)
   
   วิธีการ: patch prototype ของ PostgrestFilterBuilder โดยตรง
   ข้อดี: ไม่มีปัญหา `this` binding (ที่ทำให้ Proxy พัง)
════════════════════════════════════════════════════════════════ */
(function patchSupabaseDateFilter() {
  /* timezone offset เช่น '+07:00' สำหรับ Bangkok */
  function tzStr() {
    const off  = -(new Date().getTimezoneOffset());
    const sign = off >= 0 ? '+' : '-';
    const hh   = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
    const mm   = String(Math.abs(off) % 60).padStart(2, '0');
    return `${sign}${hh}:${mm}`;
  }

  /* เพิ่ม timezone suffix ถ้ายังไม่มี */
  function addTZ(val) {
    if (!val || typeof val !== 'string') return val;
    if (val.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(val)) return val;
    if (!val.includes('T')) return val; /* date-only, ไม่แก้ */
    return val + tzStr();
  }

  function tryPatch() {
    if (typeof db === 'undefined') { setTimeout(tryPatch, 300); return; }

    try {
      /* สร้าง query builder ชั่วคราวเพื่อหา prototype */
      const builder = db.from('สินค้า').select('id').limit(0);
      const proto   = Object.getPrototypeOf(builder);

      if (!proto || proto._v19Patched) {
        console.log('[v19] UTC patch already applied');
        return;
      }

      /* Patch .gte() */
      const origGte = proto.gte;
      proto.gte = function(col, val, ...rest) {
        if (col === 'date' || col === 'paid_date') val = addTZ(val);
        return origGte.call(this, col, val, ...rest);
      };

      /* Patch .lte() */
      const origLte = proto.lte;
      proto.lte = function(col, val, ...rest) {
        if (col === 'date' || col === 'paid_date') val = addTZ(val);
        return origLte.call(this, col, val, ...rest);
      };

      proto._v19Patched = true;
      console.log('[v19] ✅ Supabase date filter patched. TZ =', tzStr());
    } catch(e) {
      console.warn('[v19] UTC patch error:', e.message);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryPatch);
  else tryPatch();
  setTimeout(tryPatch, 500); /* retry */
})();


/* ════════════════════════════════════════════════════════════════
   V19-2: CART AUTO-CLEAR
   
   Root: cart เป็น closure `let` ใน app.js → ต้องใช้ .length = 0
   closeCheckout() ของ app.js ไม่ได้ clear cart
════════════════════════════════════════════════════════════════ */
(function patchCloseCheckout() {
  function tryPatch() {
    if (typeof closeCheckout !== 'function') { setTimeout(tryPatch, 300); return; }
    if (closeCheckout._v19patched) return;

    const orig = closeCheckout;
    window.closeCheckout = function() {
      /* ถ้าชำระเงินสำเร็จแล้ว → clear cart */
      if (v12State?.savedBill) {
        /* Mutate in-place → ใช้ได้กับ closure variable ใน app.js */
        if (typeof cart !== 'undefined' && Array.isArray(cart)) {
          cart.splice(0, cart.length);
        }
        /* Reset v12State */
        try {
          v12State.savedBill  = null;
          v12State.step       = 1;
          v12State.method     = null;
          v12State.received   = 0;
          v12State.change     = 0;
          v12State.receivedDenominations = {};
          v12State.changeDenominations   = {};
          v12State.depositAmount = 0;
          v12State.deliveryMode  = 'self';
          v12State.deliveryDate  = null;
          v12State.deliveryAddress = '';
          v12State.deliveryPhone   = '';
          v12State.itemModes = {};
          v12State._forceDebt = false;
          v12State.customer  = { type:'general', id:null, name:'ลูกค้าทั่วไป' };
          v12State.paymentType = 'full';
        } catch(_) {}

        /* Refresh UI */
        if (typeof renderCart         === 'function') renderCart();
        if (typeof renderProductGrid  === 'function') renderProductGrid();
        if (typeof updateHomeStats    === 'function') updateHomeStats();
      }
      orig.call(this);
    };
    window.closeCheckout._v19patched = true;
    console.log('[v19] ✅ closeCheckout patched — cart auto-clear active');
  }
  setTimeout(tryPatch, 500);
})();


/* ════════════════════════════════════════════════════════════════
   V19-3: PRINT SYSTEM — ระบบพิมพ์เอกสารครบทุกประเภท
════════════════════════════════════════════════════════════════ */

/* ── Default settings (merge กับ doc_settings จริง) ── */
const V19_DEFAULTS = {
  receipt_80mm: {
    show_shop_name:true, show_address:true, show_tax_id:false,
    show_bill_no:true, show_customer:true, show_staff:true,
    show_datetime:true, show_method:true, show_discount:true,
    show_received:true, show_change:true, show_qr:true,
    footer_text:'ขอบคุณที่ใช้บริการ',
  },
  receipt_a4: {
    show_shop_name:true, show_address:true, show_tax_id:true,
    show_bill_no:true, show_customer:true, show_staff:true,
    show_datetime:true, show_method:true, show_discount:true,
    show_received:true, show_change:true, show_qr:true,
    show_signature:true,
    header_color:'#d92d20', bw_mode:false,
    header_text:'ใบเสร็จรับเงิน', footer_text:'ขอบคุณที่ใช้บริการ',
  },
  delivery_note: {
    show_shop_name:true, show_address:true, show_tax_id:false,
    show_customer:true, show_staff:true, show_datetime:true,
    show_signature:true, show_qr:false,
    header_color:'#1d4ed8', header_text:'ใบส่งของ', footer_text:'',
  },
  deposit_receipt: {
    show_shop_name:true, show_address:true, show_tax_id:false,
    show_customer:true, show_staff:true, show_datetime:true,
    show_signature:true, show_qr:true,
    header_color:'#d97706', header_text:'ใบรับมัดจำ', footer_text:'',
  },
};

/* ── Load shop config + doc_settings ── */
async function v19LoadShopConfig() {
  try {
    const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle();
    if (!data) return { ds: {}, shop: {} };
    const ds = data.doc_settings ? (typeof data.doc_settings === 'string' ? JSON.parse(data.doc_settings) : data.doc_settings) : {};
    return { ds, shop: data };
  } catch(_) { return { ds: {}, shop: {} }; }
}

/* Merge defaults with saved settings */
function v19GetSettings(ds, key) {
  return { ...V19_DEFAULTS[key], ...(ds[key] || {}) };
}

/* ── Thai number to text ── */
function v19Baht(n) {
  if (!n && n !== 0) return '-';
  const dig = ['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const pos = ['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน'];
  const cvt = (num) => {
    if (num === 0) return '';
    let r='', s=String(num).split('').reverse();
    for (let i=0;i<s.length;i++) {
      const d=+s[i]; if(!d) continue;
      if(i===1&&d===2) r='ยี่สิบ'+r;
      else if(i===1&&d===1) r='สิบ'+r;
      else if(i===0&&d===1&&s.length>1) r='เอ็ด'+r;
      else r=dig[d]+pos[i]+r;
    }
    return r;
  };
  const b=Math.floor(Math.abs(n)), c=Math.round((Math.abs(n)-b)*100);
  return cvt(b)+'บาท'+(c>0?cvt(c)+'สตางค์':'ถ้วน');
}

/* ── Format helpers ── */
const v19fmt  = n => typeof formatNum === 'function' ? formatNum(n) : Number(n||0).toLocaleString('th-TH');
const v19date = d => new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
const v19dt   = d => new Date(d).toLocaleString('th-TH',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

/* ── Shared CSS ── */
const V19_FONTS = `<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">`;

/* ════════════════════════════════════════════════════════════════
   80mm RECEIPT
════════════════════════════════════════════════════════════════ */
window.v12PrintReceipt80mm = async function(billId) {
  try {
    const [{ data: bill }, { data: items }, { ds, shop }] = await Promise.all([
      db.from('บิลขาย').select('*').eq('id', billId).single(),
      db.from('รายการในบิล').select('*').eq('bill_id', billId),
      v19LoadShopConfig(),
    ]);
    if (!bill) { typeof toast==='function'&&toast('ไม่พบบิล','error'); return; }

    const S     = v19GetSettings(ds, 'receipt_80mm');
    const pp    = shop.promptpay_number || shop.phone || '';
    const total = parseFloat(bill.total || 0);
    const disc  = parseFloat(bill.discount || 0);
    const sub   = (items||[]).reduce((s,i)=>s+(i.price*i.qty),0);
    const showQR= S.show_qr && pp && bill.method === 'โอนเงิน';

    const itemRows = (items||[]).map(i => `
      <tr>
        <td style="padding:2px 0;max-width:140px;word-break:break-word;">${i.name}</td>
        <td style="text-align:center;padding:2px 4px;white-space:nowrap;">${v19fmt(i.qty)}<br><span style="font-size:10px;color:#666;">${i.unit||'ชิ้น'}</span></td>
        <td style="text-align:right;padding:2px 0;white-space:nowrap;">฿${v19fmt(i.total)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    ${V19_FONTS}
    <style>
      @page{size:80mm auto;margin:0}
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Sarabun',sans-serif;font-size:13px;width:76mm;padding:4mm 3mm;color:#111}
      .center{text-align:center}.right{text-align:right}
      hr{border:none;border-top:1px dashed #aaa;margin:5px 0}
      table{width:100%;border-collapse:collapse}
      th{font-size:11px;color:#555;padding:2px 0;border-bottom:1px dashed #ccc}
      .total-row td{font-weight:700;font-size:15px;border-top:1.5px solid #222;padding-top:5px}
      .badge{background:#111;color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700}
      @media print{body{padding:2mm 2mm}@page{size:80mm auto;margin:0}}
    </style></head><body>

    ${S.show_shop_name?`<div class="center" style="font-size:17px;font-weight:800;color:#d92d20;">${shop.shop_name||'SK POS'}</div>`:''}
    ${S.show_address&&shop.address?`<div class="center" style="font-size:10px;color:#555;margin-top:2px;">${shop.address}</div>`:''}
    ${S.show_address&&shop.phone?`<div class="center" style="font-size:10px;color:#555;">โทร ${shop.phone}</div>`:''}
    ${S.show_tax_id&&shop.tax_id?`<div class="center" style="font-size:10px;color:#555;">TAX: ${shop.tax_id}</div>`:''}
    <hr>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
      ${S.show_bill_no?`<div><span class="badge">#${bill.bill_no}</span></div>`:'<div></div>'}
      ${S.show_datetime?`<div style="font-size:10px;color:#555;">${v19dt(bill.date)}</div>`:''}
    </div>
    ${S.show_customer?`<div style="font-size:11px;">ลูกค้า: <strong>${bill.customer_name||'ทั่วไป'}</strong></div>`:''}
    ${S.show_staff?`<div style="font-size:11px;color:#555;">พนักงาน: ${bill.staff_name||''}</div>`:''}
    ${S.show_method?`<div style="font-size:11px;color:#555;">วิธีชำระ: ${bill.method||''}</div>`:''}
    <hr>

    <table>
      <thead><tr>
        <th style="text-align:left;">รายการ</th>
        <th>จำนวน</th>
        <th style="text-align:right;">รวม</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr>

    ${S.show_discount&&disc>0?`<div style="display:flex;justify-content:space-between;font-size:12px;"><span>รวมก่อนลด</span><span>฿${v19fmt(sub)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#d97706;"><span>ส่วนลด</span><span>-฿${v19fmt(disc)}</span></div>`:''}

    <table><tr class="total-row"><td>ยอดสุทธิ</td><td class="right">฿${v19fmt(total)}</td></tr></table>

    ${S.show_received&&bill.method==='เงินสด'?`
    <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px;"><span>รับมา</span><span>฿${v19fmt(bill.received)}</span></div>
    ${S.show_change?`<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:#10b981;"><span>เงินทอน</span><span>฿${v19fmt(bill.change)}</span></div>`:''}
    `:''}

    ${bill.status==='ค้างชำระ'?`<div style="background:#fee2e2;border-radius:4px;padding:4px 8px;margin-top:6px;font-size:12px;font-weight:700;color:#dc2626;text-align:center;">⚠ ค้างชำระ ฿${v19fmt(total)}</div>`:''}

    ${showQR?`<div class="center" style="margin-top:8px;">
      <img src="https://promptpay.io/${pp.replace(/[^0-9]/g,'')}/${total}.png" style="width:120px;height:120px;border:1px solid #ddd;padding:4px;border-radius:6px;">
      <div style="font-size:10px;color:#555;margin-top:2px;">สแกนเพื่อชำระเงิน</div>
    </div>`:''}

    <hr>
    <div class="center" style="font-size:11px;color:#555;margin-top:2px;">${S.footer_text||'ขอบคุณที่ใช้บริการ'}</div>

    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800)}<\/script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=340,height=700');
    w.document.write(html);
    w.document.close();
  } catch(e) { console.error('[v19]80mm:', e); typeof toast==='function'&&toast('พิมพ์ไม่สำเร็จ: '+e.message,'error'); }
};


/* ════════════════════════════════════════════════════════════════
   A4 RECEIPT — configurable, paginate 10 items, signature always
════════════════════════════════════════════════════════════════ */
async function v19PrintA4(billId, docType) {
  /* docType: 'receipt' | 'delivery' | 'deposit' */
  const settingsKey = docType === 'receipt' ? 'receipt_a4'
    : docType === 'delivery' ? 'delivery_note' : 'deposit_receipt';

  const [{ data: bill }, { data: allItems }, { ds, shop }] = await Promise.all([
    db.from('บิลขาย').select('*').eq('id', billId).single(),
    db.from('รายการในบิล').select('*').eq('bill_id', billId),
    v19LoadShopConfig(),
  ]);
  if (!bill) { typeof toast==='function'&&toast('ไม่พบบิล','error'); return; }

  /* For delivery: only deliver_qty > 0 items */
  let items = allItems || [];
  if (docType === 'delivery') {
    const dItems = items.filter(i => (i.deliver_qty||0) > 0);
    items = dItems.length > 0 ? dItems : items;
  }

  const S   = v19GetSettings(ds, settingsKey);
  const hc  = S.bw_mode ? '#333' : (S.header_color || '#d92d20');
  const pp  = shop.promptpay_number || shop.phone || '';
  const total = parseFloat(bill.total || 0);
  const disc  = parseFloat(bill.discount || 0);
  const showQR = S.show_qr && pp;

  const docLabel = S.header_text || (docType === 'receipt' ? 'ใบเสร็จรับเงิน' : docType === 'delivery' ? 'ใบส่งของ' : 'ใบรับมัดจำ');
  const docLabelEN = docType === 'receipt' ? 'RECEIPT' : docType === 'delivery' ? 'DELIVERY NOTE' : 'DEPOSIT RECEIPT';
  const itemsTotal = items.reduce((s,i)=>s+(parseFloat(i.total)||0),0);
  const displayTotal = docType === 'receipt' ? total : itemsTotal;

  /* Deposit specifics */
  const deposit = parseFloat(bill.deposit_amount || 0);
  const remaining = total - deposit;

  /* Summary rows */
  let summaryRows = '';
  if (docType === 'receipt') {
    if (disc > 0) summaryRows += `<tr><td style="color:#555;">รวมก่อนลด</td><td style="text-align:right;">฿${v19fmt(parseFloat(bill.total||0)+disc)}</td></tr>
      <tr><td style="color:#d97706;">ส่วนลด</td><td style="text-align:right;color:#d97706;">-฿${v19fmt(disc)}</td></tr>`;
    summaryRows += `<tr style="background:${hc};color:#fff;"><td style="padding:10px;font-size:15px;font-weight:800;border-radius:8px 0 0 8px;">ยอดสุทธิ</td><td style="text-align:right;padding:10px;font-size:18px;font-weight:900;border-radius:0 8px 8px 0;">฿${v19fmt(total)}</td></tr>`;
    if (bill.method==='เงินสด'&&S.show_received) {
      summaryRows += `<tr><td style="color:#555;">รับมา</td><td style="text-align:right;">฿${v19fmt(bill.received)}</td></tr>`;
      if(S.show_change) summaryRows += `<tr><td style="color:#10b981;font-weight:700;">เงินทอน</td><td style="text-align:right;color:#10b981;font-weight:700;">฿${v19fmt(bill.change)}</td></tr>`;
    }
  } else if (docType === 'deposit') {
    summaryRows = `<tr><td>ยอดรวมทั้งสิ้น</td><td style="text-align:right;">฿${v19fmt(total)}</td></tr>
      <tr style="background:${hc};color:#fff;"><td style="padding:10px;font-size:14px;font-weight:800;border-radius:8px 0 0 8px;">ยอดมัดจำที่ชำระ</td><td style="text-align:right;padding:10px;font-size:18px;font-weight:900;border-radius:0 8px 8px 0;">฿${v19fmt(deposit)}</td></tr>
      <tr><td style="color:#dc2626;font-weight:700;">คงค้างชำระ</td><td style="text-align:right;color:#dc2626;font-weight:700;">฿${v19fmt(remaining)}</td></tr>`;
  } else {
    summaryRows = `<tr style="background:${hc};color:#fff;"><td style="padding:10px;font-size:14px;font-weight:800;border-radius:8px 0 0 8px;">ยอดรวมสินค้าที่ส่ง</td><td style="text-align:right;padding:10px;font-size:18px;font-weight:900;border-radius:0 8px 8px 0;">฿${v19fmt(itemsTotal)}</td></tr>`;
  }

  /* QR box */
  const qrAmt  = docType === 'deposit' ? deposit : displayTotal;
  const qrHtml = showQR && pp ? `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:10px;text-align:center;max-width:130px;">
      <div style="background:${hc};color:#fff;font-size:9px;font-weight:800;padding:3px 6px;border-radius:6px 6px 0 0;margin:-10px -10px 8px;text-align:center;">PromptPay</div>
      <img src="https://promptpay.io/${pp.replace(/[^0-9]/g,'')}/${qrAmt}.png" style="width:110px;height:110px;">
      <div style="font-size:10px;color:#555;margin-top:4px;">${pp}</div>
    </div>` : '';

  /* Signature section (always) */
  const sigHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px;">
      <div style="text-align:center;">
        <div style="height:50px;border-bottom:1.5px dashed #cbd5e1;margin-bottom:6px;"></div>
        <div style="font-size:12px;font-weight:700;color:#374151;">ผู้รับของ / Received By</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:2px;">วันที่ _____ / _____ / _____</div>
      </div>
      <div style="text-align:center;">
        <div style="height:50px;border-bottom:1.5px dashed #cbd5e1;margin-bottom:6px;"></div>
        <div style="font-size:12px;font-weight:700;color:#374151;">ผู้รับเงิน / Authorized</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:2px;">วันที่ _____ / _____ / _____</div>
      </div>
    </div>`;

  /* Paginate items: 10 per page */
  const ITEMS_PER_PAGE = 10;
  const pages = [];
  for (let p=0; p<Math.max(1,Math.ceil(items.length/ITEMS_PER_PAGE)); p++) {
    pages.push(items.slice(p*ITEMS_PER_PAGE, (p+1)*ITEMS_PER_PAGE));
  }

  /* Build CSS */
  const css = `
    @page{size:A4;margin:12mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Sarabun',sans-serif;font-size:13px;color:#1e293b;background:#fff}
    .page{width:100%;min-height:257mm;position:relative;page-break-after:always}
    .page:last-child{page-break-after:auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
    .shop-name{font-size:22px;font-weight:900;color:${hc};}
    .shop-sub{font-size:11px;color:#667085;line-height:1.6;margin-top:2px}
    .doc-badge{background:${hc};color:#fff;padding:10px 18px;border-radius:12px;text-align:center;min-width:140px}
    .doc-badge h2{font-size:16px;font-weight:800;margin:0 0 2px}
    .doc-badge span{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;opacity:.85}
    .doc-meta{text-align:right;font-size:12px;color:#555;margin-top:8px;line-height:1.7}
    .info-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-bottom:20px}
    .info-box{background:#f8fafc;border-radius:12px;padding:14px;border:1px solid #f1f5f9}
    .info-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
    .info-name{font-size:16px;font-weight:800;color:#1e293b;margin-bottom:2px}
    .info-sub{font-size:11px;color:#94a3b8}
    .info-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}
    .info-row span:first-child{color:#64748b}
    .info-row span:last-child{font-weight:600;color:#1e293b}
    table.items{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:16px;border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden}
    table.items thead{background:#f1f5f9}
    table.items th{padding:10px 12px;font-size:11px;font-weight:700;color:#475467;text-transform:uppercase;border-bottom:1px solid #e2e8f0;text-align:left}
    table.items td{padding:10px 12px;font-size:13px;border-bottom:1px solid #f1f5f9;color:#344054}
    table.items tbody tr:last-child td{border-bottom:none}
    table.items tbody tr:nth-child(even){background:#fafafa}
    table.summary{width:100%;border-collapse:collapse}
    table.summary td{padding:7px 4px;font-size:13px;border-bottom:1px solid #f1f5f9}
    .footer-area{position:relative;margin-top:20px}
    .amount-text{background:#f8fafc;border-radius:10px;padding:10px 14px;font-size:12px;margin-bottom:12px}
    .amount-label{font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:3px}
    .amount-val{font-size:14px;font-weight:800;color:${hc}}
    .page-num{text-align:right;font-size:10px;color:#94a3b8;margin-top:8px}
    .note{font-size:11px;color:#667085;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-bottom:10px}
    @media print{body{background:white}.no-print{display:none}@page{size:A4;margin:12mm}}
  `;

  /* Build HTML pages */
  let bodyHTML = '';
  pages.forEach((pageItems, pageIdx) => {
    const isFirst = pageIdx === 0;
    const isLast  = pageIdx === pages.length - 1;

    const itemRowsHTML = pageItems.map((it, i) => `
      <tr>
        <td style="color:#94a3b8;text-align:center;width:36px;">${pageIdx*ITEMS_PER_PAGE+i+1}</td>
        <td><div style="font-weight:600;">${it.name}</div></td>
        <td style="text-align:center;">${v19fmt(docType==='delivery'?(it.deliver_qty||it.qty):it.qty)}</td>
        <td style="text-align:center;color:#64748b;">${it.unit||'ชิ้น'}</td>
        <td style="text-align:right;">${v19fmt(it.price||0)}</td>
        <td style="text-align:right;font-weight:700;">฿${v19fmt(docType==='delivery'?((it.deliver_qty||it.qty)*(it.price||0)):it.total||0)}</td>
      </tr>`).join('');

    bodyHTML += `
    <div class="page">
      ${isFirst ? `
      <div class="header">
        <div>
          ${S.show_shop_name?`<div class="shop-name">${shop.shop_name||'SK POS'}</div>`:''}
          <div class="shop-sub">
            ${S.show_address&&shop.address?`${shop.address}<br>`:''}
            ${shop.phone?`โทร ${shop.phone}`:''} ${S.show_tax_id&&shop.tax_id?`| TAX: ${shop.tax_id}`:''}
          </div>
        </div>
        <div>
          <div class="doc-badge"><h2>${docLabel}</h2><span>${docLabelEN}</span></div>
          <div class="doc-meta">
            ${S.show_bill_no?`เลขที่: <strong>#${bill.bill_no}</strong><br>`:''}
            ${S.show_datetime?`วันที่: <strong>${v19date(bill.date)}</strong>`:''}
          </div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">ลูกค้า / Customer</div>
          ${S.show_customer?`<div class="info-name">${bill.customer_name||'ลูกค้าทั่วไป'}</div>
          <div class="info-sub">${bill.delivery_address||''}</div>`:''}
        </div>
        <div class="info-box">
          ${S.show_staff?`<div class="info-row"><span>พนักงาน</span><span>${bill.staff_name||''}</span></div>`:''}
          ${S.show_method?`<div class="info-row"><span>วิธีชำระ</span><span>${bill.method||''}</span></div>`:''}
          ${bill.delivery_date?`<div class="info-row"><span>วันนัดส่ง</span><span>${bill.delivery_date}</span></div>`:''}
        </div>
      </div>
      ` : `<div style="text-align:right;font-size:11px;color:#94a3b8;margin-bottom:12px;">ต่อจากหน้า ${pageIdx} | ${docLabel} #${bill.bill_no}</div>`}

      <table class="items">
        <thead><tr>
          <th style="width:36px;text-align:center;">#</th>
          <th>รายละเอียดสินค้า</th>
          <th style="text-align:center;width:70px;">จำนวน</th>
          <th style="text-align:center;width:60px;">หน่วย</th>
          <th style="text-align:right;width:90px;">ราคา/หน่วย</th>
          <th style="text-align:right;width:100px;">จำนวนเงิน</th>
        </tr></thead>
        <tbody>${itemRowsHTML}</tbody>
      </table>

      ${!isLast ? `<div style="text-align:center;font-size:12px;color:${hc};font-weight:700;padding:8px;">— มีต่อหน้าถัดไป —</div>` : ''}

      ${isLast ? `
      <div class="footer-area">
        <div style="display:grid;grid-template-columns:1.2fr 0.7fr 1fr;gap:20px;align-items:end;">
          <div>
            <div class="amount-text">
              <div class="amount-label">จำนวนเงินเป็นตัวอักษร</div>
              <div class="amount-val">${v19Baht(displayTotal)}</div>
            </div>
            ${S.footer_text?`<div class="note">📝 ${S.footer_text}</div>`:''}
          </div>
          <div>${qrHtml}</div>
          <div>
            <table class="summary">${summaryRows}</table>
          </div>
        </div>
        ${S.show_signature !== false ? sigHtml : ''}
      </div>
      ` : ''}

      <div class="page-num">หน้า ${pageIdx+1} / ${pages.length}</div>
    </div>`;
  });

  const fullHtml = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
    <title>${docLabel} #${bill.bill_no}</title>
    ${V19_FONTS}<style>${css}</style></head><body>
    ${bodyHTML}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
    </body></html>`;

  const w = window.open('', '_blank', 'width=900,height=900');
  w.document.write(fullHtml);
  w.document.close();
}

/* Override all A4 print functions */
window.v12PrintReceiptA4   = async (id) => { try { await v19PrintA4(id, 'receipt'); } catch(e) { typeof toast==='function'&&toast('พิมพ์ไม่สำเร็จ: '+e.message,'error'); } };
window.v12PrintDeliveryNote = async (id) => { try { await v19PrintA4(id, 'delivery'); } catch(e) { typeof toast==='function'&&toast('พิมพ์ไม่สำเร็จ: '+e.message,'error'); } };
window.v12PrintDeposit      = async (id) => { try { await v19PrintA4(id, 'deposit'); } catch(e) { typeof toast==='function'&&toast('พิมพ์ไม่สำเร็จ: '+e.message,'error'); } };

/* DQ print */
window.v12DQPrintNote = (id) => v19PrintA4(id, 'delivery');

/* History page: add unified print function */
window.v19PrintMenu = function(billId, hasDel) {
  if (typeof Swal === 'undefined') { v12PrintReceipt80mm(billId); return; }
  const opts = [
    { icon:'🧾', label:'ใบเสร็จ 80mm',  fn:()=>v12PrintReceipt80mm(billId) },
    { icon:'📄', label:'ใบเสร็จ A4',    fn:()=>v12PrintReceiptA4(billId) },
  ];
  if (hasDel) opts.push({ icon:'🚚', label:'ใบส่งของ', fn:()=>v12PrintDeliveryNote(billId) });
  opts.push({ icon:'💰', label:'ใบมัดจำ', fn:()=>v12PrintDeposit(billId) });

  Swal.fire({
    title: 'เลือกประเภทเอกสาร',
    html: opts.map((o,i)=>`
      <button onclick="Swal.close();(${o.fn.toString()})();"
        style="width:100%;padding:12px;margin:4px 0;border:1.5px solid #e5e7eb;border-radius:10px;
          background:#fff;cursor:pointer;font-size:14px;font-weight:600;font-family:inherit;
          display:flex;align-items:center;gap:10px;transition:all .15s;"
        onmouseover="this.style.borderColor='#3b82f6';this.style.background='#eff6ff';"
        onmouseout="this.style.borderColor='#e5e7eb';this.style.background='#fff';">
        <span style="font-size:20px;">${o.icon}</span> ${o.label}
      </button>`).join(''),
    showConfirmButton:false, showCloseButton:true,
  });
};


/* ════════════════════════════════════════════════════════════════
   PATCH BMC (History) — เปลี่ยนปุ่มพิมพ์ให้ใช้เมนู
════════════════════════════════════════════════════════════════ */
const _v19OrigBMCLoad = window.v12BMCLoad;
window.v12BMCLoad = async function() {
  await _v19OrigBMCLoad?.();
  /* Patch print buttons → show menu */
  document.querySelectorAll('#bmc-tbody button[onclick*="PrintReceipt80mm"]').forEach(btn => {
    const m = btn.getAttribute('onclick')?.match(/['"]([a-f0-9-]{36})['"]/);
    if (!m) return;
    const billId = m[1];
    const tr = btn.closest('tr');
    const hasDel = tr?.textContent?.includes('ส่ง') || tr?.textContent?.includes('local_shipping');
    btn.setAttribute('onclick', `v19PrintMenu('${billId}', ${!!hasDel})`);
    btn.innerHTML = '<i class="material-icons-round" style="font-size:13px">print</i> พิมพ์';
  });
};

/* Observer สำหรับ re-inject */
(function watchBMC19(){
  const obs = new MutationObserver(() => {
    document.querySelectorAll('#bmc-tbody button[onclick*="PrintReceipt80mm"]').forEach(btn => {
      const m = btn.getAttribute('onclick')?.match(/['"]([a-f0-9-]{36})['"]/);
      if (!m) return;
      const billId = m[1];
      btn.setAttribute('onclick', `v19PrintMenu('${billId}', false)`);
      btn.innerHTML = '<i class="material-icons-round" style="font-size:13px">print</i> พิมพ์';
    });
  });
  const el = document.getElementById('page-history') || document.body;
  obs.observe(el, { childList:true, subtree:true });
})();

console.info(
  '%c[v19] ✅%c Dashboard-UTC | CartClear | Print-80mm+A4+Delivery+Deposit | BMC-PrintMenu',
  'color:#10B981;font-weight:800','color:#6B7280'
);
