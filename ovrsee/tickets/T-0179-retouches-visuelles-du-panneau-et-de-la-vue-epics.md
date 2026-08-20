---
{
  "id": "T-0179",
  "titre": "Retouches visuelles du panneau de ticket et de la vue Epics",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "xs",
  "tags": [
    "ui",
    "tableau"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-trois-retouches-sur-le-panneau-de-ticket-et-la-vue-epics.md"
}
---

## Contexte

Trois écarts relevés à l'usage après le passage précédent : l'en-tête du panneau
respire sur les côtés mais pas en haut, ses trois icônes sont dispersées par le
`gap` prévu pour séparer l'identifiant, et la pastille d'état d'un epic est plus
petite que la classe `.tag` du design system.

## Critères d'acceptation

- [ ] L'écart au-dessus de l'identifiant égale celui des côtés, dans le rail
      comme dans la modale.
- [ ] Les trois icônes d'en-tête forment un bloc jointif ; l'identifiant reste
      détaché.
- [ ] La pastille d'état se lit sans effort dans une ligne d'epic, et le tag le
      plus long ne pousse pas le titre.
