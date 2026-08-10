---
{
  "status": "open",
  "title": "Onglet Tableau — gestion de projet kanban avec ticketing",
  "opened": "2026-08-09",
  "closed": null,
  "commits": []
}
---

# Onglet Tableau — gestion de projet kanban avec ticketing

## Contexte

L'onglet **Backlog** (`app/src/tabs/Backlog.tsx`) n'affiche pas un backlog : il affiche
la liste dérivée des plans jamais clos (`backlog()` dans `hooks/plans.js:126`). C'est en
lecture seule, non priorisable, et cela ne couvre que ce qui a *déjà* été approuvé —
rien de ce qui reste à décider.

On veut à la place un vrai tableau kanban : des tickets saisissables, priorisés,
déplaçables entre colonnes, écrits **à la fois par l'interface et par Claude**, avec des
colonnes configurables.

**Écart assumé avec la doctrine actuelle du projet.** `skills/cockpit/SKILL.md:12` pose
« Le cockpit se lit. Il ne s'exécute jamais, et il ne s'édite jamais à la main », et
`hooks/plans.js:7` justifie le frontmatter JSON par « écrits par la machine, jamais
édités à la main ». Les tickets sont la première donnée *saisie* du cockpit. La doctrine
reste vraie pour les plans, les pages et les scans ; elle est explicitement amendée pour
`cockpit/tickets/`. Ce point est documenté dans la skill plutôt que laissé implicite.

## Décisions

| Point | Choix |
|---|---|
| Stockage | 1 fichier Markdown par ticket, `cockpit/tickets/T-0012-slug.md` |
| Frontmatter | **JSON**, comme les plans — réutilise `parsePlan`/`serializePlan` |
| Colonnes | `cockpit/board.json`, configurable ; défauts en dur si absent |
| Écriture | UI (route POST) **et** Claude (édition directe + CLI) |
| Ordre | tri `priorité` puis date — pas de champ `rang` à réécrire |
| Tickets ↔ plans | stocks indépendants ; champ `plan` optionnel |
| Onglet | `Tableau`, route `/tableau` ; `/backlog` et `Backlog.tsx` supprimés |

Un fichier par ticket, et non un `tickets.json` : deux écrivains concurrents (l'UI et
Claude) sur un fichier unique s'écrasent, et un déplacement de colonne doit donner un
diff git d'une ligne.

## Format

`cockpit/tickets/T-0012-glisser-deposer.md`

```markdown
---
{
  "id": "T-0012",
  "titre": "Glisser-déposer entre colonnes",
  "colonne": "pret",
  "priorite": "haute",
  "tags": ["ui"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte
Pourquoi ce ticket existe.

## Critères d'acceptation
- [ ] …
```

`cockpit/board.json`

```json
{
  "colonnes": [
    { "id": "backlog", "titre": "Backlog" },
    { "id": "a-specifier", "titre": "À spécifier" },
    { "id": "pret", "titre": "Prêt" },
    { "id": "en-cours", "titre": "En cours", "wip": 3 },
    { "id": "revue", "titre": "Revue" },
    { "id": "fait", "titre": "Fait" }
  ]
}
```

Un ticket dont la `colonne` n'existe plus dans `board.json` retombe en première colonne à
la lecture — le fichier n'est pas réécrit pour autant.

## Travail

### 1. `hooks/tickets.js` (nouveau) — cœur logique, module Node pur

Miroir de `hooks/plans.js`, en réutilisant ses primitives plutôt qu'en les recopiant :
`parsePlan`, `serializePlan`, `slugify`, `writeFileNoFollow` (écriture atomique + refus
des liens symboliques — `hooks/plans.js:202`).

- `DEFAULT_COLUMNS` — les six colonnes ci-dessus.
- `readBoard(cockpitDir)` — `board.json` ou défauts ; valide que chaque colonne a un `id`
  non vide et unique, sinon défauts.
