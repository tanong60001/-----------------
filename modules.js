/**
 * SK POS v2.0 — modules.js
 * โหลดหลัง app.js | ใช้ตัวแปร db, USER, BILLS, COINS, formatNum, toast, openModal, closeModal จาก app.js
 */
'use strict';

// ══════════════════════════════════════════════════════════════════
// DENOMINATION HELPERS
// ══════════════════════════════════════════════════════════════════

function emptyDenoms() {
  const s = {};
  [...BILLS, ...COINS].forEach(d => { s[d.value] = 0; });
  return s;
}
function denomTotal(state) {
  return [...BILLS, ...COINS].reduce((s, d) => s + (state[d.value] || 0) * d.value, 0);
}
function calcAutoChange(amount) {
  const result = {};
  let rem = Math.round(amount);
  [...BILLS, ...COINS].forEach(d => {
    result[d.value] = Math.floor(rem / d.value);
    rem -= result[d.value] * d.value;
  });
  return result;
}
function denomGridHTML(state, prefix, onFn, readOnly) {
  const card = (d, isCoin) => {
    const qty = state[d.value] || 0;
    return `<div class="denom-card ${isCoin?'coin-card':''}" style="--denom-bg:${d.bg};--denom-color:${d.color}" onclick="${readOnly?'':onFn+'('+d.value+',1)'}">
      <div class="denom-card-inner">
        <div class="denom-face ${isCoin?'coin-face':''}">฿${d.label}</div>
        <div class="denom-count-badge" id="${prefix}-badge-${d.value}">${qty}</div>
      </div>
      <div class="denom-subtotal" id="${prefix}-sub-${d.value}">= ฿${formatNum(qty*d.value)}</div>
      ${readOnly?'':
        `<div class="denom-controls">
          <button onclick="event.stopPropagation();${onFn}(${d.value},-1)" class="denom-minus-btn">−</button>
          <span class="denom-qty" id="${prefix}-qty-${d.value}">${qty}</span>
          <button onclick="event.stopPropagation();${onFn}(${d.value},1)" class="denom-plus-btn">+</button>
        </div>`}
    </div>`;
  };
  return `<div class="denom-section-title"><i class="material-icons-round">payments</i> ธนบัตร</div>
    <div class="denomination-grid">${BILLS.map(d=>card(d,false)).join('')}</div>
    <div class="denom-section-title coins"><i class="material-icons-round">toll</i> เหรียญ</div>
    <div class="denomination-grid coins-grid">${COINS.map(d=>card(d,true)).join('')}</div>`;
}
function refreshDenomUI(state, prefix) {
  let total = 0;
  [...BILLS, ...COINS].forEach(d => {
    const qty = state[d.value] || 0;
    total += qty * d.value;
    const badge = document.getElementById(`${prefix}-badge-${d.value}`);
    const qtyEl = document.getElementById(`${prefix}-qty-${d.value}`);
    const sub   = document.getElementById(`${prefix}-sub-${d.value}`);
    if (badge) badge.textContent = qty;
    if (qtyEl) qtyEl.textContent = qty;
    if (sub)   sub.textContent   = `= ฿${formatNum(qty*d.value)}`;
  });
  return total;
}

// ══════════════════════════════════════════════════════════════════
// 01. CASH LEDGER
// ══════════════════════════════════════════════════════════════════

async function getLiveCashBalance() {
  try {
    const { data: sess } = await db.from('cash_session').select('id,opening_amt')
      .eq('status','open').order('opened_at',{ascending:false}).limit(1).single();
    if (!sess) return 0;
    const { data: txs } = await db.from('cash_transaction').select('net_amount,direction').eq('session_id',sess.id);
    let bal = sess.opening_amt || 0;
    (txs||[]).forEach(t => { bal += t.direction==='in' ? t.net_amount : -t.net_amount; });
    return bal;
  } catch { return 0; }
}
async function assertCashEnough(amount, label) {
  const bal = await getLiveCashBalance();
  if (bal < amount) throw new Error(`เงินในลิ้นชักไม่พอ${label||''}\nมีอยู่ ฿${formatNum(bal)} | ต้องการ ฿${formatNum(amount)}`);
  return bal;
}
async function recordCashTx({ sessionId, type, direction, amount, changeAmt=0, netAmount, refId, refTable, denominations, note }) {
  const bal = await getLiveCashBalance();
  const after = direction==='in' ? bal+netAmount : bal-netAmount;
  await db.from('cash_transaction').insert({
    session_id: sessionId, type, direction, amount, change_amt: changeAmt,
    net_amount: netAmount, balance_after: after,
    ref_id: refId||null, ref_table: refTable||null,
    staff_name: USER?.username, note: note||null, denominations: denominations||null
  });
  const el = document.getElementById('global-cash-balance');
  if (el) el.textContent = `฿${formatNum(after)}`;
}

// ══════════════════════════════════════════════════════════════════
// 02. OVERRIDE completePayment
// ══════════════════════════════════════════════════════════════════

window.completePayment = async function() {
  if (isProcessingPayment) return;
  if (checkoutState.method === 'cash' && checkoutState.change > 0) {
    try { await assertCashEnough(checkoutState.change, 'ทอนเงิน'); }
    catch(e) { Swal.fire({icon:'error',title:'เงินในลิ้นชักไม่พอทอน',text:e.message,confirmButtonColor:'#DC2626'}); return; }
  }
  isProcessingPayment = true;
  try {
    const { data: sess } = await db.from('cash_session').select('*').eq('status','open')
      .order('opened_at',{ascending:false}).limit(1).single();
    const { data: bill, error: bErr } = await db.from('บิลขาย').insert({
      date: new Date().toISOString(),
      method: {cash:'เงินสด',transfer:'โอนเงิน',credit:'บัตรเครดิต',debt:'ติดหนี้'}[checkoutState.method]||'เงินสด',
      total: checkoutState.total, discount: checkoutState.discount,
      received: checkoutState.received, change: checkoutState.change,
      customer_name: checkoutState.customer.name, customer_id: checkoutState.customer.id||null,
      staff_name: USER?.username,
      status: checkoutState.method==='debt' ? 'ค้างชำระ' : 'สำเร็จ',
      denominations: checkoutState.receivedDenominations
    }).select().single();
    if (bErr) throw bErr;
    for (const item of cart) {
      const prod = products.find(p => p.id===item.id);
      await db.from('รายการในบิล').insert({ bill_id:bill.id, product_id:item.id, name:item.name, qty:item.qty, price:item.price, cost:item.cost, total:item.price*item.qty });
      await db.from('สินค้า').update({ stock:(prod?.stock||0)-item.qty }).eq('id',item.id);
      await db.from('stock_movement').insert({ product_id:item.id, product_name:item.name, type:'ขาย', direction:'out', qty:item.qty, stock_before:prod?.stock||0, stock_after:(prod?.stock||0)-item.qty, ref_id:bill.id, ref_table:'บิลขาย', staff_name:USER?.username });
    }
    if (checkoutState.method==='cash' && sess) {
      await recordCashTx({ sessionId:sess.id, type:'ขาย', direction:'in', amount:checkoutState.received, changeAmt:checkoutState.change, netAmount:checkoutState.total, refId:bill.id, refTable:'บิลขาย', denominations:checkoutState.receivedDenominations });
    }
    if (checkoutState.customer.id) {
      const { data: cust } = await db.from('customer').select('total_purchase,visit_count,debt_amount').eq('id',checkoutState.customer.id).single();
      await db.from('customer').update({ total_purchase:(cust?.total_purchase||0)+checkoutState.total, visit_count:(cust?.visit_count||0)+1, debt_amount:checkoutState.method==='debt'?(cust?.debt_amount||0)+checkoutState.total:(cust?.debt_amount||0) }).eq('id',checkoutState.customer.id);
    }
    logActivity('ขายสินค้า',`บิล #${bill.bill_no} ยอด ฿${formatNum(checkoutState.total)}`,bill.id,'บิลขาย');
    sendToDisplay({type:'thanks',billNo:bill.bill_no,total:checkoutState.total});
    closeCheckout(); cart = [];
    await loadProducts(); renderCart(); renderProductGrid(); updateHomeStats();
    const fmt = receiptFormat || '80mm';
    const { data: bItems } = await db.from('รายการในบิล').select('*').eq('bill_id',bill.id);
    const { value: doPrint } = await Swal.fire({ icon:'success', title:`บิล #${bill.bill_no}`, html:`ยอด <strong>฿${formatNum(checkoutState.total)}</strong><br><small>พิมพ์ใบเสร็จ?</small>`, showCancelButton:true, confirmButtonText:`พิมพ์ (${fmt})`, cancelButtonText:'ข้าม', confirmButtonColor:'#10B981', timer:7000, timerProgressBar:true });
    if (doPrint) printReceipt(bill, bItems||[], fmt);
  } catch(e) { console.error(e); toast('เกิดข้อผิดพลาด: '+e.message,'error'); }
  finally { isProcessingPayment = false; }
};

// ══════════════════════════════════════════════════════════════════
// 03. RECEIPT PRINT 80mm + A4 (พร้อมต้นทุน)
// ══════════════════════════════════════════════════════════════════

let receiptFormat = '80mm';

async function getShopConfig() {
  const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).single();
  return data || {};
}

async function printReceipt(bill, items, format) {
  const rc = await getShopConfig();
  receiptFormat = format || rc.default_receipt_format || '80mm';
  if (receiptFormat === 'A4') printA4(bill, items, rc);
  else print80mm(bill, items, rc);
}

