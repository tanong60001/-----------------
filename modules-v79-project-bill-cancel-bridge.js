(function () {
  'use strict';

  const BILL_TABLE = 'บิลขาย';
  const PROJECT_TABLE = 'โครงการ';
  const PROJECT_EXPENSE_TABLE = 'รายจ่ายโครงการ';

  const num = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = v => {
    try { return typeof formatNum === 'function' ? formatNum(v) : num(v).toLocaleString('th-TH'); }
    catch (_) { return num(v).toLocaleString('th-TH'); }
  };
  const isProjectBill = bill => {
    if (!bill) return false;
    const text = `${bill.method || ''} ${bill.status || ''} ${bill.customer_name || ''} ${bill.note || ''}`;
    return !!bill.project_id || /\[โครงการ\]|โครงการ|เบิกของโครงการ|จ่ายของให้โครงการ|ต้นทุนโครงการ/i.test(text);
  };

  function injectCompactStyle() {
    if (document.getElementById('v79-project-compact-style')) return;
    const style = document.createElement('style');
    style.id = 'v79-project-compact-style';
    style.textContent = `
      #page-history .v39-pill,
      #page-history .v12-status-badge,
      .v12-bmc-table .v12-status-badge{
        min-height:24px!important;
        padding:3px 8px!important;
        border-radius:999px!important;
        font-size:11px!important;
        line-height:1.15!important;
        gap:4px!important;
        max-width:138px!important;
        white-space:normal!important;
      }
      #page-history .v39-pill i{font-size:13px!important}
      #page-history .v39-status,
      .v12-bmc-table .v12-status-badge{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
      }
      #page-history .v39-status{max-width:128px!important}
      #page-history td:nth-child(7){min-width:116px!important}
      #page-history .v39-sub{font-size:10.5px!important;line-height:1.25!important}
    `;
    document.head.appendChild(style);
  }

  async function cleanupProjectBillLinks(billId) {
    const { data: expenses, error } = await db.from(PROJECT_EXPENSE_TABLE)
      .select('*')
      .eq('bill_id', billId);
    if (error) throw error;
    const rows = expenses || [];
    if (!rows.length) return { count: 0, goods: 0, expenses: 0 };

    const byProject = {};
    rows.forEach(row => {
      const projectId = row.project_id;
      if (!projectId) return;
      if (!byProject[projectId]) byProject[projectId] = { goods: 0, expenses: 0 };
      if (String(row.type || '').toLowerCase() === 'goods' || /สินค้า|วัสดุ|อุปกรณ์/.test(String(row.category || ''))) {
        byProject[projectId].goods += num(row.amount);
      } else {
        byProject[projectId].expenses += num(row.amount);
      }
    });

    for (const [projectId, sums] of Object.entries(byProject)) {
      const { data: project } = await db.from(PROJECT_TABLE)
        .select('total_goods_cost,total_expenses')
        .eq('id', projectId)
        .maybeSingle();
      if (!project) continue;
      await db.from(PROJECT_TABLE).update({
        total_goods_cost: Math.max(0, num(project.total_goods_cost) - sums.goods),
        total_expenses: Math.max(0, num(project.total_expenses) - sums.expenses),
      }).eq('id', projectId);
    }

    const del = await db.from(PROJECT_EXPENSE_TABLE).delete().eq('bill_id', billId);
    if (del.error) throw del.error;

    const goods = rows.reduce((s, row) => s + ((String(row.type || '').toLowerCase() === 'goods' || /สินค้า|วัสดุ|อุปกรณ์/.test(String(row.category || ''))) ? num(row.amount) : 0), 0);
    const expensesSum = rows.reduce((s, row) => s + ((String(row.type || '').toLowerCase() === 'goods' || /สินค้า|วัสดุ|อุปกรณ์/.test(String(row.category || ''))) ? 0 : num(row.amount)), 0);
    return { count: rows.length, goods, expenses: expensesSum };
  }

  window.v79CleanupProjectBillLinks = cleanupProjectBillLinks;

  function patchCancelBill() {
    const original = window.cancelBill;
    if (typeof original !== 'function' || original.__v79ProjectCancel) return;

    const wrapped = async function (billId, ...args) {
      let bill = null;
      try {
        const res = await db.from(BILL_TABLE).select('*').eq('id', billId).maybeSingle();
        bill = res.data || null;
      } catch (_) {}
      const project = isProjectBill(bill);
      const beforeStatus = String(bill?.status || '');

      const result = await original.call(this, billId, ...args);

      if (!project) return result;
      try {
        const refreshed = await db.from(BILL_TABLE).select('status,bill_no').eq('id', billId).maybeSingle();
        const status = String(refreshed.data?.status || '');
        if (!/ยกเลิก/.test(status) || /ยกเลิก/.test(beforeStatus)) return result;
        const cleaned = await cleanupProjectBillLinks(billId);
        if (cleaned.count > 0) {
          toast?.(`ยกเลิกบิลโครงการแล้ว ลบรายการโครงการ ${cleaned.count} รายการ (฿${fmt(cleaned.goods + cleaned.expenses)})`, 'success');
          logActivity?.('ยกเลิกบิลโครงการ', `บิล #${refreshed.data?.bill_no || bill?.bill_no || billId} | ลบรายการโครงการ ${cleaned.count} รายการ ฿${fmt(cleaned.goods + cleaned.expenses)}`, billId, BILL_TABLE);
        }
        window.v12BMCLoad?.();
        window.renderProjects?.();
      } catch (e) {
        console.error('[v79] project cancel cleanup:', e);
        toast?.('ยกเลิกบิลแล้ว แต่ลบรายการโครงการไม่สำเร็จ: ' + (e.message || e), 'error');
      }
      return result;
    };
    Object.defineProperty(wrapped, '__v79ProjectCancel', { value: true });
    window.cancelBill = wrapped;
    try { cancelBill = wrapped; } catch (_) {}
  }

  function patchBadges() {
    if (typeof window.v12BMCBadge === 'function' && !window.v12BMCBadge.__v79CompactProject) {
      const orig = window.v12BMCBadge;
      window.v12BMCBadge = function (status) {
        if (/จ่ายของให้โครงการ|เบิกของโครงการ/.test(String(status || ''))) {
          return '<span class="v12-status-badge v12-badge-purple" title="เบิกสินค้าเข้าโครงการ"><i class="material-icons-round" style="font-size:13px;vertical-align:-2px">business_center</i> โครงการ</span>';
        }
        return orig(status);
      };
      window.v12BMCBadge.__v79CompactProject = true;
    }
    if (typeof window.v12BMCMethodBadge === 'function' && !window.v12BMCMethodBadge.__v79CompactProject) {
      const orig = window.v12BMCMethodBadge;
      window.v12BMCMethodBadge = function (method) {
        if (/โครงการ|จ่ายของให้โครงการ|เบิกของโครงการ/.test(String(method || ''))) {
          return '<span class="v12-status-badge v12-badge-purple" title="จ่ายของให้โครงการ"><i class="material-icons-round" style="font-size:13px;vertical-align:-2px">business_center</i> โครงการ</span>';
        }
        return orig(method);
      };
      window.v12BMCMethodBadge.__v79CompactProject = true;
    }
  }

  function install() {
    injectCompactStyle();
    patchCancelBill();
    patchBadges();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 800);
  setTimeout(install, 1800);
  console.log('[v79] project bill cancel bridge loaded');
})();
