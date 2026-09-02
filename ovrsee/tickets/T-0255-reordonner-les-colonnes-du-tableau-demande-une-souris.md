---
{
  "id": "T-0255",
  "titre": "Réordonner les colonnes du tableau demande une souris",
  "colonne": "backlog",
  "priorite": "basse",
  "tags": [
    "a11y"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

Les cartes du Kanban ont un équivalent clavier : le détail d'un ticket porte un
sélecteur de colonne. Les **colonnes** elles-mêmes n'en ont pas — leur poignée
est un `span` glissable, sans gestion de touche. Les réordonner est impossible
sans souris.

## Critères d'acceptation

- [ ] Deux boutons de déplacement à côté de la poignée, sur le modèle du sélecteur des cartes.
