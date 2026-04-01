/**
 * SK POS — modules-v24-display.js  (โหลดหลังสุด)
 * ══════════════════════════════════════════════════════════════════
 *  ซิงค์หน้าจอลูกค้า (customer-display.html) ให้ไล่ตามจอ POS
 *
 *  แก้ไขจาก v24 เดิม:
 *  ✅ ใช้ deferred patching — รอฟังก์ชันโหลดก่อนค่อย patch
 *  ✅ ชื่อฟังก์ชันถูกต้อง: v14AddRecv, v13AddDenom, v12AddDenom
 *  ✅ Patch UI update functions: v14UpdateRecvUI, v13UpdateCashUI, v12UpdateCashDisplay
 *  ✅ Patch ลูกค้า: v12PickCustomer, v12SelectCustType, v13SelectCustType
 *  ✅ Patch วิธีชำระ: v13SetMethod, _skSetMethod, v12SetMethod
 *  ✅ Patch close/start checkout
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
function _v24Send(data) {
  if (typeof sendToDisplay === 'function') sendToDisplay(data);
}

/** Deferred patch: retry จนกว่าฟังก์ชันจะมี แล้ว wrap มัน */
function _v24Patch(fnName, afterFn, maxRetry) {
  maxRetry = maxRetry || 20;
  let attempt = 0;
  const tag = '_v24p_' + fnName;

  function tryPatch() {
    if (window[tag]) return; // already patched
    if (typeof window[fnName] !== 'function') {
      if (++attempt < maxRetry) setTimeout(tryPatch, 300);
      return;
    }
    const _orig = window[fnName];
    window[fnName] = function () {
      const result = _orig.apply(this, arguments);
      try { afterFn.apply(this, arguments); } catch (e) { console.warn('[v24]', fnName, e); }
      // If original returned a promise, chain afterFn
      if (result && typeof result.then === 'function') {
        return result.then(r => { try { afterFn.apply(this, arguments); } catch (_) {} return r; });
      }
      return result;
    };
    window[tag] = true;
    console.log('[v24-display] ✓ patched', fnName);
  }

  tryPatch();
  // Also try after a delay for late-loading overrides
  setTimeout(tryPatch, 500);
  setTimeout(tryPatch, 1500);
  setTimeout(tryPatch, 3000);
}


/* ════════════════════════════════════════════════════════════════
   1. CUSTOMER SELECTION — ส่งชื่อลูกค้าไปจอลูกค้า
════════════════════════════════════════════════════════════════ */

// v12PickCustomer (เลือกลูกค้าประจำจากรายชื่อ)
_v24Patch('v12PickCustomer', function (id, name) {
  _v24Send({ type: 'customer', name: name || 'ลูกค้าทั่วไป', customerType: 'member' });
});

// v12SaveNewCustomer (เพิ่มลูกค้าใหม่)
_v24Patch('v12SaveNewCustomer', function () {
  // Called AFTER the original (which is async)
  // v12State.customer should be updated by now
  setTimeout(function () {
    if (typeof v12State !== 'undefined' && v12State.customer?.name) {
      _v24Send({ type: 'customer', name: v12State.customer.name, customerType: 'new' });
    }
  }, 500);
});

// v12SelectCustType / v13SelectCustType (เลือกประเภท general/member/new)
function _v24CustTypeAfter(type) {
  if (type === 'general') {
    _v24Send({ type: 'customer', name: 'ลูกค้าทั่วไป', customerType: 'general' });
  }
}
_v24Patch('v12SelectCustType', _v24CustTypeAfter);
_v24Patch('v13SelectCustType', _v24CustTypeAfter);


/* ════════════════════════════════════════════════════════════════
   2. PAYMENT METHOD — ส่งวิธีชำระไปจอลูกค้า
════════════════════════════════════════════════════════════════ */

function _v24MethodAfter(method) {
  if (typeof v12State === 'undefined') return;
  const payAmt = v12State.paymentType === 'deposit'
    ? (v12State.depositAmount || v12State.total)
    : v12State.total;

  const msg = { type: 'payment_method', method: method, total: payAmt };

  // For transfer, try to generate QR payload
  if (method === 'transfer' && typeof getShopConfig === 'function') {
    getShopConfig().then(function (rc) {
      if (rc?.promptpay_number && typeof generatePromptPayPayload === 'function') {
        msg.qrPayload = generatePromptPayPayload(rc.promptpay_number, payAmt);
        msg.qrLabel = 'พร้อมเพย์ ' + rc.promptpay_number;
      }
      _v24Send(msg);
    }).catch(function () { _v24Send(msg); });
  } else {
    _v24Send(msg);
  }
}

