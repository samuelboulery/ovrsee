---
{
  "id": "T-0046",
  "titre": "Icônes Phosphor : dépendance et remplacement des pictos",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0044"
}
---

## Contexte

La maquette utilise des pictos Phosphor (contour au repos, plein à l'état
actif) sur ~15-20 emplacements (rail de navigation, actions, états). Le
projet dessine aujourd'hui 3 pictos Phosphor à la main plutôt que d'ajouter
une dépendance pour trois glyphes (`PreferencesControls.tsx`). Au volume de
la refonte, dessiner chaque picto à la main n'est plus raisonnable.

**Ce ticket bloque sur un accord explicite de l'utilisateur avant
`pnpm add @phosphor-icons/react`** — le projet tient à trois dépendances de
production et cette règle est documentée (CLAUDE.md, package-manager.md :
demander avant toute nouvelle dépendance). Si l'accord n'est pas donné,
continuer à dessiner les pictos à la main et fermer ce ticket sur cette
décision plutôt que de forcer la dépendance.

## Critères d'acceptation

- [ ] Décision actée avec l'utilisateur : dépendance ajoutée, ou pictos
      dessinés à la main pour le sous-ensemble retenu.
- [ ] Si dépendance : `package.json` porte `@phosphor-icons/react`,
      `pnpm-lock.yaml` committé, `packageManager` respecté.
- [ ] Les 3 pictos actuels (`IconSystem`, `IconLight`, `IconDark`) migrent
      vers la même source que les nouveaux.
- [ ] `pnpm typecheck` passe.
