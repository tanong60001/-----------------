section.innerHTML = `
    <style>
      @keyframes v9FadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes v9GrowUp { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      @keyframes v9SlideRight { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      
      .v9-card-hover { transition: all 0.3s ease; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }
      .v9-card-hover:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.08); }
      
      .v9-btn-tab { padding: 8px 16px; border-radius: 8px 8px 0 0; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.2s; color: var(--text-tertiary); }
      .v9-btn-tab.on { color: var(--primary); border-bottom: 3px solid var(--primary); }
      .v9-btn-tab:hover:not(.on) { color: var(--text-primary); background: var(--bg-base); }
      
      .v9-btn-per { padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--border-light); background: transparent; color: var(--text-secondary); transition: all 0.2s; }
      .v9-btn-per.on { background: var(--primary); color: #fff; border-color: var(--primary); box-shadow: 0 2px 6px rgba(var(--primary-rgb), 0.3); }
      .v9-btn-per:hover:not(.on) { background: var(--bg-base); }
      
      .v9-bar { transform-origin: bottom; animation: v9GrowUp 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; transition: filter 0.2s; cursor: pointer; }
      .v9-bar:hover { filter: brightness(1.2); }
      
      .v9-list-row { transition: background 0.2s ease, padding-left 0.2s ease; }
      .v9-list-row:hover { background: var(--bg-base); padding-left: 20px !important; }
      
      .v9-progress-bar { transform-origin: left; animation: v9SlideRight 1s cubic-bezier(0.175, 0.885, 0.32, 1.1) forwards; }
    </style>

    <div style="padding:20px;max-width:1400px;margin:0 auto; animation: v9FadeInUp 0.4s ease-out;">

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:24px;font-weight:800; display:flex; align-items:center; gap:8px;">
            <i class="material-icons-round" style="color:var(--primary);">insights</i> วิเคราะห์ธุรกิจ
          </div>
          <div style="font-size:13px;color:var(--text-tertiary);margin-top:2px;" id="v9d44-lbl"></div>
        </div>
        <div style="display:flex;gap:6px; background:var(--bg-surface); padding:6px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.03); border:0.5px solid var(--border-light);">
          <button class="v9d44-per v9-btn-per on" data-d="1">วันนี้</button>
          <button class="v9d44-per v9-btn-per" data-d="7">7 วัน</button>
          <button class="v9d44-per v9-btn-per" data-d="30">30 วัน</button>
          <button class="v9d44-per v9-btn-per" data-d="365">ปีนี้</button>
          <div style="width:1px; background:var(--border-light); margin:0 4px;"></div>
          <button class="v9-btn-per" style="padding:6px 10px;" onclick="window.v9d44Load()" title="รีเฟรช">
            <i class="material-icons-round" style="font-size:16px;vertical-align:middle;color:var(--text-secondary);">refresh</i>
          </button>
        </div>
      </div>

      <div style="display:flex;border-bottom:2px solid var(--border-light);margin-bottom:20px; gap:10px;">
        <div class="v9d44-tab v9-btn-tab on" data-tab="pl">📈 กำไร-ขาดทุน (P&amp;L)</div>
        <div class="v9d44-tab v9-btn-tab" data-tab="cash">💰 กระแสเงินสด</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:24px;" id="v9d44-kpi">
        ${[0,1,2,3,4].map((x,i)=>`<div class="v9-card-hover" style="background:var(--bg-surface);border-radius:16px;padding:16px;border:0.5px solid var(--border-light); animation: v9FadeInUp 0.4s ease-out ${i*0.05}s both;">
          <div style="height:11px;background:var(--bg-base);border-radius:4px;width:60%;margin-bottom:12px;" class="skeleton"></div>
          <div style="height:28px;background:var(--bg-base);border-radius:6px;width:80%;" class="skeleton"></div>
        </div>`).join('')}
      </div>

      <div class="v9-card-hover" style="background:var(--bg-surface);border-radius:16px;border:0.5px solid var(--border-light);margin-bottom:20px;overflow:hidden; animation: v9FadeInUp 0.5s ease-out 0.2s both;">
        <div style="padding:16px 20px;border-bottom:0.5px solid var(--border-light);display:flex;align-items:center;justify-content:space-between; background:rgba(0,0,0,0.01);">
          <span style="font-size:15px;font-weight:700;display:flex;align-items:center;gap:6px;" id="v9d44-chart-title">
            <i class="material-icons-round" style="font-size:18px;color:var(--text-secondary);">bar_chart</i> ภาพรวมรายวัน
          </span>
          <span id="v9d44-legend" style="display:flex;gap:16px;font-size:12px;color:var(--text-secondary);font-weight:500;"></span>
        </div>
        <div style="padding:20px 20px 10px;">
          <div id="v9d44-chart" style="height:180px;display:flex;align-items:flex-end;gap:6px;"></div>
          <div id="v9d44-clbl" style="display:flex;gap:6px;margin-top:8px;"></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start;">
        <div style="animation: v9FadeInUp 0.5s ease-out 0.3s both;">
          <div class="v9-card-hover" style="background:var(--bg-surface);border-radius:16px;border:0.5px solid var(--border-light);overflow:hidden;">
            <div style="padding:16px 20px;border-bottom:0.5px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.01);">
              <span style="font-size:15px;font-weight:700;display:flex;align-items:center;gap:6px;">
                <i class="material-icons-round" style="font-size:18px;color:var(--text-secondary);">history</i> ความเคลื่อนไหวล่าสุด
              </span>
              <div style="display:flex;gap:4px;background:var(--bg-base);padding:4px;border-radius:999px;" id="v9d44-tlf">
                ${['all:ทั้งหมด','sale:ขาย','buy:ซื้อ','exp:จ่าย'].map((x,i)=>{
                  const[k,v]=x.split(':');
                  return `<button style="padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;border:none;background:${i===0?'var(--primary)':'transparent'};color:${i===0?'#fff':'var(--text-secondary)'};cursor:pointer;transition:all 0.2s;" data-f="${k}">${v}</button>`;
                }).join('')}
              </div>
            </div>
            <div id="v9d44-tl" style="max-height:480px;overflow-y:auto;padding-bottom:10px;">
              <div style="padding:60px;text-align:center;color:var(--text-tertiary);">
                <div class="spinner" style="margin:0 auto 10px;"></div>กำลังจัดเตรียมข้อมูล...
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px; animation: v9FadeInUp 0.5s ease-out 0.4s both;">
          <div id="v9d44-pl-panel" class="v9-card-hover" style="background:var(--bg-surface);border-radius:16px;border:0.5px solid var(--border-light);overflow:hidden;">
            <div style="padding:14px 20px;border-bottom:0.5px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.01);">
              <span style="font-size:14px;font-weight:700;">📈 งบกำไร-ขาดทุน</span>
              <span style="font-size:11px;font-weight:600;background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:999px;">วัดผลกำไรจริง</span>
            </div>
            <div style="padding:16px 20px;" id="v9d44-pl-body">
              <div class="spinner" style="margin:20px auto;"></div>
            </div>
          </div>

          <div id="v9d44-cash-panel" class="v9-card-hover" style="background:var(--bg-surface);border-radius:16px;border:0.5px solid var(--border-light);overflow:hidden; display:none;">
            <div style="padding:14px 20px;border-bottom:0.5px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.01);">
              <span style="font-size:14px;font-weight:700;">💰 กระแสเงินสด</span>
              <span style="font-size:11px;font-weight:600;background:#f0fdf4;color:#15803d;padding:4px 10px;border-radius:999px;">เงินหมุนเวียน</span>
            </div>
            <div style="padding:16px 20px;" id="v9d44-cash-body">
              <div class="spinner" style="margin:20px auto;"></div>
            </div>
          </div>

          <div class="v9-card-hover" style="background:var(--bg-surface);border-radius:16px;border:0.5px solid var(--border-light);overflow:hidden;">
            <div style="padding:14px 20px;border-bottom:0.5px solid var(--border-light);background:rgba(0,0,0,0.01);">
              <span style="font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;"><i class="material-icons-round" style="font-size:16px;color:#f59e0b;">emoji_events</i> สินค้าทำยอดสูงสุด</span>
            </div>
            <div style="padding:16px 20px;" id="v9d44-top">
               <div class="spinner" style="margin:20px auto;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // bind tabs (ปรับให้เข้ากับคลาสใหม่)
  document.querySelectorAll('.v9d44-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.v9d44-tab').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      const tab=btn.dataset.tab;
      document.getElementById('v9d44-pl-panel').style.display=(tab==='cash')?'none':'block';
      document.getElementById('v9d44-cash-panel').style.display=(tab==='pl')?'none':'block';
    });
  });

  // bind period
  document.querySelectorAll('.v9d44-per').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.v9d44-per').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      window.v9d44Load();
    });
  });

  // bind timeline filter (ปรับเอฟเฟกต์ตอนกดปุ่มฟิลเตอร์)
  document.getElementById('v9d44-tlf')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-f]');
    if(!btn)return;
    document.querySelectorAll('#v9d44-tlf [data-f]').forEach(b=>{
      b.style.background='transparent';b.style.color='var(--text-secondary)';
    });
    btn.style.background='var(--primary)';btn.style.color='#fff';
    if(window._v9d44Data) window.v9d44RenderTL(window._v9d44Data);
  });

  window.v9d44Load();
};

const formatNum = (n) => new Intl.NumberFormat('th-TH').format(n);

window.v9d44Load = async function () {
  const days  = parseInt(document.querySelector('.v9d44-per.on')?.dataset.d||1);
  const today = new Date().toISOString().split('T')[0];
  const since = days===1?today:new Date(Date.now()-(days-1)*86400000).toISOString().split('T')[0];

  const lbl=document.getElementById('v9d44-lbl');
  if(lbl) lbl.textContent=days===1
    ?new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
    :`${new Date(since+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})} — ${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}`;

  try {
    const [bR,pR,eR,iR,salR] = await Promise.all([
      db.from('บิลขาย').select('id,bill_no,total,method,status,date,customer_name').gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(500),
      db.from('purchase_order').select('id,total,supplier,method,date,status').gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายจ่าย').select('id,description,amount,category,method,date').gte('date',since+'T00:00:00').order('date',{ascending:false}).limit(300),
      db.from('รายการในบิล').select('name,qty,price,cost,total,unit,bill_id').limit(2000),
      db.from('จ่ายเงินเดือน').select('net_paid,paid_date').gte('paid_date',since+'T00:00:00'),
    ]);

    const B   = (bR.data||[]).filter(b=>b.status!=='ยกเลิก');
    const bIds= new Set(B.map(b=>b.id));
    const P   = pR.data||[];
    const E   = eR.data||[];
    const I   = (iR.data||[]).filter(i=>bIds.has(i.bill_id));
    const Sal = salR.data||[];

    const EW  = E.filter(e=>e.category==='ค่าแรง');
    const EO  = E.filter(e=>e.category!=='ค่าแรง');

    const tS   = B.reduce((s,b)=>s+parseFloat(b.total||0),0);
    const tP   = P.reduce((s,p)=>s+parseFloat(p.total||0),0);
    const tEW  = EW.reduce((s,e)=>s+parseFloat(e.amount||0),0);
    const tEO  = EO.reduce((s,e)=>s+parseFloat(e.amount||0),0);
    const tSal = Sal.reduce((s,p)=>s+parseFloat(p.net_paid||0),0);
    const tO   = tP+tEW+tEO+tSal;
    const nC   = tS-tO;
    const cogs = I.reduce((s,i)=>s+(parseFloat(i.cost||0)*parseFloat(i.qty||0)),0);
    const gP   = tS-cogs; const gM=tS>0?Math.round(gP/tS*100):0;
    const opX  = tEW+tEO;
    const nP   = gP-opX;  const nM=tS>0?Math.round(nP/tS*100):0;

    window._v9d44Data={B,P,E,EW,EO,I,Sal,tS,tP,tEW,tEO,tSal,tO,nC,cogs,gP,gM,opX,nP,nM,days,since};
    window.v9d44KPI(window._v9d44Data);
    window.v9d44Chart(window._v9d44Data);
    window.v9d44RenderTL(window._v9d44Data);
    window.v9d44PL(window._v9d44Data);
    window.v9d44Cash(window._v9d44Data);
    window.v9d44Top(I);
  } catch(e){console.error('[Dash44]',e);}
};

window.v9d44KPI = function({B,tS,cogs,gP,gM,nP,nM,nC}) {
  const el=document.getElementById('v9d44-kpi');if(!el)return;
  const K=[
    {l:'ยอดขายสุทธิ',v:tS,s:`จาก ${B.length} บิล`,c:'#16a34a',bg:'linear-gradient(135deg, rgba(22,163,74,0.05) 0%, rgba(22,163,74,0) 100%)',i:'trending_up'},
    {l:'ต้นทุนขาย (COGS)',v:cogs,s:'ทุนสินค้า',c:'#d97706',bg:'linear-gradient(135deg, rgba(217,119,6,0.05) 0%, rgba(217,119,6,0) 100%)',i:'inventory'},
    {l:'กำไรขั้นต้น',v:gP,s:`Margin ${gM}%`,c:gP>=0?'#0284c7':'#dc2626',bg:'linear-gradient(135deg, rgba(2,132,199,0.05) 0%, rgba(2,132,199,0) 100%)',i:'show_chart'},
    {l:'กำไรสุทธิ',v:nP,s:`Net Margin ${nM}%`,c:nP>=0?'#15803d':'#dc2626',bg:'linear-gradient(135deg, rgba(21,128,61,0.08) 0%, rgba(21,128,61,0) 100%)',i:'account_balance', border:'border-left:4px solid #15803d;'},
    {l:'กระแสเงินสด',v:nC,s:nC>=0?'สภาพคล่องบวก':'สภาพคล่องติดลบ',c:nC>=0?'#15803d':'#dc2626',bg:'linear-gradient(135deg, rgba(21,128,61,0.08) 0%, rgba(21,128,61,0) 100%)',i:'account_balance_wallet', border:'border-left:4px solid #15803d;'},
  ];
  el.innerHTML=K.map((k,i)=>`
    <div class="v9-card-hover" style="background:${k.bg}, var(--bg-surface);border-radius:16px;padding:18px; ${k.border || 'border:0.5px solid var(--border-light);'} animation: v9FadeInUp 0.4s ease-out ${i*0.05}s both;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-secondary);">${k.l}</span>
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <i class="material-icons-round" style="font-size:16px;color:${k.c};">${k.i}</i>
        </div>
      </div>
      <div style="font-size:26px;font-weight:800;color:${k.c};letter-spacing:-0.5px;">${k.v<0?'−':''}฿${formatNum(Math.abs(Math.round(k.v)))}</div>
      <div style="font-size:11px;font-weight:600;color:${k.c};opacity:.8;margin-top:4px;">${k.s}</div>
    </div>`).join('');
};

window.v9d44Chart = function({B,P,E,days}) {
  const cw=document.getElementById('v9d44-chart');
  const cl=document.getElementById('v9d44-clbl');
  const lg=document.getElementById('v9d44-legend');
  if(!cw)return;
  const n=Math.min(days,14);
  const data=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(Date.now()-i*86400000).toISOString().split('T')[0];
    data.push({d,
      s:B.filter(b=>b.date.startsWith(d)).reduce((x,b)=>x+parseFloat(b.total||0),0),
      p:P.filter(b=>b.date.startsWith(d)).reduce((x,b)=>x+parseFloat(b.total||0),0),
      e:E.filter(b=>b.date.startsWith(d)).reduce((x,b)=>x+parseFloat(b.amount||0),0),
    });
  }
  const mx=Math.max(...data.map(d=>Math.max(d.s,d.p,d.e)),1);
  if(lg)lg.innerHTML=[{c:'#16a34a',t:'ยอดขาย'},{c:'#d97706',t:'ซื้อของ'},{c:'#ef4444',t:'รายจ่าย'}]
    .map(x=>`<span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;background:${x.c};border-radius:3px;display:inline-block;box-shadow:0 1px 2px rgba(0,0,0,0.1);"></span><span>${x.t}</span></span>`).join('');
  cw.innerHTML=data.map((d,i)=>{
    const sh=Math.round(d.s/mx*160),ph=Math.round(d.p/mx*160),eh=Math.round(d.e/mx*160);
    return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;"
      title="${new Date(d.d).toLocaleDateString('th-TH')}&#10;ขาย ฿${formatNum(Math.round(d.s))}&#10;ซื้อ ฿${formatNum(Math.round(d.p))}&#10;จ่าย ฿${formatNum(Math.round(d.e))}">
      <div style="display:flex;gap:4px;align-items:flex-end;width:100%;justify-content:center;">
        ${sh?`<div class="v9-bar" style="width:12px;height:${sh}px;background:linear-gradient(to top, #15803d, #22c55e);border-radius:4px 4px 0 0;box-shadow:0 2px 4px rgba(34,197,94,0.2); animation-delay:${i*0.03}s;"></div>`:''}
        ${ph?`<div class="v9-bar" style="width:12px;height:${ph}px;background:linear-gradient(to top, #b45309, #f59e0b);border-radius:4px 4px 0 0;box-shadow:0 2px 4px rgba(245,158,11,0.2); animation-delay:${i*0.03}s;"></div>`:''}
        ${eh?`<div class="v9-bar" style="width:12px;height:${eh}px;background:linear-gradient(to top, #b91c1c, #ef4444);border-radius:4px 4px 0 0;box-shadow:0 2px 4px rgba(239,68,68,0.2); animation-delay:${i*0.03}s;"></div>`:''}
        ${!sh&&!ph&&!eh?`<div style="width:30px;height:2px;background:var(--border-light);border-radius:2px;"></div>`:''}
      </div></div>`;
  }).join('');
  if(cl)cl.innerHTML=data.map(d=>`
    <div style="flex:1;text-align:center;font-size:11px;font-weight:500;color:var(--text-tertiary);">
      ${new Date(d.d+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</div>`).join('');
};

window.v9d44RenderTL = function({B,P,E,EW,EO,Sal}) {
  const el=document.getElementById('v9d44-tl');if(!el)return;
  const f=document.querySelector('#v9d44-tlf [data-f][style*="var(--primary)"]')?.dataset?.f||'all';
  const ev=[];
  if(f==='all'||f==='sale') B.forEach(b=>ev.push({t:b.date,i:'trending_up',bg:'#f0fdf4',c:'#16a34a',
    ti:`รับเงินบิล #${b.bill_no}`,su:b.method+(b.customer_name?' · '+b.customer_name:''),a:parseFloat(b.total||0),sg:'+'}));
  if(f==='all'||f==='buy')  P.forEach(p=>ev.push({t:p.date,i:'inventory_2',bg:'#fffbeb',c:'#d97706',
    ti:p.supplier||'ซื้อสินค้าเข้าคลัง',su:p.method,a:parseFloat(p.total||0),sg:'−',cr:p.method==='เครดิต'}));
  if(f==='all'||f==='exp'){
    (EW||[]).forEach(e=>ev.push({t:e.date,i:'people',bg:'#fff7ed',c:'#ea580c',
      ti:e.description||'จ่ายค่าแรง',su:'ค่าแรง',a:parseFloat(e.amount||0),sg:'−'}));
    (EO||[]).forEach(e=>ev.push({t:e.date,i:'receipt_long',bg:'#fef2f2',c:'#ef4444',
      ti:e.description||'รายจ่ายร้าน',su:`${e.category} · ${e.method}`,a:parseFloat(e.amount||0),sg:'−'}));
    (Sal||[]).forEach(s=>ev.push({t:s.paid_date,i:'account_balance',bg:'#f5f3ff',c:'#8b5cf6',
      ti:'ตัดจ่ายเงินเดือน',su:'cash flow',a:parseFloat(s.net_paid||0),sg:'−'}));
  }
  ev.sort((a,b)=>new Date(b.t)-new Date(a.t));
  if(!ev.length){el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-tertiary);font-size:13px;"><i class="material-icons-round" style="font-size:32px;opacity:0.3;display:block;margin-bottom:8px;">inbox</i>ไม่พบรายการในหมวดหมู่นี้</div>`;return;}
  
  el.innerHTML=ev.slice(0,80).map((e,i)=>`
    <div class="v9-list-row" style="display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:0.5px solid var(--border-light); cursor:pointer; animation: v9FadeInUp 0.3s ease-out ${i*0.02}s both;">
      <div style="width:36px;height:36px;border-radius:10px;background:${e.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.02);">
        <i class="material-icons-round" style="font-size:18px;color:${e.c};">${e.i}</i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.ti}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">
          ${new Date(e.t).toLocaleDateString('th-TH',{day:'numeric',month:'short'})} ${new Date(e.t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} • ${e.su}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:14px;font-weight:800;letter-spacing:-0.3px;color:${e.cr?'#8b5cf6':e.sg==='+'?'#16a34a':'#ef4444'};">
          ${e.sg}฿${formatNum(Math.round(e.a))}</div>
        ${e.cr?`<div style="font-size:10px;font-weight:600;color:#8b5cf6;background:#f5f3ff;display:inline-block;padding:2px 6px;border-radius:4px;margin-top:2px;">ติดเครดิต</div>`:''}
      </div>
    </div>`).join('');
};

window.v9d44PL = function({tS,cogs,gP,gM,tEO,tEW,nP,nM}) {
  const el=document.getElementById('v9d44-pl-body');if(!el)return;
  const row=(l,v,c,bg,bold,sub,indent)=>`
    <div class="v9-list-row" style="display:flex;align-items:center;justify-content:space-between;
      padding:10px ${bg?'16px':'8px'};border-radius:${bg?'10px':'0'};margin-bottom:4px;
      background:${bg||'transparent'};${indent?'margin-left:24px; border-left:2px solid var(--border-light); padding-left:12px;':''}">
      <div>
        <div style="font-size:${bold?'14px':'13px'};font-weight:${bold?700:500};
          color:${bold?'var(--text-primary)':'var(--text-secondary)'};">${l}</div>
        ${sub?`<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">${sub}</div>`:''}
      </div>
      <div style="font-size:${bold?'16px':'14px'};font-weight:${bold?800:600};color:${c};letter-spacing:-0.3px;">
        ${v<0?'−':''}฿${formatNum(Math.abs(Math.round(v)))}</div>
    </div>`;

  el.innerHTML=
    row('ยอดขายรวมสุทธิ',tS,'#16a34a','#f0fdf4',true)
    +`<div style="font-size:11px;font-weight:600;color:var(--text-tertiary);padding:4px 8px;margin:4px 0;">หัก ต้นทุนขาย</div>`
    +row('ต้นทุนสินค้าขาย (COGS)',cogs,'#d97706','',false,'Cost × Qty จากรายการบิล',true)
    +`<hr style="border:none;border-top:1.5px dashed var(--border-light);margin:10px 0;">`
    +row('กำไรขั้นต้น (Gross Profit)',gP,gP>=0?'#0284c7':'#ef4444','#f0f9ff',true,`Gross Margin ${gM}%`)
    +`<div style="font-size:11px;font-weight:600;color:var(--text-tertiary);padding:4px 8px;margin:4px 0;">หัก ค่าใช้จ่ายดำเนินงาน (OPEX)</div>`
    +row('ค่าแรงรายวัน',tEW,'#ea580c','',false,'',true)
    +row('รายจ่ายจิปาถะร้าน',tEO,'#ef4444','',false,'',true)
    +`<div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:#6b7280;background:#f3f4f6;padding:8px 12px;border-radius:8px;margin:8px 0;">
        <i class="material-icons-round" style="font-size:14px;color:#9ca3af;">info</i>
        <span>ระบบไม่นำ 'เงินเดือน' มาหักซ้ำในหน้านี้ (ใช้คำนวณเฉพาะ Cash Flow)</span>
      </div>`
    +`<hr style="border:none;border-top:2px solid var(--border-light);margin:12px 0;">`
    +`<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;
        border-radius:14px;background:linear-gradient(135deg, ${nP>=0?'#15803d, #16a34a':'#b91c1c, #ef4444'}); color:white; box-shadow:0 6px 12px ${nP>=0?'rgba(22,163,74,0.2)':'rgba(239,68,68,0.2)'};">
        <div>
          <div style="font-size:16px;font-weight:800;">กำไรสุทธิ (Net Profit)</div>
          <div style="font-size:12px;font-weight:600;opacity:0.9;margin-top:4px;background:rgba(255,255,255,0.2);display:inline-block;padding:2px 8px;border-radius:999px;">Net Margin ${nM}%</div>
        </div>
        <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;">
          ${nP<0?'−':''}฿${formatNum(Math.abs(Math.round(nP)))}</div>
      </div>`;
};

window.v9d44Cash = function({tS,tP,tEW,tEO,tSal,nC}) {
  const el=document.getElementById('v9d44-cash-body');if(!el)return;
  const rows=[
    {l:'รับเงินจากยอดขาย',v:tS,c:'#16a34a',sg:'+',i:'payments', bg:'#f0fdf4'},
    {l:'จ่ายเงินซื้อสินค้าสต็อก',v:tP,c:'#d97706',sg:'−',i:'inventory_2', bg:'#fffbeb'},
    {l:'รายจ่ายจิปาถะ',v:tEO,c:'#ef4444',sg:'−',i:'receipt_long', bg:'#fef2f2'},
    {l:'จ่ายค่าแรงรายวัน',v:tEW,c:'#ea580c',sg:'−',i:'engineering', bg:'#fff7ed'},
    {l:'ตัดจ่ายเงินเดือน',v:tSal,c:'#8b5cf6',sg:'−',i:'account_balance_wallet',note:'กระทบกระแสเงินสด', bg:'#f5f3ff'},
  ];
  el.innerHTML=rows.map(r=>`
    <div class="v9-list-row" style="display:flex;align-items:center;justify-content:space-between;padding:12px 8px;border-bottom:0.5px solid var(--border-light);">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        <div style="width:32px;height:32px;border-radius:8px;background:${r.bg};display:flex;align-items:center;justify-content:center;">
          <i class="material-icons-round" style="font-size:16px;color:${r.c};">${r.i}</i>
        </div>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${r.l}</div>
          ${r.note?`<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">${r.note}</div>`:''}
        </div>
      </div>
      <span style="font-size:15px;font-weight:800;color:${r.c};letter-spacing:-0.3px;">${r.sg}฿${formatNum(Math.round(r.v))}</span>
    </div>`).join('')
  +`<div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;
      padding:18px 20px;border-radius:14px;background:linear-gradient(135deg, ${nC>=0?'#15803d, #16a34a':'#b91c1c, #ef4444'}); color:white; box-shadow:0 6px 12px ${nC>=0?'rgba(22,163,74,0.2)':'rgba(239,68,68,0.2)'};">
      <div>
        <div style="font-size:15px;font-weight:800;">เงินสดหมุนเวียนสุทธิ</div>
        <div style="font-size:11px;font-weight:600;opacity:0.9;margin-top:4px;background:rgba(255,255,255,0.2);display:inline-block;padding:2px 8px;border-radius:999px;">
          ${nC>=0?'<i class="material-icons-round" style="font-size:10px;vertical-align:middle;">arrow_upward</i> สภาพคล่องเป็นบวก':'<i class="material-icons-round" style="font-size:10px;vertical-align:middle;">arrow_downward</i> สภาพคล่องติดลบ'}
        </div>
      </div>
      <div style="font-size:26px;font-weight:800;letter-spacing:-0.5px;">
        ${nC<0?'−':''}฿${formatNum(Math.abs(Math.round(nC)))}</div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:#9a3412;background:#fff7ed;padding:10px 12px;border-radius:8px;margin-top:12px;border:1px solid #ffedd5;">
      <i class="material-icons-round" style="font-size:14px;color:#ea580c;">warning</i>
      <span>การซื้อสต็อกเยอะทำให้เงินสดลดลง แต่ไม่ได้แปลว่าขาดทุน (ให้ดูกำไรจริงที่หน้า P&amp;L)</span>
    </div>`;
};

window.v9d44Top = function(items) {
  const el=document.getElementById('v9d44-top');if(!el)return;
  const m={};
  items.forEach(i=>{
    if(!m[i.name])m[i.name]={q:0,t:0,pr:0};
    m[i.name].q+=parseFloat(i.qty||0);
    m[i.name].t+=parseFloat(i.total||0);
    m[i.name].pr+=(parseFloat(i.price||0)-parseFloat(i.cost||0))*parseFloat(i.qty||0);
  });
  const top=Object.entries(m).sort((a,b)=>b[1].t-a[1].t).slice(0,5);
  const mx=top[0]?.[1]?.t||1;
  if(!top.length){el.innerHTML=`<div style="font-size:13px;color:var(--text-tertiary);text-align:center;padding:20px;">ยังไม่มีข้อมูลการขาย</div>`;return;}
  
  el.innerHTML=top.map(([n,d],i)=>{
    const mg=d.t>0?Math.round(d.pr/d.t*100):0;
    return`<div class="v9-list-row" style="margin-bottom:16px; padding:4px; border-radius:8px; animation: v9FadeInUp 0.4s ease-out ${i*0.1}s both;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <span style="width:22px;height:22px;border-radius:6px;background:${i===0?'#fef08a':i===1?'#e5e7eb':i===2?'#fed7aa':'#f3f4f6'};color:${i===0?'#ca8a04':i===1?'#4b5563':i===2?'#c2410c':'#9ca3af'};
            display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">${i+1}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n}</span>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:13px;font-weight:800;color:var(--text-primary);">฿${formatNum(Math.round(d.t))}</div>
          <div style="font-size:10px;font-weight:600;color:${mg>0?'#16a34a':'#ef4444'};margin-top:1px;">กำไร ${mg}%</div>
        </div>
      </div>
      <div style="height:6px;background:var(--bg-base);border-radius:4px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);">
        <div class="v9-progress-bar" style="height:100%;background:linear-gradient(90deg, var(--primary) 0%, #60a5fa 100%);border-radius:4px;width:${Math.round(d.t/mx*100)}%;"></div>
      </div>
    </div>`;
  }).join('');
};