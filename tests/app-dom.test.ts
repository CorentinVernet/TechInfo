// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const mk = (n: number, lang: string, over: any = {}) => ({ key: `0a${n}`, id: n, title: lang === "fr" ? `Titre français ${n}` : `English title ${n}`, url: `https://x.example/${n}`, source_id: lang === "fr" ? 1 : 2, category: "dev", lang, official: 0, published_at: new Date(Date.now() - n * 3600e3).toISOString(), updated_at: null, collected_at: new Date().toISOString(), sort_ts: new Date(Date.now() - n * 3600e3).toISOString(), summary: `Résumé numéro ${n}. Une deuxième phrase.`, summary_limited: 0, importance: "important", score: 70, reasons: ["source officielle", "mot-clé : patch"], cvss: null, cvss_source: null, links: [], ...over });
const arts = [mk(1, "fr"), mk(2, "en", { category: "ai", importance: "follow" }), mk(3, "fr", { category: "ai", importance: "minor" }), mk(4, "en", { importance: "critical" })];
const DATA = { version: 1, generated_at: new Date().toISOString(), config: { prefBonus: 10 },
  sources: [{ id: 1, name: "Source FR", lang: "fr", categories: "[]", enabled: 1 }, { id: 2, name: "Source EN", lang: "en", categories: "[]", enabled: 1 }],
  articles: arts, article_sources: arts.map((a) => ({ article_id: a.id, source_id: a.source_id, url: a.url, published_at: a.published_at })),
  briefing: { day: "2026-10-22", generated_at: "x", summary: "3 actualités sur 24 h, dont 1 critique(s) et 2 importante(s). Sélection automatique par règles, sans IA.", topics: [], ids: [1, 2, 4] },
  status: { status: "ok", sources_ok: 2, sources_total: 2, added: 4, errors: [] } };

const svc = { cached: vi.fn(() => null), isReady: vi.fn(() => false), engineInfo: vi.fn(async () => ({ kind: "chrome", ready: true })), prepare: vi.fn(async () => {}), translateArticle: vi.fn(async (_id: string, { title }: any, from: string, to: string) => ({ title: `[${from}→${to}] ${title}` })), clearCache: vi.fn(), release: vi.fn() };
vi.mock("../web/translate.js", () => ({ service: svc }));

const html = readFileSync("web/index.html", "utf8");
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const cards = () => [...document.querySelectorAll("#list article")] as HTMLElement[];
const titles = () => cards().map((c) => c.querySelector("h2")!.textContent);
const click = (n: Element | null | undefined) => (n as HTMLElement).click();
const tab = (v: string) => click($(`#tabbar [data-view=${v}]`));
const setSelect = (labelStart: string, value: string) => {
  const f = [...document.querySelectorAll("#list .field")].find((x) => x.querySelector("span")!.textContent!.startsWith(labelStart))!;
  const s = f.querySelector("select")!; s.value = value; s.dispatchEvent(new Event("change"));
};
const checkbox = (label: string) => [...document.querySelectorAll("#list .check")].find((x) => x.textContent!.startsWith(label))!.querySelector("input")!;
const idle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const saved = () => JSON.parse(localStorage.getItem("techinfo:settings:v1") ?? "{}");

async function boot(settings: any = {}, userStore: any = {}) {
  vi.resetModules();
  document.documentElement.innerHTML = html.replace(/<script[^>]*><\/script>/, "");
  localStorage.clear(); localStorage.setItem("techinfo:settings:v1", JSON.stringify({ home: "explore", lang: "fr", ...settings })); localStorage.setItem("techinfo:v1", JSON.stringify(userStore));
  (Element.prototype as any).scrollIntoView = () => {}; window.scrollTo = (() => {}) as any;
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => DATA }));
  // @ts-ignore module JS du navigateur
  await import("../web/app.js");
  await vi.waitFor(() => expect($("#status").textContent).not.toMatch(/^(Chargement…|Loading…)$/));
}
beforeEach(() => {
  Object.values(svc).forEach((f: any) => f.mockClear?.());
  svc.cached.mockImplementation(() => null); svc.isReady.mockImplementation(() => false); svc.prepare.mockImplementation(async () => {});
  svc.translateArticle.mockImplementation(async (_id: string, { title }: any, from: string, to: string) => ({ title: `[${from}→${to}] ${title}` }));
});

