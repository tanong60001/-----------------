/**
 * SK POS v2.0 — Complete Application (100% Implemented)
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// 1. GLOBALS & STATE
// ══════════════════════════════════════════════════════════════════
const db = supabase.createClient(SUPA_URL, SUPA_KEY);

let USER = null;
let USER_PERMS = null;
let products = [];
let cart = [];
let categories = [];
let currentPage = 'home';
let activeCategory = 'ทั้งหมด';
let isProcessingPayment = false;
let customerDisplayWindow = null;

// Checkout state
let checkoutState = {
  step: 1,
  total: 0,
  discount: 0,
  customer: { type: 'general', id: null, name: 'ลูกค้าทั่วไป' },
  method: null,
  received: 0,
  change: 0,
  receivedDenominations: {},
  changeDenominations: {},
  printFormat: '80mm'
};

// Cash denominations with correct Thai baht colors
const BILLS = [
  { value: 1000, label: '1,000', color: '#8B5E3C', bg: '#C4936A', textColor: '#fff', name: 'พัน' },
  { value: 500,  label: '500',   color: '#6B3FA0', bg: '#9B6FD0', textColor: '#fff', name: 'ห้าร้อย' },
  { value: 100,  label: '100',   color: '#C8102E', bg: '#E84060', textColor: '#fff', name: 'ร้อย' },
  { value: 50,   label: '50',    color: '#0066CC', bg: '#3388EE', textColor: '#fff', name: 'ห้าสิบ' },
  { value: 20,   label: '20',    color: '#1A7A3C', bg: '#2EA855', textColor: '#fff', name: 'ยี่สิบ' }
];

const COINS = [
  { value: 10, label: '10',  color: '#B8860B', bg: '#DAA520', textColor: '#fff', name: 'สิบ' },
  { value: 5,  label: '5',   color: '#B8860B', bg: '#DAA520', textColor: '#fff', name: 'ห้า' },
  { value: 2,  label: '2',   color: '#B8860B', bg: '#DAA520', textColor: '#fff', name: 'สอง' },
  { value: 1,  label: '1',   color: '#B8860B', bg: '#DAA520', textColor: '#fff', name: 'หนึ่ง' }
];

// Pagination for products
let productPage = 0;
const PRODUCTS_PER_PAGE = 50;
let isLoadingProducts = false;
let hasMoreProducts = true;

// ══════════════════════════════════════════════════════════════════
// 2. UTILITIES
// ══════════════════════════════════════════════════════════════════
const formatNum = (n) => Number(n || 0).toLocaleString('th-TH');
const formatDate = (d) => new Date(d).toLocaleDateString('th-TH', { dateStyle: 'medium' });
const formatTime = (d) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const formatDateTime = (d) => new Date(d).toLocaleString('th-TH');

function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
  t.innerHTML = `<i class="material-icons-round">${icons[type] || 'info'}</i><span class="toast-content">${message}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100px)'; setTimeout(() => t.remove(), 300); }, 3000);
}

function openModal(title, content) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

async function logActivity(type, details, refId = null, refTable = null) {
  try {
    await db.from('log_กิจกรรม').insert({ type, details, ref_id: refId, ref_table: refTable, username: USER?.username || 'system', time: new Date().toISOString() });
  } catch (e) { console.error('Log error:', e); }
}

// Calculate change denomination breakdown
function calcChangeDenominations(amount) {
  const result = {};
  let remaining = Math.round(amount);
  [...BILLS, ...COINS].forEach(d => {
    if (remaining >= d.value) {
      result[d.value] = Math.floor(remaining / d.value);
      remaining -= result[d.value] * d.value;
    } else {
      result[d.value] = 0;
    }
  });
  return result;
}

// Open customer display in new window
function openCustomerDisplay() {
  if (customerDisplayWindow && !customerDisplayWindow.closed) {
    customerDisplayWindow.focus();
    return;
  }
  const w = window.screen.width > 1400 ? 800 : window.screen.width / 2;
  const h = window.screen.height;
  customerDisplayWindow = window.open('customer-display.html', 'CustomerDisplay', `width=${w},height=${h},left=${window.screen.width - w},top=0,toolbar=no,menubar=no,scrollbars=no`);
}

// Send data to customer display window
function sendToDisplay(data) {
  if (customerDisplayWindow && !customerDisplayWindow.closed) {
    customerDisplayWindow.postMessage(data, '*');
  }
}

// ══════════════════════════════════════════════════════════════════
// 3. AUTHENTICATION
// ══════════════════════════════════════════════════════════════════
async function checkLogin() {
  const pin = Array.from({ length: 4 }, (_, i) => document.getElementById(`pin-${i + 1}`).value).join('');
  if (pin.length !== 4) { toast('กรุณากรอก PIN 4 หลัก', 'error'); return; }
  try {
    const { data, error } = await db.from('ผู้ใช้งาน').select('*').eq('pin', pin).single();
    if (error || !data) {
      toast('รหัส PIN ไม่ถูกต้อง', 'error');
      document.querySelectorAll('.pin-input').forEach(i => {
        i.value = '';
        i.classList.remove('filled'); // เพิ่มคำสั่งลบจุดดำ
      });
      document.getElementById('pin-1').focus();
      return;
    }
    USER = data;
    const { data: perms } = await db.from('สิทธิ์การเข้าถึง').select('*').eq('user_id', data.id).single();
    USER_PERMS = perms || {};
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');
    document.getElementById('user-display-name').textContent = data.username;
    document.getElementById('user-display-role').textContent = data.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน';
    if (data.role === 'admin') {
      document.getElementById('nav-admin-section')?.style.setProperty('display', 'block');
      document.getElementById('nav-admin')?.style.setProperty('display', 'flex');
    }
    await initApp();
    toast(`ยินดีต้อนรับ ${data.username}`, 'success');
    logActivity('เข้าสู่ระบบ', data.username);
  } catch (e) { console.error('Login error:', e); toast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error'); }
}

function logout() {
  Swal.fire({ title: 'ออกจากระบบ?', icon: 'question', showCancelButton: true, confirmButtonText: 'ออก', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626' }).then(r => {
    if (r.isConfirmed) {
      logActivity('ออกจากระบบ', USER?.username || '');
      USER = null; USER_PERMS = null; cart = [];
      document.getElementById('app-layout').classList.add('hidden');
      document.getElementById('login-screen').classList.remove('hidden');
      document.querySelectorAll('.pin-input').forEach(i => i.value = '');
      document.querySelectorAll('.pin-input').forEach(i => {
        i.value = '';
        i.classList.remove('filled'); // เพิ่มคำสั่งลบจุดดำ
      });
      document.getElementById('pin-1').focus();
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// 4. INITIALIZATION
// ══════════════════════════════════════════════════════════════════
async function initApp() {
  await Promise.all([loadProducts(), loadCategories(), loadCashBalance()]);
  updateClock();
  setInterval(updateClock, 1000);
  go('home');
  updateHomeStats();
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  document.getElementById('live-clock').textContent = `${dateStr} ${timeStr}`;
  const homeTime = document.getElementById('home-time');
  const homeDate = document.getElementById('home-date');
  if (homeTime) homeTime.textContent = timeStr;
  if (homeDate) homeDate.textContent = dateStr;
}

// ══════════════════════════════════════════════════════════════════
// 5. NAVIGATION
// ══════════════════════════════════════════════════════════════════
function go(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  document.querySelectorAll('.page-section').forEach(section => section.classList.add('hidden'));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.remove('hidden');
  const titles = {
    home: '🏠 หน้าหลัก', pos: '🛒 ขายสินค้า', inv: '📦 คลังสินค้า', cash: '💰 ลิ้นชักเงินสด',
    dash: '📊 วิเคราะห์ธุรกิจ', exp: '💸 รายจ่าย', debt: '👥 ลูกหนี้', customer: '⭐ ลูกค้าประจำ',
    purchase: '📥 รับสินค้าเข้า', history: '📜 ประวัติการขาย', att: '🪪 พนักงาน/ลงเวลา',
    log: '📑 ประวัติกิจกรรม', payable: '🏦 เจ้าหนี้ร้าน', quotation: '📄 ใบเสนอราคา', admin: '🔧 ผู้ดูแลระบบ'
  };
  document.getElementById('page-title-text').textContent = titles[page] || page;
  document.getElementById('page-actions').innerHTML = '';
  switch (page) {
    case 'home': updateHomeStats(); break;
    case 'pos':
      renderProductGrid(); renderCart();
      document.getElementById('page-actions').innerHTML = `
        <button class="btn btn-outline" onclick="openCustomerDisplay()" style="gap:6px;">
          <i class="material-icons-round" style="font-size:18px;">tv</i> หน้าจอลูกค้า
        </button>`;
      break;
    case 'inv': renderInventory(); break;
    case 'cash': renderCashDrawer(); break;
    case 'history': renderHistory(); break;
    case 'customer': renderCustomers(); break;
    case 'exp': renderExpenses(); break;
    case 'debt': renderDebts(); break;
    case 'purchase': renderPurchases(); break;
    case 'att': renderAttendance(); break;
    case 'log': renderActivityLog(); break;
    case 'payable': renderPayables(); break;
    case 'quotation': renderQuotations(); break;
    case 'dash': renderDashboard(); break;
    case 'admin': renderAdmin(); break;
  }
  document.getElementById('sidebar')?.classList.remove('show');
}

// ══════════════════════════════════════════════════════════════════
// 6. HOME PAGE
// ══════════════════════════════════════════════════════════════════
async function updateHomeStats() {
  document.getElementById('home-username').textContent = USER?.username || 'User';
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data: bills } = await db.from('บิลขาย').select('total, discount, id, status, return_info').gte('date', today + 'T00:00:00').lte('date', today + 'T23:59:59').in('status', ['สำเร็จ', 'คืนบางส่วน']);
    const totalSales = bills?.reduce((sum, b) => sum + (b.total || 0), 0) || 0;
    const ordersCount = bills?.length || 0;
    const todayBillIds = bills?.map(b => b.id) || [];
    let profit = 0;
    
    if (todayBillIds.length > 0) {
      const { data: items } = await db.from('รายการในบิล').select('total, cost, qty, bill_id, name').in('bill_id', todayBillIds);
      
      // Calculate Gross Profit from original items
      let grossProfit = (items || []).reduce((sum, i) => sum + ((i.total || 0) - ((i.cost || 0) * (i.qty || 1))), 0);
      
      // Deduct Profit lost from Returns
      let lostProfitFromReturns = 0;
      (bills || []).forEach(b => {
        if (b.status === 'คืนบางส่วน' && b.return_info?.return_items) {
          b.return_info.return_items.forEach(retItem => {
            const retQty = retItem.qty || 0;
            const retTotal = retItem.total || (retItem.price * retQty) || 0;
            // Use cost from return_info if available (v11), else lookup from bill items
            const retCost = retItem.cost || retItem.cost === 0 ? retItem.cost : 
              ((items || []).find(i => i.bill_id === b.id && i.name === retItem.name)?.cost || 0);
            lostProfitFromReturns += (retTotal - (retCost * retQty));
          });
        }
      });
      profit = grossProfit - lostProfitFromReturns;
    }
    
    const cashBalance = await getCashBalance();
    document.getElementById('home-sales').textContent = `฿${formatNum(totalSales)}`;
    document.getElementById('home-orders').textContent = formatNum(ordersCount);
    document.getElementById('home-profit').textContent = `฿${formatNum(profit)}`;
    document.getElementById('home-cash').textContent = `฿${formatNum(cashBalance)}`;
    document.getElementById('global-cash-balance').textContent = `฿${formatNum(cashBalance)}`;
    updateAlerts();
  } catch (e) { console.error('Stats error:', e); }
}

async function getCashBalance() {
  try {
    const { data: session } = await db.from('cash_session').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).single();
    if (!session) return 0;
    const { data: transactions } = await db.from('cash_transaction').select('net_amount, direction').eq('session_id', session.id);
    let balance = session.opening_amt || 0;
    (transactions || []).forEach(tx => { balance += tx.direction === 'in' ? tx.net_amount : -tx.net_amount; });
    return balance;
  } catch { return 0; }
}

async function updateAlerts() {
  const alertsList = document.getElementById('home-alerts');
  if (!alertsList) return;
  const alerts = [];
  try {
    const { data: lowStock } = await db.from('สินค้า').select('name, stock, min_stock').gt('min_stock', 0);
    const lowItems = (lowStock || []).filter(p => p.stock <= p.min_stock && p.stock > 0);
    const outItems = (lowStock || []).filter(p => p.stock <= 0);
    if (outItems.length > 0) alerts.push({ type: 'danger', icon: 'warning', text: `สินค้าหมดสต็อก ${outItems.length} รายการ` });
    if (lowItems.length > 0) alerts.push({ type: 'warning', icon: 'inventory', text: `สินค้าใกล้หมด ${lowItems.length} รายการ` });
    const { data: session } = await db.from('cash_session').select('id').eq('status', 'open').limit(1);
    if (!session || session.length === 0) alerts.push({ type: 'info', icon: 'account_balance_wallet', text: 'ยังไม่ได้เปิดรอบเงินสด' });
  } catch {}
  if (alerts.length === 0) alerts.push({ type: 'info', icon: 'check_circle', text: 'ระบบพร้อมใช้งาน' });
  alertsList.innerHTML = alerts.map(a => `<div class="alert-item alert-${a.type}"><i class="material-icons-round">${a.icon}</i><span>${a.text}</span></div>`).join('');
}

// ══════════════════════════════════════════════════════════════════
// 7. PRODUCTS & CATEGORIES
// ══════════════════════════════════════════════════════════════════
async function loadProducts() {
  try {
    const { data, error } = await db.from('สินค้า').select('*').order('name');
    if (error) throw error;
    products = data || [];
  } catch (e) { console.error('Load products error:', e); toast('ไม่สามารถโหลดสินค้าได้', 'error'); }
}

async function loadCategories() {
  try {
    const { data, error } = await db.from('categories').select('*').order('name');
    if (error) throw error;
    categories = data || [];
    renderCategories();
  } catch (e) { console.error('Load categories error:', e); }
}

function renderCategories() {
  const container = document.getElementById('pos-categories');
  if (!container) return;
  const cats = ['ทั้งหมด', ...categories.map(c => c.name)];
  container.innerHTML = cats.map(cat => `<button class="cat-tab ${cat === activeCategory ? 'active' : ''}" data-cat="${cat}" onclick="filterByCategory('${cat}')">${cat}</button>`).join('');
}

function filterByCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.cat === cat));
  renderProductGrid();
}

function renderProductGrid() {
  const container = document.getElementById('pos-product-grid');
  if (!container) return;
  const searchTerm = document.getElementById('pos-search')?.value?.toLowerCase() || '';
  const viewMode = document.querySelector('.view-btn.active')?.dataset?.view || 'grid';
  let filtered = products.filter(p => {
    const matchSearch = !searchTerm || p.name?.toLowerCase().includes(searchTerm) || p.barcode?.toLowerCase().includes(searchTerm);
    const matchCategory = activeCategory === 'ทั้งหมด' || p.category === activeCategory;
    return matchSearch && matchCategory;
  });
  document.getElementById('products-count').textContent = `แสดง ${filtered.length} จาก ${products.length} รายการ`;
  if (viewMode === 'list') {
    container.className = 'product-list';
    container.innerHTML = filtered.map(p => {
      const inCart = cart.find(c => c.id === p.id);
      const isLow = p.stock <= (p.min_stock || 0) && p.stock > 0;
      const isOut = p.stock <= 0;
      return `<div class="product-list-item ${isOut ? 'out-of-stock' : ''}" onclick="addToCart('${p.id}')">
        <div class="product-list-img">${p.img_url ? `<img src="${p.img_url}" alt="${p.name}" loading="lazy">` : `<i class="material-icons-round">inventory_2</i>`}</div>
        <div class="product-list-info">
          <div class="product-name">${p.name}</div>
          <div class="product-sku">${p.barcode || '-'}</div>
        </div>
        <div class="product-list-right">
          <span class="product-price">฿${formatNum(p.price)}</span>
          <span class="product-stock ${isLow ? 'low' : ''} ${isOut ? 'out' : ''}">${isOut ? 'หมด' : `${formatNum(p.stock)}`}</span>
          ${inCart ? `<span class="product-badge">${inCart.qty}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  } else {
    container.className = 'product-grid';
    container.innerHTML = filtered.map(p => {
      const inCart = cart.find(c => c.id === p.id);
      const isLow = p.stock <= (p.min_stock || 0) && p.stock > 0;
      const isOut = p.stock <= 0;
      return `<div class="product-card ${isOut ? 'out-of-stock' : ''}" onclick="addToCart('${p.id}')">
        <div class="product-img">
          ${p.img_url ? `<img src="${p.img_url}" alt="${p.name}" loading="lazy">` : `<i class="material-icons-round">inventory_2</i>`}
          ${inCart ? `<span class="product-badge">${inCart.qty}</span>` : ''}
        </div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-sku">${p.barcode || '-'}</div>
          <div class="product-footer">
            <span class="product-price">฿${formatNum(p.price)}</span>
            <span class="product-stock ${isLow ? 'low' : ''} ${isOut ? 'out' : ''}">${isOut ? 'หมด' : `${formatNum(p.stock)}`}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }
}

// ══════════════════════════════════════════════════════════════════
// 8. CART MANAGEMENT
// ══════════════════════════════════════════════════════════════════
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  if (product.stock <= 0) { toast('สินค้าหมดสต็อก', 'error'); return; }
  const existing = cart.find(c => c.id === productId);
  if (existing) {
    if (existing.qty >= product.stock) { toast('สินค้าไม่เพียงพอ', 'warning'); return; }
    existing.qty++;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, cost: product.cost || 0, qty: 1, stock: product.stock, unit: product.unit || 'ชิ้น' });
  }
  renderCart(); renderProductGrid();
  sendToDisplay({ type: 'cart', cart, total: getCartTotal() });
}

function updateCartQty(productId, delta) {
  const item = cart.find(c => c.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { cart = cart.filter(c => c.id !== productId); }
  else if (item.qty > item.stock) { item.qty = item.stock; toast('สินค้าไม่เพียงพอ', 'warning'); }
  renderCart(); renderProductGrid();
  sendToDisplay({ type: 'cart', cart, total: getCartTotal() });
}

function removeFromCart(productId) {
  cart = cart.filter(c => c.id !== productId);
  renderCart(); renderProductGrid();
  sendToDisplay({ type: 'cart', cart, total: getCartTotal() });
}

function clearCart() {
  if (cart.length === 0) return;
  Swal.fire({ title: 'ล้างตะกร้า?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ล้าง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626' }).then(r => {
    if (r.isConfirmed) { cart = []; renderCart(); renderProductGrid(); }
  });
}

function getCartTotal() {
  const discount = Number(document.getElementById('pos-discount')?.value || 0);
  const subtotal = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  return Math.max(0, subtotal - discount);
}

function renderCart() {
  const container = document.getElementById('cart-list');
  const countBadge = document.getElementById('cart-count');
  const totalDisplay = document.getElementById('pos-total');
  const checkoutBtn = document.getElementById('checkout-btn');
  if (!container) return;
  const totalItems = cart.reduce((sum, c) => sum + c.qty, 0);
  const total = getCartTotal();
  countBadge.textContent = totalItems;
  totalDisplay.textContent = `฿${formatNum(total)}`;
  checkoutBtn.disabled = cart.length === 0;
  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty"><i class="material-icons-round">shopping_basket</i><p>ไม่มีสินค้าในตะกร้า</p><span>เลือกสินค้าจากรายการด้านซ้าย</span></div>`;
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-price">฿${formatNum(item.price)} × ${item.qty}</span>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">−</button>
        <span class="qty-value">${item.qty}</span>
        <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
      </div>
      <span class="cart-item-total">฿${formatNum(item.price * item.qty)}</span>
      <button class="cart-item-delete" onclick="removeFromCart('${item.id}')"><i class="material-icons-round">close</i></button>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════════
// 9. CHECKOUT FLOW
// ══════════════════════════════════════════════════════════════════
function startCheckout() {
  if (cart.length === 0) return;
  const discount = Number(document.getElementById('pos-discount')?.value || 0);
  const subtotal = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  const total = Math.max(0, subtotal - discount);
  checkoutState = {
    step: 1, total, discount,
    customer: { type: 'general', id: null, name: 'ลูกค้าทั่วไป' },
    method: null, received: 0, change: 0,
    receivedDenominations: {}, changeDenominations: {},
    printFormat: document.querySelector('input[name="print-format"]:checked')?.value || '80mm'
  };
  [...BILLS, ...COINS].forEach(d => { checkoutState.receivedDenominations[d.value] = 0; checkoutState.changeDenominations[d.value] = 0; });
  document.getElementById('checkout-overlay').classList.remove('hidden');
  renderCheckoutStep();
}

function closeCheckout() {
  document.getElementById('checkout-overlay').classList.add('hidden');
  checkoutState.step = 1;
}

function nextCheckoutStep() {
  if (checkoutState.step === 1 && !checkoutState.customer.type) { toast('กรุณาเลือกประเภทลูกค้า', 'warning'); return; }
  if (checkoutState.step === 2 && !checkoutState.method) { toast('กรุณาเลือกวิธีชำระเงิน', 'warning'); return; }
  if (checkoutState.step === 3 && checkoutState.method === 'cash') {
    const received = Object.entries(checkoutState.receivedDenominations).reduce((s, [v, c]) => s + Number(v) * c, 0);
    if (received < checkoutState.total) { toast('ยอดรับเงินไม่เพียงพอ', 'error'); return; }
    checkoutState.received = received;
    checkoutState.change = received - checkoutState.total;
    checkoutState.changeDenominations = calcChangeDenominations(checkoutState.change);
  }
  if (checkoutState.step === 4) { completePayment(); return; }
  // Skip step 3 cash counting to step 3 confirmation for non-cash
  if (checkoutState.step === 2 && checkoutState.method !== 'cash') {
    checkoutState.received = checkoutState.total;
    checkoutState.change = 0;
    checkoutState.step = 4;
    renderCheckoutStep();
    return;
  }
  checkoutState.step++;
  renderCheckoutStep();
  sendToDisplay({ type: 'checkout', step: checkoutState.step, total: checkoutState.total, method: checkoutState.method, received: checkoutState.received, change: checkoutState.change });
}

function prevCheckoutStep() {
  if (checkoutState.step === 4 && checkoutState.method !== 'cash') { checkoutState.step = 2; }
  else if (checkoutState.step > 1) { checkoutState.step--; }
  renderCheckoutStep();
}

function renderCheckoutStep() {
  const content = document.getElementById('checkout-content');
  const backBtn = document.getElementById('checkout-back');
  const nextBtn = document.getElementById('checkout-next');
  document.querySelectorAll('.progress-step').forEach((step, i) => {
    const n = i + 1;
    step.classList.remove('active', 'completed');
    if (n === checkoutState.step) step.classList.add('active');
    else if (n < checkoutState.step) step.classList.add('completed');
  });
  backBtn.style.display = checkoutState.step > 1 ? 'flex' : 'none';
  if (checkoutState.step === 4) nextBtn.innerHTML = `<i class="material-icons-round">check</i> บันทึกการขาย`;
  else nextBtn.innerHTML = `ถัดไป <i class="material-icons-round">arrow_forward</i>`;
  switch (checkoutState.step) {
    case 1: renderStep1(content); break;
    case 2: renderStep2(content); break;
    case 3: renderStep3(content); break;
    case 4: renderStep4(content); break;
  }
}

function renderStep1(container) {
  container.innerHTML = `
    <div class="customer-selection">
      <div class="customer-type-btn ${checkoutState.customer.type === 'general' ? 'selected' : ''}" onclick="selectCustomerType('general')">
        <div class="customer-type-icon"><i class="material-icons-round">person</i></div>
        <div class="customer-type-info"><h4>ลูกค้าทั่วไป</h4><p>ไม่ระบุข้อมูลลูกค้า</p></div>
      </div>
      <div class="customer-type-btn ${checkoutState.customer.type === 'member' ? 'selected' : ''}" onclick="selectCustomerType('member')">
        <div class="customer-type-icon"><i class="material-icons-round">star</i></div>
        <div class="customer-type-info"><h4>ลูกค้าประจำ</h4><p>เลือกจากรายชื่อที่มีอยู่</p></div>
      </div>
      <div class="customer-type-btn ${checkoutState.customer.type === 'new' ? 'selected' : ''}" onclick="selectCustomerType('new')">
        <div class="customer-type-icon"><i class="material-icons-round">person_add</i></div>
        <div class="customer-type-info"><h4>เพิ่มลูกค้าใหม่</h4><p>สร้างข้อมูลลูกค้าใหม่</p></div>
      </div>
    </div>
    <div id="customer-selection-extra"></div>`;
}

async function selectCustomerType(type) {
  checkoutState.customer.type = type;
  document.querySelectorAll('.customer-type-btn').forEach(btn => btn.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  const extra = document.getElementById('customer-selection-extra');
  if (type === 'general') {
    checkoutState.customer = { type: 'general', id: null, name: 'ลูกค้าทั่วไป' };
    extra.innerHTML = '';
  } else if (type === 'member') {
    const { data: customers } = await db.from('customer').select('*').order('name');
    extra.innerHTML = `<div style="margin-top:16px;">
      <input type="text" class="form-input" placeholder="ค้นหาลูกค้า..." id="customer-search" oninput="filterCustomerList()" style="margin-bottom:10px;">
      <div id="customer-list" style="max-height:200px;overflow-y:auto;">
        ${(customers || []).map(c => {
          const safeName = c.name.replace(/'/g, '&apos;');
          return `<div class="customer-type-btn" style="padding:12px;margin-bottom:8px;" onclick="selectCustomer('${c.id}','${safeName}')">
          <div class="customer-type-info"><h4>${c.name}</h4><p>${c.phone || '-'} | ยอดสะสม ฿${formatNum(c.total_purchase)}</p></div>
        </div>`;
        }).join('')}
      </div></div>`;
  } else {
    extra.innerHTML = `<div style="margin-top:16px;">
      <div class="form-group"><label class="form-label">ชื่อลูกค้า *</label><input type="text" class="form-input" id="new-customer-name" placeholder="ชื่อ-นามสกุล"></div>
      <div class="form-group"><label class="form-label">เบอร์โทร</label><input type="tel" class="form-input" id="new-customer-phone" placeholder="0XX-XXX-XXXX"></div>
      <button class="btn btn-primary" onclick="createNewCustomer()" style="width:100%;"><i class="material-icons-round">person_add</i> บันทึกลูกค้าใหม่</button>
    </div>`;
  }
}

function selectCustomer(id, name) {
  checkoutState.customer = { type: 'member', id, name };
  document.querySelectorAll('#customer-list .customer-type-btn').forEach(btn => btn.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  toast(`เลือกลูกค้า: ${name}`, 'success');
}

async function createNewCustomer() {
  const name = document.getElementById('new-customer-name').value.trim();
  const phone = document.getElementById('new-customer-phone').value.trim();
  if (!name) { toast('กรุณากรอกชื่อลูกค้า', 'error'); return; }
  try {
    const { data, error } = await db.from('customer').insert({ name, phone }).select().single();
    if (error) throw error;
    checkoutState.customer = { type: 'new', id: data.id, name: data.name };
    toast('เพิ่มลูกค้าใหม่สำเร็จ', 'success');
    document.getElementById('new-customer-name').value = '';
    document.getElementById('new-customer-phone').value = '';
  } catch (e) { toast('ไม่สามารถเพิ่มลูกค้าได้', 'error'); }
}

function filterCustomerList() {
  const q = document.getElementById('customer-search').value.toLowerCase();
  document.querySelectorAll('#customer-list .customer-type-btn').forEach(btn => {
    const name = btn.querySelector('h4')?.textContent.toLowerCase() || '';
    btn.style.display = name.includes(q) ? '' : 'none';
  });
}

function renderStep2(container) {
  container.innerHTML = `
    <div class="step2-wrap">
      <div class="amount-display" style="margin-bottom:24px;">
        <div class="amount-label">ยอดที่ต้องชำระ</div>
        <div class="amount-value">฿${formatNum(checkoutState.total)}</div>
      </div>
      <div class="payment-methods">
        <button class="payment-method-btn ${checkoutState.method === 'cash' ? 'selected' : ''}" onclick="selectPaymentMethod('cash')">
          <i class="material-icons-round">payments</i><span>เงินสด</span>
        </button>
        <button class="payment-method-btn ${checkoutState.method === 'transfer' ? 'selected' : ''}" onclick="selectPaymentMethod('transfer')">
          <i class="material-icons-round">qr_code</i><span>โอน/พร้อมเพย์</span>
        </button>
        <button class="payment-method-btn ${checkoutState.method === 'credit' ? 'selected' : ''}" onclick="selectPaymentMethod('credit')">
          <i class="material-icons-round">credit_card</i><span>บัตรเครดิต</span>
        </button>
        <button class="payment-method-btn ${checkoutState.method === 'debt' ? 'selected' : ''}" onclick="selectPaymentMethod('debt')" ${checkoutState.customer.type === 'general' ? 'disabled style="opacity:.5"' : ''}>
          <i class="material-icons-round">access_time</i><span>ติดหนี้</span>
        </button>
      </div>
      <div id="payment-qr-section" style="display:none; text-align:center; margin-top:20px; padding:20px; background:var(--bg-base); border-radius:var(--radius-md);">
        <img id="promptpay-qr" src="" alt="QR PromptPay" style="width:200px;height:200px;border-radius:12px;border:3px solid var(--primary);">
        <p style="margin-top:12px;color:var(--text-secondary);font-size:14px;">สแกน QR เพื่อโอนเงิน</p>
        <p style="font-weight:700;font-size:20px;color:var(--primary);">฿${formatNum(checkoutState.total)}</p>
      </div>
    </div>`;
}

function selectPaymentMethod(method) {
  if (method === 'debt' && checkoutState.customer.type === 'general') { toast('ติดหนี้ได้เฉพาะลูกค้าประจำ', 'warning'); return; }
  checkoutState.method = method;
  document.querySelectorAll('.payment-method-btn').forEach(btn => btn.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  const qrSection = document.getElementById('payment-qr-section');
  if (qrSection) {
    if (method === 'transfer') {
      qrSection.style.display = 'block';
      // Use PromptPay QR from shop config or generate via API
      const qrUrl = SHOP_CONFIG.promptpay_qr_url || `https://promptpay.io/${SHOP_CONFIG.phone?.replace(/-/g,'')}/${checkoutState.total}.png`;
      document.getElementById('promptpay-qr').src = qrUrl;
      sendToDisplay({ type: 'qr', amount: checkoutState.total, qrUrl });
    } else {
      qrSection.style.display = 'none';
    }
  }
  sendToDisplay({ type: 'payment_method', method, total: checkoutState.total });
}

// Step 3: Cash counting — two sub-steps: receive then change
function renderStep3(container) {
  const received = Object.entries(checkoutState.receivedDenominations).reduce((s, [v, c]) => s + Number(v) * c, 0);
  const diff = received - checkoutState.total;
  container.innerHTML = `
    <div class="cash-counting">
      <div class="cash-counting-header">
        <div class="cash-total-needed">
          <span>ยอดที่ต้องชำระ</span>
          <strong>฿${formatNum(checkoutState.total)}</strong>
        </div>
        <div class="cash-received-total ${diff >= 0 ? 'positive' : ''}">
          <span>รับมาแล้ว</span>
          <strong>฿${formatNum(received)}</strong>
        </div>
        <div class="cash-diff ${diff >= 0 ? 'positive' : 'negative'}">
          <span>${diff >= 0 ? 'เงินทอน' : 'ยังขาด'}</span>
          <strong>${diff >= 0 ? '฿' + formatNum(diff) : '-฿' + formatNum(Math.abs(diff))}</strong>
        </div>
      </div>

      <h4 class="denom-section-title"><i class="material-icons-round">payments</i> ธนบัตรที่รับมา</h4>
      <div class="denomination-grid">
        ${BILLS.map(d => `
          <div class="denom-card" data-value="${d.value}" style="--denom-bg:${d.bg};--denom-color:${d.color}" onclick="tapDenom(${d.value},'received')">
            <div class="denom-card-inner">
              <div class="denom-face">฿${d.label}</div>
              <div class="denom-count-badge">${checkoutState.receivedDenominations[d.value] || 0}</div>
            </div>
            <div class="denom-subtotal">= ฿${formatNum((checkoutState.receivedDenominations[d.value] || 0) * d.value)}</div>
            <div class="denom-controls">
              <button onclick="event.stopPropagation();updateDenomReceive(${d.value},-1)" class="denom-minus-btn">−</button>
              <span class="denom-qty">${checkoutState.receivedDenominations[d.value] || 0}</span>
              <button onclick="event.stopPropagation();updateDenomReceive(${d.value},1)" class="denom-plus-btn">+</button>
            </div>
          </div>`).join('')}
      </div>

      <h4 class="denom-section-title coins"><i class="material-icons-round">toll</i> เหรียญที่รับมา</h4>
      <div class="denomination-grid coins-grid">
        ${COINS.map(d => `
          <div class="denom-card coin-card" data-value="${d.value}" onclick="tapDenom(${d.value},'received')">
            <div class="denom-card-inner">
              <div class="denom-face coin-face">฿${d.label}</div>
              <div class="denom-count-badge">${checkoutState.receivedDenominations[d.value] || 0}</div>
            </div>
            <div class="denom-subtotal">= ฿${formatNum((checkoutState.receivedDenominations[d.value] || 0) * d.value)}</div>
            <div class="denom-controls">
              <button onclick="event.stopPropagation();updateDenomReceive(${d.value},-1)" class="denom-minus-btn">−</button>
              <span class="denom-qty">${checkoutState.receivedDenominations[d.value] || 0}</span>
              <button onclick="event.stopPropagation();updateDenomReceive(${d.value},1)" class="denom-plus-btn">+</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function tapDenom(value, mode) {
  if (mode === 'received') updateDenomReceive(value, 1);
  else updateDenomChange(value, 1);
}

function updateDenomReceive(value, delta) {
  const cur = checkoutState.receivedDenominations[value] || 0;
  checkoutState.receivedDenominations[value] = Math.max(0, cur + delta);
  renderStep3(document.getElementById('checkout-content'));
}

function updateDenomChange(value, delta) {
  const cur = checkoutState.changeDenominations[value] || 0;
  checkoutState.changeDenominations[value] = Math.max(0, cur + delta);
  renderStep4(document.getElementById('checkout-content'));
}

function renderStep4(container) {
  const change = checkoutState.change;
  const autoBreakdown = calcChangeDenominations(change);
  // Use auto breakdown if user hasn't manually set change denoms
  const hasManual = Object.values(checkoutState.changeDenominations).some(v => v > 0);
  if (!hasManual) checkoutState.changeDenominations = { ...autoBreakdown };
  const changeCountedTotal = Object.entries(checkoutState.changeDenominations).reduce((s, [v, c]) => s + Number(v) * c, 0);
  const diff = changeCountedTotal - change;

  container.innerHTML = `
    <div class="cash-counting">
      <div class="cash-counting-header change-header">
        <div class="cash-total-needed">
          <span>รับเงินมา</span>
          <strong>฿${formatNum(checkoutState.received)}</strong>
        </div>
        <div class="cash-received-total positive">
          <span>เงินทอนทั้งหมด</span>
          <strong style="color:var(--success)">฿${formatNum(change)}</strong>
        </div>
        <div class="cash-diff ${Math.abs(diff) < 1 ? 'positive' : 'negative'}">
          <span>นับได้</span>
          <strong>฿${formatNum(changeCountedTotal)}</strong>
        </div>
      </div>

      <div style="background:var(--bg-base);border-radius:var(--radius-md);padding:16px;margin-bottom:16px;border:1px solid var(--border-light);">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:var(--text-secondary);">ลูกค้า</span><strong>${checkoutState.customer.name}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:var(--text-secondary);">วิธีชำระ</span><strong>${{ cash:'เงินสด', transfer:'โอน/พร้อมเพย์', credit:'บัตรเครดิต', debt:'ติดหนี้' }[checkoutState.method]}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:var(--text-secondary);">ยอดรวม</span><strong style="color:var(--primary)">฿${formatNum(checkoutState.total)}</strong></div>
      </div>

      ${change > 0 ? `
        <h4 class="denom-section-title"><i class="material-icons-round">payments</i> ทอนเงิน — คลิกเพื่อนับ</h4>
        <div class="denomination-grid">
          ${BILLS.map(d => `
            <div class="denom-card ${checkoutState.changeDenominations[d.value] > 0 ? 'active-change' : ''}" style="--denom-bg:${d.bg};--denom-color:${d.color}" onclick="tapDenom(${d.value},'change')">
              <div class="denom-card-inner">
                <div class="denom-face">฿${d.label}</div>
                <div class="denom-count-badge">${checkoutState.changeDenominations[d.value] || 0}</div>
              </div>
              <div class="denom-subtotal">= ฿${formatNum((checkoutState.changeDenominations[d.value] || 0) * d.value)}</div>
              <div class="denom-controls">
                <button onclick="event.stopPropagation();updateDenomChange(${d.value},-1)" class="denom-minus-btn">−</button>
                <span class="denom-qty">${checkoutState.changeDenominations[d.value] || 0}</span>
                <button onclick="event.stopPropagation();updateDenomChange(${d.value},1)" class="denom-plus-btn">+</button>
              </div>
            </div>`).join('')}
        </div>
        <div class="denomination-grid coins-grid">
          ${COINS.map(d => `
            <div class="denom-card coin-card ${checkoutState.changeDenominations[d.value] > 0 ? 'active-change' : ''}" onclick="tapDenom(${d.value},'change')">
              <div class="denom-card-inner">
                <div class="denom-face coin-face">฿${d.label}</div>
                <div class="denom-count-badge">${checkoutState.changeDenominations[d.value] || 0}</div>
              </div>
              <div class="denom-subtotal">= ฿${formatNum((checkoutState.changeDenominations[d.value] || 0) * d.value)}</div>
              <div class="denom-controls">
                <button onclick="event.stopPropagation();updateDenomChange(${d.value},-1)" class="denom-minus-btn">−</button>
                <span class="denom-qty">${checkoutState.changeDenominations[d.value] || 0}</span>
                <button onclick="event.stopPropagation();updateDenomChange(${d.value},1)" class="denom-plus-btn">+</button>
              </div>
            </div>`).join('')}
        </div>
      ` : `<div style="text-align:center;padding:30px;"><div style="font-size:48px;">✅</div><p style="font-size:20px;font-weight:700;color:var(--success);margin-top:8px;">ไม่มีเงินทอน</p></div>`}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
// 10. COMPLETE PAYMENT
// ══════════════════════════════════════════════════════════════════
async function completePayment() {
  if (isProcessingPayment) return;
  isProcessingPayment = true;
  try {
    const { data: session } = await db.from('cash_session').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).single();
    const { data: bill, error: billError } = await db.from('บิลขาย').insert({
      date: new Date().toISOString(),
      method: { cash:'เงินสด', transfer:'โอนเงิน', credit:'บัตรเครดิต', debt:'ติดหนี้' }[checkoutState.method] || 'เงินสด',
      total: checkoutState.total, discount: checkoutState.discount,
      received: checkoutState.received, change: checkoutState.change,
      customer_name: checkoutState.customer.name, customer_id: checkoutState.customer.id || null,
      staff_name: USER?.username, status: checkoutState.method === 'debt' ? 'ค้างชำระ' : 'สำเร็จ',
      denominations: checkoutState.receivedDenominations
    }).select().single();
    if (billError) throw billError;
    for (const item of cart) {
      const prod = products.find(p => p.id === item.id);
      await db.from('รายการในบิล').insert({ bill_id: bill.id, product_id: item.id, name: item.name, qty: item.qty, price: item.price, cost: item.cost, total: item.price * item.qty });
      await db.from('สินค้า').update({ stock: (prod?.stock || 0) - item.qty }).eq('id', item.id);
      await db.from('stock_movement').insert({ product_id: item.id, product_name: item.name, type: 'ขาย', direction: 'out', qty: item.qty, stock_before: prod?.stock || 0, stock_after: (prod?.stock || 0) - item.qty, ref_id: bill.id, ref_table: 'บิลขาย', staff_name: USER?.username });
    }
    if (checkoutState.method === 'cash' && session) {
      await db.from('cash_transaction').insert({ session_id: session.id, type: 'ขาย', direction: 'in', amount: checkoutState.received, change_amt: checkoutState.change, net_amount: checkoutState.total, balance_after: 0, ref_id: bill.id, ref_table: 'บิลขาย', staff_name: USER?.username, denominations: checkoutState.receivedDenominations });
    }
    if (checkoutState.customer.id) {
      const { data: cust } = await db.from('customer').select('total_purchase, visit_count, debt_amount').eq('id', checkoutState.customer.id).single();
      await db.from('customer').update({ total_purchase: (cust?.total_purchase || 0) + checkoutState.total, visit_count: (cust?.visit_count || 0) + 1, debt_amount: checkoutState.method === 'debt' ? (cust?.debt_amount || 0) + checkoutState.total : (cust?.debt_amount || 0) }).eq('id', checkoutState.customer.id);
    }
    logActivity('ขายสินค้า', `บิล #${bill.bill_no} ยอด ฿${formatNum(checkoutState.total)}`, bill.id, 'บิลขาย');
    sendToDisplay({ type: 'thanks', billNo: bill.bill_no, total: checkoutState.total });
    closeCheckout();
    cart = [];
    await loadProducts();
    renderCart(); renderProductGrid(); updateHomeStats();
    Swal.fire({ icon: 'success', title: 'บันทึกการขายสำเร็จ', text: `บิล #${bill.bill_no} | ยอด ฿${formatNum(checkoutState.total)}`, confirmButtonColor: '#10B981', timer: 3000, timerProgressBar: true });
  } catch (e) {
    console.error('Payment error:', e);
    toast('เกิดข้อผิดพลาดในการบันทึก', 'error');
  } finally { isProcessingPayment = false; }
}

// ══════════════════════════════════════════════════════════════════
// 12. INVENTORY PAGE
// ══════════════════════════════════════════════════════════════════
async function renderInventory() {
  const tbody = document.getElementById('inv-tbody');
  if (!tbody) return;
  await loadProducts();
  const search = document.getElementById('inv-search')?.value?.toLowerCase() || '';
  let filtered = products.filter(p => !search || p.name?.toLowerCase().includes(search) || p.barcode?.toLowerCase().includes(search));
  const total = products.length;
  const low = products.filter(p => p.stock <= (p.min_stock || 0) && p.stock > 0).length;
  const out = products.filter(p => p.stock <= 0).length;
  const value = products.reduce((sum, p) => sum + ((p.cost || 0) * (p.stock || 0)), 0);
  document.getElementById('inv-total').textContent = formatNum(total);
  document.getElementById('inv-low').textContent = formatNum(low);
  document.getElementById('inv-out').textContent = formatNum(out);
  document.getElementById('inv-value').textContent = `฿${formatNum(value)}`;
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><div class="product-img-cell">${p.img_url ? `<img src="${p.img_url}" alt="${p.name}">` : `<i class="material-icons-round" style="color:var(--text-muted);">image</i>`}</div></td>
      <td><strong>${p.name}</strong><br><small style="color:var(--text-tertiary);">${p.note || ''}</small></td>
      <td style="font-family:var(--font-display);font-size:12px;">${p.barcode || '-'}</td>
      <td><span class="badge" style="background:var(--primary-50);color:var(--primary);">${p.category || '-'}</span></td>
      <td class="text-right"><strong>฿${formatNum(p.price)}</strong></td>
      <td class="text-right">฿${formatNum(p.cost || 0)}</td>
      <td class="text-center"><span class="badge ${p.stock <= 0 ? 'badge-danger' : p.stock <= (p.min_stock || 0) ? 'badge-warning' : 'badge-success'}">${formatNum(p.stock)} ${p.unit || ''}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-icon" onclick="editProduct('${p.id}')" title="แก้ไข"><i class="material-icons-round">edit</i></button>
          <button class="btn btn-ghost btn-icon" onclick="adjustStock('${p.id}')" title="ปรับสต็อก"><i class="material-icons-round">tune</i></button>
          <button class="btn btn-ghost btn-icon" onclick="generateBarcode('${p.id}')" title="บาร์โค้ด"><i class="material-icons-round">qr_code</i></button>
          <button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="deleteProduct('${p.id}')" title="ลบ"><i class="material-icons-round">delete</i></button>
        </div>
      </td>
    </tr>`).join('');
  document.getElementById('page-actions').innerHTML = `
    <button class="btn btn-outline" onclick="exportInventory()"><i class="material-icons-round">download</i> ส่งออก CSV</button>
    <button class="btn btn-primary" onclick="showAddProductModal()"><i class="material-icons-round">add</i> เพิ่มสินค้า</button>`;
  document.getElementById('inv-search')?.addEventListener('input', renderInventory);
}

function showAddProductModal(productData = null) {
  const isEdit = !!productData;
  openModal(isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่', `
    <form id="product-form">
      <div class="form-group"><label class="form-label">ชื่อสินค้า *</label><input type="text" class="form-input" id="prod-name" value="${productData?.name || ''}" required></div>
      <div class="form-group"><label class="form-label">บาร์โค้ด</label><input type="text" class="form-input" id="prod-barcode" value="${productData?.barcode || ''}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">ราคาขาย (บาท) *</label><input type="number" class="form-input" id="prod-price" value="${productData?.price || ''}" required></div>
        <div class="form-group"><label class="form-label">ต้นทุน (บาท)</label><input type="number" class="form-input" id="prod-cost" value="${productData?.cost || 0}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">สต็อก *</label><input type="number" class="form-input" id="prod-stock" value="${productData?.stock || 0}" required></div>
        <div class="form-group"><label class="form-label">สต็อกขั้นต่ำ</label><input type="number" class="form-input" id="prod-min-stock" value="${productData?.min_stock || 0}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">หน่วย</label><input type="text" class="form-input" id="prod-unit" value="${productData?.unit || 'ชิ้น'}"></div>
        <div class="form-group"><label class="form-label">หมวดหมู่</label>
          <select class="form-input" id="prod-category">
            <option value="">-- เลือก --</option>
            ${categories.map(c => `<option value="${c.name}" ${productData?.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label><input type="text" class="form-input" id="prod-note" value="${productData?.note || ''}"></div>
      <div class="form-group"><label class="form-label">URL รูปภาพ</label><input type="url" class="form-input" id="prod-img" value="${productData?.img_url || ''}" placeholder="https://..."></div>
      <input type="hidden" id="prod-id" value="${productData?.id || ''}">
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="material-icons-round">save</i> บันทึก</button>
    </form>`);
  document.getElementById('product-form').onsubmit = async (e) => { e.preventDefault(); await saveProduct(); };
}

async function editProduct(productId) {
  const p = products.find(x => x.id === productId);
  if (p) showAddProductModal(p);
}

async function saveProduct() {
  const id = document.getElementById('prod-id').value;
  const data = {
    name: document.getElementById('prod-name').value,
    barcode: document.getElementById('prod-barcode').value || null,
    price: Number(document.getElementById('prod-price').value),
    cost: Number(document.getElementById('prod-cost').value) || 0,
    stock: Number(document.getElementById('prod-stock').value),
    min_stock: Number(document.getElementById('prod-min-stock').value) || 0,
    unit: document.getElementById('prod-unit').value || 'ชิ้น',
    category: document.getElementById('prod-category').value || null,
    note: document.getElementById('prod-note').value || null,
    img_url: document.getElementById('prod-img').value || null,
    updated_at: new Date().toISOString()
  };
  try {
    if (id) {
      const { error } = await db.from('สินค้า').update(data).eq('id', id);
      if (error) throw error;
      toast('แก้ไขสินค้าสำเร็จ', 'success');
    } else {
      const { error } = await db.from('สินค้า').insert(data);
      if (error) throw error;
      toast('เพิ่มสินค้าสำเร็จ', 'success');
    }
    closeModal(); await loadProducts(); renderInventory();
  } catch (e) { console.error(e); toast('ไม่สามารถบันทึกได้: ' + e.message, 'error'); }
}

async function adjustStock(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const { value: adj } = await Swal.fire({ title: `ปรับสต็อก: ${p.name}`, html: `<p>สต็อกปัจจุบัน: <strong>${p.stock}</strong></p><input id="swal-adj" class="swal2-input" type="number" placeholder="ใส่ + เพิ่ม หรือ - ลด">`, showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', preConfirm: () => document.getElementById('swal-adj').value });
  if (adj !== undefined && adj !== '') {
    const newStock = Math.max(0, p.stock + Number(adj));
    await db.from('สินค้า').update({ stock: newStock }).eq('id', productId);
    await db.from('stock_movement').insert({ product_id: p.id, product_name: p.name, type: 'ปรับสต็อก', direction: Number(adj) >= 0 ? 'in' : 'out', qty: Math.abs(Number(adj)), stock_before: p.stock, stock_after: newStock, staff_name: USER?.username });
    toast('ปรับสต็อกสำเร็จ', 'success');
    await loadProducts(); renderInventory();
  }
}

async function deleteProduct(productId) {
  const p = products.find(x => x.id === productId);
  const r = await Swal.fire({ title: `ลบ "${p?.name}"?`, text: 'ไม่สามารถกู้คืนได้', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626' });
  if (r.isConfirmed) {
    await db.from('สินค้า').delete().eq('id', productId);
    toast('ลบสินค้าสำเร็จ', 'success');
    await loadProducts(); renderInventory();
  }
}

function exportInventory() {
  const rows = [['ชื่อสินค้า', 'บาร์โค้ด', 'หมวดหมู่', 'ราคาขาย', 'ต้นทุน', 'สต็อก', 'สต็อกขั้นต่ำ', 'หน่วย']];
  products.forEach(p => rows.push([p.name, p.barcode || '', p.category || '', p.price, p.cost || 0, p.stock, p.min_stock || 0, p.unit || 'ชิ้น']));
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `inventory_${new Date().toLocaleDateString('th-TH')}.csv`; a.click();
}

function generateBarcode(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const barcode = product.barcode || `SK${Date.now().toString().slice(-10)}`;
  openModal('บาร์โค้ดสินค้า', `
    <div style="text-align:center;padding:20px;">
      <h3 style="margin-bottom:16px;">${product.name}</h3>
      <svg id="barcode-svg"></svg>
      <p style="margin-top:12px;font-family:var(--font-display);font-size:18px;">${barcode}</p>
      <button class="btn btn-primary" onclick="window.print()" style="margin-top:20px;"><i class="material-icons-round">print</i> พิมพ์</button>
    </div>`);
  setTimeout(() => { if (typeof JsBarcode !== 'undefined') JsBarcode('#barcode-svg', barcode, { format: 'CODE128', width: 2, height: 80, displayValue: false }); }, 100);
  if (!product.barcode) db.from('สินค้า').update({ barcode }).eq('id', productId);
}

// ══════════════════════════════════════════════════════════════════
// 13. CASH DRAWER PAGE
// ══════════════════════════════════════════════════════════════════
async function loadCashBalance() {
  const bal = await getCashBalance();
  document.getElementById('global-cash-balance').textContent = `฿${formatNum(bal)}`;
}

async function renderCashDrawer() {
  try {
    const { data: session } = await db.from('cash_session').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).single();
    let balance = 0, transactions = [];
    if (session) {
      const { data: txs } = await db.from('cash_transaction').select('*').eq('session_id', session.id).order('created_at', { ascending: false });
      transactions = txs || [];
      balance = session.opening_amt || 0;
      transactions.forEach(tx => { balance += tx.direction === 'in' ? tx.net_amount : -tx.net_amount; });
    }
    document.getElementById('cash-current-balance').textContent = `฿${formatNum(balance)}`;
    document.getElementById('cash-session-status').textContent = session ? `เปิดรอบเมื่อ ${formatDateTime(session.opened_at)} โดย ${session.opened_by}` : 'ยังไม่เปิดรอบ';
    const txList = document.getElementById('cash-transactions');
    if (txList) {
      txList.innerHTML = transactions.length === 0
        ? '<p style="text-align:center;color:var(--text-tertiary);padding:40px;">ไม่มีรายการ</p>'
        : transactions.map(tx => `
          <div class="transaction-item">
            <div class="transaction-icon ${tx.direction}"><i class="material-icons-round">${tx.direction === 'in' ? 'add' : 'remove'}</i></div>
            <div class="transaction-info">
              <div class="transaction-title">${tx.type}</div>
              <div class="transaction-time">${formatDateTime(tx.created_at)} — ${tx.staff_name}</div>
              ${tx.note ? `<div class="transaction-note">${tx.note}</div>` : ''}
            </div>
            <div class="transaction-amount ${tx.direction === 'in' ? 'positive' : 'negative'}">${tx.direction === 'in' ? '+' : '-'}฿${formatNum(tx.net_amount)}</div>
          </div>`).join('');
    }
    const noSession = !session;
    document.getElementById('cash-open-btn').disabled = !noSession;
    document.getElementById('cash-add-btn').disabled = noSession;
    document.getElementById('cash-withdraw-btn').disabled = noSession;
    document.getElementById('cash-close-btn').disabled = noSession;
    // Hook add/withdraw/close buttons
    document.getElementById('cash-add-btn').onclick = () => cashMovement('add', session);
    document.getElementById('cash-withdraw-btn').onclick = () => cashMovement('withdraw', session);
    document.getElementById('cash-close-btn').onclick = () => closeCashSession(session, balance);
  } catch (e) { console.error('Render cash error:', e); }
}

async function openCashSession() {
  const { value: amount } = await Swal.fire({ title: 'เปิดรอบเงินสด', input: 'number', inputLabel: 'ยอดเงินเปิดรอบ (บาท)', inputPlaceholder: '0', showCancelButton: true, confirmButtonText: 'เปิดรอบ', cancelButtonText: 'ยกเลิก', inputValidator: v => (!v && v !== '0') ? 'กรุณากรอกจำนวนเงิน' : null });
  if (amount !== undefined) {
    try {
      await db.from('cash_session').insert({ opened_by: USER?.username, opening_amt: Number(amount) });
      toast('เปิดรอบเงินสดสำเร็จ', 'success');
      logActivity('เปิดรอบเงินสด', `ยอดเปิด ฿${formatNum(amount)}`);
      renderCashDrawer(); loadCashBalance();
    } catch (e) { toast('ไม่สามารถเปิดรอบได้', 'error'); }
  }
}

async function cashMovement(type, session) {
  const isAdd = type === 'add';
  const { value, isConfirmed } = await Swal.fire({
    title: isAdd ? 'เพิ่มเงินเข้าลิ้นชัก' : 'เบิกเงินออก',
    html: `<div class="form-group"><label class="form-label">จำนวนเงิน (บาท)</label><input id="swal-amount" class="swal2-input" type="number" min="1"></div>
           <div class="form-group"><label class="form-label">หมายเหตุ</label><input id="swal-note" class="swal2-input" type="text" placeholder="ระบุเหตุผล"></div>`,
    showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก',
    preConfirm: () => ({ amount: document.getElementById('swal-amount').value, note: document.getElementById('swal-note').value })
  });
  if (isConfirmed && value?.amount) {
    await db.from('cash_transaction').insert({ session_id: session.id, type: isAdd ? 'เพิ่มเงิน' : 'เบิกเงิน', direction: isAdd ? 'in' : 'out', amount: Number(value.amount), net_amount: Number(value.amount), balance_after: 0, staff_name: USER?.username, note: value.note });
    toast(isAdd ? 'เพิ่มเงินสำเร็จ' : 'เบิกเงินสำเร็จ', 'success');
    renderCashDrawer(); loadCashBalance();
  }
}

async function closeCashSession(session, currentBalance) {
  const { value: note, isConfirmed } = await Swal.fire({ title: 'ปิดรอบเงินสด', html: `<p>ยอดเงินในลิ้นชัก: <strong>฿${formatNum(currentBalance)}</strong></p><input id="swal-note" class="swal2-input" placeholder="หมายเหตุ (ถ้ามี)">`, showCancelButton: true, confirmButtonText: 'ปิดรอบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626', preConfirm: () => document.getElementById('swal-note').value });
  if (isConfirmed) {
    await db.from('cash_session').update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: USER?.username, closing_amt: currentBalance, note: note || null }).eq('id', session.id);
    toast('ปิดรอบเงินสดสำเร็จ', 'success');
    logActivity('ปิดรอบเงินสด', `ยอดปิด ฿${formatNum(currentBalance)}`);
    renderCashDrawer(); loadCashBalance();
  }
}

// ══════════════════════════════════════════════════════════════════
// 14. SALES HISTORY
// ══════════════════════════════════════════════════════════════════
async function renderHistory() {
  const section = document.getElementById('page-history');
  if (!section) return;
  const today = new Date().toISOString().split('T')[0];
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <div class="search-box"><i class="material-icons-round">search</i><input type="text" id="history-search" placeholder="ค้นหาบิล..."></div>
        <div class="toolbar-actions">
          <input type="date" class="form-input" id="history-date" value="${today}" style="width:160px;" onchange="renderHistory()">
          <button class="btn btn-outline" onclick="exportHistory()"><i class="material-icons-round">download</i> Export</button>
        </div>
      </div>
      <div id="history-stats" class="inv-stats"></div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>บิล #</th><th>วันเวลา</th><th>ลูกค้า</th><th>วิธีชำระ</th><th class="text-right">ยอดรวม</th><th>พนักงาน</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody id="history-tbody"></tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('history-search').addEventListener('input', loadHistoryData);
  await loadHistoryData();
}

async function loadHistoryData() {
  const date = document.getElementById('history-date')?.value || new Date().toISOString().split('T')[0];
  const search = document.getElementById('history-search')?.value?.toLowerCase() || '';
  const { data: bills } = await db.from('บิลขาย').select('*').gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59').order('date', { ascending: false });
  let filtered = (bills || []).filter(b => !search || b.bill_no?.toString().includes(search) || b.customer_name?.toLowerCase().includes(search) || b.staff_name?.toLowerCase().includes(search));
  const totalSales = filtered.filter(b => b.status === 'สำเร็จ').reduce((s, b) => s + b.total, 0);
  const statsEl = document.getElementById('history-stats');
  if (statsEl) statsEl.innerHTML = `
    <div class="inv-stat"><span class="inv-stat-value">${filtered.length}</span><span class="inv-stat-label">บิลทั้งหมด</span></div>
    <div class="inv-stat success"><span class="inv-stat-value">฿${formatNum(totalSales)}</span><span class="inv-stat-label">ยอดขายรวม</span></div>
    <div class="inv-stat warning"><span class="inv-stat-value">${filtered.filter(b => b.method === 'เงินสด').length}</span><span class="inv-stat-label">เงินสด</span></div>
    <div class="inv-stat"><span class="inv-stat-value">${filtered.filter(b => b.method === 'โอนเงิน').length}</span><span class="inv-stat-label">โอนเงิน</span></div>`;
  const tbody = document.getElementById('history-tbody');
  if (tbody) tbody.innerHTML = filtered.map(b => `
    <tr>
      <td><strong>#${b.bill_no}</strong></td>
      <td>${formatDateTime(b.date)}</td>
      <td>${b.customer_name || 'ลูกค้าทั่วไป'}</td>
      <td><span class="badge ${b.method === 'เงินสด' ? 'badge-success' : 'badge-info'}">${b.method}</span></td>
      <td class="text-right"><strong>฿${formatNum(b.total)}</strong></td>
      <td>${b.staff_name || '-'}</td>
      <td><span class="badge ${b.status === 'สำเร็จ' ? 'badge-success' : b.status === 'ค้างชำระ' ? 'badge-warning' : 'badge-danger'}">${b.status}</span></td>
      <td>
        <button class="btn btn-ghost btn-icon" onclick="viewBillDetail('${b.id}')" title="ดูรายละเอียด"><i class="material-icons-round">receipt</i></button>
        ${b.status === 'สำเร็จ' ? `<button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="cancelBill('${b.id}')" title="ยกเลิก"><i class="material-icons-round">cancel</i></button>` : ''}
      </td>
    </tr>`).join('');
}

async function viewBillDetail(billId) {
  const { data: bill } = await db.from('บิลขาย').select('*').eq('id', billId).single();
  const { data: items } = await db.from('รายการในบิล').select('*').eq('bill_id', billId);
  openModal(`บิล #${bill.bill_no}`, `
    <div style="padding:4px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border-light);">
        <div><div style="color:var(--text-secondary);font-size:12px;">วันที่</div><div style="font-weight:600;">${formatDateTime(bill.date)}</div></div>
        <div><div style="color:var(--text-secondary);font-size:12px;">ลูกค้า</div><div style="font-weight:600;">${bill.customer_name || 'ทั่วไป'}</div></div>
        <div><div style="color:var(--text-secondary);font-size:12px;">วิธีชำระ</div><div style="font-weight:600;">${bill.method}</div></div>
      </div>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border-light);"><th style="text-align:left;padding:8px 4px;">สินค้า</th><th style="text-align:center;padding:8px 4px;">จำนวน</th><th style="text-align:right;padding:8px 4px;">ราคา</th><th style="text-align:right;padding:8px 4px;">รวม</th></tr></thead>
        <tbody>${(items || []).map(i => `<tr style="border-bottom:1px solid var(--bg-hover);"><td style="padding:8px 4px;">${i.name}</td><td style="text-align:center;padding:8px 4px;">${i.qty} ${i.unit}</td><td style="text-align:right;padding:8px 4px;">฿${formatNum(i.price)}</td><td style="text-align:right;padding:8px 4px;font-weight:600;">฿${formatNum(i.total)}</td></tr>`).join('')}</tbody>
      </table>
      <div style="margin-top:16px;padding-top:16px;border-top:2px solid var(--border-light);">
        ${bill.discount ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>ส่วนลด</span><span>-฿${formatNum(bill.discount)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;color:var(--primary);"><span>ยอดรวม</span><span>฿${formatNum(bill.total)}</span></div>
        ${bill.received ? `<div style="display:flex;justify-content:space-between;margin-top:8px;color:var(--text-secondary);"><span>รับเงิน</span><span>฿${formatNum(bill.received)}</span></div>` : ''}
        ${bill.change ? `<div style="display:flex;justify-content:space-between;margin-top:4px;color:var(--text-secondary);"><span>เงินทอน</span><span>฿${formatNum(bill.change)}</span></div>` : ''}
      </div>
    </div>`);
}

async function cancelBill(billId) {
  const { value: reason, isConfirmed } = await Swal.fire({ title: 'ยกเลิกบิล?', input: 'text', inputLabel: 'เหตุผล', showCancelButton: true, confirmButtonText: 'ยกเลิกบิล', cancelButtonText: 'ปิด', confirmButtonColor: '#DC2626', inputValidator: v => !v ? 'กรุณาระบุเหตุผล' : null });
  if (isConfirmed) {
    await db.from('บิลขาย').update({ status: 'ยกเลิก', cancel_reason: reason }).eq('id', billId);
    toast('ยกเลิกบิลสำเร็จ', 'success');
    loadHistoryData();
  }
}

async function exportHistory() {
  const date = document.getElementById('history-date')?.value || new Date().toISOString().split('T')[0];
  const { data: bills } = await db.from('บิลขาย').select('*').gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59').order('date', { ascending: false });
  const rows = [['บิล#', 'วันที่', 'ลูกค้า', 'วิธีชำระ', 'ยอด', 'ส่วนลด', 'รับเงิน', 'ทอน', 'พนักงาน', 'สถานะ']];
  (bills || []).forEach(b => rows.push([b.bill_no, formatDateTime(b.date), b.customer_name || '', b.method, b.total, b.discount || 0, b.received || 0, b.change || 0, b.staff_name || '', b.status]));
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sales_${date}.csv`; a.click();
}

// ══════════════════════════════════════════════════════════════════
// 15. CUSTOMERS PAGE
// ══════════════════════════════════════════════════════════════════
async function renderCustomers() {
  const section = document.getElementById('page-customer');
  if (!section) return;
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <div class="search-box"><i class="material-icons-round">search</i><input type="text" id="customer-page-search" placeholder="ค้นหาลูกค้า..." oninput="loadCustomerData()"></div>
        <button class="btn btn-primary" onclick="showAddCustomerModal()"><i class="material-icons-round">person_add</i> เพิ่มลูกค้า</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>ชื่อ</th><th>เบอร์โทร</th><th>อีเมล</th><th class="text-right">ยอดสะสม</th><th class="text-center">ครั้งที่มา</th><th class="text-right">หนี้คงค้าง</th><th>จัดการ</th></tr></thead>
          <tbody id="customer-tbody"></tbody>
        </table>
      </div>
    </div>`;
  await loadCustomerData();
}

async function loadCustomerData() {
  const search = document.getElementById('customer-page-search')?.value?.toLowerCase() || '';
  const { data } = await db.from('customer').select('*').order('total_purchase', { ascending: false });
  const filtered = (data || []).filter(c => !search || c.name?.toLowerCase().includes(search) || c.phone?.includes(search));
  const tbody = document.getElementById('customer-tbody');
  if (!tbody) return;
  tbody.innerHTML = filtered.map(c => {
    const sn = c.name.replace(/'/g, '&apos;');
    return `<tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.phone || '-'}</td>
      <td>${c.email || '-'}</td>
      <td class="text-right"><strong>฿${formatNum(c.total_purchase)}</strong></td>
      <td class="text-center">${c.visit_count || 0} ครั้ง</td>
      <td class="text-right"><span style="color:${(c.debt_amount || 0) > 0 ? 'var(--danger)' : 'var(--text-secondary)'}">฿${formatNum(c.debt_amount)}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-icon" onclick="editCustomer('${c.id}')" title="แก้ไข"><i class="material-icons-round">edit</i></button>
          <button class="btn btn-ghost btn-icon" onclick="viewCustomerHistory('${c.id}','${sn}')"><i class="material-icons-round">history</i></button>
          ${(c.debt_amount || 0) > 0 ? `<button class="btn btn-ghost btn-icon" style="color:var(--success)" onclick="recordDebtPayment('${c.id}','${sn}')" title="รับชำระหนี้"><i class="material-icons-round">payments</i></button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function showAddCustomerModal(cData = null) {
  openModal(cData ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่', `
    <form id="customer-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">ชื่อ *</label><input type="text" class="form-input" id="cust-name" value="${cData?.name || ''}" required></div>
        <div class="form-group"><label class="form-label">เบอร์โทร</label><input type="tel" class="form-input" id="cust-phone" value="${cData?.phone || ''}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">อีเมล</label><input type="email" class="form-input" id="cust-email" value="${cData?.email || ''}"></div>
        <div class="form-group"><label class="form-label">Line ID</label><input type="text" class="form-input" id="cust-line" value="${cData?.line_id || ''}"></div>
      </div>
      <div class="form-group"><label class="form-label">ที่อยู่</label><textarea class="form-input" id="cust-address" rows="2">${cData?.address || ''}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">วันเกิด</label><input type="date" class="form-input" id="cust-birth" value="${cData?.birth_date || ''}"></div>
        <div class="form-group"><label class="form-label">วงเงินเครดิต (บาท)</label><input type="number" class="form-input" id="cust-credit" value="${cData?.credit_limit || 0}"></div>
      </div>
      <input type="hidden" id="cust-id" value="${cData?.id || ''}">
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="material-icons-round">save</i> บันทึก</button>
    </form>`);
  document.getElementById('customer-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('cust-id').value;
    const data = { name: document.getElementById('cust-name').value, phone: document.getElementById('cust-phone').value, email: document.getElementById('cust-email').value, line_id: document.getElementById('cust-line').value, address: document.getElementById('cust-address').value, birth_date: document.getElementById('cust-birth').value || null, credit_limit: Number(document.getElementById('cust-credit').value) || 0, updated_at: new Date().toISOString() };
    if (id) await db.from('customer').update(data).eq('id', id);
    else await db.from('customer').insert(data);
    toast('บันทึกสำเร็จ', 'success'); closeModal(); loadCustomerData();
  };
}

async function editCustomer(id) {
  const { data } = await db.from('customer').select('*').eq('id', id).single();
  if (data) showAddCustomerModal(data);
}

async function viewCustomerHistory(customerId, name) {
  const { data: bills } = await db.from('บิลขาย').select('*').eq('customer_id', customerId).order('date', { ascending: false }).limit(20);
  openModal(`ประวัติการซื้อ: ${name}`, `
    <div style="max-height:400px;overflow-y:auto;">
      ${(bills || []).length === 0 ? '<p style="text-align:center;padding:40px;color:var(--text-tertiary);">ไม่มีประวัติการซื้อ</p>' :
        (bills || []).map(b => `<div style="display:flex;justify-content:space-between;padding:12px;border-bottom:1px solid var(--border-light);">
          <div><strong>#${b.bill_no}</strong> <span style="color:var(--text-secondary);font-size:13px;">${formatDateTime(b.date)}</span></div>
          <strong style="color:var(--primary)">฿${formatNum(b.total)}</strong>
        </div>`).join('')}
    </div>`);
}

async function recordDebtPayment(customerId, name) {
  const { data: cust } = await db.from('customer').select('debt_amount').eq('id', customerId).single();
  const { value, isConfirmed } = await Swal.fire({ title: `รับชำระหนี้: ${name}`, html: `<p>หนี้คงค้าง: <strong style="color:var(--danger)">฿${formatNum(cust?.debt_amount)}</strong></p><input id="swal-pay" class="swal2-input" type="number" max="${cust?.debt_amount}" placeholder="จำนวนที่รับ">`, showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', preConfirm: () => document.getElementById('swal-pay').value });
  if (isConfirmed && value) {
    const paid = Number(value);
    await db.from('customer').update({ debt_amount: Math.max(0, (cust?.debt_amount || 0) - paid) }).eq('id', customerId);
    await db.from('ชำระหนี้').insert({ customer_id: customerId, amount: paid, method: 'เงินสด', staff_name: USER?.username });
    toast('บันทึกการรับชำระหนี้สำเร็จ', 'success');
    loadCustomerData();
  }
}

// ══════════════════════════════════════════════════════════════════
// 16. EXPENSES PAGE
// ══════════════════════════════════════════════════════════════════
async function renderExpenses() {
  const section = document.getElementById('page-exp');
  if (!section) return;
  const today = new Date().toISOString().split('T')[0];
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <div class="search-box"><i class="material-icons-round">search</i><input type="text" id="exp-search" placeholder="ค้นหารายจ่าย..." oninput="loadExpenseData()"></div>
        <div class="toolbar-actions">
          <input type="date" class="form-input" id="exp-date" value="${today}" style="width:160px;" onchange="loadExpenseData()">
          <button class="btn btn-primary" onclick="showAddExpenseModal()"><i class="material-icons-round">add</i> บันทึกรายจ่าย</button>
        </div>
      </div>
      <div id="exp-stats" class="inv-stats"></div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>วันเวลา</th><th>รายการ</th><th>หมวด</th><th>วิธีชำระ</th><th class="text-right">จำนวน</th><th>พนักงาน</th><th>จัดการ</th></tr></thead>
          <tbody id="exp-tbody"></tbody>
        </table>
      </div>
    </div>`;
  await loadExpenseData();
}

async function loadExpenseData() {
  const date = document.getElementById('exp-date')?.value || new Date().toISOString().split('T')[0];
  const search = document.getElementById('exp-search')?.value?.toLowerCase() || '';
  const { data } = await db.from('รายจ่าย').select('*').gte('date', date + 'T00:00:00').lte('date', date + 'T23:59:59').order('date', { ascending: false });
  const filtered = (data || []).filter(e => !search || e.description?.toLowerCase().includes(search) || e.category?.toLowerCase().includes(search));
  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const statsEl = document.getElementById('exp-stats');
  if (statsEl) statsEl.innerHTML = `<div class="inv-stat danger"><span class="inv-stat-value">฿${formatNum(total)}</span><span class="inv-stat-label">รายจ่ายรวม</span></div><div class="inv-stat"><span class="inv-stat-value">${filtered.length}</span><span class="inv-stat-label">รายการ</span></div>`;
  const tbody = document.getElementById('exp-tbody');
  if (tbody) tbody.innerHTML = filtered.map(e => `
    <tr>
      <td>${formatDateTime(e.date)}</td>
      <td><strong>${e.description}</strong>${e.note ? `<br><small style="color:var(--text-tertiary);">${e.note}</small>` : ''}</td>
      <td><span class="badge" style="background:var(--warning-bg);color:var(--warning);">${e.category}</span></td>
      <td>${e.method}</td>
      <td class="text-right"><strong style="color:var(--danger)">฿${formatNum(e.amount)}</strong></td>
      <td>${e.staff_name || '-'}</td>
      <td><button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="deleteExpense('${e.id}')"><i class="material-icons-round">delete</i></button></td>
    </tr>`).join('');
}

function showAddExpenseModal() {
  openModal('บันทึกรายจ่าย', `
    <form id="expense-form">
      <div class="form-group"><label class="form-label">รายการ *</label><input type="text" class="form-input" id="exp-desc" placeholder="ระบุรายการ" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">จำนวน (บาท) *</label><input type="number" class="form-input" id="exp-amount" min="1" required></div>
        <div class="form-group"><label class="form-label">หมวดหมู่</label>
          <select class="form-input" id="exp-cat">
            <option value="ทั่วไป">ทั่วไป</option>
            <option value="ค่าสาธารณูปโภค">ค่าสาธารณูปโภค</option>
            <option value="ค่าขนส่ง">ค่าขนส่ง</option>
            <option value="ค่าซ่อมบำรุง">ค่าซ่อมบำรุง</option>
            <option value="ค่าอาหาร/เครื่องดื่ม">ค่าอาหาร/เครื่องดื่ม</option>
            <option value="ค่าเงินเดือน">ค่าเงินเดือน</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">วิธีชำระ</label>
          <select class="form-input" id="exp-method"><option>เงินสด</option><option>โอนเงิน</option><option>บัตรเครดิต</option></select>
        </div>
        <div class="form-group"><label class="form-label">วันที่</label><input type="datetime-local" class="form-input" id="exp-datetime" value="${new Date().toISOString().slice(0,16)}"></div>
      </div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label><input type="text" class="form-input" id="exp-note"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="material-icons-round">save</i> บันทึก</button>
    </form>`);
  document.getElementById('expense-form').onsubmit = async (e) => {
    e.preventDefault();
    await db.from('รายจ่าย').insert({ description: document.getElementById('exp-desc').value, amount: Number(document.getElementById('exp-amount').value), category: document.getElementById('exp-cat').value, method: document.getElementById('exp-method').value, date: new Date(document.getElementById('exp-datetime').value).toISOString(), note: document.getElementById('exp-note').value, staff_name: USER?.username });
    toast('บันทึกรายจ่ายสำเร็จ', 'success'); closeModal(); loadExpenseData();
  };
}

async function deleteExpense(id) {
  const r = await Swal.fire({ title: 'ลบรายจ่ายนี้?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626' });
  if (r.isConfirmed) { await db.from('รายจ่าย').delete().eq('id', id); toast('ลบสำเร็จ', 'success'); loadExpenseData(); }
}

// ══════════════════════════════════════════════════════════════════
// 17. DEBTS (ลูกหนี้)
// ══════════════════════════════════════════════════════════════════
async function renderDebts() {
  const section = document.getElementById('page-debt');
  if (!section) return;
  const { data } = await db.from('customer').select('*').gt('debt_amount', 0).order('debt_amount', { ascending: false });
  const total = (data || []).reduce((s, c) => s + c.debt_amount, 0);
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-stats">
        <div class="inv-stat danger"><span class="inv-stat-value">฿${formatNum(total)}</span><span class="inv-stat-label">หนี้รวมทั้งหมด</span></div>
        <div class="inv-stat"><span class="inv-stat-value">${(data || []).length}</span><span class="inv-stat-label">ลูกหนี้</span></div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>ลูกค้า</th><th>เบอร์โทร</th><th class="text-right">หนี้คงค้าง</th><th class="text-right">วงเงินเครดิต</th><th>จัดการ</th></tr></thead>
          <tbody>${(data || []).map(c => `
            <tr>
              <td><strong>${c.name}</strong></td>
              <td>${c.phone || '-'}</td>
              <td class="text-right"><strong style="color:var(--danger)">฿${formatNum(c.debt_amount)}</strong></td>
              <td class="text-right">฿${formatNum(c.credit_limit)}</td>
              <td><button class="btn btn-primary btn-sm" onclick="recordDebtPayment('${c.id}','${c.name.replace(/'/g,'&apos;')}')"><i class="material-icons-round">payments</i> รับชำระ</button></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
// 18. PURCHASE ORDERS (รับสินค้าเข้า)
// ══════════════════════════════════════════════════════════════════
async function renderPurchases() {
  const section = document.getElementById('page-purchase');
  if (!section) return;
  const { data: orders } = await db.from('purchase_order').select('*').order('date', { ascending: false }).limit(50);
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <h3 style="font-size:16px;font-weight:600;">รายการรับสินค้าเข้า</h3>
        <button class="btn btn-primary" onclick="showAddPurchaseModal()"><i class="material-icons-round">add</i> สร้างใบรับสินค้า</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>วันที่</th><th>ผู้จำหน่าย</th><th>วิธีชำระ</th><th class="text-right">ยอดรวม</th><th>สถานะ</th><th>พนักงาน</th><th>จัดการ</th></tr></thead>
          <tbody>${(orders || []).map(o => `
            <tr>
              <td>${formatDateTime(o.date)}</td>
              <td>${o.supplier || '-'}</td>
              <td>${o.method}</td>
              <td class="text-right"><strong>฿${formatNum(o.total)}</strong></td>
              <td><span class="badge ${o.status === 'รับแล้ว' ? 'badge-success' : 'badge-warning'}">${o.status}</span></td>
              <td>${o.staff_name || '-'}</td>
              <td>
                ${o.status !== 'รับแล้ว' ? `<button class="btn btn-primary btn-sm" onclick="receivePurchase('${o.id}')"><i class="material-icons-round">check</i> ยืนยันรับ</button>` : ''}
              </td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function showAddPurchaseModal() {
  openModal('สร้างใบรับสินค้า', `
    <form id="purchase-form">
      <div class="form-group"><label class="form-label">ผู้จำหน่าย</label><input type="text" class="form-input" id="pur-supplier" placeholder="ชื่อผู้จำหน่าย"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">วิธีชำระ</label>
          <select class="form-input" id="pur-method"><option>เงินสด</option><option>เครดิต</option><option>โอนเงิน</option></select>
        </div>
        <div class="form-group"><label class="form-label">ยอดรวม (บาท)</label><input type="number" class="form-input" id="pur-total" min="0" required></div>
      </div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label><input type="text" class="form-input" id="pur-note"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="material-icons-round">save</i> บันทึก</button>
    </form>`);
  document.getElementById('purchase-form').onsubmit = async (e) => {
    e.preventDefault();
    await db.from('purchase_order').insert({ supplier: document.getElementById('pur-supplier').value, method: document.getElementById('pur-method').value, total: Number(document.getElementById('pur-total').value), note: document.getElementById('pur-note').value, staff_name: USER?.username });
    toast('สร้างใบรับสินค้าสำเร็จ', 'success'); closeModal(); renderPurchases();
  };
}

async function receivePurchase(orderId) {
  const r = await Swal.fire({ title: 'ยืนยันรับสินค้า?', text: 'จะอัปเดตสต็อกตามรายการที่บันทึกไว้', icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก' });
  if (r.isConfirmed) {
    await db.from('purchase_order').update({ status: 'รับแล้ว' }).eq('id', orderId);
    toast('ยืนยันรับสินค้าสำเร็จ', 'success');
    renderPurchases();
  }
}

// ══════════════════════════════════════════════════════════════════
// 19. ATTENDANCE (พนักงาน/ลงเวลา)
// ══════════════════════════════════════════════════════════════════
async function renderAttendance() {
  const section = document.getElementById('page-att');
  if (!section) return;
  const today = new Date().toISOString().split('T')[0];
  
  const { data: employees } = await db.from('พนักงาน').select('*').eq('status', 'ทำงาน').order('name');
  const { data: todayAttRes } = await db.from('เช็คชื่อ').select('*').eq('date', today);
  
  const attMap = {};
  (todayAttRes || []).forEach(a => { attMap[a.employee_id] = a; });

  const isEmpty = !employees || employees.length === 0;

  section.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; padding-bottom: 30px;">
      <!-- Header -->
      <div class="db-header" style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px 0; display: flex; align-items: center; gap: 10px;">
            <div style="background: rgba(220,38,38,0.1); width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
              <i class="material-icons-round" style="color: var(--primary);">how_to_reg</i>
            </div>
            จัดการเวลาเข้า-ออกงาน
          </h2>
          <p style="color: var(--text-tertiary); font-size: 14px; margin: 0;">ประจำวันที่ ${new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })}</p>
        </div>
        ${!isEmpty ? `
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-primary" style="border-radius: 24px; padding: 8px 20px; font-weight: 600; box-shadow: 0 4px 12px rgba(220,38,38,0.25);" onclick="showAddEmployeeModal()">
            <i class="material-icons-round">person_add</i> เพิ่มพนักงาน
          </button>
        </div>` : ''}
      </div>

      ${isEmpty ? `
      <!-- Empty State -->
      <div style="text-align: center; padding: 80px 20px; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-light); margin-top: 10px; animation: v11SlideFadeIn 0.4s ease;">
        <div style="width: 80px; height: 80px; background: var(--bg-base); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: inset 0 2px 6px rgba(0,0,0,0.03);">
          <i class="material-icons-round" style="font-size: 40px; color: var(--text-tertiary);">badge</i>
        </div>
        <h3 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">ยังไม่มีข้อมูลพนักงาน</h3>
        <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto 30px; line-height: 1.5;">เริ่มต้นเพิ่มรายชื่อพนักงานเข้าสู่ระบบเพื่อใช้งานระบบลงเวลาเข้า-ออกงาน สำหรับจัดการกะและจ่ายเงินเดือนอย่างมืออาชีพ</p>
        <button class="btn btn-primary" onclick="showAddEmployeeModal()" style="border-radius: 24px; padding: 12px 28px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(220,38,38,0.25);">
          <i class="material-icons-round">add</i> เพิ่มพนักงานคนแรก
        </button>
      </div>
      ` : `
      <!-- Data Table -->
      <div class="table-wrapper" style="background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px solid var(--border-light); overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.02); animation: v11SlideFadeIn 0.4s ease;">
        <table class="data-table" style="margin: 0; border: none;">
          <thead>
            <tr>
              <th style="padding-left: 20px;">พนักงาน</th>
              <th>ตำแหน่ง</th>
              <th>สถานะ</th>
              <th class="text-center">เวลาเข้า</th>
              <th class="text-center">เวลาออก</th>
              <th class="text-center">บันทึกเวลา</th>
            </tr>
          </thead>
          <tbody>${employees.map(emp => {
            const att = attMap[emp.id];
            const hasCheckedIn = att && att.status === 'มา';
            const hasCheckedOut = att && att.time_out;
            
            return `
            <tr style="transition: background 0.2s;">
              <td style="padding-left: 20px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:36px; height:36px; border-radius:50%; background:var(--bg-base); display:flex; align-items:center; justify-content:center; color:var(--text-tertiary); font-weight:600; font-size:14px; border:1px solid var(--border-light);">
                    ${emp.name.charAt(0)}
                  </div>
                  <div>
                    <div style="font-weight:600; color:var(--text-primary); font-size:14px;">${emp.name} ${emp.lastname || ''}</div>
                    <div style="color:var(--text-tertiary); font-size:12px; margin-top:2px;">ID: ${emp.id.split('-')[0]}</div>
                  </div>
                </div>
              </td>
              <td style="color:var(--text-secondary);">${emp.position || '-'}</td>
              <td>
                <span class="badge ${att ? (att.status === 'มา' ? 'badge-success' : 'badge-danger') : 'badge-warning'}" style="padding:4px 10px; border-radius:20px; font-weight:500;">
                  ${att ? att.status : 'ยังไม่ระบุ'}
                </span>
              </td>
              <td class="text-center" style="font-family:monospace; font-size:14px; color:${hasCheckedIn ? 'var(--text-primary)' : 'var(--text-tertiary)'};">
                ${att?.time_in || '--:--'}
              </td>
              <td class="text-center" style="font-family:monospace; font-size:14px; color:${hasCheckedOut ? 'var(--text-primary)' : 'var(--text-tertiary)'};">
                ${att?.time_out || '--:--'}
              </td>
              <td class="text-center">
                ${!att ? `
                  <button class="btn btn-primary btn-sm" style="border-radius: 20px; padding: 6px 16px; font-weight: 500;" onclick="checkIn('${emp.id}')">
                    <i class="material-icons-round" style="font-size:16px;">login</i> เข้างาน
                  </button>
                ` : ''}
                ${(att && !att.time_out) ? `
                  <button class="btn btn-outline btn-sm" style="border-radius: 20px; padding: 6px 16px; font-weight: 500; border-color: var(--border-medium); color: var(--text-primary);" onclick="checkOut('${att.id}')">
                    <i class="material-icons-round" style="font-size:16px;">logout</i> ออกงาน
                  </button>
                ` : ''}
                ${(att && att.time_out) ? `
                  <span style="color:var(--success); display:flex; align-items:center; justify-content:center; gap:4px; font-size:13px; font-weight:500;">
                    <i class="material-icons-round" style="font-size:16px;">check_circle</i> สำเร็จ
                  </span>
                ` : ''}
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      `}
    </div>`;
}

async function checkIn(employeeId) {
  const now = new Date();
  await db.from('เช็คชื่อ').insert({ employee_id: employeeId, date: now.toISOString().split('T')[0], status: 'มา', time_in: now.toTimeString().slice(0,5), staff_name: USER?.username });
  toast('บันทึกเวลาเข้างานสำเร็จ', 'success'); renderAttendance();
}

async function checkOut(attId) {
  const now = new Date();
  await db.from('เช็คชื่อ').update({ time_out: now.toTimeString().slice(0,5) }).eq('id', attId);
  toast('บันทึกเวลาออกงานสำเร็จ', 'success'); renderAttendance();
}

function showAddEmployeeModal() {
  openModal('เพิ่มพนักงาน', `
    <form id="emp-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">ชื่อ *</label><input type="text" class="form-input" id="emp-name" required></div>
        <div class="form-group"><label class="form-label">นามสกุล</label><input type="text" class="form-input" id="emp-lastname"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">เบอร์โทร</label><input type="tel" class="form-input" id="emp-phone"></div>
        <div class="form-group"><label class="form-label">ตำแหน่ง</label><input type="text" class="form-input" id="emp-pos" value="พนักงาน"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">ประเภทค่าจ้าง</label>
          <select class="form-input" id="emp-pay-type"><option>รายวัน</option><option>รายเดือน</option></select>
        </div>
        <div class="form-group"><label class="form-label">อัตราค่าจ้าง (บาท)</label><input type="number" class="form-input" id="emp-wage" value="0"></div>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="material-icons-round">save</i> บันทึก</button>
    </form>`);
  document.getElementById('emp-form').onsubmit = async (e) => {
    e.preventDefault();
    const payType = document.getElementById('emp-pay-type').value;
    const wage = Number(document.getElementById('emp-wage').value);
    await db.from('พนักงาน').insert({ name: document.getElementById('emp-name').value, lastname: document.getElementById('emp-lastname').value, phone: document.getElementById('emp-phone').value, position: document.getElementById('emp-pos').value, pay_type: payType, daily_wage: payType === 'รายวัน' ? wage : 0, salary: payType === 'รายเดือน' ? wage : 0 });
    toast('เพิ่มพนักงานสำเร็จ', 'success'); closeModal(); renderAttendance();
  };
}

// ══════════════════════════════════════════════════════════════════
// 20. ACTIVITY LOG
// ══════════════════════════════════════════════════════════════════
async function renderActivityLog() {
  const section = document.getElementById('page-log');
  if (!section) return;
  const { data } = await db.from('log_กิจกรรม').select('*').order('time', { ascending: false }).limit(100);
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <h3 style="font-size:16px;font-weight:600;">ประวัติกิจกรรม (100 รายการล่าสุด)</h3>
        <button class="btn btn-outline" onclick="renderActivityLog()"><i class="material-icons-round">refresh</i> รีเฟรช</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>วันเวลา</th><th>ผู้ใช้งาน</th><th>ประเภท</th><th>รายละเอียด</th></tr></thead>
          <tbody>${(data || []).map(l => `
            <tr>
              <td style="white-space:nowrap;">${formatDateTime(l.time)}</td>
              <td><strong>${l.username}</strong></td>
              <td><span class="badge badge-info">${l.type}</span></td>
              <td>${l.details}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
// 21. PAYABLES (เจ้าหนี้ร้าน)
// ══════════════════════════════════════════════════════════════════
async function renderPayables() {
  const section = document.getElementById('page-payable');
  if (!section) return;
  const { data } = await db.from('เจ้าหนี้').select('*, ซัพพลายเออร์(name)').order('due_date').limit(50);
  const total = (data || []).filter(d => d.status === 'ค้างชำระ').reduce((s, d) => s + d.balance, 0);
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-stats">
        <div class="inv-stat danger"><span class="inv-stat-value">฿${formatNum(total)}</span><span class="inv-stat-label">ค้างชำระรวม</span></div>
        <div class="inv-stat"><span class="inv-stat-value">${(data || []).filter(d => d.status === 'ค้างชำระ').length}</span><span class="inv-stat-label">รายการค้างชำระ</span></div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>ผู้จำหน่าย</th><th>วันที่</th><th>ครบกำหนด</th><th class="text-right">ยอดรวม</th><th class="text-right">ชำระแล้ว</th><th class="text-right">คงค้าง</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody>${(data || []).map(d => {
            const splName = d.supplier_name || (Array.isArray(d.ซัพพลายเออร์) ? d.ซัพพลายเออร์[0]?.name : d.ซัพพลายเออร์?.name) || d.supplier?.name || '-';
            return `
            <tr>
              <td><strong>${splName}</strong></td>
              <td>${formatDate(d.date)}</td>
              <td style="color:${new Date(d.due_date) < new Date() && d.status === 'ค้างชำระ' ? 'var(--danger)' : ''};">${d.due_date ? formatDate(d.due_date) : '-'}</td>
              <td class="text-right">฿${formatNum(d.amount)}</td>
              <td class="text-right">฿${formatNum(d.paid_amount)}</td>
              <td class="text-right"><strong style="color:var(--danger)">฿${formatNum(d.balance)}</strong></td>
              <td><span class="badge ${d.status === 'ชำระแล้ว' ? 'badge-success' : 'badge-danger'}">${d.status}</span></td>
              <td>${d.status !== 'ชำระแล้ว' ? `<button class="btn btn-primary btn-sm" onclick="payPayable('${d.id}','${d.balance}')"><i class="material-icons-round">payments</i> ชำระ</button>` : ''}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

async function payPayable(id, balance) {
  const { value, isConfirmed } = await Swal.fire({ title: 'ชำระเจ้าหนี้', html: `<p>ยอดคงค้าง: <strong>฿${formatNum(balance)}</strong></p><input id="swal-pay" class="swal2-input" type="number" max="${balance}" value="${balance}">`, showCancelButton: true, confirmButtonText: 'ชำระ', cancelButtonText: 'ยกเลิก', preConfirm: () => document.getElementById('swal-pay').value });
  if (isConfirmed && value) {
    const paid = Number(value);
    const { data: cur } = await db.from('เจ้าหนี้').select('paid_amount, amount').eq('id', id).single();
    const newPaid = (cur?.paid_amount || 0) + paid;
    const newBalance = (cur?.amount || 0) - newPaid;
    await db.from('เจ้าหนี้').update({ paid_amount: newPaid, balance: Math.max(0, newBalance), status: newBalance <= 0 ? 'ชำระแล้ว' : 'ค้างชำระ', updated_at: new Date().toISOString() }).eq('id', id);
    toast('บันทึกการชำระสำเร็จ', 'success'); renderPayables();
  }
}

// ══════════════════════════════════════════════════════════════════
// 22. QUOTATIONS (ใบเสนอราคา)
// ══════════════════════════════════════════════════════════════════
async function renderQuotations() {
  const section = document.getElementById('page-quotation');
  if (!section) return;
  const { data } = await db.from('ใบเสนอราคา').select('*').order('date', { ascending: false }).limit(50);
  section.innerHTML = `
    <div class="inv-container">
      <div class="inv-toolbar">
        <h3 style="font-size:16px;font-weight:600;">ใบเสนอราคา</h3>
        <button class="btn btn-primary" onclick="showAddQuotationModal()"><i class="material-icons-round">add</i> สร้างใบเสนอราคา</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>วันที่</th><th>ลูกค้า</th><th class="text-right">ยอดรวม</th><th>หมดอายุ</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody>${(data || []).map(q => `
            <tr>
              <td>${formatDate(q.date)}</td>
              <td><strong>${q.customer_name}</strong></td>
              <td class="text-right"><strong>฿${formatNum(q.total)}</strong></td>
              <td>${q.valid_until ? formatDate(q.valid_until) : '-'}</td>
              <td><span class="badge ${q.status === 'อนุมัติ' ? 'badge-success' : q.status === 'ยกเลิก' ? 'badge-danger' : 'badge-warning'}">${q.status}</span></td>
              <td>
                ${q.status === 'รออนุมัติ' ? `
                  <button class="btn btn-primary btn-sm" onclick="convertQuotation('${q.id}','${q.customer_name.replace(/'/g,'&apos;')}','${q.total}')"><i class="material-icons-round">shopping_cart</i> สร้างบิล</button>
                ` : ''}
              </td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function showAddQuotationModal() {
  openModal('สร้างใบเสนอราคา', `
    <form id="quot-form">
      <div class="form-group"><label class="form-label">ชื่อลูกค้า *</label><input type="text" class="form-input" id="quot-customer" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">ยอดรวม (บาท) *</label><input type="number" class="form-input" id="quot-total" required></div>
        <div class="form-group"><label class="form-label">ส่วนลด (บาท)</label><input type="number" class="form-input" id="quot-discount" value="0"></div>
      </div>
      <div class="form-group"><label class="form-label">วันหมดอายุ</label><input type="date" class="form-input" id="quot-valid"></div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label><input type="text" class="form-input" id="quot-note"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;"><i class="material-icons-round">save</i> บันทึก</button>
    </form>`);
  document.getElementById('quot-form').onsubmit = async (e) => {
    e.preventDefault();
    await db.from('ใบเสนอราคา').insert({ customer_name: document.getElementById('quot-customer').value, total: Number(document.getElementById('quot-total').value), discount: Number(document.getElementById('quot-discount').value) || 0, valid_until: document.getElementById('quot-valid').value || null, note: document.getElementById('quot-note').value, staff_name: USER?.username });
    toast('สร้างใบเสนอราคาสำเร็จ', 'success'); closeModal(); renderQuotations();
  };
}

async function convertQuotation(id, customerName, total) {
  const r = await Swal.fire({ title: 'แปลงเป็นบิลขาย?', text: `สำหรับลูกค้า: ${customerName}`, icon: 'question', showCancelButton: true, confirmButtonText: 'สร้างบิล', cancelButtonText: 'ยกเลิก' });
  if (r.isConfirmed) {
    await db.from('ใบเสนอราคา').update({ status: 'อนุมัติ' }).eq('id', id);
    toast('แปลงใบเสนอราคาสำเร็จ กรุณาสร้างบิลที่หน้า POS', 'success');
    renderQuotations();
  }
}

// ══════════════════════════════════════════════════════════════════
// 23. DASHBOARD
// ══════════════════════════════════════════════════════════════════
async function renderDashboard() {
  const section = document.getElementById('page-dash');
  if (!section) return;
  section.innerHTML = `<div style="padding:24px;"><div class="stats-grid" id="dash-stats"><div style="grid-column:1/-1;text-align:center;padding:40px;"><div class="spinner"></div><p>กำลังโหลดข้อมูล...</p></div></div><div id="dash-charts"></div></div>`;
  try {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: bills7 } = await db.from('บิลขาย').select('total, date, method, status').gte('date', sevenDaysAgo + 'T00:00:00').in('status', ['สำเร็จ', 'คืนบางส่วน']).order('date');
    const { data: todayBills } = await db.from('บิลขาย').select('total').gte('date', today + 'T00:00:00').lte('date', today + 'T23:59:59').in('status', ['สำเร็จ', 'คืนบางส่วน']);
    const { data: expenses7 } = await db.from('รายจ่าย').select('amount').gte('date', sevenDaysAgo + 'T00:00:00');
    const totalSales7 = (bills7 || []).reduce((s, b) => s + b.total, 0);
    const todaySales = (todayBills || []).reduce((s, b) => s + b.total, 0);
    const totalExp = (expenses7 || []).reduce((s, e) => s + e.amount, 0);
    const cashBills = (bills7 || []).filter(b => b.method === 'เงินสด').length;
    const transferBills = (bills7 || []).filter(b => b.method === 'โอนเงิน').length;
    // Group by day
    const byDay = {};
    (bills7 || []).forEach(b => {
      const d = b.date.split('T')[0];
      byDay[d] = (byDay[d] || 0) + b.total;
    });
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      days.push({ date: d, label: new Date(d).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' }), total: byDay[d] || 0 });
    }
    const maxVal = Math.max(...days.map(d => d.total), 1);
    const topProducts = {};
    const { data: billItems } = await db.from('รายการในบิล').select('name, qty').gte('created_at', sevenDaysAgo + 'T00:00:00').limit(200);
    (billItems || []).forEach(i => { topProducts[i.name] = (topProducts[i.name] || 0) + i.qty; });
    const topList = Object.entries(topProducts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    section.querySelector('#dash-stats').innerHTML = `
      <div class="stat-card stat-sales"><div class="stat-icon"><i class="material-icons-round">today</i></div><div class="stat-content"><span class="stat-value">฿${formatNum(todaySales)}</span><span class="stat-label">ยอดขายวันนี้</span></div></div>
      <div class="stat-card stat-orders"><div class="stat-icon"><i class="material-icons-round">date_range</i></div><div class="stat-content"><span class="stat-value">฿${formatNum(totalSales7)}</span><span class="stat-label">ยอดขาย 7 วัน</span></div></div>
      <div class="stat-card stat-profit"><div class="stat-icon"><i class="material-icons-round">receipt_long</i></div><div class="stat-content"><span class="stat-value">${(bills7 || []).length}</span><span class="stat-label">บิล 7 วัน</span></div></div>
      <div class="stat-card stat-cash"><div class="stat-icon"><i class="material-icons-round">money_off</i></div><div class="stat-content"><span class="stat-value">฿${formatNum(totalExp)}</span><span class="stat-label">รายจ่าย 7 วัน</span></div></div>`;
    section.querySelector('#dash-charts').innerHTML = `
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-top:20px;">
        <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">ยอดขาย 7 วัน</h3>
          <div style="display:flex;align-items:flex-end;gap:8px;height:140px;">
            ${days.map(d => `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="font-size:10px;color:var(--text-tertiary);">฿${d.total > 0 ? formatNum(Math.round(d.total/1000)) + 'k' : '0'}</div>
                <div style="width:100%;background:var(--primary);border-radius:4px 4px 0 0;height:${Math.round((d.total / maxVal) * 100)}px;min-height:${d.total > 0 ? 4 : 0}px;transition:height .3s;"></div>
                <div style="font-size:10px;color:var(--text-secondary);text-align:center;">${d.label}</div>
              </div>`).join('')}
          </div>
        </div>
        <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">วิธีชำระ</h3>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;"><span>เงินสด</span><strong>${cashBills} บิล</strong></div>
              <div style="background:var(--bg-hover);border-radius:4px;height:8px;"><div style="background:var(--success);height:100%;border-radius:4px;width:${cashBills + transferBills > 0 ? Math.round(cashBills/(cashBills+transferBills)*100) : 0}%;"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;"><span>โอนเงิน</span><strong>${transferBills} บิล</strong></div>
              <div style="background:var(--bg-hover);border-radius:4px;height:8px;"><div style="background:var(--info);height:100%;border-radius:4px;width:${cashBills + transferBills > 0 ? Math.round(transferBills/(cashBills+transferBills)*100) : 0}%;"></div></div>
            </div>
          </div>
          <h3 style="font-size:15px;font-weight:600;margin-top:24px;margin-bottom:12px;">สินค้าขายดี</h3>
          ${topList.map((p, i) => `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span><span style="color:var(--primary);font-weight:700;margin-right:6px;">#${i+1}</span>${p[0]}</span><strong>${p[1]} ชิ้น</strong></div>`).join('')}
          ${topList.length === 0 ? '<p style="color:var(--text-tertiary);font-size:13px;">ยังไม่มีข้อมูล</p>' : ''}
        </div>
      </div>`;
  } catch (e) { console.error('Dashboard error:', e); }
}

// ══════════════════════════════════════════════════════════════════
// 24. ADMIN PAGE
// ══════════════════════════════════════════════════════════════════
async function renderAdmin() {
  if (USER?.role !== 'admin') {
    document.getElementById('page-admin').innerHTML = `<div style="text-align:center;padding:80px;"><i class="material-icons-round" style="font-size:64px;color:var(--danger)">block</i><p style="font-size:18px;margin-top:16px;">เข้าถึงได้เฉพาะผู้ดูแลระบบ</p></div>`;
    return;
  }
  const { data: users } = await db.from('ผู้ใช้งาน').select('*').order('username');
  const { data: cats } = await db.from('categories').select('*').order('name');
  const { data: shopConf } = await db.from('ตั้งค่าร้านค้า').select('*').limit(1).single();
  document.getElementById('page-admin').innerHTML = `
    <div style="padding:0 0 24px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <!-- Shop Settings -->
        <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;"><i class="material-icons-round" style="vertical-align:middle;font-size:18px;">store</i> ตั้งค่าร้านค้า</h3>
          <form id="shop-form">
            <div class="form-group"><label class="form-label">ชื่อร้าน (ไทย)</label><input type="text" class="form-input" id="shop-name" value="${shopConf?.shop_name || SHOP_CONFIG.name}"></div>
            <div class="form-group"><label class="form-label">ชื่อร้าน (อังกฤษ)</label><input type="text" class="form-input" id="shop-name-en" value="${shopConf?.shop_name_en || SHOP_CONFIG.nameEn}"></div>
            <div class="form-group"><label class="form-label">ที่อยู่</label><textarea class="form-input" id="shop-addr" rows="2">${shopConf?.address || SHOP_CONFIG.address}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group"><label class="form-label">เบอร์โทร</label><input type="text" class="form-input" id="shop-phone" value="${shopConf?.phone || SHOP_CONFIG.phone}"></div>
              <div class="form-group"><label class="form-label">เลขผู้เสียภาษี</label><input type="text" class="form-input" id="shop-tax" value="${shopConf?.tax_id || SHOP_CONFIG.taxId}"></div>
            </div>
            <div class="form-group"><label class="form-label">PromptPay (พร้อมเพย์)</label><input type="text" class="form-input" id="shop-promptpay" value="${shopConf?.promptpay_number || ''}"></div>
            <div class="form-group"><label class="form-label">Footer ใบเสร็จ</label><input type="text" class="form-input" id="shop-footer" value="${shopConf?.receipt_footer || SHOP_CONFIG.note}"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;"><i class="material-icons-round">save</i> บันทึกตั้งค่าร้าน</button>
          </form>
        </div>
        <!-- Users -->
        <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;"><i class="material-icons-round" style="vertical-align:middle;font-size:18px;">manage_accounts</i> ผู้ใช้งาน</h3>
          <div style="max-height:220px;overflow-y:auto;margin-bottom:12px;">
            ${(users || []).map(u => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:var(--radius-sm);margin-bottom:4px;background:var(--bg-base);">
              <div><strong>${u.username}</strong> <span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}">${u.role}</span></div>
              <div style="display:flex;align-items:center;gap:8px;font-family:monospace;color:var(--text-tertiary);">PIN: ${u.pin}
                ${u.id !== USER?.id ? `<button class="btn btn-ghost btn-icon" style="color:var(--danger)" onclick="deleteUser('${u.id}','${u.username}')"><i class="material-icons-round">delete</i></button>` : ''}
              </div>
            </div>`).join('')}
          </div>
          <button class="btn btn-primary" style="width:100%;" onclick="showAddUserModal()"><i class="material-icons-round">person_add</i> เพิ่มผู้ใช้งาน</button>
        </div>
      </div>
      <!-- Categories -->
      <div style="background:var(--bg-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border-light);">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;"><i class="material-icons-round" style="vertical-align:middle;font-size:18px;">category</i> หมวดหมู่สินค้า</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          ${(cats || []).map(c => `<div style="display:flex;align-items:center;gap:6px;background:var(--bg-base);border-radius:var(--radius-full);padding:6px 12px;font-size:13px;">
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
    </div>`;
  document.getElementById('shop-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = { shop_name: document.getElementById('shop-name').value, shop_name_en: document.getElementById('shop-name-en').value, address: document.getElementById('shop-addr').value, phone: document.getElementById('shop-phone').value, tax_id: document.getElementById('shop-tax').value, promptpay_number: document.getElementById('shop-promptpay').value, receipt_footer: document.getElementById('shop-footer').value, updated_by: USER?.username, updated_at: new Date().toISOString() };
    if (shopConf) await db.from('ตั้งค่าร้านค้า').update(d).eq('id', shopConf.id);
    else await db.from('ตั้งค่าร้านค้า').insert(d);
    toast('บันทึกตั้งค่าร้านสำเร็จ', 'success');
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
}

async function showAddUserModal() {
  openModal('เพิ่มผู้ใช้งาน', `
    <form id="user-form">
      <div class="form-group"><label class="form-label">ชื่อผู้ใช้ *</label><input type="text" class="form-input" id="user-name" required></div>
      <div class="form-group"><label class="form-label">PIN 4 หลัก *</label><input type="number" class="form-input" id="user-pin" maxlength="4" required></div>
      <div class="form-group"><label class="form-label">บทบาท</label><select class="form-input" id="user-role"><option value="staff">พนักงาน</option><option value="admin">ผู้ดูแลระบบ</option></select></div>
      <button type="submit" class="btn btn-primary" style="width:100%;"><i class="material-icons-round">save</i> เพิ่มผู้ใช้</button>
    </form>`);
  document.getElementById('user-form').onsubmit = async (e) => {
    e.preventDefault();
    const pin = document.getElementById('user-pin').value.toString().padStart(4, '0').slice(0,4);
    const { error } = await db.from('ผู้ใช้งาน').insert({ username: document.getElementById('user-name').value, pin, role: document.getElementById('user-role').value });
    if (error?.code === '23505') { toast('PIN ซ้ำกับผู้ใช้อื่น', 'error'); return; }
    toast('เพิ่มผู้ใช้สำเร็จ', 'success'); closeModal(); renderAdmin();
  };
}

async function deleteUser(id, name) {
  const r = await Swal.fire({ title: `ลบผู้ใช้ "${name}"?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626' });
  if (r.isConfirmed) { await db.from('ผู้ใช้งาน').delete().eq('id', id); toast('ลบผู้ใช้สำเร็จ', 'success'); renderAdmin(); }
}

async function deleteCat(id) {
  await db.from('categories').delete().eq('id', id);
  toast('ลบหมวดหมู่สำเร็จ', 'success');
  await loadCategories(); renderAdmin();
}

// ══════════════════════════════════════════════════════════════════
// 25. EVENT LISTENERS
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const pinInputs = document.querySelectorAll('.pin-input');
  pinInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 1) val = val.slice(-1);
    e.target.value = val;

    // --- ส่วนที่เพิ่มเข้ามา เพื่อโชว์/ซ่อน จุดดำทันที ---
    if (val) {
      e.target.classList.add('filled');
    } else {
      e.target.classList.remove('filled');
    }
    // ------------------------------------------

    if (val && index < pinInputs.length - 1) {
      setTimeout(() => pinInputs[index + 1].focus(), 10);
    }
    
    if (Array.from(pinInputs).every(i => i.value)) {
      setTimeout(checkLogin, 50);
    }
  });
    input.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !e.target.value && index > 0) pinInputs[index - 1].focus(); });
  });
  document.getElementById('login-btn')?.addEventListener('click', checkLogin);
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.querySelectorAll('.nav-item[data-page]').forEach(item => item.addEventListener('click', () => go(item.dataset.page)));
  document.getElementById('menu-toggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('show'));
  document.getElementById('sidebar-close')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.remove('show'));
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.getElementById('checkout-btn')?.addEventListener('click', startCheckout);
  document.getElementById('checkout-cancel')?.addEventListener('click', closeCheckout);
  document.getElementById('checkout-back')?.addEventListener('click', prevCheckoutStep);
  document.getElementById('checkout-next')?.addEventListener('click', nextCheckoutStep);
  document.getElementById('clear-cart-btn')?.addEventListener('click', clearCart);
  document.getElementById('pos-search')?.addEventListener('input', renderProductGrid);
  document.getElementById('pos-discount')?.addEventListener('input', () => { renderCart(); sendToDisplay({ type: 'cart', cart, total: getCartTotal() }); });
  document.getElementById('cash-open-btn')?.addEventListener('click', openCashSession);
  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderProductGrid(); }));

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { e.preventDefault(); go('pos'); }
    if (e.key === 'F10') { e.preventDefault(); if (cart.length > 0) startCheckout(); }
    if (e.key === 'Escape') { closeModal(); closeCheckout(); }
  });
  setTimeout(() => pinInputs[0]?.focus(), 100);
  // Listen for messages from customer display (back-channel if needed)
  window.addEventListener('message', (e) => { console.log('[POS] message from display:', e.data); });

  // Mobile Cart Drawer Toggle (Professional UI)
  const cartHeader = document.querySelector('.cart-header');
  const posCart = document.querySelector('.pos-cart');
  const cartFab = document.getElementById('cart-fab');
  const cartFabBadge = document.getElementById('cart-fab-badge');
  const cartCount = document.getElementById('cart-count');

  const cartOverlay = document.getElementById('cart-overlay');

  if(cartHeader && posCart) {
    cartHeader.addEventListener('click', (e) => {
      if(e.target.closest('#clear-cart-btn')) return;
      if(window.innerWidth <= 768) {
        posCart.classList.toggle('cart-open');
        cartOverlay?.classList.toggle('show');
      }
    });

    // Handle closing cart when clicking outside on mobile via the new overlay
    cartOverlay?.addEventListener('click', () => {
      posCart.classList.remove('cart-open');
      cartOverlay.classList.remove('show');
    });

    // Fallback for clicking inside POS products (legacy safety)
    document.querySelector('.pos-products')?.addEventListener('click', () => {
      if(window.innerWidth <= 768 && posCart.classList.contains('cart-open')) {
        posCart.classList.remove('cart-open');
        cartOverlay?.classList.remove('show');
      }
    });
  }

  // Open cart drawer from FAB
  cartFab?.addEventListener('click', () => {
    posCart?.classList.add('cart-open');
    cartOverlay?.classList.add('show');
  });

  // Sync Cart Badge for FAB dynamically
  if (cartCount && cartFabBadge) {
    const observer = new MutationObserver(() => {
      cartFabBadge.innerText = cartCount.innerText;
      cartFabBadge.style.display = cartCount.innerText === '0' ? 'none' : 'inline-block';
    });
    observer.observe(cartCount, { childList: true, characterData: true, subtree: true });
    // Initial sync
    cartFabBadge.style.display = cartCount.innerText === '0' ? 'none' : 'inline-block';
  }

  // Sidebar Overlay Sync (Zero Breakage)
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    setTimeout(() => { // wait for innate toggle
      const isShowing = document.getElementById('sidebar')?.classList.contains('show');
      if(isShowing) document.getElementById('sidebar-overlay')?.classList.add('show');
      else document.getElementById('sidebar-overlay')?.classList.remove('show');
    }, 10);
  });
  
  document.getElementById('sidebar-close')?.addEventListener('click', () => {
    document.getElementById('sidebar-overlay')?.classList.remove('show');
  });
  
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('show');
    document.getElementById('sidebar-overlay')?.classList.remove('show');
  });

  // Mobile Top Header Actions Toggle
  const mobilePageActionsBtn = document.getElementById('mobile-page-actions-btn');
  const pageActionsContainer = document.getElementById('page-actions');
  mobilePageActionsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    pageActionsContainer?.classList.toggle('menu-open');
  });
  // Close header actions menu when clicking outside
  document.addEventListener('click', (e) => {
    if(window.innerWidth <= 768 && pageActionsContainer?.classList.contains('menu-open')) {
      pageActionsContainer.classList.remove('menu-open');
    }
  });

  // Dynamic Table-to-Cards data-label Injector
  // Guarantees any table rendered dynamically by JS works perfectly on mobile without touching original functions
  setInterval(() => {
    if(window.innerWidth > 768) return;
    document.querySelectorAll('.data-table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
      if (headers.length === 0) return;
      table.querySelectorAll('tbody tr').forEach(row => {
        row.querySelectorAll('td').forEach((cell, idx) => {
          if(headers[idx] && !cell.hasAttribute('data-label')) {
            cell.setAttribute('data-label', headers[idx]);
          }
        });
      });
    });

    // Handle floating toolbar actions (Inventory buttons ONLY)
    document.querySelectorAll('#page-inv .inv-toolbar').forEach(toolbar => {
      const actions = toolbar.querySelector('.toolbar-actions');
      if(actions && !toolbar.querySelector('.mobile-action-toggle') && actions.children.length > 0) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-outline mobile-action-toggle hidden-desktop';
        toggleBtn.innerHTML = '<i class="material-icons-round">more_horiz</i> ตัวเลือกเพิ่มเติม';
        toggleBtn.onclick = () => {
          actions.classList.toggle('show-actions');
        };
        // Insert it right after the search box or before actions
        toolbar.insertBefore(toggleBtn, actions);
      }
    });
  }, 1000);
});

console.log('[SK POS v2.0] ✅ Application loaded — 100% Complete');
