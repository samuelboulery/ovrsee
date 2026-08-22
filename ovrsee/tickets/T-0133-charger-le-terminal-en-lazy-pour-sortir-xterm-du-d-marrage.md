---
{
  "id": "T-0133",
  "titre": "Charger le terminal en lazy pour sortir xterm du démarrage",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "perf"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-22",
  "plan": "2026-08-13-audit-final-avant-publication-et-les-trois-correctifs-qu-il.md"
}
---

## Contexte

xterm pèse 488 ko bruts, de l'ordre du tiers du bundle, pour une fonction que beaucoup de sessions n'ouvrent jamais. Il est importé statiquement par `App.tsx`, donc analysé à chaque démarrage.

## Critères d'acceptation

- [ ] `Terminal` est chargé par `lazy()` + `Suspense`.
- [ ] Le bundle principal perd le poids de xterm et de son CSS, mesuré avant et après.
- [ ] Ouvrir le terminal fonctionne toujours, y compris plusieurs sessions.
