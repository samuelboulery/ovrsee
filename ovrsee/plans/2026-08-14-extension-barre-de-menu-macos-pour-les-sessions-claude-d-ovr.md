---
{
  "status": "closed",
  "title": "Extension barre de menu macOS pour les sessions Claude d'ovrsee",
  "opened": "2026-08-14",
  "closed": "2026-08-16",
  "commits": [
    {
      "sha": "ca72ca5",
      "date": "2026-08-16",
      "files": [
        "CLAUDE.md",
        "app/src/MenuBarPanel.tsx",
        "app/src/Terminal.tsx",
        "app/src/attention.test.ts",
        "app/src/attention.ts",
        "app/src/main.tsx",
        "app/src/menubar.test.ts",
        "app/src/menubar.ts",
        "app/src/node-test.d.ts",
        "app/src/render.test.tsx",
        "app/src/useTerminal.ts",
        "electron/main.js",
        "electron/preload.cjs",
        "electron/pty.js",
        "electron/tray.js",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/install.js",
        "hooks/install.test.js",
        "hooks/notify.test.js",
        "hooks/ovrsee-notify.js"
      ]
    }
  ]
}
---

# Extension barre de menu macOS pour les sessions Claude d'ovrsee

## Contexte

Quand une session Claude tourne dans un onglet d'ovrsee et qu'on est ailleurs
— autre app, autre écran — on ne voit pas qu'elle attend une réponse. Il faut
revenir à la fenêtre, retrouver l'onglet, lire le cadre. La demande : un item
dans la barre de statut macOS (en haut à droite) qui donne d'un coup d'œil
l'état des sessions Claude **lancées par ovrsee**, et permet d'autoriser ou de
refuser une commande sans rouvrir la fenêtre.

Faisable en Electron : `Tray` + une petite `BrowserWindow` sans cadre. Ovrsee
possède déjà ces ptys (`electron/pty.js`), donc pas besoin de scanner
`~/.claude/sessions/` ni de lire les transcripts JSONL — dont le format est
interne et casse entre versions.

Ce qui rend la partie « autoriser / refuser » possible : le hook
`PermissionRequest` est **bloquant**, et `~/.claude/settings.json` lui accorde
déjà un `timeout` de 86400 s. Claude appelle le script, le script attend, la
barre de menu décide, le script rend sa réponse en JSON. Documenté et supporté.

Périmètre v1 arbitré : **voir + approuver**. Répondre à une question en texte
libre n'y est pas (voir « Écarté »).

## Sur l'invariant

Approuver un appel d'outil dans un terminal qu'ovrsee héberge déjà reste dans
« il n'exécute que le terminal qu'on lui demande ». Ce qui franchirait la ligne,
c'est décider pour des sessions qu'ovrsee n'a pas lancées — d'où la garde
`OVRSEE_PTY` ci-dessous, qui est toute la raison d'être de cette variable.

## Architecture

```
session Claude (pty possédé par ovrsee)
  └─ hook PermissionRequest → hooks/ovrsee-menubar.js
        écrit  ~/.claude/ovrsee/menubar/<nonce>.request.json
        attend ~/.claude/ovrsee/menubar/<nonce>.answer.json   (bloquant)
              ▲                                   │
              │                                   ▼
        electron/tray.js  ──  popover  ──  app/src (vue barre de menu)
```

Transport par **fichiers**, pas par socket ni port : même arbitrage que le
terminal dans le cadrage, et `~/.claude/ovrsee/` est déjà le foyer hors dépôt
de l'état non versionné (`integrations.json`).

## Fichiers

**`hooks/ovrsee-menubar.js`** _(nouveau)_ — le hook, un seul fichier pour tous
les événements, aiguillage sur `hook_event_name`.
- Lit le JSON sur stdin (`session_id`, `cwd`, `tool_name`, `tool_input`…).
- **Si `process.env.OVRSEE_PTY` est absent → sort 0 sans rien écrire.** Une
  session lancée dans un vrai terminal n'est jamais détournée.
- Sinon : écrit la requête, attend la réponse (`fs.watch` sur le dossier +
  repli par sondage à 250 ms), puis imprime sur stdout :
  ```json
  {"hookSpecificOutput":{"hookEventName":"PermissionRequest",
   "decision":"allow","decisionReason":"barre de menu"}}
  ```
- Supprime le couple requête/réponse dès qu'il a répondu.
- Sur expiration, réponse illisible, ou valeur autre que `allow`/`deny` :
  **stdout vide, exit 0** → Claude repose la question dans le terminal, comme
  aujourd'hui. Jamais `allow` par défaut.
- Trace éventuelle sur **stderr uniquement** — stdout est le canal de décision.

**`electron/pty.js`** — deux ajouts.
- Dans `sessionEnv()` (ligne 66) : `OVRSEE_PTY: id` et `OVRSEE_SPOOL: <dossier>`.
  Le filtre `startsWith('CLAUDE')` ne les touche pas. `sessionEnv()` prend donc
  `id` en argument, appelé depuis `openSession()` après le `const id =` (ligne 112).
- Exporter `listSessions()` sur la `Map` `sessions` (ligne 82) : `id`, `project`,
  `kind`. C'est la liste que la barre de menu affiche — filtrée sur
  `kind === 'claude'`.

**`electron/tray.js`** _(nouveau)_ — `Tray` + popover.
- Icône **template** (`iconTemplate.png` + `@2x`, noir et alpha seuls) sinon
  elle ne s'inverse pas en thème clair.
