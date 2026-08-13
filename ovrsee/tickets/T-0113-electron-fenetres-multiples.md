---
{
  "id": "T-0113",
  "titre": "Electron — fenêtres multiples",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "electron",
    "terminal"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-fenetres-multiples-terminaux-persistants.md"
}
---

## Contexte

Une seule fenêtre Electron peut exister aujourd'hui — `createWindow()` n'est
appelé qu'une fois au démarrage (`electron/main.js:509`), sans menu ni
raccourci pour en ouvrir une deuxième. L'utilisateur veut pouvoir travailler
sur plusieurs projets en parallèle, chacun dans sa propre fenêtre.

Chaque fenêtre est déjà un processus de rendu séparé — l'état React (`current`,
`tab`, sessions terminal) y est indépendant sans rien à faire de plus. Il
manque juste le déclencheur.

## Critères d'acceptation

- [ ] Menu Fichier → « Nouvelle fenêtre » (raccourci `CmdOrCtrl+N`) ouvre une
      deuxième fenêtre Electron pleinement fonctionnelle.
- [ ] Deux fenêtres peuvent afficher deux projets différents simultanément,
      chacune avec ses propres onglets et son propre panneau terminal.
- [ ] Fermer une fenêtre parmi plusieurs laisse l'autre intacte (pas de
      régression sur `window-all-closed`/`before-quit`).
- [ ] Libellé traduit en FR (« Nouvelle fenêtre ») et EN (« New Window »).
