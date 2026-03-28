// ══════════════════════════════════════════════════════════════════
// modules-v11.js — COMPREHENSIVE FIX v2
// 1. CSS: mobile dashboard, tabs, toggles
// 2. Dashboard COGS: หัก return cost
// 3. Home profit: ใช้ logic เดียวกับ Dashboard
// 4. A4 ใบเสร็จ: ลายเซ็นชิดล่าง + QR + สีสัน + 1 หน้า
// 5. Toggle switch fix + live preview
// ══════════════════════════════════════════════════════════════════

console.log('[v11] Loading modules-v11.js v2...');


// ══════════════════════════════════════
// V11-1: CSS FIXES
// ══════════════════════════════════════

(function v11InjectCSS() {
  const el = document.getElementById('v11-css-fixes');
  if (el) el.remove();
  const style = document.createElement('style');
  style.id = 'v11-css-fixes';
  style.textContent = `
    /* Attendance Tabs scroll */
    #page-att > div > div:first-child {
      display: flex !important; overflow-x: auto !important;
      -webkit-overflow-scrolling: touch !important; scrollbar-width: none !important;
    }
    #page-att > div > div:first-child::-webkit-scrollbar { display: none !important; }
    #page-att .att-tab { flex-shrink: 0 !important; white-space: nowrap !important; }
    
    @media (max-width: 768px) {
      #page-att .att-tab { padding: 10px 14px !important; font-size: 12px !important; gap: 4px !important; }
      #page-att, #page-att > div { max-width: 100vw !important; overflow-x: hidden !important; }
      #att-tab-emps div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
    }

    /* ─── Dashboard mobile FULL WIDTH ─── */
    @media (max-width: 900px) {
      #page-dash { padding: 0 !important; }
      #page-dash > div { padding: 0 !important; }
      #dash-content > div[style*="grid-template-columns:2fr"] {
        grid-template-columns: 1fr !important; gap: 10px !important;
      }
      #dash-content > div[style*="grid-template-columns:1fr 1fr 1fr"] {
        grid-template-columns: 1fr !important; gap: 10px !important;
      }
    }
    @media (max-width: 600px) {
      #dash-content > div[style*="grid-template-columns:repeat(auto-fill"] {
        grid-template-columns: repeat(2, 1fr) !important; gap: 6px !important;
      }
      #dash-content > div[style*="grid-template-columns:repeat(auto-fill"] > div {
        padding: 10px !important;
      }
      #dash-content > div[style*="grid-template-columns:repeat(auto-fill"] > div div[style*="font-size:20px"] {
        font-size: 15px !important;
      }
      #dash-content > div[style*="height:120px"] {
        height: 80px !important;
      }
      /* Bar chart label */
      #dash-content > div[style*="height:120px"] div[style*="font-size:9px"] {
        font-size: 7px !important;
      }
    }

    /* ─── Toggle Switch ─── */
    .v11-toggle { position: relative; display: inline-block; width: 40px; height: 22px; cursor: pointer; flex-shrink: 0; }
    .v11-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .v11-toggle .v11-slider {
      position: absolute; inset: 0; border-radius: 22px;
      background: #CBD5E1; transition: background .25s;
    }
    .v11-toggle input:checked + .v11-slider { background: var(--primary, #dc2626); }
    .v11-toggle .v11-slider::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18);
      transition: transform .25s;
    }
    .v11-toggle input:checked + .v11-slider::after { transform: translateX(18px); }

    /* ─── Home page mobile ─── */
    @media (max-width: 600px) {
      #page-home > div { padding: 0 !important; }
    }
  `;
  document.head.appendChild(style);
  console.log('[v11-1] ✅ CSS fixes');
})();



// ══════════════════════════════════════
// V11-3: HOME PROFIT — ใช้ logic เดียวกับ Dashboard
// updateHomeStats is local to app.js so we override it on window
// ══════════════════════════════════════

window.updateHomeStats = async function () {
  const el = document.getElementById('home-username');
  if (el) el.textContent = typeof USER !== 'undefined' ? (USER?.username || 'User') : 'User';
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data: bills } = await db.from('บิลขาย')
      .select('total, discount, id, status, return_info')
      .gte('date', today + 'T00:00:00').lte('date', today + 'T23:59:59')
      .in('status', ['สำเร็จ', 'คืนบางส่วน']);

    const totalSales = bills?.reduce((sum, b) => sum + (b.total || 0), 0) || 0;
    const ordersCount = bills?.length || 0;
    let profit = 0;

    const todayBillIds = bills?.map(b => b.id) || [];
    if (todayBillIds.length > 0) {
      const { data: items } = await db.from('รายการในบิล')
        .select('total, cost, qty, bill_id, name').in('bill_id', todayBillIds);

      // COGS from all items
      let totalCost = (items || []).reduce((s, i) => s + ((i.cost || 0) * (i.qty || 1)), 0);

      // ✅ Deduct returned items' cost
      let returnCostTotal = 0;
      (bills || []).forEach(b => {
        if (b.return_info?.return_items) {
          b.return_info.return_items.forEach(ri => {
            const qty = parseFloat(ri.qty || 0);
            let cost = parseFloat(ri.cost || 0);
            if (!cost) {
              const orig = (items || []).find(i => i.bill_id === b.id && i.name === ri.name);
              cost = orig?.cost || 0;
            }
            returnCostTotal += cost * qty;
          });
        }
      });

      const adjustedCost = totalCost - returnCostTotal;
      profit = totalSales - adjustedCost;
    }

    const cashBalance = typeof getCashBalance === 'function' ? await getCashBalance() : 0;
    const salesEl = document.getElementById('home-sales');
    const ordersEl = document.getElementById('home-orders');
    const profitEl = document.getElementById('home-profit');
    const cashEl = document.getElementById('home-cash');
    const globalCashEl = document.getElementById('global-cash-balance');

    if (salesEl) salesEl.textContent = `฿${formatNum(totalSales)}`;
    if (ordersEl) ordersEl.textContent = formatNum(ordersCount);
    if (profitEl) profitEl.textContent = `฿${formatNum(profit)}`;
    if (cashEl) cashEl.textContent = `฿${formatNum(cashBalance)}`;
    if (globalCashEl) globalCashEl.textContent = `฿${formatNum(cashBalance)}`;
    typeof updateAlerts === 'function' && updateAlerts();
  } catch (e) { console.error('[v11] Stats error:', e); }
};
console.log('[v11-3] ✅ Home profit = Dashboard profit');


// ══════════════════════════════════════
// V11-4: Fix A4 Receipt — Signature at bottom + fit 1 page
// Override the v10 printReceiptA4v2 
// ══════════════════════════════════════

