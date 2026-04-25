/**
 * modules-v32-cashui.js  —  ระบบลิ้นชักใหม่ (IIFE-safe)
 *
 *  1. เปิดลิ้นชัก  — v27-style overlay + input fields + บันทึก denomination
 *  2. เพิ่มเงิน    — v27-style overlay + denomination (override cashMovement)
 *  3. แลกเงิน 2 ขั้น — นับออก (จำกัดตามสต็อก) → นับเข้า (ต้องพอดีเป๊ะ)
 *  4. รีเซ็ตอัตโนมัติทุกวัน
 *  5. หน้า Cash UI ใหม่ (hero card + stats + denomination breakdown)
 */
(function () {
  'use strict';

  /* ─── Denomination data (ตรงกับ v27 เป๊ะ) ─── */
  var BILLS = [
    { v: 1000, l: '1,000', c: '#6b4c9a', bg: '#bda48d' },
    { v: 500,  l: '500',   c: '#9a25ae', bg: '#9a25ae' },
    { v: 100,  l: '100',   c: '#ba1a1a', bg: '#ba1a1a' },
    { v: 50,   l: '50',    c: '#0061a4', bg: '#0061a4' },
    { v: 20,   l: '20',    c: '#006e1c', bg: '#006e1c' }
  ];
  var COINS = [
    { v: 10, l: '10', c: '#FFB300', bg: 'linear-gradient(135deg,#FFD54F,#FFB300)', bdr: '4px solid #CFD8DC' },
    { v: 5,  l: '5',  c: '#90A4AE', bg: 'linear-gradient(135deg,#CFD8DC,#90A4AE)', bdr: '2px solid #fff' },
    { v: 2,  l: '2',  c: '#FBC02D', bg: 'linear-gradient(135deg,#FFD54F,#FBC02D)', bdr: '2px solid rgba(255,255,255,0.5)' },
    { v: 1,  l: '1',  c: '#B0BEC5', bg: 'linear-gradient(135deg,#CFD8DC,#B0BEC5)', bdr: '2px solid rgba(255,255,255,0.5)' }
  ];
  var ALL = BILLS.concat(COINS);

  /* ─── Helpers ─── */
  var _f    = function (n) { return typeof formatNum === 'function' ? formatNum(n) : Number(n || 0).toLocaleString('th-TH'); };
  var _fdt  = function (s) { return typeof formatDateTime === 'function' ? formatDateTime(s) : s; };
  var _today = function () { return new Date().toISOString().split('T')[0]; };
  var _now   = function () { return new Date().toISOString(); };
  var _user  = function () { return (typeof USER !== 'undefined' && USER && USER.username) ? USER.username : 'ระบบ'; };

  /* ─── CSS injection ─── */
  (function () {
    if (document.getElementById('sk-v32b-css')) return;
    var s = document.createElement('style');
    s.id = 'sk-v32b-css';
    s.textContent = [
      /* ── popup overflow fix ── */
      '.v27pop{overflow:hidden!important;}',
      '.v27in{overflow-x:hidden!important;overflow-y:auto;}',
      /* bill grid responsive */
      '.v27bg{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}',
      '@media(max-width:640px){.v27bg{grid-template-columns:repeat(3,1fr);}}',
      '@media(max-width:400px){.v27bg{grid-template-columns:repeat(2,1fr);}}',
      /* coin grid responsive */
      '.v27cg{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}',
      '@media(max-width:500px){.v27cg{grid-template-columns:repeat(2,1fr);}}',

      /* ── denomination cell wrapper ── */
      '.v32-cell{display:flex;flex-direction:column;align-items:stretch;min-width:0;}',
      /* input row: − / qty / + */
      '.v32-qrow{display:flex;align-items:center;gap:3px;margin-top:6px;padding:0 2px;}',
      '.v32-qbtn{width:26px;height:26px;flex-shrink:0;border-radius:7px;border:1.5px solid #a1887f;',
      'background:#efebe9;cursor:pointer;font-size:15px;font-weight:800;',
      'display:flex;align-items:center;justify-content:center;padding:0;',
      'color:#3e2723;line-height:1;transition:background .12s;}',
      '.v32-qbtn:hover{background:#d7ccc8;}',
      '.v32-qinp{flex:1;min-width:0;border:1.5px solid #a1887f;border-radius:7px;text-align:center;',
      'font-size:13px;font-weight:700;padding:3px 0;font-family:"Prompt",sans-serif;',
      'color:#3e2723;background:#fff;}',
      '.v32-qinp:focus{outline:none;border-color:#5d4037;box-shadow:0 0 0 2px rgba(93,64,55,.2);}',
      '.v32-qinp::-webkit-inner-spin-button,.v32-qinp::-webkit-outer-spin-button{-webkit-appearance:none;}',
      '.v32-qinp[type=number]{-moz-appearance:textfield;}',
      /* subtotal */
      '.v32-sub{font-size:10px;font-weight:700;color:#5d4037;text-align:center;min-height:14px;margin-top:2px;}',
      /* balance bar */
      '.v32-balbar{background:#3e2723;border-radius:12px;padding:11px 16px;margin-bottom:12px;',
      'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;}',
      /* summary row */
      '.v32-totrow{background:#fff;border-radius:14px;padding:14px 18px;margin-top:14px;',
      'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;',
      'border:2px solid #e8e0dc;}',
      '.v32-totrow .lb{font-size:11px;color:#8d6e63;font-weight:600;}',
      '.v32-totrow .vl{font-size:26px;font-weight:900;}',

      /* ══════════════════════════════════════════════════
         Cash page (v32pg) — หน้าลิ้นชักเงินสด
      ══════════════════════════════════════════════════ */
      /* page wrapper */
      '.v32pg{max-width:860px;margin:0 auto;padding:0 4px 32px;display:flex;flex-direction:column;gap:20px;}',

      /* hero card */
      '.v32hc{background:linear-gradient(135deg,#3e2723 0%,#6d4c41 60%,#4e342e 100%);',
      'border-radius:24px;padding:28px;box-shadow:0 12px 40px rgba(62,39,35,.35);color:#fff;overflow:hidden;}',
      '.v32hc-top{display:flex;align-items:flex-start;gap:18px;margin-bottom:22px;}',
      '.v32hc-icon{width:64px;height:64px;background:rgba(255,255,255,.15);border-radius:18px;flex-shrink:0;',
      'display:flex;align-items:center;justify-content:center;font-size:32px;',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.25);}',
      '.v32hc-icon .material-icons-round{font-size:32px;color:#FFD54F;}',
      '.v32hc-right{flex:1;min-width:0;}',
      '.v32hc-lbl{font-size:13px;color:rgba(255,255,255,.75);font-weight:600;margin-bottom:4px;}',
      '.v32hc-amt{font-size:42px;font-weight:900;line-height:1.1;color:#FFD54F;letter-spacing:-1px;}',
      '.v32hc-st{font-size:12px;color:rgba(255,255,255,.65);margin-top:6px;font-weight:500;}',
      '.v32hc-stats{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;',
      'background:rgba(0,0,0,.25);border-radius:14px;padding:14px 18px;gap:0;}',
      '.v32hc-stat{text-align:center;}',
      '.v32hc-slbl{display:block;font-size:11px;color:rgba(255,255,255,.6);font-weight:600;margin-bottom:4px;}',
      '.v32hc-sval{font-size:18px;font-weight:800;color:#fff;}',
      '.v32hc-sval.green{color:#69f0ae;}',
      '.v32hc-sval.red{color:#ff6b6b;}',
      '.v32hc-sdiv{width:1px;height:36px;background:rgba(255,255,255,.2);}',
      '@media(max-width:520px){',
      '.v32hc-amt{font-size:32px;}',
      '.v32hc-stats{grid-template-columns:1fr auto 1fr;grid-template-rows:auto auto;}',
      '}',

      /* action buttons */
      '.v32acts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}',
      '@media(max-width:560px){.v32acts{grid-template-columns:repeat(2,1fr);}}',
      '.v32act{display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 12px;',
      'border-radius:18px;border:none;cursor:pointer;transition:all .2s;font-family:"Prompt",sans-serif;font-weight:700;font-size:13px;}',
      '.v32act i{font-size:28px;}',
      '.v32act:disabled{opacity:.4;cursor:not-allowed;transform:none!important;}',
      '.v32act:not(:disabled):hover{transform:translateY(-4px);box-shadow:0 12px 28px rgba(0,0,0,.18);}',
      '.v32act-open{background:linear-gradient(135deg,#1b5e20,#2e7d32);color:#fff;}',
      '.v32act-open i{color:#a5d6a7;}',
      '.v32act-add{background:linear-gradient(135deg,#0d47a1,#1565c0);color:#fff;}',
      '.v32act-add i{color:#90caf9;}',
      '.v32act-wd{background:linear-gradient(135deg,#e65100,#ef6c00);color:#fff;}',
      '.v32act-wd i{color:#ffcc80;}',
      '.v32act-exc{background:linear-gradient(135deg,#4a148c,#6a1b9a);color:#fff;}',
      '.v32act-exc i{color:#ce93d8;}',

      /* denomination breakdown card */
      '.v32dc{background:#fff;border-radius:20px;padding:20px;border:2px solid #ede0d8;',
      'box-shadow:0 4px 20px rgba(0,0,0,.07);}',
      '.v32dc-hdr{display:flex;justify-content:space-between;align-items:center;',
      'font-weight:700;font-size:14px;color:#4e342e;margin-bottom:14px;}',
      '.v32dc-total{background:#3e2723;color:#FFD54F;font-size:12px;font-weight:800;',
      'padding:4px 12px;border-radius:99px;}',
      '.v32dc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;}',
      '.v32dc-chip{display:flex;flex-direction:column;align-items:center;padding:10px 6px;',
      'border-radius:12px;font-family:"Prompt",sans-serif;}',
      '.v32dc-chip .dc-val{font-size:16px;font-weight:900;color:#fff;}',
      '.v32dc-chip .dc-qty{font-size:11px;font-weight:700;color:rgba(255,255,255,.85);margin-top:2px;}',
      '.v32dc-chip .dc-sub{font-size:10px;color:rgba(255,255,255,.65);}',
      '.v32dc-coin{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
      'font-size:16px;font-weight:900;margin-bottom:4px;color:#fff;}',

      /* transaction history card */
      '.v32txc{background:#fff;border-radius:20px;border:2px solid #ede0d8;overflow:hidden;',
      'box-shadow:0 4px 20px rgba(0,0,0,.07);}',
      '.v32txc-hdr{display:flex;justify-content:space-between;align-items:center;',
      'padding:18px 20px;border-bottom:2px solid #f5ede8;font-weight:700;font-size:14px;color:#4e342e;}',
      '.v32txc-hdr i{font-size:18px;color:#8d6e63;vertical-align:middle;margin-right:6px;}',
      '.v32txc-count{background:#efebe9;color:#6d4c41;font-size:11px;font-weight:800;',
      'padding:3px 10px;border-radius:99px;}',
      '.v32txc .transactions-list{max-height:420px;overflow-y:auto;padding:12px 16px;}',
      '.transaction-note{font-size:11px;color:#9e9e9e;margin-top:1px;}',
    ].join('');
    document.head.appendChild(s);
  })();

  /* ═══════════════════════════════════════════════════════════
     โหลด denomination stock จากลิ้นชักปัจจุบัน
  ═══════════════════════════════════════════════════════════ */
  async function _loadDrawer() {
    var drawer = {};
    ALL.forEach(function (d) { drawer[d.v] = 0; });
    try {
      var r = await db.from('cash_session').select('*').eq('status', 'open')
        .order('opened_at', { ascending: false }).limit(1).maybeSingle();
      var sess = r.data;
      if (!sess) return drawer;

      var od = sess.opening_denominations || sess.denominations || {};
      Object.keys(od).forEach(function (k) {
        var n = Number(k);
        if (drawer[n] !== undefined) drawer[n] += Number(od[k]) || 0;
      });

      var r2 = await db.from('cash_transaction')
        .select('direction,denominations,change_denominations')
        .eq('session_id', sess.id);
      (r2.data || []).forEach(function (tx) {
        var dir = tx.direction === 'in' ? 1 : -1;
        var den = tx.denominations || {};
        var chg = tx.change_denominations || {};
        ALL.forEach(function (d) {
          drawer[d.v] += dir * (Number(den[d.v]) || 0);
          if (tx.direction === 'in') drawer[d.v] -= Number(chg[d.v]) || 0;
          else drawer[d.v] += Number(chg[d.v]) || 0;
        });
      });

      ALL.forEach(function (d) { if (drawer[d.v] < 0) drawer[d.v] = 0; });
    } catch (e) { console.warn('[v32] loadDrawer:', e); }
    return drawer;
  }

  /* ═══════════════════════════════════════════════════════════
     Card builders — identical to v27 + input row below
  ═══════════════════════════════════════════════════════════ */
  function _billCell(d, cnt, avail) {
    var ha    = avail !== null && avail !== undefined;
    var empty = ha && avail <= 0;
    var v     = d.v;
    var card  =
      '<div class="v27bc' + (empty ? ' mt' : '') + '" ' +
        'onclick="window._v32add(' + v + ')" ' +
        'oncontextmenu="event.preventDefault();window._v32rem(' + v + ')">' +
        '<div class="v27cs"></div><div class="v27cl"></div>' +
        '<div class="v27bd' + (cnt === 0 ? ' z' : '') + '" id="v32b' + v + '" style="background:' + d.c + ';">' + (cnt > 0 ? cnt : '0') + '</div>' +
        '<div class="v27bv" style="background:' + d.bg + ';"><span>' + v + '</span></div>' +
        '<div class="v27bn">฿' + d.l + '</div>' +
        (ha ? '<div class="v27ba">' + (empty ? 'หมด' : avail + ' ใบ') + '</div>' : '') +
      '</div>';
    var row =
      '<div class="v32-qrow">' +
        '<button type="button" class="v32-qbtn" onclick="window._v32rem(' + v + ')">−</button>' +
        '<input type="number" id="v32inp' + v + '" class="v32-qinp" value="' + cnt + '" min="0"' +
          (ha ? ' max="' + avail + '"' : '') +
          ' oninput="window._v32inp(' + v + ',this.value)">' +
        '<button type="button" class="v32-qbtn" onclick="window._v32add(' + v + ')">+</button>' +
      '</div>' +
      '<div id="v32sub' + v + '" class="v32-sub">' + (cnt > 0 ? '฿' + _f(cnt * v) : '') + '</div>';
    return '<div class="v32-cell">' + card + row + '</div>';
  }

  function _coinCell(d, cnt, avail) {
    var ha    = avail !== null && avail !== undefined;
    var empty = ha && avail <= 0;
    var v     = d.v;
    var card  =
      '<div class="v27cc' + (empty ? ' mt' : '') + '" ' +
        'onclick="window._v32add(' + v + ')" ' +
        'oncontextmenu="event.preventDefault();window._v32rem(' + v + ')">' +
        '<div class="v27bd' + (cnt === 0 ? ' z' : '') + '" id="v32b' + v + '" style="background:#4e342e;">' + (cnt > 0 ? cnt : '0') + '</div>' +
        '<div class="v27cv" style="background:' + d.bg + ';' + (d.bdr ? 'border:' + d.bdr + ';' : '') + '">' + d.l + '</div>' +
        '<div class="v27bn">฿' + d.l + '</div>' +
        (ha ? '<div class="v27ba">' + (empty ? 'หมด' : avail + 'x') + '</div>' : '') +
      '</div>';
    var row =
      '<div class="v32-qrow">' +
        '<button type="button" class="v32-qbtn" onclick="window._v32rem(' + v + ')">−</button>' +
        '<input type="number" id="v32inp' + v + '" class="v32-qinp" value="' + cnt + '" min="0"' +
          (ha ? ' max="' + avail + '"' : '') +
          ' oninput="window._v32inp(' + v + ',this.value)">' +
        '<button type="button" class="v32-qbtn" onclick="window._v32add(' + v + ')">+</button>' +
      '</div>' +
      '<div id="v32sub' + v + '" class="v32-sub">' + (cnt > 0 ? '฿' + _f(cnt * v) : '') + '</div>';
    return '<div class="v32-cell">' + card + row + '</div>';
  }

  /* ═══════════════════════════════════════════════════════════
     showDenomWizard — v27-style overlay + input fields
     opts: {
       title, subtitle, icon,
       step, totalSteps,
       targetAmount, mustBeExact,
       maxBalance,
       drawer,
       showBalance, balance,
       confirmText, cancelText, dir
     }
     returns Promise<{v:qty,...}|null>
  ═══════════════════════════════════════════════════════════ */
  function showDenomWizard(opts) {
    return new Promise(function (resolve) {
      var old = document.getElementById('v32ov');
      if (old) old.remove();

      var st     = {};
      ALL.forEach(function (d) { st[d.v] = 0; });
      var drawer = opts.drawer || null;
      var target = opts.targetAmount || 0;
      var exact  = opts.mustBeExact || false;
      var maxBal = opts.maxBalance;

      var ov = document.createElement('div');
      ov.className = 'v27ov';
      ov.id = 'v32ov';

      function gT() {
        var s = 0;
        ALL.forEach(function (d) { s += d.v * (st[d.v] || 0); });
        return s;
      }
      function chkOk(total) {
        if (maxBal !== undefined && total > maxBal) return false;
        if (maxBal !== undefined && total === 0) return false;
        if (target > 0) return exact ? Math.abs(total - target) < 0.01 : total >= target;
        return true;
      }

      function render() {
        var total = gT();
        var ok    = chkOk(total);

        var stepHtml = '';
        if (opts.step && opts.totalSteps > 1) {
          stepHtml = '<div class="v27st">';
          for (var i = 1; i <= opts.totalSteps; i++) {
            if (i > 1) {
              stepHtml += '<div class="v27sl' + (i <= opts.step ? '" style="background:#dc2626;' : '') + '"></div>';
            }
            var cls = i < opts.step ? 'dn' : (i === opts.step ? 'ac' : 'pd');
            stepHtml += '<div class="v27sd ' + cls + '">' + (i < opts.step ? '✓' : i) + '</div>';
          }
          stepHtml += '</div>';
        }

        var balHtml = '';
        if (opts.showBalance) {
          balHtml = '<div class="v32-balbar">' +
            '<span style="color:#90A4AE;font-size:13px;font-weight:600;">💰 ยอดในลิ้นชักปัจจุบัน</span>' +
            '<span style="color:#FFB300;font-size:22px;font-weight:900;">฿' + _f(opts.balance || 0) + '</span>' +
          '</div>';
        }

        var diffText = '', diffColor = ok ? '#16a34a' : '#ef4444';
        if (target > 0) {
          if (ok)                           diffText = exact ? '✅ พอดีเป๊ะ!' : '✅ พร้อม';
          else if (exact && total > target) diffText = 'เกิน ฿' + _f(total - target);
          else                              diffText = 'ขาด ฿' + _f(target - total);
        } else if (maxBal !== undefined) {
          if (total === 0)       diffText = 'กรุณาระบุจำนวนเงิน';
          else if (total > maxBal) diffText = 'เกินลิ้นชัก ฿' + _f(total - maxBal);
          else                   diffText = 'เหลือในลิ้นชัก ฿' + _f(maxBal - total);
        }

        var cfmColor = (opts.dir === 'out') ? 'cf' : 'nx';
        var icon = opts.icon || '<i class="material-icons-round">payments</i>';

        ov.innerHTML =
          '<div class="v27pop"><div class="v27in">' +
          stepHtml +
          '<div class="v27hdr">' +
            '<div>' +
              '<div class="v27ht">' + icon + ' ' + (opts.title || 'นับเงิน') + '</div>' +
              '<div class="v27hs">' + (opts.subtitle || 'กดแบงค์เพื่อนับ · พิมพ์จำนวนในช่อง · คลิกขวาเพื่อลบ') + '</div>' +
            '</div>' +
            (target > 0 ? (
              '<div style="text-align:right;">' +
                '<div class="v27hl">' + (exact ? '🎯 ต้องพอดีเป๊ะ' : 'เป้าหมาย') + '</div>' +
                '<div class="v27ha" style="color:' + (exact ? '#d97706' : '#3e2723') + ';">฿' + _f(target) + '</div>' +
              '</div>'
            ) : '') +
          '</div>' +
          balHtml +
          '<div class="v27sc"><h3>💵 ธนบัตร' + (drawer ? 'ในลิ้นชัก' : '') + '</h3><div class="ln"></div></div>' +
          '<div class="v27bg">' + BILLS.map(function (d) { return _billCell(d, st[d.v], drawer ? drawer[d.v] : null); }).join('') + '</div>' +
          '<div class="v27sc"><h3>🪙 เหรียญ' + (drawer ? 'ในลิ้นชัก' : '') + '</h3><div class="ln"></div></div>' +
          '<div class="v27cg">' + COINS.map(function (d) { return _coinCell(d, st[d.v], drawer ? drawer[d.v] : null); }).join('') + '</div>' +
          '<div class="v32-totrow">' +
            '<div><div class="lb">รวมที่นับแล้ว</div>' +
            '<div id="v32totval" class="vl" style="color:' + (ok ? '#16a34a' : '#ef4444') + ';">฿' + _f(total) + '</div></div>' +
            (diffText ? (
              '<div style="text-align:right;"><div class="lb">&nbsp;</div>' +
              '<div id="v32diff" style="font-size:15px;font-weight:800;color:' + diffColor + ';">' + diffText + '</div></div>'
            ) : '<div id="v32diff"></div>') +
          '</div>' +
          '<div class="v27bt">' +
            '<button class="v27b ca" onclick="window._v32cancel()">' +
              '<i class="material-icons-round">close</i> ' + (opts.cancelText || 'ยกเลิก') +
            '</button>' +
            '<button class="v27b ca" onclick="window._v32reset()">' +
              '<i class="material-icons-round">refresh</i> ล้าง' +
            '</button>' +
            '<button id="v32cfm" class="v27b ' + cfmColor + '" ' + (ok ? '' : 'disabled') + ' onclick="window._v32confirm()">' +
              '<i class="material-icons-round">check_circle</i> ' + (opts.confirmText || 'ยืนยัน') +
            '</button>' +
          '</div></div></div>';
      }

      /* in-place DOM updates — ป้องกัน cursor กระโดดเวลากด +/- */
      function _domUpdate(v) {
        var qty = st[v] || 0;
        var inp = document.getElementById('v32inp' + v);
        if (inp && parseInt(inp.value) !== qty) inp.value = qty;
        var badge = document.getElementById('v32b' + v);
        if (badge) { badge.textContent = qty || '0'; badge.className = 'v27bd' + (qty === 0 ? ' z' : ''); }
        var sub = document.getElementById('v32sub' + v);
        if (sub) sub.textContent = qty > 0 ? '฿' + _f(qty * v) : '';
      }

      function _totalUpdate() {
        var total = gT();
        var ok    = chkOk(total);
        var totEl = document.getElementById('v32totval');
        var difEl = document.getElementById('v32diff');
        var btn   = document.getElementById('v32cfm');

        if (totEl) { totEl.textContent = '฿' + _f(total); totEl.style.color = ok ? '#16a34a' : '#ef4444'; }

        var dt = '', dc = ok ? '#16a34a' : '#ef4444';
        if (target > 0) {
          if (ok)                           dt = exact ? '✅ พอดีเป๊ะ!' : '✅ พร้อม';
          else if (exact && total > target) dt = 'เกิน ฿' + _f(total - target);
          else                              dt = 'ขาด ฿' + _f(target - total);
        } else if (maxBal !== undefined) {
          if (total === 0)       dt = 'กรุณาระบุจำนวนเงิน';
          else if (total > maxBal) dt = 'เกินลิ้นชัก ฿' + _f(total - maxBal);
          else                   dt = 'เหลือในลิ้นชัก ฿' + _f(maxBal - total);
        }
        if (difEl) { difEl.textContent = dt; difEl.style.color = dc; }
        if (btn) btn.disabled = !ok;
      }

      window._v32add = function (v) {
        var max = drawer ? (drawer[v] || 0) : Infinity;
        if ((st[v] || 0) >= max) return;
        st[v] = (st[v] || 0) + 1;
        _domUpdate(v); _totalUpdate();
      };
      window._v32rem = function (v) {
        if ((st[v] || 0) <= 0) return;
        st[v] = (st[v] || 0) - 1;
        _domUpdate(v); _totalUpdate();
      };
      window._v32inp = function (v, val) {
        var qty = Math.max(0, parseInt(val) || 0);
        if (drawer && drawer[v] !== undefined) qty = Math.min(qty, drawer[v] || 0);
        st[v] = qty;
        _domUpdate(v); _totalUpdate();
      };
      window._v32confirm = function () {
        if (!chkOk(gT())) return;
        _close(); resolve(Object.assign({}, st));
      };
      window._v32cancel = function () { _close(); resolve(null); };
      window._v32reset  = function () {
        ALL.forEach(function (d) { st[d.v] = 0; _domUpdate(d.v); });
        _totalUpdate();
      };

      function _close() {
        ov.remove();
        ['_v32add','_v32rem','_v32inp','_v32confirm','_v32cancel','_v32reset'].forEach(function (k) { window[k] = null; });
      }

      render();
      document.body.appendChild(ov);
      _totalUpdate();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     openCashSession — เปิดลิ้นชักประจำวัน
  ═══════════════════════════════════════════════════════════ */
  window.openCashSession = async function () {
    var counts = await showDenomWizard({
      title: 'เปิดลิ้นชักประจำวัน',
      subtitle: 'นับเงินเปิดต้นวัน — กดแบงค์เพื่อเพิ่ม หรือพิมพ์จำนวนโดยตรงในช่อง',
      icon: '<i class="material-icons-round">lock_open</i>',
      dir: 'in',
      confirmText: 'เปิดลิ้นชัก ✓'
    });
    if (!counts) return;

    var total = ALL.reduce(function (s, d) { return s + d.v * (counts[d.v] || 0); }, 0);

    try {
      var ins = await db.from('cash_session').insert({
        opened_by: _user(),
        opening_amt: total,
        denominations: counts,
        opening_denominations: counts
      });
      if (ins.error) throw ins.error;
      if (typeof toast === 'function') toast('เปิดลิ้นชักสำเร็จ — ยอดเปิด ฿' + _f(total), 'success');
      if (typeof logActivity === 'function') logActivity('เปิดลิ้นชัก', 'ยอดเปิด ฿' + _f(total));
      window.renderCashDrawer();
    } catch (e) {
      if (typeof toast === 'function') toast('เปิดลิ้นชักไม่ได้: ' + (e.message || e), 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════════
     cashAddMoney — เพิ่มเงินเข้าลิ้นชัก (override cashMovement 'add')
  ═══════════════════════════════════════════════════════════ */
  window.cashAddMoney = async function (session) {
    if (!session) { if (typeof toast === 'function') toast('กรุณาเปิดลิ้นชักก่อน', 'warning'); return; }

    var counts = await showDenomWizard({
      title: 'เพิ่มเงินเข้าลิ้นชัก',
      subtitle: 'นับธนบัตร/เหรียญที่ต้องการเพิ่มเข้าลิ้นชัก',
      icon: '<i class="material-icons-round">add_circle</i>',
      dir: 'in',
      confirmText: 'เพิ่มเงิน ✓'
    });
    if (!counts) return;

    var total = ALL.reduce(function (s, d) { return s + d.v * (counts[d.v] || 0); }, 0);
    if (total <= 0) { if (typeof toast === 'function') toast('กรุณาระบุจำนวนเงิน', 'warning'); return; }

    /* หมายเหตุ (optional) */
    var note = '';
    try {
      var r = await Swal.fire({
        title: 'หมายเหตุการเพิ่มเงิน (ถ้ามี)',
        input: 'text', inputPlaceholder: 'เช่น เงินเพิ่มจากแคชเชียร์',
        showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ข้าม',
        confirmButtonColor: '#1565c0'
      });
      if (r.isConfirmed) note = r.value || '';
      if (!r.isConfirmed && r.isDismissed && r.dismiss === Swal.DismissReason.cancel) {
        /* ข้ามหมายเหตุ — ยังบันทึก */
        note = '';
      } else if (r.isDismissed) {
        /* กด Esc / backdrop → ยกเลิก */
        return;
      }
    } catch (e) { /* ignore */ }

    try {
      var ins = await db.from('cash_transaction').insert({
        session_id: session.id, type: 'เพิ่มเงิน', direction: 'in',
        amount: total, net_amount: total, balance_after: 0,
        staff_name: _user(), note: note || null,
        denominations: counts
      });
      if (ins.error) throw ins.error;
      if (typeof toast === 'function') toast('เพิ่มเงินสำเร็จ ฿' + _f(total), 'success');
      if (typeof logActivity === 'function') logActivity('เพิ่มเงิน', '฿' + _f(total));
      window.renderCashDrawer();
    } catch (e) {
      if (typeof toast === 'function') toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════════
     cashExchange — แลกเงิน 2 ขั้นตอน
  ═══════════════════════════════════════════════════════════ */
  window.cashExchange = async function () {
    var sr = await db.from('cash_session').select('*').eq('status', 'open')
      .order('opened_at', { ascending: false }).limit(1).maybeSingle();
    var session = sr.data || null;
    if (!session) {
      if (typeof toast === 'function') toast('กรุณาเปิดลิ้นชักก่อน', 'warning');
      return;
    }

    var drawer = await _loadDrawer();
    var txRes  = await db.from('cash_transaction').select('net_amount,direction').eq('session_id', session.id);
    var bal = session.opening_amt || 0;
    (txRes.data || []).forEach(function (tx) { bal += tx.direction === 'in' ? tx.net_amount : -tx.net_amount; });

    /* Step 1: นับออก */
    var outCounts = await showDenomWizard({
      title: 'แลกเงิน — นับเงินออก',
      subtitle: 'นับธนบัตร/เหรียญที่จะออกจากลิ้นชัก — ห้ามเกินยอดที่มีอยู่',
      icon: '<i class="material-icons-round">currency_exchange</i>',
      step: 1, totalSteps: 2,
      drawer: drawer,
      maxBalance: bal,
      showBalance: true, balance: bal,
      dir: 'out',
      confirmText: 'ถัดไป: นับเงินเข้า →',
      cancelText: 'ยกเลิก'
    });
    if (!outCounts) return;

    var outTotal = ALL.reduce(function (s, d) { return s + d.v * (outCounts[d.v] || 0); }, 0);

    /* Step 2: นับเข้า — ต้องพอดีเป๊ะ */
    var inCounts = await showDenomWizard({
      title: 'แลกเงิน — นับเงินเข้า',
      subtitle: 'นับธนบัตร/เหรียญที่จะเข้าลิ้นชัก — ต้องพอดีเป๊ะกับยอดออก ห้ามขาดห้ามเกิน',
      icon: '<i class="material-icons-round">currency_exchange</i>',
      step: 2, totalSteps: 2,
      targetAmount: outTotal,
      mustBeExact: true,
      dir: 'in',
      confirmText: 'ยืนยันแลกเงิน ✓',
      cancelText: 'ย้อนกลับ'
    });
    if (!inCounts) return;

    var inTotal  = ALL.reduce(function (s, d) { return s + d.v * (inCounts[d.v] || 0); }, 0);

    var conf = await Swal.fire({
      title: 'ยืนยันการแลกเงิน',
      html: (
        '<div style="font-family:Prompt,sans-serif;text-align:left;">' +
        '<div style="display:flex;justify-content:space-between;padding:12px 4px;border-bottom:1px solid #f3f4f6;">' +
          '<span style="color:#6b7280;">เงินออก</span>' +
          '<span style="font-size:16px;font-weight:800;color:#dc2626;">−฿' + _f(outTotal) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:12px 4px;border-bottom:1px solid #f3f4f6;">' +
          '<span style="color:#6b7280;">เงินเข้า</span>' +
          '<span style="font-size:16px;font-weight:800;color:#16a34a;">+฿' + _f(inTotal) + '</span></div>' +
        '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 14px;margin-top:12px;font-size:13px;color:#15803d;font-weight:700;">✓ ยอดสมดุล — แลกครบถ้วน</div>' +
        '</div>'
      ),
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#6b4c9a',
      width: '400px'
    });
    if (!conf.isConfirmed) return;

    try {
      await Promise.all([
        db.from('cash_transaction').insert({
          session_id: session.id, type: 'แลกเงินออก', direction: 'out',
          amount: outTotal, net_amount: outTotal, balance_after: 0,
          staff_name: _user(), note: 'แลกเงิน — เงินออก', denominations: outCounts
        }),
        db.from('cash_transaction').insert({
          session_id: session.id, type: 'แลกเงินเข้า', direction: 'in',
          amount: inTotal, net_amount: inTotal, balance_after: 0,
          staff_name: _user(), note: 'แลกเงิน — เงินเข้า', denominations: inCounts
        })
      ]);
      if (typeof toast === 'function') toast('แลกเงินสำเร็จ', 'success');
      if (typeof logActivity === 'function') logActivity('แลกเงิน', 'ออก ฿' + _f(outTotal) + ' เข้า ฿' + _f(inTotal));
      window.renderCashDrawer();
    } catch (e) {
      if (typeof toast === 'function') toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════════
     renderCashDrawer — หน้าลิ้นชักเงินสด (premium UI)
  ═══════════════════════════════════════════════════════════ */
  window.renderCashDrawer = async function () {
    try {
      var openBtn  = document.getElementById('cash-open-btn');
      var closeBtn = document.getElementById('cash-close-btn');
      var addBtn   = document.getElementById('cash-add-btn');
      var wdBtn    = document.getElementById('cash-withdraw-btn');

      /* ดึง session */
      var sr = await db.from('cash_session').select('*').eq('status', 'open')
        .order('opened_at', { ascending: false }).limit(1).maybeSingle();
      var session = sr.data || null;

      /* auto daily reset */
      if (session) {
        var sesDate = (session.opened_at || '').split('T')[0];
        if (sesDate < _today()) {
          var oldTx  = await db.from('cash_transaction').select('net_amount,direction').eq('session_id', session.id);
          var oldBal = session.opening_amt || 0;
          (oldTx.data || []).forEach(function (tx) { oldBal += tx.direction === 'in' ? tx.net_amount : -tx.net_amount; });
          await db.from('cash_session').update({
            status: 'closed', closed_at: _now(),
            closed_by: 'ระบบ (รีเซ็ตอัตโนมัติ)', closing_amt: oldBal,
            note: 'รีเซ็ตอัตโนมัติเมื่อเริ่มวันใหม่'
          }).eq('id', session.id);
          session = null;
          if (typeof toast === 'function') toast('รีเซ็ตลิ้นชักอัตโนมัติ — กรุณาเปิดลิ้นชักวันนี้', 'info');
        }
      }

      /* คำนวณยอด + stats */
      var balance = 0, transactions = [], dayIn = 0, dayOut = 0;
      if (session) {
        var tr = await db.from('cash_transaction').select('*').eq('session_id', session.id).order('created_at', { ascending: false });
        transactions = tr.data || [];
        balance = session.opening_amt || 0;
        transactions.forEach(function (tx) {
          if (tx.direction === 'in') { balance += tx.net_amount; dayIn += tx.net_amount; }
          else { balance -= tx.net_amount; dayOut += tx.net_amount; }
        });
      }

      /* ── Hero card ── */
      var amtEl  = document.getElementById('cash-current-balance');
      var stEl   = document.getElementById('cash-session-status');
      var inEl   = document.getElementById('v32-day-in');
      var outEl  = document.getElementById('v32-day-out');
      var opnEl  = document.getElementById('v32-open-amt');
      if (amtEl)  amtEl.textContent  = '฿' + _f(balance);
      if (stEl)   stEl.textContent   = session
        ? ('เปิดลิ้นชักเมื่อ ' + _fdt(session.opened_at) + ' โดย ' + (session.opened_by || ''))
        : 'ยังไม่ได้เปิดลิ้นชักวันนี้';
      if (inEl)   inEl.textContent   = '฿' + _f(dayIn);
      if (outEl)  outEl.textContent  = '฿' + _f(dayOut);
      if (opnEl)  opnEl.textContent  = '฿' + _f(session ? (session.opening_amt || 0) : 0);

      /* ── Hero color: ถ้าไม่มี session ทำให้ dim ── */
      var hero = document.getElementById('v32-hero');
      if (hero) hero.style.opacity = session ? '1' : '.75';

      /* ── ปุ่ม ── */
      var noSess = !session;
      if (openBtn)  { openBtn.disabled  = !noSess;  openBtn.onclick  = function () { window.openCashSession(); }; }
      if (addBtn)   { addBtn.disabled   = noSess;   addBtn.onclick   = function () { window.cashAddMoney(session); }; }
      if (wdBtn)    { wdBtn.disabled    = noSess;   wdBtn.onclick    = function () { if (typeof v4OpenWithdrawWizard === 'function') v4OpenWithdrawWizard(session); else cashMovement('withdraw', session); }; }
      if (closeBtn) { closeBtn.disabled = noSess;   closeBtn.onclick = function () { window.cashExchange(); }; }

      /* ── Denomination breakdown ── */
      var denomSec  = document.getElementById('v32-denom-section');
      var denomList = document.getElementById('v32-denom-list');
      var denomTot  = document.getElementById('v32-denom-total');
      if (denomSec) denomSec.style.display = session ? '' : 'none';

      if (session && denomList) {
        var drawer = await _loadDrawer();
        var denomHtml = '';
        var denomSum  = 0;

        BILLS.forEach(function (d) {
          var qty = drawer[d.v] || 0;
          if (qty <= 0) return;
          denomSum += d.v * qty;
          denomHtml +=
            '<div class="v32dc-chip" style="background:' + d.bg + ';">' +
              '<div class="dc-val">฿' + d.l + '</div>' +
              '<div class="dc-qty">' + qty + ' ใบ</div>' +
              '<div class="dc-sub">฿' + _f(d.v * qty) + '</div>' +
            '</div>';
        });
        COINS.forEach(function (d) {
          var qty = drawer[d.v] || 0;
          if (qty <= 0) return;
          denomSum += d.v * qty;
          denomHtml +=
            '<div class="v32dc-chip" style="background:rgba(0,0,0,.06);border:1.5px solid #ddd;">' +
              '<div class="v32dc-coin" style="background:' + d.bg + ';border:' + (d.bdr || '') + '">' +
                '<span style="color:#3e2723;font-size:13px;font-weight:900;">' + d.l + '</span>' +
              '</div>' +
              '<div class="dc-qty" style="color:#555;">' + qty + 'x</div>' +
              '<div class="dc-sub" style="color:#777;">฿' + _f(d.v * qty) + '</div>' +
            '</div>';
        });

        denomList.innerHTML = denomHtml || '<p style="color:#9e9e9e;font-size:13px;padding:8px 0;">ไม่มีข้อมูล denomination</p>';
        if (denomTot) denomTot.textContent = '฿' + _f(denomSum);
      }

      /* ── Transaction count ── */
      var txCnt = document.getElementById('v32-tx-count');
      if (txCnt) txCnt.textContent = transactions.length + ' รายการ';

      /* ── Transaction list ── */
      var txList = document.getElementById('cash-transactions');
      if (txList) {
        if (transactions.length === 0) {
          txList.innerHTML = '<p style="text-align:center;color:#9CA3AF;padding:40px 20px;">ไม่มีรายการวันนี้</p>';
        } else {
          txList.innerHTML = transactions.map(function (tx) {
            var isIn  = tx.direction === 'in';
            var isExc = tx.type === 'แลกเงินออก' || tx.type === 'แลกเงินเข้า';
            var icon  = isExc ? 'currency_exchange' : (isIn ? 'add' : 'remove');
            return '<div class="transaction-item">' +
              '<div class="transaction-icon ' + tx.direction + '"><i class="material-icons-round">' + icon + '</i></div>' +
              '<div class="transaction-info">' +
                '<div class="transaction-title">' + (tx.type || '') + '</div>' +
                '<div class="transaction-time">' + _fdt(tx.created_at) + ' — ' + (tx.staff_name || '') + '</div>' +
                (tx.note ? '<div class="transaction-note">' + tx.note + '</div>' : '') +
              '</div>' +
              '<div class="transaction-amount ' + (isIn ? 'positive' : 'negative') + '">' +
                (isIn ? '+' : '−') + '฿' + _f(tx.net_amount) +
              '</div></div>';
          }).join('');
        }
      }

      /* ── Global balance ── */
      var gBal = document.getElementById('global-cash-balance');
      if (gBal) gBal.textContent = '฿' + _f(balance);

    } catch (e) { console.error('[v32] renderCashDrawer:', e); }
  };

  /* Expose the Promise-based wizard + drawer loader for v33 reuse */
  window.v32ShowDenomWizard = showDenomWizard;
  window.v32LoadDrawer = _loadDrawer;

  console.info('%c[v32-cashui] ✅%c premium UI + denomination + แลกเงิน + เพิ่มเงิน + auto reset', 'color:#9a25ae;font-weight:700', 'color:#6b7280');

})();
