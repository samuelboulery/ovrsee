---
{
  "id": "T-0300",
  "titre": "Les lignes de projet s'activent au clavier",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "a11y"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "charge": "xs",
  "fait": "2026-10-10T15:04:35.720Z"
}
---

## Contexte

Les lignes du sélecteur de projet sont des `<div onClick>` sans rôle ni `tabIndex` (`Shell.tsx:593`) : seul le bouton de retrait reçoit le focus.

## Critères d'acceptation

- [ ] Chaque ligne est un `<button>` activable par Entrée et Espace, avec un contour de focus visible.
