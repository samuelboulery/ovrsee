---
{
  "id": "T-0186",
  "titre": "Rattraper les commits qu'aucun hook n'a vus",
  "colonne": "en-cours",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "hooks",
    "git"
  ],
  "cree": "2026-08-20",
  "maj": "2026-08-20",
  "plan": null
}
---

## Contexte

Le hook `post-commit` ne tourne que sur la machine qui committe. Un squash-merge
fait sur GitHub crée son commit sur les serveurs de GitHub : aucun hook, aucun
rattachement. Le commit arrive ensuite par un `git pull`, et plus personne ne le
relie au plan qu'il réalise.

Constaté sur ce dépôt : la PR #22 a laissé cinq plans ouverts avec zéro commit et
seize tickets « à faire », pour du travail livré la veille. `ovrsee:close` refusait
de les clore — à raison, puisqu'il date la clôture d'après le dernier commit du
plan. Il a fallu rattacher `ff157d6` à la main.

`planPourCommit` ne suffit pas telle quelle : elle ne rend qu'un seul plan, et
ne regarde que `HEAD`. Un squash qui écrase cinq plans en un commit en laisserait
quatre ouverts.

## Critères d'acceptation

- [ ] Un `git pull` qui amène un commit citant des tickets rattache ce commit à
      **tous** les plans ouverts que ces tickets portent.
- [ ] Un intervalle « T-0164 → T-0179 » désigne les seize, pas les deux bornes.
- [ ] Rien n'est deviné : sans ticket cité, rien n'est rattaché. Pas de repli sur
      la session ni sur l'unique plan actif — au moment du `pull`, la session
      courante n'a rien à voir avec le travail qui arrive.
- [ ] Relancer le rattrapage ne duplique aucun commit et ne touche aucun plan clos.
- [ ] Un dépôt équipé avant ce correctif peut rattraper son retard sans attendre
      un prochain `pull`.
