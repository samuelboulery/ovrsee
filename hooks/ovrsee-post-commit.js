#!/usr/bin/env node
/**
 * Hook git post-commit : rattache le commit au plan actif, puis déclenche le
 * crawl en arrière-plan — mais seulement si le commit a touché du code.
 *
 * Ce qui relie l'historique à la carte des pages, ce sont les fichiers : un
 * plan touche des fichiers, et ces fichiers appartiennent à des pages.
 *
 * Exit 0 TOUJOURS. Un hook post-commit qui échoue ne doit ni faire échouer un
 * commit déjà écrit, ni faire attendre l'utilisateur.
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachCommitToPlan, isSafePlanFileName } from './plans.js'
import { avancerTicketsClos, colonneFinale, readBoard, readTickets, moveTicket } from './tickets.js'
import { readSettings, mergeSettings } from './settings.js'
import { syncGitignore } from './gitignore-sync.js'
import { readJson } from './snapshot.js'

const HERE = dirname(fileURLToPath(import.meta.url))

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/**
 * Sorties reconstruites à chaque commit. Ce ne sont pas des sources : les
 * garder ferait apparaître tous les plans comme touchant toutes les pages, et
 * la relation plan → fichiers → page ne voudrait plus rien dire.
 */
const DERIVED = ['ovrsee/', 'graphify-out/']

/** Fichiers sources du dernier commit. */
function changedFiles(root) {
  try {
    return git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], root)
      .split('\n')
      .filter(f => f && !DERIVED.some(prefix => f.startsWith(prefix)))
  } catch {
    return []
  }
}

/**
 * Ce commit vaut-il un crawl ?
 *
 * `changedFiles()` a déjà retiré `ovrsee/` et `graphify-out/` : une liste vide
 * veut donc dire « ce commit n'a touché que des sorties ». Photographier une
 * application qui n'a pas bougé produit une fournée de captures, laquelle
 * demande un commit, lequel relance un crawl — l'arbre de travail ne redevient
 * alors jamais propre. Constaté le 9 août 2026 : trois commits d'affilée, vingt
 * et une captures, zéro pixel de différence.
 *
 * Une lecture git en échec rend aussi une liste vide, et ne déclenche donc rien.
 * C'est voulu : si on ne sait pas ce qui a changé, on ne dépense pas plusieurs
 * minutes de navigateur là-dessus, et le prochain commit de code le fera.
 *
 * @param {string[]} sources fichiers sources du dernier commit
 */
export const crawlUtile = sources => Array.isArray(sources) && sources.length > 0

function attachCommit(ovrseeDir, root, sources) {
  const pointer = join(ovrseeDir, '.active-plan')
  if (!existsSync(pointer)) return null

  // Le pointeur est écrit par nous et ne contient qu'un nom de fichier, mais
  // c'est la seule valeur relue du disque puis réinjectée dans un chemin : on
  // la valide avant de la recoller.
  const file = readFileSync(pointer, 'utf8').trim()
  if (!isSafePlanFileName(file)) return null

  const commit = {
    sha: git(['rev-parse', '--short', 'HEAD'], root),
    date: git(['log', '-1', '--format=%cs'], root),
    files: sources,
  }

  // La règle — plan clos, sha déjà là — vit dans plans.js : elle décide de ce
  // que l'historique raconte, et enfouie ici elle ne se vérifierait qu'en
  // committant pour de vrai.
  return attachCommitToPlan(ovrseeDir, file, commit) ? file : null
}

/**
 * Avance vers la colonne finale les tickets liés à ce plan, s'ils n'y sont
 * pas déjà — par ordre du board, pas par un statut dédié.
 *
 * Un commit est le signal qu'un travail est passé la relecture : que le
 * ticket vienne de « revue » (cas nominal, `ovrsee-tool-stop.js` l'y a mis) ou
 * soit resté en « en cours » (board sans colonne `revue`), le commit le
 * pousse en une fois vers la finale. `en-cours` lui-même est atteint plus tôt,
 * à la première édition sous le plan actif (`ovrsee-tool-edit.js`) — ce hook
 * n'a donc plus à s'en charger.
 *
 * Idempotent à dessein : appelé à chaque commit du plan, pas seulement au
 * dernier. Un ticket déjà en finale n'est jamais retouché — l'avancée
 * manuelle d'un ticket reste toujours plus vraie que cette règle automatique.
 *
 * Silencieuse si le board n'a qu'une seule colonne (`colonneFinale` rend déjà
 * `null`) : un board reconfiguré sans colonne terminale ne doit jamais faire
 * échouer un commit.
 */
export function avancerTicketsDuPlan(ovrseeDir, planFile) {
  const colonnes = readBoard(ovrseeDir)
  const finale = colonneFinale(colonnes)
  if (!finale) return

  for (const ticket of readTickets(ovrseeDir, colonnes)) {
    if (ticket.meta.plan !== planFile || ticket.meta.colonne === finale) continue

    try {
      moveTicket(ovrseeDir, ticket.file, finale)
    } catch {
      // Un ticket qui ne peut pas être déplacé ne doit jamais faire échouer le commit.
    }
  }
}

/**
 * Lance le crawl détaché : un commit ne doit jamais attendre le démarrage
 * d'une application et d'un navigateur.
 */
function spawnCrawl(root) {
  const crawler = join(HERE, '..', 'crawl', 'index.js')
  if (!existsSync(crawler) || !existsSync(join(root, 'ovrsee.config.json'))) return

  const child = spawn(process.execPath, [crawler], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook.
 *
 * Sans cette garde, l'importer pour en éprouver une décision lancerait un
 * crawl — c'est-à-dire une application et un navigateur — à chaque `pnpm test`.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = git(['rev-parse', '--show-toplevel'], process.cwd())
    const ovrseeDir = join(root, 'ovrsee')

    if (existsSync(ovrseeDir)) {
      const projectConfig = readJson(join(root, 'ovrsee.config.json')) ?? {}
      syncGitignore(root, mergeSettings(readSettings(), projectConfig))

      const sources = changedFiles(root)
      const file = attachCommit(ovrseeDir, root, sources)
      if (file) {
        process.stdout.write(`[ovrsee] commit rattaché à ${file}\n`)
        avancerTicketsDuPlan(ovrseeDir, file)
      }
      // Filet à chaque commit : rattrape un ticket resté en retard, quelle
      // que soit la raison (CLI qui aurait oublié d'avancer, dérive passée).
      avancerTicketsClos(ovrseeDir)
      if (crawlUtile(sources)) spawnCrawl(root)
    }
  } catch (err) {
    process.stderr.write(`[ovrsee] post-commit ignoré : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
