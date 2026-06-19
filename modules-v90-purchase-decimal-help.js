(function () {
  'use strict';

  const BIGINT_DECIMAL_RE = /invalid input syntax for type bigint/i;
  const DECIMAL_VALUE_RE = /"(-?\d+\.\d+)"/;

  function rewriteMessage(message) {
    const text = String(message || '');
    if (!BIGINT_DECIMAL_RE.test(text)) return null;

    const value = text.match(DECIMAL_VALUE_RE)?.[1];
    return [
      'บันทึกไม่สำเร็จ: พบค่าทศนิยม' + (value ? ` (${value})` : ''),
      'ฐานข้อมูลยังมีบางช่องเป็นจำนวนเต็มอยู่ กรุณารันไฟล์ migrations/decimal_stock_quantities.sql เวอร์ชันล่าสุดใน Supabase SQL Editor อีกครั้ง',
    ].join(' - ');
  }

  function patchToast() {
    if (typeof window.toast !== 'function') return false;
    if (window.toast.__v90DecimalHelp) return true;

    const originalToast = window.toast;
    const wrappedToast = function (message, type, ...rest) {
      const betterMessage = rewriteMessage(message);
      return originalToast.call(this, betterMessage || message, betterMessage ? 'error' : type, ...rest);
    };

    wrappedToast.__v90DecimalHelp = true;
    window.toast = wrappedToast;

    try {
      toast = wrappedToast;
    } catch (_) {
      // Some browsers keep global function bindings read-only. window.toast is enough.
    }

    return true;
  }

  if (!patchToast()) {
    const timer = setInterval(() => {
      if (patchToast()) clearInterval(timer);
    }, 300);
    setTimeout(() => clearInterval(timer), 10000);
  }
})();
