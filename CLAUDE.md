# Ovrsee

Vue en lecture seule sur un projet vibecodé : plans capturés, pages crawlées,
historique daté, tickets. Application Electron + interface Vite/React.

Le cadrage — problème, alternatives écartées, périmètre — est dans
[`cadrage-ovrsee.md`](./cadrage-ovrsee.md). Le mode d'emploi est dans
[`README.md`](./README.md). Ce fichier ne dit que ce qui n'est pas déductible du code.

## L'invariant

**L'ovrsee lit ; il n'exécute que le terminal qu'on lui demande.**

La vérité vit dans `<repo>/ovrsee/`, en markdown et en images, versionnée par git.
L'application n'est qu'une vue : si elle disparaît, rien n'est perdu.

C'est la règle qui doit faire refuser une fonctionnalité. Toute proposition qui fait
écrire l'application ailleurs que dans `ovrsee/tickets/` et `ovrsee/board.json`, ou
qui lui fait exécuter du code du projet observé, contredit le cadrage — le dire avant
de l'implémenter.

Corollaire déjà arbitré : le terminal passe par IPC Electron et **pas** par une socket
locale. Une socket l'ouvrirait à tout processus tournant sous le même compte.

Même corollaire pour les secrets d'intégration (Vercel/Netlify/Supabase, onglet
Aperçu) : ils vivent dans `~/.claude/ovrsee/integrations.json`, **hors du dépôt
observé** — ni `ovrsee/tickets/`, ni `ovrsee/board.json`, ni aucun autre fichier
versionné n'en contiennent jamais un octet. Leur écriture, leur déchiffrement
(`safeStorage`) et l'appel réseau au fournisseur passent par IPC Electron, jamais
par `/api/*` : cette route est aussi servie par le dev server Vite, en HTTP local
non-authentifié, et un secret n'y transite jamais. Voir `electron/main.js` et
`electron/preload.cjs`.

## Les couches

| Dossier | Rôle |
|---|---|
| `hooks/` | Capture des plans, clôture au commit, tickets, brief, export Obsidian, skills, CLI |
| `crawl/` | Parcours Playwright de l'app observée, captures datées |
| `server/api.js` | Routes `/api/*` pour navigateur et Electron |
| `mcp/` | Serveur MCP stdio (JSON-RPC 2.0), même interface que `/api/*` |
| `app/src/` | Interface React, 7 onglets — **le seul dossier typé** (TS strict) |
| `electron/` | Processus principal, preload, pty |
| `site/` | Vitrine publique (ovrsee.app), page unique écrite à la main, en anglais |

**`server/api.js` a trois hôtes, une seule implémentation** : le middleware du dev
server Vite (`vite.config.js`), le protocole `ovrsee://` d'Electron
(`electron/main.js`) et le serveur MCP (`mcp/dispatch.js`) appellent tous la même
fonction pure `resolve()`. Dédoubler cette logique est la faute à ne pas commettre.

Conséquence pratique : **une route testée dans le navigateur n'est pas une route
testée dans Electron.** Le protocole custom n'a ni CORS, ni `Origin`, ni les mêmes
en-têtes. Vérifier les deux.

## Tests

`pnpm test` n'utilise **aucun framework** : `node:test` et `node:assert` seuls.
Ne pas introduire vitest / jest pour ajouter un test — écrire dans le style existant.
`app/src` n'y échappe pas : `scripts/test-ui.js` le compile dans un dossier jetable
(`app/.test-build`, marqué CommonJS) et lance le même `node --test` dessus.

`ci.yml` tourne sur chaque PR et chaque push vers `main` : `lint`, `typecheck` et
`build:ui` sur ubuntu, puis `pnpm test` sur **macOS et Windows** — cinq tests de
portabilité cassaient sous Windows depuis des semaines avant qu'elle existe. Pas de
`paths-ignore`, délibérément : une PR qui ne déclenche aucun run ne remonte jamais les
contextes exigés par le ruleset de `main` et devient infusionnable. Les noms de jobs
sont ceux que ce ruleset cite — les renommer casse la règle en silence.

Ce qu'elle n'attrape pas : `hooks/`, `crawl/`, `server/` et `electron/` ne sont pas
typés (`tsconfig.json` n'inclut qu'`app/src`), et les tests d'`app/src` ne sont que de
deux sortes — les fonctions pures de `data.ts`, et un rendu des onglets sur instantanés
dégradés qui vérifie seulement qu'aucun ne lève. Rien ne couvre une interaction, un état
ou une mise en page : pour ça, il faut lancer l'app.

Les commandes sont dans `package.json`. Une seule ne s'en déduit pas : `pnpm dev` sert
l'app **sans terminal**, seul `pnpm electron` le donne.

## Zones à ne pas toucher

- **`ovrsee/`** est produit par les hooks. Seuls `ovrsee/tickets/*.md` et
  `ovrsee/board.json` se saisissent — via le skill `ovrsee-tickets`. Corriger un plan,
  une page ou un scan à la main produit un état que le prochain commit écrasera.
- **`legacy/Ovrsee-A-Nocturne.dc.html`** est la maquette : code tiers embarqué, hors
  périmètre — ne pas relire, ne pas corriger, ne pas compter dans les métriques. Elle
  reste la référence des valeurs portées littéralement, celles qu'autorise la liste
  `FICHIERS_PORTES` de `hooks/couleurs.test.js`.
