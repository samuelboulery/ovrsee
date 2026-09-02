import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readJson } from './json.js'

const fichier = contenu => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-json-'))
  const path = join(dir, 'x.json')
  writeFileSync(path, contenu, 'utf8')
  return path
}

test('readJson rend la valeur lue', () => {
  assert.deepEqual(readJson(fichier('{"a":1}')), { a: 1 })
})

test('readJson rend le défaut sur un fichier absent', () => {
  assert.equal(readJson(join(tmpdir(), 'ovrsee-absent-' + Date.now() + '.json')), null)
})

test('readJson rend le défaut sur un JSON corrompu', () => {
  assert.deepEqual(readJson(fichier('{ pas du json'), { colonnes: [] }), { colonnes: [] })
})

test('readJson clone le défaut : deux appels ne partagent pas d’objet', () => {
  const defaut = { projets: {} }
  const absent = join(tmpdir(), 'ovrsee-absent-' + Date.now() + '.json')

  const un = readJson(absent, defaut)
  un.projets.pollution = true

  assert.deepEqual(readJson(absent, defaut), { projets: {} })
  assert.deepEqual(defaut, { projets: {} }, 'le défaut lui-même reste intact')
})
