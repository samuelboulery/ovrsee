/**
 * Le brief réinjecté au démarrage d'une session Claude Code.
 *
 * C'est la boucle inverse du cockpit : jusqu'ici il servait à ce que Sam
 * relise son projet ; ici il sert à ce que Claude Code le connaisse déjà.
 *
 * Contrainte gouvernante : ce texte est payé à CHAQUE session, sur chaque
 * projet. Un brief verbeux serait le piège des changelogs générés — illisible,
 * donc ignoré, donc inutile. On dit peu, et on dit où lire le reste.
 *
 * Module pur côté rédaction : `buildBrief` ne touche pas au disque.
 */

import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { readPlans } from './plans.js'
import { colonneFinale, readBoard, readTickets, sortTickets } from './tickets.js'

// Les plans manipulés ici sont APLATIS (`{status, title, …}`), pas emboîtés
// dans `meta` comme ceux que rend readPlans : un brief se lit mieux ainsi.
// Les filtres sont donc locaux plutôt qu'empruntés à plans.js, qui travaille
// sur l'autre forme.
const openPlans = plans =>
  plans
    .filter(p => p?.status === 'open')
    .sort((a, b) => String(b.opened ?? '').localeCompare(String(a.opened ?? '')))

const closedPlans = plans =>
  plans
    .filter(p => p?.status === 'closed')
    .sort((a, b) => String(b.closed ?? '').localeCompare(String(a.closed ?? '')))

/** Nombre de plans ouverts listés nommément avant de basculer sur un total. */
const MAX_LISTED = 5

const readJson = path => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Lit l'état d'un dépôt.
 * @param {string} root racine du dépôt
 * @returns {{name: string, plans: Array, pageCount: number, scan: object|null}|null}
 *   null si le dépôt n'a pas de cockpit — il n'y a alors rien à dire.
 */
export function readCockpit(root) {
  const cockpitDir = join(root, 'cockpit')
  // L'existence du dossier fait foi, pas la lisibilité de son contenu : un
  // pages.json corrompu est un cockpit abîmé, pas un dépôt sans cockpit.
  if (!existsSync(cockpitDir)) return null

  const plans = readPlans(cockpitDir)
  const pages = readJson(join(cockpitDir, 'pages', 'pages.json'))

  let scans = []
  try {
    scans = readFileSync(join(cockpitDir, 'pages', 'scans.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap(line => {
        try {
          return [JSON.parse(line)]
        } catch {
          return []
        }
      })
  } catch {
    scans = []
  }

  const board = readBoard(cockpitDir)

  return {
    name: basename(root),
    plans: plans.map(p => ({ file: p.file, ...p.meta, body: p.body })),
    pageCount: Array.isArray(pages?.pages) ? pages.pages.length : 0,
    scan: scans.at(-1) ?? null,
    board,
    tickets: sortTickets(readTickets(cockpitDir, board)).map(t => ({ file: t.file, ...t.meta })),
  }
}

const MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

function frDate(date) {
  if (!date) return '—'
  const [y, m, d] = String(date).split('-').map(Number)
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : String(date)
}

function age(date, now) {
  const at = Date.parse(date)
  if (Number.isNaN(at)) return ''
  const days = Math.floor((now.getTime() - at) / 86_400_000)
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 31) return `il y a ${Math.max(1, Math.floor(days / 7))} sem.`
  return `il y a ${Math.floor(days / 30)} mois`
}

/** Première phrase de l'intention d'un plan, sans syntaxe markdown. */
function intention(plan) {
  const body = plan.body ?? ''
  const lines = body.split('\n')
  const start = lines.findIndex(l => /^#{1,4}\s/.test(l) && /contexte|probl[eè]me|intention/i.test(l))
  const scope = start === -1 ? lines : lines.slice(start + 1)

  const paragraph = scope
    .join('\n')
    .split('\n\n')
    .map(p => p.trim())
    .find(p => p && !p.startsWith('#') && !p.startsWith('|'))

  if (!paragraph) return ''

  const flat = paragraph
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  const sentence = flat.split(/(?<=[.!?])\s/)[0] ?? flat
  return sentence.length > 200 ? sentence.slice(0, 197) + '…' : sentence
}

/**
 * @param {{name: string, plans: Array, pageCount: number, scan: object|null}} state
 * @param {Date} [now]
 * @returns {string} brief, ou chaîne vide s'il n'y a rien à dire
 */
export function buildBrief(state, now = new Date()) {
  const open = openPlans(state.plans)
  const closed = closedPlans(state.plans)
  const lines = []

  const aucunTicket = (state.tickets ?? []).length === 0
  if (state.pageCount === 0 && open.length === 0 && closed.length === 0 && !state.scan && aucunTicket) {
    return '' // Un cockpit vide : mieux vaut se taire que produire un brief creux.
  }

  lines.push(`[cockpit] ${state.name} — état lu depuis cockpit/, sans ouvrir le code.`)

  if (state.pageCount > 0) {
    lines.push(`${state.pageCount} page(s) cartographiée(s).`)
  }

  if (state.scan?.ok) {
    lines.push(`Dernier scan réussi le ${frDate(state.scan.date)} (commit ${state.scan.commit}).`)
  } else if (state.scan) {
    // L'avertissement sur la fraîcheur ne vaut que s'il existe des captures à
    // périmer. Sur un projet jamais cartographié, il ferait croire à une carte
    // dépassée là où il n'y a simplement pas de carte.
    const stale = state.pageCount > 0 ? ' Les captures sont plus anciennes que le code.' : ''
    lines.push(
      `Dernier scan ÉCHOUÉ le ${frDate(state.scan.date)} : ${state.scan.error ?? 'raison non enregistrée'}.${stale}`,
    )
  }

  const last = closed[0]
  if (last) {
    const why = intention(last)
    lines.push(`Dernier travail : « ${last.title} » (${frDate(last.closed)}).${why ? ` ${why}` : ''}`)
  }

  if (open.length > 0) {
    lines.push(`${open.length} plan(s) ouvert(s) — ce qui restait à faire :`)
    for (const plan of open.slice(0, MAX_LISTED)) {
      lines.push(`  - ${plan.title} (${age(plan.opened, now)})`)
    }
    if (open.length > MAX_LISTED) {
      lines.push(`  … et ${open.length - MAX_LISTED} autre(s), dans cockpit/plans/.`)
    }
  }

  // Le tableau, lui, dit ce qui reste à faire — les plans ouverts disent ce qui
  // a été approuvé. Les deux ne se recouvrent pas, d'où deux blocs distincts.
  const board = state.board ?? []
  const fini = colonneFinale(board)
  const titres = new Map(board.map(c => [c.id, c.titre]))
  const restants = (state.tickets ?? []).filter(t => t.colonne !== fini)

  if (restants.length > 0) {
    lines.push(`${restants.length} ticket(s) à faire — tableau dans cockpit/tickets/ :`)
    for (const ticket of restants.slice(0, MAX_LISTED)) {
      lines.push(
        `  - ${ticket.id} [${ticket.priorite}] ${ticket.titre} — ${titres.get(ticket.colonne) ?? ticket.colonne}`,
      )
    }
    if (restants.length > MAX_LISTED) {
      lines.push(`  … et ${restants.length - MAX_LISTED} autre(s).`)
    }
  }

  lines.push('Le détail — intentions, alternatives écartées, captures — est dans cockpit/.')
  return lines.join('\n')
}
