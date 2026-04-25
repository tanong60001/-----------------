/**
 * SK POS — modules-v10.js (โหลดหลัง modules-v9.js)
 *
 * ██████████████████████████████████████████████████████████████████
 *  V10-1  RECEIPT SETTINGS    — ตั้งค่าเอกสารทุกประเภทอย่างละเอียด
 *         80mm / A4 / ใบเสนอราคา / ใบรับเงิน
 *         ตั้งสีหัว, toggle ทุก field, custom text, live preview
 *
 *  V10-2  QUOTATION REDESIGN  — ใบเสนอราคาดีไซน์ใหม่
 *         รองรับสีตั้งเอง + โหมดขาวดำ
 *
 *  V10-3  RETURN / REFUND     — คืนสินค้า เลือกรายการ + จำนวน
 *         คืนสต็อก + หักเงินลิ้นชัก + พิมพ์ใบคืน
 *
 *  V10-4  CANCEL BILL FIX     — ยกเลิกบิล → คืนสต็อก + หัก cash
 *
 *  V10-5  A4 RECEIPT REDESIGN — ใบเสร็จ A4 สไตล์เดียวกับใบเสนอราคา
 *
 *  V10-6  PAYMENT RECEIPT     — ใบรับเงิน (ชำระหนี้)
 *
 *  V10-7  RETURN SLIP PRINT   — พิมพ์ใบคืนสินค้า
 * ██████████████████████████████████████████████████████████████████
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// UTIL: ดึง / บันทึก doc_settings จาก ตั้งค่าร้านค้า
// ══════════════════════════════════════════════════════════════════

const V10_DEFAULTS = {
  receipt_80mm: {
    show_shop_name:true, show_address:true, show_tax_id:true,
    show_bill_no:true, show_customer:true, show_staff:true,
    show_cost:false, show_profit:false, show_discount:true,
    show_received:true, show_change:true, show_qr:true,
    show_datetime:true, show_method:true,
    header_text:'', footer_text:'ขอบคุณที่ใช้บริการ', note_text:''
  },
  receipt_a4: {
    show_shop_name:true, show_address:true, show_tax_id:true,
    show_bill_no:true, show_customer:true, show_staff:true,
    show_cost:false, show_profit:false, show_discount:true,
    show_received:true, show_change:true, show_qr:true,
    show_datetime:true, show_method:true,
    header_text:'ใบเสร็จรับเงิน / ใบกำกับภาษี', footer_text:'ขอบคุณที่ใช้บริการ',
    note_text:'สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน',
    header_color:'#af101a', bw_mode:false
  },
  quotation: {
    show_shop_name:true, show_address:true, show_tax_id:true,
    show_customer:true, show_staff:true, show_discount:true,
    show_validity:true, show_note:true, show_signature:true,
    header_text:'ใบเสนอราคา', footer_text:'', note_text:'',
    header_color:'#1e293b', bw_mode:false
  },
  payment_receipt: {
    show_shop_name:true, show_address:true, show_tax_id:true,
    show_customer:true, show_staff:true,
    show_datetime:true, show_method:true,
    header_text:'ใบรับเงิน', footer_text:'ขอบคุณที่ใช้บริการ', note_text:'',
    header_color:'#1e293b', bw_mode:false
  }
};

let _v10DocSettings = null;

async function v10GetDocSettings() {
  if (_v10DocSettings) return _v10DocSettings;
  try {
    const { data, error } = await db.from('ตั้งค่าร้านค้า').select('doc_settings').limit(1).maybeSingle();
    if (error) {
      console.warn('[v10] doc_settings column missing. Run SQL: ALTER TABLE ตั้งค่าร้านค้า ADD COLUMN IF NOT EXISTS doc_settings jsonb DEFAULT \'{}\';');
      _v10DocSettings = {};
    } else {
      _v10DocSettings = data?.doc_settings ? (typeof data.doc_settings === 'string' ? JSON.parse(data.doc_settings) : data.doc_settings) : {};
    }
  } catch(_) { _v10DocSettings = {}; }
  // merge defaults
  for (const k of Object.keys(V10_DEFAULTS)) {
    _v10DocSettings[k] = { ...V10_DEFAULTS[k], ...(_v10DocSettings[k]||{}) };
  }
  return _v10DocSettings;
}

async function v10SaveDocSettings(settings) {
  _v10DocSettings = settings;
  try {
    const { data: ex } = await db.from('ตั้งค่าร้านค้า').select('id').limit(1).maybeSingle();
    if (ex) {
      const { error } = await db.from('ตั้งค่าร้านค้า').update({ doc_settings: settings, updated_at: new Date().toISOString() }).eq('id', ex.id);
      if (error) {
        console.error('[v10] Cannot save doc_settings:', error.message, '— Run SQL: ALTER TABLE ตั้งค่าร้านค้า ADD COLUMN IF NOT EXISTS doc_settings jsonb DEFAULT \'{}\';');
        typeof toast === 'function' && toast('ต้องเพิ่มคอลัมน์ doc_settings ก่อน (ดู console)', 'warning');
      }
    }
  } catch(e) { console.error('[v10] save error:', e.message); }
}

async function v10GetShopConfig() {
  try {
    const { data } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).maybeSingle();
    return data || {};
  } catch(_) { return {}; }
}

function v10Staff() {
  try { return USER?.username || 'system'; } catch(_) { return 'system'; }
}

// ══════════════════════════════════════════════════════════════════
// V10-1: RECEIPT SETTINGS ADMIN — ตั้งค่าเอกสารทุกประเภท
// ══════════════════════════════════════════════════════════════════

// Override renderAdmin → เรียก v9 ก่อน แล้ว inject ปุ่ม "เอกสาร/ใบเสร็จ" ด้วย DOM
const _v10OrigRenderAdmin = window.renderAdmin;
window.renderAdmin = async function () {
  console.log('[v10] renderAdmin called');
  if (_v10OrigRenderAdmin) await _v10OrigRenderAdmin();
  // หา tab bar จาก v9 — ลอง 3 วิธี
  let tabBar = document.querySelector('#page-admin [style*="border-bottom"] > div');
  if (!tabBar) tabBar = document.querySelector('#page-admin div[style*="display:flex"][style*="min-width"]');
  if (!tabBar) {
    // fallback: หา parent ของ v9atab-shop
    const shopTab = document.getElementById('v9atab-shop');
    if (shopTab) tabBar = shopTab.parentElement;
  }
  console.log('[v10] tabBar found:', !!tabBar, tabBar?.children?.length, 'existing buttons');
  if (tabBar && !document.getElementById('v9atab-docs')) {
    const btn = document.createElement('button');
    btn.id = 'v9atab-docs';
    btn.setAttribute('onclick', "v9RenderAdminTab('docs')");
    btn.style.cssText = 'padding:12px 16px;border:none;background:none;cursor:pointer;font-family:var(--font-thai,Prompt),sans-serif;font-size:13px;border-bottom:2px solid transparent;color:var(--text-secondary);font-weight:400;display:flex;align-items:center;gap:5px;white-space:nowrap;transition:all .15s;';
    btn.innerHTML = '<i class="material-icons-round" style="font-size:16px;">description</i>เอกสาร/ใบเสร็จ';
    tabBar.appendChild(btn);
  }
};

const _v10OrigV9AdminTab = window.v9RenderAdminTab;
window.v9RenderAdminTab = async function (key) {
  const docsBtn = document.getElementById('v9atab-docs');
  if (key === 'docs') {
    document.querySelectorAll('[id^="v9atab-"]').forEach(b => {
      b.style.borderBottomColor = 'transparent';
      b.style.color = 'var(--text-secondary)';
      b.style.fontWeight = '400';
    });
    if (docsBtn) { docsBtn.style.borderBottomColor = 'var(--primary)'; docsBtn.style.color = 'var(--primary)'; docsBtn.style.fontWeight = '700'; }
    const c = document.getElementById('v9-admin-content');
    if (c) await v10RenderDocSettingsInto(c);
    return;
  }
  if (docsBtn) { docsBtn.style.borderBottomColor = 'transparent'; docsBtn.style.color = 'var(--text-secondary)'; docsBtn.style.fontWeight = '400'; }
  if (_v10OrigV9AdminTab) await _v10OrigV9AdminTab(key);
};
window.renderAdminTabs = function (key) { window.v9RenderAdminTab(key); };

let _v10ActiveDocTab = 'receipt_80mm';

async function v10RenderDocSettingsInto(container) {
  if (!container) return;
  const settings = await v10GetDocSettings();
  const tabs = [
    { key:'receipt_80mm', label:'ใบเสร็จ 80mm', icon:'receipt' },
    { key:'receipt_a4', label:'ใบเสร็จ A4', icon:'description' },
    { key:'quotation', label:'ใบเสนอราคา', icon:'request_quote' },
    { key:'payment_receipt', label:'ใบรับเงิน', icon:'payments' }
  ];
  const s = settings[_v10ActiveDocTab] || {};

  container.innerHTML = `
    <!-- Doc Type Sub-tabs -->
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border-light);margin-bottom:20px;">
      ${tabs.map(t => `
        <button onclick="_v10ActiveDocTab='${t.key}';v9RenderAdminTab('docs')"
          style="padding:10px 16px;border:none;background:none;cursor:pointer;font-family:var(--font-thai);font-size:13px;
            border-bottom:2px solid ${_v10ActiveDocTab===t.key?'var(--primary)':'transparent'};margin-bottom:-2px;
            color:${_v10ActiveDocTab===t.key?'var(--primary)':'var(--text-secondary)'};
            font-weight:${_v10ActiveDocTab===t.key?'700':'400'};white-space:nowrap;display:flex;align-items:center;gap:5px;">
          <i class="material-icons-round" style="font-size:16px;">${t.icon}</i>${t.label}
        </button>`).join('')}
    </div>

    <div id="v10-doc-content" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <!-- Left: Toggles -->
      <div>
        <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;">ข้อมูลที่แสดง</h4>
        <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);overflow:hidden;" id="v10-toggles"></div>

        ${_v10ActiveDocTab !== 'receipt_80mm' ? `
        <h4 style="font-size:14px;font-weight:600;margin:16px 0 8px;">สีหัวเอกสาร</h4>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${['#1e293b','#dc2626','#1d4ed8','#15803d','#7c3aed','#000000'].map(c => `
            <div onclick="v10SetHeaderColor('${c}')" style="width:36px;height:36px;border-radius:50%;background:${c};cursor:pointer;
              border:3px solid ${(s.header_color||'#1e293b')===c?'var(--primary)':'transparent'};"></div>`).join('')}
          <input type="color" id="v10-custom-color" value="${s.header_color||'#1e293b'}"
            onchange="v10SetHeaderColor(this.value)" style="width:36px;height:36px;padding:2px;cursor:pointer;border-radius:50%;">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);cursor:pointer;margin-left:8px;">
            <input type="checkbox" id="v10-bw-mode" ${s.bw_mode?'checked':''}
              onchange="v10ToggleBW(this.checked)" style="width:16px;height:16px;">
            โหมดขาวดำ (B&W)
          </label>
        </div>` : ''}

        <h4 style="font-size:14px;font-weight:600;margin:16px 0 8px;">ข้อความกำหนดเอง</h4>
        <div class="form-group" style="margin-bottom:8px;">
          <label class="form-label" style="font-size:12px;">หัวเอกสาร</label>
          <input class="form-input" id="v10-header-text" value="${s.header_text||''}" placeholder="ข้อความบรรทัดบนสุด..."
            oninput="v10UpdatePreview()">
        </div>
        <div class="form-group" style="margin-bottom:8px;">
          <label class="form-label" style="font-size:12px;">ท้ายเอกสาร</label>
          <input class="form-input" id="v10-footer-text" value="${s.footer_text||''}" placeholder="ขอบคุณที่ใช้บริการ"
            oninput="v10UpdatePreview()">
        </div>
        <div class="form-group" style="margin-bottom:8px;">
          <label class="form-label" style="font-size:12px;">หมายเหตุ / เงื่อนไข</label>
          <textarea class="form-input" id="v10-note-text" placeholder="สินค้าซื้อแล้วไม่รับเปลี่ยนคืน..."
            oninput="v10UpdatePreview()" style="min-height:50px;">${s.note_text||''}</textarea>
        </div>

        <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="v10SaveCurrentSettings()">
          <i class="material-icons-round">save</i> บันทึกตั้งค่า
        </button>
      </div>

      <!-- Right: Live Preview -->
      <div>
        <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;">ตัวอย่าง (Live Preview)</h4>
        <div style="background:var(--bg-base);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
          <div id="v10-preview" style="transform-origin:top center;"></div>
        </div>
      </div>
    </div>`;

  v10BuildToggles(s);
  v10UpdatePreview();
}

function v10BuildToggles(s) {
  const container = document.getElementById('v10-toggles');
  if (!container) return;

  const fields = {
    receipt_80mm: [
      ['show_shop_name','ชื่อร้าน'],['show_address','ที่อยู่ร้าน'],['show_tax_id','เลขผู้เสียภาษี'],
      ['show_bill_no','เลขที่บิล'],['show_customer','ชื่อลูกค้า'],['show_staff','ชื่อพนักงาน'],
      ['show_datetime','วันที่ / เวลา'],['show_method','วิธีชำระเงิน'],
      ['show_discount','ส่วนลด'],['show_received','เงินรับ / เงินทอน'],['show_change','เงินทอน'],
      ['show_cost','ต้นทุนสินค้า'],['show_profit','กำไรขั้นต้น'],
      ['show_qr','QR PromptPay']
    ],
    receipt_a4: [
      ['show_shop_name','ชื่อร้าน'],['show_address','ที่อยู่ร้าน'],['show_tax_id','เลขผู้เสียภาษี'],
      ['show_bill_no','เลขที่บิล'],['show_customer','ชื่อลูกค้า'],['show_staff','ชื่อพนักงาน'],
      ['show_datetime','วันที่ / เวลา'],['show_method','วิธีชำระเงิน'],
      ['show_discount','ส่วนลด'],['show_received','เงินรับ / เงินทอน'],['show_change','เงินทอน'],
      ['show_cost','ต้นทุนสินค้า'],['show_profit','กำไรขั้นต้น'],['show_qr','QR PromptPay']
    ],
    quotation: [
      ['show_shop_name','ชื่อร้าน'],['show_address','ที่อยู่ร้าน'],['show_tax_id','เลขผู้เสียภาษี'],
      ['show_customer','ชื่อลูกค้า'],['show_staff','ผู้ออกเอกสาร'],
      ['show_discount','ส่วนลด'],['show_validity','วันหมดอายุ'],
      ['show_note','หมายเหตุ'],['show_signature','ช่องลายเซ็น']
    ],
    payment_receipt: [
      ['show_shop_name','ชื่อร้าน'],['show_address','ที่อยู่ร้าน'],['show_tax_id','เลขผู้เสียภาษี'],
      ['show_customer','ชื่อลูกค้า'],['show_staff','ชื่อพนักงาน'],
      ['show_datetime','วันที่ / เวลา'],['show_method','วิธีชำระ']
    ]
  };

  const list = fields[_v10ActiveDocTab] || [];
  container.innerHTML = list.map(([key, label]) => {
    const on = s[key] !== false;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:0.5px solid var(--border-light);">
      <span style="font-size:13px;color:var(--text-primary);">${label}</span>
      <label style="position:relative;display:inline-block;width:38px;height:22px;cursor:pointer;">
        <input type="checkbox" data-key="${key}" ${on?'checked':''}
          onchange="v10ToggleField('${key}',this.checked)"
          style="opacity:0;width:0;height:0;">
        <span style="position:absolute;inset:0;border-radius:22px;transition:.2s;
          background:${on?'var(--primary)':'#CBD5E1'};"></span>
        <span style="position:absolute;top:2px;${on?'right':'left'}:2px;width:18px;height:18px;border-radius:50%;
          background:#fff;transition:.2s;box-shadow:0 1px 2px rgba(0,0,0,.15);"></span>
      </label>
    </div>`;
  }).join('');
}

window.v10ToggleField = async function(key, val) {
  const settings = await v10GetDocSettings();
  settings[_v10ActiveDocTab][key] = val;
  _v10DocSettings = settings;
  v10UpdatePreview();
};

window.v10SetHeaderColor = async function(color) {
  const settings = await v10GetDocSettings();
  settings[_v10ActiveDocTab].header_color = color;
  settings[_v10ActiveDocTab].bw_mode = false;
  _v10DocSettings = settings;
  v9RenderAdminTab('docs');
};

window.v10ToggleBW = async function(on) {
  const settings = await v10GetDocSettings();
  settings[_v10ActiveDocTab].bw_mode = on;
  if (on) settings[_v10ActiveDocTab].header_color = '#000000';
  _v10DocSettings = settings;
  v9RenderAdminTab('docs');
};

window.v10SaveCurrentSettings = async function() {
  const settings = await v10GetDocSettings();
  const s = settings[_v10ActiveDocTab];
  s.header_text = document.getElementById('v10-header-text')?.value || '';
  s.footer_text = document.getElementById('v10-footer-text')?.value || '';
  s.note_text = document.getElementById('v10-note-text')?.value || '';
  await v10SaveDocSettings(settings);
  typeof toast === 'function' && toast('บันทึกตั้งค่าเอกสารสำเร็จ', 'success');
};

function v10UpdatePreview() {
  const el = document.getElementById('v10-preview');
  if (!el) return;
  const settings = _v10DocSettings || {};
  const s = settings[_v10ActiveDocTab] || V10_DEFAULTS[_v10ActiveDocTab];
  // read live inputs
  const hText = document.getElementById('v10-header-text')?.value ?? s.header_text;
  const fText = document.getElementById('v10-footer-text')?.value ?? s.footer_text;
  const color = s.header_color || '#1e293b';
  const bw = s.bw_mode;
  const hc = bw ? '#000' : color;

  if (_v10ActiveDocTab === 'receipt_80mm') {
    el.innerHTML = v10Preview80mm(s, hText, fText);
  } else if (_v10ActiveDocTab === 'receipt_a4') {
    el.innerHTML = v10PreviewA4(s, hText, fText, hc);
  } else if (_v10ActiveDocTab === 'quotation') {
    el.innerHTML = v10PreviewQuotation(s, hText, fText, hc);
  } else {
    el.innerHTML = v10PreviewPaymentReceipt(s, hText, fText, hc);
  }
}

function v10Preview80mm(s, hText, fText) {
  return `<div style="background:#fff;border-radius:6px;padding:10px;font-family:'Courier New',monospace;font-size:9px;color:#000;max-width:220px;margin:0 auto;line-height:1.6;">
    ${hText ? `<div style="text-align:center;font-size:8px;margin-bottom:2px;">${hText}</div>` : ''}
    ${s.show_shop_name!==false ? '<div style="text-align:center;font-weight:700;font-size:10px;">หจก. เอส เค วัสดุ</div>' : ''}
    ${s.show_address!==false ? '<div style="text-align:center;font-size:8px;color:#666;">ที่อยู่ร้านค้า</div>' : ''}
    ${s.show_tax_id!==false ? '<div style="text-align:center;font-size:8px;color:#666;">TAX: 046-355-8000-486</div>' : ''}
    <div style="border-top:1px dashed #ccc;margin:4px 0;"></div>
    ${s.show_bill_no!==false ? '<div>บิล #1042</div>' : ''}
    ${s.show_datetime!==false ? '<div>23/03/69 14:30</div>' : ''}
    ${s.show_customer!==false ? '<div>ลูกค้า: คิง</div>' : ''}
    ${s.show_staff!==false ? '<div>พนง: admin</div>' : ''}
    <div style="border-top:1px dashed #ccc;margin:4px 0;"></div>
    <div style="display:flex;justify-content:space-between;"><span>ปูน 240 x3</span><span>฿960</span></div>
    <div style="display:flex;justify-content:space-between;"><span>ปูน 250 x2</span><span>฿460</span></div>
    <div style="border-top:1px dashed #ccc;margin:4px 0;"></div>
    ${s.show_discount!==false ? '<div style="display:flex;justify-content:space-between;"><span>ส่วนลด</span><span>-฿0</span></div>' : ''}
    <div style="display:flex;justify-content:space-between;font-weight:700;"><span>ยอดรวม</span><span>฿1,420</span></div>
    ${s.show_received!==false ? '<div style="display:flex;justify-content:space-between;"><span>รับมา</span><span>฿1,500</span></div>' : ''}
    ${s.show_change!==false ? '<div style="display:flex;justify-content:space-between;"><span>เงินทอน</span><span>฿80</span></div>' : ''}
    ${s.show_method!==false ? '<div>วิธีชำระ: เงินสด</div>' : ''}
    ${s.show_cost!==false ? '<div style="color:#666;">ต้นทุน: ฿980</div>' : ''}
    ${s.show_profit!==false ? '<div style="color:#16a34a;">กำไร: ฿440</div>' : ''}
    ${s.show_qr!==false ? '<div style="text-align:center;margin:4px 0;"><div style="width:50px;height:50px;background:#f0f0f0;margin:0 auto;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:7px;color:#999;">QR</div></div>' : ''}
    <div style="border-top:1px dashed #ccc;margin:4px 0;"></div>
    ${fText ? `<div style="text-align:center;font-size:8px;">${fText}</div>` : ''}
  </div>`;
}

function v10PreviewA4(s, hText, fText, hc) {
  return `<div style="background:#fff;border-radius:6px;font-size:8px;color:#000;overflow:hidden;transform:scale(0.85);transform-origin:top center;">
    <div style="background:${hc};color:#fff;padding:12px 14px;display:flex;justify-content:space-between;">
      <div>
        ${s.show_shop_name!==false ? '<div style="font-weight:700;font-size:11px;">หจก. เอส เค วัสดุ</div>' : ''}
        ${s.show_address!==false ? '<div style="opacity:.8;font-size:7px;">ที่อยู่ร้านค้า</div>' : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;font-size:9px;">${hText || 'ใบเสร็จรับเงิน'}</div>
        ${s.show_bill_no!==false ? '<div style="opacity:.8;font-size:7px;">#1042</div>' : ''}
      </div>
    </div>
    <div style="padding:10px 14px;">
      <div style="display:flex;justify-content:space-between;font-size:7px;color:#666;margin-bottom:6px;">
        ${s.show_customer!==false ? '<span>ลูกค้า: คิง</span>' : ''}
        ${s.show_datetime!==false ? '<span>23 มี.ค. 2569</span>' : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:7px;">
        <thead><tr style="background:${hc};color:#fff;"><th style="padding:3px 4px;text-align:left;">#</th><th style="text-align:left;padding:3px;">รายการ</th><th style="padding:3px;text-align:right;">รวม</th></tr></thead>
        <tbody>
          <tr><td style="padding:3px 4px;">1</td><td style="padding:3px;">ปูน 240 x3</td><td style="padding:3px;text-align:right;">฿960</td></tr>
          <tr style="background:#fafafa;"><td style="padding:3px 4px;">2</td><td style="padding:3px;">ปูน 250 x2</td><td style="padding:3px;text-align:right;">฿460</td></tr>
        </tbody>
      </table>
      <div style="text-align:right;margin-top:4px;">
        <div style="font-weight:700;font-size:9px;">ยอดรวม ฿1,420</div>
        ${s.show_received!==false ? '<div style="font-size:7px;color:#666;">รับ ฿1,500 ทอน ฿80</div>' : ''}
      </div>
      ${fText ? `<div style="text-align:center;margin-top:6px;font-size:7px;color:#999;">${fText}</div>` : ''}
    </div>
  </div>`;
}

function v10PreviewQuotation(s, hText, fText, hc) {
  return `<div style="background:#fff;border-radius:6px;font-size:8px;color:#000;overflow:hidden;transform:scale(0.85);transform-origin:top center;">
    <div style="background:${hc};color:#fff;padding:12px 14px;display:flex;justify-content:space-between;">
      <div>
        ${s.show_shop_name!==false ? '<div style="font-weight:700;font-size:11px;">หจก. เอส เค วัสดุ</div>' : ''}
        ${s.show_address!==false ? '<div style="opacity:.8;font-size:7px;">ที่อยู่ร้านค้า</div>' : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;font-size:9px;">${hText || 'ใบเสนอราคา'}</div>
        <div style="opacity:.8;font-size:7px;">QT-9C397C</div>
      </div>
    </div>
    <div style="padding:10px 14px;">
      <div style="display:flex;gap:8px;margin-bottom:6px;">
        ${s.show_customer!==false ? '<div style="flex:1;background:#f8fafc;border-radius:4px;padding:4px 6px;border-left:2px solid '+hc+';"><div style="font-size:6px;color:#999;">เสนอให้</div><div style="font-weight:700;">คิง</div></div>' : ''}
        ${s.show_staff!==false ? '<div style="flex:1;background:#f8fafc;border-radius:4px;padding:4px 6px;border-left:2px solid '+hc+';"><div style="font-size:6px;color:#999;">ออกโดย</div><div style="font-weight:700;">admin</div></div>' : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:7px;">
        <thead><tr style="background:${hc};color:#fff;"><th style="padding:3px;text-align:left;">#</th><th style="text-align:left;padding:3px;">รายการ</th><th style="padding:3px;text-align:right;">รวม</th></tr></thead>
        <tbody>
          <tr><td style="padding:3px;">1</td><td style="padding:3px;">ปูน 240</td><td style="padding:3px;text-align:right;">฿320</td></tr>
          <tr style="background:#fafafa;"><td style="padding:3px;">2</td><td style="padding:3px;">ปูน 250</td><td style="padding:3px;text-align:right;">฿230</td></tr>
        </tbody>
      </table>
      <div style="text-align:right;margin-top:4px;font-weight:700;font-size:9px;">ยอดรวม ฿550</div>
      ${s.show_signature!==false ? '<div style="display:flex;gap:20px;margin-top:8px;"><div style="flex:1;text-align:center;border-bottom:1px solid #ddd;padding-bottom:2px;font-size:6px;color:#999;">ผู้เสนอราคา</div><div style="flex:1;text-align:center;border-bottom:1px solid #ddd;padding-bottom:2px;font-size:6px;color:#999;">ลูกค้า</div></div>' : ''}
    </div>
  </div>`;
}

function v10PreviewPaymentReceipt(s, hText, fText, hc) {
  return `<div style="background:#fff;border-radius:6px;font-size:8px;color:#000;overflow:hidden;transform:scale(0.85);transform-origin:top center;">
    <div style="background:${hc};color:#fff;padding:12px 14px;display:flex;justify-content:space-between;">
      <div>
        ${s.show_shop_name!==false ? '<div style="font-weight:700;font-size:11px;">หจก. เอส เค วัสดุ</div>' : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;font-size:9px;">${hText || 'ใบรับเงิน'}</div>
      </div>
    </div>
    <div style="padding:10px 14px;">
      ${s.show_customer!==false ? '<div style="margin-bottom:4px;">ลูกค้า: <strong>คิง</strong></div>' : ''}
      <div style="background:#f0fdf4;border-radius:4px;padding:6px;text-align:center;margin:6px 0;">
        <div style="font-size:7px;color:#666;">ยอดรับชำระ</div>
        <div style="font-size:14px;font-weight:700;color:#15803d;">฿5,000</div>
      </div>
      ${s.show_method!==false ? '<div style="font-size:7px;color:#666;">วิธีชำระ: เงินสด</div>' : ''}
      ${fText ? `<div style="text-align:center;margin-top:6px;font-size:7px;color:#999;">${fText}</div>` : ''}
    </div>
  </div>`;
}


// ══════════════════════════════════════════════════════════════════
// V10-2: QUOTATION PRINT REDESIGN — สีตั้งเองได้ + ขาวดำ
// ══════════════════════════════════════════════════════════════════

window.v9PrintQuotation = async function(quotId) {
  if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังเตรียมพิมพ์...');
  try {
    const [{ data: quot }, { data: items }, rc, ds] = await Promise.all([
      db.from('ใบเสนอราคา').select('*').eq('id', quotId).maybeSingle(),
      db.from('รายการใบเสนอราคา').select('*').eq('quotation_id', quotId),
      v10GetShopConfig(),
      v10GetDocSettings()
    ]);
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    if (!quot) { typeof toast === 'function' && toast('ไม่พบข้อมูล', 'error'); return; }

    const s = ds.quotation || V10_DEFAULTS.quotation;
    const hc = s.bw_mode ? '#000' : (s.header_color || '#1e293b');
    const shopName = rc?.shop_name || 'SK POS';
    const shopAddr = rc?.address || '';
    const shopPhone = rc?.phone || '';
    const shopTax = rc?.tax_id || '';
    const qtId = `QT-${String(quotId).slice(-6).toUpperCase()}`;
    const subtotal = (items || []).reduce((sum, i) => sum + parseFloat(i.total || 0), 0);
    const discount = parseFloat(quot.discount || 0);
    const total = parseFloat(quot.total || 0);
    const dateStr = new Date(quot.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const validStr = quot.valid_until ? new Date(quot.valid_until).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    const rows = (items || []).map((it, idx) => `
      <tr${idx % 2 === 1 ? ' style="background:#f9fafb;"' : ''}>
        <td style="padding:11px 12px;text-align:center;color:#94a3b8;font-size:12px;">${idx + 1}</td>
        <td style="padding:11px 12px;font-weight:500;font-size:13px;">${it.name || ''}</td>
        <td style="padding:11px 12px;text-align:center;font-size:12px;">${it.qty || 1}</td>
        <td style="padding:11px 12px;text-align:center;font-size:12px;color:#64748b;">${it.unit || 'ชิ้น'}</td>
        <td style="padding:11px 12px;text-align:right;font-size:12px;">฿${formatNum(parseFloat(it.price || 0))}</td>
        <td style="padding:11px 12px;text-align:right;font-weight:700;font-size:13px;color:${hc};">฿${formatNum(parseFloat(it.total || 0))}</td>
      </tr>`).join('');

    const w = window.open('', '_blank', 'width=860,height=1050');
    w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>ใบเสนอราคา ${qtId}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{size:A4 portrait;margin:10mm 14mm;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Sarabun',sans-serif;font-size:13px;color:#1e293b;background:#fff;}
  @media print{body{background:#fff;}}
</style></head><body>

<!-- HEADER -->
<div style="background:${hc};color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start;">
  <div>
    ${s.show_shop_name !== false ? `<div style="font-size:22px;font-weight:800;margin-bottom:4px;">${shopName}</div>` : ''}
    <div style="font-size:11px;opacity:.82;line-height:1.7;">
      ${s.show_address !== false && shopAddr ? shopAddr + '<br>' : ''}
      ${shopPhone ? 'โทร ' + shopPhone : ''}
      ${s.show_tax_id !== false && shopTax ? '<br>เลขผู้เสียภาษี ' + shopTax : ''}
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:18px;font-weight:800;letter-spacing:.5px;">${s.header_text || 'ใบเสนอราคา'}</div>
    <div style="font-size:13px;opacity:.9;margin-top:4px;font-weight:600;">${qtId}</div>
    <div style="font-size:11px;opacity:.75;margin-top:3px;line-height:1.6;">
      วันที่ ${dateStr}
      ${s.show_staff !== false && quot.staff_name ? '<br>ออกโดย ' + quot.staff_name : ''}
      ${s.show_validity !== false && validStr ? '<br>หมดอายุ <span style="color:#fca5a5;font-weight:600;">' + validStr + '</span>' : ''}
    </div>
  </div>
</div>

<!-- BODY -->
<div style="padding:24px 32px;">

  <!-- Info boxes -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px;">
    ${s.show_customer !== false ? `<div style="background:#f8fafc;border-radius:10px;padding:14px 16px;border-left:3px solid ${hc};">
      <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;font-weight:600;">เสนอให้</div>
      <div style="font-size:15px;font-weight:700;">${quot.customer_name || '-'}</div>
    </div>` : ''}
    ${s.show_staff !== false ? `<div style="background:#f8fafc;border-radius:10px;padding:14px 16px;border-left:3px solid ${hc};">
      <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;font-weight:600;">ออกโดย</div>
      <div style="font-size:15px;font-weight:700;">${quot.staff_name || shopName}</div>
      ${validStr && s.show_validity !== false ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">หมดอายุ ${validStr}</div>` : ''}
    </div>` : ''}
  </div>

  <!-- Table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <thead>
      <tr style="background:${hc};">
        <th style="color:#fff;padding:10px 12px;font-size:11px;font-weight:700;text-align:center;border-radius:8px 0 0 0;width:36px;">#</th>
        <th style="color:#fff;padding:10px 12px;font-size:11px;font-weight:700;text-align:left;">รายการสินค้า / บริการ</th>
        <th style="color:#fff;padding:10px 12px;font-size:11px;font-weight:700;text-align:center;width:70px;">จำนวน</th>
        <th style="color:#fff;padding:10px 12px;font-size:11px;font-weight:700;text-align:center;width:60px;">หน่วย</th>
        <th style="color:#fff;padding:10px 12px;font-size:11px;font-weight:700;text-align:right;width:100px;">ราคา/หน่วย</th>
        <th style="color:#fff;padding:10px 12px;font-size:11px;font-weight:700;text-align:right;border-radius:0 8px 0 0;width:110px;">รวม</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">ไม่มีรายการ</td></tr>'}
    </tbody>
  </table>

  <!-- Summary -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:22px;">
    <div style="width:250px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">
        <span>ราคารวม</span><span>฿${formatNum(subtotal)}</span>
      </div>
      ${discount > 0 && s.show_discount !== false ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#ef4444;">
        <span>ส่วนลด</span><span>-฿${formatNum(discount)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:12px 16px;margin-top:8px;background:${hc};border-radius:10px;color:#fff;">
        <span style="font-size:14px;font-weight:700;">ยอดรวมทั้งสิ้น</span>
        <span style="font-size:18px;font-weight:800;">฿${formatNum(total)}</span>
      </div>
    </div>
  </div>

  ${quot.note && s.show_note !== false ? `<div style="background:#fef3c7;border-radius:8px;padding:10px 14px;font-size:11px;color:#92400e;margin-bottom:16px;">📌 ${quot.note}</div>` : ''}
  ${validStr && s.show_validity !== false ? `<div style="text-align:center;font-size:12px;color:#94a3b8;margin-bottom:20px;">ใบเสนอราคานี้มีอายุถึง <strong style="color:${hc};">${validStr}</strong></div>` : ''}

  ${s.show_signature !== false ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:24px;">
    <div style="text-align:center;"><div style="height:56px;border-bottom:1px solid #cbd5e1;margin-bottom:6px;"></div><div style="font-size:11px;color:#94a3b8;">ลายเซ็นผู้เสนอราคา</div></div>
    <div style="text-align:center;"><div style="height:56px;border-bottom:1px solid #cbd5e1;margin-bottom:6px;"></div><div style="font-size:11px;color:#94a3b8;">ลายเซ็นลูกค้า</div></div>
  </div>` : ''}

  ${s.footer_text ? `<div style="text-align:center;margin-top:20px;font-size:11px;color:#94a3b8;">${s.footer_text}</div>` : ''}
</div>

<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1200);}<\/script>
</body></html>`);
    w.document.close();
  } catch (e) {
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    typeof toast === 'function' && toast('พิมพ์ไม่ได้: ' + (e.message || e), 'error');
  }
};



// ══════════════════════════════════════════════════════════════════
// V10-3: RETURN / REFUND — คืนสินค้า (Unit Conversion + Previous Returns)
// ══════════════════════════════════════════════════════════════════

window.v10ShowReturnModal = async function(billId) {
  if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังโหลด...');
  try {
    const [{ data: bill }, { data: items }] = await Promise.all([
      db.from('บิลขาย').select('*').eq('id', billId).maybeSingle(),
      db.from('รายการในบิล').select('*').eq('bill_id', billId)
    ]);
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    if (!bill) { typeof toast === 'function' && toast('ไม่พบบิลนี้', 'error'); return; }
    if (bill.status === 'ยกเลิก') { typeof toast === 'function' && toast('บิลนี้ถูกยกเลิกแล้ว', 'error'); return; }

    // ดึง previous return info
    const prevReturns = bill.return_info?.return_items || [];

    // ดึง conv_rate สำหรับทุก product
    const productIds = [...new Set((items || []).map(it => it.product_id).filter(Boolean))];
    let unitMap = {};
    if (productIds.length > 0) {
      try {
        const { data: units } = await db.from('product_units').select('product_id,unit_name,conv_rate').in('product_id', productIds);
        (units || []).forEach(u => {
          if (!unitMap[u.product_id]) unitMap[u.product_id] = {};
          unitMap[u.product_id][u.unit_name] = u.conv_rate || 1;
        });
      } catch(_) {}
    }

    // ดึง base unit ของแต่ละสินค้า
    let baseUnitMap = {};
    if (productIds.length > 0) {
      try {
        const { data: prods } = await db.from('สินค้า').select('id,unit').in('id', productIds);
        (prods || []).forEach(p => { baseUnitMap[p.id] = p.unit || 'ชิ้น'; });
      } catch(_) {}
    }

    // Build return items
    window._v10ReturnBill = bill;
    window._v10ReturnItems = (items || []).map(it => {
      const sellUnit = it.unit || 'ชิ้น';
      const baseUnit = baseUnitMap[it.product_id] || 'ชิ้น';
      let convRate = 1;
      const pu = unitMap[it.product_id] || {};
      if (pu[sellUnit]) convRate = pu[sellUnit];
      if (sellUnit === baseUnit) convRate = 1;

      // จำนวนที่คืนไปแล้ว (match by name)
      const prevItem = prevReturns.find(pr => pr.name === it.name);
      const alreadyReturned = prevItem ? (prevItem.qty || 0) : 0;
      const maxReturnable = Math.max(0, it.qty - alreadyReturned);

      return { ...it, return_qty: 0, conv_rate: convRate, base_unit: baseUnit,
        sell_unit: sellUnit, already_returned: alreadyReturned, max_returnable: maxReturnable };
    });

    if (typeof openModal !== 'function') return;
    openModal('คืนสินค้า', '');
    v10RenderReturnModal();
  } catch (e) {
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    typeof toast === 'function' && toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
};

function v10RenderReturnModal() {
  const body = document.getElementById('modal-body');
  if (!body) return;
  const bill = window._v10ReturnBill, items = window._v10ReturnItems || [];
  const totalReturn = items.reduce((s, it) => s + it.return_qty * (it.price || 0), 0);
  const selCount = items.filter(it => it.return_qty > 0).length;
  const isDebt = (bill.method === 'ค้างชำระ' || bill.method === 'ค้างเครดิต' || bill.status === 'ค้างชำระ'), isCash = (bill.method === 'เงินสด');
  // คำนวณหนี้จริงที่ค้าง (หักมัดจำและหักยอดคืนก่อนหน้า)
  const origTotal = bill.return_info?.original_total || bill.total || 0;
  const prevReturnTotal = bill.return_info?.return_total || 0;
  const depositPaid = bill.deposit_amount || 0;
  const actualDebtRemaining = isDebt ? Math.max(0, origTotal - depositPaid - prevReturnTotal) : 0;
  const debtDeduction = isDebt ? Math.min(totalReturn, actualDebtRemaining) : 0;
  const fullyPaidDebt = isDebt && (depositPaid >= origTotal);
  const isTransfer = (bill.method === 'โอนเงิน' || bill.method === 'บัตรเครดิต');
  const needsRefund = totalReturn > 0 && (isCash || fullyPaidDebt || isTransfer || (!isDebt && !isCash && !isTransfer));
  let refundText = '';
  if (needsRefund) {
    if (isCash || fullyPaidDebt) refundText = '💰 คืนเงินลูกค้า (ดึงจากลิ้นชัก) ฿' + formatNum(totalReturn);
    else refundText = '💰 เลือกระบบคืนเงินลูกค้า (เงินสด/โอน) ฿' + formatNum(totalReturn);
  }
  let debtText = '';
  if (isDebt && !fullyPaidDebt && debtDeduction > 0) {
    debtText = '📉 หักหนี้ '+(bill.customer_name||'')+' ฿'+formatNum(debtDeduction)+(depositPaid>0?' <span style="font-size:11px;opacity:.8">(หนี้คงค้าง ฿'+formatNum(actualDebtRemaining)+', มัดจำ ฿'+formatNum(depositPaid)+')</span>':'');
  }

  body.innerHTML = `
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
      <div><strong>บิล #${bill.bill_no}</strong>
        <div style="font-size:12px;color:var(--text-tertiary);">${typeof formatDateTime==='function'?formatDateTime(bill.date):''} • ${bill.customer_name||'ทั่วไป'} • ${bill.method}</div></div>
      <span class="badge ${bill.status==='สำเร็จ'?'badge-success':bill.status==='ค้างชำระ'?'badge-warning':'badge-info'}">${bill.status}</span>
    </div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">เลือกรายการที่ต้องการคืน แล้วระบุจำนวน</div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${items.map((it, i) => {
        const on = it.return_qty > 0, noMore = it.max_returnable <= 0;
        const hasConv = it.conv_rate !== 1;
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
          border:${noMore?'1px solid var(--border-light)':on?'2px solid var(--primary)':'1px solid var(--border-light)'};
          border-radius:10px;background:${noMore?'var(--bg-base)':on?'var(--primary-50,#fef2f2)':'var(--bg-surface)'};
          opacity:${noMore?'0.5':'1'};cursor:${noMore?'not-allowed':'pointer'};"
          ${noMore?'':`onclick="v10ToggleRI(${i})"`}>
          <input type="checkbox" ${on?'checked':''} ${noMore?'disabled':''} style="width:16px;height:16px;flex-shrink:0;pointer-events:none;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:500;">${it.name}</div>
            <div style="font-size:11px;color:var(--text-tertiary);">
              ซื้อ ${it.qty} ${it.sell_unit} @ ฿${formatNum(it.price)}
              ${hasConv?` <span style="color:var(--info);">(1 ${it.sell_unit} = ${formatNum(it.conv_rate)} ${it.base_unit})</span>`:''}
            </div>
            ${it.already_returned>0?`<div style="font-size:10px;color:var(--warning);margin-top:2px;">⚠ คืนไปแล้ว ${it.already_returned} ${it.sell_unit} — คืนได้อีก ${it.max_returnable}</div>`:''}
            ${noMore?`<div style="font-size:10px;color:var(--danger);margin-top:2px;">คืนครบแล้ว</div>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
            <span style="font-size:11px;color:var(--text-secondary);">คืน</span>
            <div style="display:flex;align-items:center;border:1px solid var(--border-default);border-radius:6px;overflow:hidden;${(!on||noMore)?'opacity:.4;pointer-events:none;':''}">
               <button onclick="event.stopPropagation();v10AdjRI(${i},-1)" style="width:26px;height:26px;border:none;background:var(--bg-base);cursor:pointer;font-size:14px;font-weight:700;">−</button>
              <span style="width:30px;text-align:center;font-size:13px;font-weight:700;color:${on?'var(--primary)':'inherit'};">${it.return_qty}</span>
               <button onclick="event.stopPropagation();v10AdjRI(${i},1)" style="width:26px;height:26px;border:none;background:var(--bg-base);cursor:pointer;font-size:14px;font-weight:700;">+</button>
            </div>
            <span style="font-size:11px;color:var(--text-tertiary);">/${it.max_returnable}</span>
          </div></div>`;
      }).join('')}
    </div>
    ${selCount>0?`<div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:10px;">
      <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">สรุปการคืน</div>
      ${items.filter(it=>it.return_qty>0).map(it=>{
        const bq=parseFloat((it.return_qty*it.conv_rate).toFixed(6));
        return `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
          <span>${it.name} × ${it.return_qty} ${it.sell_unit}${it.conv_rate!==1?' (='+formatNum(bq)+' '+it.base_unit+')':''}</span>
          <span>฿${formatNum(it.return_qty*it.price)}</span></div>`;
      }).join('')}
      <div style="display:flex;justify-content:space-between;padding-top:8px;margin-top:6px;border-top:1px solid var(--border-light);font-size:15px;font-weight:700;color:var(--danger);">
        <span>ยอดคืน</span><span>฿${formatNum(totalReturn)}</span></div></div>`:''}
    <div style="margin-top:10px;"><label class="form-label" style="font-size:12px;">เหตุผลการคืน *</label>
      <input class="form-input" id="v10-return-reason" placeholder="เช่น สินค้าชำรุด, ผิดรุ่น..."></div>
    ${selCount>0?`<div style="margin-top:8px;padding:10px 12px;background:var(--info-bg);border-radius:8px;font-size:12px;color:var(--info);line-height:1.7;">
      <strong>สิ่งที่จะเกิดขึ้น:</strong><br>
      ✅ สต็อกบวกกลับ: ${items.filter(it=>it.return_qty>0).map(it=>{
        const bq=parseFloat((it.return_qty*it.conv_rate).toFixed(6));
        return it.name+' +'+(it.conv_rate!==1?formatNum(bq)+' '+it.base_unit:it.return_qty+' '+it.sell_unit);
      }).join(', ')}<br>
      ${refundText ? refundText + '<br>' : ''}
      ${debtText ? debtText + '<br>' : ''}
      📄 ยอดบิลลด ฿${formatNum(bill.total)} → ฿${formatNum(Math.max(0,(bill.total||0)-totalReturn))}
    </div>`:''}
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">ยกเลิก</button>
      <button class="btn btn-primary" onclick="v10ConfirmReturn()"
        style="flex:2;${selCount===0?'opacity:.5;pointer-events:none;':'background:var(--danger);border-color:var(--danger);'}">
        <i class="material-icons-round">undo</i> ยืนยันคืน${totalReturn>0?' ฿'+formatNum(totalReturn):''}</button></div>`;
}

window.v10ToggleRI = function(i) {
  const it = window._v10ReturnItems; if (!it||!it[i]||it[i].max_returnable<=0) return;
  it[i].return_qty = it[i].return_qty > 0 ? 0 : it[i].max_returnable;
  v10RenderReturnModal();
};
window.v10AdjRI = function(i, d) {
  const it = window._v10ReturnItems; if (!it||!it[i]) return;
  it[i].return_qty = Math.max(0, Math.min(it[i].max_returnable, it[i].return_qty + d));
  v10RenderReturnModal();
};

window.v10ConfirmReturn = async function() {
  const bill = window._v10ReturnBill;
  const items = (window._v10ReturnItems||[]).filter(it => it.return_qty > 0);
  const reason = document.getElementById('v10-return-reason')?.value?.trim();
  if (!items.length) { typeof toast==='function'&&toast('เลือกรายการคืน','error'); return; }
  if (!reason) { typeof toast==='function'&&toast('ระบุเหตุผล','error'); return; }

  const totalReturn = items.reduce((s,it) => s + it.return_qty*(it.price||0), 0);
  const allItems = window._v10ReturnItems||[];
  const allFull = allItems.every(it => (it.return_qty+it.already_returned) >= it.qty);
  const isDebt = (bill.method==='ค้างชำระ' || bill.method==='ค้างเครดิต' || bill.status==='ค้างชำระ'), isCash = (bill.method==='เงินสด');
  // คำนวณหนี้จริงที่ต้องหัก (หักมัดจำ + ยอดคืนก่อนหน้า)
  const origTotal = bill.return_info?.original_total || bill.total || 0;
  const prevReturnTotal = bill.return_info?.return_total || 0;
  const depositPaid = bill.deposit_amount || 0;
  const actualDebtRemaining = isDebt ? Math.max(0, origTotal - depositPaid - prevReturnTotal) : 0;
  const debtDeduction = isDebt ? Math.min(totalReturn, actualDebtRemaining) : 0;

  const cf = await Swal.fire({ title:'ยืนยันคืนสินค้า?',
    html:`คืน ${items.length} รายการ ฿${formatNum(totalReturn)}${isDebt?'<br>⚠ หนี้จะถูกหัก':''}`,
    icon:'warning', showCancelButton:true, confirmButtonText:'ยืนยัน', cancelButtonText:'ยกเลิก', confirmButtonColor:'#DC2626' });
  if (!cf.isConfirmed) return;

  if (typeof v9ShowOverlay==='function') v9ShowOverlay('กำลังดำเนินการ...');
  try {
    // 1. คืนสต็อก (ใช้ conv_rate แปลงเป็น base unit)
    for (const item of items) {
      const convRate = parseFloat(item.conv_rate || 1);
      const baseQty = parseFloat((item.return_qty * convRate).toFixed(6));
      const { data: prod } = await db.from('สินค้า').select('stock,unit').eq('id', item.product_id).maybeSingle();
      const sb = parseFloat(prod?.stock||0), sa = parseFloat((sb+baseQty).toFixed(6));
      const bu = prod?.unit || item.base_unit || 'ชิ้น';
      await db.from('สินค้า').update({ stock:sa, updated_at:new Date().toISOString() }).eq('id', item.product_id);
      await db.from('stock_movement').insert({
        product_id:item.product_id, product_name:item.name,
        type:'คืนสินค้า', direction:'in', qty:baseQty,
        stock_before:sb, stock_after:sa,
        ref_id:bill.id, ref_table:'บิลขาย', staff_name:v10Staff(),
        note: convRate!==1 ? `คืน ${item.return_qty} ${item.sell_unit} (=${baseQty} ${bu}) — ${reason}` : reason
      });
      console.log(`[v10] Return stock: ${item.name} +${baseQty} ${bu} (${item.return_qty} ${item.sell_unit} × ${convRate})`);
    }

    // 2. จัดการเงินคืน — ตรวจสอบทุกกรณี
    // กรณี: (A) เงินสด → คืนจากลิ้นชัก (B) ค้างชำระยังค้าง → หักหนี้ (C) ค้างชำระจ่ายครบ → คืนเงินจริง (D) โอน/บัตร → เลือกวิธีคืน
    const fullyPaidDebt = isDebt && (depositPaid >= origTotal); // จ่ายหนี้ครบแล้ว
    const isTransfer = (bill.method==='โอนเงิน' || bill.method==='บัตรเครดิต');
    // ตรวจว่าลูกค้าต้องได้เงินคืนจริง (ไม่ใช่แค่หักหนี้)
    const needsRefund = totalReturn > 0 && (isCash || fullyPaidDebt || isTransfer || (!isDebt && !isCash && !isTransfer));
    let refundMethod = isCash ? 'เงินสด' : (isTransfer ? bill.method : 'เงินสด');
    let refundDone = false;

    if (needsRefund) {
      // ถ้าไม่ใช่ค้างชำระ หรือ จ่ายค้างชำระครบแล้ว → ต้องคืนเงินลูกค้า
      if (isCash || fullyPaidDebt || (!isDebt && !isTransfer)) {
        // เงินสด หรือ ค้างชำระที่จ่ายครบ → เปิด wizard นับแบงค์จากลิ้นชัก
        if (typeof window.v28ExpenseWiz === 'function' && typeof loadDrawer === 'function') {
          const drawer = await loadDrawer();
          await new Promise((resolve) => {
            window.v28ExpenseWiz(totalReturn, drawer, async (res) => {
              try {
                const { data: sess } = await db.from('cash_session').select('id').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
                if (sess) {
                  await db.from('cash_transaction').insert({
                    session_id: sess.id, type: 'คืนเงิน', direction: 'out',
                    amount: res.outTotal, change_amt: res.inTotal, net_amount: totalReturn,
                    balance_after: 0, ref_id: bill.id, ref_table: 'บิลขาย',
                    staff_name: v10Staff(), denominations: res.out, change_denominations: res.in,
                    note: `คืนบิล #${bill.bill_no}: ${reason}`
                  });
                }
                refundMethod = 'เงินสด';
                refundDone = true;
              } catch(e) { console.error('[v10] Cash refund error:', e); }
              resolve();
            });
          });
        } else {
          // fallback: ไม่มี v28ExpenseWiz → ใช้ recordCashTx ตรง
          const { data:sess } = await db.from('cash_session').select('id').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
          if (sess && typeof window.recordCashTx==='function')
            await window.recordCashTx({ sessionId:sess.id, type:'คืนเงิน', direction:'out', amount:totalReturn, netAmount:totalReturn, refId:bill.id, refTable:'บิลขาย', note:`คืนบิล #${bill.bill_no}: ${reason}` });
          refundMethod = 'เงินสด'; refundDone = true;
        }
      } else {
        // โอน/บัตร/อื่นๆ → ให้เลือกวิธีคืนเงิน
        const { value: chosenMethod } = await Swal.fire({
          title: '💰 เลือกวิธีคืนเงินให้ลูกค้า',
          html: `<p style="font-size:14px;margin-bottom:12px;">ยอดคืน <strong style="color:#dc2626">฿${formatNum(totalReturn)}</strong></p>
            <p style="font-size:12px;color:#64748b;">บิลเดิมชำระด้วย: ${bill.method}</p>`,
          input: 'select',
          inputOptions: { 'เงินสด': '💵 เงินสด (หักจากลิ้นชัก)', 'โอนเงิน': '📱 โอนเงินคืน', 'บัตรเครดิต': '💳 คืนผ่านบัตร' },
          inputValue: bill.method === 'โอนเงิน' ? 'โอนเงิน' : (bill.method === 'บัตรเครดิต' ? 'บัตรเครดิต' : 'เงินสด'),
          showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ข้าม',
          confirmButtonColor: '#10b981'
        });
        if (chosenMethod) {
          refundMethod = chosenMethod;
          if (chosenMethod === 'เงินสด') {
            // เปิด wizard นับแบงค์
            if (typeof window.v28ExpenseWiz === 'function' && typeof loadDrawer === 'function') {
              const drawer = await loadDrawer();
              await new Promise((resolve) => {
                window.v28ExpenseWiz(totalReturn, drawer, async (res) => {
                  try {
                    const { data: sess } = await db.from('cash_session').select('id').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
                    if (sess) {
                      await db.from('cash_transaction').insert({
                        session_id: sess.id, type: 'คืนเงิน', direction: 'out',
                        amount: res.outTotal, change_amt: res.inTotal, net_amount: totalReturn,
                        balance_after: 0, ref_id: bill.id, ref_table: 'บิลขาย',
                        staff_name: v10Staff(), denominations: res.out, change_denominations: res.in,
                        note: `คืนบิล #${bill.bill_no}: ${reason}`
                      });
                    }
                    refundDone = true;
                  } catch(e) { console.error('[v10] Cash refund error:', e); }
                  resolve();
                });
              });
            }
          } else {
            // โอน/บัตร → แค่บันทึก log (ไม่ต้องหัก drawer)
            refundDone = true;
          }
        }
      }
    }

    // จัดการหนี้: ค้างชำระ + ยังค้างอยู่ → หักหนี้
    if (isDebt && !fullyPaidDebt && bill.customer_id && debtDeduction>0) {
      const { data:c } = await db.from('customer').select('debt_amount,total_purchase').eq('id',bill.customer_id).maybeSingle();
      if (c) await db.from('customer').update({ debt_amount:Math.max(0,(c.debt_amount||0)-debtDeduction), total_purchase:Math.max(0,(c.total_purchase||0)-totalReturn) }).eq('id',bill.customer_id);
      console.log(`[v10] Debt deduction: ฿${debtDeduction} (actual debt remaining was ฿${actualDebtRemaining}, deposit ฿${depositPaid})`);
    }
    // ค้างชำระจ่ายครบ → หัก total_purchase + คืนส่วนต่าง deposit ถ้ามี
    if (fullyPaidDebt && bill.customer_id) {
      const { data:c } = await db.from('customer').select('total_purchase').eq('id',bill.customer_id).maybeSingle();
      if (c) await db.from('customer').update({ total_purchase:Math.max(0,(c.total_purchase||0)-totalReturn) }).eq('id',bill.customer_id);
    }
    if (!isDebt && bill.customer_id && totalReturn>0) {
      const { data:c } = await db.from('customer').select('total_purchase').eq('id',bill.customer_id).maybeSingle();
      if (c) await db.from('customer').update({ total_purchase:Math.max(0,(c.total_purchase||0)-totalReturn) }).eq('id',bill.customer_id);
    }

    // 3. อัพเดทบิล (รวม previous + current returns)
    const prevRI = bill.return_info?.return_items || [];
    const newRI = items.map(it => ({ name:it.name, qty:it.return_qty, price:it.price, unit:it.sell_unit, total:it.return_qty*it.price, cost:it.cost||0, return_cost:(it.cost||0)*it.return_qty, conv_rate:it.conv_rate, base_unit:it.base_unit }));
    const allRI = [...prevRI, ...newRI];
    const allRT = allRI.reduce((s,it)=>s+(it.total||0),0);
    const allRC = allRI.reduce((s,it)=>s+(parseFloat(it.return_cost||0) || (parseFloat(it.cost||0)*parseFloat(it.qty||0))),0);
    const origTotal2 = bill.return_info?.original_total || bill.total || 0;
    const newBillTotal = Math.max(0, origTotal2 - allRT);

    // กำหนดสถานะ: ถ้าคืนครบ หรือ ยอดเหลือ 0 → 'คืนสินค้า'
    const newStatus = (allFull || newBillTotal <= 0) ? 'คืนสินค้า' : 'คืนบางส่วน';
    await db.from('บิลขาย').update({
      return_info: { returned_at:new Date().toISOString(), returned_by:v10Staff(), return_reason:reason,
        return_items:allRI, return_total:allRT, return_cost_total:allRC, original_total:origTotal2, new_total:newBillTotal,
        refund_method: refundMethod || null },
      total: newBillTotal,
      status: newStatus
    }).eq('id', bill.id);

    // 4. Log + Refresh
    typeof logActivity==='function' && logActivity('คืนสินค้า',
      `บิล #${bill.bill_no} | ${items.map(it=>it.name+' x'+it.return_qty+' '+it.sell_unit+(it.conv_rate!==1?' (='+parseFloat((it.return_qty*it.conv_rate).toFixed(2))+' '+it.base_unit+')':'')).join(', ')} | ฿${formatNum(totalReturn)} | ยอดใหม่ ฿${formatNum(newBillTotal)} | ${reason}${refundDone?' | คืนเงิน '+refundMethod:''}`,
      bill.id, 'บิลขาย');

    await loadProducts?.(); typeof closeModal==='function'&&closeModal();
    typeof loadHistoryData==='function'&&loadHistoryData(); typeof updateHomeStats==='function'&&updateHomeStats();
    typeof renderDebts==='function'&&renderDebts(); typeof v12BMCLoad==='function'&&v12BMCLoad();
    try { if(typeof getLiveCashBalance==='function'){const nb=await getLiveCashBalance();['cash-current-balance','global-cash-balance'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='฿'+formatNum(nb);});} } catch(_){}
    if (typeof v9HideOverlay==='function') v9HideOverlay();

    // 5. สรุป + ถามพิมพ์
    const refundSummary = refundDone ? `<div style="font-size:12px;color:#059669;background:#ecfdf5;padding:6px;border-radius:6px;margin-top:4px;">💰 คืนเงิน ฿${formatNum(totalReturn)} (${refundMethod})</div>` : '';
    const debtSummary = (isDebt && !fullyPaidDebt && debtDeduction>0) ? `<div style="font-size:12px;color:#92400e;background:#fffbeb;padding:6px;border-radius:6px;margin-top:4px;">หนี้ ${bill.customer_name} ลดลง ฿${formatNum(debtDeduction)}${depositPaid>0?' (มัดจำ ฿'+formatNum(depositPaid)+')':''}</div>` : '';
    const {isConfirmed:dp} = await Swal.fire({ icon:'success', title:'คืนสินค้าสำเร็จ',
      html:`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;text-align:center;">
        <div style="background:#fef2f2;padding:8px;border-radius:8px;"><div style="font-size:10px;color:#666;">ยอดคืน</div><div style="font-size:18px;font-weight:800;color:#dc2626;">฿${formatNum(totalReturn)}</div></div>
        <div style="background:#f0fdf4;padding:8px;border-radius:8px;"><div style="font-size:10px;color:#666;">ยอดบิลใหม่</div><div style="font-size:18px;font-weight:800;color:#15803d;">฿${formatNum(newBillTotal)}</div></div></div>
        ${refundSummary}${debtSummary}`,
      showCancelButton:true, confirmButtonText:'พิมพ์ใบคืน', cancelButtonText:'ข้าม', confirmButtonColor:'#10B981' });
    if (dp) v10PrintReturnSlip(bill, items, totalReturn, reason);
  } catch(e) { if(typeof v9HideOverlay==='function')v9HideOverlay(); console.error('[v10] Return error:',e); typeof toast==='function'&&toast('ผิดพลาด: '+(e.message||e),'error'); }
};

// Inject return button into history table
// ใช้ MutationObserver แทน setTimeout เพื่อความเสถียร
const _v10OrigLoadHistoryData = window.loadHistoryData;
window.loadHistoryData = async function() {
  console.log('[v10] loadHistoryData called');
  if (_v10OrigLoadHistoryData) await _v10OrigLoadHistoryData();
  v10InjectReturnButtons();
};

function v10InjectReturnButtons() {
  const tbody = document.getElementById('history-tbody');
  if (!tbody) { console.log('[v10] history-tbody not found'); return; }
  console.log('[v10] Injecting return buttons into', tbody.children.length, 'rows');
  
  tbody.querySelectorAll('tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 7) return;
    const lastTd = tds[tds.length - 1];
    if (lastTd.querySelector('.v10-return-btn')) return;

    // หา bill id จากปุ่มที่มีอยู่แล้ว (viewBillDetail หรือ cancelBill)
    const anyBtn = lastTd.querySelector('button[onclick]');
    if (!anyBtn) return;
    const match = anyBtn.getAttribute('onclick')?.match(/['"]([^'"]+)['"]/);
    if (!match) return;
    const billId = match[1];

    // เช็คสถานะ — แสดงปุ่มคืนสินค้าสำหรับทุกสถานะ ยกเว้น ยกเลิก และ คืนสินค้า(ทั้งหมด)
    const statusBadge = Array.from(tds).find(td => td.querySelector('.badge'))?.querySelector('.badge');
    const status = statusBadge?.textContent?.trim() || '';
    
    if (status !== 'ยกเลิก' && status !== 'คืนสินค้า') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost btn-icon v10-return-btn';
      btn.style.color = 'var(--warning)';
      btn.title = 'คืนสินค้า';
      btn.innerHTML = '<i class="material-icons-round">undo</i>';
      btn.onclick = (e) => { e.stopPropagation(); v10ShowReturnModal(billId); };
      lastTd.appendChild(btn);
    }
  });
}

// MutationObserver: ถ้า tbody ถูก re-render โดย module อื่น ก็ inject ใหม่อัตโนมัติ
(function v10WatchHistory() {
  const obs = new MutationObserver(() => {
    const tbody = document.getElementById('history-tbody');
    if (tbody && tbody.children.length > 0 && !tbody.querySelector('.v10-return-btn')) {
      v10InjectReturnButtons();
    }
  });
  // observe page-history section
  const watchTarget = () => {
    const el = document.getElementById('page-history');
    if (el) obs.observe(el, { childList: true, subtree: true });
    else setTimeout(watchTarget, 2000);
  };
  watchTarget();
})();


// ══════════════════════════════════════════════════════════════════
// V10-4: CANCEL BILL FIX — ยกเลิกบิล → คืนสต็อก + หัก cash
// ══════════════════════════════════════════════════════════════════

window.cancelBill = async function(billId) {
  const { value: reason, isConfirmed } = await Swal.fire({
    title: 'ยกเลิกบิล?',
    input: 'text',
    inputLabel: 'เหตุผล',
    showCancelButton: true,
    confirmButtonText: 'ยกเลิกบิล',
    cancelButtonText: 'ปิด',
    confirmButtonColor: '#DC2626',
    inputValidator: v => !v ? 'กรุณาระบุเหตุผล' : null
  });
  if (!isConfirmed) return;

  if (typeof v9ShowOverlay === 'function') v9ShowOverlay('กำลังยกเลิกบิล...');

  try {
    // Load bill and items
    const [{ data: bill }, { data: items }] = await Promise.all([
      db.from('บิลขาย').select('*').eq('id', billId).maybeSingle(),
      db.from('รายการในบิล').select('*').eq('bill_id', billId)
    ]);

    if (!bill) throw new Error('ไม่พบบิล');

    // 1. Restore stock for each item
    for (const item of (items || [])) {
      const { data: prod } = await db.from('สินค้า').select('stock').eq('id', item.product_id).maybeSingle();
      const stockBefore = prod?.stock || 0;
      const stockAfter = stockBefore + item.qty;

      await db.from('สินค้า').update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', item.product_id);
      await db.from('stock_movement').insert({
        product_id: item.product_id, product_name: item.name,
        type: 'ยกเลิกบิล', direction: 'in', qty: item.qty,
        stock_before: stockBefore, stock_after: stockAfter,
        ref_id: bill.id, ref_table: 'บิลขาย',
        staff_name: v10Staff(), note: `ยกเลิก: ${reason}`
      });
    }

    // 2. Reverse cash transaction if cash payment
    if (bill.method === 'เงินสด' && bill.total > 0) {
      const { data: session } = await db.from('cash_session').select('id')
        .eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
      if (session) {
        const recordFn = window.recordCashTx || (typeof recordCashTx !== 'undefined' ? recordCashTx : null);
        if (recordFn) {
          await recordFn({
            sessionId: session.id, type: 'ยกเลิกบิล', direction: 'out',
            amount: bill.total, netAmount: bill.total,
            refId: bill.id, refTable: 'บิลขาย',
            note: `ยกเลิกบิล #${bill.bill_no}: ${reason}`
          });
        }
      }
    }

    // 3. Reverse customer debt if debt method + update total_purchase
    if (bill.customer_id) {
      const { data: cust } = await db.from('customer')
        .select('debt_amount, total_purchase, visit_count').eq('id', bill.customer_id).maybeSingle();
      if (cust) {
        const upd = {
          total_purchase: Math.max(0, (cust.total_purchase || 0) - bill.total),
          visit_count: Math.max(0, (cust.visit_count || 1) - 1)
        };
        if (bill.method === 'ค้างชำระ') {
          upd.debt_amount = Math.max(0, (cust.debt_amount || 0) - bill.total);
        }
        await db.from('customer').update(upd).eq('id', bill.customer_id);
      }
    }

    // 4. Update bill status
    await db.from('บิลขาย').update({ status: 'ยกเลิก', cancel_reason: reason }).eq('id', billId);

    // 5. Log
    typeof logActivity === 'function' && logActivity('ยกเลิกบิล',
      `บิล #${bill.bill_no} | ฿${formatNum(bill.total)} | ${reason}`, bill.id, 'บิลขาย');

    // 6. Refresh
    await loadProducts?.();
    typeof loadHistoryData === 'function' && loadHistoryData();

    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    typeof toast === 'function' && toast('ยกเลิกบิลสำเร็จ — สต็อกคืนแล้ว', 'success');

  } catch (e) {
    if (typeof v9HideOverlay === 'function') v9HideOverlay();
    typeof toast === 'function' && toast('เกิดข้อผิดพลาด: ' + (e.message || e), 'error');
  }
};


// ══════════════════════════════════════════════════════════════════
// V10-5: A4 RECEIPT REDESIGN — ออกแบบตาม Template มืออาชีพ
//        Manrope + Inter fonts, Professional Layout
// ══════════════════════════════════════════════════════════════════

// Thai number to text converter
function v10NumToThaiText(num) {
  if (!num || num === 0) return 'ศูนย์บาทถ้วน';
  const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  const baht = Math.floor(Math.abs(num));
  const satang = Math.round((Math.abs(num) - baht) * 100);
  function convertGroup(n) {
    if (n === 0) return '';
    const s = String(n);
    let result = '';
    for (let i = 0; i < s.length; i++) {
      const d = parseInt(s[i]);
      const pos = s.length - i - 1;
      if (d === 0) continue;
      if (pos === 1 && d === 2) result += 'ยี่';
      else if (pos === 1 && d === 1) result += '';
      else if (pos === 0 && d === 1 && s.length > 1) result += 'เอ็ด';
      else result += digits[d];
      result += positions[pos];
    }
    return result;
  }
  let text = '';
  if (baht >= 1000000) {
    text += convertGroup(Math.floor(baht / 1000000)) + 'ล้าน';
    text += convertGroup(baht % 1000000);
  } else {
    text += convertGroup(baht);
  }
  text += 'บาท';
  if (satang > 0) text += convertGroup(satang) + 'สตางค์';
  else text += 'ถ้วน';
  return text;
}

window.printReceiptA4v2 = async function(bill, items, rc, docType = 'receipt') {
  const ds = await v10GetDocSettings();
  const s = ds.receipt_a4 || V10_DEFAULTS.receipt_a4;
  const hc = s.bw_mode ? '#333333' : (s.header_color || '#af101a');
  const shopName = rc?.shop_name || 'SK POS';
  const shopNameEn = rc?.shop_name_en || '';
  const shopAddr = rc?.address || '';
  const shopPhone = rc?.phone || '';
  const shopTax = rc?.tax_id || '';
  const qrPromptpay = rc?.promptpay_id || rc?.qr_promptpay || '';

  const subtotal = (items || []).reduce((sum, i) => sum + (i.total || 0), 0);
  const discount = bill.discount || 0;
  const afterDiscount = subtotal - discount;
  const vatRate = rc?.vat_rate || 0;
  const vatAmount = vatRate > 0 ? Math.round(afterDiscount * vatRate / 100) : 0;
  const grandTotal = bill.total || (afterDiscount + vatAmount);
  const dateObj = bill.date ? new Date(bill.date) : new Date();
  const dateStr = dateObj.toLocaleDateString('th-TH', { day:'numeric', month:'long', year:'numeric' });

  const isDelivery = docType === 'delivery';
  const docLabel = isDelivery ? 'ใบส่งของ' : (s.header_text || 'ใบเสร็จรับเงิน / ใบกำกับภาษี');
  const docLabelEn = isDelivery ? 'DELIVERY NOTE' : 'RECEIPT / TAX INVOICE';

  const rows = (items || []).map((it, idx) => `
    <tr style="${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
      <td style="padding:12px 16px;text-align:center;color:#94a3b8;font-size:13px;">${idx + 1}</td>
      <td style="padding:12px 16px;">
        <div style="font-weight:600;font-size:13px;color:#1e293b;">${it.name}</div>
        ${it.sku ? `<div style="font-size:11px;color:#94a3b8;">SKU: ${it.sku}</div>` : ''}
      </td>
      <td style="padding:12px 16px;text-align:right;font-weight:500;font-size:13px;">${formatNum(it.qty)}</td>
      <td style="padding:12px 16px;text-align:center;font-size:13px;color:#64748b;">${it.unit || 'ชิ้น'}</td>
      <td style="padding:12px 16px;text-align:right;font-size:13px;">${formatNum(it.price)}</td>
      <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:13px;">${formatNum(it.total)}</td>
    </tr>`).join('');

  const w = window.open('', '_blank', 'width=900,height=900');
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>${isDelivery ? 'ใบส่งของ' : 'ใบเสร็จ'} #${bill.bill_no}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', 'Inter', sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
  .headline { font-family: 'Manrope', 'Sarabun', sans-serif; }
  .label { font-family: 'Inter', 'Sarabun', sans-serif; }
  @media print { body { background: white; } .no-print { display: none; } }
</style>
</head><body>

<!-- A4 Container -->
<div style="max-width:210mm;margin:0 auto;padding:28px 32px;min-height:277mm;position:relative;">

  <!-- ═══ HEADER ═══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:32px;">
    <!-- Left: Shop Info -->
    <div style="max-width:55%;">
      ${s.show_shop_name !== false ? `
        <h2 class="headline" style="font-size:22px;font-weight:800;color:${hc};letter-spacing:-0.5px;margin-bottom:2px;">${shopName}</h2>
        ${shopNameEn ? `<h3 class="headline" style="font-size:14px;font-weight:600;color:#5b403d;margin-bottom:12px;">${shopNameEn}</h3>` : ''}
      ` : ''}
      <div style="font-size:12px;color:#5b403d;line-height:1.8;">
        ${s.show_address !== false && shopAddr ? `<p>${shopAddr}</p>` : ''}
        ${shopPhone ? `<p>โทร ${shopPhone}</p>` : ''}
        ${s.show_tax_id !== false && shopTax ? `<p><span style="font-weight:600;color:#1e293b;">เลขประจำตัวผู้เสียภาษี (Tax ID):</span> <span style="font-family:monospace;">${shopTax}</span></p>` : ''}
      </div>
    </div>

    <!-- Right: Doc Type + Numbers -->
    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
      <div style="background:${hc};padding:10px 20px;border-radius:8px;">
        <h1 class="headline" style="color:#fff;font-size:17px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">${docLabel}</h1>
        <p style="color:rgba(255,255,255,0.75);font-size:10px;font-weight:500;">${docLabelEn}</p>
      </div>
      <div style="margin-top:8px;font-size:13px;">
        ${s.show_bill_no !== false ? `<p style="display:flex;justify-content:flex-end;gap:16px;"><span style="color:#5b403d;">เลขที่ (No.):</span><span style="font-weight:700;">${bill.bill_no}</span></p>` : ''}
        ${s.show_datetime !== false ? `<p style="display:flex;justify-content:flex-end;gap:16px;margin-top:4px;"><span style="color:#5b403d;">วันที่ (Date):</span><span style="font-weight:700;">${dateStr}</span></p>` : ''}
      </div>
    </div>
  </div>

  <!-- ═══ CUSTOMER + META ═══ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;padding:20px 0;border-top:1px solid #e4beba30;border-bottom:1px solid #e4beba30;">
    ${s.show_customer !== false ? `
    <div>
      <span class="label" style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#5b403d;font-weight:700;">ข้อมูลลูกค้า / Customer Details</span>
      <div style="background:#f2f4f5;padding:14px 16px;border-radius:12px;margin-top:8px;">
        <p style="font-weight:700;font-size:16px;color:#1e293b;">${bill.customer_name || 'ลูกค้าทั่วไป'}</p>
        ${bill.customer_address ? `<p style="font-size:12px;color:#5b403d;line-height:1.7;margin-top:4px;">${bill.customer_address}</p>` : ''}
        ${bill.customer_tax_id ? `<p style="font-size:12px;color:#5b403d;margin-top:2px;">เลขผู้เสียภาษี: ${bill.customer_tax_id}</p>` : ''}
      </div>
    </div>` : '<div></div>'}
    <div style="display:flex;flex-direction:column;justify-content:flex-end;gap:8px;">
      ${s.show_staff !== false ? `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;border-bottom:1px solid #e4beba20;padding-bottom:8px;">
        <span style="color:#5b403d;">พนักงานขาย (Salesperson)</span>
        <span style="font-weight:500;">${bill.staff_name || '-'}</span>
      </div>` : ''}
      ${s.show_method !== false ? `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;border-bottom:1px solid #e4beba20;padding-bottom:8px;">
        <span style="color:#5b403d;">วิธีชำระเงิน (Payment)</span>
        <span style="font-weight:500;">${bill.method || '-'}</span>
      </div>` : ''}
      ${bill.ref_no ? `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
        <span style="color:#5b403d;">อ้างอิง (Reference)</span>
        <span style="font-weight:500;">${bill.ref_no}</span>
      </div>` : ''}
    </div>
  </div>

  <!-- ═══ TABLE ═══ -->
  <div style="margin-bottom:24px;overflow:hidden;border-radius:12px;border:1px solid #e4beba20;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#e6e8e9;">
          <th class="headline" style="padding:12px 16px;text-align:center;font-size:11px;font-weight:600;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;width:40px;">#</th>
          <th class="headline" style="padding:12px 16px;text-align:left;font-size:11px;font-weight:600;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">รายละเอียดสินค้า (Description)</th>
          <th class="headline" style="padding:12px 16px;text-align:right;font-size:11px;font-weight:600;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;width:80px;">จำนวน (Qty)</th>
          <th class="headline" style="padding:12px 16px;text-align:center;font-size:11px;font-weight:600;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;width:80px;">หน่วย (Unit)</th>
          <th class="headline" style="padding:12px 16px;text-align:right;font-size:11px;font-weight:600;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;width:100px;">ราคา/หน่วย (Price)</th>
          <th class="headline" style="padding:12px 16px;text-align:right;font-size:11px;font-weight:600;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;width:110px;">จำนวนเงิน (Amount)</th>
        </tr>
      </thead>
      <tbody>${rows}
        ${(items||[]).length < 8 ? '<tr><td colspan="6" style="height:' + Math.max(20, (8-(items||[]).length)*36) + 'px;"></td></tr>' : ''}
      </tbody>
    </table>
  </div>

  <!-- ═══ SUMMARY ═══ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;">
    <!-- Left: Text Amount + Notes -->
    <div>
      <div style="background:#f2f4f5;padding:14px 16px;border-radius:10px;margin-bottom:14px;">
        <span class="label" style="font-size:10px;text-transform:uppercase;font-weight:700;color:#5b403d;display:block;margin-bottom:4px;">จำนวนเงินตัวอักษร / Total in Words</span>
        <p style="font-size:13px;font-weight:700;color:${hc};">${v10NumToThaiText(grandTotal)}</p>
      </div>
      ${s.note_text || s.footer_text ? `
      <div>
        <p style="font-size:11px;font-weight:700;color:#ba1a1a;text-transform:uppercase;display:flex;align-items:center;gap:4px;margin-bottom:4px;">
          ⓘ หมายเหตุ / Notes
        </p>
        ${s.note_text ? `<p style="font-size:12px;color:#5b403d;font-style:italic;">${s.note_text}</p>` : ''}
        ${s.footer_text ? `<p style="font-size:12px;color:#5b403d;margin-top:2px;">${s.footer_text}</p>` : ''}
      </div>` : `
      <div>
        <p style="font-size:11px;font-weight:700;color:#ba1a1a;text-transform:uppercase;margin-bottom:4px;">ⓘ หมายเหตุ / Notes</p>
        <p style="font-size:12px;color:#5b403d;font-style:italic;">สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน ขอบคุณที่ใช้บริการ</p>
      </div>`}
    </div>

    <!-- Right: QR + Totals -->
    <div style="display:flex;gap:16px;align-items:flex-end;justify-content:flex-end;">
      <!-- QR Code Section -->
      ${qrPromptpay && s.show_qr !== false ? `
      <div style="background:#fff;border:1px solid #e4beba30;padding:10px;border-radius:12px;width:130px;display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div style="background:#003b71;width:100%;padding:4px 0;border-radius:6px;text-align:center;">
          <span style="color:#fff;font-size:10px;font-weight:700;">PromptPay</span>
        </div>
        <div style="width:100px;height:100px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative;">
          <img src="https://promptpay.io/${qrPromptpay}/${grandTotal}.png" style="width:96px;height:96px;border-radius:4px;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:10px;color:#94a3b8;text-align:center;\\'>QR Code</span>';">
        </div>
        <div style="text-align:center;">
          <p style="font-size:9px;font-weight:700;color:#003b71;">สแกนเพื่อชำระเงิน</p>
          <p style="font-size:8px;color:#94a3b8;text-transform:uppercase;">Scan to Pay</p>
        </div>
      </div>` : ''}

      <!-- Totals -->
      <div style="width:240px;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:6px 12px;">
          <span style="color:#5b403d;">รวมเงิน (Subtotal)</span>
          <span style="font-weight:600;">${formatNum(subtotal)}</span>
        </div>
        ${discount > 0 && s.show_discount !== false ? `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:6px 12px;color:#ba1a1a;">
          <span>ส่วนลด (Discount)</span>
          <span style="font-weight:600;">-${formatNum(discount)}</span>
        </div>` : ''}
        ${vatRate > 0 ? `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:6px 12px;">
          <span style="color:#5b403d;">ภาษีมูลค่าเพิ่ม (VAT ${vatRate}%)</span>
          <span style="font-weight:600;">${formatNum(vatAmount)}</span>
        </div>` : ''}
        <div style="background:${hc};padding:14px 16px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;color:#fff;margin-top:6px;">
          <div>
            <span class="headline" style="font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">จำนวนเงินรวมทั้งสิ้น</span><br>
            <span style="font-size:9px;opacity:.75;">GRAND TOTAL</span>
          </div>
          <span class="headline" style="font-size:22px;font-weight:800;">${formatNum(grandTotal)}</span>
        </div>
        ${s.show_received !== false && bill.received ? `
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;padding:4px 12px;margin-top:6px;">
          <span>รับเงินมา</span><span>฿${formatNum(bill.received)}</span>
        </div>` : ''}
        ${s.show_change !== false && bill.change ? `
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;padding:4px 12px;">
          <span>เงินทอน</span><span>฿${formatNum(bill.change)}</span>
        </div>` : ''}
      </div>
    </div>
  </div>

  <!-- ═══ SIGNATURE ═══ -->
  <div style="margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:48px;">
    <div style="text-align:center;">
      <div style="border-bottom:1px dotted #5b403d;height:32px;width:180px;margin:0 auto;"></div>
      <div style="margin-top:12px;">
        <p style="font-weight:700;font-size:13px;">ผู้รับของ / Received By</p>
        <p style="font-size:10px;color:#5b403d;margin-top:4px;">วันที่ (Date) ......../......../........</p>
      </div>
    </div>
    <div style="text-align:center;position:relative;">
      <div style="border-bottom:1px dotted #5b403d;height:32px;width:180px;margin:0 auto;"></div>
      <!-- Stamp placeholder -->
      <div style="position:absolute;top:-40px;right:10px;width:64px;height:64px;border:3px solid ${hc}33;border-radius:50%;display:flex;align-items:center;justify-content:center;transform:rotate(12deg);opacity:0.25;">
        <p style="font-size:7px;font-weight:800;color:${hc};text-align:center;line-height:1.2;">${shopName.substring(0,12)}</p>
      </div>
      <div style="margin-top:12px;">
        <p style="font-weight:700;font-size:13px;">ผู้รับเงิน / Authorized Signature</p>
        <p style="font-size:10px;color:#5b403d;margin-top:4px;">วันที่ (Date) ......../......../........</p>
      </div>
    </div>
  </div>

</div>

<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1200);}<\/script>
</body></html>`);
  w.document.close();
};


// ══════════════════════════════════════════════════════════════════
// V10-7: RETURN SLIP PRINT — พิมพ์ใบคืนสินค้า
// ══════════════════════════════════════════════════════════════════

async function v10PrintReturnSlip(bill, items, totalReturn, reason) {
  const rc = await v10GetShopConfig();
  const ds = await v10GetDocSettings();
  const s = ds.receipt_a4 || {};
  const hc = s.bw_mode ? '#000' : (s.header_color || '#1e293b');
  const shopName = rc?.shop_name || 'SK POS';
  const shopAddr = rc?.address || '';
  const shopPhone = rc?.phone || '';
  const dateStr = new Date().toLocaleString('th-TH');

  const rows = items.map((it, idx) => `
    <tr${idx % 2 === 1 ? ' style="background:#f9fafb;"' : ''}>
      <td style="padding:10px 12px;text-align:center;color:#94a3b8;">${idx + 1}</td>
      <td style="padding:10px 12px;font-weight:500;">${it.name}</td>
      <td style="padding:10px 12px;text-align:center;">${it.return_qty} ${it.unit || 'ชิ้น'}</td>
      <td style="padding:10px 12px;text-align:right;">฿${formatNum(it.price)}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:#dc2626;">฿${formatNum(it.return_qty * it.price)}</td>
    </tr>`).join('');

  const w = window.open('', '_blank', 'width=860,height=700');
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>ใบคืนสินค้า — บิล #${bill.bill_no}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:12mm;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Sarabun',sans-serif;font-size:13px;color:#1e293b;}</style>
</head><body>

<div style="background:${hc};color:#fff;padding:22px 28px;display:flex;justify-content:space-between;">
  <div>
    <div style="font-size:20px;font-weight:800;">${shopName}</div>
    <div style="font-size:11px;opacity:.82;line-height:1.7;">${shopAddr}${shopAddr ? '<br>' : ''}${shopPhone ? 'โทร ' + shopPhone : ''}</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:17px;font-weight:800;">ใบคืนสินค้า</div>
    <div style="font-size:12px;opacity:.85;">อ้างอิงบิล #${bill.bill_no}</div>
    <div style="font-size:11px;opacity:.75;">${dateStr}</div>
  </div>
</div>

<div style="padding:20px 28px;">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
    <div style="background:#f8fafc;border-radius:8px;padding:12px 14px;border-left:3px solid ${hc};">
      <div style="font-size:10px;color:#94a3b8;font-weight:600;">ลูกค้า</div>
      <div style="font-weight:700;">${bill.customer_name || 'ลูกค้าทั่วไป'}</div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:12px 14px;border-left:3px solid ${hc};">
      <div style="font-size:10px;color:#94a3b8;font-weight:600;">เหตุผลการคืน</div>
      <div style="font-weight:500;">${reason}</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead><tr style="background:#dc2626;">
      <th style="color:#fff;padding:9px 12px;font-size:11px;text-align:center;border-radius:6px 0 0 0;">#</th>
      <th style="color:#fff;padding:9px 12px;font-size:11px;text-align:left;">รายการ</th>
      <th style="color:#fff;padding:9px 12px;font-size:11px;text-align:center;">จำนวนคืน</th>
      <th style="color:#fff;padding:9px 12px;font-size:11px;text-align:right;">ราคา/หน่วย</th>
      <th style="color:#fff;padding:9px 12px;font-size:11px;text-align:right;border-radius:0 6px 0 0;">รวม</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;">
    <div style="background:#dc2626;color:#fff;padding:12px 20px;border-radius:10px;text-align:right;">
      <div style="font-size:12px;opacity:.85;">ยอดคืนเงินทั้งหมด</div>
      <div style="font-size:22px;font-weight:800;">฿${formatNum(totalReturn)}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;">
    <div style="text-align:center;"><div style="height:50px;border-bottom:1px solid #cbd5e1;margin-bottom:6px;"></div><div style="font-size:11px;color:#94a3b8;">ผู้อนุมัติคืน</div></div>
    <div style="text-align:center;"><div style="height:50px;border-bottom:1px solid #cbd5e1;margin-bottom:6px;"></div><div style="font-size:11px;color:#94a3b8;">ลูกค้า</div></div>
  </div>
</div>

<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000);}<\/script>
</body></html>`);
  w.document.close();
}


// ══════════════════════════════════════════════════════════════════
// V10-6: PAYMENT RECEIPT — ใบรับเงิน (ชำระหนี้)
// ══════════════════════════════════════════════════════════════════

window.v10PrintPaymentReceipt = async function(customerName, amount, method, note) {
  const rc = await v10GetShopConfig();
  const ds = await v10GetDocSettings();
  const s = ds.payment_receipt || V10_DEFAULTS.payment_receipt;
  const hc = s.bw_mode ? '#000' : (s.header_color || '#1e293b');
  const shopName = rc?.shop_name || 'SK POS';
  const shopAddr = rc?.address || '';
  const shopPhone = rc?.phone || '';
  const shopTax = rc?.tax_id || '';
  const dateStr = new Date().toLocaleString('th-TH');

  const w = window.open('', '_blank', 'width=860,height=600');
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>ใบรับเงิน</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:15mm;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Sarabun',sans-serif;font-size:13px;color:#1e293b;}</style>
</head><body>

<div style="background:${hc};color:#fff;padding:22px 28px;display:flex;justify-content:space-between;">
  <div>
    ${s.show_shop_name !== false ? `<div style="font-size:20px;font-weight:800;">${shopName}</div>` : ''}
    <div style="font-size:11px;opacity:.82;line-height:1.7;">
      ${s.show_address !== false && shopAddr ? shopAddr + '<br>' : ''}
      ${shopPhone ? 'โทร ' + shopPhone : ''}
      ${s.show_tax_id !== false && shopTax ? '<br>TAX ' + shopTax : ''}
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:17px;font-weight:800;">${s.header_text || 'ใบรับเงิน'}</div>
    ${s.show_datetime !== false ? `<div style="font-size:11px;opacity:.75;">${dateStr}</div>` : ''}
  </div>
</div>

<div style="padding:24px 28px;">
  ${s.show_customer !== false ? `
  <div style="background:#f8fafc;border-radius:10px;padding:14px 18px;border-left:3px solid ${hc};margin-bottom:20px;">
    <div style="font-size:10px;color:#94a3b8;font-weight:600;">ได้รับเงินจาก</div>
    <div style="font-size:18px;font-weight:700;">${customerName}</div>
  </div>` : ''}

  <div style="background:#f0fdf4;border-radius:14px;padding:24px;text-align:center;margin-bottom:20px;">
    <div style="font-size:12px;color:#16a34a;margin-bottom:4px;">ยอดรับชำระ</div>
    <div style="font-size:36px;font-weight:800;color:#15803d;">฿${formatNum(amount)}</div>
    ${s.show_method !== false ? `<div style="font-size:13px;color:#64748b;margin-top:4px;">ชำระโดย: ${method || 'เงินสด'}</div>` : ''}
  </div>

  ${note ? `<div style="background:#f8fafc;border-radius:8px;padding:10px 14px;font-size:12px;color:#64748b;margin-bottom:20px;">หมายเหตุ: ${note}</div>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px;">
    <div style="text-align:center;"><div style="height:50px;border-bottom:1px solid #cbd5e1;margin-bottom:6px;"></div><div style="font-size:11px;color:#94a3b8;">ผู้รับเงิน</div></div>
    <div style="text-align:center;"><div style="height:50px;border-bottom:1px solid #cbd5e1;margin-bottom:6px;"></div><div style="font-size:11px;color:#94a3b8;">ผู้ชำระเงิน</div></div>
  </div>

  ${s.footer_text ? `<div style="text-align:center;margin-top:20px;font-size:11px;color:#94a3b8;">${s.footer_text}</div>` : ''}
</div>

<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800);}<\/script>
</body></html>`);
  w.document.close();
};

// NOTE: ไม่ override recordDebtPayment เพราะ v9 มีระบบนับแบงค์ที่ซับซ้อน
// แทนที่ → inject ปุ่ม "พิมพ์ใบรับเงิน" ในหน้าลูกค้าค้างชำระ/ลูกค้า
// ผู้ใช้สามารถเรียก v10PrintPaymentReceipt(name, amount, method, note) ได้โดยตรง

// Inject print button into debt page after rendering
const _v10OrigRenderDebts = window.renderDebts;
window.renderDebts = async function() {
  if (_v10OrigRenderDebts) await _v10OrigRenderDebts();
  // Add print buttons next to each payment button
  setTimeout(() => {
    document.querySelectorAll('#page-debt button[onclick*="recordDebtPayment"]').forEach(btn => {
      if (btn.parentElement.querySelector('.v10-print-receipt-btn')) return;
      const match = btn.getAttribute('onclick')?.match(/recordDebtPayment\('([^']+)','([^']+)'\)/);
      if (!match) return;
      const [, custId, custName] = match;
      const printBtn = document.createElement('button');
      printBtn.className = 'btn btn-outline btn-sm v10-print-receipt-btn';
      printBtn.style.marginLeft = '6px';
      printBtn.innerHTML = '<i class="material-icons-round">print</i>';
      printBtn.title = 'พิมพ์ใบรับเงินล่าสุด';
      printBtn.onclick = async () => {
        const { data: last } = await db.from('ชำระหนี้').select('*')
          .eq('customer_id', custId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (last) v10PrintPaymentReceipt(custName.replace(/&apos;/g, "'"), last.amount, last.method || 'เงินสด', '');
        else typeof toast === 'function' && toast('ยังไม่มีประวัติรับชำระ', 'info');
      };
      btn.parentElement.appendChild(printBtn);
    });
  }, 400);
};


// ══════════════════════════════════════════════════════════════════
// V10-8  FIX: หน้าพนักงาน — go('att') เรียก local renderAttendance
//        แทนที่จะเรียก window.renderAttendance (v5 tabbed version)
//        แก้: Monkey-patch app.js go() by wrapping it
//        
//        Problem: app.js has `function go(page) { ... case 'att': renderAttendance(); }`
//        where `renderAttendance()` is a LOCAL function (line 1496 of app.js).
//        Even though modules-v5.js sets `window.renderAttendance`, the local scope wins.
//        
//        Solution: After app.js loads, we wrap window.go to intercept att/payable
//        and call the window.* version instead. We use the original go() for
//        the navigation parts (setting currentPage, showing/hiding sections),
//        then call window.renderAttendance afterwards.
// ══════════════════════════════════════════════════════════════════

(function v10FixAttendancePage() {
  function patchGo() {
    if (typeof window.go !== 'function') return false;
    if (window.go._v10Patched) return true;
    
    const origGo = window.go;
    
    window.go = function(page) {
      // For att and payable, we let the original go() run (which calls the local function),
      // then IMMEDIATELY re-render with the window.* version (overwriting what the local rendered).
      origGo.apply(this, arguments);
      
      if (page === 'att' && typeof window.renderAttendance === 'function') {
        // Re-render with v5 tabbed version (overwrites what local renderAttendance did)
        setTimeout(() => window.renderAttendance(), 50);
      }
      if (page === 'payable' && typeof window.renderPayables === 'function') {
        // Re-render with v10-9 version
        setTimeout(() => window.renderPayables(), 50);
      }
    };
    
    window.go._v10Patched = true;
    console.log('[v10-8] ✅ go() patched — att uses window.renderAttendance, payable uses window.renderPayables');
    return true;
  }
  
  // Try patching multiple times to be safe
  function tryPatch() {
    if (!patchGo()) {
      setTimeout(tryPatch, 200);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryPatch);
  } else {
    tryPatch();
  }
  // Also try on window.load as extra safety
  window.addEventListener('load', () => setTimeout(tryPatch, 200));
})();


// ══════════════════════════════════════════════════════════════════
// V10-9  FIX: (no change — kept from previous)
// ══════════════════════════════════════════════════════════════════
// (renderPayables override is above, unchanged)


// ══════════════════════════════════════════════════════════════════
// V10-10  FIX: Mobile POS — ซ่อนตะกร้า/รายการขายบนมือถือ
//         จะแสดงเฉพาะเมื่อกดปุ่ม FAB (ตะกร้า)
//         + สร้าง cart-overlay element ถ้ายังไม่มี
//         + แก้ overflow ขวาในทุกหน้าบนมือถือ
// ══════════════════════════════════════════════════════════════════

(function v10MobileCartFix() {
  // 1. สร้าง cart-overlay if missing
  function ensureCartOverlay() {
    if (!document.getElementById('cart-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'cart-overlay';
      overlay.className = 'sidebar-overlay'; // reuse same CSS
      const posLayout = document.querySelector('.pos-layout');
      if (posLayout) {
        posLayout.appendChild(overlay);
        // Click overlay → close cart
        overlay.addEventListener('click', () => {
          document.querySelector('.pos-cart')?.classList.remove('cart-open');
          overlay.classList.remove('show');
        });
        console.log('[v10-10] ✅ cart-overlay element created');
      }
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureCartOverlay);
  } else {
    ensureCartOverlay();
  }
  
  // 2. Inject comprehensive mobile CSS
  const style = document.createElement('style');
  style.id = 'v10-mobile-fixes';
  style.textContent = `
    @media (max-width: 768px) {
      /* ═══ GLOBAL: ป้องกัน overflow ขวาทุกหน้า ═══ */
      html, body, .app-layout, .main-content, .content-area {
        max-width: 100vw !important;
        overflow-x: hidden !important;
      }
      
      /* ═══ POS: ซ่อนตะกร้าบนมือถือ — แสดงเมื่อกด FAB ═══ */
      .pos-cart {
        position: fixed !important;
        bottom: -100% !important;
        left: 0 !important;
        width: 100% !important;
        z-index: 1060 !important;
        height: 85vh !important;
        max-height: 85vh !important;
        border-radius: 20px 20px 0 0 !important;
        box-shadow: 0 -4px 30px rgba(0,0,0,0.2) !important;
        background: var(--bg-surface) !important;
        transition: bottom 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        border: none !important;
        margin: 0 !important;
      }
      .pos-cart.cart-open {
        bottom: 0 !important;
      }
      
      /* Cart Header — pill indicator for swipe */
      .pos-cart .cart-header {
        position: relative;
        cursor: pointer;
      }
      .pos-cart .cart-header::after {
        content: '';
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 5px;
        background: rgba(255,255,255,0.5);
        border-radius: 10px;
      }
      
      /* Cart items scrollable */
      .pos-cart .cart-items {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
      }
      
      /* Cart summary compact on mobile */
      .pos-cart .cart-summary {
        padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
      }
      
      /* ซ่อน elements ที่ไม่จำเป็นในตะกร้ามือถือ */
      .pos-cart .print-format {
        display: none !important;
      }
      
      /* ปุ่มชำระเงิน — โดดเด่น */
      .pos-cart .btn-checkout {
        display: flex !important;
        width: 100% !important;
        font-size: 16px !important;
        padding: 14px !important;
        margin: 8px 0 0 0 !important;
        border-radius: 14px !important;
      }
      
      /* FAB button */
      .cart-fab {
        display: flex !important;
      }
      
      /* ═══ ATTENDANCE: แก้ overflow ขวา ═══ */
      #page-att, #page-att > div {
        max-width: 100% !important;
        overflow-x: hidden !important;
      }
      /* เช็คชื่อ grid → 1 column */
      #att-tab-checkin > div > div[style*="grid-template-columns"] {
        grid-template-columns: 1fr !important;
      }
      /* Attendance tab buttons scroll horizontal */
      #page-att > div > div:first-child {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }
      
      /* ═══ PAYABLES: grid responsive ═══ */
      #page-payable div[style*="grid-template-columns"][style*="repeat(auto-fit"] {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      
      /* ═══ CHECKOUT: full screen on mobile ═══ */
      .checkout-overlay {
        padding: 0 !important;
      }
      .checkout-overlay > div,
      .checkout-modal {
        width: 100% !important;
        max-width: 100% !important;
        max-height: 100vh !important;
        height: 100vh !important;
        border-radius: 0 !important;
        margin: 0 !important;
      }
      .checkout-content {
        max-height: calc(100vh - 140px) !important;
        overflow-y: auto !important;
        padding: 12px !important;
      }
      
      /* ═══ DENOMINATION GRID compact ═══ */
      .denomination-grid,
      div[style*="grid-template-columns: repeat(5"] {
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 6px !important;
      }
      
      /* ═══ TABLE overflow fix ═══ */
      .table-wrapper {
        overflow-x: hidden !important;
        width: 100% !important;
        max-width: 100% !important;
      }
    }
    
    @media (max-width: 480px) {
      #page-payable div[style*="grid-template-columns"][style*="repeat(auto-fit"] {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
  console.log('[v10-10] ✅ Mobile cart + overflow CSS injected');
})();

