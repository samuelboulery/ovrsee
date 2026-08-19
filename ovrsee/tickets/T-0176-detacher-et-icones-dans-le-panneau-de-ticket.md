---
{
  "id": "T-0176",
  "titre": "« Détacher de l'epic » et icônes dans le panneau de ticket",
  "colonne": "backlog",
  "priorite": "basse",
  "charge": "xs",
  "tags": ["ui", "tableau"],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": "2026-08-19-cinq-correctifs-sur-le-panneau-terminal-et-le-panneau-de-tic.md"
}
---

## Contexte

Le bouton « Détacher » prend toute la largeur d'une carte pour une action rare,
et son libellé ne dit pas de quoi on détache. L'en-tête du panneau, lui, mêle
deux boutons texte et une icône.

## Critères d'acceptation

- [ ] Aucun bouton sur une carte de ticket enfant ; la puce « Enfant de » reste.
- [ ] « Détacher de l'epic » est en bas du panneau et de la modale, en lecture
      comme en édition.
- [ ] Les trois boutons d'en-tête sont des icônes, chacune avec `aria-label` et
      infobulle, l'icône elle-même `aria-hidden`.
