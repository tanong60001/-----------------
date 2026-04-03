/**
 * modules-v28.js — SK POS Smooth UI & Expense 2-Step
 * ═══════════════════════════════════════════════════════════════
 */
console.log('%c[v28] ✅ LOADED: Smooth Denom UI & Expense Wizard','color:#fff;background:#2563eb;padding:4px 12px;border-radius:4px;');

(function v28Boot(){
'use strict';

var fmt = function(n){ return typeof formatNum==='function' ? formatNum(n) : Number(n||0).toLocaleString('th-TH'); };

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
/* ─── CSS Injection ─── */
var oldCss = document.getElementById('v28css'); if(oldCss) oldCss.remove();
var css = document.createElement('style'); css.id = 'v28css';
css.textContent = `
/* ═══════════════════════════════════════════════════════════════════
   ✨ PREMIUM UI: SMOOTH BILL SLIDE ANIMATION (นับเงินลื่นไหล)
   ═══════════════════════════════════════════════════════════════════ */

/* ── พื้นหลังและกรอบ Popup ── */
.v27ov { 
  position: fixed; inset: 0; z-index: 10001; 
  background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(8px); 
  display: flex; align-items: center; justify-content: center; padding: 16px; 
  animation: v11SlideFadeIn 0.3s ease; 
}
.v27pop { 
  background: var(--bg-surface); padding: 8px; border-radius: var(--radius-xl); 
  box-shadow: var(--shadow-xl); border: 1px solid var(--border-light); 
  max-width: 720px; width: 100%; 
  animation: v11SpringPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
}
.v27in { 
  background: var(--bg-base); border-radius: var(--radius-lg); 
  padding: 24px; max-height: calc(95vh - 60px); overflow-y: auto; 
}

/* ── ส่วนหัว ── */
.v27hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 8px; }
.v27ht { font-size: 20px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
.v27ht i { color: var(--primary); font-size: 24px; }
.v27hs { font-size: 13px; color: var(--text-tertiary); margin-top: 4px; }
.v27ha { font-size: 32px; font-weight: 900; color: var(--primary); letter-spacing: -1px; }
.v27hl { font-size: 12px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700; }

.v27sc { display: flex; align-items: center; gap: 12px; margin: 20px 0 12px; }
.v27sc h3 { font-size: 14px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; white-space: nowrap; }
.v27sc .ln { flex: 1; height: 1px; background: var(--border-light); }

/* ── 🌟 ฐานรองแบงค์ (ยุบลงเวลากด) ── */
.v27bg { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
@media(max-width:600px){ .v27bg { grid-template-columns: repeat(3, 1fr); } }

.v27bc {
  background: var(--bg-surface); border-radius: var(--radius-md); padding: 12px 8px 8px;
  border: 2px solid var(--border-light); display: flex; flex-direction: column; align-items: center;
  position: relative; cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: var(--shadow-sm); user-select: none;
}
.v27bc:hover { 
  border-color: var(--primary-200); background: var(--primary-50); 
  box-shadow: var(--shadow-md); transform: translateY(-2px); 
}
.v27bc:active { 
  transform: translateY(4px) scale(0.98); 
  box-shadow: inset 0 4px 8px rgba(0,0,0,0.05); border-color: var(--primary); 
}
.v27bc.mt { opacity: 0.5; filter: grayscale(0.8); cursor: not-allowed; } 

/* ── 🌟 เอฟเฟกต์ตัวแบงค์ (สไลด์รูดพุ่งขึ้น) ── */
.v27bv {
  width: 100%; aspect-ratio: 3/4; max-width: 90px; border-radius: var(--radius-sm);
  display: flex; align-items: flex-end; justify-content: flex-end; padding: 8px;
  position: relative; margin: 12px 0 8px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.4);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;
  z-index: 10;
}
.v27bv span { color: rgba(255,255,255,0.7); font-weight: 900; font-size: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }

/* ตอนเอาเมาส์ชี้: แบงค์ขยับโผล่ออกมาเตรียมตัว */
.v27bc:hover .v27bv { transform: translateY(-12px); box-shadow: 0 12px 24px rgba(0,0,0,0.15); }
/* ตอนกดคลิก: แบงค์รูดพุ่งขึ้นบนเหมือนเอานิ้วดึง! */
.v27bc:active .v27bv { 
  transform: translateY(-40px) scale(1.1); 
  box-shadow: 0 20px 30px rgba(0,0,0,0.25); 
  transition: transform 0.05s ease-out; 
}

/* ── ตัวเลขป้ายจำนวน (สีแดง) ── */
.v27bd {
  position: absolute; top: -8px; right: -8px; min-width: 26px; height: 26px; border-radius: 13px;
  font-size: 12px; font-weight: 800; color: var(--white); background: var(--primary) !important;
  display: flex; align-items: center; justify-content: center; padding: 0 6px; z-index: 25;
  box-shadow: var(--shadow-red); border: 2px solid var(--white);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.v27bd.z { opacity: 0; transform: scale(0.5); pointer-events: none; }
.v27bn { font-size: 13px; font-weight: 700; color: var(--text-primary); text-transform: uppercase; }
.v27ba { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }

/* ── 🌟 เอฟเฟกต์เหรียญ ── */
.v27cg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
@media(max-width:500px){ .v27cg { grid-template-columns: repeat(2, 1fr); } }
.v27cc {
  background: var(--bg-surface); border-radius: var(--radius-md); padding: 12px 8px;
  border: 2px solid var(--border-light); display: flex; flex-direction: column; align-items: center;
  position: relative; cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); user-select: none;
}
.v27cc:hover { border-color: var(--primary-200); background: var(--primary-50); transform: translateY(-2px); }
.v27cc:active { transform: translateY(4px) scale(0.98); border-color: var(--primary); }
.v27cc.mt { opacity: 0.5; filter: grayscale(0.8); cursor: not-allowed; }

.v27cv {
  width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 16px; color: var(--white); box-shadow: 0 4px 10px rgba(0,0,0,0.15);
  margin-bottom: 8px; transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.v27cc:hover .v27cv { transform: translateY(-8px); box-shadow: 0 10px 16px rgba(0,0,0,0.2); }
.v27cc:active .v27cv { transform: translateY(-24px) scale(1.15); box-shadow: 0 16px 24px rgba(0,0,0,0.3); transition: transform 0.05s ease-out; }

/* ── สรุปยอดด้านล่าง ── */
.v27sb {
  background: var(--bg-surface); border-radius: var(--radius-lg); padding: 20px 24px; margin-top: 24px;
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
  border: 2px solid var(--border-light); box-shadow: var(--shadow-sm);
}
.v27sb .lb { font-size: 13px; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase; }
.v27sb .vl { font-size: 28px; font-weight: 900; transition: color 0.3s; }

/* ── ปุ่มกดยืนยัน ── */
.v27bt { display: flex; gap: 12px; margin-top: 20px; justify-content: center; flex-wrap: wrap; }
.v27b {
  padding: 14px 32px; border-radius: var(--radius-md); font-size: 15px; font-weight: 700;
  border: none; cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); display: flex; align-items: center; gap: 8px;
}
.v27b:hover:not(:disabled) { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.v27b:active:not(:disabled) { transform: translateY(0); }
.v27b:disabled { opacity: 0.5; cursor: not-allowed; }
.v27b.ca { background: var(--bg-base); color: var(--text-secondary); border: 2px solid var(--border-light); }
.v27b.ca:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-default); }
.v27b.nx, .v27b.cf { background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: var(--white); box-shadow: var(--shadow-red); }

/* ── Step Progress (1-2) ── */
.v27st { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 24px; }
.v27sd { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; border: 2px solid transparent; transition: all 0.3s ease; }
.v27sd.ac { background: var(--primary); color: var(--white); box-shadow: var(--shadow-red); }
.v27sd.dn { background: var(--success); color: var(--white); }
.v27sd.pd { background: var(--bg-base); color: var(--text-tertiary); border-color: var(--border-light); }
.v27sl { width: 60px; height: 3px; background: var(--border-light); border-radius: 2px; transition: background 0.3s ease; }
`;
document.head.appendChild(css);
/* ─── CSS Injection ─── */
var oldCss = document.getElementById('v28css'); if(oldCss) oldCss.remove();
var css = document.createElement('style'); css.id = 'v28css';
css.textContent = `
.v27ov{position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:12px;animation:v27fi .25s ease}
@keyframes v27fi{from{opacity:0}to{opacity:1}}
.v27pop{background:#3e2723;padding:6px;border-radius:28px;box-shadow:0 24px 80px rgba(0,0,0,0.5);border:3px solid #2e150b;max-width:720px;width:100%;max-height:95vh;overflow:hidden;animation:v27su .3s cubic-bezier(.34,1.56,.64,1)}
@keyframes v27su{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.v27in{background:linear-gradient(180deg,#d7ccc8,#c4b5ab);border-radius:22px;padding:20px;overflow-y:auto;max-height:calc(95vh - 60px)}
.v27hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px}
.v27ht{font-size:18px;font-weight:900;color:#3e2723;display:flex;align-items:center;gap:8px}
.v27hs{font-size:12px;color:#5d4037cc}
.v27ha{font-size:28px;font-weight:900;color:#3e2723;letter-spacing:-1px}
.v27hl{font-size:11px;color:#5d4037aa;text-transform:uppercase;letter-spacing:1px}
.v27sc{display:flex;align-items:center;gap:10px;margin:14px 0 10px}
.v27sc h3{font-size:13px;font-weight:800;color:#4e342e;text-transform:uppercase;letter-spacing:2px;white-space:nowrap}
.v27sc .ln{flex:1;height:1px;background:#4e342e33}
.v27bg{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
@media(max-width:600px){.v27bg{grid-template-columns:repeat(3,1fr)}}

/* 🌟 เอฟเฟกต์ฐานการ์ด (ให้ยุบลงเวลากด) */
.v27bc{background:#efebe9;border-radius:16px;padding:10px 8px 8px;border-bottom:4px solid #a1887f;display:flex;flex-direction:column;align-items:center;position:relative;overflow:visible;cursor:pointer;transition:all .3s cubic-bezier(0.34, 1.56, 0.64, 1);box-shadow:inset 0 2px 4px rgba(0,0,0,0.06);user-select:none;}
.v27bc:hover{background:#fff; box-shadow:0 8px 20px rgba(0,0,0,0.1)}
.v27bc:active{transform:translateY(4px); box-shadow:inset 0 4px 8px rgba(0,0,0,0.1)}
.v27bc.mt{opacity:0.4;cursor:not-allowed;} 

.v27cs{position:absolute;top:-2px;left:50%;transform:translateX(-50%);width:36px;height:8px;border-radius:3px 3px 0 0;z-index:20;background:radial-gradient(circle,#9e9e9e 30%,#424242 100%)}
.v27cl{position:absolute;top:1px;left:50%;transform:translateX(-50%);width:28px;height:70px;border-radius:999px;z-index:20;pointer-events:none;background:linear-gradient(145deg,#e0e0e0,#fff 40%,#bdbdbd 60%,#9e9e9e);box-shadow:0 4px 6px rgba(0,0,0,0.2),inset 0 1px 1px rgba(255,255,255,0.8)}
.v27cl::after{content:"";position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:14px;height:14px;background:rgba(0,0,0,0.1);border-radius:50%;filter:blur(1px)}
.v27bd{position:absolute;top:4px;right:4px;min-width:22px;height:18px;border-radius:9px;font-size:10px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center;padding:0 5px;z-index:25;transition:transform 0.2s}
.v27bd.z{opacity:0;transform:scale(0.5)}

/* 🌟 เอฟเฟกต์ตัวแบงค์ (ให้รูดเข้า-ออก) */
.v27bv{width:100%;aspect-ratio:3/4;max-width:100px;border-radius:10px;display:flex;align-items:flex-end;justify-content:flex-end;padding:6px;position:relative;overflow:hidden;margin:8px 0 4px;box-shadow:0 4px 10px rgba(0,0,0,0.15);border:2px solid rgba(255,255,255,0.3); transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;}
.v27bv::before{content:"";position:absolute;inset:0 0 auto 0;height:20%;background:rgba(255,255,255,0.12)}
.v27bv span{color:rgba(255,255,255,0.45);font-weight:900;font-size:20px;position:relative;z-index:1}

/* ตอน Hover (เอาเมาส์วาง) แบงค์จะโผล่ขึ้นมานิดนึงเตรียมให้ดึง */
.v27bc:hover .v27bv { transform: translateY(-8px); box-shadow:0 12px 20px rgba(0,0,0,0.25); }
/* ตอน Active (กดคลิก) แบงค์จะเด้งรูดออกไปด้านบนไวๆ เหมือนโดนนิ้วรูด */
.v27bc:active .v27bv { transform: translateY(-30px) scale(1.08); box-shadow:0 20px 30px rgba(0,0,0,0.4); transition: transform 0.05s ease-out; }

.v27bn{font-size:11px;font-weight:800;color:#5d4037;text-transform:uppercase}
.v27ba{font-size:9px;color:#5d4037aa;font-style:italic}
.v27cg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
@media(max-width:500px){.v27cg{grid-template-columns:repeat(2,1fr)}}

/* 🌟 เอฟเฟกต์สำหรับเหรียญ (หลักการเดียวกัน) */
.v27cc{background:#efebe9;border-radius:14px;padding:10px 6px 8px;border-bottom:4px solid #a1887f;display:flex;flex-direction:column;align-items:center;position:relative;cursor:pointer;transition:all .3s cubic-bezier(0.34, 1.56, 0.64, 1);user-select:none;}
.v27cc:hover{background:#fff; box-shadow:0 8px 20px rgba(0,0,0,0.1)}
.v27cc:active{transform:translateY(4px); box-shadow:inset 0 4px 8px rgba(0,0,0,0.1)}
.v27cc.mt{opacity:0.4;cursor:not-allowed;}
.v27cv{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#fff;box-shadow:0 4px 10px rgba(0,0,0,0.2);margin-bottom:4px; transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;}
.v27cc:hover .v27cv { transform: translateY(-6px); box-shadow:0 10px 16px rgba(0,0,0,0.3); }
.v27cc:active .v27cv { transform: translateY(-20px) scale(1.15); box-shadow:0 16px 24px rgba(0,0,0,0.4); transition: transform 0.05s ease-out; }

.v27sb{background:#fff;border-radius:14px;padding:14px 18px;margin-top:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border:2px solid #e8e0dc}
.v27sb .lb{font-size:11px;color:#8d6e63;font-weight:600}
.v27sb .vl{font-size:24px;font-weight:900;transition:color 0.3s;}
.v27bt{display:flex;gap:10px;margin-top:14px;justify-content:center;flex-wrap:wrap}
.v27b{padding:12px 28px;border-radius:14px;font-size:14px;font-weight:700;border:none;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;font-family:inherit}
.v27b:disabled{opacity:0.4;cursor:not-allowed}
.v27b.ca{background:#efebe9;color:#5d4037;border:2px solid #d7ccc8}
.v27b.nx{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 16px rgba(22,163,74,0.3)}
.v27b.cf{background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;box-shadow:0 4px 16px rgba(220,38,38,0.3)}
.v27st{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px}
.v27sd{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
.v27sd.ac{background:#dc2626;color:#fff;box-shadow:0 3px 10px rgba(220,38,38,0.3)}
.v27sd.dn{background:#16a34a;color:#fff}
.v27sd.pd{background:#d7ccc8;color:#8d6e63}
.v27sl{width:40px;height:2px;background:#d7ccc8}
`;
document.head.appendChild(css);

/* ─── Fetch Drawer Data ─── */
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
  }).catch(function(e){return drawer;});
}

