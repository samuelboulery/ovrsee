---
{
  "id": "T-0032",
  "titre": "Tracer les tâches hors plan/audit sous forme de ticket (.active-ticket)",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "hooks",
    "tickets"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-tracer-aussi-les-taches-hors-plan-hors-audit-sous-forme-de-t.md"
}
---

## Contexte

Le gate `ovrsee-tool-edit-gate.js` (T-0030) bloque déjà la première édition de
code sous un plan actif tant qu'aucun ticket ne le cite. Mais sans plan actif —
fix rapide, réponse ad hoc, correction d'un constat d'audit déjà capturé — rien
n'impose de ticket : zéro détection, zéro trace.

Nouveau marqueur `ovrsee/.active-ticket`, symétrique à `.active-plan` : il pointe
le ticket « en cours » quand aucun plan ne pilote le travail. Le gate bloque la
première édition hors-plan tant qu'aucun ticket actif ouvert n'existe.

## Critères d'acceptation

- [ ] `hooks/tickets.js` expose `isSafeTicketId`, `readActiveTicket`,
      `clearActiveTicket` ; `createTicket()` pose `.active-ticket` pour un ticket
      créé sans `plan` et sans `.active-plan` ; `moveTicket()` pose/efface
      `.active-ticket` en fonction de la colonne (`en-cours` / finale).
- [ ] `ovrsee-tool-edit-gate.js` bloque une édition source hors-plan sans ticket
      actif ouvert, et laisse passer sinon — sans régresser le cas « plan actif
      sans ticket lié » déjà couvert.
- [ ] `ovrsee-capture-plan.js` efface `.active-ticket` à la capture d'un nouveau
      plan.
- [ ] `pnpm test` vert avec les nouveaux cas dans `tickets.test.js`,
      `ovrsee-tool-edit-gate.test.js`, `ovrsee-capture-plan.test.js`.
- [ ] `skills/ovrsee-tickets/SKILL.md` (les deux copies) documente le cycle de
      vie de `.active-ticket`.
- [ ] `CLAUDE.md` gagne le piège « un plan actif éclipse un ticket actif ».
