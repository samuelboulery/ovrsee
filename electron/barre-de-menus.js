/**
 * Le cycle de vie façon CleanMyMac (T-0305) : un seul processus, deux états.
 *
 * | État                 | Fenêtre  | Dock           | Tray | Terminaux de l'app |
 * |----------------------|----------|----------------|------|--------------------|
 * | App ouverte          | oui      | icône + badge  | oui  | vivants            |
 * | Barre de menus seule | détruite | caché          | oui  | fermés             |
 *
 * ⌘Q et la fermeture de la dernière fenêtre passent en barre de menus seule
 * (réglage `notifications.barreDeMenus`) ; « Quitter Ovrsee » du popover, le
 * menu Quitter du Dock et la fermeture de session quittent vraiment. ⌘Q est
 * donc un item de menu à nous, pas un `before-quit` intercepté : bloquer
 * `before-quit` bloquerait aussi la déconnexion de la session macOS.
 *
 * Rouvrir — Dock, Launchpad, Finder, popover — recrée la fenêtre et réaffiche
 * le Dock : macOS ne lance pas un second processus pour le même bundle, il
 * envoie `activate` à celui qui tourne.
 *
 * Lancement à l'ouverture de session : une LaunchAgent qu'on écrit nous-mêmes,
 * parce que `setLoginItemSettings({ args })` est réservé à Windows (doc
 * Electron 43) et que l'agent doit démarrer en `--barre-de-menus`, sans
 * fenêtre. Écrite ou retirée au démarrage et à chaque enregistrement des
 * préférences — elle ne sert qu'au prochain login, `launchctl` n'est pas
 * appelé.
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { emplacementEphemere } from '../hooks/install.js'
import { readSettings } from '../hooks/settings.js'
import { arreterNotifications, demarrerNotifications, depuisRendu, marquerVues, suivreSessions } from './notifications.js'
import { closeAll } from './pty.js'
import { activer, arreterSessionsExternes, demarrerSessionsExternes } from './sessions-externes.js'
import { answer, cacherPopover, createTray, currentState, reveal, setState } from './tray.js'

/** L'argument que pose la LaunchAgent : démarrer sans fenêtre. */
export const SANS_FENETRE = '--barre-de-menus'

const mac = process.platform === 'darwin'
const barrePermanente = () => mac && readSettings().notifications.barreDeMenus

/**
 * ⌘Q de la fenêtre. Fermer les fenêtres suffit : `window-all-closed` ferme
 * les ptys et cache le Dock, comme pour une fermeture à la souris.
 */
export function quitter() {
  if (!barrePermanente()) return app.quit()
  for (const fenetre of BrowserWindow.getAllWindows()) fenetre.close()
}

const LAUNCH_AGENT = () => join(homedir(), 'Library', 'LaunchAgents', 'com.ovrsee.menubar.plist')

const xml = texte => texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Écrit ou retire la LaunchAgent selon les réglages.
 *
 * Jamais en développement — l'agent lancerait le binaire Electron nu, sans
 * l'app —, ni depuis un DMG ou une copie Gatekeeper : le chemin y meurt au
 * démontage (même garde que les hooks, T-0275).
 */
export function synchroniserLancement() {
  if (!mac || !app.isPackaged) return
  const { lancerAuDemarrage, barreDeMenus } = readSettings().notifications
  const chemin = LAUNCH_AGENT()
  try {
    if (!(lancerAuDemarrage && barreDeMenus) || emplacementEphemere(process.execPath)) {
      if (existsSync(chemin)) unlinkSync(chemin)
      return
    }
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ovrsee.menubar</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(process.execPath)}</string>
    <string>${SANS_FENETRE}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
</dict>
</plist>
`
    if (existsSync(chemin) && readFileSync(chemin, 'utf8') === plist) return
    mkdirSync(dirname(chemin), { recursive: true })
    writeFileSync(chemin, plist)
  } catch (err) {
    process.stderr.write(`[ovrsee] LaunchAgent non synchronisée : ${err?.message ?? err}\n`)
  }
}

/**
 * Branche la barre de menus, les notifications et le cycle de vie.
 *
 * @param {{
 *   origin: string,
 *   preload: string,
 *   getPrincipale: () => Electron.BrowserWindow|null,
 *   nouvelleFenetre: () => Electron.BrowserWindow,
 * }} options
 */
export function demarrerBarreDeMenus({ origin, preload, getPrincipale, nouvelleFenetre }) {
  const estPrincipale = event => event.sender === getPrincipale()?.webContents

  /** Ramène la fenêtre, la recrée si l'app était en barre de menus seule. */
  const ouvrir = () => {
    void app.dock?.show()
    const fenetre = getPrincipale() ?? nouvelleFenetre()
    if (fenetre.isMinimized()) fenetre.restore()
    fenetre.show()
    fenetre.focus()
  }

  // Surface de la barre de menu. Le principal ne calcule rien : il retient
  // l'état que le rendu principal publie et le republie au popover — voir
  // l'en-tête de `tray.js` pour pourquoi le calcul n'est pas ici.
  //
  // `report` et `notif:show` ne sont acceptés que de la fenêtre principale. Le
  // popover est un rendu de la même origine : sans cette garde, il pourrait se
  // réécrire son propre état, donc se fabriquer une session et un identifiant
  // de pty.
  ipcMain.handle('menubar:report', (event, etat) => {
    if (!estPrincipale(event)) return
    setState(etat)
    suivreSessions(etat?.sessions)
  })
  ipcMain.handle('menubar:pull', () => currentState())
  ipcMain.handle('menubar:answer', (_event, ptyId, decision) => answer(ptyId, decision))
  ipcMain.handle('menubar:reveal', (_event, sessionKey) => {
    if (typeof sessionKey === 'string') reveal(sessionKey)
  })
  // Une session hors de l'app (T-0309) : le rendu ne nomme que la session, le
  // bundle à activer est retrouvé et vérifié dans `sessions-externes.js`.
  ipcMain.handle('menubar:activate', (_event, session) => {
    const fait = activer(session)
    if (fait) cacherPopover()
    return fait
  })
  ipcMain.handle('menubar:open', () => ouvrir())
  ipcMain.handle('menubar:quit', () => app.quit())
  ipcMain.handle('notif:show', (event, n) => {
    if (estPrincipale(event)) depuisRendu(n)
  })

  createTray({ origin, preload, getMainWindow: getPrincipale, onOpen: marquerVues })
  demarrerNotifications()
  demarrerSessionsExternes()
  synchroniserLancement()

  app.on('browser-window-focus', (_event, fenetre) => {
    if (fenetre === getPrincipale()) marquerVues()
  })
  app.on('activate', () => {
    if (!getPrincipale()) ouvrir()
  })
  // La LaunchAgent relancée alors que l'app tourne déjà ne doit pas rouvrir la fenêtre.
  app.on('second-instance', (_event, argv) => {
    if (!argv.includes(SANS_FENETRE)) ouvrir()
  })

  // Dernière fenêtre fermée : les sessions Claude de l'app partent avec elle,
  // comme avant. Sous macOS l'app reste — dans le Dock si la barre de menus
  // n'est pas permanente, dans la barre de menus seule sinon.
  app.on('window-all-closed', () => {
    closeAll()
    // Les ptys partent sans que le rendu le rapporte : le badge repart de zéro.
    suivreSessions([])
    marquerVues()
    if (!mac) app.quit()
    else if (barrePermanente()) app.dock?.hide()
  })
  app.on('will-quit', () => {
    arreterNotifications()
    arreterSessionsExternes()
  })
}
