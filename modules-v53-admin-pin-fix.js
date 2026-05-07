/* ==========================================================================
   SK POS V53.3 — PIN/Password Modal Fix
   ใช้แทนไฟล์ modules-v53-admin-pin-fix.js เดิมทั้งไฟล์

   แก้เพิ่มจาก V53.2:
   1) กดบันทึกแล้วไม่อ่านค่าช่องกรอกผิดช่อง
   2) รองรับรหัส 4-6 ตัว ตาม placeholder "PIN ใหม่ 4-6"
   3) รองรับเลขไทย ๐-๙ และเลขอารบิก 0-9
   4) ไม่สร้างแป้นตัวเลขซ้ำ / ไม่ครอบสีฟ้า
   5) กัน toast สวัสดี/ยินดีต้อนรับ เด้งซ้ำ
   ========================================================================== */
(function () {
  'use strict';

  const TAG = '[v53.3-pin-password-modal-fix]';
  const STYLE_ID = 'v53_3_pin_input_fix_style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .swal2-container,
      .swal2-popup,
      .swal2-html-container {
        pointer-events: auto !important;
      }

      .swal2-popup.v53-pin-popup,
      .swal2-popup.v54-popup-fix {
        width: min(430px, calc(100vw - 28px)) !important;
        border-radius: 24px !important;
        padding: 26px 24px 22px !important;
        font-family: var(--font-thai, 'Prompt', system-ui, sans-serif) !important;
        box-shadow: 0 28px 80px rgba(15, 23, 42, .25) !important;
      }

      .swal2-popup.v53-pin-popup .swal2-title,
      .swal2-popup.v54-popup-fix .swal2-title {
        font-size: 24px !important;
        font-weight: 950 !important;
        color: #0f172a !important;
        line-height: 1.25 !important;
        margin: 6px 0 10px !important;
      }

      .swal2-popup input,
      .modal input,
      [role="dialog"] input {
        pointer-events: auto !important;
        touch-action: manipulation !important;
        -webkit-tap-highlight-color: transparent !important;
        user-select: text !important;
        -webkit-user-select: text !important;
      }

      .swal2-popup input::selection,
      .modal input::selection,
      [role="dialog"] input::selection {
        background: transparent !important;
        color: inherit !important;
      }

      .v53-pin-input,
      .v54-pin-main,
      .swal2-popup .swal2-input {
        width: min(280px, 100%) !important;
        height: 64px !important;
        margin: 12px auto 8px !important;
        border: 2px solid #e2e8f0 !important;
        border-radius: 18px !important;
        background: #fff !important;
        color: #111827 !important;
        text-align: center !important;
        font-size: 30px !important;
        font-weight: 950 !important;
        letter-spacing: 6px !important;
        outline: none !important;
        padding: 0 10px !important;
        box-shadow: none !important;
        position: relative !important;
        z-index: 2147483647 !important;
        -webkit-text-security: disc;
      }

      .v53-pin-input:focus,
      .v54-pin-main:focus,
      .swal2-popup .swal2-input:focus {
        border-color: #dc2626 !important;
        box-shadow: 0 0 0 5px rgba(220, 38, 38, .12) !important;
      }

      .v53-pin-hint {
        text-align: center;
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
        margin-top: 6px;
      }

      .v53-pin-keypad,
      .v54-keypad,
      .v54-pin-hint {
        display: none !important;
      }

      .swal2-popup.v53-pin-popup .swal2-actions,
      .swal2-popup.v54-popup-fix .swal2-actions {
        gap: 10px !important;
        margin-top: 18px !important;
      }

      .swal2-popup.v53-pin-popup .swal2-confirm,
      .swal2-popup.v53-pin-popup .swal2-cancel,
      .swal2-popup.v54-popup-fix .swal2-confirm,
      .swal2-popup.v54-popup-fix .swal2-cancel {
        min-width: 116px !important;
        height: 48px !important;
        border-radius: 14px !important;
        font-weight: 950 !important;
        font-family: inherit !important;
        box-shadow: none !important;
      }

      .swal2-popup.v53-pin-popup .swal2-confirm,
      .swal2-popup.v54-popup-fix .swal2-confirm {
        background: linear-gradient(135deg, #dc2626, #ef4444) !important;
      }

      .swal2-popup.v53-pin-popup .swal2-cancel,
      .swal2-popup.v54-popup-fix .swal2-cancel {
        background: #64748b !important;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeDigits(value) {
    const thai = '๐๑๒๓๔๕๖๗๘๙';
    const arabic = '0123456789';

    return String(value || '')
      .replace(/[๐-๙]/g, ch => String(thai.indexOf(ch)))
      .replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10))
      .replace(/\D/g, '')
      .slice(0, 6);
  }

  function isPinText(value) {
    return /(pin|พิน|รหัส|password|pass|สิทธิ์|ผู้ใช้|ผู้ใช้งาน|admin|แอดมิน)/i.test(String(value || ''));
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function getBestInput(root = document) {
    const scope = root.querySelector ? root : document;
    const inputs = Array.from(scope.querySelectorAll('input'))
      .filter(i => isVisible(i) && !i.disabled && i.type !== 'hidden');

    if (!inputs.length) return null;

    const active = document.activeElement;
    if (active && inputs.includes(active)) return active;

    return (
      inputs.find(i => i.dataset.v533Bound === '1') ||
      inputs.find(i => i.classList.contains('swal2-input')) ||
      inputs.find(i => isPinText(`${i.id} ${i.name} ${i.placeholder} ${i.type} ${i.className}`)) ||
      inputs[inputs.length - 1]
    );
  }

  function removeOldKeypads(root = document) {
    root.querySelectorAll?.('.v53-pin-keypad, .v54-keypad, .v54-pin-hint').forEach(el => el.remove());
  }

  function fireInputEvents(input) {
    ['input', 'change', 'keyup'].forEach(type => {
      try {
        input.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      } catch (_) {}
    });
  }

  function makeInputUsable(input) {
    if (!input) return;

    input.disabled = false;
    input.readOnly = false;
    input.removeAttribute('disabled');
    input.removeAttribute('readonly');

    input.type = 'tel';
    input.inputMode = 'numeric';
    input.maxLength = 6;
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.autocorrect = 'off';
    input.spellcheck = false;

    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('pattern', '[0-9]*');
    input.setAttribute('maxlength', '6');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('name', `sk_pin_${Date.now()}`);

    if (!input.placeholder || /pin|รหัส/i.test(input.placeholder)) {
      input.placeholder = 'PIN ใหม่ 4-6';
    }

    input.classList.add('v53-pin-input');
    input.style.pointerEvents = 'auto';
    input.style.position = 'relative';
    input.style.zIndex = '2147483647';

    if (input.dataset.v533Bound === '1') return;
    input.dataset.v533Bound = '1';

    input.addEventListener('input', () => {
      input.value = normalizeDigits(input.value);
    }, true);

    input.addEventListener('click', () => {
      setTimeout(() => {
        try {
          input.focus({ preventScroll: true });
          /* ห้าม input.select() เพราะ iPhone จะครอบสีฟ้า */
        } catch (_) {}
      }, 0);
    }, true);

    input.addEventListener('touchend', () => {
      setTimeout(() => {
        try {
          input.focus({ preventScroll: true });
        } catch (_) {}
      }, 0);
    }, true);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.querySelector('.swal2-confirm')?.click();
      }
    }, true);

    setTimeout(() => {
      try {
        input.focus({ preventScroll: true });
        /* ห้าม input.select() */
      } catch (_) {}
    }, 120);
  }

  function enhancePopup(root) {
    if (!root) return false;

    const title = root.querySelector?.('.swal2-title')?.textContent || '';
    const html = root.querySelector?.('.swal2-html-container')?.textContent || '';
    const allText = `${title} ${html} ${root.textContent || ''}`;

    if (!isPinText(allText)) return false;

    root.classList?.add('v53-pin-popup');
    removeOldKeypads(root);

    const target = getBestInput(root);
    if (!target) return false;

    makeInputUsable(target);

    const htmlBox = root.querySelector?.('.swal2-html-container');
    if (htmlBox && !htmlBox.querySelector('.v53-pin-hint')) {
      const hint = document.createElement('div');
      hint.className = 'v53-pin-hint';
      hint.textContent = 'กรอกตัวเลข 4-6 หลัก';
      htmlBox.appendChild(hint);
    } else if (htmlBox) {
      const hint = htmlBox.querySelector('.v53-pin-hint');
      if (hint) hint.textContent = 'กรอกตัวเลข 4-6 หลัก';
    }

    return true;
  }

  function readPinFromPopup() {
    const popup = document.querySelector('.swal2-popup') || document;
    const input = getBestInput(popup) || getBestInput(document);
    const pin = normalizeDigits(input?.value || '');

    if (input) {
      input.value = pin;
      fireInputEvents(input);
    }

    return pin;
  }

  function validatePin(pin) {
    return /^\d{4,6}$/.test(String(pin || ''));
  }

  async function openPinModal(options = {}) {
    injectStyle();

    const result = await Swal.fire({
      title: options.title || `แก้ PIN${options.username ? ` — ${options.username}` : ''}`,
      input: 'tel',
      inputValue: normalizeDigits(options.currentPin || ''),
      inputPlaceholder: 'PIN ใหม่ 4-6',
      inputAttributes: {
        inputmode: 'numeric',
        pattern: '[0-9]*',
        maxlength: '6',
        autocomplete: 'off',
        autocapitalize: 'off',
        autocorrect: 'off',
        spellcheck: 'false'
      },
      html: '<div class="v53-pin-hint">กรอกตัวเลข 4-6 หลัก</div>',
      customClass: { popup: 'v53-pin-popup' },
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      focusConfirm: false,
      allowOutsideClick: false,
      didOpen: (popup) => {
        removeOldKeypads(popup);
        enhancePopup(popup);
      },
      preConfirm: () => {
        const pin = readPinFromPopup();

        if (!validatePin(pin)) {
          Swal.showValidationMessage('กรุณากรอกรหัสเป็นตัวเลข 4-6 หลัก');
          return false;
        }

        return pin;
      }
    });

    return result.isConfirmed ? result.value : null;
  }

  async function saveUserPin(userId, pin) {
    if (!userId) throw new Error('ไม่พบ user id');
    if (!window.db) throw new Error('ไม่พบตัวแปร db / Supabase client');

    const { error } = await db
      .from('ผู้ใช้งาน')
      .update({ pin: normalizeDigits(pin) })
      .eq('id', userId);

    if (error) throw error;
    return true;
  }

  window.skEditUserPin = async function skEditUserPin(userId, username = '', currentPin = '') {
    try {
      const pin = await openPinModal({
        username,
        currentPin,
        title: `แก้ PIN${username ? ` — ${username}` : ''}`
      });

      if (!pin) return;

      await saveUserPin(userId, pin);

      if (typeof toast === 'function') toast(`บันทึก PIN ของ ${username || 'ผู้ใช้งาน'} แล้ว`, 'success');
      else await Swal.fire('สำเร็จ', 'บันทึก PIN แล้ว', 'success');

      if (typeof renderAdmin === 'function') setTimeout(() => renderAdmin(), 150);
    } catch (err) {
      console.error(TAG, err);
      const msg = err?.message || 'บันทึก PIN ไม่สำเร็จ';
      if (typeof toast === 'function') toast(msg, 'error');
      else await Swal.fire('ผิดพลาด', msg, 'error');
    }
  };

  function patchSwalFire() {
    if (!window.Swal || typeof Swal.fire !== 'function' || Swal.fire.__v533Patched) return;

    const originalFire = Swal.fire.bind(Swal);

    Swal.fire = function patchedSwalFire(arg1, ...rest) {
      if (arg1 && typeof arg1 === 'object') {
        const cfg = { ...arg1 };
        const text = `${cfg.title || ''} ${cfg.text || ''} ${cfg.inputLabel || ''} ${cfg.html || ''} ${cfg.inputPlaceholder || ''}`;

        if (isPinText(text)) {
          cfg.customClass = {
            ...(cfg.customClass || {}),
            popup: `${cfg.customClass?.popup || ''} v53-pin-popup`.trim()
          };

          if (cfg.input) {
            cfg.input = 'tel';
            cfg.inputPlaceholder = cfg.inputPlaceholder || 'PIN ใหม่ 4-6';
            cfg.inputAttributes = {
              ...(cfg.inputAttributes || {}),
              inputmode: 'numeric',
              pattern: '[0-9]*',
              maxlength: '6',
              autocomplete: 'off',
              autocapitalize: 'off',
              autocorrect: 'off',
              spellcheck: 'false',
              name: `sk_pin_${Date.now()}`
            };
          }

          const oldDidOpen = cfg.didOpen;
          cfg.didOpen = function (popup) {
            try {
              oldDidOpen?.apply(this, arguments);
            } catch (e) {
              console.warn(TAG, e);
            }

            setTimeout(() => {
              removeOldKeypads(popup);
              enhancePopup(popup);
            }, 0);

            setTimeout(enhanceAll, 120);
          };

          const oldPreConfirm = cfg.preConfirm;
          cfg.preConfirm = function () {
            const pin = readPinFromPopup();

            if (!validatePin(pin)) {
              try {
                Swal.showValidationMessage('กรุณากรอกรหัสเป็นตัวเลข 4-6 หลัก');
              } catch (_) {}
              return false;
            }

            if (oldPreConfirm) {
              /*
                สำคัญ: ส่ง pin ที่อ่านจากช่องจริงเข้า oldPreConfirm
                กันเคส SweetAlert ส่ง value ว่างหรืออ่านผิด input
              */
              return oldPreConfirm.call(this, pin);
            }

            return pin;
          };
        }

        return originalFire(cfg, ...rest);
      }

      return originalFire(arg1, ...rest);
    };

    Swal.fire.__v533Patched = true;
    console.log(TAG, 'SweetAlert patched');
  }

  function patchDuplicateToast() {
    if (window.__v533ToastPatchInstalled) return;
    if (typeof window.toast !== 'function') return;

    const oldToast = window.toast;
    let lastMessage = '';
    let lastType = '';
    let lastTime = 0;

    window.toast = function toastOnce(message, type = 'success') {
      const now = Date.now();
      const msg = String(message || '').trim();
      const kind = String(type || 'success');

      if (msg === lastMessage && kind === lastType && (now - lastTime) < 1500) {
        return;
      }

      lastMessage = msg;
      lastType = kind;
      lastTime = now;

      return oldToast.apply(this, arguments);
    };

    window.__v533ToastPatchInstalled = true;
    console.log(TAG, 'toast duplicate guard installed');
  }

  function enhanceAll() {
    injectStyle();
    removeOldKeypads(document);

    document
      .querySelectorAll('.swal2-popup, .modal, [role="dialog"], .modal-content')
      .forEach(enhancePopup);
  }

  function bindGlobalFix() {
    if (window.__v533GlobalFixBound) return;
    window.__v533GlobalFixBound = true;

    document.addEventListener('click', () => {
      setTimeout(enhanceAll, 80);
      setTimeout(enhanceAll, 250);
    }, true);

    document.addEventListener('touchend', () => {
      setTimeout(enhanceAll, 80);
      setTimeout(enhanceAll, 250);
    }, true);

    const mo = new MutationObserver(() => enhanceAll());
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  function boot() {
    injectStyle();
    patchSwalFire();
    patchDuplicateToast();
    bindGlobalFix();
    enhanceAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  setTimeout(boot, 300);
  setTimeout(boot, 1000);
  setTimeout(boot, 2500);
})();
