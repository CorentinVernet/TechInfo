import { api } from "./api.js";
import { t as tr, detectLang, catLabel, localizeReason, localizeBriefingSummary, CAT_KEYS, LANGS } from "./i18n.js";
import { service, MODEL_MB } from "./translate.js";

const SKEY = "techinfo:settings:v1";
const settings = { lang: detectLang(), show: "all", auto: false, modelOk: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SKEY) || "{}")); } catch { /* réglages par défaut */ }
if (!LANGS.includes(settings.lang)) settings.lang = detectLang();
const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { /* ignoré */ } };
const t = (k, v) => tr(settings.lang, k, v);
const $ = (id) => document.getElementById(id);
const state = { view: "briefing", cat: "", offset: 0, me: null };
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
const jsonBody = (b, method = "POST") => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const call = async (path, opts) => { try { return await (await api(path, opts)).json(); } catch (e) { throw new Error(t("err", { n: String(e.message).replace(/\D+/g, "") || "?" })); } };

function applyStatic() {
  document.documentElement.lang = settings.lang; document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach((n) => n.setAttribute("placeholder", t(n.dataset.i18nPh)));
  document.querySelectorAll("[data-i18n-aria]").forEach((n) => n.setAttribute("aria-label", t(n.dataset.i18nAria)));
  $("langBtn").textContent = settings.lang.toUpperCase();
  paintFooter();
}
function paintFooter() {
  if (!state.me?.updated_at) return;
  const st = state.me.status;
  $("foot").textContent = t("footer", { date: absDate(new Date(state.me.updated_at)), sources: st ? t("footerSources", { ok: st.sources_ok, total: st.sources_total }) : "" });
}

const needsTr = (a) => LANGS.includes(a.lang) && a.lang !== settings.lang;
const showable = (a) => settings.show === "all" || a.lang === settings.show;
function ago(a) {
  const iso = a.published_at ?? a.collected_at, m = (Date.now() - Date.parse(iso)) / 60000, rtf = new Intl.RelativeTimeFormat(settings.lang, { numeric: "auto" });
  const s = m < 60 ? rtf.format(-Math.max(1, Math.round(m)), "minute") : m < 1440 ? rtf.format(-Math.round(m / 60), "hour") : m < 10080 ? rtf.format(-Math.round(m / 1440), "day") : shortDate(new Date(iso));
  return a.published_at ? s : t("collected", { when: s });
}

