import { api, peekUpdates, applyUpdates } from "./api.js";
import { t as tr, detectLang, catLabel, localizeReason, localizeBriefingSummary, CAT_KEYS, LANGS } from "./i18n.js";
import { service } from "./translate.js";
import { MODEL_MB } from "./constants.js";

// ---------- réglages (gardés dans ce navigateur) ----------
const SKEY = "techinfo:settings:v1";
const DEFAULTS = () => ({ lang: detectLang(), show: "all", auto: false, modelOk: false, theme: "auto", size: "m", density: "comfortable", summary: "3", home: "foryou", sort: "date", minLevel: "minor", hideRead: false, muted: [], layout: "cards", groupDays: true, swipeRight: "favorite", swipeLeft: "read", openIn: "tab", onboarded: false });
const settings = DEFAULTS();
try { Object.assign(settings, JSON.parse(localStorage.getItem(SKEY) || "{}")); } catch { /* réglages par défaut */ }
const SWIPE = ["favorite", "read", "share", "off"];
const pick = (v, list, d) => (list.includes(v) ? v : d);
function sanitize() {
  const d = DEFAULTS();
  settings.lang = pick(settings.lang, LANGS, d.lang); settings.show = pick(settings.show, ["all", "fr", "en"], "all");
  settings.theme = pick(settings.theme, ["auto", "light", "dark"], "auto"); settings.size = pick(settings.size, ["s", "m", "l"], "m");
  settings.density = pick(settings.density, ["comfortable", "compact"], "comfortable"); settings.summary = pick(String(settings.summary), ["off", "2", "3", "5", "full"], "3");
  settings.home = pick(settings.home, ["briefing", "foryou", "explore"], "foryou"); settings.sort = pick(settings.sort, ["date", "score"], "date");
  settings.minLevel = pick(settings.minLevel, ["minor", "follow", "important", "critical"], "minor");
  settings.auto = !!settings.auto; settings.modelOk = !!settings.modelOk; settings.hideRead = !!settings.hideRead;
  if (!Array.isArray(settings.muted)) settings.muted = [];
  settings.layout = pick(settings.layout, ["cards", "compact"], "cards"); settings.groupDays = settings.groupDays !== false; settings.onboarded = !!settings.onboarded;
  settings.swipeRight = pick(settings.swipeRight, SWIPE, "favorite"); settings.swipeLeft = pick(settings.swipeLeft, SWIPE, "read"); settings.openIn = pick(settings.openIn, ["tab", "same"], "tab");
}
sanitize();
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { /* ignoré */ } };
const t = (k, v) => tr(settings.lang, k, v);
const $ = (id) => document.getElementById(id);
const LEVEL = { critical: 3, important: 2, follow: 1, minor: 0 };
const PAGE = 30;
const state = { view: settings.home, cat: "", favTab: "saved", me: null, seq: 0, offset: 0, more: false, loading: false, restore: null };

const COLORS = { light: "#e9eef2", dark: "#0e1923" };
function applyAppearance() {
  const r = document.documentElement;
  r.dataset.theme = settings.theme; r.dataset.size = settings.size; r.dataset.density = settings.density; r.dataset.summary = settings.summary; r.dataset.layout = settings.layout;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", settings.theme === "auto" ? ((m.getAttribute("media") || "").includes("dark") ? COLORS.dark : COLORS.light) : COLORS[settings.theme]));
}

