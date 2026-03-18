/**
 * SK POS — Application Logic
 * 🚀 บอร์ดส่วนกลาง จัดการ State, Navigation และ Supabase Connection
 */

// 1. INITIALIZATION & STATE
const db = supabase.createClient(SUPA_URL, SUPA_KEY);

let USER = null;
let USER_PERMS = null;
let products = [];
let cart = [];
let categories = [];
let dashStart = '';
let dashEnd = '';
let dashPeriod = 'today';
let selectedCustomer = { type: 'general', id: null, name: 'ลูกค้าทั่วไป' };
let checkoutState = { total: 0, discount: 0, customer: { type: 'general', id: null, name: 'ลูกค้าทั่วไป' }, method: null };

let activeCategory = 'ทั้งหมด';
let currentPage = 'pos';

// Map Pages to Icons and Titles
const pageConfig = {
    pos: { title: 'ขายสินค้า (POS)', emoji: '🛒' },
    inv: { title: 'คลังสินค้า (Inv)', emoji: '📦' },
    dash: { title: 'สรุปผล (Dash)', emoji: '📊' },
    exp: { title: 'รายจ่าย', emoji: '💸' },
    debt: { title: 'ลูกหนี้', emoji: '👥' },
    cash: { title: 'ลิ้นชักเงินสด', emoji: '💰' },
    purchase: { title: 'รับสินค้าเข้า', emoji: '📥' },
    customer: { title: 'ลูกค้าประจำ', emoji: '⭐️' },
    att: { title: 'พนักงาน/ลงเวลา', emoji: '🪪' },
    history: { title: 'ประวัติการขาย', emoji: '📜' },
    log: { title: 'ประวัติกิจกรรม', emoji: '📑' }
};

// 2. DOM ELEMENTS — Global
const UI = {
    loginScreen: document.getElementById('login-screen'),
    appLayout: document.getElementById('app-layout'),
    pinInputs: [
        document.getElementById('pin-1'),
        document.getElementById('pin-2'),
        document.getElementById('pin-3'),
        document.getElementById('pin-4')
    ],
    userDispName: document.getElementById('user-display-name'),
    userDispRole: document.getElementById('user-display-role'),
    navItems: document.querySelectorAll('.nav-item'),
    pageIcon: document.getElementById('page-icon'),
    pageTitle: document.getElementById('page-title-text'),
    pageActions: document.getElementById('page-actions'),
    pageSections: document.querySelectorAll('.page-section'),
    toastContainer: document.getElementById('toast-container'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    closeModal: document.getElementById('close-modal-btn')
};

// 3. UTILITIES
// --- Constants for Cash Counting ---
const BN_BILLS = [
    { val: 1000, label: '1,000' },
    { val: 500, label: '500' },
    { val: 100, label: '100' },
    { val: 50, label: '50' },
    { val: 20, label: '20' }
];
const BN_COINS = [
    { val: 10, label: '10' },
    { val: 5, label: '5' },
    { val: 2, label: '2' },
    { val: 1, label: '1' }
];

let BN = {
    counts: {},
    stock: {},
    recCounts: null,
    required: 0,
    callback: null,
    mode: 'receive', 
    title: '',
    totalReceived: 0,
    changeRequired: 0
};

function formatNum(n) { return Number(n || 0).toLocaleString('th-TH'); }
function formatDate(d) { return new Date(d).toLocaleDateString('th-TH', { dateStyle: 'medium' }); }
function formatTime(d) { return new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }

// [UX-NEW-01] — Toast ปรับให้รองรับ Dark Mode เต็มรูปแบบ
function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = 'card';
    t.style.cssText = `
        background: var(--bg-deep);
        border-left: 4px solid ${type === 'success' ? 'var(--green-neon)' : 'var(--red-neon)'};
        padding: 12px 20px;
        box-shadow: var(--shadow-md);
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 250px;
        max-width: 360px;
        color: var(--text-1);
        animation: slideIn 0.3s ease-out;
    `;
    const icon = type === 'success' ? 'check_circle' : 'error';
    const color = type === 'success' ? 'var(--green-neon)' : 'var(--red-neon)';
    t.innerHTML = `<i class="material-icons-round" style="color:${color};font-size:20px;">${icon}</i><span style="font-weight:500;">${msg}</span>`;
    UI.toastContainer.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(20px)';
        t.style.transition = '0.3s';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

// 4. LOGIN LOGIC
UI.pinInputs.forEach((input, idx) => {
    input.addEventListener('keyup', (e) => {
        if (e.key >= 0 && e.key <= 9) {
            if (idx < 3) UI.pinInputs[idx + 1].focus();
            else checkLogin();
        } else if (e.key === 'Backspace') {
            if (idx > 0) UI.pinInputs[idx - 1].focus();
        }
    });
});

document.getElementById('login-btn').addEventListener('click', checkLogin);

async function checkLogin() {
    const pin = UI.pinInputs.map(i => i.value).join('');
    if (pin.length < 4) return;

    try {
        const { data: user, error } = await db.from('ผู้ใช้งาน').select('*').eq('pin', pin).single();
        if (error || !user) throw new Error('รหัส PIN ไม่ถูกต้อง');

        const { data: perms, error: perr } = await db.from('สิทธิ์การเข้าถึง').select('*').eq('user_id', user.id).single();
        if (perr) throw new Error('ไม่พบข้อมูลสิทธิ์การใช้งาน');

        USER = user;
        USER_PERMS = perms;
        
        // Setup UI for the logged in user
        UI.userDispName.innerText = user.username;
        UI.userDispRole.innerText = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน';
        
        UI.loginScreen.classList.add('hidden');
        UI.appLayout.classList.remove('hidden');
        
        applyPermissions();
        updateGlobalBalance(); 
        go('pos');
        logAct('เข้าสู่ระบบ', `ผู้ใช้ ${user.username} เข้าสู่ระบบ`);
        toast(`ยินดีต้อนรับ คุณ${user.username}`);
        
        // [FEAT-01b] — Quagga.js Scanner (Desktop Chrome/Firefox fallback)
async function openQuaggaScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const { value } = await Swal.fire({
            title: '📷 สแกนบาร์โค้ด',
            html: '<p style="color:#888;font-size:14px;">ไม่มีกล้อง — กรอกบาร์โค้ดด้วยตนเอง</p>',
            input: 'text', inputPlaceholder: 'กรอกบาร์โค้ด...',
            confirmButtonText: 'ค้นหา', showCancelButton: true, cancelButtonText: 'ยกเลิก'
        });
        if (value) _processScanCode(value.trim());
        return;
    }

    const content = `
        <div id="quagga-viewport" style="position:relative;width:100%;min-height:260px;background:#000;border-radius:12px;overflow:hidden;">
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10;">
                <div style="width:75%;max-width:290px;height:80px;border:2px solid #E53935;border-radius:8px;
                            box-shadow:0 0 0 2000px rgba(0,0,0,0.45);">
                    <div style="position:relative;width:100%;height:100%;">
                        <div id="scan-laser2" style="position:absolute;top:0;left:0;right:0;height:2px;
                            background:linear-gradient(90deg,transparent,#FF5252,transparent);
                            animation:scan-laser2 1.8s ease-in-out infinite;"></div>
                    </div>
                </div>
            </div>
            <div id="scan-msg" style="position:absolute;bottom:0;left:0;right:0;padding:8px;text-align:center;
                font-size:13px;color:#fff;background:rgba(0,0,0,0.6);z-index:11;">⏳ กำลังเริ่มกล้อง...</div>
        </div>
        <style>@keyframes scan-laser2{0%{top:5%}50%{top:88%}100%{top:5%}}</style>
        <div style="display:flex;gap:10px;margin-top:12px;">
            <button class="btn btn-white" style="flex:1;" onclick="window._qStop&&window._qStop();closeModal();">❌ ยกเลิก</button>
            <button class="btn btn-white" style="flex:1;" onclick="window._qStop&&window._qStop();closeModal();setTimeout(()=>_openManualBc(),200);">⌨️ พิมพ์เอง</button>
        </div>
    `;
    openModal('📷 สแกนบาร์โค้ดสินค้า', content);

    window._openManualBc = async function() {
        const { value } = await Swal.fire({
            title: 'กรอกบาร์โค้ด', input: 'text', inputPlaceholder: 'กรอกบาร์โค้ด...',
            confirmButtonText: 'ค้นหา', showCancelButton: true
        });
        if (value) _processScanCode(value.trim());
    };

    // โหลด Quagga ถ้ายังไม่มี
    if (!window.Quagga) {
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        }).catch(() => null);
    }

    const msgEl = document.getElementById('scan-msg');
    const viewport = document.getElementById('quagga-viewport');

    if (!window.Quagga || !viewport) {
        if (msgEl) msgEl.textContent = '❌ โหลด Quagga ไม่ได้ — กดปุ่ม "พิมพ์เอง"';
        return;
    }

    window._qStop = () => {
        try { if(window._quaggaOn){ Quagga.offDetected(); Quagga.stop(); window._quaggaOn=false; } } catch(e){}
    };

    if (msgEl) msgEl.textContent = '🔍 กำลังสแกน — วางบาร์โค้ดในกรอบ';

    Quagga.init({
        inputStream: {
            name: 'Live', type: 'LiveStream', target: viewport,
            constraints: { facingMode: 'environment', width:{ideal:1280}, height:{ideal:720} }
        },
        locator: { patchSize: 'medium', halfSample: true },
        numOfWorkers: 2,
        frequency: 8,
        decoder: { readers: ['ean_reader','ean_8_reader','code_128_reader','code_39_reader','upc_reader','upc_e_reader'] }
    }, function(err) {
        if (err) {
            if (msgEl) msgEl.textContent = '❌ เปิดกล้องไม่ได้ — กดปุ่ม "พิมพ์เอง"';
            return;
        }
        window._quaggaOn = true;
        Quagga.start();
    });

    Quagga.onDetected(function(result) {
        const code = result && result.codeResult && result.codeResult.code;
        if (!code) return;
        window._qStop();
        closeModal();
        _processScanCode(code);
    });
}

function _processScanCode(code) {
    const searchEl = document.getElementById('pos-search');
    if (searchEl) {
        searchEl.value = code;
        searchEl.dispatchEvent(new Event('input'));
    }
    const found = products.filter(p => p.barcode === code);
    if (found.length === 0) {
        toast('ไม่พบสินค้าบาร์โค้ด: ' + code, 'error');
    } else {
        toast('✅ สแกนเจอ: ' + found[0].name);
        if (found.length === 1) addToCart(found[0]);
    }
}

// [FEAT-02] — Supabase Realtime สำหรับ Stock Sync
        setupRealtime();

    } catch (err) {
        toast(err.message, 'error');
        // [UX-05] — PIN Login ต้องมี Shake Animation เมื่อผิด
        const container = document.querySelector('.pin-input-container');
        if (container) {
            container.style.animation = 'shake 0.4s ease';
            setTimeout(() => container.style.animation = '', 400);
        }
        UI.pinInputs.forEach(i => i.value = '');
        UI.pinInputs[0].focus();
    }
}

function applyPermissions() {
    // [V3-FEAT-01] — แสดงปุ่มตั้งค่าร้านค้าเฉพาะ admin
    const settingsNav = document.getElementById('nav-settings');
    if (settingsNav) settingsNav.style.display = USER.role === 'admin' ? 'flex' : 'none';

    // Hide nav items based on can_...
    const map = {
        'nav-pos': USER_PERMS.can_pos,
        'nav-inv': USER_PERMS.can_inv,
        'nav-dash': USER_PERMS.can_dash,
        'nav-exp': USER_PERMS.can_exp,
        'nav-debt': USER_PERMS.can_debt,
        'nav-cash': USER_PERMS.can_cash,
        'nav-purchase': USER_PERMS.can_purchase,
        'nav-customer': USER_PERMS.can_pos || USER_PERMS.can_dash, // Common access
        'nav-att': USER_PERMS.can_att,
        'nav-history': USER_PERMS.can_pos || USER_PERMS.can_dash, // Add history permission
        'nav-log': USER_PERMS.can_log
    };
    
    for (const [id, allowed] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.style.display = allowed ? 'flex' : 'none';
    }
}

// 5. NAVIGATION
function go(page) {
    currentPage = page;
    updateGlobalBalance();

    UI.navItems.forEach(i => i.classList.remove('active'));
    const activeNav = [...UI.navItems].find(i => i.getAttribute('data-page') === page);
    if (activeNav) activeNav.classList.add('active');

    // [FIX BUG-05] — go() เรียก cfg.emoji ที่ไม่มีใน pageConfig
    const cfg = pageConfig[page];
    if (cfg) {
        document.getElementById('page-title-text').innerText = cfg.title;
    }

    UI.pageSections.forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.remove('hidden');

    UI.pageActions.innerHTML = '';
    loadPage(page);
}

// [UX-06] — Mobile: Sidebar Drawer + Hamburger Menu
UI.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-page');
        go(page);
        // ปิด sidebar บน mobile หลัง navigate
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('show');
        }
    });
});

async function loadPage(page) {
    if (page === 'pos') loadPOS();
    else if (page === 'inv') loadInventory();
    else if (page === 'dash') loadDashboard();
    // [FIX BUG-01] — loadExpenseLuxury() ไม่มีอยู่จริง
    else if (page === 'exp') loadExpense();
    else if (page === 'debt') loadDebt();
    else if (page === 'cash') loadCash();
    else if (page === 'purchase') loadPurchase();
    else if (page === 'customer') loadCustomer();
    // [FIX BUG-02] — หน้า Attendance มีฟังก์ชันซ้อนกัน 2 ชุด
    else if (page === 'att') loadHR('att');
    else if (page === 'history') loadHistory();
    else if (page === 'log') loadLog();
}

// 6.5. LUXURY UI RECONSTRUCTION (IMAGE INSPIRED)

// ══════════════════════════════════════════════════════════════════
// HR MODULE — เช็คชื่อ / เบิกเงิน / จ่ายเงินเดือน
// ══════════════════════════════════════════════════════════════════

// --- TAB RENDERER ---
function renderHRTabs(active) {
    const tabs = [
        { key: 'att',     label: 'เช็คชื่อ',       icon: 'how_to_reg',   color: 'blue'   },
        { key: 'advance', label: 'เบิกเงิน',        icon: 'payments',     color: 'orange' },
        { key: 'payroll', label: 'รายงาน',          icon: 'bar_chart',    color: 'green'  },
    ];
    return `
        <div class="hr-tabs">
            ${tabs.map(t => `
                <div class="hr-tab ${active === t.key ? 'hr-tab-active-' + t.color : ''}"
                     onclick="loadHR('${t.key}')">
                    <i class="material-icons-round">${t.icon}</i>
                    <span>${t.label}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderLuxuryTabs(active) { return renderHRTabs(active); }

// --- MAIN DISPATCHER ---
async function loadHR(tab = 'att') {
    if (tab === 'att')     return loadHRAttendance();
    if (tab === 'advance') return loadHRAdvance();
    if (tab === 'payroll') return loadHRPayroll();
}

window.setChoice = (id, val, el) => {
    document.getElementById(id).value = val;
    el.parentElement.querySelectorAll('.hr-radio-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
};

// ══════════════════════════════
// TAB 1 — เช็คชื่อพนักงาน
// ══════════════════════════════
// [FIX BUG-02] — ลบฟังก์ชัน loadAttendanceLuxury() ออก
// async function loadAttendanceLuxury() { return loadHR('att'); }

async function loadHRAttendance() {
    const page = document.getElementById('page-att');
    const today = new Date().toISOString().split('T')[0];
    // อ่านวันจาก input ถ้ามี ป้องกันกรณี user เปลี่ยนวันแล้ว re-render ด้วย today เสมอ
    const dateInput = document.getElementById('att-date');
    const queryDate = dateInput ? dateInput.value : today;

    const { data: staff } = await db.from('พนักงาน').select('*').eq('status','ทำงาน').order('name');
    const { data: existing } = await db.from('เช็คชื่อ').select('*').eq('date', queryDate);

    const statusMap = {};
    existing?.forEach(r => { statusMap[r.employee_id] = r; });

    page.innerHTML = renderHRTabs('att') + `
        <div class="hr-date-bar">
            <span>📅 วันที่บันทึก</span>
            <input type="date" id="att-date" class="glass-input" value="${queryDate}"
                   onchange="loadHRAttendance()" style="width:180px;height:40px;padding:0 12px;">
        </div>
        <div class="hr-card animate-up">
            <div class="hr-card-header blue">
                <div>
                    <div class="hr-label-sm">ATTENDANCE</div>
                    <div class="hr-label-lg">เช็คชื่อพนักงาน ${queryDate === today ? 'วันนี้' : queryDate}</div>
                </div>
                <i class="material-icons-round" style="font-size:32px;opacity:0.5;">groups</i>
            </div>
            <div class="hr-card-body">
                ${staff?.length ? staff.map(s => {
                    const rec = statusMap[s.id];
                    const st = rec?.status || '';
                    return `
                    <div class="hr-emp-row" id="att-row-${s.id}">
                        <div class="hr-emp-info">
                            <div class="hr-avatar">👤</div>
                            <div>
                                <div class="hr-emp-name">${s.name} ${s.lastname || ''}</div>
                                <div class="hr-emp-sub">${s.position} · ฿${formatNum(s.daily_wage)}/วัน</div>
                            </div>
                        </div>
                        <div class="hr-status-row">
                            ${['มา','ครึ่งวัน','สาย','ขาด','ลา'].map(v => `
                                <button class="hr-btn-status ${st === v ? 'selected-' + getStatusColor(v) : ''}"
                                        onclick="saveAttStatus('${s.id}','${v}','${rec?.id || ''}')">
                                    ${getStatusEmoji(v)} ${v}
                                </button>
                            `).join('')}
                        </div>
                        ${rec ? `<div class="hr-att-note">✅ บันทึกแล้ว · ${st}${rec.deduction > 0 ? ' · หัก ฿'+formatNum(rec.deduction) : ''}</div>` : ''}
                    </div>`;
                }).join('') : '<p style="text-align:center;color:var(--text-3);padding:40px;">ไม่มีข้อมูลพนักงาน</p>'}
            </div>
        </div>
    `;
}

function getStatusColor(v) {
    return {มา:'green', ครึ่งวัน:'blue', สาย:'orange', ขาด:'red', ลา:'purple'}[v] || 'gray';
}
function getStatusEmoji(v) {
    return {มา:'✅', ครึ่งวัน:'🌓', สาย:'⏰', ขาด:'❌', ลา:'🏖️'}[v] || '';
}

// [FIX BUG-08] — saveAttStatus() hardcode deduction
window.saveAttStatus = async (empId, status, existingId) => {
    const date = document.getElementById('att-date')?.value || new Date().toISOString().split('T')[0];
    const { data: emp } = await db.from('พนักงาน').select('daily_wage').eq('id', empId).single();
    const wage = emp?.daily_wage || 0;
    
    const deduction = status === 'สาย'     ? Math.round(wage * 0.1)   // หัก 10%
                    : status === 'ขาด'     ? wage                      // หัก 1 วัน
                    : status === 'ครึ่งวัน' ? Math.round(wage * 0.5)   // หัก 50%
                    : 0;

    let error;
    if (existingId) {
        ({ error } = await db.from('เช็คชื่อ').update({ status, deduction }).eq('id', existingId));
    } else {
        ({ error } = await db.from('เช็คชื่อ').insert({
            employee_id: empId,
            date,
            status,
            deduction,
            staff_name: USER.username
        }));
    }

    if (error) toast(error.message, 'error');
    else { toast(`บันทึก "${status}" เรียบร้อย`); loadHRAttendance(); }
};

// ══════════════════════════════
// TAB 2 — เบิกเงินล่วงหน้า
// ══════════════════════════════
// [FIX NEW-BUG-05] — ลบ loadAdvanceLuxury() dead code ออก
// async function loadAdvanceLuxury() { return loadHR('advance'); }

async function loadHRAdvance() {
    const page = document.getElementById('page-att');
    const { data: staff } = await db.from('พนักงาน').select('*').eq('status','ทำงาน').order('name');

    // ยอดเบิกค้างรวม
    const { data: advances } = await db.from('เบิกเงิน').select('amount, status').eq('status','อนุมัติ');
    const totalAdv = advances?.reduce((s,r) => s + r.amount, 0) || 0;

    page.innerHTML = renderHRTabs('advance') + `
        <div class="hr-date-bar">
            <div class="hr-stat-pill">👥 พนักงาน ${staff?.length || 0} คน</div>
            <div class="hr-stat-pill orange">💸 เบิกค้าง ฿${formatNum(totalAdv)}</div>
        </div>
        <div class="hr-card animate-up" style="max-width:700px;margin:0 auto;">
            <div class="hr-card-header orange">
                <div>
                    <div class="hr-label-sm">ADVANCE</div>
                    <div class="hr-label-lg">แจ้งเบิกเงินพนักงาน</div>
                </div>
                <i class="material-icons-round" style="font-size:32px;opacity:0.5;">account_balance_wallet</i>
            </div>
            <div class="hr-card-body">
                <div class="hr-step"><div class="hr-step-num">1</div><div>เลือกพนักงาน</div></div>
                <select id="adv-staff" class="glass-input" style="width:100%;height:52px;font-size:16px;margin-bottom:24px;padding:0 15px;">
                    <option value="">— เลือกพนักงาน —</option>
                    ${staff?.map(s => `<option value="${s.id}">${s.name} ${s.lastname||''}</option>`).join('')}
                </select>

                <div class="hr-step"><div class="hr-step-num">2</div><div>ยอดเบิก</div></div>
                <div class="hr-amount-wrap">
                    <span class="hr-currency">฿</span>
                    <input type="number" id="adv-amount" class="hr-amount-input" value="0" onfocus="this.value=''">
                    <span class="hr-unit">บาท</span>
                </div>

                <div class="hr-step"><div class="hr-step-num">3</div><div>วิธีรับเงิน</div></div>
                <div class="hr-radio-grid">
                    <div class="hr-radio-btn active" onclick="setChoice('adv-method','เงินสด',this)">
                        <i class="material-icons-round" style="color:#4CAF50;">payments</i> เงินสด
                    </div>
                    <div class="hr-radio-btn" onclick="setChoice('adv-method','โอนเงิน',this)">
                        <i class="material-icons-round" style="color:#2196F3;">account_balance</i> โอนเงิน
                    </div>
                </div>
                <input type="hidden" id="adv-method" value="เงินสด">

                <button class="btn btn-red" style="width:100%;margin-top:32px;height:60px;font-size:17px;border-radius:16px;"
                        onclick="saveHRAdvance()">
                    <i class="material-icons-round">save</i> ยืนยันการเบิกเงิน
                </button>
            </div>
        </div>
    `;
}

window.saveHRAdvance = async () => {
    const sid  = document.getElementById('adv-staff').value;
    const amt  = parseFloat(document.getElementById('adv-amount').value);
    const meth = document.getElementById('adv-method').value;
    if (!sid || !amt || amt <= 0) return Swal.fire('ข้อมูลไม่ครบ','กรุณาเลือกพนักงานและระบุยอดเบิก','warning');

    const { data: emp } = await db.from('พนักงาน').select('name').eq('id', sid).single();
    const { error } = await db.from('เบิกเงิน').insert({
        employee_id: sid,
        amount: amt,
        reason: `เบิกเงินล่วงหน้า (${meth})`,
        approved_by: USER.username,
        status: 'อนุมัติ'
    });

    if (error) return Swal.fire('Error', error.message, 'error');

    // บันทึกเป็นรายจ่ายด้วย
    await db.from('รายจ่าย').insert({
        description: `เบิกเงินล่วงหน้า: ${emp?.name || ''}`,
        amount: amt,
        method: meth,
        category: 'เงินเดือน/เบิก',
        staff_name: USER.username
    });

    Swal.fire('สำเร็จ', `บันทึกการเบิกเงิน ฿${formatNum(amt)} ให้ ${emp?.name} เรียบร้อย`, 'success');
    updateGlobalBalance();
    loadHRAdvance();
};

// ══════════════════════════════
// TAB 3 — จ่ายเงินเดือน / รายงาน
// ══════════════════════════════
async function loadHRPayroll() {
    const page = document.getElementById('page-att');
    const now = new Date();
    const savedMonth = document.getElementById('pr-month')?.value;
    const monthVal   = savedMonth || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const [yr, mo]   = monthVal.split('-');
    const monthStart = `${yr}-${mo}-01`;
    const monthEnd   = `${yr}-${mo}-${String(new Date(parseInt(yr), parseInt(mo), 0).getDate()).padStart(2,'0')}`;

    const [
        { data: staff },
        { data: attMonth },   // เช็คชื่อเดือนนี้ (สำหรับ card stats + progress)
        { data: attAll },     // เช็คชื่อทั้งหมดทุกเดือน (สำหรับยอดสะสมคงค้าง)
        { data: advPending }, // เบิกที่ยังค้างอยู่ (status=อนุมัติ ยังไม่ถูกหักออก)
        { data: paidAll },    // ประวัติการจ่ายเงินเดือนทั้งหมด
        { data: paidMonth },  // การจ่ายเดือนนี้ (ตรวจ isPaid badge)
    ] = await Promise.all([
        db.from('พนักงาน').select('*').eq('status','ทำงาน').order('name'),
        db.from('เช็คชื่อ').select('*').gte('date', monthStart).lte('date', monthEnd),
        db.from('เช็คชื่อ').select('*').order('date'),
        db.from('เบิกเงิน').select('*').eq('status','อนุมัติ'),
        db.from('จ่ายเงินเดือน').select('*').order('paid_at'),
        db.from('จ่ายเงินเดือน').select('*').eq('month', `${yr}-${mo}-01`),
    ]);

    // ── Helper: คำนวณยอดสะสมคงค้างทั้งหมดของพนักงานคนหนึ่ง ──
    // = ยอดที่ทำงานทุกวัน (จาก เช็คชื่อ ทั้งหมด) − จ่ายไปแล้วทั้งหมด − เบิกค้าง
    function calcOutstanding(emp) {
        const empAttAll  = attAll?.filter(a => a.employee_id === emp.id) || [];
        const empPaidAll = paidAll?.filter(p => p.employee_id === emp.id) || [];
        const empAdv     = advPending?.filter(a => a.employee_id === emp.id).reduce((s,r) => s+r.amount, 0) || 0;

        // คำนวณยอดสะสมรายได้ทุกวัน
        let totalEarned = 0;
        if (emp.pay_type === 'รายวัน') {
            empAttAll.forEach(a => {
                if (a.status === 'มา')      totalEarned += emp.daily_wage;
                if (a.status === 'ครึ่งวัน') totalEarned += emp.daily_wage * 0.5;
                if (a.status === 'สาย')     totalEarned += emp.daily_wage * 0.9; // หัก 10%
                // ขาด/ลา = ไม่ได้รับ
                totalEarned -= (a.deduction || 0);
            });
        } else {
            // รายเดือน: นับเดือนที่มีการบันทึกเช็คชื่อ
            const months = [...new Set(empAttAll.map(a => a.date?.substring(0, 7)))];
            totalEarned = months.length * (emp.salary || 0);
            totalEarned -= empAttAll.reduce((s,a) => s + (a.deduction||0), 0);
        }

        // หักยอดที่จ่ายไปแล้วทั้งหมด
        const totalPaidEmp = empPaidAll.reduce((s,p) => s + (p.net_paid||0), 0);

        // ยอดคงค้าง = รายได้สะสม − จ่ายแล้ว − เบิกค้าง
        return Math.max(0, Math.round(totalEarned) - totalPaidEmp - empAdv);
    }

    // ── คำนวณ stats เดือนนี้ (สำหรับ card) ──
    function calcMonthStats(emp) {
        const empAtt = attMonth?.filter(a => a.employee_id === emp.id) || [];
        const wDays  = empAtt.filter(a => a.status==='มา').length;
        const hDays  = empAtt.filter(a => a.status==='ครึ่งวัน').length;
        const lDays  = empAtt.filter(a => a.status==='สาย').length;
        const absDays= empAtt.filter(a => a.status==='ขาด').length;
        const effDays= wDays + (hDays * 0.5);
        const deduct = empAtt.reduce((s,r) => s+(r.deduction||0), 0);
        const base   = emp.pay_type === 'รายวัน' ? Math.round(effDays * emp.daily_wage) : emp.salary;
        return { wDays, hDays, lDays, absDays, effDays, deduct, base };
    }

    // ── KPI รวม ──
    const totalStaff   = staff?.length || 0;
    const totalAdvance = advPending?.reduce((s,r) => s+r.amount, 0) || 0;
    const totalPaidMonth = paidMonth?.reduce((s,r) => s+(r.net_paid||0), 0) || 0;
    let totalOutstanding = 0;
    staff?.forEach(emp => { totalOutstanding += calcOutstanding(emp); });

    // ── Staff Cards ──
    const staffCards = staff?.map(emp => {
        const { wDays, lDays, absDays, effDays, base } = calcMonthStats(emp);
        const empAdv = advPending?.filter(a => a.employee_id === emp.id).reduce((s,r) => s+r.amount, 0) || 0;
        const outstanding = calcOutstanding(emp);
        const isPaid = paidMonth?.some(p => p.employee_id === emp.id);
        const pct    = Math.min(100, Math.round((effDays / 26) * 100));
        const hasDebt = outstanding > 0;

        return `
        <div class="pr-staff-card ${isPaid ? 'pr-paid' : ''}" onclick="selectPayrollStaff('${emp.id}')">
            <div class="pr-card-top">
                <div class="pr-avatar">${emp.name.charAt(0)}</div>
                <div class="pr-card-info">
                    <div class="pr-card-name">${emp.name} ${emp.lastname||''}</div>
                    <div class="pr-card-sub">${emp.position} · ฿${formatNum(emp.daily_wage)}/วัน</div>
                </div>
                <div class="pr-card-badge ${isPaid ? 'badge-green' : 'badge-amber'}">${isPaid ? '✅ จ่ายแล้ว' : '⏳ รอจ่าย'}</div>
            </div>
            <div class="pr-card-stats">
                <div class="pr-mini-stat"><span class="lbl">มาเดือนนี้</span><span class="val green">${wDays} วัน</span></div>
                <div class="pr-mini-stat"><span class="lbl">สาย</span><span class="val orange">${lDays}</span></div>
                <div class="pr-mini-stat"><span class="lbl">ขาด</span><span class="val red">${absDays}</span></div>
                <div class="pr-mini-stat"><span class="lbl">เบิกค้าง</span><span class="val purple">฿${formatNum(empAdv)}</span></div>
            </div>
            <div class="pr-progress-wrap">
                <div class="pr-progress-bar"><div class="pr-progress-fill ${isPaid?'fill-green':'fill-red'}" style="width:${pct}%"></div></div>
                <div class="pr-progress-label">${effDays} วัน (${pct}%)</div>
            </div>
            <!-- ยอดเดือนนี้ -->
            <div class="pr-card-net" style="border-top:1px solid var(--glass-border);padding-top:8px;margin-top:4px;">
                <span style="font-size:12px;color:var(--text-3);">เดือนนี้</span>
                <span style="font-size:14px;font-weight:700;">฿${formatNum(base)}</span>
            </div>
            <!-- ยอดสะสมคงค้างทั้งหมด — ส่วนสำคัญ -->
            <div class="pr-card-net" style="background:${hasDebt?'rgba(229,57,53,0.08)':'rgba(67,160,71,0.08)'};
                 border-radius:8px;padding:10px 12px;margin-top:6px;border:1px solid ${hasDebt?'rgba(229,57,53,0.25)':'rgba(67,160,71,0.25)'};">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:13px;font-weight:800;color:${hasDebt?'var(--red-neon)':'var(--green-neon)'};">
                        💰 ยอดสะสมคงค้าง
                    </span>
                    <span style="font-size:20px;font-weight:900;color:${hasDebt?'var(--red-neon)':'var(--green-neon)'};">
                        ฿${formatNum(outstanding)}
                    </span>
                </div>
                ${hasDebt ? '<div style="font-size:11px;color:var(--text-3);margin-top:3px;">รวมทุกเดือนที่ยังไม่ได้รับ − ยอดที่จ่ายแล้ว − เบิกค้าง</div>' 
                          : '<div style="font-size:11px;color:var(--green-neon);opacity:0.7;margin-top:3px;">ไม่มียอดค้าง</div>'}
            </div>
        </div>`;
    }).join('') || '<div style="text-align:center;color:var(--text-3);padding:60px;">ไม่มีข้อมูลพนักงาน</div>';

    page.innerHTML = renderHRTabs('payroll') + `
        <div class="pr-header-row">
            <div>
                <div style="font-size:13px;color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:1px;">รายงานเงินเดือน</div>
                <input type="month" id="pr-month" class="glass-input"
                       value="${monthVal}" onchange="loadHRPayroll()"
                       style="margin-top:8px;width:180px;height:40px;padding:0 12px;font-size:15px;font-weight:700;">
            </div>
            <div style="font-size:12px;color:var(--text-3);margin-top:12px;">
                💡 ยอดสะสมคงค้าง = รายได้รวมทุกวันที่บันทึกเช็คชื่อ − จ่ายแล้วทุกเดือน − เบิกค้าง
            </div>
        </div>

        <div class="pr-kpi-row">
            <div class="pr-kpi blue">
                <i class="material-icons-round">groups</i>
                <div class="pr-kpi-val">${totalStaff}</div>
                <div class="pr-kpi-lbl">พนักงานทั้งหมด</div>
            </div>
            <div class="pr-kpi red" style="--kpi-color:var(--red-neon);">
                <i class="material-icons-round">warning_amber</i>
                <div class="pr-kpi-val" style="color:var(--red-neon);">฿${formatNum(totalOutstanding)}</div>
                <div class="pr-kpi-lbl">ยอดสะสมคงค้างรวม</div>
            </div>
            <div class="pr-kpi teal">
                <i class="material-icons-round">check_circle</i>
                <div class="pr-kpi-val">฿${formatNum(totalPaidMonth)}</div>
                <div class="pr-kpi-lbl">จ่ายแล้วเดือนนี้</div>
            </div>
            <div class="pr-kpi orange">
                <i class="material-icons-round">account_balance_wallet</i>
                <div class="pr-kpi-val">฿${formatNum(totalAdvance)}</div>
                <div class="pr-kpi-lbl">เบิกล่วงหน้าค้าง</div>
            </div>
        </div>

        <div class="pr-staff-grid">
            ${staffCards}
        </div>

        <div id="payroll-detail"></div>
    `;
}

window.selectPayrollStaff = function(sid) {
    // scroll to detail
    document.getElementById('payroll-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    // set hidden select and trigger
    let sel = document.getElementById('pr-staff-hidden');
    if (!sel) {
        sel = document.createElement('input');
        sel.type = 'hidden';
        sel.id = 'pr-staff-hidden';
        document.body.appendChild(sel);
    }
    sel.value = sid;
    // reuse renderPayrollDetail by injecting value
    const fake = { value: sid };
    renderPayrollDetailById(sid);
};

window.renderPayrollDetail = async () => {
    const sid = document.getElementById('pr-staff')?.value;
    if (sid) renderPayrollDetailById(sid);
};

async function renderPayrollDetailById(sid) {
    const monthVal  = document.getElementById('pr-month').value;
    const [yr, mo]  = monthVal.split('-');
    const monthStart = `${yr}-${mo}-01`;
    const _lastDay   = new Date(parseInt(yr), parseInt(mo), 0);
    const monthEnd   = `${yr}-${mo}-${String(_lastDay.getDate()).padStart(2,'0')}`;

    const { data: emp }     = await db.from('พนักงาน').select('*').eq('id', sid).single();
    const { data: attMonth} = await db.from('เช็คชื่อ').select('*').eq('employee_id', sid).gte('date', monthStart).lte('date', monthEnd);
    const { data: attAll }  = await db.from('เช็คชื่อ').select('*').eq('employee_id', sid).order('date');
    const { data: adv }     = await db.from('เบิกเงิน').select('*').eq('employee_id', sid).eq('status','อนุมัติ');
    const { data: paidHistory } = await db.from('จ่ายเงินเดือน').select('*').eq('employee_id', sid).order('paid_date', {ascending:false});

    // สถิติเดือนนี้
    const workDays   = attMonth?.filter(a => a.status==='มา').length || 0;
    const halfDays   = attMonth?.filter(a => a.status==='ครึ่งวัน').length || 0;
    const lateDays   = attMonth?.filter(a => a.status==='สาย').length || 0;
    const absentDays = attMonth?.filter(a => a.status==='ขาด').length || 0;
    const deductMonth = attMonth?.reduce((s,r) => s+(r.deduction||0), 0) || 0;
    const effDays    = workDays + (halfDays * 0.5);
    const baseSalary = emp.pay_type === 'รายวัน' ? Math.round(effDays * emp.daily_wage) : (emp.salary || 0);
    const pct        = Math.min(100, Math.round((effDays / 26) * 100));

    // หนี้เบิกค้าง (ทุกเดือน ยังไม่หักออก)
    const totalAdv   = adv?.reduce((s,r) => s+r.amount, 0) || 0;

    // ยอดสะสมคงค้าง (ทุกวันที่ทำงาน − จ่ายแล้วทั้งหมด − เบิกค้าง)
    let totalEarned = 0;
    if (emp.pay_type === 'รายวัน') {
        (attAll||[]).forEach(a => {
            if (a.status==='มา')       totalEarned += emp.daily_wage;
            if (a.status==='ครึ่งวัน') totalEarned += emp.daily_wage * 0.5;
            if (a.status==='สาย')      totalEarned += emp.daily_wage * 0.9;
            totalEarned -= (a.deduction||0);
        });
    } else {
        const months = [...new Set((attAll||[]).map(a => a.date?.substring(0,7)))];
        totalEarned = months.length * (emp.salary||0);
        totalEarned -= (attAll||[]).reduce((s,a) => s+(a.deduction||0), 0);
    }
    const totalPaidAll   = (paidHistory||[]).reduce((s,p) => s+(p.net_paid||0), 0);
    const outstanding    = Math.max(0, Math.round(totalEarned) - totalPaidAll - totalAdv);
    const netPay         = Math.max(0, outstanding); // default = ยอดคงค้าง

    const lastPaidRecord = paidHistory?.[0];
    const lastPaidDate   = lastPaidRecord?.paid_date ? formatDate(lastPaidRecord.paid_date) : null;
    const isPaidThisMonth = paidHistory?.some(p => p.month === `${yr}-${mo}-01`);

    const detailEl = document.getElementById('payroll-detail');
    detailEl.innerHTML = `
        <div class="pr-detail-card animate-up" style="
            background:var(--bg-card);border:1px solid var(--glass-border);
            border-radius:20px;padding:20px;margin-top:20px;max-width:620px;">

            <!-- ── Header ── -->
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                <div style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,var(--red),#B71C1C);
                            display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff;flex-shrink:0;">
                    ${emp.name.charAt(0)}
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:17px;font-weight:800;color:var(--text-1);">${emp.name} ${emp.lastname||''}</div>
                    <div style="font-size:13px;color:var(--text-3);margin-top:2px;">฿${formatNum(emp.daily_wage)}/วัน · มา ${effDays} วัน</div>
                </div>
                <div style="background:${isPaidThisMonth?'rgba(67,160,71,0.15)':'rgba(255,179,0,0.15)'};
                            border:1px solid ${isPaidThisMonth?'rgba(67,160,71,0.4)':'rgba(255,179,0,0.4)'};
                            border-radius:20px;padding:5px 14px;font-size:12px;font-weight:800;
                            color:${isPaidThisMonth?'var(--green-neon)':'#FFB300'};">
                    ${isPaidThisMonth ? '✅ จ่ายแล้ว' : '⏳ รอจ่าย'}
                </div>
            </div>

            <!-- ── Last Paid ── -->
            ${lastPaidDate ? `
            <div style="background:rgba(66,165,245,0.08);border:1px solid rgba(66,165,245,0.2);
                        border-radius:10px;padding:10px 14px;margin-bottom:12px;
                        display:flex;align-items:center;gap:10px;">
                <i class="material-icons-round" style="color:#42A5F5;font-size:20px;">event</i>
                <div>
                    <div style="font-size:11px;color:var(--text-3);font-weight:700;">จ่ายเงินเดือนล่าสุด</div>
                    <div style="font-size:16px;font-weight:800;color:#42A5F5;">${lastPaidDate}</div>
                </div>
            </div>` : ''}

            <!-- ── Outstanding Balance ── -->
            <div style="background:rgba(229,57,53,0.08);border:1px solid rgba(229,57,53,0.25);
                        border-radius:12px;padding:14px 16px;margin-bottom:12px;">
                <div style="font-size:11px;color:var(--text-3);font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
                    💰 ยอดคงเหลือที่ต้องจ่าย
                </div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:8px;">
                    เงินเดือนสะสม − ค่าปรับ − ที่จ่ายไปแล้ว
                </div>
                <div style="font-size:32px;font-weight:900;color:var(--red-neon);">฿${formatNum(outstanding)}</div>
            </div>

            <!-- ── Stats Grid ── -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                <div style="background:var(--bg-deep);border:1px solid var(--glass-border);border-radius:10px;padding:12px 14px;">
                    <div style="font-size:11px;color:var(--text-3);font-weight:700;margin-bottom:4px;">
                        <i class="material-icons-round" style="font-size:14px;vertical-align:middle;">calendar_today</i>
                        วันทำงานสะสมประจำเดือน
                    </div>
                    <div style="font-size:24px;font-weight:900;color:var(--text-1);">${effDays} วัน</div>
                </div>
                <div style="background:var(--bg-deep);border:1px solid rgba(255,179,0,0.3);border-radius:10px;padding:12px 14px;">
                    <div style="font-size:11px;color:var(--text-3);font-weight:700;margin-bottom:4px;">
                        <i class="material-icons-round" style="font-size:14px;vertical-align:middle;color:#FFB300;">payments</i>
                        หนี้เบิกคงค้าง
                    </div>
                    <div style="font-size:24px;font-weight:900;color:#FFB300;">฿${formatNum(totalAdv)}</div>
                </div>
            </div>

            <!-- ── Progress Bar ── -->
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:6px;">
                    <span>สัดส่วนวันทำงาน</span><span>${pct}%</span>
                </div>
                <div style="background:var(--bg-deep);border-radius:6px;height:8px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--red),#FF5252);border-radius:6px;transition:width 0.5s;"></div>
                </div>
            </div>

            <!-- ── Payment Form ── -->
            <div style="background:var(--bg-deep);border:1px solid var(--glass-border);border-radius:14px;padding:16px;">
                <div style="font-size:13px;font-weight:800;color:var(--text-2);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px;">
                    💵 บันทึกการจ่ายเงิน
                </div>

                <!-- จ่ายครั้งนี้ -->
                <div style="margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <label style="font-size:13px;font-weight:700;color:var(--text-2);">จ่ายครั้งนี้</label>
                        <span style="font-size:12px;color:var(--text-3);">จ่ายได้สูงสุด ฿${formatNum(outstanding)}</span>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <input type="number" id="pr-pay-amt" value="${outstanding}"
                               style="flex:1;height:48px;font-size:18px;font-weight:800;text-align:right;
                                      padding:0 14px;background:var(--bg-card);border:1px solid var(--glass-border);
                                      border-radius:10px;color:var(--text-1);"
                               oninput="prCalcNet()">
                        <button style="padding:0 14px;background:rgba(67,160,71,0.15);border:1px solid rgba(67,160,71,0.3);
                                       border-radius:10px;color:var(--green-neon);font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;"
                                onclick="document.getElementById('pr-pay-amt').value=${outstanding};prCalcNet()">
                            จ่ายเต็ม
                        </button>
                    </div>
                </div>

                <!-- หักหนี้เบิกครั้งนี้ -->
                <div style="margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <label style="font-size:13px;font-weight:700;color:var(--text-2);">หักหนี้เบิกครั้งนี้</label>
                        <span style="font-size:12px;color:#FFB300;">เบิกค้าง ฿${formatNum(totalAdv)}</span>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <input type="number" id="pr-deduct-adv" value="0"
                               style="flex:1;height:48px;font-size:18px;font-weight:800;text-align:right;
                                      padding:0 14px;background:var(--bg-card);border:1px solid var(--glass-border);
                                      border-radius:10px;color:var(--text-1);"
                               oninput="prCalcNet()">
                        <button style="padding:0 14px;background:rgba(255,179,0,0.12);border:1px solid rgba(255,179,0,0.3);
                                       border-radius:10px;color:#FFB300;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;"
                                onclick="document.getElementById('pr-deduct-adv').value=${totalAdv};prCalcNet()">
                            หักทั้งหมด
                        </button>
                    </div>
                </div>

                <!-- พนักงานได้รับจริง -->
                <div style="background:rgba(67,160,71,0.1);border:1px solid rgba(67,160,71,0.25);
                            border-radius:12px;padding:14px 16px;margin-bottom:16px;
                            display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <i class="material-icons-round" style="color:var(--green-neon);">check_circle</i>
                        <span style="font-size:14px;font-weight:700;color:var(--text-2);">พนักงานได้รับจริง</span>
                    </div>
                    <div id="pr-net-display" style="font-size:28px;font-weight:900;color:var(--green-neon);">฿${formatNum(outstanding)}</div>
                </div>

                <!-- ปุ่มจ่ายเงิน -->
                <button onclick="savePayroll('${sid}','${emp.name} ${emp.lastname||''}')"
                        style="width:100%;height:56px;background:linear-gradient(135deg,#2E7D32,#43A047);
                               border:none;border-radius:14px;color:#fff;font-size:17px;font-weight:800;
                               cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;
                               box-shadow:0 4px 20px rgba(67,160,71,0.3);">
                    <i class="material-icons-round">payments</i>
                    จ่ายเงินให้ ${emp.name} ${emp.lastname||''}
                </button>
            </div>
        </div>
    `;

    ['pr-pay-amt','pr-deduct-adv'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', prCalcNet);
    });
};

window.prCalcNet = function() {
    const pay = parseFloat(document.getElementById('pr-pay-amt')?.value) || 0;
    const ded = parseFloat(document.getElementById('pr-deduct-adv')?.value) || 0;
    const net = Math.max(0, pay - ded);
    const el = document.getElementById('pr-net-display');
    if (el) el.textContent = `฿${formatNum(net)}`;
};



window.savePayroll = async (sid, empName) => {
    const payAmt  = parseFloat(document.getElementById('pr-pay-amt').value) || 0;
    const dedAdv  = parseFloat(document.getElementById('pr-deduct-adv').value) || 0;
    const netPaid = Math.max(0, payAmt - dedAdv);

    if (payAmt <= 0) return toast('กรุณาระบุยอดจ่าย', 'error');

    const monthVal = document.getElementById('pr-month').value;
    const [yr, mo] = monthVal.split('-');

    const { error } = await db.from('จ่ายเงินเดือน').upsert({
        employee_id:     sid,
        month:           `${yr}-${mo}-01`,
        base_salary:     payAmt,
        deduct_withdraw: dedAdv,
        net_paid:        netPaid,
        staff_name:      USER.username
    }, { onConflict: 'employee_id,month' });

    if (error) return Swal.fire('Error', error.message, 'error');

    // บันทึกรายจ่าย
    await db.from('รายจ่าย').insert({
        description: `จ่ายเงินเดือน: ${empName}`,
        amount:      netPaid,
        method:      'เงินสด',
        category:    'เงินเดือน/เบิก',
        staff_name:  USER.username
    });

    Swal.fire('✅ จ่ายเงินสำเร็จ', `จ่ายให้ ${empName} ฿${formatNum(netPaid)} เรียบร้อย`, 'success');
    logAct('จ่ายเงินเดือน', `จ่ายให้ ${empName} ฿${formatNum(netPaid)}`);
    updateGlobalBalance();
    loadHRPayroll().then(() => renderPayrollDetailById(sid));
};

// [FIX NEW-BUG-04] — ลบ updateAttStatus() ghost function ออก
/* 
window.updateAttStatus = async (sid, status) => { ... } 
*/

// 6. GLOBAL LOGGING & MODAL HELPERS
async function logAct(type, detail, refId = null, refTable = null) {
    if (!USER) return; // Prevent logging if not logged in
    try {
        await db.from('log_กิจกรรม').insert({
            username: USER.username,
            type: type,
            details: detail,
            ref_id: refId,
            ref_table: refTable
        });
    } catch(e) { console.error("Log failed", e); }
}

function openModal(title, contentHtml, wide = false) {
    UI.modalTitle.innerText = title;
    UI.modalBody.innerHTML = contentHtml;
    const mc = UI.modalOverlay.querySelector('.modal-content');
    if (mc) mc.classList.toggle('modal-wide', wide);
    UI.modalOverlay.classList.add('open');
}

function closeModal() {
    UI.modalOverlay.classList.remove('open');
}

UI.closeModal.onclick = closeModal;
UI.modalOverlay.onclick = (e) => { if (e.target === UI.modalOverlay) closeModal(); };

document.getElementById('logout-btn').onclick = () => {
    Swal.fire({
        title: 'ยืนยันการออกจากระบบ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--red)',
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            location.reload(); 
        }
    });
};

async function updateGlobalBalance() {
    try {
        const { data: bal } = await db.rpc('get_current_cash_balance');
        const formatted = `฿${formatNum(bal || 0)}`;
        
        // Update Sidebar
        const globalEl = document.getElementById('global-cash-balance');
        if (globalEl) globalEl.innerText = formatted;
        
        // Update POS page if active
        const posEl = document.getElementById('pos-cash-balance');
        if (posEl) posEl.innerText = formatted;
    } catch (e) {
        console.error("Balance update failed", e);
    }
}

/* --- END BASE SKELETON --- */

// 7. POS LOGIC
// [UX-01] — เพิ่ม Loading Skeleton ในกริดสินค้า POS
async function loadPOS() {
    // ปุ่มเปิดจอแสดงผลลูกค้า
    UI.pageActions.innerHTML = `
        <button class="btn btn-white" onclick="openCustomerDisplay()" title="เปิดจอแสดงผลลูกค้า"
            style="padding:0 14px;height:44px;gap:6px;border-radius:22px;">
            <i class="material-icons-round" style="font-size:18px;">tv</i>
            <span style="font-size:13px;font-weight:700;">จอลูกค้า</span>
        </button>
    `;
    // แสดง skeleton ก่อน
    const grid = document.getElementById('pos-product-grid');
    grid.innerHTML = Array(8).fill(0).map(() => `
        <div class="prod-card skeleton-card" style="
            background: var(--glass-md);
            border-radius: var(--r-md);
            height: 160px;
            animation: skeleton-pulse 1.5s ease-in-out infinite;
        "></div>
    `).join('');

    // Load Categories
    const { data: cats } = await db.from('categories').select('*');
    categories = cats || [];
    renderPOSCategories();
    
    // Load Products
    await refreshProducts();
    renderProductGrid();
}

function renderPOSCategories() {
    const container = document.getElementById('pos-cat-chips');
    container.innerHTML = `
        <div class="chip ${activeCategory === 'ทั้งหมด' ? 'active' : ''}" onclick="filterPOSCat('ทั้งหมด')">ทั้งหมด</div>
        <button class="btn btn-white" onclick="openBarcodeScanner()" style="padding: 4px 10px; font-size: 12px; margin-left: auto;">
            <i class="material-icons-round" style="font-size:16px;">qr_code_scanner</i> แสกน
        </button>
    `;
    categories.forEach(cat => {
        container.innerHTML += `<div class="chip ${activeCategory === cat.name ? 'active' : ''}" onclick="filterPOSCat('${cat.name}')">${cat.name}</div>`;
    });
}

function filterPOSCat(cat) {
    activeCategory = cat;
    renderPOSCategories();
    renderProductGrid();
}

async function refreshProducts() {
    const { data } = await db.from('สินค้า').select('*').order('name');
    products = data || [];
}

function renderProductGrid() {
    const search = document.getElementById('pos-search').value.toLowerCase();
    const grid = document.getElementById('pos-product-grid');
    if (!products) { // Assuming 'products' is a global variable that might be null/undefined before loading
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:50px; color:var(--text-4);">
                <div class="loader-pos"></div>
                <p style="margin-top:20px;">กำลังโหลดสินค้า...</p>
            </div>
        `;
        return;
    }
    grid.innerHTML = '';
    
    const filtered = products.filter(p => {
        const matchCat = activeCategory === 'ทั้งหมด' || p.category === activeCategory;
        const matchSearch = p.name.toLowerCase().includes(search) || (p.barcode && p.barcode.includes(search));
        return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:50px; color:var(--text-4);"><i class="material-icons-round" style="font-size:48px;">search_off</i><p>ไม่พบสินค้าที่ค้นหา</p></div>';
        return;
    }
    
    filtered.forEach(p => {
        const outOfStock = p.stock <= 0;
        // [UX-09] — แสดง Low Stock Warning บนสินค้าที่ใกล้หมด
        const lowStock = p.stock > 0 && p.stock <= p.min_stock;
        
        const card = document.createElement('div');
        card.className = `prod-card ${outOfStock ? 'out-of-stock' : ''}`;
        card.innerHTML = `
            <div class="prod-img" style="position:relative;">
                ${p.img_url ? `<img src="${p.img_url}" onerror="this.src=''; this.parentElement.innerHTML='📦'">` : '📦'}
                ${lowStock ? `<div style="position:absolute;top:4px;right:4px;background:#FF6F00;color:white;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;">เหลือ ${p.stock}</div>` : ''}
                ${outOfStock ? '<div class="out-of-stock-overlay"></div>' : ''}
            </div>
            <div class="prod-info">
                <div class="prod-name">${p.name}</div>
                <div class="prod-price">฿${formatNum(p.price)}</div>
            </div>
        `;
        card.onclick = () => !outOfStock && addToCart(p);
        grid.appendChild(card);
    });
}

document.getElementById('pos-search').oninput = renderProductGrid;

function addToCart(p) {
    const existing = cart.find(item => item.id === p.id);
    if (existing) {
        if (existing.qty < p.stock) existing.qty++;
        else return toast('สินค้าในสต็อกไม่เพียงพอ', 'error');
    } else {
        cart.push({ ...p, qty: 1 });
    }
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cart-list');
    const totalEl = document.getElementById('pos-total-amount');
    const checkoutBtn = document.getElementById('checkout-btn');
    
    if (cart.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; color: #999; margin-top: 50px;">
                <i class="material-icons-round" style="font-size: 48px;">shopping_basket</i>
                <p>ไม่มีสินค้าในตะกร้า</p>
            </div>
        `;
        totalEl.innerText = '฿0';
        checkoutBtn.disabled = true;
        return;
    }
    
    list.innerHTML = '';
    let subtotal = 0;
    
    cart.forEach((item, idx) => {
        subtotal += item.price * item.qty;
        const row = document.createElement('div');
        row.className = 'cart-item';
        // [UX-03] — ปุ่ม − ใน Cart ควรมีสีต่างจาก +
        // [UX-07] — เพิ่มปุ่มลบ (×) แต่ละรายการใน Cart โดยตรง
        row.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">฿${formatNum(item.price)} / ${item.unit}</div>
            </div>
            <div class="cart-qty-ctrl">
                <div class="qty-btn qty-btn-minus" onclick="updateQty(${idx}, -1)">−</div>
                <span class="font-bold">${item.qty}</span>
                <div class="qty-btn qty-btn-plus"  onclick="updateQty(${idx}, 1)">+</div>
            </div>
            <div class="cart-item-total">฿${formatNum(item.price * item.qty)}</div>
            <div class="cart-item-remove" onclick="removeCartItem(${idx})" title="ลบรายการ"
                 style="cursor:pointer; color:var(--red-neon); padding:4px 8px; font-size:18px; opacity:0.6;"
                 onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">×</div>
        `;
        list.appendChild(row);
    });
    
    const discount = parseInt(document.getElementById('pos-discount').value) || 0;
    const finalTotal = Math.max(0, subtotal - discount);
    totalEl.innerText = `฿${formatNum(finalTotal)}`;
    checkoutBtn.disabled = false;

    // [UX-NEW-03] — เมื่อตะกร้าว่าง คง kbd และ badge ไว้
    // [V5-UX-01] — ใช้ .cart-badge class แทน inline style
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    if (totalQty > 0) {
        checkoutBtn.innerHTML = `ชำระเงิน <span class="cart-badge">${totalQty}</span><kbd>F10</kbd>`;
    } else {
        checkoutBtn.innerHTML = `ชำระเงิน <kbd>F10</kbd>`;
    }

    // อัปเดตจอลูกค้า
    updateCustomerDisplay('cart');
}

function updateQty(idx, delta) {
    const item = cart[idx];
    if (!item) return;
    const prod = products.find(p => p.id === item.id);
    
    if (delta > 0 && (!prod || item.qty >= prod.stock)) {
        return toast('สินค้าในสต็อกไม่เพียงพอ', 'error');
    }
    
    item.qty += delta;
    if (item.qty <= 0) cart.splice(idx, 1);
    renderCart();
}

document.getElementById('pos-discount').oninput = renderCart;
// [UX-04] — ปุ่ม "ล้างตะกร้า" ต้องมี Confirm + Undo Toast
document.getElementById('clear-cart-btn').onclick = async () => {
    if (cart.length === 0) return;
    const { isConfirmed } = await Swal.fire({
        title: 'ล้างตะกร้า?',
        text: `มีสินค้า ${cart.length} รายการ ยืนยันล้างทั้งหมด?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--red)',
        confirmButtonText: 'ล้างเลย',
        cancelButtonText: 'ยกเลิก'
    });
    if (isConfirmed) {
        cart = [];
        renderCart();
        toast('ล้างตะกร้าเรียบร้อย');
    }
};

