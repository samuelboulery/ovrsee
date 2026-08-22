---
{
  "id": "T-0209",
  "titre": "/api/graph : root absent et liste blanche non testée",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["api", "test"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-suites-de-la-revue-de-la-pr-61.md"
}
---

## Contexte

Deux trous laissés par T-0134.

Côté interface, `Donnees.tsx` fait `if (!root) return` dans son effet : ni
`payload` ni `graphErreur` ne sont posés, et `chargement` reste vrai
indéfiniment. `root` est une prop optionnelle ; `App` la passe toujours
aujourd'hui, mais le piège est armé pour le prochain appelant.

Côté serveur, la route `/api/graph` porte la garde du registre — `asked()` rend
404 sur un projet non enregistré — et rien ne l'exerce. C'est la branche de
sécurité de la route.

## Critères d'acceptation

- [ ] Un montage sans `root` ne laisse pas « Lecture du graphe… » à l'écran.
- [ ] `server/api.test.js` vérifie que `/api/graph` sur un projet enregistré
      rend `graph` et `graphSource`.
- [ ] `server/api.test.js` vérifie qu'un chemin hors registre rend 404.
