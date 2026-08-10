# Cockpit

Vue en lecture seule sur un projet vibecodé : plans capturés, pages crawlées,
historique daté, tickets. Application Electron + interface Vite/React.

Le cadrage — problème, alternatives écartées, périmètre — est dans
[`cadrage-cockpit.md`](./cadrage-cockpit.md). Le mode d'emploi est dans
[`README.md`](./README.md). Ce fichier ne dit que ce qui n'est pas déductible du code.

## L'invariant

**Le cockpit lit ; il n'exécute que le terminal qu'on lui demande.**

La vérité vit dans `<repo>/cockpit/`, en markdown et en images, versionnée par git.
L'application n'est qu'une vue : si elle disparaît, rien n'est perdu.

C'est la règle qui doit faire refuser une fonctionnalité. Toute proposition qui fait
écrire l'application ailleurs que dans `cockpit/tickets/` et `cockpit/board.json`, ou
qui lui fait exécuter du code du projet observé, contredit le cadrage — le dire avant
de l'implémenter.

Corollaire déjà arbitré : le terminal passe par IPC Electron et **pas** par une socket
locale. Une socket l'ouvrirait à tout processus tournant sous le même compte.

## Les couches

| Dossier | Rôle | Typé ? |
|---|---|---|
| `hooks/` | Capture des plans, clôture au commit, tickets, brief, export Obsidian, skills, CLI | non — `.js` + JSDoc |
| `crawl/` | Parcours Playwright de l'app observée, captures datées | non — `.js` |
| `server/api.js` | Routes `/api/*` pour navigateur et Electron | non — `.js` |
| `mcp/` | Serveur MCP stdio (JSON-RPC 2.0), même interface que `/api/*` | non — `.js` |
| `app/src/` | Interface React, 7 onglets | oui — TS strict |
| `electron/` | Processus principal, preload, pty | non — `.js`/`.cjs` |

**`server/api.js` a trois hôtes, une seule implémentation** : le middleware du dev
server Vite (`vite.config.js`), le gestionnaire du protocole `cockpit://` du
processus principal (`electron/main.js`), et le serveur MCP (`mcp/dispatch.js`). 
Les trois appellent la même fonction pure `resolve()`. Dédoubler cette logique est 
la faute à ne pas commettre — trois implémentations divergeraient, et les bugs ne 
se verraient que dans certains modes.

Conséquence pratique : **une route testée dans le navigateur n'est pas une route
testée dans Electron.** Le protocole custom n'a ni CORS, ni `Origin`, ni les mêmes
en-têtes. Vérifier les deux.

## Commandes

```bash
pnpm dev          # dev server Vite, port 5180 strict, sans terminal
pnpm electron     # build:ui puis l'app complète, terminal compris
pnpm test         # node --test sur hooks/ crawl/ server/ mcp/, puis app/src compilé
pnpm typecheck    # tsc, ne couvre QUE app/src
pnpm build:ui     # vite build vers app/dist/
pnpm package      # DMG dans release/ (arm64, non signé)
pnpm cockpit:mcp  # serveur MCP stdio (JSON-RPC 2.0) pour Claude Code et Claude Desktop
```

`pnpm test` n'utilise **aucun framework** : `node:test` et `node:assert` seuls.
Ne pas introduire vitest / jest pour ajouter un test — écrire dans le style existant.
`app/src` n'y échappe pas : `scripts/test-ui.js` le compile dans un dossier jetable
(`app/.test-build`, marqué CommonJS) et lance le même `node --test` dessus.

Ce que la CI n'attrape pas, parce qu'il n'y en a pas et parce que `tsconfig.json`
n'inclut que `app/src` : `hooks/`, `crawl/`, `server/` et `electron/` ne sont pas
typés. Et les tests d'`app/src` ne sont que de deux sortes — les fonctions pures de
`data.ts`, et un rendu des onglets sur des instantanés dégradés qui vérifie
seulement qu'aucun ne lève. Rien ne couvre une interaction, un état ou une mise en
page : pour ça, il faut lancer l'app.

## Zones à ne pas toucher

- **`cockpit/`** est produit par les hooks. Seuls `cockpit/tickets/*.md` et
  `cockpit/board.json` se saisissent — via le skill `cockpit-tickets`. Les plans, les
  pages, les scans et les captures s'écrivent tout seuls ; les corriger à la main
  produit un état que le prochain commit écrasera.
- **`support.js`** (69 ko) et **`Cockpit-A-Nocturne.dc.html`** sont du code tiers
  embarqué pour la maquette. Hors périmètre : ne pas relire, ne pas corriger, ne pas
  compter dans les métriques du projet.
- **`_ds/`** est une bibliothèque de design systems. Seul `nocturne-*` est chargé.
- **`graphify-out/graph.json`** est versionné volontairement (l'onglet Données le lit,
  et lui seul — Stack lit `package.json` et les `WHY:`) ; `graphify-out/cache/` et
  `graph.html` sont ignorés.

## Pièges connus

- **Un plan actif capte tous les commits.** Tant que `cockpit/.active-plan` existe, le
  hook post-commit rattache chaque commit au plan — y compris un correctif sans
  rapport. `pnpm cockpit:close` avant de changer de sujet.
- **Le crawl refuse de démarrer si `baseUrl` répond déjà.** C'est voulu : rien dans une
  réponse HTTP ne distingue son propre serveur de celui d'un autre projet.
- **`node-pty` est un binaire natif.** Il est déballé de l'asar (`asarUnpack` dans
  `electron-builder.yml`) et `spawn-helper` doit garder son bit d'exécution — d'où
  `scripts/fix-pty-permissions.js` en postinstall. C'est le point de rupture classique
  de l'empaquetage, et il ne se voit qu'à l'exécution du DMG, jamais en dev.
- **Le stdout du serveur MCP est le transport, pas un journal.** Un `console.log`
  ajouté dans n'importe quel module de `hooks/` ou `server/` se retrouve au milieu
  d'un flux JSON-RPC et coupe la conversation. Les traces vont sur stderr. Et
  tester `dispatch()` ne teste pas le fil : `mcp/mcp.test.js` fait les deux depuis
  qu'un protocole non conforme est passé sous une suite verte.
- **Un secret collé dans un plan approuvé part dans git en clair.** La parade est en
  amont : ne pas en coller.

## Conventions

- Langue : français pour les commentaires, la documentation et les messages
  d'interface ; anglais pour les identifiants et le code.
- Commits : Conventional Commits en français (`feat:`, `fix:`, `docs:`, `chore:`).
- `pnpm` exclusivement. Demander avant d'ajouter une dépendance — le projet en a trois
  en production (`@xterm/xterm`, `@xterm/addon-fit`, `node-pty`) et cette sobriété est
  un choix.
- Les styles sont en CSS-in-JS via l'utilitaire `s()` de `app/src/style.ts`, sur les
  jetons du design system Nocturne. Pas de fichier `.css` dans `app/src`.
