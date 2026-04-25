/**
 * SK POS — modules-v21.js  (โหลดหลัง modules-v20.js)
 *
 * ████████████████████████████████████████████████████████████████████
 *  V21-1  QR CODE SETTINGS — ตั้งค่า QR Code แยกตามประเภทเอกสาร
 *         3 โหมด: PromptPay / รูปภาพ URL / ไม่แสดง
 *         ตั้งค่า: เบอร์พร้อมเพย์ override, รวมยอดใน QR, ข้อความใต้ QR
 *
 *  V21-2  DOC SETTINGS UI OVERRIDE — override v10RenderDocSettingsInto
 *         เพิ่ม QR settings panel + live preview ปรับปรุงใหม่
 *
 *  V21-3  PRINT PATCH — patch print80mmv2 + printReceiptA4v2
 *         ให้ใช้ qr_type / qr_custom_url / qr_promptpay จาก doc_settings
 * ████████████████████████████████████████████████████████████████████
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// V21 DEFAULT QR CONFIG — merge เข้า V10_DEFAULTS
// ══════════════════════════════════════════════════════════════════

const V21_QR_DEFAULTS = {
  receipt_80mm:    { qr_type: 'promptpay', qr_promptpay: '', qr_with_amount: true,  qr_label: 'สแกนเพื่อชำระเงิน', qr_sub_label: 'Scan to Pay' },
  receipt_a4:      { qr_type: 'promptpay', qr_promptpay: '', qr_with_amount: true,  qr_label: 'สแกนเพื่อชำระเงิน', qr_sub_label: 'Scan to Pay' },
  quotation:       { qr_type: 'none',      qr_promptpay: '', qr_with_amount: false, qr_label: 'สแกน QR',           qr_sub_label: '' },
  payment_receipt: { qr_type: 'promptpay', qr_promptpay: '', qr_with_amount: true,  qr_label: 'สแกนเพื่อชำระเงิน', qr_sub_label: 'Scan to Pay' },
};

// Inject V21 defaults into V10_DEFAULTS (ถ้ายังไม่มี)
if (typeof V10_DEFAULTS !== 'undefined') {
  for (const [k, v] of Object.entries(V21_QR_DEFAULTS)) {
    if (V10_DEFAULTS[k]) Object.assign(V10_DEFAULTS[k], { ...v, ...V10_DEFAULTS[k] });
  }
}

// ══════════════════════════════════════════════════════════════════
// V21-1: CSS INJECTION
// ══════════════════════════════════════════════════════════════════

(function injectV21CSS() {
  if (document.getElementById('sk-v21-css')) return;
  const s = document.createElement('style');
  s.id = 'sk-v21-css';
  s.textContent = `
    /* V21 QR Mode Buttons */
    .v21-qr-mode-btn {
      display:flex; flex-direction:column; align-items:center; gap:4px;
      padding:10px 8px; border:2px solid var(--border-light);
      border-radius:10px; background:var(--bg-base); cursor:pointer;
      font-family:var(--font-thai,Prompt),sans-serif; font-size:12px;
      font-weight:600; color:var(--text-secondary); transition:all .15s;
      flex:1; min-width:0;
    }
    .v21-qr-mode-btn:hover { border-color:var(--primary); color:var(--primary); }
    .v21-qr-mode-btn.active {
      border-color:var(--primary); background:color-mix(in srgb,var(--primary) 8%,transparent);
      color:var(--primary);
    }
    .v21-qr-mode-btn .v21-qr-icon { font-size:22px; line-height:1; }

    /* V21 QR Preview Box */
    .v21-qr-preview-box {
      background:#fff; border:1px solid var(--border-light); border-radius:10px;
      padding:12px; display:flex; flex-direction:column; align-items:center;
      gap:6px; min-height:80px; justify-content:center;
    }
    .v21-qr-preview-box img { width:80px; height:80px; border-radius:6px; }

    /* V21 Field group */
    .v21-field { margin-bottom:10px; }
    .v21-field label { display:block; font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; }
    .v21-field input, .v21-field textarea {
      width:100%; padding:8px 10px; border:1px solid var(--border-light);
      border-radius:8px; font-family:var(--font-thai,Prompt),sans-serif;
      font-size:13px; background:var(--bg-base); color:var(--text-primary);
      outline:none; transition:.15s;
    }
    .v21-field input:focus, .v21-field textarea:focus { border-color:var(--primary); }

    /* V21 Section header */
    .v21-section-hdr {
      display:flex; align-items:center; gap:6px;
      font-size:12px; font-weight:700; color:var(--primary);
      margin-bottom:10px; padding-bottom:6px;
      border-bottom:1px solid var(--border-light);
    }
    .v21-section-hdr .material-icons-round { font-size:16px; }

    /* V21 QR card */
    .v21-qr-card {
      background:var(--bg-surface); border:1px solid var(--border-light);
      border-radius:var(--radius-lg,12px); padding:16px; margin-top:12px;
    }

    /* V21 inline toggle */
    .v21-inline-toggle {
      display:flex; align-items:center; justify-content:space-between;
      padding:8px 0; border-bottom:0.5px solid var(--border-light);
    }
    .v21-inline-toggle:last-child { border-bottom:none; }
    .v21-inline-toggle span { font-size:13px; }
    .v21-sw { position:relative; width:40px; height:22px; flex-shrink:0; }
    .v21-sw input { opacity:0; width:0; height:0; }
    .v21-sw-track {
      position:absolute; inset:0; border-radius:22px; transition:.2s;
      cursor:pointer;
    }
    .v21-sw input:checked ~ .v21-sw-track { background:var(--primary); }
    .v21-sw input:not(:checked) ~ .v21-sw-track { background:#CBD5E1; }
    .v21-sw-thumb {
      position:absolute; top:2px; width:18px; height:18px; border-radius:50%;
      background:#fff; transition:.2s; box-shadow:0 1px 3px rgba(0,0,0,.2);
      pointer-events:none;
    }
    .v21-sw input:checked ~ .v21-sw-thumb { left:20px; }
    .v21-sw input:not(:checked) ~ .v21-sw-thumb { left:2px; }

    /* V21 Save btn bar */
    .v21-save-bar {
      position:sticky; bottom:0; background:var(--bg-surface);
      border-top:1px solid var(--border-light); padding:12px 0 0;
      margin-top:16px;
    }
  `;
  document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════════════════
// V21-2: QR HTML BUILDER — ใช้ในทั้ง preview และ print
// ══════════════════════════════════════════════════════════════════

/**
 * สร้าง QR HTML block สำหรับใส่ในใบเสร็จ
 * @param {object} s      - doc_settings ของ doc type นั้น (มี qr_type, qr_promptpay, qr_custom_url ฯลฯ)
 * @param {object} rc     - shop config (มี promptpay_number)
 * @param {number} amount - ยอดเงิน (สำหรับ promptpay with amount)
 * @param {'80mm'|'a4'} size - ขนาด QR
 * @returns {string} HTML string
 */
window.v21BuildQRHtml = function(s, rc, amount = 0, size = '80mm') {
  if (s.show_qr === false) return '';
  const qrType = s.qr_type || 'promptpay';
  if (qrType === 'none') return '';

  const label    = s.qr_label    || 'สแกนเพื่อชำระเงิน';
  const subLabel = s.qr_sub_label || '';
  const dim = size === 'a4' ? 96 : 80;

  if (qrType === 'custom') {
    const url = s.qr_custom_url || '';
    if (!url) return '';
    if (size === 'a4') {
      return `
        <div style="background:#fff;border:1px solid #e2e8f030;padding:10px;border-radius:12px;width:${dim+32}px;display:flex;flex-direction:column;align-items:center;gap:5px;">
          <img src="${url}" style="width:${dim}px;height:${dim}px;border-radius:6px;" onerror="this.style.display='none'">
          <p style="font-size:9px;font-weight:700;color:#1e293b;margin:0;">${label}</p>
          ${subLabel ? `<p style="font-size:7px;color:#94a3b8;margin:0;">${subLabel}</p>` : ''}
        </div>`;
    }
    return `
      <div style="text-align:center;margin:6px 0;">
        <img src="${url}" style="width:${dim}px;height:${dim}px;" onerror="this.style.display='none'">
        <div style="font-size:9px;margin-top:3px;">${label}</div>
      </div>`;
  }

  // PromptPay
  const ppRaw = s.qr_promptpay || rc?.promptpay_number || '';
  const pp = ppRaw.replace(/[^0-9]/g, '');
  if (!pp || pp.length < 10) return '';

  const qrSrc = (s.qr_with_amount !== false && amount > 0)
    ? `https://promptpay.io/${pp}/${amount}.png`
    : `https://promptpay.io/${pp}.png`;

  if (size === 'a4') {
    return `
      <div style="background:#fff;border:1px solid #e2e8f030;padding:10px;border-radius:12px;width:${dim+32}px;display:flex;flex-direction:column;align-items:center;gap:5px;">
        <div style="background:#003b71;width:100%;padding:3px 0;border-radius:5px;text-align:center;">
          <span style="color:#fff;font-size:9px;font-weight:700;">PromptPay</span>
        </div>
        <img src="${qrSrc}" style="width:${dim}px;height:${dim}px;" onerror="this.style.display='none'">
        <p style="font-size:8px;font-weight:700;color:#003b71;margin:0;">${label}</p>
        ${subLabel ? `<p style="font-size:7px;color:#94a3b8;margin:0;">${subLabel}</p>` : ''}
        <p style="font-size:7px;color:#64748b;margin:0;">${ppRaw}</p>
      </div>`;
  }

  return `
    <div style="text-align:center;margin:6px 0;">
      <div style="background:#003b71;display:inline-block;padding:2px 10px;border-radius:4px;margin-bottom:3px;">
        <span style="color:#fff;font-size:9px;font-weight:700;">PromptPay</span>
      </div>
      <div><img src="${qrSrc}" style="width:${dim}px;height:${dim}px;" onerror="this.style.display='none'"></div>
      <div style="font-size:9px;">${label}</div>
      <div style="font-size:8px;color:#777;">${ppRaw}</div>
    </div>`;
};

