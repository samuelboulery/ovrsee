---
{
  "id": "T-0034",
  "titre": "Frise historique : vue par tickets (défaut) et vue par commits",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "l",
  "tags": [
    "historique",
    "tickets",
    "frontend",
    "backend"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-frise-historique-vue-par-tickets-vue-par-commits.md"
}
---

## Contexte

L'onglet Historique n'affiche qu'une frise de commits git (les plans y
regroupent leurs commits consécutifs). Depuis T-0032/T-0030, le ticket est
devenu l'unité de travail réelle — chaque édition de code sous un plan actif
exige un ticket qui le cite. La frise actuelle ne raconte donc pas le travail
tel qu'il a été tracé. Voir le plan lié pour le détail de l'implémentation
(regroupement Node dans `hooks/timeline.js`, wiring `snapshot.js`, types
`data.ts`, sélecteur de vue dans `Historique.tsx`, navigation vers le
panneau Detail du Tableau).

## Critères d'acceptation

- [ ] L'onglet Historique s'ouvre par défaut sur une vue groupée par ticket
      (tickets sous leur plan en bande, tickets sans plan en carte isolée),
      triée du plus récent au plus ancien.
- [ ] Un sélecteur permet de basculer vers la vue par commits existante, sans
      régression sur son rendu actuel.
- [ ] Un ticket affiché en carte (titre, priorité, colonne, tags) est
      cliquable et redirige vers l'onglet Tableau avec son panneau Detail
      déjà ouvert.
- [ ] `hooks/timeline.js` expose `ticketTimeline()`, couverte par des tests
      dans `hooks/timeline.test.js` (tickets groupés par plan, tickets
      orphelins, tri par date, plan référencé mais absent du disque).