// ---------- outils ----------
const absDate = (d) => new Intl.DateTimeFormat(settings.lang, { dateStyle: "full", timeStyle: "short" }).format(d);
const shortDate = (d) => new Intl.DateTimeFormat(settings.lang, { day: "numeric", month: "short" }).format(d);
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === "class") n.className = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); }
  for (const c of kids) n.append(c);
  return n;
}
const safeHref = (u) => (/^https?:\/\//i.test(u) ? u : "#");
function ext(href, label, cls = "") {
  const a = el("a", { class: cls, href: safeHref(href), target: "_blank", rel: "noopener noreferrer" }, label);
  a.addEventListener("click", () => { a.target = settings.openIn === "same" ? "_self" : "_blank"; saveScroll(); }); // « même onglet » : le retour retrouve la place
  return a;
}
const say = (msg, err) => { const s = $("status"); s.textContent = msg; s.className = err ? "err" : ""; };
const toast = (msg) => { const n = $("toast"); n.textContent = msg || ""; n.hidden = !msg; };
let notifyTimer; const notify = (msg, ms = 1600) => { toast(msg); clearTimeout(notifyTimer); notifyTimer = setTimeout(() => toast(""), ms); };
const jsonBody = (b, method = "POST") => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const call = async (path, opts) => { try { return await (await api(path, opts)).json(); } catch (e) { throw new Error(t("err", { n: String(e.message).replace(/\D+/g, "") || "?" })); } };
const followed = () => state.me?.categories ?? [];
const needsTr = (a) => LANGS.includes(a.lang) && a.lang !== settings.lang;
const visible = (a) => (settings.show === "all" || a.lang === settings.show) && !settings.muted.includes(a.source_name) && LEVEL[a.importance] >= LEVEL[settings.minLevel];
const field = (label, control) => el("label", { class: "field" }, el("span", {}, label), control);
const hint = (txt) => el("p", { class: "hint" }, txt);
const dirFor = () => (settings.lang === "fr" ? ["en", "fr"] : ["fr", "en"]);

function applyStatic() {
  document.documentElement.lang = settings.lang; document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach((n) => n.setAttribute("placeholder", t(n.dataset.i18nPh)));
  document.querySelectorAll("[data-i18n-aria]").forEach((n) => n.setAttribute("aria-label", t(n.dataset.i18nAria)));
  if (state.me?.updated_at) { const st = state.me.status; $("foot").textContent = t("footer", { date: absDate(new Date(state.me.updated_at)), sources: st ? t("footerSources", { ok: st.sources_ok, total: st.sources_total }) : "" }); }
}
function ago(a) {
  const iso = a.published_at ?? a.collected_at, m = (Date.now() - Date.parse(iso)) / 60000, rtf = new Intl.RelativeTimeFormat(settings.lang, { numeric: "auto" });
  const s = m < 60 ? rtf.format(-Math.max(1, Math.round(m)), "minute") : m < 1440 ? rtf.format(-Math.round(m / 60), "hour") : m < 10080 ? rtf.format(-Math.round(m / 1440), "day") : shortDate(new Date(iso));
  return a.published_at ? s : t("collected", { when: s });
}

// ---------- traduction : une seule à la fois, hors de l'interface, annulée quand on change de page ----------
let trGen = 0, observer = null, trChain = Promise.resolve();
function cancelTranslations() { trGen++; observer?.disconnect(); observer = null; }
async function ensureEngine(from, to, interactive) {
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { await service.prepare(from, to, { allowModel: settings.modelOk, interactive, onProgress: (pct) => toast(t("trProgress", { pct: Math.round(pct) })) }); return true; }
      catch (e) {
        if (e.message === "model-consent" && interactive && confirm(t("confirmModel", { mb: MODEL_MB }))) { settings.modelOk = true; save(); continue; }
        if (e.message === "no-engine") say(t("engineNone"), true); else if (e.message !== "model-consent") say(t("trError"), true);
        return false;
      }
    }
    return false;
  } finally { toast(""); }
}
async function translateOne(a, ctx, interactive) {
  const hit = service.cached(a.id, settings.lang);
  if (hit) { a._tr = hit; return true; }
  const [from, to] = [a.lang, settings.lang];
  try {
    if (!service.isReady(from, to) && !(await ensureEngine(from, to, interactive))) return false;
    ctx.art.setAttribute("aria-busy", "true"); ctx.trBtn.disabled = true; ctx.trBtn.textContent = t("translating");
    a._tr = await service.translateArticle(a.id, { title: a.title, summary: a.summary }, from, to);
    return true;
  } catch { say(t("trError"), true); return false; }
  finally { ctx.art.removeAttribute("aria-busy"); ctx.trBtn.disabled = false; ctx.paint(); }
}
async function toggleTr(a, ctx) {
  if (a._shown === "tr") { a._shown = "orig"; return ctx.paint(); }
  if (!a._tr && !(await translateOne(a, ctx, true))) return;
  a._shown = "tr"; ctx.paint();
}
function enqueue(art, gen) {
  trChain = trChain.then(async () => {
    const a = art._a;
    if (gen !== trGen || !document.contains(art) || a._shown === "tr") return;
    if (await translateOne(a, art._ctx, false)) { a._shown = "tr"; art._ctx.paint(); }
    await new Promise((r) => setTimeout(r, 0)); // laisse respirer l'interface entre deux traductions
  }).catch(() => {});
}
function watchForAuto(art) {
  if (!settings.auto || !needsTr(art._a)) return;
  const gen = trGen;
  if (typeof IntersectionObserver === "undefined") return enqueue(art, gen);
  observer ??= new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { observer.unobserve(e.target); enqueue(e.target, gen); } }), { rootMargin: "300px" });
  observer.observe(art);
}

