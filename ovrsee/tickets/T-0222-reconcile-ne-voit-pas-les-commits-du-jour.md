---
{
  "id": "T-0222",
  "titre": "Reconcile ne voit pas les commits du jour",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": null
}
---

## Contexte

`reconcile()` cherche les commits à rattraper dans une fenêtre `git log
--since=<opened>`, où `opened` est la date d'ouverture du plan le plus
ancien — une date nue, `YYYY-MM-DD`.

Git résout une date nue par approxidate : il en complète l'heure avec
**l'heure courante**, pas minuit. `--since=2026-08-31` un 31 août à 20 h 38
signifie donc « depuis 20 h 38 », et laisse dehors tout ce qui a été commité
plus tôt dans la journée.

Conséquence : un plan ouvert aujourd'hui ne peut pas voir les commits
d'aujourd'hui. C'est exactement la situation pour laquelle `reconcile`
existe — un squash-merge fait sur GitHub le jour même — et il n'y répond
que le lendemain. Constaté sur le plan « Tour du dépôt » : `f783e06` cite
ses quatre tickets, `plansPourMessage` le rattache correctement, mais
`git log --since=2026-08-31` rendait une liste vide.

Le jeu de tests ne l'attrapait pas : sa fixture ouvre les plans au
`2026-01-01`, une date assez ancienne pour que l'heure ne change rien.

## Critères d'acceptation

- [ ] La fenêtre est bornée à minuit, pas à l'heure courante.
- [ ] Un test ouvre un plan **le jour même** et vérifie que le commit du
      jour est rattaché.
- [ ] `pnpm ovrsee:reconcile` rattache `f783e06` au plan « Tour du dépôt »,
      que `pnpm ovrsee:close` peut alors clore.
