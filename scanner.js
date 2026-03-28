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

    // 1. ส่งเสียงแจ้งเตือน (ถ้ามีฟังก์ชัน playBeep)
    if (typeof playBeep === 'function') playBeep();

    // 2. ปิดหน้าต่างสแกนเนอร์ (ถ้าต้องการให้สแกนทีละชิ้นแล้วปิดเลย)
    // closeScanner(); 

    // 3. ตรวจสอบว่ามีข้อมูลสินค้าและฟังก์ชันเพิ่มลงตะกร้าพร้อมใช้งานหรือไม่
    if (typeof products !== 'undefined' && typeof addToCart === 'function') {

      // ค้นหาสินค้าในตัวแปร products โดยใช้รหัสบาร์โค้ดที่สแกนได้
      const foundProduct = products.find(p => p.barcode === decodedText);

      if (foundProduct) {
        // ถ้าเจอสินค้าที่มีบาร์โค้ดตรงกัน ให้เพิ่มลงตะกร้าทันที
        addToCart(foundProduct.id);

        // แจ้งเตือนว่าเพิ่มสำเร็จ
        if (typeof toast === 'function') {
          toast(`เพิ่ม ${foundProduct.name} เรียบร้อยแล้ว`, 'success');
        }

        // ล้างช่องค้นหาให้ว่างเพื่อเตรียมรับค่าถัดไป
        if (searchInput) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        // ถ้าไม่เจอสินค้าในระบบ ให้แจ้งเตือนและเอาเลขไปใส่ในช่องค้นหาแทน
        if (searchInput) {
          searchInput.value = decodedText;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (typeof toast === 'function') {
          toast('ไม่พบรหัสสินค้านี้ในระบบ', 'warning');
        }
      }
    }
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
    } catch (e) { }
  }
});
// ทำให้ช่องค้นหา Focus ตลอดเวลาในหน้า POS
document.addEventListener('keydown', (e) => {
  const searchInput = document.getElementById('pos-search');
  const activeElement = document.activeElement.tagName;

  // ตรวจสอบว่าอยู่ในหน้า POS และไม่ได้กำลังพิมพ์ในช่อง Input, Textarea (ที่อยู่) หรือ Select
  if (
    currentPage === 'pos' &&
    searchInput &&
    activeElement !== 'INPUT' &&
    activeElement !== 'TEXTAREA' &&
    activeElement !== 'SELECT'
  ) {
    searchInput.focus();
  }
});