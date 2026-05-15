/**
 * SK POS — modules-v25-quotation.js
 * ████████████████████████████████████████████████████████████████████
 *  1. ระบบใบเสนอราคาครบวงจร (Dummy Product + สินค้านอกระบบ)
 *  2. Override v9PrintQuotation → ใช้ v24 template (ใบเสนอราคา)
 *  3. Override v12DQPrintNote → ใช้ v24 template (ใบส่งของ) สวยงาม
 *  4. ซ่อนสินค้าระบบจากหน้า POS/คลัง
 *  5. แปลงใบเสนอราคาเป็นบิลขาย (skip stock dummy)
 * ████████████████████████████████████████████████████████████████████
 */
'use strict';

/* ═══════════════════════════════════════════════
   1. DUMMY PRODUCT — ใส่ UUID ของสินค้าจำลองที่สร้างไว้
═══════════════════════════════════════════════ */
// TODO: เปลี่ยน UUID นี้เป็น ID จริงของสินค้า "สินค้านอกระบบ" ที่สร้างใน Supabase
const DUMMY_PRODUCT_ID = '00000000-0000-0000-0000-000000000000';
const _v25Esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function v25InstallQuoteStyles() {
  if (document.getElementById('v25-quote-polish-style')) return;
  const s = document.createElement('style');
  s.id = 'v25-quote-polish-style';
  s.textContent = `
    .modal-box.v25quote-modal{max-width:1120px!important;width:min(1120px,94vw)!important;border-radius:26px!important;overflow:hidden!important;background:#f8fafc!important;padding:0!important}
    .modal-box.v25quote-modal .modal-header{padding:22px 26px!important;background:#fff!important;border-bottom:1px solid #e2e8f0!important}
    .modal-box.v25quote-modal .modal-header h3{font-size:24px!important;font-weight:950!important;color:#0f172a!important}
    .modal-box.v25quote-modal .modal-body{padding:0!important;max-height:min(78vh,820px)!important;overflow:auto!important;background:#f8fafc!important}
    .modal-box:has(#v25quote-shell){max-width:1120px;width:min(1120px,94vw);border-radius:26px;overflow:hidden;background:#f8fafc}
    .modal-box:has(#v25quote-shell) .modal-header{padding:22px 26px;background:#fff;border-bottom:1px solid #e2e8f0}
    .modal-box:has(#v25quote-shell) .modal-header h3{font-size:24px;font-weight:950;color:#0f172a}
    .modal-box:has(#v25quote-shell) .modal-body{padding:0;max-height:min(78vh,820px);overflow:auto;background:#f8fafc}
    #v25quote-shell{font-family:var(--font-thai,'Prompt'),sans-serif;color:#0f172a}
    .v25q-wrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;padding:22px}
    .v25q-main,.v25q-side{display:grid;gap:14px;align-content:start}
    .v25q-panel{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 14px 34px rgba(15,23,42,.06)}
    .v25q-panel.inset{padding:16px}.v25q-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .v25q-title{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:950;color:#172033}.v25q-title i{font-size:20px;color:#ef4444}
    .v25q-grid2{display:grid;grid-template-columns:1fr 220px;gap:12px}
    .v25q-field label{display:block;font-size:12px;font-weight:900;color:#475569;margin-bottom:7px}
    .v25q-input{width:100%;height:48px;border:1.5px solid #cbd5e1;border-radius:13px;background:#fff;padding:0 14px;font:850 14px var(--font-thai,'Prompt'),sans-serif;color:#0f172a;outline:none;box-sizing:border-box}
    .v25q-input:focus{border-color:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.1)}
    .v25q-picker{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start}
    .v25q-searchbox{position:relative}.v25q-searchbox i{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:19px;color:#94a3b8;pointer-events:none}
    .v25q-searchbox .v25q-input{padding-left:44px;height:52px}
    .v25q-custom-btn{height:52px;border:0;border-radius:14px;background:#f59e0b;color:#fff;padding:0 18px;font:950 13px var(--font-thai,'Prompt'),sans-serif;display:inline-flex;align-items:center;gap:7px;cursor:pointer;box-shadow:0 10px 24px rgba(245,158,11,.22)}
    .v25q-custom-btn:hover{background:#d97706}.v25q-custom-btn i{font-size:18px}
    #v25q-dropdown{display:none;position:absolute;top:calc(100% + 8px);left:0;right:0;background:#fff;border:1px solid #dbe3ec;border-radius:16px;box-shadow:0 22px 55px rgba(15,23,42,.18);z-index:10000;max-height:330px;overflow-y:auto;padding:6px}
    .v25q-drop-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;cursor:pointer;border-radius:12px;transition:background .12s}
    .v25q-drop-item:hover{background:#f8fafc}.v25q-drop-name{font-size:13px;font-weight:950;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v25q-drop-meta{font-size:10px;color:#94a3b8;margin-top:3px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.v25q-chip{background:#f1f5f9;border-radius:999px;padding:2px 7px;color:#64748b;font-weight:800}
    .v25q-table{overflow:hidden}.v25q-table-head,.v25q-row{display:grid;grid-template-columns:minmax(220px,1fr) 92px 86px 122px 118px 40px;gap:8px;align-items:center}
    .v25q-table-head{padding:11px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:950;color:#64748b}
    #v25q-items{min-height:190px;max-height:360px;overflow:auto;padding:10px 14px;display:grid;gap:8px}
    .v25q-row{padding:10px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}
    .v25q-row.custom{border-color:#fde68a;background:#fffbeb}.v25q-row input{height:38px;border:1px solid #dbe3ec;border-radius:10px;background:#fff;padding:0 10px;font:850 12px var(--font-thai,'Prompt'),sans-serif;color:#0f172a;min-width:0}
    .v25q-row input:focus{outline:none;border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.08)}
    .v25q-namecell{display:flex;align-items:center;gap:8px;min-width:0}.v25q-namecell input{flex:1}.v25q-badge{font-size:10px;font-weight:950;border-radius:999px;padding:4px 8px;white-space:nowrap;background:#fee2e2;color:#b91c1c}.v25q-badge.custom{background:#fef3c7;color:#92400e}
    .v25q-line-total{text-align:right;font-size:14px;font-weight:950;color:#0f172a}.v25q-remove{width:36px;height:36px;border:1px solid #fecaca;border-radius:11px;background:#fff;color:#dc2626;display:grid;place-items:center;cursor:pointer}.v25q-remove:hover{background:#fff1f2}
    .v25q-empty{min-height:154px;border:2px dashed #dbe3ec;border-radius:16px;display:grid;place-items:center;text-align:center;color:#94a3b8;font-size:13px;font-weight:850;background:#fbfdff}.v25q-empty i{font-size:36px;color:#cbd5e1;margin-bottom:8px}
    .v25q-summary{position:sticky;top:14px}.v25q-total-card{padding:18px;background:linear-gradient(135deg,#111827,#334155);border-radius:20px;color:#fff;box-shadow:0 18px 38px rgba(15,23,42,.2)}
    .v25q-total-card span{display:block;font-size:12px;font-weight:800;color:#cbd5e1}.v25q-total-card b{display:block;margin-top:6px;font-size:38px;line-height:1;color:#fff}
    .v25q-sumline{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:850;color:#475569}.v25q-sumline b{color:#0f172a}
    .v25q-note{resize:vertical;min-height:86px;padding-top:12px;line-height:1.45}
    .v25q-save{height:56px;width:100%;border:0;border-radius:16px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font:950 15px var(--font-thai,'Prompt'),sans-serif;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;box-shadow:0 16px 34px rgba(220,38,38,.22)}
    .v25q-save:hover{filter:brightness(.98);transform:translateY(-1px)}.v25q-save i{font-size:22px}
    .v25custom-popup{border-radius:22px!important;padding:0!important;overflow:hidden!important}
    .v25custom-popup .swal2-title{font:950 28px var(--font-thai,'Prompt'),sans-serif!important;color:#0f172a!important;padding:28px 28px 0!important}
    .v25custom-popup .swal2-html-container{margin:18px 28px 6px!important}
    .v25custom-form{text-align:left;display:grid;gap:14px}.v25custom-form label{display:block;font-size:12px;font-weight:950;color:#475569;margin-bottom:7px}
    .v25custom-form input{width:100%;height:50px;border:1.5px solid #cbd5e1;border-radius:13px;background:#fff;padding:0 14px;font:850 16px var(--font-thai,'Prompt'),sans-serif;color:#0f172a;box-sizing:border-box;outline:none}
    .v25custom-form input:focus{border-color:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.1)}
    .v25custom-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.v25custom-hint{border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:13px;padding:10px 12px;font-size:12px;font-weight:850}
    .v25qc-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(8px);z-index:9998;display:flex;align-items:center;justify-content:center;padding:18px}
    .v25qc-modal{width:min(900px,96vw);max-height:90vh;overflow:hidden;background:#fff;border-radius:26px;box-shadow:0 28px 80px rgba(15,23,42,.28);display:flex;flex-direction:column}
    .v25qc-progress{display:grid;grid-template-columns:1fr 44px 1fr 44px 1fr;gap:10px;align-items:center;padding:22px 26px;border-bottom:1px solid #e2e8f0;background:#f8fafc}
    .v25qc-step{display:flex;align-items:center;gap:9px;color:#94a3b8;font-weight:950;font-size:13px}.v25qc-step .num{width:30px;height:30px;border-radius:999px;background:#e2e8f0;color:#64748b;display:grid;place-items:center}
    .v25qc-step.active{color:#dc2626}.v25qc-step.active .num{background:#dc2626;color:#fff}.v25qc-step.done{color:#16a34a}.v25qc-step.done .num{background:#dcfce7;color:#15803d}
    .v25qc-line{height:2px;background:#e2e8f0}.v25qc-body{padding:22px 26px;overflow:auto;display:grid;gap:16px}.v25qc-title{font-size:22px;font-weight:950;color:#0f172a;display:flex;align-items:center;gap:10px}.v25qc-title i{color:#dc2626}
    .v25qc-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.v25qc-card{border:1px solid #e2e8f0;border-radius:18px;background:#fff;padding:16px}.v25qc-card.soft{background:#f8fafc}.v25qc-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #edf2f7;font-size:13px;color:#64748b;font-weight:850}.v25qc-row:last-child{border-bottom:0}.v25qc-row b{color:#0f172a}.v25qc-total{font-size:34px;font-weight:950;color:#dc2626;line-height:1}
    .v25qc-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v25qc-opt{border:2px solid #e2e8f0;border-radius:16px;background:#fff;padding:14px 10px;cursor:pointer;text-align:center;font:900 13px var(--font-thai,'Prompt'),sans-serif;color:#334155}.v25qc-opt i{display:block;font-size:26px;margin-bottom:6px;color:#94a3b8}.v25qc-opt.active{border-color:#dc2626;background:#fff1f2;color:#b91c1c}.v25qc-opt.active i{color:#dc2626}
    .v25qc-hint{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:14px;padding:12px 14px;font-size:13px;font-weight:850;line-height:1.55}
    .v25qc-footer{display:flex;justify-content:space-between;gap:10px;padding:16px 26px;border-top:1px solid #e2e8f0;background:#fff}.v25qc-btn{height:46px;border-radius:14px;border:1px solid #cbd5e1;background:#fff;color:#334155;padding:0 18px;font:950 13px var(--font-thai,'Prompt'),sans-serif;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.v25qc-btn.primary{border:0;background:#dc2626;color:#fff}.v25qc-btn:disabled{opacity:.45;cursor:not-allowed}
    @media(max-width:900px){.v25q-wrap{grid-template-columns:1fr}.v25q-grid2,.v25q-picker{grid-template-columns:1fr}.v25q-table-head{display:none}.v25q-row{grid-template-columns:1fr 1fr}.v25q-namecell,.v25q-line-total{grid-column:1/-1}.v25q-summary{position:static}}
    @media(max-width:640px){.v25custom-grid,.v25qc-grid,.v25qc-options{grid-template-columns:1fr}.v25qc-progress{grid-template-columns:1fr}.v25qc-line{display:none}}
  `;
  document.head.appendChild(s);
}

