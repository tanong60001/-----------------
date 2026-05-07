/* ==========================================================================
   SK POS V53 — Admin PIN Modal Fix + Polished UI
   ไฟล์โมดูลแยกสำหรับแก้ปัญหา “แก้ PIN — admin” กรอกไม่ได้บน iPhone/iPad/SUNMI
   วิธีใช้: วางไฟล์นี้ไว้ในโปรเจกต์ แล้วเรียกหลัง modules-v52 ใน index.html
   <script src="modules-v53-admin-pin-fix.js"></script>
   ========================================================================== */
(function () {
  'use strict';

  const MOD = '[v53-admin-pin-fix]';
  const STYLE_ID = 'v53-admin-pin-fix-style';

  function isPinText(value) {
    return /pin|พิน|รหัส/i.test(String(value || ''));
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .swal2-popup.v53-pin-popup {
        width: min(430px, calc(100vw - 28px)) !important;
        border-radius: 26px !important;
        padding: 26px 24px 22px !important;
        font-family: var(--font-thai, 'Prompt', system-ui, sans-serif) !important;
        box-shadow: 0 28px 80px rgba(15, 23, 42, .25) !important;
      }

      .swal2-popup.v53-pin-popup .swal2-title {
        font-size: 24px !important;
        font-weight: 950 !important;
        color: #0f172a !important;
        line-height: 1.25 !important;
        margin: 6px 0 6px !important;
      }

      .swal2-popup.v53-pin-popup .swal2-html-container {
        margin: 6px 0 16px !important;
        color: #64748b !important;
        font-size: 13px !important;
        font-weight: 700 !important;
      }

      .v53-pin-wrap {
        width: 100%;
        margin: 8px auto 8px;
        display: grid;
        gap: 14px;
      }

      .v53-pin-input {
        width: min(260px, 100%);
        height: 74px;
        margin: 0 auto;
        border: 2px solid #e2e8f0;
        border-radius: 18px;
        background: linear-gradient(180deg, #ffffff, #f8fafc);
        color: #0f172a;
        font-size: 34px;
        font-weight: 950;
        text-align: center;
        letter-spacing: 12px;
        padding-left: 12px;
        outline: none;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
        -webkit-text-security: disc;
      }

      .v53-pin-input:focus {
        border-color: #dc2626;
        box-shadow: 0 0 0 5px rgba(220, 38, 38, .12);
        background: #fff;
      }

      .v53-pin-hint {
        text-align: center;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 800;
      }

      .v53-pin-keypad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        width: min(310px, 100%);
        margin: 0 auto;
      }

      .v53-pin-key {
        height: 54px;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        background: #f8fafc;
        color: #0f172a;
        font-size: 20px;
        font-weight: 950;
        font-family: inherit;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }

      .v53-pin-key:active {
        transform: translateY(1px);
        background: #fee2e2;
        border-color: #fecaca;
        color: #b91c1c;
      }

      .v53-pin-key.muted {
        color: #64748b;
        font-size: 13px;
      }

      .swal2-popup.v53-pin-popup .swal2-actions {
        gap: 10px !important;
        margin-top: 18px !important;
      }

      .swal2-popup.v53-pin-popup .swal2-confirm,
      .swal2-popup.v53-pin-popup .swal2-cancel {
        min-width: 116px !important;
        height: 48px !important;
        border-radius: 14px !important;
        font-weight: 950 !important;
        font-family: inherit !important;
        box-shadow: none !important;
      }

      .swal2-popup.v53-pin-popup .swal2-confirm {
        background: linear-gradient(135deg, #dc2626, #ef4444) !important;
      }

      .swal2-popup.v53-pin-popup .swal2-cancel {
        background: #64748b !important;
      }

      @media (max-width: 420px) {
        .swal2-popup.v53-pin-popup { padding: 22px 18px 18px !important; }
        .v53-pin-input { height: 68px; font-size: 30px; }
        .v53-pin-key { height: 50px; }
      }
    `;
    document.head.appendChild(style);
  }

  function sanitizePin(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 4);
  }

  function getPinInput() {
    return document.getElementById('v53-admin-pin-input');
  }

  function setPinValue(value) {
    const input = getPinInput();
    if (!input) return;
    input.value = sanitizePin(value);
  }

  function addPinDigit(digit) {
    const input = getPinInput();
    if (!input) return;
    input.value = sanitizePin(input.value + digit);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function backspacePin() {
    const input = getPinInput();
    if (!input) return;
    input.value = sanitizePin(input.value).slice(0, -1);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function pinHtml(defaultPin = '') {
    const safePin = sanitizePin(defaultPin);
    return `
      <div class="v53-pin-wrap">
        <input
          id="v53-admin-pin-input"
          class="v53-pin-input"
          type="tel"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="4"
          value="${safePin}"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          name="sk_admin_pin_${Date.now()}"
          aria-label="Admin PIN"
        />
        <div class="v53-pin-hint">ใส่ตัวเลข 4 หลัก เช่น 1234</div>
        <div class="v53-pin-keypad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" class="v53-pin-key" data-v53-digit="${n}">${n}</button>`).join('')}
          <button type="button" class="v53-pin-key muted" data-v53-clear="1">ล้าง</button>
          <button type="button" class="v53-pin-key" data-v53-digit="0">0</button>
          <button type="button" class="v53-pin-key muted" data-v53-back="1">⌫</button>
        </div>
      </div>
    `;
  }

  function bindPinModalEvents() {
    const input = getPinInput();
    if (!input) return;

    input.addEventListener('input', () => setPinValue(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.querySelector('.swal2-confirm')?.click();
      }
    });

    document.querySelectorAll('[data-v53-digit]').forEach(btn => {
      btn.addEventListener('click', () => addPinDigit(btn.dataset.v53Digit));
    });

    document.querySelector('[data-v53-back]')?.addEventListener('click', backspacePin);
    document.querySelector('[data-v53-clear]')?.addEventListener('click', () => setPinValue(''));

    setTimeout(() => {
      input.focus({ preventScroll: true });
      input.select();
    }, 80);
  }

  async function openPinModal(options = {}) {
    injectStyle();

    const title = options.title || `แก้ PIN${options.username ? ` — ${options.username}` : ''}`;
    const result = await Swal.fire({
      title,
      html: pinHtml(options.currentPin || ''),
      customClass: { popup: 'v53-pin-popup' },
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      focusConfirm: false,
      allowOutsideClick: false,
      didOpen: bindPinModalEvents,
      preConfirm: () => {
        const pin = sanitizePin(getPinInput()?.value);
        if (pin.length !== 4) {
          Swal.showValidationMessage('กรุณากรอก PIN เป็นตัวเลข 4 หลัก');
          return false;
        }
        return pin;
      }
    });

    if (!result.isConfirmed) return null;
    return result.value;
  }

  async function saveUserPin(userId, pin) {
    if (!userId) throw new Error('ไม่พบ user id');
    if (!window.db) throw new Error('ไม่พบตัวแปร db / Supabase client');

    const { error } = await db
      .from('ผู้ใช้งาน')
      .update({ pin: sanitizePin(pin) })
      .eq('id', userId);

    if (error) throw error;
    return true;
  }

  // ฟังก์ชันหลักสำหรับเรียกจากปุ่มเดิม:
  // onclick="skEditUserPin('USER_ID','admin','1234')"
  window.skEditUserPin = async function skEditUserPin(userId, username = '', currentPin = '') {
    try {
      const pin = await openPinModal({ username, currentPin });
      if (!pin) return;

      await saveUserPin(userId, pin);

      if (typeof toast === 'function') toast(`บันทึก PIN ของ ${username || 'ผู้ใช้งาน'} แล้ว`, 'success');
      else await Swal.fire('สำเร็จ', 'บันทึก PIN แล้ว', 'success');

      if (typeof renderAdmin === 'function') setTimeout(() => renderAdmin(), 150);
    } catch (err) {
      console.error(MOD, err);
      const msg = err?.message || 'บันทึก PIN ไม่สำเร็จ';
      if (typeof toast === 'function') toast(msg, 'error');
      else await Swal.fire('ผิดพลาด', msg, 'error');
    }
  };

  // แก้เคสโค้ดเดิมที่ใช้ Swal.fire({ input: 'password' ... title: 'แก้ PIN — admin' })
  // ปัญหาบน iOS มักเกิดจาก browser/password manager เด้งทับ ทำให้พิมพ์ไม่ได้
  function patchSwalFire() {
    if (!window.Swal || typeof Swal.fire !== 'function' || Swal.fire.__v53PinPatched) return;

    const originalFire = Swal.fire.bind(Swal);

    Swal.fire = function patchedSwalFire(...args) {
      const cfg = typeof args[0] === 'object' ? { ...args[0] } : null;

      if (cfg) {
        const titleText = `${cfg.title || ''} ${cfg.text || ''} ${cfg.inputLabel || ''}`;
        const looksLikePinModal = isPinText(titleText) && /admin|ผู้ใช้งาน|พนักงาน|แก้|เปลี่ยน/i.test(titleText);

        if (looksLikePinModal && cfg.input) {
          cfg.input = 'tel';
          cfg.customClass = {
            ...(cfg.customClass || {}),
            popup: `${cfg.customClass?.popup || ''} v53-pin-popup`.trim()
          };
          cfg.inputAttributes = {
            ...(cfg.inputAttributes || {}),
            inputmode: 'numeric',
            pattern: '[0-9]*',
            maxlength: '4',
            autocomplete: 'off',
            autocapitalize: 'off',
            autocorrect: 'off',
            spellcheck: 'false',
            name: `sk_pin_${Date.now()}`
          };

          const oldDidOpen = cfg.didOpen;
          cfg.didOpen = (popup) => {
            oldDidOpen?.(popup);
            const input = popup.querySelector('.swal2-input');
            if (input) {
              input.type = 'tel';
              input.inputMode = 'numeric';
              input.maxLength = 4;
              input.autocomplete = 'off';
              input.name = `sk_pin_${Date.now()}`;
              input.addEventListener('input', () => { input.value = sanitizePin(input.value); });
              setTimeout(() => {
                input.focus({ preventScroll: true });
                input.select();
              }, 100);
            }
          };

          const oldPreConfirm = cfg.preConfirm;
          cfg.preConfirm = async (value) => {
            const pin = sanitizePin(value || document.querySelector('.swal2-input')?.value);
            if (pin.length !== 4) {
              Swal.showValidationMessage('กรุณากรอก PIN เป็นตัวเลข 4 หลัก');
              return false;
            }
            if (oldPreConfirm) return oldPreConfirm(pin);
            return pin;
          };
        }

        return originalFire(cfg);
      }

      return originalFire(...args);
    };

    Swal.fire.__v53PinPatched = true;
    console.log(MOD, 'SweetAlert PIN patch installed');
  }

  function boot() {
    injectStyle();
    patchSwalFire();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  setTimeout(boot, 500);
  setTimeout(boot, 1500);
})();


/* ===== ต่อท้าย V53: V54 USER PASSWORD HOTFIX ===== */

/* ==========================================================================
   SK POS V54 — User Permission Password/PIN Hotfix
   แก้ปัญหาหน้า "แก้ไขรหัสของสิทธิ์ผู้ใช้" กรอกไม่ได้บนมือถือ/iPhone/SUNMI
   ใช้ต่อจาก V53 ได้เลย: <script src="modules-v54-user-password-hotfix.js?v=1"></script>
   ========================================================================== */
(function () {
  'use strict';

  const TAG = '[v54-user-password-hotfix]';
  const STYLE_ID = 'v54-user-password-hotfix-style';

  function css() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .swal2-container, .swal2-popup, .swal2-html-container { pointer-events:auto !important; }
      .swal2-popup input,
      .swal2-popup textarea,
      .swal2-popup select,
      .modal input,
      .modal textarea,
      .modal select {
        pointer-events:auto !important;
        user-select:text !important;
        -webkit-user-select:text !important;
        touch-action:manipulation !important;
        position:relative !important;
        z-index:2147483647 !important;
      }

      .v54-pin-box{
        width:100%;
        display:grid;
        gap:12px;
        margin-top:10px;
      }
      .v54-pin-main{
        width:min(280px,100%) !important;
        height:64px !important;
        margin:0 auto !important;
        border:2px solid #e2e8f0 !important;
        border-radius:18px !important;
        background:#fff !important;
        color:#111827 !important;
        text-align:center !important;
        font-size:30px !important;
        font-weight:950 !important;
        letter-spacing:10px !important;
        outline:none !important;
        padding:0 10px !important;
        box-shadow:0 0 0 0 rgba(220,38,38,0) !important;
        pointer-events:auto !important;
        -webkit-text-security:disc;
      }
      .v54-pin-main:focus{
        border-color:#dc2626 !important;
        box-shadow:0 0 0 5px rgba(220,38,38,.12) !important;
      }
      .v54-pin-hint{
        text-align:center;
        color:#64748b;
        font-size:12px;
        font-weight:800;
      }
      .v54-keypad{
        width:min(310px,100%);
        margin:0 auto;
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:9px;
      }
      .v54-key{
        height:50px;
        border:1px solid #e5e7eb;
        background:#f8fafc;
        border-radius:15px;
        font-size:20px;
        font-weight:950;
        color:#111827;
        font-family:inherit;
        touch-action:manipulation;
        -webkit-tap-highlight-color:transparent;
      }
      .v54-key:active{background:#fee2e2;color:#b91c1c;transform:translateY(1px)}
      .v54-key.muted{font-size:13px;color:#64748b}
      .swal2-popup.v54-popup-fix{
        border-radius:24px !important;
        padding:24px 22px 20px !important;
      }
      .swal2-popup.v54-popup-fix .swal2-title{
        font-size:24px !important;
        font-weight:950 !important;
        color:#111827 !important;
      }
      .swal2-popup.v54-popup-fix .swal2-confirm,
      .swal2-popup.v54-popup-fix .swal2-cancel{
        height:46px !important;
        min-width:110px !important;
        border-radius:14px !important;
        font-weight:950 !important;
      }
    `;
    document.head.appendChild(st);
  }

  function onlyDigits(v, max = 4) {
    return String(v || '').replace(/\D/g, '').slice(0, max);
  }

  function isPinContext(root) {
    if (!root) return false;
    const text = [
      root.querySelector?.('.swal2-title')?.textContent,
      root.querySelector?.('.swal2-html-container')?.textContent,
      root.textContent
    ].filter(Boolean).join(' ');
    return /(pin|พิน|รหัส|password|สิทธิ์|ผู้ใช้|ผู้ใช้งาน|admin|แอดมิน)/i.test(text);
  }

  function fireInputEvents(input) {
    ['input', 'change', 'keyup', 'blur'].forEach(type => {
      try { input.dispatchEvent(new Event(type, { bubbles:true, cancelable:true })); } catch (_) {}
    });
  }

  function makeEditable(input) {
    if (!input) return;
    input.disabled = false;
    input.readOnly = false;
    input.removeAttribute('disabled');
    input.removeAttribute('readonly');
    input.removeAttribute('aria-hidden');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('pattern', '[0-9]*');
    input.setAttribute('maxlength', '4');
    input.type = 'tel';
    input.classList.add('v54-pin-main');
    input.style.pointerEvents = 'auto';
    input.style.zIndex = '2147483647';
    input.style.position = 'relative';

    if (input.dataset.v54Bound !== '1') {
      input.dataset.v54Bound = '1';
      input.addEventListener('input', () => {
        input.value = onlyDigits(input.value, 4);
        input.classList.toggle('filled', !!input.value);
      }, true);
      input.addEventListener('touchstart', () => setTimeout(() => input.focus({ preventScroll:true }), 0), true);
      input.addEventListener('click', () => setTimeout(() => input.focus({ preventScroll:true }), 0), true);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.querySelector('.swal2-confirm')?.click();
        }
      }, true);
    }

    setTimeout(() => {
      try {
        input.focus({ preventScroll:true });
        input.select?.();
      } catch (_) {}
    }, 80);
  }

  function addKeypad(root, input) {
    if (!root || !input || root.querySelector('.v54-keypad')) return;

    const box = document.createElement('div');
    box.className = 'v54-pin-box';
    box.innerHTML = `
      <div class="v54-pin-hint">กดตัวเลขด้านล่างได้เลย ถ้าคีย์บอร์ดมือถือไม่ขึ้น</div>
      <div class="v54-keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" class="v54-key" data-v54-digit="${n}">${n}</button>`).join('')}
        <button type="button" class="v54-key muted" data-v54-clear="1">ล้าง</button>
        <button type="button" class="v54-key" data-v54-digit="0">0</button>
        <button type="button" class="v54-key muted" data-v54-back="1">⌫</button>
      </div>
    `;

    const host = root.querySelector('.swal2-html-container') || input.parentElement || root;
    if (host === input.parentElement) host.appendChild(box);
    else host.appendChild(box);

    box.querySelectorAll('[data-v54-digit]').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = onlyDigits(input.value + btn.dataset.v54Digit, 4);
        makeEditable(input);
        fireInputEvents(input);
      });
    });
    box.querySelector('[data-v54-clear]')?.addEventListener('click', () => {
      input.value = '';
      fireInputEvents(input);
      input.focus({ preventScroll:true });
    });
    box.querySelector('[data-v54-back]')?.addEventListener('click', () => {
      input.value = onlyDigits(input.value, 4).slice(0, -1);
      fireInputEvents(input);
      input.focus({ preventScroll:true });
    });
  }

  function enhanceRoot(root) {
    if (!root || !isPinContext(root)) return false;

    root.classList?.add('v54-popup-fix');

    const inputs = Array.from(root.querySelectorAll?.('input') || [])
      .filter(i => {
        const hay = `${i.id || ''} ${i.name || ''} ${i.placeholder || ''} ${i.type || ''} ${i.className || ''}`;
        return /pin|รหัส|pass|password|swal2-input|text|tel|number/i.test(hay) || root.classList?.contains('swal2-popup');
      });

    if (!inputs.length) return false;

    const input = inputs.find(i => /pin|รหัส|pass|password/i.test(`${i.id} ${i.name} ${i.placeholder} ${i.type}`)) || inputs[0];
    makeEditable(input);
    addKeypad(root, input);
    return true;
  }

  function enhanceAll() {
    css();

    document.querySelectorAll('.swal2-popup, .modal, [role="dialog"], .modal-content').forEach(enhanceRoot);

    // เผื่อ SweetAlert สร้าง input ไว้นอก html-container
    const popup = document.querySelector('.swal2-popup');
    if (popup) enhanceRoot(popup);
  }

  function patchSwal() {
    if (!window.Swal || typeof Swal.fire !== 'function' || Swal.fire.__v54Patched) return;

    const original = Swal.fire.bind(Swal);

    Swal.fire = function v54Fire(arg1, ...rest) {
      if (arg1 && typeof arg1 === 'object') {
        const cfg = { ...arg1 };
        const txt = `${cfg.title || ''} ${cfg.text || ''} ${cfg.inputLabel || ''} ${cfg.html || ''}`;
        const maybePin = /(pin|พิน|รหัส|password|สิทธิ์|ผู้ใช้|ผู้ใช้งาน|admin|แอดมิน)/i.test(txt);

        if (maybePin) {
          cfg.customClass = {
            ...(cfg.customClass || {}),
            popup: `${cfg.customClass?.popup || ''} v54-popup-fix`.trim()
          };

          if (cfg.input) {
            cfg.input = 'tel';
            cfg.inputAttributes = {
              ...(cfg.inputAttributes || {}),
              inputmode: 'numeric',
              pattern: '[0-9]*',
              maxlength: '4',
              autocomplete: 'off',
              autocapitalize: 'off',
              autocorrect: 'off',
              spellcheck: 'false'
            };
          }

          const oldDidOpen = cfg.didOpen;
          cfg.didOpen = function (popup) {
            try { oldDidOpen?.apply(this, arguments); } catch (e) { console.warn(TAG, e); }
            setTimeout(() => enhanceRoot(popup), 0);
            setTimeout(enhanceAll, 80);
            setTimeout(enhanceAll, 250);
          };

          const oldPreConfirm = cfg.preConfirm;
          cfg.preConfirm = function (value) {
            const input = document.querySelector('.swal2-popup input');
            const pin = onlyDigits(value || input?.value || '', 4);
            if (input) {
              input.value = pin;
              fireInputEvents(input);
            }
            if (pin.length !== 4) {
              try { Swal.showValidationMessage('กรุณากรอกรหัสเป็นตัวเลข 4 หลัก'); } catch (_) {}
              return false;
            }
            if (oldPreConfirm) return oldPreConfirm.call(this, pin);
            return pin;
          };
        }

        return original(cfg, ...rest);
      }

      return original(arg1, ...rest);
    };

    Swal.fire.__v54Patched = true;
    console.log(TAG, 'SweetAlert patched');
  }

  // แก้เคสฟังก์ชันเดิมเปิด popup แล้ว input ถูกทับ/กดไม่ได้
  function bindGlobalFix() {
    if (window.__v54GlobalFixBound) return;
    window.__v54GlobalFixBound = true;

    document.addEventListener('click', () => {
      setTimeout(enhanceAll, 80);
      setTimeout(enhanceAll, 250);
      setTimeout(enhanceAll, 700);
    }, true);

    document.addEventListener('touchend', () => {
      setTimeout(enhanceAll, 80);
      setTimeout(enhanceAll, 250);
    }, true);

    const mo = new MutationObserver(() => enhanceAll());
    mo.observe(document.documentElement, { childList:true, subtree:true });
  }

  function boot() {
    css();
    patchSwal();
    bindGlobalFix();
    enhanceAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  setTimeout(boot, 300);
  setTimeout(boot, 1000);
  setTimeout(boot, 2500);
})();
