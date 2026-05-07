/* ==========================================================================
   SK POS V53 FINAL — User PIN Fix (clean replacement)
   ใช้แทนไฟล์ modules-v53-admin-pin-fix.js เดิมทั้งไฟล์

   จุดที่แก้:
   - ไม่ต่อ V54 / ไม่สร้างแป้นตัวเลขซ้ำ
   - ไม่ใช้ input.select() จึงไม่ครอบสีฟ้าเองบน iPhone
   - อ่านค่าจาก input ตัวจริงตอนกดบันทึก
   - บังคับ PIN เป็นเลข 4 หลัก ตามระบบ login เดิม
   - แก้/ครอบ SweetAlert ที่ชื่อเกี่ยวกับ แก้ PIN / รหัส / ผู้ใช้งาน
   - กัน toast สวัสดี/ยินดีต้อนรับซ้ำภายใน 1.5 วิ
   ========================================================================== */
(function () {
  'use strict';

  const TAG = '[V53-FINAL-PIN-FIX]';
  const STYLE_ID = 'v53-final-pin-fix-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v53-pin-keypad,
      .v54-keypad,
      .v54-pin-box,
      .v54-pin-hint {
        display: none !important;
      }

      .swal2-popup.v53-final-pin-popup {
        width: min(430px, calc(100vw - 28px)) !important;
        border-radius: 24px !important;
        padding: 28px 24px 22px !important;
        font-family: var(--font-thai, 'Prompt', system-ui, sans-serif) !important;
        box-shadow: 0 28px 80px rgba(15, 23, 42, .25) !important;
      }

      .swal2-popup.v53-final-pin-popup .swal2-title {
        font-size: 24px !important;
        font-weight: 950 !important;
        color: #0f172a !important;
        line-height: 1.25 !important;
        margin: 6px 0 16px !important;
      }

      .v53-final-pin-box {
        width: 100%;
        display: grid;
        gap: 10px;
        justify-items: center;
        margin: 4px auto 2px;
      }

      .v53-final-pin-input,
      .swal2-popup.v53-final-pin-popup .swal2-input {
        width: min(280px, 100%) !important;
        height: 64px !important;
        margin: 0 auto !important;
        border: 2px solid #e2e8f0 !important;
        border-radius: 18px !important;
        background: #fff !important;
        color: #111827 !important;
        text-align: center !important;
        font-size: 30px !important;
        font-weight: 950 !important;
        letter-spacing: 8px !important;
        outline: none !important;
        padding: 0 12px !important;
        box-shadow: none !important;
        pointer-events: auto !important;
        user-select: text !important;
        -webkit-user-select: text !important;
        -webkit-tap-highlight-color: transparent !important;
        -webkit-text-security: disc;
      }

      .v53-final-pin-input:focus,
      .swal2-popup.v53-final-pin-popup .swal2-input:focus {
        border-color: #dc2626 !important;
        box-shadow: 0 0 0 5px rgba(220, 38, 38, .12) !important;
      }

      .v53-final-pin-input::selection,
      .swal2-popup.v53-final-pin-popup .swal2-input::selection {
        background: transparent !important;
        color: inherit !important;
      }

      .v53-final-pin-hint {
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
        text-align: center;
      }

      .swal2-popup.v53-final-pin-popup .swal2-validation-message {
        margin: 14px auto 0 !important;
        border-radius: 12px !important;
        font-weight: 800 !important;
      }

      .swal2-popup.v53-final-pin-popup .swal2-actions {
        gap: 10px !important;
        margin-top: 20px !important;
      }

      .swal2-popup.v53-final-pin-popup .swal2-confirm,
      .swal2-popup.v53-final-pin-popup .swal2-cancel {
        min-width: 116px !important;
        height: 48px !important;
        border-radius: 14px !important;
        font-weight: 950 !important;
        font-family: inherit !important;
        box-shadow: none !important;
      }

      .swal2-popup.v53-final-pin-popup .swal2-confirm {
        background: linear-gradient(135deg, #dc2626, #ef4444) !important;
      }

      .swal2-popup.v53-final-pin-popup .swal2-cancel {
        background: #64748b !important;
      }
    `;
    document.head.appendChild(style);
  }

  function toPin4(value) {
    const thai = '๐๑๒๓๔๕๖๗๘๙';
    return String(value || '')
      .replace(/[๐-๙]/g, ch => String(thai.indexOf(ch)))
      .replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10))
      .replace(/\D/g, '')
      .slice(0, 4);
  }

  function looksLikePinDialogText(value) {
    return /(แก้\s*pin|แก้\s*รหัส|เปลี่ยน\s*pin|เปลี่ยน\s*รหัส|pin|พิน|รหัส|ผู้ใช้|ผู้ใช้งาน|สิทธิ์|admin|แอดมิน)/i.test(String(value || ''));
  }

  function getDbClient() {
    try {
      if (window.db) return window.db;
    } catch (_) {}

    try {
      if (typeof db !== 'undefined') return db;
    } catch (_) {}

    return null;
  }

  function findPinInput(root = document) {
    const scope = root.querySelector ? root : document;
    const inputs = Array.from(scope.querySelectorAll('input'))
      .filter(input => input.type !== 'hidden' && !input.disabled);

    if (!inputs.length) return null;

    const active = document.activeElement;
    if (active && inputs.includes(active)) return active;

    return (
      inputs.find(i => i.id === 'v53-final-pin-input') ||
      inputs.find(i => i.classList.contains('swal2-input')) ||
      inputs.find(i => /pin|รหัส|pass|password/i.test(`${i.id} ${i.name} ${i.placeholder} ${i.type} ${i.className}`)) ||
      inputs[inputs.length - 1]
    );
  }

  function makePinInputSafe(input) {
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
    input.setAttribute('placeholder', 'PIN ใหม่ 4 หลัก');

    input.classList.add('v53-final-pin-input');

    if (input.dataset.v53FinalBound === '1') return;
    input.dataset.v53FinalBound = '1';

    input.addEventListener('input', () => {
      input.value = toPin4(input.value);
    }, true);

    input.addEventListener('click', () => {
      setTimeout(() => {
        try {
          input.focus({ preventScroll: true });
          /* ห้าม select() เพราะ iPhone จะครอบสีฟ้า */
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
  }

  function removeOldKeypads(root = document) {
    root.querySelectorAll?.('.v53-pin-keypad, .v54-keypad, .v54-pin-box, .v54-pin-hint')
      .forEach(el => el.remove());
  }

  function readCurrentPin() {
    const popup = document.querySelector('.swal2-popup') || document;
    const input = findPinInput(popup) || findPinInput(document);
    const pin = toPin4(input?.value || '');

    if (input) {
      input.value = pin;
      try {
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      } catch (_) {}
    }

    return pin;
  }

  function showPinValidation() {
    if (window.Swal?.showValidationMessage) {
      Swal.showValidationMessage('กรุณากรอก PIN เป็นตัวเลข 4 หลัก');
    }
  }

  function enhanceOpenPinPopup(root) {
    if (!root) return false;

    const text = [
      root.querySelector?.('.swal2-title')?.textContent,
      root.querySelector?.('.swal2-html-container')?.textContent,
      root.textContent
    ].filter(Boolean).join(' ');

    if (!looksLikePinDialogText(text)) return false;

    root.classList?.add('v53-final-pin-popup');
    removeOldKeypads(root);

    const input = findPinInput(root);
    if (input) {
      makePinInputSafe(input);
      setTimeout(() => {
        try {
          input.focus({ preventScroll: true });
        } catch (_) {}
      }, 120);
    }

    return true;
  }

  async function openFinalPinDialog(username = '', currentPin = '') {
    injectStyle();

    const result = await Swal.fire({
      title: `แก้ PIN${username ? ` — ${username}` : ''}`,
      html: `
        <div class="v53-final-pin-box">
          <input
            id="v53-final-pin-input"
            class="v53-final-pin-input"
            type="tel"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="4"
            value="${toPin4(currentPin)}"
            placeholder="PIN ใหม่ 4 หลัก"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
          />
          <div class="v53-final-pin-hint">กรอกตัวเลข 4 หลัก เช่น 1234</div>
        </div>
      `,
      customClass: { popup: 'v53-final-pin-popup' },
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      focusConfirm: false,
      allowOutsideClick: false,
      didOpen: (popup) => {
        removeOldKeypads(popup);
        const input = document.getElementById('v53-final-pin-input');
        makePinInputSafe(input);
        setTimeout(() => input?.focus({ preventScroll: true }), 120);
      },
      preConfirm: () => {
        const pin = readCurrentPin();

        if (!/^\d{4}$/.test(pin)) {
          showPinValidation();
          return false;
        }

        return pin;
      }
    });

    return result.isConfirmed ? result.value : null;
  }

  window.skEditUserPin = async function skEditUserPin(userId, username = '', currentPin = '') {
    try {
      const pin = await openFinalPinDialog(username, currentPin);
      if (!pin) return;

      const client = getDbClient();
      if (!client) throw new Error('ไม่พบการเชื่อมต่อฐานข้อมูล db');

      const { error } = await client
        .from('ผู้ใช้งาน')
        .update({ pin })
        .eq('id', userId);

      if (error) throw error;

      if (typeof toast === 'function') {
        toast(`บันทึก PIN ของ ${username || 'ผู้ใช้งาน'} แล้ว`, 'success');
      } else {
        await Swal.fire('สำเร็จ', 'บันทึก PIN แล้ว', 'success');
      }

      if (typeof renderAdmin === 'function') {
        setTimeout(() => renderAdmin(), 150);
      }
    } catch (err) {
      console.error(TAG, err);
      const msg = err?.message || 'บันทึก PIN ไม่สำเร็จ';
      if (typeof toast === 'function') toast(msg, 'error');
      else await Swal.fire('ผิดพลาด', msg, 'error');
    }
  };

  function patchSwalFire() {
    if (!window.Swal || typeof Swal.fire !== 'function' || Swal.fire.__v53FinalPinPatched) return;

    const originalFire = Swal.fire.bind(Swal);

    Swal.fire = function v53FinalSwalFire(arg1, ...rest) {
      if (arg1 && typeof arg1 === 'object') {
        const cfg = { ...arg1 };
        const text = `${cfg.title || ''} ${cfg.text || ''} ${cfg.inputLabel || ''} ${cfg.inputPlaceholder || ''} ${cfg.html || ''}`;

        if (looksLikePinDialogText(text)) {
          cfg.customClass = {
            ...(cfg.customClass || {}),
            popup: `${cfg.customClass?.popup || ''} v53-final-pin-popup`.trim()
          };

          if (cfg.input) {
            cfg.input = 'tel';
            cfg.inputPlaceholder = 'PIN ใหม่ 4 หลัก';
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
              console.warn(TAG, 'old didOpen failed:', e);
            }

            setTimeout(() => enhanceOpenPinPopup(popup), 0);
            setTimeout(enhanceAllPinPopups, 120);
          };

          /*
            สำคัญ: ไม่เรียก oldPreConfirm ในเคส PIN
            เพราะโค้ดเดิมอ่าน input ผิดตัว ทำให้กรอกครบแล้วยังฟ้องว่าไม่ครบ
          */
          cfg.preConfirm = function () {
            const pin = readCurrentPin();

            if (!/^\d{4}$/.test(pin)) {
              showPinValidation();
              return false;
            }

            return pin;
          };
        }

        return originalFire(cfg, ...rest);
      }

      return originalFire(arg1, ...rest);
    };

    Swal.fire.__v53FinalPinPatched = true;
    console.log(TAG, 'SweetAlert PIN patch installed');
  }

  function patchDuplicateToast() {
    if (window.__v53FinalToastPatchInstalled) return;
    if (typeof window.toast !== 'function') return;

    const originalToast = window.toast;
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

      return originalToast.apply(this, arguments);
    };

    window.__v53FinalToastPatchInstalled = true;
  }

  function enhanceAllPinPopups() {
    injectStyle();
    removeOldKeypads(document);

    document
      .querySelectorAll('.swal2-popup, .modal, [role="dialog"], .modal-content')
      .forEach(enhanceOpenPinPopup);
  }

  function installObserver() {
    if (window.__v53FinalPinObserver) return;
    window.__v53FinalPinObserver = new MutationObserver(() => enhanceAllPinPopups());
    window.__v53FinalPinObserver.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('click', () => {
      setTimeout(enhanceAllPinPopups, 80);
      setTimeout(enhanceAllPinPopups, 250);
    }, true);

    document.addEventListener('touchend', () => {
      setTimeout(enhanceAllPinPopups, 80);
      setTimeout(enhanceAllPinPopups, 250);
    }, true);
  }

  function boot() {
    injectStyle();
    patchSwalFire();
    patchDuplicateToast();
    installObserver();
    enhanceAllPinPopups();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  setTimeout(boot, 300);
  setTimeout(boot, 1000);
  setTimeout(boot, 2500);
})();
