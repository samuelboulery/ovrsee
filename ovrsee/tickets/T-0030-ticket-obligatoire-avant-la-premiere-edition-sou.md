---
{
  "id": "T-0030",
  "titre": "Ticket obligatoire avant la première édition sous un plan actif",
  "colonne": "en-cours",
  "priorite": "haute",
  "tags": [
    "hooks",
    "tickets"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-ticket-obligatoire-avant-integration-pas-apres.md"
}
---

## Contexte

`ovrsee-capture-plan.js` (PostToolUse sur `ExitPlanMode`) ne fait que suggérer
via `additionalContext` de décomposer un plan en tickets — jamais bloquant.
`ovrsee-tool-edit.js` (PostToolUse sur `Edit|Write`) fait avancer un ticket déjà
lié au plan actif, mais reste silencieux si aucun ticket n'existe encore. Rien
n'empêche donc de commencer à éditer du code sous un plan actif sans ticket : la
création se fait après coup, jamais avant — l'inverse de l'invariant voulu.

Aucun hook `PreToolUse` propre à ovrsee n'existe (seuls `DetachIsland` sur `*` et
`pnpm-guard.js` sur `Bash` sont enregistrés dans `~/.claude/settings.json`).

## Ce qu'il faut faire

- Nouveau hook `hooks/ovrsee-tool-edit-gate.js`, `PreToolUse` sur `Edit|Write`,
  calqué sur `~/.claude/hooks/pnpm-guard.js` (`exit 2` + message stderr = blocage
  de l'appel d'outil, message renvoyé au modèle).
- Bloque la première édition de fichier source sous un plan actif tant qu'aucun
  ticket n'a son champ `plan` égal au plan actif (`ovrsee/.active-plan`).
- Laisse passer : hors dépôt git, projet non équipé, édition dans `ovrsee/` ou
  `graphify-out/` (réutiliser `estUneEditionSource` exporté par
  `ovrsee-tool-edit.js`), pas de plan actif, ou au moins un ticket déjà lié.
- Enregistrement dans `~/.claude/settings.json` (section `PreToolUse` →
  `Edit|Write`).
- Tests `node:test` dans `hooks/ovrsee-tool-edit-gate.test.js`, logique de
  décision exportée séparément de `main()` (pas de test qui passe par stdin/exit).

Détail complet de l'approche : `ovrsee/plans/2026-08-11-ticket-obligatoire-avant-integration-pas-apres.md`.

## Critères d'acceptation

- [ ] `pnpm test` passe, nouvelle suite comprise, aucune régression sur les
      hooks ovrsee existants.
- [ ] Plan actif sans ticket lié + `Edit` sur un fichier source → outil bloqué,
      message stderr indique le plan et le geste à faire (skill `ovrsee-tickets`
      ou MCP `createTicket` avec `plan: "<planFile>"`).
- [ ] Une fois le ticket créé avec le bon `plan`, le même `Edit` passe et
      `ovrsee-tool-edit.js` fait ensuite avancer le ticket en `en-cours` comme
      avant.
- [ ] Écrire un ticket (`ovrsee/tickets/*.md`) ne se bloque jamais, avec ou sans
      plan actif.
