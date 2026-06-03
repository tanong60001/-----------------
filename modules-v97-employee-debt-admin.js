/* ════════════════════════════════════════════════════════════════════
   modules-v97-employee-debt-admin.js
   ─────────────────────────────────────────────────────────────────────
   เครื่องมือแอดมิน: "ตั้งค่า/เคลียร์ยอดที่พนักงานค้างร้าน"
   • อยู่ในหน้าแอดมิน (การ์ดเมนู) · ป้องกันด้วยรหัส 2548
   • แสดงยอดเบิกค้าง (พนักงานค้างร้าน) ปัจจุบันของแต่ละคน
   • ตั้งยอดที่ถูกต้องเองได้ (กรณียอดไม่ตรง) → ระบบปรับให้
   • ปุ่ม "จ่ายเงินโอน (เคลียร์ 0)" → ถ้าพนักงานจ่ายคืนแล้ว เคลียร์ยอดเป็น 0
   • กำหนดวันที่จ่าย/ปรับได้

   หลักการ: ยอดค้าง = ผลรวมรายการ 'เบิกเงิน' สถานะ 'อนุมัติ' (ตรงกับ wallet v95)
     - ตั้งยอดให้น้อยลง  → ตัดหนี้ FIFO (mark 'ชำระแล้ว' / ลดยอด)
     - ตั้งยอดให้มากขึ้น  → เพิ่มรายการปรับยอด (status 'อนุมัติ')
   ไม่แก้ schema
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ADV_TABLE = 'เบิกเงิน';
  const PIN = '2548';

  function num(v) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function money(v) { return (typeof window.formatNum === 'function') ? window.formatNum(v) : num(v).toLocaleString('th-TH'); }
  function notify(m, t) { if (typeof toast === 'function') toast(m, t || 'info'); }
  function staff() { try { return (typeof USER !== 'undefined' && USER) ? USER.username : 'admin'; } catch (_) { return 'admin'; } }
  function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function firstOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }

  // ──────────────────────────────────────
  // CSS
  // ──────────────────────────────────────
  (function injectCSS() {
    if (document.getElementById('v97-css')) return;
    const s = document.createElement('style');
    s.id = 'v97-css';
    s.textContent = `
      .v97-wrap{max-width:920px;margin:0 auto;padding:0 8px 40px;}
      .v97-hero{background:linear-gradient(135deg,#7c2d12,#b45309);border-radius:18px;padding:20px 24px;color:#fff;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;}
      .v97-hero h2{margin:0;display:flex;align-items:center;gap:8px;font-size:22px;}
      .v97-back{background:rgba(255,255,255,.15);border:none;color:#fff;padding:9px 14px;border-radius:10px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
      .v97-toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;}
      .v97-fld label{display:block;font-size:12px;font-weight:800;color:#64748b;margin-bottom:4px;}
      .v97-fld input{height:44px;border:1.5px solid #e2e8f0;border-radius:10px;padding:0 12px;font-size:15px;font-weight:700;box-sizing:border-box;}
      .v97-search{flex:1;min-width:180px;}
      .v97-search input{width:100%;}
      .v97-card{background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-bottom:10px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;}
      .v97-card.debt{border-color:#fca5a5;background:#fff7f7;}
      .v97-card.clear{border-color:#a7f3d0;background:#f0fdf4;}
      .v97-nm{font-weight:900;color:#1e293b;font-size:16px;display:flex;align-items:center;gap:8px;}
      .v97-editbtn{border:1px solid #cbd5e1;background:#fff;color:#475569;width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;}
      .v97-editbtn:hover{background:#eff6ff;border-color:#93c5fd;color:#2563eb;}
      .v97-editbtn i{font-size:16px;}
      .v97-sub{font-size:12px;color:#64748b;font-weight:700;margin-top:2px;}
      .v97-curr{font-size:13px;font-weight:800;margin-top:4px;}
      .v97-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
      .v97-set{width:120px;height:42px;border:1.5px solid #cbd5e1;border-radius:10px;padding:0 10px;font-size:15px;font-weight:800;text-align:right;}
      .v97-btn{height:42px;border:none;border-radius:10px;padding:0 14px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-size:13px;font-family:inherit;}
      .v97-btn.save{background:#1e293b;color:#fff;}
      .v97-btn.zero{background:#059669;color:#fff;}
      .v97-btn:disabled{opacity:.45;cursor:not-allowed;}
      @media(max-width:640px){.v97-card{grid-template-columns:1fr;}.v97-right{justify-content:flex-start;}}
    `;
    document.head.appendChild(s);
  })();

  // ──────────────────────────────────────
  // โหลดยอดค้างรายคน
  // ──────────────────────────────────────
  async function loadDebts() {
    const emps = (await loadEmployees()).filter(e => e.status === 'ทำงาน');
    const { data: adv } = await db.from(ADV_TABLE).select('employee_id,amount,status').eq('status', 'อนุมัติ');
    const debt = {};
    (adv || []).forEach(a => { const id = String(a.employee_id); debt[id] = (debt[id] || 0) + num(a.amount); });
    return emps.map(e => ({ emp: e, debt: debt[String(e.id)] || 0 }));
  }

  // ──────────────────────────────────────
  // เปิดเครื่องมือ (ผ่านรหัส)
  // ──────────────────────────────────────
  window.v97OpenDebtTool = async function () {
    const r = await Swal.fire({
      title: 'ใส่รหัสผ่านแอดมิน',
      input: 'password',
      inputPlaceholder: 'รหัส 4 หลัก',
      inputAttributes: { maxlength: 8, autocapitalize: 'off', autocorrect: 'off', inputmode: 'numeric' },
      showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#b45309',
    });
    if (!r.isConfirmed) return;
    if (String(r.value).trim() !== PIN) { Swal.fire({ icon: 'error', title: 'รหัสไม่ถูกต้อง' }); return; }
    renderTool();
  };

  async function renderTool() {
    const page = document.getElementById('page-admin');
    if (!page) return;
    page.innerHTML = '<div style="padding:48px;text-align:center;color:#64748b;font-weight:800">กำลังโหลด...</div>';
    let rows;
    try { rows = await loadDebts(); } catch (e) { notify('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error'); return; }
    window._v97Rows = rows;
    const totalDebt = rows.reduce((s, x) => s + x.debt, 0);

    page.innerHTML = `
      <div class="v97-wrap">
        <div class="v97-hero">
          <div>
            <button class="v97-back" onclick="renderAdmin()"><i class="material-icons-round">arrow_back</i> กลับ</button>
            <h2 style="margin-top:10px;"><i class="material-icons-round">account_balance_wallet</i> ตั้งหนี้เดิมยกมา</h2>
            <div style="opacity:.85;font-weight:600;font-size:13px;margin-top:2px;">บันทึกหนี้เก่าที่พนักงานติดไว้ก่อนเริ่มใช้ระบบ · เคลียร์เมื่อจ่ายคืน</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;opacity:.85;">พนักงานค้างร้านรวม</div>
            <div style="font-size:26px;font-weight:900;">฿${money(totalDebt)}</div>
            <button class="v97-btn" style="background:#fff;color:#b91c1c;margin-top:10px;" onclick="window.v97ResetPayroll()"><i class="material-icons-round" style="font-size:16px;">restart_alt</i> รีเซตระบบเงินเดือน</button>
          </div>
        </div>

        <div class="v97-toolbar">
          <div class="v97-fld"><label>วันที่หนี้ยกมา / ปรับ</label>
            <input type="date" id="v97-date" value="${firstOfMonth()}"></div>
          <div class="v97-fld v97-search"><label>ค้นหาพนักงาน</label>
            <input type="text" id="v97-search" placeholder="พิมพ์ชื่อ..." oninput="window.v97Filter(this.value)"></div>
        </div>

        <div id="v97-list">
          ${rows.map(rowCard).join('')}
        </div>
      </div>`;
  }

  function rowCard(x) {
    const { emp, debt } = x;
    const cls = debt > 0 ? 'debt' : 'clear';
    const name = `${emp.name} ${emp.lastname || ''}`.trim();
    return `
      <div class="v97-card ${cls}" data-name="${name.toLowerCase()}">
        <div>
          <div class="v97-nm">${name}
            <button class="v97-editbtn" title="แก้ไขข้อมูลพนักงาน" onclick="window.v97EditEmp('${emp.id}')"><i class="material-icons-round">edit</i></button>
          </div>
          <div class="v97-sub">${emp.position || 'พนักงาน'} · ${emp.pay_type || ''}</div>
          <div class="v97-curr" style="color:${debt > 0 ? '#dc2626' : '#059669'};">
            ${debt > 0 ? `ค้างร้านปัจจุบัน ฿${money(debt)}` : 'ไม่มียอดค้าง ✓'}
          </div>
        </div>
        <div class="v97-right">
          <input type="number" class="v97-set" id="v97-set-${emp.id}" value="${debt}" min="0" placeholder="หนี้ยกมา">
          <button class="v97-btn save" onclick="window.v97SetDebt('${emp.id}')"><i class="material-icons-round" style="font-size:16px;">save</i> บันทึกหนี้ยกมา</button>
          <button class="v97-btn zero" onclick="window.v97ClearDebt('${emp.id}')" ${debt > 0 ? '' : 'disabled'}><i class="material-icons-round" style="font-size:16px;">sync_alt</i> จ่ายโอน (เคลียร์ 0)</button>
        </div>
      </div>`;
  }

  window.v97Filter = function (q) {
    const term = String(q || '').trim().toLowerCase();
    document.querySelectorAll('#v97-list .v97-card').forEach(c => {
      c.style.display = (!term || (c.getAttribute('data-name') || '').includes(term)) ? '' : 'none';
    });
  };

  // ── แก้ไขข้อมูล/ชื่อพนักงาน ──
  window.v97EditEmp = function (empId) {
    const x = (window._v97Rows || []).find(r => String(r.emp.id) === String(empId));
    if (!x) return;
    if (typeof window.showEmployeeModal === 'function') window.showEmployeeModal(x.emp);
    else if (typeof showEmployeeModal === 'function') showEmployeeModal(x.emp);
    else notify('ไม่พบฟอร์มแก้ไขพนักงาน', 'error');
  };

  function getDate() { return (document.getElementById('v97-date') || {}).value || todayStr(); }

  // ── ตั้งยอดค้างให้เท่ากับค่าที่กรอก ──
  window.v97SetDebt = async function (empId) {
    const x = (window._v97Rows || []).find(r => String(r.emp.id) === String(empId));
    if (!x) return;
    const target = Math.max(0, num(document.getElementById(`v97-set-${empId}`)?.value));
    const dateStr = getDate();
    const diff = x.debt - target;
    if (Math.abs(diff) < 0.01) { notify('ยอดเท่าเดิม ไม่มีการเปลี่ยนแปลง', 'info'); return; }

    const msg = diff > 0
      ? `ลดหนี้ยกมาของ <b>${x.emp.name}</b><br>จาก ฿${money(x.debt)} → ฿${money(target)} (ตัด ฿${money(diff)})`
      : `ตั้งหนี้ยกมาของ <b>${x.emp.name}</b><br>เป็น ฿${money(target)} (เพิ่ม ฿${money(-diff)})`;
    const c = await Swal.fire({ title: 'ยืนยันบันทึกหนี้เดิมยกมา', html: `<div style="text-align:left;line-height:1.7;">${msg}<br><span style="color:#64748b;font-size:13px;">ลงวันที่: ${dateStr}</span></div>`, icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#1e293b' });
    if (!c.isConfirmed) return;
    await applyTarget(empId, x.emp, target, dateStr, 'หนี้เดิมยกมา');
  };

  // ── เคลียร์ยอดเป็น 0 (จ่ายคืนโดยโอน) ──
  window.v97ClearDebt = async function (empId) {
    const x = (window._v97Rows || []).find(r => String(r.emp.id) === String(empId));
    if (!x || x.debt <= 0) return;
    const dateStr = getDate();
    const c = await Swal.fire({
      title: 'เคลียร์ยอดค้างเป็น 0',
      html: `<div style="text-align:left;line-height:1.8;"><b>${x.emp.name}</b> จ่ายคืนยอดค้าง <b style="color:#059669;">฿${money(x.debt)}</b> ครบแล้ว<br>บันทึกเป็น "จ่ายเงินโอน"<br><span style="color:#64748b;font-size:13px;">วันที่: ${dateStr}</span></div>`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยันเคลียร์ 0', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#059669',
    });
    if (!c.isConfirmed) return;
    await applyTarget(empId, x.emp, 0, dateStr, 'จ่ายคืนโดยโอน (เคลียร์โดยแอดมิน)');
  };

  // ── รีเซตระบบเงินเดือน: ลบเบิก/จ่ายทั้งหมด เก็บการลงเวลาไว้ ──
  window.v97ResetPayroll = async function () {
    const warn = await Swal.fire({
      icon: 'warning',
      title: 'รีเซตระบบเงินเดือน?',
      html: `<div style="text-align:left;line-height:1.85;font-size:14px;">
        จะ <b style="color:#dc2626;">ลบทั้งหมด</b> และเริ่มนับใหม่ตั้งแต่วันที่ 1 เดือนนี้:
        <ul style="margin:8px 0;padding-left:20px;">
          <li>ประวัติการ <b>เบิกเงิน / หนี้ค้าง</b> ทั้งหมด</li>
          <li>ประวัติการ <b>จ่ายเงินเดือน</b> ทั้งหมด</li>
        </ul>
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:8px 10px;color:#047857;font-weight:700;">✓ การลงเวลา (เช็คชื่อ) จะถูกเก็บไว้เหมือนเดิม</div>
        <div style="margin-top:8px;color:#b91c1c;font-weight:700;">การลบนี้ย้อนกลับไม่ได้</div>
      </div>`,
      input: 'text',
      inputPlaceholder: 'พิมพ์ RESET เพื่อยืนยัน',
      showCancelButton: true, confirmButtonText: 'รีเซตเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626',
      preConfirm: (v) => { if (String(v).trim().toUpperCase() !== 'RESET') { Swal.showValidationMessage('พิมพ์ RESET ให้ถูกต้อง'); return false; } return true; },
    });
    if (!warn.isConfirmed) return;

    const pin = await Swal.fire({ title: 'ยืนยันด้วยรหัสแอดมิน', input: 'password', inputPlaceholder: 'รหัส', showCancelButton: true, confirmButtonText: 'ยืนยันรีเซต', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
    if (!pin.isConfirmed) return;
    if (String(pin.value).trim() !== PIN) { Swal.fire({ icon: 'error', title: 'รหัสไม่ถูกต้อง' }); return; }

    try {
      Swal.fire({ title: 'กำลังรีเซต...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const r1 = await db.from(ADV_TABLE).delete().not('id', 'is', null);
      if (r1.error) throw r1.error;
      const r2 = await db.from('จ่ายเงินเดือน').delete().not('id', 'is', null);
      if (r2.error) throw r2.error;
      if (typeof logActivity === 'function') logActivity('รีเซตระบบเงินเดือน', `โดย ${staff()} เริ่มใหม่ ${firstOfMonth()}`);
      await Swal.fire({ icon: 'success', title: 'รีเซตเรียบร้อย', text: 'ระบบเงินเดือนเริ่มนับใหม่แล้ว ตอนนี้ใส่หนี้เดิมยกมาของแต่ละคนได้เลย', confirmButtonColor: '#059669' });
      renderTool();
    } catch (e) {
      console.error('[v97] reset:', e);
      Swal.fire({ icon: 'error', title: 'รีเซตไม่สำเร็จ', text: e.message });
    }
  };

  // ── ปรับ ledger เบิกเงินให้ยอดค้าง = target ──
  async function applyTarget(empId, emp, target, dateStr, reasonLabel) {
    try {
      const { data: advs } = await db.from(ADV_TABLE).select('*').eq('employee_id', empId).eq('status', 'อนุมัติ').order('date', { ascending: true });
      const current = (advs || []).reduce((s, a) => s + num(a.amount), 0);
      const diff = current - target;

      if (diff > 0.009) {
        // ตัดหนี้ FIFO
        let rem = diff;
        for (const a of (advs || [])) {
          if (rem <= 0.009) break;
          const amt = num(a.amount);
          if (amt <= rem + 0.009) {
            await db.from(ADV_TABLE).update({ status: 'ชำระแล้ว', reason: `${a.reason || ''} | ${reasonLabel} ${dateStr}`.trim() }).eq('id', a.id);
            rem -= amt;
          } else {
            await db.from(ADV_TABLE).update({ amount: amt - rem }).eq('id', a.id);
            rem = 0;
          }
        }
      } else if (diff < -0.009) {
        // เพิ่มหนี้ (รายการปรับยอด)
        await db.from(ADV_TABLE).insert({
          employee_id: empId, amount: -diff, reason: reasonLabel,
          date: `${dateStr}T12:00:00`, status: 'อนุมัติ', approved_by: staff(),
        });
      }

      if (typeof logActivity === 'function') logActivity('ปรับยอดค้างพนักงาน', `${emp.name}: ฿${money(current)} → ฿${money(target)} (${reasonLabel})`);
      Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', text: `${emp.name} · ยอดค้าง ฿${money(target)}`, timer: 1600, showConfirmButton: false });
      renderTool();
    } catch (e) {
      console.error('[v97] applyTarget:', e);
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e.message });
    }
  }

  // ──────────────────────────────────────
  // เสียบการ์ดเข้าเมนูแอดมิน (แพตเทิร์นเดียวกับ v88)
  // ──────────────────────────────────────
  function injectCard() {
    const grid = document.querySelector('#page-admin .v36-admin-menu-grid');
    if (!grid || grid.querySelector('.v97-menu')) return;
    grid.insertAdjacentHTML('beforeend',
      `<button type="button" class="v36-admin-menu-card v97-menu" onclick="v97OpenDebtTool()">
        <span class="v36-admin-menu-icon"><i class="material-icons-round">account_balance_wallet</i></span>
        <span class="v36-admin-menu-text">
          <span class="v36-admin-menu-title">ตั้งค่ายอดค้างพนักงาน</span>
          <span class="v36-admin-menu-desc">แก้ยอดที่ไม่ตรง / เคลียร์ยอดจ่ายคืน (รหัส)</span>
        </span>
        <i class="material-icons-round v36-admin-menu-arrow">chevron_right</i>
      </button>`);
  }

  function boot() {
    const timer = setInterval(injectCard, 400);
    setTimeout(() => clearInterval(timer), 12000);
    new MutationObserver(injectCard).observe(document.body, { childList: true, subtree: true });
    console.log('[v97] employee-debt-admin loaded');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
