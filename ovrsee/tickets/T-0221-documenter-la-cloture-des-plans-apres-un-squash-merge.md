---
{
  "id": "T-0221",
  "titre": "Documenter la clôture des plans après un squash-merge",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "doc",
    "hooks"
  ],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": null
}
---

## Contexte

CLAUDE.md décrit le rattrapage d'un squash-merge fait sur GitHub, mais
seulement sa moitié : `reconcile` rattache un commit à son plan, il ne
clôt rien. Un plan dont le commit était déjà cité — le cas normal quand
le travail a été commité localement avant d'être squashé — fait répondre
« aucun commit à rattraper » et reste ouvert.

Deux pièges se sont payés dans la même session (T-0220) : chercher la
clôture du mauvais côté, puis découvrir que `ovrsee:close` clôt **tous**
les plans ouverts et non celui qu'on vise — le plan de T-0215 est parti
avec. Et `close --help` n'affiche pas d'aide : il exécute la commande.

## Critères d'acceptation

- [ ] CLAUDE.md dit que `reconcile` rattache et que `ovrsee:close` clôt.
- [ ] La portée de `ovrsee:close` — tous les plans ouverts — est écrite.
- [ ] L'absence d'aide sur `close` est signalée.
