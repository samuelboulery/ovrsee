---
{
  "id": "T-0205",
  "titre": "Lire packageManager avant de renifler les lockfiles",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "xs",
  "tags": ["dette"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null,
  "epic": "T-0197"
}
---

## Contexte

`hooks/detect-package-manager.js` devine le gestionnaire de paquets d'un projet
en comptant ses lockfiles, et retombe sur le défaut dès qu'il y en a zéro ou
plusieurs.

Le champ `packageManager` de `package.json` est la réponse déclarée — c'est ce
que lit Corepack, et c'est ce que les règles du projet exigent de tout
`package.json`. Le lire d'abord donne la bonne réponse sur un dépôt fraîchement
cloné, avant tout `install`, et tranche le cas ambigu des deux lockfiles.

Le reniflage garde sa place : en repli, pour les projets qui ne déclarent rien.

## Critères d'acceptation

- [ ] `packageManager` est lu en premier ; sa forme `nom@version` est ramenée au nom.
- [ ] Le reniflage de lockfiles reste le repli, avec le même comportement qu'aujourd'hui.
- [ ] Un projet sans `node_modules` mais avec `packageManager` est détecté correctement.
