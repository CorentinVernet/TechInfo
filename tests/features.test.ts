import { describe, it, expect, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFeed, safeImage } from "../src/core/feed";
import { classify, migrateCategory, CATEGORIES } from "../src/core/categories";
import { iconCandidates, logoPath, sniffImage, updateLogos } from "../collector/logos";
import { collectSources, type SourceRow } from "../collector/collect";
import { exportState, restoreState } from "../collector/site";
import { defaultConfig } from "../src/core/rank";
import { memDb } from "./helpers";
// @ts-ignore module JS du navigateur
import { analyze, dailyQuiz, norm, matchesTopic, streak, suits, topicsOf, trending, weekly, wordOfDay } from "../web/insights.js";
// @ts-ignore module JS du navigateur
import { areNear, GLOSSARY, poolFor, termText } from "../web/glossary.js";
// @ts-ignore module JS du navigateur
import { CAT_KEYS, migrateCats, t } from "../web/i18n.js";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).buffer;
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').buffer;

describe("images des articles", () => {
  const feed = (item: string) => `<rss xmlns:media="m"><channel><item><title>Titre</title><link>https://a.example/1</link>${item}</item></channel></rss>`;
  it("lit les balises média, les pièces jointes et le HTML de l'article", () => {
    expect(parseFeed(feed('<media:thumbnail url="https://i.example/a.jpg"/>'))[0].image).toBe("https://i.example/a.jpg");
    expect(parseFeed(feed('<media:content url="https://i.example/b.jpg" medium="image"/>'))[0].image).toBe("https://i.example/b.jpg");
    expect(parseFeed(feed('<enclosure url="https://i.example/c.png" type="image/png"/>'))[0].image).toBe("https://i.example/c.png");
    expect(parseFeed(feed('<description><![CDATA[<p><img src="https://i.example/d.webp"></p>]]></description>'))[0].image).toBe("https://i.example/d.webp");
  });
  it("refuse http, les pixels de suivi et les images de 1 pixel ; un article sans image reste valide", () => {
    expect(safeImage("http://i.example/a.jpg")).toBeUndefined();
    expect(safeImage("javascript:alert(1)")).toBeUndefined();
    expect(safeImage("https://feeds.feedburner.com/~r/x/pixel.gif")).toBeUndefined();
    expect(parseFeed(feed('<description><![CDATA[<img src="https://i.example/t.gif" width="1" height="1">]]></description>'))[0].image).toBeUndefined();
    expect(parseFeed(feed(""))[0].image).toBeUndefined();
  });
  it("traverse la collecte, l'export et la restauration", async () => {
    const src: SourceRow = { id: 1, name: "Src A", feed_url: "https://a.example/feed", lang: "en", categories: ["dev"], reliability: 4, official: false, security: false, fail_count: 0, last_attempt_at: null };
    const now = new Date("2026-10-22T10:00:00Z"), xml = feed('<media:thumbnail url="https://i.example/a.jpg"/><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate>');
    const db = memDb(), { statements } = await collectSources([src], { now, knownUrls: new Set(), known: [], cfg: defaultConfig, dedupe: { similarity: 0.75, windowHours: 48, minTokens: 4 }, retentionDays: 7, fetchText: async () => xml });
    db.exec(statements.join("\n"));
    const st = exportState(db, now, { includeSummary: true, summaryMaxChars: 280 });
    expect(st.articles[0].image).toBe("https://i.example/a.jpg");
    const db2 = memDb(); restoreState(db2, st);
    expect(exportState(db2, now, { includeSummary: true, summaryMaxChars: 280 }).articles[0].image).toBe("https://i.example/a.jpg");
  });
});

