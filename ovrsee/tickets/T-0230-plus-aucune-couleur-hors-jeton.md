---
{
  "id": "T-0230",
  "titre": "Plus aucune couleur hors jeton, et un garde-fou qui le voit",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "design-system",
    "issue-64"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": "2026-09-01-theme-clair-complet-issue-64-t-0218.md",
  "epic": "T-0218",
  "charge": "m"
}
---

## Contexte

Ce qui reste écrit en dur ne suivra aucun changement de jeton. L'inventaire
surprend : quatre hex applicatifs seulement, mais **quinze `rgba()`** — et c'est
l'inverse de ce qu'on croit, parce que `hooks/couleurs.test.js` ne connaît que
le hex. Les six voiles `rgba(6,7,14,.88)` sont recopiés à l'identique dans six
fichiers ; trois des cinq ombres noires recopient un `--shadow-lg` qui existe
déjà ; et `Lightbox.tsx:166-169` porte les **seules couleurs de texte en dur de
tout `app/src`**, celles qui deviendront franchement illisibles en clair.

Le garde-fou lui-même a dérivé : sur les 20 entrées de `FICHIERS_PORTES`, **17
ne contiennent plus aucun hex** et restent dispensées du contrôle pour rien —
dont `App.tsx`, `Terminal.tsx`, `Onboarding.tsx`. Son en-tête affirme encore que
sa raison d'être a été retirée par T-0075.

Trois hex restent légitimes et le disent : le fond blanc du webview Chromium,
qui n'est pas l'ovrsee, et le surlignage injecté dans la page observée, qui ne
lit pas nos jetons — celui-là doit seulement rester lisible sur une page claire
comme sombre. Le `#4d5060` de `Produit.tsx` n'en fait pas partie : son
commentaire vise l'attribut de présentation SVG, pas la propriété CSS.

## Critères d'acceptation

- [ ] Les quinze `rgba()` passent par des jetons ; le voile et les ombres ne sont
      plus recopiés d'un fichier à l'autre.
- [ ] Les hex de `ActivityPanel.tsx`, `Produit.tsx` et `Navigateur.tsx` sont
      traités ; ceux qui restent portent la raison pour laquelle ils restent.
- [ ] Le garde-fou voit aussi `rgba()`, `rgb()` et `hsl()`.
- [ ] `FICHIERS_PORTES` ne liste plus que des fichiers qui portent réellement une
      couleur littérale.
- [ ] Les commentaires qui affirment encore que le thème clair a été retiré sont
      réécrits : `theme.ts`, `theme.test.ts`, `couleurs.test.js`, et le `:root`
      de `styles.css` qui cite un `nocturneClair` disparu.
- [ ] Les dix jetons `--theme-xterm-*`, injectés sans aucun consommateur, sont
      supprimés plutôt que doublés par thème.