// ---------- traduction ----------
async function ensureEngine(from, to, interactive) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await service.prepare(from, to, { allowModel: settings.modelOk, interactive, onProgress: (pct) => say(t("downloading", { pct: Math.round(pct) })) }); say(""); return true; }
    catch (e) {
      if (e.message === "model-consent" && interactive && confirm(t("confirmModel", { mb: MODEL_MB }))) { settings.modelOk = true; saveSettings(); continue; }
      if (e.message === "no-engine") say(t("engineNone"), true); else if (e.message !== "model-consent") say(t("trError"), true);
      return false;
    }
  }
  return false;
}
async function translateOne(a, ctx, interactive) {
  const hit = service.cached(a.id, settings.lang);
  if (hit) { a._tr = hit; return true; }
  const from = a.lang, to = settings.lang;
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
async function autoTranslate() {
  if (!settings.auto) return;
  for (const n of [...$("list").querySelectorAll("article")]) {
    const a = n._a; if (!a || !needsTr(a) || a._shown === "tr") continue;
    if (!document.contains(n)) break;
    if (!(await translateOne(a, n._ctx, false))) break;
    a._shown = "tr"; n._ctx.paint();
  }
}

// ---------- cartes ----------
function card(a) {
  const art = el("article", { class: `card ${a.importance}${a.is_read ? " read" : ""}` });
  const detail = el("div", { class: "detail", hidden: "" });
  const title = el("button", { type: "button", "aria-expanded": "false", onclick: async () => {
    const show = detail.hidden;
    if (show && !detail.dataset.loaded) {
      try { fill(detail, await call(`/api/articles/${a.id}`)); detail.dataset.loaded = "1"; } catch (e) { say(e.message, true); return; }
    }
    detail.hidden = !show; art.classList.toggle("open", show); title.setAttribute("aria-expanded", String(show));
    if (show && !a.is_read) mark(a, art, true);
  } });
  const sum = a.summary ? el("p", { class: "sum" }) : null;
  const trBtn = el("button", { class: "btn", type: "button", onclick: () => toggleTr(a, ctx) });
  const trBadge = el("span", { class: "tr-badge", hidden: "" }, t("translated"));
  const paint = () => {
    const on = !!a._tr && a._shown === "tr";
    title.textContent = on ? a._tr.title : a.title;
    if (sum) sum.textContent = on ? (a._tr.summary ?? a.summary) : a.summary;
    trBtn.textContent = on ? t("showOriginal") : t("translate"); trBtn.hidden = !needsTr(a); trBadge.hidden = !on;
    art.setAttribute("lang", on ? settings.lang : (a.lang || settings.lang));
  };
  const ctx = { art, paint, trBtn }; art._a = a; art._ctx = ctx;
  const fav = el("button", { class: "btn", type: "button", onclick: async () => {
    a.favorite = a.favorite ? 0 : 1; paintFav();
    try { await call(`/api/articles/${a.id}/state`, jsonBody({ favorite: !!a.favorite })); } catch (e) { say(e.message, true); }
    if (!a.favorite && state.view === "favorites") art.remove();
  } });
  const paintFav = () => { fav.setAttribute("aria-pressed", String(!!a.favorite)); fav.textContent = a.favorite ? t("favOn") : t("favAdd"); }; paintFav();
  const read = el("button", { class: "btn readbtn", type: "button", onclick: () => mark(a, art, !a.is_read) }, a.is_read ? t("markUnread") : t("markRead"));
  const when = a.published_at ?? a.collected_at;
  art.append(
    el("div", { class: "meta" }, el("span", { class: `badge ${a.importance}` }, t(`lvl_${a.importance}`)), el("span", {}, `${a.source_name}${a.source_count > 1 ? ` +${a.source_count - 1}` : ""}`), el("span", {}, catLabel(settings.lang, a.category)), el("time", { datetime: when, title: absDate(new Date(when)) }, ago(a)), trBadge),
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
  a.is_read = isRead ? 1 : 0; art.classList.toggle("read", isRead);
  art.querySelector(".readbtn").textContent = isRead ? t("markUnread") : t("markRead");
  try { await call(`/api/articles/${a.id}/state`, jsonBody({ is_read: isRead })); } catch (e) { say(e.message, true); }
}

// ---------- vues ----------
const filtersActive = () => [$("level").value, $("unread").checked, $("byscore").checked, settings.show !== "all"].filter(Boolean).length;
function params(reset) {
  const p = new URLSearchParams({ limit: "30", offset: String(reset ? 0 : state.offset) });
  if (state.cat) p.set("category", state.cat);
  if ($("q").value.trim()) p.set("q", $("q").value.trim());
  if ($("level").value) p.set("level", $("level").value);
  if ($("unread").checked) p.set("unread", "1");
  if ($("byscore").checked) p.set("sort", "score");
  if (settings.show !== "all") p.set("lang", settings.show);
  if (state.view === "favorites") p.set("favorites", "1");
  return p;
}
function simpleCard(a) {
  return el("article", { class: "card" }, el("h2", {}, a.title), el("div", { class: "meta" }, `${a.source_name} · ${a.published_at ? shortDate(new Date(a.published_at)) : t("dateUnknown")}`),
    el("div", { class: "actions" }, ext(a.url, t("readSource"), "btn primary"), el("button", { class: "btn", type: "button", onclick: async () => { await call(`/api/bookmarks/${a.id}`, { method: "DELETE" }); load(); } }, t("del"))));
}
async function load(reset = true) {
  const list = $("list"); $("more").hidden = true; say(t("loading"));
  try {
    if (state.view === "briefing") {
      const { briefing: b } = await call("/api/briefing");
      list.replaceChildren();
      if (!b) return say(t("noBriefing"));
      say(t("briefingOf", { day: b.day, summary: localizeBriefingSummary(settings.lang, b.summary) }) + (b.topics.length ? t("topics", { list: b.topics.map((x) => `${x.word} (${x.count})`).join(", ") }) : ""));
      b.items.filter(showable).forEach((a) => list.append(card(a)));
      return void autoTranslate();
    }
    if (state.view === "bookmarks" || state.view === "history") {
      const { items } = await call(state.view === "bookmarks" ? "/api/bookmarks" : "/api/history");
      list.replaceChildren(...items.map((a) => (state.view === "history" ? card(a) : simpleCard(a))));
      return say(items.length ? "" : t(state.view === "bookmarks" ? "noArchived" : "noHistory"));
    }
    const { items } = await call(`/api/articles?${params(reset)}`);
    if (reset) { list.replaceChildren(); state.offset = 0; }
    items.forEach((a) => list.append(card(a))); state.offset += items.length;
    $("more").hidden = items.length < 30;
    say(list.children.length ? "" : t("noResults"));
    void autoTranslate();
  } catch (e) { say(e.message, true); }
}

// ---------- navigation ----------
async function togglePref(cat) {
  const s = new Set(state.me.categories); s.has(cat) ? s.delete(cat) : s.add(cat);
  state.me.categories = [...s];
  try { await call("/api/prefs", jsonBody({ categories: state.me.categories }, "PUT")); } catch (e) { say(e.message, true); }
  renderNav();
}
function go(view, cat = "") { state.view = view; state.cat = cat; if ($("menu").open) $("menu").close(); renderNav(); load(); window.scrollTo({ top: 0 }); }
function renderNav() {
  const side = $("nav"); side.replaceChildren();
  const item = (view, cat, label) => side.append(el("div", { class: "row" },
    el("button", { class: "cat", type: "button", "aria-current": String(state.view === view && state.cat === cat), onclick: () => go(view, cat) }, label),
    cat ? el("button", { class: "star", type: "button", "aria-label": t("follow", { name: label }), "aria-pressed": String(state.me.categories.includes(cat)), onclick: () => togglePref(cat) }, "★") : ""));
  item("briefing", "", t("navBriefing")); item("feed", "", t("navAll"));
  CAT_KEYS.forEach((k) => item("feed", k, catLabel(settings.lang, k)));
  item("favorites", "", t("navFav")); item("bookmarks", "", t("navArchived")); item("history", "", t("navHistory"));

  const chips = $("chips"); chips.hidden = state.view !== "feed"; chips.replaceChildren();
  [["", t("allChip")], ...CAT_KEYS.map((k) => [k, catLabel(settings.lang, k)])].forEach(([k, v]) => chips.append(el("button", { class: "chip", type: "button", "aria-current": String(state.cat === k), onclick: () => go("feed", k) }, v)));
  chips.querySelector("[aria-current=true]")?.scrollIntoView?.({ inline: "center", block: "nearest" });

  const tab = state.view === "briefing" ? 0 : state.view === "feed" ? 1 : state.view === "favorites" ? 2 : 3;
  $("tabbar").replaceChildren(...[[t("tabBriefing"), () => go("briefing")], [t("tabNews"), () => go("feed")], [t("tabFav"), () => go("favorites")], [t("tabMore"), openMenu]].map(([l, f], i) => el("button", { type: "button", "aria-current": String(i === tab), onclick: f }, l)));
  const n = filtersActive(); $("filterBtn").textContent = n ? t("filtersN", { n }) : t("filters"); $("filterBtn").classList.toggle("on", n > 0);
}
function openMenu() {
  const m = $("menu");
  m.replaceChildren(el("h2", {}, t("menuTitle")),
    el("button", { class: "btn", type: "button", onclick: () => { m.close(); openSettings(); } }, `🌐 ${t("settings")}`),
    ...[installItem(() => m.close())].filter(Boolean),
    el("button", { class: "btn", type: "button", onclick: () => go("bookmarks") }, t("navArchived")),
    el("button", { class: "btn", type: "button", onclick: () => go("history") }, t("navHistory")),
    el("h2", {}, t("followedCats")),
    ...CAT_KEYS.map((k) => el("label", {}, el("input", { type: "checkbox", ...(state.me.categories.includes(k) ? { checked: "" } : {}), onchange: () => togglePref(k) }), catLabel(settings.lang, k))),
    el("button", { class: "btn primary", type: "button", onclick: () => m.close() }, t("close")));
  m.showModal();
}

// ---------- langue et traduction ----------
const dirFor = () => (settings.lang === "fr" ? ["en", "fr"] : ["fr", "en"]);
function renderSettings() {
  const d = $("settings"), engine = el("p", { class: "hint" }, "…");
  const lang = el("fieldset", {}, el("legend", {}, t("langLabel")), ...LANGS.map((l) => el("label", {}, el("input", { type: "radio", name: "lang", value: l, ...(settings.lang === l ? { checked: "" } : {}), onchange: () => changeLang(l) }), l === "fr" ? "Français" : "English")));
  const show = el("select", { "aria-label": t("showLang"), onchange: (e) => { settings.show = e.target.value; saveSettings(); renderNav(); load(); } },
    ...[["all", "showAll"], ["fr", "showFr"], ["en", "showEn"]].map(([v, k]) => el("option", { value: v, ...(settings.show === v ? { selected: "" } : {}) }, t(k))));
  const auto = el("input", { type: "checkbox", ...(settings.auto ? { checked: "" } : {}), onchange: async (e) => {
    settings.auto = e.target.checked;
    if (settings.auto && !(await ensureEngine(...dirFor(), true))) { settings.auto = false; e.target.checked = false; }
    saveSettings(); load();
  } });
  d.replaceChildren(el("h2", {}, t("settings")), lang, el("label", {}, t("showLang")), show, el("label", {}, auto, t("auto")), engine, el("p", { class: "hint" }, t("settingsNote")), ...[installItem(() => d.close())].filter(Boolean), el("button", { class: "btn primary", type: "button", onclick: () => d.close() }, t("close")));
  service.engineInfo(...dirFor()).then((i) => { engine.textContent = i.kind === "chrome" ? t("engineChrome") : i.kind === "model" ? t("engineModel", { mb: MODEL_MB }) : t("engineNone"); });
}
function openSettings() { renderSettings(); if (!$("settings").open) $("settings").showModal(); }
function changeLang(l) { settings.lang = l; saveSettings(); applyStatic(); renderNav(); renderSettings(); load(); }

// ---------- installation comme application ----------
let installEvent = null;
const standalone = () => !!(window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone);
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent || "") && !standalone();
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; });
window.addEventListener("appinstalled", () => { installEvent = null; });
/** Bouton « Installer » (Chrome, Edge, Android) ou mode d'emploi iPhone/iPad ; rien si déjà installée ou impossible. */
function installItem(after) {
  if (standalone()) return null;
  if (installEvent) return el("button", { class: "btn", type: "button", onclick: async () => { const ev = installEvent; installEvent = null; await ev.prompt(); after?.(); } }, t("install"));
  if (isIos()) return el("p", { class: "hint" }, t("installIos"));
  return null;
}
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("./sw.js").catch(() => {});

// ---------- démarrage ----------
const refresh = () => { if (state.view !== "feed" && state.view !== "favorites") state.view = "feed"; renderNav(); load(); };
let timer; $("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(refresh, 300); });
["level", "unread", "byscore"].forEach((i) => $(i).addEventListener("change", refresh));
$("filterBtn").addEventListener("click", () => { const o = $("filters").classList.toggle("open"); $("filterBtn").setAttribute("aria-expanded", String(o)); });
$("langBtn").addEventListener("click", openSettings);
$("more").addEventListener("click", () => load(false));
for (const id of ["menu", "settings"]) $(id).addEventListener("click", (e) => { if (e.target === $(id)) $(id).close(); });
applyStatic();
try { state.me = await call("/api/me"); applyStatic(); renderNav(); load(); } catch (e) { say(e.message, true); }
