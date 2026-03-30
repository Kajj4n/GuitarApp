const CACHE_NAME = "guitar-v57"; 

const ASSETS = [
    "./",
    "./index.html",
    "./css/app.css",
    "./css/tune.css",
    "./manifest.json",
    "./guitartunings.json",

    "./js/App.js",
    "./js/AudioEngine.js",
    "./js/UIComponent.js",
    "./js/NavBtn.js",
    "./js/GuitarSection.js",
    "./js/MeterCanvas.js",
    "./js/OverlayPage.js",

    "./images/note.png",
    "./images/guitarhead.png",

    "./audio/A2.mp3", "./audio/A3.mp3", "./audio/Ab3.mp3",
    "./audio/B1.mp3", "./audio/B2.mp3", "./audio/B3.mp3",
    "./audio/C2.mp3", "./audio/C3.mp3", "./audio/D2.mp3", 
    "./audio/D3.mp3", "./audio/D4.mp3", "./audio/Db4.mp3",
    "./audio/E2.mp3", "./audio/E3.mp3", "./audio/E4.mp3",
    "./audio/F3.mp3", "./audio/G2.mp3", "./audio/G3.mp3",
    "./audio/Gb2.mp3", "./audio/Gb3.mp3"
];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting(); 
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim(); 
});

self.addEventListener("fetch", (e) => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});