/* ISD Dental School — offline cache for both apps. Bump VERSION on every deploy. */
const VERSION = "isd-v1.0.3";
const FILES = [
  "./",
  "./portfolio/",
  "./photo/",
  "./assets/ISD_Case_Presentation_Template.pptx",
  "./assets/css/base.css",
  "./assets/fonts/nsa-hy-400.woff2",
  "./assets/fonts/nsa-hy-500.woff2",
  "./assets/fonts/nsa-hy-700.woff2",
  "./assets/fonts/nsa-lat-400.woff2",
  "./assets/fonts/nsa-lat-500.woff2",
  "./assets/fonts/nsa-lat-700.woff2",
  "./assets/fonts/nserif-hy-600.woff2",
  "./assets/fonts/nserif-hy-700.woff2",
  "./assets/fonts/nserif-lat-600.woff2",
  "./assets/fonts/nserif-lat-700.woff2",
  "./assets/icons/photo-180.png",
  "./assets/icons/photo-192.png",
  "./assets/icons/photo-512.png",
  "./assets/icons/portfolio-180.png",
  "./assets/icons/portfolio-192.png",
  "./assets/icons/portfolio-512.png",
  "./assets/js/casedeck.js",
  "./assets/js/config.js",
  "./assets/js/core.js",
  "./assets/js/protocols.js",
  "./assets/js/survey.js",
  "./assets/vendor/exifr.lite.umd.js",
  "./assets/vendor/jspdf.umd.min.js",
  "./assets/vendor/pptxgen.bundle.js",
  "./assets/vendor/qrcode.js",
  "./index.html",
  "./photo/app.js",
  "./photo/index.html",
  "./photo/manifest.webmanifest",
  "./portfolio/app.js",
  "./portfolio/index.html",
  "./portfolio/manifest.webmanifest"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (/^\/(live|gs)(\/|$)/.test(new URL(req.url).pathname)) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
