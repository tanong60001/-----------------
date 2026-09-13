/**
 * SK POS - shared print branding.
 *
 * Every printable popup in the legacy modules is produced with document.write().
 * This last-loaded adapter adds the current SK logo without having to maintain a
 * different copy of the logo markup in every receipt/report implementation.
 */
(function installPrintBranding() {
  'use strict';

  if (window.__skPrintBrandInstalled) return;
  window.__skPrintBrandInstalled = true;

  const nativeOpen = window.open.bind(window);
  const logoUrl = new URL('assets/print-logo-sk.png?v=1', document.baseURI).href;
  const excludedDocument = /barcode|bar\s*code|32x25|ฉลาก|บาร์โค้ด/i;

  const brandCss = `
<style id="sk-print-brand-style">
  .sk-print-brand-host {
    display: flex !important;
    align-items: center !important;
    gap: 3mm !important;
    min-width: 0 !important;
    text-align: left !important;
  }
  .sk-print-brand-copy { min-width: 0 !important; flex: 1 1 auto !important; }
  .sk-print-balanced-header {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
    align-items: start !important;
    column-gap: 8mm !important;
    min-height: 20mm !important;
  }
  .sk-print-balanced-header > .sk-print-brand-host {
    width: 100% !important;
    justify-self: stretch !important;
    align-self: start !important;
  }
  .sk-print-balanced-header > :not(.sk-print-brand-host) {
    max-width: 100% !important;
    justify-self: end !important;
    text-align: right !important;
  }
  .sk-print-brand-logo {
    display: block !important;
    width: 20mm !important;
    height: 20mm !important;
    flex: 0 0 20mm !important;
    object-fit: contain !important;
    object-position: center !important;
  }
  .sk-print-brand-fallback {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-height: 20mm !important;
    margin: 0 0 4mm !important;
  }
  body.sk-print-narrow .sk-print-brand-host {
    display: grid !important;
    grid-template-columns: 14mm minmax(0, 1fr) 14mm !important;
    align-items: center !important;
    gap: 1mm !important;
    width: 100% !important;
  }
  body.sk-print-narrow .sk-print-brand-copy { text-align: center !important; }
  body.sk-print-narrow .sk-print-brand-host::after {
    content: '' !important;
    display: block !important;
    width: 14mm !important;
    height: 1px !important;
  }
  body.sk-print-narrow .sk-print-brand-logo {
    width: 14mm !important;
    height: 14mm !important;
    flex-basis: 14mm !important;
  }
  body.sk-print-narrow .sk-print-brand-fallback {
    justify-content: center !important;
    min-height: 14mm !important;
    margin-bottom: 2mm !important;
  }
</style>`;

  function brandScript() {
    const encodedUrl = JSON.stringify(logoUrl);
    return `
<script id="sk-print-brand-script">
(function(){
  var logoUrl=${encodedUrl};
  var nativePrint=window.print.bind(window);
  var hostSelectors=[
    '.v103-print-shop',
    '.v103-trip-append-shop',
    '.shop',
    '.shop-info',
    '.store-info',
    '.company-info',
    '.brand',
    '.logo',
    '.hdr > div:first-child',
    '.hd > div:first-child',
    '.head > div:first-child',
    '.header > div:first-child',
    '.doc-header > div:first-child',
    '.document-header > div:first-child',
    '.top > div:first-child',
    '.bn-top > div:first-child',
    'header > div:first-child'
  ];
  var headerSelectors=[
    '.v103-print-top',
    '.v103-trip-append-head',
    '.bn-top',
    '.hdr',
    '.hd',
    '.head',
    '.top',
    '.document-header',
    '.doc-header',
    '.header',
    'header'
  ];

  function makeLogo(){
    var img=document.createElement('img');
    img.className='sk-print-brand-logo';
    img.src=logoUrl;
    img.alt='SK';
    img.setAttribute('aria-label','โลโก้ SK');
    return img;
  }

  function brandHost(host){
    if(!host || host.dataset.skPrintBranded==='1') return;
    host.dataset.skPrintBranded='1';
    host.classList.add('sk-print-brand-host');
    var copy=document.createElement('div');
    copy.className='sk-print-brand-copy';
    while(host.firstChild) copy.appendChild(host.firstChild);
    host.appendChild(makeLogo());
    host.appendChild(copy);
  }

  function balanceHeader(host,root,narrow){
    if(narrow || !host) return;
    var header=null;
    for(var i=0;i<headerSelectors.length && !header;i++) header=host.closest(headerSelectors[i]);
    if(!header || !root.contains(header) || header.children.length!==2) return;
    header.classList.add('sk-print-balanced-header');
  }

  function enhance(){
    if(!document.body) return;
    var narrow=/80\s*mm|receipt\s*80/i.test(document.title || '') ||
      document.body.getBoundingClientRect().width < 500;
    document.body.classList.toggle('sk-print-narrow',narrow);

    var roots=Array.prototype.slice.call(document.querySelectorAll(
      '.bn-page,.v103-print-page,.v103-trip-append,.page,.sheet'
    ));
    if(!roots.length) roots=[document.body];

    roots.forEach(function(root){
      if(root.dataset.skPrintRootBranded==='1') return;
      root.dataset.skPrintRootBranded='1';
      var host=null;
      for(var i=0;i<hostSelectors.length && !host;i++) host=root.querySelector(hostSelectors[i]);
      if(host){
        brandHost(host);
        balanceHeader(host,root,narrow);
        return;
      }
      var fallback=document.createElement('div');
      fallback.className='sk-print-brand-fallback';
      fallback.appendChild(makeLogo());
      root.insertBefore(fallback,root.firstChild);
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',enhance,{once:true});
  else enhance();

  window.print=function(){
    enhance();
    nativePrint();
  };
})();
<\/script>`;
  }

  function addBranding(html) {
    if (typeof html !== 'string') return html;
    if (!/<(?:!doctype|html|head)\b/i.test(html)) return html;
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || '';
    const isSmallLabel = /@page\s*\{[^}]*size\s*:\s*32\s*mm\s+25\s*mm/i.test(html) ||
      /class=["'][^"']*\b(?:sticker|bc-item)\b/i.test(html);
    if (excludedDocument.test(title) || isSmallLabel) return html;
    if (html.includes('sk-print-brand-script')) return html;

    const injection = brandCss + brandScript();
    if (/<\/head\s*>/i.test(html)) return html.replace(/<\/head\s*>/i, injection + '</head>');
    return injection + html;
  }

  window.open = function brandedWindowOpen(url, target, features) {
    const popup = nativeOpen(url, target, features);
    const isBlankPrintPopup = popup && (url === '' || url == null || url === 'about:blank');
    if (!isBlankPrintPopup) return popup;

    try {
      const nativeWrite = popup.document.write.bind(popup.document);
      popup.document.write = function brandedDocumentWrite() {
        const args = Array.from(arguments).map(addBranding);
        return nativeWrite.apply(popup.document, args);
      };
    } catch (error) {
      console.warn('[print-brand] unable to prepare popup', error);
    }
    return popup;
  };

  window.SKPrintBrand = Object.freeze({
    logoUrl,
    addBranding,
  });
})();
