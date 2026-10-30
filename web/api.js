// Remplace le serveur : lit data/articles.json et garde l'état personnel (lu, favoris, préférences) dans le navigateur.
import { migrateCats } from "./i18n.js";
import { analyze, dayId, matchesTopic, norm, streak, suits, trending, weekly } from "./insights.js";
export { norm };
const KEY = "techinfo:v1";
const store = { read: {}, fav: {}, opened: [], cats: [], topics: [], topicSeen: {}, seen: {}, days: {}, best: 0 };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || "{}")); store.cats = migrateCats(store.cats); } catch { /* stockage indisponible */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignoré */ } };
/** Journal d'activité (compteurs par jour, 90 jours au plus) : il sert à la série et au bilan. */
function bump(change) {
  const id = dayId(), d = store.days[id] ??= { read: 0, stories: 0, cats: {} };
  change(d);
  const old = dayId(new Date(Date.now() - 90 * 864e5));
  for (const k of Object.keys(store.days)) if (k < old) delete store.days[k];
  store.best = Math.max(store.best ?? 0, streak(store.days));
}
/** « Non lu » annule le compteur du jour de la lecture (les marques d'avant ce journal valent 1 : rien à annuler). */
function unbump(day, category) {
  const d = store.days[day];
  if (!d) return;
  d.read = Math.max(0, (d.read ?? 0) - 1);
  if (d.cats?.[category] > 1) d.cats[category]--; else if (d.cats) delete d.cats[category];
}
const isStr = (v) => typeof v === "string";
const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const isKey = (k) => /^[0-9a-f]+$/.test(k);
const cleanFav = (f) => (f && isStr(f.id) && isStr(f.title) && /^https?:\/\//i.test(f.url ?? "") ? { id: f.id, url: f.url, title: f.title, source_name: isStr(f.source_name) ? f.source_name : "?", published_at: isStr(f.published_at) ? f.published_at : null } : null);
const cleanDay = (d) => ({ read: count(d?.read), stories: count(d?.stories), cats: Object.fromEntries(Object.entries(d?.cats ?? {}).filter(([, n]) => count(n)).map(([c, n]) => [c, count(n)])), ...(Array.isArray(d?.quiz) && d.quiz.length === 2 ? { quiz: [count(d.quiz[0]), count(d.quiz[1])] } : {}) });
/** Fusion d'un export : rien n'est perdu sur l'appareil, et chaque valeur reçue est vérifiée. */
function mergeData(x) {
  for (const k of Object.keys(x?.read ?? {})) if (isKey(k)) store.read[k] ??= 1;
  for (const k of Object.keys(x?.seen ?? {})) if (isKey(k)) store.seen[k] = 1;
  for (const [k, f] of Object.entries(x?.fav ?? {})) { const c = cleanFav(f); if (c && isKey(k) && !store.fav[k]) store.fav[k] = c; }
  store.cats = migrateCats([...store.cats, ...(Array.isArray(x?.cats) ? x.cats : [])]);
  store.topics = [...new Set([...store.topics, ...(Array.isArray(x?.topics) ? x.topics : []).filter(isStr).map((s) => norm(s).slice(0, 60)).filter(Boolean)])].slice(0, 50);
  const seenKeys = new Set(store.opened.map((o) => o.k));
  store.opened = [...store.opened, ...(Array.isArray(x?.opened) ? x.opened : []).filter((o) => isStr(o?.k) && !seenKeys.has(o.k) && Number.isFinite(o.t)).map((o) => ({ k: o.k, t: o.t }))].sort((p, q) => q.t - p.t).slice(0, 50);
  for (const [day, d] of Object.entries(x?.days ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const inc = cleanDay(d), cur = store.days[day];
    if (!cur) { store.days[day] = inc; continue; } // le même jour vu des deux côtés : on garde le plus grand compteur
    cur.read = Math.max(cur.read ?? 0, inc.read); cur.stories = Math.max(cur.stories ?? 0, inc.stories);
    for (const [c, n] of Object.entries(inc.cats)) cur.cats[c] = Math.max(cur.cats[c] ?? 0, n);
    if (inc.quiz && !cur.quiz) cur.quiz = inc.quiz;
  }
  store.best = Math.max(store.best ?? 0, count(x?.best), streak(store.days));
}

let data, byKey, byNum, srcName, srcLogo, norms, readings, srcsOf, perSource, trends, pending = null;
const fetchData = async () => { const r = await fetch("data/articles.json", { cache: "no-cache" }); if (!r.ok) throw new Error("Données indisponibles"); return r.json(); };
function index(d) {
  data = d;
  srcName = new Map(d.sources.map((s) => [s.id, s.name]));
  srcLogo = new Map(d.sources.map((s) => [s.id, s.logo ?? null]));
  readings = new Map(d.articles.map((a) => [a.key, analyze(a)]));
  trends = null;
  byKey = new Map(d.articles.map((a) => [a.key, a]));
  byNum = new Map(d.articles.map((a) => [a.id, a]));
  norms = new Map(d.articles.map((a) => [a.key, norm(`${a.title} ${srcName.get(a.source_id) ?? ""}`)]));
  perSource = new Map();
  for (const a of d.articles) perSource.set(a.source_id, (perSource.get(a.source_id) ?? 0) + 1);
  srcsOf = new Map();
  for (const x of d.article_sources) {
    if (!srcsOf.has(x.article_id)) srcsOf.set(x.article_id, []);
    srcsOf.get(x.article_id).push({ name: srcName.get(x.source_id) ?? "?", url: x.url, published_at: x.published_at });
  }
}
async function load() { if (!data) index(await fetchData()); }
/** Regarde si le site a été mis à jour depuis le chargement ; renvoie les articles nouveaux (sans les appliquer). */
export async function peekUpdates() {
  await load();
  const fresh = await fetchData();
  if (!fresh.generated_at || fresh.generated_at <= data.generated_at) return { items: [] };
  pending = fresh;
  const names = new Map(fresh.sources.map((s) => [s.id, s.name]));
  return { items: fresh.articles.filter((a) => !byKey.has(a.key)).map((a) => ({ ...a, id: a.key, source_name: names.get(a.source_id) ?? "?", reading: analyze(a) })) };
}
export function applyUpdates() { if (!pending) return false; index(pending); pending = null; return true; }
// L'identifiant exposé à l'interface est la clé stable de l'article (survit à une reconstruction des données).
const view = (a) => ({ ...a, id: a.key, source_name: srcName.get(a.source_id) ?? "?", source_logo: srcLogo.get(a.source_id) ?? null, reading: readings.get(a.key), source_count: (srcsOf.get(a.id) ?? []).length, seen: store.seen[a.key] ? 1 : 0, is_read: store.read[a.key] ? 1 : 0, favorite: store.fav[a.key] ? 1 : 0 });
const ts = (a) => Date.parse(a.sort_ts);
const LV = { critical: 3, important: 2, follow: 1, minor: 0 };
const safe = (v, d) => { try { return typeof v === "string" ? JSON.parse(v) : (v ?? d); } catch { return d; } };
const ok = (v) => ({ ok: true, status: 200, json: async () => v });
const fail = (status) => { throw new Error(`Erreur ${status}`); };

export async function api(path, opts = {}) {
  await load();
  const u = new URL(path, "http://local"), p = u.searchParams, method = (opts.method ?? "GET").toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : null, parts = u.pathname.split("/").filter(Boolean);
  if (u.pathname === "/api/me") return ok({ email: "visiteur", role: "user", categories: store.cats, topics: store.topics, static: true, updated_at: data.generated_at, status: data.status });
  if (u.pathname === "/api/prefs" && method === "PUT") { store.cats = (body?.categories ?? []).filter((c) => typeof c === "string"); save(); return ok({ ok: true }); }
  if (u.pathname === "/api/sources") return ok({ items: data.sources.filter((s) => s.enabled !== 0).map((s) => ({ id: s.id, name: s.name, logo: s.logo ?? null, lang: s.lang, categories: safe(s.categories, []), last_success_at: s.last_success_at ?? null, last_error: s.last_error ?? null, count: perSource.get(s.id) ?? 0 })).sort((x, y) => x.name.localeCompare(y.name)) });
  if (u.pathname === "/api/data" && method === "DELETE") { store.read = {}; store.fav = {}; store.opened = []; store.seen = {}; store.days = {}; store.best = 0; save(); return ok({ ok: true }); }
  if (u.pathname === "/api/export") return ok({ read: store.read, fav: store.fav, opened: store.opened, cats: store.cats, topics: store.topics, seen: store.seen, days: store.days, best: store.best });
  if (u.pathname === "/api/import" && method === "POST") { mergeData(body); save(); return ok({ ok: true, categories: store.cats, topics: store.topics }); }
  if (u.pathname === "/api/trends") { trends ??= trending(data.articles); return ok({ items: trends }); }
  if (u.pathname === "/api/topics") {
    const topic = norm(body?.topic ?? p.get("topic") ?? "").slice(0, 60);
    if (method === "POST") { if (topic && !store.topics.includes(topic)) { store.topics = [...store.topics, topic].slice(0, 50); store.topicSeen[topic] = Date.now(); save(); } return ok({ ok: true }); }
    if (method === "DELETE") { store.topics = store.topics.filter((x) => x !== topic); delete store.topicSeen[topic]; save(); return ok({ ok: true }); }
    if (method === "PUT") { if (store.topics.includes(topic)) { store.topicSeen[topic] = Date.now(); save(); } return ok({ ok: true }); }
    return ok({ items: store.topics.map((t) => { const seen = store.topicSeen[t] ?? 0, hits = data.articles.filter((a) => matchesTopic(norms.get(a.key), t)); return { topic: t, count: hits.length, fresh: hits.filter((a) => Date.parse(a.collected_at) > seen).length }; }) });
  }
  if (u.pathname === "/api/stats") { const d = store.days[dayId()]; return ok({ streak: streak(store.days), best: store.best ?? 0, week: weekly(store.days), quiz: d?.quiz ?? null, stories: d?.stories ?? 0 }); }
  if (u.pathname === "/api/quiz" && method === "POST") { bump((d) => { d.quiz ??= [count(body?.ok), count(body?.total)]; }); save(); return ok({ ok: true }); }
  // Le briefing d'abord, puis les mieux classés des 3 derniers jours : l'interface garde la variété (2 stories par source) et le niveau de lecture réduit souvent le briefing.
  if (u.pathname === "/api/stories") {
    const reader = p.get("reader"), fits = (x) => !reader || suits(readings.get(x.key), reader), chosen = (data.briefing?.ids ?? []).map((id) => byNum.get(id)).filter((x) => x && fits(x));
    const old = Date.now() - 3 * 864e5; chosen.push(...data.articles.filter((x) => fits(x) && !chosen.includes(x) && ts(x) >= old).sort((x, y) => y.score - x.score).slice(0, 40));
    return ok({ items: chosen.map(view) });
  }
  if (u.pathname === "/api/stories/seen" && method === "POST") { if (byKey.has(body?.id)) { store.seen[body.id] = 1; save(); } return ok({ ok: true }); }
  if (u.pathname === "/api/stories/done" && method === "POST") { bump((d) => { d.stories = 1; }); save(); return ok({ ok: true }); }
  if (u.pathname === "/api/articles") {
    const tokens = norm(p.get("q") ?? "").split(" ").filter(Boolean).slice(0, 5);
    const cats = (p.get("cats") ?? "").split(",").filter(Boolean), topics = safe(p.get("topics"), []), reader = p.get("reader"), mute = new Set(safe(p.get("mute"), [])), minLevel = LV[p.get("minlevel")] ?? 0;
    let items = data.articles.filter((a) => (!p.get("category") || a.category === p.get("category")) && ((!cats.length && !topics.length) || cats.includes(a.category) || topics.some((t) => matchesTopic(norms.get(a.key), t))) && (!reader || suits(readings.get(a.key), reader)) && LV[a.importance] >= minLevel && !mute.has(srcName.get(a.source_id)) && (!p.get("level") || a.importance === p.get("level")) && (!p.get("lang") || a.lang === p.get("lang")) && (!p.get("unread") || !store.read[a.key]) && (!p.get("favorites") || store.fav[a.key]) && tokens.every((t) => norms.get(a.key).includes(t)));
    if (p.get("sort") === "score") { const b = data.config?.prefBonus ?? 10, sc = (a) => a.score + (store.cats.includes(a.category) ? b : 0); items = items.sort((x, y) => sc(y) - sc(x) || ts(y) - ts(x)); }
    else items = items.sort((x, y) => ts(y) - ts(x));
    const limit = Math.min(Math.max(parseInt(p.get("limit")) || 30, 1), 100), offset = Math.max(parseInt(p.get("offset")) || 0, 0);
    return ok({ items: items.slice(offset, offset + limit).map(view) });
  }
  if (parts[1] === "articles" && parts[2] && /^[0-9a-f]+$/.test(parts[2])) {
    const a = byKey.get(parts[2]); if (!a) fail(404);
    if (parts[3] === "state" && method === "POST") {
      if (typeof body?.is_read === "boolean") { if (body.is_read) { if (!store.read[a.key]) { bump((d) => { d.read = (d.read ?? 0) + 1; d.cats[a.category] = (d.cats[a.category] ?? 0) + 1; }); store.read[a.key] = dayId(); } }
        else { unbump(store.read[a.key], a.category); delete store.read[a.key]; } }
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
