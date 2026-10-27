import { describe, it, expect } from "vitest";
import { normalizeUrl, isSafeFeedUrl } from "../src/core/url";
import { summarize, normTitle, extractTechLinks, decodeEntities } from "../src/core/text";
import { parseDate, parisHour, parisDay } from "../src/core/dates";
import { rank, extractCvss } from "../src/core/rank";
import { findGroup } from "../src/core/dedupe";
import { parseFeed } from "../src/core/feed";
import { buildBriefing } from "../collector/briefing";

describe("URL", () => {
  it("normalise le suivi, www, slash final", () => {
    expect(normalizeUrl("http://www.Example.com/a/?utm_source=x&b=1&a=2#top")).toBe("https://example.com/a?a=2&b=1");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });
  it("refuse les hôtes locaux/privés et http", () => {
    for (const u of ["http://a.com/f", "https://localhost/f", "https://127.0.0.1/f", "https://192.168.1.2/f", "https://169.254.169.254/f", "https://[::1]/f", "https://u:p@a.com/f"]) expect(isSafeFeedUrl(u)).toBe(false);
    expect(isSafeFeedUrl("https://blog.example.com/feed")).toBe(true);
  });
});
describe("dates et fuseau Europe/Paris", () => {
  it("rejette les dates invalides ou aberrantes", () => {
    const now = new Date("2026-10-22T10:00:00Z");
    expect(parseDate("n'importe quoi", now)).toBeNull();
    expect(parseDate("1970-01-01", now)).toBeNull();
    expect(parseDate("2027-01-01", now)).toBeNull();
    expect(parseDate("Tue, 20 Oct 2026 10:00:00 +0200", now)).toBe("2026-10-20T08:00:00.000Z");
  });
  it("gère les changements d'heure", () => {
    expect(parisHour(new Date("2026-03-29T00:30:00Z"))).toBe(1);
    expect(parisHour(new Date("2026-03-29T01:30:00Z"))).toBe(3);
    expect(parisHour(new Date("2026-10-25T00:30:00Z"))).toBe(2);
    expect(parisHour(new Date("2026-10-25T01:30:00Z"))).toBe(2);
    expect(parisDay(new Date("2026-10-21T22:30:00Z"))).toBe("2026-10-22");
  });
  it("les deux crons 05:05 et 06:05 UTC couvrent 7 h Paris été comme hiver", () => {
    expect(parisHour(new Date("2026-07-15T05:05:00Z"))).toBe(7);
    expect(parisHour(new Date("2026-01-15T06:05:00Z"))).toBe(7);
  });
});
describe("résumé sans invention", () => {
  it("reste extractif et plafonné", () => {
    const d = "Une première phrase assez longue pour compter. " + "Deuxième phrase tout aussi détaillée et utile. ".repeat(20);
    const s = summarize("Titre", `<p>${d}</p>`);
    expect(s.limited).toBe(false);
    expect(s.text.length).toBeLessThanOrEqual(280);
    expect(d).toContain(s.text.split(". ")[0]);
  });
  it("signale les informations limitées sans inventer", () => {
    const s = summarize("Titre seul", "");
    expect(s.limited).toBe(true);
    expect(s.text).toContain("Titre seul");
  });
  it("extrait des liens techniques réels", () => {
    const l = extractTechLinks('<a href="https://github.com/o/r/pull/1">PR</a> <a href="https://x.com/t">x</a>', "Faille CVE-2026-1234");
    expect(l).toEqual(["https://github.com/o/r/pull/1", "https://nvd.nist.gov/vuln/detail/CVE-2026-1234"]);
  });
});
describe("classement", () => {
  const base = { title: "Nouveau billet", publishedAt: "2026-10-22T09:00:00Z", collectedAt: "2026-10-22T09:30:00Z", reliability: 5, official: true, securityFeed: false, category: "dev", sourceName: "S" };
  const now = new Date("2026-10-22T10:00:00Z");
  it("CVSS repris uniquement s'il est écrit", () => {
    expect(extractCvss("CVSS v3.1 score: 9.8", "CERT")).toEqual({ score: 9.8, source: "CERT" });
    expect(extractCvss("aucune note ici", "CERT")).toBeNull();
  });
  it("faille exploitée d'une source officielle sécurité = critique", () => {
    const r = rank({ ...base, title: "Zero-day actively exploited in the wild", securityFeed: true, category: "security" }, undefined, [], now);
    expect(r.level).toBe("critical");
    expect(r.reasons.join()).toContain("mot-clé critique");
  });
  it("décroissance temporelle et préférences", () => {
    const fresh = rank(base, undefined, [], now), old = rank({ ...base, publishedAt: "2026-10-18T09:00:00Z" }, undefined, [], now);
    expect(fresh.score).toBeGreaterThan(old.score);
    expect(rank(base, undefined, ["dev"], now).score).toBeGreaterThan(fresh.score);
  });
  it("pénalise l'absence de date", () => {
    expect(rank({ ...base, publishedAt: null }, undefined, [], now).reasons).toContain("date de publication absente");
  });
});
describe("doublons", () => {
  const known = [{ key: "k1", titleNorm: normTitle("Node.js 26 est disponible avec de nouvelles fonctions"), category: "dev", ts: Date.parse("2026-10-22T08:00:00Z") }];
  const o = { similarity: 0.75, windowHours: 48, minTokens: 4 };
  it("regroupe un titre très proche, pas un titre différent", () => {
    expect(findGroup(normTitle("Node.js 26 est disponible avec de nouvelles fonctions !"), "dev", Date.parse("2026-10-22T09:00:00Z"), known, o)?.key).toBe("k1");
    expect(findGroup(normTitle("Kubernetes publie une nouvelle version majeure"), "dev", Date.parse("2026-10-22T09:00:00Z"), known, o)).toBeNull();
  });
  it("respecte la fenêtre de temps", () => {
    expect(findGroup(known[0].titleNorm, "dev", Date.parse("2026-10-30T09:00:00Z"), known, o)).toBeNull();
  });
});
describe("flux RSS/Atom", () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>A &amp; B</title><link>https://x.example/a</link><pubDate>Tue, 20 Oct 2026 10:00:00 GMT</pubDate><description>desc</description></item><item><title>Sans lien</title></item></channel></rss>`;
  it("lit un RSS valide et ignore l'entrée incomplète", () => {
    const items = parseFeed(rss);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("A & B");
  });
  it("lit un Atom", () => {
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>T</title><link rel="alternate" href="https://x.example/t"/><updated>2026-10-20T10:00:00Z</updated></entry></feed>`;
    expect(parseFeed(atom)[0].link).toBe("https://x.example/t");
  });
  it("rejette XML malformé, format inconnu et DOCTYPE", () => {
    expect(() => parseFeed("<rss><channel><item>")).toThrow();
    expect(() => parseFeed("<html><body>x</body></html>")).toThrow();
    expect(() => parseFeed('<!DOCTYPE x [<!ENTITY a "b">]><rss/>')).toThrow();
  });
});
describe("briefing", () => {
  it("priorise critiques/importants et complète à 10", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: i, title: `sujet noyau linux ${i}`, category: "dev", importance: i < 3 ? "critical" : "follow", score: 90 - i }));
    const b = buildBriefing(rows);
    expect(b.ids.slice(0, 3)).toEqual([0, 1, 2]);
    expect(b.ids).toHaveLength(10);
    expect(b.topics.map((t) => t.word)).toContain("linux");
  });
});

describe("entités HTML", () => {
  it("décode numériques, hexadécimales, nommées et doublement encodées", () => {
    expect(decodeEntities("Spiral&#8217;s Edge")).toBe("Spiral’s Edge");
    expect(decodeEntities("Spiral&#x2019;s &amp; Co &hellip;")).toBe("Spiral’s & Co …");
    expect(decodeEntities("Spiral&amp;#8217;s")).toBe("Spiral’s");
    expect(decodeEntities("&#99999999; &inconnu;")).toBe("&#99999999; &inconnu;");
  });
  it("nettoie les titres de flux (entités et balises)", () => {
    const xml = `<rss><channel><item><title>Spiral&amp;#8217;s &lt;em&gt;Edge&lt;/em&gt;</title><link>https://x.example/a</link></item></channel></rss>`;
    expect(parseFeed(xml)[0].title).toBe("Spiral’s Edge");
  });
});

