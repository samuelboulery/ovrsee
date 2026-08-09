/**
 * Le menu natif.
 *
 * Sans lui, macOS affiche le menu par défaut d'Electron : en anglais, et qui ne
 * connaît ni les onglets, ni le terminal, ni les projets.
 *
 * Le menu **ne fait rien lui-même**. Chaque item propre à Cockpit envoie un mot
 * au rendu, qui exécute le code qu'il exécute déjà au clic. Dupliquer ici le
 * moindre bout de logique métier créerait un second chemin qui divergerait — la
 * même faute que dédoubler `resolve()` de `server/api.js`.
 *
 * Le menu Édition n'est pas décoratif : c'est lui qui donne ⌘C et ⌘V dans le
 * terminal xterm et dans les champs de tickets. Un menu personnalisé remplace le
 * menu par défaut ; en oublier les rôles, c'est retirer le copier-coller.
 */

import { app, BrowserWindow, Menu } from 'electron'

/**
 * Envoie une commande au rendu de la fenêtre au premier plan.
 *
 * Repli sur la première fenêtre : sous macOS, un menu reste cliquable quand
 * aucune fenêtre n'a le focus.
 *
 * @param {string} command
 * @returns {() => void}
 */
const send = command => () => {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  window?.webContents.send('menu:command', command)
}

/**
 * Les mêmes sept onglets que `TABS` dans `app/src/App.tsx`, dans le même ordre.
 * Le rendu traduit l'identifiant en route : c'est lui qui tient la table.
 */
const TABS = [
  ['apercu', 'Aperçu'],
  ['navigateur', 'Navigateur'],
  ['produit', 'Produit'],
  ['historique', 'Historique'],
  ['tableau', 'Tableau'],
  ['donnees', 'Données'],
  ['stack', 'Stack'],
]

/** @returns {Electron.Menu} */
export function buildMenu() {
  const mac = process.platform === 'darwin'

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(mac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: 'À propos de Cockpit' },
              { type: 'separator' },
              { role: 'services', label: 'Services' },
              { type: 'separator' },
              { role: 'hide', label: 'Masquer Cockpit' },
              { role: 'hideOthers', label: 'Masquer les autres' },
              { role: 'unhide', label: 'Tout afficher' },
              { type: 'separator' },
              { role: 'quit', label: 'Quitter Cockpit' },
            ],
          },
        ]
      : []),

    {
      label: 'Fichier',
      submenu: [
        { label: 'Ouvrir un projet…', accelerator: 'CmdOrCtrl+O', click: send('project:open') },
        // ⌘R relit `cockpit/` ; recharger la *page* est en ⇧⌘R, sous Affichage.
        // Un rechargement de page perdrait l'onglet Navigateur et la session du
        // terminal — ce n'est pas ce qu'on veut du raccourci le plus proche.
        {
          label: 'Recharger le projet',
          accelerator: 'CmdOrCtrl+R',
          click: send('project:reload'),
        },
        {
          label: 'Révéler cockpit/ dans le Finder',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: send('project:reveal'),
        },
        { type: 'separator' },
        { role: 'close', label: 'Fermer la fenêtre' },
      ],
    },

    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },

    {
      label: 'Affichage',
      submenu: [
        ...TABS.map(([id, label], index) => ({
          label,
          accelerator: `CmdOrCtrl+${index + 1}`,
          click: send(`tab:${id}`),
        })),
        { type: 'separator' },
        {
          label: 'Afficher/masquer le terminal',
          accelerator: 'CmdOrCtrl+T',
          click: send('terminal:toggle'),
        },
        {
          label: 'Terminal en bas',
          accelerator: 'Alt+CmdOrCtrl+1',
          click: send('terminal:layout:bottom'),
        },
        {
          label: 'Terminal à droite',
          accelerator: 'Alt+CmdOrCtrl+2',
          click: send('terminal:layout:side'),
        },
        {
          label: 'Terminal plein écran',
          accelerator: 'Alt+CmdOrCtrl+3',
          click: send('terminal:layout:full'),
        },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Taille réelle' },
        { role: 'zoomIn', label: 'Agrandir' },
        { role: 'zoomOut', label: 'Réduire' },
        { role: 'togglefullscreen', label: 'Plein écran' },
        { type: 'separator' },
        { role: 'forceReload', label: "Recharger l'interface", accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
      ],
    },

    {
      label: 'Fenêtre',
      role: 'windowMenu',
      submenu: [
        { role: 'minimize', label: 'Réduire' },
        { role: 'zoom', label: 'Ajuster' },
        ...(mac ? [{ type: 'separator' }, { role: 'front', label: 'Tout ramener au premier plan' }] : []),
      ],
    },
  ]

  return Menu.buildFromTemplate(/** @type {Electron.MenuItemConstructorOptions[]} */ (template))
}
