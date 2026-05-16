(function () {
  'use strict';

  const DUMMY_ID = '00000000-0000-0000-0000-000000000000';

  const num = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const fmt = v => {
    try { if (typeof formatNum === 'function') return formatNum(v); } catch (_) {}
    return num(v).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  };

  function setGlobal(name, value) {
    try { window[name] = value; } catch (_) {}
    try { Function('n', 'v', 'window[n]=v; try { eval(n + " = v"); } catch(e) {}')(name, value); } catch (_) {}
  }

  function getCart() {
    try { if (Array.isArray(cart)) return cart; } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }

  function setCart(next) {
    const rows = Array.isArray(next) ? next : [];
    setGlobal('cart', rows);
    try { window.renderCart?.(); } catch (_) {}
    try { window.renderProductGrid?.(); } catch (_) {}
    try { window.sendToDisplay?.({ type: 'cart', cart: rows, total: window.getCartTotal?.() || rows.reduce((s, it) => s + num(it.price) * num(it.qty), 0) }); } catch (_) {}
  }

  function productFromCache(id) {
    if (!id) return null;
    try {
      const p = (typeof products !== 'undefined' ? products : window.products || []).find(x => String(x.id) === String(id));
      if (p) return p;
    } catch (_) {}
    return null;
  }

  async function fetchProduct(id) {
    const cached = productFromCache(id);
    if (cached) return cached;
    try {
      const { data } = await db.from('สินค้า').select('*').eq('id', id).maybeSingle();
      return data || null;
    } catch (_) {
      return null;
    }
  }

  async function fetchConvRate(productId, unitName, baseUnit) {
    if (!productId || !unitName || unitName === baseUnit) return 1;
    try {
      const { data } = await db.from('product_units')
        .select('conv_rate,conversion_rate,rate,unit_name')
        .eq('product_id', productId)
        .eq('unit_name', unitName)
        .maybeSingle();
      return Math.max(0.000001, num(data?.conv_rate ?? data?.conversion_rate ?? data?.rate ?? 1) || 1);
    } catch (_) {
      return 1;
    }
  }

  async function buildCartItems(quoteId, items) {
    const rows = [];
    for (let i = 0; i < (items || []).length; i++) {
      const it = items[i] || {};
      const pid = it.product_id && String(it.product_id) !== DUMMY_ID ? it.product_id : null;
      const qty = Math.max(0, num(it.qty));
      if (!qty) continue;

      if (!pid) {
        rows.push({
          id: `extra-quote-${quoteId}-${i}`,
          product_id: null,
          name: it.name || 'รายการนอกระบบ',
          qty,
          price: num(it.price),
          original_price: num(it.price),
          cost: 0,
          stock: 999999,
          unit: it.unit || 'รายการ',
          unit_name: it.unit || 'รายการ',
          conv_rate: 1,
          is_extra_charge: true,
          is_quote_custom: true,
          product_type: 'ตามบิล',
        });
        continue;
      }

      const prod = await fetchProduct(pid);
      const baseUnit = prod?.unit || it.unit || 'ชิ้น';
      const sellUnit = it.unit || baseUnit;
      const conv = await fetchConvRate(pid, sellUnit, baseUnit);
      rows.push({
        ...(prod || {}),
        id: pid,
        product_id: pid,
        name: it.name || prod?.name || 'สินค้า',
        qty,
        price: num(it.price),
        original_price: num(it.price),
        cost: num(prod?.cost || it.cost || 0),
        stock: num(prod?.stock ?? 999999),
        unit: sellUnit,
        unit_name: sellUnit,
        conv_rate: conv,
      });
    }
    return rows;
  }

  async function resolveCustomer(quote) {
    const name = String(quote?.customer_name || '').trim() || 'ลูกค้าทั่วไป';
    if (!name || name === 'ลูกค้าทั่วไป') return { type: 'general', id: null, name: 'ลูกค้าทั่วไป' };
    try {
      const { data } = await db.from('customer')
        .select('id,name,phone,address,debt_amount,customer_type')
        .eq('name', name)
        .maybeSingle();
      if (data?.id) {
        return {
          type: 'member',
          id: data.id,
          name: data.name || name,
          phone: data.phone || '',
          address: data.address || '',
          debt_amount: num(data.debt_amount),
          customer_type: data.customer_type || '',
        };
      }
    } catch (_) {}
    return { type: 'member', id: null, name };
  }

  function patchCheckoutCustomer(customer, quote) {
    const applyToState = state => {
      if (!state) return;
      state.customer = { ...(state.customer || {}), ...customer };
      state.step = Math.max(num(state.step) || 1, 2);
      state.deliveryMode = state.deliveryMode || 'self';
      state.deliveryAddress = state.deliveryAddress || customer.address || '';
      state.deliveryPhone = state.deliveryPhone || customer.phone || '';
      state.paymentType = state.paymentType || 'full';
      state.method = state.method || 'cash';
      state.__quote_id = quote.id;
      if (state.itemModes && Array.isArray(getCart())) {
        getCart().forEach(item => {
          if (!state.itemModes[item.id]) state.itemModes[item.id] = { take: item.qty, deliver: 0 };
        });
      }
    };

    try { applyToState(v12State); } catch (_) { applyToState(window.v12State); }
    try { applyToState(checkoutState); } catch (_) { applyToState(window.checkoutState); }

    try { if (typeof v12RenderShell === 'function') v12RenderShell(); } catch (_) {}
    try { if (typeof v12RenderStepBody === 'function') v12RenderStepBody(); } catch (_) {}
    try { if (typeof v12UpdateStepBar === 'function') v12UpdateStepBar(); } catch (_) {}
    try { if (typeof renderCheckout === 'function') renderCheckout(); } catch (_) {}
    try { if (typeof renderCheckoutStep === 'function') renderCheckoutStep(); } catch (_) {}
  }

  function setDiscount(value) {
    const input = document.getElementById('pos-discount');
    if (input) {
      input.value = String(num(value));
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    }
  }

  function savedCheckoutBill() {
    try { if (v12State?.savedBill?.id) return v12State.savedBill; } catch (_) {}
    try { if (window.v12State?.savedBill?.id) return window.v12State.savedBill; } catch (_) {}
    try { if (checkoutState?.savedBill?.id) return checkoutState.savedBill; } catch (_) {}
    try { if (window.checkoutState?.savedBill?.id) return window.checkoutState.savedBill; } catch (_) {}
    return null;
  }

  async function findCreatedBill(ctx, paymentResult) {
    if (paymentResult?.id) return paymentResult;
    const saved = savedCheckoutBill();
    if (saved?.id) return saved;

    const total = num(ctx.total);
    const startedAt = ctx.startedAt || new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const pickMatch = rows => (rows || []).find(b => Math.abs(num(b.total) - total) < 0.01) || rows?.[0] || null;

    try {
      const { data } = await db.from('บิลขาย')
        .select('id,bill_no,total,date,customer_name')
        .gte('date', startedAt)
        .eq('customer_name', ctx.customerName)
        .order('date', { ascending: false })
        .limit(5);
      const found = pickMatch(data);
      if (found) return found;
    } catch (_) {}

    try {
      const { data } = await db.from('บิลขาย')
        .select('id,bill_no,total,date,customer_name')
        .gte('date', startedAt)
        .order('date', { ascending: false })
        .limit(10);
      return pickMatch(data);
    } catch (_) {
      return null;
    }
  }

  async function markQuoteConverted(paymentResult) {
    const ctx = window._v75PendingQuoteCheckout;
    if (!ctx?.quoteId || window._v75QuoteMarking) return;
    window._v75QuoteMarking = true;
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const bill = await findCreatedBill(ctx, paymentResult);
      if (!bill?.id) return;
      await db.from('ใบเสนอราคา').update({
        status: 'อนุมัติ',
        converted_bill_id: bill.id,
        updated_at: new Date().toISOString(),
      }).eq('id', ctx.quoteId);
      delete window._v75PendingQuoteCheckout;
      try { window.loadQuotationPage?.(); } catch (_) {}
      try { toast?.(`สร้างบิล #${bill.bill_no || ''} จากใบเสนอราคาแล้ว`, 'success'); } catch (_) {}
    } catch (e) {
      console.warn('[v75 quotation checkout bridge] mark converted:', e);
    } finally {
      window._v75QuoteMarking = false;
    }
  }

  function wrapPaymentFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v75QuoteBridge) return;
    const wrapped = async function (...args) {
      const hadQuote = !!window._v75PendingQuoteCheckout;
      window._v75QuotePaymentInProgress = hadQuote;
      try {
        const out = await original.apply(this, args);
        if (hadQuote && out !== false) await markQuoteConverted(out);
        return out;
      } finally {
        window._v75QuotePaymentInProgress = false;
      }
    };
    Object.defineProperty(wrapped, '__v75QuoteBridge', { value: true });
    setGlobal(name, wrapped);
  }

  function wrapCloseCheckout() {
    const original = window.closeCheckout;
    if (typeof original !== 'function' || original.__v75QuoteCloseBridge) return;
    const wrapped = function (...args) {
      const out = original.apply(this, args);
      if (window._v75PendingQuoteCheckout && !window._v75QuotePaymentInProgress && !window._v75QuoteMarking) {
        delete window._v75PendingQuoteCheckout;
      }
      return out;
    };
    Object.defineProperty(wrapped, '__v75QuoteCloseBridge', { value: true });
    setGlobal('closeCheckout', wrapped);
  }

  function installHooks() {
    ['v12CompletePayment', 'v13CompletePayment', 'v15CompletePayment', 'v16CompletePayment', 'v17CompletePayment', 'v18CompletePayment', 'completePayment', 'v9Sale'].forEach(wrapPaymentFunction);
    wrapCloseCheckout();
  }

  window.v9ConvertQuotation = async function (quotId) {
    try {
      installHooks();

      const current = getCart();
      if (current.length && typeof Swal !== 'undefined') {
        const ask = await Swal.fire({
          icon: 'question',
          title: 'โหลดใบเสนอราคาเข้าหน้าคิดเงิน?',
          text: 'รายการในตะกร้าปัจจุบันจะถูกแทนที่ เพื่อให้ใช้ระบบคิดเงินเดิมเหมือนกด F10',
          showCancelButton: true,
          confirmButtonText: 'โหลดเข้าคิดเงิน',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#16a34a',
        });
        if (!ask.isConfirmed) return;
      }

      const [{ data: quote, error: qe }, { data: items, error: ie }] = await Promise.all([
        db.from('ใบเสนอราคา').select('*').eq('id', quotId).maybeSingle(),
        db.from('รายการใบเสนอราคา').select('*').eq('quotation_id', quotId),
      ]);
      if (qe) throw qe;
      if (ie) throw ie;
      if (!quote) throw new Error('ไม่พบใบเสนอราคา');
      if (quote.status && quote.status !== 'รออนุมัติ') throw new Error('ใบเสนอราคานี้ไม่อยู่ในสถานะรออนุมัติ');

      const quoteCart = await buildCartItems(quotId, items || []);
      if (!quoteCart.length) throw new Error('ใบเสนอราคานี้ยังไม่มีรายการสินค้า');

      const customer = await resolveCustomer(quote);
      setDiscount(quote.discount || 0);
      setCart(quoteCart);

      window._v75PendingQuoteCheckout = {
        quoteId: quote.id,
        customerName: customer.name || quote.customer_name || '',
        total: Math.max(0, quoteCart.reduce((s, item) => s + num(item.price) * num(item.qty), 0) - num(quote.discount)),
        startedAt: new Date(Date.now() - 5000).toISOString(),
      };

      try { if (typeof go === 'function') go('pos'); } catch (_) {}
      setTimeout(() => {
        try {
          if (typeof startCheckout === 'function') startCheckout();
          patchCheckoutCustomer(customer, quote);
          toast?.('โหลดใบเสนอราคาเข้าหน้าคิดเงินเดิมแล้ว', 'success');
        } catch (e) {
          console.error('[v75 quotation checkout bridge] open checkout:', e);
          toast?.('เปิดหน้าคิดเงินไม่สำเร็จ: ' + (e.message || e), 'error');
        }
      }, 80);
    } catch (e) {
      console.error('[v75 quotation checkout bridge]', e);
      toast?.(e.message || 'แปลงใบเสนอราคาไม่สำเร็จ', 'error');
      if (typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'error', title: 'เปิดหน้าคิดเงินไม่สำเร็จ', text: e.message || String(e), confirmButtonColor: '#dc2626' });
      }
    }
  };

  installHooks();
  console.log('[v75] quotation uses existing checkout flow');
})();
