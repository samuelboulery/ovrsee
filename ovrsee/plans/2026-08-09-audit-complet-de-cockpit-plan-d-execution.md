---
{
  "status": "closed",
  "title": "Audit complet de Cockpit — plan d'exécution",
  "opened": "2026-08-09",
  "closed": "2026-08-09",
  "commits": [
    {
      "sha": "44f0961",
      "date": "2026-08-09",
      "files": []
    },
    {
      "sha": "089a9ef",
      "date": "2026-08-09",
      "files": [
        ".claude/settings.json",
        "CLAUDE.md"
      ]
    },
    {
      "sha": "569dc41",
      "date": "2026-08-09",
      "files": [
        ".gitignore",
        "AUDIT-2026-08-09.md",
        "app/src/App.tsx",
        "app/src/Garde.tsx",
        "app/src/Illisibles.tsx",
        "app/src/Terminal.tsx",
        "app/src/data.test.ts",
        "app/src/data.ts",
        "app/src/main.tsx",
        "app/src/markdown.tsx",
        "app/src/node-test.d.ts",
        "app/src/render.test.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/tabs/Stack.tsx",
        "app/src/tabs/Tableau.tsx",
        "app/src/useTerminal.ts",
        "crawl/index.js",
        "electron/pty.js",
        "hooks/install.js",
        "hooks/install.test.js",
        "hooks/obsidian.js",
        "hooks/obsidian.test.js",
        "hooks/plans.js",
        "hooks/plans.test.js",
        "hooks/snapshot.js",
        "hooks/snapshot.test.js",
        "hooks/tickets.js",
        "hooks/whys.js",
        "hooks/whys.test.js",
        "package.json",
        "scripts/test-ui.js",
        "tsconfig.test.json"
      ]
    },
    {
      "sha": "36e698a",
      "date": "2026-08-09",
      "files": []
    }
  ]
}
---

# Audit complet de Cockpit — plan d'exécution

## Contexte

Cockpit est une application Electron (~12,8k lignes) qui donne une vue en lecture seule
sur un projet vibecodé : plans capturés, pages crawlées, tickets, terminal intégré.
Elle a été construite vite, en douze plans successifs sur deux jours, sans jamais
qu'on s'arrête pour vérifier l'ensemble.

Rien n'indique qu'elle soit cassée. Ce qu'on ne sait pas, c'est ce qui a dérivé pendant
la construction : du code dupliqué entre onglets, des états d'erreur jamais éprouvés,
une surface Electron (IPC, webview, pty, protocole `cockpit://`) qui n'a jamais été
relue en tant que surface, et zéro test sur `app/src/` et `electron/`.

L'audit répond à une question : **qu'est-ce qui, dans cette application, mérite d'être
corrigé — et qu'est-ce qui va très bien comme ça ?**

Périmètre arbitré avec l'utilisateur :
- **Constat seul.** Aucun fichier source modifié. Les seules écritures sont les tickets,
  le rapport, et le setup Claude Code du projet (phase 0).
- **Test réel.** `pnpm dev` piloté au navigateur, puis `pnpm electron` pour ce que le
  navigateur ne voit pas : pty, webview, IPC, protocole.
- **Tickets sobres.** Un ticket par problème qui mérite d'être corrigé, avec un critère
  d'acceptation constatable. Les nits restent dans le rapport. ~8 à 15 tickets attendus.

## Ce que l'audit ne fera pas

- Aucune modification de `app/`, `electron/`, `server/`, `hooks/`, `crawl/`, `scripts/`.
- Aucune installation de dépendance (pas d'eslint, pas de knip, pas de vitest).
- Aucun `git reset`, `git clean`, `rm -rf`, réécriture d'historique, commit ni push.
- Aucun test destructif sur le dépôt réel. Les scénarios d'erreur (dossier `cockpit/`
  absent, frontmatter corrompu) se jouent sur une **copie du dépôt dans le scratchpad**,
  jamais sur l'original.

