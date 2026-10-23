const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|cmpid$|xtor$|at_|igshid$|_hs)/i;
/** Clé de comparaison (pas l'URL d'affichage) : https, sans www, sans suivi, sans slash final. */
export function normalizeUrl(raw: string | undefined | null, base?: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim(), base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    const host = u.host.toLowerCase().replace(/^www\./, "");
    let path = u.pathname.replace(/\/{2,}/g, "/");
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `https://${host}${path}${u.search}`;
  } catch { return null; }
}
/** Garde anti-SSRF pour les flux : https uniquement, pas d'hôte local/privé, pas d'identifiants. */
export function isSafeFeedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.includes(":") || h.startsWith("[")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
      const [a, b] = h.split(".").map(Number);
      if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    return true;
  } catch { return false; }
}
