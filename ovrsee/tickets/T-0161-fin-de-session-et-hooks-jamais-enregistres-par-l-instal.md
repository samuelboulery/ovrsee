---
{
  "id": "T-0161",
  "titre": "Fin de session, et hooks jamais enregistrés par l'installateur",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "hooks",
    "installation"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-rendre-l-etat-plan-actif-ticket-actif-propre-a-chaque-sessio.md",
  "epic": "T-0156",
  "charge": "s"
}
---

## Contexte

Rien ne retire le pointeur à la fin d'une session : un plan reste actif et capte le travail
suivant, y compris sans rapport. Claude Code émet `SessionEnd`, dont l'ovrsee ne fait rien.

Découvert au passage : `hooks/install.js` n'enregistre que SessionStart (`:168`),
PostToolUse/ExitPlanMode (`:183`), Stop et Notification (`:196`). `ovrsee-tool-edit.js`,
`ovrsee-tool-edit-gate.js`, `ovrsee-tool-stop.js` et `ovrsee-capture-audit.js` ne sont
enregistrés nulle part — ils ne tournent sur cette machine que parce qu'ils ont été ajoutés
à la main dans `~/.claude/settings.json`. Une machine fraîchement installée n'a ni gate ni
avancée de tickets, et rien ne le laisse voir.

## Critères d'acceptation

- [ ] `hooks/ovrsee-session-end.js` retire le pointeur de sa session ; le plan reste `open`.
- [ ] Une entrée `.active/` non touchée depuis 24 h est ignorée puis purgée — filet pour
      les sessions tuées sans `SessionEnd`.
- [ ] `install.js` enregistre SessionEnd **et** les quatre hooks manquants.
- [ ] `hooks/install.test.js` couvre les nouveaux enregistrements.
