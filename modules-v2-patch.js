/**
 * SK POS v2.1 — modules-v2-patch.js
 * โหลดหลัง modules-v2.js
 * แก้ไข: format picker, receipt flow, denom wizard CSS polyfill
 */
'use strict';

// ══════════════════════════════════════════════════════════════════
// 1. FIX printReceipt — format picker ที่ทำงานได้จริง
// ══════════════════════════════════════════════════════════════════

window.printReceipt = async function(bill, items, format) {
  const rc = await getShopConfig();
  if (!format || format === 'ask') {
    format = await showReceiptFormatPicker();
    if (!format) return;
  }
  if (format === 'A4') printReceiptA4v2(bill, items, rc);
  else print80mmv2(bill, items, rc);
};

function showReceiptFormatPicker() {
  return new Promise(resolve => {
    // ลบ picker เดิมถ้ามี
    document.getElementById('receipt-format-picker')?.remove();
    const el = document.createElement('div');
    el.id = 'receipt-format-picker';
    el.style.cssText = `
      position:fixed;inset:0;z-index:10000;
      background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;`;
    el.innerHTML = `
      <div style="background:var(--bg-surface);border-radius:20px;padding:24px;width:320px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.4);">
        <div style="font-size:15px;font-weight:700;margin-bottom:6px;">เลือกรูปแบบใบเสร็จ</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;">เลือกแบบที่ต้องการพิมพ์</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <button id="rfp-80mm" style="
            border:2px solid var(--border-light);border-radius:14px;background:var(--bg-base);
            padding:16px 8px;cursor:pointer;transition:all .15s;font-family:var(--font-thai);">
            <div style="font-size:28px;margin-bottom:6px;">🧾</div>
            <div style="font-size:14px;font-weight:700;color:var(--primary);">80 mm</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">เครื่องพิมพ์ใบเสร็จ</div>
          </button>
          <button id="rfp-a4" style="
            border:2px solid var(--border-light);border-radius:14px;background:var(--bg-base);
            padding:16px 8px;cursor:pointer;transition:all .15s;font-family:var(--font-thai);">
            <div style="font-size:28px;margin-bottom:6px;">📄</div>
            <div style="font-size:14px;font-weight:700;color:#2563EB;">A4</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">ใบเสร็จเต็ม</div>
          </button>
        </div>
        <button id="rfp-cancel" style="
          width:100%;padding:10px;border:1.5px solid var(--border-default);border-radius:10px;
          background:none;cursor:pointer;font-family:var(--font-thai);font-size:13px;color:var(--text-secondary);">
          ยกเลิก / ไม่พิมพ์
        </button>
      </div>`;
    document.body.appendChild(el);
    const cleanup = () => el.remove();
    document.getElementById('rfp-80mm').onclick = () => { cleanup(); resolve('80mm'); };
    document.getElementById('rfp-a4').onclick   = () => { cleanup(); resolve('A4'); };
    document.getElementById('rfp-cancel').onclick = () => { cleanup(); resolve(null); };
    el.onclick = e => { if (e.target===el) { cleanup(); resolve(null); } };
    // hover effects
    ['rfp-80mm','rfp-a4'].forEach(id => {
      const btn = document.getElementById(id);
      btn.onmouseenter = () => { btn.style.borderColor='var(--primary)'; btn.style.background='var(--primary-50)'; btn.style.transform='translateY(-2px)'; };
      btn.onmouseleave = () => { btn.style.borderColor='var(--border-light)'; btn.style.background='var(--bg-base)'; btn.style.transform=''; };
    });
  });
}

// ══════════════════════════════════════════════════════════════════
// 2. FIX completePayment — ถามปริ้นหลังขายพร้อม format picker
// ══════════════════════════════════════════════════════════════════

