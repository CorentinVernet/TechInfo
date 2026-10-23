import { q } from "./sql";
/** Rétention : les favoris sont d'abord copiés dans `bookmarks` (titre, source, lien, date), puis tout ce qui dépasse est supprimé. */
export function purgeSql(now: Date, retentionDays: number): string {
  const cut = q(new Date(now.getTime() - retentionDays * 864e5).toISOString());
  const old = `SELECT id FROM articles WHERE sort_ts < ${cut}`;
  return [
    `INSERT OR IGNORE INTO bookmarks(user_id,url,title,source_name,published_at,created_at) SELECT s.user_id,a.url,a.title,src.name,a.published_at,${q(now.toISOString())} FROM user_article_state s JOIN articles a ON a.id=s.article_id JOIN sources src ON src.id=a.source_id WHERE s.favorite=1 AND a.sort_ts < ${cut};`,
    `DELETE FROM user_article_state WHERE article_id IN (${old});`,
    `DELETE FROM article_sources WHERE article_id IN (${old});`,
    `DELETE FROM articles WHERE sort_ts < ${cut};`,
    `DELETE FROM briefings WHERE day < ${q(cut.slice(1, 11))};`,
    `DELETE FROM collect_runs WHERE started_at < ${q(new Date(now.getTime() - 30 * 864e5).toISOString())};`,
  ].join("\n");
}