describe("logos des sources", () => {
  const dir = () => mkdtempSync(join(tmpdir(), "logos-"));
  const deps = (over: any = {}) => ({ now: new Date("2026-10-22T10:00:00Z"), fetchText: vi.fn(async () => '<link rel="icon" href="/i.png">'), fetchBytes: vi.fn(async () => PNG), ...over });
  it("reconnaît le vrai type du fichier, et refuse le SVG et le HTML", () => {
    expect(sniffImage(new Uint8Array(PNG))).toBe("png");
    expect(sniffImage(new Uint8Array(SVG))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<!doctype html>"))).toBeNull();
  });
  it("préfère l'icône la plus nette, ignore le SVG et finit par /favicon.ico", () => {
    const html = '<link rel="icon" sizes="16x16" href="/s.png"><link rel="icon" sizes="32x32" href="/m.png"><link rel="apple-touch-icon" href="/big.png"><link rel="icon" href="/v.svg">';
    expect(iconCandidates(html, "https://a.example/")).toEqual(["https://a.example/big.png", "https://a.example/m.png", "https://a.example/s.png", "https://a.example/favicon.ico"]);
  });
  it("une source connue n'est jamais retéléchargée ; deux flux d'un même site partagent un logo", async () => {
    const d = dir(), first = deps();
    const index = await updateLogos(["https://a.example/x", "https://a.example/y"], d, {}, first);
    expect(first.fetchBytes).toHaveBeenCalledTimes(1);
    expect(existsSync(join(d, index["a.example"].file!))).toBe(true);
    const again = deps();
    expect(await updateLogos(["https://a.example/x"], d, index, again)).toEqual(index);
    expect(again.fetchText).not.toHaveBeenCalled();
    expect(logoPath(index, "https://a.example/z")).toBe(`data/logos/${index["a.example"].file}`);
  });
  it("un logo disparu du dossier est repris", async () => {
    const d = dir(), again = deps();
    await updateLogos(["https://a.example/"], d, { "a.example": { file: "absent.png" } }, again);
    expect(again.fetchBytes).toHaveBeenCalled();
  });
  it("un échec est mémorisé et retenté seulement après 7 jours ; le SVG ne s'écrit jamais", async () => {
    const d = dir(), svg = deps({ fetchBytes: vi.fn(async () => SVG) });
    const index = await updateLogos(["https://a.example/"], d, {}, svg);
    expect(index["a.example"].file).toBeUndefined();
    expect(readdirSync(d)).toEqual([]);
    const soon = deps({ now: new Date("2026-10-25T10:00:00Z") });
    await updateLogos(["https://a.example/"], d, index, soon);
    expect(soon.fetchText).not.toHaveBeenCalled();
    const later = deps({ now: new Date("2026-10-30T10:00:00Z") });
    expect((await updateLogos(["https://a.example/"], d, index, later))["a.example"].file).toBeTruthy();
  });
  it("un site qui refuse sa page d'accueil garde sa chance avec /favicon.ico", async () => {
    const d = dir(), o = deps({ fetchText: vi.fn(async () => { throw new Error("HTTP 403"); }) });
    expect((await updateLogos(["https://a.example/"], d, {}, o))["a.example"].file).toBeTruthy();
    expect(o.fetchBytes).toHaveBeenCalledWith("https://a.example/favicon.ico");
  });
});

describe("catégories", () => {
  it("le serveur et l'interface ont la même liste, sans « industrie »", () => {
    expect([...CATEGORIES]).toEqual(CAT_KEYS);
    expect(CAT_KEYS).not.toContain("industry");
  });
  it("chaque catégorie de sources.json existe, et toutes ont au moins une source", () => {
    const used = new Set(JSON.parse(readFileSync("config/sources.json", "utf8")).flatMap((s: any) => s.categories));
    for (const c of used) expect(CAT_KEYS).toContain(c);
    for (const c of CAT_KEYS) expect(used.has(c), c).toBe(true);
  });
  it("range les articles des sources généralistes d'après le titre, à défaut « general »", () => {
    expect(classify("Une faille critique dans le routeur", "general")).toBe("security");
    expect(classify("OpenAI dévoile un nouveau modèle", "general")).toBe("ai");
    expect(classify("L'IA envahit les bureaux", "general")).toBe("ai");
    expect(classify("Le nouvel iPhone est là", "general")).toBe("mobile");
    expect(classify("La météo de la semaine", "general")).toBe("general");
  });
  it("ne se trompe pas sur les morceaux de mots et les minuscules", () => {
    expect(classify("L'intelligence collective en question", "general")).toBe("general"); // pas « Intel »
    expect(classify("Une aide pour tous", "general")).toBe("general"); // pas « IA » ni « AI »
  });
  it("ne touche pas aux sources spécialisées", () => {
    expect(classify("OpenAI dévoile un modèle", "gaming")).toBe("gaming");
  });
  it("reprend les anciennes catégories de l'état publié et des préférences", () => {
    expect(migrateCategory("Le nouvel iPhone", "industry")).toBe("mobile");
    expect(migrateCategory("Sans rapport", "industry")).toBe("general");
    expect(migrateCategory("Sans rapport", "bigtech-mobile")).toBe("mobile");
    expect(migrateCategory("Lancement", "space")).toBe("science");
    expect(migrateCategory("Sans rapport", "dev")).toBe("dev");
    expect(migrateCats(["industry", "space", "ai", "ai", "inconnue", 3])).toEqual(["general", "science", "ai"]);
  });
});

describe("niveau de lecture", () => {
  const art = (title: string, category = "general", summary = "") => ({ title, summary, category });
  it("classe selon le jargon et la catégorie", () => {
    expect(analyze(art("Un nouveau téléphone pliable", "mobile")).level).toBe("easy");
    expect(analyze(art("Remote code execution in the Linux kernel, CVE-2026-1234", "systems")).level).toBe("hard");
    expect(analyze(art("Mise à jour du système", "dev")).level).not.toBe("hard");
  });
  it("trouve les termes en mots entiers, avec ou sans accents", () => {
    expect(analyze(art("Le rançongiciel frappe encore")).terms).toContain("ransomware");
    expect(analyze(art("Ne pas confondre avec une aide")).terms).not.toContain("ai");
  });
  it("le mode enfant écarte le technique, la sécurité et les sujets sensibles ; le mode adulte voit tout", () => {
    const hard = analyze(art("Kernel driver firmware update", "systems")), scam = analyze(art("Une arnaque aux cryptos")), war = analyze(art("La guerre des drones")), sec = analyze(art("Un conseil simple", "security")), nice = analyze(art("La NASA photographie Jupiter", "science"));
    for (const r of [hard, scam, war, sec]) expect(suits(r, "kid")).toBe(false);
    expect(suits(nice, "kid")).toBe(true);
    expect(suits(hard, "novice")).toBe(false);
    for (const r of [hard, scam, war, sec]) expect(suits(r, "expert")).toBe(true);
  });
  it("« mardi » en anglais n'est pas un sujet sensible", () => {
    expect(analyze(art("Fedora ships next Tuesday")).sensitive).toBe(false);
  });
});

describe("glossaire", () => {
  it("chaque terme a son mot, sa définition adulte et sa définition enfant dans les deux langues", () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(50);
    expect(new Set(GLOSSARY.map((g: any) => g.id)).size).toBe(GLOSSARY.length);
    for (const g of GLOSSARY) for (const l of ["fr", "en"]) { expect(g[l], `${g.id} ${l}`).toHaveLength(4); for (const x of g[l]) expect(x.length).toBeGreaterThan(1); }
  });
  it("donne la définition adaptée au lecteur", () => {
    const g = GLOSSARY[0];
    expect(termText(g, "fr", "kid").def).toBe(g.fr[2]);
    expect(termText(g, "fr", "novice").def).toBe(g.fr[3]);
    expect(termText(g, "en", "expert").def).toBe(g.en[1]);
  });
  it("chaque catégorie a son explication « En clair » dans les deux langues", () => {
    for (const c of CAT_KEYS) for (const l of ["fr", "en"]) expect(t(l, `plain_${c}`)).not.toBe(`plain_${c}`);
  });
});

