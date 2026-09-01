---
{
  "id": "T-0242",
  "titre": "Le réglage « système » du thème se fige dans Electron",
  "colonne": "revue",
  "priorite": "haute",
  "tags": ["theme", "electron"],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": "2026-09-01-reparer-le-reglage-systeme-du-theme-dans-electron.md"
}
---

## Contexte

Sous le réglage par défaut (`system`), l'application ne suit le poste qu'au
démarrage : basculer macOS clair↔sombre pendant qu'elle tourne ne fait rien.

La chaîne se mord la queue. `applyTheme` (`app/src/theme.ts`) envoie le thème
**résolu** à `app:theme`, qui pose `nativeTheme.themeSource = 'light'|'dark'` —
jamais `'system'`. Or un `themeSource` forcé surcharge `prefers-color-scheme`
dans tous les rendus : la requête média que `watchSystemTheme` écoute ne reflète
plus le poste mais ce que le rendu vient d'y écrire, et l'événement `change`
n'arrive jamais.

Deuxième point de figement, même effet : `preview:devtools`
(`electron/main.js`) force lui aussi `themeSource`, alors qu'il est déjà
redondant avec `app:theme`.

Le navigateur (`pnpm dev`) n'est pas touché : `window.ovrsee` n'y existe pas.

## Critères d'acceptation

- [ ] Réglage « Système », app Electron ouverte : basculer l'apparence macOS
      change l'interface, le canvas xterm et la chrome native, sans redémarrage.
- [ ] Le suivi tient aussi après avoir ouvert les DevTools de l'onglet
      Navigateur.
- [ ] Un choix explicite « Clair » / « Sombre » ignore toujours le poste, chrome
      native et fond de fenêtre compris.
- [ ] Le popover de la barre de menu suit la même bascule.
- [ ] Un test de `app/src/theme.test.ts` couvre ce qui part à Electron
      (le réglage, pas le thème résolu).
