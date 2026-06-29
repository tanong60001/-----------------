/* ════════════════════════════════════════════════════════════════
 *  MODULES V98 — หน้าลูกหนี้ใหม่ (Card / Step UI)
 *  --------------------------------------------------------------
 *  ออกแบบใหม่หน้า "ลูกค้าค้างชำระ" ให้เป็นสเต็ป:
 *    STEP 1) การ์ดชื่อลูกค้า เรียงแถวละ 5 คน (มือถือย่อเหลือ 2)
 *    STEP 2) กดการ์ด → แสดงรายการบิลค้างชำระ + ปุ่มใบวางบิล + ช่องรับชำระ
 *
 *  เหตุผล: ตารางเดิม min-width:800px เลื่อนแนวนอน ปุ่ม "รับชำระ"
 *          อยู่คอลัมน์ขวาสุด บนมือถือเลื่อนไปกดไม่ถึง → กดรับชำระไม่ได้
 *
 *  ใช้ข้อมูลจาก window.v68SyncCustomerTotals(false) → { rows, customers }
 *  การจ่ายเงิน → เรียก popup เดิม window.recordDebtPayment (v45)
 *  ใบวางบิล    → window.v24PrintBillingNote(custId, custName)
 * ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── helpers ── */
  const num = v => { const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const fmt = v => num(v).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  function billDate(value) {
    if (!value) return '-';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch (_) { return String(value); }
  }
  function initials(name) {
    const s = String(name || '?').trim();
    return s ? s.slice(0, 1).toUpperCase() : '?';
  }
  /* เลือกอีโมจิตามประเภทลูกค้า (เดาจากชื่อ) — ถ้าไม่เข้าเงื่อนไขใช้อีโมจิคนแบบคงที่ตามชื่อ */
  function customerEmoji(name) {
    const n = String(name || '');
    const rules = [
      [/หลวง(พี่|พ่อ|ปู่|ตา)|พระ(อาจารย์|ครู|มหา)?|สำนักสงฆ์|เจ้าอาวาส/, '🙏'],
      [/วัด|ธรรมสถาน|ปฏิบัติธรรม/, '🛕'],
      [/โรงพยาบาล|รพ\.?\s|รพ\.?สต|คลินิก|อนามัย|เภสัช|ทันตก/, '🏥'],
      [/โรงเรียน|ร\.?ร\.?\s|วิทยาลัย|วิทยาคม|มหาวิทยาลัย|ม\.[ก-ฮ]|คณะ|สถานศึกษา|อนุบาล|ศึกษา/, '🏫'],
      [/เทศบาล|อบต|อบจ|อ\.?บ\.?ต|ที่ว่าการ|อำเภอ|จังหวัด|ราชการ|กรม|กระทรวง|การไฟฟ้า|การประปา|สภา/, '🏛️'],
      [/โรงแรม|รีสอร์ท|รีสอร์ต|รีสอร์|hotel|resort|เกสต์|guest/i, '🏨'],
      [/บ้านพัก|หอพัก|อพาร์ท|apartment|แมนชั่น/i, '🏠'],
      [/โรงงาน|อุตสาหกรรม|factory/i, '🏭'],
      [/ก่อสร้าง|รับเหมา|โครงการ|วิศวกร/, '🏗️'],
      [/ช่าง|การช่าง|อู่|ซ่อม/, '🔧'],
      [/สหกรณ์|กลุ่ม|ชมรม|สมาคม|มูลนิธิ|วิสาหกิจ/, '🤝'],
      [/ฟาร์ม|สวน|ไร่|เกษตร|farm/i, '🌾'],
      [/ร้าน|มินิมาร์ท|มาร์ท|สโตร์|ช็อป|ค้า|พาณิช|store|shop|mart/i, '🏪'],
      [/บริษัท|บจก|หจก|company|co\.?\s?,?\s?ltd|จำกัด/i, '🏢'],
    ];
    for (const [re, emo] of rules) { if (re.test(n)) return emo; }
    const people = ['🧑', '👩', '👨', '🧑‍💼', '👩‍💼', '👨‍💼', '🧓', '🙂', '😊', '🧔'];
    let h = 0;
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    return people[h % people.length];
  }
  /* สีพื้น avatar แบบคงที่ตามชื่อ (เพื่อให้จำการ์ดได้ง่าย) */
  function avatarColor(name) {
    const palette = [
      ['#fee2e2', '#dc2626'], ['#ffedd5', '#ea580c'], ['#fef9c3', '#ca8a04'],
      ['#dcfce7', '#16a34a'], ['#cffafe', '#0891b2'], ['#dbeafe', '#2563eb'],
      ['#ede9fe', '#7c3aed'], ['#fce7f3', '#db2777'],
    ];
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }
  function itemKey(name, unit, price) {
    const text = String(name || '').toLowerCase();
    const ksc = text.match(/(\d{2,4})\s*ksc/i);
    if (ksc && /(คอนกรีต|concrete|cube|slump|ksc)/i.test(text)) return `concrete:${ksc[1]}`;
    return `item:${text}|${String(unit || '').toLowerCase()}|${num(price)}`;
  }
  function compactItems(items) {
    const map = new Map();
    (items || []).forEach((it, index) => {
      const name = String(it.name || '').trim();
      if (!name) return;
      const qty = num(it.qty || 1);
      const total = num(it.total || (num(it.price) * qty));
      const key = itemKey(name, it.unit, it.price);
      if (!map.has(key)) {
        map.set(key, { name, qty, unit: it.unit || 'ชิ้น', price: num(it.price || (qty ? total / qty : 0)), total, firstIndex: index });
        return;
      }
      const old = map.get(key);
      old.qty += qty;
      old.total += total;
      old.price = old.qty ? old.total / old.qty : old.price;
    });
    return Array.from(map.values()).sort((a, b) => a.firstIndex - b.firstIndex);
  }
  async function attachBillItems(group) {
    const ids = (group?.rows || []).map(row => row.bill?.id).filter(Boolean);
    if (!ids.length || group.__itemsLoaded) return group;
    try {
      const { data } = await db.from('รายการในบิล').select('bill_id,name,qty,unit,price,total').in('bill_id', ids);
      const byBill = new Map();
      (data || []).forEach(it => {
        const key = String(it.bill_id || '');
        if (!byBill.has(key)) byBill.set(key, []);
        byBill.get(key).push(it);
      });
      group.rows.forEach(row => {
        row.billing_details = compactItems(byBill.get(String(row.bill?.id || '')) || []);
      });
      group.__itemsLoaded = true;
    } catch (err) {
      console.warn('[v98] cannot load debt bill item details', err);
      group.rows.forEach(row => { row.billing_details = row.billing_details || []; });
    }
    return group;
  }

  function injectStyle() {
    if (document.getElementById('v98-debt-style')) return;
    const style = document.createElement('style');
    style.id = 'v98-debt-style';
    style.textContent = `
      .v98-wrap{padding:22px;max-width:1280px;margin:0 auto;animation:v98-fade .35s ease-out}
      @keyframes v98-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      @keyframes v98-spin{to{transform:rotate(360deg)}}
      .v98-spin{animation:v98-spin 1s linear infinite;display:inline-block}
      /* hero */
      .v98-hero{background:linear-gradient(135deg,#fef2f2,#fee2e2 60%,#ffe4e6);border:1px solid rgba(220,38,38,.12);border-radius:20px;padding:22px 28px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;box-shadow:0 10px 30px rgba(220,38,38,.06);margin-bottom:18px}
      .v98-hero h2{margin:0 0 6px;color:#991b1b;font-size:23px;font-weight:950;display:flex;align-items:center;gap:9px}
      .v98-hero p{margin:0;color:#b91c1c;font-size:13.5px;font-weight:700;opacity:.92}
      .v98-stats{display:flex;gap:12px;flex-wrap:wrap}
      .v98-stat{background:#fff;border-radius:15px;padding:14px 22px;min-width:150px;box-shadow:0 4px 14px rgba(0,0,0,.04)}
      .v98-stat .l{font-size:12px;color:#64748b;font-weight:800;margin-bottom:3px}
      .v98-stat .v{font-size:26px;font-weight:950;color:#0f172a;line-height:1.05}
      .v98-stat.danger .v{color:#dc2626}
      /* toolbar */
      .v98-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
      .v98-search{flex:1;min-width:220px;display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid #e2e8f0;border-radius:13px;padding:11px 15px;transition:border-color .15s,box-shadow .15s}
      .v98-search:focus-within{border-color:#dc2626;box-shadow:0 0 0 4px rgba(220,38,38,.1)}
      .v98-search i{color:#94a3b8}
      .v98-search input{border:0;outline:0;background:transparent;font:inherit;font-weight:800;color:#0f172a;width:100%}
      .v98-btn{border:0;border-radius:12px;padding:11px 18px;font:inherit;font-weight:850;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .15s}
      .v98-btn i{font-size:19px}
      .v98-btn.ghost{background:#fff;border:1.5px solid #e2e8f0;color:#475569}
      .v98-btn.ghost:hover{border-color:#cbd5e1;background:#f8fafc}
      .v98-btn.red{background:#dc2626;color:#fff;box-shadow:0 6px 16px rgba(220,38,38,.25)}
      .v98-btn.red:hover{background:#b91c1c;transform:translateY(-1px)}
      .v98-btn.green{background:#16a34a;color:#fff;box-shadow:0 6px 16px rgba(22,163,74,.22)}
      .v98-btn.green:hover{background:#15803d;transform:translateY(-1px)}
      /* card grid — 5 ต่อแถว */
      .v98-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
      @media(max-width:1200px){.v98-grid{grid-template-columns:repeat(4,1fr)}}
      @media(max-width:980px){.v98-grid{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:720px){.v98-grid{grid-template-columns:repeat(2,1fr)}}
      .v98-card{background:#fff;border:1px solid #eef2f7;border-radius:18px;padding:15px 16px;cursor:pointer;display:flex;flex-direction:column;transition:all .18s;position:relative;overflow:hidden;-webkit-tap-highlight-color:rgba(220,38,38,.08);box-shadow:0 3px 12px rgba(15,23,42,.04)}
      .v98-card:hover{border-color:#e2e8f0;box-shadow:0 14px 28px rgba(15,23,42,.1);transform:translateY(-3px)}
      .v98-card:hover .v98-chev{color:#dc2626;transform:translateX(2px)}
      .v98-card:active{transform:translateY(-1px) scale(.99)}
      /* header — แบ่งด้วยเส้นคั่นชัดเจน */
      .v98-card-head{display:flex;align-items:center;gap:11px;padding-bottom:13px;border-bottom:1px solid #f1f5f9}
      .v98-ava{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:24px;line-height:1;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(15,23,42,.04)}
      .v98-card-id{flex:1;min-width:0}
      .v98-card-name{font-weight:900;color:#0f172a;font-size:15.5px;line-height:1.25;word-break:break-word}
      .v98-card-phone{font-size:11.5px;color:#94a3b8;font-weight:700;margin-top:3px;display:flex;align-items:center;gap:4px}
      .v98-card-phone i{font-size:13px}
      .v98-chev{color:#cbd5e1;font-size:22px;flex-shrink:0;align-self:flex-start;transition:all .18s}
      /* footer — ยอดหนี้อยู่มุมขวา ขนาดพอเหมาะ ไม่เด่นเกิน */
      .v98-card-foot{display:flex;justify-content:space-between;align-items:center;padding-top:12px}
      .v98-card-bills{font-size:11.5px;color:#64748b;font-weight:800;background:#f1f5f9;padding:5px 10px;border-radius:999px;display:inline-flex;align-items:center;gap:4px}
      .v98-card-bills i{font-size:14px;color:#94a3b8}
      .v98-card-amt{text-align:right;line-height:1.1}
      .v98-card-amt span{font-size:10.5px;color:#94a3b8;font-weight:800;display:block}
      .v98-card-amt b{font-size:17px;font-weight:900;color:#b91c1c;display:block;margin-top:1px}
      /* empty */
      .v98-empty{grid-column:1/-1;padding:60px 20px;text-align:center;color:#64748b}
      .v98-empty i{font-size:54px;color:#86efac}
      .v98-empty h3{margin:10px 0 0;color:#0f172a}
      /* ════════ DETAIL (step 2) — เลย์เอาต์ 2 คอลัมน์ใหม่ ════════ */
      .v98-detail{animation:v98-fade .3s ease-out}
      .v98-back{margin-bottom:16px}
      .v98-d2{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;align-items:start}
      .v98-dava{width:54px;height:54px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;line-height:1;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(15,23,42,.05)}

      /* ── ซ้าย: รายการบิล ── */
      .v98-d2-main{min-width:0}
      .v98-bills-head{font-size:15px;font-weight:950;color:#0f172a;margin:0 0 14px;display:flex;align-items:center;gap:9px}
      .v98-bills-head i{width:30px;height:30px;border-radius:9px;background:#fef2f2;color:#dc2626;display:flex;align-items:center;justify-content:center;font-size:18px}
      .v98-bills2{display:flex;flex-direction:column;gap:12px}
      .v98-bill2{background:#fff;border:1px solid #eef2f7;border-radius:16px;padding:15px 18px;box-shadow:0 4px 14px rgba(15,23,42,.04);transition:all .16s}
      .v98-bill2:hover{border-color:#e2e8f0;box-shadow:0 12px 26px rgba(15,23,42,.09);transform:translateY(-2px)}
      .v98-bill2-top{display:flex;align-items:center;gap:13px}
      .v98-bill2-ic{width:42px;height:42px;border-radius:12px;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .v98-bill2-ic i{font-size:21px}
      .v98-bill2-id{flex:1;min-width:0}
      .v98-bill2-no{font-size:16px;font-weight:950;color:#0f172a;line-height:1.1}
      .v98-bill2-date{font-size:12px;color:#94a3b8;font-weight:800;margin-top:2px}
      .v98-bill2-status{font-size:11px;font-weight:900;padding:5px 11px;border-radius:999px;white-space:nowrap}
      .v98-bill2-status.r{background:#fef2f2;color:#dc2626}
      .v98-bill2-status.o{background:#fff7ed;color:#ea580c}
      .v98-bill2-amt{text-align:right;line-height:1.05;min-width:84px}
      .v98-bill2-amt b{font-size:20px;font-weight:950;color:#dc2626}
      .v98-bill2-amt span{display:block;font-size:10.5px;color:#94a3b8;font-weight:800;margin-top:1px}
      .v98-bar{height:7px;border-radius:999px;background:#fee2e2;overflow:hidden;margin-top:13px}
      .v98-bar>div{height:100%;background:linear-gradient(90deg,#16a34a,#22c55e);border-radius:999px;transition:width .3s}
      .v98-bill2-foot{display:flex;gap:20px;margin-top:10px;font-size:12.5px;font-weight:800;color:#64748b}
      .v98-bill2-foot b{color:#0f172a;font-weight:950}
      .v98-bill2-foot b.g{color:#059669}
      .v98-bill2-details{margin-top:12px;border:1px solid #eef2f7;border-radius:12px;overflow:hidden;background:#fbfdff}
      .v98-bill2-detail-head,.v98-bill2-detail-row{display:grid;grid-template-columns:minmax(0,1fr) 72px 56px 88px;gap:8px;align-items:center}
      .v98-bill2-detail-head{padding:8px 11px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:950;border-bottom:1px solid #eef2f7}
      .v98-bill2-detail-row{padding:8px 11px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:800;color:#334155}
      .v98-bill2-detail-row:last-child{border-bottom:0}
      .v98-bill2-detail-row .name{color:#0f172a;font-weight:900;line-height:1.25}
      .v98-bill2-detail-row .muted{text-align:center;color:#64748b}
      .v98-bill2-detail-row .money{text-align:right;color:#0f172a;font-weight:950}
      .v98-bill2-more{padding:7px 11px;background:#fff;color:#94a3b8;font-size:11px;font-weight:850;text-align:center;border-top:1px solid #f1f5f9}

      /* ── ขวา: การ์ดสรุป (sticky) ── */
      .v98-d2-side{position:sticky;top:18px}
      .v98-side-card{background:#fff;border:1px solid #eef2f7;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,.08)}
      .v98-side-cust{display:flex;align-items:center;gap:13px;padding:18px 20px;background:linear-gradient(135deg,#ecfdf5,#fff 60%,#eff6ff);border-bottom:1px solid #eef2f7}
      .v98-side-name{font-size:18px;font-weight:950;color:#0f172a;line-height:1.2;word-break:break-word}
      .v98-side-contact{display:flex;flex-direction:column;gap:3px;margin-top:5px}
      .v98-side-contact span{font-size:12px;font-weight:800;color:#64748b;display:inline-flex;align-items:center;gap:6px}
      .v98-side-contact i{font-size:14px;color:#94a3b8}
      .v98-side-total{padding:20px;text-align:center;border-bottom:1px solid #f1f5f9;background:linear-gradient(180deg,#fff,#fef2f2)}
      .v98-side-total span{font-size:12px;font-weight:850;color:#b91c1c}
      .v98-side-total b{display:block;font-size:40px;font-weight:950;color:#dc2626;line-height:1.05;letter-spacing:-1px;margin:2px 0}
      .v98-side-total em{font-style:normal;font-size:12px;font-weight:850;color:#94a3b8}
      .v98-side-mini{display:flex;flex-direction:column}
      .v98-side-mini>div{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid #f4f6fa}
      .v98-side-mini span{font-size:12.5px;font-weight:800;color:#64748b}
      .v98-side-mini b{font-size:15px;font-weight:950;color:#0f172a}
      .v98-side-mini b.g{color:#059669}
      .v98-side-acts{display:flex;flex-direction:column;gap:10px;padding:16px 20px}
      .v98-side-acts .v98-btn{width:100%;justify-content:center;padding:14px;font-size:15px}

      /* ── แถบจ่ายเงินติดล่าง (เฉพาะมือถือ) ── */
      .v98-mobilebar{display:none}

      @media(max-width:900px){
        .v98-d2{grid-template-columns:1fr;gap:18px}
        .v98-d2-side{position:static;order:-1}
        .v98-side-acts{display:none}
        .v98-mobilebar{display:flex;position:sticky;bottom:12px;margin-top:6px;background:#fff;border:1px solid #eef2f7;border-top:3px solid #dc2626;border-radius:18px;padding:14px 18px;justify-content:space-between;align-items:center;gap:12px;box-shadow:0 12px 30px rgba(15,23,42,.14);flex-wrap:wrap}
        .v98-mobilebar .sum span{font-size:11.5px;font-weight:800;color:#64748b;display:block}
        .v98-mobilebar .sum b{font-size:24px;font-weight:950;color:#dc2626;display:block;line-height:1.05}
        .v98-mobilebar .acts{display:flex;gap:10px;flex:1;justify-content:flex-end}
        .v98-mobilebar .acts .v98-btn{padding:13px 18px}
      }
      @media(max-width:520px){
        .v98-mobilebar{flex-direction:column;align-items:stretch}
        .v98-mobilebar .acts{flex-direction:column}
        .v98-mobilebar .acts .v98-btn{width:100%;justify-content:center}
        .v98-bill2-amt b{font-size:18px}
        .v98-bill2-detail-head,.v98-bill2-detail-row{grid-template-columns:minmax(0,1fr) 50px 42px 70px;font-size:10.5px;gap:5px;padding-left:8px;padding-right:8px}
      }
      /* ── FIX: popup รับชำระ v45 บนมือถือ (กริด 2 คอลัมน์บีบจนใช้ไม่ได้) ── */
      @media(max-width:860px){
        .v45-pay-sheet .v45-grid{grid-template-columns:1fr!important;gap:14px!important}
        .v45-pay-sheet{max-height:96vh!important;overflow:auto!important}
        .v45-pay-body{max-height:none!important;overflow:visible!important;padding:14px!important}
        .v45-pay-sheet .v45-debt-bill .v45-bill-lines>div:last-child{display:block!important}
        .v45-pay-sheet .v45-paychips{grid-template-columns:repeat(3,1fr)!important}
        .v45-pay-sheet .v45-actions{flex-direction:column!important}
        .v45-pay-sheet .v45-btn{width:100%!important}
      }
      @media(max-width:640px){
        .v98-wrap{padding:14px}
        .v98-hero{padding:16px 18px}
        .v98-stats{width:100%}.v98-stat{flex:1;min-width:120px;padding:11px 14px}
        .v98-dhead{padding:16px}
        .v98-dtotal{text-align:left;width:100%}
        .v98-paybar{flex-direction:column;align-items:stretch}
        .v98-paybar .acts{flex-direction:column}
        .v98-paybar .acts .v98-btn{justify-content:center;width:100%;padding:14px}
      }
    `;
    document.head.appendChild(style);
  }

  /* ── state ── */
  window.__v98 = window.__v98 || { search: '', selected: null, groups: [] };

  async function fetchGroups() {
    if (typeof window.v68SyncCustomerTotals !== 'function') {
      throw new Error('โมดูลคำนวณยอดลูกหนี้ (v68) ยังไม่พร้อม');
    }
    const sync = await window.v68SyncCustomerTotals(false);
    const grouped = new Map();
    (sync.rows || []).forEach(row => {
      const id = String(row.customer.id);
      if (!grouped.has(id)) grouped.set(id, { customer: row.customer, rows: [], total: 0 });
      const g = grouped.get(id);
      g.rows.push(row);
      g.total += num(row.remaining);
    });
    return [...grouped.values()]
      .filter(g => g.total > 0.009)
      .sort((a, b) => b.total - a.total);
  }

  /* ── STEP 1: card grid ── */
  function gridHTML(groups) {
    const search = String(window.__v98.search || '').toLowerCase();
    const filtered = search
      ? groups.filter(g => {
          const c = g.customer;
          const hay = `${c.name || ''} ${c.phone || ''} ${g.rows.map(r => r.bill.bill_no).join(' ')}`.toLowerCase();
          return hay.includes(search);
        })
      : groups;

    const total = groups.reduce((s, g) => s + g.total, 0);
    const cards = filtered.length
      ? filtered.map(g => {
          const c = g.customer;
          const [bg, fg] = avatarColor(c.name);
          return `
            <div class="v98-card" onclick="v98OpenCustomer('${js(String(c.id))}')">
              <div class="v98-card-head">
                <div class="v98-ava" style="background:${bg}">${customerEmoji(c.name)}</div>
                <div class="v98-card-id">
                  <div class="v98-card-name">${esc(c.name || '-')}</div>
                  <div class="v98-card-phone"><i class="material-icons-round">${c.phone ? 'call' : 'phone_disabled'}</i>${esc(c.phone || 'ไม่มีเบอร์โทร')}</div>
                </div>
                <i class="material-icons-round v98-chev">chevron_right</i>
              </div>
              <div class="v98-card-foot">
                <span class="v98-card-bills"><i class="material-icons-round">receipt_long</i> ${g.rows.length} บิลค้าง</span>
                <div class="v98-card-amt"><span>ยอดค้าง</span><b>฿${fmt(g.total)}</b></div>
              </div>
            </div>`;
        }).join('')
      : `<div class="v98-empty"><i class="material-icons-round">${search ? 'search_off' : 'check_circle'}</i>
          <h3>${search ? 'ไม่พบลูกค้าที่ค้นหา' : 'ไม่มีลูกค้าค้างชำระ'}</h3></div>`;

    return `
      <div class="v98-wrap">
        <div class="v98-hero">
          <div>
            <h2><i class="material-icons-round">account_balance_wallet</i> ลูกค้าค้างชำระ</h2>
            <p>แตะการ์ดชื่อลูกค้าเพื่อดูบิลค้าง ใบวางบิล และรับชำระเงิน</p>
          </div>
          <div class="v98-stats">
            <div class="v98-stat danger"><div class="l">ยอดหนี้รวม</div><div class="v">฿${fmt(total)}</div></div>
            <div class="v98-stat"><div class="l">ลูกค้าค้างชำระ</div><div class="v">${groups.length} ราย</div></div>
          </div>
        </div>
        <div class="v98-toolbar">
          <label class="v98-search"><i class="material-icons-round">search</i>
            <input id="v98-search" value="${esc(window.__v98.search || '')}" placeholder="ค้นหาชื่อลูกค้า เบอร์โทร หรือเลขบิล..." oninput="v98Search(this.value)">
          </label>
          <button class="v98-btn ghost" onclick="v98Refresh()"><i class="material-icons-round">sync</i> ซิงค์ยอด</button>
        </div>
        <div class="v98-grid">${cards}</div>
      </div>`;
  }

  /* ── STEP 2: customer detail ── */
  function detailHTML(group) {
    const c = group.customer;
    const [bg] = avatarColor(c.name);
    const sorted = group.rows.slice().sort((a, b) => String(b.bill.date || '').localeCompare(String(a.bill.date || '')));
    const billCount = group.rows.length;
    const paidSum = group.rows.reduce((s, r) => s + num(r.paid), 0);
    const dated = sorted.filter(r => r.bill.date);
    const oldest = dated.length ? billDate(dated[dated.length - 1].bill.date) : '—';

    const bills = sorted.map(row => {
      const b = row.bill;
      const total = num(row.total), paid = num(row.paid), remaining = num(row.remaining);
      const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
      const partial = paid > 0 && remaining > 0;
      const details = Array.isArray(row.billing_details) ? row.billing_details : [];
      const shownDetails = details.slice(0, 8);
      const detailHtml = details.length ? `
        <div class="v98-bill2-details">
          <div class="v98-bill2-detail-head"><span>รายละเอียดสินค้า</span><span style="text-align:center">จำนวน</span><span style="text-align:center">หน่วย</span><span style="text-align:right">รวม</span></div>
          ${shownDetails.map(it => `
            <div class="v98-bill2-detail-row">
              <div class="name">${esc(it.name || '-')}</div>
              <div class="muted">${fmt(it.qty || 0)}</div>
              <div class="muted">${esc(it.unit || '')}</div>
              <div class="money">฿${fmt(it.total || 0)}</div>
            </div>`).join('')}
          ${details.length > shownDetails.length ? `<div class="v98-bill2-more">มีรายการเพิ่มเติมอีก ${details.length - shownDetails.length} รายการ ดูครบในใบวางบิล</div>` : ''}
        </div>`
        : `<div class="v98-bill2-details"><div class="v98-bill2-more">ไม่มีรายละเอียดสินค้าในบิลนี้</div></div>`;
      return `
        <div class="v98-bill2">
          <div class="v98-bill2-top">
            <span class="v98-bill2-ic"><i class="material-icons-round">receipt_long</i></span>
            <div class="v98-bill2-id">
              <div class="v98-bill2-no">#${esc(b.bill_no || '-')}</div>
              <div class="v98-bill2-date">${esc(billDate(b.date))}</div>
            </div>
            <span class="v98-bill2-status ${partial ? 'o' : 'r'}">${partial ? 'จ่ายบางส่วน' : 'ค้างชำระ'}</span>
            <div class="v98-bill2-amt"><b>฿${fmt(remaining)}</b><span>คงเหลือ</span></div>
          </div>
          <div class="v98-bar"><div style="width:${pct}%"></div></div>
          <div class="v98-bill2-foot"><span>ยอดบิล <b>฿${fmt(total)}</b></span><span>ชำระแล้ว <b class="g">฿${fmt(paid)}</b></span></div>
          ${detailHtml}
        </div>`;
    }).join('');

    const contact = [
      c.phone ? `<span><i class="material-icons-round">call</i>${esc(c.phone)}</span>` : '',
      c.address ? `<span><i class="material-icons-round">location_on</i>${esc(c.address)}</span>` : '',
    ].filter(Boolean).join('');

    const cid = js(String(c.id));
    const cname = js(c.name || '');

    return `
      <div class="v98-wrap v98-detail">
        <button class="v98-btn ghost v98-back" onclick="v98BackToGrid()"><i class="material-icons-round">arrow_back</i> กลับไปรายชื่อลูกค้า</button>
        <div class="v98-d2">
          <div class="v98-d2-main">
            <div class="v98-bills-head"><i class="material-icons-round">list_alt</i> รายการบิลที่ยังค้างชำระ (${billCount} ใบ)</div>
            <div class="v98-bills2">${bills}</div>
          </div>
          <aside class="v98-d2-side">
            <div class="v98-side-card">
              <div class="v98-side-cust">
                <div class="v98-dava" style="background:${bg}">${customerEmoji(c.name)}</div>
                <div style="min-width:0">
                  <div class="v98-side-name">${esc(c.name || '-')}</div>
                  ${contact ? `<div class="v98-side-contact">${contact}</div>` : ''}
                </div>
              </div>
              <div class="v98-side-total">
                <span>ยอดหนี้คงค้างทั้งหมด</span>
                <b>฿${fmt(group.total)}</b>
                <em>${billCount} บิลค้างชำระ</em>
              </div>
              <div class="v98-side-mini">
                <div><span>ชำระสะสมแล้ว</span><b class="g">฿${fmt(paidSum)}</b></div>
                <div><span>บิลเก่าสุด</span><b>${esc(oldest)}</b></div>
                ${num(c.credit_limit) > 0 ? `<div><span>วงเงินเครดิต</span><b>฿${fmt(c.credit_limit)}</b></div>` : ''}
              </div>
              <div class="v98-side-acts">
                <button class="v98-btn green" onclick="v98Pay('${cid}','${cname}')"><i class="material-icons-round">payments</i> รับชำระเงิน</button>
                <button class="v98-btn ghost" onclick="v98PrintBilling('${cid}','${cname}')"><i class="material-icons-round">receipt_long</i> พิมพ์ใบวางบิล</button>
              </div>
            </div>
          </aside>
        </div>
        <div class="v98-mobilebar">
          <div class="sum"><span>ยอดที่ต้องชำระรวม</span><b>฿${fmt(group.total)}</b></div>
          <div class="acts">
            <button class="v98-btn ghost" onclick="v98PrintBilling('${cid}','${cname}')"><i class="material-icons-round">receipt_long</i> ใบวางบิล</button>
            <button class="v98-btn green" onclick="v98Pay('${cid}','${cname}')"><i class="material-icons-round">payments</i> รับชำระเงิน</button>
          </div>
        </div>
      </div>`;
  }

  /* ── main render ── */
  async function render(opts = {}) {
    injectStyle();
    const section = document.getElementById('page-debt');
    if (!section) return;
    const keepFocus = opts.keepSearchFocus || document.activeElement?.id === 'v98-search';
    if (!opts.silent) {
      section.innerHTML = `<div class="v98-wrap"><div style="padding:70px;text-align:center;color:#94a3b8;font-weight:850">
        <i class="material-icons-round v98-spin" style="font-size:42px;margin-bottom:10px">sync</i>
        กำลังซิงค์ยอดลูกหนี้จากบิลจริง...</div></div>`;
    }
    try {
      const groups = await fetchGroups();
      window.__v98.groups = groups;
      // เข้าหน้าลูกหนี้ → เริ่มที่หน้าการ์ดเสมอ
      window.__v98.selected = null;
      section.innerHTML = gridHTML(groups);
      if (keepFocus) {
        const inp = document.getElementById('v98-search');
        if (inp) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {} }
      }
    } catch (err) {
      console.error('[v98] render debts:', err);
      section.innerHTML = `<div class="v98-wrap"><div style="padding:40px;color:#dc2626;font-weight:850">โหลดลูกหนี้ไม่สำเร็จ: ${esc(err.message || err)}</div></div>`;
    }
  }

  /* ── public actions ── */
  window.v98OpenCustomer = async function (id) {
    window.__v98.selected = String(id);
    const section = document.getElementById('page-debt');
    let g = (window.__v98.groups || []).find(x => String(x.customer.id) === String(id));
    if (!g) {
      try { window.__v98.groups = await fetchGroups(); } catch (_) {}
      g = (window.__v98.groups || []).find(x => String(x.customer.id) === String(id));
    }
    if (g && section) {
      if (!g.__itemsLoaded) {
        section.innerHTML = `<div class="v98-wrap"><div style="padding:50px;text-align:center;color:#94a3b8;font-weight:850">
          <i class="material-icons-round v98-spin" style="font-size:36px;margin-bottom:10px">sync</i>
          กำลังโหลดรายละเอียดสินค้าในบิล...</div></div>`;
        await attachBillItems(g);
      }
      section.innerHTML = detailHTML(g);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
    } else {
      window.__v98.selected = null;
      render();
    }
  };

  window.v98BackToGrid = function () {
    window.__v98.selected = null;
    const section = document.getElementById('page-debt');
    if (section) section.innerHTML = gridHTML(window.__v98.groups || []);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
  };

  let searchTimer = null;
  window.v98Search = function (value) {
    window.__v98.search = value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const section = document.getElementById('page-debt');
      if (section && !window.__v98.selected) {
        section.innerHTML = gridHTML(window.__v98.groups || []);
        const inp = document.getElementById('v98-search');
        if (inp) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {} }
      }
    }, 160);
  };

  window.v98Refresh = async function () {
    try {
      if (typeof window.v68SyncCustomerTotals === 'function') await window.v68SyncCustomerTotals(true);
      (window.toast || (() => {}))('ซิงค์ยอดลูกค้าเรียบร้อย', 'success');
    } catch (e) { console.warn('[v98] refresh', e); }
    render({ silent: false });
  };

  window.v98PrintBilling = function (cid, cname) {
    const name = String(cname).replace(/\\'/g, "'");
    if (typeof window.v24PrintBillingNote === 'function') {
      window.v24PrintBillingNote(cid, name);
    } else {
      (window.toast || (() => {}))('ยังไม่พบโมดูลพิมพ์ใบวางบิล', 'warning');
    }
  };

  window.v98Pay = function (cid, cname) {
    const name = String(cname).replace(/\\'/g, "'");
    if (typeof window.recordDebtPayment === 'function') {
      window.recordDebtPayment(cid, name);
    } else {
      (window.toast || (() => {}))('ยังไม่พบหน้ารับชำระเงิน', 'warning');
    }
  };

  /* ── install override (ทับ v68/v69) ── */
  function install() {
    try { injectStyle(); } catch (_) {}
    const wrapped = async function (opts) { return render(opts || {}); };
    wrapped.__v98 = true;
    try { window.renderDebts = wrapped; } catch (_) {}
    try { window.v68RenderDebts = wrapped; } catch (_) {}
    try { renderDebts = wrapped; } catch (_) {}
  }

  // ติดตั้งหลังโมดูลอื่นโหลดเสร็จ (กันโดน v68/v69 ทับ)
  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  }
  setTimeout(install, 0);
  setTimeout(install, 800);
  setTimeout(install, 2000);

  console.log('[v98] หน้าลูกหนี้แบบการ์ดพร้อมใช้งาน');
})();
