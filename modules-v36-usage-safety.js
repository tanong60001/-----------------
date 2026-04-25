'use strict';
console.log('[v36] Usage safety patch loaded');

(function () {
  const money = n => Number(n || 0);
  const fmt = n => typeof formatNum === 'function'
    ? formatNum(n)
    : money(n).toLocaleString('th-TH');

  const txt = {
    product: 'สินค้า',
    bill: 'บิลขาย',
    billItem: 'รายการในบิล',
    sale: 'ขาย',
    cash: 'เงินสด',
    transfer: 'โอนเงิน',
    credit: 'บัตรเครดิต',
    debt: 'ค้างชำระ',
    success: 'สำเร็จ',
    pendingDelivery: 'รอจัดส่ง',
    delivered: 'จัดส่งสำเร็จ',
    deliveryMove: 'จัดส่ง',
  };

  function userName() {
    try { return USER?.username || 'system'; } catch (_) { return 'system'; }
  }

  async function queryOne(table, select, filters) {
    let q = db.from(table).select(select);
    (filters || []).forEach(f => { q = q.eq(f[0], f[1]); });
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function openSession() {
    const { data, error } = await db.from('cash_session')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function must(res, label) {
    const out = await res;
    if (out && out.error) {
      throw new Error((label ? label + ': ' : '') + out.error.message);
    }
    return out;
  }

  function activeCart() {
    try {
      if (Array.isArray(cart)) return cart;
    } catch (_) {}
    return Array.isArray(window.cart) ? window.cart : [];
  }

  function setCartEmpty() {
    try { cart = []; } catch (_) {}
    try { window.cart = []; } catch (_) {}
  }

  function paymentMethodName(method) {
    return ({ cash: txt.cash, transfer: txt.transfer, credit: txt.credit, debt: txt.debt })[method] || txt.cash;
  }

  function htmlAttr(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function jsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
  }

  async function refreshAfterSale() {
    try { if (typeof loadProducts === 'function') await loadProducts(); } catch (e) { console.warn('[v36] loadProducts:', e); }
    try {
      if (typeof products !== 'undefined') window._v9ProductsCache = products;
    } catch (_) {}
    try { if (typeof renderCart === 'function') renderCart(); } catch (_) {}
    try { if (typeof renderProductGrid === 'function') renderProductGrid(); } catch (_) {}
    try { if (typeof updateHomeStats === 'function') updateHomeStats(); } catch (_) {}
    try { if (typeof loadCashBalance === 'function') await loadCashBalance(); } catch (_) {}
    try {
      if (typeof renderCashDrawer === 'function') {
        const onCash = !document.getElementById('page-cash')?.classList.contains('hidden');
        if (onCash) await renderCashDrawer();
      }
    } catch (_) {}
  }

  async function assertCashReady(method) {
    if (method !== 'cash') return null;
    const session = await openSession();
    if (!session) {
      if (typeof Swal !== 'undefined') {
        await Swal.fire({
          icon: 'warning',
          title: 'ยังไม่ได้เปิดลิ้นชัก',
          text: 'กรุณาเปิดรอบลิ้นชักก่อนรับชำระด้วยเงินสด เพื่อให้ยอดเงินสดเชื่อมครบทุกจุด',
          confirmButtonText: 'ตกลง',
        });
      } else if (typeof toast === 'function') {
        toast('กรุณาเปิดลิ้นชักก่อนรับเงินสด', 'warning');
      }
      throw new Error('ยังไม่ได้เปิดลิ้นชักเงินสด');
    }
    return session;
  }

  async function buildSaleRows(bill, cartSnapshot) {
    const { data: productRows, error } = await db.from(txt.product)
      .select('id,name,stock,product_type,unit,cost');
    if (error) throw error;

    const stockMap = {};
    (productRows || []).forEach(p => { stockMap[p.id] = p; });

    const billItems = [];
    const movements = [];
    const now = new Date().toISOString();
    const stockUpdateMap = new Map();
    const queueStockUpdate = (productId, stockAfter) => {
      stockUpdateMap.set(productId, { stock: stockAfter, updated_at: now });
    };

    for (const item of cartSnapshot) {
      const fresh = stockMap[item.id];
      if (!fresh) throw new Error('ไม่พบสินค้าในคลัง: ' + (item.name || item.id));

      const convRate = Number(item.conv_rate || 1);
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const baseQty = Number((qty * convRate).toFixed(6));
      const sellUnit = item.unit || fresh.unit || 'ชิ้น';
      const isMto = !!(item.is_mto || fresh.product_type === 'ตามบิล');
      const costPerBase = Number(fresh.cost || item.cost || 0);

      if (!qty || qty <= 0) throw new Error('จำนวนสินค้าไม่ถูกต้อง: ' + (item.name || fresh.name));
      if (price < 0) throw new Error('ราคาสินค้าติดลบ: ' + (item.name || fresh.name));

      billItems.push({
        bill_id: bill.id,
        product_id: item.id,
        name: item.name || fresh.name,
        qty,
        price,
        cost: Number((costPerBase * convRate).toFixed(6)),
        total: Number((price * qty).toFixed(2)),
        unit: sellUnit,
      });

      if (isMto) {
        const { data: recipes, error: recipeError } = await db.from('สูตรสินค้า')
          .select('*')
          .eq('product_id', item.id);
        if (recipeError) throw recipeError;

        for (const recipe of (recipes || [])) {
          const mat = stockMap[recipe.material_id];
          if (!mat) throw new Error('ไม่พบวัตถุดิบของสูตร: ' + (recipe.material_id || 'unknown'));
          const needed = Number((Number(recipe.quantity || 0) * qty).toFixed(6));
          const matBefore = Number(mat.stock || 0);
          if (matBefore < needed) {
            throw new Error(`วัตถุดิบไม่พอ: ${mat.name || recipe.material_id} มี ${fmt(matBefore)} ต้องใช้ ${fmt(needed)}`);
          }
          const matAfter = Number((matBefore - needed).toFixed(6));
          mat.stock = matAfter;
          queueStockUpdate(recipe.material_id, matAfter);
          movements.push({
            product_id: recipe.material_id,
            product_name: mat.name || recipe.material_id,
            type: 'ใช้ผลิต(ขาย)',
            direction: 'out',
            qty: needed,
            stock_before: matBefore,
            stock_after: matAfter,
            ref_id: bill.id,
            ref_table: txt.bill,
            staff_name: userName(),
            note: `บิล #${bill.bill_no || bill.id}: ${item.name || fresh.name} x ${qty} ${sellUnit}`,
          });
        }
        continue;
      }

      const before = Number(fresh.stock || 0);
      if (before < baseQty) {
        throw new Error(`สต็อกไม่พอ: ${item.name || fresh.name} มี ${fmt(before)} ต้องใช้ ${fmt(baseQty)}`);
      }

      const after = Number((before - baseQty).toFixed(6));
      fresh.stock = after;
      queueStockUpdate(item.id, after);
      movements.push({
        product_id: item.id,
        product_name: item.name || fresh.name,
        type: txt.sale,
        direction: 'out',
        qty: baseQty,
        stock_before: before,
        stock_after: after,
        ref_id: bill.id,
        ref_table: txt.bill,
        staff_name: userName(),
        note: convRate !== 1 ? `ขาย ${qty} ${sellUnit} (${baseQty} ${fresh.unit || ''})` : null,
      });
    }

    const stockUpdates = Array.from(stockUpdateMap.entries()).map(([productId, data]) =>
      db.from(txt.product).update(data).eq('id', productId)
    );

    return { billItems, movements, stockUpdates };
  }

  async function runSafeSale() {
    if (window.__posPaymentLock) return;
    window.__posPaymentLock = true;
    window.isProcessingPayment = true;

    let bill = null;
    try {
      if (!window.checkoutState) throw new Error('ไม่พบข้อมูลชำระเงิน');
      const cartSnapshot = activeCart().map(item => ({ ...item }));
      if (!cartSnapshot.length) throw new Error('ไม่มีสินค้าในตะกร้า');
      if (!money(checkoutState.total) || money(checkoutState.total) <= 0) throw new Error('ยอดขายไม่ถูกต้อง');

      const session = await assertCashReady(checkoutState.method);
      if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังบันทึกบิล...', 'ระบบกำลังตรวจสอบข้อมูลและตัดสต็อก');

      if (checkoutState.customer?.id) {
        try {
          const { data: custPre } = await db.from('customer')
            .select('address,phone')
            .eq('id', checkoutState.customer.id)
            .maybeSingle();
          if (custPre) {
            checkoutState.customer.address = custPre.address || '';
            checkoutState.customer.phone = custPre.phone || '';
          }
        } catch (_) {}
      }

      const billRes = await must(db.from(txt.bill).insert({
        date: new Date().toISOString(),
        method: paymentMethodName(checkoutState.method),
        total: money(checkoutState.total),
        discount: money(checkoutState.discount),
        received: money(checkoutState.received),
        change: money(checkoutState.change),
        customer_name: checkoutState.customer?.name || null,
        customer_id: checkoutState.customer?.id || null,
        customer_address: checkoutState.customer?.address || null,
        customer_phone: checkoutState.customer?.phone || null,
        staff_name: typeof v9Staff === 'function' ? v9Staff() : userName(),
        status: checkoutState.method === 'debt' ? txt.debt : txt.success,
      }).select().single(), 'บันทึกบิล');
      bill = billRes.data;

      const { billItems, movements, stockUpdates } = await buildSaleRows(bill, cartSnapshot);
      if (billItems.length) await must(db.from(txt.billItem).insert(billItems), 'บันทึกรายการในบิล');
      if (movements.length) await must(db.from('stock_movement').insert(movements), 'บันทึกประวัติสต็อก');

      const stockResults = await Promise.all(stockUpdates);
      stockResults.forEach((res, i) => {
        if (res?.error) throw new Error('ตัดสต็อกไม่สำเร็จรายการที่ ' + (i + 1) + ': ' + res.error.message);
      });

      if (checkoutState.method === 'cash') {
        let changeDenoms = checkoutState.changeDenominations || {};
        if (!Object.values(changeDenoms || {}).some(v => Number(v) > 0) && money(checkoutState.change) > 0 && typeof calcChangeDenominations === 'function') {
          changeDenoms = calcChangeDenominations(money(checkoutState.change));
        }
        if (typeof window.recordCashTx !== 'function') throw new Error('ไม่พบระบบบันทึกเงินสดเข้าลิ้นชัก');
        await window.recordCashTx({
          sessionId: session.id,
          type: txt.sale,
          direction: 'in',
          amount: money(checkoutState.received),
          changeAmt: money(checkoutState.change),
          netAmount: money(checkoutState.total),
          refId: bill.id,
          refTable: txt.bill,
          denominations: checkoutState.receivedDenominations || {},
          changeDenominations: changeDenoms || {},
        });
      }

      if (checkoutState.customer?.id) {
        const { data: cust } = await db.from('customer')
          .select('total_purchase,visit_count,debt_amount')
          .eq('id', checkoutState.customer.id)
          .maybeSingle();
        await must(db.from('customer').update({
          total_purchase: money(cust?.total_purchase) + money(checkoutState.total),
          visit_count: money(cust?.visit_count) + 1,
          debt_amount: checkoutState.method === 'debt'
            ? money(cust?.debt_amount) + money(checkoutState.total)
            : money(cust?.debt_amount),
        }).eq('id', checkoutState.customer.id), 'อัปเดตลูกค้า');
      }

      if (typeof logActivity === 'function') {
        await Promise.resolve(logActivity(txt.sale, `บิล #${bill.bill_no || bill.id} ฿${fmt(checkoutState.total)}`, bill.id, txt.bill));
      }

      if (typeof sendToDisplay === 'function') {
        sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: checkoutState.total });
      }

      setCartEmpty();
      if (typeof closeCheckout === 'function') closeCheckout();
      await refreshAfterSale();
      if (typeof v9HideOverlay === 'function') v9HideOverlay();

      const result = typeof Swal !== 'undefined'
        ? await Swal.fire({
            icon: 'success',
            title: `บิล #${bill.bill_no || ''} สำเร็จ`,
            html: `<div style="font-size:15px">ยอดขาย <b>฿${fmt(bill.total)}</b></div>`,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'พิมพ์ 80mm',
            denyButtonText: 'พิมพ์ A4',
            cancelButtonText: 'ไม่พิมพ์',
            confirmButtonColor: '#dc2626',
            denyButtonColor: '#2563eb',
          })
        : {};

      const printFmt = result.isConfirmed ? '80mm' : (result.isDenied ? 'A4' : null);
      if (printFmt && typeof printReceipt === 'function') printReceipt(bill, billItems, printFmt);
      return bill;
    } catch (e) {
      if (typeof v9HideOverlay === 'function') v9HideOverlay();
      console.error('[v36] sale failed:', e);
      if (bill?.id) {
        try {
          await db.from(txt.bill).update({
            status: 'รอตรวจสอบ',
            note: 'บันทึกไม่ครบ: ' + (e.message || e),
          }).eq('id', bill.id);
        } catch (_) {}
      }
      if (typeof toast === 'function') toast('บันทึกขายไม่สำเร็จ: ' + (e.message || e), 'error');
      else alert('บันทึกขายไม่สำเร็จ: ' + (e.message || e));
      throw e;
    } finally {
      window.isProcessingPayment = false;
      window.__posPaymentLock = false;
    }
  }

  function installSaleSafety() {
    window.v9Sale = runSafeSale;
    window.v9Sale.__v36safe = true;
    window.completePayment = async function () {
      return window.v9Sale();
    };
    window.completePayment.__v36safe = true;
  }

  function installCashSafety() {
    const originalOpen = window.openCashSession;
    if (typeof originalOpen === 'function' && !originalOpen.__v36safe) {
      window.openCashSession = async function () {
        if (window.__cashOpenLock) return;
        window.__cashOpenLock = true;
        try {
          const session = await openSession();
          if (session) {
            if (typeof toast === 'function') toast('มีรอบลิ้นชักเปิดอยู่แล้ว ไม่ต้องเปิดซ้ำ', 'info');
            if (typeof renderCashDrawer === 'function') await renderCashDrawer();
            return;
          }
          return await originalOpen.apply(this, arguments);
        } finally {
          window.__cashOpenLock = false;
        }
      };
      window.openCashSession.__v36safe = true;
    }

    const originalRecordCash = window.recordCashTx;
    if (typeof originalRecordCash === 'function' && !originalRecordCash.__v36safe) {
      window.recordCashTx = async function (args) {
        const a = { ...(args || {}) };
        const net = money(a.netAmount ?? a.net_amount ?? a.amount);
        const amount = money(a.amount ?? net);
        const change = money(a.changeAmt ?? a.change_amt);
        if (!Number.isFinite(net) || !Number.isFinite(amount) || !Number.isFinite(change) || net < 0 || amount < 0 || change < 0) {
          throw new Error('ยอดเงินสดไม่ถูกต้อง');
        }
        if ((a.direction === 'in' || a.direction === 'out') && net <= 0) {
          throw new Error('ยอดเงินสดต้องมากกว่า 0');
        }
        if (!a.sessionId && !a.session_id) {
          const session = await openSession();
          if (!session) throw new Error('ยังไม่ได้เปิดลิ้นชักเงินสด');
          a.sessionId = session.id;
        }
        return await originalRecordCash.call(this, a);
      };
      window.recordCashTx.__v36safe = true;
    }

    const originalCashMovement = window.cashMovement;
    if (typeof originalCashMovement === 'function' && !originalCashMovement.__v36safe) {
      window.cashMovement = async function (type, session) {
        const liveSession = session || await openSession();
        if (!liveSession) return notify('กรุณาเปิดลิ้นชักก่อนทำรายการเงินสด', 'warning');

        const isAdd = type === 'add';
        if (typeof Swal === 'undefined') return originalCashMovement.apply(this, arguments);
        const { value, isConfirmed } = await Swal.fire({
          title: isAdd ? 'เพิ่มเงินเข้าลิ้นชัก' : 'เบิกเงินออกจากลิ้นชัก',
          html: `
            <input id="v36-cash-amt" class="swal2-input" type="number" min="1" step="0.01" placeholder="จำนวนเงิน">
            <input id="v36-cash-note" class="swal2-input" type="text" placeholder="หมายเหตุ (ถ้ามี)">
          `,
          showCancelButton: true,
          confirmButtonText: 'บันทึก',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: isAdd ? '#10b981' : '#ef4444',
          preConfirm: () => {
            const amount = money(document.getElementById('v36-cash-amt')?.value);
            if (!Number.isFinite(amount) || amount <= 0) {
              Swal.showValidationMessage('กรุณาระบุจำนวนเงินมากกว่า 0');
              return false;
            }
            return {
              amount,
              note: document.getElementById('v36-cash-note')?.value || '',
            };
          },
        });
        if (!isConfirmed || !value) return;

        await must(db.from('cash_transaction').insert({
          session_id: liveSession.id,
          type: isAdd ? 'เพิ่มเงิน' : 'เบิกเงิน',
          direction: isAdd ? 'in' : 'out',
          amount: value.amount,
          net_amount: value.amount,
          balance_after: 0,
          staff_name: userName(),
          note: value.note || null,
        }), 'บันทึกรายการลิ้นชัก');
        notify(isAdd ? 'เพิ่มเงินสำเร็จ' : 'เบิกเงินสำเร็จ', 'success');
        if (typeof renderCashDrawer === 'function') await renderCashDrawer();
      };
      window.cashMovement.__v36safe = true;
    }
  }

  function installProductValidation() {
    installProductImagePaste();

    const originalSave = window.saveProduct;
    if (typeof originalSave === 'function' && !originalSave.__v36safe) {
      window.saveProduct = async function () {
        const id = document.getElementById('prod-id')?.value || '';
        const name = (document.getElementById('prod-name')?.value || '').trim();
        const barcode = (document.getElementById('prod-barcode')?.value || '').trim();
        const price = money(document.getElementById('prod-price')?.value);
        const cost = money(document.getElementById('prod-cost')?.value);
        const stock = money(document.getElementById('prod-stock')?.value);
        const minStock = money(document.getElementById('prod-min-stock')?.value);

        if (!name) return toast?.('กรุณาระบุชื่อสินค้า', 'warning');
        if (!Number.isFinite(price) || price < 0) return toast?.('ราคาขายต้องไม่ติดลบ', 'warning');
        if (!Number.isFinite(cost) || cost < 0) return toast?.('ต้นทุนต้องไม่ติดลบ', 'warning');
        if (!Number.isFinite(stock) || stock < 0) return toast?.('สต็อกต้องไม่ติดลบ', 'warning');
        if (!Number.isFinite(minStock) || minStock < 0) return toast?.('สต็อกขั้นต่ำต้องไม่ติดลบ', 'warning');

        if (barcode) {
          let q = db.from(txt.product).select('id,name').eq('barcode', barcode);
          const { data, error } = await q.limit(2);
          if (error) throw error;
          const duplicate = (data || []).find(p => String(p.id) !== String(id));
          if (duplicate) {
            return toast?.(`บาร์โค้ดนี้ใช้กับสินค้า "${duplicate.name}" อยู่แล้ว`, 'warning');
          }
        }
        return await originalSave.apply(this, arguments);
      };
      window.saveProduct.__v36safe = true;
    }

    const originalDeleteProduct = window.deleteProduct;
    if (typeof originalDeleteProduct === 'function' && !originalDeleteProduct.__v36safe) {
      window.deleteProduct = async function (productId) {
        const used = await queryOne(txt.billItem, 'id', [['product_id', productId]]);
        if (used) {
          return Swal.fire({
            icon: 'warning',
            title: 'ลบสินค้าไม่ได้',
            text: 'สินค้านี้เคยอยู่ในบิลขายแล้ว เพื่อไม่ให้ประวัติบิลเสียหายให้ปรับสต็อกเป็น 0 หรือเปลี่ยนชื่อว่าเลิกขายแทน',
            confirmButtonText: 'ตกลง',
          });
        }
        return await originalDeleteProduct.apply(this, arguments);
      };
      window.deleteProduct.__v36safe = true;
    }
  }

  function readImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('อ่านรูปภาพไม่ได้'));
      };
      img.src = url;
    });
  }

  async function canvasToBlob(canvas, type, quality) {
    return await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('แปลงรูปภาพไม่ได้'));
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    if (parts.length < 2) throw new Error('รูปภาพไม่ถูกต้อง');
    const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/webp';
    const bin = atob(parts[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function isImageDataUrl(value) {
    return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || ''));
  }

  function productImagePathFromUrl(url) {
    const raw = String(url || '');
    if (!raw || !raw.includes('/storage/v1/object/public/product-images/')) return null;
    try {
      const u = new URL(raw);
      const marker = '/storage/v1/object/public/product-images/';
      const idx = u.pathname.indexOf(marker);
      if (idx < 0) return null;
      return decodeURIComponent(u.pathname.slice(idx + marker.length));
    } catch (_) {
      const marker = 'product-images/';
      const idx = raw.indexOf(marker);
      return idx >= 0 ? raw.slice(idx + marker.length) : null;
    }
  }

  async function removeOldProductImage(oldUrl) {
    const path = productImagePathFromUrl(oldUrl);
    if (!path || !db?.storage) return;
    try { await db.storage.from('product-images').remove([path]); } catch (_) {}
  }

  async function uploadProductImageBlob(blob, nameHint) {
    if (!db?.storage) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase Storage');
    const finalBlob = blob.type === 'image/webp' && blob.size <= 120 * 1024
      ? blob
      : (await compressProductImage(blob)).blob;
    const safeName = String(nameHint || 'product')
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42) || 'product';
    const fileName = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.webp`;
    const { error } = await db.storage.from('product-images').upload(fileName, finalBlob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw new Error('อัปโหลดรูปไป Supabase Storage ไม่สำเร็จ: ' + error.message);
    const { data } = db.storage.from('product-images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function uploadImageValueIfNeeded(value, oldValue, nameHint) {
    const imgValue = String(value || '').trim();
    if (!isImageDataUrl(imgValue)) return imgValue || null;
    const url = await uploadProductImageBlob(dataUrlToBlob(imgValue), nameHint);
    await removeOldProductImage(oldValue);
    return url;
  }

  async function compressProductImage(blob) {
    if (!blob || !String(blob.type || '').startsWith('image/')) {
      throw new Error('ไฟล์ที่วางไม่ใช่รูปภาพ');
    }

    const img = await readImage(blob);
    const sourceMax = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    let maxSide = Math.min(1000, sourceMax || 1000);
    let best = null;

    for (let scaleTry = 0; scaleTry < 5; scaleTry++) {
      const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const w = Math.max(1, Math.round((img.naturalWidth || img.width) * ratio));
      const h = Math.max(1, Math.round((img.naturalHeight || img.height) * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      const candidates = [];
      for (const type of ['image/webp', 'image/jpeg']) {
        for (const q of [0.72, 0.6, 0.48, 0.36, 0.28]) {
          const out = await canvasToBlob(canvas, type, q);
          if (out) candidates.push(out);
        }
      }

      candidates.sort((a, b) => a.size - b.size);
      if (candidates[0] && (!best || candidates[0].size < best.size)) best = candidates[0];
      if (best && best.size <= 90 * 1024) break;
      maxSide = Math.round(maxSide * 0.78);
    }

    if (!best) throw new Error('บีบอัดรูปภาพไม่สำเร็จ');
    return {
      blob: best,
      dataUrl: await blobToDataUrl(best),
      size: best.size,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    };
  }

  async function fetchImageFromUrl(url) {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) throw new Error('โหลดรูปจาก URL ไม่สำเร็จ');
    const blob = await res.blob();
    if (!String(blob.type || '').startsWith('image/')) throw new Error('URL นี้ไม่ใช่ไฟล์รูปภาพ');
    return blob;
  }

  function setProductImagePreview(dataUrl, metaText) {
    const imgInput = document.getElementById('prod-img');
    const preview = document.getElementById('v36-prod-img-preview');
    const meta = document.getElementById('v36-prod-img-meta');
    if (imgInput) imgInput.value = dataUrl || '';
    if (preview) {
      preview.innerHTML = dataUrl
        ? `<img src="${dataUrl}" alt="product" style="width:100%;height:100%;object-fit:cover">`
        : '<i class="material-icons-round" style="font-size:34px;color:#94a3b8">image</i>';
    }
    if (meta) meta.textContent = metaText || (dataUrl ? 'พร้อมบันทึกรูปภาพ' : 'วางรูปภาพหรือ URL รูปภาพได้ที่นี่');
  }

  async function handleProductImageBlob(blob) {
    const meta = document.getElementById('v36-prod-img-meta');
    if (meta) meta.textContent = 'กำลังบีบอัดรูปภาพ...';
    const out = await compressProductImage(blob);
    setProductImagePreview(out.dataUrl, `บีบอัดแล้ว ${(out.size / 1024).toFixed(1)} KB`);
  }

  function installProductImagePaste() {
    const originalModal = window.showAddProductModal;
    if (typeof originalModal !== 'function') return;
    if (originalModal.__v36imagepaste) {
      enhanceProductImageInput();
      enhanceV9ProductImageInput();
      return;
    }

    window.showAddProductModal = function () {
      const result = originalModal.apply(this, arguments);
      setTimeout(enhanceProductImageInput, 30);
      setTimeout(enhanceV9ProductImageInput, 30);
      return result;
    };
    window.showAddProductModal.__v36imagepaste = true;

    enhanceProductImageInput();
    enhanceV9ProductImageInput();
  }

  function installProductStorageBridge() {
    if (typeof window.uploadImageToSupabase === 'function' && !window.uploadImageToSupabase.__v36storage) {
      window.uploadImageToSupabase = async function (file) {
        if (!file) return null;
        return await uploadProductImageBlob(file, file.name || document.getElementById('v9prod-name')?.value || 'product');
      };
      window.uploadImageToSupabase.__v36storage = true;
    }

    const originalV9Save = window.v9SaveProduct;
    if (typeof originalV9Save === 'function' && !originalV9Save.__v36storage) {
      window.v9SaveProduct = async function () {
        const img = document.getElementById('v9prod-img');
        const oldImg = document.getElementById('v9prod-img-old');
        const name = document.getElementById('v9prod-name')?.value || 'product';
        if (img && isImageDataUrl(img.value)) {
          const meta = document.getElementById('v36-v9prod-img-meta');
          if (meta) meta.textContent = 'กำลังอัปโหลดรูปไป Supabase Storage...';
          img.value = await uploadImageValueIfNeeded(img.value, oldImg?.value, name);
          if (oldImg) oldImg.value = img.value;
          setV9ProductImagePreview(img.value, 'อัปโหลดแล้ว จะบันทึกเฉพาะ URL รูปภาพ');
        } else if (img && !String(img.value || '').trim() && oldImg?.value) {
          await removeOldProductImage(oldImg.value);
        }
        return await originalV9Save.apply(this, arguments);
      };
      window.v9SaveProduct.__v36storage = true;
    }

    const originalBaseSave = window.saveProduct;
    if (typeof originalBaseSave === 'function' && !originalBaseSave.__v36storage) {
      window.saveProduct = async function () {
        const img = document.getElementById('prod-img');
        const name = document.getElementById('prod-name')?.value || 'product';
        if (img && isImageDataUrl(img.value)) {
          const meta = document.getElementById('v36-prod-img-meta');
          if (meta) meta.textContent = 'กำลังอัปโหลดรูปไป Supabase Storage...';
          img.value = await uploadImageValueIfNeeded(img.value, '', name);
          setProductImagePreview(img.value, 'อัปโหลดแล้ว จะบันทึกเฉพาะ URL รูปภาพ');
        }
        return await originalBaseSave.apply(this, arguments);
      };
      window.saveProduct.__v36storage = true;
      window.saveProduct.__v36safe = !!originalBaseSave.__v36safe;
    }
  }

  function installProductImageMigrationTool() {
    if (window.v36MigrateProductImagesToStorage) return;
    window.v36MigrateProductImagesToStorage = async function () {
      const { data, error } = await db.from(txt.product).select('id,name,img_url');
      if (error) throw error;
      const rows = (data || []).filter(p => isImageDataUrl(p.img_url));
      if (!rows.length) {
        notify('ไม่มีรูป Base64 ที่ต้องย้าย', 'info');
        return { total: 0, done: 0 };
      }
      let done = 0;
      for (const p of rows) {
        const url = await uploadImageValueIfNeeded(p.img_url, '', p.name || p.id);
        const res = await db.from(txt.product).update({ img_url: url, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (res.error) throw res.error;
        done++;
      }
      if (typeof loadProducts === 'function') await loadProducts();
      notify(`ย้ายรูปสินค้าไป Storage สำเร็จ ${done}/${rows.length} รูป`, 'success');
      return { total: rows.length, done };
    };
  }

  const PERMISSION_DEFS = [
    { key: 'can_pos', page: 'pos', label: 'POS ขาย', icon: 'point_of_sale', desc: 'ขายสินค้าและออกบิล' },
    { key: 'can_inv', page: 'inv', label: 'คลังสินค้า', icon: 'inventory_2', desc: 'ดู/แก้ไขสินค้าและสต็อก' },
    { key: 'can_manage', page: 'manage', label: 'จัดการสินค้า', icon: 'settings_suggest', desc: 'หมวดหมู่ หน่วยนับ สูตร ซัพพลายเออร์ ผลิต' },
    { key: 'can_cash', page: 'cash', label: 'ลิ้นชักเงินสด', icon: 'account_balance_wallet', desc: 'เปิด/ปิดรอบ เพิ่ม/เบิกเงิน' },
    { key: 'can_exp', page: 'exp', label: 'รายจ่าย', icon: 'receipt_long', desc: 'บันทึกและดูรายจ่าย' },
    { key: 'can_debt', page: 'debt', label: 'ลูกค้าค้างชำระ', icon: 'groups', desc: 'ดูหนี้และรับชำระหนี้' },
    { key: 'can_customer', page: 'customer', label: 'ลูกค้าประจำ', icon: 'star', desc: 'จัดการข้อมูลลูกค้า' },
    { key: 'can_purchase', page: 'purchase', label: 'รับสินค้าเข้า', icon: 'local_shipping', desc: 'รับสินค้าเข้าคลังและเจ้าหนี้' },
    { key: 'can_payable', page: 'payable', label: 'เจ้าหนี้ร้าน', icon: 'account_balance', desc: 'ดู/ชำระเจ้าหนี้และซัพพลายเออร์' },
    { key: 'can_quotation', page: 'quotation', label: 'ใบเสนอราคา', icon: 'description', desc: 'สร้างและจัดการใบเสนอราคา' },
    { key: 'can_delivery', page: 'delivery', label: 'คิวจัดส่ง', icon: 'local_shipping', desc: 'ดูคิวและปิดงานจัดส่ง' },
    { key: 'can_projects', page: 'projects', label: 'โครงการ', icon: 'business_center', desc: 'ติดตามงบ รายจ่าย และกำไรโครงการ' },
    { key: 'can_att', page: 'att', label: 'พนักงาน/เงินเดือน', icon: 'badge', desc: 'เช็กชื่อ เงินเดือน และ HR' },
    { key: 'can_dash', page: 'dash', label: 'Dashboard', icon: 'analytics', desc: 'ดูรายงานและวิเคราะห์ธุรกิจ' },
    { key: 'can_history', page: 'history', label: 'ประวัติขาย', icon: 'history', desc: 'ดูบิลย้อนหลังและยกเลิก/พิมพ์ซ้ำ' },
    { key: 'can_log', page: 'log', label: 'ประวัติกิจกรรม', icon: 'manage_search', desc: 'ดู log การใช้งานระบบ' },
  ];

  const PERMISSION_PAGE_MAP = PERMISSION_DEFS.reduce((acc, item) => {
    acc[item.page] = item.key;
    return acc;
  }, {
    home: null,
    admin: '__admin__',
    ap: 'can_payable',
    vendor: 'can_payable',
  });

  let v36PermissionColumns = null;

  function canAccessPageV36(page) {
    if (!USER) return false;
    if (USER.role === 'admin') return true;
    const key = PERMISSION_PAGE_MAP[page];
    if (key === null || key === undefined) return true;
    if (key === '__admin__') return false;
    if (key === 'can_history') return USER_PERMS?.can_history === true || USER_PERMS?.can_log === true;
    if (key === 'can_payable') return USER_PERMS?.can_payable === true || USER_PERMS?.can_purchase === true;
    return USER_PERMS?.[key] === true;
  }

  function applyNavPermissionsV36() {
    if (!USER) return;
    const isAdmin = USER.role === 'admin';
    document.getElementById('nav-admin-section')?.style.setProperty('display', isAdmin ? 'block' : 'none');
    document.getElementById('nav-admin')?.style.setProperty('display', isAdmin ? 'flex' : 'none');
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      const page = item.dataset.page;
      if (page === 'admin') return;
      item.style.display = canAccessPageV36(page) ? '' : 'none';
    });
  }

  function installPermissionMapCompleteness() {
    try {
      if (typeof PAGE_PERM_MAP !== 'undefined') {
        Object.assign(PAGE_PERM_MAP, PERMISSION_PAGE_MAP, {
          customer: 'can_customer',
          quotation: 'can_quotation',
          payable: 'can_payable',
          history: 'can_history',
          delivery: 'can_delivery',
          projects: 'can_projects',
          manage: 'can_manage',
          ap: 'can_payable',
          vendor: 'can_payable',
          admin: '__admin__',
        });
      }
    } catch (e) {
      console.warn('[v36-perms] map patch skipped:', e);
    }

    if (typeof window.hasPermission !== 'function' || !window.hasPermission.__v36perms) {
      window.hasPermission = canAccessPageV36;
      try { hasPermission = canAccessPageV36; } catch (_) {}
      window.hasPermission.__v36perms = true;
    }

    if (typeof window.applyNavPermissions !== 'function' || !window.applyNavPermissions.__v36perms) {
      window.applyNavPermissions = applyNavPermissionsV36;
      try { applyNavPermissions = applyNavPermissionsV36; } catch (_) {}
      window.applyNavPermissions.__v36perms = true;
    }

    if (typeof window.go === 'function' && !window.go.__v36perms) {
      const originalGo = window.go;
      window.go = function (page) {
        if (!canAccessPageV36(page)) {
          notify('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error');
          page = 'home';
        }
        if (page === 'history' && USER_PERMS?.can_log === true) USER_PERMS.can_history = true;
        if ((page === 'payable' || page === 'ap' || page === 'vendor') && USER_PERMS?.can_purchase === true) USER_PERMS.can_payable = true;
        return originalGo.call(this, page);
      };
      try { go = window.go; } catch (_) {}
      window.go.__v36perms = true;
    }

    setTimeout(applyNavPermissionsV36, 100);
  }

  async function detectPermissionColumns(rows) {
    if (v36PermissionColumns) return v36PermissionColumns;
    const sample = rows && rows[0] ? rows[0] : null;
    if (sample) {
      v36PermissionColumns = new Set(Object.keys(sample));
      return v36PermissionColumns;
    }
    v36PermissionColumns = new Set(['user_id', ...PERMISSION_DEFS.map(p => p.key)]);
    return v36PermissionColumns;
  }

  function missingPermissionColumns(columns) {
    if (!columns || !columns.size) return [];
    return PERMISSION_DEFS.map(p => p.key).filter(key => !columns.has(key));
  }

  function permissionMigrationSQL(keys) {
    return keys.map(k => `alter table "สิทธิ์การเข้าถึง" add column if not exists ${k} boolean default false;`).join('\n');
  }

  async function saveUserPermissionsV36(userId) {
    const payload = {};
    PERMISSION_DEFS.forEach(def => {
      const el = document.getElementById(`v36perm-${userId}-${def.key}`);
      payload[def.key] = !!el?.checked;
    });

    const cols = await detectPermissionColumns();
    const missing = missingPermissionColumns(cols);
    const writable = {};
    Object.entries(payload).forEach(([key, val]) => {
      if (!cols || cols.has(key)) writable[key] = val;
    });

    try {
      const { data: ex, error: exErr } = await db.from('สิทธิ์การเข้าถึง').select('id').eq('user_id', userId).maybeSingle();
      if (exErr) throw exErr;
      const res = ex
        ? await db.from('สิทธิ์การเข้าถึง').update(writable).eq('user_id', userId)
        : await db.from('สิทธิ์การเข้าถึง').insert({ user_id: userId, ...writable });
      if (res.error) throw res.error;
      if (USER?.id === userId) {
        USER_PERMS = { ...(USER_PERMS || {}), ...payload };
        applyNavPermissionsV36();
      }
      if (missing.length) {
        notify('บันทึกสิทธิ์ที่ตารางรองรับแล้ว แต่ยังมีคอลัมน์สิทธิ์ใหม่ที่ต้องเพิ่มใน Supabase', 'warning');
      } else {
        notify('บันทึกสิทธิ์สำเร็จ', 'success');
      }
    } catch (e) {
      console.error('[v36-perms] save:', e);
      notify('บันทึกสิทธิ์ไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  }

  function setAllPermissionsV36(userId, checked) {
    PERMISSION_DEFS.forEach(def => {
      const el = document.getElementById(`v36perm-${userId}-${def.key}`);
      if (el) el.checked = checked;
    });
    saveUserPermissionsV36(userId);
  }

  function renderMissingPermissionWarning(missing) {
    if (!missing.length) return '';
    const sql = permissionMigrationSQL(missing);
    window.v36PermissionSQL = sql;
    return `
      <div style="margin-bottom:14px;padding:12px 14px;border:1px solid #fde68a;background:#fffbeb;border-radius:12px;color:#92400e;font-size:12px;line-height:1.55">
        <b>ต้องเพิ่มคอลัมน์สิทธิ์ใน Supabase อีก ${missing.length} ช่อง</b>
        <div style="margin-top:4px">คัดลอก SQL จาก <code>window.v36PermissionSQL</code> ไปรันใน Supabase SQL Editor เพื่อให้สิทธิ์ใหม่บันทึกได้ครบ</div>
      </div>`;
  }

  function effectivePermissionChecked(perms, def) {
    if (perms?.[def.key] === true) return true;
    if (perms?.[def.key] === false) return false;
    if (def.key === 'can_history') return perms?.can_log === true;
    if (def.key === 'can_payable') return perms?.can_purchase === true;
    if (def.key === 'can_delivery') return perms?.can_purchase === true || perms?.can_pos === true;
    if (def.key === 'can_customer') return perms?.can_debt === true || perms?.can_pos === true;
    if (def.key === 'can_quotation') return perms?.can_pos === true;
    if (def.key === 'can_projects') return perms?.can_dash === true || perms?.can_exp === true;
    const legacyCore = ['can_pos', 'can_inv', 'can_cash', 'can_exp', 'can_debt', 'can_att', 'can_purchase', 'can_dash', 'can_log'];
    return legacyCore.every(key => perms?.[key] === true);
  }

  async function renderUserPermsV36(container) {
    if (!container) container = document.querySelector('#admin-content, .admin-content, [data-tab-content="users"]');
    if (!container) return;
    container.innerHTML = '<div style="padding:28px;text-align:center;color:#94a3b8">กำลังโหลดสิทธิ์...</div>';

    let users = [], perms = [];
    try {
      const [ur, pr] = await Promise.all([
        db.from('ผู้ใช้งาน').select('*').order('username'),
        db.from('สิทธิ์การเข้าถึง').select('*'),
      ]);
      if (ur.error) throw ur.error;
      if (pr.error) throw pr.error;
      users = ur.data || [];
      perms = pr.data || [];
    } catch (e) {
      container.innerHTML = `<div style="padding:24px;color:#dc2626">โหลดสิทธิ์ไม่สำเร็จ: ${htmlAttr(e.message || e)}</div>`;
      return;
    }

    const cols = await detectPermissionColumns(perms);
    const missing = missingPermissionColumns(cols);
    const permMap = {};
    perms.forEach(p => { permMap[p.user_id] = p; });

    container.innerHTML = `
      ${renderMissingPermissionWarning(missing)}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap">
        <div>
          <h3 style="font-size:16px;font-weight:800;margin:0 0 3px">จัดการผู้ใช้งานและสิทธิ์</h3>
          <div style="font-size:12px;color:#94a3b8">${users.length} บัญชี - สิทธิ์ครบตามเมนูระบบ</div>
        </div>
        <button class="btn btn-primary" onclick="showAddUserModal?.()"><i class="material-icons-round">person_add</i> เพิ่มผู้ใช้งาน</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${users.map(user => {
          const isAdmin = user.role === 'admin';
          const p = permMap[user.id] || {};
          return `
            <div style="border:1.5px solid ${isAdmin ? '#fca5a5' : '#e2e8f0'};border-radius:16px;overflow:hidden;background:#fff">
              <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;background:${isAdmin ? '#fff5f5' : '#f8fafc'}">
                <div style="width:44px;height:44px;border-radius:50%;background:${isAdmin ? '#dc2626' : '#6366f1'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900">${htmlAttr(String(user.username || '?').charAt(0).toUpperCase())}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:15px;font-weight:800;color:#334155">${htmlAttr(user.username || '-')}</div>
                  <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:800;background:${isAdmin ? '#fee2e2' : '#ede9fe'};color:${isAdmin ? '#dc2626' : '#6366f1'}">${isAdmin ? 'Admin' : 'Staff'}</span>
                  ${isAdmin ? '<span style="font-size:11px;color:#94a3b8;margin-left:8px">Admin มีสิทธิ์ทั้งหมดอัตโนมัติ</span>' : ''}
                </div>
                <div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">
                  ${!isAdmin ? `<button type="button" class="btn btn-ghost btn-sm" onclick="setAllPermissionsV36('${user.id}',true)">เลือกทั้งหมด</button>
                  <button type="button" class="btn btn-ghost btn-sm" onclick="setAllPermissionsV36('${user.id}',false)">ล้าง</button>` : ''}
                  <button type="button" class="btn btn-ghost btn-sm" onclick="v9EditUserPin?.('${jsString(user.id)}','${jsString(user.username || '')}')"><i class="material-icons-round">pin</i> แก้ PIN</button>
                  ${user.id !== USER?.id ? `<button type="button" class="btn btn-ghost btn-sm" style="color:#dc2626;border-color:#fecaca" onclick="deleteUser('${jsString(user.id)}','${jsString(user.username || '')}')"><i class="material-icons-round">delete</i></button>` : ''}
                </div>
              </div>
              ${isAdmin ? '' : `
                <div style="padding:14px 18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px">
                  ${PERMISSION_DEFS.map(def => {
                    const checked = effectivePermissionChecked(p, def);
                    const unsupported = missing.includes(def.key);
                    return `
                      <label style="display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;border:1.5px solid ${checked ? '#ef4444' : '#e2e8f0'};background:${unsupported ? '#f8fafc' : checked ? '#fff1f2' : '#fff'};cursor:${unsupported ? 'not-allowed' : 'pointer'};opacity:${unsupported ? '.62' : '1'}">
                        <input type="checkbox" id="v36perm-${user.id}-${def.key}" ${checked ? 'checked' : ''} ${unsupported ? 'disabled' : ''} onchange="saveUserPermissionsV36('${user.id}')" style="width:16px;height:16px;accent-color:#ef4444">
                        <i class="material-icons-round" style="font-size:18px;color:${checked ? '#ef4444' : '#64748b'}">${def.icon}</i>
                        <div style="min-width:0">
                          <div style="font-size:12px;font-weight:800;color:#1e293b">${htmlAttr(def.label)}</div>
                          <div style="font-size:10px;color:#94a3b8;margin-top:1px">${htmlAttr(def.desc)}</div>
                        </div>
                      </label>`;
                  }).join('')}
                </div>`}
            </div>`;
        }).join('')}
      </div>`;
  }

  function installPermissionUICompleteness() {
    installPermissionMapCompleteness();
    window.renderUserPerms = renderUserPermsV36;
    window.v36SavePermission = saveUserPermissionsV36;
    window.saveUserPermissionsV36 = saveUserPermissionsV36;
    window.setAllPermissionsV36 = setAllPermissionsV36;
    window.savePermission = saveUserPermissionsV36;
    window.v9SavePermission = saveUserPermissionsV36;
  }

  function enhanceProductImageInput() {
    const form = document.getElementById('product-form');
    const imgInput = document.getElementById('prod-img');
    if (!form || !imgInput || form.__v36imagepasteReady) return;
    form.__v36imagepasteReady = true;

    imgInput.type = 'text';
    imgInput.placeholder = 'วางรูปภาพ, วาง URL รูปภาพ หรือเลือกไฟล์';

    const tools = document.createElement('div');
    tools.id = 'v36-prod-img-tools';
    tools.innerHTML = `
      <div id="v36-prod-img-drop" style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:14px;padding:12px;background:#f8fafc;display:grid;grid-template-columns:82px 1fr;gap:12px;align-items:center;cursor:pointer">
        <div id="v36-prod-img-preview" style="width:82px;height:82px;border-radius:12px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${imgInput.value ? `<img src="${htmlAttr(imgInput.value)}" alt="product" style="width:100%;height:100%;object-fit:cover">` : '<i class="material-icons-round" style="font-size:34px;color:#94a3b8">image</i>'}
        </div>
        <div>
          <div style="font-weight:800;color:#0f172a;font-size:13px">วางรูปจากเว็บได้ทันที</div>
          <div id="v36-prod-img-meta" style="margin-top:4px;color:#64748b;font-size:12px;line-height:1.5">คัดลอกรูปภาพแล้วกด Ctrl+V หรือวาง URL รูปภาพ ระบบจะบีบอัดให้อัตโนมัติ</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" id="v36-prod-img-pick" class="btn btn-ghost btn-sm"><i class="material-icons-round">upload</i> เลือกรูป</button>
            <button type="button" id="v36-prod-img-clear" class="btn btn-ghost btn-sm"><i class="material-icons-round">delete</i> ล้างรูป</button>
          </div>
        </div>
      </div>
      <input id="v36-prod-img-file" type="file" accept="image/*" style="display:none">
    `;
    imgInput.insertAdjacentElement('afterend', tools);

    const drop = document.getElementById('v36-prod-img-drop');
    const file = document.getElementById('v36-prod-img-file');
    const pick = document.getElementById('v36-prod-img-pick');
    const clear = document.getElementById('v36-prod-img-clear');

    pick?.addEventListener('click', () => file?.click());
    clear?.addEventListener('click', () => setProductImagePreview('', 'ล้างรูปแล้ว'));
    file?.addEventListener('change', async () => {
      const blob = file.files?.[0];
      if (!blob) return;
      try { await handleProductImageBlob(blob); }
      catch (e) { notify('บีบอัดรูปไม่สำเร็จ: ' + (e.message || e), 'error'); }
    });

    imgInput.addEventListener('input', () => {
      const value = imgInput.value.trim();
      if (value && !value.startsWith('data:')) setProductImagePreview(value, 'ใช้ URL รูปภาพนี้ หรือกด Ctrl+V เพื่อบีบอัดเป็นไฟล์เล็ก');
      if (!value) setProductImagePreview('', 'วางรูปภาพหรือ URL รูปภาพได้ที่นี่');
    });

    form.addEventListener('paste', async (ev) => {
      const items = Array.from(ev.clipboardData?.items || []);
      const imageItem = items.find(item => item.type && item.type.startsWith('image/'));
      if (imageItem) {
        ev.preventDefault();
        try { await handleProductImageBlob(imageItem.getAsFile()); }
        catch (e) { notify('วางรูปไม่สำเร็จ: ' + (e.message || e), 'error'); }
        return;
      }

      const text = ev.clipboardData?.getData('text/plain')?.trim();
      const pasteTarget = ev.target;
      const isImageTarget = pasteTarget === imgInput || tools.contains(pasteTarget);
      if (isImageTarget && text && /^https?:\/\//i.test(text)) {
        ev.preventDefault();
        try {
          const meta = document.getElementById('v36-prod-img-meta');
          if (meta) meta.textContent = 'กำลังโหลดรูปจาก URL...';
          await handleProductImageBlob(await fetchImageFromUrl(text));
        } catch (e) {
          imgInput.value = text;
          setProductImagePreview(text, 'เว็บนี้ไม่อนุญาตให้ดึงรูปมาบีบอัด จึงใช้ URL แทน');
        }
      }
    });

    drop?.addEventListener('dragover', ev => {
      ev.preventDefault();
      drop.style.borderColor = '#2563eb';
      drop.style.background = '#eff6ff';
    });
    drop?.addEventListener('dragleave', () => {
      drop.style.borderColor = '#cbd5e1';
      drop.style.background = '#f8fafc';
    });
    drop?.addEventListener('drop', async ev => {
      ev.preventDefault();
      drop.style.borderColor = '#cbd5e1';
      drop.style.background = '#f8fafc';
      const blob = ev.dataTransfer?.files?.[0];
      const url = ev.dataTransfer?.getData('text/uri-list') || ev.dataTransfer?.getData('text/plain');
      try {
        if (blob) await handleProductImageBlob(blob);
        else if (url && /^https?:\/\//i.test(url.trim())) await handleProductImageBlob(await fetchImageFromUrl(url.trim()));
      } catch (e) {
        notify('เพิ่มรูปไม่สำเร็จ: ' + (e.message || e), 'error');
      }
    });
  }

  function setV9ProductImagePreview(dataUrl, metaText) {
    const hidden = document.getElementById('v9prod-img');
    const oldHidden = document.getElementById('v9prod-img-old');
    const wrap = document.getElementById('v9prod-img-preview-wrap');
    const img = document.getElementById('v9prod-img-preview');
    const meta = document.getElementById('v36-v9prod-img-meta');
    const file = document.getElementById('prod-img-upload');
    if (hidden) hidden.value = dataUrl || '';
    if (file) file.value = '';
    if (wrap) wrap.style.display = dataUrl ? 'block' : 'none';
    if (img) img.src = dataUrl || '';
    if (meta) {
      const oldText = oldHidden?.value ? ' มีรูปเดิมอยู่แล้ว' : '';
      meta.textContent = metaText || (dataUrl ? 'พร้อมบันทึกรูปภาพ' : 'วางรูปภาพจากเว็บ หรือเลือกไฟล์ ระบบจะบีบอัดให้อัตโนมัติ' + oldText);
    }
  }

  async function handleV9ProductImageBlob(blob) {
    const meta = document.getElementById('v36-v9prod-img-meta');
    if (meta) meta.textContent = 'กำลังบีบอัดรูปภาพ...';
    const out = await compressProductImage(blob);
    setV9ProductImagePreview(out.dataUrl, `บีบอัดแล้ว ${(out.size / 1024).toFixed(1)} KB`);
  }

  function enhanceV9ProductImageInput() {
    const form = document.getElementById('v9-product-form');
    const hidden = document.getElementById('v9prod-img');
    const file = document.getElementById('prod-img-upload');
    if (!form || !hidden || form.__v36v9imagepasteReady) return;
    form.__v36v9imagepasteReady = true;

    const previewWrap = document.getElementById('v9prod-img-preview-wrap');
    const imageBox = previewWrap?.parentElement || hidden.parentElement;
    if (!imageBox) return;

    const helper = document.createElement('div');
    helper.id = 'v36-v9prod-img-helper';
    helper.style.cssText = 'margin-top:10px;border:1px dashed #cbd5e1;border-radius:12px;padding:10px;background:#f8fafc;color:#475569;font-size:12px;line-height:1.5;text-align:left;';
    helper.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start">
        <i class="material-icons-round" style="font-size:20px;color:#2563eb;margin-top:1px">content_paste</i>
        <div style="flex:1">
          <div style="font-weight:800;color:#0f172a">วางรูปจากเว็บได้เลย</div>
          <div id="v36-v9prod-img-meta">คัดลอกรูปภาพแล้วกด Ctrl+V หรือวาง URL/ลากรูปมาที่ช่องนี้ ระบบจะบีบอัดให้อัตโนมัติ</div>
        </div>
      </div>
    `;
    imageBox.appendChild(helper);

    if (file && !file.__v36compressChange) {
      file.__v36compressChange = true;
      file.removeAttribute('onchange');
      file.addEventListener('change', async () => {
        const blob = file.files?.[0];
        if (!blob) return;
        try { await handleV9ProductImageBlob(blob); }
        catch (e) { notify('บีบอัดรูปไม่สำเร็จ: ' + (e.message || e), 'error'); }
      });
    }

    const handlePaste = async (ev) => {
      const items = Array.from(ev.clipboardData?.items || []);
      const imageItem = items.find(item => item.type && item.type.startsWith('image/'));
      if (imageItem) {
        ev.preventDefault();
        try { await handleV9ProductImageBlob(imageItem.getAsFile()); }
        catch (e) { notify('วางรูปไม่สำเร็จ: ' + (e.message || e), 'error'); }
        return;
      }

      const text = ev.clipboardData?.getData('text/plain')?.trim();
      const target = ev.target;
      const targetIsImageArea = helper.contains(target) || imageBox.contains(target);
      if (targetIsImageArea && text && /^https?:\/\//i.test(text)) {
        ev.preventDefault();
        try {
          const meta = document.getElementById('v36-v9prod-img-meta');
          if (meta) meta.textContent = 'กำลังโหลดรูปจาก URL...';
          await handleV9ProductImageBlob(await fetchImageFromUrl(text));
        } catch (e) {
          setV9ProductImagePreview(text, 'เว็บนี้ไม่อนุญาตให้ดึงรูปมาบีบอัด จึงใช้ URL แทน');
        }
      }
    };
    form.addEventListener('paste', handlePaste);

    const dropTarget = imageBox;
    dropTarget.addEventListener('dragover', ev => {
      ev.preventDefault();
      helper.style.borderColor = '#2563eb';
      helper.style.background = '#eff6ff';
    });
    dropTarget.addEventListener('dragleave', () => {
      helper.style.borderColor = '#cbd5e1';
      helper.style.background = '#f8fafc';
    });
    dropTarget.addEventListener('drop', async ev => {
      ev.preventDefault();
      helper.style.borderColor = '#cbd5e1';
      helper.style.background = '#f8fafc';
      const blob = ev.dataTransfer?.files?.[0];
      const url = ev.dataTransfer?.getData('text/uri-list') || ev.dataTransfer?.getData('text/plain');
      try {
        if (blob) await handleV9ProductImageBlob(blob);
        else if (url && /^https?:\/\//i.test(url.trim())) await handleV9ProductImageBlob(await fetchImageFromUrl(url.trim()));
      } catch (e) {
        notify('เพิ่มรูปไม่สำเร็จ: ' + (e.message || e), 'error');
      }
    });
  }

  async function settleDeliveryStockOnce(billId, items) {
    const deliverItems = (items || []).filter(i => money(i.deliver_qty) > 0 && i.product_id);
    for (const it of deliverItems) {
      const existed = await queryOne('stock_movement', 'id', [
        ['ref_id', billId],
        ['product_id', it.product_id],
        ['type', txt.deliveryMove],
      ]);
      if (existed) continue;

      const prod = await queryOne(txt.product, 'id,name,stock,unit', [['id', it.product_id]]);
      if (!prod) throw new Error('ไม่พบสินค้า: ' + (it.name || it.product_id));

      let deducted = money(it.deliver_qty);
      if (typeof _v20FetchConv === 'function' && typeof _v20BaseQty === 'function') {
        const conv = await _v20FetchConv([it.product_id]);
        deducted = _v20BaseQty(deducted, it.unit || prod.unit || 'ชิ้น', it.product_id, conv.um || {}, conv.bm || {});
      }

      const before = money(prod.stock);
      if (before < deducted) {
        throw new Error(`สต็อกไม่พอสำหรับจัดส่ง: ${it.name || prod.name} มี ${fmt(before)} ต้องใช้ ${fmt(deducted)}`);
      }
      const after = Number((before - deducted).toFixed(6));
      await must(db.from(txt.product).update({ stock: after, updated_at: new Date().toISOString() }).eq('id', it.product_id), 'ตัดสต็อกจัดส่ง');
      await must(db.from('stock_movement').insert({
        product_id: it.product_id,
        product_name: it.name || prod.name,
        type: txt.deliveryMove,
        direction: 'out',
        qty: deducted,
        stock_before: before,
        stock_after: after,
        ref_id: billId,
        ref_table: txt.bill,
        staff_name: userName(),
      }), 'บันทึกประวัติสต็อกจัดส่ง');
    }
  }

  async function fetchBillAndItems(billId) {
    const [billRes, itemRes] = await Promise.all([
      db.from(txt.bill).select('*').eq('id', billId).maybeSingle(),
      db.from(txt.billItem).select('*').eq('bill_id', billId),
    ]);
    if (billRes.error) throw billRes.error;
    if (itemRes.error) throw itemRes.error;
    return { bill: billRes.data, items: itemRes.data || [] };
  }

  function effectiveTotal(bill) {
    let info = bill?.return_info || {};
    if (typeof info === 'string') {
      try { info = JSON.parse(info); } catch (_) { info = {}; }
    }
    return money(info.new_total ?? bill?.total);
  }

  function effectivePaidForDelivery(bill, total) {
    const deposit = money(bill?.deposit_amount);
    if (deposit > 0) return Math.min(deposit, total);

    const received = money(bill?.received);
    const change = money(bill?.change);
    const netReceived = Math.max(0, received - change);
    if (netReceived >= total) return total;

    const method = String(bill?.method || '');
    const status = String(bill?.status || '');
    const isDebt = method === txt.debt || status === txt.debt;
    if (!isDebt && status !== txt.debt && (status === txt.success || status === txt.pendingDelivery)) {
      return total;
    }

    return Math.min(netReceived, total);
  }

  function installDeliverySafety() {
    window.v12DQMarkDone = async function (billId) {
      if (window.__deliveryDoneLocks?.[billId]) return;
      window.__deliveryDoneLocks = window.__deliveryDoneLocks || {};
      window.__deliveryDoneLocks[billId] = true;
      try {
        const { bill, items } = await fetchBillAndItems(billId);
        if (!bill) return toast?.('ไม่พบบิล', 'error');
        if (bill.delivery_status === txt.delivered) {
          return toast?.('บิลนี้จัดส่งสำเร็จไปแล้ว', 'info');
        }

        const total = effectiveTotal(bill);
        const paid = effectivePaidForDelivery(bill, total);
        const remaining = Math.max(0, total - paid);
        let action = remaining > 0 ? 'pay' : 'done';

        if (typeof Swal !== 'undefined') {
          const result = await Swal.fire({
            icon: 'question',
            title: 'ยืนยันจัดส่งสำเร็จ?',
            html: remaining > 0
              ? `<div style="text-align:left;line-height:1.8">
                  <div>ยอดบิล: <b>฿${fmt(total)}</b></div>
                  <div>มัดจำแล้ว: <b style="color:#16a34a">฿${fmt(paid)}</b></div>
                  <div>ยอดคงเหลือ: <b style="color:#dc2626">฿${fmt(remaining)}</b></div>
                </div>`
              : 'ระบบจะตัดสต็อกเฉพาะรายการที่ยังไม่เคยตัด และปิดสถานะจัดส่งให้',
            showCancelButton: true,
            showDenyButton: remaining > 0,
            confirmButtonText: remaining > 0 ? 'รับชำระตอนนี้' : 'ยืนยัน',
            denyButtonText: 'บันทึกเป็นหนี้',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#10b981',
            denyButtonColor: '#f59e0b',
          });
          if (result.isDismissed) return;
          action = result.isDenied ? 'debt' : (remaining > 0 ? 'pay' : 'done');
        } else if (!confirm('ยืนยันจัดส่งสำเร็จ?')) {
          return;
        }

        await settleDeliveryStockOnce(billId, items);
        await must(db.from(txt.bill).update({
          delivery_status: txt.delivered,
          status: remaining > 0 ? txt.debt : txt.success,
        }).eq('id', billId), 'อัปเดตสถานะจัดส่ง');

        if (remaining > 0 && action === 'debt' && bill.customer_id) {
          const { data: cust } = await db.from('customer').select('debt_amount').eq('id', bill.customer_id).maybeSingle();
          await must(db.from('customer').update({
            debt_amount: money(cust?.debt_amount) + remaining,
          }).eq('id', bill.customer_id), 'บันทึกหนี้ลูกค้า');
        }

        if (typeof logActivity === 'function') {
          await Promise.resolve(logActivity(txt.delivered, `บิล #${bill.bill_no || billId}${remaining > 0 ? ' ยอดคงเหลือ ฿' + fmt(remaining) : ''}`, billId, txt.bill));
        }
        if (typeof loadProducts === 'function') await loadProducts();
        if (typeof renderDelivery === 'function') await renderDelivery();
        if (typeof updateHomeStats === 'function') updateHomeStats();

        if (remaining > 0 && action === 'pay' && typeof v20BMCPayDebt === 'function') {
          await v20BMCPayDebt(billId);
        } else {
          toast?.(action === 'debt' ? 'จัดส่งสำเร็จ และบันทึกยอดคงเหลือเป็นหนี้แล้ว' : 'จัดส่งสำเร็จ', 'success');
        }
      } catch (e) {
        console.error('[v36] delivery failed:', e);
        toast?.('จัดส่งไม่สำเร็จ: ' + (e.message || e), 'error');
      } finally {
        delete window.__deliveryDoneLocks[billId];
      }
    };
    window.v12DQMarkDone.__v36safe = true;
  }

  function installAdminSafety() {
    const originalDeleteCat = window.deleteCat;
    if (typeof originalDeleteCat === 'function' && !originalDeleteCat.__v36safe) {
      window.deleteCat = async function (id) {
        const { data: cat } = await db.from('categories').select('name').eq('id', id).maybeSingle();
        if (cat?.name) {
          const used = await queryOne(txt.product, 'id', [['category', cat.name]]);
          if (used) {
            return Swal.fire({
              icon: 'warning',
              title: 'ลบหมวดหมู่ไม่ได้',
              text: 'ยังมีสินค้าอยู่ในหมวดหมู่นี้ กรุณาย้ายสินค้าออกก่อน',
              confirmButtonText: 'ตกลง',
            });
          }
        }
        if (typeof Swal !== 'undefined') {
          const confirmed = await Swal.fire({
            icon: 'warning',
            title: 'ยืนยันลบหมวดหมู่?',
            text: cat?.name || '',
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc2626',
          });
          if (!confirmed.isConfirmed) return;
        }
        return await originalDeleteCat.apply(this, arguments);
      };
      window.deleteCat.__v36safe = true;
    }

    const originalDeleteUser = window.deleteUser;
    if (typeof originalDeleteUser === 'function' && !originalDeleteUser.__v36safe) {
      window.deleteUser = async function (id, name) {
        let currentUserId = null;
        try { currentUserId = USER?.id || null; } catch (_) {}
        if (String(id) === String(currentUserId)) {
          return toast?.('ไม่สามารถลบผู้ใช้ที่กำลังล็อกอินอยู่', 'warning');
        }
        try {
          const { data: target } = await db.from('ผู้ใช้งาน').select('role').eq('id', id).maybeSingle();
          if (target?.role === 'admin') {
            const { data: admins } = await db.from('ผู้ใช้งาน').select('id').eq('role', 'admin');
            if ((admins || []).length <= 1) {
              return toast?.('ต้องเหลือผู้ดูแลระบบอย่างน้อย 1 คน', 'warning');
            }
          }
        } catch (e) {
          console.warn('[v36] deleteUser admin check:', e);
        }
        return await originalDeleteUser.apply(this, arguments);
      };
      window.deleteUser.__v36safe = true;
    }
  }

  function installAll() {
    installSaleSafety();
    installCashSafety();
    installProductValidation();
    installProductStorageBridge();
    installProductImageMigrationTool();
    installPermissionUICompleteness();
    installDeliverySafety();
    installAdminSafety();
    console.log('[v36] Usage safety patch applied');
  }

  setTimeout(installAll, 400);
  setTimeout(installAll, 1400);
  setTimeout(installAll, 2600);
})();
