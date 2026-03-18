// CHANGE THIS VERSION NUMBER every time you update your CSS, HTML, or JS!
const CACHE_NAME = "guitar-v21"; 
const ASSETS = ["/", "/index.html", "/style.css", "/app.js", "/manifest.json"];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    // Forces the waiting service worker to become the active service worker
    self.skipWaiting(); 
});

// NEW: This event cleans up old, outdated caches
self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log("Service Worker: Clearing Old Cache");
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    // Ensure the updated service worker takes control immediately
    self.clients.claim(); 
});

self.addEventListener("fetch", (e) => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});