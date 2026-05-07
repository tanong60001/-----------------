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
