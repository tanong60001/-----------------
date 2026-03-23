/**
 * SK POS — modules-v6.js  (โหลดหลัง modules-v5.js)
 *
 * ██████████████████████████████████████████████████████████████████
 *  แก้ไขทั้งหมดที่รายงาน:
 *
 *  FIX-1  ใบเสร็จ A4 — ซ่อนต้นทุนตามค่า rc.show_cost จริงๆ
 *  FIX-2  รับสินค้าเข้า — เพิ่มรายการแล้วไม่เด้งออก
 *  FIX-3  หน้าพนักงาน — Supabase .catch chain TypeError
 *  FIX-4  พิมพ์บาร์โค้ด — ถามจำนวน + layout สวย + เลือก format
 *  FIX-5  หน้า POS — ลบปุ่มเลือก format ออก ย้ายไปสเต็ป 4
 *  FIX-6  หน้าขาย (bcConfirm) — ถามพิมพ์หลังขาย + เลือก format
 * ██████████████████████████████████████████████████████████████████
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// FIX-1  ใบเสร็จ A4 — ซ่อน/แสดงต้นทุนตาม rc.show_cost
// ══════════════════════════════════════════════════════════════════
// แก้ printReceiptA4v2 โดยตรง — ถ้า show_cost === false ซ่อน column

window.printReceiptA4v2 = function(bill, items, rc) {
  const showCost = rc?.show_cost === true;   // default = false (ซ่อน)
  const showDisc = rc?.show_discount !== false;
  const showRecv = rc?.show_received !== false;
  const showChng = rc?.show_change   !== false;
  const showStaff= rc?.show_staff    !== false;
  const showCust = rc?.show_customer !== false;
  const showBillNo= rc?.show_billno  !== false;
  const showDate = rc?.show_datetime !== false;

  const subtotal = (items||[]).reduce((s,i)=>s+i.total, 0);
  const cost     = (items||[]).reduce((s,i)=>s+(i.cost||0)*i.qty, 0);
  const gp       = subtotal - cost;

  // สร้าง rows — ซ่อน column ต้นทุนถ้า show_cost = false
  const rows = (items||[]).map((i,n) => `
    <tr>
      <td class="num">${n+1}</td>
      <td class="desc"><strong>${i.name}</strong></td>
      <td class="center">${i.qty} ${i.unit||'ชิ้น'}</td>
      <td class="right">฿${formatNum(i.price)}</td>
      ${showCost ? `<td class="right cost">฿${formatNum(i.cost||0)}</td>` : ''}
      <td class="right total">฿${formatNum(i.total)}</td>
    </tr>`).join('');

  const win = window.open('','_blank','width=960,height=800');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:15mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Sarabun',sans-serif;font-size:13px;color:#111;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:14px;border-bottom:3px solid #DC2626}
.shop-name{font-size:26px;font-weight:800;color:#DC2626;line-height:1;margin-bottom:5px}
.shop-info{font-size:11.5px;color:#555;line-height:1.7}
.receipt-badge{background:#DC2626;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:1px;margin-bottom:8px;display:inline-block}
.bill-no{font-size:22px;font-weight:800;color:#DC2626}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;background:#fafafa;border-radius:8px;padding:10px 14px;border:1px solid #f0f0f0}
.meta-item span{font-size:10px;color:#999;display:block;margin-bottom:1px}
.meta-item strong{font-size:13px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead th{background:#DC2626;color:#fff;padding:8px 10px;text-align:left;font-size:11.5px}
thead th.right{text-align:right}thead th.center{text-align:center}
tbody tr:nth-child(even){background:#fff8f8}
td{padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:12.5px}
td.num{width:30px;color:#bbb;text-align:center}td.desc{font-weight:500}
td.center{text-align:center;color:#555}td.right{text-align:right}
td.cost{color:#aaa}td.total{font-weight:600}
.summary{margin-left:auto;width:260px}
.sum-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f5;font-size:12.5px}
.sum-row.gp span:last-child{color:#059669;font-weight:600}
.grand-row{display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:#DC2626;border-top:2.5px solid #DC2626;border-bottom:2.5px solid #DC2626;padding:8px 0;margin-top:4px}
.method-chip{display:inline-block;background:#DC2626;color:#fff;font-size:11px;padding:3px 8px;border-radius:3px;margin-bottom:6px}
.qr-wrap{text-align:center;margin-top:10px}
.qr-wrap img{width:90px;height:90px;border:2px solid #DC2626;border-radius:4px;padding:2px}
.footer{margin-top:20px;padding-top:10px;border-top:1px dashed #ddd;display:flex;justify-content:space-between;font-size:10.5px;color:#aaa}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>

<div class="header">
  <div>
    ${rc?.show_name!==false ? `<div class="shop-name">${rc.shop_name||'SK POS'}</div>` : ''}
    <div class="shop-info">
      ${rc?.show_address!==false&&rc?.address ? `${rc.address}<br>` : ''}
      ${rc?.show_phone!==false&&rc?.phone    ? `โทร ${rc.phone}` : ''}
      ${rc?.show_tax!==false&&rc?.tax_id     ? ` &nbsp;|&nbsp; เลขผู้เสียภาษี ${rc.tax_id}` : ''}
    </div>
  </div>
  <div style="text-align:right;">
    <div class="receipt-badge">ใบเสร็จรับเงิน</div>
    <div>
      ${showBillNo ? `<div class="bill-no">เลขที่ #${bill.bill_no}</div>` : ''}
      ${showDate   ? `<div style="font-size:12px;color:#555;">${new Date(bill.date).toLocaleString('th-TH',{dateStyle:'full',timeStyle:'short'})}</div>` : ''}
    </div>
  </div>
</div>

<div class="meta-grid">
  ${showCust  ? `<div class="meta-item"><span>ลูกค้า</span><strong>${bill.customer_name||'ลูกค้าทั่วไป'}</strong></div>` : ''}
  ${showStaff ? `<div class="meta-item"><span>พนักงาน</span><strong>${bill.staff_name||'-'}</strong></div>` : ''}
  <div class="meta-item"><span>วิธีชำระ</span><strong>${bill.method}</strong></div>
  <div class="meta-item"><span>สถานะ</span><strong style="color:${bill.status==='สำเร็จ'?'#059669':'#DC2626'}">${bill.status}</strong></div>
</div>

<table>
  <thead><tr>
    <th class="num">#</th>
    <th>รายการสินค้า</th>
    <th class="center">จำนวน</th>
    <th class="right">ราคา/หน่วย</th>
    ${showCost ? '<th class="right">ต้นทุน</th>' : ''}
    <th class="right">ยอดรวม</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="summary">
  <div class="sum-row"><span>ยอดรวม</span><span>฿${formatNum(subtotal)}</span></div>
  ${showCost && cost>0 ? `
  <div class="sum-row gp"><span>ต้นทุนรวม</span><span>฿${formatNum(cost)}</span></div>
  <div class="sum-row gp"><span>กำไรขั้นต้น</span><span>฿${formatNum(gp)} (${subtotal>0?Math.round(gp/subtotal*100):0}%)</span></div>` : ''}
  ${showDisc&&bill.discount ? `<div class="sum-row"><span>ส่วนลด</span><span style="color:#DC2626">-฿${formatNum(bill.discount)}</span></div>` : ''}
  <div class="grand-row"><span>ยอดสุทธิ</span><span>฿${formatNum(bill.total)}</span></div>
  <div style="margin-top:8px;"><span class="method-chip">${bill.method}</span></div>
  ${bill.method==='เงินสด'&&showRecv ? `<div class="sum-row"><span>รับมา</span><span>฿${formatNum(bill.received)}</span></div>` : ''}
  ${bill.method==='เงินสด'&&showChng ? `<div class="sum-row"><span>เงินทอน</span><span style="font-weight:700">฿${formatNum(bill.change)}</span></div>` : ''}
  ${rc?.promptpay_number&&rc?.show_promptpay_qr!==false ? `
  <div class="qr-wrap">
    <img src="https://promptpay.io/${rc.promptpay_number.replace(/[^0-9]/g,'')}.png">
    <div style="font-size:10px;color:#aaa;margin-top:3px;">สแกนโอนเงิน</div>
  </div>` : ''}
</div>

<div class="footer">
  <span>${rc?.receipt_footer||'ขอบคุณที่ใช้บริการ'}</span>
  <span>พิมพ์โดย ${showStaff?bill.staff_name:''} | ${new Date().toLocaleString('th-TH')}</span>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`);
  win.document.close();
};

// ── 80mm ก็ต้องซ่อน cost เหมือนกัน ───────────────────────────────
const _v6Orig80mm = window.print80mmv2;
window.print80mmv2 = function(bill, items, rc) {
  if (!rc) { _v6Orig80mm?.apply(this, arguments); return; }
  rc = { ...rc };
  // ถ้า show_cost = false ให้ set cost = 0 ใน items ก่อน
  if (!rc.show_cost) {
    items = (items||[]).map(i => ({ ...i, cost: 0 }));
  }
  _v6Orig80mm?.(bill, items, rc);
};


// ══════════════════════════════════════════════════════════════════
// FIX-2  รับสินค้าเข้า — addPurchaseItem ไม่ closeModal แล้วเด้งออก
// ══════════════════════════════════════════════════════════════════
// ปัญหา: addPurchaseItem() เรียก closeModal() ซึ่งปิด purchase modal ด้วย
// แก้: แทน closeModal ด้วยการซ่อน add-item form แล้ว render รายการ inline

window.addPurchaseItem = function() {
  const id   = document.getElementById('pi-prod-id')?.value;
  const name = document.getElementById('pi-prod-name')?.value;
  const qty  = Number(document.getElementById('pi-qty')?.value || 1);
  const cost = Number(document.getElementById('pi-cost')?.value || 0);
  const unit = document.getElementById('pi-unit')?.value || 'ชิ้น';
  if (!id || qty <= 0) { toast('กรุณากรอกข้อมูล','error'); return; }

  const ex = purchaseItems.find(x => x.product_id === id);
  if (ex) { ex.qty += qty; ex.cost_per_unit = cost; }
  else purchaseItems.push({ product_id: id, name, qty, cost_per_unit: cost, unit });

  renderPurchaseItems();

  // ไม่ closeModal() — แค่ซ่อน add-item panel กลับไปหน้า list
  const addPanel = document.getElementById('pi-add-panel');
  const listPanel= document.getElementById('pi-list-panel');
  if (addPanel && listPanel) {
    addPanel.style.display = 'none';
    listPanel.style.display = 'block';
    const titleEl = document.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = 'สร้างใบรับสินค้าเข้า';
  } else {
    // fallback: เรียก showAddPurchaseModal ซ้ำโดยไม่ reset items
    const savedItems = [...purchaseItems];
    closeModal();
    setTimeout(() => {
      window._purchaseItemsCache = savedItems;
      showAddPurchaseModal?.();
    }, 80);
  }

  toast(`เพิ่ม ${name} x${qty} แล้ว`, 'success');
};

// Override showAddPurchaseModal ให้มี 2 panel ใน modal เดียว
window.showAddPurchaseModal = function() {
  if (window._purchaseItemsCache) {
    purchaseItems = window._purchaseItemsCache;
    window._purchaseItemsCache = null;
  } else {
    purchaseItems = [];
  }

  openModal('สร้างใบรับสินค้าเข้า', `
    <form id="purchase-form" onsubmit="event.preventDefault();">

      <!-- ─── Panel หลัก ──────────────────────────── -->
      <div id="pi-list-panel">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label class="form-label">ผู้จำหน่าย</label>
            <input class="form-input" id="pur-supplier" list="supplier-list" placeholder="ชื่อผู้จำหน่าย">
            <datalist id="supplier-list"></datalist></div>
          <div class="form-group"><label class="form-label">วิธีชำระ</label>
            <select class="form-input" id="pur-method" onchange="togglePurCredit()">
              <option>เงินสด</option><option>เครดิต</option><option>โอนเงิน</option>
            </select></div>
        </div>
        <div id="pur-credit-section" style="display:none;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">ซัพพลายเออร์</label>
              <select class="form-input" id="pur-supplier-id"><option value="">-- เลือก --</option></select></div>
            <div class="form-group"><label class="form-label">วันครบกำหนด</label>
              <input class="form-input" type="date" id="pur-due-date"></div>
          </div>
        </div>
        <div class="form-group"><label class="form-label">หมายเหตุ</label>
          <input class="form-input" id="pur-note" placeholder="หมายเหตุ (ถ้ามี)"></div>

        <!-- รายการสินค้า -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:700;">รายการสินค้า</div>
          <button type="button" class="btn btn-outline btn-sm" onclick="v6ShowAddItem()">
            <i class="material-icons-round" style="font-size:14px;">add</i> เพิ่มสินค้า
          </button>
        </div>
        <div id="pur-no-items" style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px;border:1.5px dashed var(--border-light);border-radius:var(--radius-md);">
          ยังไม่มีรายการ กดปุ่ม "เพิ่มสินค้า"
        </div>
        <div id="pur-item-list" style="display:none;"></div>

        <button type="button" class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="savePurchaseOrder()">
          <i class="material-icons-round">save</i> บันทึกใบรับสินค้า
        </button>
      </div>

      <!-- ─── Panel เพิ่มสินค้า ─────────────────── -->
      <div id="pi-add-panel" style="display:none;">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:12px;" onclick="v6HideAddItem()">
          <i class="material-icons-round" style="font-size:14px;">arrow_back</i> กลับ
        </button>
        <div class="form-group">
          <label class="form-label">ค้นหาสินค้า</label>
          <input class="form-input" id="pi-search" placeholder="พิมพ์ชื่อสินค้า..." oninput="filterPurchaseItems()">
        </div>
        <div id="pi-product-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius-md);margin-bottom:10px;">
          ${(products||[]).map(p => `
            <div class="pi-row" data-name="${(p.name||'').toLowerCase()}"
              style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:0.5px solid var(--border-light);cursor:pointer;"
              onclick="selectPurchaseProduct('${p.id}','${(p.name||'').replace(/'/g,"\\'")}','${p.unit||'ชิ้น'}')">
              <div>
                <strong style="font-size:13px;">${p.name}</strong>
                <span style="font-size:11px;color:var(--text-tertiary);margin-left:6px;">ต้นทุน ฿${formatNum(p.cost||0)} | สต็อก ${p.stock||0}</span>
              </div>
              <span class="btn btn-outline btn-sm">เลือก</span>
            </div>`).join('')}
        </div>
        <div id="pi-selected-info" style="display:none;">
          <div style="background:var(--bg-base);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:10px;font-size:13px;">
            เลือก: <strong id="pi-selected-name"></strong>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div class="form-group"><label class="form-label">จำนวน</label>
              <input class="form-input" type="number" id="pi-qty" value="1" min="1"></div>
            <div class="form-group"><label class="form-label">ต้นทุน/หน่วย</label>
              <input class="form-input" type="number" id="pi-cost" min="0" placeholder="0"></div>
            <div class="form-group"><label class="form-label">หน่วย</label>
              <input class="form-input" id="pi-unit" value="ชิ้น"></div>
          </div>
          <input type="hidden" id="pi-prod-id">
          <input type="hidden" id="pi-prod-name">
          <button type="button" class="btn btn-primary" style="width:100%;" onclick="addPurchaseItem()">
            <i class="material-icons-round">add</i> เพิ่มรายการนี้
          </button>
        </div>
      </div>

    </form>`);

  // Load suppliers
  db.from('ซัพพลายเออร์').select('id,name').eq('status','ใช้งาน').then(({data}) => {
    const dl  = document.getElementById('supplier-list');
    const sel = document.getElementById('pur-supplier-id');
    (data||[]).forEach(s => {
      if (dl) { const o = document.createElement('option'); o.value = s.name; dl.appendChild(o); }
      if (sel) { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; sel.appendChild(o); }
    });
  });

  // render ถ้ามี items cache
  if (purchaseItems.length > 0) renderPurchaseItems();
};

window.v6ShowAddItem = function() {
  document.getElementById('pi-list-panel').style.display = 'none';
  document.getElementById('pi-add-panel').style.display  = 'block';
  document.getElementById('pi-selected-info').style.display = 'none';
  const titleEl = document.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = 'เพิ่มสินค้าเข้าใบรับ';
  setTimeout(() => document.getElementById('pi-search')?.focus(), 100);
};

window.v6HideAddItem = function() {
  document.getElementById('pi-add-panel').style.display  = 'none';
  document.getElementById('pi-list-panel').style.display = 'block';
  const titleEl = document.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = 'สร้างใบรับสินค้าเข้า';
};

// Override selectPurchaseProduct ให้ทำงานกับ panel ใหม่
window.selectPurchaseProduct = function(id, name, unit) {
  document.getElementById('pi-product-list').style.display = 'none';
  document.getElementById('pi-search').closest('.form-group').style.display = 'none';
  const info = document.getElementById('pi-selected-info');
  const nameEl = document.getElementById('pi-selected-name');
  document.getElementById('pi-prod-id').value   = id;
  document.getElementById('pi-prod-name').value = name;
  document.getElementById('pi-unit').value      = unit;
  if (nameEl) nameEl.textContent = name;
  const prod = (products||[]).find(p => p.id === id);
  if (prod) document.getElementById('pi-cost').value = prod.cost || 0;
  if (info) info.style.display = 'block';
};


// ══════════════════════════════════════════════════════════════════
// FIX-3  หน้าพนักงาน — Supabase chain .catch TypeError
// ══════════════════════════════════════════════════════════════════
// Supabase JS v2: .order().limit() คืน PromiseLike ไม่ใช่ Promise ธรรมดา
// → ใช้ try/catch แทน .catch() ใน chain

// Override v5LoadAdvance ให้ใช้ try/catch
window.v5LoadAdvance && (async function patchLoadAdvance() {
  window.v5LoadAdvance = async function() {
    const sec = document.getElementById('att-tab-advance');
    if (!sec) return;
    sec.innerHTML = typeof v5Loading==='function' ? v5Loading('โหลดรายการเบิกเงิน...') : '<div style="padding:40px;text-align:center;">โหลด...</div>';

    const today = new Date().toISOString().split('T')[0];
    let emps = [], advances = [];
    try { emps = await loadEmployees(); } catch(e) { emps = []; }
    try {
      const { data } = await db.from('เบิกเงิน')
        .select('*, พนักงาน(name,lastname)')
        .order('date', { ascending: false })
        .limit(60);
      advances = data || [];
    } catch(e) { advances = []; }

    const empMap = {};
    emps.forEach(e => { empMap[e.id] = e; });
    const totalToday = advances.filter(a => (a.date||'').startsWith(today) && a.status==='อนุมัติ').reduce((s,a)=>s+a.amount, 0);

    sec.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">การเบิกเงินพนักงาน</h3>
          <div style="font-size:13px;color:var(--text-secondary);">เบิกวันนี้รวม: <strong style="color:var(--warning);">฿${formatNum(totalToday)}</strong></div>
        </div>
        <button class="btn btn-primary" onclick="v5NewAdvance?.()"><i class="material-icons-round">add</i> เบิกเงินใหม่</button>
      </div>
      ${advances.length === 0
        ? `<div style="text-align:center;padding:60px;color:var(--text-tertiary);"><i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;opacity:.3;">payments</i>ยังไม่มีรายการเบิกเงิน</div>`
        : `<div style="display:flex;flex-direction:column;gap:8px;">
            ${advances.map(a => {
              const emp  = a['พนักงาน'] || empMap[a.employee_id] || {};
              const name = emp.name ? `${emp.name} ${emp.lastname||''}`.trim() : '?';
              return `<div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px;">
                <div style="width:44px;height:44px;border-radius:50%;background:${a.status==='อนุมัติ'?'#fef3c7':'#f1f5f9'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  <i class="material-icons-round" style="color:${a.status==='อนุมัติ'?'var(--warning)':'#94a3b8'};">payments</i>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:14px;font-weight:700;">${name}</div>
                  <div style="font-size:12px;color:var(--text-tertiary);">${a.reason||'—'} • ${a.method||'เงินสด'}</div>
                  <div style="font-size:11px;color:var(--text-tertiary);">${a.date ? formatDateTime(a.date) : ''}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:16px;font-weight:800;color:var(--warning);">฿${formatNum(a.amount)}</div>
                  <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;background:${a.status==='อนุมัติ'?'#d1fae5':'#fef3c7'};color:${a.status==='อนุมัติ'?'#065f46':'#92400e'};">${a.status||'รออนุมัติ'}</span>
                </div>
              </div>`;
            }).join('')}
          </div>`}`;
  };
})();

// Override v5LoadPayroll ให้ใช้ try/catch
window.v5LoadPayroll && (async function patchLoadPayroll() {
  window.v5LoadPayroll = async function() {
    const sec = document.getElementById('att-tab-payroll');
    if (!sec) return;
    sec.innerHTML = typeof v5Loading==='function' ? v5Loading('คำนวณเงินเดือน...') : '<div style="padding:40px;text-align:center;">โหลด...</div>';

    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth() + 1;
    const monthStr  = `${year}-${String(month).padStart(2,'0')}`;
    const startDate = `${monthStr}-01`;
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

    let emps = [], attAll = [], advAll = [], paidAll = [];
    try { emps = await loadEmployees(); } catch(e) {}
    try { const r = await db.from('เช็คชื่อ').select('employee_id,status,date').gte('date',startDate).lte('date',endDate); attAll = r.data||[]; } catch(e) {}
    try { const r = await db.from('เบิกเงิน').select('employee_id,amount,status').gte('date',startDate+'T00:00:00').eq('status','อนุมัติ'); advAll = r.data||[]; } catch(e) {}
    try { const r = await db.from('จ่ายเงินเดือน').select('employee_id,net_paid,paid_date').gte('paid_date',startDate+'T00:00:00'); paidAll = r.data||[]; } catch(e) {}

    const actives = emps.filter(e => e.status==='ทำงาน');
    const paidMap = {};
    paidAll.forEach(p => { paidMap[p.employee_id] = p; });

    const rows = actives.map(emp => {
      const empAtt     = attAll.filter(a => a.employee_id===emp.id);
      const empAdv     = advAll.filter(a => a.employee_id===emp.id).reduce((s,a)=>s+a.amount, 0);
      const daysWork   = empAtt.filter(a => a.status==='มาทำงาน').length;
      const daysLate   = empAtt.filter(a => a.status==='มาสาย').length;
      const daysAbsent = empAtt.filter(a => ['ขาดงาน','ลากิจ'].includes(a.status)).length;
      const wage       = emp.daily_wage || 0;
      const gross      = daysWork * wage + daysLate * wage * 0.75;
      const net        = Math.max(0, gross - empAdv);
      const isPaid     = !!paidMap[emp.id];
      return { emp, daysWork, daysLate, daysAbsent, gross, empAdv, net, isPaid };
    });

    const totalNet = rows.reduce((s,r)=>s+r.net, 0);

    sec.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">จ่ายเงินเดือน — ${new Date(year,month-1,1).toLocaleDateString('th-TH',{year:'numeric',month:'long'})}</h3>
          <div style="font-size:13px;color:var(--text-secondary);">ยอดรวม: <strong style="color:var(--success);font-size:16px;">฿${formatNum(Math.round(totalNet))}</strong></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${rows.map(r => `
          <div style="background:var(--bg-surface);border:1.5px solid ${r.isPaid?'#86efac':'var(--border-light)'};border-radius:16px;padding:18px;opacity:${r.isPaid?.7:1};">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
              <div>
                <div style="font-size:15px;font-weight:700;">${r.emp.name} ${r.emp.lastname||''}</div>
                <div style="font-size:12px;color:var(--text-tertiary);">${r.emp.position||''} • ฿${formatNum(r.emp.daily_wage||0)}/วัน</div>
              </div>
              ${r.isPaid
                ? `<span style="padding:4px 12px;border-radius:999px;background:#d1fae5;color:#065f46;font-size:12px;font-weight:700;">✅ จ่ายแล้ว</span>`
                : `<button class="btn btn-primary btn-sm" onclick="v5PayEmployee?.('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim()}',${Math.round(r.net)},'${monthStr}')">
                     <i class="material-icons-round" style="font-size:14px;">send</i> จ่ายเงิน
                   </button>`}
            </div>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;text-align:center;">
              ${[['วันทำงาน',r.daysWork,'#10B981'],['มาสาย',r.daysLate,'#F59E0B'],['ขาดงาน',r.daysAbsent,'#EF4444'],['ยอดเบิก',`฿${formatNum(r.empAdv)}`,'#F59E0B'],['สุทธิ',`฿${formatNum(Math.round(r.net))}`,'#10B981']]
                .map(([l,v,c]) => `<div style="background:var(--bg-base);border-radius:10px;padding:8px 4px;"><div style="font-size:9px;color:var(--text-tertiary);margin-bottom:3px;">${l}</div><div style="font-size:14px;font-weight:800;color:${c};">${v}</div></div>`).join('')}
            </div>
          </div>`).join('')}
        ${rows.length===0?`<div style="text-align:center;padding:60px;color:var(--text-tertiary);">ไม่มีพนักงาน</div>`:''}
      </div>`;
  };
})();

// Override v5LoadEmps ให้ใช้ try/catch
window.v5LoadEmps && (async function patchLoadEmps() {
  window.v5LoadEmps = async function() {
    const sec = document.getElementById('att-tab-emps');
    if (!sec) return;
    sec.innerHTML = typeof v5Loading==='function' ? v5Loading('โหลดข้อมูลพนักงาน...') : '<div style="padding:40px;text-align:center;">โหลด...</div>';

    let emps = [], attAll = [], advAll = [], paidAll = [];
    try { emps = await loadEmployees(); } catch(e) {}
    try { const r = await db.from('เช็คชื่อ').select('employee_id,status').gte('date','2020-01-01'); attAll = r.data||[]; } catch(e) {}
    try { const r = await db.from('เบิกเงิน').select('employee_id,amount').eq('status','อนุมัติ'); advAll = r.data||[]; } catch(e) {}
    try { const r = await db.from('จ่ายเงินเดือน').select('employee_id,net_paid,paid_date').order('paid_date',{ascending:false}).limit(200); paidAll = r.data||[]; } catch(e) {}

    sec.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
        <h3 style="font-size:16px;font-weight:700;">ข้อมูลพนักงานทั้งหมด (${emps.length} คน)</h3>
        <button class="btn btn-primary" onclick="showEmployeeModal?.();setTimeout(()=>v5LoadEmps?.(),1500)">
          <i class="material-icons-round">person_add</i> เพิ่มพนักงาน
        </button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
        ${emps.map(emp => {
          const empAtt    = attAll.filter(a => a.employee_id===emp.id);
          const totalDays = empAtt.filter(a => a.status==='มาทำงาน').length;
          const lateDays  = empAtt.filter(a => a.status==='มาสาย').length;
          const absDays   = empAtt.filter(a => ['ขาดงาน','ลากิจ'].includes(a.status)).length;
          const advCount  = advAll.filter(a => a.employee_id===emp.id).length;
          const lastPay   = paidAll.find(p => p.employee_id===emp.id);
          return `
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:18px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04);">
              <div style="padding:16px 18px;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 70%,#000));display:flex;align-items:center;gap:12px;">
                <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;flex-shrink:0;">${(emp.name||'?').charAt(0)}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:15px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${emp.name} ${emp.lastname||''}</div>
                  <div style="font-size:12px;color:rgba(255,255,255,.75);">${emp.position||'พนักงาน'} • ${emp.phone||'ไม่มีเบอร์'}</div>
                </div>
                <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;flex-shrink:0;background:${emp.status==='ทำงาน'?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'};color:${emp.status==='ทำงาน'?'#a7f3d0':'#fca5a5'};">${emp.status||'ทำงาน'}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--border-light);">
                ${[['มาทำงาน',totalDays,'#10B981'],['มาสาย',lateDays,'#F59E0B'],['ขาดงาน',absDays,'#EF4444'],['เบิกเงิน',advCount,'#6366F1']]
                  .map(([l,v,c],i) => `<div style="padding:12px 8px;text-align:center;${i<3?'border-right:1px solid var(--border-light);':''}"><div style="font-size:18px;font-weight:800;color:${c};">${v}</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:1px;">${l}</div></div>`).join('')}
              </div>
              <div style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div>
                  <div style="font-size:10px;color:var(--text-tertiary);">จ่ายเดือนล่าสุด</div>
                  <div style="font-size:13px;font-weight:700;color:var(--success);">${lastPay?`฿${formatNum(lastPay.net_paid)}`:'—'}</div>
                </div>
                <div style="display:flex;gap:6px;">
                  <button class="btn btn-ghost btn-sm" onclick="editEmployee?.('${emp.id}');setTimeout(()=>v5LoadEmps?.(),1200)">
                    <i class="material-icons-round" style="font-size:14px;">edit</i>
                  </button>
                  <button class="btn btn-outline btn-sm" style="color:var(--warning);" onclick="openAdvanceWizard?.('${emp.id}','${emp.name}');setTimeout(()=>v5LoadAdvance?.(),1000)">
                    <i class="material-icons-round" style="font-size:14px;">account_balance_wallet</i>
                  </button>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
      ${emps.length===0?'<div style="text-align:center;padding:60px;color:var(--text-tertiary);">ยังไม่มีพนักงาน</div>':''}`;
  };
})();


// ══════════════════════════════════════════════════════════════════
// FIX-4  พิมพ์บาร์โค้ด — ถามจำนวน + layout สวย + เลือก format
// ══════════════════════════════════════════════════════════════════

window.generateBarcode = async function(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const barcode = product.barcode || `SK${Date.now().toString().slice(-10)}`;
  if (!product.barcode) await db.from('สินค้า').update({ barcode }).eq('id', productId);

  const { value: formVals } = await Swal.fire({
    title: 'พิมพ์บาร์โค้ด',
    html: `
      <div style="text-align:left;font-size:14px;">
        <div style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:14px;">
          <div style="font-weight:700;margin-bottom:2px;">${product.name}</div>
          <div style="font-size:12px;color:#64748b;">${barcode}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">จำนวนที่จะพิมพ์</label>
            <input id="bc-qty-inp" type="number" value="1" min="1" max="100"
              style="width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;text-align:center;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">ขนาดกระดาษ</label>
            <select id="bc-format-sel" style="width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;">
              <option value="label">Label (58mm)</option>
              <option value="a4">A4 (เต็มแผ่น)</option>
            </select>
          </div>
        </div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: '<i class="material-icons-round" style="font-size:14px;vertical-align:middle;">print</i> พิมพ์',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#DC2626',
    preConfirm: () => ({
      qty:    parseInt(document.getElementById('bc-qty-inp')?.value || 1, 10),
      format: document.getElementById('bc-format-sel')?.value || 'label'
    })
  });
  if (!formVals) return;

  v6PrintBarcodeLabels(product, barcode, formVals.qty, formVals.format);
};

function v6PrintBarcodeLabels(product, barcode, qty, format) {
  const win = window.open('', '_blank', 'width=800,height=600');
  const labels = Array.from({ length: qty }, (_, i) => `
    <div class="label">
      <div class="shop-name">${window.SHOP_CONFIG?.nameEn || 'SK POS'}</div>
      <div class="prod-name">${product.name}</div>
      <svg class="barcode-svg" data-barcode="${barcode}"></svg>
      <div class="barcode-text">${barcode}</div>
      ${product.price ? `<div class="price">฿${formatNum(product.price)}</div>` : ''}
    </div>`).join('');

  const isA4 = format === 'a4';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page { size: ${isA4 ? 'A4' : '58mm auto'}; margin: ${isA4 ? '10mm' : '3mm'}; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Sarabun', sans-serif; background: #fff; }
.label-grid { display: ${isA4 ? 'grid' : 'flex flex-direction:column'}; ${isA4 ? 'grid-template-columns:repeat(4,1fr);gap:6px;' : ''} }
.label {
  width: ${isA4 ? 'auto' : '52mm'};
  border: 1px solid #e2e8f0; border-radius: 6px;
  padding: 6px 8px; text-align: center;
  page-break-inside: avoid; margin-bottom: ${isA4 ? '0' : '4mm'};
  background: #fff;
}
.shop-name { font-size: 9px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; }
.prod-name { font-size: 11px; font-weight: 700; margin: 3px 0; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.barcode-svg { width: 100%; height: 45px; margin: 3px 0; }
.barcode-text { font-size: 9px; color: #475569; letter-spacing: 1.5px; font-family: monospace; }
.price { font-size: 13px; font-weight: 800; color: #DC2626; margin-top: 3px; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
</head><body>
<div class="label-grid">${labels}</div>
<script>
window.onload = () => {
  document.querySelectorAll('.barcode-svg').forEach(svg => {
    try { JsBarcode(svg, svg.dataset.barcode, { format:'CODE128', width:1.8, height:40, displayValue:false, margin:2 }); } catch(e) {}
  });
  setTimeout(() => window.print(), 600);
};
<\/script>
</body></html>`);
  win.document.close();
}


// ══════════════════════════════════════════════════════════════════
// FIX-5  หน้า POS — ลบปุ่มเลือก format ออก
//         (format เลือกตอนสเต็ป 4 หลังยืนยันขาย)
// ══════════════════════════════════════════════════════════════════
// ซ่อน radio print-format ใน POS หลังโหลด
document.addEventListener('DOMContentLoaded', () => {
  const fmt = document.querySelector('[name="print-format"]')?.closest('div, label, .form-group');
  if (fmt) fmt.style.display = 'none';
});
// และซ่อนเมื่อ navigate ไปหน้า POS
const _v6OrigSwitchPage = window.switchPage;
window.switchPage = function(page) {
  _v6OrigSwitchPage?.apply(this, arguments);
  if (page === 'pos') {
    setTimeout(() => {
      document.querySelectorAll('[name="print-format"]').forEach(el => {
        const wrap = el.closest('div, label');
        if (wrap) wrap.style.display = 'none';
      });
    }, 100);
  }
};


// ══════════════════════════════════════════════════════════════════
// FIX-6  bcConfirm (bill checkout) — ถามพิมพ์ + เลือก format
// ══════════════════════════════════════════════════════════════════

const _v6OrigBcConfirm = window.bcConfirm;
window.bcConfirm = async function() {
  if (window.isProcessingPayment) return;
  if (!checkoutState?.method) { toast('กรุณาเลือกวิธีชำระเงิน','warning'); return; }

  if (checkoutState.method === 'cash') {
    const recv = typeof v4Total === 'function'
      ? v4Total(window._v4States?.['recv'] || {})
      : (checkoutState.received || 0);
    if (recv < (checkoutState.total || 0)) { toast('ยอดรับเงินไม่เพียงพอ','error'); return; }
    checkoutState.received              = recv;
    checkoutState.change                = recv - checkoutState.total;
    checkoutState.receivedDenominations = { ...(window._v4States?.['recv'] || {}) };
    const chgState = window._v4States?.['chg'];
    checkoutState.changeDenominations   = chgState
      ? { ...chgState }
      : (typeof calcChangeDenominations === 'function' ? calcChangeDenominations(checkoutState.change) : {});
  }

  closeBillCheckout?.();
  await v6CompleteSale();
};

async function v6CompleteSale() {
  if (window.isProcessingPayment) return;
  window.isProcessingPayment = true;

  // แสดง spinner
  const btn = document.getElementById('bc-ok-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:v5spin 1s linear infinite;margin-right:8px;vertical-align:middle;"></span>กำลังบันทึก...'; }

  try {
    const { data: sess } = await db.from('cash_session').select('*').eq('status','open').order('opened_at',{ascending:false}).limit(1).single();
    const { data: bill, error: bErr } = await db.from('บิลขาย').insert({
      date: new Date().toISOString(),
      method: {cash:'เงินสด',transfer:'โอนเงิน',credit:'บัตรเครดิต',debt:'ติดหนี้'}[checkoutState.method] || 'เงินสด',
      total: checkoutState.total, discount: checkoutState.discount || 0,
      received: checkoutState.received, change: checkoutState.change || 0,
      customer_name: checkoutState.customer.name, customer_id: checkoutState.customer.id || null,
      staff_name: USER?.username,
      status: checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
      denominations: checkoutState.receivedDenominations || {}
    }).select().single();
    if (bErr) throw bErr;

    for (const item of cart) {
      const prod = products.find(p => p.id === item.id);
      await db.from('รายการในบิล').insert({ bill_id:bill.id, product_id:item.id, name:item.name, qty:item.qty, price:item.price, cost:item.cost||0, total:item.price*item.qty });
      await db.from('สินค้า').update({ stock:(prod?.stock||0)-item.qty }).eq('id',item.id);
      await db.from('stock_movement').insert({ product_id:item.id, product_name:item.name, type:'ขาย', direction:'out', qty:item.qty, stock_before:prod?.stock||0, stock_after:(prod?.stock||0)-item.qty, ref_id:bill.id, ref_table:'บิลขาย', staff_name:USER?.username });
    }

    if (checkoutState.method === 'cash' && sess && typeof recordCashTx === 'function') {
      await recordCashTx({
        sessionId: sess.id, type:'ขาย', direction:'in',
        amount: checkoutState.received, changeAmt: checkoutState.change || 0,
        netAmount: checkoutState.total, refId: bill.id, refTable:'บิลขาย',
        denominations: checkoutState.receivedDenominations,
        change_denominations: checkoutState.changeDenominations || {}
      });
    }

    if (checkoutState.customer?.id) {
      const { data: cust } = await db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id',checkoutState.customer.id).single();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase||0) + checkoutState.total,
        visit_count:    (cust?.visit_count||0) + 1,
        debt_amount:    checkoutState.method==='debt' ? (cust?.debt_amount||0)+checkoutState.total : (cust?.debt_amount||0)
      }).eq('id', checkoutState.customer.id);
    }

    logActivity('ขายสินค้า', `บิล #${bill.bill_no} ยอด ฿${formatNum(checkoutState.total)}`, bill.id, 'บิลขาย');
    sendToDisplay?.({ type:'thanks', billNo:bill.bill_no, total:checkoutState.total });
    cart = [];
    await loadProducts();
    renderCart?.(); renderProductGrid?.(); updateHomeStats?.();

    // ถามพิมพ์ + เลือก format (สเต็ป 4)
    const { data: bItems } = await db.from('รายการในบิล').select('*').eq('bill_id', bill.id);
    const totalCost = (bItems||[]).reduce((s,i)=>s+(i.cost||0)*i.qty, 0);
    const gp = bill.total - totalCost;

    const rc = await (typeof getShopConfig === 'function' ? getShopConfig() : Promise.resolve({}));
    const askFmt = rc?.ask_format !== false;

    // ถาม format + พิมพ์
    const { value: fmt } = await Swal.fire({
      icon: 'success',
      title: `✅ บิล #${bill.bill_no} สำเร็จ`,
      html: `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0;text-align:center;">
          <div style="background:#f0fdf4;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">ยอดขาย</div>
            <div style="font-size:16px;font-weight:800;color:#059669;">฿${formatNum(bill.total)}</div>
          </div>
          <div style="background:#fff8f0;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">ต้นทุน</div>
            <div style="font-size:16px;font-weight:800;color:#f59e0b;">฿${formatNum(totalCost)}</div>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#666;margin-bottom:2px;">กำไร</div>
            <div style="font-size:16px;font-weight:800;color:#2563eb;">฿${formatNum(gp)}</div>
          </div>
        </div>
        <div style="margin-top:10px;">
          <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">รูปแบบพิมพ์ใบเสร็จ</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <label style="border:2px solid #e2e8f0;border-radius:10px;padding:10px;cursor:pointer;text-align:center;transition:all .15s;">
              <input type="radio" name="v6fmt" value="80mm" style="display:none;">
              <div style="font-size:20px;margin-bottom:4px;">🧾</div>
              <div style="font-size:12px;font-weight:700;">80mm</div>
              <div style="font-size:10px;color:#94a3b8;">เครื่องพิมพ์</div>
            </label>
            <label style="border:2px solid #e2e8f0;border-radius:10px;padding:10px;cursor:pointer;text-align:center;transition:all .15s;">
              <input type="radio" name="v6fmt" value="A4" style="display:none;">
              <div style="font-size:20px;margin-bottom:4px;">📄</div>
              <div style="font-size:12px;font-weight:700;">A4</div>
              <div style="font-size:10px;color:#94a3b8;">ใบเสร็จเต็ม</div>
            </label>
            <label style="border:2px solid #e2e8f0;border-radius:10px;padding:10px;cursor:pointer;text-align:center;transition:all .15s;">
              <input type="radio" name="v6fmt" value="skip" checked style="display:none;">
              <div style="font-size:20px;margin-bottom:4px;">⏭️</div>
              <div style="font-size:12px;font-weight:700;">ข้าม</div>
              <div style="font-size:10px;color:#94a3b8;">ไม่พิมพ์</div>
            </label>
          </div>
        </div>`,
      showConfirmButton: true,
      showCancelButton: false,
      confirmButtonText: 'ยืนยัน',
      confirmButtonColor: '#DC2626',
      timer: 10000, timerProgressBar: true,
      didOpen: () => {
        // style radio labels
        document.querySelectorAll('[name="v6fmt"]').forEach(radio => {
          const lbl = radio.closest('label');
          radio.addEventListener('change', () => {
            document.querySelectorAll('[name="v6fmt"]').forEach(r => {
              const l = r.closest('label');
              l.style.borderColor = r.checked ? '#DC2626' : '#e2e8f0';
              l.style.background  = r.checked ? '#fff5f5' : '#fff';
            });
          });
          if (radio.checked) { lbl.style.borderColor = '#DC2626'; lbl.style.background = '#fff5f5'; }
        });
        // auto select format from settings
        const defaultFmt = rc?.default_format || '80mm';
        const autoRadio = document.querySelector(`[name="v6fmt"][value="${defaultFmt}"]`);
        if (autoRadio) { autoRadio.checked = true; autoRadio.dispatchEvent(new Event('change')); }
      },
      preConfirm: () => document.querySelector('[name="v6fmt"]:checked')?.value || 'skip'
    });

    if (fmt && fmt !== 'skip') {
      await printReceipt(bill, bItems||[], fmt);
    }

  } catch(e) {
    console.error('[v6] sale error:', e);
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  } finally {
    window.isProcessingPayment = false;
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.origText || 'ยืนยันการขาย'; }
  }
}

console.info('%c[modules-v6.js] ✅%c FIX-1:ต้นทุนใบเสร็จ | FIX-2:รับสินค้า | FIX-3:พนักงาน | FIX-4:บาร์โค้ด | FIX-5:Format POS | FIX-6:พิมพ์หลังขาย',
  'color:#f59e0b;font-weight:700','color:#6B7280');
