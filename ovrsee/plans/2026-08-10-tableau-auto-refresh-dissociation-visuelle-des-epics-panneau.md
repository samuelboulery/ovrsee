---
{
  "status": "closed",
  "title": "Tableau : auto-refresh, dissociation visuelle des epics, panneau en lecture",
  "opened": "2026-08-10",
  "closed": "2026-08-10",
  "commits": [
    {
      "sha": "7ae9fcc",
      "date": "2026-08-10",
      "files": [
        "app/src/data.ts",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Branches.tsx",
        "app/src/tabs/Environnements.tsx",
        "app/src/tabs/Sante.tsx",
        "hooks/git-status.js",
        "hooks/git-status.test.js",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/ovrsee-capture-audit.js",
        "hooks/snapshot.js",
        "hooks/snapshot.test.js",
        "server/api.js",
        "server/api.test.js"
      ]
    },
    {
      "sha": "cb13656",
      "date": "2026-08-10",
      "files": []
    },
    {
      "sha": "b03387b",
      "date": "2026-08-10",
      "files": [
        "app/src/App.tsx",
        "app/src/data.ts",
        "app/src/tabs/Tableau.tsx",
        "hooks/i18n.d.ts",
        "hooks/i18n.js"
      ]
    }
  ]
}
---

# Tableau : auto-refresh, dissociation visuelle des epics, panneau en lecture

## Contexte

Le skill `ovrsee-tickets` écrit directement `ovrsee/tickets/*.md` et
`ovrsee/board.json` sur disque, hors de l'app — typiquement depuis une session
Claude Code parallèle à l'app ouverte. L'onglet Tableau ne se met à jour
qu'au clic sur `reload()` (menu/bouton) : un ticket créé par le skill reste
invisible tant que l'utilisateur ne rafraîchit pas à la main. Objectif :
que l'onglet Tableau se mette à jour tout seul quand des tickets changent
sur disque.

