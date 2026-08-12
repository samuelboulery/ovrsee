---
{
  "id": "T-0079",
  "titre": "Densité d'activité : segmentation par type, toggles, filtre, plans rejetés",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-integration-structurelle-de-la-maquette-chassis-apercu-chant.md",
  "charge": "l"
}
---

## Contexte

Étape 3 du chantier 3 — le plus gros morceau. `DensityHistogram`/`DensityHeatmap`
(`App.tsx:777-885`) affichent un agrégat `number[]` tous types confondus
(`hooks/density.js`). La maquette segmente chaque barre en 3 couleurs (plans/tickets/
commits), avec toggles de plage (14 j/12 s/type), légende, une section "Filtrer" (visibilité
par type), une section "Plans rejetés · N".

`Historique.tsx` a déjà un composant `ActivityPanel` (~lignes 144-238) qui calcule des
comptes journaliers par type — **lire précisément avant d'écrire du code** pour juger s'il
s'extrait proprement vers un module partagé plutôt que d'être dupliqué. "Plans rejetés" se
calcule avec `planRejected(plan)` (`data.ts:98-102`), déjà écrite.

## Critères d'acceptation

- [ ] Barres segmentées en 3 couleurs (plans `#7d76f0` / tickets `#4b46a3` / commits
      `#2a2b33`), toggles de plage, légende (3 carrés + labels).
- [ ] Section "Filtrer" (toggle de visibilité par type) et section "Plans rejetés · N".
- [ ] La logique de ventilation par type n'est pas dupliquée entre la sidebar et
      `Historique.tsx` — factorisée dans un module partagé si `ActivityPanel` s'y prête.
- [ ] `pnpm typecheck` et `pnpm test` passent (vérifier que les tests existants sur
      `App.tsx`/`Historique.tsx` ne cassent pas).
