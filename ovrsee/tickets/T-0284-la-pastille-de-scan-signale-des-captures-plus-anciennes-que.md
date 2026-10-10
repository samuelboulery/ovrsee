---
{
  "id": "T-0284",
  "titre": "La pastille de scan signale des captures plus anciennes que le code",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "ux",
    "crawl"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "epic": "E-0280",
  "charge": "s"
}
---

## Contexte

Le hook SessionStart dit « Les captures sont plus anciennes que le code », l'interface non : `ScanBadge` (`Shell.tsx:64`) affiche le commit du scan sans jamais le comparer à HEAD.

## Critères d'acceptation

- [ ] Quand le commit du dernier scan réussi diffère de HEAD et que du code a changé depuis, la pastille passe en avertissement avec une infobulle explicite.
- [ ] Test sur la fonction pure de comparaison dans `data.ts`.
