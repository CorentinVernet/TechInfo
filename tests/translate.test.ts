import { describe, it, expect, vi } from "vitest";
// @ts-ignore module JS du navigateur
import { createService } from "../web/translate.js";

const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; }, m }; };
const fakeChrome = (availability = "available") => ({ availability: vi.fn(async () => availability), create: vi.fn(async () => ({ translate: async (s: string) => `[chrome] ${s}` })) });
const fakeTf = () => ({ pipeline: vi.fn(async (_task: string, model: string) => async (s: string) => [{ translation_text: `[${model}] ${s}` }]) });

describe("moteur de traduction", () => {
  it("préfère le traducteur du navigateur quand il est prêt", async () => {
    const chrome = fakeChrome(), tf = fakeTf();
    const s = createService({ storage: mem(), chrome: () => chrome, loadTransformers: async () => tf });
    expect(await s.engineInfo("fr", "en")).toEqual({ kind: "chrome", ready: true });
    await s.prepare("fr", "en");
    expect(await s.translate("Bonjour", "fr", "en")).toBe("[chrome] Bonjour");
    expect(tf.pipeline).not.toHaveBeenCalled();
    expect(chrome.create).toHaveBeenCalledWith(expect.objectContaining({ sourceLanguage: "fr", targetLanguage: "en" }));
  });
  it("ne déclenche pas un téléchargement du navigateur sans geste de l'utilisateur", async () => {
    const chrome = fakeChrome("downloadable");
    const s = createService({ storage: mem(), chrome: () => chrome, loadTransformers: async () => fakeTf() });
    await expect(s.prepare("fr", "en", { interactive: false })).rejects.toThrow("model-consent");
    expect(chrome.create).not.toHaveBeenCalled();
    await s.prepare("fr", "en", { interactive: true });
    expect(chrome.create).toHaveBeenCalled();
  });
  it("sans traducteur intégré : exige l'accord avant de télécharger le modèle, puis utilise le bon sens de traduction", async () => {
    const tf = fakeTf();
    const s = createService({ storage: mem(), chrome: () => undefined, loadTransformers: async () => tf });
    expect(await s.engineInfo("en", "fr")).toEqual({ kind: "model", ready: false });
    await expect(s.prepare("en", "fr")).rejects.toThrow("model-consent");
    expect(tf.pipeline).not.toHaveBeenCalled();
    await s.prepare("en", "fr", { allowModel: true });
    expect(tf.pipeline).toHaveBeenCalledWith("translation", "Xenova/opus-mt-en-fr", expect.anything());
    expect(await s.translate("Hello", "en", "fr")).toBe("[Xenova/opus-mt-en-fr] Hello");
  });
  it("retombe sur le modèle si le traducteur intégré échoue", async () => {
    const chrome = { availability: async () => "available", create: async () => { throw new Error("boom"); } };
    const s = createService({ storage: mem(), chrome: () => chrome, loadTransformers: async () => fakeTf() });
    await s.prepare("fr", "en", { allowModel: true });
    expect(await s.translate("Salut", "fr", "en")).toContain("opus-mt-fr-en");
  });
  it("signale l'absence de moteur (pas de WebAssembly, ou téléchargement impossible)", async () => {
    const s1 = createService({ storage: mem(), chrome: () => undefined, hasWasm: () => false });
    expect((await s1.engineInfo("fr", "en")).kind).toBe("none");
    await expect(s1.prepare("fr", "en", { allowModel: true })).rejects.toThrow("no-engine");
    const s2 = createService({ storage: mem(), chrome: () => undefined, loadTransformers: async () => { throw new Error("réseau"); } });
    await expect(s2.prepare("fr", "en", { allowModel: true })).rejects.toThrow("no-engine");
  });
  it("laisse le texte intact si la langue est la même, et refuse si le moteur n'est pas prêt", async () => {
    const s = createService({ storage: mem(), chrome: () => undefined });
    expect(await s.translate("Same", "en", "en")).toBe("Same");
    await expect(s.translate("Texte", "fr", "en")).rejects.toThrow("not-ready");
  });
});
describe("file d'attente et cache", () => {
  it("traduit un article (titre + résumé) puis le resert depuis le cache sans moteur", async () => {
    const st = mem(), chrome = fakeChrome();
    const s = createService({ storage: st, chrome: () => chrome });
    await s.prepare("fr", "en");
    const out = await s.translateArticle("k1", { title: "Titre", summary: "Résumé" }, "fr", "en");
    expect(out).toEqual({ title: "[chrome] Titre", summary: "[chrome] Résumé" });
    const s2 = createService({ storage: st, chrome: () => undefined }); // nouvelle page, aucun moteur
    expect(s2.cached("k1", "en")).toEqual(out);
    expect(await s2.translateArticle("k1", { title: "Titre" }, "fr", "en")).toEqual(out);
    expect(s2.cached("k1", "fr")).toBeNull();
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
    const st = mem(), chrome = fakeChrome();
    const s = createService({ storage: st, chrome: () => chrome });
    await s.prepare("fr", "en");
    for (let i = 0; i < 650; i++) await s.translateArticle(`id${i}`, { title: "t" }, "fr", "en");
    const stored = JSON.parse(st.m["techinfo:tr:v1"]);
    expect(Object.keys(stored).length).toBe(600);
    expect(stored["en|id0"]).toBeUndefined();
    expect(stored["en|id649"]).toBeDefined();
  });
});