// ---------- cartes ----------
const THRESH = 80, dayKey = (a) => { const d = new Date(a.published_at ?? a.collected_at); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
function dayLabel(a) {
  const d = new Date(a.published_at ?? a.collected_at), n = new Date(), start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), diff = Math.round((start(n) - start(d)) / 864e5);
  if (diff <= 0) return t("today"); if (diff === 1) return t("yesterday");
  return new Intl.DateTimeFormat(settings.lang, { weekday: "long", day: "numeric", month: "long" }).format(d);
}
async function copyLink(url) {
  try { await navigator.clipboard.writeText(url); }
  catch { const ta = el("textarea", { readonly: "", style: "position:fixed;opacity:0" }); ta.value = url; document.body.append(ta); ta.select(); try { document.execCommand("copy"); } catch { /* ignoré */ } ta.remove(); }
  notify(t("linkCopied"));
}
async function shareArticle(a) {
  if (navigator.share) { try { await navigator.share({ title: a.title, url: a.url }); return; } catch (e) { if (e?.name === "AbortError") return; } }
  await copyLink(a.url);
}
function dropRow(art) { const prev = art.previousElementSibling; art.remove(); if (prev?.classList.contains("day") && prev.nextElementSibling?.tagName !== "ARTICLE") prev.remove(); }
async function setFav(a, art, on) {
  a.favorite = on ? 1 : 0; art._paintFav();
  try { await call(`/api/articles/${a.id}/state`, jsonBody({ favorite: on })); } catch (e) { say(e.message, true); }
  if (!on && state.view === "favorites" && state.favTab === "saved") { dropRow(art); if (!$("list").querySelector("article")) say(t("noSaved")); }
}
async function mark(a, art, isRead) {
  a.is_read = isRead ? 1 : 0; art.classList.toggle("read", isRead); art._paintRead();
  try { await call(`/api/articles/${a.id}/state`, jsonBody({ is_read: isRead })); } catch (e) { say(e.message, true); }
}
async function runSwipe(a, art, act) {
  if (act === "favorite") { await setFav(a, art, !a.favorite); notify(t(a.favorite ? "toastFavOn" : "toastFavOff")); }
  else if (act === "read") { await mark(a, art, !a.is_read); notify(t(a.is_read ? "toastRead" : "toastUnread")); }
  else if (act === "share") await shareArticle(a);
}
/** Balayage tactile : l'action de chaque sens se règle dans Réglages. Le défilement vertical n'est jamais gêné. */
function attachSwipe(art, a) {
  let id = null, x0 = 0, y0 = 0, mode = null, dx = 0;
  const reset = () => { id = null; mode = null; dx = 0; art.removeAttribute("data-swipe"); art.removeAttribute("data-act"); art.style.removeProperty("--dx"); art.style.removeProperty("--p"); };
  art.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch" || e.target.closest?.(".actions")) return; id = e.pointerId; x0 = e.clientX; y0 = e.clientY; mode = null; dx = 0; });
  art.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (mode === null) {
      if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) { mode = "x"; try { art.setPointerCapture?.(id); } catch { /* ignoré */ } }
      else { if (Math.abs(my) > 12) { id = null; mode = "y"; } return; }
    }
    dx = mx;
    const act = dx > 0 ? settings.swipeRight : settings.swipeLeft;
    if (act === "off") { art.removeAttribute("data-swipe"); art.style.removeProperty("--dx"); return; }
    art.dataset.swipe = dx > 0 ? "right" : "left"; art.dataset.act = act; art.dataset.hint = t(`swHint_${act}`);
    art.style.setProperty("--dx", `${Math.max(-110, Math.min(110, dx * 0.5))}px`); art.style.setProperty("--p", String(Math.min(1, Math.abs(dx) / THRESH)));
  });
  art.addEventListener("pointerup", (e) => {
    if (e.pointerId !== id) return;
    const moved = mode === "x", d = dx; reset();
    if (!moved) return;
    art._swipedAt = Date.now();
    if (Math.abs(d) >= THRESH) runSwipe(a, art, d > 0 ? settings.swipeRight : settings.swipeLeft);
  });
  art.addEventListener("pointercancel", reset);
}
function card(a) {
  const art = el("article", { class: `card ${a.importance}${a.is_read ? " read" : ""}` });
  const detail = el("div", { class: "detail", hidden: "" });
  const title = el("button", { type: "button", "aria-expanded": "false", onclick: async () => {
    if (Date.now() - (art._swipedAt ?? 0) < 400) return; // un balayage ne doit pas ouvrir la carte
    const show = detail.hidden;
    if (show && !detail.dataset.loaded) { try { fill(detail, await call(`/api/articles/${a.id}`)); detail.dataset.loaded = "1"; } catch (e) { say(e.message, true); return; } }
    detail.hidden = !show; art.classList.toggle("open", show); title.setAttribute("aria-expanded", String(show));
    if (show && !a.is_read) mark(a, art, true);
  } });
  const sum = a.summary ? el("p", { class: "sum" }) : null;
  const trBtn = el("button", { class: "btn btn-tr", type: "button", onclick: () => toggleTr(a, ctx) });
  const trBadge = el("span", { class: "tr-badge", hidden: "" }, t("translated"));
  const paint = () => {
    const on = !!a._tr && a._shown === "tr";
    title.textContent = on ? a._tr.title : a.title;
    if (sum) sum.textContent = on ? (a._tr.summary ?? a.summary) : a.summary;
    trBtn.textContent = on ? t("showOriginal") : t("translate"); trBtn.hidden = !needsTr(a); trBadge.hidden = !on;
    art.setAttribute("lang", on ? settings.lang : (a.lang || settings.lang));
  };
  const ctx = { art, paint, trBtn }; art._a = a; art._ctx = ctx;
  const fav = el("button", { class: "icon-btn btn-fav", type: "button", onclick: () => setFav(a, art, !a.favorite) });
  art._paintFav = () => { fav.setAttribute("aria-pressed", String(!!a.favorite)); fav.setAttribute("aria-label", t(a.favorite ? "favOnAria" : "favAddAria")); fav.textContent = a.favorite ? "★" : "☆"; };
  const read = el("button", { class: "icon-btn btn-read", type: "button", onclick: () => mark(a, art, !a.is_read) });
  art._paintRead = () => { read.setAttribute("aria-pressed", String(!!a.is_read)); read.setAttribute("aria-label", t(a.is_read ? "markUnreadAria" : "markReadAria")); read.textContent = "✓"; };
  const share = el("button", { class: "icon-btn btn-share", type: "button", "aria-label": t("shareAria"), onclick: () => shareArticle(a) }, "↗");
  art._paintFav(); art._paintRead();
  const when = a.published_at ?? a.collected_at;
  art.append(
    el("div", { class: "meta" }, el("span", { class: `lvl ${a.importance}` }, t(`lvl_${a.importance}`)), el("span", {}, `${a.source_name}${a.source_count > 1 ? ` +${a.source_count - 1}` : ""}`), el("span", {}, catLabel(settings.lang, a.category)), el("time", { datetime: when, title: absDate(new Date(when)) }, ago(a)), trBadge),
    el("h2", {}, title), ...(sum ? [sum] : []), detail,
    el("div", { class: "actions" }, ext(a.url, t("readSource"), "btn primary"), trBtn, share, fav, read));
  if (needsTr(a) && settings.auto) { const hit = service.cached(a.id, settings.lang); if (hit) { a._tr = hit; a._shown = "tr"; } }
  attachSwipe(art, a);
  paint();
  return art;
}
function fill(d, a) {
  const level = a.score >= 60 ? t("high") : a.score >= 40 ? t("mid") : t("low");
  d.replaceChildren(el("p", { class: "meta" }, `${a.summary ? t("summaryNote") : t("noSummaryNote")}${t("interest", { level, score: a.score })}`));
  if (a.reasons?.length) d.append(el("p", {}, t("why", { list: a.reasons.map((r) => localizeReason(settings.lang, r)).join(", ") })));
  if (a.cvss != null) d.append(el("p", {}, t("cvss", { score: a.cvss, src: a.cvss_source })));
  d.append(el("p", {}, t("sources")), el("ul", {}, ...a.sources.map((s) => el("li", {}, ext(s.url, s.name)))));
  if (a.links?.length) d.append(el("p", {}, t("techLinks")), el("ul", {}, ...a.links.map((l) => el("li", {}, ext(l, l)))));
  d.append(el("button", { class: "btn btn-copy", type: "button", onclick: () => copyLink(a.url) }, t("copyLink")));
}
function resetList() { const l = $("list"); l.replaceChildren(); delete l.dataset.day; }
function addCards(list, items, group) {
  for (const a of items) {
    if (group) { const k = dayKey(a); if (list.dataset.day !== k) { list.dataset.day = k; list.append(el("h3", { class: "day" }, dayLabel(a))); } }
    const c = card(a); list.append(c); watchForAuto(c);
  }
}
function archivedCard(a) {
  return el("article", { class: "card" }, el("h2", {}, a.title), el("div", { class: "meta" }, `${a.source_name} · ${a.published_at ? shortDate(new Date(a.published_at)) : t("dateUnknown")}`),
    el("div", { class: "actions" }, ext(a.url, t("readSource"), "btn primary"), el("button", { class: "btn", type: "button", onclick: async () => { await call(`/api/bookmarks/${a.id}`, { method: "DELETE" }); load(); } }, t("del"))));
}