if (!window.__v25QuoteCloseWrapped) {
  window.__v25QuoteCloseWrapped = true;
  const _v25CloseModal = window.closeModal;
  window.closeModal = function () {
    document.querySelector('#modal-overlay .modal-box')?.classList.remove('v25quote-modal');
    return _v25CloseModal?.apply(this, arguments);
  };
}

/* ═══════════════════════════════════════════════
   2. ซ่อนสินค้า product_type='ระบบ' จากหน้า POS/คลัง
      — override loadProducts เพื่อ filter ออก
      — ไม่กระทบ query by ID โดยตรง
═══════════════════════════════════════════════ */
const _v25OrigLoadProducts = window.loadProducts;
window.loadProducts = async function () {
  await _v25OrigLoadProducts?.apply(this, arguments);
  // กรองสินค้า product_type='ระบบ' ออกจาก products array
  if (typeof products !== 'undefined' && Array.isArray(products)) {
    products = products.filter(p => p.product_type !== 'ระบบ');
    // sync cache
    try { window._v9ProductsCache = products; } catch (_) { }
  }
};

/* ═══════════════════════════════════════════════
   3. Override v9ShowQuotModal — ใบเสนอราคา + สินค้านอกระบบ
      — ยกเลิกเช็ค stock <= 0
      — เพิ่มปุ่ม "+ สินค้านอกระบบ" (custom)
      — เพิ่ม flag isCustom: true
═══════════════════════════════════════════════ */
window._v25QuotItems = [];