_v24Patch('v13SetMethod', _v24MethodAfter);
_v24Patch('_skSetMethod', _v24MethodAfter);
_v24Patch('v12SetMethod', _v24MethodAfter);


/* ════════════════════════════════════════════════════════════════
   3. CASH COUNTING — ส่งยอดรับ/ทอนไปจอลูกค้าแบบ real-time
   
   ปัญหาเดิม: patch v12DenomUp ซึ่งไม่มีอยู่จริง!
   
   ฟังก์ชันจริงที่ต้อง patch:
   - v14: v14AddRecv, v14RemRecv, v14SetExact, v14ClearReceive  → เรียก v14UpdateRecvUI
   - v13: v13AddDenom, v13RemoveDenom, v13SetExact, v13ClearDenoms → เรียก v13UpdateCashUI
   - v12: v12AddDenom, v12RemoveDenom, v12SetExact, v12ClearDenoms → เรียก v12UpdateCashDisplay
   
   วิธีที่ดีที่สุด: patch ตัว UI update function เลย
   เพราะมันถูกเรียกหลังทุกการเปลี่ยนแปลง denomination
════════════════════════════════════════════════════════════════ */

function _v24CalcAndSendCash() {
  if (typeof v12State === 'undefined') return;
  // Get all denomination definitions
  var allD;
  if (typeof V14_ALL !== 'undefined') allD = V14_ALL;
  else if (typeof V13_ALL_DENOMS !== 'undefined') allD = V13_ALL_DENOMS;
  else if (typeof V13_ALL !== 'undefined') allD = V13_ALL;
  else allD = [
    { value: 1000 }, { value: 500 }, { value: 100 }, { value: 50 }, { value: 20 },
    { value: 10 }, { value: 5 }, { value: 2 }, { value: 1 }
  ];

  var received = 0;
  allD.forEach(function (d) {
    received += d.value * (v12State.receivedDenominations?.[d.value] || 0);
  });

  var payAmt = v12State.paymentType === 'deposit'
    ? (v12State.depositAmount || v12State.total)
    : v12State.total;
  var change = Math.max(0, received - payAmt);

  _v24Send({
    type: 'cash_update',
    total: payAmt,
    received: received,
    change: change,
    method: 'cash'
  });
}

// Patch the UI update functions (called after every denomination change)
_v24Patch('v14UpdateRecvUI', _v24CalcAndSendCash);
_v24Patch('v13UpdateCashUI', _v24CalcAndSendCash);
_v24Patch('v12UpdateCashDisplay', _v24CalcAndSendCash);

// Also patch the individual functions as backup (in case UI update names changed)
var _v24DenomFns = [
  'v14AddRecv', 'v14RemRecv', 'v14SetExact', 'v14ClearReceive',
  'v13AddDenom', 'v13RemoveDenom', 'v13SetExact', 'v13ClearDenoms',
  'v12AddDenom', 'v12RemoveDenom', 'v12SetExact', 'v12ClearDenoms'
];

_v24DenomFns.forEach(function (fn) {
  _v24Patch(fn, _v24CalcAndSendCash);
});


/* ════════════════════════════════════════════════════════════════
   4. CHANGE GIVEN — ส่งแบงค์ทอนที่พนักงานนับเอง (ไม่ใช่ auto-calc)
   ข้อมูลมาจาก v14State.changeGiven (พนักงานกดเลือกจากลิ้นชัก)
════════════════════════════════════════════════════════════════ */

function _v24SendChangeGiven() {
  // Read actual denominations the cashier picked
  var cg = (typeof v14State !== 'undefined' && v14State.changeGiven) ? v14State.changeGiven : null;
  if (!cg) return;

  var allD = typeof V14_ALL !== 'undefined' ? V14_ALL
    : typeof V13_ALL_DENOMS !== 'undefined' ? V13_ALL_DENOMS
    : [{ value: 1000 }, { value: 500 }, { value: 100 }, { value: 50 }, { value: 20 },
       { value: 10 }, { value: 5 }, { value: 2 }, { value: 1 }];

  var givenTotal = 0;
  var denomMap = {};
  allD.forEach(function (d) {
    var cnt = cg[d.value] || 0;
    if (cnt > 0) {
      denomMap[d.value] = cnt;
      givenTotal += d.value * cnt;
    }
  });

  _v24Send({
    type: 'change_given',
    denominations: denomMap,
    givenTotal: givenTotal
  });
}

