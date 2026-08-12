---
{
  "status": "open",
  "title": "Sélecteur d'éléments (Navigateur) — panel à la demande + ticket manuel",
  "opened": "2026-08-12",
  "closed": null,
  "commits": [
    {
      "sha": "282c8d6",
      "date": "2026-08-12",
      "files": [
        "app/src/App.tsx",
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/Tableau.tsx",
        "hooks/i18n.d.ts",
        "hooks/i18n.js"
      ]
    }
  ]
}
---

# Sélecteur d'éléments (Navigateur) — panel à la demande + ticket manuel

## Contexte

Le panel de l'élément sélectionné (`ElementPanel`, `app/src/tabs/Navigateur.tsx:859-963`)
est actuellement **toujours monté**, en largeur fixe 340px, colonne droite de l'onglet
Navigateur — un choix de la maquette 2c documenté en commentaire (ligne 679-681 et
852-858) qui, à l'usage, gêne plus qu'il n'aide : le panel prend de la place en
permanence même quand rien n'est sélectionné, et sa largeur ne se règle pas.

Le bouton « Ouvrir un ticket depuis l'élément » (`creerTicket`, ligne 490-506) crée
aujourd'hui un ticket **immédiatement**, avec un titre auto-généré depuis le texte de
l'élément (`titreDepuis`, ligne 216-217) — souvent non pertinent (texte tronqué, vide,
ou juste le nom de la route). Le ticket qui en résulte a un titre qu'il faut renommer à
la main de toute façon, ce qui n'apporte rien par rapport à une création manuelle.

Objectif : le panel ne s'ouvre que quand un élément est sélectionné, redimensionnable,
et le geste « ticket depuis un élément » redirige vers la création de ticket normale
(titre tapé à la main) tout en joignant automatiquement le contexte de l'élément
(sélecteur, texte, HTML, route) au ticket — sans que l'utilisateur ait à le
recopier.

## Panel à la demande + redimensionnable

Fichier : `app/src/tabs/Navigateur.tsx`.

- Ligne 829-837 : n'afficher `<ElementPanel>` (et son séparateur) que si `picked` n'est
  pas `null` — `{picked && (<><Divider ... /><ElementPanel picked={picked} ... /></>)}`.
  `ElementPanel` peut alors prendre `picked: Picked` (non-nullable) au lieu de
  `Picked | null` : plus besoin de la branche `no_element_selected` (ligne 932-936) ni
  du `{picked && (...)}` autour du bouton de fermeture (ligne 884-893) — le panel
  n'existe que quand il y a quelque chose à fermer.
- Redimensionnement : même mécanique que les DevTools (`paneWidth`, ligne 293-300) —
  un `useResizable` de plus, clé `'navigateur.element-panel'`, `axis: 'x'`,
  `invert: true` (tirer vers la gauche agrandit, le panel est à droite), `initial: 340`
  (valeur actuelle, pour ne rien déplacer visuellement par défaut), `min: 280`,
  `max: () => window.innerWidth * 0.5`. Le `width: 340px` en dur ligne 879 devient
  `width: ${size}px` piloté par ce hook, et un `<Divider axis="x" resizable={...} />`
  (déjà importé de `useResizable.tsx`) se pose entre la colonne principale et le panel,
  au même endroit que celui des DevTools (ligne 748).
- `routes`/`currentRoute` (routes connues) restent inchangés — affichés à l'intérieur
  du panel tant qu'il est monté, donc tant qu'un élément est sélectionné.

## Ticket depuis un élément : redirection, pas création automatique

