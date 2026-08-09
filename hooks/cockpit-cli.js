#!/usr/bin/env node
/**
 * Filet de secours en ligne de commande, pour quand les hooks n'ont pas
 * tourné — session sans hook installé, plan approuvé hors dépôt, machine
 * d'appoint.
 *
 *   node hooks/cockpit-cli.js status
 *   node hooks/cockpit-cli.js close
 *   node hooks/cockpit-cli.js capture <fichier-de-plan.md>
 *   node hooks/cockpit-cli.js tickets
 *   node hooks/cockpit-cli.js ticket new "<titre>" [--colonne pret]
 *   node hooks/cockpit-cli.js ticket move <fichier.md> <colonne>
 *   node hooks/cockpit-cli.js ticket import-plans
 *
 * Contrairement aux hooks, cet outil est invoqué explicitement : il a le droit
 * d'échouer bruyamment.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  readPlans,
  plansOuverts,
  history,
  serializePlan,
  planFileName,
  writeFileNoFollow,
  closeOpenPlans,
  registerProject,
} from './plans.js'

import { exportVault } from './obsidian.js'

import {
  createTicket,
  importOpenPlans,
  moveTicket,
  readBoard,
  readTickets,
  sortTickets,
} from './tickets.js'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const cockpitDir = join(root, 'cockpit')

const commands = {
  status() {
    const plans = readPlans(cockpitDir)
    const open = plansOuverts(plans)
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
    if (registerProject(root)) console.log(`projet enregistré : ${root}`)
    console.log(`capturé : cockpit/plans/${file}`)
  },

  /** Le tableau, colonne par colonne. */
  tickets() {
    const colonnes = readBoard(cockpitDir)
    const tickets = sortTickets(readTickets(cockpitDir, colonnes))

    for (const colonne of colonnes) {
      const dedans = tickets.filter(t => t.meta.colonne === colonne.id)
      const alerte = colonne.wip && dedans.length > colonne.wip ? `  ⚠ WIP ${colonne.wip}` : ''
      console.log(`\n${colonne.titre} (${dedans.length})${alerte}`)
      for (const t of dedans) {
        console.log(`  ${t.meta.id}  [${t.meta.priorite}]  ${t.meta.titre}  — ${t.file}`)
      }
    }
  },

  /**
   * Écriture des tickets depuis la ligne de commande.
   *
   *   ticket new "<titre>" [--colonne pret] [--priorite haute] [--corps "..."]
   *   ticket move <fichier.md> <colonne>
   *   ticket import-plans
   */
  ticket(sub, ...rest) {
    const flags = {}
    const args = []
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i].startsWith('--')) {
        flags[rest[i].slice(2)] = rest[i + 1]
        i += 1
      } else {
        args.push(rest[i])
      }
    }

    switch (sub) {
      case 'new': {
        if (!args[0]) throw new Error('usage : ticket new "<titre>" [--colonne x] [--priorite haute]')
        const { file, meta } = createTicket(cockpitDir, {
          titre: args[0],
          colonne: flags.colonne,
          priorite: flags.priorite,
          corps: flags.corps,
        })
        console.log(`créé : ${meta.id} en ${meta.colonne} — cockpit/tickets/${file}`)
        return
      }

      case 'move': {
        if (!args[0] || !args[1]) throw new Error('usage : ticket move <fichier.md> <colonne>')
        if (!moveTicket(cockpitDir, args[0], args[1])) throw new Error(`ticket introuvable : ${args[0]}`)
        console.log(`déplacé : ${args[0]} → ${args[1]}`)
        return
      }

      case 'import-plans': {
        const cree = importOpenPlans(cockpitDir)
        if (cree.length === 0) {
          console.log('aucun plan ouvert à reprendre — rien à faire')
          return
        }
        for (const t of cree) console.log(`repris : ${t.meta.id} ${t.meta.titre} (${t.meta.colonne})`)
        return
      }

      default:
        throw new Error('sous-commandes : new, move, import-plans')
    }
  },

  /**
   * Écrit le coffre Obsidian du projet.
   *
   *   cockpit-cli.js obsidian [--dir <chemin>]
   *
   * Même implémentation que le bouton de l'interface : une seconde finirait par
   * diverger de celle-ci.
   */
  obsidian(...rest) {
    const flag = rest.indexOf('--dir')
    const dir = flag === -1 ? undefined : rest[flag + 1]
    if (flag !== -1 && !dir) throw new Error('usage : obsidian [--dir <chemin>]')

    for (const line of exportVault(root, dir)) console.log(line)
  },
}

const [command, ...rest] = process.argv.slice(2)
const run = commands[command]

if (!run) {
  console.error(`commandes : ${Object.keys(commands).join(', ')}`)
  process.exit(1)
}
run(...rest)
