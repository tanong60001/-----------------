// V59: enforce promotion permission at sale time and polish customer modal.
(function () {
  'use strict';

  const TAG = '[v59-promo-customer-ui]';

  function getUser() {
    try { return typeof USER !== 'undefined' ? USER : window.USER; }
    catch (_) { return window.USER; }
  }

  function getPerms() {
    try { return typeof USER_PERMS !== 'undefined' ? USER_PERMS : window.USER_PERMS; }
    catch (_) { return window.USER_PERMS; }
  }

  function canPromo() {
    if (window.__SK_ACCESS_GUARD__?.can) return window.__SK_ACCESS_GUARD__.can('can_promotion');
    const user = getUser();
    const perms = getPerms() || {};
    if (!user) return false;
    if (user.role === 'admin') return true;
    return perms.can_promotion === true || perms.can_manage === true;
  }

  function canUseCustomerPage() {
    const guard = window.__SK_ACCESS_GUARD__;
    return !guard?.canPage || guard.canPage('customer');
  }

  function money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function activeCart() {
    try { if (Array.isArray(cart)) return cart; } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }

  function syncCart(next) {
    try { cart = next; } catch (_) { window.cart = next; }
  }

  function stripPromoFromCart() {
    if (canPromo()) return false;
    let changed = false;
    const next = activeCart().map(item => {
      if (!item) return item;
      const clean = { ...item };
      if (clean.original_price != null) {
        clean.price = money(clean.original_price);
        changed = true;
      }
      ['original_price', 'promo_percent', 'promo_discount', 'discount_total', 'discount_per_unit', 'manual_discount_per_unit'].forEach(key => {
        if (clean[key] != null) {
          delete clean[key];
          changed = true;
        }
      });
      return clean;
    });

    if (changed) syncCart(next);
    return changed;
  }

  function resetManualDiscount() {
    if (canPromo()) return false;
    const input = document.getElementById('pos-discount');
    if (!input) return false;
    let changed = false;
    if (money(input.value) !== 0) {
      input.value = '0';
      changed = true;
    }
    input.readOnly = true;
    input.disabled = true;
    input.title = 'ต้องได้รับสิทธิ์โปรโมชั่น/ส่วนลดจากผู้ดูแล';
    input.style.background = '#f1f5f9';
    input.style.color = '#94a3b8';
    return changed;
  }

  function unlockManualDiscountIfAllowed() {
    const input = document.getElementById('pos-discount');
    if (!input || !canPromo()) return;
    input.readOnly = false;
    input.disabled = false;
    input.title = '';
    input.style.background = '';
    input.style.color = '';
  }

  function sanitizeSaleState(render = true) {
    const changedCart = stripPromoFromCart();
    const changedDiscount = resetManualDiscount();
    if (canPromo()) unlockManualDiscountIfAllowed();
    if (!canPromo()) removePromoVisuals();
    if (render && (changedCart || changedDiscount)) {
      try { window.renderCart?.(); } catch (_) {}
      try { window.renderProductGrid?.(); } catch (_) {}
      try { window.sendToDisplay?.({ type: 'cart', cart: activeCart(), total: window.getCartTotal?.() || 0 }); } catch (_) {}
    }
  }

  function denyPromo() {
    const msg = 'ต้องได้รับสิทธิ์โปรโมชั่น/ส่วนลดจากผู้ดูแล';
    if (window.Swal?.fire) {
      window.Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์ใช้โปรโมชั่น', text: msg, confirmButtonColor: '#dc2626' });
    } else if (typeof window.toast === 'function') {
      window.toast(msg, 'error');
    }
    return false;
  }

  function removePromoVisuals() {
    if (canPromo()) return;
    document.querySelectorAll('#pos-categories [data-cat="__promo__"], #v9promo-inv-btn').forEach(el => el.remove());
    document.querySelectorAll('.v50-promo-ribbon').forEach(el => el.remove());
    document.querySelectorAll('.v50-promo-card,.v50-promo-img').forEach(el => {
      el.classList.remove('v50-promo-card', 'v50-promo-img');
    });

    const productList = (() => { try { return products || []; } catch (_) { return window.products || []; } })();
    document.querySelectorAll('#pos-product-grid [onclick*="addToCart"]').forEach(card => {
      const raw = card.getAttribute('onclick') || '';
      const match = raw.match(/addToCart\(['"]([^'"]+)['"]\)/);
      if (!match) return;
      const product = Array.isArray(productList) ? productList.find(p => String(p.id) === String(match[1])) : null;
      const priceEl = card.querySelector('.product-price');
      if (product && priceEl && priceEl.dataset.v50PromoPrice) {
        priceEl.textContent = `฿${typeof window.formatNum === 'function' ? window.formatNum(product.price) : product.price}`;
        delete priceEl.dataset.v50PromoPrice;
      }
    });
  }

  function setGlobal(name, fn) {
    window[name] = fn;
    try { Function('name', 'fn', 'window[name] = fn; eval(name + " = fn");')(name, fn); }
    catch (_) {}
  }

  function wrapAfter(name, after) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v59PromoGuarded) return;
    const wrapped = function () {
      const result = original.apply(this, arguments);
      const finish = () => after.apply(this, arguments);
      if (result && typeof result.then === 'function') {
        return result.then(value => {
          finish();
          return value;
        });
      }
      finish();
      return result;
    };
    Object.defineProperty(wrapped, '__v59PromoGuarded', { value: true });
    Object.defineProperty(wrapped, '__v50PromoPrice', { value: original.__v50PromoPrice === true });
    setGlobal(name, wrapped);
  }

  function installPromoGuards() {
    window.v9CanPromotion = canPromo;

    if (typeof window.v50FilterPromoCategory === 'function' && !window.v50FilterPromoCategory.__v59PromoGuarded) {
      const originalFilterPromo = window.v50FilterPromoCategory;
      const guardedFilterPromo = function () {
        if (!canPromo()) {
          window.__v50PromoCategoryActive = false;
          return denyPromo();
        }
        return originalFilterPromo.apply(this, arguments);
      };
      Object.defineProperty(guardedFilterPromo, '__v59PromoGuarded', { value: true });
      setGlobal('v50FilterPromoCategory', guardedFilterPromo);
    }

    wrapAfter('addToCart', () => sanitizeSaleState(true));
    wrapAfter('updateCartQty', () => sanitizeSaleState(true));
    wrapAfter('removeFromCart', () => sanitizeSaleState(true));
    wrapAfter('renderProductGrid', () => sanitizeSaleState(false));
    wrapAfter('renderCart', () => sanitizeSaleState(false));

    const originalGetTotal = window.getCartTotal;
    if (typeof originalGetTotal === 'function' && !originalGetTotal.__v59PromoGuarded) {
      const guardedGetTotal = function () {
        sanitizeSaleState(false);
        const subtotal = activeCart().reduce((sum, item) => sum + money(item.price) * money(item.qty), 0);
        const manualDiscount = canPromo() ? money(document.getElementById('pos-discount')?.value || 0) : 0;
        return Math.max(0, subtotal - manualDiscount);
      };
      Object.defineProperty(guardedGetTotal, '__v59PromoGuarded', { value: true });
      Object.defineProperty(guardedGetTotal, '__v50PromoPrice', { value: true });
      setGlobal('getCartTotal', guardedGetTotal);
    }

    ['startCheckout', 'v12NextStep', 'v12CompletePayment', 'completePayment'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__v59PromoGuarded) return;
      const guarded = function () {
        sanitizeSaleState(true);
        return original.apply(this, arguments);
      };
      Object.defineProperty(guarded, '__v59PromoGuarded', { value: true });
      setGlobal(name, guarded);
    });

    document.querySelectorAll('#pos-categories [data-cat="__promo__"], #v9promo-inv-btn').forEach(el => {
      if (!canPromo()) el.remove();
    });
    if (!canPromo()) {
      [0, 80, 250].forEach(delay => setTimeout(removePromoVisuals, delay));
    }

    const discountInput = document.getElementById('pos-discount');
    if (discountInput && discountInput.dataset.v59PromoBound !== '1') {
      discountInput.dataset.v59PromoBound = '1';
      discountInput.addEventListener('input', () => {
        if (!canPromo()) {
          resetManualDiscount();
          denyPromo();
        }
      }, true);
    }

    sanitizeSaleState(false);
  }

  function html(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function installCustomerModalStyle() {
    if (document.getElementById('v59-customer-modal-style')) return;
    const style = document.createElement('style');
    style.id = 'v59-customer-modal-style';
    style.textContent = `
      .modal-box:has(.v59-customer-form){max-width:min(760px,calc(100vw - 24px));padding:0;overflow:hidden;border-radius:22px}
      .modal-box:has(.v59-customer-form) .modal-header{display:none}
      .modal-box:has(.v59-customer-form) .modal-body{padding:0}
      .v59-customer-head{position:relative;display:flex;align-items:center;gap:14px;padding:22px 64px 22px 24px;background:linear-gradient(135deg,#0f766e,#2563eb);color:#fff}
      .v59-customer-icon{width:48px;height:48px;border-radius:16px;background:rgba(255,255,255,.16);display:grid;place-items:center;flex:0 0 auto}
      .v59-customer-title{margin:0;font-size:22px;font-weight:950;line-height:1.2}
      .v59-customer-sub{margin-top:4px;font-size:13px;font-weight:700;color:rgba(255,255,255,.78)}
      .v59-customer-x{position:absolute;right:18px;top:18px;width:38px;height:38px;border:0;border-radius:12px;background:rgba(255,255,255,.14);color:#fff;display:grid;place-items:center;cursor:pointer}
      .v59-customer-x:hover{background:rgba(255,255,255,.22)}
      .v59-customer-form{padding:22px 24px 24px;background:#fff}
      .v59-customer-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .v59-field{display:grid;gap:7px}
      .v59-field.full{grid-column:1/-1}
      .v59-field label{font-size:12px;font-weight:900;color:#475569;display:flex;align-items:center;gap:6px}
      .v59-field label .material-icons-round{font-size:16px;color:#2563eb}
      .v59-input{width:100%;min-height:46px;border:1px solid #dbe3ef;border-radius:12px;background:#f8fafc;padding:10px 12px;font:inherit;font-weight:700;color:#0f172a;outline:none;box-sizing:border-box}
      .v59-input:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 4px rgba(37,99,235,.1)}
      textarea.v59-input{min-height:82px;resize:vertical}
      .v59-customer-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;padding-top:18px;border-top:1px solid #eef2f7}
      .v59-customer-actions .btn{min-height:44px;border-radius:12px;font-weight:950}
      @media(max-width:640px){.v59-customer-head{padding:18px}.v59-customer-form{padding:18px}.v59-customer-grid{grid-template-columns:1fr}.v59-customer-actions{flex-direction:column-reverse}.v59-customer-actions .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function showCustomerModal(cData = null) {
    if (!canUseCustomerPage()) return false;
    installCustomerModalStyle();
    const editing = !!cData?.id;
    const title = editing ? 'แก้ไขลูกค้าประจำ' : 'เพิ่มลูกค้าประจำ';
    const subtitle = editing ? 'ปรับข้อมูลติดต่อ วงเงิน และรายละเอียดลูกค้า' : 'บันทึกข้อมูลลูกค้าเพื่อใช้งานขาย ค้างชำระ และติดตามประวัติ';
    window.openModal?.('', `
      <div class="v59-customer-head">
        <div class="v59-customer-icon"><i class="material-icons-round">person_add</i></div>
        <div>
          <h3 class="v59-customer-title">${title}</h3>
          <div class="v59-customer-sub">${subtitle}</div>
        </div>
        <button type="button" class="v59-customer-x" onclick="closeModal()" title="ปิด"><i class="material-icons-round">close</i></button>
      </div>
      <form id="customer-form" class="v59-customer-form">
        <div class="v59-customer-grid">
          <div class="v59-field">
            <label><i class="material-icons-round">badge</i>ชื่อ *</label>
            <input class="v59-input" type="text" id="cust-name" value="${html(cData?.name || '')}" required autocomplete="name">
          </div>
          <div class="v59-field">
            <label><i class="material-icons-round">call</i>เบอร์โทร</label>
            <input class="v59-input" type="tel" id="cust-phone" value="${html(cData?.phone || '')}" inputmode="tel" autocomplete="tel">
          </div>
          <div class="v59-field">
            <label><i class="material-icons-round">mail</i>อีเมล</label>
            <input class="v59-input" type="email" id="cust-email" value="${html(cData?.email || '')}" autocomplete="email">
          </div>
          <div class="v59-field">
            <label><i class="material-icons-round">chat</i>Line ID</label>
            <input class="v59-input" type="text" id="cust-line" value="${html(cData?.line_id || '')}">
          </div>
          <div class="v59-field">
            <label><i class="material-icons-round">cake</i>วันเกิด</label>
            <input class="v59-input" type="date" id="cust-birth" value="${html(cData?.birth_date || '')}">
          </div>
          <div class="v59-field">
            <label><i class="material-icons-round">account_balance_wallet</i>วงเงินเครดิต</label>
            <input class="v59-input" type="number" id="cust-credit" min="0" value="${html(cData?.credit_limit || 0)}">
          </div>
          <div class="v59-field full">
            <label><i class="material-icons-round">location_on</i>ที่อยู่</label>
            <textarea class="v59-input" id="cust-address">${html(cData?.address || '')}</textarea>
          </div>
        </div>
        <input type="hidden" id="cust-id" value="${html(cData?.id || '')}">
        <div class="v59-customer-actions">
          <button type="button" class="btn btn-outline" onclick="closeModal()"><i class="material-icons-round">close</i> ยกเลิก</button>
          <button type="submit" class="btn btn-primary"><i class="material-icons-round">save</i> บันทึก</button>
        </div>
      </form>`);

    const form = document.getElementById('customer-form');
    form.onsubmit = async (event) => {
      event.preventDefault();
      const id = document.getElementById('cust-id').value;
      const data = {
        name: document.getElementById('cust-name').value.trim(),
        phone: document.getElementById('cust-phone').value.trim(),
        email: document.getElementById('cust-email').value.trim(),
        line_id: document.getElementById('cust-line').value.trim(),
        address: document.getElementById('cust-address').value.trim(),
        birth_date: document.getElementById('cust-birth').value || null,
        credit_limit: Number(document.getElementById('cust-credit').value) || 0,
        updated_at: new Date().toISOString()
      };
      if (!data.name) {
        window.toast?.('กรุณากรอกชื่อลูกค้า', 'warning');
        return;
      }
      if (id) await db.from('customer').update(data).eq('id', id);
      else await db.from('customer').insert(data);
      window.toast?.('บันทึกลูกค้าสำเร็จ', 'success');
      window.closeModal?.();
      window.loadCustomerData?.();
    };
    setTimeout(() => document.getElementById('cust-name')?.focus(), 80);
  }

  function installCustomerModal() {
    if (window.showAddCustomerModal?.__v59CustomerUi) return;
    Object.defineProperty(showCustomerModal, '__v59CustomerUi', { value: true });
    setGlobal('showAddCustomerModal', showCustomerModal);
  }

  function boot() {
    installPromoGuards();
    installCustomerModal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  [300, 900, 1800, 3500, 7000, 12000, 30000, 47000].forEach(delay => setTimeout(boot, delay));
  console.log(TAG, 'loaded');
})();
