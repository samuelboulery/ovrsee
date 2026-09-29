/**
 * Le shell de connexion de l'utilisateur, et l'environnement qu'on lui donne.
 *
 * Ce n'est pas un confort, c'est la condition pour que quoi que ce soit marche
 * hors d'un terminal : **une application graphique lancée depuis le Finder
 * hérite d'un PATH minimal** — `/usr/bin:/bin:/usr/sbin:/sbin` — où ni `pnpm`,
 * ni `node`, ni `claude` n'existent. Le shell de connexion reconstruit le vrai
 * environnement.
 *
 * Attention à l'invocation : `-l` source `.zprofile`, mais zsh ne lit `.zshrc`
 * que pour un shell **interactif** — or c'est là que vivent les PATH des
 * gestionnaires de version (pnpm, nvm, mise…). Un appel non interactif veut
 * donc `-lic`, pas `-lc`. Le terminal intégré n'a pas ce souci : un pty est
 * interactif par nature.
 *
 * Deux appelants, et la même règle : le terminal intégré (`electron/pty.js`) et
 * le crawl, qui démarre la commande `dev` du projet observé. Le crawl l'a appris
 * à ses dépens — lancé depuis le DMG, `sh -c 'pnpm dev'` sortait aussitôt sur un
 * `pnpm: command not found` jeté à la poubelle, et l'attente du serveur expirait
 * soixante secondes plus tard sur un message qui ne disait pas pourquoi.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const FALLBACK_SHELL = '/bin/zsh'

/**
 * Shell de connexion de l'utilisateur, ou zsh.
 *
 * Sous Windows, `COMSPEC` — c'est aussi ce que Node lui-même lance pour
 * `shell: true`, donc le terminal intégré et la commande `dev` ouvrent le même
 * shell. La branche n'est pas un détail de portabilité : sans elle, `SHELL`
 * n'existe pas, le repli `/bin/zsh` sortait tel quel, et le panneau terminal
 * s'ouvrait sur `impossible d'ouvrir un shell (/bin/zsh) : File not found`.
 */
export function loginShell() {
  if (process.platform === 'win32') return process.env.COMSPEC || 'cmd.exe'
  const shell = process.env.SHELL
  return typeof shell === 'string' && existsSync(shell) ? shell : FALLBACK_SHELL
}

/**
 * Ce qui fait de ce shell un shell de connexion.
 *
 * `-l` est un drapeau POSIX : `cmd.exe -l` ouvrirait un shell qui prend `-l`
 * pour un fichier à exécuter. Windows n'en a pas besoin — une application
 * graphique y hérite du PATH de l'utilisateur, lu dans le registre, et non du
 * PATH minimal que le Finder donne aux siennes.
 */
export function loginShellArgs() {
  return process.platform === 'win32' ? [] : ['-l']
}

/**
 * Arrête un processus et toute sa descendance.
 *
 * Deux mondes, et le même besoin : `pnpm dev` laisse un enfant vite derrière
 * lui, et ne viser que le fils direct laisserait le port pris — le crawl
 * suivant se refuserait alors de lui-même.
 *
 * POSIX : le groupe entier, celui que `detached: true` a créé.
 *
 * Windows n'a pas de groupes de processus. `process.kill(-pid)` y jette
 * `ESRCH`, et le repli `child.kill()` appelle `TerminateProcess` sur le seul
 * `cmd.exe` — ce qu'il avait lancé survivait. `taskkill /T` est la seule façon
 * d'y descendre l'arbre.
 *
 * @param {{pid?: number, kill?: (signal: string) => unknown}|null|undefined} child
 */
export function killTree(child) {
  if (!child?.pid) return

  if (process.platform === 'win32') {
    // `windowsHide` : sinon chaque arrêt fait clignoter une console.
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    return
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill?.('SIGTERM')
    } catch {
      /* déjà mort */
    }
  }
}

/**
 * De quoi lancer une commande écrite par l'utilisateur, par plateforme.
 *
 * Windows n'a ni `zsh`, ni `-lic`, ni le problème que ces trois lettres
 * résolvent : une application graphique y hérite du PATH de l'utilisateur, lu
 * dans le registre. Le shell par défaut de `spawn` y convient donc, et c'est
 * `cmd.exe` qui s'en charge.
 *
 * `detached` fait partie de la réponse, et pas des options de l'appelant : il
 * ne se décide pas sans savoir quel shell on vient de choisir. Sur POSIX il
 * donne au serveur de dev son propre groupe de processus, seule façon de
 * l'arrêter avec sa descendance. Sous Windows il détache le `cmd.exe` du
 * dessus dans sa propre console — et ce que la commande `dev` écrit part
 * alors là-bas, pas dans les tuyaux que l'appelant lit. Tout échec de `dev`
 * (un `pnpm` absent, un `package.json` manquant) devenait un silence, et le
 * crawl le consignait en « (la commande dev s'est arrêtée d'elle-même) »,
 * sans dire pourquoi. Windows n'a de toute façon pas de groupes de
 * processus : `killTree` y descend l'arbre par `taskkill /T`, détaché ou non.
 *
 * @param {string} commande la ligne `dev` du projet observé
 * @returns {[string|undefined, string[]|undefined, {shell?: boolean, detached: boolean}]} `[fichier, arguments, options]`
 */
export function shellRun(commande) {
  const detached = process.platform !== 'win32'
  if (process.platform === 'win32') return [commande, undefined, { shell: true, detached }]
  return [loginShell(), ['-lic', commande], { detached }]
}

/**
 * L'environnement à donner à un programme tiers qu'on lance.
 *
 * Trois nettoyages, tous pour la même raison — ce qui traîne dans
 * l'environnement de l'ovrsee n'a rien à faire dans le processus qu'il démarre :
 *
 * - `ELECTRON_RUN_AS_NODE` et `NODE_OPTIONS` : posés par Electron, ils cassent
 *   tout `node` lancé en dessous. Le crawl les reçoit lui-même — c'est ce qui
 *   lui permet de tourner — et n'a aucune raison de les transmettre au serveur
 *   de dev du projet.
 * - `CLAUDE*` : si l'ovrsee a été lancé depuis une session Claude Code, il en
 *   hérite les marqueurs de session. Ce qu'il démarre se croirait fils d'une
 *   autre session.
 * - `LANG` manque souvent aux applications graphiques.
 */
export function cleanEnv() {
  const { ELECTRON_RUN_AS_NODE: _run, NODE_OPTIONS: _opts, ...rest } = process.env
  const env = Object.fromEntries(Object.entries(rest).filter(([key]) => !key.startsWith('CLAUDE')))
  return { ...env, LANG: process.env.LANG ?? 'fr_FR.UTF-8' }
}
