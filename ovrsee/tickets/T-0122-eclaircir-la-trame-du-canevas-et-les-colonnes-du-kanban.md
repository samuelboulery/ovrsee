---
{
  "id": "T-0122",
  "titre": "Éclaircir la trame du canevas et les colonnes du kanban",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-homogeneiser-fonds-et-filets-eclaircir-trame-et-colonnes-kan.md"
}
---

## Contexte

La trame de points du canevas de Produit (`#16171c` sur `#08090a`) est trop
sombre pour donner le repère de déplacement qu'elle doit donner.

Les colonnes du tableau kanban ont pour fond
`color-mix(in srgb, var(--color-surface) 55%, transparent)`, soit environ
`#090a0b` sur le fond d'application : elles sont **plus sombres que le fond
qu'elles recouvrent**. Les cartes de ticket, elles, sont en `var(--color-surface)`
— elles s'enfoncent dans la colonne au lieu de s'y poser.

## Critères d'acceptation

- [ ] La trame de points se perçoit au premier coup d'œil sans devenir un
      quadrillage.
- [ ] Les colonnes du kanban sont plus claires que le fond de l'onglet.
- [ ] Les cartes de ticket sont plus claires que la colonne qui les porte.
- [ ] Les deux valeurs viennent de jetons du design system, pas d'un hex ad hoc.