let isProcessingPayment = false;

// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// CUSTOMER DISPLAY — จอแสดงผลลูกค้า (second screen)
// ══════════════════════════════════════════════════════════════════
let customerDisplayWindow = null;

function openCustomerDisplay() {
    if (customerDisplayWindow && !customerDisplayWindow.closed) {
        customerDisplayWindow.focus();
        updateCustomerDisplay();
        return;
    }
    const w = 600, h = 700;
    const left = window.screen.width - w - 20;
    const top  = Math.round((window.screen.height - h) / 2);
    customerDisplayWindow = window.open('', 'SK_CUSTOMER_DISPLAY',
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`);
    if (!customerDisplayWindow) { toast('เปิดจอไม่ได้ — กรุณาอนุญาต popup', 'error'); return; }
    initCustomerDisplayContent();
    updateCustomerDisplay();
    toast('เปิดจอแสดงผลลูกค้าแล้ว', 'success');
}

function initCustomerDisplayContent() {
    const shopInfo = getShopInfo();
    const shopName = (shopInfo.name || 'SK POS');
    const year = new Date().getFullYear();

    // สร้าง HTML โดยตรง ไม่ใช้ doc.write เพื่อหลีกเลี่ยง SyntaxError
    const html = '<!DOCTYPE html><html lang="th"><head>'
      + '<meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>SK POS \u2014 Customer Display</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap" rel="stylesheet">'
      + '<style>'
      + ':root{--bg:#0A0A12;--bg2:#12121E;--bg3:#1A1A2E;--border:rgba(255,255,255,0.08);'
      + '--red:#E53935;--red-soft:rgba(229,57,53,0.15);--green:#43A047;'
      + '--gold:#FFB300;--text1:#F0F0F8;--text2:#A0A0C0;--text3:rgba(255,255,255,0.35);--r:12px;}'
      + '*{box-sizing:border-box;margin:0;padding:0}'
      + 'body{font-family:Sarabun,sans-serif;background:var(--bg);color:var(--text1);'
      + 'min-height:100vh;display:flex;flex-direction:column;overflow:hidden;font-size:15px;}'
      + '.hd{background:linear-gradient(135deg,#1A0A0A,#2D0909);border-bottom:1px solid var(--red);'
      + 'padding:14px 24px;display:flex;justify-content:space-between;align-items:center;}'
      + '.hd-logo{font-size:24px;font-weight:900;letter-spacing:3px;color:#FF5252;}'
      + '.hd-shop{font-size:13px;color:var(--text2);text-align:right;line-height:1.5;}'
      + '.hd-time{font-size:20px;font-weight:800;color:var(--text2);font-variant-numeric:tabular-nums;}'
      + '.body{flex:1;display:flex;flex-direction:column;padding:16px;gap:12px;overflow:hidden;}'
      + '.sc-welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;text-align:center;gap:16px;}'
      + '.sc-welcome-icon{font-size:72px;animation:pulse 2.5s ease-in-out infinite;}'
      + '.sc-welcome-title{font-size:32px;font-weight:900;}'
      + '.sc-welcome-sub{font-size:16px;color:var(--text2);}'
      + '.sc-cart{display:none;flex-direction:column;flex:1;gap:10px;overflow:hidden;}'
      + '.sc-customer{background:var(--red-soft);border:1px solid rgba(229,57,53,0.3);border-radius:var(--r);'
      + 'padding:10px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}'
      + '.sc-customer-name{font-size:16px;font-weight:800;color:#FF8A80;}'
      + '.sc-table-wrap{flex:1;overflow-y:auto;border-radius:var(--r);border:1px solid var(--border);background:var(--bg2);}'
      + '.sc-thead{display:grid;grid-template-columns:1fr 55px 70px 88px;padding:9px 14px;'
      + 'background:var(--bg3);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:1;}'
      + '.sc-thead span{font-size:11px;font-weight:800;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;}'
      + '.sc-thead span:nth-child(n+2){text-align:right;}'
      + '.sc-row{display:grid;grid-template-columns:1fr 55px 70px 88px;padding:11px 14px;'
      + 'border-bottom:1px solid var(--border);align-items:center;animation:row-in 0.25s ease;}'
      + '.sc-name{font-size:15px;font-weight:700;}.sc-unit{font-size:11px;color:var(--text2);margin-top:1px;}'
      + '.sc-qty{text-align:right;font-size:16px;font-weight:800;}'
      + '.sc-price{text-align:right;font-size:13px;color:var(--text2);}'
      + '.sc-subtotal{text-align:right;font-size:16px;font-weight:900;color:var(--gold);}'
      + '.sc-summary{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px 18px;flex-shrink:0;}'
      + '.sc-sum-row{display:flex;justify-content:space-between;font-size:14px;color:var(--text2);margin-bottom:7px;}'
      + '.sc-sum-row.disc{color:#FF8A80;}'
      + '.sc-total-row{display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--border);}'
      + '.sc-total-lbl{font-size:17px;font-weight:800;}'
      + '.sc-total-val{font-size:44px;font-weight:900;color:var(--green);line-height:1;text-shadow:0 0 20px rgba(67,160,71,0.4);}'
      + '.sc-qr{display:none;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:14px;text-align:center;}'
      + '.sc-qr-box{background:#fff;border-radius:16px;padding:14px;box-shadow:0 0 40px rgba(255,255,255,0.1);}'
      + '.sc-qr-title{font-size:22px;font-weight:900;}'
      + '.sc-qr-amount{font-size:48px;font-weight:900;color:var(--gold);line-height:1;text-shadow:0 0 20px rgba(255,179,0,0.4);}'
      + '.sc-qr-id{font-size:15px;color:var(--text2);}'
      + '.sc-qr-hint{font-size:13px;color:var(--text3);animation:pulse 2s ease-in-out infinite;}'
      + '.sc-paid{display:none;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:14px;text-align:center;}'
      + '.sc-paid-icon{font-size:80px;animation:pop 0.4s cubic-bezier(0.34,1.56,0.64,1);}'
      + '.sc-paid-label{font-size:20px;color:var(--text2);}'
      + '.sc-paid-amount{font-size:56px;font-weight:900;color:var(--green);line-height:1;}'
      + '.sc-paid-change{font-size:22px;font-weight:700;color:var(--gold);}'
      + '.sc-paid-thanks{font-size:22px;font-weight:800;}'
      + '.ft{padding:10px 24px;background:var(--bg2);border-top:1px solid var(--border);'
      + 'display:flex;justify-content:space-between;font-size:12px;color:var(--text3);}'
      + '@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}'
      + '@keyframes row-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}'
      + '@keyframes pop{0%{transform:scale(0.4)}60%{transform:scale(1.2)}100%{transform:scale(1)}}'
      + '</style></head><body>'
      + '<div class="hd">'
        + '<div class="hd-logo">SK POS</div>'
        + '<div class="hd-shop">' + shopName + '</div>'
        + '<div class="hd-time" id="cd-clock"></div>'
      + '</div>'
      + '<div class="body">'
        + '<div class="sc-welcome" id="sc-welcome">'
          + '<div class="sc-welcome-icon">\uD83D\uDED2</div>'
          + '<div class="sc-welcome-title">\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A</div>'
          + '<div class="sc-welcome-sub">' + shopName + ' \u2014 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E2B\u0E49\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23</div>'
        + '</div>'
        + '<div class="sc-cart" id="sc-cart">'
          + '<div class="sc-customer">'
            + '<span style="font-size:20px;">\uD83D\uDC64</span>'
            + '<div class="sc-customer-name" id="sc-cust-name">\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B</div>'
          + '</div>'
          + '<div class="sc-table-wrap">'
            + '<div class="sc-thead">'
              + '<span>\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</span>'
              + '<span>\u0E08\u0E33\u0E19\u0E27\u0E19</span>'
              + '<span>\u0E23\u0E32\u0E04\u0E32/\u0E2B\u0E19\u0E48\u0E27\u0E22</span>'
              + '<span>\u0E23\u0E27\u0E21</span>'
            + '</div>'
            + '<div id="sc-rows"></div>'
          + '</div>'
          + '<div class="sc-summary">'
            + '<div class="sc-sum-row"><span>\u0E08\u0E33\u0E19\u0E27\u0E19\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</span><span id="sc-count">\u2014</span></div>'
            + '<div class="sc-sum-row disc" id="sc-disc-row" style="display:none">'
              + '<span>\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14</span><span id="sc-disc-val">\u2014</span>'
            + '</div>'
            + '<div class="sc-total-row">'
              + '<div class="sc-total-lbl">\uD83D\uDCB0 \u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21</div>'
              + '<div class="sc-total-val" id="sc-total">\u0E3F0</div>'
            + '</div>'
          + '</div>'
        + '</div>'
        + '<div class="sc-qr" id="sc-qr">'
          + '<div class="sc-qr-title">\uD83D\uDCF2 \u0E2A\u0E41\u0E01\u0E19\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19</div>'
          + '<div class="sc-qr-box" id="sc-qr-box">'
            + '<div style="width:200px;height:200px;background:#eee;border-radius:8px;'
            + 'display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;">'
            + '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14 QR...</div>'
          + '</div>'
          + '<div class="sc-qr-amount" id="sc-qr-amount">\u0E3F0</div>'
          + '<div class="sc-qr-id" id="sc-qr-id"></div>'
          + '<div class="sc-qr-hint">\uD83D\uDCF1 \u0E40\u0E1B\u0E34\u0E14\u0E41\u0E2D\u0E1B\u0E18\u0E19\u0E32\u0E04\u0E32\u0E23 \u2192 \u0E2A\u0E41\u0E01\u0E19 QR Code</div>'
        + '</div>'
        + '<div class="sc-paid" id="sc-paid">'
          + '<div class="sc-paid-icon">\u2705</div>'
          + '<div class="sc-paid-label">\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08</div>'
          + '<div class="sc-paid-amount" id="sc-paid-amt">\u0E3F0</div>'
          + '<div class="sc-paid-change" id="sc-paid-change"></div>'
          + '<div class="sc-paid-thanks">\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23 \uD83D\uDE4F</div>'
        + '</div>'
      + '</div>'
      + '<div class="ft">'
        + '<span>SK POS \u2014 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32</span>'
        + '<span>\u00A9 ' + year + '</span>'
      + '</div>'
      + '<script>'
      + '(function(){'
      + 'function fmt(n){return Number(n).toLocaleString("th-TH");}'
      + 'setInterval(function(){'
        + 'var e=document.getElementById("cd-clock");'
        + 'if(e)e.textContent=new Date().toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"});'
      + '},1000);'
      + 'function showOnly(id){'
        + '["sc-welcome","sc-cart","sc-qr","sc-paid"].forEach(function(s){'
          + 'var e=document.getElementById(s);'
          + 'if(e)e.style.display=(s===id)?"flex":"none";'
        + '});'
      + '}'
      + 'window.updateDisplay=function(d){'
        + 'if(d.state==="idle"){'
          + 'showOnly("sc-welcome");'
        + '}else if(d.state==="cart"){'
          + 'showOnly("sc-cart");'
          + 'var cn=document.getElementById("sc-cust-name");'
          + 'if(cn)cn.textContent=d.customerName||"\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B";'
          + 'var rw=document.getElementById("sc-rows");'
          + 'if(rw)rw.innerHTML=(d.items||[]).map(function(i){'
            + 'return "<div class=\\"sc-row\\"><div><div class=\\"sc-name\\">"+i.name+"<\\/div>'
            + '<div class=\\"sc-unit\\">"+(i.unit||"\u0E0A\u0E34\u0E49\u0E19")+"<\\/div><\\/div>'
            + '<div class=\\"sc-qty\\">"+i.qty+"<\\/div>'
            + '<div class=\\"sc-price\\">\u0E3F"+fmt(i.price)+"<\\/div>'
            + '<div class=\\"sc-subtotal\\">\u0E3F"+fmt(i.price*i.qty)+"<\\/div><\\/div>";'
          + '}).join("");'
          + 'var tq=(d.items||[]).reduce(function(s,i){return s+i.qty;},0);'
          + 'var sc=document.getElementById("sc-count");'
          + 'if(sc)sc.textContent=tq+" \u0E0A\u0E34\u0E49\u0E19 / "+(d.items||[]).length+" \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23";'
          + 'var dr=document.getElementById("sc-disc-row");'
          + 'var dv=document.getElementById("sc-disc-val");'
          + 'if(dr&&dv){if(d.discount>0){dr.style.display="flex";dv.textContent="-\u0E3F"+fmt(d.discount);}else dr.style.display="none";}'
          + 'var st=document.getElementById("sc-total");'
          + 'if(st)st.textContent="\u0E3F"+fmt(d.total);'
        + '}else if(d.state==="qr"){'
          + 'showOnly("sc-qr");'
          + 'var qa=document.getElementById("sc-qr-amount");'
          + 'if(qa)qa.textContent="\u0E3F"+fmt(d.total);'
          + 'var qi=document.getElementById("sc-qr-id");'
          + 'if(qi)qi.textContent=d.promptpay?"\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E1E\u0E22: "+d.promptpay:"";'
          + 'var bx=document.getElementById("sc-qr-box");'
          + 'if(bx){'
            + 'if(d.qrUrl){'
              + 'var img=new Image();img.width=200;img.height=200;'
              + 'img.style.cssText="border-radius:8px;display:block;";'
              + 'img.src=d.qrUrl;'
              + 'bx.innerHTML="";bx.appendChild(img);'
            + '}else{'
              + 'bx.innerHTML="<div style=\'width:200px;height:200px;background:#f5f5f5;border-radius:8px;'
              + 'display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;text-align:center;padding:16px\'>'
              + '\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 PromptPay<br>\u0E43\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32<\\/div>";'
            + '}'
          + '}'
        + '}else if(d.state==="paid"){'
          + 'showOnly("sc-paid");'
          + 'var pa=document.getElementById("sc-paid-amt");'
          + 'if(pa)pa.textContent="\u0E3F"+fmt(d.total);'
          + 'var pc=document.getElementById("sc-paid-change");'
          + 'if(pc)pc.textContent=d.change>0?"\uD83E\uDE99 \u0E40\u0E07\u0E34\u0E19\u0E17\u0E2D\u0E19 \u0E3F"+fmt(d.change):"";'
          + 'setTimeout(function(){showOnly("sc-welcome");},5000);'
        + '}'
      + '};'
      + '})();'
      + '<\/script>'
      + '</body></html>';

    // ใช้ Blob URL เพื่อโหลด HTML ในหน้าต่างใหม่ — ไม่มี doc.write ไม่มี SyntaxError
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    customerDisplayWindow.location.href = blobUrl;
    // revoke หลัง 30 วิ
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
}

function updateCustomerDisplay(state = 'cart') {
    if (!customerDisplayWindow || customerDisplayWindow.closed) return;
    if (typeof customerDisplayWindow.updateDisplay !== 'function') {
        // window just opened, retry shortly
        setTimeout(() => updateCustomerDisplay(state), 300);
        return;
    }
    const discount = parseInt(document.getElementById('pos-discount')?.value) || 0;
    const subtotal  = cart.reduce((s,i) => s + i.price * i.qty, 0);
    const total     = Math.max(0, subtotal - discount);
    const customerName = checkoutState?.customer?.name || 'ลูกค้าทั่วไป';

    if (state === 'idle' || cart.length === 0) {
        customerDisplayWindow.updateDisplay({ state: 'idle' });
    } else {
        customerDisplayWindow.updateDisplay({
            state: 'cart',
            items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, unit: i.unit||'ชิ้น' })),
            total, discount, customerName
        });
    }
}

window.customerDisplayPaid = function(total, change) {
    if (!customerDisplayWindow || customerDisplayWindow.closed) return;
    if (typeof customerDisplayWindow.updateDisplay !== 'function') return;
    customerDisplayWindow.updateDisplay({ state: 'paid', total, change: change||0 });
};

// 7. CHECKOUT FLOW — 3 ขั้นตอน ไม่ทับกัน
// ══════════════════════════════════════════════════════════════════

document.getElementById('checkout-btn').onclick = openCheckout;

async function openCheckout() {
    if (cart.length === 0) return toast('กรุณาเลือกสินค้าก่อน', 'error');
    isProcessingPayment = false;
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const discount = parseInt(document.getElementById('pos-discount').value) || 0;
    const total    = Math.max(0, subtotal - discount);
    checkoutState  = { total, discount, customer: { type: 'general', id: null, name: 'ลูกค้าทั่วไป' }, method: null };
    showCheckoutStep1();
}

// ── Stepper HTML ─────────────────────────────────────────────────
function checkoutStepperHTML(active) {
    const steps = [{ n:1, label:'ลูกค้า' }, { n:2, label:'ชำระเงิน' }, { n:3, label:'ยืนยัน' }];
    return `<div class="checkout-stepper">${steps.map(s => {
        const cls = s.n < active ? 'done' : s.n === active ? 'active' : '';
        const inner = s.n < active ? '<i class="material-icons-round" style="font-size:16px;">check</i>' : `<span>${s.n}</span>`;
        return `<div class="checkout-step ${cls}"><div class="step-circle">${inner}</div><span class="step-label">${s.label}</span></div>`;
    }).join('')}</div>`;
}

// ── STEP 1: Customer ──────────────────────────────────────────────
function showCheckoutStep1() {
    const { total } = checkoutState;
    openModal('ชำระเงิน — เลือกลูกค้า', `
        <div class="checkout-panel">
            ${checkoutStepperHTML(1)}
            <div class="checkout-total-big">
                <div class="ct-label">ยอดที่ต้องชำระ</div>
                <div class="ct-amount">฿${formatNum(total)}</div>
            </div>
            <button class="customer-select-btn" onclick="checkoutPickCustomer()">
                <span class="csb-icon">🚶</span>
                <div><div class="csb-title">ลูกค้าทั่วไป</div><div class="csb-sub">ไม่บันทึกข้อมูล</div></div>
                <i class="material-icons-round" style="margin-left:auto;color:var(--text-4);">chevron_right</i>
            </button>
            <button class="customer-select-btn" onclick="checkoutPickExisting()">
                <span class="csb-icon">⭐</span>
                <div><div class="csb-title">ลูกค้าประจำ / สมาชิก</div><div class="csb-sub">ค้นหาจากฐานข้อมูล</div></div>
                <i class="material-icons-round" style="margin-left:auto;color:var(--text-4);">chevron_right</i>
            </button>
            <button class="customer-select-btn" onclick="checkoutNewCustomer()">
                <span class="csb-icon">➕</span>
                <div><div class="csb-title">ลงทะเบียนลูกค้าใหม่</div><div class="csb-sub">เพิ่มเข้าฐานข้อมูล</div></div>
                <i class="material-icons-round" style="margin-left:auto;color:var(--text-4);">chevron_right</i>
            </button>
        </div>
    `);
}

window.checkoutPickCustomer = function() {
    checkoutState.customer = { type: 'general', id: null, name: 'ลูกค้าทั่วไป' };
    showCheckoutStep2();
};

window.checkoutPickExisting = async function() {
    const { data: custs } = await db.from('customer').select('*').order('name');
    openModal('เลือกลูกค้าประจำ', `
        <div class="checkout-panel">
            ${checkoutStepperHTML(1)}
            <button class="checkout-back-btn" onclick="showCheckoutStep1()"><i class="material-icons-round" style="font-size:16px;">arrow_back</i> ย้อนกลับ</button>
            <input type="text" id="cust-search-inp" placeholder="🔍 พิมพ์ชื่อหรือเบอร์โทร..." class="glass-input"
                   style="width:100%;margin-bottom:12px;height:44px;padding:0 14px;" oninput="filterCustRows(this.value)">
            <div id="cust-rows" style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
                ${(custs||[]).map(c => `
                    <div class="customer-select-btn cust-row" data-search="${c.name.toLowerCase()} ${(c.phone||'').toLowerCase()}"
                         onclick="checkoutSetCustomer('${c.id}','${c.name.replace(/'/g,"\\'")}')">
                        <span class="csb-icon">👤</span>
                        <div><div class="csb-title">${c.name}</div>
                        <div class="csb-sub">${c.phone||'ไม่มีเบอร์'}${c.debt_amount>0?` · หนี้ ฿${formatNum(c.debt_amount)}`:''}</div></div>
                        <i class="material-icons-round" style="margin-left:auto;color:var(--text-4);">chevron_right</i>
                    </div>`).join('')}
            </div>
        </div>
    `);
    window.filterCustRows = q => document.querySelectorAll('.cust-row').forEach(el => {
        el.style.display = el.dataset.search.includes(q.toLowerCase()) ? '' : 'none';
    });
};

window.checkoutSetCustomer = function(id, name) {
    checkoutState.customer = { type: 'member', id, name };
    showCheckoutStep2();
};

window.checkoutNewCustomer = function() {
    openModal('ลงทะเบียนลูกค้าใหม่', `
        <div class="checkout-panel">
            ${checkoutStepperHTML(1)}
            <button class="checkout-back-btn" onclick="showCheckoutStep1()"><i class="material-icons-round" style="font-size:16px;">arrow_back</i> ย้อนกลับ</button>
            <form id="new-cust-form">
                <div class="input-group"><label>ชื่อ-นามสกุล *</label><input id="nc-name" required></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="input-group"><label>เบอร์โทร</label><input id="nc-phone" type="tel"></div>
                    <div class="input-group"><label>ที่อยู่</label><input id="nc-addr"></div>
                </div>
                <button type="submit" class="btn btn-red" style="width:100%;margin-top:10px;">
                    <i class="material-icons-round">person_add</i> ลงทะเบียนและไปชำระเงิน
                </button>
            </form>
        </div>
    `);
    document.getElementById('new-cust-form').onsubmit = async e => {
        e.preventDefault();
        const name = document.getElementById('nc-name').value;
        if (!name) return;
        const { data, error } = await db.from('customer').insert({ name, phone: document.getElementById('nc-phone').value, address: document.getElementById('nc-addr').value }).select().single();
        if (error) return toast(error.message, 'error');
        checkoutState.customer = { type: 'member', id: data.id, name: data.name };
        toast('ลงทะเบียนสำเร็จ');
        showCheckoutStep2();
    };
};

// ── STEP 2: Payment Method ────────────────────────────────────────
function showCheckoutStep2() {
    const { total, customer } = checkoutState;
    openModal('ชำระเงิน — วิธีชำระ', `
        <div class="checkout-panel">
            ${checkoutStepperHTML(2)}
            <button class="checkout-back-btn" onclick="showCheckoutStep1()"><i class="material-icons-round" style="font-size:16px;">arrow_back</i> ย้อนกลับ</button>
            <div class="checkout-total-big" style="margin-bottom:18px;">
                <div class="ct-label">ยอดชำระ</div>
                <div class="ct-amount">฿${formatNum(total)}</div>
                <div class="ct-customer">👤 ${customer.name}</div>
            </div>
            <button class="pay-card pay-cash" onclick="checkoutStartCash()">
                <span class="pc-icon">💵</span>
                <div><div class="pc-title">เงินสด</div><div class="pc-sub">นับแบงค์รับ-ทอน</div></div>
                <i class="material-icons-round pc-arrow">chevron_right</i>
            </button>
            <button class="pay-card pay-transfer" onclick="checkoutTransfer()">
                <span class="pc-icon">📲</span>
                <div><div class="pc-title">โอนเงิน / สแกน QR</div><div class="pc-sub">PromptPay / พร้อมเพย์</div></div>
                <i class="material-icons-round pc-arrow">chevron_right</i>
            </button>
            ${customer.id ? `
            <button class="pay-card pay-credit" onclick="checkoutCredit()">
                <span class="pc-icon">📋</span>
                <div><div class="pc-title">ติดหนี้ไว้ (Credit)</div><div class="pc-sub">บันทึกค้างชำระ</div></div>
                <i class="material-icons-round pc-arrow">chevron_right</i>
            </button>` : ''}
        </div>
    `);
}

// ── STEP 3a: CASH → BN overlay ────────────────────────────────────
window.checkoutStartCash = function() {
    checkoutState.method = 'เงินสด';
    closeModal();
    openBnOverlay(checkoutState.total, 'receive', (received, recDenoms) => {
        const change = received - checkoutState.total;
        if (change > 0) {
            openBnOverlay(change, 'change', (changeGiven, changeDenoms) => {
                doFinalPayment('เงินสด', received, change, recDenoms, changeDenoms);
            });
        } else {
            doFinalPayment('เงินสด', received, 0, recDenoms, null);
        }
    });
};

// ── STEP 3b: TRANSFER ─────────────────────────────────────────────
window.checkoutTransfer = function() {
    checkoutState.method = 'โอน';
    const { total, customer } = checkoutState;
    const shopInfo = getShopInfo();

    // Generate dynamic PromptPay QR with actual amount
    const ppId = shopInfo.promptpay ? shopInfo.promptpay.replace(/[-\s]/g,'') : '';
    const dynamicQrUrl = ppId ? generatePromptPayQR(ppId, total) : null;

    // Show dynamic QR if we can generate it, else fall back to static image
    const qrHtml = dynamicQrUrl
        ? `<img src="${dynamicQrUrl}" style="width:180px;height:180px;object-fit:contain;border-radius:8px;margin:8px auto;display:block;" alt="PromptPay QR">
           <div style="font-size:11px;font-weight:700;color:#1565C0;margin-top:4px;">🤖 QR ระบุยอด ฿${formatNum(total)} อัตโนมัติ</div>`
        : shopInfo.qrUrl
            ? `<img src="${shopInfo.qrUrl}" style="width:160px;height:160px;object-fit:contain;border-radius:8px;margin:8px auto;display:block;" onerror="this.style.display='none'">
               <div style="font-size:11px;color:var(--text-3);">QR รูปภาพ (ไม่ระบุยอด)</div>`
            : `<div style="width:160px;height:160px;background:var(--glass-md);border-radius:8px;margin:8px auto;display:flex;align-items:center;justify-content:center;color:var(--text-4);font-size:12px;text-align:center;">ไม่มี QR<br>ตั้งค่า PromptPay<br>ในตั้งค่าร้านค้า</div>`;

    // แสดง QR บนจอลูกค้าด้วย
    if (customerDisplayWindow && !customerDisplayWindow.closed) {
        setTimeout(() => {
            if (typeof customerDisplayWindow.updateDisplay === 'function') {
                customerDisplayWindow.updateDisplay({
                    state: 'qr',
                    qrUrl: dynamicQrUrl || shopInfo.qrUrl || null,
                    total, promptpay: shopInfo.promptpay || '',
                    shopName: shopInfo.name || 'SK POS'
                });
            }
        }, 200);
    }

    openModal('ชำระเงิน — ยืนยันโอน', `
        <div class="checkout-panel">
            ${checkoutStepperHTML(3)}
            <button class="checkout-back-btn" onclick="showCheckoutStep2()"><i class="material-icons-round" style="font-size:16px;">arrow_back</i> ย้อนกลับ</button>
            <div class="checkout-total-big">
                <div class="ct-label">📲 ยอดโอน</div>
                <div class="ct-amount">฿${formatNum(total)}</div>
                <div class="ct-customer">👤 ${customer.name}</div>
            </div>
            <div style="background:var(--blue-subtle,#E3F2FD);border:1.5px solid rgba(21,101,192,0.2);border-radius:var(--r-lg);padding:16px;text-align:center;margin-bottom:16px;">
                ${qrHtml}
                <div style="font-weight:700;color:var(--text-1);margin-top:8px;">สแกน QR หรือโอนพร้อมเพย์</div>
                ${ppId ? `<div style="font-size:13px;color:var(--text-3);margin-top:4px;">${shopInfo.promptpay}</div>` : ''}
            </div>
            <button class="btn btn-red" style="width:100%;height:52px;font-size:16px;font-weight:800;"
                    onclick="doFinalPayment('โอน',${total},${total},null,null)">
                <i class="material-icons-round">check_circle</i> ยืนยัน — รับโอนแล้ว
            </button>
        </div>
    `);
};

// ── PromptPay QR Generator (EMVCo / BOT spec) ────────────────────
function generatePromptPayQR(id, amount) {
    try {
        const raw = id.replace(/\D/g, '');
        let ppTag, target;

        if (raw.length === 10) {
            ppTag  = '01';                        // Mobile phone
            target = '0066' + raw.substring(1);   // 0812345678 → 66812345678
        } else if (raw.length === 13) {
            ppTag  = '02';                        // Tax ID / Citizen ID
            target = raw;
        } else {
            return null;
        }

        // BOT PromptPay EMVCo spec:
        // Tag 26: Merchant Account Info (PromptPay AID = A000000677010111)
        const ppValue  = tlv(ppTag, target);
        const aidField = tlv('00', 'A000000677010111') + tlv('01', ppValue);
        const mchAcct  = tlv('26', aidField);           // ← Tag 26 (not 29)

        const shopInfo = getShopInfo();
        const mchName  = (shopInfo.nameEn || shopInfo.name || 'SHOP').substring(0, 25)
                            .replace(/[^\x20-\x7E]/g, 'X');  // ASCII only
        const mchCity  = 'Bangkok';
        const amtStr   = amount.toFixed(2);

        // Payload without CRC
        let payload =
            tlv('00', '01')        +   // Payload Format Indicator = "01"
            mchAcct                +   // Merchant Account Info
            tlv('52', '0000')      +   // MCC: generic
            tlv('53', '764')       +   // Currency: THB
            tlv('54', amtStr)      +   // Amount
            tlv('58', 'TH')        +   // Country
            tlv('59', mchName)     +   // Merchant Name (ASCII)
            tlv('60', mchCity)     +   // City
            '6304';                    // CRC placeholder (tag+len, no value yet)

        const checksum = crc16ccitt(payload);
        payload = payload + checksum;

        return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}&ecc=M&margin=1`;
    } catch (e) {
        console.error('PromptPay QR error:', e);
        return null;
    }
}

