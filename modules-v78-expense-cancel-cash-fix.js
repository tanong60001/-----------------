(function () {
  'use strict';

  const EXPENSE_TABLE = 'รายจ่าย';
  const CASH_TABLE = 'cash_transaction';

  const num = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = v => {
    try { return typeof formatNum === 'function' ? formatNum(v) : num(v).toLocaleString('th-TH'); }
    catch (_) { return num(v).toLocaleString('th-TH'); }
  };
  const staff = () => {
    try { return USER?.username || localStorage.getItem('current_staff_name') || 'system'; }
    catch (_) { return 'system'; }
  };
  const canDelete = () => {
    try {
      if (typeof window.canDeleteActionV36 === 'function') return window.canDeleteActionV36();
    } catch (_) {}
    try { return USER?.role === 'admin' || USER_PERMS?.can_delete === true; } catch (_) { return false; }
  };

  async function openSessionId() {
    const { data } = await db.from('cash_session')
      .select('id')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  }

  async function cashRefundAmount(expense) {
    const { data } = await db.from(CASH_TABLE)
      .select('direction,net_amount,amount')
      .eq('ref_id', expense.id)
      .eq('ref_table', EXPENSE_TABLE);
    const rows = data || [];
    const out = rows.filter(tx => tx.direction === 'out').reduce((s, tx) => s + num(tx.net_amount || tx.amount), 0);
    const back = rows.filter(tx => tx.direction === 'in').reduce((s, tx) => s + num(tx.net_amount || tx.amount), 0);
    if (out > back) return out - back;
    return /เงินสด/.test(String(expense.method || '')) ? num(expense.amount) : 0;
  }

  async function recordExpenseCancelCash(expense, reason) {
    if (!/เงินสด/.test(String(expense.method || ''))) return 0;
    const amount = num(await cashRefundAmount(expense));
    if (amount <= 0) return 0;
    const sessionId = await openSessionId();
    if (!sessionId) return 0;

    const note = `ยกเลิกรายจ่าย: ${expense.description || '-'}${reason ? ` | ${reason}` : ''}`;
    if (typeof window.recordCashTx === 'function') {
      await window.recordCashTx({
        sessionId,
        type: 'ยกเลิกรายจ่าย',
        direction: 'in',
        amount,
        netAmount: amount,
        refId: expense.id,
        refTable: EXPENSE_TABLE,
        note,
      });
      return amount;
    }

    const { error } = await db.from(CASH_TABLE).insert({
      session_id: sessionId,
      type: 'ยกเลิกรายจ่าย',
      direction: 'in',
      amount,
      net_amount: amount,
      ref_id: expense.id,
      ref_table: EXPENSE_TABLE,
      staff_name: staff(),
      note,
    });
    if (error) throw error;
    return amount;
  }

  async function fixedDeleteExpense(id) {
    if (!canDelete()) {
      if (typeof Swal !== 'undefined') {
        await Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์ลบรายการ', text: 'ต้องเป็นแอดมินหรือมีสิทธิ์ลบรายการ', confirmButtonColor: '#dc2626' });
      } else {
        toast?.('ไม่มีสิทธิ์ลบรายการ', 'warning');
      }
      return false;
    }

    const { data: expense, error } = await db.from(EXPENSE_TABLE).select('*').eq('id', id).maybeSingle();
    if (error) {
      toast?.('โหลดรายจ่ายไม่สำเร็จ: ' + error.message, 'error');
      return false;
    }
    if (!expense) {
      toast?.('ไม่พบรายจ่ายนี้', 'warning');
      return false;
    }

    const cashAmount = await cashRefundAmount(expense);
    const r = await Swal.fire({
      title: 'ลบรายจ่ายนี้?',
      icon: 'warning',
      html: `<div style="text-align:left;line-height:1.7">
        <b>${expense.description || '-'}</b><br>
        ยอดรายจ่าย ฿${fmt(expense.amount)}
        ${cashAmount > 0 ? `<br><span style="color:#059669;font-weight:800">จะคืนเงินเข้าลิ้นชัก ฿${fmt(cashAmount)}</span>` : ''}
      </div>`,
      input: 'text',
      inputPlaceholder: 'หมายเหตุ เช่น ลงผิด / ยกเลิกรายการ',
      showCancelButton: true,
      confirmButtonText: 'ลบรายจ่าย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#DC2626',
    });
    if (!r.isConfirmed) return false;

    if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังยกเลิกรายจ่าย...');
    try {
      const returned = await recordExpenseCancelCash(expense, r.value || '');
      const del = await db.from(EXPENSE_TABLE).delete().eq('id', id);
      if (del.error) throw del.error;
      if (typeof logActivity === 'function') {
        logActivity('ลบรายจ่าย', `${expense.description || '-'} ฿${fmt(expense.amount)}${returned ? ` | คืนลิ้นชัก ฿${fmt(returned)}` : ''}`, id, EXPENSE_TABLE);
      }
      toast?.(returned ? `ลบรายจ่ายแล้ว และคืนเงินเข้าลิ้นชัก ฿${fmt(returned)}` : 'ลบรายจ่ายสำเร็จ', 'success');
      await loadExpenseData?.();
      updateHomeStats?.();
      loadCashBalance?.();
      renderCashDrawer?.();
      return true;
    } catch (e) {
      console.error('[v78] delete expense:', e);
      toast?.('ลบรายจ่ายไม่สำเร็จ: ' + (e.message || e), 'error');
      return false;
    } finally {
      if (typeof v9HideOverlay === 'function') v9HideOverlay();
    }
  }

  function install() {
    window.deleteExpense = fixedDeleteExpense;
    try { deleteExpense = fixedDeleteExpense; } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 800);
  console.log('[v78] expense cancel cash fix loaded');
})();
