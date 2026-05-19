'use strict';
console.log('[v38] Category dashboard loaded');

(function () {
  const TABLE = {
    product: 'สินค้า',
    bill: 'บิลขาย',
    billItem: 'รายการในบิล',
    category: 'categories',
  };

  const NO_CATEGORY = '__none__';
  const ALL_CATEGORY = '__all__';

  const state = {
    category: ALL_CATEGORY,
    stock: 'all',
    search: '',
    limit: 20,
    limitKey: '',
    salesCache: null,
    salesCacheAt: 0,
  };

  function money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(value) {
    return typeof formatNum === 'function'
      ? formatNum(value)
      : money(value).toLocaleString('th-TH');
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function js(value) {
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, ' ');
  }

  function categoryName(product) {
    return String(product?.category || '').trim() || 'ไม่ระบุหมวด';
  }

  function categoryKeyFromName(name) {
    return String(name || '').trim() || NO_CATEGORY;
  }

  function categoryNameFromKey(key) {
    return key === NO_CATEGORY ? 'ไม่ระบุหมวด' : key;
  }

  function productSearchText(product) {
    return [product?.name, product?.barcode, product?.note, product?.unit]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function colorFromText(text) {
    const palette = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#dc2626', '#4f46e5'];
    let hash = 0;
    String(text || '').split('').forEach(ch => { hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0; });
    return palette[Math.abs(hash) % palette.length];
  }

  function normalizeCsvHeader(value) {
    const raw = String(value || '')
      .replace(/^\uFEFF/, '')
      .replace(/^(ï»¿|๏ปฟ|�ปฟ)/, '')
      .trim()
      .toLowerCase();
    const aliases = {
      'ชื่อสินค้า': 'name',
      'สินค้า': 'name',
      'ชื่อ': 'name',
      'รหัส': 'barcode',
      'บาร์โค้ด': 'barcode',
      'barcode': 'barcode',
      'หมวด': 'category',
      'หมวดหมู่': 'category',
      'category': 'category',
      'ราคาขาย': 'price',
      'ราคา': 'price',
      'price': 'price',
      'ต้นทุน': 'cost',
      'cost': 'cost',
      'สต็อก': 'stock',
      'คงเหลือ': 'stock',
      'stock': 'stock',
      'สต็อกขั้นต่ำ': 'min_stock',
      'ขั้นต่ำ': 'min_stock',
      'min_stock': 'min_stock',
      'หน่วย': 'unit',
      'unit': 'unit',
      'หมายเหตุ': 'note',
      'note': 'note',
      'รูป': 'img_url',
      'รูปภาพ': 'img_url',
      'img_url': 'img_url',
      'image': 'img_url',
    };
    return aliases[raw] || raw;
  }

  function parseNumber(value) {
    const raw = String(value ?? '').trim().replace(/,/g, '');
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  function hasKnownHeaders(headers) {
    const set = new Set((headers || []).map(normalizeCsvHeader));
    return set.has('name') || set.has('barcode') || set.has('price') || set.has('category');
  }

  function stockState(product) {
    const stock = money(product?.stock);
    const min = money(product?.min_stock);
    if (stock <= 0) return 'out';
    if (min > 0 && stock <= min) return 'low';
    return 'ok';
  }

  async function loadAllProductsV38() {
    const rows = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db
        .from(TABLE.product)
        .select('*')
        .order('name')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    try { products = rows; } catch (_) {}
    try { window.products = rows; } catch (_) {}
    return rows;
  }

  async function loadCategoriesSafe() {
    try {
      const { data, error } = await db.from(TABLE.category).select('*').order('name');
      if (error) throw error;
      try { categories = data || []; } catch (_) {}
      return data || [];
    } catch (e) {
      console.warn('[v38] categories:', e);
      return Array.isArray(window.categories) ? window.categories : [];
    }
  }

  async function ensureCategoriesByName(names) {
    const unique = [...new Set((names || []).map(n => String(n || '').trim()).filter(Boolean))];
    if (!unique.length) return { created: 0, existing: 0, failed: 0 };

    const { data: current, error } = await db.from(TABLE.category).select('id,name');
    if (error) throw error;
    const existing = new Set((current || []).map(c => String(c.name || '').trim().toLowerCase()));
    let created = 0;
    let failed = 0;

    for (const name of unique) {
      if (existing.has(name.toLowerCase())) continue;
      const res = await db.from(TABLE.category).insert({ name, color: colorFromText(name) });
      if (res.error) {
        console.warn('[v38] create category failed:', name, res.error);
        failed++;
        continue;
      }
      existing.add(name.toLowerCase());
      created++;
    }

    try { if (typeof loadCategories === 'function') await loadCategories(); } catch (_) {}
    return { created, existing: unique.length - created - failed, failed };
  }

  async function syncCategoriesFromProducts(showResult) {
    try {
      const { data, error } = await db.from(TABLE.product).select('category');
      if (error) throw error;
      const names = (data || []).map(p => p.category);
      const result = await ensureCategoriesByName(names);
      if (showResult && window.Swal) {
        await Swal.fire({
          icon: result.failed ? 'warning' : 'success',
          title: 'ซิงก์หมวดหมู่เสร็จแล้ว',
          text: `เพิ่มใหม่ ${result.created} หมวด, มีอยู่แล้ว ${result.existing} หมวด${result.failed ? ', เพิ่มไม่สำเร็จ ' + result.failed + ' หมวด' : ''}`,
          confirmButtonText: 'ตกลง',
        });
      } else if (showResult && typeof toast === 'function') {
        toast(`ซิงก์หมวดหมู่แล้ว เพิ่มใหม่ ${result.created} หมวด`, 'success');
      }
      return result;
    } catch (e) {
      console.error('[v38] sync categories:', e);
      if (showResult && window.Swal) {
        await Swal.fire({ icon: 'error', title: 'ซิงก์หมวดหมู่ไม่สำเร็จ', text: e.message || String(e) });
      }
      return { created: 0, existing: 0, failed: 0, error: e };
    }
  }

  async function loadSalesStats(productList) {
    const now = Date.now();
    if (state.salesCache && now - state.salesCacheAt < 120000) return state.salesCache;

    const productById = new Map();
    const productByName = new Map();
    (productList || []).forEach(p => {
      if (p.id) productById.set(String(p.id), p);
      if (p.name) productByName.set(String(p.name).trim().toLowerCase(), p);
    });

    const stats = {};
    const ensure = key => {
      const name = categoryNameFromKey(key);
      stats[key] = stats[key] || { key, name, sales: 0, gross: 0, qty: 0 };
      return stats[key];
    };

    function parseReturnInfo(info) {
      if (!info) return {};
      if (typeof info === 'object') return info;
      try { return JSON.parse(info); } catch (_) { return {}; }
    }

    try {
      const [{ data: billRows, error: billErr }, { data: itemRows, error: itemErr }] = await Promise.all([
        db.from(TABLE.bill).select('id,total,status,return_info').limit(5000),
        db.from(TABLE.billItem).select('bill_id,product_id,name,qty,total,cost').limit(5000),
      ]);
      if (billErr) throw billErr;
      if (itemErr) throw itemErr;

      const billMap = new Map();
      (billRows || []).forEach(bill => {
        const status = String(bill.status || '');
        if (['ยกเลิก', 'คืนเงิน', 'คืนสินค้า'].includes(status)) return;
        const ret = parseReturnInfo(bill.return_info);
        const original = money(bill.total);
        const effective = money(ret.new_total ?? bill.total);
        const ratio = original > 0 ? Math.max(0, Math.min(1, effective / original)) : 1;
        billMap.set(String(bill.id), { status, ratio });
      });

      (itemRows || []).forEach(item => {
        const bill = item.bill_id ? billMap.get(String(item.bill_id)) : null;
        if (item.bill_id && billMap.size && !bill) return;
        const prod = productById.get(String(item.product_id || ''))
          || productByName.get(String(item.name || '').trim().toLowerCase());
        const key = categoryKeyFromName(prod?.category);
        const row = ensure(key);
        const qty = money(item.qty);
        const saleRatio = bill?.ratio ?? 1;
        const total = money(item.total) * saleRatio;
        const cost = money(item.cost) * qty * saleRatio;
        row.qty += qty;
        row.sales += total;
        row.gross += total - cost;
      });
    } catch (e) {
      console.warn('[v38] category sales stats skipped:', e);
    }

    state.salesCache = stats;
    state.salesCacheAt = now;
    return stats;
  }

  async function buildCategoryStats(productList, categoryRows) {
    const salesStats = await loadSalesStats(productList);
    const byKey = {};
    const ensure = (key, color) => {
      const name = categoryNameFromKey(key);
      byKey[key] = byKey[key] || {
        key,
        name,
        color: color || '#2563eb',
        count: 0,
        stockValue: 0,
        low: 0,
        out: 0,
        sales: 0,
        gross: 0,
        qty: 0,
      };
      if (color) byKey[key].color = color;
      return byKey[key];
    };

    (categoryRows || []).forEach(cat => ensure(categoryKeyFromName(cat.name), cat.color || '#2563eb'));

    (productList || []).forEach(product => {
      const key = categoryKeyFromName(product.category);
      const row = ensure(key);
      row.count += 1;
      row.stockValue += money(product.cost) * money(product.stock);
      const ss = stockState(product);
      if (ss === 'low') row.low += 1;
      if (ss === 'out') row.out += 1;
    });

    Object.values(salesStats || {}).forEach(sale => {
      const row = ensure(sale.key);
      row.sales += money(sale.sales);
      row.gross += money(sale.gross);
      row.qty += money(sale.qty);
    });

    return Object.values(byKey).sort((a, b) => {
      if (b.sales !== a.sales) return b.sales - a.sales;
      return a.name.localeCompare(b.name, 'th');
    });
  }

  function setCategoryFilter(key) {
    state.category = key || ALL_CATEGORY;
    state.limit = 20;
    renderInventory();
  }

  function setStockFilter(key) {
    state.stock = key || 'all';
    state.limit = 20;
    renderInventory();
  }

  function clearCategoryStatsCache() {
    state.salesCache = null;
    state.salesCacheAt = 0;
  }

  window.v38SetInvCategory = setCategoryFilter;
  window.v38SetInvStock = setStockFilter;
  window.v38ShowMoreInventory = function () {
    state.limit = (state.limit || 20) + 20;
    renderInventory();
  };
  window.v38SyncCategoriesFromProducts = async function () {
    await syncCategoriesFromProducts(true);
    clearCategoryStatsCache();
    return renderInventory();
  };
  window.v38RefreshCategoryStats = function () {
    clearCategoryStatsCache();
    return renderInventory();
  };

  // ══════════════════════════════════════════════════════════════
  // EDIT CATEGORY — แก้ไขหมวดหมู่เดิม
  // ══════════════════════════════════════════════════════════════
  window.v38EditCategory = async function (catId) {
    if (!catId || typeof Swal === 'undefined') return;
    let cat = null;
    try {
      const { data, error } = await db.from(TABLE.category).select('*').eq('id', catId).maybeSingle();
      if (error) throw error;
      cat = data;
    } catch (e) {
      if (typeof toast === 'function') toast('โหลดข้อมูลหมวดหมู่ไม่สำเร็จ: ' + e.message, 'error');
      return;
    }
    if (!cat) {
      if (typeof toast === 'function') toast('ไม่พบหมวดหมู่นี้', 'warning');
      return;
    }

    const oldName = String(cat.name || '').trim();
    const result = await Swal.fire({
      title: 'แก้ไขหมวดหมู่',
      width: 480,
      html: `
        <div style="text-align:left;display:flex;flex-direction:column;gap:14px">
          <div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:5px">ชื่อหมวดหมู่ *</label>
            <input id="v38-edit-cat-name" class="swal2-input" value="${esc(cat.name || '')}" placeholder="ชื่อหมวดหมู่" style="margin:0;width:100%;box-sizing:border-box">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:5px">สี</label>
              <input id="v38-edit-cat-color" type="color" value="${esc(cat.color || '#2563eb')}" style="width:100%;height:42px;border:1px solid #e2e8f0;border-radius:8px;padding:4px;cursor:pointer">
            </div>
            <div>
              <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:5px">ไอคอน</label>
              <input id="v38-edit-cat-icon" class="swal2-input" value="${esc(cat.icon || 'inventory_2')}" placeholder="เช่น build, plumbing" style="margin:0;width:100%;box-sizing:border-box">
            </div>
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:5px">หมายเหตุ</label>
            <input id="v38-edit-cat-note" class="swal2-input" value="${esc(cat.note || '')}" placeholder="(ถ้ามี)" style="margin:0;width:100%;box-sizing:border-box">
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: '<i class="material-icons-round" style="font-size:16px;vertical-align:middle;margin-right:4px">save</i> บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const name = document.getElementById('v38-edit-cat-name')?.value?.trim();
        if (!name) { Swal.showValidationMessage('กรุณากรอกชื่อหมวดหมู่'); return false; }
        return {
          name,
          color: document.getElementById('v38-edit-cat-color')?.value || '#2563eb',
          icon: document.getElementById('v38-edit-cat-icon')?.value?.trim() || 'inventory_2',
          note: document.getElementById('v38-edit-cat-note')?.value?.trim() || null,
        };
      },
    });

    if (!result.isConfirmed || !result.value) return;
    const updated = result.value;

    try {
      // 1. อัปเดตหมวดหมู่ในตาราง categories
      const { error } = await db.from(TABLE.category).update(updated).eq('id', catId);
      if (error) throw error;

      // 2. ถ้าชื่อเปลี่ยน → อัปเดตสินค้าทุกตัวที่ใช้ชื่อเดิม
      if (oldName && updated.name !== oldName) {
        const { error: prodErr } = await db
          .from(TABLE.product)
          .update({ category: updated.name, updated_at: new Date().toISOString() })
          .eq('category', oldName);
        if (prodErr) console.warn('[v38] update product categories:', prodErr);
        // อัปเดต local products array
        try {
          const prods = typeof products !== 'undefined' ? products : window.products;
          if (Array.isArray(prods)) {
            prods.forEach(p => { if (p.category === oldName) p.category = updated.name; });
          }
        } catch (_) {}
      }

      // 3. รีโหลด
      try { if (typeof loadCategories === 'function') await loadCategories(); } catch (_) {}
      clearCategoryStatsCache();
      if (typeof toast === 'function') toast(`แก้ไขหมวดหมู่ "${updated.name}" สำเร็จ`, 'success');
      renderInventory();
    } catch (e) {
      if (typeof toast === 'function') toast('แก้ไขหมวดหมู่ไม่สำเร็จ: ' + e.message, 'error');
    }
  };

  // Alias ให้ editCat ใช้ได้จากหน้า admin ด้วย
  window.editCat = async function (id) { return window.v38EditCategory(id); };
  try { editCat = window.editCat; } catch (_) {}

  function looksBrokenThai(text) {
    const s = String(text || '');
    const bad = (s.match(/\uFFFD/g) || []).length;
    if (bad >= 2) return true;
    return /à¸|à¹|Ã|Â/.test(s);
  }

  async function readCsvFileText(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(buffer);
    }
    const decoders = ['utf-8', 'windows-874'];
    let best = '';
    let bestScore = Infinity;

    for (const enc of decoders) {
      try {
        const text = new TextDecoder(enc).decode(buffer);
        const bad = (text.match(/\uFFFD/g) || []).length;
        const thai = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
        const score = bad * 100 - thai;
        if (score < bestScore) {
          bestScore = score;
          best = text;
        }
      } catch (_) {}
    }

    return best || new TextDecoder().decode(buffer);
  }

  function detectDelimiter(text) {
    const first = String(text || '').split(/\r?\n/).find(line => line.trim()) || '';
    const candidates = [',', ';', '\t'];
    let best = ',';
    let bestCount = -1;
    candidates.forEach(delim => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < first.length; i++) {
        const ch = first[i];
        const next = first[i + 1];
        if (ch === '"' && inQuotes && next === '"') { i++; continue; }
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === delim && !inQuotes) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        best = delim;
      }
    });
    return best;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const src = String(text || '').replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(src);
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const next = src[i + 1];
      if (ch === '"' && inQuotes && next === '"') { cell += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === delimiter && !inQuotes) { row.push(cell); cell = ''; continue; }
      if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cell);
        if (row.some(v => String(v).trim() !== '')) rows.push(row);
        row = [];
        cell = '';
        continue;
      }
      cell += ch;
    }
    row.push(cell);
    if (row.some(v => String(v).trim() !== '')) rows.push(row);
    return rows;
  }

  async function importProductsCsv(text, upsert) {
    if (looksBrokenThai(text)) {
      throw new Error('อ่านภาษาไทยในไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ใหม่ หรือบันทึก CSV เป็น UTF-8 / CSV UTF-8 แล้วนำเข้าอีกครั้ง');
    }
    const rows = parseCsv(text);
    if (rows.length < 2) {
      if (typeof toast === 'function') toast('ไฟล์ CSV ไม่มีข้อมูลสินค้า', 'warning');
      return;
    }

    const hasHeader = hasKnownHeaders(rows[0]);
    const headers = hasHeader
      ? rows[0].map(normalizeCsvHeader)
      : ['name', 'barcode', 'category', 'price', 'cost', 'stock', 'min_stock', 'unit', 'note', 'img_url'];
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const idx = key => headers.indexOf(key);
    if (idx('name') < 0) throw new Error('CSV ต้องมีคอลัมน์ name หรือ ชื่อสินค้า');

    const existingByBarcode = {};
    if (upsert) {
      const { data, error } = await db.from(TABLE.product).select('id,barcode');
      if (error) throw error;
      (data || []).forEach(p => {
        const code = String(p.barcode || '').trim();
        if (code) existingByBarcode[code] = p.id;
      });
    }

    const items = [];
    let skipped = 0;
    const get = (row, key) => idx(key) >= 0 ? String(row[idx(key)] ?? '').trim() : '';

    const seenBarcodeInFile = new Set();
    dataRows.forEach(row => {
      const name = get(row, 'name');
      if (!name) { skipped++; return; }
      const barcode = get(row, 'barcode') || null;
      if (barcode && seenBarcodeInFile.has(String(barcode))) {
        skipped++;
        return;
      }
      if (barcode) seenBarcodeInFile.add(String(barcode));
      const data = {
        name,
        barcode,
        category: get(row, 'category') || null,
        price: parseNumber(get(row, 'price')),
        cost: parseNumber(get(row, 'cost')),
        stock: parseNumber(get(row, 'stock')),
        min_stock: parseNumber(get(row, 'min_stock')),
        unit: get(row, 'unit') || 'ชิ้น',
        note: get(row, 'note') || null,
        img_url: get(row, 'img_url') || null,
        updated_at: new Date().toISOString(),
      };
      if (![data.price, data.cost, data.stock, data.min_stock].every(Number.isFinite)) {
        skipped++;
        return;
      }
      items.push(data);
    });

    if (!items.length) throw new Error('ไม่พบแถวสินค้าที่นำเข้าได้');

    const catResult = await ensureCategoriesByName(items.map(item => item.category));

    const insertItems = [];
    const updateItems = [];
    for (const item of items) {
      const existingId = item.barcode ? existingByBarcode[String(item.barcode).trim()] : null;
      if (upsert && existingId) {
        updateItems.push({ id: existingId, item });
      } else {
        insertItems.push(item);
      }
    }

    let inserted = 0;
    let updated = 0;
    if (insertItems.length) {
      const res = await db.from(TABLE.product).insert(insertItems);
      if (res.error) throw new Error('เพิ่มสินค้าแบบหลายรายการไม่สำเร็จ: ' + res.error.message);
      inserted = insertItems.length;
    }
    for (const row of updateItems) {
      const res = await db.from(TABLE.product).update(row.item).eq('id', row.id);
      if (res.error) throw new Error('อัปเดตสินค้า "' + row.item.name + '" ไม่สำเร็จ: ' + res.error.message);
      updated++;
    }

    try { if (typeof loadProducts === 'function') await loadProducts(); } catch (_) {}
    try { if (typeof loadCategories === 'function') await loadCategories(); } catch (_) {}
    clearCategoryStatsCache();
    await renderInventory();

    if (window.Swal) {
      await Swal.fire({
        icon: 'success',
        title: 'นำเข้าสำเร็จ',
        html: `<div style="text-align:left;line-height:1.7">
          <div>อ่านจากไฟล์: <b>${dataRows.length}</b> แถวข้อมูล</div>
          <div>เพิ่มสินค้าใหม่: <b>${inserted}</b> รายการ</div>
          <div>อัปเดตจากบาร์โค้ดซ้ำ: <b>${updated}</b> รายการ</div>
          <div>ข้ามแถวที่ข้อมูลไม่ครบ/ตัวเลขไม่ถูกต้อง: <b>${skipped}</b> รายการ</div>
          <div>สร้างหมวดหมู่ใหม่: <b>${catResult.created}</b> หมวด</div>
        </div>`,
        confirmButtonText: 'ตกลง',
      });
    }
  }

  function installCsvImportOverride() {
    window.showImportProductsCsvModal = function () {
      const sample = 'name,barcode,category,price,cost,stock,min_stock,unit,note,img_url\nเต้ารับคู่ มีกราวด์,8850040006,อุปกรณ์ไฟฟ้า,75,50,100,20,ชิ้น,,\nสายไฟ VAF 2x1.5 (ม้วน 90ม.),8850040001,อุปกรณ์ไฟฟ้า,950,800,1,2,ม้วน,,';
      if (!window.Swal) return;
      Swal.fire({
        title: 'นำเข้าสินค้าจาก CSV',
        width: 780,
        html: `
          <div style="text-align:left;line-height:1.55">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;margin-bottom:12px;color:#1e40af">
              <b>ระบบจะสร้างหมวดหมู่ให้อัตโนมัติ</b>
              <div style="font-size:12px;margin-top:4px">ถ้า CSV มีคอลัมน์ <code>category</code> หรือ <code>หมวดหมู่</code> และหมวดนั้นยังไม่มีในระบบ</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px">
              <b>หัวคอลัมน์ที่รองรับ</b>
              <div style="font-family:monospace;font-size:12px;color:#475569;margin-top:6px">name, barcode, category, price, cost, stock, min_stock, unit, note, img_url</div>
              <div style="font-size:12px;color:#64748b;margin-top:4px">ใช้หัวภาษาไทยได้: ชื่อสินค้า, บาร์โค้ด, หมวดหมู่, ราคาขาย, ต้นทุน, สต็อก, สต็อกขั้นต่ำ, หน่วย, หมายเหตุ, รูปภาพ</div>
            </div>
            <div style="font-size:12px;color:#64748b;margin-bottom:6px">ตัวอย่างไฟล์</div>
            <pre style="white-space:pre-wrap;background:#111827;color:#e5e7eb;border-radius:8px;padding:10px;font-size:12px;overflow:auto">${esc(sample)}</pre>
            <input id="v38-csv-file" type="file" accept=".csv,text/csv" class="swal2-file" style="display:block;width:100%;margin-top:12px">
            <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:#475569">
              <input id="v38-csv-upsert" type="checkbox" checked style="width:16px;height:16px"> ถ้าบาร์โค้ดซ้ำ ให้อัปเดตสินค้าเดิม
            </label>
          </div>`,
        showCancelButton: true,
        confirmButtonText: 'นำเข้า',
        cancelButtonText: 'ยกเลิก',
        preConfirm: async () => {
          const file = document.getElementById('v38-csv-file')?.files?.[0];
          if (!file) { Swal.showValidationMessage('กรุณาเลือกไฟล์ CSV'); return false; }
          const text = await readCsvFileText(file);
          const rows = parseCsv(text);
          const hasHeader = rows.length ? hasKnownHeaders(rows[0]) : false;
          const dataRows = hasHeader ? rows.slice(1) : rows;
          if (looksBrokenThai(text)) {
            Swal.showValidationMessage('ไฟล์นี้อ่านภาษาไทยไม่ถูกต้อง กรุณาบันทึกเป็น CSV UTF-8 แล้วลองใหม่');
            return false;
          }
          if (!dataRows.length) {
            Swal.showValidationMessage('ไม่พบรายการสินค้าในไฟล์');
            return false;
          }
          return {
            text,
            upsert: document.getElementById('v38-csv-upsert')?.checked !== false,
          };
        },
      }).then(async res => {
        if (!res.isConfirmed || !res.value) return;
        try {
          await importProductsCsv(res.value.text, res.value.upsert);
        } catch (e) {
          console.error('[v38] import csv:', e);
          Swal.fire({ icon: 'error', title: 'นำเข้าไม่สำเร็จ', text: e.message || String(e) });
        }
      });
    };
    window.showImportProductsCsvModal.__v38categoryImport = true;
  }

  function statButton(key, label, value, color) {
    const active = state.stock === key;
    return `<button type="button" onclick="v38SetInvStock('${js(key)}')" class="v38-stat ${active ? 'active' : ''}" style="--tone:${esc(color)}">
      <strong>${esc(value)}</strong><span>${esc(label)}</span>
    </button>`;
  }

  function categoryCard(row) {
    const active = state.category === row.key;
    const warn = row.out > 0 ? `${fmt(row.out)} หมด` : row.low > 0 ? `${fmt(row.low)} ใกล้หมด` : 'สต็อกปกติ';
    // หา catId จาก categories array
    const catRow = (Array.isArray(typeof categories !== 'undefined' ? categories : window.categories)
      ? (typeof categories !== 'undefined' ? categories : window.categories)
      : []).find(c => categoryKeyFromName(c.name) === row.key);
    const catId = catRow?.id || '';
    return `<div class="v38-cat-card ${active ? 'active' : ''}" style="--cat:${esc(row.color)}">
      <div class="v38-cat-card-actions">
        ${catId ? `<button type="button" class="v38-cat-edit" onclick="event.stopPropagation();v38EditCategory('${js(catId)}')" title="แก้ไขหมวดหมู่">
          <i class="material-icons-round">edit</i>
        </button>` : ''}
      </div>
      <button type="button" class="v38-cat-card-body" onclick="v38SetInvCategory('${js(row.key)}')">
        <div class="v38-cat-top">
          <span class="v38-cat-dot"></span>
          <strong>${esc(row.name)}</strong>
        </div>
        <div class="v38-cat-grid">
          <div><b>${fmt(row.count)}</b><span>สินค้า</span></div>
          <div><b>฿${fmt(row.stockValue)}</b><span>มูลค่าสต็อก</span></div>
          <div><b>฿${fmt(row.sales)}</b><span>ยอดขาย</span></div>
          <div><b>฿${fmt(row.gross)}</b><span>กำไรขั้นต้น</span></div>
        </div>
        <div class="v38-cat-warn ${row.out > 0 ? 'danger' : row.low > 0 ? 'warn' : ''}">${esc(warn)}</div>
      </button>
    </div>`;
  }

  function categoryChip(row) {
    const active = state.category === row.key;
    return `<button type="button" onclick="v38SetInvCategory('${js(row.key)}')" class="v38-chip ${active ? 'active' : ''}">
      <span class="v38-chip-dot" style="background:${esc(row.color)}"></span>${esc(row.name)} <b>${fmt(row.count)}</b>
    </button>`;
  }

  function productRow(product) {
    const ss = stockState(product);
    const stockClass = ss === 'out' ? 'danger' : ss === 'low' ? 'warn' : 'ok';
    return `<tr>
      <td><div class="v38-img">${product.img_url ? `<img src="${esc(product.img_url)}" alt="${esc(product.name)}">` : '<i class="material-icons-round">image</i>'}</div></td>
      <td><strong>${esc(product.name || '')}</strong>${product.note ? `<small>${esc(product.note)}</small>` : ''}</td>
      <td class="mono">${esc(product.barcode || '-')}</td>
      <td><span class="v38-cat-badge">${esc(categoryName(product))}</span></td>
      <td class="right"><strong>฿${fmt(product.price)}</strong></td>
      <td class="right">฿${fmt(product.cost || 0)}</td>
      <td class="center"><span class="v38-stock ${stockClass}">${fmt(product.stock)} ${esc(product.unit || '')}</span></td>
      <td class="right"><div class="v38-actions">
        <button onclick="v42ProductActions?.('${js(product.id)}')" title="จัดการสินค้า"><i class="material-icons-round">more_horiz</i></button>
      </div></td>
    </tr>`;
  }

  function installStyle() {
    if (document.getElementById('v38-category-style')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="v38-category-style">
      .v38-inv{max-width:1260px;margin:0 auto;padding-bottom:32px}
      .v38-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}
      .v38-title h2{margin:0;font-size:24px;color:#0f172a;font-weight:900}
      .v38-title div{font-size:13px;color:#64748b;margin-top:4px}
      .v38-head-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .v38-btn{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:8px;padding:9px 13px;font-weight:800;font-size:13px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
      .v38-btn.primary{border-color:#2563eb;background:#2563eb;color:#fff}
      .v38-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}
      .v38-stat{background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px;text-align:left;cursor:pointer}
      .v38-stat.active{border-color:var(--tone);box-shadow:0 0 0 3px color-mix(in srgb,var(--tone) 16%,transparent)}
      .v38-stat strong{display:block;color:var(--tone);font-size:25px;font-weight:950}
      .v38-stat span{font-size:12px;color:#64748b;font-weight:800}
      .v38-cat-panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:14px}
      .v38-cat-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      .v38-cat-panel-head strong{font-size:15px;color:#0f172a}
      .v38-cat-panel-head span{font-size:12px;color:#64748b}
      .v38-cat-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;overflow:visible;padding:2px}
      .v38-cat-card{text-align:left;background:linear-gradient(135deg,color-mix(in srgb,var(--cat) 12%,#fff) 0%,color-mix(in srgb,var(--cat) 5%,#fff) 100%);border:1.5px solid color-mix(in srgb,var(--cat) 24%,#e2e8f0);border-radius:10px;padding:0;cursor:default;min-height:206px;display:flex;flex-direction:column;position:relative;overflow:hidden}
      .v38-cat-card-body{all:unset;display:flex;flex-direction:column;flex:1;padding:13px;cursor:pointer;width:100%;box-sizing:border-box}
      .v38-cat-card-actions{position:absolute;top:8px;right:8px;display:flex;gap:4px;opacity:0;transition:opacity .15s;z-index:2}
      .v38-cat-card:hover .v38-cat-card-actions{opacity:1}
      .v38-cat-edit{width:28px;height:28px;border-radius:7px;border:1px solid color-mix(in srgb,var(--cat) 30%,#e2e8f0);background:rgba(255,255,255,.92);color:var(--cat);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;backdrop-filter:blur(4px)}
      .v38-cat-edit:hover{background:var(--cat);color:#fff;transform:scale(1.08)}
      .v38-cat-edit i{font-size:15px}
      .v38-cat-card.active{border-color:var(--cat);box-shadow:0 0 0 3px color-mix(in srgb,var(--cat) 16%,transparent)}
      .v38-cat-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;min-width:0}
      .v38-cat-top strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .v38-cat-dot,.v38-chip-dot{width:10px;height:10px;border-radius:50%;background:var(--cat);flex:0 0 auto}
      .v38-cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .v38-cat-grid div{background:rgba(255,255,255,.58);border:1px solid rgba(255,255,255,.7);border-radius:8px;padding:8px;min-width:0}
      .v38-cat-grid b{display:block;font-size:14px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v38-cat-grid span{font-size:10px;color:#64748b;font-weight:800}
      .v38-cat-warn{margin-top:auto;padding-top:10px;font-size:12px;font-weight:900;color:#16a34a}
      .v38-cat-warn.warn{color:#d97706}.v38-cat-warn.danger{color:#dc2626}
      .v38-table-panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
      .v38-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
      .v38-search{position:relative;min-width:260px;flex:1;max-width:480px}
      .v38-search i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#94a3b8}
      .v38-search input{width:100%;box-sizing:border-box;padding:10px 12px 10px 40px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;outline:none}
      .v38-chips{display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #e2e8f0}
      .v38-chip{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:850;color:#334155;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .v38-chip.active{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}
      .v38-table-wrap{overflow-x:auto}
      .v38-table{width:100%;border-collapse:collapse;white-space:nowrap}
      .v38-table th{padding:13px 16px;text-align:left;border-bottom:2px solid #f1f5f9;color:#64748b;font-size:12px;text-transform:uppercase}
      .v38-table td{padding:12px 16px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:13px}
      .v38-table small{display:block;color:#94a3b8;margin-top:2px;max-width:260px;overflow:hidden;text-overflow:ellipsis}
      .v38-img{width:42px;height:42px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#cbd5e1}
      .v38-img img{width:100%;height:100%;object-fit:cover}
      .v38-cat-badge{background:#eff6ff;color:#2563eb;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:850}
      .v38-stock{border-radius:999px;padding:4px 10px;font-size:12px;font-weight:900}
      .v38-stock.ok{background:#f0fdf4;color:#16a34a}.v38-stock.warn{background:#fffbeb;color:#d97706}.v38-stock.danger{background:#fef2f2;color:#dc2626}
      .v38-actions{display:flex;gap:4px;justify-content:flex-end}
      .v38-actions button{width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#2563eb}
      .v38-actions button.danger{border-color:#fecaca;color:#dc2626}
      .right{text-align:right}.center{text-align:center}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
      .v38-empty{padding:42px;text-align:center;color:#94a3b8;font-weight:850}
      @media(max-width:1180px){.v38-cat-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:760px){.v38-head{flex-direction:column}.v38-head-actions,.v38-btn{width:100%;justify-content:center}.v38-cat-cards{grid-template-columns:1fr}.v38-search{min-width:100%;max-width:none}}
    </style>`);
  }

  async function renderInventoryV38() {
    const section = document.getElementById('page-inv');
    if (!section) return;
    installStyle();

    let productList = [];
    try {
      productList = await loadAllProductsV38();
    } catch (e) {
      console.error('[v38] load products:', e);
      if (typeof toast === 'function') toast('โหลดสินค้าไม่สำเร็จ: ' + e.message, 'error');
    }

    if (!productList.length) {
      productList = Array.isArray(typeof products !== 'undefined' ? products : window.products)
        ? (typeof products !== 'undefined' ? products : window.products)
        : [];
    }
    const categoryRows = await loadCategoriesSafe();
    const catStats = await buildCategoryStats(productList, categoryRows);

    const total = productList.length;
    const lowCount = productList.filter(p => stockState(p) === 'low').length;
    const outCount = productList.filter(p => stockState(p) === 'out').length;
    const stockValue = productList.reduce((sum, p) => sum + money(p.cost) * money(p.stock), 0);

    const q = String(state.search || '').toLowerCase();
    const filtered = productList.filter(product => {
      const productCatKey = categoryKeyFromName(product.category);
      const matchCategory = state.category === ALL_CATEGORY || productCatKey === state.category;
      const matchStock = state.stock === 'all' || stockState(product) === state.stock;
      const matchSearch = !q || productSearchText(product).includes(q);
      return matchCategory && matchStock && matchSearch;
    }).sort((a, b) => categoryName(a).localeCompare(categoryName(b), 'th') || String(a.name || '').localeCompare(String(b.name || ''), 'th'));
    const limitKey = `${state.category}|${state.stock}|${state.search}`;
    if (state.limitKey !== limitKey) {
      state.limitKey = limitKey;
      state.limit = 20;
    }
    const shown = filtered.slice(0, state.limit || 20);

    const allLabel = state.category === ALL_CATEGORY ? 'ทุกหมวดหมู่' : categoryNameFromKey(state.category);

    section.innerHTML = `<div class="v38-inv">
      <div class="v38-head">
        <div class="v38-title">
          <h2>คลังสินค้า</h2>
          <div>หมวดหมู่ใช้คุมสินค้า ดูมูลค่าสต็อก ยอดขาย กำไร และสถานะสต็อกแยกตามกลุ่ม</div>
        </div>
        <div class="v38-head-actions">
          <button class="v38-btn" onclick="showImportProductsCsvModal?.()"><i class="material-icons-round">upload_file</i>นำเข้า CSV</button>
          <button class="v38-btn" onclick="exportInventory?.()"><i class="material-icons-round">download</i>CSV</button>
          <button class="v38-btn" onclick="v38SyncCategoriesFromProducts()"><i class="material-icons-round">category</i>ซ่อมหมวดหมู่</button>
          ${((typeof USER !== 'undefined' && USER?.role === 'admin') || (typeof window !== 'undefined' && typeof window.v9CanPromotion === 'function' && window.v9CanPromotion())) ? `<button class="v38-btn" onclick="v9OpenPromoModal()"><i class="material-icons-round">local_offer</i>โปรโมชั่น</button>` : ''}
          <button class="v38-btn" onclick="v38RefreshCategoryStats()"><i class="material-icons-round">refresh</i>รีเฟรชยอดขาย</button>
          <button class="v38-btn primary" onclick="showAddProductModal()"><i class="material-icons-round">add</i>เพิ่มสินค้า</button>
        </div>
      </div>

      <div class="v38-stats">
        ${statButton('all', 'สินค้าทั้งหมด', fmt(total), '#2563eb')}
        ${statButton('low', 'ใกล้หมด', fmt(lowCount), '#d97706')}
        ${statButton('out', 'หมดสต็อก', fmt(outCount), '#dc2626')}
        <div class="v38-stat" style="--tone:#16a34a;cursor:default"><strong>฿${fmt(stockValue)}</strong><span>มูลค่าคลังรวม</span></div>
      </div>

      <div class="v38-cat-panel">
        <div class="v38-cat-panel-head">
          <strong>Dashboard หมวดหมู่</strong>
          <span>ยอดขาย/กำไรคำนวณจากรายการขายล่าสุดสูงสุด 5,000 รายการ ไม่รวมบิลยกเลิก และปรับยอดบิลคืนบางส่วนตามยอดสุทธิ</span>
        </div>
        <div class="v38-cat-cards">
          ${catStats.length ? catStats.map(categoryCard).join('') : '<div class="v38-empty">ยังไม่มีหมวดหมู่</div>'}
        </div>
      </div>

      <div class="v38-table-panel">
        <div class="v38-toolbar">
          <div class="v38-search">
            <i class="material-icons-round">search</i>
            <input id="v38-inv-search" type="text" placeholder="ค้นหาชื่อสินค้า / บาร์โค้ด / หมายเหตุ / หน่วย" value="${esc(state.search)}">
          </div>
          <div style="font-size:12px;color:#64748b;font-weight:850">แสดง ${fmt(shown.length)} จาก ${fmt(filtered.length)} รายการ · ${esc(allLabel)}</div>
        </div>
        <div class="v38-chips">
          <button type="button" onclick="v38SetInvCategory('${ALL_CATEGORY}')" class="v38-chip ${state.category === ALL_CATEGORY ? 'active' : ''}">ทั้งหมด <b>${fmt(total)}</b></button>
          ${catStats.map(categoryChip).join('')}
          ${typeof window.v54InventoryPendingChipHtml === 'function' ? window.v54InventoryPendingChipHtml() : ''}
        </div>
        <div class="v38-table-wrap">
          <table class="v38-table">
            <thead><tr>
              <th>รูป</th><th>สินค้า</th><th>บาร์โค้ด</th><th>หมวด</th><th class="right">ราคาขาย</th><th class="right">ต้นทุน</th><th class="center">สต็อก</th><th class="right">จัดการ</th>
            </tr></thead>
            <tbody>${shown.length ? shown.map(productRow).join('') : '<tr><td colspan="8"><div class="v38-empty">ไม่พบสินค้าตามตัวกรองนี้</div></td></tr>'}</tbody>
          </table>
        </div>
        ${shown.length < filtered.length ? `<div style="padding:16px 20px;border-top:1px solid #e2e8f0;background:#fff;text-align:center"><button type="button" onclick="v38ShowMoreInventory()" style="height:42px;padding:0 18px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-weight:850;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit"><i class="material-icons-round">expand_more</i> แสดงเพิ่มอีก ${fmt(Math.min(20, filtered.length - shown.length))} รายการ</button></div>` : ''}
      </div>
    </div>`;

    const search = document.getElementById('v38-inv-search');
    search?.addEventListener('input', () => {
      state.search = search.value || '';
      state.limit = 20;
      clearTimeout(window.__v38InvSearchTimer);
      window.__v38InvSearchTimer = setTimeout(() => renderInventory(), 180);
    });
    if (search && state.search) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }

    const pageActions = document.getElementById('page-actions');
    if (pageActions) pageActions.innerHTML = '';
  }

  function installQrPolish() {
    let style = document.getElementById('v38-payment-qr-polish');
    if (!style) {
      style = document.createElement('style');
      style.id = 'v38-payment-qr-polish';
      document.head.appendChild(style);
    }
    style.textContent = `
      .v36-transfer-qr-box{
        width:min(100%,440px)!important;
        max-width:440px!important;
        margin:14px auto 0!important;
        padding:18px 18px 20px!important;
        box-sizing:border-box!important;
      }
      .v36-transfer-qr-head{
        display:grid!important;
        grid-template-columns:34px minmax(0,1fr) 34px!important;
        align-items:center!important;
        justify-content:center!important;
        column-gap:10px!important;
        text-align:center!important;
      }
      .v36-transfer-qr-head:after{
        content:"";
        width:34px;
        height:1px;
      }
      .v36-transfer-qr-head i{
        justify-self:end!important;
      }
      .v36-transfer-qr-head>div{
        min-width:0!important;
      }
      .v36-transfer-qr-head strong,
      .v36-transfer-qr-head span{
        text-align:center!important;
        white-space:normal!important;
      }
      .v36-transfer-qr-canvas{
        width:min(100%,376px)!important;
        min-height:0!important;
        margin:0 auto!important;
        padding:0!important;
        display:block!important;
        box-sizing:border-box!important;
      }
      .v36-thai-qr-frame{
        width:100%!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        box-sizing:border-box!important;
        padding-bottom:14px!important;
      }
      .v36-thai-qr-top{
        width:100%!important;
        box-sizing:border-box!important;
        justify-content:center!important;
        text-align:center!important;
      }
      .v36-thai-qr-frame img{
        width:260px!important;
        height:260px!important;
        max-width:calc(100% - 36px)!important;
        display:block!important;
        margin:8px auto 8px!important;
        object-fit:contain!important;
      }
      .v36-transfer-qr-recipient,
      .v36-transfer-qr-detail,
      .v36-transfer-qr-amount,
      .v36-transfer-qr-note{
        text-align:center!important;
      }
      @media(max-width:520px){
        .v36-transfer-qr-box{max-width:100%!important;padding:14px!important}
        .v36-transfer-qr-canvas{width:100%!important}
        .v36-thai-qr-frame img{width:230px!important;height:230px!important}
      }
    `;
  }

  function protectCurrentProductCategory(productData) {
    const category = String(productData?.category || '').trim();
    if (!category) return;
    setTimeout(() => {
      const select = document.getElementById('v9prod-category') || document.getElementById('prod-category');
      if (!select) return;
      const exists = Array.from(select.options).some(opt => opt.value === category);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = category;
        opt.textContent = category + ' (ยังไม่ได้อยู่ในรายการหมวด)';
        select.appendChild(opt);
      }
      select.value = category;
    }, 60);
  }

  function installProductModalCategoryGuard() {
    const current = window.showAddProductModal;
    if (typeof current !== 'function' || current.__v38categoryGuard) return;
    const wrapped = function (productData) {
      const result = current.apply(this, arguments);
      protectCurrentProductCategory(productData);
      return result;
    };
    wrapped.__v38categoryGuard = true;
    wrapped.__v36imagepaste = !!current.__v36imagepaste;
    window.showAddProductModal = wrapped;
    try { showAddProductModal = window.showAddProductModal; } catch (_) {}
  }

  function installInventoryV38(forceRender) {
    installQrPolish();
    installCsvImportOverride();
    installProductModalCategoryGuard();
    window.renderInventory = renderInventoryV38;
    window.renderInventory.__v38categoryDashboard = true;
    try { renderInventory = window.renderInventory; } catch (_) {}

    const onInventoryPage = document.getElementById('page-inv') && !document.getElementById('page-inv').classList.contains('hidden');
    const showingOldInventory = onInventoryPage && !document.querySelector('#page-inv .v38-inv');
    if (forceRender || showingOldInventory) {
      try { window.renderInventory(); } catch (e) { console.warn('[v38] force render:', e); }
    }
  }

  window.v38InstallCategoryDashboard = installInventoryV38;
  installInventoryV38(false);
  document.addEventListener('DOMContentLoaded', () => installInventoryV38(false));
  [650, 1700, 3100, 4200].forEach(delay => {
    setTimeout(() => installInventoryV38(true), delay);
  });
})();