- `readTickets(cockpitDir)` — tous les `.md` de `cockpit/tickets/`, un fichier illisible
  est signalé sur `stderr` et ignoré (même politique que `readPlans`, `hooks/plans.js:86`).
- `nextTicketId(tickets)` — max des `T-\d+` + 1, formaté sur 4 chiffres.
- `ticketFileName(id, titre)` — `${id}-${slugify(titre)}.md`.
- `isSafeTicketFileName(file)` — copie de `isSafePlanFileName` (`hooks/plans.js:354`) :
  c'est la seule barrière entre une valeur venue du rendu et un chemin disque.
- `createTicket(cockpitDir, {titre, colonne, priorite, tags, corps, plan})` — valide la
  colonne contre le board, rend le ticket écrit.
- `updateTicketMeta(cockpitDir, file, fn)` — miroir de `updatePlanMeta`, met `maj` à jour.
- `moveTicket(cockpitDir, file, colonne)` — refuse une colonne inconnue.
- `deleteTicket(cockpitDir, file)` — `unlinkSync` après contrôle du nom.
- `sortTickets(tickets)` — priorité (`haute` < `moyenne` < `basse`) puis `cree` décroissant.
- `importOpenPlans(cockpitDir)` — migration : un ticket par plan `status: open`,
  colonne `backlog` si zéro commit, `en-cours` sinon, `plan` renseigné, corps = premier
  paragraphe d'intention. Idempotent : saute les plans déjà référencés par un ticket.

### 2. `hooks/snapshot.js` — exposer les données

Dans `snapshot()` (ligne 133), ajouter `tickets: readTickets(join(root, 'cockpit'))` et
`board: readBoard(...)`. Rien d'autre à toucher : tout passe déjà par `/api/project`.

### 3. `server/api.js` — route d'écriture

Nouveau `case '/api/tickets'` dans `resolve()` (ligne 99), calqué sur `/api/projects` :

- `POST` uniquement, en-tête `X-Cockpit: 1` obligatoire (protection CSRF déjà en place,
  ligne 106) ; sans lui, 403.
- `path` doit être un projet **du registre** — réutiliser le helper `asked()` (ligne 97).
  Un chemin arbitraire ne doit pas devenir une écriture disque arbitraire.
- Actions : `create`, `move`, `update`, `delete`.
- `file` passe par `isSafeTicketFileName` avant toute jonction de chemin.
- Réponse : `{ tickets, board }` à jour, pour que l'UI n'ait pas à refaire un snapshot
  complet à chaque glisser-déposer.

### 4. `hooks/install.js` — scaffolding

À côté de `mkdirSync(join(root, 'cockpit', 'plans'))` (ligne 190), créer
`cockpit/tickets/` et écrire `cockpit/board.json` s'il est absent (jamais l'écraser).

### 5. `hooks/cockpit-cli.js` — chemin Claude / secours

Nouvelles commandes, sur le modèle des trois existantes :

```bash
node hooks/cockpit-cli.js tickets                          # liste par colonne
node hooks/cockpit-cli.js ticket new "<titre>" [--colonne x] [--priorite haute]
node hooks/cockpit-cli.js ticket move <fichier.md> <colonne>
node hooks/cockpit-cli.js ticket import-plans              # migration one-shot
```

### 6. `app/src/data.ts` — types et appels

- `interface Ticket` et `interface Colonne`, `Snapshot.tickets` / `Snapshot.board`.
- `ticketAction(action, path, payload)` sur le modèle de `projectAction` (ligne 347),
  mêmes en-têtes.
- `sortTickets` / `groupByColumn` côté client (miroir du tri serveur, pour réordonner
  sans aller-retour).
- Supprimer `backlog()` (ligne 374) — plus aucun appelant après l'étape 7.

### 7. `app/src/tabs/Tableau.tsx` (nouveau) + `App.tsx`

