# Rapport des évolutions de TechInfo

- **Date :** 30 octobre 2026
- **Branche :** `upgrade-tech-info-features` (à partir du commit `985cf01`)
- **État :** modifications locales, **ni commitées ni poussées**
- **Tests :** 212 réussis (134 avant), `tsc` sans erreur
- **Dernier build réel :** 58 sources lues sur 58, 715 articles

## Lancer le projet en local

```bash
npm ci
npm run build:site
cd site && python -m http.server 8080
```

Le site s'ouvre sur http://localhost:8080. Il affiche le résultat du dernier build : pour avoir de nouveaux articles ou voir une modification du code, il faut relancer `npm run build:site`.

## Évolutions demandées

| Demande | Ce qui a été fait |
|---|---|
| Miniature à côté de chaque source | Logo téléchargé une seule fois pendant le build, conservé dans la branche `data` et servi depuis le cache du navigateur. À défaut de logo, la première lettre de la source s'affiche. |
| Miniatures des articles | Image lue dans le flux RSS quand il en fournit une. Un réglage permet de les couper. |
| Stories du jour | Jusqu'à 10 stories, 2 par source au maximum, avec pause et navigation au clavier. Elles se terminent par « Tu es à jour ! ». |
| Mot du jour, glossaire, quiz | Nouvel onglet **Apprendre** : 59 termes écrits à la main (français et anglais, version adulte, débutant et enfant) et quiz de 5 questions par jour, adapté au niveau de lecture. |
| Série de jours et bilan | Série de jours et bilan sur 7 jours comparé à la semaine d'avant, avec un rappel le lundi. |
| Suivre un sujet, « Ça monte » | Un sujet se suit depuis la recherche et s'ajoute à « Pour moi ». « Ça monte » affiche les sujets cités plus que d'habitude sur 24 h, dans au moins 2 sources. |
| Niveau de lecture | Trois niveaux : adulte à l'aise (par défaut), adulte débutant, enfant. Les deux derniers filtrent les articles et ajoutent un bloc « En clair ». |
| Catégories | « Industrie » devient « Actu tech », et ses articles sont rangés d'après leur titre. Nouvelles catégories : « Business et marché », « Mobile et applis », « Science et espace ». Les anciens choix sont convertis automatiquement. |
| Export des paramètres | Par fichier ou par code à coller. À l'import, les réglages sont remplacés et les données ajoutées à celles de l'appareil. |

## Sources en échec

| Source | Cause | Solution | Résultat au dernier build |
|---|---|---|---|
| Google Security Blog | Redirection vers une adresse `http`, refusée | Le téléchargement reste en `https` ; les adresses privées restent bloquées | Répond, mais 0 article : son dernier billet date d'avril, trop vieux pour la rétention |
| Chrome Releases | Même redirection | Même correctif | 12 articles |
| Hacker News | Erreur 419 renvoyée par intermittence | Nouvel essai automatique, puis `hnrss.org` en secours | 20 articles, probablement via le secours |
| Microsoft MSRC | Flux de 3 Mo, au-dessus de la limite de 2 Mo | Limite passée à 4 Mo, filtre sur le titre, 3 nouveaux articles au maximum par mise à jour | 3 articles |
| JetBrains Blog | Défi anti-robot du pare-feu (`x-amzn-waf-action: challenge`), apparu après plusieurs builds | Volontairement non contourné ; nouvel essai automatique | Blocage levé de lui-même, 9 articles |

**Filtre MSRC :** sans lui, la source ajoutait 322 articles par semaine, dont 299 sur Edge et beaucoup de simples révisions de fiches. Seules les failles « Remote Code Execution » hors Edge sont gardées.

**JetBrains :** le blocage était temporaire, sans doute lié aux builds répétés. S'il revenait de façon durable, il faudrait retirer la source de `config/sources.json` ou demander l'accès à JetBrains.

## Sources ajoutées

- **TechCrunch** et **Journal du Net**, pour alimenter « Business et marché » (3 articles sans elles).
- **Microsoft Security Blog**, plus lisible que le flux MSRC.

## Choix à valider

- **Résumés non réécrits :** le projet fonctionne sans IA, donc « En clair » est un texte préparé selon la catégorie et les mots du glossaire. Un vrai résumé adapté demanderait une IA, donc un changement de principe.
- **Mode enfant :** ce n'est pas un contrôle parental, et le réglage le dit. Il laisse encore passer des articles peu adaptés, comme des promos Black Friday ou un article sur Wall Street.
- **Vie privée :** les images d'articles sont chargées depuis le site de chaque source, qui voit l'adresse IP du visiteur. C'est signalé et désactivable, mais activé par défaut.
- **MSRC et le niveau « Critique » :** ses failles « Remote Code Execution » passent automatiquement en « Critique ». Les jours de Patch Tuesday, elles peuvent occuper beaucoup de place ; baisser `maxPerRun` réduit cet effet.

## Limites

- **GitHub Actions :** le workflow modifié n'a pas tourné en ligne, et les sources peuvent traiter les serveurs de GitHub autrement que ce PC, surtout Hacker News et JetBrains.
- **Téléphone :** l'interface a été testée dans un navigateur de bureau au format mobile, pas sur un vrai appareil.
- **Quiz :** les fiches ont été relues et réécrites par Claude, et un échantillon de quiz relu, mais aucun enfant ni débutant ne les a essayées.
- **Logos manquants :** Mozilla Hacks et Jeuxvideo.com affichent leur première lettre.

