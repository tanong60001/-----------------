/**
 * SK POS — modules-v12.js
 * ════════════════════════════════════════════════════════════════
 * Override 3 ระบบหลัก (ไม่แตะฟังก์ชันอื่นนอกคำสั่ง):
 *  1. Split-Layout Checkout — 6 Steps (F10)
 *  2. Delivery Queue Module — หน้าคิวส่งของ
 *  3. Bill Management Center — หน้าประวัติการขายใหม่
 * ════════════════════════════════════════════════════════════════
 */

/* ──────────────────────────────────────────────────────────────
   INJECT STYLES
────────────────────────────────────────────────────────────── */
(function injectV12Styles() {
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
  transition: all .2s;
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
  font-family: inherit;
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

/* Cash handling */
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
}
.v12-denom-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }
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
  box-shadow: 0 2px 8px rgba(0,0,0,.04); transition: box-shadow .15s;
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
}
`;
  document.head.appendChild(style);
})();

/* ──────────────────────────────────────────────────────────────
   SECTION 1: SPLIT-LAYOUT CHECKOUT (6 STEPS)
────────────────────────────────────────────────────────────── */

// Extended checkout state
let v12State = {
  step: 1,
  total: 0, discount: 0,
  customer: { type: 'general', id: null, name: 'ลูกค้าทั่วไป' },
  deliveryMode: 'self',          // 'self' | 'deliver' | 'partial'
  deliveryDate: '',
  deliveryAddress: '',
  paymentType: 'full',           // 'full' | 'deposit'
  depositAmount: 0,
  method: 'cash',                // cash | transfer | credit
  received: 0, change: 0,
  receivedDenominations: {},
  changeDenominations: {},
  // cart line data per item: { take_qty, deliver_qty }
  itemModes: {},
  savedBill: null,
};

const V12_STEPS = [
  { label: 'ลูกค้า', icon: 'person' },
  { label: 'รูปแบบรับ', icon: 'local_shipping' },
  { label: 'ชำระเงิน', icon: 'payments' },
  { label: 'วิธีชำระ', icon: 'credit_card' },
  { label: 'รับเงิน', icon: 'account_balance_wallet' },
  { label: 'บันทึก', icon: 'check_circle' },
];

/* Override startCheckout */
window.startCheckout = function () {
  if (!cart || cart.length === 0) return;
  const discount = Number(document.getElementById('pos-discount')?.value || 0);
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const total = Math.max(0, subtotal - discount);

  v12State = {
    step: 1, total, discount,
    customer: { type: 'general', id: null, name: 'ลูกค้าทั่วไป' },
    deliveryMode: 'self', deliveryDate: '', deliveryAddress: '',
    paymentType: 'full', depositAmount: 0,
    method: 'cash', received: 0, change: 0,
    receivedDenominations: {}, changeDenominations: {},
    itemModes: {}, savedBill: null,
  };
  [...BILLS, ...COINS].forEach(d => {
    v12State.receivedDenominations[d.value] = 0;
    v12State.changeDenominations[d.value] = 0;
  });
  // default take_qty = full qty (self pickup)
  cart.forEach(item => {
    v12State.itemModes[item.id] = { take: item.qty, deliver: 0 };
  });

  v12RenderShell();
};

/* Override closeCheckout */
window.closeCheckout = function () {
  const el = document.getElementById('v12-checkout-overlay');
  if (el) el.remove();
};

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
      <!-- LEFT: Cart summary -->
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
        <div class="v12-left-footer">
          ${v12State.discount > 0 ? `
            <div class="v12-summary-row">
              <span>ราคารวม</span>
              <span>฿${formatNum(cart.reduce((s,c)=>s+c.price*c.qty,0))}</span>
            </div>
            <div class="v12-summary-row">
              <span>ส่วนลด</span>
              <span style="color:#ef4444">-฿${formatNum(v12State.discount)}</span>
            </div>` : ''}
          <div class="v12-summary-row total">
            <span>ยอดสุทธิ</span>
            <span>฿${formatNum(v12State.total)}</span>
          </div>
          ${v12State.paymentType === 'deposit' && v12State.depositAmount > 0 ? `
            <div class="v12-deposit-badge">
              มัดจำ ฿${formatNum(v12State.depositAmount)} | ค้าง ฿${formatNum(v12State.total - v12State.depositAmount)}
            </div>` : ''}
        </div>
      </div>
      <!-- RIGHT: Steps -->
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

function v12UpdateStepBar() {
  const bar = document.getElementById('v12-steps-bar');
  if (!bar) return;
  const totalSteps = v12NeedsStepCash() ? 6 : 5;
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

function v12NeedsStepCash() {
  return v12State.method === 'cash';
}

function v12GetMaxStep() {
  return v12NeedsStepCash() ? 6 : 5;
}

function v12IsLastStep() {
  return v12State.step === v12GetMaxStep();
}

function v12RenderStepBody() {
  const body = document.getElementById('v12-step-body');
  if (!body) return;
  const backBtn = document.getElementById('v12-back-btn');
  const nextBtn = document.getElementById('v12-next-btn');
  if (backBtn) backBtn.style.display = v12State.step > 1 ? 'flex' : 'none';
  if (nextBtn) {
    if (v12IsLastStep() && v12State.savedBill) {
      nextBtn.style.display = 'none';
    } else if (v12State.step === (v12NeedsStepCash() ? 5 : 4)) {
      nextBtn.innerHTML = `<i class="material-icons-round">check</i> ยืนยันการขาย`;
      nextBtn.className = 'v12-btn-next green';
    } else {
      nextBtn.innerHTML = `ถัดไป <i class="material-icons-round">arrow_forward</i>`;
      nextBtn.className = 'v12-btn-next';
    }
  }

  // Map logical step (skipping cash step for non-cash)
  let renderFn;
  if (!v12NeedsStepCash()) {
    // steps: 1,2,3,4,5 → 1,2,3,4,6
    const map = [null, v12S1, v12S2, v12S3, v12S4, v12S6];
    renderFn = map[v12State.step];
  } else {
    const map = [null, v12S1, v12S2, v12S3, v12S4, v12S5, v12S6];
    renderFn = map[v12State.step];
  }
  if (renderFn) renderFn(body);
}

function v12NextStep() {
  // Validate per step
  if (v12State.step === 1) {
    const needsCust = v12State.deliveryMode !== 'self' || v12State.paymentType === 'deposit';
    if (needsCust && v12State.customer.type === 'general') {
      toast('บิลนี้ต้องระบุลูกค้า กรุณาเลือกลูกค้าประจำหรือสร้างใหม่', 'warning'); return;
    }
  }
  if (v12State.step === 2) {
    if ((v12State.deliveryMode === 'deliver' || v12State.deliveryMode === 'partial') && !v12State.deliveryDate) {
      toast('กรุณาระบุวันที่นัดส่ง', 'warning'); return;
    }
  }
  if (v12State.step === 3) {
    if (v12State.paymentType === 'deposit') {
      const dep = Number(document.getElementById('v12-deposit-input')?.value || 0);
      if (!dep || dep <= 0) { toast('กรุณาระบุยอดมัดจำ', 'warning'); return; }
      if (dep >= v12State.total) { toast('ยอดมัดจำต้องน้อยกว่ายอดรวม', 'warning'); return; }
      v12State.depositAmount = dep;
    }
  }
  if (v12State.step === 4) {
    if (!v12State.method) { toast('กรุณาเลือกวิธีชำระเงิน', 'warning'); return; }
  }
  // Cash step validation
  if (v12NeedsStepCash() && v12State.step === 5) {
    const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    const received = Object.entries(v12State.receivedDenominations).reduce((s, [v, c]) => s + Number(v) * c, 0);
    if (received < payAmt) { toast('ยอดรับเงินไม่เพียงพอ', 'error'); return; }
    v12State.received = received;
    v12State.change = received - payAmt;
    v12State.changeDenominations = calcChangeDenominations(v12State.change);
  }
  // Last non-cash step → complete
  if (!v12NeedsStepCash() && v12State.step === 4) {
    v12State.received = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    v12State.change = 0;
    v12State.step = 5; // jump to complete
    v12CompletePayment(); return;
  }
  // Cash: step 5 → complete
  if (v12NeedsStepCash() && v12State.step === 5) {
    v12State.step = 6;
    v12CompletePayment(); return;
  }

  v12State.step++;
  v12UpdateUI();
}

function v12PrevStep() {
  if (v12State.step > 1) v12State.step--;
  v12UpdateUI();
}

function v12UpdateUI() {
  v12UpdateStepBar();
  v12RenderStepBody();
  // Refresh left panel
  const leftFooter = document.querySelector('.v12-left-footer');
  if (leftFooter) {
    leftFooter.innerHTML = `
      ${v12State.discount > 0 ? `
        <div class="v12-summary-row"><span>ราคารวม</span><span>฿${formatNum(cart.reduce((s,c)=>s+c.price*c.qty,0))}</span></div>
        <div class="v12-summary-row"><span>ส่วนลด</span><span style="color:#ef4444">-฿${formatNum(v12State.discount)}</span></div>` : ''}
      <div class="v12-summary-row total"><span>ยอดสุทธิ</span><span>฿${formatNum(v12State.total)}</span></div>
      ${v12State.paymentType === 'deposit' && v12State.depositAmount > 0 ? `
        <div class="v12-deposit-badge">มัดจำ ฿${formatNum(v12State.depositAmount)} | ค้าง ฿${formatNum(v12State.total - v12State.depositAmount)}</div>` : ''}`;
  }
}

/* ── STEP 1: เลือกลูกค้า ── */
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
  if (type === 'general') { v12State.customer.id = null; v12State.customer.name = 'ลูกค้าทั่วไป'; }
  document.querySelectorAll('.v12-cust-card').forEach((c, i) => {
    const types = ['general', 'member', 'new'];
    c.classList.toggle('selected', types[i] === type);
  });
  v12RenderCustForm(document.getElementById('v12-cust-form'));
};

function v12RenderCustForm(container) {
  if (!container) return;
  if (v12State.customer.type === 'member') {
    container.innerHTML = `
      <div class="v12-cust-search">
        <div class="v12-form-group">
          <label>ค้นหาลูกค้าประจำ</label>
          <input type="text" id="v12-cust-search-input" placeholder="พิมพ์ชื่อหรือเบอร์โทร..." oninput="v12SearchCustomers(this.value)"
            style="border:1.5px solid var(--border,#d1d5db);border-radius:8px;padding:10px 14px;font-size:14px;font-family:inherit;width:100%;box-sizing:border-box;">
        </div>
        <div id="v12-cust-results" style="margin-top:8px;max-height:180px;overflow-y:auto;"></div>
        ${v12State.customer.id ? `
          <div style="margin-top:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:600;color:#15803d;">
            ✓ เลือก: ${v12State.customer.name}
          </div>` : ''}
      </div>`;
  }  else if (v12State.customer.type === 'new') {
    container.innerHTML = `
      <div class="v12-cust-search">
        <div class="v12-form-row">
          <div class="v12-form-group">
            <label>ชื่อลูกค้า *</label>
            <input type="text" id="v12-new-cust-name" placeholder="ชื่อ-นามสกุล">
          </div>
          <div class="v12-form-group">
            <label>เบอร์โทร</label>
            <input type="tel" id="v12-new-cust-phone" placeholder="0XX-XXX-XXXX">
          </div>
        </div>
        <div class="v12-form-group" style="margin-top:12px;">
          <label>ที่อยู่ (สำหรับจัดส่ง / ใบกำกับภาษี) *</label>
          <textarea id="v12-new-cust-addr" rows="2" placeholder="บ้านเลขที่, ถนน, ตำบล..."></textarea>
        </div>
        <button onclick="v12SaveNewCustomer()" class="v12-print-btn primary" style="margin-top:12px;width:auto;padding:9px 20px;">
          <i class="material-icons-round" style="font-size:16px">save</i> บันทึกลูกค้าใหม่
        </button>
      </div>`;
  }
   else {
    container.innerHTML = '';
  }
}

window.v12SearchCustomers = async function (q) {
  const res = document.getElementById('v12-cust-results');
  if (!res) return;
  if (!q) { res.innerHTML = ''; return; }
  const { data } = await db.from('customer').select('id, name, phone').ilike('name', `%${q}%`).limit(8);
  res.innerHTML = (data || []).map(c => `
    <div onclick="v12PickCustomer('${c.id}','${c.name.replace(/'/g,"\\'")}','${c.phone||''}')"
      style="padding:9px 14px;border-radius:8px;cursor:pointer;font-size:13px;transition:background .12s;"
      onmouseover="this.style.background='var(--bg-secondary,#f9fafb)'" onmouseout="this.style.background=''"
    >
      <strong>${c.name}</strong> <span style="color:var(--text-muted,#9ca3af);margin-left:8px;">${c.phone || ''}</span>
    </div>`).join('') || '<div style="padding:10px;color:var(--text-muted,#9ca3af);font-size:13px;">ไม่พบลูกค้า</div>';
};

window.v12PickCustomer = function (id, name, phone) {
  v12State.customer.id = id;
  v12State.customer.name = name;
  document.getElementById('v12-cust-results').innerHTML = '';
  const inp = document.getElementById('v12-cust-search-input');
  if (inp) inp.value = name;
  const form = document.getElementById('v12-cust-form');
  if (form) v12RenderCustForm(form);
};

window.v12SaveNewCustomer = async function () {
  const name = document.getElementById('v12-new-cust-name')?.value?.trim();
  const phone = document.getElementById('v12-new-cust-phone')?.value?.trim();
  const address = document.getElementById('v12-new-cust-addr')?.value?.trim();
  if (!name || !address) { toast('กรุณากรอกชื่อและที่อยู่', 'warning'); return; }
  
  const { data, error } = await db.from('customer').insert({ name, phone: phone || null, address, total_purchase: 0, visit_count: 0, debt_amount: 0 }).select().single();
  if (error) { toast('บันทึกไม่สำเร็จ', 'error'); return; }
  
  v12State.customer.id = data.id;
  v12State.customer.name = data.name;
  v12State.deliveryAddress = data.address; // โยนที่อยู่ไปรอในหน้าจัดส่งเลย
  toast(`บันทึกลูกค้าสำเร็จ`, 'success');
  v12RenderCustForm(document.getElementById('v12-cust-form'));
};

/* ── STEP 2: รูปแบบรับสินค้า ── */
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
    <div id="v12-delivery-form-area">
      ${showForm ? v12DeliveryFormHTML() : ''}
    </div>
    ${v12State.deliveryMode === 'partial' ? `
      <div style="margin-top:16px;">
        <h4 style="font-size:13px;font-weight:700;margin:0 0 10px;color:var(--text-secondary,#374151);">กำหนดจำนวนรับเอง/ส่งทีหลัง</h4>
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
      </div>` : ''}`;

  // Save delivery date/address if already filled
  if (showForm) {
    const dateIn = container.querySelector('#v12-d-date');
    const addrIn = container.querySelector('#v12-d-addr');
    if (dateIn && v12State.deliveryDate) dateIn.value = v12State.deliveryDate;
    if (addrIn && v12State.deliveryAddress) addrIn.value = v12State.deliveryAddress;
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
          <input type="tel" id="v12-d-phone" placeholder="0XX-XXX-XXXX">
        </div>
      </div>
      <div class="v12-form-group">
        <label>ที่อยู่จัดส่ง *</label>
        <textarea id="v12-d-addr" rows="2" placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
          onchange="v12State.deliveryAddress=this.value">${v12State.deliveryAddress}</textarea>
      </div>
    </div>`;
}

window.v12SetDeliveryMode = function (mode) {
  v12State.deliveryMode = mode;
  // update item modes
  cart.forEach(item => {
    if (mode === 'self') v12State.itemModes[item.id] = { take: item.qty, deliver: 0 };
    else if (mode === 'deliver') v12State.itemModes[item.id] = { take: 0, deliver: item.qty };
    else v12State.itemModes[item.id] = { take: Math.floor(item.qty / 2), deliver: item.qty - Math.floor(item.qty / 2) };
  });
  const body = document.getElementById('v12-step-body');
  if (body) v12S2(body);
};

window.v12SetItemMode = function (id, val, field, max) {
  if (!v12State.itemModes[id]) v12State.itemModes[id] = { take: 0, deliver: 0 };
  const n = Math.min(Math.max(0, Number(val)), max);
  v12State.itemModes[id][field] = n;
  const other = field === 'take' ? 'deliver' : 'take';
  v12State.itemModes[id][other] = max - n;
};

/* ── STEP 3: รูปแบบการชำระเงิน ── */
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
    <div id="v12-deposit-area">
      ${v12State.paymentType === 'deposit' ? v12DepositHTML() : ''}
    </div>`;
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

/* ── STEP 4: วิธีชำระเงิน ── */
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
    <div id="v12-method-extra">
      ${v12State.method === 'transfer' ? v12QRBox(payAmt) : ''}
    </div>`;
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
  document.querySelectorAll('.v12-method-card').forEach((c, i) => {
    const methods = ['cash', 'transfer', 'credit'];
    c.classList.toggle('selected', methods[i] === method);
  });
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const extra = document.getElementById('v12-method-extra');
  if (extra) extra.innerHTML = method === 'transfer' ? v12QRBox(payAmt) : '';
  // Update next button
  v12RenderStepBody();
};

/* ── STEP 5: รับเงิน/ทอนเงิน (cash only) ── */
function v12S5(container) {
  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
  const received = Object.entries(v12State.receivedDenominations).reduce((s, [v, c]) => s + Number(v) * c, 0);

  container.innerHTML = `
    <h2 class="v12-step-title">รับเงิน</h2>
    <p class="v12-step-subtitle">กรอกจำนวนแบงค์ที่รับมาจากลูกค้า</p>
    <div class="v12-cash-header">
      <div><div class="label">ยอดที่ต้องรับ</div><div class="amount">฿${formatNum(payAmt)}</div></div>
      <div style="text-align:right"><div class="label">รับมาแล้ว</div><div class="amount" id="v12-recv-total" style="color:${received >= payAmt ? '#10b981' : 'var(--primary,#3b82f6)'}">฿${formatNum(received)}</div></div>
    </div>
    <div class="v12-denom-grid">
      ${[...BILLS, ...COINS].map(d => {
        const cnt = v12State.receivedDenominations[d.value] || 0;
        return `
        <div class="v12-denom-btn" onclick="v12AddDenom(${d.value})">
          <span class="v12-denom-count ${cnt > 0 ? 'show' : ''}" id="v12-cnt-${d.value}">${cnt}</span>
          <div class="v12-denom-swatch" style="background:${d.bg}"></div>
          <span class="v12-denom-label">฿${d.label}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="v12-quick-amounts">
      <span style="font-size:12px;color:var(--text-muted,#9ca3af);align-self:center;">รับพอดี:</span>
      ${[payAmt, Math.ceil(payAmt / 100) * 100, Math.ceil(payAmt / 500) * 500, Math.ceil(payAmt / 1000) * 1000]
        .filter((v, i, a) => a.indexOf(v) === i && v >= payAmt)
        .slice(0, 4)
        .map(v => `<button class="v12-quick-btn" onclick="v12SetExact(${v})">฿${formatNum(v)}</button>`).join('')}
      <button class="v12-quick-btn" onclick="v12ClearDenoms()" style="margin-left:auto;color:#ef4444;">
        <i class="material-icons-round" style="font-size:14px">refresh</i> ล้าง
      </button>
    </div>
    <div class="v12-received-bar">
      <span style="font-size:13px;color:var(--text-muted,#9ca3af);">ทอน:</span>
      <strong id="v12-change-display" style="font-size:18px;color:${received >= payAmt ? '#10b981' : 'var(--text-muted,#9ca3af)'};">
        ฿${received >= payAmt ? formatNum(received - payAmt) : '-'}
      </strong>
    </div>`;
}

window.v12AddDenom = function (val) {
  v12State.receivedDenominations[val] = (v12State.receivedDenominations[val] || 0) + 1;
  v12UpdateCashDisplay();
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

  const recvEl = document.getElementById('v12-recv-total');
  const changeEl = document.getElementById('v12-change-display');
  if (recvEl) {
    recvEl.textContent = `฿${formatNum(received)}`;
    recvEl.style.color = received >= payAmt ? '#10b981' : 'var(--primary,#3b82f6)';
  }
  if (changeEl) {
    changeEl.textContent = received >= payAmt ? `฿${formatNum(change)}` : '-';
    changeEl.style.color = received >= payAmt ? '#10b981' : 'var(--text-muted,#9ca3af)';
  }
  [...BILLS, ...COINS].forEach(d => {
    const cnt = v12State.receivedDenominations[d.value] || 0;
    const el = document.getElementById(`v12-cnt-${d.value}`);
    if (el) { el.textContent = cnt; el.classList.toggle('show', cnt > 0); }
  });
}

/* ── STEP 6: บันทึก (Complete) ── */
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
      <tr><td>วิธีชำระ</td><td>${v12State.method === 'cash' ? 'เงินสด' : v12State.method === 'transfer' ? 'โอนเงิน' : 'บัตรเครดิต'}</td></tr>
      ${isDeposit ? `<tr><td>ยอดมัดจำ</td><td style="color:#f59e0b;font-weight:700;">฿${formatNum(v12State.depositAmount)}</td></tr>
        <tr><td>ยอดค้างชำระ</td><td style="color:#ef4444;font-weight:700;">฿${formatNum(v12State.total - v12State.depositAmount)}</td></tr>` : ''}
      ${v12State.method === 'cash' ? `<tr><td>รับมา</td><td>฿${formatNum(v12State.received)}</td></tr>
        <tr><td>ทอน</td><td style="color:#10b981;font-weight:700;">฿${formatNum(v12State.change)}</td></tr>` : ''}
      ${hasDelivery ? `<tr><td>การจัดส่ง</td><td style="color:#8b5cf6;font-weight:600;">${v12State.deliveryMode === 'deliver' ? '🚚 ร้านไปส่ง' : '📦 รับบางส่วน'}</td></tr>
        <tr><td>วันนัดส่ง</td><td>${v12State.deliveryDate || '-'}</td></tr>` : ''}
    </table>
    ${hasDelivery ? `<div class="v12-delivery-notice">
      <i class="material-icons-round" style="font-size:16px;flex-shrink:0">info</i>
      สินค้าที่รอจัดส่งจะตัดสต็อกเมื่อกด "จัดส่งสำเร็จ" ในหน้าคิวส่งของ
    </div>` : ''}
    <div class="v12-print-options" style="margin-top:16px;">
      ${v12PrintButtons(b, hasDelivery, isDeposit)}
    </div>`;

  // Hide next button
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
  if (hasDelivery) {
    btns += `
      <button class="v12-print-btn" onclick="v12PrintDeliveryNote('${b.id}')">
        <i class="material-icons-round" style="font-size:16px">local_shipping</i> ใบส่งของ
      </button>`;
  }
  if (isDeposit) {
    btns += `
      <button class="v12-print-btn" onclick="v12PrintDeposit('${b.id}')">
        <i class="material-icons-round" style="font-size:16px">receipt_long</i> ใบมัดจำ
      </button>`;
  }
  btns += `
    <button class="v12-print-btn" onclick="closeCheckout()" style="color:var(--text-muted,#9ca3af);border-color:var(--border,#d1d5db);">
      <i class="material-icons-round" style="font-size:16px">close</i> ปิด
    </button>`;
  return btns;
}

/* ── Complete Payment Logic ── */
async function v12CompletePayment() {
  if (isProcessingPayment) return;
  isProcessingPayment = true;

  // Refresh complete step UI (loading state)
  v12UpdateStepBar();
  v12RenderStepBody();

  try {
    const { data: session } = await db.from('cash_session').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).single();

    const methodMap = { cash: 'เงินสด', transfer: 'โอนเงิน', credit: 'บัตรเครดิต' };
    const deliversModeMap = { self: 'รับเอง', deliver: 'จัดส่ง', partial: 'รับบางส่วน' };

    const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;
    const debtAmt = v12State.paymentType === 'deposit' ? (v12State.total - v12State.depositAmount) : 0;

    const billStatus = debtAmt > 0 ? 'ค้างชำระ' :
      (v12State.deliveryMode !== 'self' ? 'รอจัดส่ง' : 'สำเร็จ');

    // Check delivery_status for items
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
      staff_name: USER?.username,
      status: billStatus,
      denominations: v12State.receivedDenominations,
      delivery_mode: deliversModeMap[v12State.deliveryMode],
      delivery_date: v12State.deliveryDate || null,
      delivery_address: v12State.deliveryAddress || null,
      delivery_status: hasDeliverItems ? 'รอจัดส่ง' : 'สำเร็จ',
      deposit_amount: v12State.depositAmount || 0,
    }).select().single();

    if (billError) throw billError;

    // Insert bill items with take_qty / deliver_qty
    for (const item of cart) {
      const modes = v12State.itemModes[item.id] || { take: item.qty, deliver: 0 };
      await db.from('รายการในบิล').insert({
        bill_id: bill.id,
        product_id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        cost: item.cost,
        total: item.price * item.qty,
        take_qty: modes.take,
        deliver_qty: modes.deliver,
      });

      // Deduct stock only for take_qty
      if (modes.take > 0) {
        const prod = products.find(p => p.id === item.id);
        const stockBefore = prod?.stock || 0;
        const stockAfter = stockBefore - modes.take;
        await db.from('สินค้า').update({ stock: stockAfter }).eq('id', item.id);
        await db.from('stock_movement').insert({
          product_id: item.id, product_name: item.name,
          type: 'ขาย', direction: 'out', qty: modes.take,
          stock_before: stockBefore, stock_after: stockAfter,
          ref_id: bill.id, ref_table: 'บิลขาย',
          staff_name: USER?.username,
        });
      }
    }

    // Cash transaction
    if (v12State.method === 'cash' && session) {
      await db.from('cash_transaction').insert({
        session_id: session.id, type: 'ขาย', direction: 'in',
        amount: v12State.received, change_amt: v12State.change,
        net_amount: payAmt, balance_after: 0,
        ref_id: bill.id, ref_table: 'บิลขาย',
        staff_name: USER?.username,
        denominations: v12State.receivedDenominations,
      });
    }

    // Update customer
    if (v12State.customer.id) {
      const { data: cust } = await db.from('customer').select('total_purchase, visit_count, debt_amount').eq('id', v12State.customer.id).single();
      await db.from('customer').update({
        total_purchase: (cust?.total_purchase || 0) + v12State.total,
        visit_count: (cust?.visit_count || 0) + 1,
        debt_amount: (cust?.debt_amount || 0) + debtAmt,
      }).eq('id', v12State.customer.id);
    }

    logActivity('ขายสินค้า', `บิล #${bill.bill_no} ยอด ฿${formatNum(v12State.total)}`, bill.id, 'บิลขาย');
    sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: v12State.total });

    v12State.savedBill = bill;

    // Clear cart
    cart = [];
    if (typeof loadProducts === 'function') await loadProducts();
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderProductGrid === 'function') renderProductGrid();
    if (typeof updateHomeStats === 'function') updateHomeStats();

    // Render complete step
    v12UpdateStepBar();
    v12RenderStepBody();

  } catch (e) {
    console.error('v12 payment error:', e);
    toast('เกิดข้อผิดพลาดในการบันทึก: ' + e.message, 'error');
    v12State.step = v12NeedsStepCash() ? 5 : 4;
    v12UpdateUI();
  } finally {
    isProcessingPayment = false;
  }
}

