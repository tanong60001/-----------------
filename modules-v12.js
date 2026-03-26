/**
 * SK POS — modules-v12.js (Complete Edition)
 * ════════════════════════════════════════════════════════════════
 * Override 3 ระบบหลัก (ไม่แตะฟังก์ชันอื่นนอกคำสั่ง):
 *  1. Split-Layout Checkout — 6 Steps (F10) + ระบบนับแบงค์
 *  2. Delivery Queue Module — หน้าคิวส่งของ
 *  3. Bill Management Center — หน้าประวัติการขายใหม่
 *
 * แก้ไขจาก v12 เดิม:
 *  - เพิ่ม Delivery page section inject เข้า DOM อัตโนมัติ
 *  - เพิ่ม Delivery nav item ใน sidebar + badge
 *  - ระบบนับแบงค์/เหรียญ BILLS & COINS fallback (กันกรณี app.js ไม่มี)
 *  - แก้ calcChangeDenominations fallback
 *  - แก้ step navigation ให้ถูกต้อง 100%
 *  - แก้ formatNum / formatDate / formatTime / formatDateTime fallback
 *  - เพิ่ม keyboard shortcut F10 สำหรับ checkout
 *  - เพิ่ม long-press ลบแบงค์ที่เลือก
 *  - เพิ่ม change denomination breakdown (แสดงแบงค์ทอน)
 * ════════════════════════════════════════════════════════════════
 */

/* ──────────────────────────────────────────────────────────────
   SAFE GLOBALS / FALLBACKS
   (กัน crash กรณี app.js ยังโหลดไม่เสร็จ หรือไม่มีตัวแปรนี้)
────────────────────────────────────────────────────────────── */
if (typeof BILLS === 'undefined') {
  window.BILLS = [
    { value: 1000, label: '1,000', bg: '#6b4c9a' },
    { value: 500,  label: '500',   bg: '#6b8e23' },
    { value: 100,  label: '100',   bg: '#cd5c5c' },
    { value: 50,   label: '50',    bg: '#4682b4' },
    { value: 20,   label: '20',    bg: '#2e8b57' },
  ];
}
if (typeof COINS === 'undefined') {
  window.COINS = [
    { value: 10, label: '10', bg: '#c0a060' },
    { value: 5,  label: '5',  bg: '#c0c0c0' },
    { value: 2,  label: '2',  bg: '#d4af37' },
    { value: 1,  label: '1',  bg: '#c0c0c0' },
  ];
}
if (typeof formatNum === 'undefined') {
  window.formatNum = function (n) {
    return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
}
if (typeof formatDate === 'undefined') {
  window.formatDate = function (d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  };
}
if (typeof formatTime === 'undefined') {
  window.formatTime = function (d) {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };
}
if (typeof formatDateTime === 'undefined') {
  window.formatDateTime = function (d) {
    if (!d) return '-';
    return formatDate(d) + ' ' + formatTime(d);
  };
}
if (typeof calcChangeDenominations === 'undefined') {
  window.calcChangeDenominations = function (amount) {
    const result = {};
    let rem = Math.round(amount);
    [...BILLS, ...COINS].forEach(d => {
      result[d.value] = Math.floor(rem / d.value);
      rem -= result[d.value] * d.value;
    });
    return result;
  };
}
if (typeof isProcessingPayment === 'undefined') {
  window.isProcessingPayment = false;
}

/* ──────────────────────────────────────────────────────────────
   INJECT DELIVERY PAGE + NAV ITEM (ถ้ายังไม่มี)
────────────────────────────────────────────────────────────── */
(function injectDeliveryPage() {
  // เพิ่ม <section id="page-delivery"> ถ้ายังไม่มี
  if (!document.getElementById('page-delivery')) {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      const sec = document.createElement('section');
      sec.id = 'page-delivery';
      sec.className = 'page-section hidden';
      contentArea.appendChild(sec);
    }
  }

  // เพิ่มเมนู "คิวจัดส่ง" ใน sidebar ถ้ายังไม่มี
  if (!document.querySelector('[data-page="delivery"]')) {
    const historyNav = document.querySelector('[data-page="history"]');
    if (historyNav) {
      const deliveryNav = document.createElement('a');
      deliveryNav.className = 'nav-item';
      deliveryNav.setAttribute('data-page', 'delivery');
      deliveryNav.innerHTML = `
        <i class="material-icons-round">local_shipping</i>
        <span>คิวจัดส่ง</span>
        <span id="delivery-count-badge" class="nav-badge hidden" style="
          background:#8b5cf6;color:#fff;border-radius:50px;padding:1px 7px;
          font-size:11px;font-weight:700;min-width:18px;text-align:center;
          margin-left:auto;
        ">0</span>
      `;
      historyNav.parentNode.insertBefore(deliveryNav, historyNav);

      // ผูก click event
      deliveryNav.addEventListener('click', () => {
        if (typeof go === 'function') go('delivery');
      });
    }
  }
})();

