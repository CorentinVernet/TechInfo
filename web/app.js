import { api } from "./api.js";
import { t as tr, detectLang, catLabel, localizeReason, localizeBriefingSummary, CAT_KEYS, LANGS } from "./i18n.js";
import { service } from "./translate.js";
import { MODEL_MB } from "./constants.js";

// ---------- réglages (gardés dans ce navigateur) ----------
const SKEY = "techinfo:settings:v1";
const DEFAULTS = () => ({ lang: detectLang(), show: "all", auto: false, modelOk: false, theme: "auto", size: "m", density: "comfortable", summary: "3", home: "foryou", sort: "date", minLevel: "minor", hideRead: false, muted: [] });
const settings = DEFAULTS();
try { Object.assign(settings, JSON.parse(localStorage.getItem(SKEY) || "{}")); } catch { /* réglages par défaut */ }
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
}
sanitize();
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { /* ignoré */ } };
const t = (k, v) => tr(settings.lang, k, v);
const $ = (id) => document.getElementById(id);
const LEVEL = { critical: 3, important: 2, follow: 1, minor: 0 };
const state = { view: settings.home, cat: "", favTab: "saved", me: null, seq: 0, offset: 0 };

const COLORS = { light: "#e9eef2", dark: "#0e1923" };
function applyAppearance() {
  const r = document.documentElement;
  r.dataset.theme = settings.theme; r.dataset.size = settings.size; r.dataset.density = settings.density; r.dataset.summary = settings.summary;
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
const ext = (href, label, cls = "") => el("a", { class: cls, href: safeHref(href), target: "_blank", rel: "noopener noreferrer" }, label);
const say = (msg, err) => { const s = $("status"); s.textContent = msg; s.className = err ? "err" : ""; };
const toast = (msg) => { const n = $("toast"); n.textContent = msg || ""; n.hidden = !msg; };
const jsonBody = (b, method = "POST") => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const call = async (path, opts) => { try { return await (await api(path, opts)).json(); } catch (e) { throw new Error(t("err", { n: String(e.message).replace(/\D+/g, "") || "?" })); } };
const followed = () => state.me?.categories ?? [];
const needsTr = (a) => LANGS.includes(a.lang) && a.lang !== settings.lang;
const visible = (a) => (settings.show === "all" || a.lang === settings.show) && !settings.muted.includes(a.source_name) && LEVEL[a.importance] >= LEVEL[settings.minLevel];
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
function card(a) {
  const art = el("article", { class: `card ${a.importance}${a.is_read ? " read" : ""}` });
  const detail = el("div", { class: "detail", hidden: "" });
  const title = el("button", { type: "button", "aria-expanded": "false", onclick: async () => {
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
  const fav = el("button", { class: "icon-btn btn-fav", type: "button", onclick: async () => {
    a.favorite = a.favorite ? 0 : 1; paintFav();
    try { await call(`/api/articles/${a.id}/state`, jsonBody({ favorite: !!a.favorite })); } catch (e) { say(e.message, true); }
    if (!a.favorite && state.view === "favorites" && state.favTab === "saved") { art.remove(); if (!$("list").children.length) say(t("noSaved")); }
  } });
  const paintFav = () => { fav.setAttribute("aria-pressed", String(!!a.favorite)); fav.setAttribute("aria-label", t(a.favorite ? "favOnAria" : "favAddAria")); fav.textContent = a.favorite ? "★" : "☆"; };
  const read = el("button", { class: "icon-btn btn-read", type: "button", onclick: () => mark(a, art, !a.is_read) });
  art._paintRead = () => { read.setAttribute("aria-pressed", String(!!a.is_read)); read.setAttribute("aria-label", t(a.is_read ? "markUnreadAria" : "markReadAria")); read.textContent = "✓"; };
  paintFav(); art._paintRead();
  const when = a.published_at ?? a.collected_at;
  art.append(
    el("div", { class: "meta" }, el("span", { class: `lvl ${a.importance}` }, t(`lvl_${a.importance}`)), el("span", {}, `${a.source_name}${a.source_count > 1 ? ` +${a.source_count - 1}` : ""}`), el("span", {}, catLabel(settings.lang, a.category)), el("time", { datetime: when, title: absDate(new Date(when)) }, ago(a)), trBadge),
    el("h2", {}, title), ...(sum ? [sum] : []), detail,
    el("div", { class: "actions" }, ext(a.url, t("readSource"), "btn primary"), trBtn, fav, read));
  if (needsTr(a) && settings.auto) { const hit = service.cached(a.id, settings.lang); if (hit) { a._tr = hit; a._shown = "tr"; } }
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
}
async function mark(a, art, isRead) {
  a.is_read = isRead ? 1 : 0; art.classList.toggle("read", isRead); art._paintRead();
  try { await call(`/api/articles/${a.id}/state`, jsonBody({ is_read: isRead })); } catch (e) { say(e.message, true); }
}
function addCards(list, items) { for (const a of items) { const c = card(a); list.append(c); watchForAuto(c); } }
function archivedCard(a) {
  return el("article", { class: "card" }, el("h2", {}, a.title), el("div", { class: "meta" }, `${a.source_name} · ${a.published_at ? shortDate(new Date(a.published_at)) : t("dateUnknown")}`),
    el("div", { class: "actions" }, ext(a.url, t("readSource"), "btn primary"), el("button", { class: "btn", type: "button", onclick: async () => { await call(`/api/bookmarks/${a.id}`, { method: "DELETE" }); load(); } }, t("del"))));
}

// ---------- chargement des vues ----------
function params(reset) {
  const p = new URLSearchParams({ limit: state.view === "favorites" ? "100" : "30", offset: String(reset ? 0 : state.offset) });
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
  const seq = ++state.seq, list = $("list"), live = () => seq === state.seq;
  cancelTranslations(); $("more").hidden = true; setBanner(null); say(t("loading"));
  try {
    if (state.view === "settings") { say(""); return void (await renderSettings(seq)); }
    if (state.view === "briefing") {
      const { briefing: b } = await call("/api/briefing"); if (!live()) return;
      list.replaceChildren();
      if (!b) return say(t("noBriefing"));
      say(t("briefingOf", { day: b.day, summary: localizeBriefingSummary(settings.lang, b.summary) }) + (b.topics.length ? t("topics", { list: b.topics.map((x) => `${x.word} (${x.count})`).join(", ") }) : ""));
      return addCards(list, b.items.filter(visible));
    }
    if (state.view === "favorites" && state.favTab !== "saved") {
      const { items } = await call(state.favTab === "archived" ? "/api/bookmarks" : "/api/history"); if (!live()) return;
      list.replaceChildren(); state.favTab === "archived" ? items.forEach((a) => list.append(archivedCard(a))) : addCards(list, items);
      return say(items.length ? "" : t(state.favTab === "archived" ? "noArchived" : "noHistory"));
    }
    if (state.view === "foryou" && !followed().length && !state.cat) setBanner(el("div", {}, el("p", {}, t("forYouEmpty")), el("button", { class: "btn", type: "button", onclick: () => go("settings") }, t("goSettings"))));
    const { items } = await call(`/api/articles?${params(reset)}`); if (!live()) return;
    if (reset) { list.replaceChildren(); state.offset = 0; }
    addCards(list, items); state.offset += items.length;
    $("more").hidden = state.view === "favorites" || items.length < 30;
    say(list.children.length ? "" : t(state.view === "favorites" ? "noSaved" : "noResults"));
  } catch (e) { if (live()) say(e.message, true); }
}

// ---------- navigation ----------
const VIEWS = [["briefing", "tabBriefing"], ["foryou", "tabForYou"], ["explore", "tabExplore"], ["favorites", "tabSaved"], ["settings", "tabSettings"]];
const FILTER_VIEWS = ["foryou", "explore", "favorites"];
const activeFilters = () => [settings.minLevel !== "minor", settings.hideRead, settings.sort === "score", settings.show !== "all", settings.muted.length > 0].filter(Boolean).length;
function go(view, cat = "") { state.view = view; state.cat = cat; renderChrome(); load(); window.scrollTo({ top: 0 }); }
function renderChrome() {
  $("tabbar").replaceChildren(...VIEWS.map(([v, k]) => el("button", { type: "button", "data-view": v, "aria-current": String(state.view === v), onclick: () => go(v) }, t(k))));
  const showSearch = FILTER_VIEWS.includes(state.view);
  $("q").hidden = !showSearch; $("filterBtn").hidden = !FILTER_VIEWS.slice(0, 2).includes(state.view); if ($("filterBtn").hidden) $("filters").classList.remove("open");
  const n = activeFilters(); $("filterBtn").textContent = n ? t("filtersN", { n }) : t("filters"); $("filterBtn").classList.toggle("on", n > 0);
  renderFilters(); renderChips(); renderSubtabs();
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
  const s = $("subtabs"); s.hidden = state.view !== "favorites"; s.replaceChildren();
  if (s.hidden) return;
  [["saved", "savedTab"], ["archived", "archivedTab"], ["history", "historyTab"]].forEach(([k, l]) => s.append(el("button", { type: "button", "data-fav": k, "aria-current": String(state.favTab === k), onclick: () => { state.favTab = k; renderSubtabs(); load(); } }, t(l))));
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
    check(settings.hideRead, t("unread"), (v) => { settings.hideRead = v; refresh(); }));
}
async function togglePref(cat, on) {
  const s = new Set(followed()); on ? s.add(cat) : s.delete(cat);
  state.me.categories = CAT_KEYS.filter((k) => s.has(k));
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
  if (standalone()) return el("p", { class: "hint" }, t("installed"));
  if (installEvent) return el("button", { class: "btn", type: "button", onclick: async () => { const ev = installEvent; installEvent = null; await ev.prompt(); renderSettings(state.seq); } }, t("install"));
  if (isIos()) return el("p", { class: "hint" }, t("installIos"));
  return null;
}

// ---------- page Réglages ----------
async function renderSettings(seq) {
  const { items: srcs } = await call("/api/sources");
  if (seq !== state.seq) return;
  const again = () => renderSettings(state.seq);
  const field = (label, control) => el("label", { class: "field" }, el("span", {}, label), control);
  const section = (title, ...kids) => el("section", { class: "set" }, el("h2", {}, title), ...kids.filter(Boolean));
  const hint = (txt) => el("p", { class: "hint" }, txt);
  const opt = (key, list, after) => (v) => { settings[key] = v; sanitize(); save(); after?.(); };
  const look = opt("theme", null, () => { applyAppearance(); renderChrome(); }), engine = hint("…");
  const full = () => { applyStatic(); renderChrome(); again(); };
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
      field(t("langLabel"), select(settings.lang, [["fr", "Français"], ["en", "English"]], opt("lang", null, full))),
      field(t("showLang"), select(settings.show, [["all", t("showAll")], ["fr", t("showFr")], ["en", t("showEn")]], opt("show", null, () => renderChrome())))),
    section(t("setTranslation"), auto, engine, hint(t("trNote")), el("button", { class: "btn", type: "button", onclick: () => { service.clearCache(); say(t("clearedTr")); } }, t("clearTr"))),
    section(t("setCats"), hint(t("catsHelp")), el("div", { class: "grid" }, ...CAT_KEYS.map((k) => check(followed().includes(k), catLabel(settings.lang, k), (on) => togglePref(k, on))))),
    section(t("setSources"), hint(t("sourcesHelp")), el("div", { class: "grid" }, ...muteBoxes), el("button", { class: "btn", type: "button", onclick: () => { settings.muted = []; save(); renderChrome(); again(); } }, t("unmuteAll"))),
    section(t("setDisplay"),
      field(t("theme"), select(settings.theme, [["auto", t("themeAuto")], ["light", t("themeLight")], ["dark", t("themeDark")]], look)),
      field(t("textSize"), select(settings.size, [["s", t("sizeS")], ["m", t("sizeM")], ["l", t("sizeL")]], opt("size", null, applyAppearance))),
      field(t("density"), select(settings.density, [["comfortable", t("densComfort")], ["compact", t("densCompact")]], opt("density", null, applyAppearance))),
      field(t("summaryLines"), select(settings.summary, [["off", t("sumOff")], ["2", t("sum2")], ["3", t("sum3")], ["5", t("sum5")], ["full", t("sumFull")]], opt("summary", null, applyAppearance)))),
    section(t("setHome"),
      field(t("homeLabel"), select(settings.home, [["briefing", t("homeBriefing")], ["foryou", t("homeForYou")], ["explore", t("homeExplore")]], opt("home", null))),
      field(t("sortLabel"), select(settings.sort, [["date", t("sortDate")], ["score", t("sortScore")]], opt("sort", null, () => renderChrome()))),
      field(t("minLevelLabel"), select(settings.minLevel, ["minor", "follow", "important", "critical"].map((k) => [k, t(`minl_${k}`)]), opt("minLevel", null, () => renderChrome()))),
      check(settings.hideRead, t("unread"), (on) => { settings.hideRead = on; save(); renderChrome(); })),
    section(t("setApp"), installItem() ?? hint("")),
    section(t("setData"),
      el("button", { class: "btn", type: "button", onclick: () => { if (!confirm(t("confirmReset"))) return; Object.assign(settings, DEFAULTS()); sanitize(); save(); applyAppearance(); full(); } }, t("resetSettings")),
      el("button", { class: "btn", type: "button", onclick: async () => { if (!confirm(t("confirmData"))) return; await call("/api/data", { method: "DELETE" }); service.clearCache(); say(t("done")); } }, t("resetData"))));
}

// ---------- démarrage ----------
function refreshFromSearch() { if (state.view === "briefing" || state.view === "settings") state.view = "explore"; renderChrome(); load(); }
let timer; $("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(refreshFromSearch, 300); });
$("filterBtn").addEventListener("click", () => { const o = $("filters").classList.toggle("open"); $("filterBtn").setAttribute("aria-expanded", String(o)); });
$("more").addEventListener("click", () => load(false));
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("./sw.js").catch(() => {});
applyAppearance(); applyStatic();
try { state.me = await call("/api/me"); applyStatic(); renderChrome(); load(); } catch (e) { say(e.message, true); }
