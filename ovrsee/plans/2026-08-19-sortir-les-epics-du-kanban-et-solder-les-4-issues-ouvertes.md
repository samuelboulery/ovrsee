---
{
  "status": "open",
  "title": "Sortir les epics du Kanban, et solder les 4 issues ouvertes",
  "opened": "2026-08-19",
  "closed": null,
  "commits": []
}
---

# Sortir les epics du Kanban, et solder les 4 issues ouvertes

## Contexte

Quatre issues sont ouvertes sur le dépôt. Trois d'entre elles disent la même
chose sous trois angles :

- **#21** — un epic a un `colonne` unique alors que ses enfants sont éparpillés
  entre « Backlog » et « Fait ». L'epic doit être posé d'un côté ou de l'autre,
  et le choix est toujours faux.
- **#19** — déplacer un epic ne déplace pas ses enfants ; il faut les reprendre
  un par un.
- **#9** (déjà close, corrigée au rustinage en T-0147) — un enfant rendu *dans*
  la carte de son epic ne s'ouvrait pas au clic.

La racine commune : un epic est aujourd'hui **une carte comme une autre**, posée
dans une colonne, qui contient visuellement ses enfants (`groupEpics`,
`enfantsIci`). Un conteneur qui a lui-même un statut de colonne est une
contradiction — d'où les trois symptômes.

La décision prise : **l'epic sort du Kanban**. Il devient un objet à part, avec
sa propre vue et un état **entièrement dérivé de ses enfants**. #19 ne se
corrige pas, il cesse d'exister — on ne peut plus déplacer un epic. Et « un epic
ne peut pas être terminé s'il reste des tickets en attente » devient vrai par
construction, pas par garde-fou.

Les deux autres issues touchent le panneau terminal et sont indépendantes :
**#18** (savoir quelles sessions Claude ont fini sans changer d'onglet) et
**#20** (renommer un terminal).

Aucun changement de format sur disque : `"type": "epic"` et `"epic": "T-XXXX"`
restent tels quels. Le `colonne` d'un epic reste écrit dans son fichier, il
n'est simplement plus lu par l'interface. Pas de migration, l'invariant
« l'ovrsee lit » tient.

---

## 1. L'état dérivé d'un epic — `app/src/data.ts`

À poser juste après `epicProgress` (`app/src/data.ts:927`), qui reste inchangé
et sert à la barre de progression.

```ts
export type EpicEtat = 'vide' | 'non-commencee' | 'en-cours' | 'terminee'

/**
 * L'état d'un epic se déduit de ses enfants, jamais de son propre `colonne`.
 * Un epic ne peut donc pas être « terminé » tant qu'un enfant traîne — c'est
 * vrai par construction, il n'y a rien à garder.
 */
export const epicEtat = (children: Ticket[], board: Colonne[]): EpicEtat => {
  const enfants = liste(children)
  if (enfants.length === 0) return 'vide'
  const finale = colonneFinale(board)
  if (finale && enfants.every(t => t.colonne === finale)) return 'terminee'
  const premiere = liste(board)[0]?.id ?? null
  if (premiere && enfants.every(t => t.colonne === premiere)) return 'non-commencee'
  return 'en-cours'
}
```

Réutilise `liste()`, `colonneFinale()` (`data.ts:945`) et `childrenOf()`
(`data.ts:915`) qui existent déjà. `restant()` (`data.ts:965`) n'a **pas** à
changer : elle exclut déjà un epic qui a des enfants du décompte.

**Tests** — `app/src/data.test.ts`, dans le style existant (`node:test`,
`node:assert`, pas de framework), à côté des tests `epicProgress` (ligne 220) :
les quatre états, plus le tableau à une seule colonne (où `colonneFinale` rend
`null` et où « tout en première colonne » doit donner `non-commencee`, jamais
`terminee`).

---

## 2. Le Kanban ne montre plus que des tickets — `app/src/tabs/Tableau.tsx`

Ce lot **retire** plus qu'il n'ajoute (le fichier est à 1223 lignes, T-0135
signale déjà le dépassement des 800) :

- **Supprimer `groupEpics`** (lignes 45-67) et son appel (ligne 357). Elle
  n'existait que pour recoller les enfants sous leur epic dans une colonne.
- **Filtrer les epics hors des colonnes** :
  `tickets.filter(t => t.colonne === colonne.id && t.type !== 'epic')`.
