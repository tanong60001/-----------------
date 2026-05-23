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

  let lastToggleAt = 0;
  function onMenuEvent(event) {
    const button = event.target?.closest?.('#menu-toggle');
    if (!button) return;
    if (window.innerWidth > 768) return;

    const now = Date.now();
    if (event.type === 'click' && now - lastToggleAt < 420) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    lastToggleAt = now;

    const sidebar = document.getElementById('sidebar');
    setSidebar(!sidebar?.classList.contains('show'));
  }

  function installHandlers() {
    document.addEventListener('pointerup', onMenuEvent, true);
    document.addEventListener('click', onMenuEvent, true);

    document.addEventListener('click', event => {
      if (window.innerWidth > 768) return;
      if (!event.target?.closest?.('.nav-item[data-page]')) return;
      setSidebar(false);
    }, true);
  }

  installStyle();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installHandlers, { once: true });
  } else {
    installHandlers();
  }
})();
