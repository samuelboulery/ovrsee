---
{
  "id": "T-0035",
  "titre": "Refonte sélection du profil d'interface à l'onboarding",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "onboarding",
    "ui",
    "terminal"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-de-la-selection-de-profil-d-interface-a-l-onboarding.md"
}
---

## Contexte

L'écran 2 de l'onboarding pose deux questions (usage, niveau) et les combine
via une matrice cachée pour suggérer un profil d'interface — l'utilisateur ne
voit pas le lien entre sa réponse « depuis combien de temps ? » et le nombre
d'onglets montrés. Par ailleurs, masquer le terminal pour qui n'en a pas
l'usage (desktop/autre) laisse une pastille de réouverture avec une session
`node-pty` déjà vivante en fond, au lieu d'une vraie désactivation.

Détail complet — code touché, signatures, i18n — dans le plan lié.

## Critères d'acceptation

- [ ] Écran 2 de l'onboarding : la question niveau a disparu, remplacée par la
      galerie de profils elle-même comme question 2 (choix direct, sans
      matrice cachée).
- [ ] Répondre `desktop` ou `autre` à la question usage aboutit à
      `settings.terminal.disabled === true` ; répondre `terminal`/`ide`
      laisse `disabled === false`.
- [ ] Avec `terminal.disabled === true`, l'app n'affiche ni le panneau
      terminal ni la pastille de réouverture réduite.
- [ ] Préférences → Interface affiche, quand désactivé, un bouton « Activer le
      terminal » qui restaure `disabled: false, visible: true` et l'UI
      normale du switch.
- [ ] `pnpm typecheck` et `pnpm test` passent.
