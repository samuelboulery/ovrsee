---
{
  "id": "T-0266",
  "titre": "Le statut de session attend la fin des agents d'arrière-plan",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "terminal",
    "hooks",
    "issue-125"
  ],
  "cree": "2026-09-29",
  "maj": "2026-09-29",
  "plan": "2026-09-29-corrections-des-3-issues-ouvertes-103-120-125.md",
  "charge": "m",
  "fait": "2026-09-29T14:20:40.536Z"
}
---

## Contexte

Issue #125. `ovrsee-notify.js` traduit tout `Stop` en « fait », et l'état de l'onglet
est écrasé par le dernier signal : dès que l'agent principal rend la main, l'onglet et la
barre de menu disent « fait » alors que des sous-agents ou un workflow tournent encore.

## Critères d'acceptation

- [ ] `SubagentStart`/`SubagentStop` sont signalés par `ovrsee-notify.js` et installés par `pnpm ovrsee:install`.
- [ ] Un `Stop` reçu pendant qu'un sous-agent tourne laisse l'onglet « occupé » ; la fin du dernier sous-agent le passe à « fait ».
- [ ] `/clear` remet l'état à zéro, sous-agents compris.
- [ ] Vérifié en réel : quels agents (arrière-plan, Workflow) émettent ces événements — et les limites dites dans la PR.