function billCard(d,cnt,avail){
  var ha=avail!==null&&avail!==undefined; var empty=ha&&avail<=0;
  return '<div class="v27bc'+(empty?' mt':'')+'" data-v="'+d.v+'">'
    +'<div class="v27cs"></div><div class="v27cl"></div>'
    +'<div class="v27bd'+(cnt===0?' z':'')+'" style="background:'+d.c+';">'+(cnt>0?cnt:'0')+'</div>'
    +'<div class="v27bv" style="background:'+d.bg+';"><span>'+d.v+'</span></div>'
    +'<div class="v27bn">฿'+d.l+'</div>'
    +(ha?'<div class="v27ba">'+(empty?'หมด':avail+' ใบ')+'</div>':'')+'</div>';
}
function coinCard(d,cnt,avail){
  var ha=avail!==null&&avail!==undefined; var empty=ha&&avail<=0;
  return '<div class="v27cc'+(empty?' mt':'')+'" data-v="'+d.v+'">'
    +'<div class="v27bd'+(cnt===0?' z':'')+'" style="background:#4e342e;">'+(cnt>0?cnt:'0')+'</div>'
    +'<div class="v27cv" style="background:'+d.bg+';'+(d.bdr?'border:'+d.bdr:'')+'">'+d.l+'</div>'
    +'<div class="v27bn">฿'+d.l+'</div>'
    +(ha?'<div class="v27ba">'+(empty?'หมด':avail+'x')+'</div>':'')+'</div>';
}
function bindCards(ov,evt){
  ov.querySelectorAll('.v27bc,.v27cc').forEach(function(el){
    var val=Number(el.dataset.v);
    el.onclick=function(){document.dispatchEvent(new CustomEvent(evt,{detail:{a:'add',v:val}}));};
    el.oncontextmenu=function(e){e.preventDefault();document.dispatchEvent(new CustomEvent(evt,{detail:{a:'rem',v:val}}));};
  });
}

