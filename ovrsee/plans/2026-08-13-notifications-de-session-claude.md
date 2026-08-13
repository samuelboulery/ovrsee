---
{
  "status": "open",
  "title": "Notifications de session Claude",
  "opened": "2026-08-13",
  "closed": null,
  "commits": [
    {
      "sha": "09bf3b1",
      "date": "2026-08-13",
      "files": [
        "app/src/App.tsx",
        "app/src/Terminal.tsx",
        "app/src/attention.test.ts",
        "app/src/attention.ts",
        "app/src/useTerminal.ts",
        "electron/main.js",
        "electron/preload.cjs",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/install.js",
        "hooks/notify.test.js",
        "hooks/ovrsee-notify.js"
      ]
    }
  ]
}
---

# Notifications de session Claude

## Contexte

Une session Claude tourne dans le panneau terminal d'Ovrsee. Quand elle finit son
tour ou qu'elle attend une réponse (permission, question), rien ne le signale :
l'utilisateur parti sur une autre fenêtre — ou sur un autre projet, le panneau
replié — ne le sait qu'en revenant regarder.

But : une notification système au moment où Claude rend la main, dont le clic
ramène la fenêtre au premier plan et affiche **la session concernée** (bon projet,
bon onglet du panneau).

Arbitrages retenus :

- **Portée** : seules les sessions lancées dans le terminal d'Ovrsee. L'app possède
  déjà leur flux d'octets — rien à écrire sur disque, rien à sonder.
- **Granularité** : deux messages distincts, « session terminée » et « Claude pose
  une question ».
- **Si la fenêtre a le focus** : pas de notification si la session concernée est
  déjà visible (onglet actif, panneau ouvert). Sinon on notifie.

Précision de vocabulaire : Claude Code n'a pas d'événement « fin de session ». Le
hook `Stop` se déclenche **à chaque fin de tour** — c'est précisément le moment
utile (« Claude a fini, c'est à toi »), et c'est ce que dira la notification.

## Le principe

Un hook Claude Code peut renvoyer un champ `terminalSequence` : une séquence
d'échappement que Claude Code écrit dans **son propre terminal**. Ce terminal est
un pty qu'Ovrsee possède, et dont chaque octet passe déjà par `pty:data` puis par
le `bridge.listen` de `app/src/useTerminal.ts:214`.

Donc le signal voyage sur le canal existant :

```
hook Stop / Notification  →  \x1b]777;ovrsee;stop\x07  →  pty  →  pty:data
                                                             →  useTerminal (repère + retire)
                                                             →  App.tsx (notifie)
```

Conséquences gratuites :

- **Aucune écriture dans le dépôt observé** — l'invariant du cadrage tient.
- **L'identité de session est donnée** : la séquence arrive sur *un* pty, donc sur
  *une* clé de panneau `<projet>#claude`, qui porte le chemin du projet. Une seule
  chaîne suffit pour naviguer.
- **La portée se règle toute seule** : les mêmes hooks se déclenchent pour un
  `claude` lancé hors d'Ovrsee, mais la séquence part dans *son* tty (iTerm,
  VS Code) qui l'ignore silencieusement. Ovrsee ne voit que ses propres sessions.

## Étape 0 — Sonde (à faire en premier)

Deux points ne sont pas documentés et décident d'une ligne de code :

1. `terminalSequence` est documenté pour `Stop`. Rien ne dit qu'il est honoré pour
   `Notification`.
2. Le nom du champ qui porte le type de notification (`permission_prompt`,
   `idle_prompt`, `agent_needs_input`, `auth_success`…) n'est pas documenté.

Sonde : un `hooks/ovrsee-notify.js` provisoire qui écrit son stdin brut dans
`/tmp/ovrsee-hook.jsonl`, ET tente les deux transports —

- stdout `{"terminalSequence": "]777;ovrsee;probe"}`
- écriture directe `printf` vers `/dev/tty`

Puis `pnpm electron`, une question à Claude, et on regarde : le fichier donne le
nom du champ de type, le terminal (ou un log de `useTerminal`) dit lequel des deux
transports arrive. On garde celui qui marche, on jette l'autre. Si les deux
passent, garder `terminalSequence` seul pour `Stop` et `/dev/tty` pour
`Notification`.

Cette sonde ne dure que le temps de l'étape ; le hook final ne journalise rien.

## Fichiers à modifier

### 1. `hooks/ovrsee-notify.js` — nouveau, ~30 lignes

Lit le JSON sur stdin (même forme que les autres hooks du dossier), émet la
séquence selon l'événement :

- `hook_event_name: "Stop"` → `stop`
- `hook_event_name: "Notification"` → `question`, **uniquement** pour les types qui
  appellent une réponse humaine (`permission_prompt`, `idle_prompt`,
  `agent_needs_input`). `auth_success`, `elicitation_*` et `agent_completed` sont
  ignorés — sinon la notification devient du bruit.

Ne bloque jamais, ne journalise rien sur stdout hors du JSON attendu (piège connu
du dépôt : stdout est un transport, pas un journal).

