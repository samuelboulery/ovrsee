---
{
  "id": "T-0039",
  "titre": "Thème clair illisible : sidebar, timeline, terminal figé sur le sombre",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "theme"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-corriger-le-theme-clair-liste-projets-timeline-plan-terminal.md"
}
---

## Contexte

En thème clair, trois zones restent illisibles ou incohérentes avec la palette Nocturne claire :

- la ligne du projet sélectionné dans la sidebar (`App.tsx`) et l'onglet de session terminal actif (`Terminal.tsx`) gardent un fond `--color-accent-900` (violet foncé) pensé pour le sombre ;
- les cartes `PLAN` de la frise historique (`Historique.tsx`) utilisent le même token dans leur dégradé de fond ;
- le terminal reste noir même en thème clair — bug distinct des tokens de couleur : `getTerminalTheme()` (theme.ts) n'est appliqué qu'à la création du xterm (`useTerminal.ts`), jamais réappliqué quand le thème change après coup. Un terminal déjà ouvert reste figé sur la palette de son instant de création.

## Critères d'acceptation

- [ ] Ligne de projet sélectionné lisible en thème clair (fond clair, plus de violet foncé résiduel).
- [ ] Onglet de session terminal actif lisible en thème clair (même correctif que la sidebar).
- [ ] Cartes `PLAN` de la frise historique lisibles en thème clair.
- [ ] Un terminal déjà ouvert change de palette en direct quand on bascule clair ↔ sombre ↔ clair (pas seulement à la prochaine ouverture d'onglet). Le terminal peut garder une teinte différente du reste de l'UI, mais reste clair en thème clair.
- [ ] `pnpm --filter app test` passe sans régression (`theme.test.ts`, `render.test.tsx`, `prefs.test.tsx`).