/* ──────────────────────────────────────────────────────────────
   INJECT STYLES
────────────────────────────────────────────────────────────── */
(function injectV12Styles() {
  if (document.getElementById('v12-styles')) return;
  const style = document.createElement('style');
  style.id = 'v12-styles';
  style.textContent = `
/* ═══════════════════════════════════════════
   V12 CHECKOUT — Split Layout
═══════════════════════════════════════════ */
.v12-checkout-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(10,12,20,.72);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  animation: v12FadeIn .2s ease;
}
@keyframes v12FadeIn { from{opacity:0} to{opacity:1} }

.v12-checkout-shell {
  width: min(1100px, 96vw);
  height: min(700px, 92vh);
  background: var(--bg-primary, #fff);
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(0,0,0,.28);
  display: flex;
  overflow: hidden;
}

/* LEFT PANEL */
.v12-left {
  width: 38%;
  min-width: 280px;
  background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
  color: #fff;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.v12-left-header {
  padding: 20px 22px 14px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.v12-left-header h3 {
  font-size: 14px; font-weight: 600; letter-spacing: .5px;
  color: rgba(255,255,255,.6); text-transform: uppercase;
  margin: 0 0 2px;
}
.v12-left-header .v12-bill-no {
  font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px;
}
.v12-cart-list {
  flex: 1; overflow-y: auto; padding: 12px 16px;
}
.v12-cart-list::-webkit-scrollbar { width: 4px; }
.v12-cart-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 4px; }
.v12-cart-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; margin-bottom: 5px;
  background: rgba(255,255,255,.05);
  transition: background .15s;
}
.v12-cart-item:hover { background: rgba(255,255,255,.09); }
.v12-item-name {
  flex: 1; font-size: 13px; font-weight: 500; color: #e2e8f0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.v12-item-qty {
  font-size: 12px; color: rgba(255,255,255,.45);
  white-space: nowrap;
}
.v12-item-price {
  font-size: 13px; font-weight: 700; color: #a5f3fc;
  white-space: nowrap;
}
.v12-left-footer {
  padding: 14px 20px 20px;
  border-top: 1px solid rgba(255,255,255,.08);
}
.v12-summary-row {
  display: flex; justify-content: space-between;
  font-size: 13px; color: rgba(255,255,255,.55);
  margin-bottom: 6px;
}
.v12-summary-row.total {
  font-size: 26px; font-weight: 800; color: #fff;
  margin-top: 10px; letter-spacing: -0.5px;
}
.v12-summary-row.total span:first-child { font-size: 13px; font-weight: 500; color: rgba(255,255,255,.5); align-self: flex-end; margin-bottom: 4px; }
.v12-deposit-badge {
  display: inline-block; margin-top: 8px;
  background: rgba(251,191,36,.15); color: #fbbf24;
  border: 1px solid rgba(251,191,36,.3);
  border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 600;
}

/* RIGHT PANEL */
.v12-right {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.v12-right-header {
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  display: flex; align-items: center; justify-content: space-between;
}
.v12-steps-bar {
  display: flex; align-items: center; gap: 0;
}
.v12-step-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 20px;
  font-size: 12px; font-weight: 600; color: var(--text-muted, #9ca3af);
  transition: all .2s; white-space: nowrap;
}
.v12-step-pill.active {
  background: var(--primary-50, #eff6ff); color: var(--primary, #3b82f6);
}
.v12-step-pill.done {
  color: #10b981;
}
.v12-step-pill .pill-num {
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  background: rgba(0,0,0,.06);
}
.v12-step-pill.active .pill-num { background: var(--primary, #3b82f6); color: #fff; }
.v12-step-pill.done .pill-num { background: #10b981; color: #fff; }
.v12-step-connector { width: 24px; height: 2px; background: var(--border, #e5e7eb); margin: 0 2px; border-radius: 2px; }
.v12-step-connector.done { background: #10b981; }

.v12-right-body {
  flex: 1; overflow-y: auto; padding: 24px 28px;
}
.v12-right-body::-webkit-scrollbar { width: 5px; }
.v12-right-body::-webkit-scrollbar-thumb { background: var(--border, #e5e7eb); border-radius: 4px; }
.v12-right-footer {
  padding: 14px 24px;
  border-top: 1px solid var(--border, #e5e7eb);
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
}
.v12-btn-close {
  background: none; border: 1.5px solid var(--border, #d1d5db);
  border-radius: 10px; padding: 10px 18px;
  font-size: 14px; font-weight: 600; color: var(--text-muted, #6b7280);
  cursor: pointer; display: flex; align-items: center; gap: 6px;
  transition: all .15s;
}
.v12-btn-close:hover { border-color: #ef4444; color: #ef4444; }
.v12-btn-back {
  background: none; border: 1.5px solid var(--border, #d1d5db);
  border-radius: 10px; padding: 10px 18px;
  font-size: 14px; font-weight: 600; color: var(--text-secondary, #374151);
  cursor: pointer; display: flex; align-items: center; gap: 6px;
  transition: all .15s;
}
.v12-btn-back:hover { border-color: var(--primary, #3b82f6); color: var(--primary, #3b82f6); }
.v12-btn-next {
  flex: 1; max-width: 260px; margin-left: auto;
  background: var(--primary, #3b82f6); color: #fff;
  border: none; border-radius: 10px; padding: 12px 22px;
  font-size: 15px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all .15s; box-shadow: 0 4px 14px rgba(59,130,246,.3);
}
.v12-btn-next:hover { background: #2563eb; }
.v12-btn-next.green { background: #10b981; box-shadow: 0 4px 14px rgba(16,185,129,.3); }
.v12-btn-next.green:hover { background: #059669; }
.v12-btn-next:disabled { opacity: .5; cursor: not-allowed; }

/* STEP CONTENT */
.v12-step-title {
  font-size: 20px; font-weight: 800; color: var(--text-primary, #111827);
  margin: 0 0 4px; letter-spacing: -0.3px;
}
.v12-step-subtitle {
  font-size: 13px; color: var(--text-muted, #9ca3af);
  margin: 0 0 22px;
}

/* Customer type cards */
.v12-cust-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 16px; }
.v12-cust-card {
  border: 2px solid var(--border, #e5e7eb); border-radius: 14px;
  padding: 18px 14px; cursor: pointer; text-align: center;
  transition: all .18s; background: var(--bg-primary, #fff);
}
.v12-cust-card:hover { border-color: var(--primary, #3b82f6); }
.v12-cust-card.selected {
  border-color: var(--primary, #3b82f6);
  background: var(--primary-50, #eff6ff);
  box-shadow: 0 0 0 3px rgba(59,130,246,.12);
}
.v12-cust-card i { font-size: 28px; color: var(--text-muted, #9ca3af); margin-bottom: 8px; display: block; }
.v12-cust-card.selected i { color: var(--primary, #3b82f6); }
.v12-cust-card h4 { font-size: 14px; font-weight: 700; margin: 0 0 3px; }
.v12-cust-card p { font-size: 11px; color: var(--text-muted, #9ca3af); margin: 0; }
.v12-cust-search { margin-top: 14px; }

/* Delivery mode */
.v12-delivery-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 18px; }
.v12-delivery-card {
  border: 2px solid var(--border, #e5e7eb); border-radius: 14px;
  padding: 16px 12px; cursor: pointer; text-align: center;
  transition: all .18s;
}
.v12-delivery-card:hover { border-color: #8b5cf6; }
.v12-delivery-card.selected {
  border-color: #8b5cf6; background: #f5f3ff;
  box-shadow: 0 0 0 3px rgba(139,92,246,.12);
}
.v12-delivery-card i { font-size: 26px; color: var(--text-muted,#9ca3af); margin-bottom: 8px; display: block; }
.v12-delivery-card.selected i { color: #8b5cf6; }
.v12-delivery-card h4 { font-size: 13px; font-weight: 700; margin: 0 0 3px; }
.v12-delivery-card p { font-size: 11px; color: var(--text-muted,#9ca3af); margin: 0; }
.v12-delivery-form {
  background: var(--bg-secondary, #f9fafb); border-radius: 14px;
  padding: 18px; margin-top: 4px;
  border: 1px solid var(--border, #e5e7eb);
}
.v12-delivery-form h4 { font-size: 13px; font-weight: 700; margin: 0 0 14px; color: var(--text-secondary,#374151); }
.v12-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.v12-form-group { display: flex; flex-direction: column; gap: 5px; }
.v12-form-group label { font-size: 12px; font-weight: 600; color: var(--text-secondary,#374151); }
.v12-form-group input, .v12-form-group textarea, .v12-form-group select {
  border: 1.5px solid var(--border,#d1d5db); border-radius: 8px;
  padding: 9px 12px; font-size: 13px; font-family: inherit;
  background: var(--bg-primary,#fff); color: var(--text-primary,#111827);
  transition: border .15s;
}
.v12-form-group input:focus, .v12-form-group textarea:focus, .v12-form-group select:focus {
  outline: none; border-color: var(--primary,#3b82f6);
  box-shadow: 0 0 0 3px rgba(59,130,246,.1);
}
.v12-form-group textarea { resize: vertical; min-height: 60px; }

/* Payment type */
.v12-pay-type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
.v12-pay-type-card {
  border: 2px solid var(--border,#e5e7eb); border-radius: 14px;
  padding: 18px 16px; cursor: pointer; transition: all .18s;
}
.v12-pay-type-card:hover { border-color: #f59e0b; }
.v12-pay-type-card.selected { border-color: #f59e0b; background: #fffbeb; box-shadow: 0 0 0 3px rgba(245,158,11,.12); }
.v12-pay-type-card i { font-size: 24px; color: var(--text-muted,#9ca3af); margin-bottom: 6px; display: block; }
.v12-pay-type-card.selected i { color: #f59e0b; }
.v12-pay-type-card h4 { font-size: 14px; font-weight: 700; margin: 0 0 3px; }
.v12-pay-type-card p { font-size: 12px; color: var(--text-muted,#9ca3af); margin: 0; }
.v12-deposit-box {
  background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px;
  padding: 16px; margin-top: 4px;
}
.v12-deposit-box label { font-size: 12px; font-weight: 600; color: #92400e; display: block; margin-bottom: 6px; }
.v12-deposit-big-input {
  width: 100%; border: 2px solid #f59e0b; border-radius: 10px;
  padding: 12px 16px; font-size: 20px; font-weight: 800;
  background: #fff; color: #111827; text-align: right;
  font-family: inherit; box-sizing: border-box;
}
.v12-deposit-big-input:focus { outline: none; border-color: #d97706; box-shadow: 0 0 0 3px rgba(245,158,11,.15); }
.v12-deposit-remaining {
  display: flex; justify-content: space-between;
  margin-top: 10px; font-size: 13px;
}

/* Payment Method */
.v12-method-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
.v12-method-card {
  border: 2px solid var(--border,#e5e7eb); border-radius: 14px;
  padding: 20px 12px; cursor: pointer; text-align: center; transition: all .18s;
}
.v12-method-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.08); }
.v12-method-card.selected { border-color: #10b981; background: #f0fdf4; box-shadow: 0 0 0 3px rgba(16,185,129,.12); }
.v12-method-card i { font-size: 30px; color: var(--text-muted,#9ca3af); margin-bottom: 10px; display: block; }
.v12-method-card.selected i { color: #10b981; }
.v12-method-card h4 { font-size: 14px; font-weight: 700; margin: 0 0 3px; }
.v12-method-card p { font-size: 11px; color: var(--text-muted,#9ca3af); margin: 0; }
.v12-qr-box {
  margin-top: 18px; background: var(--bg-secondary,#f9fafb);
  border-radius: 14px; padding: 18px; text-align: center;
  border: 1.5px dashed var(--border,#d1d5db);
}
.v12-qr-box p { font-size: 13px; color: var(--text-muted,#9ca3af); margin: 8px 0 0; }

/* Cash handling — ระบบนับแบงค์ */
.v12-cash-header {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--bg-secondary,#f9fafb); border-radius: 14px;
  padding: 14px 18px; margin-bottom: 18px;
}
.v12-cash-header .label { font-size: 13px; color: var(--text-muted,#9ca3af); }
.v12-cash-header .amount { font-size: 26px; font-weight: 800; color: var(--text-primary,#111827); letter-spacing: -0.5px; }
.v12-denom-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
.v12-denom-btn {
  border: 2px solid var(--border,#e5e7eb); border-radius: 12px;
  padding: 10px 8px; background: var(--bg-primary,#fff);
  cursor: pointer; transition: all .15s; position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  user-select: none;
}
.v12-denom-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }
.v12-denom-btn:active { transform: scale(0.96); }
.v12-denom-swatch { width: 36px; height: 20px; border-radius: 4px; }
.v12-denom-label { font-size: 12px; font-weight: 700; }
.v12-denom-count {
  position: absolute; top: -6px; right: -6px;
  background: var(--primary,#3b82f6); color: #fff;
  border-radius: 12px; padding: 1px 7px; font-size: 11px; font-weight: 700;
  min-width: 20px; text-align: center;
  display: none;
}
.v12-denom-count.show { display: block; }
.v12-received-bar {
  margin-top: 14px; background: var(--bg-secondary,#f9fafb);
  border-radius: 12px; padding: 12px 16px;
  display: flex; justify-content: space-between; align-items: center;
}
.v12-quick-amounts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.v12-quick-btn {
  border: 1.5px solid var(--border,#d1d5db); border-radius: 8px;
  padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
  background: var(--bg-primary,#fff); transition: all .15s;
  color: var(--text-secondary,#374151);
}
.v12-quick-btn:hover { border-color: var(--primary,#3b82f6); color: var(--primary,#3b82f6); }

/* Change breakdown */
.v12-change-breakdown {
  margin-top: 10px; background: #f0fdf4; border: 1px solid #86efac;
  border-radius: 10px; padding: 10px 14px;
}
.v12-change-breakdown-title {
  font-size: 12px; font-weight: 600; color: #15803d; margin-bottom: 6px;
}
.v12-change-denom-list {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.v12-change-denom-chip {
  background: #dcfce7; border-radius: 6px; padding: 3px 10px;
  font-size: 12px; font-weight: 600; color: #166534;
}

/* Complete step */
.v12-complete-box {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border: 1.5px solid #86efac; border-radius: 16px;
  padding: 28px; text-align: center; margin-bottom: 20px;
}
.v12-complete-box i { font-size: 52px; color: #10b981; }
.v12-complete-box h3 { font-size: 20px; font-weight: 800; margin: 8px 0 4px; }
.v12-complete-box p { font-size: 13px; color: #4b7c5f; margin: 0; }
.v12-summary-table { width: 100%; border-collapse: collapse; }
.v12-summary-table td {
  padding: 8px 4px; font-size: 13px;
  border-bottom: 1px solid var(--border,#f3f4f6);
}
.v12-summary-table td:last-child { text-align: right; font-weight: 600; }
.v12-print-options {
  display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px;
}
.v12-print-btn {
  flex: 1; min-width: 120px; border: 1.5px solid var(--border,#d1d5db);
  border-radius: 10px; padding: 10px 16px; cursor: pointer;
  background: var(--bg-primary,#fff); font-size: 13px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all .15s;
}
.v12-print-btn:hover { border-color: var(--primary,#3b82f6); color: var(--primary,#3b82f6); }
.v12-print-btn.primary { background: var(--primary,#3b82f6); color: #fff; border-color: transparent; }
.v12-print-btn.primary:hover { background: #2563eb; }
.v12-delivery-notice {
  background: #fffbeb; border: 1px solid #fde68a;
  border-radius: 10px; padding: 10px 14px;
  font-size: 12px; color: #92400e; margin-top: 10px;
  display: flex; align-items: flex-start; gap: 8px;
}

/* ═══════════════════════════════════════════
   V12 DELIVERY QUEUE
═══════════════════════════════════════════ */
.v12-dq-container { padding: 0; }
.v12-dq-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
}
.v12-dq-title { font-size: 22px; font-weight: 800; color: var(--text-primary,#111827); }
.v12-filter-pills { display: flex; gap: 8px; }
.v12-pill {
  padding: 7px 18px; border-radius: 50px; font-size: 13px; font-weight: 600;
  border: 2px solid var(--border,#e5e7eb); cursor: pointer;
  background: var(--bg-primary,#fff); color: var(--text-muted,#6b7280);
  transition: all .15s;
}
.v12-pill.active {
  background: #8b5cf6; color: #fff; border-color: #8b5cf6;
  box-shadow: 0 4px 12px rgba(139,92,246,.25);
}
.v12-pill:hover:not(.active) { border-color: #8b5cf6; color: #8b5cf6; }
.v12-dq-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 20px; }
.v12-dq-stat {
  background: var(--bg-primary,#fff); border: 1px solid var(--border,#e5e7eb);
  border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 4px;
}
.v12-dq-stat-val { font-size: 24px; font-weight: 800; }
.v12-dq-stat-lbl { font-size: 12px; color: var(--text-muted,#9ca3af); }
.v12-dq-cards { display: flex; flex-direction: column; gap: 10px; }
.v12-dq-card {
  background: var(--bg-primary,#fff); border: 1px solid var(--border,#e5e7eb);
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,.04); transition: all .25s;
}
.v12-dq-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,.08); }
.v12-dq-card-header {
  padding: 14px 18px; display: flex; align-items: center; gap: 12px;
  border-bottom: 1px solid var(--border,#f3f4f6);
}
.v12-dq-bill-badge {
  background: #8b5cf6; color: #fff;
  border-radius: 8px; padding: 4px 10px; font-size: 13px; font-weight: 700;
}
.v12-dq-customer { flex: 1; }
.v12-dq-customer strong { font-size: 14px; display: block; }
.v12-dq-customer span { font-size: 12px; color: var(--text-muted,#9ca3af); }
.v12-dq-date-badge {
  padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
}
.v12-dq-date-badge.today { background: #fef3c7; color: #92400e; }
.v12-dq-date-badge.tomorrow { background: #ede9fe; color: #5b21b6; }
.v12-dq-date-badge.overdue { background: #fee2e2; color: #991b1b; }
.v12-dq-date-badge.other { background: #f0f9ff; color: #0369a1; }
.v12-dq-card-body { padding: 12px 18px; }
.v12-dq-address {
  font-size: 12px; color: var(--text-muted,#6b7280); margin-bottom: 10px;
  display: flex; align-items: flex-start; gap: 6px;
}
.v12-dq-items { display: flex; flex-direction: column; gap: 4px; }
.v12-dq-item {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; padding: 4px 0;
  border-bottom: 1px dashed var(--border,#f3f4f6);
}
.v12-dq-item:last-child { border: none; }
.v12-dq-card-footer {
  padding: 10px 18px; background: var(--bg-secondary,#f9fafb);
  display: flex; gap: 8px; align-items: center; justify-content: flex-end;
}
.v12-dq-btn {
  padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: 1.5px solid var(--border,#d1d5db);
  display: flex; align-items: center; gap: 6px; transition: all .15s;
  background: var(--bg-primary,#fff);
}
.v12-dq-btn.print { color: #2563eb; border-color: #bfdbfe; }
.v12-dq-btn.print:hover { background: #eff6ff; }
.v12-dq-btn.done { background: #10b981; color: #fff; border-color: #10b981; box-shadow: 0 4px 12px rgba(16,185,129,.2); }
.v12-dq-btn.done:hover { background: #059669; }
.v12-dq-empty {
  text-align: center; padding: 60px 20px;
  color: var(--text-muted,#9ca3af);
}
.v12-dq-empty i { font-size: 52px; display: block; margin-bottom: 12px; }
.v12-dq-empty p { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
.v12-dq-empty span { font-size: 13px; }

/* ═══════════════════════════════════════════
   V12 BILL MANAGEMENT CENTER
═══════════════════════════════════════════ */
.v12-bmc-container { }
.v12-bmc-search-bar {
  display: flex; gap: 12px; align-items: center; margin-bottom: 20px; flex-wrap: wrap;
}
.v12-bmc-search {
  flex: 1; min-width: 200px;
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-primary,#fff); border: 1.5px solid var(--border,#d1d5db);
  border-radius: 10px; padding: 9px 14px;
}
.v12-bmc-search input {
  border: none; outline: none; background: transparent;
  font-size: 14px; color: var(--text-primary,#111827); flex: 1;
  font-family: inherit;
}
.v12-bmc-date {
  border: 1.5px solid var(--border,#d1d5db); border-radius: 10px;
  padding: 9px 14px; font-size: 14px; font-family: inherit;
  background: var(--bg-primary,#fff); color: var(--text-primary,#111827);
  cursor: pointer;
}
.v12-bmc-tabs {
  display: flex; gap: 4px; margin-bottom: 20px;
  border-bottom: 2px solid var(--border,#e5e7eb); padding-bottom: 0;
  overflow-x: auto;
}
.v12-bmc-tab {
  padding: 10px 18px; cursor: pointer; border-radius: 8px 8px 0 0;
  font-size: 13px; font-weight: 600; color: var(--text-muted,#9ca3af);
  display: flex; align-items: center; gap: 6px; transition: all .15s;
  border: none; background: none; margin-bottom: -2px;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.v12-bmc-tab:hover { color: var(--text-primary,#111827); }
.v12-bmc-tab.active { color: var(--primary,#3b82f6); border-bottom-color: var(--primary,#3b82f6); }
.v12-bmc-tab .tab-count {
  background: currentColor; color: #fff; border-radius: 50px;
  padding: 1px 7px; font-size: 11px; min-width: 20px; text-align: center;
  opacity: .85;
}
.v12-bmc-table-wrap {
  background: var(--bg-primary,#fff); border-radius: 14px;
  border: 1px solid var(--border,#e5e7eb); overflow: hidden;
}
.v12-bmc-table {
  width: 100%; border-collapse: collapse;
}
.v12-bmc-table thead tr {
  background: var(--bg-secondary,#f9fafb);
}
.v12-bmc-table th {
  padding: 11px 16px; text-align: left; font-size: 12px;
  font-weight: 700; color: var(--text-muted,#6b7280);
  text-transform: uppercase; letter-spacing: .5px;
  border-bottom: 1px solid var(--border,#e5e7eb);
}
.v12-bmc-table td {
  padding: 12px 16px; font-size: 13px;
  border-bottom: 1px solid var(--border,#f3f4f6);
  color: var(--text-primary,#111827);
}
.v12-bmc-table tbody tr:last-child td { border-bottom: none; }
.v12-bmc-table tbody tr:hover { background: var(--bg-secondary,#f9fafb); }
.v12-status-badge {
  padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
}
.v12-badge-green { background: #dcfce7; color: #15803d; }
.v12-badge-yellow { background: #fef9c3; color: #a16207; }
.v12-badge-orange { background: #ffedd5; color: #c2410c; }
.v12-badge-red { background: #fee2e2; color: #dc2626; }
.v12-badge-purple { background: #ede9fe; color: #7c3aed; }
.v12-badge-blue { background: #dbeafe; color: #1d4ed8; }
.v12-badge-gray { background: #f3f4f6; color: #4b5563; }
.v12-bmc-action-btn {
  padding: 5px 10px; border-radius: 7px; font-size: 12px; font-weight: 600;
  border: 1.5px solid var(--border,#d1d5db); cursor: pointer;
  background: var(--bg-primary,#fff); transition: all .12s;
  display: inline-flex; align-items: center; gap: 4px;
}
.v12-bmc-action-btn:hover { border-color: var(--primary,#3b82f6); color: var(--primary,#3b82f6); }
.v12-bmc-action-btn.danger:hover { border-color: #ef4444; color: #ef4444; }
.v12-bmc-empty {
  text-align: center; padding: 50px 20px;
  color: var(--text-muted,#9ca3af);
}
.v12-bmc-empty i { font-size: 44px; display: block; margin-bottom: 10px; }

/* Responsive */
@media (max-width: 768px) {
  .v12-checkout-shell { flex-direction: column; width: 98vw; height: 95vh; }
  .v12-left { width: 100%; height: 180px; min-width: unset; }
  .v12-cust-grid, .v12-delivery-grid, .v12-method-grid { grid-template-columns: 1fr 1fr; }
  .v12-pay-type-grid { grid-template-columns: 1fr; }
  .v12-denom-grid { grid-template-columns: repeat(3,1fr); }
  .v12-bmc-tabs { overflow-x: auto; }
  .v12-dq-stats { grid-template-columns: 1fr 1fr; }
  .v12-steps-bar { overflow-x: auto; }
  .v12-step-pill { padding: 4px 8px; font-size: 11px; }
}
`;
  document.head.appendChild(style);
})();

/* ──────────────────────────────────────────────────────────────
   SECTION 1: SPLIT-LAYOUT CHECKOUT (6 STEPS) + ระบบนับแบงค์
────────────────────────────────────────────────────────────── */

// Extended checkout state
let v12State = {
  step: 1,
  total: 0, discount: 0,
  customer: { type: 'general', id: null, name: 'ลูกค้าทั่วไป' },
  deliveryMode: 'self',
  deliveryDate: '',
  deliveryAddress: '',
  deliveryPhone: '',
  paymentType: 'full',
  depositAmount: 0,
  method: 'cash',
  received: 0, change: 0,
  receivedDenominations: {},
  changeDenominations: {},
  itemModes: {},
  savedBill: null,
};

/* Override startCheckout */
window.startCheckout = function () {
  if (!cart || cart.length === 0) {
    if (typeof toast === 'function') toast('ไม่มีสินค้าในตะกร้า', 'warning');
    return;
  }
  const discount = Number(document.getElementById('pos-discount')?.value || 0);
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const total = Math.max(0, subtotal - discount);

  v12State = {
    step: 1, total, discount,
    customer: { type: 'general', id: null, name: 'ลูกค้าทั่วไป' },
    deliveryMode: 'self', deliveryDate: '', deliveryAddress: '', deliveryPhone: '',
    paymentType: 'full', depositAmount: 0,
    method: 'cash', received: 0, change: 0,
    receivedDenominations: {}, changeDenominations: {},
    itemModes: {}, savedBill: null,
  };
  [...BILLS, ...COINS].forEach(d => {
    v12State.receivedDenominations[d.value] = 0;
    v12State.changeDenominations[d.value] = 0;
  });
  cart.forEach(item => {
    v12State.itemModes[item.id] = { take: item.qty, deliver: 0 };
  });

  v12RenderShell();
};

