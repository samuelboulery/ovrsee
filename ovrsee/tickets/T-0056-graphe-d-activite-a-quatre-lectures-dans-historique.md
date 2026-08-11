---
{
  "id": "T-0056",
  "titre": "Graphe d'activité à quatre lectures dans Historique",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "historique",
    "phase-2"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0052"
}
---

## Contexte

`hooks/density.js:109` agrège aujourd'hui uniquement les commits. La
maquette veut un graphe d'activité à quatre lectures : empilé 14 jours,
densité 12 semaines, par type sur 30 jours (commits/plans/tickets). À
étendre l'agrégation aux plans et tickets par date, puis construire les
trois vues + un état vide honnête si l'historique est trop court.

## Critères d'acceptation

- [ ] `hooks/density.js` agrège plans et tickets par date, en plus des
      commits existants.
- [ ] Trois vues dans Historique : empilée 14 jours, densité 12 semaines,
      répartition par type sur 30 jours.
- [ ] État vide honnête si l'historique disponible est plus court que la
      fenêtre demandée par une vue.
- [ ] `pnpm test` couvre la nouvelle agrégation (fonctions pures de
      `density.js`, pas de nouveau framework).
