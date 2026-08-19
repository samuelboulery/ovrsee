---
{
  "status": "open",
  "title": "Rendre l'ovrsee utilisable sans cloner le dépôt",
  "opened": "2026-08-19",
  "closed": null,
  "commits": []
}
---

# Rendre l'ovrsee utilisable sans cloner le dépôt

## Contexte

Trois plaintes, une cause commune : **l'application packagée n'embarque pas le crawl**,
donc tout ce qui touche à la cartographie oblige à cloner le dépôt et à y lancer `pnpm`.

1. **Le README ne dit pas qu'on peut ne pas cloner.** « Quick start » ouvre sur
   `pnpm ovrsee:install` (README.md:107) et la section « Download » arrive en onzième
   position (README.md:221), après « Architecture ». Un lecteur en déduit que le dépôt
   cloné est le mode normal.

2. **Le crawl ne se lance que depuis le dossier ovrsee.** Le raccourci du terminal
   injecte `!pnpm ovrsee:crawl` **sans chemin de projet**
   (`app/src/data.ts:1441`) dans un shell dont le `cwd` est le projet observé
   (`electron/pty.js:122`) — où ce script n'existe pas. Il faut donc revenir dans le
   dépôt ovrsee et taper `pnpm ovrsee:crawl /chemin/du/projet`.

3. **Le bouton « Crawl » ne crawle pas.** Il copie la commande dans le presse-papier
   (`app/src/tabs/Produit.tsx:262-284`).

4. **Aucun moyen d'écrire `ovrsee.config.json` depuis l'interface une fois le projet
   équipé.** `EquipmentPanel.tsx` sait le faire, mais il ne s'affiche que si
   `isUnequipped(snapshot)` (`app/src/App.tsx:621`). Un projet qui a un `ovrsee/` mais
   pas de config n'a plus aucun chemin — d'où le « configuration absente : … » que le
   crawl écrit dans `ovrsee/pages/scans.jsonl` (`crawl/index.js:52`) à chaque tentative.

**Résultat visé :** on télécharge le DMG, on désigne un projet, on remplit deux champs,
on clique sur Crawl, et on voit le scan avancer. Le dépôt cloné ne sert plus qu'à
contribuer.

## L'invariant, respecté

L'application continue de ne lire que `<repo>/ovrsee/` et de n'écrire que dans
`ovrsee/tickets/`, `ovrsee/board.json` et `ovrsee.config.json`. Le crawl est le seul
programme qu'elle exécute, et c'est **son** crawl, jamais du code du projet observé —
sauf la commande `dev` du fichier de config, que l'utilisateur a écrite lui-même et qui
est déjà exécutée aujourd'hui par le hook post-commit (`hooks/ovrsee-post-commit.js:208`).

Le lancement passe par **IPC Electron**, jamais par `/api/*` : cette route est aussi
servie par le dev server Vite en HTTP local non authentifié, et faire démarrer un
processus depuis là l'ouvrirait à tout ce qui tourne sous le même compte. Même
arbitrage que le terminal et que les secrets d'intégration.

---

## 1. Embarquer le crawl et le MCP dans l'application packagée

**`electron-builder.yml`** — ajouter aux `files:` :

```yaml
  - crawl/**
  - mcp/**
  - node_modules/playwright-core/**
```

`playwright-core` pèse 13 Mo et n'a **aucune dépendance transitive** (vérifié :
`dependencies: {}`). `chromium.launch({ channel: 'chrome' })` (`crawl/index.js:321`)
pilote le Chrome déjà installé sur la machine — rien à télécharger au premier lancement.
`mcp/` n'importe que du Node natif, `server/api.js` et `hooks/brief.js`, tous deux déjà
embarqués.

`asarUnpack` : à confirmer à l'exécution du DMG (voir Vérification). En principe inutile,
parce que le programme lancé n'est pas `node` mais le binaire Ovrsee en mode node — qui
sait lire l'archive. C'est exactement ce que `hooks/install.js:60-73` documente déjà pour
le hook post-commit. Si `playwright-core` bute sur un chemin d'asar au lancement du
navigateur, l'y ajouter et rien d'autre.

