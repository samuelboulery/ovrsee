---
{
  "id": "T-0153",
  "titre": "Projeter les réponses du serveur MCP",
  "epic": "T-0148",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "perf",
    "mcp"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-audit-de-consommation-de-tokens-constats-et-correctifs.md"
}
---

## Contexte

Trois outils du serveur MCP renvoient leur donnée entière. Aucun ne se déclenche
seul, mais un seul appel suffit à ruiner une session — ce sont des amorces, pas
une consommation de fond.

| Outil | Ce qu'il renvoie | ~tokens | Emplacement |
|---|---|---:|---|
| `getGraph` | `graphify-out/graph.json` entier (708 Ko) | 177 000 | `mcp/dispatch.js:151-155` |
| `getPlans` | 10 plans avec leur corps complet | 20 000 | `mcp/dispatch.js:139-143` |
| `listTickets` | 20 tickets avec leur corps | 5 000 | `mcp/dispatch.js:132-136` |

La cause est commune et en amont : `hooks/brief.js:73` construit le snapshot
avec `plans: plans.map(p => ({ file: p.file, ...p.meta, body: p.body }))`. Le
corps entier est embarqué dans chaque instantané, et `derniers()`
(`mcp/dispatch.js:87`) ne fait que trancher la liste — jamais les champs.

La description de `getGraph` avertit déjà du volume (« volumineux : plusieurs
centaines de ko »). L'avertissement ne suffit visiblement pas : 177 000 tokens,
c'est 18 % d'un contexte d'un million rempli par un seul appel.

**Approche.** `getPlans` et `listTickets` projettent par défaut sur les
métadonnées et n'incluent `body` que sur `{ full: true }` explicite. Le résumé
d'un plan est déjà calculé par `intention()` (`hooks/brief.js:102-104`) : le
réutiliser plutôt que d'écrire une nouvelle troncature. `getGraph` renvoie par
défaut un résumé — compte de nœuds, compte d'arêtes, liste des communautés — et
exige `{ full: true }` pour le blob.

**L'invariant tient.** Ces changements ne touchent qu'à ce que le MCP *renvoie*.
Rien n'est écrit ailleurs que dans `ovrsee/tickets/` et `ovrsee/board.json`, et
aucun code du projet observé n'est exécuté.

**Rappel du CLAUDE.md** : tester `dispatch()` ne teste pas le fil. Les tests
doivent passer par le transport, comme le reste de `mcp/mcp.test.js`, depuis
qu'un protocole non conforme est passé sous une suite verte.

## Critères d'acceptation

- [ ] `getPlans` sans argument ne renvoie aucun corps de plan ; avec
      `{ full: true }`, il les renvoie.
- [ ] `listTickets` sans argument ne renvoie aucun corps de ticket ; avec
      `{ full: true }`, il les renvoie.
- [ ] `getGraph` sans argument renvoie un résumé de moins de 1 000 tokens ; avec
      `{ full: true }`, il renvoie `graph.json`.
- [ ] Les descriptions des trois outils dans `mcp/server.js` annoncent la
      projection et le drapeau `full`.
- [ ] `mcp/mcp.test.js` couvre les trois cas, **via le transport** et pas
      seulement par appel direct à `dispatch()`.
- [ ] `pnpm test` passe.
