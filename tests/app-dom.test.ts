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

const world = { data: DATA as any };
const html = readFileSync("web/index.html", "utf8");
const added: Array<[any, string, any, any]> = [];
for (const tgt of [window, document] as any[]) { const orig = tgt.addEventListener.bind(tgt); tgt.addEventListener = (t: string, f: any, o: any) => { added.push([tgt, t, f, o]); orig(t, f, o); }; }
const scrollSpy = vi.fn();
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

async function boot(settings: any = {}, userStore: any = {}, opts: { hash?: string; state?: any } = {}) {
  vi.resetModules();
  for (const [tg, t, f, o] of added.splice(0)) tg.removeEventListener(t, f, o);
  history.replaceState(null, "", opts.hash ? `/${opts.hash}` : "/");
  if (opts.state) history.replaceState(opts.state, "", opts.hash ? `/${opts.hash}` : "/");
  document.documentElement.innerHTML = html.replace(/<script[^>]*><\/script>/, "");
  localStorage.clear(); localStorage.setItem("techinfo:settings:v1", JSON.stringify({ home: "explore", lang: "fr", onboarded: true, ...settings })); localStorage.setItem("techinfo:v1", JSON.stringify(userStore));
  (Element.prototype as any).scrollIntoView = () => {}; window.scrollTo = scrollSpy as any;
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => world.data }));
  // @ts-ignore module JS du navigateur
  await import("../web/app.js");
  await vi.waitFor(() => expect($("#status").textContent).not.toMatch(/^(Chargement…|Loading…)$/));
}
beforeEach(() => {
  world.data = DATA; scrollSpy.mockClear();
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

// ======================= nouvelles fonctions =======================
const noon = (daysAgo: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - daysAgo); return d.toISOString(); };
const dataWith = (arts: any[], extra: any = {}) => ({ ...DATA, ...extra, articles: arts, article_sources: arts.map((a) => ({ article_id: a.id, source_id: a.source_id, url: a.url, published_at: a.published_at })), briefing: null });
const many = (n: number) => Array.from({ length: n }, (_, i) => mk(i + 1, "fr", { key: `0b${i + 1}`, title: `Article ${i + 1}`, sort_ts: new Date(Date.now() - i * 60e3).toISOString(), published_at: new Date(Date.now() - i * 60e3).toISOString() }));

describe("adresse partageable et retour", () => {
  it("ouvre directement la vue, la catégorie et la recherche indiquées dans l'adresse", async () => {
    await boot({}, {}, { hash: "#/explore/ai?q=titre" });
    expect($("#tabbar [data-view=explore]").getAttribute("aria-current")).toBe("true");
    expect($("#chips [data-cat=ai]").getAttribute("aria-current")).toBe("true");
    expect(($("#q") as HTMLInputElement).value).toBe("titre");
    expect(titles()).toEqual(["Titre français 3"]);
  });
  it("une adresse inconnue ou piégée retombe sur la page d'accueil, sans erreur", async () => {
    await boot({ home: "explore" }, {}, { hash: "#/nimporte/../quoi?x=1" });
    expect($("#tabbar [data-view=explore]").getAttribute("aria-current")).toBe("true");
    expect(location.hash).toBe("#/explore");
  });
  it("chaque navigation met à jour l'adresse (onglets, catégories, recherche)", async () => {
    await boot();
    tab("favorites"); expect(location.hash).toBe("#/favorites");
    tab("explore"); click($("#chips [data-cat=dev]")); expect(location.hash).toBe("#/explore/dev");
    const q = $("#q") as HTMLInputElement; q.value = "node"; q.dispatchEvent(new Event("input"));
    await vi.waitFor(() => expect(location.hash).toBe("#/explore/dev?q=node"));
  });
  it("le bouton retour revient à la vue précédente et à la même position de défilement", async () => {
    await boot();
    Object.defineProperty(window, "scrollY", { value: 640, configurable: true });
    tab("favorites"); await vi.waitFor(() => expect(location.hash).toBe("#/favorites"));
    scrollSpy.mockClear();
    history.back();
    await vi.waitFor(() => expect($("#tabbar [data-view=explore]").getAttribute("aria-current")).toBe("true"));
    await vi.waitFor(() => expect(scrollSpy).toHaveBeenCalledWith(0, 640));
    expect(cards()).toHaveLength(4);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });
  it("au rechargement de la page, retrouve la place mémorisée (et recharge assez d'articles pour y arriver)", async () => {
    await boot({}, {}, { hash: "#/explore", state: { y: 420, loaded: 2 } });
    await vi.waitFor(() => expect(scrollSpy).toHaveBeenCalledWith(0, 420));
  });
});

describe("défilement infini et squelettes", () => {
  it("charge la suite quand on approche de la fin, sans bouton « Voir plus »", async () => {
    let fire!: () => void;
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: any) { fire = () => cb([{ isIntersecting: true }]); } observe() {} unobserve() {} disconnect() {} });
    world.data = dataWith(many(70));
    await boot();
    expect(cards()).toHaveLength(30);
    expect($("#more").hidden).toBe(true);
    fire(); await vi.waitFor(() => expect(cards()).toHaveLength(60));
    fire(); await vi.waitFor(() => expect(cards()).toHaveLength(70));
    fire(); await idle(); expect(cards()).toHaveLength(70);                 // plus rien à charger
    expect(document.querySelectorAll("#list .skel")).toHaveLength(0);
    expect($("#list").getAttribute("aria-busy")).toBe("false");
    vi.unstubAllGlobals();
  });
  it("sans observateur de défilement, le bouton « Voir plus » prend le relais", async () => {
    world.data = dataWith(many(40));
    await boot();
    expect($("#more").hidden).toBe(false);
    click($("#more")); await vi.waitFor(() => expect(cards()).toHaveLength(40));
    expect($("#more").hidden).toBe(true);
  });
  it("affiche des cartes squelettes pendant le chargement, puis les retire", async () => {
    await boot();
    click($("#chips [data-cat=dev]"));
    expect(document.querySelectorAll("#list .skel").length).toBeGreaterThan(0);
    expect($("#list").getAttribute("aria-busy")).toBe("true");
    await vi.waitFor(() => expect($("#list").getAttribute("aria-busy")).toBe("false"));
    expect(document.querySelectorAll("#list .skel")).toHaveLength(0);
  });
});

