import { DatabaseSync } from "node:sqlite";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "../src/server/db";
import { HOME } from "../src/server/paths";
import { sqliteSql } from "../collector/sql";
import { collect, briefing, purge } from "../collector/jobs";
import { exportState, restoreState } from "../collector/site";
import { buildLogos, logoPath } from "../collector/logos";

const now = new Date();
const raw = new DatabaseSync(":memory:");
migrate(raw, join(HOME, "migrations"));
const prevPath = join(HOME, "state", "articles.json");
if (existsSync(prevPath)) {
  try { const st = JSON.parse(readFileSync(prevPath, "utf8")); if (st.version === 1) { restoreState(raw, st); console.log(`État précédent : ${st.articles.length} articles.`); } }
  catch (e) { console.warn(`État précédent illisible, on repart de zéro (${(e as Error).message}).`); }
} else console.log("Pas d'état précédent : premier lancement.");

const sql = sqliteSql(raw);
await collect(sql, now);
purge(sql, now);
briefing(sql, now, true);
const st = exportState(raw, now, JSON.parse(readFileSync(join(HOME, "config", "public.json"), "utf8")));
if (st.status?.status === "failed") { console.error("Aucune source n'a répondu : le site publié n'est pas modifié."); process.exit(1); }

rmSync("site", { recursive: true, force: true });
mkdirSync(join("site", "data"), { recursive: true });
cpSync("web", "site", { recursive: true });
const cfgSources: { feed_url: string; site_url?: string }[] = JSON.parse(readFileSync(join(HOME, "config", "sources.json"), "utf8"));
const logos = await buildLogos(cfgSources, join(HOME, "state", "logos"), join("site", "data", "logos"), now);
const siteOf = new Map(cfgSources.map((s) => [s.feed_url, s.site_url]));
for (const s of st.sources) s.logo = logoPath(logos, siteOf.get(s.feed_url));
writeFileSync(join("site", "data", "articles.json"), JSON.stringify(st));
writeFileSync(join("site", ".nojekyll"), "");
console.log(`Site généré : ${st.articles.length} articles, ${st.sources.length} sources.`);
