---
{
  "status": "open",
  "title": "Suites de la revue de la PR #61",
  "opened": "2026-08-22",
  "closed": null,
  "commits": [
    {
      "sha": "9814f77",
      "date": "2026-08-22",
      "files": []
    }
  ]
}
---

# Suites de la revue de la PR #61

## Contexte

La PR #61 (`perf/tickets-133-134-136`) est saine : le découpage xterm tient
vraiment, `/api/graph` respecte l'implémentation unique de `resolve()`, la
rétention journalière est correcte (fuseaux compris), CI verte sur les trois
jobs. La revue a relevé sept points, dont deux méritent un correctif avant
fusion et cinq sont cosmétiques.

Ce plan ne couvre que ces correctifs. Aucun ne remet en cause l'approche.

## Correctifs à faire

### 1. Cache du graphe entre montages d'onglet — `app/src/tabs/Donnees.tsx`

L'onglet est en rendu conditionnel (`App.tsx:628`) : quitter Données et y
revenir refait un fetch de 687 ko. Ajouter un cache à portée de module,
clé = `root` :

```ts
const cache = new Map<string, GraphPayload>()
```

Servir le cache en état initial de `payload` s'il est chaud, et l'alimenter
dans le `.then()`. Invalider sur `reload` — passer une prop `nonce` depuis
`App` (elle existe déjà pour le rechargement du snapshot) ou vider le cache
dans le même chemin que `reload`.

### 2. ErrorBoundary autour du terminal paresseux — `app/src/App.tsx`

`Suspense fallback={null}` n'attrape pas le rejet de `import('./Terminal')`.
Envelopper le `<Suspense>` d'une petite classe `ErrorBoundary` locale qui rend
un message « terminal indisponible » plutôt que de laisser l'écran blanc.
Pas de composant générique : un seul site d'appel.

### 3. `root` absent ne doit pas rester en chargement — `app/src/tabs/Donnees.tsx:217`

`if (!root) return` laisse `chargement` vrai indéfiniment. Rendre `root`
obligatoire dans les props (`App` le passe toujours) ; sinon poser
`setPayload(null)` et un état « pas de projet » explicite.

### 4. Deux tests de la route — `server/api.test.js`

Dans le style existant (`node:test` / `node:assert`, aucun framework) :
- `/api/graph?path=<projet enregistré>` rend `graphSource` et `graph`
- `/api/graph?path=/chemin/inconnu` rend `status: 404`

La seconde est la vraie : c'est la liste blanche du registre.

### 5. Nettoyages

- `app/src/tabs/Donnees.tsx:224` — utiliser `estAbandon()` (`app/src/api.ts:18`)
  au lieu de `ctrl.signal.aborted`, pour rester sur le motif du dépôt.
- `app/src/tabs/Donnees.tsx:14` et `app/src/PreferencesIntegrations.tsx:22` —
  commentaires qui citent encore `useTerminal.ts` alors que l'import vient de
  `pty.ts`.
- `app/src/pty.ts:141` — double ligne vide.
- `app/src/tabs/Donnees.tsx:6` — `GraphPayload` importé de `../graph` au lieu de
  la façade `../data` comme le reste des types.

## Vérification

- `pnpm lint`, `pnpm typecheck`, `pnpm test` verts
- `pnpm build:ui` : `Terminal-*.js` toujours à part, `index` inchangé (~616 ko)
- `pnpm electron` : ouvrir Données, aller sur un autre onglet, revenir — le
  graphe s'affiche sans second appel réseau (onglet Réseau des devtools)
- Ouvrir puis replier le panneau terminal : pas d'écran blanc, session conservée
