---
{
  "id": "T-0167",
  "titre": "Vue « Epics » dans l'onglet Tableau",
  "colonne": "backlog",
  "priorite": "haute",
  "charge": "m",
  "tags": ["ui", "tableau"],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": "2026-08-19-sortir-les-epics-du-kanban-et-solder-les-4-issues-ouvertes.md",
  "epic": "T-0164"
}
---

## Contexte

Une fois sortis des colonnes, les epics n'ont plus d'endroit où se voir. Un
segmenté « Kanban / Epics » dans la `ViewBar` leur donne une vue à eux : liste
pleine page, progression, état dérivé, enfants avec le titre de leur colonne.
`ViewBar` est prévue pour ce contrôle (cf. son commentaire).

## Critères d'acceptation

- [ ] `app/src/tabs/TableauEpics.tsx` liste chaque epic avec son état dérivé,
      sa progression et ses enfants.
- [ ] Cliquer un epic ou un enfant ouvre le panneau `Detail` correspondant.
- [ ] Un epic sans enfant, les enfants orphelins et l'absence totale d'epic se
      rendent chacun explicitement — jamais une page blanche.
- [ ] Aucun geste ne déplace un epic : il n'est pas glissable.
