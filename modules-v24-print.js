/**
 * SK POS — modules-v24-print.js (v3 — COMPLETE FIX)
 * ████████████████████████████████████████████████████████████████████
 *  FIX1: ลายเซ็นล่น → ลด min-height, ใช้ padding-bottom แทน
 *  FIX2: หน้าลูกหนี้ render หลายครั้ง → เรนเดอร์ครั้งเดียว
 *  FIX3: BMC โชว์ 40 ใบล่าสุด + ค้นหาได้ตลอด
 *  FIX4: พิมพ์กลายเป็นใบรับเงิน → แก้ header_text logic
 *  FIX5: Admin toggle ไม่ทำงาน → แก้ settings key mapping
 * ████████████████████████████████████████████████████████████████████
 */
'use strict';

/* ═══ CACHE ═══ */
let _v24Cfg = null, _v24CfgT = 0;
async function v24GetShopConfig() {
  if (_v24Cfg && Date.now() - _v24CfgT < 60000) return _v24Cfg;
  try { const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle(); _v24Cfg = data || {}; _v24CfgT = Date.now(); } catch (e) { }
  return _v24Cfg || {};
}
async function v24GetDocSettings(key) {
  try {
    const s = typeof v10GetDocSettings === 'function' ? await v10GetDocSettings() : {};
    if (!key) return s;
    const d = typeof V10_DEFAULTS !== 'undefined' ? (V10_DEFAULTS[key] || {}) : {};
    return { ...d, ...(s[key] || {}) };
  } catch (e) { return {}; }
}

/* ═══ THAI NUMBER TO WORDS ═══ */
function v24NumberToThaiWords(n) {
  if (!n || n === 0) return 'ศูนย์บาทถ้วน';
  const dg = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const ps = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  const num = Math.abs(n), baht = Math.floor(num), sat = Math.round((num - baht) * 100);
  function w(v) {
    if (!v) return 'ศูนย์'; let r = ''; const s = String(v), l = s.length;
    for (let i = 0; i < l; i++) {
      const d = +s[i], p = l - i - 1; if (!d) continue;
      if (!p && d === 1 && l > 1) { r += 'เอ็ด'; continue; } if (p === 1 && d === 1) { r += 'สิบ'; continue; }
      if (p === 1 && d === 2) { r += 'ยี่สิบ'; continue; } r += dg[d] + ps[p];
    } return r;
  }
  return w(baht) + 'บาท' + (sat === 0 ? 'ถ้วน' : w(sat) + 'สตางค์');
}

/* ═══ HELPERS ═══ */
const _v24f = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _v24d = d => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + 
         dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
};
/* ═══ DOC TYPES — ALL RED/WHITE ═══ */
const V24_TYPES = {
  receipt: { th: 'ใบเสร็จรับเงิน / ใบกำกับภาษี', en: 'RECEIPT / TAX INVOICE', sk: 'receipt_a4', sig: ['ผู้รับของ / Received By', 'ผู้อนุมัติ / Authorized'] },
  payment: { th: 'ใบรับเงิน', en: 'PAYMENT RECEIPT', sk: 'payment_receipt', sig: ['ผู้จ่ายเงิน / Payer', 'ผู้รับเงิน / Receiver'] },
  delivery: { th: 'ใบส่งของ / ใบกำกับสินค้า', en: 'DELIVERY NOTE', sk: 'receipt_a4', sig: ['ผู้ส่งสินค้า / Delivered By', 'ผู้รับสินค้า / Received By'] },
  quotation: { th: 'ใบเสนอราคา', en: 'QUOTATION', sk: 'quotation', sig: ['ผู้เสนอราคา / Offered By', 'ผู้อนุมัติ / Approved By'] },
  billing: { th: 'ใบวางบิล', en: 'BILLING NOTE', sk: 'receipt_a4', sig: ['ผู้วางบิล / Billed By', 'ผู้รับบิล / Received By'] },
};
const V24C = '#DC2626';

/* ═══ CSS — FIX1: ลด min-height ป้องกันลายเซ็นล่น ═══ */
function v24CSS(n, ds) {
  const bw = ds?.bw_mode, C = bw ? '#000' : (ds?.header_color || V24C);
  const fs = n <= 8 ? 12 : n <= 14 ? 11 : n <= 20 ? 10 : 9;
  const tp = n <= 14 ? '7px 10px' : '5px 8px';
  return `
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap');
@page { size: A4 portrait; margin: 8mm 10mm 8mm 10mm; }
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Sarabun',sans-serif;font-size:${fs}px;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{page-break-after:always;display:flex;flex-direction:column;min-height:calc(297mm - 16mm);padding:0}
.page:last-child{page-break-after:avoid}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:8px;border-bottom:3px solid ${C};margin-bottom:10px}
.sn{font-size:${fs + 10}px;font-weight:800;color:${C};line-height:1.2}
.sa{font-size:${fs - 1}px;color:#64748b;line-height:1.6;margin-top:2px}
.badge{text-align:center;padding:10px 18px;background:${C};color:#fff;border-radius:8px;min-width:180px}
.badge h2{font-size:${fs + 3}px;font-weight:800;margin:0} .badge p{font-size:${fs - 1}px;opacity:.85;margin:1px 0 0}
.meta{text-align:right;margin-top:5px;font-size:${fs - 1}px;color:#475569;line-height:1.8}
.meta strong{color:#1e293b;font-weight:700}
.cbox{margin-bottom:10px;border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden}
.cbox-h{background:${C}08;padding:4px 12px;font-size:${fs - 1}px;font-weight:700;color:${C};border-bottom:1px solid #e2e8f0}
.cbox-b{display:flex;padding:8px 12px;gap:14px}
.cbox-l{flex:1;border-right:1px solid #e2e8f0;padding-right:14px}
.cbox-r{flex:1}
.cn{font-size:${fs + 2}px;font-weight:800;margin-bottom:2px}
.cd{font-size:${fs - 1}px;color:#64748b;line-height:1.6}
.cf{display:flex;justify-content:space-between;padding:2px 0;font-size:${fs - 1}px}
.cf-l{color:#94a3b8} .cf-v{font-weight:600;text-align:right}
table.it{width:100%;border-collapse:collapse;margin-bottom:8px}
table.it thead th{background:${C};color:#fff;padding:${tp};font-size:${fs}px;font-weight:700;white-space:nowrap}
table.it thead th:first-child{border-radius:5px 0 0 0} table.it thead th:last-child{border-radius:0 5px 0 0}
table.it tbody tr{border-bottom:.5px solid #f1f5f9} table.it tbody tr:nth-child(even){background:#fafbfc}
table.it tbody td{padding:${tp};font-size:${fs}px;vertical-align:middle}
.sum{display:flex;justify-content:space-between;gap:14px;margin-top:6px}
.sum-l{flex:1} .sum-r{min-width:200px}
.wb{background:#fef2f2;border:1.5px solid #fecaca;border-radius:7px;padding:6px 10px;margin-bottom:6px}
.wb-l{font-size:${fs - 2}px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px}
.wb-v{font-size:${fs}px;font-weight:700;color:${C}}
.nb{background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:5px 8px;font-size:${fs - 1}px}
.nb b{color:#d97706} .nb p{color:#92400e;line-height:1.4;margin-top:1px}
.sr{display:flex;justify-content:space-between;padding:2px 0;font-size:${fs}px;border-bottom:.5px solid #f1f5f9}
.sr-l{color:#64748b} .sr-v{font-weight:600}
.gt{background:${C};color:#fff;border-radius:7px;padding:8px 12px;margin-top:5px;text-align:center}
.gt-l{font-size:${fs - 1}px;opacity:.85} .gt-v{font-size:${fs + 10}px;font-weight:900;margin:1px 0}
.spacer{flex:1;min-height:10px}
.sig{padding-top:8px;border-top:1.5px solid #e2e8f0;margin-top:auto}
.sig-g{display:flex;justify-content:space-around;gap:24px}
.sig-b{text-align:center;min-width:140px}
.sig-ln{width:100%;height:38px;border-bottom:1.5px solid #94a3b8;margin-bottom:3px}
.sig-n{font-size:${fs}px;font-weight:700} .sig-d{font-size:${fs - 2}px;color:#94a3b8;margin-top:2px}
.ft{text-align:center;font-size:${fs - 2}px;color:#94a3b8;margin-top:5px;padding-top:3px;border-top:.5px solid #f1f5f9}
.cont{text-align:center;font-size:${fs - 1}px;color:#94a3b8;font-style:italic;padding:6px;margin-top:auto}
@media print{.page{min-height:calc(297mm - 16mm);page-break-inside:avoid}.sig{page-break-inside:avoid}}`;
}

