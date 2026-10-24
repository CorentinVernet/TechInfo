import { describe, it, expect, vi } from "vitest";
// @ts-ignore module JS du navigateur
import { createHandler } from "../web/translate-worker.js";

function setup(over: any = {}) {
  const posted: any[] = [];
  const pipe = vi.fn(async (s: string) => [{ translation_text: `<${s}>` }]);
  const tf = { env: { backends: { onnx: { wasm: {} as any } } }, pipeline: vi.fn(async (_t: string, _m: string, opts: any) => { for (const loaded of [20e6, 60e6, 400e6]) opts.progress_callback({ status: "progress", file: "x.onnx", loaded, total: 1e9 }); return pipe; }), ...over };
  let t = 0;
  const handle = createHandler({ loadTf: async () => tf, post: (m: any) => posted.push(m), now: () => (t += 300) });
  return { handle, posted, tf, pipe };
}
describe("worker de traduction", () => {
  it("charge le bon modèle quantifié en WASM, mono-thread, et signale la progression sans dépasser 99 %", async () => {
    const { handle, posted, tf } = setup();
    await handle({ id: 1, type: "load", from: "fr", to: "en" });
    expect(tf.pipeline).toHaveBeenCalledWith("translation", "Xenova/opus-mt-fr-en", expect.objectContaining({ dtype: "q8", device: "wasm" }));
    expect(tf.env.backends.onnx.wasm.numThreads).toBe(1);
    const pcts = posted.filter((m) => m.type === "progress").map((m) => m.pct);
    expect(pcts.length).toBeGreaterThan(0);
    expect(Math.max(...pcts)).toBeLessThanOrEqual(99);
    expect(posted.at(-1)).toEqual({ id: 1, type: "ready" });
  });
  it("traduit et renvoie le résultat avec le même identifiant", async () => {
    const { handle, posted, pipe } = setup();
    await handle({ id: 1, type: "load", from: "en", to: "fr" });
    await handle({ id: 2, type: "translate", text: "Hello" });
    expect(pipe).toHaveBeenCalledWith("Hello", expect.objectContaining({ num_beams: 1 }));
    expect(posted.at(-1)).toEqual({ id: 2, type: "result", text: "<Hello>" });
  });
  it("renvoie une erreur (sans planter) si le chargement ou la traduction échoue", async () => {
    const a = setup({ pipeline: async () => { throw new Error("réseau"); } });
    await a.handle({ id: 1, type: "load", from: "fr", to: "en" });
    expect(a.posted.at(-1)).toEqual({ id: 1, type: "error", message: "réseau" });
    const b = setup();
    await b.handle({ id: 5, type: "translate", text: "x" }); // avant « load »
    expect(b.posted.at(-1)).toMatchObject({ id: 5, type: "error" });
  });
});
