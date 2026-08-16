import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ticketManquant, ticketActifManquant } from './ovrsee-tool-edit-gate.js'
import { createTicket, moveTicket } from './tickets.js'

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

// --- ticketActifManquant (pas de plan actif, .active-ticket hors-plan) -----

test('ticketActifManquant est vrai quand .active-ticket est absent', () => {
  assert.equal(ticketActifManquant(fixture()), true)
})

test('ticketActifManquant est faux quand .active-ticket pointe un ticket ouvert', () => {
  const ovrseeDir = fixture()
  createTicket(ovrseeDir, { titre: 'Ad hoc' }) // pose .active-ticket automatiquement

  assert.equal(ticketActifManquant(ovrseeDir), false)
})

test('ticketActifManquant est vrai quand le ticket actif n’existe plus', () => {
  const ovrseeDir = fixture()
  writeFileSync(join(ovrseeDir, '.active-ticket'), 'T-0099\n', 'utf8')

  assert.equal(ticketActifManquant(ovrseeDir), true)
})

test('ticketActifManquant est vrai quand le ticket actif est en colonne finale', () => {
  const ovrseeDir = fixture()
  // colonne finale d'entrée : createTicket ne l'active pas automatiquement
  // (voir tickets.test.js), donc .active-ticket est posé à la main ici pour
  // isoler la branche « ticket trouvé mais terminé » de ticketActifManquant.
  const { meta } = createTicket(ovrseeDir, { titre: 'Terminé', colonne: 'fait' })
  writeFileSync(join(ovrseeDir, '.active-ticket'), meta.id + '\n', 'utf8')

  assert.equal(ticketActifManquant(ovrseeDir), true)
})

test('moveTicket vers la colonne finale efface .active-ticket, ce que confirme ticketActifManquant', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'Terminé' })
  moveTicket(ovrseeDir, file, 'fait')

  assert.equal(ticketActifManquant(ovrseeDir), true)
})

// --- sessions concurrentes -------------------------------------------------

test('le ticket actif d’une session ne couvre pas les éditions d’une autre', () => {
  const ovrseeDir = fixture()
  createTicket(ovrseeDir, { titre: 'Ad hoc de A' }, new Date(), 'session-a')

  assert.equal(ticketActifManquant(ovrseeDir, 'session-a'), false)
  assert.equal(ticketActifManquant(ovrseeDir, 'session-b'), true)
})

test('deux sessions ont chacune leur ticket actif, sans se gêner', () => {
  const ovrseeDir = fixture()
  createTicket(ovrseeDir, { titre: 'Ad hoc de A' }, new Date(), 'session-a')
  const b = createTicket(ovrseeDir, { titre: 'Ad hoc de B' }, new Date(), 'session-b')

  // Solder celui de B ne rouvre pas la gate pour A.
  moveTicket(ovrseeDir, b.file, 'fait', new Date(), 'session-b')

  assert.equal(ticketActifManquant(ovrseeDir, 'session-a'), false)
  assert.equal(ticketActifManquant(ovrseeDir, 'session-b'), true)
})
