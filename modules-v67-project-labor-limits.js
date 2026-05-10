(function () {
  'use strict';

  console.log('[v67] project labor limit tools loaded');

  const STORE_KEY = 'sk:v67:project_labor_limits:v1';
  const PROJECT_EXPENSE_TABLE = 'รายจ่ายโครงการ';
  const LABOR_CATEGORY = 'ค่าแรง';
  const BUDGET_TYPE = 'labor_limit';
  const BUDGET_MARK = 'SK_LABOR_LIMIT_BUDGET:';
  const PAY_MARK = 'SK_LABOR_LIMIT_PAY:';

  const num = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => {
    try { return typeof formatNum === 'function' ? formatNum(value) : num(value).toLocaleString('th-TH'); }
    catch (_) { return num(value).toLocaleString('th-TH'); }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
  const uid = () => `lab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  function injectStyle() {
    if (document.getElementById('v67-project-labor-style')) return;
    const style = document.createElement('style');
    style.id = 'v67-project-labor-style';
    style.textContent = `
      .v67-labor-panel{margin:14px 0;border:1px solid #dbeafe;background:linear-gradient(180deg,#ffffff,#f8fbff);border-radius:18px;box-shadow:0 12px 30px rgba(15,23,42,.055);overflow:hidden}
      .v67-labor-head{padding:16px 18px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;border-bottom:1px solid #eef2f7}
      .v67-labor-title{display:flex;align-items:center;gap:10px;color:#0f172a;font-size:18px;font-weight:950}
      .v67-labor-title i{width:42px;height:42px;border-radius:13px;background:#eff6ff;color:#2563eb;display:grid;place-items:center}
      .v67-labor-sub{margin-top:3px;color:#64748b;font-size:12px;font-weight:800;line-height:1.45}
      .v67-labor-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .v67-btn{height:40px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;color:#334155;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font:900 13px var(--font-thai,'Prompt'),sans-serif;cursor:pointer}
      .v67-btn.primary{background:#2563eb;border-color:#2563eb;color:#fff;box-shadow:0 10px 20px rgba(37,99,235,.18)}
      .v67-btn.good{background:#059669;border-color:#059669;color:#fff;box-shadow:0 10px 20px rgba(5,150,105,.16)}
      .v67-btn.danger{color:#dc2626;border-color:#fecaca;background:#fff}
      .v67-labor-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 18px;background:#f8fafc}
      .v67-sum{border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:12px}
      .v67-sum span{display:block;color:#64748b;font-size:11px;font-weight:900}
      .v67-sum b{display:block;margin-top:4px;color:#0f172a;font-size:21px;font-weight:950}
      .v67-sum.good b{color:#059669}.v67-sum.warn b{color:#dc2626}
      .v67-labor-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:12px;padding:16px 18px}
      .v67-worker-card{border:1px solid #e2e8f0;background:#fff;border-radius:16px;padding:14px;display:grid;gap:10px}
      .v67-worker-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .v67-worker-name{font-weight:950;color:#0f172a;line-height:1.25}
      .v67-worker-chip{font-size:10px;font-weight:950;border-radius:999px;padding:4px 8px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;white-space:nowrap}
      .v67-worker-money{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .v67-mini{border:1px solid #eef2f7;background:#f8fafc;border-radius:12px;padding:9px}
      .v67-mini span{display:block;color:#64748b;font-size:10px;font-weight:900}
      .v67-mini b{display:block;margin-top:2px;color:#0f172a;font-size:16px;font-weight:950}
      .v67-mini.remain b{color:#047857}.v67-mini.over b{color:#dc2626}
      .v67-bar{height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden}
      .v67-bar>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#2563eb);width:0}
      .v67-worker-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
      .v67-empty{padding:26px 18px;text-align:center;color:#64748b;font-weight:850}
      .v67-empty i{display:block;color:#cbd5e1;font-size:42px;margin-bottom:8px}
      .v67-expense-box{margin:10px 0;border:1.5px solid #bfdbfe;background:#eff6ff;border-radius:15px;padding:12px}
      .v67-expense-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:9px}
      .v67-expense-title{display:flex;align-items:center;gap:8px;color:#1e3a8a;font-weight:950;font-size:13px}
      .v67-labor-select{display:grid;gap:8px;max-height:218px;overflow:auto;padding-right:2px}
      .v67-labor-option{width:100%;border:1px solid #dbeafe;background:#fff;border-radius:13px;padding:10px;display:grid;grid-template-columns:1fr auto;gap:8px;cursor:pointer;text-align:left;font:inherit}
      .v67-labor-option:hover,.v67-labor-option.on{border-color:#2563eb;background:#eff6ff;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
      .v67-labor-option b{display:block;color:#0f172a;font-size:13px}
      .v67-labor-option small{display:block;margin-top:3px;color:#64748b;font-weight:800}
      .v67-labor-option strong{color:#047857;font-size:14px}
      .v67-guard{margin-top:9px;border-radius:12px;padding:9px 10px;font-size:12px;font-weight:900}
      .v67-guard.ok{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
      .v67-guard.warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
      .v67-guard.bad{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
      @media(max-width:760px){.v67-labor-head,.v67-labor-summary{grid-template-columns:1fr}.v67-labor-actions{justify-content:stretch}.v67-btn{width:100%}.v67-worker-money{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function writeStore(store) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store || {})); } catch (_) {}
  }

  function localBudgets(projectId) {
    const store = readStore();
    return Array.isArray(store[projectId]) ? store[projectId] : [];
  }

  function saveLocalBudgets(projectId, rows) {
    const store = readStore();
    store[projectId] = rows;
    writeStore(store);
  }

  function parseBudgetNote(row) {
    const note = String(row?.notes || '');
    const idx = note.indexOf(BUDGET_MARK);
    if (idx < 0) return null;
    try {
      const data = JSON.parse(note.slice(idx + BUDGET_MARK.length).trim());
      if (!data?.id || !data?.name) return null;
      return {
        id: String(data.id),
        name: String(data.name),
        budget: Math.max(0, num(data.budget)),
        createdAt: data.createdAt || row.created_at || new Date().toISOString(),
        remoteId: row.id || data.remoteId || null,
      };
    } catch (_) {
      return null;
    }
  }

  async function remoteBudgetRows(projectId) {
    try {
      const { data, error } = await db.from(PROJECT_EXPENSE_TABLE)
        .select('id,description,amount,type,notes,created_at')
        .eq('project_id', projectId);
      if (error) throw error;
      return (data || []).map(parseBudgetNote).filter(Boolean);
    } catch (error) {
      console.warn('[v67] remote labor budgets unavailable:', error);
      return [];
    }
  }

  async function getBudgets(projectId) {
    const local = localBudgets(projectId);
    const remote = await remoteBudgetRows(projectId);
    const map = new Map();
    local.forEach(row => map.set(String(row.id), row));
    remote.forEach(row => map.set(String(row.id), { ...(map.get(String(row.id)) || {}), ...row }));
    const rows = [...map.values()]
      .filter(row => row && row.id && row.name && num(row.budget) > 0)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    saveLocalBudgets(projectId, rows);
    return rows;
  }

  async function saveRemoteBudget(projectId, budget) {
    const payload = {
      project_id: projectId,
      description: `[งบค่าแรงเหมา] ${budget.name}`,
      category: 'ค่าแรงเหมา',
      amount: 0,
      type: BUDGET_TYPE,
      notes: `${BUDGET_MARK}${JSON.stringify({
        id: budget.id,
        name: budget.name,
        budget: num(budget.budget),
        createdAt: budget.createdAt || new Date().toISOString(),
      })}`,
      paid_at: null,
    };
    try {
      if (budget.remoteId) {
        await db.from(PROJECT_EXPENSE_TABLE).update(payload).eq('id', budget.remoteId);
        return budget.remoteId;
      }
      const { data, error } = await db.from(PROJECT_EXPENSE_TABLE).insert(payload).select('id').single();
      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.warn('[v67] save remote labor budget:', error);
      return budget.remoteId || null;
    }
  }

  async function deleteRemoteBudget(budget) {
    if (!budget?.remoteId) return;
    try { await db.from(PROJECT_EXPENSE_TABLE).delete().eq('id', budget.remoteId); }
    catch (error) { console.warn('[v67] delete remote labor budget:', error); }
  }

  function noteHasPay(row, budgetId) {
    return String(row?.notes || '').includes(`${PAY_MARK}${budgetId}`);
  }

  async function projectExpenses(projectId) {
    try {
      const { data, error } = await db.from(PROJECT_EXPENSE_TABLE)
        .select('id,description,category,amount,type,notes,created_at,cash_tx_id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('[v67] load project expenses:', error);
      return [];
    }
  }

  function budgetStats(budget, expenses) {
    const paid = (expenses || []).filter(row => noteHasPay(row, budget.id)).reduce((sum, row) => sum + num(row.amount), 0);
    const limit = num(budget.budget);
    const remaining = Math.max(0, limit - paid);
    const pct = limit > 0 ? Math.min(100, Math.round((paid / limit) * 100)) : 0;
    return { paid, limit, remaining, pct, over: paid > limit };
  }

  async function laborSummary(projectId) {
    const [budgets, expenses] = await Promise.all([getBudgets(projectId), projectExpenses(projectId)]);
    const stats = budgets.map(budget => ({ budget, ...budgetStats(budget, expenses) }));
    return {
      budgets,
      expenses,
      stats,
      totalLimit: stats.reduce((sum, row) => sum + row.limit, 0),
      totalPaid: stats.reduce((sum, row) => sum + row.paid, 0),
      totalRemaining: stats.reduce((sum, row) => sum + row.remaining, 0),
    };
  }

  function hideBudgetExpenseRows() {
    let visible = 0;
    document.querySelectorAll('#page-projects .v23-exp-row,.v14-expense-row').forEach(row => {
      const text = row.textContent || '';
      if (text.includes('[งบค่าแรงเหมา]')) {
        row.style.display = 'none';
        row.dataset.v67LaborBudgetRow = '1';
      } else {
        visible += 1;
      }
    });
    const v23Count = document.querySelector('#v23t-exp .v23-tc');
    if (v23Count) v23Count.textContent = String(visible);
    const v22Count = document.querySelector('#v22tab-exp span');
    if (v22Count) v22Count.textContent = String(visible);
  }

  async function decorateProjectPage(projectId) {
    injectStyle();
    const root = document.querySelector('#page-projects .v23-wrap') || document.querySelector('#page-projects .v14-proj-container');
    if (!root) return;
    hideBudgetExpenseRows();
    document.getElementById('v67-labor-panel')?.remove();

    const summary = await laborSummary(projectId);
    const cards = summary.stats.map(row => {
      const danger = row.remaining <= 0;
      return `
        <article class="v67-worker-card">
          <div class="v67-worker-top">
            <div>
              <div class="v67-worker-name">${esc(row.budget.name)}</div>
              <div class="v67-worker-chip">วงเงินเหมา</div>
            </div>
            <button class="v67-btn good" type="button" onclick="v67OpenLaborPay('${esc(projectId)}','${esc(row.budget.id)}')">
              <i class="material-icons-round" style="font-size:16px">payments</i>จ่าย
            </button>
          </div>
          <div class="v67-worker-money">
            <div class="v67-mini"><span>ตั้งไว้</span><b>฿${fmt(row.limit)}</b></div>
            <div class="v67-mini"><span>จ่ายแล้ว</span><b>฿${fmt(row.paid)}</b></div>
            <div class="v67-mini remain ${danger ? 'over' : ''}"><span>คงเหลือ</span><b>฿${fmt(row.remaining)}</b></div>
            <div class="v67-mini"><span>ใช้ไป</span><b>${row.pct}%</b></div>
          </div>
          <div class="v67-bar"><span style="width:${row.pct}%;background:${danger ? '#dc2626' : 'linear-gradient(90deg,#22c55e,#2563eb)'}"></span></div>
          <div class="v67-worker-actions">
            <button class="v67-btn" type="button" onclick="v67OpenLaborLimitModal('${esc(projectId)}','${esc(row.budget.id)}')"><i class="material-icons-round" style="font-size:16px">edit</i>แก้ไข</button>
            <button class="v67-btn danger" type="button" onclick="v67DeleteLaborLimit('${esc(projectId)}','${esc(row.budget.id)}')"><i class="material-icons-round" style="font-size:16px">delete</i>ลบ</button>
          </div>
        </article>
      `;
    }).join('');

    const panel = document.createElement('section');
    panel.id = 'v67-labor-panel';
    panel.className = 'v67-labor-panel';
    panel.innerHTML = `
      <div class="v67-labor-head">
        <div>
          <div class="v67-labor-title"><i class="material-icons-round">engineering</i><span>ค่าแรงเหมาช่าง</span></div>
          <div class="v67-labor-sub">ตั้งวงเงินให้ช่างแต่ละทีม แล้วจ่ายทีละงวดโดยระบบจะหักคงเหลือและบล็อกไม่ให้จ่ายเกินวงเงิน</div>
        </div>
        <div class="v67-labor-actions">
          <button class="v67-btn primary" type="button" onclick="v67OpenLaborLimitModal('${esc(projectId)}')">
            <i class="material-icons-round" style="font-size:17px">add</i>เพิ่มงบเหมาช่าง
          </button>
        </div>
      </div>
      <div class="v67-labor-summary">
        <div class="v67-sum"><span>งบค่าแรงเหมารวม</span><b>฿${fmt(summary.totalLimit)}</b></div>
        <div class="v67-sum warn"><span>จ่ายแล้ว</span><b>฿${fmt(summary.totalPaid)}</b></div>
        <div class="v67-sum good"><span>คงเหลือจ่ายได้</span><b>฿${fmt(summary.totalRemaining)}</b></div>
      </div>
      ${summary.stats.length
        ? `<div class="v67-labor-grid">${cards}</div>`
        : `<div class="v67-empty"><i class="material-icons-round">engineering</i>ยังไม่ได้ตั้งงบค่าแรงเหมาช่าง<br><span style="font-size:12px;color:#94a3b8">เริ่มจากเพิ่มชื่อช่าง/ทีมช่าง และวงเงินเหมาที่ตกลงไว้</span></div>`}
    `;

    const anchor = root.querySelector('.v23-tabs') || root.querySelector('[id^="v22tab-"]')?.parentElement || root.querySelector('.v23-hero')?.nextElementSibling;
    if (anchor) root.insertBefore(panel, anchor);
    else root.appendChild(panel);
  }

  window.v67OpenLaborLimitModal = async function (projectId, budgetId = '') {
    injectStyle();
    const summary = await laborSummary(projectId);
    const current = summary.stats.find(row => String(row.budget.id) === String(budgetId));
    const minBudget = current ? current.paid : 0;
    if (typeof Swal === 'undefined') {
      const name = prompt('ชื่อช่าง/ทีมช่าง', current?.budget.name || '');
      if (!name) return;
      const budget = Number(prompt('วงเงินค่าแรงเหมา', current?.limit || minBudget || 0));
      if (!budget || budget < minBudget) return;
      await saveLaborBudget(projectId, { ...(current?.budget || {}), name, budget });
      return;
    }
    const result = await Swal.fire({
      title: current ? 'แก้งบค่าแรงเหมา' : 'เพิ่มงบค่าแรงเหมา',
      html: `
        <div style="text-align:left;display:grid;gap:12px">
          <div class="v44-field" style="margin:0">
            <label>ชื่อช่าง / ทีมช่าง</label>
            <input id="v67-labor-name" class="swal2-input" style="width:100%;margin:0;height:46px" value="${esc(current?.budget.name || '')}" placeholder="เช่น ช่างสมชาย / ทีมฉาบปูน">
          </div>
          <div class="v44-field" style="margin:0">
            <label>วงเงินค่าแรงเหมา</label>
            <input id="v67-labor-budget" class="swal2-input" style="width:100%;margin:0;height:46px" type="number" min="${minBudget}" step="1" value="${esc(current?.limit || '')}" placeholder="0">
          </div>
          ${minBudget > 0 ? `<div style="padding:10px 12px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;border-radius:12px;font-size:12px;font-weight:850">ช่างรายนี้จ่ายไปแล้ว ฿${fmt(minBudget)} จึงลดวงเงินต่ำกว่านี้ไม่ได้</div>` : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'บันทึกวงเงิน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const name = document.getElementById('v67-labor-name')?.value.trim();
        const budget = num(document.getElementById('v67-labor-budget')?.value);
        if (!name) return Swal.showValidationMessage('กรุณากรอกชื่อช่างหรือทีมช่าง');
        if (budget <= 0) return Swal.showValidationMessage('กรุณากรอกวงเงินค่าแรงเหมา');
        if (budget < minBudget) return Swal.showValidationMessage(`วงเงินต้องไม่ต่ำกว่ายอดที่จ่ายไปแล้ว ฿${fmt(minBudget)}`);
        return { name, budget };
      },
    });
    if (!result.isConfirmed || !result.value) return;
    await saveLaborBudget(projectId, { ...(current?.budget || {}), ...result.value });
  };

  async function saveLaborBudget(projectId, value) {
    const rows = await getBudgets(projectId);
    const budget = {
      id: value.id || uid(),
      name: String(value.name || '').trim(),
      budget: num(value.budget),
      createdAt: value.createdAt || new Date().toISOString(),
      remoteId: value.remoteId || null,
    };
    budget.remoteId = await saveRemoteBudget(projectId, budget);
    const next = rows.filter(row => String(row.id) !== String(budget.id)).concat(budget);
    saveLocalBudgets(projectId, next);
    toast?.('บันทึกงบค่าแรงเหมาแล้ว', 'success');
    await decorateProjectPage(projectId);
  }

  window.v67DeleteLaborLimit = async function (projectId, budgetId) {
    const summary = await laborSummary(projectId);
    const row = summary.stats.find(item => String(item.budget.id) === String(budgetId));
    if (!row) return;
    if (row.paid > 0) {
      toast?.('ลบไม่ได้ เพราะช่างรายนี้มีประวัติการจ่ายแล้ว ให้ปรับวงเงินแทน', 'warning');
      return;
    }
    if (typeof Swal !== 'undefined') {
      const confirm = await Swal.fire({
        icon: 'warning',
        title: 'ลบงบค่าแรงเหมานี้?',
        text: row.budget.name,
        showCancelButton: true,
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626',
      });
      if (!confirm.isConfirmed) return;
    }
    await deleteRemoteBudget(row.budget);
    saveLocalBudgets(projectId, summary.budgets.filter(item => String(item.id) !== String(budgetId)));
    toast?.('ลบงบค่าแรงเหมาแล้ว', 'success');
    await decorateProjectPage(projectId);
  };

  window.v67OpenLaborPay = async function (projectId, budgetId) {
    if (typeof window.v14AddExpense === 'function') {
      await window.v14AddExpense(projectId, { laborId: budgetId });
    }
  };

  async function decorateExpenseModal(projectId, options = {}) {
    injectStyle();
    const modal = document.getElementById('v44-expense-modal');
    if (!modal || modal.querySelector('#v67-expense-labor-box')) return;
    const category = document.getElementById('v44-exp-cat');
    if (!category) return;
    const summary = await laborSummary(projectId);
    const box = document.createElement('div');
    box.id = 'v67-expense-labor-box';
    box.className = 'v67-expense-box';
    box.innerHTML = `
      <div class="v67-expense-head">
        <div class="v67-expense-title"><i class="material-icons-round">engineering</i><span>จ่ายจากงบเหมาช่าง</span></div>
        <button type="button" class="v67-btn" onclick="v67OpenLaborLimitModal('${esc(projectId)}')"><i class="material-icons-round" style="font-size:16px">add</i>เพิ่มวงเงิน</button>
      </div>
      <input type="hidden" id="v67-labor-selected" value="">
      ${summary.stats.length ? `
        <div class="v67-labor-select">
          ${summary.stats.map(row => `
            <button type="button" class="v67-labor-option" data-v67-labor="${esc(row.budget.id)}" onclick="v67SelectLaborForExpense('${esc(row.budget.id)}')">
              <span><b>${esc(row.budget.name)}</b><small>ตั้งไว้ ฿${fmt(row.limit)} · จ่ายแล้ว ฿${fmt(row.paid)}</small></span>
              <strong>เหลือ ฿${fmt(row.remaining)}</strong>
            </button>
          `).join('')}
        </div>
        <div id="v67-labor-guard" class="v67-guard warn">เลือกช่างเพื่อให้ระบบคุมไม่ให้จ่ายเกินวงเงิน</div>
      ` : `
        <div class="v67-guard warn">ยังไม่มีงบเหมาช่างในโครงการนี้ กด “เพิ่มวงเงิน” ก่อนจ่ายค่าแรงเหมา</div>
      `}
    `;
    category.closest('.v44-field')?.insertAdjacentElement('afterend', box);
    window._v67ExpenseContext = { projectId, summary };
    category.addEventListener('change', window.v67UpdateLaborExpenseGuard);
    document.getElementById('v44-exp-amt')?.addEventListener('input', window.v67UpdateLaborExpenseGuard);
    if (options?.laborId) window.v67SelectLaborForExpense(options.laborId);
    else window.v67UpdateLaborExpenseGuard();
  }

  window.v67SelectLaborForExpense = function (budgetId) {
    const ctx = window._v67ExpenseContext;
    const hidden = document.getElementById('v67-labor-selected');
    if (!ctx || !hidden) return;
    hidden.value = budgetId || '';
    document.querySelectorAll('.v67-labor-option').forEach(btn => btn.classList.toggle('on', String(btn.dataset.v67Labor) === String(budgetId)));
    const category = document.getElementById('v44-exp-cat');
    if (category) category.value = LABOR_CATEGORY;
    const desc = document.getElementById('v44-exp-desc');
    const row = ctx.summary.stats.find(item => String(item.budget.id) === String(budgetId));
    if (desc && row && !desc.value.trim()) desc.value = `ค่าแรงเหมา ${row.budget.name}`;
    window.v67UpdateLaborExpenseGuard();
  };

  window.v67UpdateLaborExpenseGuard = function () {
    const ctx = window._v67ExpenseContext;
    const guard = document.getElementById('v67-labor-guard');
    const btn = document.getElementById('v44-exp-confirm');
    if (!ctx || !guard || !btn) return;
    const category = document.getElementById('v44-exp-cat')?.value || '';
    const laborId = document.getElementById('v67-labor-selected')?.value || '';
    const amount = num(document.getElementById('v44-exp-amt')?.value);
    const isLabor = category === LABOR_CATEGORY;
    btn.dataset.v67Blocked = '';

    if (isLabor && ctx.summary.stats.length && !laborId) {
      guard.className = 'v67-guard bad';
      guard.textContent = 'ค่าแรงเหมาต้องเลือกช่างก่อนบันทึก เพื่อกันจ่ายเกินวงเงิน';
      btn.disabled = true;
      btn.dataset.v67Blocked = '1';
      return;
    }
    if (!laborId) {
      guard.className = 'v67-guard warn';
      guard.textContent = ctx.summary.stats.length ? 'เลือกช่างเพื่อให้ระบบคุมไม่ให้จ่ายเกินวงเงิน' : 'ยังไม่มีงบเหมาช่างในโครงการนี้';
      return;
    }

    const row = ctx.summary.stats.find(item => String(item.budget.id) === String(laborId));
    if (!row) return;
    if (amount > row.remaining) {
      guard.className = 'v67-guard bad';
      guard.textContent = `จ่ายเกินวงเงินของ ${row.budget.name}: คงเหลือ ฿${fmt(row.remaining)} แต่กำลังจ่าย ฿${fmt(amount)}`;
      btn.disabled = true;
      btn.dataset.v67Blocked = '1';
      return;
    }
    guard.className = 'v67-guard ok';
    guard.textContent = amount > 0
      ? `จ่ายได้: หลังจ่ายจะเหลือ ฿${fmt(row.remaining - amount)} จากวงเงินของ ${row.budget.name}`
      : `คงเหลือจ่ายได้ ฿${fmt(row.remaining)} สำหรับ ${row.budget.name}`;
  };

  function installExpensePatch() {
    if (window.__v67ExpensePatchInstalled) return;
    const originalOpen = window.v14AddExpense;
    const originalConfirm = window.v44ConfirmAddExpense;
    const originalUpdate = window.v44UpdateExpenseCash;
    if (typeof originalOpen !== 'function' || typeof originalConfirm !== 'function') return;
    window.__v67ExpensePatchInstalled = true;

    window.v14AddExpense = async function (projectId, options = {}) {
      const result = await originalOpen.apply(this, [projectId]);
      setTimeout(() => decorateExpenseModal(projectId, options).catch(error => console.warn('[v67] decorate expense modal:', error)), 60);
      return result;
    };
    try { v14AddExpense = window.v14AddExpense; } catch (_) {}

    window.v44ConfirmAddExpense = async function (projectId) {
      const ctx = window._v67ExpenseContext;
      const category = document.getElementById('v44-exp-cat')?.value || '';
      const laborId = document.getElementById('v67-labor-selected')?.value || '';
      const amount = num(document.getElementById('v44-exp-amt')?.value);
      if (ctx && category === LABOR_CATEGORY && ctx.summary.stats.length && !laborId) {
        toast?.('กรุณาเลือกช่างสำหรับค่าแรงเหมา', 'warning');
        window.v67UpdateLaborExpenseGuard();
        return;
      }
      if (ctx && laborId) {
        const row = ctx.summary.stats.find(item => String(item.budget.id) === String(laborId));
        if (!row) {
          toast?.('ไม่พบงบค่าแรงเหมาช่างที่เลือก', 'error');
          return;
        }
        if (amount <= 0 || amount > row.remaining) {
          toast?.(`จ่ายเกินวงเงินของ ${row.budget.name} คงเหลือ ฿${fmt(row.remaining)}`, 'error');
          window.v67UpdateLaborExpenseGuard();
          return;
        }
        const desc = document.getElementById('v44-exp-desc');
        if (desc && !desc.value.includes(row.budget.name)) desc.value = `ค่าแรงเหมา ${row.budget.name} - ${desc.value.trim() || 'จ่ายค่าแรง'}`;
        const notes = document.getElementById('v44-exp-notes');
        if (notes && !notes.value.includes(`${PAY_MARK}${laborId}`)) {
          notes.value = `${notes.value.trim()} ${PAY_MARK}${laborId}`.trim();
        }
      }
      return originalConfirm.apply(this, arguments);
    };
    try { v44ConfirmAddExpense = window.v44ConfirmAddExpense; } catch (_) {}

    if (typeof originalUpdate === 'function' && !originalUpdate.__v67Wrapped) {
      window.v44UpdateExpenseCash = function () {
        const result = originalUpdate.apply(this, arguments);
        setTimeout(() => window.v67UpdateLaborExpenseGuard?.(), 0);
        return result;
      };
      window.v44UpdateExpenseCash.__v67Wrapped = true;
      try { v44UpdateExpenseCash = window.v44UpdateExpenseCash; } catch (_) {}
    }
  }

  function installProjectPatch() {
    if (window.__v67ProjectPatchInstalled) return;
    const original = window.v14OpenProject;
    if (typeof original !== 'function') return;
    window.__v67ProjectPatchInstalled = true;
    window.v14OpenProject = async function (projectId) {
      const result = await original.apply(this, arguments);
      setTimeout(() => decorateProjectPage(projectId).catch(error => console.warn('[v67] decorate project:', error)), 80);
      return result;
    };
    try { v14OpenProject = window.v14OpenProject; } catch (_) {}
  }

  function boot() {
    injectStyle();
    installProjectPatch();
    installExpensePatch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  [300, 900, 1800, 3200].forEach(delay => setTimeout(boot, delay));
})();
