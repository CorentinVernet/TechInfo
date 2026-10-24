// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const art = (n: number, lang: string, over: any = {}) => ({ key: `0a${n}`, id: n, title: lang === "fr" ? `Titre français ${n}` : `English title ${n}`, url: `https://x.example/${n}`, source_id: 1, category: "dev", lang, official: 0, published_at: new Date(Date.now() - n * 3600e3).toISOString(), updated_at: null, collected_at: new Date().toISOString(), sort_ts: new Date(Date.now() - n * 3600e3).toISOString(), summary: "", summary_limited: 0, importance: "important", score: 70, reasons: ["source officielle", "mot-clé : patch"], cvss: null, cvss_source: null, links: [], ...over });
const arts = [art(1, "fr"), art(2, "en"), art(3, "fr")];
const DATA = { version: 1, generated_at: new Date().toISOString(), config: { prefBonus: 10 }, sources: [{ id: 1, name: "Source" }], articles: arts,
  article_sources: arts.map((a) => ({ article_id: a.id, source_id: 1, url: a.url, published_at: a.published_at })),
  briefing: { day: "2026-10-22", generated_at: "x", summary: "3 actualités sur 24 h, dont 0 critique(s) et 3 importante(s). Sélection automatique par règles, sans IA.", topics: [], ids: [1, 2, 3] },
  status: { status: "ok", sources_ok: 1, sources_total: 1, added: 3, errors: [] } };

const svc = { cached: vi.fn(() => null), isReady: vi.fn(() => false), engineInfo: vi.fn(async () => ({ kind: "chrome", ready: true })), prepare: vi.fn(async () => {}), translateArticle: vi.fn(async (_id: string, { title }: any, from: string, to: string) => ({ title: `[${from}→${to}] ${title}` })) };
vi.mock("../web/translate.js", () => ({ service: svc, MODEL_MB: 110 }));

const html = readFileSync("web/index.html", "utf8");
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const cards = () => [...document.querySelectorAll("#list article")] as HTMLElement[];
const click = (n: Element | null) => (n as HTMLElement).click();
const tick = () => vi.waitFor(() => { expect($("#status").textContent).not.toBe("Chargement…"); expect($("#status").textContent).not.toBe("Loading…"); });
async function boot(settings: any = {}) {
  vi.resetModules();
  document.documentElement.innerHTML = html.replace(/<script[^>]*><\/script>/, "");
  localStorage.clear(); localStorage.setItem("techinfo:settings:v1", JSON.stringify(settings));
  (HTMLDialogElement.prototype as any).showModal = function () { this.setAttribute("open", ""); };
  (HTMLDialogElement.prototype as any).close = function () { this.removeAttribute("open"); };
  (Element.prototype as any).scrollIntoView = () => {};
  window.scrollTo = (() => {}) as any;
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => DATA }));
  // @ts-ignore module JS du navigateur
  await import("../web/app.js");
  await vi.waitFor(() => expect(cards().length).toBeGreaterThan(0));
}
beforeEach(() => { Object.values(svc).forEach((f: any) => f.mockClear?.()); svc.cached.mockImplementation(() => null); svc.isReady.mockImplementation(() => false); });

describe("installation comme application (jsdom)", () => {
  const openSettingsPanel = () => click($("#langBtn"));
  it("affiche « Installer » quand le navigateur le propose, et lance l'installation au clic", async () => {
    await boot({ lang: "fr" });
    const prompt = vi.fn(async () => {}), ev = new Event("beforeinstallprompt", { cancelable: true }) as any;
    ev.prompt = prompt; window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    openSettingsPanel();
    const btn = [...document.querySelectorAll("#settings button")].find((b) => b.textContent!.includes("Installer l'application"))!;
    expect(btn).toBeTruthy();
    click(btn);
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  });
  it("n'affiche rien si le navigateur ne propose pas l'installation, ni si l'appli est déjà installée", async () => {
    await boot({ lang: "en" });
    openSettingsPanel();
    expect(document.querySelector("#settings")!.textContent).not.toContain("Install the app");
    await boot({ lang: "en" });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const ev = new Event("beforeinstallprompt", { cancelable: true }) as any; ev.prompt = vi.fn(); window.dispatchEvent(ev);
    openSettingsPanel();
    expect(document.querySelector("#settings")!.textContent).not.toContain("Install the app");
    vi.unstubAllGlobals();
  });
  it("explique la marche à suivre sur iPhone (pas d'installation par bouton)", async () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", languages: ["fr-FR"] });
    await boot({ lang: "fr" });
    openSettingsPanel();
    expect(document.querySelector("#settings")!.textContent).toContain("Sur l'écran d'accueil");
    vi.unstubAllGlobals();
  });
});

