(function () {
  'use strict';

  const MOBILE_MAX = 768;

  function installStyle() {
    if (document.getElementById('v74-mobile-history-style')) return;
    const style = document.createElement('style');
    style.id = 'v74-mobile-history-style';
    style.textContent = `
      @media (max-width: ${MOBILE_MAX}px) {
        #page-history,
        #page-history * {
          box-sizing: border-box !important;
        }

        #page-history {
          max-width: 100vw !important;
          overflow-x: hidden !important;
        }

        #page-history .v39-history {
          gap: 12px !important;
          max-width: 100% !important;
        }

        #page-history .v39-history-hero {
          border-radius: 8px !important;
          padding: 12px !important;
          box-shadow: 0 10px 24px rgba(15, 23, 42, .06) !important;
        }

        #page-history .v39-history-title {
          display: grid !important;
          grid-template-columns: 40px minmax(0, 1fr) !important;
          align-items: center !important;
        }

        #page-history .v39-history-title h2,
        #page-history .v39-history-title p {
          min-width: 0 !important;
          overflow-wrap: anywhere !important;
        }

        #history-stats.v39-stats {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        #history-stats .v39-stat {
          min-height: 72px !important;
          padding: 10px !important;
          border-radius: 8px !important;
          align-items: center !important;
        }

        #history-stats .v39-stat .dot {
          width: 34px !important;
          height: 34px !important;
          border-radius: 8px !important;
        }

        #history-stats .v39-stat b {
          font-size: 17px !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        #history-stats .v39-stat span {
          font-size: 10.5px !important;
          white-space: normal !important;
          line-height: 1.2 !important;
        }

        #page-history .v39-table-wrap {
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        #page-history .v39-sales-table {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          border-collapse: separate !important;
        }

        #page-history .v39-sales-table thead {
          display: none !important;
        }

        #page-history .v39-sales-table tbody {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 10px !important;
          width: 100% !important;
        }

        #page-history .v39-sales-table tr {
          position: relative !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          gap: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: 12px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          background: #fff !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, .06) !important;
          overflow: hidden !important;
          cursor: pointer !important;
        }

        #page-history .v39-sales-table tr::after {
          content: 'แตะเพื่อดูรายละเอียด';
          grid-column: 1 / -1;
          margin-top: 9px;
          padding-top: 8px;
          border-top: 1px dashed #e2e8f0;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          text-align: center;
        }

        #page-history .v39-sales-table tr:has(.v39-empty)::after {
          display: none !important;
        }

        #page-history .v39-sales-table tr.v74-open::after {
          content: 'ซ่อนรายละเอียด';
          color: #dc2626;
        }

        #page-history .v39-sales-table td {
          min-width: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: #334155 !important;
        }

        #page-history .v39-sales-table td[colspan] {
          display: block !important;
          grid-column: 1 / -1 !important;
        }

        #page-history .v39-sales-table td:not(:nth-child(1)):not(:nth-child(6)) {
          display: none !important;
        }

        #page-history .v39-sales-table tr.v74-open td:not(:nth-child(1)):not(:nth-child(6)) {
          display: grid !important;
          grid-template-columns: 88px minmax(0, 1fr) !important;
          gap: 10px !important;
          align-items: center !important;
          grid-column: 1 / -1 !important;
          padding-top: 11px !important;
          margin-top: 11px !important;
          border-top: 1px solid #f1f5f9 !important;
        }

        #page-history .v39-sales-table tr.v74-open td:not(:nth-child(1)):not(:nth-child(6)) > * {
          justify-self: end !important;
          text-align: right !important;
        }

        #page-history .v39-sales-table td:nth-child(1) {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: flex-start !important;
          min-height: 54px !important;
          padding-right: 10px !important;
        }

        #page-history .v39-sales-table td:nth-child(6) {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: flex-end !important;
          min-height: 54px !important;
          text-align: right !important;
          padding-left: 10px !important;
        }

        #page-history .v39-sales-table td:nth-child(1)::before,
        #page-history .v39-sales-table td:nth-child(6)::before {
          display: none !important;
          content: none !important;
        }

        #page-history .v39-bill-no {
          max-width: 100% !important;
          font-size: 18px !important;
          line-height: 1.05 !important;
          overflow-wrap: anywhere !important;
        }

        #page-history .v39-money {
          font-size: 18px !important;
          line-height: 1.05 !important;
          color: #0f172a !important;
          text-align: right !important;
          overflow-wrap: anywhere !important;
        }

        #page-history .v39-sub,
        #page-history .v39-discount {
          max-width: 100% !important;
          overflow-wrap: anywhere !important;
        }

        #page-history .v39-sales-table tr.v74-open td:nth-child(2)::before { content: 'วันเวลา'; }
        #page-history .v39-sales-table tr.v74-open td:nth-child(3)::before { content: 'ลูกค้า'; }
        #page-history .v39-sales-table tr.v74-open td:nth-child(4)::before { content: 'ชำระเงิน'; }
        #page-history .v39-sales-table tr.v74-open td:nth-child(5)::before { content: 'จัดส่ง'; }
        #page-history .v39-sales-table tr.v74-open td:nth-child(7)::before { content: 'สถานะ'; }
        #page-history .v39-sales-table tr.v74-open td:nth-child(8)::before { content: 'จัดการ'; }

        #page-history .v39-sales-table tr.v74-open td::before {
          color: #94a3b8 !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          line-height: 1.2 !important;
          text-align: left !important;
          justify-self: start !important;
        }

        #page-history .v39-pill {
          max-width: 100% !important;
          white-space: normal !important;
          justify-content: center !important;
          text-align: center !important;
          line-height: 1.2 !important;
          border-radius: 8px !important;
        }

        #page-history .v71-status-combo {
          max-width: 100% !important;
          align-items: flex-start !important;
        }

        #page-history .v39-actions-wrap {
          position: static !important;
          justify-content: flex-end !important;
          width: 100% !important;
        }

        #page-history .v39-actions-toggle {
          display: none !important;
        }

        #page-history .v39-actions {
          position: static !important;
          display: flex !important;
          width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          justify-content: flex-end !important;
          gap: 7px !important;
        }

        #page-history .v39-action {
          width: 38px !important;
          height: 38px !important;
          min-height: 38px !important;
          flex: 0 0 38px !important;
          border-radius: 8px !important;
        }

        #page-history .v39-empty {
          padding: 34px 16px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          background: #fff !important;
        }

        #page-inv,
        #page-inv * {
          box-sizing: border-box !important;
        }

        #page-inv {
          max-width: 100vw !important;
          overflow-x: hidden !important;
        }

        #page-inv .inv-container {
          width: 100% !important;
          max-width: 100% !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        #page-inv .table-wrapper {
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        #page-inv #inv-table {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
        }

        #page-inv #inv-table thead {
          display: none !important;
        }

        #page-inv #inv-table tbody {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 10px !important;
          width: 100% !important;
        }

        #page-inv #inv-table tr {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 13px 14px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          background: #fff !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, .06) !important;
          overflow: hidden !important;
          cursor: pointer !important;
        }

        #page-inv #inv-table tr::after {
          content: 'แตะเพื่อดูรายละเอียด';
          margin-top: 9px;
          padding-top: 8px;
          border-top: 1px dashed #e2e8f0;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          text-align: center;
        }

        #page-inv #inv-table tr.v74-open::after {
          content: 'ซ่อนรายละเอียด';
          color: #dc2626;
        }

        #page-inv #inv-table td {
          min-width: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: #334155 !important;
        }

        #page-inv #inv-table td > * {
          max-width: 100% !important;
        }

        #page-inv #inv-table td:not(:nth-child(2)) {
          display: none !important;
        }

        #page-inv #inv-table td:nth-child(2) {
          display: block !important;
          text-align: left !important;
        }

        #page-inv #inv-table td:nth-child(2)::before {
          display: none !important;
          content: none !important;
        }

        #page-inv #inv-table td:nth-child(2) strong {
          display: block !important;
          color: #0f172a !important;
          font-size: 17px !important;
          font-weight: 950 !important;
          line-height: 1.25 !important;
          overflow-wrap: anywhere !important;
        }

        #page-inv #inv-table td:nth-child(2) small {
          display: none !important;
          margin-top: 3px !important;
          color: #94a3b8 !important;
          font-weight: 800 !important;
          line-height: 1.25 !important;
          overflow-wrap: anywhere !important;
        }

        #page-inv #inv-table tr.v74-open td:nth-child(2) small {
          display: block !important;
        }

        #page-inv #inv-table tr.v74-open td:not(:nth-child(2)) {
          display: grid !important;
          grid-template-columns: 88px minmax(0, 1fr) !important;
          gap: 10px !important;
          align-items: center !important;
          padding-top: 11px !important;
          margin-top: 11px !important;
          border-top: 1px solid #f1f5f9 !important;
        }

        #page-inv #inv-table tr.v74-open td:not(:nth-child(2)) > * {
          justify-self: end !important;
          text-align: right !important;
        }

        #page-inv #inv-table tr.v74-open td:nth-child(1)::before { content: 'รูป'; }
        #page-inv #inv-table tr.v74-open td:nth-child(3)::before { content: 'บาร์โค้ด'; }
        #page-inv #inv-table tr.v74-open td:nth-child(4)::before { content: 'หมวด'; }
        #page-inv #inv-table tr.v74-open td:nth-child(5)::before { content: 'ราคาขาย'; }
        #page-inv #inv-table tr.v74-open td:nth-child(6)::before { content: 'ต้นทุน'; }
        #page-inv #inv-table tr.v74-open td:nth-child(7)::before { content: 'สต็อก'; }
        #page-inv #inv-table tr.v74-open td:nth-child(8)::before { content: 'จัดการ'; }

        #page-inv #inv-table tr.v74-open td::before {
          color: #94a3b8 !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          line-height: 1.2 !important;
          justify-self: start !important;
          text-align: left !important;
        }

        #page-inv .product-img-cell {
          width: 48px !important;
          height: 48px !important;
          border-radius: 8px !important;
          justify-self: end !important;
        }

        #page-inv .badge {
          max-width: 100% !important;
          white-space: normal !important;
          text-align: center !important;
          justify-content: center !important;
        }

        #page-inv .table-actions {
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: flex-end !important;
          gap: 7px !important;
          width: 100% !important;
        }

        #page-inv .v38-table-wrap {
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        #page-inv .v38-table {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          white-space: normal !important;
        }

        #page-inv .v38-table thead {
          display: none !important;
        }

        #page-inv .v38-table tbody {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 10px !important;
          width: 100% !important;
        }

        #page-inv .v38-table tr {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 13px 14px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          background: #fff !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, .06) !important;
          overflow: hidden !important;
          cursor: pointer !important;
        }

        #page-inv .v38-table tr::after {
          content: 'แตะเพื่อดูรายละเอียด';
          margin-top: 9px;
          padding-top: 8px;
          border-top: 1px dashed #e2e8f0;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          text-align: center;
        }

        #page-inv .v38-table tr:has(.v38-empty)::after {
          display: none !important;
        }

        #page-inv .v38-table tr.v74-open::after {
          content: 'ซ่อนรายละเอียด';
          color: #dc2626;
        }

        #page-inv .v38-table td {
          min-width: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: #334155 !important;
          text-align: left !important;
        }

        #page-inv .v38-table td > * {
          max-width: 100% !important;
        }

        #page-inv .v38-table td:not(:nth-child(2)) {
          display: none !important;
        }

        #page-inv .v38-table td:nth-child(2) {
          display: block !important;
          text-align: left !important;
        }

        #page-inv .v38-table td:nth-child(2)::before {
          display: none !important;
          content: none !important;
        }

        #page-inv .v38-table td:nth-child(2) strong {
          display: block !important;
          color: #0f172a !important;
          font-size: 17px !important;
          font-weight: 950 !important;
          line-height: 1.25 !important;
          overflow-wrap: anywhere !important;
        }

        #page-inv .v38-table td:nth-child(2) small {
          display: none !important;
          margin-top: 3px !important;
          color: #94a3b8 !important;
          font-weight: 800 !important;
          line-height: 1.25 !important;
          overflow-wrap: anywhere !important;
          white-space: normal !important;
        }

        #page-inv .v38-table tr.v74-open td:nth-child(2) small {
          display: block !important;
        }

        #page-inv .v38-table tr.v74-open td:not(:nth-child(2)) {
          display: grid !important;
          grid-template-columns: 88px minmax(0, 1fr) !important;
          gap: 10px !important;
          align-items: center !important;
          padding-top: 11px !important;
          margin-top: 11px !important;
          border-top: 1px solid #f1f5f9 !important;
        }

        #page-inv .v38-table tr.v74-open td:not(:nth-child(2)) > * {
          justify-self: end !important;
          text-align: right !important;
        }

        #page-inv .v38-table tr.v74-open td:nth-child(1)::before { content: 'รูป'; }
        #page-inv .v38-table tr.v74-open td:nth-child(3)::before { content: 'บาร์โค้ด'; }
        #page-inv .v38-table tr.v74-open td:nth-child(4)::before { content: 'หมวด'; }
        #page-inv .v38-table tr.v74-open td:nth-child(5)::before { content: 'ราคาขาย'; }
        #page-inv .v38-table tr.v74-open td:nth-child(6)::before { content: 'ต้นทุน'; }
        #page-inv .v38-table tr.v74-open td:nth-child(7)::before { content: 'สต็อก'; }
        #page-inv .v38-table tr.v74-open td:nth-child(8)::before { content: 'จัดการ'; }

        #page-inv .v38-table tr.v74-open td::before {
          color: #94a3b8 !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          line-height: 1.2 !important;
          justify-self: start !important;
          text-align: left !important;
        }

        #page-inv .v38-img {
          width: 48px !important;
          height: 48px !important;
          border-radius: 8px !important;
          justify-self: end !important;
        }

        #page-inv .v38-cat-badge,
        #page-inv .v38-stock {
          max-width: 100% !important;
          white-space: normal !important;
          text-align: center !important;
          justify-content: center !important;
        }

        #page-inv .v38-actions {
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: flex-end !important;
          gap: 7px !important;
          width: 100% !important;
        }
      }

      @media (max-width: 380px) {
        #page-history .v39-sales-table tr {
          grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr) !important;
          padding: 10px !important;
        }

        #page-history .v39-sales-table tr.v74-open td:not(:nth-child(1)):not(:nth-child(6)) {
          grid-template-columns: 76px minmax(0, 1fr) !important;
        }

        #page-history .v39-bill-no,
        #page-history .v39-money {
          font-size: 16px !important;
        }

        #page-inv #inv-table tr.v74-open td:not(:nth-child(2)) {
          grid-template-columns: 76px minmax(0, 1fr) !important;
        }

        #page-inv .v38-table tr.v74-open td:not(:nth-child(2)) {
          grid-template-columns: 76px minmax(0, 1fr) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isMobile() {
    return window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
  }

  function handleHistoryTap(event) {
    if (!isMobile()) return;
    const row = event.target?.closest?.('#history-tbody tr');
    if (!row) return;
    if (event.target.closest('button, a, input, select, textarea, .v39-actions, .v39-actions-wrap')) return;
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return;
    row.classList.toggle('v74-open');
  }

  function handleInventoryTap(event) {
    if (!isMobile()) return;
    const row = event.target?.closest?.('#inv-tbody tr, #page-inv .v38-table tbody tr');
    if (!row) return;
    if (event.target.closest('button, a, input, select, textarea, .table-actions, .v38-actions')) return;
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return;
    row.classList.toggle('v74-open');
  }

  function closeActionMenusOnMobile() {
    if (!isMobile()) return;
    document.querySelectorAll('#history-tbody .v39-actions-wrap.open').forEach(el => el.classList.remove('open'));
  }

  function installEvents() {
    if (window.__v74MobileHistoryEvents) return;
    window.__v74MobileHistoryEvents = true;
    document.addEventListener('click', handleHistoryTap);
    document.addEventListener('click', handleInventoryTap);
    window.addEventListener('resize', closeActionMenusOnMobile, { passive: true });
  }

  function boot() {
    installStyle();
    installEvents();
    closeActionMenusOnMobile();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
