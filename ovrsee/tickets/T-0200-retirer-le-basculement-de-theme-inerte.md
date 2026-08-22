---
{
  "id": "T-0200",
  "titre": "Retirer le basculement de thème, inerte",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": ["ui", "dette"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null,
  "epic": "T-0197"
}
---

## Contexte

Il n'y a qu'un thème. `getCSSVariables()` pose les jetons sombres sur `:root`
sans condition, `_ds/ovrsee/styles.css` fournit le reste, et les deux écrans qui
montraient le choix (`PreferencesPanel`, `Onboarding`) affichent depuis T-0075
une ligne fixe « Sombre » — aucune maquette claire n'existe.

Reste tout le câblage : le champ `settings.theme` avec son défaut `auto` et sa
validation à trois valeurs, `applyTheme()` appelé depuis quatre fichiers pour
poser un `data-theme` que plus aucun sélecteur ne lit, les pictos `IconSystem`
et `IconLight` jamais montés, les clés `pref.theme_system` et `pref.theme_light`
dans les deux langues, et `unthemedColors` exporté sans un seul appelant.

`theme.ts` porte en plus deux abstractions à un seul usage : `themeTokens(palette)`
n'est jamais appelé qu'avec `darkTheme`, `bloc()` n'a qu'un appelant, et
`getTerminalTheme()` déclare ses vingt champs de retour à la main alors qu'ils
se dérivent de `darkTheme`.

Ce ticket ne ferme pas la porte au thème clair : il retire un mécanisme qui
promet un réglage sans effet. Le jour où une maquette claire existe, le
remettre est du travail neuf de toute façon.

## Critères d'acceptation

- [ ] `applyTheme` et ses quatre appels sont retirés, ou `applyTheme` ne subsiste
      que si un sélecteur lit réellement `data-theme`.
- [ ] `settings.theme` disparaît du défaut, de la validation et du type `SettingsType`.
- [ ] `IconSystem`, `IconLight` et `unthemedColors` sont supprimés.
- [ ] `pref.theme_system` et `pref.theme_light` sortent des deux dictionnaires.
- [ ] `themeTokens`, `bloc` et le type de retour de `getTerminalTheme` sont
      ramenés à leur forme directe.
- [ ] L'application s'ouvre avec exactement les mêmes couleurs qu'avant, terminal compris.
