(function () {
  'use strict';

  console.log('[v56] safe HR polish loaded');

  const ATT_TABLE = 'เช็คชื่อ';
  const ADV_TABLE = 'เบิกเงิน';
  const PAY_TABLE = 'จ่ายเงินเดือน';
  const PENDING_CATEGORY = 'รอเคลียร์ทั้งหมด';

  const money = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const fmt = value => {
    try {
      if (typeof formatNum === 'function') return formatNum(value);
    } catch (_) {}
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(money(value));
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));

  const js = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  function injectStyle() {
    if (document.getElementById('v56-hr-safe-style')) return;
    const style = document.createElement('style');
    style.id = 'v56-hr-safe-style';
    style.textContent = `
      #page-att .v26-banner{
        max-width:1440px!important;
        margin:0 auto 20px!important;
        border-radius:18px!important;
        background:
          radial-gradient(circle at 78% 18%,rgba(255,255,255,.18),transparent 26%),
          radial-gradient(circle at 18% 84%,rgba(220,38,38,.22),transparent 30%),
          linear-gradient(135deg,#100d0b 0%,#252119 48%,#645f3f 100%)!important;
        border:1px solid rgba(255,255,255,.12)!important;
        box-shadow:0 26px 64px rgba(15,23,42,.18),0 30px 46px rgba(220,38,38,.16)!important;
        overflow:hidden!important;
      }
      #page-att .v26-banner-inner{
        padding:22px!important;
        background:transparent!important;
      }
      #page-att .v26-header-left h2{
        margin:0!important;
        color:#fff!important;
        font-size:26px!important;
        line-height:1.14!important;
        letter-spacing:0!important;
      }
      #page-att .v26-header-left h2 > div{
        color:#fff!important;
      }
      #page-att .v26-date{
        color:rgba(255,255,255,.72)!important;
        font-size:13px!important;
        font-weight:850!important;
        margin-top:8px!important;
      }
      #page-att .v26-banner .btn,
      #page-att .v26-actions-grid .btn{
        height:42px!important;
        border-radius:11px!important;
        border:1px solid #d6e0ec!important;
        background:#fff!important;
        color:#334155!important;
        font-weight:950!important;
        box-shadow:0 8px 18px rgba(15,23,42,.04)!important;
      }
      #page-att .v26-actions-grid{
        display:none!important;
      }
      #page-att .v26-stats-grid{
        display:grid!important;
        grid-template-columns:repeat(3,92px)!important;
        gap:10px!important;
        padding:13px!important;
        border:1px solid rgba(255,255,255,.16)!important;
        border-radius:17px!important;
        background:rgba(255,255,255,.12)!important;
        backdrop-filter:blur(8px)!important;
      }
      #page-att .v26-stat-pill{
        min-height:74px!important;
        border:1px solid #e2e8f0!important;
        background:#fff!important;
        border-radius:13px!important;
        padding:10px 9px!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:center!important;
        gap:7px!important;
        box-shadow:0 8px 18px rgba(15,23,42,.04)!important;
      }
      #page-att .v26-stat-pill .label-wrap{
        color:#64748b!important;
        font-size:11px!important;
        font-weight:950!important;
        white-space:nowrap!important;
      }
      #page-att .v26-stat-pill strong{
        width:auto!important;
        height:auto!important;
        min-width:0!important;
        background:transparent!important;
        color:#0f172a!important;
        font-size:24px!important;
        line-height:1!important;
        box-shadow:none!important;
      }
      #page-att .v26-grid{
        max-width:1440px!important;
        margin:18px auto 0!important;
        display:grid!important;
        grid-template-columns:repeat(auto-fill,minmax(320px,1fr))!important;
        gap:16px!important;
      }
      #page-att .v26-card{
        border-radius:17px!important;
        border:1px solid #dbe6f3!important;
        background:#fff!important;
        box-shadow:0 14px 32px rgba(15,23,42,.065)!important;
        overflow:hidden!important;
        transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease!important;
      }
      #page-att .v26-card:hover{
        transform:translateY(-2px)!important;
        box-shadow:0 18px 40px rgba(15,23,42,.09)!important;
      }
      #page-att .v26-card-inner{
        background:#fff!important;
        border-radius:17px!important;
      }
      #page-att .v26-avatar{
        width:52px!important;
        height:52px!important;
        border-radius:15px!important;
        background:linear-gradient(135deg,#ef4444,#b91c1c)!important;
        color:#fff!important;
        display:grid!important;
        place-items:center!important;
        font-size:22px!important;
        box-shadow:0 12px 24px rgba(220,38,38,.2)!important;
        cursor:pointer!important;
        position:relative!important;
      }
      #page-att .v26-avatar:after{
        content:'รายละเอียด';
        position:absolute;
        left:50%;
        bottom:-22px;
        transform:translateX(-50%);
        font-size:10px;
        color:#94a3b8;
        font-weight:900;
        opacity:0;
        pointer-events:none;
        transition:opacity .16s ease;
      }
      #page-att .v26-avatar:hover:after{opacity:1}
      #page-att .v26-card-sub{
        color:#64748b!important;
        font-size:12px!important;
        font-weight:850!important;
        margin-top:4px!important;
      }
      #page-att .v26-opts{
        display:grid!important;
        grid-template-columns:1fr!important;
        gap:8px!important;
        padding:0 17px!important;
      }
      #page-att .v26-opt{
        min-height:44px!important;
        border:1px solid #e5edf6!important;
        background:#fbfdff!important;
        border-radius:12px!important;
        padding:9px 11px!important;
        display:grid!important;
        grid-template-columns:auto 1fr auto!important;
        align-items:center!important;
        gap:9px!important;
        color:#334155!important;
        font-size:13px!important;
        font-weight:950!important;
      }
      #page-att .v26-opt .v26-dot{
        width:20px!important;
        height:20px!important;
        border:2px solid #cbd5e1!important;
        border-radius:999px!important;
        background:#fff!important;
        box-shadow:inset 0 0 0 4px #fff!important;
      }
      #page-att .v26-opt.on{
        border-color:var(--oc)!important;
        background:color-mix(in srgb,var(--oc) 8%,#fff)!important;
        box-shadow:0 0 0 3px color-mix(in srgb,var(--oc) 13%,transparent)!important;
      }
      #page-att .v26-opt.on .v26-dot{
        border-color:var(--oc)!important;
        background:var(--oc)!important;
      }
      #page-att .v26-opt-info{
        color:#94a3b8!important;
        font-size:11px!important;
        font-weight:950!important;
      }
      #page-att .v26-card-note{
        width:calc(100% - 34px)!important;
        height:44px!important;
        margin:11px 17px 0!important;
        border:1px solid #dbe6f3!important;
        border-radius:12px!important;
        padding:11px 13px!important;
        font-weight:850!important;
        color:#0f172a!important;
        background:#fff!important;
        resize:none!important;
      }
      #page-att .v26-card-actions{
        display:flex!important;
        justify-content:center!important;
        gap:9px!important;
        padding:11px 17px 17px!important;
      }
      #page-att .v26-card-actions .btn{
        height:38px!important;
        border-radius:11px!important;
        background:#fff!important;
        color:#475569!important;
        border:1px solid #dbe6f3!important;
        font-size:12px!important;
        font-weight:950!important;
      }
      #page-att .v26-save-wrap{
        position:sticky!important;
        bottom:0!important;
        margin-top:22px!important;
        padding:16px 0!important;
        background:linear-gradient(0deg,#f8fafc 70%,rgba(248,250,252,0))!important;
        z-index:20!important;
      }
      #page-att .v26-save-btn{
        height:52px!important;
        min-width:260px!important;
        border-radius:14px!important;
        background:#dc2626!important;
        color:#fff!important;
        border:0!important;
        font-size:15px!important;
        font-weight:950!important;
        box-shadow:0 14px 28px rgba(220,38,38,.2)!important;
      }
      .v56-att-tools{
        max-width:1440px;
        margin:18px auto 0;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
      }
      .v56-att-search{
        display:flex;
        align-items:center;
        gap:8px;
        min-width:min(100%,420px);
        height:46px;
        border:1px solid #dbe6f3;
        background:#fff;
        border-radius:13px;
        padding:0 13px;
        box-shadow:0 8px 22px rgba(15,23,42,.04);
      }
      .v56-att-search i{color:#94a3b8}
      .v56-att-search input{
        border:0;
        outline:0;
        background:transparent;
        width:100%;
        font:inherit;
        font-weight:850;
        color:#0f172a;
      }
      .v56-att-search input::placeholder{color:#94a3b8}
      .v56-att-chip{
        border:1px solid #dbe6f3;
        background:#fff;
        color:#475569;
        border-radius:999px;
        padding:9px 12px;
        font-size:12px;
        font-weight:950;
      }
      .v56-more-wrap{position:absolute;right:20px;top:20px;z-index:120}
      .v56-more-btn{
        width:44px;
        height:44px;
        border:1px solid rgba(255,255,255,.18);
        border-radius:14px;
        background:rgba(255,255,255,.12);
        color:#fff;
        display:grid;
        place-items:center;
        cursor:pointer;
        backdrop-filter:blur(8px);
      }
      .v56-more-menu{
        position:fixed;
        right:214px;
        top:150px;
        width:238px;
        max-height:min(360px,calc(100vh - 170px));
        overflow:auto;
        padding:8px;
        border-radius:14px;
        border:1px solid #e2e8f0;
        background:#fff;
        box-shadow:0 22px 54px rgba(15,23,42,.22);
        display:none;
        z-index:100001;
      }
      .v56-more-wrap.open .v56-more-menu{display:grid;gap:6px}
      .v56-menu-item{
        height:42px;
        border:0;
        border-radius:10px;
        background:#fff;
        color:#334155;
        display:flex;
        align-items:center;
        gap:9px;
        padding:0 11px;
        font:inherit;
        font-weight:900;
        cursor:pointer;
        text-align:left;
      }
      .v56-menu-item:hover{background:#f8fafc;color:#dc2626}
      .v56-cal-modal{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.62);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px}
      .v56-cal-box{width:min(1160px,100%);max-height:92vh;background:#fff;border-radius:20px;box-shadow:0 34px 90px rgba(15,23,42,.34);overflow:hidden;display:flex;flex-direction:column}
      .v56-cal-head{padding:20px 22px;background:linear-gradient(135deg,#0f172a,#334155);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:14px}
      .v56-cal-title{display:flex;align-items:center;gap:12px;min-width:0}.v56-cal-avatar{width:46px;height:46px;border-radius:14px;background:#dc2626;display:grid;place-items:center;font-weight:950;box-shadow:0 12px 24px rgba(220,38,38,.26)}
      .v56-cal-title h3{margin:0;font-size:20px;color:#fff;font-weight:950;line-height:1.2}.v56-cal-title p{margin:4px 0 0;color:rgba(255,255,255,.72);font-size:12px;font-weight:800}
      .v56-cal-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.v56-cal-nav button{height:38px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;border-radius:10px;padding:0 12px;font:inherit;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .v56-cal-nav button.v56-export-btn{background:#10b981;border-color:#10b981;color:#fff;box-shadow:0 12px 24px rgba(16,185,129,.22)}
      .v56-cal-nav button.v56-advance-btn{background:#f59e0b;border-color:#f59e0b;color:#fff;box-shadow:0 12px 24px rgba(245,158,11,.2)}
      .v56-cal-body{padding:18px 22px 22px;overflow:auto;background:#f8fafc}.v56-cal-legend{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.v56-legend{display:inline-flex;align-items:center;gap:6px;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:7px 10px;color:#475569;font-size:12px;font-weight:900}.v56-legend i{width:10px;height:10px;border-radius:999px;display:block}
      .v56-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(118px,1fr));gap:9px}.v56-cal-dow{padding:9px 4px;text-align:center;color:#64748b;font-size:12px;font-weight:950}
      .v56-cal-day{min-height:126px;border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:10px;display:flex;flex-direction:column;gap:7px;box-shadow:0 8px 18px rgba(15,23,42,.035)}
      .v56-cal-day.muted{opacity:.38}.v56-day-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.v56-day-num{font-size:14px;font-weight:950;color:#0f172a}.v56-day-status{font-size:11px;font-weight:950;border-radius:999px;padding:4px 8px;background:#f1f5f9;color:#64748b;white-space:nowrap}
      .v56-cal-day.st-work{border-color:#bbf7d0;background:#f0fdf4}.v56-cal-day.st-work .v56-day-status{background:#dcfce7;color:#047857}
      .v56-cal-day.st-absent{border-color:#fecaca;background:#fff1f2}.v56-cal-day.st-absent .v56-day-status{background:#fee2e2;color:#b91c1c}
      .v56-cal-day.st-leave{border-color:#ddd6fe;background:#f5f3ff}.v56-cal-day.st-leave .v56-day-status{background:#ede9fe;color:#6d28d9}
      .v56-cal-day.st-late{border-color:#fed7aa;background:#fff7ed}.v56-cal-day.st-late .v56-day-status{background:#ffedd5;color:#c2410c}
      .v56-cal-day.st-half{border-color:#bae6fd;background:#f0f9ff}.v56-cal-day.st-half .v56-day-status{background:#e0f2fe;color:#0369a1}
      .v56-money-row{display:grid;grid-template-columns:42px 1fr;gap:6px;align-items:center;font-size:12px}.v56-money-row span{color:#64748b;font-weight:900}.v56-money-row b{height:28px;border:1px solid #e2e8f0;background:rgba(255,255,255,.78);border-radius:8px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;color:#0f172a;font-weight:950}
      .v56-note-line{margin-top:auto;color:#64748b;font-size:11px;font-weight:800;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .v56-cal-loading{padding:46px;text-align:center;color:#64748b;font-weight:900}.v56-cal-error{padding:24px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:14px;font-weight:900}
      .v56-hidden-by-search{display:none!important}
      @media(max-width:1120px){
        #page-att .v26-banner-inner{padding:18px!important}
        #page-att .v26-banner-inner > div{grid-template-columns:1fr!important}
        #page-att .v26-stats-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      }
      @media(max-width:768px){
        #page-att .v26-banner{
          margin:0 auto 12px!important;
          min-height:0!important;
          border-radius:16px!important;
          box-shadow:0 14px 32px rgba(15,23,42,.14)!important;
        }
        #page-att .v26-banner-inner{
          min-height:92px!important;
          padding:18px 70px 18px 18px!important;
          align-items:center!important;
        }
        #page-att .v26-header-left h2{
          gap:10px!important;
          font-size:22px!important;
        }
        #page-att .v26-header-left h2 > div{
          font-size:20px!important;
          line-height:1.15!important;
        }
        #page-att .v26-date,
        #page-att .v26-stats-grid,
        #page-att .v26-header-right,
        #page-att .v26-opts,
        #page-att .v26-card-note,
        #page-att .v26-card-actions,
        #page-att .v26-save-wrap{
          display:none!important;
        }
        #page-att .v26-grid{
          margin:10px auto 0!important;
          grid-template-columns:1fr!important;
          gap:8px!important;
        }
        #page-att .v26-card,
        #page-att .v26-card:hover{
          border-color:#dbe6f3!important;
          border-radius:12px!important;
          background:#fff!important;
          box-shadow:0 6px 18px rgba(15,23,42,.055)!important;
          transform:none!important;
        }
        #page-att .v26-card-inner{
          border-radius:12px!important;
          padding:0!important;
        }
        #page-att .v26-person-row{
          min-height:58px!important;
          gap:0!important;
          padding:14px 16px!important;
        }
        #page-att .v26-avatar,
        #page-att .v26-card-sub{
          display:none!important;
        }
        #page-att .v26-person-name{
          display:block!important;
          color:#0f172a!important;
          font-size:16px!important;
          line-height:1.35!important;
          letter-spacing:0!important;
          cursor:pointer!important;
        }
        .v56-att-tools{
          margin:0 auto!important;
          gap:8px!important;
        }
        .v56-att-search{
          width:100%!important;
          min-width:0!important;
          height:48px!important;
          border-radius:12px!important;
          box-shadow:0 8px 22px rgba(15,23,42,.045)!important;
        }
        .v56-att-chip{display:none!important}
        .v56-more-wrap{right:14px!important;top:14px!important}
        .v56-more-btn{
          width:42px!important;
          height:42px!important;
          border-radius:12px!important;
        }
        .v56-cal-modal{
          padding:10px!important;
          align-items:center!important;
        }
        .v56-cal-box{
          width:100%!important;
          max-height:calc(100dvh - 20px)!important;
          border-radius:16px!important;
        }
        .v56-cal-head{
          gap:10px!important;
          padding:14px!important;
          align-items:flex-start!important;
          flex-direction:column!important;
        }
        .v56-cal-title{gap:10px!important}
        .v56-cal-avatar{
          width:38px!important;
          height:38px!important;
          border-radius:11px!important;
          flex:0 0 38px!important;
        }
        .v56-cal-title h3{font-size:17px!important}
        .v56-cal-title p{
          font-size:11px!important;
          line-height:1.35!important;
        }
        .v56-cal-nav{
          width:100%!important;
          display:grid!important;
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:6px!important;
        }
        .v56-cal-nav button{
          min-width:0!important;
          height:36px!important;
          justify-content:center!important;
          border-radius:9px!important;
          padding:0 7px!important;
          font-size:11px!important;
          overflow:hidden!important;
        }
        .v56-cal-nav .v56-export-btn{display:none!important}
        .v56-cal-nav .v56-advance-btn{
          grid-column:1/-1!important;
          justify-self:stretch!important;
          font-size:12px!important;
        }
        .v56-cal-body{
          padding:12px 8px 14px!important;
          overflow:auto!important;
        }
        .v56-cal-legend{
          gap:5px!important;
          margin-bottom:9px!important;
        }
        .v56-legend{
          padding:5px 7px!important;
          font-size:10px!important;
        }
        .v56-cal-grid{
          width:100%!important;
          grid-template-columns:repeat(7,minmax(0,1fr))!important;
          gap:4px!important;
          overflow:visible!important;
        }
        .v56-cal-dow{
          min-width:0!important;
          padding:4px 0!important;
          font-size:10px!important;
        }
        .v56-cal-day{
          min-width:0!important;
          min-height:84px!important;
          border-radius:9px!important;
          padding:6px 4px!important;
          gap:5px!important;
          box-shadow:none!important;
          justify-content:space-between!important;
        }
        .v56-day-top{
          align-items:flex-start!important;
          flex-direction:column!important;
          gap:5px!important;
        }
        .v56-day-num{
          font-size:12px!important;
          line-height:1!important;
        }
        .v56-day-status{
          width:9px!important;
          height:9px!important;
          min-width:9px!important;
          border-radius:999px!important;
          padding:0!important;
          font-size:0!important;
        }
        .v56-money-row.payment,
        .v56-note-line{
          display:none!important;
        }
        .v56-money-row.advance{
          width:100%!important;
          min-width:0!important;
          min-height:29px!important;
          display:grid!important;
          grid-template-columns:1fr!important;
          gap:2px!important;
          align-items:stretch!important;
          padding:3px!important;
          border:1px solid #fde68a!important;
          border-radius:7px!important;
          background:rgba(255,251,235,.92)!important;
          font-size:8px!important;
          line-height:1!important;
          overflow:hidden!important;
        }
        .v56-money-row.advance span{
          color:#b45309!important;
          font-size:8px!important;
          line-height:1!important;
          text-align:center!important;
        }
        .v56-money-row.advance b{
          width:100%!important;
          height:auto!important;
          min-height:13px!important;
          border:0!important;
          border-radius:5px!important;
          background:#fff!important;
          padding:1px 2px!important;
          color:#92400e!important;
          font-size:8px!important;
          line-height:1.1!important;
          justify-content:center!important;
          text-align:center!important;
          overflow-wrap:anywhere!important;
        }
      }
      @media(max-width:640px){
        #page-att .v26-grid{grid-template-columns:1fr!important}
        #page-att .v26-actions-grid{grid-template-columns:1fr!important}
        #page-att .v26-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        #page-att .v26-save-btn{width:100%!important;min-width:0!important}
        .v56-more-wrap{right:14px;top:14px}.v56-cal-head{align-items:flex-start;flex-direction:column}.v56-cal-nav{justify-content:flex-start}.v56-cal-grid{grid-template-columns:repeat(7,minmax(0,1fr));overflow:visible}.v56-cal-day{min-height:84px}
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceAttendancePage() {
    const page = document.getElementById('page-att');
    if (!page || page.classList.contains('hidden')) return;
    const grid = page.querySelector('.v26-grid');
    if (!grid || page.querySelector('[data-v56-att-tools]')) return;

    installFeatureMenu(page);

    const cards = Array.from(page.querySelectorAll('.v26-card'));
    cards.forEach(card => {
      const name = card.textContent || '';
      card.dataset.v56Search = name.toLowerCase();
      installEmployeeDetailTrigger(card);
    });

    const tools = document.createElement('div');
    tools.className = 'v56-att-tools';
    tools.dataset.v56AttTools = '1';
    tools.innerHTML = `
      <label class="v56-att-search">
        <i class="material-icons-round">search</i>
        <input type="search" id="v56-att-search" placeholder="ค้นหาพนักงาน">
      </label>
      <span class="v56-att-chip">พนักงานทั้งหมด ${cards.length} คน</span>
    `;
    grid.parentNode.insertBefore(tools, grid);

    const input = tools.querySelector('#v56-att-search');
    input?.addEventListener('input', () => {
      const q = String(input.value || '').toLowerCase().trim();
      cards.forEach(card => {
        card.classList.toggle('v56-hidden-by-search', q && !String(card.dataset.v56Search || '').includes(q));
      });
    });
  }

  function installFeatureMenu(page) {
    const banner = page.querySelector('.v26-banner');
    const actionGrid = page.querySelector('.v26-actions-grid');
    if (!banner || !actionGrid || banner.querySelector('[data-v56-more]')) return;

    const wrap = document.createElement('div');
    wrap.className = 'v56-more-wrap';
    wrap.dataset.v56More = '1';
    wrap.innerHTML = `
      <button class="v56-more-btn" type="button" title="เมนูเพิ่มเติม"><i class="material-icons-round">more_horiz</i></button>
      <div class="v56-more-menu"></div>
    `;

    const menu = wrap.querySelector('.v56-more-menu');
    Array.from(actionGrid.querySelectorAll('button')).forEach(btn => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'v56-menu-item';
      item.innerHTML = btn.innerHTML;
      item.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        wrap.classList.remove('open');
        btn.click();
      });
      menu.appendChild(item);
    });

    if (typeof window.renderStaffSalesDashboard === 'function' && !menu.querySelector('[data-v56-staff-sales]')) {
      const staffSales = document.createElement('button');
      staffSales.type = 'button';
      staffSales.className = 'v56-menu-item';
      staffSales.dataset.v56StaffSales = '1';
      staffSales.innerHTML = '<i class="material-icons-round">leaderboard</i> ยอดขายพนักงาน';
      staffSales.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        wrap.classList.remove('open');
        window.renderStaffSalesDashboard();
      });
      menu.insertBefore(staffSales, menu.children[2] || null);
    }

    wrap.querySelector('.v56-more-btn')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const menuWidth = 238;
      menu.style.top = Math.min(rect.bottom + 10, window.innerHeight - 80) + 'px';
      menu.style.left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)) + 'px';
      menu.style.right = 'auto';
      wrap.classList.toggle('open');
    });

    document.addEventListener('click', event => {
      if (!wrap.contains(event.target)) wrap.classList.remove('open');
    });

    banner.appendChild(wrap);
  }

  function getEmployeeNameFromCard(card) {
    const sub = card.querySelector('.v26-card-sub');
    const nameEl = sub?.parentElement?.firstElementChild;
    return String(nameEl?.textContent || '').trim() || 'พนักงาน';
  }

  function installEmployeeDetailTrigger(card) {
    const avatar = card.querySelector('.v26-avatar');
    if (!avatar || avatar.dataset.v56DetailBound === '1') return;
    const empId = String(card.id || '').replace(/^v26c-/, '');
    if (!empId) return;

    avatar.dataset.v56DetailBound = '1';
    avatar.title = 'ดูรายละเอียดรายเดือน';
    avatar.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      window.v56OpenEmployeeCalendar(empId, getEmployeeNameFromCard(card), 0);
    });

    const name = card.querySelector('.v26-person-name');
    if (name && name.dataset.v56DetailBound !== '1') {
      name.dataset.v56DetailBound = '1';
      name.title = 'เธ”เธนเธเธเธดเธ—เธดเธเธเธเธฑเธเธเธฒเธ';
      name.addEventListener('click', event => {
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        event.preventDefault();
        event.stopPropagation();
        window.v56OpenEmployeeCalendar(empId, getEmployeeNameFromCard(card), 0);
      });
    }
  }

  function monthInfo(offset = 0) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + Number(offset || 0), 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const start = localDateKey(first);
    const end = localDateKey(last);
    const monthKey = start;
    return { first, last, start, end, monthKey, offset: Number(offset || 0) };
  }

  function localDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function dateKey(value) {
    if (!value) return '';
    if (value instanceof Date) return localDateKey(value);
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? raw.slice(0, 10) : localDateKey(date);
  }

  function addAmount(map, key, amount) {
    if (!key) return;
    map[key] = money(map[key]) + money(amount);
  }

  function statusClass(status) {
    const s = String(status || '').trim();
    if (s === 'มา') return 'st-work';
    if (s === 'ขาด') return 'st-absent';
    if (s === 'ลา') return 'st-leave';
    if (s === 'มาสาย') return 'st-late';
    if (s === 'ครึ่งวัน' || s === 'มาครึ่งวัน') return 'st-half';
    return '';
  }

  async function loadEmployeeMonth(empId, info) {
    if (typeof db === 'undefined') throw new Error('ระบบฐานข้อมูลยังไม่พร้อม');

    const [attRes, advRes, paidRes] = await Promise.all([
      db.from(ATT_TABLE).select('*').eq('employee_id', empId).gte('date', info.start).lte('date', info.end),
      db.from(ADV_TABLE).select('*').eq('employee_id', empId).gte('date', info.start + 'T00:00:00').lte('date', info.end + 'T23:59:59'),
      db.from(PAY_TABLE).select('*').eq('employee_id', empId),
    ]);

    if (attRes.error) throw attRes.error;
    if (advRes.error) throw advRes.error;
    if (paidRes.error) throw paidRes.error;

    const attendance = {};
    (attRes.data || []).forEach(row => {
      attendance[dateKey(row.date)] = row;
    });

    const advances = {};
    (advRes.data || []).forEach(row => {
      addAmount(advances, dateKey(row.date), row.amount);
    });

    const payments = {};
    (paidRes.data || []).forEach(row => {
      const paidAt = dateKey(row.paid_date || row.created_at || row.updated_at);
      const inMonth = paidAt >= info.start && paidAt <= info.end;
      if (inMonth) addAmount(payments, paidAt, row.net_paid || row.amount || row.total || 0);
      else if (String(row.month || '').slice(0, 10) === info.monthKey) {
        addAmount(payments, info.end, row.net_paid || row.amount || row.total || 0);
      }
    });

    return { attendance, advances, payments };
  }

  function renderCalendarDays(data, info) {
    const dows = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const cells = [];
    dows.forEach(day => cells.push(`<div class="v56-cal-dow">${day}</div>`));

    const leading = info.first.getDay();
    for (let i = 0; i < leading; i++) {
      cells.push('<div class="v56-cal-day muted"></div>');
    }

    for (let day = 1; day <= info.last.getDate(); day++) {
      const date = new Date(info.first.getFullYear(), info.first.getMonth(), day);
      const key = localDateKey(date);
      const att = data.attendance[key] || null;
      const status = att?.status || 'ยังไม่ลง';
      const adv = money(data.advances[key]);
      const paid = money(data.payments[key]);
      const note = String(att?.note || '').trim();
      cells.push(`
        <div class="v56-cal-day ${statusClass(status)}">
          <div class="v56-day-top">
            <span class="v56-day-num">${day}</span>
            <span class="v56-day-status">${esc(status)}</span>
          </div>
          <div class="v56-money-row advance"><span>เบิก</span><b>${adv ? '฿' + fmt(adv) : '-'}</b></div>
          <div class="v56-money-row payment"><span>จ่าย</span><b>${paid ? '฿' + fmt(paid) : '-'}</b></div>
          <div class="v56-note-line">${note ? esc(note) : ' '}</div>
        </div>
      `);
    }

    return cells.join('');
  }

  function renderCalendarShell(empId, empName, offset, bodyHtml) {
    const info = monthInfo(offset);
    const monthName = info.first.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    document.getElementById('v56-cal-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'v56-cal-modal';
    modal.className = 'v56-cal-modal';
    modal.innerHTML = `
      <div class="v56-cal-box">
        <div class="v56-cal-head">
          <div class="v56-cal-title">
            <div class="v56-cal-avatar">${esc(empName.slice(0, 1) || '?')}</div>
            <div>
              <h3>${esc(empName)}</h3>
              <p>รายละเอียดการทำงาน เบิกเงิน และจ่ายเงินเดือน · ${esc(monthName)}</p>
            </div>
          </div>
          <div class="v56-cal-nav">
            <button type="button" onclick="v56OpenEmployeeCalendar('${js(empId)}','${js(empName)}',${info.offset - 1})"><i class="material-icons-round">chevron_left</i>เดือนก่อน</button>
            <button type="button" onclick="v56OpenEmployeeCalendar('${js(empId)}','${js(empName)}',0)">เดือนนี้</button>
            <button type="button" onclick="v56OpenEmployeeCalendar('${js(empId)}','${js(empName)}',${info.offset + 1})">เดือนถัดไป<i class="material-icons-round">chevron_right</i></button>
            <button type="button" onclick="document.getElementById('v56-cal-modal')?.remove()"><i class="material-icons-round">close</i></button>
            <button class="v56-advance-btn" type="button" onclick="v56OpenAdvanceFromCalendar('${js(empId)}','${js(empName)}')"><i class="material-icons-round">payments</i>เบิกเงิน</button>
            <button class="v56-export-btn" type="button" onclick="v56ExportEmployeeCalendarExcel('${js(empId)}','${js(empName)}',${info.offset})"><i class="material-icons-round">grid_on</i>Excel</button>
          </div>
        </div>
        <div class="v56-cal-body">${bodyHtml}</div>
      </div>
    `;
    modal.addEventListener('click', event => {
      if (event.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
    return info;
  }

  function safeFileName(value) {
    return String(value || 'export').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80);
  }

  function downloadExcelHtml(fileName, html) {
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  function calendarExcelHtml(empName, info, data) {
    const dows = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
    const monthName = info.first.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    const rows = [];
    let week = new Array(7).fill('<td class="blank"></td>');
    let dayOfWeek = info.first.getDay();
    for (let day = 1; day <= info.last.getDate(); day++) {
      const date = new Date(info.first.getFullYear(), info.first.getMonth(), day);
      const key = localDateKey(date);
      const att = data.attendance[key] || null;
      const status = att?.status || 'ยังไม่ลง';
      const adv = money(data.advances[key]);
      const paid = money(data.payments[key]);
      const note = String(att?.note || '').trim();
      const cls = statusClass(status).replace('st-', 'xls-');
      week[dayOfWeek] = `<td class="${cls}">
        <div class="day">${day}</div>
        <div class="pill">${esc(status)}</div>
        <div class="line"><span>เบิก</span><b>${adv ? '฿' + fmt(adv) : '-'}</b></div>
        <div class="line"><span>จ่าย</span><b>${paid ? '฿' + fmt(paid) : '-'}</b></div>
        <div class="note">${note ? esc(note) : '&nbsp;'}</div>
      </td>`;
      if (dayOfWeek === 6 || day === info.last.getDate()) {
        rows.push(`<tr>${week.join('')}</tr>`);
        week = new Array(7).fill('<td class="blank"></td>');
      }
      dayOfWeek = (dayOfWeek + 1) % 7;
    }
    const presentCount = Object.values(data.attendance || {}).filter(row => row?.status && row.status !== 'ขาด').length;
    const absentCount = Object.values(data.attendance || {}).filter(row => row?.status === 'ขาด').length;
    const totalAdvance = Object.values(data.advances || {}).reduce((sum, value) => sum + money(value), 0);
    const totalPaid = Object.values(data.payments || {}).reduce((sum, value) => sum + money(value), 0);
    return `<!doctype html><html><head><meta charset="utf-8">
      <style>
        @page{size:A4 landscape;margin:8mm}
        body{font-family:Tahoma,'Prompt',sans-serif;color:#0f172a}
        table{border-collapse:collapse;width:100%}
        .title{background:#111827;color:#fff}
        .title td{padding:14px 16px;border:1px solid #111827}
        .title h1{margin:0;font-size:22px}.title p{margin:4px 0 0;color:#cbd5e1;font-size:12px}
        .summary td{border:1px solid #cbd5e1;padding:8px 10px;background:#f8fafc;font-weight:700}
        .dow th{background:#334155;color:#fff;border:1px solid #334155;padding:8px;font-size:12px}
        .cal td{width:14.285%;height:98px;vertical-align:top;border:1px solid #cbd5e1;padding:7px;background:#fff}
        .cal td.blank{background:#f1f5f9}
        .day{font-size:15px;font-weight:900;float:left}.pill{float:right;border-radius:14px;background:#e2e8f0;color:#475569;padding:3px 7px;font-size:10px;font-weight:900}
        .line{clear:both;margin-top:18px;display:flex;justify-content:space-between;font-size:11px}.line+ .line{margin-top:5px}.line span{color:#64748b;font-weight:700}.line b{color:#0f172a}
        .note{margin-top:7px;color:#475569;font-size:10px;line-height:1.3}
        .xls-work{background:#ecfdf5!important}.xls-work .pill{background:#bbf7d0;color:#047857}
        .xls-absent{background:#fff1f2!important}.xls-absent .pill{background:#fecaca;color:#b91c1c}
        .xls-leave{background:#f5f3ff!important}.xls-leave .pill{background:#ddd6fe;color:#6d28d9}
        .xls-late{background:#fff7ed!important}.xls-late .pill{background:#fed7aa;color:#c2410c}
        .xls-half{background:#f0f9ff!important}.xls-half .pill{background:#bae6fd;color:#0369a1}
      </style></head><body>
      <table>
        <tr class="title"><td colspan="7"><h1>ปฏิทินพนักงาน: ${esc(empName)}</h1><p>${esc(monthName)} · ส่งออกเมื่อ ${new Date().toLocaleString('th-TH')}</p></td></tr>
        <tr class="summary">
          <td colspan="2">วันทำงาน/ลงเวลา: ${presentCount}</td>
          <td>ขาด: ${absentCount}</td>
          <td colspan="2">เบิกรวม: ฿${fmt(totalAdvance)}</td>
          <td colspan="2">จ่ายรวม: ฿${fmt(totalPaid)}</td>
        </tr>
        <tr class="dow">${dows.map(day => `<th>${day}</th>`).join('')}</tr>
      </table>
      <table class="cal">${rows.join('')}</table>
      </body></html>`;
  }

  window.v56ExportEmployeeCalendarExcel = async function (empId, empName, offset = 0) {
    try {
      const info = monthInfo(offset);
      const data = await loadEmployeeMonth(empId, info);
      const monthName = info.first.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
      downloadExcelHtml(
        `ปฏิทิน_${safeFileName(empName)}_${safeFileName(monthName)}.xls`,
        calendarExcelHtml(empName, info, data)
      );
      toast?.('ส่งออก Excel ปฏิทินสำเร็จ', 'success');
    } catch (error) {
      console.error('[v56] export calendar:', error);
      toast?.('ส่งออก Excel ไม่สำเร็จ: ' + (error.message || error), 'error');
    }
  };

  window.v56OpenAdvanceFromCalendar = function (empId, empName) {
    document.getElementById('v56-cal-modal')?.remove();
    if (typeof window.openAdvanceWizard === 'function') {
      window.openAdvanceWizard(empId, empName);
      return;
    }
    toast?.('เมนูเบิกเงินยังโหลดไม่สำเร็จ', 'warning');
  };

  window.v56OpenEmployeeCalendar = async function (empId, empName, offset = 0) {
    const info = renderCalendarShell(empId, empName, offset, '<div class="v56-cal-loading">กำลังโหลดรายละเอียดรายเดือน...</div>');
    try {
      const data = await loadEmployeeMonth(empId, info);
      const legend = `
        <div class="v56-cal-legend">
          <span class="v56-legend"><i style="background:#22c55e"></i>มาทำงาน</span>
          <span class="v56-legend"><i style="background:#ef4444"></i>ขาด</span>
          <span class="v56-legend"><i style="background:#8b5cf6"></i>ลา</span>
          <span class="v56-legend"><i style="background:#f59e0b"></i>มาสาย</span>
          <span class="v56-legend"><i style="background:#0ea5e9"></i>ครึ่งวัน</span>
        </div>
      `;
      renderCalendarShell(empId, empName, offset, `${legend}<div class="v56-cal-grid">${renderCalendarDays(data, info)}</div>`);
    } catch (error) {
      console.error('[v56] employee calendar:', error);
      renderCalendarShell(empId, empName, offset, `<div class="v56-cal-error">โหลดรายละเอียดไม่สำเร็จ: ${esc(error.message || error)}</div>`);
    }
  };

  function ensurePendingCategoryTab() {
    const wrap = document.getElementById('pos-categories');
    if (!wrap) return;
    const tab = wrap.querySelector('[data-v54-pending-cat], [data-v56-pending-cat]');
    if (tab) return;
    if (typeof window.v54SetPendingCategory !== 'function') return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-tab v54-pending-cat';
    btn.dataset.v56PendingCat = '1';
    btn.dataset.cat = PENDING_CATEGORY;
    btn.innerHTML = '<i class="material-icons-round" style="font-size:15px;vertical-align:-3px;margin-right:4px">pending_actions</i>' + PENDING_CATEGORY;
    btn.addEventListener('click', event => {
      event.preventDefault();
      window.v54SetPendingCategory();
    });
    wrap.appendChild(btn);
  }

  function wrapRenderAttendance() {
    if (window.renderAttendance?.__v56SafePolish) return;
    const original = window.renderAttendance;
    if (typeof original !== 'function') return;

    window.renderAttendance = async function () {
      const result = await original.apply(this, arguments);
      setTimeout(enhanceAttendancePage, 0);
      return result;
    };
    window.renderAttendance.__v56SafePolish = true;
    try { renderAttendance = window.renderAttendance; } catch (_) {}
  }

  function boot() {
    injectStyle();
    wrapRenderAttendance();
    ensurePendingCategoryTab();
    enhanceAttendancePage();
    [100, 400, 1000, 2000].forEach(delay => setTimeout(() => {
      wrapRenderAttendance();
      ensurePendingCategoryTab();
      enhanceAttendancePage();
    }, delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