En cours de route, deux lacunes connexes sur le même onglet sont à corriger :
les epics ne se distinguent pas assez d'un ticket normal dans une colonne
(seul un petit tag « epic » les marque, et leurs enfants peuvent être
dispersés n'importe où dans la colonne), et cliquer une carte ouvre
directement tous les champs en édition — un simple coup d'œil sur un ticket
déclenche donc une surface d'inputs, pas une lecture.

Le endpoint `GET /api/tickets?path=<root>` existe déjà et renvoie
`{ board, tickets }` (`server/api.js:399-413`, cas `method !== 'POST'` →
`tableau(root)`) — aucun changement serveur nécessaire. Aucune des trois
implémentations (`resolve()` partagé entre Vite, Electron, MCP) n'a besoin
d'être touchée.

Le tableau vit déjà dans le `snapshot` de `App.tsx`, pas dans l'état de
l'onglet (`App.tsx:317-327`, commentaire explicite : un ticket déplacé doit
survivre à un changement d'onglet). Un polling léger sur `snapshot` reproduit
exactement ce chemin déjà utilisé par `ticketAction` → `setTableau`.

Aucun mécanisme de rafraîchissement automatique n'existe ailleurs dans l'app
(aucun `setInterval`/`EventSource` trouvé dans `app/src`), et aucun
file-watcher côté serveur (`chokidar`/`fs.watch`) n'est en place. Ajouter l'un
ou l'autre serait la voie "propre" mais dépasse largement le besoin : un
polling toutes les 4s sur un endpoint déjà minimal (`board` + `tickets`
seulement, pas tout le snapshot) est la voie la plus simple qui marche.

## Changements

### 1. `app/src/data.ts`

Ajouter un wrapper GET à côté de `ticketAction` (~ligne 669, après la
fonction existante) :

```typescript
export const fetchTableau = (path: string, signal?: AbortSignal) =>
  json<Tableau>(`/api/tickets?path=${encodeURIComponent(path)}`, signal)
```

Réutilise le helper `json<T>()` déjà utilisé par `fetchSnapshot` (ligne
682-683) — même pattern, même gestion d'erreur.

### 2. `app/src/App.tsx`

Ajouter un `useEffect` de polling juste après celui qui charge le snapshot
(`App.tsx:297-315`), sur le même `current` :

```typescript
useEffect(() => {
  if (!current) return
  const timer = setInterval(() => {
    fetchTableau(current).then(setTableau).catch(() => {})
  }, 4000)
  return () => clearInterval(timer)
}, [current])
```

- Réutilise `setTableau` déjà défini (ligne 326-327), qui merge `board` +
  `tickets` dans le snapshot sans toucher au reste (captures, historique...).
- Erreurs silencieuses : un poll raté ne doit pas afficher d'erreur bloquante
  (contrairement au chargement initial) — juste retenter au prochain tick.
- Pas de gate sur l'onglet actif : le tableau vit dans le snapshot, pas dans
  l'onglet, donc le garder à jour même onglet fermé est cohérent avec
  l'existant et évite un flash de contenu périmé au moment où l'utilisateur
  revient sur Tableau.

Import `fetchTableau` à ajouter à côté des imports existants de `data.ts`.

### 3. Dissociation visuelle des epics — `app/src/tabs/Tableau.tsx`

**Style de la carte epic** (fonction `Carte`, ~ligne 720-731) : en plus du tag
« epic » déjà présent, donner à la carte elle-même une bordure et un fond
teintés accent, sur le modèle déjà utilisé pour le bandeau `filtreEpic`
(`Tableau.tsx:238`, `color-mix(in srgb, var(--color-accent) 15%, transparent)`) :

```typescript
style={s(
  'border: 1px solid ' + (isEpic ? 'var(--color-accent-600)' : 'var(--color-neutral-800)') +
  '; border-radius: 8px; padding: 10px 11px; background: ' +
  (isEpic ? 'color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))' : 'var(--color-surface)') +
  '; cursor: pointer;'
)}
```

**Liseré des enfants** : une carte dont `ticket.epic` pointe vers un epic
existant (`parentEpic`, déjà calculé ligne 724) reçoit un liseré gauche coloré
accent — même technique que le liseré de dépose déjà utilisé sur les colonnes
(`Tableau.tsx:399-403`, `box-shadow: inset 3px 0 0 var(--color-accent)`).
S'applique que l'enfant soit dans la même colonne que son epic ou non — c'est
un indicateur d'appartenance, pas seulement un effet de regroupement.

**Regroupement dans la colonne** : `sortTickets` (`data.ts:793-798`) trie par
priorité puis date, sans notion d'epic — les enfants d'un même epic peuvent
donc se retrouver dispersés dans la colonne. Comme l'ordre affiché n'est
jamais persisté (recalculé à chaque rendu, `Tableau.tsx:278`), un
regroupement purement visuel est sûr : ajouter une fonction locale à
`Tableau.tsx`, appliquée seulement à l'affichage, qui fait suivre chaque epic
de ses enfants présents dans la même colonne (ceux d'une autre colonne restent
à leur place, non regroupables) :

```typescript
const groupEpics = (tickets: Ticket[]): Ticket[] => {
  const rendus = new Set<string>()
  const suite: Ticket[] = []
  for (const ticket of tickets) {
    if (rendus.has(ticket.file)) continue
    suite.push(ticket)
    rendus.add(ticket.file)
    if (ticket.type !== 'epic') continue
    for (const enfant of tickets) {
      if (enfant.epic === ticket.id && !rendus.has(enfant.file)) {
        suite.push(enfant)
        rendus.add(enfant.file)
      }
    }
  }
  return suite
}
```

Appliquée en ligne 278 : `tickets={groupEpics(sortTickets(ticketsAffichables.filter(...)))}`.
Ne touche pas à `sortTickets` global (toujours utilisé tel quel par
`childrenOf` et ailleurs) — le regroupement reste local à l'affichage du
tableau.

### 4. Panneau de détail en lecture par défaut — `app/src/tabs/Tableau.tsx`, `Detail` (ligne 833-988)

Le composant `Detail` gagne un état local `edition` (initialisé à `false`) :

```typescript
const [edition, setEdition] = useState(false)
```

Comme le panneau est démonté/remonté à chaque ticket (`key={selection.file}`,
`Tableau.tsx:317`), rouvrir un autre ticket revient toujours en lecture — pas
de reset explicite à écrire.

**En-tête** : à côté du bouton « Fermer » existant (ligne 862-864), un bouton
« Modifier » / « Terminer » qui bascule `edition`, sur le modèle exact du
bouton d'édition des colonnes (`Tableau.tsx:224-234`).

**Mode lecture** (`!edition`) : titre en texte (pas d'`<input>`), colonne /
priorité / charge en ligne de texte (pas de `<select>`), tags en pastilles
(réutilise le rendu déjà présent sur `Carte`, ligne 779-799), statut epic /
epic parent en texte, description rendue dans un `<div>`
(`white-space: pre-wrap`) au lieu du `<textarea>`. Le pied de page
(créé/modifié/fichier/plan lié, lignes 963-967) reste identique dans les deux
modes.

**Mode édition** (`edition`) : le formulaire actuel, inchangé — mêmes
`<input>`/`<select>`/`<textarea>` avec les mêmes `onModifier`/`onDeplacer`.

**Suppression** : le bouton « Supprimer » + sa confirmation (lignes 969-985)
ne s'affichent qu'en mode édition — cohérent avec l'objectif « lecture pour
comprendre, édition explicite pour changer ».

**i18n** (`hooks/i18n.js`, section `tableau.*`, lignes ~407-448, FR + EN) :
ajouter deux clés pour le bouton, ex. `tableau.edit_ticket` (« Modifier » /
"Edit") et réutiliser `tableau.finish_editing` (« Terminer ») déjà présent
pour l'état basculé — même paire que celle du bouton de colonnes.

## Hors périmètre

- Pas de file-watcher (`chokidar`/`fs.watch`) ni de push SSE/IPC — sur-dimensionné
  pour un `board.json` de quelques Ko relu toutes les 4s.
- Pas de pause sur `visibilitychange` (onglet navigateur en arrière-plan) —
  ajoutable plus tard si le polling devient un problème mesurable.
- Pas de changement à `server/api.js` : la route GET existe déjà et fait
  exactement ce qu'il faut.
- Pas de couleur distincte par epic (un seul accent pour tous) — suffisant
  pour « voir qu'un ticket appartient à un epic », une palette par epic est un
  problème différent (collision de couleurs à gérer) non demandé ici.
- Le regroupement visuel ne déplace pas un enfant d'une autre colonne — un
  epic et ses enfants répartis sur plusieurs colonnes du kanban restent
  chacun dans leur colonne, seul le liseré les relie visuellement.

## Vérification

1. `pnpm dev`, ouvrir un projet équipé dans l'app.
2. Depuis un terminal, invoquer le skill `ovrsee-tickets` (ou écrire
   directement un fichier dans `ovrsee/tickets/` + mettre à jour
   `board.json`) pour créer un ticket.
3. Attendre ≤4s sur l'onglet Tableau (ou un autre onglet, puis revenir) :
   le nouveau ticket doit apparaître sans clic sur reload.
4. Vérifier qu'un drag-and-drop en cours n'est pas perturbé par un poll qui
   arrive pendant l'interaction (le poll ne fait que remplacer `board`/
   `tickets` par la version disque, donc un déplacement déjà écrit via
   `ticketAction` doit rester stable).
5. Créer un epic avec 2-3 enfants dans la même colonne, vérifier visuellement
   la carte epic teintée, le liseré accent sur les enfants, et leur
   regroupement adjacent à l'epic dans la colonne. Déplacer un enfant dans une
   autre colonne, vérifier qu'il garde son liseré (indicateur d'appartenance)
   sans être regroupé (l'epic n'est plus dans sa colonne).
6. Cliquer un ticket : le panneau s'ouvre en lecture (pas d'`<input>` visible).
   Cliquer « Modifier » : les champs deviennent éditables, identiques à
   l'ancien comportement. Fermer et rouvrir un autre ticket : revient bien en
   lecture.
7. `pnpm test` pour vérifier qu'aucun test existant ne suppose un seul appel
   à `fetchSnapshot`/`fetchTableau`, ni le panneau de détail toujours en
   édition.
