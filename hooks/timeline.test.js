import { test } from 'node:test'
import assert from 'node:assert/strict'

import { timeline } from './timeline.js'

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