/* ═══ QR ═══ */
function v24QR(ds, rc, amt) {
  if (typeof v21BuildQRHtml === 'function') return v21BuildQRHtml(ds, rc, amt, 'a4');
  const pp = (ds?.qr_promptpay || rc?.promptpay_number || '').replace(/[^0-9]/g, '');
  if (pp.length < 10) return '';
  const src = amt > 0 ? `https://promptpay.io/${pp}/${Number(amt).toFixed(2)}.png` : `https://promptpay.io/${pp}.png`;
  return `<div style="text-align:center"><div style="background:#003b71;padding:3px 10px;border-radius:4px;display:inline-block;margin-bottom:4px"><span style="color:#fff;font-size:9px;font-weight:700">PromptPay</span></div><br><img src="${src}" style="width:90px;height:90px" onerror="this.style.display='none'"><div style="font-size:8px;color:#64748b;margin-top:2px">${pp}</div></div>`;
}

/* ═══ PAGES ═══ */
function v24Pages(items, mf = 12, mp = 20) {
  const pg = []; if (!items?.length) { pg.push({ items: [], f: true, l: true, n: 1, t: 1 }); return pg; }
  if (items.length <= mf) { pg.push({ items: [...items], f: true, l: true, n: 1, t: 1 }); return pg; }
  pg.push({ items: items.slice(0, mf), f: true, l: false, n: 1 }); let o = mf;
  while (o < items.length) { pg.push({ items: items.slice(o, o + mp), f: false, l: o + mp >= items.length, n: pg.length + 1 }); o += mp; }
  pg.forEach(p => p.t = pg.length); return pg;
}

/* ═══ RENDER: Header — FIX4: ใช้ชื่อจาก V24_TYPES ไม่ใช่ settings ═══ */
function v24Hdr(rc, dt, bill, pn, tp, ds) {
  const cfg = V24_TYPES[dt];
  // FIX4: ใช้ชื่อ doc type จาก config เสมอ ไม่ใช้ header_text จาก settings (ป้องกันข้ามค่า)
  const title = cfg.th;
  return `<div class="hdr"><div style="max-width:55%">
    ${ds?.show_shop_name !== false ? `<div class="sn">${rc?.shop_name || 'ร้านค้า'}</div>` : ''}
    ${rc?.shop_name_en ? `<div style="font-size:0.9em;font-weight:600;color:#475569">${rc.shop_name_en}</div>` : ''}
    ${ds?.show_address !== false && rc?.address ? `<div class="sa">${rc.address}${rc?.phone ? '<br>โทร: ' + rc.phone : ''}</div>` : ''}
    ${ds?.show_tax_id !== false && rc?.tax_id ? `<div style="font-weight:600;color:#475569">เลขผู้เสียภาษี: ${rc.tax_id}</div>` : ''}
  </div><div style="text-align:right">
    <div class="badge"><h2>${title}</h2><p>${cfg.en}</p></div>
    <div class="meta">
      ${ds?.show_bill_no !== false ? `เลขที่: <strong>${bill.bill_no || '-'}</strong><br>` : ''}
      ${ds?.show_datetime !== false ? `วันที่: <strong>${_v24d(bill.date)}</strong>` : ''}
      ${tp > 1 ? `<br>หน้า ${pn}/${tp}` : ''}
    </div>
  </div></div>`;
}

/* ═══ RENDER: Customer ═══ */
function v24Cust(bill, ds, dt) {
  if (ds?.show_customer === false) return '';
  
  // สำรองข้อมูล เผื่อมีใน delivery_address/phone
  const custAddr = bill.customer_address || bill.delivery_address || '';
  const custPhone = bill.customer_phone || bill.delivery_phone || '';

  return `<div class="cbox"><div class="cbox-h">ข้อมูลลูกค้า / CUSTOMER</div><div class="cbox-b">
    <div class="cbox-l">
      <div class="cn">${bill.customer_name || 'ลูกค้าทั่วไป'}</div>
      <div class="cd">
        ${custAddr ? `<span style="display:block;white-space:pre-line;margin-bottom:2px;">${custAddr}</span>` : ''}
        ${custPhone ? `<span style="display:block;font-weight:600;color:#475569;"><span style="font-size:10px;">📞</span> ${custPhone}</span>` : ''}
        ${!custAddr && !custPhone && bill.customer_name !== 'ลูกค้าทั่วไป' ? 'ไม่มีข้อมูลที่อยู่และเบอร์โทร' : ''}
      </div>
    </div>
    <div class="cbox-r">
      ${ds?.show_staff !== false ? `<div class="cf"><span class="cf-l">พนักงานขาย:</span><span class="cf-v">${bill.staff_name || '-'}</span></div>` : ''}
      ${ds?.show_method !== false ? `<div class="cf"><span class="cf-l">วิธีชำระเงิน:</span><span class="cf-v">${bill.method || '-'}</span></div>` : ''}
      ${dt === 'delivery' && bill.delivery_address && bill.delivery_address !== custAddr ? `<div class="cf" style="margin-top:4px;padding-top:4px;border-top:1px dashed #e2e8f0;"><span class="cf-l">สถานที่จัดส่ง:</span><span class="cf-v" style="text-align:right;">${bill.delivery_address}</span></div>` : ''}
    </div>
  </div></div>`;
}

