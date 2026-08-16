<p align="center">
  <a href="./CHANGELOG.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-3a3d4d?style=for-the-badge"></a>
  <a href="./CHANGELOG.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-4c3f91?style=for-the-badge"></a>
</p>

# Changelog

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le
versionnage [SemVer](https://semver.org/lang/fr/).

## [Non publié]

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
