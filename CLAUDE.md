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

**Le crawl emprunte la même voie** (`electron/crawl.js`, canaux `crawl:*`), et pour la
même raison — surtout pas `/api/*`, qui est aussi servi par le dev server Vite en HTTP
local non authentifié. La surface exposée ne reçoit qu'un chemin de projet, vérifié
contre le registre : ni nom de programme, ni commande, ni même la ligne `dev` de la
configuration, que le crawler lit lui-même sur le disque.

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
| `crawl/` | Parcours Playwright de l'app observée, captures datées — **embarqué dans le paquet** |
| `server/api.js` | Routes `/api/*` pour navigateur et Electron |
| `mcp/` | Serveur MCP stdio (JSON-RPC 2.0), même interface que `/api/*` — **embarqué dans le paquet** |
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
  et lui seul) ; `graphify-out/cache/` et `graph.html` sont ignorés. Il ne passe **pas**
  par le snapshot : 687 ko lus synchrones à chaque changement de projet pour un onglet
  souvent fermé. La route `/api/graph` le sert au montage de l'onglet, et elle seule.
- **`app/src/pty.ts` ne doit jamais importer xterm**, et `useTerminal.ts` reste le seul
  qui le fasse. Le panneau terminal est en `lazy()` — c'est le tiers du bundle. Trois
  composants du chargement initial ont besoin de `pasteToClaude` : le mettre à côté de
  xterm annulait le découpage en silence, le morceau se recréait sans que rien n'échoue.

## Pièges connus

- **`--color-accent` change par projet, `--color-brand` jamais.** L'accent d'un projet
  (T-0215) est un identifiant posé sur `<html>` par `App.tsx` ; les blocs
  `[data-accent='…']` d'`_ds/ovrsee/styles.css` redéfinissent le jeton et sa rampe, et
  les 75 usages `var(--color-accent)` suivent sans rechargement. Le violet n'a pas de
  valeurs à lui : son bloc rend `--color-brand`, que rien ne surcharge — c'est ce qui
  permet à la pastille « violet » des préférences de rester violette dans une
  application peinte en cyan. Un projet sans accent ne porte pas l'attribut du tout.
  La couleur vit dans le registre (`setProjectAccent`, `hooks/plans.js`), **pas** dans
  `ovrsee.config.json` : c'est une préférence de poste, et ce fichier est versionné.
- **Le `colonne` d'un epic est inerte.** Le champ reste écrit dans le fichier — le
  format n'a pas bougé — mais l'interface ne le lit plus : l'état d'un epic se déduit
  de ses enfants (`epicEtat`, `app/src/data.ts`), et un epic ne se glisse plus. Le
  Kanban ne contient que des tickets ; les epics vivent dans la vue « Epics » de
  l'onglet Tableau (`app/src/tabs/TableauEpics.tsx`). Un epic posé « fait » à la main
  dans son fichier n'apparaîtra donc nulle part comme tel.
- **Le plan actif est propre à une session Claude, pas au dépôt.** L'état vit dans
  `ovrsee/.active/<session>.json` (`hooks/active.js`), gitignoré. Plusieurs sessions
  travaillent donc côte à côte sans se voler leur plan. L'identifiant vient de
  `session_id` dans le payload des hooks, et de `CLAUDE_CODE_SESSION_ID` — exporté dans
  l'environnement de l'outil Bash, donc hérité par le hook git `post-commit`. Un
  appelant sans identifiant (CLI, dev server) retombe sur un seau partagé.
- **Un plan actif capte tous les commits de sa session**, y compris un correctif sans
  rapport, tant qu'il est actif. `pnpm ovrsee:close` avant de changer de sujet ; la fin
  de session (`SessionEnd`) rend le pointeur mais ne clôt pas le plan.
- **Un squash-merge fait sur GitHub n'exécute aucun hook.** Le commit naît sur leurs
  serveurs : `post-commit` ne le voit jamais, et le plan reste ouvert avec zéro commit —
  donc inclosable, `closeOpenPlans` datant la clôture d'après le dernier commit. C'est
  arrivé à cinq plans d'un coup (PR #22). Le rattrapage est dans `hooks/reconcile.js`,
  branché sur le hook git **`post-merge`** : au `pull`, il rattache d'après les tickets
  cités, et lui seul sait rendre **plusieurs** plans pour un commit — un squash en écrase
  souvent cinq. Il ne devine rien : sans ticket cité, rien n'est rattaché, car au moment
  du pull la session courante n'a aucun rapport avec le travail qui arrive. Un dépôt
  équipé avant lui rattrape son retard avec `pnpm ovrsee:reconcile`.
