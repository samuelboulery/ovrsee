---
{
  "id": "T-0165",
  "titre": "L'état d'un epic se dérive de ses enfants",
  "colonne": "backlog",
  "priorite": "haute",
  "charge": "s",
  "tags": ["tableau"],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": "2026-08-19-sortir-les-epics-du-kanban-et-solder-les-4-issues-ouvertes.md",
  "epic": "T-0164"
}
---

## Contexte

Le `colonne` d'un epic est le champ qui ment : il faut le poser quelque part
alors que ses enfants sont répartis sur tout le tableau. L'état d'un epic doit
se calculer, pas se saisir. `epicProgress` fait déjà la moitié du travail
(`app/src/data.ts:927`) ; il manque l'état lui-même.

## Critères d'acceptation

- [ ] `epicEtat(children, board)` dans `app/src/data.ts` rend `vide`,
      `non-commencee`, `en-cours` ou `terminee`.
- [ ] Un tableau à une seule colonne ne rend jamais `terminee` — `colonneFinale`
      y vaut `null`.
- [ ] Les cinq cas sont couverts dans `app/src/data.test.ts`, en `node:test`.
