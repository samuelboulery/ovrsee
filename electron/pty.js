/**
 * Sessions de terminal.
 *
 * **Le programme lancé est décidé ici, jamais par le rendu.** La surface
 * exposée dans `preload.js` accepte un chemin de projet et rien d'autre : il
 * n'existe aucun chemin de code par lequel l'interface pourrait faire exécuter
 * un programme arbitraire. C'est la traduction du principe du cadrage — le
 * cockpit n'exécute jamais, sauf la session Claude elle-même.
 */

import { spawn } from 'node-pty'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Le seul programme que ce module sait lancer. */
const PROGRAM = 'claude'

/**
 * Emplacements habituels, essayés avant de déranger un shell.
 * Une application graphique lancée depuis le Finder n'hérite pas du PATH du
 * terminal : `claude` y est introuvable alors qu'il fonctionne parfaitement
 * dans un shell. C'est la cause du `posix_spawnp failed`.
 */
const CANDIDATES = [
  join(homedir(), '.local', 'bin', PROGRAM),
  `/opt/homebrew/bin/${PROGRAM}`,
  `/usr/local/bin/${PROGRAM}`,
]

let resolved = null

/**
 * Chemin absolu du binaire, ou null.
 *
 * Résolu une seule fois, au premier besoin. Le recours au shell de connexion
 * est un appel sans aucune entrée extérieure : la commande est écrite ici en
 * dur, rien de ce que fournit le rendu ne l'atteint.
 */
function findProgram() {
  if (resolved !== null) return resolved

  resolved = CANDIDATES.find(existsSync) ?? null
  if (resolved) return resolved

  try {
    const found = execFileSync('/bin/zsh', ['-lic', `command -v ${PROGRAM}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim()
    resolved = found && existsSync(found) ? found : null
  } catch {
    resolved = null
  }
  return resolved
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

  const program = findProgram()
  if (!program) {
    return {
      error: `${PROGRAM} introuvable. Cherché dans ${CANDIDATES.join(', ')} puis dans le PATH du shell de connexion.`,
    }
  }

  const id = `pty-${++counter}`

  let pty
  try {
    pty = spawn(program, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: projectPath,
      env: { ...process.env, TERM: 'xterm-256color' },
    })
  } catch (err) {
    // `claude` absent du PATH, par exemple. Le dire vaut mieux qu'un panneau
    // muet.
    return { error: `impossible de lancer ${PROGRAM} : ${err?.message ?? err}` }
  }

  pty.onData(data => {
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
