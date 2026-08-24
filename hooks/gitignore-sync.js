/**
 * Applique les réglages `gitignoreShots` / `gitignorePlans` au `.gitignore`
 * du projet, et y garantit le bloc de l'état de session.
 *
 * Des blocs à contenu fixe, gérés indépendamment les uns des autres et du reste
 * du fichier : on retire le bloc existant (match exact sur son contenu), puis
 * on le ré-ajoute seulement si le réglage correspondant est actif. Le fichier
 * n'est réécrit que si son contenu a changé, pour ne pas produire de bruit de
 * mtime à chaque commit.
 *
 * Le bloc `.active/` ne dépend d'aucun réglage : cet état est local par nature,
 * et le versionner n'est jamais un choix légitime.
 *
 * Exception : un dépôt qui ignore `ovrsee/` en entier n'a besoin d'aucun bloc.
 * Les ré-écrire reviendrait à salir son `.gitignore` à chaque commit avec des
 * motifs déjà couverts.
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
 * L'état de travail des sessions Claude : quel plan et quel ticket chacune
 * tient. Local à une machine et à un instant — versionné, il produit un conflit
 * à chaque changement de branche pour une information que personne ne relit.
 * Les deux dernières lignes sont les pointeurs d'avant les sessions, encore
 * présents sur les dépôts qui n'ont pas encore migré.
 */
const BLOC_ACTIF =
  `\n# État de travail des sessions Claude (ovrsee) : local à une machine, jamais\n` +
  `# versionné.\n` +
  `ovrsee/.active/\n` +
  `ovrsee/.active-plan\n` +
  `ovrsee/.active-ticket\n`

/**
 * @param {string} root racine du dépôt
 * @param {{gitignoreShots?: boolean, gitignorePlans?: boolean}} settings
 */
export function syncGitignore(root, settings) {
  const path = join(root, '.gitignore')
  const original = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const ovrseeEntierementIgnore = original
    .split('\n')
    .some(ligne => /^\/?ovrsee\/?$/.test(ligne.trim()))

  let next = original.split(BLOC_SHOTS).join('')
  next = next.split(BLOC_PLANS).join('')
  next = next.split(BLOC_ACTIF).join('')

  if (!ovrseeEntierementIgnore) {
    if (settings?.gitignoreShots) next += BLOC_SHOTS
    if (settings?.gitignorePlans) next += BLOC_PLANS
    next += BLOC_ACTIF
  }

  if (next !== original) writeFileSync(path, next, 'utf8')
}
