---
{
  "id": "T-0283",
  "titre": "Un crawl qui ne démarre pas dit pourquoi : Chrome absent, lancement refusé",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "crawl",
    "ux"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "epic": "E-0280",
  "charge": "s"
}
---

## Contexte

Sans Google Chrome, Playwright consigne une erreur brute (« Executable doesn't exist… », `crawl/index.js:546`) ; le README avoue que rien ne prévient. `useCrawl.ts:63` appelle `crawl.start` sans lire son `{error}` : un refus de lancement est avalé.

## Critères d'acceptation

- [ ] Chrome absent : message dédié (« Installez Google Chrome ») dans `scans.jsonl` et dans `ConfigCrawl`, avant toute tentative.
- [ ] Un `{error}` renvoyé par `crawl.start` s'affiche à côté du bouton Crawler.
