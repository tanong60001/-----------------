(function () {
  'use strict';

  function injectCheckoutPolish() {
    document.getElementById('v43-checkout-polish-style')?.remove();
    const style = document.createElement('style');
    style.id = 'v43-checkout-polish-style';
    style.textContent = `
      #checkout-overlay.checkout-overlay{
        background:linear-gradient(135deg,rgba(14,116,144,.28),rgba(15,23,42,.34),rgba(217,119,6,.18))!important;
        backdrop-filter:blur(12px)!important;
        padding:16px!important;
      }
      #checkout-overlay .checkout-modal.v36-checkout-modal{
        width:min(1180px,96vw)!important;
        height:min(780px,94vh)!important;
        border-radius:20px!important;
        border:1px solid rgba(148,163,184,.35)!important;
        background:#f8fafc!important;
        box-shadow:0 30px 90px rgba(15,23,42,.28)!important;
        grid-template-columns:330px minmax(0,1fr)!important;
        grid-template-rows:78px minmax(0,1fr) auto!important;
      }
      #checkout-overlay .checkout-modal.v36-checkout-modal::before{
        content:'รายการในตะกร้า'!important;
        background:linear-gradient(180deg,#e0f2fe,#f0fdf4)!important;
        color:#0f172a!important;
        border-right:1px solid #dbeafe!important;
        padding:0 24px!important;
        font-size:17px!important;
        letter-spacing:0!important;
      }
      #checkout-overlay .checkout-modal.v36-checkout-modal .v36-checkout-summary{
        background:linear-gradient(180deg,#e0f2fe 0%,#f0fdf4 54%,#fff 100%)!important;
        border-right:1px solid #dbeafe!important;
        padding:90px 18px 20px!important;
      }
      #checkout-overlay .v36-checkout-items{gap:9px!important}
      #checkout-overlay .v36-checkout-item{
        border:1px solid #dbeafe!important;
        border-radius:13px!important;
        padding:10px!important;
        box-shadow:0 10px 24px rgba(14,116,144,.06)!important;
      }
      #checkout-overlay .v36-checkout-ico{
        width:36px!important;
        height:36px!important;
        border-radius:11px!important;
        background:#cffafe!important;
        color:#0e7490!important;
      }
      #checkout-overlay .v36-checkout-name{font-size:13px!important;line-height:1.3!important}
      #checkout-overlay .v36-checkout-meta{font-size:11px!important}
      #checkout-overlay .v36-checkout-price{font-size:14px!important}
      #checkout-overlay .v36-checkout-total{padding-top:16px!important}
      #checkout-overlay .v36-checkout-total strong{
        font-size:34px!important;
        color:#0f766e!important;
      }
      #checkout-overlay .checkout-progress{
        height:78px!important;
        background:#fff!important;
        border-bottom:1px solid #e2e8f0!important;
        gap:12px!important;
        padding:0 28px 0 142px!important;
      }
      #checkout-overlay .checkout-progress::before{
        content:'Checkout'!important;
        left:24px!important;
        top:18px!important;
        font-size:18px!important;
        color:#0f172a!important;
      }
      #checkout-overlay .checkout-progress::after{
        left:24px!important;
        top:44px!important;
        font-size:11px!important;
        color:#64748b!important;
      }
      #checkout-overlay .progress-step{
        padding:7px 10px!important;
        gap:8px!important;
        background:transparent!important;
      }
      #checkout-overlay .progress-step:not(:last-child)::after{display:none!important}
      #checkout-overlay .step-num{
        width:30px!important;
        height:30px!important;
        background:#eef6ff!important;
        border-color:#bfdbfe!important;
        color:#64748b!important;
        font-size:12px!important;
      }
      #checkout-overlay .progress-step span{
        font-size:12px!important;
        color:#64748b!important;
      }
      #checkout-overlay .progress-step.active{
        background:#ecfdf5!important;
        box-shadow:0 0 0 1px #bbf7d0 inset!important;
      }
      #checkout-overlay .progress-step.active .step-num,
      #checkout-overlay .progress-step.completed .step-num{
        background:#10b981!important;
        border-color:#10b981!important;
        color:#fff!important;
        box-shadow:none!important;
      }
      #checkout-overlay .progress-step.active span{color:#047857!important}
      #checkout-overlay .checkout-content{
        background:
          radial-gradient(circle at 8% 12%,rgba(45,212,191,.12),transparent 28%),
          radial-gradient(circle at 92% 10%,rgba(251,191,36,.13),transparent 26%),
          linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)!important;
        padding:24px 32px!important;
      }
      #checkout-overlay .v36-step-title,
      #checkout-overlay .v12-step-title{
        font-size:24px!important;
        line-height:1.2!important;
        margin-top:4px!important;
        color:#0f172a!important;
        letter-spacing:0!important;
      }
      #checkout-overlay .v36-step-note,
      #checkout-overlay .v12-step-subtitle{
        font-size:12px!important;
        margin-bottom:16px!important;
        color:#64748b!important;
      }
      #checkout-overlay .v36-option-grid,
      #checkout-overlay .v36-v12-customer-grid{
        gap:10px!important;
        max-width:1040px!important;
      }
      #checkout-overlay .customer-type-btn,
      #checkout-overlay .payment-method-btn,
      #checkout-overlay .v12-cust-card,
      #checkout-overlay .v14-proj-cust-card,
      #checkout-overlay .v12-delivery-card,
      #checkout-overlay .v12-pay-type-card,
      #checkout-overlay .v12-method-card{
        min-height:112px!important;
        border-radius:16px!important;
        padding:14px!important;
        background:#fff!important;
        border:1.5px solid #dbeafe!important;
        box-shadow:0 12px 28px rgba(15,23,42,.045)!important;
      }
      #checkout-overlay .customer-type-btn:nth-child(1),
      #checkout-overlay .v12-cust-card:nth-child(1){background:linear-gradient(180deg,#f0fdfa,#fff)!important}
      #checkout-overlay .customer-type-btn:nth-child(2),
      #checkout-overlay .v12-cust-card:nth-child(2){background:linear-gradient(180deg,#fff7ed,#fff)!important}
      #checkout-overlay .customer-type-btn:nth-child(3),
      #checkout-overlay .v12-cust-card:nth-child(3){background:linear-gradient(180deg,#eff6ff,#fff)!important}
      #checkout-overlay .customer-type-btn:nth-child(4),
      #checkout-overlay .v12-cust-card:nth-child(4){background:linear-gradient(180deg,#fdf2f8,#fff)!important}
      #checkout-overlay .customer-type-btn:hover,
      #checkout-overlay .payment-method-btn:hover,
      #checkout-overlay .v12-cust-card:hover,
      #checkout-overlay .v14-proj-cust-card:hover{
        border-color:#67e8f9!important;
        box-shadow:0 16px 32px rgba(14,116,144,.10)!important;
      }
      #checkout-overlay .customer-type-btn.selected,
      #checkout-overlay .payment-method-btn.selected,
      #checkout-overlay .v12-cust-card.selected,
      #checkout-overlay .v14-proj-cust-card.selected,
      #checkout-overlay .v12-delivery-card.selected,
      #checkout-overlay .v12-pay-type-card.selected,
      #checkout-overlay .v12-method-card.selected{
        background:linear-gradient(180deg,#ecfdf5,#f0fdfa)!important;
        border-color:#10b981!important;
        box-shadow:0 0 0 3px #d1fae5,0 16px 32px rgba(16,185,129,.10)!important;
      }
      #checkout-overlay .customer-type-icon,
      #checkout-overlay .payment-method-btn i,
      #checkout-overlay .v12-cust-card i,
      #checkout-overlay .v14-proj-cust-card i,
      #checkout-overlay .v12-delivery-card i{
        width:44px!important;
        height:44px!important;
        border-radius:14px!important;
        background:#e0f2fe!important;
        color:#0e7490!important;
        font-size:22px!important;
        margin-bottom:6px!important;
      }
      #checkout-overlay .customer-type-btn:nth-child(1) .customer-type-icon,
      #checkout-overlay .v12-cust-card:nth-child(1) i{background:#ccfbf1!important;color:#0f766e!important}
      #checkout-overlay .customer-type-btn:nth-child(2) .customer-type-icon,
      #checkout-overlay .v12-cust-card:nth-child(2) i{background:#ffedd5!important;color:#c2410c!important}
      #checkout-overlay .customer-type-btn:nth-child(3) .customer-type-icon,
      #checkout-overlay .v12-cust-card:nth-child(3) i{background:#dbeafe!important;color:#1d4ed8!important}
      #checkout-overlay .customer-type-btn:nth-child(4) .customer-type-icon,
      #checkout-overlay .v12-cust-card:nth-child(4) i{background:#fce7f3!important;color:#be185d!important}
      #checkout-overlay .customer-type-btn.selected .customer-type-icon,
      #checkout-overlay .payment-method-btn.selected i,
      #checkout-overlay .v12-cust-card.selected i,
      #checkout-overlay .v14-proj-cust-card.selected i,
      #checkout-overlay .v12-delivery-card.selected i{
        background:#10b981!important;
        color:#fff!important;
      }
      #checkout-overlay .customer-type-info h4,
      #checkout-overlay .payment-method-btn span,
      #checkout-overlay .v12-cust-card h4,
      #checkout-overlay .v14-proj-cust-card h4,
      #checkout-overlay .v12-delivery-card h4{
        font-size:15px!important;
        line-height:1.25!important;
        color:#0f172a!important;
        margin-top:2px!important;
      }
      #checkout-overlay .customer-type-info p,
      #checkout-overlay .v12-cust-card p,
      #checkout-overlay .v14-proj-cust-card p,
      #checkout-overlay .v12-delivery-card p{
        font-size:11px!important;
        color:#94a3b8!important;
      }
      #checkout-overlay input[type="text"],
      #checkout-overlay input[type="search"],
      #checkout-overlay input[type="number"],
      #checkout-overlay textarea,
      #checkout-overlay select{
        border-radius:12px!important;
        border:1.5px solid #cbd5e1!important;
        font-size:14px!important;
        box-shadow:0 8px 20px rgba(15,23,42,.03)!important;
      }
      #checkout-overlay input:focus,
      #checkout-overlay textarea:focus,
      #checkout-overlay select:focus{
        outline:none!important;
        border-color:#06b6d4!important;
        box-shadow:0 0 0 3px #cffafe!important;
      }
      #checkout-overlay .amount-display,
      #checkout-overlay .cash-total-needed,
      #checkout-overlay .cash-received-total,
      #checkout-overlay .cash-diff,
      #checkout-overlay .v36-mixed-pay-box,
      #checkout-overlay .v36-delivery-form,
      #checkout-overlay .v36-partial-panel{
        border-radius:16px!important;
        border:1px solid #dbeafe!important;
        box-shadow:0 14px 30px rgba(14,116,144,.06)!important;
      }
      #checkout-overlay .amount-value{font-size:36px!important;color:#0f766e!important}
      #checkout-overlay .denom-card,
      #checkout-overlay .v36-mixed-denom{
        min-height:96px!important;
        border-radius:14px!important;
        border-color:#dbeafe!important;
      }
      #checkout-overlay .checkout-footer{
        background:#fff!important;
        border-top:1px solid #e2e8f0!important;
        padding:16px 28px!important;
      }
      #checkout-overlay .checkout-footer .btn{
        height:46px!important;
        border-radius:12px!important;
        font-size:14px!important;
      }
      #checkout-overlay #checkout-cancel,
      #checkout-overlay #checkout-back{
        border:1px solid #cbd5e1!important;
        background:#fff!important;
        color:#64748b!important;
      }
      #checkout-overlay #checkout-next{
        min-width:220px!important;
        background:linear-gradient(135deg,#0f766e,#0891b2)!important;
        border-color:#0f766e!important;
        color:#fff!important;
        box-shadow:0 14px 30px rgba(8,145,178,.22)!important;
      }
      @media(max-width:980px){
        #checkout-overlay .checkout-modal.v36-checkout-modal{grid-template-columns:1fr!important;height:94vh!important}
        #checkout-overlay .checkout-modal.v36-checkout-modal::before,
        #checkout-overlay .v36-checkout-summary{display:none!important}
        #checkout-overlay .checkout-progress{grid-column:1!important;padding:48px 14px 10px!important;height:auto!important;justify-content:flex-start!important;overflow:auto!important}
        #checkout-overlay .checkout-content{grid-column:1!important;padding:20px!important}
        #checkout-overlay .checkout-footer{grid-column:1!important;padding:14px!important}
        #checkout-overlay #checkout-next{min-width:150px!important}
        #checkout-overlay .v36-step-title,#checkout-overlay .v12-step-title{font-size:24px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function applyAfterCheckoutPaint() {
    injectCheckoutPolish();
    setTimeout(injectCheckoutPolish, 60);
    setTimeout(injectCheckoutPolish, 180);
    setTimeout(injectCheckoutPolish, 420);
  }

  function installCheckoutHooks() {
    if (window.__v43CheckoutHooksInstalled) return;
    window.__v43CheckoutHooksInstalled = true;

    const originalStartCheckout = window.startCheckout;
    if (typeof originalStartCheckout === 'function') {
      window.startCheckout = function (...args) {
        const result = originalStartCheckout.apply(this, args);
        applyAfterCheckoutPaint();
        return result;
      };
    }

    const overlay = document.getElementById('checkout-overlay');
    if (overlay && window.MutationObserver) {
      new MutationObserver(applyAfterCheckoutPaint).observe(overlay, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['class', 'style']
      });
    }

    document.addEventListener('click', event => {
      const target = event.target?.closest?.('[onclick],button,.btn');
      if (!target) return;
      const text = `${target.getAttribute('onclick') || ''} ${target.textContent || ''}`;
      if (/checkout|ชำระ|ถัดไป|ย้อนกลับ/i.test(text)) applyAfterCheckoutPaint();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyAfterCheckoutPaint();
      installCheckoutHooks();
    });
  } else {
    applyAfterCheckoutPaint();
    installCheckoutHooks();
  }
})();