- **Le rattrapage solde des tickets d'après un message écrit ailleurs.** Le `%B` d'un
  commit venu d'un remote fait foi : `reconcile()` cite le ticket, `avancerTicketsDuPlan`
  le pousse en colonne finale, à chaque `git pull`, sans confirmation. La portée est
  étroite — seuls bougent les tickets **déjà en vol** et liés à un plan **ouvert ici** ;
  rien du backlog, rien d'inexistant. Mais une citation erronée (copier-coller, squash
  d'une PR dont on n'a pas relu chaque ligne) solde un vrai ticket. D'où la trace : le
  hook nomme sur stderr les tickets soldés, au moment du `pull`. Corriger se fait d'un
  `moveTicket` en arrière — l'avancée manuelle est toujours plus vraie que la règle
  automatique.
- **Un commit dont on ne connaît pas la session ne se rattache pas toujours.**
  L'attribution suit quatre étages (`planPourCommit`, `ovrsee-post-commit.js`) : ticket
  `T-XXXX` cité dans le message, puis la session, puis l'unique plan actif s'il n'y en a
  qu'un, puis rien. Un commit fait hors de Claude Code, sans ticket cité, alors que deux
  plans sont actifs, n'est donc rattaché nulle part — et le dit sur stderr.
- **Un plan actif éclipse le ticket actif de sa session, jamais l'inverse.** Capturer un
  plan efface le ticket ad hoc de cette session, et tant qu'un plan est actif le gate
  l'ignore. Un ticket ad hoc resté ouvert ne redevient pas actif tout seul — le rouvrir
  (`moveTicket` vers `en-cours`) ou en créer un nouveau.
- **La capture peut se tromper de plan.** `tool_input.plan` a disparu du payload
  d'`ExitPlanMode` : `planFrom` lit le transcript de la session pour retrouver son
  fichier de plan, et ne retombe sur « le fichier le plus récent de `~/.claude/plans/` »
  qu'en dernier recours — un repli qui ignore la session *et* le projet, et qui a déjà
  capturé le plan d'un autre dépôt. Il avertit sur stderr quand il en arrive là.
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
- **La commande `dev` du projet passe par un shell `-lic`, pas par `sh -c`.**
  Une application lancée depuis le Finder hérite d'un PATH minimal, sans `pnpm`.
  Et `-l` seul ne suffit pas : zsh ne source `.zshrc` — où vivent les PATH de pnpm,
  nvm, mise — que pour un shell **interactif**. Le terminal intégré échappait au
  piège sans le savoir, un pty étant interactif par nature ; le crawl, non. La règle
  vit dans `hooks/shell.js`, partagée par les deux. **Windows garde le shell par
  défaut** : il n'a ni zsh ni ce problème — une application graphique y hérite du PATH
  du registre — et `spawn('/bin/zsh')` y levait un `ENOENT` que la CI seule voyait.
- **Un crawl qui échoue doit dire ce qu'a dit la commande `dev`.** Elle tournait sous
  `stdio: 'ignore'` : un `pnpm: command not found` disparaissait, et il ne restait
  que « l'application n'a pas répondu en 60000 ms » — qui envoie chercher le problème
  dans le projet observé. Sa sortie est retenue (2 ko) et jointe à l'erreur écrite
  dans `scans.jsonl`, que l'onglet Produit affiche désormais.
- **Cette trace est rédigée à l'écriture, et ce n'est pas une garantie.** `scans.jsonl`
  est versionné : une commande `dev` qui meurt sur une variable d'environnement manquante
  l'imprime parfois avec sa valeur, et le secret partirait dans git sans qu'un humain ait
  relu la ligne. `redige()` (`hooks/redaction.js`) masque les formes connues — `*KEY=`,
  `*TOKEN=`, `sk-…`, `ghp_…`, JWT, mot de passe d'URL — depuis `recordScan()`, seul point
  d'écriture. Un nom d'en-tête d'authentification (`*AUTH*`, `*CREDENTIAL*`) emporte toute
  la fin de ligne ; une affectation ordinaire s'arrête à l'espace suivant, sans quoi
  l'hôte et le code retour qui la partagent disparaissaient avec elle. Les formes inconnues
  passent : relire un `scans.jsonl` en échec avant de le pousser reste le dernier filet.
  Le même filtre garde `/api/config-claude` : sa liste blanche décide par le nom de la clé,
  et une `command` de hook peut porter un jeton en dur.
