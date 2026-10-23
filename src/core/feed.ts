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
/** Lève FeedError si le flux est malformé ou d'un format inconnu ; ignore silencieusement les entrées incomplètes. */
export function parseFeed(xml: string): FeedItem[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new FeedError("DOCTYPE/ENTITY refusé");
  if (XMLValidator.validate(xml) !== true) throw new FeedError("XML malformé");
  const doc: any = parser.parse(xml);
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
