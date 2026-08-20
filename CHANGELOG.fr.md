<p align="center">
  <a href="./CHANGELOG.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-3a3d4d?style=for-the-badge"></a>
  <a href="./CHANGELOG.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-4c3f91?style=for-the-badge"></a>
</p>

# Changelog

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le
versionnage [SemVer](https://semver.org/lang/fr/).

## [Non publié]

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

[Non publié]: https://github.com/samuelboulery/ovrsee/compare/v1.0.0-beta...HEAD
[1.0.0-beta]: https://github.com/samuelboulery/ovrsee/releases/tag/v1.0.0-beta
