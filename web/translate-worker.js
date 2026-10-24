// Exécute le modèle de traduction dans un Web Worker : l'interface ne se fige plus pendant le chargement ni la traduction.
import { TF_URL, MODEL_MB } from "./constants.js";

export function createHandler({ loadTf, post, now = Date.now }) {
  let pipe = null;
  return async function handle(msg) {
    try {
      if (msg.type === "load") {
        const tf = await loadTf();
        try { tf.env.backends.onnx.wasm.numThreads = 1; } catch { /* réglage facultatif */ }
        const loaded = new Map(); let last = 0;
        pipe = await tf.pipeline("translation", `Xenova/opus-mt-${msg.from}-${msg.to}`, {
          dtype: "q8", device: "wasm",
          progress_callback: (p) => {
            if (p?.status !== "progress" || !p.file || typeof p.loaded !== "number") return;
            loaded.set(p.file, p.loaded);
            const t = now(); if (t - last < 250) return; last = t;
            let sum = 0; for (const v of loaded.values()) sum += v;
            post({ type: "progress", pct: Math.min(99, (sum / (MODEL_MB * 1048576)) * 100) });
          },
        });
        post({ id: msg.id, type: "ready" });
      } else if (msg.type === "translate") {
        const out = await pipe(msg.text, { num_beams: 1, do_sample: false });
        post({ id: msg.id, type: "result", text: out[0].translation_text });
      }
    } catch (e) { post({ id: msg.id, type: "error", message: String(e?.message ?? e) }); }
  };
}
if (typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope) {
  const handle = createHandler({ loadTf: () => import(TF_URL), post: (m) => self.postMessage(m) });
  self.onmessage = (e) => { handle(e.data); };
}