describe("qualité des fiches et du quiz", () => {
  const words = (s: string) => norm(s).split(" ").filter((w: string) => w.length >= 3);
  const LEVELS: [string, number, number][] = [["expert", 1, 135], ["kid", 2, 100], ["novice", 3, 135]];
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
  const byId = new Map(GLOSSARY.map((g: any) => [g.id, g]));
  it("une définition ne contient jamais le terme, et n'est jamais en double", () => {
    for (const l of ["fr", "en"]) for (const [, i] of LEVELS) {
      const seen = new Set<string>();
      for (const g of GLOSSARY) {
        const defWords = words(g[l][i]);
        for (const w of words(g[l][0])) expect(defWords, `${g.id} ${l} ${i}`).not.toContain(w);
        expect(seen.has(g[l][i]), `${g.id} ${l} ${i}`).toBe(false); seen.add(g[l][i]);
      }
    }
  });
  it("les définitions restent courtes, et chaque niveau a la sienne", () => {
    for (const l of ["fr", "en"]) for (const g of GLOSSARY) {
      for (const [, i, max] of LEVELS) expect(g[l][i].length, `${g.id} ${l} ${i}`).toBeLessThanOrEqual(max);
      expect(g[l][3], `${g.id} ${l}`).not.toBe(g[l][1]);
      expect(g[l][3], `${g.id} ${l}`).not.toBe(g[l][2]);
    }
  });
  it("débutant et enfant n'ont pas besoin de jargon pour comprendre", () => {
    const JARGON = /silicium|instructions|ressources|normalis|plateforme|conteneur|serveur|\b(?:du|le|the) code\b|chiffrement|chiffré|processeur|\bpuce|orbite|\bservers?\b|encrypt|\bprocessor|\bplatform/i;
    for (const l of ["fr", "en"]) for (const g of GLOSSARY) for (const i of [2, 3]) {
      expect(g[l][i], `${g.id} ${l} ${i}`).not.toMatch(JARGON);
    }
  });
  it("les niveaux débutant et enfant n'interrogent pas sur les termes trop techniques", () => {
    expect(poolFor("expert")).toHaveLength(GLOSSARY.length);
    expect(poolFor("kid").map((g: any) => g.id)).not.toContain("cve");
    expect(poolFor("novice").map((g: any) => g.id)).not.toContain("kernel");
    expect(poolFor("kid").length).toBeGreaterThanOrEqual(20);
    for (const r of ["kid", "novice"]) for (let n = 0; n < 365; n++) {
      const pool = poolFor(r), ids = pool.map((g: any) => g.id);
      expect(ids).toContain(wordOfDay(day(n), pool).id);
      for (const q of dailyQuiz(day(n), 5, pool)) expect(ids).toEqual(expect.arrayContaining(q.options));
    }
  });
  for (const [reader, col] of [["expert", 1], ["kid", 2], ["novice", 3]] as [string, number][]) {
    it(`sur un an, niveau ${reader} : position et longueur ne trahissent pas la réponse, aucune question ambiguë`, () => {
      const pool = poolFor(reader), pos = [0, 0, 0, 0]; let total = 0, longest = 0, defs = 0, sameFamily = 0;
      for (let n = 0; n < 365; n++) for (const q of dailyQuiz(day(n), 5, pool)) {
        total++; pos[q.correct]++;
        expect(new Set(q.options).size).toBe(4);
        for (const o of q.options) if (o !== q.id) expect(areNear(o, q.id), `${q.id}/${o}`).toBe(false);
        if (q.options.some((o: string) => o !== q.id && (byId.get(o) as any).f === (byId.get(q.id) as any).f)) sameFamily++;
        if (q.kind === "def") { defs++; const lens = q.options.map((id: string) => (byId.get(id) as any).fr[col].length); if (lens[q.correct] === Math.max(...lens)) longest++; }
      }
      for (const p of pos) { expect(p / total).toBeGreaterThan(0.2); expect(p / total).toBeLessThan(0.3); }
      expect(longest / defs).toBeLessThan(0.36);
      expect(sameFamily / total).toBeGreaterThan(0.8);
    });
  }
  it("le pronom « j'ai » ne déclenche pas le terme IA ; le sigle, si", () => {
    expect(analyze({ title: "J'ai testé ce téléphone et j'ai aimé", summary: "", category: "mobile" }).terms).not.toContain("ai");
    expect(analyze({ title: "L'IA arrive au bureau", summary: "", category: "general" }).terms).toContain("ai");
    expect(analyze({ title: "New AI model", summary: "", category: "general" }).terms).toContain("ai");
    expect(analyze({ title: "Une aide bienvenue", summary: "", category: "general" }).terms).not.toContain("ai");
  });
});

