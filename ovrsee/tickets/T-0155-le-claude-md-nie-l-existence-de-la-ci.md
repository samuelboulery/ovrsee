---
{
  "id": "T-0155",
  "titre": "Le CLAUDE.md nie l'existence de la CI",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "xs",
  "tags": [
    "docs",
    "bug"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": null
}
---

## Contexte

La section Tests de `CLAUDE.md` affirme « Il n'y a pas de CI ». C'est faux :
`.github/workflows/ci.yml` tourne sur chaque PR et sur chaque push vers `main`
— `lint`, `typecheck` et `build:ui` sur ubuntu, puis `pnpm test` sur macOS
**et** Windows.

L'affirmation datait d'avant l'arrivée du workflow et a survécu à la
densification du fichier (T-0154), qui l'a recopiée telle quelle. Découverte
en lisant les checks verts de la PR #16, qui contredisaient le document
qu'elle modifiait.

L'erreur n'est pas cosmétique : elle dit à quiconque lit le fichier que rien
ne vérifie le dépôt entre deux tags, donc qu'il faut tout vérifier à la main
— alors que l'inverse est vrai, et que ce qui échappe réellement à la CI
(`hooks/`, `crawl/`, `server/`, `electron/` non typés ; tests d'`app/src`
superficiels) est une information autrement plus utile.

Le commentaire de tête de `ci.yml` porte deux décisions qui méritent de
remonter : l'absence de `paths-ignore` est délibérée (une PR qui ne
déclenche aucun run ne remonte jamais les contextes requis par le ruleset et
devient infusionnable — constaté sur la PR #7), et les noms de jobs sont ceux
que le ruleset cite, donc non renommables sans casser la règle en silence.

## Critères d'acceptation

- [ ] `CLAUDE.md` décrit la CI réelle : ce qu'elle lance, sur quelles
      plateformes, et à quel déclenchement.
- [ ] Ce qui échappe à la CI reste dit, puisque c'est la part non déductible.
- [ ] Plus aucune affirmation du fichier ne contredit `.github/workflows/`.
