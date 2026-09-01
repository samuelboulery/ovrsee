#!/usr/bin/env node
/**
 * Filet de secours en ligne de commande, pour quand les hooks n'ont pas
 * tourné — session sans hook installé, plan approuvé hors dépôt, machine
 * d'appoint.
 *
 *   node hooks/ovrsee-cli.js status
 *   node hooks/ovrsee-cli.js close [<plan.md>] [--commit <sha>]
 *   node hooks/ovrsee-cli.js reconcile
 *   node hooks/ovrsee-cli.js capture <fichier-de-plan.md>
 *   node hooks/ovrsee-cli.js tickets
 *   node hooks/ovrsee-cli.js ticket new "<titre>" [--colonne pret] [--epic]
 *   node hooks/ovrsee-cli.js ticket move <fichier.md> <colonne>
 *   node hooks/ovrsee-cli.js ticket link <fichier.md> --epic <T-XXXX>
 *   node hooks/ovrsee-cli.js ticket unlink <fichier.md>
 *   node hooks/ovrsee-cli.js ticket import-plans
 *
 * Contrairement aux hooks, cet outil est invoqué explicitement : il a le droit
 * d'échouer bruyamment.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  readPlans,
  plansOuverts,
  history,
  serializePlan,
  planFileName,
  writeFileNoFollow,
  closeOpenPlans,
  attachCommitToPlan,
  registerProject,
} from './plans.js'

import { exportVault } from './obsidian.js'
import { estPrincipal } from './principal.js'
import { activePlans, sessionId, writeActive } from './active.js'

import {
  avancerTicketsClos,
  colonneFinale,
  createTicket,
  importOpenPlans,
  moveTicket,
  readBoard,
  readTickets,
  sortTickets,
  updateTicket,
  childrenOf,
} from './tickets.js'
import { reconcile as reconcileCommits } from './reconcile.js'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const ovrseeDir = join(root, 'ovrsee')

/** Un appel git dans le dépôt courant. Échoue bruyamment : c'est un outil manuel. */
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

const USAGE_CLOSE = [
  'usage : ovrsee-cli.js close [<plan.md>] [--commit <sha>]',
  '',
  '  sans argument      clôt TOUS les plans ouverts portant un commit',
  '  <plan.md>          ne clôt que ce plan',
  '  --commit <sha>     rattache ce commit au plan visé avant de le clore',
].join('\n')

/**
 * Lit les arguments de `close`.
 *
 * Extrait du corps de la commande pour être testable : la première version
 * écartait le plan visé quand `--commit` était absent — `indexOf` rend -1, et
 * `-1 + 1` désigne le premier argument. Un bug d'index dans un `filter`, invisible
 * tant que la commande n'avait qu'un seul plan à clore.
 *
 * @param {string[]} rest
 * @returns {{aide: boolean, cible: string|null, sha: string|null}}
 */
export function argumentsClose(rest) {
  if (rest.includes('--help') || rest.includes('-h')) return { aide: true, cible: null, sha: null }

  const drapeau = rest.indexOf('--commit')
  const sha = drapeau === -1 ? null : (rest[drapeau + 1] ?? null)
  if (drapeau !== -1 && !sha) throw new Error(USAGE_CLOSE)

  const valeur = drapeau === -1 ? -1 : drapeau + 1
  const cible = rest.filter((arg, i) => !arg.startsWith('--') && i !== valeur)[0] ?? null
  if (sha && !cible) throw new Error('--commit exige le plan à rattacher\n' + USAGE_CLOSE)

  return { aide: false, cible, sha }
}

