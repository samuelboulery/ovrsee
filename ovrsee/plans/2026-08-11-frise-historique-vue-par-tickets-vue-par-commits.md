---
{
  "status": "open",
  "title": "Frise historique : vue par tickets + vue par commits",
  "opened": "2026-08-11",
  "closed": null,
  "commits": [
    {
      "sha": "15c9408",
      "date": "2026-08-11",
      "files": [
        "app/src/App.tsx",
        "app/src/data.ts",
        "app/src/render.test.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Tableau.tsx",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/snapshot.js",
        "hooks/timeline.js",
        "hooks/timeline.test.js"
      ]
    },
    {
      "sha": "4eb2e93",
      "date": "2026-08-11",
      "files": []
    },
    {
      "sha": "f548acb",
      "date": "2026-08-11",
      "files": []
    }
  ]
}
---

# Frise historique : vue par tickets + vue par commits

## Contexte

L'onglet Historique (`Historique.tsx`) affiche déjà une frise unique : commits git, avec les plans en bandes qui regroupent leurs commits consécutifs. Depuis le dernier plan livré (« Tracer aussi les tâches hors plan/hors audit sous forme de ticket », 11 août 2026), le ticket est devenu l'unité de travail réelle — chaque édition de code sous un plan actif exige désormais un ticket (`meta.plan === planFile`, gate `ovrsee-tool-edit-gate.js`, T-0030). La frise actuelle raconte donc l'histoire au niveau git (commits), pas au niveau du travail tel qu'il a été tracé (tickets). L'utilisateur veut pouvoir lire l'historique des deux façons : par tickets (nouvelle vue, par défaut) et par commits (vue existante, conservée telle quelle derrière un sélecteur).

Un ticket cliqué doit à la fois s'afficher comme carte dans la frise (titre, priorité, colonne, tags) et rediriger vers l'onglet Tableau avec son panneau Detail déjà ouvert.

## Approche

### 1. Regroupement en Node (`hooks/timeline.js`)

Ajouter `ticketTimeline(tickets, plans)`, sœur de `timeline()` existante (même fichier, même conviction : la logique de regroupement non triviale reste en Node, testée via `pnpm test`, pas dans le rendu React).

- Pour chaque plan référencé par au moins un ticket (`ticket.plan === plan.file`), une entrée `{kind: 'plan', date, plan: file, title, status, tickets: Ticket[]}` — tous les tickets du plan regroupés dans une seule bande (pas de logique de « consécutif » comme pour les commits : les tickets n'ont pas d'ordre git, un regroupement par simple appartenance suffit). `date` = le plus récent `maj` parmi ses tickets.
- Chaque ticket sans plan (`ticket.plan === null`) → entrée `{kind: 'ticket', date: ticket.maj, ticket}` indépendante.
- Tri final décroissant par `date`, tickets à l'intérieur d'une bande triés par `maj` décroissant.
- Un plan référencé par un ticket mais absent du disque (fichier supprimé) : garder la bande quand même (même logique que `plan === null` côté commits) — le titre/status viennent alors du ticket seul si le plan n'est pas trouvé côté frontend.

Ajouter `hooks/timeline.test.js` (fichier existant) : cas couverts — tickets groupés par plan, tickets orphelins, tri par date, plan sans ticket (absent de la sortie ticket-view, contrairement à la vue commits qui garde les plans jamais commencés — ici pas de raison de lister un plan sans ticket).

### 2. Snapshot backend (`hooks/snapshot.js`)

Autour de la ligne 395-426 : `tableau(root, illisibles)` est aujourd'hui étalé directement (`...tableau(root, illisibles)`), donc `tickets` n'existe pas comme variable locale. Extraire d'abord :

```js
const tableauData = tableau(root, illisibles)
```

puis `...tableauData` dans le retour, et ajouter `ticketTimeline: ticketTimeline(tableauData.tickets, plans)` à côté du `timeline: timeline(commits(root), plans)` existant (ligne 426).

### 3. Types frontend (`app/src/data.ts`)

