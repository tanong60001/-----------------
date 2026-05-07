/* ==========================================================================
   SK POS V53.2 — PIN Input Fix + No Duplicate Welcome Toast
   ใช้แทนไฟล์ modules-v53-admin-pin-fix.js เดิมทั้งไฟล์

   แก้:
   1) หน้าแก้รหัส/PIN กรอกได้บนมือถือ/iPhone/SUNMI
   2) ไม่สร้างแป้นตัวเลขซ้ำ
   3) ไม่ครอบสีฟ้าเอง เพราะไม่มี input.select()
   4) กัน Toast "ยินดีต้อนรับ/สวัสดี" เด้งซ้ำตอนเข้าเว็บครั้งแรก
   ========================================================================== */
(function () {
  'use strict';

  const TAG = '[v53.2-pin-fix-toast-dedupe]';
  const STYLE_ID = 'v53_2_pin_input_fix_style';

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
        letter-spacing: 8px !important;
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

      /* ปิด/ลบแป้นตัวเลขที่รุ่นเก่าเคยสร้างไว้ */
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

  function sanitizePin(value, max = 4) {
    return String(value || '').replace(/\D/g, '').slice(0, max);
  }

  function isPinText(value) {
    return /(pin|พิน|รหัส|password|pass|สิทธิ์|ผู้ใช้|ผู้ใช้งาน|admin|แอดมิน)/i.test(String(value || ''));
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
    input.maxLength = 4;
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.autocorrect = 'off';
    input.spellcheck = false;

    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('pattern', '[0-9]*');
    input.setAttribute('maxlength', '4');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('name', `sk_pin_${Date.now()}`);

    input.classList.add('v53-pin-input');
    input.style.pointerEvents = 'auto';
    input.style.position = 'relative';
    input.style.zIndex = '2147483647';

    if (input.dataset.v532Bound === '1') return;
    input.dataset.v532Bound = '1';

    input.addEventListener('input', () => {
      input.value = sanitizePin(input.value, 4);
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

    const inputs = Array.from(root.querySelectorAll?.('input') || []);
    const target =
      inputs.find(i => isPinText(`${i.id} ${i.name} ${i.placeholder} ${i.type} ${i.className}`)) ||
      inputs.find(i => i.classList.contains('swal2-input')) ||
      inputs[0];

    if (!target) return false;

    makeInputUsable(target);

    const htmlBox = root.querySelector?.('.swal2-html-container');
    if (htmlBox && !htmlBox.querySelector('.v53-pin-hint')) {
      const hint = document.createElement('div');
      hint.className = 'v53-pin-hint';
      hint.textContent = 'กรอกตัวเลข 4 หลัก';
      htmlBox.appendChild(hint);
    }

    return true;
  }

  async function openPinModal(options = {}) {
    injectStyle();

    const result = await Swal.fire({
      title: options.title || `แก้รหัส${options.username ? ` — ${options.username}` : ''}`,
      input: 'tel',
      inputValue: sanitizePin(options.currentPin || ''),
      inputAttributes: {
        inputmode: 'numeric',
        pattern: '[0-9]*',
        maxlength: '4',
        autocomplete: 'off',
        autocapitalize: 'off',
        autocorrect: 'off',
        spellcheck: 'false'
      },
      html: '<div class="v53-pin-hint">กรอกตัวเลข 4 หลัก</div>',
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
      preConfirm: (value) => {
        const input = document.querySelector('.swal2-popup input');
        const pin = sanitizePin(value || input?.value || '', 4);
        if (input) {
          input.value = pin;
          fireInputEvents(input);
        }
        if (pin.length !== 4) {
          Swal.showValidationMessage('กรุณากรอกรหัสเป็นตัวเลข 4 หลัก');
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
      .update({ pin: sanitizePin(pin) })
      .eq('id', userId);

    if (error) throw error;
    return true;
  }

  window.skEditUserPin = async function skEditUserPin(userId, username = '', currentPin = '') {
    try {
      const pin = await openPinModal({
        username,
        currentPin,
        title: `แก้รหัส${username ? ` — ${username}` : ''}`
      });

      if (!pin) return;

      await saveUserPin(userId, pin);

      if (typeof toast === 'function') toast(`บันทึกรหัสของ ${username || 'ผู้ใช้งาน'} แล้ว`, 'success');
      else await Swal.fire('สำเร็จ', 'บันทึกรหัสแล้ว', 'success');

      if (typeof renderAdmin === 'function') setTimeout(() => renderAdmin(), 150);
    } catch (err) {
      console.error(TAG, err);
      const msg = err?.message || 'บันทึกรหัสไม่สำเร็จ';
      if (typeof toast === 'function') toast(msg, 'error');
      else await Swal.fire('ผิดพลาด', msg, 'error');
    }
  };

  function patchSwalFire() {
    if (!window.Swal || typeof Swal.fire !== 'function' || Swal.fire.__v532Patched) return;

    const originalFire = Swal.fire.bind(Swal);

    Swal.fire = function patchedSwalFire(arg1, ...rest) {
      if (arg1 && typeof arg1 === 'object') {
        const cfg = { ...arg1 };
        const text = `${cfg.title || ''} ${cfg.text || ''} ${cfg.inputLabel || ''} ${cfg.html || ''}`;

        if (isPinText(text)) {
          cfg.customClass = {
            ...(cfg.customClass || {}),
            popup: `${cfg.customClass?.popup || ''} v53-pin-popup`.trim()
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
          cfg.preConfirm = function (value) {
            const input = document.querySelector('.swal2-popup input');
            const pin = sanitizePin(value || input?.value || '', 4);

            if (input) {
              input.value = pin;
              fireInputEvents(input);
            }

            if (pin.length !== 4) {
              try {
                Swal.showValidationMessage('กรุณากรอกรหัสเป็นตัวเลข 4 หลัก');
              } catch (_) {}
              return false;
            }

            if (oldPreConfirm) return oldPreConfirm.call(this, pin);
            return pin;
          };
        }

        return originalFire(cfg, ...rest);
      }

      return originalFire(arg1, ...rest);
    };

    Swal.fire.__v532Patched = true;
    console.log(TAG, 'SweetAlert patched');
  }

  function patchDuplicateToast() {
    if (window.__v532ToastPatchInstalled) return;
    if (typeof window.toast !== 'function') return;

    const oldToast = window.toast;
    let lastMessage = '';
    let lastType = '';
    let lastTime = 0;

    window.toast = function toastOnce(message, type = 'success') {
      const now = Date.now();
      const msg = String(message || '').trim();
      const kind = String(type || 'success');

      /* กันเฉพาะข้อความซ้ำติดกันใน 1.5 วิ เช่น ยินดีต้อนรับ/สวัสดี เด้ง 2 ครั้ง */
      if (msg === lastMessage && kind === lastType && (now - lastTime) < 1500) {
        return;
      }

      lastMessage = msg;
      lastType = kind;
      lastTime = now;

      return oldToast.apply(this, arguments);
    };

    window.__v532ToastPatchInstalled = true;
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
    if (window.__v532GlobalFixBound) return;
    window.__v532GlobalFixBound = true;

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
