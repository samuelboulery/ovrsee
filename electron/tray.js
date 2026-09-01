/**
 * Item de barre de menu macOS : l'état des sessions Claude, sans la fenêtre.
 *
 * Ce que ce fichier n'est pas : une seconde source de vérité. Le signal
 * d'attention n'est reconnu que dans le rendu (`app/src/attention.ts`, appelé
 * depuis `useTerminal.ts`, parce que c'est là qu'arrive le flux du pty). Le
 * processus principal ne fait que **retenir** le tableau que le rendu principal
 * lui publie et le republier au popover. Recalculer l'état ici le dédoublerait
 * dans un dossier ni typé ni couvert par `pnpm test` — et les deux copies
 * divergeraient au premier changement.
 *
 *   rendu principal ──report──▶ [ ce fichier ] ──state──▶ popover
 *                                     ▲                      │
 *                                     └────── answer ────────┘
 *
 * L'application reste une application normale : `app.dock.hide()` n'est pas
 * appelé. L'item s'ajoute à la fenêtre, il ne la remplace pas.
 */

import { BrowserWindow, Tray, nativeImage, nativeTheme, screen } from 'electron'

import { signalInstalle } from '../hooks/install.js'
import { hasSession, writeTo } from './pty.js'

/**
 * Ce qu'un bouton du popover tape réellement dans le pty.
 *
 * PLAFOND ASSUMÉ : cela dépend de la forme de l'invite de Claude Code. Si elle
 * change, ces touches deviennent fausses. S'en affranchir demanderait un hook
 * `PermissionRequest` bloquant et une voie de retour vers l'application — donc
 * un fichier ou une socket que tout processus du même compte pourrait écrire.
 * C'est l'échange qui a été fait : une dépendance à une forme d'affichage
 * plutôt qu'une surface de contrôle de plus.
 *
 * **Une seule touche par décision, jamais une séquence.** Un `1` suivi d'un
 * `Entrée` est précisément le piège : si le chiffre valide à lui seul, le
 * `Entrée` tombe dans l'invite suivante et y valide autre chose. `Entrée`
 * seul prend l'option surlignée par défaut — « oui » ; `Échap` annule, et
 * n'a d'effet nuisible nulle part.
 */
const TOUCHE = {
  allow: '\r',
  deny: '\u001b',
}

/** Taille du popover, en points. */
const POPOVER = { width: 380, height: 460 }

/** Marge au bord de l'écran quand l'icône est tout à droite. */
const MARGE = 8

let tray = null
let popover = null

/** Dernier état publié par le rendu principal. */
let etat = { sessions: [], projet: null }

/** Fenêtre principale, pour la ramener au premier plan sur « ouvrir ». */
let principale = null

/**
 * Icône de la barre de menu, dessinée plutôt que versionnée.
 *
 * Un bitmap BGRA évite d'ajouter un PNG binaire au dépôt et un encodeur pour
 * le produire. Le motif est celui de `build/icon.svg`, réduit à sa grille :
 * une pupille dans un œil, 7 cellules sur 5.
 *
 * `setTemplateImage(true)` est ce qui fait qu'elle s'inverse en thème clair.
 * Sans lui, elle reste noire sur une barre noire — le défaut ne se voit que
 * dans un des deux thèmes, d'où le rappel ici.
 */
function icone() {
  // Une ligne par rangée, `X` = cellule pleine. Lu tel quel : le motif se
  // relit dans le source au lieu de se déduire de coordonnées.
  const motif = ['..XXX..', '.X...X.', 'X.XXX.X', '.X...X.', '..XXX..']

  const cellule = 4
  const width = 32
  const height = 32
  const offsetX = Math.round((width - motif[0].length * cellule) / 2)
  const offsetY = Math.round((height - motif.length * cellule) / 2)

  // BGRA, prémultiplié. Un template n'utilise que le canal alpha : les trois
  // premiers octets restent à zéro, macOS recolore.
  const bitmap = Buffer.alloc(width * height * 4)

  for (let r = 0; r < motif.length; r += 1) {
    for (let c = 0; c < motif[r].length; c += 1) {
      if (motif[r][c] !== 'X') continue
      for (let dy = 0; dy < cellule; dy += 1) {
        for (let dx = 0; dx < cellule; dx += 1) {
          const x = offsetX + c * cellule + dx
          const y = offsetY + r * cellule + dy
          bitmap[(y * width + x) * 4 + 3] = 255
        }
      }
    }
  }

  // `scaleFactor: 2` : 32 pixels pour 16 points, la définition attendue d'une
  // barre de menu Retina.
  const image = nativeImage.createFromBitmap(bitmap, { width, height, scaleFactor: 2 })
  image.setTemplateImage(true)
  return image
}