describe("flux réels : tolérance", () => {
  const wp = (body: string, title = "Un article avec du code") => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Blog</title>
<item><title>${title}</title><link>https://exemple.test/a</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate><content:encoded><![CDATA[${body}]]></content:encoded></item>
<item><title>Autre article</title><link>https://exemple.test/b</link></item></channel></rss>`;
  it("un exemple de code <!DOCTYPE html> dans un article n'invalide plus tout le flux", () => {
    expect(parseFeed(wp("<pre><code><!DOCTYPE html>\n<html></html></code></pre>"))).toHaveLength(2);
    expect(parseFeed(wp("<!ENTITY x 'y'>"))).toHaveLength(2);
  });
  it("répare une esperluette non échappée sans abîmer le contenu CDATA", () => {
    const items = parseFeed(wp("a && b", "Q&A : Rust & Go"));
    expect(items[0].title).toBe("Q&A : Rust & Go");
    expect(items[0].description).toBe("a && b");
  });
  it("retire les caractères de contrôle invalides", () => { expect(parseFeed(wp("x", "Titre\u0007 propre"))[0].title).toBe("Titre propre"); });
  it("XML vraiment cassé : récupère les articles lisibles plutôt que de tout perdre", () => {
    const broken = `<rss><channel><item><title>Premier</title><link>https://exemple.test/1</link></item><item><title>Deuxième <b></title><link>https://exemple.test/2</link></item><item><title>Tronqué`;
    const items = parseFeed(broken);
    expect(items.map((i) => i.link)).toEqual(["https://exemple.test/1", "https://exemple.test/2"]);
  });
  it("refuse toujours un DOCTYPE/ENTITY dans le prologue (protection contre les entités malveillantes)", () => {
    expect(() => parseFeed('<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "b">]><rss version="2.0"><channel/></rss>')).toThrow("refusé");
    expect(() => parseFeed("<!DOCTYPE html><html><body>pas un flux</body></html>")).toThrow();
  });
});
