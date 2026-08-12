---
{
  "id": "T-0064",
  "titre": "Panneau droit persistant — élément sélectionné dans Navigateur",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "navigateur"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-repasse-ui-ovrsee-ecarts-de-structure-pas-seulement-de-style.md",
  "epic": "T-0062"
}
---

## Contexte

`app/src/tabs/Navigateur.tsx:722-754` : l'élément sélectionné s'affiche dans une
barre inline en bas de la zone webview. La maquette (2c) en fait un panneau fixe à
droite (~340px) : sélecteur CSS, texte, route, boutons « Coller dans Claude » /
« Ouvrir un ticket », liste des routes connues.

Électron uniquement — la fonctionnalité et son panneau ne se testent pas dans
`pnpm dev` (navigateur), seulement dans l'application empaquetée.

## Critères d'acceptation

- [ ] Panneau droit fixe (~340px) remplace la barre inline : sélecteur, texte,
      route, boutons Coller dans Claude / Ouvrir un ticket, routes connues.
- [ ] N'apparaît que dans Electron (même franchise que le reste de l'onglet).
- [ ] `pnpm typecheck` et `pnpm test` passent.
- [ ] Vérifié manuellement avec `pnpm electron` — pas seulement `pnpm dev`.
