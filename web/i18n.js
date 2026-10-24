// Textes de l'interface en français et en anglais, et traduction des libellés produits par le build (raisons du classement, briefing).
export const LANGS = ["fr", "en"];
export const CAT_KEYS = ["web", "dev", "systems", "network-cloud", "security", "ai", "hardware", "bigtech-mobile", "selfhost", "gaming", "industry", "space", "other"];

/** Langue de l'appareil : français si le navigateur est en français, anglais sinon. */
export function detectLang(nav = globalThis.navigator) {
  const l = String(nav?.languages?.[0] ?? nav?.language ?? "en").toLowerCase();
  return l.startsWith("fr") ? "fr" : "en";
}

const D = {
  fr: {
    title: "TechInfo — veille tech", skip: "Aller aux actualités", search: "Rechercher", searchAria: "Rechercher dans les actualités",
    filters: "Filtres", filtersN: "Filtres ({n})", allLevels: "Toutes importances", unread: "Non lus", byScore: "Par pertinence", more: "Voir plus",
    chipsAria: "Catégories", navAria: "Rubriques", tabsAria: "Navigation principale", langAria: "Langue et traduction",
    lvl_critical: "Critique", lvl_important: "Important", lvl_follow: "À suivre", lvl_minor: "Mineur",
    tabBriefing: "Briefing", tabNews: "Actualités", tabFav: "Favoris", tabMore: "Plus",
    navBriefing: "Briefing du jour", navAll: "Toutes les actualités", navFav: "Favoris", navArchived: "Favoris archivés", navHistory: "Historique", navAdmin: "Administration",
    menuTitle: "Plus", followedCats: "Catégories suivies", follow: "Suivre {name}", close: "Fermer", allChip: "Toutes",
    readSource: "Lire la source", favAdd: "☆ Favori", favOn: "★ Favori", markRead: "Marquer lu", markUnread: "Marquer non lu", collected: "collecté {when}",
    summaryNote: "Résumé automatique par règles. ", noSummaryNote: "Seuls le titre et le lien sont republiés ici : ouvrez la source pour lire l'article. ",
    interest: "Intérêt estimé : {level} (score {score}).", high: "élevé", mid: "moyen", low: "faible",
    why: "Pourquoi ce niveau : {list}.", cvss: "CVSS {score} (indiqué par {src}).", sources: "Sources :", techLinks: "Liens techniques :",
    loading: "Chargement…", noBriefing: "Pas encore de briefing : il est généré à chaque mise à jour du site.",
    briefingOf: "Briefing du {day}. {summary}", topics: " Mots récurrents (à prendre avec prudence) : {list}.",
    noArchived: "Aucun favori archivé. Les favoris dont l'article n'est plus publié sont conservés ici.", noHistory: "Aucun article ouvert récemment.",
    noResults: "Aucun résultat. Essayez d'autres filtres, ou attendez la prochaine mise à jour.", err: "Erreur {n}", del: "Supprimer", dateUnknown: "date inconnue",
    footer: "Données mises à jour {date}{sources}. Favoris et lectures sont gardés dans ce navigateur.", footerSources: " — {ok}/{total} sources lues",
    settings: "Langue et traduction", langLabel: "Langue de l'interface et de la traduction", showLang: "Articles à afficher",
    showAll: "Tous (français et anglais)", showFr: "Français seulement", showEn: "Anglais seulement",
    auto: "Traduire automatiquement les articles dans ma langue", translate: "Traduire", showOriginal: "Voir l'original", translating: "Traduction…", translated: "Traduit automatiquement",
    engineChrome: "Moteur : traducteur intégré à votre navigateur, qui travaille sur votre appareil.",
    engineModel: "Moteur : petit modèle de traduction téléchargé une fois dans votre navigateur (≈ {mb} Mo), puis conservé. Aucun texte n'est envoyé à un service de traduction.",
    settingsNote: "Les articles restent ceux de leurs sources : « Lire la source » ouvre toujours l'original. Une traduction automatique peut contenir des erreurs.",
    trError: "La traduction a échoué. Réessayez, ou lisez l'article d'origine.", engineNone: "La traduction n'est pas disponible sur ce navigateur.",
    confirmModel: "La traduction nécessite de télécharger un modèle (≈ {mb} Mo, une seule fois, conservé ensuite dans ce navigateur) depuis jsDelivr et Hugging Face. Sur mobile, préférez le Wi-Fi. Continuer ?",
    downloading: "Téléchargement du modèle de traduction… {pct} %",
    r_official: "source officielle", r_followed: "catégorie suivie", r_nodate: "date de publication absente", r_kwCrit: "mot-clé critique : {k}", r_kw: "mot-clé : {k}",
    briefingSummary: "{total} actualités sur 24 h, dont {c} critique(s) et {i} importante(s). Sélection automatique par règles.",
    adminTitle: "Administration",
    install: "📲 Installer l'application", installIos: "Pour installer l'appli : touchez le bouton Partager de Safari, puis « Sur l'écran d'accueil ».",
  },
  en: {
    title: "TechInfo — tech watch", skip: "Skip to the news", search: "Search", searchAria: "Search the news",
    filters: "Filters", filtersN: "Filters ({n})", allLevels: "All levels", unread: "Unread", byScore: "By relevance", more: "Show more",
    chipsAria: "Categories", navAria: "Sections", tabsAria: "Main navigation", langAria: "Language and translation",
    lvl_critical: "Critical", lvl_important: "Important", lvl_follow: "Worth following", lvl_minor: "Minor",
    tabBriefing: "Briefing", tabNews: "News", tabFav: "Favorites", tabMore: "More",
    navBriefing: "Daily briefing", navAll: "All news", navFav: "Favorites", navArchived: "Archived favorites", navHistory: "History", navAdmin: "Administration",
    menuTitle: "More", followedCats: "Followed categories", follow: "Follow {name}", close: "Close", allChip: "All",
    readSource: "Read the source", favAdd: "☆ Favorite", favOn: "★ Favorite", markRead: "Mark as read", markUnread: "Mark as unread", collected: "collected {when}",
    summaryNote: "Automatic rule-based summary. ", noSummaryNote: "Only the title and link are republished here: open the source to read the article. ",
    interest: "Estimated interest: {level} (score {score}).", high: "high", mid: "medium", low: "low",
    why: "Why this level: {list}.", cvss: "CVSS {score} (reported by {src}).", sources: "Sources:", techLinks: "Technical links:",
    loading: "Loading…", noBriefing: "No briefing yet: it is generated on every site update.",
    briefingOf: "Briefing for {day}. {summary}", topics: " Recurring words (take with caution): {list}.",
    noArchived: "No archived favorites. Favorites whose article is no longer published are kept here.", noHistory: "No article opened recently.",
    noResults: "No results. Try other filters, or wait for the next update.", err: "Error {n}", del: "Delete", dateUnknown: "unknown date",
    footer: "Data updated {date}{sources}. Favorites and read marks are kept in this browser.", footerSources: " — {ok}/{total} sources read",
    settings: "Language and translation", langLabel: "Interface and translation language", showLang: "Articles to show",
    showAll: "All (French and English)", showFr: "French only", showEn: "English only",
    auto: "Automatically translate articles into my language", translate: "Translate", showOriginal: "Show original", translating: "Translating…", translated: "Machine-translated",
    engineChrome: "Engine: your browser's built-in translator, running on your device.",
    engineModel: "Engine: a small translation model downloaded once into your browser (≈ {mb} MB), then kept. No text is sent to a translation service.",
    settingsNote: "Articles remain those of their sources: “Read the source” always opens the original. Machine translation can contain mistakes.",
    trError: "Translation failed. Try again, or read the original article.", engineNone: "Translation is not available in this browser.",
    confirmModel: "Translation needs a model download (≈ {mb} MB, once, then kept in this browser) from jsDelivr and Hugging Face. On mobile, prefer Wi-Fi. Continue?",
    downloading: "Downloading the translation model… {pct}%",
    r_official: "official source", r_followed: "followed category", r_nodate: "no publication date", r_kwCrit: "critical keyword: {k}", r_kw: "keyword: {k}",
    briefingSummary: "{total} stories in 24 h, including {c} critical and {i} important. Automatic rule-based selection.",
    adminTitle: "Administration",
    install: "📲 Install the app", installIos: "To install the app: tap Safari's Share button, then “Add to Home Screen”.",
  },
};
const CATS = {
  fr: { web: "Web", dev: "Développement", systems: "Systèmes", "network-cloud": "Réseau et cloud", security: "Cybersécurité", ai: "IA", hardware: "Matériel", "bigtech-mobile": "Big Tech et mobile", selfhost: "Self-hosting", gaming: "Jeu vidéo", industry: "Industrie", space: "Espace", other: "Autres" },
  en: { web: "Web", dev: "Development", systems: "Systems", "network-cloud": "Network and cloud", security: "Cybersecurity", ai: "AI", hardware: "Hardware", "bigtech-mobile": "Big Tech and mobile", selfhost: "Self-hosting", gaming: "Gaming", industry: "Industry", space: "Space", other: "Other" },
};
export const dictionaries = D;

export function t(lang, key, vars = {}) {
  let s = D[lang]?.[key] ?? D.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
export const catLabel = (lang, cat) => CATS[lang]?.[cat] ?? CATS.en[cat] ?? cat;

/** Les « raisons » du classement sont écrites en français par le build : on les remet dans la langue choisie. */
export function localizeReason(lang, r) {
  if (r === "source officielle") return t(lang, "r_official");
  if (r === "catégorie suivie") return t(lang, "r_followed");
  if (r === "date de publication absente") return t(lang, "r_nodate");
  let m = /^mot-clé critique : (.*)$/.exec(r); if (m) return t(lang, "r_kwCrit", { k: m[1] });
  m = /^mot-clé : (.*)$/.exec(r); if (m) return t(lang, "r_kw", { k: m[1] });
  return r; // « CVSS 9.8 (source) » est identique dans les deux langues
}
export function localizeBriefingSummary(lang, s) {
  const m = /^(\d+) actualités sur 24 h, dont (\d+) critique\(s\) et (\d+) importante\(s\)\./.exec(s);
  return m ? t(lang, "briefingSummary", { total: m[1], c: m[2], i: m[3] }) : s;
}