window.completePayment = async function() {
  if (isProcessingPayment) return;
  // ตรวจยอดทอน
  if (checkoutState.method === 'cash' && checkoutState.change > 0) {
    try { await assertCashEnough(checkoutState.change, 'ทอนเงิน'); }
    catch(e) { Swal.fire({icon:'error',title:'เงินในลิ้นชักไม่พอทอน',text:e.message,confirmButtonColor:'#DC2626'}); return; }
  }
  isProcessingPayment = true;
  try {
    const { data: sess } = await db.from('cash_session').select('*').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).single();
    const { data: bill, error: bErr } = await db.from('บิลขาย').insert({
      date: new Date().toISOString(),
      method: {cash:'เงินสด',transfer:'โอนเงิน',credit:'บัตรเครดิต',debt:'ติดหนี้'}[checkoutState.method]||'เงินสด',
      total: checkoutState.total, discount: checkoutState.discount,
      received: checkoutState.received, change: checkoutState.change,
      customer_name: checkoutState.customer.name, customer_id: checkoutState.customer.id||null,
      staff_name: USER?.username,
      status: checkoutState.method==='debt' ? 'ค้างชำระ' : 'สำเร็จ',
      denominations: checkoutState.receivedDenominations
    }).select().single();
    if (bErr) throw bErr;

    for (const item of cart) {
      const prod = products.find(p => p.id===item.id);
      await db.from('รายการในบิล').insert({
        bill_id:bill.id, product_id:item.id, name:item.name,
        qty:item.qty, price:item.price, cost:item.cost||0, total:item.price*item.qty
      });
      await db.from('สินค้า').update({ stock:(prod?.stock||0)-item.qty }).eq('id',item.id);
      await db.from('stock_movement').insert({
        product_id:item.id, product_name:item.name, type:'ขาย', direction:'out',
        qty:item.qty, stock_before:prod?.stock||0, stock_after:(prod?.stock||0)-item.qty,
        ref_id:bill.id, ref_table:'บิลขาย', staff_name:USER?.username
      });
    }

    if (checkoutState.method==='cash' && sess) {
      await recordCashTx({
        sessionId:sess.id, type:'ขาย', direction:'in',
        amount:checkoutState.received, changeAmt:checkoutState.change,
        netAmount:checkoutState.total,
        refId:bill.id, refTable:'บิลขาย',
        denominations:checkoutState.receivedDenominations
      });
    }

    if (checkoutState.customer.id) {
      const { data: cust } = await db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id',checkoutState.customer.id).single();
      await db.from('customer').update({
        total_purchase:(cust?.total_purchase||0)+checkoutState.total,
        visit_count:(cust?.visit_count||0)+1,
        debt_amount: checkoutState.method==='debt'?(cust?.debt_amount||0)+checkoutState.total:(cust?.debt_amount||0)
      }).eq('id',checkoutState.customer.id);
    }

    logActivity('ขายสินค้า',`บิล #${bill.bill_no} ยอด ฿${formatNum(checkoutState.total)}`,bill.id,'บิลขาย');
    sendToDisplay({type:'thanks',billNo:bill.bill_no,total:checkoutState.total});
    closeCheckout(); cart = [];
    await loadProducts(); renderCart(); renderProductGrid(); updateHomeStats();

    // ถาม print พร้อม summary
    const { data: bItems } = await db.from('รายการในบิล').select('*').eq('bill_id',bill.id);
    const totalCost = (bItems||[]).reduce((s,i)=>s+(i.cost||0)*i.qty,0);
    const gp = bill.total - totalCost;

    const { value: doPrint } = await Swal.fire({
      icon: 'success',
      title: `บิล #${bill.bill_no} สำเร็จ`,
      html: `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
          <div style="background:#f0fdf4;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#666;">ยอดขาย</div>
            <div style="font-size:15px;font-weight:700;color:#059669;">฿${formatNum(bill.total)}</div>
          </div>
          <div style="background:#fef0f0;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#666;">ต้นทุน</div>
            <div style="font-size:15px;font-weight:700;color:#DC2626;">฿${formatNum(totalCost)}</div>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#666;">กำไร</div>
            <div style="font-size:15px;font-weight:700;color:#2563EB;">฿${formatNum(gp)}</div>
          </div>
        </div>
        <div style="font-size:13px;color:#666;margin-top:4px;">ต้องการพิมพ์ใบเสร็จหรือไม่?</div>`,
      showCancelButton: true,
      confirmButtonText: '<i class="material-icons-round" style="font-size:15px;vertical-align:middle;">print</i> พิมพ์ใบเสร็จ',
      cancelButtonText: 'ข้ามการพิมพ์',
      confirmButtonColor: '#DC2626',
      timer: 8000, timerProgressBar: true
    });
    if (doPrint) await printReceipt(bill, bItems||[], null);

  } catch(e) { console.error(e); toast('เกิดข้อผิดพลาด: '+e.message,'error'); }
  finally { isProcessingPayment = false; }
};