/* ═══ RENDER: Table ═══ */
function v24Tbl(items, off = 0) {
  const r = items.map((it, i) => `<tr>
    <td style="text-align:center;width:30px;color:#94a3b8;font-weight:600">${off + i + 1}</td>
    <td><span style="font-weight:600">${it.name || ''}</span></td>
    <td style="text-align:center;width:65px">${_v24f(+(it.qty || 1)).replace(/\.00$/, '')}</td>
    <td style="text-align:center;width:50px">${it.unit || 'ชิ้น'}</td>
    <td style="text-align:right;width:80px">${_v24f(+(it.price || 0))}</td>
    <td style="text-align:right;width:90px;font-weight:700">${_v24f(+(it.total || 0))}</td>
  </tr>`).join('');
  return `<table class="it"><thead><tr>
    <th style="text-align:center;width:30px">#</th><th>รายละเอียด / DESCRIPTION</th>
    <th style="text-align:center;width:65px">จำนวน</th><th style="text-align:center;width:50px">หน่วย</th>
    <th style="text-align:right;width:80px">ราคา/หน่วย</th><th style="text-align:right;width:90px">จำนวนเงิน</th>
  </tr></thead><tbody>${r}</tbody></table>`;
}

/* ═══ RENDER: Summary ═══ */
function v24Sum(bill, items, ds, rc) {
  const sub = items.reduce((s, i) => s + +(i.total || 0), 0);
  const disc = +(bill.discount || 0), total = +(bill.total || sub - disc);
  const rcv = +(bill.received || 0), chg = +(bill.change || 0), dep = +(bill.deposit_amount || 0);
  const nt = ds?.note_text || 'สินค้าที่ส่งมอบแล้วไม่รับเปลี่ยนหรือคืน';
  
  let bankInfo = '';
  if (rc?.bank_account && rc?.bank_name) {
    bankInfo = `<div class="nb" style="margin-top:8px;"><b>🏦 รายละเอียดการโอนเงิน</b><p>ธนาคาร: ${rc.bank_name}<br>เลขบัญชี: ${rc.bank_account}${rc.promptpay_name ? `<br>ชื่อบัญชี: ${rc.promptpay_name}` : ''}</p></div>`;
  }

  return `<div class="sum"><div class="sum-l">
    <div class="wb"><div class="wb-l">จำนวนเงิน (ตัวอักษร)</div><div class="wb-v">${v24NumberToThaiWords(total)}</div></div>
    <div class="nb"><b>📝 หมายเหตุ</b><p>${nt}</p></div>
    ${bankInfo}
  </div><div id="v24qr" style="text-align:center;min-width:90px;flex-shrink:0"></div>
  <div class="sum-r">
    <div class="sr"><span class="sr-l">รวมเงิน (Subtotal)</span><span class="sr-v">${_v24f(sub)}</span></div>
    ${disc > 0 ? `<div class="sr"><span class="sr-l">ส่วนลด</span><span class="sr-v" style="color:#dc2626">-${_v24f(disc)}</span></div>` : ''}
    ${dep > 0 ? `<div class="sr"><span class="sr-l">มัดจำ</span><span class="sr-v" style="color:#d97706">${_v24f(dep)}</span></div>` : ''}
    <div class="gt"><div class="gt-l">จำนวนเงินรวมทั้งสิ้น / GRAND TOTAL</div><div class="gt-v">฿${_v24f(total)}</div></div>
    ${bill.method === 'เงินสด' && rcv > 0 ? `<div style="margin-top:4px">
      <div class="sr"><span class="sr-l">รับมา</span><span class="sr-v">${_v24f(rcv)}</span></div>
      <div class="sr"><span class="sr-l">เงินทอน</span><span class="sr-v" style="color:#059669">${_v24f(chg)}</span></div>
    </div>` : ''}
  </div></div>`;
}

/* ═══ RENDER: Signature ═══ */
function v24Sig(dt) {
  const cfg = V24_TYPES[dt] || V24_TYPES.receipt;
  return `<div class="spacer"></div><div class="sig"><div class="sig-g">${cfg.sig.map(l =>
    `<div class="sig-b"><div class="sig-ln"></div><div class="sig-n">${l}</div><div class="sig-d">วันที่ / Date ......../......../........</div></div>`
  ).join('')}</div></div>`;
}

