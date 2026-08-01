/**
 * Pioneer Property Management System (PPMS)
 * Service Worker v2.0
 *
 * التحسينات:
 * - استراتيجية Cache-First للأصول المحلية
 * - Network-First لبيانات CDN
 * - تنظيف Cache قديم بشكل صحيح
 */

'use strict';

const CACHE_NAME = 'ppms-cache-v22';

const LOCAL_ASSETS = [
    './',
    'index.html',
    'styles.css',
    'db.js',
    'activation.js',
    'seed.js',
    'operations.js',
    'app.js',
    'manifest.json',
];

const CDN_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=IBM+Plex+Mono:wght@400;600&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
];

// ── Install ──
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                const requests = [...LOCAL_ASSETS, ...CDN_ASSETS].map(url => new Request(url, { cache: 'reload' }));
                return cache.addAll(requests);
            })
            .then(() => self.skipWaiting())
            .catch(err => console.warn('SW install cache error:', err))
    );
});

// ── Activate: حذف الـ caches القديمة ──
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ── Fetch ──
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = request.url;

    // لا نتدخل في PeerJS (WebRTC signaling)
    if (url.includes('peerjs') || url.includes('0.peerjs.com')) {
        return;
    }

    // Chrome extensions ونحوها
    if (!url.startsWith('http')) return;

    // استراتيجية للأصول المحلية: Cache-First
    const isLocal = LOCAL_ASSETS.some(a => url.includes(a.replace('./', '')));
    if (isLocal || url.includes(self.location.origin)) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    }
                    return response;
                }).catch(() => caches.match('index.html')); // fallback للـ SPA
            })
        );
        return;
    }

    // CDN: Stale-While-Revalidate
    event.respondWith(
        caches.open(CACHE_NAME).then(cache =>
            cache.match(request).then(cached => {
                const fetchPromise = fetch(request).then(response => {
                    if (response && response.status === 200 && response.type !== 'opaque') {
                        cache.put(request, response.clone());
                    }
                    return response;
                }).catch(() => null);

                return cached || fetchPromise;
            })
        )
    );
});