- **Supprimer le rendu imbriqué** : la prop `enfantsIci` de `ColonneVue`
  (ligne 726) et de `Carte` (ligne 829), le bloc d'enfants imbriqués en fin de
  `Carte`, et le filtre ligne 719 qui masquait un enfant dont l'epic était dans
  la même colonne. Un enfant est désormais **toujours** une carte de plein droit
  dans sa colonne. Le `stopPropagation` posé en T-0147 (lignes 846-848) et son
  commentaire tombent avec le nid qu'ils rustinaient.
- **Supprimer `filtreEpic`** (état ligne 133, bandeau lignes 315-331, prop
  `setFiltreEpic` traversant `ColonneVue` → `Carte`, bouton « Voir les N
  enfants »). La vue Epics remplace ce détour.
- **Garder** la puce « Enfant de T-XXXX » sur la carte enfant (lignes 924-930)
  et le bouton « Détacher » : c'est le seul rappel du parent dans le Kanban.

Ajouts :

- Un état `const [vue, setVue] = useState<'kanban' | 'epics'>('kanban')`.
- Un segmenté **[ Kanban | Epics ]** dans les `children` de `ViewBar`
  (ligne 285), avec les classes `seg` / `seg-opt` déjà utilisées dans
  `Terminal.tsx:385-395` — `ViewBar` est prévue pour ça (cf. son commentaire).
- `vue === 'epics'` rend `<TableauEpics>` à la place de la bande de colonnes ;
  le panneau `<Detail>` (ligne 395) reste **hors** du branchement et sert les
  deux vues, `ouverte` / `setOuverte` inchangés.
- Dans `Detail`, quand `ticket.type === 'epic'` : masquer le sélecteur de
  colonne et afficher la pastille d'état dérivé à la place. La case « Epic » et
  le sélecteur de parent (lignes 1089-1117) ne bougent pas.

---

## 3. La vue Epics — nouveau `app/src/tabs/TableauEpics.tsx`

Fichier neuf (~150 lignes) plutôt que du volume de plus dans `Tableau.tsx`.

Props : `{ tickets, board, onOuvrir, ouverte }`. Aucune écriture, aucun
glisser-déposer — c'est une liste.

Pour chaque `t.type === 'epic'`, trié comme le reste par `sortTickets` :

```
T-0017  Dashboard de santé                      [ en cours ]
        ███████░░░  3/5
        ↳ T-0018  Backend : git-status…          fait
        ↳ T-0019  Frontend : dashboard…          en cours
```

- Enfants par `childrenOf(tickets, epic.id)`, chacun avec le **titre de sa
  colonne** lue dans `board` (pas son id).
- Progression par `epicProgress(children, colonneFinale(board))`.
- Pastille d'état par `epicEtat(children, board)` — jetons Nocturne, couleur par
  état, via `s()`.
- Clic sur une ligne (epic ou enfant) → `onOuvrir(ticket.file)` : le panneau
  `Detail` s'ouvre exactement comme depuis le Kanban.
- Deux cas limites à rendre, pas à ignorer : un epic **sans enfant** (état
  « vide », dire qu'il n'a pas d'enfant) et les **enfants orphelins** (un `epic`
  pointant un id absent) regroupés en fin de liste — `orphanChildren` existe
  côté hooks (`hooks/tickets.js:769`), le pendant côté UI est un `filter` d'une
  ligne.
- État vide de la vue : aucun epic → un texte, pas une page blanche.

`render.test.tsx` a déjà des instantanés « epic avec enfants », « enfant
orphelin » et « boucle d'epics » (lignes 61-81) : ils couvriront cette vue dès
qu'elle est montée par l'onglet, à condition de basculer `vue` dans le cas de
test — sinon ajouter un cas qui la rend directement.

---

## 4. #18 — pastille d'état par onglet terminal — `app/src/Terminal.tsx`

Tout le signal existe déjà : `hooks/ovrsee-notify.js` émet une séquence OSC,
`extractAttention` (`app/src/attention.ts:91`) la sort du flux, et
`Terminal.tsx:151` la range dans `attentions.current[sessionKey]` avec un
`setSignaux(n => n + 1)` qui provoque déjà le rendu. **Rien à câbler**, il n'y a
qu'à afficher.

Dans la boucle d'onglets (`Terminal.tsx:330-368`), la pastille de 5 px
(lignes 339-343) ne dit aujourd'hui que « actif / inactif ». Lui donner sa
couleur depuis `attentions.current[session.key]` :

