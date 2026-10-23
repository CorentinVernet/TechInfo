import { createHash } from "node:crypto";
import { parseFeed } from "../src/core/feed";
import { parseDate } from "../src/core/dates";
import { normalizeUrl } from "../src/core/url";
import { normTitle, summarize, stripHtml, extractTechLinks } from "../src/core/text";
import { findGroup, type Known, type DedupeOpts } from "../src/core/dedupe";
import { rank, type RankConfig } from "../src/core/rank";
import { q } from "./sql";

export interface SourceRow { id: number; name: string; feed_url: string; lang: string; categories: string[]; reliability: number; official: boolean; security: boolean; fail_count: number; last_attempt_at: string | null }
export interface Deps { fetchText: (url: string) => Promise<string>; now: Date; knownUrls: Set<string>; known: Known[]; cfg: RankConfig; dedupe: DedupeOpts; retentionDays: number }
export interface SourceResult { id: number; ok: boolean; paused?: boolean; fetched: number; added: number; skipped: number; duplicates: number; error?: string }

/** Une source qui échoue n'arrête jamais les autres. Retourne le SQL à appliquer (idempotent) et les résultats par source. */
export async function collectSources(sources: SourceRow[], d: Deps): Promise<{ statements: string[]; results: SourceResult[] }> {
  const statements: string[] = [], results: SourceResult[] = [];
  const nowIso = d.now.toISOString(), cutoff = d.now.getTime() - d.retentionDays * 864e5;
  for (const s of sources) {
    const r: SourceResult = { id: s.id, ok: false, fetched: 0, added: 0, skipped: 0, duplicates: 0 };
    results.push(r);
    if (s.fail_count >= 5 && s.last_attempt_at && d.now.getTime() - Date.parse(s.last_attempt_at) < 6 * 36e5) { r.paused = true; r.error = "en pause (échecs répétés)"; continue; }
    try {
      const items = parseFeed(await d.fetchText(s.feed_url));
      r.fetched = items.length;
      for (const it of items) {
        const pub = parseDate(it.published, d.now), upd = parseDate(it.updated, d.now);
        if (pub && Date.parse(pub) < cutoff) { r.skipped++; continue; }
        const urlNorm = normalizeUrl(it.link);
        if (!urlNorm) { r.skipped++; continue; }
        const keys = [urlNorm, normalizeUrl(it.guid)].filter(Boolean) as string[];
        if (keys.some((k) => d.knownUrls.has(k))) { r.duplicates++; continue; }
        keys.forEach((k) => d.knownUrls.add(k));
        const ts = Date.parse(pub ?? nowIso), titleNorm = normTitle(it.title);
        const category = /\bCVE-\d{4}-\d+/i.test(it.title) ? "security" : (s.categories[0] ?? "other");
        const link = (key: string) => `INSERT OR IGNORE INTO article_sources(article_id,source_id,url,url_norm,published_at,collected_at) VALUES((SELECT id FROM articles WHERE key=${q(key)}),${s.id},${q(it.link)},${q(urlNorm)},${q(pub)},${q(nowIso)});`;
        const grp = findGroup(titleNorm, category, ts, d.known, d.dedupe);
        if (grp) {
          statements.push(link(grp.key));
          if (s.official) statements.push(`UPDATE articles SET source_id=${s.id},url=${q(it.link)},official=1 WHERE key=${q(grp.key)} AND official=0;`);
          r.duplicates++;
          continue;
        }
        const key = createHash("sha1").update(urlNorm).digest("hex");
        const rk = rank({ title: it.title, description: stripHtml(it.description ?? ""), publishedAt: pub, collectedAt: nowIso, reliability: s.reliability, official: s.official, securityFeed: s.security, category, sourceName: s.name }, d.cfg, [], d.now);
        const sm = summarize(it.title, it.description);
        statements.push(`INSERT OR IGNORE INTO articles(key,title,title_norm,desc_norm,url,source_id,category,lang,official,published_at,updated_at,collected_at,sort_ts,summary,summary_limited,importance,score,reasons,cvss,cvss_source,links) VALUES(${[key, it.title, titleNorm, normTitle(stripHtml(it.description ?? "")).slice(0, 600), it.link].map(q).join(",")},${s.id},${q(category)},${q(s.lang)},${s.official ? 1 : 0},${q(pub)},${q(upd)},${q(nowIso)},${q(pub ?? nowIso)},${q(sm.text)},${sm.limited ? 1 : 0},${q(rk.level)},${rk.score},${q(JSON.stringify(rk.reasons))},${q(rk.cvss?.score ?? null)},${q(rk.cvss?.source ?? null)},${q(JSON.stringify(extractTechLinks(it.description ?? "", it.title)))});`);
        statements.push(link(key));
        d.known.push({ key, titleNorm, category, ts });
        r.added++;
      }
      r.ok = true;
    } catch (e) {
      r.error = (e instanceof Error ? e.message : "erreur inconnue").slice(0, 200);
    }
  }
  return { statements, results };
}
