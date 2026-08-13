---
{
  "id": "T-0119",
  "titre": "Notification système et retour à la bonne session",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "terminal",
    "ux",
    "electron"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-notifications-de-session-claude.md"
}
---

## Contexte

Le signal émis par le hook (T-0118) arrive dans le flux `pty:data` déjà écouté
par `app/src/useTerminal.ts:214`. Il reste à le repérer, à le retirer avant
qu'il n'atteigne xterm, et à en faire une notification système dont le clic
ramène l'utilisateur sur la session concernée.

La clé de session (`<projet>#claude`, cf. `claudeSlot`, useTerminal.ts:146)
porte le chemin du projet : une seule chaîne suffit pour rebasculer de projet
et sélectionner l'onglet. Le rendu connaît déjà le focus de la fenêtre, l'onglet
actif et l'état du panneau ; seule la remontée de la fenêtre au premier plan
demande un aller-retour au processus principal.

## Critères d'acceptation

- [ ] `app/src/attention.ts` expose une fonction pure `extractAttention(carry,
      chunk)` → `{ clean, carry, events }`, qui retire la séquence du texte
      rendu et recolle une séquence coupée entre deux lectures du pty.
- [ ] `app/src/attention.test.ts` (`node:test` + `node:assert`, sans framework)
      couvre : séquence entière, séquence coupée en deux morceaux, texte sans
      séquence inchangé, deux séquences dans un même morceau.
- [ ] `useTerminals` accepte un `onAttention(sessionKey, kind)` optionnel et le
      déclenche depuis `bridge.listen`, la queue étant purgée sur `pty:exit`.
- [ ] Aucune notification quand la fenêtre a le focus **et** que la session est
      déjà visible (onglet actif, panneau ouvert).
- [ ] Sinon une notification système paraît, titrée selon le genre
      (« Session terminée » / « Claude pose une question »), corps = nom du
      projet, `tag` = clé de session pour ne pas empiler les doublons.
- [ ] Le clic ramène la fenêtre au premier plan (nouvel IPC `app:focus` exposé
      en `window.ovrsee.app.focus()`), bascule sur le bon projet, ouvre le
      panneau et active le bon onglet — y compris depuis un autre projet.
- [ ] Aucun caractère parasite n'apparaît dans le terminal à la fin d'un tour.
- [ ] `pnpm test` et `pnpm typecheck` passent.
