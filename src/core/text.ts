export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}
export function normTitle(s: string): string {
  return stripAccents(decodeEntities(s)).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
const NAMED: Record<string, string> = { nbsp: " ", lt: "<", gt: ">", quot: '"', apos: "'", amp: "&", hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", eacute: "é", egrave: "è", agrave: "à", ecirc: "ê", ccedil: "ç", euro: "€", copy: "©", reg: "®", deg: "°", times: "×", middot: "·", bull: "•" };
/** Décode &#8217; &#x2019; &hellip; etc. Deux passes : certains flux sont encodés deux fois (&amp;#8217;). */
export function decodeEntities(s: string): string {
  let out = s;
  for (let i = 0; i < 2; i++) {
    out = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
      }
      return NAMED[e.toLowerCase()] ?? m;
    });
  }
  return out;
}
export function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
const STOP = new Set("les des une the and for with that this from are was pour dans sur avec par est qui que not has have will new nouveau nouvelle plus aux ses son sont ces cette".split(" "));
export function tokens(s: string): string[] {
  return normTitle(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
}
export function jaccard(a: string, b: string): number {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}
/** Résumé extractif : uniquement des phrases du flux, jamais de texte inventé. */
export function summarize(title: string, desc?: string | null): { text: string; limited: boolean } {
  const clean = stripHtml(desc ?? "");
  if (clean.length < 40) return { text: `Informations limitées : seul le titre est disponible (« ${title} »).`, limited: true };
  let out = "";
  for (const s of clean.split(/(?<=[.!?])\s+/).filter((x) => x.length > 15)) {
    const next = (out + " " + s).trim();
    if (next.length > 280) break;
    out = next;
  }
  if (!out) out = clean.slice(0, 280).replace(/\s+\S*$/, "") + "…";
  return { text: out, limited: false };
}
const TECH_HOSTS = /^(github\.com|nvd\.nist\.gov|(www\.)?cve\.org|cve\.mitre\.org|docs\.[^/]+|developer\.[^/]+)$/;
/** Liens techniques réellement présents dans le flux + fiches CVE déduites des identifiants cités. */
export function extractTechLinks(rawDesc: string, title: string): string[] {
  const out = new Set<string>();
  for (const m of rawDesc.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    try { const u = new URL(m[1]); if (TECH_HOSTS.test(u.hostname)) out.add(u.href); } catch { /* lien invalide ignoré */ }
  }
  for (const m of `${title} ${stripHtml(rawDesc)}`.matchAll(/CVE-\d{4}-\d{4,7}/gi)) out.add(`https://nvd.nist.gov/vuln/detail/${m[0].toUpperCase()}`);
  return [...out].slice(0, 8);
}