/* ═══════════════════════════════════════════════════════════════
   1. CHECKOUT SELL WIZARD (SMOOTH UPDATE)
═══════════════════════════════════════════════════════════════ */
window.v12S5 = function(container){
  if(!container) return;
  var payAmt = v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total;
  container.innerHTML = '<h2 class="v12-step-title">💵 รับเงินสด</h2>'
    +'<p class="v12-step-subtitle">กดปุ่มด้านล่างเพื่อเปิดหน้านับแบงค์</p>'
    +'<div style="text-align:center;padding:30px 0;">'
    +'<div style="font-size:14px;color:var(--text-muted);">ยอดที่ต้องรับ</div>'
    +'<div style="font-size:36px;font-weight:900;color:var(--primary);margin:8px 0;">฿'+fmt(payAmt)+'</div>'
    +'<button onclick="v28SellWiz()" style="padding:16px 40px;border-radius:16px;border:none;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 8px 24px rgba(220,38,38,0.3);display:inline-flex;align-items:center;gap:10px;font-family:inherit;">'
    +'<i class="material-icons-round" style="font-size:24px;">payments</i> เปิดลิ้นชักนับเงิน</button>'
    +'<div id="v28ss" style="margin-top:16px;font-size:14px;color:var(--text-muted);"></div></div>';
  setTimeout(function(){ window.v28SellWiz(); },300);
};

