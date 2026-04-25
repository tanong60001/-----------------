/**
 * SK POS — modules-v29-inbox.js
 * ════════════════════════════════════════════════════════════════════
 *  Activity Inbox Drawer — กล่องประวัติกิจกรรม (Right Side Panel)
 *  - ประวัติกิจกรรมสวยงาม แบ่งสีตามหมวดหมู่
 *  - แสดงเป็น popup ทางขวามือ พร้อม animation
 *  - badge แจ้งรายการใหม่บนปุ่ม
 * ════════════════════════════════════════════════════════════════════
 */

'use strict';

console.log('%c[v29] ✅ LOADED: Activity Inbox Drawer', 'color:#fff;background:#7c3aed;padding:4px 12px;border-radius:4px;');

// ──────────────────────────────────────────────────────────────────
// CATEGORY CONFIG — สีและไอคอนตามประเภทกิจกรรม
// ──────────────────────────────────────────────────────────────────
const INBOX_CATS = [
  {
    key: 'sale',
    label: 'การขาย',
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#6EE7B7',
    icon: 'receipt_long',
    match: (t) => /ขาย|บิล|รับชำระ|sale|checkout|payment/i.test(t),
  },
  {
    key: 'cash',
    label: 'เงินสด',
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#C4B5FD',
    icon: 'account_balance_wallet',
    match: (t) => /เงินสด|ลิ้นชัก|ปิดรอบ|เปิดรอบ|เพิ่มเงิน|เบิกเงิน|cash|drawer/i.test(t),
  },
  {
    key: 'stock',
    label: 'สินค้า',
    color: '#3B82F6',
    bg: '#EFF6FF',
    border: '#93C5FD',
    icon: 'inventory_2',
    match: (t) => /สินค้า|สต็อก|คลัง|นำเข้า|stock|product|inventory/i.test(t),
  },
  {
    key: 'expense',
    label: 'ค่าใช้จ่าย',
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FCD34D',
    icon: 'payments',
    match: (t) => /ค่าใช้จ่าย|expense|จ่าย/i.test(t),
  },
  {
    key: 'customer',
    label: 'ลูกค้า',
    color: '#EC4899',
    bg: '#FDF2F8',
    border: '#F9A8D4',
    icon: 'person',
    match: (t) => /ลูกค้า|customer|crm|member|สมาชิก/i.test(t),
  },
  {
    key: 'hr',
    label: 'HR',
    color: '#14B8A6',
    bg: '#F0FDFA',
    border: '#5EEAD4',
    icon: 'schedule',
    match: (t) => /hr|เวลา|บันทึกเวลา|พนักงาน|attendance|เข้างาน|ออกงาน/i.test(t),
  },
  {
    key: 'quotation',
    label: 'ใบเสนอราคา',
    color: '#6366F1',
    bg: '#EEF2FF',
    border: '#A5B4FC',
    icon: 'description',
    match: (t) => /ใบเสนอ|quotation|quote/i.test(t),
  },
  {
    key: 'debt',
    label: 'เจ้าหนี้/ลูกหนี้',
    color: '#EF4444',
    bg: '#FEF2F2',
    border: '#FCA5A5',
    icon: 'account_balance',
    match: (t) => /เจ้าหนี้|ลูกหนี้|payable|receivable|ชำระหนี้/i.test(t),
  },
];

const INBOX_CAT_OTHER = {
  key: 'other',
  label: 'อื่นๆ',
  color: '#64748B',
  bg: '#F8FAFC',
  border: '#CBD5E1',
  icon: 'info',
  match: () => true,
};

function getCat(type = '') {
  return INBOX_CATS.find(c => c.match(type)) || INBOX_CAT_OTHER;
}

// ──────────────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────────────
let _inboxOpen = false;
let _inboxItems = [];       // All loaded items
let _inboxFiltered = [];    // After search/tab filter
let _inboxTab = 'all';      // Active tab key
let _inboxSearchQ = '';

const LS_LAST_SEEN = 'sk_inbox_last_seen';

function getLastSeen() {
  return localStorage.getItem(LS_LAST_SEEN) || '1970-01-01T00:00:00.000Z';
}
function markSeen() {
  localStorage.setItem(LS_LAST_SEEN, new Date().toISOString());
  updateInboxBadge(0);
}

