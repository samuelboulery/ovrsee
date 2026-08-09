---
{
  "id": "T-0013",
  "titre": "L'interface n'a aucun test",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["tests", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

185 tests passent. Aucun ne touche `app/src/` (3 400 lignes) ni `electron/`
(600 lignes). `pnpm typecheck` ne couvre que `app/src`, et `hooks/`, `crawl/`,
`server/`, `electron/` ne sont pas typés du tout.

Le bug le plus grave trouvé par l'audit ([[T-0002]]) est un caractère manquant à
`Terminal.tsx:372`, dans la zone non testée. Il vide toute l'application. Rien ne
l'aurait attrapé.

Il ne s'agit pas d'atteindre un pourcentage. Trois cibles, dans cet ordre :

1. **Les fonctions pures de `data.ts`** — `stackFrom`, `layoutGraph`, `plansOuverts`,
   les formateurs de date. Testables sans DOM, avec `node:test`, comme le reste du
   projet.
2. **Le rendu de chaque onglet sur une donnée dégradée** : `pages.json` invalide,
   `plans` vide, `tickets` vide, `graph` nul. Le contrat est « ça s'affiche et ça
   dit ce qui manque ».
3. **`markdown.tsx`**, analyseur écrit à la main : bloc de code non fermé,
   emphase imbriquée, lien contenant des parenthèses, HTML brut.

Le point 2 est ce qui aurait attrapé [[T-0002]].

Contrainte : rester sur `node:test`. Pas de vitest ni de jest — voir `CLAUDE.md`.

## Critères d'acceptation

- [ ] `pnpm test` exécute des tests portant sur `app/src/`.
- [ ] Les fonctions pures de `data.ts` sont couvertes, cas dégradés compris.
- [ ] Chaque onglet a un test qui le rend avec un snapshot dégradé et vérifie
      qu'il n'y a pas d'exception.
- [ ] `markdown.tsx` a un test par cas limite listé ci-dessus.
