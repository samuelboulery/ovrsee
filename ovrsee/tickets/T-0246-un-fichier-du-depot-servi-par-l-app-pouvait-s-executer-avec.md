---
{
  "id": "T-0246",
  "titre": "Un fichier du dépôt servi par l'app pouvait s'exécuter avec elle",
  "colonne": "revue",
  "priorite": "haute",
  "tags": [
    "securite"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

`/api/media` sert les `.svg` du dépôt observé en `image/svg+xml`, sans en-tête
qui les neutralise. Un SVG est un document : il porte des scripts. Servi sous
`ovrsee://app` et promu page par une navigation de premier plan, il s'exécutait
dans l'origine de l'interface — donc avec `window.ovrsee`, donc avec le
terminal. La CSP d'`electron/main.js` ne couvre que l'interface, jamais
`/api/*`, et `will-navigate` laissait passer toute URL de l'origine.

## Critères d'acceptation

- [x] Les réponses qui servent un fichier portent `Content-Security-Policy: sandbox`.
- [x] La fenêtre principale ne navigue plus, l'interface changeant d'onglet par `pushState`.
- [x] Un test vérifie les en-têtes **aux deux hôtes** : une route vérifiée dans le navigateur n'est pas une route vérifiée dans Electron.
