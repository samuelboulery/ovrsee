---
{
  "id": "T-0273",
  "titre": "Lot 3 — Electron : collage filtré, permissions refusées, fuses posés",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "securite"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": "2026-10-05-audit-de-securite-ovrsee-1-3-0-plan-de-correction.md",
  "epic": "E-0270",
  "charge": "l",
  "fait": "2026-10-05T12:22:59.197Z"
}
---

## Contexte

La page observée peut fermer le collage encadré du terminal (`\x1b[201~`) et taper des touches ; la webview reçoit toutes les permissions par défaut ; l'accord du crawl peut être tacite ; aucun fuse n'est posé.

## Critères d'acceptation

- [ ] Le texte injecté dans un pty perd ESC et C0/C1 (sauf tab et retour ligne).
- [ ] La partition `persist:navigateur` refuse toute permission ; la session principale n'accorde que le nécessaire.
- [ ] `crawl:approve` demande toujours la modale au premier accord d'un projet.
- [ ] Fuses NodeOptions/inspect coupés, intégrité asar active ; le DMG local démarre.
