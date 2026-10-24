import { describe, it, expect, vi } from "vitest";

const art = (n: number, over: any = {}) => ({ key: `a${n}`.replace("a", "0a"), id: n, title: `Article ${n}`, url: `https://x.example/${n}`, source_id: 1, category: "dev", lang: "fr", official: 0, published_at: `2026-10-2${n}T08:00:00Z`, updated_at: null, collected_at: `2026-10-2${n}T09:00:00Z`, sort_ts: `2026-10-2${n}T08:00:00Z`, summary: "", summary_limited: 0, importance: "follow", score: 50, reasons: ["r"], cvss: null, cvss_source: null, links: [], ...over });
const data = (arts: any[], briefing: any = null) => ({ version: 1, generated_at: "2026-10-22T10:00:00Z", config: { prefBonus: 10 }, sources: [{ id: 1, name: "Src" }], articles: arts, article_sources: arts.map((a) => ({ article_id: a.id, source_id: 1, url: a.url, published_at: a.published_at })), briefing, status: { status: "ok", sources_ok: 1, sources_total: 1, added: arts.length, errors: [] } });
async function boot(d: any, mem: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubGlobal("localStorage", { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } });
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => d }));
  // @ts-ignore module JS du navigateur
  const { api } = await import("../web/api.js");
  const call = async (path: string, opts?: any) => (await api(path, opts)).json();
  return { call, mem };
}
const post = (b: any) => ({ method: "POST", body: JSON.stringify(b) });

describe("API navigateur (version GitHub Pages)", () => {
  it("recherche sans accent ni casse, filtre et pagine", async () => {
    const { call } = await boot(data([art(1, { title: "Éléphant dans la salle" }), art(2, { category: "ai" }), art(3)]));
    expect((await call("/api/articles?q=elephant")).items.map((a: any) => a.title)).toEqual(["Éléphant dans la salle"]);
    expect((await call("/api/articles?category=ai")).items).toHaveLength(1);
    expect((await call("/api/articles?limit=2&offset=1")).items).toHaveLength(2);
    expect((await call("/api/articles")).items[0].title).toBe("Article 3"); // plus récent d'abord
  });
  it("filtre par langue d'origine", async () => {
    const { call } = await boot(data([art(1, { lang: "fr" }), art(2, { lang: "en" }), art(3, { lang: "en" })]));
    expect((await call("/api/articles?lang=en")).items).toHaveLength(2);
    expect((await call("/api/articles?lang=fr")).items.map((a: any) => a.lang)).toEqual(["fr"]);
    expect((await call("/api/articles")).items).toHaveLength(3);
  });
  it("garde lu / favori dans le navigateur et filtre les non lus", async () => {
    const d = data([art(1), art(2)]), { call, mem } = await boot(d);
    await call("/api/articles/0a1/state", post({ is_read: true }));
    expect((await call("/api/articles?unread=1")).items.map((a: any) => a.id)).toEqual(["0a2"]);
    await call("/api/articles/0a2/state", post({ favorite: true }));
    expect((await call("/api/articles?favorites=1")).items).toHaveLength(1);
    const again = await boot(d, mem); // rechargement de la page
    expect((await again.call("/api/articles?favorites=1")).items).toHaveLength(1);
  });
  it("conserve un favori dont l'article n'est plus publié (favoris archivés)", async () => {
    const { call, mem } = await boot(data([art(1), art(2)]));
    await call("/api/articles/0a1/state", post({ favorite: true }));
    const later = await boot(data([art(2)]), mem);
    expect((await later.call("/api/articles?favorites=1")).items).toEqual([]);
    const b = (await later.call("/api/bookmarks")).items;
    expect(b).toHaveLength(1);
    expect(b[0].title).toBe("Article 1");
    await later.call("/api/bookmarks/0a1", { method: "DELETE" });
    expect((await later.call("/api/bookmarks")).items).toEqual([]);
  });
  it("résout le briefing, l'historique et refuse l'inconnu", async () => {
    const { call } = await boot(data([art(1), art(2)], { day: "2026-10-22", generated_at: "x", summary: "s", topics: [], ids: [2, 99, 1] }));
    expect((await call("/api/briefing")).briefing.items.map((a: any) => a.id)).toEqual(["0a2", "0a1"]);
    await call("/api/articles/0a1");
    expect((await call("/api/history")).items.map((a: any) => a.id)).toEqual(["0a1"]);
    await expect(call("/api/articles/0abc")).rejects.toThrow("404");
    await expect(call("/api/admin/status")).rejects.toThrow("404");
  });
});
