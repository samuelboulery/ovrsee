---
{
  "id": "T-0115",
  "titre": "Corriger poignée switch qui déborde de la piste",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["ui", "paramètres"],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": null
}
---

## Contexte

Poignée du composant `Switch` (`app/src/PreferencesControls.tsx`) déborde
visuellement de la piste, capture d'écran des Paramètres à l'appui.

Piste `border-box` : 28×16px, `padding: 2px`, `border: 1px solid`. Aire de
contenu réelle = 22×10px. La poignée est déclarée à 12×12px — plus grande que
l'aire de contenu (déborde de 2px en hauteur haut/bas, et l'état "activé"
avec `translateX(12px)` calculé pour une aire de 24×12px la fait dépasser le
bord droit arrondi de la piste.

## Critères d'acceptation

- [x] Poignée entièrement contenue dans la piste, aux deux états (activé /
      désactivé).
- [x] Vérifié visuellement dans l'app (thème sombre, thème clair).
