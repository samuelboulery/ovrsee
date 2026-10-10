---
{
  "id": "T-0302",
  "titre": "La palette compte les tickets restants, comme le rail",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "ux"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "charge": "xs",
  "fait": "2026-10-10T15:04:34.875Z"
}
---

## Contexte

`CommandPalette.tsx:94` affiche `tickets.length` (le total) quand le rail et le sélecteur affichent les restants.

## Critères d'acceptation

- [ ] La palette utilise `restant(tickets, board)`, comme `Shell.tsx`.
