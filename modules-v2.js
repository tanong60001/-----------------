/**
 * SK POS v2.1 — modules-v2.js
 * โหลดหลัง app.js และ modules.js
 * override ฟังก์ชันที่ต้องปรับปรุง + เพิ่มระบบใหม่
 * ══════════════════════════════════════════════════════════════════
 * A. STEP-BASED DENOM UI    — นับแบงค์แบบ step (ไม่เลื่อนลง)
 * B. INVENTORY FIX          — หน้าคลัง: ลบปุ่มซ้ำ, 1 แถว
 * C. PURCHASE ORDER v2      — รับสินค้าพร้อมรายการ + เครดิต → เจ้าหนี้
 * D. DEBT PAYMENT v2        — รับชำระหนี้ + นับแบงค์
 * E. QUOTATION v2           — ใบเสนอราคา + รายการสินค้า
 * F. RECEIPT DESIGN v2      — ใบเสร็จ 80mm + A4 สวยงาม
 * G. ATT ADVANCE BTN        — ปุ่มเบิกเงินในหน้าพนักงาน
 * ══════════════════════════════════════════════════════════════════
 */
'use strict';

// ══════════════════════════════════════════════════════════════════
// A. STEP-BASED DENOMINATION MODAL
// ══════════════════════════════════════════════════════════════════
// แทนที่ denomGridHTML เดิม ด้วย step-wizard แบบ fullscreen modal

/**
 * openDenomWizard — เปิด wizard นับแบงค์แบบ step
 * @param {object} opts
 *   label         — ชื่อขั้นตอน เช่น 'จ่ายออก', 'รับมา'
 *   targetAmount  — ยอดที่ต้องการ (0 = ไม่จำกัด)
 *   mustExact     — true = ต้องพอดี, false = ต้อง >= target
 *   onConfirm     — async function(denomState, total) {} เรียกเมื่อยืนยัน
 *   onCancel      — function() {} เรียกเมื่อยกเลิก
 */
