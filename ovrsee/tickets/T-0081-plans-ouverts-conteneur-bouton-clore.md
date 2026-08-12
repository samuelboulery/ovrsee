---
{
  "id": "T-0081",
  "titre": "Plans ouverts : conteneur, pastilles, badge actif, bouton Clore le plan actif",
  "colonne": "pret",
  "priorite": "haute",
  "tags": [
    "ui",
    "backend"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-integration-structurelle-de-la-maquette-chassis-apercu-chant.md",
  "charge": "m"
}
---

## Contexte

Étape 5 du chantier 3. La liste des plans ouverts (`Sante.tsx`, ~lignes 54-75 — confirmer
l'emplacement exact) est du texte brut sans conteneur. Maquette : conteneur bordure+fond,
en-tête "Plans ouverts · N" + boutons "Clore le plan actif"/"Tout voir", pastille par
ligne, badge "actif" sur le plan actif, séparateurs entre lignes.

"Clore le plan actif" nécessite une nouvelle route dans `server/api.js` (`resolve()`) qui
appelle `closeOpenPlans()` (déjà écrite dans `hooks/plans.js`, jusqu'ici seulement exposée
via `pnpm ovrsee:close` en CLI). "Tout voir" : pas de destination précisée par
l'utilisateur — pointer vers l'onglet Historique par défaut.

## Critères d'acceptation

- [ ] Conteneur, pastilles, badge "actif", séparateurs conformes à la maquette.
- [ ] Bouton "Clore le plan actif" fonctionnel via une route `resolve()` dédiée, testée
      dans le dev server ET dans Electron.
- [ ] Bouton "Tout voir" navigue vers l'onglet Historique.
- [ ] `pnpm typecheck` et `pnpm test` passent.
