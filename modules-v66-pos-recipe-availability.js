(function () {
  'use strict';

  console.log('[v66] POS recipe availability rewrite loaded');

  const RECIPE_TABLE = '\u0e2a\u0e39\u0e15\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
  const UNIT_TABLE = 'product_units';
  const CACHE_MS = 30000;
  const POS_LIMIT = 60;
  const RECIPE_TIMEOUT_MS = 3500;
  const UNIT_TIMEOUT_MS = 4500;
  const SALE_TIMEOUT_MS = 8000;

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
    decoratingCards: false,
    cardObserver: null,
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
  const unitConv = unit => num(unit?.conv_rate ?? unit?.conversion_rate ?? unit?.rate ?? 1);
  const unitPrice = unit => num(unit?.price_per_unit ?? unit?.price ?? unit?.unit_price ?? 0);
  const normalizeSellUnit = unit => {
    const conv = Math.max(0.000001, unitConv(unit));
    const price = unitPrice(unit);
    return {
      ...unit,
      unit_name: unit?.unit_name || unit?.name || unit?.unit || '',
      conv_rate: conv,
      conversion_rate: conv,
      price_per_unit: price,
      price,
    };
  };
  const fmt = value => {
    const n = num(value);
    return typeof formatNum === 'function'
      ? formatNum(n)
      : n.toLocaleString('th-TH', { maximumFractionDigits: 4 });
  };
  const whole = value => Math.max(0, Math.floor(num(value)));
  const fmtWhole = value => whole(value).toLocaleString('th-TH');
  const money = value => `฿${fmt(value)}`;
  const MATERIAL_EMOJIS = ['🧱', '🪨', '🪵', '🔩', '⚙️', '🔧', '🪛', '🪚', '⛓️', '🧲', '🚧', '🏗️', '🪣', '⚡'];
  const MATERIAL_KEY_EMOJIS = [
    { keys: ['ปูน', 'ซีเมนต์', 'คอนกรีต', 'มอร์ตาร์'], emoji: '🪨' },
    { keys: ['อิฐ', 'บล็อก', 'กระเบื้อง'], emoji: '🧱' },
    { keys: ['ไม้', 'ไม้อัด', 'แผ่น'], emoji: '🪵' },
    { keys: ['น็อต', 'สกรู', 'ตะปู', 'พุก', 'แหวน'], emoji: '🔩' },
    { keys: ['เหล็ก', 'เพลา', 'ฉาก', 'แป๊บ', 'ท่อ'], emoji: '⛓️' },
    { keys: ['สายไฟ', 'ไฟ', 'ปลั๊ก', 'สวิตช์'], emoji: '⚡' },
    { keys: ['แม่เหล็ก'], emoji: '🧲' },
    { keys: ['สี', 'แปรง', 'ลูกกลิ้ง'], emoji: '🪣' },
    { keys: ['เลื่อย'], emoji: '🪚' },
    { keys: ['ไขควง'], emoji: '🪛' },
    { keys: ['ประแจ', 'คีม', 'ค้อน', 'เครื่องมือ'], emoji: '🔧' },
  ];
  function materialEmojiForProduct(product) {
    const hay = [product?.name, product?.category, product?.barcode].filter(Boolean).join(' ').toLowerCase();
    const picked = MATERIAL_KEY_EMOJIS.find(item => item.keys.some(key => hay.includes(key.toLowerCase())));
    if (picked) return picked.emoji;
    const seed = String(product?.id || product?.name || hay || 'material').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return MATERIAL_EMOJIS[Math.abs(seed) % MATERIAL_EMOJIS.length];
  }
  function materialPlaceholderHtml(product) {
    const emoji = materialEmojiForProduct(product);
    return `<div class="v66-material-placeholder" aria-label="ไม่มีรูปสินค้า"><span>${emoji}</span></div>`;
  }

  function withTimeout(promise, ms, fallback, label) {
    let timer;
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => {
        console.warn(`[v66] ${label || 'request'} timeout`);
        resolve(fallback);
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

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

  function recipeIdentity(product) {
    return normalizedText(product?.name).replace(/\s+/g, ' ');
  }

  function compactRecipeIdentity(product) {
    return normalizedText(product?.name).replace(/[\s\-_/.]+/g, '');
  }

  function isRecipeManagedProduct(product) {
    if (!product) return false;
    if (product.__v66_recipe_product || hasRecipe(product.id)) return true;
    return false;
  }

  function isMadeToOrderType(product) {
    if (!product) return false;
    const type = normalizedText(product.product_type);
    return type === '\u0e15\u0e32\u0e21\u0e1a\u0e34\u0e25' || type.includes('\u0e15\u0e32\u0e21\u0e1a\u0e34\u0e25') || type.includes('เธ•เธฒเธกเธเธดเธฅ') || type.includes('make to order') || type.includes('mto');
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

    const fetchAllRecipeRows = async () => {
      if (typeof fetchAllRows === 'function') {
        return fetchAllRows(RECIPE_TABLE, 'id,product_id,material_id,quantity,unit');
      }
      const rows = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await db.from(RECIPE_TABLE)
          .select('id,product_id,material_id,quantity,unit')
          .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      return rows;
    };

    const request = fetchAllRecipeRows()
      .then(rows => {
        state.recipes = rows || [];
        state.loadedAt = Date.now();
        rebuildRecipeMap(state.recipes);
        window.__v66Debug = {
          recipeCount: state.recipes.length,
          recipeProductIds: [...state.recipeMap.keys()],
          loadedAt: new Date(state.loadedAt).toISOString(),
        };
        setTimeout(() => {
          syncRecipeFields();
          window.renderProductGrid?.();
          setTimeout(protectRecipeInventoryRows, 0);
        }, 0);
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

  function stoneVariant(product) {
    const name = String(product?.name || '').trim().toLowerCase();
    if (!name.includes('หิน')) return '';
    if (/3\s*\/\s*4|¾|สามส่วนสี่/.test(name)) return 'stone_3_4';
    if (/หิน\s*(?:เบอร์\s*)?(?:1|๑)(?:\D|$)/.test(name)) return 'stone_1';
    return '';
  }

  function isSelectableStone(product) {
    return !!stoneVariant(product);
  }

  function stoneOptionsForRecipe(productId) {
    const map = productMap();
    const hasStoneSlot = recipeRows(productId).some(row => isSelectableStone(map.get(String(row.material_id))));
    if (!hasStoneSlot) return [];
    const best = new Map();
    productsList().forEach(product => {
      const variant = stoneVariant(product);
      if (!variant) return;
      const current = best.get(variant);
      if (!current || num(product.stock) > num(current.stock)) best.set(variant, product);
    });
    return ['stone_1', 'stone_3_4'].map(variant => best.get(variant)).filter(Boolean);
  }

  function recipeCapacityWithStone(productId, stoneMaterialId = '') {
    const rows = recipeRows(productId);
    if (!rows.length) return null;
    const map = productMap();
    const selectedStone = stoneMaterialId ? map.get(String(stoneMaterialId)) : null;
    let capacity = Infinity;
    rows.forEach(row => {
      const original = map.get(String(row.material_id)) || {};
      const material = selectedStone && isSelectableStone(original) ? selectedStone : original;
      const qty = num(row.quantity);
      if (qty > 0) capacity = Math.min(capacity, num(material.stock) / qty);
    });
    return Number.isFinite(capacity) ? Math.max(0, capacity) : 0;
  }

  function hasRecipe(productId) {
    return recipeRows(productId).length > 0;
  }

  function recipeProductFor(productOrId) {
    const product = typeof productOrId === 'object' ? productOrId : productById(productOrId);
    if (product && hasRecipe(product.id)) return product;
    const key = compactRecipeIdentity(product);
    if (!key) return null;
    return productsList().find(row => row && hasRecipe(row.id) && compactRecipeIdentity(row) === key) || null;
  }

  function recipeProductIdFor(productOrId) {
    const recipeProduct = recipeProductFor(productOrId);
    return recipeProduct?.id || (hasRecipe(productOrId) ? productOrId : null);
  }

  function recipeCost(productId) {
    const map = productMap();
    return recipeRows(productId).reduce((sum, row) => {
      const material = map.get(String(row.material_id)) || {};
      return sum + num(row.quantity) * num(material.cost);
    }, 0);
  }

  function recipeCapacity(productId, stoneMaterialId = '') {
    if (stoneMaterialId) return recipeCapacityWithStone(productId, stoneMaterialId);
    const options = stoneOptionsForRecipe(productId);
    if (options.length) {
      return Math.max(...options.map(option => recipeCapacityWithStone(productId, option.id) || 0));
    }
    return recipeCapacityWithStone(productId, '');
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

  function recipeProductNameSet() {
    const names = new Set();
    productsList().forEach(product => {
      if (hasRecipe(product.id)) {
        const key = compactRecipeIdentity(product);
        if (key) names.add(key);
      }
    });
    return names;
  }

  function isRecipeShadowProduct(product, recipeNames) {
    if (!product || hasRecipe(product.id)) return false;
    const key = compactRecipeIdentity(product);
    return !!key && recipeNames.has(key);
  }

  function shouldHideProductInPos(product) {
    return isRawOnlyProduct(product) || isRecipeShadowProduct(product, recipeProductNameSet());
  }

  function shouldRecipeHandleProduct(product) {
    return !!recipeProductFor(product) || isRecipeManagedProduct(product) || isMadeToOrderType(product) || hasRecipe(product?.id);
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
      if (remaining > 0) return `ผลิตได้ ${fmtWhole(remaining)} ${product.unit || ''}`;
      return 'วัตถุดิบไม่พอ';
    }
    return num(product.stock) > 0 ? fmt(product.stock) : 'หมด';
  }

  function recipeCapacityHtml(product, compact = false) {
    if (!hasRecipe(product.id)) return '';
    const remaining = remainingRecipeBaseQty(product.id);
    const display = remaining > 0 ? fmtWhole(remaining) : '0';
    const unit = esc(product.unit || '');
    return `<div class="v66-recipe-capacity ${remaining > 0 ? '' : 'bad'} ${compact ? 'compact' : ''}">
      <span>ผลิตได้</span><b>${display} ${unit}</b>
    </div>`;
  }

  function recipePriceHtml(product, compact = false) {
    if (!hasRecipe(product.id)) return '';
    const unit = esc(product.unit || 'คิว');
    return `<div class="v66-recipe-price ${compact ? 'compact' : ''}">
      <span>ราคาขาย</span><b>${money(product.price)}<small>/${unit}</small></b>
    </div>`;
  }

  function productIdFromCard(card) {
    const dataId = card?.dataset?.v66ProductId;
    if (dataId) return dataId;
    const click = card?.getAttribute?.('onclick') || '';
    const match = click.match(/(?:addToCart|v66RecipeAddToCart)\(['"]([^'"]+)['"]\)/);
    return match?.[1] || '';
  }

  function productFromCard(card) {
    const id = productIdFromCard(card);
    const byId = id ? productById(id) : null;
    if (byId) return byId;
    const name = card?.querySelector?.('.product-name')?.textContent || '';
    return name ? productsList().find(product => compactRecipeIdentity(product) === compactRecipeIdentity({ name })) : null;
  }

  function decorateRecipeCard(card) {
    const product = productFromCard(card);
    const recipeProduct = recipeProductFor(product) || product;
    if (!recipeProduct || !hasRecipe(recipeProduct.id)) return;

    const remaining = remainingRecipeBaseQty(recipeProduct.id);
    const out = remaining <= 0;
    const display = remaining > 0 ? fmtWhole(remaining) : '0';
    const unit = recipeProduct.unit || '';
    card.classList.add('v66-recipe-sale-card');
    card.classList.toggle('out-of-stock', out);
    card.dataset.v66ProductId = recipeProduct.id;
    card.dataset.v66Recipe = '1';
    card.setAttribute('onclick', `v66RecipeAddToCart('${js(recipeProduct.id)}')`);

    if (!card.querySelector('.v66-recipe-badge')) {
      card.insertAdjacentHTML('afterbegin', '<span class="v66-recipe-badge">ขายตามสูตร</span>');
    }

    const stock = card.querySelector('.product-stock');
    if (stock) {
      const nextText = out ? 'วัตถุดิบไม่พอ' : `ผลิตได้ ${display} ${unit}`;
      if (stock.textContent !== nextText) stock.textContent = nextText;
      stock.classList.toggle('out', out);
      stock.classList.toggle('low', false);
    }

    let cap = card.querySelector('.v66-recipe-capacity');
    if (!cap) {
      const compact = card.classList.contains('product-list-item');
      const target = card.querySelector('.product-sku') || card.querySelector('.product-name') || card.querySelector('.product-info') || card;
      target.insertAdjacentHTML('afterend', recipeCapacityHtml(recipeProduct, compact));
      cap = card.querySelector('.v66-recipe-capacity');
    }
    if (cap) {
      cap.classList.toggle('bad', out);
      const label = cap.querySelector('span');
      const value = cap.querySelector('b');
      if (label && label.textContent !== 'ผลิตได้') label.textContent = 'ผลิตได้';
      const nextValue = `${display} ${unit}`;
      if (value && value.textContent !== nextValue) value.textContent = nextValue;
    }

    let price = card.querySelector('.v66-recipe-price');
    if (!price && cap) {
      const compact = card.classList.contains('product-list-item');
      cap.insertAdjacentHTML('beforebegin', recipePriceHtml(recipeProduct, compact));
      price = card.querySelector('.v66-recipe-price');
    }
    if (price) {
      const label = price.querySelector('span');
      const value = price.querySelector('b');
      const unitLabel = recipeProduct.unit || 'คิว';
      if (label) label.textContent = 'ราคาขาย';
      if (value) value.innerHTML = `${money(recipeProduct.price)}<small>/${esc(unitLabel)}</small>`;
    }

    const inCart = cartItemFor(recipeProduct.id);
    const badgeHost = card.querySelector('.product-img') || card.querySelector('.product-list-right') || card;
    let qtyBadge = card.querySelector('.product-badge');
    if (inCart && !qtyBadge) {
      qtyBadge = document.createElement('span');
      qtyBadge.className = 'product-badge';
      badgeHost.appendChild(qtyBadge);
    }
    if (qtyBadge) {
      if (inCart) qtyBadge.textContent = fmt(inCart.qty);
      else qtyBadge.remove();
    }

    // การ์ดสูตรใช้ราคาแดงด้านล่างเพียงจุดเดียว ไม่ให้ footer/ป้ายกำลังผลิตเดิมซ้อนทับ
    card.querySelector('.product-footer')?.remove();
    card.querySelector('.v66-recipe-capacity')?.remove();
    card.querySelector('.product-sku')?.remove();
  }

  function decorateMaterialPlaceholderCard(card) {
    const product = productFromCard(card);
    const imageHost = card?.querySelector?.('.product-img,.product-list-img');
    if (!imageHost || imageHost.querySelector('img,.v66-material-placeholder')) return;
    if (product?.img_url) return;
    const icon = Array.from(imageHost.querySelectorAll('i.material-icons-round'))
      .find(el => ['inventory_2', 'local_offer'].includes(String(el.textContent || '').trim()));
    if (!icon) return;
    const holder = document.createElement('div');
    holder.innerHTML = materialPlaceholderHtml(product || { name: card.querySelector('.product-name')?.textContent || '' });
    icon.replaceWith(holder.firstElementChild);
  }

  function decorateRecipeCards() {
    if (state.decoratingCards) return;
    state.decoratingCards = true;
    try {
      const grid = document.getElementById('pos-product-grid') || document.getElementById('productGrid');
      if (!grid) return;
      grid.querySelectorAll('.product-card,.product-list-item').forEach(card => {
        decorateMaterialPlaceholderCard(card);
        decorateRecipeCard(card);
      });
    } finally {
      state.decoratingCards = false;
    }
  }

  function scheduleRecipeCardDecorate() {
    requestAnimationFrame(() => {
      syncRecipeFields();
      decorateRecipeCards();
    });
  }

  function installRecipeCardObserver() {
    const grid = document.getElementById('pos-product-grid') || document.getElementById('productGrid');
    if (!grid || state.cardObserver?.__v66Target === grid) return;
    state.cardObserver?.disconnect?.();
    state.cardObserver = new MutationObserver(() => scheduleRecipeCardDecorate());
    state.cardObserver.__v66Target = grid;
    state.cardObserver.observe(grid, { childList: true, subtree: true });
    scheduleRecipeCardDecorate();
  }

  function renderCard(product, mode) {
    const recipe = hasRecipe(product.id);
    const out = isProductOut(product);
    const low = !recipe && num(product.stock) > 0 && num(product.stock) <= num(product.min_stock);
    const inCart = cartItemFor(product.id);
    const badge = recipe ? '<span class="v66-recipe-badge">ขายตามสูตร</span>' : '';
    const stockStyle = recipe && !out ? 'style="color:#047857"' : '';
    const sku = recipe ? `สูตร • ต้นทุน ${money(recipeCost(product.id))}` : esc(product.barcode || '-');
    const price = recipePriceHtml(product);
    const listPrice = recipePriceHtml(product, true);
    const capacity = recipeCapacityHtml(product);
    const listCapacity = recipeCapacityHtml(product, true);
    const attrs = `data-v66-product-id="${esc(product.id)}" data-v66-recipe="${recipe ? '1' : '0'}"`;
    const click = recipe ? `v66RecipeAddToCart('${js(product.id)}')` : `addToCart('${js(product.id)}')`;
    const image = product.img_url
      ? `<img src="${esc(product.img_url)}" alt="${esc(product.name)}" loading="lazy">`
      : materialPlaceholderHtml(product);

    if (mode === 'list') {
      return `<div class="product-list-item ${recipe ? 'v66-recipe-sale-card' : ''} ${out ? 'out-of-stock' : ''}" ${attrs} onclick="${click}">
        ${badge}
        <div class="product-list-img">${image}</div>
        <div class="product-list-info">
          <div class="product-name">${esc(product.name)}</div>
          <div class="product-sku">${sku}</div>
          ${listPrice}${listCapacity}
        </div>
        <div class="product-list-right">
          <span class="product-price">${money(product.price)}</span>
          <span class="product-stock ${low ? 'low' : ''} ${out ? 'out' : ''}" ${stockStyle}>${esc(stockText(product))}</span>
          ${inCart ? `<span class="product-badge">${fmt(inCart.qty)}</span>` : ''}
        </div>
      </div>`;
    }

    return `<div class="product-card ${recipe ? 'v66-recipe-sale-card' : ''} ${out ? 'out-of-stock' : ''}" ${attrs} onclick="${click}">
      ${badge}
      <div class="product-img">${image}${inCart ? `<span class="product-badge">${fmt(inCart.qty)}</span>` : ''}</div>
      <div class="product-info">
        <div class="product-name">${esc(product.name)}</div>
        <div class="product-sku">${sku}</div>
        ${price}${capacity}
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
      const grid = document.getElementById('pos-product-grid') || document.getElementById('productGrid');
      if (!grid) return state.originalRenderProductGrid?.();

      const category = activeCategoryText();
      const search = searchText();
      const mode = currentViewMode();
      const recipeNames = recipeProductNameSet();
      const visible = productsList()
        .filter(product => product && !isRawOnlyProduct(product))
        .filter(product => !isRecipeShadowProduct(product, recipeNames))
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

      const footer = document.getElementById('products-count') || grid.parentElement?.querySelector('.product-count, .items-count, .grid-count');
      if (footer) footer.textContent = `แสดง ${visible.length} จาก ${visible.length} รายการ`;
      scheduleRecipeCardDecorate();
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
    const { data, error, timedOut } = await withTimeout(
      db.from(UNIT_TABLE)
        .select('*')
        .eq('product_id', product.id),
      UNIT_TIMEOUT_MS,
      { data: null, error: null, timedOut: true },
      'product_units'
    );
    if (timedOut) {
      typeof toast === 'function' && toast('โหลดหน่วยขายช้าเกินไป กรุณาลองอีกครั้ง', 'error');
      return null;
    }
    if (error) {
      console.warn('[v66] cannot load product units:', error);
      return [];
    }
    return (data || [])
      .map(normalizeSellUnit)
      .filter(unit => unitConv(unit) > 0)
      .sort((a, b) => unitConv(a) - unitConv(b));
  }

  function addRecipeLine(product, unit, qty = 1, metadata = {}) {
    const normalizedUnit = normalizeSellUnit(unit || {});
    const conv = Math.max(0.000001, unitConv(normalizedUnit));
    const neededBase = num(qty) * conv;
    const list = cartList();
    const unitName = normalizedUnit.unit_name || product.unit || 'หน่วย';
    const price = unitPrice(normalizedUnit) || num(product.price);
    const existing = list.find(item =>
      item.recipe_product &&
      String(item.id) === String(product.id) &&
      String(item.unit_name || item.unit) === String(unitName)
    );
    const selectedStoneId = metadata?.concrete_stone_choice?.material_id
      || existing?.concrete_stone_choice?.material_id
      || '';
    const capacity = recipeCapacity(product.id, selectedStoneId);
    const existingBase = existing ? num(existing.qty) * Math.max(0.000001, num(existing.conv_rate || conv)) : 0;
    const reservedByOtherLines = Math.max(0, reservedRecipeBaseQty(product.id) - existingBase);
    const availableForLine = capacity === null ? null : Math.max(0, capacity - reservedByOtherLines);
    if (availableForLine === null || neededBase > availableForLine + 0.000001) {
      const stoneName = metadata?.concrete_stone_choice?.material_name || existing?.concrete_stone_choice?.material_name || '';
      typeof toast === 'function' && toast(stoneName ? `${stoneName} หรือวัตถุดิบอื่นในสูตรไม่พอ` : 'วัตถุดิบในสูตรไม่พอ', 'error');
      return false;
    }

    if (existing) {
      existing.qty = metadata.replaceQty ? num(qty) : num(existing.qty) + num(qty);
      Object.assign(existing, metadata);
    } else {
      const created = {
        ...product,
        qty: num(qty),
        price,
        original_price: price,
        unit_name: unitName,
        unit: unitName,
        unit_label: unitName,
        conv_rate: conv,
        stock: Math.max(1, Math.floor((availableForLine || 0) / conv)),
        is_mto: true,
        recipe_product: true,
        recipe_sale: true,
        __v66_recipe_sale: true,
        recipe_product_id: product.id,
        recipe_capacity: recipeCapacity(product.id),
        ...metadata,
      };
      list.push(created);
    }
    const concreteLine = existing || list[list.length - 1];
    try { window.v103SyncConcreteCart?.(list, concreteLine); } catch (error) { console.warn('[v66] sync concrete cart', error); }
    setCart(list);
    window.renderCart?.();
    setTimeout(enhanceCartControls, 0);
    window.renderProductGrid?.();
    scheduleRecipeCardDecorate();
    typeof toast === 'function' && toast(`เพิ่ม ${product.name} แล้ว`, 'success');
    return true;
  }

  async function addNormalProductLine(product) {
    const units = await getSellUnits(product);
    if (units === null) return;
    const sellUnits = units.filter(unit => !unit.is_base);
    if (sellUnits.length && typeof window.v9ShowUnitPopup === 'function') {
      return window.v9ShowUnitPopup(product, sellUnits);
    }
    const isMto = isMadeToOrderType(product);
    if (!isMto && num(product.stock) <= 0) {
      typeof toast === 'function' && toast('สินค้าหมดสต็อก', 'error');
      return;
    }
    if (typeof window.v9PushToCart === 'function') {
      return window.v9PushToCart(product, num(product.price), product.unit || 'ชิ้น', 1, 1);
    }
    return state.originalAddToCart?.(product.id);
  }

  async function addToCartV66(productId) {
    const clickedProduct = productsList().find(item => String(item.id) === String(productId));
    const product = recipeProductFor(clickedProduct) || clickedProduct;
    if (!product) return;

    const needsRecipeCheck = isRecipeManagedProduct(product) || isMadeToOrderType(product) || hasRecipe(product.id);
    if (!needsRecipeCheck) {
      if (!state.loadedAt) loadRecipes(false).then(syncRecipeFields);
      return addNormalProductLine(product);
    }

    await loadRecipes(false);
    syncRecipeFields();
    if (!hasRecipe(product.id)) {
      if (isMadeToOrderType(product)) {
        typeof toast === 'function' && toast('สินค้าตามบิลยังไม่มีสูตรคอนกรีต กรุณาสร้างสูตรก่อนขาย', 'error');
        return;
      }
      return addNormalProductLine(product);
    }

    const currentConcreteLine = cartList().find(item => item?.recipe_product && String(item.id) === String(product.id) && !item.is_extra_charge);
    if (remainingRecipeBaseQty(product.id) <= 0 && !currentConcreteLine) {
      typeof toast === 'function' && toast('วัตถุดิบในสูตรไม่พอ', 'error');
      return;
    }

    if (typeof window.v103PromptConcreteSale === 'function') {
      const current = currentConcreteLine;
      const currentQty = num(current?.qty || 0);
      const currentBase = currentQty * Math.max(0.000001, num(current?.conv_rate || 1));
      const reservedOther = Math.max(0, reservedRecipeBaseQty(product.id) - currentBase);
      const stoneOptions = stoneOptionsForRecipe(product.id).map(option => ({
        material_id: option.id,
        material_name: option.name,
        variant: stoneVariant(option),
        stock: num(option.stock),
        unit: option.unit || '',
        max_quantity_m3: Math.max(0, num(recipeCapacityWithStone(product.id, option.id)) - reservedOther),
      }));
      const availableBase = stoneOptions.length
        ? Math.max(...stoneOptions.map(option => num(option.max_quantity_m3)))
        : Math.max(0, num(remainingRecipeBaseQty(product.id)) + currentBase);
      const selection = await window.v103PromptConcreteSale(product, {
        currentQty,
        currentRequestMixDesign: current?.concrete_request_mix_design === true,
        currentStoneChoice: current?.concrete_stone_choice || null,
        stoneOptions,
        maxQty: availableBase,
        unit: product.unit || 'คิว',
        price: product.price,
      });
      if (!selection) return;
      return addRecipeLine(product, {
        unit_name: product.unit || 'คิว',
        conversion_rate: 1,
        price: product.price,
      }, selection.qty, selection);
    }

    const units = await getSellUnits(product);
    if (units === null) return;
    if (units.length && typeof window.v9ShowUnitPopup === 'function') {
      const patchedProduct = { ...product, stock: Math.max(0, remainingRecipeBaseQty(product.id)) };
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

  async function recipeAddToCartV66(productId) {
    await loadRecipes(false);
    syncRecipeFields();
    const product = recipeProductFor(productId) || productById(productId);
    if (!product || !hasRecipe(product.id)) {
      typeof toast === 'function' && toast('ไม่พบสูตรของสินค้านี้', 'error');
      return;
    }
    return addToCartV66(product.id);
  }

  function patchUnitConfirm() {
    const originalConfirm = window.v64ConfirmUnitAdd || window.v9ConfirmUnitAdd;
    if (!originalConfirm || originalConfirm.__v66RecipeConfirm) return;

    const wrapped = function (productId, unitName, convRate, price, quantity) {
      const popupProduct = window._v64UnitPopupProd || window._v9UnitPopupProd;
      const popupSelection = window._v64UnitPopupSel || window._v9UnitPopupSel;
      const resolvedProductId = productId ?? popupProduct?.id;
      const rawProduct = productsList().find(item => String(item.id) === String(resolvedProductId)) || popupProduct;
      const product = recipeProductFor(rawProduct) || rawProduct;
      if (product && hasRecipe(product.id)) {
        if (productId == null && popupSelection) {
          const qty = Math.max(0.001, num(document.getElementById('v64-unit-qty')?.value || quantity || 1));
          if (typeof closeModal === 'function') closeModal();
          document.querySelector('.modal-box')?.classList.remove('v64-unit-modal');
          return addRecipeLine(product, {
            unit_name: popupSelection.unitName,
            conv_rate: popupSelection.conv,
            price_per_unit: popupSelection.price,
          }, qty);
        }
        return addRecipeLine(product, {
          unit_name: unitName,
          conv_rate: convRate,
          price_per_unit: price,
        }, quantity || 1);
      }
      return originalConfirm.apply(this, arguments);
    };
    wrapped.__v66RecipeConfirm = true;
    setGlobal('v64ConfirmUnitAdd', wrapped);
    setGlobal('v9ConfirmUnitAdd', wrapped);
  }

  function updateCartQtyV66(index, delta) {
    const args = arguments;
    const list = cartList();
    const unitName = args[2];
    let itemIndex = -1;
    let item = null;

    if (unitName == null && Number.isInteger(Number(index)) && list[Number(index)]?.recipe_product) {
      itemIndex = Number(index);
      item = list[itemIndex];
    } else {
      itemIndex = list.findIndex(row =>
        row?.recipe_product &&
        String(row.id) === String(index) &&
        (unitName == null || String(row.unit_name || row.unit) === String(unitName))
      );
      item = itemIndex >= 0 ? list[itemIndex] : null;
    }

    if (!item?.recipe_product) return state.originalUpdateCartQty?.apply(this, args);
    const nextQty = Math.max(0, num(item.qty) + num(delta));
    if (nextQty === 0) {
      const next = list.slice();
      next.splice(itemIndex, 1);
      try { window.v103SyncConcreteCart?.(next, null, item.id); } catch (_) {}
      setCart(next);
      window.renderCart?.();
      setTimeout(enhanceCartControls, 0);
      window.renderProductGrid?.();
      scheduleRecipeCardDecorate();
      return;
    }
    const needed = nextQty * Math.max(0.000001, num(item.conv_rate || 1));
    const capacity = recipeCapacity(item.id, item?.concrete_stone_choice?.material_id || '');
    const otherReserved = reservedRecipeBaseQty(item.id) - num(item.qty) * Math.max(0.000001, num(item.conv_rate || 1));
    if (capacity !== null && needed + otherReserved > capacity + 0.000001) {
      const stoneName = item?.concrete_stone_choice?.material_name || '';
      typeof toast === 'function' && toast(stoneName ? `${stoneName} หรือวัตถุดิบอื่นในสูตรไม่พอ` : 'วัตถุดิบในสูตรไม่พอ', 'error');
      return;
    }
    item.qty = nextQty;
    try { window.v103SyncConcreteCart?.(list, item); } catch (error) { console.warn('[v66] recalc concrete cart', error); }
    setCart(list);
    window.renderCart?.();
    setTimeout(enhanceCartControls, 0);
    window.renderProductGrid?.();
    scheduleRecipeCardDecorate();
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

  window.v66PickExtra = function (btn) {
    const hidden = document.getElementById('v66ExtraName');
    if (hidden) hidden.value = btn.dataset.name || '';
    document.querySelectorAll('#v66ExtraPresets .v66-extra-preset').forEach(b => {
      const on = b === btn;
      b.style.background = on ? '#ef4444' : '';
      b.style.color = on ? '#fff' : '';
      b.style.borderColor = on ? '#ef4444' : '';
    });
  };

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
          <label>ประเภทรายการ (เลือกได้เฉพาะ 3 อย่างนี้)</label>
          <div class="v66-extra-presets" id="v66ExtraPresets">
            <button type="button" class="v66-extra-preset" data-name="ค่าขนส่ง" onclick="window.v66PickExtra(this)"><i class="material-icons-round" style="font-size:16px;">local_shipping</i> ค่าขนส่ง</button>
            <button type="button" class="v66-extra-preset" data-name="ค่าแรง" onclick="window.v66PickExtra(this)"><i class="material-icons-round" style="font-size:16px;">engineering</i> ค่าแรง</button>
            <button type="button" class="v66-extra-preset" data-name="ค่าอุปกรณ์" onclick="window.v66PickExtra(this)"><i class="material-icons-round" style="font-size:16px;">construction</i> ค่าอุปกรณ์</button>
          </div>
          <input type="hidden" id="v66ExtraName">
        </div>
        <div class="v66-extra-field">
          <label>จำนวนเงิน</label>
          <input id="v66ExtraAmount" class="v66-extra-input" type="number" min="0" step="1" placeholder="0">
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
          amount?.focus();
        },
        preConfirm: () => {
          const name = document.getElementById('v66ExtraName')?.value || '';
          const amount = document.getElementById('v66ExtraAmount')?.value || 0;
          if (!String(name).trim()) {
            Swal.showValidationMessage('กรุณาเลือกประเภทรายการ (ค่าขนส่ง / ค่าแรง / ค่าอุปกรณ์)');
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
    document.querySelectorAll('.cart-item').forEach((row, index) => {
      if (row.textContent?.includes('รายการ')) row.classList.add('v66-extra-line');
      const item = cartList()[index];
      const stoneName = item?.concrete_stone_choice?.material_name || '';
      row.querySelector('[data-v66-stone-badge]')?.remove();
      if (stoneName) {
        const badge = document.createElement('span');
        badge.dataset.v66StoneBadge = '1';
        badge.className = 'v66-stone-cart-badge';
        badge.innerHTML = `<i class="material-icons-round">landscape</i> ใช้ ${esc(stoneName)}`;
        (row.querySelector('.cart-item-info,.cart-item-name,.item-name') || row).appendChild(badge);
      }
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
      document.querySelectorAll('tr[data-v66-recipe-hidden-from-inventory="1"]').forEach(row => {
        row.style.display = '';
        delete row.dataset.v66RecipeHiddenFromInventory;
        delete row.dataset.v66RecipeLocked;
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
      const wrappedEdit = async function (productId) {
        const product = productById(productId);
        if (isRecipeManagedProduct(product)) return showRecipeManagedNotice(product);
        // ── fallback ที่เชื่อถือได้: ลองเรียก original ก่อน ถ้าไม่ได้ให้เปิด modal โดยตรง ──
        try {
          if (typeof state.originalEditProduct === 'function' && !state.originalEditProduct.__v66RecipeGuard) {
            return state.originalEditProduct.apply(this, arguments);
          }
        } catch (e) { console.warn('[v66] originalEditProduct failed, using fallback:', e); }
        // fallback: โหลดสินค้าแล้วเปิด showAddProductModal โดยตรง
        try {
          const p = product || productsList().find(x => String(x.id) === String(productId));
          if (p) { window.showAddProductModal?.(p); return; }
          if (typeof db !== 'undefined') {
            const { data } = await db.from('สินค้า').select('*').eq('id', productId).maybeSingle();
            if (data) { window.showAddProductModal?.(data); return; }
          }
          typeof toast === 'function' && toast('ไม่พบข้อมูลสินค้า', 'error');
        } catch (e2) {
          console.error('[v66] editProduct fallback failed:', e2);
          typeof toast === 'function' && toast('เกิดข้อผิดพลาดในการแก้ไขสินค้า', 'error');
        }
      };
      wrappedEdit.__v66RecipeGuard = true;
      // preserve v58 access guard flag เพื่อไม่ให้ v58 re-wrap ซ้ำ
      try { Object.defineProperty(wrappedEdit, '__v58Guarded', { value: true }); } catch (_) {}
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
      // preserve v58 access guard flag
      try { Object.defineProperty(wrapped, '__v58Guarded', { value: true }); } catch (_) {}
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

  const methodTH = {
    cash: 'เงินสด',
    transfer: 'โอนเงิน',
    credit: 'บัตรเครดิต',
    debt: 'ค้างชำระ',
    project: 'จ่ายของให้โครงการ',
  };

  function checkout() {
    try { return checkoutState || window.checkoutState || {}; } catch (_) { return window.checkoutState || {}; }
  }

  function staffName() {
    try { if (typeof v9Staff === 'function') return v9Staff(); } catch (_) {}
    try { return USER?.username || ''; } catch (_) { return ''; }
  }

  function currentBillDiscount() {
    const state = checkout();
    const input = document.getElementById('pos-discount');
    return num(state.manual_discount ?? input?.value ?? state.discount ?? 0);
  }

  function saleReturnInfo(items) {
    const itemDiscounts = (items || [])
      .map(item => {
        const qty = num(item.qty);
        const original = num(item.original_price ?? item.price);
        const price = num(item.price);
        const perUnit = Math.max(0, num(item.promo_discount ?? (original - price)));
        return {
          product_id: item.is_extra_charge ? null : item.id,
          name: item.name,
          unit: item.unit || item.unit_name || 'ชิ้น',
          qty,
          original_price: original,
          discount_per_unit: perUnit,
          discount_total: perUnit * qty,
          promo_percent: num(item.promo_percent || 0),
        };
      })
      .filter(item => item.discount_total > 0);
    const state = checkout();
    const promoDiscount = num(state.promo_discount ?? itemDiscounts.reduce((sum, item) => sum + item.discount_total, 0));
    const concreteItems = (items || []).filter(item => item?.__v103_concrete_sale && !item.is_extra_charge);
    const concretePlans = concreteItems.flatMap(item => (item.concrete_delivery_plans || []).map(plan => ({
      ...plan,
      product_id: item.id,
      product_name: item.name,
      request_mix_design: item.concrete_request_mix_design === true,
    })));
    const concreteDelivery = concreteItems.length ? {
      version: 1,
      created_at: new Date().toISOString(),
      total_quantity_m3: Number(concreteItems.reduce((sum, item) => sum + num(item.qty), 0).toFixed(3)),
      total_trips: concretePlans.length,
      total_surcharge: Number(concretePlans.reduce((sum, plan) => sum + num(plan.surcharge), 0).toFixed(2)),
      mix_design_requested: concreteItems.some(item => item.concrete_request_mix_design === true),
      items: concreteItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity_m3: Number(num(item.qty).toFixed(3)),
        request_mix_design: item.concrete_request_mix_design === true,
        stone_choice: item.concrete_stone_choice || null,
        config: item.concrete_config || null,
      })),
      plans: concretePlans,
    } : null;
    return {
      ...(state.return_info && typeof state.return_info === 'object' ? state.return_info : {}),
      item_discounts: itemDiscounts,
      promo_discount: Number(promoDiscount.toFixed(2)),
      manual_discount: Number(currentBillDiscount().toFixed(2)),
      ...(concreteDelivery ? { concrete_delivery: concreteDelivery } : {}),
    };
  }

  async function dbData(query, label) {
    const result = await withTimeout(query, SALE_TIMEOUT_MS, { timedOut: true }, label);
    if (result?.timedOut) throw new Error(`${label || 'คำสั่งฐานข้อมูล'} ช้าเกินไป กรุณาลองใหม่`);
    if (result?.error) throw new Error(`${label || 'คำสั่งฐานข้อมูล'}: ${result.error.message}`);
    return result?.data;
  }

  async function fetchProductsByIds(ids) {
    const unique = [...new Set((ids || []).filter(Boolean).map(String))];
    if (!unique.length) return new Map();
    const data = await dbData(
      db.from('สินค้า').select('id,name,stock,product_type,unit,cost').in('id', unique),
      'โหลดข้อมูลสินค้า'
    );
    const map = new Map();
    (data || []).forEach(product => map.set(String(product.id), product));
    return map;
  }

  async function fetchRecipesForSale(productIds) {
    const unique = [...new Set((productIds || []).filter(Boolean).map(String))];
    if (!unique.length) return new Map();
    const data = await dbData(
      db.from(RECIPE_TABLE).select('id,product_id,material_id,quantity,unit').in('product_id', unique),
      'โหลดสูตรสินค้า'
    );
    const map = new Map();
    (data || []).forEach(row => {
      const pid = String(row.product_id || '');
      if (!pid) return;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(row);
    });
    return map;
  }

  function addDeduction(map, product, qty, type, label) {
    const id = String(product?.id || '');
    if (!id || qty <= 0) return;
    if (!map.has(id)) {
      map.set(id, { product, qty: 0, labels: [], hasSale: false, hasRecipe: false });
    }
    const row = map.get(id);
    row.product = row.product || product;
    row.qty += qty;
    row.labels.push(label);
    if (type === 'sale') row.hasSale = true;
    if (type === 'recipe') row.hasRecipe = true;
  }

  function movementType(row) {
    if (row.hasSale && row.hasRecipe) return 'ขาย/ใช้ผลิต';
    return row.hasRecipe ? 'ใช้ผลิต(ขาย)' : 'ขาย';
  }

  async function buildRecipeSalePlan(items) {
    const sellItems = (items || []).filter(item => item && !item.is_extra_charge);
    const productIds = sellItems.map(item => item.id).filter(Boolean);
    const [stockMap, recipeMapForSale] = await Promise.all([
      fetchProductsByIds(productIds),
      fetchRecipesForSale(productIds),
    ]);

    const materialIds = [];
    recipeMapForSale.forEach(rows => rows.forEach(row => {
      if (row.material_id) materialIds.push(row.material_id);
    }));
    sellItems.forEach(item => {
      if (item?.concrete_stone_choice?.material_id) materialIds.push(item.concrete_stone_choice.material_id);
    });
    const materialMap = await fetchProductsByIds(materialIds);
    materialMap.forEach((value, key) => stockMap.set(key, value));

    const billItems = [];
    const deductions = new Map();
    const errors = [];

    (items || []).forEach(item => {
      const qty = num(item.qty);
      const conv = Math.max(0.000001, num(item.conv_rate || 1));
      const baseQty = Number((qty * conv).toFixed(6));
      const sellUnit = item.unit || item.unit_name || 'ชิ้น';

      if (item.is_extra_charge) {
        billItems.push({
          bill_id: null,
          product_id: null,
          name: item.name,
          qty,
          price: num(item.price),
          cost: 0,
          total: Number((num(item.price) * qty).toFixed(2)),
          unit: sellUnit,
        });
        return;
      }

      const fresh = stockMap.get(String(item.id)) || productById(item.id) || item;
      const rows = recipeMapForSale.get(String(item.id)) || [];
      const positiveRows = rows.filter(row => num(row.quantity) > 0 && row.material_id);
      const requiresRecipe = !!(item.__v66_recipe_sale || item.recipe_sale || item.recipe_product || rows.length || isMadeToOrderType(item) || isMadeToOrderType(fresh));

      if (requiresRecipe) {
        if (!positiveRows.length) {
          errors.push(`${item.name || fresh.name || item.id}: ยังไม่มีสูตรคอนกรีตสำหรับตัดวัตถุดิบ`);
          return;
        }

        let costPerSellUnit = 0;
        positiveRows.forEach(row => {
          const originalMaterial = stockMap.get(String(row.material_id));
          const selectedStoneId = item?.concrete_stone_choice?.material_id || '';
          const material = selectedStoneId && isSelectableStone(originalMaterial)
            ? stockMap.get(String(selectedStoneId))
            : originalMaterial;
          const perBase = num(row.quantity);
          const needed = Number((perBase * baseQty).toFixed(6));
          if (!material) {
            errors.push(`${item.name}: ไม่พบวัตถุดิบ ${selectedStoneId || row.material_id}`);
            return;
          }
          costPerSellUnit += perBase * num(material.cost) * conv;
          addDeduction(
            deductions,
            material,
            needed,
            'recipe',
            `${item.name || fresh.name} ${fmt(qty)} ${sellUnit}`
          );
        });

        billItems.push({
          bill_id: null,
          product_id: item.id,
          name: item.name || fresh.name,
          qty,
          price: num(item.price),
          cost: Number(costPerSellUnit.toFixed(6)),
          total: Number((num(item.price) * qty).toFixed(2)),
          unit: sellUnit,
          ...(item.__v103_concrete_sale ? { take_qty: 0, deliver_qty: qty } : {}),
        });
        return;
      }

      if (!fresh?.id) {
        errors.push(`${item.name || item.id}: ไม่พบข้อมูลสินค้า`);
        return;
      }
      addDeduction(
        deductions,
        fresh,
        baseQty,
        'sale',
        `${item.name || fresh.name} ${fmt(qty)} ${sellUnit}`
      );
      billItems.push({
        bill_id: null,
        product_id: item.id,
        name: item.name || fresh.name,
        qty,
        price: num(item.price),
        cost: Number((num(fresh.cost || item.cost) * conv).toFixed(6)),
        total: Number((num(item.price) * qty).toFixed(2)),
        unit: sellUnit,
      });
    });

    deductions.forEach(row => {
      const before = num(row.product?.stock);
      if (row.qty > before + 0.000001) {
        errors.push(`${row.product?.name || row.product?.id}: ต้องใช้ ${fmt(row.qty)} ${row.product?.unit || ''} แต่เหลือ ${fmt(before)} ${row.product?.unit || ''}`);
      }
    });

    return { billItems, deductions: [...deductions.values()], errors };
  }

  function recipeSaleBlockError(errors) {
    const error = new Error('วัตถุดิบไม่พอหรือสูตรไม่ครบ');
    error.__v66SaleBlocked = true;
    error.details = errors || [];
    return error;
  }

  async function showSaleBlocked(errors) {
    const rows = (errors || []).slice(0, 8).map(row => `<li>${esc(row)}</li>`).join('');
    if (typeof Swal !== 'undefined' && Swal.fire) {
      await Swal.fire({
        icon: 'error',
        title: 'ยังออกบิลไม่ได้',
        html: `<div style="text-align:left;color:#475569;font-weight:750;line-height:1.65">
          <div style="margin-bottom:10px">ระบบตรวจสูตรก่อนบันทึกบิลแล้วพบปัญหา:</div>
          <ul style="margin:0;padding-left:20px">${rows}</ul>
          <div style="margin-top:12px;color:#b91c1c;font-weight:900">ไม่มีการสร้างบิล และไม่มีการตัดสต็อก</div>
        </div>`,
        confirmButtonText: 'รับทราบ',
        confirmButtonColor: '#dc2626',
      });
      return;
    }
    typeof toast === 'function' && toast((errors || ['วัตถุดิบไม่พอ'])[0], 'error');
  }

  async function insertSaleBill(info) {
    const state = checkout();
    let deliveryState = {};
    try { deliveryState = typeof v12State !== 'undefined' ? (v12State || {}) : {}; } catch (_) { deliveryState = {}; }
    const hasConcreteDelivery = !!info?.concrete_delivery?.plans?.length;
    let deliveryModeKey = state.deliveryMode || deliveryState.deliveryMode || 'self';
    if (hasConcreteDelivery && deliveryModeKey === 'self') deliveryModeKey = 'deliver';
    const deliveryModeMap = { self: 'รับเอง', deliver: 'จัดส่ง', partial: 'รับบางส่วน' };
    const localToday = (() => {
      const now = new Date();
      return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    })();
    const payload = {
      date: new Date().toISOString(),
      method: methodTH[state.method] || 'เงินสด',
      total: num(state.total),
      discount: num(state.discount),
      received: num(state.received),
      change: num(state.change),
      customer_name: state.customer?.name || null,
      customer_id: state.customer?.id || null,
      delivery_mode: deliveryModeMap[deliveryModeKey] || deliveryModeKey || 'รับเอง',
      delivery_date: state.deliveryDate || deliveryState.deliveryDate || (hasConcreteDelivery ? localToday : null),
      delivery_address: state.deliveryAddress || deliveryState.deliveryAddress || state.customer?.address || null,
      delivery_phone: state.deliveryPhone || deliveryState.deliveryPhone || state.customer?.phone || null,
      delivery_status: deliveryModeKey !== 'self' ? 'รอจัดส่ง' : 'สำเร็จ',
      staff_name: staffName(),
      status: state.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
    };
    const basicPayload = { ...payload };
    delete basicPayload.delivery_address;
    delete basicPayload.delivery_phone;
    const attempts = [
      { ...payload, return_info: info },
      payload,
      { ...basicPayload, return_info: info },
      basicPayload,
    ];
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const bill = await dbData(db.from('บิลขาย').insert(attempt).select().single(), 'บันทึกบิล');
        if (!('return_info' in attempt)) {
          try { await db.from('บิลขาย').update({ return_info: info }).eq('id', bill.id); } catch (_) {}
        }
        return bill;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('บันทึกบิลไม่สำเร็จ');
  }

  async function applyStockDeduction(row, bill) {
    const before = num(row.product?.stock);
    const after = Number((before - row.qty).toFixed(6));
    if (after < -0.000001) throw new Error(`${row.product?.name || row.product?.id}: สต็อกไม่พอ`);
    const updated = await dbData(
      db.from('สินค้า')
        .update({ stock: Math.max(0, after), updated_at: new Date().toISOString() })
        .eq('id', row.product.id)
        .eq('stock', before)
        .select('id'),
      `ตัดสต็อก ${row.product?.name || row.product?.id}`
    );
    if (!updated?.length) {
      throw new Error(`${row.product?.name || row.product?.id}: สต็อกถูกเปลี่ยนจากเครื่องอื่น กรุณาลองใหม่`);
    }
    await dbData(db.from('stock_movement').insert({
      product_id: row.product.id,
      product_name: row.product.name || row.product.id,
      type: movementType(row),
      direction: 'out',
      qty: Number(row.qty.toFixed(6)),
      stock_before: before,
      stock_after: Math.max(0, after),
      ref_id: bill.id,
      ref_table: 'บิลขาย',
      staff_name: staffName(),
      note: `บิล #${bill.bill_no || bill.id}: ${row.labels.slice(0, 4).join(', ')}`,
    }), `บันทึกประวัติสต็อก ${row.product?.name || row.product?.id}`);
  }

  async function saleV66RecipeAware(originalSale, self, args) {
    sanitizeExtraChargesBeforeSale();
    const snapshot = cartList().map(item => ({ ...item }));
    const hasRecipeCandidate = snapshot.some(item => {
      if (!item || item.is_extra_charge) return false;
      const product = productById(item.id);
      return !!(item.__v66_recipe_sale || item.recipe_sale || item.recipe_product || hasRecipe(item.id) || isMadeToOrderType(item) || isMadeToOrderType(product));
    });
    if (!hasRecipeCandidate) return originalSale?.apply(self, args);

    if (window.isProcessingPayment) return;
    window.isProcessingPayment = true;
    let bill = null;
    try {
      if (!snapshot.length) throw new Error('ไม่มีสินค้าในตะกร้า');
      if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังตรวจสูตรและตัดสต็อก...', 'ตรวจวัตถุดิบก่อนออกบิล');
      const state = checkout();
      const session = await dbData(
        db.from('cash_session').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle(),
        'โหลดรอบเงินสด'
      );
      if (state.customer?.id) {
        try {
          const customer = await dbData(db.from('customer').select('address,phone').eq('id', state.customer.id).maybeSingle(), 'โหลดข้อมูลลูกค้า');
          if (customer) {
            state.customer.address = customer.address || state.customer.address || '';
            state.customer.phone = customer.phone || state.customer.phone || '';
          }
        } catch (_) {}
      }

      const plan = await buildRecipeSalePlan(snapshot);
      if (plan.errors.length) throw recipeSaleBlockError(plan.errors);

      const info = saleReturnInfo(snapshot);
      bill = await insertSaleBill(info);
      const billRows = plan.billItems.map(item => ({ ...item, bill_id: bill.id }));
      if (billRows.length) await dbData(db.from('รายการในบิล').insert(billRows), 'บันทึกรายการในบิล');
      try { await window.v103PersistConcretePlans?.({ ...bill, return_info: info }, snapshot); } catch (error) { console.warn('[v66] persist concrete plans', error); }
      for (const row of plan.deductions) {
        await applyStockDeduction(row, bill);
      }

      if (state.method === 'cash' && session && typeof window.recordCashTx === 'function') {
        let changeDenoms = state.changeDenominations || {};
        if (!Object.values(changeDenoms || {}).some(v => Number(v) > 0) && num(state.change) > 0 && typeof calcChangeDenominations === 'function') {
          changeDenoms = calcChangeDenominations(num(state.change));
        }
        await window.recordCashTx({
          sessionId: session.id,
          type: 'ขาย',
          direction: 'in',
          amount: num(state.received),
          changeAmt: num(state.change),
          netAmount: num(state.total),
          refId: bill.id,
          refTable: 'บิลขาย',
          denominations: state.receivedDenominations || null,
          changeDenominations: changeDenoms || null,
          note: null,
        });
      }

      if (state.customer?.id) {
        const customer = await dbData(db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id', state.customer.id).maybeSingle(), 'โหลดข้อมูลลูกค้า');
        await dbData(db.from('customer').update({
          total_purchase: num(customer?.total_purchase) + num(state.total),
          visit_count: num(customer?.visit_count) + 1,
          debt_amount: state.method === 'debt'
            ? num(customer?.debt_amount) + num(state.total)
            : num(customer?.debt_amount),
        }).eq('id', state.customer.id), 'อัปเดตข้อมูลลูกค้า');
      }

      typeof logActivity === 'function' && logActivity('ขายสินค้า', `บิล #${bill.bill_no || bill.id} ฿${fmt(state.total)}`, bill.id, 'บิลขาย');
      typeof sendToDisplay === 'function' && sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: state.total });
      const bItems = await dbData(db.from('รายการในบิล').select('*').eq('bill_id', bill.id), 'โหลดรายการในบิล');
      setCart([]);
      await loadProducts?.();
      window.renderCart?.();
      window.renderProductGrid?.();
      updateHomeStats?.();
      if (typeof v9HideOverlay === 'function') v9HideOverlay();
      typeof closeCheckout === 'function' && closeCheckout();

      const { value: printChoice } = typeof Swal !== 'undefined' && Swal.fire
        ? await Swal.fire({
          icon: 'success',
          title: `บิล #${bill.bill_no || ''} สำเร็จ`,
          html: `<div style="font-size:28px;font-weight:950;color:#16a34a;margin:8px 0">฿${fmt(bill.total)}</div>
            <div style="display:flex;gap:10px;justify-content:center;">
              <button onclick="Swal.getConfirmButton().click();window._v9PrintFmt='80mm'" style="padding:14px 18px;border-radius:12px;border:2px solid #dc2626;background:#fff5f5;color:#dc2626;font-weight:900;cursor:pointer">80mm</button>
              <button onclick="Swal.getConfirmButton().click();window._v9PrintFmt='A4'" style="padding:14px 18px;border-radius:12px;border:2px solid #2563eb;background:#eff6ff;color:#2563eb;font-weight:900;cursor:pointer">A4</button>
              <button onclick="Swal.getDenyButton().click()" style="padding:14px 18px;border-radius:12px;border:2px solid #d1d5db;background:#f9fafb;color:#64748b;font-weight:900;cursor:pointer">ข้าม</button>
            </div>`,
          showConfirmButton: true,
          showDenyButton: true,
          showCancelButton: false,
          confirmButtonText: '',
          denyButtonText: '',
          didOpen: () => {
            document.querySelectorAll('.swal2-confirm,.swal2-deny').forEach(button => { button.style.display = 'none'; });
            window._v9PrintFmt = null;
          },
          timer: 15000,
          timerProgressBar: true,
        })
        : {};
      const printFmt = window._v9PrintFmt || (printChoice || null);
      if (printFmt && typeof printReceipt === 'function') printReceipt(bill, bItems || [], printFmt);
      window._v9PrintFmt = null;
      return bill;
    } catch (error) {
      if (typeof v9HideOverlay === 'function') v9HideOverlay();
      if (error?.__v66SaleBlocked) {
        await showSaleBlocked(error.details);
      } else {
        console.error('[v66 recipe sale]', error);
        if (bill?.id) {
          try {
            await db.from('บิลขาย').update({
              status: 'รอตรวจสอบ',
              note: 'บันทึกไม่ครบ: ' + (error.message || error),
            }).eq('id', bill.id);
          } catch (_) {}
        }
        typeof toast === 'function' && toast('บันทึกขายไม่สำเร็จ: ' + (error.message || error), 'error');
      }
    } finally {
      window.isProcessingPayment = false;
    }
  }

  async function saleV66() {
    return saleV66RecipeAware(state.originalSale, this, arguments);
  }

  function wrapSaleFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v66RecipeSaleWrapper) return;
    const wrapped = async function () {
      return saleV66RecipeAware(original, this, arguments);
    };
    wrapped.__v66RecipeSaleWrapper = true;
    wrapped.__v66ExtraSale = true;
    wrapped.__v36safe = original.__v36safe;
    try { Object.defineProperty(wrapped, '__v58Guarded', { value: true }); } catch (_) {}
    setGlobal(name, wrapped);
  }

  function installStyles() {
    if (document.getElementById('v66-pos-recipe-style')) return;
    const style = document.createElement('style');
    style.id = 'v66-pos-recipe-style';
    style.textContent = `
      .product-card,.product-list-item{position:relative}
      .v66-recipe-badge{position:absolute;left:8px;top:8px;z-index:5;border:1px solid #bfdbfe;background:#eff6ff;color:#2563eb;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:900;box-shadow:none}
      .product-card[data-v66-recipe="1"]:not(.out-of-stock){border-color:#dbeafe;box-shadow:0 8px 20px rgba(15,23,42,.05);background:#fff}
      .product-list-item[data-v66-recipe="1"]:not(.out-of-stock){border-color:#dbeafe;background:#fff}
      .product-card[data-v66-recipe="1"] .product-sku{color:#94a3b8;font-weight:750;font-size:11px}
      /* ราคาในสูตรใช้หน้าตาเดียวกับการ์ดสินค้าปกติ */.product-card[data-v66-recipe="1"] .v66-recipe-price{margin-top:auto;padding:0;border:0;background:transparent;display:flex;align-items:baseline;gap:3px}.product-card[data-v66-recipe="1"] .v66-recipe-price span{display:none}.product-card[data-v66-recipe="1"] .v66-recipe-price b{font-size:16px!important;line-height:1;color:var(--primary,#dc2626);font-weight:800;white-space:nowrap}.product-card[data-v66-recipe="1"] .v66-recipe-price b small{font-size:10px;margin-left:3px;color:#94a3b8;font-weight:800}.product-card[data-v66-recipe="1"] .v66-recipe-capacity,.product-card[data-v66-recipe="1"] .product-footer{display:none!important}.product-list-item[data-v66-recipe="1"] .v66-recipe-price{display:none}.product-list-item[data-v66-recipe="1"] .v66-recipe-capacity{display:none}
      .v66-recipe-capacity{margin:7px 0 6px;border:1px solid #dbeafe;background:#f8fafc;border-radius:10px;padding:6px 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;box-shadow:none}
      .v66-recipe-capacity span{font-size:10px;line-height:1;color:#64748b;font-weight:900;letter-spacing:0;text-transform:none}
      .v66-recipe-capacity b{font-size:14px;line-height:1.1;color:#0f766e;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v66-recipe-capacity.compact{display:inline-flex;margin:5px 0 0;min-width:120px;padding:5px 8px;border-radius:999px;align-items:center;gap:7px}
      .v66-recipe-capacity.compact b{font-size:12px}
      .v66-recipe-capacity.bad{border-color:#fecaca;background:#fff7f7}
      .v66-recipe-capacity.bad span,.v66-recipe-capacity.bad b{color:#b91c1c}
      #pos-product-grid .v66-material-placeholder{width:100%;height:100%;min-height:100%;display:flex;align-items:center;justify-content:center;border-radius:inherit;background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 48%,#f0fdf4 100%);box-shadow:inset 0 0 0 1px rgba(148,163,184,.28);position:relative;overflow:hidden}
      #pos-product-grid .v66-material-placeholder:before{content:"";position:absolute;inset:10px;border-radius:14px;border:1px dashed rgba(71,85,105,.22)}
      #pos-product-grid .v66-material-placeholder span{position:relative;font-size:42px;line-height:1;filter:drop-shadow(0 6px 10px rgba(15,23,42,.14))}
      #pos-product-grid .product-list-img .v66-material-placeholder span{font-size:26px}
      .product-card[data-v66-recipe="1"] .product-stock:not(.out),.product-list-item[data-v66-recipe="1"] .product-stock:not(.out){display:inline-flex;align-items:center;border:1px solid #86efac;background:#f0fdf4;color:#047857!important;border-radius:999px;padding:3px 8px;font-weight:950}
      .product-card[data-v66-recipe="1"].out-of-stock .product-stock,.product-list-item[data-v66-recipe="1"].out-of-stock .product-stock{display:inline-flex;align-items:center;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c!important;border-radius:999px;padding:3px 8px;font-weight:950}
      .v66-extra-btn{width:38px;height:38px;border:0;border-radius:12px;background:#fff;color:#dc2626;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
      .v66-stone-cart-badge{width:max-content;margin-top:5px;display:flex;align-items:center;gap:4px;border:1px solid #fdba74;background:#fff7ed;color:#c2410c;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:950}.v66-stone-cart-badge i{font-size:13px}
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
      .v66-recipe-stock-pill{display:inline-flex;align-items:center;justify-content:center;min-height:28px;border:1px solid #86efac;background:#f0fdf4;color:#047857;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:950;white-space:nowrap}
      .v66-recipe-stock-pill.bad{border-color:#fecaca;background:#fff1f2;color:#b91c1c}
    `;
    document.head.appendChild(style);
  }

  function installCore() {
    installStyles();
    if (window.renderProductGrid !== renderProductGridV66) {
      if (window.renderProductGrid && window.renderProductGrid !== renderProductGridV66) state.originalRenderProductGrid = window.renderProductGrid;
      renderProductGridV66.__v66RecipeGrid = true;
      try {
        Object.defineProperty(renderProductGridV66, '__v50PromoCat', { value: true, configurable: true });
        Object.defineProperty(renderProductGridV66, '__v59PromoGuarded', { value: true, configurable: true });
        Object.defineProperty(renderProductGridV66, '__v36limited', { value: true, configurable: true });
        Object.defineProperty(renderProductGridV66, '__v36bw', { value: true, configurable: true });
      } catch (_) {}
      setGlobal('renderProductGrid', renderProductGridV66);
    }
    if (window.addToCart !== addToCartV66) {
      if (window.addToCart && window.addToCart !== addToCartV66) state.originalAddToCart = window.addToCart;
      addToCartV66.__v66RecipeAdd = true;
      addToCartV66.__v36instant = true;
      setGlobal('addToCart', addToCartV66);
    }
    if (window.updateCartQty !== updateCartQtyV66) {
      if (window.updateCartQty && window.updateCartQty !== updateCartQtyV66) state.originalUpdateCartQty = window.updateCartQty;
      updateCartQtyV66.__v66RecipeQty = true;
      updateCartQtyV66.__v36instant = true;
      setGlobal('updateCartQty', updateCartQtyV66);
    }
    wrapSaleFunction('completeSale');
    wrapSaleFunction('completePayment');
    wrapSaleFunction('v4CompletePayment');
    wrapSaleFunction('v9Sale');
    patchUnitConfirm();
    patchInventoryGuards();
    enhanceCartControls();
    installRecipeCardObserver();
    scheduleRecipeCardDecorate();
    setTimeout(protectRecipeInventoryRows, 0);
    setGlobal('v66ReloadRecipes', async () => {
      state.loadedAt = 0;
      await loadRecipes(true);
      syncRecipeFields();
      window.renderProductGrid?.();
      scheduleRecipeCardDecorate();
      return state.recipes;
    });
    setGlobal('v66SaveExtraCharge', () => addExtraCharge(
      document.getElementById('v66ExtraName')?.value,
      document.getElementById('v66ExtraAmount')?.value
    ));
    setGlobal('v66ShowExtraChargeModal', showExtraChargeModal);
    setGlobal('v66RecipeAddToCart', recipeAddToCartV66);
    setGlobal('v66RecipeAwareAddToCart', addToCartV66);
    setGlobal('v66RecipeAwareUpdateCartQty', updateCartQtyV66);
    setGlobal('v66HasRecipe', productId => !!recipeProductIdFor(productId));
    setGlobal('v66RecipeRemaining', productId => {
      const id = recipeProductIdFor(productId);
      return id ? remainingRecipeBaseQty(id) : 0;
    });
    setGlobal('v66ConcreteStoneOptions', productId => stoneOptionsForRecipe(productId).map(option => ({
      material_id: option.id,
      material_name: option.name,
      variant: stoneVariant(option),
      stock: num(option.stock),
      unit: option.unit || '',
      max_quantity_m3: recipeCapacityWithStone(productId, option.id),
    })));
    setGlobal('v66RecipeStockText', productId => {
      const product = recipeProductFor(productId) || productById(productId);
      if (!product) return '';
      if (hasRecipe(product.id)) return stockText(product);
      return shouldRecipeHandleProduct(product) ? 'สูตรไม่ครบ' : stockText(product);
    });
    setGlobal('v66RecipeShouldHandleProduct', shouldRecipeHandleProduct);
    setGlobal('v66ShouldHideProductInPos', shouldHideProductInPos);
  }

  async function boot() {
    installCore();
    syncRecipeFields();
    window.renderProductGrid?.();
    setTimeout(enhanceCartControls, 0);
    setTimeout(installRecipeCardObserver, 0);
    scheduleRecipeCardDecorate();
    loadRecipes(true).then(() => {
      syncRecipeFields();
      window.renderProductGrid?.();
      setTimeout(enhanceCartControls, 0);
      setTimeout(protectRecipeInventoryRows, 0);
      scheduleRecipeCardDecorate();
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
    recipeAddToCartV66(card.dataset.v66ProductId);
  }, true);

  boot();
  [500, 1500, 3000].forEach(delay => setTimeout(() => {
    installCore();
    setTimeout(enhanceCartControls, 0);
    setTimeout(installRecipeCardObserver, 0);
    scheduleRecipeCardDecorate();
  }, delay));
})();
