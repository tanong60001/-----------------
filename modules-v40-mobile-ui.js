(function () {
  'use strict';

  function installMobilePolish() {
    if (document.getElementById('v40-mobile-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'v40-mobile-ui-style';
    style.textContent = `
      .dash-v3-card {
        background: var(--card-soft-bg, #ffffff) !important;
        border-left: 0 !important;
        border-radius: 22px !important;
      }

      .dash-v3-card::before {
        display: none !important;
      }

      .dash-v3-card[style*="--card-accent"] {
        border-color: color-mix(in srgb, var(--card-accent, #cbd5e1) 18%, #e2e8f0) !important;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06) !important;
      }

      .v36-log-item {
        background: color-mix(in srgb, var(--tone, #64748b) 8%, #ffffff) !important;
        border-left: 0 !important;
        border-color: color-mix(in srgb, var(--tone, #64748b) 22%, #e2e8f0) !important;
        border-radius: 16px !important;
      }

      .toast {
        border-left: 0 !important;
        border-radius: 16px !important;
        overflow: hidden !important;
      }

      .toast.success { background: color-mix(in srgb, var(--success) 10%, #ffffff) !important; border-color: color-mix(in srgb, var(--success) 20%, #e2e8f0) !important; }
      .toast.error { background: color-mix(in srgb, var(--danger) 10%, #ffffff) !important; border-color: color-mix(in srgb, var(--danger) 20%, #e2e8f0) !important; }
      .toast.info { background: color-mix(in srgb, var(--info) 10%, #ffffff) !important; border-color: color-mix(in srgb, var(--info) 20%, #e2e8f0) !important; }
      .toast.warning { background: color-mix(in srgb, var(--warning) 12%, #ffffff) !important; border-color: color-mix(in srgb, var(--warning) 22%, #e2e8f0) !important; }

      @media (max-width: 768px) {
        :root {
          --m-gap: 12px;
          --m-pad: 12px;
          --m-radius: 10px;
        }

        html, body {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden !important;
          background: #f8fafc;
        }

        body {
          padding-bottom: env(safe-area-inset-bottom);
        }

        .app-layout,
        .main-content,
        .content-area,
        .page-section {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .main-content {
          min-height: 100dvh !important;
        }

        .content-area {
          padding: var(--m-pad) !important;
          overflow-x: hidden !important;
        }

        .top-header {
          height: 60px !important;
          padding: 0 12px !important;
          gap: 10px !important;
          border-bottom-color: #e2e8f0 !important;
        }

        .page-title {
          min-width: 0 !important;
          font-size: 17px !important;
          line-height: 1.15 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .live-clock {
          display: none !important;
        }

        .header-actions {
          gap: 8px !important;
          margin-left: auto !important;
        }

        .btn,
        button,
        .form-input,
        .form-select,
        .form-textarea,
        input,
        select,
        textarea {
          min-width: 0 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .btn {
          min-height: 42px !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          gap: 7px !important;
          justify-content: center !important;
        }

        .btn-icon,
        .v39-action,
        .v12-bmc-action-btn {
          width: 40px !important;
          height: 40px !important;
          min-height: 40px !important;
          flex: 0 0 40px !important;
          border-radius: 8px !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .sidebar {
          width: min(86vw, 320px) !important;
          border-radius: 0 18px 18px 0 !important;
        }

        .sidebar-header,
        .user-card,
        .cash-widget {
          margin-left: 10px !important;
          margin-right: 10px !important;
        }

        .nav-menu {
          padding: 0 10px 14px !important;
        }

        .nav-item {
          min-height: 46px !important;
          border-radius: 8px !important;
        }

        .home-container,
        .inv-container,
        .v39-history,
        #page-admin > div,
        #page-dash > div,
        #page-exp > div,
        #page-debt > div,
        #page-customer > div,
        #page-payable > div,
        #page-quotation > div,
        #page-att > div,
        #page-log > div,
        #page-purchase > div {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 auto !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          box-sizing: border-box !important;
        }

        .welcome-banner {
          padding: 18px !important;
          border-radius: var(--m-radius) !important;
          align-items: stretch !important;
        }

        .welcome-title {
          font-size: 22px !important;
          line-height: 1.25 !important;
        }

        .welcome-subtitle {
          font-size: 13px !important;
        }

        .stats-grid,
        .actions-grid,
        .cash-actions,
        .inv-stats,
        .v39-stats,
        .category-dashboard-grid,
        .v38-category-grid,
        [class*="stats"][style*="grid-template"],
        [class*="grid"][style*="grid-template"] {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: var(--m-gap) !important;
          width: 100% !important;
        }

        .home-stats-grid {
          grid-template-columns: 1fr !important;
        }

        .stat-card,
        .action-card,
        .cash-action-btn,
        .inv-stat,
        .v39-stat,
        .category-card,
        .v38-category-card {
          min-width: 0 !important;
          border-radius: var(--m-radius) !important;
          padding: 14px !important;
        }

        .stat-value,
        .inv-stat-value,
        .v39-stat b {
          font-size: clamp(18px, 5vw, 24px) !important;
          line-height: 1.1 !important;
          word-break: break-word !important;
        }

        .pos-layout {
          display: block !important;
          height: auto !important;
          min-height: calc(100dvh - 84px) !important;
        }

        .pos-products {
          width: 100% !important;
          min-height: calc(100dvh - 96px) !important;
          border-radius: var(--m-radius) !important;
          overflow: hidden !important;
        }

        .pos-toolbar {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 10px !important;
          padding: 12px !important;
          align-items: center !important;
        }

        .search-box {
          width: 100% !important;
          min-width: 0 !important;
          height: 46px !important;
          padding: 0 10px !important;
          border-radius: 8px !important;
          gap: 8px !important;
        }

        .search-box input {
          min-width: 0 !important;
          font-size: 14px !important;
        }

        .scan-btn {
          width: 36px !important;
          height: 36px !important;
          display: inline-grid !important;
          place-items: center !important;
          flex: 0 0 36px !important;
        }

        .view-toggle {
          height: 46px !important;
          border-radius: 8px !important;
          flex: 0 0 auto !important;
        }

        .view-btn {
          width: 42px !important;
          padding: 0 !important;
          display: inline-grid !important;
          place-items: center !important;
        }

        .category-tabs {
          width: 100% !important;
          padding: 10px 12px !important;
          gap: 8px !important;
          scroll-padding-inline: 12px !important;
        }

        .cat-tab {
          min-height: 38px !important;
          padding: 8px 14px !important;
          border-radius: 999px !important;
          font-size: 12px !important;
        }

        .products-container {
          padding: 12px !important;
          min-height: 0 !important;
        }

        .product-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
        }

        .product-card {
          width: 100% !important;
          min-width: 0 !important;
          border-radius: 10px !important;
          border-width: 1px !important;
          transform: none !important;
        }

        .product-img {
          height: 92px !important;
        }

        .product-info {
          padding: 10px !important;
        }

        .product-name {
          min-height: 34px !important;
          font-size: 12px !important;
        }

        .product-price {
          font-size: 15px !important;
        }

        .products-info {
          padding: 10px 12px !important;
          text-align: center !important;
        }

        .pos-cart {
          width: min(92vw, 420px) !important;
          max-width: 92vw !important;
          right: 4vw !important;
          left: auto !important;
          top: 72px !important;
          bottom: calc(12px + env(safe-area-inset-bottom)) !important;
          height: auto !important;
          border-radius: 14px !important;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .22) !important;
        }

        .cart-header,
        .cart-summary,
        .print-format {
          padding-left: 14px !important;
          padding-right: 14px !important;
        }

        .cart-items {
          padding: 12px !important;
        }

        .cart-item {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 8px !important;
          padding: 12px !important;
          border-radius: 10px !important;
        }

        .cart-item-controls,
        .cart-item-total,
        .cart-item-delete {
          justify-self: end !important;
        }

        .cart-fab {
          right: 16px !important;
          bottom: calc(16px + env(safe-area-inset-bottom)) !important;
          width: 58px !important;
          height: 58px !important;
          border-radius: 16px !important;
        }

        .inv-toolbar,
        .v39-history-hero,
        .v39-history-filters {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          width: 100% !important;
          align-items: stretch !important;
        }

        .v39-history-hero {
          padding: 14px !important;
          border-radius: var(--m-radius) !important;
        }

        .v39-history-title {
          gap: 10px !important;
        }

        .v39-history-title .icon {
          width: 40px !important;
          height: 40px !important;
          border-radius: 8px !important;
        }

        .v39-history-title h2 {
          font-size: 20px !important;
        }

        .v39-history-title p {
          font-size: 12px !important;
          line-height: 1.35 !important;
        }

        .v39-search,
        .v39-date,
        .v39-export,
        .inv-toolbar .search-box,
        .toolbar-actions,
        .toolbar-actions .btn,
        .mobile-action-toggle {
          width: 100% !important;
          min-width: 0 !important;
        }

        .toolbar-actions {
          border-radius: var(--m-radius) !important;
          padding: 10px !important;
          gap: 8px !important;
        }

        .table-wrapper,
        .v39-table-wrap {
          width: 100% !important;
          max-width: 100% !important;
          border-radius: var(--m-radius) !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .v39-sales-table {
          min-width: 860px !important;
        }

        .data-table tr,
        table.data-table tr {
          border-radius: var(--m-radius) !important;
          padding: 12px !important;
          margin-bottom: 12px !important;
        }

        .data-table td,
        table.data-table td {
          min-height: 38px !important;
          gap: 10px !important;
        }

        .data-table td > *,
        table.data-table td > * {
          max-width: 65% !important;
        }

        .modal-overlay,
        .checkout-overlay {
          padding: 10px !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .modal-box {
          width: min(94vw, 560px) !important;
          max-width: 94vw !important;
          max-height: min(88dvh, 760px) !important;
          border-radius: 14px !important;
        }

        .modal-header {
          min-height: 58px !important;
          padding: 14px 16px !important;
        }

        .modal-header h3 {
          min-width: 0 !important;
          font-size: 17px !important;
          line-height: 1.25 !important;
        }

        .modal-body {
          padding: 14px !important;
        }

        #checkout-overlay .checkout-modal.v36-checkout-modal {
          width: min(96vw, 520px) !important;
          height: min(92dvh, 760px) !important;
          max-width: 96vw !important;
          max-height: 92dvh !important;
          display: flex !important;
          flex-direction: column !important;
          border-radius: 14px !important;
          margin: 0 !important;
        }

        #checkout-overlay .checkout-modal.v36-checkout-modal::before,
        #checkout-overlay .checkout-modal.v36-checkout-modal .v36-checkout-summary {
          display: none !important;
        }

        #checkout-overlay .checkout-modal.v36-checkout-modal .checkout-progress {
          min-height: 74px !important;
          padding: 12px !important;
          overflow-x: auto !important;
          flex: 0 0 auto !important;
        }

        #checkout-overlay .checkout-modal.v36-checkout-modal .checkout-content {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          padding: 14px !important;
          overflow-y: auto !important;
        }

        #checkout-overlay .checkout-modal.v36-checkout-modal .checkout-footer {
          flex: 0 0 auto !important;
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 8px !important;
          padding: 12px !important;
        }

        #checkout-cancel {
          grid-column: 1 / -1 !important;
        }

        #checkout-next,
        #checkout-back {
          width: 100% !important;
          min-width: 0 !important;
        }

        .customer-selection,
        .payment-methods,
        .denomination-grid,
        .coins-grid {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        .customer-type-btn,
        .payment-method-btn,
        .denom-card {
          width: 100% !important;
          border-radius: 10px !important;
        }

        .cash-counting-header {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 8px !important;
          padding: 12px !important;
        }

        #toast-container {
          left: 12px !important;
          right: 12px !important;
          bottom: calc(12px + env(safe-area-inset-bottom)) !important;
          align-items: stretch !important;
        }

        .toast {
          width: 100% !important;
          max-width: none !important;
          border-radius: 10px !important;
        }

        #scanner-modal .modal-box {
          width: min(94vw, 420px) !important;
          max-width: 94vw !important;
        }

        #reader {
          min-height: 300px !important;
        }

        .swal2-popup {
          width: min(94vw, 520px) !important;
          border-radius: 14px !important;
        }
      }

      @media (max-width: 768px) and (display-mode: standalone), (max-width: 768px) and (display-mode: fullscreen) {
        body {
          min-height: 100dvh !important;
          background: #f8fafc !important;
        }

        .top-header {
          padding-top: env(safe-area-inset-top) !important;
          height: calc(60px + env(safe-area-inset-top)) !important;
        }

        .content-area {
          min-height: calc(100dvh - 60px - env(safe-area-inset-top)) !important;
          padding-bottom: calc(12px + env(safe-area-inset-bottom)) !important;
        }

        .cart-fab {
          bottom: calc(16px + env(safe-area-inset-bottom)) !important;
        }
      }

      @media (max-width: 430px) {
        .content-area {
          padding: 10px !important;
        }

        .stats-grid,
        .actions-grid,
        .cash-actions,
        .inv-stats,
        .v39-stats,
        .category-dashboard-grid,
        .v38-category-grid,
        [class*="stats"][style*="grid-template"],
        [class*="grid"][style*="grid-template"] {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        .product-grid {
          grid-template-columns: 1fr !important;
        }

        .product-img {
          height: 120px !important;
        }

        .pos-toolbar {
          grid-template-columns: 1fr !important;
        }

        .view-toggle {
          width: 100% !important;
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
        }

        .view-btn {
          width: 100% !important;
        }

        .v39-sales-table {
          min-width: 780px !important;
        }
      }

      @media (min-width: 431px) and (max-width: 768px) {
        .product-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .denomination-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installMobilePolish);
  else installMobilePolish();
})();
