---
{
  "id": "T-0065",
  "titre": "Panneau droit persistant — graphe d'activité dans Historique, densité en grille, série Scans",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "historique"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-repasse-ui-ovrsee-ecarts-de-structure-pas-seulement-de-style.md",
  "epic": "T-0062"
}
---

## Contexte

`app/src/tabs/Historique.tsx`, zone `ActivityGraph` : le graphe d'activité est une vue
plein-écran parmi trois (boutons empile/densite/type qui remplacent la frise). La
maquette (2e) le pose en panneau fixe à droite (~300px), visible en permanence à côté
de la frise de tickets/commits, avec ses filtres (Plans/Tickets/Commits hors plan) et
le sélecteur de fenêtre (14j/12s/type) dans ce panneau.

Une fois le panneau posé, deux écarts internes au graphe lui-même :
- **Densité 12 semaines** (`WeeklyDensity`) : maquette = grille CSS 12×7 (heatmap,
  intensité par cellule) ; code actuel = barres flex.
- **Par type 30 jours** (`ByTypeBars`) : maquette a 4 séries (Commits, Tickets écrits,
  Plans capturés, Scans) ; code actuel n'en a que 3, Scans manque. Vérifier que
  `hooks/density.js` porte la donnée nécessaire avant d'ajouter la série.

## Critères d'acceptation

- [ ] Graphe d'activité en panneau droit fixe (~300px), visible en permanence à côté
      de la frise, avec ses filtres et le sélecteur de fenêtre dans ce panneau.
- [ ] `WeeklyDensity` rendu en grille CSS 12×7, pas en barres flex.
- [ ] `ByTypeBars` a 4 séries (ajout de Scans), donnée vérifiée dans
      `hooks/density.js` avant d'étendre l'agrégation si besoin.
- [ ] `pnpm typecheck` et `pnpm test` passent.
- [ ] Comparaison visuelle dans Chrome contre `Ovrsee App.dc.html#2e` et `#2l`.
