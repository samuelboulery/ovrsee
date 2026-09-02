---
{
  "id": "T-0249",
  "titre": "Annuler un crawl laissait le serveur de dev en vie",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "robustesse"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

Le serveur de dev du projet observé est lancé `detached`, donc dans son propre
groupe de processus. Annuler un crawl tue le groupe du crawler : le crawler
meurt avant son `finally`, et le serveur survit. Le port restait pris, et tous
les crawls suivants se refusaient d'eux-mêmes, `assertPortFree` voyant une
réponse à `baseUrl`.

## Critères d'acceptation

- [x] Le crawler arrête le serveur de dev sur `SIGTERM` et `SIGINT`.
- [ ] Vérifié à la main : lancer un crawl, l'annuler, relancer — le second démarre.
