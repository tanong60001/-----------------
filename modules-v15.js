/**
 * SK POS — modules-v15.js  (โหลดหลัง modules-v14.js)
 * ════════════════════════════════════════════════════════════════
 *  V15-1  STEP 6 FIX     — หน้าบันทึกการขายแสดงผลถูกต้อง
 *  V15-2  UNIT CONV FIX  — หักสต็อกตาม conv_rate จาก product_units
 *  V15-3  PROJECT NAV    — เพิ่มเมนูโครงการใน sidebar (วิธีที่ถูกต้อง)
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

const _v15f = n => typeof formatNum==='function' ? formatNum(n) : Number(n||0).toLocaleString('th-TH');

/* ════════════════════════════════════════════════════════════════
   V15-3: PROJECT NAV
   - inject <a class="nav-item" data-page="projects"> ใน nav.nav-menu
   - inject <section id="page-projects" class="page-section hidden">
   - patch go() ให้รู้จัก page "projects"
════════════════════════════════════════════════════════════════ */
(function setupProjectNav() {

  function injectSection() {
    if (document.getElementById('page-projects')) return;
    const sec = document.createElement('section');
    sec.id = 'page-projects';
    sec.className = 'page-section hidden';
    const home = document.getElementById('page-home');
    if (home?.parentNode) home.parentNode.appendChild(sec);
    else document.querySelector('main,.main-content,#main-content')?.appendChild(sec);
  }

  function injectNav() {
  // ลบเมนูที่สร้างผิดพลาดจาก v14 ทิ้งก่อน
  const oldNav = document.querySelector('div[data-page="projects"]');
  if (oldNav) oldNav.remove();
  
  // ป้องกันการสร้างซ้ำของ v15 เอง
  if (document.querySelector('a[data-page="projects"]')) return; 
  
  const nav = document.querySelector('nav.nav-menu, .nav-menu');
    if (!nav) return;

    /* label */
    const lbl = document.createElement('div');
    lbl.className = 'nav-section';
    lbl.textContent = 'โครงการ';

    /* nav-item — ใช้ <a> เหมือนของเดิม */
    const a = document.createElement('a');
    a.className = 'nav-item';
    a.setAttribute('data-page', 'projects');
    a.innerHTML = '<i class="material-icons-round">business_center</i><span>โครงการ</span>';
    a.style.cursor = 'pointer';
    a.addEventListener('click', () => window.goProjects());

    /* แทรกก่อน nav-admin-section หรือท้าย nav */
    const adminSec = document.getElementById('nav-admin-section');
    if (adminSec) { nav.insertBefore(lbl, adminSec); nav.insertBefore(a, adminSec); }
    else           { nav.appendChild(lbl); nav.appendChild(a); }
  }

  function patchGo() {
    if (typeof go !== 'function') { setTimeout(patchGo, 300); return; }
    if (go._v15proj) return;
    const _orig = go;
    window.go = function(page) {
      if (page === 'projects') { window.goProjects(); return; }
      _orig(page);
    };
    window.go._v15proj = true;
  }

  window.goProjects = function() {
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById('page-projects');
    if (sec) sec.classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-page="projects"]')?.classList.add('active');
    const t = document.getElementById('page-title-text');
    if (t) t.textContent = '🏗️ โครงการ';
    document.getElementById('sidebar')?.classList.remove('show');
    if (typeof window.renderProjects === 'function') window.renderProjects();
    else if (sec) sec.innerHTML = `<div style="padding:60px;text-align:center;color:#9ca3af;">
      <i class="material-icons-round" style="font-size:60px;display:block;margin-bottom:12px;opacity:.3;">business_center</i>
      <div style="font-weight:700;font-size:15px;">ระบบโครงการยังไม่โหลด</div>
      <div style="margin-top:6px;font-size:13px;">กรุณาตรวจสอบว่า modules-v14.js โหลดก่อน v15</div>
    </div>`;
  };

  function run() { injectSection(); injectNav(); patchGo(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  setTimeout(run, 600);
  setTimeout(run, 2000);
})();


/* ════════════════════════════════════════════════════════════════
   V15-1: STEP 6 — override v12S6 (แสดงผลถูกต้อง)
════════════════════════════════════════════════════════════════ */
window.v12S6 = function(container) {
  if (!v12State?.savedBill) {
    container.innerHTML = `<div style="text-align:center;padding:40px 0;">
      <div style="font-size:48px;margin-bottom:12px;">⏳</div>
      <p style="color:var(--text-muted,#9ca3af);font-size:15px;">กำลังบันทึก...</p>
    </div>`;
    return;
  }

  const b       = v12State.savedBill;
  const method  = v12State.method || 'cash';
  const isDebt  = method === 'debt';
  const isCash  = method === 'cash';
  const hasDel  = v12State.deliveryMode !== 'self';
  const isDep   = v12State.paymentType === 'deposit';
  const mLbl    = {cash:'💵 เงินสด',transfer:'📱 โอนเงิน',credit:'💳 บัตรเครดิต',debt:'📋 ค้างเครดิต'}[method]||method;

  /* change chips */
  let chgHtml = '';
  if (isCash && (v12State.change||0) > 0 && typeof calcChangeDenominations === 'function') {
    const m = calcChangeDenominations(v12State.change);
    const chips = Object.entries(m).filter(([,c])=>c>0)
      .map(([v,c])=>`<span style="background:#dcfce7;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;color:#166534;">฿${_v15f(+v)} ×${c}</span>`).join('');
    if (chips) chgHtml = `<div style="margin-top:8px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 14px;">
      <div style="font-size:12px;font-weight:600;color:#15803d;margin-bottom:6px;">💵 แบงค์ทอน:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div></div>`;
  }

  /* partial summary */
  let partHtml = '';
  if (v12State.deliveryMode === 'partial') {
    const ca = window.cart || (typeof cart!=='undefined'?cart:[]);
    const rows = ca.map(item=>{
      const m=(v12State.itemModes||{})[item.id]||{take:item.qty,deliver:0};
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #f3f4f6;">
        <span>${item.name}</span>
        <span><span style="background:#dbeafe;color:#1d4ed8;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;">รับ ${m.take}</span>
        ${m.deliver>0?`<span style="background:#ede9fe;color:#5b21b6;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:4px;">ส่ง ${m.deliver}</span>`:''}</span></div>`;
    }).join('');
    if (rows) partHtml = `<div style="margin-top:12px;background:var(--bg-secondary,#f9fafb);border-radius:10px;padding:12px 14px;">
      <div style="font-size:11px;font-weight:700;color:#5b21b6;margin-bottom:6px;text-transform:uppercase;">📦 รายการรับ/ส่ง</div>${rows}</div>`;
  }

  container.innerHTML = `
    <div style="background:${isDebt?'linear-gradient(135deg,#fffbeb,#fef3c7)':'linear-gradient(135deg,#f0fdf4,#dcfce7)'};
      border:2px solid ${isDebt?'#fde68a':'#86efac'};border-radius:18px;padding:24px;text-align:center;margin-bottom:20px;">
      <i class="material-icons-round" style="font-size:52px;color:${isDebt?'#d97706':'#10b981'};">${isDebt?'pending_actions':'check_circle'}</i>
      <h3 style="margin:8px 0 4px;font-size:20px;font-weight:800;color:${isDebt?'#92400e':'#15803d'};">${isDebt?'บันทึกค้างชำระสำเร็จ!':'บันทึกการขายสำเร็จ!'}</h3>
      <p style="margin:0;color:var(--text-muted,#6b7280);font-size:14px;">บิล #${b.bill_no} | ฿${_v15f(v12State.total)}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;color:var(--text-muted);width:45%;">ลูกค้า</td>
          <td style="padding:8px 0;font-weight:600;text-align:right;">${v12State.customer?.name||'ลูกค้าทั่วไป'}</td></tr>
      <tr><td style="padding:8px 0;color:var(--text-muted);border-top:1px solid #f3f4f6;">วิธีชำระ</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;border-top:1px solid #f3f4f6;">${mLbl}</td></tr>
      ${isDebt?`<tr><td style="padding:8px 0;color:var(--text-muted);border-top:1px solid #f3f4f6;">ยอดค้างชำระ</td>
        <td style="padding:8px 0;font-weight:800;color:#dc2626;text-align:right;border-top:1px solid #f3f4f6;">฿${_v15f(v12State.total)}</td></tr>`:''}
      ${isDep&&!isDebt?`<tr><td style="padding:8px 0;color:var(--text-muted);border-top:1px solid #f3f4f6;">มัดจำ</td>
        <td style="padding:8px 0;font-weight:700;color:#f59e0b;text-align:right;border-top:1px solid #f3f4f6;">฿${_v15f(v12State.depositAmount)}</td></tr>
        <tr><td style="padding:8px 0;color:var(--text-muted);border-top:1px solid #f3f4f6;">คงค้าง</td>
        <td style="padding:8px 0;font-weight:700;color:#ef4444;text-align:right;border-top:1px solid #f3f4f6;">฿${_v15f(v12State.total-v12State.depositAmount)}</td></tr>`:''}
      ${isCash?`<tr><td style="padding:8px 0;color:var(--text-muted);border-top:1px solid #f3f4f6;">รับมา</td>
        <td style="padding:8px 0;font-weight:600;text-align:right;border-top:1px solid #f3f4f6;">฿${_v15f(v12State.received)}</td></tr>
        <tr><td style="padding:8px 0;color:var(--text-muted);border-top:1px solid #f3f4f6;">เงินทอน</td>
        <td style="padding:8px 0;font-weight:800;color:#10b981;text-align:right;border-top:1px solid #f3f4f6;">฿${_v15f(v12State.change)}</td></tr>`:''}
      ${hasDel?`<tr><td style="padding:8px 0;color:var(--text-muted);border-top:1px solid #f3f4f6;">จัดส่ง</td>
        <td style="padding:8px 0;font-weight:600;color:#8b5cf6;text-align:right;border-top:1px solid #f3f4f6;">${v12State.deliveryMode==='deliver'?'🚚 ร้านไปส่ง':'📦 รับบางส่วน'}</td></tr>
        <tr><td style="padding:8px 0;color:var(--text-muted);border-top:1px solid #f3f4f6;">วันนัด</td>
        <td style="padding:8px 0;text-align:right;border-top:1px solid #f3f4f6;">${v12State.deliveryDate||'-'}</td></tr>`:''}
    </table>
    ${chgHtml}${partHtml}
    ${hasDel?`<div style="margin-top:12px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:10px 14px;font-size:12px;color:#5b21b6;display:flex;align-items:center;gap:8px;">
      <i class="material-icons-round" style="font-size:16px;flex-shrink:0;">info</i>สินค้าที่รอส่งจะตัดสต็อกเมื่อกด "จัดส่งสำเร็จ"</div>`:''}
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;">
      <button class="v12-print-btn primary" onclick="v12PrintReceipt80mm('${b.id}')"><i class="material-icons-round" style="font-size:16px">receipt</i> ใบเสร็จ 80mm</button>
      <button class="v12-print-btn" onclick="v12PrintReceiptA4('${b.id}')"><i class="material-icons-round" style="font-size:16px">description</i> ใบเสร็จ A4</button>
      ${hasDel?`<button class="v12-print-btn" onclick="v12PrintDeliveryNote('${b.id}')"><i class="material-icons-round" style="font-size:16px">local_shipping</i> ใบส่งของ</button>`:''}
      ${isDep?`<button class="v12-print-btn" onclick="v12PrintDeposit('${b.id}')"><i class="material-icons-round" style="font-size:16px">receipt_long</i> ใบมัดจำ</button>`:''}
      <button class="v12-print-btn" onclick="typeof closeCheckout==='function'&&closeCheckout()" style="color:var(--text-muted,#9ca3af);border-color:var(--border,#d1d5db);"><i class="material-icons-round" style="font-size:16px">close</i> ปิด</button>
    </div>`;

  document.getElementById('v12-next-btn') && (document.getElementById('v12-next-btn').style.display='none');
  const bb=document.getElementById('v12-back-btn');
  if(bb){ bb.style.display='flex'; bb.innerHTML='<i class="material-icons-round">done_all</i> เสร็จสิ้น'; bb.className='v12-btn-next green'; bb.onclick=()=>typeof closeCheckout==='function'&&closeCheckout(); }
};


/* ════════════════════════════════════════════════════════════════
   V15-1b: STEP BAR + NEXT STEP
   ❌ ไม่ override v12RenderStepBody (ทำให้ render loop)
   ✅ เฉพาะ v12UpdateStepBar + v12NextStep + v12PrevStep
════════════════════════════════════════════════════════════════ */
window.v12UpdateStepBar = function() {
  const bar=document.getElementById('v12-steps-bar'); if(!bar) return;
  const gen=v12State.customer?.type==='general';
  const cash=v12State.method==='cash';
  let labels,steps;
  if(gen) { labels=cash?['ลูกค้า','วิธีชำระ','รับเงิน','บันทึก']:['ลูกค้า','วิธีชำระ','บันทึก']; steps=cash?[1,4,5,6]:[1,4,6]; }
  else    { labels=cash?['ลูกค้า','รูปแบบรับ','ชำระเงิน','วิธีชำระ','รับเงิน','บันทึก']:['ลูกค้า','รูปแบบรับ','ชำระเงิน','วิธีชำระ','บันทึก']; steps=cash?[1,2,3,4,5,6]:[1,2,3,4,6]; }
  bar.innerHTML=labels.map((l,i)=>{
    const r=steps[i],a=r===v12State.step,d=r<v12State.step;
    return `<div class="v12-step-pill ${a?'active':d?'done':''}">\
<span class="pill-num">${d?'<i class="material-icons-round" style="font-size:11px">check</i>':(i+1)}</span>${l}</div>${i<labels.length-1?`<div class="v12-step-connector ${d?'done':''}"></div>`:''}`;
  }).join('');
};

function _v15ui(){ typeof v12UpdateStepBar==='function'&&v12UpdateStepBar(); typeof v12RenderStepBody==='function'&&v12RenderStepBody(); }

function _v15pay(){ const fn=window.v15CompletePayment||window.v13CompletePayment||window.v12CompletePayment; typeof fn==='function'&&fn(); }

window.v12NextStep = function() {
  const t=typeof toast==='function'?toast:(m)=>alert(m);
  const gen=v12State.customer?.type==='general';

  if(v12State.step===1&&gen){ v12State.step=4; _v15ui(); return; }
  if(v12State.step===2){
    const nd=v12State.deliveryMode==='deliver'||v12State.deliveryMode==='partial';
    if(nd&&!v12State.deliveryDate){t('กรุณาระบุวันที่นัดส่ง','warning');return;}
    if(nd&&gen){t('บิลจัดส่งต้องระบุลูกค้า','warning');return;}
  }
  if(v12State.step===3&&v12State.paymentType==='deposit'){
    const dep=Number(document.getElementById('v12-deposit-input')?.value||0);
    if(!dep||dep<=0){t('กรุณาระบุยอดมัดจำ','warning');return;}
    if(dep>=v12State.total){t('ยอดมัดจำต้องน้อยกว่ายอดรวม','warning');return;}
    v12State.depositAmount=dep;
  }
  if(v12State.step===4&&!v12State.method){t('กรุณาเลือกวิธีชำระเงิน','warning');return;}
  if(v12State.step===4&&v12State.method==='debt'){
    v12State.received=0;v12State.change=0;v12State.step=6;_v15ui();_v15pay();return;
  }
  if(v12State.step===4&&v12State.method!=='cash'){
    const pay=v12State.paymentType==='deposit'?v12State.depositAmount:v12State.total;
    v12State.received=pay;v12State.change=0;v12State.step=6;_v15ui();_v15pay();return;
  }
  if(v12State.step===5){
    const pay=v12State.paymentType==='deposit'?v12State.depositAmount:v12State.total;
    const allD=typeof V13_ALL!=='undefined'?V13_ALL:typeof V14_ALL!=='undefined'?V14_ALL:[];
    const recv=allD.reduce((s,d)=>s+d.value*(v12State.receivedDenominations?.[d.value]||0),0);
    if(recv<pay){t('ยอดรับเงินไม่เพียงพอ','error');return;}
    v12State.received=recv;v12State.change=recv-pay;
    if(typeof calcChangeDenominations==='function') v12State.changeDenominations=calcChangeDenominations(v12State.change);
    v12State.step=6;_v15ui();_v15pay();return;
  }
  v12State.step++;_v15ui();
};

window.v12PrevStep=function(){
  const gen=v12State.customer?.type==='general';
  if((v12State.step===4||v12State.step===5)&&gen)v12State.step=1;
  else if(v12State.step===5)v12State.step=4;
  else if(v12State.step>1)v12State.step--;
  _v15ui();
};

/* patch v13SetMethod: อัพเดต step bar + ปุ่ม next เท่านั้น */
const _v15osm=window.v13SetMethod||window.v12SetMethod;
window.v13SetMethod=window.v12SetMethod=function(method){
  v12State.method=method;
  if(method!=='cash'){const allD=typeof V13_ALL!=='undefined'?V13_ALL:typeof V14_ALL!=='undefined'?V14_ALL:[];allD.forEach(d=>{if(v12State.receivedDenominations)v12State.receivedDenominations[d.value]=0;});}
  document.querySelectorAll('.v13-method-card').forEach(c=>{const h=c.querySelector('h4')?.textContent?.trim();const m={'เงินสด':'cash','โอนเงิน':'transfer','บัตรเครดิต':'credit','ค้างเครดิต':'debt'};c.classList.toggle('selected',m[h]===method);});
  const pay=v12State.paymentType==='deposit'?v12State.depositAmount:v12State.total;
  const ex=document.getElementById('v13-method-extra');
  if(ex&&typeof v13MethodExtraHTML==='function')ex.innerHTML=v13MethodExtraHTML(pay);
  if(typeof v12UpdateStepBar==='function')v12UpdateStepBar();
  /* ปรับปุ่ม next โดยตรง — ไม่ re-render body */
  const nb=document.getElementById('v12-next-btn');
  if(nb&&v12State.step===4){
    if(method==='cash'){nb.className='v12-btn-next';nb.innerHTML='ถัดไป <i class="material-icons-round">arrow_forward</i>';}
    else{nb.className='v12-btn-next green';nb.innerHTML='<i class="material-icons-round">check</i> ยืนยันการขาย';}
    nb.disabled=false;
  }
};


/* ════════════════════════════════════════════════════════════════
   V15-2: UNIT CONVERSION FIX — completePayment
════════════════════════════════════════════════════════════════ */
async function _v15fetchUnits(ids){
  const um={},bm={},cm={};
  if(!ids.length)return{um,bm,cm};
  try{
    const[{data:units},{data:prods}]=await Promise.all([
      db.from('product_units').select('product_id,unit_name,conv_rate').in('product_id',ids),
      db.from('สินค้า').select('id,unit,cost').in('id',ids),
    ]);
    (units||[]).forEach(u=>{if(!um[u.product_id])um[u.product_id]={};um[u.product_id][u.unit_name]=parseFloat(u.conv_rate)||1;});
    (prods||[]).forEach(p=>{bm[p.id]=p.unit||'ชิ้น';cm[p.id]=parseFloat(p.cost)||0;});
  }catch(e){console.warn('[v15] fetchUnits:',e.message);}
  return{um,bm,cm};
}
window.v15CompletePayment=async function(){
  // ถ้าเป็นการขายเข้าโครงการ ให้ v14 เป็นตัวจัดการบันทึกข้อมูลทั้งหมด
  if ((v12State.customer?.type === 'project' || v12State._forceDebt) && v12State.customer?.project_id) {
    if (typeof _v14ProjectPaymentLogic === 'function') {
      return _v14ProjectPaymentLogic();
    }
  }

  if(window._v15busy)return; window._v15busy=true;
  try{if(typeof isProcessingPayment!=='undefined')isProcessingPayment=true;}catch(_){}
  _v15ui();
  try{
    let sess=null;
    try{const{data}=await db.from('cash_session').select('*').eq('status','open').order('opened_at',{ascending:false}).limit(1).single();sess=data;}catch(_){}
    const mTh={cash:'เงินสด',transfer:'โอนเงิน',credit:'บัตรเครดิต',debt:'ค้างเครดิต'};
    const dTh={self:'รับเอง',deliver:'จัดส่ง',partial:'รับบางส่วน'};
    const isDebt=v12State.method==='debt';
    const pay=isDebt?0:(v12State.paymentType==='deposit'?v12State.depositAmount:v12State.total);
    const debtAmt=isDebt?v12State.total:(v12State.paymentType==='deposit'?(v12State.total-v12State.depositAmount):0);
    const stat=isDebt?'ค้างชำระ':(debtAmt>0?'ค้างชำระ':(v12State.deliveryMode!=='self'?'รอจัดส่ง':'สำเร็จ'));
    const hasDel=Object.values(v12State.itemModes||{}).some(m=>m.deliver>0);
    const ca=window.cart||(typeof cart!=='undefined'?cart:[]);
    const ids=[...new Set(ca.map(i=>i.id).filter(Boolean))];
    const{um,bm,cm}=await _v15fetchUnits(ids);

    const{data:bill,error:be}=await db.from('บิลขาย').insert({
      date:new Date().toISOString(),method:mTh[v12State.method]||'เงินสด',
      total:v12State.total,discount:v12State.discount||0,
      received:isDebt?0:(v12State.received||0),change:isDebt?0:(v12State.change||0),
      customer_name:v12State.customer?.name||'ลูกค้าทั่วไป',customer_id:v12State.customer?.id||null,
      staff_name:(typeof USER!=='undefined'&&USER)?USER.username:'unknown',
      status:stat,denominations:v12State.receivedDenominations||{},
      change_denominations:v12State.changeDenominations||{},
      delivery_mode:dTh[v12State.deliveryMode]||'รับเอง',
      delivery_date:v12State.deliveryDate||null,delivery_address:v12State.deliveryAddress||null,
      delivery_phone:v12State.deliveryPhone||null,
      delivery_status:hasDel?'รอจัดส่ง':'สำเร็จ',deposit_amount:v12State.depositAmount||0,
    }).select().single();
    if(be)throw be;

    for(const item of ca){
      const modes=(v12State.itemModes||{})[item.id]||{take:item.qty,deliver:0};
      const su=item.unit||'ชิ้น'; const bu=bm[item.id]||su;
      let cr=1; if(su!==bu){const pu=um[item.id]||{};cr=parseFloat(pu[su])||1;}
      const costPSU=(cm[item.id]||item.cost||0)*cr; // ต้นทุน/หน่วยขาย
      await db.from('รายการในบิล').insert({
        bill_id:bill.id,product_id:item.id,name:item.name,qty:item.qty,
        price:item.price,cost:costPSU,total:item.price*item.qty,unit:su,
        take_qty:modes.take,deliver_qty:modes.deliver,
      });
      if(modes.take>0){
        const bq=parseFloat((modes.take*cr).toFixed(6));
        const allP=(typeof products!=='undefined')?products:[];
        const prod=allP.find(p=>p.id===item.id);
        const sb=parseFloat(prod?.stock??0); const sa=parseFloat((sb-bq).toFixed(6));
        await db.from('สินค้า').update({stock:sa,updated_at:new Date().toISOString()}).eq('id',item.id);
        if(prod)prod.stock=sa;
        try{await db.from('stock_movement').insert({
          product_id:item.id,product_name:item.name,type:'ขาย',direction:'out',qty:bq,
          stock_before:sb,stock_after:sa,ref_id:bill.id,ref_table:'บิลขาย',
          staff_name:(typeof USER!=='undefined'&&USER)?USER.username:'unknown',
          note:cr!==1?`${modes.take} ${su} × ${cr} = ${bq} ${bu}`:null,
        });}catch(e){console.warn('[v15] smov:',e.message);}
      }
    }

    if(v12State.method==='cash'&&sess&&(v12State.received||0)>0){
      try{await db.from('cash_transaction').insert({
        session_id:sess.id,type:'ขาย',direction:'in',amount:v12State.received,
        change_amt:v12State.change,net_amount:pay,balance_after:0,
        ref_id:bill.id,ref_table:'บิลขาย',
        staff_name:(typeof USER!=='undefined'&&USER)?USER.username:'unknown',
        denominations:v12State.receivedDenominations||{},change_denominations:v12State.changeDenominations||{},
      });}catch(e){console.warn('[v15] cash_tx:',e.message);}
    }

    if(v12State.customer?.id){
      try{
        const{data:cu}=await db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id',v12State.customer.id).maybeSingle();
        await db.from('customer').update({total_purchase:(cu?.total_purchase||0)+v12State.total,visit_count:(cu?.visit_count||0)+1,debt_amount:(cu?.debt_amount||0)+debtAmt}).eq('id',v12State.customer.id);
      }catch(e){console.warn('[v15] cust:',e.message);}
    }

    typeof logActivity==='function'&&logActivity('ขายสินค้า',`บิล #${bill.bill_no} ฿${_v15f(v12State.total)}${isDebt?' [ค้างเครดิต]':''}`,bill.id,'บิลขาย');
    typeof sendToDisplay==='function'&&sendToDisplay({type:'thanks',billNo:bill.bill_no,total:v12State.total});

    v12State.savedBill=bill;
    window.cart=[];
    typeof loadProducts==='function'&&await loadProducts();
    typeof renderCart==='function'&&renderCart();
    typeof renderProductGrid==='function'&&renderProductGrid();
    typeof updateHomeStats==='function'&&updateHomeStats();
    _v15ui();
  }catch(e){
    console.error('[v15] pay:',e);
    typeof toast==='function'&&toast('เกิดข้อผิดพลาด: '+e.message,'error');
    v12State.step=v12State.method==='cash'?5:4; _v15ui();
  }finally{
    window._v15busy=false;
    try{if(typeof isProcessingPayment!=='undefined')isProcessingPayment=false;}catch(_){}
  }
};
window.v13CompletePayment=window.v15CompletePayment;
window.v12CompletePayment=window.v15CompletePayment;

console.info('%c[v15] ✅%c S6Fix | StepFix | UnitConv | ProjectNav','color:#10B981;font-weight:700','color:#6B7280');
