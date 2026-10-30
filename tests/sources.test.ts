import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { collectSources, type SourceRow } from "../collector/collect";
import { fetchText } from "../collector/safefetch";
import { defaultConfig } from "../src/core/rank";

describe("sources difficiles", () => {
  const now = new Date("2026-10-22T10:00:00Z");
  const src: SourceRow = { id: 1, name: "Src", feed_url: "https://a.example/feed", lang: "en", categories: ["security"], reliability: 5, official: true, security: true, fail_count: 0, last_attempt_at: null };
  const item = (n: number, title: string) => `<item><title>${title}</title><link>https://a.example/${n}</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate></item>`;
  const feed = (...items: string[]) => `<rss><channel>${items.join("")}</channel></rss>`;
  const run = (s: SourceRow, get: (u: string) => Promise<string>) => collectSources([s], { now, knownUrls: new Set(), known: [], cfg: defaultConfig, dedupe: { similarity: 0.99, windowHours: 48, minTokens: 4 }, retentionDays: 7, fetchText: get });
  it("un flux bavard est filtré par titre et plafonné ; le reste attend la mise à jour suivante", async () => {
    const xml = feed(item(1, "CVE-1 Edge (Chromium-based) Remote Code Execution"), item(2, "CVE-2 Windows Spoofing"), item(3, "CVE-3 Windows Remote Code Execution"), item(4, "CVE-4 Office Remote Code Execution"), item(5, "CVE-5 Azure Remote Code Execution"));
    const { results, statements } = await run({ ...src, include: "Remote Code Execution", exclude: "Chromium", maxPerRun: 2 }, async () => xml);
    expect(results[0]).toMatchObject({ ok: true, added: 2, skipped: 3 });
    const sql = statements.join("\n");
    expect(sql).toContain("CVE-3"); expect(sql).toContain("CVE-4");
    for (const no of ["CVE-1", "CVE-2", "CVE-5"]) expect(sql).not.toContain(no);
  });
  it("si le flux principal échoue, l'adresse de secours prend le relais ; sans elle, l'erreur reste visible", async () => {
    const urls: string[] = [];
    const flaky = async (u: string) => { urls.push(u); if (u === src.feed_url) throw new Error("HTTP 419"); return feed(item(1, "Depuis le secours")); };
    expect((await run({ ...src, fallback_url: "https://b.example/rss" }, flaky)).results[0]).toMatchObject({ ok: true, added: 1 });
    expect(urls).toEqual([src.feed_url, "https://b.example/rss"]);
    expect((await run(src, flaky)).results[0]).toMatchObject({ ok: false, error: "HTTP 419" });
  });
  it("la configuration réelle garde MSRC filtré et Hacker News secouru", () => {
    const cfg = JSON.parse(readFileSync("config/sources.json", "utf8")), by = (n: string) => cfg.find((s: any) => s.name === n);
    expect(by("Microsoft MSRC")).toMatchObject({ include: "Remote Code Execution", exclude: "Chromium", maxPerRun: 3 });
    expect(by("Hacker News").fallback_url).toMatch(/^https:\/\//);
  });
});

describe("réponses réelles des sites", () => {
  const res = (status: number, body = "", headers: Record<string, string> = {}) => new Response(status === 302 ? null : body, { status, headers });
  const sleep = async () => {};
  it("une redirection http reste en https (blogs Google vers FeedBurner)", async () => {
    const seen: string[] = [];
    const out = await fetchText("https://a.example/f", { sleep, fetchImpl: (async (u: string) => { seen.push(u); return seen.length === 1 ? res(302, "", { location: "http://feeds.example/x" }) : res(200, "bon"); }) as any });
    expect(out).toBe("bon");
    expect(seen).toEqual(["https://a.example/f", "https://feeds.example/x"]);
  });
  it("la mise à niveau https ne contourne pas la protection des hôtes privés", async () => {
    await expect(fetchText("https://a.example/f", { sleep, retries: 1, fetchImpl: (async () => res(302, "", { location: "http://127.0.0.1/x" })) as any })).rejects.toThrow("refusée");
  });
  it("un 419 ou un 202 vide est retenté (Hacker News, JetBrains)", async () => {
    for (const code of [419, 202]) {
      let n = 0;
      expect(await fetchText("https://a.example/f", { sleep, fetchImpl: (async () => (++n === 1 ? res(code, "") : res(200, "bon"))) as any })).toBe("bon");
      expect(n).toBe(2);
    }
  });
  it("accepte un flux de 3 Mo (Microsoft MSRC), refuse au-delà de la limite", async () => {
    const big = (size: number) => (async () => res(200, "x".repeat(size))) as any;
    expect((await fetchText("https://a.example/f", { sleep, fetchImpl: big(3_000_000) })).length).toBe(3_000_000);
    await expect(fetchText("https://a.example/f", { sleep, fetchImpl: big(4_000_001) })).rejects.toThrow("volumineuse");
  });
});
