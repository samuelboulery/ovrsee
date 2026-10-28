/**
 * Les notifications natives, pour les trois sources (T-0306).
 *
 *   terminal de l'app ── OSC ──▶ rendu ── notif:show ──▶ ┐
 *   autre terminal ── hook ──▶ ~/.claude/ovrsee/inbox ──▶ ├─▶ [ ce fichier ] ─▶ Notification
 *   (app quittée : le hook passe par osascript, sans nous) ┘
 *
 * Le contenu (titre, corps, seuil, son) se décide dans `hooks/ovrsee-notify.js`,
 * qui sert aussi au filet osascript : les trois voies affichent la même chose.
 * Ce fichier n'ajoute que ce que seul Electron sait faire — les boutons, le
 * badge, et le clic qui ramène où il faut.
 *
 * **Les boutons ne tapent jamais rien eux-mêmes.** Autoriser/Refuser passent
 * par `answer()` de `tray.js`, avec ses trois gardes : le popover et la
 * notification sont deux portes vers la même serrure.
 *
 * **L'inbox n'est pas une surface de contrôle.** N'importe quel processus du
 * compte peut y déposer un fichier ; il ne peut que faire afficher une
 * notification. Le seul geste qui en découle — activer le terminal d'origine au
 * clic — ne vise qu'un bundle de la liste `TERMINAUX`, par `open -b`.
 */

import { app, BrowserWindow, Notification } from 'electron'
import { execFile } from 'node:child_process'
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  unlinkSync,
  watch,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { t } from '../hooks/i18n.js'
import {
  aNotifier,
  contenuNotification,
  inboxDir,
  pidPath,
  sonPour,
  validerInbox,
} from '../hooks/ovrsee-notify.js'
import { readSettings } from '../hooks/settings.js'
import { answer, reveal, setCompte } from './tray.js'

/** Taille maximale lue d'un fichier inbox, comme `validerInbox`. */
const MAX_INBOX = 8 * 1024

/**
 * Débit maximal de l'inbox, en fichiers par seconde. Au-delà, le fichier est
 * effacé sans être affiché : un processus qui inonde le dossier ne doit pas
 * inonder l'écran.
 */
const DEBIT_INBOX = 10

/** Au-delà, la plus ancienne notification retenue est oubliée (macOS n'émet pas toujours `close`). */
const MAX_VIVANTES = 50

/**
 * Les terminaux qu'un clic sur une notification inbox sait réactiver, par
 * identifiant de bundle (`__CFBundleIdentifier`, hérité par la session).
 * `TERM_PROGRAM` ne suffisait pas : Cursor et VS Code y écrivent tous deux
 * `vscode`.
 */
export const TERMINAUX = new Set([
  'com.apple.Terminal',
  'com.googlecode.iterm2',
  'com.mitchellh.ghostty',
  'com.github.wez.wezterm',
  'dev.warp.Warp-Stable',
  'net.kovidgoyal.kitty',
  'org.alacritty',
  'com.microsoft.VSCode',
  'com.todesktop.230313mzl4w4u92',
  'dev.zed.Zed',
  'com.exafunction.windsurf',
])

/** Bornes du message du rendu, comme celles de `validerInbox`. */
const MAX_CLE = 1000
const MAX_DETAIL = 500

/**
 * Notifications affichées, par clé, avec leur genre. Retenues parce qu'une
 * `Notification` que plus rien ne référence est ramassée — et ses écouteurs de
 * clic avec elle. Une session qui renotifie remplace la sienne au lieu d'en
 * empiler.
 *
 * @type {Map<string, {notification: Electron.Notification, genre: string}>}
 */
const vivantes = new Map()

/** Fenêtre de débit de l'inbox : `[début en ms, fichiers traités]`. */
let debit = [0, 0]

/** Ce qui a notifié sans être vu depuis — le badge (T-0306). */
const nonVues = new Set()

/** Les sessions de l'app qui attendent une réponse, d'après le dernier rapport du rendu. */
let questions = new Set()

let veilleur = null

function majBadge() {
  const n = readSettings().notifications.badge ? new Set([...questions, ...nonVues]).size : 0
  app.dock?.setBadge(n > 0 ? String(n) : '')
  setCompte(n)
}

