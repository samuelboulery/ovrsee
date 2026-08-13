---
{
  "id": "T-0117",
  "titre": "Sonde — transport du signal d'un hook vers le pty",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "terminal",
    "hooks",
    "spike"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-notifications-de-session-claude.md"
}
---

## Contexte

Les notifications de session reposent sur un signal qu'un hook Claude Code
émet dans son propre terminal, et qu'Ovrsee lit sur le flux `pty:data` qu'il
possède déjà. Deux points ne sont pas documentés et décident du code des
tickets suivants :

1. Le champ `terminalSequence` d'une sortie de hook est documenté pour `Stop`.
   Rien ne dit qu'il est honoré pour `Notification`.
2. Le nom du champ qui porte le type de notification (`permission_prompt`,
   `idle_prompt`, `agent_needs_input`, `auth_success`…) n'est pas documenté —
   or c'est lui qui sépare « Claude attend une réponse » du bruit.

Écrire le hook définitif sans cette réponse, c'est coder deux transports « au
cas où » et garder les deux pour toujours.

## Critères d'acceptation

- [ ] Un `hooks/ovrsee-notify.js` provisoire journalise son stdin brut dans
      `/tmp/ovrsee-hook.jsonl` et tente les deux transports : sortie JSON
      `terminalSequence`, et écriture directe vers `/dev/tty`.
- [ ] Après une session dans `pnpm electron`, le journal donne la charge utile
      exacte des événements `Stop` et `Notification`, nom du champ de type
      compris.
- [ ] On sait lequel des deux transports arrive jusqu'au pty, pour `Stop` et
      pour `Notification` séparément.
- [ ] La conclusion est consignée (commentaire en tête du hook ou note du
      ticket) ; la journalisation provisoire ne survit pas au ticket suivant.
