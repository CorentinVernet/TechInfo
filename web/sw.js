// Service worker minimal : permet l'installation et un affichage hors ligne des dernières données connues.
// Stratégie « réseau d'abord » : en ligne on a toujours la dernière version ; hors ligne, la dernière copie gardée.
// Exception : les logos des sources (nom de fichier unique selon leur contenu) viennent du cache s'ils y sont, sans recharger.
const CACHE = "techinfo-v1";
const LOGOS = "techinfo-logos-v1";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./api.js", "./i18n.js", "./glossary.js", "./insights.js", "./translate.js", "./translate-worker.js", "./constants.js", "./manifest.webmanifest", "./icons/icon-192.png", "./favicon.ico"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== LOGOS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // jsDelivr / Hugging Face / images des articles : gérés par le navigateur
  if (url.pathname.includes("/data/logos/")) {
    e.respondWith(caches.open(LOGOS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