describe("mot du jour et quiz", () => {
  it("le même jour donne le même mot, et tout le glossaire passe avant une répétition", () => {
    expect(wordOfDay("2026-10-30").id).toBe(wordOfDay("2026-10-30").id);
    const start = Date.UTC(2026, 0, 1) / 864e5, n = GLOSSARY.length, base = start - (start % n);
    const ids = Array.from({ length: n }, (_, i) => wordOfDay(new Date((base + i) * 864e5).toISOString().slice(0, 10)).id);
    expect(new Set(ids).size).toBe(n);
  });
  it("le quiz est stable sur la journée, varie le lendemain, et chaque question est valide", () => {
    const q = dailyQuiz("2026-10-30");
    expect(dailyQuiz("2026-10-30")).toEqual(q);
    expect(dailyQuiz("2026-10-31")).not.toEqual(q);
    expect(q).toHaveLength(5);
    expect(new Set(q.map((x: any) => x.id)).size).toBe(5);
    for (const x of q) {
      expect(new Set(x.options).size).toBe(4);
      expect(x.options[x.correct]).toBe(x.id);
    }
    expect(q.map((x: any) => x.id)).not.toContain(wordOfDay("2026-10-30").id);
  });
});

describe("série et bilan", () => {
  const d = (read = 1) => ({ read, stories: 0, cats: {} });
  it("compte les jours consécutifs ; aujourd'hui sans activité ne casse pas encore la série", () => {
    expect(streak({}, "2026-10-30")).toBe(0);
    expect(streak({ "2026-10-30": d(), "2026-10-29": d(), "2026-10-27": d() }, "2026-10-30")).toBe(2);
    expect(streak({ "2026-10-29": d(), "2026-10-28": d() }, "2026-10-30")).toBe(2);
    expect(streak({ "2026-10-28": d() }, "2026-10-30")).toBe(0);
  });
  it("traverse les changements de mois et d'heure", () => {
    expect(streak({ "2026-11-01": d(), "2026-10-31": d(), "2026-10-30": d(), "2026-10-25": d() }, "2026-11-01")).toBe(3);
    expect(streak({ "2026-10-26": d(), "2026-10-25": d(), "2026-10-24": d() }, "2026-10-26")).toBe(3); // passage à l'heure d'hiver en France
  });
  it("une série continue avec les stories ou le quiz seuls, pas avec un jour vide", () => {
    expect(streak({ "2026-10-30": { read: 0, stories: 1, cats: {} }, "2026-10-29": { read: 0, stories: 0, cats: {}, quiz: [3, 5] }, "2026-10-28": { read: 0, stories: 0, cats: {} } }, "2026-10-30")).toBe(2);
  });
  it("le bilan additionne 7 jours et compare aux 7 précédents", () => {
    const w = weekly({ "2026-10-30": { read: 3, stories: 1, cats: { ai: 2, dev: 1 }, quiz: [4, 5] }, "2026-10-24": { read: 2, stories: 0, cats: { ai: 2 } }, "2026-10-23": { read: 9, stories: 0, cats: { web: 9 } } }, "2026-10-30");
    expect(w).toMatchObject({ read: 5, previous: 9, activeDays: 2, stories: 1, quizDone: 1, quizScore: 4, quizTotal: 5 });
    expect(w.topCats).toEqual([{ category: "ai", count: 4 }, { category: "dev", count: 1 }]);
  });
});

