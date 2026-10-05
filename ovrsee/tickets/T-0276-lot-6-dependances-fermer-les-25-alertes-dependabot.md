---
{
  "id": "T-0276",
  "titre": "Lot 6 — dépendances : fermer les 25 alertes Dependabot",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "securite"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": "2026-10-05-audit-de-securite-ovrsee-1-3-0-plan-de-correction.md",
  "epic": "E-0270",
  "charge": "s"
}
---

## Contexte

25 alertes, toutes en dev et transitives (electron-builder, @electron/get), déjà en dernière version : correction par `overrides` pnpm.

## Critères d'acceptation

- [ ] `pnpm audit` (dev compris) ne remonte rien.
- [ ] `pnpm package:mac` construit toujours.
- [ ] Les alertes se ferment après le merge.
