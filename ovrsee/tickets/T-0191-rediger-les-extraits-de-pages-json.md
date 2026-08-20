---
{
  "id": "T-0191",
  "titre": "Rédiger les extraits de pages.json",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "crawl",
    "securite"
  ],
  "cree": "2026-08-20",
  "maj": "2026-08-20",
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
