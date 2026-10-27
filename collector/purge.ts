import { q } from "./sql";
/** Rétention : on garde 7 jours, plus au moins les `keepPerCategory` articles les plus récents de chaque catégorie (jusqu'à `maxAgeDays`).
 *  Les favoris sont d'abord copiés dans `bookmarks` (titre, source, lien, date), puis tout ce qui dépasse est supprimé. */
export function purgeSql(now: Date, retentionDays: number, keepPerCategory = 0, maxAgeDays = retentionDays): string {
  const day = 864e5, cut = q(new Date(now.getTime() - retentionDays * day).toISOString()), cutMax = q(new Date(now.getTime() - Math.max(maxAgeDays, retentionDays) * day).toISOString());
  const keepers = `SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY category ORDER BY sort_ts DESC) AS rn FROM articles) WHERE rn <= ${Math.max(0, Math.floor(keepPerCategory))}`;
  const doomed = `(sort_ts < ${cutMax} OR (sort_ts < ${cut} AND id NOT IN (${keepers})))`;
  return [
    `INSERT OR IGNORE INTO bookmarks(user_id,url,title,source_name,published_at,created_at) SELECT s.user_id,a.url,a.title,src.name,a.published_at,${q(now.toISOString())} FROM user_article_state s JOIN articles a ON a.id=s.article_id JOIN sources src ON src.id=a.source_id WHERE s.favorite=1 AND a.id IN (SELECT id FROM articles WHERE ${doomed});`,
    `DELETE FROM user_article_state WHERE article_id IN (SELECT id FROM articles WHERE ${doomed});`,
    `DELETE FROM article_sources WHERE article_id IN (SELECT id FROM articles WHERE ${doomed});`,
    `DELETE FROM articles WHERE ${doomed};`,
    `DELETE FROM briefings WHERE day < ${q(cut.slice(1, 11))};`,
    `DELETE FROM collect_runs WHERE started_at < ${q(new Date(now.getTime() - 30 * day).toISOString())};`,
  ].join("\n");
}