window.v28SellWiz = function(){
  var payAmt = v12State.paymentType==='deposit' ? v12State.depositAmount : v12State.total;
  loadDrawer().then(function(drawer){
    var st={step:1,recv:{},chg:{}};
    ALL.forEach(function(d){st.recv[d.v]=0;st.chg[d.v]=0;});
    if(v12State.receivedDenominations) ALL.forEach(function(d){st.recv[d.v]=v12State.receivedDenominations[d.v]||0;});

    var old=document.getElementById('v28so'); if(old) old.remove();
    var ov=document.createElement('div'); ov.id='v28so'; ov.className='v27ov';

    function rT(){var s=0;ALL.forEach(function(d){s+=d.v*(st.recv[d.v]||0);});return s;}
    function cT(){var s=0;ALL.forEach(function(d){s+=d.v*(st.chg[d.v]||0);});return s;}

    function render(full){
      var recv=rT(), cn=Math.max(0,recv-payAmt), cg=cT();
      var enough=recv>=payAmt, cd=cn<=0||Math.abs(cn-cg)<0.01;

      if(full){
        if(st.step===1){
          ov.innerHTML='<div class="v27pop"><div class="v27in">'
            +'<div class="v27st"><div class="v27sd ac">1</div><div class="v27sl"></div><div class="v27sd pd">2</div></div>'
            +'<div class="v27hdr"><div><div class="v27ht"><i class="material-icons-round">shopping_cart</i> รับเงินจากลูกค้า</div><div class="v27hs">กดที่แบงค์/เหรียญเพื่อนับ · กดค้างเพื่อลบ</div></div>'
            +'<div style="text-align:right;"><div class="v27hl">ยอดสินค้า</div><div class="v27ha">฿'+fmt(payAmt)+'</div></div></div>'
            +'<div class="v27sc"><h3>💵 ธนบัตรที่รับ</h3><div class="ln"></div></div>'
            +'<div class="v27bg">'+BILLS.map(function(d){return billCard(d,st.recv[d.v],null);}).join('')+'</div>'
            +'<div class="v27sc"><h3>🪙 เหรียญที่รับ</h3><div class="ln"></div></div>'
            +'<div class="v27cg">'+COINS.map(function(d){return coinCard(d,st.recv[d.v],null);}).join('')+'</div>'
            +'<div class="v27sb"><div><div class="lb">รับมาแล้ว</div><div class="vl" id="s1-recv" style="color:'+(enough?'#16a34a':'#3e2723')+';">฿'+fmt(recv)+'</div></div>'
            +'<div style="text-align:right;" id="s1-res">'+(enough?'<div class="lb">เงินทอน</div><div class="vl" style="color:#d97706;">฿'+fmt(cn)+'</div>'
            :'<div class="lb">ยังขาด</div><div class="vl" style="color:#ef4444;">฿'+fmt(payAmt-recv)+'</div>')+'</div></div>'
            +'<div class="v27bt">'
            +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28s\',{detail:{a:\'x\'}}))"><i class="material-icons-round">close</i> ยกเลิก</button>'
            +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28s\',{detail:{a:\'r1\'}}))"><i class="material-icons-round">refresh</i> ล้าง</button>'
            +'<button class="v27b nx" id="s1-nx" style="display:'+(enough?'':'none')+'" onclick="document.dispatchEvent(new CustomEvent(\'v28s\',{detail:{a:\'n\'}}))"><i class="material-icons-round">arrow_forward</i> ถัดไป — ทอน ฿'+fmt(cn)+'</button>'
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
            +'<div class="v27sb"><div><div class="lb">นับทอนแล้ว</div><div class="vl" id="s2-cg" style="color:'+(cd?'#16a34a':'#d97706')+';">฿'+fmt(cg)+'</div></div>'
            +'<div style="text-align:right;" id="s2-res">'+(cd?'<div style="color:#16a34a;font-weight:800;font-size:15px;">✅ ครบแล้ว!</div>'
            :'<div class="lb">ยังขาด</div><div class="vl" style="color:#ef4444;">฿'+fmt(cn-cg)+'</div>')+'</div></div>'
            +'<div class="v27bt">'
            +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28s\',{detail:{a:\'b\'}}))"><i class="material-icons-round">arrow_back</i> ย้อนกลับ</button>'
            +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28s\',{detail:{a:\'r2\'}}))"><i class="material-icons-round">refresh</i> ล้าง</button>'
            +'<button class="v27b cf" id="s2-ok" '+(cd?'':'disabled')+' onclick="document.dispatchEvent(new CustomEvent(\'v28s\',{detail:{a:\'ok\'}}))"><i class="material-icons-round">check_circle</i> ยืนยัน — ทอน ฿'+fmt(cn)+'</button>'
            +'</div></div></div>';
        }
        bindCards(ov,'v28s');
      } else {
        /* SMOOTH DOM DIFFING */
        ALL.forEach(function(d){
           var cnt = st.step===1 ? st.recv[d.v] : st.chg[d.v];
           var el = ov.querySelector('[data-v="'+d.v+'"] .v27bd');
           if(el) { el.innerText=cnt>0?cnt:'0'; if(cnt>0) el.classList.remove('z'); else el.classList.add('z'); }
           if(st.step===2) {
              var cEl = ov.querySelector('[data-v="'+d.v+'"]');
              var avail = (drawer[d.v]||0) - cnt;
              var ba = cEl.querySelector('.v27ba');
              if(ba) ba.innerText = avail<=0?'หมด':avail+' ใบ';
              if(avail<=0) cEl.classList.add('mt'); else cEl.classList.remove('mt');
           }
        });
        if(st.step===1){
           var vR = ov.querySelector('#s1-recv'); if(vR){ vR.innerText='฿'+fmt(recv); vR.style.color=enough?'#16a34a':'#3e2723'; }
           var eR = ov.querySelector('#s1-res');
           if(eR) eR.innerHTML=enough?'<div class="lb">เงินทอน</div><div class="vl" style="color:#d97706;">฿'+fmt(cn)+'</div>':'<div class="lb">ยังขาด</div><div class="vl" style="color:#ef4444;">฿'+fmt(payAmt-recv)+'</div>';
           var nx = ov.querySelector('#s1-nx');
           if(nx){ nx.style.display=enough?'':'none'; nx.innerHTML='<i class="material-icons-round">arrow_forward</i> ถัดไป — ทอน ฿'+fmt(cn); }
        } else {
           var vC = ov.querySelector('#s2-cg'); if(vC){ vC.innerText='฿'+fmt(cg); vC.style.color=cd?'#16a34a':'#d97706'; }
           var s2R = ov.querySelector('#s2-res');
           if(s2R) s2R.innerHTML=cd?'<div style="color:#16a34a;font-weight:800;font-size:15px;">✅ ครบแล้ว!</div>':'<div class="lb">ยังขาด</div><div class="vl" style="color:#ef4444;">฿'+fmt(cn-cg)+'</div>';
           var okBtn = ov.querySelector('#s2-ok');
           if(okBtn){ okBtn.disabled=!cd; okBtn.innerHTML='<i class="material-icons-round">check_circle</i> ยืนยัน — ทอน ฿'+fmt(cn); }
        }
      }
    }

    function handle(e){
      var a=e.detail.a, v=e.detail.v;
      if(a==='x'){done();return;}
      if(a==='r1'){ ALL.forEach(function(d){st.recv[d.v]=0;}); render(false); return; }
      if(a==='r2'){ ALL.forEach(function(d){st.chg[d.v]=0;}); render(false); return; }
      if(a==='n'){ st.step=2; render(true); return; }
      if(a==='b'){ st.step=1; render(true); return; }
      
      if(a==='add'){
        if(st.step===1) st.recv[v]=(st.recv[v]||0)+1;
        else {
           if((st.chg[v]||0)<(drawer[v]||0)) st.chg[v]=(st.chg[v]||0)+1;
           else if(typeof toast==='function') toast('ธนบัตรในลิ้นชักไม่พอ','warning');
        }
        render(false);
      }
      if(a==='rem'){
        if(st.step===1){if((st.recv[v]||0)>0) st.recv[v]--;}
        else{if((st.chg[v]||0)>0) st.chg[v]--;}
        render(false);
      }
      if(a==='ok'){
        v12State.receivedDenominations=Object.assign({},st.recv);
        v12State.changeDenominations=Object.assign({},st.chg);
        v12State.received=rT(); v12State.change=rT()-payAmt;
        done();
        var ss=document.getElementById('v28ss');
        if(ss) ss.innerHTML='<div style="color:#16a34a;font-weight:700;">✅ รับ ฿'+fmt(v12State.received)+' ทอน ฿'+fmt(v12State.change)+'</div>';
        var nb=document.getElementById('v12-next-btn');
        if(nb){nb.disabled=false;nb.className='v12-btn-next green';nb.innerHTML='<i class="material-icons-round">check</i> ยืนยัน — ทอน ฿'+fmt(v12State.change);}
        if(typeof _v24CalcAndSendCash==='function') _v24CalcAndSendCash();
      }
    }
    function done(){document.removeEventListener('v28s',handle);ov.remove();}
    document.addEventListener('v28s',handle);
    render(true); document.body.appendChild(ov);
  });
};