function openDenomWizard({ label, targetAmount, mustExact, onConfirm, onCancel }) {
  // ถ้ามี wizard อยู่แล้วให้ลบก่อน
  document.getElementById('denom-wizard-overlay')?.remove();

  const state = {};
  [...BILLS, ...COINS].forEach(d => { state[d.value] = 0; });

  const overlay = document.createElement('div');
  overlay.id = 'denom-wizard-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;padding:16px;`;

  overlay.innerHTML = `
    <div id="denom-wizard" style="
      background:var(--bg-surface);border-radius:20px;
      width:100%;max-width:540px;max-height:90vh;
      display:flex;flex-direction:column;overflow:hidden;
      box-shadow:0 24px 64px rgba(0,0,0,0.4);">

      <!-- Header -->
      <div style="
        padding:18px 22px 14px;
        background:var(--primary);
        display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-size:11px;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">นับเงิน — ${label}</div>
          ${targetAmount > 0
            ? `<div style="font-size:13px;color:rgba(255,255,255,0.9);">ยอดที่ต้องการ: <strong style="font-size:17px;">฿${formatNum(targetAmount)}</strong></div>`
            : `<div style="font-size:13px;color:rgba(255,255,255,0.9);">นับจำนวนที่ต้องการ</div>`}
        </div>
        <button onclick="closeDenomWizard()" style="
          background:rgba(255,255,255,0.2);border:none;border-radius:50%;
          width:32px;height:32px;cursor:pointer;color:#fff;
          display:flex;align-items:center;justify-content:center;">
          <i class="material-icons-round" style="font-size:18px;">close</i>
        </button>
      </div>

      <!-- Step tabs -->
      <div id="dw-steps" style="
        display:flex;background:var(--bg-base);border-bottom:1px solid var(--border-light);flex-shrink:0;overflow-x:auto;">
        <button id="dw-tab-bills" onclick="dwSwitchTab('bills')"
          style="flex:1;padding:10px 4px;border:none;background:var(--primary);color:#fff;
                 font-family:var(--font-thai);font-size:13px;font-weight:600;cursor:pointer;
                 display:flex;flex-direction:column;align-items:center;gap:2px;min-width:80px;">
          <i class="material-icons-round" style="font-size:18px;">payments</i>ธนบัตร
        </button>
        <button id="dw-tab-coins" onclick="dwSwitchTab('coins')"
          style="flex:1;padding:10px 4px;border:none;background:none;color:var(--text-secondary);
                 font-family:var(--font-thai);font-size:13px;cursor:pointer;
                 display:flex;flex-direction:column;align-items:center;gap:2px;min-width:80px;">
          <i class="material-icons-round" style="font-size:18px;">toll</i>เหรียญ
        </button>
      </div>

      <!-- Bill cards area -->
      <div id="dw-bills-panel" style="flex:1;overflow-y:auto;padding:16px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:10px;">
          ${BILLS.map(d => dwCardHTML(d, false, state)).join('')}
        </div>
      </div>

      <!-- Coin cards area -->
      <div id="dw-coins-panel" style="flex:1;overflow-y:auto;padding:16px;display:none;">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          ${COINS.map(d => dwCardHTML(d, true, state)).join('')}
        </div>
      </div>

      <!-- Footer summary -->
      <div id="dw-footer" style="
        padding:14px 18px;border-top:1px solid var(--border-light);
        background:var(--bg-base);flex-shrink:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:2px;">นับได้รวม</div>
            <div id="dw-total-display" style="font-size:22px;font-weight:700;color:var(--primary);">฿0</div>
          </div>
          ${targetAmount > 0 ? `
          <div style="text-align:right;">
            <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:2px;">ผลต่าง</div>
            <div id="dw-diff-display" style="font-size:18px;font-weight:700;color:var(--text-tertiary);">-฿${formatNum(targetAmount)}</div>
          </div>` : ''}
        </div>
        <div id="dw-error" style="display:none;padding:8px 12px;background:var(--danger-bg);border-radius:var(--radius-md);color:var(--danger);font-size:12px;margin-bottom:10px;"></div>
        <div style="display:flex;gap:8px;">
          <button onclick="closeDenomWizard()" style="
            flex:1;padding:11px;border:1.5px solid var(--border-default);border-radius:var(--radius-md);
            background:none;cursor:pointer;font-family:var(--font-thai);font-size:14px;color:var(--text-secondary);">
            ยกเลิก
          </button>
          <button id="dw-confirm-btn" onclick="confirmDenomWizard()" style="
            flex:2;padding:11px;border:none;border-radius:var(--radius-md);
            background:var(--primary);color:#fff;cursor:pointer;font-family:var(--font-thai);
            font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;">
            <i class="material-icons-round" style="font-size:18px;">check</i>ยืนยัน
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  // store config
  window._dwConfig = { state, targetAmount, mustExact, onConfirm, onCancel };
}

function dwCardHTML(d, isCoin, state) {
  const qty = state[d.value] || 0;
  const col = isCoin ? '#DAA520' : d.bg;
  const textCol = isCoin ? '#8B6914' : d.color;
  return `
    <div id="dwcard-${d.value}" onclick="dwCardClick(${d.value})"
      style="
        border-radius:12px;border:2px solid ${qty>0?col:isCoin?'#DAA52040':'var(--border-light)'};
        background:${qty>0?(isCoin?'#FFFBEB':'color-mix(in srgb,'+col+' 12%,var(--bg-surface))'):'var(--bg-surface)'};
        padding:10px 6px;cursor:pointer;transition:all .15s;text-align:center;
        position:relative;user-select:none;-webkit-tap-highlight-color:transparent;">
      <!-- top color bar -->
      <div style="position:absolute;top:0;left:0;right:0;height:4px;border-radius:10px 10px 0 0;background:${col};"></div>
      <!-- qty badge -->
      <div id="dwbadge-${d.value}" style="
        position:absolute;top:6px;right:6px;
        background:${qty>0?col:'var(--border-light)'};color:${qty>0?'#fff':'var(--text-tertiary)'};
        border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;
        display:flex;align-items:center;justify-content:center;">${qty}</div>
      <!-- face value -->
      <div style="font-size:${d.value>=1000?'18px':'20px'};font-weight:800;color:${textCol};margin:10px 0 4px;font-family:var(--font-display);">${d.label}</div>
      <!-- subtotal -->
      <div id="dwsub-${d.value}" style="font-size:10px;color:var(--text-tertiary);">฿${formatNum(qty*d.value)}</div>
      <!-- controls -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:3px;">
        <button onclick="event.stopPropagation();dwAdjust(${d.value},-1)"
          style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border-default);
                 background:var(--bg-base);cursor:pointer;font-size:16px;color:var(--danger);
                 display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;">−</button>
        <span id="dwqty-${d.value}" style="font-size:14px;font-weight:700;min-width:18px;text-align:center;">${qty}</span>
        <button onclick="event.stopPropagation();dwAdjust(${d.value},1)"
          style="width:26px;height:26px;border-radius:50%;border:none;
                 background:${col};cursor:pointer;font-size:16px;color:#fff;
                 display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;">+</button>
      </div>
    </div>`;
}

function dwCardClick(value) { dwAdjust(value, 1); }

function dwAdjust(value, delta) {
  const cfg = window._dwConfig;
  if (!cfg) return;
  cfg.state[value] = Math.max(0, (cfg.state[value]||0) + delta);
  const qty = cfg.state[value];
  const col = BILLS.find(b=>b.value===value)?.bg || '#DAA520';
  const isCoin = COINS.some(c=>c.value===value);
  const cardBg = qty>0 ? (isCoin?'#FFFBEB':`color-mix(in srgb,${col} 12%,var(--bg-surface))`) : 'var(--bg-surface)';
  const cardBorder = qty>0 ? col : (isCoin?'#DAA52040':'var(--border-light)');
  const card = document.getElementById(`dwcard-${value}`);
  const badge = document.getElementById(`dwbadge-${value}`);
  const sub   = document.getElementById(`dwsub-${value}`);
  const qtyEl = document.getElementById(`dwqty-${value}`);
  if (card) { card.style.background = cardBg; card.style.borderColor = cardBorder; }
  if (badge) { badge.textContent = qty; badge.style.background = qty>0?col:'var(--border-light)'; badge.style.color = qty>0?'#fff':'var(--text-tertiary)'; }
  if (sub)   sub.textContent = `฿${formatNum(qty*value)}`;
  if (qtyEl) qtyEl.textContent = qty;
  dwUpdateFooter();
}

function dwUpdateFooter() {
  const cfg = window._dwConfig;
  if (!cfg) return;
  const total = [...BILLS,...COINS].reduce((s,d)=>s+(cfg.state[d.value]||0)*d.value,0);
  const totalEl = document.getElementById('dw-total-display');
  const diffEl  = document.getElementById('dw-diff-display');
  if (totalEl) totalEl.textContent = `฿${formatNum(total)}`;
  if (diffEl && cfg.targetAmount > 0) {
    const diff = total - cfg.targetAmount;
    diffEl.textContent = `${diff>=0?'+':''}฿${formatNum(diff)}`;
    diffEl.style.color = diff===0 ? 'var(--success)' : diff>0 ? 'var(--warning)' : 'var(--danger)';
  }
}

function dwSwitchTab(tab) {
  const bp = document.getElementById('dw-bills-panel');
  const cp = document.getElementById('dw-coins-panel');
  const bt = document.getElementById('dw-tab-bills');
  const ct = document.getElementById('dw-tab-coins');
  if (!bp||!cp) return;
  if (tab==='bills') {
    bp.style.display='block'; cp.style.display='none';
    bt.style.background='var(--primary)'; bt.style.color='#fff';
    ct.style.background='none'; ct.style.color='var(--text-secondary)';
  } else {
    bp.style.display='none'; cp.style.display='block';
    ct.style.background='var(--primary)'; ct.style.color='#fff';
    bt.style.background='none'; bt.style.color='var(--text-secondary)';
  }
}

async function confirmDenomWizard() {
  const cfg = window._dwConfig;
  if (!cfg) return;
  const total = [...BILLS,...COINS].reduce((s,d)=>s+(cfg.state[d.value]||0)*d.value,0);
  const errEl = document.getElementById('dw-error');
  if (cfg.targetAmount > 0) {
    if (cfg.mustExact && total !== cfg.targetAmount) {
      if (errEl) { errEl.style.display='block'; errEl.textContent=`ยอดต้องพอดี ฿${formatNum(cfg.targetAmount)} (นับได้ ฿${formatNum(total)})`; }
      return;
    }
    if (!cfg.mustExact && total < cfg.targetAmount) {
      if (errEl) { errEl.style.display='block'; errEl.textContent=`นับได้ไม่ถึงยอด ฿${formatNum(cfg.targetAmount)} (นับได้ ฿${formatNum(total)})`; }
      return;
    }
  }
  if (total === 0) {
    if (errEl) { errEl.style.display='block'; errEl.textContent='กรุณานับจำนวนเงิน'; }
    return;
  }
  document.getElementById('denom-wizard-overlay')?.remove();
  if (cfg.onConfirm) await cfg.onConfirm({...cfg.state}, total);
}

function closeDenomWizard() {
  const cfg = window._dwConfig;
  document.getElementById('denom-wizard-overlay')?.remove();
  if (cfg?.onCancel) cfg.onCancel();
}

// ══════════════════════════════════════════════════════════════════
// B. INVENTORY FIX — 1 แถวปุ่ม, ลบปุ่มซ้ำ
// ══════════════════════════════════════════════════════════════════

const _origRenderInventory = window.renderInventory;
window.renderInventory = async function() {
  await _origRenderInventory();
  // override page-actions to single row: barcode batch + export + add
  const pa = document.getElementById('page-actions');
  if (pa) {
    pa.innerHTML = `
      <button class="btn btn-outline" onclick="showBarcodeBatchModal()">
        <i class="material-icons-round">qr_code_2</i> ปริ้นบาร์โค้ด
      </button>
      <button class="btn btn-outline" onclick="exportInventory()">
        <i class="material-icons-round">download</i> CSV
      </button>
      <button class="btn btn-primary" onclick="showAddProductModal()">
        <i class="material-icons-round">add</i> เพิ่มสินค้า
      </button>`;
  }
};

// ══════════════════════════════════════════════════════════════════
// C. PURCHASE ORDER v2 — รับสินค้าพร้อมรายการ + เครดิต→เจ้าหนี้
// ══════════════════════════════════════════════════════════════════

let purchaseItems = [];  // [{product_id, name, qty, cost_per_unit, unit}]

window.showAddPurchaseModal = function() {
  purchaseItems = [];
  openModal('สร้างใบรับสินค้าเข้า', `
    <form id="purchase-form" onsubmit="event.preventDefault();">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">ผู้จำหน่าย / ซัพพลายเออร์</label>
          <input class="form-input" id="pur-supplier" list="supplier-list" placeholder="ชื่อผู้จำหน่าย">
          <datalist id="supplier-list"></datalist>
        </div>
        <div class="form-group"><label class="form-label">วิธีชำระ</label>
          <select class="form-input" id="pur-method" onchange="togglePurCredit()">
            <option value="เงินสด">เงินสด</option>
            <option value="โอนเงิน">โอนเงิน</option>
            <option value="เครดิต">เครดิต (เจ้าหนี้)</option>
          </select>
        </div>
      </div>
      <div id="pur-credit-section" style="display:none;padding:10px;background:var(--warning-bg);border-radius:var(--radius-md);margin-bottom:12px;font-size:13px;color:var(--warning);">
        <i class="material-icons-round" style="font-size:14px;vertical-align:middle;">info</i>
        เครดิต: ยอดนี้จะบันทึกเป็นเจ้าหนี้ร้าน — ระบุวันครบกำหนดชำระ
        <div style="margin-top:8px;">
          <label class="form-label">วันครบกำหนดชำระ *</label>
          <input class="form-input" type="date" id="pur-due-date" value="${new Date(Date.now()+30*86400000).toISOString().split('T')[0]}">
        </div>
      </div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="pur-note" placeholder="หมายเหตุ (ถ้ามี)">
      </div>

      <!-- รายการสินค้า -->
      <div style="border:1px solid var(--border-light);border-radius:var(--radius-md);overflow:hidden;margin-bottom:12px;">
        <div style="background:var(--bg-base);padding:10px 12px;display:flex;align-items:center;justify-content:space-between;">
          <strong style="font-size:13px;">รายการสินค้าที่รับเข้า</strong>
          <button type="button" class="btn btn-outline btn-sm" onclick="showAddPurchaseItemModal()">
            <i class="material-icons-round">add</i> เพิ่มรายการ
          </button>
        </div>
        <div id="pur-item-list" style="min-height:60px;">
          <p id="pur-no-items" style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:13px;">ยังไม่มีรายการ</p>
        </div>
        <div style="padding:10px 12px;background:var(--bg-base);display:flex;justify-content:space-between;">
          <span style="font-size:13px;color:var(--text-secondary);">ยอดรวม</span>
          <strong id="pur-total-display" style="color:var(--primary);">฿0</strong>
        </div>
      </div>

      <button type="button" class="btn btn-primary" style="width:100%;" onclick="submitPurchaseOrder()">
        <i class="material-icons-round">save</i> บันทึกใบรับสินค้า
      </button>
    </form>`);
  // load suppliers
  db.from('ซัพพลายเออร์').select('name').then(({data}) => {
    const dl = document.getElementById('supplier-list');
    if (dl) (data||[]).forEach(s => { const opt = document.createElement('option'); opt.value = s.name; dl.appendChild(opt); });
  });
};

function togglePurCredit() {
  const m = document.getElementById('pur-method')?.value;
  const s = document.getElementById('pur-credit-section');
  if (s) s.style.display = m==='เครดิต' ? 'block' : 'none';
}

function showAddPurchaseItemModal() {
  openModal('เพิ่มรายการสินค้า', `
    <div class="form-group"><label class="form-label">ค้นหาสินค้า</label>
      <input class="form-input" id="pi-search" placeholder="ค้นหา..." oninput="filterPurchaseItems()"></div>
    <div id="pi-product-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius-md);margin-bottom:12px;">
      ${(products||[]).map(p=>`
        <div class="pi-row" data-name="${p.name.toLowerCase()}"
          style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:0.5px solid var(--border-light);cursor:pointer;" onclick="selectPurchaseProduct('${p.id}','${p.name.replace(/'/g,"&apos;")}','${p.unit||"ชิ้น"}')">
          <div><strong style="font-size:13px;">${p.name}</strong>
            <span style="font-size:11px;color:var(--text-tertiary);margin-left:6px;">ต้นทุน ฿${formatNum(p.cost||0)}</span></div>
          <span class="btn btn-outline btn-sm">เลือก</span>
        </div>`).join('')}
    </div>
    <div id="pi-selected-info" style="display:none;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">จำนวน</label>
          <input class="form-input" type="number" id="pi-qty" value="1" min="1"></div>
        <div class="form-group"><label class="form-label">ต้นทุน/หน่วย (บาท)</label>
          <input class="form-input" type="number" id="pi-cost" min="0"></div>
        <div class="form-group"><label class="form-label">หน่วย</label>
          <input class="form-input" id="pi-unit" value="ชิ้น"></div>
      </div>
      <input type="hidden" id="pi-prod-id">
      <input type="hidden" id="pi-prod-name">
      <button class="btn btn-primary" style="width:100%;" onclick="addPurchaseItem()">
        <i class="material-icons-round">add</i> เพิ่มรายการนี้
      </button>
    </div>`, 'md');
}
function filterPurchaseItems() {
  const q = document.getElementById('pi-search')?.value?.toLowerCase()||'';
  document.querySelectorAll('.pi-row').forEach(r => { r.style.display = r.dataset.name?.includes(q)?'':'none'; });
}
function selectPurchaseProduct(id, name, unit) {
  document.getElementById('pi-product-list').style.display = 'none';
  document.getElementById('pi-search').closest('.form-group').style.display = 'none';
  const info = document.getElementById('pi-selected-info');
  document.getElementById('pi-prod-id').value = id;
  document.getElementById('pi-prod-name').value = name;
  document.getElementById('pi-unit').value = unit;
  const prod = (products||[]).find(p=>p.id===id);
  if (prod) document.getElementById('pi-cost').value = prod.cost||0;
  if (info) info.style.display = 'block';
  // update modal title
  const modalTitle = document.querySelector('.modal-title');
  if (modalTitle) modalTitle.textContent = `เพิ่ม: ${name}`;
}
function addPurchaseItem() {
  const id = document.getElementById('pi-prod-id')?.value;
  const name = document.getElementById('pi-prod-name')?.value;
  const qty = Number(document.getElementById('pi-qty')?.value||1);
  const cost = Number(document.getElementById('pi-cost')?.value||0);
  const unit = document.getElementById('pi-unit')?.value||'ชิ้น';
  if (!id||qty<=0) { toast('กรุณากรอกข้อมูล','error'); return; }
  const ex = purchaseItems.find(x=>x.product_id===id);
  if (ex) { ex.qty+=qty; ex.cost_per_unit=cost; }
  else purchaseItems.push({product_id:id, name, qty, cost_per_unit:cost, unit});
  renderPurchaseItems();
  closeModal();
  // reopen purchase modal
  setTimeout(()=>{ /* modal already open beneath */ },100);
}
function renderPurchaseItems() {
  const list = document.getElementById('pur-item-list');
  const noItems = document.getElementById('pur-no-items');
  const totalEl = document.getElementById('pur-total-display');
  if (!list) return;
  if (purchaseItems.length===0) {
    list.innerHTML = '<p id="pur-no-items" style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:13px;">ยังไม่มีรายการ</p>';
    if (totalEl) totalEl.textContent = '฿0';
    return;
  }
  const total = purchaseItems.reduce((s,i)=>s+i.qty*i.cost_per_unit,0);
  list.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:var(--bg-base);">
      <th style="padding:6px 10px;text-align:left;">สินค้า</th>
      <th style="padding:6px;text-align:center;">จำนวน</th>
      <th style="padding:6px;text-align:right;">ต้นทุน/หน่วย</th>
      <th style="padding:6px;text-align:right;">รวม</th>
      <th style="padding:6px;"></th>
    </tr></thead>
    <tbody>${purchaseItems.map((item,idx)=>`
      <tr style="border-bottom:0.5px solid var(--border-light);">
        <td style="padding:8px 10px;"><strong>${item.name}</strong></td>
        <td style="padding:6px;text-align:center;">${item.qty} ${item.unit}</td>
        <td style="padding:6px;text-align:right;">฿${formatNum(item.cost_per_unit)}</td>
        <td style="padding:6px;text-align:right;font-weight:600;">฿${formatNum(item.qty*item.cost_per_unit)}</td>
        <td style="padding:6px;text-align:center;">
          <button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="purchaseItems.splice(${idx},1);renderPurchaseItems()">
            <i class="material-icons-round" style="font-size:14px;">close</i>
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
  if (totalEl) totalEl.textContent = `฿${formatNum(total)}`;
}

