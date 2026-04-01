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
const _v24d = d => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

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
  return `<div class="cbox"><div class="cbox-h">ข้อมูลลูกค้า / CUSTOMER</div><div class="cbox-b">
    <div class="cbox-l"><div class="cn">${bill.customer_name || 'ลูกค้าทั่วไป'}</div>
      ${bill.customer_address ? `<div class="cd" style="white-space:pre-line">${bill.customer_address}</div>` : ''}
      ${bill.customer_phone ? `<div class="cd">โทร: ${bill.customer_phone}</div>` : ''}
    </div><div class="cbox-r">
      ${ds?.show_staff !== false ? `<div class="cf"><span class="cf-l">พนักงาน</span><span class="cf-v">${bill.staff_name || '-'}</span></div>` : ''}
      ${ds?.show_method !== false ? `<div class="cf"><span class="cf-l">วิธีชำระ</span><span class="cf-v">${bill.method || '-'}</span></div>` : ''}
      ${dt === 'delivery' && bill.delivery_address ? `<div class="cf"><span class="cf-l">ที่อยู่จัดส่ง</span><span class="cf-v">${bill.delivery_address}</span></div>` : ''}
    </div></div></div>`;
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
function v24Sum(bill, items, ds) {
  const sub = items.reduce((s, i) => s + +(i.total || 0), 0);
  const disc = +(bill.discount || 0), total = +(bill.total || sub - disc);
  const rcv = +(bill.received || 0), chg = +(bill.change || 0), dep = +(bill.deposit_amount || 0);
  const nt = ds?.note_text || 'สินค้าที่ส่งมอบแล้วไม่รับเปลี่ยนหรือคืน';
  return `<div class="sum"><div class="sum-l">
    <div class="wb"><div class="wb-l">จำนวนเงิน (ตัวอักษร)</div><div class="wb-v">${v24NumberToThaiWords(total)}</div></div>
    <div class="nb"><b>📝 หมายเหตุ</b><p>${nt}</p></div>
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
      html += v24Sum(bill, items || [], ds); html += v24Sig(docType);
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
window.v12PrintDeliveryNote = async billId => { const { data: b } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle(); const { data: i } = await db.from('รายการในบิล').select('*').eq('bill_id', billId); if (b) v24PrintDocument(b, i || [], 'delivery'); };
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
  const { data: bills } = await db.from('บิลขาย').select('*').eq('customer_id', custId).eq('status', 'ค้างชำระ').order('date', { ascending: true });

  if (!bills?.length) {
    typeof toast === 'function' && toast('ไม่มีบิลค้างชำระ', 'info');
    return;
  }

  // แก้ไขตรงนี้: เปลี่ยน s++ เป็น s + 
  const total = bills.reduce((s, b) => s + (b.total || 0), 0);

  const items = bills.map(b => ({
    name: `บิล #${b.bill_no} — ${_v24d(b.date)}`,
    qty: 1,
    unit: 'บิล',
    price: +(b.total || 0),
    total: +(b.total || 0)
  }));

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
  section.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text-tertiary)">
    <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#dc2626;border-radius:50%;animation:v24spin .8s linear infinite;margin:0 auto 12px"></div>
    <style>@keyframes v24spin{to{transform:rotate(360deg)}}</style>กำลังโหลดข้อมูลลูกหนี้...</div>`;
  const { data } = await db.from('customer').select('*').gt('debt_amount', 0).order('debt_amount', { ascending: false });
  const total = (data || []).reduce((s, c) => s + c.debt_amount, 0);
  section.innerHTML = `<div class="inv-container">
    <div class="inv-stats">
      <div class="inv-stat danger"><span class="inv-stat-value">฿${typeof formatNum === 'function' ? formatNum(total) : total}</span><span class="inv-stat-label">หนี้รวมทั้งหมด</span></div>
      <div class="inv-stat"><span class="inv-stat-value">${(data || []).length}</span><span class="inv-stat-label">ลูกค้าค้างชำระ</span></div>
    </div><div class="table-wrapper"><table class="data-table"><thead><tr><th>ลูกค้า</th><th>เบอร์โทร</th><th class="text-right">หนี้คงค้าง</th><th class="text-right">วงเงิน</th><th>จัดการ</th></tr></thead>
    <tbody>${(data || []).map(c => {
    const fn = typeof formatNum === 'function' ? formatNum : v => v; const n = c.name.replace(/'/g, "&apos;"); return `<tr>
      <td><strong>${c.name}</strong></td><td>${c.phone || '-'}</td>
      <td class="text-right"><strong style="color:var(--danger)">฿${fn(c.debt_amount)}</strong></td>
      <td class="text-right">฿${fn(c.credit_limit)}</td>
      <td><div class="table-actions">
        <button class="btn btn-primary btn-sm" onclick="recordDebtPayment('${c.id}','${n}')"><i class="material-icons-round">payments</i> รับชำระ</button>
        <button class="btn btn-ghost btn-icon" onclick="v24PrintBillingNote('${c.id}','${n}')" title="พิมพ์ใบวางบิล" style="color:#DC2626"><i class="material-icons-round">receipt_long</i></button>
        <button class="btn btn-ghost btn-icon" onclick="viewDebtHistory('${c.id}','${n}')"><i class="material-icons-round">history</i></button>
      </div></td></tr>`}).join('')}</tbody></table></div></div>`;
};

/* ═══════════════════════════════════════════════
   FIX3: BMC — โชว์ 40 ใบล่าสุด + ค้นหาได้ตลอด
═══════════════════════════════════════════════ */
// Override renderHistory เพื่อเปลี่ยน layout — ไม่ต้องเลือกวันโดย default
const _v24OrigRenderHistory = window.renderHistory;
window.renderHistory = async function () {
  const sec = document.getElementById('page-history'); if (!sec) return;
  const today = new Date().toISOString().split('T')[0];
  sec.innerHTML = `<div class="v12-bmc-container"><div class="v20-bmc-header"><div class="v20-bmc-title"><i class="material-icons-round">receipt_long</i> ศูนย์จัดการบิล</div></div>
  <div class="v12-bmc-search-bar">
    <div class="v12-bmc-search"><i class="material-icons-round" style="color:var(--text-muted,#9ca3af);font-size:18px">search</i>
      <input type="text" id="bmc-search" placeholder="ค้นหาเลขบิล, ชื่อลูกค้า..." oninput="v12BMCLoad()">
    </div>
    <div class="v20-date-range" style="display:flex;align-items:center;gap:6px">
      <input type="date" class="v12-bmc-date" id="bmc-date-from" value="" onchange="v12BMCLoad()">
      <span style="color:var(--text-muted);font-size:13px;font-weight:600">ถึง</span>
      <input type="date" class="v12-bmc-date" id="bmc-date-to" value="" onchange="v12BMCLoad()">
    </div>
    <button onclick="typeof v20BMCExport==='function'&&v20BMCExport()" class="v20-export-btn"><i class="material-icons-round" style="font-size:16px">download</i> Export</button>
  </div>
  <div class="v12-bmc-tabs">
    <button class="v12-bmc-tab active" id="bmc-tab-all" onclick="v12BMCSetTab('all')">📋 ทั้งหมด <span class="tab-count" id="bmc-cnt-all">0</span></button>
    <button class="v12-bmc-tab" id="bmc-tab-done" onclick="v12BMCSetTab('done')">🟢 สำเร็จ <span class="tab-count" id="bmc-cnt-done">0</span></button>
    <button class="v12-bmc-tab" id="bmc-tab-pending" onclick="v12BMCSetTab('pending')">🟡 รอจัดส่ง <span class="tab-count" id="bmc-cnt-pending">0</span></button>
    <button class="v12-bmc-tab" id="bmc-tab-debt" onclick="v12BMCSetTab('debt')">🔴 ค้างชำระ <span class="tab-count" id="bmc-cnt-debt">0</span></button>
    <button class="v12-bmc-tab" id="bmc-tab-deposit" onclick="v12BMCSetTab('deposit')">🟠 มัดจำ <span class="tab-count" id="bmc-cnt-deposit">0</span></button>
    <button class="v12-bmc-tab" id="bmc-tab-returned" onclick="v12BMCSetTab('returned')">🟣 คืน <span class="tab-count" id="bmc-cnt-returned">0</span></button>
    <button class="v12-bmc-tab" id="bmc-tab-cancelled" onclick="v12BMCSetTab('cancelled')">⚫ ยกเลิก <span class="tab-count" id="bmc-cnt-cancelled">0</span></button>
  </div>
  <div class="v12-bmc-table-wrap"><table class="v12-bmc-table"><thead><tr>
    <th>บิล #</th><th>วันเวลา</th><th>ลูกค้า</th><th>วิธีชำระ</th><th>จัดส่ง</th><th style="text-align:right">ยอดรวม</th><th>สถานะ</th><th>จัดการ</th>
  </tr></thead><tbody id="bmc-tbody"><tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted)">⏳ กำลังโหลด...</td></tr></tbody></table></div>
  <div class="v20-bmc-summary" id="bmc-summary"></div></div>`;
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
      const ter = ['ยกเลิก', 'คืนสินค้า', 'คืนบางส่วน'].includes(b.status);
      const hd = b.status === 'ค้างชำระ', hp = b.deposit_amount > 0 && b.deposit_amount < b.total, jp = !!b.project_id;
      const _d = typeof _v20d === 'function' ? _v20d : d => new Date(d).toLocaleDateString('th-TH');
      const _t = typeof _v20t === 'function' ? _v20t : d => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const _f = typeof _v20f === 'function' ? _v20f : v => Number(v).toLocaleString();
      const mb = typeof v12BMCMethodBadge === 'function' ? v12BMCMethodBadge(b.method) : b.method;
      const db2 = typeof v12BMCDeliveryBadge === 'function' ? v12BMCDeliveryBadge(b.delivery_status) : (b.delivery_status || '-');
      const sb = typeof v12BMCBadge === 'function' ? v12BMCBadge(b.status) : b.status;
      return `<tr class="v20-bmc-row"><td><strong class="v20-bill-no">#${b.bill_no}</strong>${jp ? '<br><span style="font-size:10px;color:#8b5cf6">📁 โครงการ</span>' : ''}</td>
        <td style="font-size:12px;color:var(--text-muted)">${_d(b.date)}<br>${_t(b.date)}</td>
        <td><div style="font-size:13px;font-weight:500">${b.customer_name || 'ลูกค้าทั่วไป'}</div><div style="font-size:11px;color:var(--text-muted)">${b.staff_name || ''}</div></td>
        <td>${mb}</td><td>${db2}</td>
        <td style="text-align:right"><div style="font-size:14px;font-weight:700">฿${_f(b.total)}</div>${hp ? `<div style="font-size:11px;color:#d97706">มัดจำ ฿${_f(b.deposit_amount)}</div>` : hd ? `<div style="font-size:11px;color:#ef4444">ค้าง ฿${_f(b.total - (b.deposit_amount || 0))}</div>` : ''}</td>
        <td>${sb}${hp ? '<br><span class="v12-status-badge v12-badge-orange" style="font-size:10px;margin-top:2px">💰 มัดจำ</span>' : ''}</td>
        <td><div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="v12-bmc-action-btn" onclick="viewBillDetail('${b.id}')"><i class="material-icons-round" style="font-size:13px">receipt</i> ดู</button>
          <button class="v12-bmc-action-btn" onclick="v24ShowDocSelector('${b.id}')"><i class="material-icons-round" style="font-size:13px">print</i> พิมพ์</button>
          ${hd && !jp ? `<button class="v12-bmc-action-btn" onclick="v20BMCPayDebt('${b.id}')" style="color:#10b981;border-color:rgba(16,185,129,.3)"><i class="material-icons-round" style="font-size:13px">payments</i> รับชำระ</button>` : ''}
          ${!ter && !jp ? `<button class="v12-bmc-action-btn" onclick="typeof v10ShowReturnModal==='function'?v10ShowReturnModal('${b.id}'):v12ReturnBill('${b.id}')" style="color:#d97706;border-color:rgba(217,119,6,.25)"><i class="material-icons-round" style="font-size:13px">assignment_return</i> คืน</button><button class="v12-bmc-action-btn danger" onclick="cancelBill('${b.id}')"><i class="material-icons-round" style="font-size:13px">cancel</i></button>` : ''}
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
