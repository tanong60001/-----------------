/**
 * SK POS — dashboard-v3.js (Premium Level)
 * Cash-Basis Accounting & Advanced Analytics
 * 
 * Includes:
 * - Local Timezone Support
 * - Premium UI/UX (Fade-in, Micro-interactions)
 * - Skeleton Loaders
 * - Top Products metrics
 */

(function() {
  const formatNum = (n) => new Intl.NumberFormat('th-TH').format(n);

  const injectStyles = () => {
    if (document.getElementById('dash-v3-styles')) return;
    const style = document.createElement('style');
    style.id = 'dash-v3-styles';
    style.innerHTML = `
      @keyframes dashFadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes dashGrowUp { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      @keyframes dashShimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
      @keyframes dashFloat { 0% { transform: translateY(0px); } 50% { transform: translateY(-4px); } 100% { transform: translateY(0px); } }
      @keyframes dashPulseGlow { 0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(14, 165, 233, 0); } 100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); } }
      
      .dash-v3-container { padding: 24px; max-width: 1400px; margin: 0 auto; animation: dashFadeInUp 0.6s cubic-bezier(0.22, 1, 0.36, 1); font-family: 'Inter', 'Prompt', sans-serif; }
      
      /* Premium Header & Filters */
      .dash-v3-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
      .dash-v3-title-wrap { display: flex; align-items: center; gap: 16px; }
      .dash-v3-icon-box { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 10px 20px rgba(168, 85, 247, 0.3); animation: dashFloat 4s ease-in-out infinite; }
      
      .dash-v3-filter-group { display: flex; gap: 8px; background: rgba(255, 255, 255, 0.9); padding: 8px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.04); border: 1px solid rgba(226, 232, 240, 0.8); backdrop-filter: blur(16px); }
      .dash-v3-btn-per { padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; border: none; background: transparent; color: #64748b; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
      .dash-v3-btn-per.active { background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4); transform: translateY(-2px); }
      .dash-v3-btn-per:hover:not(.active) { background: #f1f5f9; color: #0f172a; }
      
      /* Tabs */
      .dash-v3-tabs { display: flex; gap: 12px; margin-bottom: 24px; padding-bottom: 0px; border-bottom: none; }
      .dash-v3-tab { font-size: 15px; font-weight: 700; padding: 14px 28px; cursor: pointer; color: #64748b; border-radius: 14px; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
      .dash-v3-tab:hover { background: #fff; box-shadow: 0 8px 16px rgba(0,0,0,0.04); transform: translateY(-2px); color: #0f172a; border-color: #cbd5e1; }
      .dash-v3-tab.active { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: #fff; border-color: transparent; box-shadow: 0 8px 20px rgba(14, 165, 233, 0.3); animation: dashPulseGlow 2s infinite; }
      
      /* Cards */
      .dash-v3-kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-bottom: 28px; align-items: stretch; }
      .dash-v3-card { background: var(--card-soft-bg, #ffffff); border-radius: 22px; padding: 26px; border: 1px solid color-mix(in srgb, var(--card-accent, #cbd5e1) 18%, #e2e8f0); box-shadow: 0 12px 32px rgba(15,23,42,0.06); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); position: relative; overflow: hidden; }
      .dash-v3-card:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 20px 42px rgba(15,23,42,0.1); border-color: color-mix(in srgb, var(--card-accent, #cbd5e1) 34%, #e2e8f0); z-index: 10; }
      .dash-v3-card::before { display: none; }
      .dash-v3-money { min-width: 0; max-width: 100%; line-height: 1.16; letter-spacing: 0 !important; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
      .dash-v3-kpi-money { color: var(--text-primary); font-size: 28px; font-weight: 900; margin-bottom: 4px; }
      
      /* Animations for contents */
      .anim-child { animation: dashFadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .delay-1 { animation-delay: 0.1s; } .delay-2 { animation-delay: 0.2s; } .delay-3 { animation-delay: 0.3s; }
      
      /* Skeletons */
      .dash-v3-skeleton { background: linear-gradient(90deg, var(--bg-base) 25%, color-mix(in srgb, var(--bg-base) 90%, #fff) 50%, var(--bg-base) 75%); background-size: 1000px 100%; animation: dashShimmer 2s infinite linear; border-radius: 8px; }
      
      /* Chart */
      .dash-v3-bar-wrap { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; flex: 1; position: relative; cursor: pointer; }
      .dash-v3-bar { width: 14px; border-radius: 6px 6px 0 0; transform-origin: bottom; animation: dashGrowUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; transition: filter 0.2s; }
      .dash-v3-bar-wrap:hover .dash-v3-bar { filter: brightness(1.2); }
      .dash-v3-tooltip { position: absolute; bottom: calc(100% + 8px); background: #1e293b; color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap; pointer-events: none; opacity: 0; transform: translateY(10px); transition: all 0.2s; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .dash-v3-bar-wrap:hover .dash-v3-tooltip { opacity: 1; transform: translateY(0); }
      .dash-v3-tooltip::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: #1e293b; }
      
      /* Lists & Tables */
      .dash-v3-row { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border-light); transition: background 0.2s; border-radius: 12px; }
      .dash-v3-row:hover { background: color-mix(in srgb, var(--primary) 4%, transparent); }
      .dash-v3-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
      
      .pl-line-item { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
      .pl-line-val { min-width: 0; font-size: 16px; font-weight: 800; letter-spacing: 0; overflow-wrap: anywhere; }
      .pl-group-header { font-size: 12px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 8px 12px; display: flex; align-items: center; gap: 6px; }
      
      .dash-v3-net-box { background: linear-gradient(135deg, var(--card-bg-sub, #f8fafc), color-mix(in srgb, var(--card-bg-sub, #f8fafc) 90%, #000)); border-radius: 16px; padding: 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.04); position: relative; overflow: hidden; border: 1px solid color-mix(in srgb, var(--card-bg-sub, #e2e8f0) 80%, #000); }
      .dash-v3-net-box::after { content: ''; position: absolute; top: 0; right: 0; width: 150px; height: 150px; background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%); border-radius: 50%; transform: translate(30%, -30%); }
      .dash-v3-net-box > div:last-child { min-width:0; max-width:100%; letter-spacing:0 !important; overflow-wrap:anywhere; }
      .dash-v3-main-grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; align-items: start; }
      .dash-v3-side { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
      .dash-v3-card-head { padding: 18px 20px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .dash-v3-card-body { padding: 20px; }
      .dash-v3-truth-grid { display:grid; grid-template-columns: 1.2fr .8fr; gap:16px; margin-bottom:24px; }
      .dash-v3-truth-panel { background:#fff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 12px 28px rgba(15,23,42,.055); }
      .dash-v3-truth-head { padding:16px 18px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; gap:12px; background:#f8fafc; }
      .dash-v3-truth-title { font-size:15px; font-weight:950; color:#0f172a; display:flex; align-items:center; gap:8px; }
      .dash-v3-truth-body { padding:16px 18px; display:grid; gap:10px; }
      .dash-v3-ledger-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; align-items:center; padding:12px 0; border-bottom:1px dashed #e2e8f0; }
      .dash-v3-ledger-row:last-child { border-bottom:0; }
      .dash-v3-ledger-label { font-size:13px; font-weight:900; color:#334155; line-height:1.35; }
      .dash-v3-ledger-help { font-size:11px; font-weight:700; color:#64748b; margin-top:2px; line-height:1.35; }
      .dash-v3-ledger-val { min-width:0; font-size:18px; font-weight:950; color:#0f172a; letter-spacing:0; overflow-wrap:anywhere; text-align:right; }
      .dash-v3-ledger-row.total { margin-top:4px; padding:14px 12px; border:0; border-radius:12px; background:#ecfdf5; }
      .dash-v3-ledger-row.total .dash-v3-ledger-label { color:#047857; }
      .dash-v3-ledger-row.total .dash-v3-ledger-val { color:#047857; font-size:22px; }
      .dash-v3-mini-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .dash-v3-mini { border:1px solid #e2e8f0; border-radius:12px; padding:12px; background:#fff; min-width:0; }
      .dash-v3-mini .lbl { font-size:11px; font-weight:900; color:#64748b; line-height:1.25; }
      .dash-v3-mini .val { min-width:0; font-size:18px; font-weight:950; color:#0f172a; margin-top:4px; letter-spacing:0; overflow-wrap:anywhere; }
      .dash-v3-explain { margin-bottom:24px; background:#f8fafc; border:1px solid #e2e8f0; border-left:5px solid #2563eb; border-radius:14px; padding:14px 16px; color:#475569; font-size:13px; font-weight:750; line-height:1.7; }
      @media (min-width: 1200px) {
        .dash-v3-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .dash-v3-kpi-grid .dash-v3-card { min-width: 0; }
      }
      @media (max-width: 1180px) {
        .dash-v3-container { padding: 18px; }
        .dash-v3-main-grid { grid-template-columns: 1fr; }
        .dash-v3-side { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dash-v3-truth-grid { grid-template-columns:1fr; }
        .dash-v3-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (max-width: 768px) {
        .dash-v3-container { padding: 0; max-width: 100%; }
        .dash-v3-header { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 14px; }
        .dash-v3-title-wrap { gap: 10px; min-width: 0; }
        .dash-v3-icon-box { width: 44px; height: 44px; border-radius: 10px; animation: none; flex: 0 0 44px; }
        .dash-v3-title-wrap h2 { font-size: 20px !important; line-height: 1.2 !important; letter-spacing: 0 !important; }
        #dash-v3-date-label { font-size: 12px !important; line-height: 1.35 !important; }
        .dash-v3-filter-group { width: 100%; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; padding: 6px; border-radius: 10px; }
        .dash-v3-filter-group > div { display: none !important; }
        .dash-v3-btn-per { min-width: 0; padding: 10px 6px; border-radius: 8px; font-size: 12px; white-space: nowrap; }
        .dash-v3-kpi-grid { grid-template-columns: 1fr; gap: 10px; margin-bottom: 14px; }
        .dash-v3-card { border-radius: 10px; padding: 14px !important; transform: none !important; box-shadow: 0 8px 22px rgba(15,23,42,.05); }
        .dash-v3-card:hover { transform: none !important; }
        .dash-v3-tabs { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 14px; }
        .dash-v3-tab { justify-content: center; padding: 12px; border-radius: 10px; font-size: 13px; }
        .dash-v3-main-grid { grid-template-columns: 1fr; gap: 12px; }
        .dash-v3-side { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .dash-v3-card-head { padding: 14px; align-items: flex-start; flex-direction: column; }
        .dash-v3-card-head .dash-v3-badge { margin-left: 0 !important; }
        .dash-v3-card-body, #dash-v3-pl-body, #dash-v3-cf-body, #dash-v3-top-products { padding: 14px !important; }
        .dash-v3-truth-grid { gap:10px; margin-bottom:14px; }
        .dash-v3-truth-head, .dash-v3-truth-body { padding:14px; }
        .dash-v3-mini-grid { grid-template-columns:1fr; }
        .dash-v3-ledger-val { font-size:16px; }
        .dash-v3-kpi-money { font-size:24px; }
        .dash-v3-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 12px; border-radius: 8px; }
        .pl-line-item { font-size: 13px; line-height: 1.35; }
        .pl-line-val { font-size: 14px; white-space: normal; text-align: right; }
        .pl-group-header { margin: 14px 0 8px 4px; font-size: 11px; }
        .dash-v3-net-box { padding: 16px; border-radius: 10px; display: grid; grid-template-columns: 1fr; gap: 8px; text-align: left; }
        .dash-v3-net-box > div:last-child { font-size: 26px !important; }
        #dash-v3-chart-area { height: 150px !important; gap: 4px !important; overflow-x: auto; }
        #dash-v3-chart-labels { overflow-x: auto; }
      }
      @media (max-width: 390px) {
        .dash-v3-filter-group { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        #dash-v3-refresh { grid-column: span 2; }
      }
    `;
    document.head.appendChild(style);
  };

  // ─── Helpers local timezone queries ───────────────────────────
  // Construct date string formatted safely in local time (YYYY-MM-DDTHH:mm:ss)
  const getLocalDateString = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getLocalRangeIso = (startStr, endStr) => {
    const [sy, sm, sd] = String(startStr).split('-').map(Number);
    const [ey, em, ed] = String(endStr).split('-').map(Number);
    const start = new Date(sy, (sm || 1) - 1, sd || 1, 0, 0, 0, 0);
    const end = new Date(ey, (em || 1) - 1, ed || 1, 23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  };

  const isSameLocalDay = (isoString, targetDateStr) => {
    if (!isoString) return false;
    const d = new Date(isoString); // converts UTC to local automatically
    return getLocalDateString(d) === targetDateStr;
  };

  const parseReturnInfo = (info) => {
    if (!info) return {};
    if (typeof info === 'object') return info;
    try { return JSON.parse(info); } catch (_) { return {}; }
  };

  const effectiveBillTotal = (bill) => {
    const info = parseReturnInfo(bill?.return_info);
    const total = Number(info.new_total ?? bill?.total ?? 0);
    return Number.isFinite(total) ? total : 0;
  };

  const isStockPurchaseExpense = (expense) => {
    const text = [
      expense?.category,
      expense?.description,
      expense?.note,
      expense?.type
    ].filter(Boolean).join(' ').toLowerCase();
    return /stock|purchase|po|inventory|สต็อก|สต๊อก|เข้าคลัง|ซื้อสินค้า|รับสินค้า|ซื้อสต็อก|ซื้อรอบ|สินค้าเข้าคลัง/.test(text);
  };

  const isProjectBill = (bill) => {
    const text = [
      bill?.project_id,
      bill?.customer_name,
      bill?.method,
      bill?.status
    ].filter(Boolean).join(' ');
    return !!bill?.project_id || /\[โครงการ\]|โครงการ|เบิกของโครงการ|จ่ายของให้โครงการ|ต้นทุนโครงการ|project/i.test(text);
  };

  const money = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const projectRetryTime = (row, field) => {
    const time = new Date(row?.[field] || row?.created_at || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const projectRetryKey = (row) => [
    row?.project_id || '',
    row?.description || row?.bill_id || row?.milestone_no || '',
    row?.category || row?.type || ''
  ].map(v => String(v || '').trim().toLowerCase()).join('|');

  const dedupeProjectRetries = (rows, timeField) => {
    const retryWindowMs = 20 * 60 * 1000;
    const kept = [];
    [...(rows || [])]
      .sort((a, b) => projectRetryTime(a, timeField) - projectRetryTime(b, timeField))
      .forEach(row => {
        const key = projectRetryKey(row);
        const amount = money(row?.amount);
        const time = projectRetryTime(row, timeField);
        const oldIndex = kept.findIndex(old =>
          projectRetryKey(old) === key &&
          Math.abs(projectRetryTime(old, timeField) - time) <= retryWindowMs &&
          Math.abs(money(old?.amount) - amount) <= 1
        );
        if (oldIndex >= 0) {
          if (time >= projectRetryTime(kept[oldIndex], timeField)) kept[oldIndex] = row;
        } else {
          kept.push(row);
        }
      });
    return kept;
  };

  const isClosedBill = (bill) => ['ยกเลิก', 'คืนสินค้า'].includes(String(bill?.status || ''));
  const isDebtMethod = (method) => /ค้าง|เครดิต|debt/i.test(String(method || ''));
  const isCodBill = (bill) => /ชำระหน้างาน|เก็บปลายทาง|cod/i.test(`${bill?.status || ''} ${bill?.method || ''}`);

  const billDeposit = (bill) => Math.max(0, money(bill?.deposit_amount));
  const billRemaining = (bill) => Math.max(0, effectiveBillTotal(bill) - billDeposit(bill));

  const billCollectedNow = (bill) => {
    if (isClosedBill(bill) || isCodBill(bill) || isDebtMethod(bill?.method)) return billDeposit(bill);
    const total = effectiveBillTotal(bill);
    const deposit = billDeposit(bill);
    return deposit > 0 && deposit < total ? deposit : total;
  };

  const methodKey = (method) => {
    const m = String(method || '');
    if (/สด/.test(m)) return 'cash';
    if (/โอน|พร้อมเพย์|transfer/i.test(m)) return 'transfer';
    if (/บัตร|credit/i.test(m)) return 'card';
    if (/ค้าง|เครดิต|debt/i.test(m)) return 'debt';
    if (/โครงการ|project/i.test(m)) return 'project';
    return 'other';
  };

  const generateSkeletons = (count, height = '60px') => {
    return Array.from({ length: count }).map(() => `<div class="dash-v3-skeleton mb-3" style="height: ${height}; width: 100%; margin-bottom: 12px;"></div>`).join('');
  };

  // ─── Main Render ──────────────────────────────────────────────
  window.renderDashboardV3 = async function() {
    injectStyles();
    const section = document.getElementById('page-dash');
    if (!section) return;

    // Build the outer shell
    section.innerHTML = `
      <div class="dash-v3-container">
        
        <div class="dash-v3-header">
          <div class="dash-v3-title-wrap">
            <div class="dash-v3-icon-box">
              <i class="material-icons-round" style="font-size: 26px;">insights</i>
            </div>
            <div>
              <h2 style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: var(--text-primary); margin: 0;">วิเคราะห์ธุรกิจ (Cash-Basis)</h2>
              <p style="font-size: 14px; font-weight: 500; color: var(--text-tertiary); margin-top: 2px;" id="dash-v3-date-label">กำลังโหลด...</p>
            </div>
          </div>
          
          <div class="dash-v3-filter-group">
            <button class="dash-v3-btn-per active" data-days="1">วันนี้</button>
            <button class="dash-v3-btn-per" data-days="7">7 วัน</button>
            <button class="dash-v3-btn-per" data-days="30">30 วัน</button>
            <button class="dash-v3-btn-per" data-days="365">ปีนี้</button>
            <div style="width:1px; background:var(--border-light); margin: 4px;"></div>
            <button class="dash-v3-btn-per" id="dash-v3-refresh" title="รีเฟรชข้อมูล" style="padding: 8px 12px;">
              <i class="material-icons-round" style="font-size:18px; vertical-align:middle;">refresh</i>
            </button>
          </div>
        </div>

        <div class="dash-v3-kpi-grid" id="dash-v3-kpi-container">
          <!-- KPIs will be injected here -->
          ${generateSkeletons(5, '120px')}
        </div>

        <div id="dash-v3-truth-container">
          ${generateSkeletons(2, '220px')}
        </div>

        <div class="dash-v3-tabs">
          <div class="dash-v3-tab active" data-tab="pl"><i class="material-icons-round" style="font-size: 20px;">trending_up</i> งบกำไร-ขาดทุน (P&L)</div>
          <div class="dash-v3-tab" data-tab="cf"><i class="material-icons-round" style="font-size: 20px;">account_balance_wallet</i> กระแสเงินสด (Cash Flow)</div>
        </div>

        <div class="dash-v3-main-grid">
          
          <!-- Left Column: Details -->
          <div class="anim-child delay-1">
            <div id="dash-v3-pl-panel" class="dash-v3-card" style="padding: 0;">
              <div class="dash-v3-card-head" style="background: rgba(0,0,0,0.01);">
                <span style="font-size:16px; font-weight:700; color: var(--text-primary);">📊 รายละเอียดกำไร-ขาดทุน</span>
                <span class="dash-v3-badge" style="background:#eff6ff; color:#1d4ed8; margin-left:12px;">วัดผลกำไรจริง</span>
              </div>
              <div class="dash-v3-card-body" id="dash-v3-pl-body">
                ${generateSkeletons(5)}
              </div>
            </div>

            <div id="dash-v3-cf-panel" class="dash-v3-card" style="padding: 0; display: none;">
              <div class="dash-v3-card-head" style="background: rgba(0,0,0,0.01);">
                <span style="font-size:16px; font-weight:700; color: var(--text-primary);">💸 รายละเอียดกระแสเงินสด</span>
                <span class="dash-v3-badge" style="background:#f0fdf4; color:#15803d; margin-left:12px;">เงินหมุนเวียนในระบบ</span>
              </div>
              <div class="dash-v3-card-body" id="dash-v3-cf-body">
                ${generateSkeletons(5)}
              </div>
            </div>
          </div>

          <!-- Right Column: Chart & Top Products -->
          <div class="dash-v3-side anim-child delay-2">
            
            <div class="dash-v3-card" style="padding: 0;">
              <div class="dash-v3-card-head">
                <span style="font-size:15px; font-weight:700;"><i class="material-icons-round" style="font-size:18px; color:var(--text-secondary); vertical-align:-3px; margin-right:4px;">bar_chart</i> ภาพรวมรายวัน</span>
              </div>
              <div class="dash-v3-card-body">
                <div id="dash-v3-chart-area" style="height: 180px; display: flex; align-items: flex-end; gap: 6px; padding-bottom: 10px;">
                   ${generateSkeletons(1, '100%')}
                </div>
                <div id="dash-v3-chart-labels" style="display: flex; gap: 6px; margin-top: 8px;"></div>
                <div style="display: flex; justify-content: center; gap: 16px; margin-top: 20px; border-top: 1px solid var(--border-light); padding-top: 16px;">
                  <span style="font-size:11px; font-weight:600; color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><div style="width:10px;height:10px;background:#10b981;border-radius:3px;"></div>เงินเข้า</span>
                  <span style="font-size:11px; font-weight:600; color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><div style="width:10px;height:10px;background:#ef4444;border-radius:3px;"></div>เงินออก</span>
                </div>
              </div>
            </div>

            <div class="dash-v3-card" style="padding: 0;">
              <div class="dash-v3-card-head">
                <span style="font-size:15px; font-weight:700;"><i class="material-icons-round" style="font-size:18px; color:#f59e0b; vertical-align:-3px; margin-right:4px;">emoji_events</i> สินค้าทำยอดสูงสุด</span>
              </div>
              <div class="dash-v3-card-body" id="dash-v3-top-products">
                 ${generateSkeletons(5, '40px')}
              </div>
            </div>

          </div>
        </div>

      </div>
    `;

    // ─── Bind Events ─────────────────────────────────────────────
    document.querySelectorAll('.dash-v3-btn-per[data-days]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.dash-v3-btn-per[data-days]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        loadData(parseInt(e.currentTarget.dataset.days));
      });
    });

    document.getElementById('dash-v3-refresh').addEventListener('click', () => {
      const activeDays = parseInt(document.querySelector('.dash-v3-btn-per.active')?.dataset.days || 1);
      loadData(activeDays);
    });

    document.querySelectorAll('.dash-v3-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.dash-v3-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const mode = e.currentTarget.dataset.tab;
        document.getElementById('dash-v3-pl-panel').style.display = mode === 'pl' ? 'block' : 'none';
        document.getElementById('dash-v3-cf-panel').style.display = mode === 'cf' ? 'block' : 'none';
      });
    });

    // ─── Initial Load ────────────────────────────────────────────
    loadData(1);
  };

  // ─── Data Fetching & Processing ────────────────────────────────
  async function loadData(days) {
    const today = new Date();
    const startDateObj = new Date(today);
    startDateObj.setDate(startDateObj.getDate() - (days - 1));
    
    // YYYY-MM-DD
    const startStr = getLocalDateString(startDateObj);
    const endStr = getLocalDateString(today);
    const { startIso, endIso } = getLocalRangeIso(startStr, endStr);

    const lbl = document.getElementById('dash-v3-date-label');
    if (lbl) {
      if (days === 1) {
        lbl.innerHTML = `${today.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
      } else {
        lbl.innerHTML = `${startDateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} — ${today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
    }

    // Set skeleton
    document.getElementById('dash-v3-kpi-container').innerHTML = generateSkeletons(5, '120px');
    const plBody = document.getElementById('dash-v3-pl-body');
    const cfBody = document.getElementById('dash-v3-cf-body');
    const chartArea = document.getElementById('dash-v3-chart-area');
    const topProd = document.getElementById('dash-v3-top-products');
    const truthContainer = document.getElementById('dash-v3-truth-container');
    if(plBody) plBody.innerHTML = generateSkeletons(6);
    if(cfBody) cfBody.innerHTML = generateSkeletons(6);
    if(chartArea) chartArea.innerHTML = generateSkeletons(1, '100%');
    if(topProd) topProd.innerHTML = generateSkeletons(5, '40px');
    if(truthContainer) truthContainer.innerHTML = generateSkeletons(2, '220px');

    try {
      const billLimit = days > 30 ? 20000 : (days > 7 ? 5000 : 2000);
      const otherLimit = days > 30 ? 10000 : (days > 7 ? 2000 : 500);

      // Parallel Queries
      const [bR, pR, eR, salR, advR, debtPaymentR, payrollR, projExpR, projMsR, customerDebtR] = await Promise.all([
        db.from('บิลขาย').select('id, bill_no, total, method, status, date, return_info, project_id, customer_name, deposit_amount, received, change, delivery_status, delivery_mode').gte('date', startIso).lte('date', endIso).order('date', { ascending: false }).limit(billLimit),
        db.from('purchase_order').select('total, method, date, status').gte('date', startIso).lte('date', endIso).order('date', { ascending: false }).limit(otherLimit),
        db.from('รายจ่าย').select('amount, category, description, date').gte('date', startIso).lte('date', endIso).order('date', { ascending: false }).limit(otherLimit),
        db.from('เช็คชื่อ').select('employee_id, status, date, deduction, note').gte('date', startStr).lte('date', endStr).limit(otherLimit),
        db.from('เบิกเงิน').select('amount, status, date').gte('date', startIso).lte('date', endIso).limit(otherLimit),
        db.from('ชำระหนี้').select('amount, method, date').gte('date', startIso).lte('date', endIso).limit(otherLimit),
        db.from('จ่ายเงินเดือน').select('net_paid, paid_date').gte('paid_date', startIso).lte('paid_date', endIso).limit(otherLimit),
        db.from('รายจ่ายโครงการ').select('id, project_id, description, category, type, bill_id, amount, paid_at, created_at').not('paid_at','is',null).gte('paid_at', startIso).lte('paid_at', endIso).limit(otherLimit),
        db.from('งวดงาน').select('id, project_id, milestone_no, description, amount, billed_at, created_at, status').eq('status', 'billed').gte('billed_at', startIso).lte('billed_at', endIso).limit(otherLimit),
        db.from('customer').select('debt_amount').gt('debt_amount', 0).limit(10000)
      ]);

      // Filter paid bills only (ignore ค้างชำระ, ยกเลิก)
      const allBills = bR.data || [];
      const activeStoreBills = allBills.filter(b => !isClosedBill(b) && !isProjectBill(b));
      const invoiceSalesTotal = activeStoreBills.reduce((s, b) => s + effectiveBillTotal(b), 0);
      const billCashCollected = activeStoreBills.reduce((s, b) => s + billCollectedNow(b), 0);
      const depositReceived = activeStoreBills.reduce((s, b) => s + billDeposit(b), 0);
      const depositOpenBills = activeStoreBills.filter(b => billDeposit(b) > 0 && billRemaining(b) > 0);
      const depositOutstanding = depositOpenBills.reduce((s, b) => s + billRemaining(b), 0);
      const debtOpenBills = activeStoreBills.filter(b => billDeposit(b) <= 0 && !isCodBill(b) && (isDebtMethod(b.method) || /ค้าง|บางส่วน/.test(String(b.status || ''))));
      const periodDebtCreated = debtOpenBills.reduce((s, b) => s + billRemaining(b), 0);
      const pendingCodBills = activeStoreBills.filter(b => isCodBill(b));
      const sumPendingCod = pendingCodBills.reduce((s, b) => s + effectiveBillTotal(b), 0);
      const currentCustomerDebt = (customerDebtR.data || []).reduce((s, c) => s + money(c.debt_amount), 0);
      const methodBreakdown = activeStoreBills.reduce((acc, b) => {
        const key = methodKey(b.method);
        acc[key] = (acc[key] || 0) + billCollectedNow(b);
        return acc;
      }, { cash: 0, transfer: 0, card: 0, debt: 0, project: 0, other: 0 });

      const paidBills = allBills.filter(b => b.status === 'สำเร็จ' || b.status === 'คืนบางส่วน');
      // For double-checking Method:
      const actualPaidBills = paidBills.filter(b => b.method !== 'ค้างชำระ' && b.method !== 'เครดิต');
      const storePaidBills = actualPaidBills.filter(b => !isProjectBill(b));

      // Cash-basis COGS follows bills that are counted as received revenue in this period.
      const validBillsForCOGS = storePaidBills;
      const allValidBillIds = validBillsForCOGS.map(b => b.id);
      
      // Fetch Bill Items for COGS based on ALL valid bills (to deduct stock cost immediately)
      let billItems = [];
      if (allValidBillIds.length > 0) {
        // Since we might have > 1000 IDs, we chunk it or just limit in query
        const chunkedIds = allValidBillIds.slice(0, 800);
        const iR = await db.from('รายการในบิล').select('name, qty, price, cost, bill_id').in('bill_id', chunkedIds).limit(3000);
        billItems = iR.data || [];
      }

      // ** FILTER OUT UNPAID PURCHASES ** 
      const purchases = (pR.data || []).filter(p => p.method !== 'ค้างชำระ' && p.method !== 'เครดิต' && p.status !== 'ยกเลิก');
      const expenses = eR.data || [];
      const expensesForPL = expenses.filter(e => !isStockPurchaseExpense(e));

      // Calculate active Daily Wages from 'เช็คชื่อ'
      let salaries = [];
      const attendances = salR.data || [];
      const empIds = [...new Set(attendances.map(a => a.employee_id).filter(Boolean))];
      if (empIds.length > 0) {
        const { data: emps } = await db.from('พนักงาน').select('id, daily_wage').in('id', empIds);
        const empWages = {};
        (emps || []).forEach(e => { empWages[e.id] = parseFloat(e.daily_wage || 0); });
        
        salaries = attendances.map(a => {
           let baseAmt = 0;
           let wage = empWages[a.employee_id] || 0;
           if (a.status === 'มา' || a.status === 'มาสาย') baseAmt = wage;
           else if (a.status === 'ลาครึ่งวัน' || a.status === 'ครึ่งวัน' || a.status === 'มาครึ่งวัน') baseAmt = wage / 2;
           baseAmt -= parseFloat(a.deduction || 0);
           const note = String(a.note || '');
           const isProjectLabor = note.includes('[สถานที่ทำงาน:โครงการ:');
           return { paid_date: a.date, net_paid: Math.max(0, baseAmt), work_type: isProjectLabor ? 'project' : 'store' };
        });
      }

      const advances = (advR.data || []).filter(a => a.status === 'อนุมัติ');
      const debtPayments = debtPaymentR.data || [];
      const projExpenses = dedupeProjectRetries(projExpR.data || [], 'paid_at');
      const sumProjExpenses = projExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
      const projMilestones = dedupeProjectRetries(projMsR.data || [], 'billed_at');
      const sumProjMilestones = projMilestones.reduce((s, m) => s + parseFloat(m.amount || 0), 0);

      // ─── ACCOUNTING LOGIC (CASH BASIS) ───────────────────────────

      // 1. REVENUE
      const sumDebtPayments = debtPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const actualRevenue = billCashCollected + sumDebtPayments + sumProjMilestones;

      // 2. COGS (Only from paid bills!)
      const rawCogs = billItems.reduce((s, i) => s + (parseFloat(i.cost || 0) * parseFloat(i.qty || 0)), 0);
      // Deduct returned items
      let returnedCogs = 0;
      const returnedItemsMap = {}; // Tracker for Top Products
      storePaidBills.forEach(b => {
        const returnInfo = parseReturnInfo(b.return_info);
        if (b.status === 'คืนบางส่วน' && returnInfo?.return_items) {
          returnInfo.return_items.forEach(ret => {
            let rCost = parseFloat(ret.cost);
            let rPrice = parseFloat(ret.price || ret.sell_price || 0);
            if (isNaN(rCost) || isNaN(rPrice)) {
              const oItem = billItems.find(i => i.bill_id === b.id && i.name === ret.name);
              rCost = isNaN(rCost) ? (oItem ? parseFloat(oItem.cost || 0) : 0) : rCost;
              rPrice = isNaN(rPrice) || rPrice === 0 ? (oItem ? parseFloat(oItem.price || 0) : 0) : rPrice;
            }
            const retQty = parseFloat(ret.qty || 0);
            returnedCogs += (rCost * retQty);
            
            // Map for Top Products subtraction
            if(!returnedItemsMap[ret.name]) returnedItemsMap[ret.name] = { qty: 0, revenue: 0, cost: 0 };
            returnedItemsMap[ret.name].qty += retQty;
            returnedItemsMap[ret.name].revenue += (rPrice * retQty);
            returnedItemsMap[ret.name].cost += (rCost * retQty);
          });
        }
      });
      const actualCOGS = Math.max(0, rawCogs - returnedCogs);

      // 3. OPEX
      const sumStoreExpenses = expensesForPL.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
      const sumExpenses = sumStoreExpenses + sumProjExpenses;
      const sumSalariesAccrued = salaries.reduce((s, e) => s + parseFloat(e.net_paid || 0), 0); // จากเช็คชื่อรายวัน (P&L)
      const sumStoreSalariesAccrued = salaries.filter(e => e.work_type !== 'project').reduce((s, e) => s + parseFloat(e.net_paid || 0), 0);
      const sumProjectSalariesAccrued = salaries.filter(e => e.work_type === 'project').reduce((s, e) => s + parseFloat(e.net_paid || 0), 0);
      const sumAdvances = advances.reduce((s, a) => s + parseFloat(a.amount || 0), 0);

      const payrollPaid = payrollR.data || [];
      const sumPayrollPaid = payrollPaid.reduce((s, p) => s + parseFloat(p.net_paid || 0), 0); // จ่ายเงินเดือนจริง (Cash Flow)
      
      const totalOpexPL = sumExpenses + sumSalariesAccrued + sumAdvances;
      const totalOpexCash = sumExpenses + sumPayrollPaid + sumAdvances;

      // 4. PURCHASES (Stock)
      const sumPurchases = purchases.reduce((s, p) => s + parseFloat(p.total || 0), 0);

      // P&L
      const storeGrossProfit = (billCashCollected + sumDebtPayments) - actualCOGS;
      const storeNetProfit = storeGrossProfit - sumStoreExpenses - sumStoreSalariesAccrued - sumAdvances;
      const projectNetProfit = sumProjMilestones - sumProjExpenses - sumProjectSalariesAccrued;
      const grossProfit = storeGrossProfit + sumProjMilestones;
      const netProfit = storeNetProfit + projectNetProfit;
      const netMargin = actualRevenue > 0 ? Math.round((netProfit / actualRevenue) * 100) : 0;

      // CASH FLOW
      const cashIn = actualRevenue;
      const cashOut = sumPurchases + totalOpexCash;
      const liquidity = cashIn - cashOut;

      // ─── RENDER KPIs ──────────────────────────────────────────────
      const kpiContainer = document.getElementById('dash-v3-kpi-container');
      const kpis = [
        { label: 'เงินจริงรับเข้า', val: actualRevenue, color: '#10b981', icon: 'payments', sub: `ขาย/มัดจำ ฿${formatNum(Math.round(billCashCollected))} + เก็บหนี้ ฿${formatNum(Math.round(sumDebtPayments))}` },
        { label: 'ยอดขายตามบิล', val: invoiceSalesTotal, color: '#0ea5e9', icon: 'receipt_long', sub: 'รวมบิลสด/มัดจำ/ค้างในช่วงที่เลือก' },
        { label: 'ต้นทุนขาย', val: actualCOGS, color: '#f59e0b', icon: 'inventory', sub: 'เฉพาะบิลที่รับเงินแล้ว' },
        { label: 'เงินค้างรับ', val: periodDebtCreated + depositOutstanding + sumPendingCod, color: '#8b5cf6', icon: 'request_quote', sub: `ลูกหนี้/มัดจำ/COD ที่ยังต้องตามเก็บ` },
        { label: 'กำไรสุทธิ', val: netProfit, color: netProfit >= 0 ? '#3b82f6' : '#ef4444', icon: 'trending_up', sub: `Net Margin ${netMargin}%`, bg: 'var(--card-bg-sub, #f0f9ff)' },
        { label: 'สภาพคล่อง (เงินหมุน)', val: liquidity, color: liquidity >= 0 ? '#10b981' : '#ef4444', icon: 'account_balance_wallet', sub: liquidity >= 0 ? 'เงินสดระบบบวก' : 'เงินสดระบบติดลบ' }
      ];

      if (kpiContainer) {
        kpiContainer.innerHTML = kpis.map((k, i) => `
          <div class="dash-v3-card anim-child delay-${i+1}" style="--card-accent: ${k.color}; --card-soft-bg: color-mix(in srgb, ${k.color} 8%, #ffffff); padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
              <span style="font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">${k.label}</span>
              <div style="width: 32px; height: 32px; border-radius: 10px; background: color-mix(in srgb, ${k.color} 15%, transparent); display:flex; align-items:center; justify-content:center; color:${k.color}">
                <i class="material-icons-round" style="font-size:18px;">${k.icon}</i>
              </div>
            </div>
            <div class="dash-v3-money dash-v3-kpi-money">
              ${k.val < 0 ? '−' : ''}฿${formatNum(Math.abs(Math.round(k.val)))}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: var(--text-tertiary);">${k.sub}</div>
          </div>
        `).join('');
      }

      if (truthContainer) {
        truthContainer.innerHTML = `
          <div class="dash-v3-truth-grid">
            <div class="dash-v3-truth-panel">
              <div class="dash-v3-truth-head">
                <div class="dash-v3-truth-title"><i class="material-icons-round" style="color:#10b981">account_balance_wallet</i> ยอดจริงที่ควรดูเป็นหลัก</div>
                <span class="dash-v3-badge" style="background:#ecfdf5;color:#047857">เงินจริง</span>
              </div>
              <div class="dash-v3-truth-body">
                <div class="dash-v3-ledger-row">
                  <div>
                    <div class="dash-v3-ledger-label">ขาย/มัดจำที่รับเงินในช่วงนี้</div>
                    <div class="dash-v3-ledger-help">เงินจากบิลขายที่รับจริง ไม่รวมยอดค้าง</div>
                  </div>
                  <div class="dash-v3-ledger-val" style="color:#059669">฿${formatNum(Math.round(billCashCollected))}</div>
                </div>
                <div class="dash-v3-ledger-row">
                  <div>
                    <div class="dash-v3-ledger-label">รับชำระหนี้ลูกค้าเก่า</div>
                    <div class="dash-v3-ledger-help">ลูกหนี้ที่เคยค้างแล้วกลับมาจ่ายในช่วงนี้</div>
                  </div>
                  <div class="dash-v3-ledger-val" style="color:#2563eb">฿${formatNum(Math.round(sumDebtPayments))}</div>
                </div>
                <div class="dash-v3-ledger-row">
                  <div>
                    <div class="dash-v3-ledger-label">รับเงินงวดโครงการ</div>
                    <div class="dash-v3-ledger-help">งวดงานที่บันทึกว่าเรียกเก็บแล้วในช่วงนี้</div>
                  </div>
                  <div class="dash-v3-ledger-val" style="color:#7c3aed">฿${formatNum(Math.round(sumProjMilestones))}</div>
                </div>
                <div class="dash-v3-ledger-row total">
                  <div>
                    <div class="dash-v3-ledger-label">เงินจริงรับเข้ารวม</div>
                    <div class="dash-v3-ledger-help">ตัวเลขนี้เหมาะใช้ดูเงินเข้าจริงของช่วงเวลา</div>
                  </div>
                  <div class="dash-v3-ledger-val">฿${formatNum(Math.round(actualRevenue))}</div>
                </div>
              </div>
            </div>

            <div class="dash-v3-truth-panel">
              <div class="dash-v3-truth-head">
                <div class="dash-v3-truth-title"><i class="material-icons-round" style="color:#f59e0b">pending_actions</i> ยอดที่ยังต้องตามต่อ</div>
                <span class="dash-v3-badge" style="background:#fff7ed;color:#c2410c">ค้างรับ</span>
              </div>
              <div class="dash-v3-truth-body">
                <div class="dash-v3-mini-grid">
                  <div class="dash-v3-mini">
                    <div class="lbl">ยอดขายตามบิล</div>
                    <div class="val" style="color:#0284c7">฿${formatNum(Math.round(invoiceSalesTotal))}</div>
                  </div>
                  <div class="dash-v3-mini">
                    <div class="lbl">รับมัดจำแล้ว</div>
                    <div class="val" style="color:#d97706">฿${formatNum(Math.round(depositReceived))}</div>
                  </div>
                  <div class="dash-v3-mini">
                    <div class="lbl">ค้างหลังมัดจำ</div>
                    <div class="val" style="color:#dc2626">฿${formatNum(Math.round(depositOutstanding))}</div>
                  </div>
                  <div class="dash-v3-mini">
                    <div class="lbl">ค้างชำระจากบิลช่วงนี้</div>
                    <div class="val" style="color:#dc2626">฿${formatNum(Math.round(periodDebtCreated))}</div>
                  </div>
                  <div class="dash-v3-mini">
                    <div class="lbl">รอเก็บปลายทาง/COD</div>
                    <div class="val" style="color:#7c3aed">฿${formatNum(Math.round(sumPendingCod))}</div>
                  </div>
                  <div class="dash-v3-mini">
                    <div class="lbl">ลูกหนี้คงค้างทั้งหมดตอนนี้</div>
                    <div class="val" style="color:#b91c1c">฿${formatNum(Math.round(currentCustomerDebt))}</div>
                  </div>
                </div>
                <div class="dash-v3-ledger-row" style="padding-bottom:0">
                  <div>
                    <div class="dash-v3-ledger-label">แยกเงินรับตามวิธีชำระ</div>
                    <div class="dash-v3-ledger-help">เงินสด ฿${formatNum(Math.round(methodBreakdown.cash))} · โอน ฿${formatNum(Math.round(methodBreakdown.transfer))} · บัตร ฿${formatNum(Math.round(methodBreakdown.card))} · อื่นๆ ฿${formatNum(Math.round(methodBreakdown.other))}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // ─── RENDER P&L ────────────────────────────────────────────────
      if (plBody) {
        plBody.innerHTML = `
          <div class="dash-v3-row" style="background: color-mix(in srgb, #10b981 5%, transparent);">
            <div>
              <div class="pl-line-item" style="color:#10b981;">ยอดขายหน้าร้าน (บิลสด)</div>
              <div style="font-size:11px; color:#34d399; margin-top:2px;">นับเฉพาะเงินที่รับจริงจากบิลขาย/มัดจำในช่วงนี้</div>
            </div>
            <div class="pl-line-val" style="color:#10b981;">฿${formatNum(Math.round(billCashCollected))}</div>
          </div>
          <div class="dash-v3-row" style="background: color-mix(in srgb, #3b82f6 5%, transparent);">
            <div>
              <div class="pl-line-item" style="color:#3b82f6;">รับชำระหนี้จากลูกค้าเก่า</div>
              <div style="font-size:11px; color:#60a5fa; margin-top:2px;">นำมานับรวมเป็นรายได้จริงของช่วงเวลานี้</div>
            </div>
            <div class="pl-line-val" style="color:#3b82f6;">+฿${formatNum(Math.round(sumDebtPayments))}</div>
          </div>
          <div class="dash-v3-row" style="background: color-mix(in srgb, #8b5cf6 5%, transparent);">
            <div>
              <div class="pl-line-item" style="color:#8b5cf6;">รับเงินงวดโครงการ</div>
              <div style="font-size:11px; color:#a78bfa; margin-top:2px;">นำมานับรวมเป็นรายได้จริงของช่วงเวลานี้</div>
            </div>
            <div class="pl-line-val" style="color:#8b5cf6;">+฿${formatNum(Math.round(sumProjMilestones))}</div>
          </div>
          
          <div style="display:flex; justify-content:space-between; padding:16px; margin: 8px 0; border-top: 1px dashed var(--border-light); border-bottom: 1px dashed var(--border-light);">
            <div style="font-size:16px; font-weight:700;">รายได้สุทธิ (Actual Revenue)</div>
            <div style="font-size:18px; font-weight:800; color:#10b981;">฿${formatNum(Math.round(actualRevenue))}</div>
          </div>

          <div class="pl-group-header">หัก ต้นทุนขายสินค้าประจำบิล</div>
          <div class="dash-v3-row">
            <div>
              <div class="pl-line-item">ต้นทุนขาย (COGS)</div>
              <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">หักสินค้าตีคืนเรียบร้อยแล้ว</div>
            </div>
            <div class="pl-line-val" style="color:#f59e0b;">-฿${formatNum(Math.round(actualCOGS))}</div>
          </div>
          
          <div style="display:flex; justify-content:space-between; padding:12px 16px; margin: 8px 0; background:var(--bg-base); border-radius:10px;">
            <div style="font-size:14px; font-weight:700;">กำไรขั้นต้น (Gross Profit)</div>
            <div style="font-size:15px; font-weight:800; color:${grossProfit >= 0 ? '#3b82f6' : '#ef4444'};">฿${formatNum(Math.round(grossProfit))}</div>
          </div>
          
          <div class="pl-group-header">หัก ค่าใช้จ่ายการดำเนินงาน (OPEX)</div>
          <div class="dash-v3-row">
            <div>
              <div class="pl-line-item">รายจ่ายหน้าร้าน</div>
              <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">รายจ่ายทั่วไปของร้าน ไม่รวมรายจ่ายโครงการ</div>
            </div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumStoreExpenses))}</div>
          </div>
          <div class="dash-v3-row">
            <div>
              <div class="pl-line-item">รายจ่ายโครงการ</div>
              <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">วัสดุ/ค่าใช้จ่ายที่ลงในระบบโครงการ</div>
            </div>
            <div class="pl-line-val" style="color:#8b5cf6;">-฿${formatNum(Math.round(sumProjExpenses))}</div>
          </div>
          <div class="dash-v3-row">
            <div class="pl-line-item">เบิกเงินล่วงหน้าพนักงาน</div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumAdvances))}</div>
          </div>
          <div class="dash-v3-row">
            <div>
              <div class="pl-line-item">ค่าแรงหน้าร้านจากเช็คชื่อ</div>
              <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">คนที่เลือกอยู่หน้าร้านหลังเช็คชื่อ</div>
            </div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumStoreSalariesAccrued))}</div>
          </div>
          <div class="dash-v3-row">
            <div>
              <div class="pl-line-item">ค่าแรงโครงการจากเช็คชื่อ</div>
              <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">คนที่เลือกไปโครงการหลังเช็คชื่อ</div>
            </div>
            <div class="pl-line-val" style="color:#8b5cf6;">-฿${formatNum(Math.round(sumProjectSalariesAccrued))}</div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:14px 0;">
            <div style="border:1px solid #fecaca; background:#fff7f7; border-radius:14px; padding:14px 16px;">
              <div style="font-size:12px; font-weight:900; color:#991b1b; margin-bottom:4px;">กำไรหน้าร้าน</div>
              <div style="font-size:22px; font-weight:950; color:${storeNetProfit >= 0 ? '#047857' : '#b91c1c'};">${storeNetProfit < 0 ? '−' : ''}฿${formatNum(Math.abs(Math.round(storeNetProfit)))}</div>
              <div style="font-size:11px; font-weight:700; color:#94a3b8; margin-top:2px;">เงินรับจากบิล + รับชำระหนี้ - ต้นทุน - ค่าใช้จ่ายร้าน</div>
            </div>
            <div style="border:1px solid #ddd6fe; background:#f5f3ff; border-radius:14px; padding:14px 16px;">
              <div style="font-size:12px; font-weight:900; color:#5b21b6; margin-bottom:4px;">กำไรโครงการ</div>
              <div style="font-size:22px; font-weight:950; color:${projectNetProfit >= 0 ? '#047857' : '#b91c1c'};">${projectNetProfit < 0 ? '−' : ''}฿${formatNum(Math.abs(Math.round(projectNetProfit)))}</div>
              <div style="font-size:11px; font-weight:700; color:#94a3b8; margin-top:2px;">เงินงวดโครงการ - รายจ่ายโครงการ - ค่าแรงโครงการ</div>
            </div>
          </div>

          <div class="dash-v3-net-box" style="--card-bg-sub: ${netProfit >= 0 ? '#10b981' : '#ef4444'}">
            <div style="position:relative; z-index:2;">
              <div style="font-size:14px; font-weight:800; color:rgba(255,255,255,0.8); text-transform:uppercase;">กำไรสุทธิ</div>
              <div style="font-size:12px; font-weight:600; color:#fff; margin-top:4px; opacity:0.9;">Net Margin ${netMargin}%</div>
            </div>
            <div style="font-size:32px; font-weight:900; color:#fff; position:relative; z-index:2; letter-spacing:-1px;">
              ${netProfit < 0 ? '−' : ''}฿${formatNum(Math.abs(Math.round(netProfit)))}
            </div>
          </div>
        `;
      }

      // ─── RENDER CASH FLOW ──────────────────────────────────────────
      if (cfBody) {
        cfBody.innerHTML = `
          <div class="dash-v3-row" style="background: color-mix(in srgb, #10b981 5%, transparent);">
            <div>
              <div class="pl-line-item" style="color:#10b981; display:flex; align-items:center; gap:8px;"><i class="material-icons-round" style="font-size:18px;">get_app</i> เงินสดรับเข้า</div>
              <div style="font-size:11px; color:#10b981; margin-top:2px;">บิลที่รับเงินจริง + เก็บหนี้ + เงินงวดโครงการ</div>
            </div>
            <div class="pl-line-val" style="color:#10b981; font-size: 18px;">+฿${formatNum(Math.round(actualRevenue))}</div>
          </div>
          
          <div class="pl-group-header">กระแสเงินสดจ่ายออก (CASH OUT)</div>
          <div class="dash-v3-row">
            <div class="pl-line-item">ซื้อรอบการซื้อ / ซื้อสต็อกสินค้า</div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumPurchases))}</div>
          </div>
          <div class="dash-v3-row">
            <div>
              <div class="pl-line-item">รายจ่ายหน้าร้าน + เบิกเงินล่วงหน้า</div>
              <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">จิปาถะ/ค่าใช้จ่ายร้าน แยกจากรายจ่ายโครงการ</div>
            </div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumStoreExpenses + sumAdvances))}</div>
          </div>
          <div class="dash-v3-row">
            <div>
              <div class="pl-line-item">รายจ่ายโครงการที่จ่ายแล้ว</div>
              <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">อ้างอิงจากรายการโครงการที่มีวันที่จ่าย</div>
            </div>
            <div class="pl-line-val" style="color:#8b5cf6;">-฿${formatNum(Math.round(sumProjExpenses))}</div>
          </div>
          <div class="dash-v3-row">
            <div class="pl-line-item">จ่ายเงินเดือนพนักงาน (ผ่านระบบจ่ายเงินเดือน)</div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumPayrollPaid))}</div>
          </div>

          <div class="dash-v3-net-box" style="--card-bg-sub: ${liquidity >= 0 ? '#3b82f6' : '#ef4444'}">
            <div style="position:relative; z-index:2;">
              <div style="font-size:14px; font-weight:800; color:rgba(255,255,255,0.8); text-transform:uppercase;">สภาพคล่องสุทธิ</div>
              <div style="font-size:12px; font-weight:600; color:#fff; margin-top:4px; opacity:0.9;">
                ${liquidity >= 0 ? '<i class="material-icons-round" style="font-size:12px; vertical-align:-2px;">arrow_upward</i> เงินสดเพิ่มขึ้น' : '<i class="material-icons-round" style="font-size:12px; vertical-align:-2px;">arrow_downward</i> เงินสดลดลง'}
              </div>
            </div>
            <div style="font-size:32px; font-weight:900; color:#fff; position:relative; z-index:2; letter-spacing:-1px;">
              ${liquidity < 0 ? '−' : ''}฿${formatNum(Math.abs(Math.round(liquidity)))}
            </div>
          </div>
          
          <div style="margin-top:24px; display:flex; gap:12px; padding:16px; background:#fffbeb; border-radius:12px; border:1px solid #fef08a;">
            <i class="material-icons-round" style="color:#d97706; font-size:20px;">lightbulb</i>
            <div style="font-size:13px; color:#b45309; line-height:1.5;">
              <strong>ข้อควรรู้:</strong> สภาพคล่องไม่ใช่กำไร! บางครั้งสภาพคล่องติดลบเพราะไปสต็อกสินค้าเยอะ แต่สิ้นเดือนอาจจะกำไรดี ให้ดูกำไรจริงที่หน้า P&L
            </div>
          </div>
        `;
      }

      // ─── RENDER CHART ─────────────────────────────────────────────
      // We will group data by local date
      const chartDays = Math.min(days, 14); // Avoid crowding. Max 14 bars.
      const chartData = [];
      const endDateInner = new Date();
      for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date(endDateInner);
        d.setDate(d.getDate() - i);
        const dStr = getLocalDateString(d); // YYYY-MM-DD local
        
        // Sales for this day
        const daySales = activeStoreBills.filter(b => isSameLocalDay(b.date, dStr)).reduce((s, b) => s + billCollectedNow(b), 0);
        const dayDebtIn = debtPayments.filter(p => isSameLocalDay(p.date, dStr)).reduce((s, p) => s + parseFloat(p.amount||0), 0);
        const dayProjMs = projMilestones.filter(m => isSameLocalDay(m.billed_at, dStr)).reduce((s, m) => s + parseFloat(m.amount||0), 0);
        const dayCashIn = daySales + dayDebtIn + dayProjMs;

        // Expenses for this day
        const dayExp = expenses.filter(e => isSameLocalDay(e.date, dStr)).reduce((s, e) => s + parseFloat(e.amount||0), 0);
        const dayPur = purchases.filter(p => isSameLocalDay(p.date, dStr)).reduce((s, p) => s + parseFloat(p.total||0), 0);
        const dayPayroll = payrollPaid.filter(sa => isSameLocalDay(sa.paid_date, dStr)).reduce((s, sa) => s + parseFloat(sa.net_paid||0), 0);
        const dayAdv = advances.filter(a => isSameLocalDay(a.date, dStr)).reduce((s, a) => s + parseFloat(a.amount||0), 0);
        const dayProjExp = projExpenses.filter(e => isSameLocalDay(e.paid_at, dStr)).reduce((s, e) => s + parseFloat(e.amount||0), 0);
        const dayCashOut = dayExp + dayPur + dayPayroll + dayAdv + dayProjExp;

        chartData.push({ date: dStr, in: dayCashIn, out: dayCashOut, dateObj: d });
      }

      const cArea = document.getElementById('dash-v3-chart-area');
      const cLabel = document.getElementById('dash-v3-chart-labels');
      
      if (cArea && cLabel) {
        const maxVal = Math.max(...chartData.map(d => Math.max(d.in, d.out)), 1); // Avoid div/0
        
        cArea.innerHTML = chartData.map((d, idx) => {
          const hIn = Math.round((d.in / maxVal) * 160);
          const hOut = Math.round((d.out / maxVal) * 160);
          
          return `
            <div class="dash-v3-bar-wrap">
              <div class="dash-v3-tooltip">
                ${d.dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}<br>
                เงินเข้า: ฿${formatNum(Math.round(d.in))}<br>
                เงินออก: ฿${formatNum(Math.round(d.out))}
              </div>
              <div style="display:flex; gap:4px; align-items:flex-end; width:100%; justify-content:center;">
                ${hIn > 0 ? `<div class="dash-v3-bar" style="height:${hIn}px; background:linear-gradient(to top, #059669, #34d399); animation-delay: ${idx * 0.05}s;"></div>` : ''}
                ${hOut > 0 ? `<div class="dash-v3-bar" style="height:${hOut}px; background:linear-gradient(to top, #dc2626, #f87171); animation-delay: ${idx * 0.05}s;"></div>` : ''}
                ${hIn === 0 && hOut === 0 ? `<div style="height:2px; width:14px; background:var(--border-light); border-radius:2px;"></div>` : ''}
              </div>
            </div>
          `;
        }).join('');

        cLabel.innerHTML = chartData.map(d => `
          <div style="flex:1; text-align:center; font-size:10px; font-weight:600; color:var(--text-tertiary); max-width:40px; overflow:hidden; white-space:nowrap;">
            ${d.dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
          </div>
        `).join('');
      }

      // ─── RENDER TOP PRODUCTS ──────────────────────────────────────
      if (topProd) {
        const itemMap = {};
        billItems.forEach(i => {
          if (!itemMap[i.name]) itemMap[i.name] = { qty: 0, revenue: 0, profit: 0 };
          
          const iQty = parseFloat(i.qty || 0);
          const iPrice = parseFloat(i.price || 0);
          const iCost = parseFloat(i.cost || 0);
          const iTotal = iQty * iPrice;
          const iProfit = iTotal - (iQty * iCost);

          itemMap[i.name].qty += iQty;
          itemMap[i.name].revenue += iTotal;
          itemMap[i.name].profit += iProfit;
        });

        // Deduct returned products
        Object.keys(returnedItemsMap).forEach(rName => {
           if(itemMap[rName]) {
              itemMap[rName].qty -= returnedItemsMap[rName].qty;
              itemMap[rName].revenue -= returnedItemsMap[rName].revenue;
              itemMap[rName].profit -= (returnedItemsMap[rName].revenue - returnedItemsMap[rName].cost);
              if(itemMap[rName].revenue < 0) itemMap[rName].revenue = 0;
           }
        });

        // Object.entries -> Array, sort by Revenue. Top 5.
        const topArray = Object.entries(itemMap).sort((a,b) => b[1].revenue - a[1].revenue).slice(0, 5);
        if (topArray.length === 0) {
          topProd.innerHTML = `<div style="text-align:center; color:var(--text-tertiary); font-size:14px; padding:30px 0;">ยังไม่มีการขายในช่วงเวลานี้</div>`;
        } else {
          const highestRev = topArray[0][1].revenue;
          topProd.innerHTML = topArray.map(([name, data], idx) => {
            const mg = data.revenue > 0 ? Math.round((data.profit / data.revenue) * 100) : 0;
            const wPct = Math.max(5, Math.round((data.revenue / highestRev) * 100)); // Minimum width 5%
            
            return `
              <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;" class="anim-child delay-${idx+1}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:14px; font-weight:700; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${idx + 1}. ${name}</span>
                  <div style="text-align:right;">
                    <div style="font-size:14px; font-weight:800;">฿${formatNum(Math.round(data.revenue))}</div>
                    <div style="font-size:10px; font-weight:700; color:${mg >= 0 ? '#10b981' : '#ef4444'};">Margin ${mg}%</div>
                  </div>
                </div>
                <div style="height:6px; background:var(--bg-base); border-radius:4px; overflow:hidden;">
                  <div style="height:100%; border-radius:4px; width:${wPct}%; background: linear-gradient(90deg, #f59e0b, #fbbf24);"></div>
                </div>
              </div>
            `;
          }).join('');
        }
      }

    } catch (e) {
      console.error('[Dashboard v3] Load Data Error:', e);
      if(plBody) plBody.innerHTML = `<div style="color:red; padding:20px;">เกิดข้อผิดพลาดในการโหลดข้อมูล: ${e.message}</div>`;
    }
  }

})();