| Signal | Couleur | `title` / `aria-label` |
|---|---|---|
| `kind: 'question'` | accent (attend une réponse) | `terminal.attention_question` |
| `kind: 'stop'` | vert (Claude a rendu la main) | `terminal.attention_stop` |
| aucun / onglet actif | comportement actuel | — |

Effacer le signal quand l'onglet devient actif (dans le `onClick` de
`setActive`) : on l'a vu, il n'a plus rien à dire. Pas de minuterie de
péremption côté panneau — `tray.js` en a une parce que la barre de menu survit à
la fenêtre ; ici l'onglet est sous les yeux.

---

## 5. #20 — renommer un terminal — `useTerminal.ts` + `Terminal.tsx`

- `useTerminals` expose `renommer(key: string, label: string)` : réécrit la
  `Session` dans `sessionsByProject.current` puis `setSessions`. Modèle exact de
  `closeShell` (`useTerminal.ts:437`). Un label vide est ignoré (on garde
  l'ancien).
- Dans l'onglet, double-clic sur le libellé → `<input>` en place, `Enter`
  valide, `Escape` et `blur` annulent. Même motif que la saisie de titre de
  colonne dans `Tableau.tsx`.
- L'onglet Claude se renomme aussi : seule sa **fermeture** est interdite.

**Pas de persistance** — `sessionsByProject` vit en mémoire, les sessions
meurent avec l'application de toute façon. Écrire dans `localStorage` un nom qui
survivrait à un terminal disparu serait du code pour un état fantôme.

---

## 6. Textes, docs, tickets

- **`hooks/i18n.js`** — nouvelles clés dans les **deux** tables (fr ~ligne 474,
  en ~ligne 1230) : `tableau.view_kanban`, `tableau.view_epics`,
  `tableau.epic_state_empty|todo|doing|done`, `tableau.epic_no_children`,
  `tableau.epic_orphans`, `tableau.no_epics`, `terminal.rename`,
  `terminal.rename_aria`, `terminal.attention_stop`,
  `terminal.attention_question`. Retirer les clés devenues mortes
  (`tableau.children_of`, `tableau.view_children`) des deux tables.
- **`~/.claude/skills/ovrsee-tickets/SKILL.md`**, section « Epics » (lignes
  165-192) — hors dépôt, à corriger quand même : l'interface n'affiche plus les
  epics dans les colonnes, un epic a une vue à lui, son `colonne` n'est plus lu,
  et son état se déduit de ses enfants.
- **`CLAUDE.md`**, « Pièges connus » — une puce : *le `colonne` d'un epic est
  inerte, son état se dérive de ses enfants ; un epic ne se glisse plus.*
- **`CHANGELOG.md`** et **`CHANGELOG.fr.md`**.
- **Tickets `ovrsee/tickets/`** via le skill `ovrsee-tickets`, sous un epic
  « Refonte des epics et du panneau terminal » : un ticket par lot (1 à 5), plus
  un ticket de documentation (lot 6).

---

## Vérification

```bash
pnpm lint && pnpm typecheck && pnpm build:ui
pnpm test          # node:test seul — data.test.ts, render.test.tsx, hooks/
```

Puis à la main, dans **Electron** (`pnpm dev` ne donne pas le terminal) :

```bash
pnpm electron
```

1. **Onglet Tableau, vue Kanban** — aucune carte epic dans les colonnes ; les
   enfants apparaissent chacun dans leur colonne avec leur puce « Enfant de » ;
   cliquer un enfant ouvre **cet** enfant (non-régression #9) ; le
   glisser-déposer d'un ticket marche toujours.
2. **Bascule Epics** — les 12 epics du dépôt sont listés ; T-0123 (8 enfants
   tous en « fait ») porte « terminée » ; un epic à enfants mélangés porte « en
   cours » ; cliquer un epic puis un enfant ouvre le bon panneau. Vérifier
   qu'aucun epic n'est déplaçable — le geste n'existe plus.
3. **Terminal** — ouvrir deux sessions, lancer `claude` dans la seconde, la
   laisser finir depuis le premier onglet : la pastille du second passe au vert,
   et retombe au clic. Provoquer une demande de permission : pastille accent.
4. **Renommage** — double-clic sur « shell 1 », taper un nom, `Enter` ;
   `Escape` annule ; le nom tient après une bascule de projet et retour.
5. **Fermer les 4 issues** : #19 et #21 par ce lot (#19 en expliquant qu'elle
   disparaît plutôt qu'elle n'est corrigée), #18 et #20 en les référençant dans
   le message de commit.
