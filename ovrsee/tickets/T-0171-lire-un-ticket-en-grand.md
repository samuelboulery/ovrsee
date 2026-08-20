---
{
  "id": "T-0171",
  "titre": "Lire un ticket en grand : panneau tirable et modale",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "ui",
    "tableau"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-lire-un-ticket-en-grand-et-rendre-les-terminaux-bavards.md"
}
---

## Contexte

Le panneau de détail est figé à 340 px : un corps de ticket markdown s'y lit en
colonne de trois mots. `useResizable` existe et sert déjà six séparateurs ;
`CommandPalette` donne le motif de modale accessible du dépôt.

## Critères d'acceptation

- [ ] Le panneau se tire jusqu'à 70 % de la fenêtre, largeur retenue d'une
      session à l'autre, double-clic pour revenir à 340 px.
- [ ] Un bouton l'agrandit en modale : `role="dialog"`, `aria-modal`, fermeture
      par Escape et par le fond — vers le panneau, sans perdre le ticket ouvert.
- [ ] Le corps du panneau n'est écrit qu'une fois pour les deux enveloppes.
- [ ] `Detail` vit dans son propre fichier ; `Tableau.tsx` repasse sous 800 lignes.
