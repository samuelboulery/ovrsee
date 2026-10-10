---
{
  "id": "T-0289",
  "titre": "Brancher le MCP depuis l'application",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "mcp",
    "installation"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-audit-produit-et-ux-d-ovrsee-10-oct-2026.md",
  "epic": "E-0285",
  "charge": "s"
}
---

## Contexte

L'enregistrement du serveur MCP est manuel et dépend du chemin du bundle (`env ELECTRON_RUN_AS_NODE=1 …/app.asar/mcp/server.js`, README). `app/src` ne mentionne jamais le MCP.

## Critères d'acceptation

- [ ] Les préférences montrent la commande `claude mcp add` exacte pour cette installation, avec un bouton Copier et un bouton « Lancer dans le terminal ».
- [ ] L'état « branché / non branché » apparaît dans le panneau Câblage.
