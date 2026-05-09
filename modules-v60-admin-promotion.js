// V60: move promotion management entry point to Admin only.
(function () {
  'use strict';

  const TAG = '[v60-admin-promotion]';

  function isAdmin() {
    try {
      if (window.__SK_ACCESS_GUARD__?.isAdmin) return window.__SK_ACCESS_GUARD__.isAdmin();
      return typeof USER !== 'undefined' && USER?.role === 'admin';
    } catch (_) {
      return false;
    }
  }

  function denyAdmin() {
    const msg = 'จัดการโปรโมชั่นได้เฉพาะผู้ดูแลระบบ';
    if (window.Swal?.fire) {
      window.Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์', text: msg, confirmButtonColor: '#dc2626' });
    } else if (typeof window.toast === 'function') {
      window.toast(msg, 'error');
    }
    return false;
  }

  function setGlobal(name, fn) {
    window[name] = fn;
    try { Function('name', 'fn', 'window[name] = fn; eval(name + " = fn");')(name, fn); }
    catch (_) {}
  }

  function removeNonAdminPromoEntrypoints() {
    document.querySelectorAll(
      '#v9promo-inv-btn, #v9promo-open-btn, #pos-categories [data-cat="__promo__"], .v50-promo-tab'
    ).forEach(el => el.remove());

    document.querySelectorAll('button, a').forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g, '');
      const onclick = el.getAttribute('onclick') || '';
      if (/v9OpenPromoModal|v50FilterPromoCategory/.test(onclick) && /โปรโมชั่น|โปรโมชัน/.test(text)) {
        el.remove();
      }
    });
  }

  function installInventoryRenderCleanup() {
    ['renderInventory', 'renderProductGrid', 'renderCategories'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__v60PromoCleanup) return;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        const clean = () => removeNonAdminPromoEntrypoints();
        if (result && typeof result.then === 'function') {
          return result.then(value => {
            clean();
            setTimeout(clean, 80);
            return value;
          });
        }
        clean();
        setTimeout(clean, 80);
        return result;
      };
      Object.defineProperty(wrapped, '__v60PromoCleanup', { value: true });
      setGlobal(name, wrapped);
    });
  }

  function installPromoEntryObserver() {
    if (window.__v60PromoEntryObserver) return;
    window.__v60PromoEntryObserver = new MutationObserver(() => removeNonAdminPromoEntrypoints());
    window.__v60PromoEntryObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function promoCardHtml() {
    return `
      <button type="button" class="v36-admin-menu-card v60-admin-promo-card" onclick="v36AdminOpenSection('promotion')">
        <span class="v36-admin-menu-icon" style="background:#33415518;color:#334155"><i class="material-icons-round">local_offer</i></span>
        <span class="v36-admin-menu-text">
          <span class="v36-admin-menu-title">โปรโมชั่น</span>
          <span class="v36-admin-menu-desc">จัดการสินค้าโปรโมชั่นและส่วนลด เฉพาะผู้ดูแลระบบ</span>
        </span>
        <i class="material-icons-round v36-admin-menu-arrow">chevron_right</i>
      </button>`;
  }

  function injectStyle() {
    if (document.getElementById('v60-admin-promotion-style')) return;
    const style = document.createElement('style');
    style.id = 'v60-admin-promotion-style';
    style.textContent = `
      .v60-admin-promo-wrap{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 18px}
      .v60-admin-promo-wrap .v60-admin-promo-card{max-width:560px}
    `;
    document.head.appendChild(style);
  }

  function injectAdminPromoCard() {
    if (!isAdmin()) return;
    const page = document.getElementById('page-admin');
    if (!page || page.classList.contains('hidden')) return;
    if (page.querySelector('.v60-admin-promo-card')) return;

    const menuGrid = page.querySelector('.v36-admin-menu-grid');
    if (menuGrid) {
      menuGrid.insertAdjacentHTML('beforeend', promoCardHtml());
      return;
    }

    const target = page.querySelector('.v36-admin-hero') || page.firstElementChild;
    if (target) target.insertAdjacentHTML('afterend', `<div class="v60-admin-promo-wrap">${promoCardHtml()}</div>`);
  }

  function installAdminSection() {
    if (window.v36AdminOpenSection && !window.v36AdminOpenSection.__v60PromoAdmin) {
      const originalOpenSection = window.v36AdminOpenSection;
      const wrappedOpenSection = async function (section) {
        if (section === 'promotion') {
          if (!isAdmin()) return denyAdmin();
          if (typeof window.v9OpenPromoModal === 'function') return window.v9OpenPromoModal();
          return false;
        }
        return originalOpenSection.apply(this, arguments);
      };
      Object.defineProperty(wrappedOpenSection, '__v60PromoAdmin', { value: true });
      setGlobal('v36AdminOpenSection', wrappedOpenSection);
    }

    if (typeof window.renderAdmin === 'function' && !window.renderAdmin.__v60PromoAdmin) {
      const originalRenderAdmin = window.renderAdmin;
      const wrappedRenderAdmin = async function () {
        const result = await originalRenderAdmin.apply(this, arguments);
        injectAdminPromoCard();
        removeNonAdminPromoEntrypoints();
        return result;
      };
      Object.defineProperty(wrappedRenderAdmin, '__v60PromoAdmin', { value: true });
      setGlobal('renderAdmin', wrappedRenderAdmin);
    }
  }

  function installPromoModalAdminGuard() {
    if (typeof window.v9OpenPromoModal === 'function' && !window.v9OpenPromoModal.__v60AdminOnly) {
      const originalOpenPromo = window.v9OpenPromoModal;
      const guardedOpenPromo = function () {
        if (!isAdmin()) return denyAdmin();
        return originalOpenPromo.apply(this, arguments);
      };
      Object.defineProperty(guardedOpenPromo, '__v60AdminOnly', { value: true });
      setGlobal('v9OpenPromoModal', guardedOpenPromo);
    }
  }

  function boot() {
    injectStyle();
    installAdminSection();
    installPromoModalAdminGuard();
    installInventoryRenderCleanup();
    installPromoEntryObserver();
    removeNonAdminPromoEntrypoints();
    injectAdminPromoCard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  [250, 700, 1500, 3000, 6000, 12000, 30000, 47000].forEach(delay => setTimeout(boot, delay));
  console.log(TAG, 'loaded');
})();