- `TABS` (ligne 34) : `['backlog','Backlog','/backlog']` → `['tableau','Tableau','/tableau']`.
- Ligne 238 : `{tab === 'tableau' && <Tableau ... />}`, en passant `snapshot`, `current`
  et le `reload` existant (ligne 114).
- Supprimer `app/src/tabs/Backlog.tsx` et ses imports.
- `ProjectRow` (ligne 529) : le badge de la barre latérale compte désormais les tickets
  hors dernière colonne, pas les plans ouverts.

`Tableau.tsx`, dans le style de la maison — styles inline via `s()` (`app/src/style.ts`),
tokens `var(--color-*)`, aucune nouvelle dépendance :

- Rangée de colonnes en `overflow-x: auto`, chacune en `flex-column` scrollable.
- En-tête de colonne : titre, compte, pastille d'alerte si `wip` dépassé.
- Carte : titre, pastille de priorité, tags, âge (`humanAge`, déjà dans `data.ts`), lien
  vers le plan si `plan` renseigné.
- Glisser-déposer **HTML5 natif** (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) —
  pas de bibliothèque. Mise à jour optimiste, puis `ticketAction('move')` ; en cas
  d'échec, retour à l'état serveur et message d'erreur.
- « + » par colonne : champ titre en ligne, `Entrée` crée, `Échap` annule.
- Clic sur une carte : panneau latéral avec titre, priorité, tags, corps en `textarea`,
  bouton Enregistrer, et suppression **derrière une confirmation** (même motif que le
  `confirming` de `ProjectRow`, ligne 522).

### 8. `skills/cockpit/SKILL.md` — contrat côté Claude

- Amender la ligne 12 : les plans/pages/scans se lisent seulement ; `cockpit/tickets/` et
  `cockpit/board.json` s'écrivent.
- Section « Tickets » : emplacement, format du frontmatter, colonnes lues depuis
  `board.json`, règle d'attribution d'`id`, commandes CLI ci-dessus.
- Corriger le tableau ligne 39 : « Que reste-t-il à faire ? » → les tickets hors dernière
  colonne (les plans ouverts restent la réponse à « qu'est-ce qui a été approuvé »).

## Tests

`hooks/tickets.test.js`, avec `node --test` comme le reste (`hooks/plans.test.js` sert de
modèle, y compris pour l'usage de `COCKPIT_REGISTRY` et des dossiers temporaires) :

- aller-retour parse/serialize d'un ticket ;
- `nextTicketId` sur liste vide, sur trous, sur ids non conformes ;
- colonne inconnue → repli sur la première colonne à la lecture, refus à l'écriture ;
- `board.json` absent / corrompu / colonnes sans `id` → défauts ;
- `isSafeTicketFileName` rejette `../`, `\`, `\0`, les noms cachés ;
- `writeFileNoFollow` refuse un `cockpit/tickets` symlinké (motif déjà testé pour les plans) ;
- `importOpenPlans` est idempotent — deux passages, même nombre de tickets.

`server/api.test.js` : `/api/tickets` sans `X-Cockpit` → 403 ; avec un `path` hors
registre → 404 ; `create` puis `move` rendent la liste à jour.

## Vérification

```bash
pnpm test          # unitaires hooks + api
pnpm typecheck     # tsc
pnpm dev           # http://localhost:5180/tableau
```

Dans l'app :

1. `node hooks/cockpit-cli.js ticket import-plans` sur ce dépôt → les plans ouverts
   apparaissent en colonne Backlog.
2. Créer un ticket depuis l'UI → vérifier que `cockpit/tickets/T-00xx-*.md` existe et que
   `git diff` est lisible.
3. Le glisser en « En cours » → une seule ligne (`colonne`, plus `maj`) change dans le
   fichier.
4. Demander à Claude dans le terminal intégré : « crée trois tickets pour X » → ils
   apparaissent après rafraîchissement.
5. Éditer `cockpit/board.json` (ajouter une colonne) → elle apparaît sans redémarrage.
6. `pnpm package` en fin de lot, comme d'habitude.