- **Annuler un crawl tue le groupe de processus, pas le seul fils.** Le crawl démarre
  lui-même le serveur de dev du projet observé (`dev` de `ovrsee.config.json`) ; un
  `child.kill()` le laisserait tourner, le port resterait pris, et le crawl suivant
  refuserait de démarrer. D'où `detached: true` au `spawn` et `process.kill(-pid)` —
  le signe moins n'est pas une coquille.
- **Le crawl embarqué exige Google Chrome installé.** `playwright-core` voyage dans le
  paquet, aucun navigateur ne l'accompagne : `channel: 'chrome'` pilote celui du système.
  Une machine sans Chrome ne prévient pas — elle consigne un scan échoué.
- **`node-pty` est un binaire natif.** Déballé de l'asar (`asarUnpack` dans
  `electron-builder.yml`), et `spawn-helper` doit garder son bit d'exécution — d'où
  `scripts/fix-pty-permissions.js` en postinstall. Point de rupture classique de
  l'empaquetage, invisible en dev : il ne se voit qu'à l'exécution du DMG.
- **En pnpm 11, `.npmrc` ne porte plus que l'authentification et le registre.**
  Tout autre réglage y est lu comme s'il n'existait pas — sans avertissement. Le
  dépôt a perdu ainsi sa quarantaine anti-ChainDrop : `minimum-release-age=1440`
  vivait dans `.npmrc`, et la bascule de `packageManager` en `pnpm@11` l'a rendue
  muette. Les réglages vivent donc dans `pnpm-workspace.yaml`, en camelCase
  (`minimumReleaseAge`, `allowBuilds`). Même piège que `onlyBuiltDependencies`,
  encore lu en pnpm 11 mais n'autorisant plus rien. La vérification tient en une
  commande, et elle vaut d'être faite après toute montée de version :
  `pnpm config list` doit montrer le réglage attendu.
- **`pnpm package:win` ne se lance pas depuis ce Mac.** `node-pty` se compile à
  l'installation (node-gyp) pour la plateforme courante, et il n'y a pas de
  cross-compile mac→windows fiable. Il faut `pnpm install` puis `pnpm package:win`
  sur une vraie machine Windows, ou un runner CI Windows.
- **Sortir une version se fait par tag, pas en local.** Bump `version`, commit,
  `git tag vX.Y.Z && git push --tags` : `release.yml` construit DMG et NSIS sur des
  runners natifs et publie sur Releases (**dépôt public** : le binaire est
  téléchargeable par n'importe qui, sans compte — c'est ce qui donne son poids à
  T-0192, la signature du paquet macOS). `pnpm package:*` en local ne publie rien.
- **Le signal de session et la barre de menu sont inertes tant que
  `pnpm ovrsee:install` n'a pas tourné.** `ovrsee-notify.js` s'enregistre dans
  `~/.claude/settings.json`, pas dans le dépôt : une machine équipée avant son arrivée
  n'a rien dans `Stop`, `Notification`, `UserPromptSubmit` ni `SessionStart`, et rien
  dans le code ne le laisse voir. `signalInstalle` exige les **quatre** — c'est ce qui
  rend la panne visible plutôt que muette. Le vérifier avant de chercher un bug ailleurs.
