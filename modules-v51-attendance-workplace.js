(function () {
  'use strict';

  console.log('[v51] attendance workplace allocation loaded');

  const ATT_TABLE = 'เช็คชื่อ';
  const EMP_TABLE = 'พนักงาน';
  const PROJECT_TABLE = 'โครงการ';
  const PROJECT_EXPENSE_TABLE = 'รายจ่ายโครงการ';

  const ASSIGN_PREFIX = '[สถานที่ทำงาน:';
  const ATT_REF_PREFIX = 'attendance:';

  const money = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => typeof formatNum === 'function' ? formatNum(value) : money(value).toLocaleString('th-TH');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const js = value => esc(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  const cssEsc = value => (window.CSS && typeof CSS.escape === 'function') ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const staff = () => {
    try { return USER?.username || 'system'; } catch (_) { return 'system'; }
  };
  const todayStr = () => new Date().toISOString().split('T')[0];
  const nowTime = () => new Date().toTimeString().slice(0, 5);

  function injectStyle() {
    if (document.getElementById('v51-att-workplace-style')) return;
    const style = document.createElement('style');
    style.id = 'v51-att-workplace-style';
    style.textContent = `
      .v51-modal{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.58);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px}
      .v51-box{width:min(1040px,100%);max-height:92vh;background:#fff;border-radius:18px;box-shadow:0 28px 80px rgba(15,23,42,.26);overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(226,232,240,.92)}
      .v51-head{padding:22px 24px;border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg,#f8fafc,#eef6ff);display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .v51-kicker{font-size:11px;font-weight:900;color:#2563eb;letter-spacing:.9px;text-transform:uppercase}
      .v51-title{margin:3px 0 0;font-size:22px;font-weight:950;color:#0f172a}
      .v51-sub{margin-top:4px;color:#64748b;font-size:13px;font-weight:650}
      .v51-close{border:0;background:#fff;color:#475569;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 16px rgba(15,23,42,.08)}
      .v51-body{padding:20px 24px;overflow:auto}
      .v51-table{width:100%;border-collapse:separate;border-spacing:0 10px}
      .v51-table th{font-size:12px;color:#64748b;text-align:left;padding:0 12px;font-weight:850}
      .v51-row{background:#fff;border:1px solid #e2e8f0;box-shadow:0 8px 20px rgba(15,23,42,.045)}
      .v51-row td{padding:14px 12px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;vertical-align:middle}
      .v51-row td:first-child{border-left:1px solid #e2e8f0;border-radius:12px 0 0 12px}
      .v51-row td:last-child{border-right:1px solid #e2e8f0;border-radius:0 12px 12px 0}
      .v51-person{display:flex;align-items:center;gap:12px;min-width:210px}
      .v51-avatar{width:40px;height:40px;border-radius:10px;background:#eef2ff;color:#4338ca;display:flex;align-items:center;justify-content:center;font-weight:950}
      .v51-name{font-size:14px;font-weight:900;color:#0f172a}
      .v51-meta{font-size:12px;color:#64748b;margin-top:2px}
      .v51-cost{font-size:15px;font-weight:950;color:#0f172a;text-align:right;white-space:nowrap}
      .v51-seg{display:inline-grid;grid-template-columns:1fr 1fr;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#f8fafc;min-width:220px}
      .v51-seg button{border:0;background:transparent;padding:9px 12px;font-family:inherit;font-size:13px;font-weight:850;color:#475569;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
      .v51-seg button.on{background:#0f172a;color:#fff}
      .v51-project{width:100%;min-width:220px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:10px 12px;font-family:inherit;font-weight:700;color:#0f172a}
      .v51-project:disabled{background:#f1f5f9;color:#94a3b8}
      .v51-actions{padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .v51-summary{display:flex;gap:10px;flex-wrap:wrap;color:#475569;font-size:13px;font-weight:800}
      .v51-chip{background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:8px 12px}
      .v51-btn{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:10px;padding:11px 16px;font-family:inherit;font-weight:850;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
      .v51-btn.primary{border-color:#2563eb;background:#2563eb;color:#fff;box-shadow:0 10px 22px rgba(37,99,235,.22)}
      .v51-empty{padding:34px;text-align:center;color:#64748b;font-weight:750;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:14px}
      .v51-note{margin-top:12px;padding:12px 14px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;border-radius:12px;font-size:12px;font-weight:750;line-height:1.55}
      @media (max-width:760px){.v51-box{max-height:96vh}.v51-head{padding:18px}.v51-body{padding:14px}.v51-table,.v51-table tbody,.v51-table tr,.v51-table td{display:block;width:100%}.v51-table thead{display:none}.v51-row{display:block;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:12px}.v51-row td{border:0!important;padding:10px 12px}.v51-seg{width:100%;min-width:0}.v51-project{min-width:0}.v51-cost{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function stripAssignmentNote(note) {
    return String(note || '')
      .split('\n')
      .filter(line => !line.trim().startsWith(ASSIGN_PREFIX))
      .join('\n')
      .trim();
  }

  function makeAssignmentNote(baseNote, assignment) {
    const base = stripAssignmentNote(baseNote);
    const line = assignment.type === 'project'
      ? `${ASSIGN_PREFIX}โครงการ:${assignment.projectName || '-'}]`
      : `${ASSIGN_PREFIX}หน้าร้าน]`;
    return [base, line].filter(Boolean).join('\n');
  }

  function isWorkingStatus(status) {
    return status && status !== 'ขาด' && status !== 'ลา';
  }

  function calculateDeduction(emp, status) {
    let ded = 0;
    if (emp?.pay_type === 'รายเดือน') {
      const dailyEq = money(emp.salary) / 30;
      if (status === 'ขาด') ded = dailyEq;
      else if (status === 'ครึ่งวัน' || status === 'มาครึ่งวัน') ded = dailyEq * 0.5;
      else if (status === 'มาสาย') ded = dailyEq * 0.05;
    } else {
      const wage = money(emp?.daily_wage);
      if (status === 'ครึ่งวัน' || status === 'มาครึ่งวัน') ded = wage * 0.5;
      else if (status === 'มาสาย') ded = wage * 0.05;
    }
    return Math.round(ded);
  }

  function calculateLaborCost(emp, status, deduction) {
    if (!isWorkingStatus(status)) return 0;
    const base = emp?.pay_type === 'รายเดือน' ? money(emp.salary) / 30 : money(emp?.daily_wage);
    return Math.max(0, Math.round(base - money(deduction)));
  }

  async function loadActiveEmployees() {
    if (typeof loadEmployees === 'function') {
      const rows = await loadEmployees();
      return (rows || []).filter(e => e.status === 'ทำงาน');
    }
    const { data } = await db.from(EMP_TABLE).select('*').eq('status', 'ทำงาน').order('name');
    return data || [];
  }

  function readSelection(empId) {
    const checked = document.querySelector(`input[name="v26r-${cssEsc(empId)}"]:checked`);
    const noteEl = document.getElementById(`v26n-${empId}`);
    return { status: checked?.value || '', note: noteEl?.value || '' };
  }

  async function prepareAttendanceRecords() {
    const date = todayStr();
    const emps = await loadActiveEmployees();
    const { data: existing } = await db.from(ATT_TABLE).select('*').eq('date', date);
    const map = {};
    (existing || []).forEach(row => { map[row.employee_id] = row; });

    const prepared = [];
    let skipped = 0;
    for (const emp of emps) {
      const selected = readSelection(emp.id);
      if (!selected.status) { skipped++; continue; }

      const old = map[emp.id] || {};
      const deduction = calculateDeduction(emp, selected.status);
      const rec = {
        employee_id: emp.id,
        date,
        status: selected.status,
        deduction,
        note: stripAssignmentNote(selected.note),
        staff_name: staff(),
        time_in: old.time_in || (selected.status !== 'ขาด' ? nowTime() : null),
        time_out: old.time_out || null
      };

      prepared.push({
        oldId: old.id || null,
        rec,
        attendance: { id: old.id || `temp-${emp.id}`, ...old, ...rec },
        emp,
        status: selected.status,
        baseNote: selected.note,
        cost: calculateLaborCost(emp, selected.status, deduction)
      });
    }

    return { prepared, skipped };
  }

  async function saveAllFinal() {
    const prepared = window.__v51PreparedRows || [];
    const projects = window.__v51Projects || [];
    let savedCount = 0;

    for (const item of prepared) {
      let type = 'store';
      let project = null;

      if (isWorkingStatus(item.status)) {
        const tempId = item.attendance.id;
        const activeBtn = document.querySelector(`[data-v51-seg="${cssEsc(tempId)}"] button.on`);
        type = activeBtn?.dataset.type || 'store';

        const projectId = document.querySelector(`[data-project-for="${cssEsc(tempId)}"]`)?.value || '';
        project = projects.find(p => p.id === projectId);

        if (type === 'project' && !project) {
          throw new Error(`กรุณาเลือกโครงการให้ ${item.emp.name}`);
        }
      }

      const baseNote = item.baseNote || item.rec.note || '';
      item.rec.note = isWorkingStatus(item.status)
        ? makeAssignmentNote(baseNote, { type, projectName: project?.name || '' })
        : baseNote;

      let finalAttendance = null;
      if (item.oldId) {
        const { data, error } = await db.from(ATT_TABLE).update(item.rec).eq('id', item.oldId).select().single();
        if (error) throw error;
        finalAttendance = data || { ...item.attendance, ...item.rec, id: item.oldId };
      } else {
        const { data, error } = await db.from(ATT_TABLE).insert(item.rec).select().single();
        if (error) throw error;
        finalAttendance = data;
      }

      item.attendance = finalAttendance;
      await removeProjectLabor(finalAttendance.id);

      if (isWorkingStatus(item.status) && type === 'project') {
        await addProjectLabor(item, project);
      }

      savedCount++;
    }

    return savedCount;
  }

  async function removeProjectLabor(attendanceId) {
    if (!attendanceId) return [];
    const { data: removed, error } = await db.from(PROJECT_EXPENSE_TABLE)
      .delete()
      .ilike('notes', `%${ATT_REF_PREFIX}${attendanceId}%`)
      .select('id,project_id,amount');
    if (error) throw error;

    for (const row of removed || []) {
      if (!row.project_id) continue;
      const { data: project } = await db.from(PROJECT_TABLE).select('total_expenses').eq('id', row.project_id).maybeSingle();
      await db.from(PROJECT_TABLE).update({
        total_expenses: Math.max(0, money(project?.total_expenses) - money(row.amount))
      }).eq('id', row.project_id);
    }
    return removed || [];
  }

  async function addProjectLabor(item, project) {
    const amount = money(item.cost);
    if (!item.attendance?.id || !project?.id || amount <= 0) return;

    const desc = `ค่าแรง ${item.emp.name || ''} ${item.emp.lastname || ''}`.trim();
    const notes = `${ATT_REF_PREFIX}${item.attendance.id} | ${item.status} | ${todayStr()}`;
    const { error } = await db.from(PROJECT_EXPENSE_TABLE).insert({
      project_id: project.id,
      description: desc,
      category: 'ค่าแรง',
      amount,
      type: 'labor',
      notes,
      paid_at: null
    });
    if (error) throw error;

    const { data: current } = await db.from(PROJECT_TABLE).select('total_expenses').eq('id', project.id).maybeSingle();
    await db.from(PROJECT_TABLE).update({
      total_expenses: money(current?.total_expenses) + amount
    }).eq('id', project.id);
  }

  function rowControls(item, projects) {
    const disabled = projects.length ? '' : 'disabled';
    return `
      <div class="v51-seg" data-v51-seg="${esc(item.attendance.id)}">
        <button type="button" class="on" data-type="store" onclick="v51SetWorkplace('${js(item.attendance.id)}','store')"><i class="material-icons-round" style="font-size:16px">storefront</i>หน้าร้าน</button>
        <button type="button" data-type="project" onclick="v51SetWorkplace('${js(item.attendance.id)}','project')" ${disabled}><i class="material-icons-round" style="font-size:16px">business_center</i>โครงการ</button>
      </div>`;
  }

  async function openWorkplaceModal(preparedRows, skippedCount) {
    injectStyle();
    window.__v51PreparedRows = preparedRows || [];
    window.__v51SkippedCount = skippedCount || 0;

    const rows = (preparedRows || []).filter(x => isWorkingStatus(x.status));
    const { data: projects } = await db.from(PROJECT_TABLE).select('id,name,status,total_expenses').eq('status', 'active').order('name');
    const activeProjects = projects || [];
    window.__v51Projects = activeProjects;

    if (!rows.length) {
      const ok = confirm('ไม่มีพนักงานที่มาทำงานจริง (มีเฉพาะ ลา/ขาด) ต้องการบันทึกเช็คชื่อตอนนี้หรือไม่?');
      if (!ok) return;
      try {
        const savedCount = await saveAllFinal();
        toast?.(`บันทึกเช็คชื่อ ${savedCount} คน${skippedCount ? ` (ยังไม่ลง ${skippedCount})` : ''}`, 'success');
        logActivity?.('เช็คชื่อพนักงาน', `บันทึก ${savedCount} คน`);
        window.renderAttendance?.();
      } catch (e) {
        console.error('[v51] save no-work attendance:', e);
        toast?.('บันทึกไม่สำเร็จ: ' + e.message, 'error');
      }
      return;
    }

    document.getElementById('v51-workplace-modal')?.remove();
    const totalCost = rows.reduce((s, item) => s + money(item.cost), 0);
    const modal = document.createElement('div');
    modal.id = 'v51-workplace-modal';
    modal.className = 'v51-modal';
    modal.innerHTML = `
      <div class="v51-box">
        <div class="v51-head">
          <div>
            <div class="v51-kicker">Attendance Allocation</div>
            <h2 class="v51-title">เลือกสถานที่ทำงานของพนักงาน</h2>
            <div class="v51-sub">ยังไม่บันทึกจริง ตรวจรายชื่อและเลือกสถานที่ก่อน แล้วค่อยกดบันทึก</div>
          </div>
          <button class="v51-close" onclick="document.getElementById('v51-workplace-modal')?.remove(); renderAttendance?.();"><i class="material-icons-round">close</i></button>
        </div>
        <div class="v51-body">
          ${activeProjects.length ? '' : '<div class="v51-empty">ยังไม่มีโครงการ active ถ้าต้องลงค่าแรงเข้าโครงการ ให้เพิ่มหรือเปิดโครงการก่อน</div>'}
          <table class="v51-table">
            <thead><tr><th>พนักงาน</th><th>ค่าแรงวันนี้</th><th>สถานที่</th><th>เลือกโครงการ</th></tr></thead>
            <tbody>
              ${rows.map(item => `
                <tr class="v51-row" data-att="${esc(item.attendance.id)}" data-emp="${esc(item.emp.id)}">
                  <td>
                    <div class="v51-person">
                      <div class="v51-avatar">${esc((item.emp.name || '?')[0])}</div>
                      <div><div class="v51-name">${esc(item.emp.name)} ${esc(item.emp.lastname || '')}</div><div class="v51-meta">${esc(item.status)} · ${esc(item.emp.position || 'พนักงาน')}</div></div>
                    </div>
                  </td>
                  <td><div class="v51-cost">฿${fmt(item.cost)}</div></td>
                  <td>${rowControls(item, activeProjects)}</td>
                  <td>
                    <select class="v51-project" data-project-for="${esc(item.attendance.id)}" disabled>
                      <option value="">เลือกโครงการ</option>
                      ${activeProjects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
                    </select>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div class="v51-note"><strong>หมายเหตุ:</strong> ถ้าเลือก “หน้าร้าน” ระบบจะไม่สร้างรายจ่ายโครงการ และค่าแรงยังคงถูกใช้ในระบบจ่ายเงินเดือนเดิมตามปกติ ถ้าเลือก “โครงการ” ระบบจะเพิ่มต้นทุนค่าแรงเข้าโครงการนั้นเพื่อดูต้นทุนงาน แต่ยังไม่ถือว่าเป็นการจ่ายเงินเดือนจริง</div>
        </div>
        <div class="v51-actions">
          <div class="v51-summary">
            <span class="v51-chip">พนักงาน ${rows.length} คน</span>
            <span class="v51-chip">ค่าแรงรวม ฿${fmt(totalCost)}</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="v51-btn" onclick="document.getElementById('v51-workplace-modal')?.remove();">ยกเลิก</button>
            <button class="v51-btn primary" id="v51-save-workplace" onclick="v51SaveWorkplaceAssignments()"><i class="material-icons-round">save</i>บันทึกสถานที่ทำงาน</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    window.__v51WorkplaceRows = rows;
  }

  window.v51SetWorkplace = function (attendanceId, type) {
    const seg = document.querySelector(`[data-v51-seg="${cssEsc(attendanceId)}"]`);
    const select = document.querySelector(`[data-project-for="${cssEsc(attendanceId)}"]`);
    if (!seg || !select) return;
    seg.querySelectorAll('button').forEach(btn => btn.classList.toggle('on', btn.dataset.type === type));
    select.disabled = type !== 'project';
    if (type !== 'project') select.value = '';
  };

  window.v51SaveWorkplaceAssignments = async function () {
    const btn = document.getElementById('v51-save-workplace');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="material-icons-round">sync</i>กำลังบันทึก...'; }
    try {
      const savedCount = await saveAllFinal();
      const skippedCount = window.__v51SkippedCount || 0;
      logActivity?.('เช็คชื่อพนักงานและจัดสถานที่', `บันทึก ${savedCount} คน`);
      toast?.(`บันทึกข้อมูลเรียบร้อย ${savedCount} คน${skippedCount ? ` (ยังไม่ลง ${skippedCount})` : ''}`, 'success');
      document.getElementById('v51-workplace-modal')?.remove();
      window.renderAttendance?.();
    } catch (e) {
      console.error('[v51] save workplace:', e);
      toast?.('บันทึกสถานที่ทำงานไม่สำเร็จ: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="material-icons-round">save</i>บันทึกสถานที่ทำงาน'; }
    }
  };

  const originalRenderAttendance = window.renderAttendance;
  window.renderAttendance = async function () {
    const result = await originalRenderAttendance?.apply(this, arguments);
    setTimeout(() => {
      const btn = document.getElementById('v26-save-btn');
      if (btn) {
        btn.innerHTML = '<i class="material-icons-round">navigate_next</i> ถัดไป';
        btn.title = 'ตรวจรายชื่อ แล้วเลือกสถานที่ทำงานก่อนบันทึก';
      }
    }, 30);
    return result;
  };

  window.v51AttendanceNext = async function () {
    injectStyle();
    const btn = document.getElementById('v26-save-btn');
    if (btn) { btn.classList.add('saving'); btn.innerHTML = '<i class="material-icons-round">sync</i> กำลังเตรียมข้อมูล...'; }
    try {
      const { prepared, skipped } = await prepareAttendanceRecords();
      if (!prepared.length) {
        toast?.('กรุณาเลือกสถานะเช็คชื่ออย่างน้อย 1 คน', 'warning');
        return;
      }
      await openWorkplaceModal(prepared, skipped);
    } catch (e) {
      console.error('[v51] attendance next:', e);
      toast?.('เตรียมข้อมูลไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      if (btn) { btn.classList.remove('saving'); btn.innerHTML = '<i class="material-icons-round">navigate_next</i> ถัดไป'; }
    }
  };

  window.v26SaveAll = window.v51AttendanceNext;
  try { renderAttendance = window.renderAttendance; } catch (_) {}
  try { v26SaveAll = window.v51AttendanceNext; } catch (_) {}

  function v51ForceBindAttendanceButton() {
    const btn = document.getElementById('v26-save-btn');
    if (!btn) return;

    btn.innerHTML = '<i class="material-icons-round">navigate_next</i> ถัดไป';
    btn.title = 'ตรวจรายชื่อ แล้วเลือกสถานที่ทำงานก่อนบันทึก';
    btn.removeAttribute('onclick');
    btn.onclick = null;

    if (btn.dataset.v51Bound === '1') return;
    btn.dataset.v51Bound = '1';

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.v51AttendanceNext();
    }, true);
  }

  setInterval(v51ForceBindAttendanceButton, 500);
})();
