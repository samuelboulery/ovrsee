---
{
  "id": "T-0059",
  "titre": "Police IBM Plex, pictos de rail et palette ⌘K — corrections connues",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-11-repasse-ui-ovrsee-coller-a-la-maquette-ovrsee-app-dc-html.md",
  "epic": "T-0058"
}
---

## Contexte

Quatre écarts vérifiés en lisant le code, sans ambiguïté de conception (Phase A du
plan) :

1. `_ds/ovrsee/styles.css:68-71` documente que les tokens IBM Plex existent mais
   qu'aucun fichier n'est chargé — retombée sur la pile système. C'est l'écart
   visuel le plus visible, avant même les couleurs.
2. `views.ts:46-54` : Aperçu = `House` (maquette : `SquaresFour`), Produit = `Graph`
   (maquette : `TreeStructure`).
3. `App.tsx:1008-1016` : bouton Préférences rend `⚙` littéral au lieu d'un picto
   Phosphor `GearSix` cohérent avec le reste du rail.
4. `CommandPalette.tsx` : pas de section Projets, pas de raccourcis ⌘1-⌘7 affichés,
   pas de ligne utilisateur en pied — présents dans la maquette (écran système 2a).

## Critères d'acceptation

- [ ] IBM Plex Sans (400/500/600) et IBM Plex Mono (400) auto-hébergées en `.woff2`
      sous `app/src/assets/fonts/`, chargées via `@font-face` dans
      `_ds/ovrsee/styles.css` — plus de retombée sur la pile système, app toujours
      utilisable hors-ligne une fois packagée.
- [ ] `views.ts` : icône `apercu` = `SquaresFour`, icône `produit` = `TreeStructure`.
- [ ] Bouton Préférences du rail rend `GearSix` (contour/plein selon état), plus de
      glyphe `⚙`.
- [ ] Palette ⌘K : section Projets en tête, raccourcis ⌘1-⌘7 visibles à côté de
      chaque vue, ligne utilisateur/paramètres en pied.
- [ ] `pnpm typecheck` et `pnpm test` passent.