/* ═══════════════════════════════════════════════
   MAIN PRINT — FIX4: docType title from config
═══════════════════════════════════════════════ */
window.v24PrintDocument = async function (bill, items, docType = 'receipt') {
  const rc = await v24GetShopConfig();
  const cfg = V24_TYPES[docType] || V24_TYPES.receipt;
  const ds = await v24GetDocSettings(cfg.sk);
  const pages = v24Pages(items || [], 12, 20);
  const win = window.open('', '_blank', 'width=960,height=1050');
  if (!win) { typeof toast === 'function' && toast('กรุณาอนุญาต popup', 'error'); return; }
  let html = '', off = 0;
  for (const pg of pages) {
    html += '<div class="page">';
    html += v24Hdr(rc, docType, bill, pg.n, pg.t, ds);
    if (pg.f) html += v24Cust(bill, ds, docType);
    if (pg.items.length) { html += v24Tbl(pg.items, off); off += pg.items.length; }
    if (pg.l) {
      html += v24Sum(bill, items || [], ds, rc); html += v24Sig(docType);
      html += `<div class="ft">${ds?.footer_text || rc?.receipt_footer || 'ขอบคุณที่ใช้บริการ'}</div>`;
    } else { html += '<div class="cont">— ต่อหน้าถัดไป —</div>'; }
    html += '</div>';
  }
  const qr = v24QR(ds, rc, bill.total || 0);
  win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${cfg.th} #${bill.bill_no || ''}</title>
<style>${v24CSS((items || []).length, ds)}</style></head><body>${html}
<script>(function(){var q=document.getElementById('v24qr');if(q)q.innerHTML=${JSON.stringify(qr)};
function b(){setTimeout(function(){window.print();setTimeout(function(){window.close()},1500)},800)}
if(document.readyState==='complete')b();else window.onload=b})()<\/script></body></html>`);
  win.document.close();
};

/* ═══════════════════════════════════════════════
   DOC SELECTOR POPUP
═══════════════════════════════════════════════ */
async function v24ShowDocSelector(billId) {
  const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
  const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
  if (!bill) { typeof toast === 'function' && toast('ไม่พบบิล', 'error'); return; }
  const hasDel = bill.delivery_mode === 'deliver' || bill.delivery_mode === 'partial';
  const isDep = +(bill.deposit_amount || 0) > 0, isDebt = bill.status === 'ค้างชำระ';
  const opts = [
    { key: 'receipt', lbl: '📄 ใบเสร็จรับเงิน / ใบกำกับภาษี', sub: 'Receipt / Tax Invoice', show: true },
    { key: 'payment', lbl: '💰 ใบรับเงิน', sub: 'Payment Receipt', show: isDep || isDebt },
    { key: 'delivery', lbl: '🚚 ใบส่งของ', sub: 'Delivery Note', show: hasDel },
  ].filter(o => o.show);
  if (opts.length === 1) { await v24PrintDocument(bill, items || [], 'receipt'); return; }
  const { value: dt, isConfirmed } = await Swal.fire({
    title: '📄 เลือกประเภทเอกสาร', showCancelButton: true,
    confirmButtonText: '🖨️ พิมพ์เอกสาร', cancelButtonText: 'ยกเลิก', confirmButtonColor: V24C, width: 440,
    html: `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${opts.map((d, i) => `
      <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid ${i === 0 ? V24C : '#e2e8f0'};
        border-radius:10px;cursor:pointer;background:${i === 0 ? V24C + '08' : '#fff'}"
        onmouseenter="this.style.borderColor='${V24C}'" onmouseleave="if(!this.querySelector('input').checked)this.style.borderColor='#e2e8f0'">
        <input type="radio" name="v24dt" value="${d.key}" ${i === 0 ? 'checked' : ''} style="width:18px;height:18px;accent-color:${V24C}"
          onclick="this.closest('label').parentNode.querySelectorAll('label').forEach(l=>{l.style.borderColor='#e2e8f0';l.style.background='#fff'});this.closest('label').style.borderColor='${V24C}';this.closest('label').style.background='${V24C}08'">
        <div style="text-align:left;flex:1"><div style="font-weight:700;font-size:14px">${d.lbl}</div>
        <div style="font-size:11px;color:#64748b">${d.sub}</div></div></label>`).join('')}</div>`,
    preConfirm: () => document.querySelector('input[name="v24dt"]:checked')?.value || 'receipt'
  });
  if (!isConfirmed) return;
  await v24PrintDocument(bill, items || [], dt);
}

/* ═══════════════════════════════════════════════
   OVERRIDES — FIX4: ทุก print function → v24
═══════════════════════════════════════════════ */
window.v12PrintReceiptA4 = async billId => v24ShowDocSelector(billId);
window.v12PrintDeliveryNote = async billId => { 
  const { data: b } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle(); 
  const { data: i } = await db.from('รายการในบิล').select('*').eq('bill_id', billId); 
  if (b) {
    const activeItems = (i || []).map(it => {
      let displayName = it.name;
      const tk = it.take_qty || 0;
      const dq = it.deliver_qty || 0;
      if (tk > 0) {
        if (dq > 0) displayName += ` (รับแล้ว ${tk}, ส่งรอบนี้ ${dq})`;
        else displayName += ` (ลูกค้ารับไปเองแล้ว ${tk})`;
      }
      return { ...it, name: displayName, qty: it.qty };
    });
    v24PrintDocument(b, activeItems, 'delivery'); 
  }
};
window.v12PrintDeposit = async billId => { const { data: b } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle(); const { data: i } = await db.from('รายการในบิล').select('*').eq('bill_id', billId); if (b) v24PrintDocument(b, i || [], 'payment'); };
window.printA4 = (bill, items) => v24PrintDocument(bill, items || [], 'receipt');
// FIX4: override printReceiptA4v2 ให้ใช้ v24 เสมอ
window.printReceiptA4v2 = async (bill, items) => v24PrintDocument(bill, items || [], 'receipt');
// FIX4: override printReceipt ให้ popup เลือก 80mm หรือ A4→v24
window.printReceipt = async function (bill, items, format) {
  if (format === '80mm' || format === '80') {
    const rc = await v24GetShopConfig();
    if (typeof print80mmv2 === 'function') print80mmv2(bill, items || [], rc);
    return;
  }
  if (format === 'A4') { await v24PrintDocument(bill, items || [], 'receipt'); return; }
  // No format → show picker
  const { value: fmt } = await Swal.fire({
    title: 'เลือกรูปแบบ', showCancelButton: true, cancelButtonText: 'ยกเลิก',
    html: `<div style="display:flex;gap:12px;justify-content:center;padding:12px 0">
      <button onclick="window._v24fmt='80mm';Swal.clickConfirm()" style="flex:1;padding:16px;border:2px solid #DC2626;border-radius:12px;background:#fff5f5;cursor:pointer;font-size:13px;color:#DC2626;font-weight:700;font-family:var(--font-thai,'Prompt'),sans-serif">
        <div style="font-size:28px;margin-bottom:6px">🧾</div>80 mm</button>
      <button onclick="window._v24fmt='A4';Swal.clickConfirm()" style="flex:1;padding:16px;border:2px solid #2563EB;border-radius:12px;background:#eff6ff;cursor:pointer;font-size:13px;color:#2563EB;font-weight:700;font-family:var(--font-thai,'Prompt'),sans-serif">
        <div style="font-size:28px;margin-bottom:6px">📄</div>A4</button></div>`,
    showConfirmButton: false, didOpen: () => { window._v24fmt = null; }
  });
  if (!window._v24fmt) return;
  if (window._v24fmt === 'A4') await v24PrintDocument(bill, items || [], 'receipt');
  else { const rc = await v24GetShopConfig(); if (typeof print80mmv2 === 'function') print80mmv2(bill, items || [], rc); }
};
window.v5PrintFromHistory = async billId => v24ShowDocSelector(billId);
window.v12PrintReceipt80mm = async function (billId) {
  const { data: b } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
  const { data: i } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
  if (!b) return; const rc = await v24GetShopConfig();
  if (typeof print80mmv2 === 'function') print80mmv2(b, i || [], rc);
};

/* ═══════════════════════════════════════════════
   QUOTATION PRINT
═══════════════════════════════════════════════ */
window.v24PrintQuotation = async function (quotId) {
  const { data: q } = await db.from('ใบเสนอราคา').select('*').eq('id', quotId).maybeSingle();
  if (!q) { typeof toast === 'function' && toast('ไม่พบใบเสนอราคา', 'error'); return; }
  const { data: qi } = await db.from('รายการใบเสนอราคา').select('*').eq('quotation_id', quotId);
  await v24PrintDocument({ bill_no: q.quotation_no || `QT-${String(q.id).slice(0, 8)}`, date: q.date || q.created_at, customer_name: q.customer_name || 'ลูกค้า', total: q.total || 0, discount: q.discount || 0, method: '-', staff_name: q.staff_name || '-' }, qi || [], 'quotation');
};

/* ═══════════════════════════════════════════════
   BILLING NOTE — เฉพาะหน้าลูกหนี้
═══════════════════════════════════════════════ */
window.v24PrintBillingNote = async function (custId, custName) {
  if (typeof window.v9AutoUpdateBillStatus === 'function') {
    await window.v9AutoUpdateBillStatus(custId);
  }
  const { data: bills } = await db.from('บิลขาย').select('*').eq('customer_id', custId).in('status', ['ค้างชำระ', 'จ่ายแล้วบางส่วน']).order('date', { ascending: true });

  if (!bills?.length) {
    typeof toast === 'function' && toast('ไม่มีบิลค้างชำระ', 'info');
    return;
  }

  const items = bills.map(b => {
    let retInfo = b.return_info || {};
    if (typeof retInfo === 'string') {
      try { retInfo = JSON.parse(retInfo); } catch(e) { retInfo = {}; }
    }
    const paid = parseFloat(retInfo.paid_amount || 0);
    const original = parseFloat(b.total || 0);
    const remaining = original - paid;
    const fn = typeof formatNum === 'function' ? formatNum : v => v;
    
    return {
      name: `บิล #${b.bill_no} — ${_v24d(b.date)}${paid > 0 ? ` (ยอดเต็ม ฿${fn(original)} ชำระแล้ว ฿${fn(paid)})` : ''}`,
      qty: 1,
      unit: 'บิล',
      price: remaining,
      total: remaining
    };
  });

  const total = items.reduce((s, b) => s + b.total, 0);

  let addr = '', phone = '';
  try {
    const { data: c } = await db.from('customer').select('address,phone').eq('id', custId).maybeSingle();
    if (c) {
      addr = c.address || '';
      phone = c.phone || '';
    }
  } catch (_) { }

  await v24PrintDocument({
    bill_no: `BN-${Date.now().toString().slice(-8)}`,
    date: new Date().toISOString(),
    customer_name: custName,
    customer_address: addr,
    customer_phone: phone,
    total,
    discount: 0,
    method: 'ค้างชำระ',
    staff_name: (typeof USER !== 'undefined' && USER) ? USER.username : '-'
  }, items, 'billing');
};

