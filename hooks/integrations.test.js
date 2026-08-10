import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { readIntegrations, writeIntegrations, validateIntegrationList } from './integrations.js'

const tempDir = () => mkdtempSync(join(tmpdir(), 'ovrsee-integrations-'))

test('readIntegrations avec fichier absent → liste vide', () => {
  const dir = tempDir()
  try {
    process.env.OVRSEE_INTEGRATIONS = join(dir, 'inexistant.json')
    assert.deepEqual(readIntegrations('/projet/a'), [])
  } finally {
    delete process.env.OVRSEE_INTEGRATIONS
    rmSync(dir, { recursive: true })
  }
})

test('readIntegrations avec fichier corrompu → liste vide', () => {
  const dir = tempDir()
  try {
    const file = join(dir, 'integrations.json')
    writeFileSync(file, '{broken json')
    process.env.OVRSEE_INTEGRATIONS = file
    assert.deepEqual(readIntegrations('/projet/a'), [])
  } finally {
    delete process.env.OVRSEE_INTEGRATIONS
    rmSync(dir, { recursive: true })
  }
})

test('readIntegrations avec projet absent du fichier → liste vide', () => {
  const dir = tempDir()
  try {
    const file = join(dir, 'integrations.json')
    writeFileSync(file, JSON.stringify({ '/projet/b': [] }))
    process.env.OVRSEE_INTEGRATIONS = file
    assert.deepEqual(readIntegrations('/projet/a'), [])
  } finally {
    delete process.env.OVRSEE_INTEGRATIONS
    rmSync(dir, { recursive: true })
  }
})

test('writeIntegrations écrit et readIntegrations relit', () => {
  const dir = tempDir()
  try {
    process.env.OVRSEE_INTEGRATIONS = join(dir, 'integrations.json')
    const liste = [{ id: 'i1', provider: 'vercel', label: 'Prod', url: 'https://vercel.com/x' }]
    writeIntegrations('/projet/a', liste)
    assert.deepEqual(readIntegrations('/projet/a'), liste)
  } finally {
    delete process.env.OVRSEE_INTEGRATIONS
    rmSync(dir, { recursive: true })
  }
})

test('writeIntegrations isole par projet', () => {
  const dir = tempDir()
  try {
    process.env.OVRSEE_INTEGRATIONS = join(dir, 'integrations.json')
    writeIntegrations('/projet/a', [{ id: 'i1', provider: 'vercel', label: 'A' }])
    writeIntegrations('/projet/b', [{ id: 'i2', provider: 'netlify', label: 'B' }])
    assert.equal(readIntegrations('/projet/a').length, 1)
    assert.equal(readIntegrations('/projet/a')[0].id, 'i1')
    assert.equal(readIntegrations('/projet/b')[0].id, 'i2')
  } finally {
    delete process.env.OVRSEE_INTEGRATIONS
    rmSync(dir, { recursive: true })
  }
})

test('writeIntegrations avec liste vide efface les intégrations du projet', () => {
  const dir = tempDir()
  try {
    process.env.OVRSEE_INTEGRATIONS = join(dir, 'integrations.json')
    writeIntegrations('/projet/a', [{ id: 'i1', provider: 'vercel', label: 'A' }])
    writeIntegrations('/projet/a', [])
    assert.deepEqual(readIntegrations('/projet/a'), [])
  } finally {
    delete process.env.OVRSEE_INTEGRATIONS
    rmSync(dir, { recursive: true })
  }
})

test('writeIntegrations conserve tokenCipher', () => {
  const dir = tempDir()
  try {
    process.env.OVRSEE_INTEGRATIONS = join(dir, 'integrations.json')
    const liste = [
      { id: 'i1', provider: 'supabase', label: 'DB', url: '', tokenCipher: 'YmFzZTY0' },
    ]
    writeIntegrations('/projet/a', liste)
    assert.equal(readIntegrations('/projet/a')[0].tokenCipher, 'YmFzZTY0')
  } finally {
    delete process.env.OVRSEE_INTEGRATIONS
    rmSync(dir, { recursive: true })
  }
})

test('validateIntegrationList : rejette une entrée sans id', () => {
  const result = validateIntegrationList([{ provider: 'vercel', label: 'A' }])
  assert.equal(result.length, 0)
})

test('validateIntegrationList : rejette une entrée sans label', () => {
  const result = validateIntegrationList([{ id: 'i1', provider: 'vercel' }])
  assert.equal(result.length, 0)
})

test('validateIntegrationList : rejette un provider inconnu', () => {
  const result = validateIntegrationList([{ id: 'i1', provider: 'heroku', label: 'A' }])
  assert.equal(result.length, 0)
})

test('validateIntegrationList : accepte les quatre fournisseurs connus', () => {
  const providers = ['vercel', 'netlify', 'supabase', 'autre']
  const result = validateIntegrationList(
    providers.map((provider, i) => ({ id: `i${i}`, provider, label: provider })),
  )
  assert.equal(result.length, 4)
})

test('validateIntegrationList : conserve les valides, rejette les invalides', () => {
  const result = validateIntegrationList([
    { id: 'i1', provider: 'vercel', label: 'Valide' },
    { id: 'i2', provider: 'inconnu', label: 'Invalide' },
    'pas un objet',
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'i1')
})

test('validateIntegrationList : non-array → liste vide', () => {
  assert.deepEqual(validateIntegrationList('pas un array'), [])
  assert.deepEqual(validateIntegrationList(null), [])
})

test('writeIntegrations rejette les entrées invalides avant écriture', () => {
  const dir = tempDir()
  try {
    process.env.OVRSEE_INTEGRATIONS = join(dir, 'integrations.json')
    writeIntegrations('/projet/a', [
      { id: 'i1', provider: 'vercel', label: 'Valide' },
      { id: 'i2', provider: 'heroku', label: 'Invalide' },
    ])
    const lue = readIntegrations('/projet/a')
    assert.equal(lue.length, 1)
    assert.equal(lue[0].id, 'i1')
  } finally {
    delete process.env.OVRSEE_INTEGRATIONS
    rmSync(dir, { recursive: true })
  }
})
