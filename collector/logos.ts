import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeEntities } from "../src/core/text";
import { fetchBytes, fetchText } from "./safefetch";

export interface LogoEntry { file?: string; failed_at?: string }
export type LogoIndex = Record<string, LogoEntry>;
export interface LogoDeps { fetchText: (url: string) => Promise<string>; fetchBytes: (url: string) => Promise<ArrayBuffer>; now: Date; retryDays?: number; concurrency?: number }

const MAX_BYTES = 300_000;
/** Type réel d'après les premiers octets. Le SVG est refusé : ouvert directement, il pourrait exécuter du code sur l'adresse du site. */
export function sniffImage(b: Uint8Array): string | null {
  const hex = Buffer.from(b.subarray(0, 12)).toString("hex");
  if (hex.startsWith("89504e470d0a1a0a")) return "png";
  if (hex.startsWith("ffd8ff")) return "jpg";
  if (hex.startsWith("47494638")) return "gif";
  if (hex.startsWith("00000100")) return "ico";
  if (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250") return "webp";
  return null;
}
/** Adresses à essayer, de la plus nette à la plus petite : icônes déclarées par la page, puis /favicon.ico. */
export function iconCandidates(html: string, base: string): string[] {
  const found: { url: string; rank: number }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = /\brel=["']?([^"'>]+)/i.exec(m[0])?.[1]?.toLowerCase() ?? "", href = /\bhref=["']?([^"'\s>]+)/i.exec(m[0])?.[1];
    if (!href || !/\bicon\b|apple-touch-icon/.test(rel) || /mask-icon/.test(rel) || /\.svg(\?|$)/i.test(href)) continue;
    try { found.push({ url: new URL(decodeEntities(href), base).href, rank: rel.includes("apple-touch") ? 0 : Math.max(0, 200 - Number(/\bsizes=["']?(\d+)/i.exec(m[0])?.[1] ?? 16)) }); } catch { /* lien invalide ignoré */ }
  }
  return [...new Set([...found.sort((a, b) => a.rank - b.rank).map((x) => x.url), new URL("/favicon.ico", base).href])];
}
async function fetchLogo(site: string, d: LogoDeps): Promise<{ bytes: Uint8Array; ext: string } | null> {
  let html = "";
  try { html = await d.fetchText(site); } catch { /* le site refuse les robots : /favicon.ico reste possible */ }
  for (const url of iconCandidates(html, site)) {
    try {
      const bytes = new Uint8Array(await d.fetchBytes(url)), ext = bytes.byteLength <= MAX_BYTES ? sniffImage(bytes) : null;
      if (ext) return { bytes, ext };
    } catch { /* adresse suivante */ }
  }
  return null;
}
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };
/** Un logo déjà récupéré n'est plus jamais retéléchargé. Un échec n'est retenté qu'après `retryDays` : les sources ne changent pas de logo tous les quatre matins. */
export async function updateLogos(sites: string[], dir: string, prev: LogoIndex, d: LogoDeps): Promise<LogoIndex> {
  const index: LogoIndex = { ...prev }, retry = (d.retryDays ?? 7) * 864e5;
  const todo = [...new Set(sites.map(hostOf).filter(Boolean))].filter((h) => {
    const e = index[h];
    if (e?.file) return !existsSync(join(dir, e.file));
    return !e?.failed_at || d.now.getTime() - Date.parse(e.failed_at) >= retry;
  });
  mkdirSync(dir, { recursive: true });
  const work = async () => {
    for (let h = todo.pop(); h; h = todo.pop()) {
      const logo = await fetchLogo(`https://${h}/`, d);
      if (!logo) { index[h] = { failed_at: d.now.toISOString() }; continue; }
      const file = `${h.replace(/[^a-z0-9.-]/gi, "_")}-${createHash("sha1").update(logo.bytes).digest("hex").slice(0, 8)}.${logo.ext}`;
      writeFileSync(join(dir, file), logo.bytes);
      index[h] = { file };
    }
  };
  await Promise.all(Array.from({ length: d.concurrency ?? 8 }, work));
  return index;
}
export const logoPath = (index: LogoIndex, site?: string | null) => { const f = index[hostOf(site ?? "")]?.file; return f ? `data/logos/${f}` : null; };

/** Étape du build : reprend les logos de l'état précédent, complète ce qui manque. Une panne ici ne bloque jamais la publication. */
export async function buildLogos(sources: { site_url?: string }[], stateDir: string, outDir: string, now: Date, log: (m: string) => void = console.log): Promise<LogoIndex> {
  let prev: LogoIndex = {};
  try {
    mkdirSync(outDir, { recursive: true }); // le workflow enregistre ce dossier, même vide
    if (existsSync(stateDir)) { cpSync(stateDir, outDir, { recursive: true }); prev = JSON.parse(readFileSync(join(stateDir, "index.json"), "utf8")); }
    const opts = { retries: 1, timeoutMs: 6000 };
    const index = await updateLogos(sources.map((s) => s.site_url ?? ""), outDir, prev, { now, fetchText: (u) => fetchText(u, opts), fetchBytes: (u) => fetchBytes(u, { ...opts, maxBytes: MAX_BYTES }) });
    writeFileSync(join(outDir, "index.json"), JSON.stringify(index));
    const n = Object.values(index);
    log(`Logos : ${n.filter((e) => e.file).length} disponibles, ${n.filter((e) => !e.file).length} manquants.`);
    return index;
  } catch (e) { log(`Logos non mis à jour (${(e as Error).message}).`); return prev; }
}
