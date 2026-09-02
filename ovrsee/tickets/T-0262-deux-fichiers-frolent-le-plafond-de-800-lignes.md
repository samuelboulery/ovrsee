---
{
  "id": "T-0262",
  "titre": "Deux fichiers frôlent le plafond de 800 lignes",
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

Le panneau du terminal est à 798 lignes, la gestion des tickets à 774. Le
plafond est mesuré par un test, qui échouera à la 801ᵉ ligne — donc au premier
correctif un peu bavard, et sans que rien ne l'ait annoncé.

Les coupes naturelles sont identifiées : la publication de l'état vers la barre
de menu d'un côté, les images de ticket et le ticket actif de l'autre.

## Critères d'acceptation

- [ ] Les deux fichiers repassent nettement sous le plafond.
- [ ] Aucun ajout à la liste d'exemptions du test.
