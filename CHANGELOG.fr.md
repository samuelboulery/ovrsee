<p align="center">
  <a href="./CHANGELOG.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-3a3d4d?style=for-the-badge"></a>
  <a href="./CHANGELOG.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-4c3f91?style=for-the-badge"></a>
</p>

# Changelog

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le
versionnage [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Corrigé

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

### Ajouté

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

### Modifié

- **Les epics sortent du Kanban.** Un epic n'a plus de colonne : l'onglet
  Tableau porte une bascule `Kanban` / `Epics`, et l'état d'un epic se déduit de
  ses enfants — `sans enfant`, `non commencée`, `en cours`, `terminée`. Un epic
  ne peut donc jamais être terminé tant qu'un enfant reste ouvert. Les tickets
  enfants sont désormais des cartes de plein droit dans leur colonne (#19, #21).

### Ajouté

- **État de session sur les onglets terminal.** La pastille d'un onglet passe au
  vert quand Claude rend la main, à l'accent quand il attend une réponse : on
  suit plusieurs sessions sans changer d'onglet (#18).
- **Renommer un terminal.** Double-clic sur le libellé d'un onglet (#20).

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
