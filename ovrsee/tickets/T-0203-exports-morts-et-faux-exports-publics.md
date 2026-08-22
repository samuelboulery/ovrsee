---
{
  "id": "T-0203",
  "titre": "Exports morts et faux exports publics",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "xs",
  "tags": ["dette"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null,
  "epic": "T-0197"
}
---

## Contexte

`noUnusedLocals` voit les variables locales inutilisées, pas les exports que
personne n'importe. Le balayage en a trouvé deux catégories.

Mort pour de bon : `injectToClaude` (`app/src/useTerminal.ts`), cité seulement
par deux commentaires. Deux autres — `unthemedColors`, `IconSystem`/`IconLight` —
partent avec T-0200.

Faux publics : `COL_STEP`, `labelOf`, `Champ`, `BlocActions`, `BlocDemarrage`,
`BlocAvance`, `terminalBridge`, `crawlBridge`, `installPostMerge`,
`integrationsPath` sont exportés mais n'ont d'appelant que dans leur propre
fichier. Aucune ligne à gagner, mais chacun annonce une surface publique qui
n'existe pas, et rien ne préviendra le jour où l'usage interne disparaîtra.

## Critères d'acceptation

- [ ] `injectToClaude` est supprimé, commentaires qui le citent mis à jour.
- [ ] Les symboles à usage strictement interne perdent leur mot-clé `export`,
      sauf ceux qu'un fichier de test importe.
- [ ] `pnpm typecheck`, `pnpm lint` et `pnpm test` passent.
