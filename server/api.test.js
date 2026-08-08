import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolve } from './api.js'
import { shotPath } from '../hooks/snapshot.js'

const url = path => new URL(path, 'http://localhost')

const projectWithShot = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-'))
  mkdirSync(join(dir, 'cockpit', 'pages', 'shots', 'accueil'), { recursive: true })
  writeFileSync(join(dir, 'cockpit', 'pages', 'shots', 'accueil', '2026-08-08-abc.png'), 'png')
  writeFileSync(join(dir, 'secret.txt'), 'ne doit jamais sortir')
  return dir
}

test('une route inconnue rend null pour que l’appelant passe la main', () => {
  assert.equal(resolve(url('/index.html')), null)
  assert.equal(resolve(url('/historique')), null)
})

test('/api/projects place le dépôt courant en tête', () => {
  const dir = projectWithShot()
  const result = resolve(url('/api/projects'), dir)

  assert.ok(result && 'json' in result)
  assert.equal(result.json[0].path, dir)
})

test('/api/project rend le snapshot du projet demandé', () => {
  const dir = projectWithShot()
  const result = resolve(url(`/api/project?path=${encodeURIComponent(dir)}`), dir)

  assert.ok(result && 'json' in result)
  assert.equal(result.json.root, dir)
  assert.deepEqual(result.json.plans, [])
})

test('/api/project refuse un chemin non enregistré plutôt que de lire le disque', () => {
  const dir = projectWithShot()
  const result = resolve(url('/api/project?path=%2Fetc'), dir)

  assert.equal(result.status, 404)
})

test('/api/shot sert une capture du projet', () => {
  const dir = projectWithShot()
  const result = resolve(
    url(`/api/shot?path=${encodeURIComponent(dir)}&file=shots/accueil/2026-08-08-abc.png`),
    dir,
  )

  assert.ok('file' in result)
  assert.match(result.file, /2026-08-08-abc\.png$/)
})

test('/api/shot ne laisse pas sortir du dossier des captures', () => {
  const dir = projectWithShot()
  for (const evasion of ['../../secret.txt', '../../../etc/passwd', '/etc/passwd']) {
    const result = resolve(
      url(`/api/shot?path=${encodeURIComponent(dir)}&file=${encodeURIComponent(evasion)}`),
      dir,
    )
    assert.equal(result.status, 404, `devrait refuser ${evasion}`)
  }
})

test('shotPath refuse la traversée et accepte un chemin légitime', () => {
  const dir = projectWithShot()

  assert.equal(shotPath(dir, '../../secret.txt'), null)
  assert.equal(shotPath(dir, 'shots/inexistant.png'), null)
  assert.ok(shotPath(dir, 'shots/accueil/2026-08-08-abc.png'))
})