// ══════════════════════════════════════════════════════════════════
// V21-3: ADMIN UI — override v10RenderDocSettingsInto
// ══════════════════════════════════════════════════════════════════

window.v10RenderDocSettingsInto = async function(container) {
  if (!container) return;
  const settings = await v10GetDocSettings();
  const rc       = await v10GetShopConfig();

  // เติม QR defaults ถ้าขาด
  for (const [k, def] of Object.entries(V21_QR_DEFAULTS)) {
    if (!settings[k]) settings[k] = {};
    for (const [f, v] of Object.entries(def)) {
      if (settings[k][f] === undefined) settings[k][f] = v;
    }
  }
  if (typeof _v10DocSettings !== 'undefined') window._v10DocSettings = settings;

  const tabs = [
    { key: 'receipt_80mm',    label: 'ใบเสร็จ 80mm',  icon: 'receipt' },
    { key: 'receipt_a4',      label: 'ใบเสร็จ A4',     icon: 'description' },
    { key: 'quotation',       label: 'ใบเสนอราคา',     icon: 'request_quote' },
    { key: 'payment_receipt', label: 'ใบรับเงิน',      icon: 'payments' },
  ];

  const activeKey = (typeof _v10ActiveDocTab !== 'undefined' ? _v10ActiveDocTab : null) || 'receipt_80mm';
  const s = { ...(V10_DEFAULTS?.[activeKey] || {}), ...(settings[activeKey] || {}) };
  const isA4Type = activeKey !== 'receipt_80mm';

  // ─── Toggle field definitions per doc type ────────────────────
  const TOGGLE_FIELDS = {
    receipt_80mm: [
      ['show_shop_name', 'ชื่อร้านค้า'],
      ['show_address',   'ที่อยู่ร้านค้า'],
      ['show_tax_id',    'เลขผู้เสียภาษี'],
      ['show_bill_no',   'เลขที่บิล'],
      ['show_datetime',  'วันที่และเวลา'],
      ['show_customer',  'ชื่อลูกค้า'],
      ['show_staff',     'ชื่อพนักงาน'],
      ['show_method',    'วิธีชำระเงิน'],
      ['show_discount',  'ส่วนลด'],
      ['show_received',  'ยอดรับ/เงินทอน'],
      ['show_cost',      'ต้นทุนสินค้า'],
      ['show_profit',    'กำไรขั้นต้น'],
    ],
    receipt_a4: [
      ['show_shop_name', 'ชื่อร้านค้า'],
      ['show_address',   'ที่อยู่ร้านค้า'],
      ['show_tax_id',    'เลขผู้เสียภาษี'],
      ['show_bill_no',   'เลขที่บิล'],
      ['show_datetime',  'วันที่และเวลา'],
      ['show_customer',  'ชื่อลูกค้า'],
      ['show_staff',     'ชื่อพนักงาน'],
      ['show_method',    'วิธีชำระเงิน'],
      ['show_discount',  'ส่วนลด'],
      ['show_received',  'ยอดรับ/เงินทอน'],
      ['show_cost',      'ต้นทุนสินค้า'],
    ],
    quotation: [
      ['show_shop_name', 'ชื่อร้านค้า'],
      ['show_address',   'ที่อยู่ร้านค้า'],
      ['show_tax_id',    'เลขผู้เสียภาษี'],
      ['show_customer',  'ชื่อลูกค้า'],
      ['show_staff',     'ผู้ออกเอกสาร'],
      ['show_discount',  'ส่วนลด'],
      ['show_validity',  'วันที่หมดอายุ'],
      ['show_note',      'หมายเหตุ'],
      ['show_signature', 'ลายเซ็น/ตราประทับ'],
    ],
    payment_receipt: [
      ['show_shop_name', 'ชื่อร้านค้า'],
      ['show_address',   'ที่อยู่ร้านค้า'],
      ['show_tax_id',    'เลขผู้เสียภาษี'],
      ['show_customer',  'ชื่อลูกค้า'],
      ['show_staff',     'ชื่อพนักงาน'],
      ['show_datetime',  'วันที่และเวลา'],
      ['show_method',    'วิธีชำระ'],
    ],
  };

  const fields = TOGGLE_FIELDS[activeKey] || [];
  const qrType = s.qr_type || 'promptpay';
  const ppDisplay = s.qr_promptpay || rc?.promptpay_number || '';
  const hc = s.bw_mode ? '#000' : (s.header_color || '#af101a');

  // ─── Build QR preview html (for admin display, not print) ─────
  const qrPreviewHtml = v21BuildQRAdminPreview(s, rc, qrType);

  // ─── Build color swatches ────────────────────────────────────
  const SWATCHES = ['#af101a','#1e293b','#dc2626','#1d4ed8','#15803d','#7c3aed','#b45309','#000000'];
  const swatchHtml = SWATCHES.map(c => `
    <div onclick="v10SetHeaderColor('${c}')"
      title="${c}"
      style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;
        border:3px solid ${(s.header_color||'#af101a')===c ? 'var(--primary)' : 'rgba(0,0,0,0.08)'};
        transition:.15s;flex-shrink:0;">
    </div>`).join('');

  container.innerHTML = `
    <!-- ── Doc Type Sub-tabs ── -->
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border-light);margin-bottom:20px;overflow-x:auto;">
      ${tabs.map(t => `
        <button onclick="_v10ActiveDocTab='${t.key}';v9RenderAdminTab('docs')"
          style="padding:10px 16px;border:none;background:none;cursor:pointer;
            font-family:var(--font-thai,Prompt),sans-serif;font-size:13px;
            border-bottom:2px solid ${activeKey===t.key?'var(--primary)':'transparent'};
            margin-bottom:-2px;
            color:${activeKey===t.key?'var(--primary)':'var(--text-secondary)'};
            font-weight:${activeKey===t.key?'700':'400'};
            white-space:nowrap;display:flex;align-items:center;gap:5px;transition:all .15s;">
          <i class="material-icons-round" style="font-size:16px;">${t.icon}</i>${t.label}
        </button>`).join('')}
    </div>

    <!-- ── Two-column layout ── -->
    <div style="display:grid;grid-template-columns:minmax(280px,340px) 1fr;gap:20px;align-items:start;">

      <!-- ══ LEFT COLUMN ══ -->
      <div>

        <!-- Toggle Fields Card -->
        <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg,12px);overflow:hidden;">
          <div style="padding:12px 16px;background:var(--bg-hover);border-bottom:1px solid var(--border-light);">
            <div class="v21-section-hdr" style="margin-bottom:0;border-bottom:none;padding-bottom:0;">
              <i class="material-icons-round">toggle_on</i>ข้อมูลที่แสดงในเอกสาร
            </div>
          </div>
          ${fields.map(([key, label]) => {
            const on = s[key] !== false;
            return `
              <div class="v21-inline-toggle" style="padding:10px 16px;">
                <span style="font-size:13px;">${label}</span>
                <label class="v21-sw">
                  <input type="checkbox" data-toggle-key="${key}" ${on ? 'checked' : ''}
                    onchange="v10ToggleField('${key}',this.checked)">
                  <div class="v21-sw-track"></div>
                  <div class="v21-sw-thumb"></div>
                </label>
              </div>`;
          }).join('')}
        </div>

        <!-- ══ QR CODE SETTINGS CARD ══ -->
        <div class="v21-qr-card">
          <div class="v21-section-hdr">
            <i class="material-icons-round">qr_code_2</i>
            ตั้งค่า QR Code
          </div>

          <!-- Mode Selector -->
          <div style="display:flex;gap:8px;margin-bottom:14px;">
            <button class="v21-qr-mode-btn ${qrType==='none'?'active':''}"
              onclick="v21SetQRType('none')">
              <span class="v21-qr-icon">🚫</span>ไม่แสดง
            </button>
            <button class="v21-qr-mode-btn ${qrType==='promptpay'?'active':''}"
              onclick="v21SetQRType('promptpay')">
              <span class="v21-qr-icon">📱</span>PromptPay
            </button>
            <button class="v21-qr-mode-btn ${qrType==='custom'?'active':''}"
              onclick="v21SetQRType('custom')">
              <span class="v21-qr-icon">🖼️</span>URL รูปภาพ
            </button>
          </div>

          <!-- PromptPay Section -->
          <div id="v21-pp-section" style="display:${qrType==='promptpay'?'block':'none'};">
            <div class="v21-field">
              <label>เบอร์พร้อมเพย์ (เว้นว่าง = ใช้ค่าจากตั้งค่าร้าน)</label>
              <input id="v21-qr-promptpay" type="text"
                value="${s.qr_promptpay || ''}"
                placeholder="${rc?.promptpay_number ? `ค่าปัจจุบันร้าน: ${rc.promptpay_number}` : 'กรอกเบอร์มือถือ / เลขบัตร 13 หลัก'}"
                oninput="v21RefreshQRPreview()">
            </div>
            <div class="v21-inline-toggle" style="padding:8px 0;">
              <span style="font-size:13px;">รวมยอดเงินใน QR (แนะนำ)</span>
              <label class="v21-sw">
                <input type="checkbox" id="v21-qr-with-amount"
                  ${s.qr_with_amount !== false ? 'checked' : ''}
                  onchange="v21RefreshQRPreview()">
                <div class="v21-sw-track"></div>
                <div class="v21-sw-thumb"></div>
              </label>
            </div>
          </div>

          <!-- Custom URL Section -->
          <div id="v21-custom-section" style="display:${qrType==='custom'?'block':'none'};">
            <div class="v21-field">
              <label>URL รูปภาพ QR Code (PNG/JPG)</label>
              <input id="v21-qr-custom-url" type="url"
                value="${s.qr_custom_url || ''}"
                placeholder="https://example.com/qr.png"
                oninput="v21RefreshQRPreview()">
            </div>
          </div>

          <!-- Common: Label -->
          <div id="v21-qr-common" style="display:${qrType==='none'?'none':'block'};">
            <div class="v21-field" style="margin-top:10px;">
              <label>ข้อความใต้ QR Code</label>
              <input id="v21-qr-label" type="text"
                value="${s.qr_label || ''}"
                placeholder="สแกนเพื่อชำระเงิน"
                oninput="v21RefreshQRPreview()">
            </div>
            <div class="v21-field">
              <label>ข้อความบรรทัดที่ 2 (เช่น Scan to Pay)</label>
              <input id="v21-qr-sub-label" type="text"
                value="${s.qr_sub_label || ''}"
                placeholder="Scan to Pay"
                oninput="v21RefreshQRPreview()">
            </div>

            <!-- QR Preview -->
            <div style="margin-top:10px;">
              <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">
                ตัวอย่าง QR
              </div>
              <div class="v21-qr-preview-box" id="v21-qr-admin-preview">
                ${qrPreviewHtml}
              </div>
            </div>
          </div>

          <!-- None state -->
          <div id="v21-qr-none-msg" style="display:${qrType==='none'?'block':'none'};text-align:center;padding:12px;color:var(--text-tertiary);font-size:12px;">
            <i class="material-icons-round" style="font-size:32px;display:block;margin-bottom:4px;opacity:.4;">qr_code_off</i>
            ไม่แสดง QR Code ในเอกสารนี้
          </div>
        </div>

      </div>

      <!-- ══ RIGHT COLUMN ══ -->
      <div>

        <!-- Color Picker (A4 types only) -->
        ${isA4Type ? `
        <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg,12px);padding:16px;margin-bottom:12px;">
          <div class="v21-section-hdr">
            <i class="material-icons-round">palette</i>สีหัวเอกสาร
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
            ${swatchHtml}
            <input type="color" value="${hc}" id="v10-custom-color"
              onchange="v10SetHeaderColor(this.value)"
              style="width:28px;height:28px;padding:2px;cursor:pointer;border-radius:50%;border:none;">
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="v10-bw-mode" ${s.bw_mode?'checked':''}
              onchange="v10ToggleBW(this.checked)"
              style="width:16px;height:16px;">
            โหมดขาวดำ (พิมพ์ประหยัดหมึก)
          </label>
        </div>` : ''}

        <!-- Text Inputs -->
        <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg,12px);padding:16px;margin-bottom:12px;">
          <div class="v21-section-hdr">
            <i class="material-icons-round">text_fields</i>ข้อความในเอกสาร
          </div>
          <div class="v21-field">
            <label>หัวเอกสาร</label>
            <input id="v10-header-text" value="${s.header_text || ''}"
              placeholder="ชื่อเอกสาร เช่น ใบเสร็จรับเงิน"
              oninput="v10UpdatePreview()">
          </div>
          <div class="v21-field">
            <label>ท้ายเอกสาร (Footer)</label>
            <input id="v10-footer-text" value="${s.footer_text || ''}"
              placeholder="ขอบคุณที่ใช้บริการ"
              oninput="v10UpdatePreview()">
          </div>
          <div class="v21-field">
            <label>หมายเหตุ / เงื่อนไข</label>
            <input id="v10-note-text" value="${s.note_text || ''}"
              placeholder="สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน"
              oninput="v10UpdatePreview()">
          </div>
        </div>

        <!-- Preview -->
        <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-lg,12px);padding:16px;">
          <div class="v21-section-hdr">
            <i class="material-icons-round">preview</i>ตัวอย่างเอกสาร
          </div>
          <div id="v10-preview" style="max-height:400px;overflow-y:auto;overflow-x:hidden;"></div>
        </div>

        <!-- Save Bar -->
        <div class="v21-save-bar">
          <button class="btn btn-primary" style="width:100%;padding:12px;" onclick="v21SaveAllSettings()">
            <i class="material-icons-round">save</i> บันทึกการตั้งค่าทั้งหมด
          </button>
        </div>

      </div>
    </div>`;

  // Build toggles & preview after DOM ready
  if (typeof v10BuildToggles === 'function') v10BuildToggles(s);
  v10UpdatePreview();
};

