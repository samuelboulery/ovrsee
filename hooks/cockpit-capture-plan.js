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
 *   stdin  {"tool_name":"ExitPlanMode","tool_input":{"plan":"# Titre\n..."},"cwd":"/chemin"}
 *   effets <repo>/cockpit/plans/<date>-<slug>.md   (status: open)
 *          <repo>/cockpit/.active-plan
 *          ~/.claude/cockpit/projects.json
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

import {
  serializePlan,
  planFileName,
  readPlans,
  writeFileNoFollow,
  updatePlanMeta,
} from './plans.js'

const REGISTRY = join(homedir(), '.claude', 'cockpit', 'projects.json')

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

/** Premier titre markdown du plan, à défaut sa première ligne non vide. */
function titleOf(planText) {
  for (const line of planText.split('\n')) {
    const heading = /^#{1,3}\s+(.*\S)/.exec(line)
    if (heading) return heading[1].trim()
    if (line.trim()) return line.trim().slice(0, 120)
  }
  return 'Plan sans titre'
}

/**
 * Clôt les plans encore ouverts qui portent au moins un commit.
 *
 * ponytail: un plan se ferme à l'approbation du suivant, pas au premier
 * commit — un plan est une intention, et une intention prend souvent
 * plusieurs commits. Un plan ouvert sans aucun commit n'est pas clos : c'est
 * du backlog, il a été approuvé puis abandonné. Si les plans s'empilent,
 * basculer sur une clôture explicite via `/cockpit close`.
 */
function closePreviousPlans(cockpitDir) {
  for (const plan of readPlans(cockpitDir)) {
    const commits = plan.meta.commits ?? []
    if (plan.meta.status !== 'open' || commits.length === 0) continue

    updatePlanMeta(cockpitDir, plan.file, meta => {
      // Un plan clos sans date de clôture serait incohérent, et il se
      // trierait n'importe où dans la chronologie. Mieux vaut le laisser
      // ouvert que d'écrire une clôture sans date.
      const closed = commits.at(-1)?.date
      if (!closed) {
        process.stderr.write(`[cockpit] ${plan.file} : dernier commit sans date, laissé ouvert\n`)
        return null
      }
      return { ...meta, status: 'closed', closed }
    })
  }
}

/** Enregistre le projet pour la barre latérale multi-projets. */
function registerProject(root) {
  let projects = []
  try {
    const parsed = JSON.parse(readFileSync(REGISTRY, 'utf8'))
    if (Array.isArray(parsed)) projects = parsed
  } catch {
    // Registre absent ou corrompu : on repart d'une liste vide plutôt que
    // d'abandonner la capture.
  }

  if (projects.some(p => p?.path === root)) return

  projects.push({ path: root, name: basename(root) })
  writeFileNoFollow(REGISTRY, JSON.stringify(projects, null, 2) + '\n')
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

  const planText = payload?.tool_input?.plan
  if (typeof planText !== 'string' || !planText.trim()) return

  const root = repoRoot(payload.cwd || process.cwd())
  if (!root) return // Hors dépôt git : rien à capturer, sortie silencieuse.

  const cockpitDir = join(root, 'cockpit')
  closePreviousPlans(cockpitDir)

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

  writeFileNoFollow(join(cockpitDir, 'plans', file), serializePlan(meta, planText))
  writeFileNoFollow(join(cockpitDir, '.active-plan'), file + '\n')
  registerProject(root)

  process.stdout.write(`[cockpit] plan capturé : cockpit/plans/${file}\n`)
}

try {
  main()
} catch (err) {
  // Dernier filet : on signale, on ne bloque jamais.
  process.stderr.write(`[cockpit] capture ignorée : ${err?.message ?? err}\n`)
}
process.exit(0)
