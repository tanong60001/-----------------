// ══════════════════════════════════════════════════════════════════
// SK POS — Service Worker: Product Image Cache
// ══════════════════════════════════════════════════════════════════
// Cache-first strategy สำหรับรูปสินค้า Supabase Storage
// ลด Bandwidth จาก 15 GB/เดือน → ~300 MB/เดือน
// ══════════════════════════════════════════════════════════════════

const CACHE_NAME = 'sk-pos-offline-v7';
const SHELL_CACHE = [
  './', './index.html', './style.css', './style-additions.css',
  './config.js', './offline-db.js', './app.js', './modules.js',
  './scanner.js', './manifest.webmanifest', './assets/app-icon-sk.svg'
];
const SUPABASE_STORAGE_MARKER = '/storage/v1/object/public/product-images/';

// ── Install: เตรียม cache ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_CACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: ลบ cache เก่า ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name.startsWith('sk-pos-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-first สำหรับ product images ────────────────────
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone())).catch(() => {});
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  const requestUrl = new URL(url);
  const isCdnAsset = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(requestUrl.hostname);
  const isLocalAsset = requestUrl.origin === self.location.origin &&
    ['script', 'style', 'font', 'image', 'manifest'].includes(event.request.destination);
  if (isCdnAsset || isLocalAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone()).catch(() => {});
          return response;
        } catch (error) {
          const fallback = await cache.match(event.request);
          if (fallback) return fallback;
          throw error;
        }
      })
    );
    return;
  }

  // เฉพาะ GET request ที่เป็นรูปจาก Supabase Storage เท่านั้น
  if (!url.includes(SUPABASE_STORAGE_MARKER)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. ลอง cache ก่อน
      const cached = await cache.match(event.request);
      if (cached) return cached;

      // 2. ถ้าไม่มีใน cache → โหลดจาก network
      try {
        const response = await fetch(event.request);
        // เก็บ cache เฉพาะ response ที่สำเร็จ
        if (response.ok && response.status === 200) {
          // clone ก่อนเก็บ เพราะ response ใช้ได้ครั้งเดียว
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        // 3. ถ้า network fail → ลองคืน cached version (ถ้ามี)
        const fallback = await cache.match(event.request);
        if (fallback) return fallback;
        throw err;
      }
    })
  );
});

// ── Message handler: ลบ cache เมื่อรูปถูกอัปเดต ─────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // ลบ cache รูปเดี่ยว (เมื่อแก้ไขสินค้า)
  if (event.data.type === 'INVALIDATE_IMAGE' && event.data.url) {
    caches.open(CACHE_NAME).then(cache => {
      cache.delete(event.data.url).catch(() => {});
    });
  }

  // ลบ cache ทั้งหมด (เมื่อ user ต้องการ refresh)
  if (event.data.type === 'CLEAR_IMAGE_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      caches.open(CACHE_NAME); // เปิด cache ใหม่
    });
  }
});
