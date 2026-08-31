---
{
  "status": "open",
  "title": "Issue #47 — voir les autres projets sans dérouler",
  "opened": "2026-08-31",
  "closed": null,
  "commits": [
    {
      "sha": "5dd23c9",
      "date": "2026-09-01",
      "files": [
        "app/src/App.tsx",
        "app/src/CommandPalette.tsx",
        "app/src/EtatSession.tsx",
        "app/src/Shell.tsx",
        "app/src/Terminal.tsx",
        "app/src/menubar.test.ts",
        "app/src/menubar.ts",
        "hooks/i18n.js"
      ]
    }
  ]
}
---

# Issue #47 — voir les autres projets sans dérouler

## Contexte

Avec plusieurs projets ouverts, rien à l'écran ne dit lequel attend une réponse.
Le Claude d'un autre projet peut poser une question et rester bloqué sans signal.
C'est l'issue #47, déjà spécifiée par le ticket **T-0217** (backlog).

**La donnée existe, elle n'est pas routée là.** Les signaux `question / busy / stop`
sont déjà stockés par projet (clé `<chemin>#claude`) et déjà agrégés pour la barre
de menu macOS (`composer()`, `app/src/menubar.ts:124`). Le `ProjectSwitcher` ne les
affiche pour aucun projet.

S'ajoutent trois demandes de la même session : borner la hauteur du dropdown,
un raccourci clavier de bascule, et ne lister que les projets récents dans ⌘K.

Décisions prises : pastille **agrégée** sur le bouton de la barre de titre ;
raccourci **⇧⌘1..9** (⌘1..9 est pris par les vues, `electron/menu.js:152`) ;
⌘K = 5 récents, dropdown = tous avec scroll.

---

## 1. Sortir la pastille d'état de `Terminal.tsx`

**Nouveau fichier `app/src/EtatSession.tsx`** — y déplacer tel quel le composant
`Etat` (`Terminal.tsx:85-137`) et la table `DIT_ATTENTION` (`:70-74`).

Non négociable : `Terminal.tsx` charge xterm et vit derrière un `lazy()` — c'est le
tiers du bundle. L'importer depuis `Shell.tsx` annulerait le découpage **en silence**
(même piège que `pasteToClaude`, documenté dans `CLAUDE.md`). Le nouveau fichier
n'importe rien de xterm.

`Terminal.tsx` l'importe désormais au lieu de le définir.

## 2. Router les sessions vers `App`

`app/src/Terminal.tsx` — une prop de plus, `onSessions: (s: MenuBarSession[]) => void`,
appelée dans **l'effet de publication qui existe déjà** (`:405-413`), à côté de
`menubar.report`. Même valeur, même `composer(ouvertes, attentions.current)` : source
partagée, pas dédoublée (critère T-0217).

Vider au démontage — `useEffect(() => () => onSessions([]), [])`. Panneau replié =
`Terminal` démonté (voir le commentaire `App.tsx:374`), donc plus aucun pty écouté :
annoncer un état qu'on ne reçoit plus serait un mensonge. Même limite que la barre de
menu aujourd'hui ; à écrire en commentaire, pas à masquer.

`app/src/App.tsx` — `const [sessions, setSessions] = useState<MenuBarSession[]>([])`,
passé à `<Terminal onSessions={setSessions}>` et à `<ProjectSwitcher sessions={…}>`.

## 3. La règle d'agrégation — fonction pure

`app/src/menubar.ts`, à côté de `composer()` :

```ts
/** question > au travail > au repos ; `null` = aucune session, jamais deviné. */
export const agregerEtat = (sessions: readonly MenuBarSession[]): AttentionKind | null => {
  if (sessions.length === 0) return null
  if (sessions.some(s => s.attention?.kind === 'question')) return 'question'
  if (sessions.some(s => s.attention?.kind === 'busy')) return 'busy'
  return 'stop'
}
```

`reset` n'arrive jamais ici : `Terminal.tsx:305-311` l'efface au lieu de le stocker.

**Tests** dans `app/src/menubar.test.ts` (`node:test`, style existant) : liste vide →
`null` ; une question parmi des `stop` → `question` ; un `busy` sans question →
`busy` ; sessions ouvertes toutes silencieuses (`attention: null`) → `stop`.

