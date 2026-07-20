/**
 * SK POS — modules-v92-cancel-deposit-delivery-fix.js
 * ──────────────────────────────────────────────────────────────
 *  แก้บั๊ก:
 *  1) ยกเลิกบิลที่มีมัดจำ — ไม่คืนมัดจำให้ลูกค้า, บิลยังโผล่ในคิวจัดส่ง
 *  2) บิลที่ชำระครบแล้ว — ยังขึ้น badge "ให้ชำระ/เก็บปลายทาง" ในหน้าคิวจัดส่ง
 *
 *  วิธีแก้: wrap cancelBill / v12DQFilter / v12DQRenderCards (badge)
 * ──────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  const BILL_TABLE = 'บิลขาย';
  const cancelInFlight = (() => {
    if (window.__v92CancelInFlight instanceof Map) return window.__v92CancelInFlight;
    window.__v92CancelInFlight = new Map();
    return window.__v92CancelInFlight;
  })();
  const refundPromptByBill = window.__v92RefundPromptByBill || (window.__v92RefundPromptByBill = new Map());
  const num = v => { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; };
  const fmt = v => {
    try { return typeof formatNum === 'function' ? formatNum(v) : num(v).toLocaleString('th-TH'); }
    catch (_) { return num(v).toLocaleString('th-TH'); }
  };
  const effectiveTotal = b => num(b?.return_info?.new_total ?? b?.total);
  const isProjectBill = b => {
    if (!b) return false;
    const text = `${b.method || ''} ${b.status || ''} ${b.customer_name || ''} ${b.note || ''}`;
    return !!b.project_id || /\u0e42\u0e04\u0e23\u0e07\u0e01\u0e32\u0e23/.test(text);
  };

  /* ─────────────────────────────────────────────────────────────
     1) WRAP cancelBill
        - ก่อน original: เก็บ deposit_amount + total + method ไว้
        - หลัง original (สถานะกลายเป็น "ยกเลิก"):
            • คืนเงินมัดจำเข้ากะ (ถามวิธีคืน: เงินสด/โอน)
            • ปรับ debt_amount ลูกค้าให้ถูก
            • อัปเดต delivery_status = 'ยกเลิก' → คิวจัดส่งหายทันที
  ───────────────────────────────────────────────────────────── */
  function injectRefundStyle() {
    if (document.getElementById('v92-refund-style')) return;
    const s = document.createElement('style');
    s.id = 'v92-refund-style';
    s.textContent = `
      .v92-refund-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);
        z-index:99999;display:flex;align-items:center;justify-content:center;animation:v92fade .2s ease}
      @keyframes v92fade{from{opacity:0}to{opacity:1}}
      @keyframes v92up{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}
      .v92-refund-card{background:#fff;border-radius:20px;width:min(460px,92vw);max-height:90vh;overflow:auto;
        box-shadow:0 30px 60px -15px rgba(0,0,0,.35);font-family:Prompt,sans-serif;animation:v92up .3s cubic-bezier(.16,1,.3,1)}
      .v92-refund-head{padding:22px 24px 16px;background:linear-gradient(135deg,#fef3c7,#fed7aa);border-radius:20px 20px 0 0;text-align:center}
      .v92-refund-head .ic{display:inline-flex;width:54px;height:54px;border-radius:50%;background:#fff;
        align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.08);margin-bottom:10px}
      .v92-refund-head .ic i{font-size:30px;color:#d97706}
      .v92-refund-head h2{margin:0;font-size:19px;font-weight:800;color:#7c2d12}
      .v92-refund-head p{margin:4px 0 0;font-size:12px;color:#9a3412;font-weight:600}
      .v92-refund-body{padding:18px 22px 22px}
      .v92-info-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;
        background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;margin-bottom:14px}
      .v92-info-row .lb{font-size:12px;color:#92400e;font-weight:600}
      .v92-info-row .vl{font-size:22px;font-weight:900;color:#b45309}
      .v92-method-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px}
      .v92-method-btn{border:2px solid #e5e7eb;background:#fff;border-radius:12px;padding:14px 8px;
        cursor:pointer;text-align:center;transition:all .15s;font-family:inherit;display:flex;
        flex-direction:column;align-items:center;gap:4px}
      .v92-method-btn:hover{border-color:#cbd5e1;transform:translateY(-1px)}
      .v92-method-btn.active{border-color:#10b981;background:#ecfdf5;box-shadow:0 4px 12px rgba(16,185,129,.18)}
      .v92-method-btn[data-m="โอนเงิน"].active{border-color:#3b82f6;background:#eff6ff;box-shadow:0 4px 12px rgba(59,130,246,.18)}
      .v92-method-btn[data-m="ไม่คืน"].active{border-color:#dc2626;background:#fef2f2;box-shadow:0 4px 12px rgba(220,38,38,.18)}
      .v92-method-btn i{font-size:22px}
      .v92-method-btn .lbl{font-size:12px;font-weight:700;color:#374151}
      .v92-amount-wrap{margin-bottom:14px}
      .v92-amount-wrap label{font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:6px}
      .v92-amount-input{width:100%;border:2px solid #e5e7eb;border-radius:10px;padding:12px 14px;
        font-size:18px;font-weight:800;text-align:right;font-family:inherit;color:#0f172a;outline:none}
      .v92-amount-input:focus{border-color:#10b981}
      .v92-note{font-size:11px;color:#64748b;margin:0 0 14px;line-height:1.5;padding:8px 12px;
        background:#f8fafc;border-radius:8px;border-left:3px solid #94a3b8}
      .v92-note.cash{border-left-color:#10b981;background:#ecfdf5;color:#065f46}
      .v92-note.transfer{border-left-color:#3b82f6;background:#eff6ff;color:#1e3a8a}
      .v92-note.keep{border-left-color:#dc2626;background:#fef2f2;color:#7f1d1d}
      .v92-btn-row{display:flex;gap:8px}
      .v92-btn{flex:1;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;
        cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}
      .v92-btn.cancel{background:#f1f5f9;color:#475569}
      .v92-btn.cancel:hover{background:#e2e8f0}
      .v92-btn.ok{background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 4px 12px rgba(16,185,129,.3)}
      .v92-btn.ok:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(16,185,129,.4)}
    `;
    document.head.appendChild(s);
  }

  function refundDepositPrompt(bill) {
    const promptKey = String(bill?.id || bill?.bill_no || '');
    if (promptKey && refundPromptByBill.has(promptKey)) return refundPromptByBill.get(promptKey);

    const promptPromise = new Promise(resolve => {
      const deposit = num(bill.deposit_amount);
      if (deposit <= 0) { resolve(null); return; }

      injectRefundStyle();

      const ov = document.createElement('div');
      ov.className = 'v92-refund-ov';
      let method = 'เงินสด';
      let amount = deposit;

      const noteFor = m => {
        if (m === 'เงินสด') return { cls: 'cash', text: '💡 จะเปิดหน้านับแบงค์/เหรียญที่จะคืนจากลิ้นชัก ตัวเลขจะตรงกับลิ้นชักเป๊ะ' };
        if (m === 'โอนเงิน') return { cls: 'transfer', text: '💡 โอนเงินคืนผ่านบัญชีลูกค้า ระบบจะบันทึกรายการแต่ไม่หักจากลิ้นชัก' };
        return { cls: 'keep', text: '⚠ ไม่คืนเงินมัดจำ (ยึดมัดจำเป็นค่าเสียหาย/ค่าจอง)' };
      };

      const render = () => {
        const nt = noteFor(method);
        ov.innerHTML = `
          <div class="v92-refund-card">
            <div class="v92-refund-head">
              <div class="ic"><i class="material-icons-round">savings</i></div>
              <h2>คืนมัดจำให้ลูกค้า</h2>
              <p>บิล #${bill.bill_no} · ${bill.customer_name || 'ลูกค้าทั่วไป'}</p>
            </div>
            <div class="v92-refund-body">
              <div class="v92-info-row">
                <span class="lb">มัดจำที่ลูกค้าจ่ายมา</span>
                <span class="vl">฿${fmt(deposit)}</span>
              </div>
              <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:8px">วิธีคืน</label>
              <div class="v92-method-grid">
                <button class="v92-method-btn ${method==='เงินสด'?'active':''}" data-m="เงินสด">
                  <i class="material-icons-round" style="color:#10b981">payments</i>
                  <span class="lbl">เงินสด</span>
                </button>
                <button class="v92-method-btn ${method==='โอนเงิน'?'active':''}" data-m="โอนเงิน">
                  <i class="material-icons-round" style="color:#3b82f6">qr_code_2</i>
                  <span class="lbl">โอนเงิน</span>
                </button>
                <button class="v92-method-btn ${method==='ไม่คืน'?'active':''}" data-m="ไม่คืน">
                  <i class="material-icons-round" style="color:#dc2626">block</i>
                  <span class="lbl">ไม่คืน</span>
                </button>
              </div>
              ${method !== 'ไม่คืน' ? `
                <div class="v92-amount-wrap">
                  <label>จำนวนที่คืน (สูงสุด ฿${fmt(deposit)})</label>
                  <input type="number" class="v92-amount-input" id="v92-amt"
                         value="${amount}" min="0" max="${deposit}" step="0.01">
                </div>
              ` : ''}
              <p class="v92-note ${nt.cls}">${nt.text}</p>
              <div class="v92-btn-row">
                <button class="v92-btn cancel" id="v92-cancel">
                  <i class="material-icons-round" style="font-size:18px">close</i> ข้าม
                </button>
                <button class="v92-btn ok" id="v92-ok">
                  <i class="material-icons-round" style="font-size:18px">check_circle</i>
                  ${method === 'เงินสด' ? 'ถัดไป: นับเงิน →' : method === 'ไม่คืน' ? 'ยึดมัดจำ' : 'ยืนยันคืน'}
                </button>
              </div>
            </div>
          </div>`;

        ov.querySelectorAll('.v92-method-btn').forEach(btn => {
          btn.onclick = () => { method = btn.dataset.m; render(); };
        });
        const amtEl = ov.querySelector('#v92-amt');
        if (amtEl) amtEl.oninput = e => { amount = num(e.target.value); };
        ov.querySelector('#v92-cancel').onclick = () => { close(); resolve(null); };
        ov.querySelector('#v92-ok').onclick = async () => {
          if (method === 'ไม่คืน') { close(); resolve({ method, amount: 0 }); return; }
          if (amount <= 0 || amount > deposit) {
            const inp = ov.querySelector('#v92-amt');
            if (inp) { inp.style.borderColor = '#dc2626'; inp.focus(); }
            return;
          }
          if (method === 'เงินสด') {
            // เปิด wizard นับแบงค์/เหรียญที่จะคืน
            close();
            const counts = await openCashRefundWizard(bill, amount);
            if (!counts) { resolve(null); return; }
            resolve({ method, amount, denominations: counts });
          } else {
            close();
            resolve({ method, amount });
          }
        };
      };

      const close = () => {
        ov.remove();
        document.removeEventListener('keydown', onKey);
        if (promptKey) refundPromptByBill.delete(promptKey);
      };
      const onKey = e => { if (e.key === 'Escape') { close(); resolve(null); } };
      document.addEventListener('keydown', onKey);

      render();
      document.body.appendChild(ov);
    });
    if (promptKey) refundPromptByBill.set(promptKey, promptPromise);
    return promptPromise;
  }

  /* เปิด wizard นับแบงค์ที่จะคืน (เชื่อม v32ShowDenomWizard + drawer) */
  async function openCashRefundWizard(bill, amount) {
    if (typeof window.v32ShowDenomWizard !== 'function') {
      // fallback — ไม่มี wizard ให้ใช้
      return { _noWizard: true };
    }
    let drawer = null;
    try {
      if (typeof window.v32LoadDrawer === 'function') {
        drawer = await window.v32LoadDrawer();
      }
    } catch (_) {}

    const counts = await window.v32ShowDenomWizard({
      title: 'คืนมัดจำ — นับเงินที่จะคืน',
      subtitle: `บิล #${bill.bill_no} · นับธนบัตร/เหรียญที่จะหยิบออกจากลิ้นชักให้ลูกค้า`,
      icon: '<i class="material-icons-round">savings</i>',
      drawer: drawer,
      targetAmount: amount,
      mustBeExact: true,
      dir: 'out',
      confirmText: 'ยืนยันคืนเงิน ✓',
      cancelText: 'ย้อนกลับ',
    });
    return counts || null;
  }

  async function recordDepositRefund(bill, refund) {
    if (!refund || refund.amount <= 0 || refund.method === 'ไม่คืน') return;
    const staff = (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown';
    const nowIso = new Date().toISOString();
    const desc = `คืนมัดจำ บิล #${bill.bill_no}${bill.customer_name ? ' — ' + bill.customer_name : ''}`;

    try {
      // (1) cash_transaction — หักออกจากลิ้นชัก (เฉพาะเงินสด)
      if (refund.method === 'เงินสด') {
        const { data: s } = await db.from('cash_session')
          .select('id').eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1).maybeSingle();
        if (s) {
          const insertObj = {
            session_id: s.id,
            type: 'คืนมัดจำ-ยกเลิกบิล',
            direction: 'out',
            amount: refund.amount,
            net_amount: refund.amount,
            balance_after: 0,
            staff_name: staff,
            note: desc,
            ref_id: bill.id,
            ref_table: BILL_TABLE,
          };
          if (refund.denominations && !refund.denominations._noWizard) {
            insertObj.denominations = refund.denominations;
          }
          const { error } = await db.from('cash_transaction').insert(insertObj);
          if (error && /column.*ref_id|column.*ref_table/.test(error.message || '')) {
            delete insertObj.ref_id; delete insertObj.ref_table;
            await db.from('cash_transaction').insert(insertObj);
          }
          try { window.renderCashDrawer?.(); } catch (_) {}
        }
      }

      // (2) รายจ่าย — ให้ dashboard/วิเคราะห์ธุรกิจมองเห็นเป็น cash out ของวันนี้
      //     (เพราะ bill ที่ยกเลิกแล้วถูก filter ออกจาก revenue → ต้องบันทึกฝั่งจ่ายแทน)
      try {
        const expenseObj = {
          description: desc,
          amount: refund.amount,
          category: 'คืนมัดจำ',
          method: refund.method,
          date: nowIso,
          note: `ยกเลิกบิล — คืนมัดจำให้ลูกค้า (${refund.method})`,
          staff_name: staff,
        };
        const r = await db.from('รายจ่าย').insert(expenseObj);
        if (r.error) {
          console.warn('[v92] insert รายจ่าย failed (1st try):', r.error);
          // เผื่อ schema ไม่มีบางคอลัมน์ — ลบทีละตัวแล้วลองใหม่
          const fallback = { description: desc, amount: refund.amount, category: 'คืนมัดจำ', date: nowIso };
          const r2 = await db.from('รายจ่าย').insert(fallback);
          if (r2.error) console.error('[v92] insert รายจ่าย FAILED (fallback also):', r2.error);
          else console.log('[v92] insert รายจ่าย (fallback) OK ฿' + refund.amount);
        } else {
          console.log('[v92] insert รายจ่าย OK ฿' + refund.amount + ' category=คืนมัดจำ');
        }
      } catch (e) {
        console.warn('[v92] insert รายจ่าย exception:', e);
      }

      if (typeof logActivity === 'function') {
        logActivity('คืนมัดจำ', `บิล #${bill.bill_no} ฿${fmt(refund.amount)} (${refund.method})`,
          bill.id, BILL_TABLE);
      }

      // refresh dashboard ถ้ากำลังเปิดอยู่
      try { window.renderDashboardV3?.(); } catch (_) {}
    } catch (e) {
      console.warn('[v92] recordDepositRefund:', e);
    }
  }

  async function fixCustomerDebtAfterCancel(bill) {
    if (!bill.customer_id) return;
    try {
      const { data: c } = await db.from('customer')
        .select('debt_amount').eq('id', bill.customer_id).maybeSingle();
      if (!c) return;
      // v20.cancelBill ลด debt = bill.total เฉพาะ method ค้าง...
      // สำหรับบิลมัดจำ ค้างจริง = total - deposit_amount
      // ถ้า v20 ยังไม่ได้ลด (method ไม่ใช่ค้างชำระ/ค้างเครดิต) แต่บิลค้างจริง → ลดเพิ่ม
      const realDebt = Math.max(0, effectiveTotal(bill) - num(bill.deposit_amount));
      if (realDebt <= 0) return;
      const alreadyReduced = ['ค้างชำระ', 'ค้างเครดิต'].includes(bill.method);
      if (alreadyReduced) return; // v20 จัดการแล้ว (และยังลดเกินด้วยซ้ำ — แต่ไม่กล้าแก้ legacy)
      // ลดเฉพาะกรณีบิลมัดจำที่ method=เงินสด/โอน → ยังเหลือยอดค้าง
      if (num(bill.deposit_amount) > 0 && num(bill.deposit_amount) < effectiveTotal(bill)) {
        await db.from('customer')
          .update({ debt_amount: Math.max(0, num(c.debt_amount) - realDebt) })
          .eq('id', bill.customer_id);
      }
    } catch (e) {
      console.warn('[v92] fixCustomerDebtAfterCancel:', e);
    }
  }

  async function clearDeliveryStatusOnCancel(billId) {
    try {
      await db.from(BILL_TABLE)
        .update({ delivery_status: 'ยกเลิก' })
        .eq('id', billId);
    } catch (e) {
      console.warn('[v92] clearDeliveryStatusOnCancel:', e);
    }
  }

  async function refreshDebtAfterCancel() {
    try {
      if (typeof window.v68SyncCustomerTotals === 'function') {
        await window.v68SyncCustomerTotals(true);
      }
    } catch (e) {
      console.warn('[v92] refreshDebtAfterCancel sync:', e);
    }
    try {
      if (typeof window.v68RenderDebts === 'function') {
        await window.v68RenderDebts({ silent: true });
      } else if (typeof window.renderDebts === 'function') {
        await window.renderDebts({ silent: true });
      }
    } catch (e) {
      console.warn('[v92] refreshDebtAfterCancel render:', e);
    }
  }

  function patchCancelBill() {
    // กันการ wrap ซ้ำเมื่อ install() ถูกเรียกหลายรอบ (DOMContentLoaded + setTimeout x3)
    // และเมื่อ v79 ทำ wrap ทับ v92 ภายหลัง — chain จะโตเรื่อย ๆ ถ้าไม่กัน
    if (window.__v92CancelInstalledOnce) return;
    const original = window.cancelBill;
    if (typeof original !== 'function') return;
    if (original.__v92DepositFix) { window.__v92CancelInstalledOnce = true; return; }

    const wrapped = async function (billId, ...args) {
      const cancelKey = String(billId || '');
      // re-entrant guard: ถ้ามี v79 wrap ทับ v92 แล้วเรียก v92 ซ้อน → call-through ไม่ใช่คืน promise เดิม
      // (คืน promise เดิมจะ deadlock เพราะ outer กำลัง await chain ที่ resolve ผ่าน inner นี้)
      if (cancelKey && cancelInFlight.has(cancelKey)) {
        return original.call(this, billId, ...args);
      }

      const runCancel = (async () => {
        let beforeBill = null;
        try {
          try {
            const { data } = await db.from(BILL_TABLE).select('*').eq('id', billId).maybeSingle();
            beforeBill = data || null;
          } catch (_) {}

          let refundChoice = null;
          const hasDeposit = beforeBill && num(beforeBill.deposit_amount) > 0
            && !/ยกเลิก/.test(String(beforeBill.status || ''));

          const result = await original.call(this, billId, ...args);

          // ตรวจว่าจริง ๆ บิลถูกยกเลิกแล้วหรือยัง
          let afterStatus = '';
          try {
            const { data } = await db.from(BILL_TABLE).select('status').eq('id', billId).maybeSingle();
            afterStatus = String(data?.status || '');
          } catch (_) {}
          if (!/ยกเลิก/.test(afterStatus)) return result; // user cancel popup — ไม่ต้องทำต่อ

          // ถ้าบิลถูกยกเลิกแล้วค่อยถามคืนมัดจำ จะได้ไม่ค้างก่อนบันทึกยกเลิก
          if (hasDeposit) {
            refundChoice = await refundDepositPrompt(beforeBill);
          }

          // 1) คืนมัดจำ + log
          if (refundChoice && refundChoice.amount > 0) {
            await recordDepositRefund(beforeBill, refundChoice);
            try { toast?.(`คืนมัดจำ ฿${fmt(refundChoice.amount)} (${refundChoice.method}) สำเร็จ`, 'success'); } catch (_) {}
          }

          // 2) ลด debt ลูกค้าให้ถูก (สำหรับบิลมัดจำ method เงินสด/โอน)
          await fixCustomerDebtAfterCancel(beforeBill);

          // 3) clear delivery queue
          await clearDeliveryStatusOnCancel(billId);
          await refreshDebtAfterCancel();

          // refresh UI
          try { window.v12BMCLoad?.(); } catch (_) {}
          try { window.v12DQFilter?.(window.v12DQCurrentFilter || 'today'); } catch (_) {}
          try { window.renderDelivery?.(); } catch (_) {}
          try { await window.refreshDeliveryBadge?.(); } catch (_) {}

          return result;
        } finally {
          if (cancelKey && cancelInFlight.get(cancelKey) === runCancel) cancelInFlight.delete(cancelKey);
        }
      })();

      if (cancelKey) cancelInFlight.set(cancelKey, runCancel);
      return runCancel;
    };
    Object.defineProperty(wrapped, '__v92DepositFix', { value: true });
    window.cancelBill = wrapped;
    try { cancelBill = wrapped; } catch (_) {}
    window.__v92CancelInstalledOnce = true;
  }

  /* ─────────────────────────────────────────────────────────────
     2) PATCH v12DQFilter
        เพิ่ม status !== 'ยกเลิก' ลงใน condition แรก
        (เงื่อนไขปัจจุบัน: delivery_status==='รอจัดส่ง' ตรงๆ ไม่เช็ค status)
  ───────────────────────────────────────────────────────────── */
  function patchDQFilter() {
    const original = window.v12DQFilter;
    if (typeof original !== 'function' || original.__v92CancelFilter) return;

    const wrapped = async function (filter) {
      // เรียก original แล้วจัดการ DOM/filter ใหม่อีกชั้น
      await original.call(this, filter);
      try {
        // ลบการ์ดของบิลที่ status='ยกเลิก' ออก (กันหลุดจาก first-condition)
        const area = document.getElementById('dq-cards-area');
        if (!area) return;
        const cards = area.querySelectorAll('.v12-dq-card');
        if (!cards.length) return;
        const ids = Array.from(cards).map(c => c.id.replace('dq-card-', ''));
        if (!ids.length) return;
        const { data: bills } = await db.from(BILL_TABLE)
          .select('id,status').in('id', ids);
        const cancelled = new Set((bills || [])
          .filter(b => /ยกเลิก/.test(String(b.status || '')))
          .map(b => String(b.id)));
        if (!cancelled.size) return;
        cards.forEach(c => {
          const id = c.id.replace('dq-card-', '');
          if (cancelled.has(id)) c.remove();
        });
        // ปรับเลข badge
        const remaining = area.querySelectorAll('.v12-dq-card').length;
        const cntWait = document.getElementById('dq-count-wait');
        if (cntWait) {
          const cur = num(cntWait.textContent);
          cntWait.textContent = Math.max(0, cur - cancelled.size);
        }
        const badge = document.getElementById('delivery-count-badge');
        if (badge) {
          const cur = num(badge.textContent);
          const newCnt = Math.max(0, cur - cancelled.size);
          badge.textContent = newCnt;
          badge.classList.toggle('hidden', newCnt === 0);
        }
        if (!area.querySelectorAll('.v12-dq-card').length) {
          area.innerHTML = `<div class="v12-dq-empty">
            <i class="material-icons-round">local_shipping</i>
            <p>ไม่มีคิวส่งของ</p>
          </div>`;
        }
      } catch (e) {
        console.warn('[v92] patchDQFilter post-clean:', e);
      }
    };
    Object.defineProperty(wrapped, '__v92CancelFilter', { value: true });
    window.v12DQFilter = wrapped;
  }

  /* ─────────────────────────────────────────────────────────────
     3) PATCH payment badge บนการ์ดคิวจัดส่ง
        ตรวจ deposit_amount >= effectiveTotal → "ชำระแล้ว"
        แม้ status จะเป็น 'รอจัดส่ง' หรือ 'ชำระหน้างาน'
  ───────────────────────────────────────────────────────────── */
  /* badge cache: id → {status, deposit_amount, total, return_info} */
  const _billCache = new Map();
  let _lastFetchAt = 0;

  async function fetchBillsForCards(ids) {
    if (!ids.length) return [];
    // cache 3 วินาที กันยิง DB รัวๆ
    const stale = (Date.now() - _lastFetchAt) > 3000;
    const missing = ids.filter(id => !_billCache.has(id));
    if (stale || missing.length) {
      try {
        const { data } = await db.from(BILL_TABLE)
          .select('id,status,method,customer_name,project_id,note,deposit_amount,received,total,return_info,delivery_status,delivery_mode')
          .in('id', ids);
        (data || []).forEach(b => _billCache.set(String(b.id), b));
        _lastFetchAt = Date.now();
      } catch (e) { console.warn('[v92] fetchBills:', e); }
    }
    return ids.map(id => _billCache.get(String(id))).filter(Boolean);
  }

  function rebuildCardBadge(card, b) {
    if (!card || !b) return;
    const headerLeft = card.querySelector('.v12-dq-card-header > div');
    if (!headerLeft) return;

    // ลบ badge ที่เกี่ยวข้องกับสถานะชำระทั้งหมด (จะ replace ใหม่)
    headerLeft.querySelectorAll('span').forEach(s => {
      const txt = s.textContent || '';
      // ข้าม bill-badge (เลขบิล)
      if (s.classList.contains('v12-dq-bill-badge')) return;
      if (/เก็บเงินปลายทาง|เก็บปลายทาง|ชำระแล้ว|ค้างชำระ|มัดจำ|รอชำระ/.test(txt)
          || s.getAttribute('data-v92-badge') === '1') {
        s.remove();
      }
    });

    const total = effectiveTotal(b);
    const paid = num(b.deposit_amount);
    const remaining = Math.max(0, total - paid);
    const span = document.createElement('span');
    span.setAttribute('data-v92-badge', '1');
    span.style.cssText = 'padding:3px 8px;border-radius:6px;font-size:10.5px;font-weight:700;border:1px solid;display:inline-flex;align-items:center;gap:3px;width:fit-content;line-height:1.2';

    if (isProjectBill(b)) {
      span.style.background = '#eef2ff';
      span.style.color = '#4338ca';
      span.style.borderColor = '#c7d2fe';
      span.innerHTML = `<i class="material-icons-round" style="font-size:12px">business_center</i>โครงการ`;
    } else if (total > 0 && remaining < 0.01) {
      // ชำระครบแล้ว
      span.style.background = '#ecfdf5';
      span.style.color = '#047857';
      span.style.borderColor = '#6ee7b7';
      span.innerHTML = `<i class="material-icons-round" style="font-size:12px">check_circle</i>ชำระแล้ว`;
    } else if (paid > 0 && paid < total) {
      // มีมัดจำแต่ยังค้าง
      span.style.background = '#fff7ed';
      span.style.color = '#c2410c';
      span.style.borderColor = '#fdba74';
      span.innerHTML = `<i class="material-icons-round" style="font-size:12px">savings</i>มัดจำ ฿${fmt(paid)} · ค้าง ฿${fmt(remaining)}`;
    } else if (b.status === 'ชำระหน้างาน') {
      span.style.background = '#fffbeb';
      span.style.color = '#d97706';
      span.style.borderColor = '#fcd34d';
      span.innerHTML = `<i class="material-icons-round" style="font-size:12px">local_atm</i>เก็บปลายทาง ฿${fmt(total)}`;
    } else if (remaining > 0) {
      span.style.background = '#fef2f2';
      span.style.color = '#b91c1c';
      span.style.borderColor = '#fca5a5';
      span.innerHTML = `<i class="material-icons-round" style="font-size:12px">payments</i>รอชำระ ฿${fmt(remaining)}`;
    } else {
      return; // ไม่ต้องใส่ badge
    }
    headerLeft.appendChild(span);
  }

  function patchPaymentBadge() {
    const refreshBadges = async () => {
      const area = document.getElementById('dq-cards-area');
      if (!area) return;
      const cards = area.querySelectorAll('.v12-dq-card');
      if (!cards.length) return;
      const ids = Array.from(cards).map(c => c.id.replace('dq-card-', ''));
      // force re-fetch (status เพิ่งเปลี่ยน)
      _billCache.clear();
      const bills = await fetchBillsForCards(ids);
      const map = new Map(bills.map(b => [String(b.id), b]));
      cards.forEach(c => {
        const id = c.id.replace('dq-card-', '');
        const b = map.get(id);
        if (b) rebuildCardBadge(c, b);
      });
    };

    const tryObserve = () => {
      const area = document.getElementById('dq-cards-area');
      if (!area) { setTimeout(tryObserve, 500); return; }
      if (area.__v92Observed) return;
      area.__v92Observed = true;
      const mo = new MutationObserver(() => {
        clearTimeout(area.__v92Timer);
        area.__v92Timer = setTimeout(refreshBadges, 100);
      });
      mo.observe(area, { childList: true, subtree: false });
      setTimeout(refreshBadges, 250);
    };
    tryObserve();

    const sec = document.getElementById('page-delivery');
    if (sec && !sec.__v92SectionObserved) {
      sec.__v92SectionObserved = true;
      const moSec = new MutationObserver(() => {
        const area = document.getElementById('dq-cards-area');
        if (area && !area.__v92Observed) tryObserve();
      });
      moSec.observe(sec, { childList: true, subtree: true });
    }

    // expose สำหรับ patch อื่นเรียกใช้
    window.v92RefreshDQBadges = refreshBadges;
  }

  /* ─────────────────────────────────────────────────────────────
     refresh badge ด้านข้าง sidebar (จำนวนคิวจัดส่ง)
  ───────────────────────────────────────────────────────────── */
  window.refreshDeliveryBadge = async function () {
    try {
      const { data } = await db.from(BILL_TABLE)
        .select('id,delivery_status,status')
        .eq('delivery_status', 'รอจัดส่ง')
        .neq('status', 'ยกเลิก');
      const badge = document.getElementById('delivery-count-badge');
      if (!badge) return;
      const n = (data || []).length;
      badge.textContent = n;
      badge.classList.toggle('hidden', n === 0);
    } catch (_) {}
  };

  /* ─────────────────────────────────────────────────────────────
     wrap v20BMCPayDebt → หลังรับชำระ ให้ refresh badge หน้าคิวจัดส่งด้วย
  ───────────────────────────────────────────────────────────── */
  function patchBMCPayDebt() {
    const orig = window.v20BMCPayDebt;
    if (typeof orig !== 'function' || orig.__v92BadgeRefresh) return;
    const wrapped = async function (...args) {
      const r = await orig.apply(this, args);
      try {
        _billCache.clear();
        if (typeof window.v92RefreshDQBadges === 'function') {
          setTimeout(() => window.v92RefreshDQBadges(), 200);
        }
      } catch (_) {}
      return r;
    };
    Object.defineProperty(wrapped, '__v92BadgeRefresh', { value: true });
    window.v20BMCPayDebt = wrapped;
  }

  /* ─────────────────────────────────────────────────────────────
     ตรวจว่าบิลชำระเต็มไปแล้วจริง (เทียบกับ logic ของใบส่งของ v37)
     - status 'สำเร็จ'/'ชำระแล้ว' + method ไม่ใช่ค้าง → ชำระครบ
     - หรือ deposit_amount >= total
     - หรือ received >= total (จ่ายเต็มตอน checkout)
  ───────────────────────────────────────────────────────────── */
  function isBillFullyPaid(bill) {
    if (!bill) return false;
    if (isProjectBill(bill)) return false;
    const total = effectiveTotal(bill);
    if (total <= 0) return true;
    const status = String(bill.status || '');
    const method = String(bill.method || bill.payment_method || '');
    if (/ยกเลิก|คืนสินค้า|cancel/i.test(status)) return false;
    if (/ค้าง|เครดิต|debt|credit/i.test(method)) return false;
    if (/ค้าง|บางส่วน|มัดจำ|debt|partial/i.test(status)) return false;
    const deposit = num(bill.deposit_amount);
    const received = num(bill.received);
    if (deposit >= total - 0.009) return true;
    if (received >= total - 0.009) return true;
    return /สำเร็จ|ชำระแล้ว|จ่ายแล้ว|success|paid/i.test(status);
  }

  /* sync deposit_amount = total เมื่อตรวจพบว่าจ่ายเต็มแล้ว
     ป้องกัน v45/v20 BMCPayDebt + v12DQMarkDone เข้าใจผิดในรอบถัดไป */
  async function healBillPaidFlag(bill) {
    if (!bill || num(bill.deposit_amount) >= effectiveTotal(bill) - 0.009) return;
    if (!isBillFullyPaid(bill)) return;
    try {
      await db.from(BILL_TABLE)
        .update({ deposit_amount: effectiveTotal(bill) })
        .eq('id', bill.id);
    } catch (e) { console.warn('[v92] healBillPaidFlag:', e); }
  }

  /* wrap v20BMCPayDebt อีกชั้น (หลัง v45 wrap)
     ถ้าบิลชำระครบแล้ว → toast บอก แล้วไม่เปิด popup
     และ heal deposit_amount ให้ตรงเพื่อรอบถัดไป */
  function patchBMCPayDebtGuard() {
    const orig = window.v20BMCPayDebt;
    if (typeof orig !== 'function' || orig.__v92PaidGuard) return;
    const wrapped = async function (billId, ...args) {
      try {
        const { data: bill } = await db.from(BILL_TABLE).select('*').eq('id', billId).maybeSingle();
        if (bill && isProjectBill(bill)) {
          try { toast?.('บิลโครงการไม่ต้องรับชำระเงินจากลูกค้า', 'info'); } catch (_) {}
          try { window.v12BMCLoad?.(); } catch (_) {}
          try { window.v12DQFilter?.(window.v12DQCurrentFilter || 'today'); } catch (_) {}
          return;
        }
        if (bill && isBillFullyPaid(bill)) {
          await healBillPaidFlag(bill);
          try { toast?.('บิลนี้ชำระครบแล้ว ไม่ต้องรับชำระเพิ่ม', 'info'); } catch (_) {}
          try { window.v12BMCLoad?.(); } catch (_) {}
          try { window.v12DQFilter?.(window.v12DQCurrentFilter || 'today'); } catch (_) {}
          return;
        }
      } catch (e) { console.warn('[v92] BMCPayDebt guard:', e); }
      return orig.call(this, billId, ...args);
    };
    Object.defineProperty(wrapped, '__v92PaidGuard', { value: true });
    // คง flag เดิมไว้ด้วย เผื่อมีโค้ดอื่นเช็ค
    if (orig.__v92BadgeRefresh) Object.defineProperty(wrapped, '__v92BadgeRefresh', { value: true });
    if (orig.__v45BillPopup) Object.defineProperty(wrapped, '__v45BillPopup', { value: true });
    window.v20BMCPayDebt = wrapped;
    try { v20BMCPayDebt = wrapped; } catch (_) {}
  }

  /* wrap v12DQMarkDone
     - ก่อน mark: ถ้าบิลชำระครบแล้ว → heal deposit_amount, ตัดสิทธิ์ status='ค้างชำระ'
     - ห้าม auto trigger v20BMCPayDebt สำหรับบิลที่ชำระครบแล้ว */
  function patchDQMarkDone() {
    const orig = window.v12DQMarkDone;
    if (typeof orig !== 'function' || orig.__v92PaidGuard) return;
    const wrapped = async function (billId, ...args) {
      try {
        const { data: bill } = await db.from(BILL_TABLE).select('*').eq('id', billId).maybeSingle();
        if (bill && isBillFullyPaid(bill)) {
          // heal ให้ deposit_amount = total ก่อน เพื่อ v12DQMarkDone จะคำนวณ hasRemaining=false
          await healBillPaidFlag(bill);
        }
      } catch (e) { console.warn('[v92] DQMarkDone guard:', e); }
      return orig.call(this, billId, ...args);
    };
    Object.defineProperty(wrapped, '__v92PaidGuard', { value: true });
    window.v12DQMarkDone = wrapped;
  }

  /* ─────────────────────────────────────────────────────────────
     augment dashboard: เพิ่ม "ยอดคืนลูกค้า" ลง KPI + P&L
  ───────────────────────────────────────────────────────────── */
  function getDashRangeIso() {
    // อ่านจากปุ่ม period ที่ active (.dash-v3-btn-per[data-days]) ตามจริง
    const active = document.querySelector('.dash-v3-btn-per.active[data-days]');
    let days = 1;
    if (active) {
      const d = parseInt(active.dataset?.days, 10);
      if (Number.isFinite(d) && d > 0) days = d;
    }
    const now = new Date();
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const start = new Date(now); start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return { startIso: start.toISOString(), endIso: end.toISOString(), days };
  }

  async function fetchRefundTotal(startIso, endIso) {
    let totalFromExpense = 0;
    let totalFromCashTx = 0;
    let expRows = 0, txRows = 0;

    // (1) ดึงจาก รายจ่าย
    try {
      const { data, error } = await db.from('รายจ่าย')
        .select('amount,category,description,date')
        .gte('date', startIso).lte('date', endIso);
      if (error) {
        console.warn('[v92] รายจ่าย query error:', error);
      } else {
        const matched = (data || []).filter(r => {
          const cat = String(r.category || '');
          const desc = String(r.description || '');
          return /คืนมัดจำ|คืนเงินมัดจำ|refund.*deposit/i.test(cat)
              || /คืนมัดจำ|คืนเงินมัดจำ/.test(desc);
        });
        expRows = matched.length;
        totalFromExpense = matched.reduce((s, r) => s + num(r.amount), 0);
      }
    } catch (e) { console.warn('[v92] รายจ่าย exception:', e); }

    // (2) ดึงจาก cash_transaction (ใช้ created_at) — fallback ถ้า รายจ่าย insert ล้มเหลว
    try {
      const { data, error } = await db.from('cash_transaction')
        .select('amount,net_amount,type,note,created_at,direction')
        .gte('created_at', startIso).lte('created_at', endIso);
      if (error) {
        console.warn('[v92] cash_transaction query error:', error);
      } else {
        const matched = (data || []).filter(r => {
          const t = String(r.type || '');
          const n = String(r.note || '');
          return r.direction === 'out' && (/คืนมัดจำ/.test(t) || /คืนมัดจำ/.test(n));
        });
        txRows = matched.length;
        totalFromCashTx = matched.reduce((s, r) => s + (num(r.net_amount) || num(r.amount)), 0);
      }
    } catch (e) { console.warn('[v92] cash_transaction exception:', e); }

    // ใช้ค่าที่มากกว่า (จริง ๆ ควรเท่ากัน แต่ถ้าฝั่งหนึ่งล้มเหลว อย่างน้อยอีกฝั่งช่วยได้)
    // ลำดับความสำคัญ: รายจ่าย (เผื่อมีโอนเงินด้วย) > cash_transaction
    const total = Math.max(totalFromExpense, totalFromCashTx);
    console.log(`[v92] refund total: ฿${total} | รายจ่าย: ฿${totalFromExpense} (${expRows} rows) | cash_transaction: ฿${totalFromCashTx} (${txRows} rows) | range: ${startIso} → ${endIso}`);
    return total;
  }

  /* cache: ไม่ให้ inject ซ้ำถ้าค่าเท่าเดิม กันกระพริบ */
  let _lastInjectedSig = '';

  async function injectRefundOnDashboard() {
    // Dashboard V4 รวมเงินคืนไว้ในสูตร cash-out และยอดสุทธิแล้ว ไม่แทรก DOM ซ้ำ
    if (document.querySelector('#page-dash [data-dashboard-version="4"]')) return;
    const { startIso, endIso, days } = getDashRangeIso();
    const total = await fetchRefundTotal(startIso, endIso);

    // signature = "days|total" — ถ้าเหมือนรอบที่แล้ว และ DOM ยังอยู่ → ไม่ทำอะไร
    const sig = `${days}|${total}`;
    const truthBody = findTruthBody();
    const hasExisting = truthBody?.querySelector('[data-v92-refund-row]');
    if (sig === _lastInjectedSig && (hasExisting || total <= 0)) return;
    _lastInjectedSig = sig;

    // ลบของเก่า (จุดเดียว: ใน truth panel)
    document.querySelectorAll('[data-v92-refund-row], [data-v92-refund-card]').forEach(el => el.remove());

    if (total <= 0) return;
    if (!truthBody) return;

    // insert row สไตล์เดียวกับ dash-v3-ledger-row ใน "ยอดจริงที่ควรดูเป็นหลัก"
    const row = document.createElement('div');
    row.className = 'dash-v3-ledger-row';
    row.setAttribute('data-v92-refund-row', '1');
    row.innerHTML = `
      <div>
        <div class="dash-v3-ledger-label" style="color:#be185d">ยอดคืนลูกค้า (มัดจำ/ยกเลิกบิล)</div>
        <div class="dash-v3-ledger-help">เงินคืนจากบิลที่ยกเลิก/คืนมัดจำในช่วงนี้</div>
      </div>
      <div class="dash-v3-ledger-val" style="color:#ec4899">−฿${fmt(Math.round(total))}</div>`;
    // วางก่อน row total ("เงินจริงรับเข้ารวม") ถ้าเจอ ไม่เจอวางท้าย body
    const totalRow = truthBody.querySelector('.dash-v3-ledger-row.total');
    if (totalRow) totalRow.before(row);
    else truthBody.appendChild(row);
  }

  /* หา body ของพาเนล "ยอดจริงที่ควรดูเป็นหลัก" (อันแรกใน truth-container) */
  function findTruthBody() {
    const container = document.getElementById('dash-v3-truth-container');
    if (!container) return null;
    const firstPanel = container.querySelector('.dash-v3-truth-panel');
    if (!firstPanel) return null;
    return firstPanel.querySelector('.dash-v3-truth-body');
  }

  function bindDashEventsOnce() {
    if (document.__v92DashEventsBound) return;
    document.__v92DashEventsBound = true;
    // ดักคลิกปุ่ม period + refresh เท่านั้น (tab P&L/Cash Flow ไม่กระทบ truth panel)
    document.addEventListener('click', e => {
      const btn = e.target?.closest?.('.dash-v3-btn-per[data-days], #dash-v3-refresh');
      if (!btn) return;
      // reset cache เพราะ period เปลี่ยน → ต้อง inject ใหม่
      _lastInjectedSig = '';
      // รอ dashboard load เสร็จ (skeleton หาย) แล้วค่อย inject — เรียกครั้งเดียวพอ
      setTimeout(injectRefundOnDashboard, 1500);
    }, true);
  }

  /* รอ truth panel โหลดเสร็จ (skeleton หาย) แล้วค่อย inject ครั้งเดียว */
  function waitAndInject(retries = 30) {
    if (document.querySelector('#page-dash [data-dashboard-version="4"]')) return;
    const truthBody = findTruthBody();
    if (!truthBody || truthBody.querySelector('.dash-v3-skeleton')) {
      if (retries > 0) setTimeout(() => waitAndInject(retries - 1), 500);
      return;
    }
    injectRefundOnDashboard();
  }

  /* wrap renderDashboardV3 — trigger inject หลัง dashboard render เสร็จ */
  function patchRenderDashboard() {
    const orig = window.renderDashboardV3;
    if (typeof orig !== 'function' || orig.__v92RefundHook) return;
    const wrapped = function (...args) {
      _lastInjectedSig = ''; // reset เพื่อ inject ใหม่
      const r = orig.apply(this, args);
      waitAndInject();
      return r;
    };
    Object.defineProperty(wrapped, '__v92RefundHook', { value: true });
    window.renderDashboardV3 = wrapped;
  }

  function patchDashboard() {
    bindDashEventsOnce();
    patchRenderDashboard();
    // ถ้าหน้า dashboard เปิดอยู่แล้ว → inject ทันที
    waitAndInject();
  }

  /* expose สำหรับเรียก manual */
  window.v92InjectRefundOnDashboard = injectRefundOnDashboard;

  /* diagnostic helper — เปิด console แล้วพิมพ์ v92Diagnose() เพื่อดูข้อมูลที่มีจริง */
  window.v92Diagnose = async function (daysBack = 30) {
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - daysBack);
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();
    const endIso = now.toISOString();
    console.group(`[v92 Diagnose] ${daysBack} วันย้อนหลัง`);

    // รายจ่าย
    try {
      const { data } = await db.from('รายจ่าย')
        .select('id,date,amount,category,description')
        .gte('date', startIso).lte('date', endIso)
        .order('date', { ascending: false });
      console.log(`📋 รายจ่ายทั้งหมด ${data?.length || 0} รายการ:`, data);
      const refundRows = (data || []).filter(r =>
        /คืนมัดจำ/.test(String(r.category || '') + ' ' + String(r.description || ''))
      );
      console.log(`💸 ที่เป็น "คืนมัดจำ": ${refundRows.length} รายการ รวม ฿${refundRows.reduce((s, r) => s + num(r.amount), 0)}`);
      console.table(refundRows);
    } catch (e) { console.error('รายจ่าย:', e); }

    // cash_transaction
    try {
      const { data } = await db.from('cash_transaction')
        .select('id,created_at,amount,net_amount,direction,type,note')
        .gte('created_at', startIso).lte('created_at', endIso)
        .order('created_at', { ascending: false });
      const refundTx = (data || []).filter(r =>
        /คืนมัดจำ/.test(String(r.type || '') + ' ' + String(r.note || ''))
      );
      console.log(`🧾 cash_transaction "คืนมัดจำ": ${refundTx.length} รายการ รวม ฿${refundTx.reduce((s, r) => s + (num(r.net_amount) || num(r.amount)), 0)}`);
      console.table(refundTx);
    } catch (e) { console.error('cash_transaction:', e); }

    // บิลขายที่ยกเลิก + มีมัดจำ → ตรวจว่ามีบิลที่ "ควรจะถูกคืน" หรือไม่
    try {
      const { data } = await db.from(BILL_TABLE)
        .select('id,bill_no,date,deposit_amount,total,status,cancel_reason,customer_name')
        .eq('status', 'ยกเลิก')
        .gt('deposit_amount', 0)
        .gte('date', startIso).lte('date', endIso)
        .order('date', { ascending: false });
      console.log(`❌ บิลยกเลิกที่มีมัดจำ > 0: ${data?.length || 0} รายการ`);
      console.table(data);
      console.log('💡 ถ้าบิลพวกนี้ลูกค้าได้รับเงินคืนแล้วแต่ไม่อยู่ในรายจ่าย → เรียก v92BackfillRefund(billId, "เงินสด" หรือ "โอนเงิน") เพื่อเติม');
    } catch (e) { console.error('บิลขาย:', e); }

    console.groupEnd();
  };

  /* backfill — บันทึกคืนมัดจำย้อนหลังสำหรับบิลที่ยกเลิกแล้วแต่ไม่มี record */
  window.v92BackfillRefund = async function (billId, method = 'เงินสด') {
    try {
      const { data: bill } = await db.from(BILL_TABLE).select('*').eq('id', billId).maybeSingle();
      if (!bill) { console.error('ไม่พบบิล', billId); return; }
      if (!num(bill.deposit_amount)) { console.error('บิลนี้ไม่มีมัดจำ'); return; }
      await recordDepositRefund(bill, { method, amount: num(bill.deposit_amount) });
      console.log(`✅ backfill คืนมัดจำ บิล #${bill.bill_no} ฿${bill.deposit_amount} (${method})`);
      try { window.renderDashboardV3?.(); } catch (_) {}
    } catch (e) { console.error('backfill failed:', e); }
  };

  /* ─────────────────────────────────────────────────────────────
     เคลียร์ส่วนลด pos-discount หลังขายเสร็จ
     v20.closeCheckout เคลียร์ cart + v12State แต่ไม่ได้แตะ pos-discount
     → discount เก่ายังอยู่ในช่อง → บิลถัดไปโดนหักด้วย
  ───────────────────────────────────────────────────────────── */
  function clearDiscountInput() {
    try {
      const inp = document.getElementById('pos-discount');
      if (inp) {
        inp.value = '0';
        // trigger input event เผื่อมี listener อื่นต้อง re-render cart
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof v12State !== 'undefined' && v12State) {
        v12State.discount = 0;
      }
      if (window.v12State) window.v12State.discount = 0;
    } catch (e) { console.warn('[v92] clearDiscountInput:', e); }
  }

  function patchDiscountReset() {
    // wrap closeCheckout
    const origClose = window.closeCheckout;
    if (typeof origClose === 'function' && !origClose.__v92DiscountReset) {
      const wrapped = function (...args) {
        const hadSavedBill = typeof v12State !== 'undefined' && v12State?.savedBill;
        const r = origClose.apply(this, args);
        if (hadSavedBill) {
          // เคลียร์ทันที + delay กันโดน renderCart รอบหลังเขียนทับ
          clearDiscountInput();
          setTimeout(clearDiscountInput, 50);
          setTimeout(clearDiscountInput, 300);
        }
        return r;
      };
      Object.defineProperty(wrapped, '__v92DiscountReset', { value: true });
      window.closeCheckout = wrapped;
      try { closeCheckout = wrapped; } catch (_) {}
    }

    // wrap v12CompletePayment เผื่อบางครั้งไม่ผ่าน closeCheckout (เช่น ขายแบบ fast)
    const origPay = window.v12CompletePayment;
    if (typeof origPay === 'function' && !origPay.__v92DiscountReset) {
      const wrapped = async function (...args) {
        const r = await origPay.apply(this, args);
        if (typeof v12State !== 'undefined' && v12State?.savedBill) {
          setTimeout(clearDiscountInput, 100);
          setTimeout(clearDiscountInput, 600);
        }
        return r;
      };
      Object.defineProperty(wrapped, '__v92DiscountReset', { value: true });
      window.v12CompletePayment = wrapped;
      window.v15CompletePayment = wrapped;
      window.v13CompletePayment = wrapped;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     install
  ───────────────────────────────────────────────────────────── */
  function install() {
    patchCancelBill();
    patchDQFilter();
    patchPaymentBadge();
    patchBMCPayDebt();
    patchBMCPayDebtGuard();
    patchDQMarkDone();
    patchDashboard();
    patchDiscountReset();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
  setTimeout(install, 800);
  setTimeout(install, 1800);
  setTimeout(install, 3000);

  console.log('[v92] cancel-deposit-delivery-fix loaded');
})();