/* Override closeCheckout */
window.closeCheckout = function () {
  const el = document.getElementById('v12-checkout-overlay');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }
};

/* Keyboard shortcut: F10 = checkout, Esc = close */
document.addEventListener('keydown', function (e) {
  if (e.key === 'F10') {
    e.preventDefault();
    if (typeof startCheckout === 'function') startCheckout();
  }
  if (e.key === 'Escape') {
    const overlay = document.getElementById('v12-checkout-overlay');
    if (overlay) closeCheckout();
  }
});

function v12RenderShell() {
  let el = document.getElementById('v12-checkout-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'v12-checkout-overlay';
    el.className = 'v12-checkout-overlay';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="v12-checkout-shell">
      <div class="v12-left">
        <div class="v12-left-header">
          <h3>รายการในตะกร้า</h3>
          <div class="v12-bill-no">${cart.length} รายการ</div>
        </div>
        <div class="v12-cart-list">
          ${cart.map(item => `
            <div class="v12-cart-item">
              <span class="v12-item-name">${item.name}</span>
              <span class="v12-item-qty">×${item.qty}</span>
              <span class="v12-item-price">฿${formatNum(item.price * item.qty)}</span>
            </div>`).join('')}
        </div>
        <div class="v12-left-footer" id="v12-left-footer">
          ${v12LeftFooterHTML()}
        </div>
      </div>
      <div class="v12-right">
        <div class="v12-right-header">
          <div class="v12-steps-bar" id="v12-steps-bar"></div>
          <button onclick="closeCheckout()" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:8px;color:var(--text-muted,#9ca3af);font-size:20px;line-height:1;" title="ปิด">
            <i class="material-icons-round">close</i>
          </button>
        </div>
        <div class="v12-right-body" id="v12-step-body"></div>
        <div class="v12-right-footer">
          <button class="v12-btn-close" onclick="closeCheckout()">
            <i class="material-icons-round">close</i> ยกเลิก
          </button>
          <button class="v12-btn-back" id="v12-back-btn" style="display:none" onclick="v12PrevStep()">
            <i class="material-icons-round">arrow_back</i> ย้อนกลับ
          </button>
          <button class="v12-btn-next" id="v12-next-btn" onclick="v12NextStep()">
            ถัดไป <i class="material-icons-round">arrow_forward</i>
          </button>
        </div>
      </div>
    </div>`;
  v12UpdateStepBar();
  v12RenderStepBody();
}

function v12LeftFooterHTML() {
  let html = '';
  if (v12State.discount > 0) {
    html += `<div class="v12-summary-row"><span>ราคารวม</span><span>฿${formatNum(cart.reduce((s,c)=>s+c.price*c.qty,0))}</span></div>`;
    html += `<div class="v12-summary-row"><span>ส่วนลด</span><span style="color:#ef4444">-฿${formatNum(v12State.discount)}</span></div>`;
  }
  html += `<div class="v12-summary-row total"><span>ยอดสุทธิ</span><span>฿${formatNum(v12State.total)}</span></div>`;
  if (v12State.paymentType === 'deposit' && v12State.depositAmount > 0) {
    html += `<div class="v12-deposit-badge">มัดจำ ฿${formatNum(v12State.depositAmount)} | ค้าง ฿${formatNum(v12State.total - v12State.depositAmount)}</div>`;
  }
  return html;
}

/* ── Step Bar ── */
function v12NeedsStepCash() { return v12State.method === 'cash'; }
function v12GetMaxStep() { return v12NeedsStepCash() ? 6 : 5; }
function v12IsLastStep() { return v12State.step === v12GetMaxStep(); }

function v12UpdateStepBar() {
  const bar = document.getElementById('v12-steps-bar');
  if (!bar) return;
  const labels = v12NeedsStepCash()
    ? ['ลูกค้า','รูปแบบรับ','ชำระเงิน','วิธีชำระ','รับเงิน','บันทึก']
    : ['ลูกค้า','รูปแบบรับ','ชำระเงิน','วิธีชำระ','บันทึก'];

  bar.innerHTML = labels.map((lbl, i) => {
    const n = i + 1;
    const cls = n === v12State.step ? 'active' : n < v12State.step ? 'done' : '';
    const connCls = n < v12State.step ? 'done' : '';
    return `<div class="v12-step-pill ${cls}">
      <span class="pill-num">${n < v12State.step ? '<i class="material-icons-round" style="font-size:11px">check</i>' : n}</span>
      ${lbl}
    </div>${n < labels.length ? `<div class="v12-step-connector ${connCls}"></div>` : ''}`;
  }).join('');
}

function v12RenderStepBody() {
  const body = document.getElementById('v12-step-body');
  if (!body) return;
  const backBtn = document.getElementById('v12-back-btn');
  const nextBtn = document.getElementById('v12-next-btn');
  if (backBtn) backBtn.style.display = v12State.step > 1 ? 'flex' : 'none';

  if (nextBtn) {
    if (v12IsLastStep() && v12State.savedBill) {
      if (backBtn) {
        backBtn.style.display = 'flex';
        backBtn.innerHTML = `<i class="material-icons-round">done_all</i> เสร็จสิ้น`;
        backBtn.className = 'v12-btn-next green'; // Reuse next class for premium feel
        backBtn.onclick = () => closeCheckout();
      }
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'flex';
      if (backBtn) {
        backBtn.innerHTML = `<i class="material-icons-round">arrow_back</i> ย้อนกลับ`;
        backBtn.className = 'v12-btn-back';
        backBtn.onclick = () => v12PrevStep();
      }
      // Step ก่อนสุดท้าย = ปุ่มยืนยัน
      const confirmStep = v12NeedsStepCash() ? 5 : 4;
      if (v12State.step === confirmStep) {
        nextBtn.innerHTML = `<i class="material-icons-round">check</i> ยืนยันการขาย`;
        nextBtn.className = 'v12-btn-next green';
      } else {
        nextBtn.innerHTML = `ถัดไป <i class="material-icons-round">arrow_forward</i>`;
        nextBtn.className = 'v12-btn-next';
      }
    }
  }

  // Map step → render function
  let renderFn;
  if (!v12NeedsStepCash()) {
    // non-cash: 1,2,3,4,5 → S1,S2,S3,S4,S6(complete)
    const map = [null, v12S1, v12S2, v12S3, v12S4, v12S6];
    renderFn = map[v12State.step];
  } else {
    // cash: 1,2,3,4,5,6 → S1,S2,S3,S4,S5(cash),S6(complete)
    const map = [null, v12S1, v12S2, v12S3, v12S4, v12S5, v12S6];
    renderFn = map[v12State.step];
  }
  if (renderFn) renderFn(body);
}

/* ── Navigation ── */
function v12NextStep() {
  const t = typeof toast === 'function' ? toast : (m) => alert(m);

  // Validate step 1: ลูกค้า
  if (v12State.step === 1) {
    // ถ้ามีจัดส่งหรือมัดจำ ต้องมีข้อมูลลูกค้า — แต่ตรวจตอน step 2/3 ดีกว่า
  }
  // Validate step 2: delivery
  if (v12State.step === 2) {
    if ((v12State.deliveryMode === 'deliver' || v12State.deliveryMode === 'partial') && !v12State.deliveryDate) {
      t('กรุณาระบุวันที่นัดส่ง', 'warning'); return;
    }
    if ((v12State.deliveryMode === 'deliver' || v12State.deliveryMode === 'partial') && v12State.customer.type === 'general') {
      t('บิลจัดส่งต้องระบุลูกค้า กรุณาย้อนกลับเลือกลูกค้า', 'warning'); return;
    }
  }
  // Validate step 3: deposit
  if (v12State.step === 3) {
    if (v12State.paymentType === 'deposit') {
      const dep = Number(document.getElementById('v12-deposit-input')?.value || 0);
      if (!dep || dep <= 0) { t('กรุณาระบุยอดมัดจำ', 'warning'); return; }
      if (dep >= v12State.total) { t('ยอดมัดจำต้องน้อยกว่ายอดรวม', 'warning'); return; }
      v12State.depositAmount = dep;
      if (v12State.customer.type === 'general') {
        t('บิลมัดจำต้องระบุลูกค้า กรุณาย้อนกลับเลือกลูกค้า', 'warning'); return;
      }
    }
  }
  // Validate step 4: method
  if (v12State.step === 4) {
    if (!v12State.method) { t('กรุณาเลือกวิธีชำระเงิน', 'warning'); return; }
  }
  // Validate step 5 (cash): denomination
  if (v12NeedsStepCash() && v12State.step === 5) {
    const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    const received = Object.entries(v12State.receivedDenominations).reduce((s, [v, c]) => s + Number(v) * c, 0);
    if (received < payAmt) { t('ยอดรับเงินไม่เพียงพอ', 'error'); return; }
    v12State.received = received;
    v12State.change = received - payAmt;
    v12State.changeDenominations = calcChangeDenominations(v12State.change);
  }

  // Non-cash: step 4 → complete (step 5)
  if (!v12NeedsStepCash() && v12State.step === 4) {
    v12State.received = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    v12State.change = 0;
    v12State.step = 5;
    v12CompletePayment();
    return;
  }
  // Cash: step 5 → complete (step 6)
  if (v12NeedsStepCash() && v12State.step === 5) {
    v12State.step = 6;
    v12CompletePayment();
    return;
  }

  v12State.step++;
  v12UpdateUI();
}

function v12PrevStep() {
  if (v12State.step === 4 && v12State.customer.type === 'general') {
    v12State.step = 1;
  } else if (v12State.step > 1) {
    v12State.step--;
  }
  v12UpdateUI();
}

function v12UpdateUI() {
  v12UpdateStepBar();
  v12RenderStepBody();
  const leftFooter = document.getElementById('v12-left-footer');
  if (leftFooter) leftFooter.innerHTML = v12LeftFooterHTML();
}

/* ══════════════════════════════════════════════════════
   STEP 1: เลือกลูกค้า
══════════════════════════════════════════════════════ */
function v12S1(container) {
  container.innerHTML = `
    <h2 class="v12-step-title">เลือกลูกค้า</h2>
    <p class="v12-step-subtitle">หากบิลมีการจัดส่งหรือมัดจำ ต้องระบุข้อมูลลูกค้า</p>
    <div class="v12-cust-grid">
      <div class="v12-cust-card ${v12State.customer.type === 'general' ? 'selected' : ''}" onclick="v12SelectCustType('general')">
        <i class="material-icons-round">person</i>
        <h4>ลูกค้าทั่วไป</h4>
        <p>ไม่ระบุข้อมูล</p>
      </div>
      <div class="v12-cust-card ${v12State.customer.type === 'member' ? 'selected' : ''}" onclick="v12SelectCustType('member')">
        <i class="material-icons-round">star</i>
        <h4>ลูกค้าประจำ</h4>
        <p>เลือกจากรายชื่อ</p>
      </div>
      <div class="v12-cust-card ${v12State.customer.type === 'new' ? 'selected' : ''}" onclick="v12SelectCustType('new')">
        <i class="material-icons-round">person_add</i>
        <h4>ลูกค้าใหม่</h4>
        <p>สร้างข้อมูลใหม่</p>
      </div>
    </div>
    <div id="v12-cust-form"></div>`;
  v12RenderCustForm(container.querySelector('#v12-cust-form'));
}

window.v12SelectCustType = function (type) {
  v12State.customer.type = type;
  if (type === 'general') { 
    v12State.customer.id = null; 
    v12State.customer.name = 'ลูกค้าทั่วไป'; 
    v12State.customer.phone = '';
    v12State.customer.address = '';
    // Shortcut for general customer: Skip to Payment Method (Step 4)
    v12State.deliveryMode = 'self';
    v12State.paymentType = 'full';
    v12State.step = 4;
    v12UpdateUI();
    return;
  }
  document.querySelectorAll('.v12-cust-card').forEach((c, i) => {
    const types = ['general', 'member', 'new'];
    c.classList.toggle('selected', types[i] === type);
  });
  v12RenderCustForm(document.getElementById('v12-cust-form'));
};

function v12RenderCustForm(container) {
  if (!container) return;
  if (v12State.customer.type === 'member') {
    const isSelected = v12State.customer.id !== null;
    container.innerHTML = `
      <div class="v12-cust-search" style="animation: v12FadeIn 0.3s ease;">
        <div class="v12-form-group">
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>ค้นหาลูกค้าประจำ</span>
            ${isSelected ? '<span style="font-size:11px; color:#10b981; font-weight:700;">✓ เลือกแล้ว</span>' : ''}
          </label>
          <div style="position:relative;">
            <input type="text" id="v12-cust-search-input" placeholder="พิมพ์ชื่อหรือเบอร์โทร..." 
              oninput="v12SearchCustomers(this.value)"
              value="${isSelected ? v12State.customer.name : ''}"
              style="border:1.5px solid ${isSelected ? '#10b981' : 'var(--border,#d1d5db)'}; border-radius:10px; padding:12px 14px 12px 40px; font-size:14px; font-family:inherit; width:100%; box-sizing:border-box; transition:all 0.2s;">
            <i class="material-icons-round" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:${isSelected ? '#10b981' : 'var(--text-muted,#9ca3af)'}; font-size:20px;">search</i>
          </div>
        </div>
        <div id="v12-cust-results" style="margin-top:10px; max-height:220px; overflow-y:auto; border-radius:10px;"></div>
        ${isSelected ? `
          <div style="margin-top:12px; background:#f0fdf4; border:1px solid #86efac; border-radius:12px; padding:12px 16px; display:flex; align-items:center; gap:10px;">
            <div style="width:32px; height:32px; border-radius:50%; background:#dcfce7; color:#10b981; display:flex; align-items:center; justify-content:center;">
              <i class="material-icons-round" style="font-size:20px">check</i>
            </div>
            <div style="flex:1">
              <div style="font-size:11px; color:#15803d; text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">ลูกค้าที่เลือก</div>
              <div style="font-size:14px; font-weight:700; color:#14532d;">${v12State.customer.name}</div>
            </div>
            <button onclick="v12SelectCustType('member')" title="เปลี่ยน" style="background:none; border:none; color:#10b981; cursor:pointer;"><i class="material-icons-round">edit</i></button>
          </div>` : ''}
      </div>`;
    // Trigger initial search if empty to show some results
    if (!isSelected) {
      setTimeout(() => v12SearchCustomers(''), 50);
    }
  } else if (v12State.customer.type === 'new') {
    container.innerHTML = `
      <div class="v12-cust-search" style="animation: v12FadeIn 0.3s ease; padding-bottom: 20px;">
        <div class="v12-form-row">
          <div class="v12-form-group">
            <label>ชื่อลูกค้า <span style="color:#ef4444">*</span></label>
            <input type="text" id="v12-new-cust-name" placeholder="ชื่อ-นามสกุล" value="${v12State.customer.name !== 'ลูกค้าทั่วไป' ? v12State.customer.name : ''}">
          </div>
          <div class="v12-form-group">
            <label>เบอร์โทร</label>
            <input type="tel" id="v12-new-cust-phone" placeholder="0XX-XXX-XXXX">
          </div>
        </div>
        <div class="v12-form-group" style="margin-top:12px;">
          <label>ที่อยู่จัดส่ง <span style="color:#ef4444">*</span></label>
          <textarea id="v12-new-cust-address" rows="3" placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
            style="border:1.5px solid var(--border,#d1d5db);border-radius:10px;padding:12px;font-size:14px;font-family:inherit;width:100%;box-sizing:border-box;min-height:80px;"></textarea>
        </div>
        <button onclick="v12SaveNewCustomer()" class="v12-print-btn primary" style="margin-top:14px;width:auto;padding:10px 24px;border-radius:10px;box-shadow:0 4px 12px rgba(59,130,246,0.2);">
          <i class="material-icons-round" style="font-size:16px">save</i> บันทึกลูกค้าใหม่
        </button>
        ${v12State.customer.id ? `<div style="margin-top:12px;font-size:13px;color:#10b981;font-weight:600;display:flex;align-items:center;gap:6px;">
          <i class="material-icons-round" style="font-size:16px">check_circle</i> บันทึกแล้ว: ${v12State.customer.name}
        </div>` : ''}
      </div>`;
  } else {
    container.innerHTML = '';
  }
}

window.v12SearchCustomers = async function (q) {
  const res = document.getElementById('v12-cust-results');
  if (!res) return;
  
  if (!q || q.length === 0) {
    // Show recent/top customers if empty query
    try {
      res.innerHTML = '<div style="padding:10px; text-align:center; color:var(--text-muted); font-size:12px;">กำลังโหลดรายชื่อลูกค้า...</div>';
      const { data } = await db.from('customer').select('id, name, phone, address').order('total_purchase', { ascending: false }).limit(6);
      v12RenderCustomerResults(data || []);
    } catch(e) { console.error(e); }
    return;
  }

  res.innerHTML = '<div style="padding:10px; text-align:center; color:var(--text-muted); font-size:12px;">กำลังค้นหา...</div>';
  try {
    const { data } = await db.from('customer').select('id, name, phone, address').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(10);
    v12RenderCustomerResults(data || []);
  } catch(e) { console.error(e); }
};

function v12RenderCustomerResults(data) {
  const res = document.getElementById('v12-cust-results');
  if (!res) return;
  if (!data || data.length === 0) {
    res.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">ไม่พบข้อมูลลูกค้า</div>';
    return;
  }
  res.innerHTML = data.map(c => {
    const isSelected = v12State.customer.id === c.id;
    return `
      <div onclick="v12PickCustomer('${c.id}','${(c.name||'').replace(/'/g,"\\'")}','${c.phone||''}','${(c.address||'').replace(/'/g,"\\'").replace(/\n/g," ")}')"
        style="padding:12px 14px; border-radius:10px; cursor:pointer; font-size:13px; transition:all 0.15s; margin-bottom:4px; border:1.5px solid ${isSelected ? '#10b981' : 'transparent'}; background:${isSelected ? '#f0fdf4' : 'var(--bg-secondary,#f9fafb)'}; display:flex; align-items:center; gap:10px;"
        onmouseover="if(!${isSelected}) this.style.background='var(--bg-hover,#f3f4f6)'" onmouseout="if(!${isSelected}) this.style.background='var(--bg-secondary,#f9fafb)'"
      >
        <div style="width:36px; height:36px; border-radius:8px; background:${isSelected ? '#10b981' : 'var(--border,#e5e7eb)'}; color:#fff; display:flex; align-items:center; justify-content:center;">
          <i class="material-icons-round" style="font-size:20px">${isSelected ? 'check' : 'person'}</i>
        </div>
        <div style="flex:1">
          <div style="font-weight:700; color:var(--text-primary);">${c.name}</div>
          <div style="font-size:11px; color:var(--text-muted);">${c.phone || 'ไม่ระบุเบอร์'}</div>
        </div>
        ${c.address ? '<i class="material-icons-round" style="font-size:16px; color:#10b981;" title="มีที่อยู่">location_on</i>' : ''}
      </div>`;
  }).join('');
}

window.v12PickCustomer = function (id, name, phone, address) {
  v12State.customer.id = id;
  v12State.customer.name = name;
  v12State.customer.phone = phone || '';
  v12State.customer.address = address || '';
  v12RenderCustForm(document.getElementById('v12-cust-form'));
  toast(`เลือก "${name}" สำเร็จ`, 'success');
};

window.v12SaveNewCustomer = async function () {
  const name = document.getElementById('v12-new-cust-name')?.value?.trim();
  const phone = document.getElementById('v12-new-cust-phone')?.value?.trim();
  const address = document.getElementById('v12-new-cust-address')?.value?.trim();
  if (!name) { toast('กรุณากรอกชื่อลูกค้า', 'warning'); return; }
  if (!address) { toast('กรุณากรอกที่อยู่ลูกค้า', 'warning'); return; }
  try {
    const { data, error } = await db.from('customer').insert({ 
      name, 
      phone: phone || null, 
      address: address || null,
      total_purchase: 0, visit_count: 0, debt_amount: 0 
    }).select().single();
    if (error) throw error;
    v12State.customer.id = data.id;
    v12State.customer.name = data.name;
    v12State.customer.phone = data.phone || '';
    v12State.customer.address = data.address || '';
    toast(`บันทึกลูกค้า "${data.name}" สำเร็จ`, 'success');
    v12RenderCustForm(document.getElementById('v12-cust-form'));
  } catch(e) { toast('บันทึกลูกค้าไม่สำเร็จ: ' + e.message, 'error'); }
};

/* ══════════════════════════════════════════════════════
   STEP 2: รูปแบบรับสินค้า
══════════════════════════════════════════════════════ */
function v12S2(container) {
  const showForm = v12State.deliveryMode === 'deliver' || v12State.deliveryMode === 'partial';
  container.innerHTML = `
    <h2 class="v12-step-title">รูปแบบรับสินค้า</h2>
    <p class="v12-step-subtitle">เลือกว่าลูกค้าจะรับสินค้าอย่างไร</p>
    <div class="v12-delivery-grid">
      <div class="v12-delivery-card ${v12State.deliveryMode === 'self' ? 'selected' : ''}" onclick="v12SetDeliveryMode('self')">
        <i class="material-icons-round">storefront</i>
        <h4>รับเองทั้งหมด</h4>
        <p>ลูกค้ารับสินค้าที่ร้านทันที</p>
      </div>
      <div class="v12-delivery-card ${v12State.deliveryMode === 'deliver' ? 'selected' : ''}" onclick="v12SetDeliveryMode('deliver')">
        <i class="material-icons-round">local_shipping</i>
        <h4>ร้านไปส่ง</h4>
        <p>จัดส่งไปยังที่อยู่ลูกค้า</p>
      </div>
      <div class="v12-delivery-card ${v12State.deliveryMode === 'partial' ? 'selected' : ''}" onclick="v12SetDeliveryMode('partial')">
        <i class="material-icons-round">call_split</i>
        <h4>รับบางส่วน</h4>
        <p>รับบางรายการ ส่วนที่เหลือส่งทีหลัง</p>
      </div>
    </div>
    <div id="v12-delivery-form-area">${showForm ? v12DeliveryFormHTML() : ''}</div>
    ${v12State.deliveryMode === 'partial' ? v12PartialItemsHTML() : ''}`;

  if (showForm) {
    const dateIn = container.querySelector('#v12-d-date');
    const addrIn = container.querySelector('#v12-d-addr');
    const phoneIn = container.querySelector('#v12-d-phone');
    if (dateIn && v12State.deliveryDate) dateIn.value = v12State.deliveryDate;
    if (addrIn && v12State.deliveryAddress) addrIn.value = v12State.deliveryAddress;
    if (phoneIn && v12State.deliveryPhone) phoneIn.value = v12State.deliveryPhone;
  }
}

function v12DeliveryFormHTML() {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div class="v12-delivery-form">
      <h4>ข้อมูลการจัดส่ง</h4>
      <div class="v12-form-row">
        <div class="v12-form-group">
          <label>วันที่นัดส่ง *</label>
          <input type="date" id="v12-d-date" min="${today}" value="${v12State.deliveryDate || today}"
            onchange="v12State.deliveryDate=this.value">
        </div>
        <div class="v12-form-group">
          <label>เบอร์โทรติดต่อ</label>
          <input type="tel" id="v12-d-phone" placeholder="0XX-XXX-XXXX" value="${v12State.deliveryPhone || ''}"
            onchange="v12State.deliveryPhone=this.value">
        </div>
      </div>
      <div class="v12-form-group">
        <label>ที่อยู่จัดส่ง *</label>
        <textarea id="v12-d-addr" rows="2" placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
          oninput="v12State.deliveryAddress=this.value" 
          style="width:100%; border:1.5px solid var(--border,#d1d5db); border-radius:10px; padding:10px 12px; font-size:14px; font-family:inherit; resize:vertical;">${v12State.deliveryAddress}</textarea>
      </div>
    </div>`;
}

