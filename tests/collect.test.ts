import { describe, it, expect } from "vitest";
import { collectSources, type SourceRow, type Deps } from "../collector/collect";
import { purgeSql } from "../collector/purge";
import { fetchText } from "../collector/safefetch";
import { defaultConfig } from "../src/core/rank";
import { memDb } from "./helpers";
import { repairEntities } from "../collector/jobs";
import { sqliteSql } from "../collector/sql";

const now = new Date("2026-10-22T10:00:00Z");
const src = (id: number, name: string, extra: Partial<SourceRow> = {}): SourceRow => ({ id, name, feed_url: `https://${name}.example/feed`, lang: "en", categories: ["dev"], reliability: 4, official: false, security: false, fail_count: 0, last_attempt_at: null, ...extra });
const rss = (items: string) => `<rss version="2.0"><channel>${items}</channel></rss>`;
const item = (t: string, l: string, d = "Mon, 19 Oct 2026 10:00:00 GMT") => `<item><title>${t}</title><link>${l}</link><pubDate>${d}</pubDate><description>Un texte descriptif suffisamment long pour produire un résumé fiable.</description></item>`;
const deps = (feeds: Record<string, string | Error>): Deps => ({
  now, knownUrls: new Set(), known: [], cfg: defaultConfig, dedupe: { similarity: 0.75, windowHours: 48, minTokens: 4 }, retentionDays: 7,
  fetchText: async (u) => { const f = feeds[u]; if (f instanceof Error) throw f; if (f === undefined) throw new Error("HTTP 404"); return f; },
});