- `TicketTimelineEntry` (miroir de `TimelineEntry`, lignes 150-160) :
  ```typescript
  export type TicketTimelineEntry =
    | { kind: 'plan'; date: string; plan: string; title: string; status: 'open'|'closed'; tickets: Ticket[] }
    | { kind: 'ticket'; date: string; ticket: Ticket }
  ```
- Ajouter `ticketTimeline: TicketTimelineEntry[]` au type `Snapshot` (ligne ~375, à côté de `timeline`).

### 4. `Historique.tsx` : sélecteur de vue

- État `const [vue, setVue] = useState<'tickets' | 'commits'>('tickets')` — ticket par défaut, comme demandé.
- Petit sélecteur segmenté en haut (deux boutons, style `tag`/`btn-ghost` existant) au-dessus du titre.
- `vue === 'commits'` → rendu actuel inchangé (`timeline` + `PlanBand`/`CommitRow`).
- `vue === 'tickets'` → nouveau rendu sur `ticketTimeline` :
  - `PlanBand` adapté (ou variante `PlanBandTickets`) : même en-tête pliable (titre, statut, pourquoi/alternative écartée via `planWhy`/`planRejected` si le plan est résolu localement via `byFile.get(entry.plan)`), mais liste des tickets de la bande à la place des commits.
  - Nouveau composant `TicketCard` : point de couleur priorité (réutiliser/exporter la map `COULEUR: Record<Priorite, string>` de `Tableau.tsx` ligne 728 — l'exporter ou la déplacer dans `data.ts` pour partage), id, titre, badge colonne, tags — style visuel proche de `Carte()` (`Tableau.tsx` L734-874) mais en ligne compacte plutôt qu'en carte de kanban.
  - `onClick` sur `TicketCard` → nouvelle prop `onOuvrirTicket: (file: string) => void` remontée jusqu'à `App.tsx`.

### 5. Navigation carte → Tableau (`App.tsx`)

- Étendre `pushUrl(path, project, ticket?)` (ligne 131-134) pour ajouter `&ticket=<file>` à la query string quand fourni.
- Nouvel état `focusTicket` initialisé depuis `new URLSearchParams(window.location.search).get('ticket')`, mis à jour dans le handler `popstate` (ligne 223-230) comme `current` l'est déjà.
- `onOuvrirTicket = (file) => { setTab('tableau'); setFocusTicket(file); pushUrl('/tableau', current, file) }`, passé à `<Historique onOuvrirTicket={...} ticketTimeline={snapshot.ticketTimeline ?? []} />` (à côté du montage existant ligne 658-663).
- `<Tableau>` (montage ligne 665-674) reçoit une nouvelle prop optionnelle `focusTicket?: string | null`. Comme `Tableau` est démonté/remonté à chaque changement d'onglet (`{tab === 'tableau' && <Tableau ... />}`), il suffit de seeder l'état interne existant : `const [ouverte, setOuverte] = useState<string | null>(focusTicket ?? null)` (ligne 117) — aucune plomberie supplémentaire, le panneau `Detail` s'ouvre déjà si `ouverte` correspond à un ticket existant.

### 6. i18n (`hooks/i18n.js`)

Nouvelles clés (fr + en), à côté des clés `historique.*` existantes (L420-425) : `historique.view_tickets`, `historique.view_commits`, `historique.ticket_label` (label de bande, miroir de `historique.plan_label`), `historique.no_tickets` (bande de plan sans ticket rattaché — cas théorique si le filtre exclut déjà les plans sans ticket, à garder par cohérence défensive avec `historique.no_commits`).

## Vérification

- `pnpm test` (racine `hooks/`) : nouveaux cas dans `timeline.test.js` pour `ticketTimeline`.
- `pnpm package` (rappel mémoire) après le lot, sans le redemander.
- Lancer l'app (`/run` ou équivalent) : onglet Historique doit s'ouvrir par défaut sur la vue Tickets ; basculer vers Commits doit reproduire exactement le rendu actuel (non-régression) ; cliquer une carte ticket doit atterrir sur Tableau avec le panneau Detail du bon ticket déjà ouvert ; vérifier aussi un ticket sans plan (bande absente, carte seule dans le fil) et un ticket dont le plan référencé n'existe plus sur disque.
