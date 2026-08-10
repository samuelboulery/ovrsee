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
 * Le menu se construit une fois, au démarrage, dans la langue lue des
 * préférences. Il ne suit pas un changement de langue à chaud : reconstruire
 * un menu natif en cours de route coûte plus que ça ne rapporte, et l'écran
 * des préférences le dit à l'utilisateur. Au prochain lancement, il suit.
 *
 * Le menu Édition n'est pas décoratif : c'est lui qui donne ⌘C et ⌘V dans le
 * terminal xterm et dans les champs de tickets. Un menu personnalisé remplace le
 * menu par défaut ; en oublier les rôles, c'est retirer le copier-coller.
 */

import { app, BrowserWindow, Menu } from 'electron'

import { t } from '../hooks/i18n.js'

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
const TAB_IDS = ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack']

/**
 * @param {'fr' | 'en'} [lang] langue lue des préférences par le processus
 *   principal. Le défaut français garde le comportement d'avant l'i18n pour
 *   tout appelant qui l'ignorerait.
 * @returns {Electron.Menu}
 */
export function buildMenu(lang = 'fr') {
  const m = (key, params) => t(key, lang, params)
  const mac = process.platform === 'darwin'

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(mac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: m('menu.about') },
              { type: 'separator' },
              // La place que macOS lui donne depuis toujours, avec ⌘, — un
              // utilisateur l'y cherche avant de chercher un bouton.
              {
                label: m('menu.preferences'),
                accelerator: 'CmdOrCtrl+,',
                click: send('preferences:open'),
              },
              { type: 'separator' },
              { role: 'services', label: m('menu.services') },
              { type: 'separator' },
              { role: 'hide', label: m('menu.hide') },
              { role: 'hideOthers', label: m('menu.hide_others') },
              { role: 'unhide', label: m('menu.unhide') },
              { type: 'separator' },
              { role: 'quit', label: m('menu.quit') },
            ],
          },
        ]
      : []),

    {
      label: m('menu.file'),
      submenu: [
        { label: m('menu.open_project'), accelerator: 'CmdOrCtrl+O', click: send('project:open') },
        // ⌘R relit `cockpit/` ; recharger la *page* est en ⇧⌘R, sous Affichage.
        // Un rechargement de page perdrait l'onglet Navigateur et la session du
        // terminal — ce n'est pas ce qu'on veut du raccourci le plus proche.
        {
          label: m('menu.reload_project'),
          accelerator: 'CmdOrCtrl+R',
          click: send('project:reload'),
        },
        {
          label: m('menu.reveal'),
          accelerator: 'CmdOrCtrl+Shift+O',
          click: send('project:reveal'),
        },
        { type: 'separator' },
        // Hors macOS, il n'y a pas de menu applicatif : les préférences se
        // rangent sous Fichier, comme le veut l'usage Windows et Linux.
        ...(mac
          ? []
          : [
              {
                label: m('menu.preferences'),
                accelerator: 'CmdOrCtrl+,',
                click: send('preferences:open'),
              },
              { type: 'separator' },
            ]),
        { role: 'close', label: m('menu.close_window') },
      ],
    },

    {
      label: m('menu.edit'),
      submenu: [
        { role: 'undo', label: m('menu.undo') },
        { role: 'redo', label: m('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: m('menu.cut') },
        { role: 'copy', label: m('menu.copy') },
        { role: 'paste', label: m('menu.paste') },
        { role: 'selectAll', label: m('menu.select_all') },
      ],
    },

    {
      label: m('menu.view'),
      submenu: [
        ...TAB_IDS.map((id, index) => ({
          label: m(`tabs.${id}`),
          accelerator: `CmdOrCtrl+${index + 1}`,
          click: send(`tab:${id}`),
        })),
        { type: 'separator' },
        {
          label: m('menu.toggle_terminal'),
          accelerator: 'CmdOrCtrl+T',
          click: send('terminal:toggle'),
        },
        {
          label: m('menu.terminal_bottom'),
          accelerator: 'Alt+CmdOrCtrl+1',
          click: send('terminal:layout:bottom'),
        },
        {
          label: m('menu.terminal_side'),
          accelerator: 'Alt+CmdOrCtrl+2',
          click: send('terminal:layout:side'),
        },
        {
          label: m('menu.terminal_full'),
          accelerator: 'Alt+CmdOrCtrl+3',
          click: send('terminal:layout:full'),
        },
        { type: 'separator' },
        { role: 'resetZoom', label: m('menu.actual_size') },
        { role: 'zoomIn', label: m('menu.zoom_in') },
        { role: 'zoomOut', label: m('menu.zoom_out') },
        { role: 'togglefullscreen', label: m('menu.fullscreen') },
        { type: 'separator' },
        { role: 'forceReload', label: m('menu.force_reload'), accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', label: m('menu.devtools') },
      ],
    },

    {
      label: m('menu.window'),
      role: 'windowMenu',
      submenu: [
        { role: 'minimize', label: m('menu.minimize') },
        { role: 'zoom', label: m('menu.zoom') },
        ...(mac ? [{ type: 'separator' }, { role: 'front', label: m('menu.bring_all_front') }] : []),
      ],
    },
  ]

  return Menu.buildFromTemplate(/** @type {Electron.MenuItemConstructorOptions[]} */ (template))
}
