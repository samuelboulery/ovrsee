---
{
  "id": "T-0050",
  "titre": "Restylisation de l'Onboarding et préréglages de composition",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "onboarding"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0044"
}
---

## Contexte

`Onboarding.tsx` a déjà 3 écrans (explication, profil, configuration). La
maquette 2j demande un reséquençage vers « Ce que fait l'ovrsee → Composition
et vues → Le premier dépôt », avec 4 préréglages de composition à l'écran 2
(Dev, Sobre, Découverte, Complet). Chaque préréglage ne fait que pré-remplir
`settings.onglets` et `settings.terminal` — aucune nouvelle donnée, pas de
nouveau flux.

## Critères d'acceptation

- [ ] Les 3 écrans reprennent les titres et l'ordre de la maquette 2j.
- [ ] 4 préréglages de composition sélectionnables, chacun pré-remplissant
      vues affichées + disposition du terminal, modifiable ensuite dans les
      Préférences.
- [ ] « Revoir la présentation » (Préférences → Général) continue de
      fonctionner.
- [ ] `pnpm test` et `pnpm typecheck` passent.
