---
{
  "id": "T-0263",
  "titre": "Le registre comme liste blanche est réécrit douze fois",
  "colonne": "backlog",
  "priorite": "basse",
  "tags": [
    "dette"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

La vérification « ce chemin est-il un projet enregistré ? » est réécrite à douze
endroits, dans trois fichiers. Toutes ont la même sémantique aujourd'hui — la
comparaison est stricte partout, vérifié — mais la treizième s'oubliera sans
que rien n'échoue. Un commentaire du code renvoie déjà à une fonction partagée
qui n'existe pas.

Divergence réelle constatée par ailleurs : le serveur d'outils vérifie en plus
que le dossier est utilisable, ce que les deux autres hôtes ne font pas.

## Critères d'acceptation

- [ ] Une seule fonction exportée, appelée par les douze sites.
- [ ] Les trois hôtes répondent la même chose sur un projet devenu inutilisable.
