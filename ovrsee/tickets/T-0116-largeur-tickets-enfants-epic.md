---
{
  "id": "T-0116",
  "titre": "Largeur des tickets enfants d'un epic — plus d'espace à gauche qu'à droite",
  "colonne": "en-cours",
  "priorite": "haute",
  "tags": ["ui"],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": null
}
---

## Contexte

Dans `Tableau.tsx`, le conteneur des enfants d'un epic (`enfantsIci`) a
`margin-left: 14px` sans `margin-right` équivalent. La carte enfant se
retrouve donc décalée vers la droite, avec plus d'espace à gauche qu'à droite.

## Critères d'acceptation

- [ ] Les cartes enfants d'un epic ont un espace symétrique gauche/droite dans le tableau.