## Phase 0 — Le setup Claude Code du projet, qui n'existe pas

Constat : le dépôt n'a **ni `CLAUDE.md`, ni `.claude/`**. Tout vient des règles globales
de `~/.claude/`. Conséquence concrète : à chaque session, Claude redécouvre que le
gestionnaire est pnpm, que `cockpit/` ne s'édite pas à la main sauf les tickets, que
`support.js` est du code vendu, que `pnpm test` c'est `node --test` et pas vitest.
Et chaque commande courante — `pnpm test`, `pnpm typecheck`, `pnpm dev`, `git status` —
redemande une permission.

Ce qui est déjà en place, et qu'on ne retouche pas : les deux hooks Claude Code dans
`~/.claude/settings.json` (capture de plan, brief au démarrage) et le hook git
`post-commit` (`.git/hooks/post-commit:61-64`, plus celui de graphify).

À écrire, via le skill `project-setup` :

**`CLAUDE.md` à la racine** — court, factuel, seulement ce qui n'est pas déductible
du code :
- L'invariant produit : *le cockpit lit, il n'exécute que le terminal qu'on lui demande*.
  C'est la règle qui doit faire refuser une fonctionnalité.
- La carte des couches : `hooks/` capture, `crawl/` photographie, `server/api.js`
  partagé entre le dev server Vite et le protocole `cockpit://` d'Electron —
  **une seule implémentation, deux hôtes**, et pourquoi les dédoubler serait une faute.
- Les commandes réelles : `pnpm test` (node:test, pas de framework), `pnpm typecheck`
  (ne couvre que `app/src`), `pnpm dev`, `pnpm electron`, `pnpm package`.
- Les zones interdites : `cockpit/` est produit par les hooks — seuls
  `cockpit/tickets/` et `cockpit/board.json` se saisissent. `support.js` et
  `Cockpit-A-Nocturne.dc.html` sont vendus. `_ds/` est une référence visuelle.
- Renvoi vers `cadrage-cockpit.md` pour les arbitrages, plutôt que de les recopier.

**`.claude/settings.json`** — permissions en lecture seule et commandes sûres du projet
(`pnpm test`, `pnpm typecheck`, `pnpm build:ui`, `git status`, `git diff`, `git log`),
pour cesser de demander à chaque fois. Rien de destructif en `allow`.

Ces deux fichiers sont les **seuls fichiers hors `cockpit/tickets/` et rapport** que
l'audit crée. Ils sont écrits en Phase 0 pour que le reste de l'audit en profite, et
relus en fin de course à la lumière de ce que l'audit aura appris.

## Phase 1 — Vérification statique

Établir la ligne de base. Chaque commande, sa sortie collectée dans le scratchpad.

| Commande | Ce qu'on en tire |
|---|---|
| `pnpm typecheck` | Erreurs de type, `noUnusedLocals` — ne couvre que `app/src` |
| `pnpm test` | 10 suites, ~200 cas (hooks/, crawl/, server/). Un échec ici est P0 |
| `pnpm build:ui` | Build Vite : warnings, taille du bundle |
| `pnpm package` | Empaquetage electron-builder — écrit dans `release/`, ignoré par git. Vérifie l'asar et le déballage de `node-pty` |
| `git status` / `git diff pnpm-lock.yaml` | Lockfile cohérent, pas de fichier orphelin |

Recensement du code mort **sans nouvel outil** : croiser les `export` de `app/src` avec
les `import`, et vérifier à la main les candidats. Cible connue à confirmer :
`useHover` (`app/src/style.ts`), `shotRatio` (`app/src/data.ts`),
`cockpit/pages/shots/backlog/` (18 captures d'une route qui n'existe plus).

## Phase 2 — Relecture de code, en parallèle

Sept passes, lancées par lots d'agents parallèles. Chacune rend des constats
`fichier:ligne` avec un scénario de défaillance concret — pas une impression.

