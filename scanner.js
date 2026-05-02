// scanner.js - POS camera barcode/QR scanner with duplicate-scan protection.
let html5QrcodeScanner = null;

(function () {
  'use strict';

  const SCAN_COOLDOWN_MS = 1600;
  let scannerStarting = false;
  let scannerClosing = false;
  let scanLocked = false;
  let lastAcceptedCode = '';
  let lastAcceptedAt = 0;

  const cleanCode = value => String(value || '').trim();

  function canAcceptCode(code) {
    const now = Date.now();
    if (!code) return false;
    if (scanLocked) return false;
    if (code === lastAcceptedCode && now - lastAcceptedAt < SCAN_COOLDOWN_MS) return false;
    scanLocked = true;
    lastAcceptedCode = code;
    lastAcceptedAt = now;
    return true;
  }

  function unlockScannerSoon() {
    window.setTimeout(() => {
      scanLocked = false;
    }, SCAN_COOLDOWN_MS);
  }

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (_) {}
  }

  window.v40AddBarcodeToCartOnce = function (rawCode, opts = {}) {
    const code = cleanCode(rawCode);
    const searchInput = document.getElementById('pos-search');
    if (!canAcceptCode(code)) return false;

    try {
      const list = Array.isArray(window.products)
        ? window.products
        : (typeof products !== 'undefined' && Array.isArray(products) ? products : []);
      const foundProduct = list.find(p => cleanCode(p.barcode) === code);

      if (!foundProduct) {
        if (searchInput) {
          searchInput.value = code;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (!opts.silent && typeof toast === 'function') toast('ไม่พบรหัสสินค้านี้ในระบบ', 'warning');
        return false;
      }

      if (Number(foundProduct.stock || 0) <= 0) {
        if (!opts.silent && typeof toast === 'function') toast('สินค้าหมดสต็อก', 'error');
        return false;
      }

      if (typeof addToCart === 'function') {
        addToCart(foundProduct.id);
        playBeep();
        if (!opts.silent && typeof toast === 'function') toast(`เพิ่ม ${foundProduct.name} แล้ว`, 'success');
      }

      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    } finally {
      unlockScannerSoon();
    }
  };

  async function stopScanner() {
    const scannerModal = document.getElementById('scanner-modal');
    if (scannerModal) scannerModal.classList.add('hidden');
    if (!html5QrcodeScanner || scannerClosing) return;

    scannerClosing = true;
    try {
      await html5QrcodeScanner.stop();
      await html5QrcodeScanner.clear();
    } catch (err) {
      console.warn('[scanner] stop warning:', err);
    } finally {
      html5QrcodeScanner = null;
      scannerClosing = false;
      scannerStarting = false;
    }
  }

  async function openScanner() {
    const scannerModal = document.getElementById('scanner-modal');
    const reader = document.getElementById('reader');
    if (!scannerModal || !reader || scannerStarting || html5QrcodeScanner) return;

    if (typeof Html5Qrcode === 'undefined') {
      if (typeof toast === 'function') toast('ยังโหลดระบบสแกนไม่สำเร็จ กรุณารีเฟรชหน้า', 'error');
      return;
    }

    scannerStarting = true;
    scanLocked = false;
    reader.innerHTML = '';
    scannerModal.classList.remove('hidden');

    try {
      html5QrcodeScanner = new Html5Qrcode('reader');
      await html5QrcodeScanner.start(
        { facingMode: 'environment' },
        {
          fps: 8,
          qrbox: { width: 260, height: 180 },
          aspectRatio: 1.0,
        },
        async decodedText => {
          const code = cleanCode(decodedText);
          const accepted = window.v40AddBarcodeToCartOnce(code);
          if (accepted || scanLocked) await stopScanner();
        },
        () => {}
      );
    } catch (err) {
      console.error('[scanner] start failed:', err);
      if (typeof toast === 'function') toast('เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้องแล้วลองใหม่', 'error');
      await stopScanner();
    } finally {
      scannerStarting = false;
    }
  }

  function install() {
    const scanBtn = document.getElementById('pos-scan-btn');
    const closeBtn = document.getElementById('scanner-close-btn');
    const modal = document.getElementById('scanner-modal');

    if (scanBtn && !scanBtn.__v40ScannerClick) {
      scanBtn.__v40ScannerClick = true;
      scanBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openScanner();
      });
    }

    if (closeBtn && !closeBtn.__v40ScannerClose) {
      closeBtn.__v40ScannerClose = true;
      closeBtn.addEventListener('click', () => {
        stopScanner();
        if (typeof v9StopScanner === 'function') v9StopScanner();
      });
    }

    if (modal && !modal.__v40ScannerBackdrop) {
      modal.__v40ScannerBackdrop = true;
      modal.addEventListener('click', e => {
        if (e.target === modal) stopScanner();
      });
    }
  }

  window.v40OpenScanner = openScanner;
  window.v40StopScanner = stopScanner;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();

document.addEventListener('keydown', e => {
  const searchInput = document.getElementById('pos-search');
  const activeElement = document.activeElement?.tagName;
  if (
    typeof currentPage !== 'undefined' &&
    currentPage === 'pos' &&
    searchInput &&
    activeElement !== 'INPUT' &&
    activeElement !== 'TEXTAREA' &&
    activeElement !== 'SELECT'
  ) {
    searchInput.focus();
  }
});
