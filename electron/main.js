/**
 * Processus principal.
 *
 * Rien n'écoute sur le réseau. L'interface et les trois routes `/api` sont
 * servies par `protocol.handle` sur un schéma privilégié.
 *
 * Pourquoi pas un serveur HTTP sur 127.0.0.1 : lier une socket à la boucle
 * locale est une isolation *réseau*, pas une isolation de *sécurité*. Sur
 * macOS, tout processus tournant sous le même compte peut s'y connecter — un
 * script d'installation malveillant, par exemple. Un jeton n'y répond pas
 * puisque ce même processus peut charger la page servie et l'y lire.
 */

import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchHandler } from '../server/api.js'
import { openSession, writeTo, resize, closeSession, closeAll } from './pty.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const UI = join(HERE, '..', 'app', 'dist')

const SCHEME = 'cockpit'
const ORIGIN = `${SCHEME}://app`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

// Doit être déclaré avant `app.ready` : `standard` donne au schéma une origine
// véritable, ce qui fait fonctionner les URL relatives et `fetch`.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

/**
 * Sert un fichier de l'interface construite.
 *
 * Repli sur `index.html` pour tout chemin inconnu : les onglets ont de vraies
 * routes (`/historique`, `/backlog`…) et un rechargement doit les retrouver.
 */
async function serveUi(pathname) {
  const wanted = normalize(join(UI, pathname === '/' ? 'index.html' : pathname))

  // Le chemin vient de la barre d'adresse du rendu : il ne doit pas sortir de
  // l'interface construite.
  const inside = wanted.startsWith(UI)
  const target = inside && extname(wanted) ? wanted : join(UI, 'index.html')

  try {
    return new Response(await readFile(target), {
      headers: {
        'Content-Type': MIME[extname(target)] ?? 'application/octet-stream',
        // Le rendu ne charge que ses propres ressources. `unsafe-inline` pour
        // les styles est nécessaire : toute la mise en forme du port est en
        // attributs `style`, copiés de la maquette. Aucune source distante
        // n'est autorisée, et le schéma n'est pas joignable de l'extérieur.
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self'",
          // `unsafe-inline` pour les styles est nécessaire : toute la mise en
          // forme du port est en attributs `style`, copiés de la maquette.
          // Les deux origines Google servent la police Inter, importée par le
          // design system Nocturne. Aucun script distant n'est autorisé.
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          'font-src https://fonts.gstatic.com',
          "img-src 'self' data:",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'none'",
          "frame-ancestors 'none'",
        ].join('; '),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('introuvable', { status: 404 })
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1400,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0e0f18',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      // `.cjs` et non `.js` : le paquet est en ESM, et un preload doit être
      // chargé en CommonJS.
      preload: join(HERE, 'preload.cjs'),
      // Les trois réglages qui empêchent le rendu d'atteindre le système
      // autrement que par la surface exposée dans preload.js.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Les erreurs du rendu remontent sur la sortie du processus principal.
  // Sans cela, une exception dans l'interface ne se manifeste que par une
  // fenêtre vide, sans le moindre indice.
  window.webContents.on('console-message', event => {
    if (event.level === 'error' || event.level === 'warning') {
      process.stderr.write(`[rendu] ${event.message} (${event.sourceId}:${event.lineNumber})\n`)
    }
  })
  window.webContents.on('render-process-gone', (_event, details) => {
    process.stderr.write(`[rendu] processus perdu : ${details.reason}\n`)
  })

  // Un lien externe s'ouvre dans le navigateur, jamais dans la fenêtre : le
  // rendu ne doit jamais naviguer ailleurs que sur son propre schéma.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) event.preventDefault()
  })

  window.loadURL(ORIGIN + '/')

  // `COCKPIT_CAPTURE=/chemin.png` : la fenêtre se photographie puis quitte.
  // Une interface graphique doit pouvoir se vérifier sans qu'un humain la
  // regarde — sinon elle n'est jamais vérifiée automatiquement.
  const capture = process.env.COCKPIT_CAPTURE
  if (capture) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await window.webContents.capturePage()
        await writeFile(capture, image.toPNG())
        app.quit()
      }, 2500) // laisser les données arriver et le terminal s'ouvrir
    })
  }

  return window
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, request => {
    const url = new URL(request.url)
    // `server/api.js` décide ; ici on ne fait que router. Pas de dépôt
    // courant dans une application empaquetée : la liste des projets vient
    // entièrement du registre.
    return fetchHandler(url, null) ?? serveUi(url.pathname)
  })

  // Surface du terminal. Elle n'accepte jamais de nom de programme : le
  // processus lancé est décidé dans pty.js, pas par le rendu.
  ipcMain.handle('pty:open', (event, projectPath) => openSession(event.sender, projectPath))
  ipcMain.handle('pty:write', (_event, id, data) => writeTo(id, data))
  ipcMain.handle('pty:resize', (_event, id, cols, rows) => resize(id, cols, rows))
  ipcMain.handle('pty:close', (_event, id) => closeSession(id))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', closeAll)
