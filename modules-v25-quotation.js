/**
 * SK POS — modules-v25-quotation.js
 * ████████████████████████████████████████████████████████████████████
 *  1. ระบบใบเสนอราคาครบวงจร (Dummy Product + สินค้านอกระบบ)
 *  2. Override v9PrintQuotation → ใช้ v24 template (ใบเสนอราคา)
 *  3. Override v12DQPrintNote → ใช้ v24 template (ใบส่งของ) สวยงาม
 *  4. ซ่อนสินค้าระบบจากหน้า POS/คลัง
 *  5. แปลงใบเสนอราคาเป็นบิลขาย (skip stock dummy)
 * ████████████████████████████████████████████████████████████████████
 */
'use strict';

/* ═══════════════════════════════════════════════
   1. DUMMY PRODUCT — ใส่ UUID ของสินค้าจำลองที่สร้างไว้
═══════════════════════════════════════════════ */
// TODO: เปลี่ยน UUID นี้เป็น ID จริงของสินค้า "สินค้านอกระบบ" ที่สร้างใน Supabase
const DUMMY_PRODUCT_ID = '00000000-0000-0000-0000-000000000000';

/* ═══════════════════════════════════════════════
   2. ซ่อนสินค้า product_type='ระบบ' จากหน้า POS/คลัง
      — override loadProducts เพื่อ filter ออก
      — ไม่กระทบ query by ID โดยตรง
═══════════════════════════════════════════════ */
const _v25OrigLoadProducts = window.loadProducts;
window.loadProducts = async function () {
  await _v25OrigLoadProducts?.apply(this, arguments);
  // กรองสินค้า product_type='ระบบ' ออกจาก products array
  if (typeof products !== 'undefined' && Array.isArray(products)) {
    products = products.filter(p => p.product_type !== 'ระบบ');
    // sync cache
    try { window._v9ProductsCache = products; } catch (_) { }
  }
};

/* ═══════════════════════════════════════════════
   3. Override v9ShowQuotModal — ใบเสนอราคา + สินค้านอกระบบ
      — ยกเลิกเช็ค stock <= 0
      — เพิ่มปุ่ม "+ สินค้านอกระบบ" (custom)
      — เพิ่ม flag isCustom: true
═══════════════════════════════════════════════ */
window._v25QuotItems = [];

