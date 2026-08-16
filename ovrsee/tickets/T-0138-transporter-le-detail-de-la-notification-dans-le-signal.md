---
{
  "id": "T-0138",
  "titre": "Transporter le détail de la notification dans le signal",
  "colonne": "fait",
  "priorite": "haute",
  "epic": "T-0137",
  "tags": [
    "hooks",
    "terminal"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-16",
  "plan": "2026-08-14-extension-barre-de-menu-macos-pour-les-sessions-claude-d-ovr.md"
}
---

## Contexte

La séquence actuelle ne porte qu'un genre : `stop` ou `question`. Suffisant
pour une notification titrée « Claude pose une question », insuffisant pour un
popover où l'on doit décider d'autoriser : « une question » ne dit pas
laquelle.

La charge utile du hook `Notification` porte un champ `message`. Le faire
voyager dans la séquence coûte peu — le transport est déjà prouvé, et
`attention.ts` est déjà une fonction pure testée. Encodage base64 : le message
est du texte libre, et un `BEL` ou un `ESC` qui s'y glisserait couperait la
séquence en deux.

Ce qui n'est **pas** dans ce ticket : la ligne de commande complète. Elle
n'existe que dans la charge utile de `PermissionRequest`, qui est un hook
bloquant et demanderait une voie retour par fichier — écartée avec l'epic.

## Critères d'acceptation

- [ ] `sequence(genre, detail)` dans `hooks/ovrsee-notify.js` produit
      `<ESC>]777;ovrsee;<genre>;<base64><BEL>` quand un détail est présent, et
      la forme courte `<ESC>]777;ovrsee;<genre><BEL>` quand il ne l'est pas.
- [ ] Le hook lit `message` sur les charges `Notification` et l'y place ;
      `Stop` reste sans détail.
- [ ] Un détail plus long que 200 caractères est coupé — une séquence OSC
      traverse le pty, elle n'est pas un canal de transfert.
- [ ] `extractAttention` rend `events: { kind, detail }[]`, `detail` valant
      `null` en l'absence de charge, et un base64 illisible ne fait pas lever :
      il vaut `null`, la séquence est consommée quand même.
- [ ] `app/src/attention.test.ts` couvre la forme courte (non-régression), la
      forme longue, un base64 invalide, et une séquence longue coupée en deux
      morceaux.
- [ ] `pnpm test` et `pnpm typecheck` passent.