describe("interface (jsdom)", () => {
  it("s'affiche en français quand la langue est français, avec le briefing localisé", async () => {
    await boot({ lang: "fr" });
    expect(document.documentElement.lang).toBe("fr");
    expect($("#status").textContent).toContain("3 actualités sur 24 h");
    expect(document.body.textContent).toContain("Lire la source");
    expect($("#tabbar").textContent).toContain("Actualités");
  });
  it("passe en anglais à la volée : interface, catégories, briefing", async () => {
    await boot({ lang: "fr" });
    click($("#langBtn"));
    click(document.querySelector("#settings input[value=en]"));
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("en"));
    await tick();
    expect($("#tabbar").textContent).toContain("News");
    expect($("#status").textContent).toContain("3 stories in 24 h");
    expect(document.body.textContent).toContain("Read the source");
    expect(document.body.textContent).toContain("Development");
    expect(JSON.parse(localStorage.getItem("techinfo:settings:v1")!).lang).toBe("en");
  });
  it("propose « Traduire » seulement pour les articles d'une autre langue, et le lien reste celui de la source", async () => {
    await boot({ lang: "en" });
    const withBtn = cards().filter((c) => { const b = c.querySelectorAll(".actions button")[0] as HTMLElement; return !b.hidden; });
    expect(withBtn.map((c) => c.querySelector("h2")!.textContent)).toEqual(["Titre français 1", "Titre français 3"]);
    expect(cards()[0].querySelector("a.primary")!.getAttribute("href")).toBe("https://x.example/1");
  });
  it("traduit un article FR→EN au clic, puis revient à l'original ; et inversement EN→FR", async () => {
    await boot({ lang: "en" });
    const c = cards()[0], btn = c.querySelectorAll(".actions button")[0] as HTMLElement;
    click(btn);
    await vi.waitFor(() => expect(c.querySelector("h2")!.textContent).toBe("[fr→en] Titre français 1"));
    expect(svc.prepare).toHaveBeenCalledWith("fr", "en", expect.objectContaining({ interactive: true }));
    expect(c.querySelector(".tr-badge")!.hasAttribute("hidden")).toBe(false);
    expect(btn.textContent).toBe("Show original");
    click(btn);
    await vi.waitFor(() => expect(c.querySelector("h2")!.textContent).toBe("Titre français 1"));
    expect(c.querySelector("a.primary")!.getAttribute("href")).toBe("https://x.example/1");
    // inversement
    await boot({ lang: "fr" });
    const en = cards().find((x) => x.textContent!.includes("English title 2"))!;
    click(en.querySelectorAll(".actions button")[0]);
    await vi.waitFor(() => expect(en.querySelector("h2")!.textContent).toBe("[en→fr] English title 2"));
  });
  it("traduit tout seul en mode automatique, sans demander de geste", async () => {
    await boot({ lang: "en", auto: true, modelOk: true });
    await vi.waitFor(() => expect(cards()[0].querySelector("h2")!.textContent).toBe("[fr→en] Titre français 1"));
    expect(cards()[1].querySelector("h2")!.textContent).toBe("English title 2");
    expect(svc.prepare).toHaveBeenCalledWith("fr", "en", expect.objectContaining({ interactive: false, allowModel: true }));
  });
  it("filtre par langue d'origine depuis les réglages", async () => {
    await boot({ lang: "en", show: "fr" });
    expect(cards().map((c) => c.getAttribute("lang"))).toEqual(["fr", "fr"]);
  });
  it("affiche une erreur claire si la traduction échoue", async () => {
    svc.translateArticle.mockRejectedValueOnce(new Error("x"));
    await boot({ lang: "en" });
    click(cards()[0].querySelectorAll(".actions button")[0]);
    await vi.waitFor(() => expect($("#status").textContent).toContain("Translation failed"));
    expect(cards()[0].querySelector("h2")!.textContent).toBe("Titre français 1");
  });
});
