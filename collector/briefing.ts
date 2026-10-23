import { tokens } from "../src/core/text";
export interface Row { id: number; title: string; category: string; importance: string; score: number }
/** Briefing déterministe : critiques/importants d'abord (max 20), complété par « à suivre » jusqu'à 10. */
export function buildBriefing(rows: Row[]) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const top = sorted.filter((r) => r.importance === "critical" || r.importance === "important").slice(0, 20);
  for (const r of sorted) { if (top.length >= 10) break; if (!top.includes(r)) top.push(r); }
  const freq = new Map<string, number>();
  for (const r of rows) for (const t of new Set(tokens(r.title))) freq.set(t, (freq.get(t) ?? 0) + 1);
  const topics = [...freq].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word, count]) => ({ word, count }));
  const c = rows.filter((r) => r.importance === "critical").length, i = rows.filter((r) => r.importance === "important").length;
  return { ids: top.map((r) => r.id), topics, summary: `${rows.length} actualités sur 24 h, dont ${c} critique(s) et ${i} importante(s). Sélection automatique par règles, sans IA.` };
}
