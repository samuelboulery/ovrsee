---
{
  "id": "T-0139",
  "titre": "Item de barre de menu et popover des sessions",
  "colonne": "fait",
  "priorite": "haute",
  "epic": "T-0137",
  "tags": [
    "electron",
    "ui"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-16",
  "plan": "2026-08-14-extension-barre-de-menu-macos-pour-les-sessions-claude-d-ovr.md"
}
---

## Contexte

L'état d'attention est calculé dans le rendu (`Terminal.tsx`, via
`useTerminals`), parce que c'est là qu'arrive le flux pty. Le `Tray`, lui, vit
dans le processus principal. Il faut donc une remontée du rendu vers le
principal — et pas un second calcul dans `electron/`, qui dupliquerait
`attention.ts` dans un dossier non typé et divergerait au premier changement.

Le popover est une seconde `BrowserWindow` sur la même origine `ovrsee://app` :
même build, même design system, aucune chaîne de compilation en plus. C'est un
autre rendu, donc il ne voit pas l'état du premier : le processus principal
sert de plaque tournante et retient le dernier état reçu.

Piège connu : sans le suffixe `Template` sur le nom du fichier d'icône, macOS
ne l'inverse pas et elle devient invisible dans un des deux thèmes.

## Critères d'acceptation

- [ ] `electron/tray.js` crée un `Tray` au démarrage, avec une icône template
      (`…Template.png` et son `@2x`, noir et alpha seuls).
- [ ] Un clic ouvre une `BrowserWindow` sans cadre, non redimensionnable,
      `alwaysOnTop`, `skipTaskbar`, positionnée sous l'icône d'après
      `tray.getBounds()`, et qui se cache au `blur`.
- [ ] Le popover charge la même origine que la fenêtre principale et rend une
      vue dédiée ; `app/src/main.tsx` choisit entre elle et `App` d'après
      l'URL.
- [ ] Le rendu principal pousse son état (`sessionKey`, chemin de projet,
      identifiant de pty, genre d'attente, détail, horodatage) au principal ;
      le principal le retient et le republie au popover à chaque ouverture.
- [ ] Le titre du `Tray` signale qu'au moins une session attend, et redevient
      vide quand aucune n'attend.
- [ ] Le popover liste les sessions Claude de tous les projets ouverts, chacune
      avec son projet, son état et l'âge du signal.
- [ ] Un bouton « ouvrir la session » ramène la fenêtre au premier plan sur le
      bon projet et le bon onglet — même chemin que le clic de notification de
      T-0119.
- [ ] `app.dock.hide()` n'est **pas** appelé : ovrsee reste une application
      normale, l'item de barre de menu s'ajoute à sa fenêtre.
- [ ] L'icône est vérifiée en thème clair et en thème sombre.
- [ ] `pnpm test` et `pnpm typecheck` passent.
