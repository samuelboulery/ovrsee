---
{
  "status": "open",
  "title": "Cockpit — gestion des projets dans la barre latérale, et graphe par niveaux",
  "opened": "2026-08-08",
  "closed": null,
  "commits": [
    {
      "sha": "7fd02d8",
      "date": "2026-08-08",
      "files": [
        "hooks/cockpit-capture-plan.js"
      ]
    }
  ]
}
---

# Cockpit — gestion des projets dans la barre latérale, et graphe par niveaux

## Contexte

Trois manques constatés à l'usage :

1. **La liste des projets est en lecture seule.** `~/.claude/cockpit/projects.json` n'est
   écrit que par le hook de capture de plan (`registerProject`, `hooks/plans.js:232`). Pour
   ajouter ou retirer un projet, il faut éditer le JSON à la main. L'ordre est celui
   d'insertion — le projet le plus utilisé finit en bas.
2. **Le badge de la barre latérale n'explique pas ce qu'il compte.** « 3 ouverts » /
   « à jour » (`app/src/App.tsx:422`) = nombre de **plans approuvés jamais clos**
   (`backlog()`, `data.ts:326`) ; « à jour » = zéro plan ouvert. La ligne du dessous est la
   date du dernier commit rattaché à un plan. Rien à l'écran ne le dit.
3. **Le graphe montre des liens qui ne sont pas des filiations.** Les profondeurs sont
   déjà justes (BFS depuis `/`, `data.ts:229-245` — les 5 onglets sont bien tous à la
   profondeur 1). Mais `Edges` (`app/src/tabs/Produit.tsx:209-234`) trace **tous** les
   liens, y compris les 16 liens frère-à-frère de la barre d'onglets, en pointillé « retour »
   sur le flanc droit. Visuellement, `/stack` a l'air de découler de `/donnees`.

Résultat visé : ouvrir / retirer / réordonner les projets depuis l'interface, un badge qui
se comprend, et un graphe où une arête signifie « on descend d'un niveau ».

## Décisions prises avec l'utilisateur

- Tri **MRU seul** : dernier projet ouvert en haut, automatique, aucun contrôle à l'écran.
- Un dossier **sans `cockpit/`** est ajouté quand même, et l'interface propose de
  l'initialiser.
- Le **sélecteur de dossier** n'existe que dans l'application Electron ; le bouton est
  absent dans le navigateur (`pnpm dev`).

---

## 1. Registre : écriture et ordre MRU

**`hooks/plans.js`** (le registre y est déjà écrit, avec `writeFileNoFollow` l. 208-222 —
refus des liens symboliques, écriture atomique par `rename`) :

- Factoriser la lecture/écriture du registre (`readRegistry()` / `writeRegistry()`) à côté de
  `registerProject`.
- `registerProject(root)` : ajoute `lastOpened` (ISO) à l'entrée créée, et **retourne
  aussi vrai/faux** comme aujourd'hui.
- `unregisterProject(root)` → retire l'entrée. **Aucun fichier du projet n'est touché** —
  c'est un retrait de liste, à dire explicitement dans le JSDoc et dans l'infobulle du bouton.
- `touchProject(root)` → met `lastOpened = new Date().toISOString()` sur une entrée
  **déjà connue** (sinon no-op).

**`hooks/snapshot.js:38-46`** — `projects(cwd)` :

- Trier les entrées du registre par `lastOpened` décroissant ; entrée sans `lastOpened`
  (registres antérieurs) en fin de liste, ordre d'insertion conservé entre elles.
- Garder la règle actuelle « `cwd` en tête **s'il porte un `cockpit/` et n'est pas déjà
  enregistré** » ; s'il est enregistré, c'est le MRU qui décide.

## 2. Une seule route d'écriture

**`server/api.js`** — le fichier existe précisément pour que le dev server Vite et
`protocol.handle` d'Electron partagent la même logique. On y ajoute **une** route plutôt
que quatre :

```
POST /api/projects   body: { action: 'add' | 'remove' | 'touch' | 'init', path }
                     → 200 { projects: [...] }  (liste à jour, déjà triée)
                     → 400 { error }            (chemin invalide / action inconnue)
```

- `resolve()` prend un argument de plus : la méthode et le corps déjà lu. Les deux
  adaptateurs (`nodeMiddleware`, `fetchHandler`) lisent le corps avant d'appeler.
- **Validation du chemin** (`add` seul accepte un chemin inconnu) : chaîne non vide,
  `isAbsolute`, `existsSync`, `lstatSync().isDirectory()` et pas un lien symbolique.
  `remove` / `touch` / `init` n'acceptent qu'un chemin **déjà dans le registre** — même
  règle que `asked()` (l. 25) pour `/api/project` et `/api/shot`.
- **Garde CSRF** : exiger l'en-tête `X-Cockpit: 1` sur le POST. En dev, le serveur Vite
  écoute sur localhost et n'importe quelle page ouverte dans le navigateur peut y poster un
  formulaire ; un en-tête personnalisé force le préflight et bloque ce cas. Une ligne.

## 3. Initialiser un cockpit dans un projet qui n'en a pas

**`hooks/install.js`** est aujourd'hui un script à effets de bord au chargement (l. 31-149).
Le transformer en module : `export function install(root)` qui rend la liste des actions
faites (`['post-commit installé', 'hooks Claude Code déjà présents', …]`), plus le garde
habituel pour l'usage CLI :

```js
if (process.argv[1] === fileURLToPath(import.meta.url)) install(resolve(process.argv[2] ?? process.cwd()))
```

`install()` crée aussi `cockpit/plans/` (`mkdirSync recursive`) — c'est le seul dossier dont
`readPlans` a besoin.

