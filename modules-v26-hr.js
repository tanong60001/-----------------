// ══════════════════════════════════════════════════════════════════
// modules-v26-hr.js — HR SYSTEM REDESIGN v2 (White-Red Premium)
// 1. Card-based Attendance (gradient bg cards)
// 2. Payroll with employee selector (one at a time)
// 3. Monthly CSV Export
// 4. Social Security + Other Deductions
// ══════════════════════════════════════════════════════════════════
console.log('[v26-HR] Loading modules-v26-hr.js v2...');

// ══════════════════════════════════════
// SECTION 1: CSS
// ══════════════════════════════════════
(function v26CSS() {
  const el = document.getElementById('v26-hr-css');
  if (el) el.remove();
  const s = document.createElement('style');
  s.id = 'v26-hr-css';
  s.textContent = `
    /* ─── Header Banner ─── */
    .v26-banner {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
      border-radius: 20px; padding: 28px 32px; margin-bottom: 24px;
      color: #fff; position: relative; overflow: hidden;
    }
    .v26-banner::before {
      content: ''; position: absolute; top: -60px; right: -40px;
      width: 200px; height: 200px; border-radius: 50%;
      background: rgba(255,255,255,0.07);
    }
    .v26-banner::after {
      content: ''; position: absolute; bottom: -80px; left: 30%;
      width: 250px; height: 250px; border-radius: 50%;
      background: rgba(255,255,255,0.04);
    }
    .v26-banner-top {
      display: flex; justify-content: space-between; align-items: flex-start;
      flex-wrap: wrap; gap: 16px; position: relative; z-index: 1;
    }
    .v26-banner h2 {
      font-size: 22px; font-weight: 800; letter-spacing: -0.3px;
      display: flex; align-items: center; gap: 8px;
    }
    .v26-banner .v26-date { font-size: 14px; opacity: 0.8; margin-top: 4px; }

    .v26-stats-row {
      display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;
      justify-content: center; position: relative; z-index: 1;
    }
    .v26-stat-pill {
      padding: 6px 16px; border-radius: 24px; font-size: 12px;
      font-weight: 600; background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.2);
      backdrop-filter: blur(8px); transition: transform 0.2s;
      display: flex; align-items: center; gap: 5px;
    }
    .v26-stat-pill:hover { transform: scale(1.06); }

    .v26-actions-row {
      display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;
      justify-content: center; position: relative; z-index: 1;
    }
    .v26-actions-row .btn {
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);
      color: #fff; border-radius: 10px; font-size: 13px; padding: 8px 16px;
      font-weight: 600; backdrop-filter: blur(8px); transition: all 0.2s;
    }
    .v26-actions-row .btn:hover { background: rgba(255,255,255,0.28); transform: translateY(-1px); }

    /* ─── Card Grid ─── */
    .v26-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px; margin-bottom: 24px;
    }
    @media (max-width: 640px) { .v26-grid { grid-template-columns: 1fr; gap: 12px; } }

    /* ─── Employee Card with Gradient BG ─── */
    .v26-card {
      border-radius: 18px; padding: 0; overflow: hidden;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      position: relative;
    }
    .v26-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,0.12); }

    /* Gradient states */
    .v26-card.st-none { background: linear-gradient(160deg, #ffffff 0%, #f8fafc 100%); }
    .v26-card.st-มา { background: linear-gradient(160deg, #f0fdf4 0%, #dcfce7 40%, #bbf7d0 100%); }
    .v26-card.st-ขาด { background: linear-gradient(160deg, #fef2f2 0%, #fecaca 40%, #fca5a5 100%); }
    .v26-card.st-ลา { background: linear-gradient(160deg, #f5f3ff 0%, #ede9fe 40%, #ddd6fe 100%); }
    .v26-card.st-มาสาย { background: linear-gradient(160deg, #fffbeb 0%, #fef3c7 40%, #fde68a 100%); }
    .v26-card.st-ครึ่งวัน { background: linear-gradient(160deg, #ecfeff 0%, #cffafe 40%, #a5f3fc 100%); }

    .v26-card-inner { padding: 18px 20px; }

    .v26-card-head {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
    }
    .v26-avatar {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, #dc2626, #ef4444);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 800; font-size: 18px; flex-shrink: 0;
      box-shadow: 0 3px 10px rgba(220,38,38,0.25);
    }
    .v26-card-name { font-size: 16px; font-weight: 700; color: #1e293b; }
    .v26-card-sub { font-size: 12px; color: #64748b; margin-top: 2px; }

    /* ─── Status Options ─── */
    .v26-opts { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
    .v26-opt {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 14px; border-radius: 12px; cursor: pointer;
      border: 1.5px solid transparent; background: rgba(255,255,255,0.7);
      transition: all 0.2s; backdrop-filter: blur(4px);
    }
    .v26-opt:hover { background: rgba(255,255,255,0.9); }
    .v26-opt.on {
      border-color: var(--oc); background: rgba(255,255,255,0.95);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--oc) 20%, transparent);
    }
    .v26-opt input { display: none; }
    .v26-dot {
      width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid #cbd5e1;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; flex-shrink: 0;
    }
    .v26-opt.on .v26-dot { border-color: var(--oc); background: var(--oc); }
    .v26-opt.on .v26-dot::after { content: '✓'; color: #fff; font-size: 11px; font-weight: 800; }
    .v26-opt-label { font-size: 13px; font-weight: 600; color: #334155; flex: 1; }
    .v26-opt-info { font-size: 11px; color: #94a3b8; font-weight: 500; }

    .v26-card-note {
      width: 100%; border: 1.5px solid rgba(0,0,0,0.08); border-radius: 10px;
      padding: 8px 12px; font-size: 12px; font-family: inherit;
      background: rgba(255,255,255,0.6); color: #334155;
      resize: none; outline: none; backdrop-filter: blur(4px);
    }
    .v26-card-note:focus { border-color: #dc2626; background: #fff; }
    .v26-card-actions {
      display: flex; gap: 6px; margin-top: 10px; justify-content: center;
    }
    .v26-card-actions .btn {
      font-size: 12px; padding: 7px 14px; border-radius: 10px;
      background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.06);
      color: #64748b; font-weight: 600; backdrop-filter: blur(4px);
    }
    .v26-card-actions .btn:hover { background: #fff; color: #dc2626; }

    /* ─── Save Bar ─── */
    .v26-save-wrap {
      position: sticky; bottom: 0; z-index: 10; text-align: center;
      padding: 20px 0 12px;
      background: linear-gradient(0deg, var(--bg-main, #f8fafc) 60%, transparent);
    }
    .v26-save-btn {
      padding: 14px 56px; font-size: 16px; font-weight: 700;
      border-radius: 14px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      color: #fff; box-shadow: 0 6px 20px rgba(220,38,38,0.3);
      transition: all 0.3s; display: inline-flex; align-items: center; gap: 10px;
      font-family: inherit;
    }
    .v26-save-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(220,38,38,0.4); }
    .v26-save-btn:active { transform: scale(0.97); }
    .v26-save-btn.saving { background: #94a3b8; box-shadow: none; pointer-events: none; }

    /* ─── Payroll ─── */
    .v26-pay-banner {
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      border-radius: 20px; padding: 28px 32px; color: #fff;
      margin-bottom: 24px; position: relative; overflow: hidden;
      text-align: center;
    }
    .v26-pay-banner::before {
      content: ''; position: absolute; top: -50px; right: -30px;
      width: 180px; height: 180px; border-radius: 50%;
      background: rgba(255,255,255,0.05);
    }
    .v26-pay-selector {
      max-width: 600px; margin: 0 auto 24px; text-align: center;
    }
    .v26-pay-selector select {
      width: 100%; padding: 14px 18px; border-radius: 14px;
      border: 2px solid #fecaca; font-size: 15px; font-weight: 600;
      font-family: inherit; background: #fff; color: #1e293b;
      outline: none; cursor: pointer; appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23dc2626' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 12px center;
    }
    .v26-pay-selector select:focus { border-color: #dc2626; }

    /* ─── Payroll Payslip Style ─── */
    .v26-pay-detail {
      max-width: 600px; margin: 0 auto;
      background: #fff; border-radius: 8px; border-top: 10px solid #dc2626;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1); position: relative;
    }
    .v26-pay-detail::after {
      content: ''; position: absolute; bottom: -8px; left: 0; width: 100%; height: 12px;
      background: radial-gradient(circle, transparent, transparent 50%, #fff 50%, #fff 100%) 0 0 / 20px 20px;
    }
    .v26-pay-detail-head {
      background: #f8fafc; padding: 24px; text-align: center; border-bottom: 2px dashed #cbd5e1;
    }
    .v26-pay-detail-body { padding: 24px; }
    .v26-pr {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9;
    }
    .v26-pr:last-child { border-bottom: none; }
    .v26-pr.total {
      border-top: 2px solid #dc2626; border-bottom: none;
      padding-top: 14px; margin-top: 8px;
      font-size: 17px; font-weight: 700;
    }
    .v26-fields {
      background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      margin-top: 18px;
    }
    @media (max-width: 500px) { .v26-fields { grid-template-columns: 1fr; } }
    .v26-field label {
      font-size: 12px; font-weight: 700; color: #64748b;
      margin-bottom: 5px; display: block; text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .v26-field input, .v26-field select {
      width: 100%; padding: 10px 14px; border-radius: 10px;
      border: 1.5px solid #e2e8f0; font-size: 15px;
      font-family: inherit; outline: none; transition: all 0.2s;
      background: #f8fafc;
    }
    .v26-field input:focus, .v26-field select:focus { border-color: #dc2626; background: #fff; }
    .v26-field input.err { border-color: #ef4444; background: #fef2f2; }

    .v26-vmsg {
      padding: 10px 14px; border-radius: 10px; font-size: 13px;
      margin-top: 14px; display: none; align-items: center; gap: 8px;
      font-weight: 600;
    }
    .v26-vmsg.show { display: flex; }
    .v26-vmsg.bad { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .v26-vmsg.good { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

    .v26-live-summary {
      background: #334155; color: #fff; border-radius: 12px; padding: 16px; margin-top: 16px;
      text-align: center; font-family: 'Prompt', sans-serif; position: relative; overflow: hidden;
    }
    .v26-live-summary::after { content: ''; position: absolute; right: -20px; top: -20px; width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 50%; }
    .v26-btn-pay {
      width: 100%; margin-top: 18px; padding: 14px; font-size: 15px;
      font-weight: 700; border-radius: 12px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      color: #fff; font-family: inherit;
      box-shadow: 0 4px 14px rgba(220,38,38,0.25);
      transition: all 0.3s; display: flex; align-items: center;
      justify-content: center; gap: 8px;
    }
    .v26-btn-pay:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(220,38,38,0.35); }
    .v26-btn-pay:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }

    /* ─── CSV ─── */
    .v26-csv-pre { padding: 12px; background: #1e293b; color: #10b981; font-family: monospace; border-radius: 8px; font-size: 13px; max-height: 250px; overflow-y: auto; text-align: left; }
    
    /* ─── V26 Denom Wizard ─── */
    .v26-denom-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin: 16px 0; }
    .v26-denom-btn {
       background: #fff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px;
       cursor: pointer; position: relative; user-select: none; transition: all 0.2s;
       display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .v26-denom-btn:hover:not(:disabled) { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,0.15); transform: translateY(-2px); }
    .v26-denom-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #f8fafc; }
    .v26-denom-face { font-size: 24px; font-weight: 800; color: #1e293b; margin-bottom: 4px; }
    .v26-denom-stock { font-size: 12px; background: #e2e8f0; padding: 2px 8px; border-radius: 10px; color: #475569; font-weight: 700; }
    .v26-denom-count { 
       position: absolute; top: -8px; right: -8px; background: #dc2626; color: #fff; width: 26px; height: 26px;
       border-radius: 50%; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center;
       box-shadow: 0 2px 6px rgba(220, 38, 38, 0.4); z-index: 2;
    }
    .v26-denom-ctrl { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 8px; }
    .v26-denom-min { width: 32px; height: 32px; border-radius: 6px; background: #fee2e2; color: #dc2626; border: none; font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .v26-denom-sum { font-weight: 800; color: #3b82f6; }
    .v26-dwrap { background: #fff; border-radius: 16px; padding: 24px; max-height: 80vh; overflow-y: auto; text-align: left; }
    .v26-dhead { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; }
    .v26-dtarget { font-size: 28px; font-weight: 800; color: #1e293b; }

    /* ─── Advance Bill / Voucher ─── */
    .v26-adv-modal { text-align: left; background: #fff; padding: 24px; border-radius: 8px; border-top: 10px solid #d97706; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
    .v26-adv-modal::after { content: ''; position: absolute; bottom: -8px; left: 0; width: 100%; height: 12px; background: radial-gradient(circle, transparent, transparent 50%, #fff 50%, #fff 100%) 0 0 / 20px 20px; }
    .v26-adv-header { color: #334155; margin-bottom: 20px; text-align: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 16px; }
    .v26-adv-header h3 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #1e293b; }
    .v26-adv-header .sub { font-size: 13px; font-weight: 700; color: #d97706; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; display: block; }
    
    .v26-adv-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px; }
    .v26-adv-row.amount { font-size: 20px; font-weight: 700; color: #b45309; padding: 16px 0; border-bottom: 2px dashed #e2e8f0; }
    .v26-adv-label { color: #64748b; font-weight: 600; font-size: 14px; }
    
    .v26-adv-amount-input { font-size: 24px; font-weight: 800; color: #1e293b; border: none; background: #f8fafc; text-align: right; width: 140px; outline: none; padding: 8px 12px; border-radius: 8px; }
    .v26-adv-method-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
    .v26-adv-method-btn { padding: 12px; border-radius: 8px; border: 2px solid #e2e8f0; background: #fff; cursor: pointer; text-align: center; font-size: 15px; font-weight: 700; color: #334155; transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px; }
    .v26-adv-method-btn.active { border-color: #d97706; background: #fffbeb; color: #b45309; }
    .v26-adv-reason { width: 100%; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 14px; font-family: inherit; background: #f8fafc; outline: none; text-align: right; }
    .v26-adv-reason:focus { border-color: #d97706; background: #fff; }
  `;
  document.head.appendChild(s);
})();