/** Fenêtre au premier plan, popover ouvert : ce qui a notifié est vu. */
export function marquerVues() {
  if (nonVues.size === 0) return
  nonVues.clear()
  majBadge()
}

/**
 * Le rapport que le rendu publie déjà pour la barre de menus suffit au badge :
 * pas de second canal, pas de second calcul de l'état.
 *
 * @param {Array<{sessionKey?: string, attention?: {kind?: string}|null}>} sessions
 */
export function suivreSessions(sessions) {
  questions = new Set(
    (Array.isArray(sessions) ? sessions : [])
      .filter(s => s?.attention?.kind === 'question' && typeof s.sessionKey === 'string')
      .map(s => s.sessionKey),
  )
  // Une question résolue ailleurs — au terminal, au popover — retire sa
  // notification : ses boutons ne répondraient plus à rien de visible.
  for (const [cle, { notification, genre }] of vivantes) {
    if (genre !== 'question' || cle.startsWith('inbox:') || questions.has(cle)) continue
    vivantes.delete(cle)
    nonVues.delete(cle)
    notification.close()
  }
  majBadge()
}

function afficher(cle, { genre, projet, texte, dureeMs }, { actions = [], onAction, onClick }) {
  if (!Notification.isSupported()) {
    process.stderr.write(`[ovrsee] notifications non prises en charge, ${genre} de ${projet} perdu\n`)
    return
  }
  const { notifications: reglages, langue } = readSettings()
  if (!aNotifier(genre, dureeMs, reglages)) return

  const son = sonPour(genre, reglages)
  const notification = new Notification({
    ...contenuNotification({ genre, projet, texte, dureeMs }, langue),
    silent: son === null,
    ...(son ? { sound: son } : {}),
    actions: actions.map(text => ({ type: 'button', text: t(text, langue) })),
  })

  const oublier = () => {
    if (vivantes.get(cle)?.notification === notification) vivantes.delete(cle)
  }
  notification.on('click', () => {
    oublier()
    marquerVues()
    onClick?.()
  })
  // `actionIndex` dans le détail depuis Electron 33, en second argument avant.
  notification.on('action', (details, index) => {
    oublier()
    onAction?.(details?.actionIndex ?? index)
  })
  notification.on('close', oublier)

  vivantes.get(cle)?.notification.close()
  vivantes.delete(cle)
  vivantes.set(cle, { notification, genre })
  if (vivantes.size > MAX_VIVANTES) vivantes.delete(vivantes.keys().next().value)
  // Fenêtre au premier plan : la notification est vue en arrivant.
  if (!BrowserWindow.getFocusedWindow()) nonVues.add(cle)
  notification.show()
  majBadge()
}

/**
 * Source 1 : une session du terminal de l'app, signalée par le rendu.
 *
 * Le rendu a déjà écarté ce qui est sous les yeux. Rien de son message n'est
 * cru : `ptyId` ne sert qu'à `answer()`, qui le confronte à ses propres ptys.
 *
 * @param {unknown} n
 */
export function depuisRendu(n) {
  if (!n || typeof n !== 'object') return
  const { sessionKey, kind, detail, dureeMs, ptyId } = /** @type {Record<string, unknown>} */ (n)
  if (kind !== 'stop' && kind !== 'question') return
  if (typeof sessionKey !== 'string' || sessionKey.length > MAX_CLE || !sessionKey.includes('#')) return
  if (typeof ptyId !== 'string' || ptyId.length > MAX_CLE) return
  const texte = typeof detail === 'string' ? detail.slice(0, MAX_DETAIL) : null
  const duree = typeof dureeMs === 'number' && Number.isFinite(dureeMs) && dureeMs >= 0 ? dureeMs : null

  // Le nom du dossier plutôt que celui du registre : la session peut venir
  // d'un projet qui n'est pas l'affiché.
  const chemin = sessionKey.slice(0, sessionKey.lastIndexOf('#'))
  const projet = chemin.split(/[\\/]/).filter(Boolean).pop() ?? chemin

  afficher(sessionKey, { genre: kind, projet, texte, dureeMs: duree }, {
    actions: kind === 'question' ? ['menubar.allow', 'menubar.deny'] : [],
    // `texte` : `answer()` refuse si la session ne pose plus *cette* question.
    onAction: index => {
      if (index === 0) answer(ptyId, 'allow', texte)
      if (index === 1) answer(ptyId, 'deny', texte)
    },
    onClick: () => reveal(sessionKey),
  })
}

