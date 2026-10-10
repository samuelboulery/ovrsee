---
{
  "id": "E-0280",
  "titre": "Un crawl sur trois échoue — fiabiliser la capture",
  "colonne": "backlog",
  "priorite": "haute",
  "tags": [
    "crawl",
    "ux"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-audit-produit-et-ux-d-ovrsee-10-oct-2026.md",
  "type": "epic"
}
---

## Contexte

69 des 200 scans de `ovrsee/pages/scans.jsonl` sont en échec (35 %) : 38 « le port répond déjà », 29 « commande dev non approuvée ». L'onglet Produit, cœur de la promesse, est le moins fiable. Détail dans le plan lié (§1).

## Critères d'acceptation

- [ ] Les enfants sont livrés.
- [ ] Sur deux semaines d'usage normal, moins de 5 % des lignes de `scans.jsonl` sont en échec.
