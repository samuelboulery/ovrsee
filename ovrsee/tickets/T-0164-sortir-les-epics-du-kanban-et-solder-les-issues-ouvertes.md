---
{
  "id": "T-0164",
  "titre": "Sortir les epics du Kanban et solder les issues ouvertes",
  "colonne": "backlog",
  "priorite": "haute",
  "charge": "l",
  "tags": ["ui", "tableau", "terminal"],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": "2026-08-19-sortir-les-epics-du-kanban-et-solder-les-4-issues-ouvertes.md",
  "type": "epic"
}
---

## Contexte

Quatre issues sont ouvertes (#18, #19, #20, #21). Trois disent la même chose :
un epic est aujourd'hui une carte comme une autre, posée dans une colonne, qui
contient visuellement ses enfants. Un conteneur qui porte lui-même un statut de
colonne est une contradiction — l'epic doit être d'un côté ou de l'autre alors
que ses enfants sont éparpillés, et le déplacer laisse ses enfants derrière.

L'epic sort du Kanban : vue à part, état entièrement dérivé de ses enfants.
Les deux autres issues touchent le panneau terminal et voyagent avec.

## Critères d'acceptation

- [ ] Aucune carte epic dans les colonnes du Kanban.
- [ ] Un epic ne peut pas être « terminée » tant qu'un enfant n'est pas fini —
      par construction, pas par garde-fou.
- [ ] Les issues #18, #19, #20 et #21 sont closes.
