(function () {
  'use strict';

  const BILL_TABLE = 'บิลขาย';
  const ITEM_TABLE = 'รายการในบิล';
  const PRODUCT_TABLE = 'สินค้า';
  const MOVE_TABLE = 'stock_movement';
  const CUSTOMER_TABLE = 'customer';

  const num = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = v => {
    try { return typeof formatNum === 'function' ? formatNum(v) : num(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
    catch (_) { return num(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const js = v => String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const parseInfo = info => {
    if (!info) return {};
    if (typeof info === 'object') return info || {};
    try { return JSON.parse(info) || {}; } catch (_) { return {}; }
  };
  const currentUser = () => {
    try { if (window.USER) return window.USER; } catch (_) {}
    try { return Function('try { return USER || null } catch(e) { return null }')(); } catch (_) { return null; }
  };
  const isAdmin = () => {
    try { if (typeof window.isAdmin === 'function' && window.isAdmin()) return true; } catch (_) {}
    try { return currentUser()?.role === 'admin'; } catch (_) { return false; }
  };
  const staff = () => {
    try { return window.USER?.username || 'admin'; } catch (_) { return 'admin'; }
  };
  const hasReturn = bill => num(parseInfo(bill?.return_info).return_total) > 0;
  const getItems = info => Array.isArray(info?.return_items) ? info.return_items : [];

  function injectStyle() {
    if (document.getElementById('v76-return-correction-style')) return;
    const style = document.createElement('style');
    style.id = 'v76-return-correction-style';
    style.textContent = `
      .v76-return-fix-btn{color:#7c3aed!important;border-color:rgba(124,58,237,.32)!important;background:#faf5ff!important}
      .v76-return-fix-btn:hover{background:#f3e8ff!important}
      .swal2-popup.v76-return-popup{padding:0!important;border-radius:8px!important;overflow:hidden!important;width:min(760px,calc(100vw - 24px))!important}
      .swal2-popup.v76-return-popup .swal2-html-container{margin:0!important;padding:0!important;overflow:visible!important}
      .swal2-popup.v76-return-popup .swal2-actions{padding:14px 22px 20px!important;margin:0!important;background:#fff;border-top:1px solid #eef2f7}
      .swal2-popup.v76-return-popup .swal2-confirm,.swal2-popup.v76-return-popup .swal2-cancel{border-radius:8px!important;height:44px!important;padding:0 20px!important;font-weight:900!important}
      .v76-return-modal{font-family:inherit;text-align:left;color:#172033;background:#fff}
      .v76-return-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:22px 24px;background:#f8fafc;border-bottom:1px solid #e5eaf2}
      .v76-return-kicker{display:flex;align-items:center;gap:8px;color:#7c3aed;font-size:12px;font-weight:950;letter-spacing:.02em;margin-bottom:5px}
      .v76-return-kicker i{font-size:18px}
      .v76-return-title{font-size:24px;font-weight:950;color:#101827;line-height:1.1;margin:0}
      .v76-return-sub{margin-top:7px;color:#64748b;font-size:13px;font-weight:750;line-height:1.4}
      .v76-return-badge{align-self:start;white-space:nowrap;border:1px solid #e9d5ff;background:#faf5ff;color:#6d28d9;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:950}
      .v76-return-body{padding:18px 24px 20px}
      .v76-return-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
      .v76-return-stat{border:1px solid #e5eaf2;background:#fff;border-radius:8px;padding:11px 12px;min-width:0}
      .v76-return-stat span{display:block;color:#64748b;font-size:11px;font-weight:850;margin-bottom:4px}
      .v76-return-stat b{display:block;color:#0f172a;font-size:18px;font-weight:950;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v76-return-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 8px;color:#334155;font-size:12px;font-weight:950}
      .v76-return-list{display:flex;flex-direction:column;gap:8px;max-height:38vh;overflow:auto;padding:1px 4px 1px 1px}
      .v76-return-row{display:grid;grid-template-columns:34px minmax(0,1fr) 128px;gap:12px;align-items:center;border:1px solid #e5eaf2;border-radius:8px;padding:12px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04);cursor:pointer;transition:border-color .15s,box-shadow .15s,background .15s}
      .v76-return-row:hover{border-color:#c4b5fd;background:#fdfbff}
      .v76-return-row.disabled{opacity:.55;background:#f8fafc;cursor:not-allowed}
      .v76-check{width:22px;height:22px;accent-color:#7c3aed;justify-self:center}
      .v76-return-name{font-weight:950;color:#0f172a;font-size:14px;line-height:1.25;overflow:hidden;text-overflow:ellipsis}
      .v76-return-meta{font-size:12px;color:#64748b;margin-top:4px;line-height:1.45}
      .v76-qty-wrap{display:grid;gap:5px}
      .v76-qty-wrap label{font-size:10px;color:#64748b;font-weight:900;text-align:center}
      .v76-return-row input[type="number"]{width:100%;height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 9px;font-weight:950;text-align:center;color:#111827;background:#fff;outline:none}
      .v76-return-row input[type="number"]:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.14)}
      .v76-return-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px}
      .v76-return-tools b{font-size:13px;font-weight:950;color:#334155}
      .v76-return-tools button{border:1px solid #d8b4fe;background:#faf5ff;color:#7c3aed;border-radius:8px;height:34px;padding:0 12px;font-weight:950;cursor:pointer}
      .v76-return-tools button:hover{background:#f3e8ff}
      .v76-return-note{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:start;font-size:12px;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:11px 12px;margin-top:12px;line-height:1.55}
      .v76-return-note i{font-size:20px;color:#ea580c}
      .v76-return-cash{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;margin-top:10px;padding:11px 12px;border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e3a8a;line-height:1.5}
      .v76-return-cash input{width:18px;height:18px;accent-color:#2563eb;margin-top:1px}
      .v76-return-form{margin-top:12px}
      .v76-return-form label{display:block;font-size:12px;font-weight:950;color:#334155;margin-bottom:6px}
      .v76-return-form input{width:100%;height:44px;border:1px solid #cbd5e1;border-radius:8px;padding:0 13px;font:inherit;font-weight:800;color:#0f172a;outline:none;box-sizing:border-box}
      .v76-return-form input:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.14)}
      .swal2-popup:has(.v76-return-modal){padding:0!important;border-radius:8px!important;overflow:hidden!important;width:min(760px,calc(100vw - 24px))!important}
      .swal2-popup:has(.v76-return-modal) .swal2-title{margin:0!important;padding:22px 24px 10px!important;background:#f8fafc;color:#101827!important;font-size:26px!important;font-weight:950!important;line-height:1.15!important;text-align:left!important}
      .swal2-popup:has(.v76-return-modal) .swal2-html-container{margin:0!important;padding:0 24px 18px!important;text-align:left!important;color:#172033!important;overflow:visible!important}
      .swal2-popup:has(.v76-return-modal) .swal2-actions{margin:0!important;padding:14px 24px 20px!important;border-top:1px solid #eef2f7;background:#fff}
      .swal2-popup:has(.v76-return-modal) .swal2-confirm,.swal2-popup:has(.v76-return-modal) .swal2-cancel{height:44px!important;border-radius:8px!important;padding:0 20px!important;font-weight:950!important}
      .v76-return-modal .swal2-input{display:block!important;width:100%!important;height:44px!important;margin:12px 0 0!important;border:1px solid #cbd5e1!important;border-radius:8px!important;box-shadow:none!important;padding:0 13px!important;font-size:14px!important;font-weight:800!important;color:#0f172a!important}
      .v76-return-modal .swal2-input:focus{border-color:#8b5cf6!important;box-shadow:0 0 0 3px rgba(139,92,246,.14)!important}
      .v76-return-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin:0 0 14px;padding:14px;border:1px solid #e9d5ff;background:#faf5ff;border-radius:8px}
      .v76-return-head strong{display:block;font-size:18px;font-weight:950;color:#581c87;line-height:1.15}
      .v76-return-head span{font-size:13px;color:#7e22ce;font-weight:850;line-height:1.45}
      .v76-return-head>span{white-space:nowrap;border:1px solid #e9d5ff;background:#fff;border-radius:999px;padding:6px 10px}
      .v76-return-note{display:block;font-size:12px;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:11px 12px;margin-top:12px;line-height:1.6;font-weight:750}
      .v76-return-row input[type="checkbox"]{width:20px;height:20px;accent-color:#7c3aed;justify-self:center}
      .v76-return-list+.v76-return-note{margin-bottom:2px}
      .swal2-popup.v76-return-popup .swal2-html-container{padding:0!important}
      .swal2-popup.v76-return-popup .swal2-title{display:none!important}
      .swal2-popup.v76-return-popup .v76-return-note{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:start;line-height:1.55}
      @media(max-width:640px){
        .v76-return-hero{grid-template-columns:1fr;padding:18px}
        .v76-return-body{padding:14px 16px 18px}
        .v76-return-summary{grid-template-columns:1fr}
        .v76-return-row{grid-template-columns:30px minmax(0,1fr);gap:10px}
        .v76-qty-wrap{grid-column:2}
      }
    `;
    document.head.appendChild(style);
  }

  function findBillIdsInDom() {
    const ids = new Set();
    document.querySelectorAll('[data-v39-actions]').forEach(el => {
      const id = el.getAttribute('data-v39-actions');
      if (id) ids.add(id);
    });
    document.querySelectorAll('button[onclick*="viewBillDetail"]').forEach(btn => {
      const raw = btn.getAttribute('onclick') || '';
      const m = raw.match(/viewBillDetail\('([^']+)'\)/);
      if (m?.[1]) ids.add(m[1]);
    });
    return [...ids];
  }

  function addButtonForBill(bill) {
    if (!bill?.id || !hasReturn(bill)) return;
    const id = String(bill.id);
    const cssId = window.CSS?.escape ? CSS.escape(id) : id.replace(/"/g, '\\"');
    const historyWrap = document.querySelector(`[data-v39-actions="${cssId}"] .v39-actions`);
    if (historyWrap && !historyWrap.querySelector('.v76-return-fix-btn')) {
      historyWrap.insertAdjacentHTML('beforeend',
        `<button class="v39-action v76-return-fix-btn" onclick="v76OpenReturnCorrection('${js(id)}')" title="แก้ไขการคืนสินค้า"><i class="material-icons-round">settings_backup_restore</i></button>`);
    }
    document.querySelectorAll('button[onclick*="viewBillDetail"]').forEach(btn => {
      const raw = btn.getAttribute('onclick') || '';
      if (!raw.includes(`'${id}'`)) return;
      const wrap = btn.parentElement;
      if (!wrap || wrap.querySelector('.v76-return-fix-btn')) return;
      wrap.insertAdjacentHTML('beforeend',
        `<button class="v12-bmc-action-btn v76-return-fix-btn" onclick="v76OpenReturnCorrection('${js(id)}')" title="แก้ไขการคืนสินค้า"><i class="material-icons-round" style="font-size:13px">settings_backup_restore</i> แก้คืน</button>`);
    });
  }

  async function injectButtons() {
    if (!isAdmin() || !window.db) return;
    injectStyle();
    const ids = findBillIdsInDom();
    if (!ids.length) return;
    try {
      const { data, error } = await db.from(BILL_TABLE).select('id,return_info').in('id', ids);
      if (error) throw error;
      (data || []).forEach(addButtonForBill);
    } catch (e) {
      console.warn('[v76] inject return correction:', e);
    }
  }

  function patchRender(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v76ReturnCorrection) return;
    const wrapped = async function (...args) {
      const out = await original.apply(this, args);
      setTimeout(injectButtons, 80);
      return out;
    };
    Object.defineProperty(wrapped, '__v76ReturnCorrection', { value: true });
    window[name] = wrapped;
    try { Function('n', 'v', 'try{eval(n+"=v")}catch(e){}')(name, wrapped); } catch (_) {}
  }

  function patchActionToggle() {
    const original = window.v39ToggleHistoryActions;
    if (typeof original !== 'function' || original.__v76ReturnCorrection) return;
    window.v39ToggleHistoryActions = function (...args) {
      const out = original.apply(this, args);
      setTimeout(injectButtons, 20);
      return out;
    };
    Object.defineProperty(window.v39ToggleHistoryActions, '__v76ReturnCorrection', { value: true });
  }

  function matchBillItem(returnItem, billItems) {
    const rn = String(returnItem.name || '');
    const ru = String(returnItem.unit || returnItem.sell_unit || '');
    return (billItems || []).find(it => String(it.name || '') === rn && (!ru || String(it.unit || '') === ru))
      || (billItems || []).find(it => String(it.name || '') === rn)
      || null;
  }

  async function convRateFor(productId, unitName, baseUnit, fallback) {
    if (num(fallback) > 0) return num(fallback);
    if (!productId || !unitName || unitName === baseUnit) return 1;
    try {
      const { data } = await db.from('product_units')
        .select('conv_rate')
        .eq('product_id', productId)
        .eq('unit_name', unitName)
        .maybeSingle();
      return Math.max(0.000001, num(data?.conv_rate) || 1);
    } catch (_) {
      return 1;
    }
  }

  function statusAfterCorrection(bill, newReturnTotal, newTotal) {
    if (newReturnTotal > 0) return newTotal <= 0 ? 'คืนสินค้า' : 'คืนบางส่วน';
    if (String(bill.method || '').includes('ค้าง')) return 'ค้างชำระ';
    return 'สำเร็จ';
  }

  async function recordCashReverse(bill, amount, note) {
    try {
      const { data: sess } = await db.from('cash_session')
        .select('id')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sess?.id) return;
      await db.from('cash_transaction').insert({
        session_id: sess.id,
        type: 'แก้ไขคืนสินค้า',
        direction: 'in',
        amount,
        net_amount: amount,
        balance_after: 0,
        ref_id: bill.id,
        ref_table: BILL_TABLE,
        staff_name: staff(),
        note,
      });
    } catch (e) {
      console.warn('[v76] cash reverse skipped:', e);
    }
  }

  window.v76OpenReturnCorrection = async function (billId) {
    if (!isAdmin()) {
      toast?.('เฉพาะแอดมินเท่านั้น', 'warning');
      return;
    }
    try {
      const [{ data: bill, error: be }, { data: billItems, error: ie }] = await Promise.all([
        db.from(BILL_TABLE).select('*').eq('id', billId).maybeSingle(),
        db.from(ITEM_TABLE).select('*').eq('bill_id', billId),
      ]);
      if (be) throw be;
      if (ie) throw ie;
      if (!bill) throw new Error('ไม่พบบิล');

      const info = parseInfo(bill.return_info);
      const returnItems = getItems(info);
      if (!returnItems.length || num(info.return_total) <= 0) {
        toast?.('บิลนี้ไม่มีรายการคืนสินค้า', 'info');
        return;
      }

      const rows = returnItems.map((it, idx) => {
        const bi = matchBillItem(it, billItems || []);
        const qty = num(it.qty);
        const unit = it.unit || it.sell_unit || bi?.unit || '';
        const disabled = !bi?.product_id || qty <= 0;
        return `<label class="v76-return-row ${disabled ? 'disabled' : ''}">
          <input type="checkbox" class="v76-undo-check" data-idx="${idx}" ${disabled ? 'disabled' : ''}>
          <div>
            <div class="v76-return-name">${esc(it.name || bi?.name || '-')}</div>
            <div class="v76-return-meta">คืนไว้ ${fmt(qty)} ${esc(unit)} · ยอด ${fmt(it.total || qty * num(it.price))} บาท${disabled ? '<br>ไม่พบสินค้าอ้างอิงในบิล จึงแก้ด้วยปุ่มนี้ไม่ได้' : ''}</div>
          </div>
          <div class="v76-qty-wrap">
            <label>จำนวนที่จะแก้คืน</label>
            <input type="number" class="v76-undo-qty" data-idx="${idx}" min="0" max="${esc(qty)}" step="0.000001" value="${esc(qty)}" ${disabled ? 'disabled' : ''}>
          </div>
        </label>`;
      }).join('');

      const refundMethod = info.refund_method || '';
      const looksCashRefund = String(refundMethod || bill.method || '').includes('เงินสด');
      const { value } = await Swal.fire({
        html: `<div class="v76-return-modal">
          <div class="v76-return-hero">
            <div>
              <div class="v76-return-kicker"><i class="material-icons-round">settings_backup_restore</i> แอดมิน</div>
              <h2 class="v76-return-title">แก้ไขการคืนสินค้า</h2>
              <div class="v76-return-sub">เลือกเฉพาะรายการที่คืนผิด ระบบจะย้อนสต็อกและคำนวณยอดบิลใหม่ให้อัตโนมัติ</div>
            </div>
            <div class="v76-return-badge">บิล #${esc(bill.bill_no || bill.id)}</div>
          </div>
          <div class="v76-return-body">
            <div class="v76-return-summary">
              <div class="v76-return-stat"><span>ยอดคืนปัจจุบัน</span><b>฿${fmt(info.return_total)}</b></div>
              <div class="v76-return-stat"><span>สถานะบิล</span><b>${esc(bill.status || '-')}</b></div>
              <div class="v76-return-stat"><span>จำนวนรายการคืน</span><b>${returnItems.length}</b></div>
            </div>
            <div class="v76-return-tools">
              <b>เลือกรายการที่ต้องการย้อนกลับ</b>
              <button type="button" id="v76-select-all">เลือกทั้งหมด</button>
            </div>
            <div class="v76-return-list">${rows}</div>
            <div class="v76-return-note"><i class="material-icons-round">info</i><span>ระบบจะลดสต็อกกลับ, บันทึกประวัติ stock_movement แบบย้อนรายการ, และคำนวณยอดบิล/ยอดหนี้ใหม่ให้</span></div>
            ${looksCashRefund ? `<label class="v76-return-cash"><input type="checkbox" id="v76-cash-reverse"> <span>บันทึกรับเงินคืนเข้าลิ้นชักด้วย เฉพาะกรณีที่ตอนคืนผิดได้จ่ายเงินสดให้ลูกค้าไปแล้ว</span></label>` : ''}
            <div class="v76-return-form"><label>หมายเหตุการแก้ไข</label><input id="v76-return-note" placeholder="เช่น คืนผิดรายการ / ใส่จำนวนผิด"></div>
          </div>
        </div>`,
        width: 760,
        customClass: { popup: 'v76-return-popup' },
        showCancelButton: true,
        confirmButtonText: 'บันทึกแก้คืน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#7c3aed',
        didOpen: () => {
          document.getElementById('v76-select-all')?.addEventListener('click', () => {
            document.querySelectorAll('.v76-undo-check:not(:disabled)').forEach(ch => { ch.checked = true; });
          });
        },
        preConfirm: () => {
          const selected = [];
          document.querySelectorAll('.v76-undo-check:checked').forEach(ch => {
            const idx = Number(ch.getAttribute('data-idx'));
            const q = num(document.querySelector(`.v76-undo-qty[data-idx="${idx}"]`)?.value);
            const max = num(returnItems[idx]?.qty);
            if (q > 0 && q <= max) selected.push({ idx, qty: q });
          });
          if (!selected.length) {
            Swal.showValidationMessage('เลือกรายการและจำนวนที่ต้องการแก้คืนก่อน');
            return false;
          }
          return {
            selected,
            note: document.getElementById('v76-return-note')?.value?.trim() || 'แก้ไขการคืนสินค้า',
            reverseCash: !!document.getElementById('v76-cash-reverse')?.checked,
          };
        },
      });
      if (!value) return;

      const ok = await Swal.fire({
        icon: 'warning',
        title: 'ยืนยันแก้ไขการคืน?',
        text: 'รายการนี้จะปรับสต็อกและยอดบิลกลับทันที',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#7c3aed',
      });
      if (!ok.isConfirmed) return;

      await window.v76ApplyReturnCorrection(bill.id, value);
    } catch (e) {
      console.error('[v76] open correction:', e);
      toast?.('เปิดแก้ไขการคืนไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  };

  window.v76ApplyReturnCorrection = async function (billId, payload) {
    if (!isAdmin()) throw new Error('admin only');
    if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังแก้ไขการคืนสินค้า...');
    try {
      const [{ data: bill, error: be }, { data: billItems, error: ie }] = await Promise.all([
        db.from(BILL_TABLE).select('*').eq('id', billId).maybeSingle(),
        db.from(ITEM_TABLE).select('*').eq('bill_id', billId),
      ]);
      if (be) throw be;
      if (ie) throw ie;
      if (!bill) throw new Error('ไม่พบบิล');

      const info = parseInfo(bill.return_info);
      const returnItems = getItems(info).map(it => ({ ...it }));
      const selected = Array.isArray(payload?.selected) ? payload.selected : [];
      const note = payload?.note || 'แก้ไขการคืนสินค้า';
      let undoTotal = 0;
      let undoCost = 0;

      for (const sel of selected) {
        const idx = Number(sel.idx);
        const undoQty = num(sel.qty);
        const ret = returnItems[idx];
        if (!ret || undoQty <= 0 || undoQty > num(ret.qty)) continue;

        const billItem = matchBillItem(ret, billItems || []);
        if (!billItem?.product_id) throw new Error(`ไม่พบสินค้าอ้างอิงของ "${ret.name || '-'}"`);
        const { data: product, error: pe } = await db.from(PRODUCT_TABLE).select('stock,unit').eq('id', billItem.product_id).maybeSingle();
        if (pe) throw pe;
        const unitName = ret.unit || ret.sell_unit || billItem.unit || product?.unit || '';
        const baseUnit = product?.unit || ret.base_unit || unitName;
        const conv = await convRateFor(billItem.product_id, unitName, baseUnit, ret.conv_rate);
        const baseQty = parseFloat((undoQty * conv).toFixed(6));
        const stockBefore = num(product?.stock);
        if (stockBefore < baseQty) {
          throw new Error(`สต็อก "${ret.name}" ไม่พอสำหรับย้อนคืน (${fmt(stockBefore)} < ${fmt(baseQty)})`);
        }
        const stockAfter = parseFloat((stockBefore - baseQty).toFixed(6));
        await db.from(PRODUCT_TABLE).update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', billItem.product_id);
        await db.from(MOVE_TABLE).insert({
          product_id: billItem.product_id,
          product_name: ret.name || billItem.name,
          type: 'แก้ไขคืนสินค้า',
          direction: 'out',
          qty: baseQty,
          stock_before: stockBefore,
          stock_after: stockAfter,
          ref_id: bill.id,
          ref_table: BILL_TABLE,
          staff_name: staff(),
          note: `${note} | ย้อนคืน ${undoQty} ${unitName}${conv !== 1 ? ` = ${baseQty} ${baseUnit}` : ''}`,
        });
        try {
          const p = Array.isArray(window.products) ? window.products.find(x => String(x.id) === String(billItem.product_id)) : null;
          if (p) p.stock = stockAfter;
        } catch (_) {}

        const lineTotal = undoQty * num(ret.price);
        const lineCost = undoQty * num(ret.cost);
        undoTotal += lineTotal;
        undoCost += lineCost;
        const leftQty = parseFloat((num(ret.qty) - undoQty).toFixed(6));
        if (leftQty > 0) {
          ret.qty = leftQty;
          ret.total = leftQty * num(ret.price);
          ret.return_cost = leftQty * num(ret.cost);
        } else {
          returnItems[idx] = null;
        }
      }

      if (undoTotal <= 0) throw new Error('ไม่มีรายการที่แก้ไข');
      const nextItems = returnItems.filter(Boolean);
      const originalTotal = info.original_total != null
        ? num(info.original_total)
        : num(bill.total) + num(info.return_total || 0);
      const newReturnTotal = Math.max(0, num(info.return_total) - undoTotal);
      const newReturnCost = Math.max(0, num(info.return_cost_total) - undoCost);
      const newBillTotal = Math.max(0, originalTotal - newReturnTotal);
      const nextReturnInfo = newReturnTotal > 0 ? {
        ...info,
        corrected_at: new Date().toISOString(),
        corrected_by: staff(),
        correction_note: note,
        return_items: nextItems,
        return_total: newReturnTotal,
        return_cost_total: newReturnCost,
        original_total: originalTotal,
        new_total: newBillTotal,
      } : null;
      const nextStatus = statusAfterCorrection(bill, newReturnTotal, newBillTotal);
      await db.from(BILL_TABLE).update({
        return_info: nextReturnInfo,
        total: newBillTotal,
        status: nextStatus,
      }).eq('id', bill.id);

      if (bill.customer_id) {
        try {
          const debtBefore = Math.max(0, originalTotal - num(bill.deposit_amount) - num(info.return_total));
          const debtAfter = Math.max(0, originalTotal - num(bill.deposit_amount) - newReturnTotal);
          const debtDelta = String(bill.method || '').includes('ค้าง') ? Math.max(0, debtAfter - debtBefore) : 0;
          const { data: c } = await db.from(CUSTOMER_TABLE).select('total_purchase,debt_amount').eq('id', bill.customer_id).maybeSingle();
          if (c) {
            await db.from(CUSTOMER_TABLE).update({
              total_purchase: num(c.total_purchase) + undoTotal,
              debt_amount: num(c.debt_amount) + debtDelta,
            }).eq('id', bill.customer_id);
          }
        } catch (e) {
          console.warn('[v76] customer correction skipped:', e);
        }
      }

      if (payload?.reverseCash) {
        await recordCashReverse(bill, undoTotal, `รับเงินคืนจากการแก้คืนบิล #${bill.bill_no || bill.id}: ${note}`);
      }
      if (typeof logActivity === 'function') {
        logActivity('แก้ไขการคืนสินค้า', `บิล #${bill.bill_no || bill.id} | ย้อนยอดคืน ฿${fmt(undoTotal)} | ยอดบิลใหม่ ฿${fmt(newBillTotal)} | ${note}`, bill.id, BILL_TABLE);
      }

      await loadProducts?.();
      updateHomeStats?.();
      v12BMCLoad?.();
      loadHistoryData?.();
      renderDebts?.();
      if (typeof v9HideOverlay === 'function') v9HideOverlay();
      toast?.('แก้ไขการคืนสินค้าเรียบร้อย', 'success');
      Swal.fire({ icon: 'success', title: 'แก้ไขการคืนเรียบร้อย', text: `ยอดบิลใหม่ ฿${fmt(newBillTotal)}`, confirmButtonColor: '#7c3aed' });
    } catch (e) {
      if (typeof v9HideOverlay === 'function') v9HideOverlay();
      console.error('[v76] apply correction:', e);
      toast?.('แก้ไขการคืนไม่สำเร็จ: ' + (e.message || e), 'error');
      throw e;
    }
  };

  function install() {
    ['v12BMCLoad', 'v39LoadHistoryData', 'loadHistoryData', 'renderHistory'].forEach(patchRender);
    patchActionToggle();
    setTimeout(injectButtons, 600);
    setTimeout(injectButtons, 1600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('[v76] admin return correction loaded');
})();