// ══════════════════════════════════════════════════════════════════
// V21-4: QR ADMIN PREVIEW BUILDER (สำหรับ preview ในหน้า admin)
// ══════════════════════════════════════════════════════════════════

function v21BuildQRAdminPreview(s, rc, qrType) {
  qrType = qrType || s.qr_type || 'promptpay';
  const label    = document.getElementById('v21-qr-label')?.value    ?? s.qr_label    ?? 'สแกนเพื่อชำระเงิน';
  const subLabel = document.getElementById('v21-qr-sub-label')?.value ?? s.qr_sub_label ?? '';

  if (qrType === 'none') {
    return `<div style="font-size:11px;color:var(--text-tertiary);">ไม่แสดง QR</div>`;
  }

  if (qrType === 'custom') {
    const url = document.getElementById('v21-qr-custom-url')?.value || s.qr_custom_url || '';
    if (!url) return `<div style="font-size:11px;color:var(--text-tertiary);">กรอก URL รูปภาพด้านบน</div>`;
    return `
      <img src="${url}" style="width:80px;height:80px;border-radius:6px;"
        onerror="this.outerHTML='<div style=\\'font-size:10px;color:var(--danger);\\'>โหลดรูปไม่สำเร็จ — ตรวจสอบ URL</div>'">
      <div style="font-size:10px;font-weight:600;text-align:center;">${label}</div>
      ${subLabel ? `<div style="font-size:9px;color:var(--text-tertiary);text-align:center;">${subLabel}</div>` : ''}`;
  }

  // PromptPay
  const ppRaw = (document.getElementById('v21-qr-promptpay')?.value || s.qr_promptpay || rc?.promptpay_number || '').trim();
  const pp = ppRaw.replace(/[^0-9]/g, '');
  if (!pp || pp.length < 10) {
    return `<div style="font-size:11px;color:var(--text-tertiary);text-align:center;">
      กรอกเบอร์พร้อมเพย์<br>หรือตั้งค่าร้านก่อน
    </div>`;
  }

  const withAmt = document.getElementById('v21-qr-with-amount')?.checked ?? s.qr_with_amount ?? true;
  const qrSrc = withAmt
    ? `https://promptpay.io/${pp}/100.png`  // preview ใช้ 100 บาท
    : `https://promptpay.io/${pp}.png`;

  return `
    <div style="background:#003b71;width:100%;padding:3px 0;border-radius:4px;text-align:center;margin-bottom:4px;">
      <span style="color:#fff;font-size:9px;font-weight:700;">PromptPay</span>
    </div>
    <img src="${qrSrc}" style="width:80px;height:80px;"
      onerror="this.outerHTML='<div style=\\'width:80px;height:80px;background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94a3b8;\\'>QR Code</div>'">
    <div style="font-size:10px;font-weight:700;color:#003b71;text-align:center;">${label}</div>
    ${subLabel ? `<div style="font-size:8px;color:#94a3b8;text-align:center;">${subLabel}</div>` : ''}
    <div style="font-size:8px;color:#64748b;text-align:center;">${ppRaw}</div>
    ${withAmt ? '<div style="font-size:8px;color:#94a3b8;text-align:center;">(ตัวอย่าง: ฿100)</div>' : ''}`;
}

