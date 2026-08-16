---
{
  "id": "T-0140",
  "titre": "Autoriser ou refuser une commande depuis le popover",
  "colonne": "revue",
  "priorite": "haute",
  "epic": "T-0137",
  "tags": [
    "electron",
    "terminal",
    "ux"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-extension-barre-de-menu-macos-pour-les-sessions-claude-d-ovr.md"
}
---

## Contexte

Voir qu'une session attend ne suffit pas — la demande était de répondre sans
revenir à la fenêtre. Ovrsee possède le pty : `writeTo` (`electron/pty.js:150`)
écrit dedans depuis le processus principal. Le bouton tape ce que
l'utilisateur taperait.

Le plafond est assumé et il faut l'écrire dans le code : **cela dépend de la
forme de l'invite de Claude Code.** Si elle change, le bouton devient faux. La
parade est de n'envoyer qu'**une seule touche**, jamais une séquence :

- refuser → `ESC`, qui annule l'invite et n'a d'effet nuisible nulle part ;
- autoriser → `Entrée`, qui valide l'option surlignée par défaut, « oui ».

Une séquence comme `1` puis `Entrée` est précisément ce qu'il ne faut pas
faire : si le chiffre valide à lui seul, le `Entrée` qui suit tombe dans
l'invite suivante et y valide autre chose.

Deuxième risque, réel : un signal vieux de trois minutes auquel on a déjà
répondu dans le terminal. Cliquer « Autoriser » approuverait alors à l'aveugle
la demande d'après. D'où la péremption ci-dessous.

Le rendu n'envoie jamais le texte à écrire — seulement `allow` ou `deny`. La
correspondance touche vit dans le processus principal, comme la décision du
programme à lancer vit dans `pty.js` et non dans le rendu.

## Critères d'acceptation

- [ ] Un canal IPC `menubar:answer` prend un identifiant de pty et `allow` ou
      `deny` ; toute autre valeur est refusée sans rien écrire.
- [ ] Le principal traduit lui-même en une touche unique (`\r` / `\x1b`) et
      appelle `writeTo`. Le rendu ne transmet aucun texte à écrire.
- [ ] L'identifiant de pty est vérifié contre les sessions que le principal
      possède ; un identifiant inconnu n'écrit rien.
- [ ] Les deux boutons ne paraissent que sur une session dont la dernière
      attente est `question` — jamais sur un `stop`.
- [ ] L'attente est effacée dès la touche envoyée, et par un signal `stop`
      reçu ensuite.
- [ ] Une attente de plus de deux minutes est marquée périmée dans le popover
      et ses boutons de décision sont désactivés ; « ouvrir la session » reste
      disponible.
- [ ] Le commentaire en tête du code nomme le plafond : dépendance à la forme
      de l'invite, et ce qu'il faudrait pour s'en affranchir (un hook
      `PermissionRequest` bloquant et sa voie retour).
- [ ] Vérifié à la main : `pnpm electron`, demander une commande à Claude,
      passer sur une autre application, « Refuser » depuis la barre de menu →
      le terminal montre l'outil refusé. Recommencer avec « Autoriser ».
- [ ] `pnpm test` et `pnpm typecheck` passent.