// ---------- chargement des vues (défilement infini) ----------
const skeletons = (n) => Array.from({ length: n }, () => el("div", { class: "card skel", "aria-hidden": "true" }, el("div", { class: "sk l1" }), el("div", { class: "sk l2" }), el("div", { class: "sk l3" })));
const dropSkeletons = () => $("list").querySelectorAll(".skel").forEach((n) => n.remove());
let io = null;
const updateMore = () => { $("more").hidden = !(state.more && !io); }; // le bouton ne sert que si le navigateur n'a pas l'observateur de défilement
function params(reset, limit) {
  const p = new URLSearchParams({ limit: String(limit), offset: String(reset ? 0 : state.offset) });
  const q = $("q").value.trim(); if (q) p.set("q", q);
  if (state.view === "favorites") { p.set("favorites", "1"); return p; }
  if (state.cat) p.set("category", state.cat); else if (state.view === "foryou" && followed().length) p.set("cats", followed().join(","));
  if (settings.show !== "all") p.set("lang", settings.show);
  if (settings.minLevel !== "minor") p.set("minlevel", settings.minLevel);
  if (settings.hideRead) p.set("unread", "1");
  if (settings.muted.length) p.set("mute", JSON.stringify(settings.muted));
  p.set("sort", settings.sort);
  return p;
}
function setBanner(node) { const b = $("banner"); b.replaceChildren(...(node ? [node] : [])); b.hidden = !node; }
async function load(reset = true) {
  if (!reset && (state.loading || !state.more)) return;
  const seq = ++state.seq, list = $("list"), live = () => seq === state.seq;
  const restore = reset ? state.restore : null; if (reset) state.restore = null;
  const restoreY = () => { if (restore?.y) window.scrollTo(0, restore.y); };
  cancelTranslations(); state.loading = true; state.more = false; updateMore(); setBanner(null);
  list.setAttribute("aria-busy", "true"); say(t("loading"));
  if (reset) { resetList(); if (state.view !== "settings") list.append(...skeletons(state.view === "briefing" ? 3 : 4)); } else list.append(...skeletons(2));
  try {
    if (state.view === "settings") { say(""); return void (await renderSettings(seq)); }
    if (state.view === "briefing") {
      const { briefing: b } = await call("/api/briefing"); if (!live()) return;
      dropSkeletons();
      if (!b) return say(t("noBriefing"));
      say(t("briefingOf", { day: b.day, summary: localizeBriefingSummary(settings.lang, b.summary) }) + (b.topics.length ? t("topics", { list: b.topics.map((x) => `${x.word} (${x.count})`).join(", ") }) : ""));
      addCards(list, b.items.filter(visible), false); return restoreY();
    }
    if (state.view === "favorites" && state.favTab !== "saved") {
      const { items } = await call(state.favTab === "archived" ? "/api/bookmarks" : "/api/history"); if (!live()) return;
      dropSkeletons(); state.favTab === "archived" ? items.forEach((a) => list.append(archivedCard(a))) : addCards(list, items, false);
      say(items.length ? "" : t(state.favTab === "archived" ? "noArchived" : "noHistory")); return restoreY();
    }
    if (state.view === "foryou" && !followed().length && !state.cat) setBanner(el("div", {}, el("p", {}, t("forYouEmpty")), el("button", { class: "btn", type: "button", onclick: () => go("settings") }, t("goSettings"))));
    const fav = state.view === "favorites", limit = fav ? 100 : reset ? Math.min(Math.max(PAGE, restore?.loaded ?? 0), 300) : PAGE;
    const { items } = await call(`/api/articles?${params(reset, limit)}`); if (!live()) return;
    dropSkeletons();
    addCards(list, items, fav ? settings.groupDays : settings.groupDays && settings.sort === "date"); state.offset = (reset ? 0 : state.offset) + items.length;
    state.more = !fav && items.length >= limit; updateMore();
    say(list.querySelector("article") ? "" : t(fav ? "noSaved" : "noResults")); restoreY();
  } catch (e) { if (live()) say(e.message, true); }
  finally { if (live()) { state.loading = false; list.setAttribute("aria-busy", "false"); dropSkeletons(); } }
}

