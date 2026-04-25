/**
 * modules-v34-ui.js — Modern UI Override (Final Layer)
 * ป้องกันโหลดซ้ำด้วย debounce lock + ออกแบบ UI ใหม่ 5 โมดูล
 */
'use strict';

// ═══ DEBOUNCE LOCKS ═══
const _v34Locks = {};
function v34Lock(name) { if (_v34Locks[name]) return true; _v34Locks[name] = true; return false; }
function v34Unlock(name) { _v34Locks[name] = false; }

// ═══ 1. INVENTORY (คลังสินค้า) ═══
const _v34OrigInv = window.renderInventory;
window.renderInventory = async function () {
  if (v34Lock('inv')) return;
  try {
    const section = document.getElementById('page-inv');
    if (!section) return v34Unlock('inv');
    await loadProducts();
    const search = document.getElementById('v34-inv-search')?.value?.toLowerCase() || '';
    let filtered = products.filter(p => !search || p.name?.toLowerCase().includes(search) || p.barcode?.toLowerCase().includes(search));
    const total = products.length;
    const low = products.filter(p => p.stock <= (p.min_stock || 0) && p.stock > 0).length;
    const out = products.filter(p => p.stock <= 0).length;
    const value = products.reduce((s, p) => s + ((p.cost || 0) * (p.stock || 0)), 0);

    section.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding-bottom:30px">
      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #93c5fd;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:56px;height:56px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(59,130,246,.1)">
            <i class="material-icons-round" style="font-size:32px;color:#3b82f6">inventory_2</i>
          </div>
          <div>
            <h2 style="margin:0;font-size:24px;color:#1e40af;font-weight:700">คลังสินค้า</h2>
            <div style="color:#3b82f6;font-size:14px;margin-top:4px">จัดการสต็อกและข้อมูลสินค้าทั้งหมด</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="showBarcodeBatchModal?.()" style="background:#fff;color:#3b82f6;border:1px solid #93c5fd;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='#fff'"><i class="material-icons-round" style="font-size:16px">qr_code_2</i>บาร์โค้ด</button>
          <button onclick="exportInventory?.()" style="background:#fff;color:#3b82f6;border:1px solid #93c5fd;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='#fff'"><i class="material-icons-round" style="font-size:16px">download</i>CSV</button>
          <button onclick="showAddProductModal()" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px;box-shadow:0 4px 12px rgba(37,99,235,.25)"><i class="material-icons-round" style="font-size:16px">add</i>เพิ่มสินค้า</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px">
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#3b82f6">${formatNum(total)}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">สินค้าทั้งหมด</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#f59e0b">${formatNum(low)}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">ใกล้หมด</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#ef4444">${formatNum(out)}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">หมดสต็อก</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#10b981">฿${formatNum(value)}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">มูลค่าคลัง</div>
        </div>
      </div>

      <div style="background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.03);border:1px solid #e2e8f0;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc">
          <div style="position:relative;max-width:400px">
            <i class="material-icons-round" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:20px">search</i>
            <input type="text" id="v34-inv-search" placeholder="ค้นหาสินค้า / บาร์โค้ด..." value="${search}" style="width:100%;padding:10px 12px 10px 40px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;outline:none" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#cbd5e1'">
          </div>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;white-space:nowrap">
            <thead><tr style="background:#fff">
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">รูป</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">สินค้า</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">บาร์โค้ด</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">หมวด</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:right;border-bottom:2px solid #f1f5f9">ราคาขาย</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:right;border-bottom:2px solid #f1f5f9">ต้นทุน</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:center;border-bottom:2px solid #f1f5f9">สต็อก</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:right;border-bottom:2px solid #f1f5f9">จัดการ</th>
            </tr></thead>
            <tbody>${filtered.map(p => `<tr style="transition:background .2s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
              <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9"><div style="width:40px;height:40px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden">${p.img_url ? `<img src="${p.img_url}" style="width:100%;height:100%;object-fit:cover">` : `<i class="material-icons-round" style="color:#cbd5e1">image</i>`}</div></td>
              <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9"><strong style="font-size:14px">${p.name}</strong>${p.note ? `<br><span style="font-size:11px;color:#94a3b8">${p.note}</span>` : ''}</td>
              <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:12px;color:#64748b">${p.barcode || '-'}</td>
              <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9"><span style="background:#eff6ff;color:#3b82f6;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${p.category || '-'}</span></td>
              <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;font-size:14px">฿${formatNum(p.price)}</td>
              <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;text-align:right;color:#64748b">฿${formatNum(p.cost || 0)}</td>
              <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${p.stock <= 0 ? '#fef2f2;color:#ef4444' : p.stock <= (p.min_stock || 0) ? '#fffbeb;color:#f59e0b' : '#f0fdf4;color:#10b981'}">${formatNum(p.stock)} ${p.unit || ''}</span></td>
              <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;text-align:right"><div style="display:flex;gap:4px;justify-content:flex-end">
                <button onclick="editProduct('${p.id}')" style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="แก้ไข"><i class="material-icons-round" style="font-size:16px;color:#3b82f6">edit</i></button>
                <button onclick="adjustStock('${p.id}')" style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="ปรับสต็อก"><i class="material-icons-round" style="font-size:16px;color:#f59e0b">tune</i></button>
                <button onclick="generateBarcode?.('${p.id}')" style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="บาร์โค้ด"><i class="material-icons-round" style="font-size:16px;color:#8b5cf6">qr_code</i></button>
                <button onclick="v34PrintPriceSticker('${p.id}')" style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="ปริ้นสติกเกอร์ราคา"><i class="material-icons-round" style="font-size:16px;color:#10b981">label</i></button>
                <button onclick="deleteProduct('${p.id}')" style="width:32px;height:32px;border:1px solid #fecaca;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="ลบ"><i class="material-icons-round" style="font-size:16px;color:#ef4444">delete</i></button>
              </div></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>`;

    document.getElementById('v34-inv-search')?.addEventListener('input', () => { v34Unlock('inv'); renderInventory(); });
    const pa = document.getElementById('page-actions'); if (pa) pa.innerHTML = '';
  } finally { v34Unlock('inv'); }
};

// ═══ 2. PURCHASES (รับสินค้าเข้า) ═══
const _v34OrigPur = window.renderPurchases;
window.renderPurchases = async function () {
  if (v34Lock('pur')) return;
  try {
    const section = document.getElementById('page-purchase');
    if (!section) return v34Unlock('pur');
    const { data: orders } = await db.from('purchase_order').select('*').order('date', { ascending: false }).limit(50);
    const totalAmt = (orders || []).reduce((s, o) => s + o.total, 0);

    section.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding-bottom:30px">
      <div style="background:linear-gradient(135deg,#fdf4ff,#fae8ff);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #e879f9;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:56px;height:56px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(168,85,247,.1)">
            <i class="material-icons-round" style="font-size:32px;color:#a855f7">local_shipping</i>
          </div>
          <div>
            <h2 style="margin:0;font-size:24px;color:#7e22ce;font-weight:700">รับสินค้าเข้า</h2>
            <div style="color:#a855f7;font-size:14px;margin-top:4px">จัดการใบรับสินค้าและการสั่งซื้อ</div>
          </div>
        </div>
        <button onclick="showAddPurchaseModal()" style="background:linear-gradient(135deg,#a855f7,#9333ea);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:14px;box-shadow:0 4px 12px rgba(147,51,234,.25)"><i class="material-icons-round" style="font-size:18px">add</i>สร้างใบรับสินค้า</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#a855f7">${(orders || []).length}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">ใบรับสินค้าทั้งหมด</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#10b981">฿${formatNum(totalAmt)}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">มูลค่ารวม</div>
        </div>
      </div>

      <div style="background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.03);border:1px solid #e2e8f0;overflow:hidden">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;white-space:nowrap">
            <thead><tr>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">วันที่</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">ผู้จำหน่าย</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f1f5f9">วิธีชำระ</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:right;border-bottom:2px solid #f1f5f9">ยอดรวม</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:center;border-bottom:2px solid #f1f5f9">สถานะ</th>
              <th style="padding:14px 20px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;text-align:right;border-bottom:2px solid #f1f5f9">จัดการ</th>
            </tr></thead>
            <tbody>${(orders || []).length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8"><i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:8px;color:#cbd5e1">local_shipping</i>ยังไม่มีใบรับสินค้า</td></tr>' : (orders || []).map(o => `<tr style="transition:background .2s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
              <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${formatDateTime(o.date)}</td>
              <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9"><strong>${o.supplier || '-'}</strong></td>
              <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9"><span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${o.method === 'เครดิต' ? '#fffbeb;color:#f59e0b' : o.method === 'โอนเงิน' ? '#eff6ff;color:#3b82f6' : '#f0fdf4;color:#10b981'}">${o.method}</span></td>
              <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;font-size:15px">฿${formatNum(o.total)}</td>
              <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${o.status === 'รับแล้ว' ? '#f0fdf4;color:#10b981' : '#fffbeb;color:#f59e0b'}">${o.status}</span></td>
              <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;text-align:right">
                <button onclick="viewPurchaseItems('${o.id}')" style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center" title="ดูรายการ"><i class="material-icons-round" style="font-size:16px;color:#a855f7">list</i></button>
              </td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  } finally { v34Unlock('pur'); }
};

// ═══ 3. QUOTATIONS (ใบเสนอราคา) ═══
const _v34OrigQuot = window.renderQuotations;
window.renderQuotations = async function () {
  if (v34Lock('quot')) return;
  try {
    const section = document.getElementById('page-quotation');
    if (!section) return v34Unlock('quot');
    let quotes = [];
    try { const { data } = await db.from('ใบเสนอราคา').select('*').order('date', { ascending: false }).limit(100); quotes = data || []; } catch (e) { }
    const pending = quotes.filter(q => q.status === 'รออนุมัติ').length;
    const approved = quotes.filter(q => q.status === 'อนุมัติ').length;
    const totalVal = quotes.reduce((s, q) => s + q.total, 0);
    const sBadge = s => {
      const m = { รออนุมัติ: '#fffbeb;color:#f59e0b', อนุมัติ: '#f0fdf4;color:#10b981', ยกเลิก: '#fef2f2;color:#ef4444' };
      return `<span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${m[s] || '#f8fafc;color:#94a3b8'}">${s}</span>`;
    };

    section.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding-bottom:30px">
      <div style="background:linear-gradient(135deg,#fefce8,#fef9c3);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #fde047;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:56px;height:56px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(234,179,8,.1)">
            <i class="material-icons-round" style="font-size:32px;color:#eab308">description</i>
          </div>
          <div>
            <h2 style="margin:0;font-size:24px;color:#854d0e;font-weight:700">ใบเสนอราคา</h2>
            <div style="color:#ca8a04;font-size:14px;margin-top:4px">จัดการใบเสนอราคาและแปลงเป็นบิลขาย</div>
          </div>
        </div>
        <button onclick="v9ShowQuotModal?.()||showAddQuotationModal?.()" style="background:linear-gradient(135deg,#eab308,#ca8a04);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:14px;box-shadow:0 4px 12px rgba(202,138,4,.25)"><i class="material-icons-round" style="font-size:18px">add</i>สร้างใบเสนอราคา</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px">
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#eab308">${quotes.length}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">ทั้งหมด</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#f59e0b">${pending}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">รออนุมัติ</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#10b981">${approved}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">อนุมัติแล้ว</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#3b82f6">฿${formatNum(totalVal)}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">มูลค่ารวม</div>
        </div>
      </div>

      <div style="background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.03);border:1px solid #e2e8f0;overflow:hidden">
        ${quotes.length === 0 ? `<div style="text-align:center;padding:60px;color:#94a3b8"><i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:12px;color:#cbd5e1">description</i>ยังไม่มีใบเสนอราคา</div>` :
        `<div style="display:flex;flex-direction:column;gap:0">${quotes.map(q => {
          const isExpired = q.valid_until && new Date(q.valid_until) < new Date() && q.status === 'รออนุมัติ';
          const sn = q.customer_name?.replace(/'/g, "&apos;") || '';
          return `<div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:16px;flex-wrap:wrap;transition:background .2s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
            <div style="flex:1;min-width:200px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:12px;font-weight:800;color:#eab308">#QT-${String(q.id).slice(-6).toUpperCase()}</span>
                ${sBadge(q.status)}
                ${isExpired ? '<span style="font-size:11px;color:#ef4444;font-weight:600">⚠️ หมดอายุ</span>' : ''}
              </div>
              <div style="font-size:15px;font-weight:700">${q.customer_name}</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px">${new Date(q.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}${q.valid_until ? ' · หมดอายุ ' + new Date(q.valid_until).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''}${q.staff_name ? ' · ' + q.staff_name : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:20px;font-weight:800;color:#eab308">฿${formatNum(q.total)}</div>
              ${q.discount > 0 ? `<div style="font-size:11px;color:#94a3b8">ส่วนลด ฿${formatNum(q.discount)}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button onclick="v9PrintQuotation?.('${q.id}')" style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="พิมพ์"><i class="material-icons-round" style="font-size:16px;color:#64748b">print</i></button>
              ${q.status === 'รออนุมัติ' ? `<button onclick="v9ConvertQuotation?.('${q.id}','${sn}')" style="padding:6px 12px;border:none;border-radius:8px;background:#10b981;color:#fff;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px"><i class="material-icons-round" style="font-size:14px">shopping_cart</i>สร้างบิล</button><button onclick="v9CancelQuotation?.('${q.id}')" style="width:32px;height:32px;border:1px solid #fecaca;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center" title="ยกเลิก"><i class="material-icons-round" style="font-size:16px;color:#ef4444">close</i></button>` : ''}
            </div>
          </div>`;
        }).join('')}</div>`}
      </div>
    </div>`;
  } finally { v34Unlock('quot'); }
};

// ═══ 4. DELIVERY QUEUE (คิวจัดส่ง) ═══
const _v34OrigDel = window.renderDelivery;
window.renderDelivery = async function () {
  if (v34Lock('del')) return;
  try {
    const sec = document.getElementById('page-delivery');
    if (!sec) return v34Unlock('del');

    sec.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding-bottom:30px">
      <div style="background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #a5b4fc;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:56px;height:56px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(99,102,241,.1)">
            <i class="material-icons-round" style="font-size:32px;color:#6366f1">local_shipping</i>
          </div>
          <div>
            <h2 style="margin:0;font-size:24px;color:#3730a3;font-weight:700">คิวจัดส่งสินค้า</h2>
            <div style="color:#6366f1;font-size:14px;margin-top:4px">จัดการคิวการจัดส่งและติดตามสถานะ</div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="v34-dq-pill active" id="v34-dq-today" onclick="v34DQFilter('today')" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:8px 16px;border-radius:20px;font-weight:600;cursor:pointer;font-size:13px">📅 วันนี้</button>
          <button class="v34-dq-pill" id="v34-dq-tomorrow" onclick="v34DQFilter('tomorrow')" style="background:#f1f5f9;color:#64748b;border:none;padding:8px 16px;border-radius:20px;font-weight:600;cursor:pointer;font-size:13px">🗓️ พรุ่งนี้</button>
          <button class="v34-dq-pill" id="v34-dq-all" onclick="v34DQFilter('all')" style="background:#f1f5f9;color:#64748b;border:none;padding:8px 16px;border-radius:20px;font-weight:600;cursor:pointer;font-size:13px">📋 ทั้งหมด</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px">
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#8b5cf6" id="v34-dq-wait">-</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">รอจัดส่ง</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#f59e0b" id="v34-dq-today-cnt">-</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">นัดวันนี้</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#10b981" id="v34-dq-done">-</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">สำเร็จวันนี้</div>
        </div>
      </div>

      <div id="v34-dq-cards" style="display:flex;flex-direction:column;gap:12px">
        <div style="text-align:center;padding:40px;color:#94a3b8"><i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:8px;color:#cbd5e1">local_shipping</i>กำลังโหลด...</div>
      </div>
    </div>`;

    await v34DQFilter('today');
  } finally { v34Unlock('del'); }
};

window.v34DQFilter = async function (filter) {
  // Update pill styles
  ['today', 'tomorrow', 'all'].forEach(f => {
    const btn = document.getElementById(`v34-dq-${f}`);
    if (!btn) return;
    if (f === filter) { btn.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)'; btn.style.color = '#fff'; }
    else { btn.style.background = '#f1f5f9'; btn.style.color = '#64748b'; }
  });

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  try {
    const { data: allBills } = await db.from('บิลขาย').select('*').order('delivery_date', { ascending: true });
    const pending = (allBills || []).filter(b => b.delivery_status === 'รอจัดส่ง' || (b.delivery_mode && b.delivery_mode !== 'รับเอง' && b.delivery_status !== 'จัดส่งสำเร็จ' && b.status !== 'ยกเลิก'));
    let filtered = pending;
    if (filter === 'today') filtered = pending.filter(b => b.delivery_date === today);
    else if (filter === 'tomorrow') filtered = pending.filter(b => b.delivery_date === tomorrow);

    const el1 = document.getElementById('v34-dq-wait'); if (el1) el1.textContent = pending.length;
    const el2 = document.getElementById('v34-dq-today-cnt'); if (el2) el2.textContent = pending.filter(b => b.delivery_date === today).length;
    const el3 = document.getElementById('v34-dq-done'); if (el3) el3.textContent = (allBills || []).filter(b => b.delivery_status === 'จัดส่งสำเร็จ' && b.delivery_date === today).length;

    const area = document.getElementById('v34-dq-cards');
    if (!area) return;
    if (!filtered.length) {
      area.innerHTML = `<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;text-align:center;padding:60px;color:#94a3b8"><i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:12px;color:#cbd5e1">local_shipping</i>ไม่มีคิวจัดส่ง</div>`;
      return;
    }

    const billIds = filtered.map(b => b.id);
    const { data: allItems } = await db.from('รายการในบิล').select('*').in('bill_id', billIds);

    area.innerHTML = filtered.map(b => {
      const items = (allItems || []).filter(i => i.bill_id === b.id && (i.deliver_qty || 0) > 0);
      const d = b.delivery_date;
      let dateLbl = d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'ไม่กำหนด';
      let dateColor = '#64748b';
      if (d === today) { dateLbl = '📅 วันนี้'; dateColor = '#f59e0b'; }
      else if (d === tomorrow) { dateLbl = '🗓️ พรุ่งนี้'; dateColor = '#3b82f6'; }
      else if (d && d < today) { dateLbl = '⚠️ เกินกำหนด'; dateColor = '#ef4444'; }

      return `<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.02)" id="v34-dq-${b.id}">
        <div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;border-bottom:1px solid #f1f5f9">
          <div>
            <span style="font-size:13px;font-weight:800;color:#6366f1">#${b.bill_no}</span>
            <span style="margin-left:8px;font-size:14px;font-weight:600">${b.customer_name || 'ลูกค้าทั่วไป'}</span>
            <span style="margin-left:8px;font-size:13px;color:#64748b">฿${formatNum(b.total)}</span>
          </div>
          <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;color:${dateColor};background:${dateColor}15">${dateLbl}</span>
        </div>
        ${b.delivery_address ? `<div style="padding:8px 20px;font-size:13px;color:#64748b;background:#f8fafc"><i class="material-icons-round" style="font-size:14px;vertical-align:middle;color:#8b5cf6">location_on</i> ${b.delivery_address}</div>` : ''}
        <div style="padding:12px 20px">
          ${items.length ? items.map(it => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px"><span>${it.name}${(it.take_qty||0)>0?' <span style="color:#8b5cf6;font-size:11px">(รับแล้ว '+it.take_qty+' '+(it.unit||'ชิ้น')+')</span>':''}</span><strong>${it.deliver_qty} ${it.unit||'ชิ้น'}</strong></div>`).join('') : '<div style="font-size:13px;color:#94a3b8">ไม่มีรายการส่ง</div>'}
        </div>
        <div style="padding:12px 20px;border-top:1px solid #f1f5f9;display:flex;gap:8px;justify-content:flex-end">
          <button onclick="v12DQPrintNote?.('${b.id}')" style="padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:#64748b;display:flex;align-items:center;gap:4px"><i class="material-icons-round" style="font-size:14px">print</i>ใบส่งของ</button>
          <button onclick="v12DQMarkDone?.('${b.id}')" style="padding:6px 14px;border:none;border-radius:8px;background:#10b981;color:#fff;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px"><i class="material-icons-round" style="font-size:14px">check_circle</i>จัดส่งสำเร็จ</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    const area = document.getElementById('v34-dq-cards');
    if (area) area.innerHTML = `<div style="background:#fff;border-radius:16px;border:1px solid #fecaca;text-align:center;padding:40px;color:#ef4444"><i class="material-icons-round" style="font-size:32px;display:block;margin-bottom:8px">error</i>${e.message}</div>`;
  }
};

// ═══ 5. PRODUCT MANAGEMENT (จัดการสินค้า) ═══
const _v34OrigManage = window.v9RenderManage;
window.v9RenderManage = async function () {
  if (v34Lock('manage')) return;
  try {
    const pg = document.getElementById('page-manage');
    if (!pg) return v34Unlock('manage');

    const tabs = [
      { key: 'cats', label: 'หมวดหมู่', icon: 'category', desc: 'จัดการหมวดหมู่สินค้า', color: '#6366f1', bg: '#eef2ff' },
      { key: 'units', label: 'หน่วยนับ', icon: 'straighten', desc: 'กำหนด conv rate', color: '#0891b2', bg: '#ecfeff' },
      { key: 'recipe', label: 'สูตรสินค้า', icon: 'science', desc: 'BOM วัตถุดิบต่อสินค้า', color: '#059669', bg: '#f0fdf4' },
      { key: 'supplier', label: 'ซัพพลายเออร์', icon: 'local_shipping', desc: 'จัดการผู้จำหน่าย', color: '#d97706', bg: '#fffbeb' },
      { key: 'produce', label: 'ผลิตสินค้า', icon: 'precision_manufacturing', desc: 'สั่งผลิตตามสูตร', color: '#dc2626', bg: '#fef2f2' },
    ];

    pg.innerHTML = `
    <div style="max-width:1300px;margin:0 auto;padding-bottom:30px">
      <div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:56px;height:56px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.05)">
            <i class="material-icons-round" style="font-size:32px;color:#6366f1">settings_suggest</i>
          </div>
          <div>
            <h2 style="margin:0;font-size:24px;color:#1e293b;font-weight:700">จัดการสินค้า</h2>
            <div style="color:#64748b;font-size:14px;margin-top:4px">หมวดหมู่ · หน่วยนับ · สูตร · ซัพพลายเออร์ · ผลิต</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:240px 1fr;gap:20px;min-height:calc(100vh - 220px)">
        <div style="display:flex;flex-direction:column;gap:8px">
          ${tabs.map(t => `
            <button id="v9mtab-${t.key}" onclick="v9SwitchManageTab('${t.key}')" style="padding:14px 16px;display:flex;align-items:center;gap:12px;border:none;background:#fff;border-radius:12px;cursor:pointer;text-align:left;width:100%;transition:all .2s;border:1px solid #e2e8f0;font-family:inherit" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,.05)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
              <div id="v9mtab-icon-${t.key}" style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${t.bg};transition:all .2s">
                <i class="material-icons-round" style="font-size:20px;color:${t.color};transition:all .2s">${t.icon}</i>
              </div>
              <div style="min-width:0;flex:1">
                <div id="v9mtab-label-${t.key}" style="font-size:14px;font-weight:600;color:#334155;transition:color .2s">${t.label}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.desc}</div>
              </div>
              <i id="v9mtab-arr-${t.key}" class="material-icons-round" style="font-size:16px;color:transparent;margin-left:auto;flex-shrink:0;transition:all .2s">chevron_right</i>
            </button>`).join('')}

          <div style="height:1px;background:#e2e8f0;margin:8px 0"></div>

          <div id="v9m-sidebar-stats" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
            <div style="color:#94a3b8;margin-bottom:10px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em">สรุปภาพรวม</div>
            <div id="v9m-stats-inner" style="display:flex;flex-direction:column;gap:8px">
              <div style="color:#94a3b8;font-size:12px">กำลังโหลด...</div>
            </div>
          </div>
        </div>

        <div style="overflow-y:auto">
          <div id="v9-manage-content" style="background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.03);border:1px solid #e2e8f0;padding:24px;min-height:400px">
            <div style="text-align:center;padding:60px;color:#94a3b8">
              <i class="material-icons-round" style="font-size:48px;display:block;margin-bottom:12px;color:#cbd5e1">settings_suggest</i>
              เลือกเมนูด้านซ้ายเพื่อเริ่มต้น
            </div>
          </div>
        </div>
      </div>
    </div>`;

    v9LoadManageStats?.();
    v9SwitchManageTab?.(_v9ManageCurTab || 'cats');
  } finally { v34Unlock('manage'); }
};

