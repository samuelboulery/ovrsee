#!/usr/bin/env node
/**
 * Hook PreToolUse, matcher `Edit|Write` : bloque la première édition d'un
 * fichier source sous un plan actif tant qu'aucun ticket n'y est lié.
 *
 * Avant ce hook, rien n'empêchait de commencer à éditer du code sous un plan
 * actif sans ticket : `ovrsee-capture-plan.js` ne fait que suggérer d'en créer
 * un (`additionalContext`, jamais bloquant), et `ovrsee-tool-edit.js`
 * (PostToolUse) fait avancer un ticket déjà lié — silencieux si aucun
 * n'existe. Le ticket se créait après coup, jamais avant. Calqué sur
 * `~/.claude/hooks/pnpm-guard.js` : `exit 2` + message sur stderr bloque
 * l'appel d'outil et renvoie le message au modèle.
 *
 *   stdin  {"tool_name":"Edit","tool_input":{"file_path":"/chemin/fichier"},"cwd":"/chemin"}
 *   effets aucun — lecture seule. Bloque (exit 2) ou laisse passer (exit 0).
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { colonneFinale, readActiveTicket, readBoard, readTickets } from './tickets.js'
import { isSafePlanFileName } from './plans.js'
import { estUneEditionSource } from './ovrsee-tool-edit.js'

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
 * Un plan actif a-t-il encore aucun ticket qui le cite ?
 *
 * Un board illisible (`board.json` corrompu) retombe sur les colonnes par
 * défaut — `readBoard` s'en charge déjà — et un dossier `tickets/` absent
 * donne une liste vide plutôt qu'une exception : ce hook ne doit jamais
 * planter sur un état de disque inattendu, seulement bloquer une édition
 * légitimement sans ticket.
 *
 * @param {string} ovrseeDir
 * @param {string} planFile
 * @returns {boolean}
 */
export function ticketManquant(ovrseeDir, planFile) {
  const colonnes = readBoard(ovrseeDir)
  const tickets = readTickets(ovrseeDir, colonnes)
  return !tickets.some(t => t.meta.plan === planFile)
}

/**
 * Le ticket actif (`.active-ticket`, hors plan) existe-t-il encore et est-il
 * ouvert ? Absent, introuvable ou en colonne finale comptent également comme
 * manquant : dans les trois cas la sortie est la même, en créer un.
 *
 * @param {string} ovrseeDir
 * @returns {boolean}
 */
export function ticketActifManquant(ovrseeDir) {
  const id = readActiveTicket(ovrseeDir)
  if (!id) return true

  const colonnes = readBoard(ovrseeDir)
  const finale = colonneFinale(colonnes)
  const ticket = readTickets(ovrseeDir, colonnes).find(t => t.meta.id === id)
  return !ticket || ticket.meta.colonne === finale
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

  const planPointer = join(ovrseeDir, '.active-plan')
  if (existsSync(planPointer)) {
    const planFile = readFileSync(planPointer, 'utf8').trim()
    if (!isSafePlanFileName(planFile)) return

    if (ticketManquant(ovrseeDir, planFile)) {
      process.stderr.write(
        `Bloqué : le plan actif (ovrsee/plans/${planFile}) n'a encore aucun ticket lié.\n` +
          `Crée-le d'abord — skill ovrsee-tickets, ou MCP createTicket avec plan: "${planFile}" —\n` +
          `avant d'éditer du code sous ce plan.\n`,
      )
      process.exit(2) // 2 = block the tool call, stderr goes back to the model
    }
    return // Plan actif et ticket lié : rien d'autre à imposer.
  }

  // Pas de plan actif : un ticket actif hors-plan (`.active-ticket`) doit
  // couvrir cette édition, sinon rien ne trace ce travail.
  if (ticketActifManquant(ovrseeDir)) {
    process.stderr.write(
      `Bloqué : ni plan actif ni ticket actif.\n` +
        `Crée un ticket — skill ovrsee-tickets, ou MCP createTicket — avant d'éditer du code.\n`,
    )
    process.exit(2)
  }
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook.
 *
 * Sans cette garde, l'importer pour éprouver `ticketManquant` lirait stdin et
 * appellerait `process.exit` à chaque `pnpm test`.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    // Dernier filet : une erreur interne ne doit jamais bloquer une édition légitime.
    process.stderr.write(`[ovrsee] gate ignorée : ${err?.message ?? err}\n`)
    process.exit(0)
  }
  process.exit(0)
}
