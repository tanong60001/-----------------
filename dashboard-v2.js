/**
 * SK POS — dashboard-v2.js
 * แก้ไข loadDashboardData:
 *  - รายการในบิล ไม่มี created_at → join ผ่าน บิลขาย แทน
 *  - เพิ่ม totalCost ที่ถูกต้องจาก billItems ของบิลในช่วงเวลา
 */

window.renderDashboard = async function() {
  const section = document.getElementById('page-dash');
  if (!section) return;
  section.innerHTML = `
    <div style="padding-bottom:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin-bottom:2px;">Dashboard — ภาพรวมร้าน</h2>
          <div style="font-size:12px;color:var(--text-tertiary);">วิเคราะห์ยอดขาย กำไร และสถานะธุรกิจ</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="dash-period" class="form-input" style="width:140px;font-size:13px;" onchange="renderDashboard()">
            <option value="7">7 วันที่ผ่านมา</option>
            <option value="14">14 วัน</option>
            <option value="30" selected>30 วัน</option>
            <option value="90">90 วัน</option>
          </select>
          <button class="btn btn-outline btn-sm" onclick="renderDashboard()"><i class="material-icons-round">refresh</i></button>
        </div>
      </div>
      <div id="dash-loading" style="text-align:center;padding:60px;color:var(--text-tertiary);">
        <i class="material-icons-round" style="font-size:36px;display:block;margin-bottom:12px;opacity:.4;">analytics</i>
        กำลังโหลดข้อมูล...
      </div>
      <div id="dash-content" style="display:none;"></div>
    </div>`;
  await loadDashboardData();
};

