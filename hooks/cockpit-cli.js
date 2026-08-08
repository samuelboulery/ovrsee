#!/usr/bin/env node
/**
 * Filet de secours en ligne de commande, pour quand les hooks n'ont pas
 * tourné — session sans hook installé, plan approuvé hors dépôt, machine
 * d'appoint.
 *
 *   node hooks/cockpit-cli.js status
 *   node hooks/cockpit-cli.js close
 *   node hooks/cockpit-cli.js capture <fichier-de-plan.md>
 *
 * Contrairement aux hooks, cet outil est invoqué explicitement : il a le droit
 * d'échouer bruyamment.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  readPlans,
  backlog,
  history,
  serializePlan,
  planFileName,
  writeFileNoFollow,
  closeOpenPlans,
} from './plans.js'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const cockpitDir = join(root, 'cockpit')

const commands = {
  status() {
    const plans = readPlans(cockpitDir)
    const open = backlog(plans)
    const closed = history(plans)

    console.log(`${plans.length} plan(s) — ${open.length} ouvert(s), ${closed.length} clos`)
    for (const p of open) {
      const n = (p.meta.commits ?? []).length
      console.log(`  ouvert  ${p.meta.opened}  ${p.meta.title}  (${n} commit(s))`)
    }
    for (const p of closed.slice(0, 5)) {
      console.log(`  clos    ${p.meta.closed}  ${p.meta.title}`)
    }

    const pointer = join(cockpitDir, '.active-plan')
    console.log(
      existsSync(pointer) ? `actif : ${readFileSync(pointer, 'utf8').trim()}` : 'aucun plan actif',
    )
  },

  close() {
    const closed = closeOpenPlans(cockpitDir, console.error)
    if (closed.length === 0) {
      console.log('aucun plan ouvert portant un commit — rien à clore')
      return
    }
    for (const file of closed) console.log(`clos : ${file}`)
  },

  capture(path) {
    if (!path) throw new Error('usage : cockpit-cli.js capture <fichier-de-plan.md>')

    // Même règle que le hook automatique : ouvrir un plan ferme le précédent.
    for (const file of closeOpenPlans(cockpitDir, console.error)) {
      console.log(`clos : ${file}`)
    }

    const text = readFileSync(path, 'utf8')
    const title = /^#{1,3}\s+(.*\S)/m.exec(text)?.[1]?.trim() ?? 'Plan sans titre'
    const now = new Date()
    const file = planFileName(title, now)

    const meta = {
      status: 'open',
      title,
      opened: now.toISOString().slice(0, 10),
      closed: null,
      commits: [],
    }
    writeFileNoFollow(join(cockpitDir, 'plans', file), serializePlan(meta, text))
    writeFileNoFollow(join(cockpitDir, '.active-plan'), file + '\n')
    console.log(`capturé : cockpit/plans/${file}`)
  },
}

const [command, ...rest] = process.argv.slice(2)
const run = commands[command]

if (!run) {
  console.error(`commandes : ${Object.keys(commands).join(', ')}`)
  process.exit(1)
}
run(...rest)
