/**
 * Sessions de terminal.
 *
 * Le panneau est un vrai terminal : le pty ouvre un **shell de connexion**,
 * puis le cockpit y tape `claude` une fois. Quitter Claude rend la main au
 * shell au lieu de tuer le panneau.
 *
 * Le shell de connexion n'est pas un confort, c'est la condition pour que ça
 * marche : une application graphique lancée depuis le Finder hérite d'un PATH
 * minimal, où ni `claude` ni `node` n'existent — les hooks de Claude Code
 * échouaient sur `/bin/sh: node: command not found`. Le shell source
 * `~/.zprofile` / `~/.zshrc` et reconstruit le vrai environnement.
 *
 * La surface exposée dans `preload.cjs` n'accepte toujours aucun nom de
 * programme : elle prend un chemin de projet, et c'est ici que le shell est
 * choisi. Ce que l'utilisateur tape ensuite dans le terminal le regarde — comme
 * dans Terminal.app.
 */

import { spawn } from 'node-pty'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Tapé une fois par session, dans le shell qui vient de s'ouvrir. */
const STARTUP_COMMAND = 'claude\n'

const FALLBACK_SHELL = '/bin/zsh'

/** Shell de connexion de l'utilisateur, ou zsh. */
function loginShell() {
  const shell = process.env.SHELL
  return typeof shell === 'string' && existsSync(shell) ? shell : FALLBACK_SHELL
}

/**
 * Environnement du shell.
 *
 * Trois nettoyages, tous pour la même raison — ce qui traîne dans
 * l'environnement du cockpit n'a rien à faire dans une session Claude neuve :
 *
 * - `ELECTRON_RUN_AS_NODE` et `NODE_OPTIONS` : posés par Electron, ils cassent
 *   tout `node` lancé depuis le terminal.
 * - `CLAUDE*` : si le cockpit a lui-même été lancé depuis une session Claude
 *   Code, il en hérite les marqueurs (`CLAUDE_CODE_CHILD_SESSION`,
 *   `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_MESSAGING_SOCKET`…). La session du
 *   panneau se croit alors fille d'une autre et cesse d'enregistrer son
 *   transcript. Le shell de connexion réexporte ce que l'utilisateur met dans
 *   son `~/.zshrc` : seuls les marqueurs de session disparaissent.
 * - `LANG` manque souvent aux applications graphiques, et sans lui les cadres
 *   dessinés par Claude sortent en charabia.
 */
function sessionEnv() {
  const { ELECTRON_RUN_AS_NODE, NODE_OPTIONS, ...rest } = process.env
  const env = Object.fromEntries(
    Object.entries(rest).filter(([key]) => !key.startsWith('CLAUDE')),
  )
  return {
    ...env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: process.env.LANG ?? 'fr_FR.UTF-8',
  }
}

/** @type {Map<string, {pty: import('node-pty').IPty, project: string}>} */
const sessions = new Map()

let counter = 0

/**
 * Ouvre une session dans le dossier d'un projet.
 *
 * @param {Electron.WebContents} sender destinataire des octets du terminal
 * @param {string} projectPath dossier du projet
 * @returns {{id: string} | {error: string}}
 */
export function openSession(sender, projectPath) {
  // Le chemin vient du rendu : il doit désigner un projet réel, pas un
  // dossier arbitraire, et surtout pas un fichier.
  if (typeof projectPath !== 'string' || !existsSync(join(projectPath, 'cockpit'))) {
    return { error: "ce dossier n'est pas un projet suivi par le cockpit" }
  }

  const shell = loginShell()
  const id = `pty-${++counter}`

  let pty
  try {
    pty = spawn(shell, ['-l'], {
      // C'est `name` qui pose `TERM`, pas l'environnement : le laisser à
      // `xterm-color` limiterait le terminal à huit couleurs.
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: projectPath,
      env: sessionEnv(),
    })
  } catch (err) {
    // Le dire vaut mieux qu'un panneau muet.
    return { error: `impossible d'ouvrir un shell (${shell}) : ${err?.message ?? err}` }
  }

  // `claude` est tapé au premier signe de vie du shell, pas avant : écrit trop
  // tôt, un prompt élaboré (instant prompt, autosuggestions) avale la ligne.
  let primed = false

  pty.onData(data => {
    if (!primed) {
      primed = true
      pty.write(STARTUP_COMMAND)
    }
    if (!sender.isDestroyed()) sender.send('pty:data', id, data)
  })
  pty.onExit(({ exitCode }) => {
    sessions.delete(id)
    if (!sender.isDestroyed()) sender.send('pty:exit', id, exitCode)
  })

  sessions.set(id, { pty, project: projectPath })
  return { id }
}

export function writeTo(id, data) {
  if (typeof data !== 'string') return
  sessions.get(id)?.pty.write(data)
}

export function resize(id, cols, rows) {
  const session = sessions.get(id)
  if (!session) return
  // node-pty jette sur des dimensions nulles ou négatives.
  if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 1 || rows < 1) return
  session.pty.resize(Math.floor(cols), Math.floor(rows))
}

export function closeSession(id) {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  try {
    session.pty.kill()
  } catch {
    // Déjà mort.
  }
}

/** Ne jamais laisser une session orpheline derrière la fenêtre. */
export function closeAll() {
  for (const id of [...sessions.keys()]) closeSession(id)
}