async function submitPurchaseOrder() {
  if (purchaseItems.length===0) { toast('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ','error'); return; }
  const supplier = document.getElementById('pur-supplier')?.value||'';
  const method = document.getElementById('pur-method')?.value;
  const note = document.getElementById('pur-note')?.value||'';
  const dueDate = document.getElementById('pur-due-date')?.value||null;
  const total = purchaseItems.reduce((s,i)=>s+i.qty*i.cost_per_unit,0);

  // สร้าง purchase_order
  const { data: po, error } = await db.from('purchase_order').insert({
    supplier, method, total, note, staff_name:USER?.username, status:'รับแล้ว', date:new Date().toISOString()
  }).select().single();
  if (error) { toast('เกิดข้อผิดพลาด: '+error.message,'error'); return; }

  // บันทึก purchase_item + อัปสต็อก
  for (const item of purchaseItems) {
    await db.from('purchase_item').insert({ order_id:po.id, product_id:item.product_id, name:item.name, qty:item.qty, received_qty:item.qty, cost_per_unit:item.cost_per_unit, total:item.qty*item.cost_per_unit });
    const prod = (products||[]).find(p=>p.id===item.product_id);
    const newStock = (prod?.stock||0) + item.qty;
    await db.from('สินค้า').update({stock:newStock, cost:item.cost_per_unit}).eq('id',item.product_id);
    await db.from('stock_movement').insert({ product_id:item.product_id, product_name:item.name, type:'รับเข้า', direction:'in', qty:item.qty, stock_before:prod?.stock||0, stock_after:newStock, ref_id:po.id, ref_table:'purchase_order', staff_name:USER?.username });
  }

  // ถ้าเครดิต → บันทึกเจ้าหนี้
  if (method==='เครดิต') {
    // หา/สร้าง supplier record
    let suppId = null;
    if (supplier) {
      const {data:suppRec} = await db.from('ซัพพลายเออร์').select('id').eq('name',supplier).single();
      if (suppRec) suppId = suppRec.id;
      else {
        const {data:newSupp} = await db.from('ซัพพลายเออร์').insert({name:supplier}).select().single();
        suppId = newSupp?.id;
      }
    }
    if (suppId) {
      await db.from('เจ้าหนี้').insert({ supplier_id:suppId, purchase_order_id:po.id, date:new Date().toISOString(), due_date:dueDate, amount:total, paid_amount:0, balance:total, status:'ค้างชำระ' });
      // อัป supplier total_purchase
      const {data:s} = await db.from('ซัพพลายเออร์').select('total_purchase').eq('id',suppId).single();
      await db.from('ซัพพลายเออร์').update({total_purchase:(s?.total_purchase||0)+total}).eq('id',suppId);
    }
    toast(`บันทึกสำเร็จ — เจ้าหนี้ ฿${formatNum(total)} (ครบกำหนด ${dueDate||'ไม่ระบุ'})`,'success');
  } else {
    toast('บันทึกใบรับสินค้าสำเร็จ','success');
  }
  logActivity('รับสินค้าเข้า',`${supplier||'ไม่ระบุ'} จำนวน ${purchaseItems.length} รายการ ฿${formatNum(total)}`);
  await loadProducts();
  closeModal(); renderPurchases();
}