describe("titres par jour et liste compacte", () => {
  const dated = () => [mk(1, "fr", { published_at: noon(0), sort_ts: noon(0) }), mk(2, "fr", { published_at: noon(0), sort_ts: noon(0), key: "0a22", id: 22 }), mk(3, "fr", { published_at: noon(1), sort_ts: noon(1) }), mk(4, "fr", { published_at: noon(5), sort_ts: noon(5) })];
  it("regroupe par jour : Aujourd'hui, Hier, puis la date ; pas de répétition", async () => {
    world.data = dataWith(dated());
    await boot();
    const days = [...document.querySelectorAll("#list .day")].map((d) => d.textContent);
    expect(days).toHaveLength(3);
    expect(days.slice(0, 2)).toEqual(["Aujourd'hui", "Hier"]);
    expect(days[2]).toMatch(/\d/);
    expect(cards()).toHaveLength(4);
  });
  it("en anglais : Today / Yesterday ; réglage pour les masquer ; absents en tri par pertinence", async () => {
    world.data = dataWith(dated());
    await boot({ lang: "en" });
    expect([...document.querySelectorAll("#list .day")].slice(0, 2).map((d) => d.textContent)).toEqual(["Today", "Yesterday"]);
    await boot({ groupDays: false }); expect(document.querySelectorAll("#list .day")).toHaveLength(0);
    await boot({ sort: "score" }); expect(document.querySelectorAll("#list .day")).toHaveLength(0);
  });
  it("la liste compacte se règle dans les filtres et dans les réglages, et est mémorisée", async () => {
    await boot({ layout: "compact" });
    expect(document.documentElement.dataset.layout).toBe("compact");
    await boot();
    const sel = [...document.querySelectorAll("#filters select")].find((s) => s.getAttribute("aria-label") === "Mise en page") as HTMLSelectElement;
    sel.value = "compact"; sel.dispatchEvent(new Event("change"));
    expect(document.documentElement.dataset.layout).toBe("compact");
    expect(saved().layout).toBe("compact");
  });
});

