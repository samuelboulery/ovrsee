---
{
  "id": "T-0077",
  "titre": "Sélecteur de projet en menu déroulant + suppression PROJETS sidebar",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-integration-structurelle-de-la-maquette-chassis-apercu-chant.md",
  "charge": "m"
}
---

## Contexte

Étape 1 du chantier 3 (intégration structurelle de la maquette). Le `<h1>` texte brut de
la barre de titre (`App.tsx:491-497`) devient un badge interactif (pastille + nom + caret)
qui ouvre un menu déroulant listant les projets — réutilise `onPick(path)` (`App.tsx:519-522`)
et `projects` (déjà chargé via `fetchProjects()`, `data.ts:588`). Décision actée : la
bascule de projet ne vivant plus que dans ce menu, la section "PROJETS" de la sidebar
(`App.tsx:991-1026`) est supprimée — "VUES" (1028-1040) n'est pas touchée.

Ajouter aussi l'icône `TerminalWindow` (Phosphor, 14px, `#b6bac1`) manquante à droite du
badge de scan.

## Critères d'acceptation

- [ ] Le badge de projet dans la barre de titre ouvre un menu déroulant listant tous les
      projets du registre ; cliquer un projet appelle `onPick(path)` et ferme le menu.
- [ ] Section "PROJETS" retirée de la sidebar ; "VUES" inchangée.
- [ ] Icône `TerminalWindow` ajoutée à droite du badge de scan.
- [ ] `CommandPalette.tsx` (bascule de projet indépendante) fonctionne toujours.
- [ ] `pnpm typecheck` et `pnpm test` passent.
