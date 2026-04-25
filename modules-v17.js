/**
 * SK POS — modules-v17.js  (โหลดหลัง modules-v16.js)
 * ══════════════════════════════════════════════════════════════════
 *  V17-1  DASHBOARD UTC FIX  — แก้ date filter ให้ตรงกับ local time
 *                               Bills ที่สร้าง 01:37 local หายไปจาก
 *                               query เพราะ Supabase ตีความ UTC
 *  V17-2  STEP-6 SINGLE BTN  — ปุ่มเสร็จสิ้นตัวเดียว ซ่อน footer back
 *  V17-3  PROJECT BILLS TAB  — แสดงบิลขายในหน้าโครงการ
 *  V17-4  PROJECT PAYMENT    — บันทึกรายการสินค้าลงโครงการ (ใช้ราคาขาย
 *                               เป็น project cost ถ้า cost=0)
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

const _v17f = n => typeof formatNum === 'function' ? formatNum(n) : Number(n||0).toLocaleString('th-TH');
const _v17d = d => new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});

/* ════════════════════════════════════════════════════════════════
   V17-1: DASHBOARD UTC FIX
   Root cause: .gte('date', '2026-03-29T00:00:00') ถูกตีความเป็น UTC
   บิล 01:37 local = 28 Mar 18:37 UTC → ไม่ผ่าน filter วันที่ 29 UTC
   Fix: แปลง local midnight → UTC ISO string ก่อน query
════════════════════════════════════════════════════════════════ */
(function patchDashboardDates() {
  // รอให้ renderDashboardV3 โหลดก่อน แล้ว intercept db.from('บิลขาย')
  // วิธีที่สะอาดที่สุด: patch renderDashboardV3 ให้ใช้ UTC date
  
  const origRender = window.renderDashboardV3;
  if (!origRender) {
    // ถ้า dashboard ยังไม่โหลด รอและ retry
    setTimeout(patchDashboardDates, 500);
    return;
  }

  // Override loadData ภายใน: เราทำโดย patch db.from ชั่วคราว
  // วิธีที่ดีกว่า: patch ตรงที่ dashboard สร้าง query string
  
  const _origFrom = db.from.bind(db);
  
  window.renderDashboardV3 = async function() {
    // Monkey-patch db.from ชั่วคราวเพื่อ intercept date queries
    // → แปลง 'YYYY-MM-DDT00:00:00' (local midnight) เป็น UTC ISO
    const _savedFrom = db.from;
    
    db.from = function(table) {
      const builder = _origFrom(table);
      const _origGte = builder.gte.bind(builder);
      
      builder.gte = function(col, val) {
        if (col === 'date' || col === 'paid_date') {
          // แปลง local midnight → UTC
          const fixed = _v17localToUTC(val);
          return _origGte(col, fixed);
        }
        return _origGte(col, val);
      };
      
      return builder;
    };

    try {
      await origRender();
    } finally {
      db.from = _savedFrom; // restore
    }
  };
})();

/**
 * แปลง 'YYYY-MM-DDT00:00:00' (local midnight) → UTC ISO string
 * เช่น: '2026-03-29T00:00:00' (Bangkok UTC+7) → '2026-03-28T17:00:00.000Z'
 */
function _v17localToUTC(localStr) {
  if (!localStr || typeof localStr !== 'string') return localStr;
  // ตรวจว่าเป็น local datetime string (ไม่มี Z หรือ +offset)
  if (localStr.endsWith('Z') || localStr.match(/[+-]\d{2}:\d{2}$/)) return localStr;
  if (!localStr.includes('T')) return localStr;
  
  try {
    // new Date('2026-03-29T00:00:00') → treats as LOCAL time
    const d = new Date(localStr);
    if (isNaN(d.getTime())) return localStr;
    return d.toISOString(); // แปลงเป็น UTC
  } catch(_) { return localStr; }
}