describe("balayages et partage", () => {
  const touch = (n: Element, type: string, x: number, y = 0, pointerType = "touch") => n.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { pointerId: 1, pointerType, clientX: x, clientY: y }));
  const swipe = (n: Element, dx: number, dy = 0, pointerType = "touch") => { touch(n, "pointerdown", 200, 300, pointerType); touch(n, "pointermove", 200 + dx / 2, 300 + dy / 2, pointerType); touch(n, "pointermove", 200 + dx, 300 + dy, pointerType); touch(n, "pointerup", 200 + dx, 300 + dy, pointerType); };
  const fav = (c: HTMLElement) => c.querySelector(".btn-fav")!.getAttribute("aria-pressed");
  const isRead = (c: HTMLElement) => c.classList.contains("read");

  it("par défaut : droite = favori, gauche = marquer lu, avec un retour visuel", async () => {
    await boot();
    const c = cards()[1];
    touch(c, "pointerdown", 200, 300); touch(c, "pointermove", 230, 300); touch(c, "pointermove", 290, 300);
    expect(c.dataset.swipe).toBe("right"); expect(c.dataset.hint).toBe("★ Favori");
    touch(c, "pointerup", 290, 300);
    expect(c.hasAttribute("data-swipe")).toBe(false);
    await vi.waitFor(() => expect(fav(c)).toBe("true"));
    await vi.waitFor(() => expect($("#toast").textContent).toContain("Ajouté aux favoris"));
    swipe(c, 120); await vi.waitFor(() => expect(fav(c)).toBe("false"));          // le même geste annule
    const d = cards()[2]; swipe(d, -120);
    await vi.waitFor(() => expect(isRead(d)).toBe(true));
    expect(d.querySelector(".btn-read")!.getAttribute("aria-pressed")).toBe("true");
  });
  it("les actions de chaque sens se règlent : inverser, partager, ou désactiver", async () => {
    await boot({ swipeRight: "read", swipeLeft: "off" });
    const c = cards()[0];
    swipe(c, 120); await vi.waitFor(() => expect(isRead(c)).toBe(true));
    expect(fav(c)).toBe("false");
    const d = cards()[1]; swipe(d, -150); await idle(); expect(isRead(d)).toBe(false); expect(fav(d)).toBe("false");
    expect(d.hasAttribute("data-swipe")).toBe(false);
  });
  it("ne réagit ni à un petit geste, ni au défilement vertical, ni à la souris", async () => {
    await boot();
    const c = cards()[0];
    swipe(c, 50); swipe(c, 20, 140); swipe(c, 140, 0, "mouse"); swipe(c, 100, 90);
    await idle(); expect(fav(c)).toBe("false"); expect(isRead(c)).toBe(false);
  });
  it("un balayage n'ouvre pas la carte, mais un simple appui oui", async () => {
    await boot();
    const c = cards()[0], title = c.querySelector("h2 button") as HTMLElement;
    swipe(c, 120); click(title); await idle();
    expect(c.classList.contains("open")).toBe(false);
    await new Promise((r) => setTimeout(r, 450)); click(title);
    await vi.waitFor(() => expect(c.classList.contains("open")).toBe(true));
  });
  it("les réglages des gestes sont proposés et mémorisés", async () => {
    await boot();
    tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy());
    setSelect("Balayer vers la droite", "share"); setSelect("Balayer vers la gauche", "favorite"); setSelect("Ouvrir les articles", "same");
    expect(saved()).toMatchObject({ swipeRight: "share", swipeLeft: "favorite", openIn: "same" });
  });

  const withNav = (props: any) => { for (const [k, v] of Object.entries(props)) Object.defineProperty(navigator, k, { value: v, configurable: true }); };
  const unNav = () => { for (const k of ["share", "clipboard"]) delete (navigator as any)[k]; };
  it("partage natif quand il existe", async () => {
    const share = vi.fn(async () => {}); withNav({ share });
    await boot(); click(cards()[0].querySelector(".btn-share"));
    await vi.waitFor(() => expect(share).toHaveBeenCalledWith({ title: "Titre français 1", url: "https://x.example/1" }));
    unNav();
  });
  it("sinon, copie le lien et le dit ; annuler le partage ne copie rien ; une erreur de partage copie", async () => {
    const writeText = vi.fn(async () => {}); withNav({ clipboard: { writeText } });
    await boot(); click(cards()[0].querySelector(".btn-share"));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("https://x.example/1"));
    expect($("#toast").textContent).toBe("Lien copié");
    writeText.mockClear();
    withNav({ share: vi.fn(async () => { throw Object.assign(new Error("x"), { name: "AbortError" }); }) });
    click(cards()[1].querySelector(".btn-share")); await idle(); expect(writeText).not.toHaveBeenCalled();
    withNav({ share: vi.fn(async () => { throw new Error("indisponible"); }) });
    click(cards()[1].querySelector(".btn-share")); await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("https://x.example/2"));
    unNav();
  });
  it("le détail d'un article propose « Copier le lien », et « même onglet » est pris en compte", async () => {
    const writeText = vi.fn(async () => {}); withNav({ clipboard: { writeText } });
    await boot({ openIn: "same" });
    const c = cards()[0]; click(c.querySelector("h2 button"));
    await vi.waitFor(() => expect(c.querySelector(".btn-copy")).toBeTruthy());
    click(c.querySelector(".btn-copy")); await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("https://x.example/1"));
    document.addEventListener("click", (e) => e.preventDefault(), true);
    const link = c.querySelector("a.primary") as HTMLAnchorElement; click(link);
    expect(link.target).toBe("_self");
    unNav();
  });
});

describe("nouveaux articles pendant la lecture", () => {
  const newer = (extra: any[] = [], over: any = {}) => ({ ...DATA, generated_at: new Date(Date.now() + 3600e3).toISOString(), articles: [...arts, ...extra], article_sources: [...DATA.article_sources, ...extra.map((a) => ({ article_id: a.id, source_id: a.source_id, url: a.url, published_at: a.published_at }))], ...over });
  it("affiche un bandeau avec le nombre d'articles nouveaux, et les charge au clic", async () => {
    await boot();
    expect($("#fresh").hidden).toBe(true);
    world.data = newer([mk(9, "fr", { key: "0a9", id: 9, title: "Tout nouvel article" }), mk(10, "en", { key: "0a10", id: 10, title: "Brand new", source_id: 2 })]);
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect($("#fresh").hidden).toBe(false));
    expect($("#fresh").textContent).toContain("2 nouveaux articles");
    click($("#fresh"));
    await vi.waitFor(() => expect(titles()).toContain("Tout nouvel article"));
    expect($("#fresh").hidden).toBe(true);
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0 });
  });
  it("au singulier, en anglais ; ne compte pas les articles masqués par les réglages", async () => {
    await boot({ lang: "en", muted: ["Source EN"] });
    world.data = newer([mk(9, "fr", { key: "0a9", id: 9 }), mk(10, "en", { key: "0a10", id: 10, source_id: 2 })]);
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect($("#fresh").hidden).toBe(false));
    expect($("#fresh").textContent).toBe("↑ 1 new article");
  });
  it("reste caché s'il n'y a rien de nouveau, ou si le site n'a pas été mis à jour", async () => {
    await boot();
    window.dispatchEvent(new Event("focus")); await idle(); expect($("#fresh").hidden).toBe(true);
    world.data = newer([], { articles: arts });                       // mise à jour sans nouveaux articles
    document.dispatchEvent(new Event("visibilitychange")); await idle(); expect($("#fresh").hidden).toBe(true);
  });
});

