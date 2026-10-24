import { describe, it, expect, vi } from "vitest";
// @ts-ignore module JS du navigateur
import { createService } from "../web/translate.js";

const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; }, m }; };
const fakeChrome = (availability = "available") => ({ availability: vi.fn(async () => availability), create: vi.fn(async () => ({ translate: async (s: string) => `[chrome] ${s}` })) });
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: any; onerror: any; posted: any[] = []; terminated = false;
  constructor(public failLoad = false) { FakeWorker.made.push(this); }
  postMessage(msg: any) {
    this.posted.push(msg);
    queueMicrotask(() => {
      if (msg.type === "load") { this.onmessage({ data: { type: "progress", pct: 42 } }); this.onmessage({ data: this.failLoad ? { id: msg.id, type: "error", message: "boom" } : { id: msg.id, type: "ready" } }); }
      else this.onmessage({ data: { id: msg.id, type: "result", text: `[worker ${msg.text}]` } });
    });
  }
  terminate() { this.terminated = true; }
}
const withWorker = (opts: any = {}) => { FakeWorker.made = []; return createService({ storage: mem(), chrome: () => undefined, createWorker: () => new FakeWorker(opts.failLoad), ...opts }); };

describe("moteur de traduction", () => {
  it("préfère le traducteur du navigateur quand il est prêt", async () => {
    const chrome = fakeChrome(), s = createService({ storage: mem(), chrome: () => chrome, createWorker: () => { throw new Error("pas de worker"); } });
    expect(await s.engineInfo("fr", "en")).toEqual({ kind: "chrome", ready: true });
    await s.prepare("fr", "en");
    expect(await s.translate("Bonjour", "fr", "en")).toBe("[chrome] Bonjour");
    expect(chrome.create).toHaveBeenCalledWith(expect.objectContaining({ sourceLanguage: "fr", targetLanguage: "en" }));
  });
  it("ne déclenche pas un téléchargement du navigateur sans geste de l'utilisateur", async () => {
    const chrome = fakeChrome("downloadable"), s = createService({ storage: mem(), chrome: () => chrome, createWorker: () => new FakeWorker() });
    await expect(s.prepare("fr", "en", { interactive: false })).rejects.toThrow("model-consent");
    expect(chrome.create).not.toHaveBeenCalled();
    await s.prepare("fr", "en", { interactive: true });
    expect(chrome.create).toHaveBeenCalled();
  });
  it("sans traducteur intégré : exige l'accord, puis charge le modèle DANS UN WORKER, dans le bon sens", async () => {
    const s = withWorker(), progress: number[] = [];
    expect(await s.engineInfo("en", "fr")).toEqual({ kind: "model", ready: false });
    await expect(s.prepare("en", "fr")).rejects.toThrow("model-consent");
    expect(FakeWorker.made).toHaveLength(0);
    await s.prepare("en", "fr", { allowModel: true, onProgress: (p: number) => progress.push(p) });
    expect(FakeWorker.made[0].posted[0]).toMatchObject({ type: "load", from: "en", to: "fr" });
    expect(progress).toEqual([42]);
    expect(await s.translate("Hello", "en", "fr")).toBe("[worker Hello]");
  });
  it("deux préparations simultanées partagent un seul chargement (jamais deux modèles en mémoire)", async () => {
    const s = withWorker();
    await Promise.all([1, 2, 3].map(() => s.prepare("fr", "en", { allowModel: true })));
    expect(FakeWorker.made).toHaveLength(1);
    expect(s.isReady("fr", "en")).toBe(true);
  });
  it("échec du chargement : worker arrêté, erreur claire, nouvel essai possible", async () => {
    const s = withWorker({ failLoad: true });
    await expect(s.prepare("fr", "en", { allowModel: true })).rejects.toThrow("boom");
    expect(FakeWorker.made[0].terminated).toBe(true);
    expect(s.isReady("fr", "en")).toBe(false);
    await expect(s.prepare("fr", "en", { allowModel: true })).rejects.toThrow("boom");
    expect(FakeWorker.made).toHaveLength(2);
  });
  it("retombe sur le modèle si le traducteur intégré échoue ; signale l'absence de moteur", async () => {
    const bad = { availability: async () => "available", create: async () => { throw new Error("boom"); } };
    const s = createService({ storage: mem(), chrome: () => bad, createWorker: () => new FakeWorker() });
    await s.prepare("fr", "en", { allowModel: true });
    expect(await s.translate("Salut", "fr", "en")).toBe("[worker Salut]");
    const s1 = createService({ storage: mem(), chrome: () => undefined, hasWasm: () => false });
    expect((await s1.engineInfo("fr", "en")).kind).toBe("none");
    await expect(s1.prepare("fr", "en", { allowModel: true })).rejects.toThrow("no-engine");
    const s2 = createService({ storage: mem(), chrome: () => undefined, createWorker: () => { throw new Error("pas de worker"); } });
    await expect(s2.prepare("fr", "en", { allowModel: true })).rejects.toThrow("no-engine");
  });
  it("release() arrête le worker et libère la mémoire", async () => {
    const s = withWorker(); await s.prepare("fr", "en", { allowModel: true });
    s.release();
    expect(FakeWorker.made[0].terminated).toBe(true);
    expect(s.isReady("fr", "en")).toBe(false);
  });
  it("laisse le texte intact si la langue est la même, et refuse si le moteur n'est pas prêt", async () => {
    const s = createService({ storage: mem(), chrome: () => undefined });
    expect(await s.translate("Same", "en", "en")).toBe("Same");
    await expect(s.translate("Texte", "fr", "en")).rejects.toThrow("not-ready");
  });
});
describe("file d'attente et cache", () => {
  it("traduit un article (titre + résumé), le ressert depuis le cache sans moteur, et sait vider le cache", async () => {
    const st = mem(), s = createService({ storage: st, chrome: () => fakeChrome() });
    await s.prepare("fr", "en");
    const out = await s.translateArticle("k1", { title: "Titre", summary: "Résumé" }, "fr", "en");
    expect(out).toEqual({ title: "[chrome] Titre", summary: "[chrome] Résumé" });
    const s2 = createService({ storage: st, chrome: () => undefined });
    expect(s2.cached("k1", "en")).toEqual(out);
    expect(s2.cached("k1", "fr")).toBeNull();
    s2.clearCache();
    expect(s2.cached("k1", "en")).toBeNull();
    expect(JSON.parse(st.m["techinfo:tr:v1"])).toEqual({});
  });
  it("traite les demandes une par une, dans l'ordre, et une erreur ne bloque pas la suite", async () => {
    const order: string[] = []; let active = 0, maxActive = 0;
    const chrome = { availability: async () => "available", create: async () => ({ translate: async (s: string) => { active++; maxActive = Math.max(maxActive, active); await new Promise((r) => setTimeout(r, 5)); active--; if (s === "mauvais") throw new Error("x"); order.push(s); return s.toUpperCase(); } }) };
    const s = createService({ storage: mem(), chrome: () => chrome });
    await s.prepare("fr", "en");
    const res = await Promise.allSettled(["a", "mauvais", "b", "c"].map((x) => s.translate(x, "fr", "en")));
    expect(res.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled", "fulfilled"]);
    expect(order).toEqual(["a", "b", "c"]);
    expect(maxActive).toBe(1);
  });
  it("borne la taille du cache", async () => {
    const st = mem(), s = createService({ storage: st, chrome: () => fakeChrome() });
    await s.prepare("fr", "en");
    for (let i = 0; i < 650; i++) await s.translateArticle(`id${i}`, { title: "t" }, "fr", "en");
    const stored = JSON.parse(st.m["techinfo:tr:v1"]);
    expect(Object.keys(stored).length).toBe(600);
    expect(stored["en|id0"]).toBeUndefined();
    expect(stored["en|id649"]).toBeDefined();
  });
});
