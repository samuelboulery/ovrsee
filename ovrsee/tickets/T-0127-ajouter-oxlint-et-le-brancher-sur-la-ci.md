---
{
  "id": "T-0127",
  "titre": "Ajouter oxlint et le brancher sur la CI",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "epic": "T-0123",
  "tags": [
    "infra",
    "qualite"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-professionnaliser-le-depot-avant-le-passage-en-public.md"
}
---

## Contexte

`hooks/`, `crawl/`, `server/`, `mcp/` et `electron/` sont du JavaScript que rien
ne vérifie statiquement. `checkJs` a été mesuré et écarté : 1338 erreurs en
strict, 865 sans `noImplicitAny` — c'est un chantier, pas une étape.

oxlint est un binaire unique, une seule dépendance de dev, et le seul filet
réaliste sur ces dossiers.

## Critères d'acceptation

- [ ] `oxlint` en devDependency, script `lint`, `.oxlintrc.json` minimal.
- [ ] Le compte de signalements du premier passage est remonté avant de brancher
      la CI dessus.
- [ ] `pnpm lint` sort à zéro, et le job `checks` l'appelle.