/** Le popover, créé à la première ouverture et gardé ensuite. */
function popoverWindow(origin, preload) {
  if (popover && !popover.isDestroyed()) return popover

  popover = new BrowserWindow({
    ...POPOVER,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // C'EST LA LIGNE QUI FAIT LE PLEIN ÉCRAN. `NativeWindowMac::Show()` appelle
    // `activateIgnoringOtherApps:YES` — sauf pour une fenêtre panel :
    //
    //   if (!IsPanel()) { [[NSApplication sharedApplication] activate…]; }
    //
    // Activer l'application, c'est basculer sur son espace. Sans `panel`, un
    // clic sur l'icône depuis une app en plein écran quitte cette app.
    type: 'panel',
    // Le fond d'avant le premier paint, accordé au thème (T-0231) : le popover
    // est une seconde racine de rendu, il ne partage rien avec la fenêtre.
    // `nativeTheme` porte déjà le réglage — `app:theme` l'y a posé.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#08090a' : '#eceef1',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // `skipTransformProcessType` n'est pas un détail : sans lui, Electron appelle
  // `DockHide()` pour satisfaire la règle d'Apple — une fenêtre ne flotte
  // au-dessus du plein écran que si l'application est un `UIElement` — et
  // l'icône du Dock d'Ovrsee disparaîtrait. Le type `panel` obtient le même
  // résultat sans y toucher, à condition de sauter cette transformation.
  popover.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  })
  // `pop-up-menu` est le premier niveau qui passe au-dessus du Dock — en
  // dessous, le popover s'afficherait derrière.
  popover.setAlwaysOnTop(true, 'pop-up-menu')

  // Même garde que la fenêtre principale : ce rendu ne navigue jamais ailleurs
  // que sur son propre schéma.
  popover.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  popover.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(origin)) event.preventDefault()
  })

  // Se referme dès qu'on clique ailleurs, comme tous les popovers du système.
  popover.on('blur', () => {
    if (!popover.webContents.isDevToolsOpened()) popover.hide()
  })

  popover.loadURL(`${origin}/barre-de-menu`)
  return popover
}

/** Place le popover sous l'icône, sans déborder de l'écran. */
function positionner(fenetre) {
  const bounds = tray.getBounds()
  const taille = fenetre.getBounds()
  const ecran = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).workArea

  const centre = Math.round(bounds.x + bounds.width / 2 - taille.width / 2)
  const maxX = ecran.x + ecran.width - taille.width - MARGE
  const x = Math.max(ecran.x + MARGE, Math.min(centre, maxX))

  fenetre.setPosition(x, Math.round(bounds.y + bounds.height), false)
}

function basculer(origin, preload) {
  const fenetre = popoverWindow(origin, preload)
  if (fenetre.isVisible()) {
    fenetre.hide()
    return
  }

  // Relu à chaque ouverture, pas au démarrage : l'utilisateur peut lancer
  // l'installateur entre deux, et le bandeau doit disparaître sans redémarrer.
  publier()

  positionner(fenetre)
  // `showInactive` et pas `show` : montrer sans donner le focus, donc sans
  // réveiller l'application. Avec `type: 'panel'`, `show()` n'active déjà plus
  // l'app — les deux ensemble ne laissent aucune chance à un changement
  // d'espace.
  fenetre.showInactive()
}

/**
 * Crée l'item de barre de menu.
 *
 * @param {{origin: string, preload: string, getMainWindow: () => Electron.BrowserWindow|null}} options
 */
export function createTray({ origin, preload, getMainWindow }) {
  if (tray) return tray

  principale = getMainWindow
  tray = new Tray(icone())
  tray.setToolTip('Ovrsee — sessions Claude')
  tray.on('click', () => basculer(origin, preload))
  // Le clic droit ouvre le même popover : un menu natif ne saurait pas rendre
  // des boutons Autoriser/Refuser.
  tray.on('right-click', () => basculer(origin, preload))

  return tray
}

