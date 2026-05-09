// V52: final stock permission + staff PIN compatibility fixes.
(function () {
  console.log('[v52] stock permission/login fix loaded');

  const EXTRA_PERM_KEY = 'sk_pos_extra_permissions_v1';

  function readExtraPerms() {
    return {};
  }

  function currentPerm(key) {
    if (typeof USER !== 'undefined' && USER?.role === 'admin') return true;
    if (typeof USER_PERMS !== 'undefined' && USER_PERMS?.[key] === true) return true;
    const uid = typeof USER !== 'undefined' ? USER?.id : '';
    return !!(uid && readExtraPerms()[uid]?.[key] === true);
  }

  function canAdjustStockV52() {
    return currentPerm('can_adjust_stock') || currentPerm('can_manage');
  }

  function canPromotionV52() {
    return currentPerm('can_promotion') || currentPerm('can_manage');
  }

  function runWithAdminRole(fn, args) {
    if (typeof fn !== 'function') return undefined;
    return fn.apply(this, args);
  }

  function denyStock() {
    const msg = 'ต้องได้รับสิทธิ์คลังสินค้า/ปรับสต็อกจากแอดมิน';
    if (typeof Swal !== 'undefined') Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์ปรับสต็อก', text: msg, confirmButtonColor: '#dc2626' });
    else if (typeof toast === 'function') toast(msg, 'warning');
  }

  function installStockPermissionGuard() {
    window.v52CanAdjustStock = canAdjustStockV52;
    window.v9CanAdjustStock = canAdjustStockV52;
    window.v9CanPromotion = canPromotionV52;

    if (typeof window.applyNavPermissions === 'function' && !window.applyNavPermissions.__v52StockPerm) {
      const originalApplyNavPermissions = window.applyNavPermissions;
      window.applyNavPermissions = function () {
        const result = originalApplyNavPermissions.apply(this, arguments);
        if (canAdjustStockV52()) {
          document.querySelectorAll('.nav-item[data-page="inv"]').forEach(item => { item.style.display = ''; });
        }
        return result;
      };
      window.applyNavPermissions.__v52StockPerm = true;
      try { applyNavPermissions = window.applyNavPermissions; } catch (_) {}
    }

    if (typeof window.go === 'function' && !window.go.__v52StockPerm) {
      const originalGo = window.go;
      window.go = function (page) {
        return originalGo.apply(this, arguments);
      };
      window.go.__v52StockPerm = true;
      try { go = window.go; } catch (_) {}
    }

    if (typeof window.adjustStock === 'function' && !window.adjustStock.__v52StockPerm) {
      const originalAdjustStock = window.adjustStock;
      window.adjustStock = async function () {
        if (!canAdjustStockV52()) { denyStock(); return false; }
        return await runWithAdminRole(originalAdjustStock, arguments);
      };
      window.adjustStock.__v52StockPerm = true;
      try { adjustStock = window.adjustStock; } catch (_) {}
    }

    if (typeof window.renderInventory === 'function' && !window.renderInventory.__v52StockPerm) {
      const originalRenderInventory = window.renderInventory;
      window.renderInventory = async function () {
        const canStock = canAdjustStockV52();
        const canPromo = canPromotionV52();
        const result = (canStock || canPromo)
          ? await runWithAdminRole(originalRenderInventory, arguments)
          : await originalRenderInventory.apply(this, arguments);

        if (!canStock) document.querySelectorAll('[onclick*="adjustStock"]').forEach(btn => btn.remove());
        if (!canPromo) document.getElementById('v9promo-inv-btn')?.remove();
        return result;
      };
      window.renderInventory.__v52StockPerm = true;
      try { renderInventory = window.renderInventory; } catch (_) {}
    }

    if (typeof window.showAddProductModal === 'function' && !window.showAddProductModal.__v52StockPerm) {
      const originalShowAddProductModal = window.showAddProductModal;
      window.showAddProductModal = function () {
        const result = runWithAdminRole(originalShowAddProductModal, arguments);
        setTimeout(() => {
          const canStock = canAdjustStockV52();
          ['v9prod-stock', 'v9prod-min-stock', 'prod-stock', 'prod-min-stock'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.readOnly = !canStock;
            el.style.background = canStock ? '' : '#f8fafc';
            el.title = canStock ? '' : 'ต้องได้รับสิทธิ์คลังสินค้า/ปรับสต็อกจากแอดมิน';
          });
        }, 120);
        return result;
      };
      window.showAddProductModal.__v52StockPerm = true;
      try { showAddProductModal = window.showAddProductModal; } catch (_) {}
    }
  }

  function ensurePinInputs() {
    const container = document.querySelector('.pin-container');
    if (!container || container.dataset.v52PinReady === '1') return;
    container.dataset.v52PinReady = '1';
    container.querySelectorAll('#pin-5, #pin-6').forEach(input => input.remove());
    const subtitle = document.querySelector('.login-subtitle');
    if (subtitle) subtitle.textContent = 'กรุณาระบุรหัส PIN 4 หลัก';

    const style = document.createElement('style');
    style.id = 'v52-pin-style';
    style.textContent = '.pin-container{display:grid;grid-template-columns:repeat(4,1fr);width:min(312px,100%);max-width:312px}.pin-input:placeholder-shown{opacity:.8}@media(max-width:480px){.pin-container{gap:10px;max-width:276px}.pin-input{height:66px}}';
    if (!document.getElementById(style.id)) document.head.appendChild(style);
  }

  function pinValue() {
    return Array.from(document.querySelectorAll('.pin-input'))
      .map(input => input.value.replace(/\D/g, '').slice(0, 1))
      .join('');
  }

  async function checkLoginV52(force = false) {
    const pin = pinValue();
    if (pin.length !== 4) {
      toast?.('กรุณากรอก PIN 4 หลัก', 'error');
      return;
    }
    if (!force && pin.length < 4) {
      return;
    }

    try {
      const { data, error } = await db.from('ผู้ใช้งาน').select('*').eq('pin', pin).maybeSingle();
      if (error || !data) {
        toast?.('รหัส PIN ไม่ถูกต้อง', 'error');
        document.querySelectorAll('.pin-input').forEach(i => { i.value = ''; i.classList.remove('filled'); });
        document.getElementById('pin-1')?.focus();
        return;
      }

      USER = data;
      const { data: perms } = await db.from('สิทธิ์การเข้าถึง').select('*').eq('user_id', data.id).maybeSingle();
      USER_PERMS = perms || {};
      document.getElementById('login-screen')?.classList.add('hidden');
      document.getElementById('app-layout')?.classList.remove('hidden');
      const nameEl = document.getElementById('user-display-name');
      const roleEl = document.getElementById('user-display-role');
      if (nameEl) nameEl.textContent = data.username;
      if (roleEl) roleEl.textContent = data.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน';
      applyNavPermissions?.();
      await initApp?.();
      toast?.(`ยินดีต้อนรับ ${data.username}`, 'success');
      logActivity?.('เข้าสู่ระบบ', data.username);
    } catch (e) {
      console.error('[v52] login:', e);
      toast?.('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    }
  }

  function installLoginFix() {
    ensurePinInputs();
    window.checkLogin = checkLoginV52;
    try { checkLogin = checkLoginV52; } catch (_) {}

    const inputs = Array.from(document.querySelectorAll('.pin-input'));
    inputs.forEach((input, index) => {
      if (input.dataset.v52PinBound === '1') return;
      input.dataset.v52PinBound = '1';
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 1);
        input.classList.toggle('filled', !!input.value);
        if (input.value && index < inputs.length - 1) inputs[index + 1].focus();
        const pin = pinValue();
        if (pin.length === 4) setTimeout(() => checkLoginV52(true), 80);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) inputs[index - 1].focus();
      });
    });

    const btn = document.getElementById('login-btn');
    if (btn && btn.dataset.v52LoginBound !== '1') {
      btn.dataset.v52LoginBound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        checkLoginV52(true);
      }, true);
    }
  }

  function boot() {
    installStockPermissionGuard();
    installLoginFix();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 600);
})();