describe("navigation et catégories favorites", () => {
  it("« Pour moi » sans catégorie choisie : propose d'en choisir et affiche tout", async () => {
    await boot({ home: "foryou" });
    expect($("#banner").hidden).toBe(false);
    expect(cards()).toHaveLength(4);
    click($("#banner button")); await vi.waitFor(() => expect($("#list").textContent).toContain("Mes catégories favorites"));
  });
  it("« Pour moi » n'affiche que les catégories favorites, avec leurs pastilles ; « Explorer » les met en premier", async () => {
    await boot({ home: "foryou" }, { cats: ["ai"] });
    expect(titles().sort()).toEqual(["English title 2", "Titre français 3"]);
    expect([...document.querySelectorAll("#chips .chip")].map((c) => (c as HTMLElement).dataset.cat)).toEqual(["", "ai"]);
    tab("explore"); await vi.waitFor(() => expect(cards()).toHaveLength(4));
    expect([...document.querySelectorAll("#chips .chip")].slice(0, 3).map((c) => (c as HTMLElement).dataset.cat)).toEqual(["", "ai", "web"]);
  });
  it("on choisit ses catégories favorites dans les réglages, et c'est mémorisé", async () => {
    await boot({ home: "foryou" });
    tab("settings"); await vi.waitFor(() => expect($("#list").textContent).toContain("Mes catégories favorites"));
    const box = checkbox("Cybersécurité"); box.checked = true; box.dispatchEvent(new Event("change"));
    const dev = checkbox("Développement"); dev.checked = true; dev.dispatchEvent(new Event("change"));
    await idle();
    expect(JSON.parse(localStorage.getItem("techinfo:v1")!).cats).toEqual(["dev", "security"]);
    tab("foryou"); await vi.waitFor(() => expect(titles().sort()).toEqual(["English title 4", "Titre français 1"]));
  });
  it("la pastille d'une catégorie filtre ; des clics rapides ne mélangent pas les résultats", async () => {
    await boot();
    const chip = (c: string) => $(`#chips [data-cat=${c}]`);
    click(chip("dev")); click(chip("ai")); click(chip("dev"));
    await idle(80);
    expect(titles().sort()).toEqual(["English title 4", "Titre français 1"]);
    expect(cards().every((c) => c.textContent!.includes("Développement"))).toBe(true);
  });
  it("favoris : ajout par l'étoile, liste des favoris, retrait", async () => {
    await boot();
    click(cards()[0].querySelector(".btn-fav")); await idle();
    expect(cards()[0].querySelector(".btn-fav")!.getAttribute("aria-pressed")).toBe("true");
    tab("favorites"); await vi.waitFor(() => expect(cards()).toHaveLength(1));
    click(cards()[0].querySelector(".btn-fav")); await vi.waitFor(() => expect(cards()).toHaveLength(0));
    expect($("#status").textContent).toContain("Aucun favori");
  });
});

describe("résumés et affichage", () => {
  it("affiche les résumés, et le réglage les masque ou les rallonge", async () => {
    await boot();
    expect(cards()[0].querySelector(".sum")!.textContent).toContain("Résumé numéro");
    expect(document.documentElement.dataset.summary).toBe("3");
    tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy());
    setSelect("Résumés", "off");
    expect(document.documentElement.dataset.summary).toBe("off");
    expect(saved().summary).toBe("off");
  });
  it("thème, taille, densité : appliqués tout de suite et mémorisés", async () => {
    await boot();
    tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy());
    setSelect("Thème", "dark"); setSelect("Taille du texte", "l"); setSelect("Densité", "compact");
    const d = document.documentElement.dataset;
    expect([d.theme, d.size, d.density]).toEqual(["dark", "l", "compact"]);
    expect(saved()).toMatchObject({ theme: "dark", size: "l", density: "compact" });
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute("content")).toBe("#0e1923");
  });
  it("importance minimale et sources masquées", async () => {
    await boot();
    expect(cards()).toHaveLength(4);
    tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy());
    setSelect("Importance minimale", "important");
    const box = checkbox("Source EN"); box.checked = false; box.dispatchEvent(new Event("change"));
    tab("explore"); await vi.waitFor(() => expect(titles()).toEqual(["Titre français 1"]));
    expect(saved()).toMatchObject({ minLevel: "important", muted: ["Source EN"] });
  });
  it("réinitialiser les réglages remet les valeurs par défaut", async () => {
    await boot({ theme: "dark", summary: "off" });
    tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy());
    click([...document.querySelectorAll("#list .btn")].find((b) => b.textContent === "Réinitialiser les réglages") ?? [...document.querySelectorAll("#list .btn")].find((b) => b.textContent === "Reset settings"));
    await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBe("auto"));
    expect(document.documentElement.dataset.summary).toBe("3");
  });
});

describe("langue", () => {
  it("français par défaut quand l'appareil est en français ; passage à l'anglais depuis les réglages", async () => {
    await boot({ lang: "fr", home: "briefing" });
    expect($("#status").textContent).toContain("3 actualités sur 24 h");
    expect($("#tabbar").textContent).toContain("Pour moi");
    tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy());
    setSelect("Langue de l'interface", "en");
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect($("#tabbar").textContent).toContain("For me");
    await vi.waitFor(() => expect($("#list").textContent).toContain("My favorite categories"));
    expect(saved().lang).toBe("en");
  });
  it("filtre par langue des articles", async () => {
    await boot({ lang: "en", show: "fr" });
    expect(cards().map((c) => c.getAttribute("lang"))).toEqual(["fr", "fr"]);
  });
});

