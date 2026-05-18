/* ════════════════════════════════════════════════════════════════
   V81: CHECKOUT FLOW POLISH (rev2)
   ────────────────────────────────────────────────────────────────
   • z-index ของ SweetAlert ทับ overlay
   • ลบหัวข้อทุก step (รก ไม่จำเป็น) — แทนสถานะ/ขั้นย่อยด้วย card เด่น
   • Step 1: แถบสถานะลูกค้าอัพเดทเรียลไทม์ (รวมโครงการ)
   • Step 2: แสดงแค่ 3 ใบ "รับเอง / ร้านไปส่ง / รับบางส่วน"
     – กดถัดไป → sub-step "ข้อมูลจัดส่ง" (ถ้า deliver/partial)
     – ถ้าเป็น partial → sub-step "จัดสรรจำนวน" ต่อ
     – ทุกหน้าสั้น พอดีจอ ไม่ต้อง scroll
   • ลูกค้าใหม่ ต้อง "บันทึก" ก่อนถึงจะกดถัดไปได้
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const TAG = '[v81-checkout-flow]';

  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function fmt(v) {
    try { if (typeof formatNum === 'function') return formatNum(v); } catch (_) {}
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(num(v));
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function getState() {
    try { if (typeof v12State !== 'undefined' && v12State) return v12State; } catch (_) {}
    return window.v12State || null;
  }
  function activeCart() {
    try { if (Array.isArray(cart)) return cart; } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }
  function setGlobal(name, fn) {
    try { window[name] = fn; } catch (_) {}
    try { eval(`${name} = fn;`); } catch (_) {}
  }

  /* ─────── STYLES ─────── */
  function injectStyles() {
    if (document.getElementById('v81-checkout-flow-style')) return;
    const css = `
      .swal2-container{z-index:11000 !important}

      /* ซ่อนหัวข้อ + คำอธิบายทุก step (ให้แบนเนอร์/การ์ดเป็นตัวสื่อสารแทน) */
      .v12-step-title,.v12-step-subtitle,.v13-general-fast{display:none !important}

      /* ป็อปอัพคิดเงินพอดีจอ — เลื่อนเฉพาะ body */
      .v12-right-body{
        max-height:calc(100vh - 220px) !important;
        overflow-y:auto !important;overflow-x:hidden !important;
        padding-top:18px !important;padding-bottom:18px !important;
        scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent;
      }
      .v12-right-body::-webkit-scrollbar{width:8px}
      .v12-right-body::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px}
      .v12-right-body::-webkit-scrollbar-track{background:transparent}

      .v12-cust-card,.v12-delivery-card,.v12-pay-type-card,.v12-method-card{min-height:124px !important}

      /* ── (3) แถบสถานะลูกค้า ───────────────────── */
      .v81-cust-status{
        display:flex;align-items:center;gap:14px;
        padding:14px 18px;border-radius:16px;
        background:linear-gradient(135deg,#f8fafc 0%,#fff 100%);
        border:1.5px solid #e2e8f0;
        margin-bottom:14px;
        box-shadow:0 6px 18px rgba(15,23,42,.04);
      }
      .v81-cust-status.is-picked{
        background:linear-gradient(135deg,#ecfdf5 0%,#f0fdfa 100%);
        border-color:#86efac;box-shadow:0 8px 22px rgba(16,185,129,.13);
      }
      .v81-cust-status.is-warn{
        background:linear-gradient(135deg,#fffbeb 0%,#fff 100%);
        border-color:#fcd34d;
      }
      .v81-cust-ico{
        width:46px;height:46px;border-radius:14px;flex:0 0 auto;
        display:grid;place-items:center;background:#e2e8f0;color:#64748b;
      }
      .v81-cust-ico i{font-size:26px}
      .v81-cust-status.is-picked .v81-cust-ico{background:#10b981;color:#fff}
      .v81-cust-status.is-warn .v81-cust-ico{background:#f59e0b;color:#fff}
      .v81-cust-text{flex:1;min-width:0}
      .v81-cust-label{
        font-size:11px;font-weight:900;letter-spacing:.4px;
        text-transform:uppercase;color:#64748b;
      }
      .v81-cust-status.is-picked .v81-cust-label{color:#059669}
      .v81-cust-status.is-warn .v81-cust-label{color:#b45309}
      .v81-cust-name{
        font-size:19px;font-weight:900;color:#0f172a;line-height:1.2;margin-top:2px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .v81-cust-meta{
        font-size:12.5px;font-weight:700;color:#64748b;margin-top:3px;
        display:flex;flex-wrap:wrap;gap:6px 14px;
      }
      .v81-cust-meta span{display:inline-flex;align-items:center;gap:4px}
      .v81-cust-meta i{font-size:14px;color:#94a3b8}

      /* ── Sub-step header (ข้อมูลจัดส่ง / จัดสรรจำนวน) ── */
      .v81-sub-head{
        display:flex;align-items:center;gap:12px;margin-bottom:14px;
        padding:13px 16px;border-radius:14px;
        background:linear-gradient(135deg,#eff6ff 0%,#fff 100%);
        border:1.5px solid #bfdbfe;
      }
      .v81-sub-head .ico{
        width:42px;height:42px;border-radius:12px;
        background:#3b82f6;color:#fff;display:grid;place-items:center;
      }
      .v81-sub-head .ico i{font-size:22px}
      .v81-sub-head .ttl{font-size:18px;font-weight:900;color:#0f172a;line-height:1.2}
      .v81-sub-head .sub{font-size:12.5px;font-weight:700;color:#64748b;margin-top:2px}

      /* ── Delivery info sub-step ── */
      .v81-dform{display:grid;gap:12px}
      .v81-pay-toggle{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .v81-pay-opt{
        padding:14px 12px;border-radius:14px;border:1.8px solid #d1d5db;
        background:#fff;cursor:pointer;display:flex;flex-direction:column;
        align-items:center;gap:6px;font-weight:800;color:#475569;font-size:13.5px;
        transition:all .15s;
      }
      .v81-pay-opt i{font-size:24px;color:#94a3b8}
      .v81-pay-opt:hover{border-color:#94a3b8}
      .v81-pay-opt.is-now{}
      .v81-pay-opt.is-now.selected{border-color:#10b981;background:#ecfdf5;color:#047857}
      .v81-pay-opt.is-now.selected i{color:#10b981}
      .v81-pay-opt.is-cod.selected{border-color:#f59e0b;background:#fffbeb;color:#b45309}
      .v81-pay-opt.is-cod.selected i{color:#f59e0b}

      .v81-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .v81-fld label{
        display:block;font-size:12px;font-weight:800;color:#475569;margin-bottom:5px;
      }
      .v81-fld input,.v81-fld textarea{
        width:100%;padding:11px 13px;font-size:14px;font-family:inherit;font-weight:600;
        border:1.6px solid #cbd5e1;border-radius:11px;background:#fff;color:#0f172a;
        box-sizing:border-box;
      }
      .v81-fld textarea{resize:vertical;min-height:64px;line-height:1.45}
      .v81-fld input:focus,.v81-fld textarea:focus{
        outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.18);
      }

      /* ── Partial allocation list ── */
      .v81-partial-list{display:flex;flex-direction:column;gap:8px;list-style:none;margin:0;padding:0}
      .v81-partial-item{
        display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;
        gap:14px;align-items:center;
        padding:12px 14px;border-radius:12px;
        background:#fff;border:1.5px solid #e2e8f0;
      }
      .v81-partial-item.invalid{border-color:#fca5a5;background:#fef2f2}
      .v81-partial-item .pname{
        font-size:14px;font-weight:800;color:#0f172a;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;
      }
      .v81-partial-item .total-tag{
        font-size:11.5px;color:#64748b;font-weight:800;
        background:#f1f5f9;padding:4px 9px;border-radius:8px;white-space:nowrap;
      }
      .v81-partial-box{display:flex;align-items:center;gap:6px}
      .v81-partial-box label{font-size:11px;font-weight:800;color:#64748b}
      .v81-partial-box input{
        width:62px;text-align:center;
        padding:7px 4px;font-size:14px;font-weight:800;
        border:1.5px solid #cbd5e1;border-radius:9px;
        background:#fff;font-family:inherit;
      }
      .v81-partial-box input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.18)}
      .v81-partial-box.take input{color:#0f766e}
      .v81-partial-box.deliv input{color:#7c3aed}
      .v81-partial-foot{
        margin-top:12px;padding:11px 16px;border-radius:12px;
        background:#f8fafc;border:1.5px solid #e2e8f0;
        display:flex;justify-content:space-between;align-items:center;gap:10px;
        font-size:13px;font-weight:800;color:#475569;flex-wrap:wrap;
      }
      .v81-partial-foot.ok{background:#ecfdf5;border-color:#86efac;color:#047857}
      .v81-partial-foot.bad{background:#fef2f2;border-color:#fca5a5;color:#b91c1c}
      .v81-partial-foot .badge{
        font-size:12.5px;font-weight:900;
        padding:5px 12px;border-radius:999px;
        background:#fff;border:1px solid currentColor;
      }
    `;
    const style = document.createElement('style');
    style.id = 'v81-checkout-flow-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ─────── CUSTOMER STATUS BANNER ─────── */
  function customerStatusBannerHTML() {
    const state = getState();
    const c = state?.customer || {};
    const type = c.type;

    if (type === 'project') {
      if (c.project_id) {
        return banner('is-picked', 'work', 'เลือกโครงการแล้ว',
          c.project_name || c.name || '-',
          [c.phone, c.address].filter(Boolean));
      }
      return banner('is-warn', 'engineering', 'โครงการร้าน', 'ยังไม่ได้เลือกโครงการ',
        ['เลือกโครงการจากรายการด้านล่าง']);
    }
    if (type === 'general') {
      return banner('', 'shopping_bag', 'สถานะลูกค้า', 'ลูกค้าทั่วไป',
        ['ไม่ระบุข้อมูล — กดถัดไปเพื่อข้ามไปชำระเงิน'], 'flash_on');
    }
    if (type === 'member') {
      if (c.id && c.name) {
        const debt = num(c.debt_amount);
        const meta = [
          c.phone ? { i: 'call', t: c.phone } : null,
          c.address ? { i: 'location_on', t: c.address } : null,
          debt > 0 ? { i: 'account_balance_wallet', t: `หนี้ ฿${fmt(debt)}`, danger: true } : null,
        ].filter(Boolean);
        return banner('is-picked', 'verified', 'เลือกลูกค้าประจำแล้ว', c.name, meta);
      }
      return banner('is-warn', 'person_search', 'ลูกค้าประจำ', 'ยังไม่ได้เลือกลูกค้า',
        ['ค้นหาและเลือกลูกค้าจากรายการด้านล่าง']);
    }
    if (type === 'new') {
      if (c.id && c.name) {
        const meta = [
          c.phone ? { i: 'call', t: c.phone } : null,
          c.address ? { i: 'location_on', t: c.address } : null,
        ].filter(Boolean);
        return banner('is-picked', 'how_to_reg', 'บันทึกลูกค้าใหม่แล้ว', c.name, meta);
      }
      return banner('is-warn', 'edit_note', 'ลูกค้าใหม่', 'กรอกข้อมูล แล้วกด "บันทึกลูกค้าใหม่"',
        [{ i: 'warning', t: 'ต้องกดบันทึกก่อนถึงจะไปขั้นต่อไปได้', danger: true }]);
    }
    return '';
  }

  function banner(cls, icon, label, name, meta, leadIcon) {
    const metaHTML = (meta || []).map(m => {
      if (typeof m === 'string') {
        return `<span><i class="material-icons-round">${leadIcon || 'info'}</i>${esc(m)}</span>`;
      }
      const color = m.danger ? ' style="color:#b91c1c"' : '';
      const ic = m.danger ? ` style="color:#dc2626"` : '';
      return `<span${color}><i class="material-icons-round"${ic}>${m.i}</i>${esc(m.t)}</span>`;
    }).join('');
    return `
      <div class="v81-cust-status ${cls}">
        <div class="v81-cust-ico"><i class="material-icons-round">${icon}</i></div>
        <div class="v81-cust-text">
          <div class="v81-cust-label">${esc(label)}</div>
          <div class="v81-cust-name" title="${esc(name)}">${esc(name)}</div>
          ${metaHTML ? `<div class="v81-cust-meta">${metaHTML}</div>` : ''}
        </div>
      </div>`;
  }

  function injectCustomerBanner() {
    const body = document.getElementById('v12-step-body');
    if (!body) return;
    const state = getState();
    if (!state || Number(state.step) !== 1) return;
    // ลบของเก่าทั้งหมด — กันซ้อน
    body.querySelectorAll('.v81-cust-status').forEach(el => el.remove());
    const html = customerStatusBannerHTML();
    if (!html) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const el = tmp.firstElementChild;
    if (!el) return;
    el.id = 'v81-cust-banner';
    body.insertBefore(el, body.firstChild);
  }

  /* ─────── DELIVERY INFO sub-step ─────── */
  function renderDeliveryInfoPage(container) {
    const state = getState();
    if (!state) return;
    if (!state.deliveryPaymentMode) state.deliveryPaymentMode = 'cod';
    const today = appLocalDateKey();
    // pre-populate state so user can press "ถัดไป" immediately without blurring fields first
    if (!state.deliveryDate) state.deliveryDate = today;
    // ถ้าลูกค้ามีเบอร์/ที่อยู่ ให้เอามาเติมตอนเข้า sub-step เป็นครั้งแรก
    if (!state.deliveryPhone && state.customer?.phone) state.deliveryPhone = state.customer.phone;
    if (!state.deliveryAddress && state.customer?.address) state.deliveryAddress = state.customer.address;
    const pm = state.deliveryPaymentMode;
    const isPartial = state.deliveryMode === 'partial';

    container.innerHTML = `
      <div class="v81-sub-head">
        <div class="ico"><i class="material-icons-round">local_shipping</i></div>
        <div>
          <div class="ttl">ข้อมูลจัดส่ง</div>
          <div class="sub">${isPartial ? 'กรอกข้อมูลจัดส่งสำหรับสินค้าที่จะไปส่งทีหลัง' : 'กรอกข้อมูลสำหรับการจัดส่งสินค้า'}</div>
        </div>
      </div>
      <div class="v81-dform">
        <div class="v81-pay-toggle">
          <div class="v81-pay-opt is-now ${pm === 'pay_now' ? 'selected' : ''}" onclick="v81SetDeliveryPay('pay_now')">
            <i class="material-icons-round">check_circle</i>ชำระเลย
          </div>
          <div class="v81-pay-opt is-cod ${pm === 'cod' ? 'selected' : ''}" onclick="v81SetDeliveryPay('cod')">
            <i class="material-icons-round">local_atm</i>ชำระหน้างาน
          </div>
        </div>
        <div class="v81-form-row">
          <div class="v81-fld">
            <label>วันที่นัดส่ง *</label>
            <input type="date" id="v81-d-date" min="${today}" value="${esc(state.deliveryDate || today)}"
              onchange="v81SetDeliv('deliveryDate',this.value)">
          </div>
          <div class="v81-fld">
            <label>เบอร์โทรติดต่อ</label>
            <input type="tel" id="v81-d-phone" placeholder="0XX-XXX-XXXX" value="${esc(state.deliveryPhone || '')}"
              oninput="v81SetDeliv('deliveryPhone',this.value)">
          </div>
        </div>
        <div class="v81-fld">
          <label>ที่อยู่จัดส่ง *</label>
          <textarea id="v81-d-addr" rows="2" placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
            oninput="v81SetDeliv('deliveryAddress',this.value)">${esc(state.deliveryAddress || '')}</textarea>
        </div>
      </div>`;
  }

  window.v81SetDeliveryPay = function (mode) {
    const state = getState(); if (!state) return;
    state.deliveryPaymentMode = mode;
    document.querySelectorAll('.v81-pay-opt').forEach(el => {
      const isNow = el.classList.contains('is-now');
      el.classList.toggle('selected', (isNow && mode === 'pay_now') || (!isNow && mode === 'cod'));
    });
  };
  window.v81SetDeliv = function (field, value) {
    const state = getState(); if (!state) return;
    state[field] = String(value || '').trim();
  };

  /* ─────── PARTIAL allocation sub-step ─────── */
  function renderPartialPage(container) {
    if (!container) return;
    const items = activeCart();
    const state = getState();
    if (!state.itemModes) state.itemModes = {};
    items.forEach(item => {
      if (!state.itemModes[item.id]) state.itemModes[item.id] = { take: 0, deliver: num(item.qty) };
    });

    const rowsHTML = items.map(item => {
      const mode = state.itemModes[item.id] || { take: 0, deliver: item.qty };
      const total = num(item.qty);
      const t = num(mode.take), d = num(mode.deliver);
      const invalid = (t + d) !== total;
      return `
        <li class="v81-partial-item ${invalid ? 'invalid' : ''}" data-pid="${esc(item.id)}">
          <div class="pname" title="${esc(item.name)}">${esc(item.name)}</div>
          <div class="total-tag">รวม ${fmt(total)} ${esc(item.unit || 'ชิ้น')}</div>
          <div class="v81-partial-box take">
            <label>รับเอง</label>
            <input type="number" min="0" max="${total}" step="1" value="${t}"
              onchange="v81PartialChange('${esc(item.id)}','take',this.value,${total})"
              oninput="v81PartialChange('${esc(item.id)}','take',this.value,${total})">
          </div>
          <div class="v81-partial-box deliv">
            <label>ส่งทีหลัง</label>
            <input type="number" min="0" max="${total}" step="1" value="${d}"
              onchange="v81PartialChange('${esc(item.id)}','deliver',this.value,${total})"
              oninput="v81PartialChange('${esc(item.id)}','deliver',this.value,${total})">
          </div>
        </li>`;
    }).join('');

    const summary = computePartialSummary();
    container.innerHTML = `
      <div class="v81-sub-head">
        <div class="ico" style="background:#7c3aed"><i class="material-icons-round">call_split</i></div>
        <div>
          <div class="ttl">จัดสรรจำนวนรับเอง / ส่งทีหลัง</div>
          <div class="sub">กำหนดจำนวนที่ลูกค้ารับวันนี้ และจำนวนที่ร้านจะไปส่งภายหลัง</div>
        </div>
      </div>
      <ul class="v81-partial-list" id="v81-partial-list">${rowsHTML}</ul>
      <div class="v81-partial-foot ${summary.ok ? 'ok' : 'bad'}" id="v81-partial-foot">
        ${partialFootInner(summary)}
      </div>`;
  }

  function partialFootInner(s) {
    const msg = s.ok
      ? `<i class="material-icons-round" style="font-size:18px;vertical-align:-4px">check_circle</i> จำนวนตรง พร้อมไปขั้นต่อไป`
      : `<i class="material-icons-round" style="font-size:18px;vertical-align:-4px">error</i> รายการที่จำนวนยังไม่ครบ: ${s.invalidCount} รายการ`;
    return `<span>${msg}</span><span class="badge">รับเองรวม ${fmt(s.takeSum)} · ส่งทีหลัง ${fmt(s.delivSum)}</span>`;
  }

  function computePartialSummary() {
    const state = getState();
    const items = activeCart();
    let takeSum = 0, delivSum = 0, invalidCount = 0;
    items.forEach(item => {
      const m = state?.itemModes?.[item.id] || { take: 0, deliver: item.qty };
      const t = num(m.take), d = num(m.deliver);
      takeSum += t; delivSum += d;
      if ((t + d) !== num(item.qty)) invalidCount++;
    });
    return { takeSum, delivSum, invalidCount, ok: invalidCount === 0 };
  }

  window.v81PartialChange = function (pid, kind, raw, total) {
    const state = getState(); if (!state) return;
    if (!state.itemModes) state.itemModes = {};
    if (!state.itemModes[pid]) state.itemModes[pid] = { take: 0, deliver: 0 };
    let val = Math.max(0, Math.min(num(raw), num(total)));
    state.itemModes[pid][kind] = val;
    const other = kind === 'take' ? 'deliver' : 'take';
    state.itemModes[pid][other] = Math.max(0, num(total) - val);
    const list = document.getElementById('v81-partial-list');
    if (list) {
      const row = list.querySelector(`[data-pid="${pid}"]`);
      if (row) {
        const t = num(state.itemModes[pid].take), d = num(state.itemModes[pid].deliver);
        row.classList.toggle('invalid', (t + d) !== num(total));
        const takeIn = row.querySelector('.v81-partial-box.take input');
        const delivIn = row.querySelector('.v81-partial-box.deliv input');
        if (takeIn && document.activeElement !== takeIn) takeIn.value = t;
        if (delivIn && document.activeElement !== delivIn) delivIn.value = d;
      }
    }
    const foot = document.getElementById('v81-partial-foot');
    if (foot) {
      const s = computePartialSummary();
      foot.className = `v81-partial-foot ${s.ok ? 'ok' : 'bad'}`;
      foot.innerHTML = partialFootInner(s);
    }
  };

  /* ─────── STRIP inline delivery form / partial-items (legacy) ─────── */
  function stripStep2InlineExtras(body) {
    if (!body) return;
    // ลบ .v12-delivery-form (กล่อง "ข้อมูลการจัดส่ง") เพราะเราย้ายไป sub-step
    body.querySelectorAll('.v12-delivery-form').forEach(el => el.remove());
    // ลบบล็อก "กำหนดจำนวนรับเอง" inline ของ v12 เดิม
    body.querySelectorAll('h4').forEach(h => {
      if (/กำหนดจำนวนรับเอง/.test(h.textContent || '')) {
        const node = h.parentElement;
        if (node && node !== body) node.remove();
      }
    });
    // ลบ wrapper ที่ห่อ delivery form ว่างเปล่า
    body.querySelectorAll('#v12-delivery-form-area').forEach(el => {
      if (!el.textContent.trim()) el.remove();
    });
  }

  /* ─────── PATCHES ─────── */
  function updateFooterButtonsForSubStep() {
    const backBtn = document.getElementById('v12-back-btn');
    const nextBtn = document.getElementById('v12-next-btn');
    if (backBtn) {
      backBtn.style.display = 'flex';
      backBtn.innerHTML = `<i class="material-icons-round">arrow_back</i> ย้อนกลับ`;
      backBtn.className = 'v12-btn-back';
      backBtn.onclick = () => { try { window.v12PrevStep && window.v12PrevStep(); } catch (_) {} };
    }
    if (nextBtn) {
      nextBtn.style.display = 'flex';
      nextBtn.innerHTML = `ถัดไป <i class="material-icons-round">arrow_forward</i>`;
      nextBtn.className = 'v12-btn-next';
    }
  }

  function patchRenderStepBody() {
    const orig = window.v12RenderStepBody;
    if (typeof orig !== 'function' || orig.__v81) return false;
    const wrapped = function (...args) {
      const state = getState();
      // ─── Sub-step: render โดยไม่ผ่าน orig (กัน flicker เพราะ orig จะ render
      //     หน้า mode-selection ก่อนแล้วเราค่อยมา replace — ทำให้รู้สึกกระตุก) ───
      if (state && Number(state.step) === 2 && (state._partialPhase || state._deliveryInfoPhase)) {
        const body = document.getElementById('v12-step-body');
        if (body) {
          if (state._partialPhase) renderPartialPage(body);
          else renderDeliveryInfoPage(body);
          updateFooterButtonsForSubStep();
        }
        return;
      }
      const r = orig.apply(this, args);
      try {
        const body = document.getElementById('v12-step-body');
        if (!state || !body) return r;
        if (Number(state.step) === 1) {
          injectCustomerBanner();
        }
        if (Number(state.step) === 2) {
          stripStep2InlineExtras(body);
        }
      } catch (e) { console.warn(TAG, 'render hook', e); }
      return r;
    };
    Object.defineProperty(wrapped, '__v81', { value: true });
    setGlobal('v12RenderStepBody', wrapped);
    return true;
  }

  function patchNextStep() {
    const orig = window.v12NextStep;
    if (typeof orig !== 'function' || orig.__v81) return false;
    const wrapped = async function () {
      const state = getState();
      // Step 1 — new customer must be saved
      if (state && Number(state.step) === 1 && state.customer?.type === 'new' && !state.customer?.id) {
        try { typeof toast === 'function' && toast('กรุณากด "บันทึกลูกค้าใหม่" ก่อนถึงจะไปขั้นต่อไปได้', 'warning'); } catch (_) {}
        const btn = document.querySelector('button[onclick*="v13SaveNewCustomer"]');
        if (btn) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          btn.style.boxShadow = '0 0 0 4px rgba(245,158,11,.4)';
          setTimeout(() => { try { btn.style.boxShadow = ''; } catch (_) {} }, 1400);
        }
        return;
      }
      // Step 2 — chain through sub-phases
      if (state && Number(state.step) === 2) {
        const mode = state.deliveryMode;
        if (state._partialPhase) {
          const s = computePartialSummary();
          if (!s.ok) {
            try { typeof toast === 'function' && toast(`รายการจำนวนยังไม่ครบ ${s.invalidCount} รายการ`, 'warning'); } catch (_) {}
            return;
          }
          state._partialPhase = false;
          // ข้าม v23 step-2 validation (เราตรวจครบแล้วใน sub-step) ไป step 3 ตรง ๆ
          advanceToStep3();
          return;
        }
        if (state._deliveryInfoPhase) {
          // อ่านค่าจาก DOM กันเคสที่ onchange ยังไม่ยิง (เช่นยังไม่ blur ช่อง date)
          const dateEl = document.getElementById('v81-d-date');
          const phoneEl = document.getElementById('v81-d-phone');
          const addrEl = document.getElementById('v81-d-addr');
          if (dateEl && dateEl.value) state.deliveryDate = dateEl.value;
          if (phoneEl && phoneEl.value != null) state.deliveryPhone = phoneEl.value.trim();
          if (addrEl && addrEl.value != null) state.deliveryAddress = addrEl.value.trim();
          if (!state.deliveryDate) {
            try { typeof toast === 'function' && toast('กรุณาระบุวันที่นัดส่ง', 'warning'); } catch (_) {}
            return;
          }
          if (state.customer?.type === 'general') {
            try { typeof toast === 'function' && toast('บิลจัดส่งต้องระบุลูกค้าก่อน — ย้อนกลับไปเลือกลูกค้าประจำ', 'warning'); } catch (_) {}
            return;
          }
          state._deliveryInfoPhase = false;
          if (mode === 'partial') {
            state._partialPhase = true;
            if (typeof window.v12RenderStepBody === 'function') window.v12RenderStepBody();
            return;
          }
          // mode='deliver' — ข้าม v23 step-2 validation, ไป step 3 ตรง
          advanceToStep3();
          return;
        }
        // mode-selection phase
        if (mode === 'deliver' || mode === 'partial') {
          state._deliveryInfoPhase = true;
          if (typeof window.v12RenderStepBody === 'function') window.v12RenderStepBody();
          return;
        }
        // mode='self' → original advance (v23 จะ step++ ปกติ)
      }
      return orig.apply(this, arguments);
    };

    function advanceToStep3() {
      const state = getState();
      if (!state) return;
      state.step = 3;
      try {
        if (typeof _v23ui === 'function') { _v23ui(); return; }
      } catch (_) {}
      try { window.v12UpdateStepBar && window.v12UpdateStepBar(); } catch (_) {}
      try { window.v12RenderStepBody && window.v12RenderStepBody(); } catch (_) {}
    }
    Object.defineProperty(wrapped, '__v81', { value: true });
    setGlobal('v12NextStep', wrapped);
    return true;
  }

  function patchPrevStep() {
    const orig = window.v12PrevStep;
    if (typeof orig !== 'function' || orig.__v81) return false;
    const wrapped = function () {
      const state = getState();
      if (state && Number(state.step) === 2) {
        if (state._partialPhase) {
          state._partialPhase = false;
          state._deliveryInfoPhase = true;
          if (typeof window.v12RenderStepBody === 'function') window.v12RenderStepBody();
          return;
        }
        if (state._deliveryInfoPhase) {
          state._deliveryInfoPhase = false;
          if (typeof window.v12RenderStepBody === 'function') window.v12RenderStepBody();
          return;
        }
      }
      return orig.apply(this, arguments);
    };
    Object.defineProperty(wrapped, '__v81', { value: true });
    setGlobal('v12PrevStep', wrapped);
    return true;
  }

  function patchSetDeliveryMode() {
    const orig = window.v12SetDeliveryMode;
    if (typeof orig !== 'function' || orig.__v81) return false;
    const wrapped = function (mode) {
      const state = getState();
      if (state) { state._partialPhase = false; state._deliveryInfoPhase = false; }
      const r = orig.apply(this, arguments);
      // หลัง orig render เสร็จ ลบฟอร์มจัดส่ง/จัดสรร inline ออก (ย้ายไป sub-step แล้ว)
      try {
        const body = document.getElementById('v12-step-body');
        if (body) stripStep2InlineExtras(body);
      } catch (_) {}
      return r;
    };
    Object.defineProperty(wrapped, '__v81', { value: true });
    setGlobal('v12SetDeliveryMode', wrapped);
    return true;
  }

  // patch v12S2 ตรงๆ — ลบฟอร์ม inline ทุกครั้งที่ render (ครอบเคสที่อื่นเรียก v12S2)
  function patchV12S2() {
    const orig = window.v12S2;
    if (typeof orig !== 'function' || orig.__v81) return false;
    const wrapped = function (container) {
      const state = getState();
      const r = orig.apply(this, arguments);
      try {
        if (!state?._partialPhase && !state?._deliveryInfoPhase) {
          const body = container || document.getElementById('v12-step-body');
          if (body) stripStep2InlineExtras(body);
        }
      } catch (_) {}
      return r;
    };
    Object.defineProperty(wrapped, '__v81', { value: true });
    setGlobal('v12S2', wrapped);
    return true;
  }

  function patchSaveNewCustomer() {
    const orig = window.v13SaveNewCustomer;
    if (typeof orig !== 'function' || orig.__v81) return false;
    const wrapped = async function () {
      const r = await orig.apply(this, arguments);
      setTimeout(injectCustomerBanner, 60);
      return r;
    };
    Object.defineProperty(wrapped, '__v81', { value: true });
    setGlobal('v13SaveNewCustomer', wrapped);
    return true;
  }

  // Make banner re-inject after any customer mutation
  function patchCustomerStateMutators() {
    ['v13SelectCustType', 'v13PickCustomer', 'v80PickCustomer', 'v80CancelPickedCustomer'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__v81Banner) return;
      const wrapped = function (...args) {
        const r = orig.apply(this, args);
        setTimeout(injectCustomerBanner, 40);
        return r;
      };
      Object.defineProperty(wrapped, '__v81Banner', { value: true });
      try { window[name] = wrapped; } catch (_) {}
    });
  }

  /* ─────── BOOTSTRAP ─────── */
  function bootstrap() {
    injectStyles();
    let attempts = 0;
    const tryPatch = () => {
      attempts++;
      patchRenderStepBody();
      patchNextStep();
      patchPrevStep();
      patchSetDeliveryMode();
      patchV12S2();
      patchSaveNewCustomer();
      patchCustomerStateMutators();
      if (window.v12RenderStepBody?.__v81
       && window.v12NextStep?.__v81
       && window.v12PrevStep?.__v81
       && window.v12S2?.__v81) {
        if (!window.__v81LoggedReady) {
          console.log(TAG, 'patches installed');
          window.__v81LoggedReady = true;
        }
        if (attempts < 6) setTimeout(tryPatch, 600);
        return;
      }
      if (attempts < 30) setTimeout(tryPatch, 400);
    };
    tryPatch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
