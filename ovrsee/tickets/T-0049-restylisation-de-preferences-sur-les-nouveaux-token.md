---
{
  "id": "T-0049",
  "titre": "Restylisation de Préférences sur les nouveaux tokens",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "preferences"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0044"
}
---

## Contexte

Les 5 sections de `PreferencesPanel.tsx` (Profils, Général, Interface,
Claude Code, Projet) correspondent déjà exactement à la maquette 2i — même
découpage, même aperçu en direct (`PreferencesPreview.tsx`), même écriture à
la volée. Ce ticket est une restylisation pure sur les nouveaux tokens/pictos
(T-0045/T-0046) : `SettingsType` (`data.ts`) ne change pas, aucune nouvelle
donnée.

## Critères d'acceptation

- [ ] Les 5 sections existantes sont visuellement conformes à la maquette
      2i sans changement de structure de données.
- [ ] L'aperçu en direct continue de refléter les changements pendant la
      modale ouverte.
- [ ] Aucune régression fonctionnelle (écriture à la volée, `onboardingVu`,
      persistance des dimensions terminal).
- [ ] `pnpm test` (dont `prefs.test.tsx`) et `pnpm typecheck` passent.
