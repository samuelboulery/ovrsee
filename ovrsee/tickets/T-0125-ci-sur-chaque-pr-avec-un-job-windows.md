---
{
  "id": "T-0125",
  "titre": "CI sur chaque PR, avec un job Windows",
  "colonne": "en-cours",
  "priorite": "haute",
  "charge": "m",
  "epic": "T-0123",
  "tags": [
    "infra",
    "ci"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-professionnaliser-le-depot-avant-le-passage-en-public.md"
}
---

## Contexte

Rien ne teste le dépôt avant un tag. Cinq tests de portabilité cassaient sous
Windows depuis des semaines — séparateurs `\`, bit d'exécution absent, `EPERM`
au lieu d'`EISDIR` — et le premier `git push --tags` les a découverts en faisant
échouer la release.

Les noms de jobs deviendront les status checks requis du ruleset : ils se figent
maintenant, sinon le ruleset citera des contextes qui n'existent pas.

## Critères d'acceptation

- [ ] `.github/workflows/ci.yml` se déclenche sur `pull_request` et sur `push`
      vers `main`, en ignorant `site/**` et les markdown de racine.
- [ ] Trois jobs nommés exactement `checks`, `test-mac` et `test-win`.
- [ ] `checks` lance `pnpm typecheck`, `pnpm lint` et `pnpm build:ui` ;
      `test-mac` et `test-win` lancent `pnpm test`.
- [ ] Les trois passent au vert sur un push de `main`.
