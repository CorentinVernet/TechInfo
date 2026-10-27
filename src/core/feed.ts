import { XMLParser, XMLValidator } from "fast-xml-parser";
import { stripHtml } from "./text";
export class FeedError extends Error {}
export interface FeedItem { title: string; link: string; guid?: string; published?: string; updated?: string; description?: string }
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", trimValues: true });
const txt = (v: any): string => (v == null ? "" : typeof v === "object" ? String(v["#text"] ?? "") : String(v));
function atomLink(l: any): string {
  const arr = Array.isArray(l) ? l : l ? [l] : [];
  const alt = arr.find((x) => typeof x === "object" && (!x["@_rel"] || x["@_rel"] === "alternate")) ?? arr[0];
  return typeof alt === "object" ? String(alt["@_href"] ?? "") : String(alt ?? "");
}
const ROOT = /<(rss|feed|rdf:RDF)[\s>]/i;
/** Répare les défauts courants des vrais flux : caractères de contrôle et « & » non échappés (hors blocs CDATA). */
function repair(xml: string): string {
  return xml.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/(<!\[CDATA\[[\s\S]*?\]\]>)|&(?!(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, (m, cdata) => (cdata ? m : "&amp;"));
}
const unwrap = (v: string) => v.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
/** Dernier recours pour un XML cassé : on récupère ce qu'on peut article par article plutôt que de perdre tout le flux. */
function looseItems(xml: string): FeedItem[] {
  const tag = (b: string, n: string) => { const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i").exec(b); return m ? unwrap(m[1]) : ""; };
  const out: FeedItem[] = [];
  for (const b of xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []) {
    const title = stripHtml(tag(b, "title")), link = /<link[^>]*\shref=["']([^"']+)["']/i.exec(b)?.[1] ?? tag(b, "link");
    if (!title || !link) continue;
    out.push({ title, link: link.trim(), guid: tag(b, "guid") || tag(b, "id") || undefined, published: tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date") || undefined, updated: tag(b, "updated") || undefined, description: tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content") || undefined });
  }
  return out;
}
/** Lève FeedError si le flux est inutilisable ; ignore silencieusement les entrées incomplètes.
 *  DOCTYPE/ENTITY ne sont refusés que dans le prologue (avant l'élément racine) : un exemple de code dans un article n'invalide plus le flux. */
export function parseFeed(xml: string): FeedItem[] {
  const root = ROOT.exec(xml);
  if (!root) throw new FeedError("Format de flux non reconnu");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml.slice(0, root.index))) throw new FeedError("DOCTYPE/ENTITY refusé");
  let src = xml.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); // caractères de contrôle interdits en XML
  if (XMLValidator.validate(src) !== true) src = repair(src);
  if (XMLValidator.validate(src) !== true) { const loose = looseItems(xml); if (!loose.length) throw new FeedError("XML malformé"); return loose; }
  const doc: any = parser.parse(src);
  const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.["rdf:RDF"]?.item;
  if (raw === undefined) throw new FeedError("Format de flux non reconnu");
  const items: FeedItem[] = [];
  for (const it of Array.isArray(raw) ? raw : [raw]) {
    const title = stripHtml(txt(it.title));
    const link = typeof it.link === "string" ? it.link.trim() : atomLink(it.link).trim() || txt(it.guid).trim();
    if (!title || !link) continue;
    items.push({
      title, link, guid: txt(it.guid ?? it.id) || undefined,
      published: txt(it.pubDate ?? it["dc:date"] ?? it.published ?? it.updated) || undefined,
      updated: txt(it.updated) || undefined,
      description: txt(it.description ?? it.summary ?? it["content:encoded"] ?? it.content) || undefined,
    });
  }
  return items;
}
