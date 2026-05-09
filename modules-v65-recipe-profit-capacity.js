(function () {
  'use strict';

  console.log('[v65] recipe profit and capacity tools loaded');

  const RECIPE_TABLE = '\u0e2a\u0e39\u0e15\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
  const PRODUCT_TABLE = '\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
  const js = value => JSON.stringify(String(value ?? ''));
  const num = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => {
    const n = num(value);
    return Number.isInteger(n) ? n.toLocaleString('th-TH') : Number(n.toFixed(4)).toLocaleString('th-TH');
  };
  const baht = value => `฿${num(value).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

  function productsList() {
    try {
      if (typeof v9GetProducts === 'function') return v9GetProducts();
    } catch (_) {}
    try {
      if (Array.isArray(products)) return products;
    } catch (_) {}
    return Array.isArray(window.products) ? window.products : [];
  }

  function productMap(products) {
    const map = {};
    (products || []).forEach(product => { map[product.id] = product; });
    return map;
  }

  function isRaw(product) {
    const type = String(product?.product_type || '').toLowerCase();
    return product?.is_raw === true || type.includes('raw') || type.includes('both') || type.includes('วัตถุดิบ') || type.includes('ทั้ง');
  }

  function isSellProduct(product) {
    return product && !isRaw(product);
  }

  function recipeRowsFor(recipes, productId) {
    return (recipes || []).filter(row => String(row.product_id) === String(productId));
  }

  function recipeStats(product, rows, map) {
    let cost = 0;
    let capacity = Infinity;
    const lines = rows.map(row => {
      const mat = map[row.material_id] || {};
      const qty = num(row.quantity);
      const stock = num(mat.stock);
      const unitCost = num(mat.cost);
      const lineCost = qty * unitCost;
      const canMake = qty > 0 ? stock / qty : Infinity;
      cost += lineCost;
      capacity = Math.min(capacity, canMake);
      return { row, mat, qty, stock, unitCost, lineCost, canMake };
    });
    if (!Number.isFinite(capacity)) capacity = 0;
    const price = num(product?.price);
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    return { lines, cost, capacity: Math.max(0, capacity), price, profit, margin };
  }

  function installStyles() {
    if (document.getElementById('v65-recipe-style')) return;
    const style = document.createElement('style');
    style.id = 'v65-recipe-style';
    style.textContent = `
      .v65-recipe-page{display:grid;gap:18px}
      .v65-recipe-hero{border-radius:24px;background:#0f172a;color:#fff;padding:24px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;box-shadow:0 18px 38px rgba(15,23,42,.14)}
      .v65-recipe-hero h2{margin:0;font-size:30px;font-weight:950;letter-spacing:0}
      .v65-recipe-hero p{margin:8px 0 0;color:#cbd5e1;font-weight:700}
      .v65-hero-stats{display:grid;grid-template-columns:repeat(3, minmax(110px, 1fr));gap:10px}
      .v65-hero-stat{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);border-radius:16px;padding:14px}
      .v65-hero-stat span{display:block;color:#cbd5e1;font-size:12px;font-weight:800}
      .v65-hero-stat b{display:block;margin-top:4px;font-size:24px;font-weight:950}
      .v65-recipe-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
      .v65-btn{height:44px;border-radius:14px;border:1px solid #cbd5e1;background:#fff;color:#334155;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:900;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif}
      .v65-btn.primary{background:#ef4444;color:#fff;border-color:#ef4444;box-shadow:0 12px 24px rgba(239,68,68,.18)}
      .v65-btn.danger{background:#fff;color:#dc2626;border-color:#fecaca}
      .v65-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px}
      .v65-card{background:#fff;border:1px solid #e2e8f0;border-radius:22px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,.05)}
      .v65-card-head{padding:18px;border:0;border-bottom:1px solid #eef2f7;background:#fff;display:grid;grid-template-columns:1fr auto;gap:12px;width:100%;text-align:left;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif}
      .v65-card-head:hover{background:#f8fafc}
      .v65-card-hint{margin-top:6px;color:#94a3b8;font-size:12px;font-weight:850}
      .v65-expand-icon{width:42px;height:42px;border-radius:14px;background:#f1f5f9;color:#64748b;display:grid;place-items:center;transition:.18s}
      .v65-card.is-open .v65-expand-icon{transform:rotate(180deg);background:#ecfdf5;color:#047857}
      .v65-card:not(.is-open) .v65-card-body,.v65-card:not(.is-open) .v65-card-foot,.v65-card:not(.is-open) .v65-prod-meta,.v65-card:not(.is-open) .v65-capacity{display:none}
      .v65-detail-top{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start}
      .v65-prod-title{font-size:20px;font-weight:950;color:#0f172a;line-height:1.25}
      .v65-prod-meta{margin-top:7px;display:flex;gap:7px;flex-wrap:wrap}
      .v65-chip{display:inline-flex;align-items:center;gap:5px;border-radius:999px;background:#f1f5f9;border:1px solid #e2e8f0;color:#64748b;padding:5px 9px;font-size:12px;font-weight:850}
      .v65-capacity{min-width:132px;text-align:right;border-radius:18px;border:1px solid #bbf7d0;background:#ecfdf5;padding:12px}
      .v65-capacity span{display:block;color:#64748b;font-size:11px;font-weight:850}
      .v65-capacity b{display:block;color:#047857;font-size:26px;font-weight:950;line-height:1.05}
      .v65-card-body{padding:16px;display:grid;gap:13px}
      .v65-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .v65-box{border:1px solid #e2e8f0;background:#f8fafc;border-radius:16px;padding:12px}
      .v65-box span{display:block;color:#64748b;font-size:12px;font-weight:850}
      .v65-box b{display:block;color:#0f172a;font-size:19px;font-weight:950;margin-top:3px}
      .v65-box.good b{color:#059669}.v65-box.bad b{color:#dc2626}
      .v65-lines{display:grid;gap:8px}
      .v65-line{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:1px solid #eef2f7;border-radius:16px;padding:11px;background:#fff}
      .v65-line-name{font-weight:950;color:#111827}
      .v65-line-sub{margin-top:4px;color:#64748b;font-size:12px;font-weight:750}
      .v65-line-cost{text-align:right;font-weight:950;color:#0f172a}
      .v65-line-cost small{display:block;color:#64748b;font-weight:800;margin-top:3px}
      .v65-card-foot{padding:14px 16px;border-top:1px solid #eef2f7;background:#fbfdff;display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap}
      .v65-empty{border:1px dashed #cbd5e1;border-radius:22px;background:#f8fafc;text-align:center;padding:54px 20px;color:#64748b;font-weight:850}
      .v65-modal{display:grid;gap:14px;text-align:left}
      .v65-swal-popup{border-radius:28px!important;overflow:hidden!important}
      .v65-swal-popup .swal2-title{display:none!important}
      .v65-swal-popup .swal2-html-container{margin:0!important}
      .v65-modal{display:grid;gap:16px;text-align:left}
      .v65-form-banner{margin:-18px -18px 0;border-radius:28px 28px 0 0;overflow:hidden;background:radial-gradient(circle at 12% 20%,rgba(16,185,129,.36),transparent 30%),linear-gradient(115deg,#0f172a 0%,#0f766e 48%,#ef4444 100%);color:#fff;padding:22px 24px;display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center}
      .v65-form-icon{width:64px;height:64px;border-radius:20px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
      .v65-form-icon i{font-size:34px}
      .v65-form-kicker{font-size:12px;font-weight:950;letter-spacing:1.4px;color:#bbf7d0;text-transform:uppercase}
      .v65-form-title{margin-top:4px;font-size:28px;line-height:1.08;font-weight:950}
      .v65-form-desc{margin-top:6px;font-size:13px;font-weight:800;color:#e2e8f0}
      .v65-form-pill{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.12);border-radius:999px;padding:10px 14px;font-size:13px;font-weight:950;white-space:nowrap}
      .v65-workspace{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(320px,.75fr);gap:14px}
      .v65-panel{border:1px solid #e2e8f0;border-radius:22px;background:#fff;padding:16px;box-shadow:0 12px 30px rgba(15,23,42,.045)}
      .v65-panel-title{display:flex;align-items:center;gap:9px;margin-bottom:12px;color:#0f172a;font-size:17px;font-weight:950}
      .v65-panel-title i{color:#ef4444}
      .v65-side-note{border:1px solid #bbf7d0;background:#ecfdf5;border-radius:18px;padding:14px;color:#047857;font-size:13px;font-weight:850;line-height:1.55}
      .v65-modal-hero{border:1px solid #e2e8f0;border-radius:20px;background:#f8fafc;padding:16px;display:grid;grid-template-columns:1.35fr .85fr .6fr .9fr;gap:12px}
      .v65-image-drop{border:1px dashed #cbd5e1;border-radius:20px;background:#f8fafc;padding:14px;display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center;cursor:pointer}
      .v65-image-preview{width:96px;height:96px;border-radius:16px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#94a3b8}
      .v65-field label{display:block;margin-bottom:6px;font-size:12px;color:#64748b;font-weight:900}
      .v65-input,.v65-select{width:100%;height:44px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;padding:0 12px;font:800 14px var(--font-thai,'Prompt'),sans-serif;color:#0f172a;outline:none}
      .v65-input[readonly]{background:#f8fafc;color:#64748b}
      .v65-smart-cell{position:relative}
      .v65-material-search{border-color:#a7f3d0!important;background:linear-gradient(180deg,#fff,#f0fdf4)!important}
      .v65-material-suggestions{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:40;background:#fff;border:1px solid #bbf7d0;border-radius:16px;box-shadow:0 18px 40px rgba(15,23,42,.16);padding:8px;display:none;max-height:260px;overflow:auto}
      .v65-material-suggestions.open{display:grid;gap:6px}
      .v65-material-option{border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:9px 10px;display:grid;grid-template-columns:1fr auto;gap:8px;cursor:pointer}
      .v65-material-option:hover{border-color:#10b981;background:#ecfdf5}
      .v65-material-name{font-weight:950;color:#0f172a}
      .v65-material-meta{margin-top:3px;color:#64748b;font-size:11px;font-weight:800}
      .v65-material-stock{text-align:right;color:#047857;font-weight:950}
      .v65-material-empty{padding:12px;border-radius:12px;background:#f8fafc;color:#94a3b8;font-weight:850;text-align:center}
      .v65-edit-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
      .v65-edit-row{display:grid;grid-template-columns:1fr 110px 120px 42px;gap:8px;align-items:end;border:1px solid #dbeafe;background:linear-gradient(135deg,#ffffff,#f8fbff);border-radius:18px;padding:12px}
      .v65-icon-btn{width:42px;height:42px;border-radius:12px;border:1px solid #fecaca;background:#fff;color:#dc2626;display:flex;align-items:center;justify-content:center;cursor:pointer}
      @media(max-width:760px){.v65-recipe-hero,.v65-form-banner,.v65-workspace{grid-template-columns:1fr}.v65-form-pill{justify-self:start}.v65-hero-stats,.v65-summary,.v65-edit-summary{grid-template-columns:1fr}.v65-grid{grid-template-columns:1fr}.v65-modal-hero,.v65-edit-row,.v65-image-drop{grid-template-columns:1fr}.v65-capacity{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  async function loadRecipeData() {
    const products = productsList();
    const { data, error } = await db.from(RECIPE_TABLE).select('id,product_id,material_id,quantity,unit');
    if (error) throw new Error(error.message);
    return { products, recipes: data || [], map: productMap(products) };
  }

  function recipeProductIds(recipes) {
    return [...new Set((recipes || []).map(row => row.product_id).filter(Boolean))];
  }

  window.v9AdminRecipe = async function (container) {
    if (!container) return;
    installStyles();
    container.innerHTML = typeof v9AdminLoading === 'function' ? v9AdminLoading('โหลดสูตรสินค้า...') : 'Loading...';

    let products = [], recipes = [], map = {};
    try {
      ({ products, recipes, map } = await loadRecipeData());
    } catch (error) {
      container.innerHTML = typeof v9AdminError === 'function' ? v9AdminError('โหลดสูตรไม่ได้: ' + error.message) : esc(error.message);
      return;
    }

    const ids = recipeProductIds(recipes);
    const totalCost = ids.reduce((sum, id) => {
      const product = map[id];
      if (!product) return sum;
      return sum + recipeStats(product, recipeRowsFor(recipes, id), map).cost;
    }, 0);

    container.innerHTML = `
      <div class="v65-recipe-page">
        <section class="v65-recipe-hero">
          <div>
            <h2>สูตรสินค้า</h2>
            <p>ดูต้นทุน กำไร และกำลังผลิตจากสต็อกวัตถุดิบจริงก่อนขายหรือผลิตตามบิล</p>
          </div>
          <div>
            <div class="v65-hero-stats">
              <div class="v65-hero-stat"><span>สูตรทั้งหมด</span><b>${ids.length}</b></div>
              <div class="v65-hero-stat"><span>วัตถุดิบ</span><b>${products.filter(isRaw).length}</b></div>
              <div class="v65-hero-stat"><span>ต้นทุนรวม/ชุด</span><b>${baht(totalCost)}</b></div>
            </div>
            <div class="v65-recipe-actions" style="margin-top:12px">
              <button class="v65-btn primary" onclick="v9RecipeShowCreate?.()"><i class="material-icons-round">add</i> สร้างสูตรใหม่</button>
            </div>
          </div>
        </section>

        ${ids.length ? `<section class="v65-grid">
          ${ids.map(id => recipeCardHtml(map[id], recipeRowsFor(recipes, id), map)).join('')}
        </section>` : `
          <div class="v65-empty">
            <i class="material-icons-round" style="font-size:44px;display:block;margin-bottom:10px;color:#94a3b8">science</i>
            ยังไม่มีสูตรสินค้า
          </div>`}
      </div>
    `;
  };

  function recipeCardHtml(product, rows, map) {
    if (!product) return '';
    const stats = recipeStats(product, rows, map);
    const profitClass = stats.profit >= 0 ? 'good' : 'bad';
    return `
      <article class="v65-card">
        <header class="v65-card-head" data-v65-toggle-recipe="${esc(product.id)}">
          <div>
            <div class="v65-prod-title">${esc(product.name)}</div>
            <div class="v65-card-hint">กดเพื่อดูรายละเอียดสูตร ต้นทุน และวัตถุดิบ</div>
            <div class="v65-prod-meta">
              <span class="v65-chip"><i class="material-icons-round" style="font-size:15px">category</i>${esc(product.category || '-')}</span>
              <span class="v65-chip">หน่วยขาย ${esc(product.unit || 'ชิ้น')}</span>
              <span class="v65-chip">${esc(product.product_type || 'สินค้าขาย')}</span>
            </div>
          </div>
          <div class="v65-capacity">
            <span>ผลิตได้จากสต็อก</span>
            <b>${fmt(Math.floor(stats.capacity * 10000) / 10000)}</b>
            <span>${esc(product.unit || 'หน่วย')}</span>
          </div>
        </header>
        <div class="v65-card-body">
          <div class="v65-summary">
            <div class="v65-box"><span>ราคาขาย</span><b>${baht(stats.price)}</b></div>
            <div class="v65-box"><span>ต้นทุนสูตร</span><b>${baht(stats.cost)}</b></div>
            <div class="v65-box ${profitClass}"><span>กำไร/ชิ้น</span><b>${baht(stats.profit)} (${fmt(stats.margin)}%)</b></div>
          </div>
          <div class="v65-lines">
            ${stats.lines.map(line => materialLineHtml(line, product)).join('')}
          </div>
        </div>
        <footer class="v65-card-foot">
          <button type="button" class="v65-btn" data-v65-edit-recipe="${esc(product.id)}"><i class="material-icons-round">edit</i> แก้ไขสูตร</button>
          <button type="button" class="v65-btn danger" data-v65-delete-recipe="${esc(product.id)}" data-v65-product-name="${esc(product.name)}"><i class="material-icons-round">delete</i> ลบสูตร</button>
        </footer>
      </article>
    `;
  }

  function materialLineHtml(line, product) {
    const low = line.canMake <= 0;
    return `
      <div class="v65-line">
        <div>
          <div class="v65-line-name">${esc(line.mat?.name || line.row.material_id)}</div>
          <div class="v65-line-sub">
            ใช้ ${fmt(line.qty)} ${esc(line.row.unit || line.mat?.unit || '')} / ${esc(product.unit || 'หน่วย')}
            · คงเหลือ ${fmt(line.stock)} ${esc(line.mat?.unit || line.row.unit || '')}
            · ผลิตได้ ${low ? '0' : fmt(line.canMake)} ${esc(product.unit || '')}
          </div>
        </div>
        <div class="v65-line-cost">
          ${baht(line.lineCost)}
          <small>${baht(line.unitCost)} / ${esc(line.mat?.unit || line.row.unit || '')}</small>
        </div>
      </div>
    `;
  }

  function productOptions(products, selectedId, rawOnly) {
    return (products || [])
      .filter(product => rawOnly ? isRaw(product) : isSellProduct(product))
      .map(product => `<option value="${esc(product.id)}" ${String(product.id) === String(selectedId) ? 'selected' : ''}>
        ${esc(product.name)} | ${esc(product.barcode || '-')} (${esc(product.unit || '-')})
      </option>`)
      .join('');
  }

  function materialLabel(product) {
    if (!product) return '';
    return [product.name, product.barcode, product.category, product.unit].filter(Boolean).join(' | ');
  }

  function materialSearchHay(product) {
    return [product.name, product.barcode, product.category, product.unit, product.product_type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function searchMaterials(query, products, selectedIds = []) {
    const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    return (products || [])
      .filter(isRaw)
      .filter(product => !selectedIds.includes(String(product.id)))
      .filter(product => {
        if (!terms.length) return true;
        const hay = materialSearchHay(product);
        return terms.every(term => hay.includes(term));
      })
      .slice(0, 9);
  }

  function categoryOptions(products, selected) {
    const fromProducts = (products || []).map(product => product.category).filter(Boolean);
    let categoryList = [];
    try { if (Array.isArray(categories)) categoryList = categories; } catch (_) {}
    if (!categoryList.length && Array.isArray(window.categories)) categoryList = window.categories;
    const fromGlobal = categoryList.map(cat => cat?.name || cat).filter(Boolean);
    const cats = [...new Set([...fromGlobal, ...fromProducts, 'คอนกรีตผสมเสร็จ', 'โครงสร้าง', 'ประปา', 'ไฟฟ้า', 'เหล็ก', 'อื่น'])];
    return cats.map(cat => `<option value="${esc(cat)}" ${String(cat) === String(selected || '') ? 'selected' : ''}>${esc(cat)}</option>`).join('');
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    if (parts.length < 2) throw new Error('รูปภาพไม่ถูกต้อง');
    const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/webp';
    const bin = atob(parts[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('อ่านรูปภาพไม่สำเร็จ'));
      reader.readAsDataURL(blob);
    });
  }

  function readImage(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('โหลดรูปภาพไม่สำเร็จ'));
      img.src = URL.createObjectURL(blob);
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
  }

  async function compressRecipeImage(blob) {
    if (!blob || !String(blob.type || '').startsWith('image/')) throw new Error('ไฟล์นี้ไม่ใช่รูปภาพ');
    const img = await readImage(blob);
    let maxSide = Math.min(900, Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height) || 900);
    let best = null;
    for (let round = 0; round < 5; round++) {
      const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const w = Math.max(1, Math.round((img.naturalWidth || img.width) * ratio));
      const h = Math.max(1, Math.round((img.naturalHeight || img.height) * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      for (const quality of [0.62, 0.5, 0.4, 0.32, 0.24]) {
        const out = await canvasToBlob(canvas, 'image/webp', quality);
        if (out && (!best || out.size < best.size)) best = out;
        if (best && best.size <= 80 * 1024) return { blob: best, dataUrl: await blobToDataUrl(best) };
      }
      maxSide = Math.round(maxSide * 0.78);
    }
    if (!best) throw new Error('บีบอัดรูปภาพไม่สำเร็จ');
    return { blob: best, dataUrl: await blobToDataUrl(best) };
  }

  async function uploadRecipeImageIfNeeded(value, productName) {
    const raw = String(value || '').trim();
    if (!raw || !raw.startsWith('data:image/')) return raw;
    if (!db?.storage) return raw;
    const blob = dataUrlToBlob(raw);
    const safeName = String(productName || 'recipe-product').replace(/[^\w.-]+/g, '-').slice(0, 42) || 'recipe-product';
    const fileName = `products/recipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.webp`;
    const { error } = await db.storage.from('product-images').upload(fileName, blob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return db.storage.from('product-images').getPublicUrl(fileName).data.publicUrl;
  }

  function installRecipeImagePaste(product) {
    const box = document.getElementById('v65-recipe-image-drop');
    const input = document.getElementById('v65-prod-img');
    const file = document.getElementById('v65-prod-img-file');
    const preview = document.getElementById('v65-recipe-image-preview');
    const meta = document.getElementById('v65-recipe-image-meta');
    if (!box || !input || box.__v65PasteReady) return;
    box.__v65PasteReady = true;

    const setPreview = (src, text) => {
      input.value = src || '';
      preview.innerHTML = src ? `<img src="${esc(src)}" alt="" style="width:100%;height:100%;object-fit:cover">` : '<i class="material-icons-round">image</i>';
      if (meta) meta.textContent = text || (src ? 'พร้อมบันทึกรูปภาพ' : 'วางรูปภาพหรือเลือกไฟล์ได้เลย');
    };
    setPreview(product?.img_url || '', product?.img_url ? 'ใช้รูปเดิมอยู่' : 'วางรูปจากเว็บด้วย Ctrl+V หรือเลือกไฟล์ ระบบจะบีบอัดให้อัตโนมัติ');

    const handleBlob = async blob => {
      if (meta) meta.textContent = 'กำลังบีบอัดรูปภาพ...';
      const out = await compressRecipeImage(blob);
      setPreview(out.dataUrl, `บีบอัดแล้ว ${(out.blob.size / 1024).toFixed(1)} KB`);
    };
    file?.addEventListener('change', () => file.files?.[0] && handleBlob(file.files[0]).catch(e => {
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }));
    box.addEventListener('click', event => {
      if (event.target.closest('[data-v65-clear-img]')) return setPreview('', 'ล้างรูปแล้ว');
      file?.click();
    });
    box.addEventListener('paste', event => {
      const item = Array.from(event.clipboardData?.items || []).find(x => String(x.type || '').startsWith('image/'));
      if (!item) return;
      event.preventDefault();
      handleBlob(item.getAsFile()).catch(e => {
        if (typeof toast === 'function') toast(e.message || String(e), 'error');
      });
    });
    document.addEventListener('paste', function docPaste(event) {
      if (!Swal.isVisible() || !document.getElementById('v65-prod-img')) {
        document.removeEventListener('paste', docPaste, true);
        return;
      }
      const item = Array.from(event.clipboardData?.items || []).find(x => String(x.type || '').startsWith('image/'));
      if (!item) return;
      event.preventDefault();
      handleBlob(item.getAsFile()).catch(e => {
        if (typeof toast === 'function') toast(e.message || String(e), 'error');
      });
    }, true);
  }

  window.v9RecipeEditProduct = window.v9RecipeEditFull = async function (productId) {
    installStyles();
    let products = [], recipes = [], map = {};
    try {
      ({ products, recipes, map } = await loadRecipeData());
    } catch (error) {
      typeof toast === 'function' && toast('โหลดสูตรไม่ได้: ' + error.message, 'error');
      return;
    }

    const isCreate = !productId || !map[productId];
    const product = isCreate
      ? { id: '', name: '', price: 0, unit: '', category: '\u0e04\u0e2d\u0e19\u0e01\u0e23\u0e35\u0e15\u0e1c\u0e2a\u0e21\u0e40\u0e2a\u0e23\u0e47\u0e08', img_url: '', product_type: '\u0e15\u0e32\u0e21\u0e1a\u0e34\u0e25' }
      : map[productId];
    const rows = isCreate ? [] : recipeRowsFor(recipes, productId);

    const rowHtml = (row = {}) => {
      const mat = map[row.material_id] || {};
      return `
        <div class="v65-edit-row" data-v65-edit-row="1">
          <div class="v65-field v65-smart-cell">
            <label>วัตถุดิบ</label>
            <input type="hidden" data-v65-material value="${esc(row.material_id || '')}">
            <input class="v65-input v65-material-search" data-v65-material-search value="${esc(materialLabel(mat))}" placeholder="ค้นชื่อ / บาร์โค้ด / หมวดหมู่วัตถุดิบ">
            <div class="v65-material-suggestions" data-v65-material-suggestions></div>
          </div>
          <div class="v65-field">
            <label>จำนวนที่ใช้</label>
            <input class="v65-input" data-v65-qty type="number" min="0" step="any" value="${esc(row.quantity || 1)}" oninput="v65RecipeRecalcModal()">
          </div>
          <div class="v65-field">
            <label>หน่วยฐาน</label>
            <input class="v65-input" data-v65-unit value="${esc(mat.unit || row.unit || '')}" readonly>
          </div>
          <button type="button" class="v65-icon-btn" onclick="this.closest('[data-v65-edit-row]').remove();v65RecipeRecalcModal()">
            <i class="material-icons-round">close</i>
          </button>
        </div>
      `;
    };

    const result = await Swal.fire({
      title: '',
      width: '1120px',
      showCancelButton: true,
      showDenyButton: !isCreate,
      confirmButtonText: 'บันทึกสูตร',
      cancelButtonText: 'ยกเลิก',
      denyButtonText: 'ลบสูตรนี้',
      confirmButtonColor: '#ef4444',
      denyButtonColor: '#dc2626',
      customClass: { popup: 'v65-swal-popup' },
      html: `
        <div class="v65-modal">
          <section class="v65-form-banner">
            <div class="v65-form-icon"><i class="material-icons-round">science</i></div>
            <div>
              <div class="v65-form-kicker">BOM RECIPE</div>
              <div class="v65-form-title">${isCreate ? 'สร้างสูตรสินค้าใหม่' : 'แก้ไขสูตรสินค้า'}</div>
              <div class="v65-form-desc">กำหนดสินค้าที่ขาย ราคา หน่วย หมวด รูปภาพ และวัตถุดิบที่ต้องตัดสต็อกต่อ 1 หน่วยขาย</div>
            </div>
            <div class="v65-form-pill">ผลิตตามบิล • ไม่แก้สต็อกจากคลัง</div>
          </section>
          <section class="v65-panel">
            <div class="v65-panel-title"><i class="material-icons-round">inventory_2</i> ข้อมูลสินค้าและสูตรผลิต</div>
          <section class="v65-modal-hero">
            <div class="v65-field">
              <label>ชื่อสินค้า</label>
              <input class="v65-input" id="v65-prod-name" value="${esc(product.name)}">
            </div>
            <div class="v65-field">
              <label>ราคาขาย</label>
              <input class="v65-input" id="v65-prod-price" type="number" min="0" step="any" value="${esc(product.price || 0)}" oninput="v65RecipeRecalcModal()">
            </div>
            <div class="v65-field">
              <label>หน่วยขาย</label>
              <input class="v65-input" id="v65-prod-unit" value="${esc(product.unit || '')}">
            </div>
            <div class="v65-field">
              <label>หมวดหมู่หน้าขาย</label>
              <select class="v65-select" id="v65-prod-category">
                ${categoryOptions(products, product.category)}
              </select>
            </div>
          </section>
          <section class="v65-field">
            <label>รูปภาพสินค้า</label>
            <input type="hidden" id="v65-prod-img" value="${esc(product.img_url || '')}">
            <input type="file" id="v65-prod-img-file" accept="image/*" style="display:none">
            <div id="v65-recipe-image-drop" class="v65-image-drop" tabindex="0">
              <div id="v65-recipe-image-preview" class="v65-image-preview"></div>
              <div>
                <div style="font-weight:950;color:#0f172a">วางรูปได้เลยด้วย Ctrl+V</div>
                <div id="v65-recipe-image-meta" style="margin-top:4px;color:#64748b;font-size:12px;font-weight:750;line-height:1.5"></div>
                <button type="button" class="v65-btn" data-v65-clear-img style="margin-top:8px"><i class="material-icons-round">delete</i> ล้างรูป</button>
              </div>
            </div>
          </section>
          <section class="v65-edit-summary" id="v65-edit-summary"></section>
          <div class="v65-side-note">
            ระบบจะใช้สินค้านี้เฉพาะหน้าขายและคำนวณจากสูตร วัตถุดิบจะถูกตัดตามจำนวนที่ขายจริง จึงไม่ควรแก้สต็อกสินค้าสูตรจากหน้าคลังสินค้าโดยตรง
          </div>
          <section>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div style="font-size:16px;font-weight:950;color:#0f172a">วัตถุดิบในสูตร</div>
              <button type="button" class="v65-btn" onclick="v65AddRecipeEditRow()"><i class="material-icons-round">add</i> เพิ่มวัตถุดิบ</button>
            </div>
            <div id="v65-edit-rows" style="display:grid;gap:8px">${rows.length ? rows.map(rowHtml).join('') : rowHtml()}</div>
          </section>
          </section>
        </div>
      `,
      didOpen: () => {
        window._v65RecipeEditContext = { products, map, productId, isCreate, rowHtml };
        installRecipeImagePaste(product);
        window.v65WireMaterialSearch();
        window.v65RecipeRecalcModal();
      },
      preConfirm: () => collectRecipeEditValues(isCreate ? null : productId),
    });

    if (!isCreate && result.isDenied) {
      await window.v65DeleteRecipe(productId, product.name);
      return;
    }
    if (!result.isConfirmed || !result.value) return;
    await saveRecipeEdit(result.value);
  };

  window.v65AddRecipeEditRow = function () {
    const ctx = window._v65RecipeEditContext;
    const box = document.getElementById('v65-edit-rows');
    if (!ctx || !box) return;
    box.insertAdjacentHTML('beforeend', ctx.rowHtml({ quantity: 1 }));
    window.v65WireMaterialSearch();
    window.v65RecipeRecalcModal();
  };

  window.v65WireMaterialSearch = function () {
    const ctx = window._v65RecipeEditContext;
    if (!ctx) return;
    document.querySelectorAll('[data-v65-edit-row]').forEach(row => {
      const search = row.querySelector('[data-v65-material-search]');
      const hidden = row.querySelector('[data-v65-material]');
      const unit = row.querySelector('[data-v65-unit]');
      const box = row.querySelector('[data-v65-material-suggestions]');
      if (!search || !hidden || !box || search.__v65SmartReady) return;
      search.__v65SmartReady = true;

      const choose = product => {
        hidden.value = product?.id || '';
        search.value = materialLabel(product);
        if (unit) unit.value = product?.unit || '';
        box.classList.remove('open');
        box.innerHTML = '';
        window.v65RecipeRecalcModal();
      };

      const render = () => {
        const selectedIds = Array.from(document.querySelectorAll('[data-v65-material]'))
          .map(input => String(input.value || ''))
          .filter(id => id && id !== String(hidden.value || ''));
        const items = searchMaterials(search.value, ctx.products, selectedIds);
        box.innerHTML = items.length ? items.map(product => `
          <button type="button" class="v65-material-option" data-v65-pick-material="${esc(product.id)}">
            <span>
              <span class="v65-material-name">${esc(product.name || '')}</span>
              <span class="v65-material-meta">${esc(product.barcode || '-')} • ${esc(product.category || '-')} • หน่วย ${esc(product.unit || '-')}</span>
            </span>
            <span class="v65-material-stock">${fmt(product.stock)}<br><small>${esc(product.unit || '')}</small></span>
          </button>
        `).join('') : '<div class="v65-material-empty">ไม่พบวัตถุดิบที่ค้นหา</div>';
        box.classList.add('open');
      };

      search.addEventListener('focus', render);
      search.addEventListener('input', () => {
        hidden.value = '';
        if (unit) unit.value = '';
        render();
        window.v65RecipeRecalcModal();
      });
      box.addEventListener('click', event => {
        const pick = event.target.closest('[data-v65-pick-material]');
        if (!pick) return;
        const product = ctx.products.find(item => String(item.id) === String(pick.dataset.v65PickMaterial));
        choose(product);
      });
    });
  };

  document.addEventListener('click', event => {
    if (event.target.closest('.v65-smart-cell')) return;
    document.querySelectorAll('[data-v65-material-suggestions]').forEach(box => box.classList.remove('open'));
  }, true);

  function collectRecipeEditValues(productId) {
    const name = document.getElementById('v65-prod-name')?.value?.trim();
    const price = num(document.getElementById('v65-prod-price')?.value);
    const unit = document.getElementById('v65-prod-unit')?.value?.trim() || '\u0e0a\u0e34\u0e49\u0e19';
    const category = document.getElementById('v65-prod-category')?.value?.trim() || '';
    const imgUrl = document.getElementById('v65-prod-img')?.value?.trim() || '';
    const rows = Array.from(document.querySelectorAll('[data-v65-edit-row]')).map(row => ({
      material_id: row.querySelector('[data-v65-material]')?.value,
      quantity: num(row.querySelector('[data-v65-qty]')?.value),
      unit: (() => {
        const mat = window._v65RecipeEditContext?.map?.[row.querySelector('[data-v65-material]')?.value] || {};
        return mat.unit || row.querySelector('[data-v65-unit]')?.value?.trim() || '';
      })(),
    })).filter(row => row.material_id && row.quantity > 0);

    if (!name) {
      Swal.showValidationMessage('กรุณากรอกชื่อสินค้า');
      return false;
    }
    if (!rows.length) {
      Swal.showValidationMessage('กรุณาเพิ่มวัตถุดิบอย่างน้อย 1 รายการ');
      return false;
    }
    return { productId, name, price, unit, category, imgUrl, rows };
  }

  window.v65RecipeRecalcModal = function () {
    const ctx = window._v65RecipeEditContext;
    const summary = document.getElementById('v65-edit-summary');
    if (!ctx || !summary) return;
    const rows = Array.from(document.querySelectorAll('[data-v65-edit-row]')).map(row => {
      const mat = ctx.map[row.querySelector('[data-v65-material]')?.value] || {};
      const qty = num(row.querySelector('[data-v65-qty]')?.value);
      const canMake = qty > 0 ? num(mat.stock) / qty : 0;
      return { mat, qty, cost: qty * num(mat.cost), canMake };
    });
    const cost = rows.reduce((sum, row) => sum + row.cost, 0);
    const capacity = rows.length ? Math.min(...rows.map(row => row.canMake)) : 0;
    const price = num(document.getElementById('v65-prod-price')?.value);
    const profit = price - cost;
    const margin = price > 0 ? profit / price * 100 : 0;
    const unit = document.getElementById('v65-prod-unit')?.value || '';
    summary.innerHTML = `
      <div class="v65-box"><span>ต้นทุนสูตร</span><b>${baht(cost)}</b></div>
      <div class="v65-box ${profit >= 0 ? 'good' : 'bad'}"><span>กำไรต่อหน่วย</span><b>${baht(profit)}</b></div>
      <div class="v65-box"><span>กำไร</span><b>${fmt(margin)}%</b></div>
      <div class="v65-box good"><span>ผลิตได้จากสต็อก</span><b>${fmt(Math.max(0, capacity))} ${esc(unit)}</b></div>
    `;
  };

  async function saveRecipeEdit(value) {
    const overlay = typeof v9ShowOverlay === 'function';
    if (overlay) v9ShowOverlay('กำลังบันทึกสูตร...');
    try {
      const cost = value.rows.reduce((sum, row) => {
        const mat = productsList().find(product => String(product.id) === String(row.material_id));
        return sum + num(row.quantity) * num(mat?.cost);
      }, 0);
      const productPayload = {
        name: value.name,
        price: value.price,
        unit: value.unit,
        category: value.category,
        img_url: await uploadRecipeImageIfNeeded(value.imgUrl, value.name),
        cost,
        stock: 0,
        is_raw: false,
        product_type: '\u0e15\u0e32\u0e21\u0e1a\u0e34\u0e25',
        updated_at: new Date().toISOString(),
      };

      let productId = value.productId;
      if (productId) {
        const { error: productError } = await db.from(PRODUCT_TABLE).update(productPayload).eq('id', productId);
        if (productError) throw new Error(productError.message);
      } else {
        const { data: created, error: productError } = await db.from(PRODUCT_TABLE)
          .insert(productPayload)
          .select('id')
          .single();
        if (productError) throw new Error(productError.message);
        productId = created?.id;
      }
      if (!productId) throw new Error('ไม่พบรหัสสินค้าที่บันทึก');

      const { error: deleteError } = await db.from(RECIPE_TABLE).delete().eq('product_id', productId);
      if (deleteError) throw new Error(deleteError.message);
      for (const row of value.rows) {
        const { error } = await db.from(RECIPE_TABLE).insert({
          product_id: productId,
          material_id: row.material_id,
          quantity: row.quantity,
          unit: row.unit,
        });
        if (error) throw new Error(error.message);
      }
      if (typeof loadProducts === 'function') await loadProducts();
      try { if (typeof products !== 'undefined') window._v9ProductsCache = products; } catch (_) {}
      typeof toast === 'function' && toast('บันทึกสูตรสำเร็จ', 'success');
      await refreshRecipePage();
    } catch (error) {
      typeof toast === 'function' && toast('บันทึกสูตรไม่สำเร็จ: ' + error.message, 'error');
    } finally {
      if (overlay) v9HideOverlay();
    }
  }

  window.v65DeleteRecipe = async function (productId, productName) {
    const confirm = await Swal.fire({
      title: 'ลบสูตรนี้?',
      html: `จะลบวัตถุดิบทั้งหมดของ <strong>${esc(productName || '')}</strong><br>ตัวสินค้าในคลังยังอยู่ แต่จะไม่มีสูตรผลิตตามบิล`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบสูตร',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    const overlay = typeof v9ShowOverlay === 'function';
    if (overlay) v9ShowOverlay('กำลังลบสูตร...');
    try {
      const { error } = await db.from(RECIPE_TABLE).delete().eq('product_id', productId);
      if (error) throw new Error(error.message);
      typeof toast === 'function' && toast('ลบสูตรสำเร็จ', 'success');
      await refreshRecipePage();
    } catch (error) {
      typeof toast === 'function' && toast('ลบสูตรไม่สำเร็จ: ' + error.message, 'error');
    } finally {
      if (overlay) v9HideOverlay();
    }
  };

  window.v65DeleteRecipe = async function (productId, productName) {
    const confirm = await Swal.fire({
      title: 'ลบสูตรและสินค้าออกจากคลัง?',
      html: `ระบบจะลบสูตรผลิตทั้งหมด และลบสินค้า <strong>${esc(productName || '')}</strong> ออกจากหน้าคลังสินค้าด้วย<br><span style="color:#dc2626;font-weight:800">การทำรายการนี้ไม่สามารถย้อนกลับได้</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบสูตรและสินค้า',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    const overlay = typeof v9ShowOverlay === 'function';
    if (overlay) v9ShowOverlay('กำลังลบสูตรและสินค้า...');
    try {
      const { error: recipeError } = await db.from(RECIPE_TABLE).delete().eq('product_id', productId);
      if (recipeError) throw new Error(recipeError.message);
      const { error: productError } = await db.from(PRODUCT_TABLE).delete().eq('id', productId);
      if (productError) throw new Error(productError.message);
      try { window.__v62ClearRecipeCache?.(); } catch (_) {}
      if (typeof loadProducts === 'function') await loadProducts();
      try { if (typeof products !== 'undefined') window._v9ProductsCache = products; } catch (_) {}
      try { await window.v66ReloadRecipes?.(); } catch (_) {}
      try { window.renderInventory?.(); } catch (_) {}
      try { window.renderProductGrid?.(); } catch (_) {}
      typeof toast === 'function' && toast('ลบสูตรและสินค้าออกจากคลังแล้ว', 'success');
      await refreshRecipePage();
    } catch (error) {
      typeof toast === 'function' && toast('ลบสูตรไม่สำเร็จ: ' + error.message, 'error');
    } finally {
      if (overlay) v9HideOverlay();
    }
  };

  async function refreshRecipePage() {
    const container = document.getElementById('v9-manage-inner') || document.getElementById('v9-admin-content');
    if (container && typeof window.v9AdminRecipe === 'function') await window.v9AdminRecipe(container);
  }

  function installRecipeActions() {
    if (window.__v65RecipeActionsInstalled) return;
    window.__v65RecipeActionsInstalled = true;
    document.addEventListener('click', event => {
      const toggleBtn = event.target?.closest?.('[data-v65-toggle-recipe]');
      if (toggleBtn) {
        event.preventDefault();
        event.stopPropagation();
        toggleBtn.closest('.v65-card')?.classList.toggle('is-open');
        return;
      }

      const editBtn = event.target?.closest?.('[data-v65-edit-recipe]');
      if (editBtn) {
        event.preventDefault();
        event.stopPropagation();
        window.v9RecipeEditProduct?.(editBtn.dataset.v65EditRecipe);
        return;
      }

      const deleteBtn = event.target?.closest?.('[data-v65-delete-recipe]');
      if (deleteBtn) {
        event.preventDefault();
        event.stopPropagation();
        window.v65DeleteRecipe?.(deleteBtn.dataset.v65DeleteRecipe, deleteBtn.dataset.v65ProductName || '');
      }
    }, true);
  }

  window.v65OpenRecipeCreate = function () {
    return window.v9RecipeEditProduct?.(null);
  };
  window.v9RecipeShowCreate = window.v65OpenRecipeCreate;

  installStyles();
  installRecipeActions();
})();