describe("premier lancement guidé", () => {
  const dlg = () => $("#welcome") as HTMLDialogElement;
  const finishBtn = () => $("#welcome-finish") as HTMLButtonElement;
  const box = (label: string) => [...dlg().querySelectorAll(".check")].find((x) => x.textContent!.startsWith(label))!.querySelector("input")!;
  it("s'ouvre au premier lancement, tant qu'aucune catégorie n'est choisie, et rend « Pour moi » jamais vide", async () => {
    await boot({ onboarded: false, home: "foryou" });
    expect(dlg().hasAttribute("open")).toBe(true);
    expect(finishBtn().disabled).toBe(true);
    box("Développement").checked = true; box("Développement").dispatchEvent(new Event("change"));
    expect(finishBtn().disabled).toBe(false);
    click(finishBtn());
    await vi.waitFor(() => expect(dlg().hasAttribute("open")).toBe(false));
    expect(JSON.parse(localStorage.getItem("techinfo:v1")!).cats).toEqual(["dev"]);
    expect(saved().onboarded).toBe(true);
    await vi.waitFor(() => expect(titles().sort()).toEqual(["English title 4", "Titre français 1"]));
    expect($("#banner").hidden).toBe(true);
  });
  it("« Tout sélectionner », choix de la langue et du thème dans l'assistant", async () => {
    await boot({ onboarded: false, lang: "fr" });
    const sel = dlg().querySelectorAll("select");
    (sel[0] as HTMLSelectElement).value = "en"; sel[0].dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(dlg().textContent).toContain("Welcome to TechInfo"));
    const th = dlg().querySelectorAll("select")[1] as HTMLSelectElement; th.value = "dark"; th.dispatchEvent(new Event("change"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    click([...dlg().querySelectorAll("button")].find((b) => b.textContent === "Select all"));
    await vi.waitFor(() => expect(finishBtn().disabled).toBe(false));
    expect(dlg().querySelectorAll(".check input:checked")).toHaveLength(13);
    expect(saved()).toMatchObject({ lang: "en", theme: "dark" });
  });
  it("« Passer » ne force rien : tout s'affiche, avec l'invitation à choisir plus tard", async () => {
    await boot({ onboarded: false, home: "foryou" });
    click($("#welcome-skip"));
    expect(dlg().hasAttribute("open")).toBe(false);
    expect(saved().onboarded).toBe(true);
    expect(cards()).toHaveLength(4); expect($("#banner").hidden).toBe(false);
  });
  it("fermer la fenêtre (Échap) compte comme « Passer » ; ne s'ouvre pas si déjà fait ou si des catégories existent", async () => {
    await boot({ onboarded: false });
    dlg().dispatchEvent(new Event("close")); expect(saved().onboarded).toBe(true);
    await boot({ onboarded: true }); expect(dlg().hasAttribute("open")).toBe(false);
    await boot({ onboarded: false }, { cats: ["ai"] }); expect(dlg().hasAttribute("open")).toBe(false);
  });
  it("on peut relancer l'assistant depuis les réglages", async () => {
    await boot();
    tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy());
    click([...document.querySelectorAll("#list .btn")].find((b) => b.textContent === "Revoir l'assistant de démarrage"));
    expect(dlg().hasAttribute("open")).toBe(true);
  });
});

describe("état des sources et catégories vides", () => {
  const withStatus = () => dataWith([mk(1, "fr")], { sources: [
    { id: 1, name: "Source FR", lang: "fr", categories: '["dev"]', enabled: 1, last_success_at: new Date().toISOString(), last_error: null },
    { id: 2, name: "Source Web", lang: "en", categories: '["web"]', enabled: 1, last_success_at: null, last_error: "HTTP 403" },
    { id: 3, name: "Autre Web", lang: "en", categories: '["web"]', enabled: 1, last_success_at: new Date().toISOString(), last_error: null }] });
  it("les réglages montrent pour chaque source la dernière lecture, l'erreur et le nombre d'articles", async () => {
    world.data = withStatus();
    await boot();
    tab("settings"); await vi.waitFor(() => expect($("#list .set")).toBeTruthy());
    const rows = [...document.querySelectorAll("#list .srcname")].map((r) => r.textContent);
    expect(rows.find((r) => r!.includes("Source Web"))).toContain("⚠ HTTP 403");
    expect(rows.find((r) => r!.includes("Source FR"))).toMatch(/dernière lecture .* 1 article/);
    expect($("#list").textContent).toContain("1 source(s) sur 3 ne répondent pas");
  });
  it("une catégorie vide explique pourquoi : sources concernées et pannes", async () => {
    world.data = withStatus();
    await boot();
    click($("#chips [data-cat=web]"));
    await vi.waitFor(() => expect($("#banner").hidden).toBe(false));
    expect($("#banner").textContent).toContain("Rien de récent dans « Web »");
    expect($("#banner").textContent).toContain("Source Web ⚠ HTTP 403");
    expect($("#banner").textContent).toContain("Autre Web ✓");
  });
  it("une catégorie sans aucune source le dit aussi, en anglais", async () => {
    world.data = withStatus();
    await boot({ lang: "en" });
    click($("#chips [data-cat=science]"));
    await vi.waitFor(() => expect($("#banner").textContent).toContain("No source feeds “Science and space” yet."));
  });
});

