import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ticketManquant } from './ovrsee-tool-edit-gate.js'
import { createTicket } from './tickets.js'

/** Un dossier `ovrsee/` jetable avec un board par défaut (colonnes standard). */
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-tool-edit-gate-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  return ovrseeDir
}

test('ticketManquant est vrai quand aucun ticket ne cite le plan', () => {
  const ovrseeDir = fixture()
  assert.equal(ticketManquant(ovrseeDir, '2026-08-10-x.md'), true)
})

test('ticketManquant est faux dès qu’un ticket cite le plan', () => {
  const ovrseeDir = fixture()
  createTicket(ovrseeDir, { titre: 'X', colonne: 'backlog', plan: '2026-08-10-x.md' })

  assert.equal(ticketManquant(ovrseeDir, '2026-08-10-x.md'), false)
})

test('ticketManquant ignore les tickets liés à un autre plan', () => {
  const ovrseeDir = fixture()
  createTicket(ovrseeDir, { titre: 'X', colonne: 'backlog', plan: '2026-08-10-autre.md' })

  assert.equal(ticketManquant(ovrseeDir, '2026-08-10-x.md'), true)
})

test('ticketManquant est faux si au moins un ticket parmi plusieurs cite le plan', () => {
  const ovrseeDir = fixture()
  createTicket(ovrseeDir, { titre: 'A', colonne: 'backlog', plan: '2026-08-10-autre.md' })
  createTicket(ovrseeDir, { titre: 'B', colonne: 'pret', plan: '2026-08-10-x.md' })

  assert.equal(ticketManquant(ovrseeDir, '2026-08-10-x.md'), false)
})

test('ticketManquant tolère un board.json absent (colonnes par défaut)', () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-tool-edit-gate-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(ovrseeDir, { recursive: true }) // pas de sous-dossier tickets/

  assert.equal(ticketManquant(ovrseeDir, '2026-08-10-x.md'), true)
})

test('ticketManquant tolère un board.json corrompu sans lever', () => {
  const ovrseeDir = fixture()
  writeFileSync(join(ovrseeDir, 'board.json'), '{ pas du json', 'utf8')

  assert.doesNotThrow(() => ticketManquant(ovrseeDir, '2026-08-10-x.md'))
})
