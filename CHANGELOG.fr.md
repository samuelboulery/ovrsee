<p align="center">
  <a href="./CHANGELOG.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-3a3d4d?style=for-the-badge"></a>
  <a href="./CHANGELOG.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-4c3f91?style=for-the-badge"></a>
</p>

# Changelog

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le
versionnage [SemVer](https://semver.org/lang/fr/).

## [Non publié]

## [1.2.1] — 2026-09-05

### Corrigé

- **Le terminal intégré ne s'ouvrait pas sous Windows.** Le panneau rendait
  « impossible d'ouvrir un shell (/bin/zsh) : File not found ». `loginShell()`
  n'avait pas de branche Windows — `SHELL` n'y existe pas, et le repli zsh
  sortait tel quel — et `-l`, un drapeau POSIX, était codé en dur dans
  `electron/pty.js`. Le shell est désormais `COMSPEC`, sans arguments.
- **Le crawl taisait la raison de ses échecs sous Windows.** `shell: true` y
  fait du fils un `cmd.exe` ; détaché, il prend sa propre console, et ce que la
  commande `dev` écrit y part au lieu d'aller dans les tuyaux lus par le crawl.
  Tout échec — un `pnpm` absent, un `package.json` manquant — se consignait
  dans `scans.jsonl` en « (la commande dev s'est arrêtée d'elle-même) », sans
  rien de plus. `detached` se décide maintenant par plateforme, dans
  `shellRun()`, avec le shell qu'il accompagne.
- **Le serveur de dev survivait au crawl sous Windows**, port compris, et le
  crawl suivant se refusait de lui-même. Windows n'a pas de groupes de
  processus : `process.kill(-pid)` y jette `ESRCH`, et le repli `child.kill()`
  n'emportait que le `cmd.exe`. Les trois sites d'arrêt passent par un
  `killTree()` commun, qui descend l'arbre par `taskkill /T`.
- **Les raccourcis affichés suivent la plateforme.** L'interface écrivait ses
  raccourcis en glyphes Apple codés en dur — `⌘K` dans la barre d'état de
  chaque onglet, `⌘,` sur l'engrenage, `⇧⌘E` pour le sélecteur, `⇧⌘1-9` sur les
  projets — jusque dans l'application Windows, où ⌘ ne désigne aucune touche du
  clavier. Un module `app/src/raccourcis.ts` les écrit maintenant pour la
  plateforme courante : `Ctrl+K`, `Ctrl+Shift+E`. Les menus natifs, eux,
  étaient déjà justes : `electron/menu.js` déclare ses accélérateurs en
  `CmdOrCtrl`.
- **Deux gestes ne répondaient pas du tout sous Windows.** « Copier le chemin »
  (`⌘⇧C`, onglet Aperçu) et le sélecteur d'élément (`⇧⌘E`, onglet Navigateur)
  testaient `event.metaKey` **seul**, sans son équivalent `ctrlKey`.
- **L'indice de zoom du canevas nommait une touche sans effet.** L'onglet
  Produit annonçait « ⌥ molette pour zoomer » alors que le code teste
  `ctrlKey || metaKey` : Alt n'a jamais zoomé, sur aucune plateforme. Le
  libellé suit désormais le code.

## [1.2.0] — 2026-09-02

### Ajouté

- **Thème clair complet, terminal compris** (issue #64, epic T-0218). Le canvas
  xterm ne lit pas le CSS : sa palette est reposée sur chaque terminal vivant à
  la bascule.
- **Couleur d'accent par projet** (#48, T-0215). L'accent vit dans le registre —
  c'est une préférence de poste, pas un choix du dépôt observé.
- **Coller une image directement dans un ticket** (T-0219, #54).
- **État des sessions dans le sélecteur de projet, et panneau de commandes**
  (T-0217, T-0224, T-0225, #47).
- **Prompts par projet, une seule liste de commandes, bande rétractable**
  (T-0216, #79).
- **Commenter une zone depuis l'onglet Navigateur** (#65, T-0214).
- La vitrine montre les sept vrais onglets au lieu d'une maquette (#91).
- La barre des onglets terminal passe en icônes, et la taille choisie pour une
  page est épinglée (T-0220).
- Un plan resté ouvert sans commit se clôt à la main :
  `ovrsee:close <plan.md> --commit <sha>`.

### Modifié

- **Un second dégraissage a rendu 1 311 lignes** dans tout l'arbre, et retrouvé
  au passage trois libellés mal orthographiés (T-0232).
- Le plafond de 800 lignes se mesure désormais par un test au lieu d'être écrit
  dans une règle (T-0241). Sa liste d'exemptions est la dette, elle est faite
  pour raccourcir.
- Le badge de version du README se lit dans `package.json` plutôt qu'un chiffre
  en dur (#95).
- **Les sept captures du README se régénèrent par une commande** (`pnpm screenshots`,
  T-0264) au lieu d'être prises à la main : l'app est pilotée pour de vrai dans
  Electron, screenmat pose le cadre, et un test échoue quand un onglet n'a pas
  d'image — ou une image pas d'onglet. Les anciennes précédaient le thème clair et
  montraient encore des défauts corrigés depuis.

### Corrigé

- **Le réglage « système » du thème ne suivait plus le poste dans Electron**
  (T-0242). Ouvrir les DevTools de l'onglet Navigateur reforçait `themeSource`,
  ce qui figeait la requête média du rendu et coupait le suivi.
- **Un commit s'inscrit dans tous les plans qu'il réalise**, pas un seul
  (T-0223). Un plan sous lequel du travail avait réellement été écrit pouvait
  sinon rester inclosable, la date de clôture se prenant sur le dernier commit.
- `close <plan.md>` visait tous les plans ouverts au lieu du seul nommé, quand
  `--commit` était absent (T-0223).
- `reconcile` ne voyait pas les commits faits le jour même (T-0222).
- **Sept vignettes cassées sur l'onglet Produit**, et un compte écrit deux fois
  (« 14 14 plans ») (T-0250). Également : « dernier audit il y a aujourd'hui »,
  « 1 tickets », et un bandeau qui disait d'ouvrir Ovrsee alors qu'on l'avait
  sous les yeux.

### Sécurité

- **Un dépôt observé exécutait du code dès son inscription** (T-0244).
  `git status` honore le `.git/config` du dépôt sur lequel il tourne, et
  `core.fsmonitor` y nomme un programme. Inscrire un projet lit son état : un
  dépôt reçu en archive exécutait donc son propre code, bien avant que l'accord
  sur la commande `dev` (T-0190) ait son mot à dire. Toute commande git visant
  un dépôt observé passe désormais par une garde unique.
- **Équiper un projet exécutait ses hooks git** (T-0245). Le commit d'amorçage
  passe `--no-verify`.
- **Un fichier servi par l'application pouvait s'exécuter avec elle** (T-0246).
  `/api/media` servait les `.svg` du dépôt sans en-tête qui les neutralise, et
  une navigation de premier plan pouvait le promouvoir en page dans l'origine
  de l'interface — donc avec `window.ovrsee`, donc avec le terminal. Les
  réponses fichier portent désormais `Content-Security-Policy: sandbox` aux deux
  hôtes, et la fenêtre principale ne navigue plus du tout.
- **Une seule ligne malformée tuait le serveur MCP** (T-0247), et la session
  perdait tous ses outils sans un message.
- **Trois écritures pouvaient effacer réglages et jetons d'intégration**
  (T-0248). Elles passent par une écriture indivisible, qui refuse en outre un
  lien symbolique.


## [1.1.2-beta] — 2026-08-31

### Sécurité

- **La commande `dev` d'un dépôt pouvait s'exécuter sans que personne l'ait
  accordé.** `ovrsee.config.json` est versionné : sa ligne `dev` est donc écrite
  par l'auteur du dépôt observé, et le crawl la passait à un shell. Un commit
  touchant des sources suffisait à la lancer. Cette commande exige désormais un
  accord explicite, gardé dans `~/.claude/ovrsee/trust.json`, **hors du dépôt
  observé** — un clone hostile ne doit pas livrer sa propre approbation. Ce qui
  est retenu est la chaîne exacte qui part à `shellRun()` : changer `dev`
  redemande l'accord. La garde est aux deux sites d'exécution plutôt qu'aux
  points d'entrée, de sorte qu'on ne peut pas l'oublier en ajoutant un appelant.
  Sans humain (hook `post-commit`, `stdin` non TTY), elle refuse au lieu de
  demander, et l'onglet Produit affiche le scan en échec.
- **Le dépôt observé pouvait surcharger `bootstrap`.** Ce tableau est proposé à
  l'envoi vers le terminal Claude, et une entrée commençant par `!` ou `/`
  s'exécute immédiatement. Un dépôt cloné n'a plus voix au chapitre :
  `bootstrap` est une préférence de poste, pas une propriété du dépôt observé.
- **`pages.json` laissait fuiter ce que l'application observée affichait à
  l'écran.** La rédaction ne couvrait que `scans.jsonl`, alors que le crawl écrit
  aussi `pages.json` — versionné lui aussi — dont le champ `excerpt` porte 400
  caractères d'`innerText` de l'application observée, et `title` le titre de son
  DOM. Une page d'administration qui affiche un jeton, une page de debug qui
  imprime sa configuration, une erreur applicative rendue à l'écran : le texte
  partait dans git sans filtre.
- **La rédaction coupait plus que le secret.** Un nom sensible suivi de `=` ou
  `:` emportait toute la fin de ligne, faux positifs compris — l'hôte et le code
  retour qui la partageaient disparaissaient avec elle. Un nom d'en-tête
  d'authentification emporte toujours la ligne entière ; une affectation
  ordinaire s'arrête désormais à l'espace suivant.
- Un audit de cybersécurité complet a durci la frontière du webview, le
  traitement des secrets et la chaîne d'approvisionnement. `readBody` ne
  résolvait jamais après `req.destroy()` sur un corps trop gros, et
  `/api/config-claude` rendait des commandes de hook susceptibles de porter un
  jeton en dur.

### Modifié

- **Le terminal ne se charge plus au démarrage.** xterm pèse le tiers du bundle
  et passe derrière `lazy()` ; `graph.json` (687 ko, lus de façon synchrone à
  chaque changement de projet pour un onglet souvent fermé) sort du snapshot au
  profit d'une route servie au montage de l'onglet Données. Le bundle principal
  passe de 972 ko à 616 ko, de 252 ko à 164 ko une fois gzippé. La rétention des
  captures a été allégée au passage.
- Une passe de dégraissage sur tout le dépôt a retiré du câblage promettant des
  réglages que personne ne pose, des exports annonçant une surface publique
  inexistante, et du code recopiant à la main ce que la machine sait dériver.
  Aucun changement de comportement visible.
- Montées de version : oxlint, Electron, Vite et le groupe react.

### Corrigé

- Le raccourci de commande écrivait dans la session `claude` quel que soit
  l'onglet regardé, et basculait dessus. Avec plusieurs terminaux ouverts, un
  clic depuis le second écrivait dans le premier.
- Le rail replié de la barre latérale divergeait de l'ouvert sur trois points :
  la recherche manquait entièrement, un logo apparaissait qui n'existe nulle part
  en mode ouvert, et l'ensemble était décalé d'un pixel.
- Le compteur du sélecteur de projets totalisait le backlog, les tickets à
  spécifier et les tickets prêts — gonflant un chiffre qui prétend dire ce qui
  reste à faire. Il ne compte plus que les tickets prêts.
- Les états de session ne se mettaient pas toujours à jour, et le sélecteur
  décalait la mise en page en s'ouvrant.

## [1.1.1-beta] — 2026-08-20

### Sécurité

- **Une page servie par localhost pouvait écrire dans l'API.** L'en-tête
  `X-Ovrsee` comptait sur le préflight CORS pour écarter les pages tierces, mais
  la politique par défaut de Vite autorise *toute* origine `localhost`, quel que
  soit le port — y compris les pages du projet observé, celles qu'affiche
  l'onglet Navigateur et que visite le crawl. De là, un
  `POST /api/projects {action:'init'}` suffisait à écrire la commande `dev` que
  le crawl suivant exécute. Toutes les routes `/api/` vérifient désormais
  l'origine, lectures comprises : `/api/config-claude` rendait les commandes des
  hooks de `~/.claude/` sans exiger le moindre en-tête. Une requête sans
  `Origin` est acceptée — c'est le cas de tout appelant qui n'est pas un
  navigateur, le protocole `ovrsee://` d'Electron le premier.
- **`redige()` ne masquait que le premier mot d'un en-tête `Authorization`.** Un
  Digest multi-champs livrait `response`, le hash dérivé du mot de passe, et tout
  schéma hors des trois connus — AWS4-HMAC-SHA256, Negotiate — sortait sa
  signature à côté d'un `***` qui donnait le change. Une valeur non quotée est
  maintenant consommée jusqu'à la fin de ligne (#36).
- **Les scalaires rangés dans un tableau échappaient au masquage des secrets.**
  Un jeton posé dans une liste de `settings.json` sortait entier par
  `/api/config-claude`, alors que le même jeton posé directement sur la clé était
  masqué.
- Le corps des requêtes du dev server est plafonné à 1 Mo. Un POST local sans fin
  faisait grossir sa mémoire jusqu'à le tuer.

### Corrigé

- `crawl/auth.js` avait divergé de `crawl/index.js` : il lançait la commande `dev`
  sans le shell de connexion — donc sans le PATH de pnpm hors d'un terminal — et
  jetait ce que disait la commande avant d'échouer.

## [1.1.0-beta] — 2026-08-20

### Ajouté

- **Crawler depuis l'application.** Le bouton `Crawler` lance désormais le crawl
  lui-même, par IPC Electron, avec progression et arrêt — sans cloner le dépôt
  ni passer par `pnpm ovrsee:crawl`. `crawl/`, `mcp/` et `playwright-core`
  voyagent dans le paquet (#24).
- **Un formulaire de configuration pour un projet déjà équipé**, qui n'avait
  plus aucun chemin vers `ovrsee.config.json` une fois `ovrsee/` créé (#24).
- **Les commits qu'aucun hook n'a vus sont rattrapés.** Un squash-merge fait sur
  GitHub crée son commit sur leurs serveurs : pas de `post-commit`, pas de plan
  rattaché. `hooks/reconcile.js`, branché sur le hook git `post-merge`,
  rattache au `git pull` d'après les tickets cités par le message — plusieurs
  plans pour un commit, intervalles compris. `pnpm ovrsee:reconcile` comble le
  retard d'un dépôt équipé avant lui (#27).
- ⌘W ferme l'onglet du terminal qui a le focus au lieu de la fenêtre ; ⌘D ouvre
  un terminal de plus (article également dans le menu Affichage).
- **Les onglets terminal se nomment seuls.** Un onglet prend les premiers mots de
  la demande qu'on y envoie. Un nom saisi à la main (double-clic) n'est jamais
  écrasé.
- **Un état vivant sur chaque onglet terminal.** Trois points qui battent pendant
  que Claude travaille, une coche verte quand il rend la main, un point
  d'interrogation quand il attend une réponse — les points restent immobiles sous
  `prefers-reduced-motion`.
- **Le panneau de ticket se redimensionne**, et un bouton l'ouvre en modale pour
  une longue lecture.
- **État de session sur les onglets terminal.** La pastille d'un onglet passe au
  vert quand Claude rend la main, à l'accent quand il attend une réponse : on
  suit plusieurs sessions sans changer d'onglet (#18).
- **Renommer un terminal.** Double-clic sur le libellé d'un onglet (#20).

### Modifié

- **Les epics sortent du Kanban.** Un epic n'a plus de colonne : l'onglet
  Tableau porte une bascule `Kanban` / `Epics`, et l'état d'un epic se déduit de
  ses enfants — `sans enfant`, `non commencée`, `en cours`, `terminée`. Un epic
  ne peut donc jamais être terminé tant qu'un enfant reste ouvert. Les tickets
  enfants sont désormais des cartes de plein droit dans leur colonne (#19, #21).
- Un crawl qui échoue dit ce qu'a dit la commande `dev` du projet observé. Elle
  tournait sous `stdio: 'ignore'` : un `pnpm: command not found` disparaissait
  et il ne restait que « l'application n'a pas répondu en 60000 ms » (#24).
- Arrêter un crawl tue le groupe de processus, pas le seul fils : le crawl a
  démarré le serveur de dev du projet observé, et un `child.kill()` le
  laisserait tourner sur son port (#24).

### Corrigé

- **Un secret ne part plus dans `scans.jsonl`.** Le crawl retenait 2 ko de la
  sortie de la commande `dev` et les écrivait dans un fichier versionné ; une
  commande qui meurt sur une variable d'environnement manquante en imprime
  parfois la valeur. `redige()` masque les formes connues — `*KEY=`, `*TOKEN=`,
  `sk-…`, `ghp_…`, JWT, mot de passe d'URL, identifiants de clé AWS (`AKIA…`,
  `ASIA…`), clés Stripe à underscore (`sk_live_`, `pk_test_`) et objets de
  configuration sérialisés en JSON — depuis `recordScan()`, seul point
  d'écriture. Le nom de la variable et l'hôte restent lisibles : c'est ce qui
  sert au diagnostic (#26, #31).
- Un en-tête `Authorization` ne laisse plus filer son credential. La valeur non
  guillemetée s'arrêtait au premier mot : `Authorization: Bearer <jeton>`
  s'écrivait `Authorization: *** <jeton>`, un `***` qui donnait le change
  pendant que le jeton partait en clair. Le mot-clé de schéma fait désormais
  partie de la valeur (#34).
- `terminal.rename_aria` écrivait `{label}` là où `t()` ne substitue que `${…}` :
  un utilisateur de lecteur d'écran entendait « Renommer la session {label} » et
  ne savait pas quel terminal il renommait. Le test ajouté est un invariant sur
  les deux dictionnaires entiers, donc toute traduction future qui écrit
  `{param}` casse la CI (#23).
- `reconcile()` nomme désormais sur stderr, au moment du `pull`, les tickets
  qu'il solde d'après un message de commit écrit ailleurs (#29).
- L'en-tête du panneau de ticket ne se lit plus comme une bande plus sombre et
  plus étroite : il prend le fond de son conteneur et le traverse d'un bord à
  l'autre.
- Le tag d'état d'un epic porte le style entier de son état — fond, texte et
  bordure — au lieu d'un libellé vert dans une bordure violette.
- Le `?` d'un onglet terminal ne paraît plus que sur une vraie question : une
  session laissée de côté ne change plus sa coche verte en point d'interrogation.
- `/clear` rend à l'onglet son nom d'origine, sauf s'il a été renommé à la main.
- Retrait du point parasite à gauche des onglets terminal, qui se lisait comme un
  onglet vide.
- Le bouton de détachement d'un epic quitte la carte pour le bas du panneau de
  ticket, et dit désormais de quel epic il détache.

## [1.0.0-beta] — 2026-08-13

Première version publiée. Les binaires ne sont ni signés ni notariés : macOS et
Windows en avertissent au premier lancement.

### Ajouté

- **Sept onglets** : Aperçu, Navigateur, Produit, Historique, Tableau, Données,
  Stack.
- **Capture des plans** approuvés dans Claude Code, versionnés en markdown dans
  `<repo>/ovrsee/plans/`.
- **Crawl Playwright** du projet observé : chaque écran photographié, daté et
  rattaché au commit qui l'a produit.
- **Tableau de tickets** en kanban — un fichier markdown par ticket, colonnes
  réglées dans `ovrsee/board.json`, epics et limites de WIP.
- **Hook post-commit** rattachant chaque commit au plan actif.
- **Terminal intégré** (pty réel), par IPC Electron et jamais par une socket
  locale.
- **Serveur MCP** stdio en JSON-RPC 2.0 : Claude lit tout `ovrsee/`, n'écrit que
  les tickets et `board.json`, n'exécute aucun code.
- **Deux skills** livrées, `ovrsee` et `ovrsee-tickets`, installables depuis
  l'écran d'initialisation.
- **Export Obsidian** avec wikilinks entre plans et tickets, et frontmatter
  requêtable en Dataview.
- **Onglet Aperçu** : santé du dépôt, branches, déploiements Vercel/Netlify et
  état Supabase. Les jetons vivent hors du dépôt, chiffrés par `safeStorage`.
- **Interface bilingue** français et anglais.
- **Builds** macOS arm64 (DMG) et Windows x64 (NSIS), publiés à chaque tag.

### Connu

- Pas de build macOS Intel ni Windows ARM.
- Aucune mise à jour automatique : les versions se téléchargent à la main.
- Le format de `ovrsee/` peut encore bouger d'ici la 1.0. Tout y étant en
  markdown et en images, une migration se lira à l'œil nu.

[Non publié]: https://github.com/samuelboulery/ovrsee/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/samuelboulery/ovrsee/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/samuelboulery/ovrsee/compare/v1.1.2-beta...v1.2.0
[1.1.2-beta]: https://github.com/samuelboulery/ovrsee/compare/v1.1.1-beta...v1.1.2-beta
[1.1.1-beta]: https://github.com/samuelboulery/ovrsee/compare/v1.1.0-beta...v1.1.1-beta
[1.1.0-beta]: https://github.com/samuelboulery/ovrsee/compare/v1.0.0-beta...v1.1.0-beta
[1.0.0-beta]: https://github.com/samuelboulery/ovrsee/releases/tag/v1.0.0-beta
