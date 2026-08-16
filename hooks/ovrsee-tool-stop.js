#!/usr/bin/env node
/**
 * Hook Stop : une fin de tour avec du code source non commité, sous un plan
 * actif, fait passer ses tickets en « revue » — le travail semble fini côté
 * code, en attente d'une relecture avant commit.
 *
 * Fichier séparé de `ovrsee-capture-audit.js` : celui-là reste dédié à la
 * trace d'audit (marqueur `.pending-audit`), mélanger les deux responsabilités
 * rendrait chacune plus dure à isoler.
 *
 * Se déclenche à chaque fin de tour, pas seulement à la dernière — idempotent
 * comme les autres hooks ovrsee : un ticket déjà en `revue` n'est pas retouché.
 *
 * Contrat (calqué sur les autres hooks ovrsee) : JSON sur stdin, exit 0
 * TOUJOURS. Un Stop qui échouerait casserait le tour lui-même.
 *
 *   stdin  {"hook_event_name":"Stop","cwd":"/chemin"}
 *   effets ticket(s) liés au plan actif, en `en-cours` : `colonne` → `revue`
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { EN_COURS, moveTicket, readBoard, readTickets } from './tickets.js'
import { isSafePlanFileName } from './plans.js'
import { readActive, sessionId } from './active.js'

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Racine du dépôt git contenant `cwd`, ou null.
 * execFile sans shell : `cwd` vient d'un JSON externe et ne doit jamais être
 * interprété par un shell.
 */
function repoRoot(cwd) {
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

/**
 * Y a-t-il du code non commité, en dehors de `ovrsee/` et `graphify-out/` ?
 *
 * L'exclusion est indispensable : `ovrsee/` se réécrit en continu (captures,
 * `pages.json`, tickets eux-mêmes) — sans elle, l'arbre serait toujours
 * « sale » et chaque fin de tour ferait basculer les tickets en revue, même
 * sans une ligne de code touchée.
 */
export function aDuCodeNonCommite(root) {
  try {
    const sortie = execFileSync(
      'git',
      ['status', '--porcelain', '--', '.', ':!ovrsee', ':!graphify-out'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return sortie.trim().length > 0
  } catch {
    return false // Lecture git en échec : on ne déclenche rien plutôt que de deviner.
  }
}

const REVUE = 'revue'

/**
 * Avance vers « revue » les tickets liés à ce plan et actuellement en
 * « en cours ». Ne touche à rien d'autre : un ticket pas encore commencé
 * reste où il est, un ticket déjà en revue ou plus loin n'est pas retouché.
 *
 * Silencieuse si le board n'a pas de colonne `revue` : le ticket reste en
 * `en-cours` jusqu'au commit, qui le poussera directement en finale.
 */
export function avancerTicketsEnRevue(ovrseeDir, planFile) {
  const colonnes = readBoard(ovrseeDir)
  if (!colonnes.some(c => c.id === REVUE)) return

  for (const ticket of readTickets(ovrseeDir, colonnes)) {
    if (ticket.meta.plan !== planFile || ticket.meta.colonne !== EN_COURS) continue

    try {
      moveTicket(ovrseeDir, ticket.file, REVUE)
    } catch {
      // Un ticket qui ne peut pas être déplacé ne doit jamais faire échouer le Stop.
    }
  }
}

function main() {
  const raw = readStdin()
  if (!raw.trim()) return

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }

  const root = repoRoot(payload?.cwd || process.cwd())
  if (!root) return // Hors dépôt git : rien à faire.

  const ovrseeDir = join(root, 'ovrsee')
  if (!existsSync(ovrseeDir)) return // Projet non équipé.

  // Le plan de CETTE session : la fin d'un tour ici ne dit rien du travail
  // d'une session voisine.
  const planFile = readActive(ovrseeDir, sessionId(payload)).plan
  if (!planFile) return // Pas de plan actif : rien à lier.
  if (!isSafePlanFileName(planFile)) return

  if (!aDuCodeNonCommite(root)) return

  avancerTicketsEnRevue(ovrseeDir, planFile)
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook.
 *
 * Sans cette garde, l'importer pour éprouver `avancerTicketsEnRevue` ou
 * `aDuCodeNonCommite` lirait stdin et appellerait `process.exit(0)` à chaque
 * `pnpm test`.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    // Dernier filet : on signale, on ne bloque jamais.
    process.stderr.write(`[ovrsee] avancée en-revue ignorée : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
