/**
 * SK POS — modules-v20.js  (โหลดหลัง modules-v19.js)
 * ══════════════════════════════════════════════════════════════════
 *  V20-FIX1  DASHBOARD CRASH   — neutralize v17/v18 db.from patches
 *  V20-FIX2  BMC OVERHAUL      — date-range, timezone, deposit tab, pay debt
 *  V20-FIX3  STOCK CONSISTENCY — unified conv_rate for return/cancel
 *  V20-FIX4  CART MANAGEMENT   — splice-based clear
 *  V20-FIX5  CHECKOUT CLEANUP  — itemModes init, overlay conflict
 *  V20-FIX6  TIMEZONE BROADENED
 *  V20-FIX7  UI POLISH
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

/* ── Shared Helpers ─────────────────────────────────────────── */
const _v20f = n => typeof formatNum === 'function' ? formatNum(n) : Number(n || 0).toLocaleString('th-TH');
const _v20staff = () => (typeof USER !== 'undefined' && USER) ? USER.username : 'unknown';
function _v20TZ() { const o=-(new Date().getTimezoneOffset()); const s=o>=0?'+':'-'; return `${s}${String(Math.floor(Math.abs(o)/60)).padStart(2,'0')}:${String(Math.abs(o)%60).padStart(2,'0')}`; }
function _v20AddTZ(v) { if(!v||typeof v!=='string') return v; if(v.endsWith('Z')||/[+-]\d{2}:\d{2}$/.test(v)) return v; if(!v.includes('T')) return v; return v+_v20TZ(); }
const _v20d = d => d ? new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}) : '-';
const _v20t = d => d ? new Date(d).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '';
const _v20dt = d => d ? (_v20d(d)+' '+_v20t(d)) : '-';


