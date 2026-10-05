---
{
  "id": "T-0272",
  "titre": "Lot 2 — la garde git neutralise hooks, filtres, gpg et upload-pack",
  "colonne": "pret",
  "priorite": "haute",
  "tags": [
    "securite"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": "2026-10-05-audit-de-securite-ovrsee-1-3-0-plan-de-correction.md",
  "epic": "E-0270",
  "charge": "m"
}
---

## Contexte

`hooks/git.js` ne coupe que fsmonitor, pager, diff.external et ext::. Un dépôt reçu en archive exécute encore ses hooks (post-index-change, prepare-commit-msg…), ses filtres .gitattributes, ses programmes gpg et, au fetch, son uploadpack.

## Critères d'acceptation

- [ ] `SANS_PROGRAMME` et `gitReseau` neutralisent chacun de ces vecteurs.
- [ ] Le dépôt piégé de `git.test.js` les couvre tous, et rien ne s'y déclenche.
- [ ] `ovrsee-tool-stop.js` passe par `git()` ; le test documentaire voit aussi `spawn`/`execFile`.
- [ ] `install.js` ne rend plus exécutable un hook qu'il n'a pas créé.
