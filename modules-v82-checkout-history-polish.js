/* ════════════════════════════════════════════════════════════════
   V82: CHECKOUT MODAL COMPACT + HISTORY AUTO-REFRESH
   ────────────────────────────────────────────────────────────────
   ส่วน A. Compact Checkout
     - บีบ layout ของ checkout step 1/2/3/4 ให้พอดีจอ ไม่ต้อง scroll
     - บีบกล่อง QR สลิปโอนฝั่งคนขายให้สมมาตรและไม่ล้นจอ
     - เลย์เอาต์ให้อยู่ตรงกลางสมมาตร

   ส่วน B. History Auto-Refresh
     - หน้าประวัติบิลจะรีเฟรชอัตโนมัติเมื่อ:
       1) Modal/SweetAlert ปิด (หลังทำธุรกรรม)
       2) Window กลับมา focus / tab visible อีกครั้ง
       3) Poll ทุก 8 วินาที (fallback ถ้า realtime ไม่ทำงาน)
     - มีปุ่ม refresh manual + indicator "อัปเดตล่าสุด ... วินาที"

   หมายเหตุ: โหลด v82 หลัง v81 และทุก patch ที่เกี่ยวข้องกับ checkout
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const TAG = '[v82-polish]';

  /* ─────────────────────────────────────────────────────────────
     PART A — Compact Checkout CSS
  ───────────────────────────────────────────────────────────── */
  function injectCheckoutCompactStyles() {
    if (document.getElementById('v82-checkout-compact-style')) return;
    const css = `
      /* ── modal กว้างเดิม + ลด min-height ของ shell ── */
      .v12-checkout-shell {
        height: min(720px, 92vh) !important;
        max-height: 92vh !important;
      }

      /* ── ลด padding หัว + ตัว body ของฝั่งขวา ── */
      .v12-right-header {
        min-height: 78px !important;
        padding: 12px 24px !important;
      }
      .v12-right-body {
        padding: 18px 28px !important;
        max-height: calc(92vh - 78px - 76px) !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }
      .v12-right-footer {
        min-height: 72px !important;
        padding: 12px 28px !important;
      }

      /* ── ลดขนาด step title/subtitle ── */
      .v12-step-title {
        font-size: 22px !important;
        margin-bottom: 4px !important;
      }
      .v12-step-subtitle {
        font-size: 13px !important;
        margin-bottom: 14px !important;
      }

      /* ── ลดขนาด card (customer / payment method / delivery) ── */
      .v12-cust-card,
      .v12-delivery-card,
      .v12-pay-type-card,
      .v12-method-card {
        min-height: 108px !important;
        padding: 14px 12px !important;
        border-radius: 14px !important;
      }
      .v12-cust-card i,
      .v12-delivery-card i,
      .v12-pay-type-card i,
      .v12-method-card i {
        width: 42px !important;
        height: 42px !important;
        font-size: 22px !important;
        margin-bottom: 6px !important;
      }
      .v12-cust-card h4,
      .v12-delivery-card h4,
      .v12-pay-type-card h4,
      .v12-method-card h4 {
        font-size: 14.5px !important;
        margin: 2px 0 2px !important;
      }
      .v12-cust-card p,
      .v12-delivery-card p,
      .v12-pay-type-card p,
      .v12-method-card p {
        font-size: 11.5px !important;
      }

      /* ── ลดขนาด banner สถานะลูกค้า ── */
      .v81-cust-status {
        padding: 10px 14px !important;
        margin-bottom: 10px !important;
      }
      .v81-cust-ico {
        width: 38px !important;
        height: 38px !important;
        border-radius: 11px !important;
      }
      .v81-cust-ico i { font-size: 22px !important; }
      .v81-cust-name { font-size: 16px !important; }
      .v81-cust-label { font-size: 10.5px !important; }
      .v81-cust-meta { font-size: 11.5px !important; margin-top: 2px !important; }

      /* ── กล่อง QR สลิปโอน — แบบกะทัดรัด สมมาตร ตรงกลาง ── */
      .v36-transfer-qr-box {
        max-width: 460px !important;
        margin: 10px auto 0 !important;
        padding: 12px 14px !important;
        border-radius: 14px !important;
      }
      .v36-transfer-qr-head {
        gap: 8px !important;
        margin-bottom: 8px !important;
      }
      .v36-transfer-qr-head i { font-size: 26px !important; }
      .v36-transfer-qr-head strong { font-size: 13.5px !important; }
      .v36-transfer-qr-head span { font-size: 11px !important; }
      .v36-transfer-qr-canvas {
        width: 200px !important;
        min-height: 230px !important;
        padding: 0 !important;
        border-radius: 12px !important;
      }
      .v36-transfer-qr-canvas img {
        width: 150px !important;
        height: 150px !important;
      }
      .v36-thai-qr-top {
        height: 42px !important;
        font-size: 12px !important;
      }
      .v36-thai-qr-top .material-icons-round { font-size: 18px !important; }
      .v36-thai-qr-pill {
        margin: 6px 0 4px !important;
        padding: 1px 9px !important;
        font-size: 10.5px !important;
      }
      .v36-transfer-qr-amount {
        font-size: 22px !important;
        margin-top: 8px !important;
      }
      .v36-transfer-qr-note {
        font-size: 11px !important;
      }
      .v36-bank-account-card {
        margin: 6px auto 0 !important;
        width: min(100%, 320px) !important;
      }
      .v36-bank-account-card div {
        padding: 6px 10px !important;
        font-size: 11.5px !important;
      }

      /* ── method grid: 4 คอลัมน์ให้สมมาตรเสมอ บนจอกว้าง ── */
      @media (min-width: 820px) {
        .v12-method-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
      }

      /* ── เพิ่ม spacing ระหว่าง method grid กับ QR box ให้น้อยลง ── */
      .v12-method-grid + #sk-pay-info,
      .v12-method-grid + #v13-method-info,
      .v12-method-grid + #payment-qr-section {
        margin-top: 6px !important;
      }

      /* ── เมื่อหน้าจอเตี้ย (สูงน้อยกว่า 800px) บีบเพิ่ม ── */
      @media (max-height: 800px) {
        .v12-right-body { padding: 12px 24px !important; }
        .v12-step-title { font-size: 19px !important; }
        .v12-step-subtitle { font-size: 12px !important; margin-bottom: 10px !important; }
        .v12-cust-card,
        .v12-delivery-card,
        .v12-pay-type-card,
        .v12-method-card { min-height: 96px !important; padding: 10px 10px !important; }
        .v12-cust-card i,
        .v12-delivery-card i,
        .v12-pay-type-card i,
        .v12-method-card i { width: 36px !important; height: 36px !important; font-size: 20px !important; }
        .v36-transfer-qr-canvas { width: 175px !important; min-height: 200px !important; }
        .v36-transfer-qr-canvas img { width: 130px !important; height: 130px !important; }
        .v36-transfer-qr-amount { font-size: 19px !important; }
      }

      /* ── จัด v81-customer banner ของ step 1 ให้สมมาตร ── */
      .v36-v12-customer-grid {
        max-width: 1080px !important;
        margin: 6px auto 0 !important;
      }
    `;
    const style = document.createElement('style');
    style.id = 'v82-checkout-compact-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ─────────────────────────────────────────────────────────────
     PART B — History page auto-refresh
  ───────────────────────────────────────────────────────────── */
  let pollTimer = null;
  let lastRefreshAt = 0;
  const POLL_INTERVAL = 8000;       // 8s polling fallback
  const MIN_REFRESH_GAP = 1500;     // กันยิงซ้ำถี่เกินไป

  function isOnHistoryPage() {
    try { return (window.currentPage || '') === 'history'; } catch (_) { return false; }
  }

  async function doRefreshHistory(reason) {
    if (!isOnHistoryPage()) return;
    const now = Date.now();
    if (now - lastRefreshAt < MIN_REFRESH_GAP) return;
    lastRefreshAt = now;
    try {
      if (typeof window.v39LoadHistoryData === 'function') {
        await window.v39LoadHistoryData();
      } else if (typeof window.loadHistoryData === 'function') {
        await window.loadHistoryData();
      }
      // อัปเดต indicator (ถ้ามี)
      updateRefreshIndicator();
      console.debug(TAG, 'history refreshed:', reason);
    } catch (e) {
      console.warn(TAG, 'history refresh failed:', e);
    }
  }

  function updateRefreshIndicator() {
    const el = document.getElementById('v82-refresh-indicator');
    if (el) el.textContent = 'อัปเดตเมื่อสักครู่';
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (isOnHistoryPage() && document.visibilityState === 'visible') {
        doRefreshHistory('poll');
      }
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ── Hook 1: visibility change / focus ───────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      doRefreshHistory('visible');
    }
  });
  window.addEventListener('focus', () => {
    doRefreshHistory('focus');
  });

  // ── Hook 2: SweetAlert close → ถ้าอยู่หน้า history ให้รีเฟรช ────
  // ใช้ MutationObserver จับตอน swal2-container ถูกลบออก
  function watchSwalClose() {
    try {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.removedNodes) {
            if (node && node.nodeType === 1 &&
                (node.classList?.contains('swal2-container') ||
                 node.id === 'modal-overlay' ||
                 node.classList?.contains('modal-overlay'))) {
              // หน่วงสั้น ๆ ให้ DB เขียนเสร็จ
              setTimeout(() => doRefreshHistory('modal-close'), 350);
              return;
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: false });
    } catch (e) {
      console.warn(TAG, 'swal observer fail:', e);
    }
  }

  // ── Hook 3: ฟัง v72 broadcast (กรณี realtime ใช้ได้) ────────────
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('sk-pos-sync');
      bc.onmessage = (e) => {
        const k = e?.data?.kind;
        if (k === 'bills' || k === 'payments') {
          doRefreshHistory('broadcast:' + k);
        }
      };
    }
  } catch (_) {}

  // ── Hook 4: ปุ่ม manual refresh ใน toolbar (ถ้าไม่มี indicator) ─
  function injectRefreshButton() {
    if (!isOnHistoryPage()) return;
    if (document.getElementById('v82-refresh-btn')) return;
    const toolbar = document.querySelector('#page-history .inv-toolbar, #page-history .v39-toolbar, #page-history .v68-toolbar');
    // ไม่ต้องเพิ่มถ้าหาที่วางไม่ได้ — auto-refresh ก็พอ
    if (!toolbar) return;
    const btn = document.createElement('button');
    btn.id = 'v82-refresh-btn';
    btn.type = 'button';
    btn.className = 'btn btn-outline btn-sm';
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-weight:800';
    btn.innerHTML = '<i class="material-icons-round" style="font-size:18px">refresh</i> รีเฟรช';
    btn.onclick = () => doRefreshHistory('manual');
    toolbar.appendChild(btn);
  }

  /* ─────────────────────────────────────────────────────────────
     Boot
  ───────────────────────────────────────────────────────────── */
  function boot() {
    injectCheckoutCompactStyles();
    watchSwalClose();
    startPolling();
    // เพิ่มปุ่ม refresh เมื่อ history page ถูก render
    // ใช้ interval สั้น ๆ ตรวจอย่างต่อเนื่อง (เบามาก)
    setInterval(injectRefreshButton, 2000);
    console.info(TAG, 'compact checkout + history auto-refresh loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