/**
 * La vue envoyée au popover : ce que le rendu publie, plus ce que seul ce
 * processus sait — l'état d'installation du hook, qui se lit sur le disque.
 */
const vue = () => ({ ...etat, signalInstalle: signalInstalle() })

/** Pousse la vue au popover et met l'icône à jour. */
function publier() {
  if (popover && !popover.isDestroyed()) popover.webContents.send('menubar:state', vue())

  // Le titre marque l'attente. Pas de règle de péremption ici : elle vit dans
  // `app/src/menubar.ts`, où elle est testée, et ne sert qu'à griser les
  // boutons. Une session qui a posé une question reste signalée jusqu'à son
  // prochain `stop` — c'est-à-dire jusqu'à ce qu'elle reprenne la main.
  const attend = etat.sessions.some(s => s?.attention?.kind === 'question')
  if (tray) tray.setTitle(attend ? ' ●' : '')
}

/**
 * Retient l'état publié par le rendu principal et le republie au popover.
 *
 * @param {{sessions: Array<object>, projet: object|null}} suivant
 */
export function setState(suivant) {
  etat = {
    sessions: Array.isArray(suivant?.sessions) ? suivant.sessions : [],
    projet: suivant?.projet ?? null,
  }
  publier()
}

export const currentState = vue

/**
 * Détruit le popover.
 *
 * Appelé à la fermeture de la fenêtre principale, et pas par confort : une
 * fenêtre cachée compte quand même dans `getAllWindows()`. Sans cela,
 * `window-all-closed` ne se déclencherait plus jamais, `closeAll()` ne serait
 * plus appelé, et les sessions Claude survivraient sans interface — un
 * changement de cycle de vie qui n'a pas été demandé.
 */
export function destroyPopover() {
  if (popover && !popover.isDestroyed()) popover.destroy()
  popover = null
  setState({ sessions: [], projet: null })
}

/**
 * Répond à une session en tapant une touche dans son pty.
 *
 * Trois gardes, et elles sont le cœur du fichier :
 *
 * 1. la décision ne peut valoir que `allow` ou `deny` — le rendu n'envoie
 *    jamais le texte à écrire ;
 * 2. l'identifiant doit figurer dans l'état publié, sans quoi le popover
 *    répondrait pour une session dont il n'a jamais entendu parler ;
 * 3. l'identifiant doit désigner un pty que **ce processus** possède
 *    réellement. L'état vient du rendu : le croire sur parole ferait décider
 *    d'après une liste qu'il a écrite lui-même.
 *
 * @param {string} ptyId
 * @param {'allow'|'deny'} decision
 * @returns {boolean} vrai si une touche a été écrite
 */
export function answer(ptyId, decision) {
  const touche = Object.hasOwn(TOUCHE, decision) ? TOUCHE[decision] : null
  if (touche === null) return false
  if (typeof ptyId !== 'string' || !etat.sessions.some(s => s?.ptyId === ptyId)) return false
  if (!hasSession(ptyId)) return false

  writeTo(ptyId, touche)

  // L'attente est éteinte dès la touche envoyée : sans cela le popover
  // proposerait encore de décider d'une demande à laquelle on vient de
  // répondre, et le second clic tomberait dans l'invite suivante.
  setState({
    ...etat,
    sessions: etat.sessions.map(s => (s?.ptyId === ptyId ? { ...s, attention: null } : s)),
  })

  // Et il se referme : une décision est le geste qui clôt la visite. C'est
  // aussi le repli si `blur` ne se déclenche plus — `showInactive()` ne donne
  // pas le focus, donc rien ne garantit qu'il y ait un jour un `blur`.
  if (popover && !popover.isDestroyed()) popover.hide()
  return true
}

/**
 * Ramène la fenêtre principale sur une session, et referme le popover.
 *
 * Le ciblage lui-même appartient au rendu — il connaît les onglets et le
 * projet affiché. Même chemin que le clic sur une notification (T-0119).
 *
 * @param {string} sessionKey
 */
export function reveal(sessionKey) {
  if (popover && !popover.isDestroyed()) popover.hide()

  const fenetre = principale?.()
  if (!fenetre || fenetre.isDestroyed()) return

  if (fenetre.isMinimized()) fenetre.restore()
  fenetre.show()
  fenetre.focus()
  fenetre.webContents.send('menubar:reveal', sessionKey)
}