/**
 * Lit au plus `max` octets (`MAX_INBOX` par défaut) d'un fichier ordinaire, sans suivre de lien
 * ni bloquer : ouvert puis vérifié sur le descripteur, pas sur le chemin — un
 * `lstat` suivi d'un `readFile` laissait le temps de remplacer le fichier par
 * une FIFO, qui aurait gelé le processus principal.
 *
 * @returns {string|null} null si ce n'est pas un fichier ordinaire assez petit
 */
export function lireBorne(fichier, max = MAX_INBOX) {
  const fd = openSync(fichier, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const info = fstatSync(fd)
    if (!info.isFile() || info.size > max) return null
    const tampon = Buffer.alloc(max + 1)
    const lus = readSync(fd, tampon, 0, tampon.length, 0)
    return lus > max ? null : tampon.toString('utf8', 0, lus)
  } finally {
    closeSync(fd)
  }
}

/**
 * Source 2 : un fichier déposé par le hook d'une session hors de l'app.
 *
 * Lu, effacé, puis seulement validé : un fichier refusé ne doit pas revenir à
 * chaque redémarrage. Un lien symbolique, une FIFO ou un fichier trop gros
 * n'est pas lu.
 */
function traiterInbox(fichier) {
  let brut
  try {
    brut = lireBorne(fichier)
    unlinkSync(fichier)
  } catch (err) {
    // `fs.watch` signale plusieurs fois le même fichier : le second passage le
    // trouve déjà effacé, c'est normal.
    if (err?.code !== 'ENOENT') process.stderr.write(`[ovrsee] inbox illisible : ${err?.message ?? err}\n`)
    if (err?.code === 'ELOOP') {
      try {
        unlinkSync(fichier)
      } catch {
        // Le lien est déjà parti.
      }
    }
    return
  }

  const maintenant = Date.now()
  if (maintenant - debit[0] >= 1000) debit = [maintenant, 0]
  debit[1] += 1
  if (debit[1] > DEBIT_INBOX) {
    process.stderr.write(`[ovrsee] inbox : débit dépassé, ${fichier} ignoré\n`)
    return
  }

  const n = brut === null ? null : validerInbox(brut)
  if (!n) {
    process.stderr.write(`[ovrsee] inbox ignorée, contenu invalide : ${fichier}\n`)
    return
  }
  const terminal = n.terminal && TERMINAUX.has(n.terminal) ? n.terminal : null
  afficher(`inbox:${n.session ?? fichier}`, n, {
    onClick: () => {
      if (terminal) execFile('open', ['-b', terminal], () => {})
    },
  })
}

/**
 * Démarre l'écoute de l'inbox et pose `menubar.pid` — c'est lui qui dit au
 * hook que l'app est là pour lire l'inbox.
 */
export function demarrerNotifications() {
  const dossier = inboxDir()
  try {
    mkdirSync(dossier, { recursive: true, mode: 0o700 })
    // `mkdirSync` ne touche pas aux droits d'un dossier déjà là — que le hook
    // a pu créer le premier.
    chmodSync(dossier, 0o700)
    writeFileSync(pidPath(), String(process.pid))
  } catch (err) {
    process.stderr.write(`[ovrsee] inbox indisponible : ${err?.message ?? err}\n`)
    return
  }

  // Ce qui a été déposé entre le démarrage et l'écoute.
  for (const nom of readdirSync(dossier)) if (nom.endsWith('.json')) traiterInbox(join(dossier, nom))

  // Seuls les `*.json` : `writeFileNoFollow` écrit d'abord un `.tmp-…`, puis renomme.
  veilleur = watch(dossier, (_type, nom) => {
    if (typeof nom === 'string' && nom.endsWith('.json')) traiterInbox(join(dossier, nom))
  })
  veilleur.on('error', err => process.stderr.write(`[ovrsee] inbox : ${err?.message ?? err}\n`))
}

/** À la sortie : sans pid, le hook repasse à osascript. */
export function arreterNotifications() {
  veilleur?.close()
  veilleur = null
  try {
    if (readFileSync(pidPath(), 'utf8').trim() === String(process.pid)) unlinkSync(pidPath())
  } catch {
    // Déjà parti : rien à nettoyer.
  }
}
