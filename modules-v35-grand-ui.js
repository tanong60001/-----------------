/*
 * V35 Grand UI layer
 * - Re-skins product management and projects with richer visuals.
 * - Adds employee delete button without touching attendance save logic.
 */
(function () {
  'use strict';

  const fmt = n => typeof formatNum === 'function'
    ? formatNum(n)
    : Number(n || 0).toLocaleString('th-TH');

  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));

  function injectCSS() {
    if (document.getElementById('v35-grand-css')) return;
    const s = document.createElement('style');
    s.id = 'v35-grand-css';
    s.textContent = `
      .v35-grand {
        max-width: 1500px;
        margin: 0 auto;
        padding: 4px 0 34px;
      }
      .v35-stage {
        position: relative;
        overflow: hidden;
        border-radius: 26px;
        padding: 30px;
        color: #fff;
        background:
          linear-gradient(120deg, rgba(17,24,39,.97), rgba(49,46,129,.94) 48%, rgba(190,18,60,.86)),
          repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 1px, transparent 1px 56px);
        box-shadow: 0 28px 80px rgba(49,46,129,.22);
        margin-bottom: 20px;
      }
      .v35-stage::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(135deg, transparent 0 31%, rgba(255,255,255,.12) 31% 32%, transparent 32%),
          linear-gradient(45deg, transparent 0 68%, rgba(255,255,255,.10) 68% 69%, transparent 69%);
        background-size: 140px 140px, 190px 190px;
        opacity: .55;
      }
      .v35-stage::after {
        content: "";
        position: absolute;
        right: 26px;
        bottom: -42px;
        width: 210px;
        height: 210px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 44px;
        transform: rotate(16deg);
      }
      .v35-stage-inner {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        flex-wrap: wrap;
      }
      .v35-kicker {
        width: max-content;
        margin-bottom: 10px;
        padding: 6px 11px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.25);
        background: rgba(255,255,255,.12);
        color: #fde68a;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 2px;
      }
      .v35-title {
        margin: 0;
        color: #fff;
        font-size: 34px;
        line-height: 1.08;
        font-weight: 900;
      }
      .v35-sub {
        max-width: 660px;
        margin-top: 10px;
        color: rgba(255,255,255,.76);
        font-size: 14px;
        font-weight: 650;
      }
      .v35-stage-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .v35-hero-btn {
        min-height: 46px;
        border: 1px solid rgba(255,255,255,.26);
        border-radius: 14px;
        padding: 11px 16px;
        background: rgba(255,255,255,.14);
        color: #fff;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        cursor: pointer;
        backdrop-filter: blur(10px);
      }
      .v35-hero-btn.primary {
        background: #fff;
        color: #312e81;
        border-color: #fff;
      }

      /* Product management */
      .v35-manage-shell {
        display: grid;
        grid-template-columns: 330px minmax(0, 1fr);
        gap: 18px;
        align-items: start;
      }
      .v35-manage-menu,
      .v35-side-summary,
      .v35-workbench,
      .v35-project-stat,
      .v35-project-card {
        border: 1px solid #e8edf4;
        background: rgba(255,255,255,.9);
        box-shadow: 0 18px 46px rgba(15,23,42,.07);
      }
      .v35-manage-menu {
        position: sticky;
        top: 82px;
        border-radius: 22px;
        padding: 14px;
      }
      .v35-manage-tab {
        position: relative;
        width: 100%;
        min-height: 86px;
        border: 0;
        border-radius: 18px;
        padding: 14px;
        display: grid;
        grid-template-columns: 52px 1fr 22px;
        gap: 12px;
        align-items: center;
        background: transparent;
        text-align: left;
        cursor: pointer;
        font-family: inherit;
        transition: .18s ease;
      }
      .v35-manage-tab:hover {
        transform: translateY(-2px);
        background: #f8fafc;
      }
      .v35-manage-tab.active {
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--tab, #6366f1) 16%, #fff), #fff) !important;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tab, #6366f1) 22%, transparent);
      }
      .v35-tab-icon {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        background: var(--tab, #6366f1);
        box-shadow: 0 12px 24px color-mix(in srgb, var(--tab, #6366f1) 28%, transparent);
      }
      .v35-tab-icon i { font-size: 25px; }
      .v35-tab-name {
        color: #172033;
        font-size: 15px;
        font-weight: 900;
      }
      .v35-tab-desc {
        margin-top: 3px;
        color: #8793a6;
        font-size: 12px;
        font-weight: 650;
      }
      .v35-side-summary {
        margin-top: 14px;
        border-radius: 20px;
        padding: 16px;
      }
      .v35-summary-title {
        color: #8793a6;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1.5px;
        margin-bottom: 12px;
      }
      .v35-workbench {
        min-height: 540px;
        border-radius: 24px;
        padding: 22px;
        overflow: hidden;
      }
      #v9-manage-content {
        border: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
        min-height: 460px !important;
        background: transparent !important;
      }
      #v9-manage-content > div:first-child {
        border-radius: 20px !important;
      }

      /* Project page */
      .v35-project-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 18px;
      }
      .v35-project-stat {
        position: relative;
        overflow: hidden;
        border-radius: 20px;
        padding: 18px;
      }
      .v35-project-stat::after {
        content: "";
        position: absolute;
        right: 14px;
        top: 14px;
        width: 48px;
        height: 48px;
        border-radius: 16px;
        background: var(--tone, #6366f1);
        opacity: .12;
        transform: rotate(10deg);
      }
      .v35-project-stat .label {
        color: #8793a6;
        font-size: 12px;
        font-weight: 900;
      }
      .v35-project-stat .value {
        margin-top: 8px;
        color: #172033;
        font-size: 28px;
        font-weight: 900;
      }
      .v35-project-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
        gap: 16px;
      }
      .v35-project-card {
        --bar: #6366f1;
        position: relative;
        overflow: hidden;
        border-radius: 24px;
        padding: 20px;
        cursor: pointer;
        transition: .18s ease;
      }
      .v35-project-card:hover {
        transform: translateY(-4px) rotate(-.2deg);
        box-shadow: 0 24px 58px rgba(15,23,42,.13);
      }
      .v35-project-card::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        height: 7px;
        background: var(--bar);
      }
      .v35-project-card::after {
        content: "";
        position: absolute;
        right: -36px;
        bottom: -42px;
        width: 130px;
        height: 130px;
        border-radius: 34px;
        border: 1px solid color-mix(in srgb, var(--bar) 24%, transparent);
        transform: rotate(18deg);
      }
      .v35-project-head {
        position: relative;
        z-index: 1;
        display: flex;
        gap: 13px;
        align-items: flex-start;
      }
      .v35-project-icon {
        width: 54px;
        height: 54px;
        border-radius: 17px;
        background: color-mix(in srgb, var(--bar) 15%, #fff);
        color: var(--bar);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .v35-project-name {
        color: #172033;
        font-size: 18px;
        font-weight: 900;
        line-height: 1.25;
      }
      .v35-project-meta {
        margin-top: 4px;
        color: #8793a6;
        font-size: 12px;
        font-weight: 750;
      }
      .v35-progress {
        position: relative;
        z-index: 1;
        height: 10px;
        border-radius: 999px;
        background: #edf2f7;
        overflow: hidden;
        margin: 15px 0 8px;
      }
      .v35-progress > span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--bar);
      }
      .v35-project-foot {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 14px;
      }
      .v35-project-foot div {
        border-radius: 14px;
        background: #f8fafc;
        padding: 10px;
      }
      .v35-project-foot span {
        display: block;
        color: #8793a6;
        font-size: 10px;
        font-weight: 900;
      }
      .v35-project-foot strong {
        display: block;
        margin-top: 3px;
        color: #172033;
        font-size: 13px;
        font-weight: 900;
      }
      .v35-empty {
        border: 1px dashed #cbd5e1;
        border-radius: 24px;
        padding: 72px 24px;
        text-align: center;
        background: rgba(255,255,255,.82);
        color: #8793a6;
        font-weight: 800;
      }

      .v35-emp-del {
        border: 1px solid #fecaca;
        background: #fff1f0;
        color: #b42318;
        border-radius: 999px;
        padding: 7px 11px;
        font-size: 12px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
      }
      .v35-emp-del:hover { background: #fee2e2; }

      @media (max-width: 980px) {
        .v35-manage-shell { grid-template-columns: 1fr; }
        .v35-manage-menu { position: static; }
        .v35-project-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .v35-stage { padding: 22px; border-radius: 20px; }
        .v35-title { font-size: 26px; }
        .v35-project-stats { grid-template-columns: 1fr; }
        .v35-project-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  const manageTabs = [
    { key: 'cats', label: 'หมวดหมู่', icon: 'category', desc: 'จัดจักรวาลสินค้าให้หาเจอเร็ว', color: '#6366f1' },
    { key: 'units', label: 'หน่วยนับ', icon: 'straighten', desc: 'ตั้งค่าแปลงหน่วยและอัตรา conv', color: '#0891b2' },
    { key: 'recipe', label: 'สูตรสินค้า', icon: 'science', desc: 'BOM วัตถุดิบต่อสินค้า', color: '#059669' },
    { key: 'supplier', label: 'ซัพพลายเออร์', icon: 'local_shipping', desc: 'ฐานข้อมูลผู้จำหน่าย', color: '#d97706' },
    { key: 'produce', label: 'ผลิตสินค้า', icon: 'precision_manufacturing', desc: 'สั่งผลิตตามสูตร', color: '#dc2626' },
  ];

  function currentManageTab() {
    try {
      if (typeof _v9ManageCurTab !== 'undefined') return _v9ManageCurTab;
    } catch (_) {}
    return 'cats';
  }

  window.v9RenderManage = async function () {
    const pg = document.getElementById('page-manage');
    if (!pg) return;
    pg.innerHTML = `
      <div class="v35-grand">
        <div class="v35-stage">
          <div class="v35-stage-inner">
            <div>
              <div class="v35-kicker">PRODUCT CONTROL ROOM</div>
              <h2 class="v35-title">จัดการสินค้าหลังฉาก</h2>
              <div class="v35-sub">หมวดหมู่ หน่วยนับ สูตร ซัพพลายเออร์ และการผลิต ถูกวางเป็นแผงควบคุมเดียว ดูสนุกขึ้นแต่ยังใช้ฟังก์ชันเดิมทั้งหมด</div>
            </div>
            <div class="v35-stage-actions">
              <button class="v35-hero-btn" onclick="if(window.renderInventory)go('inv')"><i class="material-icons-round">inventory_2</i>ไปคลังสินค้า</button>
              <button class="v35-hero-btn primary" onclick="v9SwitchManageTab('cats')"><i class="material-icons-round">auto_fix_high</i>รีเฟรชแผง</button>
            </div>
          </div>
        </div>
        <div class="v35-manage-shell">
          <div>
            <div class="v35-manage-menu">
              ${manageTabs.map(t => `
                <button class="v35-manage-tab" id="v9mtab-${t.key}" style="--tab:${t.color}" onclick="v9SwitchManageTab('${t.key}')">
                  <div class="v35-tab-icon" id="v9mtab-icon-${t.key}"><i class="material-icons-round">${t.icon}</i></div>
                  <div>
                    <div class="v35-tab-name" id="v9mtab-label-${t.key}">${t.label}</div>
                    <div class="v35-tab-desc">${t.desc}</div>
                  </div>
                  <i class="material-icons-round" id="v9mtab-arr-${t.key}" style="color:transparent">chevron_right</i>
                </button>
              `).join('')}
            </div>
            <div class="v35-side-summary">
              <div class="v35-summary-title">SYSTEM SNAPSHOT</div>
              <div id="v9m-stats-inner" style="display:flex;flex-direction:column;gap:9px">
                <div style="color:#8793a6;font-size:12px">กำลังโหลด...</div>
              </div>
            </div>
          </div>
          <div class="v35-workbench">
            <div id="v9-manage-content">
              <div class="v35-empty">
                <i class="material-icons-round" style="font-size:50px;display:block;margin-bottom:10px;color:#cbd5e1">settings_suggest</i>
                เลือกแผงด้านซ้ายเพื่อเริ่มจัดการสินค้า
              </div>
            </div>
          </div>
        </div>
      </div>`;
    if (typeof v9LoadManageStats === 'function') v9LoadManageStats();
    if (typeof v9SwitchManageTab === 'function') v9SwitchManageTab(currentManageTab());
  };

  const oldSwitchManageTab = window.v9SwitchManageTab;
  if (typeof oldSwitchManageTab === 'function' && !oldSwitchManageTab.__v35) {
    window.v9SwitchManageTab = function (tab) {
      const out = oldSwitchManageTab.apply(this, arguments);
      setTimeout(() => {
        manageTabs.forEach(t => {
          const el = document.getElementById('v9mtab-' + t.key);
          const arr = document.getElementById('v9mtab-arr-' + t.key);
          if (el) el.classList.toggle('active', t.key === tab);
          if (arr) arr.style.color = t.key === tab ? t.color : 'transparent';
        });
      }, 0);
      return out;
    };
    window.v9SwitchManageTab.__v35 = true;
  }

  window.renderProjects = async function () {
    const sec = document.getElementById('page-projects');
    if (!sec) return;
    sec.innerHTML = '<div class="v35-grand"><div class="v35-empty">กำลังโหลดโครงการ...</div></div>';
    try {
      const { data } = await db.from('โครงการ').select('*').order('created_at', { ascending: false });
      const list = data || [];
      const totalBudget = list.reduce((s, p) => s + Number(p.budget || 0), 0);
      const activeCount = list.filter(p => p.status === 'active').length;
      const spentAll = list.reduce((s, p) => s + Number(p.total_expenses || 0) + Number(p.total_goods_cost || 0), 0);
      const profitAll = totalBudget - spentAll;

      sec.innerHTML = `
        <div class="v35-grand">
          <div class="v35-stage">
            <div class="v35-stage-inner">
              <div>
                <div class="v35-kicker">PROJECT CONSTELLATION</div>
                <h2 class="v35-title">โครงการของร้าน</h2>
                <div class="v35-sub">มองแต่ละโครงการเหมือนภารกิจ เห็นงบ ต้นทุน ความคืบหน้า และกำไรในแผ่นเดียว แล้วกดเข้าไปจัดการรายละเอียดเดิมได้ทันที</div>
              </div>
              <button class="v35-hero-btn primary" onclick="v14ShowAddProject()"><i class="material-icons-round">add</i>เพิ่มโครงการ</button>
            </div>
          </div>
          <div class="v35-project-stats">
            <div class="v35-project-stat" style="--tone:#6366f1"><div class="label">โครงการทั้งหมด</div><div class="value">${fmt(list.length)}</div></div>
            <div class="v35-project-stat" style="--tone:#f59e0b"><div class="label">กำลังดำเนินการ</div><div class="value">${fmt(activeCount)}</div></div>
            <div class="v35-project-stat" style="--tone:#2563eb"><div class="label">งบประมาณรวม</div><div class="value">฿${fmt(totalBudget)}</div></div>
            <div class="v35-project-stat" style="--tone:${profitAll >= 0 ? '#10b981' : '#ef4444'}"><div class="label">กำไรสุทธิรวม</div><div class="value" style="color:${profitAll >= 0 ? '#10b981' : '#ef4444'}">฿${fmt(Math.abs(profitAll))}</div></div>
          </div>
          ${list.length ? `<div class="v35-project-grid">${list.map(projectCard).join('')}</div>` : `
            <div class="v35-empty">
              <i class="material-icons-round" style="font-size:54px;display:block;margin-bottom:10px;color:#cbd5e1">business_center</i>
              ยังไม่มีโครงการ<br><span style="font-size:13px;font-weight:650">กด "เพิ่มโครงการ" เพื่อเริ่มต้น</span>
            </div>`}
        </div>`;
    } catch (e) {
      sec.innerHTML = `<div class="v35-grand"><div class="v35-empty" style="color:#dc2626">โหลดโครงการไม่สำเร็จ: ${esc(e.message)}</div></div>`;
    }
  };

  function projectCard(p) {
    const spent = Number(p.total_expenses || 0) + Number(p.total_goods_cost || 0);
    const budget = Number(p.budget || 0);
    const profit = budget - spent;
    const pct = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;
    const done = p.status === 'completed';
    const bar = done ? '#10b981' : pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#6366f1';
    return `
      <div class="v35-project-card" style="--bar:${bar}" onclick="v14OpenProject('${p.id}')">
        <div class="v35-project-head">
          <div class="v35-project-icon"><i class="material-icons-round">${done ? 'verified' : 'construction'}</i></div>
          <div style="min-width:0;flex:1">
            <div class="v35-project-name">${esc(p.name)}</div>
            <div class="v35-project-meta">${p.contract_no ? 'สัญญา #' + esc(p.contract_no) + ' · ' : ''}${done ? 'เสร็จสิ้นแล้ว' : 'กำลังดำเนินการ'}</div>
          </div>
        </div>
        <div class="v35-progress"><span style="width:${pct}%"></span></div>
        <div style="color:#64748b;font-size:12px;font-weight:850">ใช้ไป ${pct}% จากงบ ฿${fmt(budget)}</div>
        <div class="v35-project-foot">
          <div><span>ต้นทุน</span><strong>฿${fmt(spent)}</strong></div>
          <div><span>คงเหลือ</span><strong>฿${fmt(Math.max(0, budget - spent))}</strong></div>
          <div><span>${profit >= 0 ? 'กำไร' : 'ขาดทุน'}</span><strong style="color:${profit >= 0 ? '#10b981' : '#ef4444'}">฿${fmt(Math.abs(profit))}</strong></div>
        </div>
      </div>`;
  }

  const baseRenderAttendance = window.renderAttendance;
  if (typeof baseRenderAttendance === 'function' && !baseRenderAttendance.__v35DeleteWrap) {
    window.renderAttendance = async function () {
      const result = await baseRenderAttendance.apply(this, arguments);
      await addEmployeeDeleteButtons();
      return result;
    };
    window.renderAttendance.__v35DeleteWrap = true;
  }

  async function addEmployeeDeleteButtons() {
    const cards = document.querySelectorAll('.v26-card[id^="v26c-"]');
    if (!cards.length) return;
    cards.forEach(card => {
      const id = card.id.replace('v26c-', '');
      if (!id || card.querySelector('.v35-emp-del')) return;
      const actions = card.querySelector('.v26-card-actions');
      if (!actions) return;
      const name = (card.querySelector('.v26-card-inner div[style*="font-weight:900"]')?.textContent || 'พนักงาน').trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'v35-emp-del';
      btn.innerHTML = '<i class="material-icons-round" style="font-size:15px">delete</i> ลบ';
      btn.onclick = function (ev) {
        ev.stopPropagation();
        window.v35DeleteEmployee(id, name);
      };
      actions.appendChild(btn);
    });
  }

  window.v35DeleteEmployee = async function (employeeId, employeeName) {
    const name = employeeName || 'พนักงาน';
    let ok = true;
    if (typeof Swal !== 'undefined') {
      const res = await Swal.fire({
        icon: 'warning',
        title: 'ลบพนักงานคนนี้?',
        html: `<div style="line-height:1.7">ระบบจะซ่อน <strong>${esc(name)}</strong> ออกจากหน้าพนักงาน แต่ไม่ลบประวัติลงเวลาและการจ่ายเงินเก่า</div>`,
        showCancelButton: true,
        confirmButtonText: 'ลบพนักงาน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626',
      });
      ok = res.isConfirmed;
    } else {
      ok = confirm('ลบพนักงาน ' + name + '?');
    }
    if (!ok) return;

    try {
      const { error } = await db.from('พนักงาน').update({ status: 'ลบ' }).eq('id', employeeId);
      if (error) throw error;
      if (typeof logActivity === 'function') logActivity('ลบพนักงาน', name, employeeId, 'พนักงาน');
      if (typeof toast === 'function') toast('ลบพนักงานแล้ว', 'success');
      if (typeof renderAttendance === 'function') await renderAttendance();
    } catch (e) {
      console.error('[v35] delete employee:', e);
      if (typeof toast === 'function') toast('ลบพนักงานไม่สำเร็จ: ' + e.message, 'error');
    }
  };

  injectCSS();
  setTimeout(() => {
    try {
      const managePage = document.getElementById('page-manage');
      if (managePage && !managePage.classList.contains('hidden') && typeof window.v9RenderManage === 'function') {
        window.v9RenderManage();
      }
      const projectPage = document.getElementById('page-projects');
      if (projectPage && !projectPage.classList.contains('hidden') && typeof window.renderProjects === 'function') {
        window.renderProjects();
      }
      const attPage = document.getElementById('page-att');
      if (attPage && !attPage.classList.contains('hidden')) addEmployeeDeleteButtons();
    } catch (e) {
      console.warn('[v35-grand] initial refresh skipped:', e);
    }
  }, 250);
  console.log('[v35-grand] UI layer loaded');
})();