window.v9ShowQuotModal = async function () {
  window._v25QuotItems = [];
  if (typeof openModal !== 'function') return;
  v25InstallQuoteStyles();

  await loadProducts?.();
  // โหลดสินค้าทั้งหมด (ไม่จำกัด stock) สำหรับ dropdown
  let quotProds = [];
  try {
    const { data } = await db.from('สินค้า').select('*')
      .neq('product_type', 'ระบบ')  // ซ่อน dummy
      .order('name');
    quotProds = data || [];
  } catch (_) {
    quotProds = (typeof products !== 'undefined' ? products : []);
  }

  const _render = () => {
    const el = document.getElementById('v25q-items');
    if (!el) return;
    if (!window._v25QuotItems.length) {
      el.innerHTML = `<div class="v25q-empty"><div><i class="material-icons-round">add_shopping_cart</i><div>ค้นหาสินค้าด้านบน หรือเพิ่มรายการนอกระบบ</div><small>รายการนอกระบบใช้ในใบเสนอราคาเท่านั้น ไม่เพิ่มสต็อกเข้าร้าน</small></div></div>`;
      _calcTotal();
      return;
    }
    el.innerHTML = window._v25QuotItems.map((it, i) => `
      <div class="v25q-row ${it.isCustom ? 'custom' : ''}">
        <div class="v25q-namecell">
          <span class="v25q-badge ${it.isCustom ? 'custom' : ''}">${it.isCustom ? 'นอกระบบ' : 'ในคลัง'}</span>
          <input value="${_v25Esc(it.name)}" placeholder="ชื่อสินค้า / บริการ"
            oninput="window._v25QuotItems[${i}].name=this.value;window._v25CalcTotal()">
        </div>
        <input type="number" value="${it.qty}" min="0.01" step="any"
          style="text-align:center"
          oninput="window._v25QuotItems[${i}].qty=parseFloat(this.value||1);window._v25CalcTotal()">
        <input value="${_v25Esc(it.unit)}" placeholder="หน่วย" style="text-align:center"
          oninput="window._v25QuotItems[${i}].unit=this.value">
        <input type="number" value="${it.price}" min="0" step="any"
          style="text-align:right"
          oninput="window._v25QuotItems[${i}].price=parseFloat(this.value||0);window._v25CalcTotal()">
        <div class="v25q-line-total" id="v25q-line-${i}">฿${_fmt((it.qty || 0) * (it.price || 0))}</div>
        <button class="v25q-remove" onclick="window._v25QuotItems.splice(${i},1);window._v25RenderItems()" title="ลบรายการ">
          <i class="material-icons-round" style="font-size:18px">close</i>
        </button>
      </div>`).join('');
    _calcTotal();
  };

  const _calcTotal = () => {
    const sub = (window._v25QuotItems || []).reduce((s, i) => s + (i.qty * i.price), 0);
    const disc = parseFloat(document.getElementById('v25q-disc')?.value || 0);
    const tot = Math.max(0, sub - disc);
    const el = document.getElementById('v25q-total');
    if (el) el.textContent = `฿${typeof formatNum === 'function' ? formatNum(Math.round(tot)) : tot.toFixed(2)}`;
    const subEl = document.getElementById('v25q-subtotal');
    const discEl = document.getElementById('v25q-disc-show');
    const countEl = document.getElementById('v25q-count');
    if (subEl) subEl.textContent = `฿${_fmt(sub)}`;
    if (discEl) discEl.textContent = `฿${_fmt(disc)}`;
    if (countEl) countEl.textContent = `${(window._v25QuotItems || []).length} รายการ`;
    (window._v25QuotItems || []).forEach((it, i) => {
      const line = document.getElementById(`v25q-line-${i}`);
      if (line) line.textContent = `฿${_fmt((it.qty || 0) * (it.price || 0))}`;
    });
  };

  window._v25RenderItems = _render;
  window._v25CalcTotal = _calcTotal;

  // เพิ่มสินค้าจากคลัง (ไม่เช็ค stock)
  window._v25AddFromStock = (prodId) => {
    const prod = quotProds.find(p => p.id === prodId);
    if (!prod) return;
    window._v25QuotItems.push({
      product_id: prod.id,
      name: prod.name,
      qty: 1,
      unit: prod.unit || 'ชิ้น',
      price: prod.price || 0,
      isCustom: false
    });
    _render();
  };

  // เพิ่มสินค้านอกระบบ (popup)
  window._v25AddCustom = async () => {
    const { value: formValues, isConfirmed } = await Swal.fire({
      title: '+ เพิ่มสินค้านอกระบบ',
      html: `
        <div class="v25custom-form">
          <div>
            <label>ชื่อสินค้า / บริการ *</label>
            <input id="v25c-name" placeholder="เช่น หินผสม A, งานติดตั้ง">
          </div>
          <div class="v25custom-grid">
            <div>
              <label>จำนวน *</label>
              <input id="v25c-qty" type="number" value="1" min="0.01" step="any">
            </div>
            <div>
              <label>หน่วย</label>
              <input id="v25c-unit" value="ชิ้น">
            </div>
            <div>
              <label>ราคา/หน่วย *</label>
              <input id="v25c-price" type="number" value="0" min="0" step="any">
            </div>
          </div>
          <div class="v25custom-hint">รายการนี้ใช้เฉพาะในใบเสนอราคา ไม่เพิ่มสต็อกเข้าร้าน</div>
        </div>`,
      customClass: { popup: 'v25custom-popup' },
      confirmButtonText: 'เพิ่มรายการ',
      cancelButtonText: 'ยกเลิก',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      preConfirm: () => {
        const name = document.getElementById('v25c-name')?.value?.trim();
        if (!name) { Swal.showValidationMessage('กรุณากรอกชื่อสินค้า'); return false; }
        return {
          name,
          qty: parseFloat(document.getElementById('v25c-qty')?.value || 1),
          unit: document.getElementById('v25c-unit')?.value || 'ชิ้น',
          price: parseFloat(document.getElementById('v25c-price')?.value || 0)
        };
      }
    });
    if (!isConfirmed || !formValues) return;
    window._v25QuotItems.push({
      product_id: DUMMY_PRODUCT_ID,
      name: formValues.name,
      qty: formValues.qty,
      unit: formValues.unit,
      price: formValues.price,
      isCustom: true  // flag สินค้านอกระบบ
    });
    _render();
  };



  // ─── Searchable Product Picker ──────────────────────────────────
  window._v25AllProds = quotProds;
  window._v25DropIdx  = -1;
  const _fmt = typeof formatNum === 'function' ? formatNum : (n) => Number(n || 0).toLocaleString('th-TH');

  window._v25FilterProds = (q) => {
    const dd = document.getElementById('v25q-dropdown');
    if (!dd) return;
    const term = q.trim().toLowerCase();
    if (!term) { dd.style.display = 'none'; window._v25DropIdx = -1; return; }

    const matches = (window._v25AllProds || [])
      .filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
      ).slice(0, 60);

    if (!matches.length) {
      dd.innerHTML = `<div class="v25q-empty" style="min-height:120px;border:0;background:#fff"><div><i class="material-icons-round">search_off</i><div>ไม่พบสินค้าในคลัง</div><small>เพิ่มเป็นรายการนอกระบบได้ โดยไม่เพิ่มสต็อกเข้าร้าน</small></div></div>`;
      dd.style.display = 'block';
      return;
    }

    window._v25DropIdx = -1;
    dd.innerHTML = matches.map((p, i) => {
      const inCart = (window._v25QuotItems || [])
        .filter(x => x.product_id === p.id).reduce((s, x) => s + x.qty, 0);
      const stockColor = p.stock <= 0 ? '#ef4444' : p.stock <= (p.min_stock || 3) ? '#f59e0b' : '#10b981';
      const stockLabel = p.stock <= 0 ? 'หมดสต็อก' : `มี ${_fmt(p.stock)} ${p.unit || 'ชิ้น'}`;
      return `<div class="v25q-drop-item" data-id="${_v25Esc(p.id)}" data-idx="${i}"
        onmousedown="event.preventDefault();window._v25PickProd('${p.id}')"
        onmouseenter="window._v25DropIdx=${i};window._v25Highlight()"
      >
        <div style="min-width:0">
          <div class="v25q-drop-name">${_v25Esc(p.name)}</div>
          <div class="v25q-drop-meta">
            ${p.barcode ? `<span class="v25q-chip">${_v25Esc(p.barcode)}</span>` : ''}
            ${p.category ? `<span>${_v25Esc(p.category)}</span>` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:15px;font-weight:950;color:#dc2626">฿${_fmt(p.price)}</div>
          <div style="font-size:10px;color:${stockColor};font-weight:850">
            ${stockLabel}${inCart ? ` · <b style="color:#6366f1">ใส่แล้ว ${inCart}</b>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    dd.style.display = 'block';
  };

  window._v25Highlight = () => {
    const dd = document.getElementById('v25q-dropdown');
    if (!dd) return;
    dd.querySelectorAll('.v25q-drop-item').forEach((el, i) => {
      el.style.background = i === window._v25DropIdx ? '#eff6ff' : '';
    });
  };

  window._v25PickProd = (id) => {
    window._v25AddFromStock(id);
    // อัปเดต dropdown ให้แสดง "ใส่แล้ว X" ใหม่
    const inp = document.getElementById('v25q-search');
    if (inp && inp.value) window._v25FilterProds(inp.value);
    inp?.focus();
  };

  window._v25KeyNav = (e) => {
    const dd = document.getElementById('v25q-dropdown');
    if (!dd || dd.style.display === 'none') return;
    const items = dd.querySelectorAll('.v25q-drop-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      window._v25DropIdx = Math.min((window._v25DropIdx ?? -1) + 1, items.length - 1);
      window._v25Highlight();
      items[window._v25DropIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      window._v25DropIdx = Math.max((window._v25DropIdx ?? 0) - 1, 0);
      window._v25Highlight();
      items[window._v25DropIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && window._v25DropIdx >= 0) {
      e.preventDefault();
      const id = items[window._v25DropIdx]?.dataset?.id;
      if (id) window._v25PickProd(id);
    } else if (e.key === 'Escape') {
      dd.style.display = 'none';
      window._v25DropIdx = -1;
    }
  };

  // ปิด dropdown เมื่อคลิกออกนอก — auto-cleanup เมื่อ modal ถูกปิด
  window._v25CloseDD = (e) => {
    const dd = document.getElementById('v25q-dropdown');
    if (!dd) { document.removeEventListener('mousedown', window._v25CloseDD); return; }
    if (!e.target.closest('#v25q-search') && !e.target.closest('#v25q-dropdown')) {
      dd.style.display = 'none';
    }
  };
  document.addEventListener('mousedown', window._v25CloseDD);
  // ────────────────────────────────────────────────────────────────

  openModal('สร้างใบเสนอราคา', `
    <div id="v25quote-shell">
      <div class="v25q-wrap">
        <div class="v25q-main">
          <section class="v25q-panel inset">
            <div class="v25q-head">
              <div class="v25q-title"><i class="material-icons-round">badge</i>ข้อมูลลูกค้า</div>
              <span class="v25q-chip">เอกสารยังไม่ตัดสต็อก</span>
            </div>
            <div class="v25q-grid2">
              <div class="v25q-field">
                <label>ชื่อลูกค้า / บริษัท *</label>
                <input class="v25q-input" id="v25q-cust" placeholder="กรอกชื่อลูกค้า หรือชื่อบริษัท" required>
              </div>
              <div class="v25q-field">
                <label>วันหมดอายุ</label>
                <input class="v25q-input" type="date" id="v25q-valid"
                  value="${new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}">
              </div>
            </div>
          </section>

          <section class="v25q-panel inset">
            <div class="v25q-head">
              <div class="v25q-title"><i class="material-icons-round">inventory_2</i>เพิ่มสินค้า / บริการ</div>
              <span id="v25q-count" class="v25q-chip">0 รายการ</span>
            </div>
            <div class="v25q-picker">
              <div class="v25q-searchbox">
                <i class="material-icons-round">search</i>
                <input id="v25q-search" class="v25q-input"
                  placeholder="พิมพ์ชื่อสินค้า บาร์โค้ด หรือหมวดหมู่ แล้วกด Enter เพื่อเลือก"
                  oninput="window._v25FilterProds(this.value)"
                  onkeydown="window._v25KeyNav(event)"
                  autocomplete="off" spellcheck="false">
                <div id="v25q-dropdown"></div>
              </div>
              <button type="button" class="v25q-custom-btn" onclick="window._v25AddCustom()" title="เพิ่มเฉพาะในใบเสนอราคา ไม่เพิ่มสต็อก">
                <i class="material-icons-round">post_add</i> นอกระบบ
              </button>
            </div>
          </section>

          <section class="v25q-panel v25q-table">
            <div class="v25q-table-head">
              <span>รายการ</span>
              <span style="text-align:center">จำนวน</span>
              <span style="text-align:center">หน่วย</span>
              <span style="text-align:right">ราคา/หน่วย</span>
              <span style="text-align:right">รวม</span>
              <span></span>
            </div>
            <div id="v25q-items"></div>
          </section>
        </div>

        <aside class="v25q-side">
          <section class="v25q-total-card">
            <span>ยอดรวมสุทธิ</span>
            <b id="v25q-total">฿0</b>
          </section>
          <section class="v25q-panel inset v25q-summary">
            <div class="v25q-title" style="margin-bottom:8px"><i class="material-icons-round">calculate</i>สรุปยอด</div>
            <div class="v25q-sumline"><span>ยอดก่อนส่วนลด</span><b id="v25q-subtotal">฿0</b></div>
            <div class="v25q-sumline">
              <span>ส่วนลด</span>
              <input type="number" id="v25q-disc" value="0" min="0"
                oninput="window._v25CalcTotal()"
                class="v25q-input" style="width:118px;height:40px;text-align:right">
            </div>
            <div class="v25q-sumline"><span>ส่วนลดรวม</span><b id="v25q-disc-show">฿0</b></div>
            <div class="v25q-field" style="margin-top:14px">
              <label>หมายเหตุ</label>
              <textarea class="v25q-input v25q-note" id="v25q-note" placeholder="เงื่อนไขราคา ระยะเวลาส่งของ หรือรายละเอียดเพิ่มเติม"></textarea>
            </div>
            <button type="button" class="v25q-save" onclick="window._v25SaveQuot()">
              <i class="material-icons-round">save</i> บันทึกใบเสนอราคา
            </button>
          </section>
        </aside>
      </div>
    </div>`);
  document.querySelector('#modal-overlay .modal-box')?.classList.add('v25quote-modal');

  _render();
  // Focus ช่องค้นหาหลัง modal render เสร็จ
  setTimeout(() => document.getElementById('v25q-search')?.focus(), 120);
};

// expose
window.showAddQuotationModal = window.v9ShowQuotModal;

/* ═══════════════════════════════════════════════
   4. บันทึกใบเสนอราคา — ไม่ตัด stock เด็ดขาด
═══════════════════════════════════════════════ */
window._v25SaveQuot = async function () {
  const customer = document.getElementById('v25q-cust')?.value?.trim();
  if (!customer) { typeof toast === 'function' && toast('กรุณากรอกชื่อลูกค้า', 'error'); return; }
  const items = window._v25QuotItems || [];
  if (!items.length || !items.some(i => i.name)) {
    typeof toast === 'function' && toast('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ', 'error'); return;
  }
  const discount = parseFloat(document.getElementById('v25q-disc')?.value || 0);
  const subtotal = items.reduce((s, i) => s + (i.qty * i.price), 0);
  const total = Math.max(0, subtotal - discount);
  const valid = document.getElementById('v25q-valid')?.value || null;
  const note = document.getElementById('v25q-note')?.value || '';
  const staff = typeof v9Staff === 'function' ? v9Staff() : ((typeof USER !== 'undefined' && USER) ? USER.username : '-');

  if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังบันทึก...');
  try {
    // Insert ใบเสนอราคา (ไม่ตัด stock)
    const { data: quot, error: qe } = await db.from('ใบเสนอราคา').insert({
      customer_name: customer, total, discount,
      date: new Date().toISOString(),
      valid_until: valid ? new Date(valid).toISOString() : null,
      note: note || null, staff_name: staff,
    }).select().single();
    if (qe) throw new Error(qe.message);

    // Insert รายการ (ใช้ DUMMY_PRODUCT_ID สำหรับสินค้านอกระบบ)
    for (const it of items) {
      const pid = it.isCustom ? DUMMY_PRODUCT_ID : (it.product_id || null);
      await db.from('รายการใบเสนอราคา').insert({
        quotation_id: quot.id,
        product_id: pid,
        name: it.name,
        qty: it.qty,
        unit: it.unit || 'ชิ้น',
        price: it.price,
        total: it.qty * it.price,
      });
    }
    // *** ไม่มีการ UPDATE stock เด็ดขาด ***

    typeof closeModal === 'function' && closeModal();
    typeof toast === 'function' && toast('บันทึกใบเสนอราคาสำเร็จ', 'success');
    window.renderQuotations?.();
  } catch (e) {
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
} finally { if (typeof v9HideOverlay === 'function') v9HideOverlay(); }
};

function _v25Money(n) { return Number(n || 0).toLocaleString('th-TH'); }
function _v25DenomTotal(obj) {
  return Object.entries(obj || {}).reduce((s, [v, c]) => s + Number(v) * Number(c || 0), 0);
}

function v25ShowQuoteCheckoutPopup(quot, itemCount) {
  v25InstallQuoteStyles();
  return new Promise(resolve => {
    let step = 1;
    const state = { pay: 'cash', delivery: 'self' };
    const ov = document.createElement('div');
    ov.className = 'v25qc-overlay';
    document.body.appendChild(ov);

    const payLabels = { cash: 'เงินสด', transfer: 'โอนเงิน', credit: 'บัตรเครดิต', debt: 'ค้างชำระ', cod: 'ชำระหน้างาน / COD' };
    const delLabels = { self: 'รับเอง / ไม่จัดส่ง', deliver: 'จัดส่งทั้งหมด', partial: 'รับบางส่วน + จัดส่งบางส่วน' };
    const close = value => { ov.remove(); resolve(value); };
    const setStep = next => { step = Math.max(1, Math.min(3, next)); render(); };

    window._v25qcPick = function (group, value) {
      if (group === 'pay') state.pay = value;
      if (group === 'delivery') state.delivery = value;
      render();
    };

    function stepsHtml() {
      return [1, 2, 3].map((n, i) => {
        const labels = ['ตรวจเอกสาร', 'ชำระ/จัดส่ง', 'ยืนยัน'];
        return `${i ? '<div class="v25qc-line"></div>' : ''}<div class="v25qc-step ${step === n ? 'active' : (step > n ? 'done' : '')}"><span class="num">${step > n ? '✓' : n}</span><span>${labels[i]}</span></div>`;
      }).join('');
    }

    function bodyHtml() {
      if (step === 1) return `
        <div class="v25qc-title"><i class="material-icons-round">request_quote</i>ตรวจใบเสนอราคา</div>
        <div class="v25qc-grid">
          <div class="v25qc-card">
            <div class="v25qc-row"><span>ลูกค้า</span><b>${_v25Esc(quot.customer_name || '-')}</b></div>
            <div class="v25qc-row"><span>เลขที่</span><b>QT-${String(quot.id).slice(-6).toUpperCase()}</b></div>
            <div class="v25qc-row"><span>จำนวนรายการ</span><b>${itemCount} รายการ</b></div>
            <div class="v25qc-row"><span>สถานะ</span><b>${_v25Esc(quot.status || 'รออนุมัติ')}</b></div>
          </div>
          <div class="v25qc-card soft">
            <div style="font-size:12px;color:#64748b;font-weight:900;margin-bottom:8px">ยอดที่จะสร้างเป็นบิลขาย</div>
            <div class="v25qc-total">฿${_v25Money(quot.total)}</div>
            ${Number(quot.discount || 0) > 0 ? `<div style="margin-top:8px;color:#64748b;font-weight:850">ส่วนลด ฿${_v25Money(quot.discount)}</div>` : ''}
          </div>
        </div>
        <div class="v25qc-hint">ใบเสนอราคายังไม่ถือว่าได้รับเงิน จนกว่าจะกดสร้างเป็นบิลขายในขั้นตอนสุดท้าย</div>`;
      if (step === 2) return `
        <div class="v25qc-title"><i class="material-icons-round">payments</i>เลือกวิธีชำระเงินและจัดส่ง</div>
        <div class="v25qc-card">
          <div style="font-size:13px;font-weight:950;color:#475569;margin-bottom:10px">วิธีชำระเงิน</div>
          <div class="v25qc-options">
            ${[
              ['cash', 'payments', 'เงินสด'],
              ['transfer', 'qr_code_2', 'โอนเงิน'],
              ['credit', 'credit_card', 'บัตรเครดิต'],
              ['debt', 'receipt_long', 'ค้างชำระ'],
              ['cod', 'local_shipping', 'COD'],
            ].map(o => `<button type="button" class="v25qc-opt ${state.pay === o[0] ? 'active' : ''}" onclick="window._v25qcPick('pay','${o[0]}')"><i class="material-icons-round">${o[1]}</i>${o[2]}</button>`).join('')}
          </div>
        </div>
        <div class="v25qc-card">
          <div style="font-size:13px;font-weight:950;color:#475569;margin-bottom:10px">วิธีจัดส่ง</div>
          <div class="v25qc-options">
            ${[
              ['self', 'storefront', 'รับเอง'],
              ['deliver', 'local_shipping', 'จัดส่งทั้งหมด'],
              ['partial', 'call_split', 'รับบางส่วน'],
            ].map(o => `<button type="button" class="v25qc-opt ${state.delivery === o[0] ? 'active' : ''}" onclick="window._v25qcPick('delivery','${o[0]}')"><i class="material-icons-round">${o[1]}</i>${o[2]}</button>`).join('')}
          </div>
        </div>`;
      return `
        <div class="v25qc-title"><i class="material-icons-round">task_alt</i>ยืนยันสร้างบิลขาย</div>
        <div class="v25qc-grid">
          <div class="v25qc-card">
            <div class="v25qc-row"><span>วิธีชำระ</span><b>${payLabels[state.pay]}</b></div>
            <div class="v25qc-row"><span>วิธีจัดส่ง</span><b>${delLabels[state.delivery]}</b></div>
            <div class="v25qc-row"><span>ยอดบิล</span><b>฿${_v25Money(quot.total)}</b></div>
          </div>
          <div class="v25qc-card soft">
            <div class="v25qc-hint">${state.pay === 'cash' ? 'หลังจากกดยืนยัน ระบบจะเปิดหน้านับแบงค์เพื่อรับเงินสด และนับเงินทอนจากลิ้นชัก' : 'ระบบจะสร้างบิลขายตามวิธีชำระที่เลือก และเปิดหน้าพิมพ์เอกสารต่อ'}</div>
          </div>
        </div>`;
    }

    function render() {
      ov.innerHTML = `<div class="v25qc-modal">
        <div class="v25qc-progress">${stepsHtml()}</div>
        <div class="v25qc-body">${bodyHtml()}</div>
        <div class="v25qc-footer">
          <button type="button" class="v25qc-btn" onclick="${step === 1 ? 'window._v25qcCancel()' : 'window._v25qcBack()'}"><i class="material-icons-round">${step === 1 ? 'close' : 'arrow_back'}</i>${step === 1 ? 'ยกเลิก' : 'ย้อนกลับ'}</button>
          <button type="button" class="v25qc-btn primary" onclick="${step === 3 ? 'window._v25qcConfirm()' : 'window._v25qcNext()'}">${step === 3 ? 'สร้างบิลขาย' : 'ถัดไป'}<i class="material-icons-round">${step === 3 ? 'check' : 'arrow_forward'}</i></button>
        </div>
      </div>`;
    }

    window._v25qcNext = () => setStep(step + 1);
    window._v25qcBack = () => setStep(step - 1);
    window._v25qcCancel = () => close(null);
    window._v25qcConfirm = () => close({ ...state });
    render();
  }).finally(() => {
    ['_v25qcPick','_v25qcNext','_v25qcBack','_v25qcCancel','_v25qcConfirm'].forEach(k => { window[k] = null; });
  });
}

async function v25CollectQuoteCash(total, customerName) {
  const fmt = typeof formatNum === 'function' ? formatNum : _v25Money;
  if (typeof window.v32ShowDenomWizard !== 'function') {
    return { received: total, change: 0, denominations: null, changeDenominations: null };
  }
  const sr = await db.from('cash_session').select('id').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
  if (!sr.data?.id) {
    if (typeof Swal !== 'undefined') await Swal.fire({ icon: 'warning', title: 'ยังไม่ได้เปิดลิ้นชัก', text: 'กรุณาเปิดลิ้นชักเงินสดก่อนรับเงินสดจากใบเสนอราคา', confirmButtonColor: '#dc2626' });
    return null;
  }
  const counts = await window.v32ShowDenomWizard({
    title: 'รับเงินสดจากใบเสนอราคา',
    subtitle: `${customerName || 'ลูกค้า'} · ยอดชำระ ฿${fmt(total)}`,
    icon: '<i class="material-icons-round">request_quote</i>',
    targetAmount: total,
    mustBeExact: false,
    dir: 'in',
    confirmText: 'ยืนยันรับเงิน',
    cancelText: 'ย้อนกลับ'
  });
  if (!counts) return null;
  const received = _v25DenomTotal(counts);
  const change = received - total;
  let changeDenoms = null;
  if (change > 0) {
    let drawer = null;
    if (typeof window.v32LoadDrawer === 'function') {
      try { drawer = await window.v32LoadDrawer(); } catch (_) { drawer = null; }
    }
    changeDenoms = await window.v32ShowDenomWizard({
      title: 'นับเงินทอนจากลิ้นชัก',
      subtitle: 'ยอดทอน ฿' + fmt(change) + ' · ต้องพอดีเป๊ะ',
      icon: '<i class="material-icons-round">payments</i>',
      targetAmount: change,
      mustBeExact: true,
      drawer: drawer,
      showBalance: !!drawer,
      balance: drawer ? _v25DenomTotal(drawer) : 0,
      dir: 'out',
      confirmText: 'ยืนยันทอนเงิน',
      cancelText: 'ย้อนกลับ'
    });
    if (!changeDenoms) return null;
  }
  return { received, change, denominations: counts, changeDenominations: changeDenoms || {} };
}

/* ═══════════════════════════════════════════════
   5. แปลงใบเสนอราคาเป็นบิลขาย — ตัดสต็อกเฉพาะสินค้าจริง
═══════════════════════════════════════════════ */
window.v9ConvertQuotation = async function (quotId, customerName) {
  try {
    // ดึงรายการใบเสนอราคา
    const { data: quotItems } = await db.from('รายการใบเสนอราคา')
      .select('*').eq('quotation_id', quotId);
    const { data: quot } = await db.from('ใบเสนอราคา').select('*')
      .eq('id', quotId).maybeSingle();
    if (!quot) throw new Error('ไม่พบใบเสนอราคา');
    const choice = await v25ShowQuoteCheckoutPopup(quot, (quotItems || []).length);
    if (!choice) return;
    const payMode = choice.pay || 'cash';
    const deliveryChoice = choice.delivery || 'self';
    const cashInfo = payMode === 'cash' ? await v25CollectQuoteCash(Number(quot.total || 0), quot.customer_name || customerName) : null;
    if (payMode === 'cash' && !cashInfo) return;

    if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังแปลงเป็นบิล...');

    const staffName = typeof v9Staff === 'function' ? v9Staff() : ((typeof USER !== 'undefined' && USER) ? USER.username : '-');
    const methodMap = { cash: 'เงินสด', transfer: 'โอนเงิน', credit: 'บัตรเครดิต', debt: 'ค้างชำระ', cod: 'ชำระหน้างาน' };
    const paidNow = ['cash', 'transfer', 'credit'].includes(payMode);
    const isDebt = payMode === 'debt';
    const isCod = payMode === 'cod';
    const deliveryMap = { self: 'รับเอง', deliver: 'deliver', partial: 'partial' };
    const hasDelivery = deliveryChoice === 'deliver' || deliveryChoice === 'partial';
    const billStatus = isDebt ? 'ค้างชำระ' : (isCod ? 'ชำระหน้างาน' : 'สำเร็จ');
    const deliveryStatus = hasDelivery ? 'รอจัดส่ง' : 'สำเร็จ';

    // สร้างบิลขาย
    const { data: bill, error: be } = await db.from('บิลขาย').insert({
      bill_no: Date.now(),
      customer_name: quot.customer_name,
      total: quot.total,
      discount: quot.discount || 0,
      method: methodMap[payMode] || 'เงินสด',
      status: billStatus,
      date: new Date().toISOString(),
      staff_name: staffName,
      delivery_mode: deliveryMap[deliveryChoice] || 'รับเอง',
      delivery_status: deliveryStatus,
      received: payMode === 'cash' ? cashInfo.received : (paidNow ? quot.total : 0),
      change: payMode === 'cash' ? cashInfo.change : 0,
      deposit_amount: 0,
      denominations: payMode === 'cash' ? cashInfo.denominations : null,
      change_denominations: payMode === 'cash' ? cashInfo.changeDenominations : null,
      note: `สร้างจากใบเสนอราคา QT-${String(quotId).slice(-6).toUpperCase()}`,
    }).select().single();
    if (be) throw new Error(be.message);

    // Insert รายการในบิล + ตัดสต็อกเฉพาะสินค้าจริง
    for (const it of (quotItems || [])) {
      await db.from('รายการในบิล').insert({
        bill_id: bill.id,
        product_id: (!it.product_id || it.product_id === DUMMY_PRODUCT_ID) ? null : it.product_id,
        name: it.name,
        qty: it.qty,
        unit: it.unit || 'ชิ้น',
        price: it.price,
        total: it.total || (it.qty * it.price),
        take_qty: deliveryChoice === 'deliver' ? 0 : it.qty,
        deliver_qty: hasDelivery ? it.qty : 0,
      });

      // ══ ตัดสต็อก: SKIP ถ้าเป็น DUMMY หรือไม่มี product_id ══
      if (!it.product_id || it.product_id === DUMMY_PRODUCT_ID) {
        console.log(`[v25] Skip stock for custom item: ${it.name}`);
        continue;
      }

      // ดึง stock ปัจจุบัน
      const { data: prod } = await db.from('สินค้า').select('stock,has_units,name')
        .eq('id', it.product_id).maybeSingle();
      if (!prod) continue;

      const stockBefore = prod.stock || 0;
      // ใช้ unit conversion ถ้ามี
      let deductQty = it.qty;
      if (prod.has_units) {
        try {
          const { data: units } = await db.from('product_units')
            .select('multiplier').eq('product_id', it.product_id)
            .eq('unit_name', it.unit).maybeSingle();
          if (units?.multiplier) deductQty = it.qty * units.multiplier;
        } catch (_) { }
      }

      const stockAfter = stockBefore - deductQty;
      await db.from('สินค้า').update({ stock: stockAfter }).eq('id', it.product_id);

      try {
        await db.from('stock_movement').insert({
          product_id: it.product_id, product_name: it.name,
          type: 'ขาย', direction: 'out', qty: deductQty,
          stock_before: stockBefore, stock_after: stockAfter,
          ref_id: bill.id, ref_table: 'บิลขาย',
          staff_name: staffName,
        });
      } catch (_) { }
    }

    if (payMode === 'cash') {
      try {
        const { data: session } = await db.from('cash_session').select('id').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
        if (session?.id) {
          await db.from('cash_transaction').insert({
            session_id: session.id,
            type: 'ขายจากใบเสนอราคา',
            direction: 'in',
            amount: cashInfo.received,
            change_amt: cashInfo.change,
            net_amount: quot.total,
            balance_after: 0,
            ref_id: bill.id,
            ref_table: 'บิลขาย',
            staff_name: staffName,
            note: `QT-${String(quotId).slice(-6).toUpperCase()}`,
            denominations: cashInfo.denominations,
            change_denominations: cashInfo.changeDenominations
          });
        }
      } catch (e) { console.warn('[v25] cash tx from quotation:', e); }
    }

    // อัปเดตสถานะใบเสนอราคา
    await db.from('ใบเสนอราคา').update({
      status: 'อนุมัติ',
      converted_bill_id: bill.id
    }).eq('id', quotId);

    typeof toast === 'function' && toast(`สร้างบิลขาย #${bill.bill_no} สำเร็จ`, 'success');
    window.renderQuotations?.();
    await loadProducts?.();
    if (typeof v24ShowDocSelector === 'function') await v24ShowDocSelector(bill.id);

  } catch (e) {
    typeof toast === 'function' && toast('ไม่สำเร็จ: ' + e.message, 'error');
  } finally { if (typeof v9HideOverlay === 'function') v9HideOverlay(); }
};

window.v9DeleteQuotation = async function (quotId) {
  const canDelete = (typeof window.canDeleteActionV36 === 'function')
    ? window.canDeleteActionV36()
    : (USER?.role === 'admin' || USER_PERMS?.can_delete === true);
  if (!canDelete) {
    if (typeof Swal !== 'undefined') Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์ลบรายการ', text: 'กรุณาเปิดสิทธิ์ "สิทธิ์ลบรายการ" ในหน้าแอดมิน', confirmButtonColor: '#dc2626' });
    else typeof toast === 'function' && toast('ไม่มีสิทธิ์ลบรายการ', 'warning');
    return;
  }
  const { data: quot } = await db.from('ใบเสนอราคา').select('id,status,customer_name').eq('id', quotId).maybeSingle();
  if (!quot) { typeof toast === 'function' && toast('ไม่พบใบเสนอราคา', 'error'); return; }
  if (quot.status !== 'ยกเลิก') {
    typeof toast === 'function' && toast('ลบได้เฉพาะใบเสนอราคาที่ยกเลิกแล้ว', 'warning');
    return;
  }
  const r = await Swal.fire({
    icon: 'warning',
    title: 'ลบใบเสนอราคานี้?',
    text: `ใบเสนอราคาของ ${quot.customer_name || '-'} จะถูกลบถาวร`,
    showCancelButton: true,
    confirmButtonText: 'ลบถาวร',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626'
  });
  if (!r.isConfirmed) return;
  await db.from('รายการใบเสนอราคา').delete().eq('quotation_id', quotId);
  const { error } = await db.from('ใบเสนอราคา').delete().eq('id', quotId);
  if (error) { typeof toast === 'function' && toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  typeof toast === 'function' && toast('ลบใบเสนอราคาแล้ว', 'success');
  window.renderQuotations?.();
};

/* ═══════════════════════════════════════════════
   6. Override v9PrintQuotation → ใช้ v24 template
      แก้ปัญหาพิมพ์ใบเสนอราคาแต่ได้ใบชำระเงิน
═══════════════════════════════════════════════ */
window.v9PrintQuotation = async function (quotId) {
  if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังเตรียมพิมพ์...');
  try {
    const [{ data: quot }, { data: items }] = await Promise.all([
      db.from('ใบเสนอราคา').select('*').eq('id', quotId).maybeSingle(),
      db.from('รายการใบเสนอราคา').select('*').eq('quotation_id', quotId),
    ]);
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    if (!quot) { typeof toast === 'function' && toast('ไม่พบใบเสนอราคา', 'error'); return; }

    // แปลงข้อมูลเป็น format ที่ v24PrintDocument รับ
    const fakeBill = {
      bill_no: `QT-${String(quotId).slice(-6).toUpperCase()}`,
      date: quot.date || quot.created_at,
      customer_name: quot.customer_name || 'ลูกค้า',
      total: quot.total || 0,
      discount: quot.discount || 0,
      method: '-',
      staff_name: quot.staff_name || '-',
      status: 'ใบเสนอราคา',
      note: quot.note || '',
    };
    const fakeItems = (items || []).map(i => ({
      name: i.name,
      qty: i.qty,
      unit: i.unit || 'ชิ้น',
      price: i.price,
      total: i.total || (i.qty * i.price),
    }));

    // เรียก v24PrintDocument ด้วย docType = 'quotation'
    await v24PrintDocument(fakeBill, fakeItems, 'quotation');
  } catch (e) {
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    typeof toast === 'function' && toast('พิมพ์ไม่ได้: ' + e.message, 'error');
  }
};

/* ═══════════════════════════════════════════════
   7. Override ใบส่งของในคิวจัดส่ง → ใช้ v24 design
═══════════════════════════════════════════════ */
window.v12DQPrintNote = async function (billId) {
  // เรียก v12PrintDeliveryNote ที่ v24 override ไว้แล้ว
  // ซึ่งจะใช้ v24PrintDocument(bill, items, 'delivery')
  if (typeof v12PrintDeliveryNote === 'function') {
    await v12PrintDeliveryNote(billId);
  }
};

/* ═══ BOOT ═══ */
console.info('%c[v25] ✅%c Quotation System + Delivery v24 — loaded', 'color:#f59e0b;font-weight:900', 'color:#6B7280');
