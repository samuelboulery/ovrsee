---
{
  "id": "T-0037",
  "titre": "La sélection d'un profil d'interface pose aussi terminal.disabled",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "preferences",
    "terminal"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-profils-d-interface-la-selection-pilote-aussi-terminal-disab.md",
  "charge": "s"
}
---

## Contexte

`Profil.terminal` (app/src/PreferencesProfils.tsx) ne connaît que
`{visible, disposition}`. Choisir un template ne touche jamais
`terminal.disabled` : un profil pensé sans terminal (sobre, revue) peut
laisser la pastille de réouverture active si elle avait été activée à la
main auparavant. L'interrupteur indépendant de `SectionInterface` doit
rester disponible, mais la sélection d'un profil doit désormais aussi poser
`disabled` automatiquement.

## Critères d'acceptation

- [ ] `Profil.terminal` porte un champ `disabled: boolean`, renseigné sur
      les 4 templates (`complet`/`dev` → `false`, `sobre`/`revue` → `true`).
- [ ] `appliquerProfil` propage `disabled` vers `settings.terminal` (le
      spread existant suffit une fois le type mis à jour).
- [ ] `profilCourant` compare aussi `disabled` (normalisé à `false` si
      absent) pour retrouver le template actif.
- [ ] L'interrupteur indépendant de `SectionInterface` reste inchangé et
      continue de permettre de diverger du template après coup.
- [ ] `pnpm test` et `pnpm typecheck` passent, avec les nouvelles
      assertions sur `disabled` dans `app/src/prefs.test.tsx`.
