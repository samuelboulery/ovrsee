---
{
  "id": "T-0177",
  "titre": "En-tête du panneau de ticket et tags d'état d'epic",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "xs",
  "tags": [
    "ui",
    "tableau"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-en-tete-du-panneau-tags-d-etat-raccourcis-du-terminal.md"
}
---

## Contexte

L'en-tête collant du panneau de ticket est peint en `--color-bg` alors que son
conteneur est en `--color-surface-panel`, et il s'assied dans le rembourrage
horizontal au lieu de le traverser : il se lit comme une bande plus sombre et
plus étroite. Ailleurs, le tag d'état d'un epic mêle une couleur inline et la
classe `tag-outline`, d'où un texte vert dans une bordure violette.

## Critères d'acceptation

- [ ] L'en-tête a le fond de son conteneur et va d'un bord à l'autre, dans le
      rail comme dans la modale.
- [ ] Le corps défile bien dessous, sans transparence.
- [ ] Chaque état d'epic porte une classe du design system — fond, texte et
      bordure ensemble — et plus aucune couleur inline.
