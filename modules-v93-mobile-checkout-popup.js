(function () {
  'use strict';

  function injectMobileCheckoutStyles() {
    if (document.getElementById('v93-mobile-checkout-popup-style')) return;
    const style = document.createElement('style');
    style.id = 'v93-mobile-checkout-popup-style';
    style.textContent = `
      @media (max-width: 768px) {
        html:has(.v12-checkout-overlay:not(.hidden)),
        body:has(.v12-checkout-overlay:not(.hidden)) {
          overflow: hidden !important;
        }

        .v12-checkout-overlay {
          padding: 0 !important;
          align-items: stretch !important;
          justify-content: stretch !important;
          background: rgba(15,23,42,.48) !important;
          backdrop-filter: blur(8px) saturate(110%) !important;
        }

        .v12-checkout-shell,
        .v12-checkout-shell.v12-pro-shell {
          width: 100dvw !important;
          max-width: none !important;
          height: 100dvh !important;
          max-height: none !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          grid-template-rows: auto minmax(0, 1fr) !important;
          border-radius: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          background: #f8fafc !important;
        }

        .v12-left {
          width: 100% !important;
          height: auto !important;
          max-height: 34dvh !important;
          min-height: 0 !important;
          display: grid !important;
          grid-template-rows: auto minmax(44px, auto) auto !important;
          border-right: 0 !important;
          border-bottom: 1px solid #dbe3ec !important;
          background: #fff !important;
          overflow: hidden !important;
        }

        .v12-left-header {
          min-height: 0 !important;
          padding: max(12px, env(safe-area-inset-top)) 14px 8px !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 6px 10px !important;
          align-items: center !important;
          background: #fff !important;
          border-bottom: 1px solid #edf2f7 !important;
        }

        .v12-order-kicker {
          width: fit-content !important;
          max-width: 100% !important;
          min-height: 30px !important;
          padding: 6px 10px !important;
          border-radius: 999px !important;
          background: #eef2f6 !important;
          color: #475569 !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 5px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .v12-left-header h3 {
          display: none !important;
        }

        .v12-left-header .v12-bill-no {
          grid-column: 2 !important;
          grid-row: 1 !important;
          color: #475569 !important;
          font-size: 13px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
          white-space: nowrap !important;
        }

        .v12-cart-list {
          min-height: 0 !important;
          max-height: 104px !important;
          padding: 8px 12px !important;
          display: grid !important;
          gap: 6px !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          background: #f8fafc !important;
        }

        .v12-cart-item {
          min-height: 42px !important;
          margin: 0 !important;
          padding: 8px 10px !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          grid-template-areas:
            "name price"
            "qty price" !important;
          gap: 2px 8px !important;
          border-radius: 10px !important;
          box-shadow: none !important;
          border-color: #e2e8f0 !important;
        }

        .v12-item-name {
          grid-area: name !important;
          min-width: 0 !important;
          color: #334155 !important;
          font-size: 13px !important;
          line-height: 1.25 !important;
          font-weight: 900 !important;
        }

        .v12-item-qty {
          grid-area: qty !important;
          color: #64748b !important;
          font-size: 12px !important;
          line-height: 1.1 !important;
          font-weight: 800 !important;
        }

        .v12-item-price {
          grid-area: price !important;
          align-self: center !important;
          color: #0f172a !important;
          font-size: 13px !important;
          font-weight: 900 !important;
        }

        .v12-left-footer {
          padding: 8px 14px 10px !important;
          background: #fff !important;
          border-top: 1px solid #edf2f7 !important;
          display: grid !important;
          gap: 4px !important;
        }

        .v12-summary-row {
          margin: 0 !important;
          font-size: 12px !important;
          line-height: 1.2 !important;
          color: #64748b !important;
        }

        .v12-summary-row.total {
          font-size: 18px !important;
          line-height: 1.15 !important;
          color: #0f172a !important;
        }

        .v12-summary-row.total span:first-child {
          font-size: 12px !important;
          margin: 0 !important;
          align-self: center !important;
        }

        .v12-deposit-badge {
          margin-top: 4px !important;
          width: fit-content !important;
          max-width: 100% !important;
          font-size: 11px !important;
          padding: 4px 8px !important;
        }

        .v12-right {
          min-height: 0 !important;
          display: grid !important;
          grid-template-rows: auto minmax(0, 1fr) auto !important;
          background: #fff !important;
        }

        .v12-right-header {
          min-height: 0 !important;
          padding: 9px 10px !important;
          gap: 8px !important;
          background: #fff !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .v12-right-head-copy {
          display: none !important;
        }

        .v12-steps-bar {
          min-width: 0 !important;
          justify-content: flex-start !important;
          overflow-x: auto !important;
          gap: 6px !important;
          padding-bottom: 1px !important;
          scrollbar-width: none !important;
        }

        .v12-steps-bar::-webkit-scrollbar {
          display: none !important;
        }

        .v12-step-connector {
          display: none !important;
        }

        .v12-step-pill {
          flex: 0 0 auto !important;
          min-height: 34px !important;
          padding: 5px 9px !important;
          gap: 5px !important;
          font-size: 11px !important;
          border: 1px solid transparent !important;
          background: #fff !important;
        }

        .v12-step-pill .pill-num {
          width: 22px !important;
          height: 22px !important;
          font-size: 11px !important;
        }

        .v12-step-pill.active {
          background: #f1f5f9 !important;
          border-color: #dbe3ec !important;
        }

        .v12-right-header > button {
          flex: 0 0 38px !important;
          width: 38px !important;
          height: 38px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid #e2e8f0 !important;
          background: #fff !important;
          color: #64748b !important;
        }

        .v12-right-body {
          min-height: 0 !important;
          padding: 14px !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          background: #f8fafc !important;
        }

        .v12-step-title {
          font-size: 22px !important;
          line-height: 1.18 !important;
          margin: 0 0 6px !important;
          color: #0f172a !important;
          overflow-wrap: anywhere !important;
        }

        .v12-step-subtitle {
          font-size: 12px !important;
          line-height: 1.45 !important;
          margin: 0 0 12px !important;
          color: #64748b !important;
        }

        .v12-cust-grid,
        .v12-delivery-grid,
        .v12-pay-type-grid,
        .v12-method-grid,
        .v14-project-list,
        .v36-v12-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        .v12-cust-card,
        .v12-delivery-card,
        .v12-pay-type-card,
        .v12-method-card,
        .v14-project-card,
        .customer-type-btn,
        .payment-method-btn {
          min-height: 96px !important;
          padding: 12px 10px !important;
          border-radius: 12px !important;
          box-shadow: none !important;
        }

        .v12-cust-card i,
        .v12-delivery-card i,
        .v12-pay-type-card i,
        .v12-method-card i {
          font-size: 24px !important;
        }

        .v12-cust-card h4,
        .v12-delivery-card h4,
        .v12-pay-type-card h4,
        .v12-method-card h4 {
          font-size: 13px !important;
          line-height: 1.2 !important;
          margin-top: 6px !important;
        }

        .v12-cust-card p,
        .v12-delivery-card p,
        .v12-pay-type-card p,
        .v12-method-card p {
          font-size: 11px !important;
          line-height: 1.25 !important;
          margin-top: 3px !important;
        }

        .v12-delivery-form,
        .v12-deposit-box,
        .v12-qr-box,
        .v12-cash-header,
        .v12-received-bar,
        .v12-change-breakdown {
          padding: 12px !important;
          border-radius: 12px !important;
          box-shadow: none !important;
        }

        .v12-form-row {
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 10px !important;
        }

        .v12-form-group input,
        .v12-form-group textarea,
        .v12-form-group select,
        .v12-deposit-big-input,
        #checkout-overlay input,
        #checkout-overlay textarea,
        #checkout-overlay select {
          min-height: 44px !important;
          font-size: 16px !important;
          border-radius: 10px !important;
        }

        .v12-denom-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        .v12-denom-btn {
          min-height: 74px !important;
          padding: 8px !important;
          border-radius: 12px !important;
        }

        .v12-quick-amounts {
          gap: 6px !important;
          overflow-x: auto !important;
          padding-bottom: 2px !important;
        }

        .v12-quick-btn {
          flex: 0 0 auto !important;
          min-height: 40px !important;
          padding: 8px 12px !important;
        }

        .v12-summary-table {
          font-size: 13px !important;
        }

        .v12-print-options {
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 8px !important;
        }

        .v12-right-footer {
          min-height: 0 !important;
          padding: 10px 10px max(10px, env(safe-area-inset-bottom)) !important;
          gap: 8px !important;
          display: grid !important;
          grid-template-columns: auto auto minmax(0, 1fr) !important;
          align-items: center !important;
          background: #fff !important;
          border-top: 1px solid #e2e8f0 !important;
        }

        .v12-btn-close,
        .v12-btn-back,
        .v12-btn-next,
        #v87-pause-btn {
          min-height: 46px !important;
          height: 46px !important;
          border-radius: 12px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
          white-space: nowrap !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 5px !important;
        }

        .v12-btn-close,
        .v12-btn-back,
        #v87-pause-btn {
          width: 46px !important;
          min-width: 46px !important;
          padding: 0 !important;
          overflow: hidden !important;
          color: transparent !important;
        }

        .v12-btn-close i,
        .v12-btn-back i,
        #v87-pause-btn i {
          color: #64748b !important;
          margin: 0 !important;
        }

        .v12-btn-next {
          width: 100% !important;
          min-width: 0 !important;
          grid-column: 3 !important;
          font-size: 14px !important;
        }

        .v12-pro-shell .v12-left {
          max-height: 30dvh !important;
        }

        .v12-pro-shell .v12-left-header {
          grid-template-columns: minmax(0, 1fr) auto !important;
          padding: max(10px, env(safe-area-inset-top)) 14px 8px !important;
        }

        .v12-pro-shell .v12-left-header .v12-bill-no {
          margin: 0 !important;
          grid-column: 2 !important;
          grid-row: 1 !important;
          color: #475569 !important;
          font-size: 13px !important;
          line-height: 1.1 !important;
          font-weight: 900 !important;
          text-align: right !important;
        }

        .v12-pro-shell .v12-cart-list {
          max-height: 72px !important;
          padding: 8px 12px !important;
        }

        .v12-cart-item.v12-pro-item {
          min-height: 48px !important;
          grid-template-columns: 34px minmax(0, 1fr) auto !important;
          gap: 8px !important;
          padding: 8px 10px !important;
          align-items: center !important;
        }

        .v12-item-index {
          width: 34px !important;
          height: 34px !important;
          border-radius: 10px !important;
          font-size: 12px !important;
          flex: 0 0 34px !important;
        }

        .v12-item-main {
          min-width: 0 !important;
          overflow: hidden !important;
        }

        .v12-item-main .v12-item-name,
        .v12-cart-item.v12-pro-item .v12-item-name {
          display: block !important;
          min-width: 0 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .v12-item-sub {
          margin-top: 2px !important;
          color: #94a3b8 !important;
          font-size: 10.5px !important;
          line-height: 1.15 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .v12-item-amount {
          min-width: 54px !important;
          text-align: right !important;
        }

        .v12-item-amount .v12-item-price,
        .v12-cart-item.v12-pro-item .v12-item-price {
          font-size: 13px !important;
          line-height: 1.1 !important;
          color: #0f172a !important;
        }

        .v12-pro-totals {
          gap: 5px !important;
        }

        .v12-pro-total-card {
          margin-top: 4px !important;
          min-height: 58px !important;
          padding: 10px 12px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
          border-radius: 14px !important;
          background: #f8fafc !important;
        }

        .v12-pro-total-card .label {
          font-size: 12px !important;
          line-height: 1.2 !important;
          color: #64748b !important;
          white-space: nowrap !important;
        }

        .v12-pro-total-card .value {
          margin: 0 !important;
          color: #0f172a !important;
          font-size: 30px !important;
          line-height: 1 !important;
          text-align: right !important;
          white-space: nowrap !important;
        }

        .v12-pro-shell .v12-right-header {
          display: grid !important;
          grid-template-columns: 38px minmax(0, 1fr) 38px !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 10px 12px !important;
        }

        .v12-pro-shell .v12-right-header::before {
          content: "" !important;
          display: block !important;
          width: 38px !important;
          height: 38px !important;
        }

        .v12-pro-shell .v12-steps-bar {
          grid-column: 2 !important;
          justify-content: center !important;
          justify-self: center !important;
          max-width: 100% !important;
        }

        .v12-pro-shell .v12-right-header > button {
          grid-column: 3 !important;
          justify-self: end !important;
        }

        .v12-pro-shell .v12-right-body {
          padding: 14px 18px !important;
        }

        .v12-pro-shell .v12-right-body > * {
          max-width: 480px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .v12-pro-shell .v12-step-title,
        .v12-pro-shell .v12-step-subtitle {
          text-align: center !important;
        }

        .v12-pro-shell .v12-right-footer {
          grid-template-columns: 48px 48px minmax(0, 1fr) !important;
          padding-left: 14px !important;
          padding-right: 14px !important;
        }

        .v12-pro-shell #v87-pause-btn {
          display: none !important;
        }

        .v12-pro-shell .v12-btn-close,
        .v12-pro-shell .v12-btn-back {
          width: 48px !important;
          min-width: 48px !important;
        }

        .v12-pro-shell .v12-btn-back[style*="display:none"] {
          visibility: hidden !important;
          display: inline-flex !important;
        }
      }

      @media (max-width: 420px) {
        .v12-left {
          max-height: 30dvh !important;
        }

        .v12-cart-list {
          max-height: 56px !important;
        }

        .v12-cust-grid,
        .v12-delivery-grid,
        .v12-pay-type-grid,
        .v12-method-grid,
        .v14-project-list,
        .v36-v12-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .v12-cust-card,
        .v12-delivery-card,
        .v12-pay-type-card,
        .v12-method-card,
        .v14-project-card {
          min-height: 78px !important;
          display: grid !important;
          grid-template-columns: 34px minmax(0, 1fr) !important;
          grid-template-rows: auto auto !important;
          text-align: left !important;
          align-items: center !important;
          column-gap: 10px !important;
        }

        .v12-cust-card i,
        .v12-delivery-card i,
        .v12-pay-type-card i,
        .v12-method-card i {
          grid-row: 1 / span 2 !important;
        }

        .v12-cust-card h4,
        .v12-delivery-card h4,
        .v12-pay-type-card h4,
        .v12-method-card h4,
        .v12-cust-card p,
        .v12-delivery-card p,
        .v12-pay-type-card p,
        .v12-method-card p {
          margin: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectMobileCheckoutStyles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
