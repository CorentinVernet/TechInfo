import { jaccard, tokens } from "./text";
export interface Known { key: string; titleNorm: string; category: string; ts: number }
export interface DedupeOpts { similarity: number; windowHours: number; minTokens: number }
/** Titre identique ou très proche, même catégorie, dans la fenêtre de temps. */
export function findGroup(titleNorm: string, category: string, ts: number, known: Known[], o: DedupeOpts): Known | null {
  let best: Known | null = null, bestScore = 0;
  for (const k of known) {
    if (Math.abs(ts - k.ts) > o.windowHours * 3.6e6) continue;
    if (k.titleNorm === titleNorm) return k;
    if (k.category !== category || tokens(titleNorm).length < o.minTokens) continue;
    const s = jaccard(titleNorm, k.titleNorm);
    if (s >= o.similarity && s > bestScore) { best = k; bestScore = s; }
  }
  return best;
}
