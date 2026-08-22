---
{
  "id": "T-0191",
  "titre": "Rédiger les extraits de pages.json",
  "colonne": "pret",
  "priorite": "haute",
  "tags": [
    "crawl",
    "securite"
  ],
  "cree": "2026-08-20",
  "maj": "2026-08-22",
  "plan": "2026-08-20-audit-de-securite-complet-findings-et-correctifs.md",
  "charge": "xs"
}
---

## Contexte

Audit de sécurité du 2026-08-20, finding différé.

`redige()` ne s'applique qu'à `entry.error` de `scans.jsonl`, depuis
`recordScan()`. Or le crawl écrit aussi `pages.json`, versionné lui aussi, dont
le champ `excerpt` porte 400 caractères d'`innerText` de l'application observée.

Une page d'administration qui affiche un jeton, une page de debug qui imprime sa
configuration, une erreur de l'application rendue à l'écran : le texte part dans
git sans qu'aucun filtre ne le voie. Le raisonnement qui a produit `redige()`
pour les traces d'échec vaut mot pour mot ici.

## Critères d'acceptation

- [ ] Les `excerpt` de `pages.json` passent par `redige()` avant écriture.
- [ ] Le titre des pages aussi — il vient du même DOM.
- [ ] Un test couvre un extrait qui contient un jeton de forme connue.

## Relevé le 2026-08-22

L'audit du 2026-08-22 (`2026-08-22-audit-de-cybersecurite-complet-findings-et-correctifs.md`) confirme le constat et monte la priorité.
`crawl/index.js:304` prend 400 caractères d'`innerText` de l'application observée,
`:424` les range en `excerpt`, `:450` les écrit dans `pages.json`, versionné —
sans passer par `redige()`, alors que `scans.jsonl`, écrit dix lignes plus haut,
y passe (`:104`).

Deuxième raison, qui n'était pas dans le constat d'origine : `excerpt` est la
principale source de contenu écrit par un tiers qui entre dans le contexte d'un
modèle, par le skill `ovrsee` et par l'outil MCP `getProjectSummary`.
