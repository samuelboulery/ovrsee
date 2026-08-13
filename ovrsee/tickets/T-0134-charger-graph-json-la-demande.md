---
{
  "id": "T-0134",
  "titre": "Charger graph.json à la demande",
  "colonne": "backlog",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "perf"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-audit-final-avant-publication-et-les-trois-correctifs-qu-il.md"
}
---

## Contexte

`snapshot()` lit `graphify-out/graph.json` — 687 ko — à chaque changement de projet, même si l'onglet Données n'est jamais ouvert. La lecture est synchrone.

## Critères d'acceptation

- [ ] Le graphe n'est plus lu tant que l'onglet Données n'est pas ouvert.
- [ ] L'onglet Données affiche toujours le graphe, et le message d'absence quand il n'y en a pas.
