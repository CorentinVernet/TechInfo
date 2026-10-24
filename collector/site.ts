import type { DatabaseSync } from "node:sqlite";
import { normTitle } from "../src/core/text";
import { normalizeUrl } from "../src/core/url";
import { defaultConfig } from "../src/core/rank";

export interface PublicConfig { includeSummary: boolean; summaryMaxChars: number }
export interface State { version: 1; generated_at: string; config: { prefBonus: number }; sources: any[]; articles: any[]; article_sources: any[]; briefing: any | null; status: any }

const SRC = ["id", "name", "feed_url", "lang", "categories", "reliability", "official", "security", "enabled", "verified", "fail_count", "last_attempt_at", "last_success_at", "last_error"];
const ART = ["key", "id", "title", "url", "source_id", "category", "lang", "official", "published_at", "updated_at", "collected_at", "sort_ts", "summary", "summary_limited", "importance", "score", "reasons", "cvss", "cvss_source", "links"];

/** Recharge l'état publié précédemment dans une base SQLite en mémoire (pour reprendre l'historique de 7 jours). */
export function restoreState(raw: DatabaseSync, st: State): void {
  const ins = (table: string, cols: string[], rows: any[]) => {
    const s = raw.prepare(`INSERT OR IGNORE INTO ${table}(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`);
    for (const r of rows) s.run(...cols.map((c) => r[c] ?? null));
  };
  raw.exec("BEGIN");
  ins("sources", SRC, st.sources);
  ins("articles", [...ART, "title_norm", "desc_norm"], st.articles.map((a) => ({ ...a, reasons: JSON.stringify(a.reasons ?? []), links: JSON.stringify(a.links ?? []), summary: a.summary ?? "", title_norm: normTitle(a.title), desc_norm: "" })));
  ins("article_sources", ["article_id", "source_id", "url", "url_norm", "published_at", "collected_at"], st.article_sources.map((x) => ({ ...x, url_norm: normalizeUrl(x.url), collected_at: st.generated_at })));
  raw.exec("COMMIT");
}

const cut = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, "") + "…");

/** Fichier public : titre, lien, source, date, classement et, si activé, un résumé tronqué (jamais le texte « informations limitées » qui répète le titre). */
export function exportState(raw: DatabaseSync, now: Date, pub: PublicConfig): State {
  const all = (sql: string) => raw.prepare(sql).all() as any[];
  const run = all(`SELECT status,sources_total,sources_ok,added,errors FROM collect_runs ORDER BY id DESC LIMIT 1`)[0];
  const b = all(`SELECT day,generated_at,summary,article_ids,topics FROM briefings ORDER BY day DESC LIMIT 1`)[0];
  return {
    version: 1, generated_at: now.toISOString(), config: { prefBonus: defaultConfig.weights.categoryPref * 100 },
    sources: all(`SELECT ${SRC.join(",")} FROM sources ORDER BY id`),
    articles: all(`SELECT ${ART.join(",")} FROM articles ORDER BY sort_ts DESC`).map((a) => ({ ...a, reasons: JSON.parse(a.reasons), links: JSON.parse(a.links), summary: pub.includeSummary && !a.summary_limited ? cut(a.summary, pub.summaryMaxChars) : "" })),
    article_sources: all(`SELECT article_id,source_id,url,published_at FROM article_sources ORDER BY id`),
    briefing: b ? { day: b.day, generated_at: b.generated_at, summary: b.summary, ids: JSON.parse(b.article_ids), topics: JSON.parse(b.topics) } : null,
    status: run ? { status: run.status, sources_total: run.sources_total, sources_ok: run.sources_ok, added: run.added, errors: JSON.parse(run.errors) } : null,
  };
}