/* ── Print helpers ── */
window.v12PrintReceipt80mm = function (billId) {
  if (typeof print80mmv2 === 'function') print80mmv2(billId);
  else if (typeof printReceipt === 'function') printReceipt(billId, '80mm');
  else toast('ฟังก์ชันพิมพ์ยังไม่พร้อม', 'warning');
};
window.v12PrintReceiptA4 = function (billId) {
  if (typeof printReceiptA4v2 === 'function') printReceiptA4v2(billId);
  else if (typeof printReceipt === 'function') printReceipt(billId, 'a4');
  else toast('ฟังก์ชันพิมพ์ยังไม่พร้อม', 'warning');
};
window.v12PrintDeliveryNote = async function (billId) {
  const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).single();
  const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
  const deliverItems = (items || []).filter(i => i.deliver_qty > 0);
  if (!deliverItems.length) { toast('ไม่มีรายการส่งของ', 'warning'); return; }
  const w = window.open('', '_blank', 'width=700,height=900');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>ใบส่งของ #${bill?.bill_no}</title>
    <style>
      body{font-family:'Sarabun',sans-serif;padding:30px;color:#111;font-size:14px}
      h2{font-size:20px;margin:0 0 4px}
      .info{color:#555;font-size:13px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:12px;border:1px solid #e5e7eb}
      td{padding:8px 12px;border:1px solid #e5e7eb;font-size:13px}
      .footer{margin-top:40px;font-size:12px;color:#777}
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  </head><body>
    <h2>ใบส่งของ</h2>
    <div class="info">
      <strong>${SHOP_CONFIG?.name || ''}</strong> — บิล #${bill?.bill_no}<br>
      ลูกค้า: ${bill?.customer_name || '-'}<br>
      วันนัดส่ง: ${bill?.delivery_date ? new Date(bill.delivery_date).toLocaleDateString('th-TH') : '-'}<br>
      ที่อยู่: ${bill?.delivery_address || '-'}
    </div>
    <table>
      <thead><tr><th>#</th><th>รายการ</th><th>จำนวนที่ส่ง</th><th>หน่วย</th></tr></thead>
      <tbody>
        ${deliverItems.map((it, i) => `<tr><td>${i+1}</td><td>${it.name}</td><td style="text-align:center;font-weight:700;">${it.deliver_qty}</td><td></td></tr>`).join('')}
      </tbody>
    </table>
    <div class="footer">
      ผู้รับสินค้า: ______________________ วันที่: ___________<br>
      ผู้จัดส่ง: ______________________ ลายเซ็น: ___________
    </div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
};

window.v12PrintDeposit = async function (billId) {
  const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).single();
  const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>ใบมัดจำ #${bill?.bill_no}</title>
    <style>
      body{font-family:'Sarabun',sans-serif;padding:20px;max-width:320px;margin:0 auto;font-size:13px}
      h2{text-align:center;font-size:16px}
      .center{text-align:center} .row{display:flex;justify-content:space-between;padding:3px 0}
      hr{border:none;border-top:1px dashed #999}
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  </head><body>
    <h2>${SHOP_CONFIG?.name || 'ร้านค้า'}</h2>
    <p class="center" style="font-size:12px;color:#555">ใบมัดจำ / ใบรับเงินบางส่วน</p>
    <hr>
    <div class="row"><span>บิล #</span><strong>${bill?.bill_no}</strong></div>
    <div class="row"><span>ลูกค้า</span><span>${bill?.customer_name}</span></div>
    <div class="row"><span>วันที่</span><span>${new Date(bill?.date).toLocaleDateString('th-TH')}</span></div>
    <hr>
    ${(items || []).map(it => `<div class="row"><span>${it.name} ×${it.qty}</span><span>฿${formatNum(it.total)}</span></div>`).join('')}
    <hr>
    <div class="row"><span>ยอดรวม</span><strong>฿${formatNum(bill?.total)}</strong></div>
    <div class="row"><span>ชำระแล้ว</span><strong style="color:#10b981">฿${formatNum(bill?.deposit_amount)}</strong></div>
    <div class="row"><span>ค้างชำระ</span><strong style="color:#ef4444">฿${formatNum(bill?.total - bill?.deposit_amount)}</strong></div>
    <hr>
    <p class="center" style="font-size:11px;color:#777">ขอบคุณที่ใช้บริการ</p>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
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
    // Pull all bills that have delivery_mode != รับเอง (safer than querying delivery_status directly)
    let query = db.from('บิลขาย').select('*').neq('delivery_mode', 'รับเอง').order('delivery_date', { ascending: true });

    // Also include bills where delivery_status = รอจัดส่ง
    // Use OR-style: fetch all then filter in JS to avoid 406 on missing columns
    const { data: allBills, error } = await db.from('บิลขาย')
      .select('*')
      .order('delivery_date', { ascending: true });

    if (error) throw error;

    // Filter in JS — safe even if columns are null
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

    // Update sidebar badge
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

  // Fetch items for all bills
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

window.v12DQPrintNote = function (billId) {
  v12PrintDeliveryNote(billId);
};

window.v12DQMarkDone = async function (billId) {
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

  try {
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
    const deliverItems = (items || []).filter(i => (i.deliver_qty || 0) > 0);

    for (const it of deliverItems) {
      if (!it.product_id) continue;
      const prod = products.find(p => p.id === it.product_id);
      const stockBefore = prod?.stock || 0;
      const stockAfter = stockBefore - it.deliver_qty;
      await db.from('สินค้า').update({ stock: stockAfter }).eq('id', it.product_id);
      await db.from('stock_movement').insert({
        product_id: it.product_id, product_name: it.name,
        type: 'จัดส่ง', direction: 'out', qty: it.deliver_qty,
        stock_before: stockBefore, stock_after: stockAfter,
        ref_id: billId, ref_table: 'บิลขาย',
        staff_name: USER?.username,
      });
      if (prod) prod.stock = stockAfter;
    }

    await db.from('บิลขาย').update({ delivery_status: 'จัดส่งสำเร็จ', status: 'สำเร็จ' }).eq('id', billId);
    logActivity('จัดส่งสำเร็จ', `บิล #${billId} ตัดสต็อกแล้ว`, billId, 'บิลขาย');

    const card = document.getElementById(`dq-card-${billId}`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateX(60px)';
      card.style.transition = 'all .3s ease';
      setTimeout(() => card.remove(), 300);
    }
    toast('จัดส่งสำเร็จ! ตัดสต็อกเรียบร้อย', 'success');
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
  const { data: bills } = await db.from('บิลขาย').select('*').gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59').order('date', { ascending: false });
  const all = (bills || []).filter(b =>
    !search || b.bill_no?.toString().includes(search) || b.customer_name?.toLowerCase().includes(search));

  // Count tabs
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
          ${b.status === 'สำเร็จ' || b.status === 'รอจัดส่ง' ? `
          <button class="v12-bmc-action-btn danger" onclick="cancelBill('${b.id}')" title="ยกเลิก">
            <i class="material-icons-round" style="font-size:13px">cancel</i>
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
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
  const [cls, lbl] = map[status] || ['v12-badge-gray', status];
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
};

/* ──────────────────────────────────────────────────────────────
   HOOK: patch go() to support 'delivery' page
────────────────────────────────────────────────────────────── */
(function hookNavigation() {
  // Wait until app.js defines go(), then wrap it
  function patchGo() {
    if (typeof go !== 'function') { setTimeout(patchGo, 100); return; }
    const _origGo = go;
    window.go = function (page) {
      _origGo(page);
      if (page === 'delivery') {
        // page-delivery is now in DOM, just render content
        const sec = document.getElementById('page-delivery');
        if (sec) sec.classList.remove('hidden');
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
/* ──────────────────────────────────────────────────────────────
   CUSTOMER DISPLAY INTEGRATION (Bridge for v12)
────────────────────────────────────────────────────────────── */
console.log('[v12] Activating Customer Display Bridge...');

// 1. ฟังก์ชันเปิดหน้าจอลูกค้า (เรียกใช้ผ่านปุ่มบน Navbar ได้)
let customerWindow = null;
window.openCustomerDisplay = function() {
  customerWindow = window.open('customer-display.html', 'CustomerDisplay', 'width=1024,height=768');
  if (customerWindow) {
    toast('เปิดหน้าจอลูกค้าเรียบร้อย', 'success');
  } else {
    toast('กรุณาอนุญาต Pop-up เพื่อเปิดหน้าจอลูกค้า', 'warning');
  }
};

// 2. ฟังก์ชันหลักสำหรับส่งข้อมูลไปที่หน้าจอ (ถ้ายังไม่มี)
window.sendToDisplay = function(payload) {
  if (customerWindow && !customerWindow.closed) {
    customerWindow.postMessage(payload, '*');
  }
};

// 3. ฟังก์ชันคำนวณและส่ง State ปัจจุบันไปที่จอลูกค้า
window.syncCustomerDisplay = function() {
  if (!customerWindow || customerWindow.closed) return;

  // 3.1 ส่งชื่อลูกค้าเสมอ
  sendToDisplay({ type: 'customer', name: v12State.customer.name });

  const payAmt = v12State.paymentType === 'deposit' ? v12State.depositAmount : v12State.total;

  // 3.2 ตรวจสอบว่าอยู่ Step ไหน แล้วโชว์หน้าจอให้ตรงกัน
  if (v12State.step === 1 || v12State.step === 2 || v12State.step === 3) {
    // โชว์รายการในตะกร้า
    sendToDisplay({ type: 'cart', cart: cart, total: v12State.total });
  } 
  else if (v12State.step === 4) {
    // หน้าเลือกวิธีชำระเงิน
    sendToDisplay({ 
      type: 'payment_method', 
      method: v12State.method, 
      total: payAmt 
    });
  } 
  else if (v12State.step === 5 && v12State.method === 'cash') {
    // หน้ารับเงินสด (Live Update เงินทอน)
    const received = Object.entries(v12State.receivedDenominations).reduce((s, [v, c]) => s + Number(v) * c, 0);
    const change = received - payAmt;
    sendToDisplay({ 
      type: 'checkout', 
      step: 3, // Step 3 ของฝั่งจอลูกค้าคือหน้า Cash
      total: payAmt, 
      method: 'cash', 
      received: received, 
      change: change 
    });
  }
};

// 4. ทำการ Hook (ดักจับ) ฟังก์ชันเดิมของ V12 เพื่อให้ยิงข้อมูลอัตโนมัติ
// Hook เข้ากับตอนเริ่ม Checkout
const _origV12Start = window.startCheckout;
window.startCheckout = function() {
  if (_origV12Start) _origV12Start.apply(this, arguments);
  syncCustomerDisplay();
};

// Hook เข้ากับตอนเปลี่ยน Step
const _origV12UpdateUI = window.v12UpdateUI;
window.v12UpdateUI = function() {
  if (_origV12UpdateUI) _origV12UpdateUI.apply(this, arguments);
  syncCustomerDisplay();
};

// Hook เข้ากับตอนนับแบงก์ (ให้เงินทอนบนจอลูกค้าเด้งแบบ Real-time)
const _origV12UpdateCash = window.v12UpdateCashDisplay;
window.v12UpdateCashDisplay = function() {
  if (_origV12UpdateCash) _origV12UpdateCash.apply(this, arguments);
  syncCustomerDisplay();
};

// Hook เข้ากับตอนเลือกวิธีชำระ
const _origV12SetMethod = window.v12SetMethod;
window.v12SetMethod = function(method) {
  if (_origV12SetMethod) _origV12SetMethod.apply(this, arguments);
  syncCustomerDisplay();
};

// Hook เข้ากับตอนปิด Modal ยิงหน้าจอกลับไปหน้า Idle หรือ ตะกร้า
const _origV12Close = window.closeCheckout;
window.closeCheckout = function() {
  if (_origV12Close) _origV12Close.apply(this, arguments);
  if (cart.length > 0) {
    sendToDisplay({ type: 'cart', cart: cart, total: cart.reduce((s, c) => s + c.price * c.qty, 0) });
  } else {
    sendToDisplay({ type: 'idle' });
  }
};

// Hook เข้ากับตอนเพิ่มสินค้าลงตะกร้า (อัปเดตจอทันทีแม้ยังไม่กด F10)
if (typeof renderCart === 'function') {
  const _origRenderCart = window.renderCart;
  window.renderCart = function() {
    if (_origRenderCart) _origRenderCart.apply(this, arguments);
    const discount = Number(document.getElementById('pos-discount')?.value || 0);
    const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
    sendToDisplay({ type: 'cart', cart: cart, total: Math.max(0, subtotal - discount) });
  };
}

console.log('[v12] modules-v12.js loaded — Checkout 6-step, Delivery Queue, Bill Management Center');