L'action `init` de la route appelle `install(root)`. Elle tourne côté Node dans les deux
coquilles : **pas d'IPC**, donc l'initialisation marche aussi en `pnpm dev`.

*Attention :* `install()` écrit dans `~/.claude/settings.json`. La sauvegarde préalable et la
relecture (l. 128-143) sont à conserver telles quelles.

## 4. Sélecteur de dossier (Electron seulement)

- `electron/main.js` : `ipcMain.handle('projects:pick', …)` →
  `dialog.showOpenDialog({ properties: ['openDirectory'] })` → renvoie le chemin ou `null`.
  C'est le seul ajout à la surface IPC, et il n'accepte **aucun argument** du rendu.
- `electron/preload.cjs` : exposer `cockpit.projects = { pick }` à côté de `cockpit.terminal`.
  Son absence dans le navigateur sert de test de capacité, comme le fait déjà `cockpit.terminal`
  (voir l'en-tête du fichier).

## 5. Interface — `app/src/App.tsx`

`data.ts` : ajouter `projectAction(action, path)` à côté de `fetchProjects` (l. 315), qui
poste et renvoie la liste triée. `Project` gagne `lastOpened?: string`.

**`Sidebar`** (l. 293-375) :

- En-tête « Projets » + bouton `+` à droite, rendu **seulement si `window.cockpit?.projects`
  existe**. Clic → `pick()` → si un chemin revient → `projectAction('add', path)` → remonter
  la nouvelle liste à `App` et sélectionner le projet ajouté.
- `App` détient la liste : passer un `onProjects(list)` à `Sidebar`.

**`ProjectRow`** (l. 377-430) :

- Badge : ajouter `title="Plans approuvés qui ne sont pas encore clos"` sur la pastille et
  `title="Dernier commit rattaché à un plan"` sur la ligne de date. Le libellé ne change pas
  — c'est l'explication qui manquait, pas le mot.
- Projet sans `cockpit/` (détectable : `snapshot.plans.length === 0 && snapshot.scans.length === 0
  && snapshot.pages === null`) → badge « à initialiser » au lieu de « à jour ».
- Bouton `×` apparaissant au survol / sur la ligne active. **Confirmation en deux temps
  *inline*** (le libellé devient « Retirer ? » puis un second clic valide, échappement au
  `blur`) — surtout **pas** `window.confirm` : un dialogue modal bloque la boucle
  d'événements de la fenêtre. Infobulle : « Retirer de la liste — aucun fichier n'est
  supprimé ». Après retrait, si le projet retiré était le courant, basculer sur le premier de
  la liste.
- Sélection (`onPick`) → `projectAction('touch', path)` en tâche de fond, **sans
  réordonner la liste affichée** : une ligne qui saute en haut sous le curseur au moment du
  clic est désagréable. Le nouvel ordre s'applique au prochain chargement.

**Zone principale** : quand le projet courant n'a pas de `cockpit/`, remplacer le contenu
des onglets par un `Message` explicite + bouton « Initialiser cockpit ici » →
`projectAction('init', path)` puis rechargement du snapshot.

## 6. Graphe — une arête = une descente d'un niveau

**`app/src/tabs/Produit.tsx:209-234`**, dans `Edges` : ne tracer un lien que si
`to.depth === from.depth + 1`. Tout le reste est écarté :

- `to.depth === from.depth` : lien frère (la barre d'onglets présente sur chaque page) —
  aujourd'hui tracé en pointillé « retour », c'est exactement ce qui donne l'impression
  qu'un onglet découle d'un autre.
- `to.depth <= from.depth` : retour de navigation (chaque page renvoie vers `/`) — du bruit,
  puisque tout onglet ramène à l'accueil.

Conséquence sur `cockpit/pages/pages.json` actuel : 20 liens → 4 arêtes, `/` vers les
quatre onglets. Une page ouverte *depuis* un onglet arrive en profondeur 2 et garde son
arête. Un enfant atteint depuis deux parents garde ses deux arêtes (on ne réduit pas à
l'arbre BFS).

La branche « retour » et le marqueur `#nab` (l. 224-231, 247-249, 256-260) deviennent morts :
les supprimer, ainsi que le paragraphe du JSDoc l. 200-202 qui les décrit, et documenter la
nouvelle règle. `layoutGraph` n'est **pas** touché : les profondeurs étaient déjà justes.

---

## Vérification

1. `pnpm test` (`server/api.test.js`, `hooks/plans.test.js`) — ajouter des cas :
   `unregisterProject` sur un chemin absent, tri MRU de `projects()` avec une entrée sans
   `lastOpened`, POST refusé sans l'en-tête `X-Cockpit`, POST `add` refusé sur un chemin
   relatif ou inexistant.
2. `pnpm dev` puis `http://localhost:5180` : le bouton `+` est **absent**, la croix de
   retrait fonctionne, l'ordre MRU se voit après avoir sélectionné un projet et rechargé la
   page.
3. Application Electron : `+` ouvre le sélecteur macOS, un dossier quelconque (par ex.
   `/Users/sam/code/claude-config`) s'ajoute avec « à initialiser », le bouton
   « Initialiser cockpit ici » crée `cockpit/plans/` et le bloc `post-commit` — vérifier avec
   `cat <repo>/.git/hooks/post-commit`.
4. Graphe : onglet Produit sur cockpit — quatre traits pleins depuis la carte d'accueil,
   aucun pointillé, aucune arête entre onglets. Capture automatique disponible :
   `COCKPIT_CAPTURE=/tmp/graphe.png` sur l'application empaquetée (`electron/main.js:136`).
5. Contrôle de non-régression du registre : `cat ~/.claude/cockpit/projects.json` — les trois
   entrées existantes conservent `path` et `name`, `lastOpened` s'ajoute sans les casser.
