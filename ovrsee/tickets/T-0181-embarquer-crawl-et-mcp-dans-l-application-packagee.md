---
{
  "id": "T-0181",
  "titre": "Embarquer crawl/ et mcp/ dans l'application packagée",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": ["packaging", "electron"],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-rendre-l-ovrsee-utilisable-sans-cloner-le-depot.md",
  "epic": "T-0180"
}
---

## Contexte

`electron-builder.yml` liste `electron/`, `server/`, `hooks/`, `skills/` et
`app/dist/`, mais ni `crawl/` ni `mcp/`. L'application livrée est donc une
visionneuse : elle ne sait ni photographier une application, ni servir le MCP.

`playwright-core` pèse 13 Mo et n'a aucune dépendance transitive, et
`chromium.launch({ channel: 'chrome' })` pilote le Chrome déjà installé — il n'y
a pas de navigateur à télécharger. `mcp/` n'importe que du Node natif,
`server/api.js` et `hooks/brief.js`, déjà embarqués tous les deux.

Le programme lancé n'est pas `node` mais le binaire Ovrsee en mode node, qui
sait lire `app.asar` : `asarUnpack` ne devrait pas être nécessaire. C'est à
constater sur le DMG, pas à supposer.

## Critères d'acceptation

- [ ] `pnpm package:mac` produit un DMG qui contient `crawl/`, `mcp/` et
      `playwright-core`.
- [ ] Depuis l'application installée, un crawl aboutit et écrit `pages.json`.
- [ ] Le serveur MCP lancé depuis le paquet répond à `tools/list`.
