---
{
  "id": "T-0295",
  "titre": "Clore automatiquement un plan dont tous les tickets sont soldés ?",
  "colonne": "a-specifier",
  "priorite": "moyenne",
  "tags": [
    "plans",
    "produit"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "epic": "E-0290"
}
---

## Contexte

La clôture est la seule étape manuelle de la boucle quotidienne et la plus oubliée (`ovrsee:close`, plans orphelins après squash-merge). Le signal existe : `avancerTicketsDuPlan` renvoie les tickets soldés. Le CLAUDE.md voulait la clôture manuelle — décision de produit à trancher.

## Critères d'acceptation

- [ ] Décision écrite : clôture auto au commit qui solde le dernier ticket du plan, ou proposition dans l'interface, ou statu quo motivé.