function v12PartialItemsHTML() {
  return `
    <div style="margin-top:16px;">
      <h4 style="font-size:13px;font-weight:700;margin:0 0 10px;color:var(--text-secondary,#374151);">กำหนดจำนวนรับเอง / ส่งทีหลัง</h4>
      ${cart.map(item => {
        const m = v12State.itemModes[item.id] || { take: item.qty, deliver: 0 };
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border,#f3f4f6);">
          <span style="flex:1;font-size:13px;font-weight:500">${item.name}</span>
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
            <label style="color:var(--text-muted,#9ca3af);">รับเอง:</label>
            <input type="number" min="0" max="${item.qty}" value="${m.take}"
              onchange="v12SetItemMode('${item.id}',this.value,'take',${item.qty})"
              style="width:60px;border:1.5px solid var(--border,#d1d5db);border-radius:6px;padding:4px 8px;font-size:13px;text-align:center;">
            <label style="color:#8b5cf6;">ส่งทีหลัง:</label>
            <input type="number" min="0" max="${item.qty}" value="${m.deliver}"
              onchange="v12SetItemMode('${item.id}',this.value,'deliver',${item.qty})"
              style="width:60px;border:1.5px solid var(--border,#d1d5db);border-radius:6px;padding:4px 8px;font-size:13px;text-align:center;">
            <span style="color:var(--text-muted,#9ca3af);">(รวม ${item.qty})</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

window.v12SetDeliveryMode = function (mode) {
  v12State.deliveryMode = mode;
  
  // Requirement 4: Auto-pull data from customer
  if (mode === 'deliver' || mode === 'partial') {
    if (v12State.customer.id || v12State.customer.type === 'new') {
      v12State.deliveryAddress = v12State.customer.address || '';
      v12State.deliveryPhone = v12State.customer.phone || '';
    }
  }

  cart.forEach(item => {
    if (mode === 'self') v12State.itemModes[item.id] = { take: item.qty, deliver: 0 };
    else if (mode === 'deliver') v12State.itemModes[item.id] = { take: 0, deliver: item.qty };
    else v12State.itemModes[item.id] = { take: Math.ceil(item.qty / 2), deliver: item.qty - Math.ceil(item.qty / 2) };
  });
  // Set default delivery date to today if not set
  if ((mode === 'deliver' || mode === 'partial') && !v12State.deliveryDate) {
    v12State.deliveryDate = new Date().toISOString().split('T')[0];
  }
  const body = document.getElementById('v12-step-body');
  if (body) v12S2(body);
};

window.v12SetItemMode = function (id, val, field, max) {
  if (!v12State.itemModes[id]) v12State.itemModes[id] = { take: 0, deliver: 0 };
  const n = Math.min(Math.max(0, Number(val) || 0), max);
  v12State.itemModes[id][field] = n;
  const other = field === 'take' ? 'deliver' : 'take';
  v12State.itemModes[id][other] = max - n;
};

/* ══════════════════════════════════════════════════════
   STEP 3: รูปแบบการชำระเงิน (เต็ม / มัดจำ)
══════════════════════════════════════════════════════ */
function v12S3(container) {
  container.innerHTML = `
    <h2 class="v12-step-title">รูปแบบการชำระเงิน</h2>
    <p class="v12-step-subtitle">ชำระเต็มจำนวนหรือวางมัดจำบางส่วน</p>
    <div class="v12-pay-type-grid">
      <div class="v12-pay-type-card ${v12State.paymentType === 'full' ? 'selected' : ''}" onclick="v12SetPayType('full')">
        <i class="material-icons-round">payments</i>
        <h4>ชำระเต็มจำนวน</h4>
        <p>฿${formatNum(v12State.total)}</p>
      </div>
      <div class="v12-pay-type-card ${v12State.paymentType === 'deposit' ? 'selected' : ''}" onclick="v12SetPayType('deposit')">
        <i class="material-icons-round">account_balance_wallet</i>
        <h4>มัดจำ / ชำระบางส่วน</h4>
        <p>บันทึกยอดค้างเป็นหนี้ลูกค้า</p>
      </div>
    </div>
    <div id="v12-deposit-area">${v12State.paymentType === 'deposit' ? v12DepositHTML() : ''}</div>`;
}

function v12DepositHTML() {
  const remaining = v12State.total - (v12State.depositAmount || 0);
  return `
    <div class="v12-deposit-box">
      <label>ยอดมัดจำ / ชำระในวันนี้ (บาท)</label>
      <input type="number" id="v12-deposit-input" class="v12-deposit-big-input"
        value="${v12State.depositAmount || ''}" min="1" max="${v12State.total - 1}"
        placeholder="0"
        oninput="v12UpdateDepositRemaining(this.value)">
      <div class="v12-deposit-remaining">
        <span style="color:var(--text-muted,#9ca3af);">ยอดรวม: ฿${formatNum(v12State.total)}</span>
        <span id="v12-remaining-text" style="font-weight:700;color:#92400e;">ค้างชำระ: ฿${formatNum(remaining)}</span>
      </div>
    </div>`;
}

window.v12SetPayType = function (type) {
  v12State.paymentType = type;
  if (type === 'full') v12State.depositAmount = 0;
  document.querySelectorAll('.v12-pay-type-card').forEach((c, i) => {
    c.classList.toggle('selected', i === (type === 'full' ? 0 : 1));
  });
  const area = document.getElementById('v12-deposit-area');
  if (area) area.innerHTML = type === 'deposit' ? v12DepositHTML() : '';
};

window.v12UpdateDepositRemaining = function (val) {
  v12State.depositAmount = Number(val) || 0;
  const remaining = v12State.total - v12State.depositAmount;
  const el = document.getElementById('v12-remaining-text');
  if (el) el.textContent = `ค้างชำระ: ฿${formatNum(Math.max(0, remaining))}`;
};

/* ══════════════════════════════════════════════════════
   STEP 4: วิธีชำระเงิน
══════════════════════════════════════════════════════ */
function v12S4(container) {
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  container.innerHTML = `
    <h2 class="v12-step-title">วิธีชำระเงิน</h2>
    <p class="v12-step-subtitle">ยอดที่ต้องรับ: <strong style="color:var(--primary,#3b82f6);font-size:18px;">฿${formatNum(payAmt)}</strong></p>
    <div class="v12-method-grid">
      <div class="v12-method-card ${v12State.method === 'cash' ? 'selected' : ''}" onclick="v12SetMethod('cash')">
        <i class="material-icons-round">payments</i>
        <h4>เงินสด</h4>
        <p>นับแบงค์/เหรียญ</p>
      </div>
      <div class="v12-method-card ${v12State.method === 'transfer' ? 'selected' : ''}" onclick="v12SetMethod('transfer')">
        <i class="material-icons-round">account_balance</i>
        <h4>โอนเงิน</h4>
        <p>PromptPay / QR Code</p>
      </div>
      <div class="v12-method-card ${v12State.method === 'credit' ? 'selected' : ''}" onclick="v12SetMethod('credit')">
        <i class="material-icons-round">credit_card</i>
        <h4>บัตรเครดิต</h4>
        <p>Visa / Master</p>
      </div>
    </div>
    <div id="v12-method-extra">${v12State.method === 'transfer' ? v12QRBox(payAmt) : ''}</div>`;
}

function v12QRBox(amount) {
  return `
    <div class="v12-qr-box">
      <i class="material-icons-round" style="font-size:48px;color:#8b5cf6;">qr_code_2</i>
      <p>สแกน PromptPay เพื่อรับ <strong>฿${formatNum(amount)}</strong></p>
      <p style="font-size:12px;margin-top:4px;">หลังโอนแล้ว กด "ยืนยันการขาย" ได้เลย</p>
    </div>`;
}

window.v12SetMethod = function (method) {
  v12State.method = method;
  // Reset denominations when switching to cash
  if (method === 'cash') {
    [...BILLS, ...COINS].forEach(d => { v12State.receivedDenominations[d.value] = 0; });
  }
  document.querySelectorAll('.v12-method-card').forEach((c, i) => {
    const methods = ['cash', 'transfer', 'credit'];
    c.classList.toggle('selected', methods[i] === method);
  });
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const extra = document.getElementById('v12-method-extra');
  if (extra) extra.innerHTML = method === 'transfer' ? v12QRBox(payAmt) : '';
  // Update step bar & next button (cash = 6 steps, non-cash = 5 steps)
  v12UpdateStepBar();
  v12RenderStepBody();
};

/* ══════════════════════════════════════════════════════
   STEP 5: รับเงิน / ระบบนับแบงค์ (Cash only)
══════════════════════════════════════════════════════ */
function v12S5(container) {
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const received = Object.entries(v12State.receivedDenominations).reduce((s, [v, c]) => s + Number(v) * c, 0);
  const change = received - payAmt;
  const enough = received >= payAmt;

  container.innerHTML = `
    <h2 class="v12-step-title">รับเงิน</h2>
    <p class="v12-step-subtitle">กดแบงค์/เหรียญที่รับมาจากลูกค้า (กดค้างเพื่อลบ)</p>
    <div class="v12-cash-header">
      <div><div class="label">ยอดที่ต้องรับ</div><div class="amount">฿${formatNum(payAmt)}</div></div>
      <div style="text-align:right"><div class="label">รับมาแล้ว</div><div class="amount" id="v12-recv-total" style="color:${enough ? '#10b981' : 'var(--primary,#3b82f6)'}">฿${formatNum(received)}</div></div>
    </div>

    <div class="v12-denom-grid">
      ${[...BILLS, ...COINS].map(d => {
        const cnt = v12State.receivedDenominations[d.value] || 0;
        return `
        <div class="v12-denom-btn" onclick="v12AddDenom(${d.value})" oncontextmenu="event.preventDefault();v12RemoveDenom(${d.value})">
          <span class="v12-denom-count ${cnt > 0 ? 'show' : ''}" id="v12-cnt-${d.value}">${cnt}</span>
          <div class="v12-denom-swatch" style="background:${d.bg}"></div>
          <span class="v12-denom-label">฿${d.label}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="v12-quick-amounts">
      <span style="font-size:12px;color:var(--text-muted,#9ca3af);align-self:center;">รับพอดี:</span>
      ${v12QuickAmounts(payAmt)}
      <button class="v12-quick-btn" onclick="v12ClearDenoms()" style="margin-left:auto;color:#ef4444;">
        <i class="material-icons-round" style="font-size:14px">refresh</i> ล้าง
      </button>
    </div>

    <div class="v12-received-bar">
      <span style="font-size:13px;color:var(--text-muted,#9ca3af);">ทอน:</span>
      <strong id="v12-change-display" style="font-size:18px;color:${enough ? '#10b981' : 'var(--text-muted,#9ca3af)'};">
        ${enough ? `฿${formatNum(change)}` : '-'}
      </strong>
    </div>

    <div id="v12-change-breakdown-area">
      ${enough && change > 0 ? v12ChangeBreakdownHTML(change) : ''}
    </div>`;
}

function v12QuickAmounts(payAmt) {
  const amounts = [payAmt, Math.ceil(payAmt / 100) * 100, Math.ceil(payAmt / 500) * 500, Math.ceil(payAmt / 1000) * 1000]
    .filter((v, i, a) => a.indexOf(v) === i && v >= payAmt)
    .slice(0, 4);
  return amounts.map(v => `<button class="v12-quick-btn" onclick="v12SetExact(${v})">฿${formatNum(v)}</button>`).join('');
}

function v12ChangeBreakdownHTML(change) {
  const denoms = calcChangeDenominations(change);
  const chips = [...BILLS, ...COINS]
    .filter(d => denoms[d.value] > 0)
    .map(d => `<span class="v12-change-denom-chip">฿${d.label} ×${denoms[d.value]}</span>`)
    .join('');
  if (!chips) return '';
  return `
    <div class="v12-change-breakdown">
      <div class="v12-change-breakdown-title">💵 แบงค์/เหรียญที่ต้องทอน:</div>
      <div class="v12-change-denom-list">${chips}</div>
    </div>`;
}

window.v12AddDenom = function (val) {
  v12State.receivedDenominations[val] = (v12State.receivedDenominations[val] || 0) + 1;
  v12UpdateCashDisplay();
};

window.v12RemoveDenom = function (val) {
  if (v12State.receivedDenominations[val] > 0) {
    v12State.receivedDenominations[val]--;
    v12UpdateCashDisplay();
  }
};

window.v12ClearDenoms = function () {
  [...BILLS, ...COINS].forEach(d => { v12State.receivedDenominations[d.value] = 0; });
  v12UpdateCashDisplay();
};

window.v12SetExact = function (amount) {
  [...BILLS, ...COINS].forEach(d => { v12State.receivedDenominations[d.value] = 0; });
  let rem = amount;
  [...BILLS, ...COINS].forEach(d => {
    if (rem >= d.value) {
      v12State.receivedDenominations[d.value] = Math.floor(rem / d.value);
      rem -= v12State.receivedDenominations[d.value] * d.value;
    }
  });
  v12UpdateCashDisplay();
};

function v12UpdateCashDisplay() {
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const received = Object.entries(v12State.receivedDenominations).reduce((s, [v, c]) => s + Number(v) * c, 0);
  const change = received - payAmt;
  const enough = received >= payAmt;

  const recvEl = document.getElementById('v12-recv-total');
  const changeEl = document.getElementById('v12-change-display');
  if (recvEl) {
    recvEl.textContent = `฿${formatNum(received)}`;
    recvEl.style.color = enough ? '#10b981' : 'var(--primary,#3b82f6)';
  }
  if (changeEl) {
    changeEl.textContent = enough ? `฿${formatNum(change)}` : '-';
    changeEl.style.color = enough ? '#10b981' : 'var(--text-muted,#9ca3af)';
  }
  [...BILLS, ...COINS].forEach(d => {
    const cnt = v12State.receivedDenominations[d.value] || 0;
    const el = document.getElementById(`v12-cnt-${d.value}`);
    if (el) { el.textContent = cnt; el.classList.toggle('show', cnt > 0); }
  });

  // Update change breakdown
  const breakdownArea = document.getElementById('v12-change-breakdown-area');
  if (breakdownArea) {
    breakdownArea.innerHTML = enough && change > 0 ? v12ChangeBreakdownHTML(change) : '';
  }
}

/* ══════════════════════════════════════════════════════
   STEP 6: บันทึก (Complete)
══════════════════════════════════════════════════════ */
function v12S6(container) {
  if (!v12State.savedBill) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 0;">
        <div style="font-size:40px;color:var(--text-muted,#9ca3af);margin-bottom:12px;">⏳</div>
        <p style="color:var(--text-muted,#9ca3af);">กำลังบันทึก...</p>
      </div>`;
    return;
  }
  const b = v12State.savedBill;
  const hasDelivery = v12State.deliveryMode !== 'self';
  const isDeposit = v12State.paymentType === 'deposit';

  container.innerHTML = `
    <div class="v12-complete-box">
      <i class="material-icons-round">check_circle</i>
      <h3>บันทึกการขายสำเร็จ!</h3>
      <p>บิล #${b.bill_no} | ฿${formatNum(v12State.total)}</p>
    </div>
    <table class="v12-summary-table">
      <tr><td>ลูกค้า</td><td>${v12State.customer.name}</td></tr>
      <tr><td>วิธีชำระ</td><td>${v12State.method === 'cash' ? '💵 เงินสด' : v12State.method === 'transfer' ? '📱 โอนเงิน' : '💳 บัตรเครดิต'}</td></tr>
      ${isDeposit ? `
        <tr><td>ยอดมัดจำ</td><td style="color:#f59e0b;font-weight:700;">฿${formatNum(v12State.depositAmount)}</td></tr>
        <tr><td>ยอดค้างชำระ</td><td style="color:#ef4444;font-weight:700;">฿${formatNum(v12State.total - v12State.depositAmount)}</td></tr>` : ''}
      ${v12State.method === 'cash' ? `
        <tr><td>รับมา</td><td>฿${formatNum(v12State.received)}</td></tr>
        <tr><td>ทอน</td><td style="color:#10b981;font-weight:700;">฿${formatNum(v12State.change)}</td></tr>` : ''}
      ${hasDelivery ? `
        <tr><td>การจัดส่ง</td><td style="color:#8b5cf6;font-weight:600;">${v12State.deliveryMode === 'deliver' ? '🚚 ร้านไปส่ง' : '📦 รับบางส่วน'}</td></tr>
        <tr><td>วันนัดส่ง</td><td>${v12State.deliveryDate || '-'}</td></tr>` : ''}
    </table>
    ${v12State.method === 'cash' && v12State.change > 0 ? v12ChangeBreakdownHTML(v12State.change) : ''}
    ${hasDelivery ? `<div class="v12-delivery-notice">
      <i class="material-icons-round" style="font-size:16px;flex-shrink:0">info</i>
      สินค้าที่รอจัดส่งจะตัดสต็อกเมื่อกด "จัดส่งสำเร็จ" ในหน้าคิวส่งของ
    </div>` : ''}
    <div class="v12-print-options" style="margin-top:16px;">
      ${v12PrintButtons(b, hasDelivery, isDeposit)}
    </div>`;

  const nextBtn = document.getElementById('v12-next-btn');
  if (nextBtn) nextBtn.style.display = 'none';
}

function v12PrintButtons(b, hasDelivery, isDeposit) {
  let btns = `
    <button class="v12-print-btn primary" onclick="v12PrintReceipt80mm('${b.id}')">
      <i class="material-icons-round" style="font-size:16px">receipt</i> ใบเสร็จ 80mm
    </button>
    <button class="v12-print-btn" onclick="v12PrintReceiptA4('${b.id}')">
      <i class="material-icons-round" style="font-size:16px">description</i> ใบเสร็จ A4
    </button>`;
  if (hasDelivery) btns += `
    <button class="v12-print-btn" onclick="v12PrintDeliveryNote('${b.id}')">
      <i class="material-icons-round" style="font-size:16px">local_shipping</i> ใบส่งของ
    </button>`;
  if (isDeposit) btns += `
    <button class="v12-print-btn" onclick="v12PrintDeposit('${b.id}')">
      <i class="material-icons-round" style="font-size:16px">receipt_long</i> ใบมัดจำ
    </button>`;
  btns += `
    <button class="v12-print-btn" onclick="closeCheckout()" style="color:var(--text-muted,#9ca3af);border-color:var(--border,#d1d5db);">
      <i class="material-icons-round" style="font-size:16px">close</i> ปิด
    </button>`;
  return btns;
}

/* ══════════════════════════════════════════════════════
   COMPLETE PAYMENT LOGIC
══════════════════════════════════════════════════════ */
async function v12CompletePayment() {
  if (isProcessingPayment) return;
  isProcessingPayment = true;

  v12UpdateStepBar();
  v12RenderStepBody();

  try {
    let session = null;
    try {
      const { data } = await db.from('cash_session').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).single();
      session = data;
    } catch(e) { /* no open session, ok */ }

    const methodMap = { cash: 'เงินสด', transfer: 'โอนเงิน', credit: 'บัตรเครดิต' };
    const deliveryModeMap = { self: 'รับเอง', deliver: 'จัดส่ง', partial: 'รับบางส่วน' };

    const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    const debtAmt = v12State.paymentType === 'deposit' ? (v12State.total - v12State.depositAmount) : 0;

    const billStatus = debtAmt > 0 ? 'ค้างชำระ' :
      (v12State.deliveryMode !== 'self' ? 'รอจัดส่ง' : 'สำเร็จ');

    const hasDeliverItems = Object.values(v12State.itemModes).some(m => m.deliver > 0);

    const { data: bill, error: billError } = await db.from('บิลขาย').insert({
      date: new Date().toISOString(),
      method: methodMap[v12State.method] || 'เงินสด',
      total: v12State.total,
      discount: v12State.discount,
      received: v12State.received,
      change: v12State.change,
      customer_name: v12State.customer.name,
      customer_id: v12State.customer.id || null,
      staff_name: (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown',
      status: billStatus,
      denominations: v12State.receivedDenominations,
      change_denominations: v12State.changeDenominations,
      delivery_mode: deliveryModeMap[v12State.deliveryMode],
      delivery_date: v12State.deliveryDate || null,
      delivery_address: v12State.deliveryAddress || null,
      delivery_phone: v12State.deliveryPhone || null,
      delivery_status: hasDeliverItems ? 'รอจัดส่ง' : 'สำเร็จ',
      deposit_amount: v12State.depositAmount || 0,
    }).select().single();

    if (billError) throw billError;

    // Insert bill items
    for (const item of cart) {
      const modes = v12State.itemModes[item.id] || { take: item.qty, deliver: 0 };
      await db.from('รายการในบิล').insert({
        bill_id: bill.id,
        product_id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        cost: item.cost || 0,
        total: item.price * item.qty,
        take_qty: modes.take,
        deliver_qty: modes.deliver,
      });

      // Deduct stock for take_qty (Apply 1 unit = 1400kg multiplier)
      if (modes.take > 0) {
        const prod = (typeof products !== 'undefined') ? products.find(p => p.id === item.id) : null;
        const stockBefore = prod?.stock || 0;
        const multiplier = 1400; // 1 Unit = 1400 KG
        const deductedAmount = modes.take * multiplier;
        const stockAfter = stockBefore - deductedAmount;
        
        await db.from('สินค้า').update({ stock: stockAfter }).eq('id', item.id);
        if (prod) prod.stock = stockAfter;
        
        try {
          await db.from('stock_movement').insert({
            product_id: item.id, product_name: item.name,
            type: 'ขาย', direction: 'out', qty: deductedAmount,
            stock_before: stockBefore, stock_after: stockAfter,
            ref_id: bill.id, ref_table: 'บิลขาย',
            staff_name: (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown',
          });
        } catch(e) { console.warn('stock_movement insert skip:', e); }
      }
    }

    // Cash transaction
    if (v12State.method === 'cash' && session) {
      try {
        await db.from('cash_transaction').insert({
          session_id: session.id, type: 'ขาย', direction: 'in',
          amount: v12State.received, change_amt: v12State.change,
          net_amount: payAmt, balance_after: 0,
          ref_id: bill.id, ref_table: 'บิลขาย',
          staff_name: (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown',
          denominations: v12State.receivedDenominations,
        });
      } catch(e) { console.warn('cash_transaction skip:', e); }
    }

    // Update customer
    if (v12State.customer.id) {
      try {
        const { data: cust } = await db.from('customer').select('total_purchase, visit_count, debt_amount').eq('id', v12State.customer.id).single();
        await db.from('customer').update({
          total_purchase: (cust?.total_purchase || 0) + v12State.total,
          visit_count: (cust?.visit_count || 0) + 1,
          debt_amount: (cust?.debt_amount || 0) + debtAmt,
        }).eq('id', v12State.customer.id);
      } catch(e) { console.warn('customer update skip:', e); }
    }

    if (typeof logActivity === 'function') logActivity('ขายสินค้า', `บิล #${bill.bill_no} ยอด ฿${formatNum(v12State.total)}`, bill.id, 'บิลขาย');
    if (typeof sendToDisplay === 'function') sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: v12State.total });

    v12State.savedBill = bill;

    // Clear cart
    cart = [];
    if (typeof loadProducts === 'function') await loadProducts();
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderProductGrid === 'function') renderProductGrid();
    if (typeof updateHomeStats === 'function') updateHomeStats();

    v12UpdateStepBar();
    v12RenderStepBody();

  } catch (e) {
    console.error('v12 payment error:', e);
    if (typeof toast === 'function') toast('เกิดข้อผิดพลาดในการบันทึก: ' + e.message, 'error');
    v12State.step = v12NeedsStepCash() ? 5 : 4;
    v12UpdateUI();
  } finally {
    isProcessingPayment = false;
  }
}

