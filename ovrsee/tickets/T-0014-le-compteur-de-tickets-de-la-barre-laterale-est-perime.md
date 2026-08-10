---
{
  "id": "T-0014",
  "titre": "Le compteur de tickets de la barre latérale est périmé",
  "colonne": "fait",
  "priorite": "basse",
  "tags": ["ux", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`ProjectRow` va chercher son propre instantané pour afficher la pastille
« N à faire », et ne le rafraîchit jamais.

Vérifié pendant l'audit : créer un ticket dans l'onglet Tableau puis le supprimer
laisse la pastille sur « 1 à faire » du début à la fin, alors que le tableau
affiche successivement 2 puis 1. Le chiffre est faux entre les deux, et seul un
rechargement le corrige.

C'est petit. C'est aussi le seul chiffre visible depuis n'importe quel onglet.

## Critères d'acceptation

- [ ] Créer, déplacer vers la colonne finale ou supprimer un ticket met à jour la
      pastille du projet sans recharger.
- [ ] La pastille du projet affiché se déduit de l'instantané déjà chargé plutôt
      que d'une seconde requête.