## 2. Lancer le crawl depuis l'interface

### Processus principal — `electron/crawl.js` (nouveau)

Fichier neuf plutôt qu'un ajout à `main.js` : même découpage que `pty.js` et `tray.js`.

```js
const CRAWLER = join(dirname(fileURLToPath(import.meta.url)), '..', 'crawl', 'index.js')

// Même parade que `commandFor()` dans hooks/install.js : `process.execPath` est
// le binaire Ovrsee, pas node. ELECTRON_RUN_AS_NODE=1 le fait se comporter en
// node — et lui seul sait lire app.asar.
spawn(process.execPath, [CRAWLER, projectPath], {
  cwd: projectPath,
  detached: true,          // groupe de processus propre : voir l'annulation
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
```

Un crawl à la fois **par projet** : `Map<projectPath, {child, lines}>`. Une demande sur
un projet déjà en cours rend l'état courant au lieu d'en lancer un second.

Le fil stdout se découpe en lignes ; chaque `[crawl] …` (`crawl/index.js:48` — seule
sortie du crawler) devient un événement de progression. La dernière ligne est retenue,
pour que `pull` puisse la resservir.

**Annulation** : `process.kill(-child.pid, 'SIGTERM')`. Le signe moins n'est pas un
détail — le crawl a lui-même démarré le serveur de dev du projet (`config.dev`), et tuer
le seul processus fils le laisserait tourner. `detached: true` lui donne le groupe qui
rend ça possible.

**Fermeture de la fenêtre** : tuer les crawls en cours dans `before-quit`, même geste.

### Surface IPC — `electron/preload.cjs`

```js
crawl: {
  /** @param {string} projectPath vérifié contre le registre côté principal */
  start:  projectPath => ipcRenderer.invoke('crawl:start', projectPath),
  stop:   projectPath => ipcRenderer.invoke('crawl:stop', projectPath),
  listen(handler) {
    const relais = (_event, etat) => handler(etat)
    ipcRenderer.on('crawl:state', relais)
    // L'état courant sans attendre le prochain signal — même motif que
    // `menubar:listen` : un onglet remonté après un changement de projet
    // s'afficherait sinon inerte alors qu'un crawl tourne.
    ipcRenderer.invoke('crawl:pull').then(handler)
    return () => ipcRenderer.off('crawl:state', relais)
  },
}
```

Elle respecte la règle de l'en-tête de `preload.cjs` : **aucun nom de programme, aucun
chemin de programme n'entre depuis le rendu**. Ce qui est lancé est décidé dans
`crawl.js` ; le rendu ne fournit qu'un chemin de projet, et `main.js` le vérifie contre
le registre exactement comme `pty:open` le fait (`electron/main.js:325-327`).

Forme de l'état : `{ running: boolean, project: string|null, line: string|null }`.

Trois raccourcis tentants, écartés :

- **Ne pas** passer `snapshot.config` depuis le rendu à `crawl.start`. Le crawler lit le
  fichier lui-même (`crawl/index.js:50`) ; le lui envoyer ferait entrer une commande
  shell (`dev`) par l'IPC, ce que l'en-tête de `preload.cjs` interdit précisément.
- **Ne pas** tester `baseUrl` par un `fetch` avant de lancer. Le crawl refuse déjà ce cas
  et écrit pourquoi ; un pré-test dupliquerait la règle et se tromperait un jour.
- **Ne pas** se contenter de `child.kill()`. Sans le groupe, le serveur de dev survit.

**Pas d'erreur à faire remonter par IPC** : `crawl/index.js` écrit déjà tout échec dans
`ovrsee/pages/scans.jsonl` et sort en code 0 (fin de `crawl/index.js`). L'interface sait
déjà lire ça — `scanFailed(snapshot.scans)` est utilisé en `Produit.tsx:70`. À la fin du
crawl, le rendu recharge le snapshot, et le message d'échec — « configuration absente »
compris — apparaît par le chemin qui existe déjà.

