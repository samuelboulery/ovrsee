---
{
  "id": "T-0027",
  "titre": "Choix utilisateur : gitignorer captures et plans/tickets",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "M",
  "tags": [
    "préférences",
    "onboarding",
    "git"
  ],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-choix-utilisateur-gitignorer-captures-et-plans-tickets.md"
}
---

## Contexte

Aujourd'hui, gitignorer `ovrsee/pages/shots/` (captures d'écran) ou garder
`ovrsee/plans/` et `ovrsee/tickets/` versionnés est câblé en dur dans le
`.gitignore` de chaque projet — décidé et édité à la main. Deux interrupteurs
indépendants, exposés dans les Préférences et dans l'onboarding, doivent
laisser ce choix à l'utilisateur, avec synchronisation automatique du
`.gitignore` du projet à chaque commit (hook `ovrsee-post-commit.js`).

Détail de l'approche (schéma des réglages, module de sync, points
d'intégration UI) dans le plan lié.

## Critères d'acceptation

- [ ] Deux réglages `gitignoreShots` / `gitignorePlans` existent dans
      `SettingsType`, avec défauts `true` / `false` (alignés sur l'état actuel
      du dépôt), validés et surchargeables par projet comme `bootstrap` ou
      `packageManager`.
- [ ] Un module dédié applique ces réglages au `.gitignore` du projet de
      façon idempotente (n'écrit que si le contenu change, ne touche pas aux
      autres blocs du fichier).
- [ ] Le hook `ovrsee-post-commit.js` applique la synchronisation à chaque
      commit, sans jamais faire échouer le commit en cas d'erreur.
- [ ] Les deux interrupteurs apparaissent dans la section Projet des
      Préférences, avec une explication que couper/activer un réglage ne
      touche pas à l'historique git déjà commité.
- [ ] Les mêmes deux interrupteurs apparaissent dans l'écran de réglages de
      l'onboarding, et écrivent les mêmes champs de réglages.
- [ ] `pnpm test` passe, avec des tests couvrant l'idempotence du module de
      synchronisation et la validation des deux nouveaux réglages.
