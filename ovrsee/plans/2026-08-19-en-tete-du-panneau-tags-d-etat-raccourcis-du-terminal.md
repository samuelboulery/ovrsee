---
{
  "status": "open",
  "title": "En-tête du panneau, tags d'état, raccourcis du terminal",
  "opened": "2026-08-19",
  "closed": null,
  "commits": []
}
---

# En-tête du panneau, tags d'état, raccourcis du terminal

## Contexte

Trois constats d'usage sur ce qui vient d'être posé :

1. **L'en-tête du panneau de ticket forme une bande plus sombre**, et elle
   s'arrête avant les bords. Deux causes distinctes, visibles sur la capture de
   la modale : elle est peinte en `--color-bg` alors que son conteneur est en
   `--color-surface-panel`, et elle vit *dans* le rembourrage horizontal du
   conteneur au lieu de le traverser.
2. **Le tag « terminée » a un texte vert dans une bordure violette.** La couleur
   est posée en style inline sur une classe `tag-outline`, qui apporte, elle, la
   bordure accent. Le design system a déjà `tag-ok`, `tag-warn`, `tag-neutral` —
   fond, texte et bordure cohérents.
3. **Les raccourcis d'onglet ne s'appliquent pas au terminal.** ⌘W ferme la
   fenêtre même quand on tape dans un terminal, et rien n'ouvre un terminal de
   plus au clavier.

---

## 1. L'en-tête ne doit ni assombrir ni s'arrêter

`app/src/tabs/TableauDetail.tsx`. L'en-tête est collant (`position: sticky`) :
il lui faut un fond opaque, sinon le corps défilerait dessous en transparence.
Le fond juste est **celui de son conteneur**, pas `--color-bg`.

- `Enveloppe` pose `--detail-pad` sur son conteneur : `18px` pour le rail,
  `24px` pour la modale (`s()` sait écrire une propriété personnalisée —
  `app/src/style.ts:27`).
- L'en-tête devient
  `margin: 0 calc(-1 * var(--detail-pad)); padding: 4px var(--detail-pad) 12px; background: var(--color-surface-panel);`
  — il traverse le rembourrage au lieu de s'y asseoir, et disparaît comme bande.

---

## 2. Un tag d'état porte le style de son état

Une table de classes remplace la couleur inline, dans les **deux** endroits qui
rendent l'état d'un epic — `app/src/tabs/TableauEpics.tsx` (constante
`COULEUR_ETAT`, à supprimer) et `app/src/tabs/TableauDetail.tsx` :

| État | Classe |
|---|---|
| `terminee` | `tag tag-ok` |
| `en-cours` | `tag tag-accent` |
| `non-commencee` | `tag tag-neutral` |
| `vide` | `tag tag-neutral` |

Plus aucun `color` en style inline sur ces tags : fond, texte et bordure viennent
ensemble de la classe (`_ds/ovrsee/styles.css:341-347`).

---

## 3. ⌘W et ⌘D pour les terminaux

**Le verrou** : un accélérateur de menu natif est traité par le processus
principal, il n'atteint jamais le rendu. Tant que `{ role: 'close' }`
(`electron/menu.js:122`) porte ⌘W, la fenêtre se ferme quoi que fasse
l'interface. Il faut donc que le raccourci passe par le rendu.

- **`electron/menu.js`** — remplacer `{ role: 'close' }` par un article ordinaire
  de même libellé, `accelerator: 'CmdOrCtrl+W'`, `click: send('window:close')`.
  Ajouter, dans le menu Affichage à côté de `menu.toggle_terminal`, un
  « Nouveau terminal », `CmdOrCtrl+D`, `click: send('terminal:new')`.
  Nouvelle clé `menu.new_terminal` (fr **et** en) dans `hooks/i18n.js` et
  `hooks/i18n.d.ts`.
- **`electron/main.js` + `electron/preload.cjs`** — un `app:close` calqué sur
  l'`app:focus` existant (`main.js:495`) : le principal vise la fenêtre
  émettrice, le rendu n'en désigne aucune. C'est ce qui rend le geste sûr.
- **`app/src/App.tsx`** — c'est lui qui décide, parce que `<Terminal>` est
  **démonté** quand le panneau est replié (`App.tsx:697`) et ne pourrait donc pas
  répondre. Il tient une référence `terminalActions` que `<Terminal>` remplit à
  chaque rendu et vide au démontage :

  ```ts
  { focus: () => boolean, ouvrirShell: () => void, fermerActif: () => void | null }
  ```

  `fermerActif` vaut `null` quand l'onglet actif est la session Claude — elle
  n'est pas fermable, c'est le panneau lui-même.

  - `window:close` → si un terminal a le focus **et** que l'onglet est fermable,
    fermer l'onglet ; sinon `window.ovrsee?.app.close()`. Un ⌘W dans la session
    Claude ne fait donc rien plutôt que de fermer la fenêtre par surprise.
  - `terminal:new` → panneau replié : l'ouvrir (les sessions reviennent) ;
    panneau ouvert : `ouvrirShell()`. Deux frappes depuis un panneau replié, et
    c'est dit dans le code : ouvrir un shell dans un composant pas encore monté
    demanderait un aller-retour d'état pour un cas de bord.

- **Le focus** — `document.activeElement?.closest('.xterm')`, la classe que xterm
  pose sur son conteneur. Pas d'état à tenir, donc rien à désynchroniser ; c'est
  lu au moment du geste, jamais rendu.

---

## Vérification

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build:ui
pnpm electron
```

1. Ouvrir un ticket : l'en-tête n'est plus une bande plus sombre, et son fond va
   d'un bord à l'autre. Faire défiler un corps long : le texte passe bien
   *dessous*, sans transparence. Vérifier dans le rail **et** dans la modale.
2. Vue Epics : « terminée » est vert sur vert, « en cours » violet sur violet,
   « non commencée » neutre. Même chose dans le panneau d'un epic.
3. Cliquer dans un terminal, ⌘W : l'onglet shell se ferme, la fenêtre reste.
   ⌘W sur l'onglet claude : rien. ⌘W depuis le tableau : la fenêtre se ferme.
   ⌘D : un shell de plus, et l'article apparaît bien dans le menu Affichage.
