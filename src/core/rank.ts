import cfgJson from "../../config/ranking.json";
export type RankConfig = typeof cfgJson;
export const defaultConfig: RankConfig = cfgJson;
export type Level = "critical" | "important" | "follow" | "minor";
export interface RankInput {
  title: string; description?: string | null; publishedAt: string | null; collectedAt: string;
  reliability: number; official: boolean; securityFeed: boolean; category: string; sourceName: string;
}
export interface Ranked { score: number; level: Level; reasons: string[]; cvss: { score: number; source: string } | null }
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hit = (text: string, kws: string[]) => kws.find((k) => new RegExp("\\b" + esc(k), "i").test(text));
/** Le score CVSS n'est repris que s'il est écrit dans le flux ; jamais estimé. */
export function extractCvss(text: string, source: string): { score: number; source: string } | null {
  const m = /CVSS(?:\s*v?\d(?:\.\d)?)?(?:\s*base)?(?:\s*score)?\s*(?:of|:|=)?\s*(\d{1,2}(?:\.\d)?)/i.exec(text);
  if (!m) return null;
  const score = Number(m[1]);
  return score >= 0 && score <= 10 ? { score, source } : null;
}
export function rank(i: RankInput, cfg: RankConfig = defaultConfig, prefs: string[] = [], now = new Date()): Ranked {
  const w = cfg.weights, reasons: string[] = [];
  const text = `${i.title} ${i.description ?? ""}`;
  const ageH = Math.max(0, (now.getTime() - Date.parse(i.publishedAt ?? i.collectedAt)) / 3.6e6);
  let rec = Math.pow(0.5, ageH / cfg.halfLifeHours);
  if (!i.publishedAt) { rec *= cfg.undatedPenalty; reasons.push("date de publication absente"); }
  const cvss = extractCvss(text, i.sourceName);
  const crit = hit(text, cfg.criticalKeywords), imp = hit(text, cfg.importantKeywords);
  let sev = 0;
  if ((cvss && cvss.score >= 9) || crit) { sev = 1; reasons.push(cvss && cvss.score >= 9 ? `CVSS ${cvss.score} (${cvss.source})` : `mot-clé critique : ${crit}`); }
  else if ((cvss && cvss.score >= 7) || imp) { sev = 0.6; reasons.push(cvss && cvss.score >= 7 ? `CVSS ${cvss.score} (${cvss.source})` : `mot-clé : ${imp}`); }
  if (i.official) reasons.push("source officielle");
  const pref = prefs.includes(i.category) ? 1 : 0;
  if (pref) reasons.push("catégorie suivie");
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  const score = Math.round((100 * (w.recency * rec + w.reliability * ((i.reliability - 1) / 4) + w.official * (i.official ? 1 : 0) + w.severity * sev + w.categoryPref * pref)) / sum * 10) / 10;
  const t = cfg.thresholds;
  let level: Level = score >= t.critical ? "critical" : score >= t.important ? "important" : score >= t.follow ? "follow" : "minor";
  if (sev === 1 && (i.official || i.securityFeed)) level = "critical";
  return { score, level, reasons, cvss };
}
