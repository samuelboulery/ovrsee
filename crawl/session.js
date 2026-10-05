/**
 * La session enregistrée du crawl : hors du dépôt observé (T-0275).
 *
 * Elle porte un jeton de session valide. Dans le dépôt, sa seule protection
 * était d'être ignorée par git — un `.gitignore` qu'un `git add -f`, un outil
 * de synchronisation ou une archive du dossier ne respectent pas. Classe 2 du
 * cadrage, comme `trust.json` : `~/.claude/ovrsee/auth/`, un fichier par
 * projet, nommé d'après le chemin réel du dépôt.
 */

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { git } from '../hooks/git.js'
import { fichierDuDepot } from '../hooks/json.js'
import { writeFileNoFollow } from '../hooks/plans.js'
import { cleProjet } from './confiance.js'

/** `OVRSEE_AUTH_DIR` pour les tests : jamais les sessions du poste qui les lance. */
const dossier = () => process.env.OVRSEE_AUTH_DIR ?? join(homedir(), '.claude', 'ovrsee', 'auth')

/**
 * Le fichier de session d'un projet. Une empreinte plutôt que le chemin : un
 * nom de fichier ne porte ni `/` ni la longueur d'un chemin profond.
 *
 * @param {string} root
 */
export const sessionPath = root =>
  join(dossier(), createHash('sha256').update(cleProjet(root)).digest('hex').slice(0, 32) + '.json')

/**
 * Écrit la session, lisible par son seul propriétaire.
 *
 * @param {string} root
 * @param {string} contenu
 */
export function ecrireSession(root, contenu) {
  const cible = sessionPath(root)
  writeFileNoFollow(cible, contenu, { mode: 0o600 })
}

/**
 * Déplace hors du dépôt la session qu'`auth.storageState` y désignait, une
 * fois. Ne lit qu'un fichier ordinaire du dépôt, ignoré par git — jamais un
 * lien qui sort, ni un fichier versionné, que n'importe qui aurait pu écrire.
 * L'ancien fichier reste : le supprimer serait écrire dans le dépôt.
 *
 * @param {string} root
 * @param {{auth?: {storageState?: unknown}}} config
 * @returns {boolean} vrai si une session a été déplacée
 */
export function migrerSession(root, config) {
  const rel = config?.auth?.storageState
  if (typeof rel !== 'string' || !rel || existsSync(sessionPath(root))) return false

  const ancien = fichierDuDepot(root, resolve(root, rel))
  // `check-ignore` interroge le chemin déclaré, pas sa cible : un lien interne
  // vers un `.env` versionné passerait pour une session ignorée.
  if (!ancien || lstatSync(resolve(root, rel)).isSymbolicLink()) return false
  try {
    git(root, ['check-ignore', '-q', '--', rel], { stdio: 'ignore' })
  } catch {
    return false // Versionné : ce n'est pas une session que l'utilisateur a enregistrée.
  }
  ecrireSession(root, readFileSync(ancien, 'utf8'))
  return true
}