// ══════════════════════════════════════════════════════════════════
// V21-5: QR TYPE SWITCHER — เปลี่ยน mode + refresh UI
// ══════════════════════════════════════════════════════════════════

window.v21SetQRType = async function(type) {
  // update active doc settings
  const settings = await v10GetDocSettings();
  const activeKey = (typeof _v10ActiveDocTab !== 'undefined' ? _v10ActiveDocTab : null) || 'receipt_80mm';
  if (!settings[activeKey]) settings[activeKey] = {};
  settings[activeKey].qr_type = type;
  window._v10DocSettings = settings;

  // update mode button styles
  document.querySelectorAll('.v21-qr-mode-btn').forEach(btn => btn.classList.remove('active'));
  const modeMap = { none: 0, promptpay: 1, custom: 2 };
  const idx = modeMap[type];
  document.querySelectorAll('.v21-qr-mode-btn')[idx]?.classList.add('active');

  // show/hide sections
  const ppSec      = document.getElementById('v21-pp-section');
  const custSec    = document.getElementById('v21-custom-section');
  const commonSec  = document.getElementById('v21-qr-common');
  const noneMsg    = document.getElementById('v21-qr-none-msg');

  if (ppSec)   ppSec.style.display    = type === 'promptpay' ? 'block' : 'none';
  if (custSec) custSec.style.display  = type === 'custom'    ? 'block' : 'none';
  if (commonSec) commonSec.style.display = type === 'none'   ? 'none'  : 'block';
  if (noneMsg) noneMsg.style.display  = type === 'none'      ? 'block' : 'none';

  v21RefreshQRPreview();
};

