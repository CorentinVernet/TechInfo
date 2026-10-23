// Remplace le serveur : lit data/articles.json et garde l'état personnel (lu, favoris, préférences) dans le navigateur.
const KEY = "techinfo:v1";
const store = { read: {}, fav: {}, opened: [], cats: [] };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* stockage indisponible */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignoré */ } };
export const norm = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

let data, byKey, byNum, srcName, norms, srcsOf;
async function load() {
  if (data) return;
  const r = await fetch("data/articles.json", { cache: "no-cache" });
  if (!r.ok) throw new Error("Données indisponibles");
  data = await r.json();
  srcName = new Map(data.sources.map((s) => [s.id, s.name]));
  byKey = new Map(data.articles.map((a) => [a.key, a]));
  byNum = new Map(data.articles.map((a) => [a.id, a]));
  norms = new Map(data.articles.map((a) => [a.key, norm(`${a.title} ${srcName.get(a.source_id) ?? ""}`)]));
  srcsOf = new Map();
  for (const x of data.article_sources) {
    if (!srcsOf.has(x.article_id)) srcsOf.set(x.article_id, []);
    srcsOf.get(x.article_id).push({ name: srcName.get(x.source_id) ?? "?", url: x.url, published_at: x.published_at });
  }
}
// L'identifiant exposé à l'interface est la clé stable de l'article (survit à une reconstruction des données).
const view = (a) => ({ ...a, id: a.key, source_name: srcName.get(a.source_id) ?? "?", source_count: (srcsOf.get(a.id) ?? []).length, is_read: store.read[a.key] ? 1 : 0, favorite: store.fav[a.key] ? 1 : 0 });
const ts = (a) => Date.parse(a.sort_ts);
const ok = (v) => ({ ok: true, status: 200, json: async () => v });
const fail = (status) => { throw new Error(`Erreur ${status}`); };

export async function api(path, opts = {}) {
  await load();
  const u = new URL(path, "http://local"), p = u.searchParams, method = (opts.method ?? "GET").toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : null, parts = u.pathname.split("/").filter(Boolean);
  if (u.pathname === "/api/me") return ok({ email: "visiteur", role: "user", categories: store.cats, static: true, updated_at: data.generated_at, status: data.status });
  if (u.pathname === "/api/prefs" && method === "PUT") { store.cats = (body?.categories ?? []).filter((c) => typeof c === "string"); save(); return ok({ ok: true }); }
  if (u.pathname === "/api/articles") {
    const tokens = norm(p.get("q") ?? "").split(" ").filter(Boolean).slice(0, 5);
    let items = data.articles.filter((a) => (!p.get("category") || a.category === p.get("category")) && (!p.get("level") || a.importance === p.get("level")) && (!p.get("unread") || !store.read[a.key]) && (!p.get("favorites") || store.fav[a.key]) && tokens.every((t) => norms.get(a.key).includes(t)));
    if (p.get("sort") === "score") { const b = data.config?.prefBonus ?? 10, sc = (a) => a.score + (store.cats.includes(a.category) ? b : 0); items = items.sort((x, y) => sc(y) - sc(x) || ts(y) - ts(x)); }
    else items = items.sort((x, y) => ts(y) - ts(x));
    const limit = Math.min(Math.max(parseInt(p.get("limit")) || 30, 1), 100), offset = Math.max(parseInt(p.get("offset")) || 0, 0);
    return ok({ items: items.slice(offset, offset + limit).map(view) });
  }
  if (parts[1] === "articles" && parts[2] && /^[0-9a-f]+$/.test(parts[2])) {
    const a = byKey.get(parts[2]); if (!a) fail(404);
    if (parts[3] === "state" && method === "POST") {
      if (typeof body?.is_read === "boolean") { if (body.is_read) store.read[a.key] = 1; else delete store.read[a.key]; }
      if (typeof body?.favorite === "boolean") {
        if (body.favorite) store.fav[a.key] = { id: a.key, url: a.url, title: a.title, source_name: srcName.get(a.source_id) ?? "?", published_at: a.published_at };
        else delete store.fav[a.key];
      }
      save(); return ok({ ok: true });
    }
    if (!parts[3]) {
      store.opened = [{ k: a.key, t: Date.now() }, ...store.opened.filter((o) => o.k !== a.key)].slice(0, 50); save();
      return ok({ ...view(a), sources: srcsOf.get(a.id) ?? [] });
    }
  }
  if (u.pathname === "/api/history") return ok({ items: store.opened.map((o) => byKey.get(o.k)).filter(Boolean).slice(0, 30).map(view) });
  if (u.pathname === "/api/bookmarks") return ok({ items: Object.values(store.fav).filter((f) => !byKey.has(f.id)) }); // favoris dont l'article n'est plus publié
  if (parts[1] === "bookmarks" && parts[2] && method === "DELETE") { delete store.fav[parts[2]]; save(); return ok({ ok: true }); }
  if (u.pathname === "/api/briefing") {
    const b = data.briefing;
    return ok({ briefing: b ? { day: b.day, generated_at: b.generated_at, summary: b.summary, topics: b.topics, items: b.ids.map((id) => byNum.get(id)).filter(Boolean).map(view) } : null });
  }
  return fail(404);
}
