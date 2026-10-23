import { api } from "./api.js";
const CATS = { web: "Web", dev: "Développement", systems: "Systèmes", "network-cloud": "Réseau et cloud", security: "Cybersécurité", ai: "IA", hardware: "Matériel", "bigtech-mobile": "Big Tech et mobile", selfhost: "Self-hosting", gaming: "Jeu vidéo", industry: "Industrie", space: "Espace", other: "Autres" };
const LVL = { critical: "Critique", important: "Important", follow: "À suivre", minor: "Mineur" };
const $ = (id) => document.getElementById(id);
const state = { view: "briefing", cat: "", offset: 0, me: null };
const abs = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" });
const short = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" });
const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

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

function ago(a) {
  const iso = a.published_at ?? a.collected_at, m = (Date.now() - Date.parse(iso)) / 60000;
  const t = m < 60 ? rtf.format(-Math.max(1, Math.round(m)), "minute") : m < 1440 ? rtf.format(-Math.round(m / 60), "hour") : m < 10080 ? rtf.format(-Math.round(m / 1440), "day") : short.format(new Date(iso));
  return a.published_at ? t : `collecté ${t}`;
}

function card(a) {
  const art = el("article", { class: `card ${a.importance}${a.is_read ? " read" : ""}` });
  const detail = el("div", { class: "detail", hidden: "" });
  const title = el("button", { type: "button", "aria-expanded": "false", onclick: async () => {
    const show = detail.hidden;
    if (show && !detail.dataset.loaded) {
      try { fill(detail, await (await api(`/api/articles/${a.id}`)).json()); detail.dataset.loaded = "1"; } catch (e) { say(e.message, true); return; }
    }
    detail.hidden = !show; art.classList.toggle("open", show); title.setAttribute("aria-expanded", String(show));
    if (show && !a.is_read) mark(a, art, true);
  } }, a.title);
  const fav = el("button", { class: "btn", type: "button", "aria-pressed": String(!!a.favorite), onclick: async () => {
    a.favorite = a.favorite ? 0 : 1; paintFav(); await setState(a, { favorite: !!a.favorite });
    if (!a.favorite && state.view === "favorites") art.remove();
  } });
  const paintFav = () => { fav.setAttribute("aria-pressed", String(!!a.favorite)); fav.textContent = a.favorite ? "★ Favori" : "☆ Favori"; }; paintFav();
  const read = el("button", { class: "btn readbtn", type: "button", onclick: () => mark(a, art, !a.is_read) }, a.is_read ? "Marquer non lu" : "Marquer lu");
  art.append(
    el("div", { class: "meta" }, el("span", { class: `badge ${a.importance}` }, LVL[a.importance]), el("span", {}, `${a.source_name}${a.source_count > 1 ? ` +${a.source_count - 1}` : ""}`), el("span", {}, CATS[a.category] ?? a.category), el("time", { datetime: a.published_at ?? a.collected_at, title: abs.format(new Date(a.published_at ?? a.collected_at)) }, ago(a))),
    el("h2", {}, title), ...(a.summary ? [el("p", { class: "sum" }, a.summary)] : []), detail,
    el("div", { class: "actions" }, ext(a.url, "Lire la source", "btn primary"), fav, read));
  return art;
}
function fill(d, a) {
  const interest = a.score >= 60 ? "élevé" : a.score >= 40 ? "moyen" : "faible";
  d.replaceChildren(el("p", { class: "meta" }, `${a.summary ? "Résumé automatique par règles, sans IA. " : "Seuls le titre et le lien sont republiés ici : ouvrez la source pour lire l'article. "}Intérêt estimé : ${interest} (score ${a.score}).`));
  if (a.reasons?.length) d.append(el("p", {}, `Pourquoi ce niveau : ${a.reasons.join(", ")}.`));
  if (a.cvss != null) d.append(el("p", {}, `CVSS ${a.cvss} (indiqué par ${a.cvss_source}).`));
  d.append(el("p", {}, "Sources :"), el("ul", {}, ...a.sources.map((s) => el("li", {}, ext(s.url, s.name)))));
  if (a.links?.length) d.append(el("p", {}, "Liens techniques :"), el("ul", {}, ...a.links.map((l) => el("li", {}, ext(l, l)))));
}
async function setState(a, body) { try { await api(`/api/articles/${a.id}/state`, jsonBody(body)); } catch (e) { say(e.message, true); } }
async function mark(a, art, isRead) {
  a.is_read = isRead ? 1 : 0; art.classList.toggle("read", isRead);
  art.querySelector(".readbtn").textContent = isRead ? "Marquer non lu" : "Marquer lu";
  await setState(a, { is_read: isRead });
}

