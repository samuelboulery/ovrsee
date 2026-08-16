#!/usr/bin/env node
/**
 * Hook SessionEnd : la session qui se termine rend son plan et son ticket.
 *
 * Sans lui, rien ne retirait le pointeur à la fin d'une session : le plan
 * restait actif et captait le travail suivant, y compris sans rapport. C'est le
 * défaut que `pnpm ovrsee:close` demandait de compenser à la main, en se
 * souvenant de le faire.
 *
 * **Le plan n'est pas clos**, seulement lâché. Une session qui se termine ne
 * dit pas que l'intention est soldée — un `/clear` au milieu d'un travail est
 * courant. Le plan reste `open` ; il sera fermé plus tard comme orphelin, à la
 * capture du plan suivant (`closeOpenPlans`), ou par un geste explicite.
 *
 * Contrat (calqué sur les autres hooks ovrsee) : JSON sur stdin, exit 0
 * TOUJOURS. Une session qui se termine ne doit jamais échouer à se terminer.
 *
 *   stdin  {"hook_event_name":"SessionEnd","session_id":"…","cwd":"/chemin","reason":"clear"}
 *   effets <repo>/ovrsee/.active/<session>.json supprimé
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { clearActive, sessionId } from './active.js'

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

function main() {
  const raw = readStdin()
  if (!raw.trim()) return

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }

  const session = sessionId(payload)
  if (!session) return // Sans identifiant, on ne saurait pas quoi rendre.

  const root = repoRoot(payload?.cwd || process.cwd())
  if (!root) return // Hors dépôt git : rien à rendre.

  const ovrseeDir = join(root, 'ovrsee')
  if (!existsSync(ovrseeDir)) return // Projet non équipé.

  clearActive(ovrseeDir, session)
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook — sans quoi
 * l'importer lirait stdin à chaque `pnpm test`.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    // Dernier filet : on signale, on ne bloque jamais une fin de session.
    process.stderr.write(`[ovrsee] fin de session ignorée : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
