---
{
  "id": "T-0166",
  "titre": "Le Kanban ne montre plus que des tickets",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "ui",
    "tableau"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-sortir-les-epics-du-kanban-et-solder-les-4-issues-ouvertes.md",
  "epic": "T-0164"
}
---

## Contexte

Un enfant est aujourd'hui rendu *dans* la carte de son epic (`groupEpics`,
`enfantsIci`), ce qui a déjà valu un rustinage au `stopPropagation` (T-0147,
issue #9), et déplacer un epic laisse ses enfants sur place (issue #19). Retirer
le nid retire les deux symptômes d'un coup. `Tableau.tsx` est à 1223 lignes :
ce lot en enlève plus qu'il n'en ajoute.

## Critères d'acceptation

- [ ] `groupEpics`, la prop `enfantsIci`, le rendu imbriqué et l'état
      `filtreEpic` ont disparu de `app/src/tabs/Tableau.tsx`.
- [ ] Un ticket enfant est une carte de plein droit dans sa colonne, avec sa
      puce « Enfant de T-XXXX » et son bouton « Détacher ».
- [ ] Cliquer un enfant ouvre cet enfant, pas son epic (non-régression #9).
- [ ] Le glisser-déposer d'un ticket entre colonnes marche toujours.