function tlv(tag, value) {
    return tag + String(value.length).padStart(2, '0') + value;
}

// CRC-16/CCITT-FALSE  poly=0x1021  init=0xFFFF  refIn=false  refOut=false
// & 0xFFFF after every bit-shift to stay within 16 bits in JS
function crc16ccitt(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) << 8) & 0xFFFF;
        for (let b = 0; b < 8; b++) {
            crc = (crc & 0x8000)
                ? (((crc << 1) & 0xFFFF) ^ 0x1021)
                : ((crc << 1) & 0xFFFF);
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

// ── STEP 3c: CREDIT ───────────────────────────────────────────────
window.checkoutCredit = function() {
    checkoutState.method = 'ลูกหนี้';
    const { total, customer } = checkoutState;
    openModal('ชำระเงิน — บันทึกหนี้', `
        <div class="checkout-panel">
            ${checkoutStepperHTML(3)}
            <button class="checkout-back-btn" onclick="showCheckoutStep2()"><i class="material-icons-round" style="font-size:16px;">arrow_back</i> ย้อนกลับ</button>
            <div class="checkout-total-big" style="border-color:rgba(198,40,40,0.3);">
                <div class="ct-label">📋 บันทึกติดหนี้</div>
                <div class="ct-amount">฿${formatNum(total)}</div>
                <div class="ct-customer">👤 ${customer.name}</div>
            </div>
            <div style="background:var(--primary-subtle,rgba(198,40,40,0.06));border:1.5px solid rgba(198,40,40,0.2);border-radius:var(--r-lg);padding:14px;margin-bottom:16px;text-align:center;font-size:13px;color:var(--primary,#C62828);font-weight:600;">
                ⚠️ ยอด ฿${formatNum(total)} จะถูกบันทึกเป็นหนี้ค้างของ ${customer.name}
            </div>
            <button class="btn btn-red" style="width:100%;height:52px;font-size:16px;font-weight:800;"
                    onclick="doFinalPayment('ลูกหนี้',${total},${total},null,null)">
                <i class="material-icons-round">assignment</i> ยืนยัน — บันทึกติดหนี้
            </button>
        </div>
    `);
};

// ── FINAL: Save to DB + Print prompt ─────────────────────────────
async function doFinalPayment(method, received, change, recDenoms, changeDenoms) {
    if (isProcessingPayment) return;
    isProcessingPayment = true;
    closeModal();

    const { total, discount, customer } = checkoutState;
    try {
        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const { data: bill, error: berr } = await db.from('บิลขาย').insert({
            method, total, received, change, discount,
            customer_id: customer.id, customer_name: customer.name,
            staff_name: USER.username, note: '', denominations: recDenoms,
            status: 'สำเร็จ',
        }).select().single();
        if (berr) throw berr;

        const items = cart.map(i => ({
            bill_id: bill.id,
            product_id: i.id,
            name: i.name,
            qty: i.qty,
            price: i.price,
            cost: i.cost,
            total: i.price * i.qty,
            unit: i.unit || 'ชิ้น'
        }));
        const { error: ierr } = await db.from('รายการในบิล').insert(items);
        if (ierr) throw ierr;

        logAct('ขายสินค้า', `บิล #${bill.bill_no || bill.id.substring(0,8)} ยอด ${formatNum(total)} (${customer.name})`);
        customerDisplayPaid(total, change); // อัปเดตจอลูกค้า — ชำระสำเร็จ
        cart = [];
        renderCart();
        refreshProducts().then(renderProductGrid);
        updateGlobalBalance();
        isProcessingPayment = false;
        Swal.close();

        // ── Print prompt after payment ────────────────────────
        const changeDenomsHtml = changeDenoms
            ? Object.entries(changeDenoms).filter(([,c])=>c>0).map(([v,c])=>`<span style="background:var(--glass-md);padding:3px 10px;border-radius:20px;font-size:12px;">฿${formatNum(v)} × ${c}</span>`).join(' ')
            : '';

        const { value: printChoice } = await Swal.fire({
            title: '✅ ชำระเงินสำเร็จ',
            html: `
                <div style="text-align:center;">
                    <div style="font-size:48px;margin-bottom:8px;">🎉</div>
                    <div style="font-size:14px;color:var(--text-3,#555);margin-bottom:12px;">
                        ลูกค้า: <b>${customer.name}</b> | ${method}
                    </div>
                    ${change > 0 ? `
                    <div style="background:#E8F5E9;border:1.5px solid rgba(46,125,50,0.3);border-radius:12px;padding:14px;margin-bottom:16px;">
                        <div style="font-size:12px;color:#2E7D32;font-weight:700;margin-bottom:4px;">เงินทอนคืนลูกค้า</div>
                        <div style="font-size:32px;font-weight:900;color:#2E7D32;">฿${formatNum(change)}</div>
                        ${changeDenomsHtml ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;justify-content:center;">${changeDenomsHtml}</div>` : ''}
                    </div>` : ''}
                    <div style="font-size:13px;color:var(--text-3,#666);margin-bottom:12px;">เลือกรูปแบบพิมพ์ใบเสร็จ</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <button onclick="Swal.fire({didOpen:()=>{Swal.close()}});printReceipt80mm('${bill.id}')"
                            style="padding:14px;border:2px solid #DDD;border-radius:12px;background:#FFF;cursor:pointer;font-size:13px;font-weight:700;">
                            🧾<br>80mm Thermal<br><span style="font-size:11px;color:#888;font-weight:400;">ใบเสร็จทั่วไป</span>
                        </button>
                        <button onclick="Swal.fire({didOpen:()=>{Swal.close()}});exportInvoiceA4('${bill.id}')"
                            style="padding:14px;border:2px solid #DDD;border-radius:12px;background:#FFF;cursor:pointer;font-size:13px;font-weight:700;">
                            📄<br>A4 Invoice<br><span style="font-size:11px;color:#888;font-weight:400;">ใบกำกับภาษี</span>
                        </button>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'ไม่พิมพ์ / เสร็จสิ้น',
        });

    } catch (err) {
        isProcessingPayment = false;
        Swal.close();
        toast(err.message, 'error');
    }
}

// Legacy aliases
function showCustomerSelection(total) { checkoutState.total = total; showCheckoutStep1(); }
async function showCustomerList(total) { checkoutState.total = total; await window.checkoutPickExisting(); }
function showPaymentMethodSelection(total) { checkoutState.total = total; showCheckoutStep2(); }
function selectCustomer(type, total) { checkoutState.customer = { type:'general', id:null, name:'ลูกค้าทั่วไป' }; showCheckoutStep2(); }
function startCashCounting(total, discount) { checkoutState.total = total; checkoutState.discount = discount; window.checkoutStartCash(); }
function confirmPayment(method, total, discount) { doFinalPayment(method, total, total, null, null); }

// ══════════════════════════════════════════════════════════════════
// BILL COUNTER (BN) OVERLAY — redesigned with exact-change lock
// ══════════════════════════════════════════════════════════════════

let BN2 = { mode: 'receive', required: 0, counts: {}, stock: {}, callback: null, total: 0 };

function openBnOverlay(requiredAmt, mode, callback) {
    BN2 = { mode, required: requiredAmt, counts: {}, stock: {}, callback, total: 0 };
    [...BN_BILLS, ...BN_COINS].forEach(d => { BN2.counts[d.val] = 0; });
    bnLoadStock2().then(() => {
        bnRenderOverlay2();
        document.getElementById('bn-overlay').classList.add('show');
    });
}

async function bnLoadStock2() {
    try {
        const { data: sessions } = await db.from('cash_session').select('id').eq('status','open').limit(1);
        if (!sessions?.length) return;
        const { data: txs } = await db.from('cash_transaction').select('denominations,direction').eq('session_id', sessions[0].id);
        [...BN_BILLS, ...BN_COINS].forEach(d => { BN2.stock[d.val] = 0; });
        txs?.forEach(tx => {
            if (!tx.denominations) return;
            Object.entries(tx.denominations).forEach(([v,c]) => {
                BN2.stock[v] = (BN2.stock[v]||0) + (tx.direction==='in' ? c : -c);
            });
        });
    } catch(e) { console.error('bnLoadStock2', e); }
}

function bnRenderOverlay2() {
    const mode      = BN2.mode;
    const isReceive = mode === 'receive';
    const isExpense = mode === 'expense';
    const isReturn  = mode === 'return';   // รับเงินทอนกลับเข้าลิ้นชัก (expense flow step 2)
    const isChange  = mode === 'change';   // ทอนเงินคืนลูกค้า (sale flow step 2)

    // Step indicator labels
    const step1Label = isExpense||isReturn ? 'จ่ายเงินออก'       : 'รับเงินจากลูกค้า';
    const step2Label = isExpense||isReturn ? 'รับเงินเข้าลิ้นชัก' : 'ทอนเงินคืน';
    const isStep1    = isReceive || isExpense;
    const step1Active = isStep1;
    const step2Active = isChange || isReturn;

    // Colors
    const step1Color = isExpense ? '#E65100' : '#C62828';
    const step2Color = '#2E7D32';

    // Header text
    const headerLabel = isReceive ? '💵 รับเงินจากลูกค้า'
                      : isExpense ? '💸 จ่ายเงินออกจากลิ้นชัก'
                      : isReturn  ? '📥 รับเงินเข้าลิ้นชัก'
                      : '🔄 ทอนเงินคืนลูกค้า';
    const headerColor = isExpense ? '#E65100' : isReturn ? '#1565C0' : isReceive ? 'var(--text-1)' : '#C62828';

    // Status labels
    const countedLabel  = isReceive ? 'รับมาทั้งหมด'     : isExpense ? 'จ่ายออกทั้งหมด'     : isReturn ? 'รับกลับแล้ว' : 'นับทอนแล้ว';
    const requiredLabel = isReceive ? 'ยอดที่ต้องรับ'     : isExpense ? 'ยอดรายจ่าย'          : isReturn  ? 'ต้องรับกลับ' : 'ยอดที่ต้องทอน';
    const confirmLabel  = isReceive ? 'ยืนยันรับเงิน'     : isExpense ? 'ยืนยันจ่ายออก'       : isReturn  ? 'ยืนยันรับเข้าลิ้นชัก' : 'ยืนยันทอนเงิน';
    const confirmIcon   = isReceive ? 'check'              : isExpense ? 'arrow_upward'         : isReturn  ? 'arrow_downward' : 'payments';
    const exactNote     = isReturn  ? '⚠️ ต้องรับกลับพอดี — ห้ามขาด ห้ามเกิน'
                        : isChange  ? '⚠️ ต้องทอนพอดีเท่านั้น — ห้ามขาด ห้ามเกิน' : '';

    const overlay = document.getElementById('bn-overlay');

    overlay.innerHTML = `
        <div class="bn-modal" style="max-height:96vh;overflow-y:auto;border-radius:24px;">

            <!-- Step indicator -->
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 20px;background:${step1Active?`rgba(${isExpense?'230,81,0':'198,40,40'},0.06)`:'rgba(46,125,50,0.06)'};border-bottom:1px solid var(--glass-border);">
                <div style="display:flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;background:${step1Active?step1Color:'rgba(46,125,50,0.12)'};color:${step1Active?'#FFF':'#2E7D32'};border:1.5px solid ${step1Active?step1Color:'rgba(46,125,50,0.4)'};">
                    <i class="material-icons-round" style="font-size:15px;">${step1Active?'radio_button_checked':'check_circle'}</i>
                    ${step1Label}
                </div>
                <div style="width:28px;height:2px;background:${step2Active?step2Color:'var(--glass-border)'};border-radius:2px;"></div>
                <div style="display:flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;background:${step2Active?step2Color:'var(--glass-md)'};color:${step2Active?'#FFF':'var(--text-4)'};border:1.5px solid ${step2Active?step2Color:'var(--glass-border)'};">
                    <i class="material-icons-round" style="font-size:15px;">${step2Active?'radio_button_checked':'radio_button_unchecked'}</i>
                    ${step2Label}
                </div>
            </div>

            <!-- Header amount -->
            <div style="text-align:center;padding:18px 24px 10px;">
                <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">
                    ${headerLabel}
                </div>
                <div style="font-size:40px;font-weight:900;color:${headerColor};line-height:1;">฿${formatNum(BN2.required)}</div>
                ${exactNote ? `<div style="font-size:12px;color:#C62828;margin-top:4px;font-weight:700;">${exactNote}</div>` : ''}
            </div>

            <!-- Bills grid -->
            <div style="padding:0 14px 4px;">
                <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-left:4px;">💵 ธนบัตร</div>
                <div class="bn-grid" id="bn-bill-grid2"></div>
            </div>

            <!-- Coins grid -->
            <div style="padding:4px 14px 8px;">
                <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-left:4px;">🪙 เหรียญ</div>
                <div class="bn-grid bn-grid-coins" id="bn-coin-grid2"></div>
            </div>

            <!-- Status bar -->
            <div id="bn2-status" style="margin:8px 14px;border-radius:14px;padding:14px 16px;background:var(--glass-sm);border:1.5px solid var(--glass-border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:13px;color:var(--text-3);font-weight:600;">${countedLabel}</span>
                    <span id="bn2-counted" style="font-size:22px;font-weight:900;color:var(--text-1);">฿0</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:13px;color:var(--text-3);font-weight:600;">${requiredLabel}</span>
                    <span style="font-size:16px;font-weight:800;color:var(--text-2);">฿${formatNum(BN2.required)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span id="bn2-diff-lbl" style="font-size:13px;font-weight:700;color:#C62828;">ขาดอยู่</span>
                    <span id="bn2-diff-val" style="font-size:18px;font-weight:900;color:#C62828;">฿${formatNum(BN2.required)}</span>
                </div>
            </div>

            <!-- Exact bar (change/return mode) -->
            ${(isChange||isReturn) ? `<div id="bn2-exact-bar" style="margin:4px 14px 0;border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;background:rgba(198,40,40,0.06);border:1.5px solid rgba(198,40,40,0.2);color:#C62828;">
                <i class="material-icons-round" style="font-size:18px;">lock</i>
                <span id="bn2-exact-msg">${isReturn?'ต้องรับกลับพอดี':'ต้องทอนพอดี'} ฿${formatNum(BN2.required)}</span>
            </div>` : ''}

            <!-- Actions -->
            <div class="bn-actions" style="padding:14px 14px 18px;">
                <button class="bn-btn-reset" onclick="bnReset2()"><i class="material-icons-round">refresh</i> รีเซ็ต</button>
                <button id="bn2-confirm-btn" class="bn-btn-confirm" onclick="bnConfirm2()" disabled>
                    <i class="material-icons-round">${confirmIcon}</i>
                    ${confirmLabel}
                </button>
            </div>
        </div>
    `;

    bnBuildGrids2();
    bnUpdateStatus2();
}

function bnBuildGrids2() {
    const bg = document.getElementById('bn-bill-grid2');
    const cg = document.getElementById('bn-coin-grid2');
    if (!bg || !cg) return;

    const billColors = { 1000:'#5D4037', 500:'#6A1B9A', 100:'#C62828', 50:'#1565C0', 20:'#2E7D32' };

    BN_BILLS.forEach(b => {
        const c = billColors[b.val] || '#333';
        bg.innerHTML += `
            <button class="bn-btn" id="bnbtn2-${b.val}" onclick="bnTap2(${b.val})">
                <div class="bn-badge" id="bn2-badge-${b.val}">0</div>
                <div class="bn-face" style="background:linear-gradient(135deg,${c},${c}cc);color:#FFF;font-weight:900;text-shadow:0 1px 3px rgba(0,0,0,0.4);">${b.label}</div>
                <div class="bn-tag">B${b.label}</div>
                <div id="bn2-stock-${b.val}" class="bn-stock bn-stock-ok">...</div>
            </button>`;
    });
    BN_COINS.forEach(c => {
        cg.innerHTML += `
            <button class="bn-btn" id="bnbtn2-${c.val}" onclick="bnTap2(${c.val})">
                <div class="bn-badge" id="bn2-badge-${c.val}">0</div>
                <div class="bn-face-coin face-coin">${c.label}</div>
                <div class="bn-tag">฿${c.label}</div>
                <div id="bn2-stock-${c.val}" class="bn-stock bn-stock-ok">...</div>
            </button>`;
    });
    [...BN_BILLS, ...BN_COINS].forEach(d => bnUpdateDenom2(d.val));
}

window.bnTap2 = function(val) {
    const isExact = BN2.mode === 'change' || BN2.mode === 'return';
    if (isExact) {
        const avail = (BN2.stock[val]||0) - (BN2.counts[val]||0);
        if (avail <= 0) { toast(`ไม่มีแบงค์ ฿${val} ในลิ้นชัก`, 'error'); return; }
        if (BN2.total + val > BN2.required) { toast(`เกินยอดที่ต้องการ — ต้องพอดี ฿${formatNum(BN2.required)}`, 'error'); return; }
    }
    BN2.counts[val] = (BN2.counts[val]||0) + 1;
    BN2.total = Object.entries(BN2.counts).reduce((s,[v,c]) => s + Number(v)*c, 0);
    bnUpdateDenom2(val);
    bnUpdateStatus2();
};

window.bnReset2 = function() {
    [...BN_BILLS, ...BN_COINS].forEach(d => { BN2.counts[d.val] = 0; });
    BN2.total = 0;
    bnBuildGrids2();
    bnUpdateStatus2();
};

function bnUpdateDenom2(val) {
    const badge = document.getElementById(`bn2-badge-${val}`);
    const btn   = document.getElementById(`bnbtn2-${val}`);
    const stock = document.getElementById(`bn2-stock-${val}`);
    if (!badge) return;
    const cnt = BN2.counts[val]||0;
    badge.textContent = cnt;
    if (btn) btn.classList.toggle('has-val', cnt > 0);
    if (stock) {
        const avail = (BN2.stock[val]||0) - (BN2.mode==='change' ? cnt : 0);
        const isCoin = BN_COINS.some(c => c.val === val);
        if (avail <= 0) { stock.textContent='หมด'; stock.className='bn-stock bn-stock-empty'; }
        else if (avail <= (isCoin?3:2)) { stock.textContent=`เหลือ ${avail}`; stock.className='bn-stock bn-stock-low'; }
        else { stock.textContent=`${avail} ${isCoin?'เหรียญ':'ใบ'}`; stock.className='bn-stock bn-stock-ok'; }
    }
}

function bnUpdateStatus2() {
    const counted  = BN2.total;
    const required = BN2.required;
    const diff     = counted - required;
    const isExact  = BN2.mode === 'change' || BN2.mode === 'return'; // both need exact match

    const el = id => document.getElementById(id);
    if (el('bn2-counted')) el('bn2-counted').textContent = `฿${formatNum(counted)}`;

    const confirmBtn = el('bn2-confirm-btn');
    const exactBar   = el('bn2-exact-bar');
    const exactMsg   = el('bn2-exact-msg');
    const diffLbl    = el('bn2-diff-lbl');
    const diffVal    = el('bn2-diff-val');
    const statusBox  = el('bn2-status');

    const exactWord = BN2.mode === 'return' ? 'รับกลับ' : 'ทอน';

    if (isExact) {
        if (diff === 0 && counted > 0) {
            if (diffLbl) { diffLbl.textContent=`✅ ${exactWord}ครบพอดี`; diffLbl.style.color='#2E7D32'; }
            if (diffVal) { diffVal.textContent='฿0'; diffVal.style.color='#2E7D32'; }
            if (exactBar) { exactBar.style.background='rgba(46,125,50,0.08)'; exactBar.style.borderColor='rgba(46,125,50,0.3)'; exactBar.style.color='#2E7D32'; }
            if (exactMsg) exactMsg.textContent=`✅ ${exactWord}ครบพอดี — กดยืนยันได้เลย`;
            if (statusBox) statusBox.style.borderColor='rgba(46,125,50,0.4)';
            if (confirmBtn) { confirmBtn.disabled=false; confirmBtn.classList.add('active'); }
        } else if (diff > 0) {
            if (diffLbl) { diffLbl.textContent='⚠️ เกินไป'; diffLbl.style.color='#E65100'; }
            if (diffVal) { diffVal.textContent=`+฿${formatNum(diff)}`; diffVal.style.color='#E65100'; }
            if (exactBar) { exactBar.style.background='rgba(230,81,0,0.06)'; exactBar.style.borderColor='rgba(230,81,0,0.3)'; exactBar.style.color='#E65100'; }
            if (exactMsg) exactMsg.textContent=`เกินไป ฿${formatNum(diff)} — รีเซ็ตแล้วนับใหม่`;
            if (confirmBtn) { confirmBtn.disabled=true; confirmBtn.classList.remove('active'); }
        } else {
            const short = required - counted;
            if (diffLbl) { diffLbl.textContent=`เหลือต้อง${exactWord}`; diffLbl.style.color='#C62828'; }
            if (diffVal) { diffVal.textContent=`฿${formatNum(short)}`; diffVal.style.color='#C62828'; }
            if (exactMsg) exactMsg.textContent=`ยังขาดอยู่ ฿${formatNum(short)}`;
            if (confirmBtn) { confirmBtn.disabled=true; confirmBtn.classList.remove('active'); }
        }
    } else {
        // receive / expense — only need >= required
        if (diff >= 0) {
            if (diffLbl) { diffLbl.textContent=diff>0?'💚 เงินทอน':'✅ พอดี'; diffLbl.style.color=diff>0?'#2E7D32':'var(--text-2)'; }
            if (diffVal) { diffVal.textContent=`฿${formatNum(diff)}`; diffVal.style.color=diff>0?'#2E7D32':'var(--text-2)'; }
            if (statusBox) statusBox.style.borderColor='rgba(46,125,50,0.3)';
            if (confirmBtn) { confirmBtn.disabled=false; confirmBtn.classList.add('active'); }
        } else {
            if (diffLbl) { diffLbl.textContent='ขาดอยู่'; diffLbl.style.color='#C62828'; }
            if (diffVal) { diffVal.textContent=`฿${formatNum(Math.abs(diff))}`; diffVal.style.color='#C62828'; }
            if (statusBox) statusBox.style.borderColor='rgba(198,40,40,0.25)';
            if (confirmBtn) { confirmBtn.disabled=true; confirmBtn.classList.remove('active'); }
        }
    }
}

window.bnConfirm2 = function() {
    const isExact = BN2.mode === 'change' || BN2.mode === 'return';
    if (isExact && BN2.total !== BN2.required) { toast('ต้องพอดีเท่านั้น', 'error'); return; }
    if (!isExact && BN2.total < BN2.required)  { toast('รับเงินไม่พอ', 'error'); return; }
    document.getElementById('bn-overlay').classList.remove('show');
    if (BN2.callback) BN2.callback(BN2.total, { ...BN2.counts });
};

// Legacy wrapper for expense/debt pages that still use openCashCalculator
function openCashCalculator(title, callback, requiredAmt = 0) {
    const mode = title.includes('ทอน') ? 'change' : 'receive';
    openBnOverlay(requiredAmt, mode, (total, denoms) => callback(total, '', denoms));
}



// 8. INVENTORY LOGIC
// ── Barcode helpers ───────────────────────────────────────────────
window.genBarcode = function() {
    // Generate EAN-13 style internal code: 200 + 9 random digits + check digit
    const digits = '200' + Array.from({length: 9}, () => Math.floor(Math.random()*10)).join('');
    const arr = digits.split('').map(Number);
    // EAN-13 check digit
    const sum = arr.reduce((s,d,i) => s + d * (i%2===0 ? 1 : 3), 0);
    const check = (10 - (sum % 10)) % 10;
    const code = digits + check;
    const inp = document.getElementById('p-barcode');
    if (inp) { inp.value = code; renderBarcodePreview(code); }
};

window.renderBarcodePreview = function(val) {
    if (!val) { document.getElementById('barcode-preview').style.display='none'; return; }
    const preview = document.getElementById('barcode-preview');
    const svg = document.getElementById('barcode-svg');
    if (!preview || !svg) return;
    try {
        JsBarcode(svg, val, { format:'CODE128', width:1.5, height:40, displayValue:true, fontSize:11, margin:4 });
        preview.style.display = 'block';
    } catch(e) { preview.style.display='none'; }
};

window.scanBarcodeIntoField = async function(fieldId) {
    // กรณีไม่มี BarcodeDetector (Desktop Chrome/Firefox) — ใช้ Quagga
    if (!('BarcodeDetector' in window)) {
        return _scanIntoFieldQuagga(fieldId);
    }
    // กรณีมี BarcodeDetector (Chrome Android / Edge)
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
    overlay.innerHTML = `
        <div style="color:#fff;font-size:18px;font-weight:700;">📷 ส่องบาร์โค้ดสินค้า</div>
        <div style="position:relative;width:min(380px,90vw);">
            <video id="scan-video" style="width:100%;border-radius:12px;display:block;" autoplay playsinline></video>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:75%;height:70px;
                border:2px solid #E53935;border-radius:8px;pointer-events:none;"></div>
        </div>
        <p style="color:rgba(255,255,255,0.7);font-size:13px;">วางบาร์โค้ดในกรอบ</p>
        <div style="display:flex;gap:10px;">
            <button onclick="this.closest('div[style]').remove();window._scanStop&&window._scanStop();"
                style="padding:10px 20px;background:#333;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;">ยกเลิก</button>
            <button onclick="window._scanStop&&window._scanStop();this.closest('div[style]').remove();_scanIntoFieldQuagga('${fieldId}');"
                style="padding:10px 20px;background:#1565C0;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;">⌨️ พิมพ์เอง</button>
        </div>`;
    document.body.appendChild(overlay);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' } });
        const video = overlay.querySelector('#scan-video');
        video.srcObject = stream;
        window._scanStop = () => stream.getTracks().forEach(t => t.stop());
        const detector = new BarcodeDetector({ formats:['ean_13','ean_8','code_128','code_39','upc_a','upc_e'] });
        const loop = async () => {
            if (!overlay.isConnected) return;
            try {
                const codes = await detector.detect(video);
                if (codes.length > 0) {
                    const val = codes[0].rawValue;
                    stream.getTracks().forEach(t => t.stop());
                    overlay.remove();
                    const inp = document.getElementById(fieldId);
                    if (inp) { inp.value = val; renderBarcodePreview(val); toast('✅ สแกนสำเร็จ: '+val); }
                    return;
                }
            } catch(e) {}
            requestAnimationFrame(loop);
        };
        video.onloadedmetadata = () => loop();
    } catch(e) {
        overlay.remove();
        toast('ไม่สามารถเปิดกล้องได้: '+e.message, 'error');
    }
};

// Quagga fallback สำหรับ scanBarcodeIntoField บน Desktop
async function _scanIntoFieldQuagga(fieldId) {
    const { value } = await Swal.fire({
        title: '📷 สแกน/กรอกบาร์โค้ด',
        html: `<p style="font-size:13px;color:#888;margin-bottom:8px;">ใช้เครื่องสแกน USB หรือกรอกด้วยตนเอง</p>`,
        input: 'text', inputPlaceholder: 'กรอกบาร์โค้ด...',
        confirmButtonText: 'ตกลง', showCancelButton: true, cancelButtonText: 'ยกเลิก',
        didOpen: () => { const inp = Swal.getInput(); if(inp) inp.focus(); }
    });
    if (value) {
        const inp = document.getElementById(fieldId);
        if (inp) { inp.value = value.trim(); renderBarcodePreview(value.trim()); }
        toast('✅ บาร์โค้ด: ' + value.trim());
    }
}

// ── Print Barcode Sticker ─────────────────────────────────────────
window.openPrintStickerModal = function() {
    const prods = products.filter(p => p.barcode);
    const noBarcodeCount = products.filter(p => !p.barcode).length;

    const content = `
        <div style="padding:4px 0;">
            ${noBarcodeCount > 0 ? `<div style="background:rgba(255,179,0,0.1);border:1px solid rgba(255,179,0,0.3);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#E65100;">
                ⚠️ มีสินค้า <b>${noBarcodeCount} รายการ</b> ที่ยังไม่มีบาร์โค้ด
            </div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <div class="input-group">
                    <label>ขนาดสติกเกอร์</label>
                    <select id="stk-size" class="glass-input" style="height:44px;">
                        <option value="small">เล็ก — 40×22 มม.</option>
                        <option value="medium" selected>กลาง — 60×32 มม.</option>
                        <option value="large">ใหญ่ — 90×45 มม.</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>คอลัมน์ต่อหน้า</label>
                    <select id="stk-cols" class="glass-input" style="height:44px;">
                        <option value="2">2 คอลัมน์</option>
                        <option value="3" selected>3 คอลัมน์</option>
                        <option value="4">4 คอลัมน์</option>
                    </select>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;cursor:pointer;">
                    <input type="checkbox" id="stk-show-price" checked style="width:16px;height:16px;"> แสดงราคา
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;cursor:pointer;">
                    <input type="checkbox" id="stk-show-name" checked style="width:16px;height:16px;"> แสดงชื่อสินค้า
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;cursor:pointer;">
                    <input type="checkbox" id="stk-show-shop" checked style="width:16px;height:16px;"> แสดงชื่อร้าน
                </label>
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-size:12px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:8px;">
                    เลือกสินค้า (${prods.length} รายการที่มีบาร์โค้ด)
                </label>
                <div style="max-height:240px;overflow-y:auto;border:1px solid var(--glass-border);border-radius:10px;">
                    <div style="padding:8px 14px;background:var(--bg-deep);border-bottom:1px solid var(--glass-border);">
                        <label style="font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;">
                            <input type="checkbox" id="stk-select-all" onchange="stkToggleAll(this.checked)" checked>
                            เลือกทั้งหมด (${prods.length} รายการ)
                        </label>
                    </div>
                    ${prods.map((p,pi) => `
                        <div style="padding:8px 14px;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;gap:10px;background:${pi%2?'transparent':'rgba(255,255,255,0.02)'}">
                            <input type="checkbox" class="stk-prod-cb" 
                                   id="stk-cb-${pi}"
                                   data-idx="${pi}"
                                   data-barcode="${p.barcode.replace(/"/g,'&quot;')}" 
                                   data-name="${p.name.replace(/"/g,'&quot;')}" 
                                   data-price="${p.price}" checked>
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:13px;font-weight:700;line-height:1.3;">${p.name}</div>
                                <div style="font-size:11px;color:var(--text-3);margin-top:2px;">
                                    <span style="font-family:monospace;">${p.barcode}</span>
                                    &nbsp;·&nbsp;
                                    <span style="color:var(--red-neon);font-weight:700;">฿${formatNum(p.price)}</span>
                                </div>
                            </div>
                            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                                <span style="font-size:11px;color:var(--text-3);">จำนวน</span>
                                <input type="number" id="stk-qty-${pi}" value="1" min="1" max="999"
                                    class="glass-input"
                                    style="width:56px;height:34px;text-align:center;padding:0;font-size:14px;font-weight:700;">
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div style="display:flex;gap:12px;">
                <button class="btn btn-white" style="flex:1;height:48px;" onclick="closeModal()">ยกเลิก</button>
                <button class="btn btn-red" style="flex:2;height:48px;font-size:15px;" onclick="doPrintStickers()">
                    <i class="material-icons-round">print</i> พิมพ์สติกเกอร์
                </button>
            </div>
        </div>
    `;
    openModal('🏷️ พิมพ์สติกเกอร์บาร์โค้ด', content, true);
};

window.stkToggleAll = function(checked) {
    document.querySelectorAll('.stk-prod-cb').forEach(cb => cb.checked = checked);
};

window.doPrintStickers = function() {
    const selected = [...document.querySelectorAll('.stk-prod-cb:checked')].map((cb) => {
        const idx = cb.dataset.idx;
        const qty = parseInt(document.getElementById('stk-qty-' + idx)?.value) || 1;
        return { barcode: cb.dataset.barcode, name: cb.dataset.name, price: cb.dataset.price, qty };
    });
    if (selected.length === 0) { toast('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ', 'error'); return; }

    const size    = document.getElementById('stk-size').value;
    const cols    = parseInt(document.getElementById('stk-cols').value);
    const showPrc = document.getElementById('stk-show-price').checked;
    const showNm  = document.getElementById('stk-show-name').checked;
    const showShp = document.getElementById('stk-show-shop')?.checked ?? true;
    const shopName = (typeof getShopInfo === 'function') ? (getShopInfo().name || 'SK POS') : 'SK POS';

    // ขนาดสติกเกอร์ (mm)
    const dimMap = { small:[40,22], medium:[60,32], large:[90,45] };
    const [sW, sH] = dimMap[size] || dimMap.medium;

    // คำนวณ font sizes
    const fs = {
        small:  { nm:5.5, pr:7,   bc_h:14, bc_w:1.0, bc_fs:6  },
        medium: { nm:6.5, pr:8.5, bc_h:20, bc_w:1.2, bc_fs:7  },
        large:  { nm:8,   pr:10,  bc_h:28, bc_w:1.5, bc_fs:9  },
    }[size] || { nm:6.5, pr:8.5, bc_h:20, bc_w:1.2, bc_fs:7 };

    // Expand by qty
    const items = selected.flatMap(s => Array(s.qty).fill({...s}));

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast('เปิด popup ไม่ได้ กรุณาอนุญาต popup', 'error'); return; }

    win.document.write(`<!DOCTYPE html><html lang="th"><head>
        <meta charset="UTF-8">
        <title>สติกเกอร์บาร์โค้ด — ${shopName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>
          @page { margin: 5mm; size: A4; }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Sarabun', sans-serif;
            background: #f5f5f5;
            padding: 10px;
          }
          /* ── No-print toolbar ── */
          .toolbar {
            position: sticky; top: 0; z-index: 100;
            background: #fff; padding: 10px 16px;
            display: flex; align-items: center; gap: 10px;
            border-bottom: 1px solid #ddd;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border-radius: 8px; margin-bottom: 12px;
          }
          .toolbar span { font-size: 13px; color: #666; flex: 1; }
          .btn-print {
            background: #E53935; color: #fff; border: none;
            padding: 10px 28px; border-radius: 8px;
            font-family: 'Sarabun', sans-serif;
            font-size: 15px; font-weight: 700; cursor: pointer;
            display: flex; align-items: center; gap: 6px;
          }
          .btn-close {
            background: #fff; color: #333;
            border: 1px solid #ddd; padding: 10px 20px;
            border-radius: 8px; font-family: 'Sarabun', sans-serif;
            font-size: 14px; cursor: pointer;
          }
          /* ── Grid ── */
          .grid {
            display: grid;
            grid-template-columns: repeat(${cols}, ${sW}mm);
            gap: 2.5mm;
            justify-content: start;
            background: #fff;
            padding: 4mm;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          }
          /* ── Sticker Card ── */
          .sticker {
            width: ${sW}mm;
            height: ${sH}mm;
            background: #fff;
            border: 0.4mm solid #ccc;
            border-radius: 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 1.2mm 1.5mm 1mm;
            page-break-inside: avoid;
            position: relative;
            gap: 0.5mm;
          }
          /* top accent strip */
          /* shop name top */
          .sticker .sh {
            font-size: ${size==='small'?4:size==='medium'?5:6}pt;
            font-weight: 800;
            color: #fff;
            background: linear-gradient(90deg,#E53935,#B71C1C);
            width: calc(100% + 3mm);
            margin: -1.2mm -1.5mm 1mm;
            padding: 1.5px 4px;
            text-align: center;
            letter-spacing: 0.5px;
            border-radius: 2mm 2mm 0 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          /* ชื่อสินค้า */
          .sticker .nm {
            font-size: ${fs.nm}pt;
            font-weight: 700;
            color: #1a1a1a;
            text-align: center;
            line-height: 1.2;
            max-width: 100%;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            word-break: break-all;
            margin-top: 1mm;
          }
          /* บาร์โค้ด svg */
          .sticker svg {
            max-width: 100%;
            height: ${fs.bc_h}px;
            flex-shrink: 0;
          }
          /* ราคา */
          .sticker .pr {
            font-size: ${fs.pr}pt;
            font-weight: 800;
            color: #C62828;
            background: #FFEBEE;
            border: 0.3mm solid #FFCDD2;
            border-radius: 1mm;
            padding: 0.3mm 2mm;
            line-height: 1.3;
          }
          /* Print styles */
          @media print {
            body { background: #fff; padding: 0; }
            .toolbar { display: none !important; }
            .grid {
              box-shadow: none; border-radius: 0;
              padding: 0; gap: 2mm; background: #fff;
            }
            .sticker { border-color: #bbb; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
    </head><body>
        <div class="toolbar no-print">
            <span>🏷️ สติกเกอร์บาร์โค้ด — ${items.length} ดวง | ${cols} คอลัมน์</span>
            <button class="btn-close" onclick="window.close()">✕ ปิด</button>
            <button class="btn-print" onclick="window.print()">🖨️ พิมพ์</button>
        </div>
        <div class="grid" id="grid"></div>
        <script>
          var items = ${JSON.stringify(items)};
          var showNm = ${showNm};
          var showPrc = ${showPrc};
          var showShp = ${showShp};
          var shopNameStr = ${JSON.stringify(shopName)};
          var bcH = ${fs.bc_h};
          var bcW = ${fs.bc_w};
          var bcFs = ${fs.bc_fs};
          var grid = document.getElementById('grid');

          items.forEach(function(item) {
            var div = document.createElement('div');
            div.className = 'sticker';

            // ชื่อร้าน (แถบด้านบน)
            if (showShp) {
              var sh = document.createElement('div');
              sh.className = 'sh';
              sh.textContent = shopNameStr;
              div.appendChild(sh);
            }
            // ชื่อสินค้า (บนบาร์โค้ด)
            if (showNm) {
              var nm = document.createElement('div');
              nm.className = 'nm';
              nm.textContent = item.name;
              div.appendChild(nm);
            }

            // บาร์โค้ด
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            try {
              JsBarcode(svg, item.barcode, {
                format: 'CODE128',
                width: bcW,
                height: bcH,
                displayValue: true,
                fontSize: bcFs,
                margin: 2,
                background: 'transparent',
                lineColor: '#1a1a1a'
              });
            } catch(e) {
              var fb = document.createElement('div');
              fb.style.cssText = 'font-size:7pt;color:#666;text-align:center;word-break:break-all;';
              fb.textContent = item.barcode;
              div.appendChild(fb);
            }
            div.appendChild(svg);

            // ราคา
            if (showPrc) {
              var pr = document.createElement('div');
              pr.className = 'pr';
              pr.textContent = '฿' + Number(item.price).toLocaleString('th-TH');
              div.appendChild(pr);
            }

            grid.appendChild(div);
          });

          // Auto print after fonts/barcode render
          setTimeout(function() { window.print(); }, 1200);
        <\/script>
    </body></html>`);
    win.document.close();
    closeModal();
};
async function loadInventory() {
    UI.pageActions.innerHTML = `
        <button class="btn btn-red" onclick="openProductModal()">
            <i class="material-icons-round">add</i>เพิ่มสินค้า
        </button>
        <button class="btn btn-white" onclick="openStockAdjustModal()">
            <i class="material-icons-round">sync_alt</i>ปรับสต็อก
        </button>
        <button class="btn btn-white" onclick="openCategoryModal()">
            <i class="material-icons-round">label</i>จัดการหมวดหมู่
        </button>
        <button class="btn btn-white" onclick="openPrintStickerModal()" title="พิมพ์สติกเกอร์บาร์โค้ด">
            <i class="material-icons-round">label_important</i>สติกเกอร์
        </button>
    `;
    
    await refreshProducts(); // Use global cached products

    // [V3-UX-05] — สินค้าใกล้หมด/หมดขึ้นบนก่อน
    const sortedProducts = [...products].sort((a, b) => {
        const aLow = a.stock <= a.min_stock ? 0 : 1;
        const bLow = b.stock <= b.min_stock ? 0 : 1;
        if (aLow !== bLow) return aLow - bLow;
        return a.name.localeCompare(b.name, 'th');
    });

    const tbody = document.getElementById('inv-tbody');
    tbody.innerHTML = '';

    sortedProducts.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="width:40px; height:40px; border-radius:50%; background:#f1f3f5; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                    ${p.img_url ? `<img src="${p.img_url}" style="width:100%; height:100%; object-fit:cover;">` : '📦'}
                </div>
            </td>
            <td class="font-bold">${p.name}</td>
            <td>${p.barcode || '-'}</td>
            <td><span class="badge badge-blue">${p.category}</span></td>
            <td class="font-bold text-red">฿${formatNum(p.price)}</td>
            <td style="color:#666">
                ฿${formatNum(p.cost)}
                ${p.cost === 0 ? '<br><span style="color:red; font-size:11px;">⚠️ ไม่มีต้นทุน</span>' : ''}
            </td>
            <td class="${p.stock <= p.min_stock ? 'text-red font-bold' : ''}">${formatNum(p.stock)} ${p.unit}</td>
            <td>
                <button class="btn btn-white btn-icon" onclick="openProductModal('${p.id}')"><i class="material-icons-round">edit</i></button>
                <button class="btn btn-white btn-icon" onclick="deleteProduct('${p.id}')"><i class="material-icons-round">delete</i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ── Category Module ──────────────────────────────────────────────
async function openCategoryModal() {
    const { data: cats, error } = await db.from('categories').select('*').order('name');
    if (error) return toast(error.message, 'error');

    const renderList = () => {
        const rows = (cats || []).map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--glass-border);">
                <span style="font-weight:700;">${c.name}</span>
                <button class="btn btn-white btn-icon" onclick="deleteCategory('${c.id}')">
                    <i class="material-icons-round" style="color:var(--red); font-size:18px;">delete</i>
                </button>
            </div>
        `).join('');
        return rows || '<div style="text-align:center; padding:20px; color:#888;">ยังไม่มีหมวดหมู่</div>';
    };

    const content = `
        <div class="category-manager">
            <div style="margin-bottom:20px; padding:16px; background:var(--glass-sm); border-radius:12px;">
                <label style="display:block; font-size:12px; font-weight:700; color:var(--text-3); margin-bottom:8px;">เพิ่มหมวดหมู่ใหม่</label>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="new-cat-name" class="glass-input" placeholder="เช่น เครื่องดื่ม, ขนม" style="flex:1;">
                    <button class="btn btn-red" onclick="saveCategory()">เพิ่ม</button>
                </div>
            </div>
            <div style="max-height:300px; overflow-y:auto; border:1.5px solid var(--glass-border); border-radius:12px;" id="cat-modal-list">
                ${renderList()}
            </div>
        </div>
    `;

    openModal('จัดการหมวดหมู่สินค้า', content);

    window.saveCategory = async () => {
        const name = document.getElementById('new-cat-name').value.trim();
        if (!name) return toast('กรุณากรอกชื่อหมวดหมู่', 'error');
        const { error: insErr } = await db.from('categories').insert({ name });
        if (insErr) return toast(insErr.message, 'error');
        toast('เพิ่มหมวดหมู่สำเร็จ');
        openCategoryModal(); // Refresh
    };

    window.deleteCategory = async (id) => {
        const { isConfirmed } = await Swal.fire({
            title: 'ยืนยันการลบ?',
            text: 'หากมีสินค้าในหมวดหมู่นี้ จะลบไม่ได้',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'var(--red)',
            confirmButtonText: 'ลบเลย'
        });
        if (!isConfirmed) return;
        const { error: delErr } = await db.from('categories').delete().eq('id', id);
        if (delErr) return toast('ไม่สามารถลบได้ (อาจมีสินค้าอยู่ในหมวดหมู่นี้)', 'error');
        toast('ลบหมวดหมู่สำเร็จ');
        openCategoryModal(); // Refresh
    };
}

// [FIX NEW-BUG-01] — แก้ไข image field ให้ตรงกับ DB (img_url)
async function openProductModal(id = null) {
    let p = { name: '', barcode: '', category: 'ทั่วไป', price: 0, cost: 0, 
              stock: 0, min_stock: 0, unit: 'ชิ้น', note: '', img_url: '' };
    if (id) {
        const { data } = await db.from('สินค้า').select('*').eq('id', id).single();
        if (data) p = data;
    }

    const { data: cats } = await db.from('categories').select('*');
    const catOptions = cats.map(c => `<option value="${c.name}" ${p.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('');

    const content = `
        <form id="product-form">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div class="input-group">
                    <label>ชื่อสินค้า *</label>
                    <input type="text" id="p-name" value="${p.name}" required>
                </div>
                <div class="input-group">
                    <label>บาร์โค้ด</label>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <input type="text" id="p-barcode" value="${p.barcode || ''}" placeholder="สแกนหรือกรอกเอง" style="flex:1;">
                        <button type="button" class="btn btn-white" title="สแกนจากกล้อง" onclick="scanBarcodeIntoField('p-barcode')"
                            style="padding:0 12px;height:44px;flex-shrink:0;">
                            <i class="material-icons-round" style="font-size:18px;">qr_code_scanner</i>
                        </button>
                        <button type="button" class="btn btn-white" title="สร้างบาร์โค้ดอัตโนมัติ" onclick="genBarcode()"
                            style="padding:0 12px;height:44px;flex-shrink:0;">
                            <i class="material-icons-round" style="font-size:18px;">auto_awesome</i>
                        </button>
                    </div>
                    <div id="barcode-preview" style="margin-top:8px;text-align:center;${p.barcode?'':'display:none'}">
                        <svg id="barcode-svg"></svg>
                    </div>
                </div>
                <div class="input-group">
                    <label>หมวดหมู่</label>
                    <select id="p-category">${catOptions}</select>
                </div>
                <div class="input-group">
                    <label>หน่วยเรียก</label>
                    <input type="text" id="p-unit" value="${p.unit}">
                </div>
                <div class="input-group">
                    <label>ราคาขาย *</label>
                    <input type="number" id="p-price" value="${p.price}" required>
                </div>
                <div class="input-group">
                    <label>ต้นทุน</label>
                    <input type="number" id="p-cost" value="${p.cost}" placeholder="ต้นทุน/หน่วย (จำเป็น)" style="border-color: ${p.cost===0?'red':''}">
                    <div style="color:red; font-size:11px; margin-top:4px;">⚠️ ไม่กรอกต้นทุนจะทำให้รายงานกำไรไม่ถูกต้อง</div>
                </div>
                <div class="input-group">
                    <label>สต็อกปัจจุบัน</label>
                    <input type="number" id="p-stock" value="${p.stock}" ${id ? 'disabled' : ''}>
                </div>
                <div class="input-group">
                    <label>สต็อกขั้นต่ำ</label>
                    <input type="number" id="p-min-stock" value="${p.min_stock}">
                </div>
            </div>
            <div class="input-group">
                <label>รูปภาพ (Google Drive URL)</label>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="p-image-url" value="${p.img_url || ''}" style="flex-grow:1;">
                    <button type="button" class="btn btn-white" onclick="document.getElementById('p-file').click()">
                        <i class="material-icons-round">upload_file</i>
                    </button>
                    <input type="file" id="p-file" style="display:none" onchange="handleImageUpload(this)">
                </div>
            </div>
            <div class="input-group">
                <label>หมายเหตุ</label>
                <textarea id="p-note">${p.note || ''}</textarea>
            </div>
            <button type="submit" class="btn btn-red" style="width:100%; padding:14px; margin-top:10px;">
                ${id ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้าใหม่'}
            </button>
        </form>
    `;
    
    openModal(id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า', content);

    // Hook barcode preview + camera scan
    setTimeout(() => {
        const bcInp = document.getElementById('p-barcode');
        if (bcInp) {
            if (bcInp.value) renderBarcodePreview(bcInp.value);
            bcInp.addEventListener('input', e => renderBarcodePreview(e.target.value));
        }
    }, 50);
    
    document.getElementById('product-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        
        const payload = {
            name: document.getElementById('p-name').value,
            barcode: document.getElementById('p-barcode').value || null,
            category: document.getElementById('p-category').value,
            price: parseFloat(document.getElementById('p-price').value),
            cost: parseFloat(document.getElementById('p-cost').value),
            min_stock: parseInt(document.getElementById('p-min-stock').value),
            unit: document.getElementById('p-unit').value,
            note: document.getElementById('p-note').value,
            img_url: document.getElementById('p-image-url').value
        };

        if (!id) payload.stock = parseInt(document.getElementById('p-stock').value) || 0;

        try {
            if (id) {
                const { error } = await db.from('สินค้า').update(payload).eq('id', id);
                if (error) throw error;
                logAct('แก้ไขสินค้า', `แก้ไขสินค้า: ${payload.name}`);
            } else {
                const { error } = await db.from('สินค้า').insert(payload);
                if (error) throw error;
                logAct('เพิ่มสินค้า', `เพิ่มสินค้า: ${payload.name}`);
            }
            toast('ดำเนินการสำเร็จ');
            closeModal();
            loadInventory();
        } catch (err) {
            toast(err.message, 'error');
            btn.disabled = false;
        }
    };
}

async function handleImageUpload(input) {
    if (!input.files || !input.files[0]) return;
    if (GDRIVE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
        return Swal.fire('ไม่ได้ตั้งค่าระบบอัปโหลด', 'กรุณาตั้งค่า GDRIVE_SCRIPT_URL ในไฟล์ config.js ก่อนใช้งาน', 'info');
    }
    
    const file = input.files[0];
    const btn = input.previousElementSibling;
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="material-icons-round spinner">sync</i>';
    
    try {
        const url = await uploadImageToDrive(file);
        document.getElementById('p-image-url').value = url;
        toast('อัปโหลดรูปภาพสำเร็จ');
    } catch (err) {
        toast('อัปโหลดรูปภาพล้มเหลว: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
}

async function uploadImageToDrive(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result.split(',')[1];
            try {
                const res = await fetch(GDRIVE_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        fileName: Date.now() + '_' + file.name,
                        mimeType: file.type,
                        data: base64
                    })
                });
                const json = await res.json();
                resolve(json.url);
            } catch (err) { reject(err); }
        };
        reader.readAsDataURL(file);
    });
}

// [FIX BUG-10] — deleteProduct() ลบตรงโดยไม่เช็ค FK
async function deleteProduct(id) {
    // เช็ค FK ก่อน
    const { count } = await db.from('รายการในบิล')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', id);
    
    if (count > 0) {
        return Swal.fire(
            'ไม่สามารถลบได้',
            `สินค้านี้มีประวัติการขาย ${count} รายการ\nแนะนำให้ปรับสต็อกเป็น 0 แทนการลบ`,
            'warning'
        );
    }

    const { isConfirmed } = await Swal.fire({
        title: 'ยืนยันการลบสินค้า?',
        text: 'การลบจะไม่สามารถเรียกคืนได้ การตรวจสอบประวัติการขายเสร็จสิ้นแล้ว',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--red)',
        confirmButtonText: 'ลบเลย',
        cancelButtonText: 'ยกเลิก'
    });

    if (isConfirmed) {
        const { error } = await db.from('สินค้า').delete().eq('id', id);
        if (error) toast(error.message, 'error');
        else {
            toast('ลบสินค้าสำเร็จ');
            loadInventory();
        }
    }
}

function openStockAdjustModal() {
    const prodOptions = products.map(p => `<option value="${p.id}">${p.name} (ในสต็อก: ${p.stock})</option>`).join('');
    
    const content = `
        <div class="input-group">
            <label>เลือกสินค้า</label>
            <select id="adj-id">${prodOptions}</select>
        </div>
        <div class="input-group">
            <label>ประเภทการปรับ</label>
            <select id="adj-type">
                <option value="in">เพิ่มสต็อก (In)</option>
                <option value="out">ลดสต็อก (Out)</option>
                <option value="set">ปรับยอดเป็น (Set)</option>
            </select>
        </div>
        <div class="input-group">
            <label>จำนวน</label>
            <input type="number" id="adj-qty" value="1">
        </div>
        <div class="input-group">
            <label>เหตุผล</label>
            <input type="text" id="adj-note" placeholder="เช่น นับจริง, ของแถม, ของเสีย">
        </div>
        <button class="btn btn-red" id="save-adj-btn" style="width:100%; padding:14px;">ยืนยันการปรับสต็อก</button>
    `;
    
    openModal('ปรับสต็อกสินค้า', content);
    
    document.getElementById('save-adj-btn').onclick = async () => {
        const id = document.getElementById('adj-id').value;
        const type = document.getElementById('adj-type').value;
        const qty = parseInt(document.getElementById('adj-qty').value);
        const note = document.getElementById('adj-note').value;
        
        const prod = products.find(p => p.id === id);
        let newStock = prod.stock;
        let direction = 'in';
        
        if (type === 'in') { newStock += qty; direction = 'in'; }
        else if (type === 'out') { newStock -= qty; direction = 'out'; }
        else if (type === 'set') { 
            direction = qty >= prod.stock ? 'in' : 'out';
            newStock = qty; 
        }
        
        try {
            await db.from('สินค้า').update({ stock: newStock }).eq('id', id);
            await db.from('stock_movement').insert({
                product_id: id,
                product_name: prod.name,
                type: 'adjust',
                direction: direction,
                qty: Math.abs(newStock - prod.stock),
                stock_before: prod.stock,
                stock_after: newStock,
                staff_name: USER.username,
                note: note
            });
            
            logAct('ปรับสต็อก', `ปรับสต็อก ${prod.name}: ${prod.stock} -> ${newStock}`);
            toast('ปรับสต็อกสำเร็จ');
            closeModal();
            loadInventory();
        } catch (err) {
            toast(err.message, 'error');
        }
    };
}

// 9. DASHBOARD LOGIC

// ══════════════════════════════════════════════════════════════════
// 9. DASHBOARD — รายงานกำไรขาดทุน + วิเคราะห์ต้นทุน
// ══════════════════════════════════════════════════════════════════
function setDashPeriod(p, e) {
    dashPeriod = p;
    if (e) {
        document.querySelectorAll('.dash-filters .chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
    }
    const custom = document.getElementById('dash-custom-range');
    if (p === 'custom') { custom.classList.remove('hidden'); return; }
    custom.classList.add('hidden');
    loadDashboard();
}

async function loadDashboard() {
    const section = document.getElementById('page-dash');
    section.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-4);">
        <i class="material-icons-round" style="font-size:48px;animation:spin 1s linear infinite;">sync</i>
        <p style="margin-top:12px;">กำลังโหลดข้อมูล...</p></div>`;

    // ── Date range ──────────────────────────────────────────────
    const now = new Date();
    if (dashPeriod === 'today') {
        const d = new Date();
        dashStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0).toISOString();
        dashEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(),23,59,59,999).toISOString();
    } else if (dashPeriod === 'week') {
        const ws = new Date(); ws.setDate(ws.getDate()-ws.getDay()); ws.setHours(0,0,0,0);
        dashStart = ws.toISOString(); dashEnd = new Date().toISOString();
    } else if (dashPeriod === 'month') {
        dashStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        dashEnd   = new Date().toISOString();
    } else {
        dashStart = (document.getElementById('dash-start')?.value || new Date().toISOString().split('T')[0]) + 'T00:00:00.000Z';
        dashEnd   = (document.getElementById('dash-end')?.value   || new Date().toISOString().split('T')[0]) + 'T23:59:59.999Z';
    }

    const periodLabel = { today:'วันนี้', week:'สัปดาห์นี้', month:'เดือนนี้', custom:'ช่วงที่เลือก' }[dashPeriod] || 'วันนี้';

    // ── Fetch all data in parallel ───────────────────────────────
    // Step 1: fetch bills + other data concurrently
    const [
        { data: bills },
        { data: exps },
        { data: debtors },
        { data: bal },
        { data: allProds },
    ] = await Promise.all([
        db.from('บิลขาย').select('*').gte('date', dashStart).lte('date', dashEnd).eq('status','สำเร็จ'),
        db.from('รายจ่าย').select('*').gte('date', dashStart).lte('date', dashEnd),
        db.from('customer').select('debt_amount').gt('debt_amount',0),
        db.rpc('get_current_cash_balance'),
        db.from('สินค้า').select('id, name, cost'),
    ]);

    // Step 2: fetch bill items using bill IDs (Supabase does not support filtering on related table columns)
    let items = [];
    if (bills && bills.length > 0) {
        const billIds = bills.map(b => b.id);
        const { data: itemsData } = await db.from('รายการในบิล')
            .select('id, name, qty, price, cost, total')
            .in('bill_id', billIds);
        items = itemsData || [];
    }

    const zeroCostCount = (allProds?.length) ? allProds.filter(i => !i.cost || i.cost === 0).length : 0;
    const costAlert = zeroCostCount > 0 ? `
        <div class="card" style="background:#FFF3E0; border:1.5px solid #FFB74D; padding:16px; margin-bottom:20px; display:flex; align-items:center; gap:16px; border-radius:12px; cursor:pointer;" onclick="go('inv')">
            <div style="font-size:32px;">⚠️</div>
            <div>
                <div style="font-size:15px; font-weight:800; color:#E65100;">มีสินค้า ${zeroCostCount} รายการที่ไม่มีต้นทุน</div>
                <div style="font-size:13px; color:#666;">การแสดงรายงานกำไรอาจไม่ถูกต้อง กรุณาเข้าตรวจสอบและกรอกต้นทุนให้ครบถ้วน</div>
            </div>
            <i class="material-icons-round" style="margin-left:auto; color:#FFB74D;">chevron_right</i>
        </div>
    ` : '';

    // ── Core calculations ────────────────────────────────────────
    const salesTotal   = (bills  || []).reduce((s,b) => s + b.total, 0);
    const expenseTotal = (exps   || []).reduce((s,e) => s + e.amount, 0);
    const debtTotal    = (debtors|| []).reduce((s,d) => s + d.debt_amount, 0);
    const billCount    = (bills  || []).length;
    const avgBill      = billCount > 0 ? Math.round(salesTotal / billCount) : 0;

    // Gross profit (revenue - COGS)
    const grossProfit  = (items  || []).reduce((s,i) => s + (i.total - ((i.cost||0) * i.qty)), 0);

    // Net profit = gross profit - expenses
    const netProfit    = grossProfit - expenseTotal;
    const grossMargin  = salesTotal > 0 ? ((grossProfit / salesTotal) * 100).toFixed(1) : 0;
    const netMargin    = salesTotal > 0 ? ((netProfit   / salesTotal) * 100).toFixed(1) : 0;
    const cogsTotal    = (items  || []).reduce((s,i) => s + ((i.cost||0) * i.qty), 0);

    // ── Product profit table ─────────────────────────────────────
    const prodMap = {};
    (items || []).forEach(i => {
        if (!prodMap[i.name]) prodMap[i.name] = { name:i.name, qty:0, revenue:0, cogs:0 };
        prodMap[i.name].qty     += i.qty;
        prodMap[i.name].revenue += i.total;
        prodMap[i.name].cogs    += ((i.cost||0) * i.qty);
    });
    const prodList = Object.values(prodMap)
        .map(p => ({ ...p, profit: p.revenue - p.cogs, margin: p.revenue > 0 ? ((p.revenue-p.cogs)/p.revenue*100) : 0 }))
        .sort((a,b) => b.profit - a.profit);

    // ── Expense breakdown ────────────────────────────────────────
    const expCats = {};
    (exps || []).forEach(e => {
        expCats[e.category] = (expCats[e.category] || 0) + e.amount;
    });
    const expList = Object.entries(expCats).sort((a,b) => b[1]-a[1]);

    // ── Build page HTML ──────────────────────────────────────────
    section.innerHTML = `
        ${costAlert}
        <!-- Filter bar -->
        <div class="dash-filters" style="display:flex; gap:10px; margin-bottom:24px; flex-wrap:wrap; align-items:center;">
            <button class="chip ${dashPeriod==='today'?'active':''}"  onclick="setDashPeriod('today',event)">วันนี้</button>
            <button class="chip ${dashPeriod==='week'?'active':''}"   onclick="setDashPeriod('week',event)">สัปดาห์นี้</button>
            <button class="chip ${dashPeriod==='month'?'active':''}"  onclick="setDashPeriod('month',event)">เดือนนี้</button>
            <button class="chip ${dashPeriod==='custom'?'active':''}" onclick="setDashPeriod('custom',event)">กำหนดเอง</button>
            <div id="dash-custom-range" class="${dashPeriod==='custom'?'':'hidden'}" style="display:flex;align-items:center;gap:8px;">
                <input type="date" id="dash-start" class="glass-input" style="height:38px;padding:0 12px;">
                <span style="color:var(--text-3);">–</span>
                <input type="date" id="dash-end" class="glass-input" style="height:38px;padding:0 12px;">
                <button class="btn btn-red" style="height:38px;padding:0 16px;" onclick="loadDashboard()">ตกลง</button>
            </div>
            <button class="btn btn-white" style="margin-left:auto;" onclick="exportDashboardPDF()">
                <i class="material-icons-round">picture_as_pdf</i> PDF
            </button>
        </div>

        <!-- ── KPI Cards Row 1 ── -->
        <div class="dash-kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px; margin-bottom:24px;">
            ${dashKPI('payments','ยอดขาย',periodLabel,'฿'+formatNum(salesTotal),'#C62828','#FFF5F5')}
            ${dashKPI('shopping_cart','ต้นทุนสินค้า (COGS)',periodLabel,'฿'+formatNum(cogsTotal),'#E65100','#FFF3E0')}
            ${dashKPI('trending_up','กำไรขั้นต้น',periodLabel,'฿'+formatNum(grossProfit)+' ('+grossMargin+'%)','#2E7D32','#E8F5E9')}
            ${dashKPI('receipt_long','ค่าใช้จ่าย',periodLabel,'฿'+formatNum(expenseTotal),'#6A1B9A','#F3E5F5')}
            ${dashKPI('account_balance','กำไรสุทธิ',periodLabel,'฿'+formatNum(netProfit)+' ('+netMargin+'%)', netProfit>=0?'#1565C0':'#B71C1C', netProfit>=0?'#E3F2FD':'#FFEBEE')}
            ${dashKPI('account_balance_wallet','เงินสดในลิ้นชัก','ปัจจุบัน','฿'+formatNum(bal||0),'#00695C','#E0F2F1')}
            ${dashKPI('people','ลูกหนี้คงค้าง','ทั้งหมด','฿'+formatNum(debtTotal),'#AD1457','#FCE4EC')}
            ${dashKPI('bar_chart','จำนวนบิล',periodLabel,formatNum(billCount)+' บิล','#37474F','#ECEFF1')}
        </div>

        <!-- ── P&L Summary ── -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px;">

            <!-- Profit Waterfall -->
            <div class="card" style="padding:24px;">
                <div style="font-size:14px; font-weight:800; color:var(--text-1); margin-bottom:20px; display:flex; align-items:center; gap:8px;">
                    <i class="material-icons-round" style="color:var(--primary);">waterfall_chart</i>
                    สรุปกำไร-ขาดทุน (${periodLabel})
                </div>
                ${dashWaterfallRow('💰','ยอดขายรวม',salesTotal,salesTotal,'revenue')}
                ${dashWaterfallRow('📦','หัก: ต้นทุนสินค้า (COGS)',-cogsTotal,salesTotal,'cost')}
                ${dashWaterfallDivider('กำไรขั้นต้น (Gross Profit)',grossProfit,grossMargin+'%')}
                ${dashWaterfallRow('💸','หัก: ค่าใช้จ่าย',-expenseTotal,salesTotal,'expense')}
                ${dashWaterfallTotal('กำไรสุทธิ (Net Profit)',netProfit,netMargin+'%')}
            </div>

            <!-- Expense breakdown donut-style -->
            <div class="card" style="padding:24px;">
                <div style="font-size:14px; font-weight:800; color:var(--text-1); margin-bottom:20px; display:flex; align-items:center; gap:8px;">
                    <i class="material-icons-round" style="color:#6A1B9A;">pie_chart</i>
                    รายจ่ายแยกหมวด (${periodLabel})
                </div>
                ${expList.length > 0 ? expList.map(([cat, amt], i) => {
                    const pct = expenseTotal > 0 ? (amt/expenseTotal*100).toFixed(1) : 0;
                    const colors = ['#C62828','#6A1B9A','#E65100','#1565C0','#2E7D32','#37474F'];
                    const c = colors[i % colors.length];
                    return `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                        <div style="width:12px;height:12px;border-radius:3px;background:${c};flex-shrink:0;"></div>
                        <div style="flex:1; font-size:13px; font-weight:600; color:var(--text-1);">${cat}</div>
                        <div style="font-size:13px; font-weight:700; color:${c};">฿${formatNum(amt)}</div>
                        <div style="font-size:11px; color:var(--text-4); width:36px; text-align:right;">${pct}%</div>
                    </div>
                    <div style="height:6px;background:var(--glass-md);border-radius:4px;margin-bottom:4px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:${c};border-radius:4px;transition:width 0.8s var(--ease-lux);"></div>
                    </div>`;
                }).join('') : '<div style="text-align:center;padding:40px;color:var(--text-4);">ไม่มีรายจ่ายในช่วงนี้</div>'}
            </div>
        </div>

        <!-- ── Product Profit Table ── -->
        <div class="card" style="padding:24px; margin-bottom:24px;">
            <div style="font-size:14px; font-weight:800; color:var(--text-1); margin-bottom:20px; display:flex; align-items:center; gap:8px;">
                <i class="material-icons-round" style="color:var(--primary);">table_chart</i>
                กำไรต่อสินค้า — ราคาขาย vs ต้นทุน (${periodLabel})
            </div>
            ${prodList.length > 0 ? `
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:linear-gradient(135deg,#C62828,#B71C1C);">
                            <th style="padding:12px 14px;color:#FFF;font-weight:800;text-align:left;border-radius:8px 0 0 0;">สินค้า</th>
                            <th style="padding:12px 14px;color:#FFF;font-weight:800;text-align:right;">จำนวน</th>
                            <th style="padding:12px 14px;color:#FFF;font-weight:800;text-align:right;">ยอดขาย</th>
                            <th style="padding:12px 14px;color:#FFF;font-weight:800;text-align:right;">ต้นทุนรวม</th>
                            <th style="padding:12px 14px;color:#FFF;font-weight:800;text-align:right;">กำไร</th>
                            <th style="padding:12px 14px;color:#FFF;font-weight:800;text-align:center;border-radius:0 8px 0 0;">Margin%</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${prodList.map((p,i) => {
                        const marginColor = p.margin >= 30 ? '#2E7D32' : p.margin >= 15 ? '#E65100' : '#C62828';
                        const bg = i % 2 === 0 ? '' : 'background:rgba(0,0,0,0.02);';
                        const barWidth = prodList[0].profit > 0 ? Math.max(0, (p.profit / prodList[0].profit * 100)).toFixed(0) : 0;
                        return `
                        <tr style="${bg} transition:background 0.15s;" onmouseover="this.style.background='rgba(198,40,40,0.04)'" onmouseout="this.style.background='${i%2===0?'':'rgba(0,0,0,0.02)'}'">
                            <td style="padding:10px 14px; font-weight:700; color:var(--text-1);">
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <span style="width:20px;height:20px;background:linear-gradient(135deg,#C62828,#B71C1C);color:#FFF;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0;">${i+1}</span>
                                    ${p.name}
                                </div>
                            </td>
                            <td style="padding:10px 14px; text-align:right; color:var(--text-2); font-weight:600;">${formatNum(p.qty)} ชิ้น</td>
                            <td style="padding:10px 14px; text-align:right; font-weight:700; color:var(--text-1);">฿${formatNum(p.revenue)}</td>
                            <td style="padding:10px 14px; text-align:right; color:#E65100; font-weight:600;">฿${formatNum(p.cogs)}</td>
                            <td style="padding:10px 14px; text-align:right; font-weight:800; color:${p.profit>=0?'#2E7D32':'#C62828'};">
                                ฿${formatNum(p.profit)}
                                <div style="height:4px;background:rgba(0,0,0,0.06);border-radius:2px;margin-top:4px;overflow:hidden;">
                                    <div style="height:100%;width:${barWidth}%;background:${p.profit>=0?'#2E7D32':'#C62828'};border-radius:2px;"></div>
                                </div>
                            </td>
                            <td style="padding:10px 14px; text-align:center;">
                                <span style="background:${marginColor}18;color:${marginColor};border:1px solid ${marginColor}40;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;">${p.margin.toFixed(1)}%</span>
                            </td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background:linear-gradient(135deg,rgba(198,40,40,0.08),rgba(198,40,40,0.04)); border-top:2px solid rgba(198,40,40,0.2);">
                            <td style="padding:12px 14px; font-weight:800; color:var(--text-1);">รวมทั้งหมด</td>
                            <td style="padding:12px 14px; text-align:right; font-weight:800;">${formatNum(prodList.reduce((s,p)=>s+p.qty,0))} ชิ้น</td>
                            <td style="padding:12px 14px; text-align:right; font-weight:800; color:var(--primary);">฿${formatNum(salesTotal)}</td>
                            <td style="padding:12px 14px; text-align:right; font-weight:800; color:#E65100;">฿${formatNum(cogsTotal)}</td>
                            <td style="padding:12px 14px; text-align:right; font-weight:800; color:${grossProfit>=0?'#2E7D32':'#C62828'};">฿${formatNum(grossProfit)}</td>
                            <td style="padding:12px 14px; text-align:center;"><span style="font-weight:800; color:var(--primary);">${grossMargin}%</span></td>
                        </tr>
                    </tfoot>
                </table>
            </div>` : '<div style="text-align:center;padding:40px;color:var(--text-4);"><i class="material-icons-round" style="font-size:48px;opacity:0.3;">inventory_2</i><p style="margin-top:12px;">ยังไม่มีข้อมูลการขาย</p></div>'}
        </div>

        <!-- ── Top 10 by Sales Volume ── -->
        <div class="card" style="padding:24px;">
            <div style="font-size:14px; font-weight:800; color:var(--text-1); margin-bottom:20px; display:flex; align-items:center; gap:8px;">
                <i class="material-icons-round" style="color:#E65100;">leaderboard</i>
                Top 10 สินค้าขายดี — ปริมาณ (${periodLabel})
            </div>
            ${prodList.slice(0,10).map((p, i) => {
                const maxQty = prodList[0]?.qty || 1;
                const pct = (p.qty / maxQty * 100).toFixed(0);
                const colors = ['#C62828','#D32F2F','#E53935','#E65100','#F57C00','#F9A825','#FBC02D','#AFB42B','#7CB342','#43A047'];
                return `
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
                    <div style="width:24px; text-align:center; font-size:12px; font-weight:800; color:${colors[i]}; flex-shrink:0;">${i+1}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; font-weight:700; color:var(--text-1); margin-bottom:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                        <div style="height:8px; background:rgba(0,0,0,0.06); border-radius:4px; overflow:hidden;">
                            <div style="width:${pct}%; height:100%; background:${colors[i]}; border-radius:4px; transition:width 0.9s var(--ease-lux);"></div>
                        </div>
                    </div>
                    <div style="text-align:right; flex-shrink:0; min-width:80px;">
                        <div style="font-size:13px; font-weight:800; color:${colors[i]};">${formatNum(p.qty)} ชิ้น</div>
                        <div style="font-size:11px; color:var(--text-4);">฿${formatNum(p.revenue)}</div>
                    </div>
                </div>`;
            }).join('') || '<div style="text-align:center;padding:24px;color:var(--text-4);">ไม่มีข้อมูล</div>'}
        </div>
    `;
}

// ── KPI Card helper ──────────────────────────────────────────────
function dashKPI(icon, label, sub, value, color, bg) {
    return `
    <div class="card" style="padding:20px; border-left:4px solid ${color}; background:${bg}; transition:all 0.2s;" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px ${color}33'" onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="display:flex; align-items:flex-start; gap:12px;">
            <div style="width:40px;height:40px;background:${color}18;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="material-icons-round" style="color:${color};font-size:20px;">${icon}</i>
            </div>
            <div style="min-width:0;">
                <div style="font-size:11px;font-weight:700;color:#777;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
                <div style="font-size:11px;color:#AAA;margin-bottom:4px;">${sub}</div>
                <div style="font-size:18px;font-weight:900;color:${color};line-height:1;">${value}</div>
            </div>
        </div>
    </div>`;
}

// ── P&L Waterfall helpers ────────────────────────────────────────
function dashWaterfallRow(emoji, label, amount, base, type) {
    const colorMap = { revenue:'#1565C0', cost:'#E65100', expense:'#6A1B9A' };
    const c = colorMap[type] || '#333';
    const pct = base > 0 ? Math.abs(amount / base * 100).toFixed(1) : 0;
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed rgba(0,0,0,0.06);">
        <span style="font-size:18px;width:28px;text-align:center;">${emoji}</span>
        <div style="flex:1;"><div style="font-size:13px;font-weight:600;color:var(--text-2);">${label}</div></div>
        <div style="font-size:14px;font-weight:800;color:${c};">฿${formatNum(Math.abs(amount))}</div>
        <div style="font-size:11px;color:#AAA;width:40px;text-align:right;">${pct}%</div>
    </div>`;
}
function dashWaterfallDivider(label, value, pct) {
    const c = value >= 0 ? '#2E7D32' : '#C62828';
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;background:${c}10;border-radius:8px;margin:4px 0;padding-left:10px;">
        <span style="font-size:18px;width:28px;text-align:center;">📊</span>
        <div style="flex:1;font-size:13px;font-weight:700;color:${c};">${label}</div>
        <div style="font-size:16px;font-weight:900;color:${c};">฿${formatNum(value)}</div>
        <div style="font-size:11px;color:${c};width:40px;text-align:right;font-weight:700;">${pct}</div>
    </div>`;
}
function dashWaterfallTotal(label, value, pct) {
    const c = value >= 0 ? '#1565C0' : '#C62828';
    const bg = value >= 0 ? '#E3F2FD' : '#FFEBEE';
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:14px;background:${bg};border-radius:10px;margin-top:8px;border:2px solid ${c}40;">
        <span style="font-size:22px;width:28px;text-align:center;">${value>=0?'🏆':'⚠️'}</span>
        <div style="flex:1;font-size:14px;font-weight:800;color:${c};">${label}</div>
        <div style="font-size:22px;font-weight:900;color:${c};">฿${formatNum(value)}</div>
        <div style="font-size:12px;color:${c};width:44px;text-align:right;font-weight:800;">${pct}</div>
    </div>`;
}

async function exportDashboardPDF() {
    if (!window.jspdf) return toast('ไลบรารี PDF ยังโหลดไม่เสร็จ', 'error');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const periodLabel = { today:'วันนี้', week:'สัปดาห์นี้', month:'เดือนนี้', custom:'ช่วงที่เลือก' }[dashPeriod] || 'วันนี้';

    // ดึงข้อมูลใหม่
    const [{ data: bills }, { data: items }, { data: exps }] = await Promise.all([
        db.from('บิลขาย').select('*').gte('date', dashStart).lte('date', dashEnd).eq('status','สำเร็จ'),
        db.from('รายการในบิล').select('*').gte('created_at', dashStart).lte('created_at', dashEnd),
        db.from('รายจ่าย').select('*').gte('date', dashStart).lte('date', dashEnd),
    ]);

    const salesTotal   = (bills||[]).reduce((s,b)=>s+b.total,0);
    const expenseTotal = (exps||[]).reduce((s,e)=>s+e.amount,0);
    const grossProfit  = (items||[]).reduce((s,i)=>s+(i.total-(i.cost*i.qty)),0);
    const netProfit    = grossProfit - expenseTotal;

    // Header
    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.text('SK POS — รายงานสรุปผล', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica','normal');
    doc.text(`ช่วงเวลา: ${periodLabel}`, 14, 26);
    doc.text(`วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}`, 14, 32);

    // KPI table
    if (doc.autoTable) {
        doc.autoTable({
            head: [['รายการ', 'จำนวน']],
            body: [
                ['ยอดขายรวม', `฿${salesTotal.toLocaleString('th-TH')}`],
                ['จำนวนบิล', `${(bills||[]).length} บิล`],
                ['ค่าใช้จ่ายรวม', `฿${expenseTotal.toLocaleString('th-TH')}`],
                ['กำไรขั้นต้น', `฿${grossProfit.toLocaleString('th-TH')}`],
                ['กำไรสุทธิ', `฿${netProfit.toLocaleString('th-TH')}`],
            ],
            startY: 38,
            styles: { font: 'helvetica', fontSize: 11 },
            headStyles: { fillColor: [211, 47, 47] },
        });
    }

    doc.save(`profit_report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast('ส่งออก PDF สำเร็จ');
}



// 10. EXPENSE LOGIC
// [FIX BUG-01] — Rename loadExpenseLuxury to loadExpense
async function loadExpense() {
    UI.pageActions.innerHTML = `<button class="btn btn-red" onclick="openExpenseModal()"><i class="material-icons-round">add</i>บันทึกรายจ่าย</button>`;
    
    const { data, error } = await db.from('รายจ่าย').select('*').order('date', { ascending: false });
    if (error) { toast(error.message, 'error'); return; }
    const section = document.getElementById('page-exp');
    
    section.innerHTML = `
        <div class="table-container">
            <table>
                <thead><tr><th>วันที่</th><th>รายละเอียด</th><th>หมวดหมู่</th><th>วิธีชำระ</th><th>จำนวน</th><th>ผู้บันทึก</th><th>จัดการ</th></tr></thead>
                <tbody>
                    ${data?.map(e => `
                        <tr>
                            <td>${formatDate(e.date)} ${formatTime(e.date)}</td>
                            <td class="font-bold">${e.description}</td>
                            <td><span class="badge badge-amber">${e.category}</span></td>
                            <td>${e.method}</td>
                            <td class="font-bold text-red">฿${formatNum(e.amount)}</td>
                            <td>${e.staff_name}</td>
                            <td><button class="btn btn-white btn-icon" onclick="deleteExpense('${e.id}')"><i class="material-icons-round">delete</i></button></td>
                        </tr>
                    `).join('') || '<tr><td colspan="7" style="text-align:center; color:#999;">ไม่พบข้อมูลรายจ่าย</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function openExpenseModal() {
    const cats = ['ทั่วไป','ค่าสาธารณูปโภค','ค่าซ่อมบำรุง','ค่าขนส่ง','เงินเดือน/เบิก','ค่าอาหาร','อื่นๆ'];
    const content = `
        <div style="padding:4px 0;">
            <div class="exp-form-group">
                <label class="exp-label">📝 รายละเอียดรายจ่าย *</label>
                <input type="text" id="e-desc" class="glass-input"
                       placeholder="เช่น ค่าไฟ, ซื้อสินค้า, ค่าซ่อม..."
                       style="font-size:16px;height:52px;">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
                <div class="exp-form-group">
                    <label class="exp-label">🏷️ หมวดหมู่</label>
                    <select id="e-cat" class="glass-input" style="height:48px;font-size:14px;padding:0 14px;">
                        ${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div class="exp-form-group">
                    <label class="exp-label">📋 หมายเหตุ</label>
                    <input type="text" id="e-note" class="glass-input" placeholder="(ไม่บังคับ)" style="height:48px;">
                </div>
            </div>

            <div style="margin-top:16px;">
                <label class="exp-label">💳 วิธีชำระ</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
                    <div id="exp-method-cash" class="exp-method-btn active" onclick="selectExpMethod('เงินสด')">
                        <i class="material-icons-round" style="color:#4CAF50;font-size:22px;">payments</i>
                        <span>เงินสด</span>
                    </div>
                    <div id="exp-method-transfer" class="exp-method-btn" onclick="selectExpMethod('โอน')">
                        <i class="material-icons-round" style="color:#2196F3;font-size:22px;">account_balance</i>
                        <span>โอนเงิน</span>
                    </div>
                </div>
                <input type="hidden" id="e-method" value="เงินสด">
            </div>

            <div style="margin-top:20px;">
                <label class="exp-label">💰 ยอดรายจ่าย *</label>
                <div style="position:relative;margin-top:8px;">
                    <span style="position:absolute;left:18px;top:50%;transform:translateY(-50%);font-size:24px;font-weight:900;color:var(--text-3);">฿</span>
                    <input type="number" id="e-amount" class="glass-input"
                           style="font-size:32px;font-weight:900;text-align:right;padding:16px 20px 16px 52px;height:72px;color:var(--primary-dark);border-width:2px;"
                           placeholder="0" min="1" step="1" oninput="this.style.borderColor=this.value>0?'var(--primary)':''">
                </div>
                <div class="exp-quick-row">
                    ${[100,200,500,1000,2000,5000].map(v=>`
                        <button class="exp-quick-btn" onclick="addExpAmt(${v})">+฿${v.toLocaleString()}</button>
                    `).join('')}
                </div>
            </div>

            <div style="display:flex;gap:12px;margin-top:24px;">
                <button class="btn btn-white" style="flex:1;" onclick="closeModal()">ยกเลิก</button>
                <button class="btn btn-red" style="flex:2;height:54px;font-size:16px;font-weight:800;" onclick="confirmExpenseForm()">
                    <i class="material-icons-round">add_circle</i> เพิ่มรายจ่าย
                </button>
            </div>
        </div>
    `;
    openModal('💸 บันทึกรายจ่าย', content);
    setTimeout(() => document.getElementById('e-desc')?.focus(), 100);
}

window.selectExpMethod = function(method) {
    document.getElementById('e-method').value = method;
    document.getElementById('exp-method-cash').classList.toggle('active', method === 'เงินสด');
    document.getElementById('exp-method-transfer').classList.toggle('active', method === 'โอน');
};

window.addExpAmt = function(v) {
    const inp = document.getElementById('e-amount');
    if (!inp) return;
    inp.value = (parseFloat(inp.value) || 0) + v;
    inp.style.borderColor = 'var(--primary)';
};

window.confirmExpenseForm = function() {
    const desc   = document.getElementById('e-desc')?.value?.trim();
    const amount = parseFloat(document.getElementById('e-amount')?.value);
    const method = document.getElementById('e-method')?.value || 'เงินสด';
    const cat    = document.getElementById('e-cat')?.value || 'ทั่วไป';
    const note   = document.getElementById('e-note')?.value || '';

    if (!desc) { document.getElementById('e-desc').focus(); return toast('กรุณากรอกรายละเอียด', 'error'); }
    if (!amount || amount <= 0) { document.getElementById('e-amount').focus(); return toast('กรุณาระบุยอดเงิน', 'error'); }

    closeModal();

    if (method === 'เงินสด') {
        // Step 1: นับเงินที่จ่ายออกจากลิ้นชัก (mode=expense, >=amount)
        openBnOverlay(amount, 'expense', (paidAmt, paidDenoms) => {
            if (paidAmt < amount) {
                Swal.fire('ยอดเงินไม่พอ', `รายจ่าย ฿${formatNum(amount)} แต่ระบุเงินจ่ายเพียง ฿${formatNum(paidAmt)}`, 'error')
                    .then(() => openExpenseModal());
                return;
            }
            const changeBack = paidAmt - amount;
            if (changeBack > 0) {
                // Step 2: นับเงินทอนกลับเข้าลิ้นชัก (mode=return, ต้องพอดี)
                openBnOverlay(changeBack, 'return', async (recBack, changeDenoms) => {
                    await saveExpense(desc, amount, method, cat, note, paidDenoms);
                    Swal.fire('✅ เรียบร้อย', `จ่าย ฿${formatNum(paidAmt)} · รายจ่าย ฿${formatNum(amount)} · ทอน ฿${formatNum(changeBack)}`, 'success');
                });
            } else {
                saveExpense(desc, amount, method, cat, note, paidDenoms);
            }
        });
    } else {
        saveExpense(desc, amount, method, cat, note, null);
    }
};

async function saveExpense(description, amount, method, category, note, denominations) {
    const payload = { description, amount, method, category, note, staff_name: USER.username, denominations };
    const { error } = await db.from('รายจ่าย').insert(payload);
    if (error) toast(error.message, 'error');
    else { toast('บันทึกรายจ่ายสำเร็จ'); closeModal(); loadExpense(); updateGlobalBalance(); }
}

async function deleteExpense(id) {
    if (confirm('ยืนยันการลบรายการนี้?')) {
        await db.from('รายจ่าย').delete().eq('id', id);
        loadExpense();
        toast('ลบรายการสำเร็จ');
    }
}

// 11. DEBT LOGIC
async function loadDebt() {
    UI.pageActions.innerHTML = `<button class="btn btn-red" onclick="openDebtorModal()"><i class="material-icons-round">person_add</i>เพิ่มลูกหนี้</button>`;
    
    // ดึงเฉพาะลูกค้าที่มีหนี้ค้าง
    const { data, error } = await db.from('customer').select('*').gt('debt_amount', 0).order('debt_amount', { ascending: false });
    if (error) { toast(error.message, 'error'); return; }
    const section = document.getElementById('page-debt');
    
    const totalDebt = data ? data.reduce((sum, d) => sum + d.debt_amount, 0) : 0;
    
    section.innerHTML = `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center; background:var(--red-light); border:none;">
            <div><div class="label" style="color:var(--red); font-weight:700; margin-bottom:5px;">ยอดหนี้รวมทั้งหมด (Debtors)</div><div class="value" style="font-size:32px; color:var(--red); font-weight:800;">฿${formatNum(totalDebt)}</div></div>
            <i class="material-icons-round" style="font-size:48px; color:var(--red); opacity:0.3;">supervised_user_circle</i>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:20px;">
            ${data?.map(d => `
                <div class="card">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <div><div style="font-weight:800; font-size:18px;">${d.name}</div><div style="color:#666; font-size:13px;">📞 ${d.phone || '-'}</div></div>
                        <div style="text-align:right;"><div style="font-size:12px; font-weight:600; color:#999;">ยอดค้างชำระ</div><div style="font-size:20px; font-weight:800; color:var(--red);">฿${formatNum(d.debt_amount)}</div></div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-red" style="flex-grow:1;" onclick="openPayDebtModal('${d.id}')">รับชำระหนี้</button>
                        <button class="btn btn-white" onclick="viewDebtHistory('${d.id}')">ประวัติ</button>
                    </div>
                </div>
            `).join('') || '<p style="text-align:center; color:#999; grid-column: 1/-1;">ไม่มีข้อมูลลูกหนี้ที่มียอดค้าง</p>'}
        </div>
    `;
}

function openDebtorModal() {
    const content = `
        <form id="debtor-form">
            <div class="input-group"><label>ชื่อ-นามสกุล *</label><input type="text" id="d-name" required></div>
            <div class="input-group"><label>เบอร์โทรศัพท์</label><input type="text" id="d-phone"></div>
            <div class="input-group"><label>ที่อยู่</label><textarea id="d-address"></textarea></div>
            <button type="submit" class="btn btn-red" style="width:100%; padding:14px; margin-top:10px;">เพิ่มลูกหนี้</button>
        </form>
    `;
    openModal('เพิ่มลูกหนี้ใหม่', content);
    document.getElementById('debtor-form').onsubmit = async (e) => {
        e.preventDefault();
        const payload = { name: document.getElementById('d-name').value, phone: document.getElementById('d-phone').value, address: document.getElementById('d-address').value };
        await db.from('customer').insert(payload);
        toast('เพิ่มลูกหนี้สำเร็จ'); closeModal(); loadDebt();
    };
}

async function openPayDebtModal(id) {
    const { data: d } = await db.from('customer').select('*').eq('id', id).single();
    const content = `
        <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:14px; color:#666;">คุณกำลังรับชำระของ</div>
            <div style="font-size:20px; font-weight:800;">${d.name}</div>
            <div style="font-size:24px; font-weight:800; color:var(--red); margin-top:5px;">ค้างชำระ: ฿${formatNum(d.debt_amount)}</div>
        </div>
        <form id="pay-debt-form">
            <div class="input-group"><label>จำนวนเงินที่ชำระ *</label><input type="number" id="pd-amount" max="${d.debt_amount}" value="${d.debt_amount}" required></div>
            <div class="input-group"><label>วิธีชำระ</label><select id="pd-method"><option value="เงินสด">เงินสด</option><option value="โอน">เงินโอน</option></select></div>
            <div class="input-group"><label>หมายเหตุ</label><input type="text" id="pd-note"></div>
            <button type="submit" class="btn btn-red" style="width:100%; padding:14px; margin-top:10px;">บันทึกการชำระหนี้</button>
        </form>
    `;
    openModal('รับชำระหนี้', content);
    document.getElementById('pay-debt-form').onsubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(document.getElementById('pd-amount').value);
        const method = document.getElementById('pd-method').value;
        const note = document.getElementById('pd-note').value;
        
        if (amt > d.debt_amount) return toast('จำนวนเงินเกินยอดค้างชำระ', 'error');

        if (method === 'เงินสด') {
            closeModal();
            openCashCalculator(`รับเงินสดชำระหนี้: ฿${formatNum(amt)}`, async (rec, n, denoms) => {
                await processDebtPayment(id, amt, method, note, denoms);
            }, amt);
        } else {
            await processDebtPayment(id, amt, method, note, null);
        }
    };
}

async function processDebtPayment(id, amt, method, note, denominations) {
    const { data: d } = await db.from('customer').select('name').eq('id', id).single();
    const { error } = await db.from('ชำระหนี้').insert({
        debtor_id: id,
        amount: amt,
        method: method,
        note: note,
        staff_name: USER.username,
        denominations: denominations
    });
    
    if (error) {
        toast(error.message, 'error');
    } else {
        toast('รับชำระหนี้สำเร็จ'); 
        closeModal(); 
        loadDebt();
        logAct('รับชำระหนี้', `รับชำระจาก ${d.name} จำนวน ${amt}`);
        updateGlobalBalance();
    }
}

async function viewDebtHistory(id) {
    const { data: d } = await db.from('customer').select('*').eq('id', id).single();
    const { data: history } = await db.from('ชำระหนี้').select('*').eq('debtor_id', id).order('date', { ascending: false });
    
    const content = `
        <div style="margin-bottom:20px;">
            <div style="font-weight:800; font-size:18px;">${d.name}</div>
            <p style="color:#666; font-size:13px;">${d.address || 'ไม่มีข้อมูลที่อยู่'}</p>
        </div>
        <div class="table-container">
            <table>
                <thead><tr><th>วันที่</th><th>จำนวน</th><th>วิธีชำระ</th><th>หมายเหตุ</th></tr></thead>
                <tbody>
                    ${history?.map(h => `<tr><td>${formatDate(h.date)}</td><td class="font-bold text-green">฿${formatNum(h.amount)}</td><td>${h.method}</td><td>${h.note || '-'}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;">ไม่พบประวัติชำระ</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
    openModal('ประวัติการชำระหนี้', content);
}

// 12. CASH DRAWER LOGIC

async function loadCash() {
    const { data: bal } = await db.rpc('get_current_cash_balance');
    const { data: sessions } = await db.from('cash_session').select('*').order('opened_at', { ascending: false }).limit(1);
    const session = sessions?.[0];
    const section = document.getElementById('page-cash');

    UI.pageActions.innerHTML = `<button class="btn btn-white" onclick="openCashAdjustModal()"><i class="material-icons-round">edit</i>ปรับยอดเงินสด</button>`;

    let sessionHtml = '';
    if (!session || session.status === 'closed') {
        sessionHtml = `
            <div class="card" style="text-align:center; padding:40px; background:var(--glass-sm); border:1px solid var(--glass-border);">
                <i class="material-icons-round" style="font-size:64px; color:var(--text-4);">lock</i>
                <h3 style="color:var(--text-1); margin-top:20px;">ลิ้นชักถูกปิดอยู่</h3>
                <p style="color:var(--text-3); margin-bottom:24px;">กรุณาเปิดกะเพื่อเริ่มต้นการรับเงินสด</p>
                <div style="max-width:300px; margin:0 auto;">
                    <button class="btn btn-red" style="width:100%;" onclick="openCashSession()">เปิดกะใหม่ (นับเงินเริ่มต้น)</button>
                </div>
            </div>
        `;
    } else {
        sessionHtml = `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; background:var(--red-subtle); border:1px solid var(--red-mid); margin-bottom:20px; padding: 24px;">
                <div>
                    <div class="label" style="color:var(--red-neon); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">เงินสดในลิ้นชักขณะนี้</div>
                    <div class="value" style="font-size:36px; color:var(--text-1); font-weight:900; text-shadow: 0 0 20px var(--red-glow);">฿${formatNum(bal || 0)}</div>
                    <div style="font-size:12px; color:var(--text-3); margin-top:8px;">เปิดกะโดย: <span style="color:var(--text-2); font-weight:700;">${session.opened_by}</span> เมื่อ ${formatTime(session.opened_at)}</div>
                </div>
                <button class="btn btn-red" onclick="closeCashSessionModal()">ปิดกะ / สรุปยอด</button>
            </div>
        `;
    }

    const { data: txs } = await db.from('cash_transaction').select('*').order('created_at', { ascending: false }).limit(100);

    section.innerHTML = `
        ${sessionHtml}
        <div id="cash-breakdown-container" class="card" style="border:1px solid var(--glass-border); background:var(--glass-sm);">
            <div class="card-title"><i class="material-icons-round">analytics</i> รายละเอียดแบงก์และเหรียญในลิ้นชัก</div>
            <div id="cash-denoms-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:12px;">
                <!-- Denominations will load here -->
            </div>
        </div>
        <div class="table-container">
            <table>
                <thead><tr><th>เวลา</th><th>ประเภท</th><th>รับ/จ่าย</th><th>ยอดสุทธิ</th><th>ยอดคงเหลือ</th><th>ผู้บันทึก</th><th>หมายเหตุ</th></tr></thead>
                <tbody id="cash-tx-tbody">
                    ${txs?.map(t => `
                        <tr>
                            <td><div style="color:var(--text-1); font-weight:700;">${formatTime(t.created_at)}</div><div style="font-size:10px; color:var(--text-4);">${formatDate(t.created_at)}</div></td>
                            <td><span class="badge ${t.type === 'ขายสินค้า' ? 'badge-green' : 'badge-blue'}">${t.type}</span></td>
                            <td><span class="badge ${t.direction === 'in' ? 'badge-green' : 'badge-red'}">${t.direction === 'in' ? '+' : '-'} ฿${formatNum(t.amount)}</span></td>
                            <td class="font-bold" style="color:var(--text-1);">฿${formatNum(t.net_amount)}</td>
                            <td class="font-bold" style="color:var(--red-neon);">฿${formatNum(t.balance_after)}</td>
                            <td style="color:var(--text-2);">${t.staff_name}</td>
                            <td style="font-size:12px; color:var(--text-3); font-style:italic;">${t.note || '-'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--text-4);">ไม่พบข้อมูลธุรกรรม</td></tr>'}
                </tbody>
            </table>
        </div>
    `;

    renderCashBreakdown();
}

async function renderCashBreakdown() {
    const grid = document.getElementById('cash-denoms-grid');
    if (!grid) return;

    // Fetch all denominations from transactions in the current open session
    const { data: sessions } = await db.from('cash_session').select('*').eq('status', 'open').limit(1);
    const session = sessions?.[0];
    if (!session) {
        grid.innerHTML = '<div style="text-align:center; color:#999; grid-column:1/-1;">กรุณาเปิดกะเพื่อดูรายละเอียด</div>';
        return;
    }

    const { data: txs } = await db.from('cash_transaction').select('denominations, direction').eq('session_id', session.id);
    
    const totals = {};
    [...BN_BILLS, ...BN_COINS].forEach(b => totals[b.val] = 0);

    txs?.forEach(tx => {
        if (!tx.denominations) return;
        Object.entries(tx.denominations).forEach(([val, count]) => {
            if (tx.direction === 'in') totals[val] += count;
            else totals[val] -= count;
        });
    });

    grid.innerHTML = [...BN_BILLS, ...BN_COINS].map(b => `
        <div style="background:var(--bg-surface); padding:16px 10px; border-radius:12px; text-align:center; border:1px solid var(--glass-border); transition: 0.3s;" onmouseover="this.style.borderColor='var(--red-neon)'" onmouseout="this.style.borderColor='var(--glass-border)'">
            <div style="font-size:12px; color:var(--text-3); font-weight:700; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">${b.label}</div>
            <div style="font-size:22px; font-weight:900; color:var(--text-1);">${totals[b.val]}</div>
            <div style="font-size:11px; color:var(--red-neon); font-weight:800; margin-top:4px;">= ฿${formatNum(totals[b.val] * b.val)}</div>
        </div>
    `).join('');
}

function openCashSession() {
    const denoms = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
    const denomLabels = { 1000:'แบงก์พัน', 500:'แบงก์ห้าร้อย', 100:'แบงก์ร้อย', 50:'แบงก์ห้าสิบ', 20:'แบงก์ยี่สิบ', 10:'เหรียญสิบ', 5:'เหรียญห้า', 2:'เหรียญสอง', 1:'เหรียญหนึ่ง' };
    const rows = denoms.map(v => `
        <div style="display:grid; grid-template-columns:80px 1fr 80px 90px; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid var(--glass-border);">
            <div style="font-size:20px; font-weight:900; color:var(--primary);">฿${v.toLocaleString()}</div>
            <div style="font-size:12px; color:var(--text-3);">${denomLabels[v]}</div>
            <input type="number" id="denom-${v}" min="0" value="0" class="glass-input"
                style="text-align:center; font-size:16px; font-weight:700; padding:8px;"
                oninput="calcDenomTotal()">
            <div id="denom-sub-${v}" style="font-size:13px; font-weight:700; color:var(--text-2); text-align:right;">฿0</div>
        </div>
    `).join('');

    const content = `
        <div style="padding:4px 0;">
            <div style="font-size:13px; color:var(--text-3); font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">🏧 นับเงินตั้งต้น — ระบุจำนวนธนบัตร/เหรียญ</div>
            <div style="max-height:380px; overflow-y:auto; padding-right:4px; margin-bottom:16px;">
                <div style="display:grid; grid-template-columns:80px 1fr 80px 90px; gap:10px; padding:4px 0 8px; border-bottom:2px solid var(--primary); margin-bottom:4px;">
                    <div style="font-size:11px; font-weight:800; color:var(--text-3); text-transform:uppercase;">ราคา</div>
                    <div style="font-size:11px; font-weight:800; color:var(--text-3); text-transform:uppercase;">ชนิด</div>
                    <div style="font-size:11px; font-weight:800; color:var(--text-3); text-transform:uppercase; text-align:center;">จำนวน</div>
                    <div style="font-size:11px; font-weight:800; color:var(--text-3); text-transform:uppercase; text-align:right;">ยอดรวม</div>
                </div>
                ${rows}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--primary-subtle); border-radius:var(--r-md); border:1.5px solid rgba(198,40,40,0.25); margin-bottom:16px;">
                <span style="font-size:15px; font-weight:800; color:var(--primary);">ยอดรวมทั้งสิ้น</span>
                <span id="denom-total" style="font-size:28px; font-weight:900; color:var(--primary);">฿0</span>
            </div>
            <div class="input-group" style="margin-bottom:16px;">
                <label>หมายเหตุ (ไม่บังคับ)</label>
                <input type="text" id="cash-session-note" class="glass-input" placeholder="เช่น เปิดกะเช้า">
            </div>
            <div style="display:flex; gap:12px;">
                <button class="btn btn-white" style="flex:1;" onclick="closeModal()">ยกเลิก</button>
                <button class="btn btn-red" style="flex:2;" onclick="confirmOpenCashSession()">
                    <i class="material-icons-round">check_circle</i> เปิดกะ
                </button>
            </div>
        </div>
    `;
    openModal('เปิดกะ — นับเงินตั้งต้น', content);
    setTimeout(() => document.getElementById('denom-1000')?.focus(), 100);
}

window.calcDenomTotal = function() {
    const denoms = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
    let total = 0;
    denoms.forEach(v => {
        const qty = parseInt(document.getElementById(`denom-${v}`)?.value) || 0;
        const sub = qty * v;
        total += sub;
        const subEl = document.getElementById(`denom-sub-${v}`);
        if (subEl) subEl.textContent = sub > 0 ? `฿${sub.toLocaleString()}` : '฿0';
    });
    const totalEl = document.getElementById('denom-total');
    if (totalEl) totalEl.textContent = `฿${total.toLocaleString()}`;
};

window.confirmOpenCashSession = async function() {
    const denoms = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
    let total = 0;
    const denomData = {};
    denoms.forEach(v => {
        const qty = parseInt(document.getElementById(`denom-${v}`)?.value) || 0;
        if (qty > 0) denomData[String(v)] = qty;
        total += qty * v;
    });
    if (total <= 0) return toast('กรุณาระบุจำนวนเงินอย่างน้อย 1 รายการ', 'error');
    const note = document.getElementById('cash-session-note')?.value || '';
    closeModal();
    const { error } = await db.rpc('open_cash_session', {
        p_opening_amt: total,
        p_staff: USER.username,
        p_denominations: denomData
    });
    if (error) toast(error.message, 'error');
    else {
        toast('เปิดกะสำเร็จ');
        loadCash();
        logAct('เงินสด', `เปิดกะใหม่ ยอดตั้งต้น ${total}${note ? ' — ' + note : ''}`);
    }
};

// ── UI พิมพ์ตัวเลขสำหรับเงินสด (ลิ้นชัก) ─────────────────────────
function openCashAmountInput(title, callback) {
    const content = `
        <div style="text-align:center; padding: 8px 0;">
            <div style="font-size:13px;color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${title}</div>
            <div style="position:relative;margin-bottom:20px;">
                <span style="position:absolute;left:20px;top:50%;transform:translateY(-50%);font-size:28px;font-weight:900;color:var(--text-3);">฿</span>
                <input type="number" id="cash-amt-input" class="glass-input"
                    style="font-size:36px;font-weight:900;text-align:right;padding:20px 24px 20px 52px;height:80px;color:var(--primary-dark);border-width:2px;"
                    placeholder="0" min="0" step="1" autofocus>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
                ${[1000,500,100,50,20,10].map(v=>`
                    <button class="btn btn-white" onclick="addCashAmt(${v})" style="padding:12px;font-size:15px;font-weight:800;border-radius:14px;">
                        +฿${v.toLocaleString()}
                    </button>
                `).join('')}
            </div>
            <div class="input-group" style="margin-bottom:16px;">
                <label>หมายเหตุ (ไม่บังคับ)</label>
                <input type="text" id="cash-note-input" class="glass-input" placeholder="เช่น เปิดกะเช้า">
            </div>
            <div style="display:flex;gap:12px;">
                <button class="btn btn-white" style="flex:1;" onclick="closeModal()">ยกเลิก</button>
                <button class="btn btn-red" style="flex:2;" onclick="confirmCashAmountInput()">
                    <i class="material-icons-round">check_circle</i> ยืนยัน
                </button>
            </div>
        </div>
    `;
    openModal(title, content);
    window._cashAmtCallback = callback;
    // focus input
    setTimeout(() => document.getElementById('cash-amt-input')?.focus(), 100);
}

window.addCashAmt = function(v) {
    const inp = document.getElementById('cash-amt-input');
    if (!inp) return;
    inp.value = (parseFloat(inp.value) || 0) + v;
    inp.focus();
};

window.confirmCashAmountInput = function() {
    const amt = parseFloat(document.getElementById('cash-amt-input')?.value) || 0;
    const note = document.getElementById('cash-note-input')?.value || '';
    if (amt <= 0) return toast('กรุณาระบุจำนวนเงิน', 'error');
    closeModal();
    if (window._cashAmtCallback) window._cashAmtCallback(amt, note);
};

function openCashAdjustModal() {
    const content = `
        <div class="input-group"><label>ประเภทการปรับปรุง</label>
            <select id="adj-type" class="glass-input" style="height:52px;">
                <option value="นำเงินเข้า">💚 นำเงินเข้าลิ้นชัก (+)</option>
                <option value="นำเงินออก">🔴 นำเงินออกจากลิ้นชัก (−)</option>
            </select>
        </div>
        <div style="position:relative;margin-bottom:16px;">
            <span style="position:absolute;left:20px;top:50%;transform:translateY(-50%);font-size:24px;font-weight:900;color:var(--text-3);">฿</span>
            <input type="number" id="adj-cash-amt" class="glass-input"
                style="font-size:32px;font-weight:900;text-align:right;padding:18px 20px 18px 48px;height:72px;color:var(--primary-dark);border-width:2px;"
                placeholder="0" min="0" step="1">
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
            ${[1000,500,100,50,20,10].map(v=>`
                <button class="btn btn-white" onclick="(function(){var i=document.getElementById('adj-cash-amt');i.value=(parseFloat(i.value)||0)+${v};})()" 
                    style="padding:10px;font-size:14px;font-weight:800;border-radius:12px;">+฿${v.toLocaleString()}</button>
            `).join('')}
        </div>
        <div class="input-group">
            <label>หมายเหตุ</label>
            <input type="text" id="adj-cash-note" class="glass-input" placeholder="เช่น เงินทอนเพิ่ม">
        </div>
        <div style="display:flex;gap:12px;margin-top:8px;">
            <button class="btn btn-white" style="flex:1;" onclick="closeModal()">ยกเลิก</button>
            <button class="btn btn-red" style="flex:2;" onclick="submitCashAdjust()">
                <i class="material-icons-round">save</i> ยืนยัน
            </button>
        </div>
    `;
    openModal('ปรับยอดเงินสดด้วยตนเอง', content);
    
    window.submitCashAdjust = async () => {
        const type = document.getElementById('adj-type').value;
        const amt  = parseFloat(document.getElementById('adj-cash-amt').value) || 0;
        const note = document.getElementById('adj-cash-note').value || '';
        if (amt <= 0) return toast('กรุณาระบุจำนวนเงิน', 'error');
        
        const { data: sessions } = await db.from('cash_session').select('id').eq('status','open').limit(1);
        const sessionId = sessions?.[0]?.id || null;
        const direction = type === 'นำเงินเข้า' ? 'in' : 'out';
        const { error } = await db.from('cash_transaction').insert({
            session_id: sessionId,
            type: type,
            direction: direction,
            amount: amt,
            net_amount: amt,
            note: note,
            staff_name: USER.username,
            denominations: {}
        });
        if (error) toast(error.message, 'error');
        else { toast('ปรับปรุงยอดเงินสำเร็จ'); closeModal(); loadCash(); logAct('เงินสด', `ปรับยอด: ${type} จำนวน ${amt}`); }
    };
}

async function closeCashSessionModal() {
    const { data: bal } = await db.rpc('get_current_cash_balance');
    const expectedBal = bal || 0;
    
    const content = `
        <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:13px;color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:1px;">ยอดที่ควรมีในลิ้นชัก</div>
            <div style="font-size:40px;font-weight:900;color:var(--primary-dark);margin:8px 0;">฿${formatNum(expectedBal)}</div>
            <div style="font-size:13px;color:var(--text-3);">กรุณานับเงินจริงแล้วพิมพ์ยอดที่นับได้</div>
        </div>
        <div style="position:relative;margin-bottom:16px;">
            <span style="position:absolute;left:20px;top:50%;transform:translateY(-50%);font-size:24px;font-weight:900;color:var(--text-3);">฿</span>
            <input type="number" id="close-amt-input" class="glass-input"
                style="font-size:32px;font-weight:900;text-align:right;padding:18px 20px 18px 48px;height:72px;color:var(--primary-dark);border-width:2px;"
                placeholder="0" min="0" step="1" autofocus>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
            ${[1000,500,100,50,20,10].map(v=>`
                <button class="btn btn-white" onclick="(function(){var i=document.getElementById('close-amt-input');i.value=(parseFloat(i.value)||0)+${v};})()" 
                    style="padding:10px;font-size:14px;font-weight:800;border-radius:12px;">+฿${v.toLocaleString()}</button>
            `).join('')}
        </div>
        <div id="close-diff-preview" style="margin-bottom:16px;padding:14px;border-radius:14px;background:var(--bg-deep);border:1.5px solid var(--glass-border);text-align:center;font-size:14px;color:var(--text-3);">
            พิมพ์ยอดเพื่อดูผลต่าง
        </div>
        <div class="input-group" style="margin-bottom:16px;">
            <label>หมายเหตุ</label>
            <input type="text" id="close-note-input" class="glass-input" placeholder="เช่น ปิดกะเย็น">
        </div>
        <div style="display:flex;gap:12px;">
            <button class="btn btn-white" style="flex:1;" onclick="closeModal()">ยกเลิก</button>
            <button class="btn btn-red" style="flex:2;" onclick="submitCloseSession(${expectedBal})">
                <i class="material-icons-round">lock</i> ปิดกะ
            </button>
        </div>
    `;
    openModal('ปิดกะ / สรุปยอดเงินสด', content);
    setTimeout(() => {
        const inp = document.getElementById('close-amt-input');
        inp?.focus();
        inp?.addEventListener('input', () => {
            const actual = parseFloat(inp.value) || 0;
            const diff = actual - expectedBal;
            const el = document.getElementById('close-diff-preview');
            if (!el) return;
            if (diff === 0) {
                el.innerHTML = `<span style="color:#2E7D32;font-weight:800;">✅ ครบพอดี ฿${formatNum(actual)}</span>`;
                el.style.borderColor = '#A5D6A7';
            } else if (diff > 0) {
                el.innerHTML = `<span style="color:#E65100;font-weight:800;">⚠️ เกิน ฿${formatNum(diff)}</span>`;
                el.style.borderColor = '#FFCC80';
            } else {
                el.innerHTML = `<span style="color:#C62828;font-weight:800;">❌ ขาด ฿${formatNum(Math.abs(diff))}</span>`;
                el.style.borderColor = '#EF9A9A';
            }
        });
    }, 100);
}

window.submitCloseSession = async (expectedBal) => {
    const amt  = parseFloat(document.getElementById('close-amt-input')?.value) || 0;
    const note = document.getElementById('close-note-input')?.value || '';
    if (amt <= 0) return toast('กรุณาระบุยอดที่นับได้', 'error');
    closeModal();
    const { data, error } = await db.rpc('close_cash_session', { 
        p_closing_amt: parseInt(amt), 
        p_staff: USER.username,
        p_denominations: {}
    });
    if (error) toast(error.message, 'error');
    else {
        const diff = data[0]?.diff ?? (amt - expectedBal);
        let resultText = `ยอดนับได้: ฿${formatNum(amt)} | ควรมี: ฿${formatNum(expectedBal)} | ผลต่าง: ฿${formatNum(diff)}`;
        if (diff === 0) resultText += ' ✅ ครบพอดี';
        else if (diff > 0) resultText += ' ⚠️ เงินเกิน';
        else resultText += ' ❌ เงินขาด';
        Swal.fire('ปิดกะเรียบร้อย', `${resultText}${note ? `\nหมายเหตุ: ${note}` : ''}`, 'success');
        loadCash();
        logAct('เงินสด', `ปิดกะ ยอดนับ ${amt} ผลต่าง ${diff}`);
    }
};

// 13. PURCHASE LOGIC
async function loadPurchase() {
    UI.pageActions.innerHTML = `<button class="btn btn-red" onclick="openPurchaseModal()"><i class="material-icons-round">add</i>รับสินค้าเข้า</button>`;
    
    const { data } = await db.from('purchase_order').select('*').order('date', { ascending: false });
    const section = document.getElementById('page-purchase');
    
    section.innerHTML = `
        <div class="table-container">
            <table>
                <thead><tr><th>วันที่</th><th>ผู้จัดจำหน่าย</th><th>ยอดรวม</th><th>วิธีชำระ</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                <tbody>
                    ${data?.map(p => `
                        <tr>
                            <td>${formatDate(p.date)}</td>
                            <td class="font-bold">${p.supplier || '-'}</td>
                            <td class="font-bold text-red">฿${formatNum(p.total)}</td>
                            <td>${p.method}</td>
                            <td><span class="badge ${p.status === 'รับแล้ว' ? 'badge-green' : 'badge-amber'}">${p.status}</span></td>
                            <td><button class="btn btn-white btn-icon" onclick="viewPurchaseItems('${p.id}')"><i class="material-icons-round">visibility</i></button></td>
                        </tr>
                    `).join('') || '<tr><td colspan="6" style="text-align:center;">ไม่พบข้อมูลการสั่งซื้อ</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function openPurchaseModal() {
    const prodOptions = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const content = `
        <div class="input-group"><label>ผู้จัดจำหน่าย (Supplier)</label><input type="text" id="pur-supplier"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:15px;">
            <div class="input-group"><label>วิธีชำระ</label><select id="pur-method"><option value="เงินสด">เงินสด</option><option value="โอน">เงินโอน</option></select></div>
            <div class="input-group"><label>สถานะ</label><select id="pur-status"><option value="รับแล้ว">รับสต็อกทันที</option><option value="รอรับ">จองไว้ (ยังไม่เพิ่มสต็อก)</option></select></div>
        </div>
        <div class="card" style="padding:10px; margin-bottom:15px;">
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <select id="pur-item-id" style="flex-grow:1;">${prodOptions}</select>
                <input type="number" id="pur-item-qty" value="1" style="width:80px;">
                <input type="number" id="pur-item-cost" placeholder="ทุน/หน่วย" style="width:100px;">
                <button class="btn btn-red btn-icon" onclick="addPurchaseRow()"><i class="material-icons-round">add</i></button>
            </div>
            <div class="table-container" style="max-height:200px;">
                <table style="font-size:12px;">
                    <thead><tr><th>ชื่อสินค้า</th><th>จำนวน</th><th>ทุน</th><th>รวม</th><th></th></tr></thead>
                    <tbody id="pur-items-list"></tbody>
                </table>
            </div>
        </div>
        <div style="text-align:right; font-size:20px; font-weight:800; margin-bottom:15px;">ยอดรวม: ฿<span id="pur-total-disp">0</span></div>
        <button class="btn btn-red" style="width:100%; padding:14px;" onclick="submitPurchase()">บันทึกรับสินค้า</button>
    `;
    openModal('บันทึกรับสินค้าเข้าคลัง', content);
    purchaseItems = [];
    updatePurTotal();
}

let purchaseItems = [];
function addPurchaseRow() {
    const pid = document.getElementById('pur-item-id').value;
    const qty = parseInt(document.getElementById('pur-item-qty').value) || 1;
    const cost = parseFloat(document.getElementById('pur-item-cost').value) || 0;
    const prod = products.find(p => p.id === pid);
    if (!prod) return toast('ไม่พบสินค้า กรุณาเลือกใหม่', 'error');
    purchaseItems.push({ product_id: pid, name: prod.name, qty, cost_per_unit: cost, total: qty * cost });
    renderPurRows();
}

function renderPurRows() {
    const list = document.getElementById('pur-items-list');
    list.innerHTML = purchaseItems.map((item, idx) => `
        <tr>
            <td>${item.name}</td><td>${item.qty}</td><td>${item.cost_per_unit}</td><td>${item.total}</td>
            <td><i class="material-icons-round" style="color:red; cursor:pointer;" onclick="purchaseItems.splice(${idx},1); renderPurRows(); updatePurTotal();">delete</i></td>
        </tr>
    `).join('');
    updatePurTotal();
}

function updatePurTotal() {
    const total = purchaseItems.reduce((sum, item) => sum + item.total, 0);
    const disp = document.getElementById('pur-total-disp');
    if (disp) disp.innerText = formatNum(total);
}

async function submitPurchase() {
    if (purchaseItems.length === 0) return toast('กรุณาเพิ่มรายการสินค้า', 'error');
    const total = purchaseItems.reduce((sum, item) => sum + item.total, 0);
    
    const { data: po, error } = await db.from('purchase_order').insert({
        supplier: document.getElementById('pur-supplier').value,
        total: total,
        method: document.getElementById('pur-method').value,
        status: document.getElementById('pur-status').value,
        staff_name: USER.username
    }).select().single();
    
    if (error) return toast(error.message, 'error');
    
    const items = purchaseItems.map(i => ({ ...i, order_id: po.id }));
    await db.from('purchase_item').insert(items);
    
    // อัปเดตสต็อกเมื่อสถานะ "รับแล้ว"
    if (po.status === 'รับแล้ว') {
        for (const item of purchaseItems) {
            // อัปเดตสต็อกและต้นทุน
            const { data: prod } = await db.from('สินค้า').select('stock').eq('id', item.product_id).single();
            const newStock = (prod?.stock || 0) + item.qty;
            const updateData = { stock: newStock, updated_at: new Date().toISOString() };
            if (item.cost_per_unit > 0) updateData.cost = item.cost_per_unit;
            await db.from('สินค้า').update(updateData).eq('id', item.product_id);

            await db.from('stock_movement').insert({
                product_id: item.product_id,
                product_name: item.name,
                type: 'purchase',
                direction: 'in',
                qty: item.qty,
                stock_before: prod?.stock || 0,
                stock_after: newStock,
                staff_name: USER.username,
                note: `รับสินค้าจาก PO #${po.id.substring(0,8)}`
            }).catch(() => {});
        }
    }
    
    toast('บันทึกการรับสินค้าสำเร็จ');
    closeModal();
    loadPurchase();
    refreshProducts();
}

// 14. CUSTOMER LOGIC
async function loadCustomer() {
    UI.pageActions.innerHTML = `<button class="btn btn-red" onclick="openCustomerModal()">➕ เพิ่มลูกค้าประจำ</button>`;
    const { data } = await db.from('customer').select('*').order('total_purchase', { ascending: false });
    const section = document.getElementById('page-customer');
    section.innerHTML = `
        <div class="table-container">
            <table>
                <thead><tr><th>ชื่อ</th><th>เบอร์โทร</th><th>หนี้คงเหลือ</th><th>ยอดซื้อสะสม</th><th>จำนวนครั้ง</th><th>วันล่าสุด</th><th>จัดการ</th></tr></thead>
                <tbody>
                    ${data?.map(c => `
                        <tr>
                            <td class="font-bold" style="color:var(--text-1);">${c.name}</td>
                            <td style="color:var(--text-2);">${c.phone || '-'}</td>
                            <td class="font-bold" style="color:var(--red-neon);">฿${formatNum(c.debt_amount || 0)}</td>
                            <td class="font-bold" style="color:var(--text-1);">฿${formatNum(c.total_purchase)}</td>
                            <td style="color:var(--text-3);">${c.visit_count}</td>
                            <td style="font-size:12px; color:var(--text-4);">${formatDate(c.updated_at)}</td>
                            <td>
                                <button class="btn btn-white btn-icon" onclick="openCustomerModal('${c.id}')">📝 แก้ไข</button>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-4);">ยังไม่มีข้อมูลลูกค้า</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

async function openCustomerModal(id = null) {
    let c = { name: '', phone: '', address: '' };
    if (id) {
        const { data } = await db.from('customer').select('*').eq('id', id).single();
        if (data) c = data;
    }
    const content = `
        <form id="customer-form">
            <div class="input-group"><label>ชื่อ-นามสกุล *</label><input type="text" id="c-name" value="${c.name}" required></div>
            <div class="input-group"><label>เบอร์โทรศัพท์</label><input type="text" id="c-phone" value="${c.phone || ''}"></div>
            <div class="input-group"><label>ที่อยู่</label><textarea id="c-address">${c.address || ''}</textarea></div>
            <button type="submit" class="btn btn-red" style="width:100%; padding:14px; margin-top:10px;">${id ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า'}</button>
        </form>
    `;
    openModal(id ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่', content);
    document.getElementById('customer-form').onsubmit = async (e) => {
        e.preventDefault();
        const payload = { name: document.getElementById('c-name').value, phone: document.getElementById('c-phone').value, address: document.getElementById('c-address').value };
        if (id) await db.from('customer').update(payload).eq('id', id);
        else await db.from('customer').insert(payload);
        toast('ดำเนินการสำเร็จ'); 
        closeModal(); 
        if (currentPage === 'debt') loadDebt();
        else loadCustomer();
    };
}

// 15. ATTENDANCE LOGIC

// 16. HISTORY LOGIC
async function loadHistory() {
    // [V3-BUG-03] — เพิ่มปุ่ม PDF ที่สร้างฟังก์ชันไว้แล้วแต่ลืมใส่ปุ่ม
    UI.pageActions.innerHTML = `
        <button class="btn btn-white" onclick="exportHistory()">
            <i class="material-icons-round">ios_share</i> CSV
        </button>
        <button class="btn btn-white" onclick="exportHistoryPDF()">
            <i class="material-icons-round">picture_as_pdf</i> PDF
        </button>
    `;

    const { data } = await db.from('บิลขาย').select('*').order('date', { ascending: false }).limit(200);
    const section = document.getElementById('page-history');

    // [V3-UX-01] — เพิ่ม Filter bar
    section.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; align-items:center;">
            <input type="date" id="hist-start" class="glass-input" style="height:40px; padding:0 12px; width:148px;">
            <span style="color:var(--text-3);">–</span>
            <input type="date" id="hist-end" class="glass-input" style="height:40px; padding:0 12px; width:148px;">
            <select id="hist-method" class="glass-input" style="height:40px; padding:0 12px; width:140px;">
                <option value="">วิธีชำระทั้งหมด</option>
                <option value="เงินสด">เงินสด</option>
                <option value="โอน">โอน</option>
                <option value="ลูกหนี้">ลูกหนี้</option>
            </select>
            <button class="btn btn-red" style="height:40px;" onclick="filterHistory()">
                <i class="material-icons-round">search</i> ค้นหา
            </button>
            <button class="btn btn-white" style="height:40px;" onclick="loadHistory()">รีเซ็ต</button>
            <span id="hist-count" style="font-size:12px; color:var(--text-4); margin-left:4px;"></span>
        </div>
        <div class="table-container" id="hist-table-wrap">
            <table>
                <thead><tr><th>ลำดับบิล</th><th>วันที่/เวลา</th><th>ยอดรวม</th><th>วิธีชำระ</th><th>ผู้ขาย</th><th>จัดการ</th></tr></thead>
                <tbody id="hist-tbody"></tbody>
            </table>
        </div>
    `;
    renderHistoryRows(data || []);
}

// [V3-UX-01] — แยก render rows เพื่อให้ filter ใช้ได้
function renderHistoryRows(data) {
    const tbody = document.getElementById('hist-tbody');
    const count = document.getElementById('hist-count');
    if (!tbody) return;
    if (count) count.textContent = `${data.length} รายการ`;
    tbody.innerHTML = data.map(b => `
        <tr>
            <td class="font-bold">${b.bill_no ? `#${String(b.bill_no).padStart(4,'0')}` : `#${b.id.substring(0,8).toUpperCase()}`}</td> <!-- [V5-BUG-03] -->
            <td>${formatDate(b.date)} ${formatTime(b.date)}</td>
            <td class="font-bold text-red">฿${formatNum(b.total)}</td>
            <td><span class="badge ${b.method === 'เงินสด' ? 'badge-green' : b.method === 'โอน' ? 'badge-blue' : 'badge-red'}">${b.method}</span></td>
            <td>${b.staff_name || '-'}</td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-white btn-icon" onclick="printBillWithChoice('${b.id}')" title="พิมพ์ใบเสร็จ 80mm" style="font-size:11px;"> <!-- [V5-UX-03] -->
                        <i class="material-icons-round">receipt</i>
                    </button>
                    <button class="btn btn-white btn-icon" onclick="exportInvoiceA4('${b.id}')" title="พิมพ์ใบกำกับ A4" style="font-size:11px;">
                        <i class="material-icons-round">description</i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-4);">ไม่พบประวัติการขาย</td></tr>';
}

// [V3-UX-01] — Filter history
async function filterHistory() {
    const start  = document.getElementById('hist-start')?.value;
    const end    = document.getElementById('hist-end')?.value;
    const method = document.getElementById('hist-method')?.value;

    let query = db.from('บิลขาย').select('*').order('date', { ascending: false }).limit(500);
    // ใช้ T00:00:00+07:00 แทน toISOString() เพื่อป้องกัน UTC off-by-one บนเวลาไทย
    if (start)  query = query.gte('date', start + 'T00:00:00+07:00');
    if (end)    query = query.lte('date', end   + 'T23:59:59+07:00');
    if (method) query = query.eq('method', method);

    const { data, error } = await query;
    if (error) return toast(error.message, 'error');
    renderHistoryRows(data || []);
}

async function exportHistory() {
    const { data } = await db.from('บิลขาย').select('*').order('date', { ascending: false });
    if (!data || data.length === 0) return toast('ไม่มีข้อมูลสำหรับส่งออก', 'error');

    let csv = 'Bill No,Date,Method,Total,Staff\n';
    data.forEach(b => {
        const billLabel = b.bill_no ? `#${String(b.bill_no).padStart(4,'0')}` : b.id.substring(0,8).toUpperCase(); // [V5-BUG-04]
        csv += `${billLabel},${formatDate(b.date)} ${formatTime(b.date)},${b.method},${b.total},${b.staff_name || '-'}\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `sales_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function viewBillDetails(id) {
    const { data: bill } = await db.from('บิลขาย').select('*').eq('id', id).single();
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', id);

    // [V5-BUG-02] — แสดง preview ใน modal + ปุ่มเปิดหน้าต่างพิมพ์แยก (ไม่ print ทั้งแอป)
    const billLabel = bill.bill_no ? `#${String(bill.bill_no).padStart(4,'0')}` : `#${bill.id.substring(0,8).toUpperCase()}`;
    const shopInfo  = getShopInfo();

    const content = `
        <div style="text-align:center; font-family:'Sarabun',sans-serif; max-width:320px; margin:0 auto;">
            <div style="font-weight:800; font-size:20px; margin-bottom:2px;">${shopInfo.name}</div>
            <div style="font-size:11px; color:var(--text-4); margin-bottom:12px;">${shopInfo.phone || ''}</div>
            <div style="font-size:12px; color:var(--text-3); border-bottom:1px dashed var(--glass-border); padding-bottom:10px; margin-bottom:12px;">
                เลขที่: ${billLabel} &nbsp;|&nbsp; ${formatDate(bill.date)} ${formatTime(bill.date)}
            </div>
            <div style="font-size:13px; text-align:left;">
                ${items.map(i => `
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <div style="flex:1; font-weight:600;">${i.name}</div>
                        <div style="color:var(--text-3); margin:0 8px;">×${i.qty}</div>
                        <div style="font-weight:700;">฿${formatNum(i.total)}</div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:12px; border-top:1px solid var(--glass-border); padding-top:10px;">
                ${bill.discount ? `<div style="display:flex;justify-content:space-between;color:var(--red-neon);font-size:13px;margin-bottom:4px;"><span>ส่วนลด</span><span>- ฿${formatNum(bill.discount)}</span></div>` : ''}
                <div style="display:flex;justify-content:space-between;font-weight:800;font-size:20px;color:var(--red-neon);border-top:2px solid var(--red-neon);padding-top:8px;margin-top:4px;">
                    <span>สุทธิ</span><span>฿${formatNum(bill.total)}</span>
                </div>
            </div>
            <div style="margin-top:12px; font-size:12px; color:var(--text-3); text-align:left; display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                <div>💳 ${bill.method}</div>
                <div>รับ ฿${formatNum(bill.received)}</div>
                <div>ผู้ขาย: ${bill.staff_name || '-'}</div>
                <div>ทอน ฿${formatNum(bill.change || 0)}</div>
            </div>
            <div style="text-align:center; color:var(--text-4); font-size:11px; margin-top:14px; border-top:1px dashed var(--glass-border); padding-top:10px;">
                ${shopInfo.note || 'ขอบคุณที่ใช้บริการ'}
            </div>
            <div style="display:flex; gap:10px; margin-top:16px;">
                <button class="btn btn-white" style="flex:1;" onclick="closeModal()">ปิด</button>
                <button class="btn btn-red" style="flex:2;" onclick="printBillWithChoice('${id}')">
                    <i class="material-icons-round" style="font-size:18px;">print</i> พิมพ์ใบเสร็จ
                </button>
            </div>
        </div>
    `;
    openModal('รายละเอียดบิล', content);
}

// [V5-BUG-02] — พิมพ์ใบเสร็จ 80mm ใน window แยก ไม่พิมพ์ทั้งแอป
async function printReceipt80mm(id) {
    const { data: bill } = await db.from('บิลขาย').select('*').eq('id', id).single();
    const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', id);
    const shopInfo  = getShopInfo();
    const billLabel = bill.bill_no ? `#${String(bill.bill_no).padStart(4,'0')}` : `#${bill.id.substring(0,8).toUpperCase()}`;

    const html = `<!DOCTYPE html><html lang="th"><head>
        <meta charset="UTF-8">
        <title>Receipt ${billLabel}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'Sarabun',sans-serif; font-size:13px; color:#000;
                   width:80mm; padding:8mm 6mm; background:#fff; }
            @page { size: 80mm auto; margin: 0; }
            @media print { .no-print { display:none; } }
            .center  { text-align:center; }
            .bold    { font-weight:700; }
            .line    { border-bottom:1px dashed #999; margin:6px 0; }
            .row     { display:flex; justify-content:space-between; margin-bottom:4px; }
            .total   { font-size:16px; font-weight:800; border-top:2px solid #000; padding-top:6px; margin-top:4px; }
        </style>
    </head><body>
        <div class="center bold" style="font-size:16px; margin-bottom:2px;">${shopInfo.name}</div>
        <div class="center" style="font-size:11px; color:#666; margin-bottom:8px;">${shopInfo.phone || ''}</div>
        <div class="line"></div>
        <div class="center" style="font-size:11px; margin-bottom:6px;">
            ${billLabel} | ${formatDate(bill.date)} ${formatTime(bill.date)}
        </div>
        <div class="line"></div>
        ${items.map(i => `
            <div style="margin-bottom:4px;">
                <div class="bold">${i.name}</div>
                <div class="row" style="color:#444; font-size:12px;">
                    <span>${i.qty} ${i.unit||''} × ฿${formatNum(i.price)}</span>
                    <span class="bold">฿${formatNum(i.total)}</span>
                </div>
            </div>
        `).join('')}
        <div class="line"></div>
        ${bill.discount ? `<div class="row" style="color:#c00;"><span>ส่วนลด</span><span>- ฿${formatNum(bill.discount)}</span></div>` : ''}
        <div class="row total"><span>รวมสุทธิ</span><span>฿${formatNum(bill.total)}</span></div>
        <div class="row" style="margin-top:6px; font-size:12px;">
            <span>ชำระ (${bill.method})</span><span>฿${formatNum(bill.received || bill.total)}</span>
        </div>
        <div class="row" style="font-size:12px;">
            <span>เงินทอน</span><span>฿${formatNum(bill.change || 0)}</span>
        </div>
        <div class="line"></div>
        <div class="center" style="font-size:11px; color:#666; margin-top:6px;">
            ผู้รับเงิน: ${bill.staff_name || '-'}<br>
            ${shopInfo.note || 'ขอบคุณที่ใช้บริการ'}
        </div>
        <div class="no-print center" style="margin-top:16px;">
            <button onclick="window.print()" style="padding:8px 24px; background:#d32f2f; color:#fff; border:none; border-radius:6px; font-family:Sarabun; font-size:14px; cursor:pointer;">🖨 พิมพ์</button>
            <button onclick="window.close()" style="padding:8px 16px; background:#eee; border:none; border-radius:6px; margin-left:8px; font-family:Sarabun; font-size:14px; cursor:pointer;">ปิด</button>
        </div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
}

// 17. LOG LOGIC
async function loadLog() {
    const { data } = await db.from('log_กิจกรรม').select('*').order('time', { ascending: false }).limit(100);
    const section = document.getElementById('page-log');
    
    section.innerHTML = `
        <div class="table-container">
            <table>
                <thead><tr><th>เวลา</th><th>กิจกรรม</th><th>พนักงาน</th><th>รายละเอียด</th></tr></thead>
                <tbody>
                    ${data?.map(l => `
                        <tr>
                            <td>${formatTime(l.time)}</td>
                            <td><span class="badge ${l.type.includes('ลบ') || l.type.includes('จ่าย') ? 'badge-red' : 'badge-blue'}">${l.type}</span></td>
                            <td class="font-bold">${l.username}</td>
                            <td style="font-size:12px; color:#666;">${l.details || '-'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="4" style="text-align:center;">ยังไม่มีบันทึกกิจกรรม</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// INITIALIZE APP
window.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Persistence & Toggle
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const savedTheme = localStorage.getItem('sk-pos-theme') || 'light';
    
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
        localStorage.setItem('sk-pos-theme', theme);
    };
    
    applyTheme(savedTheme);

    // Live clock
    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
        const updateClock = () => {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }

    // Permission check for sidebar items
    document.querySelectorAll('.menu-item').forEach(item => {
        const page = item.dataset.page;
        if (!page) return;
        
        // Hide Restricted Pages from UI first, will show if allowed
        item.style.display = 'none';
    });

    // [V3-BUG-01] — Sidebar click-outside (ย้ายมาที่นี่ ไม่รั่วแม้ login ซ้ำ)
    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        if (sidebar.classList.contains('show') &&
            !sidebar.contains(e.target) &&
            !e.target.closest('#menu-toggle')) {
            sidebar.classList.remove('show');
        }
    });

    // Click outside to close modals
    const bno = document.getElementById('bn-overlay');
    if (bno) {
        bno.addEventListener('mousedown', (e) => {
            if (e.target === bno) {
                bno.classList.remove('show');
                isProcessingPayment = false; // reset flag ถ้า user ปิด overlay กลางคัน
            }
        });
    }

    const mo = document.getElementById('modal-overlay');
    if (mo) {
        mo.addEventListener('mousedown', (e) => {
            if (e.target === mo) closeModal();
        });
    }

    // POS Shortcuts
    window.addEventListener('keydown', (e) => {
        if (currentPage !== 'pos') return;
        
        if (e.key === 'F10') {
            e.preventDefault();
            const payBtn = document.getElementById('checkout-btn');
            if (payBtn) payBtn.click();
        }
        if (e.key === 'Escape') {
            closeModal();
            const bno = document.getElementById('bn-overlay');
            if (bno) {
                bno.classList.remove('show');
                isProcessingPayment = false;
            }
        }
    });
});

// [UX-07] — ปุ่ม × ลบรายการใน Cart โดยตรง
function removeCartItem(idx) {
    if (idx < 0 || idx >= cart.length) return;
    const name = cart[idx].name;
    cart.splice(idx, 1);
    renderCart();
    toast(`ลบ "${name}" ออกจากตะกร้าแล้ว`);
}

// [FEAT-01] — Barcode Scanner รองรับทุกเบราว์เซอร์ (BarcodeDetector + Quagga fallback)
async function openBarcodeScanner() {
    if (!('BarcodeDetector' in window)) {
        // Desktop Chrome/Firefox — ใช้ Quagga.js
        return openQuaggaScanner();
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const content = `
            <div style="position:relative; width:100%; height:300px; background:#000; overflow:hidden; border-radius:12px;">
                <video id="barcode-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:200px; height:100px; border:2px solid var(--red-neon); border-radius:8px;"></div>
            </div>
            <p style="text-align:center; margin-top:15px; color:var(--text-3);">วางบาร์โค้ดสินค้าในกรอบเพื่อสแกน</p>
            <button class="btn btn-white" style="width:100%; margin-top:15px;" onclick="closeModal(); stopScanner();">ยกเลิก</button>
        `;
        openModal('แสกนบาร์โค้ดสินค้า', content);
        
        const video = document.getElementById('barcode-video');
        if (video) video.srcObject = stream;
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'] });
        
        window._scannerActive = true;
        const scan = async () => {
            if (!window._scannerActive) return;
            try {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    document.getElementById('pos-search').value = code;
                    document.getElementById('pos-search').dispatchEvent(new Event('input'));
                    
                    // [UX-NEW-04] — เพิ่ม Visual Feedback เมื่อสแกนเจอสินค้า
                    const found = products.filter(p => p.barcode === code);
                    if (found.length === 0) {
                        toast(`ไม่พบสินค้าบาร์โค้ด: ${code}`, 'error');
                    } else {
                        toast(`สแกนเจอ: ${found[0].name}`);
                        if (found.length === 1) addToCart(found[0]);
                    }

                    stopScanner();
                    closeModal();
                } else {
                    requestAnimationFrame(scan);
                }
            } catch (e) { requestAnimationFrame(scan); }
        };
        requestAnimationFrame(scan);
        
        window.stopScanner = () => {
            window._scannerActive = false;
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    } catch (err) {
        toast('ไม่สามารถเปิดกล้องได้: ' + err.message, 'error');
    }
}

// [FEAT-01b] — Quagga.js Scanner (Desktop Chrome/Firefox fallback)
async function openQuaggaScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const { value } = await Swal.fire({
            title: '📷 สแกนบาร์โค้ด',
            html: '<p style="color:#888;font-size:14px;">ไม่มีกล้อง — กรอกบาร์โค้ดด้วยตนเอง</p>',
            input: 'text', inputPlaceholder: 'กรอกบาร์โค้ด...',
            confirmButtonText: 'ค้นหา', showCancelButton: true, cancelButtonText: 'ยกเลิก'
        });
        if (value) _processScanCode(value.trim());
        return;
    }

    const content = `
        <div id="quagga-viewport" style="position:relative;width:100%;min-height:260px;background:#000;border-radius:12px;overflow:hidden;">
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10;">
                <div style="width:75%;max-width:290px;height:80px;border:2px solid #E53935;border-radius:8px;
                            box-shadow:0 0 0 2000px rgba(0,0,0,0.45);">
                    <div style="position:relative;width:100%;height:100%;">
                        <div id="scan-laser2" style="position:absolute;top:0;left:0;right:0;height:2px;
                            background:linear-gradient(90deg,transparent,#FF5252,transparent);
                            animation:scan-laser2 1.8s ease-in-out infinite;"></div>
                    </div>
                </div>
            </div>
            <div id="scan-msg" style="position:absolute;bottom:0;left:0;right:0;padding:8px;text-align:center;
                font-size:13px;color:#fff;background:rgba(0,0,0,0.6);z-index:11;">⏳ กำลังเริ่มกล้อง...</div>
        </div>
        <style>@keyframes scan-laser2{0%{top:5%}50%{top:88%}100%{top:5%}}</style>
        <div style="display:flex;gap:10px;margin-top:12px;">
            <button class="btn btn-white" style="flex:1;" onclick="window._qStop&&window._qStop();closeModal();">❌ ยกเลิก</button>
            <button class="btn btn-white" style="flex:1;" onclick="window._qStop&&window._qStop();closeModal();setTimeout(()=>_openManualBc(),200);">⌨️ พิมพ์เอง</button>
        </div>
    `;
    openModal('📷 สแกนบาร์โค้ดสินค้า', content);

    window._openManualBc = async function() {
        const { value } = await Swal.fire({
            title: 'กรอกบาร์โค้ด', input: 'text', inputPlaceholder: 'กรอกบาร์โค้ด...',
            confirmButtonText: 'ค้นหา', showCancelButton: true
        });
        if (value) _processScanCode(value.trim());
    };

    // โหลด Quagga ถ้ายังไม่มี
    if (!window.Quagga) {
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        }).catch(() => null);
    }

    const msgEl = document.getElementById('scan-msg');
    const viewport = document.getElementById('quagga-viewport');

    if (!window.Quagga || !viewport) {
        if (msgEl) msgEl.textContent = '❌ โหลด Quagga ไม่ได้ — กดปุ่ม "พิมพ์เอง"';
        return;
    }

    window._qStop = () => {
        try { if(window._quaggaOn){ Quagga.offDetected(); Quagga.stop(); window._quaggaOn=false; } } catch(e){}
    };

    if (msgEl) msgEl.textContent = '🔍 กำลังสแกน — วางบาร์โค้ดในกรอบ';

    Quagga.init({
        inputStream: {
            name: 'Live', type: 'LiveStream', target: viewport,
            constraints: { facingMode: 'environment', width:{ideal:1280}, height:{ideal:720} }
        },
        locator: { patchSize: 'medium', halfSample: true },
        numOfWorkers: 2,
        frequency: 8,
        decoder: { readers: ['ean_reader','ean_8_reader','code_128_reader','code_39_reader','upc_reader','upc_e_reader'] }
    }, function(err) {
        if (err) {
            if (msgEl) msgEl.textContent = '❌ เปิดกล้องไม่ได้ — กดปุ่ม "พิมพ์เอง"';
            return;
        }
        window._quaggaOn = true;
        Quagga.start();
    });

    Quagga.onDetected(function(result) {
        const code = result && result.codeResult && result.codeResult.code;
        if (!code) return;
        window._qStop();
        closeModal();
        _processScanCode(code);
    });
}

function _processScanCode(code) {
    const searchEl = document.getElementById('pos-search');
    if (searchEl) {
        searchEl.value = code;
        searchEl.dispatchEvent(new Event('input'));
    }
    const found = products.filter(p => p.barcode === code);
    if (found.length === 0) {
        toast('ไม่พบสินค้าบาร์โค้ด: ' + code, 'error');
    } else {
        toast('✅ สแกนเจอ: ' + found[0].name);
        if (found.length === 1) addToCart(found[0]);
    }
}

// [FEAT-02] — Supabase Realtime สำหรับ Stock Sync
function setupRealtime() {
    db.channel('stock-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'สินค้า' }, 
            payload => {
                // อัปเดต products array
                const idx = products.findIndex(p => p.id === payload.new.id);
                if (idx !== -1) {
                    products[idx] = { ...products[idx], ...payload.new };
                    if (currentPage === 'pos') renderProductGrid();
                    if (currentPage === 'inv') loadInventory();
                }
            }
        )
        .subscribe();
}

// [FEAT-03] — Export รายงาน PDF
async function exportToPDF(title, tableData, columns) {
    if (!window.jspdf) {
        return toast('ไลบรารี PDF ยังโหลดไม่เสร็จ', 'error');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Simple table using jspdf-autotable
    if (doc.autoTable) {
        doc.text(title, 14, 15);
        doc.autoTable({
            head: [columns],
            body: tableData,
            startY: 20
        });
        doc.save(`${title}_${new Date().toISOString().split('T')[0]}.pdf`);
    } else {
        toast('ไลบรารี autoTable ยังโหลดไม่เสร็จ', 'error');
    }
}

// [UX-02] — Keyboard Shortcut Listener
window.addEventListener('keydown', (e) => {
    // F2 Focus Search
    if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.getElementById('pos-search');
        if (searchInput) searchInput.focus();
    }
    // F10 Checkout
    if (e.key === 'F10' && currentPage === 'pos' && cart.length > 0) {
        e.preventDefault();
        openCheckout();
    }
});

// [FIX BUG-07] — checkIn() หา employee ด้วย username
async function checkIn() {
    const { data: emp } = await db.from('พนักงาน')
        .select('id')
        .or(`name.eq.${USER.username},phone.eq.${USER.username}`)
        .limit(1)
        .maybeSingle();
    
    if (!emp) {
        return Swal.fire(
            'ไม่พบข้อมูลพนักงาน',
            `ไม่พบชื่อ "${USER.username}" ในระบบพนักงาน\nกรุณาให้หัวหน้าใช้ปุ่ม "บันทึกเช็คชื่อ (สิทธิ์หัวหน้า)" แทน`,
            'warning'
        );
    }
    const { error } = await db.from('เช็คชื่อ').insert({
        employee_id: emp.id,
        staff_name: USER.username,
        time_in: new Date().toLocaleTimeString('en-GB'),
        status: 'มา',
        date: new Date().toISOString().split('T')[0]
    });
    if (error) toast(error.message, 'error');
    else { toast('ลงชื่อเข้างานสำเร็จ'); closeModal(); loadHR('att'); }
}

// [NEW-BUG-09] — เพิ่มฟังก์ชัน Export PDF ประวัติการขาย
async function exportHistoryPDF() {
    const { data } = await db.from('บิลขาย').select('*').order('date', { ascending: false }).limit(500);
    if (!data || data.length === 0) return toast('ไม่มีข้อมูล', 'error');
    
    const tableData = data.map(b => [
        b.bill_no ? `#${String(b.bill_no).padStart(4,'0')}` : b.id.substring(0,8).toUpperCase(), // [V5-BUG-05] 1/2
        formatDate(b.date) + ' ' + formatTime(b.date),
        b.method,
        '฿' + formatNum(b.total),
        b.staff_name || '-'
    ]);
    exportToPDF('ประวัติการขาย SK POS', tableData, ['บิลเลขที่', 'วันที่/เวลา', 'วิธีชำระ', 'ยอดรวม', 'ผู้ขาย']);
}

// [UX-NEW-05] — เพิ่มฟังก์ชัน Export PDF Dashboard

// [V3-UX-02 + V3-FEAT-01] — ตั้งค่าข้อมูลร้านค้า (admin only, เก็บใน localStorage)

// ══════════════════════════════════════════════════════════════════
// SHOP SETTINGS PAGE — หน้าตั้งค่าระบบแบบครบถ้วน
// ══════════════════════════════════════════════════════════════════

function getShopInfo() {
    const local = JSON.parse(localStorage.getItem('sk_shop_config') || 'null');
    if (local && local.name) return local;
    if (typeof SHOP_CONFIG !== 'undefined') return SHOP_CONFIG;
    return { name: 'SK POS', nameEn: 'SK POS SYSTEM', address: '-', phone: '-', taxId: '-', note: 'ขอบคุณที่ใช้บริการ', qrUrl: '', showLogo: true, showTaxId: true, receiptNote2: '', lineId: '', facebook: '' };
}

function saveShopInfo(config) {
    localStorage.setItem('sk_shop_config', JSON.stringify(config));
}

// ── Main settings page (replaces simple modal) ──────────────────
async function openShopSettingsModal() {
    const saved = { ...getShopInfo() };

    const pageSection = document.getElementById('page-log'); // reuse any available section
    // Open as full-page modal with tabs
    const html = `
        <div id="settings-tabs" style="display:flex; gap:0; border-bottom:2px solid var(--glass-border); margin-bottom:0;">
            ${['shop','receipt','print','payment','system'].map((t,i) => `
                <button id="stab-${t}" onclick="switchSettingsTab('${t}')"
                    style="padding:12px 20px; border:none; background:none; font-size:13px; font-weight:700;
                           color:${i===0?'var(--primary)':'var(--text-3)'}; border-bottom:${i===0?'3px solid var(--primary)':'3px solid transparent'};
                           cursor:pointer; transition:all 0.2s; white-space:nowrap;">
                    ${['🏪 ข้อมูลร้าน','🧾 ออกแบบบิล','🖨️ การพิมพ์','💳 การชำระ','⚙️ ระบบ'][i]}
                </button>
            `).join('')}
        </div>

        <!-- TAB 1: Shop Info -->
        <div id="stab-content-shop" class="stab-content" style="padding:24px 0;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div class="input-group" style="grid-column:1/-1;">
                    <label>ชื่อร้านค้า (ภาษาไทย) *</label>
                    <input id="s-name" value="${saved.name||''}" placeholder="เช่น ร้านสุกี้วัสดุภัณฑ์" oninput="settingsPreviewUpdate()">
                </div>
                <div class="input-group">
                    <label>ชื่อร้าน (English)</label>
                    <input id="s-nameEn" value="${saved.nameEn||''}" placeholder="SK Materials" oninput="settingsPreviewUpdate()">
                </div>
                <div class="input-group">
                    <label>เบอร์โทรศัพท์</label>
                    <input id="s-phone" value="${saved.phone||''}" placeholder="0XX-XXX-XXXX" oninput="settingsPreviewUpdate()">
                </div>
                <div class="input-group" style="grid-column:1/-1;">
                    <label>ที่อยู่ร้าน</label>
                    <textarea id="s-address" rows="2" placeholder="ที่อยู่เต็ม" oninput="settingsPreviewUpdate()">${saved.address||''}</textarea>
                </div>
                <div class="input-group">
                    <label>เลขประจำตัวผู้เสียภาษี</label>
                    <input id="s-taxId" value="${saved.taxId||''}" placeholder="0000000000000" oninput="settingsPreviewUpdate()">
                </div>
                <div class="input-group">
                    <label>LINE ID</label>
                    <input id="s-lineId" value="${saved.lineId||''}" placeholder="@yourshop" oninput="settingsPreviewUpdate()">
                </div>
                <div class="input-group">
                    <label>Facebook</label>
                    <input id="s-facebook" value="${saved.facebook||''}" placeholder="facebook.com/yourshop" oninput="settingsPreviewUpdate()">
                </div>
                <div class="input-group">
                    <label>เว็บไซต์</label>
                    <input id="s-website" value="${saved.website||''}" placeholder="www.yourshop.com" oninput="settingsPreviewUpdate()">
                </div>
            </div>
        </div>

        <!-- TAB 2: Receipt Designer (80mm + A4) -->
        <div id="stab-content-receipt" class="stab-content" style="display:none; padding:16px 0 0;">

            <!-- Sub-tab bar -->
            <div style="display:flex; gap:0; border-bottom:2px solid var(--glass-border); margin-bottom:20px;">
                <button id="rtab-80mm" onclick="switchReceiptTab('80mm')"
                    style="padding:10px 22px; border:none; background:none; font-size:13px; font-weight:700;
                           color:var(--primary); border-bottom:3px solid var(--primary); cursor:pointer; transition:all 0.2s; margin-bottom:-2px;">
                    🧾 บิลความร้อน 80mm
                </button>
                <button id="rtab-a4" onclick="switchReceiptTab('a4')"
                    style="padding:10px 22px; border:none; background:none; font-size:13px; font-weight:700;
                           color:var(--text-3); border-bottom:3px solid transparent; cursor:pointer; transition:all 0.2s; margin-bottom:-2px;">
                    📄 ใบกำกับ A4
                </button>
            </div>

            <!-- ══════════ SUB-TAB: 80mm ══════════ -->
            <div id="rcontent-80mm">
                <div style="display:grid; grid-template-columns:1fr 320px; gap:24px; align-items:start;">

                    <!-- Controls -->
                    <div>
                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📌 ส่วนหัวบิล</div>
                        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
                            ${settingsToggle('s-showShopName','แสดงชื่อร้าน',saved.showShopName!==false)}
                            ${settingsToggle('s-showAddress','แสดงที่อยู่',saved.showAddress!==false)}
                            ${settingsToggle('s-showPhone','แสดงเบอร์โทร',saved.showPhone!==false)}
                            ${settingsToggle('s-showTaxId','แสดงเลขภาษี',saved.showTaxId!==false)}
                        </div>

                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📋 รายการสินค้า</div>
                        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
                            ${settingsToggle('s-showItemNo','แสดงลำดับรายการ',saved.showItemNo!==false)}
                            ${settingsToggle('s-showDiscount','แสดงส่วนลด',saved.showDiscount!==false)}
                            ${settingsToggle('s-showItemCost','แสดงต้นทุน (สำเนาภายใน)',saved.showItemCost||false)}
                        </div>

                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📝 ส่วนท้ายบิล</div>
                        <div class="input-group" style="margin-bottom:10px;">
                            <label>ข้อความหมายเหตุ (บรรทัด 1)</label>
                            <input id="s-note" value="${saved.note||'ขอบคุณที่ใช้บริการ'}" oninput="settingsPreviewUpdate()">
                        </div>
                        <div class="input-group" style="margin-bottom:14px;">
                            <label>ข้อความเพิ่มเติม (บรรทัด 2)</label>
                            <input id="s-note2" value="${saved.receiptNote2||''}" placeholder="เช่น สินค้าซื้อแล้วไม่รับคืน" oninput="settingsPreviewUpdate()">
                        </div>
                        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
                            ${settingsToggle('s-showStaffName','แสดงชื่อผู้รับเงิน',saved.showStaffName!==false)}
                            ${settingsToggle('s-showSigLine','แสดงเส้นลายเซ็น (ลูกค้า/ผู้ขาย)',saved.showSigLine||false)}
                            ${settingsToggle('s-showQrOnReceipt','แสดง QR Code ในบิล',saved.showQrOnReceipt||false)}
                        </div>

                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🔤 ขนาดตัวอักษร</div>
                        <div class="input-group">
                            <label>ขนาดชื่อร้าน (px)</label>
                            <select id="s-shopNameSize" onchange="settingsPreviewUpdate()" style="height:42px;">
                                ${[14,16,18,20,22].map(s=>`<option value="${s}" ${(saved.shopNameSize||16)==s?'selected':''}>${s}px</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Live Preview 80mm -->
                    <div style="position:sticky;top:0;">
                        <div style="font-size:11px;font-weight:700;color:var(--text-3);margin-bottom:8px;text-align:center;text-transform:uppercase;letter-spacing:1px;">⬛ ตัวอย่าง 80mm</div>
                        <div id="receipt-preview-box" style="
                            width:302px;background:#FFF;border:1px solid #DDD;
                            box-shadow:0 4px 20px rgba(0,0,0,0.12);border-radius:4px;
                            padding:14px 12px;font-family:'Sarabun',sans-serif;font-size:12px;
                            color:#000;margin:0 auto;line-height:1.6;
                        "></div>
                        <div style="text-align:center;margin-top:6px;font-size:10px;color:var(--text-4);">← กระดาษความร้อน 80mm →</div>
                    </div>
                </div>
            </div>

            <!-- ══════════ SUB-TAB: A4 ══════════ -->
            <div id="rcontent-a4" style="display:none;">
                <div style="display:grid; grid-template-columns:1fr 380px; gap:24px; align-items:start;">

                    <!-- Controls -->
                    <div>
                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🏷️ หัวเอกสาร A4</div>
                        <div class="input-group" style="margin-bottom:10px;">
                            <label>ชื่อเอกสาร (บรรทัดใหญ่)</label>
                            <select id="s-a4-docTitle" style="height:42px;" onchange="settingsPreviewA4Update()">
                                ${['ใบเสร็จรับเงิน / ใบส่งของ','ใบกำกับภาษี','ใบวางบิล','ใบเสนอราคา','ใบแจ้งหนี้','ใบสั่งซื้อ'].map(t=>`<option value="${t}" ${(saved.a4DocTitle||'ใบเสร็จรับเงิน / ใบส่งของ')===t?'selected':''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group" style="margin-bottom:14px;">
                            <label>คำอธิบายใต้ชื่อ (ภาษาอังกฤษ)</label>
                            <input id="s-a4-docSubTitle" value="${saved.a4DocSubTitle||'Invoice / Receipt'}" oninput="settingsPreviewA4Update()">
                        </div>

                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📌 ข้อมูลร้านใน A4</div>
                        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
                            ${settingsToggle('s-a4-showTaxId','แสดงเลขประจำตัวผู้เสียภาษี',saved.a4ShowTaxId!==false)}
                            ${settingsToggle('s-a4-showLineId','แสดง LINE ID / Facebook',saved.a4ShowLineId||false)}
                        </div>

                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📋 ตารางรายการสินค้า</div>
                        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
                            ${settingsToggle('s-a4-showItemNo','แสดงลำดับ',saved.a4ShowItemNo!==false)}
                            ${settingsToggle('s-a4-showVat','แสดงภาษีมูลค่าเพิ่ม 7%',saved.a4ShowVat!==false)}
                            ${settingsToggle('s-a4-showDiscount','แสดงส่วนลด',saved.a4ShowDiscount!==false)}
                            ${settingsToggle('s-a4-showCost','แสดงต้นทุน (สำเนาภายใน)',saved.a4ShowCost||false)}
                        </div>

                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📝 ส่วนท้ายเอกสาร</div>
                        <div class="input-group" style="margin-bottom:10px;">
                            <label>หมายเหตุ / เงื่อนไข</label>
                            <textarea id="s-a4-note" rows="2" oninput="settingsPreviewA4Update()">${saved.a4Note||saved.note||'สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน ขอบคุณที่ใช้บริการ'}</textarea>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
                            ${settingsToggle('s-a4-showSig','แสดงเส้นลายเซ็น (ผู้รับ / ผู้ขาย)',saved.a4ShowSig!==false)}
                            ${settingsToggle('s-a4-showStamp','แสดงช่องตราประทับ',saved.a4ShowStamp||false)}
                            ${settingsToggle('s-a4-showQr','แสดง QR Code',saved.showQrOnA4!==false)}
                            ${settingsToggle('s-a4-showPowered','แสดง "SK POS" ที่ footer',saved.a4ShowPowered!==false)}
                        </div>

                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🎨 สีธีมเอกสาร</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
                            ${[['#D32F2F','แดง'],['#1565C0','น้ำเงิน'],['#2E7D32','เขียว'],['#4A148C','ม่วง'],['#E65100','ส้ม'],['#37474F','เทา']].map(([c,n])=>`
                            <div onclick="document.getElementById('s-a4-color').value='${c}';settingsPreviewA4Update();"
                                 style="width:30px;height:30px;border-radius:50%;background:${c};cursor:pointer;border:3px solid transparent;transition:all 0.2s;box-shadow:0 2px 6px ${c}88;"
                                 title="${n}" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform=''"></div>`).join('')}
                            <input type="color" id="s-a4-color" value="${saved.a4Color||'#D32F2F'}"
                                   oninput="settingsPreviewA4Update()"
                                   style="width:30px;height:30px;border-radius:50%;padding:0;border:2px solid var(--glass-border);cursor:pointer;" title="เลือกสีเอง">
                            <span style="font-size:11px;color:var(--text-4);">เลือกสีเอง</span>
                        </div>

                        <div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📏 จำนวนบรรทัดว่างขั้นต่ำ</div>
                        <div class="input-group">
                            <label>บรรทัดว่างในตาราง (ทำให้บิลดูเป็นระเบียบ)</label>
                            <select id="s-a4-minRows" style="height:42px;" onchange="settingsPreviewA4Update()">
                                ${[0,3,5,8,10].map(n=>`<option value="${n}" ${(saved.a4MinRows||5)==n?'selected':''}>${n} บรรทัด</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Live Preview A4 (scaled) -->
                    <div style="position:sticky;top:0;">
                        <div style="font-size:11px;font-weight:700;color:var(--text-3);margin-bottom:8px;text-align:center;text-transform:uppercase;letter-spacing:1px;">📄 ตัวอย่าง A4 (ย่อ 50%)</div>
                        <div style="
                            width:210mm; min-height:297mm;
                            transform:scale(0.5); transform-origin:top left;
                            background:#FFF; border:1px solid #DDD;
                            box-shadow:0 4px 20px rgba(0,0,0,0.15);
                            font-family:'Sarabun',sans-serif; font-size:13px;
                            color:#333; line-height:1.5; position:relative;
                            margin-bottom:-148mm;
                        " id="a4-preview-box"></div>
                        <div style="text-align:center;margin-top:4px;font-size:10px;color:var(--text-4);">← A4 210×297mm (ย่อ 50%) →</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 3: Print Settings -->
        <div id="stab-content-print" class="stab-content" style="display:none; padding:24px 0;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div class="card" style="padding:20px; cursor:pointer; border:2px solid var(--glass-border); transition:all 0.2s;"
                     id="ptype-80mm" onclick="selectPrintType('80mm')"
                     onmouseover="this.style.borderColor='var(--primary)'" onmouseout="if(localStorage.getItem('sk_print_type')!=='80mm')this.style.borderColor='var(--glass-border)'">
                    <div style="font-size:32px; text-align:center;">🧾</div>
                    <div style="font-size:15px; font-weight:800; text-align:center; color:var(--text-1); margin-bottom:6px;">80mm Thermal</div>
                    <div style="font-size:12px; color:var(--text-3); text-align:center;">เครื่องพิมพ์ใบเสร็จ<br>กระดาษความร้อน</div>
                </div>
                <div class="card" style="padding:20px; cursor:pointer; border:2px solid var(--glass-border); transition:all 0.2s;"
                     id="ptype-a4" onclick="selectPrintType('a4')"
                     onmouseover="this.style.borderColor='var(--primary)'" onmouseout="if(localStorage.getItem('sk_print_type')!=='a4')this.style.borderColor='var(--glass-border)'">
                    <div style="font-size:32px; text-align:center; margin-bottom:12px;">📄</div>
                    <div style="font-size:15px; font-weight:800; text-align:center; color:var(--text-1); margin-bottom:6px;">A4 Invoice</div>
                    <div style="font-size:12px; color:var(--text-3); text-align:center;">ใบกำกับภาษี<br>ใบส่งของ</div>
                </div>
            </div>
            <div class="input-group" style="margin-top:16px;">
                <label>จำนวนสำเนา (copies)</label>
                <select id="s-copies" style="height:44px;">
                    <option value="1">1 สำเนา</option>
                    <option value="2">2 สำเนา</option>
                    <option value="3">3 สำเนา</option>
                </select>
            </div>
            <div style="margin-top:16px; padding:14px; background:var(--primary-subtle); border-radius:var(--r-md); border:1px solid rgba(198,40,40,0.2);">
                <div style="font-size:13px; font-weight:700; color:var(--primary); margin-bottom:4px;">💡 เคล็ดลับ</div>
                <div style="font-size:12px; color:var(--text-2);">หลังชำระเงินสำเร็จ ระบบจะถามให้เลือกพิมพ์แบบใด หรือตั้งค่าเริ่มต้นไว้ที่นี่</div>
            </div>
        </div>

        <!-- TAB 4: Payment (QR Code) -->
        <div id="stab-content-payment" class="stab-content" style="display:none; padding:24px 0;">
            <div style="display:grid; grid-template-columns:1fr auto; gap:24px; align-items:start;">
                <div>
                    <div style="font-size:13px; font-weight:800; color:var(--text-2); margin-bottom:12px;">📱 PromptPay / พร้อมเพย์</div>
                    <div class="input-group">
                        <label>เบอร์มือถือ หรือ เลขประจำตัวผู้เสียภาษี (สำหรับ QR)</label>
                        <input id="s-promptpay" value="${saved.promptpay||''}" placeholder="0XX-XXX-XXXX หรือ 0000000000000" oninput="settingsPreviewQR()">
                    </div>
                    <div class="input-group" style="margin-top:12px;">
                        <label>URL รูป QR Code (อัปโหลดไว้แล้ว)</label>
                        <div style="display:flex; gap:10px;">
                            <input id="s-qrUrl" value="${saved.qrUrl||''}" placeholder="https://..." style="flex:1;" oninput="settingsPreviewQR()">
                            <button class="btn btn-white" onclick="document.getElementById('qr-file-input').click()">
                                <i class="material-icons-round">upload</i>
                            </button>
                            <input type="file" id="qr-file-input" style="display:none;" accept="image/*" onchange="handleQrUpload(this)">
                        </div>
                    </div>
                    <div class="input-group" style="margin-top:12px;">
                        <label>ชื่อที่แสดงใต้ QR</label>
                        <input id="s-qrName" value="${saved.qrName||saved.name||''}" placeholder="ชื่อร้านหรือชื่อเจ้าของ">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:16px;">
                        ${settingsToggle('s-showQrOnReceipt2','แสดง QR ในบิล 80mm',saved.showQrOnReceipt||false)}
                        ${settingsToggle('s-showQrOnA4','แสดง QR ในใบกำกับ A4',saved.showQrOnA4!==false)}
                        ${settingsToggle('s-showQrOnCheckout','แสดง QR ในหน้าชำระเงิน',saved.showQrOnCheckout||false)}
                    </div>
                </div>
                <!-- QR Preview -->
                <div style="text-align:center; min-width:160px;">
                    <div style="font-size:11px; font-weight:700; color:var(--text-3); margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">ตัวอย่าง QR</div>
                    <div id="qr-preview" style="width:140px; height:140px; background:#F5F5F5; border:2px dashed #CCC; border-radius:12px; display:flex; align-items:center; justify-content:center; margin:0 auto;">
                        ${saved.qrUrl ? `<img src="${saved.qrUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" onerror="this.parentElement.innerHTML='❌ โหลดรูปไม่ได้'">` : '<div style="color:#CCC; font-size:12px; text-align:center;">ยังไม่มี<br>QR Code</div>'}
                    </div>
                    <div id="qr-name-preview" style="font-size:12px; color:var(--text-2); margin-top:8px; font-weight:600;">${saved.qrName||saved.name||''}</div>
                </div>
            </div>
        </div>

        <!-- TAB 5: System -->
        <div id="stab-content-system" class="stab-content" style="display:none; padding:24px 0;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div class="card" style="padding:20px;">
                    <div style="font-size:13px; font-weight:800; color:var(--text-1); margin-bottom:12px;">🎨 ธีมสี</div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        ${[['red','#C62828','แดงเข้ม'],['crimson','#B71C1C','ชาดเลือด'],['orange','#E65100','ส้มเข้ม'],['blue','#1565C0','น้ำเงิน'],['green','#2E7D32','เขียว'],['purple','#4A148C','ม่วง']].map(([k,c,n]) => `
                            <div onclick="applyThemeColor('${k}','${c}')" style="width:36px;height:36px;border-radius:50%;background:${c};cursor:pointer;border:3px solid transparent;transition:all 0.2s;box-shadow:0 2px 8px ${c}55;" title="${n}"
                                 onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform=''"></div>
                        `).join('')}
                    </div>
                </div>
                <div class="card" style="padding:20px;">
                    <div style="font-size:13px; font-weight:800; color:var(--text-1); margin-bottom:12px;">💾 ข้อมูลระบบ</div>
                    <button class="btn btn-white" style="width:100%; margin-bottom:8px;" onclick="exportAllSettings()">
                        <i class="material-icons-round">download</i> Export การตั้งค่า
                    </button>
                    <button class="btn btn-white" style="width:100%;" onclick="document.getElementById('import-settings-file').click()">
                        <i class="material-icons-round">upload</i> Import การตั้งค่า
                    </button>
                    <input type="file" id="import-settings-file" style="display:none;" accept=".json" onchange="importAllSettings(this)">
                </div>
                <div class="card" style="padding:20px; grid-column:1/-1;">
                    <div style="font-size:13px; font-weight:800; color:var(--text-1); margin-bottom:12px;">📊 เกี่ยวกับระบบ</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; font-size:12px; color:var(--text-2);">
                        <div><b>เวอร์ชัน:</b> SK POS v2.0</div>
                        <div><b>สร้างโดย:</b> SK System</div>
                        <div><b>ฐานข้อมูล:</b> Supabase</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Save button -->
        <div style="padding-top:20px; border-top:1px solid var(--glass-border); display:flex; gap:12px; justify-content:flex-end; margin-top:4px;">
            <button class="btn btn-white" onclick="closeModal()">ยกเลิก</button>
            <button class="btn btn-red" onclick="saveAllSettings()" style="min-width:140px;">
                <i class="material-icons-round">save</i> บันทึกทั้งหมด
            </button>
        </div>
    `;

    openModal('⚙️ ตั้งค่าระบบ SK POS', html, true);

    // Init print type selection
    const ptype = localStorage.getItem('sk_print_type') || '80mm';
    setTimeout(() => {
        selectPrintType(ptype, false);
        settingsPreviewUpdate();
        settingsPreviewQR();
        settingsPreviewA4Update();
    }, 50);
}

// ── Settings helpers ─────────────────────────────────────────────
function settingsToggle(id, label, checked) {
    return `
    <label style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:8px 0;">
        <div style="position:relative; width:40px; height:22px; flex-shrink:0;">
            <input type="checkbox" id="${id}" ${checked?'checked':''} onchange="settingsPreviewUpdate()"
                   style="opacity:0; width:40px; height:22px; position:absolute; top:0; left:0; margin:0; cursor:pointer; z-index:1;">
            <div style="
                position:absolute; top:0; left:0; right:0; bottom:0;
                background:var(--glass-border);
                border-radius:22px; transition:background 0.2s; pointer-events:none;
                " id="${id}-track">
                <div style="position:absolute; top:2px; left:2px; width:18px; height:18px; background:#FFF; border-radius:50%; transition:all 0.2s;" id="${id}-thumb"></div>
            </div>
        </div>
        <span style="font-size:13px; color:var(--text-2);">${label}</span>
    </label>
    <script>
    (function(){
        var cb = document.getElementById('${id}');
        var tr = document.getElementById('${id}-track');
        var th = document.getElementById('${id}-thumb');
        function upd(){ tr.style.background=cb.checked?'var(--primary)':'rgba(0,0,0,0.2)'; th.style.left=cb.checked?'':'2px'; th.style.right=cb.checked?'2px':''; }
        upd();
        cb.addEventListener('change',upd);
    })();
    <\/script>`;
}

window.switchSettingsTab = function(tab) {
    document.querySelectorAll('.stab-content').forEach(el => el.style.display = 'none');
    document.getElementById(`stab-content-${tab}`).style.display = 'block';
    document.querySelectorAll('[id^="stab-"]').forEach(btn => {
        if (btn.id === `stab-${tab}`) {
            btn.style.color = 'var(--primary)';
            btn.style.borderBottom = '3px solid var(--primary)';
        } else if (!btn.id.includes('content')) {
            btn.style.color = 'var(--text-3)';
            btn.style.borderBottom = '3px solid transparent';
        }
    });
    if (tab === 'receipt') {
        settingsPreviewUpdate();
        settingsPreviewA4Update();
    }
};

window.switchReceiptTab = function(sub) {
    ['80mm','a4'].forEach(t => {
        const content = document.getElementById(`rcontent-${t}`);
        const btn     = document.getElementById(`rtab-${t}`);
        if (content) content.style.display = t === sub ? 'block' : 'none';
        if (btn) {
            btn.style.color        = t === sub ? 'var(--primary)' : 'var(--text-3)';
            btn.style.borderBottom = t === sub ? '3px solid var(--primary)' : '3px solid transparent';
        }
    });
    if (sub === '80mm') settingsPreviewUpdate();
    if (sub === 'a4')   settingsPreviewA4Update();
};

window.settingsPreviewUpdate = function() {
    const previewBox = document.getElementById('receipt-preview-box');
    if (!previewBox) return;

    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const tog = id => { const el = document.getElementById(id); return el ? el.checked : true; };

    const name    = get('s-name')    || 'ชื่อร้านค้า';
    const phone   = get('s-phone')   || '';
    const address = get('s-address') || '';
    const taxId   = get('s-taxId')   || '';
    const note    = get('s-note')    || 'ขอบคุณที่ใช้บริการ';
    const note2   = get('s-note2')   || '';
    const qrUrl   = get('s-qrUrl')   || (getShopInfo().qrUrl || '');

    const showAddress = tog('s-showAddress');
    const showPhone   = tog('s-showPhone');
    const showTaxId   = tog('s-showTaxId');
    const showQr      = tog('s-showQrOnReceipt') || tog('s-showQrOnReceipt2');
    const showSig     = tog('s-showSigLine');
    const showStaff   = tog('s-showStaffName');

    previewBox.innerHTML = `
        <div style="text-align:center; border-bottom:1px dashed #CCC; padding-bottom:8px; margin-bottom:8px;">
            <div style="font-size:14px; font-weight:800;">${name}</div>
            ${showPhone && phone ? `<div style="font-size:10px; color:#555;">${phone}</div>` : ''}
            ${showAddress && address ? `<div style="font-size:10px; color:#555;">${address}</div>` : ''}
            ${showTaxId && taxId ? `<div style="font-size:10px; color:#555;">เลขภาษี: ${taxId}</div>` : ''}
        </div>
        <div style="font-size:10px; color:#888; text-align:center; margin-bottom:6px;">
            บิลเลขที่: #0001 | 18 มี.ค. 69 10:30
        </div>
        <div style="border-top:1px dashed #CCC; border-bottom:1px dashed #CCC; padding:6px 0; margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-bottom:3px;">
                <span>รายการสินค้า</span><span></span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px;">
                <span>ปูนซีเมนต์ ตราเสือ</span>
                <span style="white-space:nowrap; margin-left:8px; font-weight:700;">฿160</span>
            </div>
            <div style="font-size:10px; color:#888;">2 × ฿80</div>
            <div style="display:flex; justify-content:space-between; font-size:11px;">
                <span>ทรายหยาบ</span>
                <span style="white-space:nowrap; margin-left:8px; font-weight:700;">฿50</span>
            </div>
            <div style="font-size:10px; color:#888;">1 × ฿50</div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:800; margin:6px 0; color:#C62828;">
            <span>รวมสุทธิ</span><span>฿210</span>
        </div>
        <div style="font-size:10px; color:#888;">รับ ฿300 | ทอน ฿90</div>
        ${showStaff ? `<div style="font-size:10px; color:#888;">ผู้รับเงิน: เจ้าของ</div>` : ''}
        ${showQr && qrUrl ? `
        <div style="text-align:center; margin:8px 0;">
            <img src="${qrUrl}" style="width:70px; height:70px; object-fit:contain;" onerror="this.style.display='none'">
            <div style="font-size:9px; color:#888;">สแกนชำระเงิน</div>
        </div>` : showQr ? `
        <div style="text-align:center; margin:8px 0; padding:8px; border:1px dashed #CCC; border-radius:4px;">
            <div style="font-size:9px; color:#AAA;">[ QR Code ]</div>
        </div>` : ''}
        ${showSig ? `
        <div style="display:flex; gap:16px; margin-top:16px;">
            <div style="flex:1; text-align:center; border-top:1px dashed #CCC; padding-top:4px; font-size:9px; color:#AAA;">ผู้รับสินค้า</div>
            <div style="flex:1; text-align:center; border-top:1px dashed #CCC; padding-top:4px; font-size:9px; color:#AAA;">ผู้ขาย</div>
        </div>` : ''}
        <div style="text-align:center; border-top:1px dashed #CCC; margin-top:8px; padding-top:6px; font-size:10px; color:#888;">
            ${note}${note2 ? `<br>${note2}` : ''}
        </div>
    `;
};

window.settingsPreviewQR = function() {
    const qrUrl  = document.getElementById('s-qrUrl')?.value || '';
    const qrName = document.getElementById('s-qrName')?.value || '';
    const preview = document.getElementById('qr-preview');
    const nameEl  = document.getElementById('qr-name-preview');
    if (preview) {
        preview.innerHTML = qrUrl
            ? `<img src="${qrUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" onerror="this.parentElement.innerHTML='❌ โหลดรูปไม่ได้'">`
            : '<div style="color:#CCC; font-size:12px; text-align:center;">ยังไม่มี<br>QR Code</div>';
    }
    if (nameEl) nameEl.textContent = qrName;
};

// ── A4 Live Preview ──────────────────────────────────────────────
window.settingsPreviewA4Update = function() {
    const box = document.getElementById('a4-preview-box');
    if (!box) return;

    const get = id => document.getElementById(id)?.value || '';
    const tog = id => document.getElementById(id)?.checked ?? true;
    const si  = getShopInfo();

    const name     = document.getElementById('s-name')?.value    || si.name    || 'ชื่อร้านค้า';
    const nameEn   = document.getElementById('s-nameEn')?.value  || si.nameEn  || '';
    const address  = document.getElementById('s-address')?.value || si.address || '';
    const phone    = document.getElementById('s-phone')?.value   || si.phone   || '';
    const taxId    = document.getElementById('s-taxId')?.value   || si.taxId   || '';
    const lineId   = document.getElementById('s-lineId')?.value  || si.lineId  || '';
    const qrUrl    = document.getElementById('s-qrUrl')?.value   || si.qrUrl   || '';
    const qrName   = document.getElementById('s-qrName')?.value  || si.qrName  || '';

    const color    = get('s-a4-color')       || si.a4Color       || '#D32F2F';
    const docTitle = get('s-a4-docTitle')    || si.a4DocTitle    || 'ใบเสร็จรับเงิน / ใบส่งของ';
    const docSub   = get('s-a4-docSubTitle') || si.a4DocSubTitle || 'Invoice / Receipt';
    const a4Note   = get('s-a4-note')        || si.a4Note        || 'ขอบคุณที่ใช้บริการ';
    const minRows  = parseInt(get('s-a4-minRows')) || si.a4MinRows || 5;

    const showTaxId  = tog('s-a4-showTaxId');
    const showLineId = tog('s-a4-showLineId');
    const showItemNo = tog('s-a4-showItemNo');
    const showVat    = tog('s-a4-showVat');
    const showDis    = tog('s-a4-showDiscount');
    const showSig    = tog('s-a4-showSig');
    const showStamp  = tog('s-a4-showStamp');
    const showQr     = tog('s-a4-showQr');
    const showPow    = tog('s-a4-showPowered');

    const items = [
        { name:'ปูนซีเมนต์ ตราเสือ', qty:2, unit:'ถุง',  price:80, total:160 },
        { name:'ทรายหยาบ',            qty:1, unit:'กก.',  price:50, total:50  },
        { name:'เหล็กเส้น 12mm',      qty:5, unit:'เส้น', price:35, total:175 },
    ];
    const subtotal   = 385;
    const grandTotal = 385;
    const vatAmt     = Math.floor(grandTotal * 7 / 107);
    const padRows    = Math.max(0, minRows - items.length);

    box.innerHTML = `
    <div style="padding:18mm 15mm;font-family:'Sarabun',sans-serif;font-size:13px;color:#333;min-height:297mm;box-sizing:border-box;position:relative;">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${color};padding-bottom:14px;margin-bottom:14px;">
            <div>
                <div style="font-size:21px;font-weight:800;color:${color};">${name}</div>
                ${nameEn   ? `<div style="font-size:12px;color:#888;font-weight:600;">${nameEn}</div>` : ''}
                ${address  ? `<div style="font-size:11px;color:#666;margin-top:2px;">${address}</div>` : ''}
                <div style="font-size:11px;color:#666;">📞 ${phone||'-'}</div>
                ${showTaxId && taxId   ? `<div style="font-size:11px;color:#666;">🆔 เลขภาษี: ${taxId}</div>` : ''}
                ${showLineId && lineId ? `<div style="font-size:11px;color:#666;">💬 LINE: ${lineId}</div>` : ''}
            </div>
            <div style="text-align:right;">
                <div style="font-size:22px;font-weight:800;color:#333;">${docTitle}</div>
                <div style="font-size:12px;color:#888;">(${docSub})</div>
                <div style="margin-top:10px;background:#F9F9F9;border:1px solid #EEE;border-radius:6px;padding:8px 12px;text-align:left;font-size:12px;">
                    <div><b>เลขที่บิล:</b> #0001</div>
                    <div><b>วันที่:</b> 18 มี.ค. 2568</div>
                    <div><b>ผู้ขาย:</b> เจ้าของ</div>
                </div>
            </div>
        </div>

        <!-- Customer -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;font-size:12px;">
            <div style="border:1px solid #EEE;border-radius:6px;padding:10px;">
                <div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:6px;">ข้อมูลลูกค้า</div>
                <div><b>ชื่อ:</b> ลูกค้าตัวอย่าง</div>
                <div><b>ที่อยู่:</b> กรุงเทพฯ</div>
                <div><b>โทร:</b> 089-XXX-XXXX</div>
            </div>
            <div style="border:1px solid #EEE;border-radius:6px;padding:10px;">
                <div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:6px;">ชำระเงิน</div>
                <div><b>ประเภท:</b> เงินสด</div>
                <div><b>รับมา:</b> ฿400</div>
                <div><b>ทอน:</b> ฿15</div>
            </div>
        </div>

        <!-- Items Table -->
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;">
            <thead>
                <tr style="background:${color};color:#FFF;">
                    ${showItemNo ? '<th style="padding:8px 6px;text-align:center;width:36px;">#</th>' : ''}
                    <th style="padding:8px 10px;text-align:left;">รายการสินค้า</th>
                    <th style="padding:8px 6px;text-align:center;width:56px;">จำนวน</th>
                    <th style="padding:8px 6px;text-align:center;width:54px;">หน่วย</th>
                    <th style="padding:8px 8px;text-align:right;width:88px;">ราคา/หน่วย</th>
                    <th style="padding:8px 8px;text-align:right;width:96px;">จำนวนเงิน</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((it,i)=>`
                <tr style="background:${i%2?'#FAFAFA':'#FFF'};">
                    ${showItemNo ? `<td style="padding:7px 6px;text-align:center;border:1px solid #EEE;">${i+1}</td>` : ''}
                    <td style="padding:7px 10px;border:1px solid #EEE;font-weight:600;">${it.name}</td>
                    <td style="padding:7px 6px;text-align:center;border:1px solid #EEE;">${it.qty}</td>
                    <td style="padding:7px 6px;text-align:center;border:1px solid #EEE;">${it.unit}</td>
                    <td style="padding:7px 8px;text-align:right;border:1px solid #EEE;">฿${it.price}</td>
                    <td style="padding:7px 8px;text-align:right;border:1px solid #EEE;font-weight:700;">฿${it.total}</td>
                </tr>`).join('')}
                ${Array(padRows).fill('').map(()=>`
                <tr><td colspan="${showItemNo?5:4}" style="height:26px;border:1px solid #EEE;"></td></tr>`).join('')}
            </tbody>
        </table>

        <!-- Summary + Footer -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">
            <div style="flex:1;font-size:11px;color:#666;">
                <b>หมายเหตุ:</b> ${a4Note}
                ${showQr && qrUrl ? `
                <div style="margin-top:8px;">
                    <img src="${qrUrl}" style="width:60px;height:60px;object-fit:contain;">
                    <div style="font-size:10px;margin-top:2px;">${qrName}</div>
                </div>` : showQr ? `
                <div style="width:60px;height:60px;border:1px dashed #CCC;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#AAA;margin-top:8px;">QR</div>` : ''}
            </div>
            <table style="width:220px;font-size:12px;">
                <tr><td style="padding:4px 0;border:none;">รวมเป็นเงิน</td><td style="text-align:right;border:none;font-weight:600;">฿${subtotal}</td></tr>
                ${showDis ? `<tr><td style="padding:4px 0;border:none;color:#C62828;">ส่วนลด</td><td style="text-align:right;border:none;color:#C62828;">- ฿0</td></tr>` : ''}
                ${showVat ? `<tr><td style="padding:4px 0;border:none;font-size:10px;color:#888;">VAT 7% (รวมใน)</td><td style="text-align:right;border:none;font-size:10px;color:#888;">฿${vatAmt}</td></tr>` : ''}
                <tr style="border-top:2px solid ${color};">
                    <td style="padding:8px 0;font-weight:800;color:${color};font-size:14px;border:none;">ยอดรวมสุทธิ</td>
                    <td style="text-align:right;font-weight:800;color:${color};font-size:14px;border:none;">฿${grandTotal}</td>
                </tr>
            </table>
        </div>

        <!-- Signatures -->
        ${showSig ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px;">
            <div style="text-align:center;border-top:1px dashed #999;padding-top:8px;font-size:11px;color:#888;">
                ผู้รับสินค้า / Receiver
                <div style="margin-top:4px;font-size:10px;color:#BBB;">วันที่ ....../....../......</div>
            </div>
            <div style="text-align:center;border-top:1px dashed #999;padding-top:8px;font-size:11px;color:#888;">
                ผู้รับเงิน / Authorized
                ${showStamp ? `<div style="width:56px;height:56px;border:2px dashed #DDD;border-radius:50%;margin:6px auto;display:flex;align-items:center;justify-content:center;font-size:9px;color:#CCC;">ตราประทับ</div>` : ''}
                <div style="margin-top:4px;font-size:10px;color:#BBB;">วันที่ ....../....../......</div>
            </div>
        </div>` : ''}

        <!-- Footer -->
        ${showPow ? `<div style="position:absolute;bottom:10mm;left:15mm;right:15mm;text-align:center;font-size:10px;color:#CCC;border-top:1px solid #F0F0F0;padding-top:6px;">เอกสารจัดทำโดย SK POS System</div>` : ''}
    </div>`;
};

window.handleQrUpload = async function(input) {
    if (!input.files?.[0]) return;
    if (GDRIVE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
        toast('กรุณาตั้งค่า GDRIVE_SCRIPT_URL ก่อน', 'error');
        return;
    }
    toast('กำลังอัปโหลด QR Code...');
    try {
        const url = await uploadImageToDrive(input.files[0]);
        document.getElementById('s-qrUrl').value = url;
        settingsPreviewQR();
        toast('อัปโหลด QR Code สำเร็จ');
    } catch (e) {
        toast('อัปโหลดไม่สำเร็จ: ' + e.message, 'error');
    }
};

window.selectPrintType = function(type, save = true) {
    if (save) localStorage.setItem('sk_print_type', type);
    ['80mm','a4'].forEach(t => {
        const el = document.getElementById(`ptype-${t}`);
        if (el) {
            el.style.borderColor = t === type ? 'var(--primary)' : 'var(--glass-border)';
            el.style.background  = t === type ? 'var(--primary-subtle)' : '';
        }
    });
};

window.saveAllSettings = function() {
    const get = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
    const tog = id => { const el = document.getElementById(id); return el ? el.checked : undefined; };

    const config = {
        name:              get('s-name'),
        nameEn:            get('s-nameEn'),
        phone:             get('s-phone'),
        address:           get('s-address'),
        taxId:             get('s-taxId'),
        lineId:            get('s-lineId'),
        facebook:          get('s-facebook'),
        website:           get('s-website'),
        note:              get('s-note'),
        receiptNote2:      get('s-note2'),
        qrUrl:             get('s-qrUrl'),
        promptpay:         get('s-promptpay'),
        qrName:            get('s-qrName'),
        showShopName:      tog('s-showShopName'),
        showAddress:       tog('s-showAddress'),
        showPhone:         tog('s-showPhone'),
        showTaxId:         tog('s-showTaxId'),
        showItemCost:      tog('s-showItemCost'),
        showItemNo:        tog('s-showItemNo'),
        showDiscount:      tog('s-showDiscount'),
        showStaffName:     tog('s-showStaffName'),
        showSigLine:       tog('s-showSigLine'),
        showQrOnReceipt:   tog('s-showQrOnReceipt') || tog('s-showQrOnReceipt2'),
        showQrOnA4:        tog('s-a4-showQr'),
        showQrOnCheckout:  tog('s-showQrOnCheckout'),
        // ── A4 Invoice settings ───────────────────
        a4DocTitle:        get('s-a4-docTitle'),
        a4DocSubTitle:     get('s-a4-docSubTitle'),
        a4Note:            get('s-a4-note'),
        a4Color:           get('s-a4-color'),
        a4MinRows:         parseInt(get('s-a4-minRows')) || 5,
        a4ShowTaxId:       tog('s-a4-showTaxId'),
        a4ShowLineId:      tog('s-a4-showLineId'),
        a4ShowItemNo:      tog('s-a4-showItemNo'),
        a4ShowVat:         tog('s-a4-showVat'),
        a4ShowDiscount:    tog('s-a4-showDiscount'),
        a4ShowCost:        tog('s-a4-showCost'),
        a4ShowSig:         tog('s-a4-showSig'),
        a4ShowStamp:       tog('s-a4-showStamp'),
        a4ShowPowered:     tog('s-a4-showPowered'),
        // ── 80mm extra settings ───────────────────
        shopNameSize:      parseInt(get('s-shopNameSize')) || 16,
    };

    // Remove undefined values
    Object.keys(config).forEach(k => config[k] === undefined && delete config[k]);
    saveShopInfo(config);
    // อ่านจาก localStorage ที่ selectPrintType() เซตไว้แล้ว (ถูกต้อง)
    // ไม่ต้องเขียนทับด้วย style detection ที่ผิด
    toast('บันทึกการตั้งค่าทั้งหมดสำเร็จ ✅');
    closeModal();
};

window.applyThemeColor = function(key, hex) {
    document.documentElement.style.setProperty('--primary', hex);
    document.documentElement.style.setProperty('--header-bg', hex);
    localStorage.setItem('sk_theme_color', hex);
    toast(`เปลี่ยนสีธีมเป็น ${key}`);
};

window.exportAllSettings = function() {
    const data = {
        shop:   JSON.parse(localStorage.getItem('sk_shop_config') || '{}'),
        theme:  localStorage.getItem('sk_theme_color') || '',
        print:  localStorage.getItem('sk_print_type') || '80mm',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sk_pos_settings.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Export การตั้งค่าสำเร็จ');
};

window.importAllSettings = function(input) {
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.shop) saveShopInfo(data.shop);
            if (data.theme) localStorage.setItem('sk_theme_color', data.theme);
            if (data.print) localStorage.setItem('sk_print_type', data.print);
            toast('Import การตั้งค่าสำเร็จ');
            openShopSettingsModal();
        } catch (err) {
            toast('ไฟล์ไม่ถูกต้อง', 'error');
        }
    };
    reader.readAsText(input.files[0]);
};

// ── Print bill: show choice of 80mm or A4 ────────────────────────
async function printBillWithChoice(billId) {
    const pref = localStorage.getItem('sk_print_type') || 'ask';
    if (pref === '80mm') return printReceipt80mm(billId);
    if (pref === 'a4')   return exportInvoiceA4(billId);

    const { value } = await Swal.fire({
        title: '🖨️ เลือกรูปแบบพิมพ์',
        html: `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px;">
                <button onclick="Swal.clickConfirm()" data-val="80mm" class="swal2-styled"
                    style="background:#fff; color:#333; border:2px solid #ddd; border-radius:12px; padding:16px; font-size:14px;">
                    🧾<br><b>80mm Thermal</b><br><span style="font-size:11px;color:#888;">ใบเสร็จทั่วไป</span>
                </button>
                <button onclick="Swal.clickDeny()" data-val="a4" class="swal2-styled"
                    style="background:#fff; color:#333; border:2px solid #ddd; border-radius:12px; padding:16px; font-size:14px;">
                    📄<br><b>A4 Invoice</b><br><span style="font-size:11px;color:#888;">ใบกำกับภาษี</span>
                </button>
            </div>
        `,
        showConfirmButton: true,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '',
        denyButtonText: '',
        cancelButtonText: 'ยกเลิก',
        customClass: { actions: 'swal-hidden-btns' },
    });
    // fallback direct selection
    if (value === true) printReceipt80mm(billId);
    else if (value === false) exportInvoiceA4(billId);
}

// Apply saved theme color on startup
(function applyStoredTheme() {
    const hex = localStorage.getItem('sk_theme_color');
    if (hex) {
        document.documentElement.style.setProperty('--primary', hex);
        document.documentElement.style.setProperty('--header-bg', hex);
    }
})();



// [FEAT] — ระบบพิมพ์ใบเสร็จ/ใบส่งของ A4 รองรับภาษาไทย (HTML Print Preview)
async function exportInvoiceA4(billId) {
    try {
        Swal.fire({ title: 'กำลังเตรียมเอกสาร...', didOpen: () => Swal.showLoading() });

        // [V3-BUG-05] — แยก query ป้องกัน FK join error
        const { data: bill, error: berr } = await db.from('บิลขาย').select('*').eq('id', billId).single();
        const { data: items, error: ierr } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
        if (berr || ierr) throw berr || ierr;

        let custData = null;
        if (bill.customer_id) {
            const { data: c } = await db.from('customer').select('*').eq('id', bill.customer_id).single();
            custData = c;
        }
        const cust = custData || { name: bill.customer_name || 'ลูกค้าทั่วไป', address: '-', phone: '-' };

        Swal.close();

        // ดึง settings A4 จาก shopInfo
        const shopInfo    = getShopInfo();
        const color       = shopInfo.a4Color       || '#D32F2F';
        const docTitle    = shopInfo.a4DocTitle    || 'ใบเสร็จรับเงิน / ใบส่งของ';
        const docSub      = shopInfo.a4DocSubTitle || 'Invoice / Receipt';
        const a4Note      = shopInfo.a4Note        || shopInfo.note || 'สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน ขอบคุณที่ใช้บริการ';
        const minRows     = shopInfo.a4MinRows     || 5;
        const showTaxId   = shopInfo.a4ShowTaxId   !== false;
        const showLineId  = shopInfo.a4ShowLineId  === true;
        const showItemNo  = shopInfo.a4ShowItemNo  !== false;
        const showVat     = shopInfo.a4ShowVat     !== false;
        const showDis     = shopInfo.a4ShowDiscount !== false;
        const showSig     = shopInfo.a4ShowSig     !== false;
        const showStamp   = shopInfo.a4ShowStamp   === true;
        const showQrA4    = shopInfo.showQrOnA4    !== false;
        const showPowered = shopInfo.a4ShowPowered !== false;
        const qrUrl       = shopInfo.qrUrl  || '';
        const qrName      = shopInfo.qrName || '';

        const subtotal = items.reduce((s, i) => s + i.total, 0);
        const discount = bill.discount || 0;
        const grandTotal = subtotal - discount;
        // [V3-BUG-06] — VAT inclusive 7% แสดงในบิลอย่างถูกต้อง
        const vatIncluded = Math.floor(grandTotal * 7 / 107);

        // [V3-BUG-02] — ใช้ Blob URL แทน window.open() ป้องกัน popup blocker
        const htmlContent = `
            <html>
                <head>
                    <title>${docTitle} - ${bill.bill_no || billId.substring(0,8)}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Sarabun', sans-serif; padding: 20px; color: #333; line-height: 1.5; font-size: 14px; background: #f0f0f0; }
                        @page { size: A4; margin: 0; }
                        .paper { width: 210mm; min-height: 297mm; padding: 20mm; margin: 20px auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); box-sizing: border-box; position: relative; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                        th { background: ${color}; color: #FFF; border: 1px solid ${color}; padding: 10px 8px; text-align: center; font-weight: 700; }
                        td { border: 1px solid #dee2e6; padding: 9px 8px; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .sum-table td { border: none; padding: 5px 0; }
                        .sig-box { text-align: center; border-top: 1px dashed #999; padding-top: 10px; margin-top: 50px; font-size: 13px; }
                        @media print {
                            body { background: white; padding: 0; margin: 0; }
                            .paper { margin: 0; box-shadow: none; border: none; width: 100%; padding: 15mm; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="position:sticky;top:0;background:rgba(255,255,255,0.95);padding:12px;text-align:center;border-bottom:1px solid #ddd;z-index:100;">
                        <button onclick="window.print()" style="padding:10px 28px;background:${color};color:white;border:none;border-radius:5px;cursor:pointer;font-family:Sarabun;font-weight:bold;font-size:14px;">🖨 พิมพ์</button>
                        <button onclick="window.close()" style="padding:10px 20px;background:#fff;border:1px solid #ccc;border-radius:5px;cursor:pointer;margin-left:10px;font-family:Sarabun;">ยกเลิก</button>
                    </div>
                    <div class="paper">

                        <!-- Header -->
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${color};padding-bottom:16px;margin-bottom:16px;">
                            <div>
                                <div style="font-size:22px;font-weight:800;color:${color};">${shopInfo.name}</div>
                                ${shopInfo.nameEn ? `<div style="font-size:13px;color:#888;font-weight:600;">${shopInfo.nameEn}</div>` : ''}
                                ${shopInfo.address ? `<div style="font-size:13px;color:#666;margin-top:2px;">${shopInfo.address}</div>` : ''}
                                <div style="font-size:13px;color:#666;">📞 ${shopInfo.phone || '-'}</div>
                                ${showTaxId && shopInfo.taxId ? `<div style="font-size:13px;color:#666;">🆔 เลขภาษี: ${shopInfo.taxId}</div>` : ''}
                                ${showLineId && shopInfo.lineId ? `<div style="font-size:13px;color:#666;">💬 LINE: ${shopInfo.lineId}</div>` : ''}
                                ${showLineId && shopInfo.facebook ? `<div style="font-size:13px;color:#666;">📘 Facebook: ${shopInfo.facebook}</div>` : ''}
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:26px;font-weight:800;color:#333;">${docTitle}</div>
                                <div style="font-size:13px;color:#888;">(${docSub})</div>
                                <div style="margin-top:12px;background:#f9f9f9;padding:10px 14px;border:1px solid #eee;border-radius:6px;text-align:left;font-size:13px;">
                                    <div><b>เลขที่บิล:</b> #${bill.bill_no ? String(bill.bill_no).padStart(4,'0') : billId.substring(0,8).toUpperCase()}</div>
                                    <div><b>วันที่:</b> ${formatDate(bill.date)} ${formatTime(bill.date)}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Customer + Payment -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:16px;font-size:13px;">
                            <div style="border:1px solid #EEE;border-radius:6px;padding:12px;">
                                <div style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:8px;">ข้อมูลลูกค้า</div>
                                <div><b>ชื่อ:</b> ${cust.name}</div>
                                <div><b>ที่อยู่:</b> ${cust.address || '-'}</div>
                                <div><b>โทร:</b> ${cust.phone || '-'}</div>
                            </div>
                            <div style="border:1px solid #EEE;border-radius:6px;padding:12px;">
                                <div style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:8px;">วิธีชำระเงิน</div>
                                <div><b>ประเภท:</b> ${bill.method || 'เงินสด'}</div>
                                <div><b>รับมา:</b> ฿${formatNum(bill.received || grandTotal)}</div>
                                <div><b>เงินทอน:</b> ฿${formatNum((bill.received || grandTotal) - grandTotal)}</div>
                            </div>
                        </div>

                        <!-- Items Table -->
                        <table>
                            <thead>
                                <tr>
                                    ${showItemNo ? '<th width="40">ลำดับ</th>' : ''}
                                    <th style="text-align:left;">รายการสินค้า</th>
                                    <th width="70">จำนวน</th>
                                    <th width="60">หน่วย</th>
                                    <th width="100">ราคา/หน่วย</th>
                                    <th width="110">จำนวนเงิน</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map((item, idx) => `
                                <tr style="background:${idx%2?'#FAFAFA':'#FFF'};">
                                    ${showItemNo ? `<td class="text-center">${idx + 1}</td>` : ''}
                                    <td style="font-weight:600;">${item.name}</td>
                                    <td class="text-center">${item.qty}</td>
                                    <td class="text-center">${item.unit || 'ชิ้น'}</td>
                                    <td class="text-right">฿${formatNum(item.price)}</td>
                                    <td class="text-right" style="font-weight:700;">฿${formatNum(item.total)}</td>
                                </tr>`).join('')}
                                ${Array(Math.max(0, minRows - items.length)).fill('').map(()=>`
                                <tr><td colspan="${showItemNo?6:5}" style="height:32px;"></td></tr>`).join('')}
                            </tbody>
                        </table>

                        <!-- Summary + Remarks -->
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-top:8px;">
                            <div style="flex:1;font-size:13px;color:#555;border:1px solid #eee;border-radius:5px;padding:12px;background:#fafafa;">
                                <b>หมายเหตุ:</b>
                                <div style="margin-top:4px;">${bill.note || a4Note}</div>
                                ${showQrA4 && qrUrl ? `
                                <div style="margin-top:12px;text-align:center;">
                                    <img src="${qrUrl}" style="width:80px;height:80px;object-fit:contain;" onerror="this.style.display='none'">
                                    <div style="font-size:11px;color:#888;margin-top:4px;">${qrName || 'ชำระเงินผ่าน QR'}</div>
                                </div>` : ''}
                            </div>
                            <table class="sum-table" style="width:280px;">
                                <tr>
                                    <td>รวมเป็นเงิน (Sub Total)</td>
                                    <td class="text-right" style="font-weight:600;">฿${formatNum(subtotal)}</td>
                                </tr>
                                ${showDis && discount ? `
                                <tr>
                                    <td style="color:${color};">ส่วนลด (Discount)</td>
                                    <td class="text-right" style="color:${color};">- ฿${formatNum(discount)}</td>
                                </tr>` : ''}
                                ${showVat ? `
                                <tr style="font-size:12px;color:#888;">
                                    <td>VAT 7% (รวมในราคาแล้ว)</td>
                                    <td class="text-right">฿${formatNum(vatIncluded)}</td>
                                </tr>` : ''}
                                <tr style="border-top:2px solid ${color};">
                                    <td style="font-weight:800;color:${color};font-size:17px;padding-top:10px;">ยอดรวมสุทธิ</td>
                                    <td class="text-right" style="font-weight:800;color:${color};font-size:17px;padding-top:10px;">฿${formatNum(grandTotal)}</td>
                                </tr>
                            </table>
                        </div>

                        <!-- Signatures -->
                        ${showSig ? `
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px;">
                            <div class="sig-box">
                                <p>ผู้รับสินค้า (Receiver)</p>
                                <p style="margin-top:14px;font-size:11px;color:#999;">วันที่ ....../....../......</p>
                            </div>
                            <div class="sig-box">
                                <p>ผู้รับเงิน (Authorized Signature)</p>
                                ${showStamp ? `<div style="width:70px;height:70px;border:2px dashed #CCC;border-radius:50%;margin:12px auto;display:flex;align-items:center;justify-content:center;font-size:11px;color:#CCC;">ตราประทับ</div>` : ''}
                                <p style="margin-top:14px;font-size:11px;color:#999;">วันที่ ....../....../......</p>
                            </div>
                        </div>` : ''}

                        <!-- Footer -->
                        ${showPowered ? `
                        <div style="position:absolute;bottom:16mm;left:20mm;right:20mm;text-align:center;font-size:10px;color:#bbb;border-top:1px solid #f0f0f0;padding-top:8px;">
                            เอกสารนี้จัดทำขึ้นโดยระบบ SK POS System
                        </div>` : ''}

                    </div>
                </body>
            </html>
        `;
        // [V3-BUG-02] — Blob URL แทน popup ป้องกัน blocker บน iOS/Android
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href   = url;
        link.target = '_blank';
        link.rel    = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 15000);

    } catch (err) {
        toast(err.message, 'error');
    }
}