// ══════════════════════════════════════════════════════════════════
// V21-6: QR PREVIEW REFRESHER
// ══════════════════════════════════════════════════════════════════

window.v21RefreshQRPreview = async function() {
  const previewEl = document.getElementById('v21-qr-admin-preview');
  if (!previewEl) return;
  const rc = await v10GetShopConfig();
  const activeKey = (typeof _v10ActiveDocTab !== 'undefined' ? _v10ActiveDocTab : null) || 'receipt_80mm';
  const settings = window._v10DocSettings || {};
  const s = { ...(V10_DEFAULTS?.[activeKey] || {}), ...(settings[activeKey] || {}) };
  // read live inputs
  s.qr_promptpay  = document.getElementById('v21-qr-promptpay')?.value || s.qr_promptpay || '';
  s.qr_custom_url = document.getElementById('v21-qr-custom-url')?.value || s.qr_custom_url || '';
  s.qr_label      = document.getElementById('v21-qr-label')?.value      || s.qr_label      || '';
  s.qr_sub_label  = document.getElementById('v21-qr-sub-label')?.value  || s.qr_sub_label  || '';
  const qrType = s.qr_type || 'promptpay';
  previewEl.innerHTML = v21BuildQRAdminPreview(s, rc, qrType);
};

// ══════════════════════════════════════════════════════════════════
// V21-7: SAVE ALL SETTINGS (override v10SaveCurrentSettings)
// ══════════════════════════════════════════════════════════════════

