(function () {
  'use strict';

  const DENOMS = [
    { value: 1000, label: '1,000', type: 'bill', color: '#8B5E3C', bg: '#F5E7DA' },
    { value: 500, label: '500', type: 'bill', color: '#6B21A8', bg: '#F3E8FF' },
    { value: 100, label: '100', type: 'bill', color: '#BE123C', bg: '#FFE4E6' },
    { value: 50, label: '50', type: 'bill', color: '#1D4ED8', bg: '#DBEAFE' },
    { value: 20, label: '20', type: 'bill', color: '#15803D', bg: '#DCFCE7' },
    { value: 10, label: '10', type: 'coin', color: '#A16207', bg: '#FEF3C7' },
    { value: 5, label: '5', type: 'coin', color: '#A16207', bg: '#FEF3C7' },
    { value: 2, label: '2', type: 'coin', color: '#A16207', bg: '#FEF3C7' },
    { value: 1, label: '1', type: 'coin', color: '#A16207', bg: '#FEF3C7' }
  ];

  const fmt = n => typeof formatNum === 'function' ? formatNum(n) : Number(n || 0).toLocaleString('th-TH');
  const num = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const staff = () => {
    try { if (typeof USER !== 'undefined' && USER?.username) return USER.username; } catch (_) {}
    return localStorage.getItem('sk_pos_username') || 'system';
  };

  function injectStyle() {
    document.getElementById('v44-project-expense-style')?.remove();
    const style = document.createElement('style');
    style.id = 'v44-project-expense-style';
    style.textContent = `
      #page-projects .v23-wrap{max-width:1180px;margin:0 auto;padding:0 18px 28px!important}
      #page-projects .v23-back{margin-bottom:14px!important;padding:9px 16px!important;border-radius:11px!important}
      #page-projects .v23-hero{border-radius:18px!important;margin-bottom:14px!important;box-shadow:0 12px 34px rgba(79,70,229,.16)!important}
      #page-projects .v23-hero-top{padding:20px 22px 14px!important}
      #page-projects .v23-hero-row{gap:12px!important;margin-bottom:12px!important}
      #page-projects .v23-hero-name{font-size:23px!important;margin-bottom:8px!important;letter-spacing:0!important}
      #page-projects .v23-btn-glass,#page-projects .v23-btn-em{padding:8px 14px!important;border-radius:10px!important;font-size:12px!important}
      #page-projects .v23-metrics{grid-template-columns:repeat(5,minmax(0,1fr))!important}
      #page-projects .v23-m{padding:14px 13px 13px!important}
      #page-projects .v23-m-val{font-size:18px!important}
      #page-projects .v23-prog{padding:10px 22px 16px!important}
      #page-projects .v23-tabs{margin-bottom:14px!important;border-radius:14px!important}
      #page-projects .v23-tab{padding:9px 12px!important;font-size:12px!important}
      #page-projects .v23-panel{border-radius:16px!important;box-shadow:0 8px 24px rgba(15,23,42,.045)!important}
      #page-projects .v23-abar{padding:12px 14px!important}
      #page-projects .v23-exp-row,#page-projects .v23-ms-row,#page-projects .v23-bill-row{padding:12px 15px!important}
      #page-projects .v23-notes{margin-top:14px!important}
      @media(max-width:980px){#page-projects .v23-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}#page-projects .v23-wrap{padding:0 12px 22px!important}}

      .v44-modal{position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.46);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px;font-family:inherit}
      .v44-box{width:min(880px,96vw);max-height:92vh;overflow:auto;background:#f8fafc;border:1px solid #dbeafe;border-radius:20px;box-shadow:0 28px 80px rgba(15,23,42,.28);transform:translateY(10px);opacity:0;transition:.18s}
      .v44-box.open{transform:none;opacity:1}
      .v44-head{background:radial-gradient(circle at 12% 10%,rgba(45,212,191,.24),transparent 34%),linear-gradient(135deg,#0f172a,#164e63);color:#fff;padding:18px 20px;display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
      .v44-kicker{font-size:11px;font-weight:950;letter-spacing:1px;color:#67e8f9}
      .v44-title{font-size:21px;font-weight:950;line-height:1.25;margin-top:4px}
      .v44-sub{font-size:12px;font-weight:750;color:#cbd5e1;margin-top:4px}
      .v44-close{width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.10);color:#fff;cursor:pointer}
      .v44-body{padding:16px 18px 18px}
      .v44-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
      .v44-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;box-shadow:0 10px 24px rgba(15,23,42,.035)}
      .v44-field{margin-bottom:10px}
      .v44-field label{display:block;font-size:12px;font-weight:900;color:#64748b;margin-bottom:6px}
      .v44-field input,.v44-field select{width:100%;height:40px;border:1.5px solid #dbe3ef;border-radius:11px;padding:0 11px;font:inherit;font-size:14px;font-weight:800;box-sizing:border-box;background:#fff;color:#0f172a}
      .v44-field input:focus,.v44-field select:focus{outline:none;border-color:#06b6d4;box-shadow:0 0 0 3px #cffafe}
      .v44-payopts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .v44-pay{height:62px;border:1.5px solid #dbe3ef;background:#fff;border-radius:13px;cursor:pointer;font:inherit;font-size:12px;font-weight:950;color:#334155}
      .v44-pay i{display:block;font-size:20px;margin-bottom:4px;color:#64748b}
      .v44-pay.on{background:#ecfdf5;border-color:#10b981;color:#047857;box-shadow:0 0 0 3px #d1fae5}
      .v44-pay.on i{color:#10b981}
      .v44-cash-panel{margin-top:12px;border:1px solid #bae6fd;background:#f0fdfa;border-radius:16px;padding:12px}
      .v44-cash-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}
      .v44-cash-top b{font-size:18px;color:#0f766e}
      .v44-cash-top span{font-size:11px;font-weight:900;color:#64748b}
      .v44-denom-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .v44-denom{border:1px solid #dbeafe;border-radius:12px;background:#fff;overflow:hidden}
      .v44-denom-face{padding:8px 10px;font-size:13px;font-weight:950;display:flex;justify-content:space-between;align-items:center}
      .v44-denom-face small{font-size:10px;color:#64748b}
      .v44-denom input{width:100%;height:34px;border:0;border-top:1px solid #e2e8f0;text-align:center;font:inherit;font-size:14px;font-weight:950;color:#0f172a}
      .v44-status{margin-top:10px;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:900}
      .v44-status.ok{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
      .v44-status.warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
      .v44-summary{display:grid;gap:9px}
      .v44-sum{border:1px solid #e2e8f0;background:#f8fafc;border-radius:13px;padding:12px}
      .v44-sum span{display:block;font-size:11px;font-weight:900;color:#64748b}
      .v44-sum b{display:block;margin-top:4px;font-size:20px;font-weight:950;color:#0f172a}
      .v44-sum.cash b{color:#dc2626}
      .v44-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
      .v44-btn{height:42px;border-radius:12px;border:1px solid #dbe3ef;background:#fff;padding:0 16px;font:inherit;font-size:13px;font-weight:950;cursor:pointer}
      .v44-btn.primary{border-color:#dc2626;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;box-shadow:0 12px 24px rgba(220,38,38,.18)}
      .v44-btn.primary:disabled{opacity:.55;cursor:not-allowed}
      @media(max-width:760px){.v44-grid,.v44-denom-grid{grid-template-columns:1fr}.v44-payopts{grid-template-columns:1fr}.v44-actions{flex-direction:column}.v44-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function getOpenSession() {
    const { data, error } = await db.from('cash_session')
      .select('*').eq('status', 'open')
      .order('opened_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function getCounts() {
    const counts = {};
    DENOMS.forEach(d => { counts[d.value] = Math.max(0, Math.floor(num(document.getElementById('v44-denom-' + d.value)?.value))); });
    return counts;
  }

  function countTotal(counts = getCounts()) {
    return DENOMS.reduce((sum, d) => sum + (num(counts[d.value]) * d.value), 0);
  }

  function methodValue() {
    return document.getElementById('v44-exp-method')?.value || 'เงินสด';
  }

  window.v44SetExpenseMethod = function (method) {
    const select = document.getElementById('v44-exp-method');
    if (select) select.value = method;
    document.querySelectorAll('.v44-pay').forEach(btn => btn.classList.toggle('on', btn.dataset.method === method));
    const panel = document.getElementById('v44-cash-panel');
    if (panel) panel.style.display = method === 'เงินสด' ? '' : 'none';
    window.v44UpdateExpenseCash();
  };

  window.v44UpdateExpenseCash = function () {
    const amount = num(document.getElementById('v44-exp-amt')?.value);
    const method = methodValue();
    const counts = getCounts();
    const total = countTotal(counts);
    const diff = total - amount;
    const countEl = document.getElementById('v44-count-total');
    const diffEl = document.getElementById('v44-count-diff');
    const save = document.getElementById('v44-exp-confirm');
    const cashSum = document.getElementById('v44-summary-cash');
    if (countEl) countEl.textContent = '฿' + fmt(total);
    if (diffEl) {
      if (method !== 'เงินสด') {
        diffEl.className = 'v44-status ok';
        diffEl.textContent = 'วิธีนี้ไม่หักลิ้นชักเงินสด';
      } else if (amount <= 0) {
        diffEl.className = 'v44-status warn';
        diffEl.textContent = 'กรอกยอดรายจ่ายก่อน แล้วนับแบงค์/เหรียญที่จะหยิบออกจากลิ้นชัก';
      } else if (diff === 0) {
        diffEl.className = 'v44-status ok';
        diffEl.textContent = 'ยอดนับตรงกับรายจ่าย พร้อมหักออกจากลิ้นชัก';
      } else {
        diffEl.className = 'v44-status warn';
        diffEl.textContent = diff > 0 ? `นับเกิน ฿${fmt(diff)}` : `ยังขาด ฿${fmt(Math.abs(diff))}`;
      }
    }
    if (cashSum) cashSum.textContent = method === 'เงินสด' ? 'หักลิ้นชักทันที' : 'ไม่หักลิ้นชัก';
    if (save) save.disabled = method === 'เงินสด' && (amount <= 0 || total !== amount);
  };

  window.v14AddExpense = async function (projId) {
    injectStyle();
    document.getElementById('v44-expense-modal')?.remove();
    const el = document.createElement('div');
    el.id = 'v44-expense-modal';
    el.className = 'v44-modal';
    el.innerHTML = `
      <div class="v44-box" id="v44-expense-box">
        <div class="v44-head">
          <div>
            <div class="v44-kicker">PROJECT EXPENSE</div>
            <div class="v44-title">เพิ่มรายจ่ายโครงการ</div>
            <div class="v44-sub">ถ้าเลือกเงินสด ระบบจะบังคับนับแบงค์/เหรียญและหักออกจากลิ้นชัก</div>
          </div>
          <button class="v44-close" onclick="document.getElementById('v44-expense-modal')?.remove()"><i class="material-icons-round">close</i></button>
        </div>
        <div class="v44-body">
          <div class="v44-grid">
            <div class="v44-card">
              <div class="v44-field">
                <label>รายการ / คำอธิบาย *</label>
                <input id="v44-exp-desc" type="text" placeholder="เช่น ค่าแรงช่าง, ค่าปูน, ค่าขนส่ง">
              </div>
              <div class="v44-field">
                <label>หมวดหมู่</label>
                <select id="v44-exp-cat">
                  <option value="ค่าแรง">ค่าแรง</option>
                  <option value="วัสดุ">วัสดุ/อุปกรณ์</option>
                  <option value="ขนส่ง">ขนส่ง</option>
                  <option value="อื่นๆ" selected>อื่นๆ</option>
                </select>
              </div>
              <div class="v44-field">
                <label>จำนวนเงิน (บาท) *</label>
                <input id="v44-exp-amt" type="number" min="1" step="1" placeholder="0" oninput="v44UpdateExpenseCash()">
              </div>
              <div class="v44-field">
                <label>วิธีจ่ายเงิน</label>
                <input id="v44-exp-method" type="hidden" value="เงินสด">
                <div class="v44-payopts">
                  <button type="button" class="v44-pay on" data-method="เงินสด" onclick="v44SetExpenseMethod('เงินสด')"><i class="material-icons-round">payments</i>เงินสด</button>
                  <button type="button" class="v44-pay" data-method="โอน" onclick="v44SetExpenseMethod('โอน')"><i class="material-icons-round">account_balance</i>โอน</button>
                  <button type="button" class="v44-pay" data-method="อื่นๆ" onclick="v44SetExpenseMethod('อื่นๆ')"><i class="material-icons-round">more_horiz</i>อื่นๆ</button>
                </div>
              </div>
              <div class="v44-field">
                <label>หมายเหตุ</label>
                <input id="v44-exp-notes" type="text" placeholder="เลขที่ใบเสร็จ / รายละเอียดเพิ่มเติม">
              </div>
            </div>

            <div class="v44-card">
              <div class="v44-summary">
                <div class="v44-sum"><span>ยอดรายจ่าย</span><b id="v44-summary-amount">฿0</b></div>
                <div class="v44-sum cash"><span>ลิ้นชักเงินสด</span><b id="v44-summary-cash">หักลิ้นชักทันที</b></div>
              </div>
              <div class="v44-cash-panel" id="v44-cash-panel">
                <div class="v44-cash-top">
                  <div><span>ยอดที่นับได้</span><b id="v44-count-total">฿0</b></div>
                  <span>กรอกจำนวนใบ/เหรียญ</span>
                </div>
                <div class="v44-denom-grid">
                  ${DENOMS.map(d => `
                    <div class="v44-denom">
                      <div class="v44-denom-face" style="background:${d.bg};color:${d.color}">
                        <strong>฿${d.label}</strong><small>${d.type === 'bill' ? 'แบงค์' : 'เหรียญ'}</small>
                      </div>
                      <input id="v44-denom-${d.value}" type="number" min="0" step="1" value="0" oninput="v44UpdateExpenseCash()">
                    </div>`).join('')}
                </div>
                <div id="v44-count-diff" class="v44-status warn">กรอกยอดรายจ่ายก่อน แล้วนับแบงค์/เหรียญที่จะหยิบออกจากลิ้นชัก</div>
              </div>
            </div>
          </div>
          <div class="v44-actions">
            <button class="v44-btn" onclick="document.getElementById('v44-expense-modal')?.remove()">ยกเลิก</button>
            <button class="v44-btn primary" id="v44-exp-confirm" onclick="v44ConfirmAddExpense('${esc(projId)}')" disabled>
              <i class="material-icons-round" style="font-size:17px;vertical-align:middle">save</i> บันทึกรายจ่าย
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => document.getElementById('v44-expense-box')?.classList.add('open'));
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    document.getElementById('v44-exp-amt')?.addEventListener('input', () => {
      const amount = num(document.getElementById('v44-exp-amt')?.value);
      const sum = document.getElementById('v44-summary-amount');
      if (sum) sum.textContent = '฿' + fmt(amount);
    });
    document.getElementById('v44-exp-desc')?.focus();
  };

  window.v44ConfirmAddExpense = async function (projId) {
    const desc = document.getElementById('v44-exp-desc')?.value.trim();
    const cat = document.getElementById('v44-exp-cat')?.value || 'อื่นๆ';
    const amount = num(document.getElementById('v44-exp-amt')?.value);
    const method = methodValue();
    const notes = document.getElementById('v44-exp-notes')?.value.trim();
    const counts = getCounts();
    const denomTotal = countTotal(counts);

    if (!desc) { toast?.('กรุณากรอกรายการ', 'warning'); return; }
    if (amount <= 0) { toast?.('กรุณากรอกจำนวนเงิน', 'warning'); return; }
    if (method === 'เงินสด' && denomTotal !== amount) {
      toast?.('ยอดนับแบงค์/เหรียญต้องตรงกับยอดรายจ่าย', 'warning');
      return;
    }

    const btn = document.getElementById('v44-exp-confirm');
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

    try {
      const isCash = method === 'เงินสด';
      let cashTxId = null;

      if (isCash) {
        const session = await getOpenSession();
        if (!session) throw new Error('ยังไม่ได้เปิดลิ้นชักเงินสด');
        const balance = typeof getLiveCashBalance === 'function' ? await getLiveCashBalance() : 0;
        const after = Math.max(0, balance - amount);
        const { data: tx, error: txErr } = await db.from('cash_transaction').insert({
          session_id: session.id,
          type: 'รายจ่ายโครงการ',
          direction: 'out',
          amount,
          change_amt: 0,
          net_amount: amount,
          balance_after: after,
          ref_table: 'รายจ่ายโครงการ',
          staff_name: staff(),
          note: `${desc} [โครงการ]`,
          denominations: counts
        }).select('id').single();
        if (txErr) throw txErr;
        cashTxId = tx?.id || null;
        const balEl = document.getElementById('global-cash-balance');
        if (balEl) balEl.textContent = '฿' + fmt(after);
      }

      const { data: exp, error: expErr } = await db.from('รายจ่ายโครงการ').insert({
        project_id: projId,
        description: desc,
        category: cat,
        amount,
        type: 'expense',
        notes: notes || null,
        cash_tx_id: cashTxId,
        paid_at: new Date().toISOString()
      }).select('id').single();
      if (expErr) throw expErr;

      if (cashTxId && exp?.id) {
        await db.from('cash_transaction').update({ ref_id: exp.id }).eq('id', cashTxId);
      }

      const { data: project } = await db.from('โครงการ').select('total_expenses').eq('id', projId).maybeSingle();
      await db.from('โครงการ').update({
        total_expenses: num(project?.total_expenses) + amount
      }).eq('id', projId);

      logActivity?.('รายจ่ายโครงการ', `${desc} ฿${fmt(amount)}${isCash ? ' (เงินสด)' : ''}`, exp?.id, 'รายจ่ายโครงการ');
      document.getElementById('v44-expense-modal')?.remove();
      toast?.(`บันทึกรายจ่าย ฿${fmt(amount)}${isCash ? ' และหักลิ้นชักแล้ว' : ''}`, 'success');
      if (typeof renderCashDrawer === 'function') renderCashDrawer();
      if (typeof loadCashBalance === 'function') loadCashBalance();
      window.v14OpenProject?.(projId);
    } catch (e) {
      console.error('[v44] add project expense:', e);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="material-icons-round" style="font-size:17px;vertical-align:middle">save</i> บันทึกรายจ่าย'; }
      toast?.('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
  };

  injectStyle();
})();
