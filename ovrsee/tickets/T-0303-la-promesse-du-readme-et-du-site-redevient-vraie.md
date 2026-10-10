---
{
  "id": "T-0303",
  "titre": "La promesse du README et du site redevient vraie",
  "colonne": "backlog",
  "priorite": "basse",
  "tags": [
    "docs"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-audit-produit-et-ux-d-ovrsee-10-oct-2026.md",
  "charge": "s"
}
---

## Contexte

« Ovrsee reads; it only runs a terminal if you ask » : l'app lance pourtant le serveur de dev au commit. Le site annonce « six tabs » et `pnpm ovrsee:install`, absent du DMG.

## Critères d'acceptation

- [ ] README, README.fr et `site/index.html` (+ `dict.json`) décrivent ce que fait réellement l'app, en une phrase vraie, et le parcours DMG sans pnpm.