### Rendu — `app/src/tabs/Produit.tsx`

`Produit` reçoit un `onReload` de plus, comme `Apercu` en a déjà un
(`App.tsx:641`). `CrawlButton` (l.262) devient trois états, dans cet ordre de garde :

| Condition | Ce que montre le bouton |
|---|---|
| `!window.ovrsee` (navigateur) | comportement actuel — copie la commande |
| `snapshot.config === null` | « Configurer le crawl » → formulaire (§3) |
| crawl en cours | libellé de progression + « Arrêter » |
| sinon | « Crawler » → `crawl.start(snapshot.root)` |

`snapshot.config` porte déjà le `ovrsee.config.json` parsé, ou `null`
(`hooks/snapshot.js:403,420`) : **aucune route ni aucun champ d'API à ajouter** pour
savoir si la config manque.

Les deux points de montage du bouton (l.100 dans l'état vide, l.125 dans l'en-tête)
restent les mêmes.

### Le raccourci cassé du terminal

`deliveredActions()` (`app/src/data.ts:1436-1452`) livre `!pnpm ovrsee:crawl` **sans
chemin**, injecté dans une session dont le `cwd` est le projet observé : cette commande
n'y existe pas. Elle sert le panneau terminal *et* la palette ⌘K
(`CommandPalette.tsx:113`).

La retirer de `deliveredActions` — le bouton fait désormais le travail, et pour de vrai.
Il reste les deux actions Graphify. À reprendre en conséquence :
`app/src/data.test.ts:490, 511, 531` (qui attendent le crawl en première position) et
`hooks/i18n.js` (`action.crawl`, fr et en).

## 3. Écrire `ovrsee.config.json` sur un projet déjà équipé

Formulaire inline dans l'en-tête de Produit, ouvert par le bouton quand
`snapshot.config === null` : deux champs, `dev` et `baseUrl`, puis

```ts
projectAction('init', snapshot.root, { config: { dev, baseUrl } })
```

`install()` (`hooks/install.js:371`) est idempotent et **n'écrase jamais** un
`ovrsee.config.json` existant (l.335-341) — l'appeler sur un projet équipé ne réécrit ni
les hooks ni le tableau.

Réemplois, rien de neuf à écrire :

- `Champ` de `EquipmentPanel.tsx` — extrait dans un module partagé, avec le
  sous-formulaire des deux champs, pour que le panneau d'équipement et Produit servent
  le même code.
- `detectDefaults(root)` (`server/api.js:78-83`) donne déjà `{dev, baseUrl}` pré-remplis ;
  il est servi par l'action `'state'` de `/api/projects`.
- `projectAction` de `app/src/data.ts`.

Après succès : `onReload()`, la config apparaît dans le snapshot, le bouton redevient
« Crawler ».

## 4. README — l'application d'abord, le dépôt ensuite

Même remaniement dans `README.md` (source) et `README.fr.md`.

- **Fusionner « Download » (README.md:221) dans « Quick start » (l.107)** et remonter le
  tout juste après « First launch ». C'est le seul changement qui compte : l'ordre de
  lecture actuel enseigne le contraire de ce qui est vrai.
- Deux chemins nommés, sans ambiguïté :
  - **Installer l'application** — Releases, contournement Gatekeeper/SmartScreen, puis
    *tout se fait dans l'interface* : désigner le projet, l'écran d'équipement écrit
    `ovrsee/`, les hooks et `ovrsee.config.json`, le bouton Crawler cartographie. Aucune
    commande, aucun clone, aucun `pnpm`.
  - **Depuis les sources** — pour contribuer : clone, `pnpm install`, `pnpm electron`.
    C'est là que vivent `pnpm ovrsee:*` et `pnpm package:*`.
- **Serveur MCP** (README.md:293) : ajouter la commande pour l'application installée, à
  côté de celle du dépôt cloné. C'est la forme que `commandFor()` produit déjà :

  ```
  ELECTRON_RUN_AS_NODE=1 /Applications/Ovrsee.app/Contents/MacOS/Ovrsee \
    /Applications/Ovrsee.app/Contents/Resources/app.asar/mcp/server.js
  ```
