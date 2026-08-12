---
{
  "id": "T-0103",
  "titre": "Palette ⌘K — conteneur et champ de recherche",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "design",
    "palette"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.9. Vérifié dans `CommandPalette.tsx` : le fond conteneur
(ligne 177) utilise `var(--color-surface-card)` (#0c0d10) là où l'audit
demande #101114 — exactement le jeton `--color-surface-control`, déjà posé
au Lot 1 et utilisé ailleurs pour ce type de surface flottante. Le rayon
utilise `var(--radius-lg)` (12px), l'audit en demande 9. Le champ de
recherche (ligne 193) est en 14px sans police mono, l'audit demande
mono/12px.

**Faux positifs écartés** (vérifiés directement dans
`_ds/ovrsee/styles.css`, pas de correctif nécessaire) : le filet
`var(--color-divider)` = `--color-border-card` = `#1c1d22`, exact ; l'état
survolé/sélectionné `var(--color-surface-active)` = `#1c1d24`, exact ; et
`.tag-neutral` (ligne 341) est déjà `background: transparent` depuis le
Lot 1 — l'audit visait l'ancien fond plein `#323d48`, disparu. La classe
reste légitime, ne pas la retirer.

## Critères d'acceptation

- [ ] Fond conteneur : `var(--color-surface-control)`.
- [ ] Rayon conteneur : 9px.
- [ ] Champ de recherche : `font-family: var(--font-mono)`, `font-size: 12px`.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sur la
      palette ⌘K.