/* ═══════════════════════════════════════════════════════════════
   2. EXPENSE 2-STEP WIZARD (หน้ารายจ่าย)
═══════════════════════════════════════════════════════════════ */
window.v28ExpenseWiz = function(expAmt, drawer, onConfirm) {
  var st={step:1, out:{}, in:{}};
  ALL.forEach(function(d){st.out[d.v]=0;st.in[d.v]=0;});

  var ov=document.createElement('div'); ov.id='v28eo'; ov.className='v27ov';

  function oT(){var s=0;ALL.forEach(function(d){s+=d.v*(st.out[d.v]||0);});return s;}
  function iT(){var s=0;ALL.forEach(function(d){s+=d.v*(st.in[d.v]||0);});return s;}

  function render(full){
     var totOut = oT(), totIn = iT();
     var expectedChange = Math.max(0, totOut - expAmt);
     var enoughOut = totOut >= expAmt;
     var inOk = Math.abs(totIn - expectedChange) < 0.01;

     if(full){
        if(st.step===1){
           ov.innerHTML='<div class="v27pop"><div class="v27in">'
            +'<div class="v27st"><div class="v27sd ac">1</div><div class="v27sl"></div><div class="v27sd pd">2</div></div>'
            +'<div class="v27hdr"><div><div class="v27ht"><i class="material-icons-round">arrow_upward</i> หยิบเงินออกจากลิ้นชัก</div><div class="v27hs">หยิบแบงค์/เหรียญจากลิ้นชักเพื่อไปจ่ายค่าใช้จ่าย</div></div>'
            +'<div style="text-align:right;"><div class="v27hl">ยอดที่ต้องจ่าย</div><div class="v27ha">฿'+fmt(expAmt)+'</div></div></div>'
            +'<div class="v27sc"><h3>💵 ธนบัตรในลิ้นชัก</h3><div class="ln"></div></div>'
            +'<div class="v27bg">'+BILLS.map(function(d){return billCard(d,st.out[d.v],drawer[d.v]||0);}).join('')+'</div>'
            +'<div class="v27sc"><h3>🪙 เหรียญในลิ้นชัก</h3><div class="ln"></div></div>'
            +'<div class="v27cg">'+COINS.map(function(d){return coinCard(d,st.out[d.v],drawer[d.v]||0);}).join('')+'</div>'
            +'<div class="v27sb"><div><div class="lb">หยิบออกแล้ว</div><div class="vl" id="e1-out" style="color:'+(enoughOut?'#16a34a':'#3e2723')+';">฿'+fmt(totOut)+'</div></div>'
            +'<div style="text-align:right;" id="e1-res">'+(enoughOut?'<div class="lb">จะได้เงินทอนกลับมา</div><div class="vl" style="color:#16a34a;">฿'+fmt(expectedChange)+'</div>'
            :'<div class="lb">ยังขาดอีก</div><div class="vl" style="color:#ef4444;">฿'+fmt(expAmt-totOut)+'</div>')+'</div></div>'
            +'<div class="v27bt">'
            +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28e\',{detail:{a:\'x\'}}))"><i class="material-icons-round">close</i> ยกเลิก</button>'
            +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28e\',{detail:{a:\'r1\'}}))"><i class="material-icons-round">refresh</i> ล้าง</button>'
            +'<button class="v27b cf" id="e1-nx" style="display:'+(enoughOut?'':'none')+'" onclick="document.dispatchEvent(new CustomEvent(\'v28e\',{detail:{a:\'n\'}}))"><i class="material-icons-round">arrow_forward</i> ถัดไป — ไปนับเงินทอนเข้าร้าน</button>'
            +'</div></div></div>';
        } else {
           ov.innerHTML='<div class="v27pop"><div class="v27in">'
            +'<div class="v27st"><div class="v27sd dn">✓</div><div class="v27sl" style="background:#16a34a;"></div><div class="v27sd ac">2</div></div>'
            +'<div class="v27hdr"><div><div class="v27ht"><i class="material-icons-round">arrow_downward</i> รับเงินทอนเข้าร้าน</div><div class="v27hs">นับเงินทอนที่ได้รับกลับมาเก็บเข้าลิ้นชัก (ถ้ามี)</div></div>'
            +'<div style="text-align:right;"><div class="v27hl">เงินทอนที่ต้องได้</div><div class="v27ha" style="color:#d97706;">฿'+fmt(expectedChange)+'</div></div></div>'
            +'<div class="v27sc"><h3>💵 ธนบัตรที่รับทอน</h3><div class="ln"></div></div>'
            +'<div class="v27bg">'+BILLS.map(function(d){return billCard(d,st.in[d.v],null);}).join('')+'</div>'
            +'<div class="v27sc"><h3>🪙 เหรียญที่รับทอน</h3><div class="ln"></div></div>'
            +'<div class="v27cg">'+COINS.map(function(d){return coinCard(d,st.in[d.v],null);}).join('')+'</div>'
            +'<div class="v27sb"><div><div class="lb">นับทอนเข้าร้านแล้ว</div><div class="vl" id="e2-in" style="color:'+(inOk?'#16a34a':'#d97706')+';">฿'+fmt(totIn)+'</div></div>'
            +'<div style="text-align:right;" id="e2-res">'+(inOk?'<div style="color:#16a34a;font-weight:800;font-size:15px;">✅ ยอดตรงแล้ว!</div>'
            :'<div class="lb">ส่วนต่างทอน</div><div class="vl" style="color:#ef4444;">฿'+fmt(Math.abs(expectedChange-totIn))+'</div>')+'</div></div>'
            +'<div class="v27bt">'
            +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28e\',{detail:{a:\'b\'}}))"><i class="material-icons-round">arrow_back</i> ย้อนกลับ</button>'
            +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28e\',{detail:{a:\'r2\'}}))"><i class="material-icons-round">refresh</i> ล้าง</button>'
            +'<button class="v27b cf" id="e2-ok" '+(inOk?'':'disabled')+' onclick="document.dispatchEvent(new CustomEvent(\'v28e\',{detail:{a:\'ok\'}}))"><i class="material-icons-round">check_circle</i> ยืนยันบันทึกรายจ่าย</button>'
            +'</div></div></div>';
        }
        bindCards(ov,'v28e');
     } else {
        /* Smooth Updates */
        ALL.forEach(function(d){
           var cnt = st.step===1 ? st.out[d.v] : st.in[d.v];
           var el = ov.querySelector('[data-v="'+d.v+'"] .v27bd');
           if(el) { el.innerText=cnt>0?cnt:'0'; if(cnt>0) el.classList.remove('z'); else el.classList.add('z'); }

           if(st.step===1) {
              var cEl = ov.querySelector('[data-v="'+d.v+'"]');
              var avail = (drawer[d.v]||0) - cnt;
              var ba = cEl.querySelector('.v27ba');
              if(ba) ba.innerText = avail<=0?'หมด':avail+' ใบ';
              if(avail<=0) cEl.classList.add('mt'); else cEl.classList.remove('mt');
           }
        });
        if(st.step===1){
           var vO = ov.querySelector('#e1-out'); if(vO){ vO.innerText = '฿'+fmt(totOut); vO.style.color = enoughOut?'#16a34a':'#3e2723'; }
           var eR = ov.querySelector('#e1-res');
           if(eR) eR.innerHTML = enoughOut?'<div class="lb">จะได้เงินทอนกลับมา</div><div class="vl" style="color:#16a34a;">฿'+fmt(expectedChange)+'</div>':'<div class="lb">ยังขาดอีก</div><div class="vl" style="color:#ef4444;">฿'+fmt(expAmt-totOut)+'</div>';
           var btnNx = ov.querySelector('#e1-nx'); if(btnNx) btnNx.style.display = enoughOut?'':'none';
        } else {
           var vI = ov.querySelector('#e2-in'); if(vI){ vI.innerText = '฿'+fmt(totIn); vI.style.color = inOk?'#16a34a':'#d97706'; }
           var iR = ov.querySelector('#e2-res');
           if(iR) iR.innerHTML = inOk?'<div style="color:#16a34a;font-weight:800;font-size:15px;">✅ ยอดตรงแล้ว!</div>':'<div class="lb">ส่วนต่างทอน</div><div class="vl" style="color:#ef4444;">฿'+fmt(Math.abs(expectedChange-totIn))+'</div>';
           var btnOk = ov.querySelector('#e2-ok'); if(btnOk) btnOk.disabled = !inOk;
        }
     }
  }

  function handle(e){
      var a=e.detail.a, v=e.detail.v;
      if(a==='x'){done();return;}
      if(a==='r1'){ ALL.forEach(function(d){st.out[d.v]=0;}); render(false); return; }
      if(a==='r2'){ ALL.forEach(function(d){st.in[d.v]=0;}); render(false); return; }
      if(a==='n'){ st.step=2; render(true); return; }
      if(a==='b'){ st.step=1; render(true); return; }
      if(a==='add'){
        if(st.step===1) {
           if((st.out[v]||0)<(drawer[v]||0)) st.out[v]=(st.out[v]||0)+1;
           else if(typeof toast==='function') toast('ธนบัตรในลิ้นชักไม่พอ','warning');
        } else { st.in[v]=(st.in[v]||0)+1; }
        render(false);
      }
      if(a==='rem'){
        if(st.step===1){if((st.out[v]||0)>0) st.out[v]--;}
        else{if((st.in[v]||0)>0) st.in[v]--;}
        render(false);
      }
      if(a==='ok'){
         done();
         if(onConfirm) onConfirm({ out: st.out, outTotal: oT(), in: st.in, inTotal: iT() });
      }
  }

  function done(){document.removeEventListener('v28e',handle);ov.remove();}
  document.addEventListener('v28e',handle);
  render(true); document.body.appendChild(ov);
}

