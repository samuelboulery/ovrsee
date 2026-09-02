/**
 * Ce qu'un hook reçoit du dehors : sa charge utile, et le dépôt où il tourne.
 *
 * Six fichiers portaient ces deux fonctions au caractère près — même `try`,
 * même repli, même commentaire sur `execFile` sans shell. Le geste est celui
 * de `principal.js` (T-0204) : une définition, six importateurs.
 *
 * Ce n'est pas une économie de lignes. Une correction faite sur une copie
 * laissait les cinq autres derrière, et rien ne l'aurait dit.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * La charge utile du hook, lue sur l'entrée standard.
 *
 * Jamais d'exception : un hook lancé à la main, sans `stdin` branché, doit
 * répondre « rien à traiter » plutôt que mourir. L'appelant décide ensuite ce
 * qu'une chaîne vide veut dire pour lui.
 *
 * @returns {string} le contenu de stdin, ou `''`
 */
export function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Racine du dépôt git contenant `cwd`, ou `null`.
 *
 * Sécurité : `execFile` sans shell. `cwd` vient d'un JSON externe — le payload
 * du hook — et ne doit jamais être interprété par un shell.
 *
 * `null` couvre les deux cas où il n'y a rien à rendre : pas de dépôt, ou pas
 * de git. Un hook n'a pas à distinguer les deux, il n'a rien à faire dans
 * l'un comme dans l'autre.
 *
 * @param {string} cwd dossier de travail
 * @returns {string|null} chemin absolu de la racine, ou null
 */
export function repoRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}
