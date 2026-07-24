(function () {
  'use strict';

  console.log('[v55] smart scanner loaded');

  const MIN_CODE_LENGTH = 4;
  const FAST_KEY_GAP_MS = 85;
  const SCAN_IDLE_MS = 140;
  const NEW_SCAN_AFTER_MS = 480;
  const DUPLICATE_COOLDOWN_MS = 900;

  const TARGET_IDS = new Set([
    'pos-search',
    'prod-barcode',
  ]);

  const scanState = new WeakMap();
  const lastCommitByTarget = new Map();

  function text(value) {
    return String(value ?? '');
  }

  function stripHidden(value) {
    return text(value)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[\r\n\t ]+/g, '')
      .trim();
  }

  function fullWidthToAscii(value) {
    return text(value).replace(/[\uFF01-\uFF5E]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );
  }

  function thaiDigitToAscii(value) {
    return text(value).replace(/[\u0E50-\u0E59]/g, ch =>
      String(ch.charCodeAt(0) - 0x0E50)
    );
  }

  const THAI_KEYBOARD_TO_ASCII = {
    'ๅ': '1', '/': '2', '-': '3', 'ภ': '4', 'ถ': '5', 'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0', 'ข': '-', 'ช': '=',
    '+': '!', '๑': '@', '๒': '#', '๓': '$', '๔': '%', 'ู': '^', '฿': '&', '๕': '*', '๖': '(', '๗': ')', '๘': '_', '๙': '+',
    'ๆ': 'q', 'ไ': 'w', 'ำ': 'e', 'พ': 'r', 'ะ': 't', 'ั': 'y', 'ี': 'u', 'ร': 'i', 'น': 'o', 'ย': 'p', 'บ': '[', 'ล': ']', 'ฃ': '\\',
    '๐': 'Q', '"': 'W', 'ฎ': 'E', 'ฑ': 'R', 'ธ': 'T', 'ํ': 'Y', '๊': 'U', 'ณ': 'I', 'ฯ': 'O', 'ญ': 'P', 'ฐ': '{', ',': '}',
    'ฟ': 'a', 'ห': 's', 'ก': 'd', 'ด': 'f', 'เ': 'g', '้': 'h', '่': 'j', 'า': 'k', 'ส': 'l', 'ว': ';', 'ง': "'",
    'ฤ': 'A', 'ฆ': 'S', 'ฏ': 'D', 'โ': 'F', 'ฌ': 'G', '็': 'H', '๋': 'J', 'ษ': 'K', 'ศ': 'L', 'ซ': ':', '.': '"',
    'ผ': 'z', 'ป': 'x', 'แ': 'c', 'อ': 'v', 'ิ': 'b', 'ื': 'n', 'ท': 'm', 'ม': ',', 'ใ': '.', 'ฝ': '/',
    '(': 'Z', ')': 'X', 'ฉ': 'C', 'ฮ': 'V', 'ฺ': 'B', '์': 'N', '?': 'M', 'ฒ': '<', 'ฬ': '>', 'ฦ': '?'
  };

  function thaiKeyboardToAscii(value) {
    return text(value).split('').map(ch => THAI_KEYBOARD_TO_ASCII[ch] ?? ch).join('');
  }

  function decodePercent(value) {
    const raw = text(value).trim();
    if (!/%[0-9A-Fa-f]{2}/.test(raw)) return raw;
    try {
      return decodeURIComponent(raw);
    } catch (_) {
      return raw;
    }
  }

  function extractPayload(raw) {
    const value = decodePercent(raw).trim();
    if (!value) return '';

    try {
      const url = new URL(value);
      for (const key of ['barcode', 'code', 'sku', 'id', 'q']) {
        const found = url.searchParams.get(key);
        if (found) return found;
      }
      const lastPath = url.pathname.split('/').filter(Boolean).pop();
      if (lastPath) return lastPath;
    } catch (_) {}

    const keyValue = value.match(/(?:barcode|code|sku|id|q)\s*[:=]\s*([0-9A-Za-z._:-]+)/i);
    if (keyValue) return keyValue[1];

    return value;
  }

  function productList() {
    try {
      if (Array.isArray(products)) return products;
    } catch (_) {}
    return Array.isArray(window.products) ? window.products : [];
  }

  function productBarcodeSet() {
    return new Set(productList()
      .map(product => stripHidden(product?.barcode))
      .filter(Boolean));
  }

  function candidateCodes(raw) {
    const payload = extractPayload(raw);
    const compact = stripHidden(payload);
    const ascii = stripHidden(thaiDigitToAscii(fullWidthToAscii(compact)));
    const hasThaiKeyboardText = /[\u0E00-\u0E7F]/.test(compact);
    const keyboardAscii = stripHidden(thaiDigitToAscii(fullWidthToAscii(thaiKeyboardToAscii(compact))));
    const readable = stripHidden(ascii.replace(/[^0-9A-Za-z._:-]/g, ''));
    const keyboardReadable = stripHidden(keyboardAscii.replace(/[^0-9A-Za-z._:-]/g, ''));

    const digitRun = ascii.match(/[0-9]{4,}/g) || [];
    const alphaNumRun = ascii.match(/[0-9A-Za-z][0-9A-Za-z._:-]{3,}/g) || [];
    const keyboardDigitRun = keyboardAscii.match(/[0-9]{4,}/g) || [];
    const keyboardAlphaNumRun = keyboardAscii.match(/[0-9A-Za-z][0-9A-Za-z._:-]{3,}/g) || [];

    const ordered = hasThaiKeyboardText ? [
      keyboardAscii,
      keyboardReadable,
      ...keyboardDigitRun,
      ...keyboardAlphaNumRun,
      ascii,
      readable,
      compact,
      ...digitRun,
      ...alphaNumRun,
    ] : [
      compact,
      ascii,
      readable,
      keyboardAscii,
      keyboardReadable,
      ...digitRun,
      ...alphaNumRun,
      ...keyboardDigitRun,
      ...keyboardAlphaNumRun,
    ];

    return [...new Set(ordered.filter(code => stripHidden(code).length >= MIN_CODE_LENGTH))];
  }

  function normalizeSmartCode(raw) {
    const candidates = candidateCodes(raw);
    if (!candidates.length) return '';

    const knownCodes = productBarcodeSet();
    const matched = candidates.find(code => knownCodes.has(stripHidden(code)));
    return stripHidden(matched || candidates[0]);
  }

  function isTarget(el) {
    return Boolean(el && TARGET_IDS.has(el.id));
  }

  function isPosSearch(el) {
    return el?.id === 'pos-search';
  }

  function getState(el) {
    let meta = scanState.get(el);
    if (!meta) {
      meta = {
        keys: 0,
        firstAt: 0,
        lastAt: 0,
        slowGap: false,
        timer: 0,
        forced: false,
        pasted: false,
        committing: false,
      };
      scanState.set(el, meta);
    }
    return meta;
  }

  function resetState(el) {
    const meta = getState(el);
    clearTimeout(meta.timer);
    meta.keys = 0;
    meta.firstAt = 0;
    meta.lastAt = 0;
    meta.slowGap = false;
    meta.forced = false;
    meta.pasted = false;
    meta.committing = false;
  }

  function looksLikeScanner(meta) {
    if (meta.forced || meta.pasted) return true;
    if (meta.keys < MIN_CODE_LENGTH || meta.slowGap) return false;
    const elapsed = Date.now() - meta.firstAt;
    return elapsed <= Math.max(300, meta.keys * FAST_KEY_GAP_MS);
  }

  function recentlyCommitted(el, code) {
    const key = el.id || 'unknown';
    const now = Date.now();
    const last = lastCommitByTarget.get(key);
    if (last && last.code === code && now - last.at < DUPLICATE_COOLDOWN_MS) return true;
    lastCommitByTarget.set(key, { code, at: now });
    return false;
  }

  function fireInput(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function addToCartByBarcode(code) {
    if (typeof window.v40AddBarcodeToCartOnce === 'function') {
      return window.v40AddBarcodeToCartOnce(code);
    }
    return false;
  }

  function commitTarget(el) {
    if (!isTarget(el)) return;
    const meta = getState(el);
    if (meta.committing) return;

    meta.committing = true;
    try {
      const code = normalizeSmartCode(el.value);
      if (!code) return resetState(el);

      const scanLike = looksLikeScanner(meta);
      if (isPosSearch(el) && !scanLike) return resetState(el);
      if (recentlyCommitted(el, code)) return resetState(el);

      el.value = code;
      fireInput(el);

      if (isPosSearch(el) && addToCartByBarcode(code)) {
        el.value = '';
        fireInput(el);
      }

      resetState(el);
    } finally {
      getState(el).committing = false;
    }
  }

  function scheduleCommit(el) {
    const meta = getState(el);
    clearTimeout(meta.timer);
    meta.timer = setTimeout(() => commitTarget(el), SCAN_IDLE_MS);
  }

  function onTargetKeydown(event) {
    const el = event.target;
    if (!isTarget(el) || event.ctrlKey || event.altKey || event.metaKey) return;

    const meta = getState(el);
    if (event.key === 'Enter' || event.key === 'Tab') {
      meta.forced = true;
      event.preventDefault();
      event.stopPropagation();
      setTimeout(() => commitTarget(el), 0);
      return;
    }

    if (event.key.length !== 1) return;

    const now = Date.now();
    if (!meta.firstAt || now - meta.lastAt > NEW_SCAN_AFTER_MS) {
      meta.keys = 0;
      meta.firstAt = now;
      meta.slowGap = false;
    } else if (now - meta.lastAt > FAST_KEY_GAP_MS) {
      meta.slowGap = true;
    }

    meta.keys += 1;
    meta.lastAt = now;
    scheduleCommit(el);
  }

  function onTargetPaste(event) {
    const el = event.target;
    if (!isTarget(el)) return;
    const meta = getState(el);
    meta.pasted = true;
    meta.forced = true;
    setTimeout(() => scheduleCommit(el), 0);
  }

  function onTargetInput(event) {
    const el = event.target;
    if (!isTarget(el)) return;
    scheduleCommit(el);
  }

  function wrapCameraScanner() {
    if (window.__v55CameraWrapped || typeof window.v40AddBarcodeToCartOnce !== 'function') return;

    const original = window.v40AddBarcodeToCartOnce;
    window.v40AddBarcodeToCartOnce = function (rawCode, opts) {
      return original.call(this, normalizeSmartCode(rawCode), opts);
    };
    window.__v55CameraWrapped = true;
  }

  function install() {
    if (window.__v55SmartScannerInstalled) {
      wrapCameraScanner();
      return;
    }
    window.__v55SmartScannerInstalled = true;

    document.addEventListener('keydown', onTargetKeydown, true);
    document.addEventListener('paste', onTargetPaste, true);
    document.addEventListener('input', onTargetInput, true);
    document.addEventListener('submit', event => {
      const form = event.target;
      if (form?.id === 'product-form') window.v55SmartScannerCommit('prod-barcode');
    }, true);
    document.addEventListener('click', event => {
      const target = event.target?.closest?.('.swal2-confirm,[type="submit"]');
      if (!target) return;
      window.v55SmartScannerCommit('prod-barcode');
    }, true);
    wrapCameraScanner();
    [250, 800, 1800].forEach(delay => setTimeout(wrapCameraScanner, delay));
  }

  window.v55NormalizeSmartCode = normalizeSmartCode;
  window.v55SmartScannerCommit = function (targetOrId) {
    const el = typeof targetOrId === 'string' ? document.getElementById(targetOrId) : targetOrId;
    if (isTarget(el)) {
      getState(el).forced = true;
      commitTarget(el);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
