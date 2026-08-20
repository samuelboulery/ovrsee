---
{
  "id": "T-0188",
  "titre": "Interpoler l'aria-label de renommage de session",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": ["a11y", "i18n"],
  "cree": "2026-08-20",
  "maj": "2026-08-20",
  "plan": "2026-08-20-corriger-les-trois-issues-ouvertes.md",
  "charge": "xs"
}
---

## Contexte

Issue #23. La clé `terminal.rename_aria` écrit `{label}` là où `t()` ne
substitue que `${…}` (`hooks/i18n.js`, français et anglais). Un utilisateur de
lecteur d'écran qui double-clique sur un onglet de terminal entend « Renommer la
session {label} » et ne sait pas quel terminal il renomme. Ce sont les deux
seules clés du dictionnaire dans ce cas — le reste interpole correctement.

## Critères d'acceptation

- [ ] Les deux entrées `terminal.rename_aria` utilisent `${label}`.
- [ ] Un test balaye `translations.fr` et `translations.en` et échoue sur toute
      valeur portant un `{mot}` non précédé de `$` — l'invariant couvre les clés
      futures, pas seulement celle-ci.
