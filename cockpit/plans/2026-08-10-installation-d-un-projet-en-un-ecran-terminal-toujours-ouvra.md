---
{
  "status": "closed",
  "title": "Installation d'un projet en un écran, terminal toujours ouvrable",
  "opened": "2026-08-10",
  "closed": "2026-08-10",
  "commits": [
    {
      "sha": "8371369",
      "date": "2026-08-10",
      "files": [
        "app/src/EquipmentPanel.tsx",
        "app/src/Terminal.tsx",
        "app/src/data.ts",
        "app/src/i18n.test.ts",
        "electron/main.js",
        "electron/pty.js",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/install-options.test.js",
        "hooks/install.js",
        "server/api.js",
        "server/api.test.js"
      ]
    }
  ]
}
---

# Installation d'un projet en un écran, terminal toujours ouvrable

## Contexte

Équiper un projet depuis l'application est aujourd'hui une impasse circulaire.

`app/src/EquipmentPanel.tsx:176` grise le bouton « Initialiser » dès qu'un
prérequis manque — pas de dépôt git, pas de lockfile, pas de
`cockpit.config.json`. Ces prérequis se règlent en tapant des commandes… dans le
terminal. Or `electron/pty.js:96` refuse d'ouvrir une session tant que
`<projet>/cockpit` n'existe pas : *« ce dossier n'est pas un projet suivi par le
cockpit »*. On ne peut donc ni équiper depuis l'écran, ni débloquer depuis le
terminal.

Troisième conséquence, celle qui a déclenché la demande : `cockpit.config.json`
n'est **jamais** écrit par l'application. `crawl/index.js:50` en fait une
condition d'entrée — sans lui, aucun projet fraîchement équipé ne peut être
crawlé.

Résultat visé : un écran, des options qu'on coche et qu'on remplit, un bouton, et
une installation qui va jusqu'au projet crawlable. Le terminal reste ouvrable à
tout moment ; l'absence de `cockpit/` devient un avertissement, pas un refus.

---

## 1. Le terminal s'ouvre pour tout projet du registre

**`electron/main.js:270`** — la garde monte dans le gestionnaire IPC, exactement
comme `projects:reveal` le fait déjà à la ligne 371. `projects` y est déjà
importé (`main.js:31`) : aucun fichier nouveau, aucune dépendance nouvelle.

```js
ipcMain.handle('pty:open', (event, projectPath, kind) => {
  // Le registre, et pas la présence d'un `cockpit/` : ouvrir un terminal sur un
  // projet qu'on vient d'ajouter est la seule façon d'y installer quoi que ce
  // soit. Ce qui doit rester impossible, c'est qu'un rendu compromis lance un
  // shell dans un dossier que l'utilisateur n'a jamais désigné — même liste
  // blanche que `projects:reveal`.
  if (typeof projectPath !== 'string' || !projects(null).some(p => p.path === projectPath)) {
    return { error: "ce dossier n'est pas dans la liste des projets du cockpit" }
  }
  return openSession(event.sender, projectPath, kind)
})
```

**`electron/pty.js:93-98`** — la vérification `cockpit/` disparaît ; la garde
« c'est bien un dossier existant » reste (défense en profondeur, et `spawn` sur
un chemin disparu échouerait moins clairement).

Rien à extraire pour tester : `projects()` est déjà couvert par les tests de
`hooks/snapshot.js`, et `electron/` n'est pas une couche testée dans ce projet.

**Avertissement dans le terminal** — `app/src/Terminal.tsx`, dans le panneau
latéral au-dessus de la section « Commandes », dans le style d'encadré déjà
utilisé pour les erreurs d'actions (`Terminal.tsx:362-377`). Condition :
`snapshot && !snapshot.equipped`. Texte : « Ce projet n'a pas encore de
`cockpit/` — les plans et les commits ne seront pas capturés. »

---

## 2. `install()` prend des options

**`hooks/install.js:197`** — signature élargie, ordre des étapes imposé :

```js
export function install(target, { skills = [], gitInit = false, commit = false, config = null } = {})
```

