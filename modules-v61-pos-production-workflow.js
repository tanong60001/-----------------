// V61: POS page sizing and backroom production stock workflow.
(function () {
  'use strict';

  const POS_BATCH_SIZE = 60;
  const PRODUCT_TABLE = 'สินค้า';
  const RECIPE_TABLE = 'สูตรสินค้า';
  const MOVEMENT_TABLE = 'stock_movement';

  function fmt(value) {
    try { return typeof formatNum === 'function' ? formatNum(value) : Number(value || 0).toLocaleString('th-TH'); }
    catch (_) { return Number(value || 0).toLocaleString('th-TH'); }
  }

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

  function isAdmin() {
    try {
      if (window.__SK_ACCESS_GUARD__?.isAdmin) return window.__SK_ACCESS_GUARD__.isAdmin();
      return typeof USER !== 'undefined' && USER?.role === 'admin';
    } catch (_) {
      return false;
    }
  }

  function setGlobal(name, fn) {
    window[name] = fn;
    try { Function('name', 'fn', 'window[name] = fn; eval(name + " = fn");')(name, fn); }
    catch (_) {}
  }

  function isMadeToOrderProduct(product) {
    const type = String(product?.product_type || '');
    return type === 'ตามบิล' || type.includes('ตามบิล') || type.includes('เธ•เธฒเธกเธเธดเธฅ');
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
    try { if (Array.isArray(products)) products = list; } catch (_) {}
    try { window.products = list; } catch (_) {}
    try { window._v9ProductsCache = list; } catch (_) {}
  }

  function cartList() {
    try { if (Array.isArray(cart)) return cart; } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }

  function allCategoryText() {
    try { return typeof activeCategory !== 'undefined' ? String(activeCategory || '') : ''; }
    catch (_) { return ''; }
  }

  function isAllCategory(cat) {
    return !cat || /ทั้งหมด|all|เธซเธกเธ”|เธ—เธฑ/.test(String(cat));
  }

  function isSellableProduct(product) {
    const type = String(product?.product_type || '').toLowerCase();
    const category = String(product?.category || '').toLowerCase();
    if (product?.is_raw === true && !/both|ทั้งคู่/.test(type)) return false;
    if (/raw|วัตถุดิบ|material/.test(type) && !/both|ทั้งคู่/.test(type)) return false;
    if (/วัตถุดิบ|raw|material/.test(category) && !/both|ทั้งคู่/.test(type)) return false;
    return true;
  }

  function productMatch(product, search) {
    if (!search) return true;
    const text = [product?.name, product?.barcode, product?.category, product?.unit]
      .filter(Boolean).join(' ').toLowerCase();
    return text.includes(String(search || '').toLowerCase());
  }

  function bestSellerScore(product) {
    try {
      if (typeof window.bestSellerScoreV36 === 'function') return window.bestSellerScoreV36(product);
    } catch (_) {}
    return money(product?.sold_count || product?.sales_count || 0);
  }

  function installPosBatchGrid() {
    if (window.renderProductGrid?.__v61posBatch) return;

    window.v61PosBatchSize = POS_BATCH_SIZE;
    window.v61PosLimit = window.v61PosLimit || POS_BATCH_SIZE;
    window.v61PosKey = '';
    window.v36ShowMoreProducts = window.v61ShowMoreProducts = function () {
      window.v61PosLimit = (window.v61PosLimit || POS_BATCH_SIZE) + POS_BATCH_SIZE;
      window.renderProductGrid?.();
    };

    window.renderProductGrid = function () {
      const container = document.getElementById('pos-product-grid');
      if (!container) return;

      const searchTerm = document.getElementById('pos-search')?.value?.trim().toLowerCase() || '';
      const viewMode = document.querySelector('.view-btn.active')?.dataset?.view || 'grid';
      const cat = allCategoryText();
      const key = `${searchTerm}|${cat}|${viewMode}`;
      if (window.v61PosKey !== key) {
        window.v61PosKey = key;
        window.v61PosLimit = POS_BATCH_SIZE;
      }

      const source = productList().filter(isSellableProduct);
      const all = source.filter(product => {
        const categoryOk = isAllCategory(cat) || String(product?.category || '') === cat;
        return categoryOk && productMatch(product, searchTerm);
      }).sort((a, b) => {
        const diff = bestSellerScore(b) - bestSellerScore(a);
        return diff || String(a?.name || '').localeCompare(String(b?.name || ''), 'th');
      });

      const shown = all.slice(0, window.v61PosLimit || POS_BATCH_SIZE);
      const countEl = document.getElementById('products-count');
      if (countEl) {
        countEl.textContent = `แสดง ${shown.length} จาก ${all.length} รายการ`;
        countEl.title = `หน้าขายแสดงครั้งละ ${POS_BATCH_SIZE} รายการ เพื่อลดงานวาดหน้าจอและโหลดรูปเท่าที่จำเป็น`;
      }

      const renderCard = product => {
        const inCart = cartList().find(item => String(item.id) === String(product.id));
        const isLow = money(product.stock) <= money(product.min_stock) && money(product.stock) > 0;
        const isOut = money(product.stock) <= 0 && !isMadeToOrderProduct(product);
        if (viewMode === 'list') {
          return `<div class="product-list-item ${isOut ? 'out-of-stock' : ''}" style="position:relative;overflow:hidden" onclick="addToCart('${js(product.id)}')">
            <div class="product-list-img">${product.img_url ? `<img src="${html(product.img_url)}" alt="${html(product.name)}" loading="lazy">` : `<i class="material-icons-round">inventory_2</i>`}</div>
            <div class="product-list-info"><div class="product-name">${html(product.name || '')}</div><div class="product-sku">${html(product.barcode || '-')}</div></div>
            <div class="product-list-right"><span class="product-price">฿${fmt(product.price)}</span><span class="product-stock ${isLow ? 'low' : ''} ${isOut ? 'out' : ''}">${isOut ? 'หมด' : fmt(product.stock)}</span>${inCart ? `<span class="product-badge">${fmt(inCart.qty)}</span>` : ''}</div>
          </div>`;
        }
        return `<div class="product-card ${isOut ? 'out-of-stock' : ''}" style="position:relative;overflow:hidden" onclick="addToCart('${js(product.id)}')">
          <div class="product-img">${product.img_url ? `<img src="${html(product.img_url)}" alt="${html(product.name)}" loading="lazy">` : `<i class="material-icons-round">inventory_2</i>`}${inCart ? `<span class="product-badge">${fmt(inCart.qty)}</span>` : ''}</div>
          <div class="product-info"><div class="product-name">${html(product.name || '')}</div><div class="product-sku">${html(product.barcode || '-')}</div><div class="product-footer"><span class="product-price">฿${fmt(product.price)}</span><span class="product-stock ${isLow ? 'low' : ''} ${isOut ? 'out' : ''}">${isOut ? 'หมด' : fmt(product.stock)}</span></div></div>
        </div>`;
      };

      container.className = viewMode === 'list' ? 'product-list' : 'product-grid';
      container.style.gridTemplateColumns = viewMode === 'grid' && window.innerWidth >= 1280 ? 'repeat(8,minmax(0,1fr))' : '';
      container.innerHTML = shown.map(renderCard).join('') + (shown.length < all.length ? `
        <button type="button" onclick="v61ShowMoreProducts()" style="grid-column:1/-1;margin:8px auto 0;padding:10px 18px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px">
          <i class="material-icons-round">expand_more</i> แสดงเพิ่มอีก ${Math.min(POS_BATCH_SIZE, all.length - shown.length)} รายการ
        </button>` : '');

      try { window.__SK_POS_DISPLAY_LIMIT__ = { batchSize: POS_BATCH_SIZE, shown: shown.length, total: all.length }; } catch (_) {}
    };

    window.renderProductGrid.__v61posBatch = true;
    try { renderProductGrid = window.renderProductGrid; } catch (_) {}
  }

  function injectProductionStyle() {
    if (document.getElementById('v61-production-style')) return;
    const style = document.createElement('style');
    style.id = 'v61-production-style';
    style.textContent = `
      .v61-prod{display:grid;gap:16px}
      .v61-prod-hero{border:1px solid #dbeafe;background:linear-gradient(135deg,#eff6ff,#f8fafc);border-radius:16px;padding:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .v61-prod-title{display:flex;align-items:center;gap:12px}
      .v61-prod-title i{width:46px;height:46px;border-radius:13px;background:#2563eb;color:#fff;display:grid;place-items:center}
      .v61-prod-title h3{margin:0;font-size:20px;font-weight:950;color:#0f172a}
      .v61-prod-title p{margin:4px 0 0;color:#64748b;font-size:13px;font-weight:700}
      .v61-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:16px}
      .v61-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.04)}
      .v61-card-h{padding:14px 16px;border-bottom:1px solid #eef2f7;background:#f8fafc;font-weight:950;color:#0f172a;display:flex;align-items:center;justify-content:space-between;gap:10px}
      .v61-card-b{padding:14px 16px;display:grid;gap:10px}
      .v61-output-row{display:grid;grid-template-columns:auto 1fr 110px;align-items:center;gap:12px;border:1px solid #e2e8f0;border-radius:13px;padding:12px;background:#fff}
      .v61-output-row input[type=checkbox]{width:20px;height:20px;accent-color:#2563eb}
      .v61-prod-name{font-weight:950;color:#0f172a}
      .v61-prod-meta{font-size:12px;color:#64748b;margin-top:3px}
      .v61-input{width:100%;height:42px;border:1.5px solid #dbe3ef;border-radius:10px;padding:0 10px;font:inherit;font-weight:800;box-sizing:border-box}
      .v61-input:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.1)}
      .v61-material-row{display:grid;grid-template-columns:1fr 112px 80px;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:13px;padding:12px;background:#fff}
      .v61-material-name{font-weight:900;color:#0f172a}
      .v61-material-meta{font-size:12px;color:#64748b;margin-top:2px}
      .v61-empty{padding:28px;text-align:center;color:#94a3b8;background:#f8fafc;border-radius:14px;font-weight:800}
      .v61-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
      .v61-summary{border:1px solid #ccfbf1;background:#f0fdfa;color:#0f766e;border-radius:13px;padding:12px 14px;font-weight:900;font-size:13px}
      @media(max-width:900px){.v61-grid{grid-template-columns:1fr}.v61-output-row,.v61-material-row{grid-template-columns:1fr}.v61-actions .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function loadRecipes() {
    const { data, error } = await db.from(RECIPE_TABLE).select('id,product_id,material_id,quantity,unit');
    if (error) throw error;
    return data || [];
  }

  function recipeProducts(recipes, products) {
    const ids = [...new Set(recipes.map(row => row.product_id).filter(Boolean))];
    return ids.map(id => products.find(product => String(product.id) === String(id))).filter(Boolean)
      .filter(product => !product.is_raw && !isMadeToOrderProduct(product))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
  }

  window.v61RecalcProductionPlan = async function () {
    const recipes = window.__v61Recipes || [];
    const products = productList();
    const productMap = Object.fromEntries(products.map(product => [String(product.id), product]));
    const materialTotals = {};
    const outputs = [];

    document.querySelectorAll('[data-v61-output]').forEach(row => {
      const productId = row.dataset.v61Output;
      const checked = row.querySelector('[data-v61-output-check]')?.checked;
      const qty = money(row.querySelector('[data-v61-output-qty]')?.value);
      if (!checked || qty <= 0) return;
      const product = productMap[String(productId)];
      outputs.push({ productId, qty, product });
      recipes.filter(recipe => String(recipe.product_id) === String(productId)).forEach(recipe => {
        const matId = String(recipe.material_id);
        if (!materialTotals[matId]) materialTotals[matId] = { materialId: matId, suggested: 0, material: productMap[matId], unit: recipe.unit || productMap[matId]?.unit || '' };
        materialTotals[matId].suggested += money(recipe.quantity) * qty;
      });
    });

    const body = document.getElementById('v61-material-body');
    const summary = document.getElementById('v61-production-summary');
    if (summary) summary.textContent = outputs.length ? `เลือกสินค้าเก็บสต็อก ${outputs.length} รายการ ระบบคำนวณวัตถุดิบจากสูตรให้แล้ว แต่แก้ยอดใช้จริงได้` : 'เลือกสินค้าที่นำไปผลิตวันนี้ก่อน';
    if (!body) return;

    const rows = Object.values(materialTotals);
    body.innerHTML = rows.length ? rows.map(row => {
      const stock = money(row.material?.stock);
      const value = Number(row.suggested.toFixed(3));
      return `<div class="v61-material-row" data-v61-material="${html(row.materialId)}">
        <div>
          <div class="v61-material-name">${html(row.material?.name || row.materialId)}</div>
          <div class="v61-material-meta">แนะนำ ${fmt(value)} ${html(row.unit || '')} · คงเหลือ ${fmt(stock)} ${html(row.material?.unit || '')}</div>
        </div>
        <input class="v61-input" type="number" min="0" step="0.001" data-v61-material-qty value="${html(value)}">
        <div style="font-size:12px;font-weight:900;color:${stock < value ? '#dc2626' : '#16a34a'}">${stock < value ? 'ไม่พอ' : 'พอ'}</div>
      </div>`;
    }).join('') : '<div class="v61-empty">ยังไม่มีวัตถุดิบที่ต้องตัด</div>';
  };

  window.v61FilterOutputProducts = function () {
    const term = String(document.getElementById('v61-output-search')?.value || '').trim().toLowerCase();
    document.querySelectorAll('[data-v61-output]').forEach(row => {
      const text = String(row.dataset.v61Search || row.textContent || '').toLowerCase();
      row.style.display = !term || text.includes(term) ? '' : 'none';
    });
  };

  window.v61SaveProduction = async function () {
    const products = productList();
    const productMap = Object.fromEntries(products.map(product => [String(product.id), product]));
    const outputs = [];
    const materials = [];

    document.querySelectorAll('[data-v61-output]').forEach(row => {
      const productId = row.dataset.v61Output;
      const checked = row.querySelector('[data-v61-output-check]')?.checked;
      const qty = money(row.querySelector('[data-v61-output-qty]')?.value);
      if (checked && qty > 0) outputs.push({ productId, qty, product: productMap[String(productId)] });
    });

    document.querySelectorAll('[data-v61-material]').forEach(row => {
      const materialId = row.dataset.v61Material;
      const qty = money(row.querySelector('[data-v61-material-qty]')?.value);
      if (qty > 0) materials.push({ materialId, qty, material: productMap[String(materialId)] });
    });

    if (!outputs.length) { toast?.('กรุณาเลือกสินค้าที่นำไปผลิตวันนี้', 'warning'); return; }
    if (!materials.length) { toast?.('กรุณาระบุวัตถุดิบที่ใช้จริง', 'warning'); return; }

    const touchedIds = [...new Set([
      ...materials.map(item => item.materialId),
      ...outputs.map(item => item.productId)
    ].filter(Boolean).map(String))];
    const { data: freshRows, error: freshError } = await db.from(PRODUCT_TABLE)
      .select('id,name,stock,unit,product_type,category')
      .in('id', touchedIds);
    if (freshError) { toast?.('โหลดสต็อกล่าสุดไม่สำเร็จ: ' + freshError.message, 'error'); return; }
    const freshMap = Object.fromEntries((freshRows || []).map(product => [String(product.id), product]));
    materials.forEach(item => { item.material = freshMap[String(item.materialId)] || item.material; });
    outputs.forEach(item => { item.product = freshMap[String(item.productId)] || item.product; });

    const shortMaterials = materials.filter(item => money(item.material?.stock) < item.qty);
    if (shortMaterials.length) {
      const ok = await Swal.fire({
        icon: 'warning',
        title: 'วัตถุดิบคงเหลือไม่พอ',
        html: shortMaterials.map(item => `${html(item.material?.name || item.materialId)} มี ${fmt(item.material?.stock)} ใช้ ${fmt(item.qty)}`).join('<br>'),
        showCancelButton: true,
        confirmButtonText: 'บันทึกต่อ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626'
      });
      if (!ok.isConfirmed) return;
    }

    const refId = `PROD-${Date.now()}`;
    const staff = (() => { try { return USER?.username || ''; } catch (_) { return ''; } })();
    const outputText = outputs.map(item => `${item.product?.name || item.productId} x ${fmt(item.qty)}`).join(', ');

    try {
      const now = new Date().toISOString();
      const movements = [];
      const updateStock = async (item, product, qty, direction, type, note) => {
        const before = money(product?.stock);
        const after = direction === 'out' ? before - qty : before + qty;
        const { error: updateError } = await db.from(PRODUCT_TABLE)
          .update({ stock: after, updated_at: now })
          .eq('id', product.id);
        if (updateError) throw updateError;
        product.stock = after;
        movements.push({
          product_id: product.id,
          product_name: product.name || item.productId || item.materialId,
          type,
          direction,
          qty,
          stock_before: before,
          stock_after: after,
          ref_id: refId,
          ref_table: 'backroom_production',
          staff_name: staff,
          note
        });
      };

      for (const item of materials) {
        if (!item.material?.id) throw new Error('ไม่พบวัตถุดิบในคลัง: ' + item.materialId);
        await updateStock(
          item,
          item.material,
          item.qty,
          'out',
          'ตัดสต็อกหลังร้าน',
          `ใช้จริงในการผลิต: ${outputText}`
        );
      }

      for (const item of outputs) {
        if (!item.product?.id) throw new Error('ไม่พบสินค้าที่ผลิตในคลัง: ' + item.productId);
        await updateStock(
          item,
          item.product,
          item.qty,
          'in',
          'ผลิตเข้า',
          'เพิ่มจากการผลิตหลังร้าน'
        );
      }

      if (movements.length) {
        const { error: moveError } = await db.from(MOVEMENT_TABLE).insert(movements);
        if (moveError) throw moveError;
      }

      updateProductCache(Object.values(freshMap));
      try { renderProductGrid?.(); } catch (_) {}
      logActivity?.('ตัดสต็อกหลังร้าน/ผลิตสินค้า', `${outputText} (${refId})`);
      toast?.('บันทึกการผลิตและตัดสต็อกสำเร็จ', 'success');
      const body = document.getElementById('v9-admin-content') || document.getElementById('v9-manage-inner');
      if (body) await window.v9AdminProduce(body);
    } catch (error) {
      console.error('[v61] save production:', error);
      toast?.('บันทึกการผลิตไม่สำเร็จ: ' + (error.message || error), 'error');
    }
  };

  window.v9AdminProduce = async function (container) {
    if (!container) return;
    injectProductionStyle();
    container.innerHTML = '<div style="padding:28px;text-align:center;color:#64748b;font-weight:800">กำลังโหลดข้อมูลผลิต...</div>';
    try {
      const recipes = await loadRecipes();
      window.__v61Recipes = recipes;
      const products = productList();
      const recipeProds = recipeProducts(recipes, products);
      container.innerHTML = `
        <div class="v61-prod">
          <div class="v61-prod-hero">
            <div class="v61-prod-title">
              <i class="material-icons-round">factory</i>
              <div>
                <h3>ตัดวัตถุดิบ / ผลิตเข้า stock</h3>
                <p>เลือกสินค้าเก็บสต็อกที่ผลิตจริง แล้วกรอกวัตถุดิบที่ใช้จริง เช่น ปูนที่โม่ไปแล้ว หรือเหล็กที่ตัดไปแล้ว สูตรตามบิลยังแยกใช้งานตอนขายเหมือนเดิม</p>
              </div>
            </div>
            <div style="font-size:12px;color:#475569;font-weight:800;background:#fff;border:1px solid #dbeafe;border-radius:999px;padding:8px 12px">หน้าขาย: แสดงครั้งละ ${POS_BATCH_SIZE} รายการ</div>
          </div>
          <div class="v61-grid">
            <div class="v61-card">
              <div class="v61-card-h"><span>สินค้าเก็บสต็อกที่ผลิตวันนี้</span><button class="btn btn-outline btn-sm" onclick="document.querySelectorAll('[data-v61-output-check]').forEach(x=>x.checked=false);v61RecalcProductionPlan()">ล้าง</button></div>
              <div class="v61-card-b">
                <input id="v61-output-search" class="v61-input" type="search" placeholder="ค้นหาสินค้าในร้านที่จะผลิตเข้า stock" oninput="v61FilterOutputProducts()">
                ${recipeProds.length ? recipeProds.map(product => `
                  <div class="v61-output-row" data-v61-output="${html(product.id)}" data-v61-search="${html([product.name, product.barcode, product.category].filter(Boolean).join(' '))}">
                    <input type="checkbox" data-v61-output-check onchange="v61RecalcProductionPlan()">
                    <div>
                      <div class="v61-prod-name">${html(product.name || '')}</div>
                      <div class="v61-prod-meta">สต็อกปัจจุบัน ${fmt(product.stock)} ${html(product.unit || '')} · ต้นทุนสูตร ฿${fmt(product.cost)}</div>
                    </div>
                    <input class="v61-input" type="number" min="0" step="0.001" value="0" data-v61-output-qty oninput="this.closest('[data-v61-output]').querySelector('[data-v61-output-check]').checked=Number(this.value||0)>0;v61RecalcProductionPlan()">
                  </div>
                `).join('') : '<div class="v61-empty">ยังไม่มีสินค้าที่มีสูตรผลิต</div>'}
              </div>
            </div>
            <div class="v61-card">
              <div class="v61-card-h"><span>วัตถุดิบที่ใช้จริง</span><button class="btn btn-outline btn-sm" onclick="v61RecalcProductionPlan()">เติมจากสูตร</button></div>
              <div class="v61-card-b">
                <div class="v61-summary" id="v61-production-summary">เลือกสินค้าที่นำไปผลิตวันนี้ก่อน</div>
                <div id="v61-material-body"><div class="v61-empty">ยังไม่มีวัตถุดิบที่ต้องตัด</div></div>
                <div class="v61-actions">
                  <button class="btn btn-primary" onclick="v61SaveProduction()"><i class="material-icons-round">save</i> ตัดวัตถุดิบและเพิ่ม stock ที่ผลิต</button>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    } catch (error) {
      console.error('[v61] render production:', error);
      container.innerHTML = `<div style="padding:24px;color:#dc2626;font-weight:800">โหลดหน้าผลิตไม่สำเร็จ: ${html(error.message || error)}</div>`;
    }
  };

  function supabaseSavingsCardHtml() {
    return `
      <button type="button" class="v36-admin-menu-card v61-supabase-card" onclick="v36AdminOpenSection('supabase_savings')">
        <span class="v36-admin-menu-icon" style="background:#0f766e18;color:#0f766e"><i class="material-icons-round">database</i></span>
        <span class="v36-admin-menu-text">
          <span class="v36-admin-menu-title">ประหยัด Supabase</span>
          <span class="v36-admin-menu-desc">วิเคราะห์จุดที่กิน query และแนวทางลดการอ่าน/เขียนฐานข้อมูล</span>
        </span>
        <i class="material-icons-round v36-admin-menu-arrow">chevron_right</i>
      </button>`;
  }

  function injectAdminSavingsCard() {
    if (!isAdmin()) return;
    const page = document.getElementById('page-admin');
    if (!page || page.classList.contains('hidden') || page.querySelector('.v61-supabase-card')) return;
    const grid = page.querySelector('.v36-admin-menu-grid');
    if (grid) {
      grid.insertAdjacentHTML('beforeend', supabaseSavingsCardHtml());
      return;
    }
    const target = page.querySelector('.v36-admin-hero') || page.firstElementChild;
    if (target) target.insertAdjacentHTML('afterend', `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:16px 0">${supabaseSavingsCardHtml()}</div>`);
  }

  function renderSupabaseSavings(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="v61-prod">
        <div class="v61-prod-hero">
          <div class="v61-prod-title">
            <i class="material-icons-round" style="background:#0f766e">database</i>
            <div>
              <h3>วิธีประหยัด Supabase</h3>
              <p>วิเคราะห์จากโค้ดเดิม: จุดที่กินจริงคือการอ่านทั้งตาราง การดึงสูตรซ้ำตอนขาย และการ reload คลังหลังบันทึก</p>
            </div>
          </div>
          <div style="font-size:12px;color:#475569;font-weight:800;background:#fff;border:1px solid #ccfbf1;border-radius:999px;padding:8px 12px">หน้าขายแสดง ${POS_BATCH_SIZE} รายการ</div>
        </div>
        <div class="v61-grid">
          <div class="v61-card">
            <div class="v61-card-h"><span>สิ่งที่ระบบเดิมทำอยู่</span></div>
            <div class="v61-card-b">
              <div class="v61-material-row"><div><div class="v61-material-name">โหลดสินค้าทั้งหมด</div><div class="v61-material-meta">loadProducts() ใช้ สินค้า.select(*) ทุกครั้ง จึงกิน row/ข้อมูลตามจำนวนสินค้าจริง ไม่เกี่ยวกับโชว์ 60 โดยตรง</div></div><i class="material-icons-round">inventory_2</i><div></div></div>
              <div class="v61-material-row"><div><div class="v61-material-name">สูตรตามบิลดึงซ้ำตอนบันทึกขาย</div><div class="v61-material-meta">ถ้าในบิลมีสินค้าตามบิลหลายรายการ ระบบเดิม query สูตรสินค้า แยกตามสินค้าได้หลายรอบ</div></div><i class="material-icons-round">receipt_long</i><div></div></div>
              <div class="v61-material-row"><div><div class="v61-material-name">หลังบันทึกมัก reload คลัง</div><div class="v61-material-meta">การเรียก loadProducts() หลังขาย/ผลิตช่วยให้ข้อมูลสด แต่ถี่เกินไปจะอ่านทั้งตารางซ้ำ</div></div><i class="material-icons-round">sync</i><div></div></div>
            </div>
          </div>
          <div class="v61-card">
            <div class="v61-card-h"><span>แนวทางประหยัดที่ควรทำ</span></div>
            <div class="v61-card-b">
              <div class="v61-output-row"><i class="material-icons-round" style="color:#0f766e">filter_alt</i><div><div class="v61-prod-name">เลือก field เท่าที่ใช้</div><div class="v61-prod-meta">หน้าขายควรอ่านแค่ id/name/barcode/price/stock/unit/category/img_url/product_type/cost แทน select ทุก field</div></div><strong>สูง</strong></div>
              <div class="v61-output-row"><i class="material-icons-round" style="color:#2563eb">science</i><div><div class="v61-prod-name">cache สูตรสินค้าในรอบการขาย</div><div class="v61-prod-meta">ดึงสูตรของสินค้าตามบิลเป็นชุดเดียวด้วย in(product_id, ids) แล้วใช้ซ้ำทั้งบิล</div></div><strong>สูง</strong></div>
              <div class="v61-output-row"><i class="material-icons-round" style="color:#16a34a">bolt</i><div><div class="v61-prod-name">ทำแล้ว: cache สูตรสินค้าระยะสั้น</div><div class="v61-prod-meta">ระบบรวม query สูตรสินค้าที่ซ้ำ/ยิงพร้อมกันให้ใช้ผลลัพธ์เดียว และล้าง cache เมื่อมีการแก้สูตร</div></div><strong>ทำแล้ว</strong></div>
              <div class="v61-output-row"><i class="material-icons-round" style="color:#7c3aed">update</i><div><div class="v61-prod-name">หลังบันทึกอัปเดตเฉพาะสินค้าที่แตะ</div><div class="v61-prod-meta">ลดการ loadProducts() ทั้งหมด เหลือ update cache เฉพาะ id ที่ขาย/ผลิต หรือ reload แบบกดเอง</div></div><strong>กลาง</strong></div>
              <div class="v61-output-row"><i class="material-icons-round" style="color:#16a34a">check_circle</i><div><div class="v61-prod-name">ทำแล้วในหน้าตัดวัตถุดิบ</div><div class="v61-prod-meta">หลังบันทึกผลิต/ตัดวัตถุดิบ ระบบอัปเดต cache เฉพาะรายการที่เกี่ยวข้อง แทนการอ่านสินค้าทั้งคลังซ้ำ</div></div><strong>ทำแล้ว</strong></div>
              <div class="v61-output-row"><i class="material-icons-round" style="color:#0f766e">notifications_active</i><div><div class="v61-prod-name">ทำแล้ว: แจ้งเตือนหน้าแรกใช้ cache</div><div class="v61-prod-meta">ถ้าโหลดสินค้าไว้แล้ว ระบบนับใกล้หมด/หมดจากข้อมูลในเครื่อง ไม่ดึงสินค้าจาก Supabase ซ้ำ</div></div><strong>ทำแล้ว</strong></div>
              <div class="v61-output-row"><i class="material-icons-round" style="color:#ea580c">image</i><div><div class="v61-prod-name">รูปสินค้าใช้ lazy load ต่อไป</div><div class="v61-prod-meta">อันนี้ช่วย bandwidth/ความลื่นของเครื่อง แต่ไม่ลด database query โดยตรง</div></div><strong>กลาง</strong></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function openSupabaseSavingsPage() {
    const page = document.getElementById('page-admin');
    if (!page) return false;
    page.innerHTML = `
      <div class="v36-admin">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px">
          <button class="btn btn-outline" onclick="renderAdmin?.()"><i class="material-icons-round">arrow_back</i> กลับผู้ดูแลระบบ</button>
        </div>
        <div id="v61-supabase-body"></div>
      </div>`;
    renderSupabaseSavings(document.getElementById('v61-supabase-body'));
    return true;
  }

  function installAdminSavingsSection() {
    if (window.v36AdminOpenSection && !window.v36AdminOpenSection.__v61Savings) {
      const original = window.v36AdminOpenSection;
      const wrapped = async function (section) {
        if (section === 'supabase_savings') {
          return openSupabaseSavingsPage();
        }
        return original.apply(this, arguments);
      };
      Object.defineProperty(wrapped, '__v61Savings', { value: true });
      setGlobal('v36AdminOpenSection', wrapped);
    }

    if (typeof window.renderAdmin === 'function' && !window.renderAdmin.__v61Savings) {
      const originalRender = window.renderAdmin;
      const wrappedRender = async function () {
        const result = await originalRender.apply(this, arguments);
        injectAdminSavingsCard();
        renameProductionEntrypoints();
        return result;
      };
      Object.defineProperty(wrappedRender, '__v61Savings', { value: true });
      setGlobal('renderAdmin', wrappedRender);
    }
  }

  function renameProductionEntrypoints() {
    document.querySelectorAll('button, a, .v36-admin-menu-title, .v9-admin-tab').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text === 'ผลิตสินค้า') el.textContent = 'ตัดวัตถุดิบ';
    });
  }

  function boot() {
    installPosBatchGrid();
    injectProductionStyle();
    installAdminSavingsSection();
    injectAdminSavingsCard();
    renameProductionEntrypoints();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  [400, 1200, 2500, 5000].forEach(delay => setTimeout(boot, delay));
  if (!window.__v61ProductionRenameObserver) {
    window.__v61ProductionRenameObserver = new MutationObserver(() => renameProductionEntrypoints());
    window.__v61ProductionRenameObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
