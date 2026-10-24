import { describe, it, expect } from "vitest";
// @ts-ignore module JS du navigateur
import { detectLang, t, dictionaries, catLabel, localizeReason, localizeBriefingSummary, CAT_KEYS } from "../web/i18n.js";

describe("langue de l'appareil", () => {
  it("français si le navigateur est en français (toute région), anglais sinon", () => {
    for (const l of ["fr", "fr-FR", "fr-CA", "FR-be"]) expect(detectLang({ languages: [l] })).toBe("fr");
    for (const l of ["en-US", "de-DE", "ja"]) expect(detectLang({ languages: [l] })).toBe("en");
    expect(detectLang({ language: "fr-CH" })).toBe("fr");
    expect(detectLang({})).toBe("en");
  });
});
describe("textes", () => {
  it("les deux langues ont exactement les mêmes clés", () => {
    expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries.fr).sort());
  });
  it("aucune traduction vide et mêmes variables {x} des deux côtés", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(dictionaries.fr)) {
      expect(dictionaries.fr[k].length, k).toBeGreaterThan(0);
      expect(dictionaries.en[k].length, k).toBeGreaterThan(0);
      expect(vars(dictionaries.en[k]), k).toBe(vars(dictionaries.fr[k]));
    }
  });
  it("remplace les variables et retombe sur l'anglais puis sur la clé", () => {
    expect(t("fr", "filtersN", { n: 2 })).toBe("Filtres (2)");
    expect(t("en", "filtersN", { n: 2 })).toBe("Filters (2)");
    expect(t("de", "more")).toBe("Show more");
    expect(t("fr", "inconnue")).toBe("inconnue");
  });
  it("traduit toutes les catégories", () => {
    for (const k of CAT_KEYS) { expect(catLabel("fr", k)).not.toBe(k === "web" ? "" : undefined); expect(catLabel("en", k).length).toBeGreaterThan(0); }
    expect(catLabel("en", "security")).toBe("Cybersecurity");
    expect(catLabel("fr", "security")).toBe("Cybersécurité");
  });
});
describe("libellés produits par le build", () => {
  it("raisons du classement", () => {
    expect(localizeReason("en", "source officielle")).toBe("official source");
    expect(localizeReason("en", "mot-clé critique : zero-day")).toBe("critical keyword: zero-day");
    expect(localizeReason("en", "mot-clé : patch")).toBe("keyword: patch");
    expect(localizeReason("en", "date de publication absente")).toBe("no publication date");
    expect(localizeReason("fr", "mot-clé : patch")).toBe("mot-clé : patch");
    expect(localizeReason("en", "CVSS 9.8 (CERT)")).toBe("CVSS 9.8 (CERT)");
  });
  it("résumé du briefing", () => {
    const fr = "12 actualités sur 24 h, dont 2 critique(s) et 3 importante(s). Sélection automatique par règles, sans IA.";
    expect(localizeBriefingSummary("en", fr)).toBe("12 stories in 24 h, including 2 critical and 3 important. Automatic rule-based selection.");
    expect(localizeBriefingSummary("fr", fr)).toContain("12 actualités sur 24 h");
    expect(localizeBriefingSummary("en", "texte inconnu")).toBe("texte inconnu");
  });
});