// ---------- adresse partageable et retour qui garde la place ----------
const VIEWS = [["briefing", "tabBriefing"], ["foryou", "tabForYou"], ["explore", "tabExplore"], ["favorites", "tabSaved"], ["settings", "tabSettings"]];
const FILTER_VIEWS = ["foryou", "explore", "favorites"];
const FAV_TABS = ["saved", "archived", "history"];
function hashOf() {
  const p = new URLSearchParams(), q = FILTER_VIEWS.includes(state.view) ? $("q").value.trim() : "";
  if (q) p.set("q", q); if (state.view === "favorites" && state.favTab !== "saved") p.set("tab", state.favTab);
  const qs = p.toString(); return `#/${state.view}${state.cat ? `/${state.cat}` : ""}${qs ? `?${qs}` : ""}`;
}
function parseHash(h = location.hash) {
  const m = /^#\/([a-z]+)(?:\/([a-z-]+))?(?:\?(.*))?$/.exec(h);
  if (!m || !VIEWS.some(([v]) => v === m[1])) return null;
  const p = new URLSearchParams(m[3] ?? "");
  return { view: m[1], cat: CAT_KEYS.includes(m[2]) ? m[2] : "", q: (p.get("q") ?? "").slice(0, 100), tab: FAV_TABS.includes(p.get("tab")) ? p.get("tab") : "saved" };
}
function saveScroll() { try { history.replaceState({ y: window.scrollY, loaded: $("list").querySelectorAll("article").length }, ""); } catch { /* ignoré */ } }
function pushRoute(replace = false) {
  const url = hashOf(); if (location.hash === url) return;
  if (!replace) saveScroll(); // mémorise la place de la page qu'on quitte
  try { history[replace ? "replaceState" : "pushState"]({ y: 0, loaded: 0 }, "", url); } catch { /* ignoré */ }
}
function go(view, cat = "") { state.view = view; state.cat = cat; state.restore = null; pushRoute(); renderChrome(); load(); window.scrollTo({ top: 0 }); }

