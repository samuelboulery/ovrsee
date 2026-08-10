import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { avancerTicketsEnRevue, aDuCodeNonCommite } from './ovrsee-tool-stop.js'
import { createTicket, readTickets } from './tickets.js'

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/** Un dépôt git jetable, avec `ovrsee/tickets/` prêt et un premier commit. */
const repo = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-tool-stop-'))
  git(['init', '-q'], root)
  git(['config', 'user.email', 'test@example.com'], root)
  git(['config', 'user.name', 'Test'], root)
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  writeFileSync(join(root, 'README.md'), 'init\n')
  git(['add', '.'], root)
  git(['commit', '-q', '-m', 'init'], root)
  return { root, ovrseeDir }
}

// --- aDuCodeNonCommite --------------------------------------------------------

test('aDuCodeNonCommite est faux sur un arbre propre', () => {
  const { root } = repo()
  assert.equal(aDuCodeNonCommite(root), false)
})

test('aDuCodeNonCommite est vrai quand un fichier source est modifié', () => {
  const { root } = repo()
  writeFileSync(join(root, 'app.js'), 'console.log(1)\n')
  assert.equal(aDuCodeNonCommite(root), true)
})

test('aDuCodeNonCommite ignore les changements sous ovrsee/', () => {
  const { root, ovrseeDir } = repo()
  writeFileSync(join(ovrseeDir, 'tickets', 'T-0001-x.md'), '---\n{}\n---\n')
  assert.equal(aDuCodeNonCommite(root), false)
})

test('aDuCodeNonCommite ignore les changements sous graphify-out/', () => {
  const { root } = repo()
  mkdirSync(join(root, 'graphify-out'), { recursive: true })
  writeFileSync(join(root, 'graphify-out', 'graph.json'), '{}\n')
  assert.equal(aDuCodeNonCommite(root), false)
})

// --- avancerTicketsEnRevue ----------------------------------------------------

test('avancerTicketsEnRevue fait passer en revue un ticket en cours', () => {
  const { ovrseeDir } = repo()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'en-cours', plan: '2026-08-10-x.md' })

  avancerTicketsEnRevue(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'revue')
})

test('avancerTicketsEnRevue ne touche pas un ticket pas encore commencé', () => {
  const { ovrseeDir } = repo()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'pret', plan: '2026-08-10-x.md' })

  avancerTicketsEnRevue(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'pret')
})

test('avancerTicketsEnRevue ignore les tickets d’un autre plan', () => {
  const { ovrseeDir } = repo()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'en-cours', plan: '2026-08-10-autre.md' })

  avancerTicketsEnRevue(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'en-cours')
})

test('avancerTicketsEnRevue ne fait rien si le board n’a pas de colonne revue', () => {
  const { ovrseeDir } = repo()
  writeFileSync(
    join(ovrseeDir, 'board.json'),
    JSON.stringify({ colonnes: [{ id: 'en-cours', titre: 'En cours' }, { id: 'fait', titre: 'Fait' }] }),
    'utf8',
  )
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'en-cours', plan: '2026-08-10-x.md' })

  assert.doesNotThrow(() => avancerTicketsEnRevue(ovrseeDir, '2026-08-10-x.md'))
  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'en-cours')
})
