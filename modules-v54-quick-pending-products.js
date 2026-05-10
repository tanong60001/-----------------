(function () {
  'use strict';

  const PRODUCT_TABLE = 'สินค้า';
  const BILL_ITEM_TABLE = 'รายการในบิล';
  const PENDING_MARK = '[สินค้าด่วนรอเคลียร์]';
  const PENDING_CATEGORY = 'รอเคลียร์ทั้งหมด';

  const money = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const fmt = value => {
    try {
      if (typeof formatNum === 'function') return formatNum(value);
    } catch (_) { }
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(Number(value || 0));
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const js = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const productList = () => {
    try { if (Array.isArray(products)) return products; } catch (_) { }
    return Array.isArray(window.products) ? window.products : [];
  };

  const staffName = () => {
    try { return (typeof USER !== 'undefined' && USER?.username) ? USER.username : null; } catch (_) { return null; }
  };

  const isPendingProduct = product => {
    const note = String(product?.note || '');
    return note.includes(PENDING_MARK) || product?.quick_pending === true;
  };

  const norm = value => String(value || '').toLowerCase().replace(/\s+/g, '').trim();

  const pendingProducts = () => productList().filter(isPendingProduct);

  const activeCart = () => {
    try { if (Array.isArray(cart)) return cart; } catch (_) { }
    return Array.isArray(window.cart) ? window.cart : [];
  };

  const canManagePendingStock = () => {
    try {
      if (typeof window.v52CanAdjustStock === 'function') return window.v52CanAdjustStock();
      if (typeof USER !== 'undefined' && USER?.role === 'admin') return true;
      if (typeof USER_PERMS !== 'undefined') return !!(USER_PERMS?.can_adjust_stock || USER_PERMS?.can_manage || USER_PERMS?.can_inv);
    } catch (_) { }
    return false;
  };

  function denyPendingDelete() {
    const msg = 'ต้องได้รับสิทธิ์คลังสินค้า/ปรับสต็อกจากแอดมินก่อนลบสินค้ารอเคลียร์';
    if (typeof Swal !== 'undefined') Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์ลบ', text: msg, confirmButtonColor: '#dc2626' });
    else toast?.(msg, 'warning');
  }

  const syncCart = next => {
    try { cart = next; } catch (_) { window.cart = next; }
  };

  function injectStyle() {
    if (document.getElementById('v54-quick-pending-style')) return;
    const style = document.createElement('style');
    style.id = 'v54-quick-pending-style';
    style.textContent = `
      .v54-quick-btn{background:linear-gradient(135deg,#ef4444,#dc2626)!important;color:#fff!important;border:0!important;border-radius:8px!important;padding:8px 14px!important;font-weight:800!important;display:inline-flex!important;align-items:center!important;gap:7px!important;box-shadow:0 10px 24px rgba(239,68,68,.24)!important;cursor:pointer!important;white-space:nowrap!important}
      .v54-quick-toolbar-btn{height:52px!important;min-width:52px!important;padding:0 14px!important;border-radius:12px!important;align-self:stretch!important;justify-content:center!important}
      .v54-quick-toolbar-btn span{font-size:13px!important;line-height:1!important}
      .v54-pending-cat{border-color:#fed7aa!important;background:#fff7ed!important;color:#c2410c!important}
      .v54-pending-cat.active{background:#ea580c!important;color:#fff!important;border-color:#ea580c!important;box-shadow:0 8px 18px rgba(234,88,12,.18)!important}
      .v54-swal-popup{width:min(620px,calc(100vw - 24px))!important;border-radius:22px!important;padding:0!important;overflow:hidden!important;background:#f8fafc!important;box-shadow:0 34px 90px rgba(15,23,42,.24)!important}
      .v54-swal-popup .swal2-title{display:none!important}
      .v54-swal-popup .swal2-html-container{margin:0!important;padding:0!important;overflow:visible!important}
      .v54-swal-popup .swal2-actions{padding:0 30px 30px!important;margin:0!important;gap:12px!important;display:grid!important;grid-template-columns:1fr auto!important}
      .v54-swal-popup .swal2-confirm,.v54-swal-popup .swal2-cancel{height:54px!important;border-radius:14px!important;font-weight:950!important;font-size:15px!important;padding:0 24px!important;box-shadow:none!important}
      .v54-swal-popup .swal2-confirm{background:#dc2626!important;box-shadow:0 14px 28px rgba(220,38,38,.22)!important}
      .v54-swal-popup .swal2-cancel{background:#f1f5f9!important;color:#334155!important;border:1px solid #dbe6f3!important}
      .v54-swal-popup .swal2-validation-message{margin:14px 30px 0!important;border-radius:12px!important;background:#fff1f2!important;color:#be123c!important;font-weight:850!important}
      .v54-quick-shell{text-align:left;margin:0;color:#0f172a}
      .v54-quick-top{position:relative;padding:30px;background:linear-gradient(135deg,#0f172a 0%,#0f766e 58%,#dc2626 100%);color:#fff;overflow:hidden}
      .v54-quick-title{position:relative;display:flex;align-items:center;gap:14px}
      .v54-quick-title i{width:52px;height:52px;border-radius:15px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
      .v54-quick-title h2{margin:0;font-size:25px;line-height:1.12;color:#fff;font-weight:950;letter-spacing:0}
      .v54-quick-title p{margin:6px 0 0;color:rgba(255,255,255,.84);font-size:13px;line-height:1.5;font-weight:700}
      .v54-quick-body{padding:24px 30px 20px;background:#fff}
      .v54-quick-note{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:13px 14px;border:1px solid #fed7aa;background:#fff7ed;border-radius:14px;color:#9a3412;margin-bottom:16px}
      .v54-quick-note i{font-size:20px;color:#ea580c}
      .v54-quick-note b{display:block;font-size:13px;font-weight:900;color:#9a3412}
      .v54-quick-note span{display:block;font-size:12px;color:#c2410c;line-height:1.45;margin-top:2px}
      .v54-quick-total{margin-top:16px;padding:16px 17px;border:1px solid #fecaca;background:linear-gradient(135deg,#fff1f2,#fff);border-radius:16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .v54-quick-total span{font-size:12px;color:#64748b;font-weight:900}
      .v54-quick-total b{font-size:27px;color:#dc2626;font-weight:1000}
      .v54-pending-panel{margin:0 0 18px;background:#fff;border:1px solid #fed7aa;border-left:5px solid #f97316;border-radius:14px;box-shadow:0 12px 28px rgba(15,23,42,.06);overflow:hidden}
      .v54-pending-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:#fff7ed}
      .v54-pending-title{display:flex;align-items:center;gap:10px;color:#9a3412;font-weight:900}
      .v54-pending-list{display:grid;gap:10px;padding:14px 18px}
      .v54-pending-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;padding:12px;border:1px solid #ffedd5;border-radius:10px;background:#fff}
      .v54-pending-name{font-weight:900;color:#0f172a}
      .v54-pending-meta{font-size:12px;color:#64748b;margin-top:2px}
      .v54-pill{font-size:11px;font-weight:900;border-radius:999px;padding:5px 9px;background:#ffedd5;color:#c2410c;white-space:nowrap}
      .v54-mini{height:34px;border:0;border-radius:8px;background:#0f766e;color:#fff;font-weight:900;display:inline-flex;align-items:center;gap:5px;padding:0 11px;cursor:pointer}
      .v54-mini.danger{background:#fff1f2;color:#dc2626;border:1px solid #fecaca}
      .v54-mini.danger:hover{background:#fee2e2}
      .v54-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .v54-field{text-align:left}
      .v54-field label{display:block;font-size:12px;font-weight:950;color:#475569;margin:0 0 6px}
      .v54-field input,.v54-field select{width:100%;height:52px;border:1.5px solid #d7dee8;border-radius:14px;padding:0 15px;font:inherit;outline:none;background:#fff;color:#0f172a;font-weight:850;box-shadow:0 7px 18px rgba(15,23,42,.035)}
      .v54-field input::placeholder{color:#94a3b8;font-weight:700}
      .v54-field input:focus,.v54-field select:focus{border-color:#dc2626;box-shadow:0 0 0 4px rgba(220,38,38,.1)}
      .v54-calc{margin:14px 0 0;padding:13px 14px;border:1px solid #ccfbf1;background:#f0fdfa;border-radius:12px;color:#115e59;font-size:13px;font-weight:900;text-align:center}
      .v54-clear-summary{margin:0 0 16px;padding:14px 16px;border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;color:#9a3412}
      .v54-clear-summary strong{display:block;color:#0f172a;font-size:16px;margin-bottom:3px}
      .v54-clear-summary span{font-size:12px;font-weight:800;color:#c2410c}
      .v54-v38-pending-chip{border-color:#fed7aa!important;background:#fff7ed!important;color:#c2410c!important}
      .v54-v38-pending-chip.active{border-color:#ea580c!important;background:#ea580c!important;color:#fff!important;box-shadow:0 0 0 3px rgba(234,88,12,.16)!important}
      .v54-v38-pending-chip .v38-chip-dot{background:#ea580c!important}
      .v54-v38-pending-chip.active .v38-chip-dot{background:#fff!important}
      @media(max-width:720px){.v54-pending-row{grid-template-columns:1fr}.v54-form-grid{grid-template-columns:1fr}.v54-quick-btn{width:100%;justify-content:center}.v54-quick-toolbar-btn{height:42px!important;width:100%!important}.v54-quick-toolbar-btn span{display:inline!important}.v54-quick-top{padding:24px 22px}.v54-quick-body{padding:20px 22px 14px}}
    `;
    document.head.appendChild(style);
  }

  function setQuickPendingActions() {
    const page = document.getElementById('page-pos');
    if (!page || page.classList.contains('hidden')) return;
    document.querySelector('#page-actions [data-v54-quick]')?.remove();

    const toolbar = page.querySelector('.pos-toolbar');
    const searchBox = page.querySelector('.search-box');
    const viewToggle = page.querySelector('.view-toggle');
    if (toolbar && !toolbar.querySelector('[data-v54-quick-toolbar]') && !toolbar.querySelector('#v54-quick-inline-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'v54-quick-btn v54-quick-toolbar-btn';
      btn.dataset.v54QuickToolbar = '1';
      btn.title = 'เพิ่มสินค้าด่วน';
      btn.innerHTML = '<i class="material-icons-round" style="font-size:19px">add_shopping_cart</i><span>สินค้าด่วน</span>';
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        window.v54OpenQuickProductModal();
      });
      if (viewToggle) toolbar.insertBefore(btn, viewToggle);
      else if (searchBox) searchBox.insertAdjacentElement('afterend', btn);
      else toolbar.appendChild(btn);
    }

  }

  function installPendingCategoryTab() {
    const wrap = document.getElementById('pos-categories');
    if (!wrap) return;
    let tab = wrap.querySelector('[data-v54-pending-cat]');
    const count = pendingProducts().length;
    if (!tab) {
      tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'cat-tab v54-pending-cat';
      tab.dataset.v54PendingCat = '1';
      tab.dataset.cat = PENDING_CATEGORY;
      tab.addEventListener('click', event => {
        event.preventDefault();
        window.v54SetPendingCategory();
      });
      wrap.appendChild(tab);
    }
    tab.innerHTML = `<i class="material-icons-round" style="font-size:15px;vertical-align:-3px;margin-right:4px">pending_actions</i>${PENDING_CATEGORY}${count ? ` <b style="font-size:11px;margin-left:4px">${fmt(count)}</b>` : ''}`;
    tab.classList.toggle('active', window.__v54PendingCategoryActive === true);
  }

  window.v54SetPendingCategory = function () {
    window.__v54PendingCategoryActive = true;
    try { activeCategory = PENDING_CATEGORY; } catch (_) { }
    document.querySelectorAll('.cat-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset?.v54PendingCat === '1');
    });
    try { renderProductGrid?.(); } catch (_) { }
  };

  function addPendingToCart(product, qty = 1) {
    const list = activeCart();
    const existing = list.find(item => String(item.id) === String(product.id));
    if (existing) {
      existing.qty = money(existing.qty) + money(qty || 1);
    } else {
      list.push({
        id: product.id,
        name: product.name,
        price: money(product.price),
        cost: 0,
        qty: money(qty || 1),
        stock: 999999,
        unit: product.unit || 'ชิ้น',
        conv_rate: 1,
        is_mto: true,
        quick_pending: true
      });
    }
    syncCart(list);
    try { renderCart?.(); } catch (_) { }
    try { renderProductGrid?.(); } catch (_) { }
    try { sendToDisplay?.({ type: 'cart', cart: list, total: getCartTotal?.() || 0 }); } catch (_) { }
  }

  function findPossibleExistingProducts(name, barcode) {
    const n = norm(name);
    const b = String(barcode || '').trim();
    if (!n && !b) return [];
    return productList()
      .filter(product => {
        if (!product?.id) return false;
        const pb = String(product.barcode || '').trim();
        if (b && pb && pb === b) return true;
        const pn = norm(product.name);
        if (!n || !pn) return false;
        return pn === n || pn.includes(n) || n.includes(pn);
      })
      .slice(0, 8);
  }

  async function confirmUseExistingIfDuplicate(name, barcode) {
    const matches = findPossibleExistingProducts(name, barcode);
    if (!matches.length || typeof Swal === 'undefined') return null;
    const rows = matches.map(product => `
      <button type="button" class="v54-dup-row" onclick="window.__v54DupPick='${js(product.id)}';Swal.clickConfirm()">
        <span><b>${esc(product.name)}</b><small>${esc(product.barcode || '-')} · ฿${fmt(product.price)} · สต็อก ${fmt(product.stock || 0)} ${esc(product.unit || '')}</small></span>
        <i class="material-icons-round">add_shopping_cart</i>
      </button>
    `).join('');
    window.__v54DupPick = '';
    const result = await Swal.fire({
      title: 'อาจมีสินค้านี้อยู่แล้ว',
      html: `
        <style>
          .v54-dup-list{display:grid;gap:8px;text-align:left}
          .v54-dup-row{width:100%;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:11px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;text-align:left;font:inherit}
          .v54-dup-row:hover{border-color:#0f766e;background:#f0fdfa}
          .v54-dup-row b{display:block;color:#0f172a;font-size:14px}
          .v54-dup-row small{display:block;color:#64748b;font-size:12px;margin-top:2px}
          .v54-dup-row i{color:#0f766e}
        </style>
        <div style="text-align:left;color:#64748b;font-size:13px;margin-bottom:12px">เลือกสินค้าที่มีอยู่เพื่อใส่ตะกร้าแทน จะช่วยไม่ให้สร้างสินค้าซ้ำในคลัง</div>
        <div class="v54-dup-list">${rows}</div>
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'ใช้รายการที่เลือก',
      denyButtonText: 'สร้างสินค้าด่วนใหม่',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0f766e',
      denyButtonColor: '#ea580c',
      preConfirm: () => window.__v54DupPick || false
    });
    if (result.isConfirmed && result.value) {
      return matches.find(product => String(product.id) === String(result.value)) || null;
    }
    if (result.isDenied) return false;
    return 'cancel';
  }

  async function addQuickProductToDb(name, price, unit, barcode) {
    const payload = {
      name,
      barcode: barcode || null,
      price: money(price),
      cost: 0,
      stock: 0,
      min_stock: 0,
      unit: unit || 'ชิ้น',
      category: PENDING_CATEGORY,
      note: `${PENDING_MARK} เพิ่มจากหน้าขาย ${new Date().toLocaleString('th-TH')}`,
      product_type: 'ตามบิล',
      is_raw: false,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await db.from(PRODUCT_TABLE).insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  window.v54OpenQuickProductModal = async function () {
    injectStyle();
    if (typeof Swal === 'undefined') return;
    const result = await Swal.fire({
      title: 'เพิ่มสินค้าด่วน',
      customClass: { popup: 'v54-swal-popup' },
      html: `
        <div class="v54-quick-shell">
          <div class="v54-quick-top">
            <div class="v54-quick-title">
              <i class="material-icons-round">bolt</i>
              <div>
                <h2>เพิ่มสินค้าด่วน</h2>
                <p>ขายของที่ยังไม่มีในคลังได้ทันที แล้วกลับมาเคลียร์ข้อมูลจริงภายหลัง</p>
              </div>
            </div>
          </div>
          <div class="v54-quick-body">
            <div class="v54-quick-note">
              <i class="material-icons-round">pending_actions</i>
              <div>
                <b>ระบบจะติดป้ายรอเคลียร์ให้อัตโนมัติ</b>
                <span>เก็บชื่อ ราคาขาย และหน่วยก่อน จากนั้นไปกรอกบาร์โค้ด ต้นทุน และสต็อกจริงในหน้าคลัง</span>
              </div>
            </div>
            <div class="v54-field"><label>ชื่อสินค้า *</label><input id="v54-quick-name" autocomplete="off" placeholder="เช่น ข้อต่อ PVC หน้างาน"></div>
            <div class="v54-field" style="margin-top:12px"><label>บาร์โค้ด (ถ้ามี)</label><input id="v54-quick-barcode" autocomplete="off" inputmode="numeric" placeholder="ยิงบาร์โค้ดหรือพิมพ์เอง"></div>
            <div class="v54-form-grid" style="margin-top:12px">
              <div class="v54-field"><label>ราคาขาย *</label><input id="v54-quick-price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" oninput="v54QuickPreviewTotal()"></div>
              <div class="v54-field"><label>หน่วย *</label><input id="v54-quick-unit" list="v54-quick-unit-list" autocomplete="off" value="ชิ้น" placeholder="ชิ้น / กล่อง / เมตร"></div>
            </div>
            <datalist id="v54-quick-unit-list">
              <option value="ชิ้น"></option>
              <option value="กล่อง"></option>
              <option value="แพ็ค"></option>
              <option value="ถุง"></option>
              <option value="เส้น"></option>
              <option value="เมตร"></option>
              <option value="ชุด"></option>
            </datalist>
            <div class="v54-quick-total"><span>ราคาที่จะเข้าในตะกร้า</span><b id="v54-quick-preview">฿0</b></div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'เพิ่มเข้าตะกร้า',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0f766e',
      focusConfirm: false,
      preConfirm: () => {
        const name = document.getElementById('v54-quick-name')?.value.trim();
        const rawBarcode = document.getElementById('v54-quick-barcode')?.value.trim() || '';
        const barcode = (typeof window.v55NormalizeSmartCode === 'function' ? window.v55NormalizeSmartCode(rawBarcode) : rawBarcode) || null;
        const price = money(document.getElementById('v54-quick-price')?.value);
        const unit = document.getElementById('v54-quick-unit')?.value.trim() || 'ชิ้น';
        if (!name) return Swal.showValidationMessage('กรุณาระบุชื่อสินค้า');
        if (!Number.isFinite(price) || price <= 0) return Swal.showValidationMessage('กรุณาระบุราคาขายให้ถูกต้อง');
        if (!unit) return Swal.showValidationMessage('กรุณาระบุหน่วย');
        return { name, barcode, price, unit };
      }
    });
    if (!result.isConfirmed) return;
    try {
      const existing = await confirmUseExistingIfDuplicate(result.value.name, result.value.barcode);
      if (existing === 'cancel') return;
      if (existing) {
        try { await window.addToCart?.(existing.id); } catch (_) { addPendingToCart(existing, 1); }
        toast?.('ใช้สินค้าที่มีอยู่ในคลังแทนการสร้างใหม่แล้ว', 'success');
        return;
      }
      const product = await addQuickProductToDb(result.value.name, result.value.price, result.value.unit, result.value.barcode);
      await loadProducts?.();
      addPendingToCart(product, 1);
      toast?.('เพิ่มสินค้าด่วนเข้าตะกร้าแล้ว', 'success');
    } catch (e) {
      console.error('[v54] quick product:', e);
      toast?.('เพิ่มสินค้าด่วนไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  };

  window.v54QuickPreviewTotal = function () {
    const el = document.getElementById('v54-quick-preview');
    if (el) el.textContent = '฿' + fmt(money(document.getElementById('v54-quick-price')?.value));
  };

  async function pendingSaleSummary(productId) {
    const { data, error } = await db.from(BILL_ITEM_TABLE)
      .select('qty,price,total,cost')
      .eq('product_id', productId)
      .limit(5000);
    if (error) throw error;
    const rows = data || [];
    return rows.reduce((sum, item) => {
      const qty = money(item.qty);
      const total = money(item.total || (money(item.price) * qty));
      return {
        qty: sum.qty + qty,
        revenue: sum.revenue + total,
        oldCost: sum.oldCost + money(item.cost) * qty,
        rows: sum.rows + 1
      };
    }, { qty: 0, revenue: 0, oldCost: 0, rows: 0 });
  }

  window.v54ClearPendingProduct = async function (productId) {
    const product = productList().find(p => String(p.id) === String(productId));
    if (!product) return;
    let summary = { qty: 0, revenue: 0, oldCost: 0, rows: 0 };
    try { summary = await pendingSaleSummary(productId); } catch (e) { console.warn('[v54] summary:', e); }

    const categoryOptions = (Array.isArray(window.categories) ? window.categories : (typeof categories !== 'undefined' ? categories : []))
      .filter(c => String(c?.name || '').trim() && String(c.name).trim() !== PENDING_CATEGORY)
      .map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`)
      .join('');

    const content = `
      <form id="v54-clear-form">
        <div class="v54-clear-summary">
          <strong>${esc(product.name)}</strong>
          <span>ขายไปแล้ว ${fmt(summary.qty)} ${esc(product.unit || 'ชิ้น')} · ยอดขาย ฿${fmt(summary.revenue)} · ช่องสต็อกด้านล่างให้กรอก “จำนวนคงเหลือจริงหลังขายไปแล้ว”</span>
        </div>
        <div class="v54-form-grid">
          <div class="v54-field"><label>บาร์โค้ด</label><input id="v54-clear-barcode" value="${esc(product.barcode || '')}"></div>
          <div class="v54-field"><label>หมวดหมู่จริง *</label><select id="v54-clear-category"><option value="">-- เลือกหมวดหมู่จริง --</option>${categoryOptions}</select></div>
          <div class="v54-field"><label>ต้นทุน/หน่วย *</label><input id="v54-clear-cost" type="number" min="0" step="0.01" value="${esc(product.cost || '')}" oninput="v54UpdatePendingCalc('${js(productId)}')"></div>
          <div class="v54-field"><label>ราคาขาย</label><input id="v54-clear-price" type="number" min="0" step="0.01" value="${esc(product.price || 0)}"></div>
          <div class="v54-field"><label>สต็อกคงเหลือจริงหลังขาย *</label><input id="v54-clear-stock" type="number" min="0" step="0.0001" value="${esc(product.stock || 0)}"></div>
          <div class="v54-field"><label>สต็อกขั้นต่ำ</label><input id="v54-clear-min" type="number" min="0" step="0.0001" value="${esc(product.min_stock || 0)}"></div>
          <div class="v54-field"><label>หน่วย</label><input id="v54-clear-unit" value="${esc(product.unit || 'ชิ้น')}"></div>
          <div class="v54-field"><label>URL รูปภาพ</label><input id="v54-clear-img" value="${esc(product.img_url || '')}"></div>
        </div>
        <div class="v54-calc" id="v54-clear-calc">กรอกต้นทุนเพื่อคำนวณกำไรย้อนหลัง</div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px;">
          <i class="material-icons-round">save</i> บันทึกและคำนวณย้อนหลัง
        </button>
      </form>`;

    if (typeof openModal === 'function') {
      openModal('เคลียร์สินค้าด่วน', content);
    } else if (typeof Swal !== 'undefined') {
      await Swal.fire({ title: 'เคลียร์สินค้าด่วน', html: content, showConfirmButton: false, width: 760 });
    } else {
      return;
    }

    setTimeout(() => window.v54UpdatePendingCalc(productId, summary), 0);
    const form = document.getElementById('v54-clear-form');
    if (form) {
      form.onsubmit = async event => {
        event.preventDefault();
        const data = collectPendingClearData();
        if (!data) return;
        await savePendingClear(product, data, summary);
      };
    }
  };

  function collectPendingClearData() {
    const cost = money(document.getElementById('v54-clear-cost')?.value);
    const stock = money(document.getElementById('v54-clear-stock')?.value);
    const price = money(document.getElementById('v54-clear-price')?.value);
    if (!Number.isFinite(cost) || cost < 0) return toast?.('ต้นทุนต้องไม่ติดลบ', 'warning'), null;
    if (!Number.isFinite(stock) || stock < 0) return toast?.('สต็อกต้องไม่ติดลบ', 'warning'), null;
    if (!Number.isFinite(price) || price < 0) return toast?.('ราคาขายต้องไม่ติดลบ', 'warning'), null;
    const category = document.getElementById('v54-clear-category')?.value || '';
    if (!category || category === PENDING_CATEGORY) return toast?.('กรุณาเลือกหมวดหมู่จริงก่อนบันทึก', 'warning'), null;
    return {
      barcode: document.getElementById('v54-clear-barcode')?.value.trim() || null,
      category,
      cost,
      price,
      stock,
      min_stock: money(document.getElementById('v54-clear-min')?.value),
      unit: document.getElementById('v54-clear-unit')?.value.trim() || 'ชิ้น',
      img_url: document.getElementById('v54-clear-img')?.value.trim() || null
    };
  }

  window.v54UpdatePendingCalc = async function (productId, knownSummary) {
    const box = document.getElementById('v54-clear-calc');
    if (!box) return;
    let summary = knownSummary;
    if (!summary) {
      try { summary = await pendingSaleSummary(productId); } catch (_) { summary = { qty: 0, revenue: 0, oldCost: 0, rows: 0 }; }
    }
    const cost = money(document.getElementById('v54-clear-cost')?.value);
    const newCogs = summary.qty * cost;
    const profit = summary.revenue - newCogs;
    box.innerHTML = `รายการขายย้อนหลัง ${fmt(summary.rows)} บรรทัด · จำนวน ${fmt(summary.qty)} · ต้นทุนใหม่ ฿${fmt(newCogs)} · กำไรย้อนหลัง <b>฿${fmt(profit)}</b>`;
  };

  async function savePendingClear(product, data, summary) {
    try {
      const cleanNote = String(product.note || '').replace(PENDING_MARK, '').replace(/\s+/g, ' ').trim() || null;
      const { error } = await db.from(PRODUCT_TABLE).update({
        ...data,
        product_type: 'ปกติ',
        note: cleanNote,
        updated_at: new Date().toISOString()
      }).eq('id', product.id);
      if (error) throw error;

      const zeroCost = await db.from(BILL_ITEM_TABLE).update({ cost: data.cost }).eq('product_id', product.id).eq('cost', 0);
      if (zeroCost.error) throw zeroCost.error;
      const nullCost = await db.from(BILL_ITEM_TABLE).update({ cost: data.cost }).eq('product_id', product.id).is('cost', null);
      if (nullCost.error) throw nullCost.error;

      try {
        await db.from('stock_movement').insert({
          product_id: product.id,
          product_name: product.name,
          type: 'เคลียร์สินค้าด่วน',
          direction: 'in',
          qty: data.stock,
          stock_before: 0,
          stock_after: data.stock,
          staff_name: staffName(),
          note: `ตั้งสต็อกเป็นจำนวนคงเหลือจริงหลังขาย ไม่ใช่จำนวนก่อนขาย | ต้นทุนย้อนหลัง ${fmt(summary.qty)} ชิ้น x ฿${fmt(data.cost)}`
        });
      } catch (logErr) {
        console.warn('[v54] stock movement warn:', logErr);
      }
      try {
        if (typeof logActivity === 'function') {
          await logActivity('เคลียร์สินค้าด่วน', `${product.name} · ต้นทุน ฿${fmt(data.cost)} · กำไรย้อนหลัง ฿${fmt(summary.revenue - summary.qty * data.cost)}`, product.id, PRODUCT_TABLE);
        }
      } catch (_) { }

      await loadProducts?.();
      await renderInventory?.();
      installV38PendingChip();
      try { closeModal?.(); } catch (_) { }
      toast?.('เคลียร์สินค้าและอัปเดตกำไรย้อนหลังแล้ว', 'success');
      Swal.fire({
        icon: 'success',
        title: 'เคลียร์เรียบร้อย',
        html: `อัปเดตต้นทุนย้อนหลังแล้ว<br>กำไรย้อนหลังประมาณ <b>฿${fmt(summary.revenue - summary.qty * data.cost)}</b>`,
        confirmButtonColor: '#0f766e'
      });
    } catch (e) {
      console.error('[v54] clear pending:', e);
      toast?.('เคลียร์สินค้าไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  }

  window.v54DeletePendingProduct = async function (productId) {
    const product = productList().find(p => String(p.id) === String(productId));
    if (!product || !isPendingProduct(product)) return;
    if (!canManagePendingStock()) {
      denyPendingDelete();
      return;
    }

    let summary = { rows: 0, qty: 0, revenue: 0 };
    try {
      summary = await pendingSaleSummary(productId);
    } catch (e) {
      console.error('[v54] delete pending check:', e);
      toast?.('ตรวจรายการในบิลไม่สำเร็จ จึงยังไม่ลบสินค้า', 'error');
      return;
    }

    if (summary.rows > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ลบไม่ได้',
        html: `สินค้านี้ถูกใช้ในบิลแล้ว ${fmt(summary.rows)} รายการ<br>ขายไป ${fmt(summary.qty)} ${esc(product.unit || 'ชิ้น')} · ยอดขาย ฿${fmt(summary.revenue)}<br><b>ให้ใช้การเคลียร์สินค้าแทนการลบ</b>`,
        confirmButtonColor: '#dc2626'
      });
      return;
    }

    const inCart = activeCart().some(item => String(item.id) === String(productId));
    if (inCart) {
      toast?.('สินค้านี้ยังอยู่ในตะกร้า กรุณานำออกจากตะกร้าก่อนลบ', 'warning');
      return;
    }

    const r = await Swal.fire({
      icon: 'warning',
      title: `ลบ "${product.name}"?`,
      text: 'ลบได้เฉพาะสินค้ารอเคลียร์ที่ยังไม่เคยอยู่ในบิลเท่านั้น',
      showCancelButton: true,
      confirmButtonText: 'ลบรายการ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    });
    if (!r.isConfirmed) return;

    try {
      const { error } = await db.from(PRODUCT_TABLE).delete().eq('id', productId);
      if (error) throw error;
      try {
        if (typeof logActivity === 'function') {
          await logActivity('ลบสินค้าด่วนรอเคลียร์', product.name, product.id, PRODUCT_TABLE);
        }
      } catch (_) { }
      await loadProducts?.();
      await renderInventory?.();
      installV38PendingChip();
      toast?.('ลบสินค้ารอเคลียร์แล้ว', 'success');
    } catch (e) {
      console.error('[v54] delete pending:', e);
      toast?.('ลบสินค้าไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  };

  function renderPendingPanel() {
    injectStyle();
    const section = document.getElementById('page-inv');
    if (!section || section.classList.contains('hidden')) return;
    installV38PendingChip();
    document.getElementById('v54-pending-panel')?.remove();
    document.getElementById('v54-inv-quick-card')?.remove();
  }

  function installV38PendingChip() {
    const chips = document.querySelector('#page-inv .v38-chips');
    if (!chips) return;
    let chip = chips.querySelector('[data-v54-v38-pending]');
    const count = pendingProducts().length;
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'v38-chip v54-v38-pending-chip';
      chip.dataset.v54V38Pending = '1';
      chip.addEventListener('click', event => {
        event.preventDefault();
        window.v54FilterInventoryPending();
      });
      chips.appendChild(chip);
    }
    chip.innerHTML = `<span class="v38-chip-dot"></span>สินค้ารอเคลียร์ <b>${fmt(count)}</b>`;
  }

  window.v54FilterInventoryPending = function () {
    const list = pendingProducts();
    document.querySelectorAll('#page-inv .v38-chip').forEach(chip => chip.classList.remove('active'));
    document.querySelector('#page-inv [data-v54-v38-pending]')?.classList.add('active');
    const label = document.querySelector('#page-inv .v38-toolbar > div:last-child');
    if (label) label.textContent = `แสดง ${fmt(list.length)} จาก ${fmt(list.length)} รายการ · สินค้ารอเคลียร์`;
    const tbody = document.querySelector('#page-inv .v38-table tbody');
    if (!tbody) {
      window.v54ShowPendingInventoryList();
      return;
    }
    tbody.innerHTML = list.length ? list.map(product => `
      <tr>
        <td><div class="v38-img"><i class="material-icons-round">pending_actions</i></div></td>
        <td><strong>${esc(product.name || '')}</strong><small>รอเคลียร์ข้อมูลสินค้า · แก้ได้ครั้งเดียวตอนเคลียร์</small></td>
        <td class="mono">${esc(product.barcode || '-')}</td>
        <td><span class="v38-cat-badge" style="background:#fff7ed;color:#c2410c">สินค้ารอเคลียร์</span></td>
        <td class="right"><strong>฿${fmt(product.price)}</strong></td>
        <td class="right">฿${fmt(product.cost || 0)}</td>
        <td class="center"><span class="v38-stock warn">รอจัดการ</span></td>
        <td class="right"><div class="v38-actions">
          <button onclick="v54ClearPendingProduct('${js(product.id)}')" title="เคลียร์สินค้า"><i class="material-icons-round">edit_note</i></button>
          <button onclick="v54DeletePendingProduct('${js(product.id)}')" title="ลบสินค้ารอเคลียร์"><i class="material-icons-round">delete</i></button>
        </div></td>
      </tr>
    `).join('') : '<tr><td colspan="8"><div class="v38-empty">ยังไม่มีสินค้ารอเคลียร์</div></td></tr>';
  };

  window.v54InventoryPendingChipHtml = function () {
    const count = pendingProducts().length;
    return `<button type="button" onclick="v54FilterInventoryPending()" class="v38-chip v54-v38-pending-chip" data-v54-v38-pending="1">
      <span class="v38-chip-dot"></span>สินค้ารอเคลียร์ <b>${fmt(count)}</b>
    </button>`;
  };

  window.v54ShowPendingInventoryList = function () {
    const list = pendingProducts();
    if (typeof Swal === 'undefined') return;
    Swal.fire({
      title: 'สินค้าด่วนรอเคลียร์',
      customClass: { popup: 'v54-swal-popup' },
      html: `
        <div class="v54-quick-shell">
          <div class="v54-quick-top">
            <div class="v54-quick-title">
              <i class="material-icons-round">inventory_2</i>
              <div>
                <h2>รอเคลียร์คลัง</h2>
                <p>${list.length ? `มี ${fmt(list.length)} รายการที่ต้องใส่ต้นทุน บาร์โค้ด และสต็อกจริง` : 'ยังไม่มีสินค้าด่วนค้างจัดการ'}</p>
              </div>
            </div>
          </div>
          <div class="v54-quick-body">
            ${list.length ? list.map(product => `
              <div class="v54-pending-row" style="grid-template-columns:1fr auto auto;margin-bottom:10px">
                <div>
                  <div class="v54-pending-name">${esc(product.name)}</div>
                  <div class="v54-pending-meta">ราคาขาย ฿${fmt(product.price)} · หน่วย ${esc(product.unit || 'ชิ้น')}</div>
                </div>
                <button class="v54-mini" onclick="Swal.close();v54ClearPendingProduct('${js(product.id)}')">
                  <i class="material-icons-round" style="font-size:16px">edit_note</i>เคลียร์
                </button>
                <button class="v54-mini danger" onclick="Swal.close();v54DeletePendingProduct('${js(product.id)}')">
                  <i class="material-icons-round" style="font-size:16px">delete</i>ลบ
                </button>
              </div>
            `).join('') : `<div style="padding:22px;text-align:center;color:#64748b;font-weight:900;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px">ยังไม่มีสินค้ารอเคลียร์</div>`}
          </div>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      width: 620
    });
  };

  function renderPendingProductGrid() {
    const container = document.getElementById('pos-product-grid');
    if (!container) return;
    const searchTerm = String(document.getElementById('pos-search')?.value || '').toLowerCase();
    const viewMode = document.querySelector('.view-btn.active')?.dataset?.view || 'grid';
    const list = pendingProducts().filter(p => {
      const hay = [p.name, p.barcode, p.category, p.unit].filter(Boolean).join(' ').toLowerCase();
      return !searchTerm || hay.includes(searchTerm);
    });
    const countEl = document.getElementById('products-count');
    if (countEl) countEl.textContent = `รอเคลียร์ ${fmt(list.length)} รายการ`;
    if (viewMode === 'list') {
      container.className = 'product-list';
      container.innerHTML = list.length ? list.map(p => `
        <div class="product-list-item" onclick="addToCart('${js(p.id)}')">
          <div class="product-list-img"><i class="material-icons-round">pending_actions</i></div>
          <div class="product-list-info">
            <div class="product-name">${esc(p.name)}</div>
            <div class="product-sku">รอเคลียร์ · ${esc(p.unit || 'ชิ้น')}</div>
          </div>
          <div class="product-list-right"><span class="product-price">฿${fmt(p.price)}</span><span class="product-stock low">รอเคลียร์</span></div>
        </div>
      `).join('') : `<div style="padding:30px;text-align:center;color:#94a3b8;font-weight:800">ไม่มีสินค้ารอเคลียร์</div>`;
      return;
    }
    container.className = 'product-grid';
    container.innerHTML = list.length ? list.map(p => `
      <div class="product-card" onclick="addToCart('${js(p.id)}')">
        <div class="product-img"><i class="material-icons-round">pending_actions</i><span class="product-badge" style="background:#ea580c">รอ</span></div>
        <div class="product-info">
          <div class="product-name">${esc(p.name)}</div>
          <div class="product-sku">รอเคลียร์ · ${esc(p.unit || 'ชิ้น')}</div>
          <div class="product-footer"><span class="product-price">฿${fmt(p.price)}</span><span class="product-stock low">รอเคลียร์</span></div>
        </div>
      </div>
    `).join('') : `<div style="grid-column:1/-1;padding:40px;text-align:center;color:#94a3b8;font-weight:800">ไม่มีสินค้ารอเคลียร์</div>`;
  }

  function installHooks() {
    injectStyle();

    const originalRenderGrid = window.renderProductGrid;
    if (typeof originalRenderGrid === 'function' && !originalRenderGrid.__v54quick) {
      window.renderProductGrid = function () {
        if (window.__v54PendingCategoryActive === true) {
          setQuickPendingActions();
          installPendingCategoryTab();
          renderPendingProductGrid();
          return;
        }
        const result = originalRenderGrid.apply(this, arguments);
        setQuickPendingActions();
        installPendingCategoryTab();
        return result;
      };
      window.renderProductGrid.__v54quick = true;
      try { renderProductGrid = window.renderProductGrid; } catch (_) { }
    }

    const originalRenderInventory = window.renderInventory;
    if (typeof originalRenderInventory === 'function' && !originalRenderInventory.__v54pending) {
      window.renderInventory = async function () {
        const result = await originalRenderInventory.apply(this, arguments);
        renderPendingPanel();
        return result;
      };
      window.renderInventory.__v54pending = true;
      try { renderInventory = window.renderInventory; } catch (_) { }
    }

    const originalV38Install = window.v38InstallCategoryDashboard;
    if (typeof originalV38Install === 'function' && !originalV38Install.__v54pendingAfter) {
      window.v38InstallCategoryDashboard = function () {
        const result = originalV38Install.apply(this, arguments);
        setTimeout(() => {
          try { installHooks(); } catch (_) { }
          try { renderPendingPanel(); } catch (_) { }
          try { installV38PendingChip(); } catch (_) { }
        }, 0);
        return result;
      };
      window.v38InstallCategoryDashboard.__v54pendingAfter = true;
    }

    const originalAddToCart = window.addToCart;
    if (typeof originalAddToCart === 'function' && !originalAddToCart.__v54pending) {
      window.addToCart = async function (productId) {
        const product = productList().find(p => String(p.id) === String(productId));
        if (isPendingProduct(product)) {
          addPendingToCart(product, 1);
          return;
        }
        return originalAddToCart.apply(this, arguments);
      };
      window.addToCart.__v54pending = true;
      try { addToCart = window.addToCart; } catch (_) { }
    }

    const originalFilterByCategory = window.filterByCategory;
    if (typeof originalFilterByCategory === 'function' && !originalFilterByCategory.__v54pendingCat) {
      window.filterByCategory = function (cat) {
        window.__v54PendingCategoryActive = String(cat || '') === PENDING_CATEGORY;
        const result = originalFilterByCategory.apply(this, arguments);
        installPendingCategoryTab();
        return result;
      };
      window.filterByCategory.__v54pendingCat = true;
      try { filterByCategory = window.filterByCategory; } catch (_) { }
    }

    setQuickPendingActions();
    installPendingCategoryTab();
    renderPendingPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installHooks);
  } else {
    installHooks();
  }
  [120, 400, 900, 1400, 2100, 3300, 4600, 6200].forEach(delay => {
    setTimeout(() => {
      installHooks();
      renderPendingPanel();
      installV38PendingChip();
    }, delay);
  });
})();
