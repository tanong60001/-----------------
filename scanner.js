// scanner.js - ระบบสแกนบาร์โค้ดด้วยกล้องมือถือ
let html5QrcodeScanner = null;

document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('pos-scan-btn');
  const scannerModal = document.getElementById('scanner-modal');
  const closeBtn = document.getElementById('scanner-close-btn');
  const searchInput = document.getElementById('pos-search');

  if (!scanBtn || !scannerModal || !searchInput) return;

  // เมื่อกดปุ่มสแกน
  scanBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openScanner();
  });

  // เมื่อกดปุ่มปิด X — รองรับทั้งหน้า POS และหน้าแก้ไขสินค้า
  closeBtn.addEventListener('click', () => {
    closeScanner();
    if (typeof v9StopScanner === 'function') v9StopScanner();
  });

  function openScanner() {
    scannerModal.classList.remove('hidden');
    
    // ตั้งค่ากล้อง
    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 150 }, // ขนาดกรอบสแกน
      aspectRatio: 1.0 
    };

    // เปิดกล้องหลัง (environment)
    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
      .catch(err => {
        console.error("Error starting scanner", err);
        typeof toast === 'function' && toast('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง', 'error');
        closeScanner();
      });
  }

  function closeScanner() {
    scannerModal.classList.add('hidden');
    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop().then(() => {
        html5QrcodeScanner.clear();
      }).catch(err => console.error("Error stopping scanner", err));
    }
  }

  function onScanSuccess(decodedText, decodedResult) {
    console.log(`Scan result: ${decodedText}`);
    
    // 1. นำรหัสที่สแกนได้ไปใส่ในช่องค้นหา
    searchInput.value = decodedText;
    
    // 2. กระตุ้นให้ระบบค้นหาสินค้าทำงานทันที
    const event = new Event('input', { bubbles: true });
    searchInput.dispatchEvent(event);

    // 3. ส่งเสียงเตือน ติ๊ด! (จำลองเสียง)
    playBeep();

    // 4. ปิดกล้อง
    closeScanner();
  }

  function onScanFailure(error) {
    // ปล่อยว่างไว้ เพราะมันจะแจ้งเตือนตลอดเวลาที่กล้องยังหาบาร์โค้ดไม่เจอ
  }

  // ฟังก์ชันสร้างเสียง ติ๊ด! สั้นๆ
  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime); // โทนเสียง
      gain.gain.setValueAtTime(0.1, ctx.currentTime); // ความดัง
      osc.start();
      osc.stop(ctx.currentTime + 0.1); // ความยาวเสียง 0.1 วิ
    } catch(e) {}
  }
});