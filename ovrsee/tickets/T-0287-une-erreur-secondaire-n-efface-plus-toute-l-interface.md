---
{
  "id": "T-0287",
  "titre": "Une erreur secondaire n'efface plus toute l'interface",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ux",
    "robustesse"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "epic": "E-0285",
  "charge": "s",
  "fait": "2026-10-10T15:05:47.506Z"
}
---

## Contexte

`setError` est partagé (`App.tsx:67`) : un échec d'écriture des préférences, de la taille du terminal ou de l'accent remplace `<main>` par « Lecture impossible », sans « Réessayer », jusqu'au changement de projet.

## Critères d'acceptation

- [ ] Seul l'échec de lecture du snapshot occupe l'écran, avec un bouton « Réessayer ».
- [ ] Les autres erreurs s'affichent dans un bandeau fermable (`role="alert"`) et laissent l'onglet courant utilisable.