function print80mm(bill, items, rc) {
  const win = window.open('', '_blank', 'width=340,height=700');
  const rows = (items||[]).map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}${i.unit||''}</td><td style="text-align:right">฿${formatNum(i.total)}</td></tr>`).join('');
  const pp = rc.promptpay_number ? `<div style="text-align:center;margin-top:6px"><img src="https://promptpay.io/${rc.promptpay_number.replace(/[^0-9]/g,'')}.png" style="width:80px;height:80px"></div>` : '';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun',sans-serif;font-size:12px;width:72mm;padding:3mm}
  .c{text-align:center}hr{border:none;border-top:1px dashed #000;margin:3px 0}
  table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
  .tot td{font-weight:700;font-size:14px;border-top:1px solid #000;padding-top:4px}
  @media print{@page{size:72mm auto;margin:0}body{padding:2mm}}</style></head><body>
  ${rc.receipt_header?`<div class="c">${rc.receipt_header}</div><hr>`:''}
  <div class="c" style="font-size:16px;font-weight:700">${rc.shop_name||'SK POS'}</div>
  <div class="c">${rc.address||''}</div><div class="c">โทร ${rc.phone||''} TAX:${rc.tax_id||''}</div><hr>
  <div>บิล #${bill.bill_no} ${new Date(bill.date).toLocaleString('th-TH')}</div>
  <div>ลูกค้า:${bill.customer_name||'ทั่วไป'} พนักงาน:${bill.staff_name||''}</div><hr>
  <table><thead><tr><th style="text-align:left">รายการ</th><th>จำนวน</th><th style="text-align:right">รวม</th></tr></thead>
  <tbody>${rows}</tbody></table><hr>
  ${bill.discount?`<div style="display:flex;justify-content:space-between"><span>ส่วนลด</span><span>-฿${formatNum(bill.discount)}</span></div>`:''}
  <table><tr class="tot"><td>ยอดรวม</td><td style="text-align:right">฿${formatNum(bill.total)}</td></tr></table>
  ${bill.method==='เงินสด'?`<div style="display:flex;justify-content:space-between"><span>รับมา</span><span>฿${formatNum(bill.received)}</span></div><div style="display:flex;justify-content:space-between"><span>เงินทอน</span><span>฿${formatNum(bill.change)}</span></div>`:''}
  <hr><div>วิธีชำระ:${bill.method}</div>${pp}
  <div class="c" style="margin-top:6px">${rc.receipt_footer||'ขอบคุณที่ใช้บริการ'}</div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);
  win.document.close();
}

function printA4(bill, items, rc) {
  const win = window.open('', '_blank', 'width=900,height=700');
  const subtotal = (items||[]).reduce((s,i)=>s+i.total,0);
  const cost = (items||[]).reduce((s,i)=>s+(i.cost||0)*i.qty,0);
  const gp = subtotal - cost;
  const rows = (items||[]).map((i,n)=>`<tr><td>${n+1}</td><td>${i.name}</td><td>${i.qty} ${i.unit||'ชิ้น'}</td><td style="text-align:right">฿${formatNum(i.price)}</td><td style="text-align:right">฿${formatNum(i.cost||0)}</td><td style="text-align:right">฿${formatNum(i.total)}</td></tr>`).join('');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun',sans-serif;font-size:13px;padding:15mm}
  .hdr{display:flex;justify-content:space-between;margin-bottom:20px}.sn{font-size:22px;font-weight:700;color:#DC2626}
  table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#DC2626;color:#fff;padding:8px;text-align:left}
  td{padding:6px 8px;border-bottom:1px solid #eee}.sum{margin-left:auto;width:260px}
  .sr{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee}
  .grand{display:flex;justify-content:space-between;font-size:17px;font-weight:700;color:#DC2626;border-top:2px solid #DC2626;padding-top:6px;margin-top:4px}
  @media print{@page{size:A4;margin:15mm}}</style></head><body>
  <div class="hdr"><div><div class="sn">${rc.shop_name||'SK POS'}</div><div>${rc.address||''}</div><div>โทร ${rc.phone||''}</div>${rc.tax_id?`<div>เลขผู้เสียภาษี:${rc.tax_id}</div>`:''}</div>
  <div style="text-align:right"><div style="font-size:18px;font-weight:700">ใบเสร็จรับเงิน</div><div>บิล #${bill.bill_no}</div><div>${new Date(bill.date).toLocaleString('th-TH')}</div><div>ลูกค้า:${bill.customer_name||'ทั่วไป'}</div></div></div>
  <table><thead><tr><th>#</th><th>รายการ</th><th>จำนวน</th><th style="text-align:right">ราคา/หน่วย</th><th style="text-align:right">ต้นทุน</th><th style="text-align:right">รวม</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="sum">
    <div class="sr"><span>ยอดรวม</span><span>฿${formatNum(subtotal)}</span></div>
    <div class="sr"><span>ต้นทุนรวม</span><span>฿${formatNum(cost)}</span></div>
    <div class="sr"><span>กำไรขั้นต้น</span><span style="color:#059669">฿${formatNum(gp)} (${subtotal>0?Math.round(gp/subtotal*100):0}%)</span></div>
    ${bill.discount?`<div class="sr"><span>ส่วนลด</span><span style="color:#DC2626">-฿${formatNum(bill.discount)}</span></div>`:''}
    <div class="grand"><span>ยอดสุทธิ</span><span>฿${formatNum(bill.total)}</span></div>
    <div class="sr"><span>วิธีชำระ</span><span>${bill.method}</span></div>
    ${bill.method==='เงินสด'?`<div class="sr"><span>รับมา</span><span>฿${formatNum(bill.received)}</span></div><div class="sr"><span>เงินทอน</span><span>฿${formatNum(bill.change)}</span></div>`:''}
  </div>
  <div style="margin-top:16px;font-size:11px;color:#666">พนักงาน:${bill.staff_name||''} | ${rc.receipt_footer||'ขอบคุณที่ใช้บริการ'}</div>
  <script>window.onload=()=>{window.print()}<\/script></body></html>`);
  win.document.close();
}

// ══════════════════════════════════════════════════════════════════
// 04. CLOSE SESSION WITH COUNTING
// ══════════════════════════════════════════════════════════════════

let closeSessionDenoms = {};

window.renderCashDrawer = async function() {
  try {
    const { data: sess } = await db.from('cash_session').select('*')
      .eq('status','open').order('opened_at',{ascending:false}).limit(1).single();
    let balance = 0, txs = [];
    if (sess) {
      const { data: t } = await db.from('cash_transaction').select('*').eq('session_id',sess.id).order('created_at',{ascending:false});
      txs = t||[];
      balance = sess.opening_amt||0;
      txs.forEach(t => { balance += t.direction==='in' ? t.net_amount : -t.net_amount; });
    }
    document.getElementById('cash-current-balance').textContent = `฿${formatNum(balance)}`;
    document.getElementById('cash-session-status').textContent = sess
      ? `เปิดรอบ ${formatDateTime(sess.opened_at)} | โดย ${sess.opened_by}` : 'ยังไม่เปิดรอบ';
    document.getElementById('global-cash-balance').textContent = `฿${formatNum(balance)}`;
    const txList = document.getElementById('cash-transactions');
    if (txList) {
      txList.innerHTML = txs.length===0
        ? '<p style="text-align:center;color:var(--text-tertiary);padding:40px;">ไม่มีรายการ</p>'
        : txs.map(t=>`<div class="transaction-item">
            <div class="transaction-icon ${t.direction}"><i class="material-icons-round">${t.direction==='in'?'add':'remove'}</i></div>
            <div class="transaction-info">
              <div class="transaction-title">${t.type}</div>
              <div class="transaction-time">${formatDateTime(t.created_at)} — ${t.staff_name}</div>
              ${t.note?`<div class="transaction-note">${t.note}</div>`:''}
            </div>
            <div class="transaction-amount ${t.direction==='in'?'positive':'negative'}">${t.direction==='in'?'+':'-'}฿${formatNum(t.net_amount)}</div>
          </div>`).join('');
    }
    const no = !sess;
    document.getElementById('cash-open-btn').disabled = !no;
    document.getElementById('cash-add-btn').disabled = no;
    document.getElementById('cash-withdraw-btn').disabled = no;
    document.getElementById('cash-close-btn').disabled = no;
    document.getElementById('cash-add-btn').onclick = () => cashMovementWithDenom('add', sess);
    document.getElementById('cash-withdraw-btn').onclick = () => cashMovementWithDenom('withdraw', sess, balance);
    document.getElementById('cash-close-btn').onclick = () => closeCashSessionWithCount(sess, balance);
  } catch(e) { console.error(e); }
};

async function closeCashSessionWithCount(session, expectedBalance) {
  closeSessionDenoms = emptyDenoms();
  openModal('ปิดรอบเงินสด — นับยอดจริง', `
    <div style="display:flex;justify-content:space-between;padding:12px;background:var(--bg-base);border-radius:var(--radius-md);margin-bottom:12px;">
      <span>ยอดที่ระบบคำนวณ</span>
      <strong style="color:var(--primary)">฿${formatNum(expectedBalance)}</strong>
    </div>
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;">คลิกแบงค์เพื่อนับเงินจริงในลิ้นชัก</p>
    ${denomGridHTML(closeSessionDenoms,'cls','updateCloseSessionDenom')}
    <div id="cls-summary" style="margin-top:14px;padding:14px;background:var(--bg-base);border-radius:var(--radius-md);" data-exp="${expectedBalance}">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>นับได้จริง</span><strong id="cls-counted">฿0</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>ระบบคาด</span><strong>฿${formatNum(expectedBalance)}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:15px;"><span>ผลต่าง</span><strong id="cls-diff">฿0</strong></div>
    </div>
    <div class="form-group" style="margin-top:12px;"><label class="form-label">หมายเหตุ</label><input class="form-input" id="cls-note"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:4px;" onclick="confirmCloseSession('${session.id}',${expectedBalance})">
      <i class="material-icons-round">lock</i> ยืนยันปิดรอบ
    </button>`);
}

function updateCloseSessionDenom(value, delta) {
  closeSessionDenoms[value] = Math.max(0, (closeSessionDenoms[value]||0)+delta);
  const counted = refreshDenomUI(closeSessionDenoms,'cls');
  const summEl = document.getElementById('cls-summary');
  const exp = parseFloat(summEl?.dataset?.exp||0);
  const d = counted - exp;
  const countedEl = document.getElementById('cls-counted');
  const diffEl = document.getElementById('cls-diff');
  if (countedEl) countedEl.textContent = `฿${formatNum(counted)}`;
  if (diffEl) {
    diffEl.textContent = `${d>=0?'+':''}฿${formatNum(d)}`;
    diffEl.style.color = d===0?'var(--success)':d>0?'var(--warning)':'var(--danger)';
  }
}

async function confirmCloseSession(sessionId, expectedBalance) {
  const counted = denomTotal(closeSessionDenoms);
  const diff = counted - expectedBalance;
  const note = document.getElementById('cls-note')?.value||'';
  const r = await Swal.fire({
    icon: diff===0?'success':diff>0?'warning':'error',
    title: diff===0 ? 'ยอดตรง!' : diff>0 ? `เงินเกิน ฿${formatNum(diff)}` : `เงินขาด ฿${formatNum(Math.abs(diff))}`,
    text: `นับได้ ฿${formatNum(counted)} | คาด ฿${formatNum(expectedBalance)}`,
    showCancelButton:true, confirmButtonText:'ยืนยันปิดรอบ', cancelButtonText:'ยกเลิก'
  });
  if (!r.isConfirmed) return;
  await db.from('cash_session').update({
    status:'closed', closed_at:new Date().toISOString(), closed_by:USER?.username,
    closing_amt:counted, expected_amt:expectedBalance, diff_amt:diff,
    denominations:closeSessionDenoms, note:note||null
  }).eq('id',sessionId);
  toast('ปิดรอบสำเร็จ','success');
  logActivity('ปิดรอบเงินสด',`นับ ฿${formatNum(counted)} คาด ฿${formatNum(expectedBalance)} ต่าง ฿${formatNum(diff)}`);
  closeModal(); renderCashDrawer(); loadCashBalance();
}