// Patch v14UpdateGivenUI — called every time cashier adds/removes change denomination
_v24Patch('v14UpdateGivenUI', _v24SendChangeGiven);

// Patch individual given functions as backup
['v14AddGiven', 'v14RemGiven', 'v14ResetGiven'].forEach(function (fn) {
  _v24Patch(fn, _v24SendChangeGiven);
});


/* ════════════════════════════════════════════════════════════════
   5. STEP 5 ENTRY — เมื่อเข้าหน้านับแบงค์ส่งจอเริ่มต้น
════════════════════════════════════════════════════════════════ */
_v24Patch('v12S5', function () {
  if (typeof v12State === 'undefined') return;
  var payAmt = v12State.paymentType === 'deposit'
    ? (v12State.depositAmount || v12State.total)
    : v12State.total;
  _v24Send({
    type: 'cash_update',
    total: payAmt,
    received: 0,
    change: 0,
    method: 'cash'
  });
});


/* ════════════════════════════════════════════════════════════════
   5. CLOSE CHECKOUT — กลับจอ idle (ไม่ส่งถ้ากำลัง thanks)
════════════════════════════════════════════════════════════════ */
(function () {
  function tryPatch() {
    if (typeof window.closeCheckout !== 'function') {
      setTimeout(tryPatch, 500);
      return;
    }
    if (window.closeCheckout._v24d) return;
    var _orig = window.closeCheckout;
    window.closeCheckout = function () {
      _orig.apply(this, arguments);
      // Only send idle if NOT completing a sale
      if (typeof v12State !== 'undefined' && !v12State.savedBill) {
        _v24Send({ type: 'idle' });
      }
    };
    window.closeCheckout._v24d = true;
  }
  tryPatch();
  setTimeout(tryPatch, 500);
  setTimeout(tryPatch, 2000);
})();


/* ════════════════════════════════════════════════════════════════
   6. START CHECKOUT — ส่ง cart เมื่อเปิดหน้า checkout
════════════════════════════════════════════════════════════════ */
_v24Patch('startCheckout', function () {
  if (typeof cart !== 'undefined' && typeof getCartTotal === 'function') {
    _v24Send({ type: 'cart', cart: cart, total: getCartTotal() });
  }
});


/* ════════════════════════════════════════════════════════════════
   7. SAFETY NET — ดัก v12State.customer เปลี่ยนจากที่ไหนก็ตาม
   ใช้ polling เช็คทุก 2 วินาทีว่าลูกค้าเปลี่ยนหรือยัง
════════════════════════════════════════════════════════════════ */
(function () {
  var lastCustName = '';
  var lastMethod = '';

  setInterval(function () {
    if (typeof v12State === 'undefined') return;

    // ── ซิงค์ชื่อลูกค้า ──
    var currName = v12State.customer?.name || '';
    if (currName && currName !== lastCustName) {
      lastCustName = currName;
      _v24Send({
        type: 'customer',
        name: currName,
        customerType: v12State.customer?.type || 'member'
      });
    }

    // ── ซิงค์วิธีชำระ (กรณี patch ไม่ทัน) ──
    var currMethod = v12State.method || '';
    if (currMethod && currMethod !== lastMethod && v12State.step >= 4) {
      lastMethod = currMethod;
      var payAmt = v12State.paymentType === 'deposit'
        ? (v12State.depositAmount || v12State.total)
        : v12State.total;
      _v24Send({ type: 'payment_method', method: currMethod, total: payAmt });
    }

    // Reset on checkout close
    if (v12State.step === 1 && v12State.savedBill === null) {
      lastCustName = '';
      lastMethod = '';
    }
  }, 2000);
})();


/* ════════════════════════════════════════════════════════════════
   LOG
════════════════════════════════════════════════════════════════ */
console.info(
  '%c[v24-display] ✅%c Fixed: customer sync | payment method | cash real-time | change_given from cashier | polling safety net',
  'color:#DC2626;font-weight:900', 'color:#6B7280'
);
