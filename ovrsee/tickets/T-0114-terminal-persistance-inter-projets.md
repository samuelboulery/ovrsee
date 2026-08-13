---
{
  "id": "T-0114",
  "titre": "Terminal — persistance des sessions entre projets",
  "colonne": "revue",
  "priorite": "haute",
  "tags": [
    "terminal",
    "ux"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-fenetres-multiples-terminaux-persistants.md"
}
---

## Contexte

Changer de projet via le dropdown écrase l'état des sessions terminal
(`app/src/useTerminal.ts:221-232`) : la session Claude et tous les shells
ouverts du projet quitté sont fermés et disposés, au lieu d'être mis en
pause. Le motif qui garde déjà plusieurs sessions vivantes *dans* un même
projet (piler les panneaux, l'inactif en `opacity: 0` + `inert`, jamais
`display: none` — Terminal.tsx:290-317) doit s'étendre *entre* projets.

Le changement d'onglet (les 7 onglets de l'appli) ne pose déjà aucun problème
— le panneau `<Terminal>` est monté hors des conditionnelles d'onglet.

## Critères d'acceptation

- [ ] Ouvrir le projet A, lancer Claude, ouvrir un shell et y taper une
      commande ; basculer sur le projet B via le dropdown ; revenir sur A —
      la session Claude et le shell ont gardé leur scrollback et restent
      réactifs (pas redémarrés).
- [ ] La barre de pastilles du panneau terminal n'affiche que les sessions du
      projet actuellement affiché (pas de mélange entre projets).
- [ ] Le × sur un onglet shell le ferme toujours pour de bon — il ne
      réapparaît pas après un aller-retour entre projets.
- [ ] Basculer entre les 7 onglets de l'appli ne casse rien côté terminal
      (non-régression).
