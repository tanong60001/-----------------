// V104: Modern product actions + product editor.
// UI-only replacement that preserves the existing v9/v42 save and action contracts.
(function () {
  'use strict';

  const PRODUCT_TABLE = '\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
  const META_KEY = 'sk_v104_product_meta_v1';
  const metaCache = new Map();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const js = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
  const num = value => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const fmt = value => {
    try { return typeof formatNum === 'function' ? formatNum(value) : num(value).toLocaleString('th-TH'); }
    catch (_) { return num(value).toLocaleString('th-TH'); }
  };
  const productsList = () => {
    try { if (Array.isArray(products)) return products; } catch (_) {}
    return Array.isArray(window.products) ? window.products : [];
  };
  const productById = productId => productsList().find(product => String(product.id) === String(productId));

  function setGlobal(name, value) {
    window[name] = value;
    try { Function('name', 'value', 'window[name] = value; eval(name + " = value");')(name, value); }
    catch (_) {}
  }

  function readLocalMeta() {
    try {
      const parsed = JSON.parse(localStorage.getItem(META_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
  }

  function mergeLocalMeta(productId, patch) {
    const id = String(productId || '');
    if (!id) return;
    try {
      const all = readLocalMeta();
      all[id] = { ...(all[id] || {}), ...patch };
      localStorage.setItem(META_KEY, JSON.stringify(all));
    } catch (_) {}
  }

  function localMeta(productId) {
    return readLocalMeta()[String(productId || '')] || {};
  }

  function validDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateText(value, fallback = 'ยังไม่มีประวัติ') {
    const date = validDate(value);
    if (!date) return fallback;
    try {
      return new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Bangkok'
      }).format(date);
    } catch (_) {
      return date.toLocaleString('th-TH');
    }
  }

  function relativeText(value) {
    const date = validDate(value);
    if (!date) return 'ยังไม่มีข้อมูล';
    const diff = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'เมื่อสักครู่';
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} วันที่แล้ว`;
    return dateText(date);
  }

  function initialMeta(product) {
    const local = localMeta(product?.id);
    return {
      createdAt: product?.created_at || local.createdAt || null,
      updatedAt: product?.updated_at || local.updatedAt || null,
      stockAt: local.stockAt || null,
      stockBy: local.stockBy || '',
      costAt: local.costAt || null,
      costBy: local.costBy || '',
      costFallback: !local.costAt,
    };
  }

  async function loadProductMeta(product) {
    if (!product?.id) return initialMeta(product);
    const id = String(product.id);
    const cached = metaCache.get(id);
    if (cached && Date.now() - cached.at < 2000) return cached.promise;

    const meta = initialMeta(product);
    const request = (async () => {
      if (typeof db === 'undefined') return meta;
      const results = await Promise.allSettled([
        db.from('stock_movement')
          .select('created_at,type,note,staff_name')
          .eq('product_id', id)
          .order('created_at', { ascending: false })
          .limit(40),
        db.from('log_\u0e01\u0e34\u0e08\u0e01\u0e23\u0e23\u0e21')
          .select('time,type,details,username')
          .eq('ref_id', id)
          .order('time', { ascending: false })
          .limit(60),
      ]);

      const movements = results[0].status === 'fulfilled' ? (results[0].value?.data || []) : [];
      const manualMovement = movements.find(row =>
        /\u0e1b\u0e23\u0e31\u0e1a\u0e2a\u0e15\u0e47\u0e2d\u0e01|\u0e41\u0e01\u0e49\u0e44\u0e02|\u0e23\u0e31\u0e1a\u0e40\u0e02\u0e49\u0e32|\u0e19\u0e31\u0e1a\u0e2a\u0e15\u0e47\u0e2d\u0e01|\u0e22\u0e2d\u0e14\u0e22\u0e01\u0e21\u0e32/i.test(`${row.type || ''} ${row.note || ''}`)
      );
      if (manualMovement?.created_at) {
        meta.stockAt = manualMovement.created_at;
        meta.stockBy = manualMovement.staff_name || '';
      }

      const logs = results[1].status === 'fulfilled' ? (results[1].value?.data || []) : [];
      const costLog = logs.find(row =>
        /\u0e15\u0e49\u0e19\u0e17\u0e38\u0e19/i.test(`${row.type || ''} ${row.details || ''}`)
      );
      if (costLog?.time) {
        meta.costAt = costLog.time;
        meta.costBy = costLog.username || '';
        meta.costFallback = false;
      } else if (!meta.costAt && meta.updatedAt) {
        meta.costAt = meta.updatedAt;
        meta.costFallback = true;
      }

      mergeLocalMeta(id, {
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        stockAt: meta.stockAt,
        stockBy: meta.stockBy,
        costAt: meta.costAt,
        costBy: meta.costBy,
      });
      return meta;
    })().catch(error => {
      console.warn('[v104] load product timestamps:', error);
      return meta;
    });
    metaCache.set(id, { at: Date.now(), promise: request });
    return request;
  }

  function injectStyle() {
    if (document.getElementById('v104-modern-product-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'v104-modern-product-ui-style';
    style.textContent = `
      .v104-action-popup{width:min(780px,calc(100vw - 24px))!important;border-radius:30px!important;padding:0!important;overflow:hidden!important;background:#f4f7fb!important;box-shadow:0 40px 120px rgba(15,23,42,.3)!important}
      .v104-action-popup .swal2-html-container{margin:0!important;padding:0!important;overflow:visible!important}
      .v104-action-popup .swal2-close{width:42px!important;height:42px!important;right:18px!important;top:18px!important;border-radius:14px!important;background:rgba(255,255,255,.12)!important;color:#fff!important;font-size:30px!important;transition:.2s!important}
      .v104-action-popup .swal2-close:hover{background:rgba(255,255,255,.22)!important;transform:rotate(4deg)}
      .v104-actions{text-align:left;color:#0f172a}
      .v104-actions-hero{position:relative;overflow:hidden;padding:30px 34px 28px;background:radial-gradient(circle at 82% 5%,rgba(45,212,191,.28),transparent 30%),linear-gradient(125deg,#0b1728 0%,#10364c 52%,#0f766e 100%);color:#fff}
      .v104-actions-hero:after{content:'';position:absolute;width:180px;height:180px;border:1px solid rgba(255,255,255,.1);border-radius:50%;right:-70px;bottom:-110px}
      .v104-eyebrow{display:flex;align-items:center;gap:8px;color:#5eead4;font-size:10px;font-weight:950;letter-spacing:1.7px;text-transform:uppercase}
      .v104-eyebrow i{font-size:15px}
      .v104-actions-title{display:flex;align-items:center;gap:16px;margin-top:13px}
      .v104-actions-thumb{width:64px;height:64px;border-radius:20px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;overflow:hidden;flex:0 0 auto}
      .v104-actions-thumb img{width:100%;height:100%;object-fit:cover}.v104-actions-thumb i{font-size:31px;color:#ccfbf1}
      .v104-actions-title h2{margin:0;color:#fff;font-size:26px;font-weight:950;line-height:1.15}
      .v104-actions-title p{margin:6px 0 0;color:#cbd5e1;font-size:12px;font-weight:750}
      .v104-actions-body{padding:22px 24px 24px}
      .v104-actions-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
      .v104-metric{min-width:0;border:1px solid #dbe5ef;background:rgba(255,255,255,.82);border-radius:16px;padding:12px 13px}
      .v104-metric span{display:block;color:#64748b;font-size:10px;font-weight:900}.v104-metric b{display:block;color:#0f172a;font-size:15px;font-weight:950;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v104-action-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .v104-action-card{position:relative;min-height:116px;border:1px solid #d9e3ef;border-radius:19px;background:#fff;padding:16px;text-align:left;cursor:pointer;display:flex;flex-direction:column;transition:transform .18s,box-shadow .18s,border-color .18s;font:inherit;color:#0f172a;overflow:hidden}
      .v104-action-card:after{content:'arrow_forward';font-family:'Material Icons Round';position:absolute;right:14px;top:17px;color:#cbd5e1;font-size:18px;transition:.18s}
      .v104-action-card:hover{transform:translateY(-3px);border-color:#5eead4;box-shadow:0 18px 34px rgba(15,118,110,.11)}
      .v104-action-card:hover:after{color:#0f766e;transform:translateX(2px)}
      .v104-action-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:#ecfeff;color:#0e7490}
      .v104-action-icon i{font-size:23px}.v104-action-card strong{font-size:14px;font-weight:950;margin-top:12px}.v104-action-card small{font-size:10px;color:#64748b;font-weight:750;margin-top:3px;line-height:1.4}
      .v104-action-card.stock .v104-action-icon{background:#ecfdf5;color:#047857}.v104-action-card.units .v104-action-icon{background:#eff6ff;color:#2563eb}
      .v104-action-card.barcode .v104-action-icon{background:#f5f3ff;color:#7c3aed}.v104-action-card.label .v104-action-icon{background:#fff7ed;color:#ea580c}
      .v104-action-card.danger{border-color:#fee2e2}.v104-action-card.danger .v104-action-icon{background:#fff1f2;color:#e11d48}.v104-action-card.danger:hover{border-color:#fda4af;box-shadow:0 18px 34px rgba(225,29,72,.09)}
      .v104-action-foot{display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 12px;border-radius:13px;background:#eaf8f5;color:#115e59;font-size:11px;font-weight:850}
      .v104-action-foot i{font-size:17px}

      .modal-box.v104-product-modal{width:min(1040px,calc(100vw - 28px))!important;max-height:94vh!important;border-radius:30px!important;overflow:hidden!important;border:1px solid rgba(255,255,255,.65)!important;background:#f3f6fa!important;box-shadow:0 40px 120px rgba(15,23,42,.3)!important}
      .modal-box.v104-product-modal .modal-header{height:70px!important;padding:0 28px!important;background:#fff!important;border-bottom:1px solid #e4eaf1!important}
      .modal-box.v104-product-modal .modal-header h3{font-size:20px!important;font-weight:950!important;color:#0f172a!important}
      .modal-box.v104-product-modal .modal-close{width:40px;height:40px;border-radius:13px;color:#64748b}
      .modal-box.v104-product-modal .modal-body{padding:0!important;background:#f3f6fa!important}
      .v104-editor{color:#0f172a}
      .v104-editor-hero{position:relative;display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center;padding:24px 30px;background:radial-gradient(circle at 85% 15%,rgba(45,212,191,.24),transparent 28%),linear-gradient(120deg,#0f172a,#134e4a);color:#fff}
      .v104-editor-hero h2{margin:5px 0 0;color:#fff;font-size:24px;font-weight:950}.v104-editor-hero p{margin:6px 0 0;color:#cbd5e1;font-size:12px;font-weight:750}
      .v104-editor-live{display:flex;gap:8px}.v104-live-pill{min-width:112px;padding:10px 13px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(255,255,255,.1)}
      .v104-live-pill span{display:block;color:#99f6e4;font-size:9px;font-weight:900}.v104-live-pill b{display:block;color:#fff;font-size:17px;margin-top:3px}
      .v104-timeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px 22px;background:#fff;border-bottom:1px solid #e2e8f0}
      .v104-time-card{display:grid;grid-template-columns:35px 1fr;gap:9px;align-items:center;min-width:0;border:1px solid #e2e8f0;border-radius:14px;padding:10px 11px;background:#fbfdff}
      .v104-time-icon{width:35px;height:35px;border-radius:11px;display:grid;place-items:center;background:#ecfeff;color:#0e7490}.v104-time-icon i{font-size:18px}
      .v104-time-card.stock .v104-time-icon{background:#ecfdf5;color:#047857}.v104-time-card.cost .v104-time-icon{background:#fff7ed;color:#c2410c}.v104-time-card.updated .v104-time-icon{background:#eff6ff;color:#2563eb}
      .v104-time-card span,.v104-time-card b,.v104-time-card small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v104-time-card span{font-size:9px;color:#64748b;font-weight:900}.v104-time-card b{font-size:11px;color:#0f172a;margin-top:2px}.v104-time-card small{font-size:9px;color:#94a3b8;margin-top:1px}
      .v104-editor-body{padding:20px 22px 24px;display:grid;gap:14px}
      .v104-section{border:1px solid #dde5ee;border-radius:19px;background:#fff;padding:18px;box-shadow:0 10px 26px rgba(15,23,42,.035)}
      .v104-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      .v104-section-title{display:flex;align-items:center;gap:10px}.v104-section-title i{width:34px;height:34px;border-radius:11px;background:#eef6ff;color:#2563eb;display:grid;place-items:center;font-size:18px}
      .v104-section-title b{display:block;font-size:14px;font-weight:950}.v104-section-title small{display:block;font-size:10px;color:#94a3b8;margin-top:1px}
      .v104-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v104-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      .v104-field label{display:flex;align-items:center;justify-content:space-between;color:#475569;font-size:11px;font-weight:950;margin:0 0 6px}
      .v104-field input,.v104-field select{width:100%;height:48px;border:1.5px solid #d6e0eb;border-radius:13px;background:#fff;color:#0f172a;padding:0 14px;font:inherit;font-size:14px;font-weight:850;outline:none;box-sizing:border-box;transition:.16s}
      .v104-field input:focus,.v104-field select:focus{border-color:#14b8a6;box-shadow:0 0 0 4px rgba(20,184,166,.11)}.v104-field input::placeholder{color:#a8b3c2;font-weight:650}
      .v104-barcode{display:grid;grid-template-columns:1fr 46px 60px;gap:7px}.v104-mini-btn{height:48px;border:1.5px solid #d6e0eb;border-radius:13px;background:#fff;color:#475569;cursor:pointer;font:inherit;font-size:12px;font-weight:900;display:grid;place-items:center}.v104-mini-btn i{font-size:20px}.v104-mini-btn:hover{border-color:#14b8a6;color:#0f766e;background:#f0fdfa}
      .v104-image-layout{display:grid;grid-template-columns:210px 1fr;gap:16px}
      .v104-image-preview{height:176px;border:1px solid #dbe5ef;border-radius:17px;background:linear-gradient(145deg,#f8fafc,#eef2f7);display:grid;place-items:center;overflow:hidden;position:relative}
      .v104-image-preview img{width:100%;height:100%;object-fit:cover}.v104-image-empty{text-align:center;color:#94a3b8}.v104-image-empty i{font-size:40px}.v104-image-empty b{display:block;font-size:11px;margin-top:5px}
      .v104-image-remove{position:absolute;right:9px;top:9px;width:34px;height:34px;border:0;border-radius:11px;background:rgba(15,23,42,.74);color:#fff;cursor:pointer;display:grid;place-items:center}.v104-image-remove i{font-size:18px}
      .v104-drop{min-height:176px;border:1.5px dashed #b9c9da;border-radius:17px;background:#fbfdff;padding:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:.18s}
      .v104-drop.drag{border-color:#14b8a6;background:#f0fdfa;transform:scale(.995)}.v104-drop i{font-size:30px;color:#0d9488}.v104-drop b{font-size:13px;margin-top:7px}.v104-drop span{font-size:10px;color:#64748b;margin-top:4px;line-height:1.5}.v104-drop button{margin-top:11px;height:38px;border:0;border-radius:11px;background:#0f766e;color:#fff;padding:0 15px;font:inherit;font-size:11px;font-weight:950;cursor:pointer}
      .v104-kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.v104-kind{position:relative}.v104-kind input{position:absolute;opacity:0}.v104-kind>span{min-height:78px;border:1.5px solid #dbe5ef;border-radius:15px;padding:12px;display:flex;align-items:center;gap:10px;cursor:pointer;background:#fff;transition:.16s}
      .v104-kind-icon{width:40px;height:40px;border-radius:13px;background:#ecfdf5;color:#059669;display:grid;place-items:center;flex:0 0 auto}.v104-kind-icon i{font-size:21px}.v104-kind.raw .v104-kind-icon{background:#eff6ff;color:#2563eb}.v104-kind.both .v104-kind-icon{background:#fff7ed;color:#ea580c}
      .v104-kind b,.v104-kind small{display:block}.v104-kind b{font-size:12px}.v104-kind small{font-size:9px;color:#94a3b8;margin-top:2px;line-height:1.4}.v104-kind input:checked+span{border-color:#14b8a6;background:#f0fdfa;box-shadow:0 0 0 3px rgba(20,184,166,.1)}
      .v104-editor-save{position:sticky;bottom:-1px;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:16px;margin:2px -22px -24px;padding:14px 22px;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-top:1px solid #dfe7ef}
      .v104-save-hint{display:flex;align-items:center;gap:8px;color:#64748b;font-size:10px;font-weight:800}.v104-save-hint i{color:#0d9488;font-size:18px}
      .v104-submit{height:50px;min-width:210px;border:0;border-radius:14px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff;font:inherit;font-size:14px;font-weight:950;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 14px 28px rgba(15,118,110,.22)}.v104-submit:hover{transform:translateY(-1px);box-shadow:0 17px 32px rgba(15,118,110,.28)}
      @media(max-width:800px){.v104-action-grid{grid-template-columns:1fr 1fr}.v104-actions-metrics{grid-template-columns:1fr}.v104-timeline{grid-template-columns:1fr 1fr}.v104-editor-hero{grid-template-columns:1fr}.v104-editor-live{display:grid;grid-template-columns:1fr 1fr}.v104-grid-2,.v104-grid-3,.v104-image-layout,.v104-kinds{grid-template-columns:1fr}.v104-image-preview{height:150px}.modal-box.v104-product-modal{width:calc(100vw - 12px)!important;border-radius:22px!important}.v104-editor-save{align-items:stretch;flex-direction:column}.v104-submit{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function productThumb(product) {
    return product?.img_url
      ? `<img src="${esc(product.img_url)}" alt="${esc(product.name || '')}">`
      : '<i class="material-icons-round">inventory_2</i>';
  }

  function actionMetric(id, label, value, icon = '') {
    return `<div class="v104-metric"${id ? ` id="${id}"` : ''}><span>${icon ? `<i class="material-icons-round" style="font-size:12px;vertical-align:-2px;margin-right:3px">${icon}</i>` : ''}${label}</span><b>${value}</b></div>`;
  }

  function renderActionMeta(product, meta) {
    const updated = document.getElementById('v104-action-updated');
    const stock = document.getElementById('v104-action-stock-date');
    const cost = document.getElementById('v104-action-cost-date');
    if (updated) updated.querySelector('b').textContent = relativeText(meta.updatedAt || product.updated_at);
    if (stock) stock.querySelector('b').textContent = dateText(meta.stockAt);
    if (cost) cost.querySelector('b').textContent = dateText(meta.costAt || meta.updatedAt);
  }

  function installProductActions() {
    const previous = window.v42ProductActions;
    if (previous?.__v104Modern) return;

    const modernActions = function (productId) {
      injectStyle();
      const product = productById(productId);
      if (!product || typeof Swal === 'undefined') return previous?.apply(this, arguments);
      if (typeof window.v66RecipeShouldHandleProduct === 'function' && window.v66RecipeShouldHandleProduct(product)) {
        return previous?.apply(this, arguments);
      }
      const meta = initialMeta(product);
      Swal.fire({
        html: `
          <div class="v104-actions">
            <section class="v104-actions-hero">
              <div class="v104-eyebrow"><i class="material-icons-round">auto_awesome</i> PRODUCT CONTROL CENTER</div>
              <div class="v104-actions-title">
                <div class="v104-actions-thumb">${productThumb(product)}</div>
                <div><h2>${esc(product.name || 'สินค้า')}</h2><p>${esc(product.barcode || 'ไม่มีบาร์โค้ด')} · ${esc(product.category || 'ไม่ระบุหมวดหมู่')} · ${esc(product.unit || 'ชิ้น')}</p></div>
              </div>
            </section>
            <div class="v104-actions-body">
              <div class="v104-actions-metrics">
                ${actionMetric('v104-action-updated', 'แก้ไขข้อมูลล่าสุด', relativeText(meta.updatedAt), 'edit_calendar')}
                ${actionMetric('v104-action-stock-date', 'แก้ไขสต็อกล่าสุด', dateText(meta.stockAt), 'inventory')}
                ${actionMetric('v104-action-cost-date', 'อัปเดตต้นทุนล่าสุด', dateText(meta.costAt || meta.updatedAt), 'payments')}
              </div>
              <div class="v104-action-grid">
                <button class="v104-action-card" onclick="Swal.close();editProduct('${js(product.id)}')"><span class="v104-action-icon"><i class="material-icons-round">edit_note</i></span><strong>แก้ไขสินค้า</strong><small>ข้อมูล ราคา รูปภาพ และประเภทสินค้า</small></button>
                <button class="v104-action-card units" onclick="Swal.close();v42ShowUnitModal('${js(product.id)}')"><span class="v104-action-icon"><i class="material-icons-round">straighten</i></span><strong>หน่วยนับและกำไร</strong><small>อัตราแปลง ราคา และมาร์จิ้นแต่ละหน่วย</small></button>
                <button class="v104-action-card stock" onclick="Swal.close();adjustStock('${js(product.id)}')"><span class="v104-action-icon"><i class="material-icons-round">inventory</i></span><strong>ปรับสต็อก</strong><small>คงเหลือ ${esc(fmt(product.stock))} ${esc(product.unit || '')}</small></button>
                <button class="v104-action-card barcode" onclick="Swal.close();generateBarcode?.('${js(product.id)}')"><span class="v104-action-icon"><i class="material-icons-round">qr_code_2</i></span><strong>บาร์โค้ด</strong><small>สร้างหรือพิมพ์รหัสประจำสินค้า</small></button>
                <button class="v104-action-card label" onclick="Swal.close();v34PrintPriceSticker?.('${js(product.id)}')"><span class="v104-action-icon"><i class="material-icons-round">sell</i></span><strong>สติกเกอร์ราคา</strong><small>ราคา ฿${esc(fmt(product.price))} พร้อมพิมพ์</small></button>
                <button class="v104-action-card danger" onclick="Swal.close();deleteProduct('${js(product.id)}')"><span class="v104-action-icon"><i class="material-icons-round">delete_outline</i></span><strong>ลบสินค้า</strong><small>ตรวจประวัติการขายก่อนดำเนินการ</small></button>
              </div>
              <div class="v104-action-foot"><i class="material-icons-round">verified_user</i><span>ทุกการแก้ไขยังใช้สิทธิ์และขั้นตอนตรวจสอบเดิมของระบบ</span></div>
            </div>
          </div>`,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'v104-action-popup' },
      });
      loadProductMeta(product).then(loaded => renderActionMeta(product, loaded));
    };
    modernActions.__v104Modern = true;
    modernActions.__v66RecipeGuard = true;
    setGlobal('v42ProductActions', modernActions);
  }

  function kindValue(product) {
    if (String(product?.product_type || '').toLowerCase() === 'both') return 'both';
    return product?.is_raw ? 'raw' : 'sale';
  }

  function timeCard(css, icon, label, valueId, value, noteId, note) {
    return `<div class="v104-time-card ${css}"><span class="v104-time-icon"><i class="material-icons-round">${icon}</i></span><div><span>${label}</span><b id="${valueId}">${esc(value)}</b><small id="${noteId}">${esc(note)}</small></div></div>`;
  }

  function renderEditorMeta(product, meta) {
    const values = {
      'v104-created-at': dateText(meta.createdAt, product?.id ? 'ไม่พบวันที่สร้าง' : 'จะบันทึกเมื่อสร้างสินค้า'),
      'v104-stock-at': dateText(meta.stockAt),
      'v104-cost-at': dateText(meta.costAt || meta.updatedAt),
      'v104-updated-at': dateText(meta.updatedAt),
      'v104-stock-note': meta.stockBy ? `โดย ${meta.stockBy}` : (meta.stockAt ? 'จากประวัติสต็อก' : 'ยังไม่มีการปรับสต็อก'),
      'v104-cost-note': meta.costBy ? `โดย ${meta.costBy}` : (meta.costFallback ? 'อ้างอิงการแก้ไขสินค้าล่าสุด' : 'จากประวัติต้นทุน'),
      'v104-updated-note': relativeText(meta.updatedAt),
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

  function refreshEditorImage(value) {
    const image = document.getElementById('v9prod-img-preview');
    const empty = document.getElementById('v104-image-empty');
    const remove = document.getElementById('v104-image-remove');
    const hasImage = !!String(value || '').trim() && value !== 'FILE_SELECTED';
    if (image) {
      if (hasImage) image.src = value;
      image.style.display = hasImage ? 'block' : 'none';
    }
    if (empty) empty.style.display = hasImage ? 'none' : 'block';
    if (remove) remove.style.display = hasImage ? 'grid' : 'none';
  }

  window.v104ClearProductImage = function () {
    if (typeof window.v9ClearProductImage === 'function') window.v9ClearProductImage();
    const hidden = document.getElementById('v9prod-img');
    if (hidden) hidden.value = '';
    refreshEditorImage('');
  };

  window.v104PickProductImage = function () {
    document.getElementById('prod-img-upload')?.click();
  };

  window.v104ProductImageChanged = function (event) {
    if (typeof window.v9HandleImageSelect === 'function') window.v9HandleImageSelect(event);
    setTimeout(() => {
      const hidden = document.getElementById('v9prod-img');
      const preview = document.getElementById('v9prod-img-preview');
      if (preview?.src) {
        preview.style.display = 'block';
        document.getElementById('v104-image-empty')?.style.setProperty('display', 'none');
        document.getElementById('v104-image-remove')?.style.setProperty('display', 'grid');
      } else refreshEditorImage(hidden?.value);
    }, 40);
  };

  function acceptImageFile(file) {
    if (!file || !String(file.type || '').startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const hidden = document.getElementById('v9prod-img');
      if (hidden) hidden.value = value;
      refreshEditorImage(value);
      const meta = document.getElementById('v104-image-help');
      if (meta) meta.textContent = 'รับรูปแล้ว · ระบบจะบีบอัดและอัปโหลดเมื่อกดบันทึก';
    };
    reader.readAsDataURL(file);
  }

  function installDropZone() {
    const drop = document.getElementById('v104-image-drop');
    if (!drop || drop.dataset.ready) return;
    drop.dataset.ready = '1';
    ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => {
      event.preventDefault();
      drop.classList.add('drag');
    }));
    ['dragleave', 'drop'].forEach(type => drop.addEventListener(type, event => {
      event.preventDefault();
      drop.classList.remove('drag');
    }));
    drop.addEventListener('drop', event => acceptImageFile(event.dataTransfer?.files?.[0]));
    document.querySelector('[data-v104-product-editor]')?.addEventListener('paste', event => {
      const file = Array.from(event.clipboardData?.items || [])
        .find(item => String(item.type || '').startsWith('image/'))?.getAsFile();
      if (file) {
        event.preventDefault();
        acceptImageFile(file);
      }
    });
  }

  function installProductEditor() {
    const previous = window.showAddProductModal;
    if (previous?.__v104Modern) return;

    const modernEditor = function (productData = null) {
      injectStyle();
      if (typeof openModal !== 'function') return previous?.apply(this, arguments);
      try {
        if (window.__SK_ACCESS_GUARD__?.can?.('can_inv') === false) return previous?.apply(this, arguments);
      } catch (_) {}
      const categoriesList = (() => {
        try { return Array.isArray(categories) ? categories : []; } catch (_) { return []; }
      })();
      const edit = !!productData;
      const kind = kindValue(productData);
      const meta = initialMeta(productData || {});
      const imageUrl = productData?.img_url || '';

      openModal(edit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่', `
        <form id="v9-product-form" class="v104-editor" data-v104-product-editor="1" onsubmit="event.preventDefault();v9SaveProduct()">
          <section class="v104-editor-hero">
            <div>
              <div class="v104-eyebrow"><i class="material-icons-round">${edit ? 'edit_note' : 'add_box'}</i> ${edit ? 'PRODUCT EDITOR' : 'NEW PRODUCT'}</div>
              <h2>${esc(productData?.name || 'สร้างสินค้าใหม่')}</h2>
              <p>${edit ? `รหัสสินค้า ${esc(productData?.barcode || 'ยังไม่มีบาร์โค้ด')}` : 'เพิ่มข้อมูลสินค้าให้พร้อมขายและจัดการสต็อก'}</p>
            </div>
            <div class="v104-editor-live">
              <div class="v104-live-pill"><span>สต็อกปัจจุบัน</span><b id="v104-live-stock">${fmt(productData?.stock || 0)} ${esc(productData?.unit || '')}</b></div>
              <div class="v104-live-pill"><span>ต้นทุนปัจจุบัน</span><b id="v104-live-cost">฿${fmt(productData?.cost || 0)}</b></div>
            </div>
          </section>
          <div class="v104-timeline">
            ${timeCard('', 'event_available', 'วันที่สร้างสินค้า', 'v104-created-at', dateText(meta.createdAt, edit ? 'ไม่พบวันที่สร้าง' : 'เมื่อบันทึกสินค้า'), 'v104-created-note', edit ? 'ข้อมูลจากระบบ' : 'ระบบจะสร้างให้อัตโนมัติ')}
            ${timeCard('stock', 'inventory', 'แก้ไขสต็อกล่าสุด', 'v104-stock-at', dateText(meta.stockAt), 'v104-stock-note', 'กำลังตรวจสอบประวัติ')}
            ${timeCard('cost', 'payments', 'อัปเดตต้นทุนล่าสุด', 'v104-cost-at', dateText(meta.costAt || meta.updatedAt), 'v104-cost-note', meta.costFallback ? 'อ้างอิงการแก้ไขล่าสุด' : 'กำลังตรวจสอบประวัติ')}
            ${timeCard('updated', 'update', 'แก้ไขข้อมูลล่าสุด', 'v104-updated-at', dateText(meta.updatedAt), 'v104-updated-note', relativeText(meta.updatedAt))}
          </div>
          <div class="v104-editor-body">
            <section class="v104-section">
              <div class="v104-section-head"><div class="v104-section-title"><i class="material-icons-round">badge</i><div><b>ข้อมูลหลัก</b><small>ชื่อสินค้า บาร์โค้ด และหมวดหมู่</small></div></div></div>
              <div class="v104-grid-2">
                <div class="v104-field"><label>ชื่อสินค้า <em>*</em></label><input id="v9prod-name" value="${esc(productData?.name || '')}" required autocomplete="off" placeholder="ระบุชื่อสินค้า"></div>
                <div class="v104-field"><label>บาร์โค้ด <small>ยิงสแกนเนอร์ได้</small></label><div class="v104-barcode"><input id="v9prod-barcode" value="${esc(productData?.barcode || '')}" autocomplete="off" placeholder="สแกนหรือกรอกบาร์โค้ด"><button type="button" id="v9-scan-btn" class="v104-mini-btn" onclick="v9StartBarcodeScanner()" title="สแกนบาร์โค้ด"><i class="material-icons-round">qr_code_scanner</i></button><button type="button" class="v104-mini-btn" onclick="v9GenerateBarcode()">สุ่ม</button></div><div id="v9-bc-preview" style="display:none;margin-top:8px;padding:8px;text-align:center;border:1px solid #e2e8f0;border-radius:12px;background:#fff"><svg id="v9-bc-svg"></svg><div id="v9-bc-num" style="font-size:10px;color:#64748b"></div></div><canvas id="v9-barcode-canvas" style="display:none;max-width:100%"></canvas></div>
              </div>
              <div class="v104-grid-3" style="margin-top:12px">
                <div class="v104-field"><label>หน่วยหลัก</label><input id="v9prod-unit" value="${esc(productData?.unit || 'ชิ้น')}" placeholder="ชิ้น / กก. / คิว"></div>
                <div class="v104-field"><label>หมวดหมู่</label><select id="v9prod-category"><option value="">ไม่ระบุหมวดหมู่</option>${categoriesList.map(category => `<option value="${esc(category.name)}" ${productData?.category === category.name ? 'selected' : ''}>${esc(category.name)}</option>`).join('')}</select></div>
                <div class="v104-field"><label>สต็อกขั้นต่ำ</label><input type="number" id="v9prod-min-stock" value="${esc(productData?.min_stock || 0)}" min="0" step="0.000001"></div>
              </div>
            </section>

            <section class="v104-section">
              <div class="v104-section-head"><div class="v104-section-title"><i class="material-icons-round">monitoring</i><div><b>ราคา ต้นทุน และสต็อก</b><small>รองรับจำนวนทศนิยมและคำนวณกำไรจากข้อมูลจริง</small></div></div></div>
              <div class="v104-grid-3">
                <div class="v104-field"><label>ราคาขาย (฿)</label><input type="number" id="v9prod-price" value="${esc(productData?.price || 0)}" min="0" step="0.01"></div>
                <div class="v104-field"><label>ต้นทุนต่อหน่วย (฿)</label><input type="number" id="v9prod-cost" value="${esc(productData?.cost || 0)}" min="0" step="0.000001"></div>
                <div class="v104-field"><label>สต็อกคงเหลือ</label><input type="number" id="v9prod-stock" value="${esc(productData?.stock || 0)}" min="0" step="0.000001"></div>
              </div>
            </section>

            <section class="v104-section">
              <div class="v104-section-head"><div class="v104-section-title"><i class="material-icons-round">image</i><div><b>รูปภาพสินค้า</b><small>ถ่ายรูป เลือกไฟล์ วางรูป หรือ drag & drop</small></div></div></div>
              <div class="v104-image-layout">
                <div class="v104-image-preview" id="v9prod-img-preview-wrap">
                  <img id="v9prod-img-preview" src="${esc(imageUrl)}" style="display:${imageUrl ? 'block' : 'none'}">
                  <div class="v104-image-empty" id="v104-image-empty" style="display:${imageUrl ? 'none' : 'block'}"><i class="material-icons-round">add_photo_alternate</i><b>ยังไม่มีรูปสินค้า</b></div>
                  <button type="button" class="v104-image-remove" id="v104-image-remove" style="display:${imageUrl ? 'grid' : 'none'}" onclick="v104ClearProductImage()" title="ลบรูป"><i class="material-icons-round">close</i></button>
                </div>
                <div class="v104-drop" id="v104-image-drop" onclick="if(event.target===this)v104PickProductImage()">
                  <i class="material-icons-round">cloud_upload</i><b>วางรูปตรงนี้ได้เลย</b>
                  <span id="v104-image-help">กด Ctrl+V, ลากรูปมาวาง หรือเลือกรูปจากอุปกรณ์<br>ระบบจะบีบอัดก่อนอัปโหลด</span>
                  <button type="button" onclick="v104PickProductImage()"><i class="material-icons-round" style="font-size:16px;vertical-align:-3px;margin-right:5px">photo_camera</i>ถ่ายรูป / เลือกรูป</button>
                </div>
              </div>
              <input type="file" accept="image/*" capture="environment" id="prod-img-upload" style="display:none" onchange="v104ProductImageChanged(event)">
              <input type="hidden" id="v9prod-img" value="${esc(imageUrl)}"><input type="hidden" id="v9prod-img-old" value="${esc(imageUrl)}">
            </section>

            <section class="v104-section">
              <div class="v104-section-head"><div class="v104-section-title"><i class="material-icons-round">category</i><div><b>ประเภทและการใช้งาน</b><small>กำหนดว่าสินค้านี้ปรากฏและถูกใช้งานส่วนใด</small></div></div></div>
              <div class="v104-kinds">
                <label class="v104-kind sale"><input type="radio" name="v9prod-kind" id="v9prod-kind-sale" value="sale" ${kind === 'sale' ? 'checked' : ''}><span><span class="v104-kind-icon"><i class="material-icons-round">shopping_cart</i></span><span><b>ของขาย</b><small>แสดงในหน้าขาย POS</small></span></span></label>
                <label class="v104-kind raw"><input type="radio" name="v9prod-kind" id="v9prod-kind-raw" value="raw" ${kind === 'raw' ? 'checked' : ''}><span><span class="v104-kind-icon"><i class="material-icons-round">science</i></span><span><b>วัตถุดิบ</b><small>ใช้ผลิตสินค้า ไม่แสดง POS</small></span></span></label>
                <label class="v104-kind both"><input type="radio" name="v9prod-kind" id="v9prod-kind-both" value="both" ${kind === 'both' ? 'checked' : ''}><span><span class="v104-kind-icon"><i class="material-icons-round">swap_horiz</i></span><span><b>ทั้งคู่</b><small>ขายได้และใช้ผลิตได้</small></span></span></label>
              </div>
              <div class="v104-field" style="margin-top:13px"><label>หมายเหตุ</label><input id="v9prod-note" value="${esc(productData?.note || '')}" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"></div>
            </section>

            <input type="hidden" id="v9prod-id" value="${esc(productData?.id || '')}">
            <div class="v104-editor-save">
              <div class="v104-save-hint"><i class="material-icons-round">shield</i><span>ระบบจะตรวจสอบสิทธิ์ ตัวเลข และรูปภาพก่อนบันทึก</span></div>
              <button type="submit" class="v104-submit"><i class="material-icons-round">save</i>${edit ? 'บันทึกการแก้ไข' : 'สร้างสินค้า'}</button>
            </div>
          </div>
        </form>`);

      document.querySelector('#modal-overlay .modal-box')?.classList.add('v104-product-modal');
      installDropZone();
      if (productData?.barcode) setTimeout(() => window.v9BarcodePreview?.(), 50);
      const canAdjustStock = (() => {
        try {
          if (typeof window.v52CanAdjustStock === 'function') return window.v52CanAdjustStock();
          return USER?.role === 'admin'
            || USER_PERMS?.can_adjust_stock === true
            || USER_PERMS?.can_manage === true;
        } catch (_) { return false; }
      })();
      if (!canAdjustStock) {
        ['v9prod-stock', 'v9prod-min-stock'].forEach(id => {
          const input = document.getElementById(id);
          if (!input) return;
          input.readOnly = true;
          input.style.background = '#f8fafc';
          input.title = 'ต้องมีสิทธิ์ปรับสต็อก';
        });
      }
      const stockInput = document.getElementById('v9prod-stock');
      const costInput = document.getElementById('v9prod-cost');
      const unitInput = document.getElementById('v9prod-unit');
      const updateLive = () => {
        const stock = document.getElementById('v104-live-stock');
        const cost = document.getElementById('v104-live-cost');
        if (stock) stock.textContent = `${fmt(stockInput?.value)} ${unitInput?.value || ''}`;
        if (cost) cost.textContent = `฿${fmt(costInput?.value)}`;
      };
      [stockInput, costInput, unitInput].forEach(input => input?.addEventListener('input', updateLive));
      if (edit) loadProductMeta(productData).then(loaded => renderEditorMeta(productData, loaded));
    };
    modernEditor.__v104Modern = true;
    modernEditor.__v36imagepaste = true;
    modernEditor.__v52StockPerm = true;
    modernEditor.__v58Guarded = true;
    setGlobal('showAddProductModal', modernEditor);
  }

  function installSaveAudit() {
    const original = window.v9SaveProduct;
    if (typeof original !== 'function' || original.__v104Audit) return;
    const wrapped = async function () {
      try {
        if (window.__SK_ACCESS_GUARD__?.can?.('can_inv') === false) {
          toast?.('ไม่มีสิทธิ์แก้ไขสินค้า', 'error');
          return;
        }
      } catch (_) {}
      const id = document.getElementById('v9prod-id')?.value || '';
      const before = id ? productById(id) : null;
      const requestedStock = num(document.getElementById('v9prod-stock')?.value);
      const requestedCost = num(document.getElementById('v9prod-cost')?.value);
      const result = await original.apply(this, arguments);
      if (!id || !before) return result;
      const after = productById(id);
      if (!after) return result;
      const now = new Date().toISOString();
      const user = (() => { try { return USER?.username || USER?.name || ''; } catch (_) { return ''; } })();
      const patch = { updatedAt: after.updated_at || now };

      if (num(before.stock) !== requestedStock && num(after.stock) === requestedStock) {
        patch.stockAt = now;
        patch.stockBy = user;
        Promise.resolve(db.from('stock_movement').insert({
          product_id: id,
          product_name: after.name || before.name || '',
          type: '\u0e41\u0e01\u0e49\u0e44\u0e02\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e1f\u0e2d\u0e23\u0e4c\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32',
          direction: requestedStock >= num(before.stock) ? 'in' : 'out',
          qty: Math.abs(requestedStock - num(before.stock)),
          stock_before: num(before.stock),
          stock_after: requestedStock,
          staff_name: user,
          note: 'บันทึกจากหน้าจัดการสินค้าแบบใหม่',
        })).catch(error => console.warn('[v104] stock audit:', error));
      }
      if (num(before.cost) !== requestedCost && num(after.cost) === requestedCost) {
        patch.costAt = now;
        patch.costBy = user;
        try {
          Promise.resolve(logActivity?.(
            'อัปเดตต้นทุนสินค้า',
            `"${after.name || before.name}" | ฿${fmt(before.cost)} → ฿${fmt(requestedCost)}`,
            id,
            PRODUCT_TABLE
          )).catch(() => {});
        } catch (_) {}
      }
      mergeLocalMeta(id, patch);
      metaCache.delete(String(id));
      return result;
    };
    wrapped.__v104Audit = true;
    wrapped.__v58Guarded = true;
    try {
      Object.getOwnPropertyNames(original).forEach(key => {
        if (!['name', 'length', 'prototype'].includes(key)) {
          try { Object.defineProperty(wrapped, key, Object.getOwnPropertyDescriptor(original, key)); } catch (_) {}
        }
      });
    } catch (_) {}
    setGlobal('v9SaveProduct', wrapped);
  }

  function cleanupModalClass() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || overlay.__v104Cleanup) return;
    overlay.__v104Cleanup = true;
    const observer = new MutationObserver(() => {
      if (overlay.classList.contains('hidden')) {
        overlay.querySelector('.modal-box')?.classList.remove('v104-product-modal');
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  function boot() {
    injectStyle();
    installProductActions();
    installProductEditor();
    installSaveAudit();
    cleanupModalClass();
  }

  boot();
  [500, 1500, 3000].forEach(delay => setTimeout(boot, delay));
  console.log('[v104] modern product UI loaded');
})();
