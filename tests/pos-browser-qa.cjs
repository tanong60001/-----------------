const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
// Install the optional browser runner with:
// npm.cmd install --prefix tmp/pos-qa --no-audit --no-fund playwright
const { chromium } = require('../tmp/pos-qa/node_modules/playwright');
const http = require('http');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const html = read('index.html');
  const login = html.slice(html.indexOf('  <div id="login-screen"'), html.indexOf('  <script>', html.indexOf('  <div id="login-screen"')));
  const critical = html.match(/<style id="critical-login-style">([\s\S]*?)<\/style>/)[1];
  const styles = critical + read('style.css') + read('style-additions.css');
  await page.setContent(`<style>${styles}</style>${login}`);
  const sizes = [[320,568],[360,640],[390,844],[430,932],[844,390],[390,320],[1280,800]];
  for (const [width,height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(550);
    const result = await page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; };
      return { card:rect('.login-card'), pin:rect('.pin-container'), button:rect('#login-btn'), inputs:[...document.querySelectorAll('.pin-input')].map(i=>i.getBoundingClientRect().width), screen: document.querySelector('#login-screen').scrollWidth };
    });
    assert.ok(Math.abs(result.card.x + result.card.width/2 - width/2)<1, JSON.stringify(result));
    assert.ok(Math.abs(result.pin.x + result.pin.width/2 - width/2)<1);
    assert.ok(Math.abs(result.button.x + result.button.width/2 - width/2)<1);
    assert.ok(result.screen<=width);
    assert.ok(result.card.y>=0);
    assert.ok(Math.max(...result.inputs)-Math.min(...result.inputs)<1);
    if (height>=568) assert.ok(result.card.bottom<=height);
    console.log(`login ${width}x${height}: centered, equal PIN widths, no horizontal overflow`);
    if (width===390 && height===844) await page.screenshot({path:path.join(root,'tmp/pos-qa/login-mobile.png')});
  }
  const bootStart = html.indexOf('  <div id="sk-boot-screen"');
  const boot = html.slice(bootStart, html.indexOf('  <!--', bootStart));
  for (const [mode, css] of [['critical', critical], ['loaded', styles]]) {
    await page.setContent(`<style>${css}</style>${boot}`);
    await page.evaluate(() => document.querySelector('#sk-boot-screen').classList.remove('hidden'));
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      const result = await page.evaluate(() => {
        const rect = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, bottom: r.bottom };
        };
        const screen = document.querySelector('#sk-boot-screen');
        return { card: rect('.sk-boot-card'), logo: rect('.sk-boot-brand'), track: rect('.sk-boot-track'), scrollWidth: screen.scrollWidth, width: screen.clientWidth };
      });
      for (const item of [result.card, result.logo, result.track]) assert.ok(Math.abs(item.x + item.width / 2 - width / 2) < 1, JSON.stringify(result));
      assert.ok(result.card.x >= 16 && result.card.y >= 16);
      assert.ok(result.scrollWidth <= result.width);
      if (height >= 568) assert.ok(result.card.bottom <= height - 16);
      console.log(`boot ${mode} ${width}x${height}: centered, equal side margins, no horizontal overflow`);
      if (mode === 'loaded' && width === 390 && height === 844) await page.screenshot({ path: path.join(root, 'tmp/pos-qa/boot-mobile.png'), animations: 'disabled' });
    }
    await page.evaluate(() => {
      document.querySelector('#sk-boot-step').textContent = 'กำลังตรวจสอบสิทธิ์ผู้ใช้งานและโหลดรายการสินค้าล่าสุดของร้านค้า';
      document.querySelector('#sk-boot-percent').textContent = '100%';
    });
    await page.setViewportSize({ width: 320, height: 240 });
    await page.evaluate(() => { const screen = document.querySelector('#sk-boot-screen'); screen.scrollTop = screen.scrollHeight; });
    const shortScreen = await page.evaluate(() => {
      const screen = document.querySelector('#sk-boot-screen');
      return { width: screen.clientWidth, scrollWidth: screen.scrollWidth, bottom: document.querySelector('#sk-boot-percent').getBoundingClientRect().bottom };
    });
    assert.ok(shortScreen.scrollWidth <= shortScreen.width);
    assert.ok(shortScreen.bottom <= 240);
  }
  // Real DOM + real cart code, with synthetic products and no database writes.
  await page.setContent('<div id="pos-product-grid"><div class="product-card" data-v66-product-id="p1"><div class="product-img"></div><div class="product-info"><div class="product-name">A</div></div></div></div>');
  const v66 = read('modules-v66-pos-recipe-availability.js');
  const core = v66.slice(0, v66.indexOf('  function installCore()')) + '\nwindow.v66RefreshCartBadges=refreshCartBadges; window.qaObserver=installRecipeCardObserver; window.qaState=state; })();';
  await page.evaluate(() => {
    window.cart=[]; window.products=[{ id:'p1',name:'A',stock:1000,price:10,unit:'ชิ้น' }];
    window.renderCart=()=>{}; window.gridRenders=0; window.renderProductGrid=()=>window.gridRenders++;
    window.formatNum=n=>String(n); window.getCartTotal=()=>cart.reduce((t,i)=>t+i.qty*i.price,0);
    window.toast=()=>{};
    window.originalCard=document.querySelector('.product-card');
  });
  await page.addScriptTag({content:core});
  const v9 = read('modules-v9.js');
  const start = v9.indexOf('window.v9PushToCart = function (prod, price, unitName, convRate, qty)', v9.indexOf('// ── 2. v9PushToCart — รองรับ qty ทศนิยม'));
  const end = v9.indexOf('// ── 3. Override updateCartQty',start);
  await page.addScriptTag({content:v9.slice(start,end)});
  const clicks = await page.evaluate(() => {
    const start=performance.now();
    for(let i=0;i<100;i++) v9PushToCart(products[0],10,'ชิ้น',1,1);
    return {qty:cart[0].qty, badge:document.querySelector('.product-badge').textContent, renders:gridRenders, sameCard:originalCard===document.querySelector('.product-card'),elapsed:performance.now()-start};
  });
  assert.equal(clicks.qty,100); assert.equal(clicks.badge,'100'); assert.equal(clicks.renders,0); assert.equal(clicks.sameCard,true);
  console.log('100 product additions:',JSON.stringify(clicks));
  // Deliberately mutate descendants during decoration and verify the observer
  // settles instead of generating animation frames forever.
  await page.evaluate(() => {
    qaState.recipeMap.set('p1',[{product_id:'p1',material_id:'m1',quantity:1}]);
    products.push({id:'m1',name:'material',stock:1000,cost:1});
    window.decorationFrames=0;
    const original=requestAnimationFrame;
    window.requestAnimationFrame=fn=>original(()=>{decorationFrames++;fn();});
    qaObserver();
  });
  await page.waitForSelector('.v66-recipe-price');
  await page.waitForTimeout(500);
  const frames1=await page.evaluate(()=>decorationFrames);
  await page.waitForTimeout(500);
  const frames2=await page.evaluate(()=>decorationFrames);
  assert.equal(frames2,frames1);
  console.log(`recipe observer settled after ${frames2} frame(s)`);
  const server = http.createServer((req,res) => {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if (!file.startsWith(root+path.sep)) { res.writeHead(403);res.end();return; }
    try {
      const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404);res.end(); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const fullContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await fullContext.routeWebSocket(/supabase\.co/,ws=>ws.close());
    await fullContext.route('**/thfswrvnyhuqmdazjfhd.supabase.co/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const fullPage=await fullContext.newPage();
    const errors=[];
    fullPage.on('pageerror',e=>errors.push(e.message));
    await fullPage.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
    await fullPage.waitForTimeout(8000);
    await fullPage.screenshot({path:path.join(root,'tmp/pos-qa/login-full-mobile.png')});
    const fullResult=await fullPage.evaluate(()=>{
      const card=document.querySelector('.login-card').getBoundingClientRect();
      const pin=document.querySelector('.pin-container').getBoundingClientRect();
      const button=document.querySelector('#login-btn').getBoundingClientRect();
      return {center:card.x+card.width/2,pinCenter:pin.x+pin.width/2,buttonCenter:button.x+button.width/2,top:card.y,bottom:card.bottom};
    });
    assert.ok(Math.abs(fullResult.center-195)<1);
    assert.ok(Math.abs(fullResult.pinCenter-195)<1);
    assert.ok(Math.abs(fullResult.buttonCenter-195)<1);
    assert.ok(fullResult.top>=0 && fullResult.bottom<=844);
    console.log('full application login with synthetic DB:',JSON.stringify({layout:fullResult,errors}));
    await fullPage.evaluate(() => SK_BOOT.show());
    await fullPage.screenshot({ path: path.join(root, 'tmp/pos-qa/boot-full-mobile.png'), animations: 'disabled' });
    const bootResult = await fullPage.evaluate(() => {
      const card = document.querySelector('.sk-boot-card').getBoundingClientRect();
      const screen = document.querySelector('#sk-boot-screen');
      return { center: card.x + card.width / 2, left: card.x, right: innerWidth - card.right, top: card.y, bottom: card.bottom, overflow: screen.scrollWidth > screen.clientWidth };
    });
    assert.ok(Math.abs(bootResult.center - 195) < 1);
    assert.ok(Math.abs(bootResult.left - bootResult.right) < 1);
    assert.ok(bootResult.top >= 16 && bootResult.bottom <= 828);
    assert.equal(bootResult.overflow, false);
    console.log('full application boot:', JSON.stringify(bootResult));
    await fullPage.evaluate(() => SK_BOOT.reset());
    const fullClicks=await fullPage.evaluate(async()=>{
      products=[{id:'qa',name:'QA Product',stock:1000,price:10,cost:2,unit:'ชิ้น',category:'QA',__v36UnitAware:false}];
      window.products=products;window._v9ProductsCache=products;window._v9UnitCache={qa:[]};
      cart=[];window.cart=cart;activeCategory='all';
      document.querySelector('#pos-search').value='';
      renderProductGrid();
      const first=document.querySelector('.product-card');
      window.qaGridCalls=[];
      const originalGrid=window.renderProductGrid;
      window.renderProductGrid=function(){qaGridCalls.push(new Error().stack);return originalGrid.apply(this,arguments);};
      const start=performance.now();
      for(let i=0;i<100;i++) await addToCart('qa');
      return {qty:cart[0]?.qty,elapsed:performance.now()-start,cardFound:!!first,sameCard:first===document.querySelector('.product-card'),badge:document.querySelector('.product-card .product-badge')?.textContent,gridCalls:qaGridCalls.length,stack:qaGridCalls[0]};
    });
    console.log('full application 100 additions:',JSON.stringify(fullClicks));
    assert.equal(fullClicks.qty,100);assert.equal(fullClicks.cardFound,true);assert.equal(fullClicks.sameCard,true);
    await fullContext.close();
  } finally { server.close(); }
  await browser.close();
})().catch(error=>{console.error(error); process.exit(1);});
