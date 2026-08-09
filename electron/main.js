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

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  protocol,
  shell,
  webContents,
  WebContentsView,
} from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchHandler } from '../server/api.js'
import { projects } from '../hooks/snapshot.js'
import { buildMenu } from './menu.js'
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

// En développement, `app.name` vaut « Electron » : le premier menu et les
// dialogues du système porteraient ce nom-là. Le paquet, lui, tient son nom de
// `productName` — les poser tous les deux rend les deux modes identiques.
app.setName('Cockpit')

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

/**
 * Invités attachés, par fenêtre hôte.
 *
 * @type {Map<number, Set<Electron.WebContents>>}
 */
const guestsByHost = new Map()

/**
 * Panneau de DevTools ouvert, par fenêtre hôte.
 *
 * @type {Map<number, {view: Electron.WebContentsView, target: Electron.WebContents, window: Electron.BrowserWindow}>}
 */
const devtoolsByHost = new Map()

/** Ferme le panneau de DevTools d'une fenêtre, s'il y en a un. */
function closeDevtools(hostId) {
  const open = devtoolsByHost.get(hostId)
  if (!open) return
  devtoolsByHost.delete(hostId)

  if (!open.target.isDestroyed()) open.target.closeDevTools()
  if (!open.window.isDestroyed()) open.window.contentView.removeChildView(open.view)
  if (!open.view.webContents.isDestroyed()) open.view.webContents.close()
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
      // L'onglet Navigateur affiche l'application en cours de développement.
      // Une `<iframe>` ne conviendrait pas : le dev server est une autre
      // origine, le rendu ne pourrait pas toucher son DOM et la sélection
      // d'élément serait impossible.
      webviewTag: true,
    },
  })

  // L'invité est attaché par le rendu : c'est ici qu'on décide de ses
  // privilèges, pas dans les attributs de la balise. Sans cela, un rendu
  // compromis attacherait une page distante avec `nodeIntegration`.
  window.webContents.on('will-attach-webview', (_event, webPreferences) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
  })

  // Les invités de cette fenêtre. Sert de liste blanche à `preview:devtools` :
  // le rendu y désigne deux contenus par identifiant, et un identifiant est
  // un entier — donc devinable. Rien d'autre que ce que cette fenêtre a
  // elle-même attaché ne doit pouvoir être visé.
  const guests = new Set()
  guestsByHost.set(window.webContents.id, guests)

  // Le garde `will-navigate` ci-dessous ne couvre que la fenêtre. Un
  // `target="_blank"` de l'application inspectée ouvrirait sinon une fenêtre
  // Electron nue, sans barre d'adresse ni indication d'origine.
  window.webContents.on('did-attach-webview', (_event, guest) => {
    guests.add(guest)
    guest.once('destroyed', () => guests.delete(guest))
    guest.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
  })

  const hostId = window.webContents.id
  window.webContents.once('destroyed', () => {
    closeDevtools(hostId)
    guestsByHost.delete(hostId)
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

  // `COCKPIT_ROUTE=/navigateur` ouvre la fenêtre sur un autre onglet : sans
  // cela, la capture automatique ci-dessous ne peut vérifier que la page
  // d'arrivée, et les cinq autres onglets ne sont jamais regardés.
  window.loadURL(ORIGIN + (process.env.COCKPIT_ROUTE ?? '/'))

  // `COCKPIT_CAPTURE=/chemin.png` : la fenêtre se photographie puis quitte.
  // Une interface graphique doit pouvoir se vérifier sans qu'un humain la
  // regarde — sinon elle n'est jamais vérifiée automatiquement.
  //
  // Le délai s'ajuste par `COCKPIT_CAPTURE_DELAY` : sur un démarrage à froid,
  // 2,5 s ne suffisent pas toujours et la capture rend une image vide — le
  // seul résultat pire qu'une absence de vérification est une vérification qui
  // ment.
  const capture = process.env.COCKPIT_CAPTURE
  if (capture) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await window.webContents.capturePage()
        await writeFile(capture, image.toPNG())
        app.quit()
      }, Number(process.env.COCKPIT_CAPTURE_DELAY ?? 2500))
    })
  }

  return window
}