- Popover : `BrowserWindow` `{ frame: false, resizable: false, alwaysOnTop: true,
  skipTaskbar: true, show: false }`, positionnée sous `tray.getBounds()`, cachée
  au `blur`. Charge `ovrsee://app/#/barre-de-menu` — même origine, même build,
  même design system, aucun build supplémentaire.
- **Pas de `app.dock.hide()`** : ovrsee reste une app normale avec sa fenêtre.
- Surveille le dossier spool (`fs.watch`), pousse les requêtes en attente au
  popover, écrit le fichier réponse au clic.
- Badge sur l'icône (`tray.setTitle('●')`) quand une requête attend.

**`app/src/`** — une vue pour le popover, dans le style des onglets existants.
Liste des sessions Claude (dossier de projet, « en attente de toi » / « active »),
et pour chaque requête : `tool_name`, la commande, deux boutons. Un troisième
bouton « ouvrir la session » réutilise l'IPC `app:focus` (`main.js:469`).

**`electron/preload.cjs`** — canaux du popover, sur le modèle de `terminal`
(lignes 113-140) : `menubar.listen(handler)`, `menubar.answer(nonce, decision)`,
`menubar.sessions()`.

**`electron/main.js`** — appeler `createTray()` dans `app.whenReady()`
(après ligne 275), et `ipcMain.handle` pour les trois canaux ci-dessus.

**`~/.claude/settings.json`** _(hors dépôt, action manuelle)_ — **ajouter** au
tableau `PermissionRequest`, sans remplacer : `DetachIslandHooks` y est déjà,
comme `pnpm-guard.js` et `ovrsee-tool-edit-gate.js` sur `PreToolUse`. Le
premier `deny` gagne, donc l'ordre compte.

## Sécurité

Ce point mérite d'être lu avant d'écrire la première ligne.

Le dossier spool est une **surface de contrôle** : ce qui peut y déposer un
`allow` peut faire approuver un appel d'outil dans vos sessions Claude. Tout
processus tournant sous votre compte le peut. C'est exactement l'exposition que
le cadrage a refusée pour une socket locale du terminal — l'accepter ici doit
être un choix conscient, pas un effet de bord.

Parades, toutes bon marché et réelles :

- Créer le dossier en `0700`, et les fichiers en `0600`.
- Toute réponse qui n'est pas exactement `allow` ou `deny` compte comme absente
  → repli sur l'invite du terminal. Jamais `allow` sur expiration, sur erreur
  d'analyse, ou si l'app ne tourne pas.
- Le nonce dans le nom de fichier **n'est pas** une protection contre un
  processus du même compte : il peut lister le dossier. Ne pas s'en réclamer.
- Le fichier de requête contient `tool_input` — une ligne de commande complète
  pour `Bash`, du contenu de fichier pour `Edit`/`Write`. Il s'écrit sur disque
  hors du dépôt et se supprime dès qu'il est répondu.
- Ne jamais lire ni recopier `~/.claude/daemon/roster.json` ni
  `~/.claude/daemon/control.key` : ils portent des jetons d'authentification
  vivants pour les sockets internes du démon.

## Ordre de travail

1. **Sonde de repli** (10 lignes, 5 minutes) — un hook qui dort 5 s puis sort 0
   sans rien imprimer. Vérifier que Claude repose bien la question dans le
   terminal. Tout le reste en dépend ; si ce n'est pas le cas, le plan change.
2. `hooks/ovrsee-menubar.js` + son test.
3. `pty.js` : env + `listSessions()`.
4. `tray.js` + popover, d'abord avec une liste en dur.
5. La vue `app/src`, branchée.
6. Enregistrement du hook dans `settings.json`.

## Vérification

- **`hooks/ovrsee-menubar.test.js`** — `node:test` et `node:assert` seuls, style
  existant, aucun framework. Sur un dossier spool temporaire : requête écrite →
  réponse déposée → JSON de décision sur stdout ; aucune réponse → stdout vide,
  exit 0 ; `OVRSEE_PTY` absent → stdout vide, aucun fichier écrit.
- **`pnpm test`** doit rester vert (le nouveau test est ramassé par le `node --test`
  sur `hooks/`).
- **À la main, c'est celle qui compte** : `pnpm electron`, ouvrir une session
  Claude dans un onglet projet, lui demander de lancer une commande, passer sur
  une autre app, cliquer l'icône de la barre de menu → la requête est là →
  « Refuser » → le terminal montre l'outil refusé. Puis recommencer avec
  « Autoriser ».
- **Le cas hors ovrsee** : lancer `claude` dans Terminal.app, déclencher une
  permission, vérifier que rien n'apparaît dans le popover et que l'invite
  s'affiche normalement dans le terminal.
- Vérifier l'icône en thème clair **et** sombre (l'oubli du suffixe `Template`
  ne se voit que dans un des deux).

## Écarté

- Parsing des transcripts `~/.claude/projects/**/*.jsonl` et scan de
  `~/.claude/sessions/` : inutile, ovrsee possède ses ptys. Format interne de
  toute façon.
- Socket unix ou port HTTP : refusé par le cadrage, et les fichiers suffisent.
- Statut détaillé par session (« réfléchit », « écrit un fichier »…) : v1 se
  contente de « en attente de toi » / « active ». À ajouter si le coup d'œil se
  révèle trop pauvre — le même hook, sur `Notification` et `Stop`, écrirait un
  `status/<ptyId>.json`.
- Répondre à une question en texte libre ou à un `AskUserQuestion` depuis le
  popover. Techniquement possible — le pty est possédé, `writeTo(id, texte)`
  existe déjà — mais afficher la question demanderait d'analyser le flux xterm,
  et deviner quelle option est surlignée pour envoyer les bonnes touches. À
  reprendre le jour où un canal structuré existe.