// ══════════════════════════════════════
// SECTION 1.5: ADVANCE WIZARD (Override)
// ══════════════════════════════════════
window.openAdvanceWizard = function(empId, empName) {
  Swal.fire({
    html: `
      <div class="v26-adv-modal" style="margin:-1.5em; width:calc(100% + 3em);">
        <div class="v26-adv-header">
          <span class="sub">Cash Advance Voucher</span>
          <h3><i class="material-icons-round" style="color:#d97706;">receipt_long</i> เบิกเงินล่วงหน้า</h3>
        </div>
        <div class="v26-adv-row">
          <span class="v26-adv-label">พนักงาน:</span> <strong>${empName}</strong>
        </div>
        <div class="v26-adv-row">
          <span class="v26-adv-label">หมายเหตุ:</span>
          <input type="text" class="v26-adv-reason" id="v26-adv-reason" placeholder="ระบุเหตุผล...">
        </div>
        <div class="v26-adv-row amount">
          <span class="v26-adv-label" style="color:#b45309;">ยอดเบิก (฿):</span>
          <input type="number" class="v26-adv-amount-input" id="v26-adv-amount" placeholder="0" min="1">
        </div>
        <div style="margin-top:16px;">
          <span class="v26-adv-label">ช่องทางรับเงิน:</span>
          <div class="v26-adv-method-row">
            <button class="v26-adv-method-btn active" id="v26-m-cash" onclick="document.querySelectorAll('.v26-adv-method-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active'); document.getElementById('v26-m-val').value='เงินสด';">เงินสด</button>
            <button class="v26-adv-method-btn" id="v26-m-trans" onclick="document.querySelectorAll('.v26-adv-method-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active'); document.getElementById('v26-m-val').value='โอนเงิน';">โอนเงิน</button>
            <input type="hidden" id="v26-m-val" value="เงินสด">
          </div>
        </div>
      </div>
    `,
    showCancelButton: true, confirmButtonText: 'ยืนยัน', confirmButtonColor: '#d97706',
    preConfirm: () => {
      const amt = Number(document.getElementById('v26-adv-amount').value);
      if (!amt || amt <= 0) { Swal.showValidationMessage('ระบุยอดเงิน'); return false; }
      return { amt, method: document.getElementById('v26-m-val').value, reason: document.getElementById('v26-adv-reason').value };
    }
  }).then(async (res) => {
    if (res.isConfirmed) {
      const { amt, method, reason } = res.value;
      const save = async (denom = null) => {
        const { data: ins } = await db.from('เบิกเงิน').insert({ employee_id: empId, amount: amt, reason, date: new Date().toISOString(), status: 'อนุมัติ', approved_by: USER?.username }).select().single();
        if (method === 'เงินสด') {
          const { data: sess } = await db.from('cash_session').select('id').eq('status','open').single();
          if (sess) await recordCashTx({ sessionId: sess.id, type: 'เบิกเงิน', direction: 'out', amount: amt, netAmount: amt, refId: ins.id, denominations: denom, note: `${empName} ${reason}` });
        }
        Swal.fire('สำเร็จ', 'บันทึกรายการเรียบร้อย', 'success');
        renderAttendance();
      };
      if (method === 'เงินสด') {
        await assertCashEnough(amt, 'เบิกเงิน');
        await window.v26StartCashWizard({ title: 'จ่ายเงินสดเบิกล่วงหน้า', desc: 'ให้พนักงานผู้เบิกนับเงินจ่ายเอง', targetAmount: amt, mustBeExact: true, onConfirm: save });
      } else await save();
    }
  });
};

