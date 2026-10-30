// Textes de l'interface en français et en anglais, et traduction des libellés produits par le build (raisons du classement, briefing).
export const LANGS = ["fr", "en"];
export const CAT_KEYS = ["web", "dev", "systems", "network-cloud", "security", "ai", "hardware", "mobile", "business", "selfhost", "gaming", "science", "general"];
const OLD_CATS = { "bigtech-mobile": "mobile", space: "science", industry: "general", other: "general" };
/** Catégories favorites enregistrées avant la refonte (ou venant d'un ancien export). */
export const migrateCats = (cats) => [...new Set((Array.isArray(cats) ? cats : []).filter((c) => typeof c === "string").map((c) => OLD_CATS[c] ?? c))].filter((c) => CAT_KEYS.includes(c));

/** Langue de l'appareil : français si le navigateur est en français, anglais sinon. */
export function detectLang(nav = globalThis.navigator) {
  const l = String(nav?.languages?.[0] ?? nav?.language ?? "en").toLowerCase();
  return l.startsWith("fr") ? "fr" : "en";
}

const D = {
  fr: {
    title: "TechInfo — veille tech", skip: "Aller aux actualités", search: "Rechercher", searchAria: "Rechercher dans les actualités",
    filters: "Filtres", filtersN: "Filtres ({n})", unread: "Masquer les articles lus", sortLabel: "Tri", sortDate: "Plus récents d'abord", sortScore: "Par pertinence",
    minLevelLabel: "Importance minimale", minl_minor: "Toutes les importances", minl_follow: "« À suivre » et plus", minl_important: "« Important » et plus", minl_critical: "« Critique » seulement",
    lvl_critical: "Critique", lvl_important: "Important", lvl_follow: "À suivre", lvl_minor: "Mineur",
    more: "Voir plus", tabsAria: "Navigation principale", chipsAria: "Catégories", subtabsAria: "Mes articles",
    tabBriefing: "Briefing", tabForYou: "Pour moi", tabExplore: "Explorer", tabSaved: "Favoris", tabSettings: "Réglages", allChip: "Toutes",
    savedTab: "Favoris", archivedTab: "Archivés", historyTab: "Historique",
    readSource: "Lire la source", favAddAria: "Ajouter aux favoris", favOnAria: "Retirer des favoris", markReadAria: "Marquer comme lu", markUnreadAria: "Marquer comme non lu", collected: "collecté {when}",
    summaryNote: "Résumé automatique par règles. ", noSummaryNote: "Seuls le titre et le lien sont republiés ici : ouvrez la source pour lire l'article. ",
    interest: "Intérêt estimé : {level} (score {score}).", high: "élevé", mid: "moyen", low: "faible",
    why: "Pourquoi ce niveau : {list}.", cvss: "CVSS {score} (indiqué par {src}).", sources: "Sources :", techLinks: "Liens techniques :",
    loading: "Chargement…", noBriefing: "Pas encore de briefing : il est généré à chaque mise à jour du site.",
    briefingOf: "Briefing du {day}. {summary}", topics: " Mots récurrents (à prendre avec prudence) : {list}.",
    forYouEmpty: "Choisissez vos catégories favorites dans les réglages pour personnaliser cette page. En attendant, tout est affiché.", goSettings: "Choisir mes catégories",
    noSaved: "Aucun favori. Touchez ☆ sur un article pour le garder ici.", noArchived: "Aucun favori archivé. Les favoris dont l'article n'est plus publié sont conservés ici.", noHistory: "Aucun article ouvert récemment.",
    noResults: "Aucun résultat. Essayez d'autres filtres, ou attendez la prochaine mise à jour.", err: "Erreur {n}", del: "Supprimer", dateUnknown: "date inconnue",
    footer: "Données mises à jour {date}{sources}. Favoris, lectures et réglages sont gardés dans ce navigateur.", footerSources: " — {ok}/{total} sources lues",
    translate: "Traduire", showOriginal: "Voir l'original", translating: "Traduction…", translated: "Traduit automatiquement",
    trProgress: "Téléchargement du modèle de traduction… {pct} %", trError: "La traduction a échoué. Réessayez, ou lisez l'article d'origine.", engineNone: "La traduction n'est pas disponible sur ce navigateur.",
    confirmModel: "La traduction nécessite de télécharger un modèle (≈ {mb} Mo, une seule fois) depuis jsDelivr et Hugging Face. Elle travaille en arrière-plan, mais sur un téléphone elle utilise beaucoup de mémoire : préférez le Wi-Fi, et un ordinateur si possible. Continuer ?",
    setTitle: "Réglages", setLanguage: "Langue", langLabel: "Langue de l'interface et de la traduction", showLang: "Articles à afficher", showAll: "Tous (français et anglais)", showFr: "Français seulement", showEn: "Anglais seulement",
    setTranslation: "Traduction", auto: "Traduire automatiquement les articles visibles", clearTr: "Vider les traductions mémorisées", clearedTr: "Traductions supprimées.",
    engineChrome: "Moteur : traducteur intégré à votre navigateur, qui travaille sur votre appareil.", engineModel: "Moteur : petit modèle téléchargé une fois dans votre navigateur (≈ {mb} Mo), exécuté en arrière-plan. Aucun texte n'est envoyé à un service de traduction.",
    trNote: "Une traduction automatique peut contenir des erreurs. « Lire la source » ouvre toujours l'original.",
    setCats: "Mes catégories favorites", catsHelp: "« Pour moi » n'affiche que ces catégories, et elles passent en premier. Aucune sélection = tout afficher.",
    setSources: "Sources", sourcesHelp: "Décochez une source pour ne plus voir ses articles.", unmuteAll: "Tout réactiver",
    setDisplay: "Affichage", theme: "Thème", themeAuto: "Automatique (appareil)", themeLight: "Clair", themeDark: "Sombre",
    textSize: "Taille du texte", sizeS: "Petit", sizeM: "Normal", sizeL: "Grand", density: "Densité", densComfort: "Confortable", densCompact: "Compacte",
    summaryLines: "Résumés", sumOff: "Masqués", sum2: "2 lignes", sum3: "3 lignes", sum5: "5 lignes", sumFull: "Entiers",
    setHome: "Accueil", homeLabel: "Page d'accueil", homeBriefing: "Briefing du jour", homeForYou: "Pour moi", homeExplore: "Explorer",
    setApp: "Application", install: "📲 Installer l'application", installIos: "Pour installer l'appli : touchez le bouton Partager de Safari, puis « Sur l'écran d'accueil ».", installed: "L'application est installée.",
    setData: "Mes données", resetSettings: "Réinitialiser les réglages", confirmReset: "Remettre tous les réglages par défaut ?",
    resetData: "Effacer favoris, lectures, série et historique", confirmData: "Effacer définitivement vos favoris, vos lectures, votre série et votre historique sur cet appareil ?", done: "C'est fait.",
    r_official: "source officielle", r_followed: "catégorie suivie", r_nodate: "date de publication absente", r_kwCrit: "mot-clé critique : {k}", r_kw: "mot-clé : {k}",
    srcOk: "dernière lecture {when}", srcErr: "⚠ {err}", srcNever: "jamais lue", srcCount: "{n} article(s)",
    srcSummary: "{bad} source(s) sur {total} ne répondent pas pour l'instant.", srcAllOk: "Toutes les sources répondent.",
    catHealth: "Rien de récent dans « {cat} ». Sources de cette catégorie : {list}.", catNoSource: "Aucune source n'alimente « {cat} » pour l'instant.",
    setGestures: "Gestes et liens", today: "Aujourd'hui", yesterday: "Hier", freshOne: "↑ 1 nouvel article", freshMany: "↑ {n} nouveaux articles",
    shareAria: "Partager ou copier le lien", copyLink: "Copier le lien", linkCopied: "Lien copié",
    toastFavOn: "★ Ajouté aux favoris", toastFavOff: "Retiré des favoris", toastRead: "✓ Marqué comme lu", toastUnread: "Marqué comme non lu",
    swipeRight: "Balayer vers la droite", swipeLeft: "Balayer vers la gauche", swipeHelp: "Sur téléphone, balayez une carte. Les boutons restent disponibles.",
    sw_favorite: "Ajouter aux favoris", sw_read: "Marquer comme lu", sw_share: "Partager", sw_off: "Aucune action",
    swHint_favorite: "★ Favori", swHint_read: "✓ Lu", swHint_share: "↗ Partager",
    layoutLabel: "Mise en page", layoutCards: "Cartes", layoutCompact: "Liste compacte", groupDays: "Titres par jour (Aujourd'hui, Hier…)",
    openIn: "Ouvrir les articles", openTab: "Dans un nouvel onglet", openSame: "Dans cet onglet (le retour garde votre place)",
    welcomeTitle: "Bienvenue sur TechInfo", welcomeIntro: "Quelques réglages pour personnaliser votre page « Pour moi ». Tout reste sur cet appareil et se change plus tard dans Réglages.",
    welcomeCats: "Vos catégories favorites", selectAll: "Tout sélectionner", welcomeNeedOne: "Choisissez au moins une catégorie, ou touchez « Passer » pour tout afficher.", finish: "Terminer", skip: "Passer", redoWelcome: "Revoir l'assistant de démarrage",
    briefingSummary: "{total} actualités sur 24 h, dont {c} critique(s) et {i} importante(s). Sélection automatique par règles.",
    tabLearn: "Apprendre", storiesAria: "Stories tech du jour", storiesAll: "Tout voir", storyOf: "Story {i} sur {n}", storyClose: "Fermer les stories", storyPrev: "Story précédente", storyNext: "Story suivante", storyPause: "Mettre en pause", storyPlay: "Reprendre", storyDoneTitle: "Tu es à jour !", storyDoneText: "{n} stories du jour parcourues. Le reste peut attendre.", storyDoneBack: "Retour aux articles", storyDoneLearn: "Voir le mot du jour",
    trendsTitle: "Ça monte", trendsHelp: "Sujets cités plus souvent que d'habitude sur 24 h, dans au moins 2 sources.", trendCount: "{n} articles sur 24 h", myTopics: "Mes sujets", follow: "☆ Suivre « {topic} »", unfollow: "★ Suivi : « {topic} » (retirer)", topicFresh: "{n} nouveaux", setTopics: "Sujets suivis", topicsHelp: "Les articles qui citent ces sujets apparaissent dans « Pour moi », en plus de vos catégories.", topicPh: "ex. Rust, Kubernetes, Starship", topicRemove: "Retirer « {topic} »", noTopics: "Aucun sujet suivi. Recherchez un mot dans Explorer, puis touchez « Suivre ».", topicAddBtn: "Suivre ce sujet",
    wordTitle: "Mot du jour", wordArticles: "Voir les articles qui en parlent", quizTitle: "Quiz du jour", quizStart: "Commencer le quiz", quizQ: "Question {i} sur {n}", quizDef: "Que veut dire « {term} » ?", quizTerm: "Quel mot correspond à : « {def} »", quizNext: "Question suivante", quizFinish: "Voir mon score", quizScore: "Score du jour : {ok} sur {n}.", quizRight: "Bonne réponse !", quizWrong: "Raté, la bonne réponse était : {answer}", quizAgain: "Rejouer pour le plaisir", quizKept: "Votre premier score du jour reste enregistré.", glossaryTitle: "Glossaire", glossaryPh: "Chercher un mot", glossaryNone: "Aucun mot ne correspond.",
    streakTitle: "Série de jours", streakN: "{n} jour(s) d'affilée", streakZero: "Pas encore de série", streakHelp: "Lisez un article, regardez les stories ou faites le quiz chaque jour pour la prolonger.", streakBest: "Record : {n} jour(s)",
    weekTitle: "Bilan de la semaine", weekRead: "{n} article(s) lu(s)", weekDelta: "{d} par rapport à la semaine d'avant", weekDays: "Actif {n} jour(s) sur 7", weekStories: "Stories terminées {n} fois", weekQuiz: "Quiz : {ok} bonnes réponses sur {n}", weekTop: "Vos catégories : {list}", weekEmpty: "Rien cette semaine pour l'instant : le bilan se remplit quand vous lisez.", weekBanner: "Votre bilan de la semaine est prêt", weekOpen: "Voir le bilan",
    readerLabel: "Niveau de lecture", readerExpert: "Adulte, à l'aise avec l'informatique (tout voir)", readerNovice: "Adulte, je n'y connais rien (moins de jargon)", readerKid: "Enfant (sujets simples)", readerHelp: "Trie les articles selon leur jargon et ajoute une explication « En clair ». Le tri se fait par règles : ce n'est pas un contrôle parental, et le résumé de la source n'est jamais réécrit.", plainLabel: "En clair", plainTerms: "Mots à connaître", plainUrgent: "Si vous utilisez ce produit, faites les mises à jour dès que possible.",
    plain_web: "Ça parle de sites Internet et de navigateurs.", plain_dev: "Ça parle de la fabrication des logiciels, côté développeurs.", plain_systems: "Ça parle des systèmes qui font tourner les ordinateurs, comme Linux ou Windows.", "plain_network-cloud": "Ça parle des réseaux et des serveurs qui font marcher Internet.", plain_security: "Ça parle de sécurité : se protéger des pirates et des failles.", plain_ai: "Ça parle d'intelligence artificielle, des programmes qui apprennent à partir d'exemples.", plain_hardware: "Ça parle des appareils et de leurs composants.", plain_mobile: "Ça parle de téléphones, de tablettes et d'applis.", plain_business: "Ça parle des entreprises de la tech, de leur argent et de leurs règles.", plain_selfhost: "Ça parle de faire tourner ses propres services chez soi.", plain_gaming: "Ça parle de jeux vidéo.", plain_science: "Ça parle de science et d'exploration de l'espace.", plain_general: "Ça parle de l'actualité générale de la tech.",
    imagesLabel: "Afficher les images des articles", imagesHelp: "Elles viennent directement du site de chaque source, qui voit alors votre adresse IP. Les logos, eux, sont hébergés par TechInfo.",
    setTransfer: "Changer d'appareil", transferHelp: "Exportez réglages, catégories, sujets, favoris, lectures et série, puis importez-les sur l'autre appareil. Les données déjà présentes y sont complétées, les réglages remplacés.", exportFile: "Exporter dans un fichier", exportCopy: "Copier le code d'export", importFile: "Importer un fichier", importPh: "…ou collez ici un code d'export", importPaste: "Importer le code collé", exportDone: "Fichier d'export créé.", exportCopied: "Code d'export copié.", importConfirm: "Remplacer les réglages de cet appareil et y ajouter {fav} favori(s) et {read} lecture(s) ?", importDone: "Import terminé.", importBad: "Ce fichier n'est pas un export TechInfo valide.",
  },
  en: {
    title: "TechInfo — tech watch", skip: "Skip to the news", search: "Search", searchAria: "Search the news",
    filters: "Filters", filtersN: "Filters ({n})", unread: "Hide read articles", sortLabel: "Sort", sortDate: "Newest first", sortScore: "By relevance",
    minLevelLabel: "Minimum importance", minl_minor: "All importance levels", minl_follow: "“Worth following” and up", minl_important: "“Important” and up", minl_critical: "“Critical” only",
    lvl_critical: "Critical", lvl_important: "Important", lvl_follow: "Worth following", lvl_minor: "Minor",
    more: "Show more", tabsAria: "Main navigation", chipsAria: "Categories", subtabsAria: "My articles",
    tabBriefing: "Briefing", tabForYou: "For me", tabExplore: "Explore", tabSaved: "Saved", tabSettings: "Settings", allChip: "All",
    savedTab: "Saved", archivedTab: "Archived", historyTab: "History",
    readSource: "Read the source", favAddAria: "Add to favorites", favOnAria: "Remove from favorites", markReadAria: "Mark as read", markUnreadAria: "Mark as unread", collected: "collected {when}",
    summaryNote: "Automatic rule-based summary. ", noSummaryNote: "Only the title and link are republished here: open the source to read the article. ",
    interest: "Estimated interest: {level} (score {score}).", high: "high", mid: "medium", low: "low",
    why: "Why this level: {list}.", cvss: "CVSS {score} (reported by {src}).", sources: "Sources:", techLinks: "Technical links:",
    loading: "Loading…", noBriefing: "No briefing yet: it is generated on every site update.",
    briefingOf: "Briefing for {day}. {summary}", topics: " Recurring words (take with caution): {list}.",
    forYouEmpty: "Pick your favorite categories in the settings to personalize this page. Until then, everything is shown.", goSettings: "Choose my categories",
    noSaved: "No favorites yet. Tap ☆ on an article to keep it here.", noArchived: "No archived favorites. Favorites whose article is no longer published are kept here.", noHistory: "No article opened recently.",
    noResults: "No results. Try other filters, or wait for the next update.", err: "Error {n}", del: "Delete", dateUnknown: "unknown date",
    footer: "Data updated {date}{sources}. Favorites, read marks and settings are kept in this browser.", footerSources: " — {ok}/{total} sources read",
    translate: "Translate", showOriginal: "Show original", translating: "Translating…", translated: "Machine-translated",
    trProgress: "Downloading the translation model… {pct}%", trError: "Translation failed. Try again, or read the original article.", engineNone: "Translation is not available in this browser.",
    confirmModel: "Translation needs a model download (≈ {mb} MB, once) from jsDelivr and Hugging Face. It runs in the background, but on a phone it uses a lot of memory: prefer Wi-Fi, and a computer if possible. Continue?",
    setTitle: "Settings", setLanguage: "Language", langLabel: "Interface and translation language", showLang: "Articles to show", showAll: "All (French and English)", showFr: "French only", showEn: "English only",
    setTranslation: "Translation", auto: "Automatically translate visible articles", clearTr: "Clear saved translations", clearedTr: "Translations cleared.",
    engineChrome: "Engine: your browser's built-in translator, running on your device.", engineModel: "Engine: a small model downloaded once into your browser (≈ {mb} MB), run in the background. No text is sent to a translation service.",
    trNote: "Machine translation can contain mistakes. “Read the source” always opens the original.",
    setCats: "My favorite categories", catsHelp: "“For me” only shows these categories, and they come first. No selection = show everything.",
    setSources: "Sources", sourcesHelp: "Untick a source to stop seeing its articles.", unmuteAll: "Re-enable all",
    setDisplay: "Display", theme: "Theme", themeAuto: "Automatic (device)", themeLight: "Light", themeDark: "Dark",
    textSize: "Text size", sizeS: "Small", sizeM: "Normal", sizeL: "Large", density: "Density", densComfort: "Comfortable", densCompact: "Compact",
    summaryLines: "Summaries", sumOff: "Hidden", sum2: "2 lines", sum3: "3 lines", sum5: "5 lines", sumFull: "Full",
    setHome: "Home", homeLabel: "Home page", homeBriefing: "Daily briefing", homeForYou: "For me", homeExplore: "Explore",
    setApp: "App", install: "📲 Install the app", installIos: "To install the app: tap Safari's Share button, then “Add to Home Screen”.", installed: "The app is installed.",
    setData: "My data", resetSettings: "Reset settings", confirmReset: "Restore all settings to their defaults?",
    resetData: "Erase favorites, read marks, streak and history", confirmData: "Permanently erase your favorites, read marks, streak and history on this device?", done: "Done.",
    r_official: "official source", r_followed: "followed category", r_nodate: "no publication date", r_kwCrit: "critical keyword: {k}", r_kw: "keyword: {k}",
    srcOk: "last read {when}", srcErr: "⚠ {err}", srcNever: "never read", srcCount: "{n} article(s)",
    srcSummary: "{bad} source(s) out of {total} are not responding right now.", srcAllOk: "All sources are responding.",
    catHealth: "Nothing recent in “{cat}”. Sources for this category: {list}.", catNoSource: "No source feeds “{cat}” yet.",
    setGestures: "Gestures and links", today: "Today", yesterday: "Yesterday", freshOne: "↑ 1 new article", freshMany: "↑ {n} new articles",
    shareAria: "Share or copy the link", copyLink: "Copy link", linkCopied: "Link copied",
    toastFavOn: "★ Added to favorites", toastFavOff: "Removed from favorites", toastRead: "✓ Marked as read", toastUnread: "Marked as unread",
    swipeRight: "Swipe right", swipeLeft: "Swipe left", swipeHelp: "On a phone, swipe a card. The buttons are still there.",
    sw_favorite: "Add to favorites", sw_read: "Mark as read", sw_share: "Share", sw_off: "No action",
    swHint_favorite: "★ Favorite", swHint_read: "✓ Read", swHint_share: "↗ Share",
    layoutLabel: "Layout", layoutCards: "Cards", layoutCompact: "Compact list", groupDays: "Day headings (Today, Yesterday…)",
    openIn: "Open articles", openTab: "In a new tab", openSame: "In this tab (Back keeps your place)",
    welcomeTitle: "Welcome to TechInfo", welcomeIntro: "A few settings to personalize your “For me” page. Everything stays on this device and can be changed later in Settings.",
    welcomeCats: "Your favorite categories", selectAll: "Select all", welcomeNeedOne: "Pick at least one category, or tap “Skip” to show everything.", finish: "Done", skip: "Skip", redoWelcome: "Run the welcome guide again",
    briefingSummary: "{total} stories in 24 h, including {c} critical and {i} important. Automatic rule-based selection.",
    tabLearn: "Learn", storiesAria: "Today's tech stories", storiesAll: "See all", storyOf: "Story {i} of {n}", storyClose: "Close stories", storyPrev: "Previous story", storyNext: "Next story", storyPause: "Pause", storyPlay: "Resume", storyDoneTitle: "You're up to date!", storyDoneText: "{n} of today's stories viewed. The rest can wait.", storyDoneBack: "Back to articles", storyDoneLearn: "See the word of the day",
    trendsTitle: "On the rise", trendsHelp: "Topics mentioned more than usual over 24 h, in at least 2 sources.", trendCount: "{n} articles in 24 h", myTopics: "My topics", follow: "☆ Follow “{topic}”", unfollow: "★ Following “{topic}” (remove)", topicFresh: "{n} new", setTopics: "Followed topics", topicsHelp: "Articles mentioning these topics appear in “For me”, on top of your categories.", topicPh: "e.g. Rust, Kubernetes, Starship", topicRemove: "Remove “{topic}”", noTopics: "No followed topics. Search for a word in Explore, then tap “Follow”.", topicAddBtn: "Follow this topic",
    wordTitle: "Word of the day", wordArticles: "See articles about it", quizTitle: "Daily quiz", quizStart: "Start the quiz", quizQ: "Question {i} of {n}", quizDef: "What does “{term}” mean?", quizTerm: "Which word matches: “{def}”", quizNext: "Next question", quizFinish: "See my score", quizScore: "Today's score: {ok} out of {n}.", quizRight: "Correct!", quizWrong: "Not quite, the right answer was: {answer}", quizAgain: "Play again for fun", quizKept: "Your first score of the day stays saved.", glossaryTitle: "Glossary", glossaryPh: "Find a word", glossaryNone: "No matching word.",
    streakTitle: "Day streak", streakN: "{n} day(s) in a row", streakZero: "No streak yet", streakHelp: "Read an article, watch the stories or take the quiz each day to keep it going.", streakBest: "Best: {n} day(s)",
    weekTitle: "Weekly recap", weekRead: "{n} article(s) read", weekDelta: "{d} compared with the week before", weekDays: "Active {n} day(s) out of 7", weekStories: "Stories finished {n} time(s)", weekQuiz: "Quiz: {ok} right answers out of {n}", weekTop: "Your categories: {list}", weekEmpty: "Nothing this week yet: the recap fills up as you read.", weekBanner: "Your weekly recap is ready", weekOpen: "See the recap",
    readerLabel: "Reading level", readerExpert: "Adult, comfortable with IT (show everything)", readerNovice: "Adult, new to all this (less jargon)", readerKid: "Child (simple topics)", readerHelp: "Sorts articles by their jargon and adds a “Plain words” explanation. Sorting is rule-based: this is not parental control, and the source's summary is never rewritten.", plainLabel: "Plain words", plainTerms: "Words to know", plainUrgent: "If you use this product, install updates as soon as you can.",
    plain_web: "This is about websites and browsers.", plain_dev: "This is about how software gets built, on the developer side.", plain_systems: "This is about the systems that run computers, like Linux or Windows.", "plain_network-cloud": "This is about the networks and servers that keep the internet running.", plain_security: "This is about security: staying safe from hackers and flaws.", plain_ai: "This is about artificial intelligence, programs that learn from examples.", plain_hardware: "This is about devices and their parts.", plain_mobile: "This is about phones, tablets and apps.", plain_business: "This is about tech companies, their money and their rules.", plain_selfhost: "This is about running your own services at home.", plain_gaming: "This is about video games.", plain_science: "This is about science and space exploration.", plain_general: "This is about general tech news.",
    imagesLabel: "Show article images", imagesHelp: "They come straight from each source's website, which then sees your IP address. Logos, on the other hand, are hosted by TechInfo.",
    setTransfer: "Move to another device", transferHelp: "Export settings, categories, topics, favorites, read marks and streak, then import them on the other device. Existing data there is added to, and settings are replaced.", exportFile: "Export to a file", exportCopy: "Copy the export code", importFile: "Import a file", importPh: "…or paste an export code here", importPaste: "Import the pasted code", exportDone: "Export file created.", exportCopied: "Export code copied.", importConfirm: "Replace this device's settings and add {fav} favorite(s) and {read} read mark(s)?", importDone: "Import complete.", importBad: "This file is not a valid TechInfo export.",
  },
};
const CATS = {
  fr: { web: "Web", dev: "Développement", systems: "Systèmes", "network-cloud": "Réseau et cloud", security: "Cybersécurité", ai: "IA", hardware: "Matériel", mobile: "Mobile et applis", business: "Business et marché", selfhost: "Self-hosting", gaming: "Jeu vidéo", science: "Science et espace", general: "Actu tech" },
  en: { web: "Web", dev: "Development", systems: "Systems", "network-cloud": "Network and cloud", security: "Cybersecurity", ai: "AI", hardware: "Hardware", mobile: "Mobile and apps", business: "Business and markets", selfhost: "Self-hosting", gaming: "Gaming", science: "Science and space", general: "Tech news" },
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