/* ─── OVERRIDE EXPENSE MODAL ─── */
window.showAddExpenseModal = function() {
  openModal('บันทึกรายจ่าย', `
    <form id="expense-form">
      <div class="form-group"><label class="form-label">รายการ *</label><input type="text" class="form-input" id="exp-desc" placeholder="ระบุรายการ" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">จำนวน (บาท) *</label><input type="number" class="form-input" id="exp-amount" min="1" required></div>
        <div class="form-group"><label class="form-label">หมวดหมู่</label>
          <select class="form-input" id="exp-cat">
            <option value="ทั่วไป">ทั่วไป</option>
            <option value="ค่าสาธารณูปโภค">ค่าสาธารณูปโภค</option>
            <option value="ค่าขนส่ง">ค่าขนส่ง</option>
            <option value="ค่าซ่อมบำรุง">ค่าซ่อมบำรุง</option>
            <option value="ค่าอาหาร/เครื่องดื่ม">ค่าอาหาร/เครื่องดื่ม</option>
            <option value="ค่าเงินเดือน">ค่าเงินเดือน</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">วิธีชำระ</label>
          <select class="form-input" id="exp-method"><option value="เงินสด">เงินสด (บันทึกตัดลิ้นชัก)</option><option value="โอนเงิน">โอนเงิน</option><option value="บัตรเครดิต">บัตรเครดิต</option></select>
        </div>
        <div class="form-group"><label class="form-label">วันที่</label><input type="datetime-local" class="form-input" id="exp-datetime" value="${new Date().toISOString().slice(0, 16)}"></div>
      </div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label><input type="text" class="form-input" id="exp-note"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="material-icons-round">save</i> บันทึก</button>
    </form>`);

  document.getElementById('expense-form').onsubmit = async (e) => {
    e.preventDefault();
    const desc = document.getElementById('exp-desc').value;
    const amt = Number(document.getElementById('exp-amount').value);
    const cat = document.getElementById('exp-cat').value;
    const methodRaw = document.getElementById('exp-method').value;
    const method = methodRaw.includes('เงินสด') ? 'เงินสด' : methodRaw;
    const dt = new Date(document.getElementById('exp-datetime').value).toISOString();
    const note = document.getElementById('exp-note').value;

    if (method === 'เงินสด') {
        loadDrawer().then(drawer => {
            window.v28ExpenseWiz(amt, drawer, async (res) => {
                try {
                    // 1. บันทึกลงตารางรายจ่าย
                    const { data: exp } = await db.from('รายจ่าย').insert({ description: desc, amount: amt, category: cat, method: method, date: dt, note: note, staff_name: window.USER?.username }).select().single();
                    // 2. หา session ลิ้นชักปัจจุบัน
                    const { data: session } = await db.from('cash_session').select('id').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).single();
                    if (session) {
                        // 3. บันทึกตัดลิ้นชัก
                        await db.from('cash_transaction').insert({
                            session_id: session.id,
                            type: 'รายจ่าย: ' + desc,
                            direction: 'out', // ออกจากลิ้นชัก
                            amount: res.outTotal, // จำนวนที่หยิบออก
                            change_amt: res.inTotal, // เงินทอนที่ได้รับกลับเข้ามา
                            net_amount: amt, // มูลค่าที่จ่ายจริง (ยอดรวม)
                            balance_after: 0, 
                            ref_id: exp.id,
                            ref_table: 'รายจ่าย',
                            staff_name: window.USER?.username,
                            denominations: res.out,
                            change_denominations: res.in
                        });
                    }
                    if(typeof toast==='function') toast('บันทึกรายจ่ายเงินสดและอัปเดตลิ้นชักสำเร็จ', 'success');
                    if(typeof closeModal==='function') closeModal();
                    if (typeof loadExpenseData === 'function') loadExpenseData();
                    if (typeof loadCashBalance === 'function') loadCashBalance();
                } catch(err) {
                    if(typeof toast==='function') toast('เกิดข้อผิดพลาดในการบันทึก', 'error');
                    console.error(err);
                }
            });
        });
    } else {
        // วิธีอื่นๆ (โอน/บัตร) บันทึกปกติ
        await db.from('รายจ่าย').insert({ description: desc, amount: amt, category: cat, method: method, date: dt, note: note, staff_name: window.USER?.username });
        if(typeof toast==='function') toast('บันทึกรายจ่ายสำเร็จ', 'success');
        if(typeof closeModal==='function') closeModal();
        if (typeof loadExpenseData === 'function') loadExpenseData();
    }
  };
};

