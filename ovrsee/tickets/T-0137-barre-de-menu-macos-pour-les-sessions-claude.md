---
{
  "id": "T-0137",
  "titre": "Barre de menu macOS pour les sessions Claude",
  "colonne": "fait",
  "priorite": "haute",
  "type": "epic",
  "tags": [
    "electron",
    "terminal",
    "ux"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-16",
  "plan": "2026-08-14-extension-barre-de-menu-macos-pour-les-sessions-claude-d-ovr.md"
}
---

## Contexte

T-0119 a livré la notification système : quand une session Claude rend la main
ou pose une question, une notification paraît et son clic ramène sur la bonne
session. Une notification est un événement — elle passe et disparaît. Ce qui
manque est un **état consultable** : ouvrir la barre de menu et voir, sans
revenir à la fenêtre, quelles sessions tournent et laquelle attend.

Et une fois qu'on la voit, pouvoir répondre à la plus fréquente des attentes —
« Claude demande la permission de lancer telle commande » — sans rebasculer.

Tout le transport existe déjà : `hooks/ovrsee-notify.js` émet une séquence OSC
via `terminalSequence`, `app/src/attention.ts` la retire du flux et la
reconnaît. Rien de neuf à inventer côté canal. Ce qui reste est l'affichage
(un `Tray` et une fenêtre popover) et la voie retour.

La voie retour est arbitrée : **des touches écrites dans le pty**, via le
`writeTo` qui existe déjà (`electron/pty.js:150`). Ovrsee possède ce terminal ;
le bouton tape ce que l'utilisateur taperait. Aucun canal nouveau, donc aucune
surface de contrôle nouvelle — un hook bloquant aurait exigé un fichier de
réponse dans `~/.claude/`, que tout processus du même compte peut écrire.

## Critères d'acceptation

- [ ] T-0138, T-0139 et T-0140 sont en colonne finale.
- [ ] Un coup d'œil à la barre de menu suffit à savoir si une session attend,
      sans ouvrir la fenêtre d'ovrsee.
- [ ] `pnpm test` et `pnpm typecheck` passent.
