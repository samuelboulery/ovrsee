---
{
  "status": "open",
  "title": "Fenêtres multiples + terminaux persistants",
  "opened": "2026-08-13",
  "closed": null,
  "commits": [
    {
      "sha": "cfee865",
      "date": "2026-08-13",
      "files": [
        "app/src/Terminal.tsx",
        "app/src/useTerminal.ts",
        "electron/main.js",
        "electron/menu.js",
        "hooks/i18n.d.ts",
        "hooks/i18n.js"
      ]
    }
  ]
}
---

# Fenêtres multiples + terminaux persistants

## Contexte

Aujourd'hui, une seule fenêtre Electron peut exister (`createWindow()` appelé
une fois au démarrage), et chaque changement de projet via le dropdown détruit
tous les terminaux ouverts (sessions Claude + shells) pour en rouvrir un neuf.
L'utilisateur veut travailler en parallèle : plusieurs projets ouverts dans
plusieurs fenêtres, plusieurs terminaux par projet, sans qu'un changement
d'onglet, de projet ou de fenêtre ne tue une session en cours.

Le changement d'onglet ne pose déjà aucun problème — le panneau `<Terminal>`
est monté hors des conditionnelles d'onglet (`App.tsx:717-730`). Les deux
vrais trous sont : (1) pas de moyen d'ouvrir une deuxième fenêtre, (2) le
changement de projet écrase l'état des sessions au lieu de les mettre en
pause.

## Partie 1 — Fenêtres multiples

**`electron/main.js`**
- Aucun changement de logique fenêtre : `createWindow()` (153-259) reste tel
  quel, `window-all-closed`/`before-quit` → `closeAll()` restent corrects
  (`closeAll()` ne tue les ptys que quand il ne reste plus aucune fenêtre —
  fermer une fenêtre parmi plusieurs ne touche à rien aujourd'hui, c'est déjà
  le bon comportement pour la persistance).
- Passer `createWindow` à `buildMenu()` en paramètre plutôt que de le faire
  importer par `menu.js` : `Menu.setApplicationMenu(buildMenu(readSettings().langue, createWindow))`
  (ligne ~275). Évite un import circulaire main.js ↔ menu.js (`buildMenu` est
  déjà importé par main.js).

**`electron/menu.js`**
- `buildMenu(lang, createWindow)` — nouveau second paramètre.
- Nouvel item dans le menu Fichier, après « Ouvrir un projet » :
  `{ label: m('menu.new_window'), accelerator: 'CmdOrCtrl+N', click: () => createWindow() }`.
  Action directe sur le processus principal (comme `role: 'close'`/`role:
  'quit'`), pas de `send()` vers le rendu — créer une fenêtre n'est pas une
  action que le rendu sait déjà faire.

**`hooks/i18n.js`**
- Ajouter `menu.new_window` aux tables FR (« Nouvelle fenêtre ») et EN
  (« New Window »), à côté des autres clés `menu.*`.

