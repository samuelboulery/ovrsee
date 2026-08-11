---
{
  "id": "T-0038",
  "titre": "Un ticket ad hoc éclipsé par un plan restait figé en en-cours",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["hooks", "tickets", "bug"],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": null
}
---

## Contexte

`ovrsee-capture-plan.js` efface `.active-ticket` au démarrage d'un plan
(`clearActiveTicket`) sans jamais toucher au ticket lui-même. Un ticket ad hoc
(`plan: null`) resté en « en-cours » à ce moment-là n'est ensuite plus suivi
par aucun hook — ni `avancerTicketsEnRevue` ni `avancerTicketsDuPlan`, qui ne
regardent que les tickets citant le plan actif — et reste figé indéfiniment.
Constaté sur ce projet même avec T-0036.

## Correctif

`avancerTicketActifEclipse` (hooks/tickets.js) pousse le ticket ad hoc actif
en « revue » avant que `clearActiveTicket` n'efface le pointeur, uniquement
s'il est en `en-cours`, sans plan, et si le tableau a une colonne `revue`.
Appelé depuis `ovrsee-capture-plan.js` juste avant `clearActiveTicket`.

## Critères d'acceptation

- [x] Un ticket ad hoc en `en-cours` passe en `revue` quand un plan démarre.
- [x] Un ticket pas encore commencé, ou lié à un plan, ou sans colonne
      `revue` sur le tableau : aucun effet.
- [x] `pnpm test` et `pnpm typecheck` verts (5 nouveaux tests dans
      `hooks/tickets.test.js`).