/* ── Print helpers ── */
const V12_PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Sarabun', sans-serif; padding: 0; color: #101828; line-height: 1.4; margin: 0; background: #fff; }
  @page { size: A4; margin: 0; }
  
  .print-page { 
    width: 210mm; height: 297mm; 
    padding: 15mm; 
    margin: 0 auto; 
    position: relative; 
    page-break-after: always; 
    overflow: hidden;
  }
  
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
  .shop-info h1 { color: #d92d20; font-size: 26px; font-weight: 800; margin: 0 0 4px; }
  .shop-details { color: #667085; font-size: 12px; line-height: 1.5; }
  .doc-type-box { display: flex; flex-direction: column; align-items: flex-end; }
  .doc-label { background: #d92d20; color: #fff; padding: 10px 18px; border-radius: 12px; text-align: center; min-width: 130px; margin-bottom: 10px; }
  .doc-label h2 { margin: 0; font-size: 16px; font-weight: 700; line-height: 1; }
  .doc-label span { font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; }
  .doc-meta { text-align: right; font-size: 13px; display: flex; flex-direction: column; gap: 2px; }
  .doc-meta strong { font-weight: 700; }

  /* Info Grid */
  .info-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-box { background: #f9fafb; border-radius: 14px; padding: 15px; border: 1px solid #f2f4f7; }
  .info-label { color: #667085; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; border-bottom: 1px solid #eaecf0; padding-bottom: 4px; }
  .info-content { font-size: 13px; }
  .info-name { font-size: 16px; font-weight: 800; color: #344054; margin: 0 0 2px; }
  .info-sub { font-size: 12px; color: #98a2b3; font-style: italic; }
  .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
  .info-row span:first-child { color: #667085; font-weight: 500; }
  .info-row span:last-child { color: #101828; font-weight: 700; text-align: right; }

  /* Table */
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; border: 1.5px solid #eaecf0; border-radius: 12px; overflow: hidden; }
  thead { background: #f2f4f7; }
  th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #475467; text-transform: uppercase; border-bottom: 1px solid #eaecf0; }
  td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #eaecf0; color: #344054; }
  tbody tr:last-child td { border-bottom: none; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .col-num { width: 40px; color: #98a2b3; font-weight: 500; }
  .col-qty, .col-unit, .col-price, .col-total { text-align: center; font-weight: 600; width: 70px; }
  .col-total { text-align: right; width: 90px; color: #101828; font-weight: 700; }

  /* Summary Section (Stick to Footer) */
  .footer-content { position: absolute; bottom: 15mm; left: 15mm; right: 15mm; }
  .summary-grid { display: grid; grid-template-columns: 1.2fr 0.8fr 1fr; gap: 20px; align-items: flex-end; margin-bottom: 30px; }
  
  .text-amount-box { background: #f9fafb; padding: 12px; border-radius: 12px; border: 1px solid #f2f4f7; }
  .text-amount-label { font-size: 9px; color: #667085; font-weight: 700; margin-bottom: 4px; }
  .text-amount-val { color: #d92d20; font-size: 14px; font-weight: 800; }
  
  .note-box { margin-top: 12px; font-size: 11px; color: #667085; display: flex; gap: 6px; }
  .note-icon { color: #d92d20; font-weight: 800; font-style: normal; }

  .qr-box { text-align: center; border: 1px solid #eaecf0; border-radius: 14px; padding: 10px; width: 120px; margin: 0 auto; }
  .qr-box img { width: 100%; border-radius: 6px; }
  .qr-label { background: #00467f; color: #fff; font-size: 9px; font-weight: 800; padding: 3px; border-radius: 4px 4px 0 0; margin-top: -11px; margin-bottom: 6px; position: relative; }
  .qr-footer { font-size: 8px; color: #667085; font-weight: 600; margin-top: 4px; }

  .summary-table { width: 100%; border-spacing: 0; border: none; }
  .summary-table td { padding: 4px 0; border: none; font-size: 13px; }
  .summary-table .label { color: #667085; font-weight: 500; }
  .summary-table .val { text-align: right; font-weight: 700; }
  
  /* Single Block Grand Total as per user request */
  .grand-total-block { 
    background: #d92d20; color: #fff; padding: 12px 16px; border-radius: 12px; 
    display: flex; justify-content: space-between; align-items: center; margin-top: 8px;
    box-shadow: 0 4px 10px rgba(217, 45, 32, 0.2);
  }
  .gt-label { font-size: 14px; font-weight: 700; }
  .gt-val { font-size: 24px; font-weight: 800; }

  /* Signature */
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sig-line { border-top: 1.5px dashed #eaecf0; text-align: center; padding-top: 8px; min-height: 40px; }
  .sig-lbl { font-size: 12px; font-weight: 700; color: #344054; margin: 0; }
  .sig-sub { font-size: 10px; color: #98a2b3; margin-top: 2px; }
  .page-num { position: absolute; bottom: 8mm; right: 15mm; font-size: 10px; color: #98a2b3; }
`;

function v12GeneratePrintHTML(title, docTypeEn, docNo, date, customerBox, summaryRows, items, amountText, qrUrl = null, shop = null) {
  if (!shop) shop = (typeof SHOP_CONFIG !== 'undefined' && SHOP_CONFIG) ? SHOP_CONFIG : { name: 'ร้านค้า', address: '-', phone: '-', taxId: '-' };
  const thaiDate = new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  
  const itemsPerPage = 10;
  const pageCount = Math.ceil(items.length / itemsPerPage);
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} #${docNo}</title><style>${V12_PRINT_CSS}</style></head><body>`;

  for (let p = 0; p < pageCount; p++) {
    const isLastPage = p === pageCount - 1;
    const pageItems = items.slice(p * itemsPerPage, (p + 1) * itemsPerPage);

    html += `
    <div class="print-page">
      <div class="header">
        <div class="shop-info">
          <h1>${shop.name}</h1>
          <div class="shop-details">
            ที่อยู่ ${shop.address}<br>
            โทร ${shop.phone}<br>
            Tax ID: ${shop.taxId || '-'}
          </div>
        </div>
        <div class="doc-type-box">
          <div class="doc-label">
            <h2>${title}</h2>
            <span>${docTypeEn}</span>
          </div>
          <div class="doc-meta">
            <span>เลขที่: <strong>${docNo}</strong></span>
            <span>วันที่: <strong>${thaiDate}</strong></span>
          </div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">ลูกค้า / CUSTOMER</div>
          <div class="info-content">
            <h4 class="info-name">${customerBox.name}</h4>
            <div class="info-sub">${customerBox.sub || '(ไม่มีข้อมูลที่อยู่ในระบบ)'}</div>
          </div>
        </div>
        <div class="info-box">
          <div class="info-row"><span>พนักงาน</span><span>${customerBox.staff}</span></div>
          <div class="info-row"><span>ชำระเงิน</span><span>${customerBox.method}</span></div>
        </div>
      </div>

      <table style="margin-bottom: ${isLastPage ? '0' : '20px'};">
        <thead>
          <tr>
            <th class="text-center">#</th>
            <th>รายละเอียดสินค้า</th>
            <th class="text-center">จำนวน</th>
            <th class="text-center">หน่วย</th>
            <th class="text-center">ราคา/หน่วย</th>
            <th class="text-right">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          ${pageItems.map((it, i) => `
            <tr>
              <td class="text-center col-num">${(p * itemsPerPage) + i + 1}</td>
              <td>${it.name}</td>
              <td class="text-center col-qty">${it.qty}</td>
              <td class="text-center col-unit">${it.unit || 'ชิ้น'}</td>
              <td class="text-center col-price">${formatNum(it.price || 0)}</td>
              <td class="text-right col-total">${formatNum(it.total || 0)}</td>
            </tr>`).join('')}
          ${isLastPage ? '' : `<tr><td colspan="6" class="text-center" style="color:#d92d20;font-weight:700;padding:15px">--- มีต่อหน้าถัดไป ---</td></tr>`}
        </tbody>
      </table>

      ${isLastPage ? `
      <div class="footer-content">
        <div class="summary-grid">
          <div>
            <div class="text-amount-box">
              <div class="text-amount-label">จำนวนเงินตัวอักษร</div>
              <div class="text-amount-val">${amountText}</div>
            </div>
            <div class="note-box">
              <span class="note-icon">ⓘ</span>
              <span>หมายเหตุ: สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน ขอบคุณที่ใช้บริการ</span>
            </div>
          </div>
          <div>
            ${qrUrl ? `
              <div class="qr-box">
                <div class="qr-label">PromptPay</div>
                <img src="${qrUrl}" alt="QR">
                <div class="qr-footer">สแกนเพื่อชำระเงิน</div>
              </div>` : ''}
          </div>
          <div>
            <table class="summary-table">
              ${summaryRows.filter(r => !r.isGrand).map(row => `
                <tr>
                  <td class="label">${row.label}</td>
                  <td class="val">฿${row.val}</td>
                </tr>`).join('')}
            </table>
            ${(function() {
              const gt = summaryRows.find(r => r.isGrand);
              return gt ? `
                <div class="grand-total-block">
                  <span class="gt-label">${gt.label}</span>
                  <span class="gt-val">฿${gt.val}</span>
                </div>` : '';
            })()}
          </div>
        </div>

        <div class="signature-grid">
          <div class="sig-item">
            <div class="sig-line"></div>
            <p class="sig-lbl">ผู้รับของ / Received By</p>
            <p class="sig-sub">วันที่ _____/_____/_____</p>
          </div>
          <div class="sig-item">
            <div class="sig-line"></div>
            <p class="sig-lbl">ผู้รับเงิน / Authorized</p>
            <p class="sig-sub">วันที่ _____/_____/_____</p>
          </div>
        </div>
      </div>` : ''}

      <div class="page-num">หน้า ${p + 1} / ${pageCount}</div>
    </div>`;
  }

  html += `</body></html>`;
  return html;
}

// Helper to convert number to Thai Baht words (simple version)
function v12ThaiBahtText(num) {
  if (!num && num !== 0) return '-';
  const thaiNumber = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const thaiUnit = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  
  const [intPart, decimalPart] = num.toString().split('.');
  
  const convert = (n) => {
    let res = "";
    n = n.split('').reverse().join('');
    for (let i = 0; i < n.length; i++) {
      const digit = parseInt(n[i]);
      if (digit !== 0) {
        if (i === 1 && digit === 1) res = "สิบ" + res;
        else if (i === 1 && digit === 2) res = "ยี่สิบ" + res;
        else if (i === 0 && digit === 1 && n.length > 1) res = "เอ็ด" + res;
        else res = thaiNumber[digit] + thaiUnit[i] + res;
      }
    }
    return res;
  };
  
  let result = convert(intPart) + "บาทถ้วน"; // Simply assume no decimals for now as typical in these receipts
  if (decimalPart && parseInt(decimalPart) > 0) {
     result = convert(intPart) + "บาท" + convert(decimalPart) + "สตางค์";
  }
  return result;
}

window.v12PrintReceipt80mm = async function (billId) {
  try {
    const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).single();
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
    let rc = {};
    try { 
      const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).single();
      rc = data || {};
    } catch(e) { rc = (typeof SHOP_CONFIG !== 'undefined') ? SHOP_CONFIG : {}; }

    const win = window.open('', '_blank', 'width=340,height=700');
    const rows = (items || []).map(i => `<tr><td style="padding:2px 0;">${i.name}</td><td style="text-align:center;padding:2px 0;">${i.qty}${i.unit || 'ชิ้น'}</td><td style="text-align:right;padding:2px 0;">฿${formatNum(i.total)}</td></tr>`).join('');
    const ppNo = rc.promptpay_number || rc.phone || '';
    const pp = (ppNo && bill.method === 'โอนเงิน') ? `<div style="text-align:center;margin-top:8px"><img src="https://promptpay.io/${ppNo.replace(/[^0-9]/g, '')}/${bill.total}.png" style="width:120px;height:120px;border:1px solid #eee;padding:5px;border-radius:8px;"></div>` : '';
    
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun',sans-serif;font-size:13px;width:72mm;padding:4mm;color:#333}
    .c{text-align:center}hr{border:none;border-top:1px dashed #ccc;margin:6px 0}
    table{width:100%;border-collapse:collapse}th{font-size:11px;color:#666;text-transform:uppercase;padding-bottom:4px}
    .tot td{font-weight:700;font-size:15px;border-top:1px solid #333;padding-top:6px}
    @media print{@page{size:72mm auto;margin:0}body{padding:2mm}}</style></head><body>
    <div class="c" style="font-size:18px;font-weight:800;color:#d92d20;margin-bottom:2px;">${rc.shop_name || rc.name || 'SK POS'}</div>
    <div class="c" style="font-size:11px;line-height:1.3;color:#666;">${rc.address || ''}<br>โทร ${rc.phone || ''} ${rc.tax_id ? `| TAX:${rc.tax_id}` : ''}</div><hr>
    <div style="font-size:12px;margin-bottom:2px;"><strong>บิล #${bill.bill_no}</strong></div>
    <div style="font-size:11px;color:#666;margin-bottom:4px;">${new Date(bill.date).toLocaleString('th-TH')}</div>
    <div style="font-size:12px;display:flex;justify-content:space-between;"><span>ลูกค้า: ${bill.customer_name || 'ทั่วไป'}</span><span>พนักงาน: ${bill.staff_name || ''}</span></div><hr>
    <table><thead><tr><th style="text-align:left">รายการ</th><th>จำนวน</th><th style="text-align:right">รวม</th></tr></thead>
    <tbody>${rows}</tbody></table><hr>
    ${bill.discount ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>ส่วนลด</span><span>-฿${formatNum(bill.discount)}</span></div>` : ''}
    <table><tr class="tot"><td>ยอดสุทธิ</td><td style="text-align:right">฿${formatNum(bill.total)}</td></tr></table>
    ${bill.method === 'เงินสด' ? `<div style="display:flex;justify-content:space-between;margin-top:4px;"><span>รับมา</span><span>฿${formatNum(bill.received)}</span></div><div style="display:flex;justify-content:space-between;color:#10b981;font-weight:700;"><span>เงินทอน</span><span>฿${formatNum(bill.change)}</span></div>` : ''}
    <hr><div style="text-align:center;font-weight:700;margin-bottom:4px;">วิธีชำระ: ${bill.method}</div>${pp}
    <div class="c" style="margin-top:12px;font-size:11px;color:#666;font-style:italic;">${rc.receipt_footer || rc.note || 'ขอบคุณที่ใช้บริการ'}</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script></body></html>`);
    win.document.close();
  } catch(e) { console.error(e); toast('พิมพ์ไม่สำเร็จ: ' + e.message, 'error'); }
};

window.v12PrintReceiptA4 = async function (billId) {
  try {
    const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).single();
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
    
    let rc = {};
    try { 
      const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).single();
      rc = data || {};
    } catch(e) { rc = (typeof SHOP_CONFIG !== 'undefined') ? SHOP_CONFIG : {}; }

    // Fetch customer address/phone if member
    let custInfo = bill.delivery_address || '';
    if (bill.delivery_phone) custInfo = (custInfo ? custInfo + ' ' : '') + 'โทร: ' + bill.delivery_phone;
    
    if (!custInfo && bill.customer_id) {
      try {
        const { data: cust } = await db.from('customer').select('address, phone').eq('id', bill.customer_id).single();
        if (cust) {
          custInfo = cust.address || '';
          if (cust.phone) custInfo = (custInfo ? custInfo + ' ' : '') + 'โทร: ' + cust.phone;
        }
      } catch(e) {}
    }

    const customerBox = {
      name: bill.customer_name || 'ลูกค้าทั่วไป',
      sub: custInfo || null,
      staff: bill.staff_name || 'admin',
      method: bill.method || 'เงินสด'
    };

    const summaryRows = [
      { label: 'รวมเงิน', val: formatNum(bill.total) },
      { label: 'จำนวนเงินรวมทั้งสิ้น', val: formatNum(bill.total), isGrand: true },
      { label: 'รับเงิน', val: formatNum(bill.received || bill.total) }
    ];

    const ppNo = rc.promptpay_number || rc.phone || '';
    const qrUrl = bill.method === 'โอนเงิน' ? `https://promptpay.io/${ppNo.replace(/[^0-9]/g, '')}/${bill.total}.png` : null;
    const amountText = v12ThaiBahtText(bill.total);

    const html = v12GeneratePrintHTML('ใบเสร็จรับเงิน', 'RECEIPT', bill.bill_no, bill.date, customerBox, summaryRows, items, amountText, qrUrl, rc);
    const w = window.open('', '_blank', 'width=850,height=900');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 800);
  } catch(e) { console.error(e); toast('พิมพ์ไม่สำเร็จ: ' + e.message, 'error'); }
};

window.v12PrintDeliveryNote = async function (billId) {
  try {
    const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).single();
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
    const deliverItems = (items || []).filter(i => (i.deliver_qty || 0) > 0);
    const activeItems = deliverItems.length > 0 ? deliverItems : items; // Fallback to all items if none specifically marked for delivery
    
    let rc = {};
    try { 
      const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).single();
      rc = data || {};
    } catch(e) { rc = (typeof SHOP_CONFIG !== 'undefined') ? SHOP_CONFIG : {}; }

    // Fetch customer address/phone if member
    let custInfo = bill.delivery_address || '';
    if (bill.delivery_phone) custInfo = (custInfo ? custInfo + ' ' : '') + 'โทร: ' + bill.delivery_phone;

    if (!custInfo && bill.customer_id) {
      try {
        const { data: cust } = await db.from('customer').select('address, phone').eq('id', bill.customer_id).single();
        if (cust) {
          custInfo = cust.address || '';
          if (cust.phone) custInfo = (custInfo ? custInfo + ' ' : '') + 'โทร: ' + cust.phone;
        }
      } catch(e) {}
    }
    
    const customerBox = {
      name: bill.customer_name || 'ลูกค้าทั่วไป',
      sub: custInfo || null,
      staff: bill.staff_name || 'admin',
      method: bill.method || 'เงินสด'
    };

    const itemTotals = activeItems.reduce((s, it) => s + (it.total || 0), 0);
    const summaryRows = [
      { label: 'รวมเงิน', val: formatNum(itemTotals) },
      { label: 'จำนวนเงินรวมทั้งสิ้น', val: formatNum(itemTotals), isGrand: true },
      { label: 'รับเงิน', val: formatNum(bill.received || itemTotals) }
    ];

    const ppNo = rc.promptpay_number || rc.phone || '';
    const qrUrl = (bill.method === 'โอนเงิน' || !bill.received) ? `https://promptpay.io/${ppNo.replace(/[^0-9]/g, '')}/${itemTotals}.png` : null;
    const amountText = v12ThaiBahtText(itemTotals);

    const html = v12GeneratePrintHTML('ใบส่งของ', 'DELIVERY NOTE', bill.bill_no, bill.date, customerBox, summaryRows, activeItems, amountText, qrUrl, rc);
    const w = window.open('', '_blank', 'width=850,height=900');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 800);
  } catch(e) { console.error(e); toast('พิมพ์ไม่สำเร็จ: ' + e.message, 'error'); }
};

window.v12PrintDeposit = async function (billId) {
  try {
    const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).single();
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
    
    const customerBox = {
      name: bill.customer_name || 'ลูกค้าทั่วไป',
      sub: null,
      staff: bill.staff_name || 'admin',
      method: bill.method || 'เงินสด'
    };

    const remaining = bill.total - (bill.deposit_amount || 0);
    const summaryRows = [
      { label: 'ยอดรวมทั้งสิ้น', val: formatNum(bill.total) },
      { label: 'ยอดมัดจำที่ชำระ', val: formatNum(bill.deposit_amount), isGrand: true },
      { label: 'คงเหลือค้างชำระ', val: formatNum(remaining) }
    ];

    let rc = {};
    try { 
      const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).single();
      rc = data || {};
    } catch(e) { rc = (typeof SHOP_CONFIG !== 'undefined') ? SHOP_CONFIG : {}; }

    const ppNo = rc.promptpay_number || rc.phone || '';
    const qrUrl = `https://promptpay.io/${ppNo.replace(/[^0-9]/g, '')}/${bill.deposit_amount}.png`;
    const amountText = v12ThaiBahtText(bill.deposit_amount);

    const html = v12GeneratePrintHTML('ใบมัดจำ', 'DEPOSIT RECEIPT', bill.bill_no, bill.date, customerBox, summaryRows, items, amountText, qrUrl, rc);
    const w = window.open('', '_blank', 'width=850,height=900');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 800);
  } catch(e) { console.error(e); toast('พิมพ์ไม่สำเร็จ: ' + e.message, 'error'); }
};

/* ──────────────────────────────────────────────────────────────
   SECTION 2: DELIVERY QUEUE MODULE
────────────────────────────────────────────────────────────── */

window.renderDelivery = async function () {
  const sec = document.getElementById('page-delivery');
  if (!sec) return;

  sec.innerHTML = `
    <div class="v12-dq-container">
      <div class="v12-dq-header">
        <div class="v12-dq-title">🚚 คิวจัดส่งสินค้า</div>
        <div class="v12-filter-pills">
          <button class="v12-pill active" id="dq-pill-today" onclick="v12DQFilter('today')">📅 วันนี้</button>
          <button class="v12-pill" id="dq-pill-tomorrow" onclick="v12DQFilter('tomorrow')">🗓️ พรุ่งนี้</button>
          <button class="v12-pill" id="dq-pill-all" onclick="v12DQFilter('all')">📋 ทั้งหมด</button>
        </div>
      </div>
      <div class="v12-dq-stats" id="dq-stats-row">
        <div class="v12-dq-stat"><div class="v12-dq-stat-val" id="dq-count-wait" style="color:#8b5cf6">-</div><div class="v12-dq-stat-lbl">รอจัดส่ง</div></div>
        <div class="v12-dq-stat"><div class="v12-dq-stat-val" id="dq-count-today" style="color:#f59e0b">-</div><div class="v12-dq-stat-lbl">นัดวันนี้</div></div>
        <div class="v12-dq-stat"><div class="v12-dq-stat-val" id="dq-count-done" style="color:#10b981">-</div><div class="v12-dq-stat-lbl">จัดส่งสำเร็จวันนี้</div></div>
      </div>
      <div id="dq-cards-area">
        <div style="text-align:center;padding:40px;color:var(--text-muted,#9ca3af);">⏳ กำลังโหลด...</div>
      </div>
    </div>`;

  await v12DQFilter('today');
};

let v12DQCurrentFilter = 'today';
window.v12DQFilter = async function (filter) {
  v12DQCurrentFilter = filter;
  document.querySelectorAll('.v12-pill').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`dq-pill-${filter}`);
  if (el) el.classList.add('active');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  try {
    const { data: allBills, error } = await db.from('บิลขาย')
      .select('*')
      .order('delivery_date', { ascending: true });

    if (error) throw error;

    const pending = (allBills || []).filter(b =>
      b.delivery_status === 'รอจัดส่ง' ||
      (b.delivery_mode && b.delivery_mode !== 'รับเอง' && b.delivery_status !== 'จัดส่งสำเร็จ' && b.status !== 'ยกเลิก')
    );

    let filtered = pending;
    if (filter === 'today') filtered = pending.filter(b => b.delivery_date === today);
    else if (filter === 'tomorrow') filtered = pending.filter(b => b.delivery_date === tomorrow);

    const doneTodayCount = (allBills || []).filter(b => b.delivery_status === 'จัดส่งสำเร็จ' && b.delivery_date === today).length;
    const todayCount = pending.filter(b => b.delivery_date === today).length;

    const cntWait = document.getElementById('dq-count-wait');
    const cntToday = document.getElementById('dq-count-today');
    const cntDone = document.getElementById('dq-count-done');
    if (cntWait) cntWait.textContent = pending.length;
    if (cntToday) cntToday.textContent = todayCount;
    if (cntDone) cntDone.textContent = doneTodayCount;

    v12DQRenderCards(filtered);

    const badge = document.getElementById('delivery-count-badge');
    if (badge) {
      badge.textContent = pending.length;
      badge.classList.toggle('hidden', pending.length === 0);
    }
  } catch (e) {
    console.error('[v12] DQFilter error:', e);
    const area = document.getElementById('dq-cards-area');
    if (area) area.innerHTML = `<div class="v12-dq-empty">
      <i class="material-icons-round" style="color:#ef4444">error_outline</i>
      <p>โหลดข้อมูลไม่สำเร็จ</p>
      <span style="font-size:12px;color:#ef4444">${e.message}</span>
    </div>`;
  }
};

async function v12DQRenderCards(bills) {
  const area = document.getElementById('dq-cards-area');
  if (!area) return;
  if (!bills.length) {
    area.innerHTML = `<div class="v12-dq-empty">
      <i class="material-icons-round">local_shipping</i>
      <p>ไม่มีคิวส่งของ</p>
      <span>คิวที่เลือกว่างเปล่า</span>
    </div>`;
    return;
  }

  const billIds = bills.map(b => b.id);
  const { data: allItems } = await db.from('รายการในบิล').select('*').in('bill_id', billIds);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  area.innerHTML = bills.map(b => {
    const items = (allItems || []).filter(i => i.bill_id === b.id && (i.deliver_qty || 0) > 0);
    const d = b.delivery_date;
    let dateCls = 'other', dateLbl = d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'ไม่กำหนด';
    if (d === today) { dateCls = 'today'; dateLbl = '📅 วันนี้'; }
    else if (d === tomorrow) { dateCls = 'tomorrow'; dateLbl = '🗓️ พรุ่งนี้'; }
    else if (d && d < today) { dateCls = 'overdue'; dateLbl = '⚠️ เกินกำหนด'; }

    return `
    <div class="v12-dq-card" id="dq-card-${b.id}">
      <div class="v12-dq-card-header">
        <div class="v12-dq-bill-badge">#${b.bill_no}</div>
        <div class="v12-dq-customer">
          <strong>${b.customer_name || 'ลูกค้าทั่วไป'}</strong>
          <span>${b.staff_name || ''} — ฿${formatNum(b.total)}</span>
        </div>
        <span class="v12-dq-date-badge ${dateCls}">${dateLbl}</span>
      </div>
      <div class="v12-dq-card-body">
        ${b.delivery_address ? `<div class="v12-dq-address"><i class="material-icons-round" style="font-size:14px;color:#8b5cf6">location_on</i>${b.delivery_address}</div>` : ''}
        <div class="v12-dq-items">
          ${items.length
            ? items.map(it => `<div class="v12-dq-item"><span>${it.name}</span><strong>${it.deliver_qty} ชิ้น</strong></div>`).join('')
            : '<div style="font-size:13px;color:var(--text-muted,#9ca3af)">ไม่มีรายการส่ง</div>'}
        </div>
      </div>
      <div class="v12-dq-card-footer">
        <button class="v12-dq-btn print" onclick="v12DQPrintNote('${b.id}')">
          <i class="material-icons-round" style="font-size:15px">print</i> ใบส่งของ
        </button>
        <button class="v12-dq-btn done" onclick="v12DQMarkDone('${b.id}')">
          <i class="material-icons-round" style="font-size:15px">check_circle</i> จัดส่งสำเร็จ
        </button>
      </div>
    </div>`;
  }).join('');
}

window.v12DQPrintNote = function (billId) { v12PrintDeliveryNote(billId); };

window.v12DQMarkDone = async function (billId) {
  if (typeof Swal === 'undefined') {
    if (!confirm('ยืนยันการจัดส่งสำเร็จ? ระบบจะตัดสต็อกสินค้าที่จัดส่งทันที')) return;
  } else {
    const result = await Swal.fire({
      title: 'ยืนยันการจัดส่งสำเร็จ?',
      text: 'ระบบจะตัดสต็อกสินค้าที่จัดส่งทันที',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน จัดส่งสำเร็จ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#10b981',
    });
    if (!result.isConfirmed) return;
  }

  try {
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
    const deliverItems = (items || []).filter(i => (i.deliver_qty || 0) > 0);

    for (const it of deliverItems) {
      if (!it.product_id) continue;
      const prod = (typeof products !== 'undefined') ? products.find(p => p.id === it.product_id) : null;
      const stockBefore = prod?.stock || 0;
      const multiplier = 1400; // 1 Unit = 1400 KG
      const deductedAmount = (it.deliver_qty || 0) * multiplier;
      const stockAfter = stockBefore - deductedAmount;
      
      await db.from('สินค้า').update({ stock: stockAfter }).eq('id', it.product_id);
      try {
        await db.from('stock_movement').insert({
          product_id: it.product_id, product_name: it.name,
          type: 'จัดส่ง', direction: 'out', qty: deductedAmount,
          stock_before: stockBefore, stock_after: stockAfter,
          ref_id: billId, ref_table: 'บิลขาย',
          staff_name: (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown',
        });
      } catch(e) { console.warn('stock_movement skip:', e); }
      if (prod) prod.stock = stockAfter;
    }

    await db.from('บิลขาย').update({ delivery_status: 'จัดส่งสำเร็จ', status: 'สำเร็จ' }).eq('id', billId);
    if (typeof logActivity === 'function') logActivity('จัดส่งสำเร็จ', `บิล #${billId} ตัดสต็อกแล้ว`, billId, 'บิลขาย');

    const card = document.getElementById(`dq-card-${billId}`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateX(60px)';
      card.style.transition = 'all .3s ease';
      setTimeout(() => card.remove(), 300);
    }
    toast('จัดส่งสำเร็จ! ตัดสต็อกเรียบร้อย', 'success');
    if (typeof loadProducts === 'function') await loadProducts(); // Refresh stock in UI
    if (typeof updateHomeStats === 'function') updateHomeStats();
  } catch (e) {
    console.error(e);
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
};

/* ──────────────────────────────────────────────────────────────
   SECTION 3: BILL MANAGEMENT CENTER (override renderHistory)
────────────────────────────────────────────────────────────── */

window.renderHistory = async function () {
  const section = document.getElementById('page-history');
  if (!section) return;

  const today = new Date().toISOString().split('T')[0];
  section.innerHTML = `
    <div class="v12-bmc-container">
      <div class="v12-bmc-search-bar">
        <div class="v12-bmc-search">
          <i class="material-icons-round" style="color:var(--text-muted,#9ca3af);font-size:18px">search</i>
          <input type="text" id="bmc-search" placeholder="ค้นหาเลขบิล, ชื่อลูกค้า..." oninput="v12BMCLoad()">
        </div>
        <input type="date" class="v12-bmc-date" id="bmc-date" value="${today}" onchange="v12BMCLoad()">
        <button onclick="v12BMCExport()" style="border:1.5px solid var(--border,#d1d5db);border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;background:var(--bg-primary,#fff);display:flex;align-items:center;gap:6px;">
          <i class="material-icons-round" style="font-size:16px">download</i> Export
        </button>
      </div>
      <div class="v12-bmc-tabs">
        <button class="v12-bmc-tab active" id="bmc-tab-all" onclick="v12BMCSetTab('all')">
          📋 ทั้งหมด <span class="tab-count" id="bmc-cnt-all">0</span>
        </button>
        <button class="v12-bmc-tab" id="bmc-tab-done" onclick="v12BMCSetTab('done')">
          🟢 สำเร็จ <span class="tab-count" id="bmc-cnt-done">0</span>
        </button>
        <button class="v12-bmc-tab" id="bmc-tab-pending" onclick="v12BMCSetTab('pending')">
          🟡 รอจัดส่ง <span class="tab-count" id="bmc-cnt-pending">0</span>
        </button>
        <button class="v12-bmc-tab" id="bmc-tab-debt" onclick="v12BMCSetTab('debt')">
          🔴 ค้างชำระ <span class="tab-count" id="bmc-cnt-debt">0</span>
        </button>
        <button class="v12-bmc-tab" id="bmc-tab-returned" onclick="v12BMCSetTab('returned')">
          🟣 คืนสินค้า <span class="tab-count" id="bmc-cnt-returned">0</span>
        </button>
      </div>
      <div class="v12-bmc-table-wrap">
        <table class="v12-bmc-table">
          <thead>
            <tr>
              <th>บิล #</th>
              <th>วันเวลา</th>
              <th>ลูกค้า</th>
              <th>วิธีชำระ</th>
              <th>จัดส่ง</th>
              <th style="text-align:right">ยอดรวม</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody id="bmc-tbody">
            <tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted,#9ca3af);">⏳ กำลังโหลด...</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  await v12BMCLoad();
};

let v12BMCActiveTab = 'all';
window.v12BMCSetTab = function (tab) {
  v12BMCActiveTab = tab;
  document.querySelectorAll('.v12-bmc-tab').forEach(t => t.classList.remove('active'));
  const el = document.getElementById(`bmc-tab-${tab}`);
  if (el) el.classList.add('active');
  v12BMCLoad();
};

window.v12BMCLoad = async function () {
  const date = document.getElementById('bmc-date')?.value || new Date().toISOString().split('T')[0];
  const search = document.getElementById('bmc-search')?.value?.toLowerCase() || '';

  try {
    const { data: bills } = await db.from('บิลขาย').select('*').gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59').order('date', { ascending: false });
    const all = (bills || []).filter(b =>
      !search || b.bill_no?.toString().includes(search) || b.customer_name?.toLowerCase().includes(search));

    const counts = {
      all: all.length,
      done: all.filter(b => b.status === 'สำเร็จ').length,
      pending: all.filter(b => b.delivery_status === 'รอจัดส่ง').length,
      debt: all.filter(b => b.status === 'ค้างชำระ').length,
      returned: all.filter(b => b.status === 'คืนสินค้า' || b.status === 'คืนบางส่วน').length,
    };
    Object.entries(counts).forEach(([k, v]) => {
      const el = document.getElementById(`bmc-cnt-${k}`);
      if (el) el.textContent = v;
    });

    let filtered = all;
    if (v12BMCActiveTab === 'done') filtered = all.filter(b => b.status === 'สำเร็จ');
    else if (v12BMCActiveTab === 'pending') filtered = all.filter(b => b.delivery_status === 'รอจัดส่ง');
    else if (v12BMCActiveTab === 'debt') filtered = all.filter(b => b.status === 'ค้างชำระ');
    else if (v12BMCActiveTab === 'returned') filtered = all.filter(b => b.status === 'คืนสินค้า' || b.status === 'คืนบางส่วน');

    const tbody = document.getElementById('bmc-tbody');
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="v12-bmc-empty">
        <i class="material-icons-round">receipt_long</i>
        <p style="font-size:14px;font-weight:600;margin:0 0 4px;">ไม่พบบิล</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(b => {
      const statusInfo = v12BMCBadge(b.status);
      const deliveryInfo = v12BMCDeliveryBadge(b.delivery_status);
      const methodInfo = v12BMCMethodBadge(b.method);
      const hasDebt = b.status === 'ค้างชำระ' && b.deposit_amount > 0;

      return `<tr>
        <td><strong>#${b.bill_no}</strong></td>
        <td style="font-size:12px;color:var(--text-muted,#6b7280);">
          ${formatDate(b.date)}<br>${formatTime(b.date)}
        </td>
        <td>
          <div style="font-size:13px;font-weight:500">${b.customer_name || 'ลูกค้าทั่วไป'}</div>
          <div style="font-size:11px;color:var(--text-muted,#9ca3af)">${b.staff_name || ''}</div>
        </td>
        <td>${methodInfo}</td>
        <td>${deliveryInfo}</td>
        <td style="text-align:right">
          <div style="font-size:14px;font-weight:700;">฿${formatNum(b.total)}</div>
          ${hasDebt ? `<div style="font-size:11px;color:#ef4444;">ค้าง ฿${formatNum(b.total - b.deposit_amount)}</div>` : ''}
        </td>
        <td>${statusInfo}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="v12-bmc-action-btn" onclick="viewBillDetail('${b.id}')" title="ดูรายละเอียด">
              <i class="material-icons-round" style="font-size:13px">receipt</i> ดู
            </button>
            <button class="v12-bmc-action-btn" onclick="v12PrintReceipt80mm('${b.id}')" title="พิมพ์">
              <i class="material-icons-round" style="font-size:13px">print</i>
            </button>
            ${b.status === 'สำเร็จ' || b.status === 'รอจัดส่ง' || b.status === 'จ่ายแล้วบางส่วน' ? `
            <button class="v12-bmc-action-btn danger" onclick="v12ReturnBill('${b.id}')" title="คืนสินค้า" style="color:#ef4444; border-color:rgba(239,68,68,0.2);">
              <i class="material-icons-round" style="font-size:13px">assignment_return</i> คืน
            </button>
            <button class="v12-bmc-action-btn danger" onclick="cancelBill('${b.id}')" title="ยกเลิก">
              <i class="material-icons-round" style="font-size:13px">cancel</i>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch(e) {
    console.error('[v12] BMCLoad error:', e);
    const tbody = document.getElementById('bmc-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:#ef4444;">โหลดไม่สำเร็จ: ${e.message}</td></tr>`;
  }
};

function v12BMCBadge(status) {
  const map = {
    'สำเร็จ': ['v12-badge-green', '✓ สำเร็จ'],
    'รอจัดส่ง': ['v12-badge-yellow', '🚚 รอส่ง'],
    'ค้างชำระ': ['v12-badge-red', '⚠ ค้างชำระ'],
    'คืนสินค้า': ['v12-badge-purple', '↩ คืนสินค้า'],
    'คืนบางส่วน': ['v12-badge-purple', '↩ คืนบางส่วน'],
    'ยกเลิก': ['v12-badge-gray', '✕ ยกเลิก'],
  };
  const [cls, lbl] = map[status] || ['v12-badge-gray', status || '-'];
  return `<span class="v12-status-badge ${cls}">${lbl}</span>`;
}

function v12BMCDeliveryBadge(ds) {
  if (!ds || ds === 'สำเร็จ') return '<span class="v12-status-badge v12-badge-green" style="font-size:11px">รับเอง/สำเร็จ</span>';
  if (ds === 'รอจัดส่ง') return '<span class="v12-status-badge v12-badge-yellow" style="font-size:11px">🚚 รอส่ง</span>';
  if (ds === 'จัดส่งสำเร็จ') return '<span class="v12-status-badge v12-badge-green" style="font-size:11px">✓ ส่งแล้ว</span>';
  return `<span class="v12-status-badge v12-badge-gray" style="font-size:11px">${ds}</span>`;
}

function v12BMCMethodBadge(method) {
  if (method === 'เงินสด') return `<span class="v12-status-badge v12-badge-green" style="font-size:11px">💵 เงินสด</span>`;
  if (method === 'โอนเงิน') return `<span class="v12-status-badge v12-badge-blue" style="font-size:11px">📱 โอน</span>`;
  if (method === 'บัตรเครดิต') return `<span class="v12-status-badge v12-badge-purple" style="font-size:11px">💳 บัตร</span>`;
  return `<span class="v12-status-badge v12-badge-gray" style="font-size:11px">${method || '-'}</span>`;
}

window.v12BMCExport = async function () {
  const date = document.getElementById('bmc-date')?.value || new Date().toISOString().split('T')[0];
  try {
    const { data: bills } = await db.from('บิลขาย').select('*').gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59').order('date', { ascending: false });
    if (!bills?.length) { toast('ไม่มีข้อมูลในวันนี้', 'warning'); return; }
    const rows = [['บิล#', 'วันที่', 'ลูกค้า', 'วิธีชำระ', 'ยอด', 'ส่วนลด', 'รับเงิน', 'ทอน', 'มัดจำ', 'สถานะ', 'จัดส่ง', 'วันนัดส่ง']];
    bills.forEach(b => rows.push([b.bill_no, formatDateTime(b.date), b.customer_name || 'ทั่วไป', b.method, b.total, b.discount || 0, b.received || 0, b.change || 0, b.deposit_amount || 0, b.status, b.delivery_status || '-', b.delivery_date || '-']));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = `sales_${date}.csv`;
    a.click();
    toast('Export สำเร็จ', 'success');
  } catch(e) { toast('Export ไม่สำเร็จ: ' + e.message, 'error'); }
};

/* --- Implementation of Return Bill --- */
window.v12ReturnBill = async function (billId) {
  try {
    const result = await Swal.fire({
      title: 'คืนสินค้าทั้งหมด?',
      text: 'ระบบจะยกเลิกบิลและคืนสต็อกสินค้าที่ตัดไปแล้วทั้งหมด (คูณ 1400 กก. อัตโนมัติ)',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันคืนสินค้า',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7c3aed',
    });
    if (!result.isConfirmed) return;

    // Fetch bill details
    const { data: bill, error: billErr } = await db.from('บิลขาย').select('*').eq('id', billId).single();
    if (billErr) throw billErr;
    if (bill.status === 'คืนสินค้า' || bill.status === 'ยกเลิก') {
      toast('บิลนี้ถูกคืนหรือยกเลิกไปแล้ว', 'warning'); return;
    }

    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
    
    // Determine how much was already deducted
    const wasDelivered = bill.delivery_status === 'จัดส่งสำเร็จ';
    const multiplier = 1400;

    for (const it of (items || [])) {
      if (!it.product_id) continue;
      
      let restoreQty = it.take_qty || 0;
      if (wasDelivered) restoreQty += (it.deliver_qty || 0);

      if (restoreQty > 0) {
        const prod = (typeof products !== 'undefined') ? products.find(p => p.id === it.product_id) : null;
        const stockBefore = prod?.stock || 0;
        const restoreAmount = restoreQty * multiplier;
        const stockAfter = stockBefore + restoreAmount;
        
        await db.from('สินค้า').update({ stock: stockAfter }).eq('id', it.product_id);
        
        // Log movement
        try {
          await db.from('stock_movement').insert({
            product_id: it.product_id, product_name: it.name,
            type: 'คืนสินค้า', direction: 'in', qty: restoreAmount,
            stock_before: stockBefore, stock_after: stockAfter,
            ref_id: billId, ref_table: 'บิลขาย',
            staff_name: (typeof USER !== 'undefined' && USER) ? USER.username : 'system',
          });
        } catch(e) {}
        if (prod) prod.stock = stockAfter;
      }
    }

    // Update Bill Status
    await db.from('บิลขาย').update({ status: 'คืนสินค้า', delivery_status: 'ยกเลิก' }).eq('id', billId);

    // Update Customer Stats
    if (bill.customer_id) {
      try {
        const { data: cust } = await db.from('customer').select('*').eq('id', bill.customer_id).single();
        if (cust) {
          const debtAmt = (bill.total - (bill.deposit_amount || 0));
          await db.from('customer').update({
            total_purchase: Math.max(0, (cust.total_purchase || 0) - bill.total),
            debt_amount: Math.max(0, (cust.debt_amount || 0) - debtAmt)
          }).eq('id', bill.customer_id);
        }
      } catch(e) {}
    }

    toast('คืนสินค้าสำเร็จ คืนสต็อกเรียบร้อย', 'success');
    if (typeof loadProducts === 'function') await loadProducts();
    if (typeof updateHomeStats === 'function') updateHomeStats();
    if (typeof v12BMCLoad === 'function') v12BMCLoad(); 

  } catch (e) {
    console.error('[v12] Return Error:', e);
    toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
};

/* ──────────────────────────────────────────────────────────────
   HOOK: patch go() to support 'delivery' page
────────────────────────────────────────────────────────────── */
(function hookNavigation() {
  function patchGo() {
    if (typeof go !== 'function') { setTimeout(patchGo, 100); return; }
    const _origGo = go;
    window.go = function (page) {
      _origGo(page);
      if (page === 'delivery') {
        const sec = document.getElementById('page-delivery');
        if (sec) {
          // Hide all other pages first
          document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
          sec.classList.remove('hidden');
          // Update page title
          const titleEl = document.getElementById('page-title-text');
          if (titleEl) titleEl.textContent = '🚚 คิวจัดส่ง';
          // Update sidebar active state
          document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
          const navItem = document.querySelector('[data-page="delivery"]');
          if (navItem) navItem.classList.add('active');
        }
        renderDelivery();
      }
    };
  }
  patchGo();
})();

/* Update delivery badge count on load */
(async function updateDeliveryBadge() {
  try {
    const { data } = await db.from('บิลขาย').select('id, delivery_status, delivery_mode, status');
    const cnt = (data || []).filter(b =>
      b.delivery_status === 'รอจัดส่ง' ||
      (b.delivery_mode && b.delivery_mode !== 'รับเอง' && b.delivery_status !== 'จัดส่งสำเร็จ' && b.status !== 'ยกเลิก')
    ).length;
    const badge = document.getElementById('delivery-count-badge');
    if (badge) {
      badge.textContent = cnt;
      badge.classList.toggle('hidden', cnt === 0);
    }
  } catch (e) { /* silent */ }
})();

console.log('[v12] modules-v12.js loaded ✅ — Checkout 6-step + นับแบงค์, Delivery Queue, Bill Management Center');
