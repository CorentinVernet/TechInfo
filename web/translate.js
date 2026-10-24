// Traduction français <-> anglais dans le navigateur, sans serveur ni clé :
//  1. le traducteur intégré du navigateur (Chrome/Edge sur ordinateur) s'il est disponible ;
//  2. sinon un petit modèle de traduction exécuté dans un Web Worker (transformers.js), téléchargé une fois puis mis en cache.
export { TF_VERSION, TF_URL, MODEL_MB } from "./constants.js";
const CACHE_KEY = "techinfo:tr:v1", CACHE_MAX = 600;

export function createService({
  storage = globalThis.localStorage,
  chrome = () => globalThis.Translator,
  createWorker = () => new Worker(new URL("./translate-worker.js", import.meta.url), { type: "module" }),
  hasWasm = () => typeof WebAssembly !== "undefined",
} = {}) {
  const engines = new Map(), preparing = new Map();
  let chain = Promise.resolve(), cache = {};
  try { cache = JSON.parse(storage?.getItem(CACHE_KEY) || "{}"); } catch { cache = {}; }
  const pair = (from, to) => `${from}>${to}`;
  const ck = (id, to) => `${to}|${id}`;
  const persist = () => {
    const keys = Object.keys(cache);
    if (keys.length > CACHE_MAX) for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete cache[k];
    try { storage?.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* stockage plein ou indisponible */ }
  };
  const queue = (fn) => { const run = chain.then(fn); chain = run.catch(() => {}); return run; };

  function startWorker(from, to, onProgress) {
    let w;
    try { w = createWorker(); } catch { return Promise.reject(new Error("no-engine")); }
    let seq = 0; const pending = new Map();
    const fail = (err) => { for (const p of pending.values()) p.reject(err); pending.clear(); };
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") return onProgress?.(m.pct);
      const p = pending.get(m.id); if (!p) return;
      pending.delete(m.id);
      m.type === "error" ? p.reject(new Error(m.message)) : p.resolve(m.text);
    };
    w.onerror = () => fail(new Error("worker"));
    const call = (msg) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); w.postMessage({ id, ...msg }); });
    return call({ type: "load", from, to }).then(() => ({ kind: "model", run: (s) => call({ type: "translate", text: s }), stop: () => w.terminate() }), (e) => { w.terminate(); throw new Error(e.message === "worker" ? "no-engine" : e.message); });
  }

  async function doPrepare(from, to, { allowModel, interactive, onProgress }) {
    const k = pair(from, to), T = chrome();
    if (T) {
      try {
        const av = await T.availability({ sourceLanguage: from, targetLanguage: to });
        if (av === "available" || (interactive && (av === "downloadable" || av === "downloading"))) {
          const tr = await T.create({ sourceLanguage: from, targetLanguage: to, monitor: (m) => m.addEventListener("downloadprogress", (e) => onProgress?.(e.loaded * 100)) });
          engines.set(k, { kind: "chrome", run: (s) => tr.translate(s) });
          return;
        }
      } catch { /* repli sur le modèle */ }
    }
    if (!hasWasm()) throw new Error("no-engine");
    if (!allowModel) throw new Error("model-consent");
    engines.set(k, await startWorker(from, to, onProgress));
  }

  return {
    cached: (id, to) => cache[ck(id, to)] ?? null,
    isReady: (from, to) => engines.has(pair(from, to)),
    clearCache() { cache = {}; persist(); },
    /** Libère la mémoire du modèle (arrête le worker). */
    release() { for (const e of engines.values()) e.stop?.(); engines.clear(); },
    async engineInfo(from, to) {
      const e = engines.get(pair(from, to));
      if (e) return { kind: e.kind, ready: true };
      const T = chrome();
      if (T) { try { const av = await T.availability({ sourceLanguage: from, targetLanguage: to }); if (av !== "unavailable") return { kind: "chrome", ready: av === "available" }; } catch { /* on tente le modèle */ } }
      return hasWasm() ? { kind: "model", ready: false } : { kind: "none", ready: false };
    },
    /** Une seule préparation à la fois par sens de traduction : deux appels simultanés partagent la même (évite de charger le modèle deux fois). */
    prepare(from, to, opts = {}) {
      const k = pair(from, to);
      if (engines.has(k)) return Promise.resolve();
      if (!preparing.has(k)) preparing.set(k, doPrepare(from, to, opts).finally(() => preparing.delete(k)));
      return preparing.get(k);
    },
    translate(text, from, to) {
      if (!text || from === to) return Promise.resolve(text);
      const e = engines.get(pair(from, to));
      if (!e) return Promise.reject(new Error("not-ready"));
      return queue(() => e.run(text));
    },
    async translateArticle(id, { title, summary }, from, to) {
      const hit = cache[ck(id, to)];
      if (hit) return hit;
      const out = { title: await this.translate(title, from, to) };
      if (summary) out.summary = await this.translate(summary, from, to);
      cache[ck(id, to)] = out; persist();
      return out;
    },
  };
}
export const service = createService();
