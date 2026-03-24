/**
 * SK POS v3.0 — modules-v3.js
 * ฟีเจอร์ใหม่ทั้งหมด:
 * 1. Admin — ตั้งค่าใบเสร็จแบบละเอียด (หัวกระดาษ, รายการ, A4/80mm)
 * 2. Checkout — หน้ารับเงินแบบ Bill มืออาชีพ (auto change, QR)
 * 3. PromptPay QR — generate จากเบอร์ในระบบ (ไม่ใช้รูปภาพ)
 * 4. Customer Display — QR Code จาก payload ตรง
 * 5. Attendance — 3 แท็บ: เช็คชื่อ | เบิกเงิน | จ่ายเงินเดือน
 * โหลดหลัง: modules-v2-patch.js
 */
'use strict';

// ══════════════════════════════════════════════════════════════════
// 0. CSS INJECTION
// ══════════════════════════════════════════════════════════════════
(function injectV3CSS() {
  if (document.getElementById('sk-v3-css')) return;
  const s = document.createElement('style');
  s.id = 'sk-v3-css';
  s.textContent = `
    /* Toggle Switch */
    .toggle-switch { position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0; }
    .toggle-switch input { opacity:0;width:0;height:0; }
    .toggle-slider { position:absolute;cursor:pointer;inset:0;background:#CBD5E1;border-radius:24px;transition:.25s; }
    .toggle-slider:before { content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.25s;box-shadow:0 1px 3px rgba(0,0,0,.2); }
    .toggle-switch input:checked + .toggle-slider { background:var(--primary,#DC2626); }
    .toggle-switch input:checked + .toggle-slider:before { transform:translateX(20px); }

    /* Admin Tabs */
    .admin-tab { display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border:none;border-bottom:3px solid transparent;background:none;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif;font-size:13px;font-weight:500;color:var(--text-secondary);white-space:nowrap;transition:all .15s; }
    .admin-tab:hover { color:var(--primary);background:var(--bg-hover); }
    .admin-tab.active { color:var(--primary);border-bottom-color:var(--primary);font-weight:700; }
    .admin-tab .material-icons-round { font-size:17px; }

    /* Payment Method Cards */
    .pay-method-card { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 8px;border:2px solid var(--border-light);border-radius:14px;background:var(--bg-base);cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif;font-size:13px;font-weight:600;color:var(--text-primary);gap:4px;transition:all .15s; }
    .pay-method-card:hover:not(:disabled) { border-color:var(--primary);background:var(--primary-50,#fef2f2);color:var(--primary); }
    .pay-method-card.selected { border-color:var(--primary);background:var(--primary);color:#fff; }
    .pay-method-card.selected .material-icons-round { color:#fff; }
    .pay-method-card:disabled { opacity:.4;cursor:not-allowed; }
    .pay-method-card .material-icons-round { font-size:26px;color:var(--text-secondary); }
    .pay-method-card.selected .material-icons-round { color:#fff; }

    /* Quick Amount Buttons */
    .quick-amount-btn { padding:8px 6px;border:2px solid var(--border-light);border-radius:10px;background:var(--bg-base);cursor:pointer;font-size:13px;font-weight:700;font-family:var(--font-thai,'Prompt'),sans-serif;color:var(--text-primary);transition:all .15s;text-align:center; }
    .quick-amount-btn:hover { border-color:var(--primary);background:var(--primary-50,#fef2f2);color:var(--primary); }
    .quick-amount-btn.exact { border-color:var(--success,#10B981);color:var(--success,#10B981); }

    /* Customer Quick Buttons */
    .cust-quick-btn { padding:6px 14px;border:1.5px solid var(--border-default);border-radius:999px;background:none;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif;font-size:12px;font-weight:500;color:var(--text-secondary);transition:all .15s; }
    .cust-quick-btn:hover { border-color:var(--primary);color:var(--primary); }
    .cust-quick-btn.active { background:var(--primary);color:#fff;border-color:var(--primary); }

    /* Attendance Tabs */
    .att-tab-bar { display:flex;gap:0;border-bottom:2px solid var(--border-light);margin-bottom:0; }
    .att-tab { display:inline-flex;align-items:center;gap:6px;padding:12px 20px;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;background:none;cursor:pointer;font-family:var(--font-thai,'Prompt'),sans-serif;font-size:13px;font-weight:500;color:var(--text-secondary);transition:all .15s;white-space:nowrap; }
    .att-tab:hover { color:var(--primary); }
    .att-tab.active { color:var(--primary);border-bottom-color:var(--primary);font-weight:700; }
    .att-tab .material-icons-round { font-size:18px; }
    .att-tab-content { display:none; }
    .att-tab-content.active { display:block; }

    /* Employee Cards for Attendance */
    .emp-att-card { background:var(--bg-surface);border:2px solid var(--border-light);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;transition:all .2s; }
    .emp-att-card.checked-in { border-color:var(--success,#10B981);background:linear-gradient(135deg,#f0fdf4,#dcfce7); }
    .emp-att-card.checked-out { border-color:var(--border-light);background:var(--bg-base);opacity:.85; }
    .emp-att-card.absent { border-color:var(--danger,#EF4444);background:linear-gradient(135deg,#fef2f2,#fee2e2); }
    .emp-att-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px; }

    /* Bill Checkout Overlay */
    #bill-checkout-overlay { animation:fadeIn .2s ease-out; }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    #bill-checkout-overlay > div { animation:slideUp .25s cubic-bezier(.34,1.56,.64,1); }
    @keyframes slideUp { from{transform:translateY(24px);opacity:0} to{transform:none;opacity:1} }

    /* Receipt Toggle Row */
    .rc-toggle-row { display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:.5px solid var(--border-light); }
    .rc-toggle-row:last-child { border-bottom:none; }
    .rc-toggle-row span { font-size:13px;color:var(--text-primary); }

    /* Payroll table */
    .payroll-net { font-size:15px;font-weight:700;color:var(--success,#10B981); }
    .payroll-deduct { color:var(--danger,#EF4444); }
  `;
  document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════════════════
// 1. PromptPay QR Generator (EMVCo format)
// ══════════════════════════════════════════════════════════════════
function crc16ccitt(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc;
}

function generatePromptPayPayload(phoneOrId, amount) {
  let id = (phoneOrId || '').replace(/[^0-9]/g, '');
  // Convert local phone to international
  if (id.length === 10 && id.startsWith('0')) id = '0066' + id.substring(1);
  const appId  = 'A000000677010111';
  const ppData = `0016${appId}0113${id}`;
  const tag29  = `29${String(ppData.length).padStart(2,'0')}${ppData}`;
  let payload  = `000201010211${tag29}5303764`;
  if (amount && Number(amount) > 0) {
    const amtStr = Number(amount).toFixed(2);
    payload += `54${String(amtStr.length).padStart(2,'0')}${amtStr}`;
  }
  payload += `5802TH6304`;
  const crc = crc16ccitt(payload);
  payload += crc.toString(16).toUpperCase().padStart(4,'0');
  return payload;
}

function renderQRInto(el, text, size) {
  if (!el) return;
  el.innerHTML = '';
  if (window.QRCode) {
    new QRCode(el, { text, width: size, height: size, colorDark:'#000', colorLight:'#fff', correctLevel: QRCode.CorrectLevel.M });
  } else {
    el.innerHTML = `<div style="padding:8px;font-size:9px;word-break:break-all;color:#666;">${text}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════
// 2. Receipt Config — Read/Write via localStorage (+ Supabase try)
// ══════════════════════════════════════════════════════════════════
const RC_KEY = 'sk_receipt_config';
function getReceiptConfig() {
  try { return JSON.parse(localStorage.getItem(RC_KEY) || '{}'); } catch { return {}; }
}
function saveReceiptConfigLocal(cfg) {
  localStorage.setItem(RC_KEY, JSON.stringify(cfg));
}

// ══════════════════════════════════════════════════════════════════
// 3. Admin Page Override — พร้อม Receipt Settings
// ══════════════════════════════════════════════════════════════════
window.renderAdmin = async function() {
  if (USER?.role !== 'admin') {
    document.getElementById('page-admin').innerHTML = `<div style="text-align:center;padding:80px;"><i class="material-icons-round" style="font-size:64px;color:var(--danger)">block</i><p style="font-size:18px;margin-top:16px;">เข้าถึงได้เฉพาะผู้ดูแลระบบ</p></div>`;
    return;
  }
  const [{ data: users }, { data: cats }, { data: shopConf }] = await Promise.all([
    db.from('ผู้ใช้งาน').select('*').order('username'),
    db.from('categories').select('*').order('name'),
    db.from('ตั้งค่าร้านค้า').select('*').limit(1).single()
  ]);
  const rc = getReceiptConfig();

  document.getElementById('page-admin').innerHTML = `
    <div style="padding:0 0 32px;">
      <!-- Tab Bar -->
      <div style="display:flex;border-bottom:2px solid var(--border-light);margin-bottom:20px;overflow-x:auto;">
        <button class="admin-tab active" data-tab="shop" onclick="switchAdminTab('shop')"><i class="material-icons-round">store</i> ร้านค้า</button>
        <button class="admin-tab" data-tab="receipt" onclick="switchAdminTab('receipt')"><i class="material-icons-round">receipt_long</i> ตั้งค่าใบเสร็จ</button>
        <button class="admin-tab" data-tab="users" onclick="switchAdminTab('users')"><i class="material-icons-round">manage_accounts</i> ผู้ใช้งาน</button>
        <button class="admin-tab" data-tab="cats" onclick="switchAdminTab('cats')"><i class="material-icons-round">category</i> หมวดหมู่</button>
      </div>

      <!-- ═══ TAB: Shop ═══ -->
      <div class="v3-tab-content" id="admin-tab-shop">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:900px;">
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:24px;border:1px solid var(--border-light);">
            <h3 style="font-size:14px;font-weight:700;margin-bottom:18px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:6px;"><i class="material-icons-round" style="font-size:16px;">store</i> ข้อมูลร้านค้า</h3>
            <form id="shop-form">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group"><label class="form-label">ชื่อร้าน (ไทย) *</label><input class="form-input" id="shop-name" value="${shopConf?.shop_name || SHOP_CONFIG.name}"></div>
                <div class="form-group"><label class="form-label">ชื่อร้าน (EN)</label><input class="form-input" id="shop-name-en" value="${shopConf?.shop_name_en || SHOP_CONFIG.nameEn}"></div>
              </div>
              <div class="form-group"><label class="form-label">ที่อยู่</label><textarea class="form-input" id="shop-addr" rows="2">${shopConf?.address || SHOP_CONFIG.address}</textarea></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group"><label class="form-label">เบอร์โทร</label><input class="form-input" id="shop-phone" value="${shopConf?.phone || SHOP_CONFIG.phone}"></div>
                <div class="form-group"><label class="form-label">เลขผู้เสียภาษี</label><input class="form-input" id="shop-tax" value="${shopConf?.tax_id || SHOP_CONFIG.taxId}"></div>
              </div>
              <div class="form-group">
                <label class="form-label">พร้อมเพย์ (เบอร์โทร / เลขบัตรประชาชน 13 หลัก)</label>
                <div style="display:flex;gap:10px;align-items:flex-end;">
                  <input class="form-input" id="shop-promptpay" value="${shopConf?.promptpay_number || ''}" placeholder="0XX-XXX-XXXX" oninput="adminPreviewQR()" style="flex:1;">
                  <div id="admin-qr-preview" style="width:72px;height:72px;border:2px solid var(--border-light);border-radius:10px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#fff;"></div>
                </div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">ระบบ generate QR Code จากเบอร์นี้โดยตรง — ไม่ใช้รูปภาพจากอินเทอร์เน็ต</div>
              </div>
              <div class="form-group"><label class="form-label">Footer ใบเสร็จ</label><input class="form-input" id="shop-footer" value="${shopConf?.receipt_footer || SHOP_CONFIG.note}"></div>
              <button type="submit" class="btn btn-primary" style="width:100%;"><i class="material-icons-round">save</i> บันทึกตั้งค่าร้าน</button>
            </form>
          </div>
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:24px;border:1px solid var(--border-light);">
            <h3 style="font-size:14px;font-weight:700;margin-bottom:16px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:6px;"><i class="material-icons-round" style="font-size:16px;">qr_code</i> ทดสอบ QR พร้อมเพย์</h3>
            <div style="margin-bottom:12px;">
              <label class="form-label">ทดสอบจำนวนเงิน</label>
              <div style="display:flex;gap:8px;">
                <input class="form-input" type="number" id="test-qr-amount" placeholder="100" style="flex:1;">
                <button class="btn btn-outline" onclick="adminTestQR()"><i class="material-icons-round">refresh</i> Generate</button>
              </div>
            </div>
            <div id="admin-qr-test" style="text-align:center;padding:16px;background:var(--bg-base);border-radius:var(--radius-md);min-height:140px;display:flex;align-items:center;justify-content:center;">
              <div style="color:var(--text-tertiary);font-size:13px;">กรอกเบอร์พร้อมเพย์และกด Generate</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ TAB: Receipt Settings ═══ -->
      <div class="v3-tab-content" id="admin-tab-receipt" style="display:none;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px;">

          <!-- Header -->
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
            <h3 style="font-size:13px;font-weight:700;margin-bottom:14px;color:var(--primary);display:flex;align-items:center;gap:6px;"><i class="material-icons-round" style="font-size:16px;">title</i> หัวใบเสร็จ</h3>
            ${mkToggle('rc-show-name','แสดงชื่อร้าน',rc.show_name!==false)}
            ${mkToggle('rc-show-address','แสดงที่อยู่',rc.show_address!==false)}
            ${mkToggle('rc-show-phone','แสดงเบอร์โทร',rc.show_phone!==false)}
            ${mkToggle('rc-show-tax','แสดงเลขผู้เสียภาษี',rc.show_tax!==false)}
            ${mkToggle('rc-show-billno','แสดงเลขที่บิล',rc.show_billno!==false)}
            ${mkToggle('rc-show-datetime','แสดงวันที่และเวลา',rc.show_datetime!==false)}
          </div>

          <!-- Items -->
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
            <h3 style="font-size:13px;font-weight:700;margin-bottom:14px;color:var(--primary);display:flex;align-items:center;gap:6px;"><i class="material-icons-round" style="font-size:16px;">list_alt</i> รายการสินค้า</h3>
            ${mkToggle('rc-show-item-name','แสดงชื่อสินค้า',true)}
            ${mkToggle('rc-show-item-detail','แสดงรายละเอียดสินค้า',rc.show_item_detail===true)}
            ${mkToggle('rc-show-qty','แสดงจำนวน',rc.show_qty!==false)}
            ${mkToggle('rc-show-unit','แสดงหน่วย',rc.show_unit!==false)}
            ${mkToggle('rc-show-unit-price','แสดงราคา/หน่วย',rc.show_unit_price!==false)}
            ${mkToggle('rc-show-subtotal','แสดงยอดรวมต่อรายการ',rc.show_subtotal!==false)}
            ${mkToggle('rc-show-cost','แสดงต้นทุน (A4 เท่านั้น)',rc.show_cost===true)}
          </div>

          <!-- Summary -->
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
            <h3 style="font-size:13px;font-weight:700;margin-bottom:14px;color:var(--primary);display:flex;align-items:center;gap:6px;"><i class="material-icons-round" style="font-size:16px;">summarize</i> สรุปยอด</h3>
            ${mkToggle('rc-show-discount','แสดงส่วนลด',rc.show_discount!==false)}
            ${mkToggle('rc-show-received','แสดงยอดรับเงิน',rc.show_received!==false)}
            ${mkToggle('rc-show-change','แสดงเงินทอน',rc.show_change!==false)}
            ${mkToggle('rc-show-staff','แสดงชื่อพนักงาน',rc.show_staff!==false)}
            ${mkToggle('rc-show-customer','แสดงชื่อลูกค้า',rc.show_customer!==false)}
            ${mkToggle('rc-show-promptpay-qr','แสดง QR พร้อมเพย์ในใบเสร็จ',rc.show_promptpay_qr!==false)}
          </div>

          <!-- Format -->
          <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
            <h3 style="font-size:13px;font-weight:700;margin-bottom:14px;color:var(--primary);display:flex;align-items:center;gap:6px;"><i class="material-icons-round" style="font-size:16px;">print</i> รูปแบบ & การพิมพ์</h3>
            <div class="form-group">
              <label class="form-label">รูปแบบเริ่มต้น</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <label style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid ${rc.default_format!=='A4'?'var(--primary)':'var(--border-light)'};border-radius:var(--radius-md);cursor:pointer;transition:.15s;">
                  <input type="radio" name="rc-fmt" id="rc-fmt-80mm" value="80mm" ${rc.default_format!=='A4'?'checked':''} onchange="rcUpdateFormatBorder()">
                  <div><div style="font-size:13px;font-weight:600;">🧾 80mm</div><div style="font-size:11px;color:var(--text-tertiary);">เครื่องพิมพ์ใบเสร็จ</div></div>
                </label>
                <label style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid ${rc.default_format==='A4'?'var(--primary)':'var(--border-light)'};border-radius:var(--radius-md);cursor:pointer;transition:.15s;">
                  <input type="radio" name="rc-fmt" id="rc-fmt-a4" value="A4" ${rc.default_format==='A4'?'checked':''} onchange="rcUpdateFormatBorder()">
                  <div><div style="font-size:13px;font-weight:600;">📄 A4</div><div style="font-size:11px;color:var(--text-tertiary);">ใบเสร็จเต็ม / Invoice</div></div>
                </label>
              </div>
            </div>
            ${mkToggle('rc-ask-format','ถามรูปแบบทุกครั้งก่อนพิมพ์',rc.ask_format!==false)}
            <div class="form-group" style="margin-top:12px;">
              <label class="form-label">ข้อความ Footer</label>
              <input class="form-input" id="rc-footer" value="${shopConf?.receipt_footer || SHOP_CONFIG.note}">
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;align-items:center;margin-top:16px;max-width:900px;">
          <button class="btn btn-primary" onclick="saveReceiptSettings()"><i class="material-icons-round">save</i> บันทึกตั้งค่าใบเสร็จ</button>
          <button class="btn btn-outline" onclick="rcRefreshPreview()"><i class="material-icons-round">visibility</i> ดูตัวอย่าง</button>
        </div>

        <!-- 80mm Preview -->
        <div style="margin-top:20px;max-width:900px;">
          <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;">ตัวอย่างใบเสร็จ 80mm</div>
          <div id="rc-preview-80" style="width:280px;background:#fff;border:1px solid #ddd;padding:14px;font-family:'Courier New',monospace;font-size:11.5px;line-height:1.7;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.08);border-radius:4px;"></div>
        </div>
      </div>

      <!-- ═══ TAB: Users ═══ -->
      <div class="v3-tab-content" id="admin-tab-users" style="display:none;">
        <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);max-width:500px;">
          <div style="max-height:320px;overflow-y:auto;margin-bottom:12px;">
            ${(users||[]).map(u=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-radius:var(--radius-sm);margin-bottom:4px;background:var(--bg-base);">
                <div><strong>${u.username}</strong> <span class="badge ${u.role==='admin'?'badge-danger':'badge-info'}">${u.role}</span></div>
                <div style="display:flex;align-items:center;gap:8px;font-family:monospace;color:var(--text-tertiary);">PIN: ${u.pin}
                  ${u.id!==USER?.id?`<button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="deleteUser('${u.id}','${u.username}')"><i class="material-icons-round">delete</i></button>`:''}
                </div>
              </div>`).join('')}
          </div>
          <button class="btn btn-primary" style="width:100%;" onclick="showAddUserModal()"><i class="material-icons-round">person_add</i> เพิ่มผู้ใช้งาน</button>
        </div>
      </div>

      <!-- ═══ TAB: Categories ═══ -->
      <div class="v3-tab-content" id="admin-tab-cats" style="display:none;">
        <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);max-width:600px;">
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            ${(cats||[]).map(c=>`
              <div style="display:flex;align-items:center;gap:6px;background:var(--bg-base);border-radius:var(--radius-full);padding:6px 12px;font-size:13px;">
                <span style="width:10px;height:10px;border-radius:50%;background:${c.color};display:inline-block;"></span>
                ${c.name}
                <button onclick="deleteCat('${c.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);padding:0;"><i class="material-icons-round" style="font-size:14px;">close</i></button>
              </div>`).join('')}
          </div>
          <form id="cat-form" style="display:flex;gap:8px;">
            <input type="text" class="form-input" id="cat-name" placeholder="ชื่อหมวดหมู่" style="flex:1;">
            <input type="color" class="form-input" id="cat-color" value="#DC2626" style="width:48px;padding:4px;">
            <button type="submit" class="btn btn-primary"><i class="material-icons-round">add</i> เพิ่ม</button>
          </form>
        </div>
      </div>
    </div>`;

  // Events
  document.getElementById('shop-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = {
      shop_name: document.getElementById('shop-name').value,
      shop_name_en: document.getElementById('shop-name-en').value,
      address: document.getElementById('shop-addr').value,
      phone: document.getElementById('shop-phone').value,
      tax_id: document.getElementById('shop-tax').value,
      promptpay_number: document.getElementById('shop-promptpay').value,
      receipt_footer: document.getElementById('shop-footer').value,
      updated_by: USER?.username, updated_at: new Date().toISOString()
    };
    if (shopConf) await db.from('ตั้งค่าร้านค้า').update(d).eq('id', shopConf.id);
    else await db.from('ตั้งค่าร้านค้า').insert(d);
    toast('บันทึกตั้งค่าร้านสำเร็จ', 'success');
    adminPreviewQR();
  };
  document.getElementById('cat-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value.trim();
    const color = document.getElementById('cat-color').value;
    if (!name) return;
    await db.from('categories').insert({ name, color });
    toast('เพิ่มหมวดหมู่สำเร็จ', 'success');
    await loadCategories(); renderAdmin();
  };
  adminPreviewQR();
  setTimeout(rcRefreshPreview, 300);
};

function mkToggle(id, label, checked) {
  return `<div class="rc-toggle-row">
    <span>${label}</span>
    <label class="toggle-switch"><input type="checkbox" id="${id}" ${checked?'checked':''} onchange="rcRefreshPreview()"><span class="toggle-slider"></span></label>
  </div>`;
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.v3-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById(`admin-tab-${tab}`)?.style.setProperty('display','block');
  if (tab === 'receipt') setTimeout(rcRefreshPreview, 100);
}

function adminPreviewQR() {
  const num = document.getElementById('shop-promptpay')?.value || '';
  const el = document.getElementById('admin-qr-preview');
  if (!el) return;
  const clean = num.replace(/[^0-9]/g,'');
  if (clean.length >= 10) {
    const payload = generatePromptPayPayload(num, 0);
    renderQRInto(el, payload, 72);
  } else {
    el.innerHTML = `<span style="font-size:10px;color:var(--text-tertiary);">QR</span>`;
  }
}

function adminTestQR() {
  const num = document.getElementById('shop-promptpay')?.value || '';
  const amt = Number(document.getElementById('test-qr-amount')?.value || 0);
  const el = document.getElementById('admin-qr-test');
  if (!el) return;
  const clean = num.replace(/[^0-9]/g,'');
  if (clean.length < 10) { toast('กรุณากรอกเบอร์พร้อมเพย์ก่อน', 'warning'); return; }
  const payload = generatePromptPayPayload(num, amt);
  el.innerHTML = '';
  const qDiv = document.createElement('div');
  qDiv.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;gap:8px;';
  const qBox = document.createElement('div');
  qBox.style.cssText = 'padding:10px;background:#fff;border-radius:8px;border:2px solid var(--primary);';
  renderQRInto(qBox, payload, 150);
  qDiv.appendChild(qBox);
  qDiv.innerHTML += `<div style="font-size:13px;font-weight:700;color:var(--primary);">${amt>0?'฿'+formatNum(amt):'ไม่ระบุจำนวน'}</div><div style="font-size:11px;color:var(--text-tertiary);">${num}</div>`;
  el.appendChild(qDiv);
}

function rcUpdateFormatBorder() {
  const isA4 = document.getElementById('rc-fmt-a4')?.checked;
  document.querySelectorAll('[id^="rc-fmt"] + div').forEach((d, i) => {
    const lbl = d.closest('label');
    if (lbl) lbl.style.borderColor = (i===0 ? !isA4 : isA4) ? 'var(--primary)' : 'var(--border-light)';
  });
}

function rcGetVal(id, def=true) {
  const el = document.getElementById(id);
  return el ? el.checked : def;
}

function saveReceiptSettings() {
  const cfg = {
    show_name:         rcGetVal('rc-show-name'),
    show_address:      rcGetVal('rc-show-address'),
    show_phone:        rcGetVal('rc-show-phone'),
    show_tax:          rcGetVal('rc-show-tax'),
    show_billno:       rcGetVal('rc-show-billno'),
    show_datetime:     rcGetVal('rc-show-datetime'),
    show_item_detail:  rcGetVal('rc-show-item-detail', false),
    show_qty:          rcGetVal('rc-show-qty'),
    show_unit:         rcGetVal('rc-show-unit'),
    show_unit_price:   rcGetVal('rc-show-unit-price'),
    show_subtotal:     rcGetVal('rc-show-subtotal'),
    show_cost:         rcGetVal('rc-show-cost', false),
    show_discount:     rcGetVal('rc-show-discount'),
    show_received:     rcGetVal('rc-show-received'),
    show_change:       rcGetVal('rc-show-change'),
    show_staff:        rcGetVal('rc-show-staff'),
    show_customer:     rcGetVal('rc-show-customer'),
    show_promptpay_qr: rcGetVal('rc-show-promptpay-qr'),
    ask_format:        rcGetVal('rc-ask-format'),
    default_format:    document.getElementById('rc-fmt-a4')?.checked ? 'A4' : '80mm',
  };
  const footer = document.getElementById('rc-footer')?.value || '';
  if (footer) cfg.footer_text = footer;
  saveReceiptConfigLocal(cfg);
  toast('บันทึกตั้งค่าใบเสร็จสำเร็จ', 'success');
  rcRefreshPreview();
}

function rcRefreshPreview() {
  const el = document.getElementById('rc-preview-80');
  if (!el) return;
  const showName    = rcGetVal('rc-show-name');
  const showAddr    = rcGetVal('rc-show-address');
  const showPhone   = rcGetVal('rc-show-phone');
  const showTax     = rcGetVal('rc-show-tax');
  const showBillNo  = rcGetVal('rc-show-billno');
  const showDT      = rcGetVal('rc-show-datetime');
  const showDetail  = rcGetVal('rc-show-item-detail', false);
  const showUnit    = rcGetVal('rc-show-unit');
  const showUP      = rcGetVal('rc-show-unit-price');
  const showDisc    = rcGetVal('rc-show-discount');
  const showRecv    = rcGetVal('rc-show-received');
  const showChg     = rcGetVal('rc-show-change');
  const showStaff   = rcGetVal('rc-show-staff');
  const showCust    = rcGetVal('rc-show-customer');
  const footer      = document.getElementById('rc-footer')?.value || 'ขอบคุณที่ใช้บริการ';

  el.innerHTML = `
    <div style="text-align:center;border-bottom:1px dashed #999;padding-bottom:7px;margin-bottom:7px;">
      ${showName?'<div style="font-size:14px;font-weight:bold;">ชื่อร้านค้า</div>':''}
      ${showAddr?'<div>123 ถนนตัวอย่าง กรุงเทพ</div>':''}
      ${showPhone?'<div>โทร: 098-765-4321</div>':''}
      ${showTax?'<div>TAX: 1234567890123</div>':''}
    </div>
    <div style="border-bottom:1px dashed #999;padding-bottom:5px;margin-bottom:5px;">
      ${showBillNo?'<div>เลขที่: <strong>#0001</strong></div>':''}
      ${showDT?'<div>21/3/2567 10:30 น.</div>':''}
      ${showCust?'<div>ลูกค้า: ลูกค้าทั่วไป</div>':''}
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="border-bottom:1px solid #333;"><th style="text-align:left;">รายการ</th>${showUnit?'<th style="text-align:center;">หน่วย</th>':''}<th style="text-align:center;">จำนวน</th>${showUP?'<th style="text-align:right;">ราคา</th>':''}<th style="text-align:right;">รวม</th></tr>
      <tr><td>สินค้า A${showDetail?'<br><span style="color:#888;font-size:9px;">รายละเอียดสินค้า</span>':''}</td>${showUnit?'<td style="text-align:center;">ชิ้น</td>':''}<td style="text-align:center;">2</td>${showUP?'<td style="text-align:right;">฿50</td>':''}<td style="text-align:right;font-weight:bold;">฿100</td></tr>
      <tr><td>สินค้า B</td>${showUnit?'<td style="text-align:center;">กล่อง</td>':''}<td style="text-align:center;">1</td>${showUP?'<td style="text-align:right;">฿80</td>':''}<td style="text-align:right;font-weight:bold;">฿80</td></tr>
    </table>
    <div style="border-top:1px dashed #999;margin-top:5px;padding-top:5px;">
      ${showDisc?'<div style="display:flex;justify-content:space-between;"><span>ส่วนลด</span><span style="color:red;">-฿20</span></div>':''}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;"><span>รวม</span><span>฿160</span></div>
      ${showRecv?'<div style="display:flex;justify-content:space-between;"><span>รับมา</span><span>฿200</span></div>':''}
      ${showChg?'<div style="display:flex;justify-content:space-between;"><span>ทอน</span><span>฿40</span></div>':''}
      ${showStaff?'<div style="font-size:10px;color:#888;margin-top:3px;">พนักงาน: admin</div>':''}
    </div>
    <div style="text-align:center;border-top:1px dashed #999;margin-top:5px;padding-top:5px;color:#888;">${footer}</div>`;
}

// ══════════════════════════════════════════════════════════════════
// 4. Bill-Style Checkout Popup
// ══════════════════════════════════════════════════════════════════
window.startCheckout = function() {
  if (cart.length === 0) return;
  const discount = Number(document.getElementById('pos-discount')?.value || 0);
  const subtotal = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  const total    = Math.max(0, subtotal - discount);
  checkoutState  = {
    step: 1, total, discount, subtotal,
    customer: { type: 'general', id: null, name: 'ลูกค้าทั่วไป' },
    method: null, received: 0, change: 0,
    receivedDenominations: {}, changeDenominations: {}
  };
  openBillCheckout();
};

function openBillCheckout() {
  document.getElementById('checkout-overlay')?.classList.add('hidden');
  let ov = document.getElementById('bill-co-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bill-co-overlay';
    document.body.appendChild(ov);
  }
  ov.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:12px;';
  ov.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:20px;width:100%;max-width:920px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.5);">
      <!-- Header -->
      <div style="background:var(--primary);color:#fff;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;border-radius:20px 20px 0 0;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:12px;">
          <i class="material-icons-round" style="font-size:26px;">receipt_long</i>
          <div>
            <div style="font-size:17px;font-weight:700;">ใบชำระเงิน</div>
            <div style="font-size:12px;opacity:.8;">${new Date().toLocaleString('th-TH')}</div>
          </div>
        </div>
        <button onclick="closeBillCheckout()" style="background:rgba(255,255,255,.2);border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;"><i class="material-icons-round">close</i></button>
      </div>

      <!-- Body -->
      <div style="flex:1;overflow:hidden;display:grid;grid-template-columns:1.1fr 1fr;min-height:0;">
        <!-- LEFT: Items -->
        <div style="padding:20px;overflow-y:auto;border-right:1px solid var(--border-light);">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">รายการสินค้า</div>
          ${cart.map(item=>`
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:9px 0;border-bottom:.5px solid var(--border-light);">
              <div style="flex:1;padding-right:12px;">
                <div style="font-size:13px;font-weight:600;">${item.name}</div>
                <div style="font-size:12px;color:var(--text-tertiary);">฿${formatNum(item.price)} × ${item.qty} ${item.unit||'ชิ้น'}</div>
              </div>
              <div style="font-size:14px;font-weight:700;color:var(--primary);flex-shrink:0;">฿${formatNum(item.price*item.qty)}</div>
            </div>`).join('')}
          <!-- Summary -->
          <div style="margin-top:14px;padding:14px;background:var(--bg-base);border-radius:var(--radius-md);border:1px solid var(--border-light);">
            ${checkoutState.discount>0?`
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;color:var(--text-secondary);">
                <span>ยอดรวม</span><span>฿${formatNum(checkoutState.subtotal)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;color:var(--danger);">
                <span>ส่วนลด</span><span>-฿${formatNum(checkoutState.discount)}</span>
              </div>`:''}
            <div style="display:flex;justify-content:space-between;font-size:22px;font-weight:900;color:var(--primary);">
              <span>ยอดสุทธิ</span><span>฿${formatNum(checkoutState.total)}</span>
            </div>
          </div>
          <!-- Customer -->
          <div style="margin-top:12px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">ลูกค้า</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
              <button class="cust-quick-btn ${checkoutState.customer.type==='general'?'active':''}" onclick="bcCust('general','ลูกค้าทั่วไป')">ทั่วไป</button>
              <button class="cust-quick-btn" onclick="bcShowMember()">ลูกค้าประจำ ▾</button>
            </div>
            <div id="bc-cust-name" style="font-size:13px;font-weight:600;color:var(--text-primary);padding:6px 0;">${checkoutState.customer.name}</div>
            <div id="bc-member-box" style="display:none;"></div>
          </div>
        </div>

        <!-- RIGHT: Payment -->
        <div style="padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:16px;">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">วิธีชำระเงิน</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <button class="pay-method-card ${checkoutState.method==='cash'?'selected':''}" onclick="bcMethod('cash')">
                <i class="material-icons-round">payments</i><span>เงินสด</span>
              </button>
              <button class="pay-method-card ${checkoutState.method==='transfer'?'selected':''}" onclick="bcMethod('transfer')">
                <i class="material-icons-round">qr_code_scanner</i><span>โอน/พร้อมเพย์</span>
              </button>
              <button class="pay-method-card ${checkoutState.method==='credit'?'selected':''}" onclick="bcMethod('credit')">
                <i class="material-icons-round">credit_card</i><span>บัตรเครดิต</span>
              </button>
              <button class="pay-method-card ${checkoutState.method==='debt'?'selected':''}" onclick="bcMethod('debt')" ${checkoutState.customer.type==='general'?'disabled':''}>
                <i class="material-icons-round">pending</i><span>ค้างชำระ</span>
              </button>
            </div>
          </div>
          <div id="bc-pay-detail" style="flex:1;"></div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:14px 22px;border-top:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center;background:var(--bg-base);border-radius:0 0 20px 20px;flex-shrink:0;">
        <button onclick="closeBillCheckout()" style="background:none;border:1.5px solid var(--border-default);border-radius:var(--radius-md);padding:10px 22px;cursor:pointer;font-family:var(--font-thai);font-size:14px;color:var(--text-secondary);">ยกเลิก</button>
        <button id="bc-ok-btn" onclick="bcConfirm()" disabled style="background:var(--primary);color:#fff;border:none;border-radius:var(--radius-md);padding:12px 36px;font-size:15px;font-weight:700;font-family:var(--font-thai);display:flex;align-items:center;gap:8px;opacity:.45;cursor:not-allowed;transition:all .2s;">
          <i class="material-icons-round">check_circle</i> ยืนยันการขาย
        </button>
      </div>
    </div>`;
}

function closeBillCheckout() {
  const ov = document.getElementById('bill-co-overlay');
  if (ov) ov.style.display = 'none';
}

function bcCust(type, name, id=null) {
  checkoutState.customer = { type, name, id };
  document.getElementById('bc-cust-name').textContent = name;
  document.querySelectorAll('.cust-quick-btn').forEach(b => b.classList.remove('active'));
  // Re-enable/disable debt button
  const debtBtn = document.querySelector('#bill-co-overlay .pay-method-card:nth-child(4)');
  if (debtBtn) debtBtn.disabled = type === 'general';
  if (checkoutState.method === 'debt' && type === 'general') {
    checkoutState.method = null;
    document.querySelectorAll('.pay-method-card').forEach(b => b.classList.remove('selected'));
    document.getElementById('bc-pay-detail').innerHTML = '';
  }
  bcRefreshOkBtn();
}

async function bcShowMember() {
  const box = document.getElementById('bc-member-box');
  if (!box) return;
  if (box.style.display !== 'none') { box.style.display='none'; return; }
  const { data: custs } = await db.from('customer').select('id,name,phone').order('name');
  box.style.display = 'block';
  box.innerHTML = `
    <input class="form-input" id="bc-cust-q" placeholder="ค้นหา..." oninput="bcFilterCust()" style="margin-bottom:6px;font-size:13px;">
    <div id="bc-cust-list" style="max-height:130px;overflow-y:auto;border:1px solid var(--border-light);border-radius:8px;">
      ${(custs||[]).map(c=>`
        <div onclick="bcCust('member','${c.name.replace(/'/g,"\\'")}','${c.id}');document.getElementById('bc-member-box').style.display='none';"
          style="padding:8px 10px;cursor:pointer;font-size:13px;border-bottom:.5px solid var(--border-light);"
          onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
          ${c.name} ${c.phone?`<span style="color:var(--text-tertiary);font-size:11px;">${c.phone}</span>`:''}
        </div>`).join('')}
    </div>`;
}

function bcFilterCust() {
  const q = (document.getElementById('bc-cust-q')?.value||'').toLowerCase();
  document.querySelectorAll('#bc-cust-list div').forEach(d => { d.style.display = d.textContent.toLowerCase().includes(q)?'':'none'; });
}

function bcMethod(m) {
  if (m==='debt' && checkoutState.customer.type==='general') { toast('ค้างชำระได้เฉพาะลูกค้าประจำ','warning'); return; }
  checkoutState.method = m;
  document.querySelectorAll('.pay-method-card').forEach(b => b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  bcRenderPayDetail();
  bcRefreshOkBtn();
  if (m === 'transfer') {
    getShopConfig().then(rc => {
      if (rc?.promptpay_number) {
        const payload = generatePromptPayPayload(rc.promptpay_number, checkoutState.total);
        sendToDisplay({ type:'payment_method', method:m, total:checkoutState.total, qrPayload:payload, qrLabel:`พร้อมเพย์ ${rc.promptpay_number}` });
      } else {
        sendToDisplay({ type:'payment_method', method:m, total:checkoutState.total });
      }
    });
  } else {
    sendToDisplay({ type:'payment_method', method:m, total:checkoutState.total });
  }
}

function bcQuickAmounts(total) {
  const set = new Set([total]);
  const rounds = [50,100,200,500,1000];
  for (const r of rounds) {
    const v = Math.ceil(total/r)*r;
    if (v > total && v <= total*3) set.add(v);
    if (set.size >= 4) break;
  }
  return [...set].sort((a,b)=>a-b).slice(0,4);
}

function bcRenderPayDetail() {
  const el = document.getElementById('bc-pay-detail');
  if (!el) return;
  const m = checkoutState.method;
  if (m === 'cash') {
    const amounts = bcQuickAmounts(checkoutState.total);
    el.innerHTML = `
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">ยอดรับเงิน</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
          ${amounts.map(a=>`<button class="quick-amount-btn ${a===checkoutState.total?'exact':''}" onclick="bcSetAmt(${a})">฿${formatNum(a)}${a===checkoutState.total?' ✓':''}</button>`).join('')}
        </div>
        <div style="position:relative;margin-bottom:12px;">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:16px;font-weight:700;color:var(--text-tertiary);">฿</span>
          <input type="number" id="bc-recv-inp" class="form-input" style="padding-left:30px;font-size:20px;font-weight:800;text-align:right;height:52px;"
            placeholder="${checkoutState.total}" value="${checkoutState.received||''}" oninput="bcCalcChange()" min="${checkoutState.total}">
        </div>
        <div id="bc-change-box" style="padding:16px;border-radius:12px;text-align:center;border:2px solid #86efac;background:linear-gradient(135deg,#f0fdf4,#dcfce7);">
          <div style="font-size:11px;color:#16a34a;font-weight:600;margin-bottom:4px;">เงินทอน (ระบบคำนวณให้)</div>
          <div id="bc-change-val" style="font-size:34px;font-weight:900;color:#15803d;">฿${formatNum(Math.max(0,(checkoutState.received||0)-checkoutState.total))}</div>
          <div style="font-size:11px;color:#16a34a;margin-top:4px;">พนักงานแบ่งเงินทอนให้ลูกค้าเอง</div>
        </div>
      </div>`;
  } else if (m === 'transfer') {
    el.innerHTML = `<div style="text-align:center;" id="bc-qr-wrap"><div style="color:var(--text-tertiary);padding:20px;"><i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;">hourglass_empty</i>กำลังโหลด QR...</div></div>`;
    getShopConfig().then(rc => {
      const wrap = document.getElementById('bc-qr-wrap');
      if (!wrap) return;
      if (rc && rc.promptpay_number) {
        const payload = generatePromptPayPayload(rc.promptpay_number, checkoutState.total);
        wrap.innerHTML = `
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">สแกน QR พร้อมเพย์</div>
          <div id="bc-qr-canvas" style="display:inline-block;padding:12px;background:#fff;border-radius:14px;border:3px solid var(--primary);"></div>
          <div style="margin-top:10px;font-size:24px;font-weight:900;color:var(--primary);">฿${formatNum(checkoutState.total)}</div>
          <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">${rc.promptpay_number}</div>`;
        renderQRInto(document.getElementById('bc-qr-canvas'), payload, 170);
        sendToDisplay({ type:'qr', amount:checkoutState.total, promptpayNumber:rc.promptpay_number, qrPayload:payload });
      } else {
        wrap.innerHTML = `<div style="padding:30px;color:var(--text-tertiary);"><i class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px;">qr_code</i><div style="font-size:13px;">กรุณาตั้งค่าเบอร์พร้อมเพย์<br>ในหน้าผู้ดูแลระบบ</div></div>`;
      }
    });
    checkoutState.received = checkoutState.total;
    checkoutState.change   = 0;
    setTimeout(bcRefreshOkBtn, 500);
  } else if (m === 'credit') {
    el.innerHTML = `
      <div style="text-align:center;padding:24px;">
        <i class="material-icons-round" style="font-size:52px;color:#6366f1;display:block;margin-bottom:12px;">credit_card</i>
        <div style="font-size:15px;font-weight:600;color:var(--text-secondary);">รูดบัตรเครดิต</div>
        <div style="font-size:30px;font-weight:900;color:var(--primary);margin-top:8px;">฿${formatNum(checkoutState.total)}</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">กดยืนยันเมื่อรูดบัตรเสร็จแล้ว</div>
      </div>`;
    checkoutState.received = checkoutState.total;
    checkoutState.change   = 0;
  } else if (m === 'debt') {
    el.innerHTML = `
      <div style="text-align:center;padding:24px;">
        <i class="material-icons-round" style="font-size:52px;color:var(--warning);display:block;margin-bottom:12px;">pending</i>
        <div style="font-size:15px;font-weight:600;color:var(--text-secondary);">บันทึกเป็นหนี้ค้างชำระ</div>
        <div style="font-size:30px;font-weight:900;color:var(--warning);margin-top:8px;">฿${formatNum(checkoutState.total)}</div>
        <div style="margin-top:12px;padding:10px 16px;background:var(--bg-base);border-radius:8px;font-size:13px;color:var(--text-secondary);">ลูกค้า: <strong>${checkoutState.customer.name}</strong></div>
      </div>`;
    checkoutState.received = 0;
    checkoutState.change   = 0;
  }
}

function bcSetAmt(a) {
  checkoutState.received = a;
  const inp = document.getElementById('bc-recv-inp');
  if (inp) { inp.value = a; bcCalcChange(); }
  document.querySelectorAll('.quick-amount-btn').forEach(b => {
    const v = Number(b.textContent.replace(/[฿,✓\s]/g,''));
    b.style.borderColor  = v===a?'var(--primary)':'var(--border-light)';
    b.style.color        = v===a?'var(--primary)':'';
    b.style.background   = v===a?'var(--primary-50,#fef2f2)':'var(--bg-base)';
  });
}

function bcCalcChange() {
  const inp  = document.getElementById('bc-recv-inp');
  const recv = Number(inp?.value || 0);
  checkoutState.received = recv;
  checkoutState.change   = Math.max(0, recv - checkoutState.total);
  const cv = document.getElementById('bc-change-val');
  if (cv) cv.textContent = `฿${formatNum(checkoutState.change)}`;
  const box = document.getElementById('bc-change-box');
  if (box) {
    const ok = recv >= checkoutState.total;
    box.style.background    = ok ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#fef2f2,#fee2e2)';
    box.style.borderColor   = ok ? '#86efac' : '#fca5a5';
    if (cv) cv.style.color  = ok ? '#15803d' : '#dc2626';
  }
  bcRefreshOkBtn();
}

function bcRefreshOkBtn() {
  const btn = document.getElementById('bc-ok-btn');
  if (!btn) return;
  let ok = checkoutState.method !== null;
  if (checkoutState.method === 'cash') ok = checkoutState.received >= checkoutState.total;
  btn.disabled         = !ok;
  btn.style.opacity    = ok ? '1' : '.45';
  btn.style.cursor     = ok ? 'pointer' : 'not-allowed';
}

async function bcConfirm() {
  if (isProcessingPayment) return;
  if (!checkoutState.method) { toast('กรุณาเลือกวิธีชำระเงิน','warning'); return; }
  if (checkoutState.method==='cash' && checkoutState.received < checkoutState.total) {
    toast('ยอดรับเงินไม่เพียงพอ','error'); return;
  }
  closeBillCheckout();
  await completePayment();
}

// ══════════════════════════════════════════════════════════════════
// 5. Attendance Page — 3 Tabs
// ══════════════════════════════════════════════════════════════════
window.renderAttendance = async function() {
  const section = document.getElementById('page-att');
  if (!section) return;
  section.innerHTML = `
    <div style="padding-bottom:24px;">
      <div class="att-tab-bar">
        <button class="att-tab active" data-att="checkin" onclick="switchAttTab('checkin')"><i class="material-icons-round">how_to_reg</i> เช็คชื่อมาทำงาน</button>
        <button class="att-tab" data-att="advance" onclick="switchAttTab('advance')"><i class="material-icons-round">payments</i> เบิกเงิน</button>
        <button class="att-tab" data-att="payroll" onclick="switchAttTab('payroll')"><i class="material-icons-round">account_balance_wallet</i> จ่ายเงินเดือน</button>
        <button class="att-tab" data-att="emps" onclick="switchAttTab('emps')"><i class="material-icons-round">badge</i> ข้อมูลพนักงาน</button>
      </div>
      <div id="att-tab-checkin" class="att-tab-content active" style="padding-top:20px;"></div>
      <div id="att-tab-advance" class="att-tab-content" style="padding-top:20px;"></div>
      <div id="att-tab-payroll" class="att-tab-content" style="padding-top:20px;"></div>
      <div id="att-tab-emps"    class="att-tab-content" style="padding-top:20px;"></div>
    </div>`;
  await loadAttCheckin();
};

function switchAttTab(tab) {
  document.querySelectorAll('.att-tab').forEach(t => t.classList.toggle('active', t.dataset.att===tab));
  document.querySelectorAll('.att-tab-content').forEach(c => { c.style.display='none'; c.classList.remove('active'); });
  const el = document.getElementById(`att-tab-${tab}`);
  if (el) { el.style.display='block'; el.classList.add('active'); }
  if (tab==='checkin')  loadAttCheckin();
  if (tab==='advance')  loadAttAdvance();
  if (tab==='payroll')  loadAttPayroll();
  if (tab==='emps')     loadAttEmps();
}

async function loadAttCheckin() {
  const sec = document.getElementById('att-tab-checkin');
  if (!sec) return;
  const today = new Date().toISOString().split('T')[0];
  const emps  = await loadEmployees();
  const actives = emps.filter(e => e.status==='ทำงาน');
  const { data: attToday } = await db.from('เช็คชื่อ').select('*').eq('date', today);
  const attMap = {};
  (attToday||[]).forEach(a => { attMap[a.employee_id] = a; });

  const ATT_STATUS_MAP = typeof ATT_STATUS !== 'undefined' ? ATT_STATUS : {
    'มาทำงาน':   { color:'#10B981', label:'มาทำงาน',  deductPct:0 },
    'มาสาย':     { color:'#F59E0B', label:'มาสาย',    deductPct:25 },
    'ลากิจ':     { color:'#6366f1', label:'ลากิจ',    deductPct:100 },
    'ลาป่วย':    { color:'#3B82F6', label:'ลาป่วย',   deductPct:0 },
    'ขาดงาน':    { color:'#EF4444', label:'ขาดงาน',   deductPct:100 }
  };

  const checkedIn  = Object.values(attMap).filter(a => a.status==='มาทำงาน'||a.status==='มาสาย').length;
  const absent     = actives.length - Object.keys(attMap).length;

  sec.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <div>
        <h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">เช็คชื่อวันนี้ — ${new Date().toLocaleDateString('th-TH',{dateStyle:'full'})}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span style="padding:3px 10px;border-radius:999px;background:#d1fae5;color:#065f46;font-size:12px;font-weight:600;">${checkedIn} มาทำงาน</span>
          <span style="padding:3px 10px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:12px;font-weight:600;">${absent} ยังไม่ลง</span>
          <span style="padding:3px 10px;border-radius:999px;background:var(--bg-base);color:var(--text-secondary);font-size:12px;">${actives.length} คนทั้งหมด</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline" onclick="showAttDatePicker?.()"><i class="material-icons-round">calendar_today</i> ย้อนหลัง</button>
      </div>
    </div>
    <div class="emp-att-grid">
      ${actives.map(emp => {
        const att = attMap[emp.id];
        const stColor = att ? (ATT_STATUS_MAP[att.status]?.color||'#888') : '#94a3b8';
        const stLabel = att ? att.status : 'ยังไม่ลง';
        const isIn    = att && !att.time_out;
        const isDone  = att && att.time_out;
        return `
          <div class="emp-att-card ${att&&!att.time_out?'checked-in':att&&att.time_out?'checked-out':''}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div>
                <div style="font-size:14px;font-weight:700;">${emp.name} ${emp.lastname||''}</div>
                <div style="font-size:12px;color:var(--text-tertiary);">${emp.position||''}</div>
              </div>
              <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#fff;background:${stColor};flex-shrink:0;">${stLabel}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);">
              <span>เข้า: <strong>${att?.time_in||'-'}</strong></span>
              <span>ออก: <strong>${att?.time_out||'-'}</strong></span>
              <span>฿${formatNum(emp.daily_wage||0)}/วัน</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${!att
                ? `<button class="btn btn-primary btn-sm" style="flex:1;" onclick="showCheckInModal?.('${emp.id}','${emp.name}')"><i class="material-icons-round" style="font-size:14px;">login</i> ลงชื่อเข้า</button>`
                : `${!att.time_out?`<button class="btn btn-outline btn-sm" onclick="checkOutEmp?.('${att.id}')"><i class="material-icons-round" style="font-size:14px;">logout</i> ออกงาน</button>`:''}
                   <button class="btn btn-ghost btn-sm" onclick="showEditAttModal?.('${att.id}','${emp.id}','${emp.name}')"><i class="material-icons-round" style="font-size:14px;">edit</i></button>`}
              <button class="btn btn-ghost btn-sm" style="color:var(--warning);" title="เบิกเงิน" onclick="openAdvanceWizard?.('${emp.id}','${emp.name}')"><i class="material-icons-round" style="font-size:14px;">account_balance_wallet</i></button>
            </div>
          </div>`;
      }).join('')}
    </div>
    ${actives.length===0?`<div style="text-align:center;padding:60px;color:var(--text-tertiary);">ยังไม่มีพนักงานที่ทำงานอยู่</div>`:''}`;
}

async function loadAttAdvance() {
  const sec = document.getElementById('att-tab-advance');
  if (!sec) return;
  const emps = await loadEmployees();
  const actives = emps.filter(e => e.status==='ทำงาน');
  const today = new Date().toISOString().split('T')[0];
  const { data: advances } = await db.from('เบิกเงิน').select('*, พนักงาน(name,lastname)').order('date', { ascending: false }).limit(50).catch(()=>({data:[]}));
  const totalToday = (advances||[]).filter(a=>(a.date||'').startsWith(today)&&a.status==='อนุมัติ').reduce((s,a)=>s+a.amount,0);

  sec.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <div>
        <h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">การเบิกเงินพนักงาน</h3>
        <div style="font-size:13px;color:var(--text-secondary);">เบิกวันนี้รวม: <strong style="color:var(--warning);">฿${formatNum(totalToday)}</strong></div>
      </div>
      <button class="btn btn-primary" onclick="attNewAdvance()"><i class="material-icons-round">add</i> เบิกเงินใหม่</button>
    </div>
    <div style="background:var(--bg-surface);border-radius:var(--radius-lg);border:1px solid var(--border-light);overflow:hidden;">
      <table class="data-table">
        <thead><tr><th>พนักงาน</th><th>จำนวน</th><th>วิธีจ่าย</th><th>เหตุผล</th><th>วันที่</th><th>สถานะ</th><th>อนุมัติโดย</th></tr></thead>
        <tbody>
          ${(advances||[]).length===0?`<tr><td colspan="7" style="text-align:center;color:var(--text-tertiary);padding:30px;">ยังไม่มีรายการเบิกเงิน</td></tr>`:''}
          ${(advances||[]).map(a=>{
            const empName = a['พนักงาน']?.name || emps.find(e=>e.id===a.employee_id)?.name || a.employee_id;
            return `<tr>
              <td><strong>${empName}</strong></td>
              <td><strong style="color:var(--warning);">฿${formatNum(a.amount)}</strong></td>
              <td>${a.method||'เงินสด'}</td>
              <td style="color:var(--text-secondary);font-size:12px;">${a.reason||'-'}</td>
              <td style="white-space:nowrap;font-size:12px;">${a.date?formatDateTime(a.date):'-'}</td>
              <td><span class="badge ${a.status==='อนุมัติ'?'badge-success':'badge-warning'}">${a.status||'รออนุมัติ'}</span></td>
              <td style="font-size:12px;">${a.approved_by||'-'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function attNewAdvance() {
  openModal('เบิกเงินพนักงาน', `
    <form id="adv-form" onsubmit="event.preventDefault();">
      <div class="form-group"><label class="form-label">พนักงาน *</label>
        <select class="form-input" id="adv-emp-sel">
          <option value="">-- เลือกพนักงาน --</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label class="form-label">จำนวน (บาท) *</label><input class="form-input" type="number" id="adv-amount" min="1" placeholder="0"></div>
        <div class="form-group"><label class="form-label">วิธีจ่าย</label>
          <select class="form-input" id="adv-method"><option>เงินสด</option><option>โอนเงิน</option></select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">เหตุผล</label><input class="form-input" id="adv-reason" placeholder="ระบุเหตุผล"></div>
      <button type="button" class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="submitAdvance()"><i class="material-icons-round">payments</i> อนุมัติเบิกเงิน</button>
    </form>`);
  loadEmployees().then(emps => {
    const sel = document.getElementById('adv-emp-sel');
    if (!sel) return;
    emps.filter(e=>e.status==='ทำงาน').forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} ${e.lastname||''}`;
      sel.appendChild(opt);
    });
  });
}

async function submitAdvance() {
  const empId  = document.getElementById('adv-emp-sel')?.value;
  const amount = Number(document.getElementById('adv-amount')?.value||0);
  const method = document.getElementById('adv-method')?.value||'เงินสด';
  const reason = document.getElementById('adv-reason')?.value||'';
  if (!empId) { toast('กรุณาเลือกพนักงาน','error'); return; }
  if (amount<=0) { toast('กรุณาระบุจำนวน','error'); return; }
  await _doAdvance?.(empId, amount, method, reason, null);
  closeModal();
  loadAttAdvance();
}

async function loadAttPayroll() {
  const sec = document.getElementById('att-tab-payroll');
  if (!sec) return;
  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth() + 1;
  const monthStr  = `${year}-${String(month).padStart(2,'0')}`;

  const emps = await loadEmployees();
  const actives = emps.filter(e => e.status==='ทำงาน');

  const startDate = `${monthStr}-01`;
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

  const { data: attAll } = await db.from('เช็คชื่อ')
    .select('employee_id,status,date')
    .gte('date', startDate).lte('date', endDate);

  const { data: advAll } = await db.from('เบิกเงิน')
    .select('employee_id,amount,status')
    .gte('date', startDate+'T00:00:00').eq('status','อนุมัติ').catch(()=>({data:[]}));

  const ATT_STATUS_MAP = typeof ATT_STATUS !== 'undefined' ? ATT_STATUS : {
    'มาทำงาน':{ deductPct:0 },'มาสาย':{ deductPct:25 },'ลากิจ':{ deductPct:100 },'ลาป่วย':{ deductPct:0 },'ขาดงาน':{ deductPct:100 }
  };

  const rows = actives.map(emp => {
    const empAtt   = (attAll||[]).filter(a => a.employee_id===emp.id);
    const empAdv   = (advAll||[]).filter(a => a.employee_id===emp.id).reduce((s,a)=>s+a.amount,0);
    const daysWork = empAtt.filter(a => a.status==='มาทำงาน').length;
    const daysLate = empAtt.filter(a => a.status==='มาสาย').length;
    const daysAbsent = empAtt.filter(a => a.status==='ขาดงาน'||a.status==='ลากิจ').length;
    const wage     = emp.daily_wage || 0;
    const gross    = daysWork * wage + daysLate * wage * (1 - (ATT_STATUS_MAP['มาสาย']?.deductPct||25)/100);
    const deduct   = daysAbsent * wage;
    const net      = Math.max(0, gross - empAdv);
    return { emp, daysWork, daysLate, daysAbsent, gross, deduct, empAdv, net };
  });

  const totalNet = rows.reduce((s,r)=>s+r.net, 0);

  sec.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <div>
        <h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">จ่ายเงินเดือน</h3>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="payroll-month" class="form-input" style="width:160px;font-size:13px;" onchange="loadAttPayroll()">
            ${Array.from({length:6},(_,i)=>{
              const d = new Date(year, month-1-i, 1);
              const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
              return `<option value="${v}" ${i===0?'selected':''}>${d.toLocaleDateString('th-TH',{year:'numeric',month:'long'})}</option>`;
            }).join('')}
          </select>
          <span style="font-size:13px;color:var(--text-secondary);">รวมจ่าย: <strong style="color:var(--success);">฿${formatNum(totalNet)}</strong></span>
        </div>
      </div>
      <button class="btn btn-primary" onclick="processAllPayroll()"><i class="material-icons-round">send</i> จ่ายเงินเดือนทั้งหมด</button>
    </div>
    <div style="background:var(--bg-surface);border-radius:var(--radius-lg);border:1px solid var(--border-light);overflow:hidden;">
      <table class="data-table">
        <thead><tr>
          <th>พนักงาน</th><th>ตำแหน่ง</th>
          <th class="text-center">วันทำงาน</th>
          <th class="text-center">มาสาย</th>
          <th class="text-center">ขาด</th>
          <th class="text-right">เงินเดือนรวม</th>
          <th class="text-right">ยอดเบิก</th>
          <th class="text-right">สุทธิ</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${rows.map(r=>`
            <tr>
              <td><strong>${r.emp.name} ${r.emp.lastname||''}</strong></td>
              <td style="color:var(--text-secondary);font-size:12px;">${r.emp.position||'-'}</td>
              <td class="text-center"><span class="badge badge-success">${r.daysWork}</span></td>
              <td class="text-center"><span class="badge badge-warning">${r.daysLate}</span></td>
              <td class="text-center"><span class="badge badge-danger">${r.daysAbsent}</span></td>
              <td class="text-right">฿${formatNum(Math.round(r.gross))}</td>
              <td class="text-right payroll-deduct">-฿${formatNum(r.empAdv)}</td>
              <td class="text-right payroll-net">฿${formatNum(Math.round(r.net))}</td>
              <td>
                <button class="btn btn-primary btn-sm" onclick="payOneEmployee('${r.emp.id}','${(r.emp.name+' '+(r.emp.lastname||'')).trim()}',${Math.round(r.net)})">
                  <i class="material-icons-round" style="font-size:13px;">send</i> จ่าย
                </button>
              </td>
            </tr>`).join('')}
          ${rows.length===0?`<tr><td colspan="9" style="text-align:center;color:var(--text-tertiary);padding:30px;">ไม่มีพนักงาน</td></tr>`:''}
        </tbody>
        <tfoot>
          <tr style="background:var(--bg-base);font-weight:700;">
            <td colspan="5" style="text-align:right;padding:10px;">รวมทั้งหมด</td>
            <td class="text-right">฿${formatNum(rows.reduce((s,r)=>s+Math.round(r.gross),0))}</td>
            <td class="text-right payroll-deduct">-฿${formatNum(rows.reduce((s,r)=>s+r.empAdv,0))}</td>
            <td class="text-right payroll-net">฿${formatNum(Math.round(totalNet))}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

async function payOneEmployee(empId, empName, amount) {
  const { isConfirmed } = await Swal.fire({
    title: `จ่ายเงินเดือน: ${empName}`,
    html: `<div style="font-size:28px;font-weight:900;color:var(--success);margin:8px 0;">฿${formatNum(amount)}</div><p style="color:var(--text-secondary);font-size:13px;">ต้องการบันทึกการจ่ายเงินเดือนนี้?</p>`,
    icon: 'question', showCancelButton: true,
    confirmButtonText: '<i class="material-icons-round" style="font-size:14px;vertical-align:middle;">payments</i> ยืนยันจ่าย',
    cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10B981'
  });
  if (!isConfirmed) return;
  const monthEl = document.getElementById('payroll-month');
  const period  = monthEl?.value || new Date().toISOString().slice(0,7);
  await db.from('จ่ายเงินเดือน').insert({
    employee_id: empId, period, amount, method: 'เงินสด',
    paid_by: USER?.username, status: 'จ่ายแล้ว'
  });
  toast(`จ่ายเงินเดือน ${empName} สำเร็จ`, 'success');
  logActivity('จ่ายเงินเดือน', `${empName} ฿${formatNum(amount)}`);
  loadAttPayroll();
}

async function processAllPayroll() {
  const rows = document.querySelectorAll('#att-tab-payroll tbody tr');
  const { isConfirmed } = await Swal.fire({
    title: 'จ่ายเงินเดือนทั้งหมด?',
    html: `<p>จะบันทึกการจ่ายเงินเดือนสำหรับพนักงานทุกคนในรายการ</p>`,
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#10B981'
  });
  if (!isConfirmed) return;
  // Click all individual pay buttons
  document.querySelectorAll('#att-tab-payroll .btn-primary').forEach(b => b.click());
}

async function loadAttEmps() {
  const sec = document.getElementById('att-tab-emps');
  if (!sec) return;
  const emps = await loadEmployees();
  sec.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:15px;font-weight:700;">ข้อมูลพนักงาน</h3>
      <button class="btn btn-primary" onclick="showEmployeeModal?.()"><i class="material-icons-round">person_add</i> เพิ่มพนักงาน</button>
    </div>
    <div style="background:var(--bg-surface);border-radius:var(--radius-lg);border:1px solid var(--border-light);overflow:hidden;">
      <table class="data-table">
        <thead><tr><th>ชื่อ</th><th>ตำแหน่ง</th><th>เบอร์โทร</th><th class="text-right">ค่าจ้าง/วัน</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
        <tbody>
          ${(emps||[]).map(e=>`
            <tr>
              <td><strong>${e.name} ${e.lastname||''}</strong></td>
              <td>${e.position||'-'}</td>
              <td>${e.phone||'-'}</td>
              <td class="text-right">฿${formatNum(e.daily_wage||0)}</td>
              <td><span class="badge ${e.status==='ทำงาน'?'badge-success':'badge-danger'}">${e.status||'-'}</span></td>
              <td>
                <button class="btn btn-ghost btn-icon" onclick="editEmployee?.('${e.id}')"><i class="material-icons-round">edit</i></button>
                <button class="btn btn-ghost btn-icon" style="color:var(--warning);" onclick="openAdvanceWizard?.('${e.id}','${e.name}')"><i class="material-icons-round">payments</i></button>
              </td>
            </tr>`).join('')}
          ${emps.length===0?`<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-tertiary);">ยังไม่มีข้อมูลพนักงาน</td></tr>`:''}
        </tbody>
      </table>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
// 6. Customer Display — QR Payload Support
// ══════════════════════════════════════════════════════════════════
// Inject helper so customer-display.html can call window.parent or receive via postMessage
window._v3QRPayload = null;
const _origSendToDisplay = window.sendToDisplay;
window.sendToDisplay = function(data) {
  // Enhance QR messages with PromptPay payload
  if (data.type === 'qr' && data.promptpayNumber && !data.qrPayload) {
    data.qrPayload = generatePromptPayPayload(data.promptpayNumber, data.amount || 0);
  }
  if (_origSendToDisplay) _origSendToDisplay(data);
};

// Also patch selectPaymentMethod for the old checkout (if used)
const _origSelectPaymentMethod = window.selectPaymentMethod;
window.selectPaymentMethod = function(method) {
  if (_origSelectPaymentMethod) _origSelectPaymentMethod.call(this, method);
  if (method === 'transfer') {
    getShopConfig().then(rc => {
      if (rc?.promptpay_number) {
        const payload = generatePromptPayPayload(rc.promptpay_number, checkoutState.total);
        sendToDisplay({ type:'qr', amount:checkoutState.total, promptpayNumber:rc.promptpay_number, qrPayload:payload });
      }
    });
  }
};



console.log('[SK POS modules-v3.js] ✅ v3 features loaded');
