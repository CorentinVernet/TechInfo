import { readFileSync } from "node:fs";
import { join } from "node:path";
import { q, type Sql } from "./sql";
import { fetchText } from "./safefetch";
import { collectSources, type SourceRow } from "./collect";
import { buildBriefing } from "./briefing";
import { purgeSql } from "./purge";
import { parseFeed } from "../src/core/feed";
import { decodeEntities, normTitle } from "../src/core/text";
import { parisDay, parisHour } from "../src/core/dates";
import { defaultConfig } from "../src/core/rank";
import { HOME } from "../src/server/paths";

const json = (p: string) => JSON.parse(readFileSync(join(HOME, p), "utf8"));
export const dedupeConfig = () => json("config/dedupe.json");

export async function collect(sql: Sql, now = new Date(), log: (m: string) => void = console.log) {
  const started = now.toISOString(), dedupe = dedupeConfig();
  if (sql.query(`SELECT COUNT(*) c FROM collect_runs WHERE kind='collect' AND status='running' AND started_at > ${q(new Date(now.getTime() - 30 * 6e4).toISOString())}`)[0]?.c > 0) { log("Collecte déjà en cours."); return; }
  sql.exec(`INSERT INTO collect_runs(kind,started_at,status) VALUES('collect',${q(started)},'running');`);
  try {
    const cfg: any[] = json("config/sources.json");
    sql.exec(cfg.map((s) => `INSERT INTO sources(name,feed_url,site_url,lang,categories,reliability,official,security) VALUES(${q(s.name)},${q(s.feed_url)},${q(s.site_url)},${q(s.lang)},${q(JSON.stringify(s.categories))},${s.reliability},${s.official ? 1 : 0},${s.security ? 1 : 0}) ON CONFLICT(feed_url) DO UPDATE SET name=excluded.name,site_url=excluded.site_url,lang=excluded.lang,categories=excluded.categories,reliability=excluded.reliability,official=excluded.official,security=excluded.security;`).join("\n"));
    const extras = new Map(cfg.map((s) => [s.feed_url, { include: s.include, exclude: s.exclude, maxPerRun: s.maxPerRun, fallback_url: s.fallback_url }]));
    const sources: SourceRow[] = sql.query(`SELECT * FROM sources WHERE enabled=1`).map((r) => ({ ...r, categories: JSON.parse(r.categories), official: !!r.official, security: !!r.security, ...extras.get(r.feed_url) }));
    const knownUrls = new Set<string>(sql.query(`SELECT url_norm FROM article_sources`).map((r) => r.url_norm));
    const known = sql.query(`SELECT key,title_norm,category,sort_ts FROM articles`).map((r) => ({ key: r.key, titleNorm: r.title_norm, category: r.category, ts: Date.parse(r.sort_ts) }));
    const { statements, results } = await collectSources(sources, { fetchText, now, knownUrls, known, cfg: defaultConfig, dedupe, retentionDays: dedupe.retentionDays, keepPerCategory: dedupe.keepPerCategory, maxAgeDays: dedupe.maxAgeDays });
    const ts = now.toISOString();
    for (const r of results) {
      const s = sources.find((x) => x.id === r.id)!;
      statements.push(r.paused ? "" : r.ok
        ? `UPDATE sources SET fail_count=0,verified=1,last_attempt_at=${q(ts)},last_success_at=${q(ts)},last_error=NULL WHERE id=${r.id};`
        : `UPDATE sources SET fail_count=${s.fail_count + 1},last_attempt_at=${q(ts)},last_error=${q(r.error)} WHERE id=${r.id};`);
    }
    const ok = results.filter((r) => r.ok).length, sum = (k: "fetched" | "added" | "skipped" | "duplicates") => results.reduce((a, r) => a + r[k], 0);
    const errors = results.filter((r) => r.error).map((r) => ({ source: sources.find((s) => s.id === r.id)!.name, error: r.error }));
    statements.push(`UPDATE collect_runs SET finished_at=${q(new Date().toISOString())},status=${ok === results.length ? "'ok'" : ok === 0 ? "'failed'" : "'partial'"},sources_total=${results.length},sources_ok=${ok},fetched=${sum("fetched")},added=${sum("added")},skipped=${sum("skipped")},duplicates=${sum("duplicates")},errors=${q(JSON.stringify(errors))} WHERE kind='collect' AND started_at=${q(started)};`);
    sql.exec(statements.join("\n"));
    log(`Collecte : ${ok}/${results.length} sources OK, ${sum("added")} ajoutés, ${sum("duplicates")} doublons.`);
    errors.forEach((e) => log(`  ! ${e.source} : ${e.error}`));
  } catch (e) {
    sql.exec(`UPDATE collect_runs SET finished_at=${q(new Date().toISOString())},status='failed',errors=${q(JSON.stringify([{ error: String((e as Error).message).slice(0, 200) }]))} WHERE kind='collect' AND started_at=${q(started)};`);
    throw e;
  }
}
export function briefing(sql: Sql, now = new Date(), force = false, log: (m: string) => void = console.log) {
  const day = parisDay(now);
  if (!force) {
    const h = parisHour(now);
    if (h < 7 || h >= 10) return;
    if (sql.query(`SELECT 1 x FROM briefings WHERE day=${q(day)}`).length) return;
  }
  const rows = sql.query(`SELECT id,title,category,importance,score FROM articles WHERE sort_ts >= ${q(new Date(now.getTime() - 864e5).toISOString())}`);
  const b = buildBriefing(rows);
  sql.exec(`INSERT OR REPLACE INTO briefings(day,generated_at,summary,article_ids,topics) VALUES(${q(day)},${q(now.toISOString())},${q(b.summary)},${q(JSON.stringify(b.ids))},${q(JSON.stringify(b.topics))});`);
  log(`Briefing ${day} : ${b.ids.length} articles.`);
}
export function purge(sql: Sql, now = new Date()) { const c = dedupeConfig(); sql.exec(purgeSql(now, c.retentionDays, c.keepPerCategory, c.maxAgeDays)); }
export async function verify(log: (m: string) => void = console.log) {
  let bad = 0;
  for (const s of json("config/sources.json")) {
    try { log(`OK    ${s.name} (${parseFeed(await fetchText(s.feed_url)).length} entrées)`); }
    catch (e) { bad++; log(`ÉCHEC ${s.name} : ${(e as Error).message}`); }
  }
  log(`${bad} source(s) en échec.`);
}

/** Corrige les textes déjà stockés avec des entités non décodées (&#8217;…). Sans effet si tout est propre. */
export function repairEntities(sql: Sql): number {
  const bad = /&(#x?[0-9a-f]+|[a-z]+);/i;
  let n = 0;
  for (const r of sql.query(`SELECT id,title,summary FROM articles WHERE title LIKE '%&%;%' OR summary LIKE '%&%;%'`)) {
    if (!bad.test(r.title) && !bad.test(r.summary)) continue;
    const t = decodeEntities(r.title);
    sql.exec(`UPDATE articles SET title=${q(t)},title_norm=${q(normTitle(t))},summary=${q(decodeEntities(r.summary))} WHERE id=${r.id};`);
    n++;
  }
  for (const r of sql.query(`SELECT id,title FROM bookmarks WHERE title LIKE '%&%;%'`)) sql.exec(`UPDATE bookmarks SET title=${q(decodeEntities(r.title))} WHERE id=${r.id};`);
  return n;
}
