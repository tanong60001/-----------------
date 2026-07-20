// V103: concrete workflow inside the existing recipe product and POS flow.
(function () {
  'use strict';

  const SETTINGS_TABLE = 'concrete_recipe_settings';
  const PLAN_TABLE = 'concrete_delivery_plans';
  const LOCAL_KEY = 'sk_concrete_recipe_settings_v103';
  const DEFAULT_CONFIG = Object.freeze({
    truck_capacity_m3: 4,
    charge_empty_space: false,
    empty_threshold_m3: 0.001,
    empty_fee_per_m3: 0,
  });
  // ค่าส่วนต่างรถไม่เต็มคิดเฉพาะออเดอร์ขนาดเล็ก 1–2 คิวเท่านั้น
  // ตั้งใจใช้จากยอดรวมของออเดอร์ เพื่อไม่ให้เที่ยวสุดท้ายของหลายเที่ยวถูกคิดเพิ่ม
  const EMPTY_SPACE_SURCHARGE_MAX_ORDER_M3 = 2;
  const state = {
    settings: new Map(),
    loaded: false,
    loading: null,
    tableWarningShown: false,
    deliveryFilter: 'today',
  };

  const num = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const round3 = value => Number(num(value).toFixed(3));
  const round2 = value => Number(num(value).toFixed(2));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
  const fmt = value => num(value).toLocaleString('th-TH', { maximumFractionDigits: 3 });
  const money = value => num(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function todayKey() {
    try { if (typeof appLocalDateKey === 'function') return appLocalDateKey(); } catch (_) {}
    const date = new Date();
    const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return shifted.toISOString().slice(0, 10);
  }

  function staffName() {
    try { return USER?.username || USER?.name || ''; } catch (_) { return ''; }
  }

  function normalizeConfig(raw = {}) {
    const capacity = Math.max(0.001, num(raw.truck_capacity_m3 ?? raw.capacity_m3 ?? DEFAULT_CONFIG.truck_capacity_m3));
    return {
      truck_capacity_m3: round3(capacity),
      charge_empty_space: raw.charge_empty_space === true || raw.charge_empty_space === 'true' || raw.charge_empty_space === 1,
      empty_threshold_m3: Math.max(0, round3(raw.empty_threshold_m3 ?? DEFAULT_CONFIG.empty_threshold_m3)),
      empty_fee_per_m3: Math.max(0, round2(raw.empty_fee_per_m3 ?? DEFAULT_CONFIG.empty_fee_per_m3)),
    };
  }

  function readLocalSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
  }

  function writeLocalSettings() {
    try {
      const data = {};
      state.settings.forEach((value, key) => { data[key] = value; });
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  async function loadSettings(force = false) {
    if (state.loaded && !force) return state.settings;
    if (state.loading && !force) return state.loading;
    state.loading = (async () => {
      const local = readLocalSettings();
      Object.entries(local).forEach(([id, config]) => state.settings.set(String(id), normalizeConfig(config)));
      try {
        if (typeof db !== 'undefined') {
          const { data, error } = await db.from(SETTINGS_TABLE).select('*');
          if (error) throw error;
          (data || []).forEach(row => state.settings.set(String(row.product_id), normalizeConfig(row)));
          writeLocalSettings();
        }
      } catch (error) {
        console.warn('[v103] concrete settings table is not ready; using this device cache', error?.message || error);
      }
      state.loaded = true;
      state.loading = null;
      return state.settings;
    })();
    return state.loading;
  }

  function getConfig(productId) {
    return normalizeConfig(state.settings.get(String(productId)) || DEFAULT_CONFIG);
  }

  async function saveConfig(productId, raw) {
    const id = String(productId || '');
    if (!id) throw new Error('ไม่พบรหัสสูตรคอนกรีต');
    const config = normalizeConfig(raw);
    state.settings.set(id, config);
    writeLocalSettings();
    try {
      const { error } = await db.from(SETTINGS_TABLE).upsert({
        product_id: id,
        ...config,
        updated_at: new Date().toISOString(),
        updated_by: staffName(),
      }, { onConflict: 'product_id' });
      if (error) throw error;
      return { config, remote: true };
    } catch (error) {
      console.warn('[v103] save concrete settings locally only', error?.message || error);
      return { config, remote: false, error };
    }
  }

  async function deleteConfig(productId) {
    const id = String(productId || '');
    state.settings.delete(id);
    writeLocalSettings();
    try { await db.from(SETTINGS_TABLE).delete().eq('product_id', id); } catch (_) {}
  }

  function buildPlans(quantity, rawConfig, requestMixDesign = false) {
    const qty = Math.max(0, round3(quantity));
    const config = normalizeConfig(rawConfig);
    if (qty <= 0) return [];
    const isSmallOrderEligibleForSurcharge = qty <= EMPTY_SPACE_SURCHARGE_MAX_ORDER_M3;
    const totalPlans = Math.max(1, Math.ceil((qty - 0.0000001) / config.truck_capacity_m3));
    let remaining = qty;
    const plans = [];
    for (let i = 1; i <= totalPlans; i += 1) {
      const tripQty = round3(Math.min(config.truck_capacity_m3, remaining));
      const empty = round3(Math.max(0, config.truck_capacity_m3 - tripQty));
      const charge = isSmallOrderEligibleForSurcharge
        && config.charge_empty_space
        && empty + 0.000001 >= config.empty_threshold_m3
        ? round2(empty * config.empty_fee_per_m3)
        : 0;
      plans.push({
        plan_no: i,
        total_plans: totalPlans,
        quantity_m3: tripQty,
        truck_capacity_m3: config.truck_capacity_m3,
        empty_m3: empty,
        surcharge: charge,
        request_mix_design: !!requestMixDesign,
        status: 'รอผลิต',
      });
      remaining = round3(Math.max(0, remaining - tripQty));
    }
    return plans;
  }

  function syncConcreteCart(list, item, removedProductId = null) {
    if (!Array.isArray(list)) return list;
    const linkedId = String(removedProductId || item?.id || item?.concrete_product_id || '');
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const row = list[i];
      if (row?.__v103_concrete_surcharge && String(row.concrete_product_id || '') === linkedId) list.splice(i, 1);
    }
    if (!item || !item.__v103_concrete_sale || num(item.qty) <= 0) return list;

    const config = normalizeConfig(item.concrete_config || getConfig(item.id));
    const requestMix = item.concrete_request_mix_design === true;
    const plans = buildPlans(item.qty, config, requestMix);
    const surcharge = round2(plans.reduce((sum, plan) => sum + num(plan.surcharge), 0));
    item.concrete_config = config;
    item.concrete_delivery_plans = plans;
    item.concrete_surcharge_total = surcharge;
    item.concrete_total_trips = plans.length;
    item.concrete_request_mix_design = requestMix;
    item.unit = item.unit || 'คิว';
    item.unit_name = item.unit_name || item.unit;

    if (surcharge > 0) {
      const last = plans[plans.length - 1];
      list.push({
        id: `concrete-empty-${item.id}`,
        product_id: null,
        name: `ค่ารถไม่เต็ม • ${item.name || 'คอนกรีต'} (ว่าง ${fmt(last?.empty_m3 || 0)} คิว)`,
        qty: 1,
        price: surcharge,
        original_price: surcharge,
        cost: 0,
        total: surcharge,
        stock: 999999,
        unit: 'รายการ',
        unit_name: 'รายการ',
        conv_rate: 1,
        is_mto: true,
        is_extra_charge: true,
        __v103_concrete_surcharge: true,
        concrete_product_id: item.id,
      });
    }
    return list;
  }

  function popupPlansHtml(plans) {
    if (!plans.length) return '<div class="v103-empty">ระบุจำนวนคิวเพื่อสร้างแผนเที่ยว</div>';
    return plans.map(plan => `
      <div class="v103-trip ${plan.empty_m3 > 0 ? 'partial' : 'full'}">
        <span class="v103-trip-no">เที่ยว ${plan.plan_no}</span>
        <strong>${fmt(plan.quantity_m3)} คิว</strong>
        <small>${plan.empty_m3 > 0 ? `ว่าง ${fmt(plan.empty_m3)} คิว` : 'เต็มคัน'}</small>
        ${plan.surcharge > 0 ? `<b>+฿${money(plan.surcharge)}</b>` : ''}
      </div>`).join('');
  }

  async function promptConcreteSale(product, options = {}) {
    if (typeof Swal === 'undefined' || !Swal.fire) return null;
    await loadSettings(false);
    const config = getConfig(product?.id);
    const currentQty = Math.max(0, num(options.currentQty || 0));
    const suggested = currentQty > 0 ? currentQty : 1;
    const maxQty = Math.max(suggested, num(options.maxQty || suggested));
    const stoneOptions = (Array.isArray(options.stoneOptions) ? options.stoneOptions : [])
      .filter(option => option?.material_id)
      .map(option => ({
        material_id: String(option.material_id),
        material_name: option.material_name || 'หิน',
        variant: option.variant || '',
        stock: Math.max(0, num(option.stock)),
        unit: option.unit || '',
        max_quantity_m3: Math.max(0, num(option.max_quantity_m3)),
      }));
    const currentStoneId = String(options.currentStoneChoice?.material_id || '');
    const defaultStone = stoneOptions.find(option => option.material_id === currentStoneId)
      || stoneOptions.find(option => option.max_quantity_m3 > 0)
      || stoneOptions[0]
      || null;
    const currentRequestMix = options.currentRequestMixDesign === true;
    const result = await Swal.fire({
      title: '',
      width: '920px',
      showCancelButton: true,
      confirmButtonText: 'เพิ่มลงบิลและสร้างแผน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0f766e',
      customClass: { popup: 'v103-swal' },
      html: `
        <div class="v103-sale">
          <section class="v103-hero">
            <div class="v103-hero-icon"><i class="material-icons-round">precision_manufacturing</i></div>
            <div><span>CONCRETE ORDER</span><h2>${esc(product?.name || 'คอนกรีต')}</h2><p>วางแผนผลิตและเที่ยวส่งก่อนเพิ่มลงบิล</p></div>
            <div class="v103-cap"><span>รถเต็ม/เที่ยว</span><b>${fmt(config.truck_capacity_m3)} คิว</b></div>
          </section>
          <div class="v103-form-grid">
            <section class="v103-panel">
              <label class="v103-label">จำนวนคอนกรีตทั้งหมด (คิว)</label>
              <div class="v103-qty"><button type="button" data-v103-step="-1">−</button><input id="v103-qty" type="number" min="0.001" step="0.1" max="${esc(maxQty)}" value="${esc(suggested)}"><button type="button" data-v103-step="1">+</button></div>
              <div class="v103-available">วัตถุดิบรองรับสูงสุด <b id="v103-available-max">${fmt(defaultStone ? defaultStone.max_quantity_m3 : maxQty)} คิว</b></div>
              ${stoneOptions.length ? `
                <div class="v103-stone-head"><div><i class="material-icons-round">lock</i><span><b>เลือกชนิดหินสำหรับผลิต</b><small>อัตราใช้ถูกล็อกตามสูตร พนักงานเลือกเฉพาะกองหิน</small></span></div><em>จำเป็น</em></div>
                <div class="v103-stone-choice">
                  ${stoneOptions.map((stone, index) => `<label>
                    <input type="radio" name="v103-stone" value="${esc(stone.material_id)}" ${(defaultStone?.material_id === stone.material_id || (!defaultStone && index === 0)) ? 'checked' : ''}>
                    <span><i class="material-icons-round">landscape</i><b>${esc(stone.material_name)}</b><small>คงเหลือ ${fmt(stone.stock)} ${esc(stone.unit)} • ผลิตได้ ${fmt(stone.max_quantity_m3)} คิว</small></span>
                  </label>`).join('')}
                </div>` : ''}
              <label class="v103-label" style="margin-top:18px">ลูกค้าขอ Mix Design หรือไม่?</label>
              <div class="v103-choice">
                <label><input type="radio" name="v103-mix" value="yes" ${currentRequestMix ? 'checked' : ''}><span><i class="material-icons-round">description</i><b>รับ Mix Design</b><small>แนบรายละเอียดสูตรในเอกสาร</small></span></label>
                <label><input type="radio" name="v103-mix" value="no" ${currentRequestMix ? '' : 'checked'}><span><i class="material-icons-round">receipt_long</i><b>ไม่รับ</b><small>พิมพ์เฉพาะบิลและแผนส่ง</small></span></label>
              </div>
            </section>
            <section class="v103-panel v103-plan-panel">
              <div class="v103-plan-head"><div><span>แผนเที่ยวส่งจริง</span><b id="v103-plan-count">-</b></div><div><span>ค่ารถไม่เต็ม</span><b id="v103-plan-fee">฿0.00</b></div></div>
              <div id="v103-plan-list" class="v103-plan-list"></div>
            </section>
          </div>
        </div>`,
      didOpen: () => {
        const qtyEl = document.getElementById('v103-qty');
        const selectedStone = () => {
          const id = document.querySelector('input[name="v103-stone"]:checked')?.value || '';
          return stoneOptions.find(option => option.material_id === id) || defaultStone;
        };
        const render = () => {
          const request = document.querySelector('input[name="v103-mix"]:checked')?.value === 'yes';
          const plans = buildPlans(qtyEl?.value, config, request);
          const fee = plans.reduce((sum, plan) => sum + num(plan.surcharge), 0);
          const count = document.getElementById('v103-plan-count');
          const feeEl = document.getElementById('v103-plan-fee');
          const list = document.getElementById('v103-plan-list');
          const available = document.getElementById('v103-available-max');
          const activeStone = selectedStone();
          const activeMax = activeStone ? activeStone.max_quantity_m3 : maxQty;
          if (qtyEl) qtyEl.max = String(activeMax);
          if (available) available.textContent = `${fmt(activeMax)} คิว`;
          if (count) count.textContent = `${plans.length} เที่ยว`;
          if (feeEl) feeEl.textContent = `฿${money(fee)}`;
          if (list) list.innerHTML = popupPlansHtml(plans);
        };
        qtyEl?.addEventListener('input', render);
        document.querySelectorAll('input[name="v103-mix"]').forEach(input => input.addEventListener('change', render));
        document.querySelectorAll('input[name="v103-stone"]').forEach(input => input.addEventListener('change', render));
        document.querySelectorAll('[data-v103-step]').forEach(button => button.addEventListener('click', () => {
          qtyEl.value = Math.max(0.1, round3(num(qtyEl.value) + num(button.dataset.v103Step)));
          render();
        }));
        render();
      },
      preConfirm: () => {
        const qty = round3(document.getElementById('v103-qty')?.value);
        if (qty <= 0) return Swal.showValidationMessage('กรุณาระบุจำนวนคิว');
        const stoneId = document.querySelector('input[name="v103-stone"]:checked')?.value || '';
        const stoneChoice = stoneOptions.find(option => option.material_id === stoneId) || defaultStone;
        if (stoneOptions.length && !stoneChoice) return Swal.showValidationMessage('กรุณาเลือก หิน 1 หรือ หิน 3/4');
        const activeMax = stoneChoice ? stoneChoice.max_quantity_m3 : maxQty;
        if (qty > activeMax + 0.000001) return Swal.showValidationMessage(`${stoneChoice?.material_name || 'วัตถุดิบ'} รองรับได้สูงสุด ${fmt(activeMax)} คิว`);
        const requestMix = document.querySelector('input[name="v103-mix"]:checked')?.value === 'yes';
        const plans = buildPlans(qty, config, requestMix);
        return { qty, requestMix, stoneChoice, config, plans };
      },
    });
    if (!result.isConfirmed || !result.value) return null;
    const value = result.value;
    return {
      replaceQty: true,
      __v103_concrete_sale: true,
      concrete_product_id: product.id,
      concrete_request_mix_design: value.requestMix,
      concrete_stone_choice: value.stoneChoice || null,
      concrete_config: value.config,
      concrete_delivery_plans: value.plans,
      concrete_total_trips: value.plans.length,
      concrete_surcharge_total: round2(value.plans.reduce((sum, plan) => sum + num(plan.surcharge), 0)),
      qty: value.qty,
    };
  }

  function parseInfo(value) {
    if (!value) return {};
    if (typeof value === 'object') return { ...value };
    try { return JSON.parse(value) || {}; } catch (_) { return {}; }
  }

  function concreteInfo(info) {
    const parsed = parseInfo(info);
    return parsed.concrete_delivery && typeof parsed.concrete_delivery === 'object'
      ? parsed.concrete_delivery
      : null;
  }

  function concreteDocumentDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function concreteDocumentShop() {
    try { return window.SHOP_CONFIG || SHOP_CONFIG || {}; } catch (_) { return window.SHOP_CONFIG || {}; }
  }

  function concreteDocumentItems(items) {
    return (items || []).filter(item => !item?.__v103_concrete_surcharge && !item?.is_extra_charge);
  }

  function renderConcreteDocumentPage({ title, subtitle, bill, delivery, content, tripLabel = '', isTrip = false }) {
    const shop = concreteDocumentShop();
    const billNo = bill?.bill_no || bill?.id || '-';
    const phone = bill?.customer_phone || bill?.delivery_phone || '-';
    const customer = `${bill?.customer_name || 'ลูกค้าทั่วไป'} • โทร. ${phone}`;
    const address = bill?.delivery_address || bill?.customer_address || '-';
    const scheduled = bill?.delivery_date || '-';
    return `
      <section class="v103-print-page ${isTrip ? 'v103-print-trip' : 'v103-print-master'}">
        <header class="v103-print-top">
          <div class="v103-print-shop"><div class="v103-print-mark">◆</div><div><h1>${esc(shop.shop_name || 'หจก. เอส เค วัสดุ')}</h1><p>${esc(shop.address || '')}${shop.phone ? ` • โทร. ${esc(shop.phone)}` : ''}</p></div></div>
          <div class="v103-print-title"><b>${esc(title)}</b><span>${esc(subtitle)}</span>${tripLabel ? `<em>${esc(tripLabel)}</em>` : ''}</div>
        </header>
        <div class="v103-print-ref"><span>เลขที่บิลหลัก <b>${esc(billNo)}</b></span><span>วันที่สั่ง ${esc(concreteDocumentDate(bill?.date))}</span><span>พิมพ์ ${esc(concreteDocumentDate())}</span></div>
        <section class="v103-print-customer">
          <div><small>ลูกค้า / CUSTOMER</small><b>${esc(customer)}</b><span>โทร. ${esc(phone)}</span></div>
          <div><small>สถานที่จัดส่ง / DELIVERY ADDRESS</small><b>${esc(address)}</b></div>
          <div><small>กำหนดจัดส่ง</small><b>${esc(scheduled)}</b></div>
        </section>
        ${content}
        <footer class="v103-print-signatures"><div><span>ผู้จัดทำ / ผู้ควบคุมการผลิต</span><i></i><b>วันที่ ____ / ____ / ______</b></div><div><span>พนักงานขับรถ / ผู้ส่ง</span><i></i><b>วันที่ ____ / ____ / ______</b></div><div><span>ผู้รับคอนกรีต / ลูกค้า</span><i></i><b>วันที่ ____ / ____ / ______</b></div></footer>
      </section>`;
  }

  function renderConcreteDocumentHtml(bill, items, delivery) {
    const plans = Array.isArray(delivery?.plans) ? delivery.plans : [];
    const concreteItems = concreteDocumentItems(items).filter(item =>
      (delivery.items || []).some(concrete => String(concrete.product_id) === String(item.product_id || item.id))
    );
    const masterRows = concreteItems.map((item, index) => `
      <tr><td>${index + 1}</td><td><b>${esc(item.name || '')}</b></td><td>${fmt(item.qty)}</td><td>${esc(item.unit || 'คิว')}</td><td>฿${money(item.total ?? (num(item.qty) * num(item.price)))}</td></tr>`).join('') ||
      (delivery.items || []).map((item, index) => `<tr><td>${index + 1}</td><td><b>${esc(item.product_name || '')}</b></td><td>${fmt(item.quantity_m3)}</td><td>คิว</td><td>-</td></tr>`).join('');
    const masterContent = `
      <div class="v103-print-summary"><div><span>จำนวนรวม</span><b>${fmt(delivery.total_quantity_m3)} คิว</b></div><div><span>จำนวนเที่ยว</span><b>${plans.length} เที่ยว</b></div><div><span>ค่าบริการส่วนต่าง</span><b>฿${money(delivery.total_surcharge)}</b></div><div><span>ยอดบิลหลัก</span><b>฿${money(bill?.total)}</b></div></div>
      <h2>สรุปรายการตามบิลหลัก</h2><table class="v103-print-table"><thead><tr><th>#</th><th>รายการคอนกรีต</th><th>จำนวน</th><th>หน่วย</th><th>ยอดรวม</th></tr></thead><tbody>${masterRows}</tbody></table>
      <div class="v103-print-route"><b>แผนการจัดส่ง</b>${plans.map((plan, index) => `<span>เที่ยว ${index + 1}: ${fmt(plan.quantity_m3)} คิว${num(plan.empty_m3) > 0 ? ` (ว่าง ${fmt(plan.empty_m3)} คิว)` : ' (เต็มรถ)'}</span>`).join('')}</div>`;
    // ใบเสร็จและบิลหลักใช้ฟอร์มเดิมของร้านทั้งหมด — เอกสารชุดนี้พิมพ์เฉพาะใบเที่ยว
    const pages = [];
    plans.forEach((plan, index) => {
      const linked = (delivery.items || []).find(item => String(item.product_id) === String(plan.product_id)) || {};
      const stone = linked?.stone_choice?.material_name || '-';
      const tripContent = `
        <div class="v103-print-trip-hero"><div><span>ปริมาณคอนกรีตเที่ยวนี้</span><b>${fmt(plan.quantity_m3)} <small>คิว</small></b></div><div><span>ความจุรถ</span><b>${fmt(plan.truck_capacity_m3)} <small>คิว</small></b></div><div><span>คิวว่าง</span><b>${fmt(plan.empty_m3)} <small>คิว</small></b></div></div>
        <section class="v103-print-load"><div><small>รายการคอนกรีต</small><b>${esc(plan.product_name || linked.product_name || '-')}</b></div><div><small>ชนิดหินที่เลือก</small><b>${esc(stone)}</b></div><div><small>สถานะ</small><b>${esc(tripStatusClass(plan.status) === 'done' ? 'จัดส่งสำเร็จ' : 'รอจัดส่ง')}</b></div></section>
        <section class="v103-print-check"><h2>รายการตรวจรับประจำเที่ยว</h2><div><span>□ ตรวจปริมาณก่อนออกจากโรง</span><span>□ ตรวจสลัมป์ / คุณภาพคอนกรีต</span><span>□ ตรวจสถานที่และผู้รับของ</span><span>□ รับรองการส่งมอบเรียบร้อย</span></div></section>
        <div class="v103-print-note"><b>หมายเหตุสำหรับเที่ยวนี้</b><p>อ้างอิงจากบิลหัวเลขที่ ${esc(bill?.bill_no || bill?.id || '-')} • คำขอ Mix Design: ${plan.request_mix_design ? 'ต้องการ' : 'ไม่ต้องการ'}</p></div>`;
      pages.push(renderConcreteDocumentPage({ title: 'ใบส่งของคอนกรีต', subtitle: 'DELIVERY NOTE • CONCRETE TRIP TICKET', bill, delivery, content: tripContent, tripLabel: `เที่ยว ${index + 1} / ${plans.length}`, isTrip: true }));
    });
    return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>บิลคอนกรีต #${esc(bill?.bill_no || bill?.id || '')}</title>
      <style>@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#e2e8f0;color:#0f172a;font-family:Sarabun,Arial,sans-serif}.v103-print-page{width:210mm;min-height:297mm;background:#fff;padding:13mm 14mm 16mm;page-break-after:always;display:flex;flex-direction:column}.v103-print-top{display:flex;justify-content:space-between;gap:18px;border-bottom:4px solid #0f766e;padding-bottom:11px}.v103-print-shop{display:flex;gap:10px;align-items:center}.v103-print-mark{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:#0f766e;color:#fff;font-size:24px}.v103-print-shop h1{margin:0;font-size:21px}.v103-print-shop p{margin:3px 0 0;color:#64748b;font-size:11px}.v103-print-title{text-align:right}.v103-print-title b{display:block;font-size:23px;color:#0f172a}.v103-print-title span{display:block;color:#0f766e;font-size:10px;font-weight:800;letter-spacing:1.2px}.v103-print-title em{display:inline-block;margin-top:5px;padding:4px 11px;border-radius:999px;background:#ccfbf1;color:#115e59;font-style:normal;font-size:12px;font-weight:900}.v103-print-ref{display:flex;justify-content:space-between;gap:10px;padding:9px 0;color:#64748b;font-size:11px}.v103-print-ref b{color:#0f172a}.v103-print-customer{display:grid;grid-template-columns:1fr 1.45fr .8fr;gap:1px;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#cbd5e1}.v103-print-customer>div{padding:10px;background:#fff;min-height:64px}.v103-print-customer small,.v103-print-load small{display:block;color:#64748b;font-size:10px}.v103-print-customer b,.v103-print-customer span{display:block;margin-top:3px;font-size:12px}.v103-print-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:14px 0}.v103-print-summary div,.v103-print-load>div{border:1px solid #dbeafe;border-radius:10px;padding:11px;background:#f8fafc}.v103-print-summary span,.v103-print-trip-hero span{display:block;font-size:10px;color:#64748b}.v103-print-summary b{display:block;margin-top:4px;font-size:16px;color:#0f766e}.v103-print-page h2{margin:5px 0 8px;font-size:14px}.v103-print-table{width:100%;border-collapse:collapse;font-size:12px}.v103-print-table th{background:#0f766e;color:#fff;text-align:left;padding:8px}.v103-print-table td{padding:9px 8px;border-bottom:1px solid #e2e8f0}.v103-print-table td:nth-child(1),.v103-print-table td:nth-child(3),.v103-print-table td:nth-child(4){text-align:center}.v103-print-table td:last-child{text-align:right}.v103-print-route{margin-top:14px;padding:11px 13px;border-left:4px solid #f97316;background:#fff7ed;border-radius:6px;color:#7c2d12}.v103-print-route b{display:block}.v103-print-route span{display:inline-block;margin:6px 12px 0 0;font-size:12px}.v103-print-trip-hero{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.v103-print-trip-hero>div{padding:17px;border-radius:13px;background:linear-gradient(135deg,#0f766e,#115e59);color:#fff}.v103-print-trip-hero span{color:#ccfbf1}.v103-print-trip-hero b{display:block;margin-top:4px;font-size:31px}.v103-print-trip-hero small{font-size:14px}.v103-print-load{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:9px}.v103-print-load b{display:block;margin-top:5px;font-size:15px}.v103-print-check{margin-top:16px;border:1px solid #cbd5e1;border-radius:11px;padding:13px}.v103-print-check div{display:grid;grid-template-columns:1fr 1fr;gap:13px;font-size:13px}.v103-print-note{margin-top:14px;padding:11px 13px;background:#f8fafc;border-radius:10px;font-size:12px}.v103-print-note p{margin:5px 0 0;color:#475569}.v103-print-signatures{margin-top:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:15px;padding-top:22px}.v103-print-signatures div{text-align:center;font-size:11px}.v103-print-signatures span,.v103-print-signatures b{display:block}.v103-print-signatures i{display:block;height:40px;border-bottom:1px solid #64748b;margin:0 8px 5px}.v103-print-signatures b{font-weight:400;color:#64748b}@media print{body{background:#fff}.v103-print-page{page-break-after:always}.v103-print-page:last-child{page-break-after:auto}}</style>
      <style>
        /* ใช้หน้าตาเดียวกับใบส่งของเดิมของร้าน: แดง/ชมพู/ตารางหัวแดง */
        .v103-print-top{border-bottom-color:#dc2626}.v103-print-mark{display:none}.v103-print-title{background:#dc2626;color:#fff;border-radius:8px;padding:10px 20px;min-width:210px}.v103-print-title b{color:#fff;font-size:19px}.v103-print-title span{color:#fee2e2;font-size:9px}.v103-print-title em{background:#fff;color:#dc2626;border-radius:4px;padding:3px 8px}.v103-print-customer{border-color:#fecdd3;background:#fecdd3;border-radius:7px}.v103-print-customer>div{min-height:60px}.v103-print-customer small{color:#dc2626;font-weight:800}.v103-print-summary div{border-color:#e2e8f0;border-radius:7px;background:#f8fafc;padding:8px}.v103-print-summary b{color:#dc2626;font-size:15px}.v103-print-table th{background:#dc2626;padding:7px}.v103-print-route{border-left-color:#dc2626;background:#fff1f2;color:#991b1b}.v103-print-trip-hero>div{border-radius:7px;background:#fff1f2;border:1px solid #fecdd3;color:#0f172a;padding:13px}.v103-print-trip-hero span{color:#dc2626;font-weight:800}.v103-print-trip-hero b{color:#dc2626;font-size:27px}.v103-print-load>div{border-color:#e2e8f0;border-radius:7px;background:#f8fafc}.v103-print-check{border-color:#fecdd3;border-radius:7px}.v103-print-check h2{color:#dc2626}.v103-print-note{border-left:4px solid #dc2626;border-radius:4px;background:#fff1f2}.v103-print-signatures{grid-template-columns:1fr 1fr;gap:28px}.v103-print-signatures div:last-child{display:none}
      </style>
      </head><body>${pages.join('')}<script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close()},1200)},450)}<\/script></body></html>`;
  }

  window.v103PrintConcreteDocuments = async function (billId) {
    const printWin = window.open('', '_blank', 'width=980,height=1050');
    if (!printWin) { if (typeof toast === 'function') toast('กรุณาอนุญาต popup เพื่อพิมพ์เอกสาร', 'error'); return; }
    try {
      const [{ data: bill, error: billError }, { data: items, error: itemError }] = await Promise.all([
        db.from('บิลขาย').select('*').eq('id', billId).maybeSingle(),
        db.from('รายการในบิล').select('*').eq('bill_id', billId),
      ]);
      if (billError) throw billError;
      if (itemError) throw itemError;
      const delivery = concreteInfo(bill?.return_info);
      if (!bill || !delivery?.plans?.length) throw new Error('ไม่พบแผนเที่ยวคอนกรีตของบิลนี้');
      printWin.document.write(renderConcreteDocumentHtml(bill, items || [], delivery));
      printWin.document.close();
      try { printWin.focus(); } catch (_) {}
    } catch (error) {
      try { printWin.close(); } catch (_) {}
      if (typeof toast === 'function') toast(error.message || String(error), 'error');
    }
  };

  // ส่วนต่อท้ายสำหรับพิมพ์พร้อมใบเสร็จเดิม: เพิ่มเฉพาะใบเที่ยว ไม่แก้ HTML/CSS ของใบเสร็จ
  function renderConcreteTripAppendHtml(bill) {
    const delivery = concreteInfo(bill?.return_info);
    const plans = Array.isArray(delivery?.plans) ? delivery.plans : [];
    if (!plans.length) return '';
    const shop = concreteDocumentShop();
    const billNo = bill?.bill_no || bill?.id || '-';
    const phone = bill?.customer_phone || bill?.delivery_phone || '-';
    const customer = `${bill?.customer_name || 'ลูกค้าทั่วไป'} • โทร. ${phone}`;
    const address = bill?.delivery_address || bill?.customer_address || '-';
    return `<style>
      .v103-trip-append{width:210mm;min-height:297mm;padding:12mm 14mm 15mm;page-break-before:always;break-before:page;color:#0f172a;font-family:Sarabun,Arial,sans-serif;background:#fff}.v103-trip-append *{box-sizing:border-box}.v103-trip-append-head{display:flex;justify-content:space-between;gap:18px;border-bottom:3px solid #dc2626;padding-bottom:10px}.v103-trip-append-shop h1{margin:0;color:#dc2626;font-size:22px;line-height:1.05}.v103-trip-append-shop span{display:block;margin-top:4px;color:#64748b;font-size:11px}.v103-trip-append-title{min-width:205px;border-radius:8px;background:#dc2626;color:#fff;padding:10px 18px;text-align:center}.v103-trip-append-title b,.v103-trip-append-title small{display:block}.v103-trip-append-title b{font-size:20px}.v103-trip-append-title small{margin-top:3px;font-size:9px;letter-spacing:1px}.v103-trip-append-ref{display:flex;justify-content:space-between;gap:10px;padding:9px 0;color:#64748b;font-size:11px}.v103-trip-append-ref b{color:#0f172a}.v103-trip-append-customer{display:grid;grid-template-columns:1fr 1.55fr;gap:1px;border:1px solid #fecdd3;border-radius:7px;overflow:hidden;background:#fecdd3}.v103-trip-append-customer div{min-height:60px;padding:10px;background:#fff}.v103-trip-append-customer span,.v103-trip-append-customer b{display:block}.v103-trip-append-customer span{color:#dc2626;font-size:10px;font-weight:900}.v103-trip-append-customer b{margin-top:5px;font-size:14px}.v103-trip-append-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:15px 0}.v103-trip-append-stats div{border:1px solid #e2e8f0;border-radius:7px;background:#f8fafc;padding:10px}.v103-trip-append-stats span{display:block;color:#64748b;font-size:10px}.v103-trip-append-stats b{display:block;margin-top:4px;color:#dc2626;font-size:23px}.v103-trip-append-table{width:100%;border-collapse:collapse;font-size:13px}.v103-trip-append-table th{padding:8px;background:#dc2626;color:#fff;text-align:left}.v103-trip-append-table td{padding:10px 8px;border-bottom:1px solid #e5e7eb}.v103-trip-append-table td:last-child{text-align:right}.v103-trip-append-check{margin-top:15px;border:1px solid #fecdd3;border-radius:7px;padding:11px 13px;background:#fffafa}.v103-trip-append-check b{color:#dc2626}.v103-trip-append-check div{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:8px;font-size:12px}.v103-trip-append-sig{display:grid;grid-template-columns:1fr 1fr;gap:55px;margin-top:120px;text-align:center;font-size:11px}.v103-trip-append-sig i{display:block;height:38px;border-bottom:1px solid #64748b;margin-bottom:5px}@media print{.v103-trip-append{page-break-before:always;break-before:page}}
    </style><style>
      /* ใบเที่ยวเน้นจำนวนคิวสำหรับอ่านจากระยะไกล: ซ่อนรายละเอียดอื่นทั้งหมด */
      .v103-trip-append-head,.v103-trip-append-ref,.v103-trip-append-customer,.v103-trip-append-table,.v103-trip-append-check,.v103-trip-append-sig{display:none!important}.v103-trip-append{display:flex;align-items:center;justify-content:center;padding:16mm!important}.v103-trip-append-stats{display:block!important;width:100%;margin:0!important;text-align:center}.v103-trip-append-stats div{display:none!important}.v103-trip-append-stats div:first-child{display:block!important;border:0!important;background:transparent!important;padding:0!important}.v103-trip-append-stats div:first-child span{display:block!important;color:#dc2626!important;font-size:25px!important;font-weight:950!important;letter-spacing:1px}.v103-trip-append-stats div:first-child b{display:block!important;margin-top:20px!important;color:#0f172a!important;font-size:142px!important;line-height:1!important;font-weight:950!important;letter-spacing:-5px}.v103-trip-append-stats div:first-child b::after{content:'  คิว';font-size:45px;letter-spacing:0;color:#dc2626}.v103-trip-append-stats div:first-child b{font-size:0!important}.v103-trip-append-stats div:first-child b::before{content:attr(data-qty);font-size:142px;color:#0f172a}
    </style><style>
      /* ฟอร์มใบเที่ยวใช้โครงใบส่งของเดิม แต่ขยายจำนวนคิวเที่ยวให้อ่านง่าย */
      .v103-trip-append{display:block!important;padding:12mm 14mm 15mm!important}.v103-trip-append-head{display:flex!important}.v103-trip-append-ref{display:flex!important}.v103-trip-append-customer{display:grid!important}.v103-trip-append-stats{display:grid!important;width:auto!important;margin:15px 0!important;text-align:left!important}.v103-trip-append-stats div{display:block!important}.v103-trip-append-stats div:first-child b{font-size:72px!important;line-height:1!important;letter-spacing:-2px!important;color:#dc2626!important}.v103-trip-append-stats div:first-child b::before,.v103-trip-append-stats div:first-child b::after{content:none!important}.v103-trip-strength{grid-column:span 2!important;text-align:center!important}.v103-trip-strength span{font-size:12px!important}.v103-trip-strength b{font-size:56px!important;line-height:1!important;color:#dc2626!important}.v103-trip-slump{display:block!important;margin-top:8px!important;color:#475569!important;font-size:20px!important;font-weight:900!important}.v103-trip-append-stats div:not(:first-child) b{font-size:21px!important;color:#0f172a!important}.v103-trip-append-table{display:table!important}.v103-trip-append-check{display:block!important}.v103-trip-append-sig{display:grid!important}
    </style>${plans.map((plan, index) => {
      const linked = (delivery.items || []).find(item => String(item.product_id) === String(plan.product_id)) || {};
      const stone = linked?.stone_choice?.material_name || '-';
      const strengthMatch = String(plan.product_name || linked.product_name || '').match(/(\d{2,4})\s*(?:ksc|kg\s*\/\s*cm(?:2|²))/i);
      const strength = strengthMatch ? `ST${strengthMatch[1]}` : 'ST';
      return `<section class="v103-trip-append"><header class="v103-trip-append-head"><div class="v103-trip-append-shop"><h1>${esc(shop.shop_name || 'หจก. เอส เค วัสดุ')}</h1><span>${esc(shop.address || '')}${shop.phone ? ` • โทร. ${esc(shop.phone)}` : ''}</span></div><div class="v103-trip-append-title"><b>ใบเที่ยวคอนกรีต</b><small>CONCRETE TRIP TICKET • เที่ยว ${index + 1} / ${plans.length}</small></div></header><div class="v103-trip-append-ref"><span>อ้างอิงใบเสร็จ: <b>${esc(billNo)}</b></span><span>วันที่นัดส่ง: <b>${esc(bill?.delivery_date || '-')}</b></span><span>พิมพ์: ${esc(concreteDocumentDate())}</span></div><section class="v103-trip-append-customer"><div><span>ลูกค้า / CUSTOMER</span><b>${esc(customer)}</b></div><div><span>สถานที่จัดส่ง / DELIVERY ADDRESS</span><b>${esc(address)}</b></div></section><section class="v103-trip-append-stats"><div><span>จำนวนคอนกรีตเที่ยวที่ ${index + 1}</span><b data-qty="${esc(fmt(plan.quantity_m3))}">${fmt(plan.quantity_m3)} คิว</b></div><div><span>ความจุรถ</span><b>${fmt(plan.truck_capacity_m3)} คิว</b></div><div><span>คิวว่าง</span><b>${fmt(plan.empty_m3)} คิว</b></div></section><table class="v103-trip-append-table"><thead><tr><th>รายการคอนกรีต</th><th>ชนิดหิน</th><th>สถานะ</th><th>ปริมาณ</th></tr></thead><tbody><tr><td><b>${esc(plan.product_name || linked.product_name || '-')}</b></td><td>${esc(stone)}</td><td>${esc(tripStatusClass(plan.status) === 'done' ? 'จัดส่งสำเร็จ' : 'รอจัดส่ง')}</td><td>${fmt(plan.quantity_m3)} คิว</td></tr></tbody></table><section class="v103-trip-append-check"><b>รายการตรวจรับประจำเที่ยว</b><div><span>□ ตรวจปริมาณก่อนออกจากโรง</span><span>□ ตรวจคุณภาพคอนกรีต</span><span>□ ตรวจสถานที่และผู้รับของ</span><span>□ รับรองการส่งมอบเรียบร้อย</span></div></section><footer class="v103-trip-append-sig"><div><i></i>พนักงานขับรถ / ผู้ส่ง</div><div><i></i>ผู้รับคอนกรีต / ลูกค้า</div></footer></section>`;
    }).join('')}`;
  }

  window.v103BuildConcreteTripPagesHtml = function (bill) {
    const delivery = concreteInfo(bill?.return_info);
    const plans = Array.isArray(delivery?.plans) ? delivery.plans : [];
    let planIndex = 0;
    const html = renderConcreteTripAppendHtml(bill);
    return html.replace(/(<section class="v103-trip-append-stats">)([\s\S]*?)(<\/section>)/g, (all, open, stats, close) => {
      let slot = 0;
      const updated = stats.replace(/<div><span>[^<]*<\/span><b[^>]*>[^<]*<\/b><\/div>/g, match => {
        slot += 1;
        if (slot === 2) {
          const productName = plans[planIndex]?.product_name || '';
          const strengthMatch = String(productName).match(/(\d{2,4})\s*(?:ksc|kg\s*\/\s*cm(?:2|²))/i);
          const slumpMatch = String(productName).match(/slump\s*([0-9]+(?:\.[0-9]+)?\s*(?:\+\/\-|±)\s*[0-9]+(?:\.[0-9]+)?)/i);
          planIndex += 1;
          const slump = slumpMatch ? slumpMatch[1].replace(/\+\/\-/g, '±') : '';
          return `<div class="v103-trip-strength"><span>กำลังคอนกรีต</span><b>${strengthMatch ? `ST${strengthMatch[1]}` : 'ST'}</b>${slump ? `<small class="v103-trip-slump">Slump ${esc(slump)}</small>` : ''}</div>`;
        }
        return slot === 3 ? '' : match;
      });
      return `${open}${updated}${close}`;
    });
  };

  function buildConcreteInfoFromCart(items) {
    const concreteItems = (items || []).filter(item => item?.__v103_concrete_sale && !item.is_extra_charge);
    if (!concreteItems.length) return null;
    const plans = concreteItems.flatMap(item => (item.concrete_delivery_plans || buildPlans(
      item.qty,
      item.concrete_config || getConfig(item.id),
      item.concrete_request_mix_design === true
    )).map(plan => ({
      ...plan,
      product_id: item.id,
      product_name: item.name,
      request_mix_design: item.concrete_request_mix_design === true,
    })));
    return {
      version: 2,
      created_at: new Date().toISOString(),
      total_quantity_m3: round3(concreteItems.reduce((sum, item) => sum + num(item.qty), 0)),
      total_trips: plans.length,
      total_surcharge: round2(plans.reduce((sum, plan) => sum + num(plan.surcharge), 0)),
      mix_design_requested: concreteItems.some(item => item.concrete_request_mix_design === true),
      items: concreteItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity_m3: round3(item.qty),
        request_mix_design: item.concrete_request_mix_design === true,
        stone_choice: item.concrete_stone_choice || null,
        config: normalizeConfig(item.concrete_config || getConfig(item.id)),
      })),
      plans,
    };
  }

  function v12CheckoutState() {
    try { if (typeof v12State !== 'undefined') return v12State || null; } catch (_) {}
    return window.v12State || null;
  }

  function activeCartSnapshot() {
    let list = [];
    try { if (Array.isArray(cart)) list = cart; } catch (_) {}
    if (!list.length && Array.isArray(window.cart)) list = window.cart;
    return (list || []).map(item => ({
      ...item,
      concrete_config: item?.concrete_config ? { ...item.concrete_config } : null,
      concrete_stone_choice: item?.concrete_stone_choice ? { ...item.concrete_stone_choice } : null,
      concrete_delivery_plans: Array.isArray(item?.concrete_delivery_plans)
        ? item.concrete_delivery_plans.map(plan => ({ ...plan }))
        : [],
    }));
  }

  async function syncConcreteBillAfterCheckout(snapshot) {
    const delivery = buildConcreteInfoFromCart(snapshot);
    if (!delivery) return null;
    const checkoutState = v12CheckoutState();
    const billId = checkoutState?.savedBill?.id || checkoutState?.savedBill?.bill_id || '';
    if (!billId) {
      console.warn('[v103] concrete checkout completed but saved bill id was not exposed');
      return null;
    }
    const { data: freshBill, error } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
    if (error) throw error;
    if (!freshBill) throw new Error('ไม่พบบิลที่เพิ่งสร้าง');
    const info = parseInfo(freshBill.return_info);
    info.concrete_delivery = delivery;
    const scheduledDate = checkoutState?.deliveryDate || freshBill.delivery_date || todayKey();
    const patch = {
      return_info: info,
      delivery_mode: 'จัดส่ง',
      delivery_date: scheduledDate,
      delivery_status: 'รอจัดส่ง',
    };
    const updated = await db.from('บิลขาย').update(patch).eq('id', billId);
    if (updated.error) throw updated.error;

    for (const item of delivery.items) {
      const qty = round3(item.quantity_m3);
      const rowUpdate = await db.from('รายการในบิล')
        .update({ take_qty: 0, deliver_qty: qty })
        .eq('bill_id', billId)
        .eq('product_id', item.product_id);
      if (rowUpdate.error) console.warn('[v103] update concrete bill item delivery qty', rowUpdate.error);
    }

    const savedBill = { ...freshBill, ...patch };
    if (checkoutState?.savedBill) Object.assign(checkoutState.savedBill, savedBill);
    await persistPlans(savedBill, snapshot);
    try { window.v68HistoryFilter = 'all'; } catch (_) {}
    try { if (document.getElementById('page-history') && !document.getElementById('page-history').classList.contains('hidden')) window.v39LoadHistoryData?.(); } catch (_) {}
    return savedBill;
  }

  function setGlobalFunction(name, fn) {
    window[name] = fn;
    try { Function('name', 'fn', 'window[name] = fn; eval(name + " = fn")')(name, fn); } catch (_) {}
  }

  function installCheckoutBillSync() {
    [
      'v12CompletePayment', 'v13CompletePayment', 'v15CompletePayment',
      'v16CompletePayment', 'v17CompletePayment', 'v18CompletePayment'
    ].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__v103ConcreteBillSync) return;
      const wrapped = async function () {
        const snapshot = activeCartSnapshot();
        const result = await original.apply(this, arguments);
        if (snapshot.some(item => item?.__v103_concrete_sale)) {
          try {
            await syncConcreteBillAfterCheckout(snapshot);
          } catch (error) {
            console.error('[v103] attach concrete plans to bill', error);
            if (typeof toast === 'function') toast('สร้างบิลแล้ว แต่บันทึกแผนคอนกรีตไม่สำเร็จ: ' + (error.message || error), 'error');
          }
        }
        return result;
      };
      wrapped.__v103ConcreteBillSync = true;
      setGlobalFunction(name, wrapped);
    });
  }

  async function persistPlans(bill, cartSnapshot) {
    const info = concreteInfo(bill?.return_info);
    const items = (cartSnapshot || []).filter(item => item?.__v103_concrete_sale);
    const plans = info?.plans || items.flatMap(item => (item.concrete_delivery_plans || []).map(plan => ({
      ...plan,
      product_id: item.id,
      product_name: item.name,
    })));
    if (!bill?.id || !plans.length) return;
    const rows = plans.map(plan => ({
      bill_id: String(bill.id),
      product_id: String(plan.product_id || ''),
      product_name: plan.product_name || '',
      plan_no: Number(plan.plan_no),
      total_plans: Number(plan.total_plans || plans.length),
      quantity_m3: round3(plan.quantity_m3),
      truck_capacity_m3: round3(plan.truck_capacity_m3),
      empty_m3: round3(plan.empty_m3),
      surcharge: round2(plan.surcharge),
      request_mix_design: plan.request_mix_design === true,
      status: plan.status || 'รอผลิต',
      scheduled_date: bill.delivery_date || todayKey(),
    }));
    try {
      const { error } = await db.from(PLAN_TABLE).upsert(rows, { onConflict: 'bill_id,product_id,plan_no' });
      if (error) throw error;
    } catch (error) {
      console.warn('[v103] plans remain safely stored in bill return_info', error?.message || error);
    }
  }

  function tripStatusClass(status) {
    return /สำเร็จ|ส่งแล้ว|done|complete/i.test(String(status || '')) ? 'done' : 'pending';
  }

  async function decorateDeliveryPlans() {
    const cards = Array.from(document.querySelectorAll('.v12-dq-card[id^="dq-card-"]'));
    if (!cards.length || typeof db === 'undefined') return;
    const ids = cards.map(card => card.id.replace(/^dq-card-/, '')).filter(Boolean);
    const { data } = await db.from('บิลขาย').select('id,return_info').in('id', ids);
    const map = new Map((data || []).map(bill => [String(bill.id), bill]));
    cards.forEach(card => {
      const billId = card.id.replace(/^dq-card-/, '');
      const delivery = concreteInfo(map.get(String(billId))?.return_info);
      if (!delivery?.plans?.length) return;
      card.classList.add('v103-concrete-card');
      card.querySelector('[data-v103-delivery-plans]')?.remove();
      const block = document.createElement('section');
      block.dataset.v103DeliveryPlans = '1';
      block.className = 'v103-queue-plans';
      const stoneNames = [...new Set((delivery.items || []).map(item => item?.stone_choice?.material_name).filter(Boolean))];
      block.innerHTML = `
        <div class="v103-queue-head"><span><i class="material-icons-round">route</i> แผนผลิต/ส่ง ${delivery.plans.length} เที่ยว${stoneNames.length ? ` • ${esc(stoneNames.join(', '))}` : ''}</span><div class="v103-queue-actions"><button type="button" class="v103-print-docs" onclick="v37PrintBillA4Smart('${esc(billId)}')"><i class="material-icons-round">print</i> พิมพ์ใบเสร็จ + ใบเที่ยว</button><b>${fmt(delivery.total_quantity_m3)} คิว</b></div></div>
        <div class="v103-queue-grid">${delivery.plans.map(plan => `
          <div class="v103-queue-trip ${tripStatusClass(plan.status)}">
            <div><span>เที่ยว ${plan.plan_no}/${plan.total_plans}</span><b>${fmt(plan.quantity_m3)} คิว</b><small>${num(plan.empty_m3) > 0 ? `ว่าง ${fmt(plan.empty_m3)} คิว` : 'รถเต็มคัน'}</small></div>
            ${tripStatusClass(plan.status) === 'done'
              ? '<span class="v103-done-badge"><i class="material-icons-round">check</i> ส่งแล้ว</span>'
              : `<button type="button" onclick="v103MarkConcreteTripDone('${esc(billId)}','${esc(plan.product_id)}',${Number(plan.plan_no)})"><i class="material-icons-round">done</i> สำเร็จ</button>`}
          </div>`).join('')}</div>`;
      const body = card.querySelector('.v12-dq-card-body');
      body?.appendChild(block);
      const doneButton = card.querySelector('.v12-dq-btn.done');
      if (doneButton) {
        doneButton.setAttribute('onclick', `v103MarkAllConcreteTripsDone('${String(billId).replace(/'/g, "\\'")}')`);
        doneButton.innerHTML = '<i class="material-icons-round" style="font-size:15px">done_all</i> สำเร็จทุกเที่ยว';
      }
    });
  }

  async function updateTripStatus(billId, productId, planNo, completeAll = false) {
    const { data: bill, error } = await db.from('บิลขาย').select('id,status,return_info').eq('id', billId).maybeSingle();
    if (error || !bill) throw error || new Error('ไม่พบบิล');
    const info = parseInfo(bill.return_info);
    const delivery = concreteInfo(info);
    if (!delivery?.plans?.length) throw new Error('ไม่พบแผนเที่ยวคอนกรีต');
    const now = new Date().toISOString();
    delivery.plans = delivery.plans.map(plan => {
      const matched = completeAll || (String(plan.product_id) === String(productId) && Number(plan.plan_no) === Number(planNo));
      return matched ? { ...plan, status: 'จัดส่งสำเร็จ', completed_at: now } : plan;
    });
    const allDone = delivery.plans.every(plan => tripStatusClass(plan.status) === 'done');
    info.concrete_delivery = delivery;
    const patch = { return_info: info };
    if (allDone) {
      patch.delivery_status = 'จัดส่งสำเร็จ';
      if (!/ค้าง|ชำระหน้างาน|ยกเลิก/i.test(String(bill.status || ''))) patch.status = 'สำเร็จ';
    }
    const updated = await db.from('บิลขาย').update(patch).eq('id', billId);
    if (updated.error) throw updated.error;
    try {
      let query = db.from(PLAN_TABLE).update({ status: 'จัดส่งสำเร็จ', completed_at: now }).eq('bill_id', String(billId));
      if (!completeAll) query = query.eq('product_id', String(productId)).eq('plan_no', Number(planNo));
      await query;
    } catch (_) {}
    try { if (typeof logActivity === 'function') logActivity('ส่งคอนกรีต', `บิล #${billId} ${completeAll ? 'ทุกเที่ยว' : `เที่ยว ${planNo}`}`, billId, 'บิลขาย'); } catch (_) {}
    if (typeof window.v12DQFilter === 'function') await window.v12DQFilter(state.deliveryFilter || 'today');
    return allDone;
  }

  window.v103MarkConcreteTripDone = async function (billId, productId, planNo) {
    try {
      await updateTripStatus(billId, productId, planNo, false);
      if (typeof toast === 'function') toast(`บันทึกเที่ยว ${planNo} สำเร็จแล้ว`, 'success');
    } catch (error) { if (typeof toast === 'function') toast(error.message || String(error), 'error'); }
  };

  window.v103MarkAllConcreteTripsDone = async function (billId) {
    const result = await Swal.fire({
      icon: 'question', title: 'ยืนยันส่งครบทุกเที่ยว?',
      text: 'ระบบจะปิดแผนผลิต/ส่งทุกรอบในบิลนี้ โดยไม่ตัดสต็อกซ้ำ',
      showCancelButton: true, confirmButtonText: 'ยืนยันทุกเที่ยว', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#059669',
    });
    if (!result.isConfirmed) return;
    try {
      await updateTripStatus(billId, '', 0, true);
      if (typeof toast === 'function') toast('จัดส่งครบทุกเที่ยวแล้ว', 'success');
    } catch (error) { if (typeof toast === 'function') toast(error.message || String(error), 'error'); }
  };

  function installDeliveryDecorator() {
    const originalFilter = window.v12DQFilter;
    if (typeof originalFilter === 'function' && !originalFilter.__v103ConcretePlans) {
      const wrapped = async function () {
        if (arguments[0]) state.deliveryFilter = arguments[0];
        const result = await originalFilter.apply(this, arguments);
        await decorateDeliveryPlans().catch(error => console.warn('[v103] decorate delivery plans', error));
        return result;
      };
      wrapped.__v103ConcretePlans = true;
      window.v12DQFilter = wrapped;
      try { v12DQFilter = wrapped; } catch (_) {}
    }
    const originalRender = window.renderDelivery;
    if (typeof originalRender === 'function' && !originalRender.__v103ConcretePlans) {
      const wrapped = async function () {
        const result = await originalRender.apply(this, arguments);
        await decorateDeliveryPlans().catch(error => console.warn('[v103] decorate delivery plans', error));
        return result;
      };
      wrapped.__v103ConcretePlans = true;
      window.renderDelivery = wrapped;
      try { renderDelivery = wrapped; } catch (_) {}
    }
  }

  async function syncCancelledPlans(billId) {
    try {
      const { data: bill } = await db.from('บิลขาย').select('id,status,return_info').eq('id', billId).maybeSingle();
      if (!bill || !/ยกเลิก|cancel/i.test(String(bill.status || ''))) return;
      const info = parseInfo(bill.return_info);
      const delivery = concreteInfo(info);
      if (delivery?.plans?.length) {
        delivery.plans = delivery.plans.map(plan => ({ ...plan, status: 'ยกเลิก' }));
        info.concrete_delivery = delivery;
        await db.from('บิลขาย').update({ return_info: info }).eq('id', billId);
      }
      try { await db.from(PLAN_TABLE).update({ status: 'ยกเลิก' }).eq('bill_id', String(billId)); } catch (_) {}
    } catch (error) { console.warn('[v103] cancel concrete plans', error); }
  }

  function installCancelPlanSync() {
    const original = window.cancelBill;
    if (typeof original !== 'function' || original.__v103ConcretePlans) return;
    const wrapped = async function (billId) {
      const result = await original.apply(this, arguments);
      await syncCancelledPlans(billId);
      return result;
    };
    wrapped.__v103ConcretePlans = true;
    window.cancelBill = wrapped;
    try { cancelBill = wrapped; } catch (_) {}
  }

  function cleanupRemovedConcreteLine(productId) {
    let list = [];
    try { if (Array.isArray(cart)) list = cart; } catch (_) {}
    if (!list.length && Array.isArray(window.cart)) list = window.cart;
    if (!Array.isArray(list)) return;
    const rawId = String(productId || '');
    const linkedId = rawId.startsWith('concrete-empty-') ? rawId.slice('concrete-empty-'.length) : rawId;
    const concreteLine = list.find(item => item?.__v103_concrete_sale && String(item.id) === linkedId) || null;
    const before = list.length;
    syncConcreteCart(list, concreteLine, linkedId);
    if (list.length === before) return;
    try { cart = list; } catch (_) {}
    window.cart = list;
    try { window.renderCart?.(); } catch (_) {}
  }

  function installCartRemovalSync() {
    const original = window.removeFromCart;
    if (typeof original !== 'function' || original.__v103ConcretePlans) return;
    const wrapped = function (productId) {
      const result = original.apply(this, arguments);
      if (result && typeof result.finally === 'function') result.finally(() => cleanupRemovedConcreteLine(productId));
      else cleanupRemovedConcreteLine(productId);
      return result;
    };
    wrapped.__v103ConcretePlans = true;
    window.removeFromCart = wrapped;
    try { removeFromCart = wrapped; } catch (_) {}
  }

  function installStyles() {
    if (document.getElementById('v103-concrete-recipe-style')) return;
    const style = document.createElement('style');
    style.id = 'v103-concrete-recipe-style';
    style.textContent = `
      .v103-swal{border-radius:28px!important;padding:0!important;overflow:hidden!important}.v103-swal .swal2-html-container{margin:0!important}.v103-swal .swal2-actions{margin:0!important;padding:18px 24px 22px;width:100%;background:#fff;border-top:1px solid #e2e8f0}.v103-swal .swal2-confirm,.v103-swal .swal2-cancel{height:46px;border-radius:14px!important;padding:0 22px!important;font:900 14px var(--font-thai,'Prompt'),sans-serif!important}
      .v103-sale{text-align:left;color:#0f172a}.v103-hero{padding:22px 24px;background:radial-gradient(circle at 8% 10%,rgba(45,212,191,.28),transparent 30%),linear-gradient(120deg,#0f172a,#134e4a);color:#fff;display:grid;grid-template-columns:auto 1fr auto;gap:15px;align-items:center}.v103-hero-icon{width:58px;height:58px;border-radius:18px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);display:grid;place-items:center}.v103-hero-icon i{font-size:31px}.v103-hero span{font-size:10px;letter-spacing:1.6px;color:#99f6e4;font-weight:950}.v103-hero h2{font-size:25px;line-height:1.1;margin:3px 0 0}.v103-hero p{margin:5px 0 0;color:#cbd5e1;font-size:12px;font-weight:750}.v103-cap{border:1px solid rgba(255,255,255,.18);border-radius:16px;background:rgba(255,255,255,.1);padding:10px 14px;text-align:right}.v103-cap span,.v103-cap b{display:block}.v103-cap b{font-size:20px;margin-top:3px}.v103-form-grid{padding:18px 22px;display:grid;grid-template-columns:.9fr 1.1fr;gap:14px;background:#f8fafc}.v103-panel{border:1px solid #e2e8f0;background:#fff;border-radius:20px;padding:16px;box-shadow:0 8px 24px rgba(15,23,42,.04)}.v103-label{display:block;color:#334155;font-size:13px;font-weight:950;margin-bottom:8px}.v103-qty{display:grid;grid-template-columns:48px 1fr 48px;border:1.5px solid #99f6e4;border-radius:15px;overflow:hidden}.v103-qty button{border:0;background:#f0fdfa;color:#0f766e;font-size:24px;font-weight:900;cursor:pointer}.v103-qty input{height:50px;border:0;border-left:1px solid #ccfbf1;border-right:1px solid #ccfbf1;text-align:center;font:950 20px var(--font-thai,'Prompt'),sans-serif;color:#0f172a;outline:none}.v103-available{margin-top:8px;font-size:11px;color:#64748b;font-weight:800}.v103-available b{color:#047857}.v103-stone-head{margin:16px 0 8px;display:flex;align-items:center;justify-content:space-between;gap:10px}.v103-stone-head>div{display:flex;align-items:center;gap:8px}.v103-stone-head>div>i{width:32px;height:32px;border-radius:10px;background:#fff7ed;color:#ea580c;display:grid;place-items:center;font-size:17px}.v103-stone-head span b,.v103-stone-head span small{display:block}.v103-stone-head span b{font-size:13px;color:#334155}.v103-stone-head span small{font-size:10px;color:#94a3b8;margin-top:1px}.v103-stone-head em{font-style:normal;border-radius:999px;background:#ffedd5;color:#c2410c;padding:3px 8px;font-size:9px;font-weight:950}.v103-stone-choice{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v103-stone-choice label{position:relative}.v103-stone-choice input{position:absolute;opacity:0}.v103-stone-choice span{min-height:88px;border:1.5px solid #e2e8f0;border-radius:15px;padding:11px;display:flex;flex-direction:column;cursor:pointer;background:#fff}.v103-stone-choice i{font-size:22px;color:#94a3b8}.v103-stone-choice b{margin-top:4px;font-size:13px;color:#334155}.v103-stone-choice small{margin-top:3px;color:#64748b;font-size:9px;line-height:1.4}.v103-stone-choice input:checked+span{border-color:#f97316;background:#fff7ed;box-shadow:0 0 0 3px rgba(249,115,22,.1)}.v103-stone-choice input:checked+span i,.v103-stone-choice input:checked+span b{color:#c2410c}.v103-choice{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v103-choice label{position:relative}.v103-choice input{position:absolute;opacity:0}.v103-choice span{height:100%;min-height:94px;border:1.5px solid #e2e8f0;border-radius:15px;padding:12px;display:flex;flex-direction:column;cursor:pointer;background:#fff}.v103-choice i{font-size:24px;color:#64748b}.v103-choice b{margin-top:5px;font-size:13px}.v103-choice small{margin-top:3px;color:#64748b;line-height:1.35}.v103-choice input:checked+span{border-color:#0d9488;background:#f0fdfa;box-shadow:0 0 0 3px rgba(13,148,136,.09)}.v103-choice input:checked+span i,.v103-choice input:checked+span b{color:#0f766e}.v103-plan-panel{padding:0;overflow:hidden}.v103-plan-head{padding:14px 16px;background:#0f172a;color:#fff;display:grid;grid-template-columns:1fr 1fr;gap:12px}.v103-plan-head>div:last-child{text-align:right}.v103-plan-head span{display:block;color:#94a3b8;font-size:10px;font-weight:850}.v103-plan-head b{display:block;font-size:19px;margin-top:2px}.v103-plan-list{padding:12px;display:grid;gap:7px;max-height:430px;overflow:auto}.v103-trip{display:grid;grid-template-columns:74px 1fr 96px auto;gap:8px;align-items:center;border:1px solid #dbeafe;border-radius:13px;background:#f8fbff;padding:10px}.v103-trip.partial{border-color:#fed7aa;background:#fff7ed}.v103-trip-no{font-weight:950;color:#475569}.v103-trip strong{font-size:16px;color:#0f172a}.v103-trip small{color:#64748b;font-weight:800}.v103-trip b{color:#c2410c}.v103-empty{padding:40px 12px;text-align:center;color:#94a3b8;font-weight:850}
      .v103-queue-plans{margin-top:12px;border:1px solid #99f6e4;border-radius:14px;overflow:hidden;background:#f0fdfa}.v103-queue-head{padding:10px 12px;background:#ccfbf1;color:#115e59;display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:950}.v103-queue-head>span{display:flex;align-items:center;gap:6px}.v103-queue-head i{font-size:18px}.v103-queue-actions{display:flex;align-items:center;gap:10px}.v103-print-docs{height:32px!important;border:1px solid #0f766e!important;border-radius:9px!important;background:#fff!important;color:#0f766e!important;padding:0 10px!important;display:inline-flex!important;align-items:center!important;gap:5px!important;font:900 11px var(--font-thai,'Prompt'),sans-serif!important;cursor:pointer}.v103-print-docs:hover{background:#0f766e!important;color:#fff!important}.v103-print-docs i{font-size:15px!important}.v103-queue-grid{padding:9px;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}.v103-queue-trip{border:1px solid #cbd5e1;border-radius:11px;background:#fff;padding:9px;display:flex;justify-content:space-between;align-items:center;gap:8px}.v103-queue-trip>div span,.v103-queue-trip>div b,.v103-queue-trip>div small{display:block}.v103-queue-trip>div span{font-size:10px;color:#64748b;font-weight:900}.v103-queue-trip>div b{font-size:15px;color:#0f172a}.v103-queue-trip>div small{font-size:10px;color:#94a3b8}.v103-queue-trip button{height:33px;border:0;border-radius:10px;background:#0f766e;color:#fff;padding:0 9px;display:flex;align-items:center;gap:4px;font:900 11px var(--font-thai,'Prompt'),sans-serif;cursor:pointer}.v103-queue-trip button i{font-size:15px}.v103-queue-trip.done{border-color:#bbf7d0;background:#f0fdf4}.v103-done-badge{display:flex;align-items:center;gap:4px;color:#047857;font-size:11px;font-weight:950}.v103-done-badge i{font-size:15px}
      @media(max-width:760px){.v103-hero,.v103-form-grid{grid-template-columns:1fr}.v103-cap{text-align:left}.v103-choice,.v103-stone-choice{grid-template-columns:1fr}.v103-trip{grid-template-columns:60px 1fr 80px}.v103-trip b{grid-column:2/-1}.v103-form-grid{padding:12px}.v103-hero{padding:18px}.v103-queue-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  window.v103LoadConcreteConfigs = loadSettings;
  window.v103GetConcreteConfig = getConfig;
  window.v103SaveConcreteConfig = saveConfig;
  window.v103DeleteConcreteConfig = deleteConfig;
  window.v103BuildConcretePlans = buildPlans;
  window.v103PromptConcreteSale = promptConcreteSale;
  window.v103SyncConcreteCart = syncConcreteCart;
  window.v103PersistConcretePlans = persistPlans;
  window.v103SyncConcreteBillAfterCheckout = syncConcreteBillAfterCheckout;
  window.v103ConcreteInfo = concreteInfo;
  window.v103DecorateDeliveryPlans = decorateDeliveryPlans;

  installStyles();
  installDeliveryDecorator();
  installCancelPlanSync();
  installCartRemovalSync();
  installCheckoutBillSync();
  loadSettings(false);
  [600, 1600, 3200].forEach(delay => setTimeout(() => {
    installDeliveryDecorator();
    installCancelPlanSync();
    installCartRemovalSync();
    installCheckoutBillSync();
  }, delay));
  console.log('[v103] integrated concrete recipe flow loaded');
})();
