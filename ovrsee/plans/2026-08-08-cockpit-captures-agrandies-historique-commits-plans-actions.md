---
{
  "status": "closed",
  "title": "Cockpit — captures agrandies, historique commits + plans, actions rapides",
  "opened": "2026-08-08",
  "closed": "2026-08-08",
  "commits": [
    {
      "sha": "fb8a466",
      "date": "2026-08-08",
      "files": [
        "app/src/App.tsx",
        "app/src/Lightbox.tsx",
        "app/src/Terminal.tsx",
        "app/src/data.ts",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Produit.tsx",
        "hooks/snapshot.js",
        "hooks/timeline.js",
        "hooks/timeline.test.js"
      ]
    }
  ]
}
---

# Cockpit — captures agrandies, historique commits + plans, actions rapides

## Contexte

Trois manques constatés à l'usage :

1. **Les captures sont trop petites pour servir.** Le rail de détail (`Produit.tsx:401-447`)
   affiche une vignette de la dernière capture et quatre miniatures de 44 px de haut. On ne
   peut ni lire une page, ni comparer deux dates. Or les captures successives sont déjà
   toutes sur le disque (`cockpit/pages/shots/<slug>/<date>-<sha>.png`, listées par
   `shotsByPage()` dans `hooks/snapshot.js:54`) — la matière est là, l'affichage manque.

2. **L'historique ne raconte que la moitié du projet.** `Historique.tsx` ne liste que les
   plans clos. Les commits n'existent dans le cockpit que rattachés à un plan
   (`plan.commits[]`, écrit par `hooks/cockpit-post-commit.js:43-67`) ; ceux faits hors plan
   sont invisibles. Le fil réel — « on a lancé tel plan, puis ces trois commits, puis ce
   commit isolé » — n'est nulle part.

3. **Aucune action n'est déclenchable depuis l'interface.** Relancer un scan ou régénérer le
   graphe suppose de retrouver la commande.

Le dépôt tient à un principe : **le cockpit n'exécute jamais** (`Terminal.tsx:38-43`). Les
actions rapides le respectent — elles *écrivent* dans la session Claude du panneau terminal,
sous les yeux. Rien de neuf côté IPC.

L'onglet Backlog n'est pas touché dans ce lot.

---

## 1. Visionneuse de captures — `app/src/Lightbox.tsx` (nouveau)

Composant plein écran, ~90 lignes, sans dépendance.

```
props: { root, slug, files, index, onIndex, onClose, ratio, label }
```

- Overlay `position: fixed; inset: 0; z-index: 50;` fond `rgba(6,7,14,.88)`, clic hors image
  = fermeture.
- Image via `shotUrl(root, 'shots/' + slug + '/' + files[index])` (`data.ts:351`),
  `max-width/max-height` contraints, `object-fit: contain` — pas de rognage, contrairement
  aux vignettes.
- Bandeau bas : `‹` / `›`, la date lisible (`frDate(shotDate(file))` + `humanAge`) et le sha
  extrait du nom de fichier, puis la **frise complète** — un point par capture, du plus
  ancien au plus récent, le point courant marqué. Clic sur un point = saut à cette date.
- Clavier : `←` / `→` naviguent, `Échap` ferme. `useEffect` avec `window.addEventListener`
  et nettoyage au démontage.
- Styles via `s()` (`app/src/style.ts:14`), palette Nocturne, comme le reste.

**Branchements** dans `app/src/tabs/Produit.tsx` (`DetailPanel`, l. 355-481) :

- état `zoom: number | null` (index de capture) dans `DetailPanel`.
- image principale (l. 402) et miniatures (l. 431) deviennent cliquables → `setZoom(i)`,
  `cursor: zoom-in`.
- la limite `shots.slice(1, 5)` reste pour le rail — la lightbox, elle, reçoit `shots`
  entier, donc toutes les captures sont atteignables.
- rendu du `<Lightbox>` quand `zoom !== null`, avec `ratio = shotRatio(page)` et
  `label = pageName(page, pages) + ' · ' + page.route`.

---

## 2. Historique unifié — commits + plans

### 2a. Lire les commits — `hooks/snapshot.js`

Aucune source de commits n'existe aujourd'hui hors `plan.commits`. Ajouter une lecture
`git log`, avec le motif déjà employé partout dans le dépôt
(`execFileSync('git', …)`, cf. `hooks/cockpit-post-commit.js:23`, `crawl/index.js:83`) :

```js
/** Commits du dépôt, du plus récent au plus ancien. Vide hors dépôt git. */
function commits(root, limit = 300) {
  try {
    return execFileSync('git', ['log', `-n${limit}`, '--pretty=format:%h\x1f%aI\x1f%s'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n').filter(Boolean)
      .map(line => {
        const [sha, date, subject] = line.split('\x1f')
        return { sha, date, subject }
      })
  } catch {
    return []   // pas un dépôt git, ou git absent : l'historique se réduit aux plans
  }
}
```

### 2b. Grouper — `hooks/timeline.js` (nouveau)

La logique de regroupement est la seule partie non triviale du lot : elle vit côté Node,
pas dans le rendu, pour tomber sous `pnpm test` (`node --test hooks/*.test.js …`) sans
introduire de runner pour le TypeScript.

```js
export function timeline(commits, plans)
// → Array<
//     { kind: 'plan',   date, plan: <fichier>, title, status, commits: Commit[] } |
//     { kind: 'commit', date, commit: Commit }
//   >
```

Règles :
- index `sha → plan` construit depuis `plan.commits[].sha`.
- parcours des commits du plus récent au plus ancien ; une suite de commits **consécutifs**
  appartenant au même plan se replie en une seule entrée `plan` (date = celle du plus
  récent de la suite). Un commit sans plan donne une entrée `commit`.
