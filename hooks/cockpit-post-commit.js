#!/usr/bin/env node
/**
 * Hook git post-commit : rattache le commit au plan actif, puis déclenche le
 * crawl en arrière-plan.
 *
 * Ce qui relie l'historique à la carte des pages, ce sont les fichiers : un
 * plan touche des fichiers, et ces fichiers appartiennent à des pages.
 *
 * Exit 0 TOUJOURS. Un hook post-commit qui échoue ne doit ni faire échouer un
 * commit déjà écrit, ni faire attendre l'utilisateur.
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { updatePlanMeta, isSafePlanFileName } from './plans.js'

const HERE = dirname(fileURLToPath(import.meta.url))

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/**
 * Fichiers du dernier commit, hors `cockpit/`.
 *
 * Le cockpit s'écrit lui-même à chaque commit ; garder ses propres fichiers
 * ferait apparaître tous les plans comme touchant toutes les pages.
 */
function changedFiles(root) {
  try {
    return git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], root)
      .split('\n')
      .filter(f => f && !f.startsWith('cockpit/'))
  } catch {
    return []
  }
}

function attachCommit(cockpitDir, root) {
  const pointer = join(cockpitDir, '.active-plan')
  if (!existsSync(pointer)) return null

  // Le pointeur est écrit par nous et ne contient qu'un nom de fichier, mais
  // c'est la seule valeur relue du disque puis réinjectée dans un chemin : on
  // la valide avant de la recoller.
  const file = readFileSync(pointer, 'utf8').trim()
  if (!isSafePlanFileName(file)) return null

  const sha = git(['rev-parse', '--short', 'HEAD'], root)
  const commit = {
    sha,
    date: git(['log', '-1', '--format=%cs'], root),
    files: changedFiles(root),
  }

  const written = updatePlanMeta(cockpitDir, file, meta => {
    const commits = meta.commits ?? []
    if (commits.some(c => c.sha === sha)) return null // déjà rattaché
    return { ...meta, commits: [...commits, commit] }
  })

  return written ? file : null
}

/**
 * Lance le crawl détaché : un commit ne doit jamais attendre le démarrage
 * d'une application et d'un navigateur.
 */
function spawnCrawl(root) {
  const crawler = join(HERE, '..', 'crawl', 'index.js')
  if (!existsSync(crawler) || !existsSync(join(root, 'cockpit.config.json'))) return

  const child = spawn(process.execPath, [crawler], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

try {
  const root = git(['rev-parse', '--show-toplevel'], process.cwd())
  const cockpitDir = join(root, 'cockpit')

  if (existsSync(cockpitDir)) {
    const file = attachCommit(cockpitDir, root)
    if (file) process.stdout.write(`[cockpit] commit rattaché à ${file}\n`)
    spawnCrawl(root)
  }
} catch (err) {
  process.stderr.write(`[cockpit] post-commit ignoré : ${err?.message ?? err}\n`)
}
process.exit(0)
