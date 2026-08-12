---
{
  "id": "T-0082",
  "titre": "Branches : remplacer le tableau par des chips horizontaux",
  "colonne": "pret",
  "priorite": "moyenne",
  "tags": [
    "ui"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-integration-structurelle-de-la-maquette-chassis-apercu-chant.md",
  "charge": "s"
}
---

## Contexte

Étape 6 du chantier 3. `Branches.tsx:65-90` rend un `<table>` HTML à 3 colonnes. La
maquette montre une liste de chips horizontaux (un par branche) : icône `GitBranch`
(14px), nom en mono bold 12px, upstream en mono clair, statut aligné à droite ("à jour" en
vert, ou avance/retard), hauteur ~28px.

## Critères d'acceptation

- [ ] Table remplacée par une liste de chips, un par branche, conforme à la maquette.
- [ ] Le statut (à jour / N en avance / N en retard) reste correct pour chaque branche.
- [ ] `pnpm typecheck` et `pnpm test` passent.