const filtersActive = () => [$("level").value, $("unread").checked, $("byscore").checked].filter(Boolean).length;
function params(reset) {
  const p = new URLSearchParams({ limit: "30", offset: String(reset ? 0 : state.offset) });
  if (state.cat) p.set("category", state.cat);
  if ($("q").value.trim()) p.set("q", $("q").value.trim());
  if ($("level").value) p.set("level", $("level").value);
  if ($("unread").checked) p.set("unread", "1");
  if ($("byscore").checked) p.set("sort", "score");
  if (state.view === "favorites") p.set("favorites", "1");
  return p;
}
function simpleCard(a, history) {
  if (history) return card(a);
  return el("article", { class: "card" }, el("h2", {}, a.title), el("div", { class: "meta" }, `${a.source_name} · ${a.published_at ? short.format(new Date(a.published_at)) : "date inconnue"}`),
    el("div", { class: "actions" }, ext(a.url, "Lire la source", "btn primary"), el("button", { class: "btn", type: "button", onclick: async () => { await api(`/api/bookmarks/${a.id}`, { method: "DELETE" }); load(); } }, "Supprimer")));
}
async function load(reset = true) {
  const list = $("list"); $("more").hidden = true; say("Chargement…");
  try {
    if (state.view === "briefing") {
      const { briefing: b } = await (await api("/api/briefing")).json();
      list.replaceChildren();
      if (!b) return say("Pas encore de briefing : il est généré chaque matin vers 7 h (Paris), une fois la collecte faite.");
      say(`Briefing du ${b.day}. ${b.summary}${b.topics.length ? " Mots récurrents (à prendre avec prudence) : " + b.topics.map((t) => `${t.word} (${t.count})`).join(", ") + "." : ""}`);
      b.items.forEach((a) => list.append(card(a))); return;
    }
    if (state.view === "bookmarks" || state.view === "history") {
      const { items } = await (await api(state.view === "bookmarks" ? "/api/bookmarks" : "/api/history")).json();
      list.replaceChildren(...items.map((a) => simpleCard(a, state.view === "history")));
      return say(items.length ? "" : state.view === "bookmarks" ? "Aucun favori archivé. Les favoris de plus de 7 jours sont conservés ici." : "Aucun article ouvert récemment.");
    }
    if (state.view === "admin") {
      const s = await (await api("/api/admin/status")).json();
      list.replaceChildren(el("p", {}, `${s.counts.articles} articles en base.`), ...s.sources.map((x) => el("p", { class: x.last_error ? "err" : "meta" }, `${x.name} : ${x.last_error ? "erreur — " + x.last_error : x.verified ? "OK" : "jamais collectée"}${x.last_success_at ? ", dernier succès " + abs.format(new Date(x.last_success_at)) : ""}`)), ...s.runs.map((r) => el("p", { class: "meta" }, `Collecte ${abs.format(new Date(r.started_at))} : ${r.status}, ${r.sources_ok}/${r.sources_total} sources, ${r.added} ajoutés`)));
      return say("Administration");
    }
    const { items } = await (await api(`/api/articles?${params(reset)}`)).json();
    if (reset) { list.replaceChildren(); state.offset = 0; }
    items.forEach((a) => list.append(card(a))); state.offset += items.length;
    $("more").hidden = items.length < 30;
    say(list.children.length ? "" : "Aucun résultat. Essayez d'autres filtres, ou attendez la prochaine collecte.");
  } catch (e) { say(e.message, true); }
}

