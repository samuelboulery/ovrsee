---
{
  "id": "T-0131",
  "titre": "Passer public et poser les protections",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "epic": "T-0123",
  "tags": [
    "infra",
    "securite"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-professionnaliser-le-depot-avant-le-passage-en-public.md"
}
---

## Contexte

Les rulesets et les protections de branche répondent `403` tant que le dépôt est
privé sur le plan gratuit. C'est la seule raison pour laquelle cette étape vient
en dernier et non en premier.

Le secret scanning avec push protection est la barrière littérale demandée : un
secret dans un commit est refusé au push, pas signalé après coup.

## Critères d'acceptation

- [ ] Secret scanning avec push protection, Dependabot alerts et security
      updates, CodeQL en default setup : tous actifs.
- [ ] Un ruleset actif sur `main` exige une PR, les trois checks au vert, un
      historique linéaire, et bloque force-push et suppression. Aucun
      `bypass_actors`.
- [ ] `git push origin main` est **refusé**, constaté et non supposé.
- [ ] Une PR d'un caractère ne peut pas être fusionnée tant que les checks ne
      sont pas verts, et sa branche est supprimée après fusion.
- [ ] `GITHUB_TOKEN` en lecture seule par défaut, actions restreintes,
      approbation requise pour les PR de forks.
