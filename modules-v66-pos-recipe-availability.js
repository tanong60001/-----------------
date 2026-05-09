(function () {
  'use strict';

  console.log('[v66] POS recipe availability rewrite loaded');

  const RECIPE_TABLE = '\u0e2a\u0e39\u0e15\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
  const UNIT_TABLE = 'product_units';
  const CACHE_MS = 30000;
  const POS_LIMIT = 60;
  const RECIPE_TIMEOUT_MS = 3500;

  const state = {
    recipes: [],
    recipeMap: new Map(),
    loadedAt: 0,
    loading: null,
    originalAddToCart: null,
    originalRenderProductGrid: null,
    originalUpdateCartQty: null,
    originalRenderInventory: null,
    originalV42ProductActions: null,
    originalEditProduct: null,
    originalAdjustStock: null,
    originalDeleteProduct: null,
    originalSale: null,
    renderingGrid: false,
    protectingInventory: false,
    extraOpeningAt: 0,
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));

  const js = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const num = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => {
    const n = num(value);
    return typeof formatNum === 'function'
      ? formatNum(n)
      : n.toLocaleString('th-TH', { maximumFractionDigits: 4 });
  };
  const money = value => `฿${fmt(value)}`;

  function setGlobal(name, fn) {
    window[name] = fn;
    try { Function('name', 'fn', 'window[name] = fn; eval(name + " = fn");')(name, fn); }
    catch (_) {}
  }

  function productsList() {
    try { if (Array.isArray(products)) return products; } catch (_) {}
    return Array.isArray(window.products) ? window.products : [];
  }

  function cartList() {
    try { if (Array.isArray(cart)) return cart; } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }

  function setCart(next) {
    try { cart = next; } catch (_) {}
    window.cart = next;
  }

  function productMap() {
    const map = new Map();
    productsList().forEach(product => map.set(String(product.id), product));
    return map;
  }

  function productById(productId) {
    return productsList().find(product => String(product.id) === String(productId));
  }

  function normalizedText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isRecipeManagedProduct(product) {
    if (!product) return false;
    if (product.__v66_recipe_product || hasRecipe(product.id)) return true;
    const type = normalizedText(product.product_type);
    return type === '\u0e15\u0e32\u0e21\u0e1a\u0e34\u0e25' || type.includes('\u0e15\u0e32\u0e21\u0e1a\u0e34\u0e25') || type.includes('make to order') || type.includes('mto');
  }

  function rebuildRecipeMap(rows) {
    const next = new Map();
    (rows || []).forEach(row => {
      const pid = String(row.product_id || '');
      if (!pid) return;
      if (!next.has(pid)) next.set(pid, []);
      next.get(pid).push(row);
    });
    state.recipeMap = next;
  }

  async function loadRecipes(force = false) {
    if (typeof db === 'undefined') return state.recipes;
    if (!force && Date.now() - state.loadedAt < CACHE_MS) return state.recipes;
    if (state.loading && !force) return state.loading;

    const request = db.from(RECIPE_TABLE)
      .select('id,product_id,material_id,quantity,unit')
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        state.recipes = data || [];
        state.loadedAt = Date.now();
        rebuildRecipeMap(state.recipes);
        window.__v66Debug = {
          recipeCount: state.recipes.length,
          recipeProductIds: [...state.recipeMap.keys()],
          loadedAt: new Date(state.loadedAt).toISOString(),
        };
        return state.recipes;
      })
      .catch(error => {
        console.warn('[v66] cannot load recipe table:', error);
        window.__v66Debug = { error: error?.message || String(error), recipeCount: state.recipes.length };
        return state.recipes;
      });

    const timeout = new Promise(resolve => {
      setTimeout(() => {
        console.warn('[v66] recipe load timeout - POS continues without blocking');
        resolve(state.recipes);
      }, RECIPE_TIMEOUT_MS);
    });

    state.loading = Promise.race([request, timeout]).finally(() => { state.loading = null; });

    return state.loading;
  }

  function recipeRows(productId) {
    return state.recipeMap.get(String(productId)) || [];
  }

  function hasRecipe(productId) {
    return recipeRows(productId).length > 0;
  }

  function recipeCost(productId) {
    const map = productMap();
    return recipeRows(productId).reduce((sum, row) => {
      const material = map.get(String(row.material_id)) || {};
      return sum + num(row.quantity) * num(material.cost);
    }, 0);
  }

  function recipeCapacity(productId) {
    const rows = recipeRows(productId);
    if (!rows.length) return null;
    const map = productMap();
    let capacity = Infinity;
    rows.forEach(row => {
      const material = map.get(String(row.material_id)) || {};
      const qty = num(row.quantity);
      if (qty > 0) capacity = Math.min(capacity, num(material.stock) / qty);
    });
    return Number.isFinite(capacity) ? Math.max(0, capacity) : 0;
  }

  function reservedRecipeBaseQty(productId) {
    return cartList()
      .filter(item => item?.recipe_product && String(item.id) === String(productId))
      .reduce((sum, item) => sum + num(item.qty) * Math.max(0.000001, num(item.conv_rate || 1)), 0);
  }

  function remainingRecipeBaseQty(productId) {
    const capacity = recipeCapacity(productId);
    if (capacity === null) return null;
    return Math.max(0, capacity - reservedRecipeBaseQty(productId));
  }

  function syncRecipeFields() {
    productsList().forEach(product => {
      if (!hasRecipe(product.id)) return;
      product.__v66_recipe_product = true;
      product.__v66_recipe_capacity = recipeCapacity(product.id);
      product.__v66_recipe_remaining = remainingRecipeBaseQty(product.id);
    });
  }

  function activeCategoryText() {
    try { return String(activeCategory || ''); } catch (_) { return ''; }
  }

  function searchText() {
    const el = document.querySelector('#pos-search, #searchInput, input[type="search"], input[placeholder*="ค้นหา"]');
    return String(el?.value || '').trim().toLowerCase();
  }

  function isAllCategory(category) {
    const text = String(category || '').trim().toLowerCase();
    return !text || text === 'all' || /ทั้งหมด|ทุก|หมวดทั้งหมด/.test(text);
  }

  function productMatches(product, search) {
    if (!search) return true;
    return [product.name, product.barcode, product.category, product.unit]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search);
  }

  function isRawOnlyProduct(product) {
    if (hasRecipe(product.id)) return false;
    const type = String(product.product_type || '').toLowerCase();
    const category = String(product.category || '').toLowerCase();
    if (/both|sale|sell|ขาย|ตามบิล/.test(type)) return false;
    if (product.is_raw === true) return true;
    return /raw|material|วัตถุดิบ/.test(type) || /raw|material|วัตถุดิบ/.test(category);
  }

  function currentViewMode() {
    try { if (viewMode) return viewMode; } catch (_) {}
    return document.querySelector('.view-btn.active .material-icons-round')?.textContent?.includes('list')
      ? 'list'
      : 'grid';
  }

  function cartItemFor(productId) {
    return cartList().find(item => String(item.id) === String(productId));
  }

  function isProductOut(product) {
    if (hasRecipe(product.id)) return remainingRecipeBaseQty(product.id) <= 0;
    return num(product.stock) <= 0;
  }

  function stockText(product) {
    if (hasRecipe(product.id)) {
      const remaining = remainingRecipeBaseQty(product.id);
      if (remaining > 0) return `ผลิตได้ ${fmt(Math.floor(remaining * 1000) / 1000)} ${product.unit || ''}`;
      return 'วัตถุดิบไม่พอ';
    }
    return num(product.stock) > 0 ? fmt(product.stock) : 'หมด';
  }

  function renderCard(product, mode) {
    const recipe = hasRecipe(product.id);
    const out = isProductOut(product);
    const low = !recipe && num(product.stock) > 0 && num(product.stock) <= num(product.min_stock);
    const inCart = cartItemFor(product.id);
    const badge = recipe ? '<span class="v66-recipe-badge">สูตรผลิต</span>' : '';
    const stockStyle = recipe && !out ? 'style="color:#047857"' : '';
    const sku = recipe ? `สูตร • ต้นทุน ${money(recipeCost(product.id))}` : esc(product.barcode || '-');
    const attrs = `data-v66-product-id="${esc(product.id)}" data-v66-recipe="${recipe ? '1' : '0'}"`;
    const image = product.img_url
      ? `<img src="${esc(product.img_url)}" alt="${esc(product.name)}" loading="lazy">`
      : '<i class="material-icons-round">inventory_2</i>';

    if (mode === 'list') {
      return `<div class="product-list-item ${out ? 'out-of-stock' : ''}" ${attrs} onclick="addToCart('${js(product.id)}')">
        ${badge}
        <div class="product-list-img">${image}</div>
        <div class="product-list-info">
          <div class="product-name">${esc(product.name)}</div>
          <div class="product-sku">${sku}</div>
        </div>
        <div class="product-list-right">
          <span class="product-price">${money(product.price)}</span>
          <span class="product-stock ${low ? 'low' : ''} ${out ? 'out' : ''}" ${stockStyle}>${esc(stockText(product))}</span>
          ${inCart ? `<span class="product-badge">${fmt(inCart.qty)}</span>` : ''}
        </div>
      </div>`;
    }

    return `<div class="product-card ${out ? 'out-of-stock' : ''}" ${attrs} onclick="addToCart('${js(product.id)}')">
      ${badge}
      <div class="product-img">${image}${inCart ? `<span class="product-badge">${fmt(inCart.qty)}</span>` : ''}</div>
      <div class="product-info">
        <div class="product-name">${esc(product.name)}</div>
        <div class="product-sku">${sku}</div>
        <div class="product-footer">
          <span class="product-price">${money(product.price)}</span>
          <span class="product-stock ${low ? 'low' : ''} ${out ? 'out' : ''}" ${stockStyle}>${esc(stockText(product))}</span>
        </div>
      </div>
    </div>`;
  }

  function renderProductGridV66() {
    if (state.renderingGrid) return;
    state.renderingGrid = true;
    try {
      syncRecipeFields();
      const grid = document.getElementById('productGrid');
      if (!grid) return state.originalRenderProductGrid?.();

      const category = activeCategoryText();
      const search = searchText();
      const mode = currentViewMode();
      const visible = productsList()
        .filter(product => product && !isRawOnlyProduct(product))
        .filter(product => isAllCategory(category) || String(product.category || '') === category)
        .filter(product => productMatches(product, search))
        .sort((a, b) => {
          const ar = hasRecipe(a.id) ? 1 : 0;
          const br = hasRecipe(b.id) ? 1 : 0;
          return br - ar || String(a.name || '').localeCompare(String(b.name || ''), 'th');
        })
        .slice(0, POS_LIMIT);

      grid.className = mode === 'list' ? 'product-list' : 'product-grid';
      grid.innerHTML = visible.length
        ? visible.map(product => renderCard(product, mode)).join('')
        : '<div class="empty-state"><i class="material-icons-round">inventory_2</i><h3>ไม่พบสินค้า</h3><p>ลองค้นหาหรือเลือกหมวดหมู่อื่น</p></div>';

      const footer = grid.parentElement?.querySelector('.product-count, .items-count, .grid-count');
      if (footer) footer.textContent = `แสดง ${visible.length} จาก ${visible.length} รายการ`;
    } catch (error) {
      console.error('[v66] renderProductGrid failed, fallback to original:', error);
      if (state.originalRenderProductGrid && state.originalRenderProductGrid !== renderProductGridV66) {
        return state.originalRenderProductGrid();
      }
    } finally {
      state.renderingGrid = false;
    }
  }

  async function getSellUnits(product) {
    if (typeof db === 'undefined') return [];
    const { data, error } = await db.from(UNIT_TABLE)
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('[v66] cannot load product units:', error);
      return [];
    }
    return (data || []).filter(unit => num(unit.conversion_rate) > 0);
  }

  function addRecipeLine(product, unit, qty = 1) {
    const conv = Math.max(0.000001, num(unit?.conversion_rate || 1));
    const neededBase = num(qty) * conv;
    const remaining = remainingRecipeBaseQty(product.id);
    if (remaining === null || neededBase > remaining + 0.000001) {
      typeof toast === 'function' && toast('วัตถุดิบในสูตรไม่พอ', 'error');
      return false;
    }

    const list = cartList();
    const unitName = unit?.unit_name || product.unit || 'หน่วย';
    const price = num(unit?.price || product.price);
    const existing = list.find(item =>
      item.recipe_product &&
      String(item.id) === String(product.id) &&
      String(item.unit_name || item.unit) === String(unitName)
    );

    if (existing) {
      existing.qty = num(existing.qty) + num(qty);
    } else {
      list.push({
        ...product,
        qty: num(qty),
        price,
        original_price: price,
        unit_name: unitName,
        unit: unitName,
        unit_label: unitName,
        conv_rate: conv,
        stock: Math.max(1, Math.floor((remaining || 0) / conv)),
        is_mto: true,
        recipe_product: true,
        recipe_capacity: recipeCapacity(product.id),
      });
    }
    setCart(list);
    window.renderCart?.();
    setTimeout(enhanceCartControls, 0);
    window.renderProductGrid?.();
    typeof toast === 'function' && toast(`เพิ่ม ${product.name} แล้ว`, 'success');
    return true;
  }

  async function addToCartV66(productId) {
    const product = productsList().find(item => String(item.id) === String(productId));
    if (!product) return;

    const needsRecipeCheck = isRecipeManagedProduct(product) || hasRecipe(product.id);
    if (!needsRecipeCheck) {
      if (!state.loadedAt) loadRecipes(false).then(syncRecipeFields);
      return state.originalAddToCart?.(productId);
    }

    await loadRecipes(false);
    syncRecipeFields();
    if (!hasRecipe(product.id)) return state.originalAddToCart?.(productId);

    if (remainingRecipeBaseQty(product.id) <= 0) {
      typeof toast === 'function' && toast('วัตถุดิบในสูตรไม่พอ', 'error');
      return;
    }

    const units = await getSellUnits(product);
    if (units.length && typeof window.v9ShowUnitPopup === 'function') {
      const patchedProduct = { ...product, stock: Math.max(1, Math.floor(remainingRecipeBaseQty(product.id))) };
      window.__v66PendingRecipeProduct = patchedProduct;
      window.__v66PendingRecipeUnits = units;
      return window.v9ShowUnitPopup(patchedProduct, units);
    }

    return addRecipeLine(product, {
      unit_name: product.unit || 'หน่วย',
      conversion_rate: 1,
      price: product.price,
    }, 1);
  }

  function patchUnitConfirm() {
    const originalConfirm = window.v64ConfirmUnitAdd || window.v9ConfirmUnitAdd;
    if (!originalConfirm || originalConfirm.__v66RecipeConfirm) return;

    const wrapped = function (productId, unitName, convRate, price, quantity) {
      const product = productsList().find(item => String(item.id) === String(productId));
      if (product && hasRecipe(product.id)) {
        return addRecipeLine(product, {
          unit_name: unitName,
          conversion_rate: convRate,
          price,
        }, quantity || 1);
      }
      return originalConfirm.apply(this, arguments);
    };
    wrapped.__v66RecipeConfirm = true;
    setGlobal('v64ConfirmUnitAdd', wrapped);
    setGlobal('v9ConfirmUnitAdd', wrapped);
  }

  function updateCartQtyV66(index, delta) {
    const item = cartList()[index];
    if (!item?.recipe_product) return state.originalUpdateCartQty?.(index, delta);
    const nextQty = Math.max(0, num(item.qty) + num(delta));
    if (nextQty === 0) {
      const next = cartList().slice();
      next.splice(index, 1);
      setCart(next);
      window.renderCart?.();
      setTimeout(enhanceCartControls, 0);
      window.renderProductGrid?.();
      return;
    }
    const needed = nextQty * Math.max(0.000001, num(item.conv_rate || 1));
    const capacity = recipeCapacity(item.id);
    const otherReserved = reservedRecipeBaseQty(item.id) - num(item.qty) * Math.max(0.000001, num(item.conv_rate || 1));
    if (capacity !== null && needed + otherReserved > capacity + 0.000001) {
      typeof toast === 'function' && toast('วัตถุดิบในสูตรไม่พอ', 'error');
      return;
    }
    item.qty = nextQty;
    window.renderCart?.();
    setTimeout(enhanceCartControls, 0);
    window.renderProductGrid?.();
  }

  function addExtraCharge(name, amount) {
    const cleanName = String(name || '').trim();
    const cleanAmount = num(amount);
    if (!cleanName) {
      typeof toast === 'function' && toast('กรุณากรอกชื่อรายการ', 'error');
      return false;
    }
    if (cleanAmount <= 0) {
      typeof toast === 'function' && toast('กรุณากรอกจำนวนเงิน', 'error');
      return false;
    }
    const list = cartList();
    list.push({
      id: `extra-${Date.now()}`,
      name: cleanName,
      price: cleanAmount,
      original_price: cleanAmount,
      qty: 1,
      unit: 'รายการ',
      unit_name: 'รายการ',
      conv_rate: 1,
      stock: 999999,
      is_extra_charge: true,
      is_mto: true,
      cost: 0,
    });
    setCart(list);
    window.renderCart?.();
    setTimeout(enhanceCartControls, 0);
    typeof closeModal === 'function' && closeModal();
    typeof toast === 'function' && toast('เพิ่มรายการคิดเงินแล้ว', 'success');
    return true;
  }

  function showExtraChargeModal() {
    const html = `
      <div class="v66-extra-modal">
        <div class="v66-extra-hero">
          <div class="v66-extra-icon"><i class="material-icons-round">add_card</i></div>
          <div>
            <div class="v66-extra-title">เพิ่มรายการคิดเงินเพิ่ม</div>
            <div class="v66-extra-sub">ใช้สำหรับค่าขนส่ง ค่าแรง ค่าอุปกรณ์ หรือค่าใช้จ่ายเฉพาะบิลนี้ ไม่เพิ่มลงสต็อก</div>
          </div>
        </div>
        <div class="v66-extra-field">
          <label>ชื่อรายการ</label>
          <input id="v66ExtraName" class="v66-extra-input" placeholder="เช่น ค่าขนส่ง" autocomplete="off">
        </div>
        <div class="v66-extra-field">
          <label>จำนวนเงิน</label>
          <input id="v66ExtraAmount" class="v66-extra-input" type="number" min="0" step="1" placeholder="0">
        </div>
        <div class="v66-extra-presets">
          <button class="v66-extra-preset" onclick="document.getElementById('v66ExtraName').value='ค่าขนส่ง'">ค่าขนส่ง</button>
          <button class="v66-extra-preset" onclick="document.getElementById('v66ExtraName').value='ค่าแรง'">ค่าแรง</button>
          <button class="v66-extra-preset" onclick="document.getElementById('v66ExtraName').value='ค่าอุปกรณ์'">ค่าอุปกรณ์</button>
        </div>
        <div class="v66-extra-total"><span>ยอดที่จะเพิ่ม</span><b id="v66ExtraPreview">฿0</b></div>
      </div>`;

    if (typeof Swal !== 'undefined' && Swal.fire) {
      Swal.fire({
        title: 'เพิ่มรายการคิดเงิน',
        html,
        width: 560,
        showCancelButton: true,
        confirmButtonText: 'เพิ่มเข้าตะกร้า',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'v66-extra-swal-popup' },
        didOpen: () => {
          const amount = document.getElementById('v66ExtraAmount');
          const preview = document.getElementById('v66ExtraPreview');
          amount?.addEventListener('input', () => { preview.textContent = money(amount.value); });
          document.getElementById('v66ExtraName')?.focus();
        },
        preConfirm: () => {
          const name = document.getElementById('v66ExtraName')?.value || '';
          const amount = document.getElementById('v66ExtraAmount')?.value || 0;
          if (!String(name).trim()) {
            Swal.showValidationMessage('กรุณากรอกชื่อรายการ');
            return false;
          }
          if (num(amount) <= 0) {
            Swal.showValidationMessage('กรุณากรอกจำนวนเงิน');
            return false;
          }
          return { name, amount };
        },
      }).then(result => {
        if (result.isConfirmed && result.value) addExtraCharge(result.value.name, result.value.amount);
      });
      return;
    }

    if (typeof showModal === 'function') {
      showModal('เพิ่มรายการคิดเงิน', html, `
        <button class="btn btn-primary" onclick="v66SaveExtraCharge()"><i class="material-icons-round">add_shopping_cart</i> เพิ่มเข้าตะกร้า</button>
        <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      `);
    } else {
      const name = window.prompt('ชื่อรายการ');
      if (name == null) return;
      const amount = window.prompt('จำนวนเงิน');
      addExtraCharge(name, amount);
      return;
    }

    setTimeout(() => {
      const amount = document.getElementById('v66ExtraAmount');
      const preview = document.getElementById('v66ExtraPreview');
      amount?.addEventListener('input', () => { preview.textContent = money(amount.value); });
      document.getElementById('v66ExtraName')?.focus();
    }, 80);
  }

  const CART_PANEL_SELECTOR = '.cart-panel, .cart-sidebar, .sale-cart, aside, [class*="cart"], [class*="Cart"]';
  const CART_HEADER_SELECTOR = '.cart-header, .cart-title, .sale-header, .cart-panel-header, .cart-panel .header, .cart-section-header';
  const DIALOG_SELECTOR = '.swal2-container, .swal2-popup, .modal, .modal-content, .modal-overlay, [role="dialog"], .v65-swal-popup, .v42-action-popup, .v66-extra-modal';

  function isInsideDialog(el) {
    return !!el?.closest?.(DIALOG_SELECTOR);
  }

  function isCartPanelOnSaleSide(panel) {
    if (!panel || isInsideDialog(panel)) return false;
    const rect = panel.getBoundingClientRect?.();
    const text = panel.textContent || '';
    if (/รายการขาย|ไม่มีสินค้าในตะกร้า|รวมทั้งสิ้น|ชำระเงิน/.test(text)) return true;
    return !!rect && (rect.left > window.innerWidth * 0.42 || rect.width > window.innerWidth * 0.72);
  }

  function findCartTitleRow() {
    return Array.from(document.querySelectorAll(CART_HEADER_SELECTOR)).find(row => {
      if (isInsideDialog(row)) return false;
      const panel = row.closest?.(CART_PANEL_SELECTOR) || row.parentElement;
      if (!isCartPanelOnSaleSide(panel)) return false;
      const rect = row.getBoundingClientRect?.();
      return !rect || rect.height < 120;
    });
  }

  function enhanceCartControls() {
    const titleRow = findCartTitleRow();
    if (titleRow && !titleRow.querySelector('[data-v66-extra-btn]')) {
      const clearBtn = titleRow.querySelector('[onclick*="clear"], .clear-cart, [title*="ล้าง"], button[title*="ล้าง"]');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'v66-extra-btn';
      btn.dataset.v66ExtraBtn = '1';
      btn.title = 'เพิ่มรายการคิดเงิน';
      btn.innerHTML = '<i class="material-icons-round">add</i>';
      btn.onclick = showExtraChargeModal;
      clearBtn?.parentNode ? clearBtn.parentNode.insertBefore(btn, clearBtn) : titleRow.appendChild(btn);
    }
    document.querySelectorAll('.cart-item').forEach(row => {
      if (row.textContent?.includes('รายการ')) row.classList.add('v66-extra-line');
    });
  }

  function isCartExtraButtonTarget(event) {
    if (isInsideDialog(event.target)) return false;
    const direct = event.target.closest?.('[data-v66-extra-btn]');
    if (direct) return !!direct.closest?.(CART_HEADER_SELECTOR);
    const btn = event.target.closest?.('button, [role="button"], .btn');
    if (!btn) return false;
    if (isInsideDialog(btn)) return false;
    const iconText = btn.querySelector?.('.material-icons-round, .material-icons')?.textContent?.trim();
    const ownText = String(btn.textContent || '').trim();
    if (iconText !== 'add' && ownText !== '+' && !/^\+?$/.test(ownText)) return false;

    const cartPanel = btn.closest?.(CART_PANEL_SELECTOR);
    if (!isCartPanelOnSaleSide(cartPanel)) return false;

    const header = btn.closest?.(CART_HEADER_SELECTOR);
    const rect = btn.getBoundingClientRect?.();
    const panelRect = cartPanel?.getBoundingClientRect?.();
    const inHeaderZone = !!header || (rect && panelRect && rect.top <= panelRect.top + 96);
    return !!inHeaderZone;
  }

  function handleExtraChargeTrigger(event) {
    if (!isCartExtraButtonTarget(event)) return false;
    const now = Date.now();
    if (now - state.extraOpeningAt < 450) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    state.extraOpeningAt = now;
    event.preventDefault();
    event.stopPropagation();
    setTimeout(showExtraChargeModal, 0);
    return true;
  }

  function showRecipeManagedNotice(product) {
    const openEditor = () => {
      if (typeof window.v9RecipeEditProduct === 'function') return window.v9RecipeEditProduct(product.id);
      if (typeof toast === 'function') toast('เปิดหน้าสูตรจากเมนูผู้ดูแลระบบเพื่อแก้ไขสินค้านี้', 'info');
    };
    if (typeof Swal !== 'undefined' && Swal.fire) {
      Swal.fire({
        icon: 'info',
        title: 'สินค้านี้จัดการจากหน้าสูตร',
        html: `<div style="text-align:left;line-height:1.7;color:#475569;font-weight:700">
          <strong style="color:#0f172a">${esc(product?.name || '')}</strong><br>
          สินค้าชนิดนี้เป็นสินค้าที่ผลิตตามบิล ระบบจะคำนวณจากวัตถุดิบในสูตร ไม่ให้แก้สต็อกหรือข้อมูลจากหน้าคลังสินค้าโดยตรง เพื่อไม่ให้ตัดสต็อกผิด
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'แก้ไขสูตร',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#0f766e',
      }).then(result => { if (result.isConfirmed) openEditor(); });
      return;
    }
    openEditor();
  }

  function protectRecipeInventoryRows() {
    if (state.protectingInventory) return;
    state.protectingInventory = true;
    try {
      document.querySelectorAll('button[onclick*="v42ProductActions"]').forEach(button => {
        const call = button.getAttribute('onclick') || '';
        const match = call.match(/v42ProductActions\?\.\(['"]([^'"]+)/) || call.match(/v42ProductActions\(['"]([^'"]+)/);
        const product = match ? productById(match[1]) : null;
        if (!isRecipeManagedProduct(product)) return;
        const row = button.closest('tr');
        if (!row || row.dataset.v66RecipeLocked === '1') return;
        row.dataset.v66RecipeLocked = '1';
        row.classList.add('v66-recipe-inventory-row');
        const nameCell = row.children?.[1];
        if (nameCell && !nameCell.querySelector('.v66-recipe-lock-badge')) {
          nameCell.insertAdjacentHTML('beforeend', '<small class="v66-recipe-lock-badge"><i class="material-icons-round">lock</i> จัดการที่หน้าสูตร</small>');
        }
        const actions = button.closest('.v38-actions') || button.parentElement;
        if (actions) {
          actions.innerHTML = `<button type="button" class="v66-recipe-inventory-btn" data-v66-open-recipe="${esc(product.id)}" title="เปิดหน้าสูตร"><i class="material-icons-round">science</i><span>สูตร</span></button>`;
        }
      });
    } finally {
      state.protectingInventory = false;
    }
  }

  function patchInventoryGuards() {
    if (window.renderInventory && !window.renderInventory.__v66RecipeInventoryGuard) {
      state.originalRenderInventory = window.renderInventory;
      const wrappedRenderInventory = async function () {
        const result = await state.originalRenderInventory.apply(this, arguments);
        setTimeout(protectRecipeInventoryRows, 0);
        setTimeout(protectRecipeInventoryRows, 120);
        return result;
      };
      wrappedRenderInventory.__v66RecipeInventoryGuard = true;
      setGlobal('renderInventory', wrappedRenderInventory);
    }

    if (window.v42ProductActions && !window.v42ProductActions.__v66RecipeGuard) {
      state.originalV42ProductActions = window.v42ProductActions;
      const wrappedActions = function (productId) {
        const product = productById(productId);
        if (isRecipeManagedProduct(product)) return showRecipeManagedNotice(product);
        return state.originalV42ProductActions.apply(this, arguments);
      };
      wrappedActions.__v66RecipeGuard = true;
      setGlobal('v42ProductActions', wrappedActions);
    }

    if (window.editProduct && !window.editProduct.__v66RecipeGuard) {
      state.originalEditProduct = window.editProduct;
      const wrappedEdit = function (productId) {
        const product = productById(productId);
        if (isRecipeManagedProduct(product)) return showRecipeManagedNotice(product);
        return state.originalEditProduct.apply(this, arguments);
      };
      wrappedEdit.__v66RecipeGuard = true;
      setGlobal('editProduct', wrappedEdit);
    }

    ['adjustStock', 'deleteProduct'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__v66RecipeGuard) return;
      if (name === 'adjustStock') state.originalAdjustStock = original;
      if (name === 'deleteProduct') state.originalDeleteProduct = original;
      const wrapped = function (productId) {
        const product = productById(productId);
        if (isRecipeManagedProduct(product)) return showRecipeManagedNotice(product);
        return original.apply(this, arguments);
      };
      wrapped.__v66RecipeGuard = true;
      setGlobal(name, wrapped);
    });
  }

  function sanitizeExtraChargesBeforeSale() {
    cartList().forEach(item => {
      if (!item?.is_extra_charge) return;
      item.product_id = null;
      item.is_mto = true;
      item.stock = 999999;
      item.conv_rate = 1;
      item.unit = 'รายการ';
      item.unit_name = 'รายการ';
    });
  }

  async function saleV66() {
    sanitizeExtraChargesBeforeSale();
    return state.originalSale?.apply(this, arguments);
  }

  function installStyles() {
    if (document.getElementById('v66-pos-recipe-style')) return;
    const style = document.createElement('style');
    style.id = 'v66-pos-recipe-style';
    style.textContent = `
      .product-card,.product-list-item{position:relative}
      .v66-recipe-badge{position:absolute;left:8px;top:8px;z-index:5;border:1px solid #a7f3d0;background:#ecfdf5;color:#047857;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:950;box-shadow:0 10px 22px rgba(4,120,87,.13)}
      .product-card[data-v66-recipe="1"]:not(.out-of-stock){border-color:#a7f3d0;box-shadow:0 8px 22px rgba(4,120,87,.08)}
      .product-card[data-v66-recipe="1"] .product-sku{color:#94a3b8;font-weight:750;font-size:11px}
      .v66-extra-btn{width:38px;height:38px;border:0;border-radius:12px;background:#fff;color:#dc2626;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
      .v66-extra-btn:hover{background:#fff1f2}
      .v66-extra-modal{display:grid;gap:16px;text-align:left}
      .v66-extra-hero{border:1px solid #fecaca;background:linear-gradient(135deg,#fff1f2,#f8fafc);border-radius:18px;padding:18px;display:flex;gap:14px;align-items:center}
      .v66-extra-icon{width:52px;height:52px;border-radius:16px;background:#ef4444;color:#fff;display:grid;place-items:center;box-shadow:0 14px 28px rgba(239,68,68,.22)}
      .v66-extra-title{font-size:18px;font-weight:950;color:#0f172a}
      .v66-extra-sub{font-size:13px;font-weight:750;line-height:1.45;color:#64748b;margin-top:4px}
      .v66-extra-field label{display:block;margin-bottom:7px;font-size:13px;font-weight:950;color:#334155}
      .v66-extra-input{width:100%;height:54px;border:1px solid #cbd5e1;border-radius:15px;background:#fff;padding:0 15px;font:900 18px var(--font-thai,'Prompt'),sans-serif;color:#0f172a;outline:none;box-sizing:border-box}
      .v66-extra-input:focus{border-color:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.12)}
      .v66-extra-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .v66-extra-preset{height:42px;border-radius:13px;border:1px solid #e2e8f0;background:#f8fafc;color:#334155;font-weight:900;cursor:pointer;font-family:inherit}
      .v66-extra-preset:hover{border-color:#ef4444;background:#fff1f2;color:#dc2626}
      .v66-extra-total{border-radius:17px;background:#0f172a;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;font-weight:900}
      .v66-extra-total b{font-size:24px}
      .v66-extra-swal-popup{border-radius:24px!important}
      .v66-recipe-inventory-row{background:linear-gradient(90deg,#f8fafc,#fff)!important}
      .v66-recipe-lock-badge{margin-top:7px;display:inline-flex;align-items:center;gap:5px;border:1px solid #a7f3d0;background:#ecfdf5;color:#047857;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:950}
      .v66-recipe-lock-badge i{font-size:14px}
      .v66-recipe-inventory-btn{height:38px;border:1px solid #99f6e4;background:#f0fdfa;color:#0f766e;border-radius:12px;padding:0 10px;display:inline-flex;align-items:center;gap:6px;font:900 12px var(--font-thai,'Prompt'),sans-serif;cursor:pointer}
      .v66-recipe-inventory-btn:hover{background:#ccfbf1}
      .v66-recipe-inventory-btn i{font-size:18px}
    `;
    document.head.appendChild(style);
  }

  function installCore() {
    installStyles();
    if (!window.renderProductGrid?.__v66RecipeGrid) {
      if (window.renderProductGrid && !window.renderProductGrid.__v66RecipeGrid) state.originalRenderProductGrid = window.renderProductGrid;
      renderProductGridV66.__v66RecipeGrid = true;
      try {
        Object.defineProperty(renderProductGridV66, '__v50PromoCat', { value: true, configurable: true });
        Object.defineProperty(renderProductGridV66, '__v59PromoGuarded', { value: true, configurable: true });
      } catch (_) {}
      setGlobal('renderProductGrid', renderProductGridV66);
    }
    if (!window.addToCart?.__v66RecipeAdd) {
      if (window.addToCart && !window.addToCart.__v66RecipeAdd) state.originalAddToCart = window.addToCart;
      addToCartV66.__v66RecipeAdd = true;
      setGlobal('addToCart', addToCartV66);
    }
    if (!window.updateCartQty?.__v66RecipeQty) {
      if (window.updateCartQty && !window.updateCartQty.__v66RecipeQty) state.originalUpdateCartQty = window.updateCartQty;
      updateCartQtyV66.__v66RecipeQty = true;
      setGlobal('updateCartQty', updateCartQtyV66);
    }
    if (window.completeSale && !window.completeSale.__v66ExtraSale) {
      state.originalSale = window.completeSale;
      saleV66.__v66ExtraSale = true;
      setGlobal('completeSale', saleV66);
    }
    patchUnitConfirm();
    patchInventoryGuards();
    enhanceCartControls();
    setTimeout(protectRecipeInventoryRows, 0);
    setGlobal('v66ReloadRecipes', async () => {
      state.loadedAt = 0;
      await loadRecipes(true);
      syncRecipeFields();
      window.renderProductGrid?.();
      return state.recipes;
    });
    setGlobal('v66SaveExtraCharge', () => addExtraCharge(
      document.getElementById('v66ExtraName')?.value,
      document.getElementById('v66ExtraAmount')?.value
    ));
    setGlobal('v66ShowExtraChargeModal', showExtraChargeModal);
  }

  async function boot() {
    installCore();
    syncRecipeFields();
    window.renderProductGrid?.();
    setTimeout(enhanceCartControls, 0);
    loadRecipes(true).then(() => {
      syncRecipeFields();
      window.renderProductGrid?.();
      setTimeout(enhanceCartControls, 0);
      setTimeout(protectRecipeInventoryRows, 0);
    });
  }

  document.addEventListener('pointerdown', event => {
    handleExtraChargeTrigger(event);
  }, true);

  document.addEventListener('click', event => {
    if (handleExtraChargeTrigger(event)) return;

    const recipeOpen = event.target.closest?.('[data-v66-open-recipe]');
    if (recipeOpen) {
      event.preventDefault();
      event.stopPropagation();
      const product = productById(recipeOpen.dataset.v66OpenRecipe);
      showRecipeManagedNotice(product || { id: recipeOpen.dataset.v66OpenRecipe, name: '' });
      return;
    }

    const card = event.target.closest?.('[data-v66-product-id][data-v66-recipe="1"]');
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    addToCartV66(card.dataset.v66ProductId);
  }, true);

  boot();
  [500, 1500, 3000].forEach(delay => setTimeout(() => {
    installCore();
    setTimeout(enhanceCartControls, 0);
  }, delay));
})();
