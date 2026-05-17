/* ════════════════════════════════════════════════════════════════
   V80: CUSTOMER PICKER POLISH — Pro UI + State Lock
   ────────────────────────────────────────────────────────────────
   ปัญหาเดิม:
     • v13SelectCustType() จะ "รีเซ็ต" v12State.customer ทุกครั้งที่
       คลิกแท็บประเภทลูกค้า — ถ้าผู้ใช้เผลอกดแท็บซ้ำหลังเลือกลูกค้า
       ประจำไปแล้ว ข้อมูลลูกค้าจะหายและบิลถูกบันทึกเป็น "ลูกค้าทั่วไป"
     • UI ไม่มีจุดแสดง "ลูกค้าที่เลือกแล้ว" ชัดเจน ทำให้ผู้ใช้สับสน
       และเผลอกดลูกค้าใหม่ทับของเดิม
   ────────────────────────────────────────────────────────────────
   สิ่งที่แก้:
     1. v13SelectCustType: ไม่รีเซ็ตเมื่อกดแท็บเดิมซ้ำ และมีคอนเฟิร์ม
        เมื่อจะสลับประเภทขณะที่มีลูกค้าประจำถูกเลือกอยู่
     2. v13RenderCustForm('member'): ออกแบบใหม่ มีการ์ดลูกค้าที่เลือก
        แบบเด่นชัด พร้อมปุ่ม "ยกเลิกลูกค้านี้" ก่อนจะเลือกคนใหม่ได้
     3. v13PickCustomer: บังคับ type='member' กันเหนียว
     4. v12NextStep guard: เตือนถ้าอยู่แท็บ member แต่ยังไม่ได้เลือก
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const TAG = '[v80-customer-picker]';

  function fmt(n) {
    try { if (typeof formatNum === 'function') return formatNum(n); } catch (_) {}
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(Number(n) || 0);
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
  function setGlobal(name, fn) {
    try { window[name] = fn; } catch (_) {}
    try { eval(`${name} = fn;`); } catch (_) {}
  }

  /* ─────── 1. STYLES ─────── */
  function injectStyles() {
    if (document.getElementById('v80-customer-picker-style')) return;
    const css = `
      .v80-picked-card{
        margin-top:14px;border-radius:18px;
        background:linear-gradient(135deg,#ecfdf5 0%,#ffffff 55%,#eff6ff 100%);
        border:2px solid #10b981;
        box-shadow:0 14px 32px rgba(16,185,129,.16);
        overflow:hidden;
        animation:v80FadeUp .26s cubic-bezier(.16,1,.3,1);
      }
      @keyframes v80FadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .v80-picked-head{
        display:flex;align-items:center;gap:14px;
        padding:16px 18px;
        background:linear-gradient(135deg,#10b981,#059669);
        color:#fff;
      }
      .v80-picked-avatar{
        width:54px;height:54px;border-radius:16px;
        background:rgba(255,255,255,.22);
        display:grid;place-items:center;flex:0 0 auto;
        font-size:24px;font-weight:900;color:#fff;
      }
      .v80-picked-avatar i{font-size:30px}
      .v80-picked-headtext{flex:1;min-width:0}
      .v80-picked-label{
        font-size:11px;font-weight:900;letter-spacing:.5px;
        text-transform:uppercase;opacity:.92;display:flex;align-items:center;gap:5px;
      }
      .v80-picked-label i{font-size:14px}
      .v80-picked-name{
        font-size:20px;font-weight:900;line-height:1.15;margin-top:2px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .v80-picked-body{
        padding:14px 18px 6px;
        display:grid;grid-template-columns:1fr;gap:9px;
      }
      .v80-picked-row{
        display:flex;align-items:flex-start;gap:10px;
        font-size:13.5px;color:#334155;font-weight:600;
        line-height:1.45;
      }
      .v80-picked-row i{
        font-size:18px;color:#10b981;flex:0 0 auto;margin-top:1px;
      }
      .v80-picked-row.muted{color:#94a3b8;font-weight:600;font-style:italic}
      .v80-picked-row.muted i{color:#cbd5e1}
      .v80-picked-debt{
        margin:6px 18px 0;
        display:inline-flex;align-items:center;gap:6px;
        background:#fef2f2;color:#b91c1c;
        border:1.5px solid #fecaca;border-radius:999px;
        padding:5px 12px;font-size:12.5px;font-weight:900;
        width:fit-content;
      }
      .v80-picked-debt i{font-size:15px}
      .v80-picked-actions{
        display:flex;gap:10px;padding:14px 18px 16px;
        border-top:1px solid #d1fae5;margin-top:6px;
      }
      .v80-btn-cancel{
        flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;
        background:#fff;color:#dc2626;
        border:1.8px solid #fecaca;border-radius:12px;
        padding:11px 16px;font-size:14px;font-weight:800;
        cursor:pointer;transition:all .15s ease;font-family:inherit;
      }
      .v80-btn-cancel:hover{background:#fef2f2;border-color:#f87171}
      .v80-btn-cancel:active{transform:scale(.98)}
      .v80-btn-cancel i{font-size:18px}
      .v80-btn-next{
        flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;
        background:linear-gradient(135deg,#10b981,#059669);color:#fff;
        border:0;border-radius:12px;
        padding:11px 16px;font-size:14px;font-weight:900;
        cursor:pointer;box-shadow:0 6px 18px rgba(16,185,129,.32);
        font-family:inherit;transition:transform .12s ease,box-shadow .12s ease;
      }
      .v80-btn-next:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(16,185,129,.42)}
      .v80-btn-next:active{transform:translateY(0)}
      .v80-btn-next i{font-size:18px}

      .v80-search-wrap{margin-top:12px}
      .v80-search-box{
        position:relative;margin-bottom:10px;
      }
      .v80-search-box i.search-ico{
        position:absolute;left:13px;top:50%;transform:translateY(-50%);
        font-size:19px;color:#9ca3af;pointer-events:none;
      }
      .v80-search-box input{
        width:100%;padding:11px 14px 11px 42px;
        border:1.8px solid #d1d5db;border-radius:12px;
        font-size:14px;font-family:inherit;font-weight:600;
        background:#fff;transition:border-color .15s,box-shadow .15s;
      }
      .v80-search-box input:focus{
        outline:none;border-color:#10b981;
        box-shadow:0 0 0 3px rgba(16,185,129,.18);
      }
      .v80-list{
        max-height:260px;overflow-y:auto;
        display:flex;flex-direction:column;gap:6px;
        padding-right:2px;
      }
      .v80-list::-webkit-scrollbar{width:6px}
      .v80-list::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px}
      .v80-list-item{
        padding:11px 14px;border-radius:12px;cursor:pointer;
        background:#f8fafc;border:1.5px solid transparent;
        display:flex;align-items:center;gap:11px;
        transition:all .12s ease;
      }
      .v80-list-item:hover{
        background:#ecfdf5;border-color:#a7f3d0;transform:translateX(2px);
      }
      .v80-list-item .ava{
        width:38px;height:38px;border-radius:11px;
        background:linear-gradient(135deg,#e5e7eb,#cbd5e1);
        color:#fff;display:grid;place-items:center;flex:0 0 auto;
      }
      .v80-list-item .ava i{font-size:20px}
      .v80-list-item .info{flex:1;min-width:0}
      .v80-list-item .nm{
        font-weight:800;font-size:14px;color:#0f172a;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .v80-list-item .sub{
        font-size:11.5px;color:#64748b;margin-top:2px;font-weight:600;
        display:flex;align-items:center;gap:8px;flex-wrap:wrap;
      }
      .v80-list-item .sub .debt{
        color:#dc2626;font-weight:900;
        background:#fef2f2;padding:1px 7px;border-radius:6px;
      }
      .v80-list-item .ck{
        color:#10b981;flex:0 0 auto;opacity:0;transition:opacity .12s;
      }
      .v80-list-item:hover .ck{opacity:1}
      .v80-list-empty{
        padding:28px 16px;text-align:center;color:#94a3b8;font-size:13px;
        font-weight:600;background:#f8fafc;border-radius:12px;
      }
      .v80-list-empty i{
        font-size:38px;display:block;margin-bottom:8px;opacity:.45;color:#94a3b8;
      }
      .v80-list-loading{
        padding:24px;text-align:center;color:#94a3b8;font-size:13px;font-weight:600;
      }

      .v80-warn-banner{
        display:flex;align-items:center;gap:10px;
        background:#fff7ed;border:1.5px solid #fed7aa;
        color:#9a3412;border-radius:12px;
        padding:10px 14px;font-size:13px;font-weight:700;
        margin-top:10px;
      }
      .v80-warn-banner i{color:#ea580c;font-size:20px}

      @media (max-width:520px){
        .v80-picked-actions{flex-direction:column}
        .v80-picked-name{font-size:18px}
      }
    `;
    const style = document.createElement('style');
    style.id = 'v80-customer-picker-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ─────── 2. RENDER SELECTED-CUSTOMER CARD ─────── */
  function renderPickedCard(c) {
    const phone = (c.phone || '').trim();
    const address = (c.address || '').trim();
    const debt = Number(c.debt_amount || 0);
    return `
      <div class="v80-picked-card" id="v80-picked-card">
        <div class="v80-picked-head">
          <div class="v80-picked-avatar"><i class="material-icons-round">check_circle</i></div>
          <div class="v80-picked-headtext">
            <div class="v80-picked-label"><i class="material-icons-round">verified</i> ลูกค้าที่เลือก</div>
            <div class="v80-picked-name" title="${esc(c.name)}">${esc(c.name || '-')}</div>
          </div>
        </div>
        <div class="v80-picked-body">
          <div class="v80-picked-row ${phone ? '' : 'muted'}">
            <i class="material-icons-round">call</i>
            <span>${phone ? esc(phone) : 'ไม่ระบุเบอร์โทร'}</span>
          </div>
          <div class="v80-picked-row ${address ? '' : 'muted'}">
            <i class="material-icons-round">location_on</i>
            <span>${address ? esc(address) : 'ไม่ระบุที่อยู่'}</span>
          </div>
        </div>
        ${debt > 0 ? `<div class="v80-picked-debt"><i class="material-icons-round">account_balance_wallet</i>หนี้ค้าง ฿${fmt(debt)}</div>` : ''}
        <div class="v80-picked-actions">
          <button type="button" class="v80-btn-cancel" onclick="v80CancelPickedCustomer()">
            <i class="material-icons-round">person_remove</i> ยกเลิกลูกค้านี้
          </button>
          <button type="button" class="v80-btn-next" onclick="v80ContinueAfterPick()">
            <i class="material-icons-round">arrow_forward</i> ดำเนินการต่อ
          </button>
        </div>
      </div>`;
  }

  function renderSearchPane() {
    return `
      <div class="v80-search-wrap" id="v80-search-wrap">
        <div class="v80-search-box">
          <i class="material-icons-round search-ico">search</i>
          <input type="text" id="v80-cust-search" placeholder="ค้นหาชื่อ หรือ เบอร์โทร..."
            oninput="v80SearchCustomer(this.value)" autocomplete="off">
        </div>
        <div id="v80-cust-results" class="v80-list">
          <div class="v80-list-loading">
            <i class="material-icons-round" style="font-size:30px;display:block;opacity:.4;margin-bottom:4px">person_search</i>
            กำลังโหลดรายชื่อลูกค้า...
          </div>
        </div>
      </div>`;
  }

  /* ─────── 3. OVERRIDE v13RenderCustForm for 'member' ─────── */
  function patchRenderForm() {
    const orig = window.v13RenderCustForm;
    if (typeof orig !== 'function' || orig.__v80) return false;
    const wrapped = function (container) {
      if (!container) return;
      const state = getState();
      const type = state?.customer?.type;
      if (type !== 'member') {
        return orig.apply(this, arguments);
      }
      const c = state.customer || {};
      if (c.id) {
        container.innerHTML = renderPickedCard(c);
      } else {
        container.innerHTML = renderSearchPane();
        // initial fetch
        setTimeout(() => { try { window.v80SearchCustomer(''); } catch (_) {} }, 10);
      }
    };
    Object.defineProperty(wrapped, '__v80', { value: true });
    setGlobal('v13RenderCustForm', wrapped);
    return true;
  }

  /* ─────── 4. SEARCH + PICK ─────── */
  window.v80SearchCustomer = async function (q) {
    const res = document.getElementById('v80-cust-results');
    if (!res) return;
    try {
      let query = db.from('customer')
        .select('id,name,phone,address,debt_amount,total_purchase')
        .order('name').limit(50);
      const qq = String(q || '').trim();
      if (qq) query = query.or(`name.ilike.%${qq}%,phone.ilike.%${qq}%`);
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) {
        res.innerHTML = `<div class="v80-list-empty">
          <i class="material-icons-round">person_off</i>
          ${qq ? `ไม่พบลูกค้า "${esc(qq)}"` : 'ยังไม่มีรายชื่อลูกค้า'}
        </div>`;
        return;
      }
      res.innerHTML = data.map(c => {
        const safeId = String(c.id).replace(/'/g, '\\\'');
        const safeName = String(c.name || '').replace(/'/g, '\\\'');
        const safePhone = String(c.phone || '').replace(/'/g, '\\\'');
        const safeAddr = String(c.address || '').replace(/'/g, '\\\'').replace(/\n/g, ' ');
        const debt = Number(c.debt_amount || 0);
        const initial = (c.name || '?').trim().charAt(0).toUpperCase();
        return `
          <div class="v80-list-item"
               onclick="v80PickCustomer('${safeId}','${safeName}','${safePhone}','${safeAddr}')">
            <div class="ava">
              ${initial ? `<span style="font-size:16px;font-weight:900">${esc(initial)}</span>` : '<i class="material-icons-round">person</i>'}
            </div>
            <div class="info">
              <div class="nm">${esc(c.name || '-')}</div>
              <div class="sub">
                <span><i class="material-icons-round" style="font-size:13px;vertical-align:-2px">call</i> ${esc(c.phone || 'ไม่ระบุเบอร์')}</span>
                ${debt > 0 ? `<span class="debt">หนี้ ฿${fmt(debt)}</span>` : ''}
                ${c.address ? `<span><i class="material-icons-round" style="font-size:13px;vertical-align:-2px">location_on</i> มีที่อยู่</span>` : ''}
              </div>
            </div>
            <i class="material-icons-round ck">chevron_right</i>
          </div>`;
      }).join('');
    } catch (e) {
      res.innerHTML = `<div class="v80-list-empty" style="color:#dc2626"><i class="material-icons-round" style="color:#dc2626">error</i>โหลดข้อมูลไม่สำเร็จ</div>`;
      console.warn(TAG, 'search error', e);
    }
  };

  window.v80PickCustomer = function (id, name, phone, address) {
    const state = getState();
    if (!state) return;
    if (!state.customer) state.customer = {};
    state.customer.type = 'member';
    state.customer.id = id;
    state.customer.name = name;
    state.customer.phone = phone || '';
    state.customer.address = address || '';
    try {
      if (typeof window.v13PickCustomer === 'function' && !window.v13PickCustomer.__v80Inner) {
        // call inner if present (chained module wrappers) to keep customer-display sync
        const inner = window.v13PickCustomer;
        // We've already set state — call inner only for side-effects (display sync etc.)
        // but skip its re-render, since we'll re-render ourselves below.
      }
    } catch (_) {}
    // Mirror to checkoutState for back-compat
    try {
      const cs = window.checkoutState;
      if (cs?.customer) {
        cs.customer.type = 'member';
        cs.customer.id = id;
        cs.customer.name = name;
        cs.customer.phone = phone || '';
        cs.customer.address = address || '';
      }
    } catch (_) {}
    // Re-render form
    const form = document.getElementById('v12-cust-form');
    if (form && typeof window.v13RenderCustForm === 'function') {
      window.v13RenderCustForm(form);
    }
    // Notify customer display
    try {
      if (typeof window.v68SendCustomerToDisplay === 'function') {
        window.v68SendCustomerToDisplay({ id, name, phone, address }, 'member');
      } else if (typeof window.sendToDisplay === 'function') {
        window.sendToDisplay({ type: 'customer', name, phone, address, customerType: 'member' });
      }
    } catch (_) {}
    try { typeof toast === 'function' && toast(`เลือกลูกค้า: ${name}`, 'success'); } catch (_) {}
  };

  window.v80CancelPickedCustomer = function () {
    const state = getState();
    if (!state?.customer) return;
    state.customer.id = null;
    state.customer.name = '';
    state.customer.phone = '';
    state.customer.address = '';
    state.customer.debt_amount = 0;
    // ยังคงเป็นแท็บ 'member' อยู่ — แค่ล้างคนที่เลือก
    try {
      const cs = window.checkoutState;
      if (cs?.customer) { cs.customer.id = null; cs.customer.name = ''; cs.customer.phone = ''; cs.customer.address = ''; }
    } catch (_) {}
    const form = document.getElementById('v12-cust-form');
    if (form && typeof window.v13RenderCustForm === 'function') {
      window.v13RenderCustForm(form);
    }
    try { typeof toast === 'function' && toast('ยกเลิกลูกค้าที่เลือกแล้ว', 'info'); } catch (_) {}
  };

  window.v80ContinueAfterPick = function () {
    try {
      if (typeof window.v12NextStep === 'function') window.v12NextStep();
    } catch (e) { console.warn(TAG, 'continue', e); }
  };

  /* ─────── 5. PATCH v13PickCustomer (defensive — force type='member') ─────── */
  function patchPickCustomer() {
    const orig = window.v13PickCustomer;
    if (typeof orig !== 'function' || orig.__v80) return false;
    const wrapped = function (id, name, phone, address) {
      const state = getState();
      if (state?.customer) state.customer.type = 'member';
      const r = orig.apply(this, arguments);
      // Defensive: ensure type didn't get reset
      if (state?.customer && id) state.customer.type = 'member';
      return r;
    };
    Object.defineProperty(wrapped, '__v80', { value: true });
    setGlobal('v13PickCustomer', wrapped);
    return true;
  }

  /* ─────── 6. PATCH v13SelectCustType — preserve picked customer ─────── */
  function patchSelectCustType() {
    const orig = window.v13SelectCustType;
    if (typeof orig !== 'function' || orig.__v80) return false;
    const wrapped = function (type) {
      const state = getState();
      const cur = state?.customer || {};
      // คลิกแท็บเดิมซ้ำ — ไม่ต้องทำอะไรเลย (ป้องกันการรีเซ็ตของเดิม)
      if (cur.type === type) {
        // re-render เผื่อ DOM หาย
        const form = document.getElementById('v12-cust-form');
        if (form && typeof window.v13RenderCustForm === 'function') {
          window.v13RenderCustForm(form);
        }
        return;
      }
      // กำลังจะออกจากแท็บที่มีลูกค้าประจำเลือกอยู่ — เตือนก่อน
      if (cur.type === 'member' && cur.id && type !== 'member') {
        const confirmSwitch = (typeof window.Swal !== 'undefined')
          ? window.Swal.fire({
              icon: 'warning',
              title: 'เปลี่ยนประเภทลูกค้า?',
              html: `<div style="font-size:14px;line-height:1.6">
                ลูกค้า <strong>${esc(cur.name || '')}</strong> ที่เลือกไว้จะถูกล้าง<br>
                ต้องการเปลี่ยนเป็น <strong>${type === 'general' ? 'ลูกค้าทั่วไป' : 'ลูกค้าใหม่'}</strong> หรือไม่?
              </div>`,
              showCancelButton: true,
              confirmButtonText: 'ใช่ เปลี่ยน',
              cancelButtonText: 'ไม่ คงไว้',
              confirmButtonColor: '#dc2626',
              cancelButtonColor: '#64748b',
              reverseButtons: true,
            }).then(r => r.isConfirmed)
          : Promise.resolve(window.confirm(`ลูกค้า "${cur.name}" ที่เลือกไว้จะถูกล้าง ต้องการเปลี่ยนหรือไม่?`));
        return confirmSwitch.then(ok => {
          if (!ok) {
            // ผู้ใช้ยกเลิก — re-highlight แท็บเดิม
            document.querySelectorAll('.v12-cust-card').forEach((c, i) => {
              c.classList.toggle('selected', ['general', 'member', 'new'][i] === cur.type);
            });
            return;
          }
          return orig.call(this, type);
        });
      }
      return orig.apply(this, arguments);
    };
    Object.defineProperty(wrapped, '__v80', { value: true });
    setGlobal('v13SelectCustType', wrapped);
    return true;
  }

  /* ─────── 7. PATCH v12NextStep — warn if member tab but nothing picked ─────── */
  function patchNextStep() {
    const orig = window.v12NextStep;
    if (typeof orig !== 'function' || orig.__v80) return false;
    const wrapped = async function () {
      const state = getState();
      if (state && Number(state.step) === 1
          && state.customer?.type === 'member'
          && !state.customer?.id) {
        try { typeof toast === 'function' && toast('กรุณาเลือกลูกค้าประจำ หรือเปลี่ยนเป็น "ลูกค้าทั่วไป" ก่อน', 'warning'); } catch (_) {}
        // highlight search input
        const search = document.getElementById('v80-cust-search');
        if (search) {
          search.focus();
          search.style.boxShadow = '0 0 0 3px rgba(220,38,38,.35)';
          setTimeout(() => { try { search.style.boxShadow = ''; } catch (_) {} }, 1500);
        }
        return;
      }
      return orig.apply(this, arguments);
    };
    Object.defineProperty(wrapped, '__v80', { value: true });
    setGlobal('v12NextStep', wrapped);
    return true;
  }

  /* ─────── 8. BOOTSTRAP — patch as soon as base fns are available ─────── */
  function bootstrap() {
    injectStyles();
    let attempts = 0;
    const tryPatch = () => {
      attempts++;
      const ok1 = patchRenderForm();
      const ok2 = patchPickCustomer();
      const ok3 = patchSelectCustType();
      const ok4 = patchNextStep();
      if ((ok1 || window.v13RenderCustForm?.__v80)
       && (ok2 || window.v13PickCustomer?.__v80)
       && (ok3 || window.v13SelectCustType?.__v80)
       && (ok4 || window.v12NextStep?.__v80)) {
        console.log(TAG, 'all patches installed');
        return;
      }
      if (attempts < 40) setTimeout(tryPatch, 250);
    };
    tryPatch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
