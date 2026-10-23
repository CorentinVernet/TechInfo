import { isSafeFeedUrl } from "../src/core/url";
export interface FetchOpts { timeoutMs?: number; maxBytes?: number; retries?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Timeout, taille max, redirections validées une à une (anti-SSRF), nouvelles tentatives sur 429/5xx/réseau. */
export async function fetchText(url: string, o: FetchOpts = {}): Promise<string> {
  const { timeoutMs = 10000, maxBytes = 2_000_000, retries = 3, fetchImpl = fetch, sleep = wait } = o;
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      let cur = url;
      for (let hop = 0; hop < 4; hop++) {
        if (!isSafeFeedUrl(cur)) throw new Error("URL refusée (non https ou hôte privé)");
        const res = await fetchImpl(cur, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "TechInfoBot/1.0 (veille perso)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { cur = new URL(res.headers.get("location")!, cur).href; continue; }
        if (res.status === 429 || res.status >= 500) {
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 500 * 2 ** attempt);
          throw new Error(`HTTP ${res.status}`);
        }
        if (!res.ok) { const e = new Error(`HTTP ${res.status}`); (e as any).fatal = true; throw e; }
        const buf = await res.arrayBuffer();
        if (buf.byteLength > maxBytes) { const e = new Error("Réponse trop volumineuse"); (e as any).fatal = true; throw e; }
        return new TextDecoder().decode(buf);
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