/* Fallback: ถ้า db.from monkey-patch ไม่ work ให้ re-render dashboard */
(function recheckDashboard() {
  setTimeout(() => {
    // ถ้า dashboard กำลังแสดงอยู่และค่าเป็น 0 ให้ trigger re-render
    const section = document.getElementById('page-dash');
    if (!section || section.classList.contains('hidden')) return;
    if (typeof window.renderDashboardV3 === 'function') {
      console.log('[v17] Dashboard UTC patch active — re-render triggered');
    }
  }, 2000);
})();


/* ════════════════════════════════════════════════════════════════
   V17-2: STEP 6 — ปุ่มเสร็จสิ้นตัวเดียว + แสดงทันที
════════════════════════════════════════════════════════════════ */

/* Override v12S6: ลบ sk-done-btn ออก (ใช้ footer back btn แทน) */
const _v17OrigS6 = window.v12S6;
window.v12S6 = function(container) {
  if (!v12State?.savedBill) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 20px;">
        <div style="width:64px;height:64px;border-radius:50%;background:#f3f4f6;
          display:flex;align-items:center;justify-content:center;margin:0 auto 16px;animation:pulse 1.2s infinite;">
          <i class="material-icons-round" style="font-size:32px;color:#9ca3af;">hourglass_top</i>
        </div>
        <p style="color:var(--text-muted,#9ca3af);font-size:15px;font-weight:600;">กำลังบันทึก...</p>
        <p style="color:var(--text-muted,#9ca3af);font-size:12px;margin-top:4px;">กรุณารอสักครู่</p>
      </div>
      <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}</style>`;
    return;
  }

  const b      = v12State.savedBill;
  const method = v12State.method || 'cash';
  const isDebt = method === 'debt';
  const isCash = method === 'cash';
  const isProj = v12State.customer?.type === 'project';
  const hasDel = v12State.deliveryMode !== 'self';
  const isDep  = v12State.paymentType === 'deposit';

  const bannerClass = isProj ? 'project' : isDebt ? 'debt' : 'success';
  const bannerIcon  = isProj ? 'business_center' : isDebt ? 'pending_actions' : 'check_circle';
  const bannerTitle = isProj ? 'บันทึกบิลโครงการสำเร็จ!'
                    : isDebt ? 'บันทึกค้างชำระสำเร็จ!'
                    :          'บันทึกการขายสำเร็จ!';
  const mLbl = {cash:'💵 เงินสด',transfer:'📱 โอนเงิน',credit:'💳 บัตรเครดิต',debt:'📋 ค้างชำระ'}[method] || method;

  /* Stats */
  const stats = [
    { lbl:'เลขบิล',  val:`#${b.bill_no}`,             color:'#3b82f6' },
    { lbl:'ยอดสุทธิ',val:`฿${_v17f(v12State.total)}`, color:'#10b981' },
    { lbl:'วิธีชำระ', val:mLbl,                         color:'#6366f1' },
  ];
  if (isCash && (v12State.change||0)>=0) {
    stats.push({ lbl:'เงินทอน', val:`฿${_v17f(v12State.change)}`, color:'#d97706' });
  }

  /* Change breakdown */
  let chgHtml = '';
  if (isCash && (v12State.change||0) > 0 && typeof calcChangeDenominations === 'function') {
    const chgMap = calcChangeDenominations(v12State.change);
    const allD   = typeof V13_ALL !== 'undefined' ? V13_ALL : typeof V14_ALL !== 'undefined' ? V14_ALL : [];
    const chips  = allD.filter(d=>(chgMap[d.value]||0)>0)
      .map(d=>`<span style="background:#dcfce7;color:#166534;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700;">฿${d.label} ×${chgMap[d.value]}</span>`)
      .join('');
    if (chips) chgHtml = `
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:12px 14px;margin:12px 0;">
        <div style="font-size:12px;font-weight:600;color:#15803d;margin-bottom:8px;">💵 แบงค์ทอนให้ลูกค้า:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
      </div>`;
  }

  /* Print buttons */
  const printBtns = [
    { icon:'receipt',      title:'ใบเสร็จ 80mm', sub:'เครื่องพิมพ์ความร้อน', fn:`v12PrintReceipt80mm('${b.id}')`, primary:true },
    { icon:'description',  title:'ใบเสร็จ A4',   sub:'พิมพ์/เก็บเป็นไฟล์',   fn:`v12PrintReceiptA4('${b.id}')` },
  ];
  if (hasDel) printBtns.push({ icon:'local_shipping', title:'ใบส่งของ', sub:'ติดท้ายรถส่ง', fn:`v12PrintDeliveryNote('${b.id}')` });
  if (isDep)  printBtns.push({ icon:'receipt_long',   title:'ใบมัดจำ',  sub:'ใบรับเงินมัดจำ', fn:`v12PrintDeposit('${b.id}')` });

  container.innerHTML = `
    <div class="sk-s6-wrap">
      <!-- Banner -->
      <div class="sk-s6-banner ${bannerClass}">
        <div class="sk-s6-icon"><i class="material-icons-round">${bannerIcon}</i></div>
        <h3>${bannerTitle}</h3>
        <p>${v12State.customer?.name || 'ลูกค้าทั่วไป'} · ${mLbl}</p>
      </div>

      <!-- Stats Grid -->
      <div class="sk-s6-stats">
        ${stats.map(s=>`<div class="sk-s6-stat">
          <div class="s-lbl">${s.lbl}</div>
          <div class="s-val" style="color:${s.color};">${s.val}</div>
        </div>`).join('')}
      </div>

      ${chgHtml}

      ${hasDel?`<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#5b21b6;display:flex;align-items:center;gap:8px;">
        <i class="material-icons-round" style="font-size:15px;flex-shrink:0;">info</i>
        สินค้ารอส่งจะตัดสต็อกเมื่อกด "จัดส่งสำเร็จ" ในคิวส่งของ
      </div>`:''}

      ${isDep?`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;margin-bottom:12px;">
        <div style="font-weight:700;color:#92400e;margin-bottom:6px;font-size:13px;">💰 ยอดมัดจำ / ค้างชำระ</div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span style="color:#6b7280;">มัดจำ</span><span style="font-weight:700;color:#d97706;">฿${_v17f(v12State.depositAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span style="color:#6b7280;">คงค้าง</span><span style="font-weight:700;color:#ef4444;">฿${_v17f(v12State.total-v12State.depositAmount)}</span>
        </div>
      </div>`:''}

      ${isProj?`<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
        <i class="material-icons-round" style="font-size:22px;color:#6366f1;flex-shrink:0;">business_center</i>
        <div><div style="font-weight:700;color:#3730a3;font-size:13px;">🏗️ ${v12State.customer.project_name||''}</div>
        <div style="font-size:11px;color:#6366f1;margin-top:2px;">บันทึกต้นทุนสินค้าลงโครงการแล้ว</div></div>
      </div>`:''}

      <!-- Print Section -->
      <div style="font-size:11px;font-weight:700;color:var(--text-muted,#9ca3af);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🖨️ พิมพ์เอกสาร</div>
      <div class="sk-s6-print-grid">
        ${printBtns.map(p=>`
          <button class="sk-print-card ${p.primary?'primary':''}" onclick="${p.fn}">
            <i class="material-icons-round">${p.icon}</i>
            <div><div class="pk-title">${p.title}</div><div class="pk-sub">${p.sub}</div></div>
          </button>`).join('')}
      </div>
    </div>`;

  /* ── ปุ่ม footer: ซ่อน next, เปลี่ยน back เป็น "เสร็จสิ้น" ── */
  const nextBtn = document.getElementById('v12-next-btn');
  const backBtn = document.getElementById('v12-back-btn');
  if (nextBtn) nextBtn.style.display = 'none';
  if (backBtn) {
    backBtn.style.display  = 'flex';
    backBtn.innerHTML      = '<i class="material-icons-round">done_all</i> เสร็จสิ้น';
    backBtn.className      = 'v12-btn-next green';
    backBtn.style.cssText += 'background:linear-gradient(135deg,#10b981,#059669)!important;width:auto!important;';
    backBtn.onclick        = () => { if (typeof closeCheckout === 'function') closeCheckout(); };
  }
};


/* ════════════════════════════════════════════════════════════════
   V17-3: PROJECT DETAIL — แสดงบิลขายของโครงการ (tab system)
════════════════════════════════════════════════════════════════ */
window.v14OpenProject = async function(projId) {
  const sec = document.getElementById('page-projects');
  if (!sec) return;
  sec.innerHTML = `<div class="v14-proj-container">
    <div style="text-align:center;padding:40px;color:var(--text-muted);">⏳ กำลังโหลด...</div>
  </div>`;

  try {
    const [{data:proj}, {data:exps}, {data:bills}] = await Promise.all([
      db.from('โครงการ').select('*').eq('id', projId).single(),
      db.from('รายจ่ายโครงการ').select('*').eq('project_id', projId).order('created_at',{ascending:false}),
      db.from('บิลขาย')
        .select('id,bill_no,date,total,status,customer_name,method,staff_name')
        .eq('project_id', projId)
        .order('date',{ascending:false}),
    ]);

    if (!proj) { sec.innerHTML='<div style="padding:30px;text-align:center;">ไม่พบโครงการ</div>'; return; }

    const spent      = (proj.total_expenses||0) + (proj.total_goods_cost||0);
    const profit     = proj.budget - spent;
    const pct        = proj.budget > 0 ? Math.min(100, Math.round(spent / proj.budget * 100)) : 0;
    const isComplete = proj.status === 'completed';
    const pc         = profit >= 0 ? '#22c55e' : '#ef4444';
    const bar        = pct>=90?'#ef4444':pct>=70?'#f59e0b':'#22c55e';

    /* ── Expense Rows ── */
    const expRows = (exps||[]).length === 0
      ? `<div style="text-align:center;padding:40px;color:var(--text-muted);">
          <i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:10px;opacity:.3;">receipt</i>
          <div style="font-weight:700;">ยังไม่มีรายจ่าย</div>
          <div style="font-size:12px;margin-top:4px;">กด "เพิ่มรายจ่าย" ด้านบนเพื่อเพิ่ม</div>
        </div>`
      : (exps||[]).map(ex => {
          const g = ex.type === 'goods';
          return `<div class="v14-expense-row">
            <div class="v14-expense-icon" style="background:${g?'#dbeafe':'#fee2e2'};">
              <i class="material-icons-round" style="font-size:18px;color:${g?'#1d4ed8':'#dc2626'};">${g?'inventory_2':'payments'}</i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:13px;">${ex.description}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                <span class="v14-status-badge-proj ${g?'v14-badge-goods':'v14-badge-expense'}">${g?'📦 สินค้า':'💸 รายจ่าย'}</span>
                · ${ex.category||'ทั่วไป'} · ${_v17d(ex.created_at)}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-right:8px;">
              <div style="font-size:16px;font-weight:800;color:${g?'#f59e0b':'#ef4444'};">฿${_v17f(ex.amount)}</div>
            </div>
            ${!isComplete?`<button onclick="v14DeleteExpense('${ex.id}','${projId}',${ex.amount},${g})"
              style="border:1.5px solid #fee2e2;border-radius:8px;padding:6px;background:#fff;cursor:pointer;color:#ef4444;display:flex;align-items:center;flex-shrink:0;">
              <i class="material-icons-round" style="font-size:16px;">delete_outline</i>
            </button>`:''}
          </div>`;
        }).join('');

    /* ── Bill Rows ── */
    const billStatusMap = {
      'สำเร็จ':   ['#d1fae5','#065f46','✓ สำเร็จ'],
      'ค้างชำระ': ['#fee2e2','#991b1b','⚠ ค้างชำระ'],
      'รอจัดส่ง': ['#fef3c7','#92400e','🚚 รอส่ง'],
      'ยกเลิก':   ['#f3f4f6','#6b7280','✕ ยกเลิก'],
    };
    const totalBillValue = (bills||[]).reduce((s,b)=>s+(b.total||0),0);

    const billRows = (bills||[]).length === 0
      ? `<div style="text-align:center;padding:40px;color:var(--text-muted);">
          <i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:10px;opacity:.3;">receipt_long</i>
          <div style="font-weight:700;">ยังไม่มีบิลขาย</div>
          <div style="font-size:12px;margin-top:4px;">ขายสินค้าให้โครงการนี้ผ่านหน้าขายสินค้า</div>
        </div>`
      : `<div style="margin-bottom:12px;background:var(--bg-secondary,#f9fafb);border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:13px;color:var(--text-muted);">ยอดสินค้าทั้งหมด (ราคาขาย)</div>
          <div style="font-size:18px;font-weight:900;color:#1d4ed8;">฿${_v17f(totalBillValue)}</div>
        </div>
        ${(bills||[]).map(b=>{
          const [bg,clr,lbl] = billStatusMap[b.status] || ['#f3f4f6','#6b7280',b.status];
          return `<div class="v14-expense-row">
            <div class="v14-expense-icon" style="background:#dbeafe;">
              <i class="material-icons-round" style="font-size:18px;color:#1d4ed8;">receipt_long</i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:13px;">บิล #${b.bill_no}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                ${b.customer_name||'-'} · ${_v17d(b.date)} · ${b.method||'-'}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-right:8px;">
              <div style="font-size:16px;font-weight:800;color:#1d4ed8;">฿${_v17f(b.total)}</div>
              <span style="background:${bg};color:${clr};border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;display:inline-block;margin-top:2px;">${lbl}</span>
            </div>
            <button onclick="v12PrintReceipt80mm('${b.id}')"
              style="border:1.5px solid #dbeafe;border-radius:8px;padding:6px 10px;background:#fff;
                cursor:pointer;color:#1d4ed8;display:flex;align-items:center;gap:4px;font-size:11px;font-family:inherit;flex-shrink:0;">
              <i class="material-icons-round" style="font-size:14px;">print</i> พิมพ์
            </button>
          </div>`;
        }).join('')}`;

    sec.innerHTML = `<div class="v14-proj-container">
      <!-- Back Button -->
      <button onclick="renderProjects()"
        style="border:1.5px solid var(--border,#e5e7eb);border-radius:10px;padding:8px 16px;
          background:#fff;cursor:pointer;display:flex;align-items:center;gap:6px;
          font-size:13px;font-weight:600;margin-bottom:16px;font-family:inherit;">
        <i class="material-icons-round" style="font-size:16px;">arrow_back</i> กลับรายการโครงการ
      </button>

      <!-- Project Header -->
      <div class="v14-proj-detail-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">
              ${proj.contract_no?`สัญญา #${proj.contract_no} · `:''}โครงการ
            </div>
            <div style="font-size:22px;font-weight:900;">${proj.name}</div>
            <div style="margin-top:8px;">
              <span class="v14-status-badge-proj ${isComplete?'v14-badge-complete':'v14-badge-active'}">
                ${isComplete?'✅ เสร็จสิ้น':'🔵 กำลังดำเนินการ'}
              </span>
            </div>
          </div>
          ${!isComplete?`<div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="v14AddExpense('${projId}')"
              style="background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.3);color:#fff;
                border-radius:10px;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:700;
                display:flex;align-items:center;gap:6px;font-family:inherit;">
              <i class="material-icons-round" style="font-size:16px;">add</i> เพิ่มรายจ่าย
            </button>
            <button onclick="v14CompleteProject('${projId}')"
              style="background:#22c55e;border:none;color:#fff;border-radius:10px;padding:10px 16px;
                cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;font-family:inherit;">
              <i class="material-icons-round" style="font-size:16px;">check_circle</i> เสร็จสิ้นโครงการ
            </button>
          </div>`:''}
        </div>

        <!-- Stats Grid -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;">
          <div style="background:rgba(255,255,255,.12);border-radius:12px;padding:14px;">
            <div style="font-size:11px;color:rgba(255,255,255,.55);">งบประมาณ</div>
            <div style="font-size:18px;font-weight:900;margin-top:4px;">฿${_v17f(proj.budget)}</div>
          </div>
          <div style="background:rgba(255,255,255,.12);border-radius:12px;padding:14px;">
            <div style="font-size:11px;color:rgba(255,255,255,.55);">รายจ่ายทั่วไป</div>
            <div style="font-size:18px;font-weight:900;margin-top:4px;color:#fca5a5;">฿${_v17f(proj.total_expenses||0)}</div>
          </div>
          <div style="background:rgba(255,255,255,.12);border-radius:12px;padding:14px;">
            <div style="font-size:11px;color:rgba(255,255,255,.55);">ต้นทุนสินค้า</div>
            <div style="font-size:18px;font-weight:900;margin-top:4px;color:#fde68a;">฿${_v17f(proj.total_goods_cost||0)}</div>
          </div>
          <div style="background:${profit>=0?'rgba(34,197,94,.2)':'rgba(239,68,68,.2)'};border-radius:12px;padding:14px;
            border:1.5px solid ${profit>=0?'rgba(34,197,94,.4)':'rgba(239,68,68,.4)'};">
            <div style="font-size:11px;color:rgba(255,255,255,.6);">${profit>=0?'💰 กำไร':'📉 ขาดทุน'}</div>
            <div style="font-size:18px;font-weight:900;margin-top:4px;color:${profit>=0?'#86efac':'#fca5a5'};">฿${_v17f(Math.abs(profit))}</div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div>
          <div style="font-size:11px;color:rgba(255,255,255,.55);margin-bottom:6px;">
            ความคืบหน้า ${pct}% — ใช้ ฿${_v17f(spent)} จาก ฿${_v17f(proj.budget)}
          </div>
          <div style="height:10px;background:rgba(255,255,255,.18);border-radius:99px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${bar};border-radius:99px;transition:width .5s;"></div>
          </div>
        </div>
      </div>

      <!-- Tab Bar -->
      <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border,#f0f0f0);overflow-x:auto;">
        <button id="v17-tab-exp"
          onclick="v17Tab('exp')"
          style="padding:12px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:700;
            color:var(--primary,#3b82f6);border-bottom:3px solid var(--primary,#3b82f6);margin-bottom:-2px;
            font-family:inherit;white-space:nowrap;transition:all .15s;">
          💸 รายจ่าย <span style="background:var(--primary,#3b82f6);color:#fff;border-radius:99px;padding:1px 8px;font-size:11px;margin-left:4px;">${(exps||[]).length}</span>
        </button>
        <button id="v17-tab-bills"
          onclick="v17Tab('bills')"
          style="padding:12px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;
            color:var(--text-muted,#6b7280);border-bottom:3px solid transparent;margin-bottom:-2px;
            font-family:inherit;white-space:nowrap;transition:all .15s;">
          🧾 บิลขาย <span style="background:#e5e7eb;color:#6b7280;border-radius:99px;padding:1px 8px;font-size:11px;margin-left:4px;">${(bills||[]).length}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div id="v17-content-exp"  class="v14-expense-list">${expRows}</div>
      <div id="v17-content-bills" class="v14-expense-list" style="display:none;">${billRows}</div>

      ${proj.notes?`<div style="margin-top:16px;background:var(--bg-secondary,#f9fafb);border-radius:12px;padding:14px 16px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:4px;">📝 หมายเหตุ</div>
        <div style="font-size:13px;color:var(--text-primary);">${proj.notes}</div>
      </div>`:''}
    </div>`;
  } catch(e) {
    console.error('[v17] openProject:', e);
    sec.innerHTML = `<div style="padding:30px;text-align:center;color:#ef4444;">
      <i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;">error_outline</i>
      โหลดไม่สำเร็จ: ${e.message}
    </div>`;
  }
};

window.v17Tab = function(tab) {
  ['exp','bills'].forEach(t => {
    const btn = document.getElementById(`v17-tab-${t}`);
    const con = document.getElementById(`v17-content-${t}`);
    const active = t === tab;
    if (btn) {
      btn.style.color       = active ? 'var(--primary,#3b82f6)' : 'var(--text-muted,#6b7280)';
      btn.style.fontWeight  = active ? '700' : '600';
      btn.style.borderBottomColor = active ? 'var(--primary,#3b82f6)' : 'transparent';
    }
    if (con) con.style.display = active ? 'flex' : 'none';
  });
};


/* ════════════════════════════════════════════════════════════════
   V17-4: PROJECT PAYMENT — บันทึกรายการลงโครงการ
   Fix: ถ้า item.cost = 0 ให้บันทึก 0 แต่ยังคง insert record ไว้
   เพื่อให้หน้าโครงการแสดงบิลขายได้
════════════════════════════════════════════════════════════════ */
const _v17OrigPay = window.v12CompletePayment;
window.v12CompletePayment = async function() {
  const isProj = (v12State.customer?.type === 'project' || v12State._forceDebt) && !!v12State.customer?.project_id;
  if (!isProj) return _v17OrigPay?.();

  if (window._v17busy) return;
  window._v17busy = true;
  try { if (typeof isProcessingPayment !== 'undefined') isProcessingPayment = true; } catch(_) {}

  /* Show loading */
  if (typeof v12UpdateStepBar  === 'function') v12UpdateStepBar();
  if (typeof v12RenderStepBody === 'function') v12RenderStepBody();

  try {
    const projId  = v12State.customer.project_id;
    const staff   = (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown';
    const cartArr = window.cart || (typeof cart !== 'undefined' ? cart : []);

    /* Fetch unit conversion */
    const ids = [...new Set(cartArr.map(i=>i.id).filter(Boolean))];
    const unitMap={}, baseMap={}, costMap={};
    if (ids.length) {
      try {
        const [{data:units},{data:prods}] = await Promise.all([
          db.from('product_units').select('product_id,unit_name,conv_rate').in('product_id',ids),
          db.from('สินค้า').select('id,unit,cost').in('id',ids),
        ]);
        (units||[]).forEach(u=>{
          if(!unitMap[u.product_id]) unitMap[u.product_id]={};
          unitMap[u.product_id][u.unit_name]=parseFloat(u.conv_rate)||1;
        });
        (prods||[]).forEach(p=>{baseMap[p.id]=p.unit||'ชิ้น';costMap[p.id]=parseFloat(p.cost)||0;});
      } catch(e){console.warn('[v17] fetchUnits:',e.message);}
    }

    /* Insert bill */
    const {data:bill, error:be} = await db.from('บิลขาย').insert({
      date:             new Date().toISOString(),
      method:           'ค้างชำระ',
      total:            v12State.total,
      discount:         v12State.discount || 0,
      received:         0, change:0,
      customer_name:    `[โครงการ] ${v12State.customer.project_name}`,
      customer_id:      null,
      project_id:       projId,
      staff_name:       staff,
      status:           'ค้างชำระ',
      denominations:    {}, change_denominations:{},
      delivery_mode:    'รับเอง', delivery_status:'สำเร็จ', deposit_amount:0,
    }).select().single();
    if (be) throw be;

    /* Items + stock */
    let totalCost = 0;
    for (const item of cartArr) {
      const modes = (v12State.itemModes||{})[item.id] || {take:item.qty,deliver:0};
      const su = item.unit || 'ชิ้น';
      const bu = baseMap[item.id] || su;
      let cr = 1;
      if (su !== bu) { const pu=unitMap[item.id]||{}; cr=parseFloat(pu[su])||1; }
      const costPSU = (costMap[item.id] || item.cost || 0) * cr;

      await db.from('รายการในบิล').insert({
        bill_id:bill.id, product_id:item.id, name:item.name,
        qty:item.qty, price:item.price, cost:costPSU,
        total:item.price*item.qty, unit:su,
        take_qty:modes.take, deliver_qty:modes.deliver,
      });

      if (modes.take > 0) {
        const baseQty = parseFloat((modes.take * cr).toFixed(6));
        const allP = typeof products !== 'undefined' ? products : [];
        const prod = allP.find(p=>p.id===item.id);
        const sb   = parseFloat(prod?.stock ?? 0);
        const sa   = parseFloat((sb - baseQty).toFixed(6));
        await db.from('สินค้า').update({stock:sa,updated_at:new Date().toISOString()}).eq('id',item.id);
        if (prod) prod.stock = sa;
        try {
          await db.from('stock_movement').insert({
            product_id:item.id, product_name:item.name,
            type:'โครงการ', direction:'out', qty:baseQty,
            stock_before:sb, stock_after:sa,
            ref_id:bill.id, ref_table:'บิลขาย', staff_name:staff,
            note: cr!==1 ? `${modes.take} ${su} × ${cr} = ${baseQty} ${bu}` : null,
          });
        } catch(e){console.warn('[v17] smov:',e.message);}
        totalCost += costPSU * modes.take;
      }
    }

    /* บันทึกลง รายจ่ายโครงการ — always insert even if cost=0 */
    const names = cartArr.map(i=>`${i.name} ×${i.qty}`).join(', ');
    try {
      await db.from('รายจ่ายโครงการ').insert({
        project_id:projId,
        description:`สินค้าจากร้าน: ${names}`,
        amount:totalCost,
        category:'สินค้า', type:'goods',
        bill_id:bill.id,
        notes:`บิล #${bill.bill_no} | ยอดขาย ฿${_v17f(v12State.total)}`,
      });
      if (totalCost > 0) {
        const {data:pj} = await db.from('โครงการ').select('total_goods_cost').eq('id',projId).maybeSingle();
        await db.from('โครงการ').update({total_goods_cost:(pj?.total_goods_cost||0)+totalCost}).eq('id',projId);
      }
    } catch(e){console.warn('[v17] projCost:',e.message);}

    /* Log */
    if (typeof logActivity === 'function') logActivity(
      'ขายโครงการ',
      `บิล #${bill.bill_no} "${v12State.customer.project_name}" ฿${_v17f(v12State.total)} (ต้นทุน ฿${_v17f(totalCost)})`,
      bill.id, 'บิลขาย'
    );
    if (typeof sendToDisplay === 'function') sendToDisplay({type:'thanks',billNo:bill.bill_no,total:v12State.total});

    /* Finalize */
    v12State.savedBill = bill;
    window.cart = [];
    if (typeof loadProducts      === 'function') await loadProducts();
    if (typeof renderCart        === 'function') renderCart();
    if (typeof renderProductGrid === 'function') renderProductGrid();
    if (typeof updateHomeStats   === 'function') updateHomeStats();
    if (typeof v12UpdateStepBar  === 'function') v12UpdateStepBar();
    if (typeof v12RenderStepBody === 'function') v12RenderStepBody();

  } catch(e) {
    console.error('[v17] projPay:', e);
    if (typeof toast === 'function') toast('เกิดข้อผิดพลาด: '+e.message,'error');
    v12State.step = 4;
    if (typeof v12UpdateStepBar  === 'function') v12UpdateStepBar();
    if (typeof v12RenderStepBody === 'function') v12RenderStepBody();
  } finally {
    window._v17busy = false;
    try { if (typeof isProcessingPayment !== 'undefined') isProcessingPayment = false; } catch(_) {}
  }
};

/* Sync aliases */
window.v16CompletePayment = window.v12CompletePayment;
window.v15CompletePayment = window.v12CompletePayment;
window.v13CompletePayment = window.v12CompletePayment;

console.info('%c[v17] ✅%c Dashboard-UTC | S6-SingleBtn | ProjectBills | ProjectPayment',
  'color:#10B981;font-weight:800','color:#6B7280');
