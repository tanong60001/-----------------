const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('LINE PDF reports use the shared human-friendly minimal renderer', () => {
  const assistant = read('supabase/functions/line-attendance-report/index.ts');
  const renderer = read('supabase/functions/line-attendance-report/pdf-renderer.ts');
  assert.match(assistant, /createMinimalReportPdf/);
  assert.match(assistant, /createProductsRankingPdf/);
  assert.match(renderer, /summary: string/);
  assert.match(renderer, /metrics: ReportMetric\[\]/);
  assert.match(renderer, /sections: ReportSection\[\]/);
  assert.doesNotMatch(assistant, /createSimpleReportPdf/);
});

test('dashboard deployment entry is self-contained and menu is friendly', () => {
  const deployEntry = read('supabase/functions/line-attendance-report/index.ts');
  const source = read('supabase/functions/line-attendance-report/source.ts');
  assert.doesNotMatch(deployEntry, /from ["']\.\/pdf-renderer\.ts["']/);
  assert.match(deployEntry, /function createMinimalReportPdf/);
  assert.match(source, /สวัสดีครับ ผู้ช่วยร้านมาแล้ว/);
  assert.match(source, /วันนี้อยากดูเรื่องไหนดีครับ/);
  assert.match(source, /พิมพ์ “เมนู” เมื่ออยากเรียกผู้ช่วยกลับมา/);
});

test('attendance notification sends only after completion and claims a daily marker', () => {
  const assistant = read('supabase/functions/line-attendance-report/index.ts');
  assert.match(assistant, /if \(!snapshot\.complete\)/);
  assert.match(assistant, /claimAttendanceNotification\(snapshot\.today\)/);
  assert.match(assistant, /attendance-\$\{date\}\.json/);
  assert.match(assistant, /upsert: false/);
  assert.match(assistant, /attendance summary already sent today/);
  assert.match(assistant, /await push\(\[\{/);
});

test('cash drawer returns structured sales and denomination data for PDFs', () => {
  const cashdrawer = read('supabase/functions/line-cashdrawer/index.ts');
  assert.match(cashdrawer, /reports\.sales = payload\.report/);
  assert.match(cashdrawer, /reports\.cash = payload\.report/);
  assert.match(cashdrawer, /JSON\.stringify\(\{ bubbles, reports \}\)/);
  assert.match(cashdrawer, /denominations: rows\.map/);
});

test('installation guide enables attendance INSERT and UPDATE webhooks', () => {
  const guide = read('supabase/functions/LINE-ASSISTANT-GUIDE.md');
  assert.match(guide, /เปิดแจ้งเช็คชื่ออัตโนมัติ/);
  assert.match(guide, /`INSERT` และ `UPDATE`/);
  assert.doesNotMatch(guide, /ปิด Database Webhook ที่ยิง `line-attendance-report`/);
});
