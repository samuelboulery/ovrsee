---
{
  "id": "T-0159",
  "titre": "Chaque hook lit sa session, et ne clôt plus le plan des autres",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "hooks",
    "multi-session"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-rendre-l-etat-plan-actif-ticket-actif-propre-a-chaque-sessio.md",
  "epic": "T-0156",
  "charge": "m"
}
---

## Contexte

Les cinq hooks lisent le pointeur global : la capture (`ovrsee-capture-plan.js:164`), la
gate (`ovrsee-tool-edit-gate.js:108`), l'avancée en cours (`ovrsee-tool-edit.js:131`), la
mise en revue (`ovrsee-tool-stop.js:117`), plus `createTicket` / `moveTicket`
(`tickets.js:413, :483`) qui testent « aucun plan actif » à l'échelle du dépôt.

Et `closeOpenPlans()` (`hooks/plans.js:343`) ferme **tous** les plans ouverts portant un
commit à chaque capture — donc celui d'une session voisine en plein travail.

## Critères d'acceptation

- [ ] Chaque hook lit et écrit l'état de la session de son payload (`session_id`), avec
      `CLAUDE_CODE_SESSION_ID` en repli.
- [ ] `closeOpenPlans(dir, session)` ne ferme que le plan de cette session et les plans
      orphelins — ouverts, avec commits, pointés par personne.
- [ ] Sans argument (CLI, route `/api/plans/close-active`), le geste explicite garde son
      comportement actuel : tout ce qui peut être clos.
- [ ] Test : la session A n'est bloquée ni influencée par le plan actif de B.
