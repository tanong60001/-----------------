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
  const DENOMS = [
    { value: 1000, label: '1,000', type: 'bill', color: '#8B5E3C', bg: '#F5E7DA' },
    { value: 500, label: '500', type: 'bill', color: '#6B21A8', bg: '#F3E8FF' },
    { value: 100, label: '100', type: 'bill', color: '#BE123C', bg: '#FFE4E6' },
    { value: 50, label: '50', type: 'bill', color: '#1D4ED8', bg: '#DBEAFE' },
    { value: 20, label: '20', type: 'bill', color: '#15803D', bg: '#DCFCE7' },
    { value: 10, label: '10', type: 'coin', color: '#92400E', bg: '#FEF3C7' },
    { value: 5, label: '5', type: 'coin', color: '#334155', bg: '#E2E8F0' },
    { value: 2, label: '2', type: 'coin', color: '#475569', bg: '#F1F5F9' },
    { value: 1, label: '1', type: 'coin', color: '#475569', bg: '#F8FAFC' },
  ];

  const staff = () => {
    try { return localStorage.getItem('current_staff_name') || localStorage.getItem('staff_name') || 'System'; }
    catch (_) { return 'System'; }
  };

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
      .v67-pay-modal{position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:99999;display:grid;place-items:center;padding:22px}
      .v67-pay-card{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 30px 80px rgba(15,23,42,.28);border:1px solid #e2e8f0}
      .v67-pay-head{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:start;padding:22px 24px;border-bottom:1px solid #e2e8f0}
      .v67-pay-kicker{color:#2563eb;font-size:11px;font-weight:950;letter-spacing:.04em;text-transform:uppercase}
      .v67-pay-title{margin-top:5px;color:#0f172a;font-size:26px;font-weight:950;line-height:1.15}
      .v67-pay-sub{margin-top:6px;color:#64748b;font-size:13px;font-weight:850}
      .v67-pay-close{width:38px;height:38px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#94a3b8;display:grid;place-items:center;cursor:pointer}
      .v67-pay-body{padding:20px 24px;display:grid;gap:16px}
      .v67-pay-hero{border:1px solid #bbf7d0;background:linear-gradient(135deg,#ecfdf5,#f8fafc);border-radius:18px;padding:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .v67-pay-metric{background:rgba(255,255,255,.82);border:1px solid #dbeafe;border-radius:14px;padding:12px}
      .v67-pay-metric span{display:block;color:#64748b;font-size:11px;font-weight:950}
      .v67-pay-metric b{display:block;margin-top:3px;color:#0f172a;font-size:21px;font-weight:950}
      .v67-pay-metric.good b{color:#059669}.v67-pay-metric.warn b{color:#dc2626}
      .v67-pay-fields{display:grid;grid-template-columns:1fr 220px;gap:12px}
      .v67-field{display:grid;gap:6px}
      .v67-field label{color:#475569;font-size:12px;font-weight:950}
      .v67-field input,.v67-field textarea{width:100%;border:1.5px solid #cbd5e1;border-radius:13px;padding:12px 13px;font:900 14px var(--font-thai,'Prompt'),sans-serif;color:#0f172a;background:#fff;outline:none}
      .v67-field textarea{min-height:76px;resize:vertical}
      .v67-field input:focus,.v67-field textarea:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.08)}
      .v67-pay-methods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .v67-pay-method{height:48px;border-radius:14px;border:1.5px solid #cbd5e1;background:#fff;color:#334155;font:950 13px var(--font-thai,'Prompt'),sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}
      .v67-pay-method.on{background:#eff6ff;border-color:#2563eb;color:#1d4ed8;box-shadow:0 10px 20px rgba(37,99,235,.1)}
      .v67-cash-panel{border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;padding:14px}
      .v67-cash-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;color:#475569;font-weight:950}
      .v67-cash-head b{color:#0f172a;font-size:18px}
      .v67-denom-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}
      .v67-denom{display:grid;grid-template-columns:1fr 58px;gap:7px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:8px}
      .v67-denom-face{height:44px;border-radius:10px;display:grid;place-items:center;text-align:center}
      .v67-denom-face strong{font-size:13px}.v67-denom-face small{display:block;font-size:9px;font-weight:900;opacity:.75}
      .v67-denom input{height:44px;border:1px solid #cbd5e1;border-radius:10px;text-align:center;font-weight:950;color:#0f172a}
      .v67-cash-summary{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px}
      .v67-cash-summary span{display:block;color:#64748b;font-size:11px;font-weight:950}
      .v67-cash-summary b{display:block;margin-top:2px;color:#0f172a;font-size:20px;font-weight:950}
      .v67-count-modal{position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:100000;display:grid;place-items:center;padding:18px}
      .v67-count-card{width:min(920px,100%);max-height:92vh;overflow:auto;background:#f7f3ef;border:5px solid #3b1f17;border-radius:28px;box-shadow:0 30px 90px rgba(15,23,42,.35);padding:24px}
      .v67-count-top{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;margin-bottom:18px}
      .v67-count-title{display:flex;align-items:center;gap:10px;color:#3b2721;font-size:26px;font-weight:950}
      .v67-count-sub{margin-top:5px;color:#7c6259;font-size:13px;font-weight:850}
      .v67-count-target{text-align:right;color:#7c6259;font-weight:950}
      .v67-count-target b{display:block;color:#3b2721;font-size:32px;line-height:1.05}
      .v67-count-section{margin-top:12px}
      .v67-count-section h4{display:flex;align-items:center;gap:8px;margin:0 0 10px;color:#5a4038;font-size:14px;font-weight:950}
      .v67-count-grid{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px}
      .v67-count-grid.coin{grid-template-columns:repeat(4,minmax(120px,1fr))}
      .v67-count-btn{position:relative;min-height:118px;border:0;border-radius:18px;background:#fff;color:#3b2721;box-shadow:0 8px 0 rgba(59,31,23,.22),0 18px 38px rgba(59,31,23,.1);cursor:pointer;padding:10px;font:950 15px var(--font-thai,'Prompt'),sans-serif}
      .v67-count-btn:hover{transform:translateY(-1px)}
      .v67-count-btn:disabled{opacity:.42;cursor:not-allowed;transform:none}
      .v67-count-note{height:78px;border-radius:14px;display:grid;place-items:center;color:#fff;font-size:24px;font-weight:950;border:4px solid rgba(255,255,255,.42)}
      .v67-count-coin{width:70px;height:70px;margin:auto;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:23px;font-weight:950;border:4px solid rgba(255,255,255,.75);box-shadow:0 10px 22px rgba(15,23,42,.18)}
      .v67-count-label{margin-top:9px;display:block;color:#5a4038}
      .v67-count-badge{position:absolute;top:8px;right:8px;min-width:28px;height:28px;border-radius:999px;background:#ef4444;color:#fff;display:none;align-items:center;justify-content:center;font-size:12px;font-weight:950}
      .v67-count-btn.has .v67-count-badge{display:flex}
      .v67-count-sum{margin-top:18px;background:#fff;border:2px solid #e7d9d1;border-radius:18px;padding:16px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center}
      .v67-count-sum span{display:block;color:#7c6259;font-size:13px;font-weight:950}.v67-count-sum b{display:block;color:#3b2721;font-size:30px;font-weight:950}
      .v67-count-sum .bad b{color:#ef4444}.v67-count-sum .ok b{color:#059669}
      .v67-count-actions{margin-top:18px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
      .v67-pay-foot{padding:16px 24px 22px;display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #e2e8f0}
      .v67-exp-searchbar{padding:14px 18px;border-top:1px solid #eef2f7;border-bottom:1px solid #eef2f7;background:#fbfdff;display:flex;gap:10px;align-items:center}
      .v67-exp-searchbar label{color:#475569;font-size:12px;font-weight:950;white-space:nowrap}
      .v67-exp-search{flex:1;min-width:180px;border:1.5px solid #cbd5e1;border-radius:13px;padding:11px 13px;font:850 13px var(--font-thai,'Prompt'),sans-serif;outline:none}
      .v67-exp-search:focus{border-color:#4f46e5;box-shadow:0 0 0 4px rgba(79,70,229,.08)}
      @media(max-width:760px){.v67-labor-head,.v67-labor-summary{grid-template-columns:1fr}.v67-labor-actions{justify-content:stretch}.v67-btn{width:100%}.v67-worker-money{grid-template-columns:1fr}}
      @media(max-width:760px){.v67-pay-modal{padding:10px}.v67-pay-head,.v67-pay-body,.v67-pay-foot{padding-left:16px;padding-right:16px}.v67-pay-hero,.v67-pay-fields,.v67-pay-methods,.v67-cash-summary{grid-template-columns:1fr}.v67-pay-foot{display:grid}.v67-exp-searchbar{display:grid}.v67-count-card{padding:16px;border-width:3px}.v67-count-top,.v67-count-sum{grid-template-columns:1fr;text-align:left}.v67-count-target{text-align:left}.v67-count-grid,.v67-count-grid.coin{grid-template-columns:repeat(2,minmax(0,1fr))}}
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

  function noteHasPay(row, budget) {
    const id = String(budget?.id || budget || '');
    const note = String(row?.notes || '');
    if (id && note.includes(`${PAY_MARK}${id}`)) return true;

    // Backward compatible fallback for rows created before the dedicated labor modal:
    // count only rows that clearly mention both the worker and labor context.
    const name = String(budget?.name || '').trim().toLowerCase();
    if (!name) return false;
    const hay = `${row?.description || ''} ${row?.category || ''} ${note}`.toLowerCase();
    return hay.includes(name) && (hay.includes('ค่าแรง') || hay.includes('labor'));
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
    const paid = (expenses || []).filter(row => noteHasPay(row, budget)).reduce((sum, row) => sum + num(row.amount), 0);
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

  async function getOpenSession() {
    const { data, error } = await db.from('cash_session')
      .select('*').eq('status', 'open')
      .order('opened_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function getLaborPayCounts() {
    const source = window._v67LaborCashCounts || {};
    const counts = {};
    DENOMS.forEach(d => { counts[d.value] = Math.max(0, Math.floor(num(source[d.value]))); });
    return counts;
  }

  function laborPayCountTotal(counts = getLaborPayCounts()) {
    return DENOMS.reduce((sum, d) => sum + (num(counts[d.value]) * d.value), 0);
  }

  function laborPayMethod() {
    return document.getElementById('v67-pay-method')?.value || 'เงินสด';
  }

  function laborPayNote(budgetId, workerName, notes) {
    const cleanNote = String(notes || '').trim();
    const meta = `${PAY_MARK}${budgetId} | ช่าง:${workerName}`;
    return cleanNote ? `${meta} | ${cleanNote}` : meta;
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

  function installExpenseSearch() {
    const area = document.querySelector('#page-projects #v23c-exp')
      || document.querySelector('#page-projects #v22content-exp')
      || document.querySelector('#page-projects .v14-expense-list')?.parentElement;
    if (!area || area.querySelector('#v67-exp-search')) return;
    const bar = document.createElement('div');
    bar.className = 'v67-exp-searchbar';
    bar.innerHTML = `
      <label for="v67-exp-search"><i class="material-icons-round" style="font-size:16px;vertical-align:middle">search</i> ค้นหารายจ่าย</label>
      <input id="v67-exp-search" class="v67-exp-search" type="search" placeholder="ค้นหาชื่อช่าง / รายการ / หมวดหมู่..." oninput="v67FilterProjectExpenses()">
    `;
    const anchor = area.querySelector('.v23-abar') || area.firstElementChild;
    if (anchor) anchor.insertAdjacentElement('afterend', bar);
    else area.prepend(bar);
  }

  window.v67FilterProjectExpenses = function () {
    const q = String(document.getElementById('v67-exp-search')?.value || '').trim().toLowerCase();
    document.querySelectorAll('#page-projects .v23-exp-row,#page-projects .v14-expense-row').forEach(row => {
      if (row.dataset.v67LaborBudgetRow === '1') {
        row.style.display = 'none';
        return;
      }
      row.style.display = !q || (row.textContent || '').toLowerCase().includes(q) ? '' : 'none';
    });
  };

  async function decorateProjectPage(projectId) {
    injectStyle();
    const root = document.querySelector('#page-projects .v23-wrap') || document.querySelector('#page-projects .v14-proj-container');
    if (!root) return;
    hideBudgetExpenseRows();
    installExpenseSearch();
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
              <i class="material-icons-round" style="font-size:16px">payments</i>จ่ายค่าแรง
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
    injectStyle();
    const summary = await laborSummary(projectId);
    const row = summary.stats.find(item => String(item.budget.id) === String(budgetId));
    if (!row) {
      toast?.('ไม่พบวงเงินค่าแรงเหมาช่างที่เลือก', 'error');
      return;
    }
    if (row.remaining <= 0) {
      toast?.(`${row.budget.name} ใช้วงเงินค่าแรงครบแล้ว`, 'warning');
      return;
    }

    document.getElementById('v67-labor-pay-modal')?.remove();
    window._v67LaborPayContext = { projectId, budgetId, row };
    window._v67LaborCashCounts = {};
    window._v67LaborCashStack = [];
    const defaultDesc = `ค่าแรงเหมา - ${row.budget.name}`;
    const modal = document.createElement('div');
    modal.id = 'v67-labor-pay-modal';
    modal.className = 'v67-pay-modal';
    modal.innerHTML = `
      <div id="v67-labor-pay-box" class="v67-pay-card">
        <div class="v67-pay-head">
          <div>
            <div class="v67-pay-kicker">LABOR PAYMENT</div>
            <div class="v67-pay-title">จ่ายค่าแรง ${esc(row.budget.name)}</div>
            <div class="v67-pay-sub">บันทึกเป็นรายจ่ายโครงการพร้อมหักวงเงินเหมาของช่างคนนี้โดยตรง</div>
          </div>
          <button class="v67-pay-close" type="button" onclick="document.getElementById('v67-labor-pay-modal')?.remove()">
            <i class="material-icons-round">close</i>
          </button>
        </div>
        <div class="v67-pay-body">
          <div class="v67-pay-hero">
            <div class="v67-pay-metric"><span>วงเงินตั้งไว้</span><b>฿${fmt(row.limit)}</b></div>
            <div class="v67-pay-metric warn"><span>จ่ายแล้ว</span><b>฿${fmt(row.paid)}</b></div>
            <div class="v67-pay-metric good"><span>คงเหลือจ่ายได้</span><b id="v67-pay-remain">฿${fmt(row.remaining)}</b></div>
          </div>

          <div class="v67-pay-fields">
            <div class="v67-field">
              <label>รายการรายจ่าย</label>
              <input id="v67-labor-desc" value="${esc(defaultDesc)}" placeholder="ค่าแรงเหมา - ชื่อช่าง">
            </div>
            <div class="v67-field">
              <label>จำนวนเงิน</label>
              <input id="v67-labor-amount" type="number" min="1" max="${row.remaining}" step="1" placeholder="0" oninput="v67ResetLaborCashCount(true);v67UpdateLaborPay()">
            </div>
          </div>

          <div class="v67-field">
            <label>วิธีจ่ายเงิน</label>
            <input id="v67-pay-method" type="hidden" value="เงินสด">
            <div class="v67-pay-methods">
              <button type="button" class="v67-pay-method on" data-method="เงินสด" onclick="v67SetLaborPayMethod('เงินสด')"><i class="material-icons-round">payments</i>เงินสด</button>
              <button type="button" class="v67-pay-method" data-method="โอน" onclick="v67SetLaborPayMethod('โอน')"><i class="material-icons-round">account_balance</i>โอน</button>
              <button type="button" class="v67-pay-method" data-method="อื่นๆ" onclick="v67SetLaborPayMethod('อื่นๆ')"><i class="material-icons-round">more_horiz</i>อื่นๆ</button>
            </div>
          </div>

          <div id="v67-cash-panel" class="v67-cash-panel">
            <div class="v67-cash-summary">
              <div>
                <span>ยอดเงินสดที่นับแล้ว</span>
                <b id="v67-denom-total">฿0</b>
                <small id="v67-cash-picked" style="display:block;margin-top:3px;color:#64748b;font-weight:850">ยังไม่ได้นับเงินสด</small>
              </div>
              <button type="button" class="v67-btn primary" onclick="v67OpenLaborCashCounter()">
                <i class="material-icons-round" style="font-size:17px">point_of_sale</i>เปิดหน้านับเงินสด
              </button>
            </div>
          </div>

          <div class="v67-field">
            <label>หมายเหตุ</label>
            <textarea id="v67-labor-notes" placeholder="เช่น งวดงาน / รายละเอียดงาน / ผู้รับเงิน"></textarea>
          </div>
          <div id="v67-labor-pay-guard" class="v67-guard warn">กรอกยอดจ่าย และถ้าเป็นเงินสดให้นับแบงค์/เหรียญให้ตรงยอด</div>
        </div>
        <div class="v67-pay-foot">
          <button type="button" class="v67-btn" onclick="document.getElementById('v67-labor-pay-modal')?.remove()">ยกเลิก</button>
          <button id="v67-pay-confirm" type="button" class="v67-btn good" onclick="v67ConfirmLaborPay('${esc(projectId)}','${esc(budgetId)}')" disabled>
            <i class="material-icons-round" style="font-size:17px">save</i>บันทึกจ่ายค่าแรง
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal) modal.remove();
    });
    document.getElementById('v67-labor-amount')?.focus();
    window.v67UpdateLaborPay();
  };

  window.v67SetLaborPayMethod = function (method) {
    const select = document.getElementById('v67-pay-method');
    if (select) select.value = method;
    document.querySelectorAll('.v67-pay-method').forEach(btn => btn.classList.toggle('on', btn.dataset.method === method));
    const panel = document.getElementById('v67-cash-panel');
    if (panel) panel.style.display = method === 'เงินสด' ? '' : 'none';
    window.v67UpdateLaborPay();
    if (method === 'เงินสด' && num(document.getElementById('v67-labor-amount')?.value) > 0) {
      setTimeout(() => window.v67OpenLaborCashCounter?.(), 50);
    }
  };

  window.v67ResetLaborCashCount = function (silent = false) {
    window._v67LaborCashCounts = {};
    window._v67LaborCashStack = [];
    if (!silent) toast?.('ล้างยอดนับเงินสดแล้ว', 'info');
    window.v67UpdateLaborCashCounter?.();
  };

  window.v67OpenLaborCashCounter = async function () {
    const ctx = window._v67LaborPayContext;
    const amount = num(document.getElementById('v67-labor-amount')?.value);
    if (!ctx) return;
    if (amount <= 0) {
      toast?.('กรุณากรอกยอดจ่ายก่อนเปิดหน้านับเงินสด', 'warning');
      document.getElementById('v67-labor-amount')?.focus();
      return;
    }
    if (amount > ctx.row.remaining) {
      toast?.(`ยอดจ่ายเกินวงเงินของ ${ctx.row.budget.name}`, 'error');
      return;
    }
    try {
      const session = await getOpenSession();
      if (!session) {
        toast?.('ยังไม่ได้เปิดลิ้นชักเงินสด', 'warning');
        return;
      }
    } catch (error) {
      toast?.('ตรวจสอบลิ้นชักเงินสดไม่สำเร็จ: ' + error.message, 'error');
      return;
    }

    document.getElementById('v67-count-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'v67-count-modal';
    modal.className = 'v67-count-modal';
    modal.innerHTML = `
      <div class="v67-count-card">
        <div class="v67-count-top">
          <div>
            <div class="v67-count-title"><i class="material-icons-round">point_of_sale</i>นับเงินสดจ่ายค่าแรง</div>
            <div class="v67-count-sub">กดที่แบงค์/เหรียญเพื่อบวกยอด ระบบจะไม่ให้กดเกินยอดที่จะจ่าย</div>
          </div>
          <div class="v67-count-target">
            ยอดที่จะจ่าย
            <b>฿${fmt(amount)}</b>
          </div>
        </div>

        <div class="v67-count-section">
          <h4><i class="material-icons-round" style="font-size:17px;color:#16a34a">payments</i>ธนบัตรที่จ่าย</h4>
          <div class="v67-count-grid">
            ${DENOMS.filter(d => d.type === 'bill').map(d => `
              <button type="button" class="v67-count-btn" data-value="${d.value}" onclick="v67LaborCashAdd(${d.value})">
                <span class="v67-count-badge" id="v67-count-badge-${d.value}">0</span>
                <div class="v67-count-note" style="background:${d.color}">${d.label}</div>
                <span class="v67-count-label">฿${d.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="v67-count-section">
          <h4><i class="material-icons-round" style="font-size:17px;color:#f59e0b">monetization_on</i>เหรียญที่จ่าย</h4>
          <div class="v67-count-grid coin">
            ${DENOMS.filter(d => d.type === 'coin').map(d => `
              <button type="button" class="v67-count-btn" data-value="${d.value}" onclick="v67LaborCashAdd(${d.value})">
                <span class="v67-count-badge" id="v67-count-badge-${d.value}">0</span>
                <div class="v67-count-coin" style="background:${d.color}">${d.label}</div>
                <span class="v67-count-label">฿${d.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="v67-count-sum">
          <div>
            <span>นับแล้ว</span>
            <b id="v67-count-total">฿0</b>
          </div>
          <div id="v67-count-diff" class="bad" style="text-align:right">
            <span>ยังขาด</span>
            <b>฿${fmt(amount)}</b>
          </div>
        </div>

        <div class="v67-count-actions">
          <button type="button" class="v67-btn" onclick="document.getElementById('v67-count-modal')?.remove()"><i class="material-icons-round" style="font-size:17px">close</i>ยกเลิก</button>
          <button type="button" class="v67-btn" onclick="v67LaborCashUndo()"><i class="material-icons-round" style="font-size:17px">undo</i>ย้อน 1 ครั้ง</button>
          <button type="button" class="v67-btn danger" onclick="v67ResetLaborCashCount()"><i class="material-icons-round" style="font-size:17px">restart_alt</i>ล้าง</button>
          <button id="v67-count-confirm" type="button" class="v67-btn good" onclick="v67ConfirmLaborCashCount()" disabled><i class="material-icons-round" style="font-size:17px">check</i>ยืนยันยอดเงินสด</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal) modal.remove();
    });
    window.v67UpdateLaborCashCounter();
  };

  window.v67LaborCashAdd = function (value) {
    const target = num(document.getElementById('v67-labor-amount')?.value);
    const counts = window._v67LaborCashCounts || {};
    const current = laborPayCountTotal(counts);
    if (current + value > target) {
      toast?.('ยอดเงินสดจะเกินยอดจ่าย กดแบงค์/เหรียญมูลค่าน้อยลงครับ', 'warning');
      return;
    }
    counts[value] = num(counts[value]) + 1;
    window._v67LaborCashCounts = counts;
    window._v67LaborCashStack = (window._v67LaborCashStack || []).concat(value);
    window.v67UpdateLaborCashCounter();
  };

  window.v67LaborCashUndo = function () {
    const stack = window._v67LaborCashStack || [];
    const last = stack.pop();
    if (!last) return;
    const counts = window._v67LaborCashCounts || {};
    counts[last] = Math.max(0, num(counts[last]) - 1);
    window._v67LaborCashStack = stack;
    window._v67LaborCashCounts = counts;
    window.v67UpdateLaborCashCounter();
  };

  window.v67UpdateLaborCashCounter = function () {
    const target = num(document.getElementById('v67-labor-amount')?.value);
    const counts = getLaborPayCounts();
    const total = laborPayCountTotal(counts);
    const totalEl = document.getElementById('v67-count-total');
    if (totalEl) totalEl.textContent = `฿${fmt(total)}`;
    DENOMS.forEach(d => {
      const badge = document.getElementById(`v67-count-badge-${d.value}`);
      const btn = document.querySelector(`#v67-count-modal .v67-count-btn[data-value="${d.value}"]`);
      if (badge) badge.textContent = String(counts[d.value] || 0);
      if (btn) {
        btn.classList.toggle('has', num(counts[d.value]) > 0);
        btn.disabled = target > 0 && total + d.value > target;
      }
    });
    const diff = Math.max(0, target - total);
    const diffEl = document.getElementById('v67-count-diff');
    if (diffEl) {
      diffEl.className = diff === 0 ? 'ok' : 'bad';
      diffEl.innerHTML = diff === 0
        ? `<span>ครบยอด</span><b>พอดี</b>`
        : `<span>ยังขาด</span><b>฿${fmt(diff)}</b>`;
    }
    const confirm = document.getElementById('v67-count-confirm');
    if (confirm) confirm.disabled = target <= 0 || total !== target;
    window.v67UpdateLaborPay?.();
  };

  window.v67ConfirmLaborCashCount = function () {
    const target = num(document.getElementById('v67-labor-amount')?.value);
    const total = laborPayCountTotal();
    if (target <= 0 || total !== target) {
      toast?.('ยอดเงินสดต้องตรงกับยอดจ่าย ห้ามขาดหรือเกิน', 'warning');
      return;
    }
    document.getElementById('v67-count-modal')?.remove();
    toast?.('ยืนยันยอดเงินสดครบพอดีแล้ว', 'success');
    window.v67UpdateLaborPay();
  };

  window.v67UpdateLaborPay = function () {
    const ctx = window._v67LaborPayContext;
    const guard = document.getElementById('v67-labor-pay-guard');
    const confirm = document.getElementById('v67-pay-confirm');
    if (!ctx || !guard || !confirm) return;
    const amount = num(document.getElementById('v67-labor-amount')?.value);
    const method = laborPayMethod();
    const denomTotal = laborPayCountTotal();
    const denomEl = document.getElementById('v67-denom-total');
    if (denomEl) denomEl.textContent = `฿${fmt(denomTotal)}`;
    const picked = document.getElementById('v67-cash-picked');
    if (picked) {
      picked.textContent = denomTotal > 0
        ? (denomTotal === amount ? 'นับเงินสดครบพอดีแล้ว' : `นับแล้ว ฿${fmt(denomTotal)} จากยอด ฿${fmt(amount)}`)
        : 'ยังไม่ได้นับเงินสด';
      picked.style.color = denomTotal === amount && amount > 0 ? '#059669' : '#64748b';
    }
    confirm.disabled = true;

    if (amount <= 0) {
      guard.className = 'v67-guard warn';
      guard.textContent = `กรอกยอดจ่ายได้ไม่เกิน ฿${fmt(ctx.row.remaining)} สำหรับ ${ctx.row.budget.name}`;
      return;
    }
    if (amount > ctx.row.remaining) {
      guard.className = 'v67-guard bad';
      guard.textContent = `จ่ายเกินวงเงินของ ${ctx.row.budget.name}: คงเหลือ ฿${fmt(ctx.row.remaining)} แต่กำลังจ่าย ฿${fmt(amount)}`;
      return;
    }
    if (method === 'เงินสด' && denomTotal !== amount) {
      guard.className = 'v67-guard warn';
      guard.textContent = `กดเปิดหน้านับเงินสด และนับให้ตรงยอด ฿${fmt(amount)} ห้ามขาดหรือเกิน`;
      return;
    }
    guard.className = 'v67-guard ok';
    guard.textContent = `บันทึกได้ หลังจ่ายจะเหลือวงเงินของ ${ctx.row.budget.name} ฿${fmt(ctx.row.remaining - amount)}`;
    confirm.disabled = false;
  };

  window.v67ConfirmLaborPay = async function (projectId, budgetId) {
    const fresh = await laborSummary(projectId);
    const row = fresh.stats.find(item => String(item.budget.id) === String(budgetId));
    const amount = num(document.getElementById('v67-labor-amount')?.value);
    const method = laborPayMethod();
    const counts = getLaborPayCounts();
    const denomTotal = laborPayCountTotal(counts);
    const workerName = row?.budget.name || '';
    let desc = document.getElementById('v67-labor-desc')?.value.trim() || `ค่าแรงเหมา - ${workerName}`;
    const notes = document.getElementById('v67-labor-notes')?.value.trim();

    if (!row) { toast?.('ไม่พบวงเงินค่าแรงเหมาช่างที่เลือก', 'error'); return; }
    if (!desc.includes(workerName)) desc = `ค่าแรงเหมา - ${workerName} - ${desc}`;
    if (amount <= 0) { toast?.('กรุณากรอกจำนวนเงินค่าแรง', 'warning'); return; }
    if (amount > row.remaining) {
      toast?.(`จ่ายเกินวงเงินของ ${workerName} คงเหลือ ฿${fmt(row.remaining)}`, 'error');
      window._v67LaborPayContext = { projectId, budgetId, row };
      window.v67UpdateLaborPay();
      return;
    }
    if (method === 'เงินสด' && denomTotal !== amount) {
      toast?.('ยอดนับแบงค์/เหรียญต้องตรงกับยอดจ่ายค่าแรง', 'warning');
      window.v67OpenLaborCashCounter?.();
      return;
    }

    const btn = document.getElementById('v67-pay-confirm');
    if (btn) { btn.disabled = true; btn.innerHTML = 'กำลังบันทึก...'; }

    try {
      let cashTxId = null;
      const isCash = method === 'เงินสด';
      if (isCash) {
        const session = await getOpenSession();
        if (!session) throw new Error('ยังไม่ได้เปิดลิ้นชักเงินสด');
        const balance = typeof getLiveCashBalance === 'function' ? await getLiveCashBalance() : 0;
        const after = Math.max(0, balance - amount);
        const { data: tx, error: txErr } = await db.from('cash_transaction').insert({
          session_id: session.id,
          type: PROJECT_EXPENSE_TABLE,
          direction: 'out',
          amount,
          change_amt: 0,
          net_amount: amount,
          balance_after: after,
          ref_table: PROJECT_EXPENSE_TABLE,
          staff_name: staff(),
          note: `${desc} [โครงการ]`,
          denominations: counts
        }).select('id').single();
        if (txErr) throw txErr;
        cashTxId = tx?.id || null;
        const balEl = document.getElementById('global-cash-balance');
        if (balEl) balEl.textContent = '฿' + fmt(after);
      }

      const { data: exp, error: expErr } = await db.from(PROJECT_EXPENSE_TABLE).insert({
        project_id: projectId,
        description: desc,
        category: LABOR_CATEGORY,
        amount,
        type: 'labor',
        notes: laborPayNote(budgetId, workerName, notes),
        cash_tx_id: cashTxId,
        paid_at: new Date().toISOString()
      }).select('id').single();
      if (expErr) throw expErr;

      if (cashTxId && exp?.id) {
        await db.from('cash_transaction').update({ ref_id: exp.id }).eq('id', cashTxId);
      }

      const { data: project } = await db.from('โครงการ').select('total_expenses').eq('id', projectId).maybeSingle();
      await db.from('โครงการ').update({
        total_expenses: num(project?.total_expenses) + amount
      }).eq('id', projectId);

      logActivity?.(PROJECT_EXPENSE_TABLE, `${desc} ฿${fmt(amount)}${isCash ? ' (เงินสด)' : ''}`, exp?.id, PROJECT_EXPENSE_TABLE);
      document.getElementById('v67-labor-pay-modal')?.remove();
      toast?.(`บันทึกค่าแรง ${workerName} ฿${fmt(amount)} และหักวงเงินช่างแล้ว`, 'success');
      if (typeof renderCashDrawer === 'function') renderCashDrawer();
      if (typeof loadCashBalance === 'function') loadCashBalance();
      window.v14OpenProject?.(projectId);
    } catch (error) {
      console.error('[v67] labor payment:', error);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="material-icons-round" style="font-size:17px">save</i>บันทึกจ่ายค่าแรง';
      }
      toast?.('บันทึกค่าแรงไม่สำเร็จ: ' + error.message, 'error');
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
      window._v67ExpenseContext = null;
      if (options?.laborId || options?.showLaborPicker) {
        setTimeout(() => decorateExpenseModal(projectId, options).catch(error => console.warn('[v67] decorate expense modal:', error)), 60);
      }
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
