import { isSafeFeedUrl } from "../src/core/url";
export interface FetchOpts { timeoutMs?: number; maxBytes?: number; retries?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }
// Identifie le robot et indique où trouver son propriétaire (usage courant et poli pour les lecteurs de flux).
const UA = `Mozilla/5.0 (compatible; TechInfoBot/1.0; +https://github.com/${process.env.GITHUB_REPOSITORY ?? "techinfo"})`;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Timeout, taille max, redirections validées une à une (anti-SSRF), nouvelles tentatives sur 419/429/5xx/réseau. */
export async function fetchText(url: string, o: FetchOpts = {}): Promise<string> {
  return new TextDecoder().decode(await fetchBytes(url, o));
}
/** Même protections que fetchText, pour un contenu binaire (logos). */
export async function fetchBytes(url: string, o: FetchOpts = {}): Promise<ArrayBuffer> {
  const { timeoutMs = 10000, maxBytes = 4_000_000, retries = 3, fetchImpl = fetch, sleep = wait } = o;
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      let cur = url;
      for (let hop = 0; hop < 4; hop++) {
        if (!isSafeFeedUrl(cur)) throw new Error("URL refusée (non https ou hôte privé)");
        const res = await fetchImpl(cur, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5", "accept-language": "en,fr;q=0.8" } });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { cur = new URL(res.headers.get("location")!, cur).href.replace(/^http:/i, "https:"); continue; } // certains sites redirigent encore en http : on reste en https
        if (res.status === 429 || res.status === 419 || res.status === 202 || res.status >= 500) { // 419 : limite de débit de Hacker News ; 202 : réponse vide d'un pare-feu (JetBrains)
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 500 * 2 ** attempt);
          throw new Error(`HTTP ${res.status}`);
        }
        if (!res.ok) { const e = new Error(`HTTP ${res.status}`); (e as any).fatal = true; throw e; }
        const buf = await res.arrayBuffer();
        if (buf.byteLength > maxBytes) { const e = new Error("Réponse trop volumineuse"); (e as any).fatal = true; throw e; }
        return buf;
      }
      throw new Error("Trop de redirections");
    } catch (e) {
      lastErr = e;
      if ((e as any)?.fatal) break;
      if (attempt < retries - 1) await sleep(300 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Échec réseau");
}
