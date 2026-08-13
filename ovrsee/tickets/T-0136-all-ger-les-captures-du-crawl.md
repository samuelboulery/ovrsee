---
{
  "id": "T-0136",
  "titre": "Alléger les captures du crawl",
  "colonne": "backlog",
  "priorite": "basse",
  "charge": "m",
  "tags": [
    "perf"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-14",
  "plan": "2026-08-13-audit-final-avant-publication-et-les-trois-correctifs-qu-il.md"
}
---

## Contexte

62 Mo de PNG sur le disque, environ 100 ko pièce en 1280×800, affichés en vignettes d'à peu près 300×200. Playwright les écrit sans option de compression.

## Critères d'acceptation

- [ ] Le poids d'une capture baisse de façon mesurable.
- [ ] La lisibilité des captures est préservée — elles sont le produit, pas un détail.
