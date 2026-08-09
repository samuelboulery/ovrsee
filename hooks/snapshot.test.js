import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { snapshot } from './snapshot.js'

const project = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-snap-'))
  mkdirSync(join(dir, 'cockpit', 'plans'), { recursive: true })
  return dir
}

test('le README du dépôt part avec le snapshot', () => {
  const dir = project()
  writeFileSync(join(dir, 'README.md'), '# Titre\n\nCe que fait le projet.\n')

  assert.match(snapshot(dir).readme, /Ce que fait le projet\./)
})

test('un dépôt sans README rend null, pas une chaîne vide', () => {
  // La distinction porte : l'onglet Aperçu dit « pas de README » plutôt que
  // d'afficher un cadre vide qui ressemblerait à une panne de lecture.
  assert.equal(snapshot(project()).readme, null)
})

test('un README démesuré est coupé, et le dit', () => {
  const dir = project()
  writeFileSync(join(dir, 'README.md'), 'a'.repeat(500_000))

  const { readme } = snapshot(dir)
  assert.ok(readme.length < 500_000)
  assert.match(readme, /coupé à \d+ caractères/)
})

test('les scripts du package.json arrivent tels quels', () => {
  const dir = project()
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { dev: 'vite' } }))

  assert.deepEqual(snapshot(dir).packageJson.scripts, { dev: 'vite' })
})

// --- fichiers illisibles ---------------------------------------------------
//
// Un plan ou un ticket au frontmatter cassé rendait `[]` : le fichier existait
// sur le disque, l'interface affirmait qu'il n'y avait rien. Le crawl, lui,
// inscrit ses échecs — la lecture doit le faire aussi.

test('un plan au frontmatter cassé est signalé au lieu de disparaître', () => {
  const dir = project()
  writeFileSync(join(dir, 'cockpit', 'plans', '2026-08-09-casse.md'), '---\npas du json\n---\ncorps\n')

  const { plans, illisibles } = snapshot(dir)
  assert.deepEqual(plans, [])
  assert.deepEqual(illisibles, [{ file: 'plans/2026-08-09-casse.md', quoi: 'plan' }])
})

test('un ticket au frontmatter cassé est signalé au lieu de disparaître', () => {
  const dir = project()
  mkdirSync(join(dir, 'cockpit', 'tickets'), { recursive: true })
  writeFileSync(join(dir, 'cockpit', 'tickets', 'T-0001-casse.md'), '---\n{ cassé\n---\n\ncorps\n')

  const { tickets, illisibles } = snapshot(dir)
  assert.deepEqual(tickets, [])
  assert.deepEqual(illisibles, [{ file: 'tickets/T-0001-casse.md', quoi: 'ticket' }])
})

test('un fichier cassé ne cache pas ceux qui se lisent', () => {
  const dir = project()
  mkdirSync(join(dir, 'cockpit', 'tickets'), { recursive: true })
  writeFileSync(join(dir, 'cockpit', 'tickets', 'T-0001-casse.md'), '---\n{ cassé\n---\n')
  writeFileSync(
    join(dir, 'cockpit', 'tickets', 'T-0002-bon.md'),
    '---\n{ "id": "T-0002", "titre": "Bon", "colonne": "backlog" }\n---\n\ncorps\n',
  )

  const { tickets, illisibles } = snapshot(dir)
  assert.equal(tickets.length, 1)
  assert.equal(tickets[0].id, 'T-0002')
  assert.equal(illisibles.length, 1)
})

test('une ligne illisible de scans.jsonl est comptée, pas seulement sautée', () => {
  const dir = project()
  mkdirSync(join(dir, 'cockpit', 'pages'), { recursive: true })
  writeFileSync(
    join(dir, 'cockpit', 'pages', 'scans.jsonl'),
    'pas du json\n{"date":"2026-08-09","ok":true,"commit":"abc"}\n',
  )

  const { scans, illisibles } = snapshot(dir)
  assert.equal(scans.length, 1)
  assert.deepEqual(illisibles, [{ file: 'pages/scans.jsonl', quoi: 'scan', lignes: 1 }])
})

test('un projet sain ne signale rien', () => {
  assert.deepEqual(snapshot(project()).illisibles, [])
})