- Retirer des « Known Traps » / « Pièges connus » ce qui devient faux, et y noter ce qui
  devient vrai : le crawl embarqué exige **Google Chrome installé** (`channel: 'chrome'`).

## 5. `CLAUDE.md`

Trois entrées à corriger, sinon la prochaine session repartira sur l'ancien monde :

- « le terminal passe par IPC Electron » → dire que le **crawl** aussi, et pourquoi
  (même raison, et surtout pas `/api/*`).
- Le tableau des couches : `crawl/` et `mcp/` sont désormais embarqués dans le paquet.
- Nouveau piège : annuler un crawl tue le **groupe** de processus, parce que le crawl a
  démarré le serveur de dev du projet observé.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `electron/crawl.js` | **nouveau** — spawn, état, annulation |
| `electron/preload.cjs` | surface `crawl.*` |
| `electron/main.js` | handlers `crawl:*` + garde du registre, kill sur `before-quit` |
| `electron-builder.yml` | `files:` — `crawl/**`, `mcp/**`, `playwright-core/**` |
| `app/src/tabs/Produit.tsx` | bouton à états, progression, formulaire inline |
| `app/src/EquipmentPanel.tsx` | extraction de `Champ` + sous-formulaire config |
| `app/src/App.tsx` | `onReload` passé à `Produit` |
| `app/src/data.ts` | retrait de l'action crawl de `deliveredActions` |
| `hooks/i18n.js` | clés nouvelles et retirées, **fr et en** |
| `README.md`, `README.fr.md` | remaniement §4 |
| `CLAUDE.md` | §5 |

## Vérification

Automatisable — ce que `pnpm test` peut tenir sans navigateur :

1. `pnpm test` — `app/src/data.test.ts` et `app/src/i18n.test.ts` doivent être repris :
   le test i18n **énumère ses clés à la main** (`app/src/i18n.test.ts:9`), une clé
   ajoutée qui n'y figure pas n'est pas couverte.
2. Nouveau `electron/crawl.test.js` (`node:test`, sans framework — règle du dépôt) sur ce
   qui est pur : découpage du flux stdout en lignes `[crawl] …`, refus d'un second crawl
   sur le même projet, forme de l'état rendu par `pull`. **Ne pas** lancer de vrai crawl :
   `hooks/ovrsee-post-commit.js:216-221` dit pourquoi.
3. Nouveau cas dans `crawl/` (le glob `crawl/*.test.js` est déjà dans `pnpm test`) :
   `node crawl/index.js <dossier-temporaire-sans-config>` échoue avant tout navigateur —
   il n'atteint jamais `chromium.launch` — et doit écrire une ligne `{"ok":false,…}` dans
   `ovrsee/pages/scans.jsonl`. C'est précisément le message qui remontait en boucle dans
   le terminal ; le voir arriver par le bon canal est ce qui prouve le §3.
4. `pnpm lint` et `pnpm typecheck`.

À la main — rien de ce qui suit n'est couvert par la CI :

4. `pnpm electron`, projet **sans** `ovrsee.config.json` : le bouton dit « Configurer le
   crawl », le formulaire écrit le fichier, le bouton redevient « Crawler ».
5. Cliquer Crawler : la progression avance, le graphe se peuple à la fin.
6. Cliquer Crawler sur un projet dont `baseUrl` répond déjà : le crawl refuse, et le refus
   s'affiche — c'est le chemin `scans.jsonl` → `scanFailed`, pas un nouveau code.
7. Annuler un crawl en cours : `ps` ne doit plus montrer le serveur de dev du projet.
8. **`pnpm package:mac`, puis lancer le DMG** — c'est la seule vérification qui compte
   pour §1, et la seule que le dev ne donne jamais (`CLAUDE.md`, piège `node-pty`).
   Équiper un projet et le crawler depuis l'application installée, sans dépôt cloné.
9. Enregistrer le serveur MCP avec la commande du §4 et vérifier `tools/list`.

