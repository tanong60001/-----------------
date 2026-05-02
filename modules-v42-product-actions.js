(function () {
  'use strict';

  const fmt = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const num = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = v => String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');

  function productsList() {
    try { if (Array.isArray(products)) return products; } catch (_) {}
    return Array.isArray(window.products) ? window.products : [];
  }

  function findProduct(productId) {
    return productsList().find(p => String(p.id) === String(productId));
  }

  function injectStyle() {
    if (document.getElementById('v42-product-actions-style')) return;
    const style = document.createElement('style');
    style.id = 'v42-product-actions-style';
    style.textContent = `
      .v42-action-popup{border-radius:18px!important;overflow:hidden}
      .v42-actions,.v42-unit{font-family:inherit;text-align:left;color:#0f172a}
      .v42-act-head{background:linear-gradient(135deg,#102033,#14536a);color:#fff;padding:18px 20px}
      .v42-act-head small{display:block;color:#67e8f9;font-size:11px;font-weight:900;letter-spacing:1px}
      .v42-act-head strong{display:block;font-size:19px;font-weight:950;margin-top:5px;line-height:1.25}
      .v42-act-body{padding:16px;background:#f8fafc}
      .v42-act-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .v42-act-btn{border:1px solid #dbe3ef;background:#fff;border-radius:12px;padding:12px 10px;min-height:76px;cursor:pointer;text-align:center;font-size:13px;font-weight:900;color:#334155;box-shadow:0 8px 18px rgba(15,23,42,.035);transition:.15s}
      .v42-act-btn:hover{transform:translateY(-1px);border-color:#0891b2;background:#ecfeff;color:#0e7490}
      .v42-act-btn.danger:hover{border-color:#fecaca;background:#fef2f2;color:#dc2626}
      .v42-act-btn i{display:block;font-size:24px;margin-bottom:6px}
      .v42-unit-head{background:radial-gradient(circle at 18% 20%,rgba(45,212,191,.28),transparent 32%),linear-gradient(135deg,#0f172a,#164e63);color:#fff;padding:18px 22px;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center}
      .v42-unit-head small{font-size:11px;font-weight:950;color:#67e8f9;letter-spacing:1.2px}
      .v42-unit-head h2{margin:5px 0 0;font-size:20px;font-weight:950;line-height:1.25}
      .v42-base-card{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:11px 14px;text-align:right;min-width:180px}
      .v42-base-card span{display:block;color:#bae6fd;font-size:11px;font-weight:900}
      .v42-base-card b{display:block;font-size:22px;line-height:1.15;margin-top:3px}
      .v42-base-card button{margin-top:8px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;border-radius:9px;padding:6px 10px;font:inherit;font-size:12px;font-weight:900;cursor:pointer}
      .v42-unit-body{padding:18px 20px;background:#f8fafc}
      .v42-unit-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
      .v42-sum{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:11px 12px;box-shadow:0 8px 18px rgba(15,23,42,.028)}
      .v42-sum span{display:block;color:#64748b;font-size:11px;font-weight:900}
      .v42-sum b{display:block;font-size:17px;margin-top:4px;line-height:1.1}
      .v42-sum.good b{color:#059669}.v42-sum.warn b{color:#d97706}
      .v42-unit-table{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}
      .v42-unit-row{display:grid;grid-template-columns:1.05fr .72fr .72fr .8fr .86fr auto;gap:8px;align-items:center;padding:9px 10px;border-top:1px solid #e2e8f0}
      .v42-unit-row:first-child{border-top:0;background:#f1f5f9;color:#64748b;font-size:11px;font-weight:950}
      .v42-unit-row input{width:100%;height:36px;border:1.5px solid #dbe3ef;border-radius:9px;padding:0 9px;font:inherit;font-size:14px;font-weight:850;box-sizing:border-box;background:#fff}
      .v42-unit-row input:focus,.v42-field input:focus{outline:none;border-color:#06b6d4;box-shadow:0 0 0 3px #cffafe}
      .v42-cost{font-size:14px;font-weight:850;color:#475569}
      .v42-profit{font-size:14px;font-weight:950;color:#059669;line-height:1.25}
      .v42-profit small{font-size:11px;color:#0f766e;font-weight:900}
      .v42-profit.bad,.v42-profit.bad small{color:#dc2626}
      .v42-mini-actions{display:flex;gap:6px;justify-content:flex-end}
      .v42-mini-btn{width:36px;height:36px;border:1px solid #dbe3ef;background:#fff;border-radius:9px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#334155}
      .v42-mini-btn i{font-size:20px}.v42-mini-btn.save{background:#2563eb;border-color:#2563eb;color:#fff}.v42-mini-btn.danger{border-color:#fecaca;color:#dc2626}
      .v42-add{margin-top:12px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;box-shadow:0 10px 24px rgba(15,23,42,.035)}
      .v42-add-title{font-size:16px;font-weight:950;margin-bottom:10px}
      .v42-add-grid{display:grid;grid-template-columns:1.1fr .85fr .85fr auto;gap:10px;align-items:end}
      .v42-field label{display:block;color:#64748b;font-size:11px;font-weight:950;margin-bottom:6px}
      .v42-field input{width:100%;height:40px;border:1.5px solid #dbe3ef;border-radius:10px;padding:0 11px;font:inherit;font-size:14px;font-weight:850;box-sizing:border-box}
      .v42-add button{height:40px;border:0;border-radius:10px;background:#0891b2;color:#fff;font:inherit;font-size:13px;font-weight:950;padding:0 15px;cursor:pointer;box-shadow:0 10px 22px rgba(8,145,178,.18)}
      .v42-live-profit{margin-top:10px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .v42-live-profit > div{border:1px solid #dbeafe;background:#f8fbff;border-radius:11px;padding:9px 10px}
      .v42-live-profit span{display:block;color:#64748b;font-size:11px;font-weight:900}
      .v42-live-profit b{display:block;margin-top:3px;font-size:15px;font-weight:950;color:#0f172a}
      .v42-live-profit .ok b{color:#059669}.v42-live-profit .bad b{color:#dc2626}
      .v42-help{margin-top:12px;padding:10px 12px;border-radius:12px;background:#ecfeff;border:1px solid #a5f3fc;color:#155e75;font-size:12px;font-weight:800;line-height:1.55}
      @media(max-width:760px){
        .v42-act-grid{grid-template-columns:1fr 1fr}
        .v42-unit-head,.v42-unit-summary,.v42-add-grid,.v42-live-profit{grid-template-columns:1fr}
        .v42-unit-row{grid-template-columns:1fr}.v42-unit-row:first-child{display:none}.v42-base-card{text-align:left}
      }
    `;
    document.head.appendChild(style);
  }

  async function loadUnits(productId) {
    const { data, error } = await db.from('product_units').select('*').eq('product_id', productId).order('conv_rate', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function calcProfit(product, rate, price) {
    const conv = Math.max(num(rate), 0);
    const salePrice = num(price);
    const cost = num(product?.cost) * conv;
    const profit = salePrice - cost;
    return {
      conv,
      price: salePrice,
      cost,
      profit,
      margin: salePrice > 0 ? (profit / salePrice) * 100 : 0
    };
  }

  function profitBlock(calc) {
    const bad = calc.profit < 0;
    return `฿${fmt(calc.profit)}<br><small>${fmt(calc.margin)}%</small>`;
  }

  function liveProfitCards(calc) {
    const bad = calc.profit < 0;
    return `
      <div><span>ต้นทุนหน่วยนี้</span><b>฿${fmt(calc.cost)}</b></div>
      <div class="${bad ? 'bad' : 'ok'}"><span>กำไรทันที</span><b>฿${fmt(calc.profit)}</b></div>
      <div class="${bad ? 'bad' : 'ok'}"><span>มาร์จิ้น</span><b>${fmt(calc.margin)}%</b></div>`;
  }

  function unitRow(product, unit) {
    const calc = calcProfit(product, unit.conv_rate || 1, unit.price_per_unit);
    const bad = calc.profit < 0;
    return `
      <div class="v42-unit-row" id="v42-unit-row-${esc(unit.id)}">
        <input id="v42-u-name-${esc(unit.id)}" value="${esc(unit.unit_name)}">
        <input id="v42-u-rate-${esc(unit.id)}" type="number" step="0.0001" min="0.0001" value="${esc(unit.conv_rate || 1)}" oninput="v42UpdateUnitProfit('${js(product.id)}','${js(unit.id)}')">
        <input id="v42-u-price-${esc(unit.id)}" type="number" min="0" value="${esc(unit.price_per_unit || 0)}" oninput="v42UpdateUnitProfit('${js(product.id)}','${js(unit.id)}')">
        <div class="v42-cost" id="v42-cost-${esc(unit.id)}">฿${fmt(calc.cost)}</div>
        <div class="v42-profit ${bad ? 'bad' : ''}" id="v42-profit-${esc(unit.id)}">${profitBlock(calc)}</div>
        <div class="v42-mini-actions">
          <button class="v42-mini-btn save" onclick="v42SaveUnit('${js(unit.id)}','${js(product.id)}')" title="บันทึก"><i class="material-icons-round">save</i></button>
          <button class="v42-mini-btn danger" onclick="v42DeleteUnit('${js(unit.id)}','${js(product.id)}')" title="ลบ"><i class="material-icons-round">delete</i></button>
        </div>
      </div>`;
  }

  window.v42UpdateUnitProfit = function (productId, unitId) {
    const product = findProduct(productId);
    if (!product) return;
    const isAdd = unitId === 'add';
    const rateEl = document.getElementById(isAdd ? 'v42-add-rate' : 'v42-u-rate-' + unitId);
    const priceEl = document.getElementById(isAdd ? 'v42-add-price' : 'v42-u-price-' + unitId);
    const calc = calcProfit(product, rateEl?.value, priceEl?.value);
    if (isAdd) {
      const target = document.getElementById('v42-add-profit');
      if (target) target.innerHTML = liveProfitCards(calc);
      return;
    }
    const costEl = document.getElementById('v42-cost-' + unitId);
    const profitEl = document.getElementById('v42-profit-' + unitId);
    if (costEl) costEl.textContent = '฿' + fmt(calc.cost);
    if (profitEl) {
      profitEl.innerHTML = profitBlock(calc);
      profitEl.classList.toggle('bad', calc.profit < 0);
    }
  };

  window.v42ProductActions = function (productId) {
    injectStyle();
    const product = findProduct(productId);
    if (!product || typeof Swal === 'undefined') return;
    Swal.fire({
      html: `
        <div class="v42-actions">
          <div class="v42-act-head"><small>PRODUCT ACTIONS</small><strong>${esc(product.name)}</strong></div>
          <div class="v42-act-body">
            <div class="v42-act-grid">
              <button class="v42-act-btn" onclick="Swal.close();editProduct('${js(product.id)}')"><i class="material-icons-round">edit</i>แก้ไขสินค้า</button>
              <button class="v42-act-btn" onclick="Swal.close();v42ShowUnitModal('${js(product.id)}')"><i class="material-icons-round">straighten</i>หน่วยนับ/กำไร</button>
              <button class="v42-act-btn" onclick="Swal.close();adjustStock('${js(product.id)}')"><i class="material-icons-round">tune</i>ปรับสต็อก</button>
              <button class="v42-act-btn" onclick="Swal.close();generateBarcode?.('${js(product.id)}')"><i class="material-icons-round">qr_code</i>บาร์โค้ด</button>
              <button class="v42-act-btn" onclick="Swal.close();v34PrintPriceSticker?.('${js(product.id)}')"><i class="material-icons-round">label</i>สติกเกอร์ราคา</button>
              <button class="v42-act-btn danger" onclick="Swal.close();deleteProduct('${js(product.id)}')"><i class="material-icons-round">delete</i>ลบสินค้า</button>
            </div>
          </div>
        </div>`,
      width: 640,
      showConfirmButton: false,
      showCloseButton: true,
      customClass: { popup: 'v42-action-popup' }
    });
  };

  window.v42ShowUnitModal = async function (productId) {
    injectStyle();
    const product = findProduct(productId);
    if (!product || typeof Swal === 'undefined') return;
    let units = [];
    try {
      units = await loadUnits(productId);
    } catch (e) {
      toast?.('โหลดหน่วยนับไม่สำเร็จ: ' + e.message, 'error');
      return;
    }
    const baseCost = num(product.cost);
    const basePrice = num(product.price);
    const baseProfit = basePrice - baseCost;
    const addCalc = calcProfit(product, 1, 0);
    const html = `
      <div class="v42-unit">
        <div class="v42-unit-head">
          <div><small>UNIT & PROFIT MANAGER</small><h2>${esc(product.name)}</h2></div>
          <div class="v42-base-card">
            <span>หน่วยหลัก / Base</span>
            <b>${esc(product.unit || 'ชิ้น')}</b>
            <button type="button" onclick="Swal.close();editProduct('${js(product.id)}')">แก้หน่วยหลัก</button>
          </div>
        </div>
        <div class="v42-unit-body">
          <div class="v42-unit-summary">
            <div class="v42-sum"><span>ราคาขายฐาน</span><b>฿${fmt(basePrice)}</b></div>
            <div class="v42-sum"><span>ต้นทุนฐาน</span><b>฿${fmt(baseCost)}</b></div>
            <div class="v42-sum ${baseProfit >= 0 ? 'good' : 'warn'}"><span>กำไรฐาน</span><b>฿${fmt(baseProfit)}</b></div>
            <div class="v42-sum"><span>หน่วยย่อย</span><b>${fmt(units.length)}</b></div>
          </div>
          <div class="v42-unit-table">
            <div class="v42-unit-row"><div>หน่วยขาย</div><div>อัตราแปลง</div><div>ราคาขาย</div><div>ต้นทุน/หน่วย</div><div>กำไร/มาร์จิ้น</div><div></div></div>
            ${units.length ? units.map(u => unitRow(product, u)).join('') : '<div style="padding:20px;text-align:center;color:#64748b;font-weight:800">ยังไม่มีหน่วยนับย่อย</div>'}
          </div>
          <div class="v42-add">
            <div class="v42-add-title">เพิ่มหน่วยนับใหม่</div>
            <div class="v42-add-grid">
              <div class="v42-field"><label>ชื่อหน่วย</label><input id="v42-add-name" placeholder="เช่น ปี๊บ, คิว, รถ"></div>
              <div class="v42-field"><label>อัตราแปลง</label><input id="v42-add-rate" type="number" step="0.0001" min="0.0001" value="1" placeholder="1 หน่วย = กี่ ${esc(product.unit || 'ชิ้น')}" oninput="v42UpdateUnitProfit('${js(product.id)}','add')"></div>
              <div class="v42-field"><label>ราคาขาย/หน่วย</label><input id="v42-add-price" type="number" min="0" placeholder="0" oninput="v42UpdateUnitProfit('${js(product.id)}','add')"></div>
              <button onclick="v42AddUnit('${js(product.id)}')"><i class="material-icons-round" style="font-size:18px;vertical-align:middle">add</i> เพิ่ม</button>
            </div>
            <div class="v42-live-profit" id="v42-add-profit">${liveProfitCards(addCalc)}</div>
          </div>
          <div class="v42-help">
            ระบบคิดให้ทันที: ราคาขายต่อหน่วย - (ต้นทุนฐาน x อัตราแปลง) เช่น ต้นทุนฐาน 10 บาท และ 1 ลัง = 12 ชิ้น ต้นทุนต่อลัง = 120 บาท ถ้าขายลังละ 150 บาท กำไร = 30 บาท
          </div>
        </div>
      </div>`;
    Swal.fire({ html, width: 920, showConfirmButton: false, showCloseButton: true, customClass: { popup: 'v42-action-popup' } });
  };

  window.v9ShowUnitModal = function (productId) {
    return window.v42ShowUnitModal(productId);
  };

  window.v42AddUnit = async function (productId) {
    const name = document.getElementById('v42-add-name')?.value.trim();
    const rate = num(document.getElementById('v42-add-rate')?.value);
    const price = num(document.getElementById('v42-add-price')?.value);
    if (!name || rate <= 0) { toast?.('กรุณากรอกชื่อหน่วยและอัตราแปลง', 'warning'); return; }
    const { error } = await db.from('product_units').insert({ product_id: productId, unit_name: name, conv_rate: rate, price_per_unit: price, is_base: false });
    if (error) { toast?.('เพิ่มหน่วยไม่สำเร็จ: ' + error.message, 'error'); return; }
    if (window._v9UnitCache) delete window._v9UnitCache[productId];
    toast?.('เพิ่มหน่วยนับแล้ว', 'success');
    window.v42ShowUnitModal(productId);
  };

  window.v42SaveUnit = async function (unitId, productId) {
    const name = document.getElementById('v42-u-name-' + unitId)?.value.trim();
    const rate = num(document.getElementById('v42-u-rate-' + unitId)?.value);
    const price = num(document.getElementById('v42-u-price-' + unitId)?.value);
    if (!name || rate <= 0) { toast?.('ข้อมูลหน่วยไม่ครบ', 'warning'); return; }
    const { error } = await db.from('product_units').update({ unit_name: name, conv_rate: rate, price_per_unit: price }).eq('id', unitId);
    if (error) { toast?.('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
    if (window._v9UnitCache) delete window._v9UnitCache[productId];
    toast?.('บันทึกหน่วยแล้ว', 'success');
    window.v42ShowUnitModal(productId);
  };

  window.v42DeleteUnit = async function (unitId, productId) {
    const ok = await Swal.fire({ title: 'ลบหน่วยนับนี้?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
    if (!ok.isConfirmed) return;
    const { error } = await db.from('product_units').delete().eq('id', unitId);
    if (error) { toast?.('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
    if (window._v9UnitCache) delete window._v9UnitCache[productId];
    toast?.('ลบหน่วยแล้ว', 'success');
    window.v42ShowUnitModal(productId);
  };

  function hideManageUnitTab() {
    document.querySelectorAll('#page-manage button').forEach(btn => {
      const text = (btn.textContent || '').replace(/\s+/g, '');
      if (text.includes('หน่วยนับ')) btn.remove();
    });
  }

  setInterval(hideManageUnitTab, 1200);
  document.addEventListener('DOMContentLoaded', hideManageUnitTab);
})();
