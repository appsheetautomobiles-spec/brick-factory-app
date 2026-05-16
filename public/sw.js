const CACHE = 'ittige-factory-v1';
const PRECACHE = ['/', '/dashboard', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests for same-origin or Supabase API
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Never cache Supabase API calls
  if (url.hostname.includes('supabase.co')) return;

  // Network-first for navigation (always fresh page shell)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