// ──────────────────────────────────────────────────────────────────
// BADGE
// ──────────────────────────────────────────────────────────────────
function updateInboxBadge(count) {
  const badge = document.getElementById('inbox-badge');
  const btn   = document.getElementById('inbox-btn');
  if (!badge) return;
  if (count > 0) {
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.textContent = count > 99 ? '99+' : String(count);
    btn && btn.setAttribute('style', btn.getAttribute('style').replace('var(--bg-hover)', '#EDE9FE'));
  } else {
    badge.style.display = 'none';
    btn && btn.setAttribute('style', btn.getAttribute('style').replace('#EDE9FE', 'var(--bg-hover)'));
  }
}

async function refreshInboxBadge() {
  try {
    const lastSeen = getLastSeen();
    const { count } = await db.from('log_กิจกรรม').select('*', { count: 'exact', head: true }).gt('time', lastSeen);
    updateInboxBadge(count || 0);
  } catch (_) {}
}

// ──────────────────────────────────────────────────────────────────
// TIME FORMATTING
// ──────────────────────────────────────────────────────────────────
function inboxTimeAgo(iso) {
  if (!iso) return '—';
  const now = new Date();
  const d   = new Date(iso);
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60)        return 'เมื่อสักครู่';
  if (sec < 3600)      return `${Math.floor(sec / 60)} นาทีที่แล้ว`;
  if (sec < 86400)     return `${Math.floor(sec / 3600)} ชั่วโมงที่แล้ว`;
  if (sec < 604800)    return `${Math.floor(sec / 86400)} วันที่แล้ว`;
  // Full date
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear() + 543; // Buddhist year
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function inboxFullTime(iso) {
  if (!iso) return '—';
  const d  = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear() + 543;
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} เวลา ${hh}:${mi}`;
}

// ──────────────────────────────────────────────────────────────────
// LOAD DATA
// ──────────────────────────────────────────────────────────────────
window.loadInboxActivities = async function (forceRefresh = false) {
  const list = document.getElementById('inbox-list');
  if (!list) return;

  list.innerHTML = `
    <div style="text-align:center;padding:40px 20px;color:var(--text-tertiary);">
      <i class="material-icons-round" style="font-size:36px;display:block;margin-bottom:10px;animation:spin 1s linear infinite;">sync</i>
      <div style="font-size:13px;">กำลังโหลดประวัติ...</div>
    </div>`;

  try {
    const { data } = await db
      .from('log_กิจกรรม')
      .select('*')
      .order('time', { ascending: false })
      .limit(150);

    _inboxItems = data || [];

    // Count unread before marking seen
    const lastSeen  = getLastSeen();
    const unreadCnt = _inboxItems.filter(i => i.time > lastSeen).length;

    // Build tabs from categories present
    renderInboxTabs();
    applyInboxFilter();

    const subtitle = document.getElementById('inbox-subtitle');
    if (subtitle) subtitle.textContent = `${_inboxItems.length} รายการล่าสุด`;

    // Mark all as seen after showing
    setTimeout(() => markSeen(), 1200);

  } catch (e) {
    console.error('[inbox]', e);
    list.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-tertiary);">
        <i class="material-icons-round" style="font-size:36px;display:block;margin-bottom:10px;color:var(--danger);">error_outline</i>
        <div style="font-size:13px;">โหลดไม่ได้ กรุณาลองใหม่</div>
      </div>`;
  }
};

// ──────────────────────────────────────────────────────────────────
// TABS
// ──────────────────────────────────────────────────────────────────
function renderInboxTabs() {
  const tabBar = document.getElementById('inbox-tabs');
  if (!tabBar) return;

  // Which cats appear in the data?
  const catKeys = new Set(_inboxItems.map(i => getCat(i.type).key));
  const visibleCats = [{ key: 'all', label: 'ทั้งหมด', color: '#94A3B8' },
    ...INBOX_CATS.filter(c => catKeys.has(c.key))];

  tabBar.innerHTML = visibleCats.map(c => `
    <button onclick="setInboxTab('${c.key}')" data-inbox-tab="${c.key}"
      style="flex-shrink:0;padding:8px 14px;border:none;background:none;cursor:pointer;
             font-family:var(--font-thai);font-size:12px;font-weight:${_inboxTab === c.key ? '700' : '500'};
             color:${_inboxTab === c.key ? '#fff' : 'rgba(255,255,255,.5)'};
             border-bottom:2px solid ${_inboxTab === c.key ? '#fff' : 'transparent'};
             transition:all .15s;white-space:nowrap;">
      ${c.label}
    </button>`).join('');
}

