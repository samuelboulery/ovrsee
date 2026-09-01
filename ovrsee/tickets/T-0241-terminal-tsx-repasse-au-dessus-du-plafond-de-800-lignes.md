---
{
  "id": "T-0241",
  "titre": "Terminal.tsx repasse au-dessus du plafond de 800 lignes",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "dette",
    "audit",
    "ui"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": null,
  "epic": "T-0232",
  "charge": "m"
}
---

## Contexte

`app/src/Terminal.tsx` fait 1 049 lignes. Le plafond déclaré est 800, et
[[T-0206]] l'avait rétabli sur quatre fichiers il y a dix jours. Il a dérivé
depuis, sur ce fichier-là seul — c'est le seul du dépôt à le dépasser
aujourd'hui.

Le composant `Terminal` occupe à lui seul de la ligne 165 à la fin, avec six
`useState` et trois responsabilités qui se voient dans le code : la bande
d'onglets (`BoutonBande`, les épingles, le renommage), la disposition
(`LAYOUT_IDS`, `panelStyle`, le redimensionnement) et la session elle-même.

**La contrainte à ne pas casser** : le panneau terminal est en `lazy()`, c'est
le tiers du bundle, et `pty.ts` ne doit jamais importer xterm — `useTerminal.ts`
reste le seul qui le fasse. Un découpage qui remonte un morceau du terminal dans
le chargement initial annulerait le découpage en silence, sans qu'aucun test
échoue.

Un plafond qu'aucun test ne tient dérive dès qu'on regarde ailleurs : c'est la
deuxième fois. La vraie question du ticket n'est pas de redescendre sous 800,
c'est de décider si le plafond se mesure ou s'il se raconte.

## Critères d'acceptation

- [ ] `Terminal.tsx` repasse sous 800 lignes, par extraction — pas par compression du commentaire.
- [ ] `pty.ts` n'importe toujours pas xterm, et `useTerminal.ts` reste son seul importateur.
- [ ] Le panneau terminal reste en `lazy()` : le morceau xterm ne rejoint pas le bundle initial.
- [ ] Une décision est écrite sur le plafond — un test qui le mesure, ou une ligne de `CLAUDE.md` qui dit qu'il est indicatif.
- [ ] `pnpm build:ui` et `pnpm test` verts.