describe("logos et images", () => {
  const withMedia = () => ({ ...DATA, sources: [{ ...DATA.sources[0], logo: "data/logos/a-1234.png" }, DATA.sources[1]], articles: [mk(1, "fr", { image: "https://i.example/a.jpg" }), mk(2, "en")] });
  it("affiche le logo de la source, ou sa lettre s'il manque ou ne charge pas", async () => {
    world.data = withMedia(); await boot();
    const [a, b] = cards();
    const img = a.querySelector(".meta img.src-logo") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("data/logos/a-1234.png");
    expect(b.querySelector(".meta .src-logo.mono")!.getAttribute("data-l")).toBe("S");
    expect(b.querySelector(".meta .src")!.textContent).toBe("Source EN"); // la lettre décorative n'entre pas dans le texte
    img.dispatchEvent(new Event("error"));
    expect(a.querySelector(".meta img.src-logo")).toBeNull();
    expect(a.querySelector(".meta .src-logo.mono")).toBeTruthy();
  });
  it("affiche l'image de l'article sans envoyer le référent ; une erreur la retire ; le réglage la coupe", async () => {
    world.data = withMedia(); await boot();
    const thumb = cards()[0].querySelector(".thumb") as HTMLImageElement;
    expect(thumb.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(thumb.getAttribute("loading")).toBe("lazy");
    thumb.dispatchEvent(new Event("error"));
    expect(cards()[0].querySelector(".thumb")).toBeNull();
    await boot({ images: false });
    expect(cards()[0].querySelector(".thumb")).toBeNull();
  });
  it("refuse une image qui n'est pas en https", async () => {
    world.data = { ...DATA, articles: [mk(1, "fr", { image: "javascript:alert(1)" })] }; await boot();
    expect(cards()[0].querySelector(".thumb")).toBeNull();
  });
});

describe("stories du jour", () => {
  const open = async (settings: any = {}) => { await boot({ home: "briefing", ...settings }); await vi.waitFor(() => expect($(".story-cell")).toBeTruthy()); click($(".story-cell")); await vi.waitFor(() => expect($("#stories .story-text")).toBeTruthy()); };
  const next = () => click($("#stories .story-nav.next"));
  it("s'ouvrent depuis le briefing, avancent, et finissent par « Tu es à jour »", async () => {
    await open();
    expect($("#stories h2").textContent).toBe("Titre français 1");
    const n = document.querySelectorAll(".story-bar").length;
    expect(n).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < n; i++) next();
    await vi.waitFor(() => expect($(".story-end h2").textContent).toBe("Tu es à jour !"));
    const store = JSON.parse(localStorage.getItem("techinfo:v1")!);
    expect(Object.keys(store.seen).length).toBe(n);
    expect(Object.values<any>(store.days)[0].stories).toBe(1);
    expect($(".story-streak").textContent).toContain("1 jour");
  });
  it("les stories vues perdent leur anneau, et ne comptent pas comme articles lus", async () => {
    await open();
    click($('#stories [aria-label="Fermer les stories"]'));
    await vi.waitFor(() => expect(document.querySelectorAll(".story-cell").length).toBeGreaterThan(0));
    await vi.waitFor(() => expect(document.querySelector(".story-cell")!.classList.contains("unseen")).toBe(false));
    expect(document.querySelectorAll(".story-cell")[1].classList.contains("unseen")).toBe(true);
    expect(JSON.parse(localStorage.getItem("techinfo:v1")!).read).toEqual({});
  });
  it("avancent seules, et le bouton pause les arrête", async () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    await open();
    const tick = spy.mock.calls.filter((c) => c[1] === 100).at(-1)![0] as () => void;
    spy.mockRestore();
    const title = () => $("#stories .story-text h2").textContent;
    const first = title();
    for (let i = 0; i < 80; i++) tick();
    const second = title();
    expect(second).not.toBe(first);
    click($('#stories [aria-label="Mettre en pause"]'));
    for (let i = 0; i < 200; i++) tick();
    expect(title()).toBe(second);
    click($('#stories [aria-label="Reprendre"]'));
    for (let i = 0; i < 80; i++) tick();
    expect(title()).not.toBe(second);
    click($('#stories [aria-label="Fermer les stories"]'));
  });
  it("les flèches du clavier naviguent", async () => {
    await open();
    const title = () => $("#stories .story-text h2").textContent, first = title();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(title()).not.toBe(first);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(title()).toBe(first);
    click($('#stories [aria-label="Fermer les stories"]'));
  });
  it("fermer arrête tout : plus de minuteur ni d'écoute du clavier", async () => {
    const stop = vi.spyOn(globalThis, "clearInterval");
    await open();
    click($('#stories [aria-label="Fermer les stories"]'));
    expect(stop).toHaveBeenCalled(); stop.mockRestore();
    expect($("#stories").children).toHaveLength(0);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })); // ne doit rien casser
  });
  it("une source masquée n'apparaît pas", async () => {
    await open({ muted: ["Source EN"] });
    expect([...document.querySelectorAll(".story-cell")].some((c) => c.textContent!.includes("Source EN"))).toBe(false);
    click($('#stories [aria-label="Fermer les stories"]'));
  });
  it("au plus 2 stories par source, pour varier", async () => {
    world.data = { ...DATA, articles: [1, 2, 3, 4, 5].map((n) => mk(n, "fr")), article_sources: [], briefing: { ...DATA.briefing, ids: [1, 2, 3, 4, 5] } };
    await boot({ home: "briefing" });
    await vi.waitFor(() => expect($(".story-cell")).toBeTruthy());
    expect(document.querySelectorAll(".story-cell:not(.all)")).toHaveLength(2);
  });
});

