---
{
  "id": "T-0236",
  "titre": "Un seul POST dans app/src/api.ts",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "dette",
    "audit",
    "ui"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": null,
  "epic": "T-0232",
  "charge": "s"
}
---

## Contexte

`app/src/api.ts` porte huit blocs `fetch` en POST identiques ligne pour ligne :
`method`, `Content-Type`, l'en-tête `X-Ovrsee`, `await response.json()`, puis
`if (!response.ok) throw new Error(result?.error ?? …)`. Lignes 30, 55, 78, 100,
132, 168, 191, 250.

Le fichier a déjà son helper pour l'autre moitié — `json<T>()`, en tête, pour
les GET. Il manque son pendant en écriture.

Ce qui est en jeu tient dans l'en-tête `X-Ovrsee` : ce n'est pas du confort,
c'est la parade CORS qui empêche une page quelconque de poster vers le dev
server local. Huit copies, c'est huit endroits où l'oublier en ajoutant une
neuvième route — et l'oubli ne se verrait pas en développement, où l'origine
est la bonne.

Les corps rendus diffèrent (`Tableau`, `Project[]`, un chemin, `SettingsType`) :
le helper est générique sur le retour, pas une signature unique imposée aux huit
appelants.

## Critères d'acceptation

- [ ] Une seule construction de requête POST dans `api.ts`, générique sur le type rendu.
- [ ] Les huit fonctions publiques gardent leur signature et leur type de retour actuels.
- [ ] `X-Ovrsee` est posé au seul endroit où la requête se construit.
- [ ] `pnpm typecheck` et `pnpm test` verts.