| Passe | Fichiers | Ce qu'on cherche |
|---|---|---|
| **Electron** | `electron/main.js` (350), `preload.cjs` (88), `pty.js` (167) | Validation de chaque `ipcMain.handle`, traversée de chemin dans `serveUi()`, cycle de vie des pty (processus orphelins à la fermeture), `will-attach-webview`, CSP (main.js:76-90) |
| **API & données** | `server/api.js` (304), `app/src/data.ts` (738), `hooks/snapshot.js` | Validation des entrées par route, écriture atomique, frontmatter JSON malformé, écritures concurrentes sur un même ticket |
| **React** | `App.tsx` (693), `tabs/Tableau.tsx` (772), `tabs/Navigateur.tsx` (694), `tabs/Produit.tsx` (692) | Tableaux de dépendances des hooks, closures obsolètes, fetch non annulé au démontage, `setState` après démontage, courses entre onglets |
| **Terminal** | `Terminal.tsx` (437), `useTerminal.ts` (304), `electron/pty.js` | Fuite de listeners, nettoyage xterm, contre-pression, remontée d'erreur pty vers l'UI |
| **Crawl** | `crawl/index.js` (407), `auth.js` (87), `routes.js` (110) | `spawn(config.dev, {shell:true})` (index.js:144, auth.js:53), timeouts, fermeture du navigateur Playwright en cas d'échec, boucle infinie sur les routes |
| **Hooks** | `hooks/plans.js` (443), `tickets.js` (509), `obsidian.js` (313) | Machine à états des plans, génération d'`id` de ticket, `writeFileNoFollow`, sûreté des noms de fichiers |
| **UX / a11y / redondance** | tout `app/src` | Repères sémantiques absents, 2 `aria-label` en tout, pas de piège de focus dans les modales, pas de `prefers-reduced-motion`, thème sombre seul, 40+ chaînes de style répétées, blocs « vide » dupliqués sur 6 onglets |

Sécurité : passe dédiée par l'agent `security-reviewer` sur `electron/` + `server/` +
`crawl/`, en complément. `support.js` (runtime dc pour le `.dc.html` de maquette) est
un fichier vendu, hors périmètre applicatif — signalé, pas audité.

## Phase 3 — Test dynamique

### 3a. Navigateur, via `pnpm dev` (port 5180)

Piloté avec l'outil Chrome. Console et réseau lus à chaque étape.

Pour chacun des 7 onglets — Aperçu, Navigateur, Produit, Historique, Tableau, Données,
Stack : chargement, erreurs console, requêtes `/api/*` en échec, rendu visuel.

Flux à éprouver, pas seulement à regarder :
- Changer de projet dans la barre latérale, revenir — l'état suit-il ?
- Naviguer entre onglets par URL (`/produit?p=…`), puis bouton retour du navigateur.
- **Tableau** : créer un ticket, le déplacer entre colonnes, l'éditer, éditer une
  colonne. Vérifier le fichier écrit dans `cockpit/tickets/`, puis **remettre l'état
  d'origine** (le ticket de test est supprimé en fin d'audit).
- **Produit** : pan/zoom du graphe, clic sur une carte, lightbox, navigation dans
  l'historique des captures.
- **Historique** : dépliage d'un plan, rendu markdown.
- Redimensionner la fenêtre à ~900px de large : où l'absence de media query casse.
- Parcours au clavier seul, sur chaque onglet — où le focus se perd.

### 3b. Application Electron, via `pnpm electron`

Ce que le navigateur ne peut pas montrer :
- Ouverture de la fenêtre, protocole `cockpit://`, absence d'erreur console.
- **Terminal** : ouvrir un terminal `claude` et un terminal `shell`, plusieurs
  simultanés, saisie UTF-8, redimensionnement, `Ctrl+C`, fermeture. Puis
  `ps aux | grep -c pty` avant/après pour prouver l'absence de processus orphelin.