const commands = {
  status() {
    const plans = readPlans(ovrseeDir)
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

    // Tous les plans actifs, pas seulement celui de cette invocation : le CLI
    // n'appartient à aucune session, et dire « le » plan actif serait faux dès
    // que deux sessions travaillent en même temps.
    const actifs = activePlans(ovrseeDir)
    if (actifs.length === 0) console.log('aucun plan actif')
    else for (const file of actifs) console.log(`actif : ${file}`)

    // Afficher les épics avec leurs enfants
    const colonnes = readBoard(ovrseeDir)
    const tickets = sortTickets(readTickets(ovrseeDir, colonnes))

    // Un plan ouvert sans commit est un cul-de-sac : `closeOpenPlans` refuse de
    // dater sa clôture, et il reste ouvert pour toujours en captant les commits
    // de sa session. Le lister ici est ce qui aurait rendu la panne visible
    // sans qu'on la cherche (T-0223).
    const sansCommit = open.filter(p => (p.meta.commits ?? []).length === 0)
    if (sansCommit.length > 0) {
      console.log(`\n⚠ ${sansCommit.length} plan(s) ouvert(s) sans aucun commit :`)
      for (const p of sansCommit) console.log(`  ${p.file}  ${p.meta.title}`)
      console.log('  → ovrsee:close <plan.md> --commit <sha> si un commit les a réalisés')
    }

    // Un ticket lié à un plan ouvert sans commit ne peut jamais avancer tout
    // seul : closeOpenPlans() refuse de clore un plan sans commit, et rien
    // d'autre ne fait le lien. Le signaler évite qu'il pourrisse en silence.
    const finale = colonneFinale(colonnes)
    const enRetard = tickets.filter(t => {
      if (!t.meta.plan || t.meta.colonne === finale) return false
      const plan = plans.find(p => p.file === t.meta.plan)
      return plan?.meta.status === 'open' && (plan.meta.commits ?? []).length === 0
    })
    if (enRetard.length > 0) {
      console.log(`\n⚠ ${enRetard.length} ticket(s) lié(s) à un plan sans aucun commit :`)
      for (const t of enRetard) console.log(`  ${t.meta.id}  ${t.meta.titre}  (plan: ${t.meta.plan})`)
    }

    const epics = tickets.filter(t => t.meta?.type === 'epic')

    if (epics.length > 0) {
      console.log(`\n${epics.length} epic(s)`)
      for (const epic of epics) {
        console.log(`  ${epic.meta.id}  [${epic.meta.priorite}]  ${epic.meta.titre}`)
        const enfants = childrenOf(tickets, epic.meta.id)
        for (const enfant of enfants) {
          console.log(`    └─ ${enfant.meta.id}  [${enfant.meta.priorite}]  ${enfant.meta.titre}`)
        }
      }
    }
  },

  /**
   * Clôt les plans ouverts.
   *
   *   ovrsee-cli.js close                          tous les plans ouverts
   *   ovrsee-cli.js close <plan.md>                celui-là seulement
   *   ovrsee-cli.js close <plan.md> --commit <sha> le rattache d'abord
   *
   * Sans argument, la commande reste un rouleau compresseur : deux PR mergées
   * de suite en soldent deux d'un coup. Le dire avant d'agir vaut mieux que le
   * découvrir après.
   *
   * `--commit` répare le cas qui n'avait aucun geste : un plan qu'un
   * squash-merge a laissé ouvert sans commit est inclosable — `closeOpenPlans`
   * date la clôture d'après le dernier commit, et il n'y en a pas. C'était un
   * script jetable à écrire ; c'est une option (T-0223).
   *
   * `--help` affiche cette aide **sans rien clore**. Avant, elle clôturait tout.
   */
  close(...rest) {
    const { aide, cible, sha } = argumentsClose(rest)
    if (aide) {
      console.log(USAGE_CLOSE)
      return
    }

    if (sha) {
      const court = git(['rev-parse', '--short', sha])
      const rattache = attachCommitToPlan(ovrseeDir, cible, {
        sha: court,
        date: git(['log', '-1', '--format=%cs', sha]),
        files: [],
      })
      console.log(rattache ? `rattaché : ${court} → ${cible}` : `déjà là ou plan clos : ${court}`)
    }

    if (!cible) console.log('aucun plan visé : tous les plans ouverts vont être clos')

    const closed = closeOpenPlans(ovrseeDir, console.error, cible ? { only: cible } : undefined)
    avancerTicketsClos(ovrseeDir) // les tickets liés doivent suivre la fermeture, pas seulement le hook automatique
    if (closed.length === 0) {
      console.log('aucun plan ouvert portant un commit — rien à clore')
      return
    }
    for (const file of closed) console.log(`clos : ${file}`)
  },

  /**
   * Rattrape les commits qu'aucun hook n'a vus — ceux qu'un squash-merge fait
   * sur GitHub a ramenés par un `git pull`.
   *
   * Le hook `post-merge` le fait désormais tout seul. Cette commande sert aux
   * dépôts équipés avant lui, qui ont un retard à combler sans attendre le
   * prochain pull.
   */
  reconcile() {
    const fait = reconcileCommits(ovrseeDir, root)
    if (fait.length === 0) {
      console.log('aucun commit à rattraper')
      return
    }
    for (const { sha, plans, tickets } of fait) {
      const soldes = tickets?.length ? ` — ${tickets.join(', ')} soldé(s)` : ''
      console.log(`${sha} → ${plans.join(', ')}${soldes}`)
    }
    console.log(`\n${fait.length} commit(s) rattaché(s). « close » peut maintenant les clore.`)
  },

  capture(path) {
    if (!path) throw new Error('usage : ovrsee-cli.js capture <fichier-de-plan.md>')

    // Même règle que le hook automatique : ouvrir un plan ferme le sien et ce
    // que plus aucune session ne pointe, jamais le plan d'une session voisine.
    for (const file of closeOpenPlans(ovrseeDir, console.error, { session: sessionId() })) {
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
    writeFileNoFollow(join(ovrseeDir, 'plans', file), serializePlan(meta, text))
    // `sessionId()` retombe sur CLAUDE_CODE_SESSION_ID : une capture de secours
    // lancée depuis une session Claude lui rend bien son plan, et le seau
    // partagé prend le relais quand le CLI tourne seul dans un terminal.
    writeActive(ovrseeDir, sessionId(), { plan: file })
    if (registerProject(root)) console.log(`projet enregistré : ${root}`)
    console.log(`capturé : ovrsee/plans/${file}`)
  },

  /** Le tableau, colonne par colonne. */
  tickets() {
    const colonnes = readBoard(ovrseeDir)
    const tickets = sortTickets(readTickets(ovrseeDir, colonnes))

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
   *   ticket new "<titre>" [--colonne pret] [--priorite haute] [--corps "..."] [--epic]
   *   ticket move <fichier.md> <colonne>
   *   ticket link <fichier.md> --epic <T-XXXX>
   *   ticket unlink <fichier.md>
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
        if (!args[0]) throw new Error('usage : ticket new "<titre>" [--colonne x] [--priorite haute] [--epic]')
        const { file, meta } = createTicket(ovrseeDir, {
          titre: args[0],
          colonne: flags.colonne,
          priorite: flags.priorite,
          corps: flags.corps,
          type: flags.epic ? 'epic' : undefined,
        }, new Date(), sessionId())
        const typeLabel = flags.epic ? ' (epic)' : ''
        console.log(`créé : ${meta.id} en ${meta.colonne}${typeLabel} — ovrsee/tickets/${file}`)
        return
      }

      case 'move': {
        if (!args[0] || !args[1]) throw new Error('usage : ticket move <fichier.md> <colonne>')
        if (!moveTicket(ovrseeDir, args[0], args[1], new Date(), sessionId())) {
          throw new Error(`ticket introuvable : ${args[0]}`)
        }
        console.log(`déplacé : ${args[0]} → ${args[1]}`)
        return
      }

      case 'link': {
        if (!args[0] || !flags.epic) throw new Error('usage : ticket link <fichier.md> --epic <T-XXXX>')
        if (!updateTicket(ovrseeDir, args[0], { epic: flags.epic })) {
          throw new Error(`ticket introuvable : ${args[0]}`)
        }
        console.log(`rattaché : ${args[0]} → epic ${flags.epic}`)
        return
      }

      case 'unlink': {
        if (!args[0]) throw new Error('usage : ticket unlink <fichier.md>')
        if (!updateTicket(ovrseeDir, args[0], { epic: null })) {
          throw new Error(`ticket introuvable : ${args[0]}`)
        }
        console.log(`détaché : ${args[0]}`)
        return
      }

      case 'import-plans': {
        const cree = importOpenPlans(ovrseeDir)
        if (cree.length === 0) {
          console.log('aucun plan ouvert à reprendre — rien à faire')
          return
        }
        for (const t of cree) console.log(`repris : ${t.meta.id} ${t.meta.titre} (${t.meta.colonne})`)
        return
      }

      default:
        throw new Error('sous-commandes : new, move, link, unlink, import-plans')
    }
  },

  /**
   * Écrit le coffre Obsidian du projet.
   *
   *   ovrsee-cli.js obsidian [--dir <chemin>]
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

/**
 * Le dispatch ne tourne que si le fichier est lancé comme outil.
 *
 * Sans cette garde, l'importer pour éprouver `argumentsClose` exécuterait une
 * commande avec l'`argv` du lanceur de tests — et sortirait en code 1.
 */
if (estPrincipal(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2)
  const run = commands[command]

  if (!run) {
    console.error(`commandes : ${Object.keys(commands).join(', ')}`)
    process.exit(1)
  }
  run(...rest)
}
