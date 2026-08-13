---
{
  "id": "T-0120",
  "titre": "Remonter le contraste de l'interface",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-remonter-le-contraste-de-l-interface.md"
}
---

## Contexte

Les huit niveaux de surface tiennent entre `#08090a` et `#24252c` et les filets
(`#17181d`, `#1c1d22`) sont presque invisibles sur les fonds qu'ils séparent :
cartes, contrôles et lignes de liste se fondent les uns dans les autres. Côté
texte, les quatre derniers niveaux de la hiérarchie (`quaternary`, `discrete`,
`faint`, `ghost`) échouent WCAG AA sur `#0b0c0e` — le pire à 1,3:1.

Remontée modérée : chaque élément se détache, l'app reste sombre. L'accent
`#7d76f0` et les statuts ne bougent pas.

Complication : ~30 % des couleurs sont recopiées en hex littéral dans les
composants au lieu de passer par `var(--…)`. Retoucher `_ds/ovrsee/styles.css`
seul laisserait la moitié de l'interface à l'ancienne palette.

## Critères d'acceptation

- [ ] Les quatre niveaux de filets (`chrome`, `card`, `control`, `selected`) sont
      distinguables des surfaces qu'ils bordent.
- [ ] `--color-text-quaternary` atteint au moins 4:1 sur `#0b0c0e`.
- [ ] `--color-bg`, `--color-surface`, `--color-surface-panel`, l'accent, les
      statuts et la palette xterm sont inchangés.
- [ ] Aucune valeur ancienne ne subsiste : un grep des hex remplacés sur
      `app/src` et `_ds/ovrsee` ne retourne rien.
- [ ] La rampe `--color-neutral-*` reste monotone du clair au sombre.
- [ ] `pnpm test` et `pnpm typecheck` verts.