// override renderPurchases เพื่อโชว์รายการสินค้าในแต่ละใบ
window.renderPurchases = async function() {
  const section = document.getElementById('page-purchase');
  if (!section) return;
  const {data:orders} = await db.from('purchase_order').select('*').order('date',{ascending:false}).limit(50);
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <h3 style="font-size:16px;font-weight:600;">รับสินค้าเข้า</h3>
        <button class="btn btn-primary" onclick="showAddPurchaseModal()"><i class="material-icons-round">add</i> สร้างใบรับสินค้า</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>วันที่</th><th>ผู้จำหน่าย</th><th>วิธีชำระ</th><th class="text-right">ยอดรวม</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody>${(orders||[]).map(o=>`
            <tr>
              <td>${formatDateTime(o.date)}</td>
              <td><strong>${o.supplier||'-'}</strong></td>
              <td><span class="badge ${o.method==='เครดิต'?'badge-warning':o.method==='โอนเงิน'?'badge-info':'badge-success'}">${o.method}</span></td>
              <td class="text-right"><strong>฿${formatNum(o.total)}</strong></td>
              <td><span class="badge ${o.status==='รับแล้ว'?'badge-success':'badge-warning'}">${o.status}</span></td>
              <td>
                <button class="btn btn-ghost btn-icon" onclick="viewPurchaseItems('${o.id}')">
                  <i class="material-icons-round">list</i>
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
};

async function viewPurchaseItems(orderId) {
  const {data:items} = await db.from('purchase_item').select('*').eq('order_id',orderId);
  const {data:order} = await db.from('purchase_order').select('*').eq('id',orderId).single();
  openModal(`รายการรับสินค้า — ${order?.supplier||'ไม่ระบุ'}`, `
    <div style="margin-bottom:10px;font-size:13px;color:var(--text-secondary);">
      ${formatDateTime(order?.date)} | ${order?.method} | <strong>฿${formatNum(order?.total||0)}</strong>
    </div>
    <div class="table-wrapper" style="max-height:300px;overflow-y:auto;">
      <table class="data-table">
        <thead><tr><th>สินค้า</th><th class="text-center">จำนวน</th><th class="text-right">ต้นทุน/หน่วย</th><th class="text-right">รวม</th></tr></thead>
        <tbody>${(items||[]).map(i=>`
          <tr><td>${i.name}</td>
            <td class="text-center">${i.qty} ชิ้น</td>
            <td class="text-right">฿${formatNum(i.cost_per_unit)}</td>
            <td class="text-right"><strong>฿${formatNum(i.total)}</strong></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`);
}

// ══════════════════════════════════════════════════════════════════
// D. DEBT PAYMENT v2 — รับชำระหนี้ + wizard นับแบงค์
// ══════════════════════════════════════════════════════════════════

window.recordDebtPayment = async function(customerId, customerName) {
  const {data:cust} = await db.from('customer').select('*').eq('id',customerId).single();
  const debtAmt = cust?.debt_amount||0;
  if (debtAmt<=0) { toast('ลูกค้านี้ไม่มียอดค้างชำระ','info'); return; }
  openModal(`รับชำระหนี้: ${customerName}`, `
    <div style="padding:12px;background:var(--danger-bg);border-radius:var(--radius-md);margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
      <div><div style="font-size:11px;color:var(--danger);">หนี้คงค้าง</div>
        <div style="font-size:22px;font-weight:700;color:var(--danger);">฿${formatNum(debtAmt)}</div></div>
      <i class="material-icons-round" style="font-size:36px;color:var(--danger);opacity:.3">account_balance</i>
    </div>
    <div class="form-group"><label class="form-label">จำนวนที่รับชำระ (บาท) *</label>
      <input class="form-input" type="number" id="debt-pay-amount" min="1" max="${debtAmt}" value="${debtAmt}"></div>
    <div class="form-group"><label class="form-label">วิธีรับชำระ</label>
      <select class="form-input" id="debt-pay-method">
        <option value="เงินสด">เงินสด (นับแบงค์)</option>
        <option value="โอนเงิน">โอนเงิน</option>
      </select></div>
    <div class="form-group"><label class="form-label">หมายเหตุ</label>
      <input class="form-input" id="debt-pay-note"></div>
    <input type="hidden" id="debt-cust-id" value="${customerId}">
    <input type="hidden" id="debt-amt" value="${debtAmt}">
    <button class="btn btn-primary" style="width:100%;" onclick="processDebtPayment()">
      <i class="material-icons-round">payments</i> ดำเนินการรับชำระ
    </button>`);
};

async function processDebtPayment() {
  const customerId = document.getElementById('debt-cust-id')?.value;
  const amount = Number(document.getElementById('debt-pay-amount')?.value||0);
  const method = document.getElementById('debt-pay-method')?.value;
  const note = document.getElementById('debt-pay-note')?.value||'';
  if (!amount||amount<=0) { toast('กรุณาระบุจำนวน','error'); return; }
  const {data:cust} = await db.from('customer').select('*').eq('id',customerId).single();
  if (amount > (cust?.debt_amount||0)) { toast('จำนวนเกินหนี้ที่ค้างอยู่','error'); return; }

  if (method==='เงินสด') {
    closeModal();
    openDenomWizard({
      label: `รับชำระจาก ${cust?.name}`,
      targetAmount: amount,
      mustExact: false,
      onConfirm: async (denomState, total) => {
        const change = total - amount;
        await _finishDebtPayment(customerId, cust, amount, method, note, denomState, change);
      },
      onCancel: () => {}
    });
  } else {
    await _finishDebtPayment(customerId, cust, amount, method, note, null, 0);
  }
}

async function _finishDebtPayment(customerId, cust, amount, method, note, denomState, change) {
  const {data:sess} = await db.from('cash_session').select('id').eq('status','open').limit(1).single();

  // ตรวจว่ามีเงินทอนพอไหม
  if (change > 0) {
    try { await assertCashEnough(change, 'ทอนเงิน'); } catch(e) {
      Swal.fire({icon:'error',title:'เงินในลิ้นชักไม่พอทอน',text:e.message}); return;
    }
  }

  // บันทึกชำระหนี้
  await db.from('ชำระหนี้').insert({ customer_id:customerId, date:new Date().toISOString(), amount, method, staff_name:USER?.username, note, denominations:denomState });
  await db.from('customer').update({ debt_amount:Math.max(0,(cust?.debt_amount||0)-amount) }).eq('id',customerId);

  if (method==='เงินสด' && sess) {
    await recordCashTx({ sessionId:sess.id, type:'รับชำระหนี้', direction:'in', amount:denomState?Object.entries(denomState).reduce((s,[v,q])=>s+Number(v)*q,0):amount, changeAmt:change, netAmount:amount, ref_table:'ชำระหนี้', denominations:denomState, note:`รับจาก ${cust?.name}` });
  }
  toast(`รับชำระ ฿${formatNum(amount)} สำเร็จ${change>0?` (ทอน ฿${formatNum(change)})`:''}`,'success');
  logActivity('รับชำระหนี้',`${cust?.name} ฿${formatNum(amount)}`);
  renderDebts();
}

// override renderDebts เพิ่มปุ่มประวัติ
window.renderDebts = async function() {
  const section = document.getElementById('page-debt');
  if (!section) return;
  const {data} = await db.from('customer').select('*').gt('debt_amount',0).order('debt_amount',{ascending:false});
  const total = (data||[]).reduce((s,c)=>s+c.debt_amount,0);
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-stats">
        <div class="inv-stat danger"><span class="inv-stat-value">฿${formatNum(total)}</span><span class="inv-stat-label">หนี้รวมทั้งหมด</span></div>
        <div class="inv-stat"><span class="inv-stat-value">${(data||[]).length}</span><span class="inv-stat-label">ลูกค้าค้างชำระ</span></div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>ลูกค้า</th><th>เบอร์โทร</th><th class="text-right">หนี้คงค้าง</th><th class="text-right">วงเงิน</th><th>จัดการ</th></tr></thead>
          <tbody>${(data||[]).map(c=>`
            <tr>
              <td><strong>${c.name}</strong></td>
              <td>${c.phone||'-'}</td>
              <td class="text-right"><strong style="color:var(--danger)">฿${formatNum(c.debt_amount)}</strong></td>
              <td class="text-right">฿${formatNum(c.credit_limit)}</td>
              <td><div class="table-actions">
                <button class="btn btn-primary btn-sm" onclick="recordDebtPayment('${c.id}','${c.name.replace(/'/g,"&apos;")}')">
                  <i class="material-icons-round">payments</i> รับชำระ
                </button>
                <button class="btn btn-ghost btn-icon" onclick="viewDebtHistory('${c.id}','${c.name.replace(/'/g,"&apos;")}')">
                  <i class="material-icons-round">history</i>
                </button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
};

async function viewDebtHistory(customerId, name) {
  const {data:payments} = await db.from('ชำระหนี้').select('*').eq('customer_id',customerId).order('date',{ascending:false}).limit(20);
  openModal(`ประวัติชำระหนี้: ${name}`, `
    <div style="max-height:400px;overflow-y:auto;">
      ${(payments||[]).length===0 ? '<p style="text-align:center;color:var(--text-tertiary);padding:30px;">ยังไม่มีประวัติ</p>' :
        `<table class="data-table">
          <thead><tr><th>วันที่</th><th class="text-right">จำนวน</th><th>วิธี</th><th>พนักงาน</th></tr></thead>
          <tbody>${payments.map(p=>`<tr>
            <td>${formatDateTime(p.date)}</td>
            <td class="text-right"><strong style="color:var(--success)">+฿${formatNum(p.amount)}</strong></td>
            <td>${p.method}</td><td>${p.staff_name||'-'}</td>
          </tr>`).join('')}</tbody>
        </table>`}
    </div>`);
}

// ══════════════════════════════════════════════════════════════════
// E. QUOTATION v2 — ใบเสนอราคา + รายการสินค้า
// ══════════════════════════════════════════════════════════════════

let quotItems = [];

window.showAddQuotationModal = function() {
  quotItems = [];
  openModal('สร้างใบเสนอราคา', `
    <form id="quot-form" onsubmit="event.preventDefault();">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">ชื่อลูกค้า *</label>
          <input class="form-input" id="quot-customer" required></div>
        <div class="form-group"><label class="form-label">วันหมดอายุ</label>
          <input class="form-input" type="date" id="quot-valid"
            value="${new Date(Date.now()+7*86400000).toISOString().split('T')[0]}"></div>
      </div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="quot-note" placeholder="เงื่อนไข / รายละเอียดเพิ่มเติม"></div>

      <!-- รายการ -->
      <div style="border:1px solid var(--border-light);border-radius:var(--radius-md);overflow:hidden;margin-bottom:12px;">
        <div style="background:var(--bg-base);padding:10px 12px;display:flex;align-items:center;justify-content:space-between;">
          <strong style="font-size:13px;">รายการที่เสนอ</strong>
          <button type="button" class="btn btn-outline btn-sm" onclick="showAddQuotItemModal()">
            <i class="material-icons-round">add</i> เพิ่มรายการ
          </button>
        </div>
        <div id="quot-item-list">
          <p id="quot-no-items" style="text-align:center;color:var(--text-tertiary);padding:16px;font-size:13px;">ยังไม่มีรายการ</p>
        </div>
        <div style="padding:10px 12px;background:var(--bg-base);">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:13px;">ยอดรวม</span>
            <strong id="quot-subtotal-display">฿0</strong>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <label style="font-size:13px;">ส่วนลด (บาท)</label>
            <input class="form-input" type="number" id="quot-discount" value="0" min="0"
              style="width:120px;text-align:right;" oninput="recalcQuotTotal()">
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:15px;font-weight:700;border-top:1px solid var(--border-light);padding-top:6px;">
            <span>ยอดสุทธิ</span>
            <span id="quot-total-display" style="color:var(--primary);">฿0</span>
          </div>
        </div>
      </div>

      <button type="button" class="btn btn-primary" style="width:100%;" onclick="submitQuotation()">
        <i class="material-icons-round">save</i> บันทึกใบเสนอราคา
      </button>
    </form>`);
};

function showAddQuotItemModal() {
  openModal('เพิ่มรายการเสนอราคา', `
    <div class="form-group"><label class="form-label">ค้นหาสินค้า</label>
      <input class="form-input" id="qi-search" placeholder="ค้นหา..." oninput="filterQuotItems()"></div>
    <div id="qi-product-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius-md);margin-bottom:12px;">
      ${(products||[]).map(p=>`
        <div class="qi-row" data-name="${p.name.toLowerCase()}"
          style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:0.5px solid var(--border-light);cursor:pointer;" onclick="selectQuotProduct('${p.id}','${p.name.replace(/'/g,"&apos;")}','${p.price}','${p.unit||"ชิ้น"}')">
          <div><strong style="font-size:13px;">${p.name}</strong>
            <span style="font-size:11px;color:var(--text-tertiary);margin-left:6px;">฿${formatNum(p.price)}</span></div>
          <span class="btn btn-outline btn-sm">เลือก</span>
        </div>`).join('')}
      <div class="qi-row" data-name="กำหนดเอง"
        style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;background:var(--bg-base);" onclick="selectQuotProduct('custom','กำหนดเอง','0','ชิ้น')">
        <div><strong style="font-size:13px;">+ กำหนดรายการเอง</strong>
          <span style="font-size:11px;color:var(--text-tertiary);margin-left:6px;">ไม่ต้องเลือกจากสินค้า</span></div>
      </div>
    </div>
    <div id="qi-selected-info" style="display:none;">
      <div class="form-group"><label class="form-label">ชื่อรายการ</label>
        <input class="form-input" id="qi-name"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">จำนวน</label>
          <input class="form-input" type="number" id="qi-qty" value="1" min="1"></div>
        <div class="form-group"><label class="form-label">ราคา/หน่วย</label>
          <input class="form-input" type="number" id="qi-price" min="0"></div>
        <div class="form-group"><label class="form-label">หน่วย</label>
          <input class="form-input" id="qi-unit" value="ชิ้น"></div>
      </div>
      <input type="hidden" id="qi-prod-id">
      <button class="btn btn-primary" style="width:100%;" onclick="addQuotItem()">
        <i class="material-icons-round">add</i> เพิ่มรายการนี้
      </button>
    </div>`);
}
function filterQuotItems() {
  const q = document.getElementById('qi-search')?.value?.toLowerCase()||'';
  document.querySelectorAll('.qi-row').forEach(r => { r.style.display = r.dataset.name?.includes(q)?'':'none'; });
}
function selectQuotProduct(id, name, price, unit) {
  document.getElementById('qi-product-list').closest('.form-group, div')?.previousElementSibling?.classList?.add('hidden');
  document.getElementById('qi-product-list').style.display='none';
  document.getElementById('qi-search').closest('.form-group').style.display='none';
  document.getElementById('qi-selected-info').style.display='block';
  document.getElementById('qi-prod-id').value=id;
  document.getElementById('qi-name').value=id==='custom'?'':name;
  document.getElementById('qi-price').value=price;
  document.getElementById('qi-unit').value=unit;
}
function addQuotItem() {
  const id = document.getElementById('qi-prod-id')?.value;
  const name = document.getElementById('qi-name')?.value?.trim();
  const qty = Number(document.getElementById('qi-qty')?.value||1);
  const price = Number(document.getElementById('qi-price')?.value||0);
  const unit = document.getElementById('qi-unit')?.value||'ชิ้น';
  if (!name||qty<=0) { toast('กรุณากรอกข้อมูล','error'); return; }
  const ex = quotItems.find(x=>x.product_id===id&&id!=='custom');
  if (ex) { ex.qty+=qty; }
  else quotItems.push({product_id:id, name, qty, price, unit});
  renderQuotItems();
  closeModal();
}
function renderQuotItems() {
  const list = document.getElementById('quot-item-list');
  if (!list) return;
  if (quotItems.length===0) {
    list.innerHTML = '<p id="quot-no-items" style="text-align:center;color:var(--text-tertiary);padding:16px;font-size:13px;">ยังไม่มีรายการ</p>';
    recalcQuotTotal(); return;
  }
  list.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:var(--bg-base);">
      <th style="padding:6px 10px;text-align:left;">รายการ</th>
      <th style="padding:6px;text-align:center;">จำนวน</th>
      <th style="padding:6px;text-align:right;">ราคา/หน่วย</th>
      <th style="padding:6px;text-align:right;">รวม</th>
      <th style="padding:6px;"></th>
    </tr></thead>
    <tbody>${quotItems.map((item,idx)=>`
      <tr style="border-bottom:0.5px solid var(--border-light);">
        <td style="padding:8px 10px;"><strong>${item.name}</strong></td>
        <td style="padding:6px;text-align:center;">${item.qty} ${item.unit}</td>
        <td style="padding:6px;text-align:right;">฿${formatNum(item.price)}</td>
        <td style="padding:6px;text-align:right;font-weight:600;">฿${formatNum(item.qty*item.price)}</td>
        <td style="padding:6px;text-align:center;">
          <button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="quotItems.splice(${idx},1);renderQuotItems()">
            <i class="material-icons-round" style="font-size:14px;">close</i>
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
  recalcQuotTotal();
}
function recalcQuotTotal() {
  const sub = quotItems.reduce((s,i)=>s+i.qty*i.price,0);
  const disc = Number(document.getElementById('quot-discount')?.value||0);
  const total = Math.max(0, sub - disc);
  const subEl = document.getElementById('quot-subtotal-display');
  const totEl = document.getElementById('quot-total-display');
  if (subEl) subEl.textContent = `฿${formatNum(sub)}`;
  if (totEl) totEl.textContent = `฿${formatNum(total)}`;
}
async function submitQuotation() {
  const customer = document.getElementById('quot-customer')?.value?.trim();
  if (!customer) { toast('กรุณาระบุชื่อลูกค้า','error'); return; }
  if (quotItems.length===0) { toast('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ','error'); return; }
  const sub = quotItems.reduce((s,i)=>s+i.qty*i.price,0);
  const disc = Number(document.getElementById('quot-discount')?.value||0);
  const total = Math.max(0, sub - disc);
  const valid = document.getElementById('quot-valid')?.value||null;
  const note = document.getElementById('quot-note')?.value||'';
  const {data:quot, error} = await db.from('ใบเสนอราคา').insert({ customer_name:customer, total, discount:disc, valid_until:valid, note, staff_name:USER?.username, status:'รออนุมัติ' }).select().single();
  if (error) { toast('เกิดข้อผิดพลาด: '+error.message,'error'); return; }
  for (const item of quotItems) {
    await db.from('รายการใบเสนอราคา').insert({ quotation_id:quot.id, product_id:item.product_id==='custom'?null:item.product_id, name:item.name, qty:item.qty, price:item.price, total:item.qty*item.price, unit:item.unit });
  }
  toast('สร้างใบเสนอราคาสำเร็จ','success');
  closeModal(); renderQuotations();
}

// ══════════════════════════════════════════════════════════════════
// F. RECEIPT DESIGN v2 — ใบเสร็จสวยงาม 80mm + A4
//    และ override checkout step 4 ให้เลือก format
// ══════════════════════════════════════════════════════════════════

// Override completePayment สำหรับขอเลือก format ก่อนปริ้น
const _origCompleteV2 = window.completePayment;
window.completePayment = async function() {
  // inject format picker ใน step 4 ก่อน
  await _origCompleteV2();
};

// Override printReceipt ใช้ design ใหม่
window.printReceipt = async function(bill, items, format) {
  const rc = await getShopConfig();
  if (!format) {
    const { value: fmt } = await Swal.fire({
      title: 'เลือกรูปแบบใบเสร็จ',
      html: `<div style="display:flex;gap:12px;justify-content:center;padding:8px 0;">
        <button class="swal2-confirm" style="background:#DC2626;padding:14px 24px;font-size:15px;" onclick="Swal.clickConfirm()">
          <div style="font-size:24px;margin-bottom:4px;">🧾</div>80 mm
          <div style="font-size:11px;opacity:.8;">เครื่องพิมพ์ใบเสร็จ</div>
        </button>
        <button class="swal2-deny" style="background:#2563EB;padding:14px 24px;font-size:15px;" onclick="Swal.clickDeny()">
          <div style="font-size:24px;margin-bottom:4px;">📄</div>A4
          <div style="font-size:11px;opacity:.8;">ใบเสร็จเต็ม</div>
        </button>
      </div>`,
      showConfirmButton: false, showDenyButton: false, showCancelButton: true,
      cancelButtonText: 'ยกเลิก',
      didOpen: () => {
        document.querySelector('.swal2-html-container').querySelectorAll('button').forEach(btn => {
          btn.style.cssText += ';border:none;border-radius:12px;cursor:pointer;color:#fff;';
        });
      }
    });
    if (!fmt) return;
    format = fmt;
  }
  if (format === 'A4') printReceiptA4v2(bill, items, rc);
  else print80mmv2(bill, items, rc);
};

function print80mmv2(bill, items, rc) {
  const win = window.open('', '_blank', 'width=380,height=700');
  const rows = (items||[]).map(i =>
    `<tr><td class="name">${i.name}</td><td class="qty">${i.qty}${i.unit||''}</td><td class="amt">฿${formatNum(i.total)}</td></tr>`
  ).join('');
  const pp = rc.promptpay_number ? `<div class="qr-wrap"><img src="https://promptpay.io/${rc.promptpay_number.replace(/[^0-9]/g,'')}.png" class="qr-img"><div class="qr-label">สแกนโอนเงิน</div></div>` : '';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:72mm auto;margin:2mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Sarabun',sans-serif;font-size:11.5px;background:#fff;color:#111;width:72mm;padding:3mm 2mm}
.logo{font-size:18px;font-weight:700;text-align:center;letter-spacing:-0.5px;margin-bottom:1px}
.shop-sub{font-size:10px;text-align:center;color:#666;line-height:1.5;margin-bottom:6px}
.divider{border:none;border-top:1px dashed #aaa;margin:5px 0}
.divider-solid{border:none;border-top:1.5px solid #111;margin:5px 0}
.row-info{display:flex;justify-content:space-between;font-size:10.5px;padding:1.5px 0;color:#444}
.row-info strong{color:#111}
table{width:100%;border-collapse:collapse;margin:4px 0}
thead tr{border-bottom:1px solid #111}
th{font-size:10px;font-weight:600;text-transform:uppercase;padding:3px 2px;text-align:left}
th:last-child{text-align:right}
td{font-size:11px;padding:3px 2px;vertical-align:top}
td.name{width:45%}td.qty{width:18%;text-align:center;color:#555}td.amt{text-align:right;font-weight:600}
.total-section{margin-top:6px}
.total-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0}
.grand-row{display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding:6px 0 4px;border-top:1.5px solid #111;margin-top:4px}
.cash-row{display:flex;justify-content:space-between;font-size:11px;padding:1.5px 0;color:#555}
.method-badge{display:inline-block;background:#111;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-bottom:4px}
.qr-wrap{text-align:center;margin:8px 0 4px}
.qr-img{width:88px;height:88px;border:2px solid #DC2626;border-radius:4px;padding:2px}
.qr-label{font-size:9px;color:#999;margin-top:2px}
.footer-text{font-size:10px;text-align:center;color:#888;margin-top:6px;line-height:1.6;padding-top:4px;border-top:1px dashed #ccc}
.bill-no{font-size:18px;font-weight:700;text-align:right;letter-spacing:1px;color:#DC2626}
</style></head><body>
<div class="logo">${rc.shop_name||'SK POS'}</div>
<div class="shop-sub">${rc.address||''}<br>${rc.phone?'โทร '+rc.phone:''} ${rc.tax_id?'| TAX '+rc.tax_id:''}</div>
${rc.receipt_header?`<div style="text-align:center;font-size:10px;color:#555;margin-bottom:4px;">${rc.receipt_header}</div>`:''}
<hr class="divider">
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:4px;">
  <div><div class="row-info">วันที่ <strong>${new Date(bill.date).toLocaleString('th-TH')}</strong></div>
    <div class="row-info">ลูกค้า <strong>${bill.customer_name||'ทั่วไป'}</strong></div>
    <div class="row-info">พนักงาน <strong>${bill.staff_name||'-'}</strong></div></div>
  <div class="bill-no">#${bill.bill_no}</div>
</div>
<hr class="divider-solid">
<table><thead><tr><th>รายการ</th><th style="text-align:center">จำนวน</th><th style="text-align:right">ราคา</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="total-section">
  ${bill.discount?`<div class="total-row"><span>ส่วนลด</span><span style="color:#DC2626">-฿${formatNum(bill.discount)}</span></div>`:''}
  <div class="grand-row"><span>ยอดสุทธิ</span><span>฿${formatNum(bill.total)}</span></div>
  <div style="text-align:right"><span class="method-badge">${bill.method}</span></div>
  ${bill.method==='เงินสด'?`
    <div class="cash-row"><span>รับมา</span><span>฿${formatNum(bill.received)}</span></div>
    <div class="cash-row" style="font-weight:600;color:#111;"><span>เงินทอน</span><span>฿${formatNum(bill.change)}</span></div>
  `:''}
</div>
${pp}
<div class="footer-text">${rc.receipt_footer||'ขอบคุณที่ใช้บริการ'}<br>${rc.shop_name||''}</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800)}<\/script>
</body></html>`);
  win.document.close();
}

function printReceiptA4v2(bill, items, rc) {
  const win = window.open('', '_blank', 'width=960,height=800');
  const subtotal = (items||[]).reduce((s,i)=>s+i.total,0);
  const cost = (items||[]).reduce((s,i)=>s+(i.cost||0)*i.qty,0);
  const gp = subtotal - cost;
  const rows = (items||[]).map((i,n)=>`
    <tr>
      <td class="num">${n+1}</td>
      <td class="desc"><strong>${i.name}</strong></td>
      <td class="center">${i.qty} ${i.unit||'ชิ้น'}</td>
      <td class="right">฿${formatNum(i.price)}</td>
      <td class="right cost">฿${formatNum(i.cost||0)}</td>
      <td class="right total">฿${formatNum(i.total)}</td>
    </tr>`).join('');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:15mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Sarabun',sans-serif;font-size:13px;color:#111;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #DC2626}
.shop-name{font-size:26px;font-weight:700;color:#DC2626;line-height:1;margin-bottom:6px}
.shop-info{font-size:12px;color:#555;line-height:1.7}
.receipt-badge{background:#DC2626;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:1px;margin-bottom:8px;display:inline-block}
.bill-info{text-align:right;font-size:13px;color:#333;line-height:1.8}
.bill-no{font-size:22px;font-weight:700;color:#DC2626}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;background:#f9f9f9;border-radius:8px;padding:12px 16px}
.meta-item span{font-size:11px;color:#888;display:block}
.meta-item strong{font-size:13px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead th{background:#DC2626;color:#fff;padding:8px 10px;text-align:left;font-size:12px}
thead th.right{text-align:right}thead th.center{text-align:center}
tbody tr:nth-child(even){background:#fef9f9}
tbody tr:hover{background:#fef0f0}
td{padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px}
td.num{width:32px;color:#999;text-align:center}
td.desc{font-weight:500}
td.center{text-align:center;color:#555}
td.right{text-align:right}
td.cost{color:#888}
td.total{font-weight:600;color:#111}
.summary{margin-left:auto;width:280px}
.sum-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:13px}
.sum-row.highlight{background:#fef9f9;padding:5px 8px;border-radius:4px;margin:2px 0}
.sum-row.gp span:last-child{color:#059669;font-weight:600}
.grand-row{display:flex;justify-content:space-between;font-size:17px;font-weight:700;color:#DC2626;border-top:2.5px solid #DC2626;border-bottom:2.5px solid #DC2626;padding:8px 0;margin-top:4px}
.method-chip{display:inline-block;background:#DC2626;color:#fff;font-size:11px;padding:3px 8px;border-radius:3px;margin-bottom:6px}
.footer{margin-top:24px;padding-top:12px;border-top:1px dashed #ccc;display:flex;justify-content:space-between;font-size:11px;color:#999}
</style></head><body>
<div class="header">
  <div>
    <div class="shop-name">${rc.shop_name||'SK POS'}</div>
    <div class="shop-info">
      ${rc.address||''}<br>
      ${rc.phone?`โทร ${rc.phone}`:''}${rc.tax_id?` &nbsp;|&nbsp; เลขผู้เสียภาษี ${rc.tax_id}`:''}<br>
      ${rc.email?`อีเมล ${rc.email}`:''}
    </div>
  </div>
  <div style="text-align:right;">
    <div class="receipt-badge">ใบเสร็จรับเงิน</div>
    <div class="bill-info">
      <div class="bill-no">เลขที่ #${bill.bill_no}</div>
      <div>${new Date(bill.date).toLocaleString('th-TH',{dateStyle:'full',timeStyle:'short'})}</div>
    </div>
  </div>
</div>

<div class="meta-grid">
  <div class="meta-item"><span>ลูกค้า</span><strong>${bill.customer_name||'ลูกค้าทั่วไป'}</strong></div>
  <div class="meta-item"><span>พนักงาน</span><strong>${bill.staff_name||'-'}</strong></div>
  <div class="meta-item"><span>วิธีชำระ</span><strong>${bill.method}</strong></div>
  <div class="meta-item"><span>สถานะ</span><strong style="color:${bill.status==='สำเร็จ'?'#059669':'#DC2626'}">${bill.status}</strong></div>
</div>

<table>
  <thead><tr>
    <th class="num">#</th>
    <th>รายการสินค้า</th>
    <th class="center">จำนวน</th>
    <th class="right">ราคา/หน่วย</th>
    <th class="right">ต้นทุน</th>
    <th class="right">ยอดรวม</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="summary">
  <div class="sum-row"><span>ยอดรวม</span><span>฿${formatNum(subtotal)}</span></div>
  ${cost>0?`<div class="sum-row gp"><span>ต้นทุนรวม</span><span>฿${formatNum(cost)}</span></div>
  <div class="sum-row gp"><span>กำไรขั้นต้น</span><span>฿${formatNum(gp)} (${subtotal>0?Math.round(gp/subtotal*100):0}%)</span></div>`:''}
  ${bill.discount?`<div class="sum-row"><span>ส่วนลด</span><span style="color:#DC2626">-฿${formatNum(bill.discount)}</span></div>`:''}
  <div class="grand-row"><span>ยอดสุทธิ</span><span>฿${formatNum(bill.total)}</span></div>
  <div style="margin-top:8px;"><span class="method-chip">${bill.method}</span></div>
  ${bill.method==='เงินสด'?`
    <div class="sum-row"><span>รับมา</span><span>฿${formatNum(bill.received)}</span></div>
    <div class="sum-row"><span>เงินทอน</span><span style="font-weight:600">฿${formatNum(bill.change)}</span></div>
  `:''}
  ${rc.promptpay_number?`<div style="margin-top:10px;text-align:center;"><img src="https://promptpay.io/${rc.promptpay_number.replace(/[^0-9]/g,'')}.png" style="width:100px;height:100px;border:2px solid #DC2626;border-radius:4px;padding:2px;"><div style="font-size:10px;color:#999;margin-top:3px;">สแกนโอนเงิน</div></div>`:''}
</div>

<div class="footer">
  <span>${rc.receipt_footer||'ขอบคุณที่ใช้บริการ'}</span>
  <span>พิมพ์โดย ${bill.staff_name||''} | ${new Date().toLocaleString('th-TH')}</span>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`);
  win.document.close();
}

// Override sales history ให้เลือก format ตอนปริ้นซ้ำ
window.printBillFromHistory = async function(billId) {
  const {data:bill} = await db.from('บิลขาย').select('*').eq('id',billId).single();
  const {data:items} = await db.from('รายการในบิล').select('*').eq('bill_id',billId);
  if (bill) printReceipt(bill, items||[], null);
};

// ══════════════════════════════════════════════════════════════════
// G. ATT — เพิ่มปุ่มเบิกเงินในตาราง + override renderAttendance
// ══════════════════════════════════════════════════════════════════

// override renderAttendance ให้มีปุ่มเบิกเงิน
window.renderAttendance = async function() {
  const section = document.getElementById('page-att');
  if (!section) return;
  const today = new Date().toISOString().split('T')[0];
  const emps = await loadEmployees();
  const active = emps.filter(e=>e.status==='ทำงาน');
  const {data:attToday} = await db.from('เช็คชื่อ').select('*').eq('date',today);
  const attMap = {};
  (attToday||[]).forEach(a=>{attMap[a.employee_id]=a;});
  const statCounts={};
  Object.keys(ATT_STATUS).forEach(k=>{statCounts[k]=0;});
  Object.values(attMap).forEach(a=>{if(statCounts[a.status]!==undefined)statCounts[a.status]++;});

  // คำนวณยอดเบิกวันนี้ต่อคน
  const {data:todayAdv} = await db.from('เบิกเงิน').select('*').gte('date',today+'T00:00:00').eq('status','อนุมัติ');
  const advMap={};
  (todayAdv||[]).forEach(a=>{ advMap[a.employee_id]=(advMap[a.employee_id]||0)+a.amount; });

  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <div>
          <h3 style="font-size:15px;font-weight:600;">เช็คชื่อ — ${new Date().toLocaleDateString('th-TH',{dateStyle:'full'})}</h3>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
            ${Object.entries(ATT_STATUS).map(([k,v])=>`<span class="badge" style="background:${v.color}22;color:${v.color};">${v.label} ${statCounts[k]}</span>`).join('')}
            <span class="badge badge-warning">ยังไม่ลง ${active.length-Object.keys(attMap).length}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-outline" onclick="showAttDatePicker()"><i class="material-icons-round">calendar_today</i> ย้อนหลัง</button>
          <button class="btn btn-outline" onclick="renderPayroll()"><i class="material-icons-round">account_balance_wallet</i> จ่ายเงินเดือน</button>
          <button class="btn btn-primary" onclick="showEmployeeModal()"><i class="material-icons-round">person_add</i> เพิ่มพนักงาน</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>พนักงาน</th><th>ตำแหน่ง</th>
            <th class="text-right">ค่าจ้าง/วัน</th>
            <th>สถานะ</th><th>เวลาเข้า</th><th>เวลาออก</th>
            <th class="text-right">หัก</th>
            <th class="text-right">เบิกวันนี้</th>
            <th>จัดการ</th>
          </tr></thead>
          <tbody>
            ${active.map(emp=>{
              const att = attMap[emp.id];
              const wage = emp.daily_wage||0;
              const deduct = att ? Math.round(wage*(ATT_STATUS[att.status]?.deductPct||0)/100) : 0;
              const todayAdvAmt = advMap[emp.id]||0;
              return `<tr>
                <td><strong>${emp.name} ${emp.lastname||''}</strong>
                  <div style="font-size:11px;color:var(--text-tertiary);">${emp.phone||''}</div></td>
                <td>${emp.position}</td>
                <td class="text-right">฿${formatNum(wage)}</td>
                <td>${att
                  ?`<span class="badge" style="background:${ATT_STATUS[att.status]?.color||'#888'}22;color:${ATT_STATUS[att.status]?.color||'#888'}">${att.status}</span>`
                  :'<span class="badge badge-warning">ยังไม่ลง</span>'}</td>
                <td>${att?.time_in||'-'}</td>
                <td>${att?.time_out||'-'}</td>
                <td class="text-right" style="color:var(--danger)">${deduct>0?`-฿${formatNum(deduct)}`:'-'}</td>
                <td class="text-right" style="color:${todayAdvAmt>0?'var(--warning)':'var(--text-tertiary)'}">
                  ${todayAdvAmt>0?`฿${formatNum(todayAdvAmt)}`:'-'}
                </td>
                <td>
                  <div class="table-actions">
                    ${!att
                      ?`<button class="btn btn-primary btn-sm" onclick="showCheckInModal('${emp.id}','${emp.name}')">ลงชื่อ</button>`
                      :`${!att.time_out?`<button class="btn btn-outline btn-sm" onclick="checkOutEmp('${att.id}')">ออกงาน</button>`:''}<button class="btn btn-ghost btn-icon" onclick="showEditAttModal('${att.id}','${emp.id}','${emp.name}')"><i class="material-icons-round">edit</i></button>`}
                    <button class="btn btn-ghost btn-icon" style="color:var(--warning)" title="เบิกเงิน" onclick="openAdvanceWizard('${emp.id}','${emp.name}')">
                      <i class="material-icons-round">payments</i>
                    </button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
};

// Wrapper ใช้ wizard ใหม่สำหรับเบิกเงิน
async function openAdvanceWizard(empId, empName) {
  const cashBal = await getLiveCashBalance();
  const {value: amount} = await Swal.fire({
    title:`เบิกเงิน: ${empName}`,
    html:`<div style="font-size:13px;color:#555;margin-bottom:8px;">เงินในลิ้นชัง: <strong>฿${formatNum(cashBal)}</strong></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div><label style="font-size:12px;color:#555;display:block;margin-bottom:4px;">จำนวน (บาท)</label>
              <input type="number" id="adv-swal-amount" class="swal2-input" min="1" max="${cashBal}" placeholder="0" style="margin:0;width:100%"></div>
            <div><label style="font-size:12px;color:#555;display:block;margin-bottom:4px;">วิธีจ่าย</label>
              <select id="adv-swal-method" class="swal2-input" style="margin:0;width:100%">
                <option value="เงินสด">เงินสด</option>
                <option value="โอนเงิน">โอนเงิน</option>
              </select></div>
          </div>
          <div style="margin-top:10px;"><label style="font-size:12px;color:#555;display:block;margin-bottom:4px;">เหตุผล</label>
            <input type="text" id="adv-swal-reason" class="swal2-input" placeholder="ระบุเหตุผล" style="margin:0;width:100%"></div>`,
    showCancelButton:true, confirmButtonText:'ดำเนินการ', cancelButtonText:'ยกเลิก', confirmButtonColor:'#DC2626',
    preConfirm: () => {
      const a = Number(document.getElementById('adv-swal-amount')?.value||0);
      if (!a||a<=0) { Swal.showValidationMessage('กรุณาระบุจำนวน'); return false; }
      if (a > cashBal) { Swal.showValidationMessage(`เงินในลิ้นชักไม่พอ (มีอยู่ ฿${formatNum(cashBal)})`); return false; }
      return { amount:a, method:document.getElementById('adv-swal-method')?.value||'เงินสด', reason:document.getElementById('adv-swal-reason')?.value||'' };
    }
  });
  if (!amount) return;
  const { amount: amt, method, reason } = amount;
  if (method === 'เงินสด') {
    openDenomWizard({
      label:`เบิกเงิน: ${empName}`,
      targetAmount: amt,
      mustExact: true,
      onConfirm: async (denomState, total) => {
        await _doAdvance(empId, amt, method, reason, denomState);
      },
      onCancel: () => {}
    });
  } else {
    await _doAdvance(empId, amt, method, reason, null);
  }
}

async function _doAdvance(empId, amount, method, reason, denomState) {
  await db.from('เบิกเงิน').insert({ employee_id:empId, amount, method, reason, approved_by:USER?.username, status:'อนุมัติ' });
  if (method==='เงินสด') {
    const {data:sess} = await db.from('cash_session').select('id').eq('status','open').limit(1).single();
    if (sess) await recordCashTx({ sessionId:sess.id, type:'เบิกเงินพนักงาน', direction:'out', amount, netAmount:amount, denominations:denomState, note:reason });
  }
  toast(`เบิกเงิน ฿${formatNum(amount)} สำเร็จ`,'success');
  logActivity('เบิกเงินพนักงาน',`฿${formatNum(amount)} | ${reason}`);
  renderAttendance();
}

// ══════════════════════════════════════════════════════════════════
// H. OVERRIDE CASH WIZARD ใน modules.js ให้ใช้ openDenomWizard
// ══════════════════════════════════════════════════════════════════

// override cashMovementWithDenom ให้ใช้ wizard ใหม่
window.cashMovementWithDenom = async function(type, session, currentBalance) {
  if (!session) { toast('กรุณาเปิดรอบก่อน','warning'); return; }
  const isAdd = type==='add';
  const {value: info} = await Swal.fire({
    title: isAdd?'เพิ่มเงินเข้าลิ้นชัก':'เบิกเงินออก',
    html: `${!isAdd?`<div style="padding:8px;background:#FFFBEB;border-radius:6px;margin-bottom:8px;font-size:13px;color:#B45309;">เงินปัจจุบัน: <strong>฿${formatNum(currentBalance||0)}</strong></div>`:''}
      <input type="text" id="cmv-note" class="swal2-input" placeholder="หมายเหตุ" style="margin:0;width:100%">`,
    showCancelButton:true, confirmButtonText:'ไปนับแบงค์', cancelButtonText:'ยกเลิก', confirmButtonColor:'#DC2626',
    preConfirm: () => document.getElementById('cmv-note')?.value||''
  });
  if (info === undefined) return;
  openDenomWizard({
    label: isAdd?'เพิ่มเงินเข้าลิ้นชัก':'เบิกเงินออก',
    targetAmount: 0,
    mustExact: false,
    onConfirm: async (denomState, total) => {
      if (!isAdd && total > (currentBalance||0)) {
        toast(`เงินไม่พอ! มีอยู่ ฿${formatNum(currentBalance)}`,'error'); return;
      }
      await recordCashTx({ sessionId:session.id, type:isAdd?'เพิ่มเงิน':'เบิกเงิน', direction:isAdd?'in':'out', amount:total, netAmount:total, denominations:denomState, note:info });
      toast(isAdd?'เพิ่มเงินสำเร็จ':'เบิกเงินสำเร็จ','success');
      logActivity(isAdd?'เพิ่มเงินลิ้นชัก':'เบิกเงินลิ้นชัก',`฿${formatNum(total)} | ${info}`);
      renderCashDrawer();
    },
    onCancel: () => {}
  });
};

// override closeCashSessionWithCount ให้ใช้ wizard ใหม่
window.closeCashSessionWithCount = async function(session, expectedBalance) {
  openDenomWizard({
    label: 'ปิดรอบ — นับยอดจริง',
    targetAmount: expectedBalance,
    mustExact: false,
    onConfirm: async (denomState, counted) => {
      const diff = counted - expectedBalance;
      const {isConfirmed} = await Swal.fire({
        icon: diff===0?'success':diff>0?'warning':'error',
        title: diff===0?'ยอดตรง!':diff>0?`เงินเกิน ฿${formatNum(diff)}`:`เงินขาด ฿${formatNum(Math.abs(diff))}`,
        text:`นับได้ ฿${formatNum(counted)} | คาด ฿${formatNum(expectedBalance)}`,
        showCancelButton:true, confirmButtonText:'ยืนยันปิดรอบ', cancelButtonText:'ยกเลิก'
      });
      if (!isConfirmed) return;
      await db.from('cash_session').update({
        status:'closed', closed_at:new Date().toISOString(), closed_by:USER?.username,
        closing_amt:counted, expected_amt:expectedBalance, diff_amt:diff,
        denominations:denomState
      }).eq('id',session.id);
      toast('ปิดรอบสำเร็จ','success');
      logActivity('ปิดรอบเงินสด',`นับ ฿${formatNum(counted)} คาด ฿${formatNum(expectedBalance)} ต่าง ฿${formatNum(diff)}`);
      renderCashDrawer(); loadCashBalance();
    },
    onCancel: () => {}
  });
};

// override submitExpense ให้ใช้ wizard
window.showAddExpenseModal = function() {
  openModal('บันทึกรายจ่าย', `
    <form id="expense-form" onsubmit="event.preventDefault();">
      <div class="form-group"><label class="form-label">รายการ *</label><input class="form-input" id="exp-desc" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">หมวดหมู่</label>
          <select class="form-input" id="exp-cat">
            <option>ทั่วไป</option><option>ค่าสาธารณูปโภค</option>
            <option>ค่าขนส่ง</option><option>ค่าซ่อมบำรุง</option>
            <option>ค่าจ้างแรงงาน</option><option>อื่นๆ</option>
          </select></div>
        <div class="form-group"><label class="form-label">วิธีชำระ</label>
          <select class="form-input" id="exp-method">
            <option value="เงินสด">เงินสด</option>
            <option value="โอนเงิน">โอนเงิน</option>
            <option value="บัตรเครดิต">บัตรเครดิต</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">จำนวน (บาท) *</label>
        <input class="form-input" type="number" id="exp-amount" min="1" required></div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="exp-note"></div>
      <button type="button" class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="processExpenseV2()">
        <i class="material-icons-round">save</i> ดำเนินการ
      </button>
    </form>`);
};

async function processExpenseV2() {
  const desc = document.getElementById('exp-desc')?.value?.trim();
  const amount = Number(document.getElementById('exp-amount')?.value||0);
  const method = document.getElementById('exp-method')?.value;
  const cat = document.getElementById('exp-cat')?.value;
  const note = document.getElementById('exp-note')?.value||'';
  if (!desc||amount<=0) { toast('กรุณากรอกข้อมูลให้ครบ','error'); return; }
  if (method==='เงินสด') {
    try { await assertCashEnough(amount,'จ่ายรายจ่าย'); } catch(e) {
      Swal.fire({icon:'error',title:'เงินในลิ้นชักไม่พอ',text:e.message}); return;
    }
    closeModal();
    openDenomWizard({
      label:`จ่ายค่า ${desc}`,
      targetAmount: amount,
      mustExact: false,
      onConfirm: async (denomState, paid) => {
        const change = paid - amount;
        // ถ้ามีเงินทอน ต้องตรวจว่ามีพอ
        if (change > 0) {
          try { await assertCashEnough(change,'ทอนเงิน'); } catch(e) {
            Swal.fire({icon:'error',title:'เงินทอนในลิ้นชักไม่พอ',text:e.message}); return;
          }
        }
        await _saveExpense(desc, amount, method, cat, note, denomState, change, paid);
      },
      onCancel: () => {}
    });
  } else {
    closeModal();
    await _saveExpense(desc, amount, method, cat, note, null, 0, amount);
  }
}

async function _saveExpense(desc, amount, method, cat, note, denomState, change, paid) {
  const {data:exp} = await db.from('รายจ่าย').insert({
    description:desc, amount, method, category:cat, note,
    staff_name:USER?.username, date:new Date().toISOString(),
    denominations:denomState
  }).select().single();
  if (method==='เงินสด') {
    const {data:sess} = await db.from('cash_session').select('id').eq('status','open').limit(1).single();
    if (sess) await recordCashTx({ sessionId:sess.id, type:'รายจ่าย', direction:'out', amount:paid, changeAmt:change, netAmount:amount, refId:exp?.id, refTable:'รายจ่าย', denominations:denomState, note:desc });
  }
  toast(`บันทึกรายจ่าย ฿${formatNum(amount)} สำเร็จ`,'success');
  logActivity('บันทึกรายจ่าย',`${desc} ฿${formatNum(amount)}`);
  if (typeof loadExpenseData==='function') loadExpenseData();
}

console.log('[SK POS modules-v2.js] ✅ All v2 patches loaded');