## Relecture des fiches et du quiz

| Défaut trouvé | Mesure avant | Correction | Mesure après |
|---|---|---|---|
| Bonne réponse rarement en 4e position (tirage biaisé) | 7 % au lieu de 25 % | Nouveau générateur de hasard | Entre 23 % et 26 % par position |
| Quasi-synonyme de la réponse parmi les choix | 26 questions par an | Liste de termes trop proches, exclus des mauvaises réponses | 0 |
| Définition qui contient le terme | 4 fiches en français, 3 en anglais | Fiches réécrites | 0, contrôlé par un test |
| Débutant sans fiches propres (définitions adultes, avec du jargon) | 17 fiches concernées en français | 59 définitions débutant écrites, en français et en anglais | Aucun terme de la liste de jargon, contrôlé par un test |
| Enfant et débutant interrogés sur des termes très techniques | Tout le glossaire | Enfant : 32 termes. Débutant : 49 termes. Le mot du jour suit la même règle | Contrôlé sur un an par un test |
| Mauvaises réponses sans rapport avec la question | Tirées au hasard | Même domaine d'abord | Au moins une sur 80 % des questions, contrôlé par un test |
| « J'ai » détecté comme le terme « IA » | Faux positif | Sigles cherchés avec leurs majuscules | Corrigé |

Autre correction faite au passage : le mot anglais « fine » classait à tort des articles dans « Business et marché » ; il est remplacé par « fined ».

## Détail des modifications

25 fichiers sont touchés, hors ce rapport : 18 modifiés et 7 créés. Le dossier `site/` généré par les builds et `node_modules/` sont ignorés par git.

### Collecte et build

| Fichier | État | Modification |
|---|---|---|
| `collector/logos.ts` | Créé | Recherche et téléchargement des logos, contrôle du vrai type de fichier, refus du SVG, nouvel essai après 7 jours en cas d'échec. |
| `collector/collect.ts` | Modifié | Catégorie déduite du titre, enregistrement de l'image, options `include`, `exclude`, `maxPerRun` et `fallback_url`. |
| `collector/jobs.ts` | Modifié | Transmission de ces options depuis `config/sources.json`. |
| `collector/safefetch.ts` | Modifié | Ajout de `fetchBytes` pour les logos, limite portée à 4 Mo, redirections `http` passées en `https`, nouvel essai sur les réponses 419 et 202. |
| `collector/site.ts` | Modifié | Export et restauration de l'image, conversion des anciennes catégories à la reprise de l'état. |
| `scripts/build-site.ts` | Modifié | Étape des logos, ajout du chemin du logo à chaque source. |
| `.github/workflows/update.yml` | Modifié | Sauvegarde du dossier `logos` dans la branche `data`. |
| `migrations/0002_article_image.sql` | Créé | Colonne `image` sur les articles. |

### Logique partagée et configuration

| Fichier | État | Modification |
|---|---|---|
| `src/core/categories.ts` | Modifié | Nouvelle liste de catégories, classement par mots-clés, conversion des anciennes catégories. |
| `src/core/feed.ts` | Modifié | Lecture des images du flux, rejet du `http`, des pixels de suivi et des images de 1 pixel. |
| `config/categories.json` | Créé | Mots-clés de classement par catégorie. |
| `config/sources.json` | Modifié | 9 sources changées de catégorie, 3 sources ajoutées (58 au total), filtre sur Microsoft MSRC, secours sur Hacker News. |

### Interface

| Fichier | État | Modification |
|---|---|---|
| `web/app.js` | Modifié | Logos et images sur les cartes, stories, page Apprendre, sujets suivis, « Ça monte », niveau de lecture, « En clair », export et import. |
| `web/api.js` | Modifié | Niveau de lecture, tendances, sujets, stories, statistiques, quiz, export et import avec vérification des données, compteur de lecture corrigé quand on repasse un article en « non lu ». |
| `web/insights.js` | Créé | Niveau de lecture, mot du jour, quiz (tirage non biaisé, mauvaises réponses du même domaine), série, bilan et tendances. |
| `web/glossary.js` | Créé | Les 59 termes du glossaire, en trois niveaux, et la liste des termes trop proches pour le quiz. |
| `web/i18n.js` | Modifié | Textes français et anglais, nouvelles catégories, conversion des anciennes catégories favorites. |
| `web/index.html` | Modifié | Zone au-dessus de la liste et fenêtre des stories. |
| `web/style.css` | Modifié | Styles des logos, miniatures, stories, « En clair » et page Apprendre. Le titre des cartes habille désormais la miniature. |
| `web/sw.js` | Modifié | Cache dédié aux logos, nouveaux fichiers ajoutés à la liste du hors-ligne. |

### Tests et documentation

| Fichier | État | Modification |
|---|---|---|
| `tests/features.test.ts` | Créé | Images, logos, catégories, niveau de lecture, glossaire, quiz, série, bilan, tendances. |
| `tests/sources.test.ts` | Créé | Filtre, plafond, adresse de secours, redirections, réponses 419 et 202, limite de taille. |
| `tests/app-dom.test.ts` | Modifié | Parcours d'interface des nouveautés. Un test existant passe de la catégorie `space` à `science`, car `space` n'existe plus. |
| `tests/pwa.test.ts` | Modifié | Cache des logos dans le service worker. |
| `README.md` | Modifié | Nouvelles fonctions, fonctionnement des logos et catégories, vie privée, options des sources, état des tests. |
