---
{
  "id": "T-0259",
  "titre": "Le type des hooks de configuration ment",
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

Le type déclaré pour les hooks de la configuration Claude ne correspond pas à
la forme réelle du fichier de réglages, qui range un tableau là où le type
attend un objet. Le seul `any` du dépôt est né de cet écart, et le masque.

## Critères d'acceptation

- [ ] Le type décrit la forme réelle du fichier.
- [ ] L'annotation `any` disparaît.
