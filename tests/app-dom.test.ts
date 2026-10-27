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
    click($("#chips [data-cat=space]"));
    await vi.waitFor(() => expect($("#banner").textContent).toContain("No source feeds “Space” yet."));
  });
});