describe("collecte", () => {
  it("une source en échec n'arrête pas les autres ; l'exécution est idempotente", async () => {
    const feeds = { "https://a.example/feed": rss(item("Premier article intéressant sur Node", "https://a.example/1")), "https://b.example/feed": new Error("HTTP 500"), "https://c.example/feed": "<rss><channel><item>" };
    const sources = [src(1, "a"), src(2, "b"), src(3, "c")];
    const { statements, results } = await collectSources(sources, deps(feeds));
    expect(results.map((r) => r.ok)).toEqual([true, false, false]);
    expect(results[2].error).toContain("malformé");
    const db = memDb();
    db.exec("INSERT INTO sources(id,name,feed_url) VALUES (3,'c','https://c.example/feed')");
    db.exec(statements.join("\n")); db.exec(statements.join("\n"));
    expect(db.prepare("SELECT COUNT(*) c FROM articles").get()).toEqual({ c: 1 });
    expect(db.prepare("SELECT COUNT(*) c FROM article_sources").get()).toEqual({ c: 1 });
  });
  it("regroupe la même actualité de deux sources et privilégie la source officielle", async () => {
    const feeds = { "https://a.example/feed": rss(item("Node.js 26 est publié avec de nouvelles fonctions", "https://a.example/n26")), "https://b.example/feed": rss(item("Node.js 26 est publié avec de nouvelles fonctions", "https://b.example/n26")) };
    const { statements } = await collectSources([src(1, "a"), src(2, "b", { official: true })], deps(feeds));
    const db = memDb(); db.exec(statements.join("\n"));
    expect(db.prepare("SELECT COUNT(*) c FROM articles").get()).toEqual({ c: 1 });
    expect(db.prepare("SELECT COUNT(*) c FROM article_sources").get()).toEqual({ c: 2 });
    expect(db.prepare("SELECT source_id,official FROM articles").get()).toEqual({ source_id: 2, official: 1 });
  });
  it("ignore les articles trop anciens, garde les non datés avec la date de collecte", async () => {
    const feeds = { "https://a.example/feed": rss(item("Très ancien article de blog", "https://a.example/old", "Mon, 01 Jan 2024 10:00:00 GMT") + `<item><title>Sans date aucune</title><link>https://a.example/nodate</link></item>`) };
    const { statements, results } = await collectSources([src(1, "a")], deps(feeds));
    expect(results[0].skipped).toBe(1);
    const db = memDb(); db.exec(statements.join("\n"));
    expect(db.prepare("SELECT published_at,sort_ts,summary_limited FROM articles").get()).toEqual({ published_at: null, sort_ts: now.toISOString(), summary_limited: 1 });
  });
  it("neutralise les apostrophes (pas d'injection SQL)", async () => {
    const { statements } = await collectSources([src(1, "a")], deps({ "https://a.example/feed": rss(item("L'article'); DROP TABLE articles;--", "https://a.example/x")) }));
    const db = memDb(); db.exec(statements.join("\n"));
    expect(db.prepare("SELECT title FROM articles").get()).toEqual({ title: "L'article'); DROP TABLE articles;--" });
  });
  it("met une source en pause après 5 échecs récents", async () => {
    const { results } = await collectSources([src(1, "a", { fail_count: 5, last_attempt_at: "2026-10-22T08:00:00Z" })], deps({}));
    expect(results[0].paused).toBe(true);
  });
});
describe("catégories peu actives : jamais vides", () => {
  const day = 864e5, d = (n: number) => new Date(now.getTime() - n * day).toUTCString();
  const feed = rss(item("Article récent de la semaine", "https://slow.example/r", d(1)) + item("Ancien article numéro un sur le sujet", "https://slow.example/o1", d(20)) + item("Ancien article numéro deux sur le sujet", "https://slow.example/o2", d(25)) + item("Très vieil article oublié depuis longtemps", "https://slow.example/o3", d(60)));
  const slow = (extra: any = {}) => ({ ...deps({ "https://slow.example/feed": feed }), ...extra });
  const row = { ...src(1, "slow"), feed_url: "https://slow.example/feed" };
  it("sans règle de conservation : seuls les articles de moins de 7 jours entrent (comportement historique)", async () => {
    const { results } = await collectSources([row], slow());
    expect(results[0].added).toBe(1);
  });
  it("avec une règle de conservation : complète avec des articles plus anciens, jusqu'à N et jusqu'à l'âge maximal", async () => {
    const { results } = await collectSources([row], slow({ keepPerCategory: 3, maxAgeDays: 45 }));
    expect(results[0].added).toBe(3);        // récent + 2 anciens ; celui de 60 jours est hors limite
    const two = await collectSources([row], slow({ keepPerCategory: 2, maxAgeDays: 45, knownUrls: new Set(), known: [] }));
    expect(two.results[0].added).toBe(2);
  });
  it("ne ré-ajoute pas d'anciens articles si la catégorie a déjà assez d'articles", async () => {
    const known = Array.from({ length: 5 }, (_, i) => ({ key: `k${i}`, titleNorm: `x${i}`, category: "dev", ts: now.getTime() }));
    const { results } = await collectSources([row], slow({ keepPerCategory: 3, maxAgeDays: 45, known }));
    expect(results[0].added).toBe(1);
  });
});
describe("purge 7 jours", () => {
  it("garde les N plus récents de chaque catégorie, même anciens, jusqu'à l'âge maximal", () => {
    const db = memDb(), ago = (n: number) => new Date(now.getTime() - n * 864e5).toISOString();
    const ins = (id: number, cat: string, age: number) => db.exec(`INSERT INTO articles(id,key,title,title_norm,url,source_id,category,lang,collected_at,sort_ts,summary,importance,score) VALUES (${id},'k${id}','T${id}','t${id}','https://x/${id}',1,'${cat}','en','${ago(age)}','${ago(age)}','s','minor',1)`);
    [[1, "dev", 1], [2, "dev", 20], [3, "dev", 25], [4, "dev", 30], [5, "dev", 50], [6, "web", 30], [7, "web", 2], [8, "web", 3], [9, "web", 40]].forEach(([i, c, a]) => ins(i as number, c as string, a as number));
    db.exec(purgeSql(now, 7, 2, 45));
    expect((db.prepare("SELECT id FROM articles ORDER BY id").all() as any[]).map((r) => r.id)).toEqual([1, 2, 7, 8]);   // dev : 1 j + le plus récent des anciens ; web : 2 j et 3 j
  });
  it("sans règle (valeurs par défaut), comportement identique à avant", () => {
    const db = memDb();
    db.exec(`INSERT INTO articles(id,key,title,title_norm,url,source_id,category,lang,collected_at,sort_ts,summary,importance,score) VALUES (1,'a','T','t','u',1,'dev','en','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z','s','minor',1),(2,'b','T','t','u2',1,'dev','en','2026-10-21T00:00:00Z','2026-10-21T00:00:00Z','s','minor',1)`);
    db.exec(purgeSql(now, 7));
    expect((db.prepare("SELECT id FROM articles").all() as any[]).map((r) => r.id)).toEqual([2]);
  });
  it("archive les favoris d'un article supprimé, mais pas ceux d'un article conservé", () => {
    const db = memDb(), ago = (n: number) => new Date(now.getTime() - n * 864e5).toISOString();
    db.exec("INSERT INTO users(id,email,created_at) VALUES (1,'u@x','2026-01-01')");
    for (const [id, age] of [[1, 20], [2, 30], [3, 31]]) db.exec(`INSERT INTO articles(id,key,title,title_norm,url,source_id,category,lang,collected_at,sort_ts,summary,importance,score) VALUES (${id},'k${id}','T${id}','t${id}','https://x/${id}',1,'dev','en','${ago(age)}','${ago(age)}','s','minor',1)`);
    db.exec("INSERT INTO user_article_state(user_id,article_id,favorite) VALUES (1,1,1),(1,3,1)");
    db.exec(purgeSql(now, 7, 2, 45));
    expect((db.prepare("SELECT title FROM bookmarks").all() as any[]).map((r) => r.title)).toEqual(["T3"]);
    expect((db.prepare("SELECT id FROM articles ORDER BY id").all() as any[]).map((r) => r.id)).toEqual([1, 2]);
  });
});
describe("purge 7 jours (historique)", () => {
  it("supprime l'ancien, garde le récent et archive les favoris", () => {
    const db = memDb();
    db.exec("INSERT INTO users(id,email,created_at) VALUES (1,'u@x','2026-01-01')");
    const ins = (id: number, ts: string) => db.exec(`INSERT INTO articles(id,key,title,title_norm,url,source_id,category,lang,collected_at,sort_ts,summary,importance,score) VALUES (${id},'k${id}','T${id}','t${id}','https://x/${id}',1,'dev','en','${ts}','${ts}','s','minor',1)`);
    ins(1, "2026-10-10T00:00:00Z"); ins(2, "2026-10-10T00:00:00Z"); ins(3, "2026-10-21T00:00:00Z");
    db.exec("INSERT INTO article_sources(article_id,source_id,url,url_norm,collected_at) VALUES (1,1,'u','n1','x')");
    db.exec("INSERT INTO user_article_state(user_id,article_id,favorite) VALUES (1,1,1),(1,2,0),(1,3,1)");
    db.exec(purgeSql(now, 7));
    expect(db.prepare("SELECT id FROM articles").all()).toEqual([{ id: 3 }]);
    expect(db.prepare("SELECT title,source_name FROM bookmarks").all()).toEqual([{ title: "T1", source_name: "Src A" }]);
    expect(db.prepare("SELECT COUNT(*) c FROM article_sources").get()).toEqual({ c: 0 });
  });
});
describe("fetchText", () => {
  const sleep = async () => {};
  const res = (status: number, body = "ok", h: Record<string, string> = {}) => new Response(body, { status, headers: h });
  it("réessaie sur 500 puis réussit", async () => {
    let n = 0;
    expect(await fetchText("https://a.example/f", { sleep, fetchImpl: (async () => (++n < 3 ? res(500) : res(200, "bon"))) as any })).toBe("bon");
    expect(n).toBe(3);
  });
  it("n'insiste pas sur un 404 et refuse une redirection vers un hôte privé", async () => {
    let n = 0;
    await expect(fetchText("https://a.example/f", { sleep, fetchImpl: (async () => (n++, res(404))) as any })).rejects.toThrow("404");
    expect(n).toBe(1);
    await expect(fetchText("https://a.example/f", { sleep, retries: 1, fetchImpl: (async () => res(302, "", { location: "https://127.0.0.1/x" })) as any })).rejects.toThrow("refusée");
  });
  it("refuse une réponse trop grosse", async () => {
    await expect(fetchText("https://a.example/f", { sleep, maxBytes: 5, fetchImpl: (async () => res(200, "0123456789")) as any })).rejects.toThrow("volumineuse");
  });
});

describe("réparation des entités", () => {
  it("corrige les titres et résumés déjà stockés", () => {
    const db = memDb();
    db.exec("INSERT INTO articles(id,key,title,title_norm,url,source_id,category,lang,collected_at,sort_ts,summary,importance,score) VALUES (1,'k','Spiral&#8217;s Edge','spiral 8217 s edge','https://x/1',1,'dev','en','2026-10-22T00:00:00Z','2026-10-22T00:00:00Z','Il y a l&#8217;ours','minor',1)");
    expect(repairEntities(sqliteSql(db))).toBe(1);
    expect(db.prepare("SELECT title,title_norm,summary FROM articles").get()).toEqual({ title: "Spiral’s Edge", title_norm: "spiral s edge", summary: "Il y a l’ours" });
    expect(repairEntities(sqliteSql(db))).toBe(0);
  });
});