window.setInboxTab = function(key) {
  _inboxTab = key;
  renderInboxTabs();
  applyInboxFilter();
};

// ──────────────────────────────────────────────────────────────────
// FILTER & RENDER
// ──────────────────────────────────────────────────────────────────
window.filterInboxItems = function(q) {
  _inboxSearchQ = q.toLowerCase();
  applyInboxFilter();
};

function applyInboxFilter() {
  let items = _inboxItems;

  // Tab filter
  if (_inboxTab !== 'all') {
    items = items.filter(i => getCat(i.type).key === _inboxTab);
  }

  // Search filter
  if (_inboxSearchQ) {
    items = items.filter(i =>
      (i.type || '').toLowerCase().includes(_inboxSearchQ) ||
      (i.details || '').toLowerCase().includes(_inboxSearchQ) ||
      (i.username || '').toLowerCase().includes(_inboxSearchQ)
    );
  }

  _inboxFiltered = items;
  renderInboxList();
}

// ──────────────────────────────────────────────────────────────────
// RENDER LIST
// ──────────────────────────────────────────────────────────────────
function renderInboxList() {
  const list = document.getElementById('inbox-list');
  const countLabel = document.getElementById('inbox-count-label');
  if (!list) return;

  if (countLabel) {
    countLabel.textContent = `แสดง ${_inboxFiltered.length} รายการ`;
  }

  if (_inboxFiltered.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:50px 20px;color:var(--text-tertiary);">
        <i class="material-icons-round" style="font-size:44px;display:block;margin-bottom:10px;opacity:.4;">inbox</i>
        <div style="font-size:14px;font-weight:600;margin-bottom:5px;">ไม่พบรายการ</div>
        <div style="font-size:12px;">ลองเปลี่ยนตัวกรองหรือค้นหาใหม่</div>
      </div>`;
    return;
  }

  // Group by date
  const groups = {};
  _inboxFiltered.forEach(item => {
    const d  = new Date(item.time || 0);
    const dd = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
    if (!groups[dd]) groups[dd] = [];
    groups[dd].push(item);
  });

  const today   = new Date();
  const todayStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear() + 543}`;
  const yest    = new Date(today); yest.setDate(yest.getDate() - 1);
  const yesterStr = `${yest.getDate()}/${yest.getMonth() + 1}/${yest.getFullYear() + 543}`;

  let html = '';
  Object.entries(groups).forEach(([dateStr, items]) => {
    const labelText = dateStr === todayStr ? 'วันนี้' : dateStr === yesterStr ? 'เมื่อวาน' : dateStr;
    html += `
      <div style="padding:8px 16px 4px;position:sticky;top:0;z-index:2;background:var(--bg-surface);">
        <div style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-base);border:1px solid var(--border-light);border-radius:20px;padding:3px 10px;">
          <i class="material-icons-round" style="font-size:12px;color:var(--text-tertiary);">calendar_today</i>
          <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">${labelText}</span>
        </div>
      </div>`;

    items.forEach((item, idx) => {
      const cat = getCat(item.type || '');
      const isNew = item.time > getLastSeen();
      html += renderInboxCard(item, cat, isNew, idx === items.length - 1);
    });
  });

  list.innerHTML = html;
}

function renderInboxCard(item, cat, isNew, isLast) {
  const timeAgo = inboxTimeAgo(item.time);
  const fullTime = inboxFullTime(item.time);
  const details = (item.details || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <div style="padding:0 12px 0;margin-bottom:0;">
      <div style="display:flex;gap:12px;padding:12px 8px;border-radius:14px;
                  background:${isNew ? cat.bg : 'transparent'};
                  margin-bottom:4px;
                  border:1px solid ${isNew ? cat.border : 'transparent'};
                  transition:background .15s;"
           onmouseenter="this.style.background='${cat.bg}';this.style.borderColor='${cat.border}'"
           onmouseleave="this.style.background='${isNew ? cat.bg : 'transparent'}';this.style.borderColor='${isNew ? cat.border : 'transparent'}'">

        <!-- Icon Column -->
        <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:0;">
          <div style="width:36px;height:36px;border-radius:10px;background:${cat.bg};border:1.5px solid ${cat.border};
                      display:flex;align-items:center;justify-content:center;">
            <i class="material-icons-round" style="font-size:18px;color:${cat.color};">${cat.icon}</i>
          </div>
          ${!isLast ? `<div style="width:1.5px;flex:1;min-height:12px;background:var(--border-light);margin-top:4px;"></div>` : ''}
        </div>

        <!-- Content Column -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
            <span style="display:inline-flex;align-items:center;gap:3px;background:${cat.bg};color:${cat.color};border:1px solid ${cat.border};border-radius:20px;padding:1px 8px;font-size:10px;font-weight:700;letter-spacing:.3px;flex-shrink:0;">
              ${cat.label}
            </span>
            ${isNew ? `<span style="background:#EF4444;color:#fff;border-radius:20px;padding:1px 6px;font-size:9px;font-weight:700;flex-shrink:0;">ใหม่</span>` : ''}
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${item.type || 'กิจกรรม'}
          </div>
          ${details ? `<div style="font-size:12px;color:var(--text-secondary);line-height:1.45;margin-bottom:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${details}</div>` : ''}
          <div style="display:flex;align-items:center;gap:10px;">
            ${item.username ? `<div style="display:flex;align-items:center;gap:3px;"><i class="material-icons-round" style="font-size:11px;color:var(--text-tertiary);">person</i><span style="font-size:11px;color:var(--text-tertiary);">${item.username}</span></div>` : ''}
            <div style="display:flex;align-items:center;gap:3px;" title="${fullTime}">
              <i class="material-icons-round" style="font-size:11px;color:var(--text-tertiary);">access_time</i>
              <span style="font-size:11px;color:var(--text-tertiary);">${timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// ──────────────────────────────────────────────────────────────────
// OPEN / CLOSE
// ──────────────────────────────────────────────────────────────────
window.toggleActivityInbox = function() {
  _inboxOpen ? closeActivityInbox() : openActivityInbox();
};

window.openActivityInbox = function() {
  const drawer   = document.getElementById('inbox-drawer');
  const backdrop = document.getElementById('inbox-backdrop');
  if (!drawer) return;

  _inboxOpen = true;
  _inboxTab  = 'all';
  _inboxSearchQ = '';

  // Reset search input
  const searchInput = document.getElementById('inbox-search');
  if (searchInput) searchInput.value = '';

  backdrop.style.display = 'block';
  drawer.style.transform  = 'translateX(0)';

  // Animate in
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
  });

  // Style button as active
  const btn = document.getElementById('inbox-btn');
  if (btn) {
    btn.style.background = '#EDE9FE';
    btn.style.color      = '#7C3AED';
  }

  loadInboxActivities();
};

window.closeActivityInbox = function() {
  const drawer   = document.getElementById('inbox-drawer');
  const backdrop = document.getElementById('inbox-backdrop');
  if (!drawer) return;

  _inboxOpen = false;
  drawer.style.transform  = 'translateX(100%)';

  setTimeout(() => {
    backdrop.style.display = 'none';
  }, 320);

  // Reset button style
  const btn = document.getElementById('inbox-btn');
  if (btn) {
    btn.style.background = 'var(--bg-hover)';
    btn.style.color      = 'var(--text-secondary)';
  }
};

// ──────────────────────────────────────────────────────────────────
// CSS ANIMATIONS
// ──────────────────────────────────────────────────────────────────
(function injectInboxCSS() {
  const id = 'inbox-css-v29';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    @keyframes spin {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    #inbox-drawer {
      font-family: var(--font-thai);
    }
    #inbox-list::-webkit-scrollbar { width: 4px; }
    #inbox-list::-webkit-scrollbar-track { background: transparent; }
    #inbox-list::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 4px; }
    #inbox-tabs::-webkit-scrollbar { display: none; }
    #inbox-search::placeholder { color: rgba(255,255,255,.4); }
    #inbox-btn:hover {
      background: #EDE9FE !important;
      color: #7C3AED !important;
      transform: scale(1.08);
    }
    #inbox-backdrop {
      opacity: 0;
      transition: opacity .28s ease;
    }
  `;
  document.head.appendChild(s);
})();

// ──────────────────────────────────────────────────────────────────
// KEYBOARD — Escape to close
// ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _inboxOpen) closeActivityInbox();
});

// ──────────────────────────────────────────────────────────────────
// AUTO-REFRESH BADGE — ทุก 60 วินาที
// ──────────────────────────────────────────────────────────────────
setTimeout(refreshInboxBadge, 3000);
setInterval(refreshInboxBadge, 60_000);
