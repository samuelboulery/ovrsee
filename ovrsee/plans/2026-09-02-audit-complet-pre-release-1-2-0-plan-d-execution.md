---
{
  "status": "closed",
  "title": "Audit complet pré-release 1.2.0 — plan d'exécution",
  "opened": "2026-09-02",
  "closed": "2026-09-02",
  "commits": [
    {
      "sha": "f22dd88",
      "date": "2026-09-02",
      "files": [
        "app/src/render.test.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Produit.tsx",
        "crawl/auth.js",
        "crawl/confiance.js",
        "crawl/index.js",
        "electron/main.js",
        "hooks/ecriture-atomique.test.js",
        "hooks/git-status.js",
        "hooks/git.js",
        "hooks/git.test.js",
        "hooks/gitignore-sync.js",
        "hooks/i18n.js",
        "hooks/install-options.test.js",
        "hooks/install.js",
        "hooks/integrations.js",
        "hooks/settings.js",
        "hooks/snapshot.js",
        "mcp/dispatch.js",
        "mcp/mcp.test.js",
        "mcp/server.js",
        "server/api.js",
        "server/api.test.js"
      ]
    },
    {
      "sha": "38ca99f",
      "date": "2026-09-02",
      "files": [
        "CHANGELOG.fr.md",
        "CHANGELOG.md",
        "CLAUDE.md",
        "CONTRIBUTING.fr.md",
        "CONTRIBUTING.md",
        "SECURITY.fr.md",
        "SECURITY.md",
        "electron-builder.yml",
        "electron/main.js",
        "electron/preload.cjs",
        "mcp/server.js"
      ]
    },
    {
      "sha": "c3a21aa",
      "date": "2026-09-02",
      "files": [
        "app/src/App.tsx",
        "app/src/CommandPalette.tsx",
        "app/src/Shell.tsx",
        "electron/pty.js"
      ]
    },
    {
      "sha": "d07748d",
      "date": "2026-09-02",
      "files": [
        "app/src/App.tsx",
        "app/src/CommandPalette.tsx",
        "app/src/Shell.tsx",
        "crawl/index.js",
        "hooks/documentation.test.js",
        "hooks/git.js",
        "hooks/git.test.js",
        "package.json",
        "server/api.js"
      ]
    },
    {
      "sha": "671e996",
      "date": "2026-09-02",
      "files": []
    }
  ]
}
---

# Audit complet pré-release 1.2.0 — plan d'exécution

## Contexte

