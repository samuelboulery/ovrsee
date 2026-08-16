---
{
  "id": "T-0158",
  "titre": "Pointeurs de travail par session, et verrou de dépôt",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "hooks",
    "multi-session"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-rendre-l-etat-plan-actif-ticket-actif-propre-a-chaque-sessio.md",
  "epic": "T-0156",
  "charge": "l"
}
---

## Contexte

`ovrsee/.active-plan` et `ovrsee/.active-ticket` sont uniques par dépôt : la dernière
session qui écrit gagne, les autres travaillent sous un état qui n'est pas le leur.

Le multi-session révèle en plus deux courses qui existaient déjà. `updatePlanMeta`
(`hooks/plans.js:122`) et `rewrite` (`hooks/tickets.js:428`) font lire → transformer →
écrire : l'écriture est atomique, l'intervalle non, et un commit peut disparaître de
`meta.commits`. Et `nextTicketId` (`hooks/tickets.js:296`) rend `max + 1` d'une lecture du
dossier : deux sessions qui créent un ticket dans la même seconde produisent deux fichiers
portant le même `T-XXXX`.

## Critères d'acceptation

- [ ] `hooks/active.js` expose `sessionId`, `readActive`, `writeActive`, `clearActive`,
      `allActive`, `activePlans`, `withLock`.
- [ ] L'état vit dans `ovrsee/.active/<session>.json` ; session inconnue → seau partagé.
- [ ] Une session ne lit jamais le seau d'une autre — au pire le seau partagé.
- [ ] Un `.active-plan` / `.active-ticket` préexistant migre sans perte au premier accès.
- [ ] Un identifiant de session hostile (`../../etc/passwd`) ne sort pas de `.active/`.
- [ ] `updatePlanMeta`, `rewrite` et l'allocation d'id passent sous `withLock` ; deux
      allocations enchaînées rendent deux identifiants distincts.
- [ ] Un verrou périmé (10 s) n'immobilise pas l'appelant.