async function loadDashboardData() {
  try {
    const days  = Number(document.getElementById('dash-period')?.value || 30);
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // ── Parallel fetches ──────────────────────────────────────────
    const [
      { data: bills },
      { data: todayBills },
      { data: expenses },
      { data: products_ },
      { data: customers },
      { data: payables },
      { data: cashSess }
    ] = await Promise.all([
      db.from('บิลขาย').select('id,total,date,method,discount,status').gte('date', since + 'T00:00:00').eq('status', 'สำเร็จ'),
      db.from('บิลขาย').select('id,total').gte('date', today + 'T00:00:00').eq('status', 'สำเร็จ'),
      db.from('รายจ่าย').select('amount,date,category').gte('date', since + 'T00:00:00'),
      db.from('สินค้า').select('name,stock,min_stock,cost,price,category'),
      db.from('customer').select('name,debt_amount').gt('debt_amount', 0),
      db.from('เจ้าหนี้').select('amount,balance,due_date,status').eq('status', 'ค้างชำระ'),
      db.from('cash_session').select('*').eq('status', 'open').limit(1)
    ]);

    // ── ดึง รายการในบิล โดย join ผ่าน bill_id (ไม่ใช้ created_at) ──
    const billIds = (bills || []).map(b => b.id);
    let billItems = [];
    if (billIds.length > 0) {
      // Supabase in() รองรับสูงสุด ~1000 IDs; แบ่ง chunk ถ้าจำเป็น
      const chunks = [];
      for (let i = 0; i < billIds.length; i += 500) chunks.push(billIds.slice(i, i + 500));
      const results = await Promise.all(
        chunks.map(chunk => db.from('รายการในบิล').select('bill_id,name,qty,price,cost').in('bill_id', chunk))
      );
      billItems = results.flatMap(r => r.data || []);
    }

    // ── Metrics ───────────────────────────────────────────────────
    const totalSales    = (bills || []).reduce((s, b) => s + b.total, 0);
    const totalDiscount = (bills || []).reduce((s, b) => s + (b.discount || 0), 0);
    const totalExp      = (expenses || []).reduce((s, e) => s + e.amount, 0);
    const todaySales    = (todayBills || []).reduce((s, b) => s + b.total, 0);
    // ✅ cost ถูกต้อง: คำนวณจาก billItems ที่ join ผ่าน bill_id จริงๆ
    const totalCost     = billItems.reduce((s, i) => s + (i.cost || 0) * (i.qty || 1), 0);
    const grossProfit   = totalSales - totalCost;
    const grossMargin   = totalSales > 0 ? Math.round(grossProfit / totalSales * 100) : 0;
    const netProfit     = grossProfit - totalExp;
    const totalDebt     = (customers || []).reduce((s, c) => s + c.debt_amount, 0);
    const totalPayable  = (payables || []).reduce((s, p) => s + p.balance, 0);
    const overduePayable = (payables || []).filter(p => p.due_date && new Date(p.due_date) < new Date()).reduce((s, p) => s + p.balance, 0);
    const stockValue    = (products_ || []).reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0);
    const lowStock      = (products_ || []).filter(p => p.stock <= (p.min_stock || 0) && p.stock > 0);
    const outStock      = (products_ || []).filter(p => p.stock <= 0);
    const cashBalance   = await getLiveCashBalance();
    const avgBillValue  = (bills || []).length > 0 ? Math.round(totalSales / (bills || []).length) : 0;

    // ── Sales by day ──────────────────────────────────────────────
    const byDay = {};
    (bills || []).forEach(b => { const d = b.date.split('T')[0]; byDay[d] = (byDay[d] || 0) + b.total; });
    const dayLabels = [], daySales = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      dayLabels.push(new Date(d).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' }));
      daySales.push(byDay[d] || 0);
    }
    const maxSale = Math.max(...daySales, 1);

    // ── Top products ──────────────────────────────────────────────
    const prodMap = {};
    billItems.forEach(i => {
      prodMap[i.name] = prodMap[i.name] || { qty: 0, rev: 0, profit: 0 };
      prodMap[i.name].qty    += i.qty;
      prodMap[i.name].rev    += i.qty * i.price;
      prodMap[i.name].profit += i.qty * (i.price - (i.cost || 0));
    });
    const topProds = Object.entries(prodMap).sort((a, b) => b[1].rev - a[1].rev).slice(0, 6);
    const maxRev   = topProds.length > 0 ? topProds[0][1].rev : 1;

    // ── Expense by category ───────────────────────────────────────
    const expByCat = {};
    (expenses || []).forEach(e => { expByCat[e.category || 'ทั่วไป'] = (expByCat[e.category || 'ทั่วไป'] || 0) + e.amount; });
    const topExp = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // ── Payment method ────────────────────────────────────────────
    const methodMap = {};
    (bills || []).forEach(b => { methodMap[b.method] = (methodMap[b.method] || 0) + b.total; });
    const methodTotal = Object.values(methodMap).reduce((s, v) => s + v, 0) || 1;

    const content = document.getElementById('dash-content');
    const loading = document.getElementById('dash-loading');
    if (loading) loading.style.display = 'none';
    if (content) {
      content.style.display = 'block';
      content.innerHTML = buildDashHTML({
        totalSales, todaySales, grossProfit, grossMargin, netProfit, totalExp, totalCost,
        totalDebt, totalPayable, overduePayable, stockValue, cashBalance,
        avgBillValue, billCount: (bills || []).length,
        dayLabels, daySales, maxSale, days,
        topProds, maxRev, topExp, methodMap, methodTotal,
        lowStock, outStock, customers, payables
      });
    }
  } catch (e) { console.error('Dashboard error:', e); toast('โหลด Dashboard ล้มเหลว', 'error'); }
}

