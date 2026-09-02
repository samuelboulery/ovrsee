---
{
  "id": "T-0261",
  "titre": "Aucun contrôle de dépendances ni de couverture en intégration continue",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "ci"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

La chaîne d'intégration lance le lint, les types, la compilation et les tests
sur trois systèmes, mais aucune analyse de vulnérabilité, aucun seuil de
couverture, et aucun scan de secrets. La chaîne de publication, elle, ne lance
même pas le lint ni la vérification de types avant de construire un binaire
téléchargeable par n'importe qui.

Couverture mesurée à la main ce jour : 90,8 % de lignes côté Node, 78,2 % côté
interface, mais seulement 43,3 % des fonctions de l'interface.

## Critères d'acceptation

- [ ] La chaîne de publication lance lint et vérification de types avant de construire.
- [ ] Une analyse de vulnérabilité tourne sur chaque proposition de changement.
- [ ] Un seuil de couverture est posé, au niveau mesuré aujourd'hui.
