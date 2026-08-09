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
