---
{
  "id": "T-0097",
  "titre": "Navigateur — jetons cassés (fond transparent) et teinte plan mal utilisée",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "design",
    "navigateur"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.2. Vérifié dans `Navigateur.tsx` : `var(--theme-bg-secondary)`
(ligne 833, fond du panneau « Élément sélectionné ») n'existe **nulle part**
dans `_ds/ovrsee/styles.css` — le panneau droit 340px n'a donc aucun fond,
transparent, pas juste "la mauvaise couleur". Bug, pas nuance.

Barre d'URL (ligne 605) : fond `var(--color-surface)` (#0b0c0e) et filet
`var(--color-neutral-800)` au lieu des jetons dédiés aux contrôles —
`var(--color-surface-control)` (#101114) et `var(--color-border-card)`
(#1c1d22), qui correspondent exactement aux valeurs de l'audit.

Champ SÉLECTEUR (ligne 856) : `color: var(--color-accent)` — l'accent violet
réservé à 5 usages précis (règle d'or §5.1) est ici employé pour un simple
texte informatif. L'audit demande une teinte plan (`#a49dfa` = jeton
`--color-plan` posé au Lot 1), cohérente avec les étiquettes « plan » du
reste de l'app.

## Critères d'acceptation

- [ ] Panneau Élément sélectionné : fond `var(--color-surface)` (ou
      équivalent littéral `#0a0b0d`), plus de jeton mort.
- [ ] Barre d'URL : fond `var(--color-surface-control)`, filet
      `var(--color-border-card)`.
- [ ] Champ SÉLECTEUR : couleur texte `var(--color-plan)` au lieu de
      `var(--color-accent)`.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sur
      l'onglet Navigateur, panneau Élément sélectionné ouvert.
