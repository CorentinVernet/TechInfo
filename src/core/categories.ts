import rules from "../../config/categories.json";
import { normTitle } from "./text";

export const CATEGORIES = ["web", "dev", "systems", "network-cloud", "security", "ai", "hardware", "mobile", "business", "selfhost", "gaming", "science", "general"] as const;
export const LEVELS = ["critical", "important", "follow", "minor"] as const;
export type Category = (typeof CATEGORIES)[number];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RULES = rules.rules.map((r: { category: string; keywords: string[]; exact?: string[] }) => ({
  category: r.category,
  words: new RegExp(`\\b(?:${r.keywords.map((k) => (k.endsWith("*") ? `${esc(k.slice(0, -1))}\\w*` : `${esc(k)}\\b`)).join("|")})`),
  exact: r.exact?.length ? new RegExp(`\\b(?:${r.exact.map(esc).join("|")})\\b`) : null,
}));
/** Les sources généralistes parlent de tout : leurs articles sont rangés d'après le titre, à défaut « general ». Les sources spécialisées gardent leur catégorie. */
export function classify(title: string, sourceCategory: string): string {
  if (sourceCategory !== "general") return sourceCategory;
  const norm = normTitle(title);
  return RULES.find((r) => r.exact?.test(title) || r.words.test(norm))?.category ?? "general";
}
const LEGACY: Record<string, string> = { "bigtech-mobile": "mobile", space: "science", industry: "general", other: "general" };
/** Articles déjà publiés avec une ancienne catégorie (état repris d'une exécution précédente). */
export function migrateCategory(title: string, category: string): string {
  return LEGACY[category] ? classify(title, LEGACY[category]) : category;
}
