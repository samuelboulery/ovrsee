---
{
  "id": "T-0040",
  "titre": "Installeur Windows (NSIS) en plus du DMG mac",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "packaging",
    "electron-builder"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-ajouter-un-installeur-windows.md"
}
---

## Contexte

`pnpm package` produit un DMG mac double-clic, aucun terminal requis côté
utilisateur. Rien d'équivalent n'existe pour Windows : pas de section `win`
dans `electron-builder.yml`, pas d'icône `.ico`, script `package` câblé sur
`--mac`.

## Critères d'acceptation

- [ ] `electron-builder.yml` a une section `win` (cible `nsis`, arch `x64`).
- [ ] `build/icon.ico` existe et est commité, généré par
      `scripts/make-icon.js` (16/32/48/256 empaquetés en ICO, sans nouvelle
      dépendance).
- [ ] `package.json` expose `package:mac` et `package:win` (l'ancien
      `package` disparaît).
- [ ] `CLAUDE.md` documente les deux commandes et note que `package:win` doit
      tourner sur une machine Windows (node-pty est natif, pas de
      cross-compile depuis mac).
- [ ] `pnpm package:mac` produit toujours un DMG dans `release/`
      (non-régression).