1. `gitInit` → `execFileSync('git', ['init'], { cwd: resolve(target) })`
2. `root = git rev-parse --show-toplevel` (inchangé — lève si toujours pas un dépôt)
3. `commit` → `git add -A` puis `git commit`, **dans un try/catch** : sans
   identité git configurée la commande échoue, et ça ne doit pas faire échouer
   l'installation. L'échec part dans `done` en clair.
4. `cockpit/plans/`, `cockpit/tickets/`, `board.json` (inchangé)
5. `config` → `writeCockpitConfig(root, config)`
6. `installPostCommit`, `installClaudeHooks`, `installSkills` (inchangé)

**L'ordre 3 avant 6 n'est pas cosmétique.** `hooks/cockpit-post-commit.js:89`
lance un **crawl détaché** — c'est-à-dire le serveur de dev du projet observé —
dès qu'un commit touche des sources et qu'un `cockpit.config.json` existe.
Committer après avoir posé le hook et la config déclencherait ce crawl dans la
seconde qui suit le clic, sur un projet dont les dépendances ne sont peut-être
même pas installées. Committer d'abord, poser le hook ensuite : le point de
départ est créé, rien ne se lance.

**`writeCockpitConfig(root, {dev, baseUrl})`**, nouvelle fonction dans
`hooks/install.js` :

- si `cockpit.config.json` existe → **ne rien écrire**, pousser une ligne dans
  `done` (« conservé tel quel »). Pas d'exception : `install()` est réexécutable
  et doit le rester. Le fichier porte aussi les surcharges de préférences lues
  par `hooks/settings.js:201 mergeSettings` — l'écraser perdrait des réglages
  sans rapport avec le crawl ;
- sinon écrire `{ dev, baseUrl, entryRoutes: ['/'] }` via
  `writeFileNoFollow` (`hooks/plans.js`), les trois champs explicitement — un
  fichier vide « parce que ça vaut les défauts » serait illisible pour qui
  l'ouvre. Le reste vient des `DEFAULTS` de `crawl/index.js:32`.

---

## 3. Détection des valeurs par défaut

**`server/api.js:56 getFolderState`** gagne un champ `defaults`, pour que le
formulaire arrive pré-rempli plutôt que vide :

```js
function detectDefaults(root) {
  const pkg = readJson(join(root, 'package.json'))
  const dev = pkg?.scripts?.dev ? `${gestionnaire} dev` : 'pnpm dev'
  const port = /(?:--port|-p)[= ](\d{4,5})/.exec(pkg?.scripts?.dev ?? '')?.[1]
    ?? (/\bnext\b/.test(pkg?.scripts?.dev ?? '') ? '3000' : '5173')
  return { dev, baseUrl: `http://localhost:${port}` }
}
```

Heuristique courte et assumée : `package.json` → script `dev`, port lu dans le
script sinon 3000 pour Next, 5173 sinon. Marquer la limite d'un commentaire
`ponytail:` — un projet non-JS retombe sur les valeurs par défaut, que le
formulaire laisse corriger.

`app/src/data.ts:527 FolderState` gagne `defaults: { dev: string; baseUrl: string }`.

---

## 4. Validation côté serveur

**`server/api.js:138`, cas `init`** — les options viennent du rendu :

```js
const conf = body?.config
const config = conf && typeof conf === 'object' && !Array.isArray(conf)
  ? {
      dev: typeof conf.dev === 'string' && conf.dev.trim() && !/[\r\n]/.test(conf.dev)
        && conf.dev.length <= 300 ? conf.dev.trim() : null,
      baseUrl: typeof conf.baseUrl === 'string' && /^https?:\/\/\S+$/.test(conf.baseUrl)
        && conf.baseUrl.length <= 300 ? conf.baseUrl : null,
    }
  : null
