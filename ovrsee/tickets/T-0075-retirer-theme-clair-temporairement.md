---
{
  "id": "T-0075",
  "titre": "Retirer le thème clair (pas de maquette claire pour l'instant)",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-refonte-chassis-apercu-port-litteral-depuis-ovrsee-app-dc-ht.md",
  "charge": "s"
}
---

## Contexte

`Ovrsee App.dc.html` (la maquette cible) est sombre uniquement. Porter le châssis en
valeurs littérales (T-0074) sans thème clair en parallèle produirait un mélange incohérent
— mécanisme de thème clair maintenu pour un châssis qui ne le supporte plus. Décision actée
avec l'utilisateur : retirer le thème clair pour l'instant, jusqu'à ce qu'une maquette
claire existe.

## Critères d'acceptation

- [ ] `theme.ts` : branche `lightTheme` et bascule système/clair retirées de
      `applyTheme()`/`getCSSVariables()`.
- [ ] Le contrôle « Thème » dans Préférences (`PreferencesControls.tsx`, hors périmètre de
      ce ticket sinon) n'expose que sombre — ou, si son refactor complet attend le
      chantier 2 (Préférences), au minimum les options clair/système n'ont plus d'effet
      visible cassé (pas de correction complète de l'écran Préférences ici, seulement ne
      pas laisser un bouton qui casse le rendu).
- [ ] `pnpm typecheck` et `pnpm test` passent.
