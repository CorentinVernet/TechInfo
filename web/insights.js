// Calculs sans interface, tous par règles : niveau de lecture, mot du jour, quiz, série, bilan, tendances.
import { areNear, GLOSSARY } from "./glossary.js";

export const norm = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// ---------- niveau de lecture ----------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCH = GLOSSARY.map((g) => ({ id: g.id, tech: g.tech, exact: g.x ? new RegExp(`(?<![\\p{L}\\p{N}])(?<![JjNn]['’])(?:${g.x.join("|")})(?![\\p{L}\\p{N}])`, "u") : null, re: new RegExp(`(?:^| )(?:${g.m.map((f) => (f.endsWith("*") ? `${esc(f.slice(0, -1))}\\S*` : `${esc(f)}(?= |$)`)).join("|")})`) }));
const CAT_WEIGHT = { dev: 2, web: 2, systems: 2, "network-cloud": 2, selfhost: 2, security: 1, ai: 1, hardware: 1 };
const NOT_FOR_KIDS = new Set(["security", "business"]); // arnaques, piratage, finance : pas des sujets d'enfant
const SENSITIVE = /(?:^| )(?:porn\S*|sex\S*|nude\S*|nudit\S*|erotic\S*|suicid\S*|meurtr\S*|murder\S*|tuer|tuee?s?|kill|killed|killing|killer\S*|mort|morts|horror\S*|horreur\S*|gore|crypto\S*|bitcoin\S*|arnaque\S*|scam\S*|pirat\S*|hack\S*|malware\S*|ransomware\S*|voleur\S*|theft|death\S*|deces|guerre\S*|war|wars|armee\S*|military|weapon\S*|arme|armes|missile\S*|bomb\S*|terror\S*|attentat\S*|drogue\S*|drug\S*|cannabis|casino\S*|gambling|paris sportifs|abus\S*|abuse\S*|viol|viols|rape\S*|pedo\S*|csam|harcel\S*|harass\S*|violen\S*|massacre\S*|deepfake\S*)(?= |$)/;
/** Termes du glossaire présents dans le texte (déjà normalisé). */
export const findTerms = (text, raw = "") => MATCH.filter((m) => m.exact?.test(raw) || m.re.test(text));
/** easy / medium / hard d'après le jargon et la catégorie, plus un drapeau de sujet sensible pour le mode enfant. */
export function analyze(a) {
  const raw = `${a.title} ${a.summary ?? ""}`, text = norm(raw), terms = findTerms(text, raw);
  let score = CAT_WEIGHT[a.category] ?? 0;
  for (const t of terms) score += t.tech;
  if (/\bcve \d{4}/.test(text)) score += 3;
  if (/\bv?\d+\.\d+\.\d+\b/.test(a.title)) score += 2;
  return { level: score <= 1 ? "easy" : score <= 5 ? "medium" : "hard", score, terms: terms.map((t) => t.id).slice(0, 4), sensitive: NOT_FOR_KIDS.has(a.category) || SENSITIVE.test(text) };
}
export const READERS = ["expert", "novice", "kid"];
export function suits(reading, reader) {
  if (reader === "kid") return reading.level === "easy" && !reading.sensitive;
  if (reader === "novice") return reading.level !== "hard";
  return true;
}

// ---------- mot du jour et quiz : même résultat pour tout le monde un jour donné ----------
export const dayId = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayNum = (id) => Math.floor(Date.UTC(+id.slice(0, 4), +id.slice(5, 7) - 1, +id.slice(8, 10)) / 864e5);
function shuffled(list, seed) {
  let s = seed >>> 0; const out = [...list];
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
/** Parcourt tout le glossaire avant de reprendre un même mot. */
export function wordOfDay(id = dayId(), list = GLOSSARY) {
  const n = dayNum(id), cycle = Math.floor(n / list.length);
  return shuffled(list, 7919 * (cycle + 1))[n % list.length];
}
/** Une question sur deux demande la définition, l'autre le terme. `correct` est l'index de la bonne réponse.
 *  Mauvaises réponses : du même domaine d'abord (plausibles), jamais un terme trop proche (les deux seraient défendables). */
export function dailyQuiz(id = dayId(), count = 5, list = GLOSSARY) {
  const n = dayNum(id), picks = shuffled(list.filter((g) => g.id !== wordOfDay(id, list).id), n * 31 + 17).slice(0, count);
  return picks.map((g, i) => {
    const others = shuffled(list.filter((x) => x.id !== g.id && !areNear(x.id, g.id)), n * 101 + i + 3);
    const wrong = [...others.filter((x) => x.f === g.f), ...others.filter((x) => x.f !== g.f)].slice(0, 3);
    const options = shuffled([g, ...wrong], n * 13 + i + 5);
    return { kind: i % 2 ? "term" : "def", id: g.id, options: options.map((o) => o.id), correct: options.indexOf(g) };
  });
}

// ---------- série de jours et bilan ----------
const active = (d) => !!d && (d.read > 0 || d.stories > 0 || !!d.quiz);
const shift = (id, by) => { const x = new Date(`${id}T12:00:00`); x.setDate(x.getDate() + by); return dayId(x); };
/** Jours d'activité consécutifs. Aujourd'hui sans activité ne casse pas encore la série. */
export function streak(days, today = dayId()) {
  let cur = active(days[today]) ? today : shift(today, -1), n = 0;
  while (active(days[cur])) { n++; cur = shift(cur, -1); }
  return n;
}
/** Bilan des 7 derniers jours (aujourd'hui compris), comparé aux 7 précédents. */
export function weekly(days, today = dayId()) {
  const range = (from) => Array.from({ length: 7 }, (_, i) => days[shift(today, -(from + i))]).filter(Boolean);
  const week = range(0), cats = {};
  for (const d of week) for (const [c, n] of Object.entries(d.cats ?? {})) cats[c] = (cats[c] ?? 0) + n;
  const sum = (l, f) => l.reduce((a, d) => a + (f(d) ?? 0), 0), quizzes = week.filter((d) => d.quiz);
  return {
    read: sum(week, (d) => d.read), previous: sum(range(7), (d) => d.read), activeDays: week.filter(active).length, stories: sum(week, (d) => d.stories),
    quizDone: quizzes.length, quizScore: sum(quizzes, (d) => d.quiz[0]), quizTotal: sum(quizzes, (d) => d.quiz[1]),
    topCats: Object.entries(cats).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([category, count]) => ({ category, count })),
  };
}