// ══════════════════════════════════════════════════════════════════
// 3. FIX CHECKOUT — เพิ่ม denomination wizard ใน step รับเงิน
// ══════════════════════════════════════════════════════════════════

// Override ขั้นตอน step 3 (นับแบงค์รับเงิน) ของ checkout
// ใช้ wizard แทนของเดิม
const _origNextCheckoutStep = window.nextCheckoutStep;
window.nextCheckoutStep = function() {
  // ถ้าอยู่ที่ step 2 (เลือกวิธีชำระ) และเลือก cash — เปิด wizard แทน step 3 เดิม
  if (typeof checkoutState !== 'undefined' && checkoutState.step === 2 && checkoutState.method === 'cash') {
    openDenomWizard({
      label: 'รับเงินจากลูกค้า',
      targetAmount: checkoutState.total - (checkoutState.discount||0),
      mustExact: false,
      onConfirm: async (denomState, received) => {
        checkoutState.received = received;
        checkoutState.change = received - checkoutState.total;
        checkoutState.receivedDenominations = denomState;
        checkoutState.step = 4; // ข้ามไป confirm
        if (typeof renderCheckoutStep === 'function') renderCheckoutStep();
      },
      onCancel: () => {}
    });
    return;
  }
  if (_origNextCheckoutStep) _origNextCheckoutStep();
};

// ══════════════════════════════════════════════════════════════════
// 4. CSS — denom wizard + receipt picker (inject ถ้าไม่มี)
// ══════════════════════════════════════════════════════════════════

(function injectWizardCSS() {
  if (document.getElementById('denom-wizard-css')) return;
  const style = document.createElement('style');
  style.id = 'denom-wizard-css';
  style.textContent = `
    #denom-wizard-overlay * { box-sizing: border-box; }
    #denom-wizard-overlay button:hover { opacity: .9; }
    #denom-wizard .denom-card-anim {
      animation: dw-pop .15s ease-out;
    }
    @keyframes dw-pop {
      0%  { transform: scale(0.93); }
      60% { transform: scale(1.04); }
      100%{ transform: scale(1); }
    }
    /* Responsive: phone portrait */
    @media (max-width: 480px) {
      #denom-wizard { max-height: 95vh !important; }
      #dw-bills-panel > div,
      #dw-coins-panel > div {
        grid-template-columns: repeat(3, 1fr) !important;
      }
    }
  `;
  document.head.appendChild(style);
})();

// ══════════════════════════════════════════════════════════════════
// 5. (รวมกับ section 7) renderSalesHistory อยู่ด้านล่าง
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// 6. FIX QUOTATION — แสดงรายการในหน้า quotation list
// ══════════════════════════════════════════════════════════════════

