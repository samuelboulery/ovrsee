/**
 * Détecte le gestionnaire de paquets utilisé par un projet.
 *
 * Deux sources, dans cet ordre : le champ `packageManager` de `package.json`,
 * qui est la réponse **déclarée** — c'est ce que lit Corepack — puis, à défaut,
 * la présence des lockfiles.
 *
 * L'ordre compte : un dépôt fraîchement cloné n'a pas encore de lockfile mais
 * porte déjà sa déclaration, et un projet qui traîne deux lockfiles n'est
 * ambigu que pour le reniflage.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MANAGERS = ['pnpm', 'npm', 'yarn', 'bun']

const LOCKFILES = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'package-lock.json', manager: 'npm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'bun.lockb', manager: 'bun' },
]

/**
 * Le nom déclaré par `packageManager`, ou `null`.
 *
 * La forme est `nom@version`, éventuellement suivie d'un `+sha512-…`. Un
 * `package.json` absent, illisible ou mal formé ne lève pas : c'est une
 * source parmi deux, pas une frontière du système.
 *
 * @param {string} projectRoot chemin racine du projet
 * @returns {string|null} 'pnpm', 'npm', 'yarn', 'bun', ou null
 */
function declared(projectRoot) {
  try {
    const raw = readFileSync(join(projectRoot, 'package.json'), 'utf8')
    const champ = JSON.parse(raw).packageManager
    if (typeof champ !== 'string') return null
    const nom = champ.split('@')[0]
    return MANAGERS.includes(nom) ? nom : null
  } catch {
    return null
  }
}

/**
 * Détecte le gestionnaire de paquets du projet.
 *
 * En repli sur les lockfiles : n'en retourne un que s'il n'y a pas
 * d'ambiguïté. Zéro ou plusieurs, c'est le défaut.
 *
 * @param {string} projectRoot chemin racine du projet
 * @param {string} [defaultManager='pnpm'] défaut en cas de doute
 * @returns {string} 'pnpm', 'npm', 'yarn', ou 'bun'
 */
export function detectPackageManager(projectRoot, defaultManager = 'pnpm') {
  const declare = declared(projectRoot)
  if (declare) return declare

  const found = LOCKFILES.filter(({ file }) => existsSync(join(projectRoot, file)))
  if (found.length === 1) return found[0].manager

  return defaultManager
}