Le titre ne doit plus jamais venir de `picked.text`. Le contexte de l'élément (ce que
produit déjà `corpsDepuis`, ligne 220-233) doit en revanche être joint sans ressaisie.
Comme la création de ticket dans `Tableau.tsx` écrit sur disque dès la frappe d'Entrée
(`creer`, ligne 164-169 → `ticketAction('create', ...)`, pas de brouillon client — voir
`Detail`, ligne 922+, qui n'opère que sur un ticket déjà persistant), la bonne
intégration est de **faire atterrir l'utilisateur sur la création normale de l'onglet
Tableau**, avec le contexte prêt à être attaché au prochain ticket qu'il crée — pas un
nouveau système de brouillon.

### `Navigateur.tsx`

- Supprimer `titreDepuis` (ligne 216-217, plus utilisée), l'import `ticketAction`
  (ligne 4), l'état `ticketing` (ligne 272) et les clés i18n
  `navigateur.ticket_creating`/`ticket_created`/`ticket_failed`.
- Remplacer `creerTicket` (ligne 490-506) par un handoff synchrone :
  ```ts
  const onTicketDepuisElement = () => {
    if (!picked) return
    onCreerTicketDepuisElement(corpsDepuis(picked), ['navigateur'])
    setPicked(null)
  }
  ```
- Nouvelle prop du composant `Navigateur` : `onCreerTicketDepuisElement: (corps: string, tags: string[]) => void`.
- `ElementPanel` perd sa prop `ticketing` (plus de latence réseau à ce stade) ; le
  bouton (ligne 921-929) reste un `btn btn-secondary` mais sans état de chargement.

### `App.tsx`

Même famille de pattern que `onOuvrirDansNavigateur` (ligne 461-466) et `focusTicket`
(ligne 149, 155-157) :

- Nouvel état : `const [contexteElement, setContexteElement] = useState<{ corps: string; tags: string[] } | null>(null)`.
- Nouvelle fonction, à côté de `onOuvrirDansNavigateur` :
  ```ts
  const onCreerTicketDepuisElement = (corps: string, tags: string[]) => {
    setTab('tableau')
    setLayout(l => (l === 'full' ? 'bottom' : l))
    setContexteElement({ corps, tags })
    pushUrl('/tableau', current)
  }
  ```
- Étendre l'effet ligne 155-157 (celui qui efface `focusTicket` après son montage) pour
  effacer aussi `contexteElement` — même raison : `Tableau` le lit une fois à son
  montage, une revisite de l'onglet sans nouvelle sélection ne doit pas le rouvrir.
- Passer `onCreerTicketDepuisElement` à `<Navigateur>` et `contexteElement` à
  `<Tableau>` (ligne 666-676).

### `Tableau.tsx`

- Nouvelle prop `contexteElement: { corps: string; tags: string[] } | null`, consommée
  une fois comme `focusTicket` l'est ailleurs dans l'app :
  `const [enAttente, setEnAttente] = useState(() => contexteElement)`.
- Bandeau, même famille que celui de `filtreEpic` (ligne 269-284) : si `enAttente`,
  afficher une bannière au-dessus des colonnes — « Élément du Navigateur prêt à joindre
  — tapez le titre du ticket. » avec un bouton « Annuler » qui fait `setEnAttente(null)`
  (et referme le champ ouvert automatiquement, voir ci-dessous).
- Ouverture automatique du champ de saisie de la **première colonne** (`board[0]`,
  même colonne que le défaut serveur de `createTicket`, `hooks/tickets.js`) quand
  `enAttente` est posé — un geste de moins que de cliquer soi-même sur son bouton
  « + ». `ColonneVue` (ligne 378-427) reçoit une nouvelle prop
  `saisieOuverte?: boolean`, passée uniquement à la colonne d'index 0 depuis la boucle
  `board.map` (ligne 305-334) : `saisieOuverte={index === 0 && Boolean(enAttente) && !edition}`.
  Son état interne `saisie` (ligne 426) s'initialise en conséquence :
  `useState<string | null>(() => (saisieOuverte ? '' : null))` — l'input existant
  (ligne 587-604, `autoFocus` déjà présent) s'affiche donc déjà rempli d'une chaîne
  vide et prêt à taper, sans changement à son JSX. Annuler la bannière doit aussi vider
  ce champ : le plus simple est de dériver `saisieOuverte` d'`enAttente` côté parent et
  de laisser `ColonneVue` re-synchroniser via un `useEffect([saisieOuverte])` qui
  referme (`setSaisie(null)`) si `saisieOuverte` redevient `false`.
- `creer` (ligne 164-169) : quand `enAttente` est posé, joindre son contenu à la
  création et ouvrir le ticket créé pour que l'utilisateur finisse de le remplir
  (priorité, charge, tags) :
  ```ts
  const creer = async (titre: string, colonne: string) => {
    if (!titre.trim()) return
    if (!enAttente) {
      ecrire({ board, tickets }, 'create', { titre, colonne })
      return
    }
    setErreur(null)
    try {
      const avant = new Set(tickets.map(t => t.file))
      const suivant = await ticketAction('create', root, {
        titre,
        colonne,
        corps: enAttente.corps,
        tags: enAttente.tags,
      })
      onChange(suivant)
      const nouveau = suivant.tickets.find(t => !avant.has(t.file))
      if (nouveau) setOuverte(nouveau.file)
      setEnAttente(null)
    } catch (err) {
      setErreur(String((err as Error).message ?? err))
    }
  }
  ```
  (`ticketAction` est déjà importé dans `Tableau.tsx` via `data.ts` — même fonction que
  `ecrire` utilise.)

### `hooks/i18n.js`

- Supprimer `navigateur.ticket_creating`, `navigateur.ticket_created`,
  `navigateur.ticket_failed`, `navigateur.no_element_selected` (FR et EN — le panel ne
  se démonte plus jamais sur un état vide, ces messages ne s'affichent plus).
- Ajouter deux clés (FR/EN) pour la bannière de `Tableau` : par ex.
  `tableau.element_context_banner` et `tableau.element_context_cancel` (« Annuler » /
  « Cancel »).

## Vérification

- `pnpm typecheck` (les nouvelles props sont typées).
- `pnpm test` (les tests d'`app/src` ne font qu'un rendu-instantané par onglet sur des
  snapshots dégradés — vérifier qu'ils ne lèvent toujours pas avec les nouvelles props
  optionnelles/props par défaut).
- `pnpm electron`, dans l'onglet Navigateur : sélectionner un élément → le panel
  s'ouvre à droite (pas avant), tirer son bord gauche le redimensionne et la taille
  survit à un changement d'onglet ; fermer (✕) le referme entièrement. Cliquer
  « Ouvrir un ticket depuis l'élément » → bascule sur l'onglet Tableau, bannière
  visible, cliquer « + » sur une colonne, taper un titre, Entrée → le ticket s'ouvre en
  détail avec le contexte de l'élément dans son corps et le tag `navigateur`, titre
  exactement celui tapé.
