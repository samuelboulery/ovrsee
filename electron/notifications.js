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

import { app, Notification } from 'electron'
import { execFile } from 'node:child_process'
import { lstatSync, mkdirSync, readdirSync, readFileSync, unlinkSync, watch, writeFileSync } from 'node:fs'
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

/**
 * Les terminaux qu'un clic sur une notification inbox sait réactiver, par
 * identifiant de bundle (`__CFBundleIdentifier`, hérité par la session).
 * `TERM_PROGRAM` ne suffisait pas : Cursor et VS Code y écrivent tous deux
 * `vscode`.
 */
const TERMINAUX = new Set([
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
 * Notifications affichées, par clé. Retenues parce qu'une `Notification` que
 * plus rien ne référence est ramassée — et ses écouteurs de clic avec elle.
 * Une session qui renotifie remplace la sienne au lieu d'en empiler.
 */
const vivantes = new Map()

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
  majBadge()
}

function afficher(cle, { genre, projet, texte, dureeMs }, { actions = [], onAction, onClick }) {
  if (!Notification.isSupported()) return
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
    if (vivantes.get(cle) === notification) vivantes.delete(cle)
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

  vivantes.get(cle)?.close()
  vivantes.set(cle, notification)
  nonVues.add(cle)
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
    onAction: index => {
      if (index === 0) answer(ptyId, 'allow')
      if (index === 1) answer(ptyId, 'deny')
    },
    onClick: () => reveal(sessionKey),
  })
}

/**
 * Source 2 : un fichier déposé par le hook d'une session hors de l'app.
 *
 * Lu, effacé, puis seulement validé : un fichier refusé ne doit pas revenir à
 * chaque redémarrage. Un lien symbolique ou un fichier trop gros n'est pas lu.
 */
function traiterInbox(fichier) {
  let brut
  try {
    const info = lstatSync(fichier)
    if (!info.isFile() || info.size > 8 * 1024) {
      unlinkSync(fichier)
      return
    }
    brut = readFileSync(fichier, 'utf8')
    unlinkSync(fichier)
  } catch (err) {
    // `fs.watch` signale plusieurs fois le même fichier : le second passage le
    // trouve déjà effacé, c'est normal.
    if (err?.code !== 'ENOENT') process.stderr.write(`[ovrsee] inbox illisible : ${err?.message ?? err}\n`)
    return
  }

  const n = validerInbox(brut)
  if (!n) {
    process.stderr.write(`[ovrsee] inbox ignorée, contenu invalide : ${fichier}\n`)
    return
  }
  const terminal = n.terminal && TERMINAUX.has(n.terminal) ? n.terminal : null
  afficher(`inbox:${fichier}`, n, {
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