window.v9ShowQuotModal = async function () {
  window._v25QuotItems = [];
  if (typeof openModal !== 'function') return;

  await loadProducts?.();
  // โหลดสินค้าทั้งหมด (ไม่จำกัด stock) สำหรับ dropdown
  let quotProds = [];
  try {
    const { data } = await db.from('สินค้า').select('*')
      .neq('product_type', 'ระบบ')  // ซ่อน dummy
      .order('name');
    quotProds = data || [];
  } catch (_) {
    quotProds = (typeof products !== 'undefined' ? products : []);
  }

  const _render = () => {
    const el = document.getElementById('v25q-items');
    if (!el) return;
    if (!window._v25QuotItems.length) {
      el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-tertiary);
        border:2px dashed var(--border-light);border-radius:10px;font-size:13px">
        <i class="material-icons-round" style="font-size:32px;display:block;margin-bottom:6px;opacity:.3">add_shopping_cart</i>
        กดปุ่มด้านบนเพื่อเพิ่มสินค้า</div>`;
      _calcTotal();
      return;
    }
    el.innerHTML = window._v25QuotItems.map((it, i) => `
      <div style="display:grid;grid-template-columns:2fr 70px 70px 100px 28px;
        gap:6px;align-items:center;padding:8px 10px;
        background:${it.isCustom ? '#fef3c720' : 'var(--bg-base)'};
        border-radius:8px;margin-bottom:5px;
        border:1px solid ${it.isCustom ? '#fde68a' : 'var(--border-light)'}">
        <div style="display:flex;align-items:center;gap:6px">
          ${it.isCustom ? '<span style="font-size:9px;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:4px;font-weight:700">นอกระบบ</span>' : ''}
          <input value="${it.name}" placeholder="ชื่อสินค้า"
            style="flex:1;padding:5px 8px;border:1px solid var(--border-light);border-radius:6px;font-size:12px"
            oninput="window._v25QuotItems[${i}].name=this.value;window._v25CalcTotal()">
        </div>
        <input type="number" value="${it.qty}" min="0.01" step="any"
          style="padding:5px 4px;border:1px solid var(--border-light);border-radius:6px;font-size:12px;text-align:center"
          oninput="window._v25QuotItems[${i}].qty=parseFloat(this.value||1);window._v25CalcTotal()">
        <input value="${it.unit}" placeholder="หน่วย"
          style="padding:5px 4px;border:1px solid var(--border-light);border-radius:6px;font-size:12px;text-align:center"
          oninput="window._v25QuotItems[${i}].unit=this.value">
        <input type="number" value="${it.price}" min="0" step="any"
          style="padding:5px 4px;border:1px solid var(--border-light);border-radius:6px;font-size:12px;text-align:right"
          oninput="window._v25QuotItems[${i}].price=parseFloat(this.value||0);window._v25CalcTotal()">
        <button onclick="window._v25QuotItems.splice(${i},1);window._v25RenderItems()"
          style="background:none;border:none;cursor:pointer;color:#ef4444;padding:0">
          <i class="material-icons-round" style="font-size:16px">close</i>
        </button>
      </div>`).join('');
    _calcTotal();
  };

  const _calcTotal = () => {
    const sub = (window._v25QuotItems || []).reduce((s, i) => s + (i.qty * i.price), 0);
    const disc = parseFloat(document.getElementById('v25q-disc')?.value || 0);
    const tot = Math.max(0, sub - disc);
    const el = document.getElementById('v25q-total');
    if (el) el.textContent = `฿${typeof formatNum === 'function' ? formatNum(Math.round(tot)) : tot.toFixed(2)}`;
  };

  window._v25RenderItems = _render;
  window._v25CalcTotal = _calcTotal;

  // เพิ่มสินค้าจากคลัง (ไม่เช็ค stock)
  window._v25AddFromStock = (prodId) => {
    const prod = quotProds.find(p => p.id === prodId);
    if (!prod) return;
    window._v25QuotItems.push({
      product_id: prod.id,
      name: prod.name,
      qty: 1,
      unit: prod.unit || 'ชิ้น',
      price: prod.price || 0,
      isCustom: false
    });
    _render();
  };

  // เพิ่มสินค้านอกระบบ (popup)
  window._v25AddCustom = async () => {
    const { value: formValues, isConfirmed } = await Swal.fire({
      title: '➕ เพิ่มสินค้านอกระบบ',
      html: `
        <div style="text-align:left;display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:12px;font-weight:600;color:#64748b">ชื่อสินค้า / บริการ *</label>
            <input id="v25c-name" class="swal2-input" placeholder="เช่น หินผสม A, งานติดตั้ง" style="margin:4px 0;width:100%">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div>
              <label style="font-size:12px;font-weight:600;color:#64748b">จำนวน *</label>
              <input id="v25c-qty" type="number" class="swal2-input" value="1" min="0.01" step="any" style="margin:4px 0;width:100%">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#64748b">หน่วย</label>
              <input id="v25c-unit" class="swal2-input" value="ชิ้น" style="margin:4px 0;width:100%">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#64748b">ราคา/หน่วย *</label>
              <input id="v25c-price" type="number" class="swal2-input" value="0" min="0" step="any" style="margin:4px 0;width:100%">
            </div>
          </div>
        </div>`,
      confirmButtonText: '✅ เพิ่มรายการ',
      cancelButtonText: 'ยกเลิก',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      preConfirm: () => {
        const name = document.getElementById('v25c-name')?.value?.trim();
        if (!name) { Swal.showValidationMessage('กรุณากรอกชื่อสินค้า'); return false; }
        return {
          name,
          qty: parseFloat(document.getElementById('v25c-qty')?.value || 1),
          unit: document.getElementById('v25c-unit')?.value || 'ชิ้น',
          price: parseFloat(document.getElementById('v25c-price')?.value || 0)
        };
      }
    });
    if (!isConfirmed || !formValues) return;
    window._v25QuotItems.push({
      product_id: DUMMY_PRODUCT_ID,
      name: formValues.name,
      qty: formValues.qty,
      unit: formValues.unit,
      price: formValues.price,
      isCustom: true  // flag สินค้านอกระบบ
    });
    _render();
  };



  const prodOpts = quotProds.map(p =>
    `<option value="${p.id}">${p.name} — ฿${typeof formatNum === 'function' ? formatNum(p.price) : p.price}${p.stock <= 0 ? ' (หมด)' : ''}</option>`
  ).join('');

  openModal('สร้างใบเสนอราคา', `
    <div>
      <!-- ข้อมูลลูกค้า + วันที่ -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="form-group" style="margin:0">
          <label class="form-label">ชื่อลูกค้า *</label>
          <input class="form-input" id="v25q-cust" placeholder="ชื่อลูกค้า / บริษัท" required>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">วันหมดอายุ</label>
          <input class="form-input" type="date" id="v25q-valid"
            value="${new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}">
        </div>
      </div>

      <!-- ปุ่มเพิ่มสินค้า -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <label class="form-label" style="margin:0;font-weight:700">รายการสินค้า / บริการ</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <select id="v25q-prod-sel" class="form-input" style="font-size:11px;width:180px">
            <option value="">🔍 เลือกจากคลัง</option>${prodOpts}
          </select>
          <button type="button" class="btn btn-outline btn-sm"
            onclick="const s=document.getElementById('v25q-prod-sel');if(s.value){window._v25AddFromStock(s.value);s.value=''}">
            เพิ่ม
          </button>
          <button type="button" class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer"
            onclick="window._v25AddCustom()">
            <i class="material-icons-round" style="font-size:13px;vertical-align:middle">inventory_2</i> + สินค้านอกระบบ
          </button>
          
        </div>
      </div>

      <!-- Header columns -->
      <div style="display:grid;grid-template-columns:2fr 70px 70px 100px 28px;gap:6px;
        padding:4px 10px;margin-bottom:4px">
        <span style="font-size:10px;color:var(--text-tertiary);font-weight:600">รายการ</span>
        <span style="font-size:10px;color:var(--text-tertiary);font-weight:600;text-align:center">จำนวน</span>
        <span style="font-size:10px;color:var(--text-tertiary);font-weight:600;text-align:center">หน่วย</span>
        <span style="font-size:10px;color:var(--text-tertiary);font-weight:600;text-align:right">ราคา/หน่วย</span>
        <span></span>
      </div>

      <div id="v25q-items" style="min-height:60px;margin-bottom:12px;max-height:300px;overflow-y:auto"></div>

      <!-- ส่วนลด + ยอดรวม -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:10px 14px;background:var(--bg-base);border-radius:8px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:12px;color:var(--text-secondary)">ส่วนลด (฿)</span>
          <input type="number" id="v25q-disc" value="0" min="0"
            oninput="window._v25CalcTotal()"
            style="width:100px;padding:5px 8px;border:1px solid var(--border-light);border-radius:6px;font-size:13px;text-align:right">
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:var(--text-tertiary)">ยอดรวม</div>
          <div id="v25q-total" style="font-size:22px;font-weight:700;color:var(--primary)">฿0</div>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">หมายเหตุ</label>
        <input class="form-input" id="v25q-note" placeholder="(ถ้ามี)">
      </div>

      <button type="button" class="btn btn-primary" style="width:100%"
        onclick="window._v25SaveQuot()">
        <i class="material-icons-round">save</i> บันทึกใบเสนอราคา
      </button>
    </div>`);

  _render();
};

// expose
window.showAddQuotationModal = window.v9ShowQuotModal;

/* ═══════════════════════════════════════════════
   4. บันทึกใบเสนอราคา — ไม่ตัด stock เด็ดขาด
═══════════════════════════════════════════════ */
window._v25SaveQuot = async function () {
  const customer = document.getElementById('v25q-cust')?.value?.trim();
  if (!customer) { typeof toast === 'function' && toast('กรุณากรอกชื่อลูกค้า', 'error'); return; }
  const items = window._v25QuotItems || [];
  if (!items.length || !items.some(i => i.name)) {
    typeof toast === 'function' && toast('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ', 'error'); return;
  }
  const discount = parseFloat(document.getElementById('v25q-disc')?.value || 0);
  const subtotal = items.reduce((s, i) => s + (i.qty * i.price), 0);
  const total = Math.max(0, subtotal - discount);
  const valid = document.getElementById('v25q-valid')?.value || null;
  const note = document.getElementById('v25q-note')?.value || '';
  const staff = typeof v9Staff === 'function' ? v9Staff() : ((typeof USER !== 'undefined' && USER) ? USER.username : '-');

  if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังบันทึก...');
  try {
    // Insert ใบเสนอราคา (ไม่ตัด stock)
    const { data: quot, error: qe } = await db.from('ใบเสนอราคา').insert({
      customer_name: customer, total, discount,
      date: new Date().toISOString(),
      valid_until: valid ? new Date(valid).toISOString() : null,
      note: note || null, staff_name: staff,
    }).select().single();
    if (qe) throw new Error(qe.message);

    // Insert รายการ (ใช้ DUMMY_PRODUCT_ID สำหรับสินค้านอกระบบ)
    for (const it of items) {
      const pid = it.isCustom ? DUMMY_PRODUCT_ID : (it.product_id || null);
      await db.from('รายการใบเสนอราคา').insert({
        quotation_id: quot.id,
        product_id: pid,
        name: it.name,
        qty: it.qty,
        unit: it.unit || 'ชิ้น',
        price: it.price,
        total: it.qty * it.price,
      });
    }
    // *** ไม่มีการ UPDATE stock เด็ดขาด ***

    typeof closeModal === 'function' && closeModal();
    typeof toast === 'function' && toast('บันทึกใบเสนอราคาสำเร็จ', 'success');
    window.renderQuotations?.();
  } catch (e) {
    typeof toast === 'function' && toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
  } finally { if (typeof v9HideOverlay === 'function') v9HideOverlay(); }
};

/* ═══════════════════════════════════════════════
   5. แปลงใบเสนอราคาเป็นบิลขาย — ตัดสต็อกเฉพาะสินค้าจริง
═══════════════════════════════════════════════ */
window.v9ConvertQuotation = async function (quotId, customerName) {
  const r = await Swal.fire({
    title: '🛒 สร้างบิลขายจากใบเสนอราคา?',
    html: `<div style="font-size:14px;color:#64748b">จากใบเสนอราคาของ <strong>${customerName}</strong></div>
           <div style="margin-top:8px;font-size:12px;color:#94a3b8">ระบบจะตัดสต็อกเฉพาะสินค้าในคลังเท่านั้น (สินค้านอกระบบจะข้ามการตัดสต็อก)</div>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '✅ สร้างบิลขาย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#10B981',
  });
  if (!r.isConfirmed) return;

  if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังแปลงเป็นบิล...');
  try {
    // ดึงรายการใบเสนอราคา
    const { data: quotItems } = await db.from('รายการใบเสนอราคา')
      .select('*').eq('quotation_id', quotId);
    const { data: quot } = await db.from('ใบเสนอราคา').select('*')
      .eq('id', quotId).maybeSingle();
    if (!quot) throw new Error('ไม่พบใบเสนอราคา');

    const staffName = typeof v9Staff === 'function' ? v9Staff() : ((typeof USER !== 'undefined' && USER) ? USER.username : '-');

    // สร้างบิลขาย
    const { data: bill, error: be } = await db.from('บิลขาย').insert({
      bill_no: Date.now(),
      customer_name: quot.customer_name,
      total: quot.total,
      discount: quot.discount || 0,
      method: 'เงินสด',
      status: 'สำเร็จ',
      date: new Date().toISOString(),
      staff_name: staffName,
      delivery_mode: 'รับเอง',
      delivery_status: '-',
    }).select().single();
    if (be) throw new Error(be.message);

    // Insert รายการในบิล + ตัดสต็อกเฉพาะสินค้าจริง
    for (const it of (quotItems || [])) {
      await db.from('รายการในบิล').insert({
        bill_id: bill.id,
        product_id: it.product_id,
        name: it.name,
        qty: it.qty,
        unit: it.unit || 'ชิ้น',
        price: it.price,
        total: it.total || (it.qty * it.price),
        take_qty: it.qty,
        deliver_qty: 0,
      });

      // ══ ตัดสต็อก: SKIP ถ้าเป็น DUMMY หรือไม่มี product_id ══
      if (!it.product_id || it.product_id === DUMMY_PRODUCT_ID) {
        console.log(`[v25] Skip stock for custom item: ${it.name}`);
        continue;
      }

      // ดึง stock ปัจจุบัน
      const { data: prod } = await db.from('สินค้า').select('stock,has_units,name')
        .eq('id', it.product_id).maybeSingle();
      if (!prod) continue;

      const stockBefore = prod.stock || 0;
      // ใช้ unit conversion ถ้ามี
      let deductQty = it.qty;
      if (prod.has_units) {
        try {
          const { data: units } = await db.from('product_units')
            .select('multiplier').eq('product_id', it.product_id)
            .eq('unit_name', it.unit).maybeSingle();
          if (units?.multiplier) deductQty = it.qty * units.multiplier;
        } catch (_) { }
      }

      const stockAfter = stockBefore - deductQty;
      await db.from('สินค้า').update({ stock: stockAfter }).eq('id', it.product_id);

      try {
        await db.from('stock_movement').insert({
          product_id: it.product_id, product_name: it.name,
          type: 'ขาย', direction: 'out', qty: deductQty,
          stock_before: stockBefore, stock_after: stockAfter,
          ref_id: bill.id, ref_table: 'บิลขาย',
          staff_name: staffName,
        });
      } catch (_) { }
    }

    // อัปเดตสถานะใบเสนอราคา
    await db.from('ใบเสนอราคา').update({
      status: 'อนุมัติ',
      converted_bill_id: bill.id
    }).eq('id', quotId);

    typeof toast === 'function' && toast(`สร้างบิลขาย #${bill.bill_no} สำเร็จ! สินค้าในคลังถูกตัดสต็อกแล้ว`, 'success');
    window.renderQuotations?.();
    await loadProducts?.();

  } catch (e) {
    typeof toast === 'function' && toast('ไม่สำเร็จ: ' + e.message, 'error');
  } finally { if (typeof v9HideOverlay === 'function') v9HideOverlay(); }
};

