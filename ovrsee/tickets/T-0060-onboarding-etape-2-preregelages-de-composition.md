---
{
  "id": "T-0060",
  "titre": "Onboarding étape 2 — préréglages de composition au lieu de la question d'usage",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "onboarding"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-11-repasse-ui-ovrsee-coller-a-la-maquette-ovrsee-app-dc-html.md",
  "epic": "T-0058"
}
---

## Contexte

`Onboarding.tsx:236` (`EcranProfil`) pose la question d'usage de Claude Code
(`onboard.usage_*`) à l'étape 2. La maquette 2j veut à cette étape le choix d'un
préréglage de composition d'interface (Dev / Sobre / Découverte / Complet), qui
existe déjà comme `PROFILS` (`PreferencesProfils.tsx:37`) mais n'est aujourd'hui
montré que dans Préférences, jamais à l'onboarding.

Décidé avec l'utilisateur : l'étape 2 devient ce choix de préréglage, la question
d'usage est retirée de l'onboarding (pas fusionnée, pas déplacée ailleurs).

## Critères d'acceptation

- [ ] Étape 2 de l'onboarding affiche les 4 cartes `PROFILS` (Dev/Sobre/Découverte/
      Complet), sélection = pré-remplissage de `settings.onglets` +
      `settings.terminal` du brouillon.
- [ ] Titre de l'étape : « Quelle composition d'interface ? » (maquette 2j).
- [ ] `EcranProfil` et la question d'usage retirés du flux d'onboarding.
- [ ] Clés i18n `onboard.usage_*` retirées si elles ne sont plus référencées
      ailleurs (vérifier avant suppression).
- [ ] `pnpm typecheck` et `pnpm test` passent.
