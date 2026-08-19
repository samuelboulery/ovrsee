---
{
  "id": "T-0174",
  "titre": "Un état animé sur les onglets terminal",
  "colonne": "backlog",
  "priorite": "moyenne",
  "charge": "s",
  "tags": ["ui", "terminal"],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": "2026-08-19-lire-un-ticket-en-grand-et-rendre-les-terminaux-bavards.md"
}
---

## Contexte

Une pastille de couleur dit « quelque chose s'est passé » sans dire quoi, et ne
dit rien pendant le travail — l'état qu'on regarde justement pour savoir s'il
faut revenir.

## Critères d'acceptation

- [ ] Trois points battent pendant le travail, une coche verte à la fin, un point
      d'interrogation sur une question.
- [ ] Ouvrir un onglet efface la coche et la question, jamais les points : la
      session travaille toujours.
- [ ] Sous `prefers-reduced-motion`, les points restent affichés, immobiles :
      l'information ne dépend jamais du mouvement.