describe("page Apprendre", () => {
  const learn = async () => { await boot(); tab("learn"); await vi.waitFor(() => expect($("#list .word")).toBeTruthy()); };
  it("montre le mot du jour, la série, le quiz, le bilan et le glossaire", async () => {
    await learn();
    const heads = [...document.querySelectorAll("#list .set h2")].map((h) => h.textContent);
    expect(heads).toEqual(["Série de jours", "Mot du jour", "Quiz du jour", "Bilan de la semaine", "Glossaire"]);
    expect($("#list").textContent).toContain("Pas encore de série");
    expect(location.hash).toBe("#/learn");
  });
  it("le glossaire se filtre, sans tenir compte des accents", async () => {
    await learn();
    const box = document.querySelector('#list input[type=search]') as HTMLInputElement;
    box.value = "rancongiciel"; box.dispatchEvent(new Event("input"));
    expect([...document.querySelectorAll("#list .terms dt")].map((d) => d.textContent)).toEqual(["Rançongiciel"]);
    box.value = "zzzz"; box.dispatchEvent(new Event("input"));
    expect(document.querySelectorAll("#list .terms dt")).toHaveLength(0);
    expect($("#list").textContent).toContain("Aucun mot ne correspond");
  });
  it("le quiz va au bout, compte les points, garde le premier score et lance la série", async () => {
    await learn();
    click($(".quiz .btn"));
    let right = 0;
    for (let i = 0; i < 5; i++) {
      const opts = [...document.querySelectorAll<HTMLButtonElement>(".quiz-opt")];
      expect(opts).toHaveLength(4);
      click(opts[0]);
      expect(opts.every((o) => o.disabled)).toBe(true);
      if (opts[0].classList.contains("ok")) right++; else expect($(".quiz-fb").textContent).toContain("Raté");
      click($(".quiz .btn.primary"));
    }
    await vi.waitFor(() => expect($(".score").textContent).toBe(`Score du jour : ${right} sur 5.`));
    expect($("#list .streak").textContent).toContain("1 jour");
    click($(".quiz .btn"));
    const opts = [...document.querySelectorAll<HTMLButtonElement>(".quiz-opt")];
    click(opts.find((o) => o) as any); click($(".quiz .btn.primary"));
    for (let i = 1; i < 5; i++) { click(document.querySelector(".quiz-opt")); click($(".quiz .btn.primary")); }
    await vi.waitFor(() => expect($(".score").textContent).toBe(`Score du jour : ${right} sur 5.`));
  });
  it("lire un article alimente le bilan ; relire ne compte pas deux fois", async () => {
    await boot();
    click(cards()[0].querySelector(".btn-read")); await idle();
    click(cards()[0].querySelector(".btn-read")); await idle();
    click(cards()[0].querySelector(".btn-read")); await idle();
    tab("learn"); await vi.waitFor(() => expect($("#list .word")).toBeTruthy());
    expect($(".week").textContent).toContain("1 article(s) lu(s)");
    expect($(".week").textContent).toContain("Développement (1)");
  });
});

describe("suivre un sujet et « Ça monte »", () => {
  const trendData = () => { const list = [1, 2, 3].map((n) => mk(n, n % 2 ? "fr" : "en", { title: `Mise au point sur Starship ${n}`, category: "science" })); return { ...DATA, articles: [...list, mk(9, "fr", { title: "Autre sujet", category: "web" })], article_sources: [] }; };
  it("« Ça monte » apparaît dans Explorer et mène à la recherche", async () => {
    world.data = trendData(); await boot();
    const chip = $('[data-trend="starship"]');
    expect(chip.textContent).toContain("↑ 3");
    click(chip);
    await vi.waitFor(() => expect(cards()).toHaveLength(3));
    expect(($("#q") as HTMLInputElement).value).toBe("Starship");
    expect(location.hash).toBe("#/explore?q=Starship");
  });
  it("on suit un sujet depuis la recherche, il s'ajoute à « Pour moi », et on peut le retirer", async () => {
    world.data = trendData(); await boot({}, { cats: ["web"] });
    click($('[data-trend="starship"]'));
    await vi.waitFor(() => expect($(".btn.follow")).toBeTruthy());
    expect($(".btn.follow").getAttribute("aria-pressed")).toBe("false");
    click($(".btn.follow"));
    await vi.waitFor(() => expect($(".btn.follow").getAttribute("aria-pressed")).toBe("true"));
    expect(JSON.parse(localStorage.getItem("techinfo:v1")!).topics).toEqual(["starship"]);
    ($("#q") as HTMLInputElement).value = "";
    tab("foryou");
    await vi.waitFor(() => expect(cards()).toHaveLength(4)); // catégorie « web » + sujet suivi
    expect($('[data-topic="starship"]')).toBeTruthy();
    tab("settings"); await vi.waitFor(() => expect($(".topic-list")).toBeTruthy());
    click($(".topic-list .chip"));
    await vi.waitFor(() => expect($("#list").textContent).toContain("Aucun sujet suivi"));
    expect(JSON.parse(localStorage.getItem("techinfo:v1")!).topics).toEqual([]);
  });
  it("les sujets seuls suffisent à filtrer « Pour moi », sans invitation à choisir", async () => {
    world.data = trendData(); await boot({ home: "foryou" }, { topics: ["starship"] });
    expect(cards()).toHaveLength(3);
    expect($("#banner").hidden).toBe(true);
  });
  it("compte les nouveaux articles d'un sujet depuis la dernière visite", async () => {
    world.data = trendData(); await boot({ home: "foryou" }, { topics: ["starship"], topicSeen: { starship: Date.now() - 60000 } });
    expect($('[data-topic="starship"]').textContent).toContain("3 nouveaux");
    await boot({ home: "foryou" }, { topics: ["starship"], topicSeen: { starship: Date.now() + 60000 } });
    expect($('[data-topic="starship"]').textContent).not.toContain("nouveaux");
  });
});

