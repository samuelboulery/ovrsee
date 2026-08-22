---
{
  "id": "T-0202",
  "titre": "Fabriquer l'icône depuis icon.svg, sans Playwright",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "s",
  "tags": [
    "build",
    "dette"
  ],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null,
  "epic": "T-0197"
}
---

## Contexte

`scripts/make-icon.js` fait 184 lignes : il décrit le dessin de l'œil en dur,
lance Chromium via `playwright-core` pour le rendre en PNG, puis décline avec
`sips` et assemble avec `iconutil`.

Or `build/icon.svg` est versionné, et c'est exactement ce dessin. Le passage par
un navigateur ne sert donc qu'à convertir un SVG déjà sur le disque en PNG —
`sips` sait le faire seul. Le script se réduit à la chaîne `sips` + `iconutil`,
et n'a plus besoin d'un navigateur pour tourner.

À vérifier au passage : le script n'est cité par aucun script de `package.json`,
et les coordonnées du dessin sont censées rester d'accord avec `Logo` dans
`app/src/OnboardingArt.tsx`. Si le SVG devient la source unique, ce lien-là
change de nature — le dire dans l'en-tête.

## Critères d'acceptation

- [ ] `scripts/make-icon.js` n'importe plus `playwright-core`.
- [ ] Relancer le script produit un `build/icon.icns` visuellement identique à l'actuel.
- [ ] L'en-tête du script dit d'où vient désormais le dessin.