// ═══ 6. FIX: เพิ่มปุ่มปริ้นสติกเกอร์ราคากลับมาในคลังสินค้า ═══
// Patch: เพิ่มปุ่ม generateBarcode ในแต่ละแถวของตาราง inventory
window.v34PrintPriceSticker = async function (productId) {
  const prod = (typeof products !== 'undefined' ? products : []).find(p => p.id === productId);
  if (!prod) { toast?.('ไม่พบสินค้า', 'error'); return; }
  const win = window.open('', '_blank', 'width=400,height=300');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Sarabun',sans-serif;display:flex;flex-wrap:wrap;gap:8px;padding:8px}
    .sticker{width:50mm;height:30mm;border:1px dashed #ccc;padding:4mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
    .name{font-size:11px;font-weight:700;margin-bottom:2px;line-height:1.2}
    .price{font-size:18px;font-weight:800;color:#dc2626}
    .barcode{font-size:9px;color:#666;margin-top:2px;font-family:monospace}
    @media print{@page{size:auto;margin:2mm}body{padding:0}.sticker{border:none}}
  </style></head><body>
  <div class="sticker">
    <div class="name">${prod.name}</div>
    <div class="price">฿${formatNum(prod.price)}</div>
    ${prod.barcode ? `<div class="barcode">${prod.barcode}</div>` : ''}
  </div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
  </body></html>`);
  win.document.close();
};

console.log('[v34-ui] ✅ All 5 modules + Price Sticker loaded');