// ---------- navigation ----------
const activeFilters = () => [settings.minLevel !== "minor", settings.hideRead, settings.sort === "score", settings.show !== "all", settings.muted.length > 0].filter(Boolean).length;
function renderChrome() {
  $("tabbar").replaceChildren(...VIEWS.map(([v, k]) => el("button", { type: "button", "data-view": v, "aria-current": String(state.view === v), onclick: () => go(v) }, t(k))));
  $("q").hidden = !FILTER_VIEWS.includes(state.view); $("filterBtn").hidden = !FILTER_VIEWS.slice(0, 2).includes(state.view); if ($("filterBtn").hidden) $("filters").classList.remove("open");
  const n = activeFilters(); $("filterBtn").textContent = n ? t("filtersN", { n }) : t("filters"); $("filterBtn").classList.toggle("on", n > 0);
  renderFilters(); renderChips(); renderSubtabs();
  document.documentElement.style.setProperty("--hh", `${$("top").offsetHeight}px`);
}
function renderChips() {
  const chips = $("chips"), fol = followed(), foryou = state.view === "foryou";
  const keys = foryou ? fol : [...fol, ...CAT_KEYS.filter((k) => !fol.includes(k))];
  chips.hidden = !(foryou || state.view === "explore") || !keys.length; chips.replaceChildren();
  if (chips.hidden) return;
  [["", t("allChip")], ...keys.map((k) => [k, catLabel(settings.lang, k)])].forEach(([k, v]) => chips.append(el("button", { class: `chip${fol.includes(k) && k ? " star" : ""}`, type: "button", "data-cat": k, "aria-current": String(state.cat === k), onclick: () => go(state.view, k) }, v)));
  const cur = chips.querySelector("[aria-current=true]"); if (cur) chips.scrollLeft = Math.max(0, cur.offsetLeft - 40);
}
function renderSubtabs() {
  const sb = $("subtabs"); sb.hidden = state.view !== "favorites"; sb.replaceChildren();
  if (sb.hidden) return;
  [["saved", "savedTab"], ["archived", "archivedTab"], ["history", "historyTab"]].forEach(([k, l]) => sb.append(el("button", { type: "button", "data-fav": k, "aria-current": String(state.favTab === k), onclick: () => { state.favTab = k; state.restore = null; pushRoute(); renderSubtabs(); load(); } }, t(l))));
}
function select(value, options, onchange, label) {
  return el("select", { ...(label ? { "aria-label": label } : {}), onchange: (e) => onchange(e.target.value) }, ...options.map(([v, l]) => el("option", { value: v, ...(v === String(value) ? { selected: "" } : {}) }, l)));
}
function check(checked, label, onchange) { return el("label", { class: "check" }, el("input", { type: "checkbox", ...(checked ? { checked: "" } : {}), onchange: (e) => onchange(e.target.checked, e.target) }), label); }
function renderFilters() {
  const refresh = () => { save(); renderChrome(); load(); };
  $("filters").replaceChildren(
    select(settings.minLevel, ["minor", "follow", "important", "critical"].map((k) => [k, t(`minl_${k}`)]), (v) => { settings.minLevel = v; refresh(); }, t("minLevelLabel")),
    select(settings.sort, [["date", t("sortDate")], ["score", t("sortScore")]], (v) => { settings.sort = v; refresh(); }, t("sortLabel")),
    select(settings.layout, [["cards", t("layoutCards")], ["compact", t("layoutCompact")]], (v) => { settings.layout = v; save(); applyAppearance(); }, t("layoutLabel")),
    check(settings.hideRead, t("unread"), (v) => { settings.hideRead = v; refresh(); }));
}
async function togglePref(cat, on) {
  const sel = new Set(followed()); on ? sel.add(cat) : sel.delete(cat);
  state.me.categories = CAT_KEYS.filter((k) => sel.has(k));
  try { await call("/api/prefs", jsonBody({ categories: state.me.categories }, "PUT")); } catch (e) { say(e.message, true); }
  renderChips();
}

// ---------- installation comme application ----------
let installEvent = null;
const standalone = () => !!(window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone);
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent || "") && !standalone();
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; });
window.addEventListener("appinstalled", () => { installEvent = null; });
function installItem() {
  if (standalone()) return hint(t("installed"));
  if (installEvent) return el("button", { class: "btn", type: "button", onclick: async () => { const ev = installEvent; installEvent = null; await ev.prompt(); renderSettings(state.seq); } }, t("install"));
  if (isIos()) return hint(t("installIos"));
  return null;
}

