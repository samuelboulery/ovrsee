/**
 * Détecte le gestionnaire de paquets utilisé par un projet.
 *
 * Analyse la présence des lockfiles : pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb.
 * S'il y en a un seul, c'est celui-là. S'il y en a plusieurs ou aucun, retourne le défaut.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Détecte le gestionnaire de paquets depuis les lockfiles du projet.
 *
 * Préférence en cas de doute : n'en retourne un que s'il n'y a pas d'ambiguïté.
 * Un projet bien formé a un seul lockfile.
 *
 * @param {string} projectRoot chemin racine du projet
 * @param {string} [defaultManager='pnpm'] défaut en cas de doute
 * @returns {string} 'pnpm', 'npm', 'yarn', ou 'bun'
 */
export function detectPackageManager(projectRoot, defaultManager = 'pnpm') {
  const lockfiles = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'package-lock.json', manager: 'npm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'bun.lockb', manager: 'bun' },
  ]

  const found = lockfiles.filter(({ file }) => existsSync(join(projectRoot, file)))

  // Un seul lockfile : c'est lui
  if (found.length === 1) {
    return found[0].manager
  }

  // Zéro ou plusieurs : ambiguïté, retour au défaut
  return defaultManager
}
