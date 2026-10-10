---
{
  "id": "T-0299",
  "titre": "Supprimer un ticket s'annule",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "ux"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-audit-produit-et-ux-d-ovrsee-10-oct-2026.md",
  "charge": "s"
}
---

## Contexte

La suppression n'est accessible qu'en mode édition, après une confirmation en deux temps (`TableauDetail.tsx:433`), puis efface le fichier sans retour (`Tableau.tsx:188`).

## Critères d'acceptation

- [ ] Après suppression, un bandeau « Annuler » restaure le fichier pendant quelques secondes.
