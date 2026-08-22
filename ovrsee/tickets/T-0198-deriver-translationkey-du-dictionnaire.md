---
{
  "id": "T-0198",
  "titre": "Dériver TranslationKey du dictionnaire",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": ["i18n", "dette"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null,
  "epic": "T-0197"
}
---

## Contexte

`hooks/i18n.d.ts` énumère à la main les ~780 clés de `hooks/i18n.js`, une par
ligne, en union de chaînes littérales. Son propre en-tête justifie la
duplication ainsi : « un `.d.ts` ne sait pas dériver un type d'un `.js` non
typé ».

C'est faux. Avec `"allowJs": true` dans `tsconfig.json`, TypeScript type le
`.js` directement depuis son littéral d'objet — sans `checkJs`, donc sans
imposer d'annotations au fichier. Le dictionnaire reste du JavaScript simple,
que le processus principal d'Electron (`electron/menu.js`) continue de lire
sans compilation. Rien de ce qui motivait la duplication ne tient.

En prime, le test qui met cette duplication « sous surveillance »
(`hooks/i18n.test.js`, premier cas) n'a plus rien à surveiller.

## Critères d'acceptation

- [ ] `hooks/i18n.d.ts` est supprimé.
- [ ] `TranslationKey` est dérivé du dictionnaire (`keyof typeof translations.fr`)
      et une clé inconnue passée à `t()` est toujours une erreur de compilation.
- [ ] Le test « la déclaration TypeScript énumère exactement les clés » est retiré ;
      celui qui compare fr et en reste.
- [ ] `pnpm typecheck`, `pnpm test` et `pnpm build:ui` passent ; le menu natif
      Electron affiche toujours ses libellés traduits.