Dernière release : `1.1.2-beta` (2026-08-31), surtout sécuritaire. Depuis : 23 commits
(thème clair T-0218/T-0242, dégraissage T-0232 mergé en #102, barre de menu). Avant de
tagger `1.2.0`, repasse complète : sécurité, robustesse, perf, UI/a11y, typage,
architecture, tests, docs. Décisions prises avec l'utilisateur :

- **Livrable** : audit + tickets ovrsee + **correctifs des bloquants** (S1/S2 + docs de
  release). Le reste va au backlog, rattaché à un epic.
- **Revue UI sur l'app lancée** (`pnpm electron`), pas seulement statique.
- **`pnpm dlx knip`** autorisé (ponctuel, rien n'entre dans `package.json`).
- **Cible : `1.2.0`** (sortie de bêta).

## Déjà établi (ne pas refaire)

- 192 fichiers, 45 990 l. dont 12 697 de tests (63 fichiers, `node --test` seul).
  **Zéro couverture mesurée. Zéro `pnpm audit`/CodeQL en CI.** `electron/main.js` (775 l.)
  sans test direct. `Terminal.tsx` 798/800, `hooks/tickets.js` 774.
- Audits sécurité 08-20 et 08-22 clos ; audits ponytail 08-22 et 09-01 clos → **pas de
  ré-audit d'over-engineering, pas de ré-audit sécurité complet** : seules les surfaces
  nées depuis (trust T-0190, image T-0219, barre de menu T-0217, thème T-0242) et trois
  angles jamais nommés (webview `src`, `.git/config` d'un dépôt reçu, SVG servi).
- Docs périmées connues : `CHANGELOG [Unreleased]` vide ; `SECURITY.md` + `.fr.md` disent
  4 dépendances (5, `playwright-core` manque) et citent `onlyBuiltDependencies`/`.npmrc`
  (pnpm 11 : `allowBuilds`/`pnpm-workspace.yaml`) ; `electron-builder.yml:44,57` « dépôt
  privé / usage personnel » ; `mcp/server.js:231` version `1.0.0` figée ;
  `electron/main.js:4` « trois routes » (11).
- Tickets non `fait` : T-0232 et T-0218 (epics dont tous les enfants sont soldés → à
  clôturer), T-0192 (signature macOS, différé, tenable sans auto-updater).
- État git : branche `degraissage-ponytail-t-0232` mergée (#102, squash). `graph.json` et
  `scans.jsonl` modifiés par les hooks, non commités.

## Phase 0 — Préparation et mesures (moi, ~10 min)

1. `git checkout main && git pull` (le `post-merge` reconcile), puis branche
   `audit-pre-release-1.2.0`. Laisser `graph.json`/`scans.jsonl` de côté.
2. Commandes de mesure, sorties gardées dans le scratchpad pour les lots :
   - `pnpm audit` et `pnpm audit --prod` ; `pnpm outdated` ; `pnpm licenses list`
   - `pnpm config list` → `minimumReleaseAge` réellement actif
   - `pnpm build:ui && ls -la app/dist/assets && gzip -c app/dist/assets/index-*.js | wc -c`
   - `node --test --experimental-test-coverage hooks/*.test.js crawl/*.test.js server/*.test.js mcp/*.test.js scripts/*.test.js electron/*.test.js`
   - `node scripts/test-ui.js` puis coverage sur `app/.test-build/**/*.test.js`
   - `pnpm lint && pnpm dlx oxlint --print-config` ; `pnpm typecheck` ;
     `pnpm dlx tsc -p tsconfig.json --noUncheckedIndexedAccess | grep -c error`
   - `pnpm dlx knip` (code mort, exports, deps inutilisées)
   - `git log --oneline v1.1.2-beta..HEAD` → matière du CHANGELOG
   - skill `ponytail:ponytail-debt` → ledger des 11 notes `ponytail:` réelles
3. Lancer l'app pour le lot 4 : skill `run` (`pnpm electron`), captures des 7 onglets
   en clair **et** sombre (mode `OVRSEE_CAPTURE`, `electron/main.js:318`, ou
   Chrome/screenshots).

## Phase 1 — Huit lots en parallèle (agents, un seul message)

Chaque lot reçoit : son périmètre, ses hypothèses, ce qu'il ignore, le format de retour
ci-dessous, et l'interdiction d'écrire un fichier.

**Format de retour imposé** — en-tête 3 lignes (fichiers lus / hors périmètre renvoyé au
lot X / non vérifiable), puis tableau trié par sévérité, ≤ 25 lignes :
`ID | S1-S4 | fichier:ligne | hypothèse n° ou « nouveau » | confirmé/infirmé/incertain | preuve ≤ 2 l. | impact | correctif | effort S/M/L | ticket existant ou « aucun » | doublon lot X`.
S1 = exécution de code ou sortie du modèle de confiance ; S2 = perte de données, blocage,
inaccessible au clavier ; S3 = dette/drift trompeur ; S4 = cosmétique. Les « infirmé »
restent (une ligne) pour ne pas y revenir.

| # | Agent / skill | Périmètre | Hypothèses à vérifier (fichier:ligne) |
|---|---|---|---|
| 1 | `security-reviewer` + skill `threat-modeling` (STRIDE : dépôt observé, page tierce en webview, rendu compromis) | `electron/{main,preload,crawl,tray,pty}`, `crawl/{confiance,index,auth}`, `hooks/{shell,git-status,snapshot:173-189,455-506}`, `server/api.js:60-78,129-137,259-270,499-518,610-632`, `app/src/tabs/{Navigateur.tsx,navigateur-webview.ts}` | (1) `main.js:240-253` `will-attach-webview` ne filtre pas `params.src`, pas de `will-navigate` sur l'invité → `src=file://` + `executeJavaScript` (`Navigateur.tsx:293`) = lecture disque ? (2) `git-status.js:30,53`, `snapshot.js:175`, `api.js:132,265` : `git` avec `cwd` d'un dépôt reçu avec son `.git/config` (`core.fsmonitor`, `sshCommand`) exécute du code sans `trust.json`. (3) `/api/media` sert `.svg` (`snapshot.js:487`) sous `ovrsee://app` sans `sandbox` CSP ni `Content-Disposition` ; `will-navigate:302` laisse toute URL de l'origine. (4) `crawl/index.js:255` `config.ignore` → `new RegExp` sans échappement ; `:60` et `auth.js:27` `JSON.parse` nus + types non validés. (5) `auth.js:91-96` `join(root, storageState)` sans confinement → écriture + chmod hors dépôt ? (6) `shell.js:46` `-lic` avec `stdin: 'ignore'` : `.zshrc` interactif qui questionne bloque 60 s ; `SHELL=fish`/`sh` ? (7) `main.js:505-548` `integrations:save` rejet muet si `provider` invalide ; `checkStatus:548` déréférence `checker` indéfini. (8) `main.js:742-747` `menubar:answer` accepté de toute fenêtre de l'origine (⌘N `menu.js:95`) — voulu ? Ignore : tickets/images, CSP Vite, signature, tout ce que 08-20/22 ont tranché. |
| 2 | `code-reviewer` (robustesse Node non typé) | `mcp/{server,dispatch}`, `server/api.js:308-383,554-608`, `hooks/{active:270-330,settings,integrations,gitignore-sync,install:300-345,398-440,tickets,ovrsee-post-commit,reconcile}`, `electron/crawl.js`, `crawl/index.js:112-245` | (1) `server.js:214` destructuration hors `try` : ligne `null` tue le MCP ; `id: null`. (2) `dispatch.js:277` `OUTILS[outil]` sans `hasOwn` (`'constructor'`) vs `pty.js:102` qui l'a. (3) `index.js:233-245` `stopApp` SIGTERM sans SIGKILL → port pris → crawl suivant refuse ; `electron/crawl.js:196-215` sous Windows. (4) `settings.js:240`, `integrations.js:99`, `gitignore-sync.js:59` : `writeFileSync` non atomique, non NoFollow → un seul correctif `writeFileNoFollow`. (5) `active.js:290-330` `withLock`/`dormir` bloque-t-il le fil principal Electron via `protocol.handle` ? (6) `api.js:571-587` corps > 1 Mo → « action inconnue » trompeur. (7) `electron/crawl.js:153` crawler hérite `NODE_OPTIONS` d'Electron. (8) `install.js:331-340` `~/.claude/settings.json` : une seule génération de sauvegarde, `hooks` des autres outils non vérifiés. Ignore : shell/git (lot 1), perf (3), duplication (6). |
| 3 | `code-reviewer` + skill `performance-optimization` (mesurer d'abord) | `electron/main.js:348-357`, `hooks/snapshot.js:63-130,173-189,349-446`, `server/api.js:610-632`, `app/src/{App.tsx:200-340,api.ts,useTerminal.ts:130-160,270-290,attention.ts,markdown.tsx:351,tabs/Donnees.tsx,graph.ts}`, `vite.config.js`, `app/dist/assets` (+ sorties phase 0) | (1) `protocol.handle` → `snapshot()` **sur le fil principal** : 4 `execFileSync git` + `statSync` par capture toutes les 15 s (`App.tsx:320`), `tableau()` toutes les 4 s (`:306`) → latence `pty:data`. Mesurer (timestamp autour de `fetchHandler`). (2) README ≤ 200 ko + `whys` dans chaque `/api/project`. (3) `api.js:623` `readFileSync` PNG sur main vs stream `:601`. (4) `markdown.tsx:351` re-parse à chaque rendu, pas de `useMemo`. (5) `useTerminal.ts:149` un `write` par chunk + `attention.ts` scanne chaque chunk. (6) Bundle 623 ko brut : tree-shaking `@phosphor-icons/react` (patch CJS `patches/`), i18n 706×2 clés dans le rendu. (7) `snapshot.js:349-377` `getVaultDate` parcourt le coffre Obsidian à chaque `/api/graph`. Ignore : sécurité, a11y. |
| 4 | `code-reviewer` + skills `interfaces:better-accessibility` puis `interfaces:better-interface` (sur captures de l'app lancée) | `app/src/{Lightbox,CommandPalette,PreferencesPanel:640-735,Onboarding:400-537,Shell:150-300,440-500,640-660,App:540-640,Terminal:580-720}.tsx`, `tabs/{TableauDetail:455-518,Tableau:440-600,700-730,TableauCarte,Navigateur:438-520,NavigateurPanneaux}.tsx`, `_ds/ovrsee/styles.css:440-450,674+`, `site/index.html` | (1) `Lightbox.tsx:63-68` sans `role=dialog`/`aria-modal`/piège de focus ; `useEffect:48` sans deps. (2) 4 `role=dialog` (`CommandPalette:169`, `PreferencesPanel:655`, `Onboarding:418`, `TableauDetail:495`), un seul `.focus()` : pas de restauration, pas d'`inert`. (3) Kanban `draggable` (`TableauCarte:41`, `Tableau:465`) sans équivalent clavier — `TableauDetail` a-t-il un sélecteur de colonne ? (4) `Shell.tsx:652-653` bouton `aria-hidden` hors survol. (5) `App.tsx:618` `<main aria-live=polite>` sur tout : chaque poll parle ; onglets sans `tablist`. (6) `styles.css:445` `outline:none`, `CommandPalette:206` `outline:0` inline ; `Navigateur:445-451` nom accessible « ← ». (7) `prefers-reduced-motion` un seul bloc ; `@keyframes blink` `app/index.html:31`. (8) Contraste : parité clair/sombre mesurée, pas AA — décision de release sur les 3 niveaux < 4,5:1. (9) `site/index.html` SVG sans `role=img`/`aria-hidden`, h1 68 px mobile, skip link. Ignore : perf, typage, parité i18n (706/706 vérifiée). |
| 5 | `typescript-reviewer` | `app/src/**/*.ts(x)` hors tests, `env.d.ts`, `api.ts`, `data.ts`, `tsconfig.json`, `.oxlintrc.json`, `electron/preload.cjs` (contrat `window.ovrsee`) | (1) `.oxlintrc.json` sans règle ni plugin : `pnpm lint` quasi vide — chiffrer `-D correctness -D suspicious` + `react-hooks`. (2) `Navigateur.tsx:134-138` effet aux deps incomplètes ; les 14 `useEffect` d'`App.tsx`. (3) `api.ts:11-15` `json<T>` sans validation de frontière. (4) `env.d.ts` vs `preload.cjs:99` (`setTheme` reçoit `'system'`), `:115` param `theme` disparu. (5) `ClaudeConfigPanel.tsx:307` `any` ; `navigateur-webview.ts:67` double cast ; `api.ts:283,292` index signatures. (6) Coût de `noUncheckedIndexedAccess` (phase 0). (7) `data.ts` : types `Ticket`/`Plan` vs frontmatter réel (`colonne` d'epic inerte). Ignore : a11y, perf, Node. |
| 6 | `architect` (invariants, frontières) | `CLAUDE.md`, `cadrage-ovrsee.md`, `server/api.js:1-60,385-405`, `electron/main.js:359-380,487-500`, `mcp/dispatch.js:19-75`, `hooks/{install,gitignore-sync,obsidian:111,shell:64}`, `electron/pty.js:60`, `vite.config.js` | (1) Invariant « n'écrit que `tickets/` et `board.json` » contredit par `.gitignore` (`gitignore-sync:59`), `.git/hooks` (`install:140`), `ovrsee.config.json` (`install:367`), `obsidian/`, `pages/`, `plans/*.md` (`api.js:535`) → reformuler (écritures initiées vs automatiques) ou lister. (2) « registre = liste blanche » réécrit ~11× (`main.js:370,379,500,529,537,555,710,730`, `api.js:214,403,457,483,540`, `dispatch.js:69-73`) → un `known(path)` exporté. (3) `shell.js:64` `cleanEnv` ≡ `pty.js:60` `sessionEnv`. (4) `api.js:60` port 5180 couplé à `vite.config.js:30` sans test ; `api.js:394` param `cwd` inerte. (5) `git-fetch` par `/api` (servi par Vite) alors que le cadrage réserve l'IPC à ce qui exécute. (6) `dispatch.js:41` injecte `X-Ovrsee` : garde décorative pour le 3e hôte, non dit dans CLAUDE.md. (7) Vite 8 : `hostValidationMiddleware` toujours avant `configureServer` ? Ignore : over-engineering, sécurité pure. |
| 7 | `tdd-guide` (diagnostic, n'écrit rien) | `package.json:24`, `scripts/test-ui.js`, `hooks/documentation.test.js:194-250`, `server/api.test.js`, `mcp/mcp.test.js`, `crawl/{index,confiance}.test.js`, `electron/crawl.test.js`, `app/src/render.test.tsx`, `ci.yml`, `release.yml`, + sorties de couverture phase 0 | (1) Sans test : `main.js`, `tray.js`, `pty.js`, `menu.js`, `preload.cjs`, `crawl/auth.js`, `ovrsee-post-merge`, `session-start/end`, `principal.js` → extraire les prédicats purs de `main.js` (comme `lien-externe.js`). (2) `api.test.js` couvre-t-il les **deux hôtes** (`fetchHandler` avec `Request`, `Origin` absent/faux, `CORPS_MAX`) ? (3) `mcp.test.js` : ligne `null`, `id: null`, `> ARG_MAX`, `'constructor'`. (4) `index.test.js` : `isIgnored` motif invalide, `loadConfig` types faux. (5) `render.test.tsx` « ne lève pas » → 3 interactions minimales sans framework (`act`) : Escape sur Lightbox, palette, move Kanban. (6) `release.yml:72` sans lint/typecheck/audit ; seuil de couverture. (7) `Terminal.tsx` 798, `tickets.js` 774 : découper avant qu'un correctif ne les fasse dépasser. Ignore : contenu des bugs. |
| 8 | `docs-lookup` (Context7) + skills `claude-md-management:claude-md-improver`, `shipping-and-observability` — un seul agent enchaîne | `CHANGELOG*`, `SECURITY*`, `README*`, `CONTRIBUTING.md`, `CLAUDE.md`, `electron-builder.yml`, `release.yml`, `mcp/server.js:224-232`, en-têtes `main.js:1-12`, `preload.cjs`, `package.json` | (1) CHANGELOG `[Unreleased]` : rédiger fr+en à partir des 23 commits. (2) `SECURITY.md:64-79` : 5 deps, `allowBuilds`, `:68` « checksum publié » alors que `release.yml` ne publie aucun SHA256 lisible ; non signé vs T-0192. (3) `electron-builder.yml:44,57` périmés. (4) `main.js:4`, `preload.cjs:99,115`, `server.js:231` version figée. (5) Context7, une question chacune : MCP protocole vs `'2024-11-05'` (`server.js:227`) ; Electron 43 `will-attach-webview` `params.src` + dernier correctif sécurité de la branche ; Vite 8 `hostValidationMiddleware` ; pnpm 11 `allowBuilds`/`minimumReleaseAge` ; Node 22 flags de couverture. (6) `CLAUDE.md` (366 l.) : doublons avec CHANGELOG/commentaires de code, invariant (lot 6-1), « Terminal 798 » à jour — sans retirer une décision non déductible. (7) README : Chrome requis, `package:win`, DMG non signé présents ? Ignore : code. |

## Phase 2 — Consolidation → tickets (skill `ovrsee-tickets`)

1. Fusionner les 8 tableaux, dédupliquer par `fichier:ligne`, trancher les « incertain »
   en lisant le code moi-même (pas de relance d'agent).
2. Clôturer les epics T-0232 et T-0218 (enfants tous `fait`).
3. Créer l'epic **« Audit pré-release 1.2.0 (2026-09-02) »** avec un enfant par constat
   retenu (S1/S2 → `todo`, priorité haute ; S3/S4 → `backlog`). Chaque ticket porte
   fichier:ligne, preuve, correctif, effort. Les « infirmé » notés dans le corps de l'epic.
4. Rapport de synthèse à l'utilisateur : bloquants, accepté-et-documenté, backlog.

## Phase 3 — Correctifs bloquants (branche `audit-pre-release-1.2.0`)

Périmètre : tous les S1, les S2 à effort S/M, et les docs de release (CHANGELOG,
SECURITY, electron-builder.yml, versions figées, CLAUDE.md). Pour chaque correctif :
`superpowers:test-driven-development` (rouge → vert, dans le style `node:test`),
`hooks/documentation.test.js` respecté (découper `Terminal.tsx`/`tickets.js` si un
correctif les fait dépasser), commit Conventional français citant le `T-XXXX`.
Un S2 à effort L reste en `todo` et se dit explicitement dans le rapport.

Revue : agent `code-reviewer` puis `security-reviewer` sur `git diff main...HEAD`,
`superpowers:requesting-code-review` → `receiving-code-review`.

## Phase 4 — Release 1.2.0 (checklist `shipping-and-observability`)

1. `pnpm lint && pnpm typecheck && pnpm build:ui && pnpm test` verts, constatés.
2. `package.json` `1.2.0`, `mcp/server.js` version alignée, CHANGELOG daté fr+en.
3. PR décrivant toute la branche (`git diff main...HEAD`), plan de test inclus ;
   CI verte (checks, test-mac, test-win). Squash-merge → `git pull` →
   `pnpm ovrsee:close` (plan d'audit) → avancer les tickets.
4. Tag `v1.2.0 && git push --tags` : **demander avant** (publication publique).
   `pnpm package:mac` local + `pnpm dlx @electron/fuses read` pour vérifier le DMG
   (`RunAsNode` doit rester activée : le crawl en dépend, `electron/crawl.js:149`).

## Vérification de bout en bout

- Chaque S1/S2 corrigé a un test qui échouait avant (sortie constatée).
- App lancée (`pnpm electron`) : 7 onglets, clair + sombre, terminal, crawl approuvé sur
  ce dépôt (le dernier scan est en échec « commande dev non approuvée »).
- MCP : `pnpm ovrsee:mcp` avec une ligne `null` et `id: null` ne tue pas le serveur.
- `pnpm audit --prod` sans vulnérabilité haute ; `pnpm config list` montre
  `minimumReleaseAge 1440`.
- `superpowers:verification-before-completion` avant d'annoncer.

## Écarté, et pourquoi

- `e2e-runner` : aucune suite Playwright e2e, app Electron ; `OVRSEE_CAPTURE` suffit pour
  le visuel. Un socle e2e est un ticket, pas un pré-release.
- `refactor-cleaner` / `ponytail-audit` : deux audits clos en 10 jours ; `knip` en
  phase 0 tient lieu de détection mécanique.
- Ré-audit sécurité intégral : plans 08-20/22 clos et tenus ; lot 1 borné aux surfaces neuves.
- `hooks/i18n.js` : dictionnaire, parité 706/706. Windows : pas de machine, CI seule ;
  noté « non vérifiable » par le lot 2.
- T-0192 (signature/notarisation) : reste différé, tenable sans auto-updater ; le
  `SECURITY.md` corrigé le dit tel quel.
