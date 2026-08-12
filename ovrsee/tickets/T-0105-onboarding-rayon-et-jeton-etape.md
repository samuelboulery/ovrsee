---
{
  "id": "T-0105",
  "titre": "Onboarding — rayon de modale et jeton d'étape mal orthographié",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "design",
    "onboarding"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.8. Vérifié dans `Onboarding.tsx` :

- Modale (ligne 422) : rayon 10px au lieu des 14 de l'audit.
- Étape déjà franchie (ligne 446) : `border: 1px solid #2a2660;` — c'est une
  transposition de chiffres du jeton `--color-plan-border` (`#2f2a66`,
  posé au Lot 1), pas une vraie divergence de design : la teinte plan est
  déjà l'usage correct pour marquer « déjà fait » (même convention que les
  bandeaux de plan clos dans Historique, T-0093). Remplacer le littéral par
  le jeton, sans changer la couleur perçue.

**Écarté** : l'étape courante (ligne 448, puce pleine `var(--color-accent)`)
est un usage réservé légitime — même famille que le point d'entrée du
graphe Produit ou le plan actif en sidebar, pas une violation de la règle
d'or. Le diagramme `SchemaBoucle` (`OnboardingArt.tsx`) distingue dépôt vs
gestes par la couleur : c'est une illustration explicative, pas un état
d'interface — hors périmètre. Les trois boutons de la barre du bas
(Passer/Précédent/Suivant) sont déjà un seul vrai bouton primaire plein +
deux fantômes, conforme malgré l'apparence à trois classes.

## Critères d'acceptation

- [ ] Modale : rayon 14px.
- [ ] Étape franchie : `border-color: var(--color-plan-border)` au lieu du
      littéral `#2a2660`.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sur
      l'onboarding, étape 2 ou 3 (au moins une étape déjà franchie).
