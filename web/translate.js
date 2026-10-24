// Traduction française <-> anglaise entièrement dans le navigateur, sans serveur ni clé :
//  1. le traducteur intégré du navigateur (Chrome/Edge sur ordinateur) s'il est disponible ;
//  2. sinon un petit modèle de traduction (Marian « opus-mt ») exécuté par transformers.js, téléchargé une fois puis gardé en cache.
export const TF_VERSION = "3.8.1";
export const TF_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TF_VERSION}/dist/transformers.min.js`;
export const MODEL_MB = 110; // modèle quantifié : environ 50 Mo (encodeur) + 57 Mo (décodeur)
const CACHE_KEY = "techinfo:tr:v1", CACHE_MAX = 600;

export function createService({ storage = globalThis.localStorage, chrome = () => globalThis.Translator, loadTransformers = () => import(TF_URL), hasWasm = () => typeof WebAssembly !== "undefined" } = {}) {
  const engines = new Map();
  let chain = Promise.resolve();
  let cache = {};
  try { cache = JSON.parse(storage?.getItem(CACHE_KEY) || "{}"); } catch { cache = {}; }
  const pair = (from, to) => `${from}>${to}`;
  const ck = (id, to) => `${to}|${id}`;
  const persist = () => {
    const keys = Object.keys(cache);
    if (keys.length > CACHE_MAX) for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete cache[k];
    try { storage?.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* stockage plein ou indisponible */ }
  };
  const queue = (fn) => { const run = chain.then(fn); chain = run.catch(() => {}); return run; };

  return {
    cached: (id, to) => cache[ck(id, to)] ?? null,
    isReady: (from, to) => engines.has(pair(from, to)),
    /** Quel moteur serait utilisé, et faut-il télécharger quelque chose ? */
    async engineInfo(from, to) {
      const e = engines.get(pair(from, to));
      if (e) return { kind: e.kind, ready: true };
      const T = chrome();
      if (T) { try { const av = await T.availability({ sourceLanguage: from, targetLanguage: to }); if (av !== "unavailable") return { kind: "chrome", ready: av === "available" }; } catch { /* on tente le modèle */ } }
      return hasWasm() ? { kind: "model", ready: false } : { kind: "none", ready: false };
    },
    /** À appeler depuis un geste de l'utilisateur la première fois. Lève « model-consent » ou « no-engine ». */
    async prepare(from, to, { allowModel = false, interactive = false, onProgress } = {}) {
      const k = pair(from, to);
      if (engines.has(k)) return;
      const T = chrome();
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
      let tf;
      try { tf = await loadTransformers(); } catch { throw new Error("no-engine"); }
      const pipe = await tf.pipeline("translation", `Xenova/opus-mt-${from}-${to}`, { progress_callback: (p) => { if (p?.status === "progress" && typeof p.progress === "number") onProgress?.(p.progress); } });
      engines.set(k, { kind: "model", run: async (s) => (await pipe(s, { num_beams: 1, do_sample: false }))[0].translation_text });
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
