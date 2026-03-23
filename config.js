/**
 * SK POS Configuration
 * เก็บค่ากำหนดการเชื่อมต่อฐานข้อมูลและ Google Drive
 */

const SUPA_URL = 'https://cmkkuykjhdsjrkmqpnbw.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZnN3cnZueWh1cW1kYXpqZmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDEzOTEsImV4cCI6MjA4OTUxNzM5MX0.9JdnkPbK6KbPYA1VvKmpclFr4f41YbWK4jmmJMvTw2Y';
// Google Apps Script Web App URL สำหรับอัปโหลดรูปภาพไปยัง Google Drive
// วิธีการติดตั้ง:
// 1. ไปที่ Google Apps Script
// 2. วางโค้ดที่ระบุไว้ในคู่มือ (GDRIVE_UPLOADER_CODE)
// 3. กด Deploy > New Deployment > Web App (Set "Who has access" to "Anyone")
// 4. นำ URL ที่ได้มาใส่ตรงนี้
const GDRIVE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

// โค้ดสำหรับฝั่ง Google Apps Script (แสดงไว้เพื่อเป็นข้อมูล)
const GDRIVE_UPLOADER_CODE = `
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(body.data), body.mimeType, body.fileName
  );
  const folder = DriveApp.getFolderById('YOUR_FOLDER_ID');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return ContentService
    .createTextOutput(JSON.stringify({ url: 'https://drive.google.com/uc?id=' + file.getId() }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

// ══════════════════════════════════════════════════════
// ข้อมูลร้านค้า — แก้ไขตามร้านของคุณ
// ถูกใช้ใน ใบเสร็จ A4 / Invoice
// ══════════════════════════════════════════════════════
const SHOP_CONFIG = {
    name:    'หจก. เอส เค วัสดุ',
    nameEn:  'S K MATERIAL LIMITED PARTNERSHIP',
    address: '68 หมู่ที่ 9 สหัสขันธ์ กาฬสินธุ์',
    phone:   '087-226-1000',
    taxId:   '0951639266',
    note:    'สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน ขอบคุณที่ใช้บริการ'
};
