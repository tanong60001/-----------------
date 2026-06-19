/* ════════════════════════════════════════════════════════════════
 *  MODULES V100 — Inventory UI polish (หน้าคลังสินค้าสวยขึ้น)
 *  --------------------------------------------------------------
 *  เป็น "ชั้นแต่งหน้าตา" ล้วน ๆ — CSS เท่านั้น ไม่แตะ HTML/JS/logic เดิม
 *  ของ v38 (renderInventoryV38) เลย จึง "พังไม่ได้"
 *
 *  เทคนิค: ทุกกฎ scope ใต้ #page-inv (ID specificity = 1,x,0)
 *  จึงชนะกฎ class ของ v38 (.v38-* = 0,1,0) เสมอ ไม่ว่าจะ inject
 *  ก่อนหรือหลัง โดยไม่ต้องใช้ !important และไม่กระทบหน้าอื่น
 * ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function injectStyle() {
    if (document.getElementById('v100-inv-style')) return;
    const style = document.createElement('style');
    style.id = 'v100-inv-style';
    style.textContent = `
      /* ── หัวหน้า: แถบ hero แบบไล่สี ── */
      #page-inv .v38-inv{max-width:1280px}
      #page-inv .v38-head{
        background:radial-gradient(circle at 0% 0%,rgba(99,102,241,.12),transparent 42%),
                   radial-gradient(circle at 100% 120%,rgba(14,165,233,.12),transparent 46%),
                   linear-gradient(135deg,#eef2ff,#fff 58%,#f0f9ff);
        border:1px solid #e0e7ff;border-radius:22px;padding:22px 26px;
        box-shadow:0 10px 30px rgba(79,70,229,.07);align-items:center;margin-bottom:20px}
      #page-inv .v38-title{display:flex;flex-direction:column;gap:4px}
      #page-inv .v38-title h2{
        font-size:27px;font-weight:950;line-height:1.1;
        background:linear-gradient(135deg,#4338ca,#0ea5e9);-webkit-background-clip:text;
        background-clip:text;-webkit-text-fill-color:transparent;color:#3730a3}
      #page-inv .v38-title div{font-size:13px;color:#6366f1;font-weight:700;opacity:.9}

      /* ── ปุ่ม ── */
      #page-inv .v38-btn{border-radius:11px;padding:10px 15px;font-weight:850;transition:all .15s;box-shadow:0 1px 2px rgba(15,23,42,.04)}
      #page-inv .v38-btn:hover{border-color:#a5b4fc;background:#f5f7ff;transform:translateY(-1px);box-shadow:0 6px 14px rgba(79,70,229,.1)}
      #page-inv .v38-btn.primary{background:linear-gradient(135deg,#4f46e5,#6366f1);border-color:#4f46e5;color:#fff;box-shadow:0 8px 18px rgba(79,70,229,.28)}
      #page-inv .v38-btn.primary:hover{background:linear-gradient(135deg,#4338ca,#4f46e5);transform:translateY(-2px);box-shadow:0 12px 24px rgba(79,70,229,.34)}

      /* ── การ์ดสถิติ ── */
      #page-inv .v38-stats{gap:14px;margin-bottom:18px}
      #page-inv .v38-stat{
        background:linear-gradient(135deg,color-mix(in srgb,var(--tone) 9%,#fff),#fff 70%);
        border:1.5px solid color-mix(in srgb,var(--tone) 24%,#eef2f7);border-radius:18px;
        padding:18px 20px;box-shadow:0 6px 18px rgba(15,23,42,.045);
        transition:all .18s;position:relative;overflow:hidden}
      #page-inv .v38-stat::after{content:'';position:absolute;right:-14px;top:-14px;width:66px;height:66px;border-radius:50%;background:color-mix(in srgb,var(--tone) 13%,transparent)}
      #page-inv .v38-stat:hover{transform:translateY(-3px);box-shadow:0 16px 30px rgba(15,23,42,.1);border-color:color-mix(in srgb,var(--tone) 40%,#e2e8f0)}
      #page-inv .v38-stat strong{font-size:31px;letter-spacing:-.5px;line-height:1.05;position:relative}
      #page-inv .v38-stat span{font-size:12.5px;color:#475569;font-weight:850;position:relative}
      #page-inv .v38-stat.active{border-color:var(--tone);box-shadow:0 0 0 3px color-mix(in srgb,var(--tone) 18%,transparent),0 12px 26px rgba(15,23,42,.1)}

      /* ── แผงหมวดหมู่ ── */
      #page-inv .v38-cat-panel{border:1px solid #eef2f7;border-radius:20px;padding:18px 20px;box-shadow:0 6px 20px rgba(15,23,42,.045);margin-bottom:18px}
      #page-inv .v38-cat-panel-head strong{font-size:16px;font-weight:900;color:#0f172a}
      #page-inv .v38-cat-cards{gap:16px}

      /* ════ การ์ดหมวดหมู่ ดีไซน์ใหม่ทั้งหมด (v38c) ════ */
      #page-inv .v38c-card{position:relative;background:#fff;border:1px solid color-mix(in srgb,var(--cat) 20%,#eef2f7);border-radius:18px;overflow:hidden;box-shadow:0 6px 18px rgba(15,23,42,.05);transition:all .2s;display:flex;flex-direction:column}
      #page-inv .v38c-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--cat);z-index:1}
      #page-inv .v38c-card:hover{transform:translateY(-4px);box-shadow:0 22px 40px rgba(15,23,42,.13);border-color:color-mix(in srgb,var(--cat) 42%,#e2e8f0)}
      #page-inv .v38c-card.active{border-color:var(--cat);box-shadow:0 0 0 3px color-mix(in srgb,var(--cat) 20%,transparent),0 14px 28px rgba(15,23,42,.1)}
      #page-inv .v38c-body{all:unset;display:flex;flex-direction:column;flex:1;cursor:pointer;width:100%;box-sizing:border-box}

      /* หัวการ์ด — แถบสีประจำหมวด */
      #page-inv .v38c-head{display:flex;align-items:center;gap:10px;padding:15px 16px 13px;
        background:linear-gradient(135deg,color-mix(in srgb,var(--cat) 13%,#fff),color-mix(in srgb,var(--cat) 4%,#fff));
        border-bottom:1px solid color-mix(in srgb,var(--cat) 13%,#eef2f7)}
      #page-inv .v38c-dot{width:13px;height:13px;border-radius:50%;background:var(--cat);box-shadow:0 0 0 4px color-mix(in srgb,var(--cat) 20%,transparent);flex:0 0 auto}
      #page-inv .v38c-name{flex:1;min-width:0;font-size:16px;font-weight:950;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #page-inv .v38c-count{flex:0 0 auto;font-size:11px;font-weight:900;color:color-mix(in srgb,var(--cat) 72%,#1e293b);background:color-mix(in srgb,var(--cat) 15%,#fff);border:1px solid color-mix(in srgb,var(--cat) 22%,#fff);padding:4px 10px;border-radius:999px;white-space:nowrap}

      /* รายการตัวเลข แบบ list มีเส้นคั่น */
      #page-inv .v38c-rows{padding:4px 16px;display:flex;flex-direction:column}
      #page-inv .v38c-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px dashed #eef2f7}
      #page-inv .v38c-row:last-child{border-bottom:0}
      #page-inv .v38c-row>span{font-size:12.5px;font-weight:850;color:#64748b;white-space:nowrap}
      #page-inv .v38c-v{font-size:16.5px;font-weight:950;letter-spacing:-.4px;color:#0f172a;display:inline-flex;align-items:center;gap:7px;text-align:right}
      #page-inv .v38c-v.stock{color:#4f46e5}
      #page-inv .v38c-v.sales{color:#0284c7}
      #page-inv .v38c-v.gross{color:#16a34a}
      #page-inv .v38c-v.gross.neg{color:#dc2626}
      #page-inv .v38c-v i{font-style:normal;font-size:10.5px;font-weight:900;background:#ecfdf5;color:#16a34a;padding:2px 7px;border-radius:999px;letter-spacing:0}

      /* ป้ายสถานะสต็อก */
      #page-inv .v38c-foot{padding:2px 16px 15px;margin-top:auto}
      #page-inv .v38c-status{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:900;padding:6px 13px 6px 11px;border-radius:999px}
      #page-inv .v38c-status::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}
      #page-inv .v38c-status.ok{background:#ecfdf5;color:#059669}
      #page-inv .v38c-status.warn{background:#fffbeb;color:#d97706}
      #page-inv .v38c-status.danger{background:#fef2f2;color:#dc2626}

      /* ปุ่มแก้ไขหมวด — มุมขวาล่าง โผล่ตอน hover */
      #page-inv .v38c-edit{position:absolute;bottom:13px;right:13px;width:32px;height:32px;border-radius:10px;border:1px solid color-mix(in srgb,var(--cat) 30%,#e2e8f0);background:rgba(255,255,255,.95);color:var(--cat);cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:all .15s;z-index:3;backdrop-filter:blur(4px);box-shadow:0 4px 12px rgba(15,23,42,.14)}
      #page-inv .v38c-card:hover .v38c-edit{opacity:1}
      #page-inv .v38c-edit:hover{background:var(--cat);color:#fff;transform:scale(1.08)}
      #page-inv .v38c-edit i{font-size:16px}

      /* ── แผงตาราง ── */
      #page-inv .v38-table-panel{border:1px solid #eef2f7;border-radius:20px;overflow:hidden;box-shadow:0 8px 26px rgba(15,23,42,.06)}
      #page-inv .v38-toolbar{background:linear-gradient(180deg,#f8fafc,#fff);padding:16px 18px}
      #page-inv .v38-search{max-width:520px}
      #page-inv .v38-search input{height:44px;border-radius:12px;border-color:#dbe1ea;font-weight:700;transition:all .15s}
      #page-inv .v38-search input:focus{border-color:#6366f1;box-shadow:0 0 0 4px rgba(99,102,241,.13)}
      #page-inv .v38-search i{color:#a5b4fc}

      /* ── ชิปหมวด ── */
      #page-inv .v38-chips{padding:14px 18px;gap:8px}
      #page-inv .v38-chip{border-radius:999px;padding:8px 13px;border-color:#e2e8f0;font-weight:850;transition:all .15s}
      #page-inv .v38-chip:hover{border-color:#a5b4fc;background:#f5f7ff;transform:translateY(-1px)}
      #page-inv .v38-chip.active{background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-color:#6366f1;color:#4338ca;box-shadow:0 0 0 3px rgba(99,102,241,.13)}

      /* ── ตารางสินค้า ── */
      #page-inv .v38-table thead th{background:#f8fafc;color:#64748b;font-size:11.5px;font-weight:900;letter-spacing:.4px;padding:14px 16px;border-bottom:1px solid #eef2f7}
      #page-inv .v38-table td{padding:13px 16px;border-bottom:1px solid #f4f6fa}
      #page-inv .v38-table tbody tr{transition:background .12s}
      #page-inv .v38-table tbody tr:hover{background:#f7f9ff}
      #page-inv .v38-img{border-radius:11px;box-shadow:0 2px 6px rgba(15,23,42,.08)}
      #page-inv .v38-cat-badge{background:#eef2ff;color:#4f46e5;font-weight:900}
      #page-inv .v38-stock{padding:5px 11px;font-weight:950}
      #page-inv .v38-stock.ok{background:#ecfdf5;color:#059669}
      #page-inv .v38-stock.warn{background:#fffbeb;color:#d97706}
      #page-inv .v38-stock.danger{background:#fef2f2;color:#dc2626}

      /* ── ปุ่มจัดการในแถว ── */
      #page-inv .v38-actions button{width:34px;height:34px;border-radius:10px;transition:all .15s}
      #page-inv .v38-actions button:hover{background:#eef2ff;border-color:#c7d2fe;transform:translateY(-1px)}
      #page-inv .v38-actions button.danger:hover{background:#fef2f2;border-color:#fecaca}

      @media(max-width:760px){
        #page-inv .v38-head{padding:18px;border-radius:18px}
        #page-inv .v38-title h2{font-size:23px}
        #page-inv .v38-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        #page-inv .v38-stat{min-width:0;min-height:138px;padding:16px 14px}
        #page-inv .v38-stat strong{
          display:block;max-width:100%;min-width:0;
          font-size:clamp(24px,9vw,34px);line-height:1.08;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          letter-spacing:-.7px;font-variant-numeric:tabular-nums}
        #page-inv .v38-stat span{display:block;max-width:100%;line-height:1.25;white-space:normal}
        #page-inv .v38-stat:nth-child(4) strong,
        #page-inv .v38-stat.success strong,
        #page-inv .v38-stat[style*="#16a34a"] strong{
          font-size:clamp(20px,7vw,30px);letter-spacing:-.9px}
      }

      @media(max-width:390px){
        #page-inv .v38-stat{padding:14px 12px}
        #page-inv .v38-stat strong{font-size:clamp(22px,8.4vw,30px)}
        #page-inv .v38-stat:nth-child(4) strong,
        #page-inv .v38-stat.success strong,
        #page-inv .v38-stat[style*="#16a34a"] strong{
          font-size:clamp(18px,6.4vw,26px)}
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  injectStyle();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle);
  setTimeout(injectStyle, 0);
  setTimeout(injectStyle, 1500);

  console.log('[v100] inventory UI polish พร้อมใช้งาน');
})();