// ---------- « Ça monte » ----------
const STOP = new Set("les des une the and for with that this from are was pour dans sur avec par est qui que not has have will new nouveau nouvelle nouveaux nouvelles plus aux ses son sont ces cette how why what when your you our its can now more after over into about all but out just here been their they his her comment pourquoi quand votre vos notre nos leur leurs mais pas tout tous toute toutes fait faire comme encore ans jours selon deja bien tres entre sans sous vers chez aussi cela peut use using get first best top week day year one two".split(" "));
const CANDIDATE = /[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu;
/** Sujets candidats d'un titre : noms propres et sigles (majuscule hors premier mot), seuls ou par paires voisines (« Black Friday »). */
export function topicsOf(title) {
  const out = new Map(), words = [...title.matchAll(CANDIDATE)];
  const clean = (m) => m[0].replace(/[.-]+$/, "");
  const usable = (w) => { const n = norm(w); return n.length >= 3 && !STOP.has(n) && !/^\d+$/.test(n); };
  const proper = (w, i) => usable(w) && (/\p{Lu}/u.test(w.slice(1)) || /\d/.test(w) || (i > 0 && /^\p{Lu}/u.test(w)));
  words.forEach((m, i) => {
    const w = clean(m);
    if (proper(w, i)) out.set(norm(w), w);
    const nx = words[i + 1];
    if (!nx || title.slice(m.index + m[0].length, nx.index) !== " ") return;
    const w2 = clean(nx); // en tête de titre, une majuscule ne dit rien seule : elle compte si le mot suivant est un nom propre
    if (proper(w2, i + 1) && usable(w) && /^\p{Lu}/u.test(w)) out.set(norm(`${w} ${w2}`), `${w} ${w2}`);
  });
  return out;
}
/** Retire les doublons d'un même sujet : une expression remplace ses mots si elle explique l'essentiel de leurs citations. */
function dropOverlaps(list) {
  const pairs = list.filter((s) => s.topic.includes(" ")).sort((x, y) => y.count - x.count), gone = new Set(), kept = [];
  for (const p of pairs) {
    const parts = p.topic.split(" ");
    if (kept.some((k) => k.topic.split(" ").some((w) => parts.includes(w)))) gone.add(p.topic); else kept.push(p);
    for (const w of parts) { const one = list.find((s) => s.topic === w); if (one && one.count <= p.count * 1.5) gone.add(w); }
  }
  return list.filter((s) => !gone.has(s.topic));
}
/** Un sujet « monte » s'il apparaît plus souvent sur 24 h que son rythme quotidien des jours précédents, dans au moins 2 sources. */
export function trending(articles, now = Date.now(), { limit = 8, minCount = 3 } = {}) {
  const stats = new Map();
  for (const a of articles) {
    const age = (now - Date.parse(a.sort_ts)) / 864e5;
    if (!(age >= 0 && age <= 7)) continue;
    for (const [n, label] of topicsOf(a.title)) {
      const s = stats.get(n) ?? { topic: n, labels: new Map(), recent: 0, before: 0, sources: new Set() };
      s.labels.set(label, (s.labels.get(label) ?? 0) + 1);
      if (age <= 1) { s.recent++; s.sources.add(a.source_id); } else s.before++;
      stats.set(n, s);
    }
  }
  const rising = [...stats.values()]
    .map((s) => ({ topic: s.topic, label: [...s.labels].sort((x, y) => y[1] - x[1])[0][0], count: s.recent, sources: s.sources.size, lift: (s.recent + 1) / (s.before / 6 + 1) }))
    .filter((s) => s.count >= minCount && s.sources >= 2 && s.lift >= 1.5);
  return dropOverlaps(rising)
    .sort((x, y) => y.lift - x.lift || y.count - x.count).slice(0, limit)
    .map(({ topic, label, count, lift }) => ({ topic, label, count, lift: Math.round(lift * 10) / 10 }));
}
/** Mot entier ou expression, jamais un morceau de mot (« rust » ne trouve pas « trust »). */
export const matchesTopic = (normalizedText, topic) => ` ${normalizedText} `.includes(` ${norm(topic)} `);