async function togglePref(cat) {
  const s = new Set(state.me.categories); s.has(cat) ? s.delete(cat) : s.add(cat);
  state.me.categories = [...s];
  try { await api("/api/prefs", jsonBody({ categories: state.me.categories }, "PUT")); } catch (e) { say(e.message, true); }
  renderNav();
}
function go(view, cat = "") { state.view = view; state.cat = cat; $("menu").close?.(); renderNav(); load(); window.scrollTo({ top: 0 }); }
function renderNav() {
  const side = $("nav"); side.replaceChildren();
  const item = (view, cat, label) => side.append(el("div", { class: "row" },
    el("button", { class: "cat", type: "button", "aria-current": String(state.view === view && state.cat === cat), onclick: () => go(view, cat) }, label),
    cat ? el("button", { class: "star", type: "button", "aria-label": `Suivre ${label}`, "aria-pressed": String(state.me.categories.includes(cat)), onclick: () => togglePref(cat) }, "★") : ""));
  item("briefing", "", "Briefing du jour"); item("feed", "", "Toutes les actualités");
  Object.entries(CATS).forEach(([k, v]) => item("feed", k, v));
  item("favorites", "", "Favoris"); item("bookmarks", "", "Favoris archivés"); item("history", "", "Historique");
  if (state.me.role === "admin") item("admin", "", "Administration");

  const chips = $("chips"); chips.hidden = state.view !== "feed"; chips.replaceChildren();
  [["", "Toutes"], ...Object.entries(CATS)].forEach(([k, v]) => chips.append(el("button", { class: "chip", type: "button", "aria-current": String(state.cat === k), onclick: () => go("feed", k) }, v)));
  chips.querySelector("[aria-current=true]")?.scrollIntoView({ inline: "center", block: "nearest" });

  const tab = state.view === "briefing" ? 0 : state.view === "feed" ? 1 : state.view === "favorites" ? 2 : 3;
  const tabs = $("tabbar"); tabs.replaceChildren(...[["Briefing", () => go("briefing")], ["Actualités", () => go("feed")], ["Favoris", () => go("favorites")], ["Plus", openMenu]].map(([l, f], i) => el("button", { type: "button", "aria-current": String(i === tab), onclick: f }, l)));
  const n = filtersActive(); $("filterBtn").textContent = n ? `Filtres (${n})` : "Filtres"; $("filterBtn").classList.toggle("on", n > 0);
}
function openMenu() {
  const m = $("menu");
  m.replaceChildren(el("h2", {}, "Plus"),
    el("button", { class: "btn", type: "button", onclick: () => go("bookmarks") }, "Favoris archivés"),
    el("button", { class: "btn", type: "button", onclick: () => go("history") }, "Historique"),
    ...(state.me.role === "admin" ? [el("button", { class: "btn", type: "button", onclick: () => go("admin") }, "Administration")] : []),
    el("h2", {}, "Catégories suivies"),
    ...Object.entries(CATS).map(([k, v]) => el("label", {}, el("input", { type: "checkbox", ...(state.me.categories.includes(k) ? { checked: "" } : {}), onchange: () => togglePref(k) }), v)),
    el("button", { class: "btn primary", type: "button", onclick: () => m.close() }, "Fermer"));
  m.showModal();
}

const refresh = () => { if (state.view !== "feed" && state.view !== "favorites") state.view = "feed"; renderNav(); load(); };
let t; $("q").addEventListener("input", () => { clearTimeout(t); t = setTimeout(refresh, 300); });
["level", "unread", "byscore"].forEach((i) => $(i).addEventListener("change", refresh));
$("filterBtn").addEventListener("click", () => { const o = $("filters").classList.toggle("open"); $("filterBtn").setAttribute("aria-expanded", String(o)); });
$("more").addEventListener("click", () => load(false));
$("menu").addEventListener("click", (e) => { if (e.target === $("menu")) $("menu").close(); });
try {
  state.me = await (await api("/api/me")).json(); renderNav(); load();
  if (state.me.updated_at) { const st = state.me.status; $("foot").textContent = `Données mises à jour ${abs.format(new Date(state.me.updated_at))}${st ? ` — ${st.sources_ok}/${st.sources_total} sources lues` : ""}. Favoris et lectures sont gardés dans ce navigateur.`; }
} catch (e) { say(e.message, true); }