window.v21SaveAllSettings = async function() {
  const settings = await v10GetDocSettings();
  const activeKey = (typeof _v10ActiveDocTab !== 'undefined' ? _v10ActiveDocTab : null) || 'receipt_80mm';
  if (!settings[activeKey]) settings[activeKey] = {};
  const s = settings[activeKey];

  // Text fields (original v10)
  s.header_text = document.getElementById('v10-header-text')?.value ?? s.header_text;
  s.footer_text = document.getElementById('v10-footer-text')?.value ?? s.footer_text;
  s.note_text   = document.getElementById('v10-note-text')?.value   ?? s.note_text;

  // QR fields (new in v21)
  const qrType = s.qr_type || 'promptpay';
  if (qrType === 'promptpay') {
    s.qr_promptpay   = document.getElementById('v21-qr-promptpay')?.value.trim()  || '';
    s.qr_with_amount = document.getElementById('v21-qr-with-amount')?.checked     ?? true;
  }
  if (qrType === 'custom') {
    s.qr_custom_url = document.getElementById('v21-qr-custom-url')?.value.trim() || '';
  }
  s.qr_label     = document.getElementById('v21-qr-label')?.value.trim()     || '';
  s.qr_sub_label = document.getElementById('v21-qr-sub-label')?.value.trim() || '';

  // Toggle fields (read from DOM checkboxes)
  document.querySelectorAll('[data-toggle-key]').forEach(cb => {
    s[cb.dataset.toggleKey] = cb.checked;
  });

  await v10SaveDocSettings(settings);
  typeof toast === 'function' && toast('✅ บันทึกตั้งค่าเอกสารสำเร็จ', 'success');
};

