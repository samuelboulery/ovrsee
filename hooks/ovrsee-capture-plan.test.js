import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { avancerTicketsClos } from './ovrsee-capture-plan.js'
import { createTicket, readTickets } from './tickets.js'

/**
 * Ce fichier existe aussi pour une raison de forme : importer le hook ne doit
 * rien exécuter (pas de lecture de stdin, pas d'écriture). S'il lançait
 * encore son corps à l'import, ce test bloquerait sur stdin à chaque
 * `pnpm test`.
 */

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-capture-plan-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  return ovrseeDir
}

test('avancerTicketsClos ne fait rien sans plan fermé', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'backlog', plan: '2026-08-10-x.md' })

  avancerTicketsClos(ovrseeDir, [])

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'backlog')
})

test('avancerTicketsClos déplace en colonne finale les tickets du plan fermé', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'en-cours', plan: '2026-08-10-x.md' })

  avancerTicketsClos(ovrseeDir, ['2026-08-10-x.md'])

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('avancerTicketsClos ignore les tickets d’un autre plan', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'backlog', plan: '2026-08-10-autre.md' })

  avancerTicketsClos(ovrseeDir, ['2026-08-10-x.md'])

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'backlog')
})

test('avancerTicketsClos ne fait rien sur un board à une seule colonne', () => {
  const ovrseeDir = fixture()
  writeFileSync(join(ovrseeDir, 'board.json'), JSON.stringify({ colonnes: [{ id: 'seul', titre: 'Seul' }] }), 'utf8')
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'seul', plan: '2026-08-10-x.md' })

  assert.doesNotThrow(() => avancerTicketsClos(ovrseeDir, ['2026-08-10-x.md']))
  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'seul')
})
