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

import { existsSync } from 'node:fs'

const FALLBACK_SHELL = '/bin/zsh'

/** Shell de connexion de l'utilisateur, ou zsh. */
export function loginShell() {
  const shell = process.env.SHELL
  return typeof shell === 'string' && existsSync(shell) ? shell : FALLBACK_SHELL
}

/**
 * De quoi lancer une commande écrite par l'utilisateur, par plateforme.
 *
 * Windows n'a ni `zsh`, ni `-lic`, ni le problème que ces trois lettres
 * résolvent : une application graphique y hérite du PATH de l'utilisateur, lu
 * dans le registre. Le shell par défaut de `spawn` y convient donc, et c'est
 * `cmd.exe` qui s'en charge.
 *
 * @param {string} commande la ligne `dev` du projet observé
 * @returns {[string|undefined, string[]|undefined, {shell?: boolean}]} `[fichier, arguments, options]`
 */
export function shellRun(commande) {
  if (process.platform === 'win32') return [commande, undefined, { shell: true }]
  return [loginShell(), ['-lic', commande], {}]
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
