/**
 * Applique les réglages `gitignoreShots` / `gitignorePlans` au `.gitignore`
 * du projet.
 *
 * Deux blocs à contenu fixe, gérés indépendamment l'un de l'autre et du reste
 * du fichier : on retire le bloc existant (match exact sur son contenu), puis
 * on le ré-ajoute seulement si le réglage correspondant est actif. Le fichier
 * n'est réécrit que si son contenu a changé, pour ne pas produire de bruit de
 * mtime à chaque commit.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BLOC_SHOTS =
  `\n# Captures d'écran ovrsee : régénérées à chaque commit, purge auto côté\n` +
  `# disque (30j puis 1/semaine) — inutile de les suivre dans git.\n` +
  `ovrsee/pages/shots/\n`

const BLOC_PLANS =
  `\n# Plans et tickets ovrsee : suivi de travail personnel, pas du code produit.\n` +
  `# Désactivé depuis les préférences (« Versionner les plans et tickets »).\n` +
  `ovrsee/plans/\n` +
  `ovrsee/tickets/\n`

/**
 * @param {string} root racine du dépôt
 * @param {{gitignoreShots?: boolean, gitignorePlans?: boolean}} settings
 */
export function syncGitignore(root, settings) {
  const path = join(root, '.gitignore')
  const original = existsSync(path) ? readFileSync(path, 'utf8') : ''

  let next = original.split(BLOC_SHOTS).join('')
  next = next.split(BLOC_PLANS).join('')

  if (settings?.gitignoreShots) next += BLOC_SHOTS
  if (settings?.gitignorePlans) next += BLOC_PLANS

  if (next !== original) writeFileSync(path, next, 'utf8')
}
