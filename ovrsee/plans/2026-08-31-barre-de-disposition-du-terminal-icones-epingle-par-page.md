---
{
  "status": "closed",
  "title": "Barre de disposition du terminal : icônes + épingle par page",
  "opened": "2026-08-31",
  "closed": "2026-08-31",
  "commits": [
    {
      "sha": "0aaca82",
      "date": "2026-08-31",
      "files": [
        "app/src/App.tsx",
        "app/src/Terminal.tsx",
        "app/src/terminalPins.test.ts",
        "app/src/terminalPins.ts",
        "app/src/useResizable.tsx",
        "hooks/i18n.js"
      ]
    }
  ]
}
---

# Barre de disposition du terminal : icônes + épingle par page

## Contexte

La barre d'en-tête du panneau terminal consacre aujourd'hui ~250 px à trois
mots et un kicker : `DISPOSITION [ Bas | Côté | Plein ] Réduire`
(`app/src/Terminal.tsx:578-601`). Sur une barre de 36 px partagée avec les
pastilles de session, c'est la partie qui rogne le plus l'espace disponible
pour les onglets de shell — et trois libellés textuels pour un choix
géométrique, alors que les 7 vues du rail sont déjà pictographiées
(`views.ts`, `TAB_ICONS`).

Second manque : la taille du terminal est **globale à l'application**
(`settings.terminal.hauteur` / `.largeur`, une seule valeur pour les 7 onglets).
Or le besoin diffère par page : sur Tableau on veut un terminal court qui laisse
voir le Kanban ; sur Produit on le veut haut. Aujourd'hui chaque changement
d'onglet demande de retirer la poignée à la main.

**Résultat visé** : une barre de ~110 px au lieu de ~250, et une épingle qui
fige la hauteur du terminal pour l'onglet actif — en y revenant, il reprend
cette taille, et le séparateur ne bouge plus tant que l'épingle tient.

Arbitrages déjà pris avec l'utilisateur :
- l'épingle **mémorise ET verrouille**, par couple (onglet, disposition) ;
- « DISPOSITION » et « Réduire » passent tous deux en icônes ;
- une maquette (canvas Claude Design) précède le code.

---

## Étape 0 — Maquette (canvas Claude Design)

Avant tout code, publier un canvas via le skill `design`, artboards à l'échelle
réelle (barre de 36 px, jetons Nocturne, fond `--color-surface`) :

1. **Référence** — la barre actuelle, pour mesurer le gain.
2. **Compacte / bas / libre** — `[ ▤ ◪ ■ ] 📌 −`
3. **Compacte / bas / épinglée** — épingle en `weight="fill"` + `--color-accent`,
   séparateur inerte.
4. **Compacte / côté** — vérifier que les mêmes icônes tiennent quand le
   panneau fait 468 px de large.
5. **Jeu d'icônes alternatif** — `SidebarSimple` / `CornersOut` / `CaretDown`
   contre le jeu « trois carrés », pour trancher à l'œil.
6. **Panneau entier** — la barre en contexte, avec les pastilles de session à
   gauche, pour juger de l'équilibre.

La variante retenue est ce qu'implémentent les étapes suivantes.

---

## Étape 1 — Les icônes de disposition

`app/src/Terminal.tsx`.

Icônes vérifiées présentes dans `@phosphor-icons/react@2.1.10` :