describe("traduction", () => {
  const trBtn = (c: HTMLElement) => c.querySelector(".btn-tr") as HTMLElement;
  it("propose « Traduire » seulement pour l'autre langue ; le lien reste celui de la source", async () => {
    await boot({ lang: "en" });
    expect(cards().filter((c) => !trBtn(c).hidden).map((c) => c.querySelector("h2")!.textContent)).toEqual(["Titre français 1", "Titre français 3"]);
    expect(cards()[0].querySelector("a.primary")!.getAttribute("href")).toBe("https://x.example/1");
  });
  it("traduit FR→EN au clic puis revient à l'original ; et inversement EN→FR", async () => {
    await boot({ lang: "en" });
    const c = cards()[0]; click(trBtn(c));
    await vi.waitFor(() => expect(c.querySelector("h2")!.textContent).toBe("[fr→en] Titre français 1"));
    expect(svc.prepare).toHaveBeenCalledWith("fr", "en", expect.objectContaining({ interactive: true }));
    expect(trBtn(c).textContent).toBe("Show original");
    click(trBtn(c)); await vi.waitFor(() => expect(c.querySelector("h2")!.textContent).toBe("Titre français 1"));
    await boot({ lang: "fr" });
    const en = cards().find((x) => x.textContent!.includes("English title 2"))!; click(trBtn(en));
    await vi.waitFor(() => expect(en.querySelector("h2")!.textContent).toBe("[en→fr] English title 2"));
  });
  it("traduction automatique : sans geste, une carte à la fois", async () => {
    await boot({ lang: "en", auto: true, modelOk: true });
    await vi.waitFor(() => expect(titles()).toContain("[fr→en] Titre français 1"));
    expect(svc.prepare).toHaveBeenCalledWith("fr", "en", expect.objectContaining({ interactive: false, allowModel: true }));
  });
  it("changer de catégorie annule les traductions en attente (plus de blocage)", async () => {
    let release!: () => void; const gate = new Promise<void>((r) => { release = r; });
    svc.translateArticle.mockImplementation(async (_id: string, { title }: any) => { await gate; return { title: `T ${title}` }; });
    await boot({ lang: "en", auto: true, modelOk: true });
    await vi.waitFor(() => expect(svc.translateArticle).toHaveBeenCalledTimes(1));
    click($("#chips [data-cat=web]"));                    // catégorie vide : l'ancienne liste disparaît
    await vi.waitFor(() => expect(cards()).toHaveLength(0));
    release(); await idle(60);
    expect(svc.translateArticle).toHaveBeenCalledTimes(1); // la 2e carte de l'ancienne liste n'est jamais traduite
  });
  it("bug « 100 % » : la barre de progression disparaît même quand le moteur échoue", async () => {
    svc.prepare.mockImplementation((async (_f: string, _t: string, o: any) => { o.onProgress(100); throw new Error("no-engine"); }) as any);
    await boot({ lang: "en" });
    click(trBtn(cards()[0]));
    await vi.waitFor(() => expect($("#status").textContent).toContain("not available"));
    expect($("#toast").hidden).toBe(true);
    expect($("#toast").textContent).toBe("");
  });
  it("affiche une erreur claire si la traduction échoue", async () => {
    svc.translateArticle.mockRejectedValueOnce(new Error("x"));
    await boot({ lang: "en" });
    click(trBtn(cards()[0]));
    await vi.waitFor(() => expect($("#status").textContent).toContain("Translation failed"));
    expect(cards()[0].querySelector("h2")!.textContent).toBe("Titre français 1");
  });
  it("désactiver la traduction automatique libère la mémoire du modèle", async () => {
    await boot({ lang: "en", auto: true, modelOk: true });
    tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy());
    const box = checkbox("Automatically translate"); box.checked = false; box.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(svc.release).toHaveBeenCalled());
    expect(saved().auto).toBe(false);
  });
});

describe("installation comme application", () => {
  const settingsPage = async () => { tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy()); };
  it("affiche « Installer » quand le navigateur le propose, et lance l'installation au clic", async () => {
    await boot({ lang: "fr" });
    const prompt = vi.fn(async () => {}), ev = new Event("beforeinstallprompt", { cancelable: true }) as any; ev.prompt = prompt; window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    await settingsPage();
    click([...document.querySelectorAll("#list button")].find((b) => b.textContent!.includes("Installer l'application")));
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  });
  it("rien si le navigateur ne propose pas l'installation ; message si déjà installée ; mode d'emploi sur iPhone", async () => {
    await boot({ lang: "en" }); await settingsPage();
    expect($("#list").textContent).not.toContain("Install the app");
    vi.stubGlobal("matchMedia", () => ({ matches: true })); await boot({ lang: "en" }); await settingsPage();
    expect($("#list").textContent).toContain("The app is installed");
    vi.unstubAllGlobals();
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", languages: ["fr-FR"] });
    await boot({ lang: "fr" }); await settingsPage();
    expect($("#list").textContent).toContain("Sur l'écran d'accueil");
    vi.unstubAllGlobals();
  });
});