- un plan sans aucun commit retrouvé dans `git log` est ajouté à sa date
  (`closed ?? opened`) ; l'ensemble est retrié par date décroissante à la fin.

`snapshot()` (`hooks/snapshot.js:90`) expose `timeline: timeline(commits(root), plans)`.
Les commits bruts ne sont pas renvoyés en plus : la frise contient déjà sha, date et sujet.

**Test** — `hooks/timeline.test.js`, trois assertions : suite consécutive repliée, commit
hors plan isolé, plan sans commit présent quand même.

### 2c. Rendre — `app/src/tabs/Historique.tsx` (réécriture, ~140 lignes)

Signature : `Historique({ plans, timeline })` — `plans` reste nécessaire pour retrouver le
corps d'un plan (`planWhy`, `planRejected`, `planFiles`, `data.ts:63-91`) à partir de
`entry.plan`.

Rendu, conforme à la maquette validée :

```
─── 8 août 2026 ────────────────────
╭ PLAN  Gestion des projets…  ▸ clos
│ ● 51461bf  docs: rejouer les plans
│ ● 7fd02d8  fix: capturer le plan
╰────────────────────────────────────
  ● 3b05ce4  feat: icône (hors plan)
─── 7 août 2026 ────────────────────
```

- séparateur de jour dès que `date.slice(0, 10)` change ;
- bande de plan : bordure gauche `var(--color-accent-700)`, titre, pastille de statut
  (`clos` / `ouvert`), et **repli** — clic sur l'en-tête déploie le « pourquoi », l'encadré
  « Écarté » et les fichiers touchés, c'est-à-dire exactement le contenu actuel de
  l'historique, qui n'est donc pas perdu ;
- ligne de commit : sha en `ui-monospace`, sujet, heure. Même rendu dans et hors bande.
- vide : le message actuel, élargi (« aucun commit lu »).

`app/src/App.tsx:235` passe `timeline={snapshot.timeline}`.

### 2d. Types — `app/src/data.ts`

Ajouter `Commit`, `TimelineEntry` et le champ `timeline: TimelineEntry[]` sur `Snapshot`
(l. 140-159). Aucune fonction dérivée à ajouter : le calcul est fait côté serveur.

---

## 3. Actions rapides — `app/src/Terminal.tsx`

La colonne de droite du panneau terminal (l. 196-235) porte déjà les boutons d'injection et
la mécanique `activate(label, text)` (l. 87-99 : injecte si session, copie sinon). On y
ajoute un bloc **« Actions »** au-dessus de « Injecter dans la session », mêmes boutons,
même repli presse-papier :

| Bouton | Texte injecté |
|---|---|
| `⟳ Relancer un scan` | `!pnpm cockpit:crawl` |
| `◆ Regénérer le graphe` | `/graphify` |
| `↻ Rafraîchir le cockpit` | *(pas d'injection — rappelle `reload()` de `App.tsx:114`)* |

Le pty ouvre un shell puis y tape `claude` (`electron/pty.js:25`) : la session est **dans
Claude**. `!` est donc le préfixe bash de Claude Code, et `/graphify` sa commande. Le libellé
du bloc le dit — « Envoyer à la session Claude » — pour qu'un shell laissé nu après un `exit`
de Claude ne donne pas l'illusion que le bouton marche encore. Marquer ce choix d'un
commentaire `ponytail:` (plafond connu : dépend de la session Claude ; l'alternative serait
un canal IPC qui exécute, écarté ici car il rompt « le cockpit n'exécute jamais »).

`Terminal` reçoit une prop `onReload?: () => void` depuis `App.tsx` pour le troisième bouton.

---

## Fichiers

| Fichier | Nature |
|---|---|
| `app/src/Lightbox.tsx` | nouveau |
| `hooks/timeline.js` | nouveau |
| `hooks/timeline.test.js` | nouveau |
| `hooks/snapshot.js` | `commits()` + champ `timeline` |
| `app/src/tabs/Historique.tsx` | réécriture |
| `app/src/tabs/Produit.tsx` | ouverture de la lightbox depuis `DetailPanel` |
| `app/src/Terminal.tsx` | bloc « Actions » |
| `app/src/data.ts` | types `Commit`, `TimelineEntry`, champ `timeline` |
| `app/src/App.tsx` | props `timeline` et `onReload` |

Aucune dépendance ajoutée.

---

## Vérification

1. `pnpm test` — `hooks/timeline.test.js` passe, le reste ne régresse pas.
2. `pnpm typecheck`.
3. `pnpm dev`, sur le projet `cockpit` lui-même (5 pages, 4 captures par page depuis les
   scans du 8 août) :
   - **Produit** → sélectionner *Accueil* → clic sur la grande capture : la lightbox s'ouvre
     en plein écran, non rognée. `←` / `→` remontent les quatre dates ; la frise marque la
     position ; `Échap` ferme.
   - **Historique** → la frise montre `51461bf`, `7fd02d8`, `51dfab0`, `3b05ce4`, `b34bf11`
     avec `51dfab0` groupé sous le plan « gestion des projets dans la barre latérale » ;
     `3b05ce4` (« feat: icône ») apparaît hors bande. Déployer une bande affiche le
     « pourquoi » et les fichiers, comme avant.
   - Vérifier sur un projet enregistré **non git** (ou renommer `.git` temporairement) :
     l'historique se dégrade sans planter.
4. `pnpm electron` — cliquer `⟳ Relancer un scan` : `!pnpm cockpit:crawl` apparaît dans la
   session Claude du panneau et s'exécute ; la sortie du crawl défile. Une fois fini,
   `↻ Rafraîchir le cockpit` fait apparaître les nouvelles captures.