- **`UserPromptSubmit` et `SessionStart` portent chacun deux hooks de l'ovrsee.**
  `ovrsee-capture-audit.js` et `ovrsee-session-start.js` y étaient déjà, `ovrsee-notify.js`
  s'y ajoute : c'est lui qui émet `busy` (avec la demande dont l'onglet tire son nom) et
  `reset` (sur `/clear`, qui rend son nom d'origine à l'onglet). Les entrées s'ajoutent au
  tableau du fichier de réglages, elles ne s'écrasent pas, et deux hooks du même événement
  peuvent rendre des sorties de formes différentes.
- **`site/fr/` est engendré, pas écrit.** `build-site-fr.js` dérive la page française de
  `site/index.html` — **en anglais**, la langue source — et de `site/dict.json` au
  déploiement ; le dossier est gitignoré. Le texte français se corrige donc dans
  `dict.json`, jamais dans la page. Et les chemins d'assets d'`index.html` sont absolus
  (`/app.js`, `/styles.css`) pour que `/fr/` les résolve : les repasser en relatifs
  casse la version française, en silence.
- **La langue vient de `document.documentElement.lang`.** `traduire()` (`site/app.js`)
  applique la table inverse dès que la langue n'est pas `fr` : une valeur en dur
  retraduirait une page déjà française intégralement en anglais au premier rendu.
- **La commande `dev` d'un dépôt exige un accord, et il vit hors du dépôt.**
  `ovrsee.config.json` est versionné : sa ligne `dev` est donc fournie par le dépôt
  observé, pas par l'utilisateur, et le crawl l'exécute dans un shell. L'accord se
  garde dans `~/.claude/ovrsee/trust.json` (`OVRSEE_TRUST` pour les tests) — jamais
  dans `<projet>/ovrsee/`, qu'un clone hostile livrerait avec sa propre approbation,
  même raison qu'`integrations.json`. Ce qui est retenu est la **chaîne exacte** qui
  part à `shellRun()`, en clair, sans `trim()` ni casse : changer `dev` redemande
  l'accord, et c'est ce qui referme la course entre la question posée dans Electron et
  la relecture faite par le crawler. La garde (`assurerConfiance`, `crawl/confiance.js`)
  est aux **deux** sites d'exécution — `crawl/index.js` et `crawl/auth.js`, qu'aucune
  interface n'appelle — jamais aux points d'entrée : on ne peut pas l'oublier en
  ajoutant un appelant. Sans humain (hook `post-commit`, `stdin` non TTY) elle
  **refuse** au lieu de demander : `scans.jsonl` porte l'échec, l'onglet Produit
  l'affiche, et le prochain clic sur « Crawler » ouvre la modale native qui débloque.
  Rien de tout ça ne passe par `/api/*` — le canal IPC `crawl:approve` relit toujours
  le disque et n'approuve jamais une chaîne reçue du rendu. Ce n'est pas une revue de
  commande : `pnpm dev` est inoffensif à l'œil, ce qu'il exécute vit dans le
  `package.json`. On accorde une confiance à une provenance.
- **Ce qui protège le dev server du DNS rebinding n'est pas notre code.** C'est le
  `hostValidationMiddleware` de Vite, posé **avant** les hooks `configureServer` —
  donc avant le middleware `/api`. Sans lui, un domaine qui se rebinde sur 127.0.0.1
  devient même origine que l'interface, et la garde d'origine de `server/api.js` tombe
  avec la politique CORS. Deux gestes anodins le lèvent, en silence et sans rien
  casser de visible : poser `server.host` dans `vite.config.js`, ou élargir
  `server.allowedHosts`. Le commentaire y est, à relire avant d'y toucher.
- **Un secret collé dans un plan approuvé part dans git en clair.** La parade est en
  amont : ne pas en coller.

## Conventions

- **L'anglais est la langue publique, le français la langue de travail.** En anglais :
  la vitrine (`site/index.html` est la source, le français en dérive), les documents
  d'accueil (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  `CHANGELOG.md` — chacun a son pendant `*.fr.md`), et le repli de `t()`. En français :
  les commentaires, `CLAUDE.md`, `cadrage-ovrsee.md`, les plans et tickets d'`ovrsee/`,
  les messages de commit. Anglais pour le code et les identifiants.
- **Cinq dépendances en production** (`@phosphor-icons/react`, `@xterm/xterm`,
  `@xterm/addon-fit`, `node-pty`, `playwright-core`). Cette sobriété est un choix —
  demander avant d'en ajouter une.

  `playwright-core` y est passé le jour où le crawl a été embarqué dans le paquet, et
  son rangement n'est pas cosmétique : **electron-builder élague les
  `devDependencies`**, quoi que dise la liste `files` d'`electron-builder.yml`. Le DMG
  sortait sans lui et le crawl échouait sur `ERR_MODULE_NOT_FOUND` — invisible en dev,
  où le dossier est là de toute façon. Toute dépendance dont l'application livrée a
  besoin à l'exécution doit être en `dependencies`, sans exception.
- Styles en CSS-in-JS via l'utilitaire `s()` d'`app/src/style.ts`, sur les jetons du
  design system Nocturne. Pas de fichier `.css` dans `app/src`.
