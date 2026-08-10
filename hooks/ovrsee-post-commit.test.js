import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { crawlUtile, avancerTicketsDuPlan } from './ovrsee-post-commit.js'
import { createTicket, readTickets } from './tickets.js'

/**
 * Le crawl coûte le démarrage d'une application et d'un navigateur. Le
 * déclencher sur un commit qui ne range que les sorties du crawl précédent en
 * produit une nouvelle fournée, laquelle en produira une autre : l'arbre de
 * travail ne peut alors jamais redevenir propre.
 *
 * Ce fichier existe aussi pour une raison de forme : importer le hook ne doit
 * rien exécuter. S'il lançait encore son corps à l'import, ce test lancerait un
 * crawl à chaque `pnpm test`.
 */

test('un commit qui touche du code déclenche le crawl', () => {
  assert.equal(crawlUtile(['app/src/App.tsx']), true)
  assert.equal(crawlUtile(['README.md', 'hooks/plans.js']), true)
})

test('un commit sans fichier source ne déclenche rien', () => {
  // `changedFiles()` a déjà retiré `ovrsee/` et `graphify-out/` : une liste
  // vide veut dire « ce commit n'a touché que des sorties ».
  assert.equal(crawlUtile([]), false)
})

test('crawlUtile encaisse une liste absente', () => {
  assert.equal(crawlUtile(undefined), false)
  assert.equal(crawlUtile(null), false)
})

// --- avancerTicketsDuPlan ---------------------------------------------------

/** Un dossier `ovrsee/` jetable avec un board par défaut (colonnes standard). */
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-post-commit-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  return ovrseeDir
}

test('avancerTicketsDuPlan fait passer en colonne finale un ticket lié en revue', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'revue', plan: '2026-08-10-x.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('avancerTicketsDuPlan pousse aussi un ticket resté en cours (pas de colonne revue)', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'en-cours', plan: '2026-08-10-x.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('avancerTicketsDuPlan ne retouche jamais un ticket déjà en finale', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'fait', plan: '2026-08-10-x.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('avancerTicketsDuPlan ignore les tickets d’un autre plan', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'backlog', plan: '2026-08-10-autre.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'backlog')
})

test('avancerTicketsDuPlan ne fait rien sur un board à une seule colonne', () => {
  const ovrseeDir = fixture()
  writeFileSync(
    join(ovrseeDir, 'board.json'),
    JSON.stringify({ colonnes: [{ id: 'todo', titre: 'À faire' }] }),
    'utf8',
  )
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'todo', plan: '2026-08-10-x.md' })

  assert.doesNotThrow(() => avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md'))
  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'todo')
})
