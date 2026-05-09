(function () {
  'use strict';

  console.log('[v64] POS unit popup and barcode search polish loaded');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
  const js = value => JSON.stringify(String(value ?? ''));
  const money = value => {
    const n = Number(value || 0);
    return typeof formatNum === 'function' ? formatNum(n) : n.toLocaleString('th-TH');
  };
  const qtyText = value => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return Number.isInteger(n) ? n.toLocaleString('th-TH') : Number(n.toFixed(4)).toLocaleString('th-TH');
  };
  const clean = value => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  function getProducts() {
    try {
      if (Array.isArray(products)) return products;
    } catch (_) {}
    return Array.isArray(window.products) ? window.products : [];
  }

  function isMadeToOrder(product) {
    return String(product?.product_type || '').includes('ตามบิล');
  }

  function isSellableByRecipe(product) {
    const type = String(product?.product_type || '').toLowerCase();
    return isMadeToOrder(product) || type.includes('made') || type.includes('mto') || type.includes('bill');
  }

  function installStyles() {
    if (document.getElementById('v64-pos-polish-style')) return;
    const style = document.createElement('style');
    style.id = 'v64-pos-polish-style';
    style.textContent = `
      .modal-box.v64-unit-modal {
        width: min(760px, calc(100vw - 32px)) !important;
        max-height: min(86vh, 760px) !important;
        border-radius: 24px !important;
        overflow: hidden;
      }
      .modal-box.v64-unit-modal .modal-header {
        padding: 18px 22px !important;
        background: #ffffff;
      }
      .modal-box.v64-unit-modal .modal-body {
        padding: 0 !important;
        background: #f8fafc;
      }
      .v64-unit-wrap {
        padding: 18px;
        display: grid;
        gap: 14px;
      }
      .v64-unit-hero {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 16px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        align-items: center;
      }
      .v64-unit-title {
        font-size: 20px;
        font-weight: 900;
        color: #0f172a;
        line-height: 1.25;
      }
      .v64-unit-meta {
        margin-top: 6px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
      }
      .v64-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 9px;
        border-radius: 999px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
      }
      .v64-stock-box {
        min-width: 118px;
        padding: 11px 13px;
        border-radius: 16px;
        background: #ecfdf5;
        border: 1px solid #bbf7d0;
        text-align: right;
      }
      .v64-stock-box span {
        display: block;
        color: #64748b;
        font-size: 11px;
        font-weight: 800;
      }
      .v64-stock-box b {
        color: #047857;
        font-size: 22px;
        line-height: 1.1;
      }
      .v64-unit-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
        gap: 10px;
      }
      .v64-unit-card {
        min-height: 128px;
        border: 1px solid #dbe3ef;
        background: #ffffff;
        border-radius: 16px;
        padding: 14px;
        cursor: pointer;
        text-align: left;
        position: relative;
        transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease, background .12s ease;
      }
      .v64-unit-card:hover {
        transform: translateY(-1px);
        border-color: #ef4444;
        box-shadow: 0 14px 30px rgba(15, 23, 42, .08);
      }
      .v64-unit-card.is-selected {
        border-color: #ef4444;
        background: #fff7f7;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, .12);
      }
      .v64-unit-card.is-disabled {
        opacity: .45;
        cursor: not-allowed;
        pointer-events: none;
      }
      .v64-unit-margin {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 3px 7px;
        border-radius: 999px;
        background: #ecfdf5;
        color: #059669;
        font-size: 10px;
        font-weight: 900;
      }
      .v64-unit-price {
        color: #e11d48;
        font-size: 25px;
        font-weight: 950;
        line-height: 1;
        margin-top: 8px;
      }
      .v64-unit-name {
        margin-top: 10px;
        font-size: 18px;
        font-weight: 900;
        color: #111827;
      }
      .v64-unit-sub {
        margin-top: 5px;
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
      }
      .v64-unit-available {
        margin-top: 8px;
        color: #047857;
        font-size: 12px;
        font-weight: 900;
      }
      .v64-qty-panel {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 14px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        border-radius: 18px;
      }
      .v64-qty-label {
        grid-column: 1 / -1;
        color: #334155;
        font-size: 13px;
        font-weight: 900;
      }
      .v64-step-btn {
        width: 46px;
        height: 46px;
        border-radius: 14px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #334155;
        font-size: 24px;
        font-weight: 900;
        cursor: pointer;
      }
      .v64-qty-input {
        height: 46px;
        border-radius: 14px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #0f172a;
        text-align: center;
        font-size: 20px;
        font-weight: 900;
        outline: none;
        font-family: var(--font-thai, 'Prompt'), sans-serif;
      }
      .v64-preview {
        grid-column: 1 / -1;
        min-height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        background: #f8fafc;
        color: #64748b;
        font-size: 13px;
        font-weight: 800;
      }
      .v64-confirm {
        width: 100%;
        height: 54px;
        border: 0;
        border-radius: 16px;
        background: #ef4444;
        color: #fff;
        font-size: 17px;
        font-weight: 950;
        cursor: pointer;
        box-shadow: 0 14px 28px rgba(239, 68, 68, .24);
      }
      .v64-confirm:disabled {
        background: #cbd5e1;
        box-shadow: none;
        cursor: not-allowed;
      }
      #pos-search.v64-scan-ready {
        box-shadow: 0 0 0 3px rgba(20, 184, 166, .18);
      }
      @media (max-width: 640px) {
        .modal-box.v64-unit-modal { width: calc(100vw - 18px) !important; max-height: 88vh !important; }
        .v64-unit-wrap { padding: 12px; }
        .v64-unit-hero { grid-template-columns: 1fr; }
        .v64-stock-box { text-align: left; }
        .v64-unit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  function installModalCleanup() {
    if (window.__v64ModalCleanupInstalled) return;
    window.__v64ModalCleanupInstalled = true;
    const originalCloseModal = window.closeModal;
    if (typeof originalCloseModal === 'function') {
      window.closeModal = function () {
        document.querySelector('.modal-box')?.classList.remove('v64-unit-modal');
        return originalCloseModal.apply(this, arguments);
      };
      try { closeModal = window.closeModal; } catch (_) {}
    }
  }

  window.v9ShowUnitPopup = function (prod, sellUnits) {
    if (typeof openModal !== 'function' || !prod) return;
    installStyles();

    const units = Array.isArray(sellUnits) ? sellUnits.filter(Boolean) : [];
    const baseUnit = prod.unit || 'ชิ้น';
    const stock = Number(prod.stock || 0);
    const costBase = Number(prod.cost || 0);
    const mto = isMadeToOrder(prod);

    if (!units.length) {
      if (typeof window.v9PushToCart === 'function') window.v9PushToCart(prod, Number(prod.price || 0), baseUnit, 1, 1);
      else if (typeof addToCart === 'function') addToCart(prod.id);
      return;
    }

    const cardHtml = units.map((u, index) => {
      const unitName = u.unit_name || baseUnit;
      const conv = Number(u.conv_rate || 1);
      const price = Number(u.price_per_unit || 0);
      const maxQty = mto ? 9999 : Math.floor(stock / Math.max(conv, 0.000001));
      const costUnit = costBase * conv;
      const margin = price > 0 && costUnit > 0 ? Math.round(((price - costUnit) / price) * 100) : 0;
      const canSell = mto || (maxQty > 0 && price > 0);
      return `
        <button type="button"
          class="v64-unit-card ${index === 0 && canSell ? 'is-selected' : ''} ${canSell ? '' : 'is-disabled'}"
          data-v64-unit-card="1"
          data-unit-name="${esc(unitName)}"
          data-price="${price}"
          data-conv="${conv}"
          data-stock="${stock}">
          ${margin > 0 ? `<span class="v64-unit-margin">กำไร ${margin}%</span>` : ''}
          <div class="v64-unit-price">${price > 0 ? `฿${money(price)}` : 'ยังไม่ตั้งราคา'}</div>
          <div class="v64-unit-name">${esc(unitName)}</div>
          <div class="v64-unit-sub">1 ${esc(unitName)} = ${qtyText(conv)} ${esc(baseUnit)}</div>
          ${mto ? '<div class="v64-unit-available">ผลิตตามบิล</div>' : `<div class="v64-unit-available">ขายได้ ${qtyText(maxQty)} ${esc(unitName)}</div>`}
        </button>`;
    }).join('');

    openModal(`เลือกหน่วย: ${prod.name}`, `
      <div class="v64-unit-wrap">
        <section class="v64-unit-hero">
          <div>
            <div class="v64-unit-title">${esc(prod.name)}</div>
            <div class="v64-unit-meta">
              <span class="v64-pill"><i class="material-icons-round" style="font-size:15px">sell</i>${esc(units.length)} หน่วยขาย</span>
              <span class="v64-pill">หน่วยฐาน ${esc(baseUnit)}</span>
              ${mto ? '<span class="v64-pill" style="background:#f5f3ff;color:#6d28d9;border-color:#ddd6fe">สูตรตามบิล</span>' : ''}
            </div>
          </div>
          ${mto ? '' : `<div class="v64-stock-box"><span>คงเหลือ</span><b>${qtyText(stock)}</b><span>${esc(baseUnit)}</span></div>`}
        </section>

        <section class="v64-unit-grid" id="v64-unit-grid">${cardHtml}</section>

        <section class="v64-qty-panel">
          <div class="v64-qty-label">จำนวน <span id="v64-picked-unit" style="color:#ef4444">เลือกหน่วยก่อน</span></div>
          <button type="button" class="v64-step-btn" onclick="v64UnitQtyChange(-1)">-</button>
          <input class="v64-qty-input" id="v64-unit-qty" type="number" value="1" min="0.001" step="any" oninput="v64UnitQtyUpdate()">
          <button type="button" class="v64-step-btn" onclick="v64UnitQtyChange(1)">+</button>
          <div class="v64-preview" id="v64-unit-preview">เลือกหน่วยที่ต้องการขายก่อน</div>
        </section>

        <button class="v64-confirm" id="v64-unit-add-btn" type="button" onclick="v64ConfirmUnitAdd()" disabled>
          เลือกหน่วยก่อน
        </button>
      </div>
    `);

    document.querySelector('.modal-box')?.classList.add('v64-unit-modal');
    window._v64UnitPopupProd = prod;
    window._v64UnitPopupSel = null;

    const first = document.querySelector('[data-v64-unit-card]:not(.is-disabled)');
    if (first) {
      const u = units.find(unit => String(unit.unit_name || baseUnit) === first.querySelector('.v64-unit-name')?.textContent);
      if (u) window.v64PickSellUnit(prod.id, u.unit_name || baseUnit, Number(u.price_per_unit || 0), Number(u.conv_rate || 1), stock, first);
    }
  };

  window.v64PickSellUnit = function (_productId, unitName, price, conv, stock, card) {
    document.querySelectorAll('[data-v64-unit-card]').forEach(el => el.classList.remove('is-selected'));
    card?.classList?.add('is-selected');
    window._v64UnitPopupSel = {
      unitName,
      price: Number(price || 0),
      conv: Number(conv || 1),
      stock: Number(stock || 0),
    };
    const label = document.getElementById('v64-picked-unit');
    if (label) label.textContent = unitName;
    const btn = document.getElementById('v64-unit-add-btn');
    if (btn) {
      btn.disabled = Number(price || 0) <= 0;
      btn.textContent = Number(price || 0) > 0 ? `เพิ่มเข้าตะกร้า - ฿${money(price)} / ${unitName}` : 'หน่วยนี้ยังไม่ตั้งราคา';
    }
    window.v64UnitQtyUpdate();
  };

  window.v64UnitQtyChange = function (delta) {
    const input = document.getElementById('v64-unit-qty');
    if (!input) return;
    const next = Math.max(0.001, Number(input.value || 1) + Number(delta || 0));
    input.value = Number(next.toFixed(4));
    window.v64UnitQtyUpdate();
  };

  window.v64UnitQtyUpdate = function () {
    const sel = window._v64UnitPopupSel;
    const prod = window._v64UnitPopupProd;
    const preview = document.getElementById('v64-unit-preview');
    if (!preview || !sel || !prod) return;
    const qty = Math.max(0.001, Number(document.getElementById('v64-unit-qty')?.value || 1));
    const baseQty = qty * sel.conv;
    const total = qty * sel.price;
    preview.innerHTML = `รวม <strong style="color:#ef4444;margin:0 4px">฿${money(total)}</strong> ตัดสต็อก ${qtyText(baseQty)} ${esc(prod.unit || '')}`;
  };

  window.v64ConfirmUnitAdd = function () {
    const sel = window._v64UnitPopupSel;
    const prod = window._v64UnitPopupProd;
    if (!sel || !prod) return;
    const qty = Math.max(0.001, Number(document.getElementById('v64-unit-qty')?.value || 1));
    const baseQty = qty * sel.conv;
    if (!isMadeToOrder(prod) && baseQty > Number(prod.stock || 0)) {
      typeof toast === 'function' && toast(`สต็อกไม่พอ เหลือ ${qtyText(Number(prod.stock || 0) / sel.conv)} ${sel.unitName}`, 'error');
      return;
    }
    if (typeof closeModal === 'function') closeModal();
    document.querySelector('.modal-box')?.classList.remove('v64-unit-modal');
    if (typeof window.v9PushToCart === 'function') window.v9PushToCart(prod, sel.price, sel.unitName, sel.conv, qty);
  };

  const scannerState = {
    firstAt: 0,
    lastAt: 0,
    keys: 0,
    slow: false,
    timer: 0,
    committing: false,
  };

  function findProductByBarcode(code) {
    const cleanCode = clean(code);
    return getProducts().find(p => clean(p?.barcode) === cleanCode);
  }

  function resetScannerState() {
    clearTimeout(scannerState.timer);
    scannerState.firstAt = 0;
    scannerState.lastAt = 0;
    scannerState.keys = 0;
    scannerState.slow = false;
    scannerState.committing = false;
  }

  async function addBarcodeFromPosSearch(input, forced) {
    if (!input || scannerState.committing) return false;
    const code = clean(input.value);
    if (!code) return false;
    const scannerLike = forced || (scannerState.keys >= 4 && !scannerState.slow && Date.now() - scannerState.firstAt <= Math.max(320, scannerState.keys * 90));
    if (!scannerLike) return false;

    const found = findProductByBarcode(code);
    if (!found) return false;

    scannerState.committing = true;
    try {
      if (typeof window.v40AddBarcodeToCartOnce === 'function') {
        const ok = window.v40AddBarcodeToCartOnce(code, { silent: true });
        if (!ok) return false;
      } else if (typeof addToCart === 'function') {
        await addToCart(found.id);
      }
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.classList.add('v64-scan-ready');
      window.setTimeout(() => input.classList.remove('v64-scan-ready'), 180);
      return true;
    } finally {
      resetScannerState();
    }
  }

  function wrapCameraBarcodeStockGuard() {
    if (window.__v64BarcodeStockGuardWrapped || typeof window.v40AddBarcodeToCartOnce !== 'function') return;
    const original = window.v40AddBarcodeToCartOnce;
    window.v40AddBarcodeToCartOnce = function (rawCode, opts = {}) {
      const code = clean(rawCode);
      const found = findProductByBarcode(code);
      if (found && isSellableByRecipe(found) && num(found.stock) <= 0) {
        if (typeof addToCart === 'function') addToCart(found.id);
        const searchInput = document.getElementById('pos-search');
        if (searchInput) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (!opts.silent && typeof toast === 'function') toast(`เพิ่ม ${found.name} แล้ว`, 'success');
        return true;
      }
      return original.call(this, rawCode, opts);
    };
    window.__v64BarcodeStockGuardWrapped = true;
  }

  function installPosSearchScanner() {
    if (window.__v64PosSearchScannerInstalled) return;
    window.__v64PosSearchScannerInstalled = true;

    document.addEventListener('keydown', event => {
      const input = event.target?.id === 'pos-search' ? event.target : null;
      if (!input || event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === 'Enter' || event.key === 'Tab') {
        const code = clean(input.value);
        if (!code || !findProductByBarcode(code)) return;
        event.preventDefault();
        event.stopPropagation();
        addBarcodeFromPosSearch(input, true);
        return;
      }

      if (event.key.length !== 1) return;
      const now = Date.now();
      if (!scannerState.firstAt || now - scannerState.lastAt > 500) {
        scannerState.firstAt = now;
        scannerState.keys = 0;
        scannerState.slow = false;
      } else if (now - scannerState.lastAt > 95) {
        scannerState.slow = true;
      }
      scannerState.lastAt = now;
      scannerState.keys += 1;
      clearTimeout(scannerState.timer);
      scannerState.timer = setTimeout(() => addBarcodeFromPosSearch(input, false), 160);
    }, true);

    document.addEventListener('input', event => {
      const input = event.target?.id === 'pos-search' ? event.target : null;
      if (!input) return;
      clearTimeout(scannerState.timer);
      scannerState.timer = setTimeout(() => addBarcodeFromPosSearch(input, false), 170);
    }, true);
  }

  function installUnitCardPicker() {
    if (window.__v64UnitCardPickerInstalled) return;
    window.__v64UnitCardPickerInstalled = true;
    document.addEventListener('click', event => {
      const card = event.target?.closest?.('[data-v64-unit-card]');
      if (!card || card.classList.contains('is-disabled')) return;
      event.preventDefault();
      event.stopPropagation();
      const prod = window._v64UnitPopupProd;
      window.v64PickSellUnit(
        prod?.id,
        card.dataset.unitName || '',
        Number(card.dataset.price || 0),
        Number(card.dataset.conv || 1),
        Number(card.dataset.stock || 0),
        card
      );
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      installStyles();
      installModalCleanup();
      installUnitCardPicker();
      wrapCameraBarcodeStockGuard();
      installPosSearchScanner();
      [400, 1200].forEach(delay => setTimeout(wrapCameraBarcodeStockGuard, delay));
    });
  } else {
    installStyles();
    installModalCleanup();
    installUnitCardPicker();
    wrapCameraBarcodeStockGuard();
    installPosSearchScanner();
    [400, 1200].forEach(delay => setTimeout(wrapCameraBarcodeStockGuard, delay));
  }
})();
