---
{
  "status": "closed",
  "title": "Terminal du cockpit : vrai shell au lieu de `claude` seul",
  "opened": "2026-08-08",
  "closed": "2026-08-08",
  "commits": []
}
---

# Terminal du cockpit : vrai shell au lieu de `claude` seul

## Contexte

Le panneau terminal de l'app Electron lance `claude` directement, sans shell
(`electron/pty.js:90`). Deux conséquences visibles à l'écran :

1. **Les hooks de Claude Code échouent** : `SessionStart:startup hook error —
   /bin/sh: node: command not found`. Une app GUI macOS lancée depuis le Finder
   hérite d'un PATH minimal (`/usr/bin:/bin:/usr/sbin:/sbin`). `pty.js` passe
   `process.env` tel quel au pty, donc `claude` — et les `/bin/sh -c "node …"`
   qu'il lance — ne trouvent ni `node` ni rien d'installé via brew/nvm/mise.
   Le contournement actuel (`CANDIDATES` + `zsh -lic command -v claude`,
   `pty.js:26-58`) résout le chemin du binaire mais **pas** l'environnement
   qu'il reçoit.
2. **Ce n'est pas un terminal.** Quand Claude quitte, la session meurt. On ne
   peut ni lancer `git`, ni relancer `claude`, ni rien taper d'autre.

Décision prise : le panneau devient un **terminal complet**. La règle « le
cockpit ne lance rien d'autre que `claude` » est abandonnée — assumée, pas
oubliée : la doc doit cesser de l'affirmer.

Résultat visé : `$SHELL -l` dans le pty, `claude` tapé automatiquement au
démarrage. Le shell de connexion source `~/.zprofile`/`~/.zshrc`, donc le PATH
est le vrai, donc les hooks marchent. Quitter Claude rend la main à zsh au lieu
de tuer le panneau.

## Modifications

### `electron/pty.js` — cœur du changement

- **Supprimer** `PROGRAM`, `CANDIDATES`, `resolved`, `findProgram()` et
  l'import `execFileSync` (lignes 11-58). Plus de résolution de binaire : le
  shell s'en charge.
- Résoudre le shell : `process.env.SHELL` si présent et `existsSync`, sinon
  `/bin/zsh`. Args `['-l']` — pas de `-i`, le pty est déjà un tty, zsh est
  interactif d'office.
- `spawn(shell, ['-l'], {...})` en gardant `cwd: projectPath` et la validation
  existante de `projectPath` (`pty.js:75`, à conserver telle quelle).
- Environnement passé au pty :
  - garder `...process.env`,
  - `TERM: 'xterm-256color'`, `COLORTERM: 'truecolor'`,
  - `LANG: process.env.LANG ?? 'fr_FR.UTF-8'` (absent des apps GUI ; sans lui
    les caractères de cadre de Claude sortent cassés),
  - **retirer** `ELECTRON_RUN_AS_NODE` et `NODE_OPTIONS` de l'objet — Electron
    les injecte et ils cassent tout `node` enfant.
- Lancer `claude` : au **premier** `onData` de la session, écrire `'claude\n'`
  puis désarmer le drapeau. Écrire avant que zsh ait fini de sourcer ses rc
  fait perdre la ligne avec certains prompts (p10k instant prompt,
  zsh-autosuggestions). Une ligne de garde :

  ```js
  let primed = false
  pty.onData(data => {
    if (!primed) { primed = true; pty.write('claude\n') }
    if (!sender.isDestroyed()) sender.send('pty:data', id, data)
  })
  ```

- Le message d'erreur de `openSession` ne parle plus de `claude introuvable`
  mais du shell (`impossible d'ouvrir un shell : …`).
- Adapter le commentaire d'en-tête du fichier (lignes 1-9) : il décrit
  précisément la règle qu'on abandonne.

### `electron/preload.cjs`

Aucun changement de surface (`open/write/resize/close/listen` inchangés), mais
corriger le commentaire lignes 1-12 : « le programme lancé est décidé dans
`pty.js` » reste vrai, « aucune fonction n'accepte de nom de programme » aussi
— seule la phrase implicite « donc rien d'arbitraire ne s'exécute » tombe.

### `app/src/Terminal.tsx`

- Ligne ~231 : le texte d'aide « Un clic écrit dans la session. Le cockpit ne
  lance rien d'autre que claude. » devient quelque chose comme « Un clic écrit
  dans la session Claude. »
- Ligne ~116/119 : l'en-tête « Terminal · claude » et le `title` peuvent rester
  ou devenir « Terminal », au choix — cosmétique.
- Ligne ~252 : le faux prompt `$ claude` de l'aperçu navigateur reste juste.

### `app/src/useTerminal.ts`

- `fontFamily: 'ui-monospace, SFMono-Regular, monospace'` (ligne 62) : passer
  `Menlo` en tête. `ui-monospace`/SF Mono rend mal les caractères de cadre que
  Claude utilise pour ses encadrés — visible sur la capture. Un mot changé.
- Le reste (fit, ResizeObserver, injection) est correct, ne pas y toucher.

### Documentation — la doc affirme le contraire de ce qu'on fait

- `README.md` : la section qui justifie l'IPC par « toute exécution est limitée
  à Claude » doit dire ce qui est vrai maintenant : le terminal est un vrai
  shell, l'isolation IPC empêche qu'un **autre processus** de la machine s'y
  branche (contrairement à un socket local), pas que l'utilisateur y tape ce
  qu'il veut.
- `cockpit/plans/2026-08-08-cockpit-routage-des-onglets-puis-coquille-electron-v1-1.md` :
  la décision « pas de shell dans le pty ; le cockpit n'exécute jamais rien
  d'autre que la session Claude » est renversée. L'ajouter comme décision
  révisée, avec la raison (PATH minimal des apps GUI → hooks cassés).

## Vérification

1. `pnpm electron` — le panneau doit afficher un prompt zsh, puis `claude` qui
   démarre **sans** ligne `SessionStart:startup hook error`.
2. Dans le terminal du panneau, `Ctrl-C` pour quitter Claude → on doit retomber
   sur un prompt zsh, pas sur « session terminée ». Puis :
   - `node -v` → une version, pas `command not found`
   - `echo $PATH` → contient `/opt/homebrew/bin` (ou l'équivalent de la machine)
   - `claude` → redémarre une session
3. Cliquer un bouton d'injection pendant que Claude tourne → le texte arrive
   dans le prompt de Claude.
4. Redimensionner le panneau (trois dispositions + fenêtre) → pas de grille
   décalée.
5. **Le test qui compte** : `pnpm package`, ouvrir `release/`, monter le DMG et
   lancer `Cockpit.app` **depuis le Finder** (pas depuis un terminal — lancé
   d'un terminal, l'app hérite d'un PATH déjà bon et le bug ne se reproduit
   pas). Refaire les points 1 et 2.
6. `pnpm test` — les 60 tests existants ne touchent pas `pty.js`, ils doivent
   rester verts.

Note : `scripts/fix-pty-permissions.js` (bit exécutable de `spawn-helper`) et
`asarUnpack: node_modules/node-pty/**` restent nécessaires, ne rien y changer.
