---
{
  "id": "T-0033",
  "titre": "Empêcher un ticket fini de rester bloqué en « en cours »",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "hooks",
    "tickets"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-empecher-un-ticket-fini-de-rester-bloque-en-en-cours.md"
}
---

## Contexte

T-0030 est resté en `en-cours` alors que son code est committé (`af718fa`).
Deux causes : `ovrsee-cli.js:close()` n'appelait jamais `avancerTicketsClos()`
(bug confirmé), et le commit qui créait le plan de T-0030 ne s'est jamais
rattaché à ce plan (`.active-plan` pointait ailleurs à ce moment-là) — signal
perdu à la racine, pas rattrapable automatiquement.

## Critères d'acceptation

- [ ] `avancerTicketsClos` déménage dans `hooks/tickets.js`, généralisée pour
      rescanner tous les plans `status: "closed"` (plus de paramètre
      `plansClos`).
- [ ] `ovrsee-cli.js close()` l'appelle après `closeOpenPlans()`.
- [ ] `ovrsee-post-commit.js` l'appelle après `avancerTicketsDuPlan()` à chaque
      commit — filet automatique.
- [ ] `ovrsee-cli.js status()` liste les tickets dont le plan lié est `open`
      sans aucun commit.
- [ ] `pnpm test` vert.
- [ ] T-0030 corrigé à la main : plan `closed`, ticket en colonne `fait`.
