---
{
  "id": "T-0096",
  "titre": "Tableau — refonte du bloc epic (encadré, zéro liseré accent)",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "design",
    "tableau"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.5, le plus gros écart de l'onglet Tableau. Vérifié dans
`Tableau.tsx` : un epic est aujourd'hui marqué par `border:
var(--color-accent-600)` + fond accent 10%, et ses enfants par
`box-shadow: inset 3px 0 0 var(--color-accent)` — exactement le liseré
coloré que l'audit interdit (règle d'or §5.1 : jamais un filet coloré pour
signifier un état).

La maquette remplace ça par un **bloc encadré neutre** (filet `#1c1d22`,
rayon 10) avec un **en-tête explicite** — étiquette « epic », titre,
progression `2/5` + barre fine — et des **cartes enfants à contour
complet** à l'intérieur, décalées, sans liseré latéral. Le bandeau
« enfants de … » (affiché quand on filtre sur un epic) passe du fond
accent 15% + `border-left: 3px solid accent` à une barre neutre : fond
`#101114`, filet `#24252b`, rayon 6, étiquette epic en teinte plan,
bouton Retour en fantôme neutre.

## Critères d'acceptation

- [ ] Bloc epic : filet `#1c1d22` rayon 10, en-tête avec étiquette
      « epic », titre, barre de progression fine + fraction `terminés/total`.
- [ ] Cartes enfants : contour complet (comme une carte normale), plus de
      `box-shadow: inset 3px 0 0 accent`.
- [ ] Bandeau « enfants de … » : fond `#101114`, filet `#24252b`, rayon 6,
      étiquette en teinte plan (`--color-plan`/`--color-plan-bg`/
      `--color-plan-border` du Lot 1), bouton Retour neutre.
- [ ] Plus aucune occurrence de `var(--color-accent-600)` ni de
      `box-shadow: inset ... var(--color-accent)` dans `Tableau.tsx`.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sur un
      epic avec enfants (T-0084 du board de ce projet en a).
