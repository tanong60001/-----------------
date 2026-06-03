(function () {
  'use strict';

  function installStyle() {
    if (document.getElementById('v91-mobile-sidebar-fix-style')) return;
    const style = document.createElement('style');
    style.id = 'v91-mobile-sidebar-fix-style';
    style.textContent = `
      @media (max-width: 768px) {
        .top-header {
          position: sticky !important;
          top: 0 !important;
          z-index: 900 !important;
          isolation: isolate !important;
        }
        #menu-toggle {
          position: relative !important;
          z-index: 901 !important;
          pointer-events: auto !important;
          touch-action: manipulation !important;
          min-width: 44px !important;
          min-height: 44px !important;
        }
        #sidebar {
          z-index: 1050 !important;
        }
        #sidebar-overlay {
          z-index: 1040 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.toggle('show', open);
    overlay?.classList.toggle('show', open);
  }

  // คลิกเดียว = สลับครั้งเดียว (ตัด pointerup/debounce ที่ทำให้เปิดแล้วปิดทันที)
  // ใช้ capture + stopImmediatePropagation เพื่อกัน handler อื่น (app.js) toggle ซ้ำ
  function onMenuClick(event) {
    const button = event.target?.closest?.('#menu-toggle');
    if (!button) return;
    if (window.innerWidth > 768) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const sidebar = document.getElementById('sidebar');
    setSidebar(!sidebar?.classList.contains('show'));
  }

  function installHandlers() {
    document.addEventListener('click', onMenuClick, true);

    // แตะเมนูในแถบ → ปิด sidebar
    document.addEventListener('click', event => {
      if (window.innerWidth > 768) return;
      if (!event.target?.closest?.('.nav-item[data-page]')) return;
      setSidebar(false);
    }, true);

    // แตะฉากหลังมืด → ปิด
    document.addEventListener('click', event => {
      if (window.innerWidth > 768) return;
      if (event.target?.id === 'sidebar-overlay') setSidebar(false);
    }, true);
  }

  installStyle();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installHandlers, { once: true });
  } else {
    installHandlers();
  }
})();
