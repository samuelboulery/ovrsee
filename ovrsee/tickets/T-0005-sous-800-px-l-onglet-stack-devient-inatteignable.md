---
{
  "id": "T-0005",
  "titre": "Sous 800 px, l'onglet Stack devient inatteignable",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["ux", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

Mesuré pendant l'audit, fenêtre à 748 px de large : l'ancre « Stack » est à
`x = 756`, soit entièrement hors du viewport. La barre d'onglets est en
`overflow-x: visible`, `document.body.scrollWidth === clientWidth` — il n'y a donc
ni barre de défilement, ni troncature visible, ni indice qu'un onglet manque.
L'onglet n'est atteignable qu'à la tabulation, à l'aveugle.

Le projet ne contient **aucune media query**. La largeur minimale de la barre
latérale est fixée à 180 px, l'en-tête et la barre d'onglets à 44 px chacun. Rien
ne s'adapte.

Ce n'est pas un ticket « rendre l'app responsive » — c'est une fenêtre à demi
réduite sur un portable, ce qui arrive tous les jours, et un onglet qui disparaît
sans le dire.

## Critères d'acceptation

- [ ] À 700 px de large, les sept onglets restent atteignables à la souris.
- [ ] Quand la barre d'onglets déborde, le débordement se voit — défilement
      horizontal, repli, ou toute autre réponse, mais jamais un onglet qui
      disparaît en silence.
- [ ] La barre latérale se replie ou se rétrécit sous une largeur à décider, au
      lieu de manger un tiers de l'écran.