/* ════════════════════════════════════════════════════════════════
   V20-FIX1: DASHBOARD CRASH FIX
   
   Root cause: v17 replaces db.from with a wrapper that does:
     const builder = _origFrom(table);
     builder.gte.bind(builder);  ← CRASH!
   
   In Supabase JS v2, .from('table') returns PostgrestQueryBuilder
   which does NOT have .gte() — that method only exists on
   PostgrestFilterBuilder (returned by .select()).
   
   So builder.gte = undefined → .bind(undefined) → crash!
   
   Fix: Use defineProperty to FREEZE db.from during dashboard render
   so v17/v18 wrappers can't replace it. v19's prototype-level
   .gte/.lte patch already handles timezone correctly on the
   PostgrestFilterBuilder where .gte() actually exists.
════════════════════════════════════════════════════════════════ */
(function fixDashboard() {
  function tryFix() {
    if (typeof db === 'undefined' || typeof window.renderDashboardV3 !== 'function') {
      setTimeout(tryFix, 300); return;
    }
    if (window.renderDashboardV3._v20fixed) return;

    /* Save the CURRENT chain (v18→v17→dashboard-v3 original) */
    const currentChain = window.renderDashboardV3;

    /* Get a WORKING db.from reference right now at load time */
    const workingFrom = db.from.bind(db);

    window.renderDashboardV3 = async function() {
      /* FREEZE db.from using defineProperty so v17/v18 wrappers
         silently fail when they try db.from = ... (setter is no-op)
         All queries use our clean workingFrom instead */
      try {
        Object.defineProperty(db, 'from', {
          get: () => workingFrom,
          set: () => {},           /* ← v17/v18 set db.from = ... → ignored! */
          configurable: true
        });
      } catch(_) {
        db.from = workingFrom;
      }

      try {
        /* Call through v18→v17→original chain
           v17 tries db.from = wrapper → ignored (setter no-op)
           v18 tries db.from = wrapper → ignored (setter no-op)
           dashboard-v3's loadData calls db.from() → gets workingFrom
           workingFrom returns clean SupabaseQueryBuilder
           .select() returns PostgrestFilterBuilder  
           .gte()/.lte() use v19's prototype patch → timezone correct */
        await currentChain.call(this);
      } catch(e) {
        console.warn('[v20] Dashboard chain error:', e.message, '— trying fallback');
        /* Fallback: restore db.from and try v9 dashboard */
        try {
          Object.defineProperty(db, 'from', { value: workingFrom, writable: true, configurable: true });
          if (typeof window.v9d44Load === 'function') await window.v9d44Load();
        } catch(e2) { console.error('[v20] Dashboard fallback failed:', e2.message); }
      } finally {
        /* ALWAYS restore db.from to normal writable state */
        try {
          Object.defineProperty(db, 'from', { value: workingFrom, writable: true, configurable: true });
        } catch(_) { try { db.from = workingFrom; } catch(_2){} }
      }
    };
    window.renderDashboardV3._v20fixed = true;
    console.log('[v20] ✅ Dashboard crash fix — db.from frozen during render, v17/v18 patches neutralized');
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', tryFix);
  else tryFix();
  setTimeout(tryFix, 300);
  setTimeout(tryFix, 1000);
  setTimeout(tryFix, 3000);
})();


/* ════════════════════════════════════════════════════════════════
   V20-FIX6: BROADENED TIMEZONE PATCH
════════════════════════════════════════════════════════════════ */
(function broadenTZ() {
  function tryPatch() {
    if (typeof db==='undefined') { setTimeout(tryPatch,300); return; }
    try {
      const b = db.from('สินค้า').select('id').limit(0);
      const proto = Object.getPrototypeOf(b);
      if (!proto || proto._v20TZ) return;
      const COLS = ['date','paid_date','created_at','updated_at','opened_at','closed_at'];
      const oG = proto.gte, oL = proto.lte;
      proto.gte = function(c,v,...r) { if(COLS.includes(c)) v=_v20AddTZ(v); return oG.call(this,c,v,...r); };
      proto.lte = function(c,v,...r) { if(COLS.includes(c)) v=_v20AddTZ(v); return oL.call(this,c,v,...r); };
      proto._v20TZ = true;
      console.log('[v20] ✅ Broadened TZ patch:', COLS.join(', '));
    } catch(e) { console.warn('[v20] TZ:',e.message); }
  }
  setTimeout(tryPatch, 800);
})();


/* ════════════════════════════════════════════════════════════════
   V20-UTIL: Unified conv_rate fetcher
════════════════════════════════════════════════════════════════ */
async function _v20FetchConv(pids) {
  const um={}, bm={};
  if (!pids?.length) return {um,bm};
  try {
    const [{data:units},{data:prods}] = await Promise.all([
      db.from('product_units').select('product_id,unit_name,conv_rate').in('product_id',pids),
      db.from('สินค้า').select('id,unit,stock').in('id',pids) ]);
    (units||[]).forEach(u=>{ if(!um[u.product_id]) um[u.product_id]={}; um[u.product_id][u.unit_name]=parseFloat(u.conv_rate)||1; });
    (prods||[]).forEach(p=>{ bm[p.id]=p.unit||'ชิ้น'; });
  } catch(e) { console.warn('[v20] fetchConv:',e.message); }
  return {um,bm};
}
function _v20BaseQty(qty, su, pid, um, bm) {
  const bu=bm[pid]||su; if(su===bu) return qty;
  const cr=um[pid]?.[su]; return cr ? parseFloat((qty*cr).toFixed(6)) : qty;
}


/* ════════════════════════════════════════════════════════════════
   V20-FIX3: STOCK CONSISTENCY — v12ReturnBill + cancelBill
════════════════════════════════════════════════════════════════ */
window.v12ReturnBill = async function(billId) {
  try {
    const r = await Swal.fire({title:'คืนสินค้าทั้งบิล?',text:'คืนสต็อกตาม unit conversion',icon:'warning',showCancelButton:true,confirmButtonText:'ยืนยัน',cancelButtonText:'ยกเลิก',confirmButtonColor:'#7c3aed'});
    if (!r.isConfirmed) return;
    const {data:bill} = await db.from('บิลขาย').select('*').eq('id',billId).single();
    if (!bill) throw new Error('ไม่พบบิล');
    if (['คืนสินค้า','ยกเลิก'].includes(bill.status)) { typeof toast==='function'&&toast('บิลนี้ดำเนินการแล้ว','warning'); return; }
    const {data:items} = await db.from('รายการในบิล').select('*').eq('bill_id',billId);
    const pids = [...new Set((items||[]).map(i=>i.product_id).filter(Boolean))];
    const {um,bm} = await _v20FetchConv(pids);
    const delivered = bill.delivery_status==='จัดส่งสำเร็จ';
    for (const it of (items||[])) {
      if (!it.product_id) continue;
      let rq = it.take_qty||0; if(delivered) rq+=(it.deliver_qty||0); if(rq<=0) continue;
      const su=it.unit||'ชิ้น', bq=_v20BaseQty(rq,su,it.product_id,um,bm);
      const {data:pd} = await db.from('สินค้า').select('stock').eq('id',it.product_id).maybeSingle();
      const sb=parseFloat(pd?.stock||0), sa=parseFloat((sb+bq).toFixed(6));
      await db.from('สินค้า').update({stock:sa,updated_at:new Date().toISOString()}).eq('id',it.product_id);
      try{await db.from('stock_movement').insert({product_id:it.product_id,product_name:it.name,type:'คืนสินค้า',direction:'in',qty:bq,stock_before:sb,stock_after:sa,ref_id:billId,ref_table:'บิลขาย',staff_name:_v20staff()});}catch(_){}
      if(typeof products!=='undefined'){const p=products.find(p=>p.id===it.product_id);if(p)p.stock=sa;}
    }
    await db.from('บิลขาย').update({status:'คืนสินค้า',delivery_status:'ยกเลิก'}).eq('id',billId);
    if(bill.customer_id){try{const{data:c}=await db.from('customer').select('*').eq('id',bill.customer_id).single();if(c)await db.from('customer').update({total_purchase:Math.max(0,(c.total_purchase||0)-bill.total),debt_amount:Math.max(0,(c.debt_amount||0)-(bill.total-(bill.deposit_amount||0)))}).eq('id',bill.customer_id);}catch(_){}}
    typeof toast==='function'&&toast('คืนสินค้าสำเร็จ — สต็อกคืนตาม conv_rate','success');
    if(typeof loadProducts==='function') await loadProducts(); if(typeof updateHomeStats==='function') updateHomeStats(); if(typeof v12BMCLoad==='function') v12BMCLoad();
  } catch(e) { console.error('[v20] Return:',e); typeof toast==='function'&&toast('ผิดพลาด: '+e.message,'error'); }
};

window.cancelBill = async function(billId) {
  const {value:reason,isConfirmed} = await Swal.fire({title:'ยกเลิกบิลนี้?',icon:'warning',input:'text',inputLabel:'เหตุผล',showCancelButton:true,confirmButtonText:'ยกเลิกบิล',cancelButtonText:'ปิด',confirmButtonColor:'#DC2626',inputValidator:v=>!v?'กรุณาระบุเหตุผล':null});
  if (!isConfirmed) return;
  if(typeof v9ShowOverlay==='function') v9ShowOverlay('กำลังยกเลิกบิล...');
  try {
    const [{data:bill},{data:items}] = await Promise.all([db.from('บิลขาย').select('*').eq('id',billId).maybeSingle(),db.from('รายการในบิล').select('*').eq('bill_id',billId)]);
    if(!bill) throw new Error('ไม่พบบิล');
    const pids=[...new Set((items||[]).map(i=>i.product_id).filter(Boolean))];
    const {um,bm}=await _v20FetchConv(pids);
    const delivered=bill.delivery_status==='จัดส่งสำเร็จ';
    for (const it of (items||[])) {
      if(!it.product_id) continue;
      let rq=it.take_qty||it.qty||0; if(delivered) rq+=(it.deliver_qty||0);
      const su=it.unit||'ชิ้น', bq=_v20BaseQty(rq,su,it.product_id,um,bm);
      const {data:pd}=await db.from('สินค้า').select('stock').eq('id',it.product_id).maybeSingle();
      const sb=parseFloat(pd?.stock||0), sa=parseFloat((sb+bq).toFixed(6));
      await db.from('สินค้า').update({stock:sa,updated_at:new Date().toISOString()}).eq('id',it.product_id);
      try{await db.from('stock_movement').insert({product_id:it.product_id,product_name:it.name,type:'ยกเลิกบิล',direction:'in',qty:bq,stock_before:sb,stock_after:sa,ref_id:bill.id,ref_table:'บิลขาย',staff_name:_v20staff(),note:'ยกเลิก: '+reason});}catch(_){}
    }
    if(bill.method==='เงินสด'&&bill.total>0){try{const{data:s}=await db.from('cash_session').select('id').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();if(s&&typeof window.recordCashTx==='function')await window.recordCashTx({sessionId:s.id,type:'ยกเลิกบิล',direction:'out',amount:bill.total,netAmount:bill.total,refId:bill.id,refTable:'บิลขาย',note:`ยกเลิกบิล #${bill.bill_no}: ${reason}`});}catch(_){}}
    if(bill.customer_id){try{const{data:c}=await db.from('customer').select('debt_amount,total_purchase,visit_count').eq('id',bill.customer_id).maybeSingle();if(c){const u={total_purchase:Math.max(0,(c.total_purchase||0)-bill.total),visit_count:Math.max(0,(c.visit_count||1)-1)};if(['ค้างชำระ','ค้างเครดิต'].includes(bill.method))u.debt_amount=Math.max(0,(c.debt_amount||0)-bill.total);await db.from('customer').update(u).eq('id',bill.customer_id);}}catch(_){}}
    await db.from('บิลขาย').update({status:'ยกเลิก',cancel_reason:reason}).eq('id',billId);
    if(typeof logActivity==='function') logActivity('ยกเลิกบิล',`#${bill.bill_no}: ${reason}`,bill.id,'บิลขาย');
    typeof toast==='function'&&toast('ยกเลิกบิลสำเร็จ','success');
    if(typeof loadProducts==='function') await loadProducts(); if(typeof updateHomeStats==='function') updateHomeStats(); if(typeof v12BMCLoad==='function') v12BMCLoad();
  } catch(e){console.error('[v20] cancel:',e);typeof toast==='function'&&toast('ผิดพลาด: '+e.message,'error');}
  finally{if(typeof v9HideOverlay==='function') v9HideOverlay();}
};


/* ════════════════════════════════════════════════════════════════
   V20-FIX2: BMC OVERHAUL
   NOTE: ใช้ window.v12BMCActiveTab (ไม่ let ซ้ำ!)
════════════════════════════════════════════════════════════════ */
window.renderHistory = async function() {
  const sec=document.getElementById('page-history'); if(!sec) return;
  const today=new Date().toISOString().split('T')[0];
  sec.innerHTML=`<div class="v12-bmc-container"><div class="v20-bmc-header"><div class="v20-bmc-title"><i class="material-icons-round">receipt_long</i> ศูนย์จัดการบิล</div></div><div class="v12-bmc-search-bar"><div class="v12-bmc-search"><i class="material-icons-round" style="color:var(--text-muted,#9ca3af);font-size:18px">search</i><input type="text" id="bmc-search" placeholder="ค้นหาเลขบิล, ชื่อลูกค้า..." oninput="v12BMCLoad()"></div><div class="v20-date-range"><input type="date" class="v12-bmc-date" id="bmc-date-from" value="${today}" onchange="v12BMCLoad()"><span style="color:var(--text-muted);font-size:13px;font-weight:600">ถึง</span><input type="date" class="v12-bmc-date" id="bmc-date-to" value="${today}" onchange="v12BMCLoad()"></div><button onclick="v20BMCExport()" class="v20-export-btn"><i class="material-icons-round" style="font-size:16px">download</i> Export</button></div><div class="v12-bmc-tabs"><button class="v12-bmc-tab active" id="bmc-tab-all" onclick="v12BMCSetTab('all')">📋 ทั้งหมด <span class="tab-count" id="bmc-cnt-all">0</span></button><button class="v12-bmc-tab" id="bmc-tab-done" onclick="v12BMCSetTab('done')">🟢 สำเร็จ <span class="tab-count" id="bmc-cnt-done">0</span></button><button class="v12-bmc-tab" id="bmc-tab-pending" onclick="v12BMCSetTab('pending')">🟡 รอจัดส่ง <span class="tab-count" id="bmc-cnt-pending">0</span></button><button class="v12-bmc-tab" id="bmc-tab-debt" onclick="v12BMCSetTab('debt')">🔴 ค้างชำระ <span class="tab-count" id="bmc-cnt-debt">0</span></button><button class="v12-bmc-tab" id="bmc-tab-deposit" onclick="v12BMCSetTab('deposit')">🟠 มัดจำ <span class="tab-count" id="bmc-cnt-deposit">0</span></button><button class="v12-bmc-tab" id="bmc-tab-returned" onclick="v12BMCSetTab('returned')">🟣 คืน <span class="tab-count" id="bmc-cnt-returned">0</span></button><button class="v12-bmc-tab" id="bmc-tab-cancelled" onclick="v12BMCSetTab('cancelled')">⚫ ยกเลิก <span class="tab-count" id="bmc-cnt-cancelled">0</span></button></div><div class="v12-bmc-table-wrap"><table class="v12-bmc-table"><thead><tr><th>บิล #</th><th>วันเวลา</th><th>ลูกค้า</th><th>วิธีชำระ</th><th>จัดส่ง</th><th style="text-align:right">ยอดรวม</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody id="bmc-tbody"><tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted)">⏳ กำลังโหลด...</td></tr></tbody></table></div><div class="v20-bmc-summary" id="bmc-summary"></div></div>`;
  window.v12BMCActiveTab='all'; await v12BMCLoad();
};

window.v12BMCSetTab = function(tab) { window.v12BMCActiveTab=tab; document.querySelectorAll('.v12-bmc-tab').forEach(t=>t.classList.remove('active')); document.getElementById(`bmc-tab-${tab}`)?.classList.add('active'); v12BMCLoad(); };

window.v12BMCLoad = async function() {
  const df=document.getElementById('bmc-date-from')?.value||new Date().toISOString().split('T')[0];
  const dt=document.getElementById('bmc-date-to')?.value||df;
  const search=document.getElementById('bmc-search')?.value?.toLowerCase()||'';
  try {
    const{data:bills}=await db.from('บิลขาย').select('*').gte('date',_v20AddTZ(df+'T00:00:00')).lte('date',_v20AddTZ(dt+'T23:59:59')).order('date',{ascending:false});
    const all=(bills||[]).filter(b=>!search||b.bill_no?.toString().includes(search)||b.customer_name?.toLowerCase().includes(search));
    const isDep=b=>b.deposit_amount>0&&b.deposit_amount<b.total&&!['ยกเลิก','คืนสินค้า'].includes(b.status);
    const cnt={all:all.length,done:all.filter(b=>b.status==='สำเร็จ').length,pending:all.filter(b=>b.delivery_status==='รอจัดส่ง').length,debt:all.filter(b=>b.status==='ค้างชำระ'&&!isDep(b)).length,deposit:all.filter(isDep).length,returned:all.filter(b=>['คืนสินค้า','คืนบางส่วน'].includes(b.status)).length,cancelled:all.filter(b=>b.status==='ยกเลิก').length};
    Object.entries(cnt).forEach(([k,v])=>{const el=document.getElementById(`bmc-cnt-${k}`);if(el)el.textContent=v;});
    const tab=window.v12BMCActiveTab||'all';
    let f=all;
    if(tab==='done')f=all.filter(b=>b.status==='สำเร็จ');else if(tab==='pending')f=all.filter(b=>b.delivery_status==='รอจัดส่ง');else if(tab==='debt')f=all.filter(b=>b.status==='ค้างชำระ'&&!isDep(b));else if(tab==='deposit')f=all.filter(isDep);else if(tab==='returned')f=all.filter(b=>['คืนสินค้า','คืนบางส่วน'].includes(b.status));else if(tab==='cancelled')f=all.filter(b=>b.status==='ยกเลิก');
    const tb=document.getElementById('bmc-tbody');if(!tb)return;
    if(!f.length){tb.innerHTML=`<tr><td colspan="8"><div class="v12-bmc-empty"><i class="material-icons-round">receipt_long</i><p style="font-size:14px;font-weight:600;margin:0 0 4px">ไม่พบบิล</p></div></td></tr>`;_v20Sum([]);return;}
    tb.innerHTML=f.map(b=>{const ter=['ยกเลิก','คืนสินค้า','คืนบางส่วน'].includes(b.status);const hd=b.status==='ค้างชำระ';const hp=b.deposit_amount>0&&b.deposit_amount<b.total;const jp=!!b.project_id;
    return `<tr class="v20-bmc-row"><td><strong class="v20-bill-no">#${b.bill_no}</strong>${jp?'<br><span style="font-size:10px;color:#8b5cf6">📁 โครงการ</span>':''}</td><td style="font-size:12px;color:var(--text-muted)">${_v20d(b.date)}<br>${_v20t(b.date)}</td><td><div style="font-size:13px;font-weight:500">${b.customer_name||'ลูกค้าทั่วไป'}</div><div style="font-size:11px;color:var(--text-muted)">${b.staff_name||''}</div></td><td>${v12BMCMethodBadge(b.method)}</td><td>${v12BMCDeliveryBadge(b.delivery_status)}</td><td style="text-align:right"><div style="font-size:14px;font-weight:700">฿${_v20f(b.total)}</div>${hp?`<div style="font-size:11px;color:#d97706">มัดจำ ฿${_v20f(b.deposit_amount)}</div>`:hd?`<div style="font-size:11px;color:#ef4444">ค้าง ฿${_v20f(b.total-(b.deposit_amount||0))}</div>`:''}</td><td>${v12BMCBadge(b.status)}${hp?'<br><span class="v12-status-badge v12-badge-orange" style="font-size:10px;margin-top:2px">💰 มัดจำ</span>':''}</td><td><div style="display:flex;gap:4px;flex-wrap:wrap"><button class="v12-bmc-action-btn" onclick="viewBillDetail('${b.id}')"><i class="material-icons-round" style="font-size:13px">receipt</i> ดู</button><button class="v12-bmc-action-btn" onclick="v12PrintReceipt80mm('${b.id}')"><i class="material-icons-round" style="font-size:13px">print</i></button>${hd&&!jp?`<button class="v12-bmc-action-btn" onclick="v20BMCPayDebt('${b.id}')" style="color:#10b981;border-color:rgba(16,185,129,.3)"><i class="material-icons-round" style="font-size:13px">payments</i> รับชำระ</button>`:''}${!ter&&!jp?`<button class="v12-bmc-action-btn" onclick="typeof v10ShowReturnModal==='function'?v10ShowReturnModal('${b.id}'):v12ReturnBill('${b.id}')" style="color:#d97706;border-color:rgba(217,119,6,.25)"><i class="material-icons-round" style="font-size:13px">assignment_return</i> คืน</button><button class="v12-bmc-action-btn danger" onclick="cancelBill('${b.id}')"><i class="material-icons-round" style="font-size:13px">cancel</i></button>`:''}</div></td></tr>`;}).join('');
    _v20Sum(f);
  } catch(e){console.error('[v20] BMC:',e);const tb=document.getElementById('bmc-tbody');if(tb)tb.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:30px;color:#ef4444">โหลดไม่สำเร็จ: ${e.message}</td></tr>`;}
};
function _v20Sum(bs){const el=document.getElementById('bmc-summary');if(!el)return;const t=bs.reduce((s,b)=>s+(b.total||0),0);const d=bs.reduce((s,b)=>s+(b.deposit_amount||0),0);const debt=bs.filter(b=>b.status==='ค้างชำระ').reduce((s,b)=>s+(b.total-(b.deposit_amount||0)),0);el.innerHTML=`<div class="v20-summary-item"><span>รวมยอดขาย</span><strong style="color:#10b981">฿${_v20f(t)}</strong></div><div class="v20-summary-item"><span>มัดจำ</span><strong style="color:#d97706">฿${_v20f(d)}</strong></div><div class="v20-summary-item"><span>ค้างชำระ</span><strong style="color:#ef4444">฿${_v20f(debt)}</strong></div><div class="v20-summary-item"><span>บิล</span><strong>${bs.length}</strong></div>`;}

/* ── Pay Debt ─────────────────────────────────────────────── */
window.v20BMCPayDebt = async function(billId) {
  try {
    const{data:bill}=await db.from('บิลขาย').select('*').eq('id',billId).single();
    if(!bill){typeof toast==='function'&&toast('ไม่พบบิล','error');return;}
    const rem=bill.total-(bill.deposit_amount||0);
    const{value:pd}=await Swal.fire({title:`รับชำระ — บิล #${bill.bill_no}`,html:`<div style="text-align:left"><p>ยอดค้าง: <strong style="color:#ef4444">฿${_v20f(rem)}</strong></p><label style="font-size:13px;font-weight:600">จำนวนที่รับ</label><input type="number" id="swal-pay-amt" class="swal2-input" value="${rem}" min="1" max="${rem}"><label style="font-size:13px;font-weight:600;margin-top:8px;display:block">วิธีชำระ</label><select id="swal-pay-method" class="swal2-select"><option value="เงินสด">💵 เงินสด</option><option value="โอนเงิน">📱 โอนเงิน</option><option value="บัตรเครดิต">💳 บัตรเครดิต</option></select></div>`,showCancelButton:true,confirmButtonText:'รับชำระ',cancelButtonText:'ยกเลิก',confirmButtonColor:'#10b981',preConfirm:()=>{const a=Number(document.getElementById('swal-pay-amt')?.value||0);const m=document.getElementById('swal-pay-method')?.value||'เงินสด';if(!a||a<=0){Swal.showValidationMessage('กรุณาระบุจำนวน');return false;}if(a>rem){Swal.showValidationMessage('เกินยอดค้าง');return false;}return{amt:a,method:m};}});
    if(!pd)return;
    const nd=(bill.deposit_amount||0)+pd.amt;const full=nd>=bill.total;
    const ns=full?(bill.delivery_status==='รอจัดส่ง'?'รอจัดส่ง':'สำเร็จ'):'ค้างชำระ';
    await db.from('บิลขาย').update({deposit_amount:nd,status:ns,method:full?pd.method:bill.method}).eq('id',billId);
    if(bill.customer_id){try{const{data:c}=await db.from('customer').select('debt_amount').eq('id',bill.customer_id).maybeSingle();if(c)await db.from('customer').update({debt_amount:Math.max(0,(c.debt_amount||0)-pd.amt)}).eq('id',bill.customer_id);}catch(_){}}
    if(typeof logActivity==='function')logActivity('รับชำระ',`บิล #${bill.bill_no} ฿${_v20f(pd.amt)} ${pd.method}${full?' (ครบ)':''}`,billId,'บิลขาย');
    typeof toast==='function'&&toast(`รับชำระ ฿${_v20f(pd.amt)} สำเร็จ${full?' — ครบแล้ว':''}`, 'success');
    v12BMCLoad();
  } catch(e){console.error('[v20] PayDebt:',e);typeof toast==='function'&&toast('ผิดพลาด: '+e.message,'error');}
};

/* ── Export ────────────────────────────────────────────────── */
window.v20BMCExport = window.v12BMCExport = async function() {
  const df=document.getElementById('bmc-date-from')?.value||new Date().toISOString().split('T')[0];
  const dt=document.getElementById('bmc-date-to')?.value||df;
  try{const{data:bs}=await db.from('บิลขาย').select('*').gte('date',_v20AddTZ(df+'T00:00:00')).lte('date',_v20AddTZ(dt+'T23:59:59')).order('date',{ascending:false});if(!bs?.length){typeof toast==='function'&&toast('ไม่มีข้อมูล','warning');return;}const rows=[['บิล#','วันที่','ลูกค้า','วิธีชำระ','ยอด','ส่วนลด','รับ','ทอน','มัดจำ','ค้าง','สถานะ','จัดส่ง']];bs.forEach(b=>rows.push([b.bill_no,_v20dt(b.date),b.customer_name||'ทั่วไป',b.method,b.total,b.discount||0,b.received||0,b.change||0,b.deposit_amount||0,b.total-(b.deposit_amount||0),b.status,b.delivery_status||'-']));const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`sales_${df}_to_${dt}.csv`;a.click();typeof toast==='function'&&toast('Export สำเร็จ','success');}catch(e){typeof toast==='function'&&toast('Export ไม่สำเร็จ','error');}
};


/* ════════════════════════════════════════════════════════════════
   V20-FIX4/5: CART + CHECKOUT
════════════════════════════════════════════════════════════════ */
function _v20ClearCart(){if(typeof cart!=='undefined'&&Array.isArray(cart))cart.splice(0,cart.length);if(window.cart&&Array.isArray(window.cart)&&window.cart!==(typeof cart!=='undefined'?cart:null))window.cart.splice(0,window.cart.length);}

const _v20OS=window.startCheckout;
window.startCheckout=function(){document.getElementById('checkout-overlay')?.classList.add('hidden');_v20OS?.();if(typeof cart!=='undefined'&&typeof v12State!=='undefined')cart.forEach(i=>{if(!v12State.itemModes[i.id])v12State.itemModes[i.id]={take:i.qty,deliver:0};});};

const _v20OC=window.closeCheckout;
window.closeCheckout=function(){document.getElementById('checkout-overlay')?.classList.add('hidden');if(typeof v12State!=='undefined'&&v12State?.savedBill){_v20ClearCart();try{v12State.savedBill=null;v12State.step=1;v12State.method=null;v12State.received=0;v12State.change=0;v12State.receivedDenominations={};v12State.changeDenominations={};v12State.depositAmount=0;v12State.deliveryMode='self';v12State.itemModes={};v12State._forceDebt=false;v12State.customer={type:'general',id:null,name:'ลูกค้าทั่วไป'};v12State.paymentType='full';}catch(_){}if(typeof renderCart==='function')renderCart();if(typeof renderProductGrid==='function')renderProductGrid();if(typeof updateHomeStats==='function')updateHomeStats();}
_v20OC?.();};

const _v20OP=window.v12CompletePayment;
window.v12CompletePayment=async function(){await _v20OP?.();if(typeof v12State!=='undefined'&&v12State?.savedBill)_v20ClearCart();};
window.v15CompletePayment=window.v13CompletePayment=window.v12CompletePayment;


/* ════════════════════════════════════════════════════════════════
   V20-FIX8: DQ BADGE
════════════════════════════════════════════════════════════════ */
(async function(){try{const{data}=await db.from('บิลขาย').select('id,delivery_status,status').eq('delivery_status','รอจัดส่ง').neq('status','ยกเลิก');const b=document.getElementById('delivery-count-badge');if(b){b.textContent=(data||[]).length;b.classList.toggle('hidden',!(data||[]).length);}}catch(_){}})();


/* ════════════════════════════════════════════════════════════════
   V20-FIX7: CSS
════════════════════════════════════════════════════════════════ */
(function(){if(document.getElementById('v20-css'))return;const s=document.createElement('style');s.id='v20-css';s.textContent=`
.v20-bmc-header{display:flex;align-items:center;margin-bottom:20px}
.v20-bmc-title{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:800;color:var(--text-primary,#111827)}
.v20-bmc-title i{font-size:26px;color:var(--primary,#3b82f6)}
.v20-date-range{display:flex;align-items:center;gap:8px}
.v20-export-btn{border:1.5px solid var(--border,#d1d5db);border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;background:var(--bg-primary,#fff);display:flex;align-items:center;gap:6px;transition:all .15s;font-family:inherit;color:var(--text-primary,#111)}
.v20-export-btn:hover{border-color:var(--primary);color:var(--primary)}
.v20-bmc-row{transition:background .1s}.v20-bmc-row:hover{background:var(--bg-secondary,#f9fafb)!important}
.v20-bill-no{color:var(--primary,#3b82f6);font-size:13px}
.v20-bmc-summary{display:flex;gap:16px;margin-top:16px;padding:14px 20px;background:linear-gradient(135deg,#f8fafc,#f0f9ff);border-radius:14px;border:1px solid var(--border,#e5e7eb);flex-wrap:wrap}
.v20-summary-item{display:flex;flex-direction:column;gap:2px;flex:1;min-width:100px}
.v20-summary-item span{font-size:11px;font-weight:600;color:var(--text-muted,#9ca3af);text-transform:uppercase;letter-spacing:.5px}
.v20-summary-item strong{font-size:16px;font-weight:800}
.v12-checkout-shell{animation:v20Up .3s cubic-bezier(.16,1,.3,1)}@keyframes v20Up{from{opacity:0;transform:translateY(20px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.v12-step-pill{transition:all .2s}.v12-step-pill.active{transform:scale(1.05)}.v12-step-pill.done .pill-num{background:#10b981!important;color:#fff!important}
.v12-dq-card{transition:transform .2s,box-shadow .2s}.v12-dq-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)}
.page-section{animation:v20F .2s ease}@keyframes v20F{from{opacity:0}to{opacity:1}}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:3px}
@media(max-width:768px){.v20-date-range{flex-wrap:wrap;gap:6px}.v20-bmc-summary{flex-direction:column;gap:10px}.v20-summary-item{flex-direction:row;justify-content:space-between;align-items:center}.v12-bmc-search-bar{flex-direction:column}}
`;document.head.appendChild(s);})();


/* ═══════════════════════════════════════════════════════════════ */
console.info('%c[modules-v20.js] ✅%c Dashboard Fix | BMC Overhaul | Stock Conv | Cart Fix | TZ | UI','color:#059669;font-weight:700','color:#6B7280');
