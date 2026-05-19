(function () {
  'use strict';

  // ไม่ใช้ eval — global function declarations อยู่ใน window scope แล้ว
  // assign ผ่าน window ก็เพียงพอ
  function setGlobal(name, value) {
    try { window[name] = value; } catch (_) {}
  }

  function state() {
    try { if (typeof v12State !== 'undefined' && v12State) return v12State; } catch (_) {}
    try { if (typeof checkoutState !== 'undefined' && checkoutState) return checkoutState; } catch (_) {}
    return window.v12State || window.checkoutState || null;
  }

  function cartTotal() {
    try { if (typeof getCartTotal === 'function') return getCartTotal(); } catch (_) {}
    try { return (Array.isArray(cart) ? cart : window.cart || []).reduce((s, item) => s + Number(item.price || 0) * Number(item.qty || 0), 0); } catch (_) {}
    return 0;
  }

  function isNewCustomerStep() {
    const s = state();
    if (s && Number(s.step) === 1 && s.customer?.type === 'new') return true;
    const body = document.getElementById('v12-step-body');
    if (!body) return false;
    const selected = body.querySelector('.v12-cust-card.selected');
    const onclick = selected?.getAttribute('onclick') || '';
    const icon = selected?.querySelector('.material-icons-round')?.textContent?.trim();
    return onclick.includes("'new'") || onclick.includes('"new"') || icon === 'person_add';
  }

  function token() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    crypto.getRandomValues(new Uint8Array(12)).forEach(n => { out += chars[n % chars.length]; });
    return out;
  }

  window.v86CreateDeliveryPinToken = async function (payload = {}) {
    const f = window.SK_FUEL;
    if (!f) throw new Error('SK_FUEL ยังไม่พร้อม');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const row = {
      token: token(),
      mode: payload.mode || 'bill_pin',
      bill_id: payload.bill_id || null,
      customer_id: payload.customer_id || null,
      expires_at: expires,
      created_by: f.staff(),
    };
    const { data, error } = await db.from('delivery_pin_token').insert(row).select('*').single();
    if (error) throw error;
    return data;
  };

  window.v86PinUrl = function (pinToken) {
    const base = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}pin.html`;
    return `${base}?token=${encodeURIComponent(pinToken)}`;
  };

  function applyPinPayload(payload) {
    if (!payload) return;
    try {
      const state = (typeof v12State !== 'undefined' && v12State) ? v12State : window.v12State;
      if (state?.customer) {
        state.customer.id = payload.customer_id || state.customer.id || null;
        state.customer.name = payload.name || state.customer.name || '';
        state.customer.phone = payload.phone || state.customer.phone || '';
        state.customer.address = payload.address || state.customer.address || '';
        state.customer.type = payload.customer_id ? 'member' : (state.customer.type || 'new');
      }
      if (typeof checkoutState !== 'undefined' && checkoutState?.customer) {
        checkoutState.customer.id = payload.customer_id || checkoutState.customer.id || null;
        checkoutState.customer.name = payload.name || checkoutState.customer.name || '';
        checkoutState.customer.phone = payload.phone || checkoutState.customer.phone || '';
        checkoutState.customer.address = payload.address || checkoutState.customer.address || '';
      }
      document.getElementById('new-customer-name') && (document.getElementById('new-customer-name').value = payload.name || '');
      document.getElementById('new-customer-phone') && (document.getElementById('new-customer-phone').value = payload.phone || '');
      document.getElementById('new-customer-address') && (document.getElementById('new-customer-address').value = payload.address || '');
      if (typeof sendToDisplay === 'function') sendToDisplay({ type: 'customer', name: payload.name, phone: payload.phone, address: payload.address, customerType: payload.customer_id ? 'member' : 'new' });
      if (typeof v12RenderStep === 'function') v12RenderStep();
      // refresh customer cache เพื่อให้ POS เห็นลูกค้าใหม่ที่เพิ่งสมัครได้
      if (payload.customer_id) {
        try { typeof loadCustomerData === 'function' && loadCustomerData(); } catch (_) {}
        try { window.v68SyncCustomerTotals?.(true); } catch (_) {}
      }
    } catch (error) {
      console.warn('[v86] apply pin payload skipped:', error);
    }
  }
  // expose สำหรับ v87 resume
  window.v86ApplyPinPayload = applyPinPayload;

  window.v86PollPinToken = function (pinId, onDone) {
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        const { data } = await db.from('delivery_pin_token').select('used_at,used_payload').eq('id', pinId).maybeSingle();
        if (data?.used_at) {
          stopped = true;
          applyPinPayload(data.used_payload);
          onDone?.(data.used_payload);
          // เด้ง success popup สวย ๆ + อัปเดต customer-display ให้พ้น pin-qr-mode
          try { if (typeof sendToDisplay === 'function') sendToDisplay({ type: 'pin_done' }); } catch (_) {}
          v86ShowPinSuccessBanner(data.used_payload);
          try { Swal.close(); } catch (_) {}
          return;
        }
      } catch (_) {}
      setTimeout(poll, 3000);
    };
    poll();
    return () => { stopped = true; };
  };

  /* ── Persistent success banner: ค้างจนพนักงานกด "ดำเนินการต่อ" หรือเปลี่ยน step ── */
  function v86ShowPinSuccessBanner(payload) {
    const name = payload?.name || 'ลูกค้า';
    const phone = payload?.phone || '-';
    const address = payload?.address || '-';
    const hasPin = !!(payload?.lat && payload?.lng);
    const signupBadge = payload?.signup
      ? '<span style="background:#d1fae5;color:#065f46;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900">⭐ สมัครสมาชิก</span>'
      : '<span style="background:#fef3c7;color:#92400e;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900">ไม่ได้สมัคร</span>';

    // 1) เสียง notification เบา ๆ
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      audio.play().catch(() => {});
    } catch (_) {}

    // 2) Toast เล็ก ๆ (ไม่บัง modal)
    toast?.('✅ ลูกค้ากรอกข้อมูลแล้ว — ดูใน checkout', 'success');

    // 3) สร้าง/อัปเดต panel ค้างใน checkout body (ไม่หายไปจนกว่าจะกด)
    setTimeout(() => v86RenderPinResultPanel(payload), 100);

    // ก่อน checkout body ยังไม่พร้อม — observe จน step body มา
    if (!document.getElementById('v12-step-body')) {
      const tries = [400, 1000, 2000, 4000];
      tries.forEach(t => setTimeout(() => v86RenderPinResultPanel(payload), t));
    }
  }

  function v86RenderPinResultPanel(payload) {
    if (!payload) return;
    const body = document.getElementById('v12-step-body');
    if (!body) return;
    let panel = document.getElementById('v86-pin-result-panel');
    const hasPin = !!(payload?.lat && payload?.lng);
    const signupBadge = payload?.signup
      ? '<span style="background:#d1fae5;color:#065f46;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900">⭐ สมัครสมาชิก</span>'
      : '<span style="background:#fef3c7;color:#92400e;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900">ไม่ได้สมัคร</span>';
    const pinBadge = hasPin
      ? '<span style="background:#d1fae5;color:#065f46;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900">📍 ปักหมุดแล้ว</span>'
      : '<span style="background:#fee2e2;color:#991b1b;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900">⚠️ ไม่ได้ปักหมุด</span>';

    const html = `
      <div style="display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:14px 18px;background:linear-gradient(135deg,#ecfdf5 0%,#f0fdfa 100%);border:2px solid #86efac;border-radius:16px;margin-bottom:14px;box-shadow:0 12px 28px rgba(16,185,129,.18);animation:v86Pulse .8s ease-out">
        <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(16,185,129,.45)">
          <i class="material-icons-round" style="color:#fff;font-size:30px">check_circle</i>
        </div>
        <div style="min-width:0">
          <div style="font-size:11px;font-weight:900;color:#047857;text-transform:uppercase;letter-spacing:.6px">✅ ลูกค้ายืนยันข้อมูลแล้ว</div>
          <div style="font-size:18px;font-weight:950;color:#0f172a;line-height:1.2;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(payload.name || '-')}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center">
            ${signupBadge}
            ${pinBadge}
            <span style="font-size:12px;color:#475569;font-weight:800">📱 ${esc(payload.phone || '-')}</span>
          </div>
          <div style="font-size:12px;color:#64748b;font-weight:750;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📍 ${esc(payload.address || '-')}</div>
        </div>
        <button type="button" onclick="document.getElementById('v86-pin-result-panel')?.remove()" style="background:#10b981;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-family:inherit;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;box-shadow:0 4px 12px rgba(16,185,129,.3)">
          <i class="material-icons-round" style="font-size:18px">arrow_forward</i> ดำเนินการต่อ
        </button>
      </div>
    `;
    if (panel) {
      panel.outerHTML = html;
    } else {
      const wrap = document.createElement('div');
      wrap.id = 'v86-pin-result-panel-wrap';
      wrap.innerHTML = html;
      // แทรกแทน v86-new-pin-panel (ถ้ามี) หรือใน top ของ body
      const oldPanel = document.getElementById('v86-new-pin-panel');
      if (oldPanel) oldPanel.replaceWith(wrap.firstElementChild);
      else body.insertBefore(wrap.firstElementChild, body.firstChild);
    }
    // ใส่ keyframes ครั้งเดียว
    if (!document.getElementById('v86-pulse-style')) {
      const s = document.createElement('style');
      s.id = 'v86-pulse-style';
      s.textContent = '@keyframes v86Pulse{from{transform:scale(.95);opacity:0}to{transform:scale(1);opacity:1}}';
      document.head.appendChild(s);
    }
  }
  window.v86RenderPinResultPanel = v86RenderPinResultPanel;

  // helper esc (local)
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  window.v86ShowPinQr = async function (payload = {}) {
    try {
      const pin = await window.v86CreateDeliveryPinToken(payload);
      const url = window.v86PinUrl(pin.token);
      if (typeof sendToDisplay === 'function') {
        sendToDisplay({ type: 'pin_qr', token: pin.token, url, mode: pin.mode, bill: payload.bill || null });
      }
      let stopPoll = null;
      await Swal.fire({
        title: 'QR ปักหมุดจัดส่ง',
        html: `<div style="display:grid;place-items:center;gap:12px"><div id="v86-qr"></div><div style="font-weight:800;color:#475569;word-break:break-all">${url}</div></div>`,
        didOpen: () => {
          const el = document.getElementById('v86-qr');
          if (el && typeof QRCode !== 'undefined') new QRCode(el, { text: url, width: 220, height: 220 });
          stopPoll = window.v86PollPinToken(pin.id, payload.onDone);
        },
        willClose: () => { stopPoll?.(); },
      });
      return pin;
    } catch (error) {
      toast?.('สร้าง QR ปักหมุดไม่สำเร็จ: ' + (error.message || error), 'error');
      return null;
    }
  };

  function renderNewCustomerPinPanel(pin = null) {
    const s = state();
    if (!isNewCustomerStep()) return;
    const body = document.getElementById('v12-step-body');
    if (!body) return;
    let panel = document.getElementById('v86-new-pin-panel');
    const url = pin?.token ? window.v86PinUrl(pin.token) : (s?.deliveryPinToken ? window.v86PinUrl(s.deliveryPinToken) : '');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'v86-new-pin-panel';
      const anchor = body.querySelector('.v81-cust-status') || body.firstElementChild;
      if (anchor?.nextSibling) body.insertBefore(panel, anchor.nextSibling);
      else body.insertBefore(panel, body.firstChild);
    }
    panel.style.cssText = 'margin:0 0 14px;padding:14px 16px;border:1.5px solid #bfdbfe;background:#eff6ff;border-radius:14px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center';
    panel.innerHTML = `
      <div style="min-width:0">
        <div style="font-size:15px;font-weight:950;color:#0f172a;display:flex;align-items:center;gap:7px"><i class="material-icons-round" style="color:#2563eb">qr_code_2</i> ให้ลูกค้ากรอกข้อมูลเองผ่าน QR</div>
        <div style="font-size:12px;font-weight:800;color:#64748b;margin-top:3px;word-break:break-all">${url ? `สร้าง QR แล้ว: ${url}` : 'สแกนเพื่อกรอกชื่อ เบอร์ ที่อยู่ และปักหมุดจัดส่ง'}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center">
        ${url ? '<div id="v86-new-pin-inline-qr" style="width:92px;height:92px;background:#fff;border:1px solid #dbeafe;border-radius:10px;padding:6px"></div>' : ''}
        <button type="button" class="btn btn-primary" onclick="v86StartNewCustomerPinFlow(true)"><i class="material-icons-round">qr_code_2</i> ${url ? 'แสดง QR อีกครั้ง' : 'สร้าง QR'}</button>
        <button type="button" class="btn btn-outline" onclick="v86HoldBillWithCurrentPin()"><i class="material-icons-round">pause_circle</i> พักบิล</button>
      </div>`;
    const inlineQr = document.getElementById('v86-new-pin-inline-qr');
    if (inlineQr && url && typeof QRCode !== 'undefined') {
      inlineQr.innerHTML = '';
      new QRCode(inlineQr, { text: url, width: 80, height: 80 });
    }
  }

  function renderNewCustomerPinForm(pin = null, target = null) {
    if (!isNewCustomerStep()) return;
    const form = target || document.getElementById('v12-cust-form');
    if (!form) return;
    const s = state();
    const url = pin?.token ? window.v86PinUrl(pin.token) : (s?.deliveryPinToken ? window.v86PinUrl(s.deliveryPinToken) : '');
    form.innerHTML = `
      <div id="v86-new-pin-form" style="margin-top:18px;border:2px solid #10b981;background:linear-gradient(180deg,#ecfdf5 0%,#fff 65%);border-radius:18px;padding:18px;display:grid;grid-template-columns:220px 1fr;gap:18px;align-items:center;box-shadow:0 16px 34px rgba(16,185,129,.12)">
        <div style="background:#fff;border:1px solid #bbf7d0;border-radius:16px;padding:14px;min-height:196px;display:grid;place-items:center">
          ${url ? '<div id="v86-new-pin-form-qr" style="width:180px;height:180px"></div>' : '<div style="text-align:center;color:#047857;font-weight:950"><i class="material-icons-round" style="font-size:54px;display:block;margin-bottom:8px">qr_code_2</i>กำลังสร้าง QR...</div>'}
        </div>
        <div style="min-width:0">
          <div style="display:inline-flex;align-items:center;gap:8px;background:#d1fae5;color:#047857;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:950;margin-bottom:10px">
            <i class="material-icons-round" style="font-size:18px">assignment_ind</i> แบบฟอร์มลูกค้าใหม่
          </div>
          <div style="font-size:24px;font-weight:950;color:#0f172a;line-height:1.25">ให้ลูกค้าสแกน QR เพื่อกรอกข้อมูลเอง</div>
          <div style="margin-top:8px;color:#64748b;font-size:14px;font-weight:850;line-height:1.65">ลูกค้าจะกรอกชื่อ เบอร์ ที่อยู่ และปักหมุดจัดส่งจากมือถือ ข้อมูลจะกลับมาที่บิลนี้อัตโนมัติ</div>
          ${url ? `<div style="margin-top:10px;color:#475569;font-size:12px;font-weight:800;word-break:break-all">${url}</div>` : ''}
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
            <button type="button" class="btn btn-primary" onclick="v86StartNewCustomerPinFlow(true)"><i class="material-icons-round">open_in_new</i> ${url ? 'เปิด QR ใหญ่' : 'สร้าง QR อีกครั้ง'}</button>
            <button type="button" class="btn btn-outline" onclick="v86HoldBillWithCurrentPin()"><i class="material-icons-round">pause_circle</i> พักบิลรอลูกค้ากรอก</button>
          </div>
        </div>
      </div>`;
    const qr = document.getElementById('v86-new-pin-form-qr');
    if (qr && url && typeof QRCode !== 'undefined') {
      qr.innerHTML = '';
      new QRCode(qr, { text: url, width: 180, height: 180 });
    }
  }

  // Staff screen should only control the flow. The QR itself belongs on the customer display.
  function renderNewCustomerPinPanel(pin = null) {
    const s = state();
    if (!isNewCustomerStep()) return;
    const body = document.getElementById('v12-step-body');
    if (!body) return;
    let panel = document.getElementById('v86-new-pin-panel');
    const url = pin?.token ? window.v86PinUrl(pin.token) : (s?.deliveryPinToken ? window.v86PinUrl(s.deliveryPinToken) : '');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'v86-new-pin-panel';
      const anchor = body.querySelector('.v81-cust-status') || body.firstElementChild;
      if (anchor?.nextSibling) body.insertBefore(panel, anchor.nextSibling);
      else body.insertBefore(panel, body.firstChild);
    }
    panel.style.cssText = 'margin:0 0 14px;padding:14px 16px;border:1.5px solid #bbf7d0;background:#ecfdf5;border-radius:14px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center';
    panel.innerHTML = `
      <div style="min-width:0">
        <div style="font-size:15px;font-weight:950;color:#064e3b;display:flex;align-items:center;gap:7px"><i class="material-icons-round" style="color:#10b981">desktop_windows</i> แบบฟอร์มลูกค้าใหม่จะแสดงบนจอลูกค้า</div>
        <div style="font-size:12px;font-weight:800;color:#047857;margin-top:3px">${url ? 'ส่ง QR ไปที่จอลูกค้าแล้ว รอให้ลูกค้าสแกนและกรอกข้อมูล' : 'กำลังสร้าง QR และส่งไปที่จอลูกค้า'}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center">
        <button type="button" class="btn btn-primary" onclick="v86StartNewCustomerPinFlow(true)"><i class="material-icons-round">cast</i> ส่งไปจอลูกค้าอีกครั้ง</button>
        <button type="button" class="btn btn-outline" onclick="openCustomerDisplay?.()"><i class="material-icons-round">open_in_new</i> เปิดจอลูกค้า</button>
      </div>`;
  }

  function renderNewCustomerPinForm(pin = null, target = null) {
    if (!isNewCustomerStep()) return;
    const form = target || document.getElementById('v12-cust-form');
    if (!form) return;
    const s = state();
    const url = pin?.token ? window.v86PinUrl(pin.token) : (s?.deliveryPinToken ? window.v86PinUrl(s.deliveryPinToken) : '');
    form.innerHTML = `
      <div id="v86-new-pin-form" style="margin-top:18px;border:2px solid #10b981;background:linear-gradient(135deg,#ecfdf5 0%,#fff 70%);border-radius:18px;padding:18px;display:grid;grid-template-columns:86px 1fr;gap:16px;align-items:center;box-shadow:0 16px 34px rgba(16,185,129,.12)">
        <div style="width:74px;height:74px;border-radius:18px;background:#10b981;color:#fff;display:grid;place-items:center;box-shadow:0 12px 26px rgba(16,185,129,.25)">
          <i class="material-icons-round" style="font-size:40px">desktop_windows</i>
        </div>
        <div style="min-width:0">
          <div style="display:inline-flex;align-items:center;gap:8px;background:#d1fae5;color:#047857;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:950;margin-bottom:10px">
            <i class="material-icons-round" style="font-size:18px">cast</i> จอลูกค้า
          </div>
          <div style="font-size:24px;font-weight:950;color:#0f172a;line-height:1.25">${url ? 'ส่งแบบฟอร์ม QR ไปที่จอลูกค้าแล้ว' : 'กำลังสร้างแบบฟอร์ม QR บนจอลูกค้า'}</div>
          <div style="margin-top:8px;color:#64748b;font-size:14px;font-weight:850;line-height:1.65">ให้ลูกค้าดูจอด้านหน้าแล้วสแกน QR จากจอลูกค้า ข้อมูลจะกลับมาที่บิลนี้อัตโนมัติ</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
            <button type="button" class="btn btn-primary" onclick="v86StartNewCustomerPinFlow(true)"><i class="material-icons-round">cast</i> ส่งไปจอลูกค้าอีกครั้ง</button>
            <button type="button" class="btn btn-outline" onclick="openCustomerDisplay?.()"><i class="material-icons-round">desktop_windows</i> เปิดจอลูกค้า</button>
            <button type="button" class="btn btn-outline" onclick="v86HoldBillWithCurrentPin()"><i class="material-icons-round">pause_circle</i> พักบิลรอลูกค้า</button>
          </div>
        </div>
      </div>`;
  }

  function renderNewCustomerPinPanel(pin = null) {
    const body = document.getElementById('v12-step-body');
    document.getElementById('v86-new-pin-panel')?.remove();
    body?.querySelectorAll('.v81-cust-status').forEach(el => el.remove());
  }

  function renderNewCustomerPinForm(pin = null, target = null) {
    if (!isNewCustomerStep()) return;
    const form = target || document.getElementById('v12-cust-form');
    if (!form) return;
    document.getElementById('v86-new-pin-panel')?.remove();
    document.querySelectorAll('#v12-step-body .v81-cust-status').forEach(el => el.remove());
    const s = state();
    const url = pin?.token ? window.v86PinUrl(pin.token) : (s?.deliveryPinToken ? window.v86PinUrl(s.deliveryPinToken) : '');
    form.innerHTML = `
      <div id="v86-new-pin-form" style="margin-top:18px;border:2px solid #10b981;background:linear-gradient(135deg,#ecfdf5 0%,#fff 70%);border-radius:18px;padding:18px;display:grid;grid-template-columns:86px 1fr;gap:16px;align-items:center;box-shadow:0 16px 34px rgba(16,185,129,.12)">
        <div style="width:74px;height:74px;border-radius:18px;background:#10b981;color:#fff;display:grid;place-items:center;box-shadow:0 12px 26px rgba(16,185,129,.25)">
          <i class="material-icons-round" style="font-size:40px">desktop_windows</i>
        </div>
        <div style="min-width:0">
          <div style="display:inline-flex;align-items:center;gap:8px;background:#d1fae5;color:#047857;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:950;margin-bottom:10px">
            <i class="material-icons-round" style="font-size:18px">cast</i> จอลูกค้า
          </div>
          <div style="font-size:24px;font-weight:950;color:#0f172a;line-height:1.25">${url ? 'ส่งแบบฟอร์ม QR ไปที่จอลูกค้าแล้ว' : 'กำลังสร้างแบบฟอร์ม QR บนจอลูกค้า'}</div>
          <div style="margin-top:8px;color:#64748b;font-size:14px;font-weight:850;line-height:1.65">ให้ลูกค้าดูจอด้านหน้าแล้วสแกน QR จากจอลูกค้า ข้อมูลจะกลับมาที่บิลนี้อัตโนมัติ</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
            <button type="button" class="btn btn-primary" onclick="v86StartNewCustomerPinFlow(true)"><i class="material-icons-round">cast</i> ส่งไปจอลูกค้าอีกครั้ง</button>
            <button type="button" class="btn btn-outline" onclick="openCustomerDisplay?.()"><i class="material-icons-round">desktop_windows</i> เปิดจอลูกค้า</button>
            <button type="button" class="btn btn-outline" onclick="v86HoldBillWithCurrentPin()"><i class="material-icons-round">pause_circle</i> พักบิลรอลูกค้า</button>
          </div>
        </div>
      </div>`;
  }

  window.v86RenderNewCustomerPinForm = function (container = null) {
    if (!isNewCustomerStep()) return;
    renderNewCustomerPinForm(null, container);
    const s = state();
    if (s && !s.deliveryPinTokenId && !s.__v86CreatingPin) {
      setTimeout(() => window.v86StartNewCustomerPinFlow(false), 0);
    }
  };

  window.v86StartNewCustomerPinFlow = async function (forceShow = false) {
    const s = state();
    if (!isNewCustomerStep()) return null;
    if (!s) {
      renderNewCustomerPinPanel();
      return null;
    }
    if (s.__v86CreatingPin) return null;
    if (s.deliveryPinTokenId) {
      const bill = { no: 'รอสร้างบิล', total: cartTotal() };
      const pin = { id: s.deliveryPinTokenId, token: s.deliveryPinToken, mode: 'new_customer' };
      renderNewCustomerPinPanel(pin);
      renderNewCustomerPinForm(pin);
      if (typeof sendToDisplay === 'function') {
        sendToDisplay({ type: 'pin_qr', token: pin.token, url: window.v86PinUrl(pin.token), mode: pin.mode, bill });
      }
      if (!s.__v86PinStopPoll) {
        s.__v86PinStopPoll = window.v86PollPinToken(pin.id, payload => {
          s.deliveryPinPayload = payload;
          renderNewCustomerPinPanel(pin);
          renderNewCustomerPinForm(pin);
        });
      }
      if (forceShow) toast?.('ส่ง QR ไปที่จอลูกค้าแล้ว', 'success');
      return pin;
    }
    s.__v86CreatingPin = true;
    try {
      const bill = { no: 'รอสร้างบิล', total: cartTotal() };
      const pin = await window.v86CreateDeliveryPinToken({ mode: 'new_customer', bill });
      s.deliveryPinTokenId = pin.id;
      s.deliveryPinToken = pin.token;
      renderNewCustomerPinPanel(pin);
      renderNewCustomerPinForm(pin);
      if (typeof sendToDisplay === 'function') {
        sendToDisplay({ type: 'pin_qr', token: pin.token, url: window.v86PinUrl(pin.token), mode: pin.mode, bill });
      }
      s.__v86PinStopPoll?.();
      s.__v86PinStopPoll = window.v86PollPinToken(pin.id, payload => {
        s.deliveryPinPayload = payload;
        renderNewCustomerPinPanel(pin);
        renderNewCustomerPinForm(pin);
      });
      toast?.('ส่ง QR ไปที่จอลูกค้าแล้ว', 'success');
      return pin;
      let stopPoll = null;
      const qrUrl = window.v86PinUrl(pin.token);
      await Swal.fire({
        title: 'QR สำหรับลูกค้าใหม่',
        html: `<div style="display:grid;place-items:center;gap:12px">
          <div id="v86-new-qr"></div>
          <div style="font-size:13px;font-weight:800;color:#64748b;line-height:1.55">จอลูกค้าจะแสดง QR นี้ด้วย<br>${qrUrl}</div>
          <button type="button" class="swal2-confirm swal2-styled" onclick="v87HoldCurrentBill('${pin.id}','new_customer')">พักบิลไว้ก่อน</button>
        </div>`,
        showConfirmButton: true,
        confirmButtonText: 'รอกรอกในหน้านี้',
        didOpen: () => {
          const el = document.getElementById('v86-new-qr');
          if (el && typeof QRCode !== 'undefined') new QRCode(el, { text: qrUrl, width: 220, height: 220 });
          stopPoll = window.v86PollPinToken(pin.id, payload => {
            s.deliveryPinPayload = payload;
            renderNewCustomerPinPanel(pin);
          });
        },
        willClose: () => { stopPoll?.(); },
      });
      return pin;
    } catch (error) {
      toast?.('สร้าง QR ลูกค้าใหม่ไม่สำเร็จ: ' + (error.message || error), 'error');
      return null;
    } finally {
      s.__v86CreatingPin = false;
    }
  };

  window.v86HoldBillWithCurrentPin = async function () {
    const s = state();
    if (!s?.deliveryPinTokenId) {
      const pin = await window.v86StartNewCustomerPinFlow(false);
      if (!pin) return;
    }
    window.v87HoldCurrentBill?.(s.deliveryPinTokenId, 'new_customer');
  };

  function patchCheckoutNewCustomer() {
    const patchTypeSelector = name => {
      const originalType = window[name];
      if (typeof originalType !== 'function' || originalType.__v86Pin) return;
      const wrapped = async function (type) {
        const result = await originalType.apply(this, arguments);
        if (type === 'new') {
          setTimeout(() => {
            renderNewCustomerPinPanel();
            renderNewCustomerPinForm();
            window.v86StartNewCustomerPinFlow(false);
          }, 180);
        }
        return result;
      };
      Object.defineProperty(wrapped, '__v86Pin', { value: true });
      setGlobal(name, wrapped);
    };

    patchTypeSelector('selectCustomerType');
    patchTypeSelector('v12SelectCustType');
    patchTypeSelector('v13SelectCustType');

    const originalCustForm = window.v12RenderCustForm;
    if (typeof originalCustForm === 'function' && !originalCustForm.__v86PinForm) {
      const wrappedCustForm = function (container) {
        const result = originalCustForm.apply(this, arguments);
        setTimeout(() => {
          if (isNewCustomerStep()) {
            renderNewCustomerPinForm();
            window.v86StartNewCustomerPinFlow(false);
          }
        }, 0);
        return result;
      };
      Object.defineProperty(wrappedCustForm, '__v86PinForm', { value: true });
      setGlobal('v12RenderCustForm', wrappedCustForm);
    }

    const originalV13CustForm = window.v13RenderCustForm;
    if (typeof originalV13CustForm === 'function' && !originalV13CustForm.__v86PinForm) {
      const wrappedV13CustForm = function (container) {
        const result = originalV13CustForm.apply(this, arguments);
        setTimeout(() => {
          if (isNewCustomerStep()) window.v86RenderNewCustomerPinForm(container);
        }, 0);
        return result;
      };
      Object.defineProperty(wrappedV13CustForm, '__v86PinForm', { value: true });
      setGlobal('v13RenderCustForm', wrappedV13CustForm);
    }

    const originalRender = window.v12RenderStepBody;
    if (typeof originalRender === 'function' && !originalRender.__v86PinPanel) {
      const wrappedRender = function (...args) {
        const result = originalRender.apply(this, args);
        setTimeout(() => {
          renderNewCustomerPinPanel();
          renderNewCustomerPinForm();
          const s = state();
          if (s?.step === 1 && s.customer?.type === 'new' && !s.deliveryPinTokenId) {
            window.v86StartNewCustomerPinFlow(false);
          }
        }, 0);
        return result;
      };
      Object.defineProperty(wrappedRender, '__v86PinPanel', { value: true });
      setGlobal('v12RenderStepBody', wrappedRender);
    }
  }

  function bootNewCustomerQr() {
    patchCheckoutNewCustomer();
    if (!isNewCustomerStep()) return;
    renderNewCustomerPinPanel();
    renderNewCustomerPinForm();
    window.v86StartNewCustomerPinFlow(false);
  }

  patchCheckoutNewCustomer();
  window.addEventListener('load', () => setTimeout(bootNewCustomerQr, 900));

  // observe เฉพาะ checkout overlay (ไม่ observe ทั้ง document — ลด CPU)
  function attachCheckoutObserver() {
    const overlay = document.getElementById('checkout-overlay') || document.querySelector('.v12-checkout-overlay');
    if (!overlay || overlay.__v86Observing) return;
    overlay.__v86Observing = true;
    new MutationObserver(() => {
      patchCheckoutNewCustomer();
      if (isNewCustomerStep()) {
        renderNewCustomerPinPanel();
        renderNewCustomerPinForm();
      }
    }).observe(overlay, { childList: true, subtree: true });
  }
  setTimeout(attachCheckoutObserver, 1500);
  setTimeout(attachCheckoutObserver, 4000);
  document.addEventListener('click', e => {
    // attach เมื่อ checkout เปิดครั้งแรก
    if (e.target?.closest?.('[onclick*="openCheckout"]') || e.target?.closest?.('.v12-checkout-shell')) {
      setTimeout(attachCheckoutObserver, 300);
    }
    if (e.target?.closest?.('[onclick*="v12SelectCustType"][onclick*="new"],[onclick*="v13SelectCustType"][onclick*="new"]')) {
      setTimeout(bootNewCustomerQr, 220);
    }
  });

  console.log('[v86] delivery pin helpers loaded');
})();