// เพิ่ม/เบิกเงิน + นับแบงค์
let cashMoveDenoms = {};
let cashMoveMode = 'add';

async function cashMovementWithDenom(type, session, currentBalance) {
  if (!session) { toast('กรุณาเปิดรอบก่อน','warning'); return; }
  cashMoveMode = type; cashMoveDenoms = emptyDenoms();
  const isAdd = type==='add';
  openModal(isAdd?'เพิ่มเงินเข้าลิ้นชัก':'เบิกเงินออก', `
    ${!isAdd?`<div style="padding:10px;background:var(--warning-bg);border-radius:var(--radius-md);margin-bottom:12px;color:var(--warning);font-size:13px;">เงินปัจจุบัน: <strong>฿${formatNum(currentBalance||0)}</strong></div>`:''}
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;">คลิกแบงค์เพื่อนับ</p>
    ${denomGridHTML(cashMoveDenoms,'cmv','updateCashMoveDenom')}
    <div style="padding:12px;background:var(--bg-base);border-radius:var(--radius-md);margin-top:10px;">
      <div style="display:flex;justify-content:space-between;"><span>${isAdd?'ยอดเพิ่ม':'ยอดเบิก'}</span><strong id="cmv-total" style="color:var(--primary)">฿0</strong></div>
    </div>
    <div class="form-group" style="margin-top:12px;"><label class="form-label">หมายเหตุ</label><input class="form-input" id="cmv-note" placeholder="ระบุเหตุผล"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:4px;" onclick="confirmCashMovement('${session.id}',${currentBalance||0})">
      <i class="material-icons-round">${isAdd?'add':'remove'}</i> ยืนยัน
    </button>`);
}

function updateCashMoveDenom(value, delta) {
  cashMoveDenoms[value] = Math.max(0,(cashMoveDenoms[value]||0)+delta);
  const total = refreshDenomUI(cashMoveDenoms,'cmv');
  const el = document.getElementById('cmv-total');
  if (el) el.textContent = `฿${formatNum(total)}`;
}

async function confirmCashMovement(sessionId, currentBalance) {
  const amount = denomTotal(cashMoveDenoms);
  if (amount<=0) { toast('กรุณานับจำนวนเงิน','warning'); return; }
  const isAdd = cashMoveMode==='add';
  if (!isAdd && amount>currentBalance) { toast(`เงินไม่พอ! มีอยู่ ฿${formatNum(currentBalance)}`,'error'); return; }
  const note = document.getElementById('cmv-note')?.value||'';
  await recordCashTx({ sessionId, type:isAdd?'เพิ่มเงิน':'เบิกเงิน', direction:isAdd?'in':'out', amount, netAmount:amount, denominations:cashMoveDenoms, note });
  toast(isAdd?'เพิ่มเงินสำเร็จ':'เบิกเงินสำเร็จ','success');
  logActivity(isAdd?'เพิ่มเงินลิ้นชัก':'เบิกเงินลิ้นชัก',`฿${formatNum(amount)} | ${note}`);
  closeModal(); renderCashDrawer();
}

// ══════════════════════════════════════════════════════════════════
// 05. EXPENSE — เงินสดบังคับนับแบงค์
// ══════════════════════════════════════════════════════════════════

let expDenoms = {}, expChangeDenoms = {};

window.showAddExpenseModal = function() {
  expDenoms = emptyDenoms(); expChangeDenoms = emptyDenoms();
  openModal('บันทึกรายจ่าย', `
    <form id="expense-form" onsubmit="event.preventDefault();">
      <div class="form-group"><label class="form-label">รายการ *</label><input class="form-input" id="exp-desc" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">หมวดหมู่</label>
          <select class="form-input" id="exp-cat">
            <option>ทั่วไป</option><option>ค่าสาธารณูปโภค</option><option>ค่าขนส่ง</option>
            <option>ค่าซ่อมบำรุง</option><option>ค่าจ้างแรงงาน</option><option>อื่นๆ</option>
          </select></div>
        <div class="form-group"><label class="form-label">วิธีชำระ</label>
          <select class="form-input" id="exp-method" onchange="toggleExpCashSection()">
            <option value="เงินสด">เงินสด</option><option value="โอนเงิน">โอนเงิน</option><option value="บัตรเครดิต">บัตรเครดิต</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">จำนวน (บาท) *</label>
        <input class="form-input" type="number" id="exp-amount" min="1" oninput="onExpAmountChange()" required></div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label><input class="form-input" id="exp-note"></div>
      <div id="exp-cash-section">
        <div style="background:var(--info-bg);border-radius:var(--radius-md);padding:10px;margin-bottom:10px;font-size:13px;color:var(--info);">
          <i class="material-icons-round" style="font-size:14px;vertical-align:middle;">info</i>
          นับแบงค์ที่จ่ายออก เงินทอนต้องพอดีห้ามขาดห้ามเกิน
        </div>
        <p style="font-size:13px;font-weight:600;margin-bottom:8px;">แบงค์ที่จ่ายออก</p>
        ${denomGridHTML(expDenoms,'exp','updateExpDenom')}
        <div style="padding:12px;background:var(--bg-base);border-radius:var(--radius-md);margin-top:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>จ่ายออก</span><strong id="exp-paid-total">฿0</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>ยอดรายจ่าย</span><strong id="exp-need">฿0</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>เงินทอนที่ต้องรับ</span><strong id="exp-change-need" style="color:var(--success)">฿0</strong></div>
        </div>
        <div id="exp-change-section" style="display:none;margin-top:12px;">
          <p style="font-size:13px;font-weight:600;margin-bottom:8px;">นับเงินทอนที่รับคืน (ต้องพอดี)</p>
          ${denomGridHTML(expChangeDenoms,'expc','updateExpChangeDenom')}
          <div style="padding:10px;background:var(--bg-base);border-radius:var(--radius-md);margin-top:8px;">
            <div style="display:flex;justify-content:space-between;"><span>นับทอนได้</span><strong id="expc-total">฿0</strong></div>
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="submitExpense()">
        <i class="material-icons-round">save</i> บันทึกรายจ่าย
      </button>
    </form>`);
};