// ══════════════════════════════════════
// SECTION 2: ATTENDANCE STATUS
// ══════════════════════════════════════
const V26_ST = {
  'มา':      { label:'มาทำงาน',   color:'#16a34a', icon:'check_circle',  pct:0,   },
  'ขาด':     { label:'ขาด',       color:'#dc2626', icon:'cancel',        pct:100, },
  'ลา':      { label:'ลา',        color:'#7c3aed', icon:'event_busy',    pct:0,   },
  'มาสาย':   { label:'มาสาย',     color:'#d97706', icon:'schedule',      pct:5,   },
  'ครึ่งวัน': { label:'มาครึ่งวัน', color:'#0891b2', icon:'timelapse',     pct:50,  }
};

let v26Att = {};

// ──────────────────────────────────────
// RENDER ATTENDANCE
// ──────────────────────────────────────
window.renderAttendance = async function() {
  const sec = document.getElementById('page-att');
  if (!sec) return;
  const today = new Date().toISOString().split('T')[0];
  const emps = await loadEmployees();
  const active = emps.filter(e => e.status === 'ทำงาน');
  const { data: rows } = await db.from('เช็คชื่อ').select('*').eq('date', today);
  const map = {};
  (rows || []).forEach(a => { map[a.employee_id] = a; });

  v26Att = {};
  active.forEach(e => {
    const a = map[e.id];
    v26Att[e.id] = { st: a?.status || null, note: a?.note || '', aid: a?.id || null, tin: a?.time_in || null, tout: a?.time_out || null };
  });

  const cnt = {}; Object.keys(V26_ST).forEach(k => { cnt[k] = 0; }); let unc = 0;
  active.forEach(e => { const s = v26Att[e.id]?.st; if (s && cnt[s] !== undefined) cnt[s]++; else unc++; });

  sec.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:0 8px;">
      <div class="v26-banner">
        <div class="v26-banner-top">
          <div>
            <h2><i class="material-icons-round">badge</i> เช็คชื่อพนักงาน</h2>
            <div class="v26-date">📅 ${new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })}</div>
          </div>
        </div>
        <div class="v26-stats-row" id="v26-stats">
          ${Object.entries(V26_ST).map(([k, v]) => `<span class="v26-stat-pill"><i class="material-icons-round" style="font-size:14px;">${v.icon}</i> ${v.label} <strong>${cnt[k]}</strong></span>`).join('')}
          <span class="v26-stat-pill" style="color:#fde68a;"><i class="material-icons-round" style="font-size:14px;">hourglass_empty</i> ยังไม่ลง <strong>${unc}</strong></span>
        </div>
        <div class="v26-actions-row">
          <button class="btn" onclick="showAttDatePicker()"><i class="material-icons-round">calendar_today</i> ย้อนหลัง</button>
          <button class="btn" onclick="renderPayrollV26()"><i class="material-icons-round">account_balance_wallet</i> จ่ายเงินเดือน</button>
          <button class="btn" onclick="v26ShowCSVExport()"><i class="material-icons-round">download</i> ส่งออก CSV</button>
          <button class="btn" onclick="showEmployeeModal()"><i class="material-icons-round">person_add</i> เพิ่มพนักงาน</button>
        </div>
      </div>
      <div class="v26-grid">${active.map(e => v26Card(e)).join('')}</div>
      <div class="v26-save-wrap">
        <button class="v26-save-btn" id="v26-save-btn" onclick="v26SaveAll()">
          <i class="material-icons-round">save</i> บันทึกทั้งหมด
        </button>
      </div>
    </div>`;
};

function v26Card(emp) {
  const d = v26Att[emp.id] || {};
  const st = d.st || '';
  const stCls = st ? `st-${st}` : 'st-none';
  return `
    <div class="v26-card ${stCls}" id="v26c-${emp.id}">
      <div class="v26-card-inner">
        <div class="v26-card-head">
          <div class="v26-avatar">${(emp.name||'?')[0]}</div>
          <div>
            <div class="v26-card-name">${emp.name} ${emp.lastname||''}</div>
            <div class="v26-card-sub">${emp.position||'พนักงาน'} · ฿${formatNum(emp.daily_wage||0)}/วัน</div>
          </div>
        </div>
        <div class="v26-opts">
          ${Object.entries(V26_ST).map(([k, v]) => {
            const on = st === k;
            return `<label class="v26-opt ${on?'on':''}" style="--oc:${v.color};" onclick="v26Pick('${emp.id}','${k}')">
              <input type="radio" name="v26r-${emp.id}" value="${k}" ${on?'checked':''}>
              <span class="v26-dot"></span>
              <span class="v26-opt-label">${v.label}</span>
              <span class="v26-opt-info">${v.pct > 0 ? `หัก ${v.pct}%` : (k==='ลา'?'ไม่หัก':'เต็ม')}</span>
            </label>`;
          }).join('')}
        </div>
        <textarea class="v26-card-note" rows="1" placeholder="หมายเหตุ..." id="v26n-${emp.id}"
          onchange="v26Att['${emp.id}'].note=this.value">${d.note||''}</textarea>
        <div class="v26-card-actions">
          <button class="btn" onclick="openAdvanceWizard('${emp.id}','${emp.name}')">
            <i class="material-icons-round" style="font-size:15px;">payments</i> เบิกเงิน
          </button>
        </div>
      </div>
    </div>`;
}

window.v26Pick = function(eid, st) {
  v26Att[eid] = v26Att[eid] || {};
  v26Att[eid].st = st;
  const card = document.getElementById(`v26c-${eid}`);
  if (card) {
    card.className = `v26-card st-${st}`;
    card.querySelectorAll('.v26-opt').forEach(o => {
      const v = o.querySelector('input')?.value;
      v === st ? o.classList.add('on') : o.classList.remove('on');
      if (v === st) o.querySelector('input').checked = true;
    });
  }
  v26UpdStats();
};

function v26UpdStats() {
  const cnt = {}; Object.keys(V26_ST).forEach(k => { cnt[k] = 0; }); let unc = 0;
  Object.values(v26Att).forEach(d => { if (d.st && cnt[d.st] !== undefined) cnt[d.st]++; else unc++; });
  const el = document.getElementById('v26-stats');
  if (el) el.innerHTML = Object.entries(V26_ST).map(([k, v]) =>
    `<span class="v26-stat-pill"><i class="material-icons-round" style="font-size:14px;">${v.icon}</i> ${v.label} <strong>${cnt[k]}</strong></span>`
  ).join('') + `<span class="v26-stat-pill" style="color:#fde68a;"><i class="material-icons-round" style="font-size:14px;">hourglass_empty</i> ยังไม่ลง <strong>${unc}</strong></span>`;
}

window.v26SaveAll = async function() {
  const btn = document.getElementById('v26-save-btn');
  if (btn) { btn.classList.add('saving'); btn.innerHTML = '<i class="material-icons-round">sync</i> กำลังบันทึก...'; }
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  let ok = 0, skip = 0;
  try {
    for (const [eid, d] of Object.entries(v26Att)) {
      if (!d.st) { skip++; continue; }
      const { data: emp } = await db.from('พนักงาน').select('daily_wage,salary,pay_type').eq('id', eid).maybeSingle();
      
      let ded = 0;
      if (emp?.pay_type === 'รายเดือน') {
        const dailyEq = (emp.salary||0) / 30;
        if (d.st === 'ขาด') ded = dailyEq * 1;
        else if (d.st === 'มาครึ่งวัน') ded = dailyEq * 0.5;
        else if (d.st === 'มาสาย') ded = dailyEq * 0.05;
      } else {
        const dWage = emp?.daily_wage||0;
        if (d.st === 'มาครึ่งวัน') ded = dWage * 0.5;
        else if (d.st === 'มาสาย') ded = dWage * 0.05;
      }
      ded = Math.round(ded);

      const rec = { employee_id: eid, date: today, status: d.st, deduction: ded, note: d.note||'', staff_name: USER?.username, time_in: d.tin || (d.st !== 'ขาด' ? now.toTimeString().slice(0,5) : null) };
      if (d.aid) { await db.from('เช็คชื่อ').update(rec).eq('id', d.aid); }
      else { const { data: n } = await db.from('เช็คชื่อ').insert(rec).select().single(); if (n) v26Att[eid].aid = n.id; }
      ok++;
    }
    toast(`บันทึกสำเร็จ ${ok} คน${skip>0?` (ข้าม ${skip})`:''}`,'success');
    logActivity('เช็คชื่อพนักงาน', `บันทึก ${ok} คน`);
  } catch(e) { console.error(e); toast('Error: '+e.message,'error'); }
  if (btn) { btn.classList.remove('saving'); btn.innerHTML = '<i class="material-icons-round">save</i> บันทึกทั้งหมด'; }
};

// ══════════════════════════════════════
// SECTION 3: PAYROLL (Select One)
// ══════════════════════════════════════
window.renderPayroll = window.renderPayrollV26 = async function() {
  const sec = document.getElementById('page-att');
  if (!sec) return;
  const now = new Date();
  const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const me = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0];
  const ml = now.toLocaleDateString('th-TH', { month:'long', year:'numeric' });

  const emps = (await loadEmployees()).filter(e => e.status === 'ทำงาน');
  const { data: att } = await db.from('เช็คชื่อ').select('*').gte('date', ms).lte('date', me);
  const { data: adv } = await db.from('เบิกเงิน').select('*').eq('status','อนุมัติ').gte('date', ms+'T00:00:00');
  const { data: paid } = await db.from('จ่ายเงินเดือน').select('*').eq('month', ms);

  window._v26Pay = emps.map(emp => {
    const ma = (att||[]).filter(a => a.employee_id === emp.id);
    const wd = ma.filter(a => a.status !== 'ขาด' && a.status !== 'ลา').length;
    const td = ma.reduce((s,a) => s+(a.deduction||0), 0);
    
    let earn = 0;
    if (emp.pay_type === 'รายเดือน') {
      earn = (emp.salary||0) - td;
    } else {
      const w = emp.daily_wage||0;
      earn = (wd*w) - td;
    }

    const myA = (adv||[]).filter(a => a.employee_id === emp.id);
    const taGross = myA.reduce((s,a) => s+a.amount, 0);

    const pastPays = (paid||[]).filter(p => p.employee_id === emp.id);
    const sumPaidNet = pastPays.reduce((s,p) => s+p.net_paid, 0);
    const sumPaidWithdraw = pastPays.reduce((s,p) => s+p.deduct_withdraw, 0);
    const sumTotalDeduct = pastPays.reduce((s,p) => s+p.deduct_absent + p.deduct_ss + p.deduct_other, 0);
    
    // 'earn' is gross entitlement so far. The portion they already 'used up' includes what we gave them (sumPaidNet)
    // plus what was strictly deducted mathematically during that payout (sumTotalDeduct).
    const consumedEarn = sumPaidNet + sumPaidWithdraw + sumTotalDeduct;
    
    const remEarn = Math.max(0, earn - consumedEarn);
    const remTa = Math.max(0, taGross - sumPaidWithdraw);
    
    const net = remEarn;
    
    return { emp, wd, earn, td, ta: remTa, net, myA, pastPays };
  });

  const totalNet = window._v26Pay.reduce((s,x) => s+x.net, 0);

  sec.innerHTML = `
    <div style="max-width:700px;margin:0 auto;padding:0 8px;">
      <div class="v26-pay-banner">
        <div style="position:relative;z-index:1;">
          <h2 style="font-size:22px;font-weight:800;margin-bottom:4px;">
            <i class="material-icons-round" style="vertical-align:middle;">account_balance_wallet</i> จ่ายเงินเดือน
          </h2>
          <div style="opacity:.7;font-size:14px;">${ml}</div>
          <div style="font-size:28px;font-weight:800;margin-top:12px;">฿${formatNum(totalNet)}</div>
          <div style="font-size:12px;opacity:.6;">ยอดรวมที่ต้องจ่ายทั้งหมด</div>
          <button class="btn" style="margin-top:14px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:10px;" onclick="renderAttendance()">
            <i class="material-icons-round">arrow_back</i> กลับเช็คชื่อ
          </button>
        </div>
      </div>

      <div class="v26-pay-grid" id="v26-pay-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top:20px;">
        ${window._v26Pay.map(s => `
          <div class="v26-pay-card" onclick="v26ShowPayDetail('${s.emp.id}')" style="background:#fff; border-radius:16px; border:2px solid ${s.pastPays.length>0 ? '#3b82f6' : '#e2e8f0'}; padding:20px; cursor:pointer; position:relative; box-shadow:0 4px 15px rgba(0,0,0,0.04); transition:all 0.2s;">
            ${s.pastPays.length>0 ? `<div style="position:absolute; top:-10px; right:-10px; background:#3b82f6; color:#fff; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:800; box-shadow:0 2px 8px rgba(59,130,246,0.4);"><i class="material-icons-round" style="font-size:16px;vertical-align:middle;margin-right:2px;">history</i> จ่ายไปแล้ว ${s.pastPays.length} รอบ</div>` : ''}
            <div style="display:flex; align-items:center; gap:16px;">
              <div style="width:50px; height:50px; border-radius:50%; background:${s.pastPays.length>0 ? '#eff6ff' : '#f8fafc'}; color:${s.pastPays.length>0 ? '#2563eb' : '#475569'}; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:800;">${s.emp.name[0]}</div>
              <div style="flex:1;">
                <div style="font-weight:800; font-size:18px; color:#1e293b;">${s.emp.name} ${s.emp.lastname||''}</div>
                <div style="font-size:13px; color:#64748b; margin-top:2px;">${s.emp.pay_type} / ทำงาน ${s.wd} วัน</div>
              </div>
            </div>
            <div style="margin-top:16px; padding-top:16px; border-top:1px dashed #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
              <div>
                 <div style="font-size:12px; color:#94a3b8; font-weight:700;"><i class="material-icons-round" style="font-size:14px;vertical-align:middle;color:#f59e0b;">account_balance</i> หนี้/เบิกค้าง</div>
                 <div style="font-size:16px; font-weight:800; color:#dc2626; margin-top:2px;">฿${formatNum(s.ta)}</div>
              </div>
              <div style="text-align:right;">
                 <div style="font-size:12px; color:#94a3b8; font-weight:700;"><i class="material-icons-round" style="font-size:14px;vertical-align:middle;">payments</i> ยอดที่ร้านค้างจ่ายสะสม</div>
                 <div style="font-size:22px; font-weight:900; color:#334155; margin-top:2px;">฿${formatNum(s.net)}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div id="v26-pay-detail-wrap" style="display:none; margin-top:20px;"></div>
    </div>`;
};

window.v26HidePayDetail = function() {
  document.getElementById('v26-pay-detail-wrap').style.display = 'none';
  document.getElementById('v26-pay-grid').style.display = 'grid';
};

window.v26ShowPayDetail = function(eid) {
  const wrap = document.getElementById('v26-pay-detail-wrap');
  if (!wrap || !eid) return;
  document.getElementById('v26-pay-grid').style.display = 'none';
  wrap.style.display = 'block';

  const s = window._v26Pay?.find(x => x.emp.id === eid);
  if (!s) return;

  if (pd) {
    wrap.innerHTML = `
      <button onclick="v26HidePayDetail()" style="margin-bottom:20px; background:#e2e8f0; color:#475569; border:none; padding:10px 20px; border-radius:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s;"><i class="material-icons-round">arrow_back</i> กลับหน้าหลัก</button>
      <div class="v26-pay-card" style="cursor:default; margin-bottom:24px; text-align:center; padding:50px 20px; background:#f8fafc; border:2px dashed #10b981;">
        <i class="material-icons-round" style="font-size:72px; color:#10b981;">task_alt</i>
        <h2 style="color:#059669; margin:16px 0 8px; font-size:26px;">ชำระเงินเดือนแล้ว!</h2>
        <p style="color:#475569; font-size:16px;">เงินเดือนเดือนนี้ของ <strong>${emp.name}</strong> ถูกบันทึกจ่ายแล้ว<br>เมื่อวันที่: ${new Date(pd.paid_date).toLocaleString('th-TH')}</p>
        <div style="font-size:24px; font-weight:800; color:#1e293b; margin-top:24px; background:#fff; box-shadow:0 4px 15px rgba(0,0,0,0.05); padding:20px; border-radius:16px; display:inline-block; border:1px solid #e2e8f0;">
          <div style="color:#10b981; font-size:32px;">฿${formatNum(pd.net_paid)}</div>
          <div style="font-size:14px;color:#64748b;margin-top:8px;">ยอดรับเข้ากระเป๋าจริง</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:12px;padding-top:12px;border-top:1px dashed #e2e8f0;">
             หักหนี้ ฿${formatNum(pd.deduct_withdraw)}  |  หมายเหตุ: ${pd.note||'-'}
          </div>
        </div>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <button onclick="v26HidePayDetail()" style="margin-bottom:20px; background:#e2e8f0; color:#475569; border:none; padding:10px 20px; border-radius:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s;"><i class="material-icons-round">arrow_back</i> กลับหน้าหลัก</button>
    <div class="v26-pay-detail" style="cursor:default; margin-bottom:24px;">
      <div class="v26-pay-detail-head">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
          <div class="v26-avatar" style="width:52px;height:52px;font-size:20px;">${(emp.name||'?')[0]}</div>
          <div style="text-align:left;">
            <div style="font-size:18px;font-weight:700;color:#1e293b;">${emp.name} ${emp.lastname||''}</div>
            <div style="font-size:13px;color:#64748b;">${emp.position} · ฿${formatNum(emp.daily_wage||0)}/วัน</div>
          </div>
        </div>
        ${pd ? `<div style="margin-top:10px;"><span style="background:#dcfce7;color:#16a34a;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;">✓ จ่ายแล้ว ฿${formatNum(pd.net_paid)}</span></div>` : ''}
      </div>
      <div class="v26-pay-detail-body">
        <div class="v26-pr"><span>วันทำงาน</span><strong>${wd} วัน</strong></div>
        <div class="v26-pr"><span>ค่าจ้างรวม</span><strong>฿${formatNum(earn + td)}</strong></div>
        <div class="v26-pr"><span style="color:#dc2626;">หักสาย/ขาด</span><strong style="color:#dc2626;">-฿${formatNum(td)}</strong></div>
        <div class="v26-pr total"><span>ยอดสะสมที่ได้ทั้งหมด (Max)</span><strong style="color:#10b981;">฿${formatNum(earn)}</strong></div>

        ${myA.length > 0 ? `<div style="margin-top:14px;padding:12px 14px;background:#fffbeb;border-radius:10px;border:1.5px solid #fde68a;">
          <div style="font-size:13px;font-weight:700;color:#d97706;margin-bottom:6px;">
            <i class="material-icons-round" style="font-size:16px;vertical-align:middle;">warning</i> 
            มียอดเบิก/หนี้เดือนนี้สะสม: ฿${formatNum(ta)} (นำไปกรอกหักหนี้ด้านล่าง)
          </div>
          ${myA.map(a => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:#92400e;"><span>${formatDate(a.date)} — ${a.reason||'ไม่ระบุ'}</span><strong>฿${formatNum(a.amount)}</strong></div>`).join('')}
        </div>` : ''}

        <div class="v26-fields">
          <div class="v26-field"><label>พนักงานรับจริง (฿)</label>
            <input type="number" id="v26r-${eid}" value="" placeholder="0" min="0" oninput="v26Val('${eid}',${earn})"></div>
          <div class="v26-field"><label>หักหนี้ / ยอดเบิก (฿)</label>
            <input type="number" id="v26d-${eid}" value="" placeholder="0" min="0" oninput="v26Val('${eid}',${earn})"></div>
          <div class="v26-field"><label>หักประกันสังคม (฿)</label>
            <input type="number" id="v26s-${eid}" value="" placeholder="0" min="0" oninput="v26Val('${eid}',${earn})"></div>
          <div class="v26-field"><label>หักอื่นๆ / เรียกเก็บ (฿)</label>
            <input type="number" id="v26o-${eid}" value="" placeholder="0" min="0" oninput="v26Val('${eid}',${earn})"></div>
        </div>
        <div class="v26-field" style="margin-top:10px;"><label>หมายเหตุหักอื่นๆ</label>
          <input type="text" id="v26on-${eid}" placeholder="ระบุเหตุผล..."></div>

        <div class="v26-vmsg" id="v26vm-${eid}"></div>

        <div class="v26-fields" style="margin-top:14px;">
          <div class="v26-field"><label>วิธีจ่าย</label>
            <select id="v26m-${eid}"><option value="เงินสด">เงินสด</option><option value="โอนเงิน">โอนเงิน</option></select></div>
          <div class="v26-field"><label>หมายเหตุ</label>
            <input type="text" id="v26pn-${eid}" placeholder="หมายเหตุ..."></div>
        </div>

        <button class="v26-pay-confirm" id="v26pb-${eid}" onclick="v26DoPay('${eid}')">
          <i class="material-icons-round">payments</i> ยืนยันจ่ายเงินเดือน
        </button>
      </div>
    </div>`;

  v26Val(eid, earn);
};

window.v26Val = function(eid, max) {
  const r = Number(document.getElementById(`v26r-${eid}`)?.value||0);
  const d = Number(document.getElementById(`v26d-${eid}`)?.value||0);
  const ss = Number(document.getElementById(`v26s-${eid}`)?.value||0);
  const o = Number(document.getElementById(`v26o-${eid}`)?.value||0);
  const t = r + d + ss + o;
  const el = document.getElementById(`v26vm-${eid}`);
  const btn = document.getElementById(`v26pb-${eid}`);

  if (t > max) {
    if (el) { el.className = 'v26-vmsg show bad'; el.innerHTML = `<i class="material-icons-round" style="font-size:16px;">error</i> ยอดรวม ฿${formatNum(t)} เกินยอดสะสม ฿${formatNum(max)} (เกิน ฿${formatNum(t-max)})`; }
    if (btn) btn.disabled = true;
  } else if (r < 0 || d < 0 || ss < 0 || o < 0) {
    if (el) { el.className = 'v26-vmsg show bad'; el.innerHTML = `<i class="material-icons-round" style="font-size:16px;">error</i> ห้ามกรอกค่าติดลบ`; }
    if (btn) btn.disabled = true;
  } else {
    if (el) { el.className = 'v26-vmsg show good'; el.innerHTML = `<i class="material-icons-round" style="font-size:16px;">check_circle</i> รับจริง ฿${formatNum(r)} | หักรวม ฿${formatNum(d+ss+o)} | คงเหลือ ฿${formatNum(max-t)}`; }
    if (btn) btn.disabled = false;
  }
};

window.v26DoPay = async function(eid) {
  const s = window._v26Pay?.find(x => x.emp.id === eid);
  if (!s) return;
  const recv = Number(document.getElementById(`v26r-${eid}`)?.value||0);
  const debt = Number(document.getElementById(`v26d-${eid}`)?.value||0);
  const ss = Number(document.getElementById(`v26s-${eid}`)?.value||0);
  const oth = Number(document.getElementById(`v26o-${eid}`)?.value||0);
  const tot = recv + debt + ss + oth;
  if (tot > s.net) { toast('ยอดรวมเกินยอดสะสม!','error'); return; }

  const method = document.getElementById(`v26m-${eid}`)?.value||'เงินสด';
  const note = document.getElementById(`v26pn-${eid}`)?.value||'';
  const oNote = document.getElementById(`v26on-${eid}`)?.value||'';

  const r = await Swal.fire({ title:'ยืนยันจ่ายเงินเดือน', html:`<p><strong>${s.emp.name}</strong></p><p>รับจริง: ฿${formatNum(recv)}</p>${debt>0?`<p>หักหนี้: ฿${formatNum(debt)}</p>`:''}${ss>0?`<p>หักประกันสังคม: ฿${formatNum(ss)}</p>`:''}${oth>0?`<p>หักอื่นๆ: ฿${formatNum(oth)} ${oNote?`(${oNote})`:''}</p>`:''}`, icon:'question', showCancelButton:true, confirmButtonText:'ยืนยัน', cancelButtonText:'ยกเลิก', confirmButtonColor:'#dc2626' });
  if (!r.isConfirmed) return;

  if (method === 'เงินสด' && recv > 0) { try { await assertCashEnough(recv,'จ่ายเงินเดือน'); } catch(e) { Swal.fire({icon:'error',title:'เงินไม่พอ',text:e.message}); return; } }

  const processPayrollSave = async () => {
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    
    const noteDetails = [];
    if (debt > 0) noteDetails.push(`หักหนี้ ฿${debt}`);
    if (ss > 0) noteDetails.push(`หักประกันสังคม ฿${ss}`);
    if (oth > 0) noteDetails.push(`หักอื่นๆ ฿${oth} ${oNote ? '('+oNote+')' : ''}`);
    const noteFull = `${note} (จ่ายทาง ${method}) ${noteDetails.length ? '['+noteDetails.join(', ')+']' : ''}`.trim();

    const { error: pErr, data: pIns } = await db.from('จ่ายเงินเดือน').insert({ 
      employee_id:eid, month:ms, working_days:s.wd, base_salary:s.earn, 
      deduct_withdraw:debt, deduct_absent:s.td, bonus:0, net_paid:recv, 
      paid_date:now.toISOString(), staff_name:USER?.username, note: noteFull 
    }).select().single();

    if (pErr) { toast('Error: ' + pErr.message, 'error'); return; }

    if (method === 'เงินสด' && recv > 0) {
      const { data: sess } = await db.from('cash_session').select('id').eq('status','open').limit(1).single();
      if (sess) await recordCashTx({ sessionId:sess.id, type:'จ่ายเงินเดือน', direction:'out', amount:recv, netAmount:recv, refId:pIns?.id, note:`${s.emp.name} ${note}` });
    }
    if (debt > 0) {
      const { data: advs } = await db.from('เบิกเงิน').select('*').eq('employee_id',eid).eq('status','อนุมัติ').order('date');
      let rem = debt; for (const a of (advs||[])) { if (rem<=0) break; if (a.amount<=rem) { await db.from('เบิกเงิน').update({status:'ชำระแล้ว'}).eq('id',a.id); rem-=a.amount; } else { await db.from('เบิกเงิน').update({amount: a.amount - rem}).eq('id',a.id); rem = 0; } }
    }
    toast(`จ่าย ${s.emp.name} ฿${formatNum(recv)} สำเร็จ`,'success');
    logActivity('จ่ายเงินเดือน',`${s.emp.name} ฿${formatNum(recv)}`);
    renderPayrollV26();
  };

  await processPayrollSave();
};

// ══════════════════════════════════════
// SECTION 4: Expense Modal Override
// ══════════════════════════════════════
window.showAddExpenseModal = function() {
  Swal.fire({
    html: `
      <div class="v26-adv-modal" style="margin:-1.5em; width:calc(100% + 3em); border-top-color:#3b82f6;">
        <div class="v26-adv-header" style="border-bottom-color:#bfdbfe;">
          <span class="sub" style="color:#3b82f6;">Expense Bill</span>
          <h3 style="color:#1e3a8a;"><i class="material-icons-round" style="color:#3b82f6;">receipt</i> บันทึกรายจ่าย</h3>
        </div>
        
        <div class="v26-adv-row">
          <span class="v26-adv-label">รายการ:</span>
          <input type="text" class="v26-adv-reason" id="exp-desc" placeholder="เช่น ค่าข้าว, ค่าไฟ..." required style="width:70%;">
        </div>
        <div class="v26-adv-row">
          <span class="v26-adv-label">หมวดหมู่:</span>
          <select class="v26-adv-reason" id="exp-cat" style="width:70%; cursor:pointer;">
             <option>ทั่วไป</option><option>ค่าสาธารณูปโภค</option><option>ค่าขนส่ง</option>
             <option>ค่าซ่อมบำรุง</option><option>ค่าจ้างแรงงาน</option><option>อื่นๆ</option>
          </select>
        </div>
        <div class="v26-adv-row">
          <span class="v26-adv-label">หมายเหตุ:</span>
          <input type="text" class="v26-adv-reason" id="exp-note" placeholder="รายละเอียด (ถ้ามี)" style="width:70%;">
        </div>
        <div class="v26-adv-row amount" style="border-bottom-color:#bfdbfe; color:#1d4ed8;">
           <span class="v26-adv-label" style="color:#1d4ed8;">จำนวนเงิน (฿):</span>
           <input type="number" class="v26-adv-amount-input" id="exp-amount" placeholder="0" min="1" autofocus style="color:#1e3a8a;">
        </div>

        <div style="margin-top:16px;">
          <span class="v26-adv-label">ช่องทางจ่ายเงิน:</span>
          <div class="v26-adv-method-row">
             <button class="v26-adv-method-btn active" id="exp-m-cash" onclick="document.getElementById('exp-m-val').value='เงินสด'; document.querySelectorAll('.exp-mb').forEach(b=>b.classList.remove('active')); this.classList.add('active');" style="border-color:#3b82f6; color:#1d4ed8;" class="exp-mb">
               <i class="material-icons-round" style="color:#10b981;">payments</i> เงินสด
             </button>
             <button class="v26-adv-method-btn exp-mb" id="exp-m-transfer" onclick="document.getElementById('exp-m-val').value='โอนเงิน'; document.querySelectorAll('.exp-mb').forEach(b=>b.classList.remove('active')); this.classList.add('active');">
               <i class="material-icons-round" style="color:#6366f1;">account_balance</i> โอนเงิน
             </button>
             <input type="hidden" id="exp-m-val" value="เงินสด">
          </div>
        </div>
      </div>
    `,
    showCancelButton: true, confirmButtonText: 'ยืนยันบันทึก', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#3b82f6', width: '450px',
    preConfirm: () => {
      const amt = Number(document.getElementById('exp-amount').value);
      const desc = document.getElementById('exp-desc').value.trim();
      if (!amt || amt <= 0 || !desc) { Swal.showValidationMessage('กรุณากรอกข้อมูลและยอดเงินให้ครบถ้วน'); return false; }
      return { 
         amount: amt, desc, cat: document.getElementById('exp-cat').value,
         note: document.getElementById('exp-note').value, method: document.getElementById('exp-m-val').value
      };
    }
  }).then(async (res) => {
    if (res.isConfirmed) {
      const { amount, desc, cat, note, method } = res.value;
      if (method === 'เงินสด') {
        try { await assertCashEnough(amount, 'จ่ายรายจ่าย'); } catch(e) { Swal.fire({ icon:'error', title:'เงินไม่พอ', text:e.message }); return; }
      }
      
      const processExp = async (outCounts = null, inCounts = null) => {
        const { data: exp, error } = await db.from('รายจ่าย').insert({
          description: desc, amount, method, category: cat, note,
          staff_name: USER?.username, date: new Date().toISOString()
        }).select().single();
        if (error) { toast('Error: '+error.message, 'error'); return; }

        if (method === 'เงินสด') {
          const { data: sess } = await db.from('cash_session').select('id').eq('status','open').limit(1).single();
          if (sess) {
             let finalDenom = null;
             if (outCounts) {
                finalDenom = { ...outCounts };
                if (inCounts) {
                   Object.keys(inCounts).forEach(k => {
                      finalDenom[k] = (finalDenom[k] || 0) - inCounts[k];
                      if (finalDenom[k] === 0) delete finalDenom[k];
                   });
                }
             }
             await recordCashTx({ sessionId:sess.id, type:'รายจ่าย', direction:'out', amount, netAmount:amount, refId:exp?.id, refTable:'รายจ่าย', note:desc, denominations: finalDenom });
          }
        }
        toast('บันทึกรายจ่ายสำเร็จ', 'success');
        logActivity('บันทึกรายจ่าย', `${desc} ฿${formatNum(amount)}`);
        if (typeof loadExpenseData === 'function') loadExpenseData();
      };

      if (method === 'เงินสด') {
        await window.v26StartCashWizard({
          title: `ระบุแบงค์ออกจากลิ้นชักเพื่อจ่าย`,
          desc: 'ระบบจะนำยอดนี้หักออกจากลิ้นชัก',
          targetAmount: amount,
          mustBeExact: false, // allow giving out more and getting change back
          onConfirm: async (breakdown, changeBreakdown) => {
            // change breakdown is optional, but if provided we adjust net
            await processExp(breakdown, changeBreakdown);
          }
        });
      } else {
        await processExp();
      }
    }
  });
};

// ══════════════════════════════════════
// SECTION 5: V26 Cash Flow Wizards
// ══════════════════════════════════════
window.v26StartCashWizard = async function(opts) {
  const { title, desc, targetAmount, mustBeExact, onConfirm } = opts;
  const { data: sess } = await db.from('cash_session').select('denominations').eq('status','open').maybeSingle();
  if (!sess) { toast('ลิ้นชักปิดอยู่','error'); return; }
  let stock = {};
  if (sess.denominations) {
     stock = typeof sess.denominations === 'string' ? JSON.parse(sess.denominations) : sess.denominations;
  }
  
  let currentCounts = {};
  [1000, 500, 100, 50, 20, 10, 5, 2, 1].forEach(k => currentCounts[k]=0);
  
  const getDObj = (d) => {
    switch(Number(d)) {
      case 1000: return { type:'bank', c:'#6b7280', l:'แบงค์พัน' }; // Gray
      case 500: return { type:'bank', c:'#9333ea', l:'แบงค์ห้าร้อย' }; // Purple
      case 100: return { type:'bank', c:'#dc2626', l:'แบงค์ร้อย' }; // Red
      case 50: return { type:'bank', c:'#2563eb', l:'แบงค์ห้าสิบ' }; // Blue
      case 20: return { type:'bank', c:'#16a34a', l:'แบงค์ยี่สิบ' }; // Green
      case 10: return { type:'coin', c:'#475569', l:'เหรียญสิบ', bg:'#f1f5f9' };
      case 5: return { type:'coin', c:'#b45309', l:'เหรียญห้า', bg:'#fffbeb' };
      case 2: return { type:'coin', c:'#b45309', l:'เหรียญสอง', bg:'#fffbeb' };
      case 1: return { type:'coin', c:'#475569', l:'เหรียญบาท', bg:'#f1f5f9' };
    }
  }

  const renderDrawerSection = (list, totalAcc) => {
     let html = '';
     list.forEach(d => {
        const qty = currentCounts[d];
        const max = stock[d] || 0;
        totalAcc.val += qty * d;
        const o = getDObj(d);
        const has = qty > 0;
        
        // 3D Cash Slot styling
        let slotStyle = `background:#1e293b; border-radius:8px; border:2px solid #0f172a; box-shadow:inset 0 10px 15px rgba(0,0,0,0.6); position:relative; overflow:hidden; cursor:pointer; transition:transform 0.1s; height:${o.type==='bank'?'120px':'90px'}; aspect-ratio:${o.type==='bank'?'3/4':'1/1'}; margin:0 auto;`;
        
        let itemInsides = has ? `
          <div style="position:absolute; inset:6px; background:${o.c}; border-radius:${o.type==='coin'?'50%':'4px'}; box-shadow:0 3px 6px rgba(0,0,0,0.5), inset 0 0 10px rgba(255,255,255,0.2); display:flex; flex-direction:column; justify-content:center; align-items:center; border:1px solid rgba(0,0,0,0.2);">
             <div style="font-size:${o.type==='coin'?'18px':'22px'}; color:#fff; font-weight:900; text-shadow:1px 1px 3px rgba(0,0,0,0.6);">฿${d}</div>
             <div style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:10px; color:#fff; font-size:12px; margin-top:4px; font-weight:700;">${qty}</div>
          </div>
        ` : `
          <div style="position:absolute; inset:0; display:flex; justify-content:center; align-items:center; color:#475569; font-size:18px; font-weight:800; opacity:0.4;">฿${d}</div>
        `;
        
        html += `
        <div style="text-align:center;">
           <div style="${slotStyle}" onclick="document.getElementById('v26cw-upd').value='${d},1'; document.getElementById('v26cw-btn').click();" onmousedown="this.style.transform='scale(0.95)';" onmouseup="this.style.transform='scale(1)';">
              ${itemInsides}
           </div>
           <div style="margin-top:8px; font-size:11px; color:${qty>max?'#f87171':'#64748b'}; font-weight:800;">${max<=0?'(หมด)':`สต็อก: ${max}`}</div>
           ${has ? `<button onclick="document.getElementById('v26cw-upd').value='${d},-1'; document.getElementById('v26cw-btn').click();" style="margin-top:4px; border:none; background:#ef4444; color:#fff; border-radius:4px; font-size:12px; padding:2px 10px; cursor:pointer;"><i class="material-icons-round" style="font-size:12px;vertical-align:middle;">remove</i> คืน</button>` : `<div style="height:24px;margin-top:4px;"></div>`}
        </div>`;
     });
     return html;
  };
  
  const redraw = () => {
    let tObj = { val: 0 };
    let bHtml = renderDrawerSection([1000, 500, 100, 50, 20], tObj);
    let cHtml = renderDrawerSection([10, 5, 2, 1], tObj);
    
    let diff = tObj.val - targetAmount;
    let isOk = mustBeExact ? (diff === 0) : (diff >= 0);
    
    let html = `<div class="v26-dwrap">
      <div class="v26-dhead">
        <div><h3 style="margin:0;color:#1e3a8a;font-size:22px;">${title}</h3><p style="margin:4px 0 0;color:#64748b;">${desc}</p></div>
        <div style="text-align:right;">
           <span style="font-size:13px;color:#64748b;font-weight:700;">ยอดที่ต้องจ่าย (เป้าหมาย)</span><br>
           <span class="v26-dtarget">฿${formatNum(targetAmount)}</span>
        </div>
      </div>
      <div style="background:#0f172a; padding:24px; border-radius:16px; border:4px solid #1e293b; box-shadow:0 15px 30px rgba(0,0,0,0.3); margin-top:16px;">
        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; margin-bottom:20px; align-items:end;">
           ${bHtml}
        </div>
        <!-- COINS -->
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; max-width:300px; margin:0 auto;">
           ${cHtml}
        </div>
      </div>
      <div style="background:#f8fafc; padding:20px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
         <span style="font-size:16px;font-weight:700;color:#334155;">รวมที่หยิบแล้ว:</span>
         <span style="font-size:32px;font-weight:800;color:${isOk? '#10b981': (diff>0? '#3b82f6':'#dc2626')}">฿${formatNum(tObj.val)} ${diff>0 ? `<span style="font-size:14px;color:#64748b;margin-left:8px;">(ทอน ฿${formatNum(diff)})</span>` : ''}</span>
      </div>
      <input type="hidden" id="v26cw-upd"><button type="button" id="v26cw-btn" style="display:none;"></button>
    </div>`;
    return { html, total: tObj.val, isOk, diff };
  };

  const showStep1 = async () => {
    let st = redraw();
    const r = await Swal.fire({
      html: st.html, showCancelButton:true, confirmButtonText:'ยืนยันความถูกต้อง', cancelButtonText:'ยกเลิก', width:'800px',
      confirmButtonColor:'#3b82f6',
      didOpen: () => {
        document.getElementById('v26cw-btn').onclick = () => {
           let val = document.getElementById('v26cw-upd').value;
           let [d, delta] = val.split(',').map(Number);
           currentCounts[d] += delta;
           let nst = redraw();
           document.querySelector('.swal2-html-container').innerHTML = nst.html;
           if(nst.isOk) Swal.enableButtons(); else Swal.disableButtons();
           // re-bind
           const nb = document.getElementById('v26cw-btn');
           if(nb) nb.onclick = document.getElementById('v26cw-btn').onclick;
        };
        if(!st.isOk) Swal.disableButtons();
      },
      preConfirm: () => {
         let t = 0; Object.entries(currentCounts).forEach(([k,v]) => { t += Number(k)*v; });
         if (mustBeExact && t !== targetAmount) { Swal.showValidationMessage('ต้องนับให้พอดีเป๊ะ ห้ามขาดห้ามเกิน (ห้ามทอน)'); return false; }
         if (!mustBeExact && t < targetAmount) { Swal.showValidationMessage('จำนวนเงินที่นับไม่พอกับยอดที่ต้องจ่าย'); return false; }
         return t;
      }
    });
    return r.isConfirmed ? r.value : null;
  };

  let totalGiven = await showStep1();
  if (totalGiven === null) return;
  
  if (mustBeExact || totalGiven === targetAmount) {
     onConfirm({...currentCounts}, null); // no change wrapper
     return;
  }
  
  // Step 2: Receive Change
  let changeNeeded = totalGiven - targetAmount;
  let changeCounts = {};
  [1000, 500, 100, 50, 20, 10, 5, 2, 1].forEach(k => changeCounts[k]=0);
  
  const redrawChange = () => {
    let tObj = { val: 0 };
    // We don't limit change by drawer stock, because change is PUT INTO the drawer by the customer.
    // Wait, the change is what we give OUT of the drawer back? No, the change is what the customer gives back.
    // If the Expense cost is 200, we put 1000 OUT to customer. Customer gives 800 BACK as change. We PUT 800 IN drawer.
    // The previous implementation added `delta` to `changeCounts` without checking max. Which is correct!
    
    let cHtml = '';
    [1000, 500, 100, 50, 20, 10, 5, 2, 1].forEach(d => {
       const qty = changeCounts[d];
       const o = getDObj(d);
       tObj.val += qty * d;
       const has = qty > 0;
       
       let slotStyle = `background:#1e293b; border-radius:8px; border:2px solid #0f172a; box-shadow:inset 0 10px 15px rgba(0,0,0,0.6); position:relative; overflow:hidden; cursor:pointer; transition:transform 0.1s; height:${o.type==='bank'?'120px':'90px'}; aspect-ratio:${o.type==='bank'?'3/4':'1/1'}; margin:0 auto;`;
       let itemInsides = has ? `
         <div style="position:absolute; inset:6px; background:${o.c}; border-radius:${o.type==='coin'?'50%':'4px'}; box-shadow:0 3px 6px rgba(0,0,0,0.5), inset 0 0 10px rgba(255,255,255,0.2); display:flex; flex-direction:column; justify-content:center; align-items:center; border:1px solid rgba(0,0,0,0.2);">
            <div style="font-size:${o.type==='coin'?'18px':'22px'}; color:#fff; font-weight:900; text-shadow:1px 1px 3px rgba(0,0,0,0.6);">฿${d}</div>
            <div style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:10px; color:#fff; font-size:12px; margin-top:4px; font-weight:700;">${qty}</div>
         </div>
       ` : `
         <div style="position:absolute; inset:0; display:flex; justify-content:center; align-items:center; color:#475569; font-size:18px; font-weight:800; opacity:0.4;">฿${d}</div>
       `;
       
       cHtml += `
       <div style="text-align:center;">
          <div style="${slotStyle}" onclick="document.getElementById('v26cwc-upd').value='${d},1'; document.getElementById('v26cwc-btn').click();" onmousedown="this.style.transform='scale(0.95)';" onmouseup="this.style.transform='scale(1)';">
             ${itemInsides}
          </div>
          ${has ? `<button onclick="document.getElementById('v26cwc-upd').value='${d},-1'; document.getElementById('v26cwc-btn').click();" style="margin-top:8px; border:none; background:#ef4444; color:#fff; border-radius:4px; font-size:12px; padding:2px 10px; cursor:pointer;"><i class="material-icons-round" style="font-size:12px;vertical-align:middle;">remove</i> เอาออก</button>` : `<div style="height:32px;margin-top:8px;"></div>`}
       </div>`;
    });

    let isOk = tObj.val === changeNeeded;
    let html = `<div class="v26-dwrap" style="border-top:10px solid #10b981;">
       <div class="v26-dhead">
         <div><h3 style="margin:0;color:#065f46;font-size:22px;">ทอนเงินคืนเข้าลิ้นชัก</h3>
         <p style="margin:4px 0 0;color:#64748b;">จัดเรียงเงินทอนใส่ช่องให้ถูกต้อง</p></div>
         <div style="text-align:right;">
           <span style="font-size:13px;color:#10b981;font-weight:700;">เงินทอนที่ต้องได้รับคืน</span><br>
           <span class="v26-dtarget" style="color:#059669;">฿${formatNum(changeNeeded)}</span>
         </div>
       </div>
       <div style="background:#0f172a; padding:24px; border-radius:16px; border:4px solid #1e293b; box-shadow:0 15px 30px rgba(0,0,0,0.3); margin-top:16px; display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; align-items:end;">
         ${cHtml}
       </div>
       <div style="background:#f8fafc; padding:20px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
         <span style="font-size:16px;font-weight:700;color:#334155;">เงินทอนที่นับแล้ว:</span>
         <span style="font-size:32px;font-weight:800;color:${isOk? '#10b981':'#dc2626'}">฿${formatNum(tObj.val)}</span>
      </div>
      <input type="hidden" id="v26cwc-upd"><button type="button" id="v26cwc-btn" style="display:none;"></button>
    </div>`;
    return { html, isOk };
  };

  const showStep2 = async () => {
    let st = redrawChange();
    const r2 = await Swal.fire({
      html: st.html, showCancelButton:false, confirmButtonText:'<i class="material-icons-round">done_all</i> ยืนยันการทอนเงิน', width:'800px',
      confirmButtonColor:'#10b981', allowOutsideClick: false,
      didOpen: () => {
        document.getElementById('v26cwc-btn').onclick = () => {
           let val = document.getElementById('v26cwc-upd').value;
           let [d, delta] = val.split(',').map(Number);
           changeCounts[d] += delta;
           let nst = redrawChange();
           document.querySelector('.swal2-html-container').innerHTML = nst.html;
           if(nst.isOk) Swal.enableButtons(); else Swal.disableButtons();
           const nb = document.getElementById('v26cwc-btn');
           if(nb) nb.onclick = document.getElementById('v26cwc-btn').onclick;
        };
        if(!st.isOk) Swal.disableButtons();
      },
      preConfirm: () => {
         let t = 0; Object.entries(changeCounts).forEach(([k,v]) => { t += Number(k)*v; });
         if (t !== changeNeeded) { Swal.showValidationMessage('คุณต้องนับเงินทอนให้พอดีเป๊ะ ห้ามขาดและห้ามเกิน'); return false; }
         return true;
      }
    });
    return r2.isConfirmed;
  };
  
  let ok2 = await showStep2();
  if (ok2) onConfirm({...currentCounts}, {...changeCounts});
};

// ══════════════════════════════════════
// SECTION 4: CSV EXPORT
// ══════════════════════════════════════
window.v26ShowCSVExport = function() {
  const now = new Date();
  openModal('📊 ส่งออกสรุปรายเดือน', `
    <div style="text-align:center;margin-bottom:16px;">
      <i class="material-icons-round" style="font-size:48px;color:#dc2626;">description</i>
      <p style="font-size:14px;color:#64748b;margin-top:6px;">เลือกเดือนแล้วดาวน์โหลดเป็น CSV</p>
    </div>
    <div class="form-group"><label class="form-label">เดือน</label>
      <input type="month" class="form-input" id="v26cm" value="${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}"></div>
    <div id="v26cpw"></div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" onclick="v26Preview()"><i class="material-icons-round">visibility</i> ตัวอย่าง</button>
      <button class="btn btn-primary" style="flex:2;" onclick="v26DlCSV()"><i class="material-icons-round">download</i> ดาวน์โหลด CSV</button>
    </div>`);
};

async function v26CSVData() {
  const mv = document.getElementById('v26cm')?.value; if (!mv) return null;
  const [y,m] = mv.split('-');
  const ms = `${y}-${m}-01`, me = new Date(+y, +m, 0).toISOString().split('T')[0];
  const ml = new Date(+y, +m-1).toLocaleDateString('th-TH', { month:'long', year:'numeric' });
  const emps = (await loadEmployees()).filter(e => e.status === 'ทำงาน');
  const { data: at } = await db.from('เช็คชื่อ').select('*').gte('date',ms).lte('date',me);
  const { data: av } = await db.from('เบิกเงิน').select('*').eq('status','อนุมัติ').gte('date',ms+'T00:00:00').lte('date',me+'T23:59:59');
  const { data: pd } = await db.from('จ่ายเงินเดือน').select('*').eq('month',ms);

  return { ml, rows: emps.map(emp => {
    const ma = (at||[]).filter(a => a.employee_id === emp.id);
    const days = k => ma.filter(a => a.status === k).map(a => new Date(a.date).getDate()).sort((a,b)=>a-b).join(',') || '-';
    const wc = ma.filter(a => a.status !== 'ขาด').length;
    const td = ma.reduce((s,a) => s+(a.deduction||0), 0);
    const w = emp.daily_wage||0, earn = (wc*w)-td;
    const myA = (av||[]).filter(a => a.employee_id === emp.id);
    const ta = myA.reduce((s,a) => s+a.amount, 0);
    const ad = myA.map(a => `${new Date(a.date).getDate()}/${+m}: ฿${a.amount}`).join('; ') || '-';
    const p = (pd||[]).find(p => p.employee_id === emp.id);
    return { name: `${emp.name} ${emp.lastname||''}`.trim(), pos: emp.position||'', wpd: w, wc, present: days('มา'), late: days('มาสาย'), half: days('ครึ่งวัน'), leave: days('ลา'), absent: days('ขาด'), td, earn, ad, ta, ss: p?.deduct_ss||0, od: p?.deduct_other||0, net: earn, paid: p?.net_paid||0, paidDate: p?.paid_date ? new Date(p.paid_date).toLocaleDateString('th-TH') : '-' };
  })};
}

window.v26Preview = async function() {
  const d = await v26CSVData(); if (!d) { toast('เลือกเดือน','warning'); return; }
  const w = document.getElementById('v26cpw'); if (!w) return;
  let t = `สรุป ${d.ml}\n${'─'.repeat(50)}\n`;
  d.rows.forEach(r => { t += `${r.name} | ${r.pos} | ทำงาน ${r.wc} วัน | สะสม ฿${r.earn} | เบิก ฿${r.ta} | สุทธิ ฿${r.net}\n`; });
  w.innerHTML = `<div class="v26-csv-pre">${t}</div>`;
};

window.v26DlCSV = async function() {
  const d = await v26CSVData(); if (!d) { toast('เลือกเดือน','warning'); return; }
  const h = ['ชื่อ','ตำแหน่ง','ค่าจ้าง/วัน','วันทำงาน','วันที่มา','วันสาย','วันครึ่งวัน','วันลา','วันขาด','หักสาย/ขาด','ค่าจ้างสะสม','เบิกเงิน(รายการ)','ยอดเบิก','หักประกันสังคม','หักอื่นๆ','ยอดสุทธิ','จ่ายแล้ว','วันที่จ่าย'];
  const rows = [h.join(',')];
  d.rows.forEach(r => { rows.push([`"${r.name}"`,`"${r.pos}"`,r.wpd,r.wc,`"${r.present}"`,`"${r.late}"`,`"${r.half}"`,`"${r.leave}"`,`"${r.absent}"`,r.td,r.earn,`"${r.ad}"`,r.ta,r.ss,r.od,r.net,r.paid,`"${r.paidDate}"`].join(',')); });
  const blob = new Blob(['\uFEFF'+rows.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `สรุปพนักงาน_${d.ml.replace(/\s/g,'_')}.csv`; a.click();
  toast('ดาวน์โหลด CSV สำเร็จ','success'); closeModal();
};

console.info('%c[v26-HR] ✅%c White-Red Attendance | Payroll Selector | CSV | Social Security', 'color:#dc2626;font-weight:700', 'color:#6B7280');
