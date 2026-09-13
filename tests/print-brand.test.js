const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'modules-v110-print-brand.js'), 'utf8');

function loadBrandModule() {
  const writes = [];
  const popup = {
    document: {
      write(value) { writes.push(value); },
    },
  };
  const window = {
    open() { return popup; },
  };
  const context = {
    window,
    document: { baseURI: 'https://shop.example/app/index.html' },
    URL,
    console,
  };
  vm.runInNewContext(source, context, { filename: 'modules-v110-print-brand.js' });
  return { window, popup, writes };
}

test('injects one shared logo adapter into printable HTML', () => {
  const { window } = loadBrandModule();
  const html = '<!DOCTYPE html><html><head><title>ใบเสร็จรับเงิน #2295</title></head><body><div class="page"></div></body></html>';
  const branded = window.SKPrintBrand.addBranding(html);

  assert.match(branded, /sk-print-brand-style/);
  assert.match(branded, /sk-print-brand-script/);
  assert.match(branded, /assets\/print-logo-sk\.png\?v=1/);
  assert.match(branded, /sk-print-balanced-header/);
  assert.match(branded, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(branded, /align-items:\s*start\s*!important/);
  assert.match(branded, /align-self:\s*start\s*!important/);
  assert.match(branded, /grid-template-columns:\s*14mm minmax\(0, 1fr\) 14mm/);
  assert.match(branded, /header\.children\.length!==2/);
  assert.equal((branded.match(/sk-print-brand-script/g) || []).length, 1);
  assert.equal(window.SKPrintBrand.addBranding(branded), branded);
});

test('keeps 32x25 barcode labels unbranded', () => {
  const { window } = loadBrandModule();
  const html = '<!doctype html><head><title>Barcode 32x25</title></head><body>label</body>';
  assert.equal(window.SKPrintBrand.addBranding(html), html);
});

test('keeps compact price stickers unbranded', () => {
  const { window } = loadBrandModule();
  const html = '<!doctype html><head><title>Price</title></head><body><div class="sticker">สินค้า</div></body>';
  assert.equal(window.SKPrintBrand.addBranding(html), html);
});

test('wraps blank print popup document.write but leaves named pages alone', () => {
  const { window, writes } = loadBrandModule();
  const popup = window.open('', '_blank');
  popup.document.write('<!doctype html><head><title>ใบเสนอราคา</title></head><body></body>');
  assert.match(writes[0], /sk-print-brand-script/);

  const normalPage = window.open('customer-display.html', 'customer-display');
  normalPage.document.write('plain');
  assert.equal(writes[1], 'plain');
});
