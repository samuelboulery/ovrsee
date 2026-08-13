#!/usr/bin/env node
/**
 * Hook PostToolUse, matcher `Edit|Write` : la première édition d'un fichier
 * source sous un plan actif fait passer ses tickets en « en cours ».
 *
 * Avant ce hook, rien ne bougeait un ticket au début du travail — il fallait
 * attendre le premier commit (`ovrsee-post-commit.js`), donc un ticket pouvait
 * rester affiché « prêt » alors que le code était déjà en chantier depuis des
 * heures. Symétrique de `avancerTicketsDuPlan` : mêmes garanties (idempotent,
 * jamais bloquant, silencieux si la colonne `en-cours` n'existe pas).
 *
 * Contrat (calqué sur les autres hooks ovrsee) : JSON sur stdin, exit 0
 * TOUJOURS. Une édition ne doit jamais échouer à cause de ce hook.
 *
 *   stdin  {"hook_event_name":"PostToolUse","tool_name":"Edit","tool_input":{"file_path":"/chemin/fichier"},"cwd":"/chemin"}
 *   effets ticket(s) liés au plan actif : `colonne` → `en-cours`
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readBoard, readTickets, moveTicket } from './tickets.js'
import { isSafePlanFileName } from './plans.js'

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
 * Sorties reconstruites par les hooks eux-mêmes. Une édition qui ne touche
 * qu'à `ovrsee/` (ce hook y compris, indirectement) ne doit jamais se
 * déclencher elle-même — sinon toute écriture de ticket ferait aussi bouger
 * ce même ticket.
 */
const DERIVED = ['ovrsee/', 'graphify-out/']

/** Le chemin édité touche-t-il autre chose que les sorties générées ? */
export function estUneEditionSource(root, filePath) {
  if (typeof filePath !== 'string' || !filePath) return false
  const abs = isAbsolute(filePath) ? filePath : resolve(root, filePath)
  // `relative` rend des `\` sous Windows ; `DERIVED` est écrit en `/`.
  // Sans cette normalisation le hook y voyait toute écriture d'`ovrsee/`
  // comme une édition de source, et chaque ticket se déplaçait lui-même.
  const rel = relative(root, abs).split(sep).join('/')
  if (rel.startsWith('..')) return false // hors du dépôt : rien à faire ici
  return !DERIVED.some(prefix => rel.startsWith(prefix))
}

const EN_COURS = 'en-cours'
const REVUE = 'revue'

/**
 * Avance vers « en cours » les tickets liés à ce plan : ceux pas encore
 * commencés (colonne avant `en-cours`), et ceux qu'on avait mis en `revue` —
 * une édition qui reprend après une relecture demandée redevient du travail
 * en cours, pas une relecture en attente.
 *
 * Ne touche jamais un ticket déjà en `en-cours` ni un ticket en colonne
 * finale ou au-delà — l'avancée manuelle reste toujours plus vraie que cette
 * règle automatique. Silencieuse si le board n'a pas de colonne `en-cours`.
 */
export function avancerTicketsEnCours(ovrseeDir, planFile) {
  const colonnes = readBoard(ovrseeDir)
  const iCible = colonnes.findIndex(c => c.id === EN_COURS)
  if (iCible === -1) return

  const rangDe = new Map(colonnes.map((c, i) => [c.id, i]))
  for (const ticket of readTickets(ovrseeDir, colonnes)) {
    if (ticket.meta.plan !== planFile) continue
    const rang = rangDe.get(ticket.meta.colonne) ?? 0
    if (rang === iCible) continue // déjà en cours
    if (rang > iCible && ticket.meta.colonne !== REVUE) continue // déjà plus loin

    try {
      moveTicket(ovrseeDir, ticket.file, EN_COURS)
    } catch {
      // Un ticket qui ne peut pas être déplacé ne doit jamais faire échouer l'édition.
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

  if (!estUneEditionSource(root, payload?.tool_input?.file_path)) return

  const pointer = join(ovrseeDir, '.active-plan')
  if (!existsSync(pointer)) return // Pas de plan actif : rien à lier.

  const planFile = readFileSync(pointer, 'utf8').trim()
  if (!isSafePlanFileName(planFile)) return

  avancerTicketsEnCours(ovrseeDir, planFile)
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook.
 *
 * Sans cette garde, l'importer pour éprouver `avancerTicketsEnCours` ou
 * `estUneEditionSource` lirait stdin et appellerait `process.exit(0)` à chaque
 * `pnpm test`.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    // Dernier filet : on signale, on ne bloque jamais.
    process.stderr.write(`[ovrsee] avancée en-cours ignorée : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
