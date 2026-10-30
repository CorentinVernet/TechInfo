<p align="center"><img src="web/icons/icon-192.png" width="96" alt="Logo TechInfo"></p>

# TechInfo (version GitHub Pages)

Site de veille tech **100 % statique** : aucun serveur, aucune base de données, aucun secret.
Une tâche GitHub Actions lit ~55 flux RSS toutes les 3 h, classe les articles par règles (**sans IA**), et publie le résultat sur GitHub Pages. Le navigateur du visiteur fait le reste : recherche, filtres, favoris, « lu / non lu » (gardés dans **son** navigateur, rien n'est envoyé nulle part).

## Mettre en ligne (gratuit)

Il faut un compte GitHub (gratuit) et un dépôt **public** : GitHub Pages et GitHub Actions sont gratuits pour les dépôts publics.

1. **Créer le dépôt** : github.com → « New repository » → nom `techinfo` (ou autre), visibilité **Public**, sans README ni .gitignore.
2. **Envoyer le code** (depuis ce dossier, dans un terminal) :
   ```bash
   git init -b main
   git add .
   git commit -m "TechInfo"
   git remote add origin https://github.com/VOTRE-PSEUDO/techinfo.git
   git push -u origin main
   ```
   GitHub n'accepte plus le mot de passe en HTTPS : connectez-vous d'abord avec la CLI GitHub (`gh auth login`) ou utilisez une clé SSH. Sans git, vous pouvez aussi glisser-déposer les fichiers sur la page du dépôt, **y compris le dossier caché `.github`** (affichez les fichiers cachés avec `Ctrl+H`).
3. **Activer Pages** : dépôt → *Settings* → *Pages* → *Build and deployment* → *Source* : **GitHub Actions**.
4. **Lancer la première mise à jour** : onglet *Actions* → « Mise à jour du site » → *Run workflow*. Comptez 2 à 5 minutes. Si l'étape `deploy` échoue avec une erreur sur Pages, c'est que l'étape 3 n'était pas faite : faites-la puis relancez (*Re-run all jobs*).
5. **Adresse du site** : `https://VOTRE-PSEUDO.github.io/techinfo/` (affichée aussi à la fin de l'exécution).

Ensuite tout est automatique : le site se met à jour toutes les 3 h (GitHub peut retarder de quelques minutes) et à chaque `git push` sur `main`.

## Utiliser le site
- **Navigation** (barre du bas sur téléphone, en haut sur ordinateur) : **Briefing** (sélection du jour), **Pour moi**, **Explorer**, **Favoris**, **Apprendre**, **Réglages**.
- **Stories du jour** : en haut de *Briefing* et de *Pour moi*, jusqu'à 10 actualités en plein écran (2 par source au plus), qui avancent seules (pause, flèches, zones de gauche et de droite). Elles se terminent par « Tu es à jour ! ». L'anneau coloré disparaît une fois la story vue ; une story vue n'est pas comptée comme article lu.
- **Logos et images** : chaque source a son logo (ou, s'il est introuvable, sa première lettre). Les articles dont le flux fournit une image l'affichent en miniature (réglage *Afficher les images des articles*).
- **Apprendre** : **mot du jour**, **quiz du jour** (5 questions, le premier score compte), **glossaire** consultable, **série de jours** (lire un article, finir les stories ou faire le quiz) et **bilan de la semaine** (rappelé le lundi dans *Briefing*).
- **Ça monte** : dans *Briefing* et *Explorer*, les sujets cités plus que d'habitude sur 24 h, dans au moins 2 sources.
- **Suivre un sujet** : recherchez un mot, puis touchez « ☆ Suivre » ; ses articles s'ajoutent à *Pour moi*, avec le nombre de nouveautés. La liste se gère aussi dans *Réglages → Sujets suivis*.
- **Niveau de lecture** : *Adulte à l'aise avec l'informatique* (tout voir, par défaut), *Adulte débutant* (masque le plus technique) ou *Enfant* (sujets simples ; ni sécurité, ni finance, ni sujets sensibles). Les deux derniers ajoutent à chaque carte une explication **En clair** et les mots à connaître. Tout se fait par règles, sans IA : le résumé de la source n'est jamais réécrit, et ce filtre **n'est pas un contrôle parental** (il peut laisser passer un article inadapté).
- **Changer d'appareil** : *Réglages → Changer d'appareil* exporte réglages, catégories, sujets, favoris, lectures et série (fichier ou code à coller). À l'import, les réglages sont remplacés et les données complétées.
- **Mes catégories favorites** : cochez-les dans *Réglages → Mes catégories favorites*. **Pour moi** n'affiche que ces catégories (avec leurs pastilles de filtre) ; *Explorer* montre tout, vos catégories en premier. Aucune catégorie choisie = tout s'affiche.
- **Favoris** : l'étoile garde un article ; trois onglets (*Favoris*, *Archivés* pour les articles qui ne sont plus publiés, *Historique*).
- **Recherche et filtres** : champ de recherche (accents ignorés) et bouton *Filtres* : importance minimale, tri (récents ou pertinence), masquer les lus.
- **Défilement infini** : la suite se charge toute seule en approchant de la fin (cartes « squelettes » pendant le chargement). Les articles sont regroupés par jour (*Aujourd'hui*, *Hier*, puis la date).
- **Liste compacte** : titres seuls, une ligne par article ; touchez un titre pour déplier résumé et boutons (réglage *Mise en page*, aussi dans *Filtres*).
- **Balayages (téléphone)** : droite = favori, gauche = marquer comme lu par défaut ; chaque sens se règle dans *Réglages → Gestes et liens* (favori, lu, partager ou rien). Les boutons restent disponibles.
- **Partager** : le bouton ↗ ouvre le partage du téléphone, ou copie le lien de l'article d'origine si le navigateur n'a pas de partage ; « Copier le lien » est aussi dans le détail d'un article.
- **Adresse partageable et bouton retour** : chaque vue a son adresse (`#/explore/ai?q=rust`). Le bouton retour revient à la vue précédente **à la même position**, et la place est aussi retrouvée après un rechargement. Pour que « Lire la source » ouvre l'article dans le même onglet (et que le retour vous ramène à votre place), choisissez *Ouvrir les articles → Dans cet onglet*.
- **Nouveaux articles** : quand le site est mis à jour pendant que vous lisez, un bandeau « ↑ 12 nouveaux articles » apparaît (vérifié toutes les 5 minutes et au retour sur la page) ; la liste ne bouge pas tant que vous ne touchez pas le bandeau.
- **Premier lancement guidé** : langue, thème et catégories favorites, pour que « Pour moi » ne soit jamais vide (on peut aussi passer). Relançable depuis *Réglages → Accueil*.
- **Résumés** : phrases extraites du flux (280 caractères maximum), jamais générées. Les articles dont le flux n'en donne pas n'affichent que le titre.

## Réglages (gardés dans votre navigateur)
Langue de l'interface et de la traduction · langue des articles affichés (tous / français / anglais) · traduction automatique · catégories favorites · sources masquées · thème (automatique, clair, sombre) · taille du texte · densité · mise en page (cartes ou liste compacte) · titres par jour · résumés (masqués, 2, 3, 5 lignes, entiers) · gestes de balayage (droite et gauche) · ouverture des articles (nouvel onglet ou même onglet) · page d'accueil (Briefing, Pour moi, Explorer) · tri par défaut · importance minimale · masquer les lus · niveau de lecture · images des articles · sujets suivis · installation de l'application · export et import · réinitialiser les réglages · effacer favoris, lectures, série et historique.

## Français / English et traduction
- **Langue par défaut** : celle du navigateur ou du téléphone (français si c'est du français, anglais sinon), modifiable dans *Réglages*.
- **Traduction** : un article d'une autre langue que la vôtre a un bouton **Traduire** (FR→EN si vous lisez en anglais, EN→FR si vous lisez en français) et « Voir l'original ». L'option « Traduire automatiquement » traduit **seulement les articles visibles à l'écran**, un par un, et s'arrête dès que vous changez de page. « Lire la source » ouvre toujours l'original ; les noms de sources ne sont jamais traduits.
- **Comment, sans serveur ni clé, gratuitement** : tout se passe dans le navigateur.
  1. S'il existe, le **traducteur intégré du navigateur** (Chrome/Edge sur ordinateur, en HTTPS) travaille sur l'appareil.
  2. Sinon, un **petit modèle de traduction** (Marian « opus-mt », via transformers.js) est téléchargé **une seule fois**, après accord (≈ 110 Mo), et exécuté dans un **Web Worker** : l'interface ne se fige pas. Un seul chargement à la fois, jamais deux modèles en mémoire.
  Sur téléphone (où le traducteur intégré n'existe pas), le modèle utilise beaucoup de mémoire : l'application le dit avant de le télécharger, et la traduction automatique est désactivée par défaut. Les traductions déjà faites sont mémorisées (600 maximum).
- **Vie privée** : aucun texte n'est envoyé à un service de traduction. Si le modèle est utilisé, le navigateur télécharge le code depuis **jsDelivr** et le modèle depuis **Hugging Face** (ils voient l'adresse IP du visiteur) ; l'utilisateur en est prévenu avant.
- La traduction automatique est approximative ; elle s'applique aux titres et aux résumés. Les textes de l'interface sont écrits à la main.

## Installer comme une application
Le site est une **PWA** : on peut l'ajouter à l'écran d'accueil ou au bureau, il s'ouvre alors en plein écran avec son icône, sans barre d'adresse. Il faut le HTTPS, ce qui est le cas sur GitHub Pages.
- **Android (Chrome)** et **ordinateur (Chrome, Edge)** : bouton **Installer l'application** dans *Plus* (ou dans *Langue et traduction*) ; sinon via le menu du navigateur, ou l'icône d'installation dans la barre d'adresse.
- **iPhone / iPad (Safari)** : bouton Partager, puis « Sur l'écran d'accueil » (l'appli l'explique elle-même).
- **Hors ligne** : la dernière version de la page et les dernières données chargées restent consultables ; la mise à jour des articles demande une connexion. Le service worker ne touche pas aux téléchargements du modèle de traduction (gérés par le navigateur).
- Les fichiers concernés : `web/manifest.webmanifest`, `web/sw.js`, `web/icons/`. Le logo fourni sert d'icône d'application (192 et 512 px, version « maskable » pour Android, version iOS 180 px), de favicon (`favicon.ico`, 16 et 32 px) et d'image d'en-tête. Pour le changer, remplacez les fichiers de `web/icons/` et `web/favicon.ico` en gardant les mêmes noms et tailles. Après une modification du code, le service worker prend la dernière version dès que vous êtes en ligne ; en cas de souci d'affichage, rechargez une fois.

## Comment ça marche
- `scripts/build-site.ts` reprend l'état précédent (branche `data`, un seul commit écrasé à chaque fois), lit les flux, dédoublonne (même URL ou titre très proche), classe, garde **7 jours** (et toujours au moins les 8 articles les plus récents de chaque catégorie, jusqu'à 45 jours, pour qu'une catégorie peu active ne soit jamais vide), puis génère `site/` (page + `data/articles.json`).
- Si **aucune** source ne répond (panne réseau), la mise à jour est annulée : le site déjà publié reste intact.
- Le fichier `data/articles.json` est le seul « backend » : le navigateur le lit et filtre lui-même (`web/api.js`).
- **Catégories** : chaque source a sa catégorie dans `config/sources.json`. Les articles des sources généralistes (`general`, « Actu tech ») sont rangés d'après leur titre, selon les mots-clés de `config/categories.json` (la catégorie « Industrie » a disparu : ses sources étaient en réalité généralistes). Les anciennes catégories sont converties automatiquement, y compris les favorites des visiteurs.
- **Logos** : téléchargés une seule fois pendant le build, depuis le site de chaque source, puis gardés dans la branche `data` (`logos/`). Un logo connu n'est jamais retéléchargé ; un échec n'est retenté qu'après 7 jours ; le SVG est refusé. Dans le navigateur, le service worker les sert depuis son cache. Pour forcer le remplacement d'un logo, retirez son entrée de `logos/index.json` dans la branche `data`.
- **Glossaire** : `web/glossary.js`, écrit à la main (FR/EN, version adulte et enfant). Il alimente le mot du jour, le quiz et « En clair ». Les calculs (niveau de lecture, tendances, série, bilan) sont dans `web/insights.js`.
- **Favoris** : copiés dans le navigateur avec titre et lien ; quand l'article dépasse 7 jours, il passe dans « Favoris archivés » et reste consultable.

## Est-ce autorisé ? Que publie le site ?
Le site republie des **titres, liens, sources, dates, le classement calculé, un court extrait, le logo de la source et l'adresse de l'image de l'article** (280 caractères au plus, tiré du flux RSS), avec un lien vers l'article d'origine. Les résumés sont **activés** (`config/public.json`, `"includeSummary": true`) ; passez-les à `false` pour ne republier que titres et liens. Les flux RSS sont faits pour être repris par des lecteurs, mais les conditions d'utilisation varient selon les sites et je ne suis pas juriste : avant de partager l'adresse largement,
- vérifiez les conditions des sources qui vous inquiètent et retirez-les de `config/sources.json` si besoin (ou si un éditeur le demande) ;
- limitez la longueur des extraits (`summaryMaxChars`) ou désactivez-les si un éditeur le demande ;
- ne republiez jamais le contenu complet des articles (le site ne le fait pas).
Les logos et les images restent la propriété de leurs éditeurs : retirez une source si son éditeur le demande. Le site n'utilise ni cookie, ni statistiques, ni service tiers ; GitHub peut toutefois journaliser les visites côté hébergement. **Exception à connaître** : les images d'articles ne sont pas copiées, elles sont chargées depuis le site de chaque source (sans référent), qui voit donc l'adresse IP du visiteur. Le réglage *Afficher les images des articles* les coupe.

## Secrets : il n'y en a aucun
Le dépôt ne contient ni clé, ni jeton, ni mot de passe. Le workflow utilise le jeton **temporaire** fourni automatiquement par GitHub (`github.token`), limité à ce dépôt. N'ajoutez jamais de secret dans ce dépôt public.

## Personnaliser
- **Sources** : `config/sources.json` (un bloc par flux : nom, URL, site, langue, catégorie, fiabilité 1–5, officielle ou non ; en option `include` et `exclude`, expressions sur le titre pour un flux trop bavard, `maxPerRun`, nombre d'articles ajoutés par mise à jour, et `fallback_url`, adresse de secours). `npm run verify-sources` teste chaque flux.
- **Classement** : `config/ranking.json` (poids, seuils, mots-clés). **Doublons / rétention** : `config/dedupe.json`.
- **Prévisualiser chez soi** : `npm install && npm run build:site`, puis `cd site && python3 -m http.server 8080` et ouvrir `http://localhost:8080`.
- **Licence** : aucune n'est fournie. Sans licence, personne n'a le droit de réutiliser votre code ; ajoutez-en une (ex. MIT) si vous voulez le permettre.

## Dépannage
- **Une catégorie est vide ou n'a rien de nouveau** : ouvrez *Réglages → Sources* : chaque source indique sa dernière lecture, son erreur éventuelle (`⚠ HTTP 403`…) et son nombre d'articles ; une catégorie vide explique aussi elle-même quelles sources l'alimentent. Dans GitHub, onglet *Actions* → dernière exécution → étape « Run npm run build:site » : les lignes `! Nom : erreur` donnent le détail. `npm run verify-sources` teste toutes les sources chez vous. Une source qui échoue 5 fois de suite est mise en pause 6 h avant un nouvel essai.
- **Le site ne se met plus à jour** : GitHub désactive les tâches planifiées d'un dépôt public sans activité pendant 60 jours. Onglet *Actions* → réactivez le workflow, ou faites un commit sur `main`.
- **Erreur « Permission denied » sur la branche `data`** : *Settings* → *Actions* → *General* → *Workflow permissions* → « Read and write permissions ».
- **Page blanche** : vérifiez que *Pages* est bien en source « GitHub Actions » et que l'exécution est verte.
- **Les versions des actions GitHub** (`checkout`, `setup-node`, `upload-pages-artifact`, `deploy-pages`) peuvent évoluer ; si GitHub signale une version obsolète, remplacez le numéro dans `.github/workflows/update.yml`.

## État réel
**Testé** (`npm test`, `tsc` strict) : logos (cache, type réel, refus du SVG, nouvel essai), images des flux, catégories et leur migration, niveau de lecture, glossaire, mot du jour, quiz, série, bilan, tendances, sujets suivis, stories, export et import (y compris un fichier trafiqué) ; collecte, doublons, restauration de l'état entre deux exécutions, fichier public sans résumé, API navigateur (recherche, filtres, langue, favoris, archivage, briefing), manifeste, icônes (dimensions réelles) et service worker (réseau d'abord, hors ligne, anciens caches supprimés), bouton d'installation, adresses partageables, bouton retour et position de défilement, défilement infini et cartes squelettes, titres par jour, liste compacte, balayages (seuils, sens réglables, défilement vertical préservé), partage et copie du lien, bandeau de nouveaux articles, premier lancement guidé, logo et icônes, navigation et catégories favorites, réglages (thème, taille, densité, résumés, sources masquées, importance minimale, réinitialisation), annulation des traductions quand on change de page, disparition de la barre de progression en cas d'échec, worker de traduction (protocole, une seule préparation à la fois, arrêt/libération de la mémoire), textes FR/EN (mêmes clés et variables dans les deux langues), logique de traduction (choix du moteur, accord avant téléchargement, file d'attente, cache), et l'interface complète simulée dans un navigateur de test (changement de langue, boutons Traduire FR→EN et EN→FR, traduction automatique, erreurs) ; génération complète du site avec flux simulés.
**Non testé** : le workflow sur GitHub même (Actions, Pages, branche `data`) ; les flux RSS réels (URL non vérifiées : lancez `npm run verify-sources`) ; l'affichage sur un vrai téléphone ; **l'installation réelle** (Android, iPhone, ordinateur : je n'ai pas pu cliquer sur « Installer » dans un vrai navigateur) ; **la traduction réelle** : le traducteur intégré de Chrome et le téléchargement du modèle (`Xenova/opus-mt-fr-en` existe ; `opus-mt-en-fr` est attendu sur le même modèle mais n'a pas été vérifié). Les tests utilisent de faux moteurs. Essayez les deux sens sur le site publié avant de le partager.
**Non implémenté** : notifications, mode hors ligne complet des traductions et du modèle, notifications push, export Markdown/JSON d'un article, autres langues que le français et l'anglais.
