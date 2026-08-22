---
{
  "id": "T-0210",
  "titre": "Commentaires périmés et imports hors façade après T-0133",
  "colonne": "fait",
  "priorite": "basse",
  "tags": ["proprete"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-suites-de-la-revue-de-la-pr-61.md"
}
---

## Contexte

Le déplacement de la passerelle pty vers `app/src/pty.ts` a laissé des traces
qui racontent l'ancien état du code. Un commentaire qui nomme le mauvais fichier
est pire qu'absent : il envoie chercher ailleurs.

- `Donnees.tsx` et `PreferencesIntegrations.tsx` justifient encore leur lecture
  de `window` par « sans importer `useTerminal.ts` », alors que le type vient
  maintenant de `pty.ts` — le module qui, justement, ne charge pas xterm.
- `Donnees.tsx` importe `GraphPayload` de `../graph` quand tous les autres types
  passent par la façade `../data`.
- `app/src/pty.ts` porte une double ligne vide héritée du découpage.
- `Donnees.tsx` teste `ctrl.signal.aborted` là où `estAbandon()` (`api.ts`)
  existe et sert partout ailleurs.

## Critères d'acceptation

- [ ] Aucun commentaire d'`app/src` ne justifie un import par un fichier qui
      n'est plus celui importé.
- [ ] `estAbandon()` est le seul test d'abandon de requête dans `app/src`.
- [ ] `pnpm lint` et `pnpm typecheck` verts.