- **Navigateur intégré** : chargement d'une URL, DevTools ancrées, sélecteur d'élément,
  et le test de confinement — tentative de navigation vers `file:///etc/passwd`.
- **Skills** : panneau ouvert, catalogue lu. L'installation réelle écrit dans
  `~/.claude/skills/` — **demandée à l'utilisateur avant de la déclencher**, sinon
  seule la lecture est testée.

### 3c. Scénarios de défaillance — sur copie

Copie du dépôt dans le scratchpad, puis : `cockpit/` absent, `board.json` illisible,
ticket au frontmatter cassé, `pages.json` vide, port 5180 déjà pris. On observe si
l'application dit ce qui ne va pas ou si elle ment / plante.

### 3d. Crawl

`pnpm cockpit:crawl` sur le dépôt copié — jamais sur l'original, pour ne pas polluer
`cockpit/pages/`. Vérifie que le scan s'écrit, y compris en échec.

## Phase 4 — Notation et tickets

Échelle, et ce qu'elle déclenche :

| Niveau | Critère | Suite |
|---|---|---|
| **P0** | Plantage, perte de données, faille exploitable | Ticket, priorité `haute`, colonne `pret` |
| **P1** | Fonction cassée ou trompeuse, blocage a11y | Ticket, `haute`, `pret` |
| **P2** | Bug partiel, redondance coûteuse, trou de test | Ticket, `moyenne`, `backlog` |
| **P3** | Cosmétique, incohérence de style | Rapport seulement, pas de ticket |
| **Constat** | Fonctionne comme prévu, arbitrage assumé | Rapport, section « ce qui va bien » |

Règle de retenue, tirée du skill `cockpit-tickets` : **pas de critère d'acceptation
constatable → pas de ticket.** Un doute qui demande un arbitrage part en colonne
`a-specifier` avec la question ouverte écrite dans le corps.

Format : fichier `cockpit/tickets/T-NNNN-<slug>.md`, frontmatter JSON, `id` = max
existant + 1 (T-0001 existe, donc T-0002 et suivants). Colonnes lues dans
`cockpit/board.json` — jamais supposées.

## Phase 5 — Rapport

Fichier `AUDIT-2026-08-09.md` à la racine du dépôt, plus une **page Artifact** pour le
lire confortablement.

Structure :
1. **Verdict en cinq lignes** — état général, nombre de constats par niveau,
   recommandation.
2. **Ce qui va bien** — explicitement, pour que le reste soit lisible.
3. **Constats P0/P1/P2** — un bloc par constat : ce qui ne va pas, `fichier:ligne`,
   le scénario qui le déclenche, la preuve (sortie de commande ou capture), le
   correctif suggéré, le ticket associé.
4. **Constats P3** — liste courte, sans ticket.
5. **Preuves d'exécution** — sorties de `typecheck`, `test`, `build`, `package`, et
   les captures des 7 onglets.
6. **Couverture de test** — ce qui est couvert, ce qui ne l'est pas, et si ça compte.

## Vérification

L'audit est fini quand :
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build:ui`, `pnpm package` ont tourné, sortie
      archivée, et chaque échec figure dans le rapport.
- [ ] Les 7 onglets ont été ouverts dans le navigateur **et** dans Electron, avec
      capture à l'appui.
- [ ] Un terminal a été ouvert, utilisé et fermé, sans processus orphelin — preuve `ps`.
- [ ] Chaque constat P0/P1/P2 a son ticket, et chaque ticket a un critère d'acceptation
      qu'on peut cocher sans relire le rapport.
- [ ] `CLAUDE.md` et `.claude/settings.json` existent, et une session neuve démarre sans
      redemander les commandes courantes.
- [ ] `git status` ne montre aucune modification hors `cockpit/tickets/`,
      `AUDIT-2026-08-09.md`, `CLAUDE.md`, `.claude/` et les artefacts déjà ignorés
      (`release/`, `app/dist/`).
