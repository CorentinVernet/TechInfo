import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";

const manifest = JSON.parse(readFileSync("web/manifest.webmanifest", "utf8"));
const png = (f: string) => { const b = readFileSync(`web/${f}`); return { sig: b.subarray(0, 8).toString("hex"), w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

describe("manifeste et icônes", () => {
  it("contient ce qu'il faut pour être installable, avec des chemins relatifs (site dans un sous-dossier GitHub Pages)", () => {
    expect(manifest.name && manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    for (const k of ["start_url", "scope", "id"]) expect(manifest[k]).toMatch(/^\.\//);
    for (const i of manifest.icons) expect(i.src.startsWith("/")).toBe(false);
  });
  it("fournit des icônes PNG 192 et 512 dont les dimensions réelles correspondent, dont une « maskable »", () => {
    for (const i of manifest.icons) {
      expect(existsSync(`web/${i.src}`), i.src).toBe(true);
      const p = png(i.src), [w, h] = i.sizes.split("x").map(Number);
      expect(p.sig).toBe("89504e470d0a1a0a");
      expect([p.w, p.h]).toEqual([w, h]);
    }
    const sizes = manifest.icons.filter((i: any) => i.purpose === "any").map((i: any) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((i: any) => i.purpose === "maskable")).toBe(true);
    expect(png("icons/apple-touch-icon.png")).toMatchObject({ w: 180, h: 180 });
  });
  it("est relié depuis la page, et le service worker met en cache des fichiers qui existent", () => {
    const html = readFileSync("web/index.html", "utf8");
    expect(html).toContain('rel="manifest" href="./manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    const shell: string[] = JSON.parse(/const SHELL = (\[.*?\]);/s.exec(readFileSync("web/sw.js", "utf8"))![1]);
    for (const f of shell) expect(existsSync(f === "./" ? "web/index.html" : `web/${f}`), f).toBe(true);
  });
});

describe("logo et icônes du site", () => {
  const html = readFileSync("web/index.html", "utf8");
  it("le logo sert de favicon (ico + PNG 16/32), d'icône iOS, d'icône d'application et d'image d'en-tête", () => {
    expect(html).toContain('rel="icon" href="./favicon.ico"');
    expect(png("icons/favicon-32.png")).toMatchObject({ w: 32, h: 32 });
    expect(png("icons/favicon-16.png")).toMatchObject({ w: 16, h: 16 });
    const ico = readFileSync("web/favicon.ico"); expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, ico.readUInt16LE(2)]); expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(3);          // plusieurs tailles dans le .ico
    expect(html).toMatch(/<img class="logo" src="\.\/icons\/icon-192\.png"/);
    expect(html).not.toContain("data:image/svg+xml");              // plus de vieille icône « T » dessinée à la main
  });
  it("toutes les icônes référencées par la page existent", () => {
    for (const m of html.matchAll(/(?:href|src)="(\.\/[^"]+\.(?:png|ico))"/g)) expect(existsSync(`web/${m[1].slice(2)}`), m[1]).toBe(true);
  });
  it("les icônes pleines (maskable, iOS) n'ont pas de transparence ; l'icône normale a des coins arrondis transparents", () => {
    const color = (f: string) => readFileSync(`web/${f}`)[25];     // type de couleur PNG : 2 = RVB, 6 = RVBA
    expect(color("icons/icon-maskable-512.png")).toBe(2);
    expect(color("icons/apple-touch-icon.png")).toBe(2);
    expect(color("icons/icon-512.png")).toBe(6);
  });
});

describe("service worker", () => {
  function boot(fetchImpl: any) {
    const store = new Map<string, any>(), handlers: Record<string, Function> = {};
    const norm = (r: any) => (typeof r === "string" ? r : r.url);
    const cache = { addAll: async (l: string[]) => l.forEach((u) => store.set(new URL(u, "https://u.github.io/techinfo/").href, new Response("shell"))), put: async (r: any, v: any) => { store.set(norm(r), v); }, };
    const caches = { open: async () => cache, keys: async () => ["techinfo-v0", "techinfo-v1"], delete: vi.fn(async () => true), match: async (r: any) => store.get(norm(r)) };
    const self = { location: { origin: "https://u.github.io" }, addEventListener: (t: string, f: Function) => { handlers[t] = f; }, skipWaiting: vi.fn(), clients: { claim: vi.fn() } };
    runInNewContext(readFileSync("web/sw.js", "utf8"), { self, caches, fetch: fetchImpl, URL, Response });
    const fetchEvent = (url: string, method = "GET") => { let out: Promise<Response> | undefined; handlers.fetch({ request: { url, method }, respondWith: (p: any) => { out = Promise.resolve(p); } }); return out; };
    return { self, caches, store, handlers, fetchEvent };
  }
  it("en ligne : sert le réseau et garde une copie ; hors ligne : sert la copie", async () => {
    let online = true;
    const sw = boot(async (r: any) => { if (!online) throw new Error("offline"); return new Response(`réseau ${r.url}`); });
    const url = "https://u.github.io/techinfo/data/articles.json";
    expect(await (await sw.fetchEvent(url)!)!.text()).toBe(`réseau ${url}`);
    await new Promise((r) => setTimeout(r, 0));
    online = false;
    expect(await (await sw.fetchEvent(url)!)!.text()).toContain("réseau");
  });
  it("hors ligne et page inconnue : retombe sur la page d'accueil mise en cache à l'installation", async () => {
    const sw = boot(async () => { throw new Error("offline"); });
    await sw.handlers.install({ waitUntil: (p: any) => p });
    await new Promise((r) => setTimeout(r, 0));
    sw.store.set("./index.html", new Response("accueil"));
    expect(await (await sw.fetchEvent("https://u.github.io/techinfo/inconnue")!)!.text()).toBe("accueil");
  });
  it("ignore les écritures et les autres sites (modèle de traduction, CDN)", () => {
    const sw = boot(async () => new Response("x"));
    expect(sw.fetchEvent("https://u.github.io/techinfo/a", "POST")).toBeUndefined();
    expect(sw.fetchEvent("https://huggingface.co/Xenova/opus-mt-fr-en/resolve/main/x.onnx")).toBeUndefined();
    expect(sw.fetchEvent("https://cdn.jsdelivr.net/npm/x.js")).toBeUndefined();
  });
  it("les logos viennent du cache sans recharger, et leur cache survit à l'activation", async () => {
    const fetchSpy = vi.fn(async () => new Response("logo"));
    const sw = boot(fetchSpy);
    const store = new Map<string, Response>(), logos = { match: async (r: any) => store.get(r.url)?.clone(), put: async (r: any, v: Response) => { store.set(r.url, v); } };
    sw.caches.open = (async () => logos) as any;
    const url = "https://u.github.io/techinfo/data/logos/a-1234.png";
    expect(await (await sw.fetchEvent(url)!)!.text()).toBe("logo");
    expect(await (await sw.fetchEvent(url)!)!.text()).toBe("logo");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    sw.caches.keys = (async () => ["techinfo-v0", "techinfo-logos-v1"]) as any;
    await sw.handlers.activate({ waitUntil: (p: any) => p });
    expect(sw.caches.delete).not.toHaveBeenCalledWith("techinfo-logos-v1");
  });
  it("à l'activation, supprime les anciens caches", async () => {
    const sw = boot(async () => new Response("x"));
    await sw.handlers.activate({ waitUntil: (p: any) => p });
    expect(sw.caches.delete).toHaveBeenCalledWith("techinfo-v0");
    expect(sw.caches.delete).not.toHaveBeenCalledWith("techinfo-v1");
  });
});