const _origRenderQuotations = window.renderQuotations;
window.renderQuotations = async function() {
  const section = document.getElementById('page-quot');
  if (!section) return;
  const {data} = await db.from('ใบเสนอราคา').select('*').order('date',{ascending:false}).limit(50);
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <h3 style="font-size:16px;font-weight:600;">ใบเสนอราคา</h3>
        <button class="btn btn-primary" onclick="showAddQuotationModal()"><i class="material-icons-round">add</i> สร้างใบเสนอราคา</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>วันที่</th><th>ลูกค้า</th>
            <th class="text-right">ยอดรวม</th>
            <th>หมดอายุ</th><th>สถานะ</th><th>จัดการ</th>
          </tr></thead>
          <tbody>${(data||[]).map(q=>`
            <tr>
              <td>${formatDate(q.date)}</td>
              <td><strong>${q.customer_name}</strong>
                ${q.note?`<div style="font-size:11px;color:var(--text-tertiary);">${q.note}</div>`:''}
              </td>
              <td class="text-right">
                <strong>฿${formatNum(q.total)}</strong>
                ${q.discount?`<div style="font-size:11px;color:var(--danger);">ส่วนลด ฿${formatNum(q.discount)}</div>`:''}
              </td>
              <td>${q.valid_until?`<span style="color:${new Date(q.valid_until)<new Date()?'var(--danger)':'var(--text-secondary)'}">${formatDate(q.valid_until)}</span>`:'-'}</td>
              <td><span class="badge ${q.status==='อนุมัติ'?'badge-success':q.status==='ยกเลิก'?'badge-danger':'badge-warning'}">${q.status}</span></td>
              <td><div class="table-actions">
                <button class="btn btn-ghost btn-icon" onclick="viewQuotationItems('${q.id}','${q.customer_name.replace(/'/g,'&apos;')}','${q.total}')" title="ดูรายการ">
                  <i class="material-icons-round">list</i>
                </button>
                <button class="btn btn-ghost btn-icon" onclick="printQuotation('${q.id}')" title="พิมพ์">
                  <i class="material-icons-round">print</i>
                </button>
                ${q.status==='รออนุมัติ'?`
                  <button class="btn btn-primary btn-sm" onclick="convertQuotation('${q.id}','${q.customer_name.replace(/'/g,'&apos;')}','${q.total}')">
                    <i class="material-icons-round">shopping_cart</i> สร้างบิล
                  </button>`:''
                }
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
};

async function viewQuotationItems(quotId, customerName, total) {
  const {data:items} = await db.from('รายการใบเสนอราคา').select('*').eq('quotation_id',quotId);
  openModal(`ใบเสนอราคา: ${customerName}`, `
    <div style="max-height:340px;overflow-y:auto;">
      <table class="data-table">
        <thead><tr><th>รายการ</th><th class="text-center">จำนวน</th><th class="text-right">ราคา/หน่วย</th><th class="text-right">รวม</th></tr></thead>
        <tbody>${(items||[]).map(i=>`
          <tr><td><strong>${i.name}</strong></td>
            <td class="text-center">${i.qty} ${i.unit||'ชิ้น'}</td>
            <td class="text-right">฿${formatNum(i.price)}</td>
            <td class="text-right"><strong>฿${formatNum(i.total)}</strong></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:var(--radius-md);display:flex;justify-content:space-between;">
      <span style="font-size:15px;font-weight:600;">ยอดสุทธิ</span>
      <strong style="color:var(--primary);font-size:17px;">฿${formatNum(total)}</strong>
    </div>`);
}

async function printQuotation(quotId) {
  const {data:quot} = await db.from('ใบเสนอราคา').select('*').eq('id',quotId).single();
  const {data:items} = await db.from('รายการใบเสนอราคา').select('*').eq('quotation_id',quotId);
  const rc = await getShopConfig();
  const win = window.open('','_blank','width=900,height=700');
  const rows = (items||[]).map((i,n)=>`
    <tr><td>${n+1}</td><td>${i.name}</td>
      <td style="text-align:center">${i.qty} ${i.unit||'ชิ้น'}</td>
      <td style="text-align:right">฿${formatNum(i.price)}</td>
      <td style="text-align:right"><strong>฿${formatNum(i.total)}</strong></td>
    </tr>`).join('');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    @page{size:A4;margin:15mm}*{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Sarabun',sans-serif;font-size:13px;color:#111}
    .hdr{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #DC2626}
    .shop-name{font-size:24px;font-weight:700;color:#DC2626}.shop-info{font-size:12px;color:#555;line-height:1.7}
    .doc-title{font-size:20px;font-weight:700;text-align:right}.doc-no{font-size:14px;color:#555;text-align:right}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;background:#f9f9f9;border-radius:8px;padding:12px 16px}
    .meta span{font-size:11px;color:#888;display:block}.meta strong{font-size:13px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#DC2626;color:#fff;padding:8px 10px;text-align:left}th:last-child{text-align:right}
    td{padding:7px 10px;border-bottom:1px solid #eee}
    .sum{margin-left:auto;width:260px}.sum-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee}
    .grand{display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#DC2626;border-top:2px solid #DC2626;padding:7px 0;margin-top:4px}
    .footer{margin-top:24px;padding-top:12px;border-top:1px dashed #ccc;font-size:11px;color:#999;display:flex;justify-content:space-between}
    .valid-chip{display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;padding:3px 8px;border-radius:4px}
    @media print{@page{size:A4;margin:15mm}}
  </style></head><body>
  <div class="hdr">
    <div><div class="shop-name">${rc.shop_name||'SK POS'}</div>
      <div class="shop-info">${rc.address||''}<br>โทร ${rc.phone||''} ${rc.tax_id?'| TAX '+rc.tax_id:''}</div></div>
    <div><div style="background:#DC2626;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:1px;margin-bottom:8px;display:inline-block">ใบเสนอราคา</div>
      <div class="doc-no">${new Date(quot.date).toLocaleDateString('th-TH',{dateStyle:'long'})}</div>
      ${quot.valid_until?`<div class="valid-chip" style="margin-top:6px;">หมดอายุ ${formatDate(quot.valid_until)}</div>`:''}
    </div>
  </div>
  <div class="meta">
    <div><span>ลูกค้า</span><strong>${quot.customer_name}</strong></div>
    <div><span>สร้างโดย</span><strong>${quot.staff_name||'-'}</strong></div>
    ${quot.note?`<div style="grid-column:1/-1"><span>หมายเหตุ</span><strong>${quot.note}</strong></div>`:''}
  </div>
  <table><thead><tr><th>#</th><th>รายการ</th><th style="text-align:center">จำนวน</th><th style="text-align:right">ราคา/หน่วย</th><th style="text-align:right">รวม</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="sum">
    ${quot.discount?`<div class="sum-row"><span>ยอดรวม</span><span>฿${formatNum((quot.total||0)+(quot.discount||0))}</span></div>
    <div class="sum-row"><span>ส่วนลด</span><span style="color:#DC2626">-฿${formatNum(quot.discount)}</span></div>`:''}
    <div class="grand"><span>ยอดสุทธิ</span><span>฿${formatNum(quot.total)}</span></div>
  </div>
  <div class="footer">
    <span>ราคานี้มีผลจนถึง ${quot.valid_until?formatDate(quot.valid_until):'ตามที่ตกลง'}</span>
    <span>พิมพ์วันที่ ${new Date().toLocaleDateString('th-TH')}</span>
  </div>
  <script>window.onload=()=>{window.print()}<\/script></body></html>`);
  win.document.close();
}

// ══════════════════════════════════════════════════════════════════
// 7. SALES HISTORY — เพิ่มปุ่มปริ้นในตาราง history
// ══════════════════════════════════════════════════════════════════

window.renderSalesHistory = async function() {
  const section = document.getElementById('page-history');
  if (!section) return;
  const search = document.getElementById('history-search')?.value?.toLowerCase()||'';
  const {data:bills} = await db.from('บิลขาย').select('*').order('date',{ascending:false}).limit(100);
  const filtered = (bills||[]).filter(b => !search || b.customer_name?.toLowerCase().includes(search) || String(b.bill_no).includes(search));
  const totalSales = filtered.reduce((s,b)=>s+(b.status==='สำเร็จ'?b.total:0),0);
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-stats">
        <div class="inv-stat"><span class="inv-stat-value">${filtered.length}</span><span class="inv-stat-label">บิลทั้งหมด</span></div>
        <div class="inv-stat"><span class="inv-stat-value">฿${formatNum(totalSales)}</span><span class="inv-stat-label">ยอดรวม</span></div>
      </div>
      <div style="margin-bottom:16px;">
        <input class="form-input" id="history-search" placeholder="ค้นหาบิล / ลูกค้า..." oninput="renderSalesHistory()" value="${search}">
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>#บิล</th><th>วันที่</th><th>ลูกค้า</th>
            <th>วิธีชำระ</th><th class="text-right">ยอด</th>
            <th>สถานะ</th><th>พนักงาน</th><th></th>
          </tr></thead>
          <tbody>${filtered.map(b=>`
            <tr>
              <td><strong>#${b.bill_no}</strong></td>
              <td style="white-space:nowrap">${formatDateTime(b.date)}</td>
              <td>${b.customer_name||'ทั่วไป'}</td>
              <td><span class="badge ${b.method==='เงินสด'?'badge-success':b.method==='โอนเงิน'?'badge-info':b.method==='ติดหนี้'?'badge-danger':'badge-warning'}">${b.method}</span></td>
              <td class="text-right"><strong>฿${formatNum(b.total)}</strong></td>
              <td><span class="badge ${b.status==='สำเร็จ'?'badge-success':'badge-danger'}">${b.status}</span></td>
              <td>${b.staff_name||'-'}</td>
              <td><div class="table-actions">
                <button class="btn btn-ghost btn-icon" title="พิมพ์ใบเสร็จ" onclick="printBillFromHistory('${b.id}')">
                  <i class="material-icons-round">print</i>
                </button>
                <button class="btn btn-ghost btn-icon" title="ดูรายการ" onclick="viewBillItems('${b.id}','${b.bill_no}')">
                  <i class="material-icons-round">receipt</i>
                </button>
                ${b.status==='สำเร็จ'?`
                  <button class="btn btn-ghost btn-icon" style="color:var(--danger)" title="ยกเลิกบิล" onclick="cancelBill('${b.id}','${b.bill_no}')">
                    <i class="material-icons-round">cancel</i>
                  </button>`:''}
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
};

async function viewBillItems(billId, billNo) {
  const {data:items} = await db.from('รายการในบิล').select('*').eq('bill_id',billId);
  const {data:bill} = await db.from('บิลขาย').select('*').eq('id',billId).single();
  const totalCost = (items||[]).reduce((s,i)=>s+(i.cost||0)*i.qty,0);
  const gp = (bill?.total||0) - totalCost;
  openModal(`บิล #${billNo} — รายการ`,`
    <div style="max-height:320px;overflow-y:auto;margin-bottom:12px;">
      <table class="data-table">
        <thead><tr><th>สินค้า</th><th class="text-center">จำนวน</th><th class="text-right">ราคา</th><th class="text-right">ต้นทุน</th><th class="text-right">รวม</th></tr></thead>
        <tbody>${(items||[]).map(i=>`
          <tr><td>${i.name}</td>
            <td class="text-center">${i.qty} ${i.unit||'ชิ้น'}</td>
            <td class="text-right">฿${formatNum(i.price)}</td>
            <td class="text-right" style="color:var(--text-tertiary)">฿${formatNum(i.cost||0)}</td>
            <td class="text-right"><strong>฿${formatNum(i.total)}</strong></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <div style="background:var(--bg-base);border-radius:var(--radius-md);padding:10px;text-align:center;">
        <div style="font-size:10px;color:var(--text-tertiary);">ยอดขาย</div>
        <strong style="color:var(--primary)">฿${formatNum(bill?.total||0)}</strong>
      </div>
      <div style="background:var(--bg-base);border-radius:var(--radius-md);padding:10px;text-align:center;">
        <div style="font-size:10px;color:var(--text-tertiary);">ต้นทุน</div>
        <strong style="color:var(--danger)">฿${formatNum(totalCost)}</strong>
      </div>
      <div style="background:var(--bg-base);border-radius:var(--radius-md);padding:10px;text-align:center;">
        <div style="font-size:10px;color:var(--text-tertiary);">กำไร</div>
        <strong style="color:var(--success)">฿${formatNum(gp)}</strong>
      </div>
    </div>`);
}

// ══════════════════════════════════════════════════════════════════
// 8. DASHBOARD ปุ่ม drill-down
// ══════════════════════════════════════════════════════════════════

// เพิ่ม click handler บน metric cards ใน dashboard
document.addEventListener('click', e => {
  const card = e.target.closest('[data-dash-action]');
  if (!card) return;
  const action = card.dataset.dashAction;
  if (action === 'low-stock') go('inv');
  else if (action === 'debt') go('debt');
  else if (action === 'payable') go('payable');
  else if (action === 'cash') go('cash');
});

console.log('[SK POS modules-v2-patch.js] ✅ Patches loaded');
