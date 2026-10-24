// Service worker minimal : permet l'installation et un affichage hors ligne des dernières données connues.
// Stratégie « réseau d'abord » : en ligne on a toujours la dernière version ; hors ligne, la dernière copie gardée.
const CACHE = "techinfo-v1";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./api.js", "./i18n.js", "./translate.js", "./manifest.webmanifest", "./icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return; // jsDelivr / Hugging Face : gérés par le navigateur
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