describe("niveau de lecture dans l'interface", () => {
  const data = () => ({ ...DATA, articles: [mk(1, "fr", { title: "Un téléphone pliable", summary: "", category: "mobile" }), mk(2, "en", { title: "Kernel firmware driver and CVE-2026-1234 compiler", summary: "", category: "systems" }), mk(3, "fr", { title: "La mise à jour du navigateur", summary: "", category: "dev" })], article_sources: [] });
  it("adulte à l'aise : tout voir, sans bloc « En clair » ; les mots restent dans le détail", async () => {
    world.data = data(); await boot();
    expect(cards()).toHaveLength(3);
    expect($(".plain")).toBeNull();
    const c = cards().find((x) => x.textContent!.includes("Kernel"))!;
    click(c.querySelector("h2 button")); await vi.waitFor(() => expect(c.querySelector(".terms")).toBeTruthy());
    expect(c.querySelector(".terms")!.textContent).toContain("Noyau");
  });
  it("débutant : masque le plus technique, explique le reste, et le filtre actif se voit", async () => {
    world.data = data(); await boot({ reader: "novice" });
    expect(titles()).not.toContain("Kernel firmware driver and CVE-2026-1234 compiler");
    expect(cards()[0].querySelector(".plain")!.textContent).toContain("En clair");
    expect($("#filterBtn").textContent).toBe("Filtres (1)");
  });
  it("enfant : sujets simples seulement, définitions pour enfant", async () => {
    world.data = { ...data(), articles: [...data().articles, mk(4, "fr", { title: "Un nouveau navigateur", summary: "", category: "general" })] }; await boot({ reader: "kid" });
    expect(titles()).toContain("Un téléphone pliable");
    expect(titles()).not.toContain("Kernel firmware driver and CVE-2026-1234 compiler");
    const c = cards().find((x) => x.textContent!.includes("nouveau navigateur"))!;
    expect(c.querySelector(".plain")!.textContent).toContain("L'appli qui sert à aller sur des sites Internet.");
    await boot({ reader: "novice" });
    const n = cards().find((x) => x.textContent!.includes("nouveau navigateur"))!;
    expect(n.querySelector(".plain")!.textContent).toContain("L'application avec laquelle on visite les sites web");
  });
  it("une importance élevée en sécurité ajoute un conseil, mais pas ailleurs", async () => {
    world.data = { ...DATA, articles: [mk(1, "fr", { title: "Mise à jour urgente", category: "security", importance: "critical" }), mk(2, "fr", { title: "Un petit jeu", category: "gaming", importance: "critical" })], article_sources: [] }; await boot({ reader: "novice" });
    const [sec, game] = [cards().find((x) => x.textContent!.includes("urgente"))!, cards().find((x) => x.textContent!.includes("jeu"))!];
    expect(sec.querySelector(".plain")!.textContent).toContain("faites les mises à jour");
    expect(game.querySelector(".plain")!.textContent).not.toContain("faites les mises à jour");
  });
  it("le réglage se trouve dans les filtres et dans les réglages", async () => {
    world.data = data(); await boot();
    const s = $("#filters select") as HTMLSelectElement;
    s.value = "kid"; s.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(titles()).not.toContain("Kernel firmware driver and CVE-2026-1234 compiler"));
    expect(saved().reader).toBe("kid");
    expect(document.documentElement.dataset.reader).toBe("kid");
  });
});

