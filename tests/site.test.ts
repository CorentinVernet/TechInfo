import { describe, it, expect } from "vitest";
import { collectSources, type Deps, type SourceRow } from "../collector/collect";
import { exportState, restoreState } from "../collector/site";
import { defaultConfig } from "../src/core/rank";
import { memDb } from "./helpers";

const now = new Date("2026-10-22T10:00:00Z");
const src: SourceRow = { id: 1, name: "Src A", feed_url: "https://a.example/feed", lang: "en", categories: ["dev"], reliability: 4, official: false, security: false, fail_count: 0, last_attempt_at: null };
const xml = `<rss><channel><item><title>Nouvelle version majeure de Node en ligne</title><link>https://a.example/n</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate><description>Une description suffisamment longue pour produire un résumé. Et une seconde phrase tout aussi utile pour tester la coupe.</description></item></channel></rss>`;
const deps = (knownUrls = new Set<string>(), known: Deps["known"] = []): Deps => ({ now, knownUrls, known, cfg: defaultConfig, dedupe: { similarity: 0.75, windowHours: 48, minTokens: 4 }, retentionDays: 7, fetchText: async () => xml });
async function seeded() { const db = memDb(); const { statements } = await collectSources([src], deps()); db.exec(statements.join("\n")); return db; }

describe("fichier public", () => {
  it("ne publie aucun résumé par défaut, et le tronque si activé", async () => {
    const db = await seeded();
    expect(exportState(db, now, { includeSummary: false, summaryMaxChars: 200 }).articles[0].summary).toBe("");
    const s = exportState(db, now, { includeSummary: true, summaryMaxChars: 40 }).articles[0].summary;
    expect(s.length).toBeLessThanOrEqual(41);
    expect(s.endsWith("…")).toBe(true);
  });
  it("n'expose ni texte de description complet ni champs internes", async () => {
    const json = JSON.stringify(exportState(await seeded(), now, { includeSummary: false, summaryMaxChars: 200 }));
    expect(json).not.toContain("desc_norm");
    expect(json).not.toContain("title_norm");
    expect(json).not.toContain("seconde phrase");
  });
});
describe("état entre deux exécutions", () => {
  it("restaure l'historique et ne recrée pas les articles déjà vus", async () => {
    const st = exportState(await seeded(), now, { includeSummary: false, summaryMaxChars: 200 });
    expect(st.articles).toHaveLength(1);
    const db2 = memDb(); restoreState(db2, st);
    const row = db2.prepare("SELECT key,title_norm FROM articles").get() as any;
    expect(row.title_norm).toBe("nouvelle version majeure de node en ligne");
    const knownUrls = new Set((db2.prepare("SELECT url_norm FROM article_sources").all() as any[]).map((r) => r.url_norm));
    const known = [{ key: row.key, titleNorm: row.title_norm, category: "dev", ts: Date.parse("2026-10-21T10:00:00Z") }];
    const { statements, results } = await collectSources([src], deps(knownUrls, known));
    expect(results[0].added).toBe(0);
    db2.exec(statements.join("\n"));
    expect(db2.prepare("SELECT COUNT(*) c FROM articles").get()).toEqual({ c: 1 });
  });
  it("garde les mêmes clés d'articles après restauration (favoris stables côté navigateur)", async () => {
    const st = exportState(await seeded(), now, { includeSummary: false, summaryMaxChars: 200 });
    const db2 = memDb(); restoreState(db2, st);
    expect(exportState(db2, now, { includeSummary: false, summaryMaxChars: 200 }).articles[0].key).toBe(st.articles[0].key);
  });
});