window.renderPayables = async function () {
  if (window._isRenderingPayables) return;
  window._isRenderingPayables = true;
  
  try {
    const section = document.getElementById('page-payable');
    if (!section) return;

  section.innerHTML = `
    <div style="padding:80px;text-align:center;color:#94a3b8">
      <div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#dc2626;border-radius:50%;animation:v10spin .8s linear infinite;margin:0 auto 16px"></div>
      <style>@keyframes v10spin{to{transform:rotate(360deg)}}</style>
      <div style="font-weight:600;">กำลังโหลดข้อมูลเจ้าหนี้...</div>
    </div>`;

  let rows = [], poMap = {};
  try {
    const { data: apData, error: apErr } = await db.from('เจ้าหนี้')
      .select('id,supplier_id,purchase_order_id,date,due_date,amount,paid_amount,balance,status,note')
      .order('due_date', {ascending: true})
      .limit(300);

    if (apErr) console.error('[v10-9] เจ้าหนี้ query:', apErr.message);
    rows = apData || [];

    const poIds = [...new Set(rows.map(r => r.purchase_order_id).filter(Boolean))];
    if (poIds.length > 0) {
      const { data: pos } = await db.from('purchase_order')
        .select('id,supplier').in('id', poIds);
      (pos||[]).forEach(p => { poMap[p.id] = p.supplier || ''; });
    }

    const noPoRows = rows.filter(r => !r.purchase_order_id && r.supplier_id);
    const suppIds = [...new Set(noPoRows.map(r => r.supplier_id).filter(Boolean))];
    if (suppIds.length > 0) {
      const { data: supps } = await db.from('ซัพพลายเออร์')
        .select('id,name,phone').in('id', suppIds);
      (supps||[]).forEach(s => {
        poMap['supp_' + s.id] = s.name || '';
        poMap['supp_phone_' + s.id] = s.phone || '';
      });
    }
  } catch(e) { console.error('[v10-9]', e); }

  function getSupplierName(r) {
    if (r.purchase_order_id && poMap[r.purchase_order_id]) return poMap[r.purchase_order_id];
    if (r.supplier_id && poMap['supp_' + r.supplier_id]) return poMap['supp_' + r.supplier_id];
    return 'ไม่ระบุ';
  }
  function getSupplierPhone(r) {
    if (r.supplier_id && poMap['supp_phone_' + r.supplier_id]) return poMap['supp_phone_' + r.supplier_id];
    return '';
  }

  const pending   = rows.filter(r => r.status === 'ค้างชำระ');
  const totalDebt = pending.reduce((s,r) => s + parseFloat(r.balance||0), 0);
  const overdue   = pending.filter(r => r.due_date && new Date(r.due_date) < new Date());

  const style = `
  <style>
    .payable-container { padding: 24px; max-width: 1200px; margin: 0 auto; animation: fade-in-up 0.4s ease-out; }
    @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .payable-hero { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 16px; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.1); flex-wrap: wrap; gap: 20px; }
    .payable-hero-left h2 { color: #1e3a8a; font-size: 24px; font-weight: 700; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px; }
    .payable-hero-left p { color: #1d4ed8; margin: 0; font-size: 14px; opacity: 0.9; }
    .payable-stat-boxes { display: flex; gap: 12px; flex-wrap: wrap; }
    .payable-stat-box { background: #fff; border-radius: 12px; padding: 14px 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); min-width: 150px; border: 1px solid #fff; flex: 1; }
    .payable-stat-box .lbl { font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
    .payable-stat-box .val { font-size: 24px; font-weight: 800; color: #1e293b; line-height: 1.1; }
    .payable-stat-box.danger .val { color: #dc2626; }
    .payable-stat-box.warning .val { color: #d97706; }
    .payable-stat-box.success .val { color: #15803d; }
    .payable-table-card { background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; overflow-x: auto; }
    .payable-table { width: 100%; border-collapse: collapse; min-width: 900px; }
    .payable-table th { background: #f8fafc; color: #475569; font-size: 13px; font-weight: 600; padding: 16px 20px; text-align: left; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
    .payable-table td { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
    .payable-table tbody tr:hover { background: #f0f9ff; }
    .payable-cust-name { font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 14px; }
    .payable-avatar { width: 42px; height: 42px; border-radius: 12px; background: #dbeafe; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; }
    .payable-amt { font-weight: 800; color: #dc2626; font-size: 15px; }
    .payable-actions { display: flex; gap: 8px; justify-content: center; }
    .btn-pay-ap { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; font-family: inherit; font-size: 13px; }
    .btn-pay-ap:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25); }
    .status-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-block; }
    .status-badge.pending { background: #fef2f2; color: #dc2626; }
    .status-badge.paid { background: #f0fdf4; color: #15803d; }
    @media (max-width: 768px) { .payable-hero { flex-direction: column; align-items: flex-start; } .payable-stat-boxes { width: 100%; } }
  </style>`;

  const tableRows = rows.map(r => {
    const suppName = getSupplierName(r);
    const suppPhone = getSupplierPhone(r);
    const isOverdue = r.due_date && new Date(r.due_date) < new Date() && r.status === 'ค้างชำระ';
    const balance = parseFloat(r.balance || 0);
    const amount = parseFloat(r.amount || 0);
    const paid = parseFloat(r.paid_amount || 0);
    const pct = amount > 0 ? Math.round(paid / amount * 100) : 0;
    const initial = suppName.charAt(0).toUpperCase();
    
    return `
      <tr style="${isOverdue ? 'background:#fff5f5;' : ''}">
        <td>
          <div class="payable-cust-name">
            <div class="payable-avatar">${initial}</div>
            <div>
              <div style="font-size:15px;line-height:1.2;">${suppName}</div>
              ${suppPhone ? `<div style="font-size:12px;color:#64748b;font-weight:400;margin-top:4px;"><i class="material-icons-round" style="font-size:12px;vertical-align:middle">phone</i> ${suppPhone}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="font-size:13px;color:#64748b;">${r.date ? new Date(r.date).toLocaleDateString('th-TH') : '-'}</td>
        <td style="font-size:13px;${isOverdue ? 'color:#dc2626;font-weight:700;' : 'color:#64748b;'}">
          ${r.due_date ? new Date(r.due_date).toLocaleDateString('th-TH') : '-'}
          ${isOverdue ? '<div style="margin-top:4px;font-size:10px;background:#fef2f2;color:#dc2626;padding:2px 6px;border-radius:4px;display:inline-block;">เกินกำหนด</div>' : ''}
        </td>
        <td style="text-align:right;font-size:14px;color:#475569;">฿${formatNum(amount)}</td>
        <td style="text-align:right;font-size:14px;color:#15803d;">฿${formatNum(paid)}</td>
        <td style="text-align:right;"><span class="payable-amt">฿${formatNum(balance)}</span></td>
        <td style="text-align:center;">
          <span class="status-badge ${r.status === 'ชำระแล้ว' ? 'paid' : 'pending'}">${r.status || 'ค้างชำระ'}</span>
        </td>
        <td style="text-align:center;">
          ${r.status === 'ค้างชำระ' ? `
            <div class="payable-actions">
              <button class="btn-pay-ap" onclick="window.v9PayCreditor('${r.id}','${suppName.replace(/'/g, "\\'")}',${balance},${amount})">
                <i class="material-icons-round" style="font-size:16px;">payment</i> ชำระเงิน
              </button>
            </div>
          ` : `<span style="color:#94a3b8;font-size:12px;font-weight:600;"><i class="material-icons-round" style="font-size:16px;vertical-align:middle;color:#10b981;">check_circle</i> ชำระครบแล้ว</span>`}
        </td>
      </tr>`;
  }).join('');

  section.innerHTML = `${style}
    <div class="payable-container">
      <div class="payable-hero">
        <div class="payable-hero-left">
          <h2><i class="material-icons-round" style="font-size:28px;">account_balance</i> จัดการเจ้าหนี้ร้าน</h2>
          <p>ระบบติดตามและชำระเงินผู้จำหน่าย (Supplier)</p>
        </div>
        <div class="payable-stat-boxes">
          <div class="payable-stat-box danger">
            <div class="lbl"><i class="material-icons-round" style="font-size:16px;color:#dc2626;">account_balance</i> ค้างชำระรวม</div>
            <div class="val">฿${formatNum(Math.round(totalDebt))}</div>
          </div>
          <div class="payable-stat-box warning">
            <div class="lbl"><i class="material-icons-round" style="font-size:16px;color:#d97706;">receipt_long</i> รายการค้างชำระ</div>
            <div class="val">${pending.length}</div>
          </div>
          <div class="payable-stat-box warning">
            <div class="lbl"><i class="material-icons-round" style="font-size:16px;color:#d97706;">warning</i> เกินกำหนด</div>
            <div class="val">${overdue.length}</div>
          </div>
          <div class="payable-stat-box success">
            <div class="lbl"><i class="material-icons-round" style="font-size:16px;color:#15803d;">check_circle</i> ชำระแล้ว</div>
            <div class="val">${rows.filter(r => r.status === 'ชำระแล้ว').length}</div>
          </div>
        </div>
      </div>

      <div class="payable-table-card">
        ${rows.length === 0 ? `
          <div style="padding:60px;text-align:center;color:#64748b;">
            <i class="material-icons-round" style="font-size:48px;color:#cbd5e1;margin-bottom:12px;">storefront</i>
            <h3 style="margin:0;font-size:18px;color:#1e293b;">ไม่มีรายการเจ้าหนี้</h3>
            <p style="margin:8px 0 0;font-size:14px;">สถานะการเงินปกติ ไม่มีหนี้สินกับซัพพลายเออร์</p>
          </div>
        ` : `
          <table class="payable-table">
            <thead>
              <tr>
                <th>ผู้จำหน่าย</th>
                <th>วันที่</th>
                <th>ครบกำหนด</th>
                <th style="text-align:right;">ยอดรวม</th>
                <th style="text-align:right;">ชำระแล้ว</th>
                <th style="text-align:right;">คงค้าง</th>
                <th style="text-align:center;">สถานะ</th>
                <th style="text-align:center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        `}
      </div>
    </div>`;
  } finally {
    window._isRenderingPayables = false;
  }
};
console.log('[v10-9] ✅ renderPayables overridden — uses purchase_order.supplier name');




// ══════════════════════════════════════════════════════════════════
// V10-11  FIX: Return — เพิ่ม cost data ใน return_info
//         เพื่อให้ระบบ Dashboard/P&L หักกำไรจากต้นทุนสินค้าได้ถูกต้อง
// ══════════════════════════════════════════════════════════════════

// Patch v10ConfirmReturn: เพิ่ม cost ใน return_items
const _v10OrigConfirmReturn = window.v10ConfirmReturn;
window.v10ConfirmReturn = async function() {
  // Before calling original, inject cost into items
  const items = window._v10ReturnItems || [];
  const bill = window._v10ReturnBill;
  if (bill && items.length > 0) {
    // ดึง cost จาก รายการในบิล
    try {
      const { data: billItems } = await db.from('รายการในบิล')
        .select('name,cost,product_id')
        .eq('bill_id', bill.id);
      const costMap = {};
      (billItems||[]).forEach(bi => {
        costMap[bi.product_id] = bi.cost || 0;
        costMap[bi.name] = bi.cost || 0;
      });
      items.forEach(it => {
        if (!it.cost && it.cost !== 0) {
          it.cost = costMap[it.product_id] || costMap[it.name] || 0;
        }
      });
    } catch(e) { console.warn('[v10-11] cost lookup:', e); }
  }
  // Call original
  return _v10OrigConfirmReturn?.apply(this, arguments);
};

// Patch the return_info update to include cost in return_items
const _v10OrigShowReturnModal = window.v10ShowReturnModal;
window.v10ShowReturnModal = async function(billId) {
  // Call original first
  await _v10OrigShowReturnModal?.apply(this, arguments);
  
  // After modal is shown, inject cost data into _v10ReturnItems
  const bill = window._v10ReturnBill;
  const items = window._v10ReturnItems;
  if (bill && items && items.length > 0) {
    try {
      const { data: billItems } = await db.from('รายการในบิล')
        .select('name,cost,product_id')
        .eq('bill_id', bill.id);
      const costMap = {};
      (billItems||[]).forEach(bi => {
        if (bi.product_id) costMap[bi.product_id] = bi.cost || 0;
        if (bi.name) costMap[bi.name] = bi.cost || 0;
      });
      items.forEach(it => {
        it.cost = costMap[it.product_id] || costMap[it.name] || 0;
      });
    } catch(e) { console.warn('[v10-11] cost injection:', e); }
  }
};
console.log('[v10-11] ✅ Return cost tracking patched');


// ══════════════════════════════════════════════════════════════════
// BOOT LOG
// ══════════════════════════════════════════════════════════════════

console.info(
  '%c[modules-v10.js] ✅%c ' + [
    'V10-1:ReceiptSettings',
    'V10-2:QuotationRedesign',
    'V10-3:ReturnRefund',
    'V10-4:CancelBillFix',
    'V10-5:A4ReceiptRedesign',
    'V10-6:PaymentReceipt',
    'V10-7:ReturnSlipPrint',
    'V10-8:EmployeePageFix',
    'V10-9:CreditorPageFix',
    'V10-10:MobilePaymentHide',
    'V10-11:ReturnCostTrack'
  ].join(' | '),
  'color:#8B5CF6;font-weight:700',
  'color:#6B7280'
);
