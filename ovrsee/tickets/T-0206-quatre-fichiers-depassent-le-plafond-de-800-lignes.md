---
{
  "id": "T-0206",
  "titre": "Quatre fichiers dépassent le plafond de 800 lignes",
  "colonne": "en-cours",
  "priorite": "basse",
  "charge": "l",
  "tags": ["dette"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null,
  "epic": "T-0197"
}
---

## Contexte

Les règles du projet fixent 200 à 400 lignes par fichier, 800 au maximum, et
l'organisation par domaine plutôt que par type. Quatre fichiers passent outre :

| Fichier | Lignes |
|---|---|
| `app/src/data.ts` | 1 470 |
| `app/src/App.tsx` | 1 383 |
| `hooks/tickets.test.js` | 897 |
| `hooks/tickets.js` | 818 |

(`hooks/i18n.js` fait 1 598 lignes mais c'est un dictionnaire, pas de la logique.)

`data.ts` mélange trois domaines : les types du snapshot, les appels `/api/*`, et
les fonctions pures de calcul (layout du graphe, tri des tickets, progression
d'epic). C'est la découpe la plus évidente. `App.tsx` est un cas plus délicat :
l'état de la fenêtre y est central, et le découper mal ferait circuler des props
plutôt que de la clarté.

Ticket posé en « à spécifier » : la découpe se décide avant de se faire, et un
refactor de cette taille ne s'improvise pas au fil d'un autre travail.

## La découpe arrêtée

**Principe commun : le fichier d'origine reste et devient la façade.** `data.ts`
et `tickets.js` gardent leur chemin et re-exportent ce qui part ailleurs. 41
imports d'`app/src` et 18 modules de `hooks/` et `server/` n'ont donc pas une
ligne à changer, et la découpe reste réversible. Les types voyagent avec leur
domaine — pas de `types.ts` fourre-tout, la règle dit « par domaine, pas par
type de fichier ».

### `app/src/data.ts` → cinq modules + façade

| Module | Contenu |
|---|---|
| `liste.ts` | le garde-fou `liste()`, que trois modules partagent |
| `plans.ts` | `Commit`, `Plan`, extraction markdown (`stripMarkdown`, `planWhy`, `planRejected`, `planFiles`), `plansOuverts`, `history`, `plansForPage` |
| `pages.ts` | `Page`, `shotRatio`, `shotDate`, `pageName`, `shotUrl`, `mediaUrl` |
| `graph.ts` | layout du graphe (`CARD_*`, `layoutGraph`, `Placed`), `GraphNode`/`GraphLink`/`GraphifyGraph`, `tablesFrom`, `stackFrom` |
| `api.ts` | `json`, `estAbandon`, tous les `fetch*`/`*Action`/`update*` et les types de requête et de réponse qui n'ont pas d'autre usage |
| `brief.ts` | `briefLines`, `buildInjections`, `decideInjection`, `deliveredActions`, `buildActions` |

`data.ts` garde le domaine de l'instantané — `Snapshot`, `Ticket`, `Colonne`,
`Git*`, `Scan`, `Audit`, `Settings`, les dérivations de tableau (`sortTickets`,
`epicProgress`, `epicEtat`, `restant`…) et les dates — et re-exporte le reste.

### `hooks/tickets.js` → un module + façade

`hooks/board.js` prend le domaine des colonnes : `DEFAULT_COLUMNS`, `readBoard`,
`writeBoard`, `addColumn`, `renameColumn`, `reorderColumn`, `colonneFinale`.
C'est la seule frontière nette du fichier — les colonnes se lisent et s'écrivent
sans jamais toucher un ticket. `tickets.js` les importe et les re-exporte.

**`removeColumn` reste dans `tickets.js`**, et c'est l'exception qui dessine la
frontière : c'est la seule opération de colonne qui réécrit des tickets — elle
les reloge avant de retirer l'entrée du board. La mettre dans `board.js`
refermait un cycle `board → tickets → board`.

`hooks/tickets.test.js` suit la même ligne : les tests de colonnes partent dans
`hooks/board.test.js`.

### `app/src/App.tsx` → deux modules

La coque de la fenêtre — `Sidebar`, `ProjectSwitcher`, `RailLink`, `ProjectRow`,
`ScanBadge`, `Message` et `openProject` — part dans `app/src/Shell.tsx` : ce sont
déjà des composants à props, rien de l'état de la fenêtre ne les suit. Nommé
`Shell` et pas `Sidebar` parce qu'il porte aussi les deux blocs qui bordent le
contenu. Les aides de routage (`tabForPath`, `labelOf`, `pushUrl`, lectures de
l'URL) partent dans `app/src/route.ts`. `App()` lui-même n'est pas touché — c'est
là que découper ferait circuler des props plutôt que de la clarté.

### Deux fichiers que la table du constat avait manqués

`app/src/tabs/Produit.tsx` (1 008) et `app/src/tabs/Navigateur.tsx` (1 006)
dépassaient aussi le plafond. Le deuxième critère les couvre, ils sont découpés
de la même façon :

| Module | Contenu |
|---|---|
| `tabs/ProduitDetail.tsx` | le rail de détail d'une page et la comparaison de deux captures |
| `tabs/navigateur-webview.ts` | la surface d'une `<webview>`, la normalisation d'URL, la sélection d'un élément, la géométrie des devtools — rien qui rende du JSX |
| `tabs/NavigateurPanneaux.tsx` | panneau de l'élément sélectionné, boutons, écran « hors application » |

## Critères d'acceptation

- [x] Une découpe est arrêtée par domaine pour `data.ts` et pour `tickets.js`, écrite ici.
- [x] Après découpe, aucun fichier de logique ne dépasse 800 lignes. Le plus gros
      est `app/src/Terminal.tsx` à 787 ; seul `hooks/i18n.js` (1 603) reste au-dessus,
      et c'est le dictionnaire que le constat excluait.
- [x] Aucun changement de comportement : `pnpm test` (277), `pnpm typecheck`,
      `pnpm lint` et `pnpm build:ui` passent. Les sept onglets ont été ouverts dans
      l'application, sur un projet vide puis sur `ovrsee` lui-même — graphe de
      navigation, rail de détail, comparaison de deux dates et tables Graphify
      compris. Aucune erreur de console.
