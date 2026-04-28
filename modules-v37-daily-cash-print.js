/*
 * v37 - daily cash drawer guard + close history + clearer print details
 */
'use strict';

(function () {
  const money = n => Number(n || 0);
  const fmt = n => money(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const intFmt = n => money(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
  const user = () => {
    try { return USER?.username || 'system'; } catch (_) { return 'system'; }
  };
  const notify = (msg, type = 'info') => {
    try { if (typeof toast === 'function') toast(msg, type); } catch (_) {}
  };
  const localDateKey = value => {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const dateTime = value => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString('th-TH', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (_) { return '-'; }
  };

  async function must(res) {
    const out = await res;
    if (out?.error) throw out.error;
    return out;
  }

  async function getOpenSessionRaw() {
    const { data, error } = await db.from('cash_session')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function calcSessionTotals(sessionId, openingAmount) {
    const { data, error } = await db.from('cash_transaction')
      .select('*')
      .eq('session_id', sessionId);
    if (error) throw error;
    let cashIn = 0, cashOut = 0;
    (data || []).forEach(tx => {
      const n = money(tx.net_amount ?? tx.amount);
      if (tx.direction === 'in') cashIn += n;
      else cashOut += n;
    });
    return {
      transactions: data || [],
      cashIn,
      cashOut,
      balance: money(openingAmount) + cashIn - cashOut,
    };
  }

  async function closeSessionSystem(session, reason) {
    const totals = await calcSessionTotals(session.id, session.opening_amt);
    const base = {
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: reason === 'manual' ? user() : 'ระบบ (ไม่มีการปิดยอด)',
      closing_amt: totals.balance,
      note: reason === 'manual'
        ? (session.note || null)
        : 'ไม่มีการปิดยอด: ระบบปิดรอบอัตโนมัติเมื่อขึ้นวันใหม่',
    };
    const withAudit = {
      ...base,
      closing_denominations: null,
      counted_closing_amt: null,
      close_difference: null,
      close_status: 'ไม่มีการปิดยอด',
    };
    try {
      await must(db.from('cash_session').update(withAudit).eq('id', session.id));
    } catch (_) {
      await must(db.from('cash_session').update(base).eq('id', session.id));
    }
    return totals.balance;
  }

  async function ensureTodaySession(options = {}) {
    const session = await getOpenSessionRaw();
    if (!session) return null;
    if (localDateKey(session.opened_at) === localDateKey()) return session;
    const bal = await closeSessionSystem(session, 'auto');
    if (options.toast) notify(`ปิดรอบลิ้นชักของวันก่อนแล้ว ยอดปิด ฿${fmt(bal)} กรุณาเปิดลิ้นชักของวันนี้`, 'info');
    return null;
  }

  async function getTodayOpenSessionOrWarn() {
    const session = await ensureTodaySession({ toast: true });
    if (session) return session;
    if (window.Swal) {
      await Swal.fire({
        icon: 'warning',
        title: 'ยังไม่ได้เปิดลิ้นชักของวันนี้',
        text: 'กรุณาเปิดลิ้นชักก่อนรับชำระเงินสด เพื่อให้ยอดรีเซตและนับใหม่ทุกวัน',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#dc2626',
      });
    } else {
      notify('กรุณาเปิดลิ้นชักของวันนี้ก่อนรับเงินสด', 'warning');
    }
    throw new Error('ยังไม่ได้เปิดลิ้นชักของวันนี้');
  }

  function ensureCashControls() {
    const exchangeBtn = document.getElementById('cash-close-btn');
    if (!exchangeBtn || document.getElementById('cash-day-close-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'v32act v32act-day-close';
    btn.id = 'cash-day-close-btn';
    btn.innerHTML = '<i class="material-icons-round">lock</i><span>ปิดลิ้นชัก</span>';
    exchangeBtn.insertAdjacentElement('afterend', btn);
    if (!document.getElementById('v37-cash-style')) {
      const st = document.createElement('style');
      st.id = 'v37-cash-style';
      st.textContent = `
        .v32act-day-close{background:linear-gradient(135deg,#0f172a,#334155)!important;color:#fff!important}
        .v37hist{margin-top:18px;background:#fff;border:2px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,.06)}
        .v37hist-h{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid #e2e8f0;font-weight:800;color:#334155;flex-wrap:wrap}
        .v37hist-list{padding:12px 16px;display:grid;gap:10px;max-height:360px;overflow:auto}
        .v37hist-picker{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .v37hist-picker input{height:36px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;font-family:inherit;font-weight:800;color:#334155}
        .v37hist-card{border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#f8fafc;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}
        .v37hist-title{font-weight:900;color:#0f172a}.v37hist-sub{font-size:12px;color:#64748b;margin-top:2px}
        .v37hist-money{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12px;font-weight:800}
        .v37hist-money span{background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:4px 9px}
        .v37mini{border:none;border-radius:10px;background:#334155;color:#fff;padding:8px 11px;font-weight:800;cursor:pointer}
      `;
      document.head.appendChild(st);
    }
  }

  async function renderCashHistory() {
    const host = document.getElementById('v37-cash-history');
    if (!host) return;
    const dateKey = document.getElementById('v37-cash-history-date')?.value || '';
    if (!dateKey) {
      host.innerHTML = '<div style="padding:22px;text-align:center;color:#94a3b8;font-weight:800">เลือกวันที่ที่ต้องการดูประวัติลิ้นชักก่อน</div>';
      window.v37CashHistoryTx = {};
      return;
    }
    host.innerHTML = '<div style="padding:18px;color:#64748b;font-weight:700">กำลังโหลดประวัติ...</div>';
    try {
      const start = new Date(`${dateKey}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const { data: sessions, error } = await db.from('cash_session')
        .select('*')
        .gte('opened_at', start.toISOString())
        .lt('opened_at', end.toISOString())
        .order('opened_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = (sessions || []).map(s => s.id);
      let txs = [];
      if (ids.length) {
        const txRes = await db.from('cash_transaction').select('*').in('session_id', ids);
        if (txRes.error) throw txRes.error;
        txs = txRes.data || [];
      }
      const bySession = {};
      txs.forEach(tx => {
        if (!bySession[tx.session_id]) bySession[tx.session_id] = [];
        bySession[tx.session_id].push(tx);
      });
      window.v37CashHistoryTx = bySession;
      if (!sessions?.length) {
        host.innerHTML = '<div style="padding:22px;text-align:center;color:#94a3b8">ไม่พบประวัติลิ้นชักในวันที่เลือก</div>';
        return;
      }
      host.innerHTML = sessions.map(s => {
        const list = bySession[s.id] || [];
        let cashIn = 0, cashOut = 0;
        list.forEach(tx => {
          const n = money(tx.net_amount ?? tx.amount);
          if (tx.direction === 'in') cashIn += n;
          else cashOut += n;
        });
        const closeAmt = s.status === 'closed' ? money(s.closing_amt) : money(s.opening_amt) + cashIn - cashOut;
        const status = s.status === 'open' ? 'กำลังเปิดอยู่' : 'ปิดแล้ว';
        const counted = money(s.counted_closing_amt);
        const diff = s.close_difference == null ? null : money(s.close_difference);
        return `<div class="v37hist-card">
          <div>
            <div class="v37hist-title">${esc(localDateKey(s.opened_at))} · ${esc(status)}</div>
            <div class="v37hist-sub">เปิด ${esc(dateTime(s.opened_at))} โดย ${esc(s.opened_by || '-')} ${s.closed_at ? `· ปิด ${esc(dateTime(s.closed_at))} โดย ${esc(s.closed_by || '-')}` : ''}</div>
            <div class="v37hist-money">
              <span>เปิด ฿${fmt(s.opening_amt)}</span>
              <span style="color:#059669">เข้า ฿${fmt(cashIn)}</span>
              <span style="color:#dc2626">ออก ฿${fmt(cashOut)}</span>
              <span>ยอดปิด/คงเหลือ ฿${fmt(closeAmt)}</span>
              ${counted > 0 ? `<span style="color:#0f766e">นับจริง ฿${fmt(counted)}</span>` : ''}
              ${diff !== null ? `<span style="color:${Math.abs(diff) < 0.01 ? '#059669' : '#dc2626'}">ส่วนต่าง ฿${fmt(diff)}</span>` : ''}
            </div>
            ${s.note ? `<div class="v37hist-sub">หมายเหตุ: ${esc(s.note)}</div>` : ''}
          </div>
          <button class="v37mini" onclick="window.v37ShowCashSessionTx('${esc(s.id)}')">ดูรายการ</button>
        </div>`;
      }).join('');
    } catch (e) {
      host.innerHTML = `<div style="padding:18px;color:#dc2626;font-weight:800">โหลดประวัติไม่สำเร็จ: ${esc(e.message || e)}</div>`;
    }
  }

  window.v37ShowCashSessionTx = async function (sessionId) {
    const list = (window.v37CashHistoryTx?.[sessionId] || []).slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const html = list.length ? list.map(tx => {
      const isIn = tx.direction === 'in';
      return `<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #e5e7eb;text-align:left">
        <div><b>${esc(tx.type || '-')}</b><div style="font-size:12px;color:#64748b">${esc(dateTime(tx.created_at))} · ${esc(tx.staff_name || '-')}</div>${tx.note ? `<div style="font-size:12px;color:#64748b">${esc(tx.note)}</div>` : ''}</div>
        <b style="color:${isIn ? '#059669' : '#dc2626'}">${isIn ? '+' : '-'}฿${fmt(tx.net_amount ?? tx.amount)}</b>
      </div>`;
    }).join('') : '<div style="color:#94a3b8;text-align:center;padding:18px">ไม่มีรายการในรอบนี้</div>';
    if (window.Swal) {
      await Swal.fire({ title: 'รายการในรอบลิ้นชัก', html, width: 620, confirmButtonText: 'ปิด' });
    }
  };

  async function closeTodayDrawer() {
    const session = await ensureTodaySession({ toast: true });
    if (!session) return;
    const totals = await calcSessionTotals(session.id, session.opening_amt);
    let counts = null;
    if (typeof window.v32ShowDenomWizard === 'function') {
      counts = await window.v32ShowDenomWizard({
        title: 'ปิดลิ้นชัก - นับเงินสดจริง',
        subtitle: 'กรอกจำนวนแบงค์/เหรียญที่มีอยู่จริงตอนปิดยอด ระบบจะบันทึกไว้เป็นยอดปิดลิ้นชัก',
        icon: '<i class="material-icons-round">fact_check</i>',
        dir: 'in',
        confirmText: 'บันทึกยอดปิด',
        cancelText: 'ยกเลิก'
      });
      if (!counts) return;
    } else {
      notify('ไม่พบหน้าต่างนับแบงค์ กรุณาโหลดระบบใหม่', 'error');
      return;
    }
    const countedTotal = Object.entries(counts || {}).reduce((sum, [k, v]) => sum + money(k) * money(v), 0);
    const diff = countedTotal - totals.balance;
    let note = '';
    if (window.Swal) {
      const res = await Swal.fire({
        icon: 'question',
        title: 'ยืนยันปิดลิ้นชักวันนี้?',
        html: `<div style="text-align:left;font-family:Prompt,sans-serif">
          <div style="display:flex;justify-content:space-between;padding:7px 0"><span>ยอดเปิด</span><b>฿${fmt(session.opening_amt)}</b></div>
          <div style="display:flex;justify-content:space-between;padding:7px 0;color:#059669"><span>รับเข้า</span><b>฿${fmt(totals.cashIn)}</b></div>
          <div style="display:flex;justify-content:space-between;padding:7px 0;color:#dc2626"><span>จ่ายออก</span><b>฿${fmt(totals.cashOut)}</b></div>
          <div style="display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid #e5e7eb"><span>ยอดตามระบบ</span><b>฿${fmt(totals.balance)}</b></div>
          <div style="display:flex;justify-content:space-between;padding:9px 0;font-size:18px"><span>ยอดที่นับจริง</span><b>฿${fmt(countedTotal)}</b></div>
          <div style="display:flex;justify-content:space-between;padding:9px 0;color:${Math.abs(diff) < 0.01 ? '#059669' : '#dc2626'}"><span>ส่วนต่าง</span><b>฿${fmt(diff)}</b></div>
          <input id="v37-close-note" class="swal2-input" placeholder="หมายเหตุ (ถ้ามี)" style="margin:10px 0 0;width:100%">
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'ปิดลิ้นชัก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#0f172a',
        preConfirm: () => document.getElementById('v37-close-note')?.value || '',
      });
      if (!res.isConfirmed) return;
      note = res.value || '';
    } else if (!confirm(`ปิดลิ้นชัก ยอดคงเหลือ ฿${fmt(totals.balance)} ?`)) {
      return;
    }
    const base = {
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: user(),
      closing_amt: countedTotal,
      note: note || null,
    };
    const withCount = {
      ...base,
      closing_denominations: counts,
      counted_closing_amt: countedTotal,
      expected_closing_amt: totals.balance,
      close_difference: diff,
      close_status: Math.abs(diff) < 0.01 ? 'ปิดยอดครบถ้วน' : 'ปิดยอดมีส่วนต่าง',
    };
    try {
      await must(db.from('cash_session').update(withCount).eq('id', session.id));
    } catch (_) {
      await must(db.from('cash_session').update({
        ...base,
        note: [
          note || '',
          `ยอดตามระบบ ฿${fmt(totals.balance)}`,
          `ยอดที่นับจริง ฿${fmt(countedTotal)}`,
          `ส่วนต่าง ฿${fmt(diff)}`,
          `รายการแบงค์/เหรียญ ${JSON.stringify(counts || {})}`,
        ].filter(Boolean).join(' | '),
      }).eq('id', session.id));
    }
    notify('ปิดลิ้นชักเรียบร้อย เปิดใหม่ได้เมื่อเริ่มรอบ/วันใหม่', 'success');
    try { if (typeof renderCashDrawer === 'function') await renderCashDrawer(); } catch (_) {}
    try { if (typeof loadCashBalance === 'function') await loadCashBalance(); } catch (_) {}
  }

  function deliveryModeText(bill) {
    const mode = String(bill?.delivery_mode || '').trim();
    const status = String(bill?.delivery_status || '').trim();
    const payMode = String(bill?.delivery_payment_mode || bill?.deliveryPaymentMode || '').trim();
    const paidText = payMode === 'pay_now' ? 'ชำระแล้ว' : (payMode === 'cod' ? 'ชำระหน้างาน' : '');
    if (/partial|บางส่วน|รับ.*ส่ง/i.test(mode)) return `รับกลับบางส่วน / ส่งทีหลัง${paidText ? ` (${paidText})` : ''}`;
    if (/deliver|ส่ง|จัดส่ง/i.test(mode) && !/รับเอง/.test(mode)) return `ร้านจัดส่ง${paidText ? ` (${paidText})` : ''}`;
    if (/รอจัดส่ง/.test(status)) return `ร้านจัดส่ง${paidText ? ` (${paidText})` : ''}`;
    return 'ลูกค้ารับกลับเอง';
  }

  function autoDocTypeForBill(bill, rows) {
    const hasDelivery = bill?.delivery_mode === 'deliver'
      || bill?.delivery_mode === 'partial'
      || /รอจัดส่ง|จัดส่ง/i.test(String(bill?.delivery_status || ''))
      || (rows || []).some(it => money(it.deliver_qty) > 0);
    if (hasDelivery) return 'delivery';
    const total = money(bill?.total || (rows || []).reduce((s, it) => s + money(it.total), 0));
    const pay = smartPaymentState(bill, total);
    if (!pay.paidFull || pay.deposit > 0) return 'payment';
    return 'receipt';
  }

  function enrichItemsForPrint(items, docType) {
    return (items || []).map(it => {
      const qty = money(it.qty || 1);
      const take = money(it.take_qty ?? (docType === 'delivery' ? 0 : qty));
      const deliver = money(it.deliver_qty ?? 0);
      const suffix = (take > 0 || deliver > 0)
        ? ` (รวม ${intFmt(qty)} | รับกลับ ${intFmt(take)} | ต้องส่ง ${intFmt(deliver)})`
        : '';
      return { ...it, name: String(it.name || '') + suffix };
    });
  }

  async function loadShopConfig() {
    try {
      const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle();
      return data || {};
    } catch (_) { return {}; }
  }

  async function loadDocSettings(docType) {
    const key = docType === 'payment' ? 'payment_receipt' : 'receipt_a4';
    try {
      const all = typeof v10GetDocSettings === 'function' ? await v10GetDocSettings() : {};
      const defaults = typeof V10_DEFAULTS !== 'undefined' ? (V10_DEFAULTS[key] || {}) : {};
      return { ...defaults, ...(all?.[key] || {}) };
    } catch (_) {
      return {};
    }
  }

  function billIsPaid(bill, total, deposit) {
    const status = String(bill?.status || '');
    const method = String(bill?.method || bill?.payment_method || '');
    if (/ยกเลิก|คืนสินค้า|cancel/i.test(status)) return true;
    if (/ค้าง|บางส่วน|มัดจำ|debt|partial/i.test(status)) return false;
    if (deposit > 0 && deposit < total) return false;
    return /สำเร็จ|ชำระแล้ว|จ่ายแล้ว|เงินสด|โอน|พร้อมเพย์|success|paid/i.test(status + ' ' + method);
  }

  function smartPaymentState(bill, total) {
    const deposit = money(bill?.deposit_amount);
    const explicitPaid = Math.max(
      deposit,
      money(bill?.paid_amount),
      money(bill?.paid),
      money(bill?.paid_total),
      money(bill?.payment_amount)
    );
    const paid = billIsPaid(bill, total, deposit) ? total : explicitPaid;
    const due = Math.max(0, total - Math.min(total, paid));
    let label = 'ชำระครบแล้ว';
    let tone = '#059669';
    if (due > 0 && deposit > 0) {
      label = 'ชำระมัดจำแล้ว / คงเหลือต้องชำระ';
      tone = '#d97706';
    } else if (due > 0) {
      label = 'ยังไม่ชำระ / ค้างชำระ';
      tone = '#dc2626';
    }
    return { deposit, paid, due, label, tone, paidFull: due <= 0.009 };
  }

  function deliveryState(bill, rows) {
    const deliverQty = rows.reduce((s, it) => s + money(it.deliver_qty), 0);
    const takeQty = rows.reduce((s, it) => s + money(it.take_qty), 0);
    const raw = String(bill?.delivery_status || '');
    const mode = String(bill?.delivery_mode || '');
    if (/สำเร็จ|delivered/i.test(raw)) return { label: 'จัดส่งสำเร็จแล้ว', tone: '#059669', takeQty, deliverQty };
    if (deliverQty > 0 || /deliver|partial|จัดส่ง|ส่ง|รับบางส่วน/i.test(mode)) {
      return { label: 'รอจัดส่งสินค้า', tone: '#d97706', takeQty, deliverQty };
    }
    return { label: 'ลูกค้ารับกลับเอง / ไม่มีคิวส่ง', tone: '#64748b', takeQty, deliverQty };
  }

  function promptpaySrc(promptpay, amount) {
    const pp = String(promptpay || '').replace(/[^0-9]/g, '');
    if (pp.length < 10) return '';
    return `https://promptpay.io/${pp}/${money(amount).toFixed(2)}.png`;
  }

  function localPaymentSettings(rc) {
    let local = {};
    try { local = JSON.parse(localStorage.getItem('v36_payment_qr_settings') || '{}') || {}; } catch (_) {}
    const enabled = rc?.payment_qr_enabled ?? local.payment_qr_enabled;
    const showReceipt = rc?.payment_qr_show_receipt ?? local.payment_qr_show_receipt;
    return {
      enabled: enabled === undefined ? true : !!enabled,
      showReceipt: showReceipt === undefined ? true : !!showReceipt,
      mode: rc?.payment_qr_mode || local.payment_qr_mode || 'promptpay',
      promptpay: rc?.promptpay_number || local.promptpay_number || rc?.promptpay_id || rc?.qr_promptpay || '',
      bankName: rc?.bank_name || local.bank_name || rc?.bank || '',
      bankAccount: rc?.bank_account_number || local.bank_account_number || rc?.bank_account || '',
      bankAccountName: rc?.bank_account_name || local.bank_account_name || rc?.promptpay_name || '',
    };
  }

  function qrPaymentBlock(rc, amountDue, paymentState) {
    const s = localPaymentSettings(rc);
    if (!s.enabled || !s.showReceipt || paymentState.paidFull || amountDue <= 0) {
      return `<div class="paid-stamp">ชำระครบแล้ว<small>ไม่ต้องแสดง QR ในบิลนี้</small></div>`;
    }
    const src = promptpaySrc(s.promptpay, amountDue);
    const bank = s.mode === 'bank' || s.bankAccount
      ? `<div class="bank-lines"><b>${esc(s.bankName || 'บัญชีธนาคาร')}</b><br>เลขบัญชี: ${esc(s.bankAccount || '-')}<br>ชื่อบัญชี: ${esc(s.bankAccountName || rc?.shop_name || '-')}</div>`
      : '';
    if (!src && !bank) {
      return `<div class="qr-missing">ยังไม่ได้ตั้งค่า QR รับชำระ<br><small>ตั้งค่า PromptPay ที่หน้าแอดมิน</small></div>`;
    }
    return `<div class="qrbox">
      <div class="thaiqr-head"><div class="thaiqr-mark">QR</div><div>THAI QR<br>PAYMENT</div></div>
      <div class="pp-badge">พร้อมเพย์<br><b>PromptPay</b></div>
      ${src ? `<img src="${src}" onerror="this.style.display='none'">` : ''}
      <div class="qr-sub">${src ? `PromptPay: ${esc(s.promptpay)}` : 'โอนเข้าบัญชีธนาคาร'}</div>
      ${bank}
    </div>`;
  }

  async function printA4Detailed(bill, items, docType = 'receipt') {
    const rc = await loadShopConfig();
    const ds = await loadDocSettings(docType);
    const rows = items || [];
    const subtotal = rows.reduce((s, it) => s + money(it.total), 0);
    const discount = money(bill?.discount);
    const total = money(bill?.total || Math.max(0, subtotal - discount));
    const payState = smartPaymentState(bill, total);
    const delivery = deliveryState(bill, rows);
    const deposit = payState.deposit;
    const remaining = payState.due;
    const noteText = ds?.note_text || 'สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน';
    const footerText = ds?.footer_text || rc?.receipt_footer || 'ขอบคุณที่ใช้บริการ';
    const words = typeof v24NumberToThaiWords === 'function'
      ? v24NumberToThaiWords(total)
      : '';
    const dueWords = typeof v24NumberToThaiWords === 'function' && remaining > 0
      ? v24NumberToThaiWords(remaining)
      : '';
    const title = docType === 'delivery' ? 'ใบส่งของ' : (docType === 'payment' ? 'ใบรับเงินมัดจำ' : 'ใบเสร็จรับเงิน / ใบกำกับภาษี');
    const titleEn = docType === 'delivery' ? 'DELIVERY NOTE' : (docType === 'payment' ? 'PAYMENT RECEIPT' : 'RECEIPT / TAX INVOICE');
    const showDeliveryCols = rows.some(it => money(it.deliver_qty) > 0) || /deliver|partial|จัดส่ง|ส่ง|รับบางส่วน/i.test(String(bill?.delivery_mode || ''));
    const itemCount = rows.length;
    const compact = itemCount > 10;
    const dense = itemCount > 18;
    const tiny = itemCount > 30;
    const ultra = itemCount > 45;
    const bodyFs = ultra ? 7 : tiny ? 8.2 : dense ? 9 : compact ? 10 : 11.5;
    const tableFs = ultra ? 5.8 : tiny ? 7.2 : dense ? 8 : compact ? 9 : 10.5;
    const cellPad = ultra ? '1px 3px' : tiny ? '2px 4px' : dense ? '3px 5px' : compact ? '4px 6px' : '6px 7px';
    const pagePad = ultra ? '4mm 5mm 3mm' : tiny ? '6mm 7mm 4mm' : dense ? '7mm 8mm 5mm' : compact ? '8mm 9mm 6mm' : '10mm';
    const qrScale = ultra ? 56 : tiny ? 72 : dense ? 86 : compact ? 100 : 118;
    const pageZoom = itemCount > 70 ? 0.62 : ultra ? 0.76 : itemCount > 30 ? 0.88 : 1;
    const deliveryAddressHtml = bill?.delivery_address
      ? `<span class="muted">สถานที่จัดส่ง:</span><b class="addr">${esc(bill.delivery_address)}</b>`
      : '';
    const tr = rows.map((it, i) => {
      const qty = money(it.qty || 1);
      const take = money(it.take_qty ?? (showDeliveryCols ? qty : 0));
      const deliver = money(it.deliver_qty ?? 0);
      return `<tr>
        <td class="c">${i + 1}</td>
        <td><b>${esc(it.name || '')}</b>${showDeliveryCols ? `<div class="small">รับกลับแล้ว ${intFmt(take)} · ต้องเอาไปส่ง ${intFmt(deliver)}</div>` : ''}</td>
        <td class="c">${intFmt(qty)}</td>
        ${showDeliveryCols ? `<td class="c ok">${intFmt(take)}</td><td class="c warn">${intFmt(deliver)}</td>` : ''}
        <td class="c">${esc(it.unit || 'ชิ้น')}</td>
        <td class="r">${fmt(it.price)}</td>
        <td class="r strong">${fmt(it.total)}</td>
      </tr>`;
    }).join('');
    const win = window.open('', '_blank', 'width=960,height=1050');
    if (!win) { notify('กรุณาอนุญาต popup เพื่อพิมพ์เอกสาร', 'error'); return; }
    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${esc(title)} #${esc(bill?.bill_no || '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Sarabun,sans-serif;color:#0f172a;margin:0;font-size:${bodyFs}px}.page{width:calc(210mm / ${pageZoom});height:calc(297mm / ${pageZoom});overflow:hidden;padding:${pagePad};display:flex;flex-direction:column;transform:scale(${pageZoom});transform-origin:top left}.top{display:flex;justify-content:space-between;gap:18px;border-bottom:3px solid #dc2626;padding-bottom:${tiny ? 5 : 9}px}.shop h1{margin:0;color:#dc2626;font-size:${tiny ? 17 : dense ? 19 : 23}px;line-height:1.05}.muted{color:#64748b}.badge{background:#dc2626;color:#fff;border-radius:7px;padding:${tiny ? '6px 12px' : '9px 16px'};text-align:center;min-width:${tiny ? 145 : 180}px}.badge b{font-size:${tiny ? 12 : 17}px}.badge span{display:block;font-size:${tiny ? 7 : 9}px}.status-strip{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:${tiny ? 5 : 8}px}.status-card{border:1px solid #e2e8f0;border-radius:7px;padding:${tiny ? '4px 7px' : '7px 9px'};background:#f8fafc}.status-card span{display:block;color:#64748b;font-size:${tiny ? 7 : 9}px}.status-card b{font-size:${tiny ? 9 : 12}px}.box{border:1px solid #e2e8f0;border-radius:7px;margin-top:${tiny ? 5 : 9}px;overflow:hidden}.box-h{background:#fff1f2;color:#dc2626;font-weight:900;padding:${tiny ? '4px 8px' : '6px 10px'}}.box-b{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:${tiny ? '6px 9px' : '9px 11px'}}.addr{white-space:pre-line;text-align:right}.info{display:grid;grid-template-columns:105px 1fr;gap:6px;line-height:1.55}.info b{text-align:right}table{width:100%;border-collapse:collapse;margin-top:${tiny ? 5 : 9}px;font-size:${tableFs}px}th{background:#dc2626;color:#fff;padding:${cellPad};font-weight:900}td{padding:${cellPad};border-bottom:1px solid #e5e7eb;vertical-align:top;line-height:1.22}tr:nth-child(even) td{background:#f8fafc}.c{text-align:center}.r{text-align:right}.strong{font-weight:900}.small{font-size:${Math.max(6.5, tableFs - 1)}px;color:#64748b;margin-top:1px}.ok{color:#059669;font-weight:900}.warn{color:#d97706;font-weight:900}.bottom{display:grid;grid-template-columns:1fr ${tiny ? 205 : dense ? 225 : 255}px;gap:${tiny ? 10 : 18}px;margin-top:${tiny ? 6 : 11}px}.amount-panel{border:1px solid #e2e8f0;border-radius:9px;overflow:hidden;background:#fff}.amount-row{display:flex;justify-content:space-between;gap:12px;padding:${tiny ? '6px 8px' : '9px 12px'};border-bottom:1px solid #eef2f7;color:#64748b;font-weight:900}.amount-row b{color:#0f172a}.amount-row.pay{border-bottom:none;background:${remaining > 0 ? '#fff7ed' : '#ecfdf5'};color:${remaining > 0 ? '#9a3412' : '#047857'}}.amount-row.pay b{font-size:${tiny ? 16 : 24}px;color:${remaining > 0 ? '#c2410c' : '#059669'}}.words{border:1px solid #e2e8f0;border-radius:7px;padding:${tiny ? '5px 7px' : '8px 10px'};margin-top:7px}.words b{display:block;color:#dc2626}.qrbox{text-align:center;border:3px solid #16b8d4;border-radius:18px;padding:0 0 ${tiny ? 5 : 8}px;margin-top:7px;background:#fff;overflow:hidden}.thaiqr-head{background:#183d73;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;height:${tiny ? 26 : 38}px;font-size:${tiny ? 8 : 12}px;font-weight:900;line-height:1.05}.thaiqr-mark{width:${tiny ? 22 : 30}px;height:${tiny ? 18 : 24}px;border:3px solid #fff;border-radius:5px;display:flex;align-items:center;justify-content:center}.pp-badge{display:inline-block;border:2px solid #183d73;color:#183d73;margin:${tiny ? '5px 0 3px' : '8px 0 5px'};padding:1px 8px;line-height:.95;font-size:${tiny ? 7 : 10}px;font-weight:900}.pp-badge b{font-size:${tiny ? 11 : 17}px}.qrbox img{width:${qrScale}px;height:${qrScale}px;display:block;margin:2px auto}.qr-sub,.bank-lines{font-size:${tiny ? 6.5 : 9}px;color:#334155;line-height:1.25}.paid-stamp,.qr-missing{text-align:center;border:1px solid #e2e8f0;border-radius:8px;padding:${tiny ? '8px 6px' : '14px 8px'};margin-top:7px;font-size:${tiny ? 12 : 16}px;font-weight:900;color:#059669;background:#f8fafc}.paid-stamp small,.qr-missing small{display:block;font-size:${tiny ? 7 : 9}px;color:#94a3b8;margin-top:2px}.qr-missing{color:#dc2626}.sig{margin-top:auto;border-top:1px solid #cbd5e1;padding-top:${tiny ? 8 : 16}px;display:flex;justify-content:space-around}.sig div{text-align:center;min-width:150px}.line{height:${tiny ? 18 : 28}px;border-bottom:1px solid #64748b;margin-bottom:4px}.foot{text-align:center;color:#94a3b8;font-size:${tiny ? 7 : 9}px;border-top:1px solid #eef2f7;margin-top:8px;padding-top:5px}@media print{body{margin:0}.page{page-break-after:avoid;break-after:avoid}}
</style></head><body><div class="page">
  <div class="top"><div class="shop"><h1>${esc(rc.shop_name || 'ร้านค้า')}</h1><div class="muted">${esc(rc.address || '')}<br>${rc.phone ? `โทร: ${esc(rc.phone)}` : ''}</div></div><div><div class="badge"><b>${esc(title)}</b><span>${esc(titleEn)}</span></div><div class="muted" style="text-align:right;margin-top:8px;line-height:1.6">เลขที่: <b>${esc(bill?.bill_no || '-')}</b><br>วันที่: <b>${esc(dateTime(bill?.date))}</b><br>พิมพ์เมื่อ: ${esc(dateTime(new Date()))}</div></div></div>
  <div class="status-strip"><div class="status-card"><span>สถานะชำระเงิน</span><b style="color:${payState.tone}">${esc(payState.label)}</b></div><div class="status-card"><span>สถานะจัดส่ง</span><b style="color:${delivery.tone}">${esc(delivery.label)}</b></div></div>
  <section class="box"><div class="box-h">ข้อมูลลูกค้า / การจัดส่ง</div><div class="box-b"><div><b style="font-size:${tiny ? 12 : 15}px">${esc(bill?.customer_name || 'ลูกค้าทั่วไป')}</b><div class="muted" style="white-space:pre-line">${esc(bill?.customer_address || '-')}</div>${bill?.customer_phone || bill?.delivery_phone ? `<div><b>โทร:</b> ${esc(bill.customer_phone || bill.delivery_phone)}</div>` : ''}</div><div><div class="info"><span class="muted">พนักงาน:</span><b>${esc(bill?.staff_name || user())}</b><span class="muted">ชำระ:</span><b>${esc(bill?.method || '-')}</b><span class="muted">รูปแบบส่ง:</span><b>${esc(deliveryModeText(bill))}</b>${bill?.delivery_date ? `<span class="muted">วันที่นัดส่ง:</span><b>${esc(bill.delivery_date)}</b>` : ''}${deliveryAddressHtml}</div></div></div></section>
  <table><thead><tr><th style="width:34px">#</th><th>รายการสินค้า</th><th style="width:60px">รวม</th>${showDeliveryCols ? '<th style="width:72px">รับกลับแล้ว</th><th style="width:72px">ต้องไปส่ง</th>' : ''}<th style="width:58px">หน่วย</th><th style="width:82px">ราคา</th><th style="width:92px">จำนวนเงิน</th></tr></thead><tbody>${tr}</tbody></table>
  <div class="bottom"><div><b>หมายเหตุ / เงื่อนไข</b><div class="muted">${esc(noteText)}</div>${words ? `<div class="words">จำนวนเงินรวมทั้งสิ้น (ตัวอักษร)<b>${esc(words)}</b>${dueWords ? `<span class="muted">ยอดคงเหลือที่ต้องชำระ (ตัวอักษร)</span><b>${esc(dueWords)}</b>` : ''}</div>` : ''}</div><div>
    <div class="amount-panel">
      <div class="amount-row"><span>ยอดสุทธิ</span><b>฿${fmt(total)}</b></div>
      <div class="amount-row pay"><span>${remaining > 0 ? 'ยอดที่ต้องชำระ' : 'ยอดชำระแล้ว'}</span><b>฿${fmt(remaining > 0 ? remaining : total)}</b></div>
    </div>
    ${remaining > 0 ? qrPaymentBlock(rc, remaining, payState) : ''}
  </div></div>
  <div class="sig"><div><div class="line"></div><b>ผู้รับสินค้า / ลูกค้า</b></div><div><div class="line"></div><b>ผู้ส่งสินค้า / ผู้ขาย</b></div></div>
  <div class="foot">${esc(footerText)}</div>
</div><script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close()},1400)},600)}<\/script></body></html>`);
    win.document.close();
  }

  function installPrintOverrides() {
    if (window.__v37PrintInstalled) return;
    window.__v37PrintInstalled = true;
    if (!document.getElementById('v37-checkout-qr-center-style')) {
      const style = document.createElement('style');
      style.id = 'v37-checkout-qr-center-style';
      style.textContent = `
        #sk-pay-info, #v13-method-info, #payment-qr-section{display:flex!important;justify-content:center!important;align-items:center!important;width:100%!important}
        .v36-transfer-qr-box{margin-left:auto!important;margin-right:auto!important;text-align:center!important}
        .v36-transfer-qr-canvas{margin-left:auto!important;margin-right:auto!important}
      `;
      document.head.appendChild(style);
    }
    const original80 = window.print80mmv2;
    if (typeof original80 === 'function') {
      window.print80mmv2 = function (bill, items, rc) {
        return original80.call(this, bill, enrichItemsForPrint(items, 'receipt'), rc);
      };
      try { print80mmv2 = window.print80mmv2; } catch (_) {}
    }
    window.v24PrintDocument = function (bill, items, docType = 'receipt') {
      return printA4Detailed(bill, items || [], docType);
    };
    window.printA4 = (bill, items) => printA4Detailed(bill, items || [], 'receipt');
    window.printReceiptA4v2 = (bill, items) => printA4Detailed(bill, items || [], 'receipt');
    window.printReceipt = async function (bill, items, format) {
      if (format === '80mm' || format === '80') {
        if (typeof window.print80mmv2 === 'function') {
          const rc = await loadShopConfig();
          return window.print80mmv2(bill, items || [], rc);
        }
        return;
      }
      return printA4Detailed(bill, items || [], 'receipt');
    };
    window.v24ShowDocSelector = async function (billId) {
      const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
      const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
      if (!bill) return notify('ไม่พบบิล', 'error');
      const docType = autoDocTypeForBill(bill, items || []);
      return printA4Detailed(bill, items || [], docType);
    };
    window.v5PrintFromHistory = billId => window.v24ShowDocSelector(billId);
    window.v12PrintReceiptA4 = billId => window.v24ShowDocSelector(billId);
    window.v12PrintDeposit = async billId => {
      const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
      const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
      if (bill) return printA4Detailed(bill, items || [], 'payment');
    };
    window.v12PrintDeliveryNote = async billId => {
      const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
      const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
      if (bill) return printA4Detailed(bill, items || [], 'delivery');
    };
    try { v24PrintDocument = window.v24PrintDocument; } catch (_) {}
    try { printReceipt = window.printReceipt; } catch (_) {}
  }

  function installCashDailyGuard() {
    if (window.__v37CashInstalled) return;
    window.__v37CashInstalled = true;
    const originalOpen = window.openCashSession;
    if (typeof originalOpen === 'function') {
      window.openCashSession = async function () {
        await ensureTodaySession({ toast: true });
        return originalOpen.apply(this, arguments);
      };
      try { openCashSession = window.openCashSession; } catch (_) {}
    }
    const originalRecord = window.recordCashTx;
    if (typeof originalRecord === 'function') {
      window.recordCashTx = async function (args = {}) {
        const session = await getTodayOpenSessionOrWarn();
        const next = { ...args };
        next.sessionId = session.id;
        next.session_id = session.id;
        return originalRecord.call(this, next);
      };
      try { recordCashTx = window.recordCashTx; } catch (_) {}
    }
    const wrapSale = name => {
      const fn = window[name];
      if (typeof fn !== 'function' || fn.__v37daily) return;
      window[name] = async function () {
        try {
          if (window.checkoutState?.method === 'cash') await getTodayOpenSessionOrWarn();
        } catch (e) {
          window.__posPaymentLock = false;
          window.isProcessingPayment = false;
          throw e;
        }
        return fn.apply(this, arguments);
      };
      window[name].__v37daily = true;
      try { if (name === 'v9Sale') v9Sale = window[name]; } catch (_) {}
      try { if (name === 'completePayment') completePayment = window[name]; } catch (_) {}
    };
    wrapSale('v9Sale');
    wrapSale('completePayment');
    const originalRender = window.renderCashDrawer;
    if (typeof originalRender === 'function') {
      window.renderCashDrawer = async function () {
        await ensureTodaySession({ toast: true });
        const out = await originalRender.apply(this, arguments);
        ensureCashControls();
        const dayClose = document.getElementById('cash-day-close-btn');
        const session = await getOpenSessionRaw().catch(() => null);
        if (dayClose) {
          dayClose.disabled = !session || localDateKey(session.opened_at) !== localDateKey();
          dayClose.onclick = closeTodayDrawer;
        }
        const txCard = document.querySelector('.v32txc');
        if (txCard && !document.getElementById('v37-cash-history-wrap')) {
          txCard.insertAdjacentHTML('afterend', `<div class="v37hist" id="v37-cash-history-wrap">
            <div class="v37hist-h">
              <span><i class="material-icons-round" style="font-size:18px;vertical-align:middle">history</i> ประวัติลิ้นชักย้อนหลัง</span>
              <div class="v37hist-picker">
                <input type="date" id="v37-cash-history-date">
                <button class="v37mini" onclick="window.v37RenderCashHistory()">แสดงประวัติ</button>
              </div>
            </div>
            <div class="v37hist-list" id="v37-cash-history"></div>
          </div>`);
        }
        await renderCashHistory();
        return out;
      };
      try { renderCashDrawer = window.renderCashDrawer; } catch (_) {}
    }
    const originalLoadCashBalance = window.loadCashBalance;
    if (typeof originalLoadCashBalance === 'function' && !originalLoadCashBalance.__v37daily) {
      window.loadCashBalance = async function () {
        await ensureTodaySession({ toast: false });
        return originalLoadCashBalance.apply(this, arguments);
      };
      window.loadCashBalance.__v37daily = true;
      try { loadCashBalance = window.loadCashBalance; } catch (_) {}
    }
    window.v37RenderCashHistory = renderCashHistory;
  }

  function installAll() {
    try { installCashDailyGuard(); } catch (e) { console.warn('[v37] cash install failed:', e); }
    try { installPrintOverrides(); } catch (e) { console.warn('[v37] print install failed:', e); }
    try {
      if (!document.getElementById('page-cash')?.classList.contains('hidden') && typeof window.renderCashDrawer === 'function') {
        window.renderCashDrawer();
      }
    } catch (_) {}
  }

  setTimeout(installAll, 3200);
  setTimeout(installAll, 4200);
  setTimeout(installAll, 6000);
  window.v37EnsureTodayCashSession = ensureTodaySession;
  console.log('[v37] daily cash + detailed print patch loaded');
})();