// ---------- page Réglages ----------
async function renderSettings(seq) {
  const { items: srcs } = await call("/api/sources");
  if (seq !== state.seq) return;
  const again = () => renderSettings(state.seq);
  const section = (title, ...kids) => el("section", { class: "set" }, el("h2", {}, title), ...kids.filter(Boolean));
  const opt = (key, after) => (v) => { settings[key] = v; sanitize(); save(); after?.(); };
  const look = opt("theme", () => { applyAppearance(); renderChrome(); }), engine = hint("…");
  const full = () => { applyStatic(); renderChrome(); again(); };
  const swipeOpts = SWIPE.map((k) => [k, t(`sw_${k}`)]);
  const auto = check(settings.auto, t("auto"), async (on, box) => {
    settings.auto = on;
    if (on && !(await ensureEngine(...dirFor(), true))) { settings.auto = false; box.checked = false; }
    if (!settings.auto) { cancelTranslations(); service.release?.(); }
    save();
  });
  service.engineInfo(...dirFor()).then((i) => { engine.textContent = i.kind === "chrome" ? t("engineChrome") : i.kind === "model" ? t("engineModel", { mb: MODEL_MB }) : t("engineNone"); });
  const muteBoxes = srcs.map((s) => check(!settings.muted.includes(s.name), el("span", {}, s.name), (on) => { settings.muted = on ? settings.muted.filter((n) => n !== s.name) : [...new Set([...settings.muted, s.name])]; save(); renderChrome(); }));
  muteBoxes.forEach((b, i) => b.append(el("span", { class: "tag" }, srcs[i].lang.toUpperCase())));
  $("list").replaceChildren(
    section(t("setLanguage"),
      field(t("langLabel"), select(settings.lang, [["fr", "Français"], ["en", "English"]], opt("lang", full))),
      field(t("showLang"), select(settings.show, [["all", t("showAll")], ["fr", t("showFr")], ["en", t("showEn")]], opt("show", () => renderChrome())))),
    section(t("setTranslation"), auto, engine, hint(t("trNote")), el("button", { class: "btn", type: "button", onclick: () => { service.clearCache(); say(t("clearedTr")); } }, t("clearTr"))),
    section(t("setCats"), hint(t("catsHelp")), el("div", { class: "grid" }, ...CAT_KEYS.map((k) => check(followed().includes(k), catLabel(settings.lang, k), (on) => togglePref(k, on))))),
    section(t("setSources"), hint(t("sourcesHelp")), el("div", { class: "grid" }, ...muteBoxes), el("button", { class: "btn", type: "button", onclick: () => { settings.muted = []; save(); renderChrome(); again(); } }, t("unmuteAll"))),
    section(t("setDisplay"),
      field(t("theme"), select(settings.theme, [["auto", t("themeAuto")], ["light", t("themeLight")], ["dark", t("themeDark")]], look)),
      field(t("textSize"), select(settings.size, [["s", t("sizeS")], ["m", t("sizeM")], ["l", t("sizeL")]], opt("size", applyAppearance))),
      field(t("density"), select(settings.density, [["comfortable", t("densComfort")], ["compact", t("densCompact")]], opt("density", applyAppearance))),
      field(t("layoutLabel"), select(settings.layout, [["cards", t("layoutCards")], ["compact", t("layoutCompact")]], opt("layout", () => { applyAppearance(); renderChrome(); }))),
      field(t("summaryLines"), select(settings.summary, [["off", t("sumOff")], ["2", t("sum2")], ["3", t("sum3")], ["5", t("sum5")], ["full", t("sumFull")]], opt("summary", applyAppearance))),
      check(settings.groupDays, t("groupDays"), (on) => { settings.groupDays = on; save(); })),
    section(t("setGestures"), hint(t("swipeHelp")),
      field(t("swipeRight"), select(settings.swipeRight, swipeOpts, opt("swipeRight"))),
      field(t("swipeLeft"), select(settings.swipeLeft, swipeOpts, opt("swipeLeft"))),
      field(t("openIn"), select(settings.openIn, [["tab", t("openTab")], ["same", t("openSame")]], opt("openIn")))),
    section(t("setHome"),
      field(t("homeLabel"), select(settings.home, [["briefing", t("homeBriefing")], ["foryou", t("homeForYou")], ["explore", t("homeExplore")]], opt("home"))),
      field(t("sortLabel"), select(settings.sort, [["date", t("sortDate")], ["score", t("sortScore")]], opt("sort", () => renderChrome()))),
      field(t("minLevelLabel"), select(settings.minLevel, ["minor", "follow", "important", "critical"].map((k) => [k, t(`minl_${k}`)]), opt("minLevel", () => renderChrome()))),
      check(settings.hideRead, t("unread"), (on) => { settings.hideRead = on; save(); renderChrome(); }),
      el("button", { class: "btn", type: "button", onclick: () => openWelcome() }, t("redoWelcome"))),
    section(t("setApp"), installItem() ?? hint("")),
    section(t("setData"),
      el("button", { class: "btn", type: "button", onclick: () => { if (!confirm(t("confirmReset"))) return; Object.assign(settings, DEFAULTS(), { onboarded: true }); sanitize(); save(); applyAppearance(); full(); } }, t("resetSettings")),
      el("button", { class: "btn", type: "button", onclick: async () => { if (!confirm(t("confirmData"))) return; await call("/api/data", { method: "DELETE" }); service.clearCache(); say(t("done")); } }, t("resetData"))));
}