| Disposition | Icône | Rendu |
|---|---|---|
| `bottom` | `SquareHalfBottom` | carré, moitié basse pleine |
| `side` | `SquareHalf` + `transform: rotate(180deg)` | carré, moitié **droite** pleine (l'icône est remplie à gauche par défaut) |
| `full` | `Square` `weight="fill"` | carré entièrement plein |
| réduire | `Minus` | — |
| épingle | `PushPin` (`weight="fill"` à l'état épinglé) | 📌 |

Une seule famille de carrés : la partie pleine dit littéralement où va le
terminal. Taille `13` (le barème du dépôt pour une icône en bouton compact,
cf. `Terminal.tsx:576`).

Modifications :

- Supprimer `<span className="kicker">{t('terminal.layouts')}</span>` ; la clé
  `terminal.layouts` sert désormais d'`aria-label` au `role="radiogroup"` posé
  sur le `.seg` — le libellé ne disparaît que visuellement.
- Dans la boucle `LAYOUT_IDS.map` : `title={layoutLabel(id)}` sur le `<label>`,
  `aria-label={layoutLabel(id)}` sur l'`<input>` — exactement la répartition
  déjà codée dans `Segmented` (`PreferencesControls.tsx:168` et `:177`).
  Le texte `{layoutLabel(id)}` cède la place à l'icône, `aria-hidden="true"`.
- Une constante de module pour le padding icône-seule (motif `ICONE` de
  `tabs/TableauDetail.tsx:78`) : `padding: 5px 8px;` — `.seg-opt` reste sinon
  calibré pour du texte. Ne rien inventer d'autre : `.seg` / `.seg-opt`
  (`_ds/ovrsee/styles.css:358-370`) portent déjà pastille active, survol et
  anneau de focus.
- Le bouton « Réduire » garde son `onToggle`, son `title` et son `aria-label`
  (`terminal.reduce`) et reçoit `<Minus size={13} aria-hidden="true" />`.

`layoutLabel()` (`Terminal.tsx:122-129`) reste tel quel : c'est lui qui
alimente maintenant infobulles et lecteurs d'écran.

---

## Étape 2 — Le magasin d'épingles

Nouveau fichier **`app/src/terminalPins.ts`** (~45 lignes), fonctions pures +
une fine enveloppe `localStorage` :

```ts
export type Pins = Record<string, number>          // clé `${tab}:${layout}`
export const pinKey = (tab: TabId, layout: Layout) => `${tab}:${layout}`
export function pinFor(pins, tab, layout): number | undefined   // undefined si layout === 'full'
export function togglePin(pins, tab, layout, size): Pins        // ajoute ou retire, sans muter
export function readPins(): Pins                                // try/catch, {} en repli
export function writePins(pins: Pins): void                     // try/catch silencieux
```

**Pourquoi `localStorage` et pas les préférences** : c'est une préférence de
poste, comme la largeur de la barre latérale qui y vit déjà
(`useResizable.tsx:43`, préfixe `ovrsee.size.`). La mettre dans
`settings.terminal` imposerait de toucher `hooks/settings.js` (défauts +
`validerTerminal`), ses tests, `SettingsType` (`data.ts:227`) et de la faire
transiter par l'API pour un réglage qui ne quitte jamais la machine. Clé :
`ovrsee.terminal.pins`.

`full` n'a pas de taille propre (`panelStyle`, `Terminal.tsx:138-146`) — donc
pas d'épingle : `pinFor` rend `undefined` et le bouton ne s'affiche pas.

**Test** — `app/src/terminalPins.test.ts`, style `node:test` / `node:assert`
existant (pas de framework, cf. `CLAUDE.md`) : forme de la clé, `togglePin`
ajoute puis retire, immuabilité (l'entrée d'origine n'est pas mutée),
`pinFor` rend `undefined` pour `full` et pour un onglet non épinglé.
Compilé et exécuté par `scripts/test-ui.js` sans changement.

---

## Étape 3 — Le `setSize` silencieux (le point délicat)

`app/src/useResizable.tsx`.

`useResizable` notifie `onResize` depuis un `useEffect([size])`
(`useResizable.tsx:106-118`), et `App.tsx:204-220` écrit ensuite dans les
préférences après 300 ms. Restaurer une taille épinglée en changeant d'onglet
écraserait donc **la taille globale** par celle de l'onglet — régression
silencieuse.

Correctif minimal, sans toucher au chemin de glissement :

```ts
const quiet = useRef(false)
// dans l'effet de persistance, en tête : if (quiet.current) { quiet.current = false; return }
const setSizeQuiet = (next: number) => {
  const clamped = clamp(next)
  if (clamped === size) return          // sans ça le drapeau resterait armé
  quiet.current = true
  setSize(clamped)
}
```

`setSizeQuiet` est ajouté à l'interface `Resizable`. Le garde `clamped === size`
n'est pas cosmétique : sans re-rendu, l'effet ne tourne pas, et le drapeau
avalerait la prochaine vraie écriture.

`Divider` gagne `locked?: boolean` : à `true`, aucun gestionnaire n'est posé,
`cursor: default`, et le `title` dit que le panneau est épinglé plutôt que
d'inviter à glisser.

---

## Étape 4 — Câblage dans le panneau

`app/src/Terminal.tsx` :

- nouvelle prop `tab: TabId` (importée de `./views`) ;
- `const [pins, setPins] = useState<Pins>(readPins)` ;
- `const pinned = pinFor(pins, tab, layout)` ;
- effet sur `[tab, layout]` : si `pinned !== undefined`, `sizing.setSizeQuiet(pinned)` ;
- bouton épingle, rendu seulement si `layout !== 'full'`, en `.btn-icon`
  (`_ds/ovrsee/styles.css:325`, 27×27, définie et jamais utilisée jusqu'ici) :
  `aria-pressed={pinned !== undefined}`, `title` + `aria-label` traduits,
  `PushPin` en `weight="fill"` + `color="var(--color-accent)"` à l'état épinglé ;
- au clic : `const next = togglePin(pins, tab, layout, sizing.size); setPins(next); writePins(next)`.
  Dépingler ne fait **pas** sauter le panneau — la taille courante reste, seul
  le séparateur redevient actif ;
- `<Divider … locked={pinned !== undefined} />` (`Terminal.tsx:473`).

`app/src/App.tsx` : ajouter `tab={tab}` au montage de `<Terminal>` (l. 688-700).
`tab` existe déjà (`App.tsx:86`).

`hooks/i18n.js` : trois clés FR + EN à côté de `terminal.reduce` (l. 691 / 1466)
— `terminal.pin` (« Épingler cette taille sur cette page »), `terminal.unpin`
(« Détacher »), `terminal.pinned` (« Taille épinglée sur cette page »), cette
dernière servant de `title` au séparateur verrouillé.

---

## Ce que le plan ne fait pas

- **La disposition choisie dans la barre n'est toujours pas persistée.** Seul
  l'écran des préférences écrit `settings.terminal.disposition` ; la barre ne
  touche qu'un `useState` (`App.tsx:108`, `onLayout={setLayout}`). Asymétrie
  préexistante, hors périmètre — à signaler, pas à corriger ici.
- Pas de composant `IconButton` extrait : trois boutons ne justifient pas une
  abstraction, et le dépôt n'en a pas.
- Pas d'épingle sur `full` (aucune taille à retenir).

---

## Vérification

1. `pnpm lint && pnpm typecheck && pnpm test` — `terminalPins.test.ts` doit
   passer au vert, et `hooks/couleurs.test.js` ne doit rien relever (aucune
   couleur en dur : uniquement des `var(--color-*)`).
2. `pnpm electron` (le terminal n'existe pas sous `pnpm dev`) :
   - la barre montre trois carrés + épingle + moins ; survoler chacun donne
     l'infobulle française ;
   - `Tab` traverse le groupe, l'anneau de focus paraît, `Espace` change de
     disposition ;
   - basculer bas → côté → plein : l'icône active suit, `plein` masque le
     contenu, l'épingle disparaît ;
   - sur **Tableau**, tirer le terminal à ~380 px, cliquer l'épingle → l'icône
     se remplit, passer sur **Produit** → le terminal revient à sa taille
     globale, revenir sur **Tableau** → 380 px sont retrouvés ;
   - épinglé, la poignée ne répond plus (curseur normal, glissement inerte) ;
     dépingler la rend ;
   - **le test qui compte** : après un aller-retour d'onglet épinglé, ouvrir
     les préférences → la hauteur globale doit être restée à 244, pas passée
     à 380. C'est ce que garde l'étape 3.
3. Redémarrer l'application : l'épingle de Tableau tient (localStorage).
4. Ouvrir dans le navigateur (`pnpm dev`) : le panneau se rabat sur son mode
   sans session, la barre ne doit pas casser.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `app/src/Terminal.tsx` | icônes, bouton épingle, prop `tab`, effet de restauration |
| `app/src/useResizable.tsx` | `setSizeQuiet`, `locked` sur `Divider` |
| `app/src/terminalPins.ts` | **nouveau** — magasin d'épingles, fonctions pures |
| `app/src/terminalPins.test.ts` | **nouveau** — `node:test` |
| `app/src/App.tsx` | `tab={tab}` sur `<Terminal>` |
| `hooks/i18n.js` | 3 clés FR + EN |
