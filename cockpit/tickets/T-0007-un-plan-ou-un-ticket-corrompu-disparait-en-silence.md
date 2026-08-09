---
{
  "id": "T-0007",
  "titre": "Un plan ou un ticket corrompu disparaît en silence",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["justesse", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

Vérifié pendant l'audit sur un projet fabriqué : un `cockpit/tickets/T-0001.md`
au frontmatter JSON invalide et un `cockpit/plans/…md` au frontmatter invalide
produisent une réponse d'API `{"tickets": [], "plans": []}`. Les deux fichiers
existent sur le disque, l'interface affirme qu'il n'y a rien.

C'est le même mensonge que le projet s'interdit ailleurs. Le crawl écrit
explicitement « scan échoué le X » plutôt que de garder la capture précédente ;
la lecture, elle, avale ses erreurs.

Un ticket illisible est un ticket qui existe. Le dire coûte une ligne ; le taire
fait croire à un tableau vide.

## Critères d'acceptation

- [ ] Un ticket au frontmatter invalide apparaît dans l'interface comme illisible,
      avec son nom de fichier.
- [ ] Idem pour un plan.
- [ ] Le reste du tableau et de l'historique s'affiche normalement — un fichier
      cassé n'en cache pas dix autres.
- [ ] Une ligne illisible de `scans.jsonl` est comptée quelque part plutôt que
      simplement sautée.
