(function () {
  'use strict';

  const fmt = n => typeof formatNum === 'function' ? formatNum(n) : Number(n || 0).toLocaleString('th-TH');
  const money = v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const safeText = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function injectStyle() {
    if (document.getElementById('v45-polished-popups-style')) return;
    const style = document.createElement('style');
    style.id = 'v45-polished-popups-style';
    style.textContent = `
      .v45-modal{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.52);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px}
      .v45-sheet{width:min(1180px,96vw);max-height:92vh;overflow:auto;background:#f8fafc;border:1px solid #dbe3ef;border-radius:22px;box-shadow:0 34px 90px rgba(15,23,42,.28);transform:translateY(10px);opacity:0;transition:.2s cubic-bezier(.16,1,.3,1)}
      .v45-sheet.open{transform:none;opacity:1}
      .v45-head{padding:20px 22px;color:#fff;background:radial-gradient(circle at 18% 0%,rgba(34,197,94,.32),transparent 35%),radial-gradient(circle at 78% 18%,rgba(239,68,68,.36),transparent 30%),linear-gradient(135deg,#111827,#0f766e 58%,#dc2626);display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .v45-title-row{display:flex;align-items:center;gap:14px}.v45-icon{width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.14);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.20)}.v45-icon i{font-size:29px}
      .v45-kicker{font-size:11px;font-weight:950;letter-spacing:1.3px;color:#bbf7d0;text-transform:uppercase}.v45-title{font-size:24px;font-weight:950;line-height:1.15;margin-top:4px}.v45-sub{font-size:13px;color:#e2e8f0;margin-top:5px;font-weight:700}
      .v45-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.10);color:#fff;border-radius:13px;cursor:pointer}
      .v45-body{padding:18px}.v45-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.75fr);gap:16px}.v45-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;box-shadow:0 14px 34px rgba(15,23,42,.045)}
      .v45-section-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:950;color:#0f172a;margin-bottom:13px}.v45-section-title i{font-size:18px;color:#dc2626}
      .v45-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v45-field{margin-bottom:12px}.v45-field label{display:block;font-size:12px;font-weight:900;color:#475569;margin-bottom:7px}
      .v45-field input,.v45-field select{width:100%;height:46px;border:1.5px solid #cbd5e1;border-radius:13px;background:#fff;padding:0 13px;font:inherit;font-size:14px;font-weight:800;color:#0f172a;outline:none;box-sizing:border-box}
      .v45-field input:focus,.v45-field select:focus{border-color:#10b981;box-shadow:0 0 0 4px #d1fae5}
      .v45-mats{display:grid;gap:9px}.v45-mats [id^="v9rec-mat-row-"]{grid-template-columns:minmax(260px,1.25fr) minmax(190px,.85fr) 110px 34px!important;background:#f8fafc;border:1px solid #e2e8f0;border-radius:15px;padding:10px;align-items:end!important}
      .v45-mats .form-label{font-size:11px;color:#64748b}.v45-add-row{height:44px;border:1.5px dashed #10b981;background:#ecfdf5;color:#047857;border-radius:13px;font:inherit;font-weight:950;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
      .v45-summary{display:grid;gap:10px;position:sticky;top:0}.v45-total{border-radius:18px;padding:18px;background:linear-gradient(135deg,#dc2626,#f97316);color:#fff;box-shadow:0 18px 34px rgba(220,38,38,.20)}.v45-total span{display:block;font-size:12px;font-weight:900;opacity:.88}.v45-total b{display:block;font-size:34px;font-weight:950;line-height:1.05;margin-top:4px}
      .v45-metric{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:12px}.v45-metric span{font-size:12px;color:#64748b;font-weight:900}.v45-metric b{font-size:18px;color:#0f172a;font-weight:950}.v45-metric.good b{color:#059669}.v45-metric.bad b{color:#dc2626}
      .v45-profitbar{height:11px;background:#fee2e2;border-radius:999px;overflow:hidden}.v45-profitbar div{height:100%;width:0;background:linear-gradient(90deg,#10b981,#22c55e);border-radius:999px;transition:.18s}
      .v45-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}.v45-btn{height:46px;border-radius:13px;border:1.5px solid #cbd5e1;background:#fff;padding:0 18px;font:inherit;font-size:14px;font-weight:950;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px}.v45-btn.primary{border-color:#dc2626;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;box-shadow:0 16px 30px rgba(220,38,38,.20)}
      .v45-exp-head{background:radial-gradient(circle at 18% 0%,rgba(251,191,36,.42),transparent 35%),radial-gradient(circle at 82% 15%,rgba(236,72,153,.38),transparent 32%),linear-gradient(135deg,#581c87,#be123c 62%,#f97316)}
      .v45-debt-head{background:radial-gradient(circle at 16% 0%,rgba(56,189,248,.42),transparent 34%),radial-gradient(circle at 78% 18%,rgba(250,204,21,.34),transparent 30%),linear-gradient(135deg,#0f172a,#2563eb 54%,#16a34a)}
      .v45-billbox{border-radius:20px;background:#fff;border:1px solid #e2e8f0;overflow:hidden}.v45-bill-top{display:flex;justify-content:space-between;gap:14px;background:#fff7ed;border-bottom:1px solid #fed7aa;padding:13px 15px}.v45-bill-top b{color:#9a3412}.v45-bill-lines{padding:14px 15px;display:grid;gap:10px}
      .v45-debt-bill .v45-bill-top{background:linear-gradient(135deg,#eff6ff,#dcfce7);border-bottom-color:#bfdbfe}.v45-debt-bill .v45-bill-top b{color:#1d4ed8}.v45-debt-amount{height:auto!important;min-height:74px!important;font-size:34px!important;font-weight:950!important;color:#1d4ed8!important;padding:8px 15px!important}.v45-debt-note{display:flex;align-items:center;gap:10px;border:1px dashed #93c5fd;background:#eff6ff;border-radius:14px;padding:12px;color:#475569;font-size:12px;font-weight:800;line-height:1.55}.v45-debt-note i{color:#2563eb}
      .v45-paychips{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.v45-paychip{height:54px;border:1.5px solid #e2e8f0;background:#fff;border-radius:14px;font:inherit;font-weight:950;color:#475569;cursor:pointer}.v45-paychip.on{border-color:#dc2626;background:#fef2f2;color:#b91c1c;box-shadow:0 0 0 4px #fee2e2}
      @media(max-width:860px){.v45-grid,.v45-form-grid{grid-template-columns:1fr}.v45-mats [id^="v9rec-mat-row-"]{grid-template-columns:1fr!important}.v45-actions{flex-direction:column}.v45-btn{width:100%}.v45-paychips{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function closeModalById(id) {
    document.getElementById(id)?.remove();
  }

  function updateRecipeSummary() {
    const price = money(document.getElementById('v9rec-price')?.value);
    const costText = document.getElementById('v9rec-cost-display')?.textContent || '0';
    const cost = money(costText.replace(/[^\d.-]/g, ''));
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('v45-rec-price', '฿' + fmt(price));
    setText('v45-rec-cost', '฿' + fmt(cost));
    setText('v45-rec-profit', (profit < 0 ? '-฿' : '฿') + fmt(Math.abs(profit)));
    setText('v45-rec-margin', Number.isFinite(margin) ? margin.toFixed(1) + '%' : '0.0%');
    const profitBox = document.getElementById('v45-rec-profit-box');
    if (profitBox) profitBox.classList.toggle('bad', profit < 0);
    const bar = document.getElementById('v45-rec-profit-bar');
    if (bar) bar.style.width = Math.max(0, Math.min(100, margin || 0)) + '%';
  }

  function installRecipePopup() {
    if (window.__v45RecipePopup) return;
    window.__v45RecipePopup = true;
    const originalAddMat = window.v9RecipeAddMat;
    const originalCalc = window.v9RecipeCalcCost;
    const originalSave = window.v9RecipeSave;

    window.v9RecipeCalcCost = function () {
      const out = originalCalc?.apply(this, arguments);
      setTimeout(updateRecipeSummary, 0);
      return out;
    };

    window.v9RecipeAddMat = function () {
      const out = originalAddMat?.apply(this, arguments);
      setTimeout(() => {
        window.v36EnhanceRecipePickers?.();
        updateRecipeSummary();
      }, 0);
      return out;
    };

    window.v9RecipeSave = async function () {
      await originalSave?.apply(this, arguments);
      setTimeout(() => {
        const body = document.querySelector('#v45-recipe-modal #v9rec-create');
        if (!body || body.style.display === 'none') window.v45CloseRecipeModal?.();
      }, 120);
    };

    window.v9RecipeShowCreate = function () {
      injectStyle();
      closeModalById('v45-recipe-modal');
      const inlineCreate = document.querySelector('#page-admin #v9rec-create, #page-inv #v9rec-create, #app-layout #v9rec-create');
      if (inlineCreate && !inlineCreate.closest('#v45-recipe-modal')) {
        inlineCreate.dataset.v45OldRecipeId = 'v9rec-create';
        inlineCreate.id = 'v45-inline-v9rec-create';
      }
      const el = document.createElement('div');
      el.id = 'v45-recipe-modal';
      el.className = 'v45-modal';
      el.innerHTML = `
        <div class="v45-sheet" id="v45-recipe-sheet">
          <div class="v45-head">
            <div class="v45-title-row">
              <div class="v45-icon"><i class="material-icons-round">science</i></div>
              <div><div class="v45-kicker">BOM Recipe</div><div class="v45-title">สร้างสูตรสินค้าใหม่</div><div class="v45-sub">คำนวณต้นทุน กำไร และ Margin จากวัตถุดิบแบบอัตโนมัติ</div></div>
            </div>
            <button class="v45-close" onclick="v45CloseRecipeModal()"><i class="material-icons-round">close</i></button>
          </div>
          <div class="v45-body" id="v9rec-create">
            <div class="v45-grid">
              <div class="v45-card">
                <div class="v45-section-title"><i class="material-icons-round">inventory_2</i> ข้อมูลสินค้า</div>
                <div class="v45-form-grid">
                  <div class="v45-field"><label>ชื่อสินค้าที่จะผลิต *</label><input id="v9rec-name" placeholder="เช่น เสา 20x20x3, ปูน 240ksc"></div>
                  <div class="v45-field"><label>ประเภท *</label><select id="v9rec-type"><option value="ตามบิล">ตามบิล (ผสมตอนขาย Auto-deduct)</option><option value="ผลิตล่วงหน้า">ผลิตล่วงหน้า (มีสต็อก)</option></select></div>
                  <div class="v45-field"><label>หน่วยสินค้า</label><input id="v9rec-unit" placeholder="ชิ้น, ลบ.ม., ถุง"></div>
                  <div class="v45-field"><label>ราคาขาย (บาท) *</label><input type="number" id="v9rec-price" value="0" min="0" oninput="updateRecipeSummary?.()"></div>
                </div>
                <div class="v45-section-title" style="margin-top:6px"><i class="material-icons-round">format_list_bulleted_add</i> วัตถุดิบในสูตร</div>
                <div id="v9rec-mat-rows" class="v45-mats"></div>
                <button type="button" class="v45-add-row" onclick="v9RecipeAddMat()"><i class="material-icons-round">add</i> เพิ่มวัตถุดิบ</button>
              </div>
              <div class="v45-summary">
                <div class="v45-total"><span>ราคาขายต่อหน่วย</span><b id="v45-rec-price">฿0</b></div>
                <div class="v45-metric"><span>ต้นทุนรวมอัตโนมัติ</span><b id="v9rec-cost-display">฿0</b></div>
                <div class="v45-metric good" id="v45-rec-profit-box"><span>กำไรประมาณการ</span><b id="v45-rec-profit">฿0</b></div>
                <div class="v45-metric"><span>Margin</span><b id="v45-rec-margin">0.0%</b></div>
                <div class="v45-profitbar"><div id="v45-rec-profit-bar"></div></div>
                <div class="v45-card" style="box-shadow:none">
                  <div class="v45-section-title"><i class="material-icons-round">search</i> ค้นหาครอบคลุม</div>
                  <div style="font-size:12px;color:#64748b;line-height:1.8;font-weight:700">ค้นหาวัตถุดิบได้จากชื่อ บาร์โค้ด หน่วย หมวดหมู่ และชนิดสินค้า รายการที่เลือกจะยังส่งค่าเข้า select เดิมเพื่อให้ flow บันทึกสูตรเหมือนเดิม</div>
                </div>
              </div>
            </div>
            <div class="v45-actions">
              <button class="v45-btn" onclick="v45CloseRecipeModal()">ยกเลิก</button>
              <button class="v45-btn primary" onclick="v9RecipeSave()"><i class="material-icons-round">save</i> บันทึกสูตร</button>
            </div>
          </div>
        </div>`;
      document.body.prepend(el);
      el.addEventListener('click', e => { if (e.target === el) window.v45CloseRecipeModal(); });
      requestAnimationFrame(() => document.getElementById('v45-recipe-sheet')?.classList.add('open'));
      window._v9RecipeMatIdx = 0;
      window.v9RecipeAddMat();
      document.getElementById('v9rec-name')?.focus();
      updateRecipeSummary();
    };

    window.updateRecipeSummary = updateRecipeSummary;
    window.v45CloseRecipeModal = function () {
      closeModalById('v45-recipe-modal');
      const inline = document.getElementById('v45-inline-v9rec-create');
      if (inline?.dataset.v45OldRecipeId) {
        inline.id = inline.dataset.v45OldRecipeId;
        delete inline.dataset.v45OldRecipeId;
      }
    };
  }

  function setExpenseMethod(method) {
    const sel = document.getElementById('exp-method');
    if (sel) sel.value = method;
    document.querySelectorAll('.v45-paychip').forEach(btn => btn.classList.toggle('on', btn.dataset.method === method));
    updateExpenseSummary();
  }

  function updateExpenseSummary() {
    const amount = money(document.getElementById('exp-amount')?.value);
    const cat = document.getElementById('exp-cat')?.value || '-';
    const method = document.getElementById('exp-method')?.value || 'เงินสด';
    const desc = document.getElementById('exp-desc')?.value?.trim() || 'ยังไม่ระบุรายการ';
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('v45-exp-grand', '฿' + fmt(amount));
    setText('v45-exp-line-desc', desc);
    setText('v45-exp-line-cat', cat);
    setText('v45-exp-line-method', method);
  }

  function installExpensePopup() {
    if (window.__v45ExpensePopup) return;
    window.__v45ExpensePopup = true;
    window.v45SetExpenseMethod = setExpenseMethod;
    window.v45UpdateExpenseSummary = updateExpenseSummary;

    window.showAddExpenseModal = function () {
      injectStyle();
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      closeModalById('v45-expense-modal');
      const el = document.createElement('div');
      el.id = 'v45-expense-modal';
      el.className = 'v45-modal';
      el.innerHTML = `
        <div class="v45-sheet" id="v45-expense-sheet" style="width:min(980px,96vw)">
          <div class="v45-head v45-exp-head">
            <div class="v45-title-row">
              <div class="v45-icon"><i class="material-icons-round">receipt_long</i></div>
              <div><div class="v45-kicker">Expense Bill</div><div class="v45-title">บันทึกรายจ่ายร้าน</div><div class="v45-sub">กรอกเหมือนบิล เห็นยอดรวมชัด และบันทึกเข้าประวัติรายจ่ายเดิม</div></div>
            </div>
            <button class="v45-close" onclick="document.getElementById('v45-expense-modal')?.remove()"><i class="material-icons-round">close</i></button>
          </div>
          <form id="expense-form" class="v45-body">
            <div class="v45-grid" style="grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr)">
              <div class="v45-card">
                <div class="v45-section-title"><i class="material-icons-round">edit_note</i> รายละเอียดรายจ่าย</div>
                <div class="v45-field"><label>รายการ *</label><input id="exp-desc" placeholder="เช่น ซื้ออุปกรณ์, ค่าน้ำมัน, ค่าอาหาร" required oninput="v45UpdateExpenseSummary()"></div>
                <div class="v45-form-grid">
                  <div class="v45-field"><label>จำนวนเงิน (บาท) *</label><input type="number" id="exp-amount" min="1" required placeholder="0" oninput="v45UpdateExpenseSummary()"></div>
                  <div class="v45-field"><label>หมวดหมู่</label><select id="exp-cat" onchange="v45UpdateExpenseSummary()"><option value="ทั่วไป">ทั่วไป</option><option value="ค่าสาธารณูปโภค">ค่าสาธารณูปโภค</option><option value="ค่าขนส่ง">ค่าขนส่ง</option><option value="ค่าซ่อมบำรุง">ค่าซ่อมบำรุง</option><option value="ค่าอาหาร/เครื่องดื่ม">ค่าอาหาร/เครื่องดื่ม</option><option value="ค่าเงินเดือน">ค่าเงินเดือน</option><option value="ซื้อสินค้า">ซื้อสินค้า</option><option value="อื่นๆ">อื่นๆ</option></select></div>
                </div>
                <div class="v45-field"><label>วิธีชำระ</label><select id="exp-method" style="display:none"><option>เงินสด</option><option>โอนเงิน</option><option>บัตรเครดิต</option></select><div class="v45-paychips"><button type="button" class="v45-paychip on" data-method="เงินสด" onclick="v45SetExpenseMethod('เงินสด')">เงินสด</button><button type="button" class="v45-paychip" data-method="โอนเงิน" onclick="v45SetExpenseMethod('โอนเงิน')">โอนเงิน</button><button type="button" class="v45-paychip" data-method="บัตรเครดิต" onclick="v45SetExpenseMethod('บัตรเครดิต')">บัตรเครดิต</button></div></div>
                <div class="v45-form-grid">
                  <div class="v45-field"><label>วันที่/เวลา</label><input type="datetime-local" id="exp-datetime" value="${local}"></div>
                  <div class="v45-field"><label>หมายเหตุ</label><input id="exp-note" placeholder="เลขที่ใบเสร็จ / รายละเอียดเพิ่ม"></div>
                </div>
              </div>
              <div class="v45-billbox">
                <div class="v45-bill-top"><div><span style="font-size:12px;color:#9a3412;font-weight:900">ยอดสุทธิ</span><b id="v45-exp-grand" style="display:block;font-size:34px;font-weight:950;line-height:1.05">฿0</b></div><i class="material-icons-round" style="font-size:46px;color:#f97316">payments</i></div>
                <div class="v45-bill-lines">
                  <div class="v45-metric"><span>รายการ</span><b id="v45-exp-line-desc" style="font-size:14px;text-align:right">ยังไม่ระบุรายการ</b></div>
                  <div class="v45-metric"><span>หมวดหมู่</span><b id="v45-exp-line-cat">ทั่วไป</b></div>
                  <div class="v45-metric"><span>วิธีชำระ</span><b id="v45-exp-line-method">เงินสด</b></div>
                  <div style="font-size:12px;color:#64748b;line-height:1.8;font-weight:700;background:#f8fafc;border-radius:14px;padding:12px">ตรวจยอดก่อนบันทึก เหมือนดูสรุปท้ายบิล รายการนี้จะไปอยู่ในประวัติรายจ่ายของวันที่เลือกทันที</div>
                </div>
              </div>
            </div>
            <div class="v45-actions">
              <button type="button" class="v45-btn" onclick="document.getElementById('v45-expense-modal')?.remove()">ยกเลิก</button>
              <button type="submit" class="v45-btn primary"><i class="material-icons-round">save</i> บันทึกรายจ่าย</button>
            </div>
          </form>
        </div>`;
      document.body.appendChild(el);
      el.addEventListener('click', e => { if (e.target === el) el.remove(); });
      requestAnimationFrame(() => document.getElementById('v45-expense-sheet')?.classList.add('open'));
      updateExpenseSummary();
      document.getElementById('exp-desc')?.focus();
      document.getElementById('expense-form').onsubmit = async e => {
        e.preventDefault();
        const amount = money(document.getElementById('exp-amount')?.value);
        const desc = document.getElementById('exp-desc')?.value?.trim();
        const cat = document.getElementById('exp-cat')?.value;
        const method = document.getElementById('exp-method')?.value;
        const dt = new Date(document.getElementById('exp-datetime')?.value).toISOString();
        const note = document.getElementById('exp-note')?.value;

        if (!desc) { toast?.('กรุณากรอกรายการ', 'warning'); return; }
        if (amount <= 0) { toast?.('กรุณากรอกจำนวนเงิน', 'warning'); return; }

        if (method === 'เงินสด' && typeof window.v28ExpenseWiz === 'function') {
          let drawer = {};
          if (typeof loadDrawer === 'function') drawer = await loadDrawer().catch(() => ({}));
          
          window.v28ExpenseWiz(amount, drawer, async (res) => {
            try {
              const { data: exp } = await db.from('รายจ่าย').insert({
                description: desc, amount: amount, category: cat, method: method, date: dt, note: note, staff_name: USER?.username
              }).select().single();
              
              const { data: session } = await db.from('cash_session').select('id').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
              if (session) {
                await db.from('cash_transaction').insert({
                  session_id: session.id,
                  type: 'รายจ่าย: ' + desc,
                  direction: 'out',
                  amount: res.outTotal,
                  change_amt: res.inTotal,
                  net_amount: amount,
                  balance_after: 0,
                  ref_id: exp?.id,
                  ref_table: 'รายจ่าย',
                  staff_name: USER?.username,
                  denominations: res.out,
                  change_denominations: res.in
                });
              }
              toast?.('บันทึกรายจ่ายเงินสดและอัปเดตลิ้นชักสำเร็จ', 'success');
              closeModalById('v45-expense-modal');
              loadExpenseData?.();
              if (typeof loadCashBalance === 'function') loadCashBalance();
              if (typeof renderCashDrawer === 'function') renderCashDrawer();
            } catch (err) {
              console.error(err);
              toast?.('เกิดข้อผิดพลาดในการบันทึก: ' + err.message, 'error');
            }
          });
        } else {
          await db.from('รายจ่าย').insert({
            description: desc,
            amount,
            category: cat,
            method,
            date: dt,
            note,
            staff_name: USER?.username
          });
          toast?.('บันทึกรายจ่ายสำเร็จ', 'success');
          closeModalById('v45-expense-modal');
          loadExpenseData?.();
        }
      };
    };
  }

  function debtStaffName() {
    return USER?.username || USER?.name || USER?.email || 'admin';
  }

  function setDebtMethod(method) {
    const sel = document.getElementById('v45-debt-method');
    if (sel) sel.value = method;
    document.querySelectorAll('#v45-debt-modal .v45-paychip').forEach(btn => btn.classList.toggle('on', btn.dataset.method === method));
    updateDebtSummary();
  }

  function updateDebtSummary() {
    const debt = money(document.getElementById('v45-debt-modal')?.dataset.debt);
    const amountEl = document.getElementById('v45-debt-amount');
    const raw = money(amountEl?.value);
    const paid = Math.max(0, Math.min(raw, debt));
    const remaining = Math.max(0, debt - paid);
    const method = document.getElementById('v45-debt-method')?.value || 'เงินสด';
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('v45-debt-pay-preview', '฿' + fmt(paid));
    setText('v45-debt-remain', '฿' + fmt(remaining));
    setText('v45-debt-method-preview', method);
    const remainEl = document.getElementById('v45-debt-remain');
    if (remainEl) remainEl.style.color = remaining > 0 ? '#dc2626' : '#059669';
  }

  async function getOpenCashSession() {
    const { data } = await db.from('cash_session')
      .select('id')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data || null;
  }

  async function refreshDebtViews(customerId) {
    try { if (typeof v9AutoUpdateBillStatus === 'function') await v9AutoUpdateBillStatus(customerId); } catch (_) {}
    try { if (typeof loadCustomerData === 'function') loadCustomerData(); } catch (_) {}
    try { if (typeof renderDebts === 'function') renderDebts(); } catch (_) {}
    try { if (typeof updateHomeStats === 'function') updateHomeStats(); } catch (_) {}
    try { if (typeof loadCashData === 'function') loadCashData(); } catch (_) {}
    try { if (typeof renderCash === 'function') renderCash(); } catch (_) {}
    try { if (typeof updateCashSummary === 'function') updateCashSummary(); } catch (_) {}
  }

  function installDebtPaymentPopup(force = false) {
    if (!force && window.recordDebtPayment?.__v45DebtPopup) return true;
    window.v45SetDebtMethod = setDebtMethod;
    window.v45UpdateDebtSummary = updateDebtSummary;

    window.recordDebtPayment = async function (customerId, name) {
      try {
        injectStyle();
        const { data: cust, error } = await db.from('customer').select('debt_amount,name,phone').eq('id', customerId).maybeSingle();
        if (error) throw error;
        if (!cust) { toast?.('ไม่พบลูกค้า', 'error'); return; }
        const debt = money(cust.debt_amount);
        if (debt <= 0) { toast?.('ลูกค้าไม่มียอดหนี้ค้างชำระ', 'info'); return; }
        const customerName = name || cust.name || 'ลูกค้า';
        closeModalById('v45-debt-modal');
        const el = document.createElement('div');
        el.id = 'v45-debt-modal';
        el.className = 'v45-modal';
        el.dataset.debt = String(debt);
        el.dataset.customerId = String(customerId);
        el.innerHTML = `
          <div class="v45-sheet" id="v45-debt-sheet" style="width:min(980px,96vw)">
            <div class="v45-head v45-debt-head">
              <div class="v45-title-row">
                <div class="v45-icon"><i class="material-icons-round">account_balance_wallet</i></div>
                <div><div class="v45-kicker">Debt Payment</div><div class="v45-title">รับชำระหนี้ลูกค้า</div><div class="v45-sub">หน้าบิลรับชำระ เห็นยอดค้าง ยอดรับ และยอดคงเหลือชัดเจน</div></div>
              </div>
              <button class="v45-close" onclick="document.getElementById('v45-debt-modal')?.remove()"><i class="material-icons-round">close</i></button>
            </div>
            <form id="v45-debt-form" class="v45-body">
              <div class="v45-grid" style="grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr)">
                <div class="v45-card">
                  <div class="v45-section-title"><i class="material-icons-round">person</i> ข้อมูลรับชำระ</div>
                  <div class="v45-billbox" style="margin-bottom:14px">
                    <div class="v45-bill-lines">
                      <div class="v45-metric"><span>ลูกค้า</span><b style="font-size:16px;text-align:right">${safeText(customerName)}</b></div>
                      <div class="v45-metric"><span>เบอร์โทร</span><b>${safeText(cust.phone || '-')}</b></div>
                      <div class="v45-metric"><span>ยอดหนี้คงค้างทั้งหมด</span><b style="color:#dc2626">฿${fmt(debt)}</b></div>
                    </div>
                  </div>
                  <div class="v45-field"><label>ยอดรับชำระ *</label><input class="v45-debt-amount" type="number" id="v45-debt-amount" min="1" max="${debt}" value="${debt}" oninput="v45UpdateDebtSummary()"></div>
                  <div class="v45-field"><label>วิธีชำระ</label><select id="v45-debt-method" style="display:none"><option>เงินสด</option><option>โอนเงิน</option><option>บัตรเครดิต</option></select><div class="v45-paychips"><button type="button" class="v45-paychip on" data-method="เงินสด" onclick="v45SetDebtMethod('เงินสด')">เงินสด</button><button type="button" class="v45-paychip" data-method="โอนเงิน" onclick="v45SetDebtMethod('โอนเงิน')">โอนเงิน</button><button type="button" class="v45-paychip" data-method="บัตรเครดิต" onclick="v45SetDebtMethod('บัตรเครดิต')">บัตรเครดิต</button></div></div>
                  <div class="v45-field"><label>หมายเหตุ</label><input id="v45-debt-note" placeholder="เลขอ้างอิง / รายละเอียดเพิ่ม"></div>
                  <div class="v45-debt-note"><i class="material-icons-round">verified</i><span>ระบบจะลดหนี้ลูกค้า บันทึกประวัติชำระหนี้ และถ้าเลือกเงินสดจะบันทึกเข้าเงินสดหน้าลิ้นชักด้วย</span></div>
                </div>
                <div class="v45-billbox v45-debt-bill">
                  <div class="v45-bill-top"><div><span style="font-size:12px;color:#1d4ed8;font-weight:900">ยอดรับชำระ</span><b id="v45-debt-pay-preview" style="display:block;font-size:38px;font-weight:950;line-height:1.05">฿${fmt(debt)}</b></div><i class="material-icons-round" style="font-size:48px;color:#16a34a">price_check</i></div>
                  <div class="v45-bill-lines">
                    <div class="v45-metric"><span>ยอดหนี้เดิม</span><b>฿${fmt(debt)}</b></div>
                    <div class="v45-metric"><span>วิธีชำระ</span><b id="v45-debt-method-preview">เงินสด</b></div>
                    <div class="v45-metric"><span>ยอดคงเหลือหลังชำระ</span><b id="v45-debt-remain" style="color:#059669">฿0</b></div>
                    <div style="height:10px;background:#e0f2fe;border-radius:999px;overflow:hidden"><div style="height:100%;width:100%;background:linear-gradient(90deg,#2563eb,#16a34a);border-radius:999px"></div></div>
                    <div style="font-size:12px;color:#64748b;line-height:1.8;font-weight:800;background:#f8fafc;border-radius:14px;padding:12px">ตรวจยอดก่อนกดรับชำระ หน้าตานี้ทำงานกับ flow เดิมของลูกหนี้และประวัติชำระหนี้</div>
                  </div>
                </div>
              </div>
              <div class="v45-actions">
                <button type="button" class="v45-btn" onclick="document.getElementById('v45-debt-modal')?.remove()">ยกเลิก</button>
                <button type="submit" class="v45-btn primary"><i class="material-icons-round">payments</i> รับชำระ</button>
              </div>
            </form>
          </div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
        requestAnimationFrame(() => document.getElementById('v45-debt-sheet')?.classList.add('open'));
        updateDebtSummary();
        document.getElementById('v45-debt-amount')?.focus();
        document.getElementById('v45-debt-form').onsubmit = async e => {
          e.preventDefault();
          const paidAmt = Math.max(0, Math.min(money(document.getElementById('v45-debt-amount')?.value), debt));
          const method = document.getElementById('v45-debt-method')?.value || 'เงินสด';
          const note = document.getElementById('v45-debt-note')?.value?.trim();

          if (paidAmt <= 0) { toast?.('กรุณากรอกยอดรับชำระ', 'warning'); return; }
          if (paidAmt > debt) { toast?.('ยอดรับชำระมากกว่ายอดหนี้', 'warning'); return; }

          if (method === 'เงินสด') {
            const session = await getOpenCashSession();
            if (!session) { toast?.('กรุณาเปิดรอบลิ้นชักเงินสดก่อนรับเงินสด', 'warning'); return; }

            if (typeof window.v28DebtPayWiz !== 'function') {
              toast?.('ระบบนับเงินไม่พร้อมใช้งาน (v28)', 'error');
              return;
            }

            // เปิดหน้าจอนับเงินแบบ รับมา-ทอนไป
            window.v28DebtPayWiz(customerId, customerName, paidAmt, async (finalPaid, recvTotal, chgTotal, recvDs, chgDs) => {
              try {
                // 1. อัปเดตยอดหนี้ลูกค้า
                const newDebt = Math.max(0, debt - finalPaid);
                const upd = await db.from('customer').update({ debt_amount: newDebt }).eq('id', customerId);
                if (upd.error) throw upd.error;

                // 2. บันทึกประวัติชำระหนี้
                const { data: pay, error: payError } = await db.from('ชำระหนี้').insert({
                  customer_id: customerId,
                  amount: finalPaid,
                  method,
                  staff_name: debtStaffName(),
                }).select('id').maybeSingle();
                if (payError) throw payError;

                // 3. บันทึกเงินสดลงลิ้นชัก (พร้อมข้อมูลแบงค์)
                if (typeof window.recordCashTx === 'function') {
                  await window.recordCashTx({
                    sessionId: session.id,
                    type: 'รับชำระหนี้',
                    direction: 'in',
                    amount: recvTotal,
                    change_amt: chgTotal,
                    netAmount: finalPaid,
                    refId: pay?.id || null,
                    refTable: 'ชำระหนี้',
                    denominations: recvDs,
                    change_denominations: chgDs,
                    note: `${customerName} ชำระหนี้${note ? ' - ' + note : ''}`,
                  });
                }

                // 4. สรุปผล
                try { if (typeof logActivity === 'function') logActivity('รับชำระหนี้', `${customerName} ฿${fmt(finalPaid)}${newDebt > 0 ? ' เหลือ ฿' + fmt(newDebt) : ' ครบ'}`); } catch (_) {}
                toast?.(`รับชำระสำเร็จ ฿${fmt(finalPaid)}${newDebt > 0 ? ' เหลือหนี้ ฿' + fmt(newDebt) : ' ครบแล้ว'}`, 'success');
                
                closeModalById('v45-debt-modal');
                await refreshDebtViews(customerId);
              } catch (err) {
                console.error('[v45] debt payment wizard error:', err);
                toast?.('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || err), 'error');
              }
            }, true); // true = cashOnly (ให้ v45 จัดการ DB เอง)
          } else {
            // วิธีอื่นๆ (โอน/บัตร)
            const newDebt = Math.max(0, debt - paidAmt);
            const upd = await db.from('customer').update({ debt_amount: newDebt }).eq('id', customerId);
            if (upd.error) throw upd.error;

            const { error: payError } = await db.from('ชำระหนี้').insert({
              customer_id: customerId,
              amount: paidAmt,
              method,
              staff_name: debtStaffName(),
            });
            if (payError) throw payError;

            try { if (typeof logActivity === 'function') logActivity('รับชำระหนี้', `${customerName} ฿${fmt(paidAmt)}${newDebt > 0 ? ' เหลือ ฿' + fmt(newDebt) : ' ครบ'}`); } catch (_) {}
            toast?.(`รับชำระสำเร็จ ฿${fmt(paidAmt)}${newDebt > 0 ? ' เหลือหนี้ ฿' + fmt(newDebt) : ' ครบแล้ว'}`, 'success');
            
            closeModalById('v45-debt-modal');
            await refreshDebtViews(customerId);
          }
        };
      } catch (err) {
        console.error('[v45] debt payment:', err);
        toast?.('รับชำระหนี้ไม่สำเร็จ: ' + (err.message || err), 'error');
      }
    };
    window.recordDebtPayment.__v45DebtPopup = true;
    try { recordDebtPayment = window.recordDebtPayment; } catch (_) {}
    return true;
  }

  function install() {
    injectStyle();
    installRecipePopup();
    installExpensePopup();
    installDebtPaymentPopup(true);
    setTimeout(() => installDebtPaymentPopup(true), 900);
    setTimeout(() => installDebtPaymentPopup(true), 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