- **`_ds/`** tient deux design systems et le nom trompe : l'application charge
  **`_ds/ovrsee/styles.css`** (`app/src/main.tsx`), pas `nocturne-*`, qui ne sert plus
  qu'à la maquette.
- **`graphify-out/graph.json`** est versionné volontairement (l'onglet Données le lit,
  et lui seul) ; `graphify-out/cache/` et `graph.html` sont ignorés.

## Pièges connus

- **Un plan actif capte tous les commits**, y compris un correctif sans rapport, tant
  que `ovrsee/.active-plan` existe. `pnpm ovrsee:close` avant de changer de sujet.
- **Un plan actif éclipse un ticket actif, jamais l'inverse.** Capturer un plan efface
  `.active-ticket`, et tant qu'un plan est actif le gate l'ignore. Un ticket ad hoc
  resté ouvert ne redevient pas actif tout seul — le rouvrir (`moveTicket` vers
  `en-cours`) ou en créer un nouveau.
- **Le registre est la seule source de projets.** `projects()` n'ajoute pas le dépôt
  courant sous prétexte qu'il porte un `ovrsee/` — sans quoi un clone frais s'ouvrait
  sur lui-même et l'écran de premier lancement ne paraissait jamais. Il faut donc
  inscrire le dépôt ovrsee une fois, comme n'importe quel autre. Cette liste sert aussi
  de liste blanche aux routes : rien d'implicite dedans.
- **Le crawl refuse de démarrer si `baseUrl` répond déjà.** Voulu : rien dans une
  réponse HTTP ne distingue son propre serveur de celui d'un autre projet.
- **Le stdout du serveur MCP est le transport, pas un journal.** Un `console.log` dans
  n'importe quel module de `hooks/` ou `server/` atterrit au milieu d'un flux JSON-RPC
  et coupe la conversation — les traces vont sur stderr. Et tester `dispatch()` ne teste
  pas le fil : `mcp/mcp.test.js` fait les deux depuis qu'un protocole non conforme est
  passé sous une suite verte.
- **Les réponses du MCP sont projetées.** `getPlans`, `listTickets` et `getGraph`
  omettent le corps ou rendent un résumé ; `full: true` donne l'entier. Le graphe
  complet pèse ~177 000 jetons — le défaut n'est pas une commodité, c'est une garde.
- **`node-pty` est un binaire natif.** Déballé de l'asar (`asarUnpack` dans
  `electron-builder.yml`), et `spawn-helper` doit garder son bit d'exécution — d'où
  `scripts/fix-pty-permissions.js` en postinstall. Point de rupture classique de
  l'empaquetage, invisible en dev : il ne se voit qu'à l'exécution du DMG.
- **`pnpm package:win` ne se lance pas depuis ce Mac.** `node-pty` se compile à
  l'installation (node-gyp) pour la plateforme courante, et il n'y a pas de
  cross-compile mac→windows fiable. Il faut `pnpm install` puis `pnpm package:win`
  sur une vraie machine Windows, ou un runner CI Windows.
- **Sortir une version se fait par tag, pas en local.** Bump `version`, commit,
  `git tag vX.Y.Z && git push --tags` : `release.yml` construit DMG et NSIS sur des
  runners natifs et publie sur Releases (dépôt privé — les destinataires doivent être
  collaborateurs pour le voir). `pnpm package:*` en local ne publie rien.
- **Le signal de session et la barre de menu sont inertes tant que
  `pnpm ovrsee:install` n'a pas tourné.** `ovrsee-notify.js` s'enregistre dans
  `~/.claude/settings.json`, pas dans le dépôt : une machine équipée avant son arrivée
  n'a rien dans `Stop` ni `Notification`, et rien dans le code ne le laisse voir. Le
  vérifier avant de chercher un bug ailleurs.
- **`site/fr/` est engendré, pas écrit.** `build-site-fr.js` dérive la page française de
  `site/index.html` — **en anglais**, la langue source — et de `site/dict.json` au
  déploiement ; le dossier est gitignoré. Le texte français se corrige donc dans
  `dict.json`, jamais dans la page. Et les chemins d'assets d'`index.html` sont absolus
  (`/app.js`, `/styles.css`) pour que `/fr/` les résolve : les repasser en relatifs
  casse la version française, en silence.
- **La langue vient de `document.documentElement.lang`.** `traduire()` (`site/app.js`)
  applique la table inverse dès que la langue n'est pas `fr` : une valeur en dur
  retraduirait une page déjà française intégralement en anglais au premier rendu.
- **Un secret collé dans un plan approuvé part dans git en clair.** La parade est en
  amont : ne pas en coller.

## Conventions

- **L'anglais est la langue publique, le français la langue de travail.** En anglais :
  la vitrine (`site/index.html` est la source, le français en dérive), les documents
  d'accueil (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  `CHANGELOG.md` — chacun a son pendant `*.fr.md`), et le repli de `t()`. En français :
  les commentaires, `CLAUDE.md`, `cadrage-ovrsee.md`, les plans et tickets d'`ovrsee/`,
  les messages de commit. Anglais pour le code et les identifiants.
- **Quatre dépendances en production** (`@phosphor-icons/react`, `@xterm/xterm`,
  `@xterm/addon-fit`, `node-pty`). Cette sobriété est un choix — demander avant d'en
  ajouter une.
- Styles en CSS-in-JS via l'utilitaire `s()` d'`app/src/style.ts`, sur les jetons du
  design system Nocturne. Pas de fichier `.css` dans `app/src`.
