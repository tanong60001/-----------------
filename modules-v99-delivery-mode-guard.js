/* ════════════════════════════════════════════════════════════════
 *  MODULES V99 — Delivery-mode guard (กันบั๊ก "กดจัดส่ง → ออกมารับเอง")
 *  --------------------------------------------------------------
 *  ปัญหาที่พนักงานเจอ: เลือก "จัดส่ง" ตอนออกบิล แต่บางครั้งบิลที่
 *  บันทึก/พิมพ์ออกมากลายเป็น "ลูกค้ารับกลับเอง"
 *
 *  สาเหตุเชิงโครงสร้าง:
 *    - ตอนบันทึกบิล (v12CompletePayment ใน modules-v23.js) ใช้
 *        delivery_mode = delivMap[v12State.deliveryMode] || 'รับเอง'
 *      ค่า delivery_mode (ข้อความ) อ้างจาก v12State.deliveryMode เพียงตัวเดียว
 *    - แต่ตัวเลขจำนวนที่ต้องส่งจริงเก็บแยกใน v12State.itemModes (take/deliver)
 *    - มีจุดรีเซ็ต state หลายที่ + wrapper ของ v12CompletePayment หลายชั้น
 *      ถ้า deliveryMode ถูกรีเซ็ตเป็น 'self' กลางทางโดย itemModes ยังคงค่า
 *      จำนวนส่งไว้ → delivery_mode จะถูกบันทึกผิดเป็น 'รับเอง'
 *
 *  วิธีแก้ (ปลอดภัย — "อัปเกรดเท่านั้น ไม่ดาวน์เกรด"):
 *    ก่อนบันทึกบิล ถ้า itemModes มีจำนวนต้องส่ง (deliver > 0) จริง
 *    แต่ deliveryMode กลายเป็น 'self' → แก้กลับเป็น deliver/partial ตามจำนวน
 *    และ log ไว้ตรวจสอบ (ไม่แตะเคสรับเองที่ถูกต้อง)
 * ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };

  function reconcileDeliveryMode(tag) {
    try {
      const s = (typeof window !== 'undefined') ? window.v12State : null;
      if (!s || !s.itemModes) return;
      const vals = Object.values(s.itemModes);
      if (!vals.length) return;
      const anyDeliver = vals.some(m => num(m && m.deliver) > 0);
      const anyTake = vals.some(m => num(m && m.take) > 0);

      // มีของต้องส่งจริง แต่โหมดดันเป็น 'self'/ว่าง → แก้ให้ตรงกับความจริง
      if (anyDeliver && (s.deliveryMode === 'self' || !s.deliveryMode)) {
        const corrected = anyTake ? 'partial' : 'deliver';
        console.warn('[v99] guard: deliveryMode ผิด (self ทั้งที่มีของต้องส่ง) → แก้เป็น', corrected, {
          where: tag,
          itemModes: JSON.parse(JSON.stringify(s.itemModes)),
          customer: s.customer && s.customer.name,
        });
        s.deliveryMode = corrected;
        // เผื่อ flow ที่เคยข้ามวันนัดส่ง
        if (!s.deliveryDate && typeof window.appLocalDateKey === 'function') {
          try { s.deliveryDate = window.appLocalDateKey(); } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('[v99] reconcile error:', e);
    }
  }
  window.v99ReconcileDeliveryMode = reconcileDeliveryMode;

  const ALIASES = [
    'v12CompletePayment', 'v13CompletePayment', 'v15CompletePayment',
    'v16CompletePayment', 'v17CompletePayment', 'v18CompletePayment',
    'completePayment',
  ];

  function wrap(name) {
    const fn = window[name];
    if (typeof fn !== 'function') return;
    if (fn.__v99guard) return;
    const wrapped = async function () {
      reconcileDeliveryMode(name);
      return fn.apply(this, arguments);
    };
    wrapped.__v99guard = true;
    wrapped.__v99inner = fn;
    try { window[name] = wrapped; } catch (_) {}
  }

  function install() {
    ALIASES.forEach(wrap);
    // sync ตัวแปร global ที่ประกาศแบบ function declaration ใน app.js/modules
    try { v12CompletePayment = window.v12CompletePayment; } catch (_) {}
  }

  install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  // โมดูลอื่น (เช่น v92) อาจ re-wrap ภายหลัง → ครอบซ้ำให้ guard อยู่ชั้นนอกสุดเสมอ
  setTimeout(install, 0);
  setTimeout(install, 1200);
  setTimeout(install, 3000);

  console.log('[v99] delivery-mode guard พร้อมใช้งาน');
})();
