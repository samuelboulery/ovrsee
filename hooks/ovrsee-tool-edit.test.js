import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { avancerTicketsEnCours, estUneEditionSource } from './ovrsee-tool-edit.js'
import { createTicket, readTickets } from './tickets.js'

/** Un dossier `ovrsee/` jetable avec un board par défaut (colonnes standard). */
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-tool-edit-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  return ovrseeDir
}

// --- estUneEditionSource -----------------------------------------------------

test('estUneEditionSource accepte un fichier source du dépôt', () => {
  assert.equal(estUneEditionSource('/repo', '/repo/app/src/App.tsx'), true)
})

test('estUneEditionSource refuse un fichier sous ovrsee/', () => {
  assert.equal(estUneEditionSource('/repo', '/repo/ovrsee/tickets/T-0001-x.md'), false)
})

test('estUneEditionSource refuse un fichier sous graphify-out/', () => {
  assert.equal(estUneEditionSource('/repo', '/repo/graphify-out/graph.json'), false)
})

test('estUneEditionSource refuse un chemin hors du dépôt', () => {
  assert.equal(estUneEditionSource('/repo', '/ailleurs/fichier.js'), false)
})

test('estUneEditionSource encaisse un chemin absent', () => {
  assert.equal(estUneEditionSource('/repo', undefined), false)
})

// --- avancerTicketsEnCours ---------------------------------------------------

// Ce test affirmait l'inverse : un ticket du backlog passait en cours dès la
// première édition. C'était un choix, pas un oubli — la fonction le documentait.
// Il est renversé sciemment, parce que le comportement produisait une perte
// silencieuse : ce hook mettait en vol tous les tickets du plan, et
// `ovrsee-post-commit` les soldait tous au commit suivant. Un plan qui produit
// neuf tickets vidait le tableau d'un coup, sans que rien ne le signale.
//
// La règle est maintenant l'attribution : on n'avance un ticket que si on peut
// lui rattacher le travail. Ici, « prêt » est ce rattachement — c'est le ticket
// que l'on avait mis en file. Le backlog est du travail remis à plus tard, et
// éditer un fichier ne revient pas sur cette décision.
test('avancerTicketsEnCours laisse le backlog tranquille', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'backlog', plan: '2026-08-10-x.md' })

  avancerTicketsEnCours(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'backlog')
})

test('avancerTicketsEnCours fait revenir en cours un ticket qui était en revue', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'revue', plan: '2026-08-10-x.md' })

  avancerTicketsEnCours(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'en-cours')
})

test('avancerTicketsEnCours ne touche pas un ticket déjà en cours', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'en-cours', plan: '2026-08-10-x.md' })

  avancerTicketsEnCours(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'en-cours')
})

test('avancerTicketsEnCours ne recule jamais un ticket en colonne finale', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'fait', plan: '2026-08-10-x.md' })

  avancerTicketsEnCours(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('avancerTicketsEnCours ignore les tickets d’un autre plan', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'backlog', plan: '2026-08-10-autre.md' })

  avancerTicketsEnCours(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'backlog')
})

test('avancerTicketsEnCours ne fait rien si le board n’a pas de colonne en-cours', () => {
  const ovrseeDir = fixture()
  writeFileSync(
    join(ovrseeDir, 'board.json'),
    JSON.stringify({ colonnes: [{ id: 'todo', titre: 'À faire' }, { id: 'done', titre: 'Fait' }] }),
    'utf8',
  )
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'todo', plan: '2026-08-10-x.md' })

  assert.doesNotThrow(() => avancerTicketsEnCours(ovrseeDir, '2026-08-10-x.md'))
  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'todo')
})

// Le pendant amont du défaut corrigé dans `ovrsee-post-commit` : ce hook
// mettait en vol TOUS les tickets du plan dès la première édition, y compris
// ceux qu'on avait délibérément laissés en backlog. Le commit les soldait
// ensuite. Réparer le seul post-commit ne suffisait pas.
//
// Un ticket en backlog est du travail qu'on a décidé de ne pas faire
// maintenant. Éditer un fichier ne revient pas sur cette décision.

test('avancerTicketsEnCours ne sort pas un ticket du backlog', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'Plus tard', colonne: 'backlog', plan: 'p.md' })

  avancerTicketsEnCours(ovrseeDir, 'p.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'backlog')
})

test('avancerTicketsEnCours promeut un ticket prêt', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'Prêt', colonne: 'pret', plan: 'p.md' })

  avancerTicketsEnCours(ovrseeDir, 'p.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'en-cours')
})