### 2. `hooks/install.js` — enregistrement

Ajouter deux entrées dans le `.claude/settings.json` écrit pour un projet équipé,
au même endroit que les hooks existants (lignes ~114-181) : `Stop` et
`Notification`, tous deux vers `ovrsee-notify.js`. `Stop` cohabite avec
`ovrsee-tool-stop.js` et `ovrsee-capture-audit.js` déjà présents.

Les projets déjà équipés ne reçoivent les nouveaux hooks qu'après ré-exécution de
l'installateur — à signaler à l'utilisateur dans le message de fin.

### 3. `app/src/attention.ts` — nouveau, fonction pure

`extractAttention(carry, chunk)` → `{ clean, carry, events }`.

Deux points de rigueur, ce sont eux qui justifient un fichier à part et un test :

- **Coupure entre deux lectures** : la séquence peut arriver en deux morceaux. On
  conserve une queue (~32 octets suffisent, la séquence est plus courte) reportée
  sur le morceau suivant.
- **Retrait** : la séquence est ôtée de `clean` avant l'écriture dans xterm. Une
  OSC inconnue est normalement ignorée par xterm.js, mais on ne laisse pas passer
  ce qui ne le regarde pas.

### 4. `app/src/useTerminal.ts` — détection

Dans le `bridge.listen` (ligne 214), avant `pane.xterm.write(data)` : passer le
morceau par `extractAttention`, écrire `clean`, et remonter chaque événement.

`useTerminals(projectPath)` prend un second paramètre optionnel
`onAttention(sessionKey, kind)`. L'effet ayant `[]` en dépendances, la callback
passe par un `useRef` — même motif que `activeProjectRef` (ligne 177).

La carte de queues est tenue par pty id ; l'entrée est supprimée sur `pty:exit`,
là où `pane.id` est déjà remis à `null` (ligne 224).

### 5. `app/src/App.tsx` — politique et navigation

La callback reçoit `(sessionKey, kind)` :

- **Suppression** : ne rien faire si `document.hasFocus()` ET `sessionKey ===
  active` ET le panneau terminal est ouvert (le booléen existe déjà — le panneau
  est repliable, cf. le montage de `<Terminal>` vers App.tsx:276).
- **Sinon** : `new Notification(titre, { body, tag: sessionKey })`. Le `tag`
  écrase la notification précédente de la même session au lieu d'en empiler dix.
  Titre selon `kind` (« Session terminée » / « Claude pose une question »), corps =
  nom du projet, tiré de `projects` par le chemin contenu dans `sessionKey`.
- **Au clic** : `window.ovrsee.app.focus()`, puis `setCurrent(projectPath)`, ouvrir
  le panneau, `setActive(sessionKey)`. Le chemin du projet se lit dans `sessionKey`
  (`<projet>#claude`), déjà la convention de `claudeSlot` (useTerminal.ts:146).

L'API `Notification` du rendu n'existe utilement que sous Electron ; garder le tout
derrière le test de capacité déjà en place (`terminalBridge()` non nul), comme le
reste du panneau.

### 6. `electron/main.js` + `electron/preload.cjs` — un seul ajout

`ipcMain.handle('app:focus')` → `win.show(); win.focus()`, exposé en
`window.ovrsee.app.focus()`. C'est la seule chose que le rendu ne peut pas faire
seul. Rien d'autre ne bouge côté processus principal — `pty.js` n'est pas touché.

## Ce qui n'est pas fait

- Pas de journal de notifications, pas d'historique, pas de badge sur l'icône.
- Pas de détection pour les sessions Claude hors d'Ovrsee (arbitrage retenu).
- Pas de réglage d'activation dans les Paramètres — à ajouter si le besoin se
  confirme à l'usage.

## Vérification

**Test unitaire** (`app/src/attention.test.ts`, `node:test` + `node:assert`, style
du dépôt, aucun framework) :

- séquence entière dans un morceau → un événement, `clean` sans la séquence ;
- séquence coupée en deux morceaux → un événement au second ;
- texte sans séquence → `clean` identique à l'entrée, zéro événement ;
- deux séquences dans un même morceau → deux événements.

`pnpm test` (compile `app/src` via `scripts/test-ui.js`) puis `pnpm typecheck`.

**Manuel**, le seul qui prouve la chaîne complète — `pnpm electron` :

1. Ouvrir un projet équipé (ré-exécuter l'installateur de hooks s'il est ancien).
2. Poser une tâche longue à Claude, passer sur une autre application.
   → notification « Session terminée » à la fin du tour.
3. Cliquer la notification → la fenêtre revient, sur le bon projet, panneau ouvert,
   onglet claude actif.
4. Lancer une commande demandant une permission, fenêtre en arrière-plan.
   → notification « Claude pose une question ».
5. Fenêtre au premier plan, onglet claude visible → aucune notification.
6. Deux projets ouverts : déclencher sur le projet B en regardant le projet A
   → notification, et le clic bascule bien de projet.
7. Regarder le terminal : aucun caractère parasite à la fin d'un tour.
