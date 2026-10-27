---
{
  "id": "T-0304",
  "titre": "Une seule copie d'Ovrsee dans Spotlight",
  "colonne": "revue",
  "priorite": "haute",
  "tags": [
    "build"
  ],
  "cree": "2026-10-27",
  "maj": "2026-10-27",
  "plan": "2026-10-27-notifications-ovrsee-facon-cleanmymac-menage-des-copies-d-ov.md",
  "charge": "s"
}
---

## Contexte

Quatre « Ovrsee » apparaissaient dans Spotlight et Launchpad : les builds de `release/` (dans le dépôt et dans les anciens worktrees lot*) sont indexés. Les worktrees et l'ancien `release/` sont déjà partis ; il reste à empêcher que ça revienne.

## Critères d'acceptation

- [ ] `electron-builder.yml` sort dans `release.noindex/`, `release.yml`, `.gitignore` et la doc suivent
- [ ] `pnpm install:mac` construit et copie l'app dans `/Applications`
- [ ] après un build, `mdfind "kMDItemFSName == 'Ovrsee.app'"` ne renvoie que `/Applications/Ovrsee.app`
