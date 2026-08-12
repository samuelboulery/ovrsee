---
{
  "id": "T-0080",
  "titre": "Icônes Phosphor sur les boutons du panneau Commandes (terminal)",
  "colonne": "pret",
  "priorite": "moyenne",
  "tags": [
    "ui"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-integration-structurelle-de-la-maquette-chassis-apercu-chant.md",
  "charge": "xs"
}
---

## Contexte

Étape 4 du chantier 3. Les boutons du panneau "Commandes" (`Terminal.tsx:350-372`) sont en
texte brut. La maquette a une icône Phosphor par commande : "Crawler le projet"→`Compass`,
"Graphe complet"→`GitFork`, "Graphe → Obsidian"→`NotePencil`, "Clore le plan"→`Checks`
(`#7d76f0`, 14px). `buildActions()` (`data.ts:1395-1412`) ne porte pas de champ icône —
mapper par le label côté `Terminal.tsx`, sans toucher au type `Action` partagé ailleurs.

## Critères d'acceptation

- [ ] Chaque bouton du panneau Commandes affiche l'icône Phosphor correspondante à son
      libellé, couleur `#7d76f0`, 14px.
- [ ] `buildActions()`/type `Action` non modifiés.
- [ ] `pnpm typecheck` et `pnpm test` passent.
