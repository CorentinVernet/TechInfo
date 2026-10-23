# TechInfo (version GitHub Pages)

Site de veille tech **100 % statique** : aucun serveur, aucune base de données, aucun secret.
Une tâche GitHub Actions lit ~35 flux RSS toutes les 3 h, classe les articles par règles (**sans IA**), et publie le résultat sur GitHub Pages. Le navigateur du visiteur fait le reste : recherche, filtres, favoris, « lu / non lu » (gardés dans **son** navigateur, rien n'est envoyé nulle part).

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

## Comment ça marche
- `scripts/build-site.ts` reprend l'état précédent (branche `data`, un seul commit écrasé à chaque fois), lit les flux, dédoublonne (même URL ou titre très proche), classe, garde **7 jours**, puis génère `site/` (page + `data/articles.json`).
- Si **aucune** source ne répond (panne réseau), la mise à jour est annulée : le site déjà publié reste intact.
- Le fichier `data/articles.json` est le seul « backend » : le navigateur le lit et filtre lui-même (`web/api.js`).
- **Favoris** : copiés dans le navigateur avec titre et lien ; quand l'article dépasse 7 jours, il passe dans « Favoris archivés » et reste consultable.

## Est-ce autorisé ? Que publie le site ?
Le site republie des **titres, liens, sources, dates et le classement calculé**, avec un lien vers l'article d'origine. **Aucun résumé n'est republié par défaut** (`config/public.json`, `"includeSummary": false`). Les flux RSS sont faits pour être repris par des lecteurs, mais les conditions d'utilisation varient selon les sites et je ne suis pas juriste : avant de partager l'adresse largement,
- vérifiez les conditions des sources qui vous inquiètent et retirez-les de `config/sources.json` si besoin (ou si un éditeur le demande) ;
- gardez les résumés désactivés, ou limitez-les (`summaryMaxChars`) si vous les activez ;
- n'utilisez pas le site pour republier le contenu complet des articles (ce n'est pas ce qu'il fait).
Le site n'utilise ni cookie, ni statistiques, ni service tiers ; GitHub peut toutefois journaliser les visites côté hébergement.

## Secrets : il n'y en a aucun
Le dépôt ne contient ni clé, ni jeton, ni mot de passe. Le workflow utilise le jeton **temporaire** fourni automatiquement par GitHub (`github.token`), limité à ce dépôt. N'ajoutez jamais de secret dans ce dépôt public.

## Personnaliser
- **Sources** : `config/sources.json` (un bloc par flux : nom, URL, langue, catégorie, fiabilité 1–5, officielle ou non). `npm run verify-sources` teste chaque flux.
- **Classement** : `config/ranking.json` (poids, seuils, mots-clés). **Doublons / rétention** : `config/dedupe.json`.
- **Prévisualiser chez soi** : `npm install && npm run build:site`, puis `cd site && python3 -m http.server 8080` et ouvrir `http://localhost:8080`.
- **Licence** : aucune n'est fournie. Sans licence, personne n'a le droit de réutiliser votre code ; ajoutez-en une (ex. MIT) si vous voulez le permettre.

## Dépannage
- **Le site ne se met plus à jour** : GitHub désactive les tâches planifiées d'un dépôt public sans activité pendant 60 jours. Onglet *Actions* → réactivez le workflow, ou faites un commit sur `main`.
- **Erreur « Permission denied » sur la branche `data`** : *Settings* → *Actions* → *General* → *Workflow permissions* → « Read and write permissions ».
- **Page blanche** : vérifiez que *Pages* est bien en source « GitHub Actions » et que l'exécution est verte.
- **Les versions des actions GitHub** (`checkout`, `setup-node`, `upload-pages-artifact`, `deploy-pages`) peuvent évoluer ; si GitHub signale une version obsolète, remplacez le numéro dans `.github/workflows/update.yml`.

## État réel
**Testé** (38 tests, `tsc` strict) : collecte, doublons, restauration de l'état entre deux exécutions, fichier public sans résumé, API navigateur (recherche, filtres, favoris, archivage, briefing) ; génération complète du site avec flux simulés, deux exécutions de suite.
**Non testé** : le workflow sur GitHub même (Actions, Pages, branche `data`), les flux RSS réels (URL non vérifiées : lancez `npm run verify-sources`), l'affichage sur un vrai téléphone.
**Non implémenté** : notifications, mode hors ligne (PWA), export Markdown/JSON d'un article.
