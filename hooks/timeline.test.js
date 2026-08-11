import { test } from 'node:test'
import assert from 'node:assert/strict'

import { timeline, ticketTimeline } from './timeline.js'

const commit = (sha, date, subject) => ({ sha, date, subject })

const plan = (file, shas, extra = {}) => ({
  file,
  title: file,
  status: 'closed',
  opened: '2026-08-01',
  closed: '2026-08-08',
  commits: shas.map(sha => ({ sha })),
  ...extra,
})

const ticket = (id, maj, extra = {}) => ({
  file: `${id}.md`,
  id,
  titre: id,
  colonne: 'en-cours',
  priorite: 'moyenne',
  tags: [],
  cree: maj,
  maj,
  plan: null,
  corps: '',
  ...extra,
})

test('les commits consécutifs d’un même plan se replient en une bande', () => {
  const entries = timeline(
    [
      commit('aaa', '2026-08-08T12:00:00+02:00', 'docs: rejouer'),
      commit('bbb', '2026-08-08T11:00:00+02:00', 'fix: capturer'),
    ],
    [plan('p1.md', ['aaa', 'bbb'])],
  )

  assert.equal(entries.length, 1)
  assert.equal(entries[0].kind, 'plan')
  assert.deepEqual(
    entries[0].commits.map(c => c.sha),
    ['aaa', 'bbb'],
  )
  // La bande porte la date du commit le plus récent de la suite.
  assert.equal(entries[0].date, '2026-08-08T12:00:00+02:00')
})

test('un commit hors plan reste une entrée à lui seul', () => {
  const entries = timeline(
    [
      commit('aaa', '2026-08-08T12:00:00+02:00', 'feat: sous plan'),
      commit('zzz', '2026-08-07T09:00:00+02:00', 'feat: icône'),
    ],
    [plan('p1.md', ['aaa'])],
  )

  assert.deepEqual(
    entries.map(e => e.kind),
    ['plan', 'commit'],
  )
  assert.equal(entries[1].commit.subject, 'feat: icône')
})

test('un plan repris après un détour donne deux bandes', () => {
  const entries = timeline(
    [
      commit('ccc', '2026-08-08T12:00:00+02:00', 'suite du plan'),
      commit('zzz', '2026-08-08T11:00:00+02:00', 'correctif hors plan'),
      commit('aaa', '2026-08-08T10:00:00+02:00', 'début du plan'),
    ],
    [plan('p1.md', ['aaa', 'ccc'])],
  )

  assert.deepEqual(
    entries.map(e => e.kind),
    ['plan', 'commit', 'plan'],
  )
})

test('un plan sans commit dans le journal figure quand même, à sa date', () => {
  const entries = timeline([], [plan('vide.md', [], { status: 'open', closed: null })])

  assert.equal(entries.length, 1)
  assert.equal(entries[0].plan, 'vide.md')
  assert.equal(entries[0].date, '2026-08-01')
  assert.deepEqual(entries[0].commits, [])
})

test('sans dépôt git — aucun commit lu — les plans font toute la frise', () => {
  const entries = timeline([], [plan('a.md', ['aaa']), plan('b.md', ['bbb'])])

  assert.equal(entries.length, 2)
  assert.ok(entries.every(e => e.kind === 'plan' && e.commits.length === 0))
})

test('ticketTimeline : les tickets d’un même plan se regroupent en une seule bande', () => {
  const entries = ticketTimeline(
    [
      ticket('T-0001', '2026-08-08', { plan: 'p1.md' }),
      ticket('T-0002', '2026-08-09', { plan: 'p1.md' }),
    ],
    [plan('p1.md', [])],
  )

  assert.equal(entries.length, 1)
  assert.equal(entries[0].kind, 'plan')
  assert.deepEqual(
    entries[0].tickets.map(t => t.id),
    ['T-0002', 'T-0001'],
  )
  // La bande porte la date du ticket le plus récemment mis à jour.
  assert.equal(entries[0].date, '2026-08-09')
})

test('ticketTimeline : à égalité de jour, l’identifiant le plus élevé passe en premier', () => {
  const entries = ticketTimeline(
    [
      ticket('T-0028', '2026-08-11', { plan: 'p1.md' }),
      ticket('T-0034', '2026-08-11', { plan: 'p2.md' }),
      ticket('T-0030', '2026-08-11', { plan: null }),
    ],
    [plan('p1.md', []), plan('p2.md', [])],
  )

  // Deux bandes à égalité de date : celle du ticket le plus récemment créé
  // passe devant, et le ticket hors plan s'intercale à son rang.
  assert.deepEqual(
    entries.map(e => (e.kind === 'ticket' ? e.ticket.id : e.tickets[0].id)),
    ['T-0034', 'T-0030', 'T-0028'],
  )
})

test('ticketTimeline : dans une bande, à égalité de jour, le plus grand identifiant passe en premier', () => {
  const entries = ticketTimeline(
    [
      ticket('T-0010', '2026-08-11', { plan: 'p1.md' }),
      ticket('T-0012', '2026-08-11', { plan: 'p1.md' }),
      ticket('T-0011', '2026-08-11', { plan: 'p1.md' }),
    ],
    [plan('p1.md', [])],
  )

  assert.deepEqual(
    entries[0].tickets.map(t => t.id),
    ['T-0012', 'T-0011', 'T-0010'],
  )
})

test('ticketTimeline : un ticket sans plan reste une entrée à lui seul', () => {
  const entries = ticketTimeline(
    [ticket('T-0001', '2026-08-08', { plan: 'p1.md' }), ticket('T-0002', '2026-08-09', { plan: null })],
    [plan('p1.md', [])],
  )

  assert.deepEqual(
    entries.map(e => e.kind),
    ['ticket', 'plan'],
  )
  assert.equal(entries[0].ticket.id, 'T-0002')
})

test('ticketTimeline : un plan sans ticket qui le cite ne figure pas dans la frise', () => {
  const entries = ticketTimeline([], [plan('vide.md', [], { status: 'open', closed: null })])

  assert.equal(entries.length, 0)
})

test('ticketTimeline : un plan référencé mais absent du disque garde sa bande', () => {
  const entries = ticketTimeline([ticket('T-0001', '2026-08-08', { plan: 'disparu.md' })], [])

  assert.equal(entries.length, 1)
  assert.equal(entries[0].kind, 'plan')
  assert.equal(entries[0].plan, 'disparu.md')
  assert.equal(entries[0].title, 'disparu.md')
  assert.equal(entries[0].status, 'open')
})