describe("changer d'appareil", () => {
  const openSettings = async (settings: any = {}, st: any = {}) => { await boot(settings, st); tab("settings"); await vi.waitFor(() => expect($("#list").textContent).toContain("Changer d'appareil")); };
  const paste = async (text: string) => {
    const ta = document.querySelector("#list textarea") as HTMLTextAreaElement; ta.value = text;
    click([...document.querySelectorAll("#list button")].find((b) => b.textContent === "Importer le code collé"));
    await idle(60);
  };
  const exported = async () => {
    let txt = ""; vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { clipboard: { writeText: async (v: string) => { txt = v; } } }));
    click([...document.querySelectorAll("#list button")].find((b) => b.textContent === "Copier le code d'export"));
    await vi.waitFor(() => expect(txt).not.toBe(""));
    vi.unstubAllGlobals(); return JSON.parse(txt);
  };
  it("l'export contient réglages et données, sans l'accord de téléchargement du modèle", async () => {
    await openSettings({ theme: "dark", reader: "novice", muted: ["Source FR"], modelOk: true }, { cats: ["ai"], topics: ["rust"], fav: {}, read: { "0a1": 1 } });
    const x = await exported();
    expect(x).toMatchObject({ app: "techinfo", version: 1, settings: { theme: "dark", reader: "novice", muted: ["Source FR"] }, data: { cats: ["ai"], topics: ["rust"], read: { "0a1": 1 } } });
    expect(x.settings.modelOk).toBeUndefined();
    expect(x.settings.onboarded).toBeUndefined();
  });
  it("le fichier est proposé au téléchargement", async () => {
    await openSettings();
    (URL as any).createObjectURL = vi.fn(() => "blob:x"); (URL as any).revokeObjectURL = vi.fn();
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { expect(this.getAttribute("download")).toMatch(/^techinfo-reglages-\d{4}-\d{2}-\d{2}\.json$/); });
    click([...document.querySelectorAll("#list button")].find((b) => b.textContent === "Exporter dans un fichier"));
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    spy.mockRestore();
  });
  it("aller-retour : tout revient sur l'autre appareil, sans perdre ce qui s'y trouvait", async () => {
    const fav = { id: "0a1", url: "https://x.example/1", title: "Gardé", source_name: "S", published_at: null };
    await openSettings({ theme: "dark", reader: "kid", size: "l" }, { cats: ["ai"], topics: ["rust"], fav: { "0a1": fav }, read: { "0a2": 1 }, days: { "2026-10-20": { read: 2, stories: 0, cats: { ai: 2 } } }, best: 4 });
    const x = await exported();
    await openSettings({ theme: "light" }, { cats: ["web"], topics: ["go"], read: { "0a3": 1 } });
    await paste(JSON.stringify(x));
    expect($("#status").textContent).toBe("Import terminé.");
    expect(saved()).toMatchObject({ theme: "dark", reader: "kid", size: "l" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    const st = JSON.parse(localStorage.getItem("techinfo:v1")!);
    expect(st.cats.sort()).toEqual(["ai", "web"]);
    expect(st.topics.sort()).toEqual(["go", "rust"]);
    expect(st.read).toEqual({ "0a2": 1, "0a3": 1 });
    expect(st.fav["0a1"].title).toBe("Gardé");
    expect(st.days["2026-10-20"].read).toBe(2);
    expect(st.best).toBe(4);
  });
  it("refuse ce qui n'est pas un export, sans rien changer", async () => {
    await openSettings({ theme: "light" }, { cats: ["web"] });
    for (const bad of ["pas du json", "[]", "null", '{"app":"autre","version":1,"settings":{},"data":{}}', '{"app":"techinfo","version":2,"settings":{},"data":{}}', '{"app":"techinfo","version":1,"settings":[],"data":{}}']) {
      await paste(bad);
      expect($("#status").textContent).toBe("Ce fichier n'est pas un export TechInfo valide.");
      expect(saved().theme).toBe("light");
    }
  });
  it("un export trafiqué ne peut pas injecter de clés, de valeurs ni de liens dangereux", async () => {
    await openSettings({ theme: "light" }, {});
    await paste(JSON.stringify({ app: "techinfo", version: 1, settings: { theme: "<img>", evil: 1, size: "xxl", muted: "x", modelOk: true }, data: { fav: { "0a1": { id: "0a1", url: "javascript:alert(1)", title: "x" }, "../x": { id: "y", url: "https://a.b", title: "t" } }, read: { "<x>": 1, "0a4": 1 }, cats: ["inconnue", "ai"], topics: [3, "Rust"], days: { "pas-une-date": { read: 3 }, "2026-10-21": { read: -5, cats: { ai: "x" }, quiz: "non" } }, opened: "x" } }));
    const s = saved(), st = JSON.parse(localStorage.getItem("techinfo:v1")!);
    expect(s.theme).toBe("auto"); expect(s.size).toBe("m"); expect(s.muted).toEqual([]); expect(s.evil).toBeUndefined(); expect(s.modelOk).toBe(false);
    expect(st.fav).toEqual({}); expect(st.read).toEqual({ "0a4": 1 }); expect(st.cats).toEqual(["ai"]); expect(st.topics).toEqual(["rust"]);
    expect(Object.keys(st.days)).toEqual(["2026-10-21"]); expect(st.days["2026-10-21"]).toEqual({ read: 0, stories: 0, cats: {} });
  });
  it("une ancienne catégorie favorite est convertie au démarrage", async () => {
    await boot({}, { cats: ["industry", "space", "ai"] });
    tab("settings"); await vi.waitFor(() => expect($("#list").textContent).toContain("Mes catégories favorites"));
    expect(checkbox("Actu tech").checked).toBe(true);
    expect(checkbox("Science et espace").checked).toBe(true);
    expect(checkbox("IA").checked).toBe(true);
  });
});
