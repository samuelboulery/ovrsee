---
{
  "id": "T-0248",
  "titre": "Trois écritures pouvaient effacer réglages et jetons",
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

Les préférences du poste, les jetons d'intégration et le `.gitignore` du dépôt
observé s'écrivaient par `writeFileSync` : ni indivisible, ni protégé d'un lien
symbolique. Les trois se relisent avec un `catch` qui retombe sur un défaut, si
bien qu'une écriture coupée ne se signalait pas.

Pour les intégrations c'est pire qu'une perte locale : le fichier porte les
jetons de tous les projets, et `readAll()` rend `{}` quand il est illisible. La
sauvegarde suivante effaçait donc les jetons des autres projets.

## Critères d'acceptation

- [x] Les trois écritures passent par `writeFileNoFollow` (fichier temporaire puis renommage).
- [x] Un test vérifie qu'aucun fichier temporaire ne survit et qu'un lien symbolique est refusé.
