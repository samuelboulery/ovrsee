---
{
  "id": "T-0118",
  "titre": "Hook de signal de session (Stop et Notification)",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "hooks",
    "terminal"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-notifications-de-session-claude.md"
}
---

## Contexte

Rien ne signale aujourd'hui qu'une session Claude a rendu la main. Le signal
doit partir de Claude Code lui-même, sous forme d'une séquence d'échappement
écrite dans son propre terminal — celui qu'Ovrsee possède.

Faire écrire un fichier au hook contredirait l'invariant du cadrage : rien
n'est ajouté au dépôt observé. La séquence, elle, ne laisse aucune trace, et se
règle toute seule sur la portée voulue : lancée hors d'Ovrsee, la même session
envoie sa séquence à son propre tty (iTerm, VS Code), qui l'ignore.

Dépend de T-0117 pour le choix du transport et le nom du champ de type.

## Critères d'acceptation

- [ ] `hooks/ovrsee-notify.js` émet `\x1b]777;ovrsee;stop\x07` sur
      `hook_event_name: "Stop"`, et `…;question\x07` sur `Notification`.
- [ ] Seuls les types de notification qui appellent une réponse humaine
      déclenchent le signal (`permission_prompt`, `idle_prompt`,
      `agent_needs_input`) ; `auth_success`, `elicitation_*` et
      `agent_completed` sont ignorés.
- [ ] Le hook ne bloque jamais la session et n'écrit sur stdout que le JSON
      attendu — un `console.log` dans un hook casse le flux JSON-RPC.
- [ ] `hooks/install.js` enregistre les deux événements dans le
      `.claude/settings.json` d'un projet équipé, aux côtés des hooks `Stop`
      existants (`ovrsee-tool-stop.js`, `ovrsee-capture-audit.js`).
- [ ] Le message de fin de l'installateur dit qu'un projet déjà équipé doit être
      ré-équipé pour recevoir les nouveaux hooks.
