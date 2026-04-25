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
      .dash-v3-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 20px; margin-bottom: 28px; }
      .dash-v3-card { background: #ffffff; border-radius: 24px; padding: 26px; border: 1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 10px 30px rgba(0,0,0,0.04); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); position: relative; overflow: hidden; }
      .dash-v3-card:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.08); border-color: var(--card-accent, #cbd5e1); z-index: 10; }
      .dash-v3-card::before { content: ''; position: absolute; top:0; left:0; width:5px; height:100%; background: var(--card-accent, transparent); transition: width 0.3s; opacity: 1; border-radius: 24px 0 0 24px; }
      .dash-v3-card:hover::before { width: 8px; }
      
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
      .pl-line-val { font-size: 16px; font-weight: 800; }
      .pl-group-header { font-size: 12px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 8px 12px; display: flex; align-items: center; gap: 6px; }
      
      .dash-v3-net-box { background: linear-gradient(135deg, var(--card-bg-sub, #f8fafc), color-mix(in srgb, var(--card-bg-sub, #f8fafc) 90%, #000)); border-radius: 16px; padding: 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.04); position: relative; overflow: hidden; border: 1px solid color-mix(in srgb, var(--card-bg-sub, #e2e8f0) 80%, #000); }
      .dash-v3-net-box::after { content: ''; position: absolute; top: 0; right: 0; width: 150px; height: 150px; background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%); border-radius: 50%; transform: translate(30%, -30%); }
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

  const isSameLocalDay = (isoString, targetDateStr) => {
    if (!isoString) return false;
    const d = new Date(isoString); // converts UTC to local automatically
    return getLocalDateString(d) === targetDateStr;
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

        <div class="dash-v3-tabs">
          <div class="dash-v3-tab active" data-tab="pl"><i class="material-icons-round" style="font-size: 20px;">trending_up</i> งบกำไร-ขาดทุน (P&L)</div>
          <div class="dash-v3-tab" data-tab="cf"><i class="material-icons-round" style="font-size: 20px;">account_balance_wallet</i> กระแสเงินสด (Cash Flow)</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start;">
          
          <!-- Left Column: Details -->
          <div class="anim-child delay-1">
            <div id="dash-v3-pl-panel" class="dash-v3-card" style="padding: 0;">
              <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); background: rgba(0,0,0,0.01);">
                <span style="font-size:16px; font-weight:700; color: var(--text-primary);">📊 รายละเอียดกำไร-ขาดทุน</span>
                <span class="dash-v3-badge" style="background:#eff6ff; color:#1d4ed8; margin-left:12px;">วัดผลกำไรจริง</span>
              </div>
              <div style="padding: 24px;" id="dash-v3-pl-body">
                ${generateSkeletons(5)}
              </div>
            </div>

            <div id="dash-v3-cf-panel" class="dash-v3-card" style="padding: 0; display: none;">
              <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); background: rgba(0,0,0,0.01);">
                <span style="font-size:16px; font-weight:700; color: var(--text-primary);">💸 รายละเอียดกระแสเงินสด</span>
                <span class="dash-v3-badge" style="background:#f0fdf4; color:#15803d; margin-left:12px;">เงินหมุนเวียนในระบบ</span>
              </div>
              <div style="padding: 24px;" id="dash-v3-cf-body">
                ${generateSkeletons(5)}
              </div>
            </div>
          </div>

          <!-- Right Column: Chart & Top Products -->
          <div style="display: flex; flex-direction: column; gap: 24px;" class="anim-child delay-2">
            
            <div class="dash-v3-card" style="padding: 0;">
              <div style="padding: 18px 20px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size:15px; font-weight:700;"><i class="material-icons-round" style="font-size:18px; color:var(--text-secondary); vertical-align:-3px; margin-right:4px;">bar_chart</i> ภาพรวมรายวัน</span>
              </div>
              <div style="padding: 20px;">
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
              <div style="padding: 18px 20px; border-bottom: 1px solid var(--border-light);">
                <span style="font-size:15px; font-weight:700;"><i class="material-icons-round" style="font-size:18px; color:#f59e0b; vertical-align:-3px; margin-right:4px;">emoji_events</i> สินค้าทำยอดสูงสุด</span>
              </div>
              <div style="padding: 20px;" id="dash-v3-top-products">
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
    if(plBody) plBody.innerHTML = generateSkeletons(6);
    if(cfBody) cfBody.innerHTML = generateSkeletons(6);
    if(chartArea) chartArea.innerHTML = generateSkeletons(1, '100%');
    if(topProd) topProd.innerHTML = generateSkeletons(5, '40px');

    try {
      const billLimit = days > 30 ? 20000 : (days > 7 ? 5000 : 2000);
      const otherLimit = days > 30 ? 10000 : (days > 7 ? 2000 : 500);

      // Parallel Queries
      const [bR, pR, eR, salR, advR, debtPaymentR, payrollR, projExpR, projMsR] = await Promise.all([
        db.from('บิลขาย').select('id, bill_no, total, method, status, date, return_info').gte('date', startStr + 'T00:00:00').order('date', { ascending: false }).limit(billLimit),
        db.from('purchase_order').select('total, method, date, status').gte('date', startStr + 'T00:00:00').order('date', { ascending: false }).limit(otherLimit),
        db.from('รายจ่าย').select('amount, category, date').gte('date', startStr + 'T00:00:00').order('date', { ascending: false }).limit(otherLimit),
        db.from('เช็คชื่อ').select('employee_id, status, date, deduction').gte('date', startStr + 'T00:00:00').limit(otherLimit),
        db.from('เบิกเงิน').select('amount, status, date').gte('date', startStr + 'T00:00:00').limit(otherLimit),
        db.from('ชำระหนี้').select('amount, method, date').gte('date', startStr + 'T00:00:00').limit(otherLimit),
        db.from('จ่ายเงินเดือน').select('net_paid, paid_date').gte('paid_date', startStr + 'T00:00:00').limit(otherLimit),
        db.from('รายจ่ายโครงการ').select('amount, paid_at').not('paid_at','is',null).gte('paid_at', startStr + 'T00:00:00').limit(otherLimit),
        db.from('งวดงาน').select('amount, billed_at').eq('status', 'billed').gte('billed_at', startStr + 'T00:00:00').limit(otherLimit)
      ]);

      // Filter paid bills only (ignore ค้างชำระ, ยกเลิก)
      const allBills = bR.data || [];
      const paidBills = allBills.filter(b => b.status === 'สำเร็จ' || b.status === 'คืนบางส่วน');
      // For double-checking Method:
      const actualPaidBills = paidBills.filter(b => b.method !== 'ค้างชำระ' && b.method !== 'เครดิต');

      // (NEW) Valid bills for COGS: Include credit/ค้างชำระ, but exclude 'ยกเลิก'
      const validBillsForCOGS = allBills.filter(b => b.status !== 'ยกเลิก');
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
           else if (a.status === 'ลาครึ่งวัน') baseAmt = wage / 2;
           baseAmt -= parseFloat(a.deduction || 0);
           return { paid_date: a.date, net_paid: Math.max(0, baseAmt) };
        });
      }

      const advances = (advR.data || []).filter(a => a.status === 'อนุมัติ');
      const debtPayments = debtPaymentR.data || [];
      const projExpenses = projExpR.data || [];
      const sumProjExpenses = projExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
      const projMilestones = projMsR.data || [];
      const sumProjMilestones = projMilestones.reduce((s, m) => s + parseFloat(m.amount || 0), 0);

      // ─── ACCOUNTING LOGIC (CASH BASIS) ───────────────────────────

      // 1. REVENUE
      const sumPaidBills = actualPaidBills.reduce((s, b) => s + parseFloat(b.total || 0), 0);
      const sumDebtPayments = debtPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const actualRevenue = sumPaidBills + sumDebtPayments + sumProjMilestones;

      // 2. COGS (Only from paid bills!)
      const rawCogs = billItems.reduce((s, i) => s + (parseFloat(i.cost || 0) * parseFloat(i.qty || 0)), 0);
      // Deduct returned items
      let returnedCogs = 0;
      const returnedItemsMap = {}; // Tracker for Top Products
      actualPaidBills.forEach(b => {
        if (b.status === 'คืนบางส่วน' && b.return_info && b.return_info.return_items) {
          b.return_info.return_items.forEach(ret => {
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
      const actualCOGS = rawCogs - returnedCogs;

      // 3. OPEX
      const sumExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0) + sumProjExpenses;
      const sumSalariesAccrued = salaries.reduce((s, e) => s + parseFloat(e.net_paid || 0), 0); // จากเช็คชื่อรายวัน (P&L)
      const sumAdvances = advances.reduce((s, a) => s + parseFloat(a.amount || 0), 0);

      const payrollPaid = payrollR.data || [];
      const sumPayrollPaid = payrollPaid.reduce((s, p) => s + parseFloat(p.net_paid || 0), 0); // จ่ายเงินเดือนจริง (Cash Flow)
      
      const totalOpexPL = sumExpenses + sumSalariesAccrued + sumAdvances;
      const totalOpexCash = sumExpenses + sumPayrollPaid + sumAdvances;

      // 4. PURCHASES (Stock)
      const sumPurchases = purchases.reduce((s, p) => s + parseFloat(p.total || 0), 0);

      // P&L
      const grossProfit = actualRevenue - actualCOGS;
      const netProfit = grossProfit - totalOpexPL;
      const netMargin = actualRevenue > 0 ? Math.round((netProfit / actualRevenue) * 100) : 0;

      // CASH FLOW
      const cashIn = actualRevenue;
      const cashOut = sumPurchases + totalOpexCash;
      const liquidity = cashIn - cashOut;

      // Pending COD
      const pendingCodBills = allBills.filter(b => b.status === 'ชำระหน้างาน');
      const sumPendingCod = pendingCodBills.reduce((s, b) => s + parseFloat(b.total || 0), 0);

      // ─── RENDER KPIs ──────────────────────────────────────────────
      const kpiContainer = document.getElementById('dash-v3-kpi-container');
      const kpis = [
        { label: 'ยอดขายจริงสุทธิ', val: actualRevenue, color: '#10b981', icon: 'payments', sub: `รวมหนี้ที่เก็บได้ ฿${formatNum(sumDebtPayments)}` },
        { label: 'ต้นทุนขาย', val: actualCOGS, color: '#f59e0b', icon: 'inventory', sub: 'เฉพาะบิลที่รับเงินแล้ว' },
        { label: 'รอเก็บเงินปลายทาง (COD)', val: sumPendingCod, color: '#8b5cf6', icon: 'local_shipping', sub: 'ยอดเงินค้างรับจากการจัดส่ง' },
        { label: 'กำไรสุทธิ', val: netProfit, color: netProfit >= 0 ? '#3b82f6' : '#ef4444', icon: 'trending_up', sub: `Net Margin ${netMargin}%`, bg: 'var(--card-bg-sub, #f0f9ff)' },
        { label: 'สภาพคล่อง (เงินหมุน)', val: liquidity, color: liquidity >= 0 ? '#10b981' : '#ef4444', icon: 'account_balance_wallet', sub: liquidity >= 0 ? 'เงินสดระบบบวก' : 'เงินสดระบบติดลบ' }
      ];

      if (kpiContainer) {
        kpiContainer.innerHTML = kpis.map((k, i) => `
          <div class="dash-v3-card anim-child delay-${i+1}" style="--card-accent: ${k.color}; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
              <span style="font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">${k.label}</span>
              <div style="width: 32px; height: 32px; border-radius: 10px; background: color-mix(in srgb, ${k.color} 15%, transparent); display:flex; align-items:center; justify-content:center; color:${k.color}">
                <i class="material-icons-round" style="font-size:18px;">${k.icon}</i>
              </div>
            </div>
            <div style="font-size: 26px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; letter-spacing: -0.5px;">
              ${k.val < 0 ? '−' : ''}฿${formatNum(Math.abs(Math.round(k.val)))}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: var(--text-tertiary);">${k.sub}</div>
          </div>
        `).join('');
      }

      // ─── RENDER P&L ────────────────────────────────────────────────
      if (plBody) {
        plBody.innerHTML = `
          <div class="dash-v3-row" style="background: color-mix(in srgb, #10b981 5%, transparent);">
            <div>
              <div class="pl-line-item" style="color:#10b981;">ยอดขายหน้าร้าน (บิลสด)</div>
            </div>
            <div class="pl-line-val" style="color:#10b981;">฿${formatNum(Math.round(sumPaidBills))}</div>
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
            <div class="pl-line-item">รายจ่ายรวม (ร้าน + โครงการ)</div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumExpenses))}</div>
          </div>
          <div class="dash-v3-row">
            <div class="pl-line-item">เบิกเงินล่วงหน้าพนักงาน</div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumAdvances))}</div>
          </div>
          <div class="dash-v3-row">
            <div class="pl-line-item">เงินเดือน/ค่าแรงพนักงาน (ค้างจ่าย/รับจริง)</div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumSalariesAccrued))}</div>
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
              <div style="font-size:11px; color:#10b981; margin-top:2px;">ยอดขาย + เก็บหนี้</div>
            </div>
            <div class="pl-line-val" style="color:#10b981; font-size: 18px;">+฿${formatNum(Math.round(actualRevenue))}</div>
          </div>
          
          <div class="pl-group-header">กระแสเงินสดจ่ายออก (CASH OUT)</div>
          <div class="dash-v3-row">
            <div class="pl-line-item">ซื้อรอบการซื้อ / ซื้อสต็อกสินค้า</div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumPurchases))}</div>
          </div>
          <div class="dash-v3-row">
            <div class="pl-line-item">เบิกเงินล่วงหน้า / จ่ายค่าจ้างร้าน / จิปาถะ</div>
            <div class="pl-line-val" style="color:#ef4444;">-฿${formatNum(Math.round(sumExpenses + sumAdvances))}</div>
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
        const daySales = actualPaidBills.filter(b => isSameLocalDay(b.date, dStr)).reduce((s, b) => s + parseFloat(b.total||0), 0);
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
