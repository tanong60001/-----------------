// V63: combined batch production. Mix formulas are templates, not sale products.
(function () {
  'use strict';

  const PRODUCT_TABLE = 'สินค้า';
  const MOVEMENT_TABLE = 'stock_movement';
  const STORE_KEY = 'sk_batch_mix_formulas_v63';

  function html(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function js(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(value) {
    try { return typeof formatNum === 'function' ? formatNum(value) : money(value).toLocaleString('th-TH'); }
    catch (_) { return money(value).toLocaleString('th-TH'); }
  }

  function toastMsg(message, type) {
    if (typeof toast === 'function') toast(message, type || 'info');
  }

  function setGlobal(name, value) {
    window[name] = value;
    try { Function('name', 'value', 'window[name] = value; eval(name + " = value");')(name, value); }
    catch (_) {}
  }

  function productList() {
    try { if (Array.isArray(products)) return products; } catch (_) {}
    return Array.isArray(window.products) ? window.products : [];
  }

  function updateProductCache(rows) {
    const list = productList();
    (rows || []).forEach(row => {
      const current = list.find(product => String(product.id) === String(row.id));
      if (current) Object.assign(current, row);
    });
    try { products = list; } catch (_) {}
    try { window.products = list; } catch (_) {}
    try { window._v9ProductsCache = list; } catch (_) {}
  }

  function productById(id) {
    return productList().find(product => String(product.id) === String(id));
  }

  function isMto(product) {
    const type = String(product?.product_type || '');
    return type === 'ตามบิล' || type.includes('ตามบิล') || type.includes('เธ•เธฒเธกเธเธดเธฅ');
  }

  function isRaw(product) {
    const type = String(product?.product_type || '').toLowerCase();
    const category = String(product?.category || '').toLowerCase();
    return product?.is_raw === true || /วัตถุดิบ|raw|material/.test(type + ' ' + category);
  }

  function isRawOrBoth(product) {
    const type = String(product?.product_type || '').toLowerCase();
    return isRaw(product) || /both|ทั้งคู่/.test(type);
  }

  function outputProducts() {
    return productList()
      .filter(product => product?.id && !isRaw(product) && !isMto(product))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
  }

  function materialProducts() {
    return productList()
      .filter(product => product?.id && isRawOrBoth(product))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
  }

  function optionsHtml(products, selectedId) {
    return products.map(product => `<option value="${html(product.id)}" ${String(product.id) === String(selectedId) ? 'selected' : ''}>${html(product.name || product.id)}${product.unit ? ` (${html(product.unit)})` : ''}</option>`).join('');
  }

  function unitOptionsHtml(selected) {
    const units = ['โม่', 'ถุง', 'กก.', 'ตัน', 'ชิ้น', 'เส้น', 'มัด', 'คิว', 'ลิตร', 'ถัง', 'เที่ยว'];
    const value = selected || '';
    const base = units.map(unit => `<option value="${html(unit)}" ${unit === value ? 'selected' : ''}>${html(unit)}</option>`).join('');
    return base + (value && !units.includes(value) ? `<option value="${html(value)}" selected>${html(value)}</option>` : '');
  }

  function readFormulas() {
    try {
      const rows = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (_) {
      return [];
    }
  }

  function writeFormulas(rows) {
    localStorage.setItem(STORE_KEY, JSON.stringify(rows || []));
  }

  function activeFormula() {
    const id = document.getElementById('v63-formula-select')?.value || '';
    return readFormulas().find(row => String(row.id) === String(id)) || null;
  }

  function formulaRowHtml(item) {
    const product = productById(item?.materialId);
    const unit = item?.unit || product?.unit || '';
    return `<div class="v63-line v63-formula-line" data-v63-formula-material>
      <input type="hidden" data-v63-formula-material-id value="${html(item?.materialId || '')}">
      <button class="v63-pick-btn" type="button" onclick="v63OpenAddLineModal('formula', this.closest('[data-v63-formula-material]'))">
        <span><strong>${html(product?.name || 'เลือกวัตถุดิบ')}</strong><small>${html(product?.barcode || 'ค้นหาเฉพาะวัตถุดิบ / สินค้าที่เป็นทั้งขายและวัตถุดิบ')}</small></span>
        <i class="material-icons-round">search</i>
      </button>
      <input class="v63-input" type="number" min="0" step="0.001" data-v63-formula-material-qty value="${html(item?.qty || '')}" placeholder="จำนวนต่อ 1 โม่">
      <span class="v63-unit-badge" data-v63-formula-material-unit>${html(unit || product?.unit || '-')}</span>
      <button class="v63-icon-btn" type="button" onclick="this.closest('[data-v63-formula-material]').remove()"><i class="material-icons-round">close</i></button>
    </div>`;
  }

  function productionMaterialRowHtml(item) {
    const product = productById(item.materialId);
    const suggested = money(item.suggested ?? item.qty);
    const qty = money(item.qty ?? suggested);
    return `<div class="v63-line" data-v63-prod-material="${html(item.materialId)}">
      <div>
        <div class="v63-name">${html(product?.name || item.materialId)}</div>
        <div class="v63-meta">แนะนำ ${fmt(suggested)} ${html(item.unit || product?.unit || '')} · คงเหลือ ${fmt(product?.stock)} ${html(product?.unit || '')}</div>
      </div>
      <input class="v63-input" type="number" min="0" step="0.001" data-v63-prod-material-qty value="${html(qty)}">
      <button class="v63-icon-btn" type="button" onclick="this.closest('[data-v63-prod-material]').remove()"><i class="material-icons-round">close</i></button>
    </div>`;
  }

  function outputRowHtml(item) {
    const product = productById(item?.productId);
    return `<div class="v63-line" data-v63-output>
      <input type="hidden" data-v63-output-id value="${html(item?.productId || '')}">
      <div>
        <div class="v63-name">${html(product?.name || 'เลือกสินค้า')}</div>
        <div class="v63-meta">หน่วยฐาน ${html(product?.unit || '-')} · คงเหลือ ${fmt(product?.stock)} ${html(product?.unit || '')}</div>
      </div>
      <input class="v63-input" type="number" min="0" step="0.001" data-v63-output-qty value="${html(item?.qty || '')}" placeholder="จำนวนที่ได้">
      <button class="v63-icon-btn" type="button" onclick="this.closest('[data-v63-output]').remove()"><i class="material-icons-round">close</i></button>
    </div>`;
  }

  function injectStyle() {
    if (document.getElementById('v63-batch-production-style')) return;
    const style = document.createElement('style');
    style.id = 'v63-batch-production-style';
    style.textContent = `
      .v63-wrap{display:grid;gap:18px}
      .v63-hero{border:1px solid #bae6fd;background:linear-gradient(135deg,#ecfeff,#f8fafc);border-radius:18px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;box-shadow:0 14px 34px rgba(15,23,42,.06)}
      .v63-title{display:flex;align-items:center;gap:12px}
      .v63-title i{width:56px;height:56px;border-radius:16px;background:#0f766e;color:#fff;display:grid;place-items:center;font-size:30px}
      .v63-title h3{margin:0;font-size:26px;font-weight:950;color:#0f172a}
      .v63-title p{margin:5px 0 0;color:#475569;font-size:14px;font-weight:800;line-height:1.55;max-width:920px}
      .v63-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #99f6e4;background:#f0fdfa;color:#0f766e;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:950}
      .v63-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .v63-step{border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;box-shadow:0 6px 18px rgba(15,23,42,.04)}
      .v63-step b{width:34px;height:34px;border-radius:10px;background:#0f172a;color:#fff;display:grid;place-items:center;flex-shrink:0}
      .v63-step span{display:block;font-size:13px;color:#64748b;font-weight:800;margin-top:2px}
      .v63-grid{display:grid;grid-template-columns:.92fr 1.08fr;gap:18px;align-items:start}
      .v63-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.05)}
      .v63-card-h{padding:15px 18px;border-bottom:1px solid #eef2f7;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:950;color:#0f172a}
      .v63-card-title{display:flex;align-items:center;gap:10px}
      .v63-card-title i{width:38px;height:38px;border-radius:12px;background:#e0f2fe;color:#0369a1;display:grid;place-items:center}
      .v63-card-b{padding:16px 18px;display:grid;gap:14px}
      .v63-form-grid{display:grid;grid-template-columns:1fr 120px;gap:10px}
      .v63-line{display:grid;grid-template-columns:1fr 130px 42px;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:14px;padding:11px;background:#fff}
      .v63-formula-line{grid-template-columns:1fr 120px 86px 42px}
      .v63-line[data-v63-prod-material]{grid-template-columns:1fr 120px 42px}
      .v63-input{width:100%;height:42px;border:1.5px solid #dbe3ef;border-radius:10px;padding:0 10px;font:inherit;font-weight:800;box-sizing:border-box;background:#fff}
      .v63-input:focus{outline:none;border-color:#0f766e;box-shadow:0 0 0 4px rgba(15,118,110,.1)}
      .v63-icon-btn{width:42px;height:42px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#64748b;display:grid;place-items:center;cursor:pointer}
      .v63-icon-btn:hover{border-color:#fecaca;color:#dc2626;background:#fef2f2}
      .v63-pick-btn{height:52px;border:1.5px solid #dbe3ef;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;text-align:left;cursor:pointer;color:#0f172a;min-width:0}
      .v63-pick-btn:hover{border-color:#0f766e;box-shadow:0 0 0 4px rgba(15,118,110,.08)}
      .v63-pick-btn span{min-width:0;display:grid;gap:2px}
      .v63-pick-btn strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v63-pick-btn small{font-size:11px;color:#64748b;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v63-unit-badge{height:42px;border:1px solid #ccfbf1;background:#f0fdfa;color:#0f766e;border-radius:10px;display:grid;place-items:center;font-weight:950;font-size:12px;padding:0 8px}
      .v63-name{font-weight:950;color:#0f172a}
      .v63-meta{font-size:12px;color:#64748b;margin-top:3px;font-weight:750}
      .v63-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}
      .v63-note{border:1px solid #ccfbf1;background:#f0fdfa;color:#0f766e;border-radius:13px;padding:12px 14px;font-size:13px;font-weight:850;line-height:1.55}
      .v63-empty{padding:24px;text-align:center;color:#94a3b8;background:#f8fafc;border-radius:14px;font-weight:850;border:1px dashed #cbd5e1}
      .v63-section-head{border:0!important;border-radius:14px!important;margin-bottom:10px;background:#f8fafc!important}
      .v63-save{height:52px;padding:0 22px!important;border-radius:13px!important;font-size:15px!important;box-shadow:0 14px 26px rgba(220,38,38,.18)}
      .v63-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.48);backdrop-filter:blur(6px);z-index:9999;display:grid;place-items:center;padding:22px}
      .v63-modal{width:min(920px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;border:1px solid #e2e8f0;box-shadow:0 28px 80px rgba(15,23,42,.28)}
      .v63-modal-head{padding:20px 22px;border-bottom:1px solid #eef2f7;background:linear-gradient(135deg,#f0fdfa,#f8fafc);display:flex;align-items:center;justify-content:space-between;gap:14px}
      .v63-modal-title{display:flex;align-items:center;gap:12px}
      .v63-modal-title i{width:48px;height:48px;border-radius:14px;background:#0f766e;color:#fff;display:grid;place-items:center}
      .v63-modal-title h3{margin:0;font-size:22px;font-weight:950;color:#0f172a}
      .v63-modal-title p{margin:4px 0 0;color:#64748b;font-size:13px;font-weight:800}
      .v63-modal-body{padding:20px 22px;display:grid;gap:16px}
      .v63-field-label{font-size:12px;font-weight:950;color:#475569;margin-bottom:6px}
      .v63-modal-grid{display:grid;grid-template-columns:1fr 130px 120px;gap:12px}
      .v63-formula-summary{border:1px solid #dbeafe;background:#eff6ff;border-radius:15px;padding:14px;display:grid;gap:8px}
      .v63-formula-summary strong{font-size:15px;color:#0f172a}
      .v63-formula-summary span{color:#64748b;font-size:13px;font-weight:800}
      .v63-search-list{display:grid;gap:8px;max-height:320px;overflow:auto;padding-right:4px}
      .v63-search-item{border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;text-align:left}
      .v63-search-item:hover,.v63-search-item.on{border-color:#0f766e;background:#f0fdfa}
      .v63-search-item b{color:#0f172a}
      .v63-search-item span{display:block;color:#64748b;font-size:12px;font-weight:800;margin-top:3px}
      @media(max-width:980px){.v63-grid,.v63-form-grid,.v63-line,.v63-formula-line,.v63-line[data-v63-prod-material],.v63-steps,.v63-modal-grid{grid-template-columns:1fr}.v63-actions .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function renderFormulaPicker() {
    const select = document.getElementById('v63-formula-select');
    if (!select) return;
    const formulas = readFormulas();
    select.innerHTML = formulas.length
      ? formulas.map(row => `<option value="${html(row.id)}">${html(row.name)} (${fmt(row.batchQty || 1)} ${html(row.batchUnit || 'โม่')})</option>`).join('')
      : '<option value="">ยังไม่มีสูตรมิกซ์</option>';
    renderFormulaEditor();
  }

  window.v63AddFormulaMaterial = function (item) {
    const body = document.getElementById('v63-formula-materials');
    if (!body) return;
    if (item && item.materialId) body.insertAdjacentHTML('beforeend', formulaRowHtml(item));
    else window.v63OpenAddLineModal('formula');
  };

  function pickerProducts(kind) {
    return kind === 'output' ? outputProducts() : materialProducts();
  }

  function productSearchText(product) {
    return [product?.name, product?.barcode, product?.category, product?.unit, product?.product_type].filter(Boolean).join(' ').toLowerCase();
  }

  window.v63RenderPickerList = function (kind) {
    const query = String(document.getElementById('v63-picker-search')?.value || '').trim().toLowerCase();
    const list = document.getElementById('v63-picker-list');
    if (!list) return;
    const rows = pickerProducts(kind)
      .filter(product => !query || productSearchText(product).includes(query))
      .slice(0, 80);
    list.innerHTML = rows.length ? rows.map(product => `
      <button class="v63-search-item" type="button" onclick="v63SelectPickerProduct('${js(product.id)}')">
        <span><b>${html(product.name || '')}</b><span>${html(product.barcode || '-')} · หน่วยฐาน ${html(product.unit || '-')} · คงเหลือ ${fmt(product.stock)} ${html(product.unit || '')}</span></span>
        <i class="material-icons-round">chevron_right</i>
      </button>`).join('') : '<div class="v63-empty">ไม่พบรายการที่ค้นหา</div>';
  };

  window.v63SelectPickerProduct = function (productId) {
    const product = productById(productId);
    const modal = document.getElementById('v63-picker-modal');
    if (!modal || !product) return;
    modal.dataset.productId = productId;
    const box = document.getElementById('v63-picker-selected');
    if (box) {
      box.innerHTML = `<strong>${html(product.name || '')}</strong><span>หน่วยฐาน ${html(product.unit || '-')} · คงเหลือ ${fmt(product.stock)} ${html(product.unit || '')}</span>`;
    }
  };

  window.v63ClosePickerModal = function () {
    document.getElementById('v63-picker-modal')?.remove();
  };

  window.v63OpenAddLineModal = function (kind, target) {
    injectStyle();
    const title = kind === 'output' ? 'เพิ่มสินค้าที่ได้เข้า stock' : (kind === 'formula' ? 'เพิ่มวัตถุดิบในสูตรมิกซ์' : 'เพิ่มวัตถุดิบที่ใช้จริง');
    const help = kind === 'output'
      ? 'ค้นหาสินค้าที่ผลิตได้ แล้วกรอกจำนวนที่ต้องการเพิ่มเข้า stock'
      : 'ค้นหาเฉพาะวัตถุดิบ หรือสินค้าที่กำหนดเป็นทั้งขายและวัตถุดิบ หน่วยจะใช้หน่วยฐานของสินค้านั้น';
    document.getElementById('v63-picker-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div class="v63-modal-backdrop" id="v63-picker-modal" data-kind="${html(kind)}">
        <div class="v63-modal" role="dialog" aria-modal="true" style="width:min(760px,100%)">
          <div class="v63-modal-head">
            <div class="v63-modal-title">
              <i class="material-icons-round">${kind === 'output' ? 'add_box' : 'inventory'}</i>
              <div><h3>${html(title)}</h3><p>${html(help)}</p></div>
            </div>
            <button class="v63-icon-btn" type="button" onclick="v63ClosePickerModal()"><i class="material-icons-round">close</i></button>
          </div>
          <div class="v63-modal-body">
            <input id="v63-picker-search" class="v63-input" type="search" placeholder="พิมพ์ชื่อสินค้า บาร์โค้ด หรือหมวดหมู่" oninput="v63RenderPickerList('${js(kind)}')" autofocus>
            <div id="v63-picker-list" class="v63-search-list"></div>
            <div class="v63-formula-summary" id="v63-picker-selected">
              <strong>ยังไม่ได้เลือกรายการ</strong>
              <span>กดเลือกรายการจากผลค้นหาด้านบน</span>
            </div>
            <div>
              <div class="v63-field-label">${kind === 'formula' ? 'จำนวนที่ใช้ต่อ 1 โม่/1 ครั้ง' : 'จำนวน'}</div>
              <input id="v63-picker-qty" class="v63-input" type="number" min="0" step="0.001" value="">
            </div>
            <div class="v63-actions">
              <button class="btn btn-outline" type="button" onclick="v63ClosePickerModal()">ยกเลิก</button>
              <button class="btn btn-primary" type="button" onclick="v63ConfirmPickedLine()"><i class="material-icons-round">add</i> เพิ่มรายการ</button>
            </div>
          </div>
        </div>
      </div>`);
    const modal = document.getElementById('v63-picker-modal');
    if (modal && target) modal.__targetRow = target;
    window.v63RenderPickerList(kind);
    setTimeout(() => document.getElementById('v63-picker-search')?.focus(), 40);
  };

  window.v63ConfirmPickedLine = function () {
    const modal = document.getElementById('v63-picker-modal');
    if (!modal) return;
    const kind = modal.dataset.kind;
    const productId = modal.dataset.productId;
    const qty = money(document.getElementById('v63-picker-qty')?.value);
    const product = productById(productId);
    if (!productId || !product) { toastMsg('กรุณาเลือกรายการก่อน', 'warning'); return; }
    if (qty <= 0) { toastMsg('กรุณากรอกจำนวน', 'warning'); return; }
    if (kind === 'formula' && modal.__targetRow) {
      const row = modal.__targetRow;
      row.querySelector('[data-v63-formula-material-id]').value = productId;
      row.querySelector('[data-v63-formula-material-qty]').value = qty;
      row.querySelector('[data-v63-formula-material-unit]').textContent = product.unit || '-';
      const pick = row.querySelector('.v63-pick-btn span');
      if (pick) pick.innerHTML = `<strong>${html(product.name || '')}</strong><small>${html(product.barcode || '-')} · หน่วยฐาน ${html(product.unit || '-')}</small>`;
    } else if (kind === 'formula') {
      const body = document.getElementById('v63-formula-materials');
      if (body) {
        body.querySelector('.v63-empty')?.remove();
        body.insertAdjacentHTML('beforeend', formulaRowHtml({ materialId: productId, qty, unit: product.unit || '' }));
      }
    } else if (kind === 'output') {
      const body = document.getElementById('v63-output-body');
      if (body) {
        body.querySelector('.v63-empty')?.remove();
        body.insertAdjacentHTML('beforeend', outputRowHtml({ productId, qty }));
      }
    } else {
      const body = document.getElementById('v63-material-body');
      if (body) {
        body.querySelector('.v63-empty')?.remove();
        body.insertAdjacentHTML('beforeend', productionMaterialRowHtml({ materialId: productId, suggested: qty, qty, unit: product.unit || '' }));
      }
    }
    window.v63ClosePickerModal();
  };

  window.v63CloseFormulaModal = function () {
    document.getElementById('v63-formula-modal')?.remove();
  };

  window.v63OpenFormulaModal = function (formulaId) {
    injectStyle();
    const formula = formulaId ? readFormulas().find(row => String(row.id) === String(formulaId)) : null;
    document.getElementById('v63-formula-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div class="v63-modal-backdrop" id="v63-formula-modal">
        <div class="v63-modal" role="dialog" aria-modal="true">
          <div class="v63-modal-head">
            <div class="v63-modal-title">
              <i class="material-icons-round">science</i>
              <div>
                <h3>${formula ? 'แก้สูตรมิกซ์' : 'สร้างสูตรมิกซ์ใหม่'}</h3>
                <p>สูตรนี้เป็นแม่แบบคำนวณวัตถุดิบ ไม่สร้างสินค้าไว้ขาย และไม่กระทบสูตรตามบิล</p>
              </div>
            </div>
            <button class="v63-icon-btn" type="button" onclick="v63CloseFormulaModal()"><i class="material-icons-round">close</i></button>
          </div>
          <div class="v63-modal-body">
            <input id="v63-formula-id" type="hidden" value="${html(formula?.id || '')}">
            <datalist id="v63-unit-list">
              ${['โม่', 'ถุง', 'กก.', 'ตัน', 'ชิ้น', 'เส้น', 'มัด', 'คิว', 'ลิตร', 'ถัง', 'เที่ยว'].map(unit => `<option value="${html(unit)}"></option>`).join('')}
            </datalist>
            <input id="v63-formula-batch-qty" type="hidden" value="1">
            <div class="v63-modal-grid" style="grid-template-columns:1fr 160px">
              <div>
                <div class="v63-field-label">ชื่อสูตร</div>
                <input id="v63-formula-name" class="v63-input" value="${html(formula?.name || 'สูตรมิกซ์ 1 โม่')}" placeholder="เช่น มิกซ์เสา/ท่อ 1 โม่">
              </div>
              <div>
                <div class="v63-field-label">หน่วยรอบผลิต</div>
                <input id="v63-formula-batch-unit" class="v63-input" value="${html(formula?.batchUnit || 'โม่')}" list="v63-unit-list" placeholder="โม่">
              </div>
            </div>
            <div class="v63-note">สูตรนี้คิดต่อ 1 รอบผลิต เช่น 1 โม่ หรือ 1 ครั้ง ส่วนวันนี้ทำกี่โม่/กี่ครั้ง ให้กรอกในช่อง “วันนี้ผลิตกี่โม่/กี่ครั้ง” ด้านขวา</div>
            <div class="v63-card" style="box-shadow:none">
              <div class="v63-card-h"><span class="v63-card-title"><i class="material-icons-round">inventory</i> วัตถุดิบในสูตร</span><button class="btn btn-outline btn-sm" type="button" onclick="v63AddFormulaMaterial()"><i class="material-icons-round">add</i> เพิ่มวัตถุดิบ</button></div>
              <div class="v63-card-b" id="v63-formula-materials">${(formula?.materials || []).length ? formula.materials.map(formulaRowHtml).join('') : '<div class="v63-empty">กด “เพิ่มวัตถุดิบ” เพื่อค้นหาและใส่จำนวนต่อ 1 รอบผลิต</div>'}</div>
            </div>
            <div class="v63-actions">
              <button class="btn btn-outline" type="button" onclick="v63CloseFormulaModal()">ยกเลิก</button>
              <button class="btn btn-primary" type="button" onclick="v63SaveMixFormula()"><i class="material-icons-round">save</i> บันทึกสูตรมิกซ์</button>
            </div>
          </div>
        </div>
      </div>`);
  };

  window.v63AddOutputRow = function (item) {
    const body = document.getElementById('v63-output-body');
    if (!body) return;
    if (item && item.productId) body.insertAdjacentHTML('beforeend', outputRowHtml(item));
    else window.v63OpenAddLineModal('output');
  };

  window.v63AddManualMaterialRow = function () {
    window.v63OpenAddLineModal('material');
  };

  window.v63SaveMixFormula = function () {
    const id = document.getElementById('v63-formula-id')?.value || `mix-${Date.now()}`;
    const name = document.getElementById('v63-formula-name')?.value?.trim() || 'สูตรมิกซ์ 1 โม่';
    const batchQty = money(document.getElementById('v63-formula-batch-qty')?.value || 1) || 1;
    const batchUnit = document.getElementById('v63-formula-batch-unit')?.value?.trim() || 'โม่';
    const materials = [];
    document.querySelectorAll('[data-v63-formula-material]').forEach(row => {
      const materialId = row.querySelector('[data-v63-formula-material-id]')?.value;
      const qty = money(row.querySelector('[data-v63-formula-material-qty]')?.value);
      const product = productById(materialId);
      const unit = product?.unit || '';
      if (materialId && qty > 0) materials.push({ materialId, qty, unit });
    });
    if (!materials.length) { toastMsg('กรุณาใส่วัตถุดิบในสูตรมิกซ์', 'warning'); return; }
    const rows = readFormulas().filter(row => String(row.id) !== String(id));
    rows.unshift({ id, name, batchQty, batchUnit, materials, updatedAt: new Date().toISOString() });
    writeFormulas(rows);
    window.v63CloseFormulaModal();
    renderFormulaEditor();
    renderFormulaPicker();
    window.v63RecalcBatchMaterials();
    toastMsg('บันทึกสูตรมิกซ์แล้ว', 'success');
  };

  window.v63EditFormula = function () {
    const formula = activeFormula();
    if (!formula) return;
    window.v63OpenFormulaModal(formula.id);
  };

  window.v63DeleteFormula = async function () {
    const formula = activeFormula();
    if (!formula) return;
    const ok = window.Swal?.fire ? await Swal.fire({
      icon: 'warning',
      title: `ลบสูตร "${formula.name}"?`,
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    }) : { isConfirmed: confirm(`ลบสูตร "${formula.name}"?`) };
    if (!ok.isConfirmed) return;
    writeFormulas(readFormulas().filter(row => String(row.id) !== String(formula.id)));
    renderFormulaEditor();
    renderFormulaPicker();
    window.v63RecalcBatchMaterials();
  };

  function renderFormulaEditor(formula) {
    const body = document.getElementById('v63-formula-editor');
    if (!body) return;
    const item = formula || activeFormula();
    if (!item) {
      body.innerHTML = `
        <div class="v63-formula-summary">
          <strong>ยังไม่มีสูตรมิกซ์</strong>
          <span>เริ่มจากสร้างสูตร เช่น “สูตรเสา/ท่อ 1 โม่” แล้วใส่วัตถุดิบพร้อมหน่วยให้ครบ</span>
          <button class="btn btn-primary" type="button" onclick="v63OpenFormulaModal()"><i class="material-icons-round">add</i> สร้างสูตรมิกซ์</button>
        </div>`;
      return;
    }
    const materialText = (item.materials || []).map(row => {
      const product = productById(row.materialId);
      return `${product?.name || row.materialId} ${fmt(row.qty)} ${row.unit || product?.unit || ''}`;
    }).join(' · ');
    body.innerHTML = `
      <div class="v63-formula-summary">
        <strong>${html(item.name || 'สูตรมิกซ์')}</strong>
        <span>สูตรละ ${fmt(item.batchQty || 1)} ${html(item.batchUnit || 'โม่')}</span>
        <span>${html(materialText || 'ยังไม่ได้ใส่วัตถุดิบ')}</span>
        <div class="v63-actions">
          <button class="btn btn-outline" type="button" onclick="v63OpenFormulaModal()"><i class="material-icons-round">add</i> สร้างใหม่</button>
          <button class="btn btn-primary" type="button" onclick="v63OpenFormulaModal('${js(item.id)}')"><i class="material-icons-round">edit</i> แก้สูตรนี้</button>
        </div>
      </div>`;
  }

  window.v63RecalcBatchMaterials = function () {
    const formula = activeFormula();
    const body = document.getElementById('v63-material-body');
    const summary = document.getElementById('v63-batch-summary');
    if (!body) return;
    const batchCount = money(document.getElementById('v63-batch-count')?.value || 1) || 0;
    if (!formula || !formula.materials?.length || batchCount <= 0) {
      body.innerHTML = '<div class="v63-empty">เลือกสูตรมิกซ์และจำนวนโม่ก่อน</div>';
      if (summary) summary.textContent = 'สูตรมิกซ์เป็น template ช่วยคำนวณ ไม่สร้างเป็นสินค้าในคลัง';
      return;
    }
    const factor = batchCount / money(formula.batchQty || 1);
    body.innerHTML = formula.materials.map(item => productionMaterialRowHtml({
      materialId: item.materialId,
      suggested: money(item.qty) * factor,
      qty: money(item.qty) * factor,
      unit: item.unit
    })).join('');
    if (summary) summary.textContent = `ใช้สูตร ${formula.name} จำนวน ${fmt(batchCount)} ${formula.batchUnit || 'โม่'} แล้วแก้ยอดใช้จริงได้ก่อนบันทึก`;
  };

  function collectMaterials() {
    const map = {};
    document.querySelectorAll('[data-v63-prod-material]').forEach(row => {
      const materialId = row.dataset.v63ProdMaterial;
      const qty = money(row.querySelector('[data-v63-prod-material-qty]')?.value);
      if (materialId && qty > 0) map[String(materialId)] = (map[String(materialId)] || 0) + qty;
    });
    return Object.entries(map).map(([productId, qty]) => ({ productId, qty }));
  }

  function collectOutputs() {
    const map = {};
    document.querySelectorAll('[data-v63-output]').forEach(row => {
      const productId = row.querySelector('[data-v63-output-id]')?.value;
      const qty = money(row.querySelector('[data-v63-output-qty]')?.value);
      if (productId && qty > 0) map[String(productId)] = (map[String(productId)] || 0) + qty;
    });
    return Object.entries(map).map(([productId, qty]) => ({ productId, qty }));
  }

  window.v63SaveBatchProduction = async function () {
    const materials = collectMaterials();
    const outputs = collectOutputs();
    const formula = activeFormula();
    if (!materials.length) { toastMsg('กรุณาระบุวัตถุดิบที่ใช้จริง', 'warning'); return; }
    if (!outputs.length) { toastMsg('กรุณาระบุสินค้าที่ได้เข้า stock', 'warning'); return; }

    const ids = [...new Set([...materials, ...outputs].map(row => String(row.productId)))];
    const { data: freshRows, error } = await db.from(PRODUCT_TABLE)
      .select('id,name,stock,unit')
      .in('id', ids);
    if (error) { toastMsg('โหลดสต็อกล่าสุดไม่สำเร็จ: ' + error.message, 'error'); return; }
    const fresh = Object.fromEntries((freshRows || []).map(row => [String(row.id), row]));
    const short = materials.filter(row => money(fresh[String(row.productId)]?.stock) < row.qty);
    if (short.length) {
      const ok = window.Swal?.fire ? await Swal.fire({
        icon: 'warning',
        title: 'วัตถุดิบไม่พอ',
        html: short.map(row => {
          const product = fresh[String(row.productId)] || productById(row.productId);
          return `${html(product?.name || row.productId)} มี ${fmt(product?.stock)} ใช้ ${fmt(row.qty)}`;
        }).join('<br>'),
        showCancelButton: true,
        confirmButtonText: 'บันทึกต่อ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626'
      }) : { isConfirmed: confirm('วัตถุดิบบางรายการไม่พอ ต้องการบันทึกต่อหรือไม่?') };
      if (!ok.isConfirmed) return;
    }

    const refId = `BATCH-${Date.now()}`;
    const now = new Date().toISOString();
    const staff = (() => { try { return USER?.username || ''; } catch (_) { return ''; } })();
    const movements = [];

    try {
      for (const row of materials) {
        const product = fresh[String(row.productId)];
        if (!product) throw new Error('ไม่พบวัตถุดิบ: ' + row.productId);
        const before = money(product.stock);
        const after = before - row.qty;
        const { error: updateError } = await db.from(PRODUCT_TABLE).update({ stock: after, updated_at: now }).eq('id', row.productId);
        if (updateError) throw updateError;
        product.stock = after;
        movements.push({
          product_id: row.productId,
          product_name: product.name || row.productId,
          type: 'ใช้ผลิตรวม',
          direction: 'out',
          qty: row.qty,
          stock_before: before,
          stock_after: after,
          ref_id: refId,
          ref_table: 'batch_production',
          staff_name: staff,
          note: formula ? `สูตรมิกซ์: ${formula.name}` : 'ผลิตรวม'
        });
      }

      for (const row of outputs) {
        const product = fresh[String(row.productId)];
        if (!product) throw new Error('ไม่พบสินค้าที่ได้: ' + row.productId);
        const before = money(product.stock);
        const after = before + row.qty;
        const { error: updateError } = await db.from(PRODUCT_TABLE).update({ stock: after, updated_at: now }).eq('id', row.productId);
        if (updateError) throw updateError;
        product.stock = after;
        movements.push({
          product_id: row.productId,
          product_name: product.name || row.productId,
          type: 'ผลิตรวมเข้า stock',
          direction: 'in',
          qty: row.qty,
          stock_before: before,
          stock_after: after,
          ref_id: refId,
          ref_table: 'batch_production',
          staff_name: staff,
          note: formula ? `ได้จากสูตรมิกซ์: ${formula.name}` : 'ผลิตรวม'
        });
      }

      if (movements.length) {
        const { error: movementError } = await db.from(MOVEMENT_TABLE).insert(movements);
        if (movementError) throw movementError;
      }
      updateProductCache(Object.values(fresh));
      try { renderProductGrid?.(); } catch (_) {}
      logActivity?.('ผลิตรวม', `${formula?.name || 'ไม่ระบุสูตร'} (${refId})`);
      toastMsg('บันทึกผลิตรวมและตัดวัตถุดิบสำเร็จ', 'success');
      const body = document.getElementById('v9-admin-content') || document.getElementById('v9-manage-inner');
      if (body) window.v9AdminProduce(body);
    } catch (saveError) {
      console.error('[v63] batch production save:', saveError);
      toastMsg('บันทึกผลิตรวมไม่สำเร็จ: ' + (saveError.message || saveError), 'error');
    }
  };

  window.v9AdminProduce = async function (container) {
    if (!container) return;
    injectStyle();
    const formulas = readFormulas();
    container.innerHTML = `
      <div class="v63-wrap">
        <div class="v63-hero">
          <div class="v63-title">
            <i class="material-icons-round">precision_manufacturing</i>
            <div>
              <h3>ผลิตรวม</h3>
              <p>ทำงานแบบหลังร้าน: ตั้งสูตรมิกซ์ไว้ช่วยคำนวณ จากนั้นบันทึกว่าวันนี้ผสมกี่โม่ ใช้วัตถุดิบจริงเท่าไหร่ และได้สินค้าอะไรเข้า stock บ้าง</p>
            </div>
          </div>
          <span class="v63-pill"><i class="material-icons-round">receipt_long</i> สูตรตามบิลยังใช้ตอนขายเหมือนเดิม</span>
        </div>

        <div class="v63-steps">
          <div class="v63-step"><b>1</b><div><strong>สร้างสูตรมิกซ์</strong><span>เช่น สูตรปูน 1 โม่ ใช้วัตถุดิบอะไรบ้าง</span></div></div>
          <div class="v63-step"><b>2</b><div><strong>กรอกที่ผลิตวันนี้</strong><span>ใส่จำนวนโม่และแก้ยอดใช้จริงได้</span></div></div>
          <div class="v63-step"><b>3</b><div><strong>เพิ่มของที่ได้เข้า stock</strong><span>เลือกเสา ท่อ หรือสินค้าอื่น พร้อมจำนวน</span></div></div>
        </div>

        <div class="v63-grid">
          <div class="v63-card">
            <div class="v63-card-h">
              <span class="v63-card-title"><i class="material-icons-round">science</i> สูตรมิกซ์ต่อรอบ</span>
              <div class="v63-actions">
                <button class="btn btn-primary btn-sm" type="button" onclick="v63OpenFormulaModal()"><i class="material-icons-round">add</i> สร้างสูตร</button>
                <button class="btn btn-outline btn-sm" type="button" onclick="v63EditFormula()"><i class="material-icons-round">edit</i> แก้</button>
                <button class="btn btn-outline btn-sm" type="button" onclick="v63DeleteFormula()"><i class="material-icons-round">delete</i> ลบ</button>
              </div>
            </div>
            <div class="v63-card-b">
              <select id="v63-formula-select" class="v63-input" onchange="renderFormulaEditor();v63RecalcBatchMaterials()">
                ${formulas.length ? formulas.map(row => `<option value="${html(row.id)}">${html(row.name)} (${fmt(row.batchQty || 1)} ${html(row.batchUnit || 'โม่')})</option>`).join('') : '<option value="">ยังไม่มีสูตรมิกซ์</option>'}
              </select>
              <div class="v63-note">สูตรนี้เป็นแค่ template ช่วยคำนวณ ไม่ถูกสร้างเป็นสินค้าไว้ขาย</div>
              <div id="v63-formula-editor"></div>
            </div>
          </div>

          <div class="v63-card">
            <div class="v63-card-h"><span class="v63-card-title"><i class="material-icons-round">assignment_turned_in</i> ผลิตวันนี้</span></div>
            <div class="v63-card-b">
              <div class="v63-form-grid">
                <input id="v63-batch-count" class="v63-input" type="number" min="0.001" step="0.001" value="1" oninput="v63RecalcBatchMaterials()" placeholder="วันนี้ผลิตกี่โม่/กี่ครั้ง">
                <button class="btn btn-outline" type="button" onclick="v63RecalcBatchMaterials()"><i class="material-icons-round">calculate</i> คำนวณ</button>
              </div>
              <div class="v63-note" id="v63-batch-summary">เลือกสูตรมิกซ์เพื่อเติมวัตถุดิบอัตโนมัติ</div>
              <div>
                <div class="v63-card-h v63-section-head"><span class="v63-card-title"><i class="material-icons-round">inventory</i> วัตถุดิบที่ใช้จริง</span><button class="btn btn-outline btn-sm" type="button" onclick="v63AddManualMaterialRow()"><i class="material-icons-round">add</i> เพิ่มเอง</button></div>
                <div id="v63-material-body"><div class="v63-empty">เลือกสูตรมิกซ์และจำนวนโม่ก่อน</div></div>
              </div>
              <div>
                <div class="v63-card-h v63-section-head"><span class="v63-card-title"><i class="material-icons-round">add_box</i> สินค้าที่ได้เข้า stock</span><button class="btn btn-outline btn-sm" type="button" onclick="v63AddOutputRow()"><i class="material-icons-round">add</i> เพิ่มสินค้า</button></div>
                <div id="v63-output-body"><div class="v63-empty">กด “เพิ่มสินค้า” เพื่อค้นหาและระบุจำนวนสินค้าที่ผลิตได้</div></div>
              </div>
              <div class="v63-actions">
                <button class="btn btn-primary v63-save" type="button" onclick="v63SaveBatchProduction()"><i class="material-icons-round">save</i> บันทึกผลิตรวม</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    renderFormulaEditor();
    renderFormulaPicker();
    window.v63RecalcBatchMaterials();
  };

  function removeOldStockProductionEntrypoints() {
    document.querySelectorAll('button[onclick*="v9RecipeProduce"], input[id^="v9rec-produce-qty"]').forEach(el => {
      const box = el.closest('div[style*="display:flex"]') || el;
      box.remove();
    });
    document.querySelectorAll('button, a, .v36-admin-menu-title, .v9-admin-tab').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text === 'ผลิตสินค้า' || text === 'ตัดวัตถุดิบ' || text === 'produce') el.textContent = 'ผลิตรวม';
    });
    document.querySelectorAll('.v36-admin-panel-title, .page-title, #page-title-text, h1, h2, h3').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text === 'produce') el.textContent = 'ผลิตรวม';
    });
  }

  function boot() {
    injectStyle();
    setGlobal('v9AdminProduce', window.v9AdminProduce);
    setGlobal('v9RecipeProduce', function () {
      toastMsg('ปิดการผลิตสินค้าเข้าสต็อกแบบเดิมแล้ว กรุณาใช้หน้า “ผลิตรวม”', 'warning');
    });
    setGlobal('v61SaveProduction', function () {
      toastMsg('ปิดการผลิตสินค้าเข้าสต็อกแบบเดิมแล้ว กรุณาใช้หน้า “ผลิตรวม”', 'warning');
    });
    removeOldStockProductionEntrypoints();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  [300, 900, 1800, 4000, 8000].forEach(delay => setTimeout(boot, delay));
  if (!window.__v63BatchProductionObserver) {
    window.__v63BatchProductionObserver = new MutationObserver(removeOldStockProductionEntrypoints);
    window.__v63BatchProductionObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