// Keep backward compat
window.v10SaveCurrentSettings = window.v21SaveAllSettings;

// ══════════════════════════════════════════════════════════════════
// V21-8: PRINT PATCH — print80mmv2 (ใช้ QR settings)
// ══════════════════════════════════════════════════════════════════

const _v21Orig80mm = window.print80mmv2;
window.print80mmv2 = async function(bill, items, rc) {
  try {
    const docSettings = await v10GetDocSettings();
    const s = { ...(V10_DEFAULTS?.receipt_80mm || {}), ...(docSettings.receipt_80mm || {}) };
    const qrType = s.qr_type || 'promptpay';

    // Patch rc for QR
    const patchedRc = { ...rc };
    if (!s.show_qr || qrType === 'none') {
      patchedRc.show_promptpay_qr = false;
      patchedRc.promptpay_number  = '';
    } else if (qrType === 'promptpay') {
      patchedRc.show_promptpay_qr = true;
      const ppRaw = s.qr_promptpay || rc?.promptpay_number || '';
      patchedRc.promptpay_number  = ppRaw.replace(/[^0-9]/g, '');
      // store amount flag for use in print
      patchedRc._qr_with_amount   = s.qr_with_amount !== false;
      patchedRc._qr_label         = s.qr_label || 'สแกนเพื่อชำระเงิน';
    } else if (qrType === 'custom') {
      // Custom QR: use a special marker; the QR HTML is injected after print
      patchedRc.show_promptpay_qr    = false;
      patchedRc._custom_qr_url       = s.qr_custom_url || '';
      patchedRc._qr_label            = s.qr_label || 'สแกน QR';
      patchedRc._inject_custom_qr    = true;
    }

    if (typeof _v21Orig80mm === 'function') {
      _v21Orig80mm(bill, items, patchedRc);
      // For custom QR: inject after window opens
      if (patchedRc._inject_custom_qr && patchedRc._custom_qr_url) {
        setTimeout(() => v21InjectCustomQR80mm(patchedRc), 300);
      }
    }
  } catch(e) {
    console.error('[v21] print80mmv2 error:', e);
    if (typeof _v21Orig80mm === 'function') _v21Orig80mm(bill, items, rc);
  }
};

