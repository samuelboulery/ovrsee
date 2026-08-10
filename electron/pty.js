/**
 * Sessions de terminal.
 *
 * Le panneau est un vrai terminal : le pty ouvre un **shell de connexion**,
 * puis l'ovrsee y tape `claude` une fois. Quitter Claude rend la main au
 * shell au lieu de tuer le panneau.
 *
 * Une session `shell` ouvre le même shell sans rien y taper : c'est là qu'on
 * lance un serveur de dev ou qu'on suit des logs, sans occuper la session
 * Claude. Le rendu ne choisit pas un programme pour autant — il envoie un mot
 * d'un ensemble fermé, et c'est ici qu'on décide ce qu'il déclenche.
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

// WHY: un vrai pseudo-terminal, pas un `child_process`. Sans pty, `claude`
// se croit dans un tuyau : pas de couleurs, pas de saisie interactive, pas de
// signal de redimensionnement. C'est un binaire natif, d'où le déballage de
// l'asar dans electron-builder.yml.
import { spawn } from 'node-pty'
import { existsSync } from 'node:fs'

/**
 * Ce qui est tapé une fois dans le shell qui vient de s'ouvrir, par genre de
 * session. `shell` n'a rien à taper : c'est un shell nu.
 */
const STARTUP_COMMAND = {
  claude: 'claude\n',
  shell: null,
}

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
 * l'environnement de l'ovrsee n'a rien à faire dans une session Claude neuve :
 *
 * - `ELECTRON_RUN_AS_NODE` et `NODE_OPTIONS` : posés par Electron, ils cassent
 *   tout `node` lancé depuis le terminal.
 * - `CLAUDE*` : si l'ovrsee a lui-même été lancé depuis une session Claude
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

/** @type {Map<string, {pty: import('node-pty').IPty, project: string, kind: string}>} */
const sessions = new Map()

let counter = 0

/**
 * Ouvre une session dans le dossier d'un projet.
 *
 * Un projet sans `ovrsee/` ouvre une session comme les autres : c'est là qu'on
 * l'équipe. L'appartenance au registre est vérifiée en amont, dans le
 * gestionnaire `pty:open` de `main.js` — la liste blanche vit avec les autres,
 * pas dupliquée ici.
 *
 * @param {Electron.WebContents} sender destinataire des octets du terminal
 * @param {string} projectPath dossier du projet, déjà reconnu par `main.js`
 * @param {'claude'|'shell'} [kind] genre de session ; tout autre valeur vaut `claude`
 * @returns {{id: string} | {error: string}}
 */
export function openSession(sender, projectPath, kind = 'claude') {
  // Reste après la garde du registre : un projet enregistré puis déplacé sur le
  // disque échouerait sinon dans `spawn`, avec un message autrement moins clair.
  if (typeof projectPath !== 'string' || !existsSync(projectPath)) {
    return { error: 'le dossier de ce projet est introuvable' }
  }

  // Le genre vient du rendu : `hasOwn` et pas une simple indexation, sinon
  // `constructor` ou `toString` désigneraient une valeur héritée du prototype.
  const known = typeof kind === 'string' && Object.hasOwn(STARTUP_COMMAND, kind)
  const startup = known ? STARTUP_COMMAND[kind] : STARTUP_COMMAND.claude

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
  let primed = !startup

  pty.onData(data => {
    if (!primed) {
      primed = true
      pty.write(startup)
    }
    if (!sender.isDestroyed()) sender.send('pty:data', id, data)
  })
  pty.onExit(({ exitCode }) => {
    sessions.delete(id)
    if (!sender.isDestroyed()) sender.send('pty:exit', id, exitCode)
  })

  sessions.set(id, { pty, project: projectPath, kind: known ? kind : 'claude' })
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
