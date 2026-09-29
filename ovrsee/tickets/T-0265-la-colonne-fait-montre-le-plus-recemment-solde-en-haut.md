---
{
  "id": "T-0265",
  "titre": "La colonne « fait » montre le plus récemment soldé en haut",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "tableau",
    "issue-103"
  ],
  "cree": "2026-09-29",
  "maj": "2026-09-29",
  "plan": "2026-09-29-corrections-des-3-issues-ouvertes-103-120-125.md",
  "charge": "s"
}
---

## Contexte

Issue #103. La colonne « fait » est triée comme les autres (priorité, puis date de
création), et aucun champ ne date le passage en colonne finale : T-0179, soldé après
T-0178, apparaît plus bas.

## Critères d'acceptation

- [ ] `moveTicket` pose `fait` (ISO complet) en colonne finale et le retire ailleurs ; `createTicket` aussi quand il crée en colonne finale.
- [ ] La colonne finale du Kanban est triée par `fait` décroissant, repli sur `maj` puis sur l'id décroissant.
- [ ] Les autres colonnes, le brief, le CLI et la vue Epics gardent le tri priorité/création.
- [ ] Tests `node:test` sur les deux points.
