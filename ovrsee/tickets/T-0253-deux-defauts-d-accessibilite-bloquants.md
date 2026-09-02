---
{
  "id": "T-0253",
  "titre": "Deux défauts d'accessibilité bloquants",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "a11y"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

- Le bouton qui retire un projet de la liste ne se montrait qu'au survol de la
  souris : `aria-hidden` et hors du parcours de tabulation le reste du temps.
  Retirer un projet était donc impossible au clavier seul.
- `<main>` portait `aria-live="polite"` sur tout le contenu de l'onglet. Les
  deux polls faisaient relire au lecteur d'écran chaque texte qui changeait —
  un bavardage continu, toutes les 4 secondes.
- Le champ de la palette posait `outline: 0` en style, ce qui battait la règle
  de focus visible du design system.

## Critères d'acceptation

- [x] Le bouton de retrait s'atteint au clavier, par les mêmes gestes qu'à la souris.
- [x] Plus aucune région vivante ne couvre un onglet entier.
- [x] Le champ de la palette montre son indicateur de focus.
