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
  const isAdminUser = () => {
    try { return String(USER?.role || '').toLowerCase() === 'admin'; }
    catch (_) { return false; }
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
  const addMinutesDateTime = (value, minutes = 30) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    d.setMinutes(d.getMinutes() + minutes);
    return dateTime(d);
  };
  const denoms = [
    [1000, '1,000', 'ใบ'], [500, '500', 'ใบ'], [100, '100', 'ใบ'], [50, '50', 'ใบ'], [20, '20', 'ใบ'],
    [10, '10', 'เหรียญ'], [5, '5', 'เหรียญ'], [2, '2', 'เหรียญ'], [1, '1', 'เหรียญ'],
  ];
  const parseJson = value => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return {}; }
  };
  const denomTotal = value => {
    const obj = parseJson(value);
    return denoms.reduce((sum, [v]) => sum + v * money(obj[v] ?? obj[String(v)]), 0);
  };
  const denomChips = (value, empty = 'ไม่มีข้อมูลแบงค์/เหรียญ') => {
    const obj = parseJson(value);
    const html = denoms.map(([v, label, unit]) => {
      const qty = money(obj[v] ?? obj[String(v)]);
      if (qty <= 0) return '';
      const isCoin = v < 20;
      return `<span class="v37den-chip ${isCoin ? 'coin' : 'bill'}"><b>฿${label}</b><em>x${intFmt(qty)} ${unit}</em><small>฿${intFmt(v * qty)}</small></span>`;
    }).join('');
    return html || `<span class="v37den-empty">${esc(empty)}</span>`;
  };
  const closingSnapshotFromTx = list => {
    const tx = (list || []).find(row =>
      String(row?.type || '').includes('ปิดรอบ') &&
      (denomTotal(row?.denominations) > 0 || /ยอดปิด/i.test(String(row?.note || '')))
    );
    return tx?.denominations || {};
  };
  const cleanCashNote = note => String(note || '')
    .split('|')
    .map(s => s.trim())
    .filter(s => s && !/^รายการแบงค์\/เหรียญ/i.test(s))
    .join(' | ');
  const txDenomDetail = tx => {
    const den = tx?.denominations || {};
    const chg = tx?.change_denominations || {};
    const hasChange = denomTotal(chg) > 0 || money(tx?.change_amt) > 0;
    const rows = tx?.direction === 'in'
      ? [
          ['south_west', 'รับเข้า', den, 'ไม่มีข้อมูลแบงค์รับเข้า'],
          ...(hasChange ? [['reply', `ทอนออก${money(tx?.change_amt) ? ` ฿${fmt(tx.change_amt)}` : ''}`, chg, 'ไม่มีข้อมูลแบงค์ทอน']] : []),
        ]
      : [
          ['north_east', 'จ่ายออก', den, 'ไม่มีข้อมูลแบงค์จ่ายออก'],
          ...(denomTotal(chg) > 0 ? [['undo', 'รับกลับ', chg, 'ไม่มีข้อมูลแบงค์รับกลับ']] : []),
        ];
    return `<div class="v37den-detail">${rows.map(([icon, title, data, empty]) => `
      <div class="v37den-row">
        <div class="v37den-title"><i class="material-icons-round">${icon}</i>${esc(title)}</div>
        <div class="v37den-list">${denomChips(data, empty)}</div>
      </div>`).join('')}</div>`;
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
        .v37den-panel{grid-column:1 / -1;border:1px solid #e7d9d1;background:#fff;border-radius:13px;padding:10px 12px;margin-top:2px}
        .v37den-panel-title{font-size:11px;font-weight:950;color:#6d4c41;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
        .v37den-list{display:flex;flex-wrap:wrap;gap:6px}
        .v37den-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #eadbd2;background:#fff7ed;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900;white-space:nowrap}
        .v37den-chip.coin{background:#f8fafc}.v37den-chip b{color:#3e2723}.v37den-chip em{font-style:normal;color:#795548}.v37den-chip small{color:#64748b;font-weight:850}
        .v37den-empty{font-size:11px;font-weight:850;color:#94a3b8}
        .v37den-detail{margin-top:10px;border:1px solid #eadbd2;background:#fffaf7;border-radius:14px;padding:10px 12px;display:grid;gap:9px}
        .v37den-row{display:grid;grid-template-columns:100px minmax(0,1fr);gap:10px;align-items:start}
        .v37den-title{font-size:11px;font-weight:950;color:#6d4c41;display:flex;align-items:center;gap:5px;padding-top:5px}.v37den-title i{font-size:14px}
        .v37tx-item{padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:left}.v37tx-item:last-child{border-bottom:0}
        .v37tx-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}.v37tx-head b{font-size:15px;color:#374151}.v37tx-amt{font-size:15px;font-weight:950}
        @media(max-width:640px){.v37den-row{grid-template-columns:1fr}.v37hist-card{grid-template-columns:1fr}.v37mini{width:100%}}
      `;
      document.head.appendChild(st);
    }
  }

  async function renderCashHistory() {
    const host = document.getElementById('v37-cash-history');
    if (!host) return;
    if (!isAdminUser()) {
      host.closest('#v37-cash-history-wrap')?.remove();
      host.innerHTML = '';
      notify('ดูประวัติลิ้นชักได้เฉพาะแอดมิน', 'warning');
      return;
    }
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
        const closingSnapshot = s.closing_denominations || closingSnapshotFromTx(list);
        const closeAmt = s.status === 'closed' ? money(s.closing_amt) : money(s.opening_amt) + cashIn - cashOut;
        const status = s.status === 'open' ? 'กำลังเปิดอยู่' : 'ปิดแล้ว';
        const countedFromSnapshot = denomTotal(closingSnapshot);
        const counted = money(s.counted_closing_amt || countedFromSnapshot);
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
            ${cleanCashNote(s.note) ? `<div class="v37hist-sub">หมายเหตุ: ${esc(cleanCashNote(s.note))}</div>` : ''}
          </div>
          <button class="v37mini" onclick="window.v37ShowCashSessionTx('${esc(s.id)}')">ดูรายการ</button>
          <div class="v37den-panel">
            <div class="v37den-panel-title"><span>ยอดเปิดรอบตามจำนวนแบงค์/เหรียญ</span><b>รวม ฿${fmt(denomTotal(s.opening_denominations || s.denominations || {}))}</b></div>
            <div class="v37den-list">${denomChips(s.opening_denominations || s.denominations || {}, 'ไม่มีข้อมูลแบงค์ยอดเปิด')}</div>
          </div>
          ${(closingSnapshot && denomTotal(closingSnapshot) > 0) ? `<div class="v37den-panel">
            <div class="v37den-panel-title"><span>ยอดปิดรอบที่นับจริง</span><b>รวม ฿${fmt(denomTotal(closingSnapshot))}</b></div>
            <div class="v37den-list">${denomChips(closingSnapshot, 'ไม่มีข้อมูลแบงค์ยอดปิด')}</div>
          </div>` : ''}
        </div>`;
      }).join('');
    } catch (e) {
      host.innerHTML = `<div style="padding:18px;color:#dc2626;font-weight:800">โหลดประวัติไม่สำเร็จ: ${esc(e.message || e)}</div>`;
    }
  }

  window.v37ShowCashSessionTx = async function (sessionId) {
    if (!isAdminUser()) {
      notify('ดูประวัติลิ้นชักได้เฉพาะแอดมิน', 'warning');
      return;
    }
    const list = (window.v37CashHistoryTx?.[sessionId] || []).slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const html = list.length ? list.map(tx => {
      const isIn = tx.direction === 'in';
      return `<div class="v37tx-item">
        <div class="v37tx-head">
          <div><b>${esc(tx.type || '-')}</b><div style="font-size:12px;color:#64748b">${esc(dateTime(tx.created_at))} · ${esc(tx.staff_name || '-')}</div>${tx.note ? `<div style="font-size:12px;color:#64748b">${esc(tx.note)}</div>` : ''}</div>
          <div class="v37tx-amt" style="color:${isIn ? '#059669' : '#dc2626'}">${isIn ? '+' : '-'}฿${fmt(tx.net_amount ?? tx.amount)}</div>
        </div>
        ${txDenomDetail(tx)}
      </div>`;
    }).join('') : '<div style="color:#94a3b8;text-align:center;padding:18px">ไม่มีรายการในรอบนี้</div>';
    if (window.Swal) {
      await Swal.fire({ title: 'รายการในรอบลิ้นชัก', html: `<div style="max-height:70vh;overflow:auto">${html}</div>`, width: 820, confirmButtonText: 'ปิด' });
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
    try {
      await must(db.from('cash_transaction').insert({
        session_id: session.id,
        type: 'ปิดรอบ',
        direction: 'in',
        amount: 0,
        net_amount: 0,
        balance_after: countedTotal,
        staff_name: user(),
        note: [
          'snapshot ยอดปิด',
          `ยอดตามระบบ ฿${fmt(totals.balance)}`,
          `ยอดที่นับจริง ฿${fmt(countedTotal)}`,
          `ส่วนต่าง ฿${fmt(diff)}`,
        ].join(' | '),
        denominations: counts,
      }));
    } catch (e) {
      console.warn('[v37] closing denomination snapshot failed:', e);
    }
    notify('ปิดลิ้นชักเรียบร้อย เปิดใหม่ได้เมื่อเริ่มรอบ/วันใหม่', 'success');
    try { if (typeof renderCashDrawer === 'function') await renderCashDrawer(); } catch (_) {}
    try { if (typeof loadCashBalance === 'function') await loadCashBalance(); } catch (_) {}
    // ส่งการ์ดปิดลิ้นชัก + จำนวนแบงค์ เข้า LINE กลุ่ม
    try { fetch('https://thfswrvnyhuqmdazjfhd.supabase.co/functions/v1/line-cashdrawer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'close', total: countedTotal, expected: totals.balance, diff: diff, denominations: counts, user: user(), note: note }) }).catch(function () {}); } catch (_) {}
    // ส่งสรุปยอดวันนี้เข้า LINE กลุ่ม (ตอนกดปิดลิ้นชัก)
    try { fetch('https://thfswrvnyhuqmdazjfhd.supabase.co/functions/v1/line-daily-summary', { method: 'POST' }).catch(function () {}); } catch (_) {}
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
    const total = money(bill?.total || (rows || []).reduce((s, it) => s + money(it.total), 0));
    const pay = smartPaymentState(bill, total);
    const deliveryStatus = String(bill?.delivery_status || '');
    const deliveryMode = String(bill?.delivery_mode || '');
    const deliveredDone = /สำเร็จ|delivered/i.test(deliveryStatus);
    const hasDeliveryPlan = bill?.delivery_mode === 'deliver'
      || bill?.delivery_mode === 'partial'
      || /รอจัดส่ง|จัดส่ง|deliver|partial/i.test(deliveryStatus + ' ' + deliveryMode)
      || (rows || []).some(it => money(it.deliver_qty) > 0);
    const pendingDelivery = hasDeliveryPlan && !deliveredDone;
    const partialDeposit = pay.deposit > 0 && pay.deposit < total && !pay.paidFull;
    if (pendingDelivery && !pay.paidFull) return 'delivery_due';
    if (pendingDelivery) return 'delivery';
    if (!pay.paidFull || partialDeposit) return 'payment';
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

  const MIX_RECIPE_TABLE = '\u0e2a\u0e39\u0e15\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
  const MIX_PRODUCT_TABLE = '\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
  const MIX_BILL_ITEM_TABLE = '\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e43\u0e19\u0e1a\u0e34\u0e25';

  const itemProductId = item => item?.product_id || item?.productId || item?.id || '';
  const unitName = value => String(value || '').trim().toLowerCase();
  const mixDisplayName = value => String(value ?? '').replace(/หิน\s*1(?![0-9/])/g, 'หิน3/4');
  const isMadeToOrderMix = value => /ตามบิล|make\s*to\s*order|mto/i.test(String(value || ''));
  const unitConv = unit => {
    const raw = unit?.conv_rate ?? unit?.conversion_rate ?? unit?.rate ?? unit?.base_qty ?? 1;
    const n = money(raw);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  async function buildMixRecipePlan(items) {
    if (typeof db === 'undefined') return [];
    let saleItems = (items || [])
      .map((item, index) => ({ ...item, __mixOriginalIndex: index }))
      .filter(item => itemProductId(item));
    if (!saleItems.length) {
      const sourceBillIds = [...new Set((items || [])
        .map(item => item?.source_bill_id || item?.sourceBillId || '')
        .filter(Boolean)
        .map(String))];
      if (sourceBillIds.length) {
        try {
          const { data, error } = await db.from(MIX_BILL_ITEM_TABLE).select('*').in('bill_id', sourceBillIds);
          if (error) throw error;
          saleItems = (data || []).map((item, index) => ({ ...item, __mixOriginalIndex: index }));
        } catch (error) {
          console.warn('[v37] cannot load source bill items for mix print', error);
          saleItems = [];
        }
      }
    }
    const productIds = [...new Set(saleItems.map(item => String(itemProductId(item))).filter(Boolean))];
    if (!productIds.length) return [];

    let recipeRows = [];
    try {
      const { data, error } = await db.from(MIX_RECIPE_TABLE)
        .select('id,product_id,material_id,quantity,unit')
        .in('product_id', productIds);
      if (error) throw error;
      recipeRows = data || [];
    } catch (error) {
      console.warn('[v37] cannot load mix recipes for print', error);
      return [];
    }
    if (!recipeRows.length) return [];

    const recipeByProduct = new Map();
    const materialIds = [];
    recipeRows.forEach(row => {
      const pid = String(row.product_id || '');
      if (!pid) return;
      if (!recipeByProduct.has(pid)) recipeByProduct.set(pid, []);
      recipeByProduct.get(pid).push(row);
      if (row.material_id) materialIds.push(String(row.material_id));
    });

    const productMap = new Map();
    try {
      const lookupIds = [...new Set([...productIds, ...materialIds])];
      if (lookupIds.length) {
        const { data } = await db.from(MIX_PRODUCT_TABLE)
          .select('id,name,unit,cost,barcode,category,product_type')
          .in('id', lookupIds);
        (data || []).forEach(product => productMap.set(String(product.id), product));
      }
    } catch (error) {
      console.warn('[v37] cannot load mix materials for print', error);
    }

    let units = [];
    try {
      const { data } = await db.from('product_units').select('*').in('product_id', productIds);
      units = data || [];
    } catch (_) {
      units = [];
    }

    const unitsByProduct = new Map();
    units.forEach(unit => {
      const pid = String(unit.product_id || '');
      if (!pid) return;
      if (!unitsByProduct.has(pid)) unitsByProduct.set(pid, []);
      unitsByProduct.get(pid).push(unit);
    });

    return saleItems.map((item, index) => {
      const pid = String(itemProductId(item));
      const rows = recipeByProduct.get(pid) || [];
      if (!rows.length) return null;
      const itemUnit = item.unit || item.unit_name || 'ชิ้น';
      const matchedUnit = (unitsByProduct.get(pid) || []).find(unit => {
        const names = [unit.unit_name, unit.name, unit.unit].map(unitName).filter(Boolean);
        return names.includes(unitName(itemUnit));
      });
      const conv = money(item.conv_rate || item.conversion_rate || item.rate || unitConv(matchedUnit) || 1);
      const qty = money(item.qty || 1);
      const lines = rows
        .filter(row => money(row.quantity) > 0 && row.material_id)
        .map(row => {
          const material = productMap.get(String(row.material_id)) || {};
          const perBase = money(row.quantity);
          return {
            name: material.name || row.material_id,
            perUnit: perBase * (conv > 0 ? conv : 1),
            unit: row.unit || material.unit || '',
          };
        });
      if (!lines.length) return null;
      return {
        index: Number.isInteger(item.__mixOriginalIndex) ? item.__mixOriginalIndex + 1 : index + 1,
        name: item.name || productMap.get(pid)?.name || pid,
        isMadeToOrder: isMadeToOrderMix(item.product_type || productMap.get(pid)?.product_type) || !!(item.__v66_recipe_sale || item.recipe_sale || item.recipe_product),
        qty,
        unit: itemUnit,
        lines,
      };
    }).filter(Boolean);
  }

  function renderMixRecipePlanA4(plan, planDepartureText = '') {
    if (!plan?.length) return '';
    const totalLines = plan.reduce((sum, group) => sum + group.lines.length, 0);
    return `<section class="mix-block">
      <div class="mix-head"><div><span>Mix Design Profile</span><b>Per-unit material ratio • ${totalLines} materials</b></div></div>
      <div class="mix-grid">${plan.map(group => `
        <div class="mix-card">
          <div class="mix-title"><b>${esc(mixDisplayName(group.name))}</b><span>ต่อ 1 ${esc(group.unit)}</span></div>
          ${group.isMadeToOrder && planDepartureText ? `<div class="mix-plan-time"><span>Plant Departure</span><b>${esc(planDepartureText)}</b></div>` : ''}
          <div class="mix-materials">${group.lines.map(line => `<div class="mix-material"><span>${esc(mixDisplayName(line.name))}</span><b>${intFmt(line.perUnit)} ${esc(line.unit)}</b></div>`).join('')}</div>
        </div>`).join('')}
      </div>
    </section>`;
  }

  async function enrichItemsWithMixFor80(items) {
    const plan = await buildMixRecipePlan(items);
    if (!plan.length) return items || [];
    const byIndex = new Map(plan.map(group => [group.index - 1, group]));
    return (items || []).map((item, index) => {
      const group = byIndex.get(index);
      if (!group) return item;
      const text = group.lines.slice(0, 5)
        .map(line => `${esc(mixDisplayName(line.name))} ${intFmt(line.perUnit)} ${esc(line.unit)}`)
        .join(' / ');
      const more = group.lines.length > 5 ? ` / +${group.lines.length - 5} รายการ` : '';
      return { ...item, name: `${item.name || ''}<div class="mix80">Mix Design / 1 ${esc(group.unit)}: ${text}${more}</div>` };
    });
  }

  function billIsPaid(bill, total, deposit) {
    const status = String(bill?.status || '');
    const method = String(bill?.method || bill?.payment_method || '');
    if (/ยกเลิก|คืนสินค้า|cancel/i.test(status)) return true;
    if (/ค้าง|เครดิต|debt|credit/i.test(method)) return false;
    if (/ค้าง|บางส่วน|มัดจำ|debt|partial/i.test(status)) return false;
    if (deposit > 0 && deposit < total) return false;
    return /สำเร็จ|ชำระแล้ว|จ่ายแล้ว|เงินสด|โอน|พร้อมเพย์|success|paid/i.test(status + ' ' + method);
  }

  function parseBillInfoV37(bill) {
    const raw = bill?.return_info;
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }

  function returnItemKeyV37(row) {
    const pid = row?.product_id || row?.productId || '';
    if (pid) return `id:${pid}`;
    return `name:${String(row?.name || '').trim()}|${String(row?.unit || row?.sell_unit || '').trim()}`;
  }

  function applyLegacyReturnRowsV37(bill, rows) {
    const info = parseBillInfoV37(bill);
    const returnedItems = Array.isArray(info?.return_items) ? info.return_items : [];
    if (!returnedItems.length) return rows;

    const discount = money(bill?.discount);
    const billTotal = money(bill?.total);
    const rowSubtotal = rows.reduce((sum, row) => sum + money(row?.total), 0);
    if (billTotal > 0 && rowSubtotal <= billTotal + discount + 0.01) return rows;

    const returnedByKey = {};
    returnedItems.forEach(item => {
      const qty = money(item?.qty ?? item?.return_qty);
      if (qty <= 0) return;
      const key = returnItemKeyV37(item);
      returnedByKey[key] = (returnedByKey[key] || 0) + qty;
      if (item?.name) {
        const nameKey = `name:${String(item.name || '').trim()}|${String(item.unit || item.sell_unit || '').trim()}`;
        returnedByKey[nameKey] = Math.max(returnedByKey[nameKey] || 0, returnedByKey[key]);
      }
    });

    return rows.map(row => {
      const key = returnItemKeyV37(row);
      const nameKey = `name:${String(row?.name || '').trim()}|${String(row?.unit || row?.sell_unit || '').trim()}`;
      const returnedQty = Math.min(money(row?.qty || 0), money(returnedByKey[key] || returnedByKey[nameKey] || 0));
      if (returnedQty <= 0) return row;

      let left = returnedQty;
      const oldQty = money(row?.qty || 0);
      const oldTake = money(row?.take_qty || 0);
      const oldDeliver = money(row?.deliver_qty || 0);
      const cutDeliver = Math.min(oldDeliver, left);
      left -= cutDeliver;
      const cutTake = Math.min(oldTake, left);
      left -= cutTake;
      const nextQty = Math.max(0, oldQty - returnedQty);
      const price = money(row?.price);

      return {
        ...row,
        qty: nextQty,
        take_qty: Math.max(0, oldTake - cutTake),
        deliver_qty: Math.max(0, oldDeliver - cutDeliver),
        total: money(nextQty * price),
      };
    });
  }

  function smartPaymentState(bill, total) {
    const deposit = money(bill?.deposit_amount);
    const info = parseBillInfoV37(bill);
    const explicitPaid = Math.max(
      deposit,
      money(bill?.paid_amount),
      money(bill?.paid),
      money(bill?.paid_total),
      money(bill?.payment_amount),
      money(info.paid_amount)
    );
    const paid = billIsPaid(bill, total, deposit) ? total : explicitPaid;
    const due = Math.max(0, total - Math.min(total, paid));
    let label = 'บิลนี้ชำระครบแล้ว';
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
      return `<div class="paid-stamp">บิลนี้ชำระครบแล้ว<small>ขอบคุณที่ใช้บริการ</small></div>`;
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

  function openPrintWindowV37() {
    const win = window.open('', '_blank', 'width=960,height=1050');
    if (win) {
      win.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>Preparing document...</title><style>body{font-family:sans-serif;padding:32px;color:#334155}</style></head><body>กำลังเตรียมเอกสาร...</body></html>');
      win.document.close();
      try { win.focus(); } catch (_) {}
    }
    return win;
  }

  function closePrintWindowV37(win) {
    try { if (win && !win.closed) win.close(); } catch (_) {}
  }

  window.v37OpenA4PrintWindow = openPrintWindowV37;
  window.v37CloseA4PrintWindow = closePrintWindowV37;

  function billingDetailRows(items) {
    const rows = [];
    (items || []).forEach((billItem, billIndex) => {
      const details = Array.isArray(billItem.billing_details) ? billItem.billing_details : [];
      rows.push({ type: 'bill', billItem, billIndex });
      if (details.length) {
        details.forEach(detail => rows.push({ type: 'detail', billItem, detail, billIndex }));
      } else {
        rows.push({ type: 'detail', billItem, detail: { name: 'ไม่มีรายละเอียดสินค้าในบิลนี้', qty: 0, unit: '', price: 0, total: 0 }, billIndex, empty: true });
      }
    });
    return rows;
  }

  function billingPages(displayRows) {
    const pages = [];
    let pageRows = [];
    let used = 0;
    const pushPage = () => {
      if (!pageRows.length) return;
      pages.push(pageRows);
      pageRows = [];
      used = 0;
    };
    displayRows.forEach(row => {
      const weight = row.type === 'bill' ? 1.8 : 1;
      const limit = pages.length ? 27 : 23;
      if (used + weight > limit && pageRows.length) pushPage();
      pageRows.push(row);
      used += weight;
    });
    pushPage();
    return pages.length ? pages : [[]];
  }

  function billingQrBlock(rc, amountDue) {
    const s = localPaymentSettings(rc);
    const src = promptpaySrc(s.promptpay, amountDue);
    const bankLines = [
      s.bankName,
      s.bankAccount ? `เลขบัญชี ${s.bankAccount}` : '',
      s.bankAccountName ? `ชื่อบัญชี ${s.bankAccountName}` : '',
    ].filter(Boolean).map(line => `<div>${esc(line)}</div>`).join('');
    if (!src && !bankLines) return '';
    return `<div class="bn-qr">
      <div class="bn-qr-head">THAI QR PAYMENT</div>
      ${src ? `<img src="${src}" alt="QR Payment"><div class="bn-qr-sub">สแกนชำระยอด ฿${fmt(amountDue)}</div><div class="bn-qr-sub">PromptPay: ${esc(s.promptpay)}</div>` : '<div class="bn-qr-miss">กรุณาโอนเข้าบัญชีด้านล่าง</div>'}
      ${bankLines ? `<div class="bn-bank">${bankLines}</div>` : ''}
    </div>`;
  }

  function printBillingNoteDetailed(bill, items, rc, targetWin = null) {
    const rows = applyLegacyReturnRowsV37(bill, items || []);
    const subtotal = rows.reduce((s, it) => s + money(it.total), 0);
    const total = money(bill?.total || subtotal);
    const original = money(bill?.billing_original_total || total);
    const paid = money(bill?.billing_paid_total || 0);
    const displayRows = billingDetailRows(rows);
    const pages = billingPages(displayRows);
    const footerText = rc?.receipt_footer || 'ขอบคุณที่ใช้บริการ';
    const words = typeof v24NumberToThaiWords === 'function' ? v24NumberToThaiWords(total) : '';
    const qrHtml = billingQrBlock(rc, total);
    const win = targetWin || openPrintWindowV37();
    if (!win) { notify('กรุณาอนุญาต popup เพื่อพิมพ์เอกสาร', 'error'); return; }

    const header = (pageNo, totalPages) => `
      <div class="bn-top">
        <div>
          <h1>${esc(rc.shop_name || 'ร้านค้า')}</h1>
          <div class="muted">${esc(rc.address || '')}${rc.phone ? `<br>โทร: ${esc(rc.phone)}` : ''}</div>
        </div>
        <div class="bn-title">
          <div class="badge"><b>ใบวางบิล</b><span>BILLING NOTE</span></div>
          <div class="meta">เลขที่: <b>${esc(bill?.bill_no || '-')}</b><br>วันที่: <b>${esc(dateTime(bill?.date))}</b><br>หน้า: <b>${pageNo}/${totalPages}</b></div>
        </div>
      </div>
      <section class="cust">
        <div>
          <span>ลูกค้า / CUSTOMER</span>
          <b>${esc(bill?.customer_name || 'ลูกค้าทั่วไป')}</b>
          <p>${esc(bill?.customer_address || '-')}</p>
          ${bill?.customer_phone ? `<p><b>โทร:</b> ${esc(bill.customer_phone)}</p>` : ''}
        </div>
        <div class="cust-info">
          <span>พนักงาน</span><b>${esc(bill?.staff_name || user())}</b>
          <span>ประเภท</span><b>ค้างชำระ / วางบิล</b>
          <span>พิมพ์เมื่อ</span><b>${esc(dateTime(new Date()))}</b>
        </div>
      </section>`;

    const rowHtml = row => {
      if (row.type === 'bill') {
        const it = row.billItem;
        return `<tr class="bill-row">
          <td class="c">${row.billIndex + 1}</td>
          <td colspan="4">
            <b>บิล #${esc(it.source_bill_no || it.source_bill_id || '-')}</b>
            <span>${esc(dateTime(it.source_bill_date || ''))}</span>
          </td>
          <td class="r">ยอดบิล ฿${fmt(it.bill_total || it.total)}</td>
          <td class="r due">คงเหลือ ฿${fmt(it.bill_remaining || it.total)}</td>
        </tr>`;
      }
      const d = row.detail || {};
      return `<tr class="${row.empty ? 'empty-row' : ''}">
        <td></td>
        <td class="indent">${esc(d.name || '')}</td>
        <td class="c">${d.qty ? intFmt(d.qty) : '-'}</td>
        <td class="c">${esc(d.unit || '')}</td>
        <td class="r">${d.price ? fmt(d.price) : '-'}</td>
        <td class="r">${d.total ? fmt(d.total) : '-'}</td>
        <td></td>
      </tr>`;
    };

    const pageHtml = pages.map((pageRows, pageIndex) => {
      const isLast = pageIndex === pages.length - 1;
      return `<div class="bn-page">
        ${header(pageIndex + 1, pages.length)}
        <table>
          <thead><tr>
            <th style="width:34px">#</th><th>รายละเอียดรายการ</th><th style="width:58px">จำนวน</th><th style="width:55px">หน่วย</th><th style="width:78px">ราคา</th><th style="width:88px">จำนวนเงิน</th><th style="width:100px">ยอดคงเหลือ</th>
          </tr></thead>
          <tbody>${pageRows.map(rowHtml).join('')}</tbody>
        </table>
        ${isLast ? `<div class="bn-bottom ${qrHtml ? 'has-qr' : ''}">
          <div>
            <h3>หมายเหตุ / เงื่อนไข</h3>
            <p>ใบวางบิลฉบับนี้แสดงยอดค้างชำระตามบิลขายที่ยังเปิดอยู่ พร้อมรายละเอียดสินค้าในแต่ละบิล</p>
            ${words ? `<div class="words">จำนวนเงินคงค้าง (ตัวอักษร)<b>${esc(words)}</b></div>` : ''}
          </div>
          <div class="sum">
            <div><span>ยอดหนี้ตามบิล</span><b>฿${fmt(original)}</b></div>
            ${paid > 0 ? `<div><span>ชำระแล้ว</span><b class="paid">-฿${fmt(paid)}</b></div>` : ''}
            <div class="grand"><span>ยอดคงค้างที่ต้องชำระ</span><b>฿${fmt(total)}</b></div>
          </div>
          ${qrHtml}
        </div>
        <div class="tail">
          <div class="foot">${esc(footerText)}</div>
          <div class="sig"><div><span></span><b>ผู้วางบิล / ผู้ขาย</b></div><div><span></span><b>ผู้รับวางบิล / ลูกค้า</b></div></div>
        </div>` : `<div class="cont">มีรายละเอียดต่อหน้าถัดไป</div>`}
      </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ใบวางบิล #${esc(bill?.bill_no || '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#fff;color:#0f172a;font-family:Sarabun,sans-serif;font-size:10.5px}.bn-page{width:210mm;min-height:297mm;padding:10mm 11mm 11mm;display:flex;flex-direction:column;page-break-after:always;break-after:page}.bn-page:last-child{page-break-after:auto;break-after:auto}.bn-top{display:flex;justify-content:space-between;gap:18px;border-bottom:3px solid #dc2626;padding-bottom:9px}.bn-top h1{margin:0;color:#dc2626;font-size:23px;line-height:1.05}.muted{color:#64748b;line-height:1.45}.bn-title{text-align:right}.badge{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:190px;border-radius:8px;background:#dc2626;color:#fff;padding:11px 24px}.badge b{font-size:20px;font-weight:900;line-height:1.1}.badge span{font-size:10px;letter-spacing:1.8px;opacity:.9}.meta{margin-top:7px;color:#64748b;line-height:1.6}.meta b{color:#0f172a}.cust{display:grid;grid-template-columns:1.25fr .75fr;gap:12px;margin:10px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}.cust>div{padding:9px 11px}.cust span{display:block;color:#94a3b8;font-size:9px;font-weight:800}.cust b{display:block;font-size:14px;font-weight:900}.cust p{margin:2px 0 0;color:#475569;white-space:pre-line}.cust-info{display:grid;grid-template-columns:82px 1fr;gap:4px 8px;background:#f8fafc}.cust-info span{font-size:9px}.cust-info b{text-align:right;font-size:10.5px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#dc2626;color:#fff;padding:6px 7px;font-weight:900}td{border-bottom:1px solid #e5e7eb;padding:5px 7px;vertical-align:top;line-height:1.25}tr:nth-child(even):not(.bill-row) td{background:#fbfdff}.c{text-align:center}.r{text-align:right}.bill-row td{background:#fff1f2!important;border-top:1px solid #fecaca;border-bottom:1px solid #fecaca;font-weight:900}.bill-row span{color:#64748b;margin-left:8px;font-weight:700}.due{color:#dc2626}.indent{padding-left:24px;position:relative}.indent:before{content:'•';position:absolute;left:12px;color:#94a3b8}.empty-row td{color:#94a3b8}.bn-bottom{display:grid;grid-template-columns:1fr 250px;gap:16px;margin-top:12px}.bn-bottom.has-qr{grid-template-columns:1fr 230px 170px}.bn-bottom h3{margin:0 0 4px;font-size:12px}.bn-bottom p{margin:0;color:#64748b}.words{margin-top:8px;border:1px solid #e2e8f0;border-radius:7px;padding:8px 10px;color:#64748b}.words b{display:block;color:#dc2626;font-size:12px}.sum{border:1px solid #e2e8f0;border-radius:9px;overflow:hidden}.sum div{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid #eef2f7;font-weight:900}.sum div:last-child{border-bottom:0}.sum span{color:#64748b}.sum b{color:#0f172a}.sum .paid{color:#059669}.sum .grand{display:block;background:#fff7ed}.sum .grand span{display:block;color:#9a3412}.sum .grand b{display:block;text-align:right;color:#c2410c;font-size:24px;line-height:1.15}.bn-qr{border:2px solid #2563eb;border-radius:12px;overflow:hidden;text-align:center;background:#fff;align-self:start}.bn-qr-head{background:#17457d;color:#fff;font-size:10px;font-weight:950;padding:7px}.bn-qr img{display:block;width:118px;height:118px;margin:8px auto 5px}.bn-qr-sub{font-size:8.5px;color:#475569;line-height:1.25}.bn-bank{margin-top:6px;padding:6px 8px;border-top:1px solid #dbeafe;background:#eff6ff;color:#1e3a8a;font-size:8.5px;font-weight:850;line-height:1.35}.bn-qr-miss{padding:14px 8px;color:#dc2626;font-weight:900;font-size:10px}.tail{margin-top:auto}.foot{text-align:center;color:#94a3b8;border-top:1px solid #eef2f7;padding-top:5px;margin-bottom:10px}.sig{display:flex;justify-content:space-around;gap:36px}.sig div{text-align:center;min-width:175px}.sig span{display:block;height:28px;border-bottom:1px solid #64748b;margin-bottom:4px}.sig b{font-size:10px}.cont{margin-top:auto;text-align:center;color:#94a3b8;border-top:1px solid #eef2f7;padding-top:8px}@media print{body{margin:0}.bn-page{break-inside:avoid;page-break-inside:avoid}}
</style></head><body>${pageHtml}<script>window.onload=function(){try{window.focus()}catch(e){} setTimeout(function(){try{window.focus()}catch(e){} window.print();setTimeout(function(){window.close()},1400)},600)}<\/script></body></html>`);
    win.document.close();
    try { win.focus(); } catch (_) {}
  }

  async function printA4Detailed(bill, items, docType = 'receipt', targetWin = null) {
    const rc = await loadShopConfig();
    const ds = await loadDocSettings(docType);
    const rows = applyLegacyReturnRowsV37(bill, items || []);
    if (docType === 'billing') {
      return printBillingNoteDetailed(bill, rows, rc, targetWin);
    }
    const mixPlan = await buildMixRecipePlan(rows);
    const planDepartureText = bill?.date ? addMinutesDateTime(bill.date, 30) : '';
    const mixRecipeHtml = renderMixRecipePlanA4(mixPlan, planDepartureText);
    const mixLineCount = mixPlan.reduce((sum, group) => sum + group.lines.length, 0);
    const subtotal = rows.reduce((s, it) => s + money(it.total), 0);
    const discount = money(bill?.discount);
    const total = money(bill?.total || Math.max(0, subtotal - discount));
    const billInfo = (() => {
      try { return typeof bill?.return_info === 'string' ? JSON.parse(bill.return_info) : (bill?.return_info || {}); } catch (_) { return {}; }
    })();
    const quoteVat = (() => {
      if (bill?.quote_vat?.mode && bill.quote_vat.mode !== 'none') return bill.quote_vat;
      if (billInfo?.quote_vat?.mode && billInfo.quote_vat.mode !== 'none') return billInfo.quote_vat;
      const m = String(bill?.note || '').match(/\[quote_vat=([^;\]]+);rate=([0-9.]+);base=([0-9.]+);vat=([0-9.]+);total=([0-9.]+)\]/i);
      if (!m) {
        const net = Math.max(0, subtotal - discount);
        const diff = money(total - net);
        const expectedVat = money(net * 0.07);
        if (diff > 0 && Math.abs(diff - expectedVat) <= 0.02) {
          return { mode: 'exclusive', rate: 0.07, base: net, vat: diff, total };
        }
        return { mode: 'none', vat: 0, base: 0 };
      }
      return { mode: m[1], rate: money(m[2]), base: money(m[3]), vat: money(m[4]), total: money(m[5]) };
    })();
    const cleanQuoteNote = String(bill?.note || '')
      .replace(/\[quote_vat=[^\]]*\]/ig, '')
      .replace(/\[quote_customer=[^\]]*\]/ig, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const payState = smartPaymentState(bill, total);
    const delivery = deliveryState(bill, rows);
    const deposit = payState.deposit;
    const remaining = payState.due;
    const isBilling = docType === 'billing';
    const isQuotation = docType === 'quotation';
    const isPaymentDoc = docType === 'payment';
    const isDebtNotice = docType === 'debt_notice';
    const isDeliveryDueDoc = docType === 'delivery_due';
    const isInvoiceDoc = !isDebtNotice && (isDeliveryDueDoc || (isPaymentDoc && remaining > 0 && deposit <= 0));
    const billingOriginal = money(bill?.billing_original_total || total);
    const billingPaid = money(bill?.billing_paid_total || 0);
    const paidRow = payState.paid > 0 && remaining > 0
      ? `<div class="amount-row"><span>ชำระแล้ว</span><b style="color:#059669">-฿${fmt(payState.paid)}</b></div>`
      : '';
    const discountRows = discount > 0
      ? `<div class="amount-row"><span>รวมก่อนส่วนลด</span><b>฿${fmt(subtotal)}</b></div><div class="amount-row"><span>ส่วนลด</span><b style="color:#dc2626">-฿${fmt(discount)}</b></div>`
      : '';
    const quoteVatRows = quoteVat.mode !== 'none'
      ? `<div class="amount-row"><span>ยอดก่อน VAT</span><b>฿${fmt(quoteVat.base)}</b></div><div class="amount-row"><span>${quoteVat.mode === 'inclusive' ? 'VAT 7% (รวมในราคา)' : 'VAT 7%'}</span><b style="color:#0f766e">฿${fmt(quoteVat.vat)}</b></div>`
      : '';
    const billingRows = isBilling
      ? `<div class="amount-row"><span>ยอดหนี้เดิม</span><b>฿${fmt(billingOriginal)}</b></div>${billingPaid > 0 ? `<div class="amount-row"><span>ชำระแล้ว</span><b style="color:#059669">-฿${fmt(billingPaid)}</b></div>` : ''}`
      : '';
    const amountRowsHtml = isQuotation
      ? `${discountRows}${quoteVatRows}<div class="amount-row"><span>ยอดเสนอราคา</span><b>฿${fmt(total)}</b></div>`
      : isBilling
      ? billingRows
      : `${discountRows}${quoteVatRows}<div class="amount-row"><span>ยอดสุทธิ</span><b>฿${fmt(total)}</b></div>${paidRow}`;
    const dueAmount = isQuotation || isBilling ? total : (remaining > 0 ? remaining : total);
    const payLabel = isQuotation ? 'ยอดเสนอราคา / QUOTED TOTAL' : (isBilling ? 'ยอดคงค้างที่ต้องชำระ' : (remaining > 0 ? 'ยอดที่ต้องชำระ' : 'ยอดชำระแล้ว'));
    const noteText = isQuotation
      ? (cleanQuoteNote || 'ใบเสนอราคานี้ยังไม่ใช่ใบเสร็จรับเงิน และยังไม่มีการรับชำระเงิน')
      : (ds?.note_text || 'สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน');
    const footerText = ds?.footer_text || rc?.receipt_footer || 'ขอบคุณที่ใช้บริการ';
    const words = typeof v24NumberToThaiWords === 'function'
      ? v24NumberToThaiWords(total)
      : '';
    const dueWords = !isQuotation && typeof v24NumberToThaiWords === 'function' && remaining > 0
      ? v24NumberToThaiWords(remaining)
      : '';
    const title = isQuotation ? 'ใบเสนอราคา'
      : isBilling ? 'ใบวางบิล'
      : isDebtNotice ? 'ใบแจ้งยอดค้างชำระ'
      : docType === 'delivery' ? 'ใบส่งของ'
      : isDeliveryDueDoc ? 'ใบส่งของ/ใบแจ้งยอดชำระ'
      : isInvoiceDoc ? 'ใบแจ้งยอดชำระ'
      : docType === 'payment' ? 'ใบรับเงินมัดจำ'
      : 'ใบเสร็จรับเงิน';
    const titleEn = isQuotation ? 'QUOTATION'
      : isBilling ? 'BILLING NOTE'
      : isDebtNotice ? 'BALANCE DUE NOTICE'
      : docType === 'delivery' ? 'DELIVERY NOTE'
      : isDeliveryDueDoc ? 'DELIVERY/BALANCE DUE'
      : isInvoiceDoc ? 'BALANCE DUE'
      : docType === 'payment' ? 'PAYMENT RECEIPT'
      : 'RECEIPT';
    const showDeliveryCols = !isQuotation && (docType === 'delivery' || isDeliveryDueDoc)
      && (rows.some(it => money(it.deliver_qty) > 0) || /deliver|partial|จัดส่ง|ส่ง|รับบางส่วน/i.test(String(bill?.delivery_mode || '')));
    const itemCount = rows.length + Math.ceil(mixLineCount * 0.55) + (mixPlan.length ? 2 : 0);
    const hasMixBlock = mixPlan.length > 0;
    const hasPaymentQr = !isQuotation && dueAmount > 0 && itemCount <= 18;
    const fitOnePage = hasMixBlock || (hasPaymentQr && itemCount > 4);
    const tightLayout = fitOnePage || itemCount > 14;
    const compact = itemCount > 10 || fitOnePage;
    const dense = itemCount > 18 || (hasMixBlock && hasPaymentQr);
    const tiny = itemCount > 30;
    const ultra = itemCount > 45;
    const bodyFs = ultra ? 7.8 : tiny ? 9 : dense ? 10.2 : compact ? 10.8 : 12;
    const tableFs = ultra ? 7 : tiny ? 8.4 : dense ? 9.6 : compact ? 10.2 : 11;
    const cellPad = ultra ? '1px 3px' : tiny ? '2px 4px' : dense ? '2px 5px' : compact ? '4px 6px' : '6px 7px';
    const pagePad = ultra ? '4mm 5mm 3mm' : tiny ? '5mm 6mm 4mm' : dense ? '6mm 7mm 4mm' : compact ? '7mm 8mm 5mm' : '10mm';
    const pageXPad = ultra ? '5mm' : tiny ? '6mm' : dense ? '7mm' : compact ? '8mm' : '10mm';
    const tailBottom = ultra ? '14mm' : tiny ? '16mm' : dense ? '16mm' : compact ? '18mm' : '20mm';
    const tailReserve = ultra ? '18mm' : tiny ? '21mm' : tightLayout ? '23mm' : '30mm';
    const qrScale = ultra ? 86 : tiny ? 96 : 118;
    const pageZoom = itemCount > 70 ? 0.68 : ultra ? 0.8 : tiny ? 0.9 : dense ? 0.96 : 1;
    const deliveryAddressHtml = bill?.delivery_address
      ? `<span class="muted">สถานที่จัดส่ง:</span><b class="addr">${esc(bill.delivery_address)}</b>`
      : '';
    const rightStatusLabel = isQuotation || isBilling ? 'ประเภทเอกสาร' : 'สถานะจัดส่ง';
    const rightStatusText = isQuotation ? 'ใบเสนอราคา / ยังไม่สร้างบิล' : (isBilling ? 'ใบวางบิล' : delivery.label);
    const rightStatusTone = isQuotation || isBilling ? '#dc2626' : delivery.tone;
    const payStatusLabel = isQuotation ? 'ยังไม่รับชำระเงิน' : payState.label;
    const payStatusTone = isQuotation ? '#d97706' : payState.tone;
    const customerBoxTitle = isQuotation ? 'ข้อมูลลูกค้า / ใบเสนอราคา' : (isBilling ? 'ข้อมูลลูกค้า / ลูกหนี้' : 'ข้อมูลลูกค้า / การจัดส่ง');
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
    const win = targetWin || openPrintWindowV37();
    if (!win) { notify('กรุณาอนุญาต popup เพื่อพิมพ์เอกสาร', 'error'); return; }
    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${esc(title)} #${esc(bill?.bill_no || '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Sarabun,sans-serif;color:#0f172a;margin:0;font-size:${bodyFs}px}.page{width:calc(210mm / ${pageZoom});height:calc(297mm / ${pageZoom});overflow:hidden;padding:${pagePad};display:flex;flex-direction:column;transform:scale(${pageZoom});transform-origin:top left}.top{display:flex;justify-content:space-between;gap:18px;border-bottom:3px solid #dc2626;padding-bottom:${tiny ? 5 : 9}px}.shop h1{margin:0;color:#dc2626;font-size:${tiny ? 17 : dense ? 19 : 23}px;line-height:1.05}.muted{color:#64748b}.badge{background:#dc2626;color:#fff;border-radius:8px;padding:${tiny ? '8px 18px' : '12px 26px'};text-align:center;min-width:${tiny ? 160 : 210}px;display:flex;flex-direction:column;align-items:center;justify-content:center;letter-spacing:.5px}.badge b{font-size:${tiny ? 14 : 20}px;line-height:1.1;font-weight:900}.badge span{display:block;font-size:${tiny ? 8 : 10}px;opacity:.85;margin-top:3px;letter-spacing:1.5px}.status-strip{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:${tiny ? 5 : 8}px}.status-card{border:1px solid #e2e8f0;border-radius:7px;padding:${tiny ? '4px 7px' : '7px 9px'};background:#f8fafc}.status-card span{display:block;color:#64748b;font-size:${tiny ? 7 : 9}px}.status-card b{font-size:${tiny ? 9 : 12}px}.box{border:1px solid #e2e8f0;border-radius:7px;margin-top:${tiny ? 5 : 9}px;overflow:hidden}.box-h{background:#fff1f2;color:#dc2626;font-weight:900;padding:${tiny ? '4px 8px' : '6px 10px'}}.box-b{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:${tiny ? '6px 9px' : '9px 11px'}}.addr{white-space:pre-line;text-align:right}.info{display:grid;grid-template-columns:105px 1fr;gap:6px;line-height:1.55}.info b{text-align:right}table{width:100%;border-collapse:collapse;margin-top:${tiny ? 5 : 9}px;font-size:${tableFs}px}th{background:#dc2626;color:#fff;padding:${cellPad};font-weight:900}td{padding:${cellPad};border-bottom:1px solid #e5e7eb;vertical-align:top;line-height:1.22}tr:nth-child(even) td{background:#f8fafc}.c{text-align:center}.r{text-align:right}.strong{font-weight:900}.small{font-size:${Math.max(6.5, tableFs - 1)}px;color:#64748b;margin-top:1px}.ok{color:#059669;font-weight:900}.warn{color:#d97706;font-weight:900}.bottom{display:grid;grid-template-columns:1fr ${tiny ? 205 : dense ? 225 : 255}px;gap:${tiny ? 10 : 18}px;margin-top:${tiny ? 6 : 11}px}.amount-panel{border:1px solid #e2e8f0;border-radius:9px;overflow:hidden;background:#fff}.amount-row{display:flex;justify-content:space-between;gap:12px;padding:${tiny ? '6px 8px' : '9px 12px'};border-bottom:1px solid #eef2f7;color:#64748b;font-weight:900}.amount-row b{color:#0f172a}.amount-row.pay{border-bottom:none;background:${remaining > 0 ? '#fff7ed' : '#ecfdf5'};color:${remaining > 0 ? '#9a3412' : '#047857'}}.amount-row.pay b{font-size:${tiny ? 16 : 24}px;color:${remaining > 0 ? '#c2410c' : '#059669'}}.words{border:1px solid #e2e8f0;border-radius:7px;padding:${tiny ? '5px 7px' : '8px 10px'};margin-top:7px}.words b{display:block;color:#dc2626}.qrbox{text-align:center;border:3px solid #16b8d4;border-radius:18px;padding:0 0 ${tiny ? 5 : 8}px;margin-top:7px;background:#fff;overflow:hidden}.thaiqr-head{background:#183d73;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;height:${tiny ? 26 : 38}px;font-size:${tiny ? 8 : 12}px;font-weight:900;line-height:1.05}.thaiqr-mark{width:${tiny ? 22 : 30}px;height:${tiny ? 18 : 24}px;border:3px solid #fff;border-radius:5px;display:flex;align-items:center;justify-content:center}.pp-badge{display:inline-block;border:2px solid #183d73;color:#183d73;margin:${tiny ? '5px 0 3px' : '8px 0 5px'};padding:1px 8px;line-height:.95;font-size:${tiny ? 7 : 10}px;font-weight:900}.pp-badge b{font-size:${tiny ? 11 : 17}px}.qrbox img{width:${qrScale}px;height:${qrScale}px;display:block;margin:2px auto}.qr-sub,.bank-lines{font-size:${tiny ? 6.5 : 9}px;color:#334155;line-height:1.25}.paid-stamp,.qr-missing{text-align:center;border:1px solid #e2e8f0;border-radius:8px;padding:${tiny ? '8px 6px' : '14px 8px'};margin-top:7px;font-size:${tiny ? 12 : 16}px;font-weight:900;color:#059669;background:#f8fafc}.paid-stamp small,.qr-missing small{display:block;font-size:${tiny ? 7 : 9}px;color:#94a3b8;margin-top:2px}.qr-missing{color:#dc2626}.sig{margin-top:auto;border-top:1px solid #cbd5e1;padding-top:${tiny ? 8 : 16}px;display:flex;justify-content:space-around}.sig div{text-align:center;min-width:150px}.line{height:${tiny ? 18 : 28}px;border-bottom:1px solid #64748b;margin-bottom:4px}.foot{text-align:center;color:#94a3b8;font-size:${tiny ? 7 : 9}px;border-top:1px solid #eef2f7;margin-top:8px;padding-top:5px}.mix-block{margin-top:${tiny ? 5 : 8}px;border:1px solid #fecaca;border-radius:9px;overflow:hidden;background:#fff}.mix-head{display:flex;justify-content:space-between;gap:10px;align-items:center;background:linear-gradient(135deg,#fff1f2,#fff);border-bottom:1px solid #fee2e2;padding:${tiny ? '5px 8px' : '8px 10px'}}.mix-head span{display:block;color:#dc2626;font-weight:900}.mix-head b{display:block;color:#64748b;font-size:${tiny ? 7 : 9}px;margin-top:1px}.mix-head em{font-style:normal;color:#991b1b;background:#fff;border:1px solid #fecaca;border-radius:999px;padding:3px 8px;font-weight:900;white-space:nowrap}.mix-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${tiny ? 4 : 7}px;padding:${tiny ? 5 : 8}px}.mix-card{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff}.mix-title{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:${tiny ? '4px 6px' : '6px 8px'};background:#f8fafc}.mix-title b{font-weight:900;color:#0f172a}.mix-title span{color:#dc2626;font-weight:900;white-space:nowrap}.mix-table{margin-top:0!important;font-size:${Math.max(6.2, tableFs - 1)}px}.mix-table th{background:#1f2937;padding:${tiny ? '2px 4px' : '3px 5px'}}.mix-table td{padding:${tiny ? '2px 4px' : '3px 5px'}}.mix80{font-size:9px;color:#555;line-height:1.35;margin-top:2px;font-weight:400}@media print{body{margin:0}.page{page-break-after:avoid;break-after:avoid}}
.mix-block{border-color:#e2e8f0;border-radius:7px;background:#fff}.mix-head{display:block;background:#fff;border-bottom:1px solid #e2e8f0}.mix-head span{color:#0f172a}.mix-head b{color:#64748b}.mix-head em{display:none}.mix-grid{grid-template-columns:1fr;gap:${tiny ? 3 : 6}px}.mix-card{border-color:#e5e7eb;border-radius:6px}.mix-title{background:#fff;border-bottom:1px solid #eef2f7}.mix-title span{color:#64748b}.mix-plan-time{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:${tiny ? '4px 6px' : '6px 8px'};border-bottom:1px solid #eef2f7;background:#f8fafc;color:#64748b;font-weight:900}.mix-plan-time span{font-size:${tiny ? 7 : 9}px;text-transform:uppercase;letter-spacing:.4px}.mix-plan-time b{color:#0f172a}.mix-table{table-layout:fixed}.mix-table th{background:#f8fafc!important;color:#475569;border-bottom:1px solid #e2e8f0}.mix-table th:first-child,.mix-table td:first-child{width:50%;text-align:left}.mix-table th:last-child,.mix-table td:last-child{width:50%;text-align:right}.mix-table td{background:#fff!important}.mix-table tr:nth-child(even) td{background:#fbfdff!important}
.top{gap:${tightLayout ? 12 : 18}px;padding-bottom:${tightLayout ? 5 : tiny ? 5 : 9}px}.badge{border-radius:7px;min-width:${tightLayout ? 188 : tiny ? 160 : 210}px;padding:${tightLayout ? '8px 18px' : tiny ? '8px 18px' : '12px 26px'}}.status-strip{gap:${tightLayout ? 6 : 8}px;margin-top:${tightLayout ? 5 : tiny ? 5 : 8}px}.status-card{padding:${tightLayout ? '4px 7px' : tiny ? '4px 7px' : '7px 9px'}}.box{margin-top:${tightLayout ? 6 : tiny ? 5 : 9}px}.box-b{grid-template-columns:1.18fr .82fr;gap:${tightLayout ? 9 : 12}px;padding:${tightLayout ? '7px 10px' : tiny ? '6px 9px' : '9px 11px'}}.box-b>div:first-child b{font-size:${tiny ? 12 : compact ? 14 : 15}px!important}.info{grid-template-columns:${tightLayout ? 88 : 105}px 1fr;gap:${tightLayout ? 3 : 6}px;line-height:${tightLayout ? 1.35 : 1.55}}table td:nth-child(2) b{font-size:${ultra ? 7.2 : tiny ? 8.8 : dense ? 10 : compact ? 10.8 : 11.5}px;line-height:1.2}.bottom{grid-template-columns:1fr ${tightLayout ? 190 : tiny ? 205 : dense ? 225 : 255}px;gap:${tightLayout ? 8 : tiny ? 10 : 18}px;margin-top:${tightLayout ? 6 : tiny ? 6 : 11}px}.amount-row{padding:${tightLayout ? '5px 8px' : tiny ? '6px 8px' : '9px 12px'}}.amount-row.pay b{font-size:${tightLayout ? 20 : tiny ? 16 : 24}px}.words{padding:${tightLayout ? '6px 8px' : tiny ? '5px 7px' : '8px 10px'};margin-top:${tightLayout ? 5 : 7}px}.qrbox{border-width:2px;border-radius:13px;margin-top:${tightLayout ? 5 : 7}px;padding-bottom:${tightLayout ? 4 : tiny ? 5 : 8}px}.thaiqr-head{height:${tightLayout ? 24 : tiny ? 26 : 38}px;font-size:${tightLayout ? 8 : tiny ? 8 : 12}px}.pp-badge{margin:${tightLayout ? '4px 0 2px' : tiny ? '5px 0 3px' : '8px 0 5px'}}.page{position:relative!important;padding-bottom:${tailReserve}!important}.print-tail{position:absolute!important;left:${pageXPad};right:${pageXPad};bottom:${tailBottom};margin:0!important;break-inside:avoid;page-break-inside:avoid;flex-shrink:0}.sig{margin-top:0!important;padding-top:${tightLayout ? 8 : tiny ? 9 : 16}px;break-inside:avoid;page-break-inside:avoid}.sig div{min-width:${tightLayout ? 132 : 150}px}.sig b{display:block;margin-bottom:${tightLayout ? 3 : 4}px;font-size:${ultra ? 7 : tiny ? 8 : 9}px;line-height:1.1}.line{height:${tightLayout ? 16 : tiny ? 18 : 24}px}.foot{margin-top:0;padding-top:${tightLayout ? 2 : 4}px;break-inside:avoid;page-break-inside:avoid}.mix-block{margin-top:${tightLayout ? 6 : tiny ? 5 : 8}px}.mix-head{padding:${tightLayout ? '5px 8px' : tiny ? '5px 8px' : '8px 10px'}}.mix-grid{padding:${tightLayout ? 5 : tiny ? 5 : 8}px}.mix-title{padding:${tightLayout ? '4px 7px' : tiny ? '4px 6px' : '6px 8px'}}.mix-plan-time{padding:${tightLayout ? '4px 7px' : tiny ? '4px 6px' : '6px 8px'}}.mix-table th,.mix-table td{padding:${tightLayout ? '2px 5px' : tiny ? '2px 4px' : '3px 5px'}}
.mix-block{border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}.mix-head{padding:${tightLayout ? '7px 10px' : '9px 12px'};background:#fff}.mix-head span{font-size:${ultra ? 8 : tiny ? 10 : dense ? 11 : 12}px}.mix-head b{font-size:${ultra ? 6.8 : tiny ? 8 : 9}px}.mix-grid{padding:0!important;display:block}.mix-card{border:0!important;border-radius:0!important}.mix-card+.mix-card{border-top:1px solid #cbd5e1!important}.mix-title{padding:${tightLayout ? '7px 10px' : '8px 12px'};background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.mix-title b{font-size:${ultra ? 8 : tiny ? 10 : dense ? 11 : 12}px}.mix-title span{font-size:${ultra ? 7 : tiny ? 8.5 : 9.5}px}.mix-materials{display:grid;grid-template-columns:repeat(auto-fit,minmax(${tiny ? 78 : 92}px,1fr));background:#fff}.mix-material{padding:${tightLayout ? '7px 8px' : '9px 10px'};min-height:${tightLayout ? 42 : 48}px;border-right:1px solid #eef2f7;border-bottom:1px solid #eef2f7}.mix-material span{display:block;color:#334155;font-size:${ultra ? 7.2 : tiny ? 8.8 : dense ? 10 : 10.8}px;font-weight:900;line-height:1.15;white-space:normal}.mix-material b{display:block;margin-top:4px;color:#0f172a;font-size:${ultra ? 7.6 : tiny ? 9.3 : dense ? 10.8 : 11.4}px;font-weight:950;line-height:1.15}
</style></head><body><div class="page">
  <div class="top"><div class="shop"><h1>${esc(rc.shop_name || 'ร้านค้า')}</h1><div class="muted">${esc(rc.address || '')}<br>${rc.phone ? `โทร: ${esc(rc.phone)}` : ''}</div></div><div><div class="badge"><b>${esc(title)}</b><span>${esc(titleEn)}</span></div><div class="muted" style="text-align:right;margin-top:8px;line-height:1.6">เลขที่: <b>${esc(bill?.bill_no || '-')}</b><br>วันที่: <b>${esc(dateTime(bill?.date))}</b><br>พิมพ์เมื่อ: ${esc(dateTime(new Date()))}</div></div></div>
  <div class="status-strip"><div class="status-card"><span>สถานะชำระเงิน</span><b style="color:${payStatusTone}">${esc(payStatusLabel)}</b></div><div class="status-card"><span>${esc(rightStatusLabel)}</span><b style="color:${rightStatusTone}">${esc(rightStatusText)}</b></div></div>
  <section class="box"><div class="box-h">${esc(customerBoxTitle)}</div><div class="box-b"><div><b style="font-size:${tiny ? 12 : 15}px">${esc(bill?.customer_name || 'ลูกค้าทั่วไป')}</b><div class="muted" style="white-space:pre-line">${esc(bill?.customer_address || '-')}</div>${bill?.customer_phone || bill?.delivery_phone ? `<div><b>โทร:</b> ${esc(bill.customer_phone || bill.delivery_phone)}</div>` : ''}</div><div><div class="info"><span class="muted">พนักงาน:</span><b>${esc(bill?.staff_name || user())}</b><span class="muted">ชำระ:</span><b>${esc(bill?.method || '-')}</b><span class="muted">รูปแบบส่ง:</span><b>${esc(deliveryModeText(bill))}</b>${bill?.delivery_date ? `<span class="muted">วันที่นัดส่ง:</span><b>${esc(bill.delivery_date)}</b>` : ''}${deliveryAddressHtml}</div></div></div></section>
  <table><thead><tr><th style="width:34px">#</th><th>รายการสินค้า</th><th style="width:60px">รวม</th>${showDeliveryCols ? '<th style="width:72px">รับกลับแล้ว</th><th style="width:72px">ต้องไปส่ง</th>' : ''}<th style="width:58px">หน่วย</th><th style="width:82px">ราคา</th><th style="width:92px">จำนวนเงิน</th></tr></thead><tbody>${tr}</tbody></table>
  ${mixRecipeHtml}
  <div class="bottom"><div><b>หมายเหตุ / เงื่อนไข</b><div class="muted">${esc(noteText)}</div>${words ? `<div class="words">จำนวนเงินรวมทั้งสิ้น (ตัวอักษร)<b>${esc(words)}</b>${dueWords ? `<span class="muted">ยอดคงเหลือที่ต้องชำระ (ตัวอักษร)</span><b>${esc(dueWords)}</b>` : ''}</div>` : ''}</div><div>
    <div class="amount-panel">
      ${amountRowsHtml}
      <div class="amount-row pay"><span>${payLabel}</span><b>฿${fmt(dueAmount)}</b></div>
    </div>
    ${!isQuotation && dueAmount > 0 && itemCount <= 18 ? qrPaymentBlock(rc, dueAmount, payState) : ''}
  </div></div>
  <div class="print-tail"><div class="foot">${esc(footerText)}</div><div class="sig"><div><b>ผู้รับสินค้า / ลูกค้า</b><div class="line"></div></div><div><b>ผู้ส่งสินค้า / ผู้ขาย</b><div class="line"></div></div></div></div>
</div><script>window.onload=function(){try{window.focus()}catch(e){} setTimeout(function(){try{window.focus()}catch(e){} window.print();setTimeout(function(){window.close()},1400)},600)}<\/script></body></html>`);
    win.document.close();
    try { win.focus(); } catch (_) {}
  }

  window.v37PrintA4Detailed = function (bill, items, docType = 'receipt', targetWin = null) {
    return printA4Detailed(bill, items || [], docType, targetWin || openPrintWindowV37());
  };

  window.v37PrintReceiptA4Now = function (bill, items) {
    return printA4Detailed(bill, items || [], autoDocTypeForBill(bill, items || []), openPrintWindowV37());
  };

  window.v37ChoosePrintAfterSale = async function (bill, items) {
    if (!window.Swal) return;
    let choice = null;
    let a4Win = null;
    await Swal.fire({
      icon: 'success',
      title: `บิล #${bill?.bill_no || ''} สำเร็จ`,
      html: `
        <div style="font-size:15px;margin-bottom:14px">ยอดขาย <b>฿${fmt(bill?.total || 0)}</b></div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
          <button type="button" id="v37-sale-print-80" style="padding:14px 10px;border-radius:12px;border:2px solid #dc2626;background:#fff5f5;color:#dc2626;font-weight:900;cursor:pointer">80mm<br><span style="font-size:11px;color:#64748b;font-weight:600">ใบเสร็จเล็ก</span></button>
          <button type="button" id="v37-sale-print-a4" style="padding:14px 10px;border-radius:12px;border:2px solid #2563eb;background:#eff6ff;color:#2563eb;font-weight:900;cursor:pointer">A4<br><span style="font-size:11px;color:#64748b;font-weight:600">เอกสารเต็ม</span></button>
          <button type="button" id="v37-sale-print-skip" style="padding:14px 10px;border-radius:12px;border:2px solid #d1d5db;background:#f8fafc;color:#64748b;font-weight:900;cursor:pointer">ไม่พิมพ์<br><span style="font-size:11px;color:#94a3b8;font-weight:600">ข้าม</span></button>
        </div>`,
      showConfirmButton: false,
      allowOutsideClick: true,
      didOpen: () => {
        document.getElementById('v37-sale-print-80')?.addEventListener('click', () => {
          choice = '80mm';
          Swal.close();
        });
        document.getElementById('v37-sale-print-a4')?.addEventListener('click', () => {
          choice = 'A4';
          a4Win = openPrintWindowV37();
          Swal.close();
        });
        document.getElementById('v37-sale-print-skip')?.addEventListener('click', () => {
          choice = null;
          Swal.close();
        });
      },
    });
    if (choice === '80mm') {
      const rc = await loadShopConfig();
      if (typeof window.print80mmv2 === 'function') return window.print80mmv2(bill, items || [], rc);
    }
    if (choice === 'A4') {
      const mode = String(bill?.delivery_mode || '').toLowerCase();
      const hasDeliveryQty = (items || []).some(it => money(it.deliver_qty) > 0);
      const saleDocType = (mode === 'deliver' || mode === 'partial' || hasDeliveryQty) ? 'delivery' : 'receipt';
      return printA4Detailed(bill, items || [], saleDocType, a4Win);
    }
  };

  async function loadBillForPrintV37(billId) {
    let { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
    if (bill?.customer_id && typeof window.v24ApplyDebtPaymentsFIFO === 'function') {
      await window.v24ApplyDebtPaymentsFIFO(bill.customer_id);
      const refreshed = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
      bill = refreshed.data || bill;
    }
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
    return { bill, items: items || [] };
  }

  window.v37PrintBillA4Smart = async function (billId) {
    const printWin = openPrintWindowV37();
    const { bill, items } = await loadBillForPrintV37(billId);
    if (!bill) {
      closePrintWindowV37(printWin);
      return notify('ไม่พบบิล', 'error');
    }
    return printA4Detailed(bill, items, autoDocTypeForBill(bill, items), printWin);
  };

  function installPrintOverrides() {
    const firstInstall = !window.__v37PrintInstalled;
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
    if (typeof original80 === 'function' && !original80.__v37Enriched) {
      window.print80mmv2 = async function (bill, items, rc) {
        const enriched = enrichItemsForPrint(items, 'receipt');
        const withMix = await enrichItemsWithMixFor80(enriched);
        return original80.call(this, bill, withMix, rc);
      };
      window.print80mmv2.__v37Enriched = true;
      try { print80mmv2 = window.print80mmv2; } catch (_) {}
    }
    window.v24PrintDocument = function (bill, items, docType = 'receipt', targetWin = null) {
      return printA4Detailed(bill, items || [], docType, targetWin || openPrintWindowV37());
    };
    window.printA4 = (bill, items) => printA4Detailed(bill, items || [], 'receipt', openPrintWindowV37());
    window.printReceiptA4v2 = (bill, items) => printA4Detailed(bill, items || [], 'receipt', openPrintWindowV37());
    window.printReceipt = async function (bill, items, format) {
      if (format === '80mm' || format === '80') {
        if (typeof window.print80mmv2 === 'function') {
          const rc = await loadShopConfig();
          return window.print80mmv2(bill, items || [], rc);
        }
        return;
      }
      if (format === 'A4' || format === 'a4') {
        return window.v37PrintReceiptA4Now(bill, items || []);
      }
      return printA4Detailed(bill, items || [], 'receipt', openPrintWindowV37());
    };
    window.v24ShowDocSelector = billId => window.v37PrintBillA4Smart(billId);
    window.v5PrintFromHistory = billId => window.v24ShowDocSelector(billId);
    window.v12PrintReceiptA4 = billId => window.v24ShowDocSelector(billId);
    window.v12PrintDeposit = async billId => {
      const printWin = openPrintWindowV37();
      const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
      const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
      if (bill) return printA4Detailed(bill, items || [], 'payment', printWin);
      closePrintWindowV37(printWin);
    };
    window.v12PrintDeliveryNote = async billId => {
      const printWin = openPrintWindowV37();
      const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).maybeSingle();
      const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
      if (bill) return printA4Detailed(bill, items || [], 'delivery', printWin);
      closePrintWindowV37(printWin);
    };
    window.v24ShowDocSelector = billId => window.v37PrintBillA4Smart(billId);
    window.v5PrintFromHistory = billId => window.v24ShowDocSelector(billId);
    window.v12PrintReceiptA4 = billId => window.v24ShowDocSelector(billId);
    window.v12PrintDeposit = async billId => {
      const printWin = openPrintWindowV37();
      const { bill, items } = await loadBillForPrintV37(billId);
      if (bill) return printA4Detailed(bill, items, 'payment', printWin);
      closePrintWindowV37(printWin);
    };
    window.v12PrintDeliveryNote = async billId => {
      const printWin = openPrintWindowV37();
      const { bill, items } = await loadBillForPrintV37(billId);
      if (bill) return printA4Detailed(bill, items, 'delivery', printWin);
      closePrintWindowV37(printWin);
    };
    try { v24PrintDocument = window.v24PrintDocument; } catch (_) {}
    try { printReceipt = window.printReceipt; } catch (_) {}
    try { v24ShowDocSelector = window.v24ShowDocSelector; } catch (_) {}
    try { v5PrintFromHistory = window.v5PrintFromHistory; } catch (_) {}
    try { v12PrintReceiptA4 = window.v12PrintReceiptA4; } catch (_) {}

    if (!document.__v37A4PrintClickGuard) {
      document.__v37A4PrintClickGuard = true;
      document.addEventListener('click', ev => {
        const btn = ev.target?.closest?.('[onclick*="v12PrintReceiptA4"], [onclick*="v24ShowDocSelector"]');
        if (!btn) return;
        const raw = btn.getAttribute('onclick') || '';
        const match = raw.match(/(?:v12PrintReceiptA4|v24ShowDocSelector)\(['"]([^'"]+)['"]\)/);
        if (!match || !match[1]) return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
        window.v37PrintBillA4Smart(match[1]);
      }, true);
    }

    installCheckoutA4ButtonFixV37();
    if (!firstInstall) replaceCheckoutA4ButtonsV37(document, true);
  }

  function currentCheckoutBillIdV37() {
    try {
      return v12State?.savedBill?.id || v12State?.savedBill?.bill_id || '';
    } catch (_) {
      return '';
    }
  }

  function extractA4BillIdV37(btn) {
    const raw = btn?.getAttribute?.('onclick') || '';
    const match = raw.match(/(?:v12PrintReceiptA4|v24ShowDocSelector)\(['"]([^'"]+)['"]\)/);
    return match?.[1] || currentCheckoutBillIdV37();
  }

  function replaceCheckoutA4ButtonsV37(root = document, force = false) {
    const grid = root.querySelector?.('.sk-s6-print-grid, .v12-print-options');
    if (!grid) return;
    if (grid.__v37CheckoutPrintGridFixed && !force) return;
    const sourceBtn = grid.querySelector('[onclick*="v12PrintReceiptA4"], [onclick*="v24ShowDocSelector"]') || grid.querySelector('button');
    const billId = extractA4BillIdV37(sourceBtn);
    if (!billId) return;
    grid.__v37CheckoutPrintGridFixed = true;
    grid.innerHTML = '';

    const btn80 = document.createElement('button');
    btn80.type = 'button';
    btn80.className = 'sk-print-card primary v37-print-80-card';
    btn80.innerHTML = `
      <i class="material-icons-round">receipt</i>
      <div><div class="pk-title">ใบเสร็จ 80mm</div><div class="pk-sub">เครื่องพิมพ์ความร้อน</div></div>`;
    btn80.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      if (typeof window.v12PrintReceipt80mm === 'function') window.v12PrintReceipt80mm(billId);
    });

    const btnA4 = document.createElement('button');
    btnA4.type = 'button';
    btnA4.className = 'sk-print-card v37-a4-print-card';
    btnA4.innerHTML = `
      <i class="material-icons-round">article</i>
      <div><div class="pk-title">พิมพ์ A4 อัตโนมัติ</div><div class="pk-sub">เลือกชนิดเอกสารตามสถานะบิล</div></div>`;
    btnA4.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
        window.v37PrintBillA4Smart(billId);
    });

    grid.append(btn80, btnA4);
  }

  function installCheckoutA4ButtonFixV37() {
    if (window.__v37CheckoutA4ButtonFix) return;
    window.__v37CheckoutA4ButtonFix = true;
    replaceCheckoutA4ButtonsV37(document);

    const originalS6 = window.v12S6;
    if (typeof originalS6 === 'function' && !originalS6.__v37A4ButtonFix) {
      window.v12S6 = function (container) {
        const out = originalS6.apply(this, arguments);
        setTimeout(() => replaceCheckoutA4ButtonsV37(container || document), 0);
        setTimeout(() => replaceCheckoutA4ButtonsV37(container || document), 120);
        return out;
      };
      window.v12S6.__v37A4ButtonFix = true;
      try { v12S6 = window.v12S6; } catch (_) {}
    }

    const target = document.getElementById('checkout-content') || document.body;
    const observer = new MutationObserver(() => replaceCheckoutA4ButtonsV37(document));
    observer.observe(target, { childList: true, subtree: true });
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
        document.getElementById('v37-cash-history-wrap')?.remove();
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

  installAll();
  setTimeout(installAll, 800);
  setTimeout(installAll, 1800);
  setTimeout(installAll, 3200);
  setTimeout(installAll, 5000);
  setInterval(() => {
    try { installPrintOverrides(); } catch (_) {}
  }, 2500);
  setTimeout(installAll, 4200);
  setTimeout(installAll, 6000);
  window.v37EnsureTodayCashSession = ensureTodaySession;
  console.log('[v37] daily cash + detailed print patch loaded');
})();