app.whenReady().then(() => {
  // Le panneau natif n'affiche par défaut que le nom et la version. Le
  // copyright vient de `NSHumanReadableCopyright` dans l'application empaquetée,
  // et de nulle part en développement — le poser ici rend les deux identiques.
  app.setAboutPanelOptions({
    applicationName: 'Cockpit',
    applicationVersion: app.getVersion(),
    copyright: '© 2026 Samuel Boulery',
    credits: 'Vue en lecture seule sur un projet vibecodé.',
  })

  Menu.setApplicationMenu(buildMenu())

  protocol.handle(SCHEME, async request => {
    const url = new URL(request.url)
    // `server/api.js` décide ; ici on ne fait que router. Pas de dépôt
    // courant dans une application empaquetée : la liste des projets vient
    // entièrement du registre.
    //
    // `await` avant le `??` : une promesse est toujours vraie, et sans lui
    // l'interface ne serait plus jamais servie.
    return (await fetchHandler(url, null, request)) ?? serveUi(url.pathname)
  })

  // Surface du terminal. Elle n'accepte jamais de nom de programme : le
  // processus lancé est décidé dans pty.js, pas par le rendu.
  ipcMain.handle('pty:open', (event, projectPath, kind) =>
    openSession(event.sender, projectPath, kind),
  )
  ipcMain.handle('pty:write', (_event, id, data) => writeTo(id, data))
  ipcMain.handle('pty:resize', (_event, id, cols, rows) => resize(id, cols, rows))
  ipcMain.handle('pty:close', (_event, id) => closeSession(id))

  /**
   * Ouvrir — et positionner — le panneau de DevTools de l'aperçu.
   *
   * `webview.openDevTools()` ouvre une fenêtre séparée, et une fenêtre qui
   * flotte à côté du cockpit annule ce que l'onglet Navigateur apporte.
   * `setDevToolsWebContents` est la seule façon de les rendre ailleurs.
   *
   * L'hôte est une `WebContentsView`, pas une seconde `<webview>` : mesuré,
   * une `<webview>` hôte charge bien le frontend mais reste sans cible — les
   * panneaux s'affichent vides. Une `WebContentsView` les rend complets.
   *
   * Elle se pose *au-dessus* du DOM, sans y appartenir : c'est le rendu qui
   * mesure l'emplacement réservé et renvoie ses coordonnées à chaque
   * redimensionnement. Une taille nulle escamote le panneau — c'est ce qui
   * arrive quand on quitte l'onglet.
   *
   * L'identifiant de la cible vient du rendu : il doit désigner un invité que
   * *cette* fenêtre a attaché, sinon n'importe quel entier ouvrirait les
   * DevTools d'un contenu quelconque.
   */
  ipcMain.handle('preview:devtools', (event, targetId, bounds, theme) => {
    const guests = guestsByHost.get(event.sender.id)
    const target = webContents.fromId(targetId)
    if (!guests || !target || !guests.has(target)) return false

    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return false

    // Les DevTools suivent le thème du système, et s'ouvrent donc en clair sur
    // un Mac en clair — éblouissant à côté d'une interface sombre. Leur thème
    // n'est pas une option de l'API : `themeSource` est ce qui le décide.
    //
    // Le réglage vaut pour toute l'application, pas seulement pour les
    // DevTools. C'est cohérent : le cockpit est sombre, et ses menus natifs,
    // ses ascenseurs et ses dialogues doivent l'être aussi. Le thème vient du
    // rendu parce qu'il est le seul à savoir ce qu'il affiche.
    //
    // Écarté : poser `uiTheme` dans le `localStorage` de la page DevTools.
    // C'est la recette qui circule, elle ne fait plus rien — vérifié sur deux
    // profils neufs, la page ne lit plus ce réglage là.
    nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark'

    let open = devtoolsByHost.get(event.sender.id)
    if (!open) {
      const view = new WebContentsView({
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      })
      window.contentView.addChildView(view)
      open = { view, target, window }
      devtoolsByHost.set(event.sender.id, open)

      target.setDevToolsWebContents(view.webContents)
      target.openDevTools()
    }

    const visible = bounds?.width >= 1 && bounds?.height >= 1
    open.view.setVisible(visible)
    if (visible) {
      open.view.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      })
    }
    return true
  })

  ipcMain.handle('preview:devtools-close', event => {
    closeDevtools(event.sender.id)
    return true
  })

  // Choisir un dossier. Le seul geste qui ne peut pas passer par `/api` : une
  // page web n'a pas le droit de connaître un chemin du disque tant que
  // l'utilisateur ne l'a pas désigné lui-même. Aucun argument venu du rendu —
  // ce qui est ouvert est ce qui a été cliqué, rien d'autre.
  ipcMain.handle('projects:pick', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Ouvrir un projet',
      properties: ['openDirectory'],
    })
    return canceled ? null : (filePaths[0] ?? null)
  })

  // Révéler le `cockpit/` d'un projet dans le Finder — la seule commande du menu
  // qui touche au disque.
  //
  // `showItemInFolder` et jamais `openPath` : révéler sélectionne un dossier,
  // ouvrir *lancerait* ce que le chemin désigne. Le chemin vient du rendu, il
  // est donc vérifié contre le registre avant usage — même garde que `known()`
  // dans `server/api.js`. Sans elle, un rendu compromis ferait ouvrir le Finder
  // n'importe où.
  ipcMain.handle('projects:reveal', (_event, path) => {
    if (typeof path !== 'string' || !projects(null).some(p => p.path === path)) return false
    shell.showItemInFolder(join(path, 'cockpit'))
    return true
  })

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
