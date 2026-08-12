---
{
  "id": "T-0078",
  "titre": "Bloc utilisateur (bas de sidebar) + endpoint nom d'utilisateur système",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "backend"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-integration-structurelle-de-la-maquette-chassis-apercu-chant.md",
  "charge": "s"
}
---

## Contexte

Étape 2 du chantier 3. La maquette montre un bloc avatar+nom avant le bouton Préférences,
absent du code. Décision actée : le nom vient du système (`os.userInfo().username`, lecture
seule), pas de git config. Nécessite une route dans `server/api.js` (`resolve()`, partagée
par les 3 hôtes — dev server, `ovrsee://`, MCP) ; ce n'est pas un secret, `/api/*` convient.

## Critères d'acceptation

- [ ] Route `resolve()` qui retourne le nom d'utilisateur système, suivant le pattern des
      routes existantes de `server/api.js`.
- [ ] Bloc avatar (initiale) + nom ajouté avant le bouton Préférences, avec `border-top`
      séparateur comme la maquette.
- [ ] Fonctionne dans le dev server ET dans Electron (`pnpm electron`) — pas seulement
      testé au navigateur.
- [ ] `pnpm typecheck` et `pnpm test` passent.