Chaque fenêtre est un processus de rendu séparé : l'état React (`current`,
`tab`, sessions terminal) y est déjà indépendant sans rien à faire de plus.
Deux fenêtres sur le même projet ouvriront simplement deux ptys distincts
(l'identifiant `pty-N` est un compteur global côté main, pas de collision).

## Partie 2 — Persistance des terminaux entre projets

**Le bug** : `app/src/useTerminal.ts:221-232`, l'effet sur `[projectPath]`
fait `setSessions([claudeSlot(projectPath)])` — remplace tout l'état sessions.
Les anciens `<div ref={attach(session)}>` disparaissent du rendu, leur ref
reçoit `null`, et le cleanup de `attach()` (lignes 247-259) ferme le pty et
dispose le xterm. C'est voulu pour une fermeture explicite (`closeShell`), pas
pour un changement de projet.

Le motif qui résout déjà ça *dans* un projet (piler toutes les sessions,
montées en permanence, l'inactive en `opacity: 0` + `inert` — jamais `display:
none` sinon FitAddon mesure une grille fausse, Terminal.tsx:290-317) doit
juste s'étendre *entre* projets.

### `app/src/useTerminal.ts`

Dans `useTerminals(projectPath)`, ajouter trois refs au niveau du hook (comme
`panes`/`counter`/`refs` existants — un seul `<Terminal>` monté dans toute
l'appli, pas besoin de portée module) :

```typescript
const sessionsByProject = useRef(new Map<string, Session[]>())
const activeByProject = useRef(new Map<string, string | null>())
```

`panes` devient la collection cross-projet (renommer en `allPanes` pour
lisibilité, ou garder `panes` — il contient déjà toutes les clés sans
collision puisque `session.key` porte le chemin du projet).

**Effet de changement de projet (remplace 219-232)** : au lieu d'écraser,
initialise paresseusement l'entrée du projet si absente, puis dérive
`sessions`/`active` à partir du stockage persistant :

```typescript
useEffect(() => {
  if (!projectPath) {
    setSessions([]); setActive(null); claudeSessionId = null; return
  }
  if (!sessionsByProject.current.has(projectPath)) {
    const first = claudeSlot(projectPath)
    sessionsByProject.current.set(projectPath, [first])
    activeByProject.current.set(projectPath, first.key)
  }
  const projectSessions = sessionsByProject.current.get(projectPath) ?? []
  setSessions(projectSessions)
  const wasActive = activeByProject.current.get(projectPath)
  setActive(wasActive && projectSessions.some(s => s.key === wasActive) ? wasActive : claudeSlot(projectPath).key)
  const claude = panes.current.get(claudeSlot(projectPath).key)
  claudeSessionId = claude?.id ?? null
  setErrors({})
}, [projectPath])
```

**`attach()`** : les deux endroits qui touchent `panes.current` restent
inchangés de forme — c'est déjà une Map non bornée par projet, seule la
garde `if (panes.current.has(session.key) || !projectPath) return` empêche
la recréation. Ajouter une garde de course : dans le callback de résolution
de `bridge.open()` (ligne ~299-315), ne pointer `claudeSessionId` que si le
projet de cette session est toujours celui affiché — sinon un changement de
projet pendant l'ouverture d'une session pourrait faire écrire `injectToClaude`
dans la mauvaise session. Garder une `const activeProjectRef = useRef(projectPath)`
mise à jour dans l'effet ci-dessus, et vérifier `activeProjectRef.current ===
projectPath` avant `claudeSessionId = result.id`.

**`openShell()`** : après `setSessions`, répercuter dans le stockage
persistant — lire depuis `sessionsByProject.current.get(projectPath)` (pas
depuis le state `sessions`, potentiellement périmé dans la closure), pas
`sessions.concat(...)`.

**`closeShell()`** : même répercussion — filtrer aussi
`sessionsByProject.current.get(projectPath)`. Le reste de la logique
(fermeture immédiate via le cleanup de `attach`) ne change pas : fermer un
shell doit toujours le tuer pour de bon, persistance ou pas.

**`focusClaude()`** : inchangé dans sa forme, continue de lire `panes.current`.

**`setActive`** : envelopper pour répercuter dans `activeByProject` à chaque
changement (le retour du hook expose ce wrapper sous le nom `setActive`, sans
changer sa signature côté appelant) :

```typescript
const handleSetActive = useCallback((key: string | null) => {
  setActive(key)
  if (projectPath && key) activeByProject.current.set(projectPath, key)
}, [projectPath])
```

**Retour du hook** : exposer en plus `allSessions` — union de toutes les
sessions de tous les projets visités, pour garder leurs divs montées même
hors du projet courant :

```typescript
const allSessions = Array.from(sessionsByProject.current.values()).flat()
return { sessions, allSessions, active, setActive: handleSetActive, attach, openShell, closeShell, errors, focusClaude, claudeKey, available }
```

**Commentaires à réécrire** (155-157, 219-220) : ils documentent le
« changer de projet ferme tout » actuel — à remplacer par une explication du
nouveau comportement (sessions gardées vives, ré-affichées au retour).

### `app/src/Terminal.tsx`

- Déstructurer `allSessions` en plus de `sessions` (ligne 95-106).
- La barre de pastilles (207-244) continue de mapper sur `sessions` (projet
  courant seulement) — inchangé.
- Les divs montées pour xterm (298-316) mappent sur `allSessions` au lieu de
  `sessions`, pour que les sessions des autres projets restent montées
  (invisibles, `inert`) au lieu de se démonter.
- Mettre à jour le commentaire 293-296 pour mentionner que des sessions
  d'autres projets restent vivantes hors-écran.

### Accumulation

Chaque projet visité dans la durée de vie d'une fenêtre garde ses sessions en
mémoire tant qu'elles ne sont pas fermées explicitement ou que la fenêtre ne
quitte pas. Pas de plafond ni d'éviction — usage typique de quelques projets
par session, pas besoin d'une politique de nettoyage pour ce cas d'usage.

## Fichiers touchés

1. `electron/main.js` — passer `createWindow` à `buildMenu`
2. `electron/menu.js` — item de menu « Nouvelle fenêtre », `CmdOrCtrl+N`
3. `hooks/i18n.js` — clé `menu.new_window` (FR/EN)
4. `app/src/useTerminal.ts` — stockage par projet, refs cross-projet, garde de course sur `claudeSessionId`
5. `app/src/Terminal.tsx` — rendu des divs xterm sur `allSessions`

## Vérification

Pas de couverture automatisée possible pour l'interaction xterm/pty (`pnpm
test` ne fait que vérifier qu'aucun composant ne lève). Vérification manuelle
via `pnpm electron` :

1. **Fenêtres** : Fichier → Nouvelle fenêtre (ou ⌘N) ouvre une deuxième
   fenêtre indépendante ; projets différents dans chaque fenêtre ; fermer une
   fenêtre laisse l'autre intacte.
2. **Persistance** : ouvrir projet A, lancer une commande dans Claude,
   ouvrir un shell et y taper quelque chose ; basculer vers projet B via le
   dropdown ; revenir sur A — la session Claude et le shell doivent avoir
   gardé leur contenu (scrollback) et rester réactifs, pas redémarrés.
3. **Fermeture explicite** : le × sur un onglet shell le ferme bien pour de
   bon (ne réapparaît pas en changeant de projet puis en revenant).
4. **Onglets** : basculer entre les 7 onglets de l'appli ne doit toujours
   rien casser côté terminal (déjà le cas, à re-vérifier après le refactor).
