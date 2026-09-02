---
{
  "id": "T-0254",
  "titre": "Les dialogues ne piègent pas le focus",
  "colonne": "backlog",
  "priorite": "moyenne",
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

Cinq surfaces modales — la visionneuse d'images, la palette, les préférences,
l'accueil, le détail d'un ticket — et un seul `.focus()` entre elles. Aucune ne
rend le focus à son déclencheur, aucune ne rend l'arrière-plan inerte, et Tab
sort du dialogue vers le contenu masqué. La visionneuse n'a même pas de rôle :
un lecteur d'écran ne sait pas que c'est une modale.

L'élément `<dialog>` natif avec `showModal()` donne le piège de focus, la
touche Échap et l'inertie de l'arrière-plan sans une ligne de JavaScript. C'est
le remplacement à faire, pas cinq rustines.

## Critères d'acceptation

- [ ] Les cinq surfaces passent par `<dialog>` et `showModal()`.
- [ ] Le focus revient à l'élément qui a ouvert le dialogue.
- [ ] Un test de rendu vérifie la présence du rôle et de l'état modal.
