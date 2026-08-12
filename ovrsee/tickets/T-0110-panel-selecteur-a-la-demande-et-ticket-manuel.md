---
{
  "id": "T-0110",
  "titre": "Panel du sélecteur d'éléments à la demande, redimensionnable, ticket manuel",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "navigateur",
    "tableau",
    "ux"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-selecteur-d-elements-navigateur-panel-a-la-demande-ticket-ma.md"
}
---

## Contexte

Le panel de l'élément sélectionné (`ElementPanel`, onglet Navigateur) est
aujourd'hui toujours monté, largeur fixe 340px — il prend de la place en
permanence même quand rien n'est sélectionné, et ne se redimensionne pas.

Le bouton « Ouvrir un ticket depuis l'élément » crée un ticket immédiatement,
avec un titre auto-généré depuis le texte de l'élément — souvent non
pertinent, à renommer à la main de toute façon.

Détail de l'implémentation dans le plan lié.

## Critères d'acceptation

- [ ] Le panel de l'élément sélectionné ne s'affiche que quand un élément est
      sélectionné (rien avant, rien après avoir fermé la sélection).
- [ ] Le panel est redimensionnable (glisser son bord gauche), la taille est
      retenue d'une session à l'autre comme les autres panneaux de l'app.
- [ ] Cliquer « ticket depuis l'élément » bascule sur l'onglet Tableau, ouvre
      la saisie du titre dans la première colonne (autofocus), et le ticket
      créé porte le titre tapé à la main — jamais un titre auto-généré depuis
      le texte de l'élément.
- [ ] Le contexte de l'élément (sélecteur, texte, route, HTML) est joint
      automatiquement au corps du ticket ainsi créé, sans ressaisie.
- [ ] Un bouton « Annuler » permet de renoncer à la création sans laisser de
      champ de saisie ouvert.
