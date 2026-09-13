const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const drawer = fs.readFileSync(path.join(root, 'modules-v109-checkout-drawer.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const checkoutCore = fs.readFileSync(path.join(root, 'modules-v12.js'), 'utf8');
const checkoutFlow = fs.readFileSync(path.join(root, 'modules-v13.js'), 'utf8');
const projects = fs.readFileSync(path.join(root, 'modules-v14.js'), 'utf8');
const billHold = fs.readFileSync(path.join(root, 'modules-v87-bill-draft-hold.js'), 'utf8');
const productGrid = fs.readFileSync(path.join(root, 'modules-v66-pos-recipe-availability.js'), 'utf8');

test('checkout drawer is loaded after existing checkout extensions', () => {
  const drawerIndex = html.indexOf('modules-v109-checkout-drawer.js?v=3');
  assert.notEqual(drawerIndex, -1);
  assert.ok(drawerIndex > html.indexOf('modules-v93-mobile-checkout-popup.js?v=1'));
  assert.ok(drawerIndex > html.indexOf('modules-v108-fuel-ledger.js?v=4'));
});

test('desktop checkout is a right-side half-screen drawer while mobile remains supported', () => {
  assert.match(drawer, /justify-content:\s*flex-end\s*!important/);
  assert.match(drawer, /width:\s*clamp\(920px,\s*64vw,\s*1280px\)\s*!important/);
  assert.match(drawer, /v109-drawer-in/);
  assert.match(drawer, /@media \(min-width:\s*769px\)/);
  assert.match(drawer, /v12-btn-back\[style\*="display: none"\]/);
  assert.match(drawer, /v12-btn-next\[style\*="display: none"\]/);
  assert.match(drawer, /event\.target !== overlay/);
  assert.match(drawer, /choice\.click\(\)/);
  assert.match(drawer, /\.v14-proj-cust-card/);
  assert.match(drawer, /\.v13-method-card-debt/);
  assert.match(drawer, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(drawer, /\.v81-cust-status\s*\{\s*display:\s*none\s*!important/);
  assert.doesNotMatch(drawer, /box-shadow:\s*inset 3px 0 0/);
  assert.match(drawer, /requestAnimationFrame/);
  assert.doesNotMatch(drawer, /window\.(?:startCheckout|closeCheckout|v12NextStep)\s*=(?!=)/);
});

test('offline shell includes the checkout drawer asset', () => {
  assert.match(worker, /sk-pos-offline-v18/);
  assert.match(worker, /modules-v109-checkout-drawer\.js\?v=3/);
});

test('project selection is cleared when changing customer type', () => {
  assert.match(projects, /project_budget\s*=\s*null/);
  assert.match(projects, /\.v14-proj-cust-card'[\s\S]*classList\.remove\('selected'\)/);
  assert.match(projects, /class="v14-project-option"/);
  assert.match(projects, /classList\.add\('is-selected'\)/);
});

test('all checkout footer and choice actions still have handlers', () => {
  assert.match(checkoutCore, /window\.closeCheckout\s*=\s*function/);
  assert.match(checkoutFlow, /window\.v12NextStep\s*=\s*function/);
  assert.match(checkoutFlow, /window\.v12PrevStep\s*=\s*function/);
  assert.match(projects, /window\.v13SelectCustType\s*=\s*function/);
  assert.match(projects, /window\.v14SelectProjectType\s*=\s*async function/);
  assert.match(projects, /window\.v13SetMethod\s*=\s*window\.v12SetMethod\s*=\s*function/);
  assert.match(billHold, /window\.v87HoldCurrentBill\s*=\s*async function/);
});

test('failed product images are cached and replaced with placeholders', () => {
  assert.match(productGrid, /FAILED_IMAGE_CACHE_KEY/);
  assert.match(productGrid, /state\.failedImageUrls\.has\(url\)/);
  assert.match(productGrid, /decoding="async"/);
  assert.match(productGrid, /onerror="v66HandleProductImageError\(this\)"/);
});