if (config && (!config.dev || !config.baseUrl)) {
  return { status: 400, json: { error: 'config invalide : dev et baseUrl requis' } }
}
```

`gitInit`, `commit`, `obsidian` : `=== true`, rien d'autre.

**Ce que cette validation vise et ce qu'elle ne vise pas.** `dev` finit dans
`spawn(config.dev, { shell: true })` (`crawl/index.js:148`) : c'est une commande
shell, et ça le restera — c'est le sens du champ, exactement comme éditer
`cockpit.config.json` à la main. La validation ne prétend donc pas assainir un
shell. Elle ferme deux choses réelles : un `baseUrl` qui n'est pas une URL http
(que `crawl/index.js:55` refuserait de toute façon, mais plus tard et moins
clairement), et une valeur non-chaîne qui ferait écrire un JSON absurde. La
barrière qui compte contre une page tierce reste l'en-tête `X-Cockpit`
(`server/api.js:237`) et le registre comme liste blanche.

**L'export Obsidian s'orchestre dans `api.js`, pas dans `install()`** :
`exportVault` y est déjà importé et `export-obsidian` en est déjà une action.

```js
const done = install(path, { skills: body?.skills, gitInit, commit, config })
if (body?.obsidian === true) done.push(...exportVault(path))
```

---

## 5. `EquipmentPanel.tsx` — un écran, un bouton

Réécriture de `app/src/EquipmentPanel.tsx` (193 lignes → ~330, un seul fichier,
pas d'extraction : on reste dans la fourchette de `CLAUDE.md`).

**Ce qui disparaît** : `disabled={… || missingPrereq.length > 0}` (ligne 176).
Aucun prérequis ne grise plus le bouton.

**Ce qui reste** : l'encadré bootstrap (mais devenu secondaire, puisque le
terminal s'ouvre maintenant), la liste `SkillsList` (`SkillsPanel.tsx`), le
résumé « L'initialisation écrit : », l'affichage de `done`.

**Ce qui arrive** — une carte unique « Options d'initialisation », dans l'idiome
existant (`s()`, classes `btn` / `btn-ghost`, jetons `--color-*`) :

| Ligne | Type | Affichée quand |
|---|---|---|
| Créer le dépôt git (`git init`) | case à cocher | `!state.isGit` |
| Commande de démarrage | champ texte, pré-rempli `state.defaults.dev` | `!state.hasConfig` |
| URL de base | champ texte, pré-rempli `state.defaults.baseUrl` | `!state.hasConfig` |
| Premier commit après l'installation | case à cocher | toujours |
| Exporter un coffre Obsidian | case à cocher | toujours |
| Skills à installer | `SkillsList` existant | `skills.length > 0` |
| Graphify — le cockpit ne le lance jamais | ligne informative + bouton `/graphify` | toujours |

Le bouton Graphify réutilise `pasteToClaude` + `decideInjection` déjà employés
par `envoyerBootstrap` (`EquipmentPanel.tsx:21-39`) : il **écrit sans envoyer**,
comme tous les boutons du terminal.

Sous les champs de config, une phrase qui ne se devine pas : *« Écrire cette
configuration active aussi le crawl automatique après chaque commit touchant les
sources. »* C'est vrai (`cockpit-post-commit.js:114`) et ça ne se lit nulle part
ailleurs.

Les prérequis manquants deviennent un encadré d'avertissement au-dessus du
bouton — informatif, jamais bloquant. `equipment.missing_lockfile` et
`equipment.missing_config` restent ; `missing_config` disparaît de la liste
quand la case config est cochée, puisqu'elle va être écrite.

L'état du formulaire : un seul `useState` objet
`{ gitInit, commit, obsidian, ecrireConfig, dev, baseUrl }`, initialisé depuis
`state.defaults` dans un `useEffect` sur `state`.

---

## 6. i18n

Ajouts dans **les deux blocs** de `hooks/i18n.js`, puis dans la liste de clés de
`app/src/i18n.test.ts` (elle est écrite à la main et vérifie la parité fr/en) :

```
equipment.options_title      equipment.opt_git_init
equipment.opt_commit         equipment.opt_obsidian
equipment.opt_config         equipment.field_dev
equipment.field_base_url     equipment.config_crawl_note
equipment.graphify_note      equipment.graphify_send
equipment.warnings_title
terminal.not_equipped
```

`equipment.bootstrap_*` et `equipment.prerequisites_title` sont conservées.

---

## 7. Tests (`node:test` / `node:assert`, aucun framework)

**`hooks/install.test.js`** — le fichier ne couvre aujourd'hui que le bloc
post-commit. Ajouter, avec des dépôts jetables sous `mkdtempSync` :

- `install(dir, { gitInit: true })` sur un dossier nu → `.git/` existe, `cockpit/plans/` aussi ;
- `install(dir, { config })` → `cockpit.config.json` contient les trois champs ;
- config déjà présente → contenu **inchangé**, et `done` le dit ;
- `install(dir, { commit: true })` → `git log` a un commit, et
  `.git/hooks/post-commit` n'existait pas encore au moment de ce commit
  (assertion sur l'ordre : le commit ne contient pas `cockpit/`) ;
- `commit: true` sans identité git → `install` ne lève pas, `done` porte l'échec.

**`server/api.test.js`** — dans le style des tests `init` / `state` existants :

- `init` avec `gitInit`/`config`/`commit` → 200, fichiers en place ;
- `config` sans `baseUrl`, avec `baseUrl` non-http, avec un `dev` multiligne → 400 ;
- `state` rend `defaults.dev` / `defaults.baseUrl` détectés depuis un
  `package.json` porteur d'un script `dev`.

**`app/src/`** — les tests d'interface ne font que du rendu sur instantané
dégradé ; ajouter `EquipmentPanel` à ce rendu s'il n'y est pas, pour vérifier
qu'il ne lève pas quand `state` est `null`.

---

## 8. Vérification

Automatique :

```bash
pnpm test        # hooks/ crawl/ server/ mcp/ puis app/src compilé
pnpm typecheck   # ne couvre que app/src
```

À la main, dans l'application — c'est le seul moyen de prouver que l'impasse
est levée, `electron/` n'étant pas testé :

1. `mkdir /tmp/essai-cockpit && echo '# essai' > /tmp/essai-cockpit/README.md`
   (dossier nu, **pas** un dépôt git).
2. `pnpm electron`, ajouter le projet par le sélecteur.
3. **Ouvrir le terminal** → une session s'ouvre, avec l'encadré
   « pas encore de `cockpit/` ». C'est le point qui échouait.
4. Sur l'écran d'équipement : cocher `git init`, cocher premier commit, laisser
   `dev`/`baseUrl` pré-remplis, cocher un skill. Un clic.
5. Vérifier sur le disque : `.git/`, `cockpit/plans/`, `cockpit/tickets/`,
   `cockpit/board.json`, `cockpit.config.json`, le bloc cockpit dans
   `.git/hooks/post-commit`, et `git log` avec un commit.
6. Vérifier qu'**aucun** processus de crawl n'a été lancé par ce premier commit
   (`ps aux | grep crawl/index.js` vide) — c'est l'ordre des étapes qui le garantit.
7. Relancer l'installation sur le même projet → rien n'est écrasé,
   `cockpit.config.json` est signalé « conservé tel quel ».
8. `pnpm package` pour reconstruire le DMG (le terminal ne se vérifie
   réellement qu'empaqueté : `node-pty` est un binaire natif déballé de l'asar).

---

## Fichiers touchés

- `electron/main.js` — garde `pty:open` sur le registre
- `electron/pty.js` — retrait de la garde `cockpit/`
- `hooks/install.js` — options `gitInit` / `commit` / `config`, `writeCockpitConfig`
- `server/api.js` — validation des options, `detectDefaults`, orchestration Obsidian
- `hooks/i18n.js` — clés fr + en
- `app/src/EquipmentPanel.tsx` — réécriture de l'écran
- `app/src/Terminal.tsx` — encadré « projet non équipé »
- `app/src/data.ts` — `FolderState.defaults`
- `hooks/install.test.js`, `server/api.test.js`, `app/src/i18n.test.ts` — tests
