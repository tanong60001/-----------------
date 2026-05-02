(function () {
  'use strict';

  console.log('[v49] admin commission, sales UI, image frame, product audit loaded');

  const TIER_KEY = 'sk_staff_commission_tiers_v48';
  const TABLE = {
    product: 'สินค้า',
    shop: 'ตั้งค่าร้านค้า',
    log: 'log_กิจกรรม',
    stock: 'stock_movement',
  };

  const money = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const fmt = value => typeof formatNum === 'function'
    ? formatNum(value)
    : money(value).toLocaleString('th-TH');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));

  const js = value => String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');

  function userName() {
    try { return USER?.username || 'system'; } catch (_) { return 'system'; }
  }

  function injectStyle() {
    let style = document.getElementById('v49-admin-commission-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'v49-admin-commission-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      #pos-product-grid .product-card{min-height:unset!important}
      #pos-product-grid .product-card .product-img{
        height:100px!important;
        min-height:0!important;
        aspect-ratio:auto!important;
        flex:0 0 100px!important;
        overflow:hidden!important;
        background:#f8fafc!important;
      }
      #pos-product-grid .product-card:hover .product-img{transform:none!important}
      #pos-product-grid .product-card .product-img img{
        width:100%!important;
        height:100%!important;
        min-width:100%!important;
        min-height:100%!important;
        object-fit:fill!important;
        object-position:center!important;
        transform:none!important;
        display:block!important;
      }

      #page-att .v48-sales{background:linear-gradient(135deg,#f8fbff 0%,#fff7ed 46%,#f0fdf4 100%);border-radius:18px;padding:18px 18px 46px!important}
      #page-att .v48-sales-hero{border:0!important;background:linear-gradient(135deg,#1d4ed8 0%,#0f766e 52%,#f97316 100%)!important;color:#fff!important;box-shadow:0 22px 48px rgba(15,23,42,.18)!important}
      #page-att .v48-sales-title p,#page-att .v48-sales-title h2{color:#fff!important}
      #page-att .v48-sales-title p{opacity:.86!important}
      #page-att .v48-sales-icon{background:rgba(255,255,255,.18)!important;color:#fff!important;border:1px solid rgba(255,255,255,.28)!important}
      #page-att .v48-sales-actions .v48-btn,#page-att .v48-sales-actions .v48-month{background:rgba(255,255,255,.94)!important;border-color:rgba(255,255,255,.42)!important;color:#0f172a!important}
      #page-att .v48-sales-actions [onclick*="v48OpenCommissionSettings"]{display:none!important}
      #page-att .v48-stat:nth-child(1){border-color:#bfdbfe;background:linear-gradient(180deg,#eff6ff,#fff)}
      #page-att .v48-stat:nth-child(2){border-color:#fed7aa;background:linear-gradient(180deg,#fff7ed,#fff)}
      #page-att .v48-stat:nth-child(3){border-color:#bbf7d0;background:linear-gradient(180deg,#f0fdf4,#fff)}
      #page-att .v48-stat:nth-child(4){border-color:#ddd6fe;background:linear-gradient(180deg,#f5f3ff,#fff)}
      #page-att .v48-panel{border:0!important;box-shadow:0 14px 34px rgba(15,23,42,.08)!important}
      #page-att .v48-panel-head{background:linear-gradient(90deg,#f8fafc,#fff)!important}

      .v49-admin-tab{padding:12px 18px;border:none;background:none;cursor:pointer;font-family:var(--font-thai);font-size:14px;border-bottom:2px solid transparent;color:var(--text-secondary);font-weight:400;display:flex;align-items:center;gap:6px;white-space:nowrap}
      .v49-admin-tab.active{border-bottom-color:#7c3aed;color:#7c3aed;font-weight:800}
      .v49-comm-page{max-width:1180px;margin:0 auto 42px;color:#0f172a}
      .v49-comm-hero{border-radius:20px;padding:24px;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 44%,#0f766e 100%);color:#fff;box-shadow:0 24px 54px rgba(30,64,175,.22);display:flex;gap:18px;justify-content:space-between;align-items:center;flex-wrap:wrap}
      .v49-comm-hero h2{margin:0;font-size:28px;font-weight:950;color:#fff}
      .v49-comm-hero p{margin:5px 0 0;color:rgba(255,255,255,.84);font-weight:800}
      .v49-comm-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.26);padding:7px 11px;font-size:12px;font-weight:950;color:#fff}
      .v49-comm-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr);gap:16px;margin-top:16px}
      .v49-comm-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 16px 36px rgba(15,23,42,.08);overflow:hidden}
      .v49-comm-card-head{padding:16px 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(90deg,#f8fafc,#fff)}
      .v49-comm-card-head strong{font-size:16px;font-weight:950}
      .v49-comm-body{padding:18px}
      .v49-tier-row{display:grid;grid-template-columns:1fr 1fr 42px;gap:10px;margin-bottom:10px;align-items:center}
      .v49-input{height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font-family:inherit;font-weight:850;color:#0f172a;background:#fff}
      .v49-btn{height:40px;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:10px;padding:0 13px;font-family:inherit;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:6px;justify-content:center}
      .v49-btn.primary{background:#2563eb;border-color:#2563eb;color:#fff}
      .v49-btn.purple{background:#7c3aed;border-color:#7c3aed;color:#fff}
      .v49-btn.danger{border-color:#fecaca;color:#dc2626;background:#fff5f5}
      .v49-preview{display:grid;gap:10px}
      .v49-preview-row{border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:linear-gradient(135deg,#ffffff,#f8fafc);display:flex;justify-content:space-between;gap:12px;align-items:center}
      .v49-preview-row:nth-child(2){border-color:#fed7aa;background:linear-gradient(135deg,#fff7ed,#fff)}
      .v49-preview-row:nth-child(3){border-color:#bbf7d0;background:linear-gradient(135deg,#f0fdf4,#fff)}
      .v49-preview-row span{display:block;color:#64748b;font-size:12px;font-weight:900}
      .v49-preview-row strong{font-size:20px;font-weight:950}
      .v49-note{border-radius:16px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;padding:14px 16px;font-weight:850;line-height:1.55}
      @media(max-width:900px){.v49-comm-grid{grid-template-columns:1fr}.v49-tier-row{grid-template-columns:1fr 1fr 42px}}
      @media(max-width:560px){.v49-tier-row{grid-template-columns:1fr}.v49-tier-row .v49-btn{width:100%}.v49-comm-hero h2{font-size:23px}}
    `;
  }

  function normalizeTiers(rows) {
    return (rows || [])
      .map(row => ({ threshold: money(row.threshold), rate: money(row.rate) }))
      .filter(row => row.threshold >= 0 && row.rate >= 0)
      .sort((a, b) => a.threshold - b.threshold);
  }

  function defaultTiers() {
    return [{ threshold: 500000, rate: 0.5 }, { threshold: 1000000, rate: 1 }];
  }

  async function readCommissionTiers() {
    try {
      const { data, error } = await db.from(TABLE.shop).select('doc_settings').limit(1).maybeSingle();
      if (error) throw error;
      const ds = typeof data?.doc_settings === 'string' ? JSON.parse(data.doc_settings || '{}') : (data?.doc_settings || {});
      const tiers = normalizeTiers(ds.staff_commission_tiers);
      if (tiers.length) {
        localStorage.setItem(TIER_KEY, JSON.stringify(tiers));
        return tiers;
      }
    } catch (e) {
      console.warn('[v49] read commission settings fallback:', e?.message || e);
    }
    try {
      const local = normalizeTiers(JSON.parse(localStorage.getItem(TIER_KEY) || '[]'));
      if (local.length) return local;
    } catch (_) {}
    return defaultTiers();
  }

  async function saveCommissionTiers(tiers) {
    const normalized = normalizeTiers(tiers);
    localStorage.setItem(TIER_KEY, JSON.stringify(normalized));
    try {
      const { data: row, error } = await db.from(TABLE.shop).select('id,doc_settings').limit(1).maybeSingle();
      if (error) throw error;
      const ds = typeof row?.doc_settings === 'string' ? JSON.parse(row.doc_settings || '{}') : (row?.doc_settings || {});
      const payload = { doc_settings: { ...ds, staff_commission_tiers: normalized }, updated_at: new Date().toISOString(), updated_by: userName() };
      if (row?.id) await db.from(TABLE.shop).update(payload).eq('id', row.id);
      else await db.from(TABLE.shop).insert(payload);
    } catch (e) {
      console.warn('[v49] save commission settings fallback:', e?.message || e);
    }
    await writeActivity('ตั้งค่าคอมมิชชั่น', `แก้ไขขั้นคอม ${normalized.map(t => `฿${fmt(t.threshold)}=${fmt(t.rate)}%`).join(', ')}`);
    return normalized;
  }

  function commissionFor(total, tiers) {
    const tier = (tiers || []).reduce((best, row) => money(total) >= row.threshold ? row : best, { threshold: 0, rate: 0 });
    return { tier, commission: money(total) * money(tier.rate) / 100 };
  }

  function tierRowsHTML(tiers) {
    return normalizeTiers(tiers).map(row => `
      <div class="v49-tier-row">
        <input class="v49-input" type="number" min="0" step="1000" value="${row.threshold}" data-v49-threshold placeholder="ยอดขายตั้งแต่">
        <input class="v49-input" type="number" min="0" step="0.01" value="${row.rate}" data-v49-rate placeholder="% คอม">
        <button type="button" class="v49-btn danger" onclick="this.closest('.v49-tier-row').remove();v49RefreshCommissionPreview()"><i class="material-icons-round">delete</i></button>
      </div>`).join('');
  }

  function readTierInputs() {
    return normalizeTiers(Array.from(document.querySelectorAll('#v49-tier-rows .v49-tier-row')).map(row => ({
      threshold: row.querySelector('[data-v49-threshold]')?.value,
      rate: row.querySelector('[data-v49-rate]')?.value,
    })));
  }

  window.v49RefreshCommissionPreview = function () {
    const tiers = readTierInputs();
    const box = document.getElementById('v49-comm-preview');
    if (!box) return;
    const samples = [300000, 500000, 1000000, 1500000];
    box.innerHTML = samples.map(total => {
      const calc = commissionFor(total, tiers);
      return `<div class="v49-preview-row"><div><span>ยอดขายตัวอย่าง</span><strong>฿${fmt(total)}</strong></div><div style="text-align:right"><span>คอม ${fmt(calc.tier.rate)}%</span><strong>฿${fmt(Math.round(calc.commission))}</strong></div></div>`;
    }).join('');
  };

  window.v49AddCommissionTier = function () {
    const box = document.getElementById('v49-tier-rows');
    box?.insertAdjacentHTML('beforeend', `
      <div class="v49-tier-row">
        <input class="v49-input" type="number" min="0" step="1000" value="0" data-v49-threshold placeholder="ยอดขายตั้งแต่">
        <input class="v49-input" type="number" min="0" step="0.01" value="0" data-v49-rate placeholder="% คอม">
        <button type="button" class="v49-btn danger" onclick="this.closest('.v49-tier-row').remove();v49RefreshCommissionPreview()"><i class="material-icons-round">delete</i></button>
      </div>`);
    bindCommissionInputs();
    window.v49RefreshCommissionPreview();
  };

  window.v49SaveCommissionSettings = async function () {
    const tiers = readTierInputs();
    if (!tiers.length) {
      if (typeof toast === 'function') toast('กรุณาเพิ่มขั้นคอมอย่างน้อย 1 รายการ', 'warning');
      return;
    }
    await saveCommissionTiers(tiers);
    if (typeof toast === 'function') toast('บันทึกตั้งค่าคอมมิชชั่นแล้ว', 'success');
    renderCommissionAdminPage();
  };

  function bindCommissionInputs() {
    document.querySelectorAll('#v49-tier-rows input').forEach(input => {
      input.oninput = window.v49RefreshCommissionPreview;
    });
  }

  async function renderCommissionAdminPage() {
    if (USER?.role !== 'admin') {
      if (typeof toast === 'function') toast('หน้านี้สำหรับผู้ดูแลระบบเท่านั้น', 'warning');
      return;
    }
    const container = document.getElementById('admin-tab-content') || document.getElementById('page-admin');
    if (!container) return;
    injectStyle();
    setAdminCommissionTabActive();
    const tiers = await readCommissionTiers();
    container.innerHTML = `
      <div class="v49-comm-page">
        <div class="v49-comm-hero">
          <div>
            <span class="v49-comm-badge"><i class="material-icons-round">admin_panel_settings</i> ผู้ดูแลระบบเท่านั้น</span>
            <h2>ตั้งค่าคอมมิชชั่นพนักงาน</h2>
            <p>กำหนดขั้นคอมตามยอดขายรายเดือน ค่านี้จะถูกใช้ในหน้ายอดขายพนักงานแบบอัตโนมัติ</p>
          </div>
          <button class="v49-btn" onclick="renderAdmin()"><i class="material-icons-round">arrow_back</i> กลับเมนูผู้ดูแล</button>
          <button class="v49-btn" onclick="go('att');setTimeout(()=>renderStaffSalesDashboard?.(),120)"><i class="material-icons-round">leaderboard</i> ดูยอดขายพนักงาน</button>
        </div>
        <div class="v49-comm-grid">
          <div class="v49-comm-card">
            <div class="v49-comm-card-head">
              <strong>ขั้นคอมมิชชั่น</strong>
              <button class="v49-btn purple" onclick="v49AddCommissionTier()"><i class="material-icons-round">add</i> เพิ่มขั้น</button>
            </div>
            <div class="v49-comm-body">
              <div id="v49-tier-rows">${tierRowsHTML(tiers)}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
                <button class="v49-btn primary" onclick="v49SaveCommissionSettings()"><i class="material-icons-round">save</i> บันทึก</button>
                <button class="v49-btn" onclick="v49ResetDefaultCommission()"><i class="material-icons-round">restart_alt</i> ค่าเริ่มต้น</button>
              </div>
            </div>
          </div>
          <div class="v49-comm-card">
            <div class="v49-comm-card-head"><strong>ตัวอย่างการคำนวณ</strong><span style="color:#64748b;font-size:12px;font-weight:900">อัปเดตทันทีเมื่อแก้ตัวเลข</span></div>
            <div class="v49-comm-body">
              <div id="v49-comm-preview" class="v49-preview"></div>
              <div class="v49-note" style="margin-top:14px">บิลโครงการและบิลยกเลิกจะไม่ถูกนำมาคิดยอดขายพนักงาน เพื่อไม่ให้คอมมิชชั่นปนกับต้นทุนโครงการหรือรายการที่ไม่ใช่ยอดขายจริง</div>
            </div>
          </div>
        </div>
      </div>`;
    bindCommissionInputs();
    window.v49RefreshCommissionPreview();
  }

  window.v49RenderCommissionAdmin = renderCommissionAdminPage;
  window.v49ResetDefaultCommission = async function () {
    await saveCommissionTiers(defaultTiers());
    if (typeof toast === 'function') toast('ตั้งค่าคอมกลับเป็นค่าเริ่มต้นแล้ว', 'success');
    renderCommissionAdminPage();
  };

  function setAdminCommissionTabActive() {
    document.querySelectorAll('[id^="admin-tab-"], .v49-admin-tab').forEach(btn => {
      btn.style.borderBottomColor = 'transparent';
      btn.style.color = 'var(--text-secondary)';
      btn.style.fontWeight = '400';
      btn.classList.remove('active');
    });
    const tab = document.getElementById('admin-tab-commission');
    if (tab) tab.classList.add('active');
  }

  function injectAdminCommissionTab() {
    const tabRow = document.querySelector('#page-admin [id^="admin-tab-"]')?.parentElement;
    if (!tabRow || document.getElementById('admin-tab-commission')) return;
    const btn = document.createElement('button');
    btn.id = 'admin-tab-commission';
    btn.type = 'button';
    btn.className = 'v49-admin-tab';
    btn.innerHTML = '<i class="material-icons-round" style="font-size:17px">workspace_premium</i> ตั้งค่าคอม';
    btn.onclick = renderCommissionAdminPage;
    tabRow.appendChild(btn);
  }

  function installAdminPatch() {
    const original = window.renderAdmin;
    if (typeof original === 'function' && !original.__v49Commission) {
      window.renderAdmin = async function () {
        const result = await original.apply(this, arguments);
        setTimeout(injectAdminCommissionTab, 50);
        setTimeout(injectAdminCommissionTab, 350);
        return result;
      };
      window.renderAdmin.__v49Commission = true;
      try { renderAdmin = window.renderAdmin; } catch (_) {}
    }
    const originalTabs = window.renderAdminTabs;
    if (typeof originalTabs === 'function' && !originalTabs.__v49Commission) {
      window.renderAdminTabs = async function () {
        const result = await originalTabs.apply(this, arguments);
        setTimeout(injectAdminCommissionTab, 40);
        return result;
      };
      window.renderAdminTabs.__v49Commission = true;
      try { renderAdminTabs = window.renderAdminTabs; } catch (_) {}
    }
    injectAdminCommissionTab();
  }

  function removeStaffCommissionButton() {
    document.querySelectorAll('#page-att [onclick*="v48OpenCommissionSettings"]').forEach(el => el.remove());
  }

  function installStaffSalesPatch() {
    if (typeof window.v48OpenCommissionSettings === 'function' && !window.v48OpenCommissionSettings.__v49AdminOnly) {
      window.v48OpenCommissionSettings = async function () {
        if (USER?.role !== 'admin') {
          if (typeof toast === 'function') toast('ตั้งค่าคอมมิชชั่นได้เฉพาะผู้ดูแลระบบ', 'warning');
          return;
        }
        go('admin');
        setTimeout(renderCommissionAdminPage, 150);
      };
      window.v48OpenCommissionSettings.__v49AdminOnly = true;
    }
    const original = window.renderStaffSalesDashboard;
    if (typeof original === 'function' && !original.__v49NoSettings) {
      window.renderStaffSalesDashboard = async function () {
        const result = await original.apply(this, arguments);
        removeStaffCommissionButton();
        return result;
      };
      window.renderStaffSalesDashboard.__v49NoSettings = true;
    }
    removeStaffCommissionButton();
  }

  async function writeActivity(type, details, refId = null, refTable = null) {
    try {
      if (typeof logActivity === 'function') {
        await logActivity(type, details, refId, refTable);
        return;
      }
    } catch (_) {}
    try {
      await db.from(TABLE.log).insert({ type, details, ref_id: refId, ref_table: refTable, username: userName(), time: new Date().toISOString() });
    } catch (e) {
      console.warn('[v49] activity log failed:', e);
    }
  }

  async function getProductById(id) {
    if (!id) return null;
    try {
      const { data } = await db.from(TABLE.product).select('*').eq('id', id).maybeSingle();
      return data || null;
    } catch (_) {
      return (Array.isArray(window.products) ? window.products : []).find(p => String(p.id) === String(id)) || null;
    }
  }

  async function findCreatedProduct(snapshot) {
    try {
      let q = db.from(TABLE.product).select('*');
      if (snapshot.barcode) q = q.eq('barcode', snapshot.barcode);
      else q = q.eq('name', snapshot.name || '');
      const { data } = await q.order('updated_at', { ascending: false }).limit(1);
      return (data || [])[0] || null;
    } catch (_) {
      return null;
    }
  }

  function formSnapshot() {
    return {
      id: document.getElementById('prod-id')?.value || '',
      name: document.getElementById('prod-name')?.value || '',
      barcode: document.getElementById('prod-barcode')?.value || '',
      price: money(document.getElementById('prod-price')?.value),
      cost: money(document.getElementById('prod-cost')?.value),
      stock: money(document.getElementById('prod-stock')?.value),
      min_stock: money(document.getElementById('prod-min-stock')?.value),
      unit: document.getElementById('prod-unit')?.value || '',
      category: document.getElementById('prod-category')?.value || '',
      note: document.getElementById('prod-note')?.value || '',
      img_url: document.getElementById('prod-img')?.value || '',
    };
  }

  function diffProducts(before, after) {
    const fields = [
      ['name', 'ชื่อ'],
      ['barcode', 'บาร์โค้ด'],
      ['price', 'ราคา'],
      ['cost', 'ต้นทุน'],
      ['stock', 'สต็อก'],
      ['min_stock', 'ขั้นต่ำ'],
      ['unit', 'หน่วย'],
      ['category', 'หมวด'],
      ['img_url', 'รูป'],
    ];
    return fields.filter(([key]) => String(before?.[key] ?? '') !== String(after?.[key] ?? '')).map(([key, label]) => {
      const a = key === 'img_url' ? (before?.[key] ? 'มีรูป' : 'ไม่มีรูป') : (before?.[key] ?? '-');
      const b = key === 'img_url' ? (after?.[key] ? 'มีรูป' : 'ไม่มีรูป') : (after?.[key] ?? '-');
      return `${label} ${a}→${b}`;
    });
  }

  async function logStockMovementFromEdit(product, beforeStock, afterStock) {
    const delta = money(afterStock) - money(beforeStock);
    if (!delta || !product?.id) return;
    try {
      await db.from(TABLE.stock).insert({
        product_id: product.id,
        product_name: product.name || '',
        type: 'แก้ไขสินค้า',
        direction: delta >= 0 ? 'in' : 'out',
        qty: Math.abs(delta),
        stock_before: money(beforeStock),
        stock_after: money(afterStock),
        staff_name: userName(),
        note: 'เปลี่ยนจำนวนสต็อกจากฟอร์มแก้ไขสินค้า',
      });
    } catch (e) {
      console.warn('[v49] stock movement audit failed:', e);
    }
  }

  function installProductAudit() {
    const saveOriginal = window.saveProduct;
    if (typeof saveOriginal === 'function' && !saveOriginal.__v49Audit) {
      window.saveProduct = async function () {
        const snap = formSnapshot();
        const before = snap.id ? await getProductById(snap.id) : null;
        const result = await saveOriginal.apply(this, arguments);
        const after = snap.id ? await getProductById(snap.id) : await findCreatedProduct(snap);
        if (snap.id && before && after) {
          const changes = diffProducts(before, after);
          if (changes.length) {
            await writeActivity('แก้ไขสินค้า', `"${after.name || before.name}" | ${changes.join(', ')}`, after.id, TABLE.product);
            await logStockMovementFromEdit(after, before.stock, after.stock);
          }
        } else if (!snap.id && after) {
          await writeActivity('เพิ่มสินค้า', `"${after.name}" | ราคา ฿${fmt(after.price)} | สต็อก ${fmt(after.stock)} ${after.unit || ''}`, after.id, TABLE.product);
          if (money(after.stock) > 0) await logStockMovementFromEdit(after, 0, after.stock);
        }
        return result;
      };
      window.saveProduct.__v49Audit = true;
      try { saveProduct = window.saveProduct; } catch (_) {}
    }

    const adjustOriginal = window.adjustStock;
    if (typeof adjustOriginal === 'function' && !adjustOriginal.__v49Audit) {
      window.adjustStock = async function (productId) {
        const before = await getProductById(productId);
        const result = await adjustOriginal.apply(this, arguments);
        const after = await getProductById(productId);
        if (before && after && money(before.stock) !== money(after.stock)) {
          const delta = money(after.stock) - money(before.stock);
          await writeActivity('ปรับสต็อกสินค้า', `"${after.name || before.name}" | ${fmt(before.stock)} → ${fmt(after.stock)} (${delta >= 0 ? 'เพิ่ม' : 'ลด'} ${fmt(Math.abs(delta))})`, productId, TABLE.product);
        }
        return result;
      };
      window.adjustStock.__v49Audit = true;
      try { adjustStock = window.adjustStock; } catch (_) {}
    }

    const deleteOriginal = window.deleteProduct;
    if (typeof deleteOriginal === 'function' && !deleteOriginal.__v49Audit) {
      window.deleteProduct = async function (productId) {
        const before = await getProductById(productId);
        const result = await deleteOriginal.apply(this, arguments);
        const after = await getProductById(productId);
        if (before && !after) {
          await writeActivity('ลบสินค้า', `"${before.name}" | บาร์โค้ด ${before.barcode || '-'} | สต็อกก่อนลบ ${fmt(before.stock)}`, productId, TABLE.product);
        }
        return result;
      };
      window.deleteProduct.__v49Audit = true;
      try { deleteProduct = window.deleteProduct; } catch (_) {}
    }
  }

  function installObserver() {
    if (window.__v49Observer) return;
    window.__v49Observer = new MutationObserver(() => {
      removeStaffCommissionButton();
      injectAdminCommissionTab();
    });
    window.__v49Observer.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    injectStyle();
    installAdminPatch();
    installStaffSalesPatch();
    installProductAudit();
    installObserver();
    [250, 800, 1800, 3600, 7000].forEach(delay => setTimeout(() => {
      injectStyle();
      installAdminPatch();
      installStaffSalesPatch();
      installProductAudit();
    }, delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