window.printReceiptA4v2 = async function (bill, items, rc, docType = 'receipt') {
  const ds = typeof v10GetDocSettings === 'function' ? await v10GetDocSettings() : {};
  const s = ds.receipt_a4 || (typeof V10_DEFAULTS !== 'undefined' ? V10_DEFAULTS.receipt_a4 : {});
  const hc = s.bw_mode ? '#333333' : (s.header_color || '#af101a');
  const shopName = rc?.shop_name || 'SK POS';
  const shopNameEn = rc?.shop_name_en || '';
  const shopAddr = rc?.address || '';
  const shopPhone = rc?.phone || '';
  const shopTax = rc?.tax_id || '';
  const qrId = rc?.promptpay_id || rc?.qr_promptpay || '';

  // Fetch customer address if needed
  if (bill.customer_id && !bill.customer_address) {
    try {
      const { data: cust } = await db.from('customer').select('address,tax_id').eq('id', bill.customer_id).maybeSingle();
      if (cust) { bill.customer_address = cust.address || ''; bill.customer_tax_id = cust.tax_id || ''; }
    } catch (_) { }
  }

  const subtotal = (items || []).reduce((sum, i) => sum + (i.total || 0), 0);
  const discount = bill.discount || 0;
  const afterDiscount = subtotal - discount;
  const vatRate = rc?.vat_rate || 0;
  const vatAmount = vatRate > 0 ? Math.round(afterDiscount * vatRate / 100) : 0;
  const grandTotal = bill.total || (afterDiscount + vatAmount);
  const dateObj = bill.date ? new Date(bill.date) : new Date();
  const dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

  const isDelivery = docType === 'delivery';
  const docLabel = isDelivery ? 'ใบส่งของ' : (s.header_text || 'ใบเสร็จรับเงิน / ใบกำกับภาษี');
  const docLabelEn = isDelivery ? 'DELIVERY NOTE' : 'RECEIPT / TAX INVOICE';
  const noteText = s.note_text || 'สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน';

  // Build rows (scale font if many items)
  const itemCount = (items || []).length;
  const rowPad = itemCount > 12 ? '6px 12px' : '10px 14px';
  const rowFont = itemCount > 12 ? '11px' : '13px';

  const rows = (items || []).map((it, idx) => `
    <tr style="${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
      <td style="padding:${rowPad};text-align:center;color:#94a3b8;font-size:${rowFont};">${idx + 1}</td>
      <td style="padding:${rowPad};"><div style="font-weight:600;font-size:${rowFont};color:#1e293b;">${it.name}</div></td>
      <td style="padding:${rowPad};text-align:right;font-size:${rowFont};">${formatNum(it.qty)}</td>
      <td style="padding:${rowPad};text-align:center;font-size:${rowFont};color:#64748b;">${it.unit || 'ชิ้น'}</td>
      <td style="padding:${rowPad};text-align:right;font-size:${rowFont};">${formatNum(it.price)}</td>
      <td style="padding:${rowPad};text-align:right;font-weight:700;font-size:${rowFont};">${formatNum(it.total)}</td>
    </tr>`).join('');

  const w = window.open('', '_blank', 'width=900,height=900');
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>${isDelivery ? 'ใบส่งของ' : 'ใบเสร็จ'} #${bill.bill_code}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
  .headline { font-family: 'Manrope', 'Sarabun', sans-serif; }
  .page { min-height: 277mm; max-height: 277mm; position: relative; padding: 20px 24px; overflow: hidden; display: flex; flex-direction: column; }
  .content { flex: 1; }
  .sig-section { margin-top: auto; padding-top: 20px; }
  @media print { body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div class="page">
<div class="content">

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;">
    <div style="max-width:55%;">
      ${s.show_shop_name !== false ? `
        <h2 class="headline" style="font-size:20px;font-weight:800;color:${hc};margin-bottom:1px;">${shopName}</h2>
        ${shopNameEn ? `<h3 class="headline" style="font-size:13px;font-weight:600;color:#5b403d;margin-bottom:8px;">${shopNameEn}</h3>` : ''}` : ''}
      <div style="font-size:11px;color:#5b403d;line-height:1.7;">
        ${s.show_address !== false && shopAddr ? `<p>${shopAddr}</p>` : ''}
        ${shopPhone ? `<p>โทร ${shopPhone}</p>` : ''}
        ${s.show_tax_id !== false && shopTax ? `<p><b>Tax ID:</b> <span style="font-family:monospace;">${shopTax}</span></p>` : ''}
      </div>
    </div>
    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
      <div style="background:${hc};padding:8px 18px;border-radius:6px;">
        <h1 class="headline" style="color:#fff;font-size:15px;font-weight:800;">${docLabel}</h1>
        <p style="color:rgba(255,255,255,0.65);font-size:9px;">${docLabelEn}</p>
      </div>
      <div style="font-size:12px;margin-top:2px;">
        ${s.show_bill_code !== false ? `<p>เลขที่: <b>${bill.bill_code}</b></p>` : ''}
        ${s.show_datetime !== false ? `<p>วันที่: <b>${dateStr}</b></p>` : ''}
      </div>
    </div>
  </div>

  <!-- CUSTOMER + META -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;padding:12px 0;border-top:1px solid ${hc}15;border-bottom:1px solid ${hc}15;">
    ${s.show_customer !== false ? `
    <div>
      <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#5b403d;font-weight:700;">ลูกค้า / Customer</span>
      <div style="background:#f2f4f5;padding:10px 12px;border-radius:8px;margin-top:4px;">
        <p style="font-weight:700;font-size:14px;">${bill.customer_name || 'ลูกค้าทั่วไป'}</p>
        ${bill.customer_address ? `<p style="font-size:11px;color:#5b403d;margin-top:2px;">${bill.customer_address}</p>` : ''}
        ${bill.customer_tax_id ? `<p style="font-size:11px;color:#5b403d;">Tax: ${bill.customer_tax_id}</p>` : ''}
      </div>
    </div>` : '<div></div>'}
    <div style="display:flex;flex-direction:column;justify-content:flex-end;gap:6px;font-size:12px;">
      ${s.show_staff !== false ? `<div style="display:flex;justify-content:space-between;border-bottom:1px solid ${hc}10;padding-bottom:6px;"><span style="color:#5b403d;">พนักงาน</span><span>${bill.staff_name || '-'}</span></div>` : ''}
      ${s.show_method !== false ? `<div style="display:flex;justify-content:space-between;border-bottom:1px solid ${hc}10;padding-bottom:6px;"><span style="color:#5b403d;">ชำระเงิน</span><span>${bill.method || '-'}</span></div>` : ''}
    </div>
  </div>

  <!-- TABLE -->
  <div style="margin-bottom:14px;overflow:hidden;border-radius:8px;border:1px solid ${hc}15;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#e6e8e9;">
          <th class="headline" style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;width:32px;">#</th>
          <th class="headline" style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;">รายละเอียดสินค้า</th>
          <th class="headline" style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;width:60px;">จำนวน</th>
          <th class="headline" style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;width:50px;">หน่วย</th>
          <th class="headline" style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;width:80px;">ราคา/หน่วย</th>
          <th class="headline" style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;width:90px;">จำนวนเงิน</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <!-- SUMMARY -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">
    <div>
      <div style="background:#f2f4f5;padding:10px 12px;border-radius:8px;margin-bottom:8px;">
        <span style="font-size:9px;text-transform:uppercase;font-weight:700;color:#5b403d;">จำนวนเงินตัวอักษร</span>
        <p style="font-size:12px;font-weight:700;color:${hc};margin-top:2px;">${typeof v10NumToThaiText === 'function' ? v10NumToThaiText(grandTotal) : ''}</p>
      </div>
      ${noteText ? `<div><p style="font-size:10px;font-weight:700;color:#ba1a1a;margin-bottom:2px;">ⓘ หมายเหตุ</p><p style="font-size:10px;color:#5b403d;font-style:italic;">${noteText}</p></div>` : ''}
    </div>
    <div style="display:flex;gap:12px;align-items:flex-end;justify-content:flex-end;">
      ${qrId && s.show_qr !== false ? `
      <div style="border:1px solid #e4beba30;padding:8px;border-radius:10px;width:110px;text-align:center;">
        <div style="background:#003b71;padding:3px 0;border-radius:4px;margin-bottom:4px;"><span style="color:#fff;font-size:9px;font-weight:700;">PromptPay</span></div>
        <img src="https://promptpay.io/${qrId}/${grandTotal}.png" style="width:88px;height:88px;" onerror="this.style.display='none'">
        <p style="font-size:8px;color:#003b71;font-weight:700;margin-top:3px;">สแกนเพื่อชำระเงิน</p>
      </div>` : ''}
      <div style="width:220px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 10px;"><span style="color:#5b403d;">รวมเงิน</span><span>${formatNum(subtotal)}</span></div>
        ${discount > 0 && s.show_discount !== false ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 10px;color:#ba1a1a;"><span>ส่วนลด</span><span>-${formatNum(discount)}</span></div>` : ''}
        ${vatRate > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 10px;"><span style="color:#5b403d;">VAT ${vatRate}%</span><span>${formatNum(vatAmount)}</span></div>` : ''}
        <div style="background:${hc};padding:12px 14px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;color:#fff;margin-top:4px;">
          <div>
            <span class="headline" style="font-weight:800;font-size:11px;">จำนวนเงิน</span><br>
            <span class="headline" style="font-weight:800;font-size:11px;">รวมทั้งสิ้น</span><br>
            <span style="font-size:7px;opacity:.65;">GRAND TOTAL</span>
          </div>
          <span class="headline" style="font-size:20px;font-weight:800;">${formatNum(grandTotal)}</span>
        </div>
        ${s.show_received !== false && bill.received ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;padding:3px 10px;margin-top:4px;"><span>รับเงิน</span><span>฿${formatNum(bill.received)}</span></div>` : ''}
        ${s.show_change !== false && bill.change ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;padding:3px 10px;"><span>ทอน</span><span>฿${formatNum(bill.change)}</span></div>` : ''}
      </div>
    </div>
  </div>
</div>

<!-- SIGNATURE — pushed to bottom via flex -->
<div class="sig-section">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;">
    <div style="text-align:center;">
      <div style="border-bottom:1px dotted #5b403d;height:28px;width:160px;margin:0 auto;"></div>
      <p style="font-weight:700;font-size:12px;margin-top:8px;">ผู้รับของ / Received By</p>
      <p style="font-size:9px;color:#5b403d;margin-top:2px;">วันที่ ......../......../........</p>
    </div>
    <div style="text-align:center;position:relative;">
      <div style="border-bottom:1px dotted #5b403d;height:28px;width:160px;margin:0 auto;"></div>
      <div style="position:absolute;top:-36px;right:8px;width:56px;height:56px;border:3px solid ${hc}33;border-radius:50%;display:flex;align-items:center;justify-content:center;transform:rotate(12deg);opacity:0.2;">
        <p style="font-size:6px;font-weight:800;color:${hc};text-align:center;">${shopName.substring(0, 10)}</p>
      </div>
      <p style="font-weight:700;font-size:12px;margin-top:8px;">ผู้รับเงิน / Authorized</p>
      <p style="font-size:9px;color:#5b403d;margin-top:2px;">วันที่ ......../......../........</p>
    </div>
  </div>
  ${s.footer_text ? `<div style="text-align:center;margin-top:8px;font-size:9px;color:#94a3b8;">${s.footer_text}</div>` : ''}
</div>

</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1500);}<\/script>
</body></html>`);
  w.document.close();
};
console.log('[v11-4] ✅ A4 receipt: signature at bottom, QR, 1 page');


// ══════════════════════════════════════
// V11-5: Quotation print — reuse v11 design
// ══════════════════════════════════════

const _v11OrigPrintQuot = window.printQuotation;
window.printQuotation = async function (quotId) {
  try {
    const { data: quot } = await db.from('ใบเสนอราคา').select('*').eq('id', quotId).single();
    const { data: items } = await db.from('รายการใบเสนอราคา').select('*').eq('quotation_id', quotId);
    const rc = typeof getShopConfig === 'function' ? await getShopConfig() :
      (typeof v10GetShopConfig === 'function' ? await v10GetShopConfig() : {});
    if (!quot) { typeof toast === 'function' && toast('ไม่พบข้อมูล', 'error'); return; }

    // Map quotation to bill-like object
    const bill = {
      bill_code: `QT-${String(quot.id).slice(-6).toUpperCase()}`,
      date: quot.date,
      customer_name: quot.customer_name,
      customer_id: quot.customer_id,
      staff_name: quot.staff_name,
      method: '',
      total: quot.total,
      discount: quot.discount || 0
    };

    await window.printReceiptA4v2(bill, items, rc, 'quotation');
  } catch (e) {
    console.error('[v11] quotation print error:', e);
    typeof toast === 'function' && toast('พิมพ์ไม่สำเร็จ', 'error');
  }
};

// Also override v9PrintQuotation
window.v9PrintQuotation = window.printQuotation;
console.log('[v11-5] ✅ Quotation uses same A4 engine');


// ══════════════════════════════════════
// V11-6: FIX TOGGLE SWITCHES + LIVE PREVIEW
// ══════════════════════════════════════

window.v10BuildToggles = function (s) {
  const container = document.getElementById('v10-toggles');
  if (!container) return;
  const fields = {
    receipt_80mm: [['show_shop_name', 'ชื่อร้าน'], ['show_address', 'ที่อยู่ร้าน'], ['show_tax_id', 'เลขผู้เสียภาษี'], ['show_bill_code', 'เลขที่บิล'], ['show_customer', 'ชื่อลูกค้า'], ['show_staff', 'ชื่อพนักงาน'], ['show_datetime', 'วันที่/เวลา'], ['show_method', 'วิธีชำระเงิน'], ['show_discount', 'ส่วนลด'], ['show_received', 'เงินรับ/ทอน'], ['show_change', 'เงินทอน'], ['show_cost', 'ต้นทุนสินค้า'], ['show_profit', 'กำไรขั้นต้น'], ['show_qr', 'QR PromptPay']],
    receipt_a4: [['show_shop_name', 'ชื่อร้าน'], ['show_address', 'ที่อยู่ร้าน'], ['show_tax_id', 'เลขผู้เสียภาษี'], ['show_bill_code', 'เลขที่บิล'], ['show_customer', 'ชื่อลูกค้า'], ['show_staff', 'ชื่อพนักงาน'], ['show_datetime', 'วันที่/เวลา'], ['show_method', 'วิธีชำระเงิน'], ['show_discount', 'ส่วนลด'], ['show_received', 'เงินรับ/ทอน'], ['show_change', 'เงินทอน'], ['show_qr', 'QR PromptPay']],
    quotation: [['show_shop_name', 'ชื่อร้าน'], ['show_address', 'ที่อยู่ร้าน'], ['show_tax_id', 'เลขผู้เสียภาษี'], ['show_customer', 'ลูกค้า'], ['show_staff', 'ผู้ออกเอกสาร'], ['show_discount', 'ส่วนลด'], ['show_validity', 'วันหมดอายุ'], ['show_note', 'หมายเหตุ'], ['show_signature', 'ลายเซ็น'], ['show_qr', 'QR PromptPay']],
    payment_receipt: [['show_shop_name', 'ชื่อร้าน'], ['show_address', 'ที่อยู่ร้าน'], ['show_tax_id', 'เลขผู้เสียภาษี'], ['show_customer', 'ชื่อลูกค้า'], ['show_staff', 'ชื่อพนักงาน'], ['show_datetime', 'วันที่/เวลา'], ['show_method', 'วิธีชำระ']]
  };
  const list = fields[_v10ActiveDocTab] || [];
  container.innerHTML = list.map(([key, label]) => {
    const on = s[key] !== false;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:0.5px solid var(--border-light);">
      <span style="font-size:13px;">${label}</span>
      <label class="v11-toggle">
        <input type="checkbox" data-key="${key}" ${on ? 'checked' : ''}
          onchange="v10ToggleField('${key}',this.checked)">
        <span class="v11-slider"></span>
      </label>
    </div>`;
  }).join('');
};

// Override preview to match actual template
window.v10PreviewA4 = function (s, hText, fText, hc) {
  return `<div style="background:#fff;border-radius:6px;font-size:7px;color:#1e293b;overflow:hidden;transform:scale(0.82);transform-origin:top center;">
    <div style="display:flex;justify-content:space-between;padding:10px 12px;">
      <div>
        ${s.show_shop_name !== false ? `<div style="font-weight:800;font-size:10px;color:${hc};">หจก. เอส เค วัสดุ</div>` : ''}
        ${s.show_address !== false ? '<div style="font-size:6px;color:#5b403d;">ที่อยู่ร้านค้า</div>' : ''}
        ${s.show_tax_id !== false ? '<div style="font-size:6px;color:#5b403d;">Tax: 0-4635-5801-0486</div>' : ''}
      </div>
      <div style="text-align:right;">
        <div style="background:${hc};padding:4px 10px;border-radius:4px;color:#fff;font-weight:800;font-size:8px;">${hText || 'ใบเสร็จรับเงิน'}<br><span style="font-size:5px;opacity:.65;">RECEIPT</span></div>
        ${s.show_bill_code !== false ? '<div style="font-size:6px;margin-top:2px;">เลขที่: <b>#1042</b></div>' : ''}
      </div>
    </div>
    <div style="padding:0 12px;">
      ${s.show_customer !== false ? '<div style="background:#f2f4f5;padding:4px 6px;border-radius:4px;margin-bottom:6px;"><div style="font-weight:700;font-size:7px;">Pioneer Construction</div><div style="font-size:5px;color:#5b403d;">456 ถ.สุขุมวิท กรุงเทพฯ</div></div>' : ''}
      <table style="width:100%;border-collapse:collapse;font-size:6px;margin-bottom:6px;">
        <thead><tr style="background:#e6e8e9;"><th style="padding:2px 4px;text-align:center;width:12px;">#</th><th style="padding:2px 4px;text-align:left;">สินค้า</th><th style="padding:2px 4px;text-align:right;width:28px;">จำนวน</th><th style="padding:2px 4px;text-align:right;width:34px;">ราคา</th><th style="padding:2px 4px;text-align:right;width:36px;">รวม</th></tr></thead>
        <tbody>
          <tr><td style="padding:2px 4px;text-align:center;">1</td><td style="padding:2px 4px;">ปูนซีเมนต์ (50kg)</td><td style="padding:2px 4px;text-align:right;">100</td><td style="padding:2px 4px;text-align:right;">185</td><td style="padding:2px 4px;text-align:right;font-weight:700;">18,500</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:2px 4px;text-align:center;">2</td><td style="padding:2px 4px;">เหล็กเส้น SD40 12mm</td><td style="padding:2px 4px;text-align:right;">50</td><td style="padding:2px 4px;text-align:right;">312</td><td style="padding:2px 4px;text-align:right;font-weight:700;">15,600</td></tr>
          <tr><td style="padding:2px 4px;text-align:center;">3</td><td style="padding:2px 4px;">ท่อ PVC 4 นิ้ว</td><td style="padding:2px 4px;text-align:right;">10</td><td style="padding:2px 4px;text-align:right;">450</td><td style="padding:2px 4px;text-align:right;font-weight:700;">4,500</td></tr>
        </tbody>
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div style="background:#f2f4f5;padding:3px 6px;border-radius:3px;"><span style="font-size:4px;text-transform:uppercase;font-weight:700;color:#5b403d;">จำนวนเงินตัวอักษร</span><p style="font-size:5px;font-weight:700;color:${hc};">สามหมื่นแปดพันหกร้อยบาทถ้วน</p></div>
        <div style="display:flex;gap:3px;justify-content:flex-end;">
          ${s.show_qr !== false ? '<div style="border:1px solid #ddd;padding:2px;border-radius:3px;width:36px;text-align:center;"><div style="background:#003b71;border-radius:2px;"><span style="color:#fff;font-size:3px;font-weight:700;">PromptPay</span></div><div style="width:28px;height:28px;background:#f1f5f9;margin:2px auto;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:4px;color:#003b71;">QR</div></div>' : ''}
          <div style="width:90px;">
            <div style="display:flex;justify-content:space-between;font-size:5px;padding:1px 4px;"><span>รวม</span><span>38,600</span></div>
            <div style="background:${hc};padding:4px 5px;border-radius:4px;color:#fff;margin-top:2px;display:flex;justify-content:space-between;align-items:center;">
              <div><span style="font-weight:800;font-size:4px;">จำนวนเงิน<br>รวมทั้งสิ้น</span></div>
              <span style="font-size:9px;font-weight:800;">41,302</span>
            </div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;padding-top:6px;border-top:1px solid #eee;">
        <div style="text-align:center;"><div style="border-bottom:1px dotted #999;height:10px;width:50px;margin:0 auto;"></div><p style="font-size:4px;margin-top:2px;">ผู้รับของ</p></div>
        <div style="text-align:center;"><div style="border-bottom:1px dotted #999;height:10px;width:50px;margin:0 auto;"></div><p style="font-size:4px;margin-top:2px;">ผู้รับเงิน</p></div>
      </div>
    </div>
    ${fText ? `<div style="text-align:center;padding:3px;font-size:4px;color:#94a3b8;">${fText}</div>` : ''}
  </div>`;
};

window.v10PreviewQuotation = function (s, hText, fText, hc) {
  return window.v10PreviewA4(s, hText || 'ใบเสนอราคา', fText, hc)
    .replace('RECEIPT', 'QUOTATION')
    .replace('ผู้รับของ', 'ลายเซ็นลูกค้า')
    .replace('ผู้รับเงิน', 'ผู้เสนอราคา');
};

console.log('[v11-6] ✅ Toggle + Preview');


// ══════════════════════════════════════
// V11-7: Return cost injection
// ══════════════════════════════════════

const _v11OrigConfRet = window.v10ConfirmReturn;
window.v10ConfirmReturn = async function () {
  const items = window._v10ReturnItems || [];
  const bill = window._v10ReturnBill;
  if (bill && items.length > 0) {
    try {
      const { data: bi } = await db.from('รายการในบิล').select('name,cost,product_id').eq('bill_id', bill.id);
      const cm = {};
      (bi || []).forEach(b => { if (b.product_id) cm[b.product_id] = parseFloat(b.cost || 0); if (b.name) cm[b.name] = parseFloat(b.cost || 0); });
      items.forEach(it => { it.cost = cm[it.product_id] || cm[it.name] || 0; });
    } catch (e) { console.warn('[v11-7]', e); }
  }
  if (_v11OrigConfRet) return _v11OrigConfRet.apply(this, arguments);
};
console.log('[v11-7] ✅ Return cost injection');


// ══════════════════════════════════════
// BOOT
// ══════════════════════════════════════

console.info(
  '%c[modules-v11.js] ✅%c V11-1:CSS | V11-2:DashCOGS | V11-3:HomeProfit | V11-4:A4Receipt | V11-5:Quotation | V11-6:Toggle | V11-7:ReturnCost',
  'color:#0EA5E9;font-weight:700', 'color:#6B7280'
);
// ══════════════════════════════════════════════════════════════════
// PATCH FIX: A4 Receipt - ดึงข้อมูลลูกค้า 100% + ฝัง QR Code กันหาย
// ══════════════════════════════════════════════════════════════════

window.printReceiptA4 = async function (billId) {
  if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังเตรียมพิมพ์...');
  try {
    const [{ data: bill }, { data: items }, rc] = await Promise.all([
      db.from('บิลขาย').select('*').eq('id', billId).maybeSingle(),
      db.from('รายการในบิล').select('*').eq('bill_id', billId),
      typeof v10GetShopConfig === 'function' ? v10GetShopConfig() : getShopConfig()
    ]);
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    if (!bill) { typeof toast === 'function' && toast('ไม่พบบิล', 'error'); return; }
    await window.printReceiptA4v2(bill, items, rc, 'receipt');
  } catch (e) {
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    console.error(e);
  }
};

window.printReceiptA4v2 = async function (bill, items, rc, docType = 'receipt') {
  // 1. 🟢 ดึงข้อมูลลูกค้าแบบจัดเต็ม (ชื่อ, ที่อยู่, Tax ID)
  if (bill.customer_id) {
    try {
      const { data: cust } = await db.from('customer').select('name,address,tax_id').eq('id', bill.customer_id).maybeSingle();
      if (cust) {
        bill.customer_name = cust.name || bill.customer_name;
        bill.customer_address = cust.address || '';
        bill.customer_tax_id = cust.tax_id || '';
      }
    } catch (_) { }
  } else if (bill.customer_name && bill.customer_name !== 'ทั่วไป') {
    // กรณีมีแค่ชื่อ ก็ไปค้นหาจากชื่อ
    try {
      const { data: cust } = await db.from('customer').select('name,address,tax_id').eq('name', bill.customer_name).maybeSingle();
      if (cust) {
        bill.customer_address = cust.address || '';
        bill.customer_tax_id = cust.tax_id || '';
      }
    } catch (_) { }
  }

  const ds = typeof v10GetDocSettings === 'function' ? await v10GetDocSettings() : {};
  const s = ds.receipt_a4 || (typeof V10_DEFAULTS !== 'undefined' ? V10_DEFAULTS.receipt_a4 : {});
  const hc = s.bw_mode ? '#333333' : (s.header_color || '#af101a');
  const shopName = rc?.shop_name || 'SK POS';
  const shopNameEn = rc?.shop_name_en || '';
  const shopAddr = rc?.address || '';
  const shopPhone = rc?.phone || '';
  const shopTax = rc?.tax_id || '';

  const subtotal = (items || []).reduce((sum, i) => sum + (i.total || 0), 0);
  const discount = bill.discount || 0;
  const afterDiscount = subtotal - discount;
  const vatRate = rc?.vat_rate || 0;
  const vatAmount = vatRate > 0 ? Math.round(afterDiscount * vatRate / 100) : 0;
  const grandTotal = bill.total || (afterDiscount + vatAmount);
  const dateObj = bill.date ? new Date(bill.date) : new Date();
  const dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

  const isDelivery = docType === 'delivery';
  const docLabel = isDelivery ? 'ใบส่งของ' : (s.header_text || 'ใบเสร็จรับเงิน / ใบกำกับภาษี');
  const docLabelEn = isDelivery ? 'DELIVERY NOTE' : 'RECEIPT / TAX INVOICE';
  const noteText = s.note_text || 'สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน';

  // 2. 🟢 สร้าง QR Code แบบฝังเป็นรูปภาพ Base64 (ป้องกันรูปไม่โหลดตอนสั่งพรินต์)
  let qrHtml = '';
  if (s.show_qr !== false) {
    let qrDataUrl = '';
    if (typeof getLocalPromptPayQRBase64 === 'function') {
      qrDataUrl = await getLocalPromptPayQRBase64(grandTotal);
    } else {
      const ppNumber = rc?.promptpay_number || rc?.phone || '';
      if (ppNumber) qrDataUrl = `https://promptpay.io/${ppNumber}/${grandTotal}.png`;
    }

    if (qrDataUrl) {
      qrHtml = `
      <div style="border:1px solid #e4beba30;padding:8px;border-radius:10px;width:110px;text-align:center;">
        <div style="background:#003b71;padding:3px 0;border-radius:4px;margin-bottom:4px;"><span style="color:#fff;font-size:9px;font-weight:700;">PromptPay</span></div>
        <img src="${qrDataUrl}" style="width:88px;height:88px;" onerror="this.style.display='none'">
        <p style="font-size:8px;color:#003b71;font-weight:700;margin-top:3px;">สแกนเพื่อชำระเงิน</p>
      </div>`;
    }
  }

  const itemCount = (items || []).length;
  const rowPad = itemCount > 12 ? '6px 12px' : '10px 14px';
  const rowFont = itemCount > 12 ? '11px' : '13px';

  const rows = (items || []).map((it, idx) => `
    <tr style="${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
      <td style="padding:${rowPad};text-align:center;color:#94a3b8;font-size:${rowFont};">${idx + 1}</td>
      <td style="padding:${rowPad};"><div style="font-weight:600;font-size:${rowFont};color:#1e293b;">${it.name}</div></td>
      <td style="padding:${rowPad};text-align:right;font-size:${rowFont};">${formatNum(it.qty)}</td>
      <td style="padding:${rowPad};text-align:center;font-size:${rowFont};color:#64748b;">${it.unit || 'ชิ้น'}</td>
      <td style="padding:${rowPad};text-align:right;font-size:${rowFont};">${formatNum(it.price)}</td>
      <td style="padding:${rowPad};text-align:right;font-weight:700;font-size:${rowFont};">${formatNum(it.total)}</td>
    </tr>`).join('');

  const w = window.open('', '_blank', 'width=900,height=900');
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>${isDelivery ? 'ใบส่งของ' : 'ใบเสร็จ'} #${bill.bill_code}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
  .headline { font-family: 'Manrope', 'Sarabun', sans-serif; }
  .page { min-height: 277mm; max-height: 277mm; position: relative; padding: 20px 24px; overflow: hidden; display: flex; flex-direction: column; }
  .content { flex: 1; }
  .sig-section { margin-top: auto; padding-top: 20px; }
  @media print { body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div class="page">
<div class="content">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;">
    <div style="max-width:55%;">
      ${s.show_shop_name !== false ? `<h2 class="headline" style="font-size:20px;font-weight:800;color:${hc};margin-bottom:1px;">${shopName}</h2>` : ''}
      <div style="font-size:11px;color:#5b403d;line-height:1.7;">
        ${s.show_address !== false && shopAddr ? `<p>${shopAddr}</p>` : ''}
        ${shopPhone ? `<p>โทร ${shopPhone}</p>` : ''}
        ${s.show_tax_id !== false && shopTax ? `<p><b>Tax ID:</b> <span style="font-family:monospace;">${shopTax}</span></p>` : ''}
      </div>
    </div>
    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
      <div style="background:${hc};padding:8px 18px;border-radius:6px;">
        <h1 class="headline" style="color:#fff;font-size:15px;font-weight:800;">${docLabel}</h1>
        <p style="color:rgba(255,255,255,0.65);font-size:9px;">${docLabelEn}</p>
      </div>
      <div style="font-size:12px;margin-top:2px;">
        ${s.show_bill_code !== false ? `<p>เลขที่: <b>${bill.bill_code}</b></p>` : ''}
        ${s.show_datetime !== false ? `<p>วันที่: <b>${dateStr}</b></p>` : ''}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;padding:12px 0;border-top:1px solid ${hc}15;border-bottom:1px solid ${hc}15;">
    ${s.show_customer !== false ? `
    <div>
      <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#5b403d;font-weight:700;">ลูกค้า / Customer</span>
      <div style="background:#f2f4f5;padding:10px 12px;border-radius:8px;margin-top:4px;">
        <p style="font-weight:700;font-size:14px;">${bill.customer_name || 'ลูกค้าทั่วไป'}</p>
        ${bill.customer_address ? `<p style="font-size:11px;color:#5b403d;margin-top:2px;">${bill.customer_address}</p>` : ''}
        ${bill.customer_tax_id ? `<p style="font-size:11px;color:#5b403d;">Tax ID: ${bill.customer_tax_id}</p>` : ''}
      </div>
    </div>` : '<div></div>'}
    <div style="display:flex;flex-direction:column;justify-content:flex-end;gap:6px;font-size:12px;">
      ${s.show_staff !== false ? `<div style="display:flex;justify-content:space-between;border-bottom:1px solid ${hc}10;padding-bottom:6px;"><span style="color:#5b403d;">พนักงาน</span><span>${bill.staff_name || '-'}</span></div>` : ''}
      ${s.show_method !== false ? `<div style="display:flex;justify-content:space-between;border-bottom:1px solid ${hc}10;padding-bottom:6px;"><span style="color:#5b403d;">ชำระเงิน</span><span>${bill.method || '-'}</span></div>` : ''}
    </div>
  </div>

  <div style="margin-bottom:14px;overflow:hidden;border-radius:8px;border:1px solid ${hc}15;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#e6e8e9;">
          <th class="headline" style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;width:32px;">#</th>
          <th class="headline" style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;">รายละเอียดสินค้า</th>
          <th class="headline" style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;width:60px;">จำนวน</th>
          <th class="headline" style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;width:50px;">หน่วย</th>
          <th class="headline" style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;width:80px;">ราคา/หน่วย</th>
          <th class="headline" style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;width:90px;">จำนวนเงิน</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">
    <div>
      <div style="background:#f2f4f5;padding:10px 12px;border-radius:8px;margin-bottom:8px;">
        <span style="font-size:9px;text-transform:uppercase;font-weight:700;color:#5b403d;">จำนวนเงินตัวอักษร</span>
        <p style="font-size:12px;font-weight:700;color:${hc};margin-top:2px;">${typeof v10NumToThaiText === 'function' ? v10NumToThaiText(grandTotal) : ''}</p>
      </div>
      ${noteText ? `<div><p style="font-size:10px;font-weight:700;color:#ba1a1a;margin-bottom:2px;">ⓘ หมายเหตุ</p><p style="font-size:10px;color:#5b403d;font-style:italic;">${noteText}</p></div>` : ''}
    </div>
    
    <div style="display:flex;gap:12px;align-items:flex-end;justify-content:flex-end;">
      ${qrHtml}
      
      <div style="width:220px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 10px;"><span style="color:#5b403d;">รวมเงิน</span><span>${formatNum(subtotal)}</span></div>
        ${discount > 0 && s.show_discount !== false ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 10px;color:#ba1a1a;"><span>ส่วนลด</span><span>-${formatNum(discount)}</span></div>` : ''}
        ${vatRate > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 10px;"><span style="color:#5b403d;">VAT ${vatRate}%</span><span>${formatNum(vatAmount)}</span></div>` : ''}
        <div style="background:${hc};padding:12px 14px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;color:#fff;margin-top:4px;">
          <div>
            <span class="headline" style="font-weight:800;font-size:11px;">จำนวนเงิน<br>รวมทั้งสิ้น</span>
          </div>
          <span class="headline" style="font-size:20px;font-weight:800;">${formatNum(grandTotal)}</span>
        </div>
        ${s.show_received !== false && bill.received ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;padding:3px 10px;margin-top:4px;"><span>รับเงิน</span><span>฿${formatNum(bill.received)}</span></div>` : ''}
        ${s.show_change !== false && bill.change ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;padding:3px 10px;"><span>ทอน</span><span>฿${formatNum(bill.change)}</span></div>` : ''}
      </div>
    </div>
  </div>
</div>

<div class="sig-section">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;">
    <div style="text-align:center;">
      <div style="border-bottom:1px dotted #5b403d;height:28px;width:160px;margin:0 auto;"></div>
      <p style="font-weight:700;font-size:12px;margin-top:8px;">ผู้รับของ / Received By</p>
      <p style="font-size:9px;color:#5b403d;margin-top:2px;">วันที่ ......../......../........</p>
    </div>
    <div style="text-align:center;position:relative;">
      <div style="border-bottom:1px dotted #5b403d;height:28px;width:160px;margin:0 auto;"></div>
      <div style="position:absolute;top:-36px;right:8px;width:56px;height:56px;border:3px solid ${hc}33;border-radius:50%;display:flex;align-items:center;justify-content:center;transform:rotate(12deg);opacity:0.2;">
        <p style="font-size:6px;font-weight:800;color:${hc};text-align:center;">${shopName.substring(0, 10)}</p>
      </div>
      <p style="font-weight:700;font-size:12px;margin-top:8px;">ผู้รับเงิน / Authorized</p>
      <p style="font-size:9px;color:#5b403d;margin-top:2px;">วันที่ ......../......../........</p>
    </div>
  </div>
  ${s.footer_text ? `<div style="text-align:center;margin-top:8px;font-size:9px;color:#94a3b8;">${s.footer_text}</div>` : ''}
</div>

</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1500);}<\/script>
</body></html>`);
  w.document.close();
};
// ══════════════════════════════════════════════════════════════════
// PATCH: อัปเกรดการดึงข้อมูลลูกค้าในบิล A4 (กันที่อยู่หาย)
// ══════════════════════════════════════════════════════════════════

window.printReceiptA4v2 = async function (bill, items, rc, docType = 'receipt') {
  // 1. 🟢 ระบบค้นหาข้อมูลลูกค้าแบบทรงพลัง (หาด้วย ID ก่อน ถ้าไม่เจอหาด้วยชื่อ)
  let custData = null;
  if (bill.customer_id) {
    try {
      const { data } = await db.from('customer').select('*').eq('id', bill.customer_id).maybeSingle();
      custData = data;
    } catch (e) { }
  }
  if (!custData && bill.customer_name && bill.customer_name !== 'ทั่วไป') {
    try {
      const { data } = await db.from('customer').select('*').eq('name', bill.customer_name).maybeSingle();
      custData = data;
    } catch (e) { }
  }

  // อัปเดตข้อมูลลูกค้าลงในบิลเตรียมพิมพ์
  if (custData) {
    bill.customer_name = custData.name || bill.customer_name;
    bill.customer_address = custData.address || '';
    bill.customer_tax_id = custData.tax_id || '';
    bill.customer_phone = custData.phone || '';
  }

  const ds = typeof v10GetDocSettings === 'function' ? await v10GetDocSettings() : {};
  const s = ds.receipt_a4 || (typeof V10_DEFAULTS !== 'undefined' ? V10_DEFAULTS.receipt_a4 : {});
  const hc = s.bw_mode ? '#333333' : (s.header_color || '#af101a');
  const shopName = rc?.shop_name || 'SK POS';
  const shopNameEn = rc?.shop_name_en || '';
  const shopAddr = rc?.address || '';
  const shopPhone = rc?.phone || '';
  const shopTax = rc?.tax_id || '';

  const subtotal = (items || []).reduce((sum, i) => sum + (i.total || 0), 0);
  const discount = bill.discount || 0;
  const afterDiscount = subtotal - discount;
  const vatRate = rc?.vat_rate || 0;
  const vatAmount = vatRate > 0 ? Math.round(afterDiscount * vatRate / 100) : 0;
  const grandTotal = bill.total || (afterDiscount + vatAmount);
  const dateObj = bill.date ? new Date(bill.date) : new Date();
  const dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

  const isDelivery = docType === 'delivery';
  const docLabel = isDelivery ? 'ใบส่งของ' : (s.header_text || 'ใบเสร็จรับเงิน / ใบกำกับภาษี');
  const docLabelEn = isDelivery ? 'DELIVERY NOTE' : 'RECEIPT / TAX INVOICE';
  const noteText = s.note_text || 'สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน';

  // 2. 🟢 สร้าง QR Code แบบฝัง
  let qrHtml = '';
  if (s.show_qr !== false) {
    let qrDataUrl = '';
    if (typeof getLocalPromptPayQRBase64 === 'function') {
      qrDataUrl = await getLocalPromptPayQRBase64(grandTotal);
    } else {
      const ppNumber = rc?.promptpay_number || rc?.phone || '';
      if (ppNumber) qrDataUrl = `https://promptpay.io/${ppNumber}/${grandTotal}.png`;
    }

    if (qrDataUrl) {
      qrHtml = `
      <div style="border:1px solid #e4beba30;padding:8px;border-radius:10px;width:110px;text-align:center;">
        <div style="background:#003b71;padding:3px 0;border-radius:4px;margin-bottom:4px;"><span style="color:#fff;font-size:9px;font-weight:700;">PromptPay</span></div>
        <img src="${qrDataUrl}" style="width:88px;height:88px;" onerror="this.style.display='none'">
        <p style="font-size:8px;color:#003b71;font-weight:700;margin-top:3px;">สแกนเพื่อชำระเงิน</p>
      </div>`;
    }
  }

  const itemCount = (items || []).length;
  const rowPad = itemCount > 12 ? '6px 12px' : '10px 14px';
  const rowFont = itemCount > 12 ? '11px' : '13px';

  const rows = (items || []).map((it, idx) => `
    <tr style="${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
      <td style="padding:${rowPad};text-align:center;color:#94a3b8;font-size:${rowFont};">${idx + 1}</td>
      <td style="padding:${rowPad};"><div style="font-weight:600;font-size:${rowFont};color:#1e293b;">${it.name}</div></td>
      <td style="padding:${rowPad};text-align:right;font-size:${rowFont};">${formatNum(it.qty)}</td>
      <td style="padding:${rowPad};text-align:center;font-size:${rowFont};color:#64748b;">${it.unit || 'ชิ้น'}</td>
      <td style="padding:${rowPad};text-align:right;font-size:${rowFont};">${formatNum(it.price)}</td>
      <td style="padding:${rowPad};text-align:right;font-weight:700;font-size:${rowFont};">${formatNum(it.total)}</td>
    </tr>`).join('');

  const w = window.open('', '_blank', 'width=900,height=900');
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>${isDelivery ? 'ใบส่งของ' : 'ใบเสร็จ'} #${bill.bill_code}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
  .headline { font-family: 'Manrope', 'Sarabun', sans-serif; }
  .page { min-height: 277mm; max-height: 277mm; position: relative; padding: 20px 24px; overflow: hidden; display: flex; flex-direction: column; }
  .content { flex: 1; }
  .sig-section { margin-top: auto; padding-top: 20px; }
  @media print { body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div class="page">
<div class="content">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;">
    <div style="max-width:55%;">
      ${s.show_shop_name !== false ? `<h2 class="headline" style="font-size:20px;font-weight:800;color:${hc};margin-bottom:1px;">${shopName}</h2>` : ''}
      <div style="font-size:11px;color:#5b403d;line-height:1.7;">
        ${s.show_address !== false && shopAddr ? `<p>${shopAddr}</p>` : ''}
        ${shopPhone ? `<p>โทร ${shopPhone}</p>` : ''}
        ${s.show_tax_id !== false && shopTax ? `<p><b>Tax ID:</b> <span style="font-family:monospace;">${shopTax}</span></p>` : ''}
      </div>
    </div>
    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
      <div style="background:${hc};padding:8px 18px;border-radius:6px;">
        <h1 class="headline" style="color:#fff;font-size:15px;font-weight:800;">${docLabel}</h1>
        <p style="color:rgba(255,255,255,0.65);font-size:9px;">${docLabelEn}</p>
      </div>
      <div style="font-size:12px;margin-top:2px;">
        ${s.show_bill_no !== false ? `<p>เลขที่: <b>${bill.bill_code}</b></p>` : ''}
        ${s.show_datetime !== false ? `<p>วันที่: <b>${dateStr}</b></p>` : ''}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;padding:12px 0;border-top:1px solid ${hc}15;border-bottom:1px solid ${hc}15;">
    ${s.show_customer !== false ? `
    <div>
      <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#5b403d;font-weight:700;">ลูกค้า / Customer</span>
      <div style="background:#f2f4f5;padding:10px 12px;border-radius:8px;margin-top:4px;">
        <p style="font-weight:700;font-size:14px;">${bill.customer_name || 'ลูกค้าทั่วไป'}</p>
        ${bill.customer_address ? `<p style="font-size:11px;color:#5b403d;margin-top:4px;"><b>ที่อยู่:</b> ${bill.customer_address}</p>` : `<p style="font-size:10px;color:#94a3b8;margin-top:4px;font-style:italic;">(ไม่มีข้อมูลที่อยู่ในระบบ)</p>`}
        ${bill.customer_phone ? `<p style="font-size:11px;color:#5b403d;"><b>โทร:</b> ${bill.customer_phone}</p>` : ''}
        ${bill.customer_tax_id ? `<p style="font-size:11px;color:#5b403d;"><b>Tax ID:</b> ${bill.customer_tax_id}</p>` : ''}
      </div>
    </div>` : '<div></div>'}
    <div style="display:flex;flex-direction:column;justify-content:flex-end;gap:6px;font-size:12px;">
      ${s.show_staff !== false ? `<div style="display:flex;justify-content:space-between;border-bottom:1px solid ${hc}10;padding-bottom:6px;"><span style="color:#5b403d;">พนักงาน</span><span>${bill.staff_name || '-'}</span></div>` : ''}
      ${s.show_method !== false ? `<div style="display:flex;justify-content:space-between;border-bottom:1px solid ${hc}10;padding-bottom:6px;"><span style="color:#5b403d;">ชำระเงิน</span><span>${bill.method || '-'}</span></div>` : ''}
    </div>
  </div>

  <div style="margin-bottom:14px;overflow:hidden;border-radius:8px;border:1px solid ${hc}15;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#e6e8e9;">
          <th class="headline" style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;width:32px;">#</th>
          <th class="headline" style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;">รายละเอียดสินค้า</th>
          <th class="headline" style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;width:60px;">จำนวน</th>
          <th class="headline" style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;width:50px;">หน่วย</th>
          <th class="headline" style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;width:80px;">ราคา/หน่วย</th>
          <th class="headline" style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;width:90px;">จำนวนเงิน</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">
    <div>
      <div style="background:#f2f4f5;padding:10px 12px;border-radius:8px;margin-bottom:8px;">
        <span style="font-size:9px;text-transform:uppercase;font-weight:700;color:#5b403d;">จำนวนเงินตัวอักษร</span>
        <p style="font-size:12px;font-weight:700;color:${hc};margin-top:2px;">${typeof v10NumToThaiText === 'function' ? v10NumToThaiText(grandTotal) : ''}</p>
      </div>
      ${noteText ? `<div><p style="font-size:10px;font-weight:700;color:#ba1a1a;margin-bottom:2px;">ⓘ หมายเหตุ</p><p style="font-size:10px;color:#5b403d;font-style:italic;">${noteText}</p></div>` : ''}
    </div>
    
    <div style="display:flex;gap:12px;align-items:flex-end;justify-content:flex-end;">
      ${qrHtml}
      
      <div style="width:220px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 10px;"><span style="color:#5b403d;">รวมเงิน</span><span>${formatNum(subtotal)}</span></div>
        ${discount > 0 && s.show_discount !== false ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 10px;color:#ba1a1a;"><span>ส่วนลด</span><span>-${formatNum(discount)}</span></div>` : ''}
        ${vatRate > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 10px;"><span style="color:#5b403d;">VAT ${vatRate}%</span><span>${formatNum(vatAmount)}</span></div>` : ''}
        <div style="background:${hc};padding:12px 14px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;color:#fff;margin-top:4px;">
          <div>
            <span class="headline" style="font-weight:800;font-size:11px;">จำนวนเงิน<br>รวมทั้งสิ้น</span>
          </div>
          <span class="headline" style="font-size:20px;font-weight:800;">${formatNum(grandTotal)}</span>
        </div>
        ${s.show_received !== false && bill.received ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;padding:3px 10px;margin-top:4px;"><span>รับเงิน</span><span>฿${formatNum(bill.received)}</span></div>` : ''}
        ${s.show_change !== false && bill.change ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;padding:3px 10px;"><span>ทอน</span><span>฿${formatNum(bill.change)}</span></div>` : ''}
      </div>
    </div>
  </div>
</div>

<div class="sig-section">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;">
    <div style="text-align:center;">
      <div style="border-bottom:1px dotted #5b403d;height:28px;width:160px;margin:0 auto;"></div>
      <p style="font-weight:700;font-size:12px;margin-top:8px;">ผู้รับของ / Received By</p>
      <p style="font-size:9px;color:#5b403d;margin-top:2px;">วันที่ ......../......../........</p>
    </div>
    <div style="text-align:center;position:relative;">
      <div style="border-bottom:1px dotted #5b403d;height:28px;width:160px;margin:0 auto;"></div>
      <div style="position:absolute;top:-36px;right:8px;width:56px;height:56px;border:3px solid ${hc}33;border-radius:50%;display:flex;align-items:center;justify-content:center;transform:rotate(12deg);opacity:0.2;">
        <p style="font-size:6px;font-weight:800;color:${hc};text-align:center;">${shopName.substring(0, 10)}</p>
      </div>
      <p style="font-weight:700;font-size:12px;margin-top:8px;">ผู้รับเงิน / Authorized</p>
      <p style="font-size:9px;color:#5b403d;margin-top:2px;">วันที่ ......../......../........</p>
    </div>
  </div>
  ${s.footer_text ? `<div style="text-align:center;margin-top:8px;font-size:9px;color:#94a3b8;">${s.footer_text}</div>` : ''}
</div>

</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1500);}<\/script>
</body></html>`);
  w.document.close();
};