function v21InjectCustomQR80mm(rc) {
  // ลอง inject custom QR ลงใน print window ที่เพิ่ง open
  // โดยหา windows ล่าสุดที่ URL = 'about:blank'
  try {
    const url = rc._custom_qr_url;
    const label = rc._qr_label || 'สแกน QR';
    if (!url) return;
    // ใช้ postMessage broadcast หา print windows
    // หรือ inject ผ่าน global ที่ print fn เก็บไว้
    if (window._lastPrint80Win && !window._lastPrint80Win.closed) {
      const w = window._lastPrint80Win;
      const qrDiv = w.document.createElement('div');
      qrDiv.style.cssText = 'text-align:center;margin:6px 0;';
      qrDiv.innerHTML = `<img src="${url}" style="width:80px;height:80px;"><div style="font-size:9px;">${label}</div>`;
      const body = w.document.body;
      if (body) body.insertBefore(qrDiv, body.lastChild);
    }
  } catch(_) {}
}

// ══════════════════════════════════════════════════════════════════
// V21-9: PRINT PATCH — printReceiptA4v2 (ใช้ QR settings)
// ══════════════════════════════════════════════════════════════════

const _v21OrigA4 = window.printReceiptA4v2;
window.printReceiptA4v2 = async function(bill, items, rc, docType) {
  try {
    const docSettings = await v10GetDocSettings();
    // Map docType to settings key
    const keyMap = {
      'delivery':         'receipt_a4',
      'quotation':        'quotation',
      'payment_receipt':  'payment_receipt',
    };
    const settingsKey = keyMap[docType] || 'receipt_a4';
    const s = { ...(V10_DEFAULTS?.[settingsKey] || {}), ...(docSettings[settingsKey] || {}) };

    // Override getLocalPromptPayQRBase64 temporarily for this print
    const origGetQR = window.getLocalPromptPayQRBase64;
    window.getLocalPromptPayQRBase64 = async function(amount) {
      return v21GetQRSrcForPrint(s, rc, amount);
    };
    // Also override show_qr in s (it's used directly in printReceiptA4v2)
    const patchedRc = { ...rc };
    if (!s.show_qr || s.qr_type === 'none') {
      patchedRc._v21_no_qr = true;
      // monkey-patch getLocalPromptPayQRBase64 to return ''
      window.getLocalPromptPayQRBase64 = async () => '';
    }

    try {
      if (typeof _v21OrigA4 === 'function') {
        await _v21OrigA4(bill, items, patchedRc, docType);
      }
    } finally {
      // restore original
      if (origGetQR !== undefined) window.getLocalPromptPayQRBase64 = origGetQR;
      else delete window.getLocalPromptPayQRBase64;
    }
  } catch(e) {
    console.error('[v21] printReceiptA4v2 error:', e);
    if (typeof _v21OrigA4 === 'function') await _v21OrigA4(bill, items, rc, docType);
  }
};

/**
 * ส่งคืน QR image src สำหรับ print (used by overridden getLocalPromptPayQRBase64)
 */
async function v21GetQRSrcForPrint(s, rc, amount) {
  const qrType = s.qr_type || 'promptpay';
  if (!s.show_qr || qrType === 'none') return '';

  if (qrType === 'custom') {
    return s.qr_custom_url || '';
  }

  // PromptPay
  const ppRaw = s.qr_promptpay || rc?.promptpay_number || '';
  const pp = ppRaw.replace(/[^0-9]/g, '');
  if (!pp || pp.length < 10) return '';

  // ถ้ามี getLocalPromptPayQRBase64 จริง (v11 local QR) ให้ใช้
  // แต่เนื่องจาก we're inside the override already, ให้ build URL ตรงๆ
  const withAmt = s.qr_with_amount !== false;
  return withAmt && amount > 0
    ? `https://promptpay.io/${pp}/${amount}.png`
    : `https://promptpay.io/${pp}.png`;
}

// ══════════════════════════════════════════════════════════════════
// V21-10: เพิ่ม QR defaults ให้ settings ที่โหลดมาจาก DB (ป้องกัน missing keys)
// ══════════════════════════════════════════════════════════════════

const _v21OrigGetDocSettings = window.v10GetDocSettings;
window.v10GetDocSettings = async function() {
  const settings = typeof _v21OrigGetDocSettings === 'function'
    ? await _v21OrigGetDocSettings()
    : {};
  // Ensure QR defaults are present
  for (const [k, def] of Object.entries(V21_QR_DEFAULTS)) {
    if (!settings[k]) settings[k] = {};
    for (const [f, v] of Object.entries(def)) {
      if (settings[k][f] === undefined) settings[k][f] = v;
    }
  }
  return settings;
};

// ══════════════════════════════════════════════════════════════════
// SQL migration reminder
// ══════════════════════════════════════════════════════════════════

console.log(
  '[v21] ✅ QR Code settings loaded\n' +
  '[v21] ✅ Admin UI override active (v10RenderDocSettingsInto)\n' +
  '[v21] ✅ Print functions patched (print80mmv2 + printReceiptA4v2)\n' +
  '[v21] 📋 SQL ต้องรัน (ถ้ายังไม่มีคอลัมน์):\n' +
  '       ALTER TABLE "ตั้งค่าร้านค้า"\n' +
  '         ADD COLUMN IF NOT EXISTS doc_settings jsonb DEFAULT \'{}\';\n'
);
