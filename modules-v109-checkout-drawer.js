/* ════════════════════════════════════════════════════════════════
   V109 — Minimal Checkout Drawer
   Presentation-only layer: keeps every existing checkout flow intact.
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const STYLE_ID = 'v109-checkout-drawer-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width: 769px) {
        html:has(#v12-checkout-overlay),
        body:has(#v12-checkout-overlay) {
          overflow: hidden !important;
        }

        #v12-checkout-overlay.v12-checkout-overlay {
          padding: 0 !important;
          align-items: stretch !important;
          justify-content: flex-end !important;
          background: rgba(15, 23, 42, .24) !important;
          backdrop-filter: none !important;
          animation: v109-overlay-in .22s ease-out both !important;
        }

        #v12-checkout-overlay .v12-checkout-shell,
        #v12-checkout-overlay .v12-checkout-shell.v12-pro-shell {
          width: clamp(920px, 64vw, 1280px) !important;
          max-width: calc(100vw - 32px) !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          margin: 0 !important;
          position: relative !important;
          display: grid !important;
          grid-template-columns: clamp(260px, 27%, 320px) minmax(0, 1fr) !important;
          border: 0 !important;
          border-left: 1px solid #e4e8ee !important;
          border-radius: 24px 0 0 24px !important;
          background: #fff !important;
          box-shadow: -24px 0 70px rgba(15, 23, 42, .16) !important;
          overflow: hidden !important;
          transform-origin: right center;
          animation: v109-drawer-in .32s cubic-bezier(.22, 1, .36, 1) both !important;
        }

        #v12-checkout-overlay .v12-checkout-shell::before {
          content: "" !important;
          position: absolute !important;
          z-index: 5 !important;
          top: 0 !important;
          right: 0 !important;
          left: 0 !important;
          height: 3px !important;
          background: linear-gradient(90deg, #0f766e 0%, #14b8a6 52%, #3b82f6 100%) !important;
          pointer-events: none !important;
        }

        #v12-checkout-overlay[style*="opacity: 0"] .v12-checkout-shell {
          transform: translateX(100%) !important;
          transition: transform .2s ease-in !important;
        }

        #v12-checkout-overlay .v12-left,
        #v12-checkout-overlay .v12-pro-shell .v12-left {
          width: auto !important;
          min-width: 0 !important;
          height: 100dvh !important;
          display: grid !important;
          grid-template-rows: auto minmax(0, 1fr) auto !important;
          border: 0 !important;
          border-right: 1px solid #e8ecf1 !important;
          background: #f8fafc !important;
          color: #172033 !important;
          overflow: hidden !important;
        }

        #v12-checkout-overlay .v12-left-header {
          min-height: 0 !important;
          padding: 26px 22px 20px !important;
          border: 0 !important;
          border-bottom: 1px solid #e8ecf1 !important;
          background: #f8fafc !important;
        }

        #v12-checkout-overlay .v12-order-kicker {
          margin: 0 0 18px !important;
          padding: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: #7c8798 !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          letter-spacing: .35px !important;
        }

        #v12-checkout-overlay .v12-order-kicker i {
          color: #98a2b3 !important;
          font-size: 15px !important;
        }

        #v12-checkout-overlay .v12-order-title-row {
          align-items: flex-end !important;
          gap: 10px !important;
        }

        #v12-checkout-overlay .v12-order-count,
        #v12-checkout-overlay .v12-pro-shell .v12-left-header .v12-bill-no {
          margin: 0 !important;
          color: #172033 !important;
          font-size: clamp(25px, 1.8vw, 32px) !important;
          line-height: 1 !important;
          font-weight: 750 !important;
          letter-spacing: -.7px !important;
        }

        #v12-checkout-overlay .v12-order-meta {
          color: #8490a2 !important;
          font-size: 10px !important;
          line-height: 1.5 !important;
          font-weight: 500 !important;
        }

        #v12-checkout-overlay .v12-cart-list {
          min-height: 0 !important;
          padding: 8px 14px !important;
          background: #f8fafc !important;
          overflow-y: auto !important;
          scrollbar-width: thin !important;
          scrollbar-color: #d8dee7 transparent !important;
        }

        #v12-checkout-overlay .v12-cart-item,
        #v12-checkout-overlay .v12-cart-item.v12-pro-item {
          min-height: 62px !important;
          margin: 0 !important;
          padding: 13px 8px !important;
          display: grid !important;
          grid-template-columns: 26px minmax(0, 1fr) auto !important;
          gap: 9px !important;
          align-items: center !important;
          border: 0 !important;
          border-bottom: 1px solid #e8ecf1 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay .v12-cart-item:hover {
          background: #f3f6f9 !important;
        }

        #v12-checkout-overlay .v12-item-index {
          width: 24px !important;
          height: 24px !important;
          border-radius: 7px !important;
          background: #edf1f5 !important;
          color: #7c8798 !important;
          font-size: 10px !important;
          font-weight: 700 !important;
        }

        #v12-checkout-overlay .v12-item-main {
          min-width: 0 !important;
        }

        #v12-checkout-overlay .v12-item-name {
          display: block !important;
          color: #273244 !important;
          font-size: 12px !important;
          line-height: 1.35 !important;
          font-weight: 650 !important;
        }

        #v12-checkout-overlay .v12-item-sub,
        #v12-checkout-overlay .v12-item-qty {
          margin-top: 3px !important;
          color: #98a2b3 !important;
          font-size: 9px !important;
          line-height: 1.35 !important;
          font-weight: 450 !important;
        }

        #v12-checkout-overlay .v12-item-price {
          color: #273244 !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }

        #v12-checkout-overlay .v12-left-footer {
          padding: 18px 20px 22px !important;
          border: 0 !important;
          border-top: 1px solid #e8ecf1 !important;
          background: #fff !important;
        }

        #v12-checkout-overlay .v12-pro-totals {
          gap: 7px !important;
        }

        #v12-checkout-overlay .v12-summary-row {
          margin: 0 !important;
          color: #7c8798 !important;
          font-size: 10px !important;
          font-weight: 500 !important;
        }

        #v12-checkout-overlay .v12-pro-total-card {
          margin: 7px 0 0 !important;
          padding: 14px 0 0 !important;
          border: 0 !important;
          border-top: 1px solid #e8ecf1 !important;
          border-radius: 0 !important;
          background: transparent !important;
        }

        #v12-checkout-overlay .v12-pro-total-card .label {
          color: #7c8798 !important;
          font-size: 10px !important;
          font-weight: 600 !important;
        }

        #v12-checkout-overlay .v12-pro-total-card .value {
          margin-top: 5px !important;
          color: #172033 !important;
          font-size: clamp(30px, 2.5vw, 42px) !important;
          line-height: 1 !important;
          font-weight: 750 !important;
          letter-spacing: -1.5px !important;
          white-space: nowrap !important;
        }

        #v12-checkout-overlay .v12-deposit-badge {
          margin-top: 8px !important;
          padding: 5px 9px !important;
          border: 1px solid #ead8b4 !important;
          border-radius: 8px !important;
          background: #fffaf0 !important;
          color: #9a5b0b !important;
          font-size: 9px !important;
          font-weight: 600 !important;
        }

        #v12-checkout-overlay .v12-right {
          min-width: 0 !important;
          min-height: 0 !important;
          display: grid !important;
          grid-template-rows: 74px minmax(0, 1fr) 76px !important;
          background: #fff !important;
          overflow: hidden !important;
        }

        #v12-checkout-overlay .v12-right-header,
        #v12-checkout-overlay .v12-pro-shell .v12-right-header {
          min-height: 0 !important;
          padding: 0 22px !important;
          display: grid !important;
          grid-template-columns: auto minmax(0, 1fr) 40px !important;
          gap: 14px !important;
          align-items: center !important;
          border: 0 !important;
          border-bottom: 1px solid #e8ecf1 !important;
          background: rgba(255, 255, 255, .96) !important;
        }

        #v12-checkout-overlay .v12-right-head-copy {
          min-width: 104px !important;
        }

        #v12-checkout-overlay .v12-window-title {
          color: #172033 !important;
          font-size: 16px !important;
          line-height: 1.1 !important;
          font-weight: 750 !important;
          letter-spacing: -.2px !important;
        }

        #v12-checkout-overlay .v12-window-sub {
          margin-top: 4px !important;
          color: #98a2b3 !important;
          font-size: 9px !important;
          line-height: 1.2 !important;
          font-weight: 450 !important;
        }

        #v12-checkout-overlay .v12-steps-bar,
        #v12-checkout-overlay .v12-pro-shell .v12-steps-bar {
          width: auto !important;
          min-width: 0 !important;
          justify-content: flex-end !important;
          gap: 3px !important;
          overflow-x: auto !important;
          scrollbar-width: none !important;
        }

        #v12-checkout-overlay .v12-steps-bar::-webkit-scrollbar {
          display: none !important;
        }

        #v12-checkout-overlay .v12-step-pill {
          flex: 0 0 auto !important;
          min-width: 28px !important;
          height: 30px !important;
          padding: 0 5px !important;
          gap: 0 !important;
          border: 1px solid transparent !important;
          border-radius: 999px !important;
          background: transparent !important;
          color: #98a2b3 !important;
          font-size: 0 !important;
          font-weight: 650 !important;
        }

        #v12-checkout-overlay .v12-step-pill.active {
          min-width: auto !important;
          padding: 0 9px 0 5px !important;
          gap: 6px !important;
          border-color: #cfe7e3 !important;
          background: #f2f8f7 !important;
          color: #0f766e !important;
          font-size: 10px !important;
        }

        #v12-checkout-overlay .v12-step-pill.done {
          color: #0f766e !important;
        }

        #v12-checkout-overlay .v12-step-pill .pill-num {
          width: 22px !important;
          height: 22px !important;
          border: 1px solid #dfe5ec !important;
          background: #f5f7f9 !important;
          color: #8490a2 !important;
          font-size: 9px !important;
          font-weight: 700 !important;
        }

        #v12-checkout-overlay .v12-step-pill.active .pill-num,
        #v12-checkout-overlay .v12-step-pill.done .pill-num {
          border-color: #0f766e !important;
          background: #0f766e !important;
          color: #fff !important;
        }

        #v12-checkout-overlay .v12-step-connector,
        #v12-checkout-overlay .v12-step-connector.done {
          width: 8px !important;
          height: 1px !important;
          margin: 0 !important;
          background: #dfe5ec !important;
        }

        #v12-checkout-overlay .v12-right-header > button {
          width: 38px !important;
          height: 38px !important;
          padding: 0 !important;
          display: inline-grid !important;
          place-items: center !important;
          border: 1px solid transparent !important;
          border-radius: 10px !important;
          background: transparent !important;
          color: #98a2b3 !important;
          transition: background .15s ease, color .15s ease !important;
        }

        #v12-checkout-overlay .v12-right-header > button:hover {
          background: #f3f5f7 !important;
          color: #475467 !important;
        }

        #v12-checkout-overlay .v12-right-body,
        #v12-checkout-overlay .v12-pro-shell .v12-right-body {
          min-height: 0 !important;
          max-height: none !important;
          padding: 24px 26px !important;
          background: #fff !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          scrollbar-width: thin !important;
          scrollbar-color: #d8dee7 transparent !important;
        }

        #v12-checkout-overlay .v12-right-body > * {
          width: 100% !important;
          max-width: 820px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        #v12-checkout-overlay .v12-step-title {
          display: block !important;
          margin: 0 auto 5px !important;
          color: #172033 !important;
          font-size: 22px !important;
          line-height: 1.25 !important;
          font-weight: 750 !important;
          letter-spacing: -.35px !important;
          text-align: left !important;
        }

        #v12-checkout-overlay .v12-step-subtitle {
          display: block !important;
          margin: 0 auto 20px !important;
          color: #7c8798 !important;
          font-size: 12px !important;
          line-height: 1.5 !important;
          font-weight: 500 !important;
          text-align: left !important;
        }

        #v12-checkout-overlay .v12-cust-grid,
        #v12-checkout-overlay .v12-delivery-grid,
        #v12-checkout-overlay .v12-pay-type-grid,
        #v12-checkout-overlay .v12-method-grid,
        #v12-checkout-overlay .v13-method-grid-4,
        #v12-checkout-overlay .v14-project-list,
        #v12-checkout-overlay .v36-v12-grid,
        #v12-checkout-overlay .v36-v12-customer-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          grid-auto-rows: 1fr !important;
          gap: 10px !important;
          max-width: none !important;
        }

        #v12-checkout-overlay .v36-v12-customer-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          margin: 0 0 14px !important;
        }

        #v12-checkout-overlay .v12-cust-card,
        #v12-checkout-overlay .v12-delivery-card,
        #v12-checkout-overlay .v12-pay-type-card,
        #v12-checkout-overlay .v12-method-card,
        #v12-checkout-overlay .v13-method-card-debt,
        #v12-checkout-overlay .v14-project-card,
        #v12-checkout-overlay .v14-proj-cust-card,
        #v12-checkout-overlay .customer-type-btn,
        #v12-checkout-overlay .payment-method-btn {
          position: relative !important;
          min-height: 86px !important;
          padding: 13px 14px !important;
          display: grid !important;
          grid-template-columns: 40px minmax(0, 1fr) !important;
          grid-template-rows: auto auto !important;
          column-gap: 11px !important;
          align-content: center !important;
          align-items: center !important;
          text-align: left !important;
          border: 1px solid #dfe5ec !important;
          border-radius: 12px !important;
          background: #fff !important;
          color: #273244 !important;
          cursor: pointer !important;
          box-shadow: none !important;
          transform: none !important;
          transition: border-color .15s ease, background .15s ease !important;
        }

        #v12-checkout-overlay .v12-cust-card:hover,
        #v12-checkout-overlay .v12-delivery-card:hover,
        #v12-checkout-overlay .v12-pay-type-card:hover,
        #v12-checkout-overlay .v12-method-card:hover,
        #v12-checkout-overlay .v13-method-card-debt:hover:not(.disabled),
        #v12-checkout-overlay .v14-project-card:hover,
        #v12-checkout-overlay .v14-proj-cust-card:hover {
          border-color: #aeb8c6 !important;
          background: #fafbfc !important;
          box-shadow: none !important;
          transform: none !important;
        }

        #v12-checkout-overlay .v12-cust-card.selected,
        #v12-checkout-overlay .v12-delivery-card.selected,
        #v12-checkout-overlay .v12-pay-type-card.selected,
        #v12-checkout-overlay .v12-method-card.selected,
        #v12-checkout-overlay .v13-method-card-debt.selected,
        #v12-checkout-overlay .v14-project-card.selected,
        #v12-checkout-overlay .v14-proj-cust-card.selected,
        #v12-checkout-overlay .customer-type-btn.selected,
        #v12-checkout-overlay .payment-method-btn.selected {
          border-color: #0f766e !important;
          background: #f2f8f7 !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay .v12-cust-card::after,
        #v12-checkout-overlay .v12-delivery-card::after,
        #v12-checkout-overlay .v12-pay-type-card::after,
        #v12-checkout-overlay .v12-method-card::after,
        #v12-checkout-overlay .v13-method-card-debt::after,
        #v12-checkout-overlay .v14-proj-cust-card::after {
          display: none !important;
        }

        #v12-checkout-overlay .v12-cust-card i,
        #v12-checkout-overlay .v12-delivery-card i,
        #v12-checkout-overlay .v12-pay-type-card i,
        #v12-checkout-overlay .v12-method-card i,
        #v12-checkout-overlay .v13-method-card-debt i,
        #v12-checkout-overlay .v14-proj-cust-card i {
          grid-row: 1 / span 2 !important;
          width: 38px !important;
          height: 38px !important;
          margin: 0 !important;
          display: grid !important;
          place-items: center !important;
          border-radius: 10px !important;
          background: #f2f4f7 !important;
          color: #7c8798 !important;
          font-size: 20px !important;
        }

        #v12-checkout-overlay .v12-cust-card.selected i,
        #v12-checkout-overlay .v12-delivery-card.selected i,
        #v12-checkout-overlay .v12-pay-type-card.selected i,
        #v12-checkout-overlay .v12-method-card.selected i,
        #v12-checkout-overlay .v13-method-card-debt.selected i,
        #v12-checkout-overlay .v14-proj-cust-card.selected i {
          background: #dff1ee !important;
          color: #0f766e !important;
        }

        #v12-checkout-overlay .v12-cust-card h4,
        #v12-checkout-overlay .v12-delivery-card h4,
        #v12-checkout-overlay .v12-pay-type-card h4,
        #v12-checkout-overlay .v12-method-card h4,
        #v12-checkout-overlay .v13-method-card-debt h4,
        #v12-checkout-overlay .v14-proj-cust-card h4 {
          align-self: end !important;
          margin: 0 !important;
          color: #273244 !important;
          font-size: 12px !important;
          line-height: 1.3 !important;
          font-weight: 700 !important;
        }

        #v12-checkout-overlay .v12-cust-card p,
        #v12-checkout-overlay .v12-delivery-card p,
        #v12-checkout-overlay .v12-pay-type-card p,
        #v12-checkout-overlay .v12-method-card p,
        #v12-checkout-overlay .v13-method-card-debt p,
        #v12-checkout-overlay .v14-proj-cust-card p {
          align-self: start !important;
          margin: 2px 0 0 !important;
          color: #98a2b3 !important;
          font-size: 9px !important;
          line-height: 1.3 !important;
          font-weight: 450 !important;
        }

        /* One visual system, with a quiet accent for each choice. */
        #v12-checkout-overlay .v36-v12-customer-grid > :nth-child(1),
        #v12-checkout-overlay .v12-delivery-grid > :nth-child(1),
        #v12-checkout-overlay .v12-method-grid > :nth-child(1),
        #v12-checkout-overlay .v13-method-grid-4 > :nth-child(1) {
          --v109-choice: #0f766e;
          --v109-choice-bg: #edf8f6;
        }

        #v12-checkout-overlay .v36-v12-customer-grid > :nth-child(2),
        #v12-checkout-overlay .v12-delivery-grid > :nth-child(2),
        #v12-checkout-overlay .v12-method-grid > :nth-child(2),
        #v12-checkout-overlay .v13-method-grid-4 > :nth-child(2) {
          --v109-choice: #2563eb;
          --v109-choice-bg: #eff6ff;
        }

        #v12-checkout-overlay .v36-v12-customer-grid > :nth-child(3),
        #v12-checkout-overlay .v12-delivery-grid > :nth-child(3),
        #v12-checkout-overlay .v12-method-grid > :nth-child(3),
        #v12-checkout-overlay .v13-method-grid-4 > :nth-child(3) {
          --v109-choice: #b45309;
          --v109-choice-bg: #fff7ed;
        }

        #v12-checkout-overlay .v36-v12-customer-grid > :nth-child(4),
        #v12-checkout-overlay .v12-delivery-grid > :nth-child(4),
        #v12-checkout-overlay .v12-method-grid > :nth-child(4) {
          --v109-choice: #7c3aed;
          --v109-choice-bg: #f5f3ff;
        }

        #v12-checkout-overlay .v13-method-grid-4 > :nth-child(4) {
          --v109-choice: #c2410c;
          --v109-choice-bg: #fff7ed;
        }

        #v12-checkout-overlay .v12-pay-type-grid > :nth-child(1) {
          --v109-choice: #0f766e;
          --v109-choice-bg: #edf8f6;
        }

        #v12-checkout-overlay .v12-pay-type-grid > :nth-child(2) {
          --v109-choice: #b45309;
          --v109-choice-bg: #fff7ed;
        }

        #v12-checkout-overlay .v36-v12-customer-grid > *,
        #v12-checkout-overlay .v12-delivery-grid > *,
        #v12-checkout-overlay .v12-pay-type-grid > *,
        #v12-checkout-overlay .v12-method-grid > *,
        #v12-checkout-overlay .v13-method-grid-4 > * {
          border-color: #dfe5ec !important;
        }

        #v12-checkout-overlay .v36-v12-customer-grid > * i,
        #v12-checkout-overlay .v12-delivery-grid > * i,
        #v12-checkout-overlay .v12-pay-type-grid > * i,
        #v12-checkout-overlay .v12-method-grid > * i,
        #v12-checkout-overlay .v13-method-grid-4 > * i {
          background: var(--v109-choice-bg, #f2f4f7) !important;
          color: var(--v109-choice, #667085) !important;
        }

        #v12-checkout-overlay .v36-v12-customer-grid > *.selected,
        #v12-checkout-overlay .v12-delivery-grid > *.selected,
        #v12-checkout-overlay .v12-pay-type-grid > *.selected,
        #v12-checkout-overlay .v12-method-grid > *.selected,
        #v12-checkout-overlay .v13-method-grid-4 > *.selected {
          border-color: var(--v109-choice, #0f766e) !important;
          background: var(--v109-choice-bg, #f2f8f7) !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay .v36-v12-customer-grid > *.selected i,
        #v12-checkout-overlay .v12-delivery-grid > *.selected i,
        #v12-checkout-overlay .v12-pay-type-grid > *.selected i,
        #v12-checkout-overlay .v12-method-grid > *.selected i,
        #v12-checkout-overlay .v13-method-grid-4 > *.selected i {
          background: var(--v109-choice, #0f766e) !important;
          color: #fff !important;
        }

        #v12-checkout-overlay .v13-method-card-debt.disabled {
          border-color: #e7eaf0 !important;
          background: #fafbfc !important;
          opacity: .52 !important;
          cursor: not-allowed !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay #v12-cust-form > div:has(#v14-proj-selector) {
          margin-top: 12px !important;
          padding: 14px !important;
          border: 1px solid #ddd6fe !important;
          border-radius: 12px !important;
          background: #faf9ff !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay #v14-proj-selector > div {
          padding: 10px 12px !important;
          border: 1px solid #e4e0f4 !important;
          border-radius: 9px !important;
          background: #fff !important;
          transition: border-color .15s ease, background .15s ease !important;
        }

        #v12-checkout-overlay #v14-proj-selector > div:hover {
          border-color: #a78bfa !important;
          background: #faf9ff !important;
        }

        #v12-checkout-overlay #v14-proj-selector > div.is-selected {
          border-color: #7c3aed !important;
          background: #f5f3ff !important;
        }

        #v12-checkout-overlay .v81-cust-status {
          display: none !important;
        }

        #v12-checkout-overlay .v81-sub-head {
          margin-bottom: 12px !important;
          padding: 12px 14px !important;
          border: 1px solid #dfe5ec !important;
          border-radius: 12px !important;
          background: #fafbfc !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay .v81-cust-ico,
        #v12-checkout-overlay .v81-sub-head .ico {
          width: 38px !important;
          height: 38px !important;
          border-radius: 10px !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay .v81-cust-name,
        #v12-checkout-overlay .v81-sub-head .ttl {
          color: #273244 !important;
          font-size: 14px !important;
          font-weight: 700 !important;
        }

        #v12-checkout-overlay .v81-cust-label,
        #v12-checkout-overlay .v81-cust-meta,
        #v12-checkout-overlay .v81-sub-head .sub {
          color: #7c8798 !important;
          font-size: 9px !important;
          font-weight: 500 !important;
        }

        #v12-checkout-overlay .v12-delivery-form,
        #v12-checkout-overlay .v12-deposit-box,
        #v12-checkout-overlay .v12-qr-box,
        #v12-checkout-overlay .v12-cash-header,
        #v12-checkout-overlay .v12-received-bar,
        #v12-checkout-overlay .v12-change-breakdown {
          padding: 14px !important;
          border: 1px solid #e2e7ed !important;
          border-radius: 12px !important;
          background: #fafbfc !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay .v12-form-row,
        #v12-checkout-overlay .v81-form-row {
          gap: 10px !important;
        }

        #v12-checkout-overlay .v12-form-group input,
        #v12-checkout-overlay .v12-form-group textarea,
        #v12-checkout-overlay .v12-form-group select,
        #v12-checkout-overlay .v81-fld input,
        #v12-checkout-overlay .v81-fld textarea,
        #v12-checkout-overlay .v12-deposit-big-input {
          min-height: 42px !important;
          padding: 9px 11px !important;
          border: 1px solid #d7dee7 !important;
          border-radius: 10px !important;
          background: #fff !important;
          color: #273244 !important;
          box-shadow: none !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        }

        #v12-checkout-overlay .v12-form-group input:focus,
        #v12-checkout-overlay .v12-form-group textarea:focus,
        #v12-checkout-overlay .v12-form-group select:focus,
        #v12-checkout-overlay .v81-fld input:focus,
        #v12-checkout-overlay .v81-fld textarea:focus,
        #v12-checkout-overlay .v12-deposit-big-input:focus {
          border-color: #0f766e !important;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, .1) !important;
          outline: none !important;
        }

        #v12-checkout-overlay .v12-denom-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        #v12-checkout-overlay .v12-denom-btn,
        #v12-checkout-overlay .v12-quick-btn,
        #v12-checkout-overlay .v81-pay-opt {
          border: 1px solid #dfe5ec !important;
          border-radius: 10px !important;
          background: #fff !important;
          color: #475467 !important;
          box-shadow: none !important;
          transform: none !important;
        }

        #v12-checkout-overlay .v36-transfer-qr-box {
          width: 100% !important;
          max-width: 420px !important;
          margin: 12px auto 0 !important;
          padding: 14px !important;
          border: 1px solid #dbe5ef !important;
          border-radius: 12px !important;
          background: #fff !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay .v36-transfer-qr-canvas {
          width: 190px !important;
          min-height: 218px !important;
          border-radius: 10px !important;
          box-shadow: none !important;
        }

        #v12-checkout-overlay .v36-transfer-qr-canvas img {
          width: 142px !important;
          height: 142px !important;
        }

        #v12-checkout-overlay .v12-right-footer,
        #v12-checkout-overlay .v12-pro-shell .v12-right-footer {
          min-height: 0 !important;
          padding: 13px 20px !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          border: 0 !important;
          border-top: 1px solid #e8ecf1 !important;
          background: #fff !important;
        }

        #v12-checkout-overlay .v12-btn-close,
        #v12-checkout-overlay .v12-btn-back,
        #v12-checkout-overlay #v87-pause-btn,
        #v12-checkout-overlay .v12-btn-next {
          width: auto !important;
          min-width: 0 !important;
          height: 44px !important;
          min-height: 44px !important;
          margin: 0 !important;
          padding: 0 13px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          border-radius: 10px !important;
          box-shadow: none !important;
          color: #667085 !important;
          font-size: 11px !important;
          font-weight: 650 !important;
          white-space: nowrap !important;
          transform: none !important;
        }

        #v12-checkout-overlay .v12-btn-close,
        #v12-checkout-overlay .v12-btn-back,
        #v12-checkout-overlay #v87-pause-btn {
          flex: 0 0 100px !important;
        }

        #v12-checkout-overlay .v12-btn-close i,
        #v12-checkout-overlay .v12-btn-back i,
        #v12-checkout-overlay #v87-pause-btn i,
        #v12-checkout-overlay .v12-btn-next i {
          font-size: 18px !important;
        }

        #v12-checkout-overlay .v12-btn-close {
          border: 1px solid #f0d7d7 !important;
          background: #fff8f8 !important;
          color: #a33f3f !important;
        }

        #v12-checkout-overlay .v12-btn-back {
          border: 1px solid #d8e4f3 !important;
          background: #f6f9fd !important;
          color: #41658f !important;
        }

        #v12-checkout-overlay .v12-btn-close:hover {
          border-color: #e4bebe !important;
          background: #fff1f1 !important;
          color: #8f3030 !important;
        }

        #v12-checkout-overlay .v12-btn-back:hover {
          border-color: #bdd1e9 !important;
          background: #edf4fc !important;
          color: #315578 !important;
        }

        #v12-checkout-overlay #v87-pause-btn {
          border: 1px solid #ead8b4 !important;
          background: #fffaf3 !important;
          color: #9a5b0b !important;
        }

        #v12-checkout-overlay #v87-pause-btn:hover {
          border-color: #d9b978 !important;
          background: #fff6e7 !important;
          color: #854d0e !important;
        }

        #v12-checkout-overlay .v12-btn-next,
        #v12-checkout-overlay .v12-btn-next.green,
        #v12-checkout-overlay .v12-btn-next:hover,
        #v12-checkout-overlay .v12-btn-next.green:hover {
          flex: 1 1 auto !important;
          max-width: none !important;
          margin-left: auto !important;
          border: 1px solid #0f766e !important;
          background: #0f766e !important;
          color: #fff !important;
          font-size: 13px !important;
          font-weight: 700 !important;
        }

        #v12-checkout-overlay .v12-btn-next:hover,
        #v12-checkout-overlay .v12-btn-next.green:hover {
          background: #0b655e !important;
        }

        #v12-checkout-overlay .v12-btn-back[style*="display: none"],
        #v12-checkout-overlay .v12-btn-next[style*="display: none"] {
          display: none !important;
        }

        #v12-checkout-overlay .v12-btn-next:focus-visible,
        #v12-checkout-overlay .v12-btn-close:focus-visible,
        #v12-checkout-overlay .v12-btn-back:focus-visible,
        #v12-checkout-overlay #v87-pause-btn:focus-visible,
        #v12-checkout-overlay .v12-cust-card:focus-visible,
        #v12-checkout-overlay .v12-delivery-card:focus-visible,
        #v12-checkout-overlay .v12-pay-type-card:focus-visible,
        #v12-checkout-overlay .v12-method-card:focus-visible,
        #v12-checkout-overlay .v13-method-card-debt:focus-visible {
          outline: 3px solid rgba(15, 118, 110, .14) !important;
          outline-offset: 2px !important;
        }

        #v12-checkout-overlay .v14-proj-cust-card:focus-visible {
          outline: 3px solid rgba(124, 58, 237, .14) !important;
          outline-offset: 2px !important;
        }

        #v12-checkout-overlay .v12-summary-table {
          font-size: 11px !important;
        }

        #v12-checkout-overlay .v12-print-options {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        #v12-checkout-overlay .v12-print-btn {
          width: 100% !important;
          min-height: 42px !important;
          margin: 0 !important;
          padding: 0 13px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          border: 1px solid #dfe5ec !important;
          border-radius: 10px !important;
          background: #fff !important;
          color: #475467 !important;
          box-shadow: none !important;
          font-size: 11px !important;
          font-weight: 650 !important;
        }

        #v12-checkout-overlay .v12-print-btn:hover {
          border-color: #b9c2ce !important;
          background: #f8fafc !important;
        }

        #v12-checkout-overlay .v12-print-btn.primary {
          border-color: #0f766e !important;
          background: #0f766e !important;
          color: #fff !important;
        }

        #v12-checkout-overlay .v12-print-btn.primary:hover {
          background: #0b655e !important;
        }

        #v12-checkout-overlay .v12-print-options > .v12-print-btn:last-child:nth-child(odd) {
          grid-column: 1 / -1 !important;
        }

        #v12-checkout-overlay .v12-quick-btn,
        #v12-checkout-overlay .v36-mixed-presets button,
        #v12-checkout-overlay .v36-mixed-quick button {
          min-height: 38px !important;
          padding: 0 12px !important;
          border-radius: 9px !important;
          box-shadow: none !important;
          font-size: 11px !important;
          font-weight: 650 !important;
        }

        #v12-checkout-overlay .v12-quick-btn:focus-visible,
        #v12-checkout-overlay .v12-print-btn:focus-visible,
        #v12-checkout-overlay .v36-mixed-presets button:focus-visible,
        #v12-checkout-overlay .v36-mixed-quick button:focus-visible {
          outline: 3px solid rgba(15, 118, 110, .14) !important;
          outline-offset: 2px !important;
        }
      }

      @media (min-width: 769px) and (max-width: 1180px) {
        #v12-checkout-overlay .v12-checkout-shell,
        #v12-checkout-overlay .v12-checkout-shell.v12-pro-shell {
          width: min(980px, calc(100vw - 20px)) !important;
          grid-template-columns: 250px minmax(0, 1fr) !important;
        }

        #v12-checkout-overlay .v36-v12-customer-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        #v12-checkout-overlay .v12-right-header,
        #v12-checkout-overlay .v12-pro-shell .v12-right-header {
          padding: 0 16px !important;
          gap: 9px !important;
        }

        #v12-checkout-overlay .v12-window-sub {
          display: none !important;
        }

        #v12-checkout-overlay .v12-right-body,
        #v12-checkout-overlay .v12-pro-shell .v12-right-body {
          padding: 20px !important;
        }

        #v12-checkout-overlay .v12-right-footer,
        #v12-checkout-overlay .v12-pro-shell .v12-right-footer {
          padding: 12px 14px !important;
          gap: 6px !important;
        }

        #v12-checkout-overlay .v12-btn-close,
        #v12-checkout-overlay .v12-btn-back,
        #v12-checkout-overlay #v87-pause-btn {
          flex: 0 0 44px !important;
          width: 44px !important;
          padding: 0 !important;
          overflow: hidden !important;
          color: transparent !important;
          font-size: 0 !important;
        }

        #v12-checkout-overlay .v12-btn-close i,
        #v12-checkout-overlay .v12-btn-back i,
        #v12-checkout-overlay #v87-pause-btn i {
          margin: 0 !important;
          color: #667085 !important;
          font-size: 19px !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #v12-checkout-overlay.v12-checkout-overlay,
        #v12-checkout-overlay .v12-checkout-shell {
          animation: none !important;
          transition: none !important;
        }
      }

      @keyframes v109-overlay-in {
        from { opacity: 0 }
        to { opacity: 1 }
      }

      @keyframes v109-drawer-in {
        from { transform: translateX(104%) }
        to { transform: translateX(0) }
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceDrawer(overlay) {
    if (!(overlay instanceof HTMLElement)) return;
    overlay.setAttribute('role', 'presentation');
    if (!overlay.dataset.v109BackdropClose) {
      overlay.dataset.v109BackdropClose = 'true';
      overlay.addEventListener('click', (event) => {
        if (event.target !== overlay) return;
        if (typeof window.closeCheckout === 'function') window.closeCheckout();
      });
    }
    const shell = overlay.querySelector('.v12-checkout-shell');
    if (!shell) return;
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.setAttribute('aria-label', 'หน้าชำระเงิน');

    const choices = shell.querySelectorAll([
      '.v12-cust-card', '.v14-proj-cust-card', '.v12-delivery-card',
      '.v12-pay-type-card', '.v12-method-card', '.v13-method-card-debt', '.customer-type-btn',
      '.payment-method-btn', '.v81-pay-opt',
    ].join(','));
    choices.forEach((choice) => {
      if (choice.tagName === 'BUTTON' || choice.tagName === 'A') return;
      if (!choice.hasAttribute('tabindex')) choice.tabIndex = 0;
      choice.setAttribute('role', 'button');
      if (choice.dataset.v109KeyboardReady) return;
      choice.dataset.v109KeyboardReady = 'true';
      choice.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        choice.click();
      });
    });
  }

  function watchCheckout() {
    let pendingFrame = 0;
    let pendingOverlay = null;
    const scheduleEnhance = (overlay) => {
      pendingOverlay = overlay;
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        const current = pendingOverlay;
        pendingOverlay = null;
        if (current?.isConnected) enhanceDrawer(current);
      });
    };
    const observer = new MutationObserver((records) => {
      const current = document.getElementById('v12-checkout-overlay');
      if (!current) return;
      for (const record of records) {
        const target = record.target instanceof Element ? record.target : null;
        if (target && (target === current || target.closest('#v12-checkout-overlay') === current)) {
          scheduleEnhance(current);
          return;
        }
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.id === 'v12-checkout-overlay') scheduleEnhance(node);
          node.querySelectorAll?.('#v12-checkout-overlay').forEach(scheduleEnhance);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const current = document.getElementById('v12-checkout-overlay');
    if (current) enhanceDrawer(current);
  }

  function boot() {
    injectStyles();
    watchCheckout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