/* ═══════════════════════════════════════════════
   6. Override v9PrintQuotation → ใช้ v24 template
      แก้ปัญหาพิมพ์ใบเสนอราคาแต่ได้ใบชำระเงิน
═══════════════════════════════════════════════ */
window.v9PrintQuotation = async function (quotId) {
  if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังเตรียมพิมพ์...');
  try {
    const [{ data: quot }, { data: items }] = await Promise.all([
      db.from('ใบเสนอราคา').select('*').eq('id', quotId).maybeSingle(),
      db.from('รายการใบเสนอราคา').select('*').eq('quotation_id', quotId),
    ]);
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    if (!quot) { typeof toast === 'function' && toast('ไม่พบใบเสนอราคา', 'error'); return; }

    // แปลงข้อมูลเป็น format ที่ v24PrintDocument รับ
    const fakeBill = {
      bill_no: `QT-${String(quotId).slice(-6).toUpperCase()}`,
      date: quot.date || quot.created_at,
      customer_name: quot.customer_name || 'ลูกค้า',
      total: quot.total || 0,
      discount: quot.discount || 0,
      method: '-',
      staff_name: quot.staff_name || '-',
    };
    const fakeItems = (items || []).map(i => ({
      name: i.name,
      qty: i.qty,
      unit: i.unit || 'ชิ้น',
      price: i.price,
      total: i.total || (i.qty * i.price),
    }));

    // เรียก v24PrintDocument ด้วย docType = 'quotation'
    await v24PrintDocument(fakeBill, fakeItems, 'quotation');
  } catch (e) {
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    typeof toast === 'function' && toast('พิมพ์ไม่ได้: ' + e.message, 'error');
  }
};

/* ═══════════════════════════════════════════════
   7. Override ใบส่งของในคิวจัดส่ง → ใช้ v24 design
═══════════════════════════════════════════════ */
window.v12DQPrintNote = async function (billId) {
  // เรียก v12PrintDeliveryNote ที่ v24 override ไว้แล้ว
  // ซึ่งจะใช้ v24PrintDocument(bill, items, 'delivery')
  if (typeof v12PrintDeliveryNote === 'function') {
    await v12PrintDeliveryNote(billId);
  }
};

/* ═══ BOOT ═══ */
console.info('%c[v25] ✅%c Quotation System + Delivery v24 — loaded', 'color:#f59e0b;font-weight:900', 'color:#6B7280');