function buildDashHTML(d) {
  const kpis = [
    {label:`ยอดขาย ${d.days} วัน`,  value:`฿${formatNum(d.totalSales)}`,  sub:`${d.billCount} บิล | เฉลี่ย ฿${formatNum(d.avgBillValue)}/บิล`, color:'var(--primary)',   icon:'point_of_sale'},
    {label:'วันนี้',                  value:`฿${formatNum(d.todaySales)}`,  sub:'ยอดขายวันนี้',    color:'var(--success)',  icon:'today'},
    {label:'กำไรขั้นต้น',            value:`฿${formatNum(d.grossProfit)}`, sub:`Margin ${d.grossMargin}%`, color:d.grossMargin>=20?'var(--success)':'var(--warning)', icon:'trending_up'},
    {label:'กำไรสุทธิ',              value:`฿${formatNum(d.netProfit)}`,   sub:`หักรายจ่าย ฿${formatNum(d.totalExp)}`, color:d.netProfit>=0?'var(--success)':'var(--danger)', icon:'account_balance_wallet'},
    {label:'เงินในลิ้นชัก',          value:`฿${formatNum(d.cashBalance)}`, sub:'ยอดปัจจุบัน',     color:'var(--info)',    icon:'local_atm'},
    {label:'มูลค่าสต็อก',            value:`฿${formatNum(d.stockValue)}`,  sub:`ต่ำกว่าขั้นต่ำ ${d.lowStock.length} | หมด ${d.outStock.length}`, color:d.outStock.length>0?'var(--danger)':d.lowStock.length>0?'var(--warning)':'var(--text-primary)', icon:'inventory_2'},
    {label:'ลูกหนี้คงค้าง',          value:`฿${formatNum(d.totalDebt)}`,   sub:`${d.customers?.length||0} ราย`, color:d.totalDebt>50000?'var(--danger)':'var(--warning)', icon:'person_remove'},
    {label:'เจ้าหนี้คงค้าง',         value:`฿${formatNum(d.totalPayable)}`,sub:`เกินกำหนด ฿${formatNum(d.overduePayable)}`, color:d.overduePayable>0?'var(--danger)':'var(--text-primary)', icon:'business'},
  ];

  const kpiHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:20px;">
    ${kpis.map(k=>`
      <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:14px;border-left:3px solid ${k.color};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-size:11px;color:var(--text-secondary);font-weight:500;">${k.label}</div>
          <i class="material-icons-round" style="font-size:18px;color:${k.color};opacity:.6">${k.icon}</i>
        </div>
        <div style="font-size:20px;font-weight:700;color:${k.color};margin-bottom:3px;">${k.value}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">${k.sub}</div>
      </div>`).join('')}
  </div>`;

  // Bar chart (CSS only)
  const barChart = `
    <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px;">
      <h4 style="font-size:13px;font-weight:600;margin-bottom:14px;color:var(--text-secondary);">ยอดขายรายวัน ${d.days} วัน</h4>
      <div style="display:flex;align-items:flex-end;gap:4px;height:120px;">
        ${d.daySales.map((v,i)=>{
          const h = Math.round((v/d.maxSale)*100);
          const isToday = i===d.daySales.length-1;
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
            <div style="font-size:9px;color:var(--text-tertiary);white-space:nowrap;">${v>0?'฿'+formatNum(v):''}</div>
            <div style="width:100%;background:${isToday?'var(--primary)':'var(--primary-50)'};border-radius:3px 3px 0 0;height:${Math.max(h,2)}%;min-height:${v>0?'4px':'2px'};transition:height .3s;"></div>
            <div style="font-size:9px;color:var(--text-tertiary);text-align:center;white-space:nowrap;overflow:hidden;max-width:100%;">${d.dayLabels[i]}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // Top products
  const topProdsHTML = `
    <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:16px;">
      <h4 style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">สินค้าขายดี (รายได้)</h4>
      ${d.topProds.map(([name,v],i)=>`
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
            <span style="color:var(--text-primary);font-weight:${i===0?'700':'400'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;">${name}</span>
            <span style="color:var(--primary);font-weight:600;flex-shrink:0;">฿${formatNum(v.rev)}</span>
          </div>
          <div style="height:5px;background:var(--bg-hover);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${Math.round(v.rev/d.maxRev*100)}%;background:var(--primary);border-radius:3px;"></div>
          </div>
        </div>`).join('')}
      ${d.topProds.length===0?'<p style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:13px;">ยังไม่มีข้อมูล</p>':''}
    </div>`;

  // Payment method pie
  const methodColors={'เงินสด':'var(--success)','โอนเงิน':'var(--info)','บัตรเครดิต':'var(--primary)','ติดหนี้':'var(--danger)'};
  const methodHTML = `
    <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:16px;">
      <h4 style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">วิธีชำระเงิน</h4>
      ${Object.entries(d.methodMap).map(([m,v])=>`
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
            <span>${m}</span>
            <span style="font-weight:600;">${Math.round(v/d.methodTotal*100)}% (฿${formatNum(v)})</span>
          </div>
          <div style="height:8px;background:var(--bg-hover);border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${Math.round(v/d.methodTotal*100)}%;background:${methodColors[m]||'var(--primary)'};border-radius:4px;"></div>
          </div>
        </div>`).join('')}
      ${Object.keys(d.methodMap).length===0?'<p style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:13px;">ยังไม่มีข้อมูล</p>':''}
    </div>`;

  // Expenses by category
  const expHTML = `
    <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:16px;">
      <h4 style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">รายจ่ายตามหมวดหมู่</h4>
      ${d.topExp.map(([cat,v])=>`
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--border-light);font-size:12px;">
          <span>${cat}</span><strong style="color:var(--danger)">฿${formatNum(v)}</strong>
        </div>`).join('')}
      ${d.topExp.length===0?'<p style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:13px;">ยังไม่มีข้อมูล</p>':''}
    </div>`;

  // Low stock alerts
  const alertsHTML = `
    <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:16px;">
      <h4 style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">
        <i class="material-icons-round" style="font-size:16px;vertical-align:middle;color:var(--danger);margin-right:4px;">warning</i>
        สินค้าต้องสั่งด่วน
      </h4>
      ${[...d.outStock.slice(0,3),...d.lowStock.slice(0,4)].map(p=>`
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--border-light);font-size:12px;align-items:center;">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;">${p.name}</span>
          <span class="badge ${p.stock<=0?'badge-danger':'badge-warning'}">${p.stock<=0?'หมด':'เหลือ '+formatNum(p.stock)}</span>
        </div>`).join('')}
      ${d.outStock.length+d.lowStock.length===0?'<p style="text-align:center;color:var(--success);padding:20px;font-size:13px;">✓ สต็อกปกติทุกรายการ</p>':''}
    </div>`;

  // Overdue payables
  const payableHTML = `
    <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:16px;">
      <h4 style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">
        <i class="material-icons-round" style="font-size:16px;vertical-align:middle;color:var(--warning);margin-right:4px;">schedule</i>
        เจ้าหนี้ใกล้ครบกำหนด
      </h4>
      ${(d.payables||[]).slice(0,5).map(p=>`
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--border-light);font-size:12px;align-items:center;">
          <div>
            <div style="font-weight:500;">฿${formatNum(p.balance)}</div>
            <div style="font-size:10px;color:var(--text-tertiary);">${p.due_date?`ครบ ${formatDate(p.due_date)}`:'-'}</div>
          </div>
          <span class="badge ${p.due_date&&new Date(p.due_date)<new Date()?'badge-danger':'badge-warning'}">
            ${p.due_date&&new Date(p.due_date)<new Date()?'เกินกำหนด':'ค้างชำระ'}
          </span>
        </div>`).join('')}
      ${(d.payables||[]).length===0?'<p style="text-align:center;color:var(--success);padding:20px;font-size:13px;">✓ ไม่มียอดค้างชำระ</p>':''}
    </div>`;

  return `
    ${kpiHTML}
    ${barChart}
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px;">
      ${topProdsHTML}
      ${methodHTML}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
      ${expHTML}
      ${alertsHTML}
      ${payableHTML}
    </div>`;
}