describe("« Ça monte » et sujets", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  const art = (title: string, hoursAgo: number, source_id = 1) => ({ title, source_id, sort_ts: new Date(now - hoursAgo * 36e5).toISOString() });
  it("repère noms propres, sigles et expressions, pas les mots courants", () => {
    const c = topicsOf("Comment la NASA teste Starship avec Black Friday");
    expect(c.has("nasa")).toBe(true); expect(c.has("starship")).toBe(true); expect(c.has("black friday")).toBe(true);
    expect(c.has("comment")).toBe(false); expect(c.has("teste")).toBe(false);
  });
  it("un sujet monte s'il dépasse son rythme habituel dans au moins 2 sources", () => {
    const list = [art("Sortie de Zig", 2, 1), art("Tout sur Zig", 3, 2), art("Encore Zig", 5, 3), art("Avis sur Rust", 2, 1), art("Encore Rust", 3, 2), art("Toujours Rust", 4, 3), ...Array.from({ length: 30 }, (_, i) => art(`Le point Rust ${i}`, 30 + i * 3, 1)), art("Vu sur Solo", 1, 1), art("Revu sur Solo", 2, 1), art("Encore Solo", 3, 1)];
    const topics = trending(list, now).map((x: any) => x.topic);
    expect(topics).toContain("zig");
    expect(topics).not.toContain("rust");  // déjà très cité les jours d'avant
    expect(topics).not.toContain("solo");  // une seule source
  });
  it("une expression remplace ses mots quand elle explique l'essentiel de leurs citations", () => {
    const list = [1, 2, 3, 4].map((i) => art(`Offres du Black Friday numéro ${i}`, i, i));
    const topics = trending(list, now).map((x: any) => x.topic);
    expect(topics).toContain("black friday");
    expect(topics).not.toContain("friday");
  });
  it("ignore les articles de plus de 7 jours ou datés dans le futur", () => {
    expect(trending([art("Sortie de Zig", 24 * 8, 1), art("Tout sur Zig", 24 * 9, 2), art("Encore Zig", -5, 3)], now)).toEqual([]);
  });
  it("un sujet suivi cherche un mot entier", () => {
    expect(matchesTopic("rust 1 90 est sorti", "Rust")).toBe(true);
    expect(matchesTopic("zero trust security", "rust")).toBe(false);
    expect(matchesTopic("le black friday arrive", "Black Friday")).toBe(true);
  });
});