## 4. `ProjectSwitcher` — `app/src/Shell.tsx:294-391`

- **Pastille agrégée sur le bouton** (`:342`) : `agregerEtat(sessions)`. `null` →
  le carré d'accent actuel, inchangé. Sinon `<Etat>`. Le `title` du bouton dit
  lequel des deux on regarde.
- **Par ligne** : `ProjectRow` reçoit `etat = agregerEtat(sessions.filter(s => s.projet === project.path))`
  et le rend en tête de ligne. `null` → la pastille actuelle (accent / fantôme) :
  l'absence de session reste distincte du repos.
- **Scroll** : envelopper le seul `projects.map` dans
  `max-height: min(50vh, 320px); overflow-y: auto;`. Le bouton « + Ouvrir un projet »
  (`:372-386`) reste **hors** du conteneur, donc toujours visible.
- **Numéro de raccourci** à droite de chaque ligne pour les 9 premières, dans le style
  de `RailLink` (`Shell.tsx:465-469`) mais préfixé `⇧⌘`.

## 5. Raccourci ⇧⌘1..9 — `app/src/App.tsx:414-427`

Dans le listener `keydown` qui existe déjà (celui de ⌘, et ⌘K) :

```ts
if (event.shiftKey && /^Digit[1-9]$/.test(event.code)) {
  const projet = projects[Number(event.code.slice(5)) - 1]
  if (projet) { onProjetPick(projet.path); event.preventDefault() }
}
```

`event.code` et pas `event.key` : avec Shift, `⌘⇧1` rend `!` ou `&` selon la
disposition clavier. Ordre = celui de `projects`, déjà trié par `lastOpened`
(`hooks/snapshot.js:70-76`) — rien de neuf n'est écrit dans `projects.json`.

Pas d'entrée de menu natif : le listener du rendu marche dans Electron **et** dans le
navigateur, et aucun accélérateur ne prend ⇧⌘1..9.

**Au passage**, extraire `onProjetPick(path)` — le geste `setCurrent` + `pushUrl` est
aujourd'hui copié à l'identique en deux endroits (`App.tsx:522-525` et `:795-798`) ;
le raccourci en serait un troisième.

## 6. ⌘K — projets récents — `app/src/CommandPalette.tsx:75-86`, `:123-128`

- Recherche vide → `slice(0, 5)`. Recherche non vide → tous les projets qui filtrent,
  sans limite : la recherche continue de porter sur les 11.
- Titre de section : `q === '' ? t('palette.recent_projects') : t('sidebar.projects')`.
- Nouvelles clés dans `hooks/i18n.js` : FR « Projets récents » (~l. 785, à côté de
  `sidebar.projects`), EN « Recent projects » (~l. 1569).

---

## Hors périmètre, à dire

`ProjectRow` déclenche **un `fetchSnapshot` par projet non courant** à chaque ouverture
du dropdown (`Shell.tsx:512-524`). Réel, antérieur, non traité ici.

## Vérification

1. `pnpm lint && pnpm typecheck && pnpm test` — `agregerEtat` couvert, aucun onglet ne lève.
2. `pnpm electron`, deux projets équipés, terminal déplié :
   - lancer une tâche longue dans le Claude du projet **B**, revenir sur **A** →
     la pastille du bouton passe à « … » sans rechargement ; dérouler → la ligne de B
     porte l'état, celle de A non.
   - déclencher une demande de permission dans B → le bouton passe à « ? » (la question
     l'emporte sur le travail).
   - un projet jamais ouvert dans cette instance → aucune pastille d'état, pas un repos.
3. Barre de menu macOS : le popover montre toujours exactement ce qu'il montrait.
4. ⇧⌘3 bascule sur le 3ᵉ projet de la liste ; ⌘3 continue d'ouvrir la 3ᵉ vue.
5. Dropdown avec les 11 projets du registre : hauteur bornée, scroll interne,
   « + Ouvrir un projet » visible sans scroller.
6. ⌘K sans frappe : 5 lignes sous « Projets récents » ; taper le nom d'un projet
   ancien le trouve quand même.
7. `pnpm build:ui` — vérifier que le morceau xterm reste séparé (le déplacement de
   `Etat` est fait pour ça).
