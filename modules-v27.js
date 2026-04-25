/* modules-v27.js — SK POS Denomination Popup + Payroll Fix */
/* ถ้าเห็นข้อความนี้ใน Console แปลว่าไฟล์โหลดสำเร็จ */
console.log('%c[v27] ✅ FILE LOADED SUCCESSFULLY','color:#fff;background:#dc2626;padding:4px 12px;border-radius:4px;font-size:14px;font-weight:900');

(function v27Boot(){
'use strict';

/* ─── Helpers ─── */
var fmt = function(n){ return typeof formatNum==='function' ? formatNum(n) : Number(n||0).toLocaleString('th-TH'); };

/* ─── Denominations ─── */
var BILLS = [
  {v:1000,l:'1,000',c:'#6b4c9a',bg:'#bda48d'},
  {v:500, l:'500',  c:'#9a25ae',bg:'#9a25ae'},
  {v:100, l:'100',  c:'#ba1a1a',bg:'#ba1a1a'},
  {v:50,  l:'50',   c:'#0061a4',bg:'#0061a4'},
  {v:20,  l:'20',   c:'#006e1c',bg:'#006e1c'}
];
var COINS = [
  {v:10,l:'10',c:'#FFB300',bg:'linear-gradient(135deg,#FFD54F,#FFB300)',bdr:'4px solid #CFD8DC'},
  {v:5, l:'5', c:'#90A4AE',bg:'linear-gradient(135deg,#CFD8DC,#90A4AE)',bdr:'2px solid #fff'},
  {v:2, l:'2', c:'#FBC02D',bg:'linear-gradient(135deg,#FFD54F,#FBC02D)',bdr:'2px solid rgba(255,255,255,0.5)'},
  {v:1, l:'1', c:'#B0BEC5',bg:'linear-gradient(135deg,#CFD8DC,#B0BEC5)',bdr:'2px solid rgba(255,255,255,0.5)'}
];
var ALL = BILLS.concat(COINS);

/* ═══════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════ */
var oldCss = document.getElementById('v27css');
if(oldCss) oldCss.remove();
var css = document.createElement('style');
css.id = 'v27css';
css.textContent = [
'.v27ov{position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:12px;animation:v27fi .25s ease}',
'@keyframes v27fi{from{opacity:0}to{opacity:1}}',
'.v27pop{background:#3e2723;padding:6px;border-radius:28px;box-shadow:0 24px 80px rgba(0,0,0,0.5);border:3px solid #2e150b;max-width:720px;width:100%;max-height:95vh;overflow:hidden;animation:v27su .3s cubic-bezier(.34,1.56,.64,1)}',
'@keyframes v27su{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}',
'.v27in{background:linear-gradient(180deg,#d7ccc8,#c4b5ab);border-radius:22px;padding:20px;overflow-y:auto;max-height:calc(95vh - 60px)}',
'.v27hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px}',
'.v27ht{font-size:18px;font-weight:900;color:#3e2723;display:flex;align-items:center;gap:8px}',
'.v27hs{font-size:12px;color:#5d4037cc}',
'.v27ha{font-size:28px;font-weight:900;color:#3e2723;letter-spacing:-1px}',
'.v27hl{font-size:11px;color:#5d4037aa;text-transform:uppercase;letter-spacing:1px}',
'.v27sc{display:flex;align-items:center;gap:10px;margin:14px 0 10px}',
'.v27sc h3{font-size:13px;font-weight:800;color:#4e342e;text-transform:uppercase;letter-spacing:2px;white-space:nowrap}',
'.v27sc .ln{flex:1;height:1px;background:#4e342e33}',
/* Bills grid */
'.v27bg{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}',
'@media(max-width:600px){.v27bg{grid-template-columns:repeat(3,1fr)}}',
'.v27bc{background:#efebe9;border-radius:16px;padding:10px 8px 8px;border-bottom:4px solid #a1887f;display:flex;flex-direction:column;align-items:center;position:relative;overflow:visible;cursor:pointer;transition:all .15s;box-shadow:inset 0 2px 4px rgba(0,0,0,0.06)}',
'.v27bc:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(0,0,0,0.1)}',
'.v27bc:active{transform:scale(0.96)}',
'.v27bc.mt{opacity:0.4;cursor:not-allowed;pointer-events:none}',
/* Clip */
'.v27cs{position:absolute;top:-2px;left:50%;transform:translateX(-50%);width:36px;height:8px;border-radius:3px 3px 0 0;z-index:20;background:radial-gradient(circle,#9e9e9e 30%,#424242 100%)}',
'.v27cl{position:absolute;top:1px;left:50%;transform:translateX(-50%);width:28px;height:70px;border-radius:999px;z-index:20;pointer-events:none;background:linear-gradient(145deg,#e0e0e0,#fff 40%,#bdbdbd 60%,#9e9e9e);box-shadow:0 4px 6px rgba(0,0,0,0.2),inset 0 1px 1px rgba(255,255,255,0.8)}',
'.v27cl::after{content:"";position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:14px;height:14px;background:rgba(0,0,0,0.1);border-radius:50%;filter:blur(1px)}',
/* Badge */
'.v27bd{position:absolute;top:4px;right:4px;min-width:22px;height:18px;border-radius:9px;font-size:10px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center;padding:0 5px;z-index:25}',
'.v27bd.z{opacity:0.5}',
/* Bill visual */
'.v27bv{width:100%;aspect-ratio:3/4;max-width:100px;border-radius:10px;display:flex;align-items:flex-end;justify-content:flex-end;padding:6px;position:relative;overflow:hidden;margin:8px 0 4px;box-shadow:0 6px 16px rgba(0,0,0,0.15);border:2px solid rgba(255,255,255,0.3)}',
'.v27bv::before{content:"";position:absolute;inset:0 0 auto 0;height:20%;background:rgba(255,255,255,0.12)}',
'.v27bv span{color:rgba(255,255,255,0.45);font-weight:900;font-size:20px;position:relative;z-index:1}',
'.v27bn{font-size:11px;font-weight:800;color:#5d4037;text-transform:uppercase}',
'.v27ba{font-size:9px;color:#5d4037aa;font-style:italic}',
/* Coins */
'.v27cg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}',
'@media(max-width:500px){.v27cg{grid-template-columns:repeat(2,1fr)}}',
'.v27cc{background:#efebe9;border-radius:14px;padding:10px 6px 8px;border-bottom:4px solid #a1887f;display:flex;flex-direction:column;align-items:center;position:relative;cursor:pointer;transition:all .15s}',
'.v27cc:hover{transform:translateY(-2px)}',
'.v27cc:active{transform:scale(0.96)}',
'.v27cc.mt{opacity:0.4;cursor:not-allowed;pointer-events:none}',
'.v27cv{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#fff;box-shadow:0 4px 10px rgba(0,0,0,0.2);margin-bottom:4px}',
/* Summary */
'.v27sb{background:#fff;border-radius:14px;padding:14px 18px;margin-top:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border:2px solid #e8e0dc}',
'.v27sb .lb{font-size:11px;color:#8d6e63;font-weight:600}',
'.v27sb .vl{font-size:24px;font-weight:900}',
/* Buttons */
'.v27bt{display:flex;gap:10px;margin-top:14px;justify-content:center;flex-wrap:wrap}',
'.v27b{padding:12px 28px;border-radius:14px;font-size:14px;font-weight:700;border:none;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;font-family:inherit}',
'.v27b:disabled{opacity:0.4;cursor:not-allowed}',
'.v27b.ca{background:#efebe9;color:#5d4037;border:2px solid #d7ccc8}',
'.v27b.nx{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 16px rgba(22,163,74,0.3)}',
'.v27b.cf{background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;box-shadow:0 4px 16px rgba(220,38,38,0.3)}',
/* Steps */
'.v27st{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px}',
'.v27sd{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}',
'.v27sd.ac{background:#dc2626;color:#fff;box-shadow:0 3px 10px rgba(220,38,38,0.3)}',
'.v27sd.dn{background:#16a34a;color:#fff}',
'.v27sd.pd{background:#d7ccc8;color:#8d6e63}',
'.v27sl{width:40px;height:2px;background:#d7ccc8}',
/* Payroll */
'.v27pc{background:#dcfce7;border:2px solid #86efac;border-radius:12px;padding:14px 18px;margin-bottom:16px;text-align:center}',
'/* --- Premium Banner CSS --- */',
'.v26-pay-banner { background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%); border-radius: 24px; padding: 32px 40px; color: #fff; margin-bottom: 24px; position: relative; overflow: hidden; box-shadow: 0 16px 32px -8px rgba(220, 38, 38, 0.4); border: 1px solid rgba(255, 255, 255, 0.2); }',
'.v26-pay-banner::before { content: ""; position: absolute; top: -50px; right: -30px; width: 180px; height: 180px; border-radius: 50%; background: rgba(255,255,255,0.1); filter: blur(20px); }',
'.v26-pay-inner { display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 2; gap: 32px; }',
'.v26-pay-left { display: flex; align-items: center; gap: 24px; }',
'.v26-back-btn { background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); color: #fff; padding: 12px 20px; border-radius: 14px; cursor: pointer; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(8px); transition: all 0.3s; font-family: inherit; }',
'.v26-back-btn:hover { background: #fff; color: #dc2626; transform: translateX(-5px); }',
'.v26-pay-title-wrap h2 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; display: flex; align-items: center; gap: 10px; }',
'.v26-pay-month { font-size: 14px; opacity: 0.8; font-weight: 500; margin-top: 4px; }',
'.v26-total-box { background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.2); padding: 16px 28px; border-radius: 20px; text-align: right; backdrop-filter: blur(10px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }',
'.v26-total-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.8; margin-bottom: 4px; }',
'.v26-total-value { font-size: 32px; font-weight: 900; }',
'.v26-salary-card { background: linear-gradient(135deg, #ffffff 0%, #fdf4ff 100%); border-radius: 28px; padding: 24px; border: 1px solid #fae8ff; cursor: pointer; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 4px 12px rgba(192, 38, 211, 0.05); }',
'.v26-salary-card:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 20px 40px rgba(192, 38, 211, 0.15); border-color: #d946ef55; }',
'.v26-avatar { width: 54px; height: 54px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: #fff; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; box-shadow: 0 8px 16px rgba(220, 38, 38, 0.25); border: 2px solid #fff; }',
'.v26-summary-deduct { background: #fff1f2; border: 1.5px dashed #fecdd3; border-radius: 16px; padding: 16px; margin: 16px 0; display: flex; justify-content: space-between; align-items: center; }',
'.v26-summary-label { color: #be123c; font-size: 13px; font-weight: 700; }',
'.v26-summary-val { color: #be123c; font-size: 20px; font-weight: 900; }',
'.v26-salary-card.paid { border-left: 5px solid #16a34a; }',
'.v26-salary-card.pending { border-left: 5px solid #dc2626; }',
'.v26-card-glow { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(220, 38, 38, 0.03) 0%, transparent 70%); opacity: 0; transition: opacity 0.3s; pointer-events: none; }',
'.v26-salary-card:hover .v26-card-glow { opacity: 1; }',
'.v26-card-header { display: flex; align-items: center; gap: 14px; position: relative; }',
'.v26-emp-info { flex: 1; }',
'.v26-emp-name { font-weight: 800; font-size: 16px; color: #1e293b; }',
'.v26-emp-pos { font-size: 12px; color: #64748b; font-weight: 500; }',
'.v26-paid-badge { background: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 8px; display: flex; align-items: center; gap: 4px; text-transform: uppercase; }',
'.v26-card-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 12px; }',
'.v26-stat-label { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }',
'.v26-stat-val { font-size: 15px; font-weight: 800; color: #334155; }',
'.v26-stat-val.warning { color: #d97706; }',
'.v26-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 12px; border-top: 1px dashed #e2e8f0; }',
'.v26-footer-label { font-size: 11px; font-weight: 700; color: #64748b; }',
'.v26-footer-val { font-size: 20px; font-weight: 900; color: #dc2626; }',
'.v26-salary-card.paid .v26-footer-val { color: #16a34a; }',
'.v26-arrow { color: #cbd5e1; transition: transform 0.3s; }',
'.v26-salary-card:hover .v26-arrow { transform: translateX(4px); color: #dc2626; }',
'@media (max-width: 768px) { .v26-pay-inner { flex-direction: column; text-align: center; gap: 20px; } .v26-pay-left { flex-direction: column; gap: 16px; } .v26-total-box { text-align: center; width: 100%; } }'
].join('\n');
document.head.appendChild(css);
console.log('[v27] CSS injected');


/* ═══════════════════════════════════════════════════════════════
   DRAWER STATE
═══════════════════════════════════════════════════════════════ */
function loadDrawer(){
  var drawer = {}; ALL.forEach(function(d){drawer[d.v]=0;});
  return db.from('cash_session').select('*').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle()
  .then(function(r){
    var sess = r.data; if(!sess) return drawer;
    var od = sess.opening_denominations || sess.denominations || {};
    Object.keys(od).forEach(function(k){var n=Number(k);if(drawer[n]!==undefined) drawer[n]+=Number(od[k])||0;});
    return db.from('cash_transaction').select('direction,denominations,change_denominations,change_amt').eq('session_id',sess.id)
    .then(function(r2){
      (r2.data||[]).forEach(function(tx){
        var dir=tx.direction==='in'?1:-1;
        var den=tx.denominations||{}, chg=tx.change_denominations||{};
        if(!Object.values(chg).some(function(x){return x>0;})){
          var ca=Number(tx.change_amt||0);
          if(ca>0 && typeof calcChangeDenominations==='function') chg=calcChangeDenominations(ca);
        }
        ALL.forEach(function(d){
          drawer[d.v]+=dir*(Number(den[d.v]||0));
          if(tx.direction==='in') drawer[d.v]-=Number(chg[d.v]||0);
          else drawer[d.v]+=Number(chg[d.v]||0);
        });
      });
      ALL.forEach(function(d){if(drawer[d.v]<0) drawer[d.v]=0;});
      return drawer;
    });
  }).catch(function(e){console.warn('[v27] drawer:',e); return drawer;});
}


/* ═══════════════════════════════════════════════════════════════
   CARD RENDERERS
═══════════════════════════════════════════════════════════════ */
function billCard(d,cnt,avail){
  var ha=avail!==null&&avail!==undefined;
  var empty=ha&&avail<=0;
  return '<div class="v27bc'+(empty?' mt':'')+'" data-v="'+d.v+'">'
    +'<div class="v27cs"></div><div class="v27cl"></div>'
    +'<div class="v27bd'+(cnt===0?' z':'')+'" style="background:'+d.c+';">'+(cnt>0?cnt:'0')+'</div>'
    +'<div class="v27bv" style="background:'+d.bg+';"><span>'+d.v+'</span></div>'
    +'<div class="v27bn">฿'+d.l+'</div>'
    +(ha?'<div class="v27ba">'+(empty?'หมด':avail+' ใบ')+'</div>':'')
    +'</div>';
}
function coinCard(d,cnt,avail){
  var ha=avail!==null&&avail!==undefined;
  var empty=ha&&avail<=0;
  return '<div class="v27cc'+(empty?' mt':'')+'" data-v="'+d.v+'">'
    +'<div class="v27bd'+(cnt===0?' z':'')+'" style="background:#4e342e;">'+(cnt>0?cnt:'0')+'</div>'
    +'<div class="v27cv" style="background:'+d.bg+';'+(d.bdr?'border:'+d.bdr:'')+'">'+d.l+'</div>'
    +'<div class="v27bn">฿'+d.l+'</div>'
    +(ha?'<div class="v27ba">'+(empty?'หมด':avail+'x')+'</div>':'')
    +'</div>';
}
function bindCards(ov,evt){
  ov.querySelectorAll('.v27bc:not(.mt),.v27cc:not(.mt)').forEach(function(el){
    var val=Number(el.dataset.v);
    el.onclick=function(){document.dispatchEvent(new CustomEvent(evt,{detail:{a:'add',v:val}}));};
    el.oncontextmenu=function(e){e.preventDefault();document.dispatchEvent(new CustomEvent(evt,{detail:{a:'rem',v:val}}));};
  });
}


/* ═══════════════════════════════════════════════════════════════
   V27-1a: CHECKOUT SELL WIZARD (2-step popup)
═══════════════════════════════════════════════════════════════ */
window.v12S5 = function(container){
  if(!container) return;
  var payAmt = v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total;
  container.innerHTML = '<h2 class="v12-step-title">💵 รับเงินสด</h2>'
    +'<p class="v12-step-subtitle">กดปุ่มด้านล่างเพื่อเปิดหน้านับแบงค์</p>'
    +'<div style="text-align:center;padding:30px 0;">'
    +'<div style="font-size:14px;color:var(--text-muted);">ยอดที่ต้องรับ</div>'
    +'<div style="font-size:36px;font-weight:900;color:var(--primary);margin:8px 0;">฿'+fmt(payAmt)+'</div>'
    +'<button onclick="v27SellWiz()" style="padding:16px 40px;border-radius:16px;border:none;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 8px 24px rgba(220,38,38,0.3);display:inline-flex;align-items:center;gap:10px;font-family:inherit;">'
    +'<i class="material-icons-round" style="font-size:24px;">payments</i> เปิดลิ้นชักนับเงิน</button>'
    +'<div id="v27ss" style="margin-top:16px;font-size:14px;color:var(--text-muted);"></div></div>';
  setTimeout(function(){ window.v27SellWiz(); },300);
};
console.log('[v27] v12S5 overridden');

window.v27SellWiz = function(){
  var payAmt = v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total;
  loadDrawer().then(function(drawer){
    var st={step:1,recv:{},chg:{}};
    ALL.forEach(function(d){st.recv[d.v]=0;st.chg[d.v]=0;});
    if(v12State.receivedDenominations) ALL.forEach(function(d){st.recv[d.v]=v12State.receivedDenominations[d.v]||0;});

    var old=document.getElementById('v27so'); if(old) old.remove();
    var ov=document.createElement('div'); ov.id='v27so'; ov.className='v27ov';

    function rT(){var s=0;ALL.forEach(function(d){s+=d.v*(st.recv[d.v]||0);});return s;}
    function cT(){var s=0;ALL.forEach(function(d){s+=d.v*(st.chg[d.v]||0);});return s;}

    function render(){
      var recv=rT(), cn=Math.max(0,recv-payAmt), cg=cT();
      var enough=recv>=payAmt, cd=cn<=0||Math.abs(cn-cg)<0.01;

      if(st.step===1){
        ov.innerHTML='<div class="v27pop"><div class="v27in">'
          +'<div class="v27st"><div class="v27sd ac">1</div><div class="v27sl"></div><div class="v27sd pd">2</div></div>'
          +'<div class="v27hdr"><div><div class="v27ht"><i class="material-icons-round">shopping_cart</i> รับเงินจากลูกค้า</div><div class="v27hs">กดที่แบงค์/เหรียญเพื่อนับ · กดค้างเพื่อลบ</div></div>'
          +'<div style="text-align:right;"><div class="v27hl">ยอดสินค้า</div><div class="v27ha">฿'+fmt(payAmt)+'</div></div></div>'
          +'<div class="v27sc"><h3>💵 ธนบัตรที่รับ</h3><div class="ln"></div></div>'
          +'<div class="v27bg">'+BILLS.map(function(d){return billCard(d,st.recv[d.v],null);}).join('')+'</div>'
          +'<div class="v27sc"><h3>🪙 เหรียญที่รับ</h3><div class="ln"></div></div>'
          +'<div class="v27cg">'+COINS.map(function(d){return coinCard(d,st.recv[d.v],null);}).join('')+'</div>'
          +'<div class="v27sb"><div><div class="lb">รับมาแล้ว</div><div class="vl" style="color:'+(enough?'#16a34a':'#3e2723')+';">฿'+fmt(recv)+'</div></div>'
          +'<div style="text-align:right;"><div class="lb">'+(enough?'เงินทอน':'ยังขาด')+'</div><div class="vl" style="color:'+(enough?'#d97706':'#ef4444')+';">฿'+fmt(enough?cn:payAmt-recv)+'</div></div></div>'
          +'<div class="v27bt">'
          +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v27s\',{detail:{a:\'x\'}}))"><i class="material-icons-round">close</i> ยกเลิก</button>'
          +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v27s\',{detail:{a:\'r1\'}}))"><i class="material-icons-round">refresh</i> ล้าง</button>'
          +(enough?'<button class="v27b nx" onclick="document.dispatchEvent(new CustomEvent(\'v27s\',{detail:{a:\'n\'}}))"><i class="material-icons-round">arrow_forward</i> ถัดไป — ทอน ฿'+fmt(cn)+'</button>':'')
          +'</div></div></div>';
      } else {
        ov.innerHTML='<div class="v27pop"><div class="v27in">'
          +'<div class="v27st"><div class="v27sd dn">✓</div><div class="v27sl" style="background:#16a34a;"></div><div class="v27sd ac">2</div></div>'
          +'<div class="v27hdr"><div><div class="v27ht"><i class="material-icons-round">payments</i> นับเงินทอน</div><div class="v27hs">เลือกแบงค์/เหรียญจากลิ้นชักที่จะทอนให้ลูกค้า</div></div>'
          +'<div style="text-align:right;"><div class="v27hl">ต้องทอน</div><div class="v27ha" style="color:#d97706;">฿'+fmt(cn)+'</div></div></div>'
          +'<div class="v27sc"><h3>💵 ธนบัตรในลิ้นชัก</h3><div class="ln"></div></div>'
          +'<div class="v27bg">'+BILLS.map(function(d){return billCard(d,st.chg[d.v],drawer[d.v]||0);}).join('')+'</div>'
          +'<div class="v27sc"><h3>🪙 เหรียญในลิ้นชัก</h3><div class="ln"></div></div>'
          +'<div class="v27cg">'+COINS.map(function(d){return coinCard(d,st.chg[d.v],drawer[d.v]||0);}).join('')+'</div>'
          +'<div class="v27sb"><div><div class="lb">นับทอนแล้ว</div><div class="vl" style="color:'+(cd?'#16a34a':'#d97706')+';">฿'+fmt(cg)+'</div></div>'
          +'<div style="text-align:right;">'+(cd?'<div style="color:#16a34a;font-weight:800;font-size:15px;">✅ ครบแล้ว!</div>'
          :'<div class="lb">ยังขาด</div><div class="vl" style="color:#ef4444;">฿'+fmt(cn-cg)+'</div>')+'</div></div>'
          +'<div class="v27bt">'
          +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v27s\',{detail:{a:\'b\'}}))"><i class="material-icons-round">arrow_back</i> ย้อนกลับ</button>'
          +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v27s\',{detail:{a:\'r2\'}}))"><i class="material-icons-round">refresh</i> ล้าง</button>'
          +'<button class="v27b cf" '+(cd?'':'disabled')+' onclick="document.dispatchEvent(new CustomEvent(\'v27s\',{detail:{a:\'ok\'}}))"><i class="material-icons-round">check_circle</i> ยืนยัน — ทอน ฿'+fmt(cn)+'</button>'
          +'</div></div></div>';
      }
      bindCards(ov,'v27s');
    }

    function handle(e){
      var a=e.detail.a, v=e.detail.v;
      if(a==='x'){done();return;}
      if(a==='r1') ALL.forEach(function(d){st.recv[d.v]=0;});
      if(a==='r2') ALL.forEach(function(d){st.chg[d.v]=0;});
      if(a==='n') st.step=2;
      if(a==='b') st.step=1;
      if(a==='add'){
        if(st.step===1) st.recv[v]=(st.recv[v]||0)+1;
        else{ if((st.chg[v]||0)<(drawer[v]||0)) st.chg[v]=(st.chg[v]||0)+1; }
      }
      if(a==='rem'){
        if(st.step===1){if((st.recv[v]||0)>0) st.recv[v]--;}
        else{if((st.chg[v]||0)>0) st.chg[v]--;}
      }
      if(a==='ok'){
        v12State.receivedDenominations=Object.assign({},st.recv);
        v12State.changeDenominations=Object.assign({},st.chg);
        v12State.received=rT();
        v12State.change=rT()-payAmt;
        if(window.v14State) window.v14State.changeGiven=Object.assign({},st.chg);
        done();
        var ss=document.getElementById('v27ss');
        if(ss) ss.innerHTML='<div style="color:#16a34a;font-weight:700;">✅ รับ ฿'+fmt(v12State.received)+' ทอน ฿'+fmt(v12State.change)+'</div>';
        var nb=document.getElementById('v12-next-btn');
        if(nb){nb.disabled=false;nb.className='v12-btn-next green';nb.innerHTML='<i class="material-icons-round">check</i> ยืนยัน — ทอน ฿'+fmt(v12State.change);}
        if(typeof _v24CalcAndSendCash==='function') _v24CalcAndSendCash();
        return;
      }
      render();
    }
    function done(){document.removeEventListener('v27s',handle);ov.remove();}
    document.addEventListener('v27s',handle);
    render(); document.body.appendChild(ov);
  });
};


/* ═══════════════════════════════════════════════════════════════
   V27-1b: GENERIC WIZARD (openDenomWizard + v26StartCashWizard)
═══════════════════════════════════════════════════════════════ */
function genWiz(opts){
  var title=opts.title||'นับเงิน', target=opts.target||0, exact=opts.exact||false;
  var dir=opts.dir||'in', drw=opts.drw, onOk=opts.onOk, onNo=opts.onNo;
  var show=!!drw;
  var old=document.getElementById('v27go'); if(old) old.remove();
  var st={}; ALL.forEach(function(d){st[d.v]=0;});
  var ov=document.createElement('div'); ov.id='v27go'; ov.className='v27ov';

  function gT(){var s=0;ALL.forEach(function(d){s+=d.v*(st[d.v]||0);});return s;}

  function render(){
    var total=gT();
    var ok=target<=0||(exact?Math.abs(total-target)<0.01:total>=target);
    var can=total>0&&(target<=0||ok);
    ov.innerHTML='<div class="v27pop"><div class="v27in">'
      +'<div class="v27hdr"><div><div class="v27ht"><i class="material-icons-round">'+(dir==='out'?'arrow_upward':'arrow_downward')+'</i> '+title+'</div>'
      +'<div class="v27hs">'+(exact?'ต้องนับให้พอดียอดเป้าหมาย':'กดแบงค์/เหรียญเพื่อนับ · กดค้างเพื่อลบ')+'</div></div>'
      +(target>0?'<div style="text-align:right;"><div class="v27hl">ยอดเป้าหมาย</div><div class="v27ha">฿'+fmt(target)+'</div></div>':'')+'</div>'
      +'<div class="v27sc"><h3>💵 ธนบัตร'+(show?'ในลิ้นชัก':'')+'</h3><div class="ln"></div></div>'
      +'<div class="v27bg">'+BILLS.map(function(d){return billCard(d,st[d.v],show?drw[d.v]:null);}).join('')+'</div>'
      +'<div class="v27sc"><h3>🪙 เหรียญ'+(show?'ในลิ้นชัก':'')+'</h3><div class="ln"></div></div>'
      +'<div class="v27cg">'+COINS.map(function(d){return coinCard(d,st[d.v],show?drw[d.v]:null);}).join('')+'</div>'
      +'<div class="v27sb"><div><div class="lb">รวมที่นับ</div><div class="vl" style="color:'+(can?'#16a34a':'#3e2723')+';">฿'+fmt(total)+'</div></div>'
      +(target>0?'<div style="text-align:right;">'+(ok?'<div style="color:#16a34a;font-weight:800;">✅ '+(exact?'พอดี!':'พร้อม')+'</div>'
      :'<div class="lb">'+(exact&&total>target?'เกิน':'ขาด')+'</div><div class="vl" style="color:#ef4444;">฿'+fmt(Math.abs(target-total))+'</div>')+'</div>':'')+'</div>'
      +'<div class="v27bt">'
      +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v27g\',{detail:{a:\'x\'}}))"><i class="material-icons-round">close</i> ยกเลิก</button>'
      +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v27g\',{detail:{a:\'r\'}}))"><i class="material-icons-round">refresh</i> ล้าง</button>'
      +'<button class="v27b '+(dir==='out'?'cf':'nx')+'" '+(can?'':'disabled')+' onclick="document.dispatchEvent(new CustomEvent(\'v27g\',{detail:{a:\'ok\'}}))"><i class="material-icons-round">check_circle</i> ยืนยัน</button>'
      +'</div></div></div>';
    bindCards(ov,'v27g');
  }

  function handle(e){
    var a=e.detail.a, v=e.detail.v;
    if(a==='x'){done();if(onNo)onNo();return;}
    if(a==='r') ALL.forEach(function(d){st[d.v]=0;});
    if(a==='add'){if(show&&(st[v]||0)>=(drw[v]||0)){render();return;} st[v]=(st[v]||0)+1;}
    if(a==='rem'){if((st[v]||0)>0) st[v]--;}
    if(a==='ok'){done();if(onOk)onOk(st,gT());return;}
    render();
  }
  function done(){document.removeEventListener('v27g',handle);ov.remove();}
  document.addEventListener('v27g',handle);
  render(); document.body.appendChild(ov);
}

window.openDenomWizard = function(opts){
  loadDrawer().then(function(drawer){
    var isOut=(opts.label||'').indexOf('จ่าย')>=0||(opts.label||'').indexOf('เบิก')>=0;
    genWiz({title:opts.label,target:opts.targetAmount||0,exact:opts.mustExact||false,
      dir:isOut?'out':'in',drw:isOut?drawer:null,
      onOk:function(ds,t){if(opts.onConfirm)opts.onConfirm(ds,t);},
      onNo:function(){if(opts.onCancel)opts.onCancel();}
    });
  });
};
console.log('[v27] openDenomWizard overridden');

window.v26StartCashWizard = function(opts){
  loadDrawer().then(function(drawer){
    genWiz({title:opts.title||'จ่ายเงินสด',target:opts.targetAmount||0,exact:opts.mustBeExact||false,
      dir:'out',drw:drawer,
      onOk:function(ds){if(opts.onConfirm)opts.onConfirm(ds);},
      onNo:function(){}
    });
  });
};
console.log('[v27] v26StartCashWizard overridden');


/* ═══════════════════════════════════════════════════════════════
   V27-2: FIX v26ShowPayDetail — pd is not defined
═══════════════════════════════════════════════════════════════ */
window.v26ShowPayDetail = function(eid){
  var wrap=document.getElementById('v26-pay-detail-wrap'); if(!wrap||!eid) return;
  var grid=document.getElementById('v26-pay-grid'); if(grid) grid.style.display='none';
  wrap.style.display='block';
  var s=window._v26Pay?window._v26Pay.find(function(x){return x.emp.id===eid;}):null;
  if(!s) return;
  var emp=s.emp, earn=s.earn||0;
  var pastPays=s.pastPays||[];
  var sumPN=s.sumPaidNet||0, sumPD=s.sumPaidWithdraw||0, sumTD=s.sumTotalDeduct||0;
  var remaining=Math.max(0,earn-sumPN-sumPD-sumTD);
  var totalAdv=s.taGross||0, debtLeft=Math.max(0,totalAdv-sumPD);

  wrap.innerHTML='<button onclick="v26HidePayDetail()" style="margin-bottom:20px;background:#e2e8f0;color:#475569;border:none;padding:10px 20px;border-radius:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;">'
    +'<i class="material-icons-round">arrow_back</i> กลับ</button>'
    +'<div class="v26-pay-detail" style="cursor:default;margin-bottom:24px;">'
    +'<div class="v26-pay-detail-head"><div style="display:flex;align-items:center;justify-content:center;gap:12px;">'
    +'<div class="v26-avatar" style="width:64px;height:64px;font-size:32px;">'+(s.emoji||'👤')+'</div>'
    +'<div><div style="font-size:20px;font-weight:800;">'+emp.name+' '+(emp.lastname||'')+'</div>'
    +'<div style="font-size:13px;color:#64748b;">'+(emp.position||'')+'</div></div></div></div>'
    +'<div class="v26-pay-detail-body">'
    +(pastPays.length>0?'<div class="v27ph"><h4>⚠️ เดือนนี้จ่ายไปแล้ว '+pastPays.length+' ครั้ง (รวม ฿'+fmt(sumPN)+')</h4>'
      +pastPays.map(function(p,i){return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #fcd34d;font-size:13px;">'
        +'<span>ครั้งที่ '+(i+1)+' · '+new Date(p.paid_date).toLocaleDateString('th-TH')+'</span>'
        +'<strong style="color:#16a34a;">฿'+fmt(p.net_paid)+'</strong></div>';}).join('')+'</div>':'')
    +'<div class="v27pc"><div style="font-size:12px;color:#166534;">เพดานยอดเงินเดือนคงเหลือ</div>'
    +'<div style="font-size:26px;font-weight:900;color:'+(remaining>0?'#16a34a':'#dc2626')+';">฿'+fmt(remaining)+'</div></div>'
    +'<div class="v26-pr"><span>วันทำงาน</span><strong>'+(s.wd||0)+' วัน</strong></div>'
    +'<div class="v26-pr"><span>ค่าจ้างสะสม</span><strong style="color:#3b82f6;">฿'+fmt(earn)+'</strong></div>'
    +'<div class="v26-pr"><span>เบิกล่วงหน้าเดือนนี้</span><strong style="color:#d97706;">฿'+fmt(totalAdv)+'</strong></div>'
    +'<div class="v26-pr" style="background:#fff7ed; border-radius:8px; padding:4px 8px;"><span>หนี้เบิกที่เหลือ</span><strong style="color:#c2410c;">฿'+fmt(debtLeft)+'</strong></div>'
    +'<div class="v26-pr total"><span>เพดานจ่ายได้</span><strong style="color:#16a34a;">฿'+fmt(remaining)+'</strong></div>'
    +'<div class="v26-summary-deduct">'
    +'<div class="v26-summary-label">รวมหักเงินสะสมครั้งนี้</div>'
    +'<div class="v26-summary-val" id="v26-sum-d-'+eid+'">฿0</div>'
    +'</div>'
    +'<div class="v26-fields" style="margin-top:18px;">'
    +'<div class="v26-field"><label>ยอดจ่ายสุทธิ (฿)</label><input type="number" id="v26r-'+eid+'" value="'+(remaining>0?remaining:0)+'" min="0" oninput="v27PV(\''+eid+'\','+earn+','+(sumPN+sumPD+sumTD)+','+debtLeft+')"></div>'
    +'<div class="v26-field"><label>หักหนี้เบิก (Max: '+fmt(debtLeft)+')</label><input type="number" id="v26d-'+eid+'" value="0" min="0" max="'+debtLeft+'" oninput="v27PV(\''+eid+'\','+earn+','+(sumPN+sumPD+sumTD)+','+debtLeft+')"></div>'
    +'<div class="v26-field"><label>หักประกันสังคม</label><input type="number" id="v26s-'+eid+'" value="0" min="0" oninput="v27PV(\''+eid+'\','+earn+','+(sumPN+sumPD+sumTD)+','+debtLeft+')"></div>'
    +'<div class="v26-field"><label>หักอื่นๆ</label><input type="number" id="v26o-'+eid+'" value="0" min="0" oninput="v27PV(\''+eid+'\','+earn+','+(sumPN+sumPD+sumTD)+','+debtLeft+')"></div></div>'
    +'<div class="v26-field" style="margin-top:10px;"><label>หมายเหตุหักอื่นๆ</label><input type="text" id="v26on-'+eid+'" placeholder="ระบุเหตุผล..." style="width:100%;padding:10px 14px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:15px;font-family:inherit;"></div>'
    +'<div class="v26-vmsg" id="v26vm-'+eid+'" style="margin-top:12px;padding:10px;border-radius:8px;font-size:13px;"></div>'
    +'<div class="v26-fields" style="margin-top:14px;">'
    +'<div class="v26-field"><label>วิธีจ่าย</label><select id="v26m-'+eid+'" style="width:100%;padding:10px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:15px;font-family:inherit;"><option value="เงินสด">เงินสด</option><option value="โอนเงิน">โอนเงิน</option></select></div>'
    +'<div class="v26-field"><label>หมายเหตุ</label><input type="text" id="v26pn-'+eid+'" placeholder="" style="width:100%;padding:10px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:15px;font-family:inherit;"></div></div>'
    +'<button class="v26-pay-confirm" id="v26pb-'+eid+'" onclick="v26DoPay(\''+eid+'\')" style="width:100%;margin-top:16px;padding:16px;border:none;border-radius:14px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;font-size:16px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;">'
    +'<i class="material-icons-round">payments</i> ยืนยันจ่ายเงินเดือน</button></div></div>';
  v27PV(eid,earn,sumPN+sumPD+sumTD);
};
console.log('[v27] v26ShowPayDetail overridden (pd fix)');

window.v27PV = function(eid,gross,used,debtLimit){
  var r=Number(document.getElementById('v26r-'+eid)?.value||0);
  var d=Number(document.getElementById('v26d-'+eid)?.value||0);
  var ss=Number(document.getElementById('v26s-'+eid)?.value||0);
  var o=Number(document.getElementById('v26o-'+eid)?.value||0);
  
  if(d > debtLimit) {
    d = debtLimit;
    var dInput = document.getElementById('v26d-'+eid);
    if(dInput) dInput.value = d;
  }

  var sumD = d + ss + o;
  var sumDEl = document.getElementById('v26-sum-d-'+eid);
  if(sumDEl) sumDEl.innerText = '฿' + fmt(sumD);

  var t=r+sumD, left=gross-used;
  var el=document.getElementById('v26vm-'+eid), btn=document.getElementById('v26pb-'+eid);
  if(r<0||d<0||ss<0||o<0){if(el){el.style.background='#fee2e2';el.style.color='#dc2626';el.innerHTML='❌ ห้ามค่าติดลบ';}if(btn)btn.disabled=true;}
  else if(t>gross){if(el){el.style.background='#fef3c7';el.style.color='#92400e';el.innerHTML='⚠️ เกินยอดสะสม — ยังจ่ายได้';}if(btn)btn.disabled=false;}
  else{if(el){el.style.background='#dcfce7';el.style.color='#16a34a';el.innerHTML='✅ รับ ฿'+fmt(r)+' | หัก ฿'+fmt(d+ss+o)+' | เหลือ ฿'+fmt(Math.max(0,left-t));}if(btn)btn.disabled=false;}
};

/* Override renderPayroll to include pastPays */
window.renderPayroll = window.renderPayrollV26 = function(){
  var sec=document.getElementById('page-att'); if(!sec) return;
  var now=new Date(),ms=new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0];
  var me=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().split('T')[0];
  var ml=now.toLocaleDateString('th-TH',{month:'long',year:'numeric'});
  return Promise.all([
    loadEmployees(),
    db.from('เช็คชื่อ').select('*').gte('date',ms).lte('date',me),
    db.from('เบิกเงิน').select('*').eq('status','อนุมัติ').gte('date',ms+'T00:00:00'),
    db.from('จ่ายเงินเดือน').select('*').eq('month',ms).order('paid_date',{ascending:true})
  ]).then(function(results){
    var emps=(results[0]||[]).filter(function(e){return e.status==='ทำงาน';});
    var att=results[1].data||[], adv=results[2].data||[], paid=results[3].data||[];
    var emojis = ['👨‍💼','👩‍💼','🧑‍🔧','👨‍🔬','👩‍🍳','👨‍🎤','👩‍🎨','👨‍🚀','👨‍🚒','👮','🕵️','🤵'];
    window._v26Pay=emps.map(function(emp){
      var ma=att.filter(function(a){return a.employee_id===emp.id;});
      var wd=ma.filter(function(a){return a.status!=='ขาด'&&a.status!=='ลา';}).length;
      var td=ma.reduce(function(s,a){return s+(a.deduction||0);},0);
      var earn=emp.pay_type==='รายเดือน'?(emp.salary||0)-td:(wd*(emp.daily_wage||0))-td;
      var myA=adv.filter(function(a){return a.employee_id===emp.id;});
      var taGross=myA.reduce(function(s,a){return s+a.amount;},0);
      var pastPays=paid.filter(function(p){return p.employee_id===emp.id;});
      var sumPaidNet=pastPays.reduce(function(s,p){return s+(p.net_paid||0);},0);
      var sumPaidWithdraw=pastPays.reduce(function(s,p){return s+(p.deduct_withdraw||0);},0);
      var sumTotalDeduct=pastPays.reduce(function(s,p){return s+(p.deduct_absent||0)+(p.deduct_ss||0)+(p.deduct_other||0);},0);
      var net=Math.max(0,earn-sumPaidNet-sumPaidWithdraw-sumTotalDeduct);
      var emoji=emojis[emp.id.charCodeAt(0) % emojis.length];
      return{emp:emp,wd:wd,td:td,earn:earn,taGross:taGross,net:net,pastPays:pastPays,sumPaidNet:sumPaidNet,sumPaidWithdraw:sumPaidWithdraw,sumTotalDeduct:sumTotalDeduct,paidCount:pastPays.length,emoji:emoji};
    });
    var totalNet=window._v26Pay.reduce(function(s,x){return s+x.net;},0);
    var emojis = ['💰','💸','🏦','💎','💵','💴','💶','💷','🪙','💳','📈','🎯'];
    var randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    sec.innerHTML='<div style="max-width:1000px;margin:0 auto;padding:0 8px;">'
      +'<div class="v26-pay-banner">'
        +'<div class="v26-pay-inner">'
          +'<div class="v26-pay-left">'
            +'<button class="v26-back-btn" onclick="renderAttendance()"><i class="material-icons-round">arrow_back</i> กลับเช็คชื่อ</button>'
            +'<div class="v26-pay-title-wrap">'
              +'<h2>'+randomEmoji+' จ่ายเงินเดือน</h2>'
              +'<div class="v26-pay-month">'+ml+'</div>'
            +'</div>'
          +'</div>'
          +'<div class="v26-pay-right">'
            +'<div class="v26-total-box">'
              +'<div class="v26-total-label">ยอดรวมค้างจ่ายสะสม</div>'
              +'<div class="v26-total-value">฿'+fmt(totalNet)+'</div>'
            +'</div>'
          +'</div>'
        +'</div>'
      +'</div>'
      +'<div id="v26-pay-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;margin-top:8px;">'
      +window._v26Pay.map(function(s){
        var isPaid=s.paidCount>0;
        return '<div onclick="v26ShowPayDetail(\''+s.emp.id+'\')" class="v26-salary-card '+(isPaid?'paid':'pending')+'">'
          +'<div class="v26-card-glow"></div>'
          +'<div class="v26-card-header">'
            +'<div class="v26-avatar">'+s.emoji+'</div>'
            +'<div class="v26-emp-info">'
              +'<div class="v26-emp-name">'+s.emp.name+' '+(s.emp.lastname||'')+'</div>'
              +'<div class="v26-emp-pos">'+(s.emp.position||'พนักงาน')+'</div>'
            +'</div>'
            +(isPaid?'<div class="v26-paid-badge"><i class="material-icons-round">check_circle</i> จ่ายแล้ว</div>':'')
          +'</div>'
          +'<div class="v26-card-stats">'
            +'<div class="v26-stat-item">'
              +'<div class="v26-stat-label">สะสมเดือนนี้</div>'
              +'<div class="v26-stat-val">฿'+fmt(s.earn)+'</div>'
            +'</div>'
            +'<div class="v26-stat-item">'
              +'<div class="v26-stat-label">เบิกแล้ว</div>'
              +'<div class="v26-stat-val warning">฿'+fmt(s.taGross)+'</div>'
            +'</div>'
          +'</div>'
          +'<div class="v26-card-footer">'
            +'<div class="v26-footer-label">คงเหลือสุทธิ</div>'
            +'<div class="v26-footer-val">฿'+fmt(s.net)+'</div>'
            +'<i class="material-icons-round v26-arrow">chevron_right</i>'
          +'</div>'
        +'</div>';
      }).join('')
      +'</div><div id="v26-pay-detail-wrap" style="display:none;margin-top:20px;"></div></div>';
  });
};
console.log('[v27] renderPayroll overridden');

console.log('%c[v27] ✅ ALL OVERRIDES COMPLETE','color:#fff;background:#16a34a;padding:4px 12px;border-radius:4px;font-size:14px;font-weight:900');
})();
