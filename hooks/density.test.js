import test from 'node:test'
import assert from 'node:assert/strict'

import { density, dailyCounts, foldWeekly } from './density.js'

const MAINTENANT = new Date('2026-07-20T12:00:00')

test('density compte les commits du plus ancien seau au plus récent', () => {
  const d = density([{ date: '2026-07-18T10:00:00' }, { date: '2026-07-20T09:00:00' }], {
    fenetre: 'semaine',
    now: MAINTENANT,
  })
  assert.equal(d.length, 7)
  assert.equal(
    d.reduce((a, b) => a + b, 0),
    2,
  )
  assert.equal(d.at(-1), 1, 'le commit du jour tombe dans le dernier seau')
})

test('density ignore les commits hors fenêtre au lieu de les empiler sur le premier seau', () => {
  const d = density([{ date: '2020-01-02T10:00:00' }], { fenetre: 'semaine', now: MAINTENANT })
  assert.deepEqual(d, [0, 0, 0, 0, 0, 0, 0])
})

test('density rend une fenêtre de zéros quand il n’y a aucun commit', () => {
  assert.deepEqual(density([], { fenetre: 'semaine', now: MAINTENANT }).length, 7)
  assert.ok(density([], { fenetre: 'semaine', now: MAINTENANT }).every(v => v === 0))
})

test('density survit à une entrée qui n’est pas une liste', () => {
  assert.ok(density(null, { fenetre: 'semaine', now: MAINTENANT }).every(v => v === 0))
})

/**
 * Le cas qui a motivé le changement : la densité ne lisait que `plan.commits`,
 * donc un projet avancé par correctifs hors plan paraissait dormant.
 */
test('density compte un commit hors plan comme un commit de plan', () => {
  const dansUnPlan = { date: '2026-07-20T09:00:00' }
  const horsPlan = { date: '2026-07-20T11:00:00' }
  const d = density([dansUnPlan, horsPlan], { fenetre: 'semaine', now: MAINTENANT })
  assert.equal(d.at(-1), 2, 'les deux commits du jour comptent, quelle que soit leur origine')
})

test('dailyCounts range le jour courant en dernier seau', () => {
  const c = dailyCounts([{ date: '2026-07-18T10:00:00' }, { date: '2026-07-20T09:00:00' }], 7, MAINTENANT)
  assert.equal(c.length, 7)
  assert.equal(c.at(-1), 1, 'le jour courant est le dernier seau')
  assert.equal(
    c.reduce((a, b) => a + b, 0),
    2,
  )
})

test('dailyCounts ignore les entrées hors fenêtre', () => {
  const c = dailyCounts([{ date: '2020-01-02T10:00:00' }], 7, MAINTENANT)
  assert.deepEqual(c, [0, 0, 0, 0, 0, 0, 0])
})

test('dailyCounts survit à une entrée qui n’est pas une liste, ou une date illisible', () => {
  assert.ok(dailyCounts(null, 7, MAINTENANT).every(v => v === 0))
  assert.ok(dailyCounts([{ date: 'pas une date' }], 7, MAINTENANT).every(v => v === 0))
})

test('foldWeekly somme sept jours consécutifs par semaine, dans l’ordre', () => {
  const daily = [1, 0, 0, 0, 0, 0, 0, /* semaine 1 */ 2, 2, 0, 0, 0, 0, 0 /* semaine 2 */]
  assert.deepEqual(foldWeekly(daily), [1, 4])
})

test('foldWeekly d’une série vide rend une série vide', () => {
  assert.deepEqual(foldWeekly([]), [])
})