function toggleExpCashSection() {
  const m = document.getElementById('exp-method')?.value;
  const s = document.getElementById('exp-cash-section');
  if (s) s.style.display = m==='เงินสด'?'block':'none';
}
function onExpAmountChange() {
  const a = Number(document.getElementById('exp-amount')?.value||0);
  const el = document.getElementById('exp-need');
  if (el) el.textContent = `฿${formatNum(a)}`;
  recalcExpSummary();
}
function updateExpDenom(value, delta) {
  expDenoms[value] = Math.max(0,(expDenoms[value]||0)+delta);
  refreshDenomUI(expDenoms,'exp'); recalcExpSummary();
}
function updateExpChangeDenom(value, delta) {
  expChangeDenoms[value] = Math.max(0,(expChangeDenoms[value]||0)+delta);
  refreshDenomUI(expChangeDenoms,'expc');
  const t = denomTotal(expChangeDenoms);
  const el = document.getElementById('expc-total');
  if (el) el.textContent = `฿${formatNum(t)}`;
}
function recalcExpSummary() {
  const amount = Number(document.getElementById('exp-amount')?.value||0);
  const paid = denomTotal(expDenoms);
  const change = paid - amount;
  const paidEl = document.getElementById('exp-paid-total');
  const changeEl = document.getElementById('exp-change-need');
  const changeSection = document.getElementById('exp-change-section');
  if (paidEl) paidEl.textContent = `฿${formatNum(paid)}`;
  if (changeEl) changeEl.textContent = `฿${formatNum(Math.max(0,change))}`;
  if (changeSection) {
    if (change > 0) {
      changeSection.style.display = 'block';
      expChangeDenoms = calcAutoChange(change);
      refreshDenomUI(expChangeDenoms,'expc');
      const el = document.getElementById('expc-total');
      if (el) el.textContent = `฿${formatNum(change)}`;
    } else { changeSection.style.display = 'none'; }
  }
}
async function submitExpense() {
  const desc = document.getElementById('exp-desc')?.value?.trim();
  const amount = Number(document.getElementById('exp-amount')?.value||0);
  const method = document.getElementById('exp-method')?.value;
  const cat = document.getElementById('exp-cat')?.value;
  const note = document.getElementById('exp-note')?.value||'';
  if (!desc||amount<=0) { toast('กรุณากรอกข้อมูลให้ครบ','error'); return; }
  if (method==='เงินสด') {
    try { await assertCashEnough(amount,'จ่ายรายจ่าย'); } catch(e) {
      Swal.fire({icon:'error',title:'เงินในลิ้นชักไม่พอ',text:e.message,confirmButtonColor:'#DC2626'}); return;
    }
    const paid = denomTotal(expDenoms);
    if (paid < amount) { toast(`นับแบงค์ยังไม่ถึงยอด ฿${formatNum(amount)}`,'error'); return; }
    const change = paid - amount;
    if (change > 0 && Math.abs(denomTotal(expChangeDenoms) - change) > 0) {
      toast(`เงินทอนที่นับได้ ฿${formatNum(denomTotal(expChangeDenoms))} ไม่ตรงกับที่ต้องทอน ฿${formatNum(change)}`,'error'); return;
    }
  }
  try {
    const { data: exp } = await db.from('รายจ่าย').insert({
      description:desc, amount, method, category:cat, note,
      staff_name:USER?.username, date:new Date().toISOString(),
      denominations: method==='เงินสด'?expDenoms:null
    }).select().single();
    if (method==='เงินสด') {
      const { data: sess } = await db.from('cash_session').select('id').eq('status','open').limit(1).single();
      if (sess) await recordCashTx({ sessionId:sess.id, type:'รายจ่าย', direction:'out', amount:denomTotal(expDenoms), netAmount:amount, refId:exp?.id, refTable:'รายจ่าย', denominations:expDenoms, note:desc });
    }
    toast('บันทึกรายจ่ายสำเร็จ','success');
    logActivity('บันทึกรายจ่าย',`${desc} ฿${formatNum(amount)}`);
    closeModal();
    if (typeof loadExpenseData==='function') loadExpenseData();
  } catch(e) { toast('เกิดข้อผิดพลาด: '+e.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════
// 06. EMPLOYEE MANAGEMENT
// ══════════════════════════════════════════════════════════════════

async function loadEmployees() {
  const { data } = await db.from('พนักงาน').select('*').order('name');
  return data||[];
}
function showEmployeeModal(emp) {
  const isEdit = !!emp;
  openModal(isEdit?'แก้ไขพนักงาน':'เพิ่มพนักงาน', `
    <form id="emp-form" onsubmit="event.preventDefault();saveEmployee()">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">ชื่อ *</label><input class="form-input" id="emp-name" value="${emp?.name||''}" required></div>
        <div class="form-group"><label class="form-label">นามสกุล</label><input class="form-input" id="emp-lastname" value="${emp?.lastname||''}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">เบอร์โทร</label><input class="form-input" id="emp-phone" value="${emp?.phone||''}"></div>
        <div class="form-group"><label class="form-label">ตำแหน่ง</label><input class="form-input" id="emp-pos" value="${emp?.position||'พนักงาน'}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">ประเภทค่าจ้าง</label>
          <select class="form-input" id="emp-pay-type" onchange="toggleEmpWage()">
            <option value="รายวัน" ${(emp?.pay_type||'รายวัน')==='รายวัน'?'selected':''}>รายวัน</option>
            <option value="รายเดือน" ${emp?.pay_type==='รายเดือน'?'selected':''}>รายเดือน</option>
          </select></div>
        <div class="form-group"><label class="form-label" id="emp-wage-label">${emp?.pay_type==='รายเดือน'?'เงินเดือน':'ค่าจ้างต่อวัน'} (บาท)</label>
          <input class="form-input" type="number" id="emp-wage" value="${emp?.pay_type==='รายเดือน'?(emp?.salary||0):(emp?.daily_wage||0)}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">วันเริ่มงาน</label>
          <input class="form-input" type="date" id="emp-start" value="${emp?.start_date||new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label class="form-label">สถานะ</label>
          <select class="form-input" id="emp-status">
            <option value="ทำงาน" ${(emp?.status||'ทำงาน')==='ทำงาน'?'selected':''}>ทำงาน</option>
            <option value="ลาออก" ${emp?.status==='ลาออก'?'selected':''}>ลาออก</option>
            <option value="พักงาน" ${emp?.status==='พักงาน'?'selected':''}>พักงาน</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label><input class="form-input" id="emp-note" value="${emp?.note||''}"></div>
      <input type="hidden" id="emp-id" value="${emp?.id||''}">
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="material-icons-round">save</i> บันทึก</button>
    </form>`);
}
function toggleEmpWage() {
  const t = document.getElementById('emp-pay-type')?.value;
  const l = document.getElementById('emp-wage-label');
  if (l) l.textContent = (t==='รายเดือน'?'เงินเดือน':'ค่าจ้างต่อวัน')+' (บาท)';
}
async function saveEmployee() {
  const id = document.getElementById('emp-id')?.value;
  const payType = document.getElementById('emp-pay-type')?.value;
  const wage = Number(document.getElementById('emp-wage')?.value||0);
  const data = {
    name: document.getElementById('emp-name').value.trim(),
    lastname: document.getElementById('emp-lastname').value.trim(),
    phone: document.getElementById('emp-phone').value.trim(),
    position: document.getElementById('emp-pos').value.trim()||'พนักงาน',
    pay_type: payType,
    daily_wage: payType==='รายวัน'?wage:0,
    salary: payType==='รายเดือน'?wage:0,
    start_date: document.getElementById('emp-start').value,
    status: document.getElementById('emp-status').value,
    note: document.getElementById('emp-note').value
  };
  if (!data.name) { toast('กรุณากรอกชื่อ','error'); return; }
  if (id) await db.from('พนักงาน').update(data).eq('id',id);
  else await db.from('พนักงาน').insert(data);
  toast('บันทึกพนักงานสำเร็จ','success');
  closeModal();
  if (typeof renderAttendance==='function') renderAttendance();
  if (typeof renderAdminTabs==='function') renderAdminTabs('emp');
}
async function deleteEmployee(id, name) {
  const r = await Swal.fire({title:`ลบพนักงาน "${name}"?`,icon:'warning',showCancelButton:true,confirmButtonText:'ลบ',cancelButtonText:'ยกเลิก',confirmButtonColor:'#DC2626'});
  if (!r.isConfirmed) return;
  await db.from('พนักงาน').update({status:'ลาออก'}).eq('id',id);
  toast('อัปเดตสถานะแล้ว','success');
  if (typeof renderAdminTabs==='function') renderAdminTabs('emp');
}

// ══════════════════════════════════════════════════════════════════
// 07. ATTENDANCE+
// ══════════════════════════════════════════════════════════════════

const ATT_STATUS = {
  'มา':       {label:'มาทำงาน',   color:'var(--success)', deductPct:0},
  'ครึ่งวัน': {label:'มาครึ่งวัน',color:'var(--info)',    deductPct:50},
  'มาสาย':    {label:'มาสาย',     color:'var(--warning)', deductPct:5},
  'ขาด':      {label:'ขาด',       color:'var(--danger)',  deductPct:100},
  'ลา':       {label:'ลา',        color:'var(--primary)', deductPct:0}
};

window.renderAttendance = async function() {
  const section = document.getElementById('page-att');
  if (!section) return;
  const today = new Date().toISOString().split('T')[0];
  const emps = await loadEmployees();
  const active = emps.filter(e=>e.status==='ทำงาน');
  const {data:attToday} = await db.from('เช็คชื่อ').select('*').eq('date',today);
  const attMap = {};
  (attToday||[]).forEach(a=>{attMap[a.employee_id]=a;});
  const statCounts = {};
  Object.keys(ATT_STATUS).forEach(k=>{statCounts[k]=0;});
  Object.values(attMap).forEach(a=>{if(statCounts[a.status]!==undefined)statCounts[a.status]++;});
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <div>
          <h3 style="font-size:15px;font-weight:600;">เช็คชื่อ — ${new Date().toLocaleDateString('th-TH',{dateStyle:'full'})}</h3>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
            ${Object.entries(ATT_STATUS).map(([k,v])=>`<span class="badge" style="background:${v.color}22;color:${v.color};">${v.label} ${statCounts[k]}</span>`).join('')}
            <span class="badge badge-warning">ยังไม่ลง ${active.length-Object.keys(attMap).length}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" onclick="showAttDatePicker()"><i class="material-icons-round">calendar_today</i> ย้อนหลัง</button>
          <button class="btn btn-outline" onclick="renderPayroll()"><i class="material-icons-round">account_balance_wallet</i> จ่ายเงินเดือน</button>
          <button class="btn btn-primary" onclick="showEmployeeModal()"><i class="material-icons-round">person_add</i> เพิ่มพนักงาน</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th class="text-right">ค่าจ้าง/วัน</th><th>สถานะ</th><th>เวลาเข้า</th><th>เวลาออก</th><th class="text-right">หัก</th><th>จัดการ</th></tr></thead>
          <tbody>
            ${active.map(emp=>{
              const att = attMap[emp.id];
              const wage = emp.daily_wage||0;
              const deduct = att ? Math.round(wage*(ATT_STATUS[att.status]?.deductPct||0)/100) : 0;
              return `<tr>
                <td><strong>${emp.name} ${emp.lastname||''}</strong><div style="font-size:11px;color:var(--text-tertiary);">${emp.phone||''}</div></td>
                <td>${emp.position}</td>
                <td class="text-right">฿${formatNum(wage)}</td>
                <td>${att?`<span class="badge" style="background:${ATT_STATUS[att.status]?.color||'#888'}22;color:${ATT_STATUS[att.status]?.color||'#888'}">${att.status}</span>`:'<span class="badge badge-warning">ยังไม่ลง</span>'}</td>
                <td>${att?.time_in||'-'}</td>
                <td>${att?.time_out||'-'}</td>
                <td class="text-right" style="color:var(--danger)">${deduct>0?`-฿${formatNum(deduct)}`:'-'}</td>
                <td><div class="table-actions">
                  ${!att?`<button class="btn btn-primary btn-sm" onclick="showCheckInModal('${emp.id}','${emp.name}')">ลงชื่อ</button>`
                        :`${!att.time_out?`<button class="btn btn-outline btn-sm" onclick="checkOutEmp('${att.id}')">ออกงาน</button>`:''}<button class="btn btn-ghost btn-icon" onclick="showEditAttModal('${att.id}','${emp.id}','${emp.name}')"><i class="material-icons-round">edit</i></button>`}
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
};

function showCheckInModal(empId, empName) {
  openModal(`ลงชื่อ: ${empName}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      ${Object.entries(ATT_STATUS).map(([k,v])=>`
        <button class="btn btn-outline" id="att-btn-${k}" onclick="selectAttStatus('${k}')"
          style="border-color:${v.color};color:${v.color};padding:14px;font-size:14px;">
          ${v.label}${v.deductPct>0?` <small>(หัก ${v.deductPct}%)</small>`:''}
        </button>`).join('')}
    </div>
    <div class="form-group"><label class="form-label">หมายเหตุ</label><input class="form-input" id="att-note"></div>
    <input type="hidden" id="att-status-val" value="มา">
    <input type="hidden" id="att-emp-id" value="${empId}">
    <button class="btn btn-primary" style="width:100%;" onclick="confirmCheckIn()">
      <i class="material-icons-round">check</i> บันทึก
    </button>`);
  selectAttStatus('มา');
}
function selectAttStatus(status) {
  const el = document.getElementById('att-status-val');
  if (el) el.value = status;
  Object.keys(ATT_STATUS).forEach(k=>{
    const btn = document.getElementById(`att-btn-${k}`);
    if (!btn) return;
    btn.style.background = k===status ? ATT_STATUS[k].color : '';
    btn.style.color = k===status ? '#fff' : ATT_STATUS[k].color;
  });
}
async function confirmCheckIn() {
  const empId = document.getElementById('att-emp-id')?.value;
  const status = document.getElementById('att-status-val')?.value||'มา';
  const note = document.getElementById('att-note')?.value||'';
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const {data:emp} = await db.from('พนักงาน').select('daily_wage').eq('id',empId).single();
  const wage = emp?.daily_wage||0;
  const deduction = Math.round(wage*(ATT_STATUS[status]?.deductPct||0)/100);
  await db.from('เช็คชื่อ').insert({ employee_id:empId, date:today, status, time_in:now.toTimeString().slice(0,5), deduction, note, staff_name:USER?.username });
  toast('บันทึกสำเร็จ','success'); closeModal(); renderAttendance();
}
async function checkOutEmp(attId) {
  const now = new Date();
  await db.from('เช็คชื่อ').update({time_out:now.toTimeString().slice(0,5)}).eq('id',attId);
  toast('บันทึกเวลาออกสำเร็จ','success'); renderAttendance();
}
async function showEditAttModal(attId, empId, empName) {
  const {data:att} = await db.from('เช็คชื่อ').select('*').eq('id',attId).single();
  openModal(`แก้ไขเช็คชื่อ: ${empName}`, `
    <div class="form-group"><label class="form-label">สถานะ</label>
      <select class="form-input" id="edit-att-status">
        ${Object.keys(ATT_STATUS).map(k=>`<option value="${k}" ${att?.status===k?'selected':''}>${ATT_STATUS[k].label}</option>`).join('')}
      </select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label class="form-label">เวลาเข้า</label><input class="form-input" type="time" id="edit-att-in" value="${att?.time_in||''}"></div>
      <div class="form-group"><label class="form-label">เวลาออก</label><input class="form-input" type="time" id="edit-att-out" value="${att?.time_out||''}"></div>
    </div>
    <div class="form-group"><label class="form-label">หมายเหตุ</label><input class="form-input" id="edit-att-note" value="${att?.note||''}"></div>
    <button class="btn btn-primary" style="width:100%;" onclick="saveEditAtt('${attId}','${empId}')">
      <i class="material-icons-round">save</i> บันทึก
    </button>`);
}
async function saveEditAtt(attId, empId) {
  const status = document.getElementById('edit-att-status')?.value;
  const {data:emp} = await db.from('พนักงาน').select('daily_wage').eq('id',empId).single();
  const deduction = Math.round((emp?.daily_wage||0)*(ATT_STATUS[status]?.deductPct||0)/100);
  await db.from('เช็คชื่อ').update({
    status, deduction,
    time_in: document.getElementById('edit-att-in')?.value||null,
    time_out: document.getElementById('edit-att-out')?.value||null,
    note: document.getElementById('edit-att-note')?.value||''
  }).eq('id',attId);
  toast('แก้ไขสำเร็จ','success'); closeModal(); renderAttendance();
}
async function showAttDatePicker() {
  const {value:date} = await Swal.fire({title:'ดูเช็คชื่อย้อนหลัง',input:'date',inputValue:new Date().toISOString().split('T')[0],showCancelButton:true,confirmButtonText:'ดู',cancelButtonText:'ยกเลิก'});
  if (!date) return;
  const emps = await loadEmployees();
  const {data:attData} = await db.from('เช็คชื่อ').select('*').eq('date',date);
  const attMap = {};
  (attData||[]).forEach(a=>{attMap[a.employee_id]=a;});
  openModal(`เช็คชื่อ ${new Date(date).toLocaleDateString('th-TH',{dateStyle:'full'})}`, `
    <div style="max-height:400px;overflow-y:auto;">
      <table class="data-table">
        <thead><tr><th>พนักงาน</th><th>สถานะ</th><th>เข้า</th><th>ออก</th><th>หัก</th></tr></thead>
        <tbody>${emps.filter(e=>e.status==='ทำงาน').map(emp=>{
          const att = attMap[emp.id];
          return `<tr><td>${emp.name} ${emp.lastname||''}</td>
            <td>${att?`<span class="badge" style="background:${ATT_STATUS[att.status]?.color||'#888'}22;color:${ATT_STATUS[att.status]?.color||'#888'}">${att.status}</span>`:'<span class="badge badge-warning">ไม่มีข้อมูล</span>'}</td>
            <td>${att?.time_in||'-'}</td><td>${att?.time_out||'-'}</td>
            <td>${att?.deduction>0?`-฿${formatNum(att.deduction)}`:'-'}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>`);
}

// ══════════════════════════════════════════════════════════════════
// 08. CASH ADVANCE — เบิกเงิน + นับแบงค์
// ══════════════════════════════════════════════════════════════════

let advDenoms = {};

async function showCashAdvanceModal(empId, empName) {
  advDenoms = emptyDenoms();
  const cashBal = await getLiveCashBalance();
  openModal(`เบิกเงิน: ${empName}`, `
    <div style="padding:10px;background:var(--info-bg);border-radius:var(--radius-md);margin-bottom:12px;font-size:13px;color:var(--info);">
      เงินในลิ้นชัก: <strong>฿${formatNum(cashBal)}</strong>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label class="form-label">จำนวนที่เบิก (บาท) *</label>
        <input class="form-input" type="number" id="adv-amount" min="1" max="${cashBal}" oninput="onAdvAmountChange()" required></div>
      <div class="form-group"><label class="form-label">วิธีจ่าย</label>
        <select class="form-input" id="adv-method" onchange="toggleAdvCash()">
          <option value="เงินสด">เงินสด (ต้องนับแบงค์)</option>
          <option value="โอนเงิน">โอนเงิน</option>
        </select></div>
    </div>
    <div id="adv-denom-section">
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">นับแบงค์ที่จ่ายออก (ต้องพอดีกับยอดที่เบิกเท่านั้น)</p>
      ${denomGridHTML(advDenoms,'adv','updateAdvDenom')}
      <div style="padding:10px;background:var(--bg-base);border-radius:var(--radius-md);margin-top:8px;">
        <div style="display:flex;justify-content:space-between;"><span>นับได้</span><strong id="adv-denom-total">฿0</strong></div>
      </div>
    </div>
    <div class="form-group" style="margin-top:12px;"><label class="form-label">เหตุผล</label>
      <input class="form-input" id="adv-reason" placeholder="ระบุเหตุผล"></div>
    <input type="hidden" id="adv-emp-id" value="${empId}">
    <button class="btn btn-primary" style="width:100%;margin-top:4px;" onclick="confirmCashAdvance()">
      <i class="material-icons-round">payments</i> ยืนยันเบิกเงิน
    </button>`);
}
function toggleAdvCash() {
  const m = document.getElementById('adv-method')?.value;
  const s = document.getElementById('adv-denom-section');
  if (s) s.style.display = m==='เงินสด'?'block':'none';
}
function onAdvAmountChange() {
  const amount = Number(document.getElementById('adv-amount')?.value||0);
  advDenoms = calcAutoChange(amount);
  refreshDenomUI(advDenoms,'adv');
  const el = document.getElementById('adv-denom-total');
  if (el) el.textContent = `฿${formatNum(amount)}`;
}
function updateAdvDenom(value, delta) {
  advDenoms[value] = Math.max(0,(advDenoms[value]||0)+delta);
  const total = refreshDenomUI(advDenoms,'adv');
  const el = document.getElementById('adv-denom-total');
  if (el) el.textContent = `฿${formatNum(total)}`;
}
async function confirmCashAdvance() {
  const empId = document.getElementById('adv-emp-id')?.value;
  const amount = Number(document.getElementById('adv-amount')?.value||0);
  const method = document.getElementById('adv-method')?.value;
  const reason = document.getElementById('adv-reason')?.value||'';
  if (!amount||amount<=0) { toast('กรุณาระบุจำนวน','error'); return; }
  if (method==='เงินสด') {
    const counted = denomTotal(advDenoms);
    if (counted!==amount) { toast(`นับแบงค์ได้ ฿${formatNum(counted)} ไม่ตรงกับยอดเบิก ฿${formatNum(amount)}`,'error'); return; }
    try { await assertCashEnough(amount,'เบิกเงิน'); } catch(e) {
      Swal.fire({icon:'error',title:'เงินในลิ้นชักไม่พอ',text:e.message}); return;
    }
  }
  await db.from('เบิกเงิน').insert({ employee_id:empId, amount, method, reason, approved_by:USER?.username, status:'อนุมัติ' });
  if (method==='เงินสด') {
    const {data:sess} = await db.from('cash_session').select('id').eq('status','open').limit(1).single();
    if (sess) await recordCashTx({ sessionId:sess.id, type:'เบิกเงินพนักงาน', direction:'out', amount, netAmount:amount, denominations:advDenoms, note:reason });
  }
  toast('บันทึกการเบิกเงินสำเร็จ','success');
  logActivity('เบิกเงินพนักงาน',`฿${formatNum(amount)} | ${reason}`);
  closeModal();
}

// ══════════════════════════════════════════════════════════════════
// 09. PAYROLL
// ══════════════════════════════════════════════════════════════════

async function renderPayroll() {
  const section = document.getElementById('page-att');
  if (!section) return;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().split('T')[0];
  const monthLabel = now.toLocaleDateString('th-TH',{month:'long',year:'numeric'});
  const emps = (await loadEmployees()).filter(e=>e.status==='ทำงาน');
  const {data:attData} = await db.from('เช็คชื่อ').select('*').gte('date',monthStart).lte('date',monthEnd);
  const {data:advData} = await db.from('เบิกเงิน').select('*').eq('status','อนุมัติ').gte('date',monthStart+'T00:00:00');
  const summaries = emps.map(emp => {
    const myAtt = (attData||[]).filter(a=>a.employee_id===emp.id);
    const workDays = myAtt.filter(a=>a.status!=='ขาด').length;
    const totalDeduct = myAtt.reduce((s,a)=>s+(a.deduction||0),0);
    const wage = emp.daily_wage||0;
    const earned = workDays*wage - totalDeduct;
    const myAdv = (advData||[]).filter(a=>a.employee_id===emp.id);
    const totalAdv = myAdv.reduce((s,a)=>s+a.amount,0);
    const netPay = Math.max(0, earned - totalAdv);
    return {emp, workDays, earned, totalDeduct, totalAdv, netPay, myAdv};
  });
  const totalNet = summaries.reduce((s,x)=>s+x.netPay,0);
  window._payrollSummaries = summaries;
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <div>
          <h3 style="font-size:15px;font-weight:600;">จ่ายเงินเดือน — ${monthLabel}</h3>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;">ยอดรวมที่ต้องจ่ายทั้งหมด: <strong style="color:var(--primary);font-size:16px;">฿${formatNum(totalNet)}</strong></p>
        </div>
        <button class="btn btn-outline" onclick="renderAttendance()"><i class="material-icons-round">arrow_back</i> กลับเช็คชื่อ</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>พนักงาน</th><th class="text-center">วันทำงาน</th><th class="text-right">ค่าจ้างสะสม</th><th class="text-right">หักรวม</th><th class="text-right">ยอดเบิกค้าง</th><th class="text-right">ต้องจ่าย</th><th></th></tr></thead>
          <tbody>${summaries.map(s=>`
            <tr>
              <td><strong>${s.emp.name} ${s.emp.lastname||''}</strong>
                <div style="font-size:11px;color:var(--text-tertiary);">฿${formatNum(s.emp.daily_wage||0)}/วัน</div></td>
              <td class="text-center">${s.workDays} วัน</td>
              <td class="text-right">฿${formatNum(s.earned)}</td>
              <td class="text-right" style="color:var(--danger)">${s.totalDeduct>0?`-฿${formatNum(s.totalDeduct)}`:'-'}</td>
              <td class="text-right" style="color:var(--warning)">${s.totalAdv>0?`-฿${formatNum(s.totalAdv)}`:'-'}</td>
              <td class="text-right"><strong style="color:var(--primary);font-size:15px;">฿${formatNum(s.netPay)}</strong></td>
              <td><button class="btn btn-primary btn-sm" onclick="showPayrollModal('${s.emp.id}')"><i class="material-icons-round">payments</i> จ่าย</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function showPayrollModal(empId) {
  const s = window._payrollSummaries?.find(x=>x.emp.id===empId);
  if (!s) return;
  const {emp,workDays,earned,totalDeduct,totalAdv,netPay,myAdv} = s;
  const {data:allAdv} = await db.from('เบิกเงิน').select('*').eq('employee_id',empId).order('date',{ascending:false}).limit(20);
  const unpaidTotal = (allAdv||[]).filter(a=>a.status==='อนุมัติ').reduce((s,a)=>s+a.amount,0);
  const carryOver = Math.max(0, unpaidTotal - totalAdv);
  openModal(`จ่ายเงินเดือน: ${emp.name}`, `
    <div style="background:var(--bg-base);border-radius:var(--radius-md);padding:14px;margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
        <div><span style="color:var(--text-secondary);">วันทำงาน</span><br><strong>${workDays} วัน</strong></div>
        <div><span style="color:var(--text-secondary);">ค่าจ้างสะสม</span><br><strong>฿${formatNum(earned)}</strong></div>
        <div><span style="color:var(--text-secondary);">หักสาย/ขาด</span><br><strong style="color:var(--danger)">-฿${formatNum(totalDeduct)}</strong></div>
        <div><span style="color:var(--text-secondary);">เบิกเดือนนี้</span><br><strong style="color:var(--warning)">-฿${formatNum(totalAdv)}</strong></div>
      </div>
      ${carryOver>0?`<div style="margin-top:8px;padding:8px;background:var(--danger-bg);border-radius:var(--radius-sm);font-size:12px;color:var(--danger);">ยกยอดหนี้เก่า (จากประวัติทั้งหมด): ฿${formatNum(carryOver)}</div>`:''}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-light);display:flex;justify-content:space-between;font-size:15px;font-weight:700;">
        <span>ยอดสุทธิ</span><span style="color:var(--primary)">฿${formatNum(netPay)}</span>
      </div>
    </div>
    ${myAdv.length>0?`<div style="margin-bottom:14px;">
      <p style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">รายการเบิกเดือนนี้</p>
      ${myAdv.map(a=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:0.5px solid var(--border-light);"><span>${formatDate(a.date)} — ${a.reason||'ไม่ระบุ'}</span><strong>฿${formatNum(a.amount)}</strong></div>`).join('')}
    </div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div class="form-group"><label class="form-label">จ่ายเงินครั้งนี้ (บาท)</label>
        <input class="form-input" type="number" id="pay-amount" value="${netPay}" min="0"></div>
      <div class="form-group"><label class="form-label">หักหนี้ครั้งนี้ (บาท)</label>
        <input class="form-input" type="number" id="pay-deduct-debt" value="0" min="0"></div>
    </div>
    <div class="form-group"><label class="form-label">วิธีจ่าย</label>
      <select class="form-input" id="pay-method"><option>เงินสด</option><option>โอนเงิน</option></select></div>
    <div class="form-group"><label class="form-label">หมายเหตุ</label><input class="form-input" id="pay-note"></div>
    <input type="hidden" id="pay-emp-id" value="${empId}">
    <input type="hidden" id="pay-work-days" value="${workDays}">
    <input type="hidden" id="pay-base-salary" value="${earned}">
    <input type="hidden" id="pay-adv-total" value="${totalAdv}">
    <button class="btn btn-primary" style="width:100%;" onclick="confirmPayroll()">
      <i class="material-icons-round">check</i> ยืนยันจ่ายเงินเดือน
    </button>`);
}

async function confirmPayroll() {
  const empId = document.getElementById('pay-emp-id')?.value;
  const paid = Number(document.getElementById('pay-amount')?.value||0);
  const deductDebt = Number(document.getElementById('pay-deduct-debt')?.value||0);
  const method = document.getElementById('pay-method')?.value||'เงินสด';
  const note = document.getElementById('pay-note')?.value||'';
  const workDays = Number(document.getElementById('pay-work-days')?.value||0);
  const base = Number(document.getElementById('pay-base-salary')?.value||0);
  const advTotal = Number(document.getElementById('pay-adv-total')?.value||0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0];
  if (method==='เงินสด' && paid>0) {
    try { await assertCashEnough(paid,'จ่ายเงินเดือน'); } catch(e) {
      Swal.fire({icon:'error',title:'เงินในลิ้นชักไม่พอ',text:e.message}); return;
    }
  }
  await db.from('จ่ายเงินเดือน').insert({
    employee_id:empId, month:monthStart, working_days:workDays,
    base_salary:base, deduct_withdraw:advTotal, deduct_absent:0, bonus:0,
    net_paid:paid, paid_date:now.toISOString(), staff_name:USER?.username, note
  });
  if (method==='เงินสด' && paid>0) {
    const {data:sess} = await db.from('cash_session').select('id').eq('status','open').limit(1).single();
    if (sess) await recordCashTx({ sessionId:sess.id, type:'จ่ายเงินเดือน', direction:'out', amount:paid, netAmount:paid, note });
  }
  if (deductDebt>0) {
    const {data:advs} = await db.from('เบิกเงิน').select('*').eq('employee_id',empId).eq('status','อนุมัติ').order('date');
    let rem = deductDebt;
    for (const a of (advs||[])) {
      if (rem<=0) break;
      if (a.amount<=rem) { await db.from('เบิกเงิน').update({status:'ชำระแล้ว'}).eq('id',a.id); rem-=a.amount; }
    }
  }
  toast('จ่ายเงินเดือนสำเร็จ','success');
  logActivity('จ่ายเงินเดือน',`฿${formatNum(paid)}`);
  closeModal(); renderPayroll();
}

// ══════════════════════════════════════════════════════════════════
// 10. BARCODE BATCH PRINT
// ══════════════════════════════════════════════════════════════════

let barcodePrintList = [];

function showBarcodeBatchModal() {
  barcodePrintList = [];
  const withBarcode = (products||[]).filter(p => p.barcode);
  openModal('พิมพ์บาร์โค้ดหลายชิ้น', `
    <div style="margin-bottom:12px;">
      <input class="form-input" id="bc-search" placeholder="ค้นหาสินค้า..." oninput="filterBarcodeList()" style="margin-bottom:8px;">
      <div id="bc-product-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius-md);">
        ${withBarcode.length===0
          ? '<p style="padding:20px;text-align:center;color:var(--text-tertiary);">ไม่มีสินค้าที่มีบาร์โค้ด</p>'
          : withBarcode.map(p=>`
            <div class="bc-prod-row" data-name="${p.name.toLowerCase()}" data-barcode="${p.barcode.toLowerCase()}"
              style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:0.5px solid var(--border-light);cursor:pointer;" onclick="addToBarcodePrint('${p.id}')">
              <div><strong style="font-size:13px;">${p.name}</strong><br>
                <span style="font-size:11px;color:var(--text-tertiary);">${p.barcode}</span></div>
              <span class="btn btn-outline btn-sm">+ เพิ่ม</span>
            </div>`).join('')}
      </div>
    </div>
    <div id="bc-print-list" style="min-height:60px;padding:10px;background:var(--bg-base);border-radius:var(--radius-md);margin-bottom:12px;">
      <p style="color:var(--text-tertiary);font-size:13px;text-align:center;">ยังไม่มีสินค้าที่เลือก</p>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-outline" style="flex:1;" onclick="barcodePrintList=[];renderBarcodePrintList()">ล้าง</button>
      <button class="btn btn-primary" style="flex:2;" onclick="doBatchPrint()"><i class="material-icons-round">print</i> พิมพ์</button>
    </div>`);
}
function filterBarcodeList() {
  const q = document.getElementById('bc-search')?.value?.toLowerCase()||'';
  document.querySelectorAll('.bc-prod-row').forEach(row=>{
    const match = row.dataset.name?.includes(q)||row.dataset.barcode?.includes(q);
    row.style.display = match ? '' : 'none';
  });
}
function addToBarcodePrint(productId) {
  const p = (products||[]).find(x=>x.id===productId);
  if (!p) return;
  const ex = barcodePrintList.find(x=>x.product.id===productId);
  if (ex) ex.qty++; else barcodePrintList.push({product:p,qty:1});
  renderBarcodePrintList();
}
function renderBarcodePrintList() {
  const container = document.getElementById('bc-print-list');
  if (!container) return;
  if (barcodePrintList.length===0) {
    container.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;text-align:center;">ยังไม่มีสินค้าที่เลือก</p>';
    return;
  }
  container.innerHTML = barcodePrintList.map((item,idx)=>`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <div style="flex:1;font-size:13px;"><strong>${item.product.name}</strong> <span style="color:var(--text-tertiary);">(${item.product.barcode})</span></div>
      <div style="display:flex;align-items:center;gap:4px;">
        <button class="denom-minus-btn" onclick="bcQtyChange(${idx},-1)">−</button>
        <span style="min-width:24px;text-align:center;font-weight:700;">${item.qty}</span>
        <button class="denom-plus-btn" onclick="bcQtyChange(${idx},1)">+</button>
      </div>
      <button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="barcodePrintList.splice(${idx},1);renderBarcodePrintList()"><i class="material-icons-round">close</i></button>
    </div>`).join('');
}
function bcQtyChange(idx, delta) {
  barcodePrintList[idx].qty = Math.max(1, barcodePrintList[idx].qty+delta);
  renderBarcodePrintList();
}
function doBatchPrint() {
  if (barcodePrintList.length===0) { toast('กรุณาเลือกสินค้า','warning'); return; }
  const items = barcodePrintList.flatMap(item => Array(item.qty).fill(null).map(()=>({name:item.product.name,barcode:item.product.barcode})));
  const win = window.open('','_blank','width=800,height=600');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
  <style>@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun',sans-serif;}
  .grid{display:flex;flex-wrap:wrap;gap:4px;padding:8px;}
  .bc-item{border:1px solid #ccc;border-radius:4px;padding:6px 8px;text-align:center;width:160px;}
  .bc-name{font-size:11px;font-weight:600;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .bc-num{font-size:10px;color:#666;margin-top:2px;}
  @media print{@page{margin:5mm}}</style></head><body>
  <div class="grid" id="bc-grid"></div>
  <script>
    window.onload = () => {
      const items = ${JSON.stringify(items)};
      const grid = document.getElementById('bc-grid');
      items.forEach(item => {
        const div = document.createElement('div'); div.className='bc-item';
        div.innerHTML='<div class="bc-name">'+item.name+'</div><svg class="bc-svg"></svg><div class="bc-num">'+item.barcode+'</div>';
        grid.appendChild(div);
        JsBarcode(div.querySelector('.bc-svg'),item.barcode,{format:'CODE128',width:1.5,height:40,displayValue:false});
      });
      setTimeout(()=>window.print(),500);
    };
  <\/script></body></html>`);
  win.document.close();
}

// ══════════════════════════════════════════════════════════════════
// 11. USER PERMISSIONS
// ══════════════════════════════════════════════════════════════════

const PERM_KEYS = [
  {key:'can_pos',label:'POS ขาย'},{key:'can_inv',label:'คลังสินค้า'},
  {key:'can_cash',label:'ลิ้นชัก'},{key:'can_exp',label:'รายจ่าย'},
  {key:'can_debt',label:'ลูกหนี้'},{key:'can_att',label:'พนักงาน'},
  {key:'can_purchase',label:'รับสินค้า'},{key:'can_dash',label:'Dashboard'},
  {key:'can_log',label:'ประวัติ'}
];

async function renderUserPerms(container) {
  const {data:users} = await db.from('ผู้ใช้งาน').select('*').order('username');
  const {data:perms} = await db.from('สิทธิ์การเข้าถึง').select('*');
  const permMap = {};
  (perms||[]).forEach(p=>{permMap[p.user_id]=p;});
  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table" style="min-width:750px;">
        <thead><tr>
          <th>ผู้ใช้งาน</th>
          ${PERM_KEYS.map(p=>`<th style="text-align:center;font-size:11px;white-space:nowrap;">${p.label}</th>`).join('')}
          <th></th>
        </tr></thead>
        <tbody>${(users||[]).map(u=>{
          const p = permMap[u.id]||{};
          return `<tr><td><strong>${u.username}</strong>
            <span class="badge ${u.role==='admin'?'badge-danger':'badge-info'}" style="margin-left:6px;">${u.role}</span></td>
            ${PERM_KEYS.map(pk=>`<td style="text-align:center;">
              <input type="checkbox" id="perm-${u.id}-${pk.key}"
                ${(u.role==='admin'||p[pk.key])?'checked':''}
                ${u.role==='admin'?'disabled title="admin มีสิทธิ์ทั้งหมด"':''}
                onchange="savePermission('${u.id}')">
            </td>`).join('')}
            <td>${u.id!==USER?.id?`<button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="deleteUserFromAdmin('${u.id}','${u.username}')"><i class="material-icons-round">delete</i></button>`:''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
    <button class="btn btn-primary" style="margin-top:12px;" onclick="showAddUserModal()">
      <i class="material-icons-round">person_add</i> เพิ่มผู้ใช้งาน
    </button>`;
}

async function savePermission(userId) {
  const perms = {};
  PERM_KEYS.forEach(pk=>{
    const el = document.getElementById(`perm-${userId}-${pk.key}`);
    perms[pk.key] = el ? el.checked : false;
  });
  const {data:ex} = await db.from('สิทธิ์การเข้าถึง').select('id').eq('user_id',userId).single();
  if (ex) await db.from('สิทธิ์การเข้าถึง').update(perms).eq('user_id',userId);
  else await db.from('สิทธิ์การเข้าถึง').insert({user_id:userId,...perms});
  toast('บันทึกสิทธิ์สำเร็จ','success');
}

async function deleteUserFromAdmin(id, name) {
  const r = await Swal.fire({title:`ลบผู้ใช้ "${name}"?`,icon:'warning',showCancelButton:true,confirmButtonText:'ลบ',cancelButtonText:'ยกเลิก',confirmButtonColor:'#DC2626'});
  if (!r.isConfirmed) return;
  await db.from('ผู้ใช้งาน').delete().eq('id',id);
  toast('ลบผู้ใช้สำเร็จ','success');
  renderAdminTabs('users');
}

// ══════════════════════════════════════════════════════════════════
// 12. ADMIN TABS
// ══════════════════════════════════════════════════════════════════

const ADMIN_TABS = [
  {key:'shop',    label:'ตั้งค่าร้านค้า', icon:'store'},
  {key:'receipt', label:'ใบเสร็จ/QR',     icon:'receipt_long'},
  {key:'users',   label:'สิทธิ์ผู้ใช้',   icon:'manage_accounts'},
  {key:'emp',     label:'พนักงาน',         icon:'badge'},
  {key:'cats',    label:'หมวดหมู่',        icon:'category'}
];
let currentAdminTab = 'shop';

window.renderAdmin = async function() {
  if (USER?.role !== 'admin') {
    document.getElementById('page-admin').innerHTML = `<div style="text-align:center;padding:80px;"><i class="material-icons-round" style="font-size:64px;color:var(--danger)">block</i><p style="font-size:18px;margin-top:16px;">เข้าถึงได้เฉพาะผู้ดูแลระบบ</p></div>`;
    return;
  }
  document.getElementById('page-admin').innerHTML = `
    <div style="border-bottom:1px solid var(--border-light);margin-bottom:20px;overflow-x:auto;">
      <div style="display:flex;gap:0;min-width:max-content;">
        ${ADMIN_TABS.map(t=>`
          <button id="admin-tab-${t.key}" onclick="renderAdminTabs('${t.key}')"
            style="padding:12px 18px;border:none;background:none;cursor:pointer;font-family:var(--font-thai);font-size:14px;
                   border-bottom:2px solid ${currentAdminTab===t.key?'var(--primary)':'transparent'};
                   color:${currentAdminTab===t.key?'var(--primary)':'var(--text-secondary)'};
                   font-weight:${currentAdminTab===t.key?'700':'400'};
                   display:flex;align-items:center;gap:6px;white-space:nowrap;">
            <i class="material-icons-round" style="font-size:17px;">${t.icon}</i>${t.label}
          </button>`).join('')}
      </div>
    </div>
    <div id="admin-tab-content"></div>`;
  renderAdminTabs(currentAdminTab);
};

async function renderAdminTabs(tabKey) {
  currentAdminTab = tabKey;
  ADMIN_TABS.forEach(t=>{
    const btn = document.getElementById(`admin-tab-${t.key}`);
    if (!btn) return;
    btn.style.borderBottomColor = t.key===tabKey ? 'var(--primary)' : 'transparent';
    btn.style.color = t.key===tabKey ? 'var(--primary)' : 'var(--text-secondary)';
    btn.style.fontWeight = t.key===tabKey ? '700' : '400';
  });
  const c = document.getElementById('admin-tab-content');
  if (!c) return;
  if (tabKey==='shop')    await renderShopSettings(c);
  else if (tabKey==='receipt') await renderReceiptSettings(c);
  else if (tabKey==='users')   await renderUserPerms(c);
  else if (tabKey==='emp')     await renderEmployeeAdmin(c);
  else if (tabKey==='cats')    await renderCategoriesAdmin(c);
}

// ─── Shop Settings ────────────────────────────────────────────────
async function renderShopSettings(container) {
  const {data:rc} = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).single();
  container.innerHTML = `
    <form id="shop-form" onsubmit="event.preventDefault();saveShopSettings()">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <div class="form-group"><label class="form-label">ชื่อร้าน (ไทย)</label><input class="form-input" id="shop-name" value="${rc?.shop_name||SHOP_CONFIG.name}"></div>
          <div class="form-group"><label class="form-label">ชื่อร้าน (EN)</label><input class="form-input" id="shop-name-en" value="${rc?.shop_name_en||SHOP_CONFIG.nameEn}"></div>
          <div class="form-group"><label class="form-label">ที่อยู่</label><textarea class="form-input" id="shop-addr" rows="3">${rc?.address||SHOP_CONFIG.address}</textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label class="form-label">เบอร์โทร</label><input class="form-input" id="shop-phone" value="${rc?.phone||SHOP_CONFIG.phone}"></div>
            <div class="form-group"><label class="form-label">เลขผู้เสียภาษี</label><input class="form-input" id="shop-tax" value="${rc?.tax_id||SHOP_CONFIG.taxId}"></div>
          </div>
        </div>
        <div>
          <div class="form-group"><label class="form-label">อีเมล</label><input class="form-input" id="shop-email" value="${rc?.email||''}"></div>
          <div class="form-group"><label class="form-label">Line ID</label><input class="form-input" id="shop-line" value="${rc?.line_id||''}"></div>
          <div class="form-group"><label class="form-label">Facebook</label><input class="form-input" id="shop-fb" value="${rc?.facebook||''}"></div>
          <div class="form-group"><label class="form-label">Website</label><input class="form-input" id="shop-web" value="${rc?.website||''}"></div>
        </div>
      </div>
      <button type="submit" class="btn btn-primary"><i class="material-icons-round">save</i> บันทึก</button>
    </form>`;
}
async function saveShopSettings() {
  const {data:ex} = await db.from('ตั้งค่าร้านค้า').select('id').limit(1).single();
  const d = {
    shop_name:document.getElementById('shop-name').value,
    shop_name_en:document.getElementById('shop-name-en').value,
    address:document.getElementById('shop-addr').value,
    phone:document.getElementById('shop-phone').value,
    tax_id:document.getElementById('shop-tax').value,
    email:document.getElementById('shop-email').value,
    line_id:document.getElementById('shop-line').value,
    facebook:document.getElementById('shop-fb').value,
    website:document.getElementById('shop-web').value,
    updated_by:USER?.username, updated_at:new Date().toISOString()
  };
  if (ex) await db.from('ตั้งค่าร้านค้า').update(d).eq('id',ex.id);
  else await db.from('ตั้งค่าร้านค้า').insert(d);
  toast('บันทึกสำเร็จ','success');
}

// ─── Receipt + PromptPay ──────────────────────────────────────────
async function renderReceiptSettings(container) {
  const {data:rc} = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).single();
  const pp = rc?.promptpay_number||'';
  const qrUrl = pp ? `https://promptpay.io/${pp.replace(/[^0-9]/g,'')}.png` : '';
  const BANKS = ['กสิกรไทย (KBank)','ไทยพาณิชย์ (SCB)','กรุงเทพ (BBL)','กรุงไทย (KTB)','กรุงศรี (BAY)','ทหารไทยธนชาต (TTB)','ออมสิน','ธ.ก.ส.','CIMB Thai','UOB','Krungthai-AXA'];
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <form id="receipt-form" onsubmit="event.preventDefault();saveReceiptSettings()">
        <div class="form-group"><label class="form-label">Header ใบเสร็จ</label><input class="form-input" id="rc-header" value="${rc?.receipt_header||''}"></div>
        <div class="form-group"><label class="form-label">Footer ใบเสร็จ</label><input class="form-input" id="rc-footer" value="${rc?.receipt_footer||'ขอบคุณที่ใช้บริการ'}"></div>
        <div class="form-group"><label class="form-label">รูปแบบเริ่มต้น</label>
          <div style="display:flex;gap:20px;margin-top:6px;">
            <label style="cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="radio" name="rc-fmt" value="80mm" ${(rc?.default_receipt_format||'80mm')==='80mm'?'checked':''}> 80mm</label>
            <label style="cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="radio" name="rc-fmt" value="A4" ${rc?.default_receipt_format==='A4'?'checked':''}> A4</label>
          </div></div>
        <button type="submit" class="btn btn-primary"><i class="material-icons-round">save</i> บันทึกใบเสร็จ</button>
      </form>
      <div>
        <h4 style="font-size:14px;font-weight:600;margin-bottom:14px;">PromptPay QR Code</h4>
        <div class="form-group"><label class="form-label">หมายเลขพร้อมเพย์</label>
          <input class="form-input" id="pp-number" value="${pp}" oninput="previewPromptPay()" placeholder="เบอร์มือถือหรือเลขบัตร 13 หลัก"></div>
        <div class="form-group"><label class="form-label">ธนาคาร</label>
          <select class="form-input" id="pp-bank">
            <option value="">-- เลือกธนาคาร --</option>
            ${BANKS.map(b=>`<option value="${b}" ${rc?.pp_bank===b?'selected':''}>${b}</option>`).join('')}
          </select></div>
        <div id="qr-preview" style="text-align:center;padding:20px;background:var(--bg-base);border-radius:var(--radius-lg);border:1px solid var(--border-light);">
          ${qrUrl
            ? `<img src="${qrUrl}" style="width:150px;height:150px;border-radius:8px;border:3px solid var(--primary);">
               <p style="margin-top:8px;font-weight:600;">${pp}</p>
               <p style="font-size:12px;color:var(--text-tertiary);">สแกนเพื่อโอนเงิน</p>`
            : `<div style="width:150px;height:150px;background:var(--bg-hover);border-radius:8px;border:2px dashed var(--border-default);display:flex;align-items:center;justify-content:center;margin:0 auto;color:var(--text-tertiary);font-size:12px;">ยังไม่ตั้งค่า</div>`}
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="savePromptPay()">
          <i class="material-icons-round">qr_code</i> บันทึก PromptPay
        </button>
      </div>
    </div>`;
}
function previewPromptPay() {
  const val = document.getElementById('pp-number')?.value||'';
  const cleaned = val.replace(/[^0-9]/g,'');
  const preview = document.getElementById('qr-preview');
  if (!preview) return;
  if (cleaned.length>=10) {
    preview.innerHTML = `<img src="https://promptpay.io/${cleaned}.png" style="width:150px;height:150px;border-radius:8px;border:3px solid var(--primary);">
      <p style="margin-top:8px;font-weight:600;">${val}</p>
      <p style="font-size:12px;color:var(--text-tertiary);">สแกนเพื่อโอนเงิน</p>`;
  } else {
    preview.innerHTML = `<div style="width:150px;height:150px;background:var(--bg-hover);border-radius:8px;border:2px dashed var(--border-default);display:flex;align-items:center;justify-content:center;margin:0 auto;color:var(--text-tertiary);font-size:12px;">กรอกเบอร์ให้ครบ</div>`;
  }
}
async function saveReceiptSettings() {
  const {data:ex} = await db.from('ตั้งค่าร้านค้า').select('id').limit(1).single();
  const d = {
    receipt_header:document.getElementById('rc-header')?.value||'',
    receipt_footer:document.getElementById('rc-footer')?.value||'ขอบคุณที่ใช้บริการ',
    default_receipt_format:document.querySelector('input[name="rc-fmt"]:checked')?.value||'80mm',
    updated_by:USER?.username, updated_at:new Date().toISOString()
  };
  receiptFormat = d.default_receipt_format;
  if (ex) await db.from('ตั้งค่าร้านค้า').update(d).eq('id',ex.id);
  else await db.from('ตั้งค่าร้านค้า').insert(d);
  toast('บันทึกตั้งค่าใบเสร็จสำเร็จ','success');
}
async function savePromptPay() {
  const pp = document.getElementById('pp-number')?.value||'';
  const bank = document.getElementById('pp-bank')?.value||'';
  const {data:ex} = await db.from('ตั้งค่าร้านค้า').select('id').limit(1).single();
  if (ex) await db.from('ตั้งค่าร้านค้า').update({promptpay_number:pp,pp_bank:bank}).eq('id',ex.id);
  else await db.from('ตั้งค่าร้านค้า').insert({promptpay_number:pp,pp_bank:bank});
  toast('บันทึก PromptPay สำเร็จ','success');
}

// ─── Employee Admin Tab ───────────────────────────────────────────
async function renderEmployeeAdmin(container) {
  const emps = await loadEmployees();
  container.innerHTML = `
    <div class="inv-toolbar">
      <h3 style="font-size:15px;font-weight:600;">พนักงานทั้งหมด (${emps.length} คน)</h3>
      <button class="btn btn-primary" onclick="showEmployeeModal()"><i class="material-icons-round">person_add</i> เพิ่มพนักงาน</button>
    </div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>เบอร์โทร</th><th>ประเภท</th><th class="text-right">อัตราค่าจ้าง</th><th>วันเริ่ม</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
        <tbody>
          ${emps.map(emp=>`
            <tr>
              <td><strong>${emp.name} ${emp.lastname||''}</strong></td>
              <td>${emp.position}</td>
              <td>${emp.phone||'-'}</td>
              <td>${emp.pay_type}</td>
              <td class="text-right">฿${formatNum(emp.pay_type==='รายเดือน'?(emp.salary||0):(emp.daily_wage||0))}</td>
              <td>${emp.start_date?formatDate(emp.start_date):'-'}</td>
              <td><span class="badge ${emp.status==='ทำงาน'?'badge-success':emp.status==='ลาออก'?'badge-danger':'badge-warning'}">${emp.status}</span></td>
              <td><div class="table-actions">
                <button class="btn btn-ghost btn-icon" onclick="editEmpAdmin('${emp.id}')"><i class="material-icons-round">edit</i></button>
                <button class="btn btn-ghost btn-icon" style="color:var(--warning)" onclick="showCashAdvanceModal('${emp.id}','${emp.name}')"><i class="material-icons-round">payments</i></button>
                <button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="deleteEmployee('${emp.id}','${emp.name}')"><i class="material-icons-round">person_off</i></button>
              </div></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
async function editEmpAdmin(id) {
  const {data:emp} = await db.from('พนักงาน').select('*').eq('id',id).single();
  if (emp) showEmployeeModal(emp);
  const origClose = closeModal;
  closeModal = function() { origClose(); renderAdminTabs('emp'); closeModal = origClose; };
}

// ─── Categories Tab ───────────────────────────────────────────────
async function renderCategoriesAdmin(container) {
  const {data:cats} = await db.from('categories').select('*').order('name');
  container.innerHTML = `
    <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">หมวดหมู่สินค้า (${(cats||[]).length} หมวด)</h3>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
      ${(cats||[]).map(c=>`
        <div style="display:flex;align-items:center;gap:6px;background:var(--bg-base);border-radius:999px;padding:6px 12px;font-size:13px;border:1px solid var(--border-light);">
          <span style="width:10px;height:10px;border-radius:50%;background:${c.color};display:inline-block;flex-shrink:0;"></span>
          ${c.name}
          <button onclick="deleteCat('${c.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);padding:0;line-height:1;"><i class="material-icons-round" style="font-size:14px;">close</i></button>
        </div>`).join('')}
    </div>
    <form id="cat-form" style="display:flex;gap:8px;" onsubmit="event.preventDefault();addCategoryAdmin()">
      <input class="form-input" id="cat-name" placeholder="ชื่อหมวดหมู่" style="flex:1;">
      <input type="color" class="form-input" id="cat-color" value="#DC2626" style="width:48px;padding:4px;cursor:pointer;">
      <button type="submit" class="btn btn-primary"><i class="material-icons-round">add</i> เพิ่ม</button>
    </form>`;
}
async function addCategoryAdmin() {
  const name = document.getElementById('cat-name')?.value?.trim();
  const color = document.getElementById('cat-color')?.value||'#DC2626';
  if (!name) return;
  await db.from('categories').insert({name,color});
  toast('เพิ่มหมวดหมู่สำเร็จ','success');
  await loadCategories();
  renderAdminTabs('cats');
}
async function deleteCat(id) {
  const r = await Swal.fire({title:'ลบหมวดหมู่นี้?',icon:'warning',showCancelButton:true,confirmButtonText:'ลบ',cancelButtonText:'ยกเลิก',confirmButtonColor:'#DC2626'});
  if (!r.isConfirmed) return;
  await db.from('categories').delete().eq('id',id);
  toast('ลบสำเร็จ','success');
  await loadCategories();
  renderAdminTabs('cats');
}

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════

(async () => {
  try {
    const {data} = await db.from('ตั้งค่าร้านค้า').select('default_receipt_format').limit(1).single();
    if (data?.default_receipt_format) receiptFormat = data.default_receipt_format;
  } catch {}
})();

// add เพิ่มก่อน formatDate ถ้าไม่มีใน app.js
if (typeof formatDate === 'undefined') {
  window.formatDate = function(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {day:'numeric',month:'short',year:'numeric'});
  };
}

console.log('[SK POS modules.js] v2.0 ✅ All modules loaded');
