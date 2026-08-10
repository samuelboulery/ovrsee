/**
 * État git d'un dépôt : branche courante, arbre de travail, branches locales
 * et leur avance/retard sur leur remote suivie.
 *
 * Module Node pur, même contrat que `timeline.js` et `commits()` de
 * `snapshot.js` : aucune commande git ne lève, un dossier hors dépôt rend un
 * état vide plutôt qu'une exception. Aucun `git fetch` n'est lancé ici — les
 * informations sur le distant sont donc celles du dernier fetch connu, pas
 * nécessairement à jour. `lastFetch` sert à le dire honnêtement.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const git = (root, args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })

/**
 * Fichiers modifiés/indexés/non suivis, comptés depuis `--porcelain=v1`.
 *
 * Chaque ligne porte deux colonnes de statut (indexé, arbre de travail). Un
 * fichier non suivi (`??`) n'est ni l'un ni l'autre — il a sa propre case.
 */
function dirty(root) {
  const lines = git(root, ['status', '--porcelain=v1']).split('\n').filter(Boolean)
  let staged = 0
  let unstaged = 0
  let untracked = 0
  const files = []
  for (const line of lines) {
    const [index, tree] = line
    if (index === '?' && tree === '?') untracked += 1
    else {
      if (index !== ' ') staged += 1
      if (tree !== ' ') unstaged += 1
    }
    files.push(line.slice(3))
  }
  return { staged, unstaged, untracked, files }
}

/**
 * Branches locales, leur remote suivie, et l'avance/retard lu dans
 * `%(upstream:track)` — au format `[ahead N, behind M]`, partiellement
 * présent, ou vide si à jour ou sans remote.
 */
function branches(root) {
  const out = git(root, [
    'for-each-ref',
    "--format=%(refname:short)\x1f%(upstream:short)\x1f%(upstream:track)",
    'refs/heads/',
  ])
  return out
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [name, upstream, track] = line.split('\x1f')
      const ahead = Number(track.match(/ahead (\d+)/)?.[1] ?? 0)
      const behind = Number(track.match(/behind (\d+)/)?.[1] ?? 0)
      return { name, upstream: upstream || null, ahead, behind }
    })
}

/** Date du dernier `git fetch`, lue sur la mtime de `.git/FETCH_HEAD`. */
function lastFetch(root) {
  const path = join(root, '.git', 'FETCH_HEAD')
  try {
    if (!existsSync(path)) return null
    return new Date(statSync(path).mtime).toISOString()
  } catch {
    return null
  }
}

const EMPTY = { branch: null, dirty: { staged: 0, unstaged: 0, untracked: 0, files: [] }, branches: [], lastFetch: null }

export function gitStatus(root) {
  let branch
  try {
    branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  } catch {
    return EMPTY
  }

  return {
    branch: branch === 'HEAD' ? null : branch, // HEAD détaché : pas de branche à nommer
    dirty: dirty(root),
    branches: branches(root),
    lastFetch: lastFetch(root),
  }
}
