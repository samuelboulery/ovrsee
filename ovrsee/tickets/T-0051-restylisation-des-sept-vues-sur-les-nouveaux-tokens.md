---
{
  "id": "T-0051",
  "titre": "Restylisation des sept vues sur les nouveaux tokens",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0044"
}
---

## Contexte

Restylisation pure sur les nouveaux tokens/pictos (T-0045/T-0046) des 7 vues
existantes : Aperçu, Historique (frise), Tableau, Navigateur (hors panneau
DevTools — Phase 2), Produit (hors comparaison de dates — Phase 2), Stack,
Données. Le contenu et les données affichées ne changent pas dans ce
ticket — c'est la Phase 1 du plan, pas la Phase 2.

## Critères d'acceptation

- [ ] Les 7 vues sont visuellement conformes aux tokens/pictos de la
      maquette, sans changement de comportement ni de données affichées.
- [ ] Aucune des fonctionnalités listées en Phase 2 du plan (DevTools
      Réseau, ticket depuis élément, comparaison de dates, graphe
      d'activité complet, schéma DB) n'est introduite ici.
- [ ] `pnpm test` (snapshots des 7 onglets) et `pnpm typecheck` passent.
