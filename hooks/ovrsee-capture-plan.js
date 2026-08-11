#!/usr/bin/env node
/**
 * Hook PostToolUse, matcher `ExitPlanMode` : capture un plan au moment où il
 * est approuvé.
 *
 * C'est le seul contenu périssable du système. Le raisonnement derrière une
 * décision n'existe que dans le fil d'une conversation qui disparaît ; s'il
 * n'est pas écrit ici, il ne se récupère jamais.
 *
 * Contrat (calqué sur pnpm-guard.js) : JSON sur stdin, exit 0 TOUJOURS. Un
 * échec de capture ne doit jamais casser une session de travail.
 *
 *   stdin  {"tool_name":"ExitPlanMode","tool_input":{},"cwd":"/chemin"}
 *          `tool_input.plan` n'est plus garanti — voir `planFrom`.
 *   effets <repo>/ovrsee/plans/<date>-<slug>.md   (status: open)
 *          <repo>/ovrsee/.active-plan
 *          ~/.claude/ovrsee/projects.json
 *   stdout {"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"..."}}
 *          Jamais `decision: "block"` : le hook signale, il ne fait jamais
 *          échouer l'outil. `additionalContext` pousse Claude à décomposer le
 *          plan en tickets dans le même tour, sans le bloquer.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  serializePlan,
  planFileName,
  writeFileNoFollow,
  closeOpenPlans,
  registerProject,
} from './plans.js'
import { clearActiveTicket, avancerTicketsClos } from './tickets.js'

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

/** Là où Claude Code écrit le plan avant de demander son approbation. */
const PLAN_DIR = join(homedir(), '.claude', 'plans')

/** Un plan écrit il y a plus longtemps n'est pas celui qu'on vient d'approuver. */
const FRESH_MS = 10 * 60 * 1000

const readOrNull = path => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * Le texte du plan approuvé, quel que soit l'endroit où il se trouve.
 *
 * Claude Code 2.1.226 retire `plan` et `planFilePath` de l'entrée d'ExitPlanMode
 * avant d'exécuter l'outil — le plan vit maintenant dans un fichier, et le
 * transmettre deux fois n'aurait plus de sens de son point de vue. Du nôtre,
 * la capture s'est arrêtée sans rien dire : six plans approuvés le 8 août 2026,
 * deux fichiers écrits. C'est exactement la panne que ce hook existe pour ne
 * pas avoir — un raisonnement perdu ne se retrouve jamais.
 *
 * On lit donc le champ s'il est encore là, le chemin s'il est fourni, et à
 * défaut le fichier de plan le plus récemment écrit. Ce dernier repli est une
 * heuristique : deux plans approuvés dans la même minute depuis deux sessions
 * se confondraient. La fenêtre de fraîcheur borne le risque, et un plan capturé
 * de travers se voit — un plan jamais capturé, non.
 */
function planFrom(payload, now = Date.now()) {
  const inline = payload?.tool_input?.plan
  if (typeof inline === 'string' && inline.trim()) return inline

  const named = payload?.tool_input?.planFilePath
  if (typeof named === 'string' && named.trim()) {
    const body = readOrNull(named)
    if (body?.trim()) return body
  }

  let best = null
  try {
    for (const name of readdirSync(PLAN_DIR)) {
      if (!name.endsWith('.md')) continue
      const path = join(PLAN_DIR, name)
      const at = statSync(path).mtimeMs
      if (now - at > FRESH_MS) continue
      if (!best || at > best.at) best = { path, at }
    }
  } catch {
    return null // Pas de dossier de plans : rien à repêcher.
  }

  const body = best ? readOrNull(best.path) : null
  return body?.trim() ? body : null
}

/** Premier titre markdown du plan, à défaut sa première ligne non vide. */
function titleOf(planText) {
  for (const line of planText.split('\n')) {
    const heading = /^#{1,3}\s+(.*\S)/.exec(line)
    if (heading) return heading[1].trim()
    if (line.trim()) return line.trim().slice(0, 120)
  }
  return 'Plan sans titre'
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

  const planText = planFrom(payload)
  if (!planText) return

  const root = repoRoot(payload.cwd || process.cwd())
  if (!root) return // Hors dépôt git : rien à capturer, sortie silencieuse.

  const ovrseeDir = join(root, 'ovrsee')
  closeOpenPlans(ovrseeDir, message => process.stderr.write(`[ovrsee] ${message}\n`))
  avancerTicketsClos(ovrseeDir)

  const title = titleOf(planText)
  const now = new Date()
  const file = planFileName(title, now)
  const meta = {
    status: 'open',
    title,
    opened: now.toISOString().slice(0, 10),
    closed: null,
    commits: [],
  }

  writeFileNoFollow(join(ovrseeDir, 'plans', file), serializePlan(meta, planText))
  writeFileNoFollow(join(ovrseeDir, '.active-plan'), file + '\n')
  clearActiveTicket(ovrseeDir) // un plan qui démarre éclipse tout ticket ad hoc en cours
  registerProject(root)

  // additionalContext plutôt qu'un simple message : le hook ne doit jamais
  // bloquer l'outil (exit 0 toujours), mais peut pousser Claude à agir dans
  // le même tour sans attendre qu'on le lui demande.
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[ovrsee] Plan capturé : ovrsee/plans/${file}. Décompose-le maintenant en tickets via le skill ovrsee-tickets — priorité et charge (xs–xl) pour chacun, champ plan renseigné sur ${file}. Un plan simple peut ne produire qu'un seul ticket : ne pas forcer le découpage.`,
      },
    }),
  )
}

/**
 * Le corps ne tourne que si le fichier est lancé comme hook.
 *
 * Sans cette garde, l'importer pour en éprouver une décision (`planFrom`,
 * `titleOf`) lirait stdin et écrirait des fichiers à chaque `pnpm test`.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    // Dernier filet : on signale, on ne bloque jamais.
    process.stderr.write(`[ovrsee] capture ignorée : ${err?.message ?? err}\n`)
  }
  process.exit(0)
}
