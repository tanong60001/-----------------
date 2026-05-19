(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     V87 — Bill Draft (พักบิล) v3 — Standalone
     ─ snapshot ขนาดเล็ก (เฉพาะ field จำเป็น)
     ─ Resume + Cancel via RPC (sk_resume_bill_draft / sk_cancel_bill_draft)
     ─ Badge + Popover + ปุ่ม "พักบิล" ใน checkout footer
     ─ Auto-cleanup expired drafts ตอน boot
     ─ ไม่พึ่ง SK_FUEL อีกแล้ว (inline helpers)
  ───────────────────────────────────────────────────────────── */

  /* ── inline helpers (ไม่พึ่ง SK_FUEL) ── */
  const num = v => { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; };
  const fmt = v => {
    try { return typeof formatNum === 'function' ? formatNum(v) : num(v).toLocaleString('th-TH'); }
    catch (_) { return num(v).toLocaleString('th-TH'); }
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = v => String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const staff = () => {
    try { return USER?.username || localStorage.getItem('current_staff_name') || 'system'; }
    catch (_) { return 'system'; }
  };
  const thDate = v => {
    if (!v) return '-';
    try { return new Date(v).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return String(v); }
  };

  function activeCart() {
    try { if (Array.isArray(cart)) return cart; } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }
  function stateSnapshot() {
    try { if (typeof v12State !== 'undefined') return v12State || {}; } catch (_) {}
    return window.v12State || {};
  }
  function draftId() {
    return 'DRAFT-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  function compactCart(items) {
    return (items || []).map(it => ({
      id: it.id,
      name: it.name,
      qty: Number(it.qty) || 0,
      price: Number(it.price) || 0,
      cost: Number(it.cost) || 0,
      unit: it.unit || null,
      barcode: it.barcode || null,
      is_extra_charge: !!it.is_extra_charge,
    }));
  }

  function compactState(state) {
    if (!state) return {};
    return {
      step: state.step ?? 1,
      method: state.method ?? null,
      paymentType: state.paymentType ?? null,
      depositAmount: state.depositAmount ?? 0,
      discount: state.discount ?? 0,
      total: state.total ?? 0,
      customer: state.customer ? {
        id: state.customer.id || null,
        name: state.customer.name || '',
        phone: state.customer.phone || '',
        address: state.customer.address || '',
        type: state.customer.type || 'general',
      } : null,
      delivery: state.delivery || null,
      deliveryMode: state.deliveryMode || null,
      deliveryDate: state.deliveryDate || null,
      deliveryAddress: state.deliveryAddress || null,
      deliveryPhone: state.deliveryPhone || null,
    };
  }

  window.v87HoldCurrentBill = async function (tokenId = null, pinMode = null) {
    const items = activeCart();
    if (!items.length) return toast?.('ยังไม่มีสินค้าในตะกร้า', 'warning');
    const compactItems = compactCart(items);
    const total = compactItems.reduce((s, it) => s + it.price * it.qty, 0);
    const row = {
      id: draftId(),
      token_id: tokenId,
      staff_name: staff(),
      cart_snapshot: compactItems,
      checkout_state: compactState(stateSnapshot()),
      subtotal: total,
      total,
      item_count: compactItems.reduce((s, it) => s + it.qty, 0),
      pin_mode: pinMode,
      status: tokenId ? 'waiting' : 'ready',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const { error } = await db.from('bill_draft').insert(row);
    if (error) return toast?.('พักบิลไม่สำเร็จ: ' + error.message, 'error');
    try {
      if (Array.isArray(cart)) cart.length = 0;
      if (Array.isArray(window.cart)) window.cart.length = 0;
      renderCart?.();
      renderProductGrid?.();
      try { typeof closeCheckout === 'function' && closeCheckout(); } catch (_) {}
    } catch (_) {}
    toast?.(`พักบิล ${row.id} แล้ว — ดูที่ปุ่ม "บิลพัก" ด้านบน`, 'success');
    window.v87RefreshDraftBadge?.();
    return row;
  };

  /* ── ปุ่ม "พักบิล" บน checkout modal ── */
  function ensureCheckoutPauseButton() {
    // หาก footer ของ checkout shell — มีหลายเวอร์ชัน รองรับทั้ง v12 และ v36
    const footers = [
      document.querySelector('.v12-right-footer'),
      document.querySelector('.checkout-footer'),
    ].filter(Boolean);
    footers.forEach(footer => {
      if (footer.querySelector('#v87-pause-btn')) return;
      const items = activeCart();
      if (!items.length) return; // ไม่มีในตะกร้า ไม่ต้องโชว์
      const btn = document.createElement('button');
      btn.id = 'v87-pause-btn';
      btn.type = 'button';
      btn.style.cssText = 'background:#fff;color:#92400e;border:1.5px solid #fcd34d;border-radius:11px;padding:0 14px;height:46px;font-family:inherit;font-weight:900;font-size:13.5px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(245,158,11,.15);transition:all .15s';
      btn.onmouseenter = () => { btn.style.background = '#fffbeb'; btn.style.transform = 'translateY(-1px)'; };
      btn.onmouseleave = () => { btn.style.background = '#fff'; btn.style.transform = ''; };
      btn.innerHTML = '<i class="material-icons-round" style="font-size:18px">pause_circle</i> พักบิล';
      btn.onclick = () => window.v87HoldCurrentBill();
      // แทรกหลัง close button (ซ้ายสุด) หรือต้นที่สุดของ footer
      const closeBtn = footer.querySelector('.v12-btn-close, #checkout-cancel');
      if (closeBtn?.nextSibling) footer.insertBefore(btn, closeBtn.nextSibling);
      else footer.appendChild(btn);
    });
  }

  window.v87RefreshDraftBadge = async function () {
    if (typeof db === 'undefined') return;
    let host = document.getElementById('v87-draft-badge');
    const header = document.querySelector('.header-actions');
    if (!host && header) {
      host = document.createElement('button');
      host.id = 'v87-draft-badge';
      host.type = 'button';
      host.style.cssText = 'border:1px solid #cbd5e1;background:#fff;color:#334155;height:38px;padding:0 12px;border-radius:8px;font-family:inherit;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:6px';
      host.onclick = window.v87OpenDraftList;
      header.prepend(host);
    }
    if (!host) return;
    try {
      const { data, error } = await db.from('bill_draft')
        .select('id,status')
        .eq('staff_name', staff())
        .in('status', ['waiting', 'ready'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) { host.style.display = 'none'; return; }
      const ready = rows.filter(r => r.status === 'ready').length;
      host.style.display = 'inline-flex';
      const isReady = ready > 0;
      host.style.background = isReady ? '#dcfce7' : '#fef3c7';
      host.style.color = isReady ? '#166534' : '#92400e';
      host.style.borderColor = isReady ? '#86efac' : '#fcd34d';
      host.innerHTML = `<i class="material-icons-round">${isReady ? 'check_circle' : 'pause_circle'}</i>${isReady ? `พร้อมต่อ: ${ready}` : `บิลพัก: ${rows.length}`}`;
    } catch (_) {
      if (host) host.style.display = 'none';
    }
  };

  window.v87OpenDraftList = async function () {
    const { data, error } = await db.from('bill_draft')
      .select('*')
      .eq('staff_name', staff())
      .in('status', ['waiting', 'ready'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return toast?.('โหลดบิลพักไม่สำเร็จ: ' + error.message, 'error');
    const rows = data || [];
    const html = rows.length ? `<div style="display:grid;gap:10px;text-align:left;max-height:60vh;overflow:auto">${rows.map(r => {
      const ready = r.status === 'ready';
      return `<div style="border:1.5px solid ${ready ? '#86efac' : '#cbd5e1'};border-radius:12px;padding:12px;background:${ready ? '#f0fdf4' : '#fff'}">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <b style="font-size:14px">${esc(r.id)}</b>
          <span style="font-size:11px;font-weight:900;padding:3px 9px;border-radius:999px;background:${ready ? '#10b981' : '#f59e0b'};color:#fff">${ready ? '✅ พร้อมต่อ' : '⏳ รอลูกค้า'}</span>
          ${r.pin_mode ? `<span style="font-size:10.5px;font-weight:900;padding:3px 8px;border-radius:999px;background:#e2e8f0;color:#475569">${esc(r.pin_mode)}</span>` : ''}
        </div>
        <div style="color:#475569;font-weight:800;font-size:13px;margin-bottom:8px">฿${fmt(r.total)} · ${fmt(r.item_count)} ชิ้น · ${thDate(r.created_at)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="swal2-confirm swal2-styled" style="font-size:13px;padding:7px 14px;background:${ready ? '#16a34a' : '#94a3b8'}" onclick="v87ResumeBillDraft('${js(r.id)}')"><i class="material-icons-round" style="font-size:16px">play_arrow</i> ต่อบิล</button>
          <button type="button" class="swal2-cancel swal2-styled" style="font-size:13px;padding:7px 14px;background:#ef4444;color:#fff" onclick="v87CancelBillDraft('${js(r.id)}')"><i class="material-icons-round" style="font-size:16px">close</i> ยกเลิก</button>
        </div>
      </div>`;
    }).join('')}</div>` : '<div style="color:#64748b;font-weight:800;padding:24px;text-align:center"><i class="material-icons-round" style="font-size:36px;color:#cbd5e1;display:block;margin-bottom:6px">inbox</i>ไม่มีบิลพักอยู่</div>';
    Swal.fire({ title: '⏸️ บิลที่พักไว้', html, showConfirmButton: false, showCloseButton: true, width: 560 });
  };

  window.v87ResumeBillDraft = async function (id) {
    Swal.close();
    if (Array.isArray(cart) && cart.length) {
      const ok = await Swal.fire({
        title: 'ตะกร้าปัจจุบันจะถูกล้าง',
        text: 'มีสินค้าในตะกร้าอยู่ การต่อบิลพักจะแทนที่ของในตะกร้า ดำเนินการต่อ?',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'ต่อบิล', cancelButtonText: 'ยกเลิก',
      });
      if (!ok.isConfirmed) return;
    }
    const { data, error } = await db.rpc('sk_resume_bill_draft', { p_draft_id: id, p_staff: staff() });
    if (error) return toast?.('ต่อบิลไม่สำเร็จ: ' + error.message, 'error');
    try {
      const restored = Array.isArray(data?.cart) ? data.cart : [];
      if (Array.isArray(cart)) { cart.length = 0; restored.forEach(it => cart.push(it)); }
      else { window.cart = restored.slice(); }
      const cs = data?.checkout_state || {};
      try {
        if (typeof v12State !== 'undefined' && cs) Object.assign(v12State, cs);
        else if (window.v12State) Object.assign(window.v12State, cs);
      } catch (_) {}
      renderCart?.();
      renderProductGrid?.();
      toast?.(`ต่อบิล ${id} แล้ว — สินค้าและข้อมูลครบ`, 'success');
      try {
        if (typeof openCheckout === 'function') openCheckout();
        else if (typeof v12OpenCheckout === 'function') v12OpenCheckout();
      } catch (_) {}
    } catch (e) {
      console.warn('[v87] resume restore failed:', e);
      toast?.('Restore สำเร็จ แต่ render ล้มเหลว — ดูใน Console', 'warning');
    }
    window.v87RefreshDraftBadge?.();
  };

  window.v87CancelBillDraft = async function (id) {
    const ok = await Swal.fire({
      title: `ยกเลิกบิลพัก ${id}?`,
      text: 'การยกเลิกจะลบบิลพักนี้ทิ้ง ไม่สามารถกู้คืนได้',
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'ยกเลิกทิ้ง', cancelButtonText: 'ไม่',
      confirmButtonColor: '#dc2626',
    });
    if (!ok.isConfirmed) return;
    const { error } = await db.rpc('sk_cancel_bill_draft', { p_draft_id: id, p_staff: staff() });
    if (error) return toast?.('ยกเลิกบิลพักไม่สำเร็จ: ' + error.message, 'error');
    toast?.('ยกเลิกบิลพักแล้ว', 'success');
    Swal.close();
    window.v87RefreshDraftBadge?.();
    window.v87OpenDraftList?.();
  };

  /* ── Boot: cleanup expired + refresh badge + observe checkout for pause button ── */
  function boot() {
    window.v87RefreshDraftBadge?.();
    try { db.rpc('sk_cleanup_expired_drafts'); } catch (_) {}
    // Observe เพื่อ inject ปุ่มพักบิลเมื่อ checkout เปิด
    new MutationObserver(() => ensureCheckoutPauseButton())
      .observe(document.body, { childList: true, subtree: true });
    ensureCheckoutPauseButton();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 1500));
  } else {
    setTimeout(boot, 1500);
  }
  setInterval(() => window.v87RefreshDraftBadge?.(), 30000);

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('sk-pos-sync');
      bc.addEventListener('message', e => {
        if (e?.data?.kind === 'bills' || e?.data?.kind === 'pin') {
          window.v87RefreshDraftBadge?.();
        }
      });
    }
  } catch (_) {}

  console.log('[v87] bill draft hold v3 (standalone) loaded');
})();
