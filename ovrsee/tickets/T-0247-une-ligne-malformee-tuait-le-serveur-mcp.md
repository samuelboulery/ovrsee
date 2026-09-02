---
{
  "id": "T-0247",
  "titre": "Une ligne malformée tuait le serveur MCP",
  "colonne": "fait",
  "priorite": "haute",
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

`JSON.parse` rend aussi bien `null`, un nombre ou un tableau, et la
déstructuration qui suivait était hors du `try`. Une seule ligne `null` sur
l'entrée standard tuait le processus : la session perdait tous ses outils sans
un message, et la requête suivante restait sans réponse. Les réponses d'erreur
omettaient en outre l'`id` que JSON-RPC 2.0 exige.

## Critères d'acceptation

- [x] Une ligne JSON valide mais non-objet est refusée sans tuer le serveur.
- [x] Toute réponse d'erreur porte un `id`, `null` à défaut.
- [x] Un nom hérité d'`Object` (`constructor`, `valueOf`) n'est pas pris pour un outil.
