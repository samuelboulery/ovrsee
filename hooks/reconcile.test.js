/**
 * Le rattrapage des commits qu'aucun hook n'a vus.
 *
 * Le cas qui a produit ce code : la PR #22 de ce dépôt, squash-mergée sur
 * GitHub, a laissé cinq plans ouverts avec zéro commit — son commit est né sur
 * les serveurs de GitHub, où aucun hook ne tourne.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { plansPourMessage, reconcile, ticketsCites } from './reconcile.js'

// --- lecture d'un message --------------------------------------------------

test('un intervalle désigne tous les tickets, pas ses deux bornes', () => {
  // La forme exacte des titres de fusion de ce dépôt.
  const cites = ticketsCites('feat: sortir les epics du Kanban (T-0164 → T-0179) (#22)')

  assert.equal(cites.size, 16)
  assert.ok(cites.has('T-0164'))
  assert.ok(cites.has('T-0171'), 'le milieu de l’intervalle compte autant que ses bornes')
  assert.ok(cites.has('T-0179'))
})

test('la flèche ASCII vaut la flèche typographique', () => {
  assert.deepEqual([...ticketsCites('fix: (T-0001 -> T-0003)')], ['T-0001', 'T-0003', 'T-0002'])
})

test('un intervalle absurde retombe sur ses bornes', () => {
  // À l'envers : ce n'est pas un intervalle.
  assert.deepEqual([...ticketsCites('T-0009 → T-0002')], ['T-0009', 'T-0002'])

  // Trop large pour être autre chose qu'une coïncidence de mise en forme —
  // développer inventerait des milliers de tickets.
  assert.deepEqual([...ticketsCites('T-0001 → T-9999')], ['T-0001', 'T-9999'])
})

test('un message sans ticket ne cite rien', () => {
  assert.equal(ticketsCites('chore: ménage').size, 0)
  assert.equal(ticketsCites(undefined).size, 0)
})

// --- fixture ---------------------------------------------------------------

const PLAN = (nom, statut = 'open') =>
  `---\n${JSON.stringify(
    { status: statut, title: nom, opened: '2026-01-01', closed: null, commits: [] },
    null,
    2,
  )}\n---\n\nCorps.\n`

const TICKET = (id, plan, colonne = 'en-cours') =>
  `---\n${JSON.stringify(
    {
      id,
      titre: `Ticket ${id}`,
      colonne,
      priorite: 'moyenne',
      tags: [],
      cree: '2026-01-01',
      maj: '2026-01-01',
      plan,
    },
    null,
    2,
  )}\n---\n\nCorps.\n`

/** Un dépôt git avec un `ovrsee/` peuplé, et un commit qui cite des tickets. */
function depot(message, { colonne = 'en-cours' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-reconcile-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(join(ovrseeDir, 'plans'), { recursive: true })
  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })

  writeFileSync(join(ovrseeDir, 'board.json'), JSON.stringify({
    colonnes: [
      { id: 'backlog', titre: 'Backlog' },
      { id: 'en-cours', titre: 'En cours' },
      { id: 'fait', titre: 'Fait' },
    ],
  }))

  writeFileSync(join(ovrseeDir, 'plans', 'a.md'), PLAN('Plan A'))
  writeFileSync(join(ovrseeDir, 'plans', 'b.md'), PLAN('Plan B'))
  writeFileSync(join(ovrseeDir, 'plans', 'clos.md'), PLAN('Plan clos', 'closed'))
  writeFileSync(join(ovrseeDir, 'tickets', 'T-0001-a.md'), TICKET('T-0001', 'a.md', colonne))
  writeFileSync(join(ovrseeDir, 'tickets', 'T-0002-b.md'), TICKET('T-0002', 'b.md', colonne))
  writeFileSync(join(ovrseeDir, 'tickets', 'T-0003-c.md'), TICKET('T-0003', 'clos.md', colonne))

  const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git(['init', '-q'])
  git(['config', 'user.email', 't@t'])
  git(['config', 'user.name', 't'])
  git(['add', '-A'])
  git(['commit', '-m', message])

  return { root, ovrseeDir }
}

const metaDu = (ovrseeDir, file) =>
  JSON.parse(readFileSync(join(ovrseeDir, 'plans', file), 'utf8').split('---')[1])

// --- rattrapage ------------------------------------------------------------

test('un commit qui cite deux tickets rattache leurs deux plans', () => {
  const { root, ovrseeDir } = depot('feat: le lot (T-0001 → T-0002)')

  const fait = reconcile(ovrseeDir, root)

  // C'est toute la raison d'être de ce module : `planPourCommit` n'en rendrait
  // qu'un, et l'autre plan resterait ouvert avec zéro commit.
  assert.equal(fait.length, 1)
  assert.deepEqual(fait[0].plans.sort(), ['a.md', 'b.md'])
  assert.equal(metaDu(ovrseeDir, 'a.md').commits.length, 1)
  assert.equal(metaDu(ovrseeDir, 'b.md').commits.length, 1)
})

test('un plan clos ne gagne aucun commit', () => {
  const { root, ovrseeDir } = depot('feat: touche au plan clos (T-0003)')

  assert.deepEqual(reconcile(ovrseeDir, root), [])
  assert.deepEqual(metaDu(ovrseeDir, 'clos.md').commits, [])
})

test('relancer le rattrapage ne duplique rien', () => {
  const { root, ovrseeDir } = depot('feat: le lot (T-0001)')

  reconcile(ovrseeDir, root)
  const second = reconcile(ovrseeDir, root)

  assert.deepEqual(second, [], 'le second passage ne trouve plus rien à faire')
  assert.equal(metaDu(ovrseeDir, 'a.md').commits.length, 1)
})

test('sans ticket cité, rien n’est rattaché — rien n’est deviné', () => {
  const { root, ovrseeDir } = depot('chore: ménage')

  // Un plan actif unique ferait pencher `planPourCommit` ; ici non. Au moment
  // du pull, la session courante n'a rien à voir avec le travail qui arrive.
  assert.deepEqual(reconcile(ovrseeDir, root), [])
  assert.deepEqual(metaDu(ovrseeDir, 'a.md').commits, [])
})

test('les tickets en vol suivent, ceux restés en backlog non', () => {
  const enVol = depot('feat: le lot (T-0001)')
  reconcile(enVol.ovrseeDir, enVol.root)
  const apres = JSON.parse(
    readFileSync(join(enVol.ovrseeDir, 'tickets', 'T-0001-a.md'), 'utf8').split('---')[1],
  )
  assert.equal(apres.colonne, 'fait')

  // Un commit clôt ce qu'on a fait, pas ce qu'on a prévu : la règle vient de
  // `avancerTicketsDuPlan`, et le rattrapage ne la contourne pas.
  const prevu = depot('feat: le lot (T-0001)', { colonne: 'backlog' })
  reconcile(prevu.ovrseeDir, prevu.root)
  const intact = JSON.parse(
    readFileSync(join(prevu.ovrseeDir, 'tickets', 'T-0001-a.md'), 'utf8').split('---')[1],
  )
  assert.equal(intact.colonne, 'backlog')
})

test('plansPourMessage ignore les plans clos et les tickets sans plan', () => {
  const { ovrseeDir } = depot('init')

  assert.deepEqual(plansPourMessage(ovrseeDir, 'T-0001'), ['a.md'])
  assert.deepEqual(plansPourMessage(ovrseeDir, 'T-0003'), [], 'T-0003 pointe un plan clos')
  assert.deepEqual(plansPourMessage(ovrseeDir, 'rien à citer'), [])
})
