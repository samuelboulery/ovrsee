---
{
  "id": "T-0094",
  "titre": "ActivityPanel — couleurs littérales de l'histogramme empilé",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "design",
    "historique"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.4 : l'histogramme empilé du panneau Activité doit utiliser
`#7d76f0` (plans) / `#4b46a3` (tickets) / `#2a2b33` (commits). Le code
actuel (`ActivityPanel.tsx`, `COULEUR_SERIE`) mappe `commits` sur
`var(--color-accent-500)`, `plans` sur `var(--color-accent-2-500)` et
`tickets` sur `var(--color-neutral-400)` — ni le mapping sémantique ni les
valeurs ne correspondent à la maquette.

## Critères d'acceptation

- [ ] `COULEUR_SERIE` en valeurs littérales exactes de l'audit, mappées
      sur le bon type d'activité (plans/tickets/commits, pas l'inverse).
- [ ] Légende (`Legend`) et barres (`StackedBars`) cohérentes avec le
      nouveau mapping.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome (onglet
      Historique, panneau Activité, vue empilée).
