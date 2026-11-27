/* دبلوم اللغة الإنجليزية - Service Worker (المرحلة 2)
   - يفتح التطبيق ودروسه دون إنترنت بعد أول زيارة
   - ملفات التطبيق: من الذاكرة فوراً ثم تُحدَّث في الخلفية
   - supabase-config.js: الشبكة أولاً (حتى لا يبقى إعداد قديم) ثم النسخة المحفوظة
   - خطوط Google تُحفظ لتبقى الواجهة بنفس شكلها دون إنترنت
   - التحديث الجديد ينتظر موافقة المستخدم (زر «تحديث») حتى لا يُقطع درس جارٍ */
const VERSION = 'v15';
const CACHE_NAME = 'english-diploma-' + VERSION;
const FONT_CACHE = 'english-diploma-fonts';
const SCOPE = self.registration.scope;
const INDEX = new URL('./index.html', SCOPE).href;
const CRITICAL = ['./', './index.html'];
const OPTIONAL = [
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icon.svg',
  './cover.png',
  './logo.png',
  './supabase-config.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    /* الأساسي يجب أن ينجح، والباقي لا يُفشل التثبيت إن غاب ملف (مثل supabase-config.js) */
    await cache.addAll(CRITICAL);
    await Promise.allSettled(OPTIONAL.map((u) => cache.add(u)));
    /* أول تثبيت: نفعّله فوراً. تحديث لاحق: ينتظر زر «تحديث» في التطبيق */
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith('english-diploma-') && n !== CACHE_NAME && n !== FONT_CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function timeout(ms) { return new Promise((r) => setTimeout(() => r(null), ms)); }

async function appFile(event) {
  const req = event.request;
  const cache = await caches.open(CACHE_NAME);
  const u = new URL(req.url);
  u.search = '';
  const isDoc = req.mode === 'navigate' || u.href === SCOPE || u.href === INDEX;   /* الجذر وindex.html مستند واحد */
  const isNav = req.mode === 'navigate';
  let hit = isDoc ? await cache.match(INDEX) : null;
  if (!hit) hit = await cache.match(req, { ignoreSearch: true });
  const update = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      cache.put(isDoc ? INDEX : req, copy);
    }
    return res;
  }).catch(() => null);
  if (hit) { event.waitUntil(update); return hit; }
  const res = await update;
  if (res) return res;
  if (isNav) {
    const fallback = await cache.match(INDEX);
    if (fallback) return fallback;
  }
  return Response.error();
}

async function configFile(event) {
  const req = event.request;
  const cache = await caches.open(CACHE_NAME);
  const net = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  const res = await Promise.race([net, timeout(3000)]);
  if (res && res.ok) return res;
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  return (await net) || Response.error();
}

async function fontFile(event) {
  const req = event.request;
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  const update = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) { event.waitUntil(update); return hit; }
  return (await update) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/supabase-config.js')) { event.respondWith(configFile(event)); return; }
    event.respondWith(appFile(event));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fontFile(event));
  }
  /* بقية الطلبات الخارجية (Supabase وغيرها) لا يتدخل فيها الـ Service Worker */
});