/* ═══════════════════════════════════════════════════════════════
   3. GENERIC 1-STEP WIZARD (Smooth Update)
═══════════════════════════════════════════════════════════════ */
function genWiz(opts){
  var title=opts.title||'นับเงิน', target=opts.target||0, exact=opts.exact||false;
  var dir=opts.dir||'in', drw=opts.drw, onOk=opts.onOk, onNo=opts.onNo;
  var show=!!drw;
  var old=document.getElementById('v28go'); if(old) old.remove();
  var st={}; ALL.forEach(function(d){st[d.v]=0;});
  var ov=document.createElement('div'); ov.id='v28go'; ov.className='v27ov';

  function gT(){var s=0;ALL.forEach(function(d){s+=d.v*(st[d.v]||0);});return s;}

  function render(full){
    var total=gT();
    var ok=target<=0||(exact?Math.abs(total-target)<0.01:total>=target);
    var can=total>0&&(target<=0||ok);

    if(full) {
      ov.innerHTML='<div class="v27pop"><div class="v27in">'
        +'<div class="v27hdr"><div><div class="v27ht"><i class="material-icons-round">'+(dir==='out'?'arrow_upward':'arrow_downward')+'</i> '+title+'</div>'
        +'<div class="v27hs">'+(exact?'ต้องนับให้พอดียอดเป้าหมาย':'กดแบงค์/เหรียญเพื่อนับ · กดค้างเพื่อลบ')+'</div></div>'
        +(target>0?'<div style="text-align:right;"><div class="v27hl">ยอดเป้าหมาย</div><div class="v27ha">฿'+fmt(target)+'</div></div>':'')+'</div>'
        +'<div class="v27sc"><h3>💵 ธนบัตร'+(show?'ในลิ้นชัก':'')+'</h3><div class="ln"></div></div>'
        +'<div class="v27bg">'+BILLS.map(function(d){return billCard(d,st[d.v],show?drw[d.v]:null);}).join('')+'</div>'
        +'<div class="v27sc"><h3>🪙 เหรียญ'+(show?'ในลิ้นชัก':'')+'</h3><div class="ln"></div></div>'
        +'<div class="v27cg">'+COINS.map(function(d){return coinCard(d,st[d.v],show?drw[d.v]:null);}).join('')+'</div>'
        +'<div class="v27sb"><div><div class="lb">รวมที่นับ</div><div class="vl" id="gw-tot" style="color:'+(can?'#16a34a':'#3e2723')+';">฿'+fmt(total)+'</div></div>'
        +(target>0?'<div style="text-align:right;" id="gw-res">'+(ok?'<div style="color:#16a34a;font-weight:800;">✅ '+(exact?'พอดี!':'พร้อม')+'</div>'
        :'<div class="lb">'+(exact&&total>target?'เกิน':'ขาด')+'</div><div class="vl" style="color:#ef4444;">฿'+fmt(Math.abs(target-total))+'</div>')+'</div>':'')+'</div>'
        +'<div class="v27bt">'
        +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28g\',{detail:{a:\'x\'}}))"><i class="material-icons-round">close</i> ยกเลิก</button>'
        +'<button class="v27b ca" onclick="document.dispatchEvent(new CustomEvent(\'v28g\',{detail:{a:\'r\'}}))"><i class="material-icons-round">refresh</i> ล้าง</button>'
        +'<button class="v27b '+(dir==='out'?'cf':'nx')+'" id="gw-ok" '+(can?'':'disabled')+' onclick="document.dispatchEvent(new CustomEvent(\'v28g\',{detail:{a:\'ok\'}}))"><i class="material-icons-round">check_circle</i> ยืนยัน</button>'
        +'</div></div></div>';
      bindCards(ov,'v28g');
    } else {
      /* Smooth Updates */
      ALL.forEach(function(d){
         var cnt = st[d.v];
         var el = ov.querySelector('[data-v="'+d.v+'"] .v27bd');
         if(el) { el.innerText=cnt>0?cnt:'0'; if(cnt>0) el.classList.remove('z'); else el.classList.add('z'); }
         if(show) {
            var cEl = ov.querySelector('[data-v="'+d.v+'"]');
            var avail = (drw[d.v]||0)-cnt;
            var ba = cEl.querySelector('.v27ba');
            if(ba) ba.innerText = avail<=0?'หมด':avail+' ใบ';
            if(avail<=0) cEl.classList.add('mt'); else cEl.classList.remove('mt');
         }
      });
      var vT = ov.querySelector('#gw-tot'); if(vT){ vT.innerText='฿'+fmt(total); vT.style.color=can?'#16a34a':'#3e2723'; }
      var vR = ov.querySelector('#gw-res');
      if(vR && target>0) {
         if(ok) vR.innerHTML = '<div style="color:#16a34a;font-weight:800;">✅ '+(exact?'พอดี!':'พร้อม')+'</div>';
         else vR.innerHTML = '<div class="lb">'+(exact&&total>target?'เกิน':'ขาด')+'</div><div class="vl" style="color:#ef4444;">฿'+fmt(Math.abs(target-total))+'</div>';
      }
      var btn = ov.querySelector('#gw-ok'); if(btn) btn.disabled = !can;
    }
  }

  function handle(e){
    var a=e.detail.a, v=e.detail.v;
    if(a==='x'){done();if(onNo)onNo();return;}
    if(a==='r'){ ALL.forEach(function(d){st[d.v]=0;}); render(false); return; }
    if(a==='add'){
      if(show) {
         if((st[v]||0)<(drw[v]||0)) st[v]=(st[v]||0)+1;
         else if(typeof toast==='function') toast('ธนบัตรในลิ้นชักไม่พอ','warning');
      } else { st[v]=(st[v]||0)+1; }
      render(false);
    }
    if(a==='rem'){if((st[v]||0)>0) st[v]--; render(false);}
    if(a==='ok'){done();if(onOk)onOk(st,gT());}
  }
  function done(){document.removeEventListener('v28g',handle);ov.remove();}
  document.addEventListener('v28g',handle);
  render(true); document.body.appendChild(ov);
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
window.v26StartCashWizard = function(opts){
  loadDrawer().then(function(drawer){
    genWiz({title:opts.title||'จ่ายเงินสด',target:opts.targetAmount||0,exact:opts.mustBeExact||false,
      dir:'out',drw:drawer,
      onOk:function(ds){if(opts.onConfirm)opts.onConfirm(ds);},
      onNo:function(){}
    });
  });
};

})();