---
{
  "id": "T-0185",
  "titre": "Mettre CLAUDE.md à jour du crawl par IPC",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "xs",
  "tags": ["docs"],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-rendre-l-ovrsee-utilisable-sans-cloner-le-depot.md",
  "epic": "T-0180"
}
---

## Contexte

`CLAUDE.md` dit que le terminal est la seule chose qui passe par IPC Electron,
et son tableau des couches décrit `crawl/` et `mcp/` comme extérieurs au paquet.
Les deux deviennent faux. Laissés tels quels, ils enverront la prochaine session
reconstruire ce qui existe déjà, ou proposer une route `/api/*` pour le crawl.

## Critères d'acceptation

- [ ] Le corollaire de l'invariant nomme le crawl à côté du terminal, avec la
      même raison de ne pas passer par `/api/*`.
- [ ] Le tableau des couches dit que `crawl/` et `mcp/` sont embarqués.
- [ ] Un piège dit qu'annuler un crawl tue le groupe de processus, et pourquoi.
