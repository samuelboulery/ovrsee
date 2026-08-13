---
{
  "id": "T-0121",
  "titre": "Aligner les composants sur les jetons du design system",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-homogeneiser-fonds-et-filets-eclaircir-trame-et-colonnes-kan.md"
}
---

## Contexte

`_ds/ovrsee/styles.css` se déclare source de vérité, mais `app/src` compte
43 valeurs de `background` distinctes et 26 de `border` pour 9 surfaces et
4 filets définis. Une carte de Santé est en `#101216`, une carte de nœud de
Produit en `var(--color-surface)`, un encart de Tableau en `#171920` : trois
fonds pour un même rôle.

Deux dégâts concrets : `var(--color-neutral-800)` sert de filet dans 17 endroits
alors que c'est un palier de rampe de texte (il a été éclairci à `#585d66` par
T-0120, ces bordures ressortent trop) ; et `--color-warning-600/200/300`
(`tabs/Donnees.tsx`) n'existent nulle part — ces encarts d'avertissement n'ont
ni filet ni couleur de texte.

`--color-surface-panel` (`#0a0b0d`) est par ailleurs plus sombre que les rails
alors qu'un panneau porte des cartes : l'échelle des surfaces est à réétager.

## Critères d'acceptation

- [ ] Toutes les cartes de l'application partagent un même fond et un même filet.
- [ ] Tous les panneaux (sidebars, docks, modales, colonnes) partagent un même fond.
- [ ] Les fonds et filets des composants sont écrits en `var(--…)`, plus en hex
      littéral — sauf marque, statuts et palette xterm.
- [ ] `grep -rn "color-warning" app/src` ne retourne rien.
- [ ] La rampe `--color-neutral-*` ne sert plus de filet nulle part.
- [ ] L'échelle des surfaces est monotone : `bg` < `panel` < `card` < `control`
      < `hover` < `elevated` < `active` < `segment`.
- [ ] Les jetons de fond redondants de `theme.ts` (`bgSecondary`, `bgTertiary`,
      `bgQuaternary`, `bgAlerte`) sont supprimés faute d'appelant.
- [ ] `pnpm test` et `pnpm typecheck` verts.