// ---------- premier lancement guidé ----------
function openWelcome() {
  const d = $("welcome"), sel = new Set(followed()); let finishBtn;
  const finish = async () => {
    state.me.categories = CAT_KEYS.filter((k) => sel.has(k));
    try { await call("/api/prefs", jsonBody({ categories: state.me.categories }, "PUT")); } catch (e) { say(e.message, true); }
    settings.onboarded = true; save(); d.close?.(); d.removeAttribute("open"); go(settings.home);
  };
  const render = () => {
    finishBtn = el("button", { class: "btn primary", type: "button", id: "welcome-finish", onclick: finish }, t("finish")); finishBtn.disabled = sel.size === 0;
    d.replaceChildren(el("h2", { id: "welcome-title" }, t("welcomeTitle")), hint(t("welcomeIntro")),
      field(t("langLabel"), select(settings.lang, [["fr", "Français"], ["en", "English"]], (v) => { settings.lang = v; save(); applyStatic(); renderChrome(); render(); })),
      field(t("theme"), select(settings.theme, [["auto", t("themeAuto")], ["light", t("themeLight")], ["dark", t("themeDark")]], (v) => { settings.theme = v; save(); applyAppearance(); })),
      el("h3", {}, t("welcomeCats")),
      el("div", { class: "grid" }, ...CAT_KEYS.map((k) => check(sel.has(k), catLabel(settings.lang, k), (on) => { on ? sel.add(k) : sel.delete(k); finishBtn.disabled = sel.size === 0; }))),
      el("button", { class: "btn", type: "button", onclick: () => { CAT_KEYS.forEach((k) => sel.add(k)); render(); } }, t("selectAll")),
      hint(t("welcomeNeedOne")), finishBtn,
      el("button", { class: "btn", type: "button", id: "welcome-skip", onclick: () => { settings.onboarded = true; save(); d.close?.(); d.removeAttribute("open"); } }, t("skip")));
  };
  render();
  if (!d.open) { try { d.showModal(); } catch { d.setAttribute("open", ""); } }
}

// ---------- nouveaux articles pendant la lecture ----------
let lastCheck = 0, freshItems = [];
function showFresh() { const b = $("fresh"), n = freshItems.length; b.hidden = !n; if (n) b.textContent = t(n === 1 ? "freshOne" : "freshMany", { n }); }
async function checkFresh() {
  if (!state.me || Date.now() - lastCheck < 30e3) return;
  lastCheck = Date.now();
  try { const { items } = await peekUpdates(); freshItems = items.filter(visible); showFresh(); if (!freshItems.length && items.length === 0) return; } catch { /* hors ligne : on réessaiera */ }
}
async function applyFresh() {
  applyUpdates(); freshItems = []; showFresh();
  try { state.me = { ...state.me, ...(await call("/api/me")) }; applyStatic(); } catch { /* ignoré */ }
  state.restore = null; load(); window.scrollTo({ top: 0 });
}

// ---------- démarrage ----------
function refreshFromSearch() { if (state.view === "briefing" || state.view === "settings") state.view = "explore"; state.restore = null; pushRoute(true); renderChrome(); load(); }
let timer; $("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(refreshFromSearch, 300); });
$("filterBtn").addEventListener("click", () => { const o = $("filters").classList.toggle("open"); $("filterBtn").setAttribute("aria-expanded", String(o)); document.documentElement.style.setProperty("--hh", `${$("top").offsetHeight}px`); });
$("more").addEventListener("click", () => load(false));
$("fresh").addEventListener("click", applyFresh);
if (typeof IntersectionObserver !== "undefined") { io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) load(false); }, { rootMargin: "600px" }); io.observe($("sentinel")); }
try { history.scrollRestoration = "manual"; } catch { /* ignoré */ }
let scrollTimer; window.addEventListener("scroll", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(saveScroll, 150); }, { passive: true });
window.addEventListener("pagehide", saveScroll);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveScroll(); else checkFresh(); });
window.addEventListener("focus", checkFresh); window.addEventListener("resize", () => document.documentElement.style.setProperty("--hh", `${$("top").offsetHeight}px`));
setInterval(checkFresh, 300e3);
window.addEventListener("popstate", (e) => {
  const r = parseHash() ?? { view: settings.home, cat: "", q: "", tab: "saved" };
  state.view = r.view; state.cat = r.cat; state.favTab = r.tab; $("q").value = r.q;
  state.restore = e.state && typeof e.state.y === "number" ? e.state : null;
  renderChrome(); load();
});
$("welcome").addEventListener("close", () => { if (!settings.onboarded) { settings.onboarded = true; save(); } });
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("./sw.js").catch(() => {});
applyAppearance(); applyStatic();
{ const r = parseHash();
  if (r) { state.view = r.view; state.cat = r.cat; state.favTab = r.tab; $("q").value = r.q; if (typeof history.state?.y === "number") state.restore = history.state; }
  else { state.view = settings.home; try { history.replaceState({ y: 0, loaded: 0 }, "", hashOf()); } catch { /* ignoré */ } } }
try {
  state.me = await call("/api/me"); applyStatic(); renderChrome(); await load();
  if (!settings.onboarded && !followed().length) openWelcome();
} catch (e) { say(e.message, true); }