/* ═══════════════════════════════════════════════
   FIX2: หน้าลูกหนี้ — render ครั้งเดียว + loading
═══════════════════════════════════════════════ */
window.renderDebts = async function () {
  const section = document.getElementById('page-debt');
  if (!section) return;
  
  // แสดง loading ก่อน
  section.innerHTML = `<div style="padding:80px;text-align:center;color:#94a3b8">
    <div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#dc2626;border-radius:50%;animation:v24spin .8s linear infinite;margin:0 auto 16px"></div>
    <style>@keyframes v24spin{to{transform:rotate(360deg)}}</style>
    <div style="font-weight:600;">กำลังโหลดข้อมูลลูกหนี้...</div>
  </div>`;
  
  const { data } = await db.from('customer').select('*').gt('debt_amount', 0).order('debt_amount', { ascending: false });
  const total = (data || []).reduce((s, c) => s + c.debt_amount, 0);
  const fn = typeof formatNum === 'function' ? formatNum : v => v;

  const style = `
  <style>
    .debt-container { padding: 24px; max-width: 1200px; margin: 0 auto; animation: fade-in-up 0.4s ease-out; }
    @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .debt-hero { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; box-shadow: 0 4px 15px rgba(220, 38, 38, 0.05); border: 1px solid rgba(220, 38, 38, 0.1); flex-wrap: wrap; gap: 20px; }
    .debt-hero-left h2 { color: #991b1b; font-size: 24px; font-weight: 700; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px; }
    .debt-hero-left p { color: #b91c1c; margin: 0; font-size: 14px; opacity: 0.9; }
    .debt-stat-boxes { display: flex; gap: 16px; flex-wrap: wrap; }
    .debt-stat-box { background: #fff; border-radius: 12px; padding: 16px 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); min-width: 180px; border: 1px solid #fff; }
    .debt-stat-box .lbl { font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
    .debt-stat-box .val { font-size: 28px; font-weight: 800; color: #1e293b; line-height: 1.1; }
    .debt-stat-box.danger .val { color: #dc2626; }
    .debt-table-card { background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; overflow-x: auto; }
    .debt-table { width: 100%; border-collapse: collapse; min-width: 800px; }
    .debt-table th { background: #f8fafc; color: #475569; font-size: 13px; font-weight: 600; padding: 16px 20px; text-align: left; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
    .debt-table td { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
    .debt-table tbody tr:hover { background: #fdf2f8; }
    .debt-cust-name { font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 14px; }
    .debt-avatar { width: 42px; height: 42px; border-radius: 12px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; }
    .debt-amt { font-weight: 800; color: #dc2626; font-size: 16px; background: #fef2f2; padding: 4px 10px; border-radius: 8px; display: inline-block; }
    .debt-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn-pay { background: #dc2626; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; font-family: inherit; font-size: 13px; }
    .btn-pay:hover { background: #b91c1c; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(220,38,38,0.25); }
    .btn-icon-soft { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: none; background: #f1f5f9; color: #64748b; cursor: pointer; transition: all 0.2s; }
    .btn-icon-soft:hover { background: #e2e8f0; color: #0f172a; transform: translateY(-1px); }
    .btn-icon-soft.danger:hover { background: #fee2e2; color: #dc2626; }
    @media (max-width: 768px) { .debt-hero { flex-direction: column; align-items: flex-start; } .debt-stat-boxes { width: 100%; } .debt-stat-box { flex: 1; min-width: 140px; } }
  </style>`;

  const tableRows = (data || []).map((c, i) => {
    const n = c.name.replace(/'/g, "&apos;");
    const initial = c.name.charAt(0).toUpperCase();
    return `<tr>
      <td>
        <div class="debt-cust-name">
          <div class="debt-avatar">${initial}</div>
          <div>
            <div style="font-size:15px;line-height:1.2;">${c.name}</div>
            <div style="font-size:12px;color:#64748b;font-weight:400;margin-top:4px;">ID: ${c.id.slice(0,8)}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="color:#475569;display:flex;align-items:center;gap:6px;font-size:14px;">
          <i class="material-icons-round" style="font-size:16px;color:#94a3b8">phone</i> ${c.phone || '-'}
        </div>
      </td>
      <td style="text-align:right;color:#64748b;font-size:14px;">฿${fn(c.credit_limit)}</td>
      <td style="text-align:right;"><span class="debt-amt">฿${fn(c.debt_amount)}</span></td>
      <td>
        <div class="debt-actions">
          <button class="btn-pay" onclick="recordDebtPayment('${c.id}','${n}')">
            <i class="material-icons-round" style="font-size:18px;">payments</i> รับชำระ
          </button>
          <button class="btn-icon-soft" onclick="v24ViewDebtBills('${c.id}','${n}')" title="ดูบิลค้างชำระ" style="color:#7c3aed;border-color:rgba(124,58,237,.2)">
            <i class="material-icons-round" style="font-size:18px;">receipt</i>
          </button>
          <button class="btn-icon-soft danger" onclick="v24PrintBillingNote('${c.id}','${n}')" title="พิมพ์ใบวางบิล">
            <i class="material-icons-round" style="font-size:18px;">receipt_long</i>
          </button>
          <button class="btn-icon-soft" onclick="viewDebtHistory('${c.id}','${n}')" title="ประวัติลูกหนี้">
            <i class="material-icons-round" style="font-size:18px;">history</i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  section.innerHTML = `${style}
  <div class="debt-container">
    <div class="debt-hero">
      <div class="debt-hero-left">
        <h2><i class="material-icons-round" style="font-size:28px;">account_balance_wallet</i> จัดการลูกหนี้</h2>
        <p>ระบบติดตามและรับชำระเงินค้างจ่าย</p>
      </div>
      <div class="debt-stat-boxes">
        <div class="debt-stat-box danger">
          <div class="lbl">ยอดหนี้รวมทั้งหมด</div>
          <div class="val">฿${fn(total)}</div>
        </div>
        <div class="debt-stat-box">
          <div class="lbl">ลูกค้าค้างชำระ</div>
          <div class="val">${(data || []).length} ราย</div>
        </div>
      </div>
    </div>

    <div class="debt-table-card">
      ${data && data.length > 0 ? `
      <table class="debt-table">
        <thead>
          <tr>
            <th>ข้อมูลลูกค้า</th>
            <th>ติดต่อ</th>
            <th style="text-align:right;">วงเงินเครดิต</th>
            <th style="text-align:right;">ยอดหนี้คงค้าง</th>
            <th style="text-align:right;">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>` : `
      <div style="padding:60px;text-align:center;color:#64748b;">
        <i class="material-icons-round" style="font-size:48px;color:#cbd5e1;margin-bottom:12px;">check_circle</i>
        <h3 style="margin:0;font-size:18px;color:#1e293b;">ไม่มีลูกค้าค้างชำระ</h3>
        <p style="margin:8px 0 0;font-size:14px;">สถานะการเงินปกติ ไม่มีหนี้คงค้างในระบบ</p>
      </div>
      `}
    </div>
  </div>`;
};

/* ═══════════════════════════════════════════════
   ดูบิลค้างชำระของลูกค้า — แสดงยอดเดิม/ยอดหลังคืน/ยอดค้าง
═══════════════════════════════════════════════ */
window.v24ViewDebtBills = async function(custId, custName) {
  const fn = typeof formatNum === 'function' ? formatNum : v => v;
  const { data: bills } = await db.from('บิลขาย').select('*')
    .eq('customer_id', custId).in('status', ['ค้างชำระ','คืนบางส่วน','จ่ายแล้วบางส่วน'])
    .order('date', { ascending: true });
  if (!bills?.length) { typeof toast === 'function' && toast('ไม่มีบิลค้างชำระ', 'info'); return; }
  const totalDebt = bills.reduce((s,b) => {
    const effTotal = b.return_info?.new_total ?? b.total;
    return s + Math.max(0, effTotal - (b.deposit_amount||0));
  }, 0);
  const rows = bills.map(b => {
    const hasReturn = b.return_info?.return_total > 0;
    const origTotal = b.return_info?.original_total || b.total;
    const effTotal = b.return_info?.new_total ?? b.total;
    const dep = b.deposit_amount || 0;
    const remaining = Math.max(0, effTotal - dep);
    const dateStr = b.date ? new Date(b.date).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}) : '-';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:8px;background:#f8fafc;margin-bottom:6px;border:1px solid #e2e8f0;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:13px;">#${b.bill_no} <span style="font-size:11px;color:#64748b;font-weight:400;">${dateStr}</span></div>
        ${hasReturn ? `<div style="font-size:11px;color:#7c3aed;margin-top:2px;">เดิม ฿${fn(origTotal)} → คืน ฿${fn(b.return_info.return_total)} → ยอดใหม่ ฿${fn(effTotal)}</div>` : ''}
        ${dep > 0 ? `<div style="font-size:11px;color:#d97706;margin-top:1px;">มัดจำ ฿${fn(dep)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:12px;">
        <div style="font-weight:700;color:#dc2626;font-size:14px;">฿${fn(remaining)}</div>
        <div style="display:flex;gap:4px;margin-top:4px;">
          <button onclick="closeModal();setTimeout(()=>v20BMCPayDebt('${b.id}'),200)" style="border:1px solid #d1fae5;background:#fff;color:#059669;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600;">รับชำระ</button>
          ${!['คืนสินค้า','ยกเลิก'].includes(b.status) ? `<button onclick="closeModal();setTimeout(()=>typeof v10ShowReturnModal==='function'?v10ShowReturnModal('${b.id}'):v12ReturnBill('${b.id}'),200)" style="border:1px solid #fde68a;background:#fff;color:#d97706;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600;">คืนของ</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  if (typeof openModal === 'function') {
    openModal(`บิลค้างชำระ: ${custName}`, `
      <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;color:#64748b;">${bills.length} บิล</span>
        <span style="font-size:16px;font-weight:800;color:#dc2626;">รวม ฿${fn(totalDebt)}</span>
      </div>
      <div style="max-height:400px;overflow-y:auto;">${rows}</div>
    `);
  }
};

/* ═══════════════════════════════════════════════
   FIX3: BMC — โชว์ 40 ใบล่าสุด + ค้นหาได้ตลอด
═══════════════════════════════════════════════ */
// Override renderHistory เพื่อเปลี่ยน layout — ไม่ต้องเลือกวันโดย default
const _v24OrigRenderHistory = window.renderHistory;
window.renderHistory = async function () {
  const sec = document.getElementById('page-history'); if (!sec) return;
  const today = new Date().toISOString().split('T')[0];
  sec.innerHTML = `
    <style>
      .v12-bmc-tab { background: #f1f5f9; color: #64748b; border: none; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-thai, 'Prompt'), sans-serif; white-space: nowrap; }
      .v12-bmc-tab:hover { background: #e2e8f0; color: #334155; }
      .v12-bmc-tab.active { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); }
      .v12-bmc-tab .tab-count { background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 10px; font-size: 11px; }
      .v12-bmc-table th { padding: 14px 20px; color: #64748b; font-weight: 600; font-size: 13px; text-transform: uppercase; text-align: left; background: #fff; border-bottom: 2px solid #f1f5f9; }
      .v12-bmc-table td { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
      .v12-bmc-table tr { transition: background 0.2s; }
      .v12-bmc-table tbody tr:hover { background: #f8fafc; }
    </style>
    <div style="max-width:1200px; margin:0 auto; padding-bottom:30px; animation: fade-in-up 0.4s ease-out;">
      <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1px solid #a7f3d0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.05); flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 56px; height: 56px; background: #fff; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.1);">
            <i class="material-icons-round" style="font-size: 32px; color: #10b981;">receipt_long</i>
          </div>
          <div>
            <h2 style="margin: 0; font-size: 24px; color: #065f46; font-weight: 700; font-family: var(--font-display);">ประวัติการขาย</h2>
            <div style="color: #059669; font-size: 14px; margin-top: 4px;">ศูนย์จัดการบิลและประวัติการทำรายการ</div>
          </div>
        </div>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px; background: #fff; padding: 4px 12px; border-radius: 8px; border: 1px solid #a7f3d0;">
            <input type="date" id="bmc-date-from" value="" onchange="v12BMCLoad()" style="border:none; outline:none; background:transparent; font-size: 14px; color: #334155; font-family: inherit;">
            <span style="color: #94a3b8; font-weight: 600; font-size: 13px;">ถึง</span>
            <input type="date" id="bmc-date-to" value="" onchange="v12BMCLoad()" style="border:none; outline:none; background:transparent; font-size: 14px; color: #334155; font-family: inherit;">
          </div>
          <button onclick="typeof v20BMCExport==='function'&&v20BMCExport()" style="background: #fff; color: #10b981; border: 1px solid #a7f3d0; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 8px 16px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='#fff'">
            <i class="material-icons-round" style="font-size: 18px;">download</i> Export
          </button>
        </div>
      </div>
      
      <div id="bmc-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;"></div>

      <div style="background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; flex-wrap: wrap; gap: 16px;">
          <div class="v12-bmc-tabs" style="display: flex; gap: 8px; flex-wrap: wrap; flex: 1;">
            <button class="v12-bmc-tab active" id="bmc-tab-all" onclick="v12BMCSetTab('all')">📋 ทั้งหมด <span class="tab-count" id="bmc-cnt-all">0</span></button>
            <button class="v12-bmc-tab" id="bmc-tab-done" onclick="v12BMCSetTab('done')">🟢 สำเร็จ <span class="tab-count" id="bmc-cnt-done">0</span></button>
            <button class="v12-bmc-tab" id="bmc-tab-pending" onclick="v12BMCSetTab('pending')">🟡 รอจัดส่ง <span class="tab-count" id="bmc-cnt-pending">0</span></button>
            <button class="v12-bmc-tab" id="bmc-tab-debt" onclick="v12BMCSetTab('debt')">🔴 ค้างชำระ <span class="tab-count" id="bmc-cnt-debt">0</span></button>
            <button class="v12-bmc-tab" id="bmc-tab-deposit" onclick="v12BMCSetTab('deposit')">🟠 มัดจำ <span class="tab-count" id="bmc-cnt-deposit">0</span></button>
            <button class="v12-bmc-tab" id="bmc-tab-returned" onclick="v12BMCSetTab('returned')">🟣 คืน <span class="tab-count" id="bmc-cnt-returned">0</span></button>
            <button class="v12-bmc-tab" id="bmc-tab-cancelled" onclick="v12BMCSetTab('cancelled')">⚫ ยกเลิก <span class="tab-count" id="bmc-cnt-cancelled">0</span></button>
          </div>
          <div style="position: relative; width: 100%; max-width: 300px;">
            <i class="material-icons-round" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 20px;">search</i>
            <input type="text" id="bmc-search" placeholder="ค้นหาเลขบิล, ลูกค้า..." oninput="v12BMCLoad()" style="width: 100%; padding: 8px 12px 8px 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#cbd5e1'">
          </div>
        </div>
        <div style="overflow-x: auto;">
          <table class="v12-bmc-table" style="width: 100%; border-collapse: collapse; margin: 0; border: none; white-space: nowrap;">
            <thead>
              <tr>
                <th>บิล #</th>
                <th>วันเวลา</th>
                <th>ลูกค้า</th>
                <th>วิธีชำระ</th>
                <th>จัดส่ง</th>
                <th style="text-align:right">ยอดรวม</th>
                <th>สถานะ</th>
                <th style="text-align:right">จัดการ</th>
              </tr>
            </thead>
            <tbody id="bmc-tbody">
              <tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;"><i class="material-icons-round" style="font-size:48px;color:#cbd5e1;margin-bottom:12px;display:block;">receipt_long</i> กำลังโหลด...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  window.v12BMCActiveTab = 'all';
  await v12BMCLoad();
};

// Override v12BMCLoad — ถ้าไม่เลือกวัน → ดึง 40 ใบล่าสุด, ถ้าเลือกวัน → filter ตามวัน, ค้นหาได้ตลอด
window.v12BMCLoad = async function () {
  const df = document.getElementById('bmc-date-from')?.value || '';
  const dt = document.getElementById('bmc-date-to')?.value || '';
  const search = document.getElementById('bmc-search')?.value?.toLowerCase() || '';
  try {
    let query = db.from('บิลขาย').select('*').order('date', { ascending: false });
    // ถ้ามีค้นหา → ค้นหาทั้งหมด
    if (search) {
      // ค้นหาไม่จำกัดวัน — limit สูงสุด 200
      query = query.limit(200);
    } else if (df && dt) {
      // filter ตามวัน
      query = query.gte('date', typeof _v20AddTZ === 'function' ? _v20AddTZ(df + 'T00:00:00') : df + 'T00:00:00')
        .lte('date', typeof _v20AddTZ === 'function' ? _v20AddTZ(dt + 'T23:59:59') : dt + 'T23:59:59');
    } else {
      // default: 40 ใบล่าสุด
      query = query.limit(40);
    }
    const { data: bills } = await query;
    // filter by search text
    const all = (bills || []).filter(b => !search || b.bill_no?.toString().includes(search) || b.customer_name?.toLowerCase().includes(search));
    const isDep = b => b.deposit_amount > 0 && b.deposit_amount < b.total && !['ยกเลิก', 'คืนสินค้า'].includes(b.status);
    const cnt = {
      all: all.length, done: all.filter(b => b.status === 'สำเร็จ').length,
      pending: all.filter(b => b.delivery_status === 'รอจัดส่ง').length,
      debt: all.filter(b => b.status === 'ค้างชำระ' && !isDep(b)).length,
      deposit: all.filter(isDep).length,
      returned: all.filter(b => ['คืนสินค้า', 'คืนบางส่วน'].includes(b.status)).length,
      cancelled: all.filter(b => b.status === 'ยกเลิก').length
    };
    Object.entries(cnt).forEach(([k, v]) => { const el = document.getElementById(`bmc-cnt-${k}`); if (el) el.textContent = v; });
    const tab = window.v12BMCActiveTab || 'all';
    let f = all;
    if (tab === 'done') f = all.filter(b => b.status === 'สำเร็จ');
    else if (tab === 'pending') f = all.filter(b => b.delivery_status === 'รอจัดส่ง');
    else if (tab === 'debt') f = all.filter(b => b.status === 'ค้างชำระ' && !isDep(b));
    else if (tab === 'deposit') f = all.filter(isDep);
    else if (tab === 'returned') f = all.filter(b => ['คืนสินค้า', 'คืนบางส่วน'].includes(b.status));
    else if (tab === 'cancelled') f = all.filter(b => b.status === 'ยกเลิก');
    const tb = document.getElementById('bmc-tbody'); if (!tb) return;
    if (!f.length) {
      tb.innerHTML = `<tr><td colspan="8"><div class="v12-bmc-empty"><i class="material-icons-round">receipt_long</i><p style="font-size:14px;font-weight:600;margin:0 0 4px">ไม่พบบิล</p></div></td></tr>`;
      if (typeof _v20Sum === 'function') _v20Sum([]);
      return;
    }
    tb.innerHTML = f.map(b => {
      // อนุญาตให้คืนเพิ่มสำหรับบิล "คืนบางส่วน" ด้วย
      const fullyTerminated = ['ยกเลิก', 'คืนสินค้า'].includes(b.status);
      const canReturn = !fullyTerminated && !b.project_id;
      const hd = b.status === 'ค้างชำระ', hp = b.deposit_amount > 0 && b.deposit_amount < b.total, jp = !!b.project_id;
      const hasReturnInfo = b.return_info?.return_total > 0;
      const _d = typeof _v20d === 'function' ? _v20d : d => new Date(d).toLocaleDateString('th-TH');
      const _t = typeof _v20t === 'function' ? _v20t : d => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const _f = typeof _v20f === 'function' ? _v20f : v => Number(v).toLocaleString();
      const mb = typeof v12BMCMethodBadge === 'function' ? v12BMCMethodBadge(b.method) : b.method;
      const db2 = typeof v12BMCDeliveryBadge === 'function' ? v12BMCDeliveryBadge(b.delivery_status) : (b.delivery_status || '-');
      const sb = typeof v12BMCBadge === 'function' ? v12BMCBadge(b.status) : b.status;
      // แสดงยอดเดิม vs ยอดหลังคืน
      const displayTotal = b.total;
      const origTotalInfo = hasReturnInfo ? `<div style="font-size:10px;color:#7c3aed;margin-top:1px">เดิม ฿${_f(b.return_info.original_total)} → คืน ฿${_f(b.return_info.return_total)}</div>` : '';
      return `<tr class="v20-bmc-row"><td><strong class="v20-bill-no">#${b.bill_no}</strong>${jp ? '<br><span style="font-size:10px;color:#8b5cf6">📁 โครงการ</span>' : ''}</td>
        <td style="font-size:12px;color:var(--text-muted)">${_d(b.date)}<br>${_t(b.date)}</td>
        <td><div style="font-size:13px;font-weight:500">${b.customer_name || 'ลูกค้าทั่วไป'}</div><div style="font-size:11px;color:var(--text-muted)">${b.staff_name || ''}</div></td>
        <td>${mb}</td><td>${db2}</td>
        <td style="text-align:right"><div style="font-size:14px;font-weight:700">฿${_f(displayTotal)}</div>${origTotalInfo}${hp ? `<div style="font-size:11px;color:#d97706">มัดจำ ฿${_f(b.deposit_amount)}</div>` : hd ? `<div style="font-size:11px;color:#ef4444">ค้าง ฿${_f(Math.max(0,(b.return_info?.new_total ?? b.total) - (b.deposit_amount || 0)))}</div>` : ''}</td>
        <td>${sb}${hp ? '<br><span class="v12-status-badge v12-badge-orange" style="font-size:10px;margin-top:2px">💰 มัดจำ</span>' : ''}</td>
        <td><div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="v12-bmc-action-btn" onclick="viewBillDetail('${b.id}')"><i class="material-icons-round" style="font-size:13px">receipt</i> ดู</button>
          <button class="v12-bmc-action-btn" onclick="v24ShowDocSelector('${b.id}')"><i class="material-icons-round" style="font-size:13px">print</i> พิมพ์</button>
          ${hd && !jp ? `<button class="v12-bmc-action-btn" onclick="v20BMCPayDebt('${b.id}')" style="color:#10b981;border-color:rgba(16,185,129,.3)"><i class="material-icons-round" style="font-size:13px">payments</i> รับชำระ</button>` : ''}
          ${canReturn ? `<button class="v12-bmc-action-btn" onclick="typeof v10ShowReturnModal==='function'?v10ShowReturnModal('${b.id}'):v12ReturnBill('${b.id}')" style="color:#d97706;border-color:rgba(217,119,6,.25)"><i class="material-icons-round" style="font-size:13px">assignment_return</i> คืน</button>` : ''}
          ${!fullyTerminated && !jp ? `<button class="v12-bmc-action-btn danger" onclick="cancelBill('${b.id}')"><i class="material-icons-round" style="font-size:13px">cancel</i></button>` : ''}
        </div></td></tr>`;
    }).join('');
    if (typeof _v20Sum === 'function') _v20Sum(f);
  } catch (e) {
    console.error('[v24] BMC:', e);
    const tb = document.getElementById('bmc-tbody');
    if (tb) tb.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:#ef4444">โหลดไม่สำเร็จ: ${e.message}</td></tr>`;
  }
};
// Expose for BMC print buttons
window.v24ShowDocSelector = v24ShowDocSelector;

/* ═══════════════════════════════════════════════
   Step 6 override
═══════════════════════════════════════════════ */
const _v24OrigS6 = window.v12S6;
window.v12S6 = function (container) {
  if (typeof _v24OrigS6 === 'function') _v24OrigS6(container);
  setTimeout(() => {
    if (!container) return;
    const pg = container.querySelector('.sk-s6-print-grid'); if (!pg) return;
    const b = typeof v12State !== 'undefined' && v12State.savedBill; if (!b) return;
    const a4 = pg.querySelector('[onclick*="v12PrintReceiptA4"]');
    if (a4) {
      a4.onclick = () => v24ShowDocSelector(b.id);
      a4.innerHTML = '<i class="material-icons-round">article</i><div><div class="pk-title">เลือกเอกสาร A4</div><div class="pk-sub">ใบเสร็จ / ใบส่งของ / ใบรับเงิน</div></div>';
    }
  }, 100);
};

/* ═══ BOOT ═══ */
console.info('%c[v24] ✅%c Document Print v3 — All 5 fixes applied', 'color:#dc2626;font-weight:900', 'color:#6B7